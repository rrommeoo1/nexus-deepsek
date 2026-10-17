<#
.SYNOPSIS
  Un singur pas pentru ciclul de dezvoltare: Metro + telefon + Nexus Dev in prim-plan.

.DESCRIPTION
  Regula proiectului (docs/DEV-WORKFLOW.md): aplicatia se dezvolta pe telefon prin
  Metro si Fast Refresh, fara build de release. Scriptul face exact atat:

    1. verifica adb si telefonul conectat (Wireless debugging sau cablu);
    2. porneste Metro pe portul 8081, daca nu asculta deja;
    3. face adb reverse DOAR pentru 8081 (API-ul ramane pe Railway, niciodata prin reverse);
    4. aduce Nexus Dev in prim-plan cu `am start -n app.nexus.mobile.dev/.MainActivity`;
    5. ii da adresa Metro a acestui PC din LAN, ca sa nu fie tastata in launcher.

  Nu atinge setari ale telefonului: fara Home, fara Back, fara cortina de notificari,
  fara `svc power`, fara Doze, fara dezinstalare (deci drafturile locale raman).

.PARAMETER MetroPort
  Portul Metro; implicit 8081, singurul care primeste adb reverse.

.PARAMETER Device
  Serialul ADB preferat. Implicit se alege transportul IP:port.

.PARAMETER NoMetro
  Nu porneste Metro (il foloseste pe cel care ruleaza deja).

.PARAMETER Localhost
  Trimite telefonului `http://localhost:<port>` prin adb reverse, in loc de adresa LAN.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/dev-start.ps1
#>
[CmdletBinding()]
param(
  [int]$MetroPort = 8081,
  [string]$Device,
  [switch]$NoMetro,
  [switch]$Localhost
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mobileRoot = Join-Path $repoRoot 'apps\nexus-mobile'
. (Join-Path $mobileRoot 'scripts\nexus-env.ps1')

function Write-Step { param([string]$Text) Write-Host "[dev] $Text" -ForegroundColor Cyan }
function Write-Ok { param([string]$Text) Write-Host "[dev] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "[dev] $Text" -ForegroundColor Yellow }

# adb scrie avertismente normale pe stderr („Activity not started...”), iar PowerShell 5.1
# transforma orice linie de stderr intr-un NativeCommandError cand ErrorActionPreference este
# Stop. Citim deci iesirea cu preferinta coborata si judecam dupa text, nu dupa stream.
function Invoke-DeviceAdb {
  param([string]$Serial, [string[]]$Arguments)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { return @(& $script:AdbPath -s $Serial @Arguments 2>&1 | ForEach-Object { "$_" }) }
  finally { $ErrorActionPreference = $previous }
}

$toolchain = Import-NexusToolchain -Device $Device
if (-not $toolchain.Adb) { throw 'adb nu a fost gasit. Instaleaza Android platform-tools sau seteaza ANDROID_HOME.' }
$serial = $toolchain.DeviceSerial
if (-not $serial) {
  throw 'Niciun telefon conectat. Porneste Wireless debugging (adb pair / adb connect) sau conecteaza cablul, apoi ruleaza din nou.'
}
Write-Ok "Telefon: $serial"
$script:AdbPath = $toolchain.Adb

function Test-MetroPort {
  param([int]$Port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(400)) { $client.Close(); return $false }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch { return $false }
}

if (-not (Test-MetroPort -Port $MetroPort)) {
  if ($NoMetro) { throw "Metro nu asculta pe portul $MetroPort si -NoMetro a fost cerut." }
  Write-Step "Pornesc Metro pe portul $MetroPort (fereastra noua)..."
  Start-Process -FilePath 'powershell.exe' -WorkingDirectory $mobileRoot -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $mobileRoot 'scripts\run-metro.ps1'), '-Port', "$MetroPort"
  ) | Out-Null
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline -and -not (Test-MetroPort -Port $MetroPort)) { Start-Sleep -Milliseconds 750 }
  if (-not (Test-MetroPort -Port $MetroPort)) {
    throw "Metro nu a pornit in 120s. Ruleaza manual: npm run dev:metro (jurnal: apps\nexus-mobile\builds\metro.log)."
  }
}

# adb reverse: numai Metro. API-ul are origine proprie (Railway sau EXPO_PUBLIC_NEXUS_API_URL)
# si nu trebuie sa treaca niciodata prin telefon -> PC.
$reverse = Invoke-DeviceAdb -Serial $serial -Arguments @('reverse', "tcp:$MetroPort", "tcp:$MetroPort")
if ($reverse -match 'cannot|error|not found') { Write-Warn 'adb reverse a esuat; Metro va fi citit prin LAN.' } else { Write-Ok "adb reverse tcp:$MetroPort -> tcp:$MetroPort" }

function Get-LanAddress {
  try {
    $candidates = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.AddressState -eq 'Preferred' } |
      Select-Object -ExpandProperty IPAddress)
  } catch { $candidates = @() }
  foreach ($pattern in @('^192\.168\.', '^10\.', '^172\.(1[6-9]|2\d|3[01])\.')) {
    $match = @($candidates | Where-Object { $_ -match $pattern } | Select-Object -First 1)
    if ($match.Count -gt 0) { return $match[0] }
  }
  return $null
}

$apiOrigin = $env:EXPO_PUBLIC_NEXUS_API_URL
if (-not $apiOrigin) { $apiOrigin = 'https://nexus-deepsek-production.up.railway.app' }
$apiLabel = 'API: Railway'
if ($apiOrigin -match 'localhost|127\.0\.0\.1|^http://(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') { $apiLabel = 'API: local' }

$lan = $null
if (-not $Localhost) { $lan = Get-LanAddress }
$metroUrl = "http://localhost:$MetroPort"
if ($lan) { $metroUrl = "http://${lan}:$MetroPort" }

# 1. In prim-plan, activitatea de launcher (fara Home, fara Back, fara cortina).
$started = (Invoke-DeviceAdb -Serial $serial -Arguments @('shell', 'am', 'start', '-n', "$($script:NexusDevPackageId)/.MainActivity")) -join ' '
if ($started -match 'Error|Exception') { Write-Warn "am start: $started" } else { Write-Ok 'Nexus Dev este in prim-plan' }
Start-Sleep -Milliseconds 900

# 2. Adresa Metro a acestui PC, prin deep link-ul dev clientului: exact ce s-ar fi tastat in launcher.
$encoded = [System.Uri]::EscapeDataString($metroUrl)
$deepLink = "nexusdev://expo-development-client/?url=$encoded"
$opened = (Invoke-DeviceAdb -Serial $serial -Arguments @('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', $deepLink)) -join ' '
if ($opened -match 'Error|Exception') { Write-Warn "Deep link-ul Metro a esuat: $opened" } else { Write-Ok "Conectat la Metro: $metroUrl" }

if (-not $lan) { Write-Warn 'Nu am gasit o adresa LAN; folosesc localhost prin adb reverse.' }

Write-Host ''
Write-Ok "Gata. Telefon $serial, Metro $metroUrl, $apiLabel"
Write-Host '[dev] Edita src/ -> Fast Refresh. APK nou doar cand se schimba ceva nativ (docs/DEV-WORKFLOW.md).' -ForegroundColor DarkGray

Write-Ok "Metro asculta pe portul $MetroPort"
