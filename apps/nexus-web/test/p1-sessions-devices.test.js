import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateChatDeviceSchema, migrateSessionSchema, openDb } from "../lib/db.js";
import { createRepo, MAX_ACTIVE_CHAT_DEVICES_PER_USER, RECOVERY_DEVICE_PENDING_TTL_SECONDS } from "../lib/repo.js";
import { handleRequest, recoveryActivationToken } from "../lib/api.js";
import { hashPassword, issueSession, sha256Hex } from "../lib/security.js";

let sequence = 0;

function request(method, url, cookie, body = {}, key = null, userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0") {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url,
    headers: {
      cookie, "content-type": "application/json", "user-agent": userAgent,
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)
        ? { "idempotency-key": key || `session-device-test-${String(++sequence).padStart(8, "0")}` }
        : {}),
    },
    socket: { remoteAddress: "127.0.0.72" },
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
    statusCode: 200, headers: {}, body: "",
    writeHead(code, headers = {}) { this.statusCode = code; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    end(value) { this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? ""); },
  };
}

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const user = repo.createUser({ handle: "session_owner", displayName: "Session owner", passwordHash: hashPassword("correct-password-123"), mvxAddress: `erd1${"q".repeat(58)}` });
  repo.ensurePersona(user.id, "social", { visibility: "public" });
  const current = issueSession(user.id, "social");
  const other = issueSession(user.id, "work");
  repo.insertSession({ tokenHash: current.tokenHash, userId: user.id, persona: "social", expiresAt: current.expiresAt, deviceId: "a".repeat(32), deviceLabel: "Chrome · Windows" });
  repo.insertSession({ tokenHash: other.tokenHash, userId: user.id, persona: "work", expiresAt: other.expiresAt, deviceId: "b".repeat(32), deviceLabel: "Safari · iOS" });
  return {
    db, repo, user, current, other, cookie: `nexus_session=${current.token}; nexus_device_id=${"a".repeat(32)}`,
    context: { db, repo, sse: { publish() {}, broadcast() {}, subscribe() { return () => {}; } } },
  };
}

async function call(state, method, path, body = {}, key = null) {
  const res = response();
  await handleRequest(request(method, path, state.cookie, body, key), res, state.context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers };
}

test("legacy sessions gain privacy-safe device metadata before their index", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, persona TEXT NOT NULL DEFAULT 'social', created_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER NOT NULL);`);
    migrateSessionSchema(db);
    const columns = new Set(db.prepare(`PRAGMA table_info(sessions)`).all().map((row) => row.name));
    assert.equal(columns.has("device_id"), true);
    assert.equal(columns.has("device_label"), true);
    assert.equal(columns.has("device_fingerprint"), true);
    assert.equal(columns.has("last_seen_at"), true);
    assert.equal(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_sessions_user_device'`).get().name, "idx_sessions_user_device");
    migrateSessionSchema(db);
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally { db.close(); }
});

test("legacy chat devices gain recovery activation columns before the expiry index", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE chat_devices (
      device_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, label TEXT NOT NULL,
      key_algorithm TEXT NOT NULL DEFAULT 'ECDH-P256', public_jwk TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', registered_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()), revoked_at INTEGER
    );`);
    const publicJwk = { kty: "EC", crv: "P-256", x: "L".repeat(43), y: "M".repeat(43) };
    const deviceId = "device:recovery:00000000-0000-4000-8000-000000000029";
    db.prepare(`INSERT INTO chat_devices (device_id, user_id, label, public_jwk, status, registered_at, last_seen_at)
      VALUES (?, 7, 'Legacy recovery', ?, 'active', 1234, 1234)`).run(deviceId, JSON.stringify(publicJwk));
    migrateChatDeviceSchema(db);
    const columns = new Set(db.prepare(`PRAGMA table_info(chat_devices)`).all().map((row) => row.name));
    for (const column of ["device_kind", "activation_token_hash", "activation_expires_at", "activated_at"]) assert.equal(columns.has(column), true);
    assert.equal(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_chat_devices_pending_expiry'`).get().name, "idx_chat_devices_pending_expiry");
    const migrated = db.prepare(`SELECT device_kind, activated_at FROM chat_devices WHERE device_id = ?`).get(deviceId);
    assert.deepEqual({ ...migrated }, { device_kind: "recovery", activated_at: 1234 });
    assert.ok(createRepo(db).registerChatDevice(7, { deviceId, label: "Restored legacy recovery", publicJwk }), "legacy recovery packages remain restorable after migration");
    migrateChatDeviceSchema(db);
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally { db.close(); }
});

test("session inventory exposes coarse labels only and revokes another session with step-up exactly once", async () => {
  const state = fixture();
  try {
    const list = await call(state, "GET", "/api/account/sessions");
    assert.equal(list.status, 200);
    assert.equal(list.body.sessions.length, 2);
    assert.equal(list.body.sessions.filter((item) => item.current).length, 1);
    assert.equal(JSON.stringify(list.body).includes(state.current.tokenHash), false);
    assert.equal(JSON.stringify(list.body).includes("device_fingerprint"), false);
    const other = list.body.sessions.find((item) => !item.current);

    const wrong = await call(state, "POST", `/api/account/sessions/${other.id}/revoke`, { current_password: "wrong" });
    assert.equal(wrong.status, 401);
    assert.equal(state.repo.listUserSessions(state.user.id, state.current.tokenHash).length, 2);

    const key = "session-revoke-exactly-once-0001";
    const revoked = await call(state, "POST", `/api/account/sessions/${other.id}/revoke`, { current_password: "correct-password-123" }, key);
    const replay = await call(state, "POST", `/api/account/sessions/${other.id}/revoke`, { current_password: "correct-password-123" }, key);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.revoked, true);
    assert.deepEqual(replay.body, revoked.body);
    assert.equal(state.repo.listUserSessions(state.user.id, state.current.tokenHash).length, 1);

    const current = state.repo.listUserSessions(state.user.id, state.current.tokenHash)[0];
    const currentDenied = await call(state, "POST", `/api/account/sessions/${current.id}/revoke`, { current_password: "correct-password-123" });
    assert.equal(currentDenied.status, 409);
    assert.equal(currentDenied.body.code, "CURRENT_SESSION_USE_LOGOUT");
  } finally { state.db.close(); }
});

test("E2EE device inventory hides key material and revocation is step-up protected, irreversible and replay-safe", async () => {
  const state = fixture();
  const deviceId = "device:account:secure:0001";
  const publicJwk = { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43), ext: true, key_ops: [] };
  try {
    const registered = await call(state, "POST", "/api/chat/devices", { device_id: deviceId, label: "Telefon personal", public_jwk: publicJwk });
    assert.equal(registered.status, 201);
    assert.equal("public_jwk" in registered.body.device, false);
    assert.equal(registered.body.private_key_received, false);

    const inventory = await call(state, "GET", "/api/chat/devices");
    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.public_keys_exposed_in_account_inventory, false);
    assert.equal(inventory.body.private_keys_on_server, false);
    assert.equal(inventory.body.step_up, "password_or_xportal");
    assert.equal(inventory.body.devices.length, 1);
    assert.equal("public_jwk" in inventory.body.devices[0], false);
    assert.equal(JSON.stringify(inventory.body).includes(publicJwk.x), false);

    const endpoint = `/api/chat/devices/${encodeURIComponent(deviceId)}/revoke`;
    assert.equal((await call(state, "POST", endpoint, {})).status, 401);
    assert.equal((await call(state, "POST", endpoint, { current_password: "wrong" })).status, 401);
    assert.equal(state.repo.getChatDevice(deviceId).status, "active");

    const securityBefore = state.repo.listNotifications(state.user.id, { persona: "social" }).filter((item) => item.type === "security").length;
    const key = "chat-device-revoke-exactly-once-0001";
    const revoked = await call(state, "POST", endpoint, { current_password: "correct-password-123" }, key);
    const replay = await call(state, "POST", endpoint, { current_password: "correct-password-123" }, key);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.status, "revoked");
    assert.equal(revoked.body.reversible, false);
    assert.equal(revoked.body.historical_access_transferred, false);
    assert.deepEqual(replay.body, revoked.body);
    assert.equal(state.repo.listNotifications(state.user.id, { persona: "social" }).filter((item) => item.type === "security").length, securityBefore + 1);
    assert.equal(state.repo.registerChatDevice(state.user.id, { deviceId, label: "revive", publicJwk }), null);
  } finally { state.db.close(); }
});

test("E2EE recovery device stays pending until explicit idempotent activation and expires fail-closed", async () => {
  const state = fixture();
  const deviceId = "device:recovery:00000000-0000-4000-8000-000000000030";
  const publicJwk = { kty: "EC", crv: "P-256", x: "C".repeat(43), y: "D".repeat(43), ext: true, key_ops: [] };
  const accountBinding = sha256Hex(`NEXUS_E2EE_ACCOUNT_BINDING_V1:${state.user.id}:${state.user.mvx_address}`);
  try {
    const wrongAccount = await call(state, "POST", "/api/chat/recovery-devices", { account_binding: sha256Hex("wrong-account"), device_id: deviceId, public_jwk: publicJwk });
    assert.equal(wrongAccount.status, 409);
    assert.equal(wrongAccount.body.code, "RECOVERY_ACCOUNT_BINDING_MISMATCH");

    const createKey = "recovery-pending-exact-replay-0001";
    const pending = await call(state, "POST", "/api/chat/recovery-devices", { account_binding: accountBinding, device_id: deviceId, public_jwk: publicJwk }, createKey);
    const pendingReplay = await call(state, "POST", "/api/chat/recovery-devices", { account_binding: accountBinding, device_id: deviceId, public_jwk: publicJwk }, createKey);
    assert.equal(pending.status, 201);
    assert.deepEqual(pending.body.intent, { owner_id: state.user.id, device_id: deviceId, action: "provision_recovery" });
    assert.equal(pending.body.device.status, "pending_recovery");
    assert.equal(pending.body.private_key_received, false);
    assert.equal("public_jwk" in pending.body.device, false);
    assert.match(pending.body.activation_token, /^[A-Za-z0-9_-]{40,80}$/);
    assert.equal(pending.body.activation_token, recoveryActivationToken(state.user.id, deviceId, createKey), "crash retry derives the same unguessable capability from the same command");
    assert.notEqual(recoveryActivationToken(state.user.id, deviceId, `${createKey}-other`), pending.body.activation_token);
    assert.deepEqual(pendingReplay.body, pending.body);
    const mutation = state.db.prepare(`SELECT response_body FROM mutation_requests WHERE user_id = ? AND idempotency_key = ?`).get(state.user.id, createKey);
    assert.equal(Buffer.from(mutation.response_body).includes(Buffer.from(pending.body.activation_token)), false, "activation capability is never stored as plaintext in the idempotency registry");
    assert.equal(state.repo.listChatDevices(state.user.id, { activeOnly: true }).length, 0, "pending keys never receive message envelopes");
    assert.equal(state.repo.registerChatDevice(state.user.id, { deviceId, label: "bypass", publicJwk }), null, "generic registration cannot bypass confirmation");

    const wrongToken = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, { activation_token: "x".repeat(43) });
    assert.equal(wrongToken.status, 403);
    assert.equal(state.repo.getChatDevice(deviceId).status, "pending_recovery");

    const activateKey = "recovery-activate-exact-replay-0001";
    const activated = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, { activation_token: pending.body.activation_token }, activateKey);
    const activatedReplay = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, { activation_token: pending.body.activation_token }, activateKey);
    assert.equal(activated.status, 200);
    assert.deepEqual(activated.body.intent, { owner_id: state.user.id, device_id: deviceId, action: "activate_recovery" });
    assert.equal(activated.body.device.status, "active");
    assert.equal(activated.body.active, true);
    assert.deepEqual(activatedReplay.body, activated.body);
    const wrongAfterActive = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, { activation_token: "z".repeat(43) }, "recovery-active-wrong-token-0001");
    assert.equal(wrongAfterActive.status, 403, "active state must not make an invalid capability look valid");
    const semanticReplay = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, { activation_token: pending.body.activation_token }, "recovery-active-semantic-replay-0001");
    assert.equal(semanticReplay.status, 200);
    assert.equal(semanticReplay.body.replay, true);
    assert.equal(state.repo.listChatDevices(state.user.id, { activeOnly: true }).length, 1);
    assert.ok(state.repo.registerChatDevice(state.user.id, { deviceId, label: "Recovered E2EE key", publicJwk }), "an already-active recovery key can be restored in a fresh browser");
    assert.equal(state.repo.listNotifications(state.user.id, { persona: "social" }).filter((item) => item.type === "security").length, 1);

    const expiringId = "device:recovery:00000000-0000-4000-8000-000000000031";
    const at = 2_000_000_000;
    const raw = "expire-capability-token-000000000000000000000000";
    const expiring = state.repo.createPendingRecoveryDevice(state.user.id, {
      deviceId: expiringId, publicJwk: { ...publicJwk, x: "E".repeat(43) }, activationTokenHash: sha256Hex(raw),
      expiresAt: at + RECOVERY_DEVICE_PENDING_TTL_SECONDS, atSeconds: at,
    });
    assert.equal(expiring.ok, true);
    const crashRetry = state.repo.createPendingRecoveryDevice(state.user.id, {
      deviceId: expiringId, publicJwk: { ...publicJwk, x: "E".repeat(43) }, activationTokenHash: sha256Hex(raw),
      expiresAt: at + RECOVERY_DEVICE_PENDING_TTL_SECONDS - 1, atSeconds: at + 1,
    });
    assert.equal(crashRetry.ok, true);
    assert.equal(crashRetry.replay, true);
    assert.equal(crashRetry.device.activation_expires_at, at + RECOVERY_DEVICE_PENDING_TTL_SECONDS, "retry cannot silently extend the pending lease");
    const expired = state.repo.activateRecoveryDevice(state.user.id, { deviceId: expiringId, activationTokenHash: sha256Hex(raw), atSeconds: at + RECOVERY_DEVICE_PENDING_TTL_SECONDS });
    assert.deepEqual(expired, { ok: false, error: "expired" });
    assert.equal(state.repo.getChatDevice(expiringId).status, "expired");
  } finally { state.db.close(); }
});

test("active chat-device cardinality is bounded and legacy over-limit sets fail closed", async () => {
  const state = fixture();
  const publicJwk = (index) => ({ kty: "EC", crv: "P-256", x: `${String.fromCharCode(65 + index)}${"x".repeat(42)}`, y: "y".repeat(43) });
  try {
    const participant = state.repo.createUser({ handle: "device_limit_peer", displayName: "Device limit peer", passwordHash: hashPassword("peer-password-123") });
    state.repo.ensurePersona(participant.id, "social", { visibility: "public" });
    for (let index = 0; index < MAX_ACTIVE_CHAT_DEVICES_PER_USER; index++) {
      assert.ok(state.repo.registerChatDevice(state.user.id, {
        deviceId: `device:primary:bounded-${String(index).padStart(2, "0")}`,
        label: `Device ${index}`,
        publicJwk: publicJwk(index),
      }));
    }
    assert.equal(state.repo.registerChatDevice(state.user.id, {
      deviceId: "device:primary:bounded-overflow",
      label: "Overflow",
      publicJwk: { kty: "EC", crv: "P-256", x: `Z${"x".repeat(42)}`, y: "z".repeat(43) },
    }), null, "the generic endpoint cannot create an unbounded recipient-device set");

    const recoveryId = "device:recovery:00000000-0000-4000-8000-000000000032";
    const createKey = "recovery-limit-pending-create-0001";
    const accountBinding = sha256Hex(`NEXUS_E2EE_ACCOUNT_BINDING_V1:${state.user.id}:${state.user.mvx_address}`);
    const pending = await call(state, "POST", "/api/chat/recovery-devices", {
      account_binding: accountBinding,
      device_id: recoveryId,
      public_jwk: publicJwk(10),
    }, createKey);
    assert.equal(pending.status, 201, "a recovery package may be prepared without joining the active set");
    const activation = await call(state, "POST", `/api/chat/recovery-devices/${encodeURIComponent(recoveryId)}/activate`, {
      activation_token: pending.body.activation_token,
    }, "recovery-limit-activate-0001");
    assert.equal(activation.status, 409);
    assert.equal(activation.body.code, "RECOVERY_DEVICE_LIMIT");
    assert.equal(state.repo.getChatDevice(recoveryId).status, "pending_recovery");

    const conversation = state.repo.createDirectConversation({ creatorId: state.user.id, recipientId: participant.id, contextPersona: "social" });
    const insertLegacy = state.db.prepare(`INSERT INTO chat_devices
      (device_id, user_id, label, public_jwk, device_kind, status, registered_at, last_seen_at, activated_at)
      VALUES (?, ?, ?, ?, 'primary', 'active', 1000, 1000, 1000)`);
    for (let index = 0; index <= MAX_ACTIVE_CHAT_DEVICES_PER_USER + 1; index++) {
      const storedJwk = index > MAX_ACTIVE_CHAT_DEVICES_PER_USER ? "not-json-outside-bounded-read" : JSON.stringify(publicJwk(index));
      insertLegacy.run(`device:legacy:overflow-${String(index).padStart(2, "0")}`, participant.id, `Legacy ${index}`, storedJwk);
    }
    const material = state.repo.conversationDeviceSet(conversation.id, state.user.id);
    assert.equal(material.ready, false);
    assert.deepEqual(material.devices, []);
    assert.deepEqual(material.users_exceeding_device_limit, [participant.handle]);
    assert.equal(material.commitment, null, "the server must not publish a partial cryptographic device set");
  } finally { state.db.close(); }
});

test("logout-all requires step-up, revokes every session and replays after credentials are gone", async () => {
  const state = fixture();
  try {
    const wrong = await call(state, "POST", "/auth/logout-all", { current_password: "wrong" }, "logout-all-wrong-password-0001");
    assert.equal(wrong.status, 401);
    assert.equal(state.repo.listUserSessions(state.user.id, state.current.tokenHash).length, 2);

    const key = "logout-all-exact-replay-0001";
    const first = await call(state, "POST", "/auth/logout-all", { current_password: "correct-password-123" }, key);
    const replay = await call(state, "POST", "/auth/logout-all", { current_password: "correct-password-123" }, key);
    assert.equal(first.status, 200);
    assert.equal(first.body.revoked_all, true);
    assert.equal(first.body.replay, false);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replay, true);
    assert.equal(state.repo.listUserSessions(state.user.id, state.current.tokenHash).length, 0);
    assert.equal(state.repo.listNotifications(state.user.id, { persona: "social" }).filter((item) => item.type === "security").length, 1);
    assert.match(String(first.headers["set-cookie"]), /nexus_session=; Max-Age=0/);
  } finally { state.db.close(); }
});
