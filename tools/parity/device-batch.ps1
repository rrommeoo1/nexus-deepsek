<#
.SYNOPSIS
  Lotul de capturi native pentru raportul de paritate, într-o singură sesiune pe telefon.

.DESCRIPTION
  Pentru fiecare pereche „<ecran>/<stare>" din fișierul -List scrie, în docs/parity-report/<ecran>/:
    native-<stare>.png   `exec-out screencap -d <display> -p` (display-ul principal al Nexus, nu cover)
    native-<stare>.xml   `uiautomator dump --compressed` (bounds în px fizici; /compare.mjs îi împarte la DPR)
    focus-<stare>.txt    ce spune `mCurrentFocus` înainte de captură

  Reguli respectate, ca sesiunea să fie scurtă și verificabilă:
    - se lucrează DOAR dacă mCurrentFocus este app.nexus.mobile.dev (altfel pasul e sărit, nu ghicit);
    - fiecare PNG e validat (antet 89 50 4E 47, dimensiune > 0) imediat după scriere;
    - adb e cel din repo (tools/scrcpy/adb.exe), cu Wireless debugging;
    - nimic nu atinge dispozitivul: doar citiri (screencap, dumpsys, uiautomator dump).

.EXAMPLE
  powershell -NoProfile -File tools/parity/device-batch.ps1 -List docs/parity-report/batch.txt
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$List,
  [string]$Device = '',
  [int]$Display = 0,
  [double]$Dpr = 2.6,
  [string]$Package = 'app.nexus.mobile.dev',
  [string]$Out = 'docs/parity-report'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$adb = Join-Path $root 'tools\scrcpy\adb.exe'
if (-not (Test-Path $adb)) { throw "adb lipsește în repo: $adb" }
if (-not (Test-Path $List)) { throw "lipsește lista de capturi: $List" }

# 1. conexiunea: adb trebuie să vadă un dispozitiv autorizat (Wireless debugging pornit înainte).
$serial = $Device
if (-not $serial) {
  $line = (& $adb devices) -split "`r?`n" | Where-Object { $_ -match "`tdevice$" } | Select-Object -First 1
  if (-not $line) { throw "niciun dispozitiv autorizat: pornește Wireless debugging și verifică 'adb devices'." }
  $serial = ($line -split "`t")[0].Trim()
}
Write-Host "[parity] device = $serial (DPR $Dpr)"

function Get-Focus {
  $raw = & $adb -s $serial shell dumpsys window 2>$null | Select-String -Pattern 'mCurrentFocus' | Select-Object -First 1
  if (-not $raw) { return '' }
  return $raw.ToString().Trim()
}

function Save-Screenshot {
  param([string]$Path)
  # Redirecționarea o face cmd.exe: PowerShell ar trece fluxul binar prin decodorul de text și l-ar strica.
  $cmd = "`"$adb`" -s $serial exec-out screencap -d $Display -p > `"$Path`""
  cmd /c $cmd | Out-Null
}

function Save-Dump {
  param([string]$Path)
  $remote = '/sdcard/nexus-parity.xml'
  & $adb -s $serial shell uiautomator dump --compressed $remote | Out-Null
  $xml = & $adb -s $serial exec-out cat $remote
  $xml | Out-File -FilePath $Path -Encoding utf8
}

function Test-Png {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @{ ok = $false; why = 'fișier lipsă'; size = 0 } }
  $size = (Get-Item $Path).Length
  if ($size -le 8) { return @{ ok = $false; why = 'fișier gol'; size = $size } }
  $bytes = Get-Content -Path $Path -Encoding Byte -TotalCount 8
  $magic = ($bytes | ForEach-Object { $_.ToString('X2') }) -join ' '
  $ok = $magic -eq '89 50 4E 47 0D 0A 1A 0A'
  return @{ ok = $ok; why = $magic; size = $size }
}

$entries = Get-Content $List | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
if (-not $entries) { throw 'lista nu conține niciun pas' }

function Get-Nodes {
  $remote = '/sdcard/nexus-parity.xml'
  & $adb -s $serial shell uiautomator dump --compressed $remote | Out-Null
  $xml = (& $adb -s $serial exec-out cat $remote) -join "`n"
  $nodes = @()
  foreach ($match in [regex]::Matches($xml, '<node\b[^>]*>')) {
    $tag = $match.Value
    $attr = { param($name) $found = [regex]::Match($tag, "$name=`"([^`"]*)`""); if ($found.Success) { $found.Groups[1].Value } else { '' } }
    $bounds = [regex]::Match($tag, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
    if (-not $bounds.Success) { continue }
    $nodes += [pscustomobject]@{
      label   = (& $attr 'content-desc')
      text    = (& $attr 'text')
      cls     = (& $attr 'class')
      x1      = [int]$bounds.Groups[1].Value
      y1      = [int]$bounds.Groups[2].Value
      x2      = [int]$bounds.Groups[3].Value
      y2      = [int]$bounds.Groups[4].Value
    }
  }
  return $nodes
}

function Tap-Node {
  param($Node, [string]$What)
  $x = [int](($Node.x1 + $Node.x2) / 2)
  $y = [int](($Node.y1 + $Node.y2) / 2)
  & $adb -s $serial shell input tap $x $y | Out-Null
  Write-Host ("[parity] tap {0} -> ({1},{2}) [{3}] '{4}'" -f $What, $x, $y, $Node.cls, (($Node.label, $Node.text | Where-Object { $_ }) -join ' / '))
}

$report = @()
foreach ($entry in $entries) {
  $kind, $value = $entry -split ':', 2
  $kind = $kind.Trim().ToLower()

  if ($kind -eq 'wait') { Start-Sleep -Milliseconds ([int]$value); continue }

  $focus = Get-Focus
  if ($focus -notmatch [regex]::Escape($Package)) {
    Write-Warning "[parity] $entry SĂRIT: mCurrentFocus nu este $Package ($focus)"
    $report += [pscustomobject]@{ step = $entry; ok = $false; detail = 'focus' }
    continue
  }

  if ($kind -eq 'tap' -or $kind -eq 'tapxy') {
    $nodes = Get-Nodes
    if ($kind -eq 'tapxy') {
      $xy = $value -split ','
      $node = [pscustomobject]@{ x1 = [int]([double]$xy[0] * $Dpr); y1 = [int]([double]$xy[1] * $Dpr); x2 = [int]([double]$xy[0] * $Dpr); y2 = [int]([double]$xy[1] * $Dpr); label = 'coordonată CSS'; text = ''; cls = '(măsurat din web-ref)' }
    } else {
      $node = $nodes | Where-Object { ($_.label + ' ' + $_.text) -like "*$value*" } | Sort-Object { ($_.x2 - $_.x1) * ($_.y2 - $_.y1) } | Select-Object -Last 1
    }
    if (-not $node) { Write-Warning "[parity] tap:$value — niciun nod nu conține eticheta"; $report += [pscustomobject]@{ step = $entry; ok = $false; detail = 'nod negăsit' }; continue }
    Tap-Node -Node $node -What $value
    Start-Sleep -Milliseconds 900
    $report += [pscustomobject]@{ step = $entry; ok = $true; detail = ('({0},{1})' -f [int](($node.x1 + $node.x2) / 2), [int](($node.y1 + $node.y2) / 2)) }
    continue
  }

  if ($kind -eq 'capture') {
    $parts = $value -split '/', 2
    if ($parts.Count -lt 2) { Write-Warning "[parity] capture:$value — formatul este <ecran>/<stare>"; continue }
    $area = $parts[0].Trim(); $state = $parts[1].Trim()
    $dir = Join-Path $root (Join-Path $Out $area)
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Set-Content -Path (Join-Path $dir "focus-$state.txt") -Value $focus -Encoding utf8
    $png = Join-Path $dir "native-$state.png"
    $xml = Join-Path $dir "native-$state.xml"
    Save-Screenshot -Path $png
    Save-Dump -Path $xml
    $check = Test-Png -Path $png
    if (-not $check.ok) {
      Write-Warning "[parity] $value PNG invalid ($($check.why)); îl refac o dată"
      Start-Sleep -Milliseconds 400
      Save-Screenshot -Path $png
      $check = Test-Png -Path $png
    }
    Write-Host ("[parity] {0} -> {1} bytes (PNG {2})" -f $value, $check.size, $(if ($check.ok) { 'valid' } else { 'INVALID' }))
    $report += [pscustomobject]@{ step = $entry; ok = $check.ok; detail = "$($check.size) bytes" }
    continue
  }

  Write-Warning "[parity] pas necunoscut: $entry"
}

$report | Format-Table -AutoSize
$bad = @($report | Where-Object { -not $_.ok }).Count
Write-Host ("[parity] {0}/{1} pași reușiți; XML-urile stau lângă PNG-uri (px fizici / {2} = CSS px)" -f ($report.Count - $bad), $report.Count, $Dpr)
if ($bad -gt 0) { exit 1 }

