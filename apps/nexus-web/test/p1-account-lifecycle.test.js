import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { hashPassword, issueSession } from "../lib/security.js";
import {
  ACCOUNT_DELETION_GRACE_SECONDS, buildAccountExport, createAccountExportRequest,
  getAccountExport, requestAccountDeletion, runEligibleAccountPurges,
} from "../lib/account-lifecycle.js";

let sequence = 0;

function request(method, url, cookie, body = {}, key = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url,
    headers: {
      cookie, "content-type": "application/json", "user-agent": "Nexus GDPR synthetic test",
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)
        ? { "idempotency-key": key || `account-lifecycle-${String(++sequence).padStart(8, "0")}` }
        : {}),
    },
    socket: { remoteAddress: "127.0.0.81" },
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
  const user = repo.createUser({
    handle: "gdpr_owner", displayName: "GDPR owner", passwordHash: hashPassword("correct-password-123"),
    trafficClass: "SYSTEM_TEST",
  });
  repo.ensurePersona(user.id, "social", { visibility: "public" });
  const session = issueSession(user.id, "social");
  repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
  return {
    db, repo, user, session, cookie: `nexus_session=${session.token}`,
    context: { db, repo, sse: { publish() {}, broadcast() {}, subscribe() { return () => {}; } } },
  };
}

async function call(state, method, path, body = {}, key = null) {
  const res = response();
  await handleRequest(request(method, path, state.cookie, body, key), res, state.context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers };
}

test("account lifecycle schema is restart-safe and defaults existing users to active", () => {
  const db = openDb(":memory:");
  try {
    db.prepare(`INSERT INTO users (handle, display_name) VALUES ('legacy_gdpr', 'Legacy GDPR')`).run();
    const columns = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((row) => row.name));
    assert.equal(columns.has("account_state"), true);
    assert.equal(db.prepare(`SELECT account_state FROM users WHERE handle = 'legacy_gdpr'`).get().account_state, "active");
    for (const table of ["account_export_requests", "account_deletion_requests", "account_legal_holds", "account_purge_tombstones"]) {
      assert.equal(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table)?.name, table);
    }
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally { db.close(); }
});

test("portable export is owner-bound, expiring and excludes every stored credential", () => {
  const state = fixture();
  try {
    state.db.prepare(`UPDATE users SET email = ?, google_sub = ?, facebook_sub = ? WHERE id = ?`)
      .run("owner@example.test", "google-private-subject", "facebook-private-subject", state.user.id);
    state.db.prepare(`INSERT INTO wallets (user_id, address, kind, keystore) VALUES (?, ?, 'legacy', ?)`)
      .run(state.user.id, "erd1" + "q".repeat(58), "TOP-SECRET-SEED-PHRASE");
    state.db.prepare(`INSERT INTO posts (user_id, persona, kind, caption, visibility) VALUES (?, 'social', 'text', 'my export post', 'public')`).run(state.user.id);
    const other = state.repo.createUser({ handle: "gdpr_other", displayName: "Other", trafficClass: "SYSTEM_TEST" });
    state.repo.ensurePersona(other.id, "social", { visibility: "public" });
    state.db.prepare(`INSERT INTO posts (user_id, persona, kind, caption, visibility) VALUES (?, 'social', 'text', 'OTHER PRIVATE PAYLOAD', 'private')`).run(other.id);

    const direct = buildAccountExport(state.db, state.user.id, 100);
    const serialized = JSON.stringify(direct);
    assert.equal(serialized.includes("my export post"), true);
    assert.equal(serialized.includes("OTHER PRIVATE PAYLOAD"), false);
    assert.equal(serialized.includes("TOP-SECRET-SEED-PHRASE"), false);
    assert.equal(serialized.includes("google-private-subject"), false);
    assert.equal(serialized.includes("password_hash"), false);

    const created = createAccountExportRequest({ db: state.db, user: state.repo.getUserById(state.user.id), now: 100 });
    assert.equal(getAccountExport({ db: state.db, userId: state.user.id, exportId: created.id, now: 101 }).status, "ready");
    assert.equal(getAccountExport({ db: state.db, userId: other.id, exportId: created.id, now: 101 }).status, "not_found");
    assert.equal(getAccountExport({ db: state.db, userId: state.user.id, exportId: created.id, now: created.expires_at }).status, "expired");
  } finally { state.db.close(); }
});

test("deletion uses double confirmation, keeps only current session, locks mutations and can be cancelled", async () => {
  const state = fixture();
  try {
    const otherSession = issueSession(state.user.id, "work");
    state.repo.insertSession({ tokenHash: otherSession.tokenHash, userId: state.user.id, persona: "work", expiresAt: otherSession.expiresAt });
    const incomplete = await call(state, "POST", "/api/account/deletion-request", {
      current_password: "correct-password-123", confirmation: "DELETE", acknowledge_onchain: true,
    });
    assert.equal(incomplete.status, 400);
    assert.equal(state.repo.getUserById(state.user.id).account_state, "active");

    const key = "gdpr-delete-double-confirmation-0001";
    const requested = await call(state, "POST", "/api/account/deletion-request", {
      current_password: "correct-password-123", confirmation: "DELETE NEXUS", acknowledge_onchain: true,
    }, key);
    const replay = await call(state, "POST", "/api/account/deletion-request", {
      current_password: "correct-password-123", confirmation: "DELETE NEXUS", acknowledge_onchain: true,
    }, key);
    assert.equal(requested.status, 202);
    assert.deepEqual(replay.body, requested.body);
    assert.equal(requested.body.owner_id, state.user.id);
    assert.equal(requested.body.deletion.execute_after - requested.body.deletion.requested_at, ACCOUNT_DELETION_GRACE_SECONDS);
    assert.equal(state.repo.getUserById(state.user.id).account_state, "deletion_pending");
    assert.equal(state.repo.listUserSessions(state.user.id, state.session.tokenHash).length, 1);

    const blocked = await call(state, "POST", "/api/posts", { caption: "must not publish" });
    assert.equal(blocked.status, 423);
    assert.equal(blocked.body.code, "ACCOUNT_DELETION_PENDING");
    const status = await call(state, "GET", "/api/account/deletion");
    assert.equal(status.status, 200);
    assert.equal(status.body.owner_id, state.user.id);
    assert.equal(status.body.cancellable, true);

    const cancelled = await call(state, "POST", "/api/account/deletion-cancel", { current_password: "correct-password-123" });
    assert.equal(cancelled.status, 200);
    assert.deepEqual(cancelled.body, { ok: true, owner_id: state.user.id, cancelled: true, request_id: requested.body.deletion.id });
    assert.equal(state.repo.getUserById(state.user.id).account_state, "active");
  } finally { state.db.close(); }
});

test("account export API and client bind downloads to the authenticated owner and UUID", async () => {
  const state = fixture();
  try {
    const created = await call(state, "POST", "/api/account/export", { current_password: "correct-password-123" });
    assert.equal(created.status, 201);
    assert.equal(created.body.owner_id, state.user.id);
    assert.equal(created.body.secrets_excluded, true);
    assert.match(created.body.export.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(created.body.export.download_url, `/api/account/exports/${created.body.export.id}`);

    const listed = await call(state, "GET", "/api/account/exports");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.owner_id, state.user.id);
    assert.equal(listed.body.exports[0].id, created.body.export.id);

    const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(client, /accountExportPathPattern = \/\^\\\/api\\\/account\\\/exports/);
    assert.match(client, /Number\(exports\.owner_id\) !== Number\(state\.user\.id\)/);
    assert.match(client, /result\.secrets_excluded !== true/);
  } finally { state.db.close(); }
});

test("legal hold blocks purge without disclosure and eligible synthetic purge preserves shared conversations", () => {
  const state = fixture();
  try {
    const other = state.repo.createUser({ handle: "purge_survivor", displayName: "Survivor", trafficClass: "SYSTEM_TEST" });
    state.repo.ensurePersona(other.id, "social", { visibility: "public" });
    const conversation = state.db.prepare(`INSERT INTO conversations (kind, context_persona, created_by) VALUES ('group', 'social', ?)`).run(state.user.id);
    const conversationId = Number(conversation.lastInsertRowid);
    state.db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, 'owner')`).run(conversationId, state.user.id);
    state.db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, 'member')`).run(conversationId, other.id);
    state.db.prepare(`INSERT INTO message_items (conversation_id, sender_id, sender_persona, body, client_nonce) VALUES (?, ?, 'social', 'owner secret', 'purge-owner-msg')`).run(conversationId, state.user.id);
    state.db.prepare(`INSERT INTO message_items (conversation_id, sender_id, sender_persona, body, client_nonce) VALUES (?, ?, 'social', 'survivor data', 'purge-survivor-msg')`).run(conversationId, other.id);
    const mediaHash = "a".repeat(64);
    state.db.prepare(`INSERT INTO media (hash, ext, mime, detected_mime, kind, size, uploaded_by, scan_status, scan_reason)
      VALUES (?, 'jpg', 'image/jpeg', 'image/jpeg', 'image', 10, ?, 'ready_local_validation', 'test')`).run(mediaHash, state.user.id);

    const request = requestAccountDeletion({ db: state.db, repo: state.repo, user: state.user, currentTokenHash: state.session.tokenHash, now: 100 }).request;
    state.db.prepare(`UPDATE account_deletion_requests SET execute_after = 101 WHERE id = ?`).run(request.id);
    state.db.prepare(`INSERT INTO account_legal_holds (user_id, reason_code, active) VALUES (?, 'LEGAL_REQUEST', 1)`).run(state.user.id);
    const blocked = runEligibleAccountPurges({ db: state.db, repo: state.repo, now: 102, mediaPurger() { throw new Error("must not run"); } });
    assert.equal(blocked[0].status, "blocked_legal_hold");
    assert.ok(state.repo.getUserById(state.user.id));

    state.db.prepare(`UPDATE account_legal_holds SET active = 0 WHERE user_id = ?`).run(state.user.id);
    const purgedMedia = [];
    const purged = runEligibleAccountPurges({ db: state.db, repo: state.repo, now: 103, mediaPurger(hash, ext) { purgedMedia.push({ hash, ext }); } });
    assert.equal(purged[0].status, "purged");
    assert.deepEqual(purgedMedia, [{ hash: mediaHash, ext: "jpg" }]);
    assert.equal(state.repo.getUserById(state.user.id), null);
    assert.equal(state.db.prepare(`SELECT created_by FROM conversations WHERE id = ?`).get(conversationId).created_by, other.id);
    assert.equal(state.db.prepare(`SELECT body FROM message_items WHERE conversation_id = ? ORDER BY id`).all(conversationId).some((row) => row.body === "owner secret"), false);
    assert.equal(state.db.prepare(`SELECT body FROM message_items WHERE conversation_id = ? ORDER BY id`).all(conversationId).some((row) => row.body === "survivor data"), true);
    const tombstone = state.db.prepare(`SELECT * FROM account_purge_tombstones WHERE deletion_request_id = ?`).get(request.id);
    assert.equal(tombstone.subject_hash, request.subject_hash);
    assert.equal(JSON.stringify(tombstone).includes("gdpr_owner"), false);
    assert.equal(state.db.prepare(`PRAGMA foreign_key_check`).all().length, 0);
  } finally { state.db.close(); }
});
