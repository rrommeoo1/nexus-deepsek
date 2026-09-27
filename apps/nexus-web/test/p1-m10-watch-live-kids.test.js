import test from "node:test";
import assert from "node:assert/strict";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let seq = 0;
function request(method, url, body = {}, cookie = "", headers = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  return { method, url, socket: { remoteAddress: "127.0.0.210" }, headers: { "content-type": "application/json", cookie,
    ...(new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) ? { "idempotency-key": `m10-test-${String(++seq).padStart(12, "0")}` } : {}), ...headers },
  on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; }, once() { return this; }, destroy() {} };
}
function response() { return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); } }; }
async function call(state, method, path, body = {}, cookie = "", headers = {}) { const res = response(); await handleRequest(request(method, path, body, cookie, headers), res, state.context); return { status: res.statusCode, body: res.body && String(res.headers["content-type"] || "").includes("json") ? JSON.parse(res.body) : res.body, headers: res.headers }; }
function authCookie(repo, userId, persona = "social") { const session = issueSession(userId, persona); repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt }); return `nexus_session=${session.token}`; }
function fixture() {
  const db = openDb(":memory:"), repo = createRepo(db), sse = { publish() { return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } };
  const owner = repo.createUser({ handle: "watch_owner", displayName: "Watch Owner" });
  const viewer = repo.createUser({ handle: "watch_viewer", displayName: "Watch Viewer" });
  const synthetic = repo.createUser({ handle: "watch_systemtest", displayName: "SYSTEM_TEST", trafficClass: "SYSTEM_TEST" });
  for (const user of [owner, viewer, synthetic]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  const media = repo.insertMedia({ hash: "a".repeat(64), ext: "mp4", mime: "video/mp4", detectedMime: "video/mp4", kind: "video", size: 2048, uploadedBy: owner.id, purpose: "watch_video", actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "test_fixture" });
  return { db, repo, context: { db, repo, sse }, owner, viewer, synthetic, media, ownerCookie: authCookie(repo, owner.id), viewerCookie: authCookie(repo, viewer.id) };
}

test("M10 Watch publishes only eligible owned media and preserves viewer-private progress", async () => {
  const state = fixture();
  try {
    const channel = await call(state, "POST", "/api/watch/channels", { handle: "nexus_learning", title: "Nexus Learning", description: "Long form" }, state.ownerCookie);
    assert.equal(channel.status, 201);
    const draft = await call(state, "POST", "/api/watch/videos", { channel_id: channel.body.channel.id, media_id: state.media.id, title: "Safe architecture", description: "A local Watch demo", duration_seconds: 600, audience: "public", age_rating: "general", captions_language: "en", rights_declared: true }, state.ownerCookie);
    assert.equal(draft.status, 201, JSON.stringify(draft.body)); assert.equal(draft.body.video.state, "draft"); assert.equal(draft.body.real_rights_clearance, false);
    const before = await call(state, "GET", "/api/watch/home?mode=editorial", {}, state.viewerCookie);
    assert.deepEqual(before.body.videos, []);
    const published = await call(state, "PATCH", `/api/watch/videos/${draft.body.video.id}`, { action: "publish" }, state.ownerCookie);
    assert.equal(published.status, 200); assert.equal(published.body.video.state, "published"); assert.equal(published.body.production_eligible, false);
    const home = await call(state, "GET", "/api/watch/home?mode=editorial", {}, state.viewerCookie);
    assert.deepEqual(home.body.videos.map((video) => video.id), [draft.body.video.id]); assert.equal(home.body.ranker, "EDITORIAL_LOCAL_NO_BEHAVIORAL_MODEL");
    const progress = await call(state, "POST", `/api/watch/videos/${draft.body.video.id}/progress`, { position_seconds: 120 }, state.viewerCookie);
    assert.equal(progress.body.progress.position_seconds, 120); assert.equal(progress.body.progress.privacy, "VIEWER_ONLY_TELEMETRY_NO_ACTION_LEDGER");
    assert.equal(state.repo.listWatchHome(state.owner.id).continue_watching.length, 0);
    assert.equal(state.repo.listWatchHome(state.viewer.id).continue_watching[0].progress_seconds, 120);
  } finally { state.db.close(); }
});

test("M10 subscriptions and playlists are owner/viewer bound", async () => {
  const state = fixture();
  try {
    const channel = state.repo.createWatchChannel({ ownerId: state.owner.id, handle: "sub_channel", title: "Subscriber Channel" });
    const video = state.repo.createWatchVideo({ ownerId: state.owner.id, channelId: channel.id, mediaId: state.media.id, title: "Subscriber episode", description: "", durationSeconds: 60, audience: "subscribers", ageRating: "general", captionsLanguage: "en" });
    state.repo.publishWatchVideo({ ownerId: state.owner.id, videoId: video.id });
    assert.equal(state.repo.getWatchVideo(video.id, state.viewer.id), null);
    const sub = await call(state, "POST", `/api/watch/channels/${channel.id}/subscription`, { active: true, notification_mode: "all" }, state.viewerCookie);
    assert.equal(sub.status, 200); assert.equal(sub.body.subscription.subscribed, true);
    assert.equal(state.repo.getWatchVideo(video.id, state.viewer.id).id, video.id);
    const playlist = await call(state, "POST", "/api/watch/playlists", { title: "Watch later", visibility: "private", kind: "watch_later" }, state.viewerCookie);
    const added = await call(state, "POST", `/api/watch/playlists/${playlist.body.playlist.id}/items`, { video_id: video.id }, state.viewerCookie);
    assert.equal(added.body.playlist.items[0].video.id, video.id);
    assert.equal(state.repo.getWatchPlaylist(playlist.body.playlist.id, state.owner.id), null);
  } finally { state.db.close(); }
});

test("M10 Live schedules locally, refuses start and terminates without chain/provider", async () => {
  const state = fixture();
  try {
    const preview = await call(state, "POST", "/api/social/live/preview", { title: "Local readiness", category: "education", visibility: "private", language: "en", comments_enabled: false }, state.ownerCookie);
    assert.equal(preview.status, 201);
    const scheduledAt = Math.floor(Date.now() / 1000) + 1800;
    const scheduled = await call(state, "POST", `/api/social/live/${preview.body.preview.id}/schedule`, { scheduled_at: scheduledAt }, state.ownerCookie);
    assert.equal(scheduled.body.session.status, "scheduled"); assert.equal(scheduled.body.public_broadcast, false);
    const start = await call(state, "POST", `/api/social/live/${preview.body.preview.id}/start`, {}, state.ownerCookie);
    assert.equal(start.status, 503); assert.equal(start.body.code, "LIVE_INGEST_NOT_CONFIGURED");
    const terminated = await call(state, "POST", `/api/social/live/${preview.body.preview.id}/terminate`, {}, state.ownerCookie);
    assert.equal(terminated.status, 200); assert.equal(terminated.body.session.status, "ended");
  } finally { state.db.close(); }
});

test("M10 Kids uses a child-only token, allowlisted catalog and off-chain expiring activity", async () => {
  const state = fixture();
  try {
    const channel = state.repo.createWatchChannel({ ownerId: state.owner.id, handle: "kids_science", title: "Kids Science" });
    const video = state.repo.createWatchVideo({ ownerId: state.owner.id, channelId: channel.id, mediaId: state.media.id, title: "Why stars shine", description: "", durationSeconds: 300, audience: "public", ageRating: "general", captionsLanguage: "en" });
    state.repo.publishWatchVideo({ ownerId: state.owner.id, videoId: video.id });
    const child = await call(state, "POST", "/api/family/children", { alias: "Explorer", age_band: "9_12", locale: "en", avatar_code: "comet", parental_authority_confirmed: true }, state.ownerCookie);
    assert.equal(child.status, 201); assert.equal(child.body.authority, "LOCAL_DEMO_UNVERIFIED");
    const controls = await call(state, "PUT", `/api/family/children/${child.body.child.id}/controls`, { daily_minutes: 30, search_enabled: true, live_enabled: false, approved_topics: ["science"] }, state.ownerCookie);
    assert.equal(controls.body.autoplay, false);
    const catalog = await call(state, "POST", "/api/family/catalog", { video_id: video.id, age_band: "9_12", locale: "en", topic: "science" }, state.ownerCookie);
    assert.equal(catalog.status, 201); assert.equal(catalog.body.editorial_state, "APPROVED_LOCAL_DEMO_NOT_PRODUCTION");
    const session = await call(state, "POST", `/api/family/children/${child.body.child.id}/session`, { parental_gate_confirmed: true }, state.ownerCookie);
    assert.equal(session.status, 201); assert.equal(session.body.reusable_as_adult_session, false);
    const bearer = { authorization: `Bearer ${session.body.child_session}` };
    const home = await call(state, "GET", "/api/kids/home", {}, "", bearer);
    assert.equal(home.status, 200); assert.equal(home.body.videos[0].video_id, video.id); assert.equal(home.body.ads, false); assert.equal(home.body.messages, false); assert.equal(home.body.autoplay, false);
    const adultDenied = await call(state, "GET", "/api/me", {}, "", bearer);
    assert.equal(adultDenied.status, 401);
    const idem = "kids-progress-exact-0001";
    const first = await call(state, "POST", "/api/kids/progress", { video_id: video.id, position_seconds: 42 }, "", { ...bearer, "idempotency-key": idem });
    const replay = await call(state, "POST", "/api/kids/progress", { video_id: video.id, position_seconds: 42 }, "", { ...bearer, "idempotency-key": idem });
    assert.equal(first.status, 200); assert.equal(first.body.chain_action, false); assert.equal(replay.body.replayed, true);
    assert.equal(state.db.prepare(`SELECT COUNT(*) c FROM action_intents WHERE user_id = ?`).get(state.owner.id).c, 4, "only adult family/catalog/session mutations enter the adult ledger");
    assert.equal(state.db.prepare(`SELECT COUNT(*) c FROM kids_history WHERE child_id = ?`).get(child.body.child.id).c, 1);
  } finally { state.db.close(); }
});

test("M10 schema encodes Watch rights and Kids isolation defaults", () => {
  const schema = String(SCHEMA);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS watch_videos/);
  assert.match(schema, /rights_state TEXT NOT NULL DEFAULT 'self_declared'/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS kids_sessions/);
  assert.match(schema, /autoplay INTEGER NOT NULL DEFAULT 0 CHECK\(autoplay = 0\)/);
  assert.match(schema, /KIDS_TOKEN_ONLY_NO_ADULT_ROUTES|kids_parent_controls/);
});
