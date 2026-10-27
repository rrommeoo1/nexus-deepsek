# Starts the Jungle Book backend on this PC.
#
# It starts the supervisor (tools/local-backend/jungle-backend-service.mjs) through the same hidden
# launcher the scheduled task uses, then waits until /api/version actually answers. A server that was
# "started" but never answered is not started.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\start-backend.ps1
param(
  [string]$NexusHome = 'C:\Nexus',
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusFile = Join-Path $NexusHome 'run\status.json'
$launcher = Join-Path $NexusHome 'bin\jungle-backend.vbs'
$port = 5000
$envFile = Join-Path $NexusHome 'env\jungle.env'
if (Test-Path $envFile) {
  $line = (Get-Content $envFile | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1)
  if ($line) { $port = [int](($line -split '=', 2)[1].Trim()) }
}

function Test-Health {
  try {
    $answer = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/version" -TimeoutSec 3
    return $answer
  } catch { return $null }
}

$already = Test-Health
if ($already) {
  Write-Output "backend already answering on port $port (commit $($already.commit_short))"
  exit 0
}

if (-not (Test-Path $launcher)) {
  Write-Output "launcher $launcher is missing; run install-autostart.ps1 first"
  exit 2
}

Start-Process -FilePath 'wscript.exe' -ArgumentList "`"$launcher`"" -WindowStyle Hidden
Write-Output 'supervisor started; waiting for health'

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  $answer = Test-Health
  if ($answer) {
    Write-Output "backend healthy on port $port ??? commit $($answer.commit_short), capabilities: $((($answer.capabilities.PSObject.Properties.Name) -join ', '))"
    if (Test-Path $statusFile) { Get-Content $statusFile -Raw }
    exit 0
  }
}

Write-Output "backend did not answer within $TimeoutSeconds s; last supervisor log lines:"
$log = Join-Path $NexusHome 'logs\supervisor.log'
if (Test-Path $log) { Get-Content $log -Tail 15 }
exit 1


