# Prints where the phone is, without touching it: serial, focused window, wakefulness, doze state.
# Read-only by design — it never sends an input, never presses Home/Back and never changes a setting.
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'nexus-env.ps1')
$toolchain = Import-NexusToolchain -ApplyEnvironment
$adb = Join-Path $toolchain.AndroidSdk 'platform-tools\adb.exe'

$list = & $adb devices
$serial = $list |
  ForEach-Object { if ($_ -match '^(\S+)\s+device\b') { $matches[1] } } |
  Select-Object -First 1

if (-not $serial) {
  Write-Output 'serial: none (wireless debugging not connected; try adb connect 192.168.1.184:46783)'
  $list | ForEach-Object { Write-Output "list: $_" }
  exit 0
}

Write-Output "serial: $serial"
Write-Output ('focus: ' + ((& $adb -s $serial shell dumpsys window | Select-String -Pattern 'mCurrentFocus') -join ' '))
Write-Output ('wake:  ' + ((& $adb -s $serial shell dumpsys power | Select-String -Pattern 'mWakefulness=') -join ' '))
Write-Output ('idle:  ' + ((& $adb -s $serial shell dumpsys deviceidle | Select-String -Pattern 'mState=') -join ' '))
Write-Output ('shade: ' + ((& $adb -s $serial shell dumpsys statusbar | Select-String -Pattern 'mPanelExpanded|panelEnabled') -join ' '))
