[CmdletBinding()]
param(
    [string]$RunId = ('NX-AUTH-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string]$ObservedAt = [DateTimeOffset]::UtcNow.ToString('o'),
    [ValidateSet('UNSPECIFIED', 'A11', 'A12', 'A30', 'C02', 'C04', 'C05', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$failures = [System.Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Auth {
    param([Parameter(Mandatory = $true)][bool]$Condition, [Parameter(Mandatory = $true)][string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Read-Utf8 {
    param([Parameter(Mandatory = $true)][string]$Path)
    [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value)) }
    finally { $sha.Dispose() }
    ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

function Invoke-LocalNode {
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $NodePath
    $info.Arguments = $quoted
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Node process did not start.' }
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        if (-not $process.WaitForExit(30000)) {
            $process.Kill()
            throw 'Node process exceeded the 30 second local cap.'
        }
        [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4) }
    }
    finally { $process.Dispose() }
}

$planningDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $planningDir
$paths = [ordered]@{
    source = Join-Path $repoRoot 'packages\identity\api\index.ts'
    tests = Join-Path $repoRoot 'packages\identity\api\index.test.ts'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog = Join-Path $planningDir 'backlog-p0.yaml'
    scorecard = Join-Path $planningDir 'capacity-scorecard.yaml'
    checkpoint = Join-Path $planningDir 'checkpoints\NX-AUTH-001.md'
    spend = Join-Path $planningDir 'spend-control.yaml'
    guard = Join-Path $planningDir 'zero-cost-child-test.ps1'
    cap_evidence = Join-Path $planningDir 'evidence\NX-CAP-001-validation.json'
    threat = Join-Path $repoRoot 'security\threat-model.v1.json'
    baseline = Join-Path $repoRoot 'security\baseline-policy.v1.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    auth_doc = Join-Path $repoRoot 'docs\13-global-auth-agent-network.md'
    security_doc = Join-Path $repoRoot 'docs\04-security-compliance.md'
}

foreach ($path in $paths.Values) { Assert-Auth (Test-Path -LiteralPath $path) "Missing required artifact: $path" }
Assert-Auth ($RunId -match '^NX-AUTH-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Auth ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
$parsedObservedAt = [DateTimeOffset]::MinValue
Assert-Auth ([DateTimeOffset]::TryParse($ObservedAt, [ref]$parsedObservedAt)) 'ObservedAt is invalid.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$architecture = Read-Utf8 $paths.architecture
$backlog = Read-Utf8 $paths.backlog
$scorecard = Read-Utf8 $paths.scorecard
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json
$packageLock = Read-Utf8 $paths.package_lock

$authTask = [regex]::Match($backlog, '(?ms)^  - task_id:\s*NX-AUTH-001\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Auth $authTask.Success 'NX-AUTH-001 is missing from the P0 backlog.'
if ($authTask.Success) {
    Assert-Auth ($authTask.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A11\s*$') 'NX-AUTH-001 owner is not A11.'
    Assert-Auth ($authTask.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'NX-AUTH-001 is not active.'
    Assert-Auth ($authTask.Groups[1].Value -match '(?m)^\s+risk_class:\s*T0\s*$') 'NX-AUTH-001 is not classified T0.'
    Assert-Auth ($authTask.Groups[1].Value -match 'external_gates:\s*\[cryptographic_audit_before_production, custody_legal_memo\]') 'External crypto/legal gates were removed.'
}
Assert-Auth ($scorecard -match '(?m)^\s*active_task_id:\s*NX-AUTH-001\s*$') 'Capacity scorecard does not identify NX-AUTH-001 as active.'
Assert-Auth ($scorecard -match '(?m)^\s*active_packets:\s*1\s*$') 'WIP limit is not one active packet.'
Assert-Auth ($checkpoint -match '(?m)^- Owner:\s*`A11`\s*$') 'Checkpoint owner is inconsistent.'
Assert-Auth ($architecture -match '(?ms)^  - id:\s*identity\s*\r?\n.*?^\s+owner:\s*A11\s*$') 'Identity bounded-context owner is not A11.'
Assert-Auth ($architecture -match '(?ms)^  - id:\s*identity\s*\r?\n.*?^\s+public_api_path:\s*packages/identity/api\s*$') 'Identity public API path is inconsistent.'

# Source-level policy census. These checks establish the sandbox boundary; they do
# not claim that the injected wallet/provider implementations are externally audited.
$requiredSourceFragments = @(
    'derivePkceChallenge', 'STATE_REPLAY', 'CHALLENGE_EXPIRED', 'PKCE_MISMATCH',
    'ISSUER_MISMATCH', 'AUDIENCE_MISMATCH', 'NONCE_MISMATCH', 'REDIRECT_MISMATCH',
    'PROVIDER_ASSERTION_EXPIRED', 'SUBJECT_MISSING', 'THRESHOLD_2_OF_3',
    'fullKeyAccessibleByNexus: false', 'INDEPENDENT_FACTORS_REQUIRED',
    'RECOVERY_COOLDOWN_ACTIVE', 'authorizeExport', 'authenticateDuringProviderOutage',
    'revokeIdentity', 'LAST_RECOVERY_PATH', 'getSanitizedSnapshot', 'ENTROPY_REUSE',
    'claimLoginChallenge', 'claimProofChallenge', 'PROOF_CHALLENGE_REPLAY',
    'INDEPENDENT_AUTHENTICATORS_REQUIRED', 'verifierDomain', 'RecoveryProofContext',
    'exportDurableSnapshot', 'restoreDurableSnapshot', 'WALLET_PROVIDER_INVALID', 'KEY_VERSION_INVALID',
    'RECOVERY_COMMIT_CONFLICT', 'claimedChallenge.keyVersion'
)
foreach ($fragment in $requiredSourceFragments) { Assert-Auth ($source.Contains($fragment)) "Required source control missing: $fragment" }
Assert-Auth ($source -match 'sha256Hex\(`\$\{claims\.issuer\}\\u0000\$\{claims\.subject\}`\)') 'Issuer-subject binding is not explicit.'
Assert-Auth ($source.IndexOf('challenge.consumed = true;', [StringComparison]::Ordinal) -lt $source.IndexOf('providerVerifier.verify(provider, opaqueToken)', [StringComparison]::Ordinal)) 'Challenge is not consumed before provider verification.'
Assert-Auth ($source -match '(?s)claimLoginChallenge\(.*?\)\s*:\s*PendingChallenge\s*\{(?:(?!await).)*?challenge\.consumed = true;') 'Login challenge claim is not synchronous before every await.'
Assert-Auth ($source -match '(?s)claimProofChallenge\(.*?\)\s*:\s*ProofChallenge\s*\{(?:(?!await).)*?challenge\.consumed = true;') 'Recovery proof challenge claim is not synchronous before every await.'
Assert-Auth (([regex]::Matches($source, '\bopaqueToken\b')).Count -eq 3) 'Opaque provider token has an unexpected use or persistence path.'
Assert-Auth ($source -notmatch '(?i)(fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|net\.connect|child_process)') 'Identity sandbox contains network or child-process capability.'
Assert-Auth ($source -notmatch '(?i)(seedPhrase|mnemonic|privateKey\s*[:=]|secretKey\s*[:=]|completeKey\s*[:=])') 'Complete key material field is present in the backend sandbox.'
Assert-Auth ($source -notmatch '(?s)getSanitizedSnapshot\(\).*?opaqueToken') 'Sanitized snapshot can reference a provider token.'

$requiredTestFragments = @(
    'email equality never merges accounts', 'issuer-subject is stable regardless of email',
    'ISSUER_MISMATCH', 'AUDIENCE_MISMATCH', 'NONCE_MISMATCH', 'REDIRECT_MISMATCH',
    'PROVIDER_ASSERTION_EXPIRED', 'STATE_REPLAY', 'PKCE_MISMATCH',
    'CUSTODY_BOUNDARY_INVALID', 'SHARE_HOLDERS_INVALID', 'SHARE_COMMITMENTS_INVALID',
    'RECOVERY_COOLDOWN_ACTIVE', 'FACTOR_PROOF_INVALID', 'LAST_RECOVERY_PATH',
    'provider outage has independent recovery login', 'export bypasses Nexus key custody',
    'Nexus alone cannot reconstruct the wallet key', 'snapshot excludes',
    'concurrent state has at most one successful completion', 'concurrent state invokes provider verifier once',
    'INDEPENDENT_AUTHENTICATORS_REQUIRED', 'PROOF_CHALLENGE_REPLAY', 'PROOF_CHALLENGE_INVALID',
    'durable repository excludes provider token and raw subject', 'wallet state survives repository restart',
    'IDENTITY_REVOKED', 'WALLET_PROVIDER_INVALID', 'KEY_VERSION_INVALID',
    'parallel recovery commits one key version exactly once', 'parallel recovery loser fails version compare-and-swap'
)
foreach ($fragment in $requiredTestFragments) { Assert-Auth ($tests.Contains($fragment)) "Required negative or recovery test missing: $fragment" }
Assert-Auth ($tests -match '\.invalid') 'Tests do not visibly use reserved synthetic domains.'
Assert-Auth ($tests -notmatch '(?i)(@gmail\.com|@yahoo\.com|@outlook\.com|@hotmail\.com)') 'Tests appear to contain a real public email domain.'

# Bind this packet to the accepted zero-cost runtime guard and to its current sources.
Assert-Auth ($capEvidence.status -eq 'PASS') 'Capacity guard evidence is not PASS.'
Assert-Auth ([int]$capEvidence.blocked_economic_actions -ge 1) 'Capacity evidence did not block an economic action.'
Assert-Auth ([int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Capacity evidence did not block unallowlisted egress.'
Assert-Auth ([int]$capEvidence.credential_name_matches -eq 0) 'Capacity evidence found production/billing credentials.'
$spendRelative = 'planning/spend-control.yaml'
$guardRelative = 'planning/zero-cost-child-test.ps1'
Assert-Auth ($capEvidence.artifact_sha256.$spendRelative -eq (Get-FileHash -LiteralPath $paths.spend -Algorithm SHA256).Hash.ToLowerInvariant()) 'Spend policy changed after capacity evidence.'
Assert-Auth ($capEvidence.artifact_sha256.$guardRelative -eq (Get-FileHash -LiteralPath $paths.guard -Algorithm SHA256).Hash.ToLowerInvariant()) 'Runtime zero-cost guard changed after capacity evidence.'
Assert-Auth ($spend -match '(?m)^mode:\s*default_deny_spend\s*$') 'Spend policy is not default-deny.'
Assert-Auth ($spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Unauthorised incremental spend is not capped at zero.'

$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_)'
$credentialNames = @([System.Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Auth ($credentialNames.Count -eq 0) 'Production or billing credential names exist in the validation environment.'

$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
$nodeCandidates = [System.Collections.Generic.List[string]]::new()
$codexBin = Join-Path $localAppData 'OpenAI\Codex\bin'
if (Test-Path -LiteralPath $codexBin) {
    foreach ($directory in @(Get-ChildItem -LiteralPath $codexBin -Directory -ErrorAction SilentlyContinue | Sort-Object FullName)) {
        $candidate = Join-Path $directory.FullName 'node.exe'
        if (Test-Path -LiteralPath $candidate) { $nodeCandidates.Add($candidate) }
    }
}
Assert-Auth ($nodeCandidates.Count -ge 1) 'No included local Node runtime was found.'
$nodePath = if ($nodeCandidates.Count -gt 0) { $nodeCandidates[$nodeCandidates.Count - 1] } else { '' }

$ephemeralRoot = Join-Path $repoRoot '.ephemeral'
if (-not (Test-Path -LiteralPath $ephemeralRoot)) { [void](New-Item -ItemType Directory -Path $ephemeralRoot) }
$runRoot = Join-Path $ephemeralRoot ('NX-AUTH-001-validator-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $runRoot)
$compileResult = $null
$testResult = $null
$boundaryResult = $null
try {
    if ($nodePath) {
        $compileResult = Invoke-LocalNode $nodePath @(
            $paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM',
            '--outDir', $runRoot, $paths.source, $paths.tests
        ) $repoRoot
        Assert-Auth ($compileResult.exit_code -eq 0) "Strict TypeScript compilation failed: $($compileResult.stderr)"
        if ($compileResult.exit_code -eq 0) {
            $testResult = Invoke-LocalNode $nodePath @((Join-Path $runRoot 'index.test.js')) $repoRoot
            Assert-Auth ($testResult.exit_code -eq 0) "Identity tests failed: $($testResult.stderr)"
        }

        $manifest = [ordered]@{
            knownSpecifiers = [ordered]@{ '@nexus/contract-registry' = 'contract_registry' }
            knownSchemas = @('identity', 'contract_registry')
            contexts = [ordered]@{ identity = [ordered]@{ allowedImports = @('contract_registry') } }
            items = @(
                [ordered]@{ id = 'packages/identity/api/index.ts'; sourceContext = 'identity'; text = $source }
                [ordered]@{ id = 'packages/identity/api/index.test.ts'; sourceContext = 'identity'; text = $tests }
            )
        }
        $manifestPath = Join-Path $runRoot 'boundary-manifest.json'
        [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
        $boundaryProcess = Invoke-LocalNode $nodePath @($paths.boundary_checker, $manifestPath) $repoRoot
        Assert-Auth ($boundaryProcess.exit_code -eq 0) "Source-boundary checker failed: $($boundaryProcess.stderr)"
        if ($boundaryProcess.exit_code -eq 0) { $boundaryResult = $boundaryProcess.stdout | ConvertFrom-Json }
    }
}
finally {
    $resolvedEphemeral = [System.IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'
    $resolvedRun = [System.IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolvedRun.StartsWith($resolvedEphemeral, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $runRoot -Recurse -Force
    }
}

$testPayload = $null
if ($null -ne $testResult -and $testResult.stdout) {
    try { $testPayload = $testResult.stdout | ConvertFrom-Json }
    catch { Assert-Auth $false 'Identity test output is not a single JSON receipt.' }
}
Assert-Auth ($null -ne $testPayload) 'Identity test receipt is missing.'
if ($null -ne $testPayload) {
    Assert-Auth ($testPayload.task_id -eq 'NX-AUTH-001' -and $testPayload.status -eq 'PASS') 'Identity test receipt did not PASS.'
    Assert-Auth ([int]$testPayload.assertions -ge 64) 'Identity negative/path coverage regressed below 64 assertions.'
    Assert-Auth ($testPayload.accounts_isolated_by_issuer_subject -eq $true) 'Issuer-subject account isolation failed.'
    Assert-Auth ($testPayload.nexus_full_key_access -eq $false) 'Nexus gained full wallet-key access.'
    Assert-Auth ($testPayload.recovery_export_revoke_outage -eq $true) 'Recovery/export/revoke/outage drill failed.'
    Assert-Auth ($testPayload.synthetic_only -eq $true) 'Test receipt is not synthetic-only.'
}

$boundaryFindings = @()
if ($null -ne $boundaryResult) {
    foreach ($item in @($boundaryResult.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } }
}
Assert-Auth ($null -ne $boundaryResult) 'Source-boundary receipt is missing.'
Assert-Auth ($boundaryFindings.Count -eq 0) ('Source-boundary findings: ' + ($boundaryFindings -join ', '))
Assert-Auth ($packageLock -match '"typescript"\s*:\s*"5\.9\.3"') 'Pinned TypeScript 5.9.3 is not represented in the lockfile.'

$artifactHashes = [ordered]@{}
foreach ($artifactPath in @(
    $paths.source, $paths.tests, $PSCommandPath, $paths.architecture,
    $paths.spend, $paths.guard, $paths.cap_evidence,
    $paths.threat, $paths.baseline, $paths.boundary_checker, $paths.package_lock,
    $paths.auth_doc, $paths.security_doc
)) {
    $relative = $artifactPath.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$canonicalManifest = ($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n"
$subjectSha256 = Get-StringSha256 $canonicalManifest
$operationalHashes = [ordered]@{
    'planning/backlog-p0.yaml' = (Get-FileHash -LiteralPath $paths.backlog -Algorithm SHA256).Hash.ToLowerInvariant()
    'planning/capacity-scorecard.yaml' = (Get-FileHash -LiteralPath $paths.scorecard -Algorithm SHA256).Hash.ToLowerInvariant()
    'planning/checkpoints/NX-AUTH-001.md' = (Get-FileHash -LiteralPath $paths.checkpoint -Algorithm SHA256).Hash.ToLowerInvariant()
}
$timer.Stop()

$result = [ordered]@{
    schema_version = 1
    run_id = $RunId
    observed_at = $ObservedAt
    task_id = 'NX-AUTH-001'
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    executor_role = $ExecutorRole
    scope = 'local_synthetic_identity_and_embedded_wallet_boundary_sandbox'
    claims_excluded = @('external_provider_conformance', 'production_wallet_cryptography', 'production_transactional_repository_adapter', 'independent_cryptographic_audit', 'legal_custody_opinion')
    assertions = $assertions
    identity_test_assertions = if ($null -ne $testPayload) { [int]$testPayload.assertions } else { 0 }
    provider_adapter_calls = if ($null -ne $testPayload) { [int]$testPayload.provider_calls } else { 0 }
    strict_typescript = $null -ne $compileResult -and $compileResult.exit_code -eq 0
    source_boundary_findings = $boundaryFindings.Count
    credential_name_matches = $credentialNames.Count
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    acceptance = [ordered]@{
        issuer_subject_no_email_merge = $null -ne $testPayload -and $testPayload.accounts_isolated_by_issuer_subject
        nexus_cannot_reconstruct_key_alone = $null -ne $testPayload -and -not $testPayload.nexus_full_key_access
        recovery_export_revoke_provider_outage = $null -ne $testPayload -and $testPayload.recovery_export_revoke_outage
        local_synthetic_only = $null -ne $testPayload -and $testPayload.synthetic_only
    }
    external_gates = [ordered]@{ cryptographic_audit_before_production = 'OPEN'; custody_legal_memo = 'OPEN'; production_transactional_repository_adapter = 'OPEN' }
    subject_sha256 = $subjectSha256
    artifact_sha256 = $artifactHashes
    operational_provenance_sha256 = $operationalHashes
    deterministic_wall_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    failures = @($failures)
}

$result | ConvertTo-Json -Depth 8
if ($failures.Count -gt 0) { exit 1 }
