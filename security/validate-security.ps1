[CmdletBinding()]
param(
    [string]$RunId = ('NX-SEC-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'C02', 'A02', 'A11', 'A20', 'C04', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Security {
    param([Parameter(Mandatory = $true)][bool]$Condition, [Parameter(Mandatory = $true)][string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

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
    @($inner.Split(',') | ForEach-Object { $_.Trim().Trim('"').Trim("'") })
}

function Get-Section {
    param([string]$Text, [string]$Name, [string]$NextName)
    $pattern = "(?ms)^$([regex]::Escape($Name)):\s*\r?\n(.*?)(?=^$([regex]::Escape($NextName)):\s*$)"
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

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value)) } finally { $sha.Dispose() }
    ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

function ConvertTo-CanonicalJson {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [string] -or $Value -is [char]) { return ($Value.ToString() | ConvertTo-Json -Compress) }
    if ($Value -is [bool]) { return $(if ($Value) { 'true' } else { 'false' }) }
    if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
        return [Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $pairs = [System.Collections.Generic.List[string]]::new()
        foreach ($key in @($Value.Keys | Sort-Object)) { $pairs.Add(($key | ConvertTo-Json -Compress) + ':' + (ConvertTo-CanonicalJson $Value[$key])) }
        return '{' + ($pairs -join ',') + '}'
    }
    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [System.Management.Automation.PSCustomObject]) {
        return '[' + (@($Value | ForEach-Object { ConvertTo-CanonicalJson $_ }) -join ',') + ']'
    }
    $objectPairs = [System.Collections.Generic.List[string]]::new()
    foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) { $objectPairs.Add(($property.Name | ConvertTo-Json -Compress) + ':' + (ConvertTo-CanonicalJson $property.Value)) }
    return '{' + ($objectPairs -join ',') + '}'
}

function ConvertFrom-UnicodeEscapes {
    param([string]$Text)
    [regex]::Replace($Text, '\\u([0-9a-fA-F]{4})', { param($match) [char][Convert]::ToInt32($match.Groups[1].Value, 16) })
}

function Get-ObjectFieldNames {
    param($Value)
    $names = [System.Collections.Generic.List[string]]::new()
    if ($null -eq $Value) { return @() }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($key in $Value.Keys) { $names.Add([string]$key); foreach ($nested in @(Get-ObjectFieldNames $Value[$key])) { $names.Add($nested) } }
    }
    elseif ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) { $names.Add($property.Name); foreach ($nested in @(Get-ObjectFieldNames $property.Value)) { $names.Add($nested) } }
    }
    elseif ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
        foreach ($item in $Value) { foreach ($nested in @(Get-ObjectFieldNames $item)) { $names.Add($nested) } }
    }
    @($names)
}

function Test-TextPolicy {
    param([string]$Text, $Policy, [string]$FileName = '')
    $findings = [System.Collections.Generic.List[string]]::new()
    $normalized = ConvertFrom-UnicodeEscapes $Text
    $secretKeys = @($Policy.repository_scan.secret_value_key_fragments | ForEach-Object { [regex]::Escape([string]$_) }) -join '|'
    $sensitiveKeys = @($Policy.repository_scan.sensitive_field_fragments | ForEach-Object { [regex]::Escape([string]$_) }) -join '|'
    $assignment = '["'']?(' + $secretKeys + ')["'']?\s*[:=]\s*(?:["''][^"'']{12,}["'']|[^\s,;#}\]]{12,})'
    $piiLiteral = '["'']?(' + $sensitiveKeys + ')["'']?\s*[:=]\s*(?:["''][^"'']{3,}["'']|[^\s,;#}\]]{3,})'
    $privateKeyHeader = ('-----' + 'BEGIN ' + '(RSA |EC |OPENSSH )?' + 'PRIVATE KEY' + '-----')
    $bearer = ('(?i)' + 'bearer' + '\s+[A-Za-z0-9._\-]{20,}')
    $providerCredential = '(?i)(?:ghp|github_pat|sk|AKIA)[_\-]?[A-Za-z0-9_\-]{16,}'
    if ($normalized -match "(?i)$assignment") { $findings.Add('secret_literal') }
    if ($normalized -match $privateKeyHeader) { $findings.Add('private_key_material') }
    if ($normalized -match $bearer) { $findings.Add('bearer_credential') }
    if ($normalized -match $providerCredential) { $findings.Add('provider_credential') }
    if ($normalized -match "(?i)$piiLiteral") { $findings.Add('pii_literal') }
    $extension = [IO.Path]::GetExtension($FileName).ToLowerInvariant()
    if ($extension -in @($Policy.repository_scan.structured_extensions)) {
        try {
            # Windows PowerShell 5 rejects the valid empty object key used by npm lockfiles.
            # Normalize only that key for structural inspection; the source text stays unchanged.
            $jsonForParser = [regex]::Replace($normalized, '""\s*:', '"__nexus_empty_key__":')
            $parsed = $jsonForParser | ConvertFrom-Json
            foreach ($key in @(Get-ObjectFieldNames $parsed)) {
                $normalizedKey = ([string]$key).ToLowerInvariant().Replace('-','_')
                if (@($Policy.repository_scan.secret_value_key_fragments | Where-Object { $normalizedKey -eq ([string]$_).ToLowerInvariant() }).Count -gt 0) { $findings.Add('structured_secret_key') }
                if (@($Policy.repository_scan.sensitive_field_fragments | Where-Object { $normalizedKey -eq ([string]$_).ToLowerInvariant() }).Count -gt 0) { $findings.Add('structured_pii_key') }
            }
        }
        catch { $findings.Add('structured_parse_error') }
    }
    [pscustomobject]@{ allowed = $findings.Count -eq 0; findings = @($findings) }
}

function Test-SourceBoundaryPolicy {
    param([string]$Text, [string]$SourceContext, $Policy, [hashtable]$Contexts, [hashtable]$ImportSpecifiers)
    $findings = [System.Collections.Generic.List[string]]::new()
    if (-not $Contexts.ContainsKey($SourceContext)) { $findings.Add('source_context_unresolved'); return [pscustomobject]@{allowed=$false;findings=@($findings)} }
    $normalized = ConvertFrom-UnicodeEscapes $Text
    $importMatches = @([regex]::Matches($normalized, '(?m)(?:from\s+|require\(\s*)["''](@nexus/[A-Za-z0-9._\-/]+)["'']'))
    foreach ($match in $importMatches) {
        $specifier = $match.Groups[1].Value
        if (-not $ImportSpecifiers.ContainsKey($specifier)) { $findings.Add("unknown_import:$specifier"); continue }
        $target = [string]$ImportSpecifiers[$specifier]
        if ($target -notin @($Contexts[$SourceContext].imports)) { $findings.Add("forbidden_import:$SourceContext->$target") }
    }
    $sqlMatches = @([regex]::Matches($normalized, '(?i)\b(?:from|join|update|into|delete\s+from)\s+["'']?([a-z][a-z0-9_]*)["'']?\.'))
    foreach ($match in $sqlMatches) {
        $schemaContext = $match.Groups[1].Value.ToLowerInvariant()
        if ($Contexts.ContainsKey($schemaContext) -and $schemaContext -ne $SourceContext) { $findings.Add("direct_foreign_table:$SourceContext->$schemaContext") }
    }
    [pscustomobject]@{ allowed = $findings.Count -eq 0; findings = @($findings) }
}

function Get-IncludedNodeRuntime {
    $localData = [Environment]::GetFolderPath('LocalApplicationData')
    $candidates = [System.Collections.Generic.List[string]]::new()
    foreach ($root in @((Join-Path $localData 'OpenAI\Codex\bin'), (Join-Path $localData 'OpenAI\Codex\runtimes\cua_node'))) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $candidates.Add((Join-Path $root 'node.exe'))
        foreach ($child in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            $candidates.Add((Join-Path $child.FullName 'node.exe'))
            $candidates.Add((Join-Path $child.FullName 'bin\node.exe'))
        }
    }
    foreach ($candidate in @($candidates | Sort-Object -Unique)) { if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate } }
    return $null
}

function Invoke-SourceBoundaryChecker {
    param([object[]]$Items, [hashtable]$Contexts, [hashtable]$ImportSpecifiers, [string]$CheckerPath, [string]$NodePath)
    $contextManifest = [ordered]@{}
    foreach ($entry in $Contexts.GetEnumerator()) { $contextManifest[$entry.Key] = [ordered]@{allowedImports=@($entry.Value.imports)} }
    $specifierManifest = [ordered]@{}
    foreach ($entry in $ImportSpecifiers.GetEnumerator()) { $specifierManifest[$entry.Key] = $entry.Value }
    $manifest = [ordered]@{schema_version=1;items=$Items;contexts=$contextManifest;knownSpecifiers=$specifierManifest;knownSchemas=@($Contexts.Keys | Sort-Object)}
    $tempPath = Join-Path ([IO.Path]::GetTempPath()) ('nexus-sec-source-' + [Guid]::NewGuid().ToString('N') + '.json')
    try {
        $manifestJson = ConvertTo-CanonicalJson $manifest
        [IO.File]::WriteAllText($tempPath, $manifestJson, [Text.UTF8Encoding]::new($false))
        $output = & $NodePath $CheckerPath $tempPath
        if ($LASTEXITCODE -ne 0) { throw "Source boundary checker failed with exit code $LASTEXITCODE" }
        return ($output | ConvertFrom-Json)
    }
    finally { if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force } }
}

function Get-PolicyFiles {
    param([string]$RootPath, [string[]]$ExcludedSegments)
    if (Test-Path -LiteralPath $RootPath -PathType Leaf) { return @((Get-Item -LiteralPath $RootPath)) }
    $files = [System.Collections.Generic.List[object]]::new()
    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($RootPath)
    while ($pending.Count -gt 0) {
        $current = $pending.Pop()
        foreach ($child in @(Get-ChildItem -LiteralPath $current -Force -ErrorAction Stop)) {
            if ($child.PSIsContainer) {
                if ($child.Name -notin $ExcludedSegments) { $pending.Push($child.FullName) }
            }
            else { $files.Add($child) }
        }
    }
    @($files)
}

function Test-FlowPolicy {
    param($FlowInput, $Policy, [hashtable]$Contexts, [string[]]$ExternalPrincipals, [bool]$EnforceImport = $true)
    $reasons = [System.Collections.Generic.List[string]]::new()
    $source = [string]$FlowInput.source
    $target = [string]$FlowInput.target
    $dataClass = [string]$FlowInput.data_class
    $sink = [string]$FlowInput.sink
    $via = [string]$FlowInput.via
    $schemaId = if ($FlowInput.PSObject.Properties.Name -contains 'schema_id') { [string]$FlowInput.schema_id } else { '' }
    $sourceInternal = $Contexts.ContainsKey($source)
    $targetInternal = $Contexts.ContainsKey($target)
    if (-not $sourceInternal -and $source -notin $ExternalPrincipals) { $reasons.Add('unknown_source') }
    if (-not $targetInternal -and $target -notin $ExternalPrincipals) { $reasons.Add('unknown_target') }
    $rules = @($Policy.data_rules | Where-Object { $_.data_class -eq $dataClass })
    if ($rules.Count -ne 1) { $reasons.Add('unknown_or_duplicate_data_class') }
    $schemas = @($Policy.classification_catalog.schemas | Where-Object { $_.schema_id -eq $schemaId })
    if ($schemas.Count -ne 1) { $reasons.Add('unknown_or_missing_schema') }
    elseif ($dataClass -notin @($schemas[0].data_classes)) { $reasons.Add('declared_class_not_authorized_by_schema') }
    if ($FlowInput.PSObject.Properties.Name -contains 'payload' -and $null -ne $FlowInput.payload) {
        $payloadKeys = @((Get-ObjectFieldNames $FlowInput.payload) | ForEach-Object { ([string]$_).ToLowerInvariant().Replace('_','').Replace('-','').Replace('.','') })
        foreach ($fieldRule in $Policy.classification_catalog.field_rules) {
            $matched = @($fieldRule.field_fragments | Where-Object {
                $fragment = ([string]$_).ToLowerInvariant().Replace('_','').Replace('-','').Replace('.','')
                @($payloadKeys | Where-Object { $_ -eq $fragment -or $_.Contains($fragment) }).Count -gt 0
            }).Count -gt 0
            if ($matched -and ($schemas.Count -ne 1 -or $fieldRule.data_class -notin @($schemas[0].data_classes))) { $reasons.Add("payload_schema_classification_conflict:$($fieldRule.data_class)") }
            if ($matched -and $dataClass -ne $fieldRule.data_class) { $reasons.Add("caller_classification_conflict:$($fieldRule.data_class)") }
        }
    }
    $sinkPolicy = $Policy.sinks.PSObject.Properties[$sink]
    if ($null -eq $sinkPolicy) { $reasons.Add('unknown_sink') }
    if ($rules.Count -eq 1) {
        $rule = $rules[0]
        if ($targetInternal -and $target -notin @($rule.allowed_contexts)) { $reasons.Add('target_not_authorized_for_data_class') }
        if ($sink -in @($rule.forbidden_sinks)) { $reasons.Add('forbidden_sink_for_data_class') }
        if ($null -ne $sinkPolicy -and $dataClass -notin @($sinkPolicy.Value.allows)) { $reasons.Add('sink_does_not_allow_data_class') }
    }
    if ($source -in @('kids', 'kids_device') -and $target -ne 'kids') { $reasons.Add('kids_to_adult_crossing') }
    if ($dataClass -eq 'CHILD_DATA' -and $target -ne 'kids') { $reasons.Add('child_data_outside_kids') }
    if ($dataClass -eq 'DATING_SENSITIVE' -and $target -ne 'dating') { $reasons.Add('dating_sensitive_outside_dating') }
    if ($dataClass -eq 'MESSAGE_PLAINTEXT_ON_DEVICE' -and $sink -ne 'internal_service') { $reasons.Add('message_plaintext_export') }
    if ($EnforceImport -and $sourceInternal -and $targetInternal -and $source -ne $target) {
        if ($via -ne 'public_contract_or_event') { $reasons.Add('cross_context_transport_not_public') }
        if ($target -notin @($Contexts[$source].imports)) { $reasons.Add('undeclared_import') }
    }
    if ($via -eq 'direct_foreign_table') { $reasons.Add('direct_foreign_table_read') }
    [pscustomobject]@{ allowed = $reasons.Count -eq 0; reasons = @($reasons) }
}

function Test-T0Decision {
    param([string]$Author, [string]$Checker, [bool]$EvidencePresent, [bool]$WaiverRequested, $Policy)
    if (-not $EvidencePresent) { return $false }
    if ($WaiverRequested) { return $false }
    if ($Author -eq $Checker) { return $false }
    return [bool]$Policy.t0_assurance.independent_control_required
}

Assert-Security ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-Security ($RunId -match '^NX-SEC-001-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$') 'RunId format is invalid.'

$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
    threat_model = Join-Path $PSScriptRoot 'threat-model.v1.json'
    policy = Join-Path $PSScriptRoot 'baseline-policy.v1.json'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    controls = Join-Path $repoRoot 'controls\control-registry.json'
    stage_gates = Join-Path $repoRoot 'controls\stage-gates.json'
    capacity_evidence = Join-Path $repoRoot 'planning\evidence\NX-CAP-001-validation.json'
    spend_policy = Join-Path $repoRoot 'planning\spend-control.yaml'
    zero_cost_guard = Join-Path $repoRoot 'planning\zero-cost-child-test.ps1'
    source_checker = Join-Path $PSScriptRoot 'source-boundary-check.js'
    backlog = Join-Path $repoRoot 'planning\backlog-p0.yaml'
    scorecard = Join-Path $repoRoot 'planning\capacity-scorecard.yaml'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Security (Test-Path -LiteralPath $path -PathType Leaf) "Required artifact missing: $path" }
$nodePath = Get-IncludedNodeRuntime
Assert-Security (-not [string]::IsNullOrWhiteSpace([string]$nodePath) -and (Test-Path -LiteralPath $nodePath -PathType Leaf)) 'Included Node runtime is unavailable.'
$typescriptRuntime = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\lib\typescript.js'
Assert-Security (Test-Path -LiteralPath $typescriptRuntime -PathType Leaf) 'Pinned TypeScript AST parser is unavailable.'

$model = Read-Utf8 $paths.threat_model | ConvertFrom-Json
$policy = Read-Utf8 $paths.policy | ConvertFrom-Json
$architectureText = Read-Utf8 $paths.architecture
$registry = Read-Utf8 $paths.controls | ConvertFrom-Json
$gates = Read-Utf8 $paths.stage_gates | ConvertFrom-Json
$capacityEvidence = Read-Utf8 $paths.capacity_evidence | ConvertFrom-Json
$spendPolicyText = Read-Utf8 $paths.spend_policy
$backlog = Read-Utf8 $paths.backlog
$scorecard = Read-Utf8 $paths.scorecard

Assert-Security ($model.schema_version -eq 1 -and $model.status -eq 'active') 'Threat model must be schema v1 and active.'
Assert-Security ($model.default_decision -eq 'DENY') 'Threat model must deny by default.'
Assert-Security ($policy.schema_version -eq 1 -and $policy.status -eq 'enforced') 'Baseline policy must be schema v1 and enforced.'
Assert-Security ($policy.default_decision -eq 'DENY' -and $policy.unknown_data_class -eq 'DENY') 'Policy must deny unknown inputs.'
Assert-Security ([decimal]$policy.incremental_cost_limit.amount -eq 0 -and $policy.incremental_cost_limit.currency -eq 'EUR') 'Security validation must retain zero incremental cost.'
Assert-Security ($capacityEvidence.status -eq 'PASS' -and $capacityEvidence.blocked_unallowlisted_egress_actions -ge 1 -and $capacityEvidence.blocked_economic_actions -ge 1) 'Accepted runtime guard evidence is missing or ineffective.'
Assert-Security ($capacityEvidence.credential_name_matches -eq 0) 'Accepted runtime guard evidence reports credential matches.'
Assert-Security ($spendPolicyText -match '(?m)^mode:\s+default_deny_spend\s*$' -and $spendPolicyText -match '(?m)^\s+max_incremental_amount:\s+0\s*$') 'Spend policy is not zero-cost fail closed.'
Assert-Security ($spendPolicyText -match '(?m)^\s+network_egress_allowlist:\s+\[\]\s*$' -and $spendPolicyText -match '(?m)^\s+active_approvals:\s+\[\]\s*$') 'Runtime policy permits unapproved egress or spend.'
foreach ($guardedPath in @('planning/spend-control.yaml','planning/zero-cost-child-test.ps1')) {
    $guardPath = Join-Path $repoRoot $guardedPath
    Assert-Security ($capacityEvidence.artifact_sha256.PSObject.Properties.Name -contains $guardedPath) "Runtime guard receipt omits artifact: $guardedPath"
    if ($capacityEvidence.artifact_sha256.PSObject.Properties.Name -contains $guardedPath) {
        Assert-Security ($capacityEvidence.artifact_sha256.$guardedPath -eq (Get-FileHash -LiteralPath $guardPath -Algorithm SHA256).Hash.ToLowerInvariant()) "Runtime guard artifact drift: $guardedPath"
    }
}

$contextSection = Get-Section $architectureText 'contexts' 'sensitive_data_rules'
$contextMatches = @([regex]::Matches($contextSection, '(?ms)^  - id:\s*(\S+)\s*\r?\n(.*?)(?=^  - id:|\z)'))
$contexts = @{}
foreach ($match in $contextMatches) {
    $id = $match.Groups[1].Value
    $block = $match.Groups[2].Value
    Assert-Security (-not $contexts.ContainsKey($id)) "Duplicate architecture context: $id"
    $contexts[$id] = [ordered]@{
        owner = Get-Field $block 'owner'
        imports = @(Parse-InlineList (Get-Field $block 'allowed_imports'))
        data = @(Parse-InlineList (Get-Field $block 'data_access'))
        import_specifier = (Get-Field $block 'import_specifier').Trim('"').Trim("'")
    }
}
Assert-Security ($contexts.Count -ge 20) 'Architecture context inventory is incomplete.'
$importSpecifiers = @{}
foreach ($contextEntry in $contexts.GetEnumerator()) {
    if (-not [string]::IsNullOrWhiteSpace([string]$contextEntry.Value.import_specifier)) {
        Assert-Security (-not $importSpecifiers.ContainsKey([string]$contextEntry.Value.import_specifier)) "Duplicate architecture import specifier: $($contextEntry.Value.import_specifier)"
        $importSpecifiers[[string]$contextEntry.Value.import_specifier] = [string]$contextEntry.Key
    }
}

$sensitiveSection = Get-Section $architectureText 'sensitive_data_rules' 'event_policy'
$sensitiveMatches = @([regex]::Matches($sensitiveSection, '(?ms)^  - data_class:\s*(\S+)\s*\r?\n(.*?)(?=^  - data_class:|\z)'))
$architectureSensitive = @{}
foreach ($match in $sensitiveMatches) {
    $architectureSensitive[$match.Groups[1].Value] = @(Parse-InlineList (Get-Field $match.Groups[2].Value 'allowed_contexts'))
}
$policyDataRules = @{}
foreach ($rule in $policy.data_rules) {
    Assert-Security (-not $policyDataRules.ContainsKey([string]$rule.data_class)) "Duplicate policy data class: $($rule.data_class)"
    $policyDataRules[[string]$rule.data_class] = $rule
    Assert-Security ($contexts.ContainsKey([string]$rule.owner_context)) "Policy data class has unknown owner context: $($rule.data_class)"
    foreach ($contextId in @($rule.allowed_contexts)) { Assert-Security ($contexts.ContainsKey([string]$contextId)) "Policy references unknown context: $($rule.data_class)->$contextId" }
}
$_schemaIds = @($policy.classification_catalog.schemas.schema_id)
Assert-Security (@($_schemaIds | Select-Object -Unique).Count -eq $_schemaIds.Count) 'Duplicate classification schema ID.'
foreach ($schema in $policy.classification_catalog.schemas) {
    Assert-Security (@($schema.data_classes).Count -gt 0) "Classification schema has no classes: $($schema.schema_id)"
    foreach ($class in @($schema.data_classes)) { Assert-Security ($policyDataRules.ContainsKey([string]$class)) "Classification schema references unknown class: $($schema.schema_id)->$class" }
}
foreach ($fieldRule in $policy.classification_catalog.field_rules) {
    Assert-Security ($policyDataRules.ContainsKey([string]$fieldRule.data_class) -and @($fieldRule.field_fragments).Count -gt 0) "Classification field rule is invalid: $($fieldRule.data_class)"
}
foreach ($context in $contexts.GetEnumerator()) {
    foreach ($class in @($context.Value.data)) { Assert-Security ($policyDataRules.ContainsKey([string]$class)) "Architecture class lacks policy: $($context.Key)->$class" }
}
foreach ($class in $architectureSensitive.Keys) {
    Assert-Security ($policyDataRules.ContainsKey($class)) "Sensitive architecture class lacks policy: $class"
    if ($policyDataRules.ContainsKey($class)) {
        $expected = @($architectureSensitive[$class] | Sort-Object)
        $actual = @($policyDataRules[$class].allowed_contexts | Sort-Object)
        Assert-Security (($expected -join ',') -eq ($actual -join ',')) "Sensitive policy/architecture context mismatch: $class"
    }
}

$resolvedControls = @{}
$t0Controls = [System.Collections.Generic.List[object]]::new()
foreach ($family in $registry.families) {
    foreach ($control in $family.controls) {
        $tier = if ($control.PSObject.Properties.Name -contains 'tier') { [string]$control.tier } else { [string]$registry.global_defaults.tier }
        $resolved = [pscustomobject]@{
            control_id = [string]$control.control_id
            tier = $tier
            fail_closed = if ($tier -eq 'T0') { [bool]$registry.t0_policy.fail_closed } elseif ($control.PSObject.Properties.Name -contains 'fail_closed') { [bool]$control.fail_closed } else { [bool]$registry.global_defaults.fail_closed }
            coverage = if ($tier -eq 'T0') { [int]$registry.t0_policy.coverage_target_percent } elseif ($control.PSObject.Properties.Name -contains 'coverage_target_percent') { [int]$control.coverage_target_percent } else { [int]$registry.global_defaults.coverage_target_percent }
            exception_policy = if ($tier -eq 'T0') { [string]$registry.t0_policy.exception_policy } elseif ($control.PSObject.Properties.Name -contains 'exception_policy') { [string]$control.exception_policy } else { [string]$registry.global_defaults.exception_policy }
            sample_method = if ($tier -eq 'T0') { [string]$registry.t0_policy.sample_method } elseif ($control.PSObject.Properties.Name -contains 'sample_method') { [string]$control.sample_method } else { [string]$registry.global_defaults.sample_method }
        }
        Assert-Security (-not $resolvedControls.ContainsKey($resolved.control_id)) "Duplicate control ID: $($resolved.control_id)"
        $resolvedControls[$resolved.control_id] = $resolved
        if ($tier -eq 'T0') { $t0Controls.Add($resolved) }
    }
}
Assert-Security ($t0Controls.Count -gt 0) 'T0 control population is empty.'
foreach ($control in $t0Controls) {
    Assert-Security $control.fail_closed "T0 control is not fail closed: $($control.control_id)"
    Assert-Security ($control.coverage -eq 100) "T0 control is not census covered: $($control.control_id)"
    Assert-Security ($control.exception_policy -eq 'no_waiver') "T0 control is waivable: $($control.control_id)"
    Assert-Security ($control.sample_method -eq 'census_100_percent') "T0 control does not use census: $($control.control_id)"
}
Assert-Security ([bool]$policy.t0_assurance.fail_closed_required -and $policy.t0_assurance.coverage_target_percent -eq 100) 'Policy T0 fail-closed/census contract is invalid.'
Assert-Security ($policy.t0_assurance.exception_policy -eq 'no_waiver' -and -not [bool]$policy.t0_assurance.author_may_waive) 'Policy permits a T0 waiver.'
Assert-Security (-not [bool]$gates.maker_checker.author_may_approve_own_artifact -and [bool]$gates.maker_checker.T0_requires_independent_control) 'Stage gate maker-checker contract is invalid.'
Assert-Security ($gates.missing_registry -eq 'DENY' -and $gates.missing_evidence -match 'DENY') 'Missing T0 registry/evidence must deny.'

$assetIds = @($model.assets.asset_id)
$threatIds = @($model.threats.threat_id)
$boundaryIds = @($model.trust_boundaries.boundary_id)
$expectedAssetIds = @('A-SESSION','A-KEYS','A-ESCROW','A-E2EE','A-PROFILE-MAP','A-DATING','A-KIDS','A-COMMERCE-PRIVATE','A-MEDIA','A-SAFETY','A-SUPPLY')
$expectedThreatIds = @('T-ATO','T-CAPABILITY','T-TAMPER','T-REPUDIATION','T-DISCLOSURE','T-ECONOMIC-DOS','T-REPLAY','T-SECRET','T-SUPPLY','T-PRIVACY-LINK','T-INSIDER','T-DATING-LEAK','T-CHILD-CROSSING','T-UNSAFE-SURFACE','T-MALWARE','T-RETENTION')
$expectedBoundaryIds = @('TB-IDENTITY','TB-PROFILE','TB-MESSAGE','TB-DATING-CHAIN','TB-KIDS','TB-ADMIN-SAFETY','TB-COMMERCE-CHAIN','TB-MEDIA-STORAGE','TB-CHAIN','TB-BUILD')
Assert-Security (@($assetIds | Select-Object -Unique).Count -eq $assetIds.Count) 'Duplicate asset ID.'
Assert-Security (@($threatIds | Select-Object -Unique).Count -eq $threatIds.Count) 'Duplicate threat ID.'
Assert-Security (@($boundaryIds | Select-Object -Unique).Count -eq $boundaryIds.Count) 'Duplicate trust-boundary ID.'
Assert-Security ((@($assetIds | Sort-Object) -join ',') -eq (@($model.required_inventory.asset_ids | Sort-Object) -join ',')) 'Required asset census drifted.'
Assert-Security ((@($threatIds | Sort-Object) -join ',') -eq (@($model.required_inventory.threat_ids | Sort-Object) -join ',')) 'Required threat census drifted.'
Assert-Security ((@($boundaryIds | Sort-Object) -join ',') -eq (@($model.required_inventory.boundary_ids | Sort-Object) -join ',')) 'Required boundary census drifted.'
Assert-Security ((@($assetIds | Sort-Object) -join ',') -eq (@($expectedAssetIds | Sort-Object) -join ',')) 'Authoritative asset baseline drifted.'
Assert-Security ((@($threatIds | Sort-Object) -join ',') -eq (@($expectedThreatIds | Sort-Object) -join ',')) 'Authoritative threat baseline drifted.'
Assert-Security ((@($boundaryIds | Sort-Object) -join ',') -eq (@($expectedBoundaryIds | Sort-Object) -join ',')) 'Authoritative boundary baseline drifted.'
Assert-Security (@($model.assets | Where-Object { $_.criticality -eq 'CRITICAL' }).Count -eq 10) 'Critical asset census drifted.'
$validThreatCategories = @('SPOOFING','TAMPERING','REPUDIATION','INFORMATION_DISCLOSURE','DENIAL_OF_SERVICE','ELEVATION_OF_PRIVILEGE','PRIVACY_LINKABILITY','PRIVACY_SPECIAL_CATEGORY','CHILD_SAFETY','PRIVACY_RETENTION')
foreach ($threat in $model.threats) {
    Assert-Security ($threat.owner -in @($registry.normative_roles) -and $threat.owner -match '^C\d{2}$') "Threat lacks authoritative control owner: $($threat.threat_id)"
    Assert-Security ($threat.category -in $validThreatCategories) "Unknown threat category: $($threat.threat_id)"
    Assert-Security (@($threat.control_ids).Count -gt 0) "Threat lacks controls: $($threat.threat_id)"
    foreach ($controlId in @($threat.control_ids)) { Assert-Security ($resolvedControls.ContainsKey([string]$controlId)) "Threat references unknown control: $($threat.threat_id)->$controlId" }
}
foreach ($asset in $model.assets) {
    Assert-Security ($asset.owner -in @($registry.normative_roles) -and $asset.owner -match '^A\d{2}$') "Asset lacks authoritative delivery owner: $($asset.asset_id)"
    Assert-Security (@($asset.data_classes).Count -gt 0 -and @($asset.threat_ids).Count -gt 0 -and @($asset.control_ids).Count -gt 0) "Asset mapping is incomplete: $($asset.asset_id)"
    foreach ($class in @($asset.data_classes)) { Assert-Security ($policyDataRules.ContainsKey([string]$class)) "Asset references unknown data class: $($asset.asset_id)->$class" }
    foreach ($threatId in @($asset.threat_ids)) { Assert-Security ($threatId -in $threatIds) "Asset references unknown threat: $($asset.asset_id)->$threatId" }
    foreach ($controlId in @($asset.control_ids)) { Assert-Security ($resolvedControls.ContainsKey([string]$controlId)) "Asset references unknown control: $($asset.asset_id)->$controlId" }
}
foreach ($threatId in $threatIds) {
    $referenceCount = @($model.assets | Where-Object { $_.threat_ids -contains $threatId }).Count + @($model.trust_boundaries | Where-Object { $_.threat_ids -contains $threatId }).Count
    Assert-Security ($referenceCount -gt 0) "Threat is not mapped to an asset or boundary: $threatId"
}

$externalPrincipals = @($model.external_principals)
$boundaryDecisions = [ordered]@{}
foreach ($boundary in $model.trust_boundaries) {
    Assert-Security ($boundary.authentication_type -in @($policy.boundary_control_catalog.authentication_types)) "Boundary authentication type is invalid: $($boundary.boundary_id)"
    Assert-Security ($boundary.authorization_type -in @($policy.boundary_control_catalog.authorization_types)) "Boundary authorization type is invalid: $($boundary.boundary_id)"
    Assert-Security ($boundary.transport_type -in @($policy.boundary_control_catalog.transport_types)) "Boundary transport type is invalid: $($boundary.boundary_id)"
    Assert-Security ($boundary.edge_type -in @($policy.boundary_control_catalog.edge_types)) "Boundary edge type is invalid: $($boundary.boundary_id)"
    Assert-Security (@($boundary.protections).Count -gt 0 -and @($boundary.threat_ids).Count -gt 0 -and @($boundary.control_ids).Count -gt 0) "Boundary mapping is incomplete: $($boundary.boundary_id)"
    foreach ($threatId in @($boundary.threat_ids)) { Assert-Security ($threatId -in $threatIds) "Boundary references unknown threat: $($boundary.boundary_id)->$threatId" }
    foreach ($controlId in @($boundary.control_ids)) { Assert-Security ($resolvedControls.ContainsKey([string]$controlId)) "Boundary references unknown control: $($boundary.boundary_id)->$controlId" }
    $sourceInternal = $contexts.ContainsKey([string]$boundary.source)
    $targetInternal = $contexts.ContainsKey([string]$boundary.target)
    if ($boundary.edge_type -eq 'EXTERNAL_ADAPTER') {
        Assert-Security ($sourceInternal -xor $targetInternal) "External boundary must have exactly one internal endpoint: $($boundary.boundary_id)"
    }
    elseif ($boundary.edge_type -eq 'SOURCE_IMPORTS_TARGET') {
        Assert-Security ($sourceInternal -and $targetInternal -and $boundary.target -in @($contexts[[string]$boundary.source].imports)) "Boundary lacks declared source import edge: $($boundary.boundary_id)"
    }
    elseif ($boundary.edge_type -eq 'TARGET_IMPORTS_SOURCE') {
        Assert-Security ($sourceInternal -and $targetInternal -and $boundary.source -in @($contexts[[string]$boundary.target].imports)) "Boundary lacks declared target import edge: $($boundary.boundary_id)"
    }
    $sink = if ($boundary.target -eq 'multiversx_network') { 'chain' } elseif ($boundary.target -eq 'object_storage') { 'private_storage' } else { 'internal_service' }
    $dataDecisions = [System.Collections.Generic.List[bool]]::new()
    foreach ($class in @($boundary.data_classes)) {
        $decision = Test-FlowPolicy ([pscustomobject]@{source=$boundary.source;target=$boundary.target;data_class=$class;schema_id=$boundary.schema_id;sink=$sink;via='public_contract_or_event'}) $policy $contexts $externalPrincipals $false
        $dataDecisions.Add([bool]$decision.allowed)
        Assert-Security ([bool]$decision.allowed) "Threat boundary violates baseline policy: $($boundary.boundary_id)/$class/$($decision.reasons -join ',')"
    }
    $boundaryDecisions[$boundary.boundary_id] = @($dataDecisions | Where-Object { -not $_ }).Count -eq 0
}
Write-Verbose 'Threat model and boundary validation completed.'

$contextPrefixes = [System.Collections.Generic.List[object]]::new()
foreach ($override in @($policy.path_context_overrides)) { $contextPrefixes.Add([pscustomobject]@{prefix=[string]$override.path_prefix;context=[string]$override.context}) }
$artifactSection = Get-Section $architectureText 'artifacts' 'task_ownership'
$artifactMatches = @([regex]::Matches($artifactSection, '(?ms)^  - id:\s*(\S+)\s*\r?\n(.*?)(?=^  - id:|\z)'))
foreach ($match in $artifactMatches) {
    $artifactPath = Get-Field $match.Groups[2].Value 'path'
    $artifactContext = Get-Field $match.Groups[2].Value 'bounded_context'
    if (-not [string]::IsNullOrWhiteSpace($artifactPath) -and -not [string]::IsNullOrWhiteSpace($artifactContext)) { $contextPrefixes.Add([pscustomobject]@{prefix=$artifactPath.TrimEnd('/') + '/';context=$artifactContext}) }
}
foreach ($mapping in $contextPrefixes) { Assert-Security ($contexts.ContainsKey([string]$mapping.context)) "Path mapping references unknown context: $($mapping.prefix)" }

$scanFiles = [System.Collections.Generic.List[string]]::new()
foreach ($relativeRoot in @($policy.repository_scan.roots)) {
    $rootPath = Join-Path $repoRoot ([string]$relativeRoot)
    if (-not (Test-Path -LiteralPath $rootPath)) { continue }
    $candidates = @(Get-PolicyFiles $rootPath @($policy.repository_scan.excluded_segments))
    foreach ($candidate in $candidates) {
        $nameAllowed = @($policy.repository_scan.file_name_patterns | Where-Object { $candidate.Name -like [string]$_ }).Count -gt 0
        if ($candidate.Extension -notin @($policy.repository_scan.extensions) -and -not $nameAllowed) { continue }
        $relative = $candidate.FullName.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')
        if (@($policy.repository_scan.excluded_segments | Where-Object { $relative.Split('/') -contains [string]$_ }).Count -gt 0) { continue }
        $scanFiles.Add($candidate.FullName)
    }
}
Write-Verbose "Repository population resolved: $($scanFiles.Count) files."
$sourceItems = [System.Collections.Generic.List[object]]::new()
$fileContext = @{}
foreach ($file in $scanFiles) {
    $relative = $file.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')
    $mapping = @($contextPrefixes | Where-Object { $relative.StartsWith($_.prefix, [StringComparison]::OrdinalIgnoreCase) } | Sort-Object { $_.prefix.Length } -Descending | Select-Object -First 1)
    $contextId = if ($mapping.Count -eq 1) { [string]$mapping[0].context } else { '__UNRESOLVED__' }
    $fileContext[$relative] = $contextId
    $sourceItems.Add([ordered]@{id=$relative;sourceContext=$contextId;text=Read-Utf8 $file})
}
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/forbidden-side-effect-import.ts';sourceContext='work';text='import "@nexus/dating"'})
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/forbidden-dynamic-literal.ts';sourceContext='work';text='const lazy = import("@nexus/dating")'})
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/forbidden-dynamic-concat.ts';sourceContext='work';text='const lazy = import("@nexus/" + "dating")'})
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/unresolved-dynamic-import.ts';sourceContext='work';text='const lazy = import(moduleName)'})
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/direct-foreign.sql';sourceContext='work';text='SELECT * FROM dating.matches'})
$sourceItems.Add([ordered]@{id='SYSTEM_TEST/allowed-import.ts';sourceContext='social';text='import x from "@nexus/media"'})
Write-Verbose "Invoking TypeScript source-boundary checker for $($sourceItems.Count) items."
$sourceCheck = Invoke-SourceBoundaryChecker @($sourceItems) $contexts $importSpecifiers $paths.source_checker $nodePath
Write-Verbose 'TypeScript source-boundary checker completed.'
$sourceCheckerById = @{}
foreach ($itemResult in @($sourceCheck.results)) { $sourceCheckerById[[string]$itemResult.id] = @($itemResult.findings) }

$scanFindings = [System.Collections.Generic.List[object]]::new()
foreach ($file in $scanFiles) {
    $relative = $file.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')
    $textDecision = Test-TextPolicy (Read-Utf8 $file) $policy $file
    $sourceFindings = if ($sourceCheckerById.ContainsKey($relative)) { @($sourceCheckerById[$relative]) } else { @('source_checker_result_missing') }
    $combined = @($textDecision.findings) + $sourceFindings
    if ($combined.Count -gt 0) { $scanFindings.Add([pscustomobject]@{path=$relative;context=$fileContext[$relative];findings=$combined}) }
}
Assert-Security ($scanFiles.Count -gt 0) 'Repository scan population is empty.'
Assert-Security ($scanFindings.Count -eq 0) 'Repository contains a secret or PII literal in an enforced source root.'

$secretFixture = ('api_' + 'key' + '="' + ('x' * 24) + '"')
$keyHeaderFixture = ('-----' + 'BEGIN ' + 'PRIVATE KEY' + '-----')
$bearerFixture = ('bearer' + ' ' + ('a' * 24))
$piiFixture = ('email' + '="synthetic@example.invalid"')
$unquotedSecretFixture = ('api_' + 'key' + '=' + ('z' * 24))
$unquotedPiiFixture = ('email' + '=synthetic@example.invalid')
$unicodeSecretFixture = ('{"api' + '\u005f' + 'key":"' + ('q' * 24) + '"}')
$datingSpoofPayload = [pscustomobject]@{ sexual_orientation = 'SYSTEM_TEST_CATEGORY' }
$kidsSpoofPayload = [pscustomobject]@{ child_profile_id = 'SYSTEM_TEST_CHILD' }
$negativeFixtures = [ordered]@{
    secret_literal_denied = -not (Test-TextPolicy $secretFixture $policy).allowed
    private_key_denied = -not (Test-TextPolicy $keyHeaderFixture $policy).allowed
    bearer_token_denied = -not (Test-TextPolicy $bearerFixture $policy).allowed
    pii_literal_denied = -not (Test-TextPolicy $piiFixture $policy).allowed
    unquoted_secret_denied = -not (Test-TextPolicy $unquotedSecretFixture $policy '.env').allowed
    unquoted_pii_denied = -not (Test-TextPolicy $unquotedPiiFixture $policy '.env').allowed
    unicode_escaped_json_secret_denied = -not (Test-TextPolicy $unicodeSecretFixture $policy 'fixture.json').allowed
    malformed_json_denied = -not (Test-TextPolicy '{"status":' $policy 'fixture.json').allowed
    child_to_adult_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='kids';target='social';data_class='CHILD_DATA';schema_id='nexus.kids.private.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    child_to_chain_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='kids';target='multiversx_network';data_class='CHILD_DATA';schema_id='nexus.kids.private.v1';sink='chain';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    dating_to_recommender_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='dating';target='recommendations';data_class='DATING_SENSITIVE';schema_id='nexus.dating.private.v1';sink='analytics';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    dating_to_search_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='dating';target='public_web_shell';data_class='DATING_SENSITIVE';schema_id='nexus.dating.private.v1';sink='public_search';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    dating_payload_mislabeled_public_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='core_api_shell';target='recommendations';data_class='PUBLIC';schema_id='nexus.profile.public.v1';payload=$datingSpoofPayload;sink='analytics';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    child_payload_mislabeled_public_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='mobile_shell';target='social';data_class='PUBLIC';schema_id='nexus.profile.public.v1';payload=$kidsSpoofPayload;sink='public_event';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    plaintext_to_chain_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='messaging';target='multiversx_network';data_class='MESSAGE_PLAINTEXT_ON_DEVICE';schema_id='nexus.messaging.plaintext-on-device.v1';sink='chain';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    undeclared_module_import_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='work';target='dating';data_class='PUBLIC';schema_id='nexus.social.public.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    forbidden_side_effect_import_denied = @($sourceCheckerById['SYSTEM_TEST/forbidden-side-effect-import.ts']).Count -gt 0
    forbidden_dynamic_literal_denied = @($sourceCheckerById['SYSTEM_TEST/forbidden-dynamic-literal.ts']).Count -gt 0
    forbidden_dynamic_concat_denied = @($sourceCheckerById['SYSTEM_TEST/forbidden-dynamic-concat.ts']).Count -gt 0
    unresolved_dynamic_import_denied = @($sourceCheckerById['SYSTEM_TEST/unresolved-dynamic-import.ts']).Count -gt 0
    direct_foreign_table_source_denied = @($sourceCheckerById['SYSTEM_TEST/direct-foreign.sql']).Count -gt 0
    direct_foreign_table_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='social';target='media';data_class='PUBLIC';schema_id='nexus.social.public.v1';sink='internal_service';via='direct_foreign_table'}) $policy $contexts $externalPrincipals).allowed
    unknown_data_class_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='social';target='media';data_class='UNREGISTERED_PRIVATE';schema_id='nexus.social.public.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    unknown_schema_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='social';target='media';data_class='PUBLIC';schema_id='unregistered.schema';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    unknown_sink_denied = -not (Test-FlowPolicy ([pscustomobject]@{source='social';target='media';data_class='PUBLIC';schema_id='nexus.social.public.v1';sink='unregistered_sink';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    author_t0_waiver_denied = -not (Test-T0Decision 'C02' 'C12' $true $true $policy)
    author_self_check_denied = -not (Test-T0Decision 'C02' 'C02' $true $false $policy)
    missing_t0_evidence_denied = -not (Test-T0Decision 'C02' 'C12' $false $false $policy)
    removed_asset_census_denied = (@($assetIds | Select-Object -Skip 1 | Sort-Object) -join ',') -ne (@($expectedAssetIds | Sort-Object) -join ',')
    removed_threat_census_denied = (@($threatIds | Select-Object -Skip 1 | Sort-Object) -join ',') -ne (@($expectedThreatIds | Sort-Object) -join ',')
    bogus_asset_owner_denied = 'A99' -notin @($registry.normative_roles)
    bogus_threat_owner_denied = 'C99' -notin @($registry.normative_roles)
    meaningless_authentication_denied = 'NONE' -notin @($policy.boundary_control_catalog.authentication_types)
    wrong_profile_boundary_edge_denied = 'profile_core' -notin @($contexts['identity'].imports)
}
$positiveFixtures = [ordered]@{
    clean_source_allowed = (Test-TextPolicy '{"status":"ok","classification":"PUBLIC"}' $policy 'fixture.json').allowed
    declared_import_source_allowed = @($sourceCheckerById['SYSTEM_TEST/allowed-import.ts']).Count -eq 0
    declared_module_import_allowed = (Test-FlowPolicy ([pscustomobject]@{source='social';target='media';data_class='PUBLIC';schema_id='nexus.social.public.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    dating_commitment_to_chain_allowed = (Test-FlowPolicy ([pscustomobject]@{source='dating';target='chain_integration';data_class='CHAIN_COMMITMENT';schema_id='nexus.dating.private-action.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    isolated_child_flow_allowed = (Test-FlowPolicy ([pscustomobject]@{source='kids_device';target='kids';data_class='CHILD_DATA';schema_id='nexus.kids.private.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    purpose_bound_safety_flow_allowed = (Test-FlowPolicy ([pscustomobject]@{source='admin_shell';target='moderation';data_class='SAFETY_EVIDENCE';schema_id='nexus.moderation.safety-evidence.v1';sink='internal_service';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    private_media_storage_allowed = (Test-FlowPolicy ([pscustomobject]@{source='media';target='object_storage';data_class='MEDIA_PRIVATE_SOURCE';schema_id='nexus.media.private-source.v1';sink='private_storage';via='public_contract_or_event'}) $policy $contexts $externalPrincipals).allowed
    independent_t0_check_allowed = Test-T0Decision 'C02' 'C12' $true $false $policy
}
foreach ($fixture in $negativeFixtures.GetEnumerator()) { Assert-Security ([bool]$fixture.Value) "Negative fixture failed: $($fixture.Key)" }
foreach ($fixture in $positiveFixtures.GetEnumerator()) { Assert-Security ([bool]$fixture.Value) "Positive fixture failed: $($fixture.Key)" }
Write-Verbose 'Adversarial fixtures completed.'

Assert-Security ($backlog -match '(?ms)- task_id: NX-SEC-001.*?owner_agent: C02.*?status: (in_progress|review|control|done)') 'NX-SEC-001 backlog owner/state is invalid.'
Assert-Security ($scorecard -match '(?m)^\s+active_packets:\s+1\s*$' -and $scorecard -match '(?m)^\s+active_task_id:\s+NX-SEC-001\s*$') 'Scorecard does not preserve WIP=1 for NX-SEC-001.'
Assert-Security ($scorecard -match '(?ms)^spend:.*?mode:\s+default_deny_spend.*?amount:\s+0') 'Scorecard does not preserve zero incremental spend.'

$artifactHashes = [ordered]@{}
foreach ($path in @($paths.Values) + @($scanFiles) + @($typescriptRuntime)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')
    if (-not $artifactHashes.Contains($relative)) { $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
}
Write-Verbose "Artifact hashing completed: $($artifactHashes.Count) paths."
$reviewSubjectManifest = @($artifactHashes.GetEnumerator() | Where-Object { $_.Key -notin @('planning/backlog-p0.yaml','planning/capacity-scorecard.yaml') } | Sort-Object Key | ForEach-Object { [ordered]@{path=[string]$_.Key;sha256=[string]$_.Value} })
$reviewSubjectSha256 = Get-StringSha256 (ConvertTo-CanonicalJson $reviewSubjectManifest)

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-SEC-001'
    run_id = $RunId
    observed_at = $ObservedAt
    executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    assertions = $assertions
    failures = @($failures)
    inventory = [ordered]@{
        critical_assets = @($model.assets | Where-Object { $_.criticality -eq 'CRITICAL' }).Count
        threats = $model.threats.Count
        trust_boundaries = $model.trust_boundaries.Count
        policy_data_classes = $policy.data_rules.Count
        architecture_contexts = $contexts.Count
        t0_control_population = $t0Controls.Count
        repository_files_scanned = $scanFiles.Count
        repository_findings = $scanFindings.Count
    }
    boundary_decisions = $boundaryDecisions
    negative_fixtures = $negativeFixtures
    positive_fixtures = $positiveFixtures
    repository_findings = @($scanFindings)
    review_subject_sha256 = $reviewSubjectSha256
    review_subject_manifest = $reviewSubjectManifest
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    runtime_guard_receipt = [ordered]@{
        source_evidence = 'planning/evidence/NX-CAP-001-validation.json'
        source_evidence_sha256 = (Get-FileHash -LiteralPath $paths.capacity_evidence -Algorithm SHA256).Hash.ToLowerInvariant()
        source_run_id = $capacityEvidence.run_id
        blocked_unallowlisted_egress_actions = [int]$capacityEvidence.blocked_unallowlisted_egress_actions
        blocked_economic_actions = [int]$capacityEvidence.blocked_economic_actions
        credential_name_matches = [int]$capacityEvidence.credential_name_matches
        egress_allowlist_empty = $true
        active_spend_approvals = 0
        execution_mode = 'local_file_only_under_accepted_guard'
    }
    incremental_cost = [ordered]@{amount=[decimal]$policy.incremental_cost_limit.amount;currency=[string]$policy.incremental_cost_limit.currency;basis='default_deny_spend_and_accepted_runtime_guard'}
    artifact_sha256 = $artifactHashes
}
$result | ConvertTo-Json -Depth 8
if ($failures.Count -gt 0) { exit 1 }
