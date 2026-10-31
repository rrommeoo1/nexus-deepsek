<#
.SYNOPSIS
  Conduce telefonul prin arborele de accesibilitate: dump, tap, wait, logcat.

.DESCRIPTION
  Autentificarea xPortal are nevoie de atingeri reale pe ecran (butonul de conectare, linkul
  „Deschide xPortal”) și de dovezi care pot fi citite după aceea. Scriptul nu inventează coordonate:
  citește arborele `uiautomator` în `builds\ui.xml` (UTF-8), caută nodul după text sau `content-desc`
  și apasă centrul lui — urcând la cel mai apropiat strămoș apăsabil, fiindcă în React Native textul
  din interiorul unui `Pressable` nu este el însuși apăsabil.

  Fiecare acțiune scrie o linie de dovadă (`EVIDENCE`) cu ora telefonului, nodul găsit și dreptunghiul
  folosit, ca un raport să poată fi refăcut pas cu pas fără să se ghicească ce s-a atins.

  Coduri de ieșire: 0 ok, 2 adb lipsă, 3 niciun telefon, 4 nodul nu a apărut, 5 dump imposibil,
  6 două noduri se potrivesc și nu s-a cerut -All.

.EXAMPLE
  powershell -NoProfile -File scripts\xportal-e2e.ps1 -Action dump

.EXAMPLE
  powershell -NoProfile -File scripts\xportal-e2e.ps1 -Action tap -Match xPortal

.EXAMPLE
  powershell -NoProfile -File scripts\xportal-e2e.ps1 -Action wait -Match 'Deschide xPortal' -TimeoutSeconds 30

.EXAMPLE
  powershell -NoProfile -File scripts\xportal-e2e.ps1 -Action logcat
#>
[CmdletBinding()]
param(
  [ValidateSet('dump', 'tap', 'wait', 'logcat', 'clear', 'start', 'foreground')]
  [string]$Action = 'dump',

  # Subșir căutat în `text` sau `content-desc`, fără diferență de majuscule.
  [string]$Match = '',

  # Cât se așteaptă `wait` / `start`.
  [int]$TimeoutSeconds = 25,

  # Serialul ADB; gol = primul transport conectat.
  [string]$Serial = '',

  # Apasă pe rând toate potrivirile, nu doar pe prima (`tap`), respectiv afișează toate nodurile (`dump`).
  [switch]$All,

  # Potrivire exactă pe text/descriere, nu subșir (util când „Profil” este și tab, și alt link).
  [switch]$Exact,

  # Pachetul care trebuie să fie în prim-plan după `start`.
  [string]$Package = 'app.nexus.mobile.dev'
)

$ErrorActionPreference = 'Stop'
# Diacriticele din arborele de accesibilitate se citesc corect doar cu UTF-8 pe consolă.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCommand) {
  Write-Output 'RESULT: adb not found on PATH'
  exit 2
}
$adb = $adbCommand.Source

function Get-NexusE2eSerial {
  param([string]$Preferred)
  if ($Preferred) { return $Preferred }
  foreach ($line in (& $adb devices 2>&1)) {
    if ("$line" -match '^(\S+)\s+device\b') { return $matches[1] }
  }
  return ''
}

$serial = Get-NexusE2eSerial -Preferred $Serial
if (-not $serial) {
  Write-Output 'RESULT: no adb device (wireless debugging not connected)'
  exit 3
}

function Invoke-NexusAdb {
  param([string[]]$Arguments)
  # `adb` scrie progresul pe stderr („1 file pulled”); cu `$ErrorActionPreference = 'Stop'` orice linie de
  # acolo ar opri scriptul, deci stderr se aruncă local, nu global, iar stdout rămâne ce se citește.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    return ((& $adb -s $serial @Arguments 2>$null) | Out-String)
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Get-DeviceClock {
  # Ora telefonului, ca fiecare linie de dovadă să poată fi pusă lângă `logcat`.
  return ((Invoke-NexusAdb -Arguments @('shell', 'date', '+%H:%M:%S.%3N')) -replace "`r?`n", '').Trim()
}

function Get-UiTree {
  $remote = '/sdcard/nexus-e2e-ui.xml'
  $local = Join-Path (Split-Path -Parent $PSScriptRoot) 'builds\ui.xml'
  $dumped = $false
  for ($attempt = 1; $attempt -le 3 -and -not $dumped; $attempt++) {
    $output = Invoke-NexusAdb -Arguments @('shell', 'uiautomator', 'dump', '--compressed', $remote)
    if ($output -match 'dumped to') { $dumped = $true; break }
    # O animație continuă (video în feed) poate refuza starea `idle`; se reîncearcă, nu se inventează.
    Start-Sleep -Milliseconds 700
  }
  if (-not $dumped) { return $null }
  Invoke-NexusAdb -Arguments @('pull', $remote, $local) | Out-Null
  if (-not (Test-Path -LiteralPath $local)) { return $null }
  $text = [System.IO.File]::ReadAllText($local, [System.Text.Encoding]::UTF8)
  try { return [xml]$text } catch { return $null }
}

function Get-NodeBounds {
  param($Node)
  if ($Node -and "$($Node.bounds)" -match '^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$') {
    return [pscustomobject]@{ Left = [int]$matches[1]; Top = [int]$matches[2]; Right = [int]$matches[3]; Bottom = [int]$matches[4] }
  }
  return $null
}

function Get-UiTargets {
  param($Tree, [string]$Pattern, [switch]$Exact)
  if (-not $Tree) { return @() }
  $needle = $Pattern.ToLowerInvariant()
  $found = New-Object System.Collections.ArrayList
  foreach ($node in $Tree.SelectNodes('//node')) {
    $label = [string]$node.text
    $description = [string]$node.'content-desc'
    if ($Exact) {
      $hit = ($label.ToLowerInvariant() -eq $needle) -or ($description.ToLowerInvariant() -eq $needle)
    } else {
      $hit = ($label -and $label.ToLowerInvariant().Contains($needle)) -or
        ($description -and $description.ToLowerInvariant().Contains($needle))
    }
    if (-not $hit) { continue }
    [void]$found.Add([pscustomobject]@{
        Node = $node
        Text = $label
        Desc = $description
        Bounds = (Get-NodeBounds -Node $node)
      })
  }
  return @($found)
}

function Get-TapPoint {
  param($Target)
  # Textul dintr-un `Pressable` nu e apăsabil; se urcă până la primul strămoș care este.
  $current = $Target.Node
  while ($current -and "$($current.clickable)" -ne 'true') {
    $parent = $current.ParentNode
    if (-not $parent -or $parent.Name -ne 'node') { break }
    $current = $parent
  }
  $bounds = Get-NodeBounds -Node $current
  if (-not $bounds) { $bounds = $Target.Bounds }
  if (-not $bounds) { return $null }
  return [pscustomobject]@{
    X = [int](($bounds.Left + $bounds.Right) / 2)
    Y = [int](($bounds.Top + $bounds.Bottom) / 2)
    Bounds = $bounds
  }
}

function Write-TargetLine {
  param($Target, [string]$Prefix)
  $box = if ($Target.Bounds) { "[$($Target.Bounds.Left),$($Target.Bounds.Top)][$($Target.Bounds.Right),$($Target.Bounds.Bottom)]" } else { 'no-bounds' }
  $label = if ($Target.Text) { $Target.Text } else { $Target.Desc }
  Write-Output "$Prefix $($Target.Node.class) '$label' $box"
}

switch ($Action) {
  'foreground' {
    $focus = (Invoke-NexusAdb -Arguments @('shell', 'dumpsys', 'window')) -split "`n" |
      Where-Object { $_ -match 'mCurrentFocus' } | Select-Object -Last 1
    Write-Output "EVIDENCE $(Get-DeviceClock) $($focus.Trim())"
    exit 0
  }

  'clear' {
    Invoke-NexusAdb -Arguments @('logcat', '-c') | Out-Null
    Write-Output "RESULT: logcat cleared at $(Get-DeviceClock)"
    exit 0
  }

  'logcat' {
    $lines = (Invoke-NexusAdb -Arguments @('logcat', '-d', '-v', 'time')) -split "`n" |
      Where-Object { $_ -match '\[xportal\]|link-return' }
    if (-not $lines) { Write-Output 'RESULT: no [xportal] line in the buffer'; exit 0 }
    foreach ($line in $lines) { Write-Output $line.Trim() }
    Write-Output "RESULT: $($lines.Count) trace lines"
    exit 0
  }

  'start' {
    Invoke-NexusAdb -Arguments @('shell', 'am', 'start', '-n', "$Package/$Package.MainActivity") | Out-Null
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
      $focus = (Invoke-NexusAdb -Arguments @('shell', 'dumpsys', 'window')) -split "`n" |
        Where-Object { $_ -match 'mCurrentFocus' } | Select-Object -Last 1
      if ($focus -match [regex]::Escape($Package)) {
        Write-Output "RESULT: $Package is in front"
        exit 0
      }
      Start-Sleep -Milliseconds 500
    }
    Write-Output "RESULT: $Package did not reach the front in $TimeoutSeconds s"
    exit 4
  }

  'dump' {
    $tree = Get-UiTree
    if (-not $tree) { Write-Output 'RESULT: uiautomator dump failed'; exit 5 }
    $nodes = @($tree.SelectNodes('//node') | Where-Object { $_.text -or $_.'content-desc' })
    if ($Match) {
      $needle = $Match.ToLowerInvariant()
      $nodes = @($nodes | Where-Object { ("$($_.text) $($_.'content-desc')").ToLowerInvariant().Contains($needle) })
    }
    foreach ($node in $nodes) {
      Write-Output "$($node.bounds) click=$($node.clickable) text='$($node.text)' desc='$($node.'content-desc')'"
    }
    Write-Output "EVIDENCE $(Get-DeviceClock) dump nodes=$($nodes.Count) match='$Match'"
    exit 0
  }

  'tap' {
    $tree = Get-UiTree
    if (-not $tree) { Write-Output 'RESULT: uiautomator dump failed'; exit 5 }
    $targets = Get-UiTargets -Tree $tree -Pattern $Match -Exact:$Exact
    if ($targets.Count -eq 0) { Write-Output "RESULT: no node matching '$Match'"; exit 4 }
    # Un `Pressable` apare de două ori (o dată el, o dată textul din el); amândouă urcă la același
    # strămoș apăsabil, deci se apasă o singură cutie, nu de două ori aceeași.
    $points = @()
    foreach ($target in $targets) {
      $point = Get-TapPoint -Target $target
      if (-not $point) { Write-TargetLine -Target $target -Prefix 'NO-BOUNDS'; continue }
      $box = "[$($point.Bounds.Left),$($point.Bounds.Top)][$($point.Bounds.Right),$($point.Bounds.Bottom)]"
      if ($points | Where-Object { $_.Box -eq $box }) { continue }
      $points += [pscustomobject]@{ X = $point.X; Y = $point.Y; Box = $box; Target = $target }
    }
    if ($points.Count -eq 0) { Write-Output "RESULT: '$Match' has no bounds to tap"; exit 5 }
    if ($points.Count -gt 1 -and -not $All) {
      foreach ($point in $points) { Write-TargetLine -Target $point.Target -Prefix 'CANDIDATE'; }
      Write-Output "RESULT: $($points.Count) distinct nodes match '$Match'; narrow the text or pass -All"
      exit 6
    }
    foreach ($point in $points) {
      Write-TargetLine -Target $point.Target -Prefix 'TAP'
      Invoke-NexusAdb -Arguments @('shell', 'input', 'tap', "$($point.X)", "$($point.Y)") | Out-Null
      Write-Output "EVIDENCE $(Get-DeviceClock) tap x=$($point.X) y=$($point.Y) box=$($point.Box) label='$($point.Target.Text)$($point.Target.Desc)'"
      Start-Sleep -Milliseconds 350
      if (-not $All) { break }
    }
    Write-Output "RESULT: tapped $($points.Count) node(s) matching '$Match'"
    exit 0
  }

  'wait' {
    $started = Get-Date
    $deadline = $started.AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
      $tree = Get-UiTree
      if ($tree) {
        $targets = Get-UiTargets -Tree $tree -Pattern $Match -Exact:$Exact
        if ($targets.Count -gt 0) {
          $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
          Write-TargetLine -Target $targets[0] -Prefix 'FOUND'
          Write-Output "RESULT: '$Match' on screen after $elapsed ms"
          exit 0
        }
      }
      Start-Sleep -Milliseconds 600
    }
    Write-Output "RESULT: '$Match' did not appear in $TimeoutSeconds s"
    exit 4
  }
}
