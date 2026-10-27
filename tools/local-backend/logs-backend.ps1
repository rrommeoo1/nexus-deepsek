# The logs, in the order a person reads them when something looks wrong.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\logs-backend.ps1
#   ... -Tail 200 -Only requests
param(
  [string]$NexusHome = 'C:\Nexus',
  [int]$Tail = 40,
  [ValidateSet('all', 'requests', 'errors', 'supervisor', 'backup')]
  [string]$Only = 'all'
)

$logDir = Join-Path $NexusHome 'logs'
if (-not (Test-Path $logDir)) { Write-Output "no logs at $logDir"; exit 0 }

$serverLog = Get-ChildItem $logDir -Filter 'server-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($Only -in 'all', 'supervisor') {
  Write-Output '=== supervisor.log (restarts, health probes, stops) ==='
  $path = Join-Path $logDir 'supervisor.log'
  if (Test-Path $path) { Get-Content $path -Tail $Tail } else { Write-Output '(none)' }
}
if ($Only -in 'all', 'requests', 'errors') {
  Write-Output "=== $($serverLog.Name) (the server's own output) ==="
  if ($serverLog) {
    $lines = Get-Content $serverLog.FullName -Tail ($Tail * 4)
    if ($Only -eq 'requests') { $lines = $lines | Where-Object { $_ -match '^\[req\]' } }
    if ($Only -eq 'errors') { $lines = $lines | Where-Object { $_ -match '\[error\]|Error' } }
    if ($lines) { $lines | Select-Object -Last $Tail } else { Write-Output '(nothing matched)' }
  } else { Write-Output '(no server log yet)' }
}
if ($Only -in 'all', 'backup') {
  Write-Output '=== backup.log (snapshots, retention, failures) ==='
  $path = Join-Path $logDir 'backup.log'
  if (Test-Path $path) { Get-Content $path -Tail $Tail } else { Write-Output '(no backup has run yet)' }
}
