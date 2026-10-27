# Reaching the backend from outside the home network

The phone talks to `http://192.168.1.153:5000` on the LAN. That address stops working the moment the
phone leaves the house, so remote access needs a public name in front of the same server. Two paths are
prepared here; both keep the API authenticated and neither opens a database port.

## What is never done

- No port forwarding of `5000` or of any database port to the internet.
- No disabling of TLS verification, and no "just use http for now" on a public address.
- No anonymous access: every route except `/health`, `/api/version` and the login pages still requires a
  session, exactly as it does on the LAN.

## Path A — Cloudflare Tunnel (recommended)

A named tunnel gives a stable hostname, terminates TLS at Cloudflare's edge, and reconnects by itself if
the PC's connection drops. It needs two things only the owner can provide:

1. a Cloudflare account with a domain (the free plan is enough);
2. a tunnel **token** from Cloudflare Zero Trust → Networks → Tunnels → *Create a tunnel* → *Cloudflared*.

When that token exists:

```powershell
# put the token in one line, in a file that is never committed
notepad C:\Nexus\env\cloudflared.env     # TUNNEL_TOKEN=<the token>
powershell -ExecutionPolicy Bypass -File tools\remote-access\install-named-tunnel.ps1
```

The script installs `cloudflared` as a Windows service (it starts with the machine and restarts itself),
points it at `http://127.0.0.1:5000`, and prints the public hostname you configured in the dashboard. Then
point the app at that hostname:

```
# apps/nexus-mobile/.env
EXPO_PUBLIC_NEXUS_API_URL=https://jungle.<your-domain>
```

and restart Metro with `--clear` so the new value is baked into the bundle.

In the Cloudflare dashboard, set the tunnel's public hostname to the local service
`http://127.0.0.1:5000`, and keep **no** path-based bypass: the app's own login is the authorisation.

## Path B — Tailscale (no domain, private network)

Tailscale puts the phone and the PC on one private network, so the backend keeps its own address and
nothing is published. It needs a Tailscale account on both devices.

```powershell
winget install --id Tailscale.Tailscale --silent
# sign in on the PC, install the app on the phone, sign in with the same account
tailscale ip -4            # e.g. 100.101.102.103
```

Then `EXPO_PUBLIC_NEXUS_API_URL=http://100.101.102.103:5000` and Metro restarted. Traffic is encrypted by
WireGuard end to end; the address is stable for as long as the device stays in the tailnet.

## Path C — a throwaway quick tunnel (a test, not a home)

`start-quick-tunnel.ps1` starts a `trycloudflare.com` URL with no account. It is useful to prove the
tunnel path works once, and it is wrong as a permanent arrangement: the URL changes on every start, and it
has no uptime guarantee. The script says so when it prints the address.

```powershell
powershell -ExecutionPolicy Bypass -File tools\remote-access\start-quick-tunnel.ps1
```

## How to tell which one the phone is using

`GET /api/version` answers with the build and the fingerprint, and the app prints the origin it was built
with on the shell (`API: local`, `API: Railway`, or the host name — `src/lib/apiOrigin.ts`). Nothing has to
be guessed: the label and the server's own request log (`C:\Nexus\logs\server-*.log`, `[req]` lines) name
the same address.
