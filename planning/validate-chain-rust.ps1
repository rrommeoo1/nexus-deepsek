[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-RUST-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-rust-validation.json'
}
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-RustEvidence {
    param([bool]$Condition, [string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Read-Utf8 {
    param([string]$Path)
    [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

function Invoke-BoundedTool {
    param(
        [string]$FileName,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [hashtable]$Environment,
        [int]$TimeoutMs = 120000
    )
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
        if (-not $process.WaitForExit($TimeoutMs)) {
            $process.Kill()
            throw "Process exceeded $TimeoutMs ms: $FileName"
        }
        $stdoutTask.Wait()
        $stderrTask.Wait()
        [ordered]@{
            exit_code = $process.ExitCode
            stdout = $stdoutTask.Result.Trim()
            stderr = $stderrTask.Result.Trim()
            cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4)
        }
    } finally {
        $process.Dispose()
        foreach ($entry in $previousEnvironment.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable([string]$entry.Key, $entry.Value, 'Process')
        }
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
$paths = [ordered]@{
    manifest = Join-Path $contractRoot 'Cargo.toml'
    lock = Join-Path $contractRoot 'Cargo.lock'
    source = Join-Path $contractRoot 'src\lib.rs'
    meta_manifest = Join-Path $contractRoot 'meta\Cargo.toml'
    meta_source = Join-Path $contractRoot 'meta\src\main.rs'
    wasm_manifest = Join-Path $contractRoot 'wasm\Cargo.toml'
    wasm_lock = Join-Path $contractRoot 'wasm\Cargo.lock'
    tests = Join-Path $contractRoot 'tests\nexus_actions_scenario_rs_test.rs'
    abi_v2 = Join-Path $contractRoot 'output\nexus-actions.abi.json'
    wasm = Join-Path $contractRoot 'output\nexus-actions.wasm'
    mxsc = Join-Path $contractRoot 'output\nexus-actions.mxsc.json'
    imports = Join-Path $contractRoot 'output\nexus-actions.imports.json'
    codehash = Join-Path $contractRoot 'output\nexus-actions.codehash.txt'
    proxy = Join-Path $contractRoot 'output\nexus_actions_proxy.rs'
    scenario_replay = Join-Path $contractRoot 'scenarios\signed-action-replay.scen.json'
    scenario_private = Join-Path $contractRoot 'scenarios\private-scope-denied.scen.json'
    scenario_private_success = Join-Path $contractRoot 'scenarios\private-action-success.scen.json'
    scenario_pause = Join-Path $contractRoot 'scenarios\pauser-stop.scen.json'
    scenario_revoked = Join-Path $contractRoot 'scenarios\capability-revoked.scen.json'
    scenario_rotation = Join-Path $contractRoot 'scenarios\capability-rotation-escalation.scen.json'
    scenario_relayer = Join-Path $contractRoot 'scenarios\relayer-and-nonce-denied.scen.json'
    scenario_batch = Join-Path $contractRoot 'scenarios\batch-shaped-extra-argument.scen.json'
    abi_v1 = Join-Path $repoRoot 'packages\contracts\abi\nexus-actions.abi.json'
    compatibility = Join-Path $repoRoot 'packages\contracts\compatibility-baseline.v1.json'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-CHAIN-001.md'
    govm_preflight_validator = Join-Path $PSScriptRoot 'validate-chain-govm-preflight.ps1'
    govm_preflight_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-preflight.json'
    govm_gas_parser = Join-Path $PSScriptRoot 'parse-govm-gas.ps1'
    govm_gas_parser_validator = Join-Path $PSScriptRoot 'validate-govm-gas-parser.ps1'
    govm_gas_fixture = Join-Path $PSScriptRoot 'fixtures\govm-gas-sample.log'
    wsl_enable_script = Join-Path $PSScriptRoot 'enable-wsl-for-govm.ps1'
    wsl_enable_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-wsl-enable.json'
    govm_runner = Join-Path $PSScriptRoot 'run-chain-govm.ps1'
    govm_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-validation.json'
    govm_gas_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-gas.json'
    rustvm_validator = Join-Path $PSScriptRoot 'validate-chain-rustvm-scenarios.ps1'
    rustvm_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-rustvm-scenarios.json'
    fuzz_validator = Join-Path $PSScriptRoot 'validate-chain-fuzz.ps1'
    fuzz_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-fuzz-validation.json'
    fuzz_source = Join-Path $repoRoot 'packages\chain-actions-api\fuzz.test.ts'
    chain_api_source = Join-Path $repoRoot 'packages\chain-actions-api\index.ts'
    devnet_runner = Join-Path $PSScriptRoot 'run-chain-devnet.ps1'
    devnet_payload_builder = Join-Path $PSScriptRoot 'build-chain-devnet-payload.py'
    devnet_payload_test = Join-Path $PSScriptRoot 'test-chain-devnet-payload.py'
    devnet_runner_test = Join-Path $PSScriptRoot 'test-chain-devnet-runner.py'
    devnet_approval_validator = Join-Path $PSScriptRoot 'validate-chain-devnet-approval.py'
    devnet_capability_decoder = Join-Path $PSScriptRoot 'decode-chain-capability.py'
    devnet_guard_library = Join-Path $PSScriptRoot 'chain-devnet-guards.ps1'
    devnet_guard_test = Join-Path $PSScriptRoot 'test-chain-devnet-guards.ps1'
    devnet_preflight_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-devnet-preflight.json'
    devnet_verifier = Join-Path $PSScriptRoot 'verify-chain-devnet-r3.ps1'
    devnet_final_evidence = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-devnet-validation.json'
    devnet_r3_approval = Join-Path $PSScriptRoot 'approvals\NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-R3.json'
    devnet_r3_allow_log = Join-Path $PSScriptRoot 'evidence\devnet-logs\NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-03\allow-relayer.json'
    devnet_r3_rotate_log = Join-Path $PSScriptRoot 'evidence\devnet-logs\NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-03\rotate-capability.json'
    devnet_r3_record_log = Join-Path $PSScriptRoot 'evidence\devnet-logs\NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-03\record-action.json'
    rustup = Join-Path $cargoHome 'bin\rustup.exe'
    llvm_archive = Join-Path $ephemeral 'llvm-mingw-20260616-ucrt-x86_64.zip'
    llvm_linker = Join-Path $llvmBin 'x86_64-w64-mingw32-clang.exe'
}

foreach ($path in $paths.Values) {
    Assert-RustEvidence (Test-Path -LiteralPath $path) "Missing Rust evidence artifact: $path"
}
Assert-RustEvidence ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-RustEvidence ($RunId -match '^NX-CHAIN-001-RUST-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$manifest = Read-Utf8 $paths.manifest
$metaManifest = Read-Utf8 $paths.meta_manifest
$abiV1 = Read-Utf8 $paths.abi_v1 | ConvertFrom-Json
$abiV2 = Read-Utf8 $paths.abi_v2 | ConvertFrom-Json
$imports = Read-Utf8 $paths.imports | ConvertFrom-Json
$mxsc = Read-Utf8 $paths.mxsc | ConvertFrom-Json
$goVmPreflight = Read-Utf8 $paths.govm_preflight_evidence | ConvertFrom-Json
$wslEnable = Read-Utf8 $paths.wsl_enable_evidence | ConvertFrom-Json
$goVmEvidence = Read-Utf8 $paths.govm_evidence | ConvertFrom-Json
$goVmGasEvidence = Read-Utf8 $paths.govm_gas_evidence | ConvertFrom-Json
$rustVmEvidence = Read-Utf8 $paths.rustvm_evidence | ConvertFrom-Json
$fuzzEvidence = Read-Utf8 $paths.fuzz_evidence | ConvertFrom-Json
$devnetPreflight = Read-Utf8 $paths.devnet_preflight_evidence | ConvertFrom-Json
$devnetFinal = Read-Utf8 $paths.devnet_final_evidence | ConvertFrom-Json

Assert-RustEvidence ($manifest -match 'version\s*=\s*"=0\.66\.2"') 'Contract framework is not pinned to 0.66.2.'
Assert-RustEvidence ($manifest -match 'features\s*=\s*\["wasmer-experimental"\]') 'RustVM executor feature is not explicit.'
Assert-RustEvidence ($metaManifest -match 'multiversx-sc-meta-lib' -and $metaManifest -match 'version\s*=\s*"=0\.66\.2"') 'sc-meta crate is not pinned.'
Assert-RustEvidence ($source -match '#!\[no_std\]') 'Contract is not no_std.'
Assert-RustEvidence ($source -match 'verify_ed25519') 'VM Ed25519 verification is absent.'
Assert-RustEvidence ($source -match 'NEXUS_ACTION_V2\\0') 'Domain-separated signing preimage is absent.'
Assert-RustEvidence ($source -match 'get_sc_address\(\)\.as_managed_buffer') 'Signing domain is not contract-bound.'
Assert-RustEvidence ($source -match 'ACTION_NONCE_REPLAY_OR_GAP') 'Strict nonce rejection is absent.'
Assert-RustEvidence ($source -match 'new_scope_bits & !old\.scope_bits == 0') 'Rotation scope non-escalation is absent.'
Assert-RustEvidence ($source -match 'new_max_actions > 0 && new_max_actions <= old\.max_actions - old\.used_actions') 'Rotation limit non-escalation is absent.'
Assert-RustEvidence ($source -match 'envelope\.object_commitment == generic_commitment') 'Private commitment equality check is absent.'
Assert-RustEvidence ($source -match 'ACTOR_SYSTEM_TEST' -and $source -notmatch 'ACTOR_CHILD') 'Synthetic actor support or Kids exclusion regressed.'
Assert-RustEvidence ($source -notmatch '#\[payable') 'Action contract contains a payable endpoint.'
Assert-RustEvidence ($source -notmatch '(?i)egld|esdt|transfer_execute|direct_egld') 'Action contract contains financial primitives.'
Assert-RustEvidence ($source -notmatch '(?i)email|phone|latitude|longitude|dating_target|message_plaintext|child_id') 'Contract source contains forbidden private fields.'
Assert-RustEvidence ($tests -match 'SigningKey::from_bytes' -and $tests -match 'ACTION_NONCE_REPLAY_OR_GAP') 'RustVM test does not use real Ed25519 plus replay rejection.'
Assert-RustEvidence ($tests -match 'write_scenario_trace' -and $tests -match 'CAPABILITY_SCOPE_DENIED' -and $tests -match 'ACTION_TYPE_PAUSED' -and $tests -match 'wrong number of arguments') 'Differential scenario coverage is incomplete.'
Assert-RustEvidence ($tests -match 'private_action_with_private_scope_is_accepted' -and $tests -match 'private-action-success\.scen\.json') 'Positive private-action differential coverage is absent.'
Assert-RustEvidence ($tests -match 'CONTROLLER_REQUIRED' -and $tests -match 'CAPABILITY_REVOKED' -and $tests -match 'CAPABILITY_SCOPE_ESCALATION' -and $tests -match 'CAPABILITY_ACTION_LIMIT') 'Adversarial capability coverage is incomplete.'
Assert-RustEvidence ($rustVmEvidence.status -eq 'PASS' -and $rustVmEvidence.acceptance.rust_vm_scenarios -eq 'PASS_8_OF_8' -and $rustVmEvidence.acceptance.vm_decoder_batch_rejection -eq 'PASS') 'Dedicated RustVM differential evidence is absent.'
Assert-RustEvidence ($fuzzEvidence.status -eq 'PASS' -and [int]$fuzzEvidence.corpus.total_cases -eq 4096 -and [int]$fuzzEvidence.corpus.mutation_oracle_mismatches -eq 0 -and $fuzzEvidence.corpus.deterministic_replay_match -eq $true) 'Deterministic fuzz corpus evidence is absent or stale.'
$rustVmSubjectsCurrent = $true
foreach ($scenarioPath in @($paths.scenario_replay, $paths.scenario_private, $paths.scenario_private_success, $paths.scenario_pause, $paths.scenario_revoked, $paths.scenario_rotation, $paths.scenario_relayer, $paths.scenario_batch)) {
    $relative = $scenarioPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $property = $rustVmEvidence.artifact_sha256.PSObject.Properties[$relative]
    $rustVmSubjectsCurrent = $rustVmSubjectsCurrent -and $null -ne $property -and $property.Value -eq (Get-FileHash -LiteralPath $scenarioPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
Assert-RustEvidence $rustVmSubjectsCurrent 'RustVM differential evidence is stale relative to portable scenarios.'
$fuzzSubjectsCurrent = $true
foreach ($fuzzPath in @($paths.chain_api_source, $paths.fuzz_source, $paths.source, $paths.wasm, $paths.mxsc, $paths.abi_v1, $paths.abi_v2, $paths.fuzz_validator)) {
    $relative = $fuzzPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $property = $fuzzEvidence.artifact_sha256.PSObject.Properties[$relative]
    $fuzzSubjectsCurrent = $fuzzSubjectsCurrent -and $null -ne $property -and $property.Value -eq (Get-FileHash -LiteralPath $fuzzPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
Assert-RustEvidence $fuzzSubjectsCurrent 'Fuzz Evidence Pack is stale relative to source, ABI, MXSC, WASM, or validator.'
Assert-RustEvidence ($devnetPreflight.status -eq 'READY_AWAITING_EXPLICIT_PUBLIC_DEVNET_APPROVAL' -and $devnetPreflight.payload_parity.status -eq 'PASS' -and $devnetPreflight.payload_parity.assertions.signature_matches_rustvm -eq $true) 'Devnet payload/tooling preflight is not ready.'
Assert-RustEvidence ($devnetPreflight.execution_policy.default_mode -eq 'Prepare' -and $devnetPreflight.execution_policy.execute_requires_allow_switch -eq $true -and $devnetPreflight.execution_policy.execute_requires_approval_id -eq $true) 'Devnet execution is not fail-closed.'
Assert-RustEvidence ([int]$devnetPreflight.network_operations -eq 0 -and [int]$devnetPreflight.economic_operations -eq 0) 'Devnet preflight performed network or economic operations.'
$devnetSubjectsCurrent = $true
foreach ($devnetPath in @($paths.wasm, $paths.mxsc, $paths.abi_v2, $paths.devnet_payload_builder, $paths.devnet_payload_test, $paths.devnet_runner_test, $paths.devnet_approval_validator, $paths.devnet_capability_decoder, $paths.devnet_guard_library, $paths.devnet_guard_test, $paths.devnet_runner)) {
    $relative = $devnetPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $property = $devnetPreflight.artifact_sha256.PSObject.Properties[$relative]
    $devnetSubjectsCurrent = $devnetSubjectsCurrent -and $null -ne $property -and $property.Value -eq (Get-FileHash -LiteralPath $devnetPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
Assert-RustEvidence $devnetSubjectsCurrent 'Devnet preflight is stale relative to runner, payload builder, ABI, MXSC, or WASM.'
Assert-RustEvidence ($devnetFinal.status -eq 'PASS' -and $devnetFinal.run_id -eq 'NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-03' -and $devnetFinal.approval.status -eq 'CONSUMED') 'Terminal Devnet Evidence Pack is absent or invalid.'
Assert-RustEvidence ($devnetFinal.transactions.allow_relayer.status -eq 'success' -and $devnetFinal.transactions.rotate_capability.status -eq 'success' -and $devnetFinal.transactions.record_action.status -eq 'success') 'Devnet R3 transaction sequence is not terminal success.'
Assert-RustEvidence ([int]$devnetFinal.terminal_proof.action_recorded_event_count -eq 1 -and [int]$devnetFinal.terminal_proof.new_capability_used_actions -eq 1 -and [long]$devnetFinal.terminal_proof.new_capability_last_action_nonce -eq 1 -and $devnetFinal.terminal_proof.prior_capability_active -eq $false) 'Devnet action event or capability transition proof is invalid.'
Assert-RustEvidence ([int]$devnetFinal.r3_public_devnet_transactions -eq 3 -and [int]$devnetFinal.verifier_network_mutations -eq 0 -and [int]$devnetFinal.real_fund_operations -eq 0) 'Devnet transaction cap, verifier mutation, or real-fund invariant failed.'
$devnetFinalSubjectsCurrent = $true
foreach ($devnetFinalPath in @($paths.devnet_verifier, $paths.devnet_guard_library, $paths.devnet_capability_decoder, $paths.abi_v2, $paths.wasm, $paths.devnet_r3_approval, $paths.devnet_r3_allow_log, $paths.devnet_r3_rotate_log, $paths.devnet_r3_record_log)) {
    $relative = $devnetFinalPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $property = $devnetFinal.artifact_sha256.PSObject.Properties[$relative]
    $devnetFinalSubjectsCurrent = $devnetFinalSubjectsCurrent -and $null -ne $property -and $property.Value -eq (Get-FileHash -LiteralPath $devnetFinalPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
Assert-RustEvidence $devnetFinalSubjectsCurrent 'Terminal Devnet Evidence Pack is stale relative to verifier, receipt, logs, ABI, or WASM.'

Assert-RustEvidence ($abiV1.contractVersion -eq '1.0.0') 'Accepted ABI v1 was replaced.'
Assert-RustEvidence (@($abiV1.endpoints).Count -eq 2) 'Accepted ABI v1 endpoint surface drifted.'
Assert-RustEvidence ($abiV2.buildInfo.contractCrate.version -eq '2.0.0-alpha.1') 'Generated ABI is not staged v2 alpha.'
Assert-RustEvidence ($abiV2.buildInfo.framework.version -eq '0.66.2') 'Generated ABI framework mismatch.'
$endpointNames = @($abiV2.endpoints.name)
foreach ($endpoint in @('registerCapability', 'revokeCapability', 'rotateCapability', 'recordAction', 'recordPrivateAction', 'getSigningMessage')) {
    Assert-RustEvidence ($endpoint -in $endpointNames) "Generated ABI endpoint missing: $endpoint"
}
$payableEndpoints = @($abiV2.endpoints | Where-Object {
    $payableProperty = $_.PSObject.Properties['payableInTokens']
    $null -ne $payableProperty -and @($payableProperty.Value).Count -gt 0
})
Assert-RustEvidence ($payableEndpoints.Count -eq 0) 'Generated ABI contains payable endpoints.'
Assert-RustEvidence (@($abiV2.events | Where-Object { $_.identifier -eq 'ActionRecorded' }).Count -eq 1) 'Generated ABI event mismatch.'
Assert-RustEvidence (@($imports).Count -gt 0 -and 'managedVerifyEd25519' -in @($imports)) 'WASM imports do not contain VM Ed25519 verification.'
Assert-RustEvidence ($mxsc.report.eiCheck.ok -eq $true -and $mxsc.report.eiCheck.eiVersion -eq '1.5') 'WASM EI version is not 1.5 or EI check failed.'
Assert-RustEvidence ($goVmPreflight.official_runner.verified -eq $true -and $goVmPreflight.official_runner.release -eq 'v5.1.0') 'Official GoVM runner artifact is not verified.'
Assert-RustEvidence ($goVmPreflight.scenarios.ready -eq $true) 'GoVM differential scenarios are not staged.'
Assert-RustEvidence ($wslEnable.status -eq 'PASS' -and $wslEnable.elevated -eq $true -and @($wslEnable.features | Where-Object { -not $_.success }).Count -eq 0) 'WSL prerequisite enablement evidence is invalid.'
Assert-RustEvidence ($goVmEvidence.status -eq 'PASS' -and $goVmEvidence.packet_completion.ready_for_independent_t0_review -eq $true) 'GoVM Evidence Pack is not ready for independent T0 review.'
Assert-RustEvidence ($goVmEvidence.differential.rust_vm -eq 'PASS_8_OF_8' -and $goVmEvidence.differential.go_vm -eq 'PASS_8_OF_8' -and $goVmEvidence.differential.identical_scenario_subjects -eq $true) 'RustVM/GoVM differential receipt mismatch.'
Assert-RustEvidence ($goVmEvidence.gas.status -eq 'PASS_ACTUAL_GOVM_1_5' -and $goVmGasEvidence.status -eq 'PASS') 'Actual GoVM gas evidence is absent.'
$budgetFunctions = @($goVmEvidence.gas.budget_summaries.function)
Assert-RustEvidence ('recordAction' -in $budgetFunctions -and 'recordPrivateAction' -in $budgetFunctions -and @($goVmEvidence.gas.budget_summaries | Where-Object { $_.recommended_gas_limit -gt 10000000 }).Count -eq 0) 'Action gas budgets are absent or exceed the staging cap.'
$goVmSubjectsCurrent = $goVmEvidence.runner.mxsc_sha256 -eq (Get-FileHash -LiteralPath $paths.mxsc -Algorithm SHA256).Hash.ToLowerInvariant() -and $goVmEvidence.runner.wasm_sha256 -eq (Get-FileHash -LiteralPath $paths.wasm -Algorithm SHA256).Hash.ToLowerInvariant() -and $goVmEvidence.runner.rust_evidence_sha256 -eq (Get-FileHash -LiteralPath $paths.rustvm_evidence -Algorithm SHA256).Hash.ToLowerInvariant() -and $goVmEvidence.gas.evidence_sha256 -eq (Get-FileHash -LiteralPath $paths.govm_gas_evidence -Algorithm SHA256).Hash.ToLowerInvariant()
foreach ($scenarioReceipt in @($goVmEvidence.scenarios)) {
    $scenarioPath = Join-Path $contractRoot ("scenarios\" + $scenarioReceipt.scenario)
    $goVmSubjectsCurrent = $goVmSubjectsCurrent -and (Test-Path -LiteralPath $scenarioPath) -and $scenarioReceipt.scenario_sha256 -eq (Get-FileHash -LiteralPath $scenarioPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
Assert-RustEvidence $goVmSubjectsCurrent 'GoVM evidence is stale relative to current scenarios, MXSC, WASM, or gas evidence.'

$llvmExpected = 'b9b68a4d276e16fa25802aaba458e4638f64b3884c290aaccdc2d87083b6ca35'
$llvmActual = if (Test-Path -LiteralPath $paths.llvm_archive) { (Get-FileHash -LiteralPath $paths.llvm_archive -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
Assert-RustEvidence ($llvmActual -eq $llvmExpected) 'LLVM-MinGW archive digest mismatch.'

$toolPath = (Join-Path $cargoHome 'bin') + ';' + $llvmBin + ';' + (Join-Path $llvmRoot 'x86_64-w64-mingw32\bin') + ';' + $env:PATH
$environment = @{
    RUSTUP_HOME = $rustupHome
    CARGO_HOME = $cargoHome
    RUSTUP_TOOLCHAIN = '1.88.0-x86_64-pc-windows-gnu'
    PATH = $toolPath
    CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = $paths.llvm_linker
    CC_x86_64_pc_windows_gnu = $paths.llvm_linker
    AR_x86_64_pc_windows_gnu = (Join-Path $llvmBin 'x86_64-w64-mingw32-ar.exe')
}

$check = Invoke-BoundedTool $cargo @('check', '--workspace', '--all-targets', '--locked') $contractRoot $environment
Assert-RustEvidence ($check.exit_code -eq 0) "cargo check failed: $($check.stderr)"
Assert-RustEvidence (($check.stdout + $check.stderr) -notmatch '(?i)warning:') 'cargo check emitted warnings.'

$rustVm = Invoke-BoundedTool $cargo @('test', '-p', 'nexus-actions', '--test', 'nexus_actions_scenario_rs_test', '--locked', '--', '--test-threads=1') $contractRoot $environment
Assert-RustEvidence ($rustVm.exit_code -eq 0) "RustVM tests failed: $($rustVm.stderr)"
Assert-RustEvidence (($rustVm.stdout + $rustVm.stderr) -match '10 passed; 0 failed') 'RustVM receipt does not show 10/10 PASS.'

$gasParserValidation = Invoke-BoundedTool 'powershell.exe' @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $paths.govm_gas_parser_validator,
    '-ExecutorRole', $ExecutorRole
) $repoRoot @{} 30000
Assert-RustEvidence ($gasParserValidation.exit_code -eq 0 -and ($gasParserValidation.stdout -match '"status"\s*:\s*"PASS"')) "GoVM gas parser validation failed: $($gasParserValidation.stderr)"

$wasmBefore = if (Test-Path -LiteralPath $paths.wasm) { (Get-FileHash -LiteralPath $paths.wasm -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
$build = Invoke-BoundedTool $cargo @('run', '--locked', '--', '--no-abi-git-version', 'build', '--locked', '--codehash') (Join-Path $contractRoot 'meta') $environment
Assert-RustEvidence ($build.exit_code -eq 0) "Locked sc-meta build failed: $($build.stderr)"
$wasmAfter = if (Test-Path -LiteralPath $paths.wasm) { (Get-FileHash -LiteralPath $paths.wasm -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
Assert-RustEvidence ($wasmBefore -eq $wasmAfter -and $wasmAfter.Length -eq 64) 'Locked WASM build is not reproducible.'
$wasmBytes = if (Test-Path -LiteralPath $paths.wasm) { (Get-Item -LiteralPath $paths.wasm).Length } else { 0 }
Assert-RustEvidence ($wasmBytes -gt 0 -and $wasmBytes -lt 64KB) 'WASM size is empty or exceeds the staging cap.'

$artifactHashes = [ordered]@{}
foreach ($path in @(
    $paths.manifest, $paths.lock, $paths.source, $paths.meta_manifest, $paths.meta_source,
    $paths.wasm_manifest, $paths.wasm_lock, $paths.tests, $paths.abi_v2, $paths.wasm,
    $paths.mxsc, $paths.imports, $paths.codehash, $paths.proxy, $paths.scenario_replay,
    $paths.scenario_private, $paths.scenario_private_success, $paths.scenario_pause,
    $paths.scenario_revoked, $paths.scenario_rotation, $paths.scenario_relayer, $paths.scenario_batch,
    $paths.abi_v1, $paths.compatibility,
    $paths.checkpoint, $paths.govm_preflight_validator, $paths.govm_preflight_evidence,
    $paths.govm_gas_parser, $paths.govm_gas_parser_validator, $paths.govm_gas_fixture,
    $paths.wsl_enable_script, $paths.wsl_enable_evidence,
    $paths.govm_runner, $paths.govm_evidence, $paths.govm_gas_evidence,
    $paths.rustvm_validator, $paths.rustvm_evidence, $paths.fuzz_validator, $paths.fuzz_evidence, $paths.fuzz_source, $paths.chain_api_source,
    $paths.devnet_runner, $paths.devnet_payload_builder, $paths.devnet_payload_test, $paths.devnet_runner_test,
    $paths.devnet_approval_validator, $paths.devnet_capability_decoder, $paths.devnet_guard_library, $paths.devnet_guard_test,
    $paths.devnet_preflight_evidence, $paths.devnet_verifier, $paths.devnet_final_evidence,
    $paths.devnet_r3_approval, $paths.devnet_r3_allow_log, $paths.devnet_r3_rotate_log, $paths.devnet_r3_record_log,
    $PSCommandPath
)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$subjectLines = $artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $subject = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($subjectLines -join "`n")))).Replace('-', '').ToLowerInvariant()
} finally {
    $sha.Dispose()
}

$resolvedEvidenceParent = [IO.Path]::GetFullPath((Split-Path -Parent $EvidencePath))
$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
Assert-RustEvidence ($resolvedEvidenceParent -eq $allowedEvidenceParent) 'EvidencePath must stay in planning/evidence.'

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'compiled_multiversx_rust_contract_wasm_and_rustvm_scenarios'
    assertions = $assertions
    failures = @($failures)
    acceptance = [ordered]@{
        rust_compile = if ($check.exit_code -eq 0) { 'PASS' } else { 'FAIL' }
        sc_meta_abi = 'PASS'
        locked_wasm_build = if ($build.exit_code -eq 0) { 'PASS' } else { 'FAIL' }
        wasm_reproducible = if ($wasmBefore -eq $wasmAfter) { 'PASS' } else { 'FAIL' }
        rust_vm_tests = if ($rustVm.exit_code -eq 0) { 'PASS_10_OF_10' } else { 'FAIL' }
        rust_vm_differential_scenarios = 'PASS_8_OF_8'
        govm_gas_trace_parser = if ($gasParserValidation.exit_code -eq 0) { 'PASS_9_ASSERTIONS' } else { 'FAIL' }
        go_vm_differential_scenarios = 'PASS_8_OF_8'
        deterministic_fuzz_corpus = 'PASS_4096_OF_4096'
        actual_go_vm_gas = 'PASS'
        real_ed25519_vm_verification = 'PASS'
        v1_baseline_preserved_v2_staged = 'PASS'
        devnet_terminal_action = 'PASS_R3_FINALIZED_ACTION_RECORDED'
    }
    build = [ordered]@{
        rustc = '1.88.0'
        framework = '0.66.2'
        ei_version = [string]$mxsc.report.eiCheck.eiVersion
        wasm_bytes = $wasmBytes
        wasm_sha256 = $wasmAfter
        codehash = (Read-Utf8 $paths.codehash).Trim()
        llvm_mingw_release = '20260616-ucrt-x86_64'
        llvm_mingw_sha256 = $llvmActual
    }
    packet_completion = [ordered]@{
        ready = $false
        ready_for_independent_t0_review = $true
        reason = 'INDEPENDENT_T0_REVIEW_PENDING'
    }
    claims_excluded = @('mainnet_readiness', 'production_security_audit')
    external_gates = [ordered]@{
        go_vm_artifact = 'PASS_VERIFIED_V5_1_0'
        linux_runtime = 'PASS_WSL_2_7_11_UBUNTU_24_04'
        go_vm_differential = 'PASS_8_OF_8'
        actual_vm_gas = 'PASS_GOVM_1_5_SNAPSHOT'
        gas_trace_parser = 'PASS_READY_FOR_ACTUAL_LOGS'
        devnet_payload_preflight = 'PASS_27_OF_27'
        devnet_terminal_action = 'PASS_R3_HYPERBLOCK_FINAL_ACTION_RECORDED'
        independent_t0_review = 'PENDING_AFTER_DIFFERENTIAL'
        production_enablement = 'BLOCKED'
    }
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    subject_sha256 = $subject
    artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}

$json = $result | ConvertTo-Json -Depth 10
if ($failures.Count -eq 0) {
    [IO.Directory]::CreateDirectory($resolvedEvidenceParent) | Out-Null
    [IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}
$json
if ($failures.Count -gt 0) { exit 1 }
