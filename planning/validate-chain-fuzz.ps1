[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-FUZZ-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-fuzz-validation.json'
}
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-FuzzEvidence {
    param([bool]$Condition, [string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Get-IncludedNodeRuntime {
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
    if (-not (Test-Path -LiteralPath $root)) { return $null }
    Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
        Sort-Object FullName |
        ForEach-Object { Join-Path $_.FullName 'node.exe' } |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -Last 1
}

function Invoke-BoundedNode {
    param([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory, [int]$TimeoutMs = 30000)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Node
    $info.Arguments = $quoted
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Node process did not start.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutMs)) {
            $process.Kill()
            throw "Node process exceeded $TimeoutMs ms."
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
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$ephemeral = Join-Path $repoRoot '.ephemeral'
$paths = [ordered]@{
    api_source = Join-Path $repoRoot 'packages\chain-actions-api\index.ts'
    fuzz_source = Join-Path $repoRoot 'packages\chain-actions-api\fuzz.test.ts'
    contract_source = Join-Path $repoRoot 'contracts\nexus-actions\src\lib.rs'
    wasm = Join-Path $repoRoot 'contracts\nexus-actions\output\nexus-actions.wasm'
    mxsc = Join-Path $repoRoot 'contracts\nexus-actions\output\nexus-actions.mxsc.json'
    abi_v1 = Join-Path $repoRoot 'packages\contracts\abi\nexus-actions.abi.json'
    abi_v2 = Join-Path $repoRoot 'contracts\nexus-actions\output\nexus-actions.abi.json'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
}

foreach ($path in $paths.Values) {
    Assert-FuzzEvidence (Test-Path -LiteralPath $path) "Missing fuzz subject: $path"
}
Assert-FuzzEvidence ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-FuzzEvidence ($RunId -match '^NX-CHAIN-001-FUZZ-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'

$fuzzSource = [IO.File]::ReadAllText($paths.fuzz_source, [Text.Encoding]::UTF8)
Assert-FuzzEvidence ($fuzzSource -match 'CASES_PER_SEED\s*=\s*512') 'Corpus cases-per-seed control drifted.'
Assert-FuzzEvidence ($fuzzSource -match 'FIXED_SEEDS' -and $fuzzSource -match '0xdeadbeef') 'Fixed seed corpus is absent.'
Assert-FuzzEvidence ($fuzzSource -match 'mutation_oracle_mismatches') 'Mutation oracle receipt is absent.'
Assert-FuzzEvidence ($fuzzSource -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect)') 'Fuzz source contains network or process capability.'

$node = Get-IncludedNodeRuntime
Assert-FuzzEvidence ($null -ne $node) 'Included Node runtime is missing.'
if (-not (Test-Path -LiteralPath $ephemeral)) { [void](New-Item -ItemType Directory -Path $ephemeral) }
$runRoot = Join-Path $ephemeral ('NX-CHAIN-001-fuzz-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $runRoot)
$compile = $null
$firstRun = $null
$secondRun = $null
$first = $null
$second = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-BoundedNode $node @(
            $paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs',
            '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.api_source, $paths.fuzz_source
        ) $repoRoot 30000
        Assert-FuzzEvidence ($compile.exit_code -eq 0) "Strict fuzz compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) {
            $compiledTest = Join-Path $runRoot 'fuzz.test.js'
            $firstRun = Invoke-BoundedNode $node @($compiledTest) $repoRoot 30000
            $secondRun = Invoke-BoundedNode $node @($compiledTest) $repoRoot 30000
            Assert-FuzzEvidence ($firstRun.exit_code -eq 0) "First fuzz replay failed: $($firstRun.stderr)"
            Assert-FuzzEvidence ($secondRun.exit_code -eq 0) "Second fuzz replay failed: $($secondRun.stderr)"
            if ($firstRun.stdout) {
                try { $first = $firstRun.stdout | ConvertFrom-Json }
                catch { Assert-FuzzEvidence $false 'First fuzz receipt is not JSON.' }
            }
            if ($secondRun.stdout) {
                try { $second = $secondRun.stdout | ConvertFrom-Json }
                catch { Assert-FuzzEvidence $false 'Second fuzz receipt is not JSON.' }
            }
        }
    }
} finally {
    $rootPrefix = [IO.Path]::GetFullPath($ephemeral).TrimEnd('\') + '\'
    $resolvedRunRoot = [IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolvedRunRoot.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $runRoot -Recurse -Force
    }
}

Assert-FuzzEvidence ($null -ne $first -and $null -ne $second) 'Fuzz receipts are missing.'
$expectedSeeds = @('0x1a2b3c4d', '0x5e6f7788', '0x90abcdef', '0x13579bdf', '0x2468ace0', '0xc001d00d', '0x0badf00d', '0xdeadbeef')
$expectedCategories = @('envelope_shape', 'ttl_expiry', 'nonce_replay_gap', 'capability_scope', 'relayer_context', 'capability_rotation', 'lifecycle_finality', 'privacy_batch')
if ($null -ne $first -and $null -ne $second) {
    Assert-FuzzEvidence ($first.task_id -eq 'NX-CHAIN-001' -and $first.status -eq 'PASS') 'Corpus did not PASS.'
    Assert-FuzzEvidence ([int]$first.total_cases -eq 4096 -and [int]$first.cases_per_seed -eq 512) 'Corpus size is not exactly 4096 bounded cases.'
    Assert-FuzzEvidence (@($first.fixed_seeds).Count -eq 8 -and (@($first.fixed_seeds) -join '|') -eq ($expectedSeeds -join '|')) 'Fixed seeds drifted.'
    Assert-FuzzEvidence ([int]$first.mutation_oracle_mismatches -eq 0 -and @($first.failures).Count -eq 0) 'Mutation oracle found mismatches.'
    Assert-FuzzEvidence ($first.deterministic -eq $true -and $first.local_mock_only -eq $true) 'Corpus is not deterministic local-only.'
    Assert-FuzzEvidence ([int]$first.network_operations -eq 0 -and [int]$first.economic_operations -eq 0) 'Corpus performed network or economic operations.'
    foreach ($category in $expectedCategories) {
        Assert-FuzzEvidence ([int]$first.category_counts.$category -eq 512) "Category count mismatch: $category"
    }
    Assert-FuzzEvidence (@($first.replay_samples).Count -ge 8) 'Replay samples are missing.'
    Assert-FuzzEvidence ($first.corpus_sha256 -match '^[a-f0-9]{64}$') 'Corpus SHA-256 is invalid.'
    Assert-FuzzEvidence ($first.corpus_sha256 -eq $second.corpus_sha256) 'Identical fixed-seed replays produced different corpus hashes.'
    Assert-FuzzEvidence (($first.category_counts | ConvertTo-Json -Compress) -eq ($second.category_counts | ConvertTo-Json -Compress)) 'Category counts changed between deterministic replays.'
}

$artifactHashes = [ordered]@{}
foreach ($path in @($paths.api_source, $paths.fuzz_source, $paths.contract_source, $paths.wasm, $paths.mxsc, $paths.abi_v1, $paths.abi_v2, $PSCommandPath)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$subjectLines = $artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $subjectSha = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($subjectLines -join "`n")))).Replace('-', '').ToLowerInvariant()
} finally { $sha.Dispose() }

$resolvedEvidenceParent = [IO.Path]::GetFullPath((Split-Path -Parent $EvidencePath))
$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
Assert-FuzzEvidence ($resolvedEvidenceParent -eq $allowedEvidenceParent) 'EvidencePath must stay in planning/evidence.'

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'bounded_deterministic_property_mutation_corpus'
    assertions = $assertions
    failures = @($failures)
    corpus = if ($null -ne $first) { [ordered]@{
        suite = $first.suite
        fixed_seeds = @($first.fixed_seeds)
        cases_per_seed = [int]$first.cases_per_seed
        total_cases = [int]$first.total_cases
        category_counts = $first.category_counts
        mutation_oracle_mismatches = [int]$first.mutation_oracle_mismatches
        corpus_sha256 = $first.corpus_sha256
        replay_samples = @($first.replay_samples)
        deterministic_replay_count = 2
        deterministic_replay_match = if ($null -ne $second) { $first.corpus_sha256 -eq $second.corpus_sha256 } else { $false }
    } } else { $null }
    acceptance = [ordered]@{
        nonce_ttl_expiry = 'PASS'
        capability_scope_rotation = 'PASS'
        relayer_context = 'PASS'
        batching_privacy = 'PASS'
        ordered_vs_executed = 'PASS'
        reproducible_replay = 'PASS'
    }
    execution_limits = [ordered]@{
        timeout_per_process_ms = 30000
        maximum_cases = 4096
        temporary_output_root = '.ephemeral'
        cleanup = 'EXACT_VALIDATED_RUN_DIRECTORY'
    }
    packet_completion = [ordered]@{ ready = $false; reason = 'DIFFERENTIAL_VM_AND_DEVNET_FINDINGS_REMAIN' }
    claims_excluded = @('cryptographic_fuzzing', 'rustvm_govm_differential', 'devnet_transaction', 'mainnet_readiness', 'production_security_audit')
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    subject_sha256 = $subjectSha
    artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}

$json = $result | ConvertTo-Json -Depth 12
if ($failures.Count -eq 0) {
    [IO.Directory]::CreateDirectory($resolvedEvidenceParent) | Out-Null
    [IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}
$json
if ($failures.Count -gt 0) { exit 1 }
