# Pornește dev server-ul Expo/Metro cu fiecare linie de jurnal marcată cu ora.
#
# Motiv: bucla reinstall-free se verifică prin timpul dintre salvarea unui fișier
# și linia de Fast Refresh din jurnal. Jurnalul ajunge în builds\metro.log, motiv
# pentru care `npm run dev:doctor` poate arăta ultimul Fast Refresh livrat.
#
# `-Clear` golește cache-ul de transformare. Este obligatoriu după o schimbare în
# `.env`: `EXPO_PUBLIC_*` este inline-uit în bundle la transformare, deci un Metro
# pornit înainte de editare continuă să servească originea veche (rândul 39 din
# JUNGLE_BOOK_PROGRESS.md a fost diagnosticat exact așa).
param(
  [int]$Port = 8081,
  [switch]$NoLog,
  [switch]$Clear
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
$metroArgs = @('expo', 'start', '--dev-client', '--port', $Port)
if ($Clear) {
  $metroArgs += '--clear'
  Write-Host '[nexus] Cache Metro golit (--clear): variabilele EXPO_PUBLIC_* se citesc din nou.' -ForegroundColor Cyan
}
if ($NoLog) {
  & $npx.Source @metroArgs 2>&1
} else {
  & $npx.Source @metroArgs 2>&1 |
    ForEach-Object { "$(Get-Date -Format 'HH:mm:ss.fff') $_" } |
    Tee-Object -FilePath $logPath
}
