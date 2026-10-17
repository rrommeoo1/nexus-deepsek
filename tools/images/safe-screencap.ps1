<#
.SYNOPSIS
  Captură de ecran pe telefon fără redirectare în PowerShell, validată, apoi convertită în docs/vision/.

.DESCRIPTION
  Metoda veche (`adb ... > fisier.png`) a produs PNG-uri corupte: pe Windows, redirectarea
  strecoară text în fluxul binar și strică antetul. Fișierul rezultat nu se poate deschide nici
  în Windows, nici ca imagine în conversație. Scriptul de față face exact invers:

    1. alege un singur transport ADB (`adb -s <serial>`) — telefonul poate apărea de două ori
       (mDNS și IP), iar fără `-s` adb poate alege altă intrare între comenzi;
    2. confirmă id-ul SurfaceFlinger al display-ului principal cu
       `dumpsys SurfaceFlinger --display-id` (cover-ul are alt id; `-d 0` nu este valid);
    3. verifică focusul: se lucrează numai dacă `app.nexus.mobile.dev` este în prim-plan;
    4. scrie captura PE TELEFON (`screencap -d <id> -p /sdcard/...`), o trage cu `adb pull`
       (fără `>`), o validează (antet + dimensiune + decodare completă) și abia apoi o
       convertește în `docs/vision/<nume>.jpg`, de maximum 900 px lățime;
    5. dacă fișierul tras este invalid, îl șterge (local și de pe telefon) și raportează — nu îl
       folosește și nu îl lasă în docs/.

  Nu atinge setările telefonului, nu trimite input (tap/text/Home/Back) și nu deschide altă
  aplicație. `screencap` este o citire.

.EXAMPLE
  powershell -NoProfile -File tools/images/safe-screencap.ps1 -Name profile-header-own
  powershell -NoProfile -File tools/images/safe-screencap.ps1 -Name feed -Device adb-b42122b-huYC9y._adb-tls-connect._tcp
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Device = '',
  # Id-ul SurfaceFlinger al ecranului principal (NU numărul logic 0).
  [string]$Display = '4630946949513469331',
  [string]$Package = 'app.nexus.mobile.dev',
  [string]$Out = 'docs/vision',
  [int]$MaxWidth = 900,
  [int]$Quality = 82,
  # Doar pentru diagnostic: sare peste verificarea focusului (nu se folosește în sesiuni normale).
  [switch]$SkipFocusCheck
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'ImageTools.ps1')
$adb = Join-Path $root 'tools\scrcpy\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { throw "adb lipsește în repo: $adb" }

# Nume plat: „profile header” și „profile/header” ajung amândouă „profile-header.jpg”.
$slug = ($Name.Trim() -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
$slug = [System.IO.Path]::GetFileNameWithoutExtension($slug)
if (-not $slug) { throw 'numele capturii este gol după curățare' }

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  # Windows PowerShell 5.1 ridică `NativeCommandError` când o comandă nativă scrie pe stderr cu
  # `$ErrorActionPreference = 'Stop'`, iar adb își tipărește acolo progresul: ieșirea se citește cu
  # preferința oprită o clipă, apoi se judecă după codul de ieșire, nu după textul de pe stderr.
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $output = & $adb -s $script:serial @Arguments 2>&1 } finally { $ErrorActionPreference = $savedPreference }
  if ($LASTEXITCODE -ne 0) { throw (("adb a eșuat ({0}): {1}" -f $LASTEXITCODE, (($output | ForEach-Object { $_.ToString() }) -join ' '))) }
  return $output
}

# 1. Un singur transport. Telefonul poate apărea de două ori (mDNS + IP); folosim mereu `-s`.
$script:serial = $Device
$authorized = @((& $adb devices) -split "`r?`n" | Where-Object { $_ -match "`tdevice$" } | ForEach-Object { ($_ -split "`t")[0].Trim() })
if (-not $script:serial) {
  if ($authorized.Count -eq 0) {
    $hint = (& $adb mdns services 2>&1) -join "`n"
    throw "niciun dispozitiv autorizat. Pornește Wireless debugging și verifică 'adb devices'.`nmDNS: $hint"
  }
  $script:serial = $authorized[0]
  if ($authorized.Count -gt 1) {
    Write-Host ("[screencap] ATENȚIE: adb vede {0} intrări ({1}); folosesc prima cu -s. Dacă e alt telefon, dă -Device." -f $authorized.Count, ($authorized -join ', '))
  }
} elseif ($authorized -notcontains $script:serial) {
  throw "serialul cerut nu este autorizat: $script:serial (adb vede: $($authorized -join ', '))"
}
Write-Host "[screencap] device = $script:serial"

# 2. Display-ul principal, confirmat din SurfaceFlinger. Cover-ul are alt id, iar `-d 0` nu e valid.
$displayList = @(Invoke-Adb -Arguments @('shell', 'dumpsys', 'SurfaceFlinger', '--display-id') | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
$known = @($displayList | Select-String -Pattern ([regex]::Escape($Display)) -Quiet)
if (-not $known) {
  throw ("display-ul {0} nu apare în 'dumpsys SurfaceFlinger --display-id'. Linii primite:{1}{2}" -f $Display, [Environment]::NewLine, ($displayList -join [Environment]::NewLine))
}
Write-Host "[screencap] display = $Display (confirmat în SurfaceFlinger)"

# 3. Focus: nicio captură dintr-o altă aplicație.
$focusLines = @(Invoke-Adb -Arguments @('shell', 'dumpsys', 'window') | Select-String -Pattern 'mCurrentFocus' | ForEach-Object { $_.ToString().Trim() })
$focus = @($focusLines | Where-Object { $_ -match [regex]::Escape($Package) }) | Select-Object -First 1
if (-not $focus) { $focus = $focusLines | Select-Object -Last 1 }
Write-Host "[screencap] focus = $focus"
if (-not $SkipFocusCheck -and ($focus -notmatch [regex]::Escape($Package))) {
  throw "focusul nu este $Package; captura ar aparține altei ferestre. Se anulează (nimic nu s-a scris)."
}

# 4. Captura se scrie pe telefon, apoi se trage cu `adb pull`. Fără `>`: acesta e pasul care a
#    produs PNG-urile corupte în trecut.
$remote = "/sdcard/nexus-vision-$slug.png"
$tempFolder = Join-Path $env:TEMP 'nexus-vision'
New-Item -ItemType Directory -Force -Path $tempFolder | Out-Null
$local = Join-Path $tempFolder ("$slug-{0}.png" -f [guid]::NewGuid().ToString('N').Substring(0, 8))

$ok = $false
try {
  Invoke-Adb -Arguments @('shell', 'screencap', '-d', $Display, '-p', $remote) | Out-Null
  # `adb pull` își tipărește progresul pe stderr: aceeași grijă ca în `Invoke-Adb` (PS 5.1 + Stop).
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $pulled = & $adb -s $script:serial pull $remote $local 2>&1 } finally { $ErrorActionPreference = $savedPreference }
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $local)) {
    throw ("adb pull a eșuat: {0}" -f (($pulled | ForEach-Object { $_.ToString() }) -join ' '))
  }

  $check = Test-ImageFile -Path $local
  if (-not $check.Ok) {
    # Regula: fișierul invalid se șterge și se raportează, nu se folosește.
    Remove-Item -LiteralPath $local -Force -ErrorAction SilentlyContinue
    & $adb -s $script:serial shell rm -f $remote | Out-Null
    throw ("captura este INVALIDĂ ({0}) și a fost ștearsă. Nu se folosește nicio imagine nevalidată." -f $check.Why)
  }
  Write-Host ("[screencap] captură brută validă: {0}x{1}, {2:N0} octeți" -f $check.Width, $check.Height, $check.Size)

  # 5. Doar JPEG-ul de 900 px are voie în docs/vision/.
  $visionDir = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }
  $destination = Join-Path $visionDir ($slug + '.jpg')
  $saved = Save-VisionJpeg -Path $local -Destination $destination -MaxWidth $MaxWidth -Quality $Quality
  $proof = Test-ImageFile -Path $destination
  if (-not $proof.Ok) {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
    throw ("JPEG-ul scris este invalid ({0}); a fost șters." -f $proof.Why)
  }

  $size = (Get-Item -LiteralPath $destination).Length
  Write-Host ("[screencap] scris: {0} ({1}x{2}, {3:N0} octeți)" -f $destination, $saved.Width, $saved.Height, $size)
  Write-Host '[screencap] aceasta este singura formă în care imaginea poate fi citită în conversație.'
  $ok = $true
} finally {
  if (Test-Path -LiteralPath $local) { Remove-Item -LiteralPath $local -Force -ErrorAction SilentlyContinue }
  & $adb -s $script:serial shell rm -f $remote 2>&1 | Out-Null
}
if (-not $ok) { exit 1 }
exit 0
