[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chain-devnet-guards.ps1')

$assertions = 0
function Expect-Pass { param([scriptblock]$Case); & $Case | Out-Null; $script:assertions++ }
function Expect-Throw {
    param([scriptblock]$Case)
    $thrown = $false
    try { & $Case | Out-Null } catch { $thrown = $true }
    if (-not $thrown) { throw 'Expected fail-closed guard rejection.' }
    $script:assertions++
}

Expect-Pass { Assert-UnguardedGuardianData ((@{ guarded = $false; activeGuardian = @{} } | ConvertTo-Json -Depth 3) | ConvertFrom-Json) 'erd1test' }
Expect-Throw { Assert-UnguardedGuardianData $null 'erd1test' }
Expect-Throw { Assert-UnguardedGuardianData ((@{ activeGuardian = @{} } | ConvertTo-Json -Depth 3) | ConvertFrom-Json) 'erd1test' }
Expect-Throw { Assert-UnguardedGuardianData ((@{ guarded = 'false' } | ConvertTo-Json) | ConvertFrom-Json) 'erd1test' }
Expect-Throw { Assert-UnguardedGuardianData ((@{ guarded = $null } | ConvertTo-Json) | ConvertFrom-Json) 'erd1test' }
Expect-Throw { Assert-UnguardedGuardianData ((@{ guarded = $true } | ConvertTo-Json) | ConvertFrom-Json) 'erd1test' }

Expect-Pass { Assert-EmptyCapabilityQueryOutput '[]' }
Expect-Pass { Assert-EmptyCapabilityQueryOutput " [ `n ] " }
Expect-Throw { Assert-EmptyCapabilityQueryOutput '' }
Expect-Throw { Assert-EmptyCapabilityQueryOutput 'null' }
Expect-Throw { Assert-EmptyCapabilityQueryOutput '{}' }
Expect-Throw { Assert-EmptyCapabilityQueryOutput '[null]' }
Expect-Throw { Assert-EmptyCapabilityQueryOutput '[' }

Expect-Pass { Assert-CapabilityTtlBudget 1000 901000 900000 }
Expect-Throw { Assert-CapabilityTtlBudget 1000 900999 900000 }
Expect-Throw { Assert-CapabilityTtlBudget 1000 2000 0 }

$contract = 'erd1qqqqqqqqqqqqqpgq3hd0f9mhnl2gt20sjmeg2z4hn5p7ew7pd8ssjldy2t'
$actor = '11' * 32
$object = '22' * 32
$actualEvent = @{
    address = $contract
    identifier = 'recordAction'
    topics = @('QWN0aW9uUmVjb3JkZWQ=', 'ERERERERERERERERERERERERERERERERERERERERERE=', 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI=')
    data = 'AQ=='
} | ConvertTo-Json -Depth 4 | ConvertFrom-Json
Expect-Pass { if (-not (Test-ActionRecordedEvent $actualEvent $contract $actor $object 1)) { throw 'EI 1.5 event shape rejected.' } }
$legacyEvent = @{
    address = $contract
    identifier = 'ActionRecorded'
    topics = @('ERERERERERERERERERERERERERERERERERERERERERE=', 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI=')
    data = 'AQ=='
} | ConvertTo-Json -Depth 4 | ConvertFrom-Json
Expect-Pass { if (-not (Test-ActionRecordedEvent $legacyEvent $contract $actor $object 1)) { throw 'Legacy event shape rejected.' } }
Expect-Pass { $bad = $actualEvent.PSObject.Copy(); $bad.address = 'erd1wrong'; if (Test-ActionRecordedEvent $bad $contract $actor $object 1) { throw 'Wrong event address accepted.' } }
Expect-Pass { $bad = $actualEvent.PSObject.Copy(); $bad.data = 'AA=='; if (Test-ActionRecordedEvent $bad $contract $actor $object 1) { throw 'Wrong nonce encoding accepted.' } }
Expect-Pass { $bad = $actualEvent.PSObject.Copy(); $bad.topics = @('QWN0aW9uUmVjb3JkZWQ=', 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI=', 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI='); if (Test-ActionRecordedEvent $bad $contract $actor $object 1) { throw 'Wrong actor topic accepted.' } }

[ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    suite = 'DEVNET_FAIL_CLOSED_GUARDS'
    status = 'PASS'
    assertion_count = $assertions
    network_operations = 0
    economic_operations = 0
} | ConvertTo-Json -Compress
