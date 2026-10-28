<#
.SYNOPSIS
  Validează imaginile dintr-un folder, carantină doar ce e cu adevărat stricat și poate anula
  carantina (`-RestoreBad`).

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

  Un fișier **ocupat** (scris chiar acum de alt proces — dimensiunea se schimbă între citiri) nu
  se redenumește niciodată: un eșec tranzitoriu nu este corupție. Exact această confuzie a produs
  carantina falsă din repo: dintre cele 832 de fișiere `.bad`, 805 aveau antet PNG valid și doar
  5 chiar nu se decodează.

  `-RestoreBad` parcurge fișierele `.bad` din domeniu și le dă numele înapoi dacă se decodează
  complet și dacă numele original e liber. Un `.bad` rămas pe loc este deci o dovadă, nu o
  presupunere: ori nu se decodează, ori numele e ocupat de un fișier mai nou (caz în care se
  raportează conflictul și nu se suprascrie nimic).

  Înainte de a declara un `.bad` stricat, `-RestoreBad` încearcă `Repair-ImagePrefix`: dacă
  semnătura PNG/JPEG/WebP apare după un text strecurat în față („[Warning] Multiple displays…”),
  textul se taie și fișierul se păstrează doar dacă restul se decodează complet. E vorba de
  capturile bune produse de uneltele vechi, care merită recuperate, nu de fișiere inventate.
  Un nume cu marcaj de timp („x.png.20261020-203033.bad”) se întoarce la „x.png”, nu la numele
  intermediar cu marcaj.

  Capturile brute făcute cu `adb ... > fisier.png` în PowerShell sunt exact cazul tipic de eșec:
  redirectarea strecoară text în flux și strică antetul. Capturile noi se fac numai cu
  `scripts/capture-android-screen.ps1` (uneltele vechi sunt doar wrappere subțiri peste el).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/images/validate-images.ps1

.EXAMPLE
  # ce s-ar întâmpla, fără să se atingă niciun fișier
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/images/validate-images.ps1 -Path docs -RestoreBad -DryRun

.EXAMPLE
  # anulează carantina falsă din folderul de dovezi
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/images/validate-images.ps1 -Path docs -RestoreBad
#>
[CmdletBinding()]
param(
  [string]$Path = 'docs',
  # Pentru CI: cod de ieșire 1 dacă a rămas vreun fișier corupt.
  [switch]$FailOnCorrupt,
  # Arată ce ar face, fără să redenumească.
  [switch]$DryRun,
  # Revalidează fișierele `.bad` și le dă numele înapoi pe cele care se decodează complet.
  [switch]$RestoreBad
)
$ErrorActionPreference = 'Stop'
# Diacriticele din etichete ies corect numai cu UTF-8 pe ambele capete.
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'ImageTools.ps1')

$target = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $root $Path }
if (-not (Test-Path -LiteralPath $target)) { throw "lipsește folderul de verificat: $target" }


# Foldere care nu conțin dovezi ale noastre și care ar face scanarea inutil de lentă (node_modules
# are zeci de mii de fișiere). Profilele Chrome din planning/ sunt resturi de browser, nu capturi.
$skipPattern = '\\(node_modules|\.git|\.expo|\.gradle|\.cache|\.next|dist)\\|\\(chrome-profile[^\\]*)\\'
function Test-SkippedPath {
  param([Parameter(Mandatory = $true)][string]$FullPath)
  return ($FullPath -match $skipPattern)
}

function Get-ScopedFile {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [string]$Filter = '',
    [string[]]$Extensions = @()
  )
  return @(Get-ChildItem -LiteralPath $Directory -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { -not (Test-SkippedPath -FullPath $_.FullName) } |
    Where-Object { if ($Filter) { $_.Name -like $Filter } else { $Extensions -contains $_.Extension.ToLowerInvariant() } } |
    Sort-Object FullName)
}

function Get-RelativePath {
  param([Parameter(Mandatory = $true)][string]$FullPath)
  $base = $root.TrimEnd('\', '/')
  if ($FullPath.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $FullPath.Substring($base.Length).TrimStart('\')
  }
  # Domeniu din afara repo-ului (ex. un folder de test din %TEMP%): calea completă e mai clară
  # decât un Substring care ar arunca sau ar tăia litere la întâmplare.
  return $FullPath
}

# 1. Opțional: anularea carantinei. Se face ÎNTÂI, ca validarea de după să vadă fișierele
#    restaurate și să raporteze imaginea completă.
if ($RestoreBad) {
  $badFiles = Get-ScopedFile -Directory $target -Filter '*.bad'
  $restored = New-Object System.Collections.Generic.List[string]
  $stillBad = New-Object System.Collections.Generic.List[string]
  $conflicts = New-Object System.Collections.Generic.List[string]

  foreach ($file in $badFiles) {
    $result = Test-ImageFile -Path $file.FullName
    $relative = Get-RelativePath -FullPath $file.FullName
    if ($result.Locked) {
      $stillBad.Add($relative)
      Write-Host ("[images] OCUPAT {0}: fișierul încă se scrie; rămâne `.bad` deocamdată" -f $relative)
      continue
    }
    if ($result.Unsupported) {
      $stillBad.Add($relative)
      Write-Host ("[images] NECODIFICABIL {0}: {1}; rămâne `.bad`, dar nu e corupt" -f $relative, $result.Note)
      continue
    }
    if (-not $result.Ok) {
      # Uneltele vechi scriau captura cu redirect `>`; PowerShell strecura linia de avertizare
      # despre cele două display-uri ÎNAINTEA octeților PNG, deci antetul nu mai era la locul lui.
      # Restul fișierului e însă intact, deci se poate recupera: se taie prefixul, dar numai dacă
      # imaginea rămasă se decodează complet. Ce nu trece nici așa rămâne `.bad`, ca dovadă.
      $repair = Repair-ImagePrefix -Path $file.FullName -DryRun:$DryRun
      if (-not $repair.Ok) {
        $stillBad.Add($relative)
        Write-Host ("[images] STRICAT {0} ({1:N0} octeți): {2} · {3}" -f
          $relative, $result.Size, $result.Why, $repair.Why)
        continue
      }
      Write-Host ("[images] REPARAT {0}: {1}{2}" -f $relative, $repair.Why,
        $(if ($DryRun) { ' (dry-run: fișierul rămâne neatins)' } else { '' }))
      $result = [pscustomobject]@{
        Ok = $true; Kind = $repair.Kind; Size = ($result.Size - $repair.RemovedBytes)
        Width = $repair.Width; Height = $repair.Height; Mismatch = $false; Note = ''
      }
    }

    # `.bad` se taie de la coadă: „x.png.bad” -> „x.png”. Un nume cu marcaj de timp
    # („x.png.20261020-203033.bad”, scris când `x.png.bad` era deja ocupat) se întoarce la numele
    # adevărat, „x.png”, nu la „x.png.20261020-203033”.
    $original = $file.FullName.Substring(0, $file.FullName.Length - 4)
    if ($original -match '^(?<base>.+)\.\d{8}-\d{6}$') { $original = $Matches.base }
    if (Test-Path -LiteralPath $original) {
      $conflicts.Add($relative)
      Write-Host ("[images] CONFLICT {0}: există deja `{1}`; nu se suprascrie nimic" -f
        $relative, [System.IO.Path]::GetFileName($original))
      continue
    }

    $restored.Add($relative)
    if ($DryRun) {
      Write-Host ("[images]   ar fi restaurat -> {0} ({1}x{2}, dry-run)" -f
        [System.IO.Path]::GetFileName($original), $result.Width, $result.Height)
    } else {
      Rename-Item -LiteralPath $file.FullName -NewName ([System.IO.Path]::GetFileName($original))
      Write-Host ("[images] RESTAURAT {0} -> {1} ({2}x{3}, {4:N0} octeți){5}" -f
        $relative, [System.IO.Path]::GetFileName($original), $result.Width, $result.Height, $result.Size,
        $(if ($result.Mismatch) { " · ATENȚIE $($result.Note)" } else { '' }))
    }
  }

  Write-Host ''
  Write-Host ("[images] carantină: restaurate {0} · rămân `.bad` {1} · conflicte {2}{3}" -f
    $restored.Count, $stillBad.Count, $conflicts.Count, $(if ($DryRun) { ' (dry-run)' } else { '' }))
  Write-Host ''
}

# 2. Validarea propriu-zisă. `-Include` cu `-Recurse` este capricios în PowerShell 5.1 (are
#    nevoie de `\*`), deci filtrăm după extensie.
$images = Get-ScopedFile -Directory $target -Extensions @('.png', '.jpg', '.jpeg', '.webp')

Write-Host ("[images] verific {0} imagini în {1}" -f $images.Count, $target)
if ($images.Count -eq 0) { Write-Host '[images] nimic de verificat'; exit 0 }

$valid = New-Object System.Collections.Generic.List[object]
$corrupt = New-Object System.Collections.Generic.List[object]
$mismatched = New-Object System.Collections.Generic.List[object]
$renamed = New-Object System.Collections.Generic.List[object]
$locked = New-Object System.Collections.Generic.List[object]
$unsupported = New-Object System.Collections.Generic.List[object]

foreach ($file in $images) {
  $result = Test-ImageFile -Path $file.FullName
  $relative = Get-RelativePath -FullPath $file.FullName

  # WebP fără codec pe platformă: antetul e bun, fișierul e întreg, dar System.Drawing nu îl poate
  # desena. Verificat pe 20 oct 2026: `Image.FromFile` dă „Out of memory” pe orice `.webp`. Aici a
  # fost o greșeală reală — două `.webp` din `public/` au fost redenumite `.bad` fără motiv.
  if ($result.Unsupported) {
    $unsupported.Add($result)
    Write-Host ("[images] NECODIFICABIL {0}: {1}" -f $relative, $result.Note)
    continue
  }

  if ($result.Ok) {
    $valid.Add($result)
    if ($result.Mismatch) {
      $mismatched.Add($result)
      Write-Host ("[images] ATENȚIE {0}: {1}" -f $relative, $result.Note)
    }
    continue
  }

  # Un fișier scris acum (sau ținut deschis de indexare/antivirus) nu se carantinează.
  if ($result.Locked) {
    $locked.Add($result)
    Write-Host ("[images] OCUPAT {0}: {1}" -f $relative, $result.Why)
    continue
  }

  $corrupt.Add($result)
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
Write-Host ("[images] valide: {0} · corupte: {1} · ocupate: {2} · necodificabile: {3} · antet nepotrivit: {4} · carantinate: {5}{6}" -f
  $valid.Count, $corrupt.Count, $locked.Count, $unsupported.Count, $mismatched.Count, $renamed.Count, $(if ($DryRun) { ' (dry-run)' } else { '' }))

if ($corrupt.Count -gt 0) {
  Write-Host '[images] fișierele carantinate nu se citesc niciodată ca imagini; folosește scripts/capture-android-screen.ps1 pentru capturi noi.'
}
if ($locked.Count -gt 0) {
  Write-Host '[images] fișierele ocupate nu au fost judecate; rulează din nou când scriitorul s-a terminat.'
}
if ($unsupported.Count -gt 0) {
  Write-Host '[images] fișierele necodificabile au antet valid, dar platforma nu are codecul (WebP); nu sunt corupte.'
}
if ($FailOnCorrupt -and $corrupt.Count -gt 0) { exit 1 }
exit 0
