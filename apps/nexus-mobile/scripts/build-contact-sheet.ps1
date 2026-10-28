# Builds JUNGLE_BOOK_VERIFICATION\contact_sheet.jpg from the JPGs in final_jpg\.
#
# Why a script: the sheet is a *derived* artefact and must be reproducible from the folder itself, so the
# manifest can always be checked against the same pixels. Every cell keeps the screenshot's own 9:19.5
# proportions (a phone screen), and the file name is printed under it so a reader can find the original.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-contact-sheet.ps1
param(
  [string]$Root = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))),
  [int]$Columns = 4,
  [int]$CellWidth = 300
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$folder = Join-Path $Root 'JUNGLE_BOOK_VERIFICATION\final_jpg'
$target = Join-Path $Root 'JUNGLE_BOOK_VERIFICATION\contact_sheet.jpg'
if (-not (Test-Path -LiteralPath $folder)) { throw "lipsește folderul: $folder" }

$files = Get-ChildItem -LiteralPath $folder -Filter *.jpg | Sort-Object Name
if (-not $files.Count) { throw 'nu există nicio captură în final_jpg.' }

$cellHeight = [int]($CellWidth * 2656 / 1220)
$labelHeight = 30
$pad = 12
$rows = [int][Math]::Ceiling($files.Count / $Columns)
$width = $Columns * ($CellWidth + $pad) + $pad
$height = $rows * ($cellHeight + $labelHeight + $pad) + $pad

$sheet = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::FromArgb(16, 19, 17))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 242, 237))

try {
  $index = 0
  foreach ($file in $files) {
    $column = $index % $Columns
    $row = [int][Math]::Floor($index / $Columns)
    $x = $pad + $column * ($CellWidth + $pad)
    $y = $pad + $row * ($cellHeight + $labelHeight + $pad)
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    try {
      $graphics.DrawImage($image, $x, $y, $CellWidth, $cellHeight)
    } finally { $image.Dispose() }
    $graphics.DrawString($file.BaseName, $font, $brush, $x, ($y + $cellHeight + 6))
    $index += 1
  }
} finally {
  $font.Dispose(); $brush.Dispose(); $graphics.Dispose()
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
$parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]84)
try { $sheet.Save($target, $codec, $parameters) } finally { $sheet.Dispose() }

Write-Output "$target ($([math]::Round((Get-Item -LiteralPath $target).Length / 1KB)) KB, $($files.Count) cells)"
