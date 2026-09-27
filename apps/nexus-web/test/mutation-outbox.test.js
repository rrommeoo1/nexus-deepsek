import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { issueSession } from "../lib/security.js";
import { handleRequest } from "../lib/api.js";
import { MutationError, attachMutationRecorder, prepareMutation } from "../lib/mutation-idempotency.js";
import { createLocalOutboxHandlers, dispatchOutboxBatch } from "../lib/outbox.js";

function response() {
  const res = { statusCode: 200, headers: {}, body: "", ended: false };
  res.writeHead = (code, headers = {}) => { res.statusCode = code; Object.assign(res.headers, headers); };
  res.setHeader = (name, value) => { res.headers[String(name).toLowerCase()] = value; };
  res.getHeader = (name) => res.headers[String(name).toLowerCase()];
  res.end = (data) => { res.ended = true; res.body = Buffer.isBuffer(data) ? data.toString("utf8") : String(data ?? ""); };
  return res;
}

function request(method, url, cookie, body, idempotencyKey) {
  const raw = Buffer.from(JSON.stringify(body ?? {}));
  return {
    method, url,
    headers: { "content-type": "application/json", cookie, ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
    on(event, callback) {
      if (event === "data") process.nextTick(() => callback(raw));
      if (event === "end") process.nextTick(callback);
      return this;
    },
    destroy() {},
    socket: { remoteAddress: "127.0.0.1" },
  };
}

test("mutation registry is replay-safe, persona-scoped and does not store plaintext responses", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "mutation-owner", displayName: "Owner" });
    repo.ensurePersona(user.id, "social", {});
    repo.ensurePersona(user.id, "work", {});
    const key = "nexus-mutation-registry-0001";
    const body = Buffer.from('{"caption":"private fixture"}');
    const prepared = prepareMutation({ db, userId: user.id, actorPersona: "social", key, method: "POST", requestTarget: "/api/posts", body, now: 100 });
    assert.equal(prepared.action, "execute");
    const res = response();
    attachMutationRecorder({ db, res, mutationId: prepared.id, now: () => 101 });
    res.writeHead(201, { "content-type": "application/json" });
    res.end('{"ok":true,"secret":"not plaintext in registry"}');

    const stored = db.prepare(`SELECT response_body FROM mutation_requests WHERE id = ?`).get(prepared.id);
    assert.equal(Buffer.from(stored.response_body).includes(Buffer.from("not plaintext")), false);
    const replay = prepareMutation({ db, userId: user.id, actorPersona: "social", key, method: "POST", requestTarget: "/api/posts", body, now: 102 });
    assert.equal(replay.action, "replay");
    assert.equal(replay.status, 201);
    assert.equal(JSON.parse(replay.body.toString()).secret, "not plaintext in registry");
    assert.throws(
      () => prepareMutation({ db, userId: user.id, actorPersona: "social", key, method: "POST", requestTarget: "/api/posts", body: Buffer.from("different"), now: 102 }),
      (error) => error instanceof MutationError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    const work = prepareMutation({ db, userId: user.id, actorPersona: "work", key, method: "POST", requestTarget: "/api/posts", body, now: 102 });
    assert.equal(work.action, "execute");

    const pendingKey = "nexus-mutation-in-progress-0002";
    prepareMutation({ db, userId: user.id, actorPersona: "social", key: pendingKey, method: "POST", requestTarget: "/api/posts", body, now: 200 });
    assert.throws(
      () => prepareMutation({ db, userId: user.id, actorPersona: "social", key: pendingKey, method: "POST", requestTarget: "/api/posts", body, now: 201 }),
      (error) => error.code === "IDEMPOTENCY_IN_PROGRESS" && error.retryable,
    );
  } finally { db.close(); }
});

test("authenticated Social mutations require a key and replay one created post", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  try {
    const user = repo.createUser({ handle: "api-idempotent-owner", displayName: "Owner" });
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    const session = issueSession(user.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
    const cookie = `nexus_session=${session.token}`;
    const body = { persona: "social", kind: "text", caption: "exactly once", provenance: "NOT_DECLARED" };
    const call = async (key, payload = body) => {
      const res = response();
      await handleRequest(request("POST", "/api/posts", cookie, payload, key), res, { db, repo, sse });
      return { status: res.statusCode, body: JSON.parse(res.body) };
    };
    assert.equal((await call(null)).status, 400);
    const key = "nexus-api-post-create-0001";
    const first = await call(key);
    const replay = await call(key);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.equal(replay.body.post.id, first.body.post.id);
    assert.equal(repo.listPosts({ persona: "social" }).filter((post) => post.caption === "exactly once").length, 1);
    assert.equal((await call(key, { ...body, caption: "conflict" })).status, 409);

    const legacy = response();
    await handleRequest(request("POST", "/api/media", cookie, { data: "AAAA" }, "nexus-legacy-media-0001"), legacy, { db, repo, sse });
    assert.equal(legacy.statusCode, 410);
    assert.equal(JSON.parse(legacy.body).code, "MEDIA_UPLOAD_LEGACY_RETIRED");
  } finally { db.close(); }
});

test("post publication rolls back at the commit boundary and retries exactly once", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const broadcasts = [];
  const sse = { broadcast(type, payload, channels) { broadcasts.push({ type, payload, channels }); }, publish() {}, subscribe() { return () => {}; } };
  try {
    const user = repo.createUser({ handle: "post-crash-owner", displayName: "Crash owner" });
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    const session = issueSession(user.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
    const cookie = `nexus_session=${session.token}`;
    const key = "nexus-post-crash-boundary-0001";
    const body = { persona: "social", kind: "text", caption: "atomic publication", provenance: "NOT_DECLARED" };

    await assert.rejects(
      handleRequest(request("POST", "/api/posts", cookie, body, key), response(), {
        db, repo, sse,
        beforePostCommit() { throw new Error("SYSTEM_TEST_CRASH_BEFORE_COMMIT"); },
      }),
      /SYSTEM_TEST_CRASH_BEFORE_COMMIT/,
    );
    assert.equal(repo.listPosts({ persona: "social" }).filter((post) => post.caption === body.caption).length, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_events WHERE event_type = 'social.post.published'`).get().count, 0);
    assert.equal(db.prepare(`SELECT status FROM mutation_requests WHERE idempotency_key = ?`).get(key).status, "in_progress");

    // Simulate lease expiry after process restart, then retry the exact command.
    db.prepare(`UPDATE mutation_requests SET updated_at = 0 WHERE idempotency_key = ?`).run(key);
    const successful = response();
    await handleRequest(request("POST", "/api/posts", cookie, body, key), successful, { db, repo, sse });
    assert.equal(successful.statusCode, 201);
    const created = JSON.parse(successful.body).post;
    assert.equal(repo.listPosts({ persona: "social" }).filter((post) => post.caption === body.caption).length, 1);
    assert.equal(db.prepare(`SELECT status FROM mutation_requests WHERE idempotency_key = ?`).get(key).status, "completed");
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_events WHERE aggregate_id = ? AND event_type = 'social.post.published'`).get(String(created.id)).count, 1);

    const replay = response();
    await handleRequest(request("POST", "/api/posts", cookie, body, key), replay, { db, repo, sse });
    assert.equal(replay.statusCode, 201);
    assert.equal(JSON.parse(replay.body).post.id, created.id);
    assert.equal(repo.listPosts({ persona: "social" }).filter((post) => post.caption === body.caption).length, 1);

    const handlers = createLocalOutboxHandlers(repo, { sse });
    assert.equal(dispatchOutboxBatch({ db, handlers, workerId: "post-worker", now: Math.floor(Date.now() / 1000) }).published, 2);
    assert.equal(db.prepare(`SELECT status FROM outbox_events WHERE event_type = 'action.intent.created'`).get().status, "published");
    assert.deepEqual(broadcasts, [{
      type: "post-available",
      payload: { post_id: created.id, persona: "social" },
      channels: [`user:${user.id}`, "persona:social"],
    }]);
  } finally { db.close(); }
});

test("private post outbox never broadcasts private data or a broad persona channel", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const broadcasts = [];
  try {
    const user = repo.createUser({ handle: "private-outbox-owner", displayName: "Private owner" });
    repo.ensurePersona(user.id, "social", { visibility: "private" });
    const post = repo.createPost({ userId: user.id, persona: "social", kind: "text", caption: "private secret", visibility: "private" });
    db.prepare(`INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload_json, status, available_at)
      VALUES ('post', ?, 'social.post.published', ?, 'pending', 100)`).run(String(post.id), JSON.stringify({ postId: post.id }));
    const handlers = createLocalOutboxHandlers(repo, {
      sse: { broadcast(type, payload, channels) { broadcasts.push({ type, payload, channels }); } },
    });
    assert.equal(dispatchOutboxBatch({ db, handlers, workerId: "privacy-worker", now: 100 }).published, 1);
    assert.deepEqual(broadcasts, [{ type: "post-available", payload: { post_id: post.id, persona: "social" }, channels: [`user:${user.id}`] }]);
    assert.equal(JSON.stringify(broadcasts).includes("private secret"), false);
  } finally { db.close(); }
});

test("100 SYSTEM_TEST actors survive a 1,000-request idempotent replay storm", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const actors = Array.from({ length: 100 }, (_, index) => {
      const user = repo.createUser({ handle: `systemtest_mutation_${String(index).padStart(3, "0")}`, displayName: `SYSTEM_TEST mutation ${index}`, trafficClass: "SYSTEM_TEST" });
      repo.ensurePersona(user.id, "social", {});
      return { user, index, key: `systemtest-mutation-${String(index).padStart(8, "0")}`, body: Buffer.from(JSON.stringify({ action: "like", post: index })) };
    });
    for (const actor of actors) {
      const prepared = prepareMutation({ db, userId: actor.user.id, actorPersona: "social", key: actor.key, method: "POST", requestTarget: `/api/posts/${actor.index}/reaction`, body: actor.body, now: 1_000 });
      const res = response();
      attachMutationRecorder({ db, res, mutationId: prepared.id, now: () => 1_001 });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, actor: actor.index }));
    }
    let replays = 0;
    for (let wave = 0; wave < 10; wave++) {
      for (const actor of [...actors].reverse()) {
        const replay = prepareMutation({ db, userId: actor.user.id, actorPersona: "social", key: actor.key, method: "POST", requestTarget: `/api/posts/${actor.index}/reaction`, body: actor.body, now: 1_002 + wave });
        assert.equal(replay.action, "replay");
        assert.equal(JSON.parse(replay.body.toString()).actor, actor.index);
        replays++;
      }
    }
    assert.equal(replays, 1_000);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM mutation_requests WHERE status = 'completed'`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM action_intents WHERE actor_kind = 'SYSTEM_TEST' AND chain_status = 'EXCLUDED_SYNTHETIC'`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_events WHERE event_type = 'action.intent.created'`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM users WHERE traffic_class = 'SYSTEM_TEST'`).get().count, 100);
  } finally { db.close(); }
});

test("outbox worker claims once, retries with backoff and dead-letters bounded failures", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const user = repo.createUser({ handle: "outbox-owner", displayName: "Owner" });
    repo.ensurePersona(user.id, "social", {});
    const media = repo.insertMedia({ hash: "a".repeat(64), ext: "jpg", mime: "image/jpeg", detectedMime: "image/jpeg", kind: "image", size: 4, uploadedBy: user.id, purpose: "social_post", actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "fixture" });
    db.prepare(`INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload_json, status, available_at, created_at) VALUES ('upload', 'upload-good', 'media.upload.completed', ?, 'pending', 100, 100)`)
      .run(JSON.stringify({ uploadId: "upload-good", mediaId: media.id }));
    const handlers = createLocalOutboxHandlers(repo);
    assert.deepEqual(dispatchOutboxBatch({ db, handlers, workerId: "worker-a", now: 100 }), { claimed: 1, published: 1, retried: 0, dead_lettered: 0 });
    assert.deepEqual(dispatchOutboxBatch({ db, handlers, workerId: "worker-b", now: 100 }), { claimed: 0, published: 0, retried: 0, dead_lettered: 0 });

    db.prepare(`INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload_json, status, available_at, created_at) VALUES ('test', 'always-fails', 'test.failure', '{}', 'pending', 200, 200)`).run();
    const failing = { "test.failure": () => { throw new Error("synthetic handler failure"); } };
    assert.equal(dispatchOutboxBatch({ db, handlers: failing, workerId: "worker-f", now: 200, maxAttempts: 3 }).retried, 1);
    assert.equal(dispatchOutboxBatch({ db, handlers: failing, workerId: "worker-f", now: 201, maxAttempts: 3 }).retried, 1);
    assert.equal(dispatchOutboxBatch({ db, handlers: failing, workerId: "worker-f", now: 206, maxAttempts: 3 }).dead_lettered, 1);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_dead_letters`).get().count, 1);
    assert.equal(db.prepare(`SELECT status FROM outbox_events WHERE aggregate_id = 'always-fails'`).get().status, "failed");
  } finally { db.close(); }
});
