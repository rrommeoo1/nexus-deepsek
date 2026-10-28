<#
.SYNOPSIS
  Perechează telefonul prin Wireless debugging și lasă un dispozitiv autorizat pentru device-batch.ps1.

.DESCRIPTION
  Regula acestui script vine dintr-o sesiune în care perecherea a eșuat de patru ori la rând cu
  „error: protocol fault (couldn't read status message)". Cauza nu a fost rețeaua (TCP răspundea), ci
  portul: ecranul „Wireless debugging" afișează un port care se anunță în mDNS ca `_adb-tls-connect._tcp`,
  iar `adb pair` pe acel port eșuează exact așa. Dialogul „Pair device with pairing code" are portul LUI,
  diferit, anunțat ca `_adb-tls-pairing._tcp`, și trăiește doar cât timp dialogul e deschis — codul moare
  cu dialogul, iar socket-ul rămas deschis nu mai vorbește nici pairing, nici connect.

  De aceea scriptul nu cere niciun port: pornește, așteaptă să apară serviciul de pairing în mDNS, apoi
  cere doar codul de 6 cifre. După pereche, conectează serviciile de connect și așteaptă un dispozitiv
  autorizat (linia care se termină cu `device`), exact ce verifică device-batch.ps1 înainte de a trimite
  vreun input.

.EXAMPLE
  powershell -NoProfile -File tools/parity/adb-pair.ps1
#>
[CmdletBinding()]
param(
  # Cât se așteaptă apariția serviciului de pairing (dialogul trebuie deschis în acest interval).
  [int]$TimeoutSec = 180,
  # Cât se așteaptă, după pereche, apariția serviciului de connect și autorizarea dispozitivului.
  [int]$ConnectTimeoutSec = 40,
  # Adresa „ip:port" citită DIN dialogul de pairing. Se dă doar când mDNS-ul nu anunță serviciul:
  # măsurat pe acest telefon, `_adb-tls-pairing` nu a apărut deloc, iar un port de connect rămas deschis
  # (acceptă TCP, apoi închide imediat — „unexpected eof while reading") a fost anunțat ca serviciu de
  # connect. Fără acest parametru, scriptul caută singur serviciul în mDNS.
  [string]$Address = ''
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$adb = Join-Path $root 'tools\scrcpy\adb.exe'
if (-not (Test-Path $adb)) { throw "adb lipsește în repo: $adb" }

# Un dispozitiv autorizat = linia din `adb devices` care se termină cu TAB + device (nu `offline`, nu
# `unauthorized`): aceeași regulă pe care o folosește device-batch.ps1.
function Get-Authorized {
  @(& $adb devices) -split "`r?`n" | Where-Object { $_ -match "`tdevice$" } | Select-Object -First 1
}

# Adresele „ip:port" ale unui tip de serviciu anunțat în mDNS (coloana a treia, despărțită cu TAB).
function Get-MdnsAddress {
  param([string]$Type)
  @(& $adb mdns services 2>$null) | Where-Object { $_ -match [regex]::Escape($Type) } |
    ForEach-Object { ($_.ToString() -split [char]9)[-1].Trim() } | Where-Object { $_ } | Select-Object -Unique
}

$line = Get-Authorized
if ($line) {
  Write-Host ("[pair] dispozitiv deja autorizat: {0} — nu e nevoie de pereche." -f ($line -split "`t")[0].Trim())
  return
}

# Candidatul de pairing: adresa citită din dialog, dacă a fost dată; altfel cea descoperită în mDNS.
$addr = $Address.Trim()
if (-not $addr) {
  Write-Host '[pair] Pe telefon: Developer options -> Wireless debugging -> "Pair device with pairing code".'
  Write-Host ("[pair] Aștept serviciul de pairing în mDNS (max {0} s)..." -f $TimeoutSec)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while (-not $addr -and (Get-Date) -lt $deadline) {
    $addr = Get-MdnsAddress '_adb-tls-pairing' | Select-Object -First 1
    if (-not $addr) { Start-Sleep -Seconds 2 }
  }
  if (-not $addr) {
    # Diagnosticul e util: dacă se văd servicii de connect, dialogul de pairing NU a fost deschis.
    $connect = Get-MdnsAddress '_adb-tls-connect'
    if ($connect) {
      Write-Host ("[pair] mDNS anunță doar servicii de connect: {0}" -f ($connect -join ', '))
      Write-Host '[pair] Dacă dialogul de pairing e deschis, dă adresa lui direct: -Address ip:port (mDNS-ul acestui telefon a mai etichetat greșit un port mort).'
    }
    throw "nu a apărut niciun serviciu _adb-tls-pairing în $TimeoutSec s (dialogul de pairing nu a fost deschis)"
  }
}
Write-Host "[pair] adresa de pairing: $addr"

$code = (Read-Host 'Codul de 6 cifre din dialog (dialogul rămâne deschis)').Trim()
if ($code -notmatch '^\d{6}$') { throw "codul trebuie să aibă 6 cifre (primit: '$code')" }
$out = (& $adb pair $addr $code 2>&1 | Out-String).Trim()
Write-Host $out
if ($out -notmatch 'Successfully paired') {
  # „protocol fault (couldn't read status message)" = serverul a închis imediat conexiunea: portul
  # acceptă TCP, dar serviciul lui nu mai e viu (listener rămas de la o sesiune închisă). Nu se
  # reîncearcă pe același port — se cere portul NOU, din dialogul redeschis.
  if ($out -match 'protocol fault') {
    throw "portul $addr închide imediat conexiunea: fie e un listener mort (serviciu oprit între timp), fie NU e portul din dialogul 'Pair device with pairing code' — portul de pe ecranul principal (cel afișat lângă 'IP address & Port') e portul de CONNECT și nu poate fi folosit pentru pereche: redeschide dialogul și ia numărul scris în el"
  }
  if ($out -match 'cannot connect|refused|No connection could be made') {
    throw "nu se poate conecta la ${addr}: portul nu e deschis acum — dialogul 'Pair device with pairing code' trebuie să fie DESCHIS pe telefon exact când rulezi comanda (serviciul de pairing trăiește doar cât e dialogul pe ecran)"
  }
  throw 'perecherea a eșuat: cod expirat/greșit sau adresa nu e portul dialogului (reia scriptul, dialog nou)'
}

# După pereche, portul de connect al sesiunii curente se citește tot din mDNS: cel afișat pe ecranul
# principal se schimbă când sesiunea de wireless debugging se restartează.
$deadline = (Get-Date).AddSeconds($ConnectTimeoutSec)
do {
  foreach ($c in (Get-MdnsAddress '_adb-tls-connect')) {
    Write-Host "[pair] connect $c"
    Write-Host '  ' ((& $adb connect $c 2>&1 | Out-String).Trim())
  }
  Start-Sleep -Seconds 2
  $line = Get-Authorized
} while (-not $line -and (Get-Date) -lt $deadline)

if (-not $line) { throw "pereche OK, dar niciun dispozitiv autorizat în $ConnectTimeoutSec s: verifică «Wireless debugging» pornit, apoi reia." }
$serial = ($line -split "`t")[0].Trim()
Write-Host "[pair] autorizat: $serial"
Write-Host ("[pair] model: {0}" -f ((& $adb -s $serial shell getprop ro.product.model 2>$null | Out-String).Trim()))
Write-Host '[pair] următorul pas: powershell -NoProfile -File tools/parity/device-batch.ps1 -List docs/parity-report/batch-profile.txt'
