import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("fullscreen media preserves the explicit sound preference across feed, viewer and return", () => {
  assert.match(app, /const SOCIAL_SOUND_KEY = "nexus-social-muted-v1"/);
  assert.match(app, /localStorage\.setItem\(SOCIAL_SOUND_KEY, String\(Boolean\(muted\)\)\)/);
  assert.match(app, /video\.muted = readSocialMuted\(\)/);
  assert.match(app, /<video src="' \+ esc\(url\) \+ '" autoplay loop playsinline' \+ \(readSocialMuted\(\)/);
  assert.match(app, /writeSocialMuted\(muted\);\s+if \(viewerVideo\) viewerVideo\.muted = muted/);
  assert.match(app, /feedRestore\.video\.muted = readSocialMuted\(\)/);
});

test("fullscreen playback is session-bound and pauses safely while the app is hidden", () => {
  assert.match(app, /mediaViewerSessionGeneration \+= 1/);
  assert.match(app, /if \(!isCurrentSession\(\)\) return document\.removeEventListener\("visibilitychange", handleViewerVisibility\)/);
  assert.match(app, /mediaViewerState\.resumeOnVisible = !video\.paused;\s+video\.pause\(\)/);
  assert.match(app, /mediaViewerState\.resumeOnVisible && !viewer\.querySelector\("\.viewerCommentsPanel"\)/);
  assert.match(app, /event\.key === "ArrowUp"/);
  assert.match(app, /event\.key === "ArrowDown"/);
  assert.match(app, /const decision = decideViewerGesture\(\{ dx, dy \}\)/);
  assert.match(app, /viewer\.addEventListener\("touchstart"/);
  assert.match(app, /viewer\.addEventListener\("touchend"/);
});

test("fullscreen comments suspend gesture navigation without losing the current item", () => {
  assert.match(app, /if \(viewer\.querySelector\("\.viewerCommentsPanel"\) \|\| event\.target\.closest\("button, input, textarea, select, a, \[contenteditable\], \.viewerCommentsPanel"\)\) return/);
  assert.match(app, /else if \(!commentsPanel && !isEditing && event\.key === "ArrowUp"\)/);
  assert.match(app, /else if \(!commentsPanel && !isEditing && event\.key === "ArrowDown"\)/);
  assert.match(app, /if \(viewer\.querySelector\("\.viewerCommentsPanel"\)\) dismissCommentOverlay\(\)/);
  assert.match(app, /viewer\.querySelector\("\.viewerReactionTray"\)\?\.setAttribute\("hidden", ""\)/);
});
