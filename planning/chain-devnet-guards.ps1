Set-StrictMode -Version Latest

function Assert-UnguardedGuardianData {
    param([object]$GuardianData, [string]$Address)
    if ($null -eq $GuardianData) { throw "Guardian data is missing for $Address." }
    $guardedProperty = $GuardianData.PSObject.Properties['guarded']
    if ($null -eq $guardedProperty -or $guardedProperty.Value -isnot [bool]) {
        throw "Guardian guarded flag is missing or non-boolean for $Address."
    }
    if ($guardedProperty.Value -ne $false) { throw "Guardian is active for $Address." }

    $activeGuardian = $GuardianData.PSObject.Properties['activeGuardian']
    $activeValue = if ($null -eq $activeGuardian) { $null } else { $activeGuardian.Value }
    $addressProperty = if ($null -eq $activeValue) { $null } else { $activeValue.PSObject.Properties['address'] }
    $serviceProperty = if ($null -eq $activeValue) { $null } else { $activeValue.PSObject.Properties['serviceUID'] }
    [ordered]@{
        address = $Address
        guarded = $false
        active_guardian = if ($null -eq $addressProperty) { '' } else { [string]$addressProperty.Value }
        service = if ($null -eq $serviceProperty) { '' } else { [string]$serviceProperty.Value }
    }
}

function Assert-EmptyCapabilityQueryOutput {
    param([AllowEmptyString()][string]$Output)
    if ([string]::IsNullOrWhiteSpace($Output) -or $Output -notmatch '^\s*\[\s*\]\s*$') {
        throw 'Capability absence query must return exactly an empty JSON array.'
    }
    @()
}

function Assert-CapabilityTtlBudget {
    param([long]$NowMs, [long]$CapabilityExpiresAtMs, [long]$MinimumRemainingMs)
    if ($MinimumRemainingMs -le 0) { throw 'Minimum TTL budget must be positive.' }
    $remaining = $CapabilityExpiresAtMs - $NowMs
    if ($remaining -lt $MinimumRemainingMs) { throw 'Capability TTL budget is insufficient for recovery.' }
    $remaining
}

function Convert-Hex32ToBase64 {
    param([string]$Hex, [string]$Label)
    if ($Hex -notmatch '^[a-f0-9]{64}$') { throw "$Label must be lowercase 32-byte hex." }
    $bytes = [byte[]]@(for ($index = 0; $index -lt 64; $index += 2) { [Convert]::ToByte($Hex.Substring($index, 2), 16) })
    [Convert]::ToBase64String($bytes)
}

function Test-ActionRecordedEvent {
    param(
        [object]$Event,
        [string]$ContractAddress,
        [string]$ActorCommitmentHex,
        [string]$ObjectCommitmentHex,
        [long]$ActionNonce
    )
    if ($null -eq $Event -or $ActionNonce -ne 1) { return $false }
    foreach ($name in @('address', 'identifier', 'topics', 'data')) {
        if ($null -eq $Event.PSObject.Properties[$name]) { return $false }
    }
    if ([string]$Event.address -ne $ContractAddress -or [string]$Event.data -ne 'AQ==') { return $false }
    $topics = @($Event.topics)
    $actor = Convert-Hex32ToBase64 $ActorCommitmentHex 'actor commitment'
    $object = Convert-Hex32ToBase64 $ObjectCommitmentHex 'object commitment'
    if ([string]$Event.identifier -eq 'recordAction') {
        return $topics.Count -eq 3 -and [string]$topics[0] -eq 'QWN0aW9uUmVjb3JkZWQ=' -and [string]$topics[1] -eq $actor -and [string]$topics[2] -eq $object
    }
    if ([string]$Event.identifier -eq 'ActionRecorded') {
        return $topics.Count -eq 2 -and [string]$topics[0] -eq $actor -and [string]$topics[1] -eq $object
    }
    $false
}
