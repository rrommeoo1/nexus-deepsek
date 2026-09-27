[CmdletBinding()]
param(
    [ValidateSet('A20', 'C03')][string]$ExecutorRole = 'A20',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$gateway = 'https://devnet-gateway.multiversx.com'
$contract = 'erd1qqqqqqqqqqqqqpgq3hd0f9mhnl2gt20sjmeg2z4hn5p7ew7pd8ssjldy2t'
$runId = 'NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-03'
$approvalId = 'NX-CHAIN-001-DEVNET-RESUME-ROMEO-20260803-R3'
$repoRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $PSScriptRoot "evidence\devnet-logs\$runId"
$guardLibrary = Join-Path $PSScriptRoot 'chain-devnet-guards.ps1'
$decoder = Join-Path $PSScriptRoot 'decode-chain-capability.py'
$abi = Join-Path $repoRoot 'contracts\nexus-actions\output\nexus-actions.abi.json'
$wasm = Join-Path $repoRoot 'contracts\nexus-actions\output\nexus-actions.wasm'
$approval = Join-Path $PSScriptRoot "approvals\$approvalId.json"
$mxpy = Join-Path $repoRoot '.ephemeral\mxpy-11.4.1\bin\mxpy'
if ([string]::IsNullOrWhiteSpace($EvidencePath)) { $EvidencePath = Join-Path $PSScriptRoot 'evidence\NX-CHAIN-001-devnet-validation.json' }
$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$allowedEvidenceParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'evidence'))
if ([IO.Path]::GetDirectoryName($resolvedEvidence) -ne $allowedEvidenceParent) { throw 'Evidence path escapes planning/evidence.' }
foreach ($path in @($logRoot, $guardLibrary, $decoder, $abi, $wasm, $approval, $mxpy)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing R3 verification subject: $path" }
}
. $guardLibrary

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Unsupported Windows path: $full" }
    '/mnt/' + $matches[1].ToLowerInvariant() + '/' + $matches[2].Replace('\', '/')
}

function Invoke-WslCaptured {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & wsl.exe @Arguments 2>&1; $exitCode = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previous }
    [ordered]@{ exit_code = $exitCode; output = (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Replace("`0", '').Trim() }
}

$mxpyWsl = Convert-ToWslPath $mxpy
$decoderWsl = Convert-ToWslPath $decoder
$abiWsl = Convert-ToWslPath $abi
function Invoke-Mxpy { param([string[]]$Arguments); Invoke-WslCaptured (@('-d', 'Ubuntu-24.04', '-u', 'root', '--', $mxpyWsl) + $Arguments) }

function Read-TxReceipt {
    param([string]$Name, [string]$ExpectedHash, [string]$ExpectedFunction, [string]$ExpectedSender)
    $path = Join-Path $logRoot $Name
    $receipt = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ([string]$receipt.emittedTransactionHash -ne $ExpectedHash -or [string]$receipt.transactionOnNetwork.hash -ne $ExpectedHash) { throw "$Name hash mismatch." }
    if ([string]$receipt.transactionOnNetwork.status -ne 'success' -or [string]$receipt.transactionOnNetwork.function -ne $ExpectedFunction) { throw "$Name is not terminal success for $ExpectedFunction." }
    if ([string]$receipt.transactionOnNetwork.sender -ne $ExpectedSender -or [string]$receipt.transactionOnNetwork.receiver -ne $contract -or [string]$receipt.transactionOnNetwork.value -ne '0') { throw "$Name sender, receiver, or value mismatch." }
    $receipt
}

$owner = 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th'
$controller = 'erd1kyaqzaprcdnv4luvanah0gfxzzsnpaygsy6pytrexll2urtd05ts9vegu7'
$grace = 'erd1r69gk66fmedhhcg24g2c5kn2f2a5k4kvpr6jfw67dn2lyydd8cfswy6ede'
$allowHash = 'dc47b5e75d56ff21bc0f6c74c8ab79f85b4260cd8261d4512e2121f5c4a480db'
$rotateHash = '1d09673c9c4d162969da9091f60b581baac78d39598d88b3d283d1251d84090a'
$recordHash = 'b4987f83d572551efe2c749edc87ad6511f68c95ce27952bda0f8a45420dc34b'
$allowReceipt = Read-TxReceipt 'allow-relayer.json' $allowHash 'setRelayerAllowed' $owner
$rotateReceipt = Read-TxReceipt 'rotate-capability.json' $rotateHash 'rotateCapability' $controller
$recordReceipt = Read-TxReceipt 'record-action.json' $recordHash 'recordAction' $grace

$finalized = [ordered]@{}
foreach ($entry in @(
    [ordered]@{ name = 'allow_relayer'; hash = $allowHash; function = 'setRelayerAllowed'; sender = $owner },
    [ordered]@{ name = 'rotate_capability'; hash = $rotateHash; function = 'rotateCapability'; sender = $controller },
    [ordered]@{ name = 'record_action'; hash = $recordHash; function = 'recordAction'; sender = $grace }
)) {
    $response = Invoke-RestMethod -Uri ($gateway + '/transaction/' + $entry.hash + '?withResults=true') -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 30
    $transaction = $response.data.transaction
    if ([string]$transaction.hash -ne $entry.hash -or [string]$transaction.status -ne 'success' -or [string]$transaction.function -ne $entry.function) { throw "$($entry.name) gateway final state mismatch." }
    if ([string]$transaction.sender -ne $entry.sender -or [string]$transaction.receiver -ne $contract -or [string]$transaction.value -ne '0') { throw "$($entry.name) gateway parties or value mismatch." }
    $hyperblock = [long]$transaction.hyperblockNonce
    $sourceMeta = [long]$transaction.notarizedAtSourceInMetaNonce
    if ($hyperblock -le 0 -or $sourceMeta -le 0) { throw "$($entry.name) is not hyperblock-final." }
    $finalized[$entry.name] = [ordered]@{ hash = $entry.hash; status = 'success'; hyperblock_nonce = $hyperblock; source_meta_nonce = $sourceMeta }
    if ($entry.name -eq 'record_action') { $recordNetwork = $transaction }
}

$events = @($recordNetwork.logs.events)
$recordEvent = @($events | Where-Object { Test-ActionRecordedEvent $_ $contract ('11' * 32) ('22' * 32) 1 })
if ($recordEvent.Count -ne 1) { throw 'Expected exactly one strict ActionRecorded event.' }

$oldKey = '2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12'
$newKey = '22fc297792f0b6ffc0bfcfdb7edb0c0aa14e025a365ec0e342e86e3829cb74b6'
$newQuery = Invoke-Mxpy @('contract', 'query', $contract, '--proxy', $gateway, '--function', 'getCapability', '--arguments', ('0x' + $newKey))
$oldQuery = Invoke-Mxpy @('contract', 'query', $contract, '--proxy', $gateway, '--function', 'getCapability', '--arguments', ('0x' + $oldKey))
$relayerQuery = Invoke-Mxpy @('contract', 'query', $contract, '--proxy', $gateway, '--function', 'isRelayerAllowed', '--arguments', ('addr:' + $grace))
if ($newQuery.exit_code -ne 0 -or $oldQuery.exit_code -ne 0 -or $relayerQuery.exit_code -ne 0) { throw 'R3 state queries failed.' }
try { $newData = @($newQuery.output | ConvertFrom-Json); $oldData = @($oldQuery.output | ConvertFrom-Json); $relayerData = @($relayerQuery.output | ConvertFrom-Json) }
catch { throw 'R3 state query JSON is malformed.' }
if ($newData.Count -ne 1 -or $oldData.Count -ne 1 -or $relayerData.Count -ne 1 -or [string]$relayerData[0] -ne '01') { throw 'R3 state query shape mismatch.' }

$controllerHex = 'b13a017423c366caff8cecfb77a12610a130f4888134122c7937feae0d6d7d17'
$graceHex = '1e8a8b6b49de5b7be10aaa158a5a6a4abb4b56cc08f524bb5e6cd5f211ad3e13'
$carolHex = 'b2a11555ce521e4944e09ab17549d85b487dcd26c84b5017a39e31a3670889ba'
$expiresAt = 1785818423504
$newDecode = Invoke-WslCaptured @('-d', 'Ubuntu-24.04', '-u', 'root', '--', 'python3', $decoderWsl, '--encoded-hex', [string]$newData[0], '--abi', $abiWsl, '--controller-hex', $controllerHex, '--relayer-hex', $graceHex, '--actor-commitment-hex', ('11' * 32), '--actor-kind', '3', '--scope-bits', '1', '--max-actions', '3', '--used-actions', '1', '--last-action-nonce', '1', '--expires-at', [string]$expiresAt, '--min-valid-from', '1785736484000', '--max-valid-from', '1785736484000', '--active', 'true')
$oldDecode = Invoke-WslCaptured @('-d', 'Ubuntu-24.04', '-u', 'root', '--', 'python3', $decoderWsl, '--encoded-hex', [string]$oldData[0], '--abi', $abiWsl, '--controller-hex', $controllerHex, '--relayer-hex', $carolHex, '--actor-commitment-hex', ('11' * 32), '--actor-kind', '3', '--scope-bits', '1', '--max-actions', '3', '--used-actions', '0', '--last-action-nonce', '0', '--expires-at', [string]$expiresAt, '--min-valid-from', '1785732038000', '--max-valid-from', '1785732038000', '--active', 'false')
if ($newDecode.exit_code -ne 0 -or $oldDecode.exit_code -ne 0) { throw "Capability decode failed. new=$($newDecode.output) old=$($oldDecode.output)" }
$newCapability = $newDecode.output | ConvertFrom-Json
$oldCapability = $oldDecode.output | ConvertFrom-Json

$approvalReceipt = Get-Content -LiteralPath $approval -Raw | ConvertFrom-Json
if ($approvalReceipt.status -ne 'CONSUMED' -or $approvalReceipt.consumed_by_run_id -ne $runId -or $approvalReceipt.max_public_transactions -ne 3 -or $approvalReceipt.max_real_value -ne 0) { throw 'R3 approval consumption evidence mismatch.' }
$wasmSha = (Get-FileHash -LiteralPath $wasm -Algorithm SHA256).Hash.ToLowerInvariant()
if ($wasmSha -ne '16cb227ba43678b8bbe8772cd2b704ff2d01a3e40b848ecd98b89de6493ab16f') { throw 'WASM digest drifted.' }
$contractResponse = Invoke-RestMethod -Uri ($gateway + '/address/' + $contract) -Headers @{ 'User-Agent' = 'Nexus-Devnet-Probe/1.0' } -TimeoutSec 30
$contractAccount = $contractResponse.data.account
$runtimeCodeHashHex = '00a65735a13a6fb18193f3dfcfb95a784e52041c062fe87524ecbcc40f59d17e'
$runtimeCodeHashBytes = [byte[]]@(for ($index = 0; $index -lt 64; $index += 2) { [Convert]::ToByte($runtimeCodeHashHex.Substring($index, 2), 16) })
$runtimeCodeHashBase64 = [Convert]::ToBase64String($runtimeCodeHashBytes)
if ([string]$contractAccount.ownerAddress -ne $owner -or [string]$contractAccount.codeHash -ne $runtimeCodeHashBase64 -or [string]::IsNullOrWhiteSpace([string]$contractAccount.code)) { throw 'Contract account ownership, runtime codehash, or code presence mismatch.' }

$artifactHashes = [ordered]@{}
foreach ($path in @(
    $PSCommandPath, $guardLibrary, $decoder, $abi, $wasm, $approval,
    (Join-Path $logRoot 'allow-relayer.json'),
    (Join-Path $logRoot 'rotate-capability.json'),
    (Join-Path $logRoot 'record-action.json')
)) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\').Replace('\', '/')
    $artifactHashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$timer.Stop()
$evidence = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $runId
    verifier_role = $ExecutorRole
    status = 'PASS'
    scope = 'read_only_recovery_of_terminal_devnet_proof_after_gateway_event_shape_drift'
    approval = [ordered]@{ approval_id = $approvalId; status = 'CONSUMED'; single_use = $true; max_public_transactions = 3; max_real_value = 0 }
    contract = [ordered]@{ address = $contract; owner = $owner; wasm_sha256 = $wasmSha; runtime_codehash_hex = $runtimeCodeHashHex; code_present = $true }
    transactions = $finalized
    terminal_proof = [ordered]@{
        record_status = 'success'
        action_recorded_event_count = 1
        event_layout = 'EI_1_5_ENDPOINT_IDENTIFIER_WITH_ABI_EVENT_TOPIC'
        event_identifier = [string]$recordEvent[0].identifier
        event_signature_topic = [string]$recordEvent[0].topics[0]
        new_capability_state_sha256 = $newCapability.decoded.raw_sha256
        new_capability_used_actions = $newCapability.decoded.used_actions
        new_capability_last_action_nonce = $newCapability.decoded.last_action_nonce
        prior_capability_state_sha256 = $oldCapability.decoded.raw_sha256
        prior_capability_active = $oldCapability.decoded.active
        grace_relayer_allowed = $true
        ordered_is_not_assumed_executed = $true
        authoritative_only_after_terminal_success_event_and_state_query = $true
    }
    r3_public_devnet_transactions = 3
    packet_public_devnet_transactions_total = 6
    verifier_network_mutations = 0
    verifier_read_only_network_operations = 7
    real_fund_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EGLD' }
    claims_excluded = @('mainnet_readiness', 'mainnet_transaction', 'real_funds', 'production_security_audit')
    source_logs = "planning/evidence/devnet-logs/$runId"
    artifact_sha256 = $artifactHashes
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}
$json = $evidence | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$json
