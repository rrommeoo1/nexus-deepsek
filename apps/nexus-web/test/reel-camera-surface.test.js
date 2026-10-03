import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCameraFraming, cameraSurfaceCut, reelCameraMarkup, syncCameraFraming } from "../public/reel-camera-surface.js";
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

test("the camera opens full screen and the whole frame stays one tap away", () => {
  // Owner, 3 octombrie 2026, the fourth time he asked: tapping "+" has to show the camera filling the screen the
  // way the native camera he compares with does. His phone answered a portrait request with a 1920x1080 stream on
  // a 469x860 screen, so the old rule ("a wide stream opens on the whole picture") left 69% of the screen black -
  // measured in .ephemeral/camera-fill-probe.mjs on that same 469x860 surface. Fill is the opening framing now.
  const markup = reelCameraMarkup({ esc, t });
  assert.match(markup, /id="composerCamera"[^>]+data-camera-fit="fill"/);
  assert.match(markup, /id="cameraFit"[^>]+aria-pressed="false"[\s\S]{0,140}?<small>Încadrează<\/small>/);
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  // A clip is framed like a photo: the preview fills the screen, the take is recorded from that same framed
  // centre, and the framing button works in both modes.
  assert.doesNotMatch(styles, /reelCamera\[data-camera-mode="clip"\] > video/);
  assert.doesNotMatch(styles, /reelCamera\[data-camera-mode="clip"\] #cameraFit/);
  // A blurred copy of the same frame stands behind the picture, so the whole frame is never black bands, and the
  // sensor note reports what the phone handed back next to what was asked of it.
  const surface = readFileSync(new URL("../public/reel-camera-surface.js", import.meta.url), "utf8");
  assert.match(markup, /id="composerCameraBackdrop"[^>]+autoplay muted playsinline[^>]+aria-hidden="true"/);
  assert.match(styles, /reelCamera > \.reelCameraBackdrop[^}]+object-fit: cover !important/);
  assert.match(styles, /reelCamera\[data-camera-fit="fill"\] > \.reelCameraBackdrop[^}]+display: none !important/);
  assert.match(styles, /reelCamera\.ready\.cameraNote \.reelCameraStatus[^}]+opacity: 1/);
  assert.match(surface, /export function showCameraSensorNote\(video, camera, seconds = 8\)/);
  assert.match(surface, /" · cerut " \+ camera\.dataset\.cameraRequest/);
  // Cache-busting belongs to the release: the stylesheet and the module are asked for under a new version, and
  // the entry file feeds the same stream to the backdrop, plays it and puts the sensor note on screen.
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /reel-camera-surface\.css\?v=20261003-fill1/);
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /reel-camera-surface\.js\?v=20261003-fill1/);
  assert.match(app, /showCameraSensorNote\(video, camera\)/);
  assert.match(app, /composerCameraBackdrop"\)[\s\S]{0,120}backdrop\.play\?\.\(\)\.catch/);
  assert.match(app, /syncCameraFraming\(video, camera\)/);
});

test("the framing fills the screen whatever the phone hands back, and the tap wins", () => {
  // The opening framing is the owner's call, not the phone's: a 0,55 screen filled from a 1,78 stream costs a
  // 3,24x cut and from a 0,56 stream about 1% (`cameraSurfaceCut` is the number the note prints), but both open
  // filled. "Încadrează" is the deliberate whole-frame view for the rest of the session.
  const makeCamera = (width, height) => {
    const label = { textContent: "" };
    const button = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, querySelector: () => label };
    return { node: { clientWidth: width, clientHeight: height, dataset: {}, querySelector: () => button }, button, label };
  };
  const makeVideo = (videoWidth, videoHeight) => {
    const listeners = {};
    return { videoWidth, videoHeight, addEventListener(name, fn) { listeners[name] = fn; }, fire: (name) => listeners[name]?.() };
  };
  const portrait = makeCamera(469, 860);
  syncCameraFraming(makeVideo(1080, 1920), portrait.node);
  assert.equal(portrait.node.dataset.cameraFit, "fill", "a portrait stream fills the screen with a 1,03x cut");
  assert.equal(portrait.button.attrs["aria-pressed"], "false");
  assert.equal(portrait.label.textContent, "Încadrează");
  const wide = makeCamera(469, 860);
  syncCameraFraming(makeVideo(1920, 1080), wide.node);
  assert.equal(wide.node.dataset.cameraFit, "fill", "the owner's 1,78 stream fills the screen too - no black bands");
  assert.equal(wide.button.attrs["aria-pressed"], "false");
  assert.equal(wide.label.textContent, "Încadrează");
  // The stream size is known only after metadata, so the surface is framed once the frame is really there.
  const late = makeCamera(469, 860);
  const stream = makeVideo(0, 0);
  syncCameraFraming(stream, late.node);
  assert.equal(late.node.dataset.cameraFit, undefined);
  stream.videoWidth = 1920; stream.videoHeight = 1080;
  stream.fire("loadedmetadata");
  assert.equal(late.node.dataset.cameraFit, "fill");
  applyCameraFraming(wide.node, true);
  assert.equal(wide.node.dataset.cameraFit, "fit");
  assert.equal(wide.label.textContent, "Umple");
  applyCameraFraming(wide.node, false);
  assert.equal(wide.node.dataset.cameraFit, "fill");
});

test("the sensor note reports the cut a screen shape costs the frame it was given", () => {
  // The numbers the owner reads off his own phone: 1,03 for the portrait stream a native camera hands over, 3,26
  // for the 1920x1080 his phone answered a 1080x1440 request with, and 2,44 for a 4:3 sensor on the same screen.
  assert.equal(cameraSurfaceCut(1080 / 1920, 469 / 860), 1.03);
  assert.equal(cameraSurfaceCut(1920 / 1080, 469 / 860), 3.26);
  assert.equal(cameraSurfaceCut(1440 / 1080, 469 / 860), 2.44);
  assert.equal(cameraSurfaceCut(1920 / 1080, 16 / 9), 1);
  assert.equal(cameraSurfaceCut(0, 0), 0);
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
  assert.match(start, /await requestCameraStream\(facingMode, portrait\)/);
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
