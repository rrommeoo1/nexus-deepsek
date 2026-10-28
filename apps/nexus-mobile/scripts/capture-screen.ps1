# Captură de ecran a telefonului, în `builds\visual\`.
#
# Aici nu mai există logică proprie: totul se face în `scripts/capture-android-screen.ps1`
# (rezolvare display, captură `screencap -d`, validare PNG + decodare completă, gardă împotriva
# cadrului negru, conversie JPG, publicare fără suprascriere). Wrapperul păstrează numele și
# parametrii folosiți de comenzile existente, ca nimic să nu fie rescris prin altă cale.
#
# De ce nu se revine la `adb shell screencap` + `pull` direct: telefonul expune două display-uri,
# iar `screencap` fără `-d` scrie linia „[Warning] Multiple displays were found…” pe stdout, în
# fața octeților PNG — exact fișierele pe care le raportau pipeline-urile vechi ca „corupte”.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-screen.ps1 -Name feed_text_short
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Serial = '',
  [int]$Quality = 82,
  # Implicit: trezește telefonul, pentru că ecranul adoarme în câteva secunde și un cadru negru
  # nu dovedește nimic. `-NoWake` lasă telefonul exact în starea în care este.
  [switch]$NoWake,
  [switch]$StrictFocus,
  [int]$SettleSeconds = 0
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$tool = Join-Path $root '..\..\scripts\capture-android-screen.ps1'
$tool = [System.IO.Path]::GetFullPath($tool)
if (-not (Test-Path -LiteralPath $tool)) { throw "lipsește unealta de captură: $tool" }

$outDir = Join-Path $root 'builds\visual'
$arguments = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool,
  '-Name', $Name,
  '-OutDir', $outDir,
  '-Quality', $Quality,
  '-SettleSeconds', $SettleSeconds
)
if ($Serial) { $arguments += @('-Serial', $Serial) }
if (-not $NoWake) { $arguments += '-Wake' }
if ($StrictFocus) { $arguments += '-StrictFocus' }

& powershell @arguments
exit $LASTEXITCODE
