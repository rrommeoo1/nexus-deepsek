[CmdletBinding()]
param(
    [string]$RunId = ('NX-PROG-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'A00', 'A01', 'A02', 'C11', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$planningDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $planningDir
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Program {
    param([bool]$Condition, [string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Read-Utf8 {
    param([string]$Path)
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Parse-List {
    param([string]$Raw)
    if ([string]::IsNullOrWhiteSpace($Raw)) { return @() }
    @($Raw.Split(',') | ForEach-Object { $_.Trim().Trim('"').Trim("'") } | Where-Object { $_ })
}

function Get-StringSha256 {
    param([string]$Value)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        ([System.BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $algorithm.Dispose() }
}

Assert-Program ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-Program ($RunId -match '^NX-PROG-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
$parsedObservedAt = [DateTimeOffset]::MinValue
Assert-Program ([DateTimeOffset]::TryParse($ObservedAt, [ref]$parsedObservedAt)) 'ObservedAt is invalid.'

$paths = [ordered]@{
    p0 = Join-Path $planningDir 'backlog-p0.yaml'
    p1 = Join-Path $planningDir 'backlog-p1.yaml'
    checkpoint = Join-Path $planningDir 'checkpoints\NX-PROG-001.md'
    program_doc = Join-Path $repoRoot 'docs\16-agent-delivery-continuous-assurance.md'
    review_a01 = Join-Path $planningDir 'evidence\reviews\NX-PROG-001-A01.yaml'
    review_a02 = Join-Path $planningDir 'evidence\reviews\NX-PROG-001-A02.yaml'
}
foreach ($path in $paths.Values) { Assert-Program (Test-Path -LiteralPath $path) "Missing artifact: $path" }

$programDoc = Read-Utf8 $paths.program_doc
$checkpoint = Read-Utf8 $paths.checkpoint
$reviewA01 = Read-Utf8 $paths.review_a01
$reviewA02 = Read-Utf8 $paths.review_a02

$reviewSubjectHashes = [ordered]@{}
foreach ($subjectPath in @($paths.p0, $paths.p1, $paths.checkpoint, $paths.program_doc)) {
    $subjectRelative = $subjectPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $reviewSubjectHashes[$subjectRelative] = (Get-FileHash -LiteralPath $subjectPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$reviewSubjectCanonical = (($reviewSubjectHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$reviewSubjectSha256 = Get-StringSha256 $reviewSubjectCanonical
$allowedRoles = @([regex]::Matches($programDoc, '(?m)^\|\s*((?:A|C)\d{2})\s*\|') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
Assert-Program ($allowedRoles.Count -ge 40) 'Logical agent/control registry is unexpectedly incomplete.'

$taskMap = @{}
$tasksByTier = [ordered]@{ P0 = @(); P1 = @() }
foreach ($tier in @('P0', 'P1')) {
    $path = if ($tier -eq 'P0') { $paths.p0 } else { $paths.p1 }
    $text = Read-Utf8 $path
    $matches = @([regex]::Matches($text, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
    foreach ($match in $matches) {
        $id = $match.Groups[1].Value
        $body = $match.Groups[2].Value
        Assert-Program (-not $taskMap.ContainsKey($id)) "Duplicate task ID: $id"
        if ($taskMap.ContainsKey($id)) { continue }

        $ownerMatch = [regex]::Match($body, '(?m)^\s+owner_agent:\s*(\S+)\s*$')
        $statusMatch = [regex]::Match($body, '(?m)^\s+status:\s*(\S+)\s*$')
        $riskMatch = [regex]::Match($body, '(?m)^\s+risk_class:\s*(\S+)\s*$')
        $depsMatch = [regex]::Match($body, '(?m)^\s+depends_on:\s*\[(.*)\]\s*$')
        $peerMatch = [regex]::Match($body, '(?m)^\s+peer_reviewers:\s*\[(.*)\]\s*$')
        $controlMatch = [regex]::Match($body, '(?m)^\s+control_reviewers:\s*\[(.*)\]\s*$')
        $refsMatch = [regex]::Match($body, '(?m)^\s+normative_refs:\s*\[(.*)\]\s*$')
        $kindMatch = [regex]::Match($body, '(?m)^\s+record_kind:\s*(\S+)\s*$')
        $laneMatch = [regex]::Match($body, '(?m)^\s+lane:\s*(\S+)\s*$')
        $timeboxMatch = [regex]::Match($body, '(?m)^\s+timebox_agent_days:\s*(\S+)\s*$')
        $parentMatch = [regex]::Match($body, '(?m)^\s+parent_epic:\s*(\S+)\s*$')
        $childrenMatch = [regex]::Match($body, '(?m)^\s+child_packets:\s*\[(.*)\]\s*$')
        $milestoneMatch = [regex]::Match($body, '(?m)^\s+milestone_order:\s*(\d+)\s*$')

        $taskMap[$id] = [ordered]@{
            tier = $tier
            owner = $ownerMatch.Groups[1].Value
            status = $statusMatch.Groups[1].Value
            risk = $riskMatch.Groups[1].Value
            deps = @(Parse-List $depsMatch.Groups[1].Value)
            peers = @(Parse-List $peerMatch.Groups[1].Value)
            controls = @(Parse-List $controlMatch.Groups[1].Value)
            refs = @(Parse-List $refsMatch.Groups[1].Value)
            kind = if ($tier -eq 'P0') { 'task_packet' } else { $kindMatch.Groups[1].Value }
            lane = $laneMatch.Groups[1].Value
            timebox = $timeboxMatch.Groups[1].Value
            parent = $parentMatch.Groups[1].Value
            children = @(Parse-List $childrenMatch.Groups[1].Value)
            milestone = if ($milestoneMatch.Success) { [int]$milestoneMatch.Groups[1].Value } else { 0 }
            has_acceptance = $body -match '(?m)^\s+acceptance_tests:\s*$'
            has_evidence = $body -match '(?m)^\s+evidence_required:\s*\['
        }
        $tasksByTier[$tier] += $id
    }
}

Assert-Program ($tasksByTier.P0.Count -eq 13) 'P0 registry must contain 13 packets.'
$p1Epics = @($tasksByTier.P1 | Where-Object { $taskMap[$_].kind -eq 'epic' })
$p1Packets = @($tasksByTier.P1 | Where-Object { $taskMap[$_].kind -eq 'task_packet' })
Assert-Program ($tasksByTier.P1.Count -eq 20) 'P1 registry must contain 10 epics and 10 entry packets.'
Assert-Program ($p1Epics.Count -eq 10) 'P1 registry must contain exactly 10 epics.'
Assert-Program ($p1Packets.Count -eq 10) 'P1 registry must contain exactly 10 entry packets.'

$expectedP1Epics = @('NX-PROFILE-001', 'NX-CHAT-001', 'NX-SOCIAL-001', 'NX-MARKET-001', 'NX-MOD-001', 'NX-DATING-001', 'NX-BIZ-001', 'NX-LIVE-001', 'NX-SYNTH-001', 'NX-NODE-001')
Assert-Program (@($expectedP1Epics | Where-Object { $_ -notin $p1Epics }).Count -eq 0) 'Normative P1 epic coverage is incomplete.'

$missingDependencies = @()
$missingReferences = @()
$unowned = @()
$withoutChecker = @()
$unknownRoles = @()
$readyWithUnmet = @()
$active = @()
$duplicateDependencyEdges = @()
foreach ($id in $taskMap.Keys) {
    $task = $taskMap[$id]
    if ([string]::IsNullOrWhiteSpace($task.owner)) { $unowned += $id }
    if ($task.owner -notin $allowedRoles) { $unknownRoles += "${id}:$($task.owner)" }
    if ($task.peers.Count -eq 0 -or $task.controls.Count -eq 0) { $withoutChecker += $id }
    foreach ($reviewer in @($task.peers + $task.controls)) {
        if ($reviewer -notin $allowedRoles) { $unknownRoles += "${id}:$reviewer" }
        if ($reviewer -eq $task.owner) { $withoutChecker += "${id}:self-review" }
    }
    Assert-Program ($task.status -in @('blocked', 'ready', 'in_progress', 'review', 'control', 'done')) "Invalid status: $id"
    Assert-Program ($task.risk -in @('T0', 'T1', 'T2')) "Invalid risk class: $id"
    Assert-Program ($task.refs.Count -gt 0) "No normative reference: $id"
    Assert-Program ($task.has_acceptance) "Acceptance tests are missing: $id"
    Assert-Program ($task.has_evidence) "Evidence requirements are missing: $id"
    if ($task.tier -eq 'P1') {
        Assert-Program ($task.kind -in @('epic', 'task_packet')) "Invalid P1 record kind: $id"
        Assert-Program ($task.lane -in @('P1_DEMO_CRITICAL', 'P1_POST_DEMO_PROOF')) "Invalid P1 lane: $id"
        if ($task.kind -eq 'epic') {
            Assert-Program ($task.timebox -eq 'null') "Epic must not claim a task-packet timebox: $id"
            Assert-Program ($task.children.Count -ge 1) "Epic lacks an entry packet: $id"
        }
        else {
            $timeboxValue = 0.0
            $timeboxValid = [double]::TryParse($task.timebox, [ref]$timeboxValue)
            Assert-Program ($timeboxValid -and $timeboxValue -ge 0.5 -and $timeboxValue -le 3) "Task packet timebox must be 0.5 to 3 days: $id"
            Assert-Program (-not [string]::IsNullOrWhiteSpace($task.parent)) "Task packet lacks parent epic: $id"
        }
    }
    foreach ($ref in $task.refs) {
        $refPath = Join-Path $repoRoot ($ref.Replace('/', '\'))
        if (-not (Test-Path -LiteralPath $refPath)) { $missingReferences += "${id}:$ref" }
    }
    foreach ($dep in $task.deps) {
        if (-not $taskMap.ContainsKey($dep)) { $missingDependencies += "${id}:$dep" }
    }
    foreach ($duplicateDependency in @($task.deps | Group-Object | Where-Object Count -gt 1 | Select-Object -ExpandProperty Name)) {
        $duplicateDependencyEdges += "${id}:$duplicateDependency"
    }
    if ($task.status -in @('in_progress', 'review', 'control')) { $active += $id }
}

foreach ($id in $taskMap.Keys) {
    $task = $taskMap[$id]
    if ($task.status -eq 'ready') {
        $unmet = @($task.deps | Where-Object { $taskMap.ContainsKey($_) -and $taskMap[$_].status -ne 'done' })
        if ($unmet.Count -gt 0) { $readyWithUnmet += "${id}:$($unmet -join ',')" }
    }
}

Assert-Program ($unowned.Count -eq 0) 'An epic has no owner.'
Assert-Program ($withoutChecker.Count -eq 0) 'An epic lacks an independent peer/control checker.'
Assert-Program ($unknownRoles.Count -eq 0) 'An epic references an unknown logical role.'
Assert-Program ($missingDependencies.Count -eq 0) 'A dependency target is absent.'
Assert-Program ($duplicateDependencyEdges.Count -eq 0) 'A dependency edge is duplicated.'
Assert-Program ($missingReferences.Count -eq 0) 'A normative reference is absent.'
Assert-Program ($readyWithUnmet.Count -eq 0) 'A ready task has unmet dependencies.'
Assert-Program ($active.Count -eq 1 -and $active[0] -eq 'NX-PROG-001') 'NX-PROG-001 must be the sole active packet.'
Assert-Program ($taskMap['NX-PROG-001'].status -eq 'review') 'NX-PROG-001 must be in review for owner evidence.'
Assert-Program ($checkpoint -match '(?m)^- Stare:\s*`review`\s*$') 'Checkpoint status is inconsistent.'
Assert-Program ($checkpoint -match '(?m)^- Task:\s*`NX-PROG-001`') 'Checkpoint task identity is inconsistent.'
Assert-Program ($taskMap['NX-PROG-001'].owner -eq 'A00') 'NX-PROG-001 owner is inconsistent.'
Assert-Program ($reviewA01 -match '(?m)^decision:\s*PASS\s*$') 'A01 decision is not PASS.'
Assert-Program ($reviewA02 -match '(?m)^decision:\s*PASS\s*$') 'A02 decision is not PASS.'
Assert-Program ($reviewA01 -match "review_subject_sha256:\s*$reviewSubjectSha256") 'A01 review subject digest does not match current product artifacts.'
Assert-Program ($reviewA02 -match "review_subject_sha256:\s*$reviewSubjectSha256") 'A02 review subject digest does not match current product artifacts.'
Assert-Program (@($tasksByTier.P1 | Where-Object { $taskMap[$_].status -ne 'blocked' }).Count -eq 0) 'P1 must remain blocked during registry validation.'

foreach ($epicId in $p1Epics) {
    foreach ($childId in $taskMap[$epicId].children) {
        Assert-Program ($taskMap.ContainsKey($childId)) "Epic child packet is missing: $epicId->$childId"
        if ($taskMap.ContainsKey($childId)) { Assert-Program ($taskMap[$childId].parent -eq $epicId) "Child parent mismatch: $childId" }
    }
}
$p1PacketWithoutReverseMembership = @($p1Packets | Where-Object {
    -not $taskMap.ContainsKey($taskMap[$_].parent) -or $_ -notin $taskMap[$taskMap[$_].parent].children
})
Assert-Program ($p1PacketWithoutReverseMembership.Count -eq 0) 'A P1 packet is not listed by its parent epic.'
Assert-Program (@($tasksByTier.P0 | Where-Object { @($taskMap[$_].deps | Where-Object { $_ -in $tasksByTier.P1 }).Count -gt 0 }).Count -eq 0) 'A P0 packet depends on P1.'
Assert-Program (@($p1Packets | Where-Object { @($taskMap[$_].deps | Where-Object { $_ -in $p1Epics }).Count -gt 0 }).Count -eq 0) 'An executable P1 packet depends on a blocked epic.'
$demoCriticalEpics = @($p1Epics | Where-Object { $taskMap[$_].lane -eq 'P1_DEMO_CRITICAL' })
$postDemoEpics = @($p1Epics | Where-Object { $taskMap[$_].lane -eq 'P1_POST_DEMO_PROOF' })
Assert-Program ($demoCriticalEpics.Count -eq 6) 'Demo-critical lane must contain six epics.'
Assert-Program ($postDemoEpics.Count -eq 4) 'Post-demo lane must contain four epics.'
$milestones = @($p1Epics | ForEach-Object { $taskMap[$_].milestone } | Sort-Object)
Assert-Program (($milestones -join ',') -eq '1,2,3,4,5,6,7,8,9,10') 'P1 epic milestone order must be unique and complete.'
foreach ($id in @('NX-CHAT-001', 'NX-SOCIAL-001', 'NX-DATING-001')) {
    Assert-Program ('NX-CHAIN-001' -in $taskMap[$id].deps -and 'NX-CHAIN-002' -in $taskMap[$id].deps) "Action Ledger dependencies missing: $id"
}
foreach ($id in @('NX-CHAT-001', 'NX-MARKET-001')) {
    Assert-Program ('NX-MOD-001' -in $taskMap[$id].deps) "Moderation dependency missing: $id"
}

function Test-ReachesProgramRoot {
    param([string]$TaskId, [string[]]$Seen = @())
    if ($TaskId -eq 'NX-CAP-001') { return $true }
    if ($TaskId -in $Seen -or -not $script:taskMap.ContainsKey($TaskId)) { return $false }
    foreach ($dependency in $script:taskMap[$TaskId].deps) {
        if (Test-ReachesProgramRoot $dependency ($Seen + $TaskId)) { return $true }
    }
    return $false
}
$unrooted = @($taskMap.Keys | Where-Object { -not (Test-ReachesProgramRoot $_) })
Assert-Program ($unrooted.Count -eq 0) 'A program record is not rooted in NX-CAP-001.'
$programSuccessors = @($taskMap.Keys | Where-Object { 'NX-PROG-001' -in $taskMap[$_].deps } | Sort-Object)
Assert-Program (($programSuccessors -join ',') -eq 'NX-ARCH-001,NX-CTRL-001') 'NX-PROG-001 direct successors must be NX-ARCH-001 and NX-CTRL-001.'

$visiting = @{}
$visited = @{}
function Visit-ProgramTask {
    param([string]$TaskId)
    if ($script:visiting[$TaskId]) { throw "Cycle at $TaskId" }
    if ($script:visited[$TaskId]) { return }
    $script:visiting[$TaskId] = $true
    foreach ($dep in $script:taskMap[$TaskId].deps) {
        if ($script:taskMap.ContainsKey($dep)) { Visit-ProgramTask $dep }
    }
    $script:visiting[$TaskId] = $false
    $script:visited[$TaskId] = $true
}
$cycleDetected = $false
try { foreach ($id in $taskMap.Keys) { Visit-ProgramTask $id } }
catch { $cycleDetected = $true }
Assert-Program (-not $cycleDetected) 'Program dependency graph contains a cycle.'

$artifactHashes = [ordered]@{}
foreach ($artifactPath in @($paths.p0, $paths.p1, $paths.checkpoint, $paths.program_doc, $paths.review_a01, $paths.review_a02, $PSCommandPath)) {
    $relative = $artifactPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$canonical = (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()

$result = [ordered]@{
    schema_version = 1
    run_id = $RunId
    observed_at = $ObservedAt
    command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-program.ps1 -RunId $RunId -ObservedAt $ObservedAt -ExecutorRole $ExecutorRole"
    task_id = 'NX-PROG-001'
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    assertions = $assertions
    failures = @($failures)
    inventory = [ordered]@{
        p0_packets = $tasksByTier.P0.Count
        p1_records = $tasksByTier.P1.Count
        p1_epics = $p1Epics.Count
        p1_entry_packets = $p1Packets.Count
        total_records = $taskMap.Count
        executable_task_packets = $tasksByTier.P0.Count + $p1Packets.Count
        epic_records = $p1Epics.Count
        owned_records = $taskMap.Count - $unowned.Count
        records_with_independent_peer_and_control_checkers = $taskMap.Count - $withoutChecker.Count
        active_packet_ids = @($active)
    }
    p1_coverage = [ordered]@{
        normative_epics_covered = $p1Epics.Count
        normative_epics_total = $expectedP1Epics.Count
        demo_critical = [ordered]@{
            epics = $demoCriticalEpics.Count
            entry_packets = @($p1Packets | Where-Object { $taskMap[$_].lane -eq 'P1_DEMO_CRITICAL' }).Count
            total_records = $demoCriticalEpics.Count + @($p1Packets | Where-Object { $taskMap[$_].lane -eq 'P1_DEMO_CRITICAL' }).Count
        }
        post_demo_proof = [ordered]@{
            epics = $postDemoEpics.Count
            entry_packets = @($p1Packets | Where-Object { $taskMap[$_].lane -eq 'P1_POST_DEMO_PROOF' }).Count
            total_records = $postDemoEpics.Count + @($p1Packets | Where-Object { $taskMap[$_].lane -eq 'P1_POST_DEMO_PROOF' }).Count
        }
    }
    dependency_report = [ordered]@{
        declared_edges = @($taskMap.Keys | ForEach-Object { $taskMap[$_].deps.Count } | Measure-Object -Sum).Sum
        duplicate_edges = @($duplicateDependencyEdges)
        missing_targets = @($missingDependencies)
        cycles = if ($cycleDetected) { 1 } else { 0 }
        ready_with_unmet_dependencies = @($readyWithUnmet)
    }
    ownership_report = [ordered]@{
        unowned = @($unowned)
        without_independent_checker = @($withoutChecker)
        unknown_roles = @($unknownRoles)
    }
    reference_report = [ordered]@{
        missing_normative_refs = @($missingReferences)
    }
    evidence_mapping = [ordered]@{
        backlog_snapshot = @('planning/backlog-p0.yaml', 'planning/backlog-p1.yaml')
        dependency_report = 'dependency_report'
        ownership_report = 'ownership_report'
        checkpoint = 'planning/checkpoints/NX-PROG-001.md'
        maker_checker_decisions = @('planning/evidence/reviews/NX-PROG-001-A01.yaml', 'planning/evidence/reviews/NX-PROG-001-A02.yaml')
    }
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    review_subject_sha256 = $reviewSubjectSha256
    review_subject_artifact_sha256 = $reviewSubjectHashes
    source_snapshot_sha256 = Get-StringSha256 $canonical
    artifact_sha256 = $artifactHashes
}

$result | ConvertTo-Json -Depth 7
if ($failures.Count -gt 0) { exit 1 }
