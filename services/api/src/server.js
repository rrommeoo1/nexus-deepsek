// HTTP server (Phase I.1, NX-CORE-API).
//
// Real Node HTTP server (no framework, no network egress, no secret). It exposes
// the minimal product surface backed by the durable JsonStore:
//   GET /health            -> liveness + counts
//   GET /me                -> identity + active persona (uses createMeHandler)
//   GET /profiles/:persona -> persona-scoped profile, deny-by-default
//
// The request is treated as an already-verified session (auth arrives later in
// NX-AUTH-RT). For now the server derives the session from headers so the
// persona ACL can be exercised end-to-end deterministically.

import { createServer } from "node:http";
import { normalizePersona } from "./identity.js";
import { createMeHandler } from "./handler.js";
import { loadMaps } from "./store.js";

function json(status, payload) {
  return { status, body: JSON.stringify(payload), headers: { "content-type": "application/json" } };
}

// Local demo session. NX-AUTH-RT replaces this with verified issuer-sub
// credentials; until then, headers carry exactly one identity + persona so the
// persona boundary can be tested end-to-end without cryptography.
function sessionFromRequest(req) {
  const id = String(req.headers["x-nexus-id"] ?? "u1");
  const persona = String(req.headers["x-nexus-persona"] ?? "social");
  return { authenticated: true, id, persona };
}

function send(res, { status, body, headers }) {
  res.writeHead(status, headers);
  res.end(body);
}

const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nexus Core API</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: #0b0f14; color: #e8eef4; display: flex; min-height: 100vh;
         align-items: center; justify-content: center; }
  .card { width: min(480px, 92vw); background: #121922; border: 1px solid #243244;
          border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(0,0,0,.45); }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 2px; margin-bottom: 4px; }
  .brand b { color: #20e0d0; }
  .sub { color: #8aa0b5; font-size: 13px; margin-bottom: 24px; }
  .row { display: flex; justify-content: space-between; align-items: center;
         border-top: 1px solid #1d2935; padding: 10px 0; font-size: 14px; }
  .row:first-of-type { border-top: none; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #62e8d8; }
  .badge { background: #12342e; color: #31e0c4; border: 1px solid #1d5f52;
           padding: 2px 10px; border-radius: 999px; font-size: 12px; }
  button { margin-top: 24px; width: 100%; padding: 12px; border: 1px solid #2e4a5c;
           background: #0f2530; color: #cfe9f2; border-radius: 10px; cursor: pointer;
           font-size: 14px; font-weight: 600; }
  button:hover { background: #123242; }
  pre { background: #0a1017; border: 1px solid #1d2935; border-radius: 10px;
        padding: 14px; font-size: 12px; overflow-x: auto; color: #b8e6d4; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">NE<b>X</b>US CORE API</div>
    <div class="sub">Primul serviciu real demo → produs · NX-CORE-API · local, date sintetice</div>
    <div class="row"><span>Stare</span><span class="badge">RUNNING</span></div>
    <div class="row"><span>Endpoint /health</span><span class="mono">GET :3001/health</span></div>
    <div class="row"><span>Endpoint /me</span><span class="mono">GET :3001/me</span></div>
    <div class="row"><span>Endpoint /profiles/:persona</span><span class="mono">GET :3001/profiles/social</span></div>
    <button id="load">Încarcă /health live</button>
    <pre id="out">apasă butonul pentru a interoga API-ul</pre>
  </main>
  <script>
    const out = document.getElementById('out');
    document.getElementById('load').onclick = async () => {
      out.textContent = 'interogare…';
      try {
        const r = await fetch('/health');
        const data = await r.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = 'eroare: ' + err.message;
      }
    };
  </script>
</body>
</html>`;

export function createNexusServer({ store }) {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = url.pathname;

    if (req.method === "GET" && route === "/") {
      return send(res, {
        status: 200,
        body: HOME_HTML,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (req.method === "GET" && route === "/health") {
      const { users, profiles } = loadMaps(store);
      return send(
        res,
        json(200, { ok: true, users: users.size, profiles: profiles.size })
      );
    }

    if (req.method === "GET" && route === "/me") {
      const { users, profiles } = loadMaps(store);
      const me = createMeHandler({ users, profiles });
      return send(res, me(sessionFromRequest(req)));
    }

    if (req.method === "GET" && route.startsWith("/profiles/")) {
      const persona = normalizePersona(route.slice("/profiles/".length));
      const { users, profiles } = loadMaps(store);
      const session = sessionFromRequest(req);

      if (!persona) {
        return send(res, json(400, { ok: false, error: "invalid persona" }));
      }

      if (!session.authenticated || !users.has(session.id)) {
        return send(res, json(401, { ok: false, error: "unknown identity" }));
      }

      // Hard persona isolation: the requested profile must match the session's
      // active persona exactly, deny-by-default.
      if (session.persona !== persona) {
        return send(res, json(401, { ok: false, error: "persona out of scope" }));
      }

      const profile = profiles.get(`${session.id}:${persona}`) ?? null;
      return send(
        res,
        json(200, { ok: true, identity: { id: session.id }, persona, profile })
      );
    }

    return send(res, json(404, { ok: false, error: "not found" }));
  });
}

export function startServer({ store, port = 3001, host = "0.0.0.0" }) {
  const server = createNexusServer({ store });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve({ server, port, host }));
  });
}