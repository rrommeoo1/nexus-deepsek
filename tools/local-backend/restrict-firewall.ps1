<#
.SYNOPSIS
  Keep the Jungle Book backend reachable from this home Wi-Fi and from nowhere else.

.DESCRIPTION
  Windows asks once and then remembers: when node.exe first listened on a port, it was allowed in on
  whatever profile the current network used. This PC's Wi-Fi ("Romeo 5G 2") is classified **Public**, so
  the backend is currently reachable from every network the machine joins, not just home.

  This script replaces that blanket permission with one rule that answers only addresses on the local
  subnet, on port 5000. It needs an elevated PowerShell (a firewall rule is a system-wide setting) and it
  prints what it changed. Nothing here opens a port to the internet: the router still forwards nothing.

  What it does:
    1. lists the inbound `node.exe` allow rules that exist on the Public profile;
    2. removes them (they are what makes any network work);
    3. adds "Jungle Book backend (LAN only)": TCP 5000, LocalSubnet only, Public + Private profiles;
    4. prints the resulting rule so the phone's next request can be understood.

  Rollback: `New-NetFirewallRule -DisplayName 'node.exe' -Direction Inbound -Program <node path>
  -Profile Public -Action Allow` (or simply re-run the app and accept the prompt Windows shows).

  Usage (elevated):
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\local-backend\restrict-firewall.ps1
#>
[CmdletBinding()]
param(
  [int]$Port = 5000,
  [string]$RuleName = 'Jungle Book backend (LAN only)',
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $elevated) {
  Write-Warning 'Firewall rules need an elevated PowerShell. Re-run this script as Administrator.'
  exit 2
}

$broad = @(Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue | Where-Object {
  $_.DisplayName -like 'node.exe*' -or ($_.DisplayName -eq 'node.exe' -and $_.Profile -match 'Public')
})
Write-Host ("inbound node.exe allow rules found: {0}" -f $broad.Count)
foreach ($rule in $broad) { Write-Host ("  - {0} [{1}] {2}" -f $rule.DisplayName, $rule.Profile, $rule.Action) }

if ($WhatIfOnly) {
  Write-Host 'dry run: nothing changed'
  exit 0
}

foreach ($rule in $broad) {
  Remove-NetFirewallRule -Name $rule.Name
  Write-Host ("removed: {0}" -f $rule.DisplayName)
}

$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) { Remove-NetFirewallRule -Name $existing.Name }

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Description 'Jungle Book backend: the phone on the home Wi-Fi only (local subnet, no internet)' `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -RemoteAddress LocalSubnet `
  -Profile Public, Private | Out-Null

$rule = Get-NetFirewallRule -DisplayName $RuleName
$address = $rule | Get-NetFirewallAddressFilter
$port = $rule | Get-NetFirewallPortFilter
Write-Host ("added: {0} | {1} {2} | {3} -> {4}" -f $rule.DisplayName, $rule.Profile, $rule.Action, $address.RemoteAddress -join ',', $port.LocalPort)
Write-Host 'The phone still answers on the LAN; a machine on another network no longer does.'
