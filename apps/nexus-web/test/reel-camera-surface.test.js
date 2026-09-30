import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelCameraMarkup } from "../public/reel-camera-surface.js";

const esc = (value) => String(value);
const t = (key) => key;

test("Reel camera exposes the requested capture modes and bounded tools", () => {
  const markup = reelCameraMarkup({ esc, t, clipMode: true });
  for (const token of ["cameraAddSound", 'data-camera-duration="600"', 'data-camera-duration="60"', 'data-camera-duration="15"', 'data-camera-mode="photo"', 'data-camera-mode="text"', "cameraTimer", "cameraFlash", "cameraLayout", "cameraBeauty", 'data-camera-destination="live"']) {
    assert.match(markup, new RegExp(token));
  }
  assert.match(markup, /cameraCountdown/);
});

test("sound catalogue keeps discovery, search, trim, favorites and recent on one surface", () => {
  const source = readFileSync(new URL("../public/reel-camera-surface.js", import.meta.url), "utf8");
  for (const token of ["Hot", "For You", "Favorites", "Recent", "reelCatalogueSearch", "reelSoundTrim", "reelSoundFavorite", "preview_offset"]) {
    assert.match(source, new RegExp(token));
  }
});
