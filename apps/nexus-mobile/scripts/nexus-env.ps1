# Rezolvarea deterministă a toolchain-ului pentru bucla de dezvoltare Android.
#
# Se încarcă prin dot-sourcing:  . "$PSScriptRoot\nexus-env.ps1"
# Nu modifică starea mașinii (fără descărcări, fără instalări); doar rezolvă căi
# și, când i se cere, exportă variabilele de proces pentru Gradle/Expo.
#
# Motiv: variabila de utilizator `ANDROID_HOME` poate indica o cale care există
# doar în containerul aplicației împachetate (MSIX redirecționează %LOCALAPPDATA%
# în LocalCache). Dintr-un shell obișnuit acea cale nu există, deși SDK-ul real
# este prezent. De aceea căutăm explicit mai mulți candidați.

$script:NexusMobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:NexusRepoRoot = (Resolve-Path (Join-Path $script:NexusMobileRoot '..\..')).Path

function Test-NexusAndroidSdkPath {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $false }
  return (Test-Path -LiteralPath (Join-Path $Path 'platform-tools\adb.exe'))
}

function Test-NexusJavaHomePath {
  param([string]$Path)
  if (-not $Path) { return $false }
  return (Test-Path -LiteralPath (Join-Path $Path 'bin\java.exe'))
}

# Caută Android SDK-ul: întâi variabilele de mediu, apoi calea normală, apoi
# LocalCache-ul fiecărui pachet MSIX instalat (redirecționare %LOCALAPPDATA%).
function Resolve-NexusAndroidSdk {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)) {
    if ($value) { $candidates.Add($value) }
  }
  $candidates.Add((Join-Path $env:LOCALAPPDATA 'Android\Sdk'))
  $candidates.Add('C:\Android\Sdk')

  $packagesRoot = Join-Path $env:LOCALAPPDATA 'Packages'
  if (Test-Path -LiteralPath $packagesRoot) {
    foreach ($package in Get-ChildItem -LiteralPath $packagesRoot -Directory -ErrorAction SilentlyContinue) {
      $candidates.Add((Join-Path $package.FullName 'LocalCache\Local\Android\Sdk'))
      $candidates.Add((Join-Path $package.FullName 'LocalCache\Local\Android\sdk'))
    }
  }

  foreach ($candidate in $candidates) {
    if (Test-NexusAndroidSdkPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  return $null
}

# Caută un JDK compatibil (Expo SDK 57 / AGP cer JDK 17+); preferă 17.
function Resolve-NexusJavaHome {
  $directCandidates = @($env:JAVA_HOME, 'C:\Program Files\Android\Android Studio\jbr')
  foreach ($candidate in $directCandidates) {
    if (Test-NexusJavaHomePath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
  }

  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium'),
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java',
    'C:\Program Files\Microsoft\jdk'
  )

  $found = New-Object System.Collections.Generic.List[string]
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    if (Test-NexusJavaHomePath $root) { $found.Add($root); continue }
    foreach ($child in Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue) {
      if (Test-NexusJavaHomePath $child.FullName) { $found.Add($child.FullName) }
    }
  }
  if ($found.Count -eq 0) { return $null }

  $preferred = $found | Where-Object { $_ -match 'jdk-?17' } | Select-Object -First 1
  if ($preferred) { return $preferred }
  return $found[0]
}

function Resolve-NexusAdb {
  param([string]$AndroidSdk)
  if ($AndroidSdk) {
    $inSdk = Join-Path $AndroidSdk 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $inSdk) { return $inSdk }
  }
  $onPath = Get-Command adb.exe -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  return $null
}

# scrcpy este unealtă locală de dezvoltare (oglindire), nu cod de produs.
function Resolve-NexusScrcpy {
  if ($env:SCRCPY_PATH -and (Test-Path -LiteralPath $env:SCRCPY_PATH)) {
    return (Resolve-Path -LiteralPath $env:SCRCPY_PATH).Path
  }
  $preferred = Join-Path $script:NexusRepoRoot 'tools\scrcpy\scrcpy.exe'
  if (Test-Path -LiteralPath $preferred) { return $preferred }
  $onPath = Get-Command scrcpy.exe -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  return $null
}

function Get-NexusDeviceSerials {
  param([string]$Adb)
  if (-not $Adb) { return @() }
  $serials = New-Object System.Collections.Generic.List[string]
  foreach ($line in (& $Adb devices 2>$null)) {
    if ($line -match '^\s*(\S+)\s+device(\s|$)') { $serials.Add($Matches[1]) }
  }
  return @($serials)
}

# Același telefon poate apărea de două ori prin ADB Wi-Fi (transport IP + mDNS).
# Alegem transportul IP:port, stabil și acceptat de scrcpy/Gradle.
function Resolve-NexusDeviceSerial {
  param([string]$Adb, [string]$Preferred)
  $serials = Get-NexusDeviceSerials -Adb $Adb
  if ($Preferred) {
    if ($serials -contains $Preferred) { return $Preferred }
    $byPrefix = @($serials | Where-Object { $_ -like "$Preferred*" } | Select-Object -First 1)
    if ($byPrefix.Count -gt 0) { return $byPrefix[0] }
    throw "Dispozitivul '$Preferred' nu este conectat. Disponibile: $(if ($serials.Count) { $serials -join ', ' } else { 'niciunul' })."
  }
  if ($serials.Count -eq 0) { return $null }
  $ipForm = @($serials | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}:\d+$' } | Select-Object -First 1)
  if ($ipForm.Count -gt 0) { return $ipForm[0] }
  return $serials[0]
}

# Rezolvă tot toolchain-ul. Cu -ApplyEnvironment exportă variabilele în procesul
# curent, astfel încât `gradlew` și `expo` să găsească JDK-ul și SDK-ul.
function Import-NexusToolchain {
  param([string]$Device, [switch]$ApplyEnvironment)

  $androidSdk = Resolve-NexusAndroidSdk
  $javaHome = Resolve-NexusJavaHome
  $adb = Resolve-NexusAdb -AndroidSdk $androidSdk
  $deviceSerial = $null
  if ($adb) { $deviceSerial = Resolve-NexusDeviceSerial -Adb $adb -Preferred $Device }
  $scrcpy = Resolve-NexusScrcpy

  if ($ApplyEnvironment) {
    if ($javaHome) {
      $env:JAVA_HOME = $javaHome
      $javaBin = Join-Path $javaHome 'bin'
      if ($env:Path -notlike "*$javaBin*") { $env:Path = "$javaBin;$env:Path" }
    }
    if ($androidSdk) {
      $env:ANDROID_HOME = $androidSdk
      $env:ANDROID_SDK_ROOT = $androidSdk
      $platformTools = Join-Path $androidSdk 'platform-tools'
      if ($env:Path -notlike "*$platformTools*") { $env:Path = "$platformTools;$env:Path" }
    }
  }

  return @{
    JavaHome     = $javaHome
    AndroidSdk   = $androidSdk
    Adb          = $adb
    DeviceSerial = $deviceSerial
    Scrcpy       = $scrcpy
  }
}

$script:NexusDevPackageId = 'app.nexus.mobile.dev'
$script:NexusDefaultMetroPort = 8081

function Write-NexusStep {
  param([string]$Message)
  Write-Host "[nexus] $Message" -ForegroundColor Cyan
}

function Write-NexusOk {
  param([string]$Message)
  Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-NexusFail {
  param([string]$Message)
  Write-Host "[!] $Message" -ForegroundColor Yellow
}
