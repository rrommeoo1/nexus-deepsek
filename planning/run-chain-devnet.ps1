[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Execute', 'Resume')][string]$Mode = 'Prepare',
    [string]$RunId = ('NX-CHAIN-001-DEVNET-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [switch]$AllowPublicDevnetPayload,
    [string]$ApprovalId = '',
    [string]$ApprovalReceiptPath = '',
    [string]$ExistingContractAddress = '',
    [string]$Distro = 'Ubuntu-24.04',
    [string]$Gateway = 'https://devnet-gateway.multiversx.com',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$failures = [Collections.Generic.List[string]]::new()
$assertions = 0
function Assert-Devnet { param([bool]$Condition, [string]$Message) $script:assertions++; if (-not $Condition) { $script:failures.Add($Message) } }

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Unsupported Windows path: $full" }
    '/mnt/' + $matches[1].ToLowerInvariant() + '/' + $matches[2].Replace('\', '/')
}

function Invoke-WslCaptured {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & wsl.exe @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    [ordered]@{
        exit_code = $exitCode
        output = (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Replace("`0", '').Trim()
    }
}

function Invoke-Mxpy {
    param([string[]]$Arguments)
    Invoke-WslCaptured (@('-d', $Distro, '-u', 'root', '--', $script:MxpyWsl) + $Arguments)
}

function Require-MxpyReceipt {
    param([string]$Name, [object]$ProcessReceipt, [string]$Path)
    if ($ProcessReceipt.exit_code -ne 0) { throw "$Name failed: $($ProcessReceipt.output)" }
    if (-not (Test-Path -LiteralPath $Path)) { throw "$Name did not create its receipt." }
    [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) | ConvertFrom-Json
}

function Get-TransactionHash {
    param([object]$Receipt, [string]$Name)
    $hash = [string]$Receipt.emittedTransactionHash
    if ($hash -notmatch '^[a-f0-9]{64}$') { throw "$Name receipt has no transaction hash." }
    $hash
}

function Assert-SuccessReceipt {
    param([object]$Receipt, [string]$Name)
    $status = [string]$Receipt.transactionOnNetwork.status
    if ($status -ne 'success') { throw "$Name is not terminal success: $status" }
}

function Get-OptionalProperty {
    param([object]$Object, [string]$Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) { return $Default }
    $property.Value
}

function Get-PublicTestWallet {
    param([string]$Name)
    $registry = Get-ChildItem (Join-Path $repoRoot '.ephemeral\nx-chain-cargo\registry\src') -Directory | Select-Object -First 1
    if ($null -eq $registry) { throw 'Pinned MultiversX SDK registry is missing.' }
    $path = Join-Path $registry.FullName "multiversx-sdk-0.16.1\src\test_wallets\$Name.pem"
    if (-not (Test-Path -LiteralPath $path)) { throw "Public SDK test wallet is missing: $Name" }
    $path
}

function Get-AccountSnapshot {
    param([string]$Address)
    $response = Invoke-RestMethod -Uri ($Gateway + '/address/' + $Address) -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 20
    [ordered]@{ address = $Address; nonce = [long]$response.data.account.nonce; balance = [string]$response.data.account.balance }
}

function Get-GuardianSnapshot {
    param([string]$Address)
    $response = Invoke-RestMethod -Uri ($Gateway + '/address/' + $Address + '/guardian-data') -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 20
    $dataProperty = $response.PSObject.Properties['data']
    if ($null -eq $dataProperty -or $null -eq $dataProperty.Value) { throw "Guardian response data is missing for $Address." }
    $guardianProperty = $dataProperty.Value.PSObject.Properties['guardianData']
    if ($null -eq $guardianProperty) { throw "guardianData is missing for $Address." }
    Assert-UnguardedGuardianData $guardianProperty.Value $Address
}

function Invoke-ApprovalReceiptConsumption {
    param(
        [string]$ReceiptWsl,
        [string]$ApprovalIdentifier,
        [string]$ExpectedSubject,
        [string]$ExpectedWasm,
        [string]$ExpectedRunId,
        [int]$TransactionCap,
        [string]$OperationMode,
        [string]$ContractTarget
    )
    $process = Invoke-WslCaptured @(
        '-d', $Distro, '-u', 'root', '--', $pythonWsl, $approvalValidatorWsl,
        '--receipt', $ReceiptWsl,
        '--approval-id', $ApprovalIdentifier,
        '--gateway', $Gateway,
        '--subject-sha256', $ExpectedSubject,
        '--wasm-sha256', $ExpectedWasm,
        '--run-id', $ExpectedRunId,
        '--max-public-transactions', [string]$TransactionCap,
        '--operation-mode', $OperationMode,
        '--contract-address', $ContractTarget,
        '--consume'
    )
    if ($process.exit_code -ne 0) { throw "Approval receipt denied: $($process.output)" }
    $result = $process.output | ConvertFrom-Json
    if ($result.status -ne 'PASS' -or $result.single_use_consumed -ne $true) { throw 'Approval receipt was not atomically consumed.' }
    $result
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$contractRoot = Join-Path $repoRoot 'contracts\nexus-actions'
$wasm = Join-Path $contractRoot 'output\nexus-actions.wasm'
$mxsc = Join-Path $contractRoot 'output\nexus-actions.mxsc.json'
$abi = Join-Path $contractRoot 'output\nexus-actions.abi.json'
$builder = Join-Path $PSScriptRoot 'build-chain-devnet-payload.py'
$builderTest = Join-Path $PSScriptRoot 'test-chain-devnet-payload.py'
$runnerTest = Join-Path $PSScriptRoot 'test-chain-devnet-runner.py'
$approvalValidator = Join-Path $PSScriptRoot 'validate-chain-devnet-approval.py'
$capabilityDecoder = Join-Path $PSScriptRoot 'decode-chain-capability.py'
$guardLibrary = Join-Path $PSScriptRoot 'chain-devnet-guards.ps1'
$guardTest = Join-Path $PSScriptRoot 'test-chain-devnet-guards.ps1'
$mxpyRoot = Join-Path $repoRoot '.ephemeral\mxpy-11.4.1'
$mxpy = Join-Path $mxpyRoot 'bin\mxpy'
$python = Join-Path $mxpyRoot 'bin\python3'
$script:MxpyWsl = Convert-ToWslPath $mxpy
$pythonWsl = Convert-ToWslPath $python
$builderWsl = Convert-ToWslPath $builder
$builderTestWsl = Convert-ToWslPath $builderTest
$runnerTestWsl = Convert-ToWslPath $runnerTest
$approvalValidatorWsl = Convert-ToWslPath $approvalValidator
$capabilityDecoderWsl = Convert-ToWslPath $capabilityDecoder
$abiWsl = Convert-ToWslPath $abi
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $suffix = if ($Mode -eq 'Prepare') { 'devnet-preflight' } else { 'devnet-validation' }
    $EvidencePath = Join-Path $PSScriptRoot "evidence\NX-CHAIN-001-$suffix.json"
}

Assert-Devnet ($ExecutorRole -ne 'UNSPECIFIED') 'ExecutorRole must be explicit.'
Assert-Devnet ($RunId -match '^NX-CHAIN-001-DEVNET-[A-Za-z0-9T._-]+$') 'Run ID format is invalid.'
Assert-Devnet ($Gateway -eq 'https://devnet-gateway.multiversx.com') 'Only the official MultiversX Devnet gateway is allowed.'
foreach ($path in @($wasm, $mxsc, $abi, $builder, $builderTest, $runnerTest, $approvalValidator, $capabilityDecoder, $guardLibrary, $guardTest, $mxpy, $python)) { Assert-Devnet (Test-Path -LiteralPath $path) "Missing Devnet subject: $path" }
. $guardLibrary

$versionReceipt = Invoke-Mxpy @('--version')
Assert-Devnet ($versionReceipt.exit_code -eq 0 -and $versionReceipt.output -match 'mxpy\) 11\.4\.1') 'Pinned mxpy 11.4.1 is unavailable.'
$guardTestOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardTest 2>&1
$guardTestExitCode = $LASTEXITCODE
$guardTestResult = $null
if ($guardTestOutput) {
    try { $guardTestResult = (($guardTestOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine) | ConvertFrom-Json }
    catch { Assert-Devnet $false 'Fail-closed guard regression receipt is not JSON.' }
}
Assert-Devnet ($guardTestExitCode -eq 0 -and $null -ne $guardTestResult -and $guardTestResult.status -eq 'PASS' -and $guardTestResult.assertion_count -ge 21) 'Fail-closed guard regression failed.'
$payloadTestReceipt = Invoke-WslCaptured @('-d', $Distro, '-u', 'root', '--', $pythonWsl, $builderTestWsl)
$payloadTest = $null
if ($payloadTestReceipt.output) {
    try { $payloadTest = $payloadTestReceipt.output | ConvertFrom-Json }
    catch { Assert-Devnet $false 'Offline payload parity receipt is not JSON.' }
}
Assert-Devnet ($payloadTestReceipt.exit_code -eq 0 -and $null -ne $payloadTest -and $payloadTest.status -eq 'PASS') 'Offline RustVM payload parity failed.'
if ($null -ne $payloadTest) {
    Assert-Devnet ($payloadTest.assertions.envelope_matches_rustvm -eq $true) 'Envelope encoding differs from RustVM.'
    Assert-Devnet ($payloadTest.assertions.signing_message_matches_rustvm -eq $true) 'Signing preimage differs from RustVM.'
    Assert-Devnet ($payloadTest.assertions.signature_matches_rustvm -eq $true) 'Ed25519 signature differs from RustVM.'
    Assert-Devnet ($payloadTest.assertions.devnet_actor_is_system_test -eq $true) 'Devnet probe is not SYSTEM_TEST.'
}
$runnerTestReceipt = Invoke-WslCaptured @('-d', $Distro, '-u', 'root', '--', $pythonWsl, $runnerTestWsl)
$runnerTestResult = $null
if ($runnerTestReceipt.output) {
    try { $runnerTestResult = $runnerTestReceipt.output | ConvertFrom-Json }
    catch { Assert-Devnet $false 'Offline runner regression receipt is not JSON.' }
}
Assert-Devnet ($runnerTestReceipt.exit_code -eq 0 -and $null -ne $runnerTestResult -and $runnerTestResult.status -eq 'PASS') 'Offline Devnet runner regression failed.'
if ($null -ne $runnerTestResult) {
    Assert-Devnet ($runnerTestResult.cli_plans_parsed -eq 9) 'Not all pinned mxpy command plans parse.'
    Assert-Devnet ($runnerTestResult.approval_negative_cases -ge 9) 'Approval guard negative coverage is incomplete.'
    Assert-Devnet ($runnerTestResult.network_operations -eq 0 -and $runnerTestResult.economic_operations -eq 0) 'Offline runner regression performed an external operation.'
}

$artifactHashes = [ordered]@{}
foreach ($path in @($wasm, $mxsc, $abi, $builder, $builderTest, $runnerTest, $approvalValidator, $capabilityDecoder, $guardLibrary, $guardTest, $PSCommandPath)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$subjectLines = $artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }
$sha = [Security.Cryptography.SHA256]::Create()
try { $subjectSha = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($subjectLines -join "`n")))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }

$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
Assert-Devnet ([IO.Path]::GetDirectoryName($resolvedEvidence) -eq $allowedEvidenceParent) 'EvidencePath must stay directly in planning/evidence.'

if ($Mode -eq 'Prepare') {
    $timer.Stop()
    $preflight = [ordered]@{
        schema_version = 1
        task_id = 'NX-CHAIN-001'
        run_id = $RunId
        executor_role = $ExecutorRole
        status = if ($failures.Count -eq 0) { 'READY_AWAITING_EXPLICIT_PUBLIC_DEVNET_APPROVAL' } else { 'FAIL' }
        scope = 'offline_devnet_payload_and_tooling_preflight'
        assertions = $assertions
        failures = @($failures)
        mxpy = [ordered]@{ version = '11.4.1'; output = $versionReceipt.output; isolated_root = '.ephemeral/mxpy-11.4.1' }
        payload_parity = $payloadTest
        runner_regression = $runnerTestResult
        guard_regression = $guardTestResult
        execution_policy = [ordered]@{
            default_mode = 'Prepare'
            execute_requires_allow_switch = $true
            execute_requires_approval_id = $true
            execute_requires_subject_bound_receipt = $true
            approval_single_use = $true
            gateway_allowlist = @($Gateway)
            chain_id = 'D'
            wallets = 'PUBLIC_MULTIVERSX_SDK_TEST_FIXTURES_ONLY'
            real_funds = 'FORBIDDEN'
        }
        packet_completion = [ordered]@{ ready = $false; reason = 'PUBLIC_DEVNET_MUTATION_APPROVAL_REQUIRED' }
        claims_excluded = @('devnet_transaction', 'public_bytecode_upload', 'mainnet_readiness', 'production_security_audit')
        network_operations = 0
        economic_operations = 0
        incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
        subject_sha256 = $subjectSha
        artifact_sha256 = $artifactHashes
        duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    }
    $json = $preflight | ConvertTo-Json -Depth 12
    if ($failures.Count -eq 0) { [IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false)) }
    $json
    if ($failures.Count -gt 0) { exit 1 }
    exit 0
}

$approvalIdPattern = if ($Mode -eq 'Resume') {
    '^NX-CHAIN-001-DEVNET-RESUME-[A-Za-z0-9_-]+$'
} else {
    '^NX-CHAIN-001-DEVNET-APPROVAL-[A-Za-z0-9_-]+$'
}
if (-not $AllowPublicDevnetPayload -or $ApprovalId -notmatch $approvalIdPattern) {
    throw "$Mode requires -AllowPublicDevnetPayload and an approval identifier matching $approvalIdPattern."
}
if ($failures.Count -gt 0) { throw ($failures -join [Environment]::NewLine) }
if ([string]::IsNullOrWhiteSpace($ApprovalReceiptPath)) { throw 'Execute requires a subject-bound approval receipt path.' }
$resolvedApproval = [IO.Path]::GetFullPath($ApprovalReceiptPath)
$allowedApprovalParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'approvals'))
if ([IO.Path]::GetDirectoryName($resolvedApproval) -ne $allowedApprovalParent -or -not (Test-Path -LiteralPath $resolvedApproval)) {
    throw 'Approval receipt must be an existing file directly in planning/approvals.'
}
$approvalReceiptWsl = Convert-ToWslPath $resolvedApproval
$approvedTransactionCap = if ($Mode -eq 'Resume') { 3 } else { 4 }
$approvedContractTarget = if ($Mode -eq 'Resume') { $ExistingContractAddress } else { 'NEW_DEPLOYMENT' }
$approvalResult = $null

$ownerAddress = 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th'
$pauserAddress = 'erd1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqzu66jx'
$oldRelayerAddress = 'erd1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq6mjse8'
$relayerAddress = 'erd1r69gk66fmedhhcg24g2c5kn2f2a5k4kvpr6jfw67dn2lyydd8cfswy6ede'
$controllerAddress = 'erd1kyaqzaprcdnv4luvanah0gfxzzsnpaygsy6pytrexll2urtd05ts9vegu7'
$ownerPem = Get-PublicTestWallet 'alice'
$controllerPem = Get-PublicTestWallet 'dan'
$relayerPem = Get-PublicTestWallet 'grace'
$ownerPemWsl = Convert-ToWslPath $ownerPem
$controllerPemWsl = Convert-ToWslPath $controllerPem
$relayerPemWsl = Convert-ToWslPath $relayerPem
$controllerDecode = Invoke-Mxpy @('wallet', 'bech32', '--decode', $controllerAddress)
$relayerDecode = Invoke-Mxpy @('wallet', 'bech32', '--decode', $relayerAddress)
$oldRelayerDecode = Invoke-Mxpy @('wallet', 'bech32', '--decode', $oldRelayerAddress)
$pauserDecode = Invoke-Mxpy @('wallet', 'bech32', '--decode', $pauserAddress)
if ($controllerDecode.exit_code -ne 0 -or $controllerDecode.output -notmatch '^[a-f0-9]{64}$') { throw 'Cannot decode controller address.' }
if ($relayerDecode.exit_code -ne 0 -or $relayerDecode.output -notmatch '^[a-f0-9]{64}$') { throw 'Cannot decode relayer address.' }
if ($oldRelayerDecode.exit_code -ne 0 -or $oldRelayerDecode.output -notmatch '^[a-f0-9]{64}$') { throw 'Cannot decode prior relayer address.' }
if ($pauserDecode.exit_code -ne 0 -or $pauserDecode.output -notmatch '^[a-f0-9]{64}$') { throw 'Cannot decode pauser address.' }
$accountSnapshots = @(
    Get-AccountSnapshot $ownerAddress
    Get-AccountSnapshot $controllerAddress
    Get-AccountSnapshot $relayerAddress
)
foreach ($account in $accountSnapshots) {
    if ([Numerics.BigInteger]::Parse($account.balance) -le 0) { throw "Public Devnet test wallet has no xEGLD: $($account.address)" }
}
$guardianSnapshots = @(
    Get-GuardianSnapshot $ownerAddress
    Get-GuardianSnapshot $controllerAddress
    Get-GuardianSnapshot $relayerAddress
)
foreach ($guardian in $guardianSnapshots) {
    if ($guardian.guarded) { throw "Approved public Devnet sender unexpectedly requires guardian authorization: $($guardian.address)" }
}

$logRoot = Join-Path $PSScriptRoot "evidence\devnet-logs\$RunId"
[IO.Directory]::CreateDirectory($logRoot) | Out-Null
if ($Mode -eq 'Execute') {
    $approvalResult = Invoke-ApprovalReceiptConsumption $approvalReceiptWsl $ApprovalId $subjectSha $artifactHashes.'contracts/nexus-actions/output/nexus-actions.wasm' $RunId $approvedTransactionCap $Mode $approvedContractTarget
    $wasmWsl = Convert-ToWslPath $wasm
    $deployPath = Join-Path $logRoot 'deploy.json'
    $deploy = Invoke-Mxpy @('contract', 'deploy', '--bytecode', $wasmWsl, '--pem', $ownerPemWsl, '--proxy', $Gateway, '--chain', 'D', '--gas-limit', '100000000', '--arguments', 'str:D', "addr:$pauserAddress", '--send', '--wait-result', '--outfile', (Convert-ToWslPath $deployPath))
    $deployReceipt = Require-MxpyReceipt 'deploy' $deploy $deployPath
    Assert-SuccessReceipt $deployReceipt 'deploy'
    $deployHash = Get-TransactionHash $deployReceipt 'deploy'
    $contractAddress = [string]$deployReceipt.contractAddress
    if ($contractAddress -notmatch '^erd1[a-z0-9]{58}$') { throw 'Deploy receipt has no contract address.' }
} else {
    if ($ExistingContractAddress -notmatch '^erd1[a-z0-9]{58}$') { throw 'Resume requires an explicit existing contract address.' }
    $contractAddress = $ExistingContractAddress
    $contractSnapshot = Invoke-RestMethod -Uri ($Gateway + '/address/' + $contractAddress) -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 20
    $account = $contractSnapshot.data.account
    $expectedCodeHashBase64 = [Convert]::ToBase64String(([byte[]]@(for ($i = 0; $i -lt 64; $i += 2) { [Convert]::ToByte($artifactHashes.'contracts/nexus-actions/output/nexus-actions.wasm'.Substring($i, 2), 16) })))
    $expectedRuntimeCodeHashBase64 = [Convert]::ToBase64String(([byte[]]@(for ($i = 0; $i -lt 64; $i += 2) { [Convert]::ToByte('00a65735a13a6fb18193f3dfcfb95a784e52041c062fe87524ecbcc40f59d17e'.Substring($i, 2), 16) })))
    if ([string]$account.ownerAddress -ne $ownerAddress -or [string]$account.codeHash -ne $expectedRuntimeCodeHashBase64 -or [string]::IsNullOrWhiteSpace([string]$account.code)) {
        throw 'Existing contract owner, runtime codehash, or code presence does not match the approved Nexus deployment.'
    }
    $deployHash = 'RECOVERED_DEPLOY_TX_HASH_PENDING_INDEX'
}

if ($Mode -eq 'Resume') {
    $chainQuery = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getChainId')
    $pauserQuery = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getPauser')
    if ($chainQuery.exit_code -ne 0 -or $pauserQuery.exit_code -ne 0) { throw 'Resume constructor-state query failed.' }
    try { $chainState = @($chainQuery.output | ConvertFrom-Json); $pauserState = @($pauserQuery.output | ConvertFrom-Json) }
    catch { throw 'Resume constructor-state query returned invalid JSON.' }
    if ($chainState.Count -ne 1 -or [string]$chainState[0] -ne '44') { throw 'Resume contract chain ID is not D.' }
    if ($pauserState.Count -ne 1 -or [string]$pauserState[0] -ne $pauserDecode.output) { throw 'Resume contract pauser does not match the approved constructor state.' }
}

$decode = Invoke-Mxpy @('wallet', 'bech32', '--decode', $contractAddress)
if ($decode.exit_code -ne 0 -or $decode.output -notmatch '^[a-f0-9]{64}$') { throw 'Cannot decode deployed contract address.' }
$contractHex = $decode.output
$issuedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$expiresAt = $issuedAt + 300000
$capabilityValidFromLowerBound = $issuedAt
$payloadSeedByte = if ($Mode -eq 'Resume') { '0x43' } else { '0x42' }
$payloadProcess = Invoke-WslCaptured @('-d', $Distro, '-u', 'root', '--', $pythonWsl, $builderWsl, '--contract-hex', $contractHex, '--issued-at-ms', [string]$issuedAt, '--expires-at-ms', [string]$expiresAt, '--test-seed-byte', $payloadSeedByte)
if ($payloadProcess.exit_code -ne 0) { throw "Payload builder failed: $($payloadProcess.output)" }
$payload = $payloadProcess.output | ConvertFrom-Json
if ($payload.actor_kind -ne 'SYSTEM_TEST' -or $payload.contains_real_person_data -ne $false) { throw 'Payload safety invariant failed.' }

$capabilityExpiresAt = $issuedAt + 86400000
$oldSessionPublicKey = '2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12'
$oldCapabilityRawSha256 = $null
$oldCapabilityDisabled = $null
if ($Mode -eq 'Resume') {
    $oldCapabilityValidFrom = 1785732038000
    $oldCapabilityExpiresAt = 1785818423504
    $expectedOldCapabilitySha256 = '06d4daa84ef9d440c96fab13f2b7d415b8cb2645130fc25bdf9c305163bf6033'
    $preconditionTtlRemainingMs = Assert-CapabilityTtlBudget ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) $oldCapabilityExpiresAt 900000

    $oldQuery = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getCapability', '--arguments', ('0x' + $oldSessionPublicKey))
    if ($oldQuery.exit_code -ne 0) { throw "Existing capability recovery query failed: $($oldQuery.output)" }
    try { $oldQueryData = @($oldQuery.output | ConvertFrom-Json) }
    catch { throw 'Existing capability recovery query returned invalid JSON.' }
    if ($oldQueryData.Count -ne 1 -or [string]$oldQueryData[0] -notmatch '^[a-f0-9]+$') { throw 'Existing capability recovery state is absent or malformed.' }
    $oldDecode = Invoke-WslCaptured @(
        '-d', $Distro, '-u', 'root', '--', $pythonWsl, $capabilityDecoderWsl,
        '--encoded-hex', [string]$oldQueryData[0], '--abi', $abiWsl,
        '--controller-hex', $controllerDecode.output, '--relayer-hex', $oldRelayerDecode.output,
        '--actor-commitment-hex', $payload.actor_commitment_hex, '--actor-kind', '3',
        '--scope-bits', '1', '--max-actions', '3', '--used-actions', '0',
        '--last-action-nonce', '0', '--expires-at', [string]$oldCapabilityExpiresAt,
        '--min-valid-from', [string]$oldCapabilityValidFrom, '--max-valid-from', [string]$oldCapabilityValidFrom,
        '--active', 'true'
    )
    if ($oldDecode.exit_code -ne 0) { throw "Existing capability recovery state mismatch: $($oldDecode.output)" }
    $oldDecodedCapability = $oldDecode.output | ConvertFrom-Json
    $oldCapabilityRawSha256 = [string]$oldDecodedCapability.decoded.raw_sha256
    if ($oldCapabilityRawSha256 -ne $expectedOldCapabilitySha256) { throw 'Existing capability recovery digest mismatch.' }

    $newQuery = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getCapability', '--arguments', ('0x' + $payload.session_public_key_hex))
    if ($newQuery.exit_code -ne 0) { throw "Recovery session-key absence query failed: $($newQuery.output)" }
    $newQueryData = @(Assert-EmptyCapabilityQueryOutput $newQuery.output)
    $capabilityExpiresAt = $oldCapabilityExpiresAt

    # The single-use receipt is consumed only after all network state and guardian
    # preconditions have passed, immediately before the first approved mutation.
    $approvalResult = Invoke-ApprovalReceiptConsumption $approvalReceiptWsl $ApprovalId $subjectSha $artifactHashes.'contracts/nexus-actions/output/nexus-actions.wasm' $RunId $approvedTransactionCap $Mode $approvedContractTarget
}

$allowPath = Join-Path $logRoot 'allow-relayer.json'
$allow = Invoke-Mxpy @('contract', 'call', $contractAddress, '--pem', $ownerPemWsl, '--proxy', $Gateway, '--chain', 'D', '--function', 'setRelayerAllowed', '--gas-limit', '20000000', '--arguments', "addr:$relayerAddress", 'true', '--send', '--wait-result', '--outfile', (Convert-ToWslPath $allowPath))
$allowReceipt = Require-MxpyReceipt 'allow relayer' $allow $allowPath
Assert-SuccessReceipt $allowReceipt 'allow relayer'
$allowHash = Get-TransactionHash $allowReceipt 'allow relayer'

if ($Mode -eq 'Execute') {
    $capabilityPath = Join-Path $logRoot 'register-capability.json'
    $capabilityCall = Invoke-Mxpy @('contract', 'call', $contractAddress, '--pem', $controllerPemWsl, '--proxy', $Gateway, '--chain', 'D', '--function', 'registerCapability', '--gas-limit', '20000000', '--arguments', '3', ('0x' + $payload.actor_commitment_hex), ('0x' + $payload.session_public_key_hex), '1', '3', [string]$capabilityExpiresAt, "addr:$relayerAddress", '--send', '--wait-result', '--outfile', (Convert-ToWslPath $capabilityPath))
    $capabilityTransition = 'registerCapability'
} else {
    $capabilityPath = Join-Path $logRoot 'rotate-capability.json'
    $capabilityCall = Invoke-Mxpy @('contract', 'call', $contractAddress, '--pem', $controllerPemWsl, '--proxy', $Gateway, '--chain', 'D', '--function', 'rotateCapability', '--gas-limit', '20000000', '--arguments', ('0x' + $oldSessionPublicKey), ('0x' + $payload.session_public_key_hex), '1', '3', [string]$capabilityExpiresAt, "addr:$relayerAddress", '--send', '--wait-result', '--outfile', (Convert-ToWslPath $capabilityPath))
    $capabilityTransition = 'rotateCapability'
}
$capabilityReceipt = Require-MxpyReceipt $capabilityTransition $capabilityCall $capabilityPath
Assert-SuccessReceipt $capabilityReceipt $capabilityTransition
$capabilityHash = Get-TransactionHash $capabilityReceipt $capabilityTransition

# Generate the signed envelope only after allow/registration or rotation has
# finalized. This preserves the full five-minute action TTL for recordAction.
$recordIssuedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$recordExpiresAt = $recordIssuedAt + 300000
$recordTtlRemainingMs = Assert-CapabilityTtlBudget $recordIssuedAt $capabilityExpiresAt 300000
$recordPayloadProcess = Invoke-WslCaptured @('-d', $Distro, '-u', 'root', '--', $pythonWsl, $builderWsl, '--contract-hex', $contractHex, '--issued-at-ms', [string]$recordIssuedAt, '--expires-at-ms', [string]$recordExpiresAt, '--test-seed-byte', $payloadSeedByte)
if ($recordPayloadProcess.exit_code -ne 0) { throw "Record payload regeneration failed: $($recordPayloadProcess.output)" }
$recordPayload = $recordPayloadProcess.output | ConvertFrom-Json
if ($recordPayload.session_public_key_hex -ne $payload.session_public_key_hex -or $recordPayload.actor_commitment_hex -ne $payload.actor_commitment_hex -or $recordPayload.test_seed_id -ne $payload.test_seed_id) {
    throw 'Record payload regeneration changed the approved SYSTEM_TEST identity.'
}
$payload = $recordPayload

$recordPath = Join-Path $logRoot 'record-action.json'
$record = Invoke-Mxpy @('contract', 'call', $contractAddress, '--pem', $relayerPemWsl, '--proxy', $Gateway, '--chain', 'D', '--function', 'recordAction', '--gas-limit', '20000000', '--arguments', ('0x' + $payload.envelope_hex), ('0x' + $payload.session_signature_hex), '--send', '--wait-result', '--outfile', (Convert-ToWslPath $recordPath))
$recordReceipt = Require-MxpyReceipt 'record action' $record $recordPath
Assert-SuccessReceipt $recordReceipt 'record action'
$recordHash = Get-TransactionHash $recordReceipt 'record action'

$networkResponse = Invoke-RestMethod -Uri ($Gateway + '/transaction/' + $recordHash + '?withResults=true') -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 30
$networkTx = $networkResponse.data.transaction
$logs = Get-OptionalProperty $networkTx 'logs'
$events = @(Get-OptionalProperty $logs 'events' @())
$actionEvent = @($events | Where-Object { Test-ActionRecordedEvent $_ $contractAddress $payload.actor_commitment_hex $payload.object_commitment_hex $payload.action_nonce })
$terminalSuccess = [string]$networkTx.status -eq 'success'
$hyperblockNonce = [long](Get-OptionalProperty $networkTx 'hyperblockNonce' 0)
$sourceMetaNonce = [long](Get-OptionalProperty $networkTx 'notarizedAtSourceInMetaNonce' 0)
$hyperblockFinal = ($hyperblockNonce -gt 0) -or ($sourceMetaNonce -gt 0)
if (-not $terminalSuccess -or -not $hyperblockFinal -or $actionEvent.Count -ne 1) { throw 'Devnet terminal execution, finality, or ActionRecorded event proof failed.' }

$queryPath = Join-Path $logRoot 'capability-query.json'
$query = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getCapability', '--arguments', ('0x' + $payload.session_public_key_hex))
if ($query.exit_code -ne 0) { throw "Capability query failed: $($query.output)" }
try { $queryReceipt = $query.output | ConvertFrom-Json }
catch { throw 'Capability query stdout is not valid pinned mxpy JSON.' }
$queryData = @($queryReceipt)
if ($queryData.Count -ne 1 -or [string]$queryData[0] -notmatch '^[a-f0-9]+$') { throw 'Capability query returned an unexpected raw result shape.' }
[IO.File]::WriteAllText($queryPath, ($query.output.Trim() + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
$decodedPath = Join-Path $logRoot 'capability-decoded.json'
$decodedProcess = Invoke-WslCaptured @(
    '-d', $Distro, '-u', 'root', '--', $pythonWsl, $capabilityDecoderWsl,
    '--encoded-hex', [string]$queryData[0], '--abi', $abiWsl,
    '--controller-hex', $controllerDecode.output, '--relayer-hex', $relayerDecode.output,
    '--actor-commitment-hex', $payload.actor_commitment_hex, '--actor-kind', '3',
    '--scope-bits', '1', '--max-actions', '3', '--used-actions', '1',
    '--last-action-nonce', '1', '--expires-at', [string]$capabilityExpiresAt,
    '--min-valid-from', [string]$capabilityValidFromLowerBound, '--max-valid-from', [string]$capabilityExpiresAt
)
if ($decodedProcess.exit_code -ne 0) { throw "Capability state decode failed: $($decodedProcess.output)" }
$decodedCapability = $decodedProcess.output | ConvertFrom-Json
if ($decodedCapability.status -ne 'PASS') { throw 'Capability state did not match the expected transition.' }
[IO.File]::WriteAllText($decodedPath, ($decodedProcess.output.Trim() + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))

if ($Mode -eq 'Resume') {
    $retiredQueryPath = Join-Path $logRoot 'retired-capability-query.json'
    $retiredQuery = Invoke-Mxpy @('contract', 'query', $contractAddress, '--proxy', $Gateway, '--function', 'getCapability', '--arguments', ('0x' + $oldSessionPublicKey))
    if ($retiredQuery.exit_code -ne 0) { throw "Retired capability query failed: $($retiredQuery.output)" }
    try { $retiredQueryData = @($retiredQuery.output | ConvertFrom-Json) }
    catch { throw 'Retired capability query returned invalid JSON.' }
    if ($retiredQueryData.Count -ne 1 -or [string]$retiredQueryData[0] -notmatch '^[a-f0-9]+$') { throw 'Retired capability query returned an unexpected shape.' }
    [IO.File]::WriteAllText($retiredQueryPath, ($retiredQuery.output.Trim() + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    $retiredDecode = Invoke-WslCaptured @(
        '-d', $Distro, '-u', 'root', '--', $pythonWsl, $capabilityDecoderWsl,
        '--encoded-hex', [string]$retiredQueryData[0], '--abi', $abiWsl,
        '--controller-hex', $controllerDecode.output, '--relayer-hex', $oldRelayerDecode.output,
        '--actor-commitment-hex', $payload.actor_commitment_hex, '--actor-kind', '3',
        '--scope-bits', '1', '--max-actions', '3', '--used-actions', '0',
        '--last-action-nonce', '0', '--expires-at', [string]$oldCapabilityExpiresAt,
        '--min-valid-from', [string]$oldCapabilityValidFrom, '--max-valid-from', [string]$oldCapabilityValidFrom,
        '--active', 'false'
    )
    if ($retiredDecode.exit_code -ne 0) { throw "Retired capability state mismatch: $($retiredDecode.output)" }
    $retiredCapability = $retiredDecode.output | ConvertFrom-Json
    $oldCapabilityDisabled = $retiredCapability.decoded.active -eq $false
    if (-not $oldCapabilityDisabled) { throw 'Prior capability remained active after rotation.' }
}

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    approval_id = $ApprovalId
    approval = [ordered]@{
        owner = $approvalResult.owner
        issued_receipt_sha256 = $approvalResult.issued_receipt_sha256
        consumed_receipt_sha256 = $approvalResult.consumed_receipt_sha256
        single_use_consumed = $approvalResult.single_use_consumed
    }
    status = 'PASS'
    scope = 'public_multiversx_devnet_terminal_action_proof'
    assertions = $assertions
    failures = @()
    network = [ordered]@{ name = 'MultiversX Devnet'; chain_id = 'D'; gateway = $Gateway; real_value = $false }
    contract = [ordered]@{ address = $contractAddress; wasm_sha256 = $artifactHashes.'contracts/nexus-actions/output/nexus-actions.wasm'; deploy_tx_hash = $deployHash }
    transactions = [ordered]@{ allow_relayer = $allowHash; capability_transition = [ordered]@{ operation = $capabilityTransition; hash = $capabilityHash }; record_action = $recordHash }
    terminal_proof = [ordered]@{
        status = [string]$networkTx.status
        hyperblock_final = $hyperblockFinal
        hyperblock_nonce = $hyperblockNonce
        notarized_source_meta_nonce = $sourceMetaNonce
        action_recorded_event_count = $actionEvent.Count
        capability_query_nonempty = $queryData.Count -eq 1
        capability_state_sha256 = $decodedCapability.decoded.raw_sha256
        capability_state_verified = $true
        prior_capability_precondition_sha256 = $oldCapabilityRawSha256
        prior_capability_disabled = $oldCapabilityDisabled
        precondition_ttl_remaining_ms = if ($Mode -eq 'Resume') { $preconditionTtlRemainingMs } else { $null }
        record_ttl_remaining_ms = $recordTtlRemainingMs
        ordered_is_not_assumed_executed = $true
        authoritative_only_after_terminal_success_event = $true
    }
    payload = [ordered]@{
        actor_kind = $payload.actor_kind
        action_type = $payload.action_type
        visibility = $payload.visibility
        nonce = $payload.action_nonce
        envelope_sha256 = $payload.envelope_sha256
        contains_real_person_data = $false
        private_key_disclosed = $false
    }
    wallets = [ordered]@{ source = 'PUBLIC_MULTIVERSX_SDK_TEST_FIXTURES'; owner = $ownerAddress; controller = $controllerAddress; relayer = $relayerAddress }
    account_preflight = $accountSnapshots
    guardian_preflight = $guardianSnapshots
    claims_excluded = @('mainnet_readiness', 'mainnet_transaction', 'real_funds', 'production_security_audit', 'production_relayer_readiness')
    public_devnet_transactions = if ($Mode -eq 'Execute') { 4 } else { 3 }
    real_fund_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    subject_sha256 = $subjectSha
    artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$json = $result | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$json
