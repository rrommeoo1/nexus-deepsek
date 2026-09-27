[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string[]]$LogPath,
    [string]$RunId = ('NX-CHAIN-001-GOVM-GAS-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidateSet('UNSPECIFIED', 'A20', 'C03', 'C12')][string]$ExecutorRole = 'UNSPECIFIED',
    [string]$EvidencePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timer = [Diagnostics.Stopwatch]::StartNew()
$records = [Collections.Generic.List[object]]::new()
$pattern = 'In txID:\s*(?<tx>.*?)\s*,\s*step type:(?<step>Deploy|ScCall)(?:\s*,\s*function:\s*(?<function>.*?))?\s*,\s*total gas used:\s*(?<gas>\d+)'

foreach ($path in $LogPath) {
    $resolved = (Resolve-Path -LiteralPath $path).Path
    $content = [IO.File]::ReadAllText($resolved, [Text.Encoding]::UTF8)
    foreach ($match in [Text.RegularExpressions.Regex]::Matches($content, $pattern)) {
        $functionName = $match.Groups['function'].Value.Trim()
        if ([string]::IsNullOrWhiteSpace($functionName)) { $functionName = '__deploy__' }
        $txId = $match.Groups['tx'].Value.Trim()
        $outcomeClass = if ($txId -match '^(?i)reject\b') {
            'EXPECTED_REJECTION'
        } elseif ([string]::IsNullOrWhiteSpace($txId)) {
            'QUERY'
        } else {
            'SUCCESS'
        }
        $records.Add([pscustomobject][ordered]@{
            source_log = $resolved
            tx_id = $txId
            step_type = $match.Groups['step'].Value
            function = $functionName
            outcome_class = $outcomeClass
            budget_eligible = $outcomeClass -eq 'SUCCESS'
            gas_used = [uint64]::Parse($match.Groups['gas'].Value, [Globalization.CultureInfo]::InvariantCulture)
        })
    }
}

if ($records.Count -eq 0) { throw 'No GoVM total-gas records found.' }

$summaries = @($records | Group-Object function, outcome_class | Sort-Object Name | ForEach-Object {
    $values = @($_.Group | ForEach-Object { [uint64]$_.gas_used } | Sort-Object)
    $sum = [decimal]0
    foreach ($value in $values) { $sum += $value }
    $middle = [int][math]::Floor($values.Count / 2)
    $median = if ($values.Count % 2 -eq 1) {
        [decimal]$values[$middle]
    } else {
        ([decimal]$values[$middle - 1] + [decimal]$values[$middle]) / 2
    }
    [pscustomobject][ordered]@{
        function = $_.Group[0].function
        outcome_class = $_.Group[0].outcome_class
        samples = $values.Count
        min_gas = $values[0]
        median_gas = $median
        max_gas = $values[-1]
        mean_gas = [math]::Round(($sum / $values.Count), 2)
        recommended_gas_limit = if ($_.Group[0].budget_eligible) {
            [uint64]([math]::Ceiling(([decimal]$values[-1] * 1.25) / 1000) * 1000)
        } else { $null }
    }
})

$timer.Stop()
$result = [ordered]@{
    schema_version = 1
    task_id = 'NX-CHAIN-001'
    run_id = $RunId
    executor_role = $ExecutorRole
    status = 'PASS'
    scope = 'govm_v1_5_total_gas_trace_parser'
    parser_contract = 'mx-chain-scenario-go: In txID ... total gas used'
    records = @($records)
    summaries = $summaries
    budget_summaries = @($summaries | Where-Object { $_.outcome_class -eq 'SUCCESS' })
    record_count = $records.Count
    network_operations = 0
    economic_operations = 0
    incremental_cost = [ordered]@{ amount = 0; currency = 'EUR' }
    duration_seconds = [math]::Round($timer.Elapsed.TotalSeconds, 4)
}

$json = $result | ConvertTo-Json -Depth 8
if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
    $resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
    [IO.Directory]::CreateDirectory((Split-Path -Parent $resolvedEvidence)) | Out-Null
    [IO.File]::WriteAllText($resolvedEvidence, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}
$json
