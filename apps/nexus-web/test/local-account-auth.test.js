// Round 36 — the local-development account contract, tested through the real router.
//
// What is proven here, in order: the gate refuses everything that is not an explicit local deployment
// reached from a private address; registration creates a brand-new hashed account and a session, and
// never adopts an existing handle; login accepts email **or** handle; password recovery rewrites the
// hash, revokes the old sessions and refuses accounts that have no password; and the xPortal init
// answers an actionable, sanitized 503 — or a real init on loopback.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import {
  LOCAL_ACCOUNT_FLOW, isPrivatePeer, localAccountGate, normalizeLocalHandle,
  readLocalIdentifier, validateLocalPassword,
} from "../lib/local-account.js";
import { walletConnectAttestationReport } from "../lib/env.js";

const LOCAL_ENV = { NODE_ENV: "development", NEXUS_DEPLOYMENT_MODE: "local" };
const PEER = "192.168.1.50";

/** Set the variables a local deployment has, run the body, then put the environment back exactly. */
async function withEnv(overrides, body) {
  const keys = ["NODE_ENV", "NEXUS_DEPLOYMENT_MODE", "NEXUS_LOCAL_ACCOUNTS", "NEXUS_TRUST_PROXY",
    "NEXUS_WC_PROJECT_ID", "NEXUS_WC_PROJECT_ATTESTED", "NEXUS_WC_ATTESTED_ORIGINS", "NEXUS_ORIGIN",
    // Round 37: the capability probe also reports the mail setup, so the ambient mail variables are
    // cleared here too — otherwise a developer's own `.env` would decide what this test proves.
    "NEXUS_EMAIL_PROVIDER", "NEXUS_EMAIL_API_KEY", "NEXUS_EMAIL_FROM", "NEXUS_EMAIL_LINK_ORIGIN",
    "NEXUS_EMAIL_CAPTURE_DIR"];
  const previous = new Map();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return await body();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request({ method = "POST", path, body = null, cookie = "", headers = {}, peer = PEER, key = "" }) {
  const raw = body == null ? null : Buffer.from(JSON.stringify(body));
  return {
    method,
    url: path,
    headers: {
      host: "192.168.1.153:5000",
      ...(raw ? { "content-type": "application/json" } : {}),
      ...(key ? { "idempotency-key": key } : {}),
      ...(cookie ? { cookie } : {}),
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

function readCookies(res) {
  const raw = res.headers["set-cookie"] ?? res.headers["Set-Cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = {};
  for (const entry of list) {
    const pair = String(entry).split(";")[0];
    const at = pair.indexOf("=");
    if (at > 0) found[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1));
  }
  return found;
}

let loginKeys = 0;

async function call(context, options) {
  // `/auth/email/login` sits behind the same replay boundary as every mutation: one key per attempt.
  const prepared = options.path === "/auth/email/login" && options.key === undefined
    ? { ...options, key: `local-account-login-${++loginKeys}` }
    : options;
  const res = response();
  const ctx = prepared.fetcher ? { ...context, fetcher: prepared.fetcher } : context;
  await handleRequest(request({ peer: context.peer ?? PEER, ...prepared }), res, ctx);
  return { status: res.statusCode, headers: res.headers, body: res.body ? JSON.parse(res.body) : {}, cookies: readCookies(res) };
}

/**
 * A fresh database per test. Each test also gets its own private peer address, because the auth rate
 * limiter is a module-level bucket keyed by `peer:subject` and the suite shares one process.
 */
function boot(peer = PEER) {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  return { db, repo, ctx: { db, repo, sse, peer } };
}

test("the local gate needs an explicit local deployment reached from a private address", () => {
  assert.equal(localAccountGate({ NODE_ENV: "production", NEXUS_DEPLOYMENT_MODE: "local" }, PEER).enabled, false);
  assert.equal(localAccountGate({ NODE_ENV: "development" }, PEER).reason, "not_a_local_deployment");
  assert.equal(localAccountGate({ NODE_ENV: "development", NEXUS_DEPLOYMENT_MODE: "preview" }, PEER).enabled, false);
  assert.equal(localAccountGate(LOCAL_ENV, "8.8.8.8").reason, "remote_peer");
  assert.equal(localAccountGate({ ...LOCAL_ENV, NEXUS_LOCAL_ACCOUNTS: "0" }, PEER).reason, "switched_off");
  assert.equal(localAccountGate(LOCAL_ENV, PEER).enabled, true);
  assert.equal(localAccountGate(LOCAL_ENV, "::ffff:192.168.1.50").enabled, true);
  assert.equal(localAccountGate(LOCAL_ENV, "127.0.0.1").enabled, true);
  for (const peer of ["192.168.1.50", "10.1.2.3", "172.20.0.9", "127.0.0.1", "::ffff:172.16.5.5", "::1"]) {
    assert.equal(isPrivatePeer(peer), true, peer);
  }
  for (const peer of ["8.8.8.8", "172.32.0.1", "", "abc"]) assert.equal(isPrivatePeer(peer), false, peer);
});

test("handles, passwords and identifiers are read exactly, never trimmed into something else", () => {
  assert.equal(normalizeLocalHandle("@Ana_Maria"), "ana_maria");
  assert.equal(normalizeLocalHandle(" ana "), "ana");
  assert.equal(normalizeLocalHandle("a"), "");
  assert.equal(normalizeLocalHandle("ana-maria"), "");
  assert.equal(normalizeLocalHandle("übung"), "");
  // A space and punctuation belong to the password: they must survive into the hash.
  assert.deepEqual(validateLocalPassword("  pa ro!lã  "), { ok: true, error: "" });
  assert.equal(validateLocalPassword("scurt").ok, false);
  assert.equal(validateLocalPassword("        ").ok, false);
  assert.equal(validateLocalPassword("x".repeat(257)).ok, false);
  assert.equal(validateLocalPassword(undefined).ok, false);
  assert.deepEqual(readLocalIdentifier("Owner@Nexus.ro"), { kind: "email", value: "owner@nexus.ro" });
  assert.deepEqual(readLocalIdentifier("@Ana_Maria"), { kind: "handle", value: "ana_maria" });
  assert.deepEqual(readLocalIdentifier("ana_maria"), { kind: "handle", value: "ana_maria" });
  assert.equal(readLocalIdentifier("not an email"), null);
  assert.equal(readLocalIdentifier(""), null);
});

test("a local account is created hashed, session-ready and without secrets in the answer", async () => {
  await withEnv(LOCAL_ENV, async () => {
    const { db, repo, ctx } = boot("192.168.1.52");
    try {
      const secret = "  pa ro!lã TĂCUT  ";
      const registered = await call(ctx, {
        path: "/auth/local/register",
        body: { handle: "@Owner", password: secret, email: "Owner@Nexus.ro", display_name: "Owner" },
      });
      assert.equal(registered.status, 201);
      assert.equal(registered.body.ok, true);
      assert.equal(registered.body.flow, LOCAL_ACCOUNT_FLOW);
      assert.equal(registered.body.session_ready, true);
      assert.equal(registered.body.user.handle, "owner");
      assert.equal(registered.body.user.email, "owner@nexus.ro");
      assert.ok(registered.cookies.nexus_session, "registration must hand back a session cookie");
      assert.ok(registered.cookies.nexus_device_id);
      const answer = JSON.stringify(registered.body);
      assert.doesNotMatch(answer, /password_hash|scrypt|salt|"hash"/i);
      assert.equal(answer.includes(secret), false);

      const row = repo.getUserByHandle("owner");
      assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
      assert.equal(row.password_hash.includes("pa ro"), false);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM personas WHERE user_id = ?").get(row.id).n, 5);

      // The session works immediately.
      const cookie = `nexus_session=${registered.cookies.nexus_session}`;
      const me = await call(ctx, { method: "GET", path: "/api/me", cookie });
      assert.equal(me.status, 200);
      assert.equal(me.body.user.handle, "owner");

      // Then the normal login screen, by handle and by email, with the password typed exactly as before.
      const byHandle = await call(ctx, { path: "/auth/email/login", body: { email: "owner", password: secret } });
      assert.equal(byHandle.status, 200);
      assert.equal(byHandle.body.user.handle, "owner");
      const byEmail = await call(ctx, { path: "/auth/email/login", body: { email: "OWNER@nexus.ro", password: secret } });
      assert.equal(byEmail.status, 200);

      // A password that differs by one character, and an account that does not exist, answer the same.
      const wrong = await call(ctx, { path: "/auth/email/login", body: { email: "owner", password: "  pa ro!lã TĂCUT" } });
      assert.equal(wrong.status, 401);
      const unknown = await call(ctx, { path: "/auth/email/login", body: { email: "nobody@nexus.local", password: secret } });
      assert.equal(unknown.status, 401);
      assert.deepEqual(unknown.body, wrong.body);
    } finally {
      db.close();
    }
  });
});

test("duplicates and invalid fields are refused, and an existing handle is never adopted", async () => {
  await withEnv(LOCAL_ENV, async () => {
    const { db, repo, ctx } = boot("192.168.1.51");
    try {
      // A migrated identity: handle "test", no email, no password. This is the row round 35 found.
      const migrated = repo.createUser({ handle: "test", displayName: "Test" });
      const first = await call(ctx, {
        path: "/auth/local/register",
        body: { handle: "owner", password: "parola-123456", email: "owner@nexus.ro" },
      });
      assert.equal(first.status, 201);

      const duplicateHandle = await call(ctx, { path: "/auth/local/register", body: { handle: "@OWNER", password: "parola-123456" } });
      assert.equal(duplicateHandle.status, 409);
      assert.equal(duplicateHandle.body.code, "HANDLE_TAKEN");
      const duplicateEmail = await call(ctx, {
        path: "/auth/local/register",
        body: { handle: "other", password: "parola-123456", email: "OWNER@nexus.ro" },
      });
      assert.equal(duplicateEmail.status, 409);
      assert.equal(duplicateEmail.body.code, "EMAIL_TAKEN");

      // The migrated handle is refused rather than claimed, and its row is untouched.
      const adoption = await call(ctx, { path: "/auth/local/register", body: { handle: "test", password: "parola-123456" } });
      assert.equal(adoption.status, 409);
      const untouched = repo.getUserById(migrated.id);
      assert.equal(untouched.password_hash, null);
      assert.equal(untouched.email, null);
      assert.equal(untouched.handle, "test");

      for (const [body, code] of [
        [{ handle: "a", password: "parola-123456" }, "HANDLE_INVALID"],
        [{ handle: "ana maria", password: "parola-123456" }, "HANDLE_INVALID"],
        [{ handle: "shortpw", password: "scurt" }, "PASSWORD_INVALID"],
        [{ handle: "blankpw", password: "        " }, "PASSWORD_INVALID"],
        [{ handle: "bademail", password: "parola-123456", email: "nu-e-email" }, "EMAIL_INVALID"],
      ]) {
        const refused = await call(ctx, { path: "/auth/local/register", body });
        assert.equal(refused.status, 400, code);
        assert.equal(refused.body.code, code);
        assert.ok(refused.body.error.length > 3);
      }
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 2);
    } finally {
      db.close();
    }
  });
});

test("local password recovery rewrites the hash, revokes the old sessions and refuses passwordless accounts", async () => {
  await withEnv(LOCAL_ENV, async () => {
    const { db, repo, ctx } = boot("192.168.1.53");
    try {
      const registered = await call(ctx, { path: "/auth/local/register", body: { handle: "owner", password: "prima-parola" } });
      assert.equal(registered.status, 201);
      const oldCookie = `nexus_session=${registered.cookies.nexus_session}`;
      assert.equal((await call(ctx, { method: "GET", path: "/api/me", cookie: oldCookie })).status, 200);

      const unknown = await call(ctx, { path: "/auth/local/password-reset", body: { identifier: "nimeni", password: "a-doua-parola" } });
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.code, "ACCOUNT_NOT_FOUND");
      const badPassword = await call(ctx, { path: "/auth/local/password-reset", body: { identifier: "owner", password: "scurt" } });
      assert.equal(badPassword.status, 400);

      const reset = await call(ctx, { path: "/auth/local/password-reset", body: { identifier: "@owner", password: "a-doua-parola" } });
      assert.equal(reset.status, 200);
      assert.equal(reset.body.sessions_revoked, true);
      assert.equal(reset.body.flow, LOCAL_ACCOUNT_FLOW);
      assert.doesNotMatch(JSON.stringify(reset.body), /password_hash|scrypt|salt/i);

      // The old password is dead, the old session is dead, the new password works.
      assert.equal((await call(ctx, { path: "/auth/email/login", body: { email: "owner", password: "prima-parola" } })).status, 401);
      assert.equal((await call(ctx, { method: "GET", path: "/api/me", cookie: oldCookie })).status, 401);
      const fresh = await call(ctx, { path: "/auth/email/login", body: { email: "owner", password: "a-doua-parola" } });
      assert.equal(fresh.status, 200);

      // A migrated identity with no password cannot be given one from an unauthenticated form.
      repo.createUser({ handle: "test", displayName: "Test" });
      const takeover = await call(ctx, { path: "/auth/local/password-reset", body: { identifier: "test", password: "a-doua-parola" } });
      assert.equal(takeover.status, 409);
      assert.equal(takeover.body.code, "ACCOUNT_WITHOUT_PASSWORD");
      assert.equal(repo.getUserByHandle("test").password_hash, null);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL").get().n, 1);
    } finally {
      db.close();
    }
  });
});

test("production and remote peers cannot reach the local account routes at all", async () => {
  await withEnv({ NODE_ENV: "production", NEXUS_DEPLOYMENT_MODE: "local", NEXUS_TRUST_PROXY: "1" }, async () => {
    const { db, ctx } = boot("192.168.1.54");
    try {
      const secure = { "x-forwarded-proto": "https" };
      const register = await call(ctx, { path: "/auth/local/register", body: { handle: "owner", password: "parola-123456" }, headers: secure });
      assert.equal(register.status, 404);
      const reset = await call(ctx, { path: "/auth/local/password-reset", body: { identifier: "owner", password: "parola-123456" }, headers: secure });
      assert.equal(reset.status, 404);
      const capabilities = await call(ctx, { method: "GET", path: "/api/auth-capabilities", headers: secure });
      assert.equal(capabilities.body.registration, "wallet_proof_required");
      assert.equal(capabilities.body.password_recovery, "unavailable");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
    } finally {
      db.close();
    }
  });
  await withEnv(LOCAL_ENV, async () => {
    const { db, ctx } = boot("8.8.8.8");
    try {
      const register = await call(ctx, { path: "/auth/local/register", body: { handle: "owner", password: "parola-123456" } });
      assert.equal(register.status, 404);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
    } finally {
      db.close();
    }
  });
});

test("the capability probe says which flows this server really has", async () => {
  await withEnv(LOCAL_ENV, async () => {
    const { db, ctx } = boot("192.168.1.55");
    try {
      const capabilities = await call(ctx, { method: "GET", path: "/api/auth-capabilities" });
      assert.equal(capabilities.status, 200);
      assert.equal(capabilities.body.registration, LOCAL_ACCOUNT_FLOW);
      assert.equal(capabilities.body.password_recovery, LOCAL_ACCOUNT_FLOW);
      assert.equal(capabilities.body.login.email_password, true);
      assert.equal(capabilities.body.login.handle_password, true);
      assert.equal(capabilities.body.deployment, "local");
      assert.equal(capabilities.body.wallet.ready, false);
      assert.deepEqual(capabilities.body.wallet.missing, ["NEXUS_WC_PROJECT_ID", "NEXUS_WC_PROJECT_ATTESTED", "NEXUS_WC_ATTESTED_ORIGINS (http://192.168.1.153:5000)"]);
      assert.equal(JSON.stringify(capabilities.body).includes("WALLETCONNECT_PROJECT"), false);
    } finally {
      db.close();
    }
  });
});

test("xPortal init names the missing pieces instead of one vague sentence, and needs no network", async () => {
  await withEnv(LOCAL_ENV, async () => {
    const { db, ctx } = boot("192.168.1.56");
    let calls = 0;
    try {
      const response = await call(ctx, {
        method: "GET",
        path: "/auth/mvx/init",
        headers: { host: "192.168.1.153:5000" },
        fetcher: async () => { calls += 1; throw new Error("must not run"); },
      });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "WALLETCONNECT_PROJECT_NOT_ATTESTED");
      assert.equal(response.body.origin, "http://192.168.1.153:5000");
      assert.deepEqual(response.body.missing, ["NEXUS_WC_PROJECT_ID", "NEXUS_WC_PROJECT_ATTESTED", "NEXUS_WC_ATTESTED_ORIGINS (http://192.168.1.153:5000)"]);
      assert.match(response.body.error, /WalletConnect Dashboard/);
      assert.match(response.body.hint, /localhost:5000/);
      assert.equal(calls, 0, "a rejected origin must not touch the MultiversX API");
    } finally {
      db.close();
    }
  });
});

test("loopback is attested for local development, a LAN address is not, and explicit config still wins", async () => {
  const blockHash = "a".repeat(64);
  const fetcher = async () => ({ json: async () => [{ hash: blockHash }] });
  await withEnv(LOCAL_ENV, async () => {
    const { db, ctx } = boot("127.0.0.1");
    try {
      const loopback = await call(ctx, { method: "GET", path: "/auth/mvx/init", headers: { host: "localhost:5000" }, fetcher });
      assert.equal(loopback.status, 200);
      assert.equal(loopback.body.origin, "http://localhost:5000");
      assert.equal(loopback.body.attestation, "local-development-default");
      assert.equal(Buffer.from(loopback.body.init.split(".")[0], "base64url").toString("utf8"), "http://localhost:5000");
      assert.equal(loopback.body.init.split(".")[1], blockHash);
      assert.match(loopback.body.wcProjectId, /^[a-f0-9]{32}$/);

      const lan = await call(ctx, { method: "GET", path: "/auth/mvx/init", headers: { host: "192.168.1.153:5000" }, fetcher });
      assert.equal(lan.status, 503, "http:// on a LAN address is not a secure context, so it is not attested by default");
    } finally {
      db.close();
    }
  });
  await withEnv({
    ...LOCAL_ENV,
    NEXUS_WC_PROJECT_ID: "c".repeat(32),
    NEXUS_WC_PROJECT_ATTESTED: "true",
    NEXUS_WC_ATTESTED_ORIGINS: "http://192.168.1.153:5000",
  }, async () => {
    const { db, ctx } = boot("192.168.1.57");
    try {
      const configured = await call(ctx, { method: "GET", path: "/auth/mvx/init", headers: { host: "192.168.1.153:5000" }, fetcher });
      assert.equal(configured.status, 200);
      assert.equal(configured.body.attestation, "configured");
      assert.equal(configured.body.wcProjectId, "c".repeat(32));

      const foreign = await call(ctx, { method: "GET", path: "/auth/mvx/init", headers: { host: "192.168.1.153:5001" }, fetcher });
      assert.equal(foreign.status, 503);
    } finally {
      db.close();
    }
  });
});

test("an empty environment value is 'not configured', so a later file can fill it", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { loadEnv } = await import("../lib/env.js");
  const directory = mkdtempSync(join(tmpdir(), "nexus-env-"));
  const file = join(directory, "app.env");
  writeFileSync(file, "NEXUS_SYSTEM_TEST_EMPTY=from-the-app-file\nNEXUS_SYSTEM_TEST_SET=other\n", "utf8");
  const previousEmpty = process.env.NEXUS_SYSTEM_TEST_EMPTY;
  const previousSet = process.env.NEXUS_SYSTEM_TEST_SET;
  process.env.NEXUS_SYSTEM_TEST_EMPTY = "";
  process.env.NEXUS_SYSTEM_TEST_SET = "explicit";
  try {
    assert.equal(loadEnv(file), true);
    // The template placeholder did not win over a real value…
    assert.equal(process.env.NEXUS_SYSTEM_TEST_EMPTY, "from-the-app-file");
    // …and a value somebody actually set is never overridden.
    assert.equal(process.env.NEXUS_SYSTEM_TEST_SET, "explicit");
  } finally {
    if (previousEmpty === undefined) delete process.env.NEXUS_SYSTEM_TEST_EMPTY;
    else process.env.NEXUS_SYSTEM_TEST_EMPTY = previousEmpty;
    if (previousSet === undefined) delete process.env.NEXUS_SYSTEM_TEST_SET;
    else process.env.NEXUS_SYSTEM_TEST_SET = previousSet;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the attestation report is additive: the five-key contract every caller expects is untouched", () => {
  const env = { NODE_ENV: "development", NEXUS_DEPLOYMENT_MODE: "local" };
  const report = walletConnectAttestationReport(env, "http://localhost:5000");
  assert.equal(report.ready, true);
  assert.equal(report.source, "local-development-default");
  assert.deepEqual(report.missing, []);
  const strict = walletConnectAttestationReport({ NODE_ENV: "production" }, "https://nexus.example");
  assert.equal(strict.ready, false);
  assert.equal(strict.source, "configured");
  assert.equal(strict.missing.length, 3);
});
