import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const reelsReference = readFileSync(new URL("../public/reels-reference.js", import.meta.url), "utf8");
const feedSurfaceCss = readFileSync(new URL("../public/feed-surface.css", import.meta.url), "utf8");

test("one fast reaction controller serves feed and fullscreen with both tap and long press", () => {
  assert.match(app, /const REACTION_HOLD_MS = 180/);
  assert.match(app, /const REACTION_HOVER_MS = 110/);
  assert.match(app, /function bindPrimaryReactionControl\(button, palette, root, \{ viewer = false \} = \{\}\)/);
  assert.match(app, /holdTimer = setTimeout\(\(\) => \{\s+suppressPrimaryClick = true;\s+openPalette\(false\);\s+\}, REACTION_HOLD_MS\)/);
  assert.match(app, /hoverTimer = setTimeout\(\(\) => openPalette\(false\), REACTION_HOVER_MS\)/);
  assert.doesNotMatch(app, /const openPalette = \(focusFirst = false\) => \{\s+suppressPrimaryClick = true/);
  assert.match(app, /const primary = selected \|\| palette\.querySelector\('\[data-reaction="LIKE"\]'\)/);
  assert.match(app, /if \(primary\) void toggleReaction\(primary\)/);
});

test("reaction palette has keyboard and context-menu alternatives", () => {
  assert.match(app, /event\.key === "ArrowUp" \|\| event\.key === "ArrowDown"/);
  assert.match(app, /event\.shiftKey && \(event\.key === "Enter" \|\| event\.key === " "\)/);
  assert.match(app, /event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+clearOpenTimers\(\);\s+openPalette\(true\)/);
  assert.match(app, /openPalette\(true\)/);
  assert.match(app, /addEventListener\("contextmenu"/);
});

test("fullscreen reaction control mirrors the feed interaction contract", () => {
  const start = app.indexOf('const viewerReactionButton = viewer.querySelector("[data-viewer-reactions]")');
  const end = app.indexOf("wirePostActions(viewer.querySelector", start);
  const source = app.slice(start, end);
  assert.match(source, /bindPrimaryReactionControl\(viewerReactionButton, viewerReactionTray, viewer, \{ viewer: true \}\)/);
  assert.doesNotMatch(source, /viewerReactionHoldTimer|viewerReactionLongPressed|openViewerReactionTray/);
});

test("compact reaction summary remains identical across feed and fullscreen mutations", () => {
  assert.match(app, /data-reaction-toggle="' \+ post\.id \+ '" data-reaction-display="compact"/);
  assert.match(app, /data-viewer-reactions="' \+ item\.id \+ '" data-reaction-display="compact"/);
  assert.match(app, /button\.dataset\.viewerReactions !== undefined \|\| button\.dataset\.reactionDisplay === "compact"/);
});

test("fullscreen reaction choices accept pointer input above the media", () => {
  assert.match(feedSurfaceCss, /\.reelViewer \.viewerActionRail>\.viewerReactionTray,[\s\S]*?\.viewerReactionTray button\{[\s\S]*?pointer-events:auto!important/);
});

test("the Facebook-style palette is anchored beside the heart in feed and fullscreen", () => {
  assert.match(app, /function positionReactionPalette\(palette, button, \{ viewer = false \} = \{\}\)/);
  assert.match(app, /if \(expanded\) positionReactionPalette\(palette, button, \{ viewer \}\)/);
  assert.match(app, /--reaction-popover-top/);
  assert.match(feedSurfaceCss, /\.reactionBar\.reactionPopoverAnchored,[\s\S]*?grid-template-columns:repeat\(8,minmax\(0,1fr\)\)!important/);
  assert.match(feedSurfaceCss, /right:calc\(100% \+ 6px\)!important/);
  assert.match(feedSurfaceCss, /button small\{display:none!important\}/);
});

test("reaction palettes close predictably after selection, outside tap, and Escape", () => {
  assert.match(app, /!event\.target\.closest\("\[data-reaction-toggle\], \.reactionBar"\)/);
  assert.match(app, /!event\.target\.closest\("\[data-viewer-reactions\], \.viewerReactionTray"\)/);
  assert.match(app, /palette\?\.classList\.remove\("expanded"\)/);
  assert.match(app, /event\.key === "Escape" && reactionTray/);
  assert.match(app, /event\.clientY - dismissStartY < 44/);
});

test("the full media frame is preserved in feed and fullscreen", () => {
  assert.match(app, /SOCIAL_MEDIA_FIT_KEY = "nexus-social-media-fit-v1"/);
  assert.match(app, /data-social-media-fit="fill"/);
  assert.match(app, /data-social-media-fit="fit"/);
  assert.match(app, /media-fit-' \+ esc\(socialMediaFit\)/);
  assert.doesNotMatch(reelsReference, /data-viewer-media-fit=/);
  assert.match(feedSurfaceCss, /\.clipsScreen\.feed-reels \.pulsePosts\.feedReels \.clipStage>\.media,[\s\S]*?object-fit:contain!important/);
  assert.match(feedSurfaceCss, /body \.mediaViewer\.reelViewer\.media-fit-fill \.viewerStage>video,[\s\S]*?object-fit:contain!important/);
});

test("photos and clips are explicit separate feed choices", () => {
  assert.match(app, /\["photos", "▧", t\("feed\.photos"\)/);
  assert.match(app, /feed === "photos".*socialFormat = "posts"/);
  assert.match(app, /feed\.kindClips/);
  assert.match(app, /feed\.kindPosts/);
});
