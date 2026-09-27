[CmdletBinding()]
param(
    [string]$RunId = ('NX-PLAT-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('A00', 'A10', 'A15', 'C01', 'C02', 'C11')][string]$ExecutorRole = 'A10'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$moduleDir = Join-Path $PSScriptRoot 'sample-module'
$artifactRoot = Join-Path $repoRoot '.artifacts\NX-PLAT-001'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral\NX-PLAT-001'

if ($RunId -notmatch '^NX-PLAT-001-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$') { throw 'RunId violates the NX-PLAT-001 canonical format.' }

function Get-ContainedChildPath {
    param([string]$Root, [string]$Child)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $candidate = [IO.Path]::GetFullPath((Join-Path $Root $Child))
    if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes its approved root: $Child" }
    return $candidate
}

$runDir = Get-ContainedChildPath $artifactRoot $RunId
$ephemeralDir = Get-ContainedChildPath $ephemeralRoot (Join-Path $RunId 'staging')

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-StringSha256 {
    param([string]$Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value)) } finally { $sha.Dispose() }
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

function Convert-HexToBytes {
    param([string]$Hex)
    $bytes = New-Object byte[] ($Hex.Length / 2)
    for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($Hex.Substring($i * 2, 2), 16) }
    return $bytes
}

function Test-SecretPolicy {
    param([string]$Text)
    $patterns = @(
        '(?i)(api[_-]?key|secret|password)\s*[:=]\s*["''][A-Za-z0-9_\-]{12,}',
        '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
        '(?i)bearer\s+[A-Za-z0-9._\-]{20,}'
    )
    foreach ($pattern in $patterns) { if ($Text -match $pattern) { return $false } }
    return $true
}

function Test-DependencyPolicy {
    param([object[]]$Dependencies)
    foreach ($dependency in $Dependencies) {
        if ($null -eq $dependency.name -or $null -eq $dependency.severity -or $null -eq $dependency.accepted) { return $false }
        if ([string]$dependency.severity -notin @('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) { return $false }
    }
    return @($Dependencies | Where-Object { $_.severity -in @('CRITICAL', 'HIGH') -and -not $_.accepted }).Count -eq 0
}

function Assert-BuildPolicy {
    param([string[]]$SourceTexts, [object[]]$Dependencies)
    foreach ($sourceText in $SourceTexts) { if (-not (Test-SecretPolicy $sourceText)) { throw 'Security scan blocked a source secret.' } }
    if (-not (Test-DependencyPolicy $Dependencies)) { throw 'Dependency policy blocked the build.' }
}

if (Test-Path -LiteralPath $runDir) { throw "Run directory already exists: $runDir" }
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
New-Item -ItemType Directory -Path $ephemeralDir -Force | Out-Null

$modulePath = Join-Path $moduleDir 'module.json'
$healthPath = Join-Path $moduleDir 'health.json'
$workflowPath = Join-Path $repoRoot '.github\workflows\nexus-local-proof.yml'
$module = Get-Content -LiteralPath $modulePath -Raw -Encoding UTF8 | ConvertFrom-Json
$health = Get-Content -LiteralPath $healthPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ($module.schema_version -ne 1 -or $module.module_id -ne 'nexus.platform.sample') { throw 'Invalid sample module contract.' }
if ($module.owner -ne 'A10' -or $module.bounded_context -ne 'platform') { throw 'Sample ownership boundary mismatch.' }
if ($module.entrypoint -ne 'health.json' -or $health.status -ne 'ok') { throw 'Sample entrypoint is invalid.' }
if ([bool]$module.network_required) { throw 'Local proof must not require network.' }

$sourceFiles = @($modulePath, $healthPath)
$provenanceFiles = @($modulePath, $healthPath, $PSCommandPath, $workflowPath)
$sourceMaterials = @($provenanceFiles | Sort-Object | ForEach-Object {
    [ordered]@{ path=$_.Substring($repoRoot.Length).TrimStart('\').Replace('\','/'); sha256=Get-Sha256 $_ }
})
$sourceManifest = (($sourceMaterials | ForEach-Object { $_.path + '|' + $_.sha256 }) -join "`n") + "`n"
$sourceRevision = [ordered]@{
    kind='workspace-content-sha256'
    value=(Get-StringSha256 $sourceManifest)
    vcs_commit=$null
    vcs_state='REPOSITORY_METADATA_UNAVAILABLE'
}
$sourceTexts = @($sourceFiles | ForEach-Object { Get-Content -LiteralPath $_ -Raw -Encoding UTF8 })
$moduleDependencies = @($module.dependencies)
$secretScanPass = @($sourceTexts | Where-Object { -not (Test-SecretPolicy $_) }).Count -eq 0
$dependencyScanPass = Test-DependencyPolicy $moduleDependencies
$negativeSecretBlocked = $false
try { Assert-BuildPolicy @('api_key="synthetic_fixture_123456789"') @(); } catch { $negativeSecretBlocked = $true }
$negativeCriticalDependencyBlocked = $false
try { Assert-BuildPolicy @('{}') @([pscustomobject]@{ name='fixture'; severity='CRITICAL'; accepted=$false }); } catch { $negativeCriticalDependencyBlocked = $true }
Assert-BuildPolicy $sourceTexts $moduleDependencies

$bundle = [ordered]@{
    schema_version = 1
    module = [ordered]@{ id=$module.module_id; version=$module.version; owner=$module.owner; bounded_context=$module.bounded_context; runtime=$module.runtime; entrypoint=$module.entrypoint }
    files = @($sourceFiles | Sort-Object | ForEach-Object {
        [ordered]@{ path=$_.Substring($repoRoot.Length).TrimStart('\').Replace('\','/'); sha256=Get-Sha256 $_; content=(Get-Content -LiteralPath $_ -Raw -Encoding UTF8 | ConvertFrom-Json) }
    })
}
$bundlePath = Join-Path $runDir 'nexus-platform-sample.bundle.json'
Write-Utf8NoBom $bundlePath (($bundle | ConvertTo-Json -Depth 12 -Compress) + "`n")
$artifactDigest = Get-Sha256 $bundlePath

$sbom = [ordered]@{
    bomFormat='CycloneDX'; specVersion='1.5'; serialNumber=('urn:uuid:' + [Guid]::NewGuid().ToString()); version=1
    metadata=[ordered]@{ component=[ordered]@{ type='application'; name=$module.module_id; version=$module.version; properties=@([ordered]@{name='nexus:artifact:sha256';value=$artifactDigest}) } }
    components=@(); dependencies=@([ordered]@{ref=$module.module_id;dependsOn=@()})
}
$sbomPath = Join-Path $runDir 'sbom.cdx.json'
Write-Utf8NoBom $sbomPath (($sbom | ConvertTo-Json -Depth 12 -Compress) + "`n")

$provenance = [ordered]@{
    schema_version=1; predicate_type='https://slsa.dev/provenance/v1'; run_id=$RunId; builder='nexus-local-powershell-zero-cost'
    build_type='nexus.sample.static-json.v1'; network_used=$false
    subject=@([ordered]@{name='nexus-platform-sample.bundle.json';sha256=$artifactDigest})
    source_revision=$sourceRevision
    materials=$sourceMaterials
}
$provenancePath = Join-Path $runDir 'provenance.json'
Write-Utf8NoBom $provenancePath (($provenance | ConvertTo-Json -Depth 12 -Compress) + "`n")

$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider 2048
try {
    $digestBytes = Convert-HexToBytes $artifactDigest
    $oid = [System.Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256')
    $signatureBytes = $rsa.SignHash($digestBytes, $oid)
    $signatureVerified = $rsa.VerifyHash($digestBytes, $oid, $signatureBytes)
    $signature = [ordered]@{algorithm='RSA-SHA256';trust_scope='LOCAL_EPHEMERAL_TEST_ONLY';artifact_sha256=$artifactDigest;signature_base64=[Convert]::ToBase64String($signatureBytes);public_key_xml=$rsa.ToXmlString($false);verified=$signatureVerified}
} finally { $rsa.Dispose() }
if (-not $signatureVerified) { throw 'Local artifact signature verification failed.' }
$signaturePath = Join-Path $runDir 'signature.json'
Write-Utf8NoBom $signaturePath (($signature | ConvertTo-Json -Depth 8 -Compress) + "`n")

$promotedPath = Join-Path $ephemeralDir 'nexus-platform-sample.bundle.json'
Copy-Item -LiteralPath $bundlePath -Destination $promotedPath
$promotedDigest = Get-Sha256 $promotedPath
if ($promotedDigest -ne $artifactDigest) { throw 'Promotion rebuilt or mutated the artifact.' }

$architectureText = Get-Content -LiteralPath (Join-Path $repoRoot 'architecture\bounded-contexts.yaml') -Raw -Encoding UTF8
$matches = [regex]::Matches($architectureText, '(?ms)^\s+- id:\s*[^\r\n]+.*?^\s+path:\s*([^\r\n]+).*?^\s+owner:\s*([^\r\n]+)')
$codeowners = @('# Generated from architecture/bounded-contexts.yaml; explicit paths override generic conventions.')
foreach ($match in $matches) { $codeowners += ('/' + $match.Groups[1].Value.Trim().TrimEnd('/') + '/ @nexus/' + $match.Groups[2].Value.Trim().ToLowerInvariant()) }
$codeownersPath = Join-Path $runDir 'CODEOWNERS.generated'
Write-Utf8NoBom $codeownersPath (($codeowners -join "`n") + "`n")

$result = [ordered]@{
    schema_version=1; task_id='NX-PLAT-001'; run_id=$RunId; executor_role=$ExecutorRole; status='PASS'; incremental_cost=[ordered]@{amount=0;currency='EUR'}
    checks=[ordered]@{module_contract=$true;secret_scan=$secretScanPass;dependency_scan=$dependencyScanPass;negative_secret_fixture=$negativeSecretBlocked;negative_critical_dependency_fixture=$negativeCriticalDependencyBlocked;signature_verified=$signatureVerified;same_digest_promoted=($artifactDigest -eq $promotedDigest);codeowners_generated=($matches.Count -gt 0)}
    artifact=[ordered]@{path=$bundlePath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');sha256=$artifactDigest;promoted_path=$promotedPath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');promoted_sha256=$promotedDigest}
    evidence=[ordered]@{source_revision=$sourceRevision;sbom=$sbomPath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');sbom_sha256=Get-Sha256 $sbomPath;provenance=$provenancePath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');provenance_sha256=Get-Sha256 $provenancePath;signature=$signaturePath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/');signature_sha256=Get-Sha256 $signaturePath;codeowners=$codeownersPath.Substring($repoRoot.Length).TrimStart('\').Replace('\','/')}
}
$resultPath = Join-Path $runDir 'pipeline-result.json'
Write-Utf8NoBom $resultPath (($result | ConvertTo-Json -Depth 12) + "`n")
$result | ConvertTo-Json -Depth 12
