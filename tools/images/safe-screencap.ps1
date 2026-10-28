<#
.SYNOPSIS
  Wrapper subțire peste `scripts/capture-android-screen.ps1` (singura unealtă de captură).
  Păstrează numele și parametrii vechi, ca apelurile existente să rămână valide.

.DESCRIPTION
  Numele `safe-screencap` a apărut când cauza PNG-urilor corupte era necunoscută. Între timp
  cauza a fost dovedită: telefonul expune DOUĂ display-uri, iar `screencap` fără `-d` scrie
  „[Warning] Multiple displays were found…” pe stdout, în fața octeților PNG. Unealta nouă rezolvă
  display-ul explicit, copiază fluxul brut în fișier (fără `>` și fără encoderul PowerShell),
  validează structura PNG, decodarea completă și conținutul (respinge cadrul negru) și doar apoi
  scrie JPG-ul.

  Aici nu s-a păstrat nicio logică proprie: orice modificare a capturii se face într-un singur loc,
  în `scripts/capture-android-screen.ps1`. Wrapperul doar traduce parametrii vechi.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/images/safe-screencap.ps1 -Name profile-header-own

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/images/safe-screencap.ps1 -Name feed -Wake -StrictFocus
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Device = '',
  # Id-ul fizic al display-ului. Gol = se rezolvă automat (recomandat).
  [string]$Display = '',
  [string]$Package = 'app.nexus.mobile.dev',
  [string]$Out = 'docs/vision',
  [int]$MaxWidth = 900,
  [int]$Quality = 82,
  # Păstrat pentru compatibilitate: fără el focusul trebuie să fie chiar $Package.
  [switch]$SkipFocusCheck,
  # Trezește telefonul înainte de captură (ecranul adoarme foarte repede pe acest telefon).
  [switch]$Wake,
  [int]$SettleSeconds = 0,
  [switch]$AllowBlank,
  [switch]$KeepPng,
  [string]$Endpoint = ''
)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tool = Join-Path $root 'scripts\capture-android-screen.ps1'
if (-not (Test-Path -LiteralPath $tool)) { throw "lipsește unealta de captură: $tool" }

$arguments = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool,
  '-Name', $Name,
  '-ExpectedPackage', $Package,
  '-OutDir', $Out,
  '-MaxWidth', $MaxWidth,
  '-Quality', $Quality,
  '-SettleSeconds', $SettleSeconds
)
# Parametrii vechi erau folosiți în apelurile existente; îi transmitem doar când sunt setați, ca
# auto-detectarea (șir gol) să rămână pe seama uneltei.
if ($Device) { $arguments += @('-Serial', $Device) }
if ($Display) { $arguments += @('-DisplayId', $Display) }
if ($Endpoint) { $arguments += @('-Endpoint', $Endpoint) }
if (-not $SkipFocusCheck) { $arguments += '-StrictFocus' }
if ($Wake) { $arguments += '-Wake' }
if ($AllowBlank) { $arguments += '-AllowBlank' }
if ($KeepPng) { $arguments += '-KeepPng' }

& powershell @arguments
exit $LASTEXITCODE
