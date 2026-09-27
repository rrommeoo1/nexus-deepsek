# Owner-authorized persistent local Nexus Social workspace on port 5000.
# Per-user and non-elevated. The application reads HOST/PORT from its existing .env.
$ErrorActionPreference = 'Stop'

$socialRoot = Split-Path $PSScriptRoot -Parent
$socialServer = Join-Path $socialRoot 'server.js'
$socialEnv = Join-Path $socialRoot '.env'
$socialNode = (Get-Command node -ErrorAction Stop).Source
$socialUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$socialTaskName = 'Nexus Social 5000'
$socialArguments = '--max-old-space-size=768 "' + $socialServer + '"'

if (-not (Test-Path -LiteralPath $socialServer)) { throw 'Nexus server.js was not found.' }
if (-not (Test-Path -LiteralPath $socialEnv)) { throw 'Nexus .env was not found.' }

$configuredPort = Get-Content -LiteralPath $socialEnv |
  Where-Object { $_ -match '^PORT=' } |
  Select-Object -First 1
if ($configuredPort -ne 'PORT=5000') { throw 'The existing .env is not configured for port 5000.' }

$socialExisting = Get-ScheduledTask -TaskName $socialTaskName -ErrorAction SilentlyContinue
if ($socialExisting) {
  $sameExecutable = @($socialExisting.Actions).Execute -contains $socialNode
  $sameArguments = @($socialExisting.Actions).Arguments -contains $socialArguments
  $sameDirectory = @($socialExisting.Actions).WorkingDirectory -contains $socialRoot
  if (-not ($sameExecutable -and $sameArguments -and $sameDirectory)) {
    throw 'Task name already belongs to another configuration. Refusing to overwrite it.'
  }
}

$socialAction = New-ScheduledTaskAction -Execute $socialNode -Argument $socialArguments -WorkingDirectory $socialRoot
$socialLogon = New-ScheduledTaskTrigger -AtLogOn -User $socialUser
$socialRecovery = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$socialPrincipal = New-ScheduledTaskPrincipal -UserId $socialUser -LogonType Interactive -RunLevel Limited
$socialSettings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $socialTaskName `
  -Action $socialAction `
  -Trigger @($socialLogon, $socialRecovery) `
  -Principal $socialPrincipal `
  -Settings $socialSettings `
  -Description 'Owner-authorized Nexus Social LAN workspace on port 5000. Recovers once per minute; no simulations or paid services.' `
  -Force | Select-Object TaskName, State

Start-ScheduledTask -TaskName $socialTaskName

