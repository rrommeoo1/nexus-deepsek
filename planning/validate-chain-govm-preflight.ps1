[CmdletBinding()]
param(
    [string]$RunId = ('NX-CHAIN-001-GOVM-PREFLIGHT-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()

$repoRoot = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $repoRoot '.ephemeral\mx_scenario_go_linux_amd64-v5.1.0.zip'
$binary = Join-Path $repoRoot '.ephemeral\mx-scenario-go-v5.1.0-linux-amd64\mx-scenario-go'
$scenarioRoot = Join-Path $repoRoot 'contracts\nexus-actions\scenarios'
$evidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-govm-preflight.json'
$expectedArchiveSha256 = '337c533d985174de61b86414fd21c8df567bcbb1d3e9989532cc8e0ed1852e48'
$expectedBinarySha256 = '588d1f4ba82e89bf9823af72b3b8af9d27cd38be2f75a420a3ba26ff95c03627'

$archiveSha256 = if (Test-Path -LiteralPath $archive) {
    (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
} else { '' }
$binarySha256 = if (Test-Path -LiteralPath $binary) {
    (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()
} else { '' }

$wslCommand = Get-Command wsl.exe -ErrorAction SilentlyContinue
$wslReady = $false
$wslDistributions = @()
if ($null -ne $wslCommand) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & $wslCommand.Source --status 2>$null | Out-Null
    $wslExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    $wslReady = $wslExitCode -eq 0
    if ($wslReady) {
        $wslDistributions = @(& $wslCommand.Source --list --quiet 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
}
$dockerReady = $null -ne (Get-Command docker.exe -ErrorAction SilentlyContinue)
$podmanReady = $null -ne (Get-Command podman.exe -ErrorAction SilentlyContinue)
$linuxRuntimeReady = ($wslReady -and $wslDistributions.Count -gt 0) -or $dockerReady -or $podmanReady

$scenarioFiles = @(
    'signed-action-replay.scen.json',
    'private-scope-denied.scen.json',
    'private-action-success.scen.json',
    'pauser-stop.scen.json',
    'capability-revoked.scen.json',
    'capability-rotation-escalation.scen.json',
    'relayer-and-nonce-denied.scen.json',
    'batch-shaped-extra-argument.scen.json'
)
$missingScenarios = @($scenarioFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $scenarioRoot $_)) })
$artifactReady = $archiveSha256 -eq $expectedArchiveSha256 -and $binarySha256 -eq $expectedBinarySha256
$ready = $artifactReady -and $missingScenarios.Count -eq 0 -and $linuxRuntimeReady

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = if ($ready) { 'READY' } else { 'BLOCKED' }
    scope = 'official_govm_artifact_and_linux_runtime_preflight'
    official_runner = [ordered]@{
        repository = 'multiversx/mx-chain-scenario-cli-go'
        release = 'v5.1.0'
        vm = '1.5'
        archive_sha256_expected = $expectedArchiveSha256
        archive_sha256_actual = $archiveSha256
        binary_sha256_expected = $expectedBinarySha256
        binary_sha256_actual = $binarySha256
        verified = $artifactReady
    }
    scenarios = [ordered]@{
        required = $scenarioFiles
        missing = $missingScenarios
        ready = $missingScenarios.Count -eq 0
    }
    runtime = [ordered]@{
        windows_native_supported = $false
        wsl_ready = $wslReady
        wsl_distributions = $wslDistributions
        docker_command_available = $dockerReady
        podman_command_available = $podmanReady
        linux_runtime_ready = $linuxRuntimeReady
    }
    next_command_linux = './mx-scenario-go run --vm 1.5 --force-trace-gas <scenario.scen.json>'
    blocked_reason = if ($ready) { $null } else { 'OFFICIAL_GOVM_REQUIRES_LINUX_RUNTIME' }
    system_changes_performed = 0
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}

$json = $result | ConvertTo-Json -Depth 8
[IO.Directory]::CreateDirectory((Split-Path -Parent $evidencePath)) | Out-Null
[IO.File]::WriteAllText($evidencePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$json
