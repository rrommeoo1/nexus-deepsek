import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelCameraMarkup } from "../public/reel-camera-surface.js";
import { reelCameraReviewMarkup, setCameraComposerState, startRecordingDial } from "../public/reel-camera-review.js";

const esc = (value) => String(value);
const t = (key) => key;

test("Reel camera exposes only Photo and Video capture modes with bounded tools", () => {
  const markup = reelCameraMarkup({ esc, t, clipMode: true });
  for (const token of ["cameraAddSound", 'data-camera-mode="photo"', 'data-camera-mode="clip"', ">PHOTO<", ">VIDEO<", "cameraTimer", "cameraFlash", "cameraLayout", "cameraBeauty", "cameraFilters", "cameraToolsMore", "cameraLayoutGuide", "finishLayout", 'data-camera-layout="grid-four"', 'data-camera-layout="grid-six"', 'data-camera-destination="live"']) {
    assert.match(markup, new RegExp(token));
  }
  assert.doesNotMatch(markup, /<button[^>]+data-camera-duration|>15s<|>60s<|>10m<|>TEXT</);
  assert.doesNotMatch(markup, /cameraSpeed/);
  assert.match(markup, /cameraCountdown/);
  assert.match(markup, /reelCameraCapture[\s\S]*reelCameraGallery[\s\S]*reelCameraModes/);
  assert.doesNotMatch(markup, /reelCameraCapture"><button[^>]+cameraGallery/);
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  assert.match(styles, /reelCamera > video[^}]+height:\s*100% !important/);
  assert.match(styles, /reelCamera > \.reelCameraLayoutGuide[^}]+inset:0 !important/);
  assert.match(styles, /reelCamera #cameraGallery[^}]+bottom:\s*calc\(max\(12px,env\(safe-area-inset-bottom\)\) \+ 46px\)/);
  assert.match(styles, /reelCamera\[hidden\][^}]+display:\s*none\s*!important/);
  assert.match(styles, /cameraComposer\[data-camera-state\][^\{]+> :not\(form\)[^}]+display:\s*none\s*!important/);
  assert.match(styles, /cameraComposer\[data-camera-state\][^\{]+> form[^}]+position:\s*absolute\s*!important[^}]+height:\s*100%\s*!important/);
  assert.match(styles, /cameraComposer \.reelCamera[^}]+position:\s*absolute\s*!important/);
  assert.match(styles, /reelCamera\.recording :is\([^}]+opacity:\s*0/);
  assert.match(styles, /cameraRecordingElapsed[^}]+bottom:\s*calc\(202px/);
  assert.match(styles, /cameraRecordingElapsed\[hidden\][^}]+display:\s*none\s*!important/);
  assert.match(markup, /finishRecording/);
  assert.doesNotMatch(markup, /cameraGalleryRecovery/);
});

test("the camera opens on the whole picture and a clip keeps that same frame", () => {
  // Owner photos, 2 octombrie 2026: the same room, one in the shipped "fill" default - where `cover` cut about
  // 2,9x out of his phone's wider stream - and one against the native camera, which shows the whole picture.
  // Fit is now the opening framing, and "Umple" stays the deliberate full-bleed crop.
  const markup = reelCameraMarkup({ esc, t });
  assert.match(markup, /id="composerCamera"[^>]+data-camera-fit="fit"/);
  assert.match(markup, /id="cameraFit"[^>]+aria-pressed="true"[\s\S]{0,140}?<small>Umple<\/small>/);
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  // A clip is recorded from the track itself, with no canvas crop, so the preview has to show the whole frame.
  assert.match(styles, /reelCamera\[data-camera-mode="clip"\] > video[^}]+object-fit: contain !important/);
  assert.match(styles, /reelCamera\[data-camera-mode="clip"\] #cameraFit[^}]+display:\s*none\s*!important/);
  // A blurred copy of the same frame stands behind the picture, so "the whole wall is in the shot" and "the
  // camera looks like it fills the screen" stop being a choice, and the sensor note shows the phone's numbers.
  const surface = readFileSync(new URL("../public/reel-camera-surface.js", import.meta.url), "utf8");
  assert.match(markup, /id="composerCameraBackdrop"[^>]+aria-hidden="true"/);
  assert.match(styles, /reelCamera > \.reelCameraBackdrop[^}]+object-fit: cover !important/);
  assert.match(styles, /reelCamera\[data-camera-fit="fill"\] > \.reelCameraBackdrop[^}]+display: none !important/);
  assert.match(styles, /reelCamera\.ready\.cameraNote \.reelCameraStatus[^}]+opacity: 1/);
  assert.match(surface, /export function showCameraSensorNote\(video, camera, seconds = 8\)/);
  // Cache-busting belongs to the release: the stylesheet and the module are asked for under a new version, and
  // the entry file feeds the same stream to the backdrop and puts the sensor note on screen.
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /reel-camera-surface\.css\?v=20261003-whole1/);
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /reel-camera-surface\.js\?v=20261003-whole1/);
  assert.match(app, /showCameraSensorNote\(video, camera\)/);
  assert.match(app, /composerCameraBackdrop"\);[\s\S]{0,90}backdrop\.srcObject = stream/);
});

test("captured camera media enters a dedicated review surface with retake and continue controls", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const review = readFileSync(new URL("../public/reel-camera-review.js", import.meta.url), "utf8");
  for (const token of ["cameraReviewActions", "retakeCamera", "continueCameraPost", "Settings", "Text", "Stickers", "Effects", "Filters", "startRecordingDial"]) assert.match(review, new RegExp(token));
  assert.match(review, /video\.controls = !reviewing/);
  assert.match(review, /video\.loop = reviewing/);
  assert.match(source, /setCameraComposerState\("review"\)/);
  assert.match(source, /restart:\s*\(\)\s*=>[^}]+startComposerCamera\(sourceInput/);
  assert.match(source, /startRecordingDial\(camera, recordingProfile\.durationSeconds\)/);
  assert.match(source, /data-camera-mode="clip"/);
  assert.doesNotMatch(source, /querySelectorAll\("\[data-camera-duration\]"\)/);
  assert.doesNotMatch(source, /recordingProfile\.durationSeconds\}s max/);
  const markup = reelCameraReviewMarkup();
  for (const token of ['data-review-tool="settings"', 'data-review-tool="text"', 'data-review-tool="stickers"', 'data-review-tool="location"', 'data-review-tool="effects"', 'data-review-tool="filters"', 'data-sticker-search', 'data-location-gps', 'data-location-search', 'cameraReviewDraft']) assert.match(markup, new RegExp(token));
  assert.doesNotMatch(markup, /<form/);
  assert.match(source, /createComposerPreviewUrl\(file\)/);
  assert.match(source, /setCameraComposerState\("processing-recording"\)/);
});

test("review editor exposes visual stickers, dynamic tags, direct text styling and a video timeline", () => {
  const markup = reelCameraReviewMarkup();
  for (const token of ["Search GIFs and stickers", "data-functional-sticker=\"mention\"", "data-functional-sticker=\"location\"", "data-functional-sticker=\"live-time\"", "data-functional-sticker=\"digital-clock\"", "data-functional-sticker=\"date\"", "data-text-style=\"neon\"", "data-text-style=\"retro\"", "data-text-color", "data-text-done", "decorationTimeline", "data-decoration-start-range", "data-decoration-end-range", "data-location-style=\"pill-dark\""]) assert.match(markup, new RegExp(token));
  const overlays = readFileSync(new URL("../public/reel-editor-overlays.js", import.meta.url), "utf8");
  for (const token of ["pointerdown", "pointermove", "pointercancel", "setPointerCapture", "decorationTrash", "nexus:edit-decoration", "locationPrecision", "precise_location_stored"]) if (token !== "precise_location_stored") assert.match(overlays, new RegExp(token));
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  assert.match(styles, /cameraStickerPanel[^}]+background:#29292b/);
  assert.match(styles, /cameraTextEditor[^}]+inset:0/);
  assert.match(styles, /cameraStickerGrid[^}]+repeat\(4/);
});

test("recording dial expresses progress around the shutter and elapsed time above it", () => {
  const originalDocument = globalThis.document;
  const values = new Map(); const queued = []; const cancelled = [];
  const dial = { style: { setProperty: (key, value) => values.set(key, value), removeProperty: (key) => values.delete(key) } };
  const elapsed = { hidden: false, textContent: "must stay empty" };
  const classes = new Set();
  globalThis.document = { getElementById: (id) => id === "stopRecording" ? dial : id === "cameraRecordingElapsed" ? elapsed : null };
  try {
    const stop = startRecordingDial({ classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) } }, 15, {
      now: () => 0,
      requestFrame: (callback) => { queued.push(callback); return queued.length; },
      cancelFrame: (id) => cancelled.push(id),
    });
    assert.equal(values.get("--record-progress"), "0deg");
    queued.shift()(7_500);
    assert.equal(values.get("--record-progress"), "180deg");
    assert.equal(elapsed.hidden, false);
    assert.equal(elapsed.textContent, "00:07");
    assert.equal(classes.has("recording"), true);
    stop();
    assert.equal(values.has("--record-progress"), false);
    assert.equal(classes.has("recording"), false);
    assert.deepEqual(cancelled, [1]);
  } finally { globalThis.document = originalDocument; }
});

test("camera state machine refuses invalid jumps and owns camera/review visibility", () => {
  const originalDocument = globalThis.document;
  const rootClasses = new Set();
  const root = { dataset: { cameraState: "camera-loading" }, classList: { toggle: (value, active) => active ? rootClasses.add(value) : rootClasses.delete(value) } };
  const surface = { hidden: true }; const camera = { hidden: false };
  const video = { controls: true, loop: false, muted: false, play: () => Promise.resolve() };
  globalThis.document = {
    querySelector: (selector) => selector === ".cameraComposer" ? root : selector === "#preview video" ? video : null,
    getElementById: (id) => id === "cameraReviewActions" ? surface : id === "composerCamera" ? camera : null,
  };
  try {
    assert.equal(setCameraComposerState("camera-ready"), true);
    assert.equal(setCameraComposerState("recording"), true);
    assert.equal(setCameraComposerState("review"), false);
    assert.equal(root.dataset.cameraState, "recording");
    assert.equal(setCameraComposerState("processing-recording"), true);
    assert.equal(setCameraComposerState("review"), true);
    assert.equal(surface.hidden, false);
    assert.equal(camera.hidden, true);
    assert.equal(rootClasses.has("cameraReview"), true);
    assert.equal(video.loop, true);
    assert.equal(setCameraComposerState("publishing-details"), true);
    assert.equal(rootClasses.has("cameraReview"), false);
    assert.equal(surface.hidden, true);
  } finally { globalThis.document = originalDocument; }
});

test("global Create opens the rear live camera and media import stays explicit", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(source, /slot === "create"[^\n]+openComposer\("post", \{ camera: true, source: "camera" \}\)/);
  assert.match(source, /const selfieFirst = options\.facing === "user"/);
  const start = source.slice(source.indexOf("async function startComposerCamera("), source.indexOf("async function openViewerComments("));
  assert.match(start, /facingMode = "environment"/);
  assert.match(start, /await requestCameraStream\(facingMode, portrait, camera\.clientWidth \/ Math\.max\(1, camera\.clientHeight\)\)/);
  assert.doesNotMatch(start, /\.click\(\)|openNativePicker/);
  assert.match(source, /cameraGallery"\)\?\.addEventListener\("click", openGallery\)/);
});

test("sound catalogue keeps discovery, search, trim, favorites and recent on one surface", () => {
  const source = readFileSync(new URL("../public/reel-camera-surface.js", import.meta.url), "utf8");
  for (const token of ["Hot", "For You", "Favorites", "Recent", "reelCatalogueSearch", "reelSoundTrim", "reelSoundFavorite", "preview_offset"]) {
    assert.match(source, new RegExp(token));
  }
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  assert.match(styles, /reelSoundCatalogue[^}]+height:min\(70dvh,680px\)/);
  assert.match(styles, /reelSoundCatalogueList[^}]+flex:1/);
});
