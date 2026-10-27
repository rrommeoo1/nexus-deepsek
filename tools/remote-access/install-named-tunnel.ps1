# Installs a named Cloudflare Tunnel as a Windows service, pointing at the local backend.
#
# It needs one thing this machine cannot invent: a tunnel token from Cloudflare Zero Trust
# (Networks -> Tunnels -> Create a tunnel -> Cloudflared). The token is read from
# C:\Nexus\env\cloudflared.env (TUNNEL_TOKEN=...), which is never committed and never printed.
#
#   powershell -ExecutionPolicy Bypass -File tools\remote-access\install-named-tunnel.ps1
param(
  [string]$NexusHome = 'C:\Nexus',
  [string]$LocalService = 'http://127.0.0.1:5000',
  [string]$Cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
)

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $NexusHome 'env\cloudflared.env'

if (-not (Test-Path $envFile)) {
  Write-Output "missing $envFile"
  Write-Output 'Create it with one line: TUNNEL_TOKEN=<token from Cloudflare Zero Trust>'
  Write-Output 'Nothing else on this machine can supply that token; see tools\remote-access\README.md.'
  exit 2
}

$token = (Get-Content $envFile | Where-Object { $_ -match '^\s*TUNNEL_TOKEN\s*=' } | Select-Object -First 1)
$value = if ($token) { ($token -split '=', 2)[1].Trim() } else { '' }
if ($value.Length -lt 20) {
  Write-Output 'TUNNEL_TOKEN is empty or too short; refusing to install a tunnel without one'
  exit 3
}

if (-not (Test-Path $Cloudflared)) {
  Write-Output "cloudflared is not installed; installing it with winget"
  winget install --id Cloudflare.cloudflared --silent --accept-package-agreements --accept-source-agreements
  $found = Get-ChildItem 'C:\Program Files*\cloudflared\cloudflared.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $Cloudflared = $found.FullName } else { Write-Output 'could not find cloudflared.exe after installing it'; exit 4 }
}
Write-Output "cloudflared: $Cloudflared"

# The service reads the token from its own configuration, so a restart needs no secret on a command line.
& $Cloudflared service uninstall 2>$null | Out-Null
& $Cloudflared service install $value --url $LocalService
if ($LASTEXITCODE -ne 0) { Write-Output "service install failed with $LASTEXITCODE"; exit 5 }

Start-Sleep -Seconds 4
Get-Service -Name 'cloudflared' -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize | Out-String

Write-Output 'Now in the Cloudflare dashboard:'
Write-Output "  - the tunnel's public hostname -> service: $LocalService"
Write-Output '  - note the hostname, and put it in apps\nexus-mobile\.env as EXPO_PUBLIC_NEXUS_API_URL=https://<hostname>'
Write-Output '  - restart Metro with --clear so the new origin is baked into the bundle'
Write-Output 'Proof it works from outside: https://<hostname>/api/version should answer with this build.'
