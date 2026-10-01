import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelCameraMarkup } from "../public/reel-camera-surface.js";

const esc = (value) => String(value);
const t = (key) => key;

test("Reel camera exposes the requested capture modes and bounded tools", () => {
  const markup = reelCameraMarkup({ esc, t, clipMode: true });
  for (const token of ["cameraAddSound", 'data-camera-duration="600"', 'data-camera-duration="60"', 'data-camera-duration="15"', 'data-camera-mode="photo"', 'data-camera-mode="text"', "cameraTimer", "cameraFlash", "cameraLayout", "cameraBeauty", "cameraFilters", "cameraToolsMore", 'data-camera-layout="grid-four"', 'data-camera-layout="grid-six"', 'data-camera-destination="live"']) {
    assert.match(markup, new RegExp(token));
  }
  assert.doesNotMatch(markup, /cameraSpeed/);
  assert.match(markup, /cameraCountdown/);
  assert.match(markup, /reelCameraCapture[\s\S]*reelCameraGallery[\s\S]*reelCameraModes/);
  assert.doesNotMatch(markup, /reelCameraCapture"><button[^>]+cameraGallery/);
  const styles = readFileSync(new URL("../public/reel-camera-surface.css", import.meta.url), "utf8");
  assert.match(styles, /reelCamera > video[^}]+height:\s*calc\(100% - 96px\)/);
  assert.match(styles, /reelCamera #cameraGallery[^}]+bottom:\s*max\(17px/);
  assert.match(styles, /reelCamera\[hidden\][^}]+display:\s*none\s*!important/);
  assert.doesNotMatch(markup, /cameraGalleryRecovery/);
});

test("captured camera media enters a dedicated review surface with retake and continue controls", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const review = readFileSync(new URL("../public/reel-camera-review.js", import.meta.url), "utf8");
  for (const token of ["cameraReviewActions", "retakeCamera", "continueCameraPost", "Settings", "Text", "Stickers", "Effects", "Filters", "startRecordingDial"]) assert.match(review, new RegExp(token));
  assert.match(source, /setCameraReviewMode\(true\)/);
  assert.match(source, /camera\.hidden = false; startComposerCamera/);
  assert.match(source, /startRecordingDial\(camera, recordingProfile\.durationSeconds\)/);
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
