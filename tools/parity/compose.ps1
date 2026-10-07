<#
.SYNOPSIS
  compune un „web | nativ" lateral, JPEG, cel mult 1500 px înălțime, pentru un ecran.

.DESCRIPTION
  Ia perechile docs/web-ref/<ecran>/<stare>.png (web, 469x1021 CSS px) și
  docs/parity-report/<ecran>/native-<stare>.png (nativ, 1220x2656 px) și scrie
  docs/parity-report/<ecran>/web-vs-native-<stare>.jpg, cu ambele la aceeași înălțime de 1500 px.
  Se folosește System.Drawing (Windows), deci nu e nevoie de nicio dependență nouă.

.EXAMPLE
  powershell -NoProfile -File tools/parity/compose.ps1 -Area messages
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Area,
  [int]$Height = 1500,
  [string]$Out = 'docs/parity-report'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$webDir = Join-Path $root "docs\web-ref\$Area"
$nativeDir = Join-Path $root (Join-Path $Out $Area)
if (-not (Test-Path $webDir)) { throw "nu există capturi web pentru $Area ($webDir)" }
if (-not (Test-Path $nativeDir)) { throw "nu există capturi native pentru $Area ($nativeDir)" }

$written = 0
foreach ($nativeFile in Get-ChildItem $nativeDir -Filter 'native-*.png') {
  $state = $nativeFile.BaseName -replace '^native-', ''
  $webFile = Join-Path $webDir "$state.png"
  if (-not (Test-Path $webFile)) { Write-Warning "[parity] $Area/${state}: lipsește captura web ($state.png)"; continue }

  $left = [System.Drawing.Image]::FromFile($webFile)
  $right = [System.Drawing.Image]::FromFile($nativeFile.FullName)
  try {
    $scaleLeft = $Height / $left.Height
    $scaleRight = $Height / $right.Height
    $leftWidth = [int]($left.Width * $scaleLeft)
    $rightWidth = [int]($right.Width * $scaleRight)
    $canvas = New-Object System.Drawing.Bitmap ($leftWidth + $rightWidth + 8), $Height
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.Clear([System.Drawing.Color]::Black)
      $graphics.DrawImage($left, 0, 0, $leftWidth, $Height)
      $graphics.DrawImage($right, $leftWidth + 8, 0, $rightWidth, $Height)
      $target = Join-Path $nativeDir "web-vs-native-$state.jpg"
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82
      $canvas.Save($target, $codec, $parameters)
      Write-Host "[parity] $Area/$state -> $(Split-Path $target -Leaf) ($($leftWidth + 8 + $rightWidth)x$Height)"
      $written++
    } finally { $graphics.Dispose(); $canvas.Dispose() }
  } finally { $left.Dispose(); $right.Dispose() }
}
Write-Host "[parity] $written compozit(e) scrise în $Out\$Area"
