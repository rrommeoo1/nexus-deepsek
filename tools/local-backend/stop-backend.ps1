# Stops the Jungle Book backend cleanly.
#
# "Cleanly" means the server closes the database itself: the supervisor writes a shutdown line to the
# child's stdin and only hard-kills it if it does not answer in 15 seconds. Nothing is killed by pid here,
# so a stray process on the same port is never collateral.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\stop-backend.ps1
param([string]$NexusHome = 'C:\Nexus', [int]$TimeoutSeconds = 30)

$ErrorActionPreference = 'Stop'
$runDir = Join-Path $NexusHome 'run'
$stopFile = Join-Path $runDir 'stop.request'
$lockFile = Join-Path $runDir 'supervisor.lock'

New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (-not (Test-Path $lockFile)) {
  Write-Output 'no supervisor is running (no lock file)'
  exit 0
}

Set-Content -Path $stopFile -Value (Get-Date -Format o)
Write-Output 'stop requested; waiting for the server to close the database'

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if (-not (Test-Path $lockFile)) {
    Write-Output 'backend stopped cleanly'
    exit 0
  }
}

Write-Output "supervisor still running after $TimeoutSeconds s; see $NexusHome\logs\supervisor.log"
exit 1


