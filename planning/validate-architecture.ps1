[CmdletBinding()]
param(
    [string]$RunId = ('NX-ARCH-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'A00', 'A02', 'A10', 'A12', 'A20', 'C01', 'C02', 'C04', 'C11')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Architecture {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

Assert-Architecture ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

function Read-Utf8 {
    param([Parameter(Mandatory = $true)][string]$Path)
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Parse-InlineList {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
    $trimmed = $Value.Trim()
    if (-not ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']'))) { return @() }
    $inner = $trimmed.Substring(1, $trimmed.Length - 2).Trim()
    if (-not $inner) { return @() }
    @($inner.Split(',') | ForEach-Object { $_.Trim() })
}

function Get-Section {
    param(
        [string]$Text,
        [string]$Name,
        [string]$NextName
    )
    $pattern = if ($NextName) {
        "(?ms)^$([regex]::Escape($Name)):\s*\r?\n(.*?)(?=^$([regex]::Escape($NextName)):\s*$)"
    }
    else {
        "(?ms)^$([regex]::Escape($Name)):\s*\r?\n(.*)\z"
    }
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) { throw "Section missing: $Name" }
    $match.Groups[1].Value
}

function Get-Field {
    param([string]$Block, [string]$Name)
    $match = [regex]::Match($Block, "(?m)^\s+$([regex]::Escape($Name)):\s*([^\r\n]+?)\s*$")
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    ''
}

$planningDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $planningDir
$paths = [ordered]@{
    registry = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    adr = Join-Path $repoRoot 'architecture\ADR-0001-monorepo-boundaries.md'
    p1 = Join-Path $planningDir 'backlog-p1.yaml'
    validator = $PSCommandPath
}

foreach ($path in $paths.Values) {
    Assert-Architecture (Test-Path -LiteralPath $path) "Missing architecture artifact: $path"
}

$registry = Read-Utf8 $paths.registry
$adr = Read-Utf8 $paths.adr
$p1 = Read-Utf8 $paths.p1

Assert-Architecture ($registry -match '(?m)^schema_version:\s*1\s*$') 'Unsupported registry schema version.'
Assert-Architecture ($registry -match '(?m)^default_policy:\s*deny\s*$') 'Architecture must deny unknown access by default.'
Assert-Architecture ($registry -match '(?m)^cross_context_access:\s*public_contract_or_event_only\s*$') 'Cross-context mode is not contract/event only.'

$requiredZones = [ordered]@{ app = 'apps/'; service = 'services/'; package = 'packages/'; contract = 'contracts/' }
foreach ($zoneRoot in $requiredZones.Values) {
    Assert-Architecture ($registry -match "(?m)^\s+root:\s*$([regex]::Escape($zoneRoot))\s*$") "Zone root missing: $zoneRoot"
}

$contextSection = Get-Section $registry 'contexts' 'sensitive_data_rules'
$contextMatches = @([regex]::Matches($contextSection, '(?ms)^  - id:\s*(\S+)\s*\r?\n(.*?)(?=^  - id:|\z)'))
$contexts = @{}
foreach ($match in $contextMatches) {
    $id = $match.Groups[1].Value
    $block = $match.Groups[2].Value
    Assert-Architecture (-not $contexts.ContainsKey($id)) "Duplicate context ID: $id"
    $contexts[$id] = [ordered]@{
        id = $id
        name = Get-Field $block 'bounded_context'
        owner = Get-Field $block 'owner'
        public_path = (Get-Field $block 'public_api_path').Trim('"').Trim("'")
        import_specifier = (Get-Field $block 'import_specifier').Trim('"').Trim("'")
        imports = @(Parse-InlineList (Get-Field $block 'allowed_imports'))
        publishes = @(Parse-InlineList (Get-Field $block 'publish_events'))
        consumes = @(Parse-InlineList (Get-Field $block 'consume_events'))
        data = @(Parse-InlineList (Get-Field $block 'data_access'))
    }
}
Assert-Architecture ($contexts.Count -ge 20) 'Bounded-context registry is unexpectedly incomplete.'

foreach ($context in $contexts.Values) {
    Assert-Architecture (-not [string]::IsNullOrWhiteSpace($context.name)) "bounded_context missing: $($context.id)"
    Assert-Architecture ($context.owner -match '^A\d{2}$') "Context must have one delivery owner: $($context.id)"
    Assert-Architecture ($context.imports -notcontains $context.id) "Context imports itself: $($context.id)"
    foreach ($target in $context.imports) {
        Assert-Architecture ($contexts.ContainsKey($target)) "Unknown import target: $($context.id)->$target"
    }
}

$publishedBy = @{}
foreach ($context in $contexts.Values) {
    foreach ($eventName in $context.publishes) {
        Assert-Architecture ($eventName -match '^[a-z][a-z0-9_.-]+$') "Invalid event name: $eventName"
        Assert-Architecture (-not $publishedBy.ContainsKey($eventName)) "Event has multiple schema owners: $eventName"
        $publishedBy[$eventName] = $context.id
    }
}
foreach ($context in $contexts.Values) {
    foreach ($eventName in $context.consumes) {
        Assert-Architecture ($publishedBy.ContainsKey($eventName)) "Consumed event has no owner: $($context.id)<-$eventName"
    }
}

$visiting = @{}
$visited = @{}
function Visit-Context {
    param([string]$ContextId)
    if ($script:visiting[$ContextId]) { throw "Import cycle at $ContextId" }
    if ($script:visited[$ContextId]) { return }
    $script:visiting[$ContextId] = $true
    foreach ($target in $script:contexts[$ContextId].imports) { Visit-Context $target }
    $script:visiting[$ContextId] = $false
    $script:visited[$ContextId] = $true
}
$cycleDetected = $false
try { foreach ($contextId in $contexts.Keys) { Visit-Context $contextId } }
catch { $cycleDetected = $true }
Assert-Architecture (-not $cycleDetected) 'Context import graph contains a cycle.'

$sensitiveSection = Get-Section $registry 'sensitive_data_rules' 'event_policy'
$sensitiveMatches = @([regex]::Matches($sensitiveSection, '(?ms)^  - data_class:\s*(\S+)\s*\r?\n(.*?)(?=^  - data_class:|\z)'))
$sensitiveRules = @{}
foreach ($match in $sensitiveMatches) {
    $class = $match.Groups[1].Value
    $block = $match.Groups[2].Value
    Assert-Architecture (-not $sensitiveRules.ContainsKey($class)) "Duplicate sensitive data rule: $class"
    $sensitiveRules[$class] = [ordered]@{
        allowed = @(Parse-InlineList (Get-Field $block 'allowed_contexts'))
        owner = Get-Field $block 'owner_context'
        projection_consumers = @(Parse-InlineList (Get-Field $block 'authorized_projection_consumers'))
        projection_contract = (Get-Field $block 'projection_contract').Trim('"').Trim("'")
        projection_data_class = Get-Field $block 'projection_data_class'
        transport = Get-Field $block 'transport'
        purpose = Get-Field $block 'purpose'
        audiences = @(Parse-InlineList (Get-Field $block 'authorized_audiences'))
        event_payload = Get-Field $block 'event_payload'
    }
}
$requiredSensitive = @('ACCOUNT_PRIVATE', 'ACCOUNT_AUTHORIZED_PROJECTION', 'DATING_SENSITIVE', 'CHILD_DATA', 'MESSAGE_PLAINTEXT_ON_DEVICE', 'KYC_RAW', 'WELLNESS_PRIVATE', 'LOCATION_PRECISE_EPHEMERAL', 'SAFETY_EVIDENCE')
foreach ($class in $requiredSensitive) {
    Assert-Architecture ($sensitiveRules.ContainsKey($class)) "Sensitive class lacks a rule: $class"
}
foreach ($class in $sensitiveRules.Keys) {
    foreach ($allowedContext in $sensitiveRules[$class].allowed) {
        Assert-Architecture ($contexts.ContainsKey($allowedContext)) "Sensitive rule references unknown context: $class->$allowedContext"
    }
    Assert-Architecture (-not [string]::IsNullOrWhiteSpace($sensitiveRules[$class].transport)) "Sensitive class lacks transport rule: $class"
    foreach ($context in $contexts.Values) {
        if ($context.data -contains $class) {
            Assert-Architecture ($sensitiveRules[$class].allowed -contains $context.id) "Unauthorized sensitive data access: $($context.id)->$class"
        }
    }
}

$accountPrivateRule = $sensitiveRules['ACCOUNT_PRIVATE']
$accountProjectionRule = $sensitiveRules['ACCOUNT_AUTHORIZED_PROJECTION']
$expectedProjectionConsumers = @('admin_shell', 'mobile_shell', 'public_web_shell')
Assert-Architecture ($accountPrivateRule.owner -eq 'profile_core') 'ACCOUNT_PRIVATE must be owned by profile_core.'
Assert-Architecture ((@($accountPrivateRule.allowed | Sort-Object) -join ',') -eq 'profile_core') 'Raw ACCOUNT_PRIVATE must be accessible only to profile_core.'
Assert-Architecture ((@($accountPrivateRule.projection_consumers | Sort-Object) -join ',') -eq ($expectedProjectionConsumers -join ',')) 'ACCOUNT_PRIVATE projection consumers are not minimal or complete.'
Assert-Architecture ($accountPrivateRule.projection_contract -eq '@nexus/profile#authorized_projection') 'ACCOUNT_PRIVATE projection contract is incorrect.'
Assert-Architecture ($accountPrivateRule.projection_data_class -eq 'ACCOUNT_AUTHORIZED_PROJECTION') 'ACCOUNT_PRIVATE projection data class is incorrect.'
Assert-Architecture ($accountPrivateRule.transport -eq 'encrypted_purpose_bound') 'ACCOUNT_PRIVATE transport must be encrypted and purpose-bound.'
Assert-Architecture (-not [string]::IsNullOrWhiteSpace($accountPrivateRule.purpose)) 'ACCOUNT_PRIVATE purpose is missing.'
Assert-Architecture ((@($accountPrivateRule.audiences | Sort-Object) -join ',') -eq 'policy_authorized_operator,self_active_profile') 'ACCOUNT_PRIVATE audiences are not explicit.'
Assert-Architecture ($accountPrivateRule.event_payload -eq 'deny') 'ACCOUNT_PRIVATE must be denied in event payloads.'
Assert-Architecture ($accountProjectionRule.owner -eq 'profile_core') 'Authorized account projection must retain profile_core ownership.'
Assert-Architecture ((@($accountProjectionRule.allowed | Sort-Object) -join ',') -eq ($expectedProjectionConsumers -join ',')) 'Authorized account projection consumers differ from policy.'
Assert-Architecture ($accountProjectionRule.transport -eq 'encrypted_purpose_bound_projection') 'Authorized account projection transport is incorrect.'
Assert-Architecture ($accountProjectionRule.event_payload -eq 'deny') 'Authorized account projection must be denied in event payloads.'
foreach ($consumer in $expectedProjectionConsumers) {
    Assert-Architecture ($contexts[$consumer].imports -contains 'profile_core') "Projection consumer lacks Profile public API import: $consumer"
    Assert-Architecture ($contexts[$consumer].data -contains 'ACCOUNT_AUTHORIZED_PROJECTION') "Projection consumer lacks projection data class: $consumer"
    Assert-Architecture ($contexts[$consumer].data -notcontains 'ACCOUNT_PRIVATE') "Projection consumer owns raw ACCOUNT_PRIVATE: $consumer"
}
Assert-Architecture ($contexts['profile_core'].data -contains 'ACCOUNT_PRIVATE') 'profile_core lacks ACCOUNT_PRIVATE ownership.'
Assert-Architecture (@($contexts.Values | Where-Object { $_.id -ne 'profile_core' -and $_.data -contains 'ACCOUNT_PRIVATE' }).Count -eq 0) 'A non-owner context declares raw ACCOUNT_PRIVATE.'

$forbiddenPayload = [regex]::Match($registry, '(?m)^\s+forbidden_payload_data_classes:\s*(\[[^\r\n]*\])\s*$')
Assert-Architecture ($forbiddenPayload.Success) 'Event forbidden-payload list is missing.'
$forbiddenPayloadClasses = if ($forbiddenPayload.Success) { @(Parse-InlineList $forbiddenPayload.Groups[1].Value) } else { @() }
foreach ($class in $requiredSensitive) {
    Assert-Architecture ($forbiddenPayloadClasses -contains $class) "Sensitive class is not excluded from event payloads: $class"
}

$artifactSection = Get-Section $registry 'artifacts' 'task_ownership'
$artifactMatches = @([regex]::Matches($artifactSection, '(?ms)^  - id:\s*(\S+)\s*\r?\n(.*?)(?=^  - id:|\z)'))
$artifacts = @{}
$artifactPaths = @{}
$publicArtifactsByContext = @{}
$publicSpecifiers = @{}
$kindCounts = @{ app = 0; service = 0; package = 0; contract = 0 }
foreach ($match in $artifactMatches) {
    $id = $match.Groups[1].Value
    $block = $match.Groups[2].Value
    $kind = Get-Field $block 'kind'
    $zone = Get-Field $block 'zone'
    $path = Get-Field $block 'path'
    $contextId = Get-Field $block 'bounded_context'
    $owner = Get-Field $block 'owner'
    $isPublic = (Get-Field $block 'public_api') -eq 'true'
    $importSpecifier = (Get-Field $block 'import_specifier').Trim('"').Trim("'")
    Assert-Architecture (-not $artifacts.ContainsKey($id)) "Duplicate artifact ID: $id"
    Assert-Architecture (-not $artifactPaths.ContainsKey($path)) "Duplicate artifact path: $path"
    Assert-Architecture ($kindCounts.ContainsKey($kind)) "Unknown artifact kind: $id/$kind"
    if ($kindCounts.ContainsKey($kind)) { $kindCounts[$kind]++ }
    $expectedZone = if ($kind -eq 'app') { 'apps' } elseif ($kind -eq 'service') { 'services' } elseif ($kind -eq 'package') { 'packages' } else { 'contracts' }
    $expectedRoot = if ($kind -eq 'app') { 'apps/' } elseif ($kind -eq 'service') { 'services/' } elseif ($kind -eq 'package') { 'packages/' } else { 'contracts/' }
    Assert-Architecture ($zone -eq $expectedZone) "Artifact zone mismatch: $id"
    Assert-Architecture ($path.StartsWith($expectedRoot)) "Artifact path escapes zone: $id/$path"
    Assert-Architecture ($contexts.ContainsKey($contextId)) "Artifact has unknown bounded context: $id/$contextId"
    if ($contexts.ContainsKey($contextId)) {
        Assert-Architecture ($owner -eq $contexts[$contextId].owner) "Artifact owner differs from context owner: $id"
    }
    if ($isPublic) {
        Assert-Architecture ($kind -eq 'package') "Public API artifact must be a package: $id"
        if (-not $publicArtifactsByContext.ContainsKey($contextId)) { $publicArtifactsByContext[$contextId] = @() }
        $publicArtifactsByContext[$contextId] = @($publicArtifactsByContext[$contextId]) + @([ordered]@{ id = $id; path = $path; specifier = $importSpecifier })
        Assert-Architecture (-not [string]::IsNullOrWhiteSpace($importSpecifier)) "Public API artifact lacks import specifier: $id"
        Assert-Architecture (-not $publicSpecifiers.ContainsKey($importSpecifier)) "Duplicate public import specifier: $importSpecifier"
        $publicSpecifiers[$importSpecifier] = $id
    }
    $artifacts[$id] = $contextId
    $artifactPaths[$path] = $id
}
foreach ($kind in $kindCounts.Keys) {
    Assert-Architecture ($kindCounts[$kind] -gt 0) "No artifact declared for zone kind: $kind"
}
Assert-Architecture ($artifacts['app_kids'] -eq 'kids' -and $artifacts['service_kids_api'] -eq 'kids' -and $artifacts['package_kids'] -eq 'kids') 'Kids artifacts are not confined to the Kids context.'
Assert-Architecture ($contexts.ContainsKey('core_api_shell')) 'Core API composition context is missing.'
Assert-Architecture ($artifacts['service_api'] -eq 'core_api_shell') 'services/api must be owned by core_api_shell.'
Assert-Architecture ($artifacts['service_api'] -ne 'profile_core') 'profile_core must not own services/api.'
$expectedCoreApiImports = @('agent_network', 'chain_integration', 'commerce', 'contract_registry', 'dating', 'identity', 'live', 'media', 'messaging', 'moderation', 'observability', 'profile_core', 'recommendations', 'social')
Assert-Architecture ((@($contexts['core_api_shell'].imports | Sort-Object) -join ',') -eq ($expectedCoreApiImports -join ',')) 'core_api_shell imports differ from the approved P1 composition surfaces.'
Assert-Architecture ((@($contexts['core_api_shell'].data | Sort-Object) -join ',') -eq 'INTERNAL_CONFIG') 'core_api_shell must not own domain data classes.'
Assert-Architecture ($contexts['core_api_shell'].imports -notcontains 'kids') 'Adult core API must not import Kids.'
Assert-Architecture ($contexts.ContainsKey('public_web_shell') -and $contexts.ContainsKey('admin_shell')) 'Public and admin web shells must be distinct contexts.'
Assert-Architecture ($artifacts['app_public_web'] -eq 'public_web_shell') 'apps/public-web must belong to public_web_shell.'
Assert-Architecture ($artifacts['app_admin_web'] -eq 'admin_shell') 'apps/admin-web must belong to admin_shell.'
Assert-Architecture ($artifacts['app_public_web'] -ne $artifacts['app_admin_web']) 'Public and admin applications share a forbidden context.'
Assert-Architecture ($contexts['public_web_shell'].data -notcontains 'SAFETY_EVIDENCE') 'Public web shell must not access SAFETY_EVIDENCE.'
Assert-Architecture ($contexts['admin_shell'].data -contains 'SAFETY_EVIDENCE') 'Admin shell lacks required SAFETY_EVIDENCE access.'
Assert-Architecture ($contexts['mobile_shell'].imports -contains 'moderation') 'Mobile shell lacks the public Moderation API edge.'

$importTargets = @($contexts.Values | ForEach-Object { $_.imports } | Sort-Object -Unique)
$requiredExplicitAliases = @('profile_core', 'chain_integration', 'agent_network', 'node_network', 'live', 'music_grow', 'rights_creator', 'architecture_governance', 'chain_actions', 'chain_escrow')
foreach ($contextId in @($importTargets + $requiredExplicitAliases | Sort-Object -Unique)) {
    Assert-Architecture ($contexts.ContainsKey($contextId)) "Public API mapping references unknown context: $contextId"
    if ($contexts.ContainsKey($contextId)) {
        Assert-Architecture (-not [string]::IsNullOrWhiteSpace($contexts[$contextId].public_path)) "Importable context lacks public_api_path: $contextId"
        Assert-Architecture (-not [string]::IsNullOrWhiteSpace($contexts[$contextId].import_specifier)) "Importable context lacks import_specifier: $contextId"
    }
    $surfaceCount = if ($publicArtifactsByContext.ContainsKey($contextId)) { @($publicArtifactsByContext[$contextId]).Count } else { 0 }
    Assert-Architecture ($surfaceCount -eq 1) "Importable context must resolve to exactly one public artifact: $contextId/$surfaceCount"
    if ($surfaceCount -eq 1 -and $contexts.ContainsKey($contextId)) {
        $surface = @($publicArtifactsByContext[$contextId])[0]
        Assert-Architecture ($surface.path -eq $contexts[$contextId].public_path) "public_api_path does not resolve to artifact: $contextId"
        Assert-Architecture ($surface.specifier -eq $contexts[$contextId].import_specifier) "Context/artifact import specifier mismatch: $contextId"
    }
}
foreach ($sourceContext in $contexts.Values) {
    foreach ($targetContext in $sourceContext.imports) {
        $surfaceCount = if ($publicArtifactsByContext.ContainsKey($targetContext)) { @($publicArtifactsByContext[$targetContext]).Count } else { 0 }
        Assert-Architecture ($surfaceCount -eq 1) "Allowed import edge has no unique public surface: $($sourceContext.id)->$targetContext"
    }
}

$taskSection = Get-Section $registry 'task_ownership' 'change_rules'
$taskMatches = @([regex]::Matches($taskSection, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
$taskOwnership = @{}
foreach ($match in $taskMatches) {
    $taskId = $match.Groups[1].Value
    $contextId = Get-Field $match.Groups[2].Value 'bounded_context'
    Assert-Architecture (-not $taskOwnership.ContainsKey($taskId)) "Duplicate task ownership: $taskId"
    Assert-Architecture ($contexts.ContainsKey($contextId)) "Task has unknown bounded context: $taskId/$contextId"
    $taskOwnership[$taskId] = $contextId
}

$p1Matches = @([regex]::Matches($p1, '(?ms)^  - task_id:\s*(\S+)\s*\r?\n(.*?)(?=^  - task_id:|\z)'))
$p1TaskIds = @()
foreach ($match in $p1Matches) {
    $taskId = $match.Groups[1].Value
    $owner = Get-Field $match.Groups[2].Value 'owner_agent'
    $p1TaskIds += $taskId
    Assert-Architecture ($taskOwnership.ContainsKey($taskId)) "P1 task lacks bounded_context ownership: $taskId"
    if ($taskOwnership.ContainsKey($taskId) -and $contexts.ContainsKey($taskOwnership[$taskId])) {
        Assert-Architecture ($contexts[$taskOwnership[$taskId]].owner -eq $owner) "P1 owner differs from bounded-context owner: $taskId"
    }
}
Assert-Architecture ($p1TaskIds.Count -eq 20) 'Expected 20 P1 epic/entry records.'
Assert-Architecture (@($taskOwnership.Keys | Where-Object { $_ -notin $p1TaskIds }).Count -eq 0) 'Task ownership contains a non-P1 task.'

$requiredChangeRules = @(
    'default_cross_context_import:\s*deny',
    'direct_foreign_table_read:\s*deny',
    'contract_first:\s*true',
    'additive_or_versioned_contract_change:\s*required',
    'source_owner_approval:\s*required',
    'target_owner_approval:\s*required',
    'new_dependency_edge_review:\s*A02',
    'event_outbox_required:\s*true',
    'owner_may_self_approve:\s*false',
    'rollback_or_migration_required:\s*true'
)
foreach ($rule in $requiredChangeRules) {
    Assert-Architecture ($registry -match "(?m)^\s+$rule\s*$") "Required change rule missing: $rule"
}

function Test-ImportAllowed {
    param([string]$SourceContext, [string]$TargetContext, [string]$ImportPath, [string]$ImportSpecifier)
    if (-not $script:contexts.ContainsKey($SourceContext) -or -not $script:contexts.ContainsKey($TargetContext)) { return $false }
    if ($SourceContext -eq $TargetContext) { return $true }
    if ($TargetContext -notin $script:contexts[$SourceContext].imports) { return $false }
    if (-not $script:publicArtifactsByContext.ContainsKey($TargetContext)) { return $false }
    $surfaces = @($script:publicArtifactsByContext[$TargetContext])
    if ($surfaces.Count -ne 1) { return $false }
    return $ImportPath -eq $surfaces[0].path -and $ImportSpecifier -eq $surfaces[0].specifier
}

function Test-DataAccess {
    param([string]$SourceContext, [string]$DataClass)
    if (-not $script:contexts.ContainsKey($SourceContext)) { return $false }
    if ($script:sensitiveRules.ContainsKey($DataClass)) {
        return $script:sensitiveRules[$DataClass].allowed -contains $SourceContext
    }
    return $script:contexts[$SourceContext].data -contains $DataClass
}

function Test-AuthorizedProjection {
    param([string]$ConsumerContext, [string]$Audience, [bool]$PolicyAuthorized)
    if (-not $PolicyAuthorized -or -not $script:contexts.ContainsKey($ConsumerContext)) { return $false }
    $rule = $script:sensitiveRules['ACCOUNT_PRIVATE']
    if ($ConsumerContext -notin $rule.projection_consumers) { return $false }
    if ($Audience -notin $rule.audiences) { return $false }
    if ($script:contexts[$ConsumerContext].imports -notcontains 'profile_core') { return $false }
    if ($script:contexts[$ConsumerContext].data -notcontains $rule.projection_data_class) { return $false }
    return $rule.projection_contract -eq '@nexus/profile#authorized_projection'
}

function Test-EventPayloadAllowed {
    param([string]$DataClass)
    if ($DataClass -in $script:forbiddenPayloadClasses) { return $false }
    if ($script:sensitiveRules.ContainsKey($DataClass) -and $script:sensitiveRules[$DataClass].event_payload -eq 'deny') { return $false }
    return $true
}

$negativeFixtures = [ordered]@{
    social_to_dating_internals_denied = -not (Test-ImportAllowed 'social' 'dating' 'packages/dating/internal/candidates' '@nexus/dating')
    core_to_kids_data_denied = -not (Test-DataAccess 'profile_core' 'CHILD_DATA')
    alias_guess_denied = -not (Test-ImportAllowed 'mobile_shell' 'profile_core' 'packages/profile_core/api' '@nexus/profile_core')
    missing_surface_denied = -not (Test-ImportAllowed 'mobile_shell' 'dating' 'packages/dating/missing' '@nexus/dating')
    unknown_context_denied = -not (Test-ImportAllowed 'mobile_shell' 'unknown_context' 'packages/unknown/api' '@nexus/unknown')
    mobile_to_moderation_internals_denied = -not (Test-ImportAllowed 'mobile_shell' 'moderation' 'packages/moderation/internal/cases' '@nexus/moderation')
    core_api_to_dating_data_denied = -not (Test-DataAccess 'core_api_shell' 'DATING_SENSITIVE')
    core_api_to_financial_data_denied = -not (Test-DataAccess 'core_api_shell' 'FINANCIAL')
    public_web_to_safety_evidence_denied = -not (Test-DataAccess 'public_web_shell' 'SAFETY_EVIDENCE')
    public_web_direct_account_private_denied = -not (Test-DataAccess 'public_web_shell' 'ACCOUNT_PRIVATE')
    mobile_direct_account_private_denied = -not (Test-DataAccess 'mobile_shell' 'ACCOUNT_PRIVATE')
    cross_profile_unauthorized_projection_denied = -not (Test-AuthorizedProjection 'public_web_shell' 'other_profile_private' $false)
    account_private_event_payload_denied = -not (Test-EventPayloadAllowed 'ACCOUNT_PRIVATE')
    account_projection_event_payload_denied = -not (Test-EventPayloadAllowed 'ACCOUNT_AUTHORIZED_PROJECTION')
}
$positiveFixtures = [ordered]@{
    mobile_to_dating_public_api_allowed = Test-ImportAllowed 'mobile_shell' 'dating' 'packages/dating/api' '@nexus/dating'
    mobile_to_profile_alias_allowed = Test-ImportAllowed 'mobile_shell' 'profile_core' 'packages/profile/api' '@nexus/profile'
    mobile_to_moderation_public_api_allowed = Test-ImportAllowed 'mobile_shell' 'moderation' 'packages/moderation/api' '@nexus/moderation'
    admin_to_safety_evidence_allowed = Test-DataAccess 'admin_shell' 'SAFETY_EVIDENCE'
    profile_core_owns_account_private = Test-DataAccess 'profile_core' 'ACCOUNT_PRIVATE'
    mobile_self_projection_allowed = Test-AuthorizedProjection 'mobile_shell' 'self_active_profile' $true
    public_web_self_projection_allowed = Test-AuthorizedProjection 'public_web_shell' 'self_active_profile' $true
    admin_policy_projection_allowed = Test-AuthorizedProjection 'admin_shell' 'policy_authorized_operator' $true
    dating_owns_dating_sensitive = Test-DataAccess 'dating' 'DATING_SENSITIVE'
    kids_owns_child_data = Test-DataAccess 'kids' 'CHILD_DATA'
}
foreach ($fixture in $negativeFixtures.GetEnumerator()) {
    Assert-Architecture ([bool]$fixture.Value) "Negative fixture was not denied: $($fixture.Key)"
}
foreach ($fixture in $positiveFixtures.GetEnumerator()) {
    Assert-Architecture ([bool]$fixture.Value) "Positive fixture was denied: $($fixture.Key)"
}

$requiredAdrTerms = @('Dependency direction', 'Data boundaries', 'Supernova adapter', 'Media and realtime boundaries', 'Consequences', 'Migration sequence')
foreach ($term in $requiredAdrTerms) {
    Assert-Architecture ($adr -match [regex]::Escape($term)) "ADR section missing: $term"
}

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    run_id = $RunId
    observed_at = $ObservedAt
    command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-architecture.ps1 -RunId $RunId -ObservedAt $ObservedAt -ExecutorRole $ExecutorRole"
    task_id = 'NX-ARCH-001'
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    assertions = $assertions
    failures = @($failures)
    inventory = [ordered]@{
        zones = $requiredZones.Count
        bounded_contexts = $contexts.Count
        artifacts = $artifacts.Count
        applications = $kindCounts.app
        services = $kindCounts.service
        packages = $kindCounts.package
        contracts = $kindCounts.contract
        public_api_surfaces = $publicSpecifiers.Count
        p1_task_ownership_mappings = $taskOwnership.Count
        published_events = $publishedBy.Count
        import_cycles = if ($cycleDetected) { 1 } else { 0 }
    }
    negative_fixtures = $negativeFixtures
    positive_fixtures = $positiveFixtures
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    artifact_sha256 = $artifactHashes
}

$result | ConvertTo-Json -Depth 6
if ($failures.Count -gt 0) { exit 1 }
