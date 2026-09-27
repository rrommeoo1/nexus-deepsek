[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-RUSTVM-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-rustvm-scenarios.json'
}
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-RustVm { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }

function Invoke-BoundedTool {
    param([string]$FileName, [string[]]$Arguments, [string]$WorkingDirectory, [hashtable]$Environment, [int]$TimeoutMs = 120000)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $FileName
    $info.Arguments = $quoted
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $previousEnvironment = @{}
    foreach ($entry in $Environment.GetEnumerator()) {
        $key = [string]$entry.Key
        $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, [string]$entry.Value, 'Process')
    }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw "Process did not start: $FileName" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutMs)) { $process.Kill(); throw "Process exceeded $TimeoutMs ms: $FileName" }
        $stdoutTask.Wait(); $stderrTask.Wait()
        [ordered]@{ exit_code = $process.ExitCode; stdout = $stdoutTask.Result.Trim(); stderr = $stderrTask.Result.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4) }
    } finally {
        $process.Dispose()
        foreach ($entry in $previousEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable([string]$entry.Key, $entry.Value, 'Process') }
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$contractRoot = Join-Path $repoRoot 'contracts\nexus-actions'
$ephemeral = Join-Path $repoRoot '.ephemeral'
$cargoHome = Join-Path $ephemeral 'nx-chain-cargo'
$rustupHome = Join-Path $ephemeral 'nx-chain-rustup'
$llvmRoot = Join-Path $ephemeral 'llvm-mingw-20260616-ucrt-x86_64'
$llvmBin = Join-Path $llvmRoot 'bin'
$cargo = Join-Path $cargoHome 'bin\cargo.exe'
$testSource = Join-Path $contractRoot 'tests\nexus_actions_scenario_rs_test.rs'
$contractSource = Join-Path $contractRoot 'src\lib.rs'
$mxsc = Join-Path $contractRoot 'output\nexus-actions.mxsc.json'
$wasm = Join-Path $contractRoot 'output\nexus-actions.wasm'
$scenarioNames = @(
    'signed-action-replay.scen.json',
    'private-scope-denied.scen.json',
    'private-action-success.scen.json',
    'pauser-stop.scen.json',
    'capability-revoked.scen.json',
    'capability-rotation-escalation.scen.json',
    'relayer-and-nonce-denied.scen.json',
    'batch-shaped-extra-argument.scen.json'
)

foreach ($path in @($cargo, $testSource, $contractSource, $mxsc, $wasm)) { Assert-RustVm (Test-Path -LiteralPath $path) "Missing RustVM subject: $path" }
foreach ($name in $scenarioNames) { Assert-RustVm (Test-Path -LiteralPath (Join-Path $contractRoot "scenarios\$name")) "Missing differential scenario: $name" }
Assert-RustVm ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-RustVm ($RunId -match '^NX-CHAIN-001-RUSTVM-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
$tests = [IO.File]::ReadAllText($testSource, [Text.Encoding]::UTF8)
foreach ($name in $scenarioNames) { Assert-RustVm ($tests.Contains($name)) "RustVM trace writer missing: $name" }
Assert-RustVm ($tests -match 'wrong number of arguments') 'VM decoder batching rejection is absent.'

$toolPath = (Join-Path $cargoHome 'bin') + ';' + $llvmBin + ';' + (Join-Path $llvmRoot 'x86_64-w64-mingw32\bin') + ';' + $env:PATH
$environment = @{
    RUSTUP_HOME = $rustupHome
    CARGO_HOME = $cargoHome
    RUSTUP_TOOLCHAIN = '1.88.0-x86_64-pc-windows-gnu'
    PATH = $toolPath
    CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = (Join-Path $llvmBin 'x86_64-w64-mingw32-clang.exe')
    CC_x86_64_pc_windows_gnu = (Join-Path $llvmBin 'x86_64-w64-mingw32-clang.exe')
    AR_x86_64_pc_windows_gnu = (Join-Path $llvmBin 'x86_64-w64-mingw32-ar.exe')
}
$rustVm = Invoke-BoundedTool $cargo @('test', '-p', 'nexus-actions', '--test', 'nexus_actions_scenario_rs_test', '--locked', '--', '--test-threads=1') $contractRoot $environment
Assert-RustVm ($rustVm.exit_code -eq 0) "RustVM tests failed: $($rustVm.stderr)"
Assert-RustVm (($rustVm.stdout + $rustVm.stderr) -match '10 passed; 0 failed') 'RustVM receipt does not show 10/10 PASS.'
Assert-RustVm (($rustVm.stdout + $rustVm.stderr) -notmatch '(?i)warning:') 'RustVM emitted warnings.'

$artifactHashes = [ordered]@{}
foreach ($path in @($testSource, $contractSource, $mxsc, $wasm, (Join-Path $contractRoot 'Cargo.toml'), (Join-Path $contractRoot 'Cargo.lock'), $PSCommandPath)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($name in $scenarioNames) {
    $path = Join-Path $contractRoot "scenarios\$name"
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$subjectLines = $artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }
$sha = [Security.Cryptography.SHA256]::Create()
try { $subjectSha = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($subjectLines -join "`n")))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }

$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
Assert-RustVm ([IO.Path]::GetDirectoryName($resolvedEvidence) -eq $allowedEvidenceParent) 'EvidencePath must stay directly in planning/evidence.'
$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'rustvm_portable_differential_scenario_subjects'
    assertions = $assertions
    failures = @($failures)
    acceptance = [ordered]@{ rust_vm_tests = 'PASS_10_OF_10'; rust_vm_scenarios = 'PASS_8_OF_8'; vm_decoder_batch_rejection = 'PASS' }
    scenarios = $scenarioNames
    toolchain = [ordered]@{ rust = '1.88.0'; multiversx_sc = '0.66.2'; executor = 'RustVM' }
    claims_excluded = @('govm_execution', 'devnet_transaction', 'mainnet_readiness', 'production_security_audit')
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    subject_sha256 = $subjectSha
    artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$json = $result | ConvertTo-Json -Depth 10
if ($failures.Count -eq 0) { [IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false)) }
$json
if ($failures.Count -gt 0) { exit 1 }
