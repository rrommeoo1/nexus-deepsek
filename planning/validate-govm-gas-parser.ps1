[CmdletBinding()]
param(
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$fixture = Join-Path $PSScriptRoot 'fixtures\govm-gas-sample.log'
$parser = Join-Path $PSScriptRoot 'parse-govm-gas.ps1'
$raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $parser -LogPath $fixture -ExecutorRole $ExecutorRole
if ($LASTEXITCODE -ne 0) { throw 'GoVM gas parser execution failed.' }
$result = ($raw -join [Environment]::NewLine) | ConvertFrom-Json

$recordAction = @($result.summaries | Where-Object { $_.function -eq 'recordAction' -and $_.outcome_class -eq 'SUCCESS' })
$recordActionRejected = @($result.summaries | Where-Object { $_.function -eq 'recordAction' -and $_.outcome_class -eq 'EXPECTED_REJECTION' })
$failures = [Collections.Generic.List[string]]::new()
if ($result.status -ne 'PASS') { $failures.Add('Parser status is not PASS.') }
if ($result.record_count -ne 6) { $failures.Add('Expected exactly six parsed gas records.') }
if ($recordAction.Count -ne 1) { $failures.Add('Successful recordAction summary missing or duplicated.') }
if ($recordAction.Count -eq 1) {
    if ($recordAction[0].samples -ne 2) { $failures.Add('Successful recordAction sample count mismatch.') }
    if ($recordAction[0].min_gas -ne 239000) { $failures.Add('Successful recordAction minimum mismatch.') }
    if ($recordAction[0].median_gas -ne 240000) { $failures.Add('Successful recordAction median mismatch.') }
    if ($recordAction[0].max_gas -ne 241000) { $failures.Add('recordAction maximum mismatch.') }
    if ($recordAction[0].recommended_gas_limit -ne 302000) { $failures.Add('recordAction recommended limit mismatch.') }
}
if ($recordActionRejected.Count -ne 1 -or $recordActionRejected[0].samples -ne 1) { $failures.Add('Rejected recordAction classification mismatch.') }

$receipt = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    assertions = 9
    failures = @($failures)
    fixture_sha256 = (Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash.ToLowerInvariant()
    parser_sha256 = (Get-FileHash -LiteralPath $parser -Algorithm SHA256).Hash.ToLowerInvariant()
    claims_excluded = @('actual_govm_execution', 'actual_govm_gas')
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
}
$receipt | ConvertTo-Json -Depth 6
if ($failures.Count -gt 0) { exit 1 }
