[CmdletBinding()]
param(
    [string]$RunId = ('NX-MOD-P01-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A32', 'C01', 'C04', 'C06')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Mod { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
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
    source = Join-Path $repoRoot 'packages\moderation\api\index.ts'
    tests = Join-Path $repoRoot 'packages\moderation\api\index.test.ts'
    contract = Join-Path $repoRoot 'packages\moderation\api\moderation-contract.v1.json'
    security_doc = Join-Path $repoRoot 'docs\04-security-compliance.md'
    assurance_doc = Join-Path $repoRoot 'docs\16-agent-delivery-continuous-assurance.md'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog_p0 = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    backlog_p1 = Join-Path $PSScriptRoot 'backlog-p1.yaml'
    capacity = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    progress = Join-Path $PSScriptRoot 'product-progress.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-MOD-P01.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Mod (Test-Path -LiteralPath $path -PathType Leaf) "Missing artifact: $path" }
Assert-Mod ($RunId -match '^NX-MOD-P01-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Mod ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source; $tests = Read-Utf8 $paths.tests; $contract = Read-Utf8 $paths.contract | ConvertFrom-Json; $securityDoc = Read-Utf8 $paths.security_doc; $assuranceDoc = Read-Utf8 $paths.assurance_doc; $architecture = Read-Utf8 $paths.architecture; $backlogP0 = Read-Utf8 $paths.backlog_p0; $backlogP1 = Read-Utf8 $paths.backlog_p1; $capacity = Read-Utf8 $paths.capacity; $progress = Read-Utf8 $paths.progress; $checkpoint = Read-Utf8 $paths.checkpoint; $spend = Read-Utf8 $paths.spend; $capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json

$task = [regex]::Match($backlogP1, '(?ms)^  - task_id:\s*NX-MOD-P01\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Mod $task.Success 'NX-MOD-P01 is missing from P1 backlog.'
if ($task.Success) { Assert-Mod ($task.Groups[1].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$') 'NX-MOD-P01 is not a task packet.'; Assert-Mod ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A32\s*$') 'Owner is not A32.'; Assert-Mod ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'; Assert-Mod ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'Packet is not T0.' }
foreach ($dependency in @('NX-CONTRACT-001', 'NX-SEC-001', 'NX-OBS-001')) { $record = [regex]::Match($backlogP0, ('(?ms)^  - task_id:\s*' + [regex]::Escape($dependency) + '\s*\r?\n(.*?)(?=^  - task_id:|\z)')); Assert-Mod ($record.Success -and $record.Groups[1].Value -match '(?m)^\s+status:\s*done\s*$') "Dependency not done: $dependency" }
$activePackets = @([regex]::Matches($backlogP1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)') | Where-Object { $_.Groups[2].Value -match '(?m)^\s+record_kind:\s*task_packet\s*$' -and $_.Groups[2].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$' } | ForEach-Object { $_.Groups[1].Value })
Assert-Mod ($activePackets.Count -eq 1 -and $activePackets[0] -eq 'NX-MOD-P01') 'WIP one active task packet is violated.'
Assert-Mod ($capacity -match '(?m)^\s+active_packets:\s+1\s*$' -and $capacity -match '(?m)^\s+active_task_id:\s+NX-MOD-P01\s*$') 'Capacity active task mismatch.'
Assert-Mod ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'
Assert-Mod ($progress -match '(?m)^\s+active_packet_id:\s+NX-MOD-P01\s*$') 'Progress active packet mismatch.'
Assert-Mod ($architecture -match '(?ms)^  - id:\s*moderation\s*\r?\n.*?^\s+owner:\s*A32\s*$') 'Moderation context owner missing.'
Assert-Mod ($architecture -match '(?ms)^  - id:\s*moderation\s*\r?\n.*?^\s+public_api_path:\s*packages/moderation/api\s*$') 'Moderation public API path missing.'
Assert-Mod ($architecture -match '(?ms)^  - id:\s*moderation\s*\r?\n.*?^\s+data_access:\s*\[PUBLIC, SAFETY_EVIDENCE\]\s*$') 'Moderation data boundary mismatch.'

Assert-Mod ($contract.schemaVersion -eq 1 -and $contract.contractVersion -eq '1.0.0' -and $contract.owner -eq 'A32') 'Moderation contract identity drifted.'
Assert-Mod (@($contract.surfaces).Count -eq 2 -and @($contract.surfaces) -contains 'SOCIAL' -and @($contract.surfaces) -contains 'MARKETPLACE') 'Moderation surface contract drifted.'
Assert-Mod ($contract.rules.defaultDecision -eq 'DENY' -and [bool]$contract.rules.accountBlockPrecedesSurfacePolicy -and [bool]$contract.rules.p0RequiresContainmentBeforeFinalDecision -and [bool]$contract.rules.p0ContainmentRequiresSignedExpiry -and [bool]$contract.rules.expiredContainmentCannotAuthorizeDecision -and [bool]$contract.rules.appealReviewerMustDifferFromModerator -and [bool]$contract.rules.subjectMayAppealOwnCaseOnly -and [bool]$contract.rules.signedBlockCommandRequired -and [bool]$contract.rules.verifiedCheckpointRequiredForRestore -and [bool]$contract.rules.replayDeniedAcrossRestart -and -not [bool]$contract.rules.rawContentAllowedInAuditTrace -and [bool]$contract.rules.evidenceVaultCommitmentRequired -and [bool]$contract.rules.syntheticOnlyInCurrentPacket) 'Moderation rules drifted.'
Assert-Mod ($contract.eventPayload -eq 'IDENTIFIERS_AND_COMMITMENTS_ONLY') 'Moderation event payload policy drifted.'

foreach ($fragment in @('block global', 'report flow', 'evidence vault', 'statement of reasons', 'Report/evidence', 'P0 | pericol imediat')) { Assert-Mod ($securityDoc.Contains($fragment)) "Security specification missing: $fragment" }
foreach ($fragment in @('maker', 'C06 | Trust & Safety', 'Incident P0', 'finding', 'Evidence Pack')) { Assert-Mod ($assuranceDoc.Contains($fragment)) "Assurance specification missing: $fragment" }
foreach ($fragment in @('ModerationCaseMachine', 'AccountBlockRegistry', 'CASE_CHECKPOINT_UNVERIFIED', 'BLOCK_CHECKPOINT_UNVERIFIED', 'ACTION_REPLAY', 'BLOCK_REPLAY', 'CONTAINMENT_EXPIRY_INVALID', 'CONTAINMENT_EXPIRED', 'REVIEWER_SEPARATION_DENIED', 'buildModerationAuditTrace')) { Assert-Mod ($source.Contains($fragment)) "Source control missing: $fragment" }
foreach ($fragment in @('standardFlow("SOCIAL"', 'standardFlow("MARKETPLACE"', 'P0 containment precedes final decision', 'case state and lineage survive verified restart', 'account block survives verified restart across surfaces', 'moderator_as_appeal_reviewer_denied', 'trace_raw_content_denied')) { Assert-Mod ($tests.Contains($fragment)) "Test control missing: $fragment" }
Assert-Mod ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect|dgram\.|console\.log)') 'Moderation runtime can perform network/process/log operations.'

Assert-Mod ($capEvidence.status -eq 'PASS' -and [int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Mod ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_|XMONEY_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Mod ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime; Assert-Mod ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'; [IO.Directory]::CreateDirectory($ephemeralRoot) | Out-Null; $runRoot = Join-Path $ephemeralRoot ('NX-MOD-P01-validator-' + [Guid]::NewGuid().ToString('N')); [IO.Directory]::CreateDirectory($runRoot) | Out-Null
$compile = $null; $testRuns = @(); $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot; Assert-Mod ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) { 1..3 | ForEach-Object { $script:testRuns += Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot }; foreach ($run in $testRuns) { Assert-Mod ($run.exit_code -eq 0) "Moderation tests failed: $($run.stderr)" }; Assert-Mod (@($testRuns.stdout | Sort-Object -Unique).Count -eq 1) 'Deterministic repetitions produced different receipts.'; try { $testReceipt = $testRuns[0].stdout | ConvertFrom-Json } catch { Assert-Mod $false 'Test receipt is not JSON.' } }
        $items = @([pscustomobject]@{ id = 'packages/moderation/api/index.ts'; sourceContext = 'moderation'; text = $source }, [pscustomobject]@{ id = 'packages/moderation/api/index.test.ts'; sourceContext = 'moderation'; text = $tests }); $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{ profile_core = 'profile_core'; contract_registry = 'contract_registry' }; knownSchemas = @('moderation', 'profile_core', 'contract_registry'); contexts = [pscustomobject]@{ moderation = [pscustomobject]@{ allowedImports = @('profile_core', 'contract_registry') } }; items = $items }; $manifestPath = Join-Path $runRoot 'boundary.json'; [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false)); $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot; Assert-Mod ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"; if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally { $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'; $resolved = [IO.Path]::GetFullPath($runRoot); if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force } }

Assert-Mod ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) {
    Assert-Mod ($testReceipt.task_id -eq 'NX-MOD-P01' -and $testReceipt.status -eq 'PASS' -and [int]$testReceipt.assertions -ge 42) 'Moderation scenario receipt regressed.'
    Assert-Mod (@($testReceipt.surfaces).Count -eq 2 -and @($testReceipt.surfaces) -contains 'SOCIAL' -and @($testReceipt.surfaces) -contains 'MARKETPLACE') 'Cross-surface coverage mismatch.'
    foreach ($property in @('exact_shape_denied', 'non_synthetic_denied', 'raw_evidence_denied', 'invalid_signature_denied', 'p0_final_without_containment_denied', 'containment_without_expiry_denied', 'expired_containment_registration_denied', 'expired_containment_final_action_denied', 'containment_role_substitution_denied', 'subject_substitution_appeal_denied', 'moderator_as_appeal_reviewer_denied', 'reporter_as_appeal_reviewer_denied', 'action_replay_denied_after_restart', 'case_lineage_tamper_denied', 'case_checkpoint_required', 'account_block_cross_surface', 'account_block_replay_denied_after_restart', 'block_checkpoint_required', 'trace_raw_content_denied')) { Assert-Mod ([bool]$testReceipt.negative.$property) "Negative control failed: $property" }
    Assert-Mod ([int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0 -and [int]$testReceipt.external_provider_operations -eq 0 -and [decimal]$testReceipt.incremental_cost.amount -eq 0) 'Moderation tests escaped zero-effect mode.'
}
$boundaryFindings = @(); if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }; Assert-Mod ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}; foreach ($path in $paths.Values) { if (Test-Path -LiteralPath $path -PathType Leaf) { $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/'); $artifactHashes[$relative] = Get-Sha256 $path } }; $subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n"); $timer.Stop()
$result = [ordered]@{ schema_version = 1; task_id = 'NX-MOD-P01'; run_id = $RunId; executor_role = $ExecutorRole; status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }; scope = 'local_cross_surface_report_block_appeal_and_p0_containment'; assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; deterministic_repetitions = @($testRuns).Count; failures = @($failures); surfaces = if ($null -ne $testReceipt) { $testReceipt.surfaces } else { @() }; source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count; network_operations = 0; economic_operations = 0; external_provider_operations = 0; incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }; claims_excluded = @('production_moderation', 'real_user_reports', 'automated_content_classifier', 'evidence_vault_provider', 'production_persistence_adapter', 'legal_notice_or_authority_reporting', 'formal_trust_and_safety_audit'); review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes; duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4) }
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
