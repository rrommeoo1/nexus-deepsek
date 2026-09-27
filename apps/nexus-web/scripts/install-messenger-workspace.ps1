# Explicit owner request: keep the existing 3100 workspace available on the LAN.
# Per-user, non-elevated startup. No router, firewall, sleep or billing changes.
$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path $PSScriptRoot -Parent
$workspaceScript = Join-Path $PSScriptRoot 'messenger-workspace.mjs'
$workspaceNode = (Get-Command node -ErrorAction Stop).Source
$workspaceUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$workspaceTaskName = 'Nexus Messenger 3100'
if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot 'test-labs\messenger\lab.json'))) { throw 'Existing workspace credentials required; no new account will be created.' }
$workspaceArguments = '--max-old-space-size=384 "' + $workspaceScript + '"'
$workspaceExisting = Get-ScheduledTask -TaskName $workspaceTaskName -ErrorAction SilentlyContinue
if ($workspaceExisting -and ($workspaceExisting.Actions.Arguments -notcontains $workspaceArguments)) { throw 'Task name already owned by another configuration. Refusing to overwrite.' }
$workspaceAction = New-ScheduledTaskAction -Execute $workspaceNode -Argument $workspaceArguments -WorkingDirectory $workspaceRoot
$workspaceTrigger = New-ScheduledTaskTrigger -AtLogOn -User $workspaceUser
# Some Windows hosts do not retry externally terminated, manually-started tasks.
# A periodic start plus IgnoreNew recovers a stopped server without killing a live one.
$workspaceRecoveryTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$workspacePrincipal = New-ScheduledTaskPrincipal -UserId $workspaceUser -LogonType Interactive -RunLevel Limited
$workspaceSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $workspaceTaskName -Action $workspaceAction -Trigger @($workspaceTrigger, $workspaceRecoveryTrigger) -Principal $workspacePrincipal -Settings $workspaceSettings -Description 'Owner-authorized Nexus LAN workspace on 3100/3543. Existing accounts/data only; minute recovery, no automatic simulation or paid providers.' -Force | Select-Object TaskName,State
# Start separately after resolving any old timed server occupying these ports.
