import test from "node:test";
import assert from "node:assert/strict";
import { UserSecretKey } from "@multiversx/sdk-core";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import {
  EmailAuthCommandError, consumeAuthLogout, consumeEmailAuthCommand, getEmailSignupChallenge,
  issueEmailSignupChallenge, replayEmailAuthCommand,
} from "../lib/email-auth-session.js";

function request(path, body, key) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method: "POST",
    url: path,
    headers: { "content-type": "application/json", "idempotency-key": key },
    socket: { remoteAddress: "127.0.0.91" },
    on(event, callback) {
      if (event === "data") process.nextTick(() => callback(raw));
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
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { if (typeof value === "string") this.body = value; },
  };
}

async function apiCall(context, path, body, key) {
  const res = response();
  await handleRequest(request(path, body, key), res, context);
  return { status: res.statusCode, headers: res.headers, body: res.body ? JSON.parse(res.body) : {} };
}

test("email signup-init is durable, encrypted, replayable and conflict-safe", () => {
  const db = openDb(":memory:");
  try {
    const first = issueEmailSignupChallenge({ db, idempotencyKey: "email-init-system-test-0001", email: "Actor@Example.invalid", now: 1_000 });
    const replay = issueEmailSignupChallenge({ db, idempotencyKey: "email-init-system-test-0001", email: "actor@example.invalid", now: 1_001 });
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(replay.nonce, first.nonce);
    const stored = db.prepare(`SELECT * FROM email_signup_challenges`).get();
    assert.equal(Buffer.from(stored.nonce_ciphertext).includes(Buffer.from(first.nonce)), false);
    assert.equal(stored.email_sha256.includes("actor@"), false);
    assert.throws(
      () => issueEmailSignupChallenge({ db, idempotencyKey: "email-init-system-test-0001", email: "other@example.invalid", now: 1_002 }),
      (error) => error instanceof EmailAuthCommandError && error.code === "EMAIL_SIGNUP_INIT_CONFLICT",
    );
  } finally { db.close(); }
});

test("signup challenge, account and encrypted session roll back and retry atomically", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const email = "crash@example.invalid";
    const challenge = issueEmailSignupChallenge({ db, idempotencyKey: "email-init-system-test-0002", email, now: 2_000 });
    const requestData = { email, password: "system-test-password", wallet_proof: { nonce: challenge.nonce } };
    const makeOperation = () => {
      const user = repo.createUser({ handle: "email_crash_actor", displayName: "Crash actor" });
      repo.ensurePersona(user.id, "social", {});
      repo.linkProvider(user.id, { email });
      return { userId: user.id, response: { ok: true, user_id: user.id } };
    };
    assert.throws(() => consumeEmailAuthCommand({
      db, repo, purpose: "signup", idempotencyKey: "email-signup-system-test-0001",
      requestData, subject: email, challengeNonce: challenge.nonce, now: 2_001,
      operation: makeOperation,
      beforeCommit() { throw new Error("SYSTEM_TEST_EMAIL_AUTH_CRASH"); },
    }), /SYSTEM_TEST_EMAIL_AUTH_CRASH/);
    assert.equal(repo.getUserByEmail(email), null);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions`).get().count, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM email_auth_commands`).get().count, 0);
    assert.ok(getEmailSignupChallenge(db, { nonce: challenge.nonce, email, now: 2_002 }));

    const first = consumeEmailAuthCommand({
      db, repo, purpose: "signup", idempotencyKey: "email-signup-system-test-0001",
      requestData, subject: email, challengeNonce: challenge.nonce, now: 2_002,
      operation: makeOperation,
    });
    const replay = replayEmailAuthCommand({
      db, repo, purpose: "signup", idempotencyKey: "email-signup-system-test-0001",
      requestData, subject: email, now: 2_003,
    });
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(replay.token, first.token);
    assert.deepEqual(replay.response, first.response);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions`).get().count, 1);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM email_auth_commands`).get().count, 1);
    assert.equal(getEmailSignupChallenge(db, { nonce: challenge.nonce, email, now: 2_003 }), null);
    const stored = db.prepare(`SELECT * FROM email_auth_commands`).get();
    assert.equal(Buffer.from(stored.session_token_ciphertext).includes(Buffer.from(first.token)), false);
    assert.equal(Buffer.from(stored.response_ciphertext).includes(Buffer.from("user_id")), false);
  } finally { db.close(); }
});

test("email login command rejects key reuse and issues unique sessions under load", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "email_login_actor", displayName: "Login actor" });
    repo.ensurePersona(user.id, "social", {});
    const requestData = { email: "login@example.invalid", password: "system-test-password" };
    const first = consumeEmailAuthCommand({
      db, repo, purpose: "login", idempotencyKey: "email-login-system-test-0000",
      requestData, subject: requestData.email, now: 3_000,
      operation: () => ({ userId: user.id, response: { ok: true } }),
    });
    assert.throws(() => replayEmailAuthCommand({
      db, repo, purpose: "login", idempotencyKey: "email-login-system-test-0000",
      requestData: { ...requestData, password: "changed-password" }, subject: requestData.email, now: 3_001,
    }), (error) => error instanceof EmailAuthCommandError && error.code === "EMAIL_AUTH_REPLAY_CONFLICT");
    const sessions = [first];
    for (let index = 1; index <= 100; index++) {
      sessions.push(consumeEmailAuthCommand({
        db, repo, purpose: "login", idempotencyKey: `email-login-system-test-${String(index).padStart(4, "0")}`,
        requestData, subject: requestData.email, now: 3_000 + index,
        operation: () => ({ userId: user.id, response: { ok: true } }),
      }));
    }
    assert.equal(new Set(sessions.map((session) => session.tokenHash)).size, 101);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM email_auth_commands`).get().count, 101);
  } finally { db.close(); }
});

test("email HTTP routes replay the exact signup and login session cookies", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const context = { db, repo, sse: { publish() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } } };
  try {
    const email = "route-replay@example.invalid";
    const initKey = "email-route-init-system-test-0001";
    const init = await apiCall(context, "/auth/email/signup-init", { email }, initKey);
    const initReplay = await apiCall(context, "/auth/email/signup-init", { email }, initKey);
    assert.equal(init.status, 200);
    assert.equal(initReplay.body.replay, true);
    assert.equal(initReplay.body.nonce, init.body.nonce);

    const keyPair = UserSecretKey.generate();
    const address = keyPair.generatePublicKey().toAddress("erd").toBech32();
    const signature = Buffer.from(keyPair.sign(Buffer.from(init.body.message, "utf8"))).toString("hex");
    const signupBody = {
      email,
      password: "system-test-password",
      wallet_proof: { nonce: init.body.nonce, address, signature },
    };
    const signupKey = "email-route-signup-system-test-0001";
    const signup = await apiCall(context, "/auth/email/signup", signupBody, signupKey);
    const signupReplay = await apiCall(context, "/auth/email/signup", signupBody, signupKey);
    assert.equal(signup.status, 201);
    assert.equal(signupReplay.status, 201);
    assert.equal(signupReplay.body.replay, true);
    assert.equal(signupReplay.headers["set-cookie"], signup.headers["set-cookie"]);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM users WHERE email = ?`).get(email).count, 1);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions`).get().count, 1);

    const loginBody = { email, password: "system-test-password" };
    const loginKey = "email-route-login-system-test-0001";
    const login = await apiCall(context, "/auth/email/login", loginBody, loginKey);
    const loginReplay = await apiCall(context, "/auth/email/login", loginBody, loginKey);
    assert.equal(login.status, 200);
    assert.equal(loginReplay.body.replay, true);
    assert.equal(loginReplay.headers["set-cookie"], login.headers["set-cookie"]);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions`).get().count, 2);

    const conflict = await apiCall(context, "/auth/email/login", { ...loginBody, password: "changed-password" }, loginKey);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, "EMAIL_AUTH_REPLAY_CONFLICT");
  } finally { db.close(); }
});

test("logout requires one credential-bound idempotency key and revokes all presented sessions", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "logout_actor", displayName: "Logout actor" });
    repo.ensurePersona(user.id, "social", {});
    const one = consumeEmailAuthCommand({
      db, repo, purpose: "login", idempotencyKey: "logout-setup-login-system-0001",
      requestData: { attempt: 1 }, subject: "logout@example.invalid", now: 4_000,
      operation: () => ({ userId: user.id, response: { ok: true } }),
    });
    const two = consumeEmailAuthCommand({
      db, repo, purpose: "login", idempotencyKey: "logout-setup-login-system-0002",
      requestData: { attempt: 2 }, subject: "logout@example.invalid", now: 4_001,
      operation: () => ({ userId: user.id, response: { ok: true } }),
    });
    const first = consumeAuthLogout({
      db, repo, idempotencyKey: "logout-command-system-test-0001", tokens: [one.token, two.token], now: 4_002,
    });
    const replay = consumeAuthLogout({
      db, repo, idempotencyKey: "logout-command-system-test-0001", tokens: [two.token, one.token], now: 4_003,
    });
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE user_id = ?`).get(user.id).count, 0);
    assert.throws(() => consumeAuthLogout({
      db, repo, idempotencyKey: "logout-command-system-test-0001", tokens: [one.token], now: 4_004,
    }), (error) => error instanceof EmailAuthCommandError && error.code === "AUTH_LOGOUT_REPLAY_CONFLICT");
  } finally { db.close(); }
});
