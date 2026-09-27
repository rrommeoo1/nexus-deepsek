import test from "node:test";
import assert from "node:assert/strict";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let seq = 0;
function request(method, url, body = {}, cookie = "", headers = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url, socket: { remoteAddress: "127.0.0.211" },
    headers: {
      "content-type": "application/json", cookie,
      ...(new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) ? { "idempotency-key": `m11-test-${String(++seq).padStart(12, "0")}` } : {}),
      ...headers,
    },
    on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; },
    once() { return this; }, destroy() {},
  };
}
function response() {
  return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); } };
}
async function call(state, method, path, body = {}, cookie = "", headers = {}) {
  const res = response(); await handleRequest(request(method, path, body, cookie, headers), res, state.context);
  return { status: res.statusCode, body: res.body && String(res.headers["content-type"] || "").includes("json") ? JSON.parse(res.body) : res.body, headers: res.headers };
}
function authCookie(repo, userId, persona = "social") {
  const session = issueSession(userId, persona); repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
  return `nexus_session=${session.token}`;
}
function fixture() {
  const db = openDb(":memory:"), repo = createRepo(db);
  const sse = { publish() { return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } };
  const artist = repo.createUser({ handle: "music_owner", displayName: "Music Owner" });
  const listener = repo.createUser({ handle: "music_listener", displayName: "Music Listener" });
  const third = repo.createUser({ handle: "grow_third", displayName: "Grow Third" });
  for (const user of [artist, listener, third]) for (const persona of ["social", "dating", "work"]) repo.ensurePersona(user.id, persona, { visibility: "public" });
  const audio = repo.insertMedia({ hash: "b".repeat(64), ext: "mp3", mime: "audio/mpeg", detectedMime: "audio/mpeg", kind: "audio", size: 4096,
    uploadedBy: artist.id, purpose: "music_master", actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "test_fixture" });
  return { db, repo, context: { db, repo, sse }, artist, listener, third, audio,
    artistCookie: authCookie(repo, artist.id), listenerCookie: authCookie(repo, listener.id), listenerDatingCookie: authCookie(repo, listener.id, "dating"), thirdCookie: authCookie(repo, third.id) };
}

async function publishedTrack(state) {
  const page = await call(state, "POST", "/api/music/artists", { stage_name: "Nexus Aria", bio: "Independent", rights_declaration_confirmed: true }, state.artistCookie);
  assert.equal(page.status, 201, JSON.stringify(page.body));
  const draft = await call(state, "POST", "/api/music/tracks", { artist_id: page.body.artist.id, media_id: state.audio.id, title: "Local Orbit", duration_seconds: 180,
    rights_basis: "original", attribution: "", explicit: false, rights_declared: true }, state.artistCookie);
  assert.equal(draft.status, 201, JSON.stringify(draft.body));
  const published = await call(state, "PATCH", `/api/music/tracks/${draft.body.track.id}`, { action: "publish" }, state.artistCookie);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return { artist: page.body.artist, track: published.body.track };
}

test("M11 Music enforces owned masters, rights declaration and visibility before playback", async () => {
  const state = fixture();
  try {
    const before = await call(state, "GET", "/api/music/home", {}, state.listenerDatingCookie);
    assert.deepEqual(before.body.tracks, []);
    const { track } = await publishedTrack(state);
    const home = await call(state, "GET", "/api/music/home", {}, state.listenerDatingCookie);
    assert.equal(home.status, 200); assert.equal(home.body.tracks[0].id, track.id);
    assert.equal(home.body.commercial_catalog, false); assert.equal(home.body.tracks[0].production_eligible, false);
    assert.equal(state.repo.canReadMedia(state.audio.id, state.listener.id, "dating"), true);

    const key = "m11-play-replay-key-0001";
    const play = await call(state, "POST", "/api/music/playback/start", { track_id: track.id }, state.listenerDatingCookie, { "idempotency-key": key });
    const replay = await call(state, "POST", "/api/music/playback/start", { track_id: track.id }, state.listenerDatingCookie, { "idempotency-key": key });
    assert.equal(play.status, 201); assert.equal(play.body.play.royalty_eligible, false); assert.deepEqual(replay.body, play.body);
    assert.equal(state.db.prepare(`SELECT COUNT(*) c FROM music_play_starts WHERE user_id = ?`).get(state.listener.id).c, 1);

    const saved = await call(state, "PUT", `/api/music/library/${track.id}`, { active: true }, state.listenerDatingCookie);
    assert.equal(saved.body.library.private, true);
    assert.equal(state.repo.listMusicHome(state.artist.id).library.length, 0);
    assert.equal(state.repo.listMusicHome(state.listener.id).library[0].id, track.id);

    state.repo.setProfileBlock(state.listener.id, "dating", state.artist.id, true);
    assert.deepEqual(state.repo.listMusicHome(state.listener.id).tracks, []);
    assert.equal(state.repo.canReadMedia(state.audio.id, state.listener.id, "dating"), false);
  } finally { state.db.close(); }
});

test("M11 Music playlists are owner-bound and external/catalog claims stay gated", async () => {
  const state = fixture();
  try {
    const { track } = await publishedTrack(state);
    const list = await call(state, "POST", "/api/music/playlists", { title: "Private focus", visibility: "private" }, state.listenerCookie);
    assert.equal(list.status, 201);
    const added = await call(state, "POST", `/api/music/playlists/${list.body.playlist.id}/items`, { track_id: track.id }, state.listenerCookie);
    assert.equal(added.body.playlist.items[0].track.id, track.id);
    assert.equal(state.repo.getMusicPlaylist(list.body.playlist.id, state.third.id), null);
    const unlicensed = await call(state, "POST", "/api/music/tracks", { artist_id: 999, media_id: state.audio.id, title: "No declaration", duration_seconds: 10,
      rights_basis: "direct_license", attribution: "", explicit: false, rights_declared: false }, state.artistCookie);
    assert.equal(unlicensed.status, 400);
  } finally { state.db.close(); }
});

test("M11 Grow permits sourced W0/W1 only and creates a zero-value workout quote", async () => {
  const state = fixture();
  try {
    const rejected = await call(state, "POST", "/api/grow/content", { vertical: "nutrition", format: "article", title: "Clinical", summary: "Treatment",
      source_note: "Unknown", medical_class: "W2", non_medical_confirmed: true }, state.artistCookie);
    assert.equal(rejected.status, 400);
    const content = await call(state, "POST", "/api/grow/content", { vertical: "sport", format: "program", title: "Mobility basics", summary: "General movement education",
      source_note: "Reviewed local demo fixture", medical_class: "W1", non_medical_confirmed: true }, state.artistCookie);
    assert.equal(content.status, 201); assert.equal(content.body.production_eligible, false);
    const offer = await call(state, "POST", "/api/grow/workouts/offers", { content_id: content.body.content.id, title: "One guided session", access_minutes: 60, price_cents: 1000 }, state.artistCookie);
    assert.equal(offer.status, 201);
    const reserve = await call(state, "POST", `/api/grow/workouts/offers/${offer.body.offer.id}/reserve`, {}, state.listenerCookie);
    assert.equal(reserve.status, 201); assert.equal(reserve.body.real_value, 0);
    assert.equal(reserve.body.reservation.nexus_fee_cents, 100); assert.equal(reserve.body.reservation.provider_share_cents, 900);
    const replayed = await call(state, "POST", `/api/grow/workouts/offers/${offer.body.offer.id}/reserve`, {}, state.listenerCookie);
    assert.equal(replayed.status, 409); assert.equal(replayed.body.code, "GROW_RESERVATION_EXISTS");
    const home = await call(state, "GET", "/api/grow/home?vertical=sport", {}, state.listenerCookie);
    assert.equal(home.body.content[0].id, content.body.content.id); assert.equal(home.body.health_targeting, false);
  } finally { state.db.close(); }
});

test("M11 Grow keeps course progress and encrypted journals account-private", async () => {
  const state = fixture();
  try {
    const free = await call(state, "POST", "/api/grow/courses", { title: "Food literacy", description: "General education", price_cents: 0, not_accredited_confirmed: true }, state.artistCookie);
    const paid = await call(state, "POST", "/api/grow/courses", { title: "Coach library", description: "Paid local preview", price_cents: 1200, not_accredited_confirmed: true }, state.artistCookie);
    const enrolledFree = await call(state, "POST", `/api/grow/courses/${free.body.course.id}/enroll`, {}, state.listenerCookie);
    const enrolledPaid = await call(state, "POST", `/api/grow/courses/${paid.body.course.id}/enroll`, {}, state.listenerCookie);
    assert.equal(enrolledFree.body.enrollment.status, "active"); assert.equal(enrolledPaid.body.enrollment.status, "local_enrolled_no_payment");
    const progress = await call(state, "PUT", `/api/grow/courses/${free.body.course.id}/progress`, { progress_percent: 65 }, state.listenerCookie);
    assert.equal(progress.body.enrollment.progress_percent, 65); assert.equal(progress.body.private_progress, true);
    const deniedProgress = await call(state, "PUT", `/api/grow/courses/${paid.body.course.id}/progress`, { progress_percent: 10 }, state.listenerCookie);
    assert.equal(deniedProgress.status, 409); assert.equal(deniedProgress.body.code, "GROW_ENROLLMENT_NOT_ACTIVE");

    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    const privateEntry = await call(state, "POST", "/api/grow/private", { vertical: "nutrition", kind: "journal", ciphertext: "A".repeat(48), nonce: "B".repeat(24), expires_at: expiresAt }, state.listenerDatingCookie);
    assert.equal(privateEntry.status, 201); assert.equal(privateEntry.body.plaintext_received, false);
    assert.equal("ciphertext" in privateEntry.body.entry, false);
    const mine = await call(state, "GET", "/api/grow/private", {}, state.listenerDatingCookie);
    const other = await call(state, "GET", "/api/grow/private", {}, state.thirdCookie);
    assert.equal(mine.body.entries.length, 1); assert.equal(other.body.entries.length, 0);
    assert.equal(mine.body.reused_for_ads_dating_work_reputation, false);
    const deniedDelete = await call(state, "DELETE", `/api/grow/private/${privateEntry.body.entry.id}`, {}, state.thirdCookie);
    assert.equal(deniedDelete.status, 404);
    const removed = await call(state, "DELETE", `/api/grow/private/${privateEntry.body.entry.id}`, {}, state.listenerDatingCookie);
    assert.equal(removed.body.deleted, true);
  } finally { state.db.close(); }
});

test("M11 SYSTEM_TEST creators exercise local flows without entering organic discovery or royalties", () => {
  const state = fixture();
  try {
    const synthetic = state.repo.createUser({
      handle: "systemtest_m11_creator",
      displayName: "SYSTEM_TEST M11 Creator",
      trafficClass: "SYSTEM_TEST",
    });
    state.repo.ensurePersona(synthetic.id, "social", { visibility: "public" });
    const audio = state.repo.insertMedia({
      hash: "c".repeat(64),
      ext: "mp3",
      mime: "audio/mpeg",
      detectedMime: "audio/mpeg",
      kind: "audio",
      size: 8192,
      uploadedBy: synthetic.id,
      purpose: "music_master",
      actorPersona: "social",
      scanStatus: "ready_local_validation",
      scanReason: "SYSTEM_TEST fixture",
    });
    const artist = state.repo.createMusicArtist({ ownerId: synthetic.id, stageName: "Synthetic Signal" });
    const track = state.repo.createMusicTrack({
      ownerId: synthetic.id,
      artistId: artist.id,
      mediaId: audio.id,
      title: "Synthetic Orbit",
      durationSeconds: 60,
      rightsBasis: "original",
    });
    const published = state.repo.publishMusicTrack({ ownerId: synthetic.id, trackId: track.id });
    assert.equal(published.availability_state, "published_local_demo");
    assert.equal(state.repo.listMusicHome(state.listener.id).tracks.some((entry) => entry.id === track.id), false);

    const grow = state.repo.createGrowContent({
      ownerId: synthetic.id,
      vertical: "sport",
      format: "article",
      title: "Synthetic workout",
      summary: "Local load-test fixture only",
      sourceNote: "SYSTEM_TEST",
      medicalClass: "W0",
    });
    assert.equal(state.repo.listGrowHome(state.listener.id).some((entry) => entry.id === grow.id), false);

    const play = state.repo.recordMusicPlayStart({ userId: state.listener.id, trackId: track.id });
    assert.equal(play.royalty_eligible, false);
    assert.equal(play.fraud_state, "unqualified");
  } finally {
    state.db.close();
  }
});

test("M11 schema fixes rights, TEST-USDC and W0/W1 boundaries", () => {
  const schema = String(SCHEMA);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS music_tracks/);
  assert.match(schema, /rights_basis TEXT NOT NULL CHECK\(rights_basis IN \('original','public_domain','creative_commons','direct_license'\)\)/);
  assert.match(schema, /currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK\(currency = 'TEST-USDC'\)/);
  assert.match(schema, /medical_class TEXT NOT NULL CHECK\(medical_class IN \('W0','W1'\)\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS grow_private_entries/);
});
