import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { migrateNotificationSchema, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let sequence = 0;

function request(method, url, cookie, body = {}, key = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url,
    headers: {
      "content-type": "application/json", cookie,
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)
        ? { "idempotency-key": key || `notification-test-${String(++sequence).padStart(8, "0")}` }
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
  const user = repo.createUser({ handle: "notification_owner", displayName: "Notification owner" });
  repo.ensurePersona(user.id, "social", { visibility: "public" });
  repo.ensurePersona(user.id, "dating", { visibility: "private" });
  const session = issueSession(user.id, "social");
  repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
  const sseEvents = [];
  return {
    db, repo, user, sseEvents, cookie: `nexus_session=${session.token}`,
    context: { db, repo, sse: { publish(channel, event, data) { sseEvents.push({ channel, event, data }); return { written: 1 }; }, broadcast() {}, subscribe() { return () => {}; } } },
  };
}

async function call(state, method, path, body = {}, key = null) {
  const res = response();
  await handleRequest(request(method, path, state.cookie, body, key), res, state.context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} };
}

test("notification preferences are persona-scoped, mandatory safety stays on and sensitive preview is generic", () => {
  const state = fixture();
  try {
    state.repo.setNotificationPreference(state.user.id, "social", "reaction", { in_app: false, preview: "content" });
    assert.equal(state.repo.notify(state.user.id, "reaction", "Love from @actor", { persona: "social" }).delivered, false);
    assert.equal(state.repo.listNotifications(state.user.id, { persona: "social" }).length, 0);

    const security = state.repo.setNotificationPreference(state.user.id, "social", "security", { in_app: false, preview: "content" });
    assert.equal(security.in_app, 1);
    assert.equal(state.repo.notify(state.user.id, "security", "New login from @device", { persona: "social", sensitive: true }).delivered, true);

    const dating = state.repo.setNotificationPreference(state.user.id, "dating", "message", { in_app: true, preview: "content" });
    assert.equal(dating.preview, "generic");
    state.repo.notify(state.user.id, "message", "Secret message from @match", { persona: "dating", sensitive: true });
    const stored = state.repo.listNotifications(state.user.id, { persona: "dating" })[0];
    assert.equal(stored.body.includes("@match"), false);
    assert.equal(state.repo.unreadNotifications(state.user.id, "social"), 1);
    assert.equal(state.repo.unreadNotifications(state.user.id, "dating"), 1);
  } finally { state.db.close(); }
});

test("notification API is owner-only, idempotent and keeps external channels gated", async () => {
  const state = fixture();
  try {
    const first = state.repo.notify(state.user.id, "comment", "Comentariu nou", { persona: "social" });
    state.repo.notify(state.user.id, "comment", "Comentariu nou", { persona: "social" });
    assert.equal(state.repo.listNotifications(state.user.id, { persona: "social" })[0].actor_count, 2);

    const listed = await call(state, "GET", "/api/notifications?persona=social");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.unread, 1);
    assert.equal(listed.body.unread_non_message, 1);
    assert.deepEqual(listed.body.query, { viewer_id: state.user.id, persona: "social" });
    assert.equal(listed.body.privacy_enforced_server_side, true);
    assert.equal(listed.body.notifications[0].actor_count, 2);

    const push = await call(state, "PATCH", "/api/notification-preferences", { persona: "social", type: "comment", in_app: true, push: true });
    assert.equal(push.status, 409);
    assert.equal(push.body.code, "CHANNEL_GATED");

    const preference = await call(state, "PATCH", "/api/notification-preferences", {
      persona: "social", type: "comment", in_app: true, preview: "sender", quiet_start: "22:00", quiet_end: "07:00",
    });
    assert.equal(preference.status, 200);
    assert.deepEqual({ owner_id: preference.body.owner_id, persona: preference.body.persona, type: preference.body.type },
      { owner_id: state.user.id, persona: "social", type: "comment" });
    assert.equal(preference.body.preference.quiet_start, "22:00");

    const key = "notification-read-exactly-once-0001";
    const read = await call(state, "PATCH", `/api/notifications/${first.id}`, { read: true }, key);
    const replay = await call(state, "PATCH", `/api/notifications/${first.id}`, { read: true }, key);
    assert.equal(read.status, 200);
    assert.equal(read.body.changed, true);
    assert.deepEqual({ notification_id: read.body.notification_id, owner_id: read.body.owner_id, persona: read.body.persona, read: read.body.read },
      { notification_id: first.id, owner_id: state.user.id, persona: "social", read: true });
    assert.deepEqual(replay.body, read.body);
    assert.match(read.body.change_id, /^[A-Za-z0-9_-]{16}$/);
    assert.equal(state.sseEvents.filter((event) => event.event === "notification-changed" && event.data.action === "read").length, 1, "idempotent replay does not emit a second invalidation");

    const alreadyRead = await call(state, "PATCH", `/api/notifications/${first.id}`, { read: true }, "notification-read-already-read-0002");
    assert.equal(alreadyRead.status, 200);
    assert.equal(alreadyRead.body.changed, false);
    assert.equal(alreadyRead.body.change_id, null);
    assert.equal(state.sseEvents.filter((event) => event.event === "notification-changed" && event.data.action === "read").length, 1, "no-op mutation emits no phantom invalidation");

    state.repo.notify(state.user.id, "follow", "Follow nou", { persona: "social" });
    const readAll = await call(state, "PATCH", "/api/notifications", { read_all: true, persona: "social" }, "notification-read-all-exact-0001");
    assert.deepEqual({ owner_id: readAll.body.owner_id, persona: readAll.body.persona, unread: readAll.body.unread },
      { owner_id: state.user.id, persona: "social", unread: 0 });
    assert.equal(state.sseEvents.some((event) => event.event === "notification-changed" && event.data.action === "read_all" && event.data.recipient_id === state.user.id), true);
    const readAllNoop = await call(state, "PATCH", "/api/notifications", { read_all: true, persona: "social" }, "notification-read-all-noop-0002");
    assert.equal(readAllNoop.body.changed, 0);
    assert.equal(readAllNoop.body.change_id, null);
    assert.equal(state.sseEvents.filter((event) => event.event === "notification-changed" && event.data.action === "read_all").length, 1);

    const foreign = state.repo.createUser({ handle: "notification_foreign", displayName: "Foreign" });
    const foreignNotification = state.repo.notify(foreign.id, "system", "Foreign only");
    const denied = await call(state, "PATCH", `/api/notifications/${foreignNotification.id}`, { read: true });
    assert.equal(denied.status, 404);
    assert.equal(state.repo.unreadNotifications(foreign.id), 1);

    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(app, /Number\(read\.owner_id\) === Number\(state\.user\.id\)/);
    assert.match(app, /Number\(read\.notification_id\) === notificationId/);
    // The preference forms moved into their own module in wave 6e, because the inbox and the profile
    // menu render the same list; the write contract is pinned where the form now lives.
    const preferences = readFileSync(new URL("../public/notification-preferences.js", import.meta.url), "utf8");
    assert.match(preferences, /saved\.persona === persona/);
    assert.match(preferences, /saved\.preference\?\.persona === persona && saved\.preference\?\.type === form\.dataset\.notificationPref/);
    assert.match(preferences, /export const NOTIFICATION_LABEL_KEYS/);
  } finally { state.db.close(); }
});

test("legacy notification schema migrates before persona index creation and is restart-safe", () => {
  const legacy = new DatabaseSync(":memory:");
  try {
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL);
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        body TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    migrateNotificationSchema(legacy);
    const columns = new Set(legacy.prepare(`PRAGMA table_info(notifications)`).all().map((row) => row.name));
    assert.equal(columns.has("persona"), true);
    assert.equal(columns.has("sensitive"), true);
    assert.equal(columns.has("actor_count"), true);
    assert.equal(legacy.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_notif_user_persona'`).get().name, "idx_notif_user_persona");
    migrateNotificationSchema(legacy);
    assert.equal(legacy.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally {
    legacy.close();
  }
});
