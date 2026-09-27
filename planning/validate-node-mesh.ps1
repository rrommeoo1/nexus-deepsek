[CmdletBinding()]
param(
  [string]$RunId = ('NX-NODE-P02-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)),
  [ValidateSet('UNSPECIFIED','A16','C02','C03','C09','C10','C13')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Mesh([bool]$Condition, [string]$Message) {
  $script:assertions++
  if (-not $Condition) { $script:failures.Add($Message) }
}
function Read-Utf8([string]$Path) { [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-TextSha([string]$Value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}
function Get-NodeRuntime {
  $runtimeRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
  if (Test-Path -LiteralPath $runtimeRoot) {
    Get-ChildItem -LiteralPath $runtimeRoot -Filter node.exe -File -Recurse | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
  }
}
function Invoke-Node([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory) {
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
    if (-not $process.Start()) { throw 'node start failed' }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'node timeout' }
    [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim() }
  } finally { $process.Dispose() }
}

$root = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
  source = Join-Path $root 'packages\node-network\mesh\index.ts'
  tests = Join-Path $root 'packages\node-network\mesh\index.test.ts'
  contract = Join-Path $root 'packages\node-network\mesh\mesh-contract.v1.json'
  architecture_doc = Join-Path $root 'docs\01-technical-architecture.md'
  assurance_doc = Join-Path $root 'docs\16-agent-delivery-continuous-assurance.md'
  node_doc = Join-Path $root 'docs\17-decentralized-node-network.md'
  agents = Join-Path $root 'AGENTS.md'
  backlog0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
  backlog1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
  capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
  progress = Join-Path $PSScriptRoot 'product-progress.yaml'
  checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-NODE-P02.md'
  spend = Join-Path $PSScriptRoot 'spend-control.yaml'
  p01_evidence = Join-Path $PSScriptRoot 'evidence\NX-NODE-P01-validation.json'
  p01_review = Join-Path $PSScriptRoot 'evidence\reviews\NX-NODE-P01-C02-C03-C09-C13.yaml'
  tsc = Join-Path $root 'packages\contracts\node_modules\typescript\bin\tsc'
  lock = Join-Path $root 'packages\contracts\package-lock.json'
  validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Mesh (Test-Path -LiteralPath $path -PathType Leaf) "Missing: $path" }
Assert-Mesh ($RunId -match '^NX-NODE-P02-[A-Za-z0-9T._-]+$') 'Run id invalid'
Assert-Mesh ($ExecutorRole -ne 'UNSPECIFIED') 'Executor role required'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$contract = Read-Utf8 $paths.contract | ConvertFrom-Json
$b0 = Read-Utf8 $paths.backlog0
$b1 = Read-Utf8 $paths.backlog1
$capacity = Read-Utf8 $paths.capacity
$progress = Read-Utf8 $paths.progress
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$p01Evidence = Read-Utf8 $paths.p01_evidence | ConvertFrom-Json
$p01Review = Read-Utf8 $paths.p01_review

$task = [regex]::Match($b1, '(?ms)^  - task_id:\s*NX-NODE-P02\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Mesh $task.Success 'Packet missing'
if ($task.Success) {
  Assert-Mesh ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A16\s*$') 'Owner drift'
  Assert-Mesh ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet inactive'
  Assert-Mesh ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Risk drift'
  Assert-Mesh ($task.Groups[1].Value -match '(?m)^\s+depends_on:\s*\[NX-NODE-P01\]\s*$') 'Dependency drift'
  Assert-Mesh ($task.Groups[1].Value -match '(?m)^\s+control_reviewers:\s*\[C02, C03, C09, C10, C13\]\s*$') 'Review roles drift'
}
$p01 = [regex]::Match($b1, '(?ms)^  - task_id:\s*NX-NODE-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Mesh ($p01.Success -and $p01.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') 'NX-NODE-P01 not done'
Assert-Mesh ($p01Evidence.status -eq 'PASS') 'NX-NODE-P01 owner evidence not PASS'
Assert-Mesh ($p01Review -match '(?m)^decision:\s*PASS\s*$' -and $p01Review -match '(?m)^\s*open:\s*0\s*$' -and $p01Review -match '(?m)^gate_effect:\s*T0_REVIEW_SATISFIED\s*$') 'NX-NODE-P01 independent review not PASS'

$active = @([regex]::Matches($b1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object {
  $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$'
} | ForEach-Object { $_.Groups[1].Value })
Assert-Mesh ($active.Count -eq 1 -and $active[0] -eq 'NX-NODE-P02') 'WIP violated'
Assert-Mesh ($capacity -match '(?m)^\s+active_task_id:\s+NX-NODE-P02\s*$' -and $capacity -match '(?m)^\s+active_packets:\s+1\s*$') 'Capacity state mismatch'
Assert-Mesh ($progress -match '(?m)^\s+active_packet_id:\s+NX-NODE-P02\s*$') 'Progress state mismatch'
Assert-Mesh ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch'

Assert-Mesh ($contract.schemaVersion -eq 1 -and $contract.owner -eq 'A16' -and $contract.mode -eq 'D0_DETERMINISTIC_MESH' -and $contract.protocol -eq '/nexus/mesh/1.0') 'Contract identity drift'
Assert-Mesh ([int]$contract.nodeRange.minimum -eq 1 -and [int]$contract.nodeRange.maximum -eq 8) 'Node range drift'
Assert-Mesh ([int]$contract.replication.target -eq 3 -and $contract.replication.formula -eq 'min(eligibleNodes,3)') 'Replication formula drift'
foreach ($property in @('underReplicatedState','automaticRepair','rendezvousPlacement','failureDomainDiversity')) { Assert-Mesh ([bool]$contract.replication.$property) "Replication contract false: $property" }
foreach ($property in @('permissionlessFixture','signedManifestRequired','replayDenied')) { Assert-Mesh ([bool]$contract.join.$property) "Join contract false: $property" }
Assert-Mesh (-not [bool]$contract.join.walletRequired -and -not [bool]$contract.join.bondRequired -and -not [bool]$contract.join.rewardAccountRequired) 'Permissionless join cost gate drift'
foreach ($property in @('signedCommands','allOnlineNodesShareRoot','objectPayloadReplicaCountBounded','systemTestOnly')) { Assert-Mesh ([bool]$contract.catalog.$property) "Catalog contract false: $property" }
foreach ($property in @('orderedSha256Lineage','authorityVerified','actionStateMachine','objectValueCatalogEpochBound','causalEpochOrder','reconciledOnRestore')) { Assert-Mesh ([bool]$contract.receipts.$property) "Receipt contract false: $property" }
foreach ($property in @('freshInstanceRequired','exactShape','checkpointHashRequired','prefixReorderFabricationDenied','nonEmptyObjectHistoryRequired','sameCatalogRootRequired','sameReceiptHeadRequired')) { Assert-Mesh ([bool]$contract.recovery.$property) "Recovery contract false: $property" }
Assert-Mesh ([int]$contract.effects.networkOperationsMax -eq 0 -and [int]$contract.effects.providerOperationsMax -eq 0 -and [int]$contract.effects.economicOperationsMax -eq 0 -and [int]$contract.effects.realFundOperationsMax -eq 0 -and [int]$contract.effects.rewardsAccruedMax -eq 0 -and [decimal]$contract.effects.incrementalCostEurMax -eq 0) 'Effect limits drift'
foreach ($claim in @('real_p2p_network','dht_gossipsub','production_storage','public_ports','mainnet_anchor','real_settlement','hardware_failure_sla','real_data')) { Assert-Mesh (@($contract.claimsExcluded) -contains $claim) "Excluded claim missing: $claim" }

foreach ($fragment in @('R=min(N,3)','permissionless','UNDER_REPLICATED','rendezvous','failureDomain','SYSTEM_TEST','MeshFixtureAuthority','operationTail','buildReceipt','MESH_RECEIPT_RECONCILIATION_FAILED','MESH_CHECKPOINT_STALE','failReceiptAfter')) { Assert-Mesh ($source.Contains($fragment) -or $tests.Contains($fragment) -or $checkpoint.Contains($fragment)) "Control fragment missing: $fragment" }
foreach ($fragment in @('N=${count} target is min(N,3)','failed holder is visible as under-replication before repair','fresh restore reproduces the full mesh projection byte-for-byte','failed publish rolls back epoch object replay index and receipts atomically','failed multi-receipt repair rolls back every staged assignment and release','concurrent duplicate join commits exactly once')) { Assert-Mesh ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Mesh ((Read-Utf8 $paths.node_doc).Contains('R = min(N_eligible, target_replication)')) 'Normative replication formula missing'
Assert-Mesh ((Read-Utf8 $paths.node_doc).Contains('UNDER_REPLICATED')) 'Normative under-replication state missing'
Assert-Mesh ((Read-Utf8 $paths.assurance_doc).Contains('`N=2..8`')) 'Assurance N=2..8 gate missing'
Assert-Mesh ((Read-Utf8 $paths.agents).Contains('default_deny_spend')) 'Spend guard instruction missing'
Assert-Mesh ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|console\.log)') 'Runtime network/process capability detected'
Assert-Mesh ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Spend policy drift'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Mesh ($credentialNames.Count -eq 0) 'Production or billing credential name present'

$node = Get-NodeRuntime
Assert-Mesh ($null -ne $node) 'Node runtime missing'
$ephemeralRoot = Join-Path $root '.ephemeral'
[IO.Directory]::CreateDirectory($ephemeralRoot) | Out-Null
$runDirectory = Join-Path $ephemeralRoot ('NX-NODE-P02-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($runDirectory) | Out-Null
$runs = @()
$receipt = $null
try {
  if ($null -ne $node) {
    $compile = Invoke-Node $node @($paths.tsc,'--strict','--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--outDir',$runDirectory,$paths.source,$paths.tests) $root
    Assert-Mesh ($compile.exit_code -eq 0) "Compile failed: $($compile.stderr)"
    if ($compile.exit_code -eq 0) {
      $testPath = Join-Path $runDirectory 'index.test.js'
      1..3 | ForEach-Object { $script:runs += Invoke-Node $node @($testPath) $root }
      foreach ($run in $runs) { Assert-Mesh ($run.exit_code -eq 0) "Scenario failed: $($run.stderr)" }
      Assert-Mesh (@($runs.stdout | Sort-Object -Unique).Count -eq 1) 'Scenario output is nondeterministic'
      try { $receipt = $runs[0].stdout | ConvertFrom-Json } catch { Assert-Mesh $false 'Scenario receipt invalid' }
    }
  }
} finally {
  $safePrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'
  $resolved = [IO.Path]::GetFullPath($runDirectory)
  if ((Test-Path -LiteralPath $runDirectory) -and $resolved.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runDirectory -Recurse -Force }
}

Assert-Mesh ($null -ne $receipt) 'Scenario receipt missing'
if ($null -ne $receipt) {
  Assert-Mesh ($receipt.status -eq 'PASS' -and [int]$receipt.assertions -ge 115) 'Scenario assertion regression'
  Assert-Mesh ($receipt.protocol -eq '/nexus/mesh/1.0' -and $receipt.replication_formula -eq 'min(eligibleNodes,3)') 'Scenario identity drift'
  Assert-Mesh (@($receipt.fixtures).Count -eq 8) 'N=1..8 fixture coverage missing'
  $expectedReplication = @(1,2,3,3,3,3,3,3)
  for ($index = 0; $index -lt 8; $index++) {
    Assert-Mesh ([int]$receipt.fixtures[$index].nodeCount -eq ($index + 1)) "Fixture node count drift at N=$($index + 1)"
    Assert-Mesh ([int]$receipt.fixtures[$index].replication -eq $expectedReplication[$index]) "Fixture replication drift at N=$($index + 1)"
    Assert-Mesh ($receipt.fixtures[$index].catalogRoot -match '^[a-f0-9]{64}$' -and $receipt.fixtures[$index].receiptHead -match '^[a-f0-9]{64}$') "Fixture root invalid at N=$($index + 1)"
  }
  foreach ($property in @('under_replicated_observed','repaired_to_target','offline_assignment_denied')) { Assert-Mesh ([bool]$receipt.churn.$property) "Churn proof false: $property" }
  foreach ($property in @('deterministic_projection','all_online_catalog_roots_equal','fresh_restore_equal')) { Assert-Mesh ([bool]$receipt.convergence.$property) "Convergence proof false: $property" }
  foreach ($property in @('ordered_sha256_lineage','signature_verified','state_machine_reconciled','causal_epoch_order','nonempty_object_history','replay_denied','prefix_denied','atomic_staging','fault_rollback')) { Assert-Mesh ([bool]$receipt.receipts.$property) "Receipt proof false: $property" }
  Assert-Mesh (-not [bool]$receipt.permissionless_fixture.wallet_required -and -not [bool]$receipt.permissionless_fixture.bond_required -and -not [bool]$receipt.permissionless_fixture.reward_account_required) 'Permissionless fixture drift'
  Assert-Mesh ($receipt.synthetic_isolation.actor_class -eq 'SYSTEM_TEST' -and [int]$receipt.synthetic_isolation.rewards_accrued -eq 0 -and [int]$receipt.synthetic_isolation.organic_events -eq 0) 'Synthetic isolation failed'
  foreach ($property in @('exact_shape','command_tamper','manifest_tamper','receipt_reorder','receipt_prefix','receipt_full_strip','receipt_node_causality','receipt_object_causality','receipt_replay','receipt_transition','stale_checkpoint','boolean_string','duplicate_join','restore_toctou','publish_fault_rollback','repair_fault_rollback')) { Assert-Mesh ([bool]$receipt.negative.$property) "Negative proof false: $property" }
  Assert-Mesh ([int]$receipt.network_operations -eq 0 -and [int]$receipt.external_provider_operations -eq 0 -and [int]$receipt.economic_operations -eq 0 -and [int]$receipt.real_fund_operations -eq 0 -and [decimal]$receipt.incremental_cost.amount -eq 0) 'Effect escaped'
}

$hashes = [ordered]@{}
foreach ($path in $paths.Values) {
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    $relative = $path.Substring($root.Length).TrimStart('\').Replace('\','/')
    $hashes[$relative] = Get-Sha $path
  }
}
$subject = Get-TextSha(($hashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
  schema_version = 1
  task_id = 'NX-NODE-P02'
  run_id = $RunId
  executor_role = $ExecutorRole
  status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
  scope = 'deterministic_n1_n8_replication_churn_repair_receipt_reconciliation'
  assertions = $assertions
  scenario_assertions = if ($receipt) { [int]$receipt.assertions } else { 0 }
  deterministic_repetitions = @($runs).Count
  failures = @($failures)
  node_range = if ($receipt) { $receipt.node_range } else { $null }
  fixtures = if ($receipt) { $receipt.fixtures } else { $null }
  churn = if ($receipt) { $receipt.churn } else { $null }
  convergence = if ($receipt) { $receipt.convergence } else { $null }
  receipts = if ($receipt) { $receipt.receipts } else { $null }
  synthetic_isolation = if ($receipt) { $receipt.synthetic_isolation } else { $null }
  negative = if ($receipt) { $receipt.negative } else { $null }
  credential_name_matches = $credentialNames.Count
  network_operations = 0
  external_provider_operations = 0
  economic_operations = 0
  real_fund_operations = 0
  incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
  claims_excluded = @($contract.claimsExcluded)
  review_subject_sha256 = $subject
  artifact_sha256 = $hashes
  duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
