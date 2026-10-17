# Generates every Jungle Book brand asset from the single source photograph.
#
# The source is a JPEG of the letters J and B made of tropical fruit on a dark green field.
# It needs no image library beyond System.Drawing, which ships with Windows PowerShell, so the
# pipeline stays free and reproducible on this machine.
#
#   1. samples the four corners to learn the background colour of the picture;
#   2. finds the bounding box of everything that differs from it by more than -Threshold;
#   3. grows that box by -MarginPercent, squares it around the letters and crops;
#   4. writes every size the app and Android need, then measures what it wrote.
#
# It prints one JSON object on stdout; tools/brand/make-assets.mjs checks the numbers.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$MarginPercent = 6,
  [int]$Threshold = 46,
  [int]$SampleStep = 2
)

$ErrorActionPreference = 'Stop'
trap {
  Write-Host ("make-assets.ps1 failed at line {0}: {1}" -f $_.InvocationInfo.ScriptLineNumber, $_.Exception.Message)
  exit 1
}
Add-Type -AssemblyName System.Drawing
$square = $null

function Get-PatchColor {
  param([System.Drawing.Bitmap]$Bitmap, [int]$X, [int]$Y, [int]$Size)
  $r = 0; $g = 0; $b = 0; $n = 0
  # `px`/`py`, not `x`/`y`: PowerShell would treat `$x` as the same variable as `$X` above.
  for ($py = $Y; $py -lt ($Y + $Size); $py++) {
    for ($px = $X; $px -lt ($X + $Size); $px++) {
      $c = $Bitmap.GetPixel($px, $py)
      $r += $c.R; $g += $c.G; $b += $c.B; $n++
    }
  }
  return [pscustomobject]@{ r = [int]($r / $n); g = [int]($g / $n); b = [int]($b / $n) }
}

function New-Canvas {
  param([int]$Width, [int]$Height, [System.Drawing.Color]$Background)
  $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($Background)
  return @($bmp, $g)
}

function Save-Png {
  param([System.Drawing.Bitmap]$Bitmap, [System.Drawing.Graphics]$Graphics, [string]$Path)
  $Graphics.Dispose()
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bitmap.Dispose()
}

$src = [System.Drawing.Bitmap]::FromFile($Source)
try {
  $w = $src.Width; $h = $src.Height
  $patch = [int][math]::Max(12, [math]::Min($w, $h) / 40)

  # 1. the background, learned from the corners rather than assumed.
  #    Each corner is a PSCustomObject: a returned @(r,g,b) would be flattened into the outer array.
  $corners = @(
    (Get-PatchColor -Bitmap $src -X 0 -Y 0 -Size $patch),
    (Get-PatchColor -Bitmap $src -X ($w - $patch) -Y 0 -Size $patch),
    (Get-PatchColor -Bitmap $src -X 0 -Y ($h - $patch) -Size $patch),
    (Get-PatchColor -Bitmap $src -X ($w - $patch) -Y ($h - $patch) -Size $patch)
  )
  $bgR = [int](($corners | Measure-Object -Property r -Average).Average)
  $bgG = [int](($corners | Measure-Object -Property g -Average).Average)
  $bgB = [int](($corners | Measure-Object -Property b -Average).Average)
  $cornerSpread = 0
  foreach ($corner in $corners) {
    $spread = [math]::Sqrt([math]::Pow($corner.r - $bgR, 2) + [math]::Pow($corner.g - $bgG, 2) + [math]::Pow($corner.b - $bgB, 2))
    if ($spread -gt $cornerSpread) { $cornerSpread = [int]$spread }
  }

  # 2. the letters: every sampled pixel further than -Threshold from the background.
  #    One LockBits read (not a GetPixel per pixel) — the whole scan takes a fraction of a second.
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $locked = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  try {
    $stride = $locked.Stride
    $pixels = New-Object byte[] ($stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $pixels, 0, $pixels.Length)
  } finally {
    $src.UnlockBits($locked)
  }
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  $thresholdSquared = $Threshold * $Threshold
  for ($py = 0; $py -lt $h; $py += $SampleStep) {
    $row = $py * $stride
    for ($px = 0; $px -lt $w; $px += $SampleStep) {
      $i = $row + $px * 3
      $dr = $pixels[$i + 2] - $bgR; $dg = $pixels[$i + 1] - $bgG; $db = $pixels[$i] - $bgB
      if (($dr * $dr + $dg * $dg + $db * $db) -gt $thresholdSquared) {
        if ($px -lt $minX) { $minX = $px }
        if ($px -gt $maxX) { $maxX = $px }
        if ($py -lt $minY) { $minY = $py }
        if ($py -gt $maxY) { $maxY = $py }
      }
    }
  }
  if ($maxX -lt 0) { throw 'No pixel differs from the background colour; the source cannot be cropped.' }

  # 3. the square around the letters, with a margin so the fruit is not cut by the edge.
  $boxW = $maxX - $minX + 1; $boxH = $maxY - $minY + 1
  $margin = [int][math]::Round([math]::Max($boxW, $boxH) * $MarginPercent / 100)
  $side = [int][math]::Min([math]::Max($boxW, $boxH) + 2 * $margin, [math]::Min($w, $h))
  $centerX = ($minX + $maxX) / 2; $centerY = ($minY + $maxY) / 2
  $cropX = [int][math]::Round($centerX - $side / 2); $cropY = [int][math]::Round($centerY - $side / 2)
  $cropX = [int][math]::Max(0, [math]::Min($cropX, $w - $side))
  $cropY = [int][math]::Max(0, [math]::Min($cropY, $h - $side))

  $square = New-Object System.Drawing.Bitmap($side, $side, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $sg = [System.Drawing.Graphics]::FromImage($square)
  $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $sg.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $side, $side)), (New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)), [System.Drawing.GraphicsUnit]::Pixel)
  $sg.Dispose()

  if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
  $backgroundColor = [System.Drawing.Color]::FromArgb(255, $bgR, $bgG, $bgB)

  $pair = New-Canvas -Width 1024 -Height 1024 -Background $backgroundColor
  $pair[1].DrawImage($square, 0, 0, 1024, 1024)
  Save-Png -Bitmap $pair[0] -Graphics $pair[1] -Path (Join-Path $OutDir 'jb-logo-1024.png')

  # 4. the circular mark, for the middle button of the bottom bar and for the drawer.
  $circle = New-Canvas -Width 256 -Height 256 -Background ([System.Drawing.Color]::Transparent)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, 256, 256)
  $circle[1].SetClip($path)
  $circle[1].DrawImage($square, 0, 0, 256, 256)
  $circle[1].ResetClip()
  Save-Png -Bitmap $circle[0] -Graphics $circle[1] -Path (Join-Path $OutDir 'jb-logo-circle-256.png')

  # 5. the header lockup: 36 dp tall, exported at 1x, 2x and 3x.
  # 5. the header lockup: 36 dp tall, exported at 1x, 2x and 3x, on the field (no bleed at the edges).
  foreach ($scale in 1, 2, 3) {
    $size = 36 * $scale
    $pair = New-Canvas -Width $size -Height $size -Background $backgroundColor
    $pair[1].DrawImage($square, 0, 0, $size, $size)
    Save-Png -Bitmap $pair[0] -Graphics $pair[1] -Path (Join-Path $OutDir ("jb-logo-header-{0}x.png" -f $scale))
  }

  # 6. the adaptive icon: the letters stay inside the 66% safe zone, the field fills the rest.
  $foreground = New-Canvas -Width 1024 -Height 1024 -Background ([System.Drawing.Color]::Transparent)
  $inner = [int][math]::Round(1024 * 0.66)
  $offset = [int]([math]::Round((1024 - $inner) / 2))
  $foreground[1].DrawImage($square, $offset, $offset, $inner, $inner)
  Save-Png -Bitmap $foreground[0] -Graphics $foreground[1] -Path (Join-Path $OutDir 'jb-icon-foreground-1024.png')

  $background = New-Canvas -Width 1024 -Height 1024 -Background $backgroundColor
  Save-Png -Bitmap $background[0] -Graphics $background[1] -Path (Join-Path $OutDir 'jb-icon-background-1024.png')

  $legacy = New-Canvas -Width 1024 -Height 1024 -Background $backgroundColor
  $legacy[1].DrawImage($square, 0, 0, 1024, 1024)
  Save-Png -Bitmap $legacy[0] -Graphics $legacy[1] -Path (Join-Path $OutDir 'jb-icon-1024.png')

  # 7. the monochrome layer Android tints: the letters as a silhouette on transparency.
  #    512 px is plenty for a layer the launcher draws at 108 dp, and one LockBits pass keeps it fast.
  $monoSize = 512
  $scaled = New-Object System.Drawing.Bitmap($monoSize, $monoSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $mg = [System.Drawing.Graphics]::FromImage($scaled)
  $mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $mg.DrawImage($square, 0, 0, $monoSize, $monoSize)
  $mg.Dispose()

  $monoRect = New-Object System.Drawing.Rectangle(0, 0, $monoSize, $monoSize)
  $sr = $scaled.LockBits($monoRect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $sStride = $sr.Stride
  $srcBytes = New-Object byte[] ($sStride * $monoSize)
  [System.Runtime.InteropServices.Marshal]::Copy($sr.Scan0, $srcBytes, 0, $srcBytes.Length)
  $scaled.UnlockBits($sr)

  $mono = New-Object System.Drawing.Bitmap($monoSize, $monoSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $mr = $mono.LockBits($monoRect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $mStride = $mr.Stride
  $outBytes = New-Object byte[] ($mStride * $monoSize)
  for ($my = 0; $my -lt $monoSize; $my++) {
    $sRow = $my * $sStride
    $mRow = $my * $mStride
    for ($mx = 0; $mx -lt $monoSize; $mx++) {
      $si = $sRow + $mx * 3
      $dr = $srcBytes[$si + 2] - $bgR; $dg = $srcBytes[$si + 1] - $bgG; $db = $srcBytes[$si] - $bgB
      $d = [math]::Sqrt($dr * $dr + $dg * $dg + $db * $db)
      # A JPEG field carries a little noise; anything closer than 24 to it is not ink.
      if ($d -le 24) { $alpha = 0 } else { $alpha = [int][math]::Min(255, [math]::Round(($d - 24) / 96 * 255)) }
      if ($alpha -gt 0) {
        $di = $mRow + $mx * 4
        $outBytes[$di] = 255; $outBytes[$di + 1] = 255; $outBytes[$di + 2] = 255; $outBytes[$di + 3] = $alpha
      }
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($outBytes, 0, $mr.Scan0, $outBytes.Length)
  $mono.UnlockBits($mr)
  # The file keeps the 1024 px contract of app.json's monochromeImage, scaled up from the 512 pass.
  $monoFull = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $mfg = [System.Drawing.Graphics]::FromImage($monoFull)
  $mfg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $mfg.DrawImage($mono, 0, 0, 1024, 1024)
  $mfg.Dispose()
  $mono.Dispose()
  $scaled.Dispose()
  $monoFull.Save((Join-Path $OutDir 'jb-icon-monochrome-1024.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $monoFull.Dispose()

  # 8. the launch screen: the mark centred on the field, on a portrait canvas.
  $splash = New-Canvas -Width 1080 -Height 1920 -Background $backgroundColor
  $splashSize = 560
  $splash[1].DrawImage($square, [int]((1080 - $splashSize) / 2), [int]((1920 - $splashSize) / 2), $splashSize, $splashSize)
  Save-Png -Bitmap $splash[0] -Graphics $splash[1] -Path (Join-Path $OutDir 'jb-splash-1080x1920.png')

  # 9. measure what was written, so the Node entry can refuse a wrong file.
  $measured = @()
  foreach ($name in @('jb-logo-1024.png', 'jb-logo-circle-256.png', 'jb-logo-header-1x.png',
      'jb-logo-header-2x.png', 'jb-logo-header-3x.png', 'jb-icon-foreground-1024.png',
      'jb-icon-background-1024.png', 'jb-icon-1024.png', 'jb-icon-monochrome-1024.png',
      'jb-splash-1080x1920.png')) {
    $img = [System.Drawing.Bitmap]::FromFile((Join-Path $OutDir $name))
    try {
      $corner = $img.GetPixel(0, 0)
      $center = $img.GetPixel([int]($img.Width / 2), [int]($img.Height / 2))
      $measured += [ordered]@{
        file = $name; width = $img.Width; height = $img.Height
        cornerAlpha = $corner.A; cornerRgb = @($corner.R, $corner.G, $corner.B)
        centerAlpha = $center.A; centerRgb = @($center.R, $center.G, $center.B)
      }
    } finally { $img.Dispose() }
  }

  [ordered]@{
    source = @{ width = $w; height = $h }
    background = @{ r = $bgR; g = $bgG; b = $bgB; hex = ('#{0:X2}{1:X2}{2:X2}' -f $bgR, $bgG, $bgB); cornerSpread = $cornerSpread }
    lettersBox = @{ x = $minX; y = $minY; width = $boxW; height = $boxH }
    crop = @{ x = $cropX; y = $cropY; side = $side; margin = $margin }
    files = $measured
  } | ConvertTo-Json -Depth 6 -Compress
}
finally {
  if ($square) { $square.Dispose() }
  $src.Dispose()
}
