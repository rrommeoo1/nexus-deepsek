import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, validateRuntimeConfig } from "./lib/env.js";
import { resolveStaticRequest } from "./lib/static-policy.js";

loadEnv();
validateRuntimeConfig();
const [dbModule, repoModule, sseModule, apiModule, transportModule, outboxModule, nativeAuthSessionModule, emailAuthSessionModule, previewTestAccountModule] = await Promise.all([
  import("./lib/db.js"),
  import("./lib/repo.js"),
  import("./lib/sse.js"),
  import("./lib/api.js"),
  import("./lib/transport.js"),
  import("./lib/outbox.js"),
  import("./lib/native-auth-session.js"),
  import("./lib/email-auth-session.js"),
  import("./lib/preview-test-account.js"),
]);
const { openDb } = dbModule;
const { createRepo } = repoModule;
const { createSseHub } = sseModule;
const { handleRequest } = apiModule;
const { send } = transportModule;
const { createLocalOutboxHandlers, dispatchOutboxBatch } = outboxModule;
const { purgeExpiredNativeAuthConsumptions } = nativeAuthSessionModule;
const { purgeExpiredEmailAuthState } = emailAuthSessionModule;
const { ensurePreviewTestAccount } = previewTestAccountModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "public");
const LOCAL_CERT_DIR = join(HERE, ".certs");
const LOCAL_ROOT_CERT = join(LOCAL_CERT_DIR, "nexus-local-dev-root.cer");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  const policy = resolveStaticRequest(req.url);
  if (!policy.ok) return send(res, policy.status, "not found");
  const rel = policy.relativePath;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    return send(res, 404, "not found");
  }
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (!Object.prototype.hasOwnProperty.call(MIME, ext)) return send(res, 404, "not found");
  const body = readFileSync(filePath);
    const executableOrConfig = new Set([".html", ".css", ".js", ".json", ".webmanifest"]);
  return send(res, 200, body, {
    "content-type": MIME[ext],
    "cache-control": ext === ".html" ? "no-store" : (executableOrConfig.has(ext) ? "no-cache, max-age=0, must-revalidate" : "public, max-age=300"),
    "vary": "Accept-Encoding",
  });
}

function createApp({ db, repo, sse }) {
  return async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Origin-Agent-Cluster", "?1");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https://*.multiversx.com https://*.walletconnect.com wss://*.walletconnect.com; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    const urlPath = (req.url ?? "/").split("?")[0];
    if (urlPath === "/nexus-local-dev-root.cer" && existsSync(LOCAL_ROOT_CERT)) {
      return send(res, 200, readFileSync(LOCAL_ROOT_CERT), {
        "content-type": "application/x-x509-ca-cert",
        "content-disposition": "attachment; filename=nexus-local-dev-root.cer",
        "cache-control": "no-store",
      });
    }
    const isApi = urlPath === "/health" || urlPath.startsWith("/api/") || urlPath.startsWith("/auth/") || urlPath.startsWith("/media/");
    try {
      if (isApi) {
        return await handleRequest(req, res, { db, repo, sse });
      }
      return serveStatic(req, res);
    } catch (err) {
      // Fail closed without leaking internals or PII.
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({ ok: false, error: "internal error" }));
      // Log only a sanitized, non-PII message.
      const safePath = String(req.url ?? "/").split("?")[0].replace(/[^a-z0-9_./-]/gi, "").slice(0, 160) || "/";
      console.error(`[error] ${req.method} ${safePath} -> ${err?.message ?? "unknown"}`);
    }
  };
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const db = openDb();
const repo = createRepo(db);
ensurePreviewTestAccount(repo);
repo.reclassifyLegacyMedia();
repo.failOpenCallsOnStartup();
const sse = createSseHub();
const outboxHandlers = createLocalOutboxHandlers(repo, { sse });
const outboxTimer = setInterval(() => {
  try {
    repo.purgeExpiredMessages();
    repo.expireConversationCalls();
    repo.purgeExpiredSessions();
    purgeExpiredNativeAuthConsumptions(db);
    purgeExpiredEmailAuthState(db);
    dispatchOutboxBatch({ db, handlers: outboxHandlers, workerId: `local-${process.pid}`, limit: 25, maxAttempts: 5 });
  } catch (error) {
    console.error(`[outbox] local dispatch failed: ${String(error?.message ?? "unknown").replace(/[\r\n\t]/g, " ").slice(0, 160)}`);
  }
}, 1000);
outboxTimer.unref();

// Seed a single demo actor (marked SYSTEM_TEST in actors script, not here) is
// intentionally omitted: a fresh product starts empty. Actors are created and
// tagged by the separate actors script.

const server = createServer(createApp({ db, repo, sse }));
const servers = [server];

server.listen(port, host, () => {
  console.log(`Nexus running on http://${host}:${port}`);
  console.log(`On your phone (same Wi-Fi): http://<this-computer-LAN-IP>:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
});

const tlsPfxPath = process.env.NEXUS_TLS_PFX_PATH || join(LOCAL_CERT_DIR, "nexus-local-dev.pfx");
const httpsPort = Number(process.env.HTTPS_PORT || 3443);
if (existsSync(tlsPfxPath)) {
  const httpsServer = createHttpsServer({
    pfx: readFileSync(tlsPfxPath),
    passphrase: process.env.NEXUS_TLS_PASSPHRASE || "nexus-local-dev",
  }, createApp({ db, repo, sse }));
  servers.push(httpsServer);
  httpsServer.listen(httpsPort, host, () => {
    console.log(`Nexus secure camera origin: https://${host}:${httpsPort}`);
    console.log(`Install the local root once from http://<LAN-IP>:${port}/nexus-local-dev-root.cer`);
  });
}

function shutdown(signal) {
  console.log(`\n${signal} received — closing server and database.`);
  clearInterval(outboxTimer);
  let pending = servers.length;
  for (const activeServer of servers) activeServer.close(() => {
    pending--;
    if (pending === 0) { db.close(); process.exit(0); }
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
