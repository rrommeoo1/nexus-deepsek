[CmdletBinding()]
param(
  [string]$RunId = ('NX-TRUST-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)),
  [ValidateSet('UNSPECIFIED','A32','C01','C02','C04','C05','C06','C10')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Trust([bool]$Condition, [string]$Message) { $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
function Read-Utf8([string]$Path) { [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-TextSha([string]$Value) { $sha = [Security.Cryptography.SHA256]::Create(); try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() } }
function Get-NodeRuntime {
  $runtimeRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
  if (Test-Path -LiteralPath $runtimeRoot) { Get-ChildItem -LiteralPath $runtimeRoot -Filter node.exe -File -Recurse | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName }
}
function Invoke-Node([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory) {
  $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' }) -join ' '
  $info = [Diagnostics.ProcessStartInfo]::new(); $info.FileName = $Node; $info.Arguments = $quoted; $info.WorkingDirectory = $WorkingDirectory
  $info.UseShellExecute = $false; $info.CreateNoWindow = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
  $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
  try {
    if (-not $process.Start()) { throw 'node start failed' }
    $stdout = $process.StandardOutput.ReadToEnd(); $stderr = $process.StandardError.ReadToEnd()
    if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'node timeout' }
    [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds,4) }
  } finally { $process.Dispose() }
}

$root = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
  source = Join-Path $root 'packages\trust-lens\api\index.ts'
  tests = Join-Path $root 'packages\trust-lens\api\index.test.ts'
  contract = Join-Path $root 'packages\trust-lens\api\trust-lens-contract.v1.json'
  security_doc = Join-Path $root 'docs\04-security-compliance.md'
  media_doc = Join-Path $root 'docs\15-recommendations-clips-watch-live-kids.md'
  assurance_doc = Join-Path $root 'docs\research-continuous-assurance.md'
  compliance_doc = Join-Path $root 'docs\research-data-security-compliance.md'
  agents = Join-Path $root 'AGENTS.md'
  backlog0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
  backlog1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
  capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
  progress = Join-Path $PSScriptRoot 'product-progress.yaml'
  checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-TRUST-P01.md'
  spend = Join-Path $PSScriptRoot 'spend-control.yaml'
  security_evidence = Join-Path $PSScriptRoot 'evidence\NX-SEC-001-validation.json'
  observability_evidence = Join-Path $PSScriptRoot 'evidence\NX-OBS-001-validation.json'
  moderation_evidence = Join-Path $PSScriptRoot 'evidence\NX-MOD-P01-validation.json'
  profile_evidence = Join-Path $PSScriptRoot 'evidence\NX-PROFILE-P01-validation.json'
  social_evidence = Join-Path $PSScriptRoot 'evidence\NX-SOCIAL-P01-validation.json'
  live_evidence = Join-Path $PSScriptRoot 'evidence\NX-LIVE-P01-validation.json'
  tsc = Join-Path $root 'packages\contracts\node_modules\typescript\bin\tsc'
  lock = Join-Path $root 'packages\contracts\package-lock.json'
  validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Trust (Test-Path -LiteralPath $path -PathType Leaf) "Missing: $path" }
Assert-Trust ($RunId -match '^NX-TRUST-P01-[A-Za-z0-9T._-]+$') 'Run id invalid'
Assert-Trust ($ExecutorRole -ne 'UNSPECIFIED') 'Executor role required'

$source = Read-Utf8 $paths.source; $tests = Read-Utf8 $paths.tests; $contract = Read-Utf8 $paths.contract | ConvertFrom-Json
$b0 = Read-Utf8 $paths.backlog0; $b1 = Read-Utf8 $paths.backlog1; $capacity = Read-Utf8 $paths.capacity; $progress = Read-Utf8 $paths.progress
$checkpoint = Read-Utf8 $paths.checkpoint; $spend = Read-Utf8 $paths.spend
$task = [regex]::Match($b1, '(?ms)^  - task_id:\s*NX-TRUST-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Trust $task.Success 'Packet missing'
if ($task.Success) {
  Assert-Trust ($task.Groups[1].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$') 'Record kind drift'
  Assert-Trust ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A32\s*$') 'Owner drift'
  Assert-Trust ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet inactive'
  Assert-Trust ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Risk drift'
  Assert-Trust ($task.Groups[1].Value -match '(?m)^\s+control_reviewers:\s*\[C01, C02, C04, C05, C06, C10\]\s*$') 'Review roles drift'
}
foreach ($dependency in @('NX-SEC-001','NX-OBS-001')) {
  $record = [regex]::Match($b0, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
  Assert-Trust ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "P0 dependency not done: $dependency"
}
foreach ($dependency in @('NX-MOD-P01','NX-PROFILE-P01','NX-SOCIAL-P01','NX-LIVE-P01')) {
  $record = [regex]::Match($b1, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
  Assert-Trust ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "P1 dependency not done: $dependency"
}
$active = @([regex]::Matches($b1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object { $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$' } | ForEach-Object { $_.Groups[1].Value })
Assert-Trust ($active.Count -eq 1 -and $active[0] -eq 'NX-TRUST-P01') 'WIP violated'
Assert-Trust ($capacity -match '(?m)^\s+active_task_id:\s+NX-TRUST-P01\s*$' -and $capacity -match '(?m)^\s+active_packets:\s+1\s*$') 'Capacity state mismatch'
Assert-Trust ($progress -match '(?m)^\s+active_packet_id:\s+NX-TRUST-P01\s*$') 'Progress state mismatch'
Assert-Trust ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch'

Assert-Trust ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.0.0' -and $contract.owner -eq 'A32' -and $contract.mode -eq 'LOCAL_DETERMINISTIC_AUTOMATED_TRUST') 'Contract identity drift'
Assert-Trust (@($contract.surfaces).Count -eq 7 -and (@($contract.surfaces) -join ',') -eq 'SOCIAL,WORK,DATING,MARKET,TRAVEL,LIVE,KIDS') 'Surface coverage drift'
Assert-Trust (@($contract.signalAxes).Count -eq 6 -and (@($contract.signalAxes) -join ',') -eq 'PROVENANCE,AI_LIKELIHOOD,FACTUAL_EVIDENCE,SAFETY,LEGALITY,POLITICAL_AD') 'Signal axes drift'
foreach ($property in @('immutableIllegalityMatchMayBlock','immutableEvidenceRequiresIndependentAuthority','immutableEvidenceMustBindContentCategoryAndExpiry','decisionExpiryIncludesEvidence')) { Assert-Trust ([bool]$contract.automation.$property) "Automation control false: $property" }
foreach ($property in @('ordinaryHumanPreApprovalRequired','singleProbabilisticSignalFinalTakedownAllowed','probabilisticFinalTakedownAllowed')) { Assert-Trust (-not [bool]$contract.automation.$property) "Automation deny control false: $property" }
Assert-Trust ([int]$contract.automation.publicCorpusCoveragePercent -eq 100 -and [int]$contract.automation.highRiskHoldRequiresIndependentVotes -eq 2 -and [int]$contract.automation.highRiskHoldVoteCount -eq 3) 'Automation threshold drift'
foreach ($property in @('universalTruthScoreAllowed','honestyScoreAllowed','ideologyScoreAllowed','attractivenessScoreAllowed')) { Assert-Trust (-not [bool]$contract.presentation.$property) "Prohibited score enabled: $property" }
foreach ($property in @('signedTrustRootRegistryRequired','distinctKeyIdsRequired','distinctPublicKeyFingerprintsRequired','distinctAuthorityLineagesRequired','distinctAdministrativeDomainsRequired','activationExpiryAndRevocationChecked','countryPolicyHeadMonotonic','samePolicyVersionEquivocationDenied','signedModelManifestRequired','modelHeadMonotonicPerCountrySurfacePurpose','sameModelVersionEquivocationDenied','rollbackRequiresSeparateSignedAuthorization','rollbackBindsFromToIdsVersionsCommitments','rollbackExpiryNonceAndOneTimeConsumption','headsAndRollbackConsumptionRestored')) { Assert-Trust ([bool]$contract.trustGovernance.$property) "Governance control false: $property" }
Assert-Trust ((@($contract.trustGovernance.roles) -join ',') -eq 'PRIMARY_TRUST,IMMUTABLE_EVIDENCE,MODEL_REGISTRY,GOVERNANCE_ROLLBACK') 'Trust role set drift'
foreach ($property in @('exactShape','signed','contentProfileCountryPolicyModelBound','reasonCodesRequired','appealRouteRequired','expiryRequired','orderedSha256Lineage','oneTimeDecision','freshRestoreRevalidation','checkpointSignatureRequired','trustRegistryVersionAndFingerprintsBound','modelManifestIdVersionCommitmentBound','rollbackAuthorizationCommitmentsBound')) { Assert-Trust ([bool]$contract.decisionReceipt.$property) "Receipt control false: $property" }
Assert-Trust (-not [bool]$contract.politicalIntegrity.opinionInferenceAllowed -and -not [bool]$contract.politicalIntegrity.sensitiveAttributeTargetingAllowed -and -not [bool]$contract.politicalIntegrity.viewpointSpecificRulesAllowed -and [bool]$contract.politicalIntegrity.paidPoliticalTransparencyRequired) 'Political integrity drift'
Assert-Trust (-not [bool]$contract.storage.rawContentOnChain -and -not [bool]$contract.storage.sensitiveEvidenceOnChain -and $contract.storage.futureAnchor -eq 'RECEIPT_HASH_ONLY') 'Storage minimisation drift'
Assert-Trust ([int]$contract.effects.networkOperationsMax -eq 0 -and [int]$contract.effects.providerOperationsMax -eq 0 -and [int]$contract.effects.economicOperationsMax -eq 0 -and [int]$contract.effects.organicMetricOperationsMax -eq 0 -and [int]$contract.effects.realFundOperationsMax -eq 0 -and [decimal]$contract.effects.incrementalCostEurMax -eq 0) 'Effect limits drift'

foreach ($fragment in @('ImmutableEvidenceAuthority','TrustRootRegistryAuthority','ModelRegistryAuthority','GovernanceRollbackAuthority','publicKeyFingerprint','authorityLineage','administrativeDomain','modelSetManifest','policyHeads','modelHeads','rollbackIds','TRUST_AUTHORITY_SEPARATION_INVALID','TRUST_POLICY_ROLLBACK_DENIED','TRUST_POLICY_EQUIVOCATION','TRUST_MODEL_ROLLBACK_DENIED','TRUST_MODEL_EQUIVOCATION','TRUST_ROLLBACK_REPLAY','evidenceAttestationHash','TRUST_EVIDENCE_ATTESTATION_REQUIRED','TRUST_DECISION_REPLAY','TRUST_CHECKPOINT_STALE','operationTail','previousReceiptHash','signalBundleCommitment','humanPreApprovalRequired: false','politicalOpinionInferenceAllowed: false')) { Assert-Trust ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('one hundred percent of the seven-surface synthetic corpus','one probabilistic detector cannot hold limit or block content','only allowlisted verified immutable illegality creates the final block outcome','EVIDENCE-AUTH:ROGUE','political viewpoints with identical safety and evidence signals receive identical decisions','concurrent duplicate decisions commit exactly once','fresh restore reproduces decision count','restore captures one immutable representation','receipt binds current policy model manifest and trust-root registry versions','explicit policy rollback is exact bound and committed once','explicit model rollback is exact bound and committed once','TRUST_AUTHORITY_SEPARATION_INVALID','TRUST_POLICY_EQUIVOCATION','TRUST_MODEL_EQUIVOCATION','TRUST_ROLLBACK_REPLAY')) { Assert-Trust ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Trust ((Read-Utf8 $paths.security_doc).Contains('statement of reasons') -and (Read-Utf8 $paths.security_doc).Contains('complaint/appeal')) 'DSA reason/appeal baseline missing'
Assert-Trust ((Read-Utf8 $paths.media_doc).Contains('statement of reasons') -and (Read-Utf8 $paths.media_doc).Contains('trusted flaggers')) 'Media moderation baseline missing'
Assert-Trust ((Read-Utf8 $paths.compliance_doc).Contains('notice-and-action') -and (Read-Utf8 $paths.compliance_doc).Contains('complaint handling')) 'Compliance baseline missing'
Assert-Trust ((Read-Utf8 $paths.assurance_doc).Contains('human oversight and appeal for high-impact decisions')) 'High-impact oversight gate missing'
Assert-Trust ((Read-Utf8 $paths.agents).Contains('default_deny_spend')) 'Spend instruction missing'
Assert-Trust ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.|console\.log)') 'Runtime network/process/log capability detected'
Assert-Trust ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Spend guard drift'
foreach ($name in @('security_evidence','observability_evidence','moderation_evidence','profile_evidence','social_evidence','live_evidence')) { $evidence = Read-Utf8 $paths[$name] | ConvertFrom-Json; Assert-Trust ($evidence.status -eq 'PASS') "Dependency evidence not PASS: $name" }
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Trust ($credentialNames.Count -eq 0) 'Production or billing credential name present'

$node = Get-NodeRuntime; Assert-Trust ($null -ne $node) 'Node runtime missing'
$ephemeralRoot = Join-Path $root '.ephemeral'; [IO.Directory]::CreateDirectory($ephemeralRoot) | Out-Null
$runDirectory = Join-Path $ephemeralRoot ('NX-TRUST-P01-' + [Guid]::NewGuid().ToString('N')); [IO.Directory]::CreateDirectory($runDirectory) | Out-Null
$runs = @(); $receipt = $null
try {
  if ($null -ne $node) {
    $compile = Invoke-Node $node @($paths.tsc,'--strict','--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--outDir',$runDirectory,$paths.source,$paths.tests) $root
    Assert-Trust ($compile.exit_code -eq 0) "Compile failed: $($compile.stderr)"
    if ($compile.exit_code -eq 0) {
      $testPath = Join-Path $runDirectory 'index.test.js'
      1..3 | ForEach-Object { $script:runs += Invoke-Node $node @($testPath) $root }
      foreach ($run in $runs) { Assert-Trust ($run.exit_code -eq 0) "Scenario failed: $($run.stderr)" }
      Assert-Trust (@($runs.stdout | Sort-Object -Unique).Count -eq 1) 'Scenario output nondeterministic'
      try { $receipt = $runs[0].stdout | ConvertFrom-Json } catch { Assert-Trust $false 'Scenario receipt invalid' }
    }
  }
} finally {
  $safePrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'; $resolved = [IO.Path]::GetFullPath($runDirectory)
  if ((Test-Path -LiteralPath $runDirectory) -and $resolved.StartsWith($safePrefix,[StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runDirectory -Recurse -Force }
}

Assert-Trust ($null -ne $receipt) 'Scenario receipt missing'
if ($null -ne $receipt) {
  Assert-Trust ($receipt.task_id -eq 'NX-TRUST-P01' -and $receipt.status -eq 'PASS' -and [int]$receipt.assertions -ge 75) 'Scenario assertion regression'
  Assert-Trust (@($receipt.corpus.surfaces).Count -eq 7 -and [int]$receipt.corpus.coverage_percent -eq 100 -and -not [bool]$receipt.corpus.ordinary_human_preapproval_required) 'Corpus automation drift'
  Assert-Trust (-not [bool]$receipt.automation.single_probabilistic_signal_final_takedown -and [int]$receipt.automation.independent_vote_threshold -eq 2 -and [bool]$receipt.automation.immutable_match_only_final_block -and [bool]$receipt.automation.immutable_evidence_independent_authority) 'Automation receipt drift'
  foreach ($property in @('separate_axes','calibrated_ai_range_only')) { Assert-Trust ([bool]$receipt.presentation.$property) "Presentation proof false: $property" }
  foreach ($property in @('universal_truth_score','honesty_score','ideology_score','attractiveness_score')) { Assert-Trust (-not [bool]$receipt.presentation.$property) "Prohibited score receipt true: $property" }
  foreach ($property in @('viewpoint_parity','paid_ad_transparency')) { Assert-Trust ([bool]$receipt.political_integrity.$property) "Political proof false: $property" }
  Assert-Trust (-not [bool]$receipt.political_integrity.opinion_inference -and -not [bool]$receipt.political_integrity.sensitive_targeting) 'Political inference/targeting escaped'
  foreach ($property in @('exact_binding','signed','ordered_lineage','one_time','restore','appeal_route','trust_registry_bound','governance_heads_restored')) { Assert-Trust ([bool]$receipt.receipts.$property) "Receipt proof false: $property" }
  foreach ($property in @('distinct_authority_roots','policy_monotonic','policy_equivocation_denied','model_manifest_signed','model_monotonic','model_equivocation_denied','explicit_rollback_one_time','rollback_state_restored')) { Assert-Trust ([bool]$receipt.governance.$property) "Governance proof false: $property" }
  foreach ($property in @('exact_shape','boolean_string','binding_substitution','policy_expiry','signal_expiry','signal_pre_creation','evidence_after_signal','evidence_expiry_bound','rogue_evidence_authority','evidence_content_substitution','authority_colocation','inactive_root','trust_root_substitution','policy_rollback','policy_equivocation','model_rollback','model_equivocation','same_content_model_substitution','rollback_replay_after_restore','canonical_normalization','replay','concurrent_duplicate','snapshot_prefix','snapshot_reorder','snapshot_fabrication','restore_toctou')) { Assert-Trust ([bool]$receipt.negative.$property) "Negative proof false: $property" }
  Assert-Trust ($receipt.synthetic_isolation.actor_class -eq 'SYSTEM_TEST' -and [int]$receipt.synthetic_isolation.rewards_accrued -eq 0 -and [int]$receipt.synthetic_isolation.organic_events -eq 0) 'Synthetic isolation failed'
  Assert-Trust ([int]$receipt.network_operations -eq 0 -and [int]$receipt.provider_operations -eq 0 -and [int]$receipt.economic_operations -eq 0 -and [int]$receipt.real_fund_operations -eq 0 -and [decimal]$receipt.incremental_cost.amount -eq 0) 'Effect escaped'
}

$hashes = [ordered]@{}
foreach ($path in $paths.Values) { if (Test-Path -LiteralPath $path -PathType Leaf) { $relative = $path.Substring($root.Length).TrimStart('\').Replace('\','/'); $hashes[$relative] = Get-Sha $path } }
$subject = Get-TextSha (($hashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
  schema_version = 1; task_id = 'NX-TRUST-P01'; run_id = $RunId; executor_role = $ExecutorRole
  status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
  scope = 'local_automated_eu_trust_cascade_independent_immutable_evidence_and_signed_receipt_lineage'
  assertions = $assertions; scenario_assertions = if ($receipt) { [int]$receipt.assertions } else { 0 }; deterministic_repetitions = @($runs).Count
  failures = @($failures); corpus = if ($receipt) { $receipt.corpus } else { $null }; outcomes = if ($receipt) { $receipt.outcomes } else { $null }
  automation = if ($receipt) { $receipt.automation } else { $null }; presentation = if ($receipt) { $receipt.presentation } else { $null }
  political_integrity = if ($receipt) { $receipt.political_integrity } else { $null }; receipts = if ($receipt) { $receipt.receipts } else { $null }; governance = if ($receipt) { $receipt.governance } else { $null }
  negative = if ($receipt) { $receipt.negative } else { $null }; synthetic_isolation = if ($receipt) { $receipt.synthetic_isolation } else { $null }
  credential_name_matches = $credentialNames.Count; network_operations = 0; external_provider_operations = 0; economic_operations = 0; real_fund_operations = 0
  incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }; claims_excluded = @($contract.claimsExcluded)
  review_subject_sha256 = $subject; artifact_sha256 = $hashes; duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds,4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
