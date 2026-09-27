[CmdletBinding()]
param(
    [string]$RunId = ('NX-PAY-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A21', 'A11', 'A13', 'A20', 'C02', 'C03', 'C05', 'C10')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Pay { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
function Read-Utf8 { param([string]$Path) [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Get-IncludedNodeRuntime {
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
    if (-not (Test-Path -LiteralPath $root)) { return $null }
    Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
}
function Invoke-LocalNode {
    param([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Node; $info.Arguments = $quoted; $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
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
    source = Join-Path $repoRoot 'packages\payments\api\index.ts'
    tests = Join-Path $repoRoot 'packages\payments\api\index.test.ts'
    contract = Join-Path $repoRoot 'packages\payments\api\payment-contract.v1.json'
    spec = Join-Path $repoRoot 'docs\19-username-payments.md'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog_p0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    backlog_p1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
    capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    progress = Join-Path $PSScriptRoot 'product-progress.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-PAY-P01.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    devnet_evidence = Join-Path $PSScriptRoot 'evidence\NX-PAY-P01-devnet.json'
    devnet_receipt = Join-Path $PSScriptRoot 'evidence\devnet-logs\NX-PAY-P01-DEVNET-20260809-EXEC01\transfer.json'
    approval = Join-Path $PSScriptRoot 'approvals\NX-PAY-P01-DEVNET-ZERO-REAL-VALUE-20260809.json'
    devnet_runner = Join-Path $PSScriptRoot 'run-payments-devnet.ps1'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Pay (Test-Path -LiteralPath $path -PathType Leaf) "Missing artifact: $path" }
Assert-Pay ($RunId -match '^NX-PAY-P01-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Pay ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$contract = Read-Utf8 $paths.contract | ConvertFrom-Json
$spec = Read-Utf8 $paths.spec
$architecture = Read-Utf8 $paths.architecture
$backlogP0 = Read-Utf8 $paths.backlog_p0
$backlogP1 = Read-Utf8 $paths.backlog_p1
$capacity = Read-Utf8 $paths.capacity
$progress = Read-Utf8 $paths.progress
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json
$devnet = Read-Utf8 $paths.devnet_evidence | ConvertFrom-Json
$signedReceipt = Read-Utf8 $paths.devnet_receipt | ConvertFrom-Json
$approval = Read-Utf8 $paths.approval | ConvertFrom-Json

$task = [regex]::Match($backlogP1, '(?ms)^  - task_id:\s*NX-PAY-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Pay $task.Success 'NX-PAY-P01 is missing from P1 backlog.'
if ($task.Success) {
    Assert-Pay ($task.Groups[1].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$') 'NX-PAY-P01 is not a task packet.'
    Assert-Pay ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A21\s*$') 'Owner is not A21.'
    Assert-Pay ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'
    Assert-Pay ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Packet is not T0.'
}
foreach ($dependency in @('NX-AUTH-001', 'NX-CHAIN-001', 'NX-CHAIN-002', 'NX-OBS-001')) {
    $record = [regex]::Match($backlogP0, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
    Assert-Pay ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "Dependency not done: $dependency"
}
$econ = [regex]::Match($backlogP1, '(?ms)^  - task_id:\s*NX-ECON-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Pay ($econ.Success -and $econ.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') 'NX-ECON-P01 dependency is not done.'
$activePackets = @([regex]::Matches($backlogP1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object { $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$' } | ForEach-Object { $_.Groups[1].Value })
Assert-Pay ($activePackets.Count -eq 1 -and $activePackets[0] -eq 'NX-PAY-P01') 'WIP one active task packet is violated.'
Assert-Pay ($capacity -match '(?m)^\s+active_packets:\s+1\s*$' -and $capacity -match '(?m)^\s+active_task_id:\s+NX-PAY-P01\s*$') 'Capacity active task mismatch.'
Assert-Pay ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'
Assert-Pay ($progress -match '(?m)^\s+active_packet_id:\s+NX-PAY-P01\s*$') 'Progress active packet mismatch.'
Assert-Pay ($architecture -match '(?ms)^  - id:\s*payments\s*\r?\n.*?^\s+owner:\s*A21\s*$') 'Payments context owner missing.'
Assert-Pay ($architecture -match '(?ms)^  - id:\s*payments\s*\r?\n.*?^\s+public_api_path:\s*packages/payments/api\s*$') 'Payments public API path missing.'

Assert-Pay ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.0.0' -and $contract.owner -eq 'A21') 'Payment contract identity mismatch.'
Assert-Pay ($contract.environment -eq 'local_mock_and_devnet_only' -and [decimal]$contract.realValueCap -eq 0) 'Payment environment or value cap drifted.'
Assert-Pay ([bool]$contract.paymentPolicy.exactShape -and [bool]$contract.paymentPolicy.hashContentAllowlisted -and [bool]$contract.paymentPolicy.activeWindowRequired -and $contract.paymentPolicy.defaultCountryDecision -eq 'DENY') 'Policy validation controls drifted.'
Assert-Pay ($contract.paymentPolicy.devnetTokenOnly -eq 'USDC-350c4e' -and [string]$contract.paymentPolicy.maxAtomicAmount -eq '1') 'Devnet token cap drifted.'
Assert-Pay (-not [bool]$contract.xMoneyP2PUsernameAssumed -and -not [bool]$contract.providerPolicy.sandboxExternalAccess) 'Unsupported xMoney capability became enabled.'
Assert-Pay ([bool]$contract.providerPolicy.webhookSignatureRequired -and [bool]$contract.providerPolicy.eventIdPayloadCollisionDenied -and [bool]$contract.providerPolicy.idempotencyPayloadCollisionDenied -and [bool]$contract.providerPolicy.outOfOrderFactsConverge -and [bool]$contract.providerPolicy.snapshotRestore) 'xMoney reconciliation controls drifted.'
Assert-Pay ([bool]$contract.directLedger.snapshotRestore -and [bool]$contract.directLedger.eventReplayDeniedAfterRestore -and [bool]$contract.directLedger.receiptSubstitutionDenied) 'Direct ledger persistence controls drifted.'
Assert-Pay ([bool]$contract.authorizationReverification.signedCapabilityEmbedded -and [bool]$contract.authorizationReverification.signatureReverifiedAtResolution -and [bool]$contract.authorizationReverification.expiryRecheckedAtResolution -and $contract.authorizationReverification.forgedOrStaleAuthorization -eq 'DENY') 'Authorization re-verification controls drifted.'
Assert-Pay ([bool]$contract.directLedger.ordinalLineageReconstructed -and [bool]$contract.directLedger.phantomOrMissingEventsDenied -and [bool]$contract.directLedger.fingerprintRecomputed -and [bool]$contract.directLedger.typedChainObservationPersisted -and [bool]$contract.directLedger.chainObservationReverifiedAtRuntimeAndRestore) 'Direct lineage reconstruction controls drifted.'
Assert-Pay ([bool]$contract.providerPolicy.restoreSignatureReverification -and [bool]$contract.providerPolicy.sequenceMonotonicityRequired -and [bool]$contract.providerPolicy.factsReconstructedFromEvents -and [bool]$contract.providerPolicy.phantomEventsDenied) 'xMoney restore controls drifted.'
Assert-Pay (@($contract.resolutionBinding).Count -eq 15 -and @($contract.capabilityBinding).Count -eq 12) 'Receipt or capability binding is incomplete.'
Assert-Pay ([bool]$contract.aliasPolicy.asciiPilot -and [bool]$contract.aliasPolicy.nfkcMutationDenied -and [bool]$contract.aliasPolicy.mixedScriptDenied -and [bool]$contract.aliasPolicy.staleVersionDenied -and [bool]$contract.aliasPolicy.addressVerifierRequired -and [int]$contract.aliasPolicy.maxReceiptLifetimeSeconds -eq 120) 'Alias safety controls drifted.'

foreach ($fragment in @('MultiversX Direct', 'xMoney', 'ResolutionReceipt', 'EXECUTED_SUCCESS', 'webhook signature verification', 'local mocks', 'homoglyph')) { Assert-Pay ($spec.Contains($fragment)) "Payment specification missing: $fragment" }
foreach ($fragment in @('DEFAULT_PAYMENT_POLICY', 'PAYMENT_POLICY_HASH_CONTENT_MISMATCH', 'PAYMENT_CAPABILITY_BINDING_MISMATCH', 'RESOLUTION_SIGNATURE_INVALID', 'RESOLUTION_EXPIRED', 'ALIAS_STALE_OR_SUBSTITUTED', 'TX_HASH_SUBSTITUTED', 'CHAIN_EFFECT_MISMATCH', 'DirectPaymentLedger', 'LocalXMoneyReconciler', 'XMONEY_EVENT_COLLISION', 'XMONEY_IDEMPOTENCY_CONFLICT')) { Assert-Pay ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('canonical ASCII alias passes', 'ALIAS_STALE_OR_SUBSTITUTED', 'TX_HASH_SUBSTITUTED', 'PAYMENT_EVENT_REPLAY', 'XMONEY_SIGNATURE_INVALID', 'XMONEY_EVENT_COLLISION', 'xMoney reducer survives restart')) { Assert-Pay ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Pay ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.|console\.log)') 'Payment runtime can perform network/process/log operations.'

Assert-Pay ($devnet.status -eq 'PASS' -and $devnet.mode -eq 'Recover' -and $devnet.run_id -eq 'NX-PAY-P01-DEVNET-20260809-EXEC01') 'Devnet evidence is not a recovered PASS.'
Assert-Pay ($devnet.transaction.hash -eq '10c4e1014c9c2a212f802f6163ac3a2c4651f79e21e0c21339a7fe25439006da' -and $devnet.transaction.status -eq 'success' -and [long]$devnet.transaction.nonce -eq 930) 'Devnet transaction identity mismatch.'
Assert-Pay ($devnet.transaction.sender -eq $approval.sender -and $devnet.transaction.receiver -eq $approval.receiver -and $devnet.transaction.token_id -eq $approval.token_id -and [string]$devnet.transaction.atomic_amount -eq [string]$approval.atomic_amount -and [string]$devnet.transaction.native_value -eq '0') 'Devnet transaction escaped approval binding.'
Assert-Pay ($devnet.balance_effect.sender_before -eq '200000' -and $devnet.balance_effect.sender_after -eq '199999' -and $devnet.balance_effect.sender_delta -eq '-1' -and $devnet.balance_effect.receiver_before -eq '0' -and $devnet.balance_effect.receiver_after -eq '1' -and $devnet.balance_effect.receiver_delta -eq '1' -and $devnet.balance_effect.token_imbalance -eq '0') 'Devnet balance effect mismatch.'
Assert-Pay ([int]$devnet.public_devnet_transactions -eq 1 -and [int]$devnet.repeated_broadcasts -eq 0 -and [int]$devnet.real_fund_operations -eq 0 -and [int]$devnet.xmoney_provider_operations -eq 0 -and [decimal]$devnet.incremental_cost.amount -eq 0) 'Devnet execution escaped the zero-real-value boundary.'
Assert-Pay ($approval.single_use -eq $true -and $approval.consumed_run_id -eq $devnet.run_id -and [decimal]$approval.max_amount -eq 0 -and [decimal]$approval.max_real_value -eq 0 -and [int]$approval.max_public_transactions -eq 1 -and [int]$approval.xmoney_provider_calls -eq 0 -and $approval.external_terms_accepted -eq $false) 'Consumed approval scope mismatch.'
Assert-Pay ($devnet.authorization.authorized_subject_sha256 -eq $approval.subject_sha256 -and $devnet.authorization.consumed_sha256 -eq (Get-Sha256 $paths.approval)) 'Authorization evidence hash mismatch.'
Assert-Pay ($devnet.signed_receipt_sha256 -eq (Get-Sha256 $paths.devnet_receipt) -and $signedReceipt.emittedTransaction.signature -eq $devnet.transaction.signature -and $signedReceipt.emittedTransactionData -eq $devnet.transaction.data) 'Signed Devnet receipt mismatch.'

Assert-Pay ($capEvidence.status -eq 'PASS' -and [int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Pay ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Pay ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime
Assert-Pay ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'
[IO.Directory]::CreateDirectory($ephemeralRoot) | Out-Null
$runRoot = Join-Path $ephemeralRoot ('NX-PAY-P01-validator-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($runRoot) | Out-Null
$compile = $null; $testRuns = @(); $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot
        Assert-Pay ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) {
            1..3 | ForEach-Object { $script:testRuns += Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot }
            foreach ($run in $testRuns) { Assert-Pay ($run.exit_code -eq 0) "Payment tests failed: $($run.stderr)" }
            Assert-Pay (@($testRuns.stdout | Sort-Object -Unique).Count -eq 1) 'Deterministic repetitions produced different receipts.'
            try { $testReceipt = $testRuns[0].stdout | ConvertFrom-Json } catch { Assert-Pay $false 'Test receipt is not JSON.' }
        }
        $items = @([pscustomobject]@{ id = 'packages/payments/api/index.ts'; sourceContext = 'payments'; text = $source }, [pscustomobject]@{ id = 'packages/payments/api/index.test.ts'; sourceContext = 'payments'; text = $tests })
        $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{ identity = 'identity'; chain_integration = 'chain_integration'; economics = 'economics'; contract_registry = 'contract_registry' }; knownSchemas = @('payments', 'identity', 'chain_integration', 'economics', 'contract_registry'); contexts = [pscustomobject]@{ payments = [pscustomobject]@{ allowedImports = @('identity', 'chain_integration', 'economics', 'contract_registry') } }; items = $items }
        $manifestPath = Join-Path $runRoot 'boundary.json'; [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
        $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot
        Assert-Pay ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"
        if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally {
    $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'; $resolved = [IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force }
}

Assert-Pay ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) {
    Assert-Pay ($testReceipt.task_id -eq 'NX-PAY-P01' -and $testReceipt.status -eq 'PASS' -and [int]$testReceipt.assertions -ge 80) 'Payment scenario receipt regressed.'
    Assert-Pay ($testReceipt.policy.hash -eq '3763fbc42da4e0fcf47d6a13232453a3655b450c40959383ec20e948da08739c') 'Canonical policy hash mismatch.'
    Assert-Pay ($testReceipt.direct_final.state -eq 'EXECUTED_SUCCESS' -and $testReceipt.xmoney_final.state -eq 'REFUNDED' -and -not [bool]$testReceipt.xmoney_final.credited) 'Direct or xMoney terminal state mismatch.'
    foreach ($property in @('homoglyph_denied', 'default_deny_capability', 'stale_alias_denied', 'forged_and_stale_authorization_denied', 'receipt_substitution_denied', 'tx_hash_substitution_denied', 'wrong_decimals_denied', 'exact_balance_effect_required', 'duplicate_submit_survives_restart', 'direct_lineage_tamper_denied', 'idempotency_collision_denied', 'forged_webhook_denied', 'duplicate_webhook_no_credit', 'out_of_order_converges', 'xmoney_lineage_and_sequence_tamper_denied')) { Assert-Pay ([bool]$testReceipt.negative.$property) "Negative control failed: $property" }
    Assert-Pay ([int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0 -and [int]$testReceipt.external_provider_operations -eq 0 -and [decimal]$testReceipt.incremental_cost.amount -eq 0) 'Local tests escaped zero-effect mode.'
}
$boundaryFindings = @(); if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }
Assert-Pay ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) { if (Test-Path -LiteralPath $path -PathType Leaf) { $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/'); $artifactHashes[$relative] = Get-Sha256 $path } }
$subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
    schema_version = 1; task_id = 'NX-PAY-P01'; run_id = $RunId; executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }; scope = 'local_username_payment_and_one_zero_real_value_multiversx_devnet_esdt_transfer'
    assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; deterministic_repetitions = @($testRuns).Count; failures = @($failures)
    devnet = [ordered]@{ tx_hash = $devnet.transaction.hash; explorer = 'https://devnet-explorer.multiversx.com/transactions/' + $devnet.transaction.hash; sender_delta = $devnet.balance_effect.sender_delta; receiver_delta = $devnet.balance_effect.receiver_delta; imbalance = $devnet.balance_effect.token_imbalance; public_transactions = $devnet.public_devnet_transactions; repeated_broadcasts = $devnet.repeated_broadcasts }
    source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count
    local_network_operations = 0; local_economic_operations = 0; xmoney_provider_operations = 0; public_devnet_transactions = 1; real_fund_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    claims_excluded = @('xmoney_sandbox', 'xmoney_production', 'mainnet', 'real_funds', 'production_compliance', 'formal_legal_opinion', 'external_financial_audit')
    review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes; duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
