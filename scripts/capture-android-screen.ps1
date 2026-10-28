<#
.SYNOPSIS
  Captures the physical Android screen, validates the PNG, converts it to JPG and publishes it.

.DESCRIPTION
  This is the ONLY supported way to take a screenshot of the phone in this project. It exists
  because the previous ad-hoc pipelines produced two different failures that looked identical:

    1. REAL corruption - `adb exec-out screencap -p > file.png` (or any `>` / pipe through
       PowerShell) mixes text into the binary stream. Evidence in this repo: a header of
       `FF FE 5B 00 57 00...` (UTF-16 BOM + "[War") and files starting with `[Warning`.
       Confirmed cause on this phone: it exposes TWO displays (1220x2656 internal + a 904x572
       subscreen), so `screencap` without `-d` writes "[Warning] Multiple displays were found,
       but no display id was specified! ..." to stdout and that text lands in front of the PNG
       signature. `screencap -d <physical display id> -p` produces a clean `89 50 4E 47` file.
    2. FALSE quarantine - complete, decodable 1220x2656 PNGs were renamed to `.png.bad` after a
       transient decode failure or because the AI image viewer refused them. 32 of the 36
       `.png.bad` files under apps/nexus-mobile/builds/ are byte-complete, chunk-valid PNGs.

  A `.bad` extension is therefore NOT proof of corruption, and this script never renames
  anything to `.bad`. A failed attempt is copied to JUNGLE_BOOK_VERIFICATION\diagnostics\
  with a `.failed` suffix plus a `.failure.txt` explanation, and the process exits nonzero.

  Pipeline implemented here:

    1. resolve adb.exe (SDK, repo tools/scrcpy, PATH) and check that it runs;
    2. resolve ONE authorized transport: -Serial, the current wireless endpoint for the phone,
       a changed port of the same IP, the mDNS serial, or the single attached device;
       connect (bounded) only when no transport is usable;
    3. take an exclusive lock so two captures cannot interleave;
    4. resolve the capture display explicitly (powered-on panel, largest area) so `-d` is always
       passed to screencap;
    5. capture with `adb exec-out screencap -d <id> -p`; the child's raw stdout stream is copied
       straight into the temp file (never through PowerShell's text encoder, no `>`, no
       Out-File); fallback (only if exec-out output does not validate):
       `shell screencap -d <id> -p` on the device + `adb pull`, byte-exact because adb writes
       the file itself;
    6. validate the PNG: signature, chunk walk to IEND, exact length, dimensions, full decode;
    7. convert to JPG with System.Drawing on a white background;
    8. validate the JPG the same way (signature + full decode + dimensions);
    9. publish to JUNGLE_BOOK_VERIFICATION\final_jpg\ without overwriting an existing file;
   10. delete the temporary PNG only after BOTH validations passed (unless -KeepPng, which
       copies it into diagnostics\ so final_jpg only ever contains published JPGs);
   11. refuse to publish a blank/uniform frame (sleeping screen, wrong panel) unless -AllowBlank.

  Every step is bounded by a timeout; every attempt is logged.

  Exit codes: 0 ok - 2 adb unusable - 3 no authorized device - 4 capture failed (adb/timeout)
              5 PNG invalid - 6 JPG conversion/validation failed - 7 another capture is running
              8 unexpected error - 9 focus check failed (-StrictFocus only)
             10 blank/uniform frame (-AllowBlank overrides)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-android-screen.ps1 -Name feed

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-android-screen.ps1 `
    -Name profile -Serial 192.168.1.184:35681 -Quality 92

.EXAMPLE
  # changed wireless port, or a USB serial
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-android-screen.ps1 `
    -Name reel -Endpoint 192.168.1.184:41234

.EXAMPLE
  # force a specific panel (ids: adb shell dumpsys SurfaceFlinger --display-id)
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-android-screen.ps1 `
    -Name subscreen -DisplayId 4630946949513469332 -KeepPng

.EXAMPLE
  # unattended run: wake the phone first and insist the app really owns the screen
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-android-screen.ps1 `
    -Name feed -Wake -StrictFocus
#>
[CmdletBinding()]
param(
  # File stem of the published JPG. Spaces and unsafe characters become '-'.
  [Parameter(Mandatory = $true, Position = 0)][string]$Name,

  # Exact adb serial / endpoint to use. Empty = auto-detect (recommended).
  [string]$Serial = '',

  # Wireless debugging endpoint used ONLY when no transport is currently usable.
  # The port changes every time wireless debugging is re-enabled; override it freely.
  [string]$Endpoint = '192.168.1.184:39169',

  # Physical display id for `screencap -d`. Empty = auto-detect (the powered-on display, largest
  # area first). Needed because this phone exposes TWO displays; without -d, screencap prints a
  # "[Warning] Multiple displays were found..." line on stdout, which is prepended to the PNG
  # bytes and corrupts the file (the historical `[Warning`-prefixed screenshots).
  [string]$DisplayId = '',

  # Publish folder. Empty = <repo>\JUNGLE_BOOK_VERIFICATION\final_jpg.
  [string]$OutDir = '',

  # Package that should own the focused window. Reported always, enforced only with -StrictFocus.
  [string]$ExpectedPackage = 'app.nexus.mobile.dev',

  # Hard limit for a single adb capture call.
  [int]$TimeoutSeconds = 25,

  # Hard limit for `adb connect`.
  [int]$ConnectTimeoutSeconds = 15,

  # Bounded retries of the whole capture step (exec-out, then device-file fallback).
  [int]$MaxAttempts = 2,

  # Downscale width for the JPG. 0 = keep the native resolution (recommended for UI review).
  [int]$MaxWidth = 0,

  # JPEG quality.
  [int]$Quality = 90,

  # Fail when the focused window is not $ExpectedPackage.
  [switch]$StrictFocus,

  # Wake the phone and dismiss the keyguard / notification shade before capturing. The screen
  # times out quickly on this device and a sleeping screen produces a valid but pure-black JPG.
  [switch]$Wake,

  # Extra delay between the optional wake and the capture, so a still-loading screen can settle.
  [int]$SettleSeconds = 0,

  # Publish even when the frame is uniform (all black / single colour). Off by default: a blank
  # JPG is not proof of anything, so it fails instead of silently poisoning the evidence folder.
  [switch]$AllowBlank,

  # Keep the validated PNG next to the log instead of deleting it.
  [switch]$KeepPng
)

$ErrorActionPreference = 'Stop'
$script:ExitCode = 0
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:Verification = Join-Path $script:Root 'JUNGLE_BOOK_VERIFICATION'
$script:Diagnostics = Join-Path $script:Verification 'diagnostics'
$script:LogDir = Join-Path $script:Diagnostics 'logs'
$script:RunId = [guid]::NewGuid().ToString('N').Substring(0, 8)
$script:TempDir = Join-Path $env:TEMP ("nexus-capture-" + $script:RunId)
$script:LogFile = ''
$script:Adb = ''
$script:SerialResolved = ''
$script:Mutex = $null
$script:PngPath = ''

Add-Type -AssemblyName System.Drawing | Out-Null


function Write-Log {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
  )
  $line = ('{0} [{1}] {2}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Level, $Message)
  Write-Host $line
  if ($script:LogFile) {
    try { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 } catch { }
  }
}

function Initialize-Workspace {
  foreach ($dir in @($script:Verification, $script:Diagnostics, $script:LogDir, $script:TempDir)) {
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  }
  $script:LogFile = Join-Path $script:LogDir ('capture-{0}.log' -f (Get-Date).ToString('yyyyMMdd'))
}

function Get-CaptureSlug {
  param([Parameter(Mandatory = $true)][string]$Value)
  $slug = ($Value.Trim() -replace '[^A-Za-z0-9._-]+', '-').Trim('-', '.')
  $slug = [System.IO.Path]::GetFileNameWithoutExtension($slug)
  if (-not $slug) { throw 'the capture name is empty after sanitising' }
  return $slug
}

function Get-TargetDir {
  if ($OutDir) {
    if ([System.IO.Path]::IsPathRooted($OutDir)) { return $OutDir }
    return (Join-Path $script:Root $OutDir)
  }
  return (Join-Path $script:Verification 'final_jpg')
}

function ConvertTo-ArgToken {
  # ProcessStartInfo.Arguments is a raw command line, so quoting is added here (paths may have spaces).
  param([string]$Value)
  if ($null -eq $Value -or $Value -eq '') { return '""' }
  if ($Value -match '[\s"]') { return ('"' + ($Value -replace '"', '\"') + '"') }
  return $Value
}

function Read-TextFileSafe {
  param([string]$Path)
  if ($Path -and (Test-Path -LiteralPath $Path)) {
    try { return (Get-Content -LiteralPath $Path -Raw -ErrorAction Stop) } catch { return '' }
  }
  return ''
}

function Invoke-AdbProcess {
  <#
    Runs adb with its raw stdout copied straight into a file and stderr captured separately.

    Why not `adb ... > file` or `adb ... | Out-File`: PowerShell would decode the stream as text,
    prefix a UTF-16 BOM and rewrite line endings, which is how previous screenshots ended up
    starting with `FF FE` or `[Warning`. Here `StandardOutput.BaseStream.CopyToAsync` moves the
    bytes untouched (no StreamReader, no encoding), and the child is killed when it overruns the
    timeout, so a hung transport cannot block the pipeline forever.

    Returns the real exit code; TimedOut = $true when the timeout fired.
  #>
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$StdOutPath,
    [Parameter(Mandatory = $true)][string]$StdErrPath,
    [int]$TimeoutSeconds = 30
  )

  $argString = ($Arguments | ForEach-Object { ConvertTo-ArgToken $_ }) -join ' '

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $script:Adb
  $startInfo.Arguments = $argString
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $startInfo
  if (-not $proc.Start()) { throw "could not start $($script:Adb)" }

  $copyTask = $null
  $errTask = $null
  $timedOut = $false

  $outStream = [System.IO.File]::Open($StdOutPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
  try {
    $copyTask = $proc.StandardOutput.BaseStream.CopyToAsync($outStream)
    $errTask = $proc.StandardError.ReadToEndAsync()

    $timedOut = -not $proc.WaitForExit($TimeoutSeconds * 1000)
    if ($timedOut) {
      try { $proc.Kill() } catch { }
      try { $proc.WaitForExit(3000) | Out-Null } catch { }
    }
    try { if ($copyTask) { [void]$copyTask.Wait(5000) } } catch { }
  } finally {
    try { $outStream.Dispose() } catch { }
  }

  $stderrText = ''
  if ($errTask) {
    try {
      if ($errTask.Wait(5000)) { $stderrText = $errTask.Result }
    } catch { $stderrText = '' }
  }
  try { [System.IO.File]::WriteAllText($StdErrPath, $stderrText, (New-Object System.Text.UTF8Encoding($false))) } catch { }

  $code = -1
  if (-not $timedOut) {
    try { $code = $proc.ExitCode } catch { $code = -1 }
  }
  try { $proc.Dispose() } catch { }

  return [pscustomobject]@{ ExitCode = $code; TimedOut = $timedOut; StdOutPath = $StdOutPath; StdErrPath = $StdErrPath }
}

function Invoke-AdbText {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [int]$TimeoutSeconds = 20
  )
  $tag = [guid]::NewGuid().ToString('N').Substring(0, 8)
  $out = Join-Path $script:TempDir ("adb-$tag.out")
  $err = Join-Path $script:TempDir ("adb-$tag.err")
  $result = Invoke-AdbProcess -Arguments $Arguments -StdOutPath $out -StdErrPath $err -TimeoutSeconds $TimeoutSeconds
  $stdout = Read-TextFileSafe $out
  $stderr = Read-TextFileSafe $err
  Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue
  return [pscustomobject]@{
    ExitCode = $result.ExitCode
    TimedOut = $result.TimedOut
    StdOut   = $stdout
    StdErr   = $stderr
  }
}

function Test-PngStructure {
  <#
    Walks every PNG chunk, so a truncated transfer cannot pass. This is stricter than a header
    check and it is why "file exists" is never treated as "screenshot captured":
      - signature must be 89 50 4E 47 0D 0A 1A 0A;
      - the first chunk must be IHDR and yield plausible dimensions;
      - the last chunk must be IEND and must end exactly at EOF (no missing tail).
  #>
  param([Parameter(Mandatory = $true)][string]$Path)

  $result = [pscustomobject]@{ Ok = $false; Why = ''; Width = 0; Height = 0; Chunks = 0; Size = 0; Prefix = '' }
  if (-not (Test-Path -LiteralPath $Path)) { $result.Why = 'file does not exist'; return $result }

  $size = (Get-Item -LiteralPath $Path).Length
  $result.Size = $size
  if ($size -lt 67) { $result.Why = "file is only $size bytes"; return $result }

  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  try {
    $head = New-Object byte[] 16
    $read = $stream.Read($head, 0, 16)
    $result.Prefix = (($head[0..([Math]::Min(15, $read - 1))]) | ForEach-Object { $_.ToString('X2') }) -join ' '

    $signature = '89 50 4E 47 0D 0A 1A 0A'
    if ($read -lt 8 -or $result.Prefix.Substring(0, 23) -ne $signature) {
      if ($read -ge 2 -and $head[0] -eq 0xFF -and $head[1] -eq 0xFE) {
        $result.Why = "text encoding leaked into the stream (UTF-16 BOM): $($result.Prefix)"
      } elseif ($read -ge 2 -and $head[0] -eq 0x5B -and $head[1] -eq 0x57) {
        $result.Why = "text leaked into the stream (starts with '[W'): $($result.Prefix)"
      } elseif ($read -ge 2 -and $head[0] -eq 0xFF -and $head[1] -eq 0xD8) {
        $result.Why = "file is a JPEG, not a PNG: $($result.Prefix)"
      } else {
        $result.Why = "not a PNG (signature: $($result.Prefix))"
      }
      return $result
    }

    $stream.Position = 8
    $lengthBytes = New-Object byte[] 4
    $typeBytes = New-Object byte[] 4
    $pos = [long]8
    $chunks = 0
    $lastType = ''
    $width = 0
    $height = 0

    while ($pos -lt $size) {
      if ($pos + 8 -gt $size) { $result.Why = "truncated chunk header at offset $pos"; return $result }
      if ($stream.Read($lengthBytes, 0, 4) -ne 4) { $result.Why = "cannot read length at offset $pos"; return $result }
      if ($stream.Read($typeBytes, 0, 4) -ne 4) { $result.Why = "cannot read chunk type at offset $pos"; return $result }
      # PNG lengths are big-endian; adding the bytes avoids Int32 overflow on garbage lengths.
      $length = [long](([uint32]$lengthBytes[0] -shl 24) -bor ([uint32]$lengthBytes[1] -shl 16) -bor ([uint32]$lengthBytes[2] -shl 8) -bor [uint32]$lengthBytes[3])
      $type = [System.Text.Encoding]::ASCII.GetString($typeBytes)

      if ($length -gt 268435456) { $result.Why = "absurd chunk length $length for '$type' at offset $pos"; return $result }
      if ($pos + 12 + $length -gt $size) {
        $result.Why = "truncated '$type' chunk (declares $length bytes, file ends at $size, chunk starts at $pos)"
        return $result
      }

      if ($chunks -eq 0) {
        if ($type -ne 'IHDR') { $result.Why = "first chunk is '$type', expected IHDR"; return $result }
        if ($stream.Read($lengthBytes, 0, 4) -ne 4) { $result.Why = 'cannot read IHDR width'; return $result }
        $width = [int](([uint32]$lengthBytes[0] -shl 24) -bor ([uint32]$lengthBytes[1] -shl 16) -bor ([uint32]$lengthBytes[2] -shl 8) -bor [uint32]$lengthBytes[3])
        if ($stream.Read($lengthBytes, 0, 4) -ne 4) { $result.Why = 'cannot read IHDR height'; return $result }
        $height = [int](([uint32]$lengthBytes[0] -shl 24) -bor ([uint32]$lengthBytes[1] -shl 16) -bor ([uint32]$lengthBytes[2] -shl 8) -bor [uint32]$lengthBytes[3])
      }

      $pos = $pos + 12 + $length
      $stream.Position = $pos
      $lastType = $type
      $chunks++
    }

    $result.Chunks = $chunks
    $result.Width = $width
    $result.Height = $height

    if ($lastType -ne 'IEND') { $result.Why = "last chunk is '$lastType', expected IEND (incomplete file)"; return $result }
    if ($pos -ne $size) { $result.Why = "chunk walk ended at $pos but the file is $size bytes"; return $result }
    if ($width -lt 100 -or $height -lt 100) { $result.Why = "implausible dimensions ${width}x${height}"; return $result }
    if ($width -gt 20000 -or $height -gt 20000) { $result.Why = "implausible dimensions ${width}x${height}"; return $result }

    $result.Ok = $true
    return $result
  } finally {
    $stream.Dispose()
  }
}


function Test-ImageDecode {
  <#
    Full decode, not just the header: FromStream(validateImageData) plus a DrawImage into a
    bitmap forces every pixel (and therefore every IDAT chunk) to be read. A truncated PNG has a
    valid header and fails here, which is exactly the case that used to slip through.
  #>
  param([Parameter(Mandatory = $true)][string]$Path)

  try {
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
      try {
        $width = $image.Width
        $height = $image.Height
        $bitmap = New-Object System.Drawing.Bitmap($width, $height)
        try {
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          try { $graphics.DrawImage($image, 0, 0, $width, $height) } finally { $graphics.Dispose() }
        } finally { $bitmap.Dispose() }
        return [pscustomobject]@{ Ok = $true; Width = $width; Height = $height; Why = '' }
      } finally { $image.Dispose() }
    } finally { $stream.Dispose() }
  } catch {
    return [pscustomobject]@{ Ok = $false; Width = 0; Height = 0; Why = $_.Exception.GetBaseException().Message }
  }
}

function Test-ImageContent {
  <#
    Rejects frames that decode perfectly but show nothing useful - a screen that is off yields a
    valid all-black 1220x2656 PNG, and publishing it as "verification" is exactly the false
    evidence this tool is meant to prevent. A 32x32 average of the image is enough: real UI has
    many distinct colours and a wide luminance range, a sleeping screen has one.
  #>
  param([Parameter(Mandatory = $true)][string]$Path)

  $image = $null
  $thumb = $null
  $graphics = $null
  try {
    $image = [System.Drawing.Image]::FromFile($Path)
    $thumb = New-Object System.Drawing.Bitmap 32, 32
    $graphics = [System.Drawing.Graphics]::FromImage($thumb)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $graphics.DrawImage($image, 0, 0, 32, 32)

    $colors = New-Object 'System.Collections.Generic.HashSet[string]'
    $maxLuma = 0
    $minLuma = 255
    $ink = 0
    for ($y = 0; $y -lt 32; $y++) {
      for ($x = 0; $x -lt 32; $x++) {
        $pixel = $thumb.GetPixel($x, $y)
        [void]$colors.Add(('{0},{1},{2}' -f $pixel.R, $pixel.G, $pixel.B))
        $luma = [int](0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B)
        if ($luma -gt $maxLuma) { $maxLuma = $luma }
        if ($luma -lt $minLuma) { $minLuma = $luma }
        if ($luma -ge 24) { $ink++ }
      }
    }

    $distinct = $colors.Count
    $coverage = [math]::Round(100.0 * $ink / 1024.0, 2)
    $why = ''
    if ($maxLuma -lt 12) {
      $why = "the frame is essentially black (max luminance $maxLuma/255)"
    } elseif ($distinct -le 2) {
      $why = "the frame is uniform ($distinct distinct colours in a 32x32 sample)"
    } elseif ($coverage -lt 1.0) {
      $why = "only $coverage% of the frame shows any content (a spinner or an empty screen)"
    }
    return [pscustomobject]@{
      Ok       = ($why -eq '')
      Colors   = $distinct
      MinLuma  = $minLuma
      MaxLuma  = $maxLuma
      Coverage = $coverage
      Why      = $why
    }
  } catch {
    # a non-image or a decoder hiccup is reported by Test-ImageDecode, not here
    return [pscustomobject]@{ Ok = $true; Colors = 0; MinLuma = 0; MaxLuma = 0; Coverage = 0; Why = '' }
  } finally {
    if ($graphics) { $graphics.Dispose() }
    if ($thumb) { $thumb.Dispose() }
    if ($image) { $image.Dispose() }
  }
}

function Test-JpegFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{ Ok = $false; Width = 0; Height = 0; Why = 'file does not exist' } }
  $size = (Get-Item -LiteralPath $Path).Length
  if ($size -lt 4096) { return [pscustomobject]@{ Ok = $false; Width = 0; Height = 0; Why = "file is only $size bytes" } }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $head = New-Object byte[] 3
    $read = $stream.Read($head, 0, 3)
    if ($read -lt 3 -or $head[0] -ne 0xFF -or $head[1] -ne 0xD8 -or $head[2] -ne 0xFF) {
      $hex = if ($read -gt 0) { (($head[0..($read - 1)]) | ForEach-Object { $_.ToString('X2') }) -join ' ' } else { 'empty' }
      return [pscustomobject]@{ Ok = $false; Width = 0; Height = 0; Why = "not a JPEG (signature: $hex)" }
    }
  } finally { $stream.Dispose() }

  return (Test-ImageDecode -Path $Path)
}

function Save-JpegCopy {
  <#
    Converts with System.Drawing on a white background (JPEG has no alpha). Writing through a
    FileStream avoids the historic GDI+ "generic error" when the destination already exists.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$MaxWidth = 0,
    [int]$Quality = 90
  )

  $folder = [System.IO.Path]::GetDirectoryName($Destination)
  if ($folder -and -not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
    try {
      $sourceWidth = $image.Width
      $sourceHeight = $image.Height
      $width = $sourceWidth
      if ($MaxWidth -gt 0 -and $sourceWidth -gt $MaxWidth) { $width = $MaxWidth }
      $height = [int][Math]::Round($sourceHeight * ($width / [double]$sourceWidth))
      if ($height -lt 1) { $height = 1 }

      $canvas = New-Object System.Drawing.Bitmap($width, $height)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([System.Drawing.Color]::White)
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.DrawImage($image, 0, 0, $width, $height)
        } finally { $graphics.Dispose() }

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        if (-not $codec) { throw 'no JPEG encoder in System.Drawing' }
        $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
        try {
          $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
          try { $canvas.Save($output, $codec, $parameters) } finally { $output.Dispose() }
        } finally { $parameters.Dispose() }
      } finally { $canvas.Dispose() }

      return [pscustomobject]@{ Width = $width; Height = $height; SourceWidth = $sourceWidth; SourceHeight = $sourceHeight }
    } finally { $image.Dispose() }
  } finally { $stream.Dispose() }
}


function Resolve-AdbPath {
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:ANDROID_HOME) { $candidates.Add((Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe')) }
  if ($env:ANDROID_SDK_ROOT) { $candidates.Add((Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe')) }
  if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')) }
  $candidates.Add((Join-Path $script:Root 'tools\scrcpy\adb.exe'))
  $onPath = Get-Command 'adb.exe' -ErrorAction SilentlyContinue
  if ($onPath) { $candidates.Add($onPath.Source) }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $script:Adb = $candidate
      $version = Invoke-AdbText -Arguments @('version') -TimeoutSeconds 10
      if ($version.StdOut -match 'Android Debug Bridge') { return $candidate }
      Write-Log "adb at $candidate did not answer 'version' (exit $($version.ExitCode)): $(($version.StdOut + $version.StdErr).Trim())" 'WARN'
      $script:Adb = ''
    }
  }
  return ''
}

function Get-DeviceRows {
  $result = Invoke-AdbText -Arguments @('devices', '-l') -TimeoutSeconds 15
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($line in ($result.StdOut -split "`r?`n")) {
    if ($line -match '^(\S+)\s+(device|offline|unauthorized|authorizing|recovery|sideload|bootloader)\b\s*(.*)$') {
      $rows.Add([pscustomobject]@{ Serial = $matches[1]; State = $matches[2]; Detail = $matches[3] })
    }
  }
  return $rows.ToArray()
}

function Connect-AndroidEndpoint {
  param([Parameter(Mandatory = $true)][string]$Target)
  if ($Target -notmatch ':\d+$') { return $false }
  Write-Log "no usable transport; trying 'adb connect $Target' (bounded to ${ConnectTimeoutSeconds}s)"
  $result = Invoke-AdbText -Arguments @('connect', $Target) -TimeoutSeconds $ConnectTimeoutSeconds
  $text = ($result.StdOut + ' ' + $result.StdErr).Trim()
  if ($text) { Write-Log ("adb connect: " + ($text -replace '\s+', ' ')) }
  return ($text -match 'connected to|already connected')
}

function Resolve-Device {
  <#
    Picks exactly one transport and always uses `-s <serial>`. The phone normally appears twice
    (mDNS serial + IP:port), and the wireless port changes whenever wireless debugging is
    re-enabled, so a hardcoded endpoint silently breaks the whole pipeline. Order of preference:
      -Serial, the same IP on its current port, the verification phone model, the only device.
  #>
  param([string]$Requested = '', [string]$Preferred = '')

  $rows = Get-DeviceRows
  $usable = @($rows | Where-Object { $_.State -eq 'device' })

  if ($Requested) {
    $hit = $usable | Where-Object { $_.Serial -eq $Requested } | Select-Object -First 1
    if (-not $hit) {
      Connect-AndroidEndpoint -Target $Requested | Out-Null
      $rows = Get-DeviceRows
      $usable = @($rows | Where-Object { $_.State -eq 'device' })
      $hit = $usable | Where-Object { $_.Serial -eq $Requested } | Select-Object -First 1
    }
    if ($hit) { return $hit }
    $state = @($rows | Where-Object { $_.Serial -eq $Requested } | Select-Object -First 1)
    $why = if ($state.Count) { "state '$($state[0].State)'" } else { 'not listed by adb' }
    throw [pscustomobject]@{ Kind = 'NoDevice'; Message = "requested transport '$Requested' is not usable ($why)" }
  }

  $preferredIp = ''
  if ($Preferred -match '^(\d+\.\d+\.\d+\.\d+):\d+$') { $preferredIp = $matches[1] }

  $chosen = $null
  if ($preferredIp) {
    $chosen = $usable | Where-Object { $_.Serial -like ($preferredIp + ':*') } | Select-Object -First 1
  }
  if (-not $chosen) {
    $chosen = $usable | Where-Object { $_.Detail -match 'model:25098PN5AC|product:pandora' } | Select-Object -First 1
  }
  if (-not $chosen -and $usable.Count -eq 1) { $chosen = $usable[0] }
  if ($chosen) { return $chosen }

  # Nothing usable: one bounded connect attempt, then a single re-check (never a loop).
  $targets = New-Object System.Collections.Generic.List[string]
  if ($Preferred) { $targets.Add($Preferred) }
  foreach ($row in $rows) {
    if ($row.Serial -match '^\d+\.\d+\.\d+\.\d+:\d+$' -and -not $targets.Contains($row.Serial)) { $targets.Add($row.Serial) }
  }
  foreach ($target in $targets) {
    if (Connect-AndroidEndpoint -Target $target) {
      $rows = Get-DeviceRows
      $usable = @($rows | Where-Object { $_.State -eq 'device' })
      $chosen = $usable | Where-Object { $_.Serial -eq $target } | Select-Object -First 1
      if ($chosen) { return $chosen }
      if ($preferredIp) {
        $chosen = $usable | Where-Object { $_.Serial -like ($preferredIp + ':*') } | Select-Object -First 1
        if ($chosen) { return $chosen }
      }
    }
  }

  $detail = ($rows | ForEach-Object { "$($_.Serial)=$($_.State)" }) -join ', '
  if (-not $detail) { $detail = 'adb devices is empty' }
  throw [pscustomobject]@{ Kind = 'NoDevice'; Message = "no authorized device ($detail). Enable wireless debugging, or pass -Endpoint <ip:port> / -Serial <serial>." }
}

function Get-TextPrefix {
  <#
    Returns the leading printable text of a failed capture, so the log says WHAT was prepended
    instead of just "not a PNG". adb writes warnings (notably "Multiple displays were found...")
    to the same stdout stream as the screenshot, so this is the fastest way to identify the cause.
  #>
  param([Parameter(Mandatory = $true)][string]$Path, [int]$Length = 200)

  try {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -eq 0) { return '' }
    $take = [Math]::Min($Length, $bytes.Length)
    $text = [System.Text.Encoding]::ASCII.GetString($bytes, 0, $take)
    $clean = (($text -replace '[^\x20-\x7E]', ' ') -replace '\s+', ' ').Trim()
    if ($clean -match '[A-Za-z]{4,}') { return $clean }
  } catch { }
  return ''
}

function Get-DisplayReport {
  <#
    Lists the device displays with their physical id (what `screencap -d` expects), logical id,
    resolution and power state. Falls back to `dumpsys SurfaceFlinger --display-id` on builds
    without `cmd display`.
  #>
  $displays = New-Object System.Collections.Generic.List[object]
  if (-not $script:SerialResolved) { return $displays.ToArray() }

  $result = Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'cmd', 'display', 'get-displays') -TimeoutSeconds 20
  foreach ($line in ($result.StdOut -split "`r?`n")) {
    if ($line -notmatch 'displayId\s+(\d+)') { continue }
    $logical = [int]$matches[1]
    $width = 0
    $height = 0
    $state = 'UNKNOWN'
    $physical = ''
    if ($line -match 'real (\d+) x (\d+)') { $width = [int]$matches[1]; $height = [int]$matches[2] }
    if ($line -match '\bstate (\w+)') { $state = $matches[1] }
    if ($line -match 'uniqueId "local:(\d+)"') { $physical = $matches[1] }
    $displays.Add([pscustomobject]@{ LogicalId = $logical; PhysicalId = $physical; Width = $width; Height = $height; State = $state })
  }

  if ($displays.Count -eq 0) {
    $fallback = Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'dumpsys', 'SurfaceFlinger', '--display-id') -TimeoutSeconds 20
    foreach ($line in ($fallback.StdOut -split "`r?`n")) {
      if ($line -match '^Display (\d+)') {
        $displays.Add([pscustomobject]@{ LogicalId = -1; PhysicalId = $matches[1]; Width = 0; Height = 0; State = 'UNKNOWN' })
      }
    }
  }

  return $displays.ToArray()
}

function Resolve-DisplayId {
  <#
    Chooses the display to capture. With two panels (main + cover) the default is not stable, and
    an implicit default also emits the stdout warning that corrupts exec-out PNGs, so the id is
    always resolved explicitly: the powered-on display wins, then the largest area.
  #>
  param([string]$Requested = '')

  if ($Requested) {
    if ($Requested -notmatch '^\d+$') { throw [pscustomobject]@{ Kind = 'NoDisplay'; Message = "-DisplayId must be the numeric physical display id (see 'dumpsys SurfaceFlinger --display-id'); got '$Requested'" } }
    return [pscustomobject]@{ Id = $Requested; LogicalId = -1; Width = 0; Height = 0; State = 'explicit'; Source = 'argument' }
  }

  $displays = Get-DisplayReport
  $withId = @($displays | Where-Object { $_.PhysicalId })
  if ($withId.Count -eq 0) {
    return [pscustomobject]@{ Id = ''; LogicalId = -1; Width = 0; Height = 0; State = 'unknown'; Source = 'none' }
  }

  $on = @($withId | Where-Object { $_.State -eq 'ON' })
  $pool = if ($on.Count -gt 0) { $on } else { $withId }
  $best = $pool | Sort-Object -Property @{ Expression = { [long]$_.Width * [long]$_.Height } } -Descending | Select-Object -First 1

  return [pscustomobject]@{
    Id        = $best.PhysicalId
    LogicalId = $best.LogicalId
    Width     = $best.Width
    Height    = $best.Height
    State     = $best.State
    Source    = 'auto'
  }
}


function Invoke-WakeDevice {
  <#
    Optional pre-capture wake (-Wake). A phone that is dozing still answers adb and still returns
    a perfectly valid screenshot - of a black screen - so waking is the only way to get real UI.
    `input keyevent` uses the key event path, which works without any extra permission.
    -Quick only re-wakes + collapses the shade; it is used immediately before screencap because
    this device falls back to sleep within a few seconds.
  #>
  param([switch]$Quick)
  if (-not $script:SerialResolved) { return }
  Write-Log 'wake:        KEYCODE_WAKEUP + dismiss-keyguard + collapse notification shade'
  try {
    Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP') -TimeoutSeconds 15 | Out-Null
    if ($Quick) {
      # the screen dozes again within seconds, so the last wake happens right before screencap
      Start-Sleep -Milliseconds 250
      Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'cmd', 'statusbar', 'collapse') -TimeoutSeconds 15 | Out-Null
      Start-Sleep -Milliseconds 250
      return
    }
    Start-Sleep -Milliseconds 700
    Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'wm', 'dismiss-keyguard') -TimeoutSeconds 15 | Out-Null
    Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'cmd', 'statusbar', 'collapse') -TimeoutSeconds 15 | Out-Null
    Start-Sleep -Milliseconds 700
    $power = Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'dumpsys', 'power') -TimeoutSeconds 15
    $line = ($power.StdOut -split "`r?`n" | Where-Object { $_ -match 'mWakefulness=' } | Select-Object -First 1)
    if ($line) { Write-Log ('state:       ' + ($line -replace '\s+', ' ').Trim()) }
  } catch {
    Write-Log ('wake failed: ' + $_.Exception.GetBaseException().Message) 'WARN'
  }
}


function Save-FailedArtifact {
  <#
    Quarantines a failed attempt WITHOUT inventing a `.bad` name: the copy keeps its real
    extension plus `.failed`, and a sibling `.failure.txt` says exactly what went wrong. Nothing
    that already exists is renamed, moved or deleted.
  #>
  param([string]$Reason, [string]$Detail, [string]$PngPath = '')

  $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $base = "$stamp-$($script:Slug)-$($script:RunId)"
  $kept = ''
  if ($PngPath -and (Test-Path -LiteralPath $PngPath)) {
    $kept = Join-Path $script:Diagnostics ($base + '.png.failed')
    try { Copy-Item -LiteralPath $PngPath -Destination $kept -Force } catch { $kept = '' }
  }
  $note = Join-Path $script:Diagnostics ($base + '.failure.txt')
  $lines = @(
    "capture:  $($script:Slug) (run $($script:RunId))",
    "time:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "device:   $($script:SerialResolved)",
    "endpoint: $Endpoint",
    "reason:   $Reason",
    "detail:   $Detail",
    "artifact: $kept",
    "log:      $($script:LogFile)",
    "",
    "This artifact failed validation and is kept as evidence. It was NOT renamed to .bad.",
    "A .bad suffix in this repository does not prove corruption: 32 of the 36 existing",
    "apps/nexus-mobile/builds/*.png.bad files are complete, decodable 1220x2656 PNGs."
  )
  try { Set-Content -LiteralPath $note -Value $lines -Encoding UTF8 } catch { }
  return [pscustomobject]@{ Artifact = $kept; Note = $note }
}

function Fail-Capture {
  param(
    [Parameter(Mandatory = $true)][string]$Reason,
    [Parameter(Mandatory = $true)][string]$Detail,
    [Parameter(Mandatory = $true)][int]$Code,
    [string]$PngPath = ''
  )
  $saved = Save-FailedArtifact -Reason $Reason -Detail $Detail -PngPath $PngPath
  Write-Log "FAILED [$Reason] $Detail" 'ERROR'
  if ($saved.Artifact) { Write-Log "failed artifact kept: $($saved.Artifact)" }
  Write-Log "explanation written: $($saved.Note)"
  $payload = [pscustomobject]@{
    ok          = $false
    reason      = $Reason
    detail      = $Detail
    exitCode    = $Code
    serial      = $script:SerialResolved
    artifact    = $saved.Artifact
    explanation = $saved.Note
    log         = $script:LogFile
    name        = $script:Slug
  }
  Write-Host ('RESULT_JSON: ' + ($payload | ConvertTo-Json -Compress))
  exit $Code
}


function Invoke-CaptureAttempt {
  <#
    One capture attempt, binary-safe. `exec-out` is the default method: the child's raw stdout
    stream is copied into the temp file byte for byte, so the PNG never passes through
    PowerShell's text encoding. The `device-file` fallback writes on the phone and lets
    `adb pull` copy the bytes, which is equally byte-exact and rescues transports where exec-out
    is unreliable.
  #>
  param([ValidateSet('exec-out', 'device-file')][string]$Method = 'exec-out')

  $png = Join-Path $script:TempDir ("{0}-{1}.png" -f $script:Slug, [guid]::NewGuid().ToString('N').Substring(0, 8))
  $errPath = Join-Path $script:TempDir ("{0}-{1}.stderr.txt" -f $script:Slug, [guid]::NewGuid().ToString('N').Substring(0, 8))
  $stderrText = ''
  $stage = 'adb'
  $detail = ''
  $exitCode = 0

  # `-d <display-id>` is mandatory in practice: without it adb prepends
  # "[Warning] Multiple displays were found, but no display id was specified!" to stdout and the
  # resulting file starts with "[Warning]" instead of the PNG signature.
  $displayArgs = @()
  if ($script:DisplayId) { $displayArgs = @('-d', $script:DisplayId) }

  if ($Method -eq 'exec-out') {
    Write-Log "attempt: adb -s $($script:SerialResolved) exec-out screencap $($displayArgs -join ' ') -p  (timeout ${TimeoutSeconds}s, binary-safe stream copy)"
    $run = Invoke-AdbProcess -Arguments (@('-s', $script:SerialResolved, 'exec-out', 'screencap') + $displayArgs + @('-p')) `
      -StdOutPath $png -StdErrPath $errPath -TimeoutSeconds $TimeoutSeconds
    $stderrText = Read-TextFileSafe $errPath
    $exitCode = $run.ExitCode
    if ($run.TimedOut) { $detail = "timed out after ${TimeoutSeconds}s" }
    elseif ($run.ExitCode -ne 0) { $detail = "adb exited with $($run.ExitCode): $($stderrText.Trim())" }
  } else {
    $remote = "/sdcard/nexus-capture-$($script:RunId).png"
    $script:RemotePath = $remote
    Write-Log "attempt: adb shell screencap $($displayArgs -join ' ') -p $remote + adb pull  (timeout ${TimeoutSeconds}s)"
    $tag = [guid]::NewGuid().ToString('N').Substring(0, 8)
    $out1 = Join-Path $script:TempDir "shell-$tag.out"
    $err1 = Join-Path $script:TempDir "shell-$tag.err"
    $run1 = Invoke-AdbProcess -Arguments (@('-s', $script:SerialResolved, 'shell', 'screencap') + $displayArgs + @('-p', $remote)) `
      -StdOutPath $out1 -StdErrPath $err1 -TimeoutSeconds $TimeoutSeconds
    $stderrText = (Read-TextFileSafe $out1) + (Read-TextFileSafe $err1)
    Remove-Item -LiteralPath $out1, $err1 -Force -ErrorAction SilentlyContinue
    $exitCode = $run1.ExitCode
    if ($run1.TimedOut) {
      $detail = "device screencap timed out after ${TimeoutSeconds}s"
    } elseif ($run1.ExitCode -ne 0) {
      $detail = "device screencap exited with $($run1.ExitCode): $($stderrText.Trim())"
    } else {
      $out2 = Join-Path $script:TempDir "pull-$tag.out"
      $err2 = Join-Path $script:TempDir "pull-$tag.err"
      $run2 = Invoke-AdbProcess -Arguments @('-s', $script:SerialResolved, 'pull', $remote, $png) `
        -StdOutPath $out2 -StdErrPath $err2 -TimeoutSeconds $TimeoutSeconds
      $stderrText = $stderrText + (Read-TextFileSafe $out2) + (Read-TextFileSafe $err2)
      Remove-Item -LiteralPath $out2, $err2 -Force -ErrorAction SilentlyContinue
      $exitCode = $run2.ExitCode
      if ($run2.TimedOut) { $detail = "adb pull timed out after ${TimeoutSeconds}s" }
      elseif ($run2.ExitCode -ne 0) { $detail = "adb pull exited with $($run2.ExitCode): $($stderrText.Trim())" }
    }
  }

  if ($detail) {
    return [pscustomobject]@{ Ok = $false; Stage = $stage; Detail = $detail; Png = $png; Method = $Method; ExitCode = $exitCode }
  }

  $structure = Test-PngStructure -Path $png
  if (-not $structure.Ok) {
    $why = $structure.Why
    $sniff = Get-TextPrefix -Path $png
    if ($sniff) {
      $why = $why + " | leading text in the capture: '$sniff'"
      if ($sniff -match 'Multiple displays') {
        $why = $why + " (adb prepended a multi-display warning to stdout; capture with -d <display-id>)"
      }
    }
    return [pscustomobject]@{ Ok = $false; Stage = 'png'; Detail = $why; Png = $png; Method = $Method; ExitCode = $exitCode }
  }
  $decoded = Test-ImageDecode -Path $png
  if (-not $decoded.Ok) {
    return [pscustomobject]@{ Ok = $false; Stage = 'decode'; Detail = $decoded.Why; Png = $png; Method = $Method; ExitCode = $exitCode }
  }

  Write-Log ("png valid: {0}x{1}, {2:N0} bytes, {3} chunks, full decode OK (via {4})" -f `
    $structure.Width, $structure.Height, $structure.Size, $structure.Chunks, $Method)
  return [pscustomobject]@{
    Ok       = $true
    Stage    = 'ok'
    Detail   = ''
    Png      = $png
    Method   = $Method
    Width    = $structure.Width
    Height   = $structure.Height
    Bytes    = $structure.Size
    Chunks   = $structure.Chunks
    ExitCode = $exitCode
  }
}


# --------------------------------------------------------------------------- main
$script:Slug = ''
$script:RemotePath = ''
$script:Success = $false
$script:LockHeld = $false
Initialize-Workspace

try {
  $script:Slug = Get-CaptureSlug -Value $Name

  # 1. exclusive lock: two concurrent adb capture calls can interleave their bytes ---------
  $mutexName = 'Global\NexusAndroidScreenCapture'
  try {
    $script:Mutex = New-Object System.Threading.Mutex($false, $mutexName)
  } catch {
    $mutexName = 'Local\NexusAndroidScreenCapture'
    $script:Mutex = New-Object System.Threading.Mutex($false, $mutexName)
  }
  try { $script:LockHeld = $script:Mutex.WaitOne(0) }
  catch [System.Threading.AbandonedMutexException] { $script:LockHeld = $true }

  if (-not $script:LockHeld) {
    Write-Log 'another capture is running (mutex held); refusing to interleave adb calls' 'ERROR'
    Fail-Capture -Reason 'busy' -Detail 'another capture holds the capture mutex' -Code 7
  }

  Write-Log "=== capture '$($script:Slug)' run $($script:RunId) ==="
  Write-Log "repo:        $($script:Root)"
  Write-Log "publish dir: $(Get-TargetDir)"

  # 2. adb --------------------------------------------------------------------------------
  if (-not (Resolve-AdbPath)) {
    Fail-Capture -Code 2 -Reason 'adb-unusable' -Detail ('adb.exe not found or not answering "adb version" ' +
      '(checked ANDROID_HOME, ANDROID_SDK_ROOT, %LOCALAPPDATA%\Android\Sdk, tools\scrcpy, PATH)')
  }
  Write-Log "adb:         $($script:Adb)"

  # 3. device -----------------------------------------------------------------------------
  try {
    $device = Resolve-Device -Requested $Serial -Preferred $Endpoint
  } catch {
    $info = $_.TargetObject
    $message = if ($info -and $info.PSObject.Properties['Message']) { [string]$info.Message } else { $_.Exception.Message }
    Fail-Capture -Code 3 -Reason 'no-device' -Detail $message
  }
  $script:SerialResolved = $device.Serial
  Write-Log "device:      $($device.Serial)  [$($device.Detail.Trim())]"

  # 4. wake (optional) and resolve the capture display explicitly so `screencap -d <id>` never
  # falls back to an implicit default (this phone exposes two panels; the implicit default also
  # emits a stdout warning that corrupts exec-out PNGs) -------------------------------------
  if ($Wake) { Invoke-WakeDevice }
  if ($SettleSeconds -gt 0) {
    Write-Log "settle:      waiting ${SettleSeconds}s before the capture"
    Start-Sleep -Seconds $SettleSeconds
  }
  try {
    $display = Resolve-DisplayId -Requested $DisplayId
  } catch {
    $info = $_.TargetObject
    $message = if ($info -and $info.PSObject.Properties['Message']) { [string]$info.Message } else { $_.Exception.Message }
    Fail-Capture -Code 4 -Reason 'capture-failed' -Detail $message
  }
  $script:DisplayId = [string]$display.Id
  if ($script:DisplayId) {
    Write-Log ("display:     physical {0} (logical {1}, {2}x{3}, {4}, {5})" -f `
        $display.Id, $display.LogicalId, $display.Width, $display.Height, $display.State, $display.Source)
  } else {
    Write-Log 'display:     could not be resolved; capturing without -d (expect the multi-display warning)' 'WARN'
  }

  # 5. focus: always reported, fatal only with -StrictFocus ---------------------------------
  # A device with two displays prints one mCurrentFocus line per display, and the powered-off
  # subscreen reports `null` first, so a naive "first match" would always look unfocused.
  $window = Invoke-AdbText -Arguments @('-s', $script:SerialResolved, 'shell', 'dumpsys', 'window') -TimeoutSeconds 20
  $focusLines = @($window.StdOut -split "`r?`n" | Where-Object { $_ -match 'mCurrentFocus' } |
      ForEach-Object { ($_ -replace '\s+', ' ').Trim() })
  # ATENȚIE: nu se scrie `$matched = if (...) { @(...) } else { @() }`. Un bloc `if` își enumeră
  # ieșirea, deci un rezultat cu un singur element se dezumflă la string, iar `$matched[0]` devine
  # primul CARACTER — de aici „focused window is 'm'”. Se construiește mereu cu @() în jurul valorii.
  $focus = 'unknown'
  if ($focusLines.Count -gt 0) {
    $nonNull = @($focusLines | Where-Object { $_ -notmatch 'mCurrentFocus=null' })
    $matched = @()
    if ($ExpectedPackage) { $matched = @($nonNull | Where-Object { $_ -match [regex]::Escape($ExpectedPackage) }) }
    if ($matched.Count -gt 0) { $focus = $matched[0] }
    elseif ($nonNull.Count -gt 0) { $focus = $nonNull[0] }
    else { $focus = $focusLines[0] }
    if ($focusLines.Count -gt 1) { Write-Log (("focus:       {0} mCurrentFocus lines found (one per display): {1}" -f $focusLines.Count, ($focusLines -join ' | '))) }
  }
  $focusOk = (-not $ExpectedPackage) -or ($focus -match [regex]::Escape($ExpectedPackage))
  Write-Log "focus:       $focus"
  if (-not $focusOk) {
    Write-Log "focused window does not contain '$ExpectedPackage' (pass -StrictFocus to make this fatal)" 'WARN'
    if ($StrictFocus) { Fail-Capture -Code 9 -Reason 'focus-mismatch' -Detail "focused window is '$focus', expected '$ExpectedPackage'" }
  }

  # 6. capture: exec-out first, then the device-file fallback, bounded retries --------------
  if ($Wake) { Invoke-WakeDevice -Quick }
  $attempt = $null
  $last = $null
  :attempts for ($round = 1; $round -le $MaxAttempts; $round++) {
    foreach ($method in @('exec-out', 'device-file')) {
      $result = Invoke-CaptureAttempt -Method $method
      if ($result.Ok) { $attempt = $result; break attempts }
      $last = $result
      Write-Log "attempt $round/$MaxAttempts via $method failed [$($result.Stage)]: $($result.Detail)" 'WARN'
    }
    if ($round -lt $MaxAttempts) { Start-Sleep -Milliseconds 800 }
  }
  if (-not $attempt) {
    $code = if ($last -and ($last.Stage -eq 'png' -or $last.Stage -eq 'decode')) { 5 } else { 4 }
    Fail-Capture -Code $code -Reason 'capture-failed' -PngPath $last.Png `
      -Detail ("last attempt ($($last.Method)/$($last.Stage)): $($last.Detail)")
  }


  # 7. content sanity, then convert and publish; an existing JPG is never overwritten ---------
  # A frame that decodes but shows a sleeping/blank screen is worthless as evidence, so it fails
  # here instead of being published. -AllowBlank overrides.
  $content = Test-ImageContent -Path $attempt.Png
  if (-not $content.Ok) {
    if ($AllowBlank) {
      Write-Log ("content:     blank frame allowed by -AllowBlank: {0}" -f $content.Why) 'WARN'
    } else {
      Fail-Capture -Code 10 -Reason 'blank-frame' -PngPath $attempt.Png `
        -Detail ("$($content.Why). The screen is probably off or the wrong panel was captured; retry with -Wake, or publish anyway with -AllowBlank.")
    }
  } else {
    Write-Log ("content:     {0} distinct colours, {1}% ink coverage, luminance {2}-{3} (not blank)" -f `
        $content.Colors, $content.Coverage, $content.MinLuma, $content.MaxLuma)
  }

  $targetDir = Get-TargetDir
  if (-not (Test-Path -LiteralPath $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
  $target = Join-Path $targetDir ($script:Slug + '.jpg')
  if (Test-Path -LiteralPath $target) {
    $target = Join-Path $targetDir ('{0}-{1}.jpg' -f $script:Slug, (Get-Date).ToString('yyyyMMdd-HHmmss'))
    Write-Log "an earlier $($script:Slug).jpg exists; publishing as $([System.IO.Path]::GetFileName($target)) instead (nothing is overwritten)" 'WARN'
  }

  try {
    $converted = Save-JpegCopy -Path $attempt.Png -Destination $target -MaxWidth $MaxWidth -Quality $Quality
  } catch {
    Fail-Capture -Code 6 -Reason 'jpg-conversion' -PngPath $attempt.Png -Detail $_.Exception.GetBaseException().Message
  }

  $proof = Test-JpegFile -Path $target
  if (-not $proof.Ok) {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue }
    Fail-Capture -Code 6 -Reason 'jpg-invalid' -PngPath $attempt.Png -Detail "the written JPG failed validation: $($proof.Why)"
  }
  if ($converted.Width -ne $proof.Width -or $converted.Height -ne $proof.Height) {
    Write-Log "decoded size ${($proof.Width)}x${($proof.Height)} differs from encoded ${($converted.Width)}x${($converted.Height)}" 'WARN'
  }

  $bytes = (Get-Item -LiteralPath $target).Length

  $script:Success = $true
  Write-Log ('published:   {0}  ({1:N0} bytes, {2}x{3}, via {4})' -f $target, $bytes, $proof.Width, $proof.Height, $attempt.Method)

  if ($KeepPng) {
    # the PNG is a debugging artefact: it stays out of final_jpg so that folder only ever
    # holds published captures
    if (-not (Test-Path -LiteralPath $script:Diagnostics)) { New-Item -ItemType Directory -Force -Path $script:Diagnostics | Out-Null }
    $keepPath = Join-Path $script:Diagnostics ('{0}-{1}.png' -f $script:Slug, (Get-Date).ToString('yyyyMMdd-HHmmss'))
    Copy-Item -LiteralPath $attempt.Png -Destination $keepPath -Force
    Write-Log "png kept:    $keepPath"
  }

  $payload = [pscustomobject]@{
    ok           = $true
    name         = $script:Slug
    path         = $target
    bytes        = $bytes
    width        = $proof.Width
    height       = $proof.Height
    sourceWidth  = $attempt.Width
    sourceHeight = $attempt.Height
    method       = $attempt.Method
    serial       = $script:SerialResolved
    display      = $script:DisplayId
    focus        = $focus
    focusOk      = $focusOk
    pngBytes     = $attempt.Bytes
    pngChunks    = $attempt.Chunks
    log          = $script:LogFile
  }
  Write-Host ('RESULT_JSON: ' + ($payload | ConvertTo-Json -Compress))
  $script:ExitCode = 0
} catch {
  Write-Log ('unexpected error: ' + $_.Exception.GetBaseException().Message) 'ERROR'
  Write-Log $_.ScriptStackTrace 'ERROR'
  $script:ExitCode = 8
} finally {
  # best effort: drop the device-side temp file (bounded, never fatal)
  if ($script:RemotePath -and $script:Adb -and $script:SerialResolved) {
    try {
      $out = Join-Path $env:TEMP ("nexus-rm-$($script:RunId).out")
      $err = Join-Path $env:TEMP ("nexus-rm-$($script:RunId).err")
      Invoke-AdbProcess -Arguments @('-s', $script:SerialResolved, 'shell', 'rm', '-f', $script:RemotePath) `
        -StdOutPath $out -StdErrPath $err -TimeoutSeconds 8 | Out-Null
      Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue
    } catch { }
  }

  # temporary files are removed only after a fully validated capture; failures stay for review
  if ($script:Success) {
    if (Test-Path -LiteralPath $script:TempDir) { Remove-Item -LiteralPath $script:TempDir -Recurse -Force -ErrorAction SilentlyContinue }
  } elseif (Test-Path -LiteralPath $script:TempDir) {
    Write-Log "temporary files kept for inspection: $($script:TempDir)" 'WARN'
  }

  if ($script:Mutex) {
    if ($script:LockHeld) { try { $script:Mutex.ReleaseMutex() } catch { } }
    try { $script:Mutex.Dispose() } catch { }
  }
}

exit $script:ExitCode
