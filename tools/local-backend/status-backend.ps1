# Shows whether the backend is up, since when, after how many restarts, and what it says about itself.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\status-backend.ps1
param([string]$NexusHome = 'C:\Nexus')

$ErrorActionPreference = 'Continue'
$statusFile = Join-Path $NexusHome 'run\status.json'
$lockFile = Join-Path $NexusHome 'run\supervisor.lock'
$envFile = Join-Path $NexusHome 'env\jungle.env'
$port = 5000
if (Test-Path $envFile) {
  $line = (Get-Content $envFile | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1)
  if ($line) { $port = [int](($line -split '=', 2)[1].Trim()) }
}

Write-Output "port            : $port"
Write-Output "supervisor lock : $(if (Test-Path $lockFile) { (Get-Content $lockFile -Raw).Trim() } else { 'not running' })"

if (Test-Path $statusFile) {
  $status = Get-Content $statusFile -Raw | ConvertFrom-Json
  Write-Output "started at      : $($status.started_at)"
  Write-Output "child pid       : $($status.child_pid)"
  Write-Output "restarts        : $($status.restarts)"
  Write-Output "healthy         : $($status.healthy)"
  Write-Output "last health     : $($status.last_health_at) $(if ($status.last_health_error) { "($($status.last_health_error))" })"
  Write-Output "data dir        : $($status.data_dir)"
}

try {
  $version = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/version" -TimeoutSec 4
  Write-Output 'api/version     : OK'
  Write-Output "  commit        : $($version.commit_short) ($($version.commit_source))"
  Write-Output "  fingerprint   : $($version.source_fingerprint)"
  Write-Output "  capabilities  : $((($version.capabilities.PSObject.Properties.Name) -join ', '))"
} catch {
  Write-Output "api/version     : NOT ANSWERING ($($_.Exception.Message))"
}

try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -TimeoutSec 4 -UseBasicParsing
  Write-Output "health          : $($health.StatusCode) $($health.Content)"
} catch {
  Write-Output "health          : NOT ANSWERING ($($_.Exception.Message))"
}


