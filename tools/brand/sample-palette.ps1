# Samples the dominant colours of the opaque pixels of the Jungle Book mark, so the "jungle" theme is
# derived from the artwork instead of guessed. Read-only: it opens one PNG, prints numbers and never
# writes a picture.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/brand/sample-palette.ps1
#
# Output: JSON on stdout — the top colour buckets (5 bits per channel), and for each of the eight fruit
# names the weight of the mark nearest to that fruit's reference colour. The caller (a human or
# `tools/brand/palette-report.mjs`) turns those numbers into `src/theme/jungle.ts`.
param(
  [string]$Path = "apps/nexus-mobile/assets/brand/jb-mark-1024.png",
  [int]$Buckets = 12
)

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$full = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $repoRoot $Path }
if (-not (Test-Path $full)) { Write-Error "not found: $full"; exit 2 }

$image = [System.Drawing.Bitmap]::FromFile($full)
try {
  $counts = @{}
  $opaque = 0
  # Every second pixel and every second row is enough for a dominant-colour count and keeps this under
  # a few seconds on a 1024 px PNG.
  for ($y = 0; $y -lt $image.Height; $y += 2) {
    for ($x = 0; $x -lt $image.Width; $x += 2) {
      $p = $image.GetPixel($x, $y)
      if ($p.A -lt 200) { continue }
      $opaque++
      $key = [int]([math]::Floor($p.R / 8)) * 1024 + [int]([math]::Floor($p.G / 8)) * 32 + [int]([math]::Floor($p.B / 8))
      if ($counts.ContainsKey($key)) { $counts[$key]++ } else { $counts[$key] = 1 }
    }
  }

  $total = 0
  foreach ($value in $counts.Values) { $total += [int]$value }
  $top = $counts.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First $Buckets
  $rows = @()
  foreach ($entry in $top) {
    $key = [int]$entry.Key
    $r = ([math]::Floor($key / 1024) * 8) + 4
    $g = ([math]::Floor(($key % 1024) / 32) * 8) + 4
    $b = (($key % 32) * 8) + 4
    $rows += [pscustomobject]@{
      hex   = ('#{0:X2}{1:X2}{2:X2}' -f [int]$r, [int]$g, [int]$b)
      r     = $r
      g     = $g
      b     = $b
      count = [int]$entry.Value
      share = [math]::Round(([double]$entry.Value / [math]::Max(1, $total)), 4)
    }
  }

  # The fruit references: what each name means, in RGB. A bucket is assigned to the nearest one so the
  # report can say how much of the mark each fruit really covers.
  $fruits = [ordered]@{
    banana       = @(247, 214, 62)
    mango        = @(255, 156, 40)
    papaya       = @(255, 122, 74)
    kiwi         = @(158, 204, 60)
    leaf         = @(52, 150, 74)
    raspberry    = @(206, 45, 74)
    blueberry    = @(86, 76, 178)
    passionfruit = @(150, 66, 176)
  }
  $weights = [ordered]@{}
  foreach ($name in $fruits.Keys) { $weights[$name] = 0 }
  $sum = 0
  foreach ($entry in $counts.GetEnumerator()) {
    $key = [int]$entry.Key
    $r = ([math]::Floor($key / 1024) * 8) + 4
    $g = ([math]::Floor(($key % 1024) / 32) * 8) + 4
    $b = (($key % 32) * 8) + 4
    $best = $null; $bestDistance = [double]::MaxValue
    foreach ($name in $fruits.Keys) {
      $ref = $fruits[$name]
      $dr = $r - $ref[0]; $dg = $g - $ref[1]; $db = $b - $ref[2]
      $distance = [math]::Sqrt($dr * $dr + $dg * $dg + $db * $db)
      if ($distance -lt $bestDistance) { $bestDistance = $distance; $best = $name }
    }
    $weights[$best] += [int]$entry.Value
    $sum += [int]$entry.Value
  }
  $fruitReport = [ordered]@{}
  foreach ($name in $fruits.Keys) {
    $fruitReport[$name] = [math]::Round(([double]$weights[$name] / [math]::Max(1, $sum)), 4)
  }

  [pscustomobject]@{
    file          = $Path
    width         = $image.Width
    height        = $image.Height
    sampledOpaque = $opaque
    buckets       = $rows
    fruits        = $fruitReport
  } | ConvertTo-Json -Depth 4
}
finally { $image.Dispose() }
