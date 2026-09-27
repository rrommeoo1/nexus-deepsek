import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/social-human-ux.css", import.meta.url), "utf8");

test("fullscreen comments are an exclusive readable conversation state", () => {
  assert.match(css, /\.reelViewer\.viewerCommentsOpen \.viewerActionRail,[\s\S]*?visibility:hidden!important/);
  assert.match(css, /\.reelViewer\.viewerCommentsOpen \.viewerReactionTray/);
  assert.match(css, /\.reelViewer\.viewerCommentsOpen \.viewerCreatorOverlay/);
  assert.match(css, /\.reelViewer \.viewerCommentsPanel \.c\{[\s\S]*?font-size:15px!important/);
  assert.match(css, /\.reelViewer \.viewerCommentsPanel input\{[\s\S]*?font-size:16px!important/);
  assert.match(css, /\.reelViewer \.viewerCommentsPanel>header b\{font-size:18px!important/);
});

test("opening comments collapses every transient fullscreen menu", () => {
  assert.match(app, /viewer\.querySelector\("\.viewerReactionTray"\)\?\.setAttribute\("hidden", ""\)/);
  assert.match(app, /viewer\.querySelector\("\.viewerActionMenu"\)\?\.setAttribute\("hidden", ""\)/);
  assert.match(app, /viewer\.querySelector\("\.viewerCreatorMenu"\)\?\.setAttribute\("hidden", ""\)/);
});
