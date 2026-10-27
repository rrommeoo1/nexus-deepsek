# Removes the autostart entry and stops the backend. The data is never touched.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\uninstall-autostart.ps1
#   ... -RestoreLegacy    also re-enables the previous "Nexus Social 5000" task
param(
  [string]$NexusHome = 'C:\Nexus',
  [string]$TaskName = 'Jungle Book Backend',
  [string]$LegacyTaskName = 'Nexus Social 5000',
  [switch]$RestoreLegacy
)

$ErrorActionPreference = 'Continue'

& (Join-Path $PSScriptRoot 'stop-backend.ps1') -Home $NexusHome

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "task removed: $TaskName"
}

$launcher = Join-Path $NexusHome 'bin\jungle-backend.vbs'
if (Test-Path $launcher) { Remove-Item $launcher -Force; Write-Output "launcher removed: $launcher" }

if ($RestoreLegacy) {
  $legacy = Get-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
  if ($legacy) {
    Enable-ScheduledTask -TaskName $LegacyTaskName | Out-Null
    Start-ScheduledTask -TaskName $LegacyTaskName
    Write-Output "legacy task re-enabled and started: $LegacyTaskName"
  }
}

Write-Output 'data, media and backups were left untouched'


