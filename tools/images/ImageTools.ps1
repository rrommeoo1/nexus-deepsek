<#
.SYNOPSIS
  Funcțiile comune ale uneltei de imagini: antet real, decodare, nume plat, conversie JPEG.

.DESCRIPTION
  Un singur loc care decide dacă un fișier este imagine **validă**. Motivul există în istoricul
  proiectului: un PNG corupt (scris cu `adb ... > fisier.png` în PowerShell, care deformează
  octeții) a fost citit o dată ca imagine, iar eroarea „unsupported image” a rămas în istoricul
  conversației și a blocat definitiv task-ul. De aceea:

    - antetul se citește din primii 12 octeți, nu din extensie;
    - fișierul trebuie să aibă dimensiune > 0;
    - imaginea se decodează complet cu System.Drawing (nu doar antetul): un PNG trunchiat are
      antet bun și totuși nu se poate desena.

  Fișierul este dot-sourced de `validate-images.ps1`, `to-vision.ps1` și `safe-screencap.ps1`.
  Nu scrie și nu șterge nimic; doar citește — cu o singură excepție controlată: `Repair-ImagePrefix`
  rescrie fișierul primit, dar numai după ce s-a convins că restul lui e o imagine validă.

  `Find-ImageSignatureOffset` / `Repair-ImagePrefix` există pentru cazul care a produs carantina
  falsă: o captură cu text în față („[Warning] Multiple displays were found…”, strecurat de un
  redirect `>` în PowerShell) nu începe cu semnătura PNG, deși octeții imaginii sunt intacți.
  Un astfel de fișier se poate recupera; unul tranșat sau transcodat (UTF-16) nu.
#>

Add-Type -AssemblyName System.Drawing

function Get-ImageHeaderInfo {
  <#
    Întoarce antetul real: Kind (png/jpeg/webp/unknown), Hex și Size. Citește maximum 12 octeți,
    deci merge și pe fișiere de 100 MB fără să le încarce în memorie.
  #>
  param([Parameter(Mandatory = $true)][string]$Path)

  $size = 0
  try { $size = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch { return [pscustomobject]@{ Kind = 'missing'; Hex = ''; Size = 0 } }

  $read = 0
  $bytes = New-Object byte[] 12
  if ($size -gt 0) {
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try { $read = $stream.Read($bytes, 0, 12) } finally { $stream.Dispose() }
  }

  $hex = ''
  if ($read -gt 0) { $hex = (($bytes[0..($read - 1)]) | ForEach-Object { $_.ToString('X2') }) -join ' ' }

  $kind = 'unknown'
  if ($read -ge 8 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47 -and
      $bytes[4] -eq 0x0D -and $bytes[5] -eq 0x0A -and $bytes[6] -eq 0x1A -and $bytes[7] -eq 0x0A) {
    $kind = 'png'
  } elseif ($read -ge 3 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8 -and $bytes[2] -eq 0xFF) {
    $kind = 'jpeg'
  } elseif ($read -ge 12 -and
            $bytes[0] -eq 0x52 -and $bytes[1] -eq 0x49 -and $bytes[2] -eq 0x46 -and $bytes[3] -eq 0x46 -and
            $bytes[8] -eq 0x57 -and $bytes[9] -eq 0x45 -and $bytes[10] -eq 0x42 -and $bytes[11] -eq 0x50) {
    $kind = 'webp'
  }

  return [pscustomobject]@{ Kind = $kind; Hex = $hex; Size = $size }
}

function Test-ImageFile {
  <#
    Verificarea completă cerută de reguli: antet real + dimensiune > 0 + decodare System.Drawing.
    Întoarce un obiect cu Ok, Kind, Size, Width, Height, Decoded, Locked, Attempts, Why și Mismatch.
    Mismatch = antet valid, dar de alt tip decât extensia (ex. JPEG numit .png): nu e corupt,
    conversia îl acceptă, dar se raportează ca să nu ascundem o captură greșită.
    Locked = fișierul se schimba sub noi în timpul citirii; NU este corupție, deci apelanții nu au
    voie să îl redenumească sau să îl șteargă pe baza lui.
    Unsupported = antet valid, dar platforma nu are codecul (WebP pe Windows fără extensie): la fel,
    nu e corupție și nu se carantinează.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    # Un fișier scris chiar în clipa citirii eșuează exact ca unul trunchiat. Diferența o dă
    # dimensiunea: dacă s-a schimbat între citiri, scriitorul lucra încă. Atunci se reîncearcă
    # o dată, iar dacă tot nu se decodează fișierul se raportează ca „blocat”, nu ca „corupt”.
    [int]$RetryDelayMs = 150
  )

  $reason = New-Object System.Collections.Generic.List[string]
  $note = New-Object System.Collections.Generic.List[string]
  $header = Get-ImageHeaderInfo -Path $Path
  $extension = ([System.IO.Path]::GetExtension($Path)).ToLowerInvariant().TrimStart('.')
  $expected = switch ($extension) {
    'png' { 'png' }
    'jpg' { 'jpeg' }
    'jpeg' { 'jpeg' }
    'webp' { 'webp' }
    default { '' }
  }

  $mismatch = $false
  if ($header.Size -le 0) { $reason.Add('fișier gol (0 octeți)') }
  if ($header.Kind -eq 'missing') { $reason.Add('fișier lipsă') }
  elseif ($header.Kind -eq 'unknown') { $reason.Add("antet necunoscut ($($header.Hex))") }
  elseif ($expected -and $header.Kind -ne $expected) {
    # Nu e corupt: antetul e valid, doar extensia minte. Conversia îl acceptă; se raportează.
    $mismatch = $true
    $note.Add("antet $($header.Kind) într-un fișier .$extension")
  }

  $width = 0
  $height = 0
  $decoded = $false
  $locked = $false
  $unsupported = $false
  $attempts = 0
  while ($reason.Count -eq 0 -and $attempts -lt 2) {
    $attempts++
    $sizeBefore = -1
    try { $sizeBefore = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch { $sizeBefore = -1 }
    try {
      $stream = [System.IO.File]::OpenRead($Path)
      try {
        # validateImageData = true: System.Drawing verifică și datele, nu doar semnătura.
        $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
        try {
          $width = $image.Width
          $height = $image.Height
          if ($width -le 0 -or $height -le 0) { $reason.Add('dimensiuni zero') }
          else {
            # Decodare completă: desenarea într-un bitmap forțează citirea tuturor pixelilor.
            # Un PNG trunchiat trece de antet și eșuează aici, exact cazul care a blocat task-ul.
            $bitmap = New-Object System.Drawing.Bitmap($width, $height)
            try {
              $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
              try { $graphics.DrawImage($image, 0, 0, $width, $height) } finally { $graphics.Dispose() }
            } finally { $bitmap.Dispose() }
            $decoded = $true
          }
        } finally { $image.Dispose() }
      } finally { $stream.Dispose() }
    } catch {
      if ($header.Kind -eq 'webp') {
        # Windows fără codec WebP: fișierul poate fi bun, dar System.Drawing nu îl poate desena.
        # Nu îl declarăm corupt (nu îl redenumim), dar nici nu îl trimitem la conversie.
        $note.Add("decodare WebP indisponibilă: $($_.Exception.Message)")
        $unsupported = $true
        break
      }
      # Fișier în curs de scriere: dimensiunea se mișcă sub noi. Nu e corupție, e o cursă.
      $sizeAfter = -1
      try { $sizeAfter = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch { $sizeAfter = -1 }
      if ($sizeAfter -ne $sizeBefore) { $locked = $true; Start-Sleep -Milliseconds $RetryDelayMs; continue }
      if ($attempts -lt 2) { Start-Sleep -Milliseconds $RetryDelayMs; continue }
      $reason.Add("decodare eșuată: $($_.Exception.Message)")
    }
  }
  # Bucla iese și fără motiv scris când s-au terminat încercările pe un fișier care încă se scrie.
  # Fără linia asta, un `.bad` scris acum ar putea trece drept valid. Un WebP fără codec nu
  # primește motiv de corupție: nu e stricat, doar nu poate fi desenat aici.
  if (-not $decoded -and -not $unsupported -and $reason.Count -eq 0) {
    if ($locked) { $reason.Add('fișier în curs de scriere (dimensiunea s-a schimbat în timpul citirii): nu se declară corupt, se reîncearcă mai târziu') }
    else { $reason.Add('decodarea nu a produs nicio dimensiune validă') }
  }

  $ok = ($reason.Count -eq 0 -and -not $unsupported)

  return [pscustomobject]@{
    Path        = $Path
    Ok          = $ok
    Kind        = $header.Kind
    Extension   = $extension
    Size        = $header.Size
    Width       = $width
    Height      = $height
    Decoded     = $decoded
    Locked      = $locked
    Unsupported = $unsupported
    Attempts    = $attempts
    Mismatch    = $mismatch
    Why         = ($reason -join '; ')
    Note        = ($note -join '; ')
  }
}

function Find-ImageSignatureOffset {
  <#
    Caută semnătura reală a unei imagini în interiorul primilor octeți ai unui fișier și întoarce
    @{ Kind; Offset } sau $null. Motivul e concret: capturile făcute cu `adb ... > fisier.png` în
    PowerShell (sau cu un redirect `>` în loc de `-OutFile`) au în față linia
    `[Warning] Multiple displays were found, but no display...`, iar octeții imaginii sunt intacți
    după ea. Offset 0 înseamnă că fișierul e deja curat.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$MaxPrefixBytes = 8192
  )

  $signatures = @(
    @{ Kind = 'png'; Bytes = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) },
    @{ Kind = 'jpeg'; Bytes = [byte[]](0xFF, 0xD8, 0xFF) },
    @{ Kind = 'webp'; Bytes = [byte[]](0x52, 0x49, 0x46, 0x46) }
  )

  $size = 0
  try { $size = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch { return $null }
  if ($size -le 0) { return $null }

  $take = [int][Math]::Min($size, [long]($MaxPrefixBytes + 12))
  $head = New-Object byte[] $take
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try { [void]$stream.Read($head, 0, $take) } finally { $stream.Dispose() }

  $best = $null
  foreach ($signature in $signatures) {
    $needle = $signature.Bytes
    $start = 0
    while ($true) {
      $index = [System.Array]::IndexOf($head, $needle[0], $start)
      if ($index -lt 0 -or ($index + $needle.Length) -gt $head.Length) { break }
      $hit = $true
      for ($i = 1; $i -lt $needle.Length; $i++) { if ($head[$index + $i] -ne $needle[$i]) { $hit = $false; break } }
      # „RIFF” apare și în text; un WebP adevărat are „WEBP” la offset +8.
      if ($hit -and $signature.Kind -eq 'webp') {
        if (($index + 12) -gt $head.Length) { $hit = $false }
        elseif (-not ($head[$index + 8] -eq 0x57 -and $head[$index + 9] -eq 0x45 -and $head[$index + 10] -eq 0x42 -and $head[$index + 11] -eq 0x50)) { $hit = $false }
      }
      if ($hit) {
        if (-not $best -or $index -lt $best.Offset) { $best = [pscustomobject]@{ Kind = $signature.Kind; Offset = $index } }
        break
      }
      $start = $index + 1
    }
  }
  return $best
}

function Repair-ImagePrefix {
  <#
    Taie textul strecurat înaintea imaginii și scrie fișierul curat — dar numai dacă restul se
    decodează complet. Nu inventează nimic: dacă după tăiere imaginea tot nu se desenează,
    fișierul rămâne neatins și întoarce Ok = $false. Așa se recuperează capturile bune făcute de
    uneltele vechi, fără să atingem ce e cu adevărat stricat.

    Ok = restul fișierului e o imagine validă; Changed = s-a și scris ceva pe disc. Cu -DryRun
    se verifică pe un fișier temporar care e șters imediat, deci pe disc nu se schimbă nimic.
    -KeepPrefix păstrează textul eliminat în `<nume>.prefix.txt`, ca dovadă.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$DryRun,
    [switch]$KeepPrefix,
    [int]$MaxPrefixBytes = 8192
  )

  $report = [pscustomobject]@{
    Path = $Path; Ok = $false; Changed = $false; Kind = ''; Offset = 0
    RemovedBytes = 0; Width = 0; Height = 0; Why = ''
  }

  $found = Find-ImageSignatureOffset -Path $Path -MaxPrefixBytes $MaxPrefixBytes
  if (-not $found) { $report.Why = 'nicio semnătură de imagine în primii octeți'; return $report }
  $report.Kind = $found.Kind
  $report.Offset = $found.Offset
  if ($found.Offset -eq 0) { $report.Why = 'fișierul începe deja cu semnătura imaginii'; return $report }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $cleanLength = $bytes.Length - $found.Offset
  if ($cleanLength -le 0) { $report.Why = 'după prefix nu rămâne niciun octet'; return $report }

  $clean = New-Object byte[] $cleanLength
  [System.Array]::Copy($bytes, $found.Offset, $clean, 0, $cleanLength)
  # Extensia temporarului trebuie să fie cea a conținutului, altfel Test-ImageFile raportează
  # „antet nepotrivit” și un fișier bun ar părea suspect.
  $tempPath = "$Path.clean.$($found.Kind)"
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
  [System.IO.File]::WriteAllBytes($tempPath, $clean)

  $check = Test-ImageFile -Path $tempPath
  if (-not $check.Ok) {
    Remove-Item -LiteralPath $tempPath -Force
    $report.Why = "prefix de $($found.Offset) octeți, dar restul tot nu se decodează: $($check.Why)"
    return $report
  }

  $report.Ok = $true
  $report.Width = $check.Width
  $report.Height = $check.Height
  $report.RemovedBytes = $found.Offset
  $report.Why = "prefix de $($found.Offset) octeți eliminat; imagine $($check.Width)x$($check.Height)"

  if ($DryRun) {
    Remove-Item -LiteralPath $tempPath -Force
    return $report
  }

  if ($KeepPrefix) {
    [System.IO.File]::WriteAllBytes("$Path.prefix.txt", $bytes[0..($found.Offset - 1)])
  }
  Move-Item -LiteralPath $tempPath -Destination $Path -Force
  $report.Changed = $true
  return $report
}

function Get-VisionName {
  <#
    Nume plat, fără subfoldere: „docs/parity-report/feed/native-x.png” -> „parity-report__feed__native-x.jpg”.
    Numele plat e obligatoriu pentru docs/vision/: un nume care conține calea ar putea fi confundat
    cu un fișier brut, iar uneltele viitoare trebuie să poată spune dintr-o privire de unde vine.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$FullPath
  )

  $base = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/')
  $full = [System.IO.Path]::GetFullPath($FullPath)
  $relative = $full
  if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    $relative = $full.Substring($base.Length).TrimStart('\', '/')
  }
  # ChangeExtension(..., $null) lasă punctul final pe .NET Framework (rezultat: „nume..jpg”),
  # deci extensia se taie manual.
  $extension = [System.IO.Path]::GetExtension($relative)
  $withoutExtension = if ($extension) { $relative.Substring(0, $relative.Length - $extension.Length) } else { $relative }
  $flat = ($withoutExtension -replace '[\\/]+', '__')
  return ($flat + '.jpg')
}

function Save-VisionJpeg {
  <#
    Scrie un JPEG cu lățimea maximă cerută (proporțional), pe fundal alb (JPEG nu are alfa).
    Întoarce dimensiunile finale, ca apelantul să poată raporta ce a scris.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$MaxWidth = 900,
    [int]$Quality = 82
  )

  $folder = [System.IO.Path]::GetDirectoryName($Destination)
  if ($folder -and -not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
    try {
      $sourceWidth = $image.Width
      $sourceHeight = $image.Height
      $width = [Math]::Min($MaxWidth, $sourceWidth)
      $height = [int][Math]::Round($sourceHeight * ($width / $sourceWidth))
      if ($height -lt 1) { $height = 1 }

      $canvas = New-Object System.Drawing.Bitmap($width, $height)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([System.Drawing.Color]::White)
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.DrawImage($image, 0, 0, $width, $height)
        } finally { $graphics.Dispose() }

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        if (-not $codec) { throw 'codecul JPEG lipsește din System.Drawing' }
        $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
        # Scriere prin stream, nu direct pe cale: dacă fișierul există deja, Save aruncă
        # „A generic error occurred in GDI+” pe Windows când calea e blocată de un cititor.
        $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
        try { $canvas.Save($output, $codec, $parameters) } finally { $output.Dispose() }
        $parameters.Dispose()
      } finally { $canvas.Dispose() }

      return [pscustomobject]@{ Path = $Destination; Width = $width; Height = $height; SourceWidth = $sourceWidth; SourceHeight = $sourceHeight }
    } finally { $image.Dispose() }
  } finally { $stream.Dispose() }
}
