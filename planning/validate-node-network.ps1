[CmdletBinding()]
param(
  [string]$RunId = ('NX-NODE-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)),
  [ValidateSet('UNSPECIFIED','A16','C02','C03','C09','C13')][string]$ExecutorRole = 'UNSPECIFIED'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Node([bool]$Condition,[string]$Message){$script:assertions++;if(-not $Condition){$script:failures.Add($Message)}}
function Read-Utf8([string]$Path){[IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8)}
function Get-Sha([string]$Path){(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Get-TextSha([string]$Value){$sha=[Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Get-Node { $root=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'; if(Test-Path -LiteralPath $root){Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse|Sort-Object FullName|Select-Object -Last 1 -ExpandProperty FullName} }
function Invoke-Node([string]$Node,[string[]]$Arguments,[string]$WorkingDirectory){$quoted=@($Arguments|ForEach-Object{'"'+$_.Replace('"','\"')+'"'})-join' ';$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments=$quoted;$info.WorkingDirectory=$WorkingDirectory;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$process=[Diagnostics.Process]::new();$process.StartInfo=$info;try{if(-not $process.Start()){throw 'node start failed'};$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();if(-not $process.WaitForExit(30000)){$process.Kill();throw 'node timeout'};[ordered]@{exit_code=$process.ExitCode;stdout=$stdout.Trim();stderr=$stderr.Trim()}}finally{$process.Dispose()}}

$root=Split-Path -Parent $PSScriptRoot
$paths=[ordered]@{
  source=Join-Path $root 'packages\node-network\api\index.ts'
  tests=Join-Path $root 'packages\node-network\api\index.test.ts'
  contract=Join-Path $root 'packages\node-network\api\node-contract.v1.json'
  architecture_doc=Join-Path $root 'docs\01-technical-architecture.md'
  node_doc=Join-Path $root 'docs\17-decentralized-node-network.md'
  assurance_doc=Join-Path $root 'docs\16-agent-delivery-continuous-assurance.md'
  agents=Join-Path $root 'AGENTS.md'
  backlog0=Join-Path $PSScriptRoot 'backlog-p0.yaml'
  backlog1=Join-Path $PSScriptRoot 'backlog-p1.yaml'
  capacity=Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
  progress=Join-Path $PSScriptRoot 'product-progress.yaml'
  checkpoint=Join-Path $PSScriptRoot 'checkpoints\NX-NODE-P01.md'
  spend=Join-Path $PSScriptRoot 'spend-control.yaml'
  arch_evidence=Join-Path $PSScriptRoot 'evidence\NX-ARCH-001-validation.json'
  platform_evidence=Join-Path $PSScriptRoot 'evidence\NX-PLAT-001-validation.json'
  reducer_evidence=Join-Path $PSScriptRoot 'evidence\NX-CHAIN-002-validation.json'
  security_evidence=Join-Path $PSScriptRoot 'evidence\NX-SEC-001-validation.json'
  observability_evidence=Join-Path $PSScriptRoot 'evidence\NX-OBS-001-validation.json'
  tsc=Join-Path $root 'packages\contracts\node_modules\typescript\bin\tsc'
  lock=Join-Path $root 'packages\contracts\package-lock.json'
  validator=$PSCommandPath
}
foreach($path in $paths.Values){Assert-Node (Test-Path -LiteralPath $path -PathType Leaf) "Missing: $path"}
Assert-Node ($RunId -match '^NX-NODE-P01-[A-Za-z0-9T._-]+$') 'Run id invalid'
Assert-Node ($ExecutorRole -ne 'UNSPECIFIED') 'Executor role required'

$source=Read-Utf8 $paths.source;$tests=Read-Utf8 $paths.tests;$contract=Read-Utf8 $paths.contract|ConvertFrom-Json
$b0=Read-Utf8 $paths.backlog0;$b1=Read-Utf8 $paths.backlog1;$capacity=Read-Utf8 $paths.capacity;$progress=Read-Utf8 $paths.progress;$checkpoint=Read-Utf8 $paths.checkpoint;$spend=Read-Utf8 $paths.spend
$task=[regex]::Match($b1,'(?ms)^  - task_id:\s*NX-NODE-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Node $task.Success 'Packet missing'
if($task.Success){Assert-Node ($task.Groups[1].Value-match'(?m)^\s+owner_agent:\s*A16\s*$') 'Owner drift';Assert-Node ($task.Groups[1].Value-match'(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet inactive';Assert-Node ($task.Groups[1].Value-match'(?m)^\s+risk_class:\s*T0\s*$') 'Risk drift';Assert-Node ($task.Groups[1].Value-match'(?m)^\s+control_reviewers:\s*\[C02, C03, C09, C13\]\s*$') 'Review roles drift'}
foreach($dependency in @('NX-ARCH-001','NX-PLAT-001','NX-CHAIN-002','NX-SEC-001','NX-OBS-001')){$match=[regex]::Match($b0,('(?ms)^  - task_id:\s*'+$dependency+'\s*\r?\n(.*?)(?=^  - task_id:|\z)'));Assert-Node ($match.Success-and$match.Groups[1].Value-match'(?m)^\s+status:\s*done\s*$') "Dependency not done: $dependency"}
$active=@([regex]::Matches($b1,'(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)')|Where-Object{$_.Groups[2].Value-match'(?m)^\s+record_kind:\s*task_packet\s*$'-and$_.Groups[2].Value-match'(?m)^\s+status:\s*(in_progress|review)\s*$'}|ForEach-Object{$_.Groups[1].Value})
Assert-Node ($active.Count-eq1-and$active[0]-eq'NX-NODE-P01') 'WIP violated'
Assert-Node ($capacity-match'(?m)^\s+active_task_id:\s+NX-NODE-P01\s*$'-and$capacity-match'(?m)^\s+active_packets:\s+1\s*$') 'Capacity state mismatch'
Assert-Node ($progress-match'(?m)^\s+active_packet_id:\s+NX-NODE-P01\s*$') 'Progress state mismatch'
Assert-Node ($checkpoint-match'(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch'

Assert-Node ($contract.schemaVersion-eq1-and$contract.owner-eq'A16'-and$contract.mode-eq'D0_GENESIS'-and$contract.protocol-eq'/nexus/shards/1.0'-and[int]$contract.replicationFactor-eq1) 'Contract identity drift'
Assert-Node ((@($contract.roles)-join',')-eq'GATEWAY,EVENT_LOG,REPLICA,STORAGE,INDEX,JOBS') 'Genesis roles drift'
foreach($property in @('appendOnly','signedCommands','sha256OrderedLineage','durableReplayIndex','tombstonesRetained','concurrentMutationsSerialized')){Assert-Node ([bool]$contract.eventLog.$property) "Event log contract false: $property"}
foreach($property in @('reducerVersionBound','rangeBound','stateRootSha256','eventHeadBound','authorityVerified','previousCheckpointBound','exactShapeRestore')){Assert-Node ([bool]$contract.checkpoint.$property) "Checkpoint contract false: $property"}
foreach($property in @('freshInstanceRequired','sameStateRootRequired','sameEventHeadRequired','sameReplayResultRequired','prefixReorderFabricationDenied','validateBeforeAtomicBackupCommit','sourceRuntimeDisposedFailClosed')){Assert-Node ([bool]$contract.recovery.$property) "Recovery contract false: $property"}
Assert-Node ([int]$contract.limits.networkOperationsMax-eq0-and[int]$contract.limits.externalProviderOperationsMax-eq0-and[int]$contract.limits.realFundOperationsMax-eq0-and[int]$contract.limits.incrementalCostEurMax-eq0) 'Effect limits drift'
foreach($claim in @('p2p_network','public_ports','production_disk_durability','n_2_to_8_replication','mainnet_anchor','real_data')){Assert-Node (@($contract.claimsExcluded)-contains$claim) "Excluded claim missing: $claim"}

foreach($fragment in @('D0_GENESIS','/nexus/shards/1.0','genesis-reducer/1.0.0','SYSTEM_TEST','GenesisFixtureAuthority','GenesisBackupStore','canonicalSnapshot','GENESIS_BACKUP_CONFLICT','GENESIS_NODE_DISPOSED','operationTail','exclusive<','previousCheckpointHash','GENESIS_EVENT_LINEAGE_INVALID','GENESIS_STATE_ROOT_MISMATCH')){Assert-Node $source.Contains($fragment) "Source control missing: $fragment"}
foreach($fragment in @('validated checkpoint commits atomically to local backup','source runtime is explicitly disposed after backup','pending backup ignores caller mutation after canonical capture','stored backup bytes restore and match receipt after caller mutation','getter-backed input is captured exactly once before validation','concurrent append receives one strict ordinal sequence','concurrent append preserves one hash lineage','concurrent duplicate commits exactly once','fresh restore projection is byte-identical','same corpus exports identical checkpoint')){Assert-Node $tests.Contains($fragment) "Test control missing: $fragment"}
foreach($pair in @(@($paths.node_doc,'R = min(N_eligible, target_replication)'),@($paths.node_doc,'backup local obligatoriu'),@($paths.node_doc,'checkpoint-ul con'),@($paths.assurance_doc,'Genesis `N=1`'),@($paths.agents,'default_deny_spend'))){Assert-Node (Read-Utf8 $pair[0]).Contains($pair[1]) "Normative fragment missing: $($pair[1])"}
Assert-Node ($source-notmatch'(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|console\.log)') 'Runtime network/process capability detected'
Assert-Node ($spend-match'(?m)^mode:\s*default_deny_spend\s*$'-and$spend-match'(?m)^\s*max_incremental_amount:\s*0\s*$') 'Spend policy drift'
foreach($evidencePath in @($paths.arch_evidence,$paths.platform_evidence,$paths.reducer_evidence,$paths.security_evidence,$paths.observability_evidence)){$evidence=Read-Utf8 $evidencePath|ConvertFrom-Json;Assert-Node ($evidence.status-eq'PASS') "Dependency evidence not PASS: $evidencePath"}
$credentialPattern='^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames=@([Environment]::GetEnvironmentVariables().Keys|ForEach-Object{[string]$_}|Where-Object{$_-match$credentialPattern})
Assert-Node ($credentialNames.Count-eq0) 'Production or billing credential name present'

$node=Get-Node;Assert-Node ($null-ne$node) 'Node runtime missing'
$ephemeralRoot=Join-Path $root '.ephemeral';[IO.Directory]::CreateDirectory($ephemeralRoot)|Out-Null
$runDirectory=Join-Path $ephemeralRoot ('NX-NODE-P01-'+[Guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($runDirectory)|Out-Null
$runs=@();$receipt=$null
try{
  if($null-ne$node){$compile=Invoke-Node $node @($paths.tsc,'--strict','--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--outDir',$runDirectory,$paths.source,$paths.tests) $root;Assert-Node ($compile.exit_code-eq0) "Compile failed: $($compile.stderr)";if($compile.exit_code-eq0){$testPath=Join-Path $runDirectory 'index.test.js';1..3|ForEach-Object{$script:runs+=Invoke-Node $node @($testPath) $root};foreach($run in $runs){Assert-Node ($run.exit_code-eq0) "Scenario failed: $($run.stderr)"};Assert-Node (@($runs.stdout|Sort-Object -Unique).Count-eq1) 'Scenario output is nondeterministic';try{$receipt=$runs[0].stdout|ConvertFrom-Json}catch{Assert-Node $false 'Scenario receipt invalid'}}}
}finally{$safePrefix=[IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\')+'\';$resolved=[IO.Path]::GetFullPath($runDirectory);if((Test-Path -LiteralPath $runDirectory)-and$resolved.StartsWith($safePrefix,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $runDirectory -Recurse -Force}}
Assert-Node ($null-ne$receipt) 'Scenario receipt missing'
if($null-ne$receipt){Assert-Node ($receipt.status-eq'PASS'-and[int]$receipt.assertions-ge45) 'Scenario assertion regression';Assert-Node ($receipt.mode-eq'D0_GENESIS'-and[int]$receipt.node_count-eq1-and[int]$receipt.replication_factor-eq1) 'D0 result drift';Assert-Node ($receipt.state_root-match'^[a-f0-9]{64}$'-and$receipt.event_head-match'^[a-f0-9]{64}$'-and$receipt.checkpoint_hash-match'^[a-f0-9]{64}$') 'Root format invalid';foreach($property in @('atomic_commit','validated_before_commit','stable_source_snapshot','stored_restore_verified','receipt_matches_stored_bytes','getter_read_once')){Assert-Node ([bool]$receipt.backup.$property) "Backup proof false: $property"};Assert-Node ([int]$receipt.backup.byte_length-gt0-and$receipt.backup.storage_class-eq'LOCAL_FIXTURE') 'Backup receipt invalid';Assert-Node ([bool]$receipt.lifecycle.source_runtime_disposed-and[bool]$receipt.lifecycle.disposed_operations_denied) 'Lifecycle proof invalid';foreach($property in @('strict_ordinals','one_hash_lineage','duplicate_exactly_once')){Assert-Node ([bool]$receipt.concurrency.$property) "Concurrency proof false: $property"};Assert-Node ([int]$receipt.concurrency.append_count-eq24) 'Concurrent corpus count drift';foreach($property in @('fresh_instance','same_projection','same_state_root','same_event_head','replay_denied','continued_lineage')){Assert-Node ([bool]$receipt.restore.$property) "Restore proof false: $property"};foreach($property in @('manifest_roles','replication_type','actor_class','exact_command_shape','command_signature','checkpoint_exact_shape','prefix','reorder','state_root','event_head','replay_index','node_identity','authority','stale_checkpoint','fabricated_ordinal','backup_tamper','backup_missing','backup_concurrent_mutation','backup_getter_snapshot')){Assert-Node ([bool]$receipt.negative.$property) "Negative proof false: $property"};Assert-Node ([int]$receipt.network_operations-eq0-and[int]$receipt.external_provider_operations-eq0-and[int]$receipt.economic_operations-eq0-and[int]$receipt.real_fund_operations-eq0-and[decimal]$receipt.incremental_cost.amount-eq0) 'Effect escaped'}

$hashes=[ordered]@{};foreach($path in $paths.Values){if(Test-Path -LiteralPath $path -PathType Leaf){$relative=$path.Substring($root.Length).TrimStart('\').Replace('\','/');$hashes[$relative]=Get-Sha $path}}
$subject=Get-TextSha(($hashes.GetEnumerator()|Sort-Object Key|ForEach-Object{"$($_.Key)=$($_.Value)"})-join"`n")
$timer.Stop()
$result=[ordered]@{schema_version=1;task_id='NX-NODE-P01';run_id=$RunId;executor_role=$ExecutorRole;status=if($failures.Count-eq0){'PASS'}else{'FAIL'};scope='d0_genesis_atomic_backup_dispose_fresh_restore_and_concurrency';assertions=$assertions;scenario_assertions=if($receipt){[int]$receipt.assertions}else{0};deterministic_repetitions=@($runs).Count;failures=@($failures);node_count=1;replication_factor=1;state_root=if($receipt){$receipt.state_root}else{$null};event_head=if($receipt){$receipt.event_head}else{$null};checkpoint_hash=if($receipt){$receipt.checkpoint_hash}else{$null};backup=if($receipt){$receipt.backup}else{$null};lifecycle=if($receipt){$receipt.lifecycle}else{$null};concurrency=if($receipt){$receipt.concurrency}else{$null};restore=if($receipt){$receipt.restore}else{$null};negative=if($receipt){$receipt.negative}else{$null};credential_name_matches=$credentialNames.Count;network_operations=0;external_provider_operations=0;economic_operations=0;real_fund_operations=0;incremental_cost=[ordered]@{amount=0;currency='EUR'};claims_excluded=@($contract.claimsExcluded);review_subject_sha256=$subject;artifact_sha256=$hashes;duration_seconds=[math]::Round($timer.Elapsed.TotalSeconds,4)}
$result|ConvertTo-Json -Depth 12
if($failures.Count-gt0){exit 1}
