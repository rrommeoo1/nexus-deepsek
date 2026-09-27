[CmdletBinding()]
param(
    [string]$RunId = ('NX-CONTRACT-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)),
    [ValidateSet('A00','A13','A12','A20','A30','C01','C02','C03','C04')][string]$ExecutorRole = 'A00'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
$timer = [Diagnostics.Stopwatch]::StartNew()

function Assert-Contract { param([bool]$Condition,[string]$Message) $script:assertions++; if(-not $Condition){$script:failures.Add($Message)} }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 { param([string]$Value) $sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))}finally{$sha.Dispose()};([BitConverter]::ToString($hash)).Replace('-','').ToLowerInvariant() }
function Copy-Json { param([object]$Value) $Value | ConvertTo-Json -Depth 40 -Compress | ConvertFrom-Json }
function Get-Major { param([string]$Version) if($Version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'){return -1}; [int]$Matches[1] }
function Get-Operations {
    param([object]$Api)
    $operations=@()
    foreach($path in $Api.paths.PSObject.Properties){foreach($method in $path.Value.PSObject.Properties){if($method.Name -in @('get','post','put','patch','delete') -and $null -ne $method.Value.operationId){$operations += [string]$method.Value.operationId}}}
    @($operations)
}
function Get-SurfaceHash {
    param([ValidateSet('openapi','event','abi')][string]$Artifact,[object]$Value)
    $copy=Copy-Json $Value
    switch($Artifact){
        'openapi' {$copy.info.version='__SEMVER__';$copy.info.description='__DOCUMENTATION__'}
        'event' {$copy.'x-contract-version'='__SEMVER__'}
        'abi' {$copy.contractVersion='__SEMVER__'}
    }
    Get-StringSha256 ($copy|ConvertTo-Json -Depth 60 -Compress)
}
function Get-BreakingChanges {
    param([object]$Api,[object]$Event,[object]$Abi,[object]$Baseline)
    $breaks=[Collections.Generic.List[string]]::new()
    $operations=Get-Operations $Api
    foreach($required in $Baseline.openapi.operations){if($required -notin $operations){$breaks.Add("openapi.operation.removed:$required")}}
    foreach($required in $Baseline.openapi.required_create_fields){if($required -notin @($Api.components.schemas.CreateActionRequest.required)){$breaks.Add("openapi.required.removed:$required")}}
    foreach($required in $Baseline.event.required_envelope_fields){if($required -notin @($Event.required)){$breaks.Add("event.envelope.required.removed:$required")}}
    foreach($required in $Baseline.event.required_data_fields){if($required -notin @($Event.properties.data.required)){$breaks.Add("event.data.required.removed:$required")}}
    foreach($required in $Baseline.abi.endpoints){if($required -notin @($Abi.endpoints.name)){$breaks.Add("abi.endpoint.removed:$required")}}
    foreach($required in $Baseline.abi.events){if($required -notin @($Abi.events.identifier)){$breaks.Add("abi.event.removed:$required")}}
    if((Get-SurfaceHash openapi $Api) -ne $Baseline.openapi.surface_sha256){$breaks.Add('openapi.surface.changed')}
    if((Get-SurfaceHash event $Event) -ne $Baseline.event.surface_sha256){$breaks.Add('event.surface.changed')}
    if((Get-SurfaceHash abi $Abi) -ne $Baseline.abi.surface_sha256){$breaks.Add('abi.surface.changed')}
    @($breaks)
}
function Test-MigrationWindow {
    param([object]$Window,[string]$Artifact,[string]$FromVersion,[string]$ToVersion)
    if($null -eq $Window){return $false}
    foreach($field in @('artifact','from_version','to_version','starts_at','ends_at','sunset_at','owner','reviewer','compatibility_report_sha256','consumer_test_run_id','rollback_plan')){if($null -eq $Window.PSObject.Properties[$field] -or [string]::IsNullOrWhiteSpace([string]$Window.$field)){return $false}}
    if($Window.artifact -ne $Artifact -or $Window.from_version -ne $FromVersion -or $Window.to_version -ne $ToVersion){return $false}
    try{$start=[DateTimeOffset]::Parse($Window.starts_at);$end=[DateTimeOffset]::Parse($Window.ends_at);$sunset=[DateTimeOffset]::Parse($Window.sunset_at)}catch{return $false}
    $Window.owner -ne $Window.reviewer -and $Window.compatibility_report_sha256 -match '^[a-f0-9]{64}$' -and $Window.consumer_test_run_id -match '^NX-[A-Z0-9-]+$' -and $start -lt $end -and $end -le $sunset
}
function Test-VersionedBreakingChange {
    param([string]$Artifact,[string]$BaselineVersion,[string]$CurrentVersion,[object[]]$Breaks,[object[]]$Windows)
    if($Breaks.Count -eq 0){return $true}
    if((Get-Major $CurrentVersion) -le (Get-Major $BaselineVersion)){return $false}
    @($Windows | Where-Object { Test-MigrationWindow $_ $Artifact $BaselineVersion $CurrentVersion }).Count -eq 1
}
function Test-Balanced {
    param([string]$Text,[char]$Open,[char]$Close)
    $depth=0
    foreach($char in $Text.ToCharArray()){if($char -eq $Open){$depth++};if($char -eq $Close){$depth--;if($depth -lt 0){return $false}}}
    $depth -eq 0
}
function Get-ObjectPolicyFailures {
    param([object]$Node,[string]$Path='$')
    $issues=[Collections.Generic.List[string]]::new()
    if($null -eq $Node){return @()}
    if($Node -is [Collections.IEnumerable] -and $Node -isnot [string] -and $Node -isnot [pscustomobject]){
        $index=0;foreach($item in $Node){foreach($issue in @(Get-ObjectPolicyFailures $item ($Path+'['+$index+']'))){$issues.Add($issue)};$index++};return @($issues)
    }
    if($Node -is [pscustomobject]){
        $typeProperty=$Node.PSObject.Properties['type']
        $isObjectApplicator=($null -ne $typeProperty -and $typeProperty.Value -eq 'object') -or $null -ne $Node.PSObject.Properties['properties'] -or $null -ne $Node.PSObject.Properties['additionalProperties']
        if($isObjectApplicator){
            $policyProperty=$Node.PSObject.Properties['x-data-policy']
            if($null -eq $policyProperty){$issues.Add($Path+':missing_policy')}
            else{foreach($required in @('owner','purpose','legal_basis','retention','default_classification')){if($null -eq $policyProperty.Value.PSObject.Properties[$required] -or [string]::IsNullOrWhiteSpace([string]$policyProperty.Value.$required)){$issues.Add($Path+':missing_'+$required)}}}
            $additional=$Node.PSObject.Properties['additionalProperties']
            if($null -eq $additional -or $additional.Value -ne $false){$issues.Add($Path+':additional_properties_not_denied')}
        }
        foreach($property in $Node.PSObject.Properties){if($property.Name -ne 'x-data-policy'){foreach($issue in @(Get-ObjectPolicyFailures $property.Value ($Path+'.'+$property.Name))){$issues.Add($issue)}}}
    }
    @($issues)
}
function Get-IncludedNodeRuntime {
    $localData=[Environment]::GetFolderPath('LocalApplicationData')
    $roots=@(
        (Join-Path $localData 'OpenAI\Codex\bin'),
        (Join-Path $localData 'OpenAI\Codex\runtimes\cua_node'),
        (Join-Path $localData 'ms-playwright-go')
    )
    foreach($root in $roots){
        if(-not (Test-Path -LiteralPath $root)){continue}
        $candidate=Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue|Sort-Object FullName|Select-Object -First 1
        if($null -ne $candidate){return $candidate.FullName}
    }
    return $null
}
function Test-LocalJsonReference {
    param([object]$Root,[string]$Reference)
    if($Reference -notmatch '^#/'){return $false}
    $current=$Root
    foreach($rawPart in $Reference.Substring(2).Split('/')){
        $part=$rawPart.Replace('~1','/').Replace('~0','~')
        if($null -eq $current -or $current -isnot [pscustomobject] -or $null -eq $current.PSObject.Properties[$part]){return $false}
        $current=$current.PSObject.Properties[$part].Value
    }
    return $true
}

$repoRoot=Split-Path -Parent $PSScriptRoot
$contractRoot=Join-Path $repoRoot 'packages\contracts'
$paths=[ordered]@{
    openapi='packages/contracts/api/openapi.v1.json'
    event='packages/contracts/events/action.chain.executed.v1.schema.json'
    abi='packages/contracts/abi/nexus-actions.abi.json'
    catalog='packages/contracts/data/catalog.v1.json'
    prisma='packages/contracts/data/action-model.prisma'
    baseline='packages/contracts/compatibility-baseline.v1.json'
    generator='packages/contracts/generate-bindings.ps1'
    generated='packages/contracts/generated/index.ts'
    consumer='packages/contracts/generated/consumer-fixture.ts'
    package='packages/contracts/package.json'
    package_lock='packages/contracts/package-lock.json'
    tsconfig='packages/contracts/tsconfig.generated.json'
    validator='planning/validate-contracts.ps1'
}
foreach($relative in $paths.Values){Assert-Contract (Test-Path -LiteralPath (Join-Path $repoRoot ($relative.Replace('/','\')))) "Missing contract artifact: $relative"}

$api=Get-Content -LiteralPath (Join-Path $contractRoot 'api\openapi.v1.json') -Raw -Encoding UTF8|ConvertFrom-Json
$event=Get-Content -LiteralPath (Join-Path $contractRoot 'events\action.chain.executed.v1.schema.json') -Raw -Encoding UTF8|ConvertFrom-Json
$abi=Get-Content -LiteralPath (Join-Path $contractRoot 'abi\nexus-actions.abi.json') -Raw -Encoding UTF8|ConvertFrom-Json
$catalog=Get-Content -LiteralPath (Join-Path $contractRoot 'data\catalog.v1.json') -Raw -Encoding UTF8|ConvertFrom-Json
$baseline=Get-Content -LiteralPath (Join-Path $contractRoot 'compatibility-baseline.v1.json') -Raw -Encoding UTF8|ConvertFrom-Json
$prisma=Get-Content -LiteralPath (Join-Path $contractRoot 'data\action-model.prisma') -Raw -Encoding UTF8
$package=Get-Content -LiteralPath (Join-Path $contractRoot 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
$packageLockRaw=Get-Content -LiteralPath (Join-Path $contractRoot 'package-lock.json') -Raw -Encoding UTF8

Assert-Contract ($api.openapi -eq '3.1.0') 'OpenAPI must be 3.1.0.'
Assert-Contract ((Get-Major $api.info.version) -ge 1) 'OpenAPI version is not semantic.'
Assert-Contract (@(Get-Operations $api).Count -eq 2) 'Action slice must expose exactly two operations.'
Assert-Contract ($api.paths.'/v1/actions'.post.responses.PSObject.Properties.Name -contains '202') 'Mutation must return HTTP 202 relay acceptance.'
Assert-Contract ([bool]$api.paths.'/v1/actions'.post.'x-idempotent') 'Mutation must declare idempotency.'
$parameterRefs=@($api.paths.'/v1/actions'.post.parameters.'$ref')
foreach($header in @('NexusProfile','IdempotencyKey','ClientVersion','RequestId')){Assert-Contract ($parameterRefs -contains "#/components/parameters/$header") "Missing mandatory action header: $header"}
foreach($field in @('actionType','objectCommitment','payloadHash','visibilityClass','actionNonce','expiresAt')){Assert-Contract ($field -in @($api.components.schemas.CreateActionRequest.required)) "CreateActionRequest misses required field: $field"}
Assert-Contract ($api.components.schemas.ActionIntent.properties.state.'$ref' -eq '#/components/schemas/ActionState') 'ActionIntent state is not bound to canonical state enum.'
Assert-Contract ('ORDERED_FINAL' -in @($api.components.schemas.ActionState.enum) -and 'EXECUTION_PENDING' -in @($api.components.schemas.ActionState.enum) -and 'EXECUTED_SUCCESS' -in @($api.components.schemas.ActionState.enum)) 'Final ordering, pending and successful execution states must remain distinct.'
$apiRefs=@([regex]::Matches(($api|ConvertTo-Json -Depth 60 -Compress),'"\$ref":"([^"]+)"')|ForEach-Object{$_.Groups[1].Value})
foreach($reference in $apiRefs){Assert-Contract (Test-LocalJsonReference $api $reference) "OpenAPI reference is external or unresolved: $reference"}
$eventRefs=@([regex]::Matches(($event|ConvertTo-Json -Depth 60 -Compress),'"\$ref":"([^"]+)"')|ForEach-Object{$_.Groups[1].Value})
foreach($reference in $eventRefs){Assert-Contract (Test-LocalJsonReference $event $reference) "Event reference is external or unresolved: $reference"}

Assert-Contract ($event.'x-contract-version' -eq '1.0.0') 'Event schema version mismatch.'
Assert-Contract ($event.properties.eventType.const -eq 'chain.action.executed.v1') 'Event type must match architecture publisher contract.'
Assert-Contract ($event.properties.producer.const -eq 'chain_integration') 'Event producer ownership mismatch.'
Assert-Contract ($event.properties.data.properties.status.const -eq 'EXECUTED_SUCCESS') 'Executed event must not represent ordered-only state.'
Assert-Contract ($event.additionalProperties -eq $false -and $event.properties.data.additionalProperties -eq $false) 'Event envelope and data must fail closed on unknown fields.'
foreach($lineageField in @('originalTxHash','sourceTxHash','sourceKind','eventIndex','blockHash','hyperblockNonce','hyperblockHash','canonicality','finality')){Assert-Contract ($lineageField -in @($event.properties.data.required)) "Finalized event lineage is incomplete: $lineageField"}
Assert-Contract ($event.properties.data.properties.canonicality.const -eq 'FINALIZED_CANONICAL' -and $event.properties.data.properties.finality.const -eq 'HYPERBLOCK_FINAL') 'Only hyperblock-final canonical events may produce terminal outcomes.'
Assert-Contract ('HYPERBLOCK_FINAL' -in @($event.'x-reducer-policy'.accepted_observations) -and 'FINALIZED_CANONICAL' -in @($event.'x-reducer-policy'.accepted_observations)) 'Reducer finality policy is incomplete.'
Assert-Contract ((@($event.'x-reducer-policy'.reconciliation_key) -join '|') -eq 'network|originalTxHash|sourceTxHash|eventIndex' -and $event.'x-reducer-policy'.prefinalized_result -eq 'IGNORE') 'Reducer reconciliation/prefinalized policy mismatch.'

Assert-Contract ($abi.name -eq 'NexusActions' -and $abi.contractVersion -eq '1.0.0') 'ABI identity/version mismatch.'
foreach($endpoint in @('recordAction','recordPrivateAction')){Assert-Contract ($endpoint -in @($abi.endpoints.name)) "ABI misses endpoint: $endpoint"}
Assert-Contract ('ActionRecorded' -in @($abi.events.identifier)) 'ABI misses ActionRecorded event.'
Assert-Contract ([bool]$abi.'x-invariants'.oneActionPerCall -and @($abi.'x-invariants'.batchEndpoints).Count -eq 0) 'ABI violates one-action-per-call.'
Assert-Contract (-not [bool]$abi.'x-invariants'.privateTargetsInClear -and -not [bool]$abi.'x-invariants'.childActorAllowed) 'ABI privacy/Kids invariant failed.'
Assert-Contract (@($abi.endpoints | Where-Object {@($_.payableInTokens).Count -ne 0}).Count -eq 0) 'Action ledger endpoints must not accept payment.'

$catalogIds=@($catalog.fields.catalog_id)
Assert-Contract ($catalogIds.Count -eq @($catalogIds|Sort-Object -Unique).Count) 'Data catalog IDs are not unique.'
foreach($field in $catalog.fields){foreach($required in @('catalog_id','owner','purpose','legal_basis','retention','classification','protection')){Assert-Contract (-not [string]::IsNullOrWhiteSpace([string]$field.$required)) "Catalog metadata missing: $($field.catalog_id).$required"}}
$contractJson=(($api|ConvertTo-Json -Depth 40 -Compress)+($event|ConvertTo-Json -Depth 40 -Compress))
$catalogRefs=@([regex]::Matches($contractJson,'"x-catalog-id":"([^"]+)"')|ForEach-Object{$_.Groups[1].Value}|Sort-Object -Unique)
foreach($catalogRef in $catalogRefs){Assert-Contract ($catalogRef -in $catalogIds) "Uncatalogued sensitive field: $catalogRef"}
$prismaCatalogRefs=@([regex]::Matches($prisma,'(?m)@catalog-id\s+([A-Za-z0-9._-]+)')|ForEach-Object{$_.Groups[1].Value}|Sort-Object -Unique)
foreach($catalogRef in $prismaCatalogRefs){Assert-Contract ($catalogRef -in $catalogIds) "Uncatalogued Prisma field: $catalogRef"}
$architecture=Get-Content -LiteralPath (Join-Path $repoRoot 'architecture\bounded-contexts.yaml') -Raw -Encoding UTF8
$chainAccessMatch=[regex]::Match($architecture,'(?ms)^\s+- id:\s+chain_integration\s*$.*?^\s+data_access:\s*\[([^\]]+)\]')
$eventForbiddenMatch=[regex]::Match($architecture,'(?m)^\s+forbidden_payload_data_classes:\s*\[([^\]]+)\]')
Assert-Contract ($chainAccessMatch.Success -and $eventForbiddenMatch.Success) 'Architecture data/event policy could not be resolved.'
$chainAllowed=@($chainAccessMatch.Groups[1].Value.Split(',')|ForEach-Object{$_.Trim()})
$eventForbidden=@($eventForbiddenMatch.Groups[1].Value.Split(',')|ForEach-Object{$_.Trim()})
$catalogById=@{};foreach($field in $catalog.fields){$catalogById[[string]$field.catalog_id]=$field}
foreach($catalogRef in @($catalogRefs|Where-Object{$_ -like 'event.*'})+$prismaCatalogRefs){
    if(-not $catalogById.ContainsKey($catalogRef)){continue}
    $classification=[string]$catalogById[$catalogRef].classification
    Assert-Contract ($classification -in $chainAllowed) "chain_integration catalog class is unauthorized: $catalogRef=$classification"
    Assert-Contract ($classification -notin $eventForbidden) "Forbidden event data class reached chain contract: $catalogRef=$classification"
}
$chainOwnedCatalog=@($catalog.fields|Where-Object{$_.owner -eq 'chain_integration'})
Assert-Contract ($chainOwnedCatalog.Count -ge 1) 'No chain_integration catalog population was found.'
foreach($field in $chainOwnedCatalog){
    Assert-Contract ($field.classification -in $chainAllowed) "Owner-based chain catalog class is unauthorized: $($field.catalog_id)=$($field.classification)"
    Assert-Contract ($field.classification -notin $eventForbidden) "Owner-based forbidden class reached chain catalog: $($field.catalog_id)=$($field.classification)"
}
$chainCatalogFixture=Copy-Json $catalog
$fixtureChainField=@($chainCatalogFixture.fields|Where-Object{$_.owner -eq 'chain_integration'})[0]
$fixtureChainField.classification='ACCOUNT_AUTHORIZED_PROJECTION'
Assert-Contract (-not ($fixtureChainField.classification -in $chainAllowed -and $fixtureChainField.classification -notin $eventForbidden)) 'Owner-based catalog classification fixture bypassed policy.'
$eventDefaultClass=[string]$event.properties.data.'x-data-policy'.default_classification
Assert-Contract ($eventDefaultClass -in $chainAllowed -and $eventDefaultClass -notin $eventForbidden) 'Event default classification violates architecture policy.'
$classificationFixture='ACCOUNT_AUTHORIZED_PROJECTION'
Assert-Contract (-not ($classificationFixture -in $chainAllowed -and $classificationFixture -notin $eventForbidden)) 'Forbidden-class alias fixture bypassed context policy.'
$objectPolicyFailures=@(Get-ObjectPolicyFailures $api '$.openapi')+@(Get-ObjectPolicyFailures $event '$.event')
Assert-Contract ($objectPolicyFailures.Count -eq 0) ('Object data policy failures: '+($objectPolicyFailures -join ','))
$policyFixture=Copy-Json $api
$policyFixture.components.schemas|Add-Member -NotePropertyName UnclassifiedFixture -NotePropertyValue ([pscustomobject]@{additionalProperties=$false;properties=[pscustomobject]@{subjectAccount=[pscustomobject]@{type='string'}}})
Assert-Contract (@(Get-ObjectPolicyFailures $policyFixture '$.fixture').Count -gt 0) 'Unclassified object schema fixture was accepted.'

foreach($model in @('ActionIntent','OutboxEvent','ActionChainEvent')){Assert-Contract ($prisma -match ('(?m)^model\s+'+$model+'\s*\{')) "Missing Prisma model: $model"}
Assert-Contract ($prisma -match '@@unique\(\[aggregateId, aggregateVersion, eventType\]\)') 'Outbox idempotency constraint is missing.'
Assert-Contract ($prisma -match '@@id\(\[network, originalTxHash, sourceTxHash, eventIndex\]\)') 'Chain event idempotency key is missing.'
Assert-Contract ($prisma -match '@@schema\("chain_integration"\)') 'Chain integration schema ownership is missing.'
Assert-Contract ($prisma -notmatch 'actorProfileId|actor_profile_id|ACCOUNT_AUTHORIZED_PROJECTION') 'chain_integration persists a forbidden profile projection.'
$privacyPayload=($api|ConvertTo-Json -Depth 40 -Compress)+($event|ConvertTo-Json -Depth 40 -Compress)+($abi|ConvertTo-Json -Depth 40 -Compress)+$prisma
foreach($forbidden in @('wallet_address','walletAddress','emailAddress','phoneNumber','latitude','longitude','gender','orientation','birthDate','messagePlaintext','childId')){Assert-Contract ($privacyPayload -notmatch [regex]::Escape($forbidden)) "Forbidden private payload field detected: $forbidden"}
Assert-Contract (($event|ConvertTo-Json -Depth 40 -Compress) -notmatch 'actorProfileId|ACCOUNT_AUTHORIZED_PROJECTION') 'Chain event exposes an authorized profile projection.'

$currentBreaks=@(Get-BreakingChanges $api $event $abi $baseline)
Assert-Contract ($currentBreaks.Count -eq 0) 'Current contracts drift from their compatibility baseline.'
$apiBroken=Copy-Json $api;$apiBroken.components.schemas.CreateActionRequest.required=@($apiBroken.components.schemas.CreateActionRequest.required|Where-Object{$_ -ne 'payloadHash'})
$apiBreaks=@(Get-BreakingChanges $apiBroken $event $abi $baseline)
Assert-Contract (-not (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiBroken.info.version $apiBreaks @())) 'Breaking OpenAPI change passed without version/migration window.'
$eventBroken=Copy-Json $event;$eventBroken.properties.data.required=@($eventBroken.properties.data.required|Where-Object{$_ -ne 'eventIndex'})
$eventBreaks=@(Get-BreakingChanges $api $eventBroken $abi $baseline)
Assert-Contract (-not (Test-VersionedBreakingChange 'event' $baseline.event.version $eventBroken.'x-contract-version' $eventBreaks @())) 'Breaking event change passed without version/migration window.'
$abiBroken=Copy-Json $abi;$abiBroken.endpoints=@($abiBroken.endpoints|Where-Object{$_.name -ne 'recordPrivateAction'})
$abiBreaks=@(Get-BreakingChanges $api $event $abiBroken $baseline)
Assert-Contract (-not (Test-VersionedBreakingChange 'abi' $baseline.abi.version $abiBroken.contractVersion $abiBreaks @())) 'Breaking ABI change passed without version/migration window.'
$apiBroken.info.version='2.0.0'
$validWindow=[pscustomobject]@{artifact='openapi';from_version='1.0.0';to_version='2.0.0';starts_at='2026-08-03T00:00:00Z';ends_at='2026-09-03T00:00:00Z';sunset_at='2026-10-03T00:00:00Z';owner='A13';reviewer='A20';compatibility_report_sha256=('a'*64);consumer_test_run_id='NX-CONTRACT-CONSUMER-001';rollback_plan='retain_v1_and_route_consumers_back'}
Assert-Contract (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiBroken.info.version $apiBreaks @($validWindow)) 'Versioned breaking change with migration window was denied.'
$invalidWindow=Copy-Json $validWindow;$invalidWindow.compatibility_report_sha256='missing'
Assert-Contract (-not (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiBroken.info.version $apiBreaks @($invalidWindow))) 'Migration window without compatibility evidence was accepted.'
$apiNewRequired=Copy-Json $api;$apiNewRequired.components.schemas.CreateActionRequest.required+=@('newRequiredField')
Assert-Contract (-not (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiNewRequired.info.version @(Get-BreakingChanges $apiNewRequired $event $abi $baseline) @())) 'New required OpenAPI field bypassed full-surface gate.'
$apiEnumChanged=Copy-Json $api;$apiEnumChanged.components.schemas.ActionType.enum=@('PRIVATE_ACTION')
Assert-Contract (-not (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiEnumChanged.info.version @(Get-BreakingChanges $apiEnumChanged $event $abi $baseline) @())) 'OpenAPI enum narrowing bypassed full-surface gate.'
$apiSecurityChanged=Copy-Json $api;$apiSecurityChanged.paths.'/v1/actions'.post.security=@()
Assert-Contract (-not (Test-VersionedBreakingChange 'openapi' $baseline.openapi.version $apiSecurityChanged.info.version @(Get-BreakingChanges $apiSecurityChanged $event $abi $baseline) @())) 'OpenAPI security change bypassed full-surface gate.'
$abiSignatureChanged=Copy-Json $abi;$abiSignatureChanged.endpoints[0].inputs=@($abiSignatureChanged.endpoints[0].inputs[1],$abiSignatureChanged.endpoints[0].inputs[0])
Assert-Contract (-not (Test-VersionedBreakingChange 'abi' $baseline.abi.version $abiSignatureChanged.contractVersion @(Get-BreakingChanges $api $event $abiSignatureChanged $baseline) @())) 'ABI input signature/order change bypassed full-surface gate.'
$abiPayableChanged=Copy-Json $abi;$abiPayableChanged.endpoints[0].payableInTokens=@('EGLD')
Assert-Contract (-not (Test-VersionedBreakingChange 'abi' $baseline.abi.version $abiPayableChanged.contractVersion @(Get-BreakingChanges $api $event $abiPayableChanged $baseline) @())) 'ABI payability change bypassed full-surface gate.'
$eventSignatureChanged=Copy-Json $event;$eventSignatureChanged.properties.data.properties.status.const='ORDERED_FINAL'
Assert-Contract (-not (Test-VersionedBreakingChange 'event' $baseline.event.version $eventSignatureChanged.'x-contract-version' @(Get-BreakingChanges $api $eventSignatureChanged $abi $baseline) @())) 'Event terminal signature change bypassed full-surface gate.'

$generatedPath=Join-Path $contractRoot 'generated\index.ts'
$consumerPath=Join-Path $contractRoot 'generated\consumer-fixture.ts'
$tempRoot=Join-Path ([IO.Path]::GetTempPath()) ('Nexus\NX-CONTRACT-001\'+$RunId)
$tempOne=Join-Path $tempRoot 'generated-one';$tempTwo=Join-Path $tempRoot 'generated-two'
& (Join-Path $contractRoot 'generate-bindings.ps1') -OutputDirectory $tempOne | Out-Null
& (Join-Path $contractRoot 'generate-bindings.ps1') -OutputDirectory $tempTwo | Out-Null
$generatedHashOne=Get-Sha256 (Join-Path $tempOne 'index.ts');$consumerHashOne=Get-Sha256 (Join-Path $tempOne 'consumer-fixture.ts')
$generatedHashTwo=Get-Sha256 (Join-Path $tempTwo 'index.ts');$consumerHashTwo=Get-Sha256 (Join-Path $tempTwo 'consumer-fixture.ts')
Assert-Contract ($generatedHashOne -eq $generatedHashTwo -and $consumerHashOne -eq $consumerHashTwo) 'Bindings generation is not deterministic.'
Assert-Contract ((Get-Sha256 $generatedPath) -eq $generatedHashTwo -and (Get-Sha256 $consumerPath) -eq $consumerHashTwo) 'Checked-in bindings drift from side-effect-free generated output.'
$generated=Get-Content -LiteralPath $generatedPath -Raw -Encoding UTF8
$consumer=Get-Content -LiteralPath $consumerPath -Raw -Encoding UTF8
Assert-Contract (Test-Balanced $generated '{' '}') 'Generated TypeScript braces are not balanced.'
Assert-Contract (Test-Balanced $generated '(' ')') 'Generated TypeScript parentheses are not balanced.'
Assert-Contract ($generated -notmatch '\bany\b') 'Generated TypeScript contains any.'
$exports=@([regex]::Matches($generated,'(?m)^export\s+(?:type|interface|const)\s+([A-Za-z_][A-Za-z0-9_]*)')|ForEach-Object{$_.Groups[1].Value})
$importMatch=[regex]::Match($consumer,"import type \{([^}]+)\} from './index';")
Assert-Contract $importMatch.Success 'Consumer fixture import is malformed.'
$imports=@($importMatch.Groups[1].Value.Split(',')|ForEach-Object{$_.Trim()})
foreach($import in $imports){Assert-Contract ($import -in $exports) "Consumer imports missing generated symbol: $import"}
foreach($requiredExport in @('CreateActionRequest','ActionIntent','ChainActionExecutedV1','NexusActionsClient','CONTRACT_VERSIONS')){Assert-Contract ($requiredExport -in $exports) "Generated binding export missing: $requiredExport"}
$nodePath=Get-IncludedNodeRuntime
Assert-Contract ($null -ne $nodePath) 'No already-included local Node runtime is available for TypeScript syntax compilation.'
$nodeVersion=$null;$indexCompileExit=-1;$consumerCompileExit=-1
if($null -ne $nodePath){
    $nodeVersion=& $nodePath --version
    & $nodePath --experimental-strip-types --check $generatedPath | Out-Null;$indexCompileExit=$LASTEXITCODE
    & $nodePath --experimental-strip-types --check $consumerPath | Out-Null;$consumerCompileExit=$LASTEXITCODE
}
Assert-Contract ($nodeVersion -match '^v(2[4-9]|[3-9][0-9])\.') 'Included Node runtime does not support type stripping.'
Assert-Contract ($indexCompileExit -eq 0) 'Generated TypeScript failed local Node syntax compilation.'
Assert-Contract ($consumerCompileExit -eq 0) 'Consumer fixture failed local Node syntax compilation.'
$tscPath=Join-Path $contractRoot 'node_modules\typescript\bin\tsc'
Assert-Contract (Test-Path -LiteralPath $tscPath) 'Pinned local TypeScript compiler is missing; run npm ci with the locked package.'
$tscVersion=$null;$tscExit=-1
if($null -ne $nodePath -and (Test-Path -LiteralPath $tscPath)){
    $tscVersion=& $nodePath $tscPath --version
    & $nodePath $tscPath --project (Join-Path $contractRoot 'tsconfig.generated.json') --noEmit | Out-Null;$tscExit=$LASTEXITCODE
}
Assert-Contract ($package.devDependencies.typescript -eq '5.9.3' -and $packageLockRaw -match '"node_modules/typescript"\s*:\s*\{\s*"version"\s*:\s*"5\.9\.3"') 'TypeScript compiler is not exactly locked to 5.9.3.'
Assert-Contract ($packageLockRaw -match '"integrity"\s*:\s*"sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw=="') 'TypeScript package integrity lock mismatch.'
Assert-Contract ($tscVersion -eq 'Version 5.9.3' -and $tscExit -eq 0) 'tsc --noEmit semantic compilation failed.'

$backlog=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backlog-p0.yaml') -Raw -Encoding UTF8
$scorecard=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'capacity-scorecard.yaml') -Raw -Encoding UTF8
Assert-Contract ($backlog -match '(?ms)- task_id: NX-CONTRACT-001.*?status: (in_progress|review|done)') 'NX-CONTRACT-001 backlog state is invalid.'
Assert-Contract ($scorecard -match '(?m)^\s+active_task_id:\s+NX-CONTRACT-001\s*$') 'NX-CONTRACT-001 must be the sole active task.'

$artifactHashes=[ordered]@{}
foreach($relative in $paths.Values){$artifactHashes[$relative]=Get-Sha256 (Join-Path $repoRoot ($relative.Replace('/','\')))}
$subjectLines=@($artifactHashes.GetEnumerator()|Sort-Object Key|ForEach-Object{$_.Key+'|'+$_.Value})
$subjectDigest=Get-StringSha256 (($subjectLines -join "`n")+"`n")
$timer.Stop()
$output=[ordered]@{
    schema_version=1;task_id='NX-CONTRACT-001';run_id=$RunId;executor_role=$ExecutorRole
    status=if($failures.Count-eq 0){'PASS'}else{'FAIL'};assertions=$assertions;failures=@($failures)
    versions=[ordered]@{openapi=$api.info.version;event=$event.'x-contract-version';abi=$abi.contractVersion;catalog=$catalog.catalog_version}
    compatibility=[ordered]@{current_breaks=$currentBreaks.Count;openapi_unversioned_denied=$true;event_unversioned_denied=$true;abi_unversioned_denied=$true;versioned_migration_allowed=$true}
    bindings=[ordered]@{compiler_mode='TSC_5_9_3_NO_EMIT_PLUS_SIDE_EFFECT_FREE_DIFF';node_version=$nodeVersion;tsc_version=$tscVersion;generated_sha256=$generatedHashTwo;consumer_sha256=$consumerHashTwo;resolved_imports=$imports.Count;syntax_exit_codes=@($indexCompileExit,$consumerCompileExit);tsc_exit_code=$tscExit}
    catalog_entries=$catalog.fields.Count;review_subject_sha256=$subjectDigest;duration_seconds=[math]::Round($timer.Elapsed.TotalSeconds,4);artifact_hashes=$artifactHashes
}
$output|ConvertTo-Json -Depth 10
if($failures.Count-gt 0){exit 1}
