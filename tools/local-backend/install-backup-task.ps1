# Registers the daily backup task.
#
# A scheduled task is the right shape here: the backup is a short, self-contained job that must run whether
# or not anybody is looking at the machine. It runs hidden, it writes its own log (`C:\Nexus\logs\backup.log`)
# and a manifest per snapshot, and its exit code is recorded by Task Scheduler so a failure is visible in
# `Get-ScheduledTaskInfo`.
#
#   powershell -ExecutionPolicy Bypass -File tools\local-backend\install-backup-task.ps1
param(
  [string]$NexusHome = 'C:\Nexus',
  [string]$TaskName = 'Jungle Book Backup',
  [string]$At = '03:30',
  [int]$KeepDb = 14,
  [int]$KeepMedia = 7
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node).Source
$script = Join-Path $repo 'tools\local-backend\backup-db.mjs'
$arguments = "`"$script`" --home `"$NexusHome`" --keep-db $KeepDb --keep-media $KeepMedia --label scheduled"

$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$settings.Hidden = $true
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Write-Output "task registered: $TaskName (daily $At, hidden, keep $KeepDb db / $KeepMedia media snapshots)"

# One run now, so the task is proven rather than assumed.
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 6
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output ("last run: {0}  result: 0x{1:X}" -f $info.LastRunTime, $info.LastTaskResult)
Write-Output "snapshots in $NexusHome\backups:"
Get-ChildItem (Join-Path $NexusHome 'backups\db') -Directory -ErrorAction SilentlyContinue | Select-Object -Last 3 | ForEach-Object { Write-Output "  $($_.Name)" }
