<#
.SYNOPSIS
  Validează toate imaginile din docs/ și redenumește fișierele corupte cu sufixul `.bad`.

.DESCRIPTION
  Regula care a lipsit în task-urile anterioare: nicio imagine nu ajunge în conversație înainte
  să treacă de aici. Pentru fiecare .png/.jpg/.jpeg/.webp se verifică:

    (a) antetul real — PNG: 89 50 4E 47 0D 0A 1A 0A · JPEG: FF D8 FF · WebP: „RIFF….WEBP”;
    (b) dimensiunea > 0 octeți;
    (c) decodarea completă cu System.Drawing (desenarea într-un bitmap citește toți pixelii,
        deci un PNG trunchiat nu trece).

  Fișierele care pică sunt **redenumite** cu `.bad` (nimic nu se șterge). Un fișier cu antet
  valid dar cu extensie nepotrivită (ex. JPEG numit .png) NU se redenumește: se raportează ca
  avertisment, pentru că se decodează și conversia îl poate salva.

  Capturile brute făcute cu `adb ... > fisier.png` în PowerShell sunt exact cazul tipic de eșec:
  redirectarea strecoară text în flux și strică antetul. Un astfel de fișier citit o dată ca
  imagine blochează task-ul pentru totdeauna (eroarea rămâne în istoric).

.EXAMPLE
  powershell -NoProfile -File tools/images/validate-images.ps1
  powershell -NoProfile -File tools/images/validate-images.ps1 -FailOnCorrupt
#>
[CmdletBinding()]
param(
  [string]$Path = 'docs',
  # Pentru CI: cod de ieșire 1 dacă a rămas vreun fișier corupt.
  [switch]$FailOnCorrupt,
  # Arată ce ar face, fără să redenumească.
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
# Diacriticele din etichete ies corect numai cu UTF-8 pe ambele capete.
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'ImageTools.ps1')

$target = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $root $Path }
if (-not (Test-Path -LiteralPath $target)) { throw "lipsește folderul de verificat: $target" }

# `-Include` cu `-Recurse` este capricios în PowerShell 5.1 (are nevoie de `\*`), deci filtrăm după extensie.
$images = @(Get-ChildItem -LiteralPath $target -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp)$' } |
  Sort-Object FullName)

Write-Host ("[images] verific {0} imagini în {1}" -f $images.Count, $target)
if ($images.Count -eq 0) { Write-Host '[images] nimic de verificat'; exit 0 }

$valid = New-Object System.Collections.Generic.List[object]
$corrupt = New-Object System.Collections.Generic.List[object]
$mismatched = New-Object System.Collections.Generic.List[object]
$renamed = New-Object System.Collections.Generic.List[object]

foreach ($file in $images) {
  $result = Test-ImageFile -Path $file.FullName
  if ($result.Ok) {
    $valid.Add($result)
    if ($result.Mismatch) {
      $mismatched.Add($result)
      Write-Host ("[images] ATENȚIE {0}: {1}" -f $file.FullName.Substring($root.Length).TrimStart('\'), $result.Note)
    }
    continue
  }

  $corrupt.Add($result)
  $relative = $file.FullName.Substring($root.Length).TrimStart('\')
  Write-Host ("[images] CORUPT {0} ({1:N0} octeți): {2}" -f $relative, $result.Size, $result.Why)

  $newName = $file.Name + '.bad'
  $destination = Join-Path $file.DirectoryName $newName
  # Nu suprascriem un `.bad` existent: se adaugă un marcaj de timp, ca dovada să rămână amândouă.
  if (Test-Path -LiteralPath $destination) {
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $newName = "$($file.Name).$stamp.bad"
    $destination = Join-Path $file.DirectoryName $newName
  }
  if ($DryRun) {
    Write-Host ("[images]   ar fi redenumit -> {0} (dry-run)" -f $newName)
  } else {
    Rename-Item -LiteralPath $file.FullName -NewName $newName
    Write-Host ("[images]   redenumit -> {0}" -f $newName)
  }
  $renamed.Add([pscustomobject]@{ From = $relative; To = $newName })
}

Write-Host ''
Write-Host ("[images] valide: {0} · corupte: {1} · antet nepotrivit: {2} · redenumite: {3}{4}" -f
  $valid.Count, $corrupt.Count, $mismatched.Count, $renamed.Count, $(if ($DryRun) { ' (dry-run)' } else { '' }))

if ($corrupt.Count -gt 0) {
  Write-Host '[images] fișierele corupte nu se citesc niciodată ca imagini; folosește safe-screencap.ps1 pentru capturi noi.'
}
if ($FailOnCorrupt -and $corrupt.Count -gt 0) { exit 1 }
exit 0
