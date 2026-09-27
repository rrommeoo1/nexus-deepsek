[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Execute', 'Recover')][string]$Mode = 'Prepare',
    [string]$RunId = ('NX-PAY-P01-DEVNET-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A21', 'C03')][string]$ExecutorRole = 'UNSPECIFIED',
    [switch]$AllowPublicDevnetPayload,
    [string]$AuthorizationPath = '',
    [string]$Distro = 'Ubuntu-24.04',
    [string]$Gateway = 'https://devnet-gateway.multiversx.com',
    [string]$ApiBase = 'https://devnet-api.multiversx.com',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$repoRoot = Split-Path -Parent $PSScriptRoot
$node = 'C:\Users\Romeo\AppData\Local\OpenAI\Codex\bin\5b9024f90663758b\node.exe'
$tsc = Join-Path $repoRoot 'packages\contracts\node_modules\typescript\bin\tsc'
$source = Join-Path $repoRoot 'packages\payments\api\index.ts'
$tests = Join-Path $repoRoot 'packages\payments\api\index.test.ts'
$contract = Join-Path $repoRoot 'packages\payments\api\payment-contract.v1.json'
$spec = Join-Path $repoRoot 'docs\19-username-payments.md'
$checkpoint = Join-Path $PSScriptRoot 'checkpoints\NX-PAY-P01.md'
$runner = $PSCommandPath
$mxpy = Join-Path $repoRoot '.ephemeral\mxpy-11.4.1\bin\mxpy'
$script:MxpyWsl = $null
$senderAddress = 'erd1kyaqzaprcdnv4luvanah0gfxzzsnpaygsy6pytrexll2urtd05ts9vegu7'
$receiverAddress = 'erd1r69gk66fmedhhcg24g2c5kn2f2a5k4kvpr6jfw67dn2lyydd8cfswy6ede'
$tokenId = 'USDC-350c4e'
$tokenDecimals = 6
$atomicAmount = [Numerics.BigInteger]::One
$maxPublicTransactions = 1
$evidence = if ([string]::IsNullOrWhiteSpace($EvidencePath)) { Join-Path $PSScriptRoot 'evidence\NX-PAY-P01-devnet.json' } else { [IO.Path]::GetFullPath($EvidencePath) }

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Unsupported Windows path: $full" }
    '/mnt/' + $matches[1].ToLowerInvariant() + '/' + $matches[2].Replace('\', '/')
}
function Invoke-WslCaptured {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $output = & wsl.exe @Arguments 2>&1; $exitCode = $LASTEXITCODE } finally { $ErrorActionPreference = $previous }
    [ordered]@{ exit_code = $exitCode; output = (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Replace("`0", '').Trim() }
}
function Invoke-Mxpy { param([string[]]$Arguments) Invoke-WslCaptured (@('-d', $Distro, '-u', 'root', '--', $script:MxpyWsl) + $Arguments) }
function Get-Sha256 { param([string]$Path) (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StringSha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Get-PublicTestWallet {
    param([string]$Name)
    $registry = Get-ChildItem (Join-Path $repoRoot '.ephemeral\nx-chain-cargo\registry\src') -Directory | Select-Object -First 1
    if ($null -eq $registry) { throw 'Pinned MultiversX SDK registry is missing.' }
    $path = Join-Path $registry.FullName "multiversx-sdk-0.16.1\src\test_wallets\$Name.pem"
    if (-not (Test-Path -LiteralPath $path)) { throw "Public SDK test wallet is missing: $Name" }
    $path
}
function Get-Account {
    param([string]$Address)
    $response = Invoke-RestMethod -Method Get -Uri ($Gateway + '/address/' + $Address) -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 20
    [ordered]@{ address = $Address; nonce = [long]$response.data.account.nonce; egld_balance = [string]$response.data.account.balance }
}
function Get-TokenBalance {
    param([string]$Address)
    try {
        $token = Invoke-RestMethod -Method Get -Uri ($ApiBase + '/accounts/' + $Address + '/tokens/' + $tokenId) -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 20
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) { return [Numerics.BigInteger]::Zero }
        throw
    }
    if ([string]$token.identifier -ne $tokenId -or [int]$token.decimals -ne $tokenDecimals) { throw "Token metadata mismatch for $Address." }
    [Numerics.BigInteger]::Parse([string]$token.balance)
}
function Get-GuardianState {
    param([string]$Address)
    $response = Invoke-RestMethod -Method Get -Uri ($Gateway + '/address/' + $Address + '/guardian-data') -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 20
    $guarded = [bool]$response.data.guardianData.guarded
    [ordered]@{ address = $Address; guarded = $guarded }
}

$subjectPaths = [ordered]@{
    source = $source; tests = $tests; contract = $contract; spec = $spec; checkpoint = $checkpoint; runner = $runner
}
foreach ($path in @($node, $tsc, $source, $tests, $contract, $spec, $checkpoint, $runner, $mxpy)) { if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing runner dependency: $path" } }
if ($ExecutorRole -eq 'UNSPECIFIED') { throw 'ExecutorRole must be explicit.' }
if ($RunId -notmatch '^NX-PAY-P01-DEVNET-[A-Za-z0-9T._-]+$') { throw 'RunId is invalid.' }
if ($Gateway -ne 'https://devnet-gateway.multiversx.com' -or $ApiBase -ne 'https://devnet-api.multiversx.com') { throw 'Only pinned MultiversX Devnet endpoints are allowed.' }
$script:MxpyWsl = Convert-ToWslPath $mxpy
$version = Invoke-Mxpy @('--version')
if ($version.exit_code -ne 0 -or $version.output -notmatch 'mxpy\) 11\.4\.1') { throw 'Pinned mxpy 11.4.1 is unavailable.' }

$artifactHashes = [ordered]@{}
foreach ($entry in $subjectPaths.GetEnumerator()) { $relative = $entry.Value.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/'); $artifactHashes[$relative] = Get-Sha256 $entry.Value }
$subject = Get-StringSha256 (($artifactHashes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n")

$compileRoot = Join-Path $repoRoot '.ephemeral\NX-PAY-P01-devnet-compile'
[IO.Directory]::CreateDirectory($compileRoot) | Out-Null
$compile = & $node $tsc '--strict' '--target' 'ES2022' '--module' 'commonjs' '--lib' 'ES2022,DOM' '--outDir' $compileRoot $source $tests 2>&1
if ($LASTEXITCODE -ne 0) { throw ('Strict TypeScript compile failed: ' + (($compile | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)) }
$testOutput = & $node (Join-Path $compileRoot 'index.test.js') 2>&1
if ($LASTEXITCODE -ne 0) { throw ('Payment tests failed: ' + (($testOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)) }
$testReceipt = (($testOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine) | ConvertFrom-Json
if ($testReceipt.status -ne 'PASS' -or [int]$testReceipt.assertions -lt 66 -or [int]$testReceipt.network_operations -ne 0 -or [int]$testReceipt.economic_operations -ne 0) { throw 'Local payment receipt did not meet the runner gate.' }

if ($Mode -eq 'Recover') {
    if ([string]::IsNullOrWhiteSpace($AuthorizationPath)) { throw 'Recover requires the consumed repository authorization record.' }
    $authorizationFull = [IO.Path]::GetFullPath($AuthorizationPath)
    $authorizationParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'approvals'))
    if ([IO.Path]::GetDirectoryName($authorizationFull) -ne $authorizationParent -or -not (Test-Path -LiteralPath $authorizationFull)) { throw 'Authorization record must exist directly in planning/approvals.' }
    $authorization = [IO.File]::ReadAllText($authorizationFull, [Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($authorization.approval_id -ne 'NX-PAY-P01-DEVNET-ZERO-REAL-VALUE-20260809' -or $authorization.owner -ne 'Romeo' -or $authorization.environment -ne 'devnet' -or [decimal]$authorization.max_amount -ne 0 -or [decimal]$authorization.max_real_value -ne 0 -or $authorization.single_use -ne $true -or $authorization.consumed_run_id -ne $RunId -or [int]$authorization.max_public_transactions -ne 1 -or $authorization.external_terms_accepted -ne $false -or [int]$authorization.xmoney_provider_calls -ne 0) { throw 'Consumed authorization does not bind this recovery.' }
    $logRoot = Join-Path $PSScriptRoot ('evidence\devnet-logs\' + $RunId)
    $txPath = Join-Path $logRoot 'transfer.json'
    if (-not (Test-Path -LiteralPath $txPath -PathType Leaf)) { throw 'Signed transaction receipt is missing.' }
    $txReceipt = [IO.File]::ReadAllText($txPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $emitted = $txReceipt.emittedTransaction
    if ([string]$emitted.sender -ne $senderAddress -or [string]$emitted.receiver -ne $receiverAddress -or [long]$emitted.nonce -ne 930 -or [string]$emitted.value -ne '0' -or [string]$emitted.chainID -ne 'D' -or [string]$txReceipt.emittedTransactionData -ne 'ESDTTransfer@555344432d333530633465@01') { throw 'Signed recovery receipt binding mismatch.' }
    $senderTransfers = Invoke-RestMethod -Method Get -Uri ($ApiBase + '/accounts/' + $senderAddress + '/transfers?token=' + $tokenId + '&size=5&order=desc') -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 30
    $receiverTransfers = Invoke-RestMethod -Method Get -Uri ($ApiBase + '/accounts/' + $receiverAddress + '/transfers?token=' + $tokenId + '&size=5&order=desc') -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 30
    $senderLatest = $senderTransfers[0]; $receiverLatest = $receiverTransfers[0]
    if ($null -eq $senderLatest -or $null -eq $receiverLatest -or [string]$senderLatest.txHash -ne [string]$receiverLatest.txHash -or [string]$senderLatest.signature -ne [string]$emitted.signature -or [long]$senderLatest.nonce -ne [long]$emitted.nonce) { throw 'Latest exact token transfer is not uniquely bound to the signed receipt.' }
    $txHash = [string]$senderLatest.txHash
    if ($txHash -notmatch '^[a-f0-9]{64}$') { throw 'Recovered transaction hash is invalid.' }
    $networkTxResponse = Invoke-RestMethod -Method Get -Uri ($ApiBase + '/transactions/' + $txHash + '?withOperations=true') -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 30
    $decodedData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$networkTxResponse.data))
    if ([string]$networkTxResponse.status -ne 'success' -or [string]$networkTxResponse.sender -ne $senderAddress -or [string]$networkTxResponse.receiver -ne $receiverAddress -or [long]$networkTxResponse.nonce -ne 930 -or [string]$networkTxResponse.signature -ne [string]$emitted.signature -or $decodedData -ne 'ESDTTransfer@555344432d333530633465@01') { throw 'Recovered indexed transaction does not match the signed receipt.' }
    $senderTokenAfter = Get-TokenBalance $senderAddress; $receiverTokenAfter = Get-TokenBalance $receiverAddress
    if ($senderTokenAfter -ne 199999 -or $receiverTokenAfter -ne 1) { throw 'Current balances no longer preserve the observed post-transaction state.' }
    $timer.Stop()
    $result = [ordered]@{
        schema_version = 1; task_id = 'NX-PAY-P01'; run_id = $RunId; executor_role = $ExecutorRole; mode = 'Recover'; status = 'PASS'
        recovery_reason = 'mxpy_11_4_1_wait_timeout_type_error_after_successful_broadcast'
        authorization = [ordered]@{ approval_id = $authorization.approval_id; authorized_subject_sha256 = $authorization.subject_sha256; consumed_sha256 = Get-Sha256 $authorizationFull; single_use_consumed = $true }
        recovery_subject_sha256 = $subject; artifact_sha256 = $artifactHashes; signed_receipt_sha256 = Get-Sha256 $txPath
        network = [ordered]@{ name = 'MultiversX Devnet'; chain_id = 'D'; gateway = $Gateway; api = $ApiBase; real_value = $false }
        transaction = [ordered]@{ hash = $txHash; status = 'success'; nonce = 930; sender = $senderAddress; receiver = $receiverAddress; token_id = $tokenId; decimals = $tokenDecimals; atomic_amount = '1'; native_value = '0'; data = 'ESDTTransfer@555344432d333530633465@01'; signature = [string]$emitted.signature }
        balance_effect = [ordered]@{ sender_before = '200000'; sender_after = [string]$senderTokenAfter; sender_delta = '-1'; receiver_before = '0'; receiver_after = [string]$receiverTokenAfter; receiver_delta = '1'; token_imbalance = '0'; proof = 'current balances plus identical latest sender/receiver token-transfer history and signed receipt' }
        public_devnet_transactions = 1; repeated_broadcasts = 0; recovery_network_operations = 5; real_fund_operations = 0; xmoney_provider_operations = 0; incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
        claims_excluded = @('xmoney_sandbox', 'xmoney_production', 'mainnet', 'real_funds', 'production_compliance', 'formal_legal_opinion')
        duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    }
    [IO.File]::WriteAllText($evidence, (($result | ConvertTo-Json -Depth 12) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    $result | ConvertTo-Json -Depth 12
    exit 0
}

$senderPem = Get-PublicTestWallet 'dan'
$senderAccount = Get-Account $senderAddress
$receiverAccount = Get-Account $receiverAddress
$guardian = Get-GuardianState $senderAddress
if ($guardian.guarded) { throw 'Public Devnet test sender unexpectedly requires guardian authorization.' }
if ([Numerics.BigInteger]::Parse($senderAccount.egld_balance) -le 0) { throw 'Public Devnet sender has no xEGLD for zero-real-value gas.' }
$senderTokenBefore = Get-TokenBalance $senderAddress
$receiverTokenBefore = Get-TokenBalance $receiverAddress
if ($senderTokenBefore -lt $atomicAmount) { throw 'Public Devnet sender has insufficient test ESDT balance.' }

$draftRoot = Join-Path $repoRoot '.ephemeral\NX-PAY-P01-devnet-draft'
[IO.Directory]::CreateDirectory($draftRoot) | Out-Null
$draftPath = Join-Path $draftRoot ($RunId + '.json')
$draft = Invoke-Mxpy @('tx', 'new', '--nonce', [string]$senderAccount.nonce, '--receiver', $receiverAddress, '--pem', (Convert-ToWslPath $senderPem), '--chain', 'D', '--gas-limit', '600000', '--value', '0', '--token-transfers', $tokenId, '1', '--outfile', (Convert-ToWslPath $draftPath))
if ($draft.exit_code -ne 0 -or -not (Test-Path -LiteralPath $draftPath)) { throw "Offline Devnet draft failed: $($draft.output)" }
$draftReceipt = [IO.File]::ReadAllText($draftPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ([string]$draftReceipt.emittedTransaction.sender -ne $senderAddress -or [string]$draftReceipt.emittedTransaction.receiver -ne $receiverAddress -or [string]$draftReceipt.emittedTransaction.chainID -ne 'D' -or [string]$draftReceipt.emittedTransaction.value -ne '0') { throw 'Offline transaction draft binding mismatch.' }
if ([string]$draftReceipt.emittedTransactionData -ne 'ESDTTransfer@555344432d333530633465@01') { throw 'Offline transaction data does not match the one-atomic-unit USDC transfer.' }

if ($Mode -eq 'Prepare') {
    $timer.Stop()
    [ordered]@{
        schema_version = 1; task_id = 'NX-PAY-P01'; run_id = $RunId; executor_role = $ExecutorRole; mode = 'Prepare'; status = 'PASS'
        subject_sha256 = $subject; artifact_sha256 = $artifactHashes
        local_assertions = [int]$testReceipt.assertions
        preflight = [ordered]@{ sender = $senderAccount; receiver = $receiverAccount; sender_guarded = $guardian.guarded; token_id = $tokenId; decimals = $tokenDecimals; atomic_amount = '1'; sender_token_balance = [string]$senderTokenBefore; receiver_token_balance = [string]$receiverTokenBefore; draft_data = [string]$draftReceipt.emittedTransactionData }
        public_devnet_transactions = 0; read_only_network_operations = 5; economic_operations = 0; real_fund_operations = 0; incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
        claims_excluded = @('public_devnet_transaction', 'xmoney_sandbox', 'mainnet', 'real_funds', 'production')
        duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
    } | ConvertTo-Json -Depth 10
    exit 0
}

if (-not $AllowPublicDevnetPayload) { throw 'Execute requires -AllowPublicDevnetPayload.' }
if ([string]::IsNullOrWhiteSpace($AuthorizationPath)) { throw 'Execute requires a repository authorization record.' }
$authorizationFull = [IO.Path]::GetFullPath($AuthorizationPath)
$authorizationParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'approvals'))
if ([IO.Path]::GetDirectoryName($authorizationFull) -ne $authorizationParent -or -not (Test-Path -LiteralPath $authorizationFull)) { throw 'Authorization record must exist directly in planning/approvals.' }
$lockPath = $authorizationFull + '.lock'
$lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $authorization = [IO.File]::ReadAllText($authorizationFull, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $expiresAt = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string]$authorization.expires_at, [ref]$expiresAt)) { throw 'Authorization expiry is not a valid timestamp.' }
    if ($authorization.schema_version -ne 1 -or $authorization.approval_id -ne 'NX-PAY-P01-DEVNET-ZERO-REAL-VALUE-20260809' -or $authorization.owner -ne 'Romeo' -or $authorization.environment -ne 'devnet' -or $authorization.provider_or_category -ne 'MultiversX Devnet test ESDT' -or [decimal]$authorization.max_amount -ne 0 -or $authorization.currency -ne 'EUR' -or $expiresAt -le [DateTimeOffset]::UtcNow) { throw 'Authorization identity, scope, amount, or expiry is invalid.' }
    if ($authorization.subject_sha256 -ne $subject -or [int]$authorization.max_public_transactions -ne $maxPublicTransactions -or [decimal]$authorization.max_real_value -ne 0 -or $authorization.token_id -ne $tokenId -or [int]$authorization.token_decimals -ne $tokenDecimals -or [string]$authorization.atomic_amount -ne '1' -or $authorization.sender -ne $senderAddress -or $authorization.receiver -ne $receiverAddress -or $authorization.gateway -ne $Gateway -or $authorization.wallet_source -ne 'PUBLIC_MULTIVERSX_SDK_TEST_FIXTURES_ONLY' -or $authorization.single_use -ne $true -or [int]$authorization.xmoney_provider_calls -ne 0 -or $authorization.external_terms_accepted -ne $false -or $null -ne $authorization.consumed_run_id) { throw 'Authorization subject or exact transaction binding is invalid or already consumed.' }
    $issuedAuthorizationSha = Get-Sha256 $authorizationFull
    $authorization.consumed_run_id = $RunId; $authorization.consumed_at = [DateTimeOffset]::UtcNow.ToString('o')
    [IO.File]::WriteAllText($authorizationFull, (($authorization | ConvertTo-Json -Depth 8) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    $consumedAuthorizationSha = Get-Sha256 $authorizationFull
} finally { $lock.Dispose() }

$logRoot = Join-Path $PSScriptRoot ('evidence\devnet-logs\' + $RunId)
[IO.Directory]::CreateDirectory($logRoot) | Out-Null
$txPath = Join-Path $logRoot 'transfer.json'
$send = Invoke-Mxpy @('tx', 'new', '--receiver', $receiverAddress, '--pem', (Convert-ToWslPath $senderPem), '--proxy', $Gateway, '--chain', 'D', '--gas-limit', '600000', '--value', '0', '--token-transfers', $tokenId, '1', '--send', '--outfile', (Convert-ToWslPath $txPath))
if ($send.exit_code -ne 0 -or -not (Test-Path -LiteralPath $txPath)) { throw "Public Devnet transfer failed after authorization consumption: $($send.output)" }
$txReceipt = [IO.File]::ReadAllText($txPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$txHash = [string]$txReceipt.emittedTransactionHash
if ($txHash -notmatch '^[a-f0-9]{64}$') { throw 'Devnet broadcast did not return a transaction hash.' }
$networkTxResponse = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $networkTxResponse = Invoke-RestMethod -Method Get -Uri ($ApiBase + '/transactions/' + $txHash + '?withOperations=true') -Headers @{ 'User-Agent' = 'Nexus-Pay-Devnet/1.0' } -TimeoutSec 20 } catch { $networkTxResponse = $null }
    if ($null -ne $networkTxResponse -and [string]$networkTxResponse.status -in @('success', 'fail', 'invalid')) { break }
    if ($attempt -lt 29) { Start-Sleep -Seconds 2 }
}
if ($null -eq $networkTxResponse -or [string]$networkTxResponse.status -ne 'success') { throw 'Devnet transaction did not reach terminal success within the bounded polling window.' }
$decodedData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$networkTxResponse.data))
if ([string]$networkTxResponse.status -ne 'success' -or [string]$networkTxResponse.sender -ne $senderAddress -or [string]$networkTxResponse.receiver -ne $receiverAddress -or $decodedData -ne 'ESDTTransfer@555344432d333530633465@01') { throw 'Indexed transaction binding or payload mismatch.' }
$senderTokenAfter = $null; $receiverTokenAfter = $null
for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $senderTokenAfter = Get-TokenBalance $senderAddress; $receiverTokenAfter = Get-TokenBalance $receiverAddress
    if ($senderTokenAfter -eq $senderTokenBefore - $atomicAmount -and $receiverTokenAfter -eq $receiverTokenBefore + $atomicAmount) { break }
    if ($attempt -lt 9) { Start-Sleep -Seconds 2 }
}
if ($senderTokenAfter -ne $senderTokenBefore - $atomicAmount -or $receiverTokenAfter -ne $receiverTokenBefore + $atomicAmount) { throw 'Indexed token balances do not reconcile to the exact one-unit transfer.' }

$timer.Stop()
$result = [ordered]@{
    schema_version = 1; task_id = 'NX-PAY-P01'; run_id = $RunId; executor_role = $ExecutorRole; mode = 'Execute'; status = 'PASS'
    authorization = [ordered]@{ approval_id = 'NX-PAY-P01-DEVNET-ZERO-REAL-VALUE-20260809'; issued_sha256 = $issuedAuthorizationSha; consumed_sha256 = $consumedAuthorizationSha; single_use_consumed = $true }
    subject_sha256 = $subject; artifact_sha256 = $artifactHashes
    network = [ordered]@{ name = 'MultiversX Devnet'; chain_id = 'D'; gateway = $Gateway; api = $ApiBase; real_value = $false }
    transaction = [ordered]@{ hash = $txHash; status = 'success'; sender = $senderAddress; receiver = $receiverAddress; token_id = $tokenId; decimals = $tokenDecimals; atomic_amount = '1'; native_value = '0'; data = 'ESDTTransfer@555344432d333530633465@01' }
    balance_effect = [ordered]@{ sender_before = [string]$senderTokenBefore; sender_after = [string]$senderTokenAfter; sender_delta = '-1'; receiver_before = [string]$receiverTokenBefore; receiver_after = [string]$receiverTokenAfter; receiver_delta = '1'; token_imbalance = '0' }
    public_devnet_transactions = 1; real_fund_operations = 0; xmoney_provider_operations = 0; incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    claims_excluded = @('xmoney_sandbox', 'xmoney_production', 'mainnet', 'real_funds', 'production_compliance', 'formal_legal_opinion')
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
[IO.File]::WriteAllText($evidence, (($result | ConvertTo-Json -Depth 12) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 12
