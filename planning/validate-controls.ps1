[CmdletBinding()]
param(
    [string]$RunId = ('NX-CTRL-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'A00', 'C01', 'C03', 'C04', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'InternalAudit')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Control {
    param([Parameter(Mandatory = $true)][bool]$Condition, [Parameter(Mandatory = $true)][string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Read-Utf8 {
    param([Parameter(Mandatory = $true)][string]$Path)
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Get-PropertyValue {
    param($Object, [string]$Name, $Fallback)
    if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) { return $Object.$Name }
    return $Fallback
}

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

function Test-Approval {
    param([string]$Author, [string]$Owner, [string[]]$Peers, [string[]]$Controls, [string]$Checker, [string]$Tier)
    if ($Peers.Count -eq 0 -or $Controls.Count -eq 0) { return $false }
    if ($Peers -contains $Author -or $Controls -contains $Author -or $Checker -eq $Author) { return $false }
    if ($Peers.Count -eq 1 -and $Peers[0] -eq $Owner) { return $false }
    if ($Checker -eq $Owner) { return $false }
    if ($Tier -eq 'T0' -and $Controls.Count -lt 1) { return $false }
    return $true
}

function Test-EvidenceMutationAllowed {
    param([string]$State, [string]$ActorRole, [string]$OriginalDigest, [string]$CurrentDigest, [string]$MutationPolicy)
    if ($State -eq 'SEALED' -and $OriginalDigest -ne $CurrentDigest) { return $false }
    if ($State -eq 'SEALED' -and $ActorRole -eq 'DELIVERY') { return $false }
    return $MutationPolicy -eq 'APPEND_ONLY_SUPERSEDING_PACK'
}

function Get-PackDigest {
    param($Pack)
    $clone = Copy-Pack $Pack
    $clone.immutability.PSObject.Properties.Remove('pack_sha256')
    return Get-StringSha256 (ConvertTo-CanonicalJson $clone)
}

function ConvertTo-CanonicalJson {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [string] -or $Value -is [char]) { return ($Value.ToString() | ConvertTo-Json -Compress) }
    if ($Value -is [bool]) { return $(if ($Value) { 'true' } else { 'false' }) }
    if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
        return [Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
    }
    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [System.Management.Automation.PSCustomObject]) {
        $items = @($Value | ForEach-Object { ConvertTo-CanonicalJson $_ })
        return '[' + ($items -join ',') + ']'
    }
    $pairs = [System.Collections.Generic.List[string]]::new()
    foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
        $name = $property.Name | ConvertTo-Json -Compress
        $pairs.Add($name + ':' + (ConvertTo-CanonicalJson $property.Value))
    }
    return '{' + ($pairs -join ',') + '}'
}

function Get-ArtifactManifestDigest {
    param([object[]]$Artifacts)
    $sorted = @($Artifacts | Sort-Object path)
    return Get-StringSha256 (ConvertTo-CanonicalJson $sorted)
}

function Copy-Pack {
    param($Pack)
    return ($Pack | ConvertTo-Json -Depth 20 | ConvertFrom-Json)
}

function Test-PackSemantic {
    param($Pack, [object[]]$Controls, $GatePolicy, [string]$ExpectedSubjectDigest)
    $errors = [System.Collections.Generic.List[string]]::new()
    $gate = @($GatePolicy.gates | Where-Object { $_.gate_id -eq $Pack.gate })
    if ($gate.Count -ne 1 -or $Pack.gate_decision -notin @($gate[0].allowed_decisions)) { $errors.Add('gate_decision_invalid') }
    $expected = @($Controls | Where-Object { $_.mapped_requirements -contains $Pack.gate } | ForEach-Object control_id | Sort-Object -Unique)
    $applicable = @($Pack.applicable_control_ids | Sort-Object -Unique)
    if (($expected -join ',') -ne ($applicable -join ',')) { $errors.Add('applicable_control_population_mismatch') }
    $results = @($Pack.control_results)
    if (@($results.control_id | Sort-Object -Unique).Count -ne $results.Count) { $errors.Add('duplicate_control_result') }
    if ((@($results.control_id | Sort-Object) -join ',') -ne ($applicable -join ',')) { $errors.Add('control_result_population_mismatch') }
    foreach ($result in $results) {
        $registered = @($Controls | Where-Object { $_.control_id -eq $result.control_id })
        if ($registered.Count -ne 1) { $errors.Add('unregistered_control_result'); continue }
        if ($result.owner -ne $registered[0].owner -or $result.operator -ne $registered[0].operator -or $result.tier -ne $registered[0].tier) { $errors.Add('control_metadata_mismatch') }
        if ([int]$result.population_count -le 0) { $errors.Add('empty_population') }
        $computed = if ([int]$result.population_count -gt 0) { [math]::Round(([int]$result.tested_count / [int]$result.population_count) * 100, 4) } else { 0 }
        if ([double]$result.coverage_percent -ne $computed) { $errors.Add('coverage_arithmetic_mismatch') }
        if ($result.tier -eq 'T0' -and ([int]$result.tested_count -ne [int]$result.population_count -or $computed -ne 100 -or $result.result -ne 'PASS')) { $errors.Add('t0_census_or_result_invalid') }
    }
    $requiredRoles = @('OWNER','PEER','CONTROL','CHECKER')
    foreach ($role in $requiredRoles) { if (@($Pack.approvals | Where-Object { $_.role -eq $role -and $_.decision -eq 'PASS' }).Count -ne 1) { $errors.Add("approval_role_invalid_$role") } }
    $approvalActors = @($Pack.approvals | ForEach-Object actor)
    if (@($approvalActors | Select-Object -Unique).Count -ne $approvalActors.Count) { $errors.Add('approval_actor_overlap') }
    if ($approvalActors -contains $Pack.author) { $errors.Add('author_approves_own_pack') }
    if (@($Pack.approvals | Where-Object { $_.subject_sha256 -ne $ExpectedSubjectDigest }).Count -gt 0) { $errors.Add('approval_subject_mismatch') }
    $artifactPaths = @($Pack.review_subject.artifacts | ForEach-Object path)
    if (@($artifactPaths | Select-Object -Unique).Count -ne $artifactPaths.Count) { $errors.Add('duplicate_artifact_path') }
    if (@($artifactPaths | Where-Object { $_ -notmatch '^[A-Za-z0-9._/-]+$' -or $_ -match '(^/|\.\.|//)' }).Count -gt 0) { $errors.Add('artifact_path_not_normalized') }
    if ($Pack.review_subject.digest -ne $ExpectedSubjectDigest) { $errors.Add('review_subject_mismatch') }
    if ($Pack.review_subject.digest -ne (Get-ArtifactManifestDigest @($Pack.review_subject.artifacts))) { $errors.Add('review_subject_artifact_digest_mismatch') }
    $t0Ids = @($Controls | Where-Object { $_.tier -eq 'T0' } | ForEach-Object control_id)
    if (@($Pack.exceptions | Where-Object { $_.status -eq 'ACTIVE' -and $_.control_id -in $t0Ids }).Count -gt 0) { $errors.Add('active_t0_exception') }
    if ($Pack.immutability.state -ne 'SEALED' -or $Pack.immutability.mutation_policy -ne 'APPEND_ONLY_SUPERSEDING_PACK') { $errors.Add('pack_not_sealed') }
    if ($Pack.immutability.canonicalization -ne 'nexus_canonical_json_v1_sorted_keys_utf8_no_bom' -or $Pack.immutability.digest_scope -ne 'entire_pack_excluding_immutability.pack_sha256') { $errors.Add('canonical_scope_invalid') }
    if ($Pack.immutability.pack_sha256 -ne (Get-PackDigest $Pack)) { $errors.Add('pack_digest_mismatch') }
    return [pscustomobject]@{ valid = $errors.Count -eq 0; errors = @($errors) }
}

function Test-SealedStoreOperation {
    param([string]$Operation, [string]$ActorRole, $ExistingPack, $CandidatePack)
    if ($Operation -in @('UPDATE','DELETE') -and $ExistingPack.immutability.state -eq 'SEALED') { return $false }
    if ($Operation -eq 'CREATE' -and $null -ne $ExistingPack -and $CandidatePack.pack_id -eq $ExistingPack.pack_id) { return $false }
    if ($Operation -eq 'SUPERSEDE') {
        return $ActorRole -eq 'CHECKER' -and $ExistingPack.immutability.state -eq 'SEALED' -and $CandidatePack.pack_id -ne $ExistingPack.pack_id -and $CandidatePack.immutability.supersedes_pack_id -eq $ExistingPack.pack_id
    }
    return $Operation -eq 'CREATE' -and $ActorRole -in @('AUTHOR','OWNER')
}

Assert-Control ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
    registry = Join-Path $repoRoot 'controls\control-registry.json'
    evidence_schema = Join-Path $repoRoot 'controls\evidence-pack.schema.json'
    stage_gates = Join-Path $repoRoot 'controls\stage-gates.json'
    backlog = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    scorecard = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Control (Test-Path -LiteralPath $path -PathType Leaf) "Required artifact missing: $path" }

$registry = Read-Utf8 $paths.registry | ConvertFrom-Json
$schema = Read-Utf8 $paths.evidence_schema | ConvertFrom-Json
$gates = Read-Utf8 $paths.stage_gates | ConvertFrom-Json
$backlog = Read-Utf8 $paths.backlog
$scorecard = Read-Utf8 $paths.scorecard

Assert-Control ($registry.schema_version -eq 1) 'Control registry schema version must be 1.'
Assert-Control ($registry.status -eq 'active') 'Control registry must be active.'
Assert-Control ($registry.retirement_policy -match 'never deleted|never delete|never') 'Retirement policy must forbid silent deletion.'
Assert-Control ($registry.families.Count -eq 13) 'Exactly 13 NAC control families are required.'

$requiredResolved = @('control_id','objective','risk','owner','operator','evidence_source','frequency','population','sample_method','threshold','exception_policy','last_result','next_due','remediation_owner','mapped_requirements','tier','fail_closed','coverage_target_percent')
Assert-Control (@($requiredResolved | Where-Object { $_ -notin @($registry.resolved_control_fields) }).Count -eq 0) 'Resolved field contract is incomplete.'

$resolvedControls = [System.Collections.Generic.List[object]]::new()
$controlIds = [System.Collections.Generic.List[string]]::new()
$objectiveOwnerPairs = [System.Collections.Generic.List[string]]::new()
$familyIds = [System.Collections.Generic.List[string]]::new()
$validGates = @('G0','G1','G2','G3','G4','G5','G6','G7','G8')

foreach ($family in $registry.families) {
    $familyIds.Add([string]$family.family_id)
    Assert-Control ($family.family_id -match '^C(0[1-9]|1[0-3])$') "Invalid family ID: $($family.family_id)"
    Assert-Control ($family.owner -eq $family.family_id) "Family owner mismatch: $($family.family_id)"
    Assert-Control ($family.controls.Count -eq 11) "Each family must define 11 controls: $($family.family_id)"
    $ordinal = 0
    foreach ($control in $family.controls) {
        $ordinal++
        $resolved = [ordered]@{}
        $resolved.control_id = [string]$control.control_id
        $resolved.objective = [string]$control.objective
        $resolved.risk = [string]$family.risk
        $resolved.owner = [string]$family.owner
        $rawOperator = [string](Get-PropertyValue $control 'operator' $family.default_operator)
        $resolved.operator = if ($registry.operator_role_aliases.PSObject.Properties.Name -contains $rawOperator) { [string]$registry.operator_role_aliases.$rawOperator } else { $rawOperator }
        $resolved.evidence_source = [string]$control.evidence_source
        $resolved.frequency = [string](Get-PropertyValue $control 'frequency' $family.default_frequency)
        $resolved.population = [string](Get-PropertyValue $control 'population' $registry.global_defaults.population)
        $resolved.sample_method = [string](Get-PropertyValue $control 'sample_method' $registry.global_defaults.sample_method)
        $resolved.threshold = [string]$control.threshold
        $resolved.exception_policy = [string](Get-PropertyValue $control 'exception_policy' $registry.global_defaults.exception_policy)
        $resolved.last_result = [string](Get-PropertyValue $control 'last_result' $registry.global_defaults.last_result)
        $resolved.next_due = [string](Get-PropertyValue $control 'next_due' $registry.global_defaults.next_due)
        $resolved.remediation_owner = [string](Get-PropertyValue $control 'remediation_owner' $registry.global_defaults.remediation_owner)
        $resolved.mapped_requirements = @($control.mapped_requirements)
        $resolved.tier = [string](Get-PropertyValue $control 'tier' $registry.global_defaults.tier)
        $resolved.fail_closed = [bool](Get-PropertyValue $control 'fail_closed' $registry.global_defaults.fail_closed)
        $resolved.coverage_target_percent = [int](Get-PropertyValue $control 'coverage_target_percent' $registry.global_defaults.coverage_target_percent)
        if ($resolved.tier -eq 'T0') {
            $resolved.population = [string]$registry.t0_policy.population
            $resolved.sample_method = [string]$registry.t0_policy.sample_method
            $resolved.exception_policy = [string]$registry.t0_policy.exception_policy
            $resolved.fail_closed = [bool]$registry.t0_policy.fail_closed
            $resolved.coverage_target_percent = [int]$registry.t0_policy.coverage_target_percent
        }
        foreach ($field in $requiredResolved) {
            $value = $resolved[$field]
            Assert-Control ($null -ne $value) "Resolved field is null: $($resolved.control_id).$field"
            if ($value -is [string]) { Assert-Control (-not [string]::IsNullOrWhiteSpace($value)) "Resolved field is blank: $($resolved.control_id).$field" }
        }
        $expectedId = ('NX-{0}-{1:D3}' -f $family.family_id, $ordinal)
        Assert-Control ($resolved.control_id -eq $expectedId) "Control IDs must remain contiguous and stable: expected $expectedId"
        Assert-Control ($resolved.control_id -match '^NX-C(0[1-9]|1[0-3])-[0-9]{3}$') "Invalid control ID: $($resolved.control_id)"
        Assert-Control ($resolved.objective.Length -ge 12) "Control objective is too short: $($resolved.control_id)"
        Assert-Control ($resolved.operator -in @($registry.normative_roles)) "Operator role is not normatively resolved: $($resolved.control_id) -> $($resolved.operator)"
        if ($resolved.owner -eq $resolved.operator) {
            Assert-Control ($resolved.owner -in @($registry.owner_operator_overlap_policy.allowed_for_control_execution)) "Owner-operator overlap is not explicitly permitted: $($resolved.control_id)"
            Assert-Control (-not [bool]$registry.owner_operator_overlap_policy.counts_as_independent_approval) "Owner-operator overlap cannot count as independent approval."
        }
        Assert-Control ($resolved.mapped_requirements.Count -gt 0) "Control has no mapped requirement: $($resolved.control_id)"
        foreach ($mapped in $resolved.mapped_requirements) { Assert-Control ($mapped -in $validGates) "Unknown stage gate mapping: $($resolved.control_id) -> $mapped" }
        if ($resolved.tier -eq 'T0') {
            Assert-Control $resolved.fail_closed "T0 control must fail closed: $($resolved.control_id)"
            Assert-Control ($resolved.coverage_target_percent -eq 100) "T0 coverage must be 100 percent: $($resolved.control_id)"
            Assert-Control ($resolved.sample_method -eq 'census_100_percent') "T0 sampling must be census: $($resolved.control_id)"
            Assert-Control ($resolved.exception_policy -eq 'no_waiver') "T0 exception policy must be no waiver: $($resolved.control_id)"
        }
        $controlIds.Add($resolved.control_id)
        $objectiveOwnerPairs.Add(($resolved.owner + '|' + $resolved.objective.ToLowerInvariant()))
        $resolvedControls.Add([pscustomobject]$resolved)
    }
}

Assert-Control ($resolvedControls.Count -ge 131) 'At least 131 controls are required.'
Assert-Control (@($controlIds | Select-Object -Unique).Count -eq $controlIds.Count) 'Duplicate control ID detected.'
Assert-Control (@($objectiveOwnerPairs | Select-Object -Unique).Count -eq $objectiveOwnerPairs.Count) 'Duplicate objective-owner pair detected.'
Assert-Control (@($familyIds | Select-Object -Unique).Count -eq 13) 'Duplicate control family detected.'
Assert-Control (@(1..13 | ForEach-Object { 'C{0:D2}' -f $_ } | Where-Object { $_ -notin $familyIds }).Count -eq 0) 'A required control family is absent.'

$t0Controls = @($resolvedControls | Where-Object { $_.tier -eq 'T0' })
Assert-Control ($t0Controls.Count -ge 1) 'Registry must include T0 controls.'
Assert-Control (@($t0Controls | Where-Object { -not $_.fail_closed }).Count -eq 0) 'Every T0 control must fail closed.'
Assert-Control (@($t0Controls | Where-Object { $_.coverage_target_percent -ne 100 }).Count -eq 0) 'Every T0 control must cover 100 percent of its population.'
Assert-Control ($registry.t0_policy.promotion_on_missing_evidence -eq 'DENY') 'Missing T0 evidence must deny promotion.'

Assert-Control ($schema.'$schema' -eq 'https://json-schema.org/draft/2020-12/schema') 'Evidence schema must use JSON Schema draft 2020-12.'
$requiredPackFields = @('schema_version','pack_id','task_id','risk_class','gate','gate_decision','created_at','created_by','author','review_subject','applicable_control_ids','control_results','approvals','exceptions','provenance','immutability','spend')
Assert-Control (@($requiredPackFields | Where-Object { $_ -notin @($schema.required) }).Count -eq 0) 'Evidence Pack required fields are incomplete.'
Assert-Control ($schema.properties.immutability.properties.state.const -eq 'SEALED') 'Evidence Pack must seal immutable evidence.'
Assert-Control ($schema.properties.immutability.properties.mutation_policy.const -eq 'APPEND_ONLY_SUPERSEDING_PACK') 'Evidence mutation policy must be append-only supersession.'
Assert-Control ($schema.properties.immutability.properties.canonicalization.const -eq 'nexus_canonical_json_v1_sorted_keys_utf8_no_bom') 'Evidence canonicalization contract is missing.'
Assert-Control ($schema.properties.approvals.minItems -ge 4) 'Evidence Pack requires at least four approval roles.'
Assert-Control ($schema.properties.spend.properties.policy.const -eq 'default_deny_spend') 'Evidence Pack must report default deny spend.'

Assert-Control ($gates.default_decision -eq 'DENY') 'Stage gate default decision must be DENY.'
Assert-Control ($gates.missing_registry -eq 'DENY') 'Missing registry must deny promotion.'
Assert-Control ($gates.missing_evidence -match 'DENY') 'Missing evidence must deny promotion.'
Assert-Control ($gates.gates.Count -eq 9) 'Exactly nine stage gates are required.'
Assert-Control ((@($gates.gates.gate_id | Select-Object -Unique) -join ',') -eq ($validGates -join ',')) 'Stage gate IDs must be unique G0 through G8.'
foreach ($gate in $gates.gates) {
    Assert-Control (@($gate.required_evidence).Count -gt 0) "Gate has no evidence requirement: $($gate.gate_id)"
    Assert-Control (-not [string]::IsNullOrWhiteSpace([string]$gate.fail_decision)) "Gate has no fail decision: $($gate.gate_id)"
}
Assert-Control (-not [bool]$gates.maker_checker.author_may_approve_own_artifact) 'Author may not approve own artifact.'
Assert-Control ([bool]$gates.maker_checker.checker_must_differ_from_author) 'Checker must differ from author.'
Assert-Control ([bool]$gates.maker_checker.T0_requires_independent_control) 'T0 must require independent control.'
Assert-Control ($gates.conditional_pass.forbidden_for -contains 'T0_missing_evidence') 'Conditional pass must be forbidden for missing T0 evidence.'
Assert-Control ([bool]$gates.evidence_content_policy.content_addressed) 'Evidence must be content addressed.'
Assert-Control ([bool]$gates.evidence_content_policy.read_only_after_gate) 'Evidence must be read-only after gate.'
Assert-Control ($gates.evidence_store.sealed_update -eq 'DENY' -and $gates.evidence_store.sealed_delete -eq 'DENY') 'Sealed store must deny update and delete.'
Assert-Control ([bool]$gates.evidence_store.canonical_digest_verification_required) 'Sealed store must verify canonical digest.'

$thirdLine = $registry.third_line_sample_plan
Assert-Control ($thirdLine.owner -eq 'InternalAudit') 'Third line owner must be InternalAudit.'
Assert-Control ($thirdLine.independent_from -contains 'Delivery' -and $thirdLine.independent_from -contains 'NAC') 'Third line must be independent from Delivery and NAC.'
Assert-Control ($thirdLine.minimum_sample_percent -ge 10) 'Third-line sample must cover at least 10 percent.'
Assert-Control ($thirdLine.minimum_controls -ge 20) 'Third-line sample must include at least 20 controls.'
Assert-Control ([bool]$thirdLine.random_baseline_required) 'Third-line plan requires a random baseline.'
Assert-Control ([bool]$thirdLine.sample_selector_must_not_be_control_owner) 'Control owner cannot select the third-line sample.'
Assert-Control (-not [bool]$thirdLine.close_high_or_critical_by_generative_agent) 'Generative agents cannot close High or Critical third-line findings.'

$semanticArtifacts = @([pscustomobject]@{ path = 'controls/control-registry.json'; sha256 = ('c' * 64); classification = 'INTERNAL' })
$semanticSubject = Get-ArtifactManifestDigest $semanticArtifacts
$applicableG2 = @($resolvedControls | Where-Object { $_.mapped_requirements -contains 'G2' } | Sort-Object control_id)
$semanticResults = @($applicableG2 | ForEach-Object {
    [pscustomobject]@{
        control_id = $_.control_id; owner = $_.owner; operator = $_.operator; tier = $_.tier
        population_count = 10; tested_count = 10; coverage_percent = 100; result = 'PASS'
        run_id = 'SEMANTIC-VALID-001'; evidence_sha256 = ('b' * 64)
    }
})
$validPack = [pscustomobject]@{
    schema_version = 1; pack_id = 'NX-CTRL-001-EVID-SEMANTIC'; task_id = 'NX-CTRL-001'; risk_class = 'T0'; gate = 'G2'; gate_decision = 'MERGE'
    created_at = '2026-08-02T00:00:00Z'; created_by = 'EvidenceBuilder'; author = 'A00'
    review_subject = [pscustomobject]@{ algorithm = 'sha256'; digest = $semanticSubject; artifacts = $semanticArtifacts }
    applicable_control_ids = @($applicableG2.control_id)
    control_results = $semanticResults
    approvals = @(
        [pscustomobject]@{ role='OWNER'; actor='C11'; decision='PASS'; observed_at='2026-08-02T00:01:00Z'; subject_sha256=$semanticSubject },
        [pscustomobject]@{ role='PEER'; actor='C01'; decision='PASS'; observed_at='2026-08-02T00:02:00Z'; subject_sha256=$semanticSubject },
        [pscustomobject]@{ role='CONTROL'; actor='C12'; decision='PASS'; observed_at='2026-08-02T00:03:00Z'; subject_sha256=$semanticSubject },
        [pscustomobject]@{ role='CHECKER'; actor='InternalAudit'; decision='PASS'; observed_at='2026-08-02T00:04:00Z'; subject_sha256=$semanticSubject }
    )
    exceptions = @()
    provenance = [pscustomobject]@{ source_snapshot_sha256=('d' * 64); commit_or_snapshot_id='local-snapshot'; validator_run_id='SEMANTIC-VALID-001'; artifact_digest=$null; sbom_sha256=$null }
    immutability = [pscustomobject]@{ state='SEALED'; sealed_at='2026-08-02T00:05:00Z'; sealed_by='InternalAudit'; pack_sha256=''; mutation_policy='APPEND_ONLY_SUPERSEDING_PACK'; canonicalization='nexus_canonical_json_v1_sorted_keys_utf8_no_bom'; digest_scope='entire_pack_excluding_immutability.pack_sha256'; supersedes_pack_id=$null }
    spend = [pscustomobject]@{ policy='default_deny_spend'; incremental_amount=0; currency='EUR'; approval_id=$null }
}
$validPack.immutability.pack_sha256 = Get-PackDigest $validPack
$validSemantic = Test-PackSemantic $validPack @($resolvedControls) $gates $semanticSubject

$fakeCoveragePack = Copy-Pack $validPack
$fakeCoveragePack.control_results[0].tested_count = 0
$fakeCoveragePack.control_results[0].coverage_percent = 100
$fakeCoveragePack.immutability.pack_sha256 = Get-PackDigest $fakeCoveragePack
$missingControlPack = Copy-Pack $validPack
$missingControlPack.control_results = @($missingControlPack.control_results | Select-Object -Skip 1)
$missingControlPack.immutability.pack_sha256 = Get-PackDigest $missingControlPack
$selfApprovedPack = Copy-Pack $validPack
foreach ($approval in $selfApprovedPack.approvals) { $approval.actor = $selfApprovedPack.author }
$selfApprovedPack.immutability.pack_sha256 = Get-PackDigest $selfApprovedPack
$t0ExceptionPack = Copy-Pack $validPack
$firstT0 = @($applicableG2 | Where-Object { $_.tier -eq 'T0' })[0]
$t0ExceptionPack.exceptions = @([pscustomobject]@{ exception_id='EX-1'; control_id=$firstT0.control_id; owner='C11'; reason='invalid'; compensating_control='none'; expires_at='2026-08-03T00:00:00Z'; status='ACTIVE' })
$t0ExceptionPack.immutability.pack_sha256 = Get-PackDigest $t0ExceptionPack
$wrongDecisionPack = Copy-Pack $validPack
$wrongDecisionPack.gate_decision = 'RELEASE'
$wrongDecisionPack.immutability.pack_sha256 = Get-PackDigest $wrongDecisionPack
$badDigestPack = Copy-Pack $validPack
$badDigestPack.immutability.pack_sha256 = ('f' * 64)
$subjectMismatchPack = Copy-Pack $validPack
$subjectMismatchPack.approvals[0].subject_sha256 = ('e' * 64)
$subjectMismatchPack.immutability.pack_sha256 = Get-PackDigest $subjectMismatchPack
$artifactMismatchPack = Copy-Pack $validPack
$artifactMismatchPack.review_subject.artifacts[0].sha256 = ('e' * 64)
$artifactMismatchPack.immutability.pack_sha256 = Get-PackDigest $artifactMismatchPack
$delimiterManifestA = @(
    [pscustomobject]@{ path='a'; sha256=('1' * 64); classification='INTERNAL' },
    [pscustomobject]@{ path='b'; sha256=('2' * 64); classification='INTERNAL' }
)
$delimiterManifestB = @([pscustomobject]@{ path="a|$([string]('1' * 64))|INTERNAL`nb"; sha256=('2' * 64); classification='INTERNAL' })
$malformedPathPack = Copy-Pack $validPack
$malformedPathPack.review_subject.artifacts[0].path = "controls/a|b`nregistry.json"
$malformedPathPack.review_subject.digest = Get-ArtifactManifestDigest @($malformedPathPack.review_subject.artifacts)
foreach ($approval in $malformedPathPack.approvals) { $approval.subject_sha256 = $malformedPathPack.review_subject.digest }
$malformedPathPack.immutability.pack_sha256 = Get-PackDigest $malformedPathPack
$notApplicableMutationPack = Copy-Pack $validPack
$notApplicableMutationPack.control_results[0] | Add-Member -NotePropertyName not_applicable_reason -NotePropertyValue 'mutated_after_seal'
$exceptionMutationPack = Copy-Pack $validPack
$exceptionMutationPack.exceptions = @([pscustomobject]@{ exception_id='EX-CLOSED'; control_id=$firstT0.control_id; owner='C11'; reason='mutated_reason'; compensating_control='mutated_control'; expires_at='2026-08-03T00:00:00Z'; status='CLOSED' })
$artifactDigestMutationPack = Copy-Pack $validPack
$artifactDigestMutationPack.provenance.artifact_digest = ('e' * 64)
$sbomMutationPack = Copy-Pack $validPack
$sbomMutationPack.provenance.sbom_sha256 = ('e' * 64)
$supersedingPack = Copy-Pack $validPack
$supersedingPack.pack_id = 'NX-CTRL-001-EVID-SEMANTIC-2'
$supersedingPack.immutability.supersedes_pack_id = $validPack.pack_id
$supersedingPack.immutability.pack_sha256 = Get-PackDigest $supersedingPack

$negativeFixtures = [ordered]@{
    author_self_approval_denied = -not (Test-Approval 'A12' 'A12' @('A12') @('C01') 'C11' 'T1')
    owner_only_peer_denied = -not (Test-Approval 'A13' 'A12' @('A12') @('C01') 'C11' 'T1')
    author_as_checker_denied = -not (Test-Approval 'A12' 'A12' @('A13') @('C01') 'A12' 'T1')
    t0_without_control_denied = -not (Test-Approval 'A12' 'A12' @('A13') @() 'C11' 'T0')
    delivery_mutates_sealed_evidence_denied = -not (Test-EvidenceMutationAllowed 'SEALED' 'DELIVERY' ('a' * 64) ('b' * 64) 'APPEND_ONLY_SUPERSEDING_PACK')
    same_digest_delivery_rewrite_denied = -not (Test-EvidenceMutationAllowed 'SEALED' 'DELIVERY' ('a' * 64) ('a' * 64) 'APPEND_ONLY_SUPERSEDING_PACK')
    missing_registry_promotion_denied = $gates.missing_registry -eq 'DENY'
    missing_evidence_promotion_denied = $gates.missing_evidence -match 'DENY'
    fake_t0_coverage_denied = -not (Test-PackSemantic $fakeCoveragePack @($resolvedControls) $gates $semanticSubject).valid
    missing_applicable_control_denied = -not (Test-PackSemantic $missingControlPack @($resolvedControls) $gates $semanticSubject).valid
    self_approved_pack_denied = -not (Test-PackSemantic $selfApprovedPack @($resolvedControls) $gates $semanticSubject).valid
    active_t0_exception_denied = -not (Test-PackSemantic $t0ExceptionPack @($resolvedControls) $gates $semanticSubject).valid
    wrong_native_gate_decision_denied = -not (Test-PackSemantic $wrongDecisionPack @($resolvedControls) $gates $semanticSubject).valid
    bad_pack_digest_denied = -not (Test-PackSemantic $badDigestPack @($resolvedControls) $gates $semanticSubject).valid
    approval_subject_mismatch_denied = -not (Test-PackSemantic $subjectMismatchPack @($resolvedControls) $gates $semanticSubject).valid
    artifact_manifest_digest_mismatch_denied = -not (Test-PackSemantic $artifactMismatchPack @($resolvedControls) $gates $semanticSubject).valid
    delimiter_manifest_collision_denied = (Get-ArtifactManifestDigest $delimiterManifestA) -ne (Get-ArtifactManifestDigest $delimiterManifestB)
    malformed_artifact_path_denied = -not (Test-PackSemantic $malformedPathPack @($resolvedControls) $gates $malformedPathPack.review_subject.digest).valid
    not_applicable_reason_post_seal_mutation_denied = -not (Test-PackSemantic $notApplicableMutationPack @($resolvedControls) $gates $semanticSubject).valid
    exception_fields_post_seal_mutation_denied = -not (Test-PackSemantic $exceptionMutationPack @($resolvedControls) $gates $semanticSubject).valid
    provenance_artifact_digest_post_seal_mutation_denied = -not (Test-PackSemantic $artifactDigestMutationPack @($resolvedControls) $gates $semanticSubject).valid
    provenance_sbom_post_seal_mutation_denied = -not (Test-PackSemantic $sbomMutationPack @($resolvedControls) $gates $semanticSubject).valid
    sealed_update_denied = -not (Test-SealedStoreOperation 'UPDATE' 'OWNER' $validPack $validPack)
    sealed_delete_denied = -not (Test-SealedStoreOperation 'DELETE' 'CHECKER' $validPack $null)
    same_pack_id_reuse_denied = -not (Test-SealedStoreOperation 'CREATE' 'OWNER' $validPack $validPack)
}
$positiveFixtures = [ordered]@{
    independent_t1_approval_allowed = Test-Approval 'A12' 'A12' @('A13') @('C01') 'C11' 'T1'
    independent_t0_approval_allowed = Test-Approval 'A20' 'A20' @('A21') @('C03') 'C11' 'T0'
    sealed_unchanged_checker_read_allowed = Test-EvidenceMutationAllowed 'SEALED' 'CHECKER' ('a' * 64) ('a' * 64) 'APPEND_ONLY_SUPERSEDING_PACK'
    semantic_valid_pack_allowed = $validSemantic.valid
    sealed_supersession_allowed = Test-SealedStoreOperation 'SUPERSEDE' 'CHECKER' $validPack $supersedingPack
}
foreach ($fixture in $negativeFixtures.GetEnumerator()) { Assert-Control ([bool]$fixture.Value) "Negative fixture failed: $($fixture.Key)" }
foreach ($fixture in $positiveFixtures.GetEnumerator()) { Assert-Control ([bool]$fixture.Value) "Positive fixture failed: $($fixture.Key)" }

Assert-Control ($backlog -match '(?ms)- task_id: NX-CTRL-001.*?owner_agent: C11.*?status: (in_progress|review|control|done)') 'NX-CTRL-001 backlog owner or active state is invalid.'
Assert-Control ($backlog -match 'At least 131 stable control IDs exist') 'NX-CTRL acceptance criterion is missing.'
Assert-Control ($scorecard -match '(?m)^\s+active_packets:\s+1\s*$') 'Scorecard must show one active packet during owner validation.'
Assert-Control ($scorecard -match '(?m)^\s+active_task_id:\s+NX-CTRL-001\s*$') 'Scorecard active task must be NX-CTRL-001.'
Assert-Control ($scorecard -match '(?ms)^spend:.*?mode:\s+default_deny_spend.*?amount:\s+0') 'Scorecard must retain zero incremental spend.'

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$reviewSubjectLines = @($artifactHashes.GetEnumerator() | Where-Object { $_.Key -like 'controls/*' } | Sort-Object Key | ForEach-Object { $_.Key + '|' + $_.Value })
$reviewSubjectSha256 = Get-StringSha256 (($reviewSubjectLines -join "`n") + "`n")

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    run_id = $RunId
    observed_at = $ObservedAt
    command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-controls.ps1 -RunId $RunId -ObservedAt $ObservedAt -ExecutorRole $ExecutorRole"
    task_id = 'NX-CTRL-001'
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    assertions = $assertions
    failures = @($failures)
    inventory = [ordered]@{
        control_families = $registry.families.Count
        controls = $resolvedControls.Count
        t0_controls = $t0Controls.Count
        stage_gates = $gates.gates.Count
        duplicate_control_ids = $controlIds.Count - @($controlIds | Select-Object -Unique).Count
        duplicate_objective_owner_pairs = $objectiveOwnerPairs.Count - @($objectiveOwnerPairs | Select-Object -Unique).Count
        t0_fail_closed_coverage_percent = if ($t0Controls.Count -gt 0) { [math]::Round((@($t0Controls | Where-Object { $_.fail_closed -and $_.coverage_target_percent -eq 100 }).Count / $t0Controls.Count) * 100, 4) } else { 0 }
    }
    negative_fixtures = $negativeFixtures
    positive_fixtures = $positiveFixtures
    review_subject_sha256 = $reviewSubjectSha256
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    artifact_sha256 = $artifactHashes
}

$result | ConvertTo-Json -Depth 7
if ($failures.Count -gt 0) { exit 1 }
