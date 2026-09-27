[CmdletBinding()]
param(
    [string]$RunId = ('NX-CAP-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'A00', 'C11')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$wallTimer = [System.Diagnostics.Stopwatch]::StartNew()
$cpuStart = [System.Diagnostics.Process]::GetCurrentProcess().TotalProcessorTime

$planningDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $planningDir
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Nexus {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Read-Utf8 {
    param([Parameter(Mandatory = $true)][string]$Path)
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $algorithm.Dispose() }
}

function Get-PolicyScalar {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Key
    )
    $match = [regex]::Match($Text, "(?m)^\s*$([regex]::Escape($Key)):\s*([^#\r\n]+?)\s*$")
    if (-not $match.Success) { throw "Policy key missing: $Key" }
    $match.Groups[1].Value.Trim()
}

function Test-SpendRequest {
    param(
        [decimal]$IncrementalCost,
        [string]$Provider,
        [string]$Environment,
        [bool]$EconomicEffect,
        [string]$NetworkDestination,
        [hashtable]$Approval,
        [string[]]$ActiveApprovalIds
    )

    if ($EconomicEffect -or -not [string]::IsNullOrWhiteSpace($NetworkDestination)) { return $false }
    if ($IncrementalCost -le 0) { return $true }
    if ($null -eq $Approval) { return $false }

    $required = @('approval_id', 'provider_or_category', 'max_amount', 'currency', 'environment', 'expires_at', 'owner')
    foreach ($field in $required) {
        if (-not $Approval.ContainsKey($field) -or [string]::IsNullOrWhiteSpace([string]$Approval[$field])) { return $false }
    }
    if ($Approval.approval_id -notin $ActiveApprovalIds) { return $false }
    if ($Approval.provider_or_category -ne $Provider) { return $false }
    if ($Approval.environment -ne $Environment) { return $false }
    if ([decimal]$Approval.max_amount -lt $IncrementalCost) { return $false }
    if ([DateTimeOffset]::Parse([string]$Approval.expires_at) -le [DateTimeOffset]::UtcNow) { return $false }
    return $true
}

$paths = [ordered]@{
    backlog = Join-Path $planningDir 'backlog-p0.yaml'
    scorecard = Join-Path $planningDir 'capacity-scorecard.yaml'
    policy = Join-Path $planningDir 'spend-control.yaml'
    checkpoint = Join-Path $planningDir 'checkpoints\NX-CAP-001.md'
    agents = Join-Path $repoRoot 'AGENTS.md'
    capacity_plan = Join-Path $planningDir 'openai-plus-capacity-plan.md'
    child = Join-Path $planningDir 'zero-cost-child-test.ps1'
    findings = Join-Path $planningDir 'findings\NX-CAP-001.yaml'
    review_a10 = Join-Path $planningDir 'evidence\reviews\NX-CAP-001-A10.yaml'
    review_c10 = Join-Path $planningDir 'evidence\reviews\NX-CAP-001-C10.yaml'
    prior_evidence = Join-Path $planningDir 'evidence\NX-CAP-001-validation.json'
}

foreach ($path in @($paths.backlog, $paths.scorecard, $paths.policy, $paths.checkpoint, $paths.agents, $paths.capacity_plan, $paths.child, $paths.findings, $paths.review_a10, $paths.review_c10)) {
    Assert-Nexus (Test-Path -LiteralPath $path) "Missing artifact: $path"
}

Assert-Nexus ($RunId -match '^NX-CAP-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Nexus ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit; provenance cannot default to the maker.'
$parsedObservedAt = [DateTimeOffset]::MinValue
Assert-Nexus ([DateTimeOffset]::TryParse($ObservedAt, [ref]$parsedObservedAt)) 'ObservedAt is not a valid timestamp.'
if (Test-Path -LiteralPath $paths.prior_evidence) {
    $priorEvidence = Read-Utf8 $paths.prior_evidence | ConvertFrom-Json
    Assert-Nexus ($priorEvidence.run_id -ne $RunId) 'Run ID was already persisted and cannot be reused.'
}

$backlog = Read-Utf8 $paths.backlog
$scorecard = Read-Utf8 $paths.scorecard
$policy = Read-Utf8 $paths.policy
$agents = Read-Utf8 $paths.agents
$capacityPlan = Read-Utf8 $paths.capacity_plan
$childSource = Read-Utf8 $paths.child
$checkpoint = Read-Utf8 $paths.checkpoint
$findings = Read-Utf8 $paths.findings
$reviewA10 = Read-Utf8 $paths.review_a10
$reviewC10 = Read-Utf8 $paths.review_c10

$taskBlocks = @([regex]::Matches($backlog, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
$taskIds = @($taskBlocks | ForEach-Object { $_.Groups[1].Value })
Assert-Nexus (($taskIds | Sort-Object -Unique).Count -eq $taskIds.Count) 'Duplicate task IDs.'
$taskMap = @{}
foreach ($blockMatch in $taskBlocks) {
    $taskId = $blockMatch.Groups[1].Value
    $body = $blockMatch.Groups[2].Value
    $statusMatch = [regex]::Match($body, '(?m)^\s+status:\s*(\S+)\s*$')
    $ownerMatch = [regex]::Match($body, '(?m)^\s+owner_agent:\s*(\S+)\s*$')
    $dependencyMatch = [regex]::Match($body, '(?m)^\s+depends_on:\s*\[(.*)\]\s*$')
    $deps = @()
    if ($dependencyMatch.Success -and $dependencyMatch.Groups[1].Value.Trim()) {
        $deps = @($dependencyMatch.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() })
    }
    $taskMap[$taskId] = [ordered]@{
        status = $statusMatch.Groups[1].Value
        owner = $ownerMatch.Groups[1].Value
        deps = $deps
        body = $body
    }
}
$missingDependencies = @()
foreach ($taskId in $taskIds) {
    foreach ($dependency in $taskMap[$taskId].deps) {
        if (-not $taskMap.ContainsKey($dependency)) { $missingDependencies += "$taskId->$dependency" }
    }
}
Assert-Nexus ($missingDependencies.Count -eq 0) 'Missing dependency target.'

$visiting = @{}
$visited = @{}
function Visit-Task {
    param([string]$TaskId)
    if ($script:visiting[$TaskId]) { throw "Dependency cycle at $TaskId" }
    if ($script:visited[$TaskId]) { return }
    $script:visiting[$TaskId] = $true
    foreach ($dependency in $script:taskMap[$TaskId].deps) { Visit-Task $dependency }
    $script:visiting[$TaskId] = $false
    $script:visited[$TaskId] = $true
}
$cycleDetected = $false
try { foreach ($taskId in $taskIds) { Visit-Task $taskId } }
catch { $cycleDetected = $true }
Assert-Nexus (-not $cycleDetected) 'Dependency graph contains a cycle.'

$activeTasks = @($taskIds | Where-Object { $taskMap[$_].status -in @('in_progress', 'review', 'control') })
$readyWithUnmetDependencies = @()
foreach ($taskId in $taskIds) {
    if ($taskMap[$taskId].status -eq 'ready') {
        $unmet = @($taskMap[$taskId].deps | Where-Object { $taskMap[$_].status -ne 'done' })
        if ($unmet.Count -gt 0) { $readyWithUnmetDependencies += $taskId }
    }
}
Assert-Nexus ($activeTasks.Count -eq 1 -and $activeTasks[0] -eq 'NX-CAP-001') 'Exactly NX-CAP-001 must be active.'
Assert-Nexus ($readyWithUnmetDependencies.Count -eq 0) 'A ready task has unmet dependencies.'
Assert-Nexus ($taskMap['NX-CAP-001'].status -eq 'review') 'NX-CAP-001 must remain in review during owner validation.'
Assert-Nexus ($taskMap['NX-PROG-001'].status -eq 'blocked') 'NX-PROG-001 must remain blocked before gate approval.'
Assert-Nexus ($taskMap['NX-CAP-001'].owner -eq 'A00') 'NX-CAP-001 owner is inconsistent.'
Assert-Nexus ($taskMap['NX-CAP-001'].body -notmatch '(?m)^\s+(peer_reviewers|control_reviewers):\s*\[[^\]]*A00') 'Owner cannot review its own packet.'
Assert-Nexus ($backlog -match '(?m)^\s*active_workstreams:\s*1\s*$') 'WIP limit must be one.'
Assert-Nexus ($scorecard -match '(?m)^\s*active_packets:\s*1\s*$') 'Scorecard active packet count is inconsistent.'
Assert-Nexus ($scorecard -match '(?m)^\s*active_task_id:\s*NX-CAP-001\s*$') 'Scorecard active task is inconsistent.'
Assert-Nexus ($checkpoint -match '(?m)^- Stare:\s*`review`\s*$') 'Checkpoint state is inconsistent.'
Assert-Nexus ($backlog -match 'evidence_required:\s*\[capacity_policy, sample_checkpoint, weekly_capacity_scorecard\]') 'Required evidence mapping changed or is missing.'
Assert-Nexus ($reviewA10 -match '(?m)^decision:\s*PASS\s*$') 'A10 decision is not PASS.'
Assert-Nexus ($reviewC10 -match '(?m)^decision:\s*PASS\s*$') 'C10 decision is not PASS.'
Assert-Nexus ($findings -match '(?m)^\s+- finding_id:\s*CAP-F-002\s*$' -and $findings -match '(?m)^\s+- finding_id:\s*CAP-F-003\s*$') 'Open findings are not registered.'

$mode = Get-PolicyScalar $policy 'mode'
$maxIncremental = [decimal](Get-PolicyScalar $policy 'max_incremental_amount')
$maxCpuSeconds = [double](Get-PolicyScalar $policy 'max_cpu_seconds')
$maxWallSeconds = [int](Get-PolicyScalar $policy 'max_wall_seconds')
$maxDiskMb = [int](Get-PolicyScalar $policy 'max_disk_mb')
$maxProcesses = [int](Get-PolicyScalar $policy 'max_processes')
$activeApprovalsRaw = Get-PolicyScalar $policy 'active_approvals'
$egressRaw = Get-PolicyScalar $policy 'network_egress_allowlist'

Assert-Nexus ($mode -eq 'default_deny_spend') 'Spend mode must default to deny.'
Assert-Nexus ($maxIncremental -eq 0) 'Default incremental cost must be zero.'
Assert-Nexus ((Get-PolicyScalar $policy 'assume_free_tier') -eq 'false') 'Free tier must not be assumed.'
Assert-Nexus ($activeApprovalsRaw -eq '[]') 'No spend approval may be active.'
Assert-Nexus ($egressRaw -eq '[]') 'Default egress allowlist must be empty.'
Assert-Nexus ((Get-PolicyScalar $policy 'production_credentials_allowed') -eq 'false') 'Production credentials must be denied.'
Assert-Nexus ((Get-PolicyScalar $policy 'billing_credentials_allowed') -eq 'false') 'Billing credentials must be denied.'
Assert-Nexus ((Get-PolicyScalar $policy 'economic_effect_allowed') -eq 'false') 'Synthetic economic effects must be denied.'
Assert-Nexus ($maxCpuSeconds -gt 0 -and $maxWallSeconds -gt 0 -and $maxDiskMb -gt 0 -and $maxProcesses -ge 1) 'Runtime caps are invalid.'

$requiredApprovalFields = @('approval_id', 'provider_or_category', 'max_amount', 'currency', 'environment', 'expires_at', 'owner')
foreach ($field in $requiredApprovalFields) {
    Assert-Nexus ($policy -match "(?m)^\s+- $([regex]::Escape($field))\s*$") "Missing approval field: $field"
}

# Read environment names via System.Environment to avoid the PATH/Path collision in the PowerShell Env provider.
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_)'
$credentialNames = @([System.Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Nexus ($credentialNames.Count -eq 0) 'Billing or production credential names are present in the parent test environment.'

$validShape = @{
    approval_id = 'APR-TEST-001'
    provider_or_category = 'cloud_compute_ci_or_device_farm'
    max_amount = '5'
    currency = 'EUR'
    environment = 'devnet'
    expires_at = '2099-01-01T00:00:00Z'
    owner = 'Owner'
}
$incomplete = $validShape.Clone(); $incomplete.Remove('owner')
$expired = $validShape.Clone(); $expired.expires_at = '2020-01-01T00:00:00Z'
$overCap = $validShape.Clone(); $overCap.max_amount = '0.50'
$wrongProvider = $validShape.Clone(); $wrongProvider.provider_or_category = 'sms_push_maps_or_geolocation'

Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $null @())) 'Absent approval bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $incomplete @('APR-TEST-001'))) 'Incomplete approval bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $expired @('APR-TEST-001'))) 'Expired approval bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $overCap @('APR-TEST-001'))) 'Over-cap approval bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $wrongProvider @('APR-TEST-001'))) 'Wrong-provider approval bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $validShape @())) 'Unregistered approval bypassed spend guard.'
Assert-Nexus (Test-SpendRequest 1 'cloud_compute_ci_or_device_farm' 'devnet' $false '' $validShape @('APR-TEST-001')) 'Complete registered synthetic approval was rejected.'
Assert-Nexus (-not (Test-SpendRequest 0 'local' 'local' $true '' $null @())) 'Economic effect bypassed spend guard.'
Assert-Nexus (-not (Test-SpendRequest 0 'local' 'local' $false 'https://metered.invalid' $null @())) 'Unallowlisted egress bypassed spend guard.'
Assert-Nexus (Test-SpendRequest 0 'local' 'local' $false '' $null @()) 'Zero-cost local request was rejected.'

# The bootstrap guard executes one fixed, source-inspected child script. It does not accept arbitrary commands.
$forbiddenChildTokens = '(?i)(Invoke-WebRequest|Invoke-RestMethod|HttpClient|WebClient|Start-Process|Invoke-Expression|System\.Net|curl(?:\.exe)?|wget(?:\.exe)?|bitsadmin|Start-Job)'
Assert-Nexus ($childSource -notmatch $forbiddenChildTokens) 'Allowlisted child contains network or process-spawn capability.'

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('nexus-zero-cost-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $tempRoot)
$childProcess = $null
try {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'powershell.exe'
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$($paths.child)`""
    $startInfo.WorkingDirectory = $tempRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $childEnvironment = $startInfo.Environment
    if ($null -eq $childEnvironment) { $childEnvironment = $startInfo.EnvironmentVariables }
    if ($null -eq $childEnvironment) { throw 'ProcessStartInfo exposes no writable environment dictionary.' }
    $childEnvironment.Clear()
    foreach ($name in @('SystemRoot', 'ComSpec', 'TEMP', 'TMP')) {
        $value = [System.Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) { $childEnvironment[$name] = $value }
    }
    $childEnvironment['NEXUS_ACTOR_KIND'] = 'SYSTEM_TEST'
    $childEnvironment['NEXUS_NETWORK_MODE'] = 'DENY'
    $childEnvironment['NEXUS_MAX_INCREMENTAL_COST'] = '0'

    $childProcess = [System.Diagnostics.Process]::new()
    $childProcess.StartInfo = $startInfo
    Assert-Nexus ($maxProcesses -ge 1) 'Policy does not permit the single allowlisted child.'
    if (-not $childProcess.Start()) { throw 'Allowlisted child failed to start.' }
    $completed = $childProcess.WaitForExit($maxWallSeconds * 1000)
    if (-not $completed) {
        $childProcess.Kill()
        throw 'Allowlisted child exceeded wall-time cap.'
    }
    $childOutput = $childProcess.StandardOutput.ReadToEnd().Trim()
    $childError = $childProcess.StandardError.ReadToEnd().Trim()
    $childCpuSeconds = $childProcess.TotalProcessorTime.TotalSeconds
    Assert-Nexus ($childProcess.ExitCode -eq 0) "Allowlisted child failed: $childError"
    Assert-Nexus ($childCpuSeconds -le $maxCpuSeconds) 'Allowlisted child exceeded CPU cap.'
    $childResult = $childOutput | ConvertFrom-Json
    Assert-Nexus ($childResult.actor_kind -eq 'SYSTEM_TEST') 'Child actor is not SYSTEM_TEST.'
    Assert-Nexus ($childResult.status -eq 'PASS') 'Child test did not pass.'
    Assert-Nexus ([int]$childResult.network_operations -eq 0) 'Child reported network operations.'
    Assert-Nexus ([int]$childResult.economic_operations -eq 0) 'Child reported economic operations.'
    Assert-Nexus ([int]$childResult.local_operations -eq 100) 'Child local operation volume is unexpected.'
    $diskBytes = 0L
    foreach ($file in @(Get-ChildItem -LiteralPath $tempRoot -File -Recurse -ErrorAction Stop)) {
        $diskBytes += [long]$file.Length
    }
    Assert-Nexus ($diskBytes -le ($maxDiskMb * 1MB)) 'Allowlisted child exceeded disk cap.'
}
finally {
    if ($null -ne $childProcess) { $childProcess.Dispose() }
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}

Assert-Nexus ($agents -match 'default_deny_spend') 'AGENTS.md lacks universal spend policy.'
Assert-Nexus ($agents -match 'UNOBSERVED.*YELLOW') 'AGENTS.md lacks UNOBSERVED fallback.'
Assert-Nexus ($capacityPlan -match 'default_deny_spend') 'Capacity plan lacks universal spend policy.'
Assert-Nexus ($scorecard -match '(?m)^\s*paid_credits_authorized:\s*false\s*$') 'Paid credits are authorized.'
Assert-Nexus ($scorecard -match '(?m)^\s*paid_api_authorized:\s*false\s*$') 'Paid API is authorized.'
Assert-Nexus ($scorecard -match '(?m)^\s*denominator:\s*scenario_action_equivalent\s*$') 'Test denominator is undefined.'
Assert-Nexus ($scorecard -match '(?m)^\s*deterministic_scenario_actions:\s*100\s*$') 'Deterministic action volume is not recorded.'
Assert-Nexus ($scorecard -match '(?m)^\s*total_scenario_action_equivalents:\s*102\s*$') 'Normalized test volume is inconsistent.'
Assert-Nexus ($scorecard -match '(?m)^\s*mode:\s*default_deny_spend\s*$') 'Scorecard spend mode is not default deny.'
Assert-Nexus ($scorecard -match '(?m)^\s*max_incremental_amount_without_approval:\s*0\s*$') 'Scorecard permits unapproved incremental cost.'
Assert-Nexus ($scorecard -match '(?m)^\s{4}amount:\s*0\s*$') 'Incremental cost is not zero.'
Assert-Nexus ($scorecard -match '(?m)^\s{4}value:\s*N/A\s*$') 'Cost per accepted packet must be N/A before acceptance.'

$artifactHashes = [ordered]@{}
foreach ($artifactPath in @(
    $paths.agents,
    $paths.capacity_plan,
    $paths.backlog,
    $paths.scorecard,
    $paths.policy,
    $paths.child,
    $paths.checkpoint,
    $paths.findings,
    $paths.review_a10,
    $paths.review_c10,
    $PSCommandPath
)) {
    $relativePath = $artifactPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relativePath] = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$canonicalSource = (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$sourceSnapshotSha256 = Get-StringSha256 $canonicalSource
$hostFingerprint = Get-StringSha256 ([System.Environment]::MachineName)

$wallTimer.Stop()
$cpuElapsed = [System.Diagnostics.Process]::GetCurrentProcess().TotalProcessorTime - $cpuStart
$result = [ordered]@{
    schema_version = 1
    run_id = $RunId
    observed_at = $ObservedAt
    command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-capacity.ps1 -RunId $RunId -ObservedAt $ObservedAt -ExecutorRole $ExecutorRole"
    task_id = 'NX-CAP-001'
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    executor = [ordered]@{
        role = $ExecutorRole
        runtime = "WindowsPowerShell/$($PSVersionTable.PSVersion)"
        host_fingerprint_sha256 = $hostFingerprint
    }
    attestation = [ordered]@{
        type = 'local_process_evidence_v1'
        statement = 'The executor ran the fixed local zero-cost guard against the hashed source snapshot.'
        source_snapshot_sha256 = $sourceSnapshotSha256
    }
    deterministic_scenario_actions = 100
    child_processes_started = 1
    approval_negative_cases = 6
    approval_positive_cases = 1
    blocked_economic_actions = 1
    blocked_unallowlisted_egress_actions = 1
    credential_name_matches = $credentialNames.Count
    assertions = $assertions
    child_cpu_seconds = [math]::Round($childCpuSeconds, 4)
    child_disk_bytes = [long]$diskBytes
    deterministic_wall_seconds = [math]::Round($wallTimer.Elapsed.TotalSeconds, 4)
    deterministic_cpu_seconds = [math]::Round($cpuElapsed.TotalSeconds, 4)
    failures = @($failures)
    backlog_checks = [ordered]@{
        task_count = $taskIds.Count
        missing_dependencies = $missingDependencies.Count
        cycles = if ($cycleDetected) { 1 } else { 0 }
        active_packet_ids = @($activeTasks)
        ready_with_unmet_dependencies = $readyWithUnmetDependencies.Count
        owner_self_review = $false
    }
    evidence_mapping = [ordered]@{
        capacity_policy = @('AGENTS.md', 'planning/openai-plus-capacity-plan.md', 'planning/spend-control.yaml')
        sample_checkpoint = 'planning/checkpoints/NX-CAP-001.md'
        weekly_capacity_scorecard = 'planning/capacity-scorecard.yaml'
        findings_registry = 'planning/findings/NX-CAP-001.yaml'
        maker_checker_decisions = @('planning/evidence/reviews/NX-CAP-001-A10.yaml', 'planning/evidence/reviews/NX-CAP-001-C10.yaml')
    }
    artifact_sha256 = $artifactHashes
}

$result | ConvertTo-Json -Depth 6
if ($failures.Count -gt 0) { exit 1 }
