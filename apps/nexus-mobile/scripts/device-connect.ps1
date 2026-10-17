# Connects to the phone over wireless debugging, then prints where it is.
#
# The order is the one the brief asks for: `adb devices` first, then `adb connect <ip>:<port>`, then
# mDNS discovery when the fixed port was reused by something else. It never sends an input, never
# presses Home or Back and never changes a setting on the phone; a pairing request that needs the
# phone screen is reported as such and left alone.
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'nexus-env.ps1')
$toolchain = Import-NexusToolchain -ApplyEnvironment
$adb = Join-Path $toolchain.AndroidSdk 'platform-tools\adb.exe'

function Get-Serial {
  param([string[]]$Lines)
  foreach ($line in $Lines) {
    if ($line -match '^(\S+)\s+device\b') { return $matches[1] }
  }
  return $null
}

$list = & $adb devices
$serial = Get-Serial -Lines $list

if (-not $serial) {
  Write-Output 'not attached; trying adb connect 192.168.1.184:46783'
  & $adb connect 192.168.1.184:46783 | ForEach-Object { Write-Output "connect: $_" }
  Start-Sleep -Seconds 2
  $list = & $adb devices
  $serial = Get-Serial -Lines $list
}

if (-not $serial) {
  Write-Output 'still not attached; asking mDNS who is advertising _adb-tls-connect'
  $services = & $adb mdns services
  $services | ForEach-Object { Write-Output "mdns: $_" }
  foreach ($line in $services) {
    if ($line -match '_adb-tls-connect\._tcp\s+(\S+)') {
      $address = $matches[1]
      Write-Output "trying discovered address $address"
      & $adb connect $address | ForEach-Object { Write-Output "connect: $_" }
    }
  }
  Start-Sleep -Seconds 2
  $list = & $adb devices
  $serial = Get-Serial -Lines $list
}

if (-not $serial) {
  Write-Output 'state: none'
  $list | ForEach-Object { Write-Output "list: $_" }
  exit 1
}

$state = (& $adb -s $serial get-state) -join ''
Write-Output "state: $state"
if ($state -match 'unauthorized|offline') {
  Write-Output 'the phone shows a prompt that only its owner can accept; stopping here'
  exit 2
}

Write-Output "serial: $serial"
Write-Output ('focus: ' + ((& $adb -s $serial shell dumpsys window | Select-String -Pattern 'mCurrentFocus') -join ' '))
Write-Output ('wake:  ' + ((& $adb -s $serial shell dumpsys power | Select-String -Pattern 'mWakefulness=') -join ' '))
Write-Output ('idle:  ' + ((& $adb -s $serial shell dumpsys deviceidle | Select-String -Pattern 'mState=') -join ' '))
