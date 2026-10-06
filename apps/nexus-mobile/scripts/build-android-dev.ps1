$ErrorActionPreference = 'Stop'

$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildRoot = 'C:\nxm'
$markerName = '.nexus-mobile-build'
$markerSource = Join-Path $PSScriptRoot 'build-marker.txt'
$markerTarget = Join-Path $buildRoot $markerName
$expectedMarker = (Get-Content -LiteralPath $markerSource -Raw).Trim()

if (-not (Test-Path -LiteralPath $buildRoot)) {
  New-Item -ItemType Directory -Path $buildRoot | Out-Null
  Copy-Item -LiteralPath $markerSource -Destination $markerTarget
}

$resolvedBuildRoot = (Resolve-Path -LiteralPath $buildRoot).Path
if ($resolvedBuildRoot -ne 'C:\nxm' -or -not (Test-Path -LiteralPath $markerTarget) -or
    (Get-Content -LiteralPath $markerTarget -Raw).Trim() -ne $expectedMarker) {
  throw "Refuz build-ul: $buildRoot nu este directorul izolat Nexus verificat."
}

. (Join-Path $PSScriptRoot 'nexus-env.ps1')

# Rezolvă JDK-ul și Android SDK-ul independent de variabilele de utilizator:
# acestea pot indica o cale vizibilă doar în containerul MSIX (LocalCache).
$toolchain = Import-NexusToolchain -ApplyEnvironment
if (-not $toolchain.JavaHome) {
  throw 'JDK 17+ nu a fost găsit. Setează JAVA_HOME sau instalează Microsoft OpenJDK 17.'
}
if (-not $toolchain.AndroidSdk) {
  throw 'Android SDK nu a fost găsit (lipsește platform-tools\adb.exe). Verifică ANDROID_HOME sau instalarea SDK-ului.'
}
Write-Host "[nexus] JDK: $($toolchain.JavaHome)"
Write-Host "[nexus] Android SDK: $($toolchain.AndroidSdk)"
$env:NODE_ENV = 'development'

foreach ($name in @('app.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'eslint.config.js')) {
  Copy-Item -LiteralPath (Join-Path $mobileRoot $name) -Destination (Join-Path $buildRoot $name) -Force
}
foreach ($name in @('src', 'assets', 'patches')) {
  $targetDirectory = Join-Path $buildRoot $name
  New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
  Copy-Item -Path (Join-Path (Join-Path $mobileRoot $name) '*') -Destination $targetDirectory -Recurse -Force
}

Push-Location $buildRoot
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci a eșuat.' }
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild a eșuat.' }
  Push-Location (Join-Path $buildRoot 'android')
  try {
    .\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleDebug a eșuat.' }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$apkSource = Join-Path $buildRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path -LiteralPath $apkSource)) { throw 'APK-ul nu a fost generat.' }
$outputDir = Join-Path $mobileRoot 'builds'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$apkTarget = Join-Path $outputDir 'nexus-dev-arm64.apk'
Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
Write-Host "APK pregătit: $apkTarget"
