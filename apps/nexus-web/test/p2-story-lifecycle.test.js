import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let mutationSequence = 0;

function fakeReq(method, url, body = {}, cookie = "", idempotencyKey = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)
        ? { "idempotency-key": idempotencyKey || `p2-story-${String(++mutationSequence).padStart(8, "0")}` }
        : {}),
    },
    socket: { remoteAddress: "127.0.0.93" },
    on(event, callback) {
      if (event === "data") process.nextTick(() => callback(raw));
      if (event === "end") process.nextTick(callback);
      return this;
    },
    once() { return this; },
    destroy() {},
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    end(value) {
      if (typeof value === "string") this.body = value;
      else if (Buffer.isBuffer(value)) this.body = value.toString("utf8");
    },
  };
}

function sessionCookie(repo, userId, persona = "social") {
  const session = issueSession(userId, persona);
  repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
  return `nexus_session=${session.token}`;
}

async function call(context, method, path, body, cookie, idempotencyKey = null) {
  const res = fakeRes();
  await handleRequest(fakeReq(method, path, body, cookie, idempotencyKey), res, context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers };
}

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const context = {
    db,
    repo,
    sse: {
      publish() { return { subscribers: 0, written: 0 }; },
      broadcast() { return { subscribers: 0, written: 0 }; },
      subscribe() { return () => {}; },
    },
  };
  const alice = repo.createUser({ handle: "story_alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "story_bob", displayName: "Bob" });
  for (const user of [alice, bob]) {
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    repo.ensurePersona(user.id, "work", { visibility: "public" });
  }
  return {
    db,
    repo,
    context,
    alice,
    bob,
    aliceSocial: sessionCookie(repo, alice.id, "social"),
    aliceWork: sessionCookie(repo, alice.id, "work"),
    bobSocial: sessionCookie(repo, bob.id, "social"),
  };
}

function addStoryMedia(repo, userId, marker) {
  return repo.insertMedia({
    hash: marker.repeat(64),
    ext: "jpg",
    mime: "image/jpeg",
    detectedMime: "image/jpeg",
    kind: "image",
    size: 128,
    uploadedBy: userId,
    purpose: "story",
    actorPersona: "social",
    scanStatus: "ready_local_validation",
    scanReason: "test fixture",
  });
}

test("expired and archived Stories cannot record views or authorize media reads", () => {
  const state = fixture();
  try {
    const expiredMedia = addStoryMedia(state.repo, state.alice.id, "a");
    const expired = state.repo.createStory({
      userId: state.alice.id,
      persona: "social",
      mediaId: expiredMedia.id,
      visibility: "public",
      expiresAt: 10,
    });
    assert.equal(state.repo.recordStoryView(expired.id, state.bob.id, "social", 1, true), null);
    assert.equal(state.repo.canReadMedia(expiredMedia.id, state.bob.id, "social"), false);

    const activeMedia = addStoryMedia(state.repo, state.alice.id, "b");
    const active = state.repo.createStory({
      userId: state.alice.id,
      persona: "social",
      mediaId: activeMedia.id,
      visibility: "public",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    assert.equal(state.repo.canReadMedia(activeMedia.id, state.bob.id, "social"), true);
    assert.equal(state.repo.archiveStory(active.id, state.alice.id, "work"), false);
    assert.equal(state.repo.archiveStory(active.id, state.alice.id, "social"), true);
    assert.equal(state.repo.recordStoryView(active.id, state.bob.id, "social", 1, true), null);
    assert.equal(state.repo.canReadMedia(activeMedia.id, state.bob.id, "social"), false);
  } finally { state.db.close(); }
});

test("Story API is Social-persona bound and never exposes internal media metadata", async () => {
  const state = fixture();
  try {
    const media = addStoryMedia(state.repo, state.alice.id, "c");
    const created = await call(state.context, "POST", "/api/stories", {
      caption: "Story public sigur",
      media_hash: media.hash,
      persistent: true,
      visibility: "public",
    }, state.aliceSocial);
    assert.equal(created.status, 201);
    assert.deepEqual({ action: created.body.action, owner_id: created.body.owner_id, owner_persona: created.body.owner_persona },
      { action: "story_published", owner_id: state.alice.id, owner_persona: "social" });
    assert.deepEqual(Object.keys(created.body.story.media).sort(), ["ext", "hash", "kind", "mime", "size"]);
    assert.equal("scan_reason" in created.body.story.media, false);
    assert.equal("uploaded_by" in created.body.story.media, false);

    const listed = await call(state.context, "GET", "/api/stories?state=unseen", {}, state.bobSocial);
    assert.equal(listed.status, 200);
    assert.deepEqual({ viewer_id: listed.body.viewer_id, viewer_persona: listed.body.viewer_persona, state: listed.body.state },
      { viewer_id: state.bob.id, viewer_persona: "social", state: "unseen" });
    assert.equal(listed.body.stories.length, 1);
    assert.deepEqual(Object.keys(listed.body.stories[0].media).sort(), ["ext", "hash", "kind", "mime", "size"]);

    const crossPersonaView = await call(state.context, "POST", `/api/stories/${created.body.story.id}/view`, { progress: 1, completed: true }, state.aliceWork);
    assert.equal(crossPersonaView.status, 409);
    const crossPersonaArchive = await call(state.context, "POST", `/api/stories/${created.body.story.id}/archive`, {}, state.aliceWork);
    assert.equal(crossPersonaArchive.status, 409);

    const viewed = await call(state.context, "POST", `/api/stories/${created.body.story.id}/view`, { progress: 1, completed: true }, state.bobSocial);
    assert.equal(viewed.status, 200);
    assert.deepEqual({ story_id: viewed.body.story_id, actor_id: viewed.body.actor_id, actor_persona: viewed.body.actor_persona, requested_progress: viewed.body.requested_progress, requested_completed: viewed.body.requested_completed, viewed: viewed.body.viewed },
      { story_id: created.body.story.id, actor_id: state.bob.id, actor_persona: "social", requested_progress: 1, requested_completed: true, viewed: true });

    const archived = await call(state.context, "POST", `/api/stories/${created.body.story.id}/archive`, {}, state.aliceSocial);
    assert.equal(archived.status, 200);
    assert.deepEqual({ story_id: archived.body.story_id, actor_id: archived.body.actor_id, actor_persona: archived.body.actor_persona, status: archived.body.status },
      { story_id: created.body.story.id, actor_id: state.alice.id, actor_persona: "social", status: "archived" });
    const afterArchive = await call(state.context, "POST", `/api/stories/${created.body.story.id}/view`, { progress: 1, completed: true }, state.bobSocial);
    assert.equal(afterArchive.status, 404);
  } finally { state.db.close(); }
});

test("Story publication is exactly-once when the client retries after a lost response", async () => {
  const state = fixture();
  try {
    const media = addStoryMedia(state.repo, state.alice.id, "d");
    const body = { caption: "Retry sigur", media_hash: media.hash, persistent: false, duration_hours: 12, visibility: "followers" };
    const key = "p2-story-publish-recovery-00000001";
    const first = await call(state.context, "POST", "/api/stories", body, state.aliceSocial, key);
    const replay = await call(state.context, "POST", "/api/stories", body, state.aliceSocial, key);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.deepEqual(replay.body, first.body);
    assert.equal(replay.body.action, "story_published");
    assert.equal(replay.body.owner_id, state.alice.id);
    assert.equal(replay.body.owner_persona, "social");
    assert.equal(replay.body.story.media.hash, media.hash);
    assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM stories WHERE user_id = ?").get(state.alice.id).count, 1);
  } finally { state.db.close(); }
});

test("Story archive and Highlights preserve media while enforcing the Social Privacy Matrix", async () => {
  const state = fixture();
  try {
    const outsider = state.repo.createUser({ handle: "story_outsider", displayName: "Outsider" });
    state.repo.ensurePersona(outsider.id, "social", { visibility: "public" });
    const outsiderCookie = sessionCookie(state.repo, outsider.id, "social");
    const media = addStoryMedia(state.repo, state.alice.id, "e");
    const story = state.repo.createStory({ userId: state.alice.id, persona: "social", mediaId: media.id, caption: "Friends only", visibility: "friends", expiresAt: null });
    assert.equal(state.repo.archiveStory(story.id, state.alice.id, "social"), true);

    const archive = await call(state.context, "GET", "/api/stories/archive", {}, state.aliceSocial);
    assert.equal(archive.status, 200);
    assert.equal(archive.body.owner_id, state.alice.id);
    assert.deepEqual(archive.body.stories.map((item) => item.id), [story.id]);

    const created = await call(state.context, "POST", "/api/story-highlights", { title: "Momente" }, state.aliceSocial);
    assert.equal(created.status, 201);
    assert.equal(created.body.action, "story_highlight_created");
    const highlightId = created.body.highlight.id;
    const added = await call(state.context, "POST", `/api/story-highlights/${highlightId}/items`, { story_id: story.id }, state.aliceSocial);
    assert.equal(added.status, 201);
    assert.equal(added.body.story.status, "archived");

    const hidden = await call(state.context, "GET", "/api/profiles/story_alice/highlights", {}, outsiderCookie);
    assert.equal(hidden.status, 200);
    assert.deepEqual(hidden.body.highlights, []);
    assert.equal(state.repo.canReadMedia(media.id, outsider.id, "social"), false);

    state.repo.setFollow(outsider.id, state.alice.id, "social", true);
    state.repo.setFollow(state.alice.id, outsider.id, "social", true);
    const visible = await call(state.context, "GET", "/api/profiles/story_alice/highlights", {}, outsiderCookie);
    assert.equal(visible.status, 200);
    assert.equal(visible.body.privacy_enforced_server_side, true);
    assert.deepEqual(visible.body.highlights[0].stories.map((item) => item.id), [story.id]);
    assert.equal(state.repo.canReadMedia(media.id, outsider.id, "social"), true);

    state.repo.setProfileBlock(state.alice.id, "social", outsider.id, true);
    const blocked = await call(state.context, "GET", "/api/profiles/story_alice/highlights", {}, outsiderCookie);
    assert.deepEqual(blocked.body.highlights, []);
    assert.equal(state.repo.canReadMedia(media.id, outsider.id, "social"), false);

    const forged = await call(state.context, "POST", `/api/story-highlights/${highlightId}/items`, { story_id: story.id }, state.bobSocial);
    assert.equal(forged.status, 404);
  } finally { state.db.close(); }
});
