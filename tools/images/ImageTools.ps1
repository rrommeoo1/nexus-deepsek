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
  Nu scrie și nu șterge nimic; doar citește.
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
    Întoarce un obiect cu Ok, Kind, Size, Width, Height, Decoded, Why și Mismatch.
    Mismatch = antet valid, dar de alt tip decât extensia (ex. JPEG numit .png): nu e corupt,
    conversia îl acceptă, dar se raportează ca să nu ascundem o captură greșită.
  #>
  param([Parameter(Mandatory = $true)][string]$Path)

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
  if ($reason.Count -eq 0) {
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
      } else {
        $reason.Add("decodare eșuată: $($_.Exception.Message)")
      }
    }
  }

  $ok = ($reason.Count -eq 0)
  return [pscustomobject]@{
    Path      = $Path
    Ok        = $ok
    Kind      = $header.Kind
    Extension = $extension
    Size      = $header.Size
    Width     = $width
    Height    = $height
    Decoded   = $decoded
    Mismatch  = $mismatch
    Why       = ($reason -join '; ')
    Note      = ($note -join '; ')
  }
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
