<#
.SYNOPSIS
  Converteste fiecare imagine VALIDA din docs/ intr-un JPEG de maximum 900 px latime, in docs/vision/.

.DESCRIPTION
  docs/vision/ este singurul loc din care se citesc imagini in conversatie. Numele sunt plate
  (fara subfoldere), derivate din calea sursei: `docs/parity-report/feed/x.png` devine
  `parity-report__feed__x.jpg`. Asa se vede dintr-o privire de unde vine fisierul, fara sa fie
  nevoie de folderul brut (care este in .clineignore).

  Fiecare imagine trece prin Test-ImageFile (antet real + dimensiune + decodare completa).
  Ce pica este sarit si raportat, niciodata convertit „ca sa fie”. Ieșirea este verificata la
  randul ei cu acelasi test; daca JPEG-ul scris nu se decodeaza, este sters si scriptul iese cu
  eroare, pentru ca un fisier rau in docs/vision/ ar fi exact capcana pe care o evitam.

  Scriptul nu sterge nimic din sursa si nu atinge fisierele `.bad`.

.EXAMPLE
  powershell -NoProfile -File tools/images/to-vision.ps1
  powershell -NoProfile -File tools/images/to-vision.ps1 -Filter profile-header
#>
[CmdletBinding()]
param(
  [string]$Source = 'docs',
  [string]$Out = 'docs/vision',
  [int]$MaxWidth = 900,
  [int]$Quality = 82,
  # Doar fisierele a caror cale contine textul dat (ex. „profile-header”).
  [string]$Filter = '',
  # Nu rescrie un JPEG care exista deja.
  [switch]$SkipExisting
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'ImageTools.ps1')

function Resolve-RepoPath {
  param([string]$Value)
  if ([System.IO.Path]::IsPathRooted($Value)) { return $Value }
  return (Join-Path $root $Value)
}

$sourceDir = Resolve-RepoPath -Value $Source
$visionDir = Resolve-RepoPath -Value $Out
if (-not (Test-Path -LiteralPath $sourceDir)) { throw "lipsește sursa: $sourceDir" }
if (-not (Test-Path -LiteralPath $visionDir)) { New-Item -ItemType Directory -Force -Path $visionDir | Out-Null }

$sourceFull = [System.IO.Path]::GetFullPath($sourceDir).TrimEnd('\', '/')
$visionFull = [System.IO.Path]::GetFullPath($visionDir).TrimEnd('\', '/')

$images = @(Get-ChildItem -LiteralPath $sourceDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp)$' } |
  Where-Object { -not $_.FullName.StartsWith($visionFull, [System.StringComparison]::OrdinalIgnoreCase) } |
  Where-Object { -not $Filter -or $_.FullName.IndexOf($Filter, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } |
  Sort-Object FullName)

Write-Host ("[vision] {0} imagini candidate din {1} -> {2} (max {3} px lățime)" -f $images.Count, $sourceDir, $visionDir, $MaxWidth)
if ($images.Count -eq 0) { Write-Host '[vision] nimic de convertit'; exit 0 }

$written = New-Object System.Collections.Generic.List[object]
$skipped = New-Object System.Collections.Generic.List[object]
$usedNames = @{}
$totalBytes = 0
$errors = 0

foreach ($file in $images) {
  $check = Test-ImageFile -Path $file.FullName
  $relative = $file.FullName.Substring($root.Length).TrimStart('\')

  if (-not $check.Ok) {
    $skipped.Add([pscustomobject]@{ Path = $relative; Why = $check.Why })
    Write-Host ("[vision] SĂRIT {0}: {1}" -f $relative, $check.Why)
    continue
  }
  if (-not $check.Decoded) {
    $skipped.Add([pscustomobject]@{ Path = $relative; Why = $check.Note })
    Write-Host ("[vision] SĂRIT {0}: {1}" -f $relative, $check.Note)
    continue
  }

  $flat = Get-VisionName -BasePath $sourceDir -FullPath $file.FullName
  if ($usedNames.ContainsKey($flat.ToLowerInvariant())) {
    # Doua fisiere cu aceeasi cale relativa nu pot exista; coliziunea vine din nume care difera
    # doar prin separatori. Se numeroteaza, ca sa nu se suprascrie o conversie valida.
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($flat)
    $index = 2
    while ($usedNames.ContainsKey((("$stem-$index.jpg").ToLowerInvariant()))) { $index++ }
    $flat = "$stem-$index.jpg"
  }
  $usedNames[$flat.ToLowerInvariant()] = $true
  $destination = Join-Path $visionDir $flat

  if ($SkipExisting -and (Test-Path -LiteralPath $destination)) {
    $written.Add([pscustomobject]@{ Path = $flat; Width = 0; Height = 0; Skipped = $true })
    Write-Host ("[vision] există deja, sărit: {0}" -f $flat)
    continue
  }

  try {
    $saved = Save-VisionJpeg -Path $file.FullName -Destination $destination -MaxWidth $MaxWidth -Quality $Quality
    # Auto-verificare: JPEG-ul scris trebuie sa treaca exact testul pe care il cerem cititorilor.
    $proof = Test-ImageFile -Path $destination
    if (-not $proof.Ok) { throw "JPEG scris invalid: $($proof.Why)" }
    $size = (Get-Item -LiteralPath $destination).Length
    $totalBytes += $size
    $written.Add([pscustomobject]@{ Path = $flat; Width = $saved.Width; Height = $saved.Height; SourceWidth = $saved.SourceWidth; SourceHeight = $saved.SourceHeight; Bytes = $size })
    Write-Host ("[vision] {0} -> {1} ({2}x{3}, {4:N0} octeți)" -f $relative, $flat, $saved.Width, $saved.Height, $size)
  } catch {
    # Un JPEG pe jumatate scris este mai periculos decat lipsa lui: se scoate imediat.
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
    $errors++
    $skipped.Add([pscustomobject]@{ Path = $relative; Why = $_.Exception.Message })
    Write-Host ("[vision] EROARE {0}: {1}" -f $relative, $_.Exception.Message)
  }
}

Write-Host ''
Write-Host ("[vision] scrise: {0} · sărite: {1} · total {2:N1} MB în {3}" -f $written.Count, $skipped.Count, ($totalBytes / 1MB), $visionDir)
if ($skipped.Count -gt 0) {
  Write-Host '[vision] ce a fost sărit nu se citește ca imagine (vezi motivele de mai sus).'
}
if ($errors -gt 0) { exit 1 }
exit 0
