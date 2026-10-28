# A throwaway public URL for the local backend, for one test — not a permanent arrangement.
#
# `trycloudflare.com` needs no account, which is exactly what makes it useful for a single proof and
# exactly what makes it wrong as a home: the address changes on every start, there is no uptime promise,
# and it disappears the moment the process stops. The API is still behind its own session — a stranger who
# opens the URL reaches the login page, not the data — but a public address that nobody is watching is a
# decision, so this script says out loud what it is doing and exits when you press Ctrl+C.
#
#   powershell -ExecutionPolicy Bypass -File tools\remote-access\start-quick-tunnel.ps1
param(
  [string]$LocalService = 'http://127.0.0.1:5000',
  [int]$Minutes = 30
)

$ErrorActionPreference = 'Stop'
$exe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $exe) {
  $found = Get-ChildItem 'C:\Program Files*\cloudflared\cloudflared.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $exe = $found.FullName }
}
if (-not $exe) {
  Write-Output 'cloudflared is not installed. Install it first:'
  Write-Output '  winget install --id Cloudflare.cloudflared'
  exit 2
}

Write-Output "starting a temporary tunnel to $LocalService"
Write-Output "it will stop by itself after $Minutes minutes; press Ctrl+C to stop it sooner"
Write-Output 'the address it prints is public. Treat it as borrowed, not as your endpoint.'
Write-Output ''

$log = Join-Path $env:TEMP 'jungle-quick-tunnel.log'
$process = Start-Process -FilePath $exe -ArgumentList 'tunnel','--no-autoupdate','--url',$LocalService -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(45)
$url = $null
while ((Get-Date) -lt $deadline -and -not $url) {
  Start-Sleep -Milliseconds 700
  foreach ($file in @($log, "$log.err")) {
    if (Test-Path $file) {
      $match = (Get-Content $file -Raw) | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -First 1
      if ($match) { $url = $match.Matches[0].Value; break }
    }
  }
}

if (-not $url) {
  Write-Output 'the tunnel did not report an address; log follows'
  if (Test-Path $log) { Get-Content $log -Tail 20 }
  if (Test-Path "$log.err") { Get-Content "$log.err" -Tail 20 }
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  exit 3
}

Write-Output "public address: $url"
try {
  $version = Invoke-RestMethod -Uri "$url/api/version" -TimeoutSec 20
  Write-Output "answered: commit $($version.commit_short), capabilities $((($version.capabilities.PSObject.Properties.Name) -join ', '))"
} catch {
  Write-Output "the address did not answer /api/version yet: $($_.Exception.Message)"
}
Write-Output ''
Write-Output "to use it: EXPO_PUBLIC_NEXUS_API_URL=$url in apps\nexus-mobile\.env, then restart Metro with --clear"
Write-Output "stopping in $Minutes minutes, or press Ctrl+C now"

$until = (Get-Date).AddMinutes($Minutes)
while ((Get-Date) -lt $until) {
  Start-Sleep -Seconds 5
  if ($process.HasExited) { Write-Output 'cloudflared exited'; break }
}
Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
Write-Output 'tunnel closed'
