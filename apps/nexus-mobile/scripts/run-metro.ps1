# Pornește dev server-ul Expo/Metro cu fiecare linie de jurnal marcată cu ora.
#
# Motiv: bucla reinstall-free se verifică prin timpul dintre salvarea unui fișier
# și linia de Fast Refresh din jurnal. Jurnalul ajunge în builds\metro.log, motiv
# pentru care `npm run dev:doctor` poate arăta ultimul Fast Refresh livrat.
param(
  [int]$Port = 8081,
  [switch]$NoLog
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
. (Join-Path $PSScriptRoot 'nexus-env.ps1')

$logDirectory = Join-Path $script:NexusMobileRoot 'builds'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory 'metro.log'

$npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npx) { $npx = Get-Command npx -ErrorAction SilentlyContinue }
if (-not $npx) { throw 'npx nu a fost găsit în PATH. Este nevoie de Node.js.' }

Set-Location -LiteralPath $script:NexusMobileRoot
Write-Host "[nexus] Metro pe portul $Port; jurnal: $logPath" -ForegroundColor Cyan

# stderr de la Metro este normal (avertismente); nu trebuie să oprească scriptul.
$ErrorActionPreference = 'Continue'
if ($NoLog) {
  & $npx.Source expo start --dev-client --port $Port 2>&1
} else {
  & $npx.Source expo start --dev-client --port $Port 2>&1 |
    ForEach-Object { "$(Get-Date -Format 'HH:mm:ss.fff') $_" } |
    Tee-Object -FilePath $logPath
}
