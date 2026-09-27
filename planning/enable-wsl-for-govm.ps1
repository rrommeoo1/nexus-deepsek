[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-wsl-enable.json'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'ADMINISTRATOR_REQUIRED' }

$features = @(
    'Microsoft-Windows-Subsystem-Linux',
    'VirtualMachinePlatform'
)
$receipts = [Collections.Generic.List[object]]::new()
foreach ($feature in $features) {
    $output = & dism.exe /Online /Enable-Feature "/FeatureName:$feature" /All /NoRestart /English 2>&1
    $exitCode = $LASTEXITCODE
    $receipts.Add([pscustomobject][ordered]@{
        feature = $feature
        exit_code = $exitCode
        success = $exitCode -eq 0 -or $exitCode -eq 3010
        restart_required = $exitCode -eq 3010 -or (($output -join "`n") -match '(?i)restart required|restart the computer')
        output = ($output -join "`n").Trim()
    })
}

$allSucceeded = @($receipts | Where-Object { -not $_.success }).Count -eq 0
$restartRequired = @($receipts | Where-Object { $_.restart_required }).Count -gt 0
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    operation = 'enable_wsl_prerequisites_no_restart'
    status = if ($allSucceeded) { 'PASS' } else { 'FAIL' }
    elevated = $isAdmin
    features = @($receipts)
    restart_required = $restartRequired
    restart_performed = $false
    distribution_installed = $false
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    created_at = [DateTimeOffset]::UtcNow.ToString('O')
}
$json = $result | ConvertTo-Json -Depth 7
[IO.Directory]::CreateDirectory((Split-Path -Parent $evidencePath)) | Out-Null
[IO.File]::WriteAllText($evidencePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$json
if (-not $allSucceeded) { exit 1 }

