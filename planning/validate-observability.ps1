[CmdletBinding()]
param(
    [string]$RunId = ('NX-OBS-001-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A15', 'A10', 'A12', 'A13', 'C09', 'C10', 'C11')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0

function Assert-Observability {
    param([bool]$Condition, [string]$Message)
    $script:assertions++
    if (-not $Condition) { $script:failures.Add($Message) }
}
function Read-Utf8 { param([string]$Path) [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) } finally { $sha.Dispose() }
    ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}
function Get-IncludedNodeRuntime {
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI\Codex\bin'
    if (-not (Test-Path -LiteralPath $root)) { return $null }
    Get-ChildItem -LiteralPath $root -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
}
function Invoke-LocalNode {
    param([string]$Node, [string[]]$Arguments, [string]$WorkingDirectory)
    $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Node; $info.Arguments = $quoted; $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Node process did not start.' }
        $stdout = $process.StandardOutput.ReadToEnd(); $stderr = $process.StandardError.ReadToEnd()
        if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Node process exceeded 30 seconds.' }
        [ordered]@{ exit_code = $process.ExitCode; stdout = $stdout.Trim(); stderr = $stderr.Trim(); cpu_seconds = [math]::Round($process.TotalProcessorTime.TotalSeconds, 4) }
    } finally { $process.Dispose() }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = [ordered]@{
    source = Join-Path $repoRoot 'packages\observability\api\index.ts'
    tests = Join-Path $repoRoot 'packages\observability\api\index.test.ts'
    baseline = Join-Path $repoRoot 'packages\observability\api\operational-baseline.v1.json'
    runbook = Join-Path $repoRoot 'services\observability\runbooks\slo-response.md'
    architecture = Join-Path $repoRoot 'architecture\bounded-contexts.yaml'
    backlog = Join-Path $PSScriptRoot 'backlog-p0.yaml'
    scorecard = Join-Path $PSScriptRoot 'capacity-scorecard.yaml'
    checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-OBS-001.md'
    spend = Join-Path $PSScriptRoot 'spend-control.yaml'
    guard = Join-Path $PSScriptRoot 'zero-cost-child-test.ps1'
    cap_evidence = Join-Path $PSScriptRoot 'evidence\NX-CAP-001-validation.json'
    boundary_checker = Join-Path $repoRoot 'security\source-boundary-check.js'
    tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
    package_lock = Join-Path $repoRoot 'packages\contracts\package-lock.json'
    architecture_doc = Join-Path $repoRoot 'docs\01-technical-architecture.md'
    assurance_doc = Join-Path $repoRoot 'docs\16-agent-delivery-continuous-assurance.md'
    validator = $PSCommandPath
}
foreach ($path in $paths.Values) { Assert-Observability (Test-Path -LiteralPath $path) "Missing artifact: $path" }
Assert-Observability ($RunId -match '^NX-OBS-001-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Observability ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'

$source = Read-Utf8 $paths.source
$tests = Read-Utf8 $paths.tests
$baseline = Read-Utf8 $paths.baseline | ConvertFrom-Json
$runbook = Read-Utf8 $paths.runbook
$architecture = Read-Utf8 $paths.architecture
$backlog = Read-Utf8 $paths.backlog
$scorecard = Read-Utf8 $paths.scorecard
$checkpoint = Read-Utf8 $paths.checkpoint
$spend = Read-Utf8 $paths.spend
$capEvidence = Read-Utf8 $paths.cap_evidence | ConvertFrom-Json

$task = [regex]::Match($backlog, '(?ms)^  - task_id:\s*NX-OBS-001\s*\r?\n(.*?)(?=^  - task_id:|\z)')
Assert-Observability $task.Success 'NX-OBS-001 is missing from backlog.'
if ($task.Success) {
    Assert-Observability ($task.Groups[1].Value -match '(?m)^\s+owner_agent:\s*A15\s*$') 'Owner is not A15.'
    Assert-Observability ($task.Groups[1].Value -match '(?m)^\s+status:\s*(in_progress|review)\s*$') 'Packet is not active.'
    Assert-Observability ($task.Groups[1].Value -match '(?m)^\s+risk_class:\s*T1\s*$') 'Packet is not T1.'
    foreach ($contract in @('telemetry_schema', 'slo', 'cost_tags')) { Assert-Observability ($task.Groups[1].Value.Contains($contract)) "Missing changed contract: $contract" }
}
Assert-Observability ($scorecard -match '(?m)^\s+active_packets:\s+1\s*$') 'WIP limit is not one.'
Assert-Observability ($scorecard -match '(?m)^\s+active_task_id:\s+NX-OBS-001\s*$') 'Capacity active task mismatch.'
Assert-Observability ($checkpoint -match '(?m)^- Stare:\s*`(in_progress|review)`\s*$') 'Checkpoint state mismatch.'
Assert-Observability ($architecture -match '(?ms)^  - id:\s*observability\s*\r?\n.*?^\s+owner:\s*A15\s*$') 'Observability owner mismatch.'
Assert-Observability ($architecture -match '(?ms)^  - id:\s*observability\s*\r?\n.*?^\s+public_api_path:\s*packages/observability/api\s*$') 'Observability API path mismatch.'
Assert-Observability ($architecture -match '(?ms)^  - id:\s*observability\s*\r?\n.*?^\s+data_access:\s*\[TELEMETRY_REDACTED\]\s*$') 'Observability data boundary mismatch.'

Assert-Observability ($baseline.schemaVersion -eq 1 -and $baseline.contractVersion -eq '1.0.0' -and $baseline.owner -eq 'A15') 'Operational baseline identity mismatch.'
Assert-Observability ($baseline.dataPolicy.classification -eq 'TELEMETRY_REDACTED' -and $baseline.dataPolicy.attributeMode -eq 'ALLOWLIST_ONLY') 'Telemetry data policy is not fail closed.'
Assert-Observability (-not [bool]$baseline.dataPolicy.baggageAllowed -and -not [bool]$baseline.dataPolicy.rawIdentifiersAllowed) 'Baggage or raw identifiers became allowed.'
Assert-Observability ([bool]$baseline.dataPolicy.criticalAuditIndependentFromHighCardinality) 'Critical audit independence is missing.'
Assert-Observability (($baseline.traceContract.processPath -join '|') -eq 'api|outbox|worker|dependency') 'Trace process path is incomplete.'
Assert-Observability ($baseline.traceContract.carrier -eq 'traceparent_only') 'Trace carrier must exclude baggage.'
Assert-Observability (@($baseline.sloIds).Count -eq 6 -and @($baseline.sloIds | Sort-Object -Unique).Count -eq 6) 'SLO catalog IDs are incomplete or duplicated.'
Assert-Observability (@($baseline.dashboards).Count -eq 2) 'Reliability and unit-cost dashboards are required.'
foreach ($dashboardId in @('nexus_reliability_v1', 'nexus_unit_cost_v1')) { Assert-Observability ($dashboardId -in @($baseline.dashboards.id)) "Missing dashboard: $dashboardId" }
$domains = @($baseline.costTagContract.domains)
foreach ($domain in @('GAS', 'MEDIA', 'PROVIDER', 'HUMAN_AGENT', 'TEST_TRAFFIC')) { Assert-Observability ($domain -in $domains) "Missing cost domain: $domain" }
Assert-Observability (-not [bool]$baseline.costTagContract.systemTestEconomicEffect) 'SYSTEM_TEST may not create economic effect.'
Assert-Observability ($baseline.rollback.switch -eq 'high_cardinality_enabled') 'High-cardinality kill switch is missing.'
foreach ($signal in @('critical_audit', 'slo_aggregates', 'cost_aggregates')) { Assert-Observability ($signal -in @($baseline.rollback.preservedSignals)) "Rollback loses required signal: $signal" }

$requiredSource = @(
    'TRACEPARENT', 'injectOutboxTrace', 'extractOutboxTrace', 'TRACE_CARRIER_INVALID',
    'SAFE_ATTRIBUTE_KEYS', 'HIGH_CARDINALITY_KEYS', 'ATTRIBUTE_KEY_FORBIDDEN', 'ATTRIBUTE_PRIVATE_DATA_FORBIDDEN',
    'recordCriticalAudit', 'setHighCardinalityEnabled', 'SLO_CATALOG', 'ALERT_RULES',
    'buildCostReport', 'SYSTEM_TEST_COST_DOMAIN_REQUIRED', 'TEST_TRAFFIC_ISOLATION_REQUIRED',
    'scanTelemetryForPrivateData', 'economicEffect: false'
)
foreach ($fragment in $requiredSource) { Assert-Observability ($source.Contains($fragment)) "Source control missing: $fragment" }
Assert-Observability ($source -notmatch '(?i)(console\.log|fetch\s*\(|XMLHttpRequest|HttpClient|WebClient|Invoke-WebRequest|https?\.request|child_process|net\.connect)') 'Runtime telemetry package can log or perform network/process operations.'
foreach ($fragment in @('API outbox worker dependency trace has four spans', 'trace ID crosses every process boundary', 'ATTRIBUTE_PRIVATE_DATA_FORBIDDEN', '203.0.113.7', 'eyJhbGciOiJIUzI1NiJ9', 'privacy scanner catches key and value fixtures', 'critical audit survives high-cardinality kill switch', 'cost report separates all five mandatory domains')) { Assert-Observability ($tests.Contains($fragment)) "Test control missing: $fragment" }

foreach ($sloId in @($baseline.sloIds)) {
    Assert-Observability ($runbook -match ('(?m)^##\s+' + [regex]::Escape([string]$sloId) + '\s*$')) "Runbook section missing: $sloId"
}
Assert-Observability ($source.Contains('slo-response.md#${slo.id}')) 'Alert rules do not derive a runbook anchor from every SLO ID.'
Assert-Observability ($runbook -match '(?m)^Owner[^\r\n]+A15') 'Runbook owner is missing.'
Assert-Observability ($runbook -match 'cardinalitate mare') 'Runbook does not preserve critical telemetry during rollback.'

Assert-Observability ($capEvidence.status -eq 'PASS') 'Capacity evidence is not PASS.'
Assert-Observability ([int]$capEvidence.blocked_economic_actions -ge 1 -and [int]$capEvidence.blocked_unallowlisted_egress_actions -ge 1) 'Zero-cost guard evidence is incomplete.'
Assert-Observability ($capEvidence.artifact_sha256.'planning/spend-control.yaml' -eq (Get-Sha256 $paths.spend)) 'Spend policy drifted after capacity evidence.'
Assert-Observability ($capEvidence.artifact_sha256.'planning/zero-cost-child-test.ps1' -eq (Get-Sha256 $paths.guard)) 'Runtime guard drifted after capacity evidence.'
Assert-Observability ($spend -match '(?m)^mode:\s*default_deny_spend\s*$' -and $spend -match '(?m)^\s*max_incremental_amount:\s*0\s*$') 'Zero-cost policy is not enforced.'
$credentialPattern = '^(AWS_|AZURE_|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|TWILIO_|MAPBOX_|CLOUDFLARE_|STRIPE_|PINATA_|IPFS_|MATRIX_)'
$credentialNames = @([Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -match $credentialPattern })
Assert-Observability ($credentialNames.Count -eq 0) 'Production/billing credential names are present.'

$node = Get-IncludedNodeRuntime
Assert-Observability ($null -ne $node) 'Included Node runtime missing.'
$ephemeralRoot = Join-Path $repoRoot '.ephemeral'
if (-not (Test-Path -LiteralPath $ephemeralRoot)) { [void](New-Item -ItemType Directory -Path $ephemeralRoot) }
$runRoot = Join-Path $ephemeralRoot ('NX-OBS-001-validator-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $runRoot)
$compile = $null; $testRun = $null; $testReceipt = $null; $boundary = $null
try {
    if ($null -ne $node) {
        $compile = Invoke-LocalNode $node @($paths.tsc, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', $runRoot, $paths.source, $paths.tests) $repoRoot
        Assert-Observability ($compile.exit_code -eq 0) "Strict TypeScript compilation failed: $($compile.stderr)"
        if ($compile.exit_code -eq 0) {
            $testRun = Invoke-LocalNode $node @((Join-Path $runRoot 'index.test.js')) $repoRoot
            Assert-Observability ($testRun.exit_code -eq 0) "Observability tests failed: $($testRun.stderr)"
            if ($testRun.exit_code -eq 0) { try { $testReceipt = $testRun.stdout | ConvertFrom-Json } catch { Assert-Observability $false 'Test receipt is not JSON.' } }
        }
        $items = @(
            [pscustomobject]@{ id = 'packages/observability/api/index.ts'; sourceContext = 'observability'; text = $source },
            [pscustomobject]@{ id = 'packages/observability/api/index.test.ts'; sourceContext = 'observability'; text = $tests }
        )
        $manifest = [pscustomobject]@{ knownSpecifiers = [pscustomobject]@{ contract_registry = 'contract_registry' }; knownSchemas = @('observability', 'contract_registry'); contexts = [pscustomobject]@{ observability = [pscustomobject]@{ allowedImports = @('contract_registry') } }; items = $items }
        $manifestPath = Join-Path $runRoot 'boundary.json'
        [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
        $boundaryRun = Invoke-LocalNode $node @($paths.boundary_checker, $manifestPath) $repoRoot
        Assert-Observability ($boundaryRun.exit_code -eq 0) "Boundary checker failed: $($boundaryRun.stderr)"
        if ($boundaryRun.exit_code -eq 0) { $boundary = $boundaryRun.stdout | ConvertFrom-Json }
    }
} finally {
    $rootPrefix = [IO.Path]::GetFullPath($ephemeralRoot).TrimEnd('\') + '\'
    $resolved = [IO.Path]::GetFullPath($runRoot)
    if ((Test-Path -LiteralPath $runRoot) -and $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $runRoot -Recurse -Force }
}

Assert-Observability ($null -ne $testReceipt) 'Test receipt missing.'
if ($null -ne $testReceipt) {
    Assert-Observability ($testReceipt.task_id -eq 'NX-OBS-001' -and $testReceipt.status -eq 'PASS') 'Test receipt did not PASS.'
    Assert-Observability ([int]$testReceipt.assertions -ge 47) 'Scenario assertions regressed below 47.'
    Assert-Observability ([int]$testReceipt.trace_demo.spans -eq 4 -and [bool]$testReceipt.trace_demo.one_trace_id) 'Cross-process trace demo failed.'
    Assert-Observability (($testReceipt.trace_demo.process_path -join '|') -eq 'api.action.accept|outbox.action.publish|worker.action.consume|dependency.chain.submit') 'Trace process order is invalid.'
    Assert-Observability ([int]$testReceipt.privacy_log_scan.findings -eq 0 -and [bool]$testReceipt.privacy_log_scan.negative_fixtures_detected) 'Privacy log scan failed.'
    Assert-Observability ([int]$testReceipt.alert_test.rules -eq 12 -and [bool]$testReceipt.alert_test.all_owned_and_runbook_mapped) 'Alert mapping test failed.'
    Assert-Observability (@($testReceipt.cost_report).Count -eq 5 -and @($testReceipt.cost_report.domain | Sort-Object -Unique).Count -eq 5) 'Cost report does not separate five domains.'
    Assert-Observability (@($testReceipt.cost_report | Where-Object { $_.domain -eq 'TEST_TRAFFIC' -and $_.amountMicrosEur -eq 0 }).Count -eq 1) 'Test traffic cost isolation failed.'
    Assert-Observability ([bool]$testReceipt.rollback_test.critical_audit_preserved -and [int]$testReceipt.rollback_test.high_cardinality_dropped -ge 1) 'High-cardinality rollback test failed.'
    Assert-Observability ([bool]$testReceipt.synthetic_only -and [int]$testReceipt.network_operations -eq 0 -and [int]$testReceipt.economic_operations -eq 0) 'Test scope is not local synthetic zero-effect.'
}
$boundaryFindings = @()
if ($null -ne $boundary) { foreach ($item in @($boundary.results)) { foreach ($finding in @($item.findings)) { $boundaryFindings += "$($item.id):$finding" } } }
Assert-Observability ($null -ne $boundary -and $boundaryFindings.Count -eq 0) ('Boundary findings: ' + ($boundaryFindings -join ','))

$artifactHashes = [ordered]@{}
foreach ($path in $paths.Values) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = Get-Sha256 $path
}
$subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")
$timer.Stop()
$result = [ordered]@{
    schema_version = 1; task_id = 'NX-OBS-001'; run_id = $RunId; executor_role = $ExecutorRole
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    scope = 'local_synthetic_observability_slo_and_cost_contract'
    assertions = $assertions; scenario_assertions = if ($null -ne $testReceipt) { [int]$testReceipt.assertions } else { 0 }; failures = @($failures)
    acceptance = [ordered]@{
        trace_demo = if ($null -ne $testReceipt) { $testReceipt.trace_demo } else { $null }
        dashboards = if ($null -ne $testReceipt) { $testReceipt.dashboards } else { @() }
        alert_test = if ($null -ne $testReceipt) { $testReceipt.alert_test } else { $null }
        privacy_log_scan = if ($null -ne $testReceipt) { $testReceipt.privacy_log_scan } else { $null }
        cost_report = if ($null -ne $testReceipt) { $testReceipt.cost_report } else { @() }
        rollback_test = if ($null -ne $testReceipt) { $testReceipt.rollback_test } else { $null }
    }
    operational_contract = [ordered]@{ version = $baseline.contractVersion; slo_count = @($baseline.sloIds).Count; alert_count = 12; dashboard_count = @($baseline.dashboards).Count; cost_domains = @($baseline.costTagContract.domains) }
    source_boundary_findings = $boundaryFindings.Count; credential_name_matches = $credentialNames.Count
    network_operations = 0; economic_operations = 0; external_provider_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    claims_excluded = @('production_slo_measurement', 'external_on_call_activation', 'managed_observability_deploy', 'paid_provider_validation')
    review_subject_sha256 = $subject; artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
