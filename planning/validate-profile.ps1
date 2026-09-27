[CmdletBinding()]
param(
    [string]$RunId = ('NX-PROFILE-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A12', 'A13', 'A30', 'C01', 'C02', 'C04')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Profile { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
function Read-Utf8 { param([string]$Path) [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 { param([string]$Value) $sha = [Security.Cryptography.SHA256]::Create(); try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() } }
function Get-IncludedNodeRuntime { $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'; if (-not (Test-Path -LiteralPath $root)) { return $null }; Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName }
function Invoke-LocalNode {
    param([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new(); $info.FileName = $Node; $info.Arguments = $quoted; $info.WorkingDirectory = $WorkingDirectory; $info.UseShellExecute = $false; $info.CreateNoWindow = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
    try { if (-not $process.Start()) { throw 'Node process did not start.' }; $stdout = $process.StandardOutput.ReadToEnd(); $stderr = $process.StandardError.ReadToEnd(); if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Node process exceeded 30 seconds.' }; [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4) } } finally { $process.Dispose() }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
    source = Join-Path $repoRoot 'packages\profile\api\index.ts'
    tests = Join-Path $repoRoot 'packages\profile\api\index.test.ts'
    contract = Join-Path $repoRoot 'packages\profile\api\profile-visibility-contract.v1.json'
    data_doc = Join-Path $repoRoot 'docs\03-data-api.md'
    security_doc = Join-Path $repoRoot 'docs\04-security-compliance.md'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog_p0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    backlog_p1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
    capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    progress = Join-Path $PSScriptRoot 'product-progress.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-PROFILE-P01.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Profile (Test-Path -LiteralPath $path -PathType Leaf) "Missing artifact: $path" }
Assert-Profile ($RunId -match '^NX-PROFILE-P01-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Profile ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source; $tests = Read-Utf8 $paths.tests; $contract = Read-Utf8 $paths.contract | ConvertFrom-Json; $dataDoc = Read-Utf8 $paths.data_doc; $securityDoc = Read-Utf8 $paths.security_doc; $architecture = Read-Utf8 $paths.architecture; $backlogP0 = Read-Utf8 $paths.backlog_p0; $backlogP1 = Read-Utf8 $paths.backlog_p1; $capacity = Read-Utf8 $paths.capacity; $progress = Read-Utf8 $paths.progress; $checkpoint = Read-Utf8 $paths.checkpoint; $spend = Read-Utf8 $paths.spend; $capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json

$task = [regex]::Match($backlogP1, '(?ms)^  - task_id:\s*NX-PROFILE-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Profile $task.Success 'NX-PROFILE-P01 is missing from P1 backlog.'
if ($task.Success) { Assert-Profile ($task.Groups[1].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$') 'NX-PROFILE-P01 is not a task packet.'; Assert-Profile ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A12\s*$') 'Owner is not A12.'; Assert-Profile ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'; Assert-Profile ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Packet is not T0.' }
foreach ($dependency in @('NX-AUTH-001', 'NX-CONTRACT-001', 'NX-SEC-001', 'NX-OBS-001')) { $record = [regex]::Match($backlogP0, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)')); Assert-Profile ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "Dependency not done: $dependency" }
$activePackets = @([regex]::Matches($backlogP1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object { $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$' } | ForEach-Object { $_.Groups[1].Value })
Assert-Profile ($activePackets.Count -eq 1 -and $activePackets[0] -eq 'NX-PROFILE-P01') 'WIP one active task packet is violated.'
Assert-Profile ($capacity -match '(?m)^\s+active_packets:\s+1\s*$' -and $capacity -match '(?m)^\s+active_task_id:\s+NX-PROFILE-P01\s*$') 'Capacity active task mismatch.'
Assert-Profile ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'
Assert-Profile ($progress -match '(?m)^\s+active_packet_id:\s+NX-PROFILE-P01\s*$') 'Progress active packet mismatch.'
Assert-Profile ($architecture -match '(?ms)^  - id:\s*profile_core\s*\r?\n.*?^\s+owner:\s*A12\s*$') 'Profile context owner missing.'
Assert-Profile ($architecture -match '(?ms)^  - id:\s*profile_core\s*\r?\n.*?^\s+public_api_path:\s*packages/profile/api\s*$') 'Profile public API path missing.'
Assert-Profile ($architecture -match '(?ms)^  - id:\s*profile_core\s*\r?\n.*?^\s+data_access:\s*\[PUBLIC, ACCOUNT_PRIVATE\]\s*$') 'Profile data boundary mismatch.'

Assert-Profile ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.1.0' -and $contract.owner -eq 'A12' -and $contract.defaultDecision -eq 'DENY') 'Profile contract identity or default decision drifted.'
Assert-Profile (@($contract.profileTypes).Count -eq 5 -and @($contract.profileTypes) -contains 'DATING' -and @($contract.profileTypes) -contains 'WORK' -and @($contract.profileTypes) -contains 'SOCIAL') 'Profile type matrix drifted.'
Assert-Profile (@($contract.sessionBinding).Count -eq 13 -and @($contract.accessBinding).Count -eq 11 -and @($contract.grantBinding).Count -eq 15) 'Session/access/grant binding is incomplete.'
Assert-Profile ([bool]$contract.rules.sameWalletIsNotAuthorization -and [bool]$contract.rules.activeProfileMustMatch -and [bool]$contract.rules.signedProfileTypeProvenanceRequired -and $contract.rules.staleGeneration -eq 'DENY' -and [bool]$contract.rules.globalBlockPrecedesAudience -and [bool]$contract.rules.crossProfileRequiresSignedGrant -and $contract.rules.datingGlobalDiscoveryWithoutEntitlement -eq 'DENY' -and $contract.rules.incognitoGlobalLinking -eq 'DENY') 'Privacy matrix rules drifted.'
Assert-Profile ($contract.clientPolicy -eq 'SAME_DECISION_FUNCTION_AS_API' -and -not [bool]$contract.auditTrace.rawProfileIdsAllowed -and [bool]$contract.auditTrace.actorCommitmentRequired -and [bool]$contract.auditTrace.resourceCommitmentRequired -and [bool]$contract.auditTrace.syntheticOnlyInCurrentPacket) 'Client parity or trace privacy drifted.'

foreach ($fragment in @('profile_links', 'visibility_policies', 'Dating nu apare', 'AUTH_INVALID', 'PROFILE_FORBIDDEN', 'AUDIENCE_DENIED', 'CONTEXT_STALE', 'active profile ownership')) { Assert-Profile ($dataDoc.Contains($fragment)) "Data/API specification missing: $fragment" }
foreach ($fragment in @('deny by default', 'actorProfileId', 'X-Nexus-Profile', 'block global', 'Dating rule engine', 'Incognito')) { Assert-Profile ($securityDoc.Contains($fragment)) "Security specification missing: $fragment" }
foreach ($fragment in @('authorizeProfileRead', 'clientCanRender', 'switchProfile', 'VisibilityGrantRegistry', 'PROFILE_TYPE_BINDING_MISMATCH', 'profileTypeBinding', 'REGISTRY_CHECKPOINT_UNVERIFIED', 'GRANT_EVENT_REPLAY', 'POLICY_VERSION_STALE', 'DATING_GLOBAL_DENIED', 'INCOGNITO_DISCOVERY_DENIED', 'buildAccessDenialTrace')) { Assert-Profile ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('client denies Work to Social without grant', 'client omits Dating from global discovery', 'profile switch advances signed generation', 'same_wallet_not_authorization', 'profile_type_substitution_denied', 'self_owner_type_substitution_denied', 'grant_profile_type_substitution_denied', 'revocation survives verified restart', 'missing_reordered_tampered_events_denied', 'denial trace contains commitments')) { Assert-Profile ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Profile ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.|console\.log)') 'Profile runtime can perform network/process/log operations.'

Assert-Profile ($capEvidence.status -eq 'PASS' -and [int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Profile ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Profile ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime; Assert-Profile ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'; [IO.Directory]::CreateDirectory($ephemeralRoot) | Out-Null; $runRoot = Join-Path $ephemeralRoot ('NX-PROFILE-P01-validator-' + [Guid]::NewGuid().ToString('N')); [IO.Directory]::CreateDirectory($runRoot) | Out-Null
$compile = $null; $testRuns = @(); $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot; Assert-Profile ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) { 1..3 | ForEach-Object { $script:testRuns += Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot }; foreach ($run in $testRuns) { Assert-Profile ($run.exit_code -eq 0) "Profile tests failed: $($run.stderr)" }; Assert-Profile (@($testRuns.stdout | Sort-Object -Unique).Count -eq 1) 'Deterministic repetitions produced different receipts.'; try { $testReceipt = $testRuns[0].stdout | ConvertFrom-Json } catch { Assert-Profile $false 'Test receipt is not JSON.' } }
        $items = @([pscustomobject]@{ id = 'packages/profile/api/index.ts'; sourceContext = 'profile_core'; text = $source }, [pscustomobject]@{ id = 'packages/profile/api/index.test.ts'; sourceContext = 'profile_core'; text = $tests }); $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{ identity = 'identity'; contract_registry = 'contract_registry' }; knownSchemas = @('profile_core', 'identity', 'contract_registry'); contexts = [pscustomobject]@{ profile_core = [pscustomobject]@{ allowedImports = @('identity', 'contract_registry') } }; items = $items }; $manifestPath = Join-Path $runRoot 'boundary.json'; [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false)); $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot; Assert-Profile ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"; if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally { $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'; $resolved = [IO.Path]::GetFullPath($runRoot); if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force } }

Assert-Profile ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) { Assert-Profile ($testReceipt.task_id -eq 'NX-PROFILE-P01' -and $testReceipt.status -eq 'PASS' -and [int]$testReceipt.assertions -ge 91) 'Profile scenario receipt regressed.'; Assert-Profile ([int]$testReceipt.matrix.profile_types -eq 5 -and [int]$testReceipt.matrix.combinations -eq 25 -and [int]$testReceipt.matrix.unauthorized_cross_profile_denials -eq 20) 'Cross-profile matrix coverage mismatch.'; foreach ($property in @('work_to_social_api_denied', 'work_to_social_client_denied', 'dating_global_api_denied', 'dating_global_client_denied', 'dating_self_global_denied', 'profile_type_substitution_denied', 'self_owner_type_substitution_denied', 'grant_profile_type_substitution_denied', 'stale_generation_denied', 'incognito_global_denied', 'block_precedes_grant', 'same_wallet_not_authorization', 'grant_replay_denied_after_restart', 'revoked_grant_denied_after_restart', 'missing_reordered_tampered_events_denied', 'checkpoint_required', 'raw_profile_ids_absent_from_trace')) { Assert-Profile ([bool]$testReceipt.negative.$property) "Negative control failed: $property" }; $traceJson = $testReceipt.denial_trace | ConvertTo-Json -Compress; Assert-Profile ($testReceipt.denial_trace.actorClass -eq 'SYSTEM_TEST' -and $testReceipt.denial_trace.code -eq 'DATING_GLOBAL_DENIED' -and $traceJson -notmatch 'PROFILE:') 'Denial trace leaks raw profile identifiers.'; Assert-Profile ([int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0 -and [int]$testReceipt.external_provider_operations -eq 0 -and [decimal]$testReceipt.incremental_cost.amount -eq 0) 'Profile tests escaped zero-effect mode.' }
$boundaryFindings = @(); if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }; Assert-Profile ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}; foreach ($path in $paths.Values) { if (Test-Path -LiteralPath $path -PathType Leaf) { $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/'); $artifactHashes[$relative] = Get-Sha256 $path } }; $subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n"); $timer.Stop()
$result = [ordered]@{ schema_version = 1; task_id = 'NX-PROFILE-P01'; run_id = $RunId; executor_role = $ExecutorRole; status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }; scope = 'local_multi_profile_visibility_switch_and_privacy_matrix'; assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; deterministic_repetitions = @($testRuns).Count; failures = @($failures); matrix = if ($null -ne $testReceipt) { $testReceipt.matrix } else { $null }; denial_trace = if ($null -ne $testReceipt) { $testReceipt.denial_trace } else { $null }; source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count; network_operations = 0; economic_operations = 0; external_provider_operations = 0; incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }; claims_excluded = @('production_identity', 'real_personal_data', 'dating_candidate_service', 'global_search_index', 'production_persistence', 'formal_privacy_audit', 'legal_opinion'); review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes; duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4) }
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
