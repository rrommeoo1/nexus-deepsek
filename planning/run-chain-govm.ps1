[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-GOVM-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [string]$Distro = 'Ubuntu-24.04',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Unsupported Windows path: $full" }
    '/mnt/' + $matches[1].ToLowerInvariant() + '/' + $matches[2].Replace('\', '/')
}

function Invoke-WslCaptured {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & wsl.exe @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    [ordered]@{
        exit_code = $exitCode
        output = (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Replace("`0", '').Trim()
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$contractRoot = Join-Path $repoRoot 'contracts\nexus-actions'
$runnerRoot = Join-Path $repoRoot '.ephemeral\mx-scenario-go-v5.1.0-linux-amd64'
$runnerBinary = Join-Path $runnerRoot 'mx-scenario-go'
$runnerArchive = Join-Path $repoRoot '.ephemeral\mx_scenario_go_linux_amd64-v5.1.0.zip'
$rustEvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-rustvm-scenarios.json'
$gasEvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-gas.json'
$parserPath = Join-Path $PSScriptRoot 'parse-govm-gas.ps1'
$mxscPath = Join-Path $contractRoot 'output\nexus-actions.mxsc.json'
$wasmPath = Join-Path $contractRoot 'output\nexus-actions.wasm'
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-validation.json'
}
$logRoot = Join-Path $PSScriptRoot ("evidence\govm-logs\$RunId")

$scenarios = @(
    'signed-action-replay.scen.json',
    'private-scope-denied.scen.json',
    'private-action-success.scen.json',
    'pauser-stop.scen.json',
    'capability-revoked.scen.json',
    'capability-rotation-escalation.scen.json',
    'relayer-and-nonce-denied.scen.json',
    'batch-shaped-extra-argument.scen.json'
)
$expectedArchiveSha256 = '337c533d985174de61b86414fd21c8df567bcbb1d3e9989532cc8e0ed1852e48'
$expectedBinarySha256 = '588d1f4ba82e89bf9823af72b3b8af9d27cd38be2f75a420a3ba26ff95c03627'

foreach ($path in @($runnerBinary, $runnerArchive, $rustEvidencePath, $parserPath, $mxscPath, $wasmPath)) {
    if (-not (Test-Path -LiteralPath $path)) { $failures.Add("Missing required artifact: $path") }
}
foreach ($scenario in $scenarios) {
    $path = Join-Path $contractRoot "scenarios\$scenario"
    if (-not (Test-Path -LiteralPath $path)) { $failures.Add("Missing scenario: $path") }
}
if ($ExecutorRole -eq 'UNSPECIFIED') { $failures.Add('ExecutorRole must be explicit.') }
if ($RunId -notmatch '^NX-CHAIN-001-GOVM-[A-Za-z0-9T._-]+$') { $failures.Add('RunId format is invalid.') }
if ($failures.Count -gt 0) { throw ($failures -join [Environment]::NewLine) }

$archiveSha256 = (Get-FileHash -LiteralPath $runnerArchive -Algorithm SHA256).Hash.ToLowerInvariant()
$binarySha256 = (Get-FileHash -LiteralPath $runnerBinary -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveSha256 -ne $expectedArchiveSha256) { $failures.Add('GoVM archive digest mismatch.') }
if ($binarySha256 -ne $expectedBinarySha256) { $failures.Add('GoVM binary digest mismatch.') }

$contractWsl = Convert-ToWslPath $contractRoot
$runnerWsl = Convert-ToWslPath $runnerRoot
$versionReceipt = Invoke-WslCaptured @('-d', $Distro, '-u', 'root', '--', 'env', "LD_LIBRARY_PATH=$runnerWsl", "$runnerWsl/mx-scenario-go", '--version')
if ($versionReceipt.exit_code -ne 0 -or $versionReceipt.output -notmatch 'mx-scenario-go version 5\.1\.0') {
    $failures.Add("GoVM version check failed: $($versionReceipt.output)")
}

[IO.Directory]::CreateDirectory($logRoot) | Out-Null
$scenarioReceipts = [Collections.Generic.List[object]]::new()
$logPaths = [Collections.Generic.List[string]]::new()
foreach ($scenario in $scenarios) {
    $receipt = Invoke-WslCaptured @(
        '-d', $Distro, '-u', 'root', '--cd', $contractWsl, '--',
        'env', "LD_LIBRARY_PATH=$runnerWsl", "$runnerWsl/mx-scenario-go",
        'run', '--vm', '1.5', '--force-trace-gas', "scenarios/$scenario"
    )
    $logPath = Join-Path $logRoot ($scenario + '.log')
    [IO.File]::WriteAllText($logPath, $receipt.output + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    $passed = $receipt.exit_code -eq 0 -and $receipt.output -match '(?m)^SUCCESS\s*$' -and $receipt.output -notmatch '(?m)^ERROR:'
    if (-not $passed) { $failures.Add("GoVM scenario failed: $scenario") }
    $logPaths.Add($logPath)
    $scenarioReceipts.Add([pscustomobject][ordered]@{
        scenario = $scenario
        status = if ($passed) { 'PASS' } else { 'FAIL' }
        exit_code = $receipt.exit_code
        scenario_sha256 = (Get-FileHash -LiteralPath (Join-Path $contractRoot "scenarios\$scenario") -Algorithm SHA256).Hash.ToLowerInvariant()
        log_path = $logPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
        log_sha256 = (Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash.ToLowerInvariant()
    })
}

$gasRaw = & $parserPath -LogPath @($logPaths) -RunId ($RunId + '-GAS') -ExecutorRole $ExecutorRole -EvidencePath $gasEvidencePath
$gasExitCode = $LASTEXITCODE
$gasEvidence = ($gasRaw -join [Environment]::NewLine) | ConvertFrom-Json
if ($gasExitCode -ne 0 -or $gasEvidence.status -ne 'PASS') { $failures.Add('GoVM gas parser failed.') }
$recordActionGas = @($gasEvidence.budget_summaries | Where-Object { $_.function -eq 'recordAction' })
$recordPrivateGas = @($gasEvidence.budget_summaries | Where-Object { $_.function -eq 'recordPrivateAction' })
if ($recordActionGas.Count -ne 1) { $failures.Add('Successful recordAction gas baseline missing.') }
if ($recordPrivateGas.Count -ne 1) { $failures.Add('Successful recordPrivateAction gas baseline missing.') }

$rustEvidence = [IO.File]::ReadAllText($rustEvidencePath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($rustEvidence.status -ne 'PASS' -or $rustEvidence.acceptance.rust_vm_scenarios -ne 'PASS_8_OF_8') {
    $failures.Add('Matching RustVM differential evidence is not PASS_8_OF_8.')
}
foreach ($scenario in $scenarios) {
    $relative = "contracts/nexus-actions/scenarios/$scenario"
    $property = $rustEvidence.artifact_sha256.PSObject.Properties[$relative]
    $actual = (Get-FileHash -LiteralPath (Join-Path $contractRoot "scenarios\$scenario") -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($null -eq $property -or $property.Value -ne $actual) {
        $failures.Add("RustVM/GoVM scenario subject mismatch: $scenario")
    }
}

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'govm_v1_5_differential_and_actual_gas_snapshot'
    failures = @($failures)
    runtime = [ordered]@{
        distro = $Distro
        wsl = '2.7.11.0'
        kernel = '6.18.33.2-microsoft-standard-WSL2'
        architecture = 'x86_64'
        glibc = '2.39'
    }
    runner = [ordered]@{
        repository = 'multiversx/mx-chain-scenario-cli-go'
        version = '5.1.0'
        vm = '1.5'
        archive_sha256 = $archiveSha256
        binary_sha256 = $binarySha256
        mxsc_sha256 = (Get-FileHash -LiteralPath $mxscPath -Algorithm SHA256).Hash.ToLowerInvariant()
        wasm_sha256 = (Get-FileHash -LiteralPath $wasmPath -Algorithm SHA256).Hash.ToLowerInvariant()
        rust_evidence_sha256 = (Get-FileHash -LiteralPath $rustEvidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
        version_output = $versionReceipt.output
    }
    differential = [ordered]@{
        rust_vm = 'PASS_8_OF_8'
        go_vm = if (@($scenarioReceipts | Where-Object { $_.status -ne 'PASS' }).Count -eq 0) { 'PASS_8_OF_8' } else { 'FAIL' }
        identical_scenario_subjects = @($failures | Where-Object { $_ -like 'RustVM/GoVM scenario subject mismatch:*' }).Count -eq 0
    }
    scenarios = @($scenarioReceipts)
    gas = [ordered]@{
        status = if ($gasEvidence.status -eq 'PASS') { 'PASS_ACTUAL_GOVM_1_5' } else { 'FAIL' }
        evidence_path = $gasEvidencePath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
        evidence_sha256 = (Get-FileHash -LiteralPath $gasEvidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
        budget_summaries = @($gasEvidence.budget_summaries)
        expected_rejections_excluded_from_budget = $true
        headroom_policy = 'ceil(max_success_gas * 1.25 / 1000) * 1000'
    }
    packet_completion = [ordered]@{
        ready_for_independent_t0_review = $failures.Count -eq 0
        accepted = $false
        reason = 'INDEPENDENT_T0_REVIEW_PENDING'
    }
    claims_excluded = @('devnet_transaction', 'mainnet_readiness', 'production_security_audit')
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}

$json = $result | ConvertTo-Json -Depth 10
$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
if ([IO.Path]::GetDirectoryName($resolvedEvidence) -ne $allowedEvidenceParent) {
    throw 'EvidencePath must stay directly in planning/evidence.'
}
[IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$json
if ($failures.Count -gt 0) { exit 1 }
