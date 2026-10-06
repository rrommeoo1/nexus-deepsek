<#
.SYNOPSIS
  Bucla de dezvoltare Android Nexus: telefonul Xiaomi rămâne conectat, codul se
  modifică pe PC, iar Metro livrează schimbarea prin Fast Refresh (fără reinstalare).

.DESCRIPTION
  Aplicația Nexus completă rulează din `apps/nexus-web` pe acest PC și ajunge pe
  telefon prin `adb reverse`, deci clientul web are origine sigură (`localhost`)
  pentru cameră, microfon și WebCrypto. Clientul Android este un shell WebView:
  editezi `apps/nexus-web/public/**` pe PC și reîncarci, ori editezi `src/**` în
  clientul Android și Fast Refresh aplică singur.

  Acțiuni disponibile:
    doctor        verifică toolchain, telefon, aplicația instalată, Metro și aplicația web
    tools         afișează căile rezolvate (JDK, SDK, adb, scrcpy)
    device        afișează telefonul folosit și proprietățile lui
    web           pornește aplicația web locală (apps/nexus-web), dacă nu rulează deja
    reverse       redirecționează porturile Metro și ale aplicației web către telefon (adb reverse)
    open          conectează aplicația de pe telefon la Metro (deep link, fără atingere)
    reload        reîncarcă aplicația de pe telefon, ca să ia ultimul client web editat
    wake          ține telefonul treaz pe durata sesiunii (alimentare simulată, fără Doze)
    restore       readuce telefonul în starea normală (alimentare reală, Doze activ)
    install       reinstalează APK-ul de development peste instalarea existentă
    metro         pornește dev server-ul Expo/Metro în prim-plan
    mirror        oglindește telefonul pe ecranul PC-ului (scrcpy)
    logs          urmărește logcat pentru procesul aplicației
    ui            afișează textul real randat de aplicație (dovada Fast Refresh)
    login         autentifică în WebView-ul de pe telefon (email+parolă, prin CDP)
    setup-scrcpy  descarcă scrcpy (open-source) în tools\scrcpy
    dev           bucla completă: telefon treaz + aplicația web + Metro + adb reverse + deep link + oglindire

.EXAMPLE
  npm run dev:android
  npm run dev:doctor
  npm run dev:mirror
#>
[CmdletBinding()]
param(
  [ValidateSet('doctor', 'tools', 'device', 'wake', 'restore', 'web', 'reverse', 'open', 'reload', 'install', 'metro', 'mirror', 'logs', 'ui', 'login', 'setup-scrcpy', 'dev')]
  [string]$Action = 'doctor',

  # Serialul ADB preferat; implicit se alege automat transportul IP:port.
  [string]$Device,

  [int]$Port = 8081,

  # Portul aplicației web locale (apps/nexus-web). Trebuie să coincidă cu PORT
  # din apps/nexus-web/.env, altfel telefonul primește un port fără server.
  [int]$WebPort = 5000,

  # Sare peste typecheck/lint în `doctor`.
  [switch]$SkipChecks,

  # În `dev`, pornește Metro și redirecționarea, dar nu deschide fereastra scrcpy.
  [switch]$NoMirror,

  # Contul folosit de `login` (implicit contul de test documentat).
  [string]$Email = 'test@nexus.ro',

  [string]$Password = 'test1234',

  # Portul local pentru CDP (redirecționare adb către WebView-ul de pe telefon).
  [int]$CdpPort = 9222
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Mesajele conțin diacritice românești; afișarea corectă cere UTF-8 pe consolă.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
. (Join-Path $PSScriptRoot 'nexus-env.ps1')

$mobileRoot = $script:NexusMobileRoot
$apkPath = Join-Path $mobileRoot 'builds\nexus-dev-arm64.apk'
$toolchain = Import-NexusToolchain -Device $Device -ApplyEnvironment

function Get-NexusNpmCommand {
  param([ValidateSet('npm', 'npx')][string]$Name)
  $resolved = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
  if (-not $resolved) { $resolved = Get-Command $Name -ErrorAction SilentlyContinue }
  if (-not $resolved) { throw "$Name nu a fost găsit în PATH. Este nevoie de Node.js." }
  return $resolved.Source
}

function Assert-NexusToolchain {
  if (-not $toolchain.Adb) {
    throw 'adb nu a fost găsit. Verifică instalarea Android SDK (platform-tools).'
  }
  if (-not $toolchain.DeviceSerial) {
    throw 'Niciun telefon autorizat. Activează Wireless debugging pe Xiaomi și rulează din nou.'
  }
  return $toolchain.DeviceSerial
}

# adb scrie mesaje de progres pe stderr (ex. "1 file pulled"); cu
# $ErrorActionPreference='Stop' acestea devin erori fatale, deci rulăm cu
# preferința locală 'Continue' și păstrăm doar ieșirea standard.
function Invoke-NexusAdb {
  param([string[]]$Arguments)
  $saved = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $result = & $toolchain.Adb @Arguments 2>&1
  } finally {
    $ErrorActionPreference = $saved
  }
  return @($result | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] })
}

function Get-NexusAppInfo {
  param([string]$Serial)
  $raw = & $toolchain.Adb -s $Serial shell dumpsys package $script:NexusDevPackageId 2>$null
  if (-not $raw) { return $null }
  $joined = $raw -join "`n"
  if ($joined -notmatch 'versionName=(\S+)') { return $null }
  $info = @{ VersionName = $Matches[1] }
  if ($joined -match 'lastUpdateTime=([^\r\n]+)') { $info.LastUpdate = $Matches[1].Trim() }
  return $info
}

function Test-NexusMetro {
  param([int]$MetroPort)
  try {
    # Doar prima cerere HTTP dintr-un proces PowerShell nou plătește pornirea
    # stivei .NET (câteva secunde, uneori peste 5); timeout-ul de 10s acoperă
    # acel cost, iar cererile următoare răspund în zeci de milisecunde. Cu un
    # timeout mic, `doctor` raporta „Metro nu răspunde" când de fapt era pornit.
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$MetroPort/status" -UseBasicParsing -TimeoutSec 10
    $content = $response.Content
    # În Windows PowerShell 5.1, fără charset în antet, Content vine ca byte[].
    if ($content -is [byte[]]) { $content = [System.Text.Encoding]::UTF8.GetString($content) }
    return ($content -match 'packager-status:running')
  } catch {
    return $false
  }
}

# Telefonul primește ambele porturi prin adb reverse: Metro (bundle-ul JS al
# shell-ului) și aplicația web locală. Fără al doilea, WebView-ul cere o adresă
# localhost fără server și shell-ul afișează ecranul lui de eroare.
function Invoke-NexusReverse {
  param([string]$Serial, [int]$MetroPort, [int]$WebPort = 5000)
  foreach ($port in @($MetroPort, $WebPort)) {
    & $toolchain.Adb -s $Serial reverse "tcp:$port" "tcp:$port" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "adb reverse a eșuat pentru portul $port." }
  }
  Write-NexusOk "Telefonul vede Metro pe localhost:$MetroPort și aplicația web pe localhost:$WebPort (adb reverse)."
}

# Verificarea folosește /health, nu pagina: un server pornit fără index.html ar
# trece de un simplu 200 pe '/'.
function Test-NexusWebServer {
  param([int]$WebPort)
  try {
    # Același motiv ca la Test-NexusMetro: prima cerere din proces plătește
    # pornirea stivei HTTP, deci timeout-ul trebuie să acopere acel cost.
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$WebPort/health" -UseBasicParsing -TimeoutSec 10
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

# Aplicația web este partea vizibilă a clientului Android, deci bucla o pornește
# automat. `server.js` citește singur apps\nexus-web\.env (deci PORT nu depinde de
# directorul curent), iar -WebPort trebuie să coincidă cu acea valoare.
function Start-NexusWebServer {
  param([int]$WebPort)
  if (Test-NexusWebServer -WebPort $WebPort) {
    Write-NexusOk "Aplicația web rulează deja pe http://localhost:$WebPort."
    return
  }
  $webRoot = Join-Path $script:NexusRepoRoot 'apps\nexus-web'
  if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'server.js'))) {
    throw "Aplicația web lipsește: $webRoot\server.js nu a fost găsit."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'node_modules'))) {
    Write-NexusStep 'Instalez dependențele aplicației web (npm install, o singură dată)...'
    Push-Location $webRoot
    try {
      & (Get-NexusNpmCommand -Name npm) install --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw 'npm install în apps\nexus-web a eșuat.' }
    } finally {
      Pop-Location
    }
  }

  $logDirectory = Join-Path $mobileRoot 'builds'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $webLog = Join-Path $logDirectory 'nexus-web.log'
  Write-NexusStep "Pornesc aplicația web în altă fereastră (port $WebPort); jurnal: $webLog"
  # Procesul rămâne în viață după terminarea scriptului, iar ieșirea lui ajunge în
  # builds\nexus-web.log, ca o pornire eșuată să fie diagnosticabilă.
  $nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue)
  if (-not $nodeExe) { throw 'node.exe nu a fost găsit în PATH. Este nevoie de Node.js.' }
  Start-Process -FilePath $nodeExe.Source -WorkingDirectory $webRoot `
    -ArgumentList @('--max-old-space-size=768', 'server.js') `
    -RedirectStandardOutput $webLog -RedirectStandardError (Join-Path $logDirectory 'nexus-web.err.log') | Out-Null

  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline -and -not (Test-NexusWebServer -WebPort $WebPort)) { Start-Sleep -Seconds 2 }
  if (Test-NexusWebServer -WebPort $WebPort) {
    Write-NexusOk "Aplicația web răspunde pe http://localhost:$WebPort (health verificat)."
  } else {
    Write-NexusFail "Aplicația web nu a răspuns în 90s; verifică $webLog"
  }
}

function Invoke-NexusInstall {
  param([string]$Serial)
  if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "APK-ul lipsește: $apkPath. Rulează întâi 'npm run build:android:dev'."
  }
  Write-NexusStep "Instalez $apkPath peste instalarea existentă (adb install -r)..."
  & $toolchain.Adb -s $Serial install -r $apkPath
  if ($LASTEXITCODE -ne 0) { throw 'Instalarea APK a eșuat.' }
  $app = Get-NexusAppInfo -Serial $Serial
  if ($app) { Write-NexusOk "Aplicația pe telefon: v$($app.VersionName)." }
}

# Metro este singurul proces care trebuie să ruleze continuu pentru Fast Refresh;
# orice modificare TypeScript/JavaScript ajunge pe telefon fără reinstalare.
function Start-NexusMetro {
  param([int]$MetroPort)
  Write-NexusStep "Pornesc Expo/Metro pe portul $MetroPort. Oprire: Ctrl+C."
  & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-metro.ps1') -Port $MetroPort
}

function Start-NexusMirror {
  param([string]$Serial, [switch]$Detached)
  if (-not $toolchain.Scrcpy) {
    throw "scrcpy nu este instalat. Rulează 'npm run dev:setup-scrcpy'."
  }
  # Oglindirea este idempotentă: o a doua fereastră pentru același telefon nu ajută,
  # iar `npm run dev:android` trebuie să se poată rula de mai multe ori la rând.
  $running = @(Get-CimInstance Win32_Process -Filter "Name='scrcpy.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$Serial*" })
  if ($running.Count -gt 0) {
    Write-NexusOk "Oglindirea rulează deja (scrcpy PID $($running[0].ProcessId)); nu deschid a doua fereastră."
    return
  }
  $env:ADB = $toolchain.Adb
  Write-NexusStep "Oglindesc telefonul pe PC (scrcpy $Serial, sunetul rămâne pe telefon). Închide fereastra ca să oprești."
  if ($Detached) {
    # Start-Process concatenează argumentele cu spațiu, deci titlul (care conține un
    # spațiu) trebuie trimis deja între ghilimele; altfel scrcpy îl vede ca argument
    # separat ("ERROR: Unexpected additional argument: Dev") și se închide imediat.
    Start-Process -FilePath $toolchain.Scrcpy -ArgumentList @('-s', $Serial, '--stay-awake', '--no-audio', '--window-title', '"Nexus Dev"') -WindowStyle Normal | Out-Null
    Write-NexusOk 'Fereastra de oglindire a fost deschisă.'
  } else {
    & $toolchain.Scrcpy -s $Serial --stay-awake --no-audio --window-title 'Nexus Dev'
  }
}

function Show-NexusLogs {
  param([string]$Serial)
  $appPid = ((& $toolchain.Adb -s $Serial shell pidof $script:NexusDevPackageId 2>$null) -join '').Trim()
  if (-not $appPid) { throw 'Aplicația Nexus Dev nu rulează pe telefon; deschide-o întâi.' }
  Write-NexusStep "logcat pentru $($script:NexusDevPackageId) (pid $appPid). Oprire: Ctrl+C."
  & $toolchain.Adb -s $Serial logcat --pid=$appPid -v time
}

# scrcpy: unealtă open-source (Apache-2.0), gratuită, folosită doar local pentru
# oglindirea telefonului pe ecranul PC-ului. Nu intră în build-ul aplicației.
function Install-NexusScrcpy {
  $version = '4.1'
  $targetDir = Join-Path $script:NexusRepoRoot 'tools\scrcpy'
  $targetExe = Join-Path $targetDir 'scrcpy.exe'
  if (Test-Path -LiteralPath $targetExe) {
    Write-NexusOk "scrcpy este deja instalat: $targetExe"
    return
  }
  $url = "https://github.com/Genymobile/scrcpy/releases/download/v$version/scrcpy-win64-v$version.zip"
  $zipPath = Join-Path $env:TEMP "scrcpy-win64-v$version.zip"
  $extractDir = Join-Path $env:TEMP "scrcpy-extract-v$version"
  Write-NexusStep "Descarc scrcpy v$version de la GitHub..."
  Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
  if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
  $inner = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
  if (-not $inner) { throw 'Arhiva scrcpy nu are structura așteptată.' }
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $targetDir -Recurse -Force
  Remove-Item -LiteralPath $extractDir -Recurse -Force
  Remove-Item -LiteralPath $zipPath -Force
  if (-not (Test-Path -LiteralPath $targetExe)) { throw 'scrcpy.exe nu a fost găsit după extragere.' }
  Write-NexusOk "scrcpy instalat: $targetExe (adb folosit: $($toolchain.Adb))"
}

function Show-NexusToolchain {
  Write-NexusStep 'Toolchain rezolvat'
  Write-Host "    JDK 17      : $($toolchain.JavaHome)"
  Write-Host "    Android SDK : $($toolchain.AndroidSdk)"
  Write-Host "    adb         : $($toolchain.Adb)"
  Write-Host "    scrcpy      : $($toolchain.Scrcpy)"
  Write-Host "    telefon     : $($toolchain.DeviceSerial)"
  if ($toolchain.Adb) {
    Write-Host ''
    & $toolchain.Adb devices -l
  }
}

function Get-NexusForegroundActivity {
  param([string]$Serial)
  # Numele liniei diferă între versiuni de Android (mResumedActivity pe Android 9,
  # topResumedActivity pe cele noi), deci căutăm ambele și extragem pachetul/activitatea.
  $line = ((Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'activity', 'activities')) | Select-String -Pattern 'ResumedActivity' | Select-Object -First 1)
  if ($line -and "$line" -match '([A-Za-z0-9_\.]+)/([\w\.\$]+)') { return "$($Matches[1])/$($Matches[2])" }
  return ''
}

# Textul real randat de aplicație, citit din arborele de accesibilitate. Nu depinde
# de OCR sau de pixeli, deci rezultatul poate fi comparat direct cu ce scrie în cod.
function Get-NexusUiTexts {
  param([string]$Serial)
  $local = Join-Path $mobileRoot 'builds\ui.xml'
  $dump = ((Invoke-NexusAdb @('-s', $Serial, 'shell', 'uiautomator', 'dump', '/sdcard/nexus-ui.xml')) -join ' ').Trim()
  if ($dump -notmatch 'dumped to') { return $null }
  Invoke-NexusAdb @('-s', $Serial, 'pull', '/sdcard/nexus-ui.xml', $local) | Out-Null
  if (-not (Test-Path -LiteralPath $local)) { return $null }
  # Arborele este UTF-8; citirea explicită păstrează diacriticele românești.
  $xml = [xml][System.IO.File]::ReadAllText($local, [System.Text.Encoding]::UTF8)
  return @($xml.SelectNodes('//*[@text]') | ForEach-Object { $_.text } | Where-Object { $_ })
}

# Dovada că Fast Refresh a ajuns pe ecran: textul afișat chiar acum de aplicație.
function Show-NexusUi {
  param([string]$Serial, [string]$Filter)
  $screenState = Get-NexusScreenState -Serial $Serial
  $foreground = Get-NexusForegroundActivity -Serial $Serial
  if ($foreground -like "$script:NexusDevPackageId/*") {
    Write-NexusOk "Aplicația este în prim-plan ($foreground), ecran $screenState"
  } elseif ($foreground) {
    Write-NexusFail "În prim-plan este $foreground, nu $script:NexusDevPackageId - rulează npm run dev:open."
  } else {
    Write-NexusFail "Nu pot citi activitatea din prim-plan (ecran $screenState)."
  }
  $texts = Get-NexusUiTexts -Serial $Serial
  if (-not $texts) {
    Write-NexusFail 'Arborele de accesibilitate nu a putut fi citit (ecran stins sau aplicația nu este randată).'
    return
  }
  if ($texts -contains 'DEVELOPMENT SERVERS') {
    Write-NexusFail 'Aplicația stă în Expo Dev Launcher, nu este conectată la Metro - rulează npm run dev:open.'
  }
  if ($Filter) { $texts = @($texts | Where-Object { $_ -like "*$Filter*" }) }
  if ($texts.Count -eq 0) { Write-NexusFail "Niciun text vizibil pentru filtrul '$Filter'."; return }
  foreach ($text in $texts) { Write-Host "    $text" }
  Write-NexusOk "Text afișat: $($texts.Count) elemente (arbore brut: builds\ui.xml)"
}

# Clientul de development pornește în launcher-ul Expo (lista de servere) atunci când
# nu are o sesiune activă, iar acolo Fast Refresh nu are unde să ajungă. Deep link-ul
# îl leagă direct la Metro prin adb reverse, fără nicio atingere pe telefon.
function Open-NexusDevClient {
  param([string]$Serial, [int]$MetroPort)
  $url = "nexusdev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$MetroPort"
  $output = ((Invoke-NexusAdb @('-s', $Serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', $url)) -join ' ').Trim()
  if ($output -match 'Starting: Intent') {
    Write-NexusOk "Aplicația a fost conectată la Metro ($url)"
  } else {
    Write-NexusFail "Deep link-ul spre Metro nu a pornit: $output"
  }
}

# Reîncărcarea remontează shell-ul, deci WebView-ul reia clientul web de la zero:
# exact ce trebuie după o editare în apps\nexus-web\public\** (acolo nu există
# Fast Refresh; fișierele statice se citesc la încărcarea paginii).
function Invoke-NexusReload {
  param([string]$Serial, [int]$MetroPort)
  Open-NexusDevClient -Serial $Serial -MetroPort $MetroPort
  Write-NexusStep 'Aștept ca shell-ul și clientul web să se reîncarce...'
  Start-Sleep -Seconds 6
  Show-NexusUi -Serial $Serial
}

# Aduce aplicația în prim-plan fără deep link: `monkey` pornește activitatea de
# launcher, deci nu are nevoie de Metro (spre deosebire de Open-NexusDevClient).
# Contează pentru CDP: cât timp procesul este în fundal, Android îl îngheață, iar
# serverul HTTP al WebView-ului nu mai răspunde (cererea expiră).
function Show-NexusApp {
  param([string]$Serial)
  if ((Get-NexusForegroundActivity -Serial $Serial) -like "$script:NexusDevPackageId/*") { return }
  Write-NexusStep "Aduc aplicația în prim-plan (era în fundal)..."
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'monkey', '-p', $script:NexusDevPackageId, '-c', 'android.intent.category.LAUNCHER', '1') | Out-Null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if ((Get-NexusForegroundActivity -Serial $Serial) -like "$script:NexusDevPackageId/*") { return }
    Start-Sleep -Milliseconds 500
  }
  Write-NexusFail 'Aplicația nu a ajuns în prim-plan; verifică ecranul telefonului.'
}

# Autentificarea în clientul web de pe telefon, fără nicio atingere pe ecran.
# WebView-ul de development expune un socket `webview_devtools_remote_<pid>` (vezi
# webviewDebuggingEnabled={__DEV__} în src/app/index.tsx). Îl redirecționăm local,
# cerem lista de ținte prin HTTP (/json) și conducem DOM-ul din Node prin Chrome
# DevTools Protocol: completăm formularul cu selectori stabili
# (#email-login-form / #nexus-login-email / #nexus-login-password) și îl trimitem,
# exact ca un utilizator. Succesul se verifică pe /api/me (sesiunea prin cookie),
# nu pe aspectul ecranului.
function Invoke-NexusLogin {
  param(
    [string]$Serial,
    [int]$MetroPort,
    [int]$WebPort,
    [string]$Email,
    [string]$Password,
    [int]$CdpPort = 9222
  )

  # Pagina trebuie să fie servită și accesibilă de pe telefon; altfel WebView-ul
  # afișează ecranul lui de eroare și nu există niciun formular de autentificare.
  Start-NexusWebServer -WebPort $WebPort
  Invoke-NexusReverse -Serial $Serial -MetroPort $MetroPort -WebPort $WebPort

  # PID-ul se schimbă la fiecare repornire a aplicației, deci socket-ul se
  # descoperă la rulare, nu se hardcodează.
  $appPid = ((Invoke-NexusAdb @('-s', $Serial, 'shell', 'pidof', $script:NexusDevPackageId)) -join ' ').Trim()
  if (-not $appPid) {
    throw "Aplicația $($script:NexusDevPackageId) nu rulează pe telefon; rulează întâi npm run dev:android."
  }

  # CDP nu funcționează decât cu procesul în prim-plan (vezi Show-NexusApp).
  Show-NexusApp -Serial $Serial

  $unixTable = ((Invoke-NexusAdb @('-s', $Serial, 'shell', 'cat', '/proc/net/unix')) -join "`n")
  $sockets = New-Object System.Collections.Generic.List[string]
  foreach ($processId in ($appPid -split '\s+')) {
    foreach ($match in [regex]::Matches($unixTable, "webview_devtools_remote_$processId\b")) { $sockets.Add($match.Value) }
  }
  if ($sockets.Count -eq 0) {
    # react-native-webview poate rula WebView-ul într-un proces renderer separat,
    # deci numele socket-ului nu conține neapărat PID-ul aplicației.
    foreach ($match in [regex]::Matches($unixTable, 'webview_devtools_remote_\d+')) { $sockets.Add($match.Value) }
  }
  $sockets = @($sockets | Select-Object -Unique)
  if ($sockets.Count -eq 0) {
    throw 'WebView-ul nu expune debugging (webview_devtools_remote_*); clientul instalat este build-ul de development (__DEV__)?'
  }

  # Un port local poate ține o singură redirecționare, deci curățăm înainte.
  Invoke-NexusAdb @('-s', $Serial, 'forward', '--remove', "tcp:$CdpPort") | Out-Null

  try {
    $webSocketUrl = $null
    $chosenSocket = $null
    $devtoolsAnswered = $false
    foreach ($socket in $sockets) {
      Invoke-NexusAdb @('-s', $Serial, 'forward', "tcp:$CdpPort", "localabstract:$socket") | Out-Null
      $content = $null
      # După ce aplicația revine în prim-plan, procesul are nevoie de o clipă până
      # când serverul DevTools al WebView-ului acceptă din nou cereri.
      for ($attempt = 1; $attempt -le 5 -and -not $content; $attempt++) {
        try {
          # Prima cerere HTTP din proces plătește pornirea stivei .NET, deci
          # timeout-ul trebuie să acopere acel cost (vezi Test-NexusMetro).
          $response = Invoke-WebRequest -Uri "http://127.0.0.1:$CdpPort/json" -UseBasicParsing -TimeoutSec 10
          $content = $response.Content
        } catch {
          Start-Sleep -Seconds 1
        }
      }
      if (-not $content) { continue }
      $devtoolsAnswered = $true
      # În Windows PowerShell 5.1, fără charset în antet, Content vine ca byte[].
      if ($content -is [byte[]]) { $content = [System.Text.Encoding]::UTF8.GetString($content) }
      $targets = @($content | ConvertFrom-Json)
      # Ținta de tip 'page' cu URL-ul aplicației web este chiar clientul Nexus.
      $page = @($targets | Where-Object { $_.type -eq 'page' -and "$($_.url)" -like "http://localhost:$WebPort*" } | Select-Object -First 1)
      if ($page.Count -gt 0) {
        $webSocketUrl = $page[0].webSocketDebuggerUrl
        $chosenSocket = $socket
        break
      }
    }

    if (-not $webSocketUrl) {
      if (-not $devtoolsAnswered) {
        throw 'WebView-ul nu răspunde pe CDP; ține telefonul treaz și în prim-plan, apoi încearcă din nou.'
      }
      throw "WebView-ul nu are o pagină deschisă pe http://localhost:$WebPort; rulează npm run dev:reload."
    }

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'node.exe nu a fost găsit în PATH. Este nevoie de Node.js.' }
    $driver = Join-Path $PSScriptRoot 'login-webview.mjs'
    if (-not (Test-Path -LiteralPath $driver)) { throw "Driverul CDP lipsește: $driver." }

    Write-NexusStep "Autentificare în WebView ($chosenSocket) ca $Email..."
    & $node.Source $driver $webSocketUrl $Email $Password
    if ($LASTEXITCODE -ne 0) { throw "Autentificarea a eșuat (cod $LASTEXITCODE)." }
    Write-NexusOk 'Sesiunea din WebView este activă; poți folosi aplicația de pe telefon.'
  } finally {
    # Redirecționarea este doar pentru durata comenzii; nu lăsăm un port ocupat.
    Invoke-NexusAdb @('-s', $Serial, 'forward', '--remove', "tcp:$CdpPort") | Out-Null
  }
}

# Verificare completă, fără efecte secundare: spune exact unde se rupe bucla.
function Invoke-NexusDoctor {
  $failures = 0

  Write-Host ''
  Write-NexusStep '1. Toolchain local'
  if ($toolchain.JavaHome) { Write-NexusOk "JDK 17: $($toolchain.JavaHome)" } else { Write-NexusFail 'JDK 17+ negăsit'; $failures++ }
  if ($toolchain.AndroidSdk) { Write-NexusOk "Android SDK: $($toolchain.AndroidSdk)" } else { Write-NexusFail 'Android SDK negăsit'; $failures++ }
  if ($toolchain.Adb) { Write-NexusOk "adb: $($toolchain.Adb)" } else { Write-NexusFail 'adb negăsit'; $failures++ }
  if ($toolchain.Scrcpy) { Write-NexusOk "scrcpy: $($toolchain.Scrcpy)" } else { Write-NexusFail 'scrcpy negăsit - rulează npm run dev:setup-scrcpy' }

  Write-Host ''
  Write-NexusStep '2. Telefon'
  if ($toolchain.Adb) {
    $serials = @(Get-NexusDeviceSerials -Adb $toolchain.Adb)
    if ($serials.Count -gt 0) { Write-NexusOk "Conectate: $($serials -join ', ')" } else { Write-NexusFail 'Niciun telefon autorizat prin ADB'; $failures++ }
    if ($toolchain.DeviceSerial) {
      Write-NexusOk "Selectat: $($toolchain.DeviceSerial)"
      $model = ((& $toolchain.Adb -s $toolchain.DeviceSerial shell getprop ro.product.model 2>$null) -join '').Trim()
      $release = ((& $toolchain.Adb -s $toolchain.DeviceSerial shell getprop ro.build.version.release 2>$null) -join '').Trim()
      Write-Host "    model: $model / Android $release"
      $app = Get-NexusAppInfo -Serial $toolchain.DeviceSerial
      if ($app) {
        Write-NexusOk "Client dev instalat: v$($app.VersionName) (actualizat $($app.LastUpdate))"
      } else {
        Write-NexusFail 'Clientul de development nu este instalat pe telefon'; $failures++
      }
      $reverses = @(& $toolchain.Adb -s $toolchain.DeviceSerial reverse --list 2>$null)
      $reverseText = ($reverses -join ' | ')
      # Ambele porturi sunt obligatorii: Metro livrează shell-ul, portul web
      # livrează chiar aplicația Nexus pe care o încarcă WebView-ul.
      $missingReverse = @(@($Port, $WebPort) | Where-Object { $reverseText -notmatch ("tcp:" + $_) })
      if ($missingReverse.Count -eq 0) {
        Write-NexusOk "adb reverse: $reverseText"
      } else {
        Write-NexusFail "Lipsește adb reverse pentru porturile $($missingReverse -join ', ') - rulează npm run dev:reverse"
      }
      # Xiaomi adoarme ecranul în 30 de secunde; când telefonul doarme, HMR se
      # aplică abia la trezire, ceea ce se vede ca "Fast Refresh lent".
      $screenState = Get-NexusScreenState -Serial $toolchain.DeviceSerial
      if ($screenState -match 'ON') {
        Write-NexusOk "Ecran treaz ($screenState): actualizările se aplică imediat"
      } else {
        Write-NexusFail "Ecran stins ($screenState): rulează npm run dev:wake sau ține telefonul la încărcător"
      }
    }
  } else {
    Write-NexusFail 'adb lipsește, nu pot verifica telefonul'; $failures++
  }

  Write-Host ''
  Write-NexusStep '3. Dev server'
  if (Test-NexusMetro -MetroPort $Port) {
    Write-NexusOk "Metro rulează pe http://127.0.0.1:$Port (Fast Refresh activ)"
    $metroLog = Join-Path $mobileRoot 'builds\metro.log'
    if (Test-Path -LiteralPath $metroLog) {
      # Metro nu jurnalizează fiecare actualizare livrată prin websocket la Fast
      # Refresh, deci jurnalul arată doar bundle-urile complete. Dovada că o
      # modificare a ajuns pe ecran se ia cu `npm run dev:ui`.
      $lastBundle = Select-String -LiteralPath $metroLog -Pattern 'Android Bundled' -ErrorAction SilentlyContinue | Select-Object -Last 1
      if ($lastBundle) { Write-Host "    ultimul bundle: $($lastBundle.Line.Trim())" }
      $lastError = Select-String -LiteralPath $metroLog -Pattern 'Unable to resolve|SyntaxError|error:' -ErrorAction SilentlyContinue | Select-Object -Last 1
      if ($lastError) { Write-Host "    ultima eroare din jurnal: $($lastError.Line.Trim())" }
    }
    Write-Host '    dovada HMR: npm run dev:ui (textul real afișat de aplicație)'
  } else {
    Write-NexusFail "Metro nu răspunde pe portul $Port - rulează npm run dev:android"; $failures++
  }

  # Aplicația web locală este conținutul vizibil al shell-ului; dacă lipsește,
  # telefonul arată doar ecranul de eroare al WebView-ului.
  if (Test-NexusWebServer -WebPort $WebPort) {
    Write-NexusOk "Aplicația web răspunde pe http://127.0.0.1:$WebPort (WebView-ul o încarcă de pe localhost:$WebPort)"
  } else {
    Write-NexusFail "Aplicația web nu răspunde pe portul $WebPort - rulează npm run dev:web"; $failures++
  }

  if ($toolchain.DeviceSerial -and $screenState -match 'ON') {
    $texts = Get-NexusUiTexts -Serial $toolchain.DeviceSerial
    if (-not $texts) {
      Write-NexusFail 'Ecranul aplicației nu a putut fi citit (arbore de accesibilitate indisponibil)'
    } elseif ($texts -contains 'DEVELOPMENT SERVERS') {
      Write-NexusFail 'Aplicația stă în Expo Dev Launcher, fără sesiune Metro - rulează npm run dev:open'; $failures++
    } elseif ($texts -contains 'Aplicația web nu este pornită') {
      Write-NexusFail 'Shell-ul afișează eroarea de încărcare a clientului web - rulează npm run dev:web, apoi npm run dev:reverse'; $failures++
    } else {
      Write-NexusOk "Shell-ul randează acum: $(@($texts | Where-Object { $_ -like 'Dev *' }) -join ' | ')"
      # Textul care nu vine din shell este dovada că WebView-ul a încărcat chiar
      # clientul Nexus, nu doar bara nativă de deasupra lui.
      $webTexts = @($texts | Where-Object { $_ -notlike 'Dev *' -and $_ -ne 'NEXUS' -and $_ -ne 'Cameră' -and $_ -ne 'Reîncarcă' } | Select-Object -First 4)
      if ($webTexts.Count -gt 0) { Write-Host "    text din aplicația web: $($webTexts -join ' | ')" }
    }
  }

  if (-not $SkipChecks) {
    Write-Host ''
    Write-NexusStep '4. Verificări statice'
    $npm = Get-NexusNpmCommand -Name 'npm'
    Push-Location $mobileRoot
    try {
      & $npm run typecheck
      if ($LASTEXITCODE -ne 0) { Write-NexusFail 'typecheck a eșuat'; $failures++ } else { Write-NexusOk 'typecheck' }
      & $npm run lint
      if ($LASTEXITCODE -ne 0) { Write-NexusFail 'lint a eșuat'; $failures++ } else { Write-NexusOk 'lint' }
    } finally {
      Pop-Location
    }
  }

  Write-Host ''
  if ($failures -eq 0) {
    Write-NexusOk 'Bucla de dezvoltare este completă.'
  } else {
    Write-NexusFail "$failures verificări au eșuat."
    exit 1
  }
}

# Bucla cerută: aplicația web + Metro în alte ferestre, telefonul oglindit pe PC,
# nicio reinstalare.
function Invoke-NexusDev {
  param([string]$Serial, [int]$MetroPort, [int]$WebPort = 5000, [switch]$WithoutMirror)

  Enable-NexusDeviceAwake -Serial $Serial

  # Aplicația web este conținutul shell-ului, deci se pornește înainte de deep
  # link: altfel telefonul ar rămâne pe ecranul de eroare al WebView-ului.
  Start-NexusWebServer -WebPort $WebPort

  if (Test-NexusMetro -MetroPort $MetroPort) {
    Write-NexusOk "Metro rulează deja pe portul $MetroPort."
  } else {
    $metroLog = Join-Path $mobileRoot 'builds\metro.log'
    New-Item -ItemType Directory -Path (Split-Path -Parent $metroLog) -Force | Out-Null
    Write-NexusStep "Pornesc Metro într-o fereastră nouă (port $MetroPort)..."
    # Jurnalul cu marcă de timp face bucla verificabilă: fiecare recompilare HMR
    # apare în builds\metro.log cu ora la care a fost livrată către telefon.
    $metroArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', (Join-Path $PSScriptRoot 'run-metro.ps1'), '-Port', $MetroPort)
    Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $metroArgs | Out-Null
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline -and -not (Test-NexusMetro -MetroPort $MetroPort)) { Start-Sleep -Seconds 3 }
    if (Test-NexusMetro -MetroPort $MetroPort) {
      Write-NexusOk "Metro e pornit pe portul $MetroPort. Jurnal: $metroLog"
    } else {
      Write-NexusFail "Metro nu a răspuns în 120s; verifică fereastra nouă deschisă."
    }
  }

  Invoke-NexusReverse -Serial $Serial -MetroPort $MetroPort -WebPort $WebPort

  # Fără acest pas clientul rămâne în launcher-ul Expo, de unde HMR nu ajunge niciodată
  # pe ecran (simptomul de "Fast Refresh nu merge").
  Open-NexusDevClient -Serial $Serial -MetroPort $MetroPort
  Write-NexusStep 'Aștept ca bundle-ul să fie livrat de Metro...'
  # Deep link-ul reîncarcă aplicația, deci primele secunde pot arăta ecran gol sau
  # launcher-ul; așteptăm până apare text randat de aplicație, apoi îl afișăm.
  $rendered = $null
  for ($attempt = 1; $attempt -le 5 -and -not $rendered; $attempt++) {
    Start-Sleep -Seconds 4
    $rendered = Get-NexusUiTexts -Serial $Serial
    if ($rendered -and ($rendered -contains 'DEVELOPMENT SERVERS')) { $rendered = $null }
  }
  if ($rendered) {
    Write-NexusOk "Shell-ul randează acum: $(@($rendered | Where-Object { $_ -like 'Dev *' }) -join ' | ')"
    $webTexts = @($rendered | Where-Object { $_ -notlike 'Dev *' -and $_ -ne 'NEXUS' -and $_ -ne 'Cameră' -and $_ -ne 'Reîncarcă' } | Select-Object -First 4)
    if ($webTexts.Count -gt 0) { Write-Host "    text din aplicația web: $($webTexts -join ' | ')" }
  } else {
    Write-NexusFail 'Aplicația nu a randat încă pe ecran; verifică cu npm run dev:ui.'
  }

  if ($WithoutMirror) {
    Write-NexusOk 'Gata: editează apps/nexus-web/public/** și rulează npm run dev:reload, sau editează src/** (Fast Refresh). Dovada: npm run dev:ui.'
  } else {
    # Detached: bucla se termină, iar fereastra de oglindire rămâne deschisă.
    Start-NexusMirror -Serial $Serial -Detached
  }
}

# Xiaomi doarme foarte repede (timeout de ecran 30 s, pe care MIUI nu îl lasă
# modificat prin ADB): cu ecranul stins intră în Doze, iar React Native nu mai
# primește actualizările HMR până la trezire. O sesiune de dezvoltare are nevoie de
# un telefon treaz, altfel "Fast Refresh lent" este de fapt telefonul adormit.
# `svc power stayon true` nu are efect dacă telefonul nu crede că e la priză, deci
# simulăm alimentarea pentru durata sesiunii. Revertire: `npm run dev:restore`
# (dumpsys battery reset + svc power stayon false + dumpsys deviceidle enable) sau
# pur și simplu repornirea telefonului.
function Get-NexusScreenState {
  param([string]$Serial)
  $raw = (((& $toolchain.Adb -s $Serial shell dumpsys display 2>$null) | Select-String -Pattern 'mScreenState=' | Select-Object -First 1) -join '').Trim()
  if ($raw -match 'mScreenState=(\w+)') { return $Matches[1] }
  return 'UNKNOWN'
}

function Enable-NexusDeviceAwake {
  param([string]$Serial)
  # MIUI blochează injectarea de taste prin ADB (INJECT_EVENTS), deci nu folosim
  # `input keyevent KEYCODE_WAKEUP`; apăsăm butonul de alimentare doar dacă ecranul
  # este chiar stins, ca să nu stingem telefonul din greșeală.
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'battery', 'set', 'ac', '1') | Out-Null
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'battery', 'set', 'status', '2') | Out-Null
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'deviceidle', 'disable') | Out-Null
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'svc', 'power', 'stayon', 'true') | Out-Null
  $screenState = Get-NexusScreenState -Serial $Serial
  if ($screenState -match 'OFF') {
    Invoke-NexusAdb @('-s', $Serial, 'shell', 'input', 'keyevent', '26') | Out-Null
    Start-Sleep -Seconds 2
    $screenState = Get-NexusScreenState -Serial $Serial
  }
  if ($screenState -match 'ON') {
    Write-NexusOk "Telefon treaz (ecran $screenState), alimentare simulată și Doze dezactivat pentru sesiune."
  } else {
    Write-NexusFail "Ecranul este stins ($screenState): apasă o dată butonul de pornire al telefonului; alimentarea simulată și Doze sunt deja active."
  }
}

# Dă telefonul înapoi utilizatorului: fără alimentare simulată, fără stay-on, cu Doze activ.
function Disable-NexusDeviceAwake {
  param([string]$Serial)
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'battery', 'reset') | Out-Null
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'svc', 'power', 'stayon', 'false') | Out-Null
  Invoke-NexusAdb @('-s', $Serial, 'shell', 'dumpsys', 'deviceidle', 'enable') | Out-Null
  Write-NexusOk 'Telefon lăsat în starea normală: alimentare reală, screen timeout propriu, Doze activ.'
}

switch ($Action) {
  'wake' { Enable-NexusDeviceAwake -Serial (Assert-NexusToolchain) }
  'restore' { Disable-NexusDeviceAwake -Serial (Assert-NexusToolchain) }
  'tools' { Show-NexusToolchain }
  'device' {
    $serial = Assert-NexusToolchain
    Write-NexusOk "Telefon selectat: $serial"
    & $toolchain.Adb -s $serial shell getprop ro.product.model
    & $toolchain.Adb -s $serial shell getprop ro.build.version.release
    & $toolchain.Adb -s $serial shell wm size
    & $toolchain.Adb -s $serial shell wm density
  }
  'web' { Start-NexusWebServer -WebPort $WebPort }
  'reverse' { Invoke-NexusReverse -Serial (Assert-NexusToolchain) -MetroPort $Port -WebPort $WebPort }
  'open' { Open-NexusDevClient -Serial (Assert-NexusToolchain) -MetroPort $Port }
  'reload' { Invoke-NexusReload -Serial (Assert-NexusToolchain) -MetroPort $Port }
  'install' { Invoke-NexusInstall -Serial (Assert-NexusToolchain) }
  'metro' { Start-NexusMetro -MetroPort $Port }
  'mirror' { Start-NexusMirror -Serial (Assert-NexusToolchain) }
  'logs' { Show-NexusLogs -Serial (Assert-NexusToolchain) }
  'ui' { Show-NexusUi -Serial (Assert-NexusToolchain) }
  'setup-scrcpy' { Install-NexusScrcpy }
  'login' {
    $serial = Assert-NexusToolchain
    Invoke-NexusLogin -Serial $serial -MetroPort $Port -WebPort $WebPort -Email $Email -Password $Password -CdpPort $CdpPort
  }
  'dev' {
    $serial = Assert-NexusToolchain
    Invoke-NexusDev -Serial $serial -MetroPort $Port -WebPort $WebPort -WithoutMirror:$NoMirror
  }
  'doctor' { Invoke-NexusDoctor }
}
