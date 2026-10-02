import test from "node:test";
import assert from "node:assert/strict";
import { classifyBrightness, classifyMotion, reelSoundProfile } from "../public/reel-auto-sound.js";
import { buildJamendoTracksUrl, jamendoProfile, normalizeJamendoTrack, signJamendoSelection, verifyJamendoSelection } from "../lib/jamendo.js";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { CREATOR_VIDEO_MAX_MS, normalizeCreatorStudio } from "../lib/creator-studio.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

function apiRequest(url, cookie) {
  return { method: "GET", url, socket: { remoteAddress: "127.0.0.219" }, headers: { cookie }, on() { return this; }, once() { return this; }, destroy() {} };
}
function apiResponse() {
  return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = String(value); } };
}

test("reel analysis maps motion and brightness to a stable Jamendo profile", () => {
  assert.equal(classifyMotion(2), "static");
  assert.equal(classifyMotion(12), "moderate");
  assert.equal(classifyMotion(28), "dynamic");
  assert.equal(classifyBrightness(60), "dark");
  assert.equal(classifyBrightness(120), "balanced");
  assert.equal(classifyBrightness(210), "bright");
  assert.deepEqual(reelSoundProfile({ motion: "dynamic", brightness: "bright" }), {
    mood: "upbeat", tags: ["energetic", "electronic", "pop", "happy"], speed: "high",
  });
  assert.deepEqual(jamendoProfile({ motion: "static", brightness: "dark" }).tags, ["ambient", "cinematic", "emotional", "chillout"]);
});

test("Jamendo request stays on the free read API and enforces permissive CC filters", () => {
  const { url, segment } = buildJamendoTracksUrl({ clientId: "client123", motion: "dynamic", brightness: "bright", duration: 75 });
  assert.equal(url.origin + url.pathname, "https://api.jamendo.com/v3.0/tracks/");
  assert.equal(url.searchParams.get("client_id"), "client123");
  assert.equal(url.searchParams.get("ccnd"), "false");
  assert.equal(url.searchParams.get("ccnc"), "false");
  assert.equal(url.searchParams.get("ccsa"), "false");
  assert.equal(url.searchParams.get("durationbetween"), "60_900");
  assert.equal(segment, 60);
});

test("the 10 minute camera mode is accepted end to end but remains strictly bounded", () => {
  const base = { version: 1, aspect: "VERTICAL_9_16", filter: "NONE", intensity: 0, trimStartMs: 0, trimEndMs: CREATOR_VIDEO_MAX_MS, playbackRate: 1, muteOriginal: false, overlay: { text: "", position: "BOTTOM", color: "WHITE" } };
  assert.equal(normalizeCreatorStudio(base, { mediaKind: "video" }).trimEndMs, 600_000);
  assert.throws(() => normalizeCreatorStudio({ ...base, trimEndMs: 600_001 }, { mediaKind: "video" }), /TIMELINE_INVALID/);
});

test("only Jamendo HTTPS audio with CC BY is accepted and the selection token is tamper evident", () => {
  const track = normalizeJamendoTrack({
    id: "123", name: "Clear Sky", artist_name: "Ada", duration: 180,
    audio: "https://prod-100.storage.jamendo.com/?trackid=123&format=mp31",
    image: "https://usercontent.jamendo.com?type=album&id=123&width=300",
    shareurl: "https://www.jamendo.com/track/123/clear-sky",
    license_ccurl: "http://creativecommons.org/licenses/by/3.0/",
  }, 30);
  assert.equal(track.license, "CC BY");
  assert.equal(track.license_url, "https://creativecommons.org/licenses/by/3.0/");
  assert.match(track.image_url, /^https:\/\/usercontent\.jamendo\.com/);
  const token = signJamendoSelection(track, "test-secret", 1_000);
  assert.deepEqual(verifyJamendoSelection(token, "test-secret", 2_000), track);
  assert.equal(verifyJamendoSelection(token + "x", "test-secret", 2_000), null);
  assert.equal(normalizeJamendoTrack({ ...track, artist_name: "Ada", audio: "https://evil.example/audio.mp3", license_ccurl: track.license_url }, 30), null);
  assert.equal(normalizeJamendoTrack({ ...track, artist_name: "Ada", audio: track.audio_url, shareurl: track.share_url, license_ccurl: "https://creativecommons.org/licenses/by-nc/4.0/" }, 30), null);
});

test("a Reel persists only the Jamendo reference and keeps it inside the post commitment", () => {
  const db = openDb(":memory:");
  try {
    const repo = createRepo(db);
    const author = repo.createUser({ handle: "sound-author", displayName: "Sound Author" });
    repo.ensurePersona(author.id, "social", { visibility: "public" });
    const media = repo.insertMedia({ hash: "d".repeat(64), ext: "mp4", mime: "video/mp4", detectedMime: "video/mp4", kind: "video", size: 20, uploadedBy: author.id, purpose: "social_post", scanStatus: "ready_local_validation", scanReason: "fixture" });
    const manifest = normalizeCreatorStudio({ version: 1, aspect: "VERTICAL_9_16", filter: "NONE", intensity: 0, trimStartMs: 0, trimEndMs: 30_000, playbackRate: 1, muteOriginal: true, overlay: { text: "", position: "BOTTOM", color: "WHITE" } }, { mediaKind: "video" });
    const externalAudio = { ...normalizeJamendoTrack({ id: "77", name: "Open Air", artist_name: "Mara", duration: 180, audio: "https://prod-100.storage.jamendo.com/?trackid=77&format=mp31", shareurl: "https://www.jamendo.com/track/77/open-air", license_ccurl: "https://creativecommons.org/licenses/by/4.0/" }, 30), preview_offset: 45 };
    const post = repo.createPost({ userId: author.id, persona: "social", kind: "video", caption: "Reel", mediaId: media.id, mediaEdit: manifest, externalAudio });
    assert.deepEqual(post.external_audio, externalAudio);
    assert.equal(post.audio, null);
    assert.equal(db.prepare("SELECT audio_media_id, external_audio_json FROM posts WHERE id = ?").get(post.id).audio_media_id, null);
    assert.throws(() => repo.createPost({ userId: author.id, persona: "social", kind: "text", caption: "No video", externalAudio }), /REQUIRES_VIDEO/);
  } finally { db.close(); }
});

test("authenticated suggestions keep the Jamendo client id server-side and return signed CC tracks", async () => {
  const previous = process.env.JAMENDO_CLIENT_ID;
  process.env.JAMENDO_CLIENT_ID = "free-client-123";
  const db = openDb(":memory:");
  try {
    const repo = createRepo(db);
    const user = repo.createUser({ handle: "sound-listener", displayName: "Sound Listener" });
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    const session = issueSession(user.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
    let calledUrl = "";
    const fetcher = async (url) => {
      calledUrl = String(url);
      return { ok: true, async json() { return { results: [{ id: "88", name: "Bright Run", artist_name: "Lia", duration: 150, audio: "https://prod-100.storage.jamendo.com/?trackid=88&format=mp31", shareurl: "https://www.jamendo.com/track/88/bright-run", license_ccurl: "https://creativecommons.org/licenses/by/4.0/" }] }; } };
    };
    const res = apiResponse();
    await handleRequest(apiRequest("/api/reels/sound-suggestions?motion=dynamic&brightness=bright&duration=30", `nexus_session=${session.token}`), res, { db, repo, sse: {}, fetcher });
    const body = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(body.tracks[0].name, "Bright Run");
    assert.match(body.tracks[0].selection_token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.match(calledUrl, /client_id=free-client-123/);
    assert.doesNotMatch(res.body, /free-client-123/);
    assert.equal(body.tracks[0].download_allowed,false);
    const refreshed=apiResponse();
    await handleRequest(apiRequest('/api/reels/sound-suggestions?track_id=88&duration=30',`nexus_session=${session.token}`),refreshed,{db,repo,sse:{},fetcher});
    assert.equal(JSON.parse(refreshed.body).tracks[0].id,'88');
    assert.equal(new URL(calledUrl).searchParams.get('id'),'88');
    assert.equal(new URL(calledUrl).searchParams.has('fuzzytags'),false);
  } finally {
    db.close();
    if (previous === undefined) delete process.env.JAMENDO_CLIENT_ID; else process.env.JAMENDO_CLIENT_ID = previous;
  }
});
