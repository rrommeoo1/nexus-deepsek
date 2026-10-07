<#
.SYNOPSIS
  Lotul de capturi native pentru raportul de paritate, într-o singură sesiune pe telefon.

.DESCRIPTION
  Pentru fiecare pereche „<ecran>/<stare>" din fișierul -List scrie, în docs/parity-report/<ecran>/:
    native-<stare>.png   `exec-out screencap -d <display> -p` (display-ul principal al Nexus, nu cover)
    native-<stare>.xml   `uiautomator dump --compressed` (bounds în px fizici; /compare.mjs îi împarte la DPR)
    focus-<stare>.txt    ce spune `mCurrentFocus` înainte de captură

  Reguli respectate, ca sesiunea să fie scurtă și verificabilă:
    - se lucrează DOAR dacă mCurrentFocus este app.nexus.mobile.dev (altfel pasul e sărit, nu ghicit);
    - fiecare PNG e validat (antet 89 50 4E 47, dimensiune > 0) imediat după scriere;
    - adb e cel din repo (tools/scrcpy/adb.exe), cu Wireless debugging;
    - nimic nu atinge dispozitivul: doar citiri (screencap, dumpsys, uiautomator dump).

.EXAMPLE
  powershell -NoProfile -File tools/parity/device-batch.ps1 -List docs/parity-report/batch.txt
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$List,
  [string]$Device = '',
  # Id-ul SurfaceFlinger al ecranului principal (NU numărul logic 0): se citește cu
  # `adb shell dumpsys SurfaceFlinger --display-id`. Cover-ul are alt id, iar fără `-d` screencap
  # avertizează că alege „primul display găsit", care nu e garantat același între capturi.
  [string]$Display = '4630946949513469331',
  [double]$Dpr = 2.6,
  [string]$Package = 'app.nexus.mobile.dev',
  [string]$Out = 'docs/parity-report'
)
$ErrorActionPreference = 'Stop'
# Etichetele aplicației conțin diacritice („Acasă", „Închide"), iar PowerShell decodează stdout-ul unei
# comenzi native cu encoding-ul consolei, nu cu UTF-8: fără aceste două linii, dump-ul ajunge „AcasÄƒ" și
# nicio potrivire pe etichetă nu mai reușește. Fișierele .ps1 din acest folder au BOM UTF-8 din același motiv.
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$adb = Join-Path $root 'tools\scrcpy\adb.exe'
if (-not (Test-Path $adb)) { throw "adb lipsește în repo: $adb" }
if (-not (Test-Path $List)) { throw "lipsește lista de capturi: $List" }

# 1. conexiunea: adb trebuie să vadă un dispozitiv autorizat (Wireless debugging pornit înainte).
$serial = $Device
if (-not $serial) {
  $line = (& $adb devices) -split "`r?`n" | Where-Object { $_ -match "`tdevice$" } | Select-Object -First 1
  if (-not $line) { throw "niciun dispozitiv autorizat: pornește Wireless debugging și verifică 'adb devices'." }
  $serial = ($line -split "`t")[0].Trim()
}
Write-Host "[parity] device = $serial (DPR $Dpr)"

function Get-Focus {
  # Ecranul are două display-uri: 1 = cover (stins, `mCurrentFocus=null`), 0 = ecranul principal. Se ia
  # linia care numește pachetul; dacă nu există, ultima linie (display-ul principal e listat ultimul).
  $lines = @(& $adb -s $serial shell dumpsys window displays 2>$null | Select-String -Pattern 'mCurrentFocus' | ForEach-Object { $_.ToString().Trim() })
  if (-not $lines) { return '' }
  $mine = $lines | Where-Object { $_ -match [regex]::Escape($Package) } | Select-Object -First 1
  if ($mine) { return $mine }
  return $lines[-1]
}

function Save-Screenshot {
  param([string]$Path)
  # Două capcane ale acestui dispozitiv, ambele măsurate, nu presupuse:
  #   - `-d 0` NU este un id valid: `screencap -d` vrea id-ul SurfaceFlinger al ecranului principal
  #     (4630946949513469331 pe acest telefon); fără `-d` alege „primul display găsit", adică poate și cover-ul;
  #   - `exec-out screencap -p > fișier` strecoară un avertisment de text în flux pe Windows, care
  #     strică antetul PNG. De aceea se scrie întâi pe telefon, apoi se citește cu `exec-out cat`.
  & $adb -s $serial shell screencap -d $Display -p /sdcard/nexus-parity.png | Out-Null
  $cmd = "`"$adb`" -s $serial exec-out cat /sdcard/nexus-parity.png > `"$Path`""
  cmd /c $cmd | Out-Null
}

function Get-Xml {
  # `uiautomator dump` întoarce uneori un arbore parțial: când ecranul se animă răspunde
  # „ERROR: could not get idle state" și scrie un XML sărac (măsurat: 9 noduri în loc de ~60).
  # De aceea se reface până când arborele e consistent sau se epuizează încercările, și se păstrează
  # cel mai mare rezultat - captura nu se ia niciodată din primul răspuns orb.
  $remote = '/sdcard/nexus-parity.xml'
  $best = ''
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    # `| Out-Null` nu e suficient: adb scrie pe stderr („ERROR: could not get idle state"), iar cu
    # $ErrorActionPreference='Stop' un asemenea text oprește scriptul. Redirecționarea o face cmd.exe.
    cmd /c "`"$adb`" -s $serial shell uiautomator dump --compressed $remote > NUL 2>&1" | Out-Null
    $xml = (& $adb -s $serial exec-out cat $remote) -join "`n"
    if ($xml.Length -gt $best.Length) { $best = $xml }
    if ($best.Length -ge 6000) { break }
    Start-Sleep -Milliseconds 500
  }
  return $best
}

function Save-Dump {
  param([string]$Path)
  (Get-Xml) | Out-File -FilePath $Path -Encoding utf8
}

function Test-Png {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @{ ok = $false; why = 'fișier lipsă'; size = 0 } }
  $size = (Get-Item $Path).Length
  if ($size -le 8) { return @{ ok = $false; why = 'fișier gol'; size = $size } }
  $bytes = Get-Content -Path $Path -Encoding Byte -TotalCount 8
  $magic = ($bytes | ForEach-Object { $_.ToString('X2') }) -join ' '
  $ok = $magic -eq '89 50 4E 47 0D 0A 1A 0A'
  return @{ ok = $ok; why = $magic; size = $size }
}

$entries = Get-Content $List -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
if (-not $entries) { throw 'lista nu conține niciun pas' }

function Get-Nodes {
  param([string]$Xml)
  $nodes = @()
  foreach ($match in [regex]::Matches($Xml, '<node\b[^>]*>')) {
    $tag = $match.Value
    $attr = { param($name) $found = [regex]::Match($tag, "$name=`"([^`"]*)`""); if ($found.Success) { $found.Groups[1].Value } else { '' } }
    $bounds = [regex]::Match($tag, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
    if (-not $bounds.Success) { continue }
    $nodes += [pscustomobject]@{
      label   = (& $attr 'content-desc')
      text    = (& $attr 'text')
      cls     = (& $attr 'class')
      x1      = [int]$bounds.Groups[1].Value
      y1      = [int]$bounds.Groups[2].Value
      x2      = [int]$bounds.Groups[3].Value
      y2      = [int]$bounds.Groups[4].Value
    }
  }
  Write-Host ("[parity] dump: {0} noduri ({1} cu etichetă)" -f $nodes.Count, (@($nodes | Where-Object { $_.label -or $_.text }).Count))
  return $nodes
}

function Tap-Node {
  param($Node, [string]$What)
  $x = [int](($Node.x1 + $Node.x2) / 2)
  $y = [int](($Node.y1 + $Node.y2) / 2)
  & $adb -s $serial shell input tap $x $y | Out-Null
  Write-Host ("[parity] tap {0} -> ({1},{2}) [{3}] '{4}'" -f $What, $x, $y, $Node.cls, (($Node.label, $Node.text | Where-Object { $_ }) -join ' / '))
}

$report = @()
foreach ($entry in $entries) {
  $kind, $value = $entry -split ':', 2
  $kind = $kind.Trim().ToLower()

  if ($kind -eq 'wait') { Start-Sleep -Milliseconds ([int]$value); continue }

  if ($kind -ne 'wait') {
    # Regula sesiunii (cerută de operator): NU se atinge cortina de notificări, NU se trimite Home sau Back.
    # Singura revenire permisă este o comandă explicită de start, o singură dată, după ce s-a citit focusul.
    $focus = Get-Focus
    if ($focus -notmatch [regex]::Escape($Package)) {
      Write-Host "[parity] focus străin ($focus) — o singură revenire: am start -n $Package/.MainActivity"
      cmd /c "`"$adb`" -s $serial shell am start -n $Package/.MainActivity > NUL 2>&1" | Out-Null
      Start-Sleep -Seconds 3
      $focus = Get-Focus
    }
    if ($focus -notmatch [regex]::Escape($Package)) {
      # Focusul nu e aplicația sub test: nu se trimite niciun input, lotul se oprește și raportează.
      Write-Warning "[parity] OPRIT la $entry — mCurrentFocus nu este $Package ($focus). Nu trimit input și nu reiau singur."
      $report += [pscustomobject]@{ step = $entry; ok = $false; detail = 'focus străin' }
      break
    }
  }
  $focus = Get-Focus

  if ($kind -eq 'key') {
    # `key:back` închide orice Modal rămas deschis (viewer, foaie de comentarii), fără să ghicească o
    # etichetă: fiecare Modal al aplicației e legat de `onRequestClose`, deci back-ul e exact butonul lui.
    $code = if ($value -match '^\d+$') { $value } else { "KEYCODE_$($value.ToUpper())" }
    & $adb -s $serial shell input keyevent $code | Out-Null
    Write-Host "[parity] key $code"
    Start-Sleep -Milliseconds 700
    $report += [pscustomobject]@{ step = $entry; ok = $true; detail = $code }
    continue
  }

  if ($kind -eq 'tap' -or $kind -eq 'tapxy') {
    $nodes = Get-Nodes -Xml (Get-Xml)
    if ($kind -eq 'tapxy') {
      $xy = $value -split ','
      $node = [pscustomobject]@{ x1 = [int]([double]$xy[0] * $Dpr); y1 = [int]([double]$xy[1] * $Dpr); x2 = [int]([double]$xy[0] * $Dpr); y2 = [int]([double]$xy[1] * $Dpr); label = 'coordonată CSS'; text = ''; cls = '(măsurat din web-ref)' }
    } else {
      # Eticheta exactă are prioritate (altfel „Profil" ar prinde și „Schimbă profilul Nexus"); dacă nu
      # există, se ia cea mai mare potrivire care *conține* textul cerut.
      $exact = $nodes | Where-Object { $_.label -eq $value -or $_.text -eq $value } | Select-Object -First 1
      if ($exact) { $node = $exact } else {
        $node = $nodes | Where-Object { ($_.label + ' ' + $_.text) -like "*$value*" } | Sort-Object { ($_.x2 - $_.x1) * ($_.y2 - $_.y1) } | Select-Object -Last 1
      }
    }
    if (-not $node) { Write-Warning "[parity] tap:$value — niciun nod nu conține eticheta"; $report += [pscustomobject]@{ step = $entry; ok = $false; detail = 'nod negăsit' }; continue }
    Tap-Node -Node $node -What $value
    Start-Sleep -Milliseconds 900
    $report += [pscustomobject]@{ step = $entry; ok = $true; detail = ('({0},{1})' -f [int](($node.x1 + $node.x2) / 2), [int](($node.y1 + $node.y2) / 2)) }
    continue
  }

  if ($kind -eq 'capture') {
    $parts = $value -split '/', 2
    if ($parts.Count -lt 2) { Write-Warning "[parity] capture:$value — formatul este <ecran>/<stare>"; continue }
    $area = $parts[0].Trim(); $state = $parts[1].Trim()
    $dir = Join-Path $root (Join-Path $Out $area)
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Set-Content -Path (Join-Path $dir "focus-$state.txt") -Value $focus -Encoding utf8
    $png = Join-Path $dir "native-$state.png"
    $xml = Join-Path $dir "native-$state.xml"
    Save-Screenshot -Path $png
    Save-Dump -Path $xml
    $check = Test-Png -Path $png
    if (-not $check.ok) {
      Write-Warning "[parity] $value PNG invalid ($($check.why)); îl refac o dată"
      Start-Sleep -Milliseconds 400
      Save-Screenshot -Path $png
      $check = Test-Png -Path $png
    }
    Write-Host ("[parity] {0} -> {1} bytes (PNG {2})" -f $value, $check.size, $(if ($check.ok) { 'valid' } else { 'INVALID' }))
    $report += [pscustomobject]@{ step = $entry; ok = $check.ok; detail = "$($check.size) bytes" }
    continue
  }

  Write-Warning "[parity] pas necunoscut: $entry"
}

$report | Format-Table -AutoSize
$bad = @($report | Where-Object { -not $_.ok }).Count
Write-Host ("[parity] {0}/{1} pași reușiți; XML-urile stau lângă PNG-uri (px fizici / {2} = CSS px)" -f ($report.Count - $bad), $report.Count, $Dpr)
if ($bad -gt 0) { exit 1 }

