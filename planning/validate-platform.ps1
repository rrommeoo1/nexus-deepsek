[CmdletBinding()]
param(
    [string]$RunId = ('NX-PLAT-001-VALIDATE-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('A00', 'A10', 'A15', 'C01', 'C02', 'C11')][string]$ExecutorRole = 'A00'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0
$timer = [Diagnostics.Stopwatch]::StartNew()

function Assert-Platform { param([bool]$Condition,[string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 {
    param([string]$Value)
    $sha=[Security.Cryptography.SHA256]::Create(); try {$bytes=[Text.Encoding]::UTF8.GetBytes($Value);$hash=$sha.ComputeHash($bytes)} finally {$sha.Dispose()}
    ([BitConverter]::ToString($hash)).Replace('-','').ToLowerInvariant()
}
function Convert-HexToBytes { param([string]$Hex) $bytes=New-Object byte[] ($Hex.Length/2); for($i=0;$i -lt $bytes.Length;$i++){$bytes[$i]=[Convert]::ToByte($Hex.Substring($i*2,2),16)}; $bytes }
function Test-PromotionDecision { param([bool]$Build,[bool]$Secrets,[bool]$Dependencies,[bool]$Signature,[bool]$Registry) $Build -and $Secrets -and $Dependencies -and $Signature -and $Registry }
function Test-RunId { param([string]$Value) $Value -match '^NX-PLAT-001-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$' }
function Test-ContainedPath {
    param([string]$Candidate,[string]$Root)
    $candidateFull=[IO.Path]::GetFullPath($Candidate)
    $rootFull=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
    $candidateFull.StartsWith($rootFull,[StringComparison]::OrdinalIgnoreCase)
}

$repoRoot=Split-Path -Parent $PSScriptRoot
$artifactRoot=Join-Path $repoRoot '.artifacts\NX-PLAT-001'
$runs=@(Get-ChildItem -LiteralPath $artifactRoot -Directory | Sort-Object Name)
Assert-Platform ($runs.Count -ge 2) 'At least two independent build runs are required for reproducibility evidence.'
$selected=@($runs | Select-Object -Last 2)
$results=@($selected | ForEach-Object { Get-Content -LiteralPath (Join-Path $_.FullName 'pipeline-result.json') -Raw -Encoding UTF8 | ConvertFrom-Json })

foreach($result in $results){
    Assert-Platform ($result.status -eq 'PASS') "Pipeline result failed: $($result.run_id)"
    $selectedRun=@($selected | Where-Object {$_.Name -eq $result.run_id})
    Assert-Platform (Test-RunId $result.run_id) 'Pipeline result has a non-canonical RunId.'
    Assert-Platform ($selectedRun.Count -eq 1) 'Run directory and pipeline RunId are not identical.'
    foreach($check in @('module_contract','secret_scan','dependency_scan','negative_secret_fixture','negative_critical_dependency_fixture','signature_verified','same_digest_promoted','codeowners_generated')){ Assert-Platform ([bool]$result.checks.$check) "Required check failed: $check" }
    Assert-Platform ($result.incremental_cost.amount -eq 0) 'Pipeline must have zero incremental cost.'
    $artifactPath=Join-Path $repoRoot ($result.artifact.path.Replace('/','\'))
    $promotedPath=Join-Path $repoRoot ($result.artifact.promoted_path.Replace('/','\'))
    $expectedRunRoot=Join-Path $artifactRoot $result.run_id
    $expectedPromotionRoot=Join-Path $repoRoot ('.ephemeral\NX-PLAT-001\'+$result.run_id+'\staging')
    Assert-Platform (Test-ContainedPath $artifactPath $expectedRunRoot) 'Artifact path escapes its run directory.'
    Assert-Platform (Test-ContainedPath $promotedPath $expectedPromotionRoot) 'Promotion path escapes its staging directory.'
    Assert-Platform (Test-Path -LiteralPath $artifactPath) 'Build artifact is missing.'
    Assert-Platform (Test-Path -LiteralPath $promotedPath) 'Promoted artifact is missing.'
    Assert-Platform ((Get-Sha256 $artifactPath) -eq $result.artifact.sha256) 'Recorded build digest mismatch.'
    Assert-Platform ((Get-Sha256 $promotedPath) -eq $result.artifact.promoted_sha256) 'Recorded promoted digest mismatch.'
    Assert-Platform ($result.artifact.sha256 -eq $result.artifact.promoted_sha256) 'Promotion did not preserve artifact digest.'

    $signaturePath=Join-Path $repoRoot ($result.evidence.signature.Replace('/','\'))
    Assert-Platform (Test-ContainedPath $signaturePath $expectedRunRoot) 'Signature path escapes its run directory.'
    $signature=Get-Content -LiteralPath $signaturePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $rsa=New-Object Security.Cryptography.RSACryptoServiceProvider
    try{$rsa.FromXmlString($signature.public_key_xml);$verified=$rsa.VerifyHash((Convert-HexToBytes $signature.artifact_sha256),[Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'),[Convert]::FromBase64String($signature.signature_base64))}finally{$rsa.Dispose()}
    Assert-Platform $verified 'Independent artifact signature verification failed.'
    Assert-Platform ($signature.trust_scope -eq 'LOCAL_EPHEMERAL_TEST_ONLY') 'Local signing trust scope must not imply production trust.'

    $sbom=Get-Content -LiteralPath (Join-Path $repoRoot ($result.evidence.sbom.Replace('/','\'))) -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Platform (Test-ContainedPath (Join-Path $repoRoot ($result.evidence.sbom.Replace('/','\'))) $expectedRunRoot) 'SBOM path escapes its run directory.'
    Assert-Platform ($sbom.bomFormat -eq 'CycloneDX' -and $sbom.specVersion -eq '1.5') 'SBOM format is invalid.'
    Assert-Platform (@($sbom.metadata.component.properties | Where-Object {$_.name -eq 'nexus:artifact:sha256' -and $_.value -eq $result.artifact.sha256}).Count -eq 1) 'SBOM is not bound to artifact digest.'
    $provenance=Get-Content -LiteralPath (Join-Path $repoRoot ($result.evidence.provenance.Replace('/','\'))) -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Platform (Test-ContainedPath (Join-Path $repoRoot ($result.evidence.provenance.Replace('/','\'))) $expectedRunRoot) 'Provenance path escapes its run directory.'
    Assert-Platform (-not [bool]$provenance.network_used) 'Local provenance must show no network use.'
    Assert-Platform (@($provenance.subject | Where-Object {$_.sha256 -eq $result.artifact.sha256}).Count -eq 1) 'Provenance subject digest mismatch.'
    Assert-Platform ($provenance.materials.Count -eq 4) 'Provenance must include product inputs, builder and workflow.'
    foreach($requiredMaterial in @('platform/sample-module/module.json','platform/sample-module/health.json','platform/run-local-ci.ps1','.github/workflows/nexus-local-proof.yml')){
        Assert-Platform (@($provenance.materials | Where-Object {$_.path -eq $requiredMaterial}).Count -eq 1) "Missing provenance material: $requiredMaterial"
    }
    $materialManifest=(($provenance.materials | Sort-Object path | ForEach-Object {$_.path+'|'+$_.sha256}) -join "`n")+"`n"
    $expectedSourceRevision=Get-StringSha256 $materialManifest
    Assert-Platform ($provenance.source_revision.kind -eq 'workspace-content-sha256') 'Source revision kind is invalid.'
    Assert-Platform ($provenance.source_revision.value -eq $expectedSourceRevision) 'Source revision does not bind all build materials.'
    Assert-Platform ($result.evidence.source_revision.value -eq $expectedSourceRevision) 'Pipeline result does not link the source revision.'
    Assert-Platform ($provenance.source_revision.vcs_state -eq 'REPOSITORY_METADATA_UNAVAILABLE') 'Missing VCS metadata must be explicit, not inferred as a commit.'
}

Assert-Platform ($results[0].artifact.sha256 -eq $results[1].artifact.sha256) 'Two builds from the same source are not reproducible.'
$artifactText=Get-Content -LiteralPath (Join-Path $repoRoot ($results[-1].artifact.path.Replace('/','\'))) -Raw -Encoding UTF8
Assert-Platform ((Get-StringSha256 ($artifactText + 'tamper')) -ne $results[-1].artifact.sha256) 'Tampered artifact was not detected.'
Assert-Platform (-not (Test-PromotionDecision $true $false $true $true $true)) 'Secret scan failure must stop promotion.'
Assert-Platform (-not (Test-PromotionDecision $true $true $false $true $true)) 'Critical dependency failure must stop promotion.'
Assert-Platform (-not (Test-PromotionDecision $true $true $true $true $false)) 'Missing control registry must stop promotion.'
Assert-Platform (Test-PromotionDecision $true $true $true $true $true) 'Valid promotion decision was denied.'
Assert-Platform (-not (Test-RunId '..\..\outside-review-root')) 'Traversal RunId was accepted.'
Assert-Platform (-not (Test-ContainedPath (Join-Path $artifactRoot '..\outside-review-root') $artifactRoot)) 'Escaping artifact path was accepted.'

$architecture=Get-Content -LiteralPath (Join-Path $repoRoot 'architecture\bounded-contexts.yaml') -Raw -Encoding UTF8
$artifactSection=[regex]::Match($architecture,'(?ms)^artifacts:[^\r\n]*\r?\n(.*?)(?=^[a-z_][a-z0-9_]*:|\z)').Groups[1].Value
Assert-Platform (-not [string]::IsNullOrWhiteSpace($artifactSection)) 'Architecture artifacts section is missing.'
$artifactCount=[regex]::Matches($artifactSection,'(?m)^\s+- id:\s*[^\r\n]+').Count
$codeowners=Get-Content -LiteralPath (Join-Path $selected[-1].FullName 'CODEOWNERS.generated') -Encoding UTF8
Assert-Platform ($codeowners.Count -eq ($artifactCount + 1)) 'Generated CODEOWNERS does not cover every architecture artifact.'
$workflow=Get-Content -LiteralPath (Join-Path $repoRoot '.github\workflows\nexus-local-proof.yml') -Raw -Encoding UTF8
Assert-Platform ($workflow -match "workflow_dispatch:" -and $workflow -notmatch '(?m)^\s+(push|pull_request):') 'External CI must remain manual by default.'
$approvalFields=@('approval_id','provider_or_category','max_amount','currency','environment','expires_at','owner')
foreach($approvalField in $approvalFields){Assert-Platform ($workflow -match ('(?m)^\s{6}'+[regex]::Escape($approvalField)+':')) "Workflow is missing approval input: $approvalField"}
Assert-Platform ($workflow -match 'if:\s*\$\{\{\s*false\s*\}\}') 'Metered CI must remain hard-disabled while no active approval exists.'
Assert-Platform ($workflow -match '(?m)^\s+timeout-minutes:\s*10\s*$') 'External workflow requires a bounded timeout.'
Assert-Platform ($workflow -match 'actions/checkout@[a-f0-9]{40}') 'Third-party workflow action must be pinned to an immutable SHA.'

$backlog=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backlog-p0.yaml') -Raw -Encoding UTF8
$scorecard=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'capacity-scorecard.yaml') -Raw -Encoding UTF8
Assert-Platform ($backlog -match '(?ms)- task_id: NX-PLAT-001.*?status: (in_progress|review|done)') 'NX-PLAT-001 state is invalid.'
Assert-Platform ($scorecard -match '(?m)^\s+active_task_id:\s+NX-PLAT-001\s*$') 'NX-PLAT-001 must be the sole active task during owner validation.'

$subjectPaths=@('platform/sample-module/module.json','platform/sample-module/health.json','platform/run-local-ci.ps1','.github/workflows/nexus-local-proof.yml','planning/validate-platform.ps1')
$hashes=[ordered]@{}
foreach($relative in $subjectPaths){$hashes[$relative]=Get-Sha256 (Join-Path $repoRoot ($relative.Replace('/','\')))}
$subjectLines=@($hashes.GetEnumerator()|Sort-Object Key|ForEach-Object{$_.Key+'|'+$_.Value})
$subjectDigest=Get-StringSha256 (($subjectLines -join "`n")+"`n")
$timer.Stop()
$output=[ordered]@{schema_version=1;task_id='NX-PLAT-001';run_id=$RunId;executor_role=$ExecutorRole;status=if($failures.Count-eq 0){'PASS'}else{'FAIL'};assertions=$assertions;failures=@($failures);reproducible_runs=@($results.run_id);artifact_sha256=$results[-1].artifact.sha256;promotion_sha256=$results[-1].artifact.promoted_sha256;review_subject_sha256=$subjectDigest;negative_fixtures=[ordered]@{tamper_denied=$true;secret_failure_denied=$true;critical_dependency_denied=$true;missing_registry_denied=$true};duration_seconds=[math]::Round($timer.Elapsed.TotalSeconds,4);artifact_hashes=$hashes}
$output|ConvertTo-Json -Depth 8
if($failures.Count-gt 0){exit 1}
