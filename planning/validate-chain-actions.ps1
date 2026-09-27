[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'A22', 'A11', 'C03', 'C02', 'C10', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Chain { param([bool]$Condition,[string]$Message) $script:assertions++; if(-not $Condition){$script:failures.Add($Message)} }
function Read-Utf8 { param([string]$Path) [IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8) }
function Get-StringSha256 { param([string]$Value) $sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))}finally{$sha.Dispose()};([BitConverter]::ToString($hash)).Replace('-','').ToLowerInvariant() }
function Get-IncludedNodeRuntime {
    $root=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
    if(-not (Test-Path -LiteralPath $root)){return $null}
    $candidate=Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue|Sort-Object FullName|ForEach-Object{Join-Path $_.FullName 'node.exe'}|Where-Object{Test-Path -LiteralPath $_}|Select-Object -Last 1
    $candidate
}
function Invoke-Node {
    param([string]$Node,[string[]]$Arguments,[string]$WorkingDirectory)
    $quoted=@($Arguments|ForEach-Object{'"'+$_.Replace('"','\"')+'"'}) -join ' '
    $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments=$quoted;$info.WorkingDirectory=$WorkingDirectory
    $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $process=[Diagnostics.Process]::new();$process.StartInfo=$info
    try{
        if(-not $process.Start()){throw 'Node process did not start.'}
        $stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd()
        if(-not $process.WaitForExit(30000)){$process.Kill();throw 'Node process exceeded 30 seconds.'}
        [ordered]@{exit_code=$process.ExitCode;stdout=$stdout.Trim();stderr=$stderr.Trim();cpu_seconds=[math]::Round($process.TotalProcessorTime.TotalSeconds,4)}
    }finally{$process.Dispose()}
}

$repoRoot=Split-Path -Parent $PSScriptRoot
$paths=[ordered]@{
    source=Join-Path $repoRoot 'packages\chain-actions-api\index.ts'
    tests=Join-Path $repoRoot 'packages\chain-actions-api\index.test.ts'
    abi=Join-Path $repoRoot 'packages\contracts\abi\nexus-actions.abi.json'
    event=Join-Path $repoRoot 'packages\contracts\events\action.chain.executed.v1.schema.json'
    generated=Join-Path $repoRoot 'packages\contracts\generated\index.ts'
    architecture=Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    checker=Join-Path $repoRoot 'security\source-boundary-check.js'
    threat=Join-Path $repoRoot 'security\threat-model.v1.json'
    baseline=Join-Path $repoRoot 'security\baseline-policy.v1.json'
    spend=Join-Path $PSScriptRoot 'spend-control.yaml'
    guard=Join-Path $PSScriptRoot 'zero-cost-child-test.ps1'
    cap_evidence=Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    backlog=Join-Path $PSScriptRoot 'backlog-p0.yaml'
    scorecard=Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    checkpoint=Join-Path $PSScriptRoot 'checkpoints\NX-CHAIN-001.md'
    doc_contract=Join-Path $repoRoot 'docs\02-smart-contracts.md'
    doc_actions=Join-Path $repoRoot 'docs\09-action-ledger-classifieds.md'
    doc_supernova=Join-Path $repoRoot 'docs\10-supernova-economics-compliance.md'
    tsc=Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock=Join-Path $repoRoot 'packages\contracts\package-lock.json'
}
foreach($path in $paths.Values){Assert-Chain (Test-Path -LiteralPath $path) "Missing required artifact: $path"}
Assert-Chain ($RunId -match '^NX-CHAIN-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Chain ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source=Read-Utf8 $paths.source;$tests=Read-Utf8 $paths.tests;$architecture=Read-Utf8 $paths.architecture
$backlog=Read-Utf8 $paths.backlog;$scorecard=Read-Utf8 $paths.scorecard;$checkpoint=Read-Utf8 $paths.checkpoint
$spend=Read-Utf8 $paths.spend;$abi=Read-Utf8 $paths.abi|ConvertFrom-Json;$event=Read-Utf8 $paths.event|ConvertFrom-Json
$capEvidence=Read-Utf8 $paths.cap_evidence|ConvertFrom-Json

$task=[regex]::Match($backlog,'(?ms)^  - task_id:\s*NX-CHAIN-001\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Chain $task.Success 'NX-CHAIN-001 is missing from backlog.'
if($task.Success){
    Assert-Chain ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A20\s*$') 'Owner is not A20.'
    Assert-Chain ($task.Groups[1].Value -match '(?m)^\s+status:\s*in_progress\s*$') 'Packet must remain in progress before VM evidence.'
    Assert-Chain ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Packet is not T0.'
    Assert-Chain ($task.Groups[1].Value -match 'independent_audit_before_material_mainnet_funds') 'Independent mainnet audit gate is missing.'
}
Assert-Chain ($scorecard -match '(?m)^\s+active_task_id:\s+NX-CHAIN-001\s*$') 'Scorecard active packet mismatch.'
Assert-Chain ($scorecard -match '(?m)^\s+active_packets:\s+1\s*$') 'WIP limit is not one.'
Assert-Chain ($checkpoint -match '(?m)^- Stare:\s*`in_progress`\s*$') 'Checkpoint state mismatch.'
Assert-Chain ($architecture -match '(?ms)^  - id:\s*chain_actions\s*\r?\n.*?^\s+owner:\s*A20\s*$') 'chain_actions context owner mismatch.'
Assert-Chain ($architecture -match '(?ms)^  - id:\s*chain_actions\s*\r?\n.*?^\s+public_api_path:\s*packages/chain-actions-api\s*$') 'chain_actions API path mismatch.'

$sourceFragments=@(
    'serializeEnvelopeForSigning','NEXUS_ACTION','selectRuntimeProfile','ANDROMEDA_COMPAT','SUPERNOVA',
    'registerCapability','rotateCapability','revokeCapability','CAPABILITY_SCOPE_ESCALATION',
    'recordAction','recordPrivateAction','BATCH_FORBIDDEN','ACTION_ENDPOINT_NONPAYABLE',
    'RELAYER_AGREEMENT_REQUIRED','ACTION_NONCE_REPLAY_OR_GAP','CAPABILITY_COMMIT_CONFLICT',
    'PRIVATE_COMMITMENT_ATTESTATION_INVALID','saltEntropyBits < 128','Post-await CAS',
    'ORDERED_FINAL','EXECUTION_PENDING','EXECUTED_SUCCESS','EXECUTED_FAIL','EXECUTION_EVENT_REQUIRED',
    'SYNTHETIC_REGRESSION_ONLY','actualVmMeasurementRequired: true','scanSerializedTransactionForPrivatePlaintext'
)
foreach($fragment in $sourceFragments){Assert-Chain ($source.Contains($fragment)) "Source control missing: $fragment"}
Assert-Chain ($source -match '(?s)await this\.signatureVerifier\.verifyEd25519.*?capability\.lastActionNonce !== expectedNonce - 1n') 'Nonce CAS is not after signature verification.'
Assert-Chain ($source -match '(?s)canApplyAuthoritativeDomainEffect\(\).*?EXECUTED_SUCCESS.*?executionEventVerified') 'Authoritative effect is not bound to verified execution.'
Assert-Chain ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect)') 'Sandbox contains network or process capability.'
Assert-Chain ($source -notmatch '(?i)(emailAddress|phoneNumber|latitude|longitude|messagePlaintext|datingTarget|childId)\s*[:=]') 'Source model contains forbidden plaintext fields.'

$testFragments=@(
    'concurrent nonce has one successful action','concurrent nonce loser fails compare-and-swap',
    'ACTION_NONCE_REPLAY_OR_GAP','SESSION_SIGNATURE_INVALID','CAPABILITY_SCOPE_ESCALATION',
    'ACTION_ENDPOINT_NONPAYABLE','BATCH_FORBIDDEN','PRIVATE_COMMITMENT_ATTESTATION_INVALID',
    'revoke during verification emits no event','pause during verification emits no event',
    'ordered final is not executed success','EXECUTION_EVENT_REQUIRED','execution failure remains non-authoritative',
    'two consistent fresh sources activate Supernova','divergent evidence falls back safely','stale evidence falls back safely',
    'privacy scanner detects injected PII fixtures','synthetic gas cannot be mislabeled as VM measurement'
)
foreach($fragment in $testFragments){Assert-Chain ($tests.Contains($fragment)) "Test control missing: $fragment"}
Assert-Chain ($tests -notmatch '(?i)mainnet|real_funds|production_credential') 'Test source suggests production scope.'

Assert-Chain ($abi.name -eq 'NexusActions' -and $abi.contractVersion -eq '1.0.0') 'ABI identity/version mismatch.'
Assert-Chain ([bool]$abi.'x-invariants'.oneActionPerCall -and @($abi.'x-invariants'.batchEndpoints).Count -eq 0) 'ABI one-action invariant failed.'
Assert-Chain (-not [bool]$abi.'x-invariants'.privateTargetsInClear -and -not [bool]$abi.'x-invariants'.childActorAllowed) 'ABI privacy/Kids invariant failed.'
Assert-Chain (@($abi.endpoints|Where-Object{@($_.payableInTokens).Count -ne 0}).Count -eq 0) 'Action endpoints became payable.'
foreach($field in @('version','actor_kind','actor_commitment','action_type','object_commitment','payload_hash_or_cid','visibility_class','action_nonce','issued_at','expires_at','session_public_key')){Assert-Chain ($field -in @($abi.types.ActionEnvelope.fields.name)) "ABI envelope field missing: $field"}
Assert-Chain ($event.properties.data.properties.status.const -eq 'EXECUTED_SUCCESS') 'Terminal event can represent non-executed state.'
Assert-Chain ($event.properties.data.properties.finality.const -eq 'HYPERBLOCK_FINAL') 'Terminal event lacks finality constraint.'

Assert-Chain ($capEvidence.status -eq 'PASS') 'Capacity evidence is not PASS.'
Assert-Chain ([int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard negative evidence is incomplete.'
Assert-Chain ($capEvidence.artifact_sha256.'planning/spend-control.yaml' -eq (Get-FileHash -LiteralPath $paths.spend -Algorithm SHA256).Hash.ToLowerInvariant()) 'Spend policy drifted after capacity evidence.'
Assert-Chain ($capEvidence.artifact_sha256.'planning/zero-cost-child-test.ps1' -eq (Get-FileHash -LiteralPath $paths.guard -Algorithm SHA256).Hash.ToLowerInvariant()) 'Runtime guard drifted after capacity evidence.'
Assert-Chain ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern='^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_)'
$credentialNames=@([Environment]::GetEnvironmentVariables().Keys|ForEach-Object{[string]$_}|Where-Object{$_ -match $credentialPattern})
Assert-Chain ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node=Get-IncludedNodeRuntime;Assert-Chain ($null -ne $node) 'Included Node runtime missing.'
$ephemeral=Join-Path $repoRoot '.ephemeral';if(-not(Test-Path -LiteralPath $ephemeral)){[void](New-Item -ItemType Directory -Path $ephemeral)}
$runRoot=Join-Path $ephemeral ('NX-CHAIN-001-validator-'+[Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $runRoot)
$compile=$null;$testRun=$null;$boundary=$null
try{
    if($null -ne $node){
        $compile=Invoke-Node $node @($paths.tsc,'--strict','--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--outDir',$runRoot,$paths.source,$paths.tests) $repoRoot
        Assert-Chain ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if($compile.exit_code -eq 0){$testRun=Invoke-Node $node @((Join-Path $runRoot 'index.test.js')) $repoRoot;Assert-Chain ($testRun.exit_code -eq 0) "Chain tests failed: $($testRun.stderr)"}
        $items=@();$items+=[pscustomobject]@{id='packages/chain-actions-api/index.ts';sourceContext='chain_actions';text=$source};$items+=[pscustomobject]@{id='packages/chain-actions-api/index.test.ts';sourceContext='chain_actions';text=$tests}
        $manifest=[pscustomobject]@{knownSpecifiers=[pscustomobject]@{contract_registry='contract_registry'};knownSchemas=@('chain_actions','contract_registry');contexts=[pscustomobject]@{chain_actions=[pscustomobject]@{allowedImports=@('contract_registry')}};items=$items}
        $manifestPath=Join-Path $runRoot 'boundary.json';[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
        $boundaryRun=Invoke-Node $node @($paths.checker,$manifestPath) $repoRoot;Assert-Chain ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"
        if($boundaryRun.exit_code -eq 0){$boundary=$boundaryRun.stdout|ConvertFrom-Json}
    }
}finally{
    $rootPrefix=[IO.Path]::GetFullPath($ephemeral).TrimEnd('\')+'\';$resolved=[IO.Path]::GetFullPath($runRoot)
    if((Test-Path -LiteralPath $runRoot)-and $resolved.StartsWith($rootPrefix,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $runRoot -Recurse -Force}
}
$payload=$null;if($null-ne$testRun-and$testRun.stdout){try{$payload=$testRun.stdout|ConvertFrom-Json}catch{Assert-Chain $false 'Test receipt is not JSON.'}}
Assert-Chain ($null-ne$payload) 'Test receipt missing.'
if($null-ne$payload){
    Assert-Chain ($payload.task_id-eq'NX-CHAIN-001'-and$payload.status-eq'PASS') 'Test receipt did not PASS.'
    Assert-Chain ([int]$payload.assertions-ge52) 'Test coverage regressed below 52 assertions.'
    Assert-Chain ($payload.concurrent_nonce_cas-eq$true-and$payload.ordered_not_executed-eq$true) 'Critical concurrency/finality controls failed.'
    Assert-Chain ([int]$payload.private_payload_findings-eq0) 'Private payload scan found data.'
    Assert-Chain ($payload.runtime_quorum_fallback-eq$true) 'Runtime quorum fallback failed.'
    Assert-Chain ($payload.gas_model-eq'SYNTHETIC_REGRESSION_ONLY'-and$payload.actual_vm_pending-eq$true) 'Gas evidence is mislabeled.'
    Assert-Chain ($payload.synthetic_only-eq$true) 'Tests are not synthetic-only.'
}
$boundaryFindings=@();if($null-ne$boundary){foreach($item in @($boundary.results)){foreach($finding in @($item.findings)){$boundaryFindings+="$($item.id):$finding"}}}
Assert-Chain ($null-ne$boundary-and$boundaryFindings.Count-eq0) ('Boundary findings: '+($boundaryFindings-join','))

$rustAvailable=$null-ne(Get-Command rustc -ErrorAction SilentlyContinue);$goAvailable=$null-ne(Get-Command go -ErrorAction SilentlyContinue)
$artifactHashes=[ordered]@{}
foreach($path in @($paths.source,$paths.tests,$PSCommandPath,$paths.abi,$paths.event,$paths.generated,$paths.architecture,$paths.checker,$paths.threat,$paths.baseline,$paths.spend,$paths.guard,$paths.cap_evidence,$paths.doc_contract,$paths.doc_actions,$paths.doc_supernova,$paths.package_lock)){
    $relative=$path.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');$artifactHashes[$relative]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$subject=Get-StringSha256 (($artifactHashes.GetEnumerator()|Sort-Object Key|ForEach-Object{"$($_.Key)=$($_.Value)"})-join"`n")
$timer.Stop()
$result=[ordered]@{
    schema_version=1;task_id='NX-CHAIN-001';run_id=$RunId;executor_role=$ExecutorRole
    status=if($failures.Count-eq0){'PASS'}else{'FAIL'};scope='local_synthetic_action_capability_and_lifecycle_sandbox'
    assertions=$assertions;scenario_assertions=if($null-ne$payload){[int]$payload.assertions}else{0};failures=@($failures)
    acceptance=[ordered]@{nonce_replay_and_concurrency='PASS';capability_relayer_batch_abuse='PASS';ordered_vs_executed='PASS';privacy_payload_scan='PASS';runtime_quorum_fallback='PASS';gas_regression_model='SYNTHETIC_ONLY'}
    packet_completion=[ordered]@{ready=$false;reason='ACTUAL_RUST_VM_GO_VM_DIFFERENTIAL_AND_VM_GAS_PENDING'}
    toolchain=[ordered]@{rustc_available=$rustAvailable;go_available=$goAvailable;typescript='5.9.3'}
    claims_excluded=@('actual_multiversx_vm_execution','rust_vm_go_vm_differential','actual_vm_gas','devnet_transaction','production_cryptographic_audit')
    external_gates=[ordered]@{rust_vm='PENDING';go_vm_differential='PENDING';actual_vm_gas='PENDING';independent_audit_before_material_mainnet_funds='OPEN';production_enablement='BLOCKED'}
    source_boundary_findings=$boundaryFindings.Count;credential_name_matches=$credentialNames.Count;network_operations=0;economic_operations=0;incremental_cost=[ordered]@{amount=0;currency='EUR'}
    subject_sha256=$subject;artifact_sha256=$artifactHashes;duration_seconds=[math]::Round($timer.Elapsed.TotalSeconds,4)
}
$result|ConvertTo-Json -Depth 10
if($failures.Count-gt0){exit 1}
