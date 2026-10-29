// Round 37 — the email system, tested through the real router and the real database.
//
// What is proven here, in the order the product promises it:
//
//   1. Registration stores a scrypt hash (never the password) and asks the provider adapter for a
//      confirmation message; the token exists only inside that message, never in the answer.
//   2. Invalid, expired and reused confirmation tokens are refused; a valid one marks the account.
//   3. Resending is rate-limited per address, and the answer does not change with account existence.
//   4. Password reset answers identically for a known and an unknown address, and a valid token
//      replaces the hash, revokes every session and cannot be replayed; the old password fails and
//      the new one signs in.
//   5. Production without a provider refuses with the exact missing variable names, and creates no
//      account; a provider failure leaves the account intact, creates no duplicate, and can be
//      retried; a 429 is retried and then succeeds.
//   6. Links carry the configured public origin, and no log line or response body carries a token,
//      a password or an API key.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { hashToken, verifyPassword } from "../lib/security.js";
import { isLocalOrigin, parseSender, resolveEmailConfig, resolveLinkOrigin } from "../lib/email/config.js";
import { emailLink, renderEmail } from "../lib/email/templates.js";
import { readCapturedMail } from "../lib/email/providers.js";

const PEER = "192.168.1.60";
const LINK_ORIGIN = "http://localhost:5000";

/**
 * The environment for one test, handed to the router as `ctx.env` (and to `lib/email/*`, which reads
 * nothing else). Nothing here writes to `process.env`, so two tests can never see each other's
 * provider, sender or public origin — the failure mode that made a capture-mode run look like a
 * broken token.
 */
async function withEnv(env, body) {
  return body(env);
}

const DEV_ENV = {
  NODE_ENV: "development",
  NEXUS_EMAIL_PROVIDER: "resend",
  NEXUS_EMAIL_API_KEY: "re_test_key_not_a_real_secret",
  NEXUS_EMAIL_FROM: "Jungle Book <noreply@junglebook.test>",
  NEXUS_EMAIL_LINK_ORIGIN: LINK_ORIGIN,
  NEXUS_EMAIL_MAX_ATTEMPTS: "2",
  NEXUS_EMAIL_RETRY_BASE_MS: "0",
  NEXUS_EMAIL_RESPONSE_FLOOR_MS: "0",
  NEXUS_EMAIL_TIMEOUT_MS: "2000",
  NEXUS_DEPLOYMENT_MODE: "local",
};

function request({ method = "POST", path, body = null, peer = PEER, headers = {} }) {
  const raw = body == null ? null : Buffer.from(JSON.stringify(body));
  return {
    method,
    url: path,
    headers: {
      host: "192.168.1.153:5000",
      ...(raw ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    socket: { remoteAddress: peer },
    on(event, callback) {
      if (event === "data" && raw) process.nextTick(() => callback(raw));
      if (event === "end") process.nextTick(callback);
      return this;
    },
    once() { return this; },
    destroy() {},
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers ?? {}); },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    end(value) { if (typeof value === "string") this.body = value; },
  };
}

/** One call through the router. `fetcher` is handed to the adapter, so no test touches the network. */
async function call(ctx, { method = "POST", path, body = null, peer = ctx.peer ?? PEER, headers = {} } = {}) {
  const res = response();
  await handleRequest(request({ method, path, body, peer, headers }), res, { ...ctx, fetcher: ctx.fetcher ?? undefined });
  let parsed = {};
  try { parsed = res.body ? JSON.parse(res.body) : {}; } catch { parsed = { raw: res.body }; }
  return { status: res.statusCode, headers: res.headers, body: parsed };
}

function boot(peer = PEER, env = DEV_ENV) {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  return { db, repo, sse, ctx: { db, repo, sse, peer, env } };
}

/**
 * A stand-in for `https://api.resend.com/emails`. `statuses` is consumed one per call (the last value
 * repeats), so a test can describe "429 then 200" or "500, 500" without a clock or a socket.
 */
function resendMock({ statuses = [200] } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), headers: { ...(init?.headers ?? {}) }, body });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    const payload = status < 300
      ? { id: `msg_${calls.length}` }
      : { name: "validation_error", message: "the test sender refused this message", statusCode: status };
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name) => (String(name).toLowerCase() === "retry-after" ? "0" : null) },
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    };
  };
  return { fetcher, calls };
}

/** The token that was actually mailed: parsed out of the adapter payload, never out of an API answer. */
function tokenFromMessage(call) {
  const text = String(call?.body?.text ?? "");
  const match = text.match(/[?&]token=([A-Za-z0-9_-]{20,})/);
  return match ? match[1] : "";
}
test("the configuration refuses to pretend: production without a provider names the missing variables", () => {
  const production = resolveEmailConfig({ NODE_ENV: "production" });
  assert.equal(production.configured, false);
  assert.equal(production.mode, "unconfigured");
  assert.deepEqual(production.missing, ["NEXUS_EMAIL_PROVIDER"]);

  const keyless = resolveEmailConfig({ NODE_ENV: "production", NEXUS_EMAIL_PROVIDER: "resend", NEXUS_EMAIL_FROM: "noreply@junglebook.test" });
  assert.equal(keyless.configured, false);
  assert.deepEqual(keyless.missing, ["NEXUS_EMAIL_API_KEY"]);

  const unknown = resolveEmailConfig({ NODE_ENV: "development", NEXUS_EMAIL_PROVIDER: "smtp" });
  assert.equal(unknown.configured, false, "an unknown provider name must not silently fall back");
  assert.equal(unknown.problems[0].code, "EMAIL_PROVIDER_UNKNOWN");

  // Development with nothing configured captures locally, and says so — it does not claim a provider.
  const development = resolveEmailConfig({ NODE_ENV: "development" });
  assert.equal(development.mode, "capture");
  assert.equal(development.configured, true);
  assert.deepEqual(development.warnings, ["CAPTURE_FALLBACK"]);

  // Capture can never be the answer in production.
  const captureInProduction = resolveEmailConfig({ NODE_ENV: "production", NEXUS_EMAIL_PROVIDER: "capture" });
  assert.equal(captureInProduction.configured, false);
  assert.equal(captureInProduction.problems[0].code, "EMAIL_CAPTURE_IN_PRODUCTION");
});

test("sender and link origins are validated, and a production link can never be localhost", () => {
  assert.deepEqual(parseSender("Jungle Book <Noreply@JungleBook.test>"), {
    address: "noreply@junglebook.test", name: "Jungle Book", display: "Jungle Book <noreply@junglebook.test>",
  });
  assert.equal(parseSender("not-an-address"), null);
  assert.equal(parseSender(""), null);

  assert.equal(isLocalOrigin("http://localhost:5000"), true);
  assert.equal(isLocalOrigin("http://192.168.1.153:5000"), true);
  assert.equal(isLocalOrigin("http://8.8.8.8:5000"), false);
  assert.equal(isLocalOrigin("https://app.junglebook.test"), false);

  assert.deepEqual(resolveLinkOrigin({ NODE_ENV: "production" }), { origin: "", source: "", code: "LINK_ORIGIN_MISSING" });
  assert.equal(resolveLinkOrigin({ NODE_ENV: "production", NEXUS_ORIGIN: "http://localhost:5000" }).code, "LINK_ORIGIN_INSECURE");
  assert.equal(resolveLinkOrigin({ NODE_ENV: "production", NEXUS_EMAIL_LINK_ORIGIN: "https://app.junglebook.test" }).origin, "https://app.junglebook.test");
  assert.equal(resolveLinkOrigin({ NODE_ENV: "development" }, "http://127.0.0.1:5000").origin, "http://127.0.0.1:5000");
  assert.equal(resolveLinkOrigin({ NODE_ENV: "development" }, "http://8.8.8.8:5000").code, "LINK_ORIGIN_INSECURE");
});

test("the templates carry the button, the fallback link and the expiry, and never a remote pixel", () => {
  const link = emailLink("http://localhost:5000", "reset-password.html", "abc123");
  assert.equal(link, "http://localhost:5000/reset-password.html?token=abc123");
  const verify = renderEmail("verify_email", { origin: "http://localhost:5000", token: "abc123", handle: "owner", minutes: 1440 });
  assert.match(verify.subject, /Confirm/);
  assert.match(verify.html, /href="http:\/\/localhost:5000\/verify-email\.html\?token=abc123"/);
  assert.match(verify.text, /http:\/\/localhost:5000\/verify-email\.html\?token=abc123/);
  assert.match(verify.html, /24 de ore/);
  assert.doesNotMatch(verify.html, /<img|tracking/i);
  assert.match(verify.html, /@owner/);

  const reset = renderEmail("reset_password", { origin: "http://localhost:5000", token: "abc123", handle: "owner", minutes: 30 });
  assert.match(reset.html, /reset-password\.html\?token=abc123/);
  assert.match(reset.text, /30 de minute/);

  const changed = renderEmail("password_changed", { handle: "owner" });
  assert.equal(changed.link, "");
  assert.doesNotMatch(changed.html, /href="http/);
  // A handle is user data: it is escaped before it reaches the body.
  const hostile = renderEmail("verify_email", { origin: "http://localhost:5000", token: "abc123", handle: "<script>alert(1)</script>" });
  assert.doesNotMatch(hostile.html, /<script>/);
  assert.match(hostile.html, /&lt;script&gt;/);
});


function captureConsole() {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => { lines.push(args.map(String).join(" ")); };
  }
  return {
    lines,
    restore() { Object.assign(console, original); },
    text() { return lines.join("\n"); },
  };
}

test("registration stores a hash, mails one confirmation, and never returns the token", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.61", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    const logs = captureConsole();
    try {
      const created = await call(ctx, {
        path: "/auth/email/register",
        body: { email: "Ana@JungleBook.test", password: "parola-123456", handle: "@ana", display_name: "Ana" },
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.created, true);
      assert.equal(created.body.email_verified, false);
      assert.equal(created.body.user.handle, "ana");
      assert.equal(created.body.verification.delivery, "provider");
      assert.equal(created.body.verification.delivered, true);

      const token = tokenFromMessage(mock.calls[0]);
      assert.ok(token.length >= 20, "the message must carry a real token");
      assert.equal(mock.calls.length, 1);
      assert.equal(mock.calls[0].url, "https://api.resend.com/emails");
      assert.match(String(mock.calls[0].headers.authorization), /^Bearer re_test/);
      assert.equal(mock.calls[0].body.from, "Jungle Book <noreply@junglebook.test>");
      assert.deepEqual(mock.calls[0].body.to, ["ana@junglebook.test"]);
      assert.match(String(mock.calls[0].body.html), /http:\/\/localhost:5000\/verify-email\.html\?token=/);

      // The token is in exactly one place: the message. Not in the answer, not in the log.
      assert.equal(JSON.stringify(created.body).includes(token), false);
      assert.equal(logs.text().includes(token), false);
      assert.equal(logs.text().includes("parola-123456"), false);

      const user = repo.getUserByEmail("ana@junglebook.test");
      assert.ok(user.password_hash);
      assert.notEqual(user.password_hash, "parola-123456");
      assert.equal(verifyPassword("parola-123456", user.password_hash), true);
      assert.equal(verifyPassword("parola-1234567", user.password_hash), false);
      assert.equal(user.email_verified, 0);

      const stored = db.prepare("SELECT * FROM email_tokens WHERE user_id = ?").get(user.id);
      assert.equal(stored.token_sha256, hashToken(token), "only the hash is stored");
      assert.equal(stored.purpose, "verify_email");
      assert.equal(stored.email, "ana@junglebook.test");
      assert.ok(stored.expires_at > Date.now(), "a confirmation link has a future expiry");
    } finally {
      logs.restore();
      db.close();
    }
  });
});

test("a confirmation token works once, and invalid, expired or reused tokens are refused", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.62", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    const logs = captureConsole();
    try {
      const created = await call(ctx, { path: "/auth/email/register", body: { email: "bogdan@junglebook.test", password: "parola-123456" } });
      assert.equal(created.status, 201);
      const token = tokenFromMessage(mock.calls[0]);

      const forged = await call(ctx, { path: "/auth/email/verification/confirm", body: { token: "z".repeat(43) } });
      assert.equal(forged.status, 400);
      assert.equal(forged.body.code, "EMAIL_TOKEN_INVALID");

      const first = await call(ctx, { path: "/auth/email/verification/confirm", body: { token } });
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.verified, true);
      assert.equal(first.body.handle, "bogdan");
      assert.equal(repo.getUserByEmail("bogdan@junglebook.test").email_verified, 1);
      // Confirming does not hand out a session: logging in stays a separate, deliberate step.
      assert.equal(first.headers["set-cookie"], undefined);

      const reuse = await call(ctx, { path: "/auth/email/verification/confirm", body: { token } });
      assert.equal(reuse.status, 400);
      assert.equal(reuse.body.code, "EMAIL_TOKEN_INVALID");

      // An expired link is refused even though it was never used.
      const second = await call(ctx, { path: "/auth/email/register", body: { email: "carmen@junglebook.test", password: "parola-123456" } });
      assert.equal(second.status, 201);
      const expiredToken = tokenFromMessage(mock.calls[1]);
      db.prepare("UPDATE email_tokens SET expires_at = ? WHERE token_sha256 = ?").run(Date.now() - 1000, hashToken(expiredToken));
      const expired = await call(ctx, { path: "/auth/email/verification/confirm", body: { token: expiredToken } });
      assert.equal(expired.status, 400);
      assert.equal(expired.body.code, "EMAIL_TOKEN_INVALID");
      assert.equal(repo.getUserByEmail("carmen@junglebook.test").email_verified, 0);
      assert.equal(logs.text().includes(expiredToken), false);
    } finally {
      logs.restore();
      db.close();
    }
  });
});


test("resending is rate-limited, and its answer does not change with account existence", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, ctx } = boot("192.168.1.63", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    try {
      await call(ctx, { path: "/auth/email/register", body: { email: "dana@junglebook.test", password: "parola-123456" } });
      const known = await call(ctx, { path: "/auth/email/verification/send", body: { email: "dana@junglebook.test" } });
      const unknown = await call(ctx, { path: "/auth/email/verification/send", body: { email: "nobody@junglebook.test" } });
      assert.equal(known.status, 202);
      assert.equal(unknown.status, 202);
      assert.deepEqual(known.body, unknown.body, "the two answers must be indistinguishable");
      assert.deepEqual(Object.keys(known.body).sort(), ["ok", "requested"]);
      // 60 s cooldown: the second request produced no second message.
      assert.equal(mock.calls.length, 1, "a cooldown must not send a second mail");

      let last = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        last = await call(ctx, { path: "/auth/email/verification/send", body: { email: "dana@junglebook.test" } });
        if (last.status === 429) break;
      }
      assert.equal(last.status, 429, "the fifth request in the hour is the last one accepted");
      assert.ok(Number(last.headers["retry-after"]) > 0);
    } finally {
      db.close();
    }
  });
});

test("a reset request answers identically for a known and an unknown address, and mails only to the real one", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, ctx } = boot("192.168.1.64", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    const logs = captureConsole();
    try {
      await call(ctx, { path: "/auth/email/register", body: { email: "elena@junglebook.test", password: "parola-123456" } });
      const known = await call(ctx, { path: "/auth/email/reset-request", body: { email: "elena@junglebook.test" } });
      const unknown = await call(ctx, { path: "/auth/email/reset-request", body: { email: "ghost@junglebook.test" } });
      assert.equal(known.status, 202);
      assert.equal(unknown.status, 202);
      assert.deepEqual(known.body, unknown.body);
      assert.deepEqual(Object.keys(known.body).sort(), ["ok", "requested"]);
      assert.equal(JSON.stringify(known.body).includes("token"), false);
      // One confirmation for the registration, one reset link for the real account, nothing for the ghost.
      assert.equal(mock.calls.length, 2);
      assert.match(String(mock.calls[1].body.subject), /Resetează parola/);
      const resetToken = tokenFromMessage(mock.calls[1]);
      assert.ok(resetToken.length >= 20);
      assert.equal(logs.text().includes(resetToken), false);
    } finally {
      logs.restore();
      db.close();
    }

test("a valid reset replaces the password, revokes every session, and cannot be replayed", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.65", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    let key = 0;
    try {
      await call(ctx, { path: "/auth/email/register", body: { email: "florin@junglebook.test", password: "parola-veche-123" } });
      // A real session exists before the reset, so "revoked" is measured, not assumed.
      const login = await call(ctx, {
        path: "/auth/email/login",
        body: { email: "florin@junglebook.test", password: "parola-veche-123" },
        headers: { "idempotency-key": `email-reset-login-${++key}` },
      });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      const userId = repo.getUserByEmail("florin@junglebook.test").id;
      assert.ok(db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(userId).n > 0);

      await call(ctx, { path: "/auth/email/reset-request", body: { email: "florin@junglebook.test" } });
      assert.equal(mock.calls.length, 2, `expected a reset message; got ${mock.calls.map((entry) => entry.body.subject).join(" | ")}`);
      const resetToken = tokenFromMessage(mock.calls[1]);

      const confirmed = await call(ctx, {
        path: "/auth/email/reset-confirm",
        body: { token: resetToken, password: "parola-noua-456" },
      });
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(confirmed.body.sessions_revoked, true);
      assert.equal(confirmed.body.handle, "florin");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(userId).n, 0);
      assert.equal(repo.getUserByEmail("florin@junglebook.test").password_reset_token, null);

      // The third message is the "your password changed" notice, and it carries no link at all.
      assert.equal(mock.calls.length, 3);
      assert.match(String(mock.calls[2].body.subject), /Parola Nexus a fost schimbată/);
      assert.doesNotMatch(String(mock.calls[2].body.text), /https?:\/\//);

      const oldPassword = await call(ctx, {
        path: "/auth/email/login",
        body: { email: "florin@junglebook.test", password: "parola-veche-123" },
        headers: { "idempotency-key": `email-reset-login-${++key}` },
      });
      assert.equal(oldPassword.status, 401);
      const newPassword = await call(ctx, {
        path: "/auth/email/login",
        body: { email: "florin@junglebook.test", password: "parola-noua-456" },
        headers: { "idempotency-key": `email-reset-login-${++key}` },
      });
      assert.equal(newPassword.status, 200, JSON.stringify(newPassword.body));

      const replay = await call(ctx, { path: "/auth/email/reset-confirm", body: { token: resetToken, password: "parola-treia-789" } });
      assert.equal(replay.status, 400);
      assert.equal(replay.body.code, "EMAIL_TOKEN_INVALID");
      // The replay changed nothing.
      const after = await call(ctx, {
        path: "/auth/email/login",
        body: { email: "florin@junglebook.test", password: "parola-noua-456" },
        headers: { "idempotency-key": `email-reset-login-${++key}` },
      });
      assert.equal(after.status, 200);
    } finally {
      db.close();
    }
  });
});

test("a weak new password is refused before the token is spent", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.66", env);
    const mock = resendMock();
    ctx.fetcher = mock.fetcher;
    try {
      await call(ctx, { path: "/auth/email/register", body: { email: "gina@junglebook.test", password: "parola-123456" } });
      await call(ctx, { path: "/auth/email/reset-request", body: { email: "gina@junglebook.test" } });
      const resetToken = tokenFromMessage(mock.calls[1]);
      const weak = await call(ctx, { path: "/auth/email/reset-confirm", body: { token: resetToken, password: "scurt" } });
      assert.equal(weak.status, 400);
      assert.equal(weak.body.code, "PASSWORD_INVALID");
      // The link is still usable: a rejected password must not burn it.
      const good = await call(ctx, { path: "/auth/email/reset-confirm", body: { token: resetToken, password: "parola-buna-456" } });
      assert.equal(good.status, 200, JSON.stringify(good.body));
      assert.equal(verifyPassword("parola-buna-456", repo.getUserByEmail("gina@junglebook.test").password_hash), true);
    } finally {
      db.close();
    }
  });
});

  });
});


test("production without a provider refuses with the missing names and creates no account", async () => {
  await withEnv({ NODE_ENV: "production", NEXUS_TRUST_PROXY: "1" }, async (env) => {
    const { db, ctx } = boot("192.168.1.67", env);
    try {
      const secure = { "x-forwarded-proto": "https" };
      const register = await call(ctx, { path: "/auth/email/register", body: { email: "hacker@junglebook.test", password: "parola-123456" }, headers: secure });
      assert.equal(register.status, 503);
      assert.equal(register.body.code, "EMAIL_NOT_CONFIGURED");
      assert.deepEqual(register.body.missing, ["NEXUS_EMAIL_PROVIDER"]);

      const reset = await call(ctx, { path: "/auth/email/reset-request", body: { email: "hacker@junglebook.test" }, headers: secure });
      assert.equal(reset.status, 503);
      assert.equal(reset.body.code, "EMAIL_NOT_CONFIGURED");

      const send = await call(ctx, { path: "/auth/email/verification/send", body: { email: "hacker@junglebook.test" }, headers: secure });
      assert.equal(send.status, 503);

      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0, "nothing may be created that cannot be confirmed");
    } finally {
      db.close();
    }
  });
});

test("a refusing provider leaves the account intact, creates no duplicate, and the retry works", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.68", env);
    const broken = resendMock({ statuses: [500, 500] });
    ctx.fetcher = broken.fetcher;
    try {
      const created = await call(ctx, { path: "/auth/email/register", body: { email: "horia@junglebook.test", password: "parola-123456" } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.verification.sent, false);
      assert.equal(created.body.verification.delivery, "failed");
      assert.equal(created.body.verification.code, "EMAIL_PROVIDER_REFUSED");
      assert.match(String(created.body.note), /nu a plecat/);
      // Two attempts were made (max_attempts=2) and no token was kept from a message nobody got.
      assert.equal(broken.calls.length, 2);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_tokens").get().n, 0);
      const user = repo.getUserByEmail("horia@junglebook.test");
      assert.equal(verifyPassword("parola-123456", user.password_hash), true);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);

      // Retrying the same registration must not create a second account nor change the password.
      const retried = await call(ctx, { path: "/auth/email/register", body: { email: "horia@junglebook.test", password: "alta-parola-999" } });
      assert.equal(retried.status, 202);
      assert.equal(retried.body.existing, true);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
      assert.equal(verifyPassword("parola-123456", repo.getUserByEmail("horia@junglebook.test").password_hash), true);

      // The provider recovers; the resend path is still open and the link works.
      const healthy = resendMock();
      ctx.fetcher = healthy.fetcher;
      const resent = await call(ctx, { path: "/auth/email/verification/send", body: { email: "horia@junglebook.test" } });
      assert.equal(resent.status, 202);
      assert.equal(healthy.calls.length, 1, "a failed send must not start the cooldown");
      const token = tokenFromMessage(healthy.calls[0]);
      const confirmed = await call(ctx, { path: "/auth/email/verification/confirm", body: { token } });
      assert.equal(confirmed.status, 200);
      assert.equal(repo.getUserByEmail("horia@junglebook.test").email_verified, 1);
    } finally {
      db.close();
    }
  });
});

test("a 429 is retried once and then delivered, and an already verified address is refused", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, repo, ctx } = boot("192.168.1.69", env);
    const mock = resendMock({ statuses: [429, 200] });
    ctx.fetcher = mock.fetcher;
    try {
      const created = await call(ctx, { path: "/auth/email/register", body: { email: "ioana@junglebook.test", password: "parola-123456" } });
      assert.equal(created.status, 201);
      assert.equal(created.body.verification.sent, true);
      assert.equal(created.body.verification.attempts, 2);
      assert.equal(mock.calls.length, 2);
      const token = tokenFromMessage(mock.calls[1]);
      await call(ctx, { path: "/auth/email/verification/confirm", body: { token } });
      assert.equal(repo.getUserByEmail("ioana@junglebook.test").email_verified, 1);

      const again = await call(ctx, { path: "/auth/email/register", body: { email: "ioana@junglebook.test", password: "parola-123456" } });
      assert.equal(again.status, 409);
      assert.equal(again.body.code, "EMAIL_TAKEN");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
    } finally {
      db.close();
    }
  });
});


test("development without a provider captures locally, says so, and the dev inbox is local-only", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-mail-capture-"));
  try {
    await withEnv({
      NODE_ENV: "development",
      NEXUS_DEPLOYMENT_MODE: "local",
      NEXUS_EMAIL_CAPTURE_DIR: directory,
      NEXUS_EMAIL_RESPONSE_FLOOR_MS: "0",
    }, async (env) => {
      const { db, ctx } = boot("192.168.1.70", env);
      try {
        const created = await call(ctx, { path: "/auth/email/register", body: { email: "jon@junglebook.test", password: "parola-123456" } });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.verification.delivery, "captured_locally");
        assert.equal(created.body.verification.delivered, false, "a capture is never a delivery");

        const written = readdirSync(directory).filter((name) => name.endsWith(".json"));
        assert.equal(written.length, 1);
        const captured = readCapturedMail(directory, { limit: 5 });
        assert.equal(captured.length, 1);
        assert.equal(captured[0].delivered, false);
        assert.match(captured[0].subject, /Confirm/);
        assert.match(captured[0].link, /^http:\/\/[^/]+\/verify-email\.html\?token=/);

        const inbox = await call(ctx, { method: "GET", path: "/api/dev/mail-capture" });
        assert.equal(inbox.status, 200);
        assert.equal(inbox.body.delivery, "captured_locally");
        assert.equal(inbox.body.messages.length, 1);
        assert.match(inbox.body.note, /netrimise/);

        // The same endpoint from a public address is not there at all.
        const remote = await call(ctx, { method: "GET", path: "/api/dev/mail-capture", peer: "8.8.8.8" });
        assert.equal(remote.status, 404);

        const token = String(captured[0].link).split("token=")[1];
        const confirmed = await call(ctx, { path: "/auth/email/verification/confirm", body: { token } });
        assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      } finally {
        db.close();
      }
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});


test("the capability probe reports the mail setup instead of offering a dead button", async () => {
  await withEnv(DEV_ENV, async (env) => {
    const { db, ctx } = boot("192.168.1.71", env);
    try {
      // A request from outside the home network is the honest vantage point for "what does this
      // server offer a stranger": the local-only flows are switched off there by the gate itself.
      const capabilities = await call(ctx, { method: "GET", path: "/api/auth-capabilities", peer: "8.8.8.8" });
      assert.equal(capabilities.status, 200);
      assert.equal(capabilities.body.email.configured, true);
      assert.equal(capabilities.body.email.provider, "resend");
      assert.equal(capabilities.body.email.delivery, "provider");
      assert.equal(capabilities.body.email.sender, "Jungle Book <noreply@junglebook.test>");
      assert.equal(capabilities.body.email.link_origin, LINK_ORIGIN);
      assert.equal(capabilities.body.email.recovery, true);
      assert.equal(capabilities.body.registration, "email");
      assert.equal(capabilities.body.password_recovery, "email");
      // Never the key, never a token.
      assert.equal(JSON.stringify(capabilities.body).includes("re_test_key"), false);

      // On this machine both worlds exist at once: the local flows the gate opens, and the mail flows.
      const localView = await call(ctx, { method: "GET", path: "/api/auth-capabilities" });
      assert.equal(localView.body.registration, "local-development");
      assert.equal(localView.body.email.configured, true);

      const status = await call(ctx, { method: "GET", path: "/api/email/status" });
      assert.equal(status.status, 200);
      assert.equal(status.body.email.provider, "resend");
      const remote = await call(ctx, { method: "GET", path: "/api/email/status", peer: "8.8.8.8" });
      assert.equal(remote.status, 404);
    } finally {
      db.close();
    }
  });
  // A server with no provider says exactly that, by variable name.
  await withEnv({ NODE_ENV: "production" }, async (env) => {
    const { db, ctx } = boot("192.168.1.72", env);
    try {
      const capabilities = await call(ctx, { method: "GET", path: "/api/auth-capabilities", headers: { "x-forwarded-proto": "https" } });
      assert.equal(capabilities.body.email.configured, false);
      assert.equal(capabilities.body.email.delivery, "unconfigured");
      assert.deepEqual(capabilities.body.email.missing, ["NEXUS_EMAIL_PROVIDER", "NEXUS_EMAIL_LINK_ORIGIN"]);
      assert.equal(capabilities.body.registration, "wallet_proof_required");
      assert.equal(capabilities.body.password_recovery, "unavailable");
    } finally {
      db.close();
    }
  });
});


test("the adapters speak the two provider APIs, capture writes a labelled file, and none pretends", async () => {
  const { createEmailProvider, recipientDomain } = await import("../lib/email/providers.js");
  assert.equal(recipientDomain("ana@junglebook.test"), "junglebook.test");
  assert.equal(recipientDomain(""), "");

  const directory = mkdtempSync(join(tmpdir(), "nexus-mail-adapter-"));
  try {
    const resendMocked = resendMock();
    const resend = createEmailProvider(resolveEmailConfig({
      NODE_ENV: "development", NEXUS_EMAIL_PROVIDER: "resend", NEXUS_EMAIL_API_KEY: "re_key",
      NEXUS_EMAIL_FROM: "Nexus <noreply@junglebook.test>", NEXUS_EMAIL_REPLY_TO: "support@junglebook.test",
    }), { fetchImpl: resendMocked.fetcher });
    const sent = await resend.send({ to: "ana@junglebook.test", subject: "s", html: "<p>x</p>", text: "x", kind: "verify_email", idempotencyKey: "k1" });
    assert.equal(sent.provider, "resend");
    assert.equal(sent.attempts, 1);
    assert.equal(resendMocked.calls[0].headers["idempotency-key"], "k1", "a retry carries the same key, so it cannot deliver twice");
    assert.equal(resendMocked.calls[0].body.reply_to, "support@junglebook.test");

    const brevoMocked = resendMock();
    const brevo = createEmailProvider(resolveEmailConfig({
      NODE_ENV: "development", NEXUS_EMAIL_PROVIDER: "brevo", NEXUS_EMAIL_API_KEY: "xkeysib-test",
      NEXUS_EMAIL_FROM: "Jungle Book <noreply@junglebook.test>",
    }), { fetchImpl: brevoMocked.fetcher });
    await brevo.send({ to: "ana@junglebook.test", subject: "s", html: "<p>x</p>", text: "x", kind: "verify_email" });
    assert.equal(brevoMocked.calls[0].url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(brevoMocked.calls[0].headers["api-key"], "xkeysib-test");
    assert.deepEqual(brevoMocked.calls[0].body.to, [{ email: "ana@junglebook.test" }]);
    assert.equal(brevoMocked.calls[0].body.htmlContent, "<p>x</p>");
    assert.deepEqual(brevoMocked.calls[0].body.sender, { email: "noreply@junglebook.test", name: "Jungle Book" });

    const capture = createEmailProvider(resolveEmailConfig({ NODE_ENV: "development", NEXUS_EMAIL_CAPTURE_DIR: directory }), { now: () => 1_700_000_000_000 });
    const captured = await capture.send({ to: "ana@junglebook.test", subject: "Confirm", html: "<p>x</p>", text: "https://localhost/verify\n", kind: "verify_email" });
    assert.equal(captured.captured, true);
    const files = readCapturedMail(directory, { limit: 5 });
    assert.equal(files.length, 1);
    assert.equal(files[0].delivered, false);
    assert.equal(files[0].link, "https://localhost/verify");

    // An unconfigured provider refuses instead of pretending.
    const none = createEmailProvider(resolveEmailConfig({ NODE_ENV: "production" }), {});
    await assert.rejects(() => none.send({ to: "ana@junglebook.test" }), /nu este configurat/);

    // A permanent refusal (400) is not retried: the same request would be refused again.
    const permanent = resendMock({ statuses: [400] });
    const strict = createEmailProvider(resolveEmailConfig({
      NODE_ENV: "development", NEXUS_EMAIL_PROVIDER: "resend", NEXUS_EMAIL_API_KEY: "re_key",
      NEXUS_EMAIL_FROM: "noreply@junglebook.test", NEXUS_EMAIL_MAX_ATTEMPTS: "3", NEXUS_EMAIL_RETRY_BASE_MS: "0",
    }), { fetchImpl: permanent.fetcher, sleep: async () => {} });
    await assert.rejects(() => strict.send({ to: "ana@junglebook.test", subject: "s", html: "", text: "", kind: "verify_email" }), /a refuzat mesajul/);
    assert.equal(permanent.calls.length, 1, "a 4xx must not be retried");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

