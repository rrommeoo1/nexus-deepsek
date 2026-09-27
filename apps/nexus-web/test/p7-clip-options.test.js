// P7 contracts: the clip panel. The rule of this wave is that a switch either does something real on
// the device or the panel says why it cannot — nothing is offered that the build cannot do, and no
// caption is invented for a clip that has no author track.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLIP_PREFERENCES_KEY, CLIP_SPEEDS,
  defaultClipPreferences, normalizeClipPreferences, readClipPreferences, writeClipPreferences,
  humanBytes, clipQualityFacts, captionSourceFor, offlinePolicy, nextClipId,
  clipOptionsMarkup, clipSubtitlesMarkup,
} from "../public/clip-options.js";

const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const media = readFileSync(new URL("../lib/media.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../public/clip-options.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const planning = readFileSync(new URL("../../../planning/NX-SOCIAL-X-SURFACE-v1.md", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    value: (key) => map.get(key),
  };
}

const context = {
  esc: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  t: (key) => key,
  preferences: defaultClipPreferences(),
};

test("clip preferences are validated, remembered and never invent a speed", () => {
  assert.deepEqual(defaultClipPreferences(), { captions: false, autoAdvance: false, dataSaver: false, speed: 1 });
  assert.deepEqual(normalizeClipPreferences(null), defaultClipPreferences());
  assert.deepEqual(normalizeClipPreferences({ captions: "yes", speed: 3, autoAdvance: 1 }), { captions: false, autoAdvance: false, dataSaver: false, speed: 1 });
  assert.deepEqual(normalizeClipPreferences({ captions: true, autoAdvance: true, dataSaver: true, speed: 1.5 }), { captions: true, autoAdvance: true, dataSaver: true, speed: 1.5 });
  assert.deepEqual(CLIP_SPEEDS, [0.75, 1, 1.25, 1.5, 2]);
  const storage = memoryStorage();
  assert.deepEqual(readClipPreferences(storage), defaultClipPreferences());
  assert.deepEqual(writeClipPreferences(storage, { captions: true, speed: 2 }), { captions: true, autoAdvance: false, dataSaver: false, speed: 2 });
  assert.equal(JSON.parse(storage.value(CLIP_PREFERENCES_KEY)).speed, 2);
  // A storage that throws must not break the panel: the reader keeps the defaults and the session.
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.deepEqual(readClipPreferences(broken), defaultClipPreferences());
  assert.deepEqual(writeClipPreferences(broken, { speed: 2 }), { captions: false, autoAdvance: false, dataSaver: false, speed: 2 });
});

test("the panel states real file facts and refuses to invent a quality ladder", () => {
  assert.equal(humanBytes(0), null);
  assert.equal(humanBytes(-5), null);
  assert.equal(humanBytes(512), "512 B");
  assert.equal(humanBytes(2048), "2.0 KB");
  assert.equal(humanBytes(3 * 1024 * 1024), "3.0 MB");
  assert.equal(humanBytes(12 * 1024 * 1024), "12 MB");
  const facts = clipQualityFacts({ kind: "video", mime: "video/mp4", size: 4 * 1024 * 1024 });
  assert.deepEqual(facts, { single_rendition: true, kind: "video", mime: "video/mp4", bytes: 4194304, size_label: "4.0 MB" });
  assert.equal(clipQualityFacts(null).size_label, null);
  const markup = clipOptionsMarkup({ id: 7, media: { kind: "video", mime: "video/mp4", size: 4194304 } }, context);
  assert.match(markup, /data-clip-options="7"/);
  assert.match(markup, /video\/mp4 · 4\.0 MB/);
  assert.match(markup, /x\.clip\.singleRendition/);
  // No rendition list is ever printed, because the database has one object per upload.
  assert.doesNotMatch(markup, /1080|720p|480p/);
});

test("captions come from the author's track, never from a guess about the audio", () => {
  const withTrack = captionSourceFor({ caption: "text", media: { kind: "video", hash: "a".repeat(64), captions: true } });
  assert.equal(withTrack.kind, "track");
  assert.equal(withTrack.url, "/media/" + "a".repeat(64) + ".vtt");
  const fromText = captionSourceFor({ caption: "Textul postării", media: { kind: "video", hash: "b".repeat(64), captions: false } });
  assert.equal(fromText.kind, "text");
  assert.equal(fromText.text, "Textul postării");
  assert.equal(fromText.labelKey, "x.clip.captionsFromText");
  assert.equal(captionSourceFor({ caption: "   ", media: { kind: "video", hash: "c".repeat(64) } }).kind, "none");
  // A flag for a non-video is never trusted.
  assert.equal(captionSourceFor({ caption: "x", media: { kind: "image", captions: true } }).kind, "text");
  const subtitles = clipSubtitlesMarkup({ id: 3, caption: "Salut", media: { kind: "video", hash: "d".repeat(64) } }, context);
  assert.match(subtitles, /data-clip-subtitles="3"/);
  assert.match(subtitles, />Salut</);
  assert.equal(clipSubtitlesMarkup({ id: 3, caption: "", media: { kind: "video", hash: "d".repeat(64) } }, context), "");
});

test("offline is a real download, because the build forbids a response cache for Social media", () => {
  // This is a product decision, not a missing feature: test/p0-offline-private-cache.test.js forbids
  // Cache Storage and service workers around protected Social data, so the panel offers the one
  // honest offline story left — the file itself, downloaded by the reader.
  assert.deepEqual(offlinePolicy(), { mode: "download_only", cache_allowed: false, reasonKey: "x.clip.offlinePolicy" });
  const markup = clipOptionsMarkup({ id: 4, media: { kind: "video" } }, context);
  assert.match(markup, /data-clip-offline-policy="download_only"/);
  assert.match(markup, /x\.clip\.offlinePolicy/);
  assert.match(markup, /data-clip-download="4"/);
  // Nothing in the clip module may open a browser response cache.
  assert.doesNotMatch(panel, /caches\s*\.|CacheStorage|serviceWorker/);
});

test("auto-advance follows the list it was given, and stops at the end", () => {
  const clips = [{ id: 1 }, { id: 2 }, { id: 5 }];
  assert.equal(nextClipId(clips, 1), 2);
  assert.equal(nextClipId(clips, 2), 5);
  assert.equal(nextClipId(clips, 5), null);
  assert.equal(nextClipId(clips, 99), null);
  assert.equal(nextClipId([], 1), null);
  assert.equal(nextClipId(null, 1), null);
  assert.equal(nextClipId([{ id: "2" }], 2), null, "the last clip has no successor");
});

test("the server and the client agree on the clip panel", () => {
  // Server: a caption track is a real sidecar, authorized by the media it belongs to, and the payload
  // says whether one exists instead of guessing.
  assert.match(media, /export function captionTrackAvailability\(hash\) \{/);
  assert.match(media, /export function readCaptionTrack\(hash\) \{/);
  assert.match(media, /if \(!text\.startsWith\("WEBVTT"\)\) return null;/);
  assert.match(api, /if \(method === "GET" && path\.startsWith\("\/media\/"\) && path\.endsWith\("\.vtt"\)\) \{/);
  assert.match(api, /if \(!track \|\| !mediaDeliveryPolicy\(track\) \|\| !repo\.canReadMedia\(track\.id, auth\.user\.id, auth\.persona\)\) return send\(res, 404, "not found"\);/);
  assert.match(api, /"content-type": "text\/vtt; charset=utf-8",/);
  assert.match(api, /function mediaWithCaptions\(media\) \{/);
  assert.match(api, /return \{ \.\.\.media, captions: captionTrackAvailability\(media\.hash\) \};/);
  assert.match(api, /media: mediaWithCaptions\(post\.media\),/);
  assert.match(api, /if \(list\.length \|\| !post\.media\) return list\.map\(\(item\) => mediaWithCaptions\(item\)\);/);
  // Client: captions stay integrated, while the advanced options implementation is retained for future
  // use without mounting a non-functional ellipsis or panel on the compact Reels surface.
  assert.match(app, /import \{ clipSubtitlesMarkup \} from "\.\/clip-options\.js\?v=/);
  assert.doesNotMatch(app, /clipOptionsToggleMarkup\(post/);
  assert.doesNotMatch(app, /bindClipOptions\(root/);
  assert.equal(panel.includes("clipOptionsButton"), false, "the mark does not sit on the clip");
  assert.match(panel, /data-clip-options-toggle="' \+ Number\(post\.id\) \+ '"/);
  assert.doesNotMatch(app, /clipOptionsMarkup\(post/);
  assert.match(app, /function captionTrackMarkup\(post\) \{/);
  assert.match(app, /if \(media\.kind !== "video" \|\| media\.captions !== true \|\| !\/\^\[a-f0-9\]\{64\}\$\/\.test\(String\(media\.hash \|\| ""\)\)\) return "";/);
  // Both video renderings carry the author's track: the plain one and the studio-trimmed one.
  assert.equal((app.match(/captionTrackMarkup\(post\)/g) || []).length >= 3, true, "the track must be attached in both branches");
  assert.match(panel, /export function applyClipPreferences\(root, preferences\) \{/);
  assert.match(panel, /video\.loop = prefs\.autoAdvance !== true;/);
  assert.match(panel, /video\.preload = prefs\.dataSaver === true \? "none" : "metadata";/);
  assert.match(panel, /export function offlinePolicy\(\) \{/);
  assert.match(panel, /return \{ mode: "download_only", cache_allowed: false, reasonKey: "x\.clip\.offlinePolicy" \};/);
  assert.doesNotMatch(panel, /caches\s*\.\s*open|CacheStorage|serviceWorker/);
  assert.match(css, /\.clipOptionsPanel\{position:absolute;left:8px;right:8px;bottom:8px/);
  assert.match(css, /\.clipSubtitles\{position:absolute;left:12px;right:12px;bottom:84px/);
  // The module is loaded with exactly the same asset version as the rest of the shell, whatever the
  // current version string is: the consistency is the contract, not the date.
  const assetVersion = (html.match(/app\.js\?v=([0-9a-z-]+)/) || [])[1];
  assert.equal(typeof assetVersion, "string", "index.html must version app.js");
  assert.match(app, new RegExp("clip-options\\.js\\?v=" + assetVersion));
  // Four languages, the same keys, and the receipt names this wave.
  for (const key of ["x.clip.options", "x.clip.singleRendition", "x.clip.captionsFromText", "x.clip.offlinePolicy", "x.clip.autoAdvanceNote"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.match(planning, /## 8\. Wave 5 \(P7\)/);
  assert.match(planning, /clip-options\.js/);
});
