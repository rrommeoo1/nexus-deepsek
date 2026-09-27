[CmdletBinding()]
param(
    [string]$RunId = ('NX-ECON-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A43', 'A20', 'A16', 'A32', 'C03', 'C05', 'C08', 'C10')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Econ { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
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
    source = Join-Path $repoRoot 'packages\economics\api\index.ts'
    tests = Join-Path $repoRoot 'packages\economics\api\index.test.ts'
    contract = Join-Path $repoRoot 'packages\economics\api\economic-contract.v1.json'
    economics_doc = Join-Path $repoRoot 'docs\18-creator-node-adult-economy.md'
    payments_doc = Join-Path $repoRoot 'docs\19-username-payments.md'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog_p0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    backlog_p1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
    capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    progress = Join-Path $PSScriptRoot 'product-progress.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-ECON-P01.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    guard = Join-Path $PSScriptRoot 'zero-cost-child-test.ps1'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Econ (Test-Path -LiteralPath $path -PathType Leaf) "Missing artifact: $path" }
Assert-Econ ($RunId -match '^NX-ECON-P01-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Econ ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$contract = Read-Utf8 $paths.contract | ConvertFrom-Json
$economicsDoc = Read-Utf8 $paths.economics_doc
$paymentsDoc = Read-Utf8 $paths.payments_doc
$architecture = Read-Utf8 $paths.architecture
$backlogP0 = Read-Utf8 $paths.backlog_p0
$backlogP1 = Read-Utf8 $paths.backlog_p1
$capacity = Read-Utf8 $paths.capacity
$progress = Read-Utf8 $paths.progress
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json

$task = [regex]::Match($backlogP1, '(?ms)^  - task_id:\s*NX-ECON-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Econ $task.Success 'NX-ECON-P01 is missing from P1 backlog.'
if ($task.Success) {
    Assert-Econ ($task.Groups[1].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$') 'NX-ECON-P01 is not a task packet.'
    Assert-Econ ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A43\s*$') 'Owner is not A43.'
    Assert-Econ ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'
    Assert-Econ ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Packet is not T0.'
    foreach ($dependency in @('NX-QA-001', 'NX-CHAIN-001', 'NX-CHAIN-002', 'NX-OBS-001')) { Assert-Econ ($task.Groups[1].Value.Contains($dependency)) "Missing dependency: $dependency" }
}
foreach ($dependency in @('NX-QA-001', 'NX-CHAIN-001', 'NX-CHAIN-002', 'NX-OBS-001')) {
    $record = [regex]::Match($backlogP0, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
    Assert-Econ ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "Dependency not done: $dependency"
}
$allIds = @([regex]::Matches(($backlogP0 + "`n" + $backlogP1), '(?m)^\s*- task_id:\s*(\S+)\s*$') | ForEach-Object { $_.Groups[1].Value })
Assert-Econ (@($allIds | Group-Object | Where-Object Count -gt 1).Count -eq 0) 'Duplicate task IDs exist.'
$activePackets = @([regex]::Matches($backlogP1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object { $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$' } | ForEach-Object { $_.Groups[1].Value })
Assert-Econ ($activePackets.Count -eq 1 -and $activePackets[0] -eq 'NX-ECON-P01') 'WIP one active task packet is violated.'
Assert-Econ ($capacity -match '(?m)^\s+active_packets:\s+1\s*$' -and $capacity -match '(?m)^\s+active_task_id:\s+NX-ECON-P01\s*$') 'Capacity active task mismatch.'
Assert-Econ ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'
Assert-Econ ($progress -match '(?m)^\s+active_packet_id:\s+NX-ECON-P01\s*$') 'Progress active packet mismatch.'

Assert-Econ ($architecture -match '(?ms)^  - id:\s*economics\s*\r?\n.*?^\s+owner:\s*A43\s*$') 'Economics context owner missing.'
Assert-Econ ($architecture -match '(?ms)^  - id:\s*economics\s*\r?\n.*?^\s+public_api_path:\s*packages/economics/api\s*$') 'Economics public API path missing.'
Assert-Econ ($architecture -match '(?ms)^  - id:\s*economics\s*\r?\n.*?^\s+data_access:\s*\[FINANCIAL, TELEMETRY_REDACTED\]\s*$') 'Economics data boundary mismatch.'

Assert-Econ ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.0.0' -and $contract.owner -eq 'A43') 'Economic contract identity mismatch.'
Assert-Econ (-not [bool]$contract.transferableNexusToken) 'Transferable Nexus token became enabled.'
Assert-Econ ([int]$contract.creatorPool.eligibleNetRevenueBps -eq 1500 -and [int]$contract.creatorPool.perCreatorClaimCapBps -eq 500) 'Creator pool caps drifted.'
Assert-Econ (-not [bool]$contract.creatorPool.fixedPayoutPerLike -and -not [bool]$contract.creatorPool.fixedPayoutPerComment) 'Raw like/comment payout became enabled.'
Assert-Econ ([int]$contract.nodePool.eligibleNetRevenueBps -eq 1000 -and [bool]$contract.nodePool.proofOfUsefulServiceRequired -and [int]$contract.nodePool.ownerClusterCapBpsFromEightNodes -eq 1500) 'Node pool controls drifted.'
Assert-Econ ([int]$contract.gasSponsorship.targetNetRevenueBps -eq 500 -and [int]$contract.gasSponsorship.hardCapNetRevenueBps -eq 800 -and $contract.gasSponsorship.budgetExhaustedFreeActionState -eq 'PENDING_SPONSORSHIP') 'Gas sponsorship policy drifted.'
foreach ($kind in @('CORE_TIP', 'CORE_SUBSCRIPTION', 'PRIVE')) {
    $split = $contract.supportSplitsBps.$kind
    Assert-Econ (([int]$split.creator + [int]$split.platform + [int]$split.safetyReserve + [int]$split.infrastructure) -eq 10000) "Split not conservative: $kind"
}
Assert-Econ ([int]$contract.rankingSeparation.paidSupportToOrganicWeight -eq 0 -and [int]$contract.rankingSeparation.promotedToOrganicWeight -eq 0 -and [int]$contract.rankingSeparation.systemTestToOrganicWeight -eq 0) 'Ranking separation drifted.'
Assert-Econ ($contract.adultSurface.distribution -eq 'WEB_SEPARATE' -and $contract.adultSurface.countryDefault -eq 'DENY' -and -not [bool]$contract.adultSurface.publicIpfsAllowed) 'Adult surface gate drifted.'
Assert-Econ ($contract.runtimeInputMode -eq 'EXACT_SHAPE_FAIL_CLOSED' -and [bool]$contract.configuration.canonicalDeepImmutable -and [bool]$contract.configuration.hashContentAllowlisted -and [bool]$contract.configuration.activeWindowRequiredAtEveryCalculation) 'Runtime/config boundary drifted.'
Assert-Econ ([bool]$contract.creatorPool.verifiedPrincipalRequired -and [int]$contract.creatorPool.qualificationCapsQeu.perSupporter -eq 100 -and [int]$contract.creatorPool.qualificationCapsQeu.perDeviceCluster -eq 250 -and [int]$contract.creatorPool.qualificationCapsQeu.perWalletCluster -eq 200) 'Creator anti-Sybil controls drifted.'
Assert-Econ ([bool]$contract.nodePool.signedServiceReceiptRequired -and @($contract.nodePool.aggregateCapKeys).Count -eq 2) 'Node attestation controls drifted.'
Assert-Econ ([bool]$contract.gasSponsorship.deriveLimitsInsidePolicy -and [bool]$contract.gasSponsorship.zeroRevenueRequiresExplicitAcquisitionBudget -and $contract.gasSponsorship.unknownPriority -eq 'DENY') 'Authenticated gas-budget controls drifted.'
Assert-Econ ([bool]$contract.adultSurface.signedCapabilityRequiredPerQuoteAndSettlement -and @($contract.adultSurface.requiredGates).Count -eq 9 -and @($contract.adultSurface.capabilityBindings).Count -eq 6) 'Executable adult gate contract drifted.'
Assert-Econ ([bool]$contract.deductions.receiptRequired -and [bool]$contract.deductions.freezeOnlyDisputedAmount -and $contract.settlementClaims.replay -eq 'DENY' -and [bool]$contract.settlementClaims.atomicConsumeBeforePayout) 'Deduction or settlement controls drifted.'

foreach ($fragment in @('PENDING_SPONSORSHIP', 'SYSTEM_TEST', 'CreatorPool = min', 'Proof of useful service', 'Nexus Priv', 'Country Capability Matrix')) { Assert-Econ ($economicsDoc.Contains($fragment)) "Economics specification missing: $fragment" }
foreach ($fragment in @('MultiversX Direct', 'xMoney', 'ResolutionReceipt', 'SUBMITTED', 'ORDERED', 'EXECUTED_SUCCESS', 'webhook signature verification', 'local mocks')) { Assert-Econ ($paymentsDoc.Contains($fragment)) "Payments specification missing: $fragment" }
foreach ($fragment in @('DEFAULT_ECONOMIC_CONFIG', 'SPLIT_NOT_CONSERVATIVE', 'CONFIG_HARD_CAP_EXCEEDED', 'CONFIG_HASH_CONTENT_MISMATCH', 'PENDING_SPONSORSHIP', 'SYSTEM_TEST', 'receiptValid', 'TREASURY_NEGATIVE', 'assertConservation', 'PrincipalAttestation', 'GasBudgetSnapshot', 'AdultCapability', 'ADULT_BINDING_MISMATCH', 'SettlementClaimLedger', 'InMemoryAtomicClaimStore', 'DEDUCTION_SHAPE_INVALID', 'CLAIM_REPLAY')) { Assert-Econ ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('creator pool is funded only from eligible revenue', 'ordinary action queues at target crossing', 'unverified service receipt receives zero node claim', 'node alias rotation cannot bypass verified owner-cluster cap', 'paid support has zero organic weight', 'treasury closes non-negative', 'twenty aliases cannot bypass human or risk-cluster cap', 'prive_all_gates', 'claim reserves a funded liability once', 'CONFIG_HASH_CONTENT_MISMATCH', 'ADULT_BINDING_MISMATCH', 'CLAIM:FRESH', 'CLAIM:RESTART')) { Assert-Econ ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Econ ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.|console\.log)') 'Economics runtime can perform network/process/log operations.'

Assert-Econ ($capEvidence.status -eq 'PASS') 'Capacity evidence is not PASS.'
Assert-Econ ([int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Econ ($capEvidence.artifact_sha256.'planning/spend-control.yaml' -eq (Get-Sha256 $paths.spend)) 'Spend policy drifted after capacity evidence.'
Assert-Econ ($capEvidence.artifact_sha256.'planning/zero-cost-child-test.ps1' -eq (Get-Sha256 $paths.guard)) 'Runtime guard drifted after capacity evidence.'
Assert-Econ ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Econ ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime
Assert-Econ ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'
if (-not (Test-Path -LiteralPath $ephemeralRoot)) { [void](New-Item -ItemType Directory -Path $ephemeralRoot) }
$runRoot = Join-Path $ephemeralRoot ('NX-ECON-P01-validator-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $runRoot)
$compile = $null; $testRuns = @(); $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot
        Assert-Econ ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) {
            1..3 | ForEach-Object { $script:testRuns += Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot }
            foreach ($run in $testRuns) { Assert-Econ ($run.exit_code -eq 0) "Economics tests failed: $($run.stderr)" }
            Assert-Econ (@($testRuns.stdout | Sort-Object -Unique).Count -eq 1) 'Deterministic repetitions produced different receipts.'
            try { $testReceipt = $testRuns[0].stdout | ConvertFrom-Json } catch { Assert-Econ $false 'Test receipt is not JSON.' }
        }
        $items = @(
            [pscustomobject]@{ id = 'packages/economics/api/index.ts'; sourceContext = 'economics'; text = $source },
            [pscustomobject]@{ id = 'packages/economics/api/index.test.ts'; sourceContext = 'economics'; text = $tests }
        )
        $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{ contract_registry = 'contract_registry' }; knownSchemas = @('economics', 'contract_registry'); contexts = [pscustomobject]@{ economics = [pscustomobject]@{ allowedImports = @('contract_registry') } }; items = $items }
        $manifestPath = Join-Path $runRoot 'boundary.json'
        [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
        $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot
        Assert-Econ ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"
        if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally {
    $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'
    $resolved = [IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force }
}

Assert-Econ ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) {
    Assert-Econ ($testReceipt.task_id -eq 'NX-ECON-P01' -and $testReceipt.status -eq 'PASS') 'Test receipt did not PASS.'
    Assert-Econ ([int]$testReceipt.assertions -ge 80) 'Scenario assertions regressed below 80.'
    Assert-Econ ([decimal]$testReceipt.support.creatorMicros -eq 90000000 -and [decimal]$testReceipt.support.platformMicros -eq 5000000 -and [decimal]$testReceipt.support.safetyReserveMicros -eq 3000000 -and [decimal]$testReceipt.support.infrastructureMicros -eq 2000000) 'Core tip allocation mismatch.'
    Assert-Econ ($testReceipt.support.epochId -eq 'EPOCH:2026-08' -and $testReceipt.support.effectiveAt -eq '2026-08-01T00:00:00Z' -and $testReceipt.support.contractVersion -eq '1.0.0') 'Support config/epoch binding mismatch.'
    Assert-Econ ([decimal]$testReceipt.creator_pool.poolMicros -eq (@($testReceipt.creator_pool.claims) | ForEach-Object { [decimal]$_.amountMicros } | Measure-Object -Sum).Sum + [decimal]$testReceipt.creator_pool.remainderMicros) 'Creator pool conservation failed.'
    Assert-Econ ([decimal]$testReceipt.node_pool.poolMicros -eq (@($testReceipt.node_pool.claims) | ForEach-Object { [decimal]$_.amountMicros } | Measure-Object -Sum).Sum + [decimal]$testReceipt.node_pool.remainderMicros) 'Node pool conservation failed.'
    Assert-Econ ([decimal]$testReceipt.stress.zero_revenue_creator_pool -eq 0 -and [decimal]$testReceipt.stress.zero_revenue_node_pool -eq 0 -and $testReceipt.stress.gas_spike -eq 'PENDING_SPONSORSHIP' -and [bool]$testReceipt.stress.expired_pool_config_denied) 'Zero-revenue, expiry, or gas-spike stress failed.'
    Assert-Econ ([int]$testReceipt.stress.fraud_creator_claims -eq 0 -and [int]$testReceipt.stress.fraud_node_claims -eq 0 -and [bool]$testReceipt.stress.negative_treasury_denied) 'Fraud or treasury stress failed.'
    Assert-Econ ([int]$testReceipt.ranking.paid_to_organic_weight -eq 0 -and [int]$testReceipt.ranking.promoted_to_organic_weight -eq 0 -and [int]$testReceipt.ranking.system_test_weight -eq 0) 'Ranking separation test failed.'
    Assert-Econ ([bool]$testReceipt.remediation.runtime_exact -and [bool]$testReceipt.remediation.gas_target_and_hard_cap -and [bool]$testReceipt.remediation.prive_all_gates -and [bool]$testReceipt.remediation.adult_binding_substitution_denied -and [bool]$testReceipt.remediation.typed_chargebacks -and [bool]$testReceipt.remediation.durable_claim_replay_denied -and [bool]$testReceipt.remediation.fresh_instance_and_restart_replay_denied -and [bool]$testReceipt.remediation.config_deep_immutable -and [bool]$testReceipt.remediation.config_hash_spoof_and_expiry_denied) 'Audit remediation evidence is incomplete.'
    Assert-Econ ([decimal]$testReceipt.remediation.creator_alias_claimed_micros -le 50000 -and [decimal]$testReceipt.remediation.node_alias_claimed_micros -le 150000) 'Alias concentration caps failed.'
    Assert-Econ ([decimal]$testReceipt.ledger.fundedMicros -eq [decimal]$testReceipt.ledger.availableMicros + [decimal]$testReceipt.ledger.outstandingMicros + [decimal]$testReceipt.ledger.paidMicros + [decimal]$testReceipt.ledger.reversedMicros) 'Settlement ledger conservation failed.'
    Assert-Econ ([int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0 -and [int]$testReceipt.incremental_cost.amount -eq 0) 'Test scope escaped local zero-effect mode.'
}
$boundaryFindings = @()
if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }
Assert-Econ ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = Get-Sha256 $path
}
$subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
    schema_version = 1; task_id = 'NX-ECON-P01'; run_id = $RunId; executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'local_synthetic_sustainable_creator_node_and_action_economics'
    assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; deterministic_repetitions = @($testRuns).Count
    failures = @($failures)
    acceptance = if ($null -ne $testReceipt) { [ordered]@{ support = $testReceipt.support; creator_pool = $testReceipt.creator_pool; node_pool = $testReceipt.node_pool; stress = $testReceipt.stress; ranking = $testReceipt.ranking; remediation = $testReceipt.remediation; ledger = $testReceipt.ledger } } else { $null }
    source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count
    network_operations = 0; economic_operations = 0; external_provider_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    claims_excluded = @('xmoney_sandbox', 'production_economics', 'mainnet', 'real_funds', 'formal_legal_opinion', 'external_financial_audit')
    review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
