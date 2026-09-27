import test from "node:test";
import assert from "node:assert/strict";
import { migrateNativeAuthConsumptionIndependence, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { NativeAuthSessionError, consumeNativeAuthSession } from "../lib/native-auth-session.js";
import { issueSession } from "../lib/security.js";

const command = (db, repo, user, overrides = {}) => ({
  db,
  repo,
  token: "native-auth-fixture-token-0001",
  purpose: "native",
  idempotencyKey: "native-auth-idempotency-0001",
  requestBody: Buffer.from('{"token":"native-auth-fixture-token-0001"}'),
  address: "erd1systemtestnativeauth000000000000000000000000000000000000000000",
  userId: user.id,
  persona: "social",
  now: 1_000,
  ...overrides,
});

test("NativeAuth consumption replays one encrypted session and rejects token/key conflicts", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "native_consumption_owner", displayName: "Owner" });
    repo.ensurePersona(user.id, "social", {});
    const first = consumeNativeAuthSession(command(db, repo, user));
    const replay = consumeNativeAuthSession(command(db, repo, user, { now: 1_001 }));
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(replay.token, first.token);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE user_id = ?`).get(user.id).count, 1);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 1);
    const stored = db.prepare(`SELECT * FROM native_auth_consumptions`).get();
    assert.equal(Buffer.from(stored.session_token_ciphertext).includes(Buffer.from(first.token)), false);
    assert.equal(stored.token_sha256.includes("native-auth-fixture"), false);

    assert.throws(
      () => consumeNativeAuthSession(command(db, repo, user, { requestBody: Buffer.from('{"token":"changed"}'), now: 1_002 })),
      (error) => error instanceof NativeAuthSessionError && error.code === "NATIVE_AUTH_REPLAY_CONFLICT",
    );
    assert.throws(
      () => consumeNativeAuthSession(command(db, repo, user, { purpose: "recover", idempotencyKey: "native-auth-idempotency-0002", now: 1_002 })),
      (error) => error instanceof NativeAuthSessionError && error.code === "NATIVE_AUTH_REPLAY_CONFLICT",
    );
  } finally { db.close(); }
});

test("NativeAuth consumption rolls back session and proof together at the crash boundary", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "native_crash_owner", displayName: "Crash owner" });
    repo.ensurePersona(user.id, "social", {});
    assert.throws(
      () => consumeNativeAuthSession(command(db, repo, user, { beforeCommit() { throw new Error("SYSTEM_TEST_NATIVE_AUTH_CRASH"); } })),
      /SYSTEM_TEST_NATIVE_AUTH_CRASH/,
    );
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE user_id = ?`).get(user.id).count, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 0);
    const retried = consumeNativeAuthSession(command(db, repo, user, { now: 1_001 }));
    assert.equal(retried.replay, false);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE user_id = ?`).get(user.id).count, 1);
  } finally { db.close(); }
});

test("logout keeps the NativeAuth proof consumed and exact replay fails closed", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "native_logout_owner", displayName: "Logout owner" });
    repo.ensurePersona(user.id, "social", {});
    const first = consumeNativeAuthSession(command(db, repo, user));
    repo.deleteSession(first.tokenHash);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE token_hash = ?`).get(first.tokenHash).count, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 1);
    assert.throws(
      () => consumeNativeAuthSession(command(db, repo, user, { now: 1_001 })),
      (error) => error instanceof NativeAuthSessionError && error.code === "NATIVE_AUTH_REPLAY_UNAVAILABLE",
    );
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM sessions WHERE user_id = ?`).get(user.id).count, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 1);
  } finally { db.close(); }
});

test("legacy NativeAuth consumption migration is atomic and removes cascading replay erasure", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "native_migration_owner", displayName: "Migration owner" });
    repo.ensurePersona(user.id, "social", {});
    const first = consumeNativeAuthSession(command(db, repo, user));
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE native_auth_consumptions_legacy (
        token_sha256 TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_sha256 TEXT NOT NULL,
        address TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        persona TEXT NOT NULL,
        session_token_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
        session_token_ciphertext BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (purpose, idempotency_key)
      );
      INSERT INTO native_auth_consumptions_legacy SELECT * FROM native_auth_consumptions;
      DROP TABLE native_auth_consumptions;
      ALTER TABLE native_auth_consumptions_legacy RENAME TO native_auth_consumptions;
      CREATE INDEX idx_native_auth_consumptions_expiry ON native_auth_consumptions(expires_at);
      PRAGMA foreign_keys = ON;
    `);
    assert.equal(db.prepare(`PRAGMA foreign_key_list(native_auth_consumptions)`).all().length, 2);
    assert.throws(
      () => migrateNativeAuthConsumptionIndependence(db, { beforeCommit() { throw new Error("SYSTEM_TEST_NATIVE_MIGRATION_CRASH"); } }),
      /SYSTEM_TEST_NATIVE_MIGRATION_CRASH/,
    );
    assert.equal(db.prepare(`PRAGMA foreign_key_list(native_auth_consumptions)`).all().length, 2);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 1);
    assert.equal(migrateNativeAuthConsumptionIndependence(db).migrated, true);
    assert.deepEqual(db.prepare(`PRAGMA foreign_key_list(native_auth_consumptions)`).all(), []);
    repo.deleteSession(first.tokenHash);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM native_auth_consumptions`).get().count, 1);
    assert.deepEqual(db.prepare(`PRAGMA foreign_key_check`).all(), []);
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally { db.close(); }
});

test("session issuance has a unique 128-bit jti even within one millisecond", () => {
  const sessions = Array.from({ length: 100 }, () => issueSession(7, "social"));
  assert.equal(new Set(sessions.map((session) => session.tokenHash)).size, 100);
  for (const session of sessions) {
    const payload = JSON.parse(Buffer.from(session.token.split(".")[0], "base64url").toString("utf8"));
    assert.match(payload.jti, /^[A-Za-z0-9_-]{22}$/);
  }
});
