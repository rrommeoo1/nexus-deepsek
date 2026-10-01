import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelCameraMarkup } from "../public/reel-camera-surface.js";
import { reelCameraReviewMarkup, setCameraComposerState, startRecordingDial } from "../public/reel-camera-review.js";

const esc = (value) => String(value);
const t = (key) => key;

test("Reel camera exposes only Photo and Video capture modes with bounded tools", () => {
  const markup = reelCameraMarkup({ esc, t, clipMode: true });
  for (const token of ["cameraAddSound", 'data-camera-mode="photo"', 'data-camera-mode="clip"', ">PHOTO<", ">VIDEO<", "cameraTimer", "cameraFlash", "cameraLayout", "cameraBeauty", "cameraFilters", "cameraToolsMore", 'data-camera-layout="grid-four"', 'data-camera-layout="grid-six"', 'data-camera-destination="live"']) {
    assert.match(markup, new RegExp(token));
  }
  assert.doesNotMatch(markup, /<button[^>]+data-camera-duration|>15s<|>60s<|>10m<|>TEXT</);
  assert.doesNotMatch(markup, /cameraSpeed/);
  assert.match(markup, /cameraCountdown/);
  assert.match(markup, /reelCameraCapture[\s\S]*reelCameraGallery[\s\S]*reelCameraModes/);
  assert.doesNotMatch(markup, /reelCameraCapture"><button[^>]+cameraGallery/);
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  assert.match(styles, /reelCamera > video[^}]+height:\s*calc\(100% - 96px\)/);
  assert.match(styles, /reelCamera #cameraGallery[^}]+bottom:\s*max\(17px/);
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
  for (const token of ['data-review-tool="settings"', 'data-review-tool="text"', 'data-review-tool="stickers"', 'data-review-tool="effects"', 'data-review-tool="filters"', 'cameraReviewDraft']) assert.match(markup, new RegExp(token));
  assert.doesNotMatch(markup, /<form/);
  assert.match(source, /createComposerPreviewUrl\(file\)/);
  assert.match(source, /setCameraComposerState\("processing-recording"\)/);
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
  assert.match(start, /getUserMedia\(\{ video: \{ facingMode \}, audio: false \}\)/);
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
