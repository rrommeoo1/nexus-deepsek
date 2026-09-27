[CmdletBinding()]
param(
    [string]$RunId = ('NX-QA-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'C01', 'C11', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Qa { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
function Read-Utf8 { param([string]$Path) [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) } finally { $sha.Dispose() }
    ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}
function Get-IncludedNodeRuntime {
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
    if (-not (Test-Path -LiteralPath $root)) { return $null }
    Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
}
function Invoke-LocalNode {
    param([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Node; $info.Arguments = $quoted; $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Node process did not start.' }
        $stdout = $process.StandardOutput.ReadToEnd(); $stderr = $process.StandardError.ReadToEnd()
        if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Node process exceeded 30 seconds.' }
        [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4) }
    } finally { $process.Dispose() }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
    source = Join-Path $repoRoot 'packages\qa-fabric\api\index.ts'
    tests = Join-Path $repoRoot 'packages\qa-fabric\api\index.test.ts'
    contract = Join-Path $repoRoot 'packages\qa-fabric\api\quality-contract.v1.json'
    backlog = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    quality = Join-Path $PSScriptRoot 'quality-scorecard.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-QA-001.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    guard = Join-Path $PSScriptRoot 'zero-cost-child-test.ps1'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    assurance_doc = Join-Path $repoRoot 'docs\16-agent-delivery-continuous-assurance.md'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Qa (Test-Path -LiteralPath $path -PathType Leaf) "Missing artifact: $path" }
Assert-Qa ($RunId -match '^NX-QA-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Qa ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$contract = Read-Utf8 $paths.contract | ConvertFrom-Json
$backlog = Read-Utf8 $paths.backlog
$capacity = Read-Utf8 $paths.capacity
$quality = Read-Utf8 $paths.quality
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json

$task = [regex]::Match($backlog, '(?ms)^  - task_id:\s*NX-QA-001\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Qa $task.Success 'NX-QA-001 is missing from backlog.'
if ($task.Success) {
    Assert-Qa ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*C01\s*$') 'Owner is not C01.'
    Assert-Qa ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'
    Assert-Qa ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T1\s*$') 'Packet is not T1.'
    foreach ($item in @('test_harness', 'fixtures', 'quality_scorecard')) { Assert-Qa ($task.Groups[1].Value.Contains($item)) "Missing changed contract: $item" }
}
Assert-Qa ($capacity -match '(?m)^\s+active_packets:\s+1\s*$') 'WIP limit is not one.'
Assert-Qa ($capacity -match '(?m)^\s+active_task_id:\s+NX-QA-001\s*$') 'Capacity active task mismatch.'
Assert-Qa ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'

Assert-Qa ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.0.0' -and $contract.owner -eq 'C01') 'Quality contract identity mismatch.'
Assert-Qa ($contract.executionMode -eq 'local_mock_only') 'Execution mode must be local_mock_only.'
Assert-Qa (($contract.taxonomy -join '|') -eq 'UNIT|CONTRACT|INTEGRATION|E2E') 'Test taxonomy is incomplete.'
Assert-Qa (($contract.e2ePath -join '|') -eq 'CLIENT|API|OUTBOX|WORKER') 'Cross-layer path is incomplete.'
Assert-Qa (-not [bool]$contract.flakePolicy.releaseCriticalQuarantineAllowed -and $contract.flakePolicy.promotionOnCriticalFailure -eq 'deny') 'Critical flake policy is not fail closed.'
Assert-Qa ([int]$contract.flakePolicy.normalQuarantineMaxDays -eq 7) 'Normal quarantine window is not bounded.'
Assert-Qa ($contract.syntheticActorPolicy.requiredTrafficClass -eq 'SYSTEM_TEST' -and $contract.syntheticActorPolicy.requiredWalletMode -eq 'FIXTURE_ONLY') 'Synthetic actor classification is incomplete.'
foreach ($property in @('payoutAllowed', 'organicMetricsAllowed', 'reputationAllowed', 'reviewsAllowed')) { Assert-Qa (-not [bool]$contract.syntheticActorPolicy.$property) "Synthetic effect became allowed: $property" }
Assert-Qa ([int]$contract.limits.networkOperationsMax -eq 0 -and [int]$contract.limits.externalProcessOperationsMax -eq 0 -and [int]$contract.limits.incrementalCostEurMax -eq 0) 'Resource boundary is not zero-effect.'
foreach ($field in @('testCaseId', 'requirementId', 'artifactPath', 'owner', 'traceId', 'artifactHash', 'outcome')) { Assert-Qa ($field -in @($contract.evidenceRequired)) "Missing evidence field: $field" }
foreach ($property in @('artifactMustResolve', 'artifactHashMustMatch', 'requirementIdMustExist', 'ownerMustMatch')) { Assert-Qa ([bool]$contract.requirementBinding.$property) "Requirement binding disabled: $property" }
foreach ($property in @('requestIdUnique', 'workerOutcomeCoupledToCompletion', 'freshInstanceReplayDenied', 'crashBeforeCommitResumable', 'crashAfterCommitReplayDenied')) { Assert-Qa ([bool]$contract.idempotencyPolicy.$property) "Idempotency control disabled: $property" }

foreach ($fragment in @('CRITICAL_QUARANTINE_FORBIDDEN', 'SYSTEM_TEST_EFFECT_FORBIDDEN', 'REQUEST_REPLAY', 'REQUIREMENT_OWNER_MISMATCH', 'REQUIREMENT_ARTIFACT_NOT_FOUND', 'REQUIREMENT_ARTIFACT_HASH_MISMATCH', 'REQUIREMENT_ID_NOT_FOUND', 'DurableIdempotencyFixture', 'SIMULATED_CRASH_BEFORE_WORKER_COMMIT', 'SIMULATED_CRASH_AFTER_WORKER_COMMIT', 'promotionDecision', 'buildFailureEvidence', 'artifactHash: validated.requirement.artifactHash', 'outcome: "FAIL"', 'workerExecutions: 1')) { Assert-Qa ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('client API outbox worker E2E has four stages', 'trace ID crosses client API outbox and worker', 'critical flake blocks promotion', 'synthetic tests cannot create payout', 'failure links to normative artifact', 'failure binds artifact hash and explicit outcome', 'normal quarantine is inactive at expiry', 'crash before worker commit resumes to one committed execution', 'crash after worker commit remains exactly once across fresh instance')) { Assert-Qa ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Qa ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.)') 'QA runtime package can perform network/process operations.'
Assert-Qa ($quality -match '(?m)^\s+observed_flakes:\s*0\s*$') 'Quality scorecard reports unresolved flakes.'
Assert-Qa ($quality -match '(?m)^\s+release_critical_quarantine_allowed:\s*false\s*$') 'Quality scorecard permits critical quarantine.'
Assert-Qa ($quality -match '(?m)^\s+economic_effect_micros:\s*0\s*$' -and $quality -match '(?m)^\s+organic_metric_effect:\s*0\s*$') 'Quality scorecard synthetic isolation drifted.'
Assert-Qa ($quality -match '(?m)^\s+requirement_artifact_binding:\s*verified_by_hash\s*$' -and $quality -match '(?m)^\s+inactive_at_expiry:\s*true\s*$') 'Remediated evidence or quarantine status is missing.'
Assert-Qa ($quality -match '(?m)^\s+fresh_instance_replay_denied:\s*true\s*$' -and $quality -match '(?m)^\s+crash_after_worker_commit_replay_denied:\s*true\s*$') 'Durable idempotency scorecard is incomplete.'

Assert-Qa ($capEvidence.status -eq 'PASS') 'Capacity evidence is not PASS.'
Assert-Qa ([int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Qa ($capEvidence.artifact_sha256.'planning/spend-control.yaml' -eq (Get-Sha256 $paths.spend)) 'Spend policy drifted after capacity evidence.'
Assert-Qa ($capEvidence.artifact_sha256.'planning/zero-cost-child-test.ps1' -eq (Get-Sha256 $paths.guard)) 'Runtime guard drifted after capacity evidence.'
Assert-Qa ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Qa ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime
Assert-Qa ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'
if (-not (Test-Path -LiteralPath $ephemeralRoot)) { [void](New-Item -ItemType Directory -Path $ephemeralRoot) }
$runRoot = Join-Path $ephemeralRoot ('NX-QA-001-validator-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $runRoot)
$compile = $null; $testRuns = @(); $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot
        Assert-Qa ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) {
            1..3 | ForEach-Object { $script:testRuns += Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot }
            foreach ($run in $testRuns) { Assert-Qa ($run.exit_code -eq 0) "QA tests failed: $($run.stderr)" }
            Assert-Qa (@($testRuns.stdout | Sort-Object -Unique).Count -eq 1) 'Deterministic repetitions produced different receipts.'
            try { $testReceipt = $testRuns[0].stdout | ConvertFrom-Json } catch { Assert-Qa $false 'Test receipt is not JSON.' }
        }
        $items = @(
            [pscustomobject]@{ id = 'packages/qa-fabric/api/index.ts'; sourceContext = 'qa_fabric'; text = $source },
            [pscustomobject]@{ id = 'packages/qa-fabric/api/index.test.ts'; sourceContext = 'qa_fabric'; text = $tests }
        )
        $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{}; knownSchemas = @('qa_fabric'); contexts = [pscustomobject]@{ qa_fabric = [pscustomobject]@{ allowedImports = @() } }; items = $items }
        $manifestPath = Join-Path $runRoot 'boundary.json'
        [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
        $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot
        Assert-Qa ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"
        if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally {
    $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'
    $resolved = [IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force }
}

Assert-Qa ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) {
    Assert-Qa ($testReceipt.task_id -eq 'NX-QA-001' -and $testReceipt.status -eq 'PASS') 'Test receipt did not PASS.'
    Assert-Qa ([int]$testReceipt.assertions -ge 61) 'Scenario assertions regressed below 61.'
    Assert-Qa (($testReceipt.e2e.process_path -join '|') -eq 'CLIENT|API|OUTBOX|WORKER' -and [bool]$testReceipt.e2e.one_trace_id -and [int]$testReceipt.e2e.worker_executions -eq 1) 'Cross-layer E2E failed.'
    Assert-Qa ([bool]$testReceipt.flake.release_critical_promotion_blocked -and [bool]$testReceipt.flake.release_critical_quarantine_forbidden) 'Flake gate failed.'
    Assert-Qa ([int]$testReceipt.flake.expired_normal_quarantines_active -eq 0) 'Expired normal quarantine remains active.'
    Assert-Qa ([bool]$testReceipt.evidence_binding.artifact_hash_present -and [bool]$testReceipt.evidence_binding.outcome_present -and [bool]$testReceipt.evidence_binding.nonexistent_artifact_denied -and [bool]$testReceipt.evidence_binding.stale_hash_denied -and [bool]$testReceipt.evidence_binding.missing_requirement_denied) 'Requirement artifact binding failed.'
    Assert-Qa ([bool]$testReceipt.idempotency.cross_instance_replay_denied -and [bool]$testReceipt.idempotency.crash_before_resumed_once -and [bool]$testReceipt.idempotency.crash_after_replay_denied) 'Cross-instance idempotency failed.'
    Assert-Qa ($testReceipt.synthetic_isolation.actor_class -eq 'SYSTEM_TEST' -and [bool]$testReceipt.synthetic_isolation.fixture_wallet_only) 'Synthetic actor is not isolated.'
    Assert-Qa ([int]$testReceipt.synthetic_isolation.economic_effect_micros -eq 0 -and [int]$testReceipt.synthetic_isolation.organic_metric_effect -eq 0 -and [int]$testReceipt.synthetic_isolation.reputation_effect -eq 0 -and [int]$testReceipt.synthetic_isolation.review_effect -eq 0) 'Synthetic effects are non-zero.'
    Assert-Qa ([int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.external_process_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0) 'Test scope escaped local zero-effect mode.'
}
$boundaryFindings = @()
if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }
Assert-Qa ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = Get-Sha256 $path
}
$subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
    schema_version = 1; task_id = 'NX-QA-001'; run_id = $RunId; executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'local_synthetic_test_fabric_and_first_cross_layer_e2e'
    assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; deterministic_repetitions = @($testRuns).Count
    failures = @($failures)
    acceptance = if ($null -ne $testReceipt) { [ordered]@{ e2e = $testReceipt.e2e; flake = $testReceipt.flake; evidence_binding = $testReceipt.evidence_binding; idempotency = $testReceipt.idempotency; synthetic_isolation = $testReceipt.synthetic_isolation } } else { $null }
    source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count
    network_operations = 0; economic_operations = 0; external_provider_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    claims_excluded = @('production_load', 'device_farm', 'managed_provider_integration', 'production_data', 'production_distributed_exactly_once')
    review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
