import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelsViewerHeaderMarkup, solidViewerIcon } from "../public/reels-reference.js";

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8");

test("immersive viewer replaces the feed header with one accessible Back action", () => {
  const markup = reelsViewerHeaderMarkup({
    esc: String,
    labels: { back: "Back to feed" },
  });
  assert.match(markup, /class="viewerBack" data-viewer-back/);
  assert.match(markup, /aria-label="Back to feed"/);
  assert.doesNotMatch(markup, /viewerTopTitle|>Post</);
  assert.doesNotMatch(markup, /data-nexus-logo|data-viewer-mode|viewerTune|viewerClose/);
});

test("viewer actions use solid, platform-owned SVG marks", () => {
  for (const icon of ["heart", "comment", "repost", "share", "save", "views", "sound", "mute", "refresh"]) {
    const markup = solidViewerIcon(icon);
    assert.match(markup, /fill="currentColor"/);
    assert.doesNotMatch(markup, /stroke="currentColor"/);
  }
});

test("feed and fullscreen comments keep complete media and one compact server-backed action row", () => {
  const app = read("app.js");
  const css = read("feed-surface.css");
  const row = app.slice(app.indexOf('function renderCommentLine'), app.indexOf('function renderCommentThread'));
  const orderedActions = ["data-reply-to", "data-comment-share", "data-comment-like", "data-comment-save", "commentViews"];
  let cursor = -1;
  for (const action of orderedActions) {
    const next = row.indexOf(action);
    assert.ok(next > cursor, `${action} should appear in the expected action order`);
    cursor = next;
  }
  assert.match(css, /\.clipsScreen\.feed-reels[\s\S]*?object-fit:contain!important/);
  assert.match(css, /body \.mediaViewer\.reelViewer\.media-fit-fill \.viewerStage>video,[\s\S]*?object-fit:contain!important/);
  assert.match(css, /\.commentActions\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(app, /function wireCommentReplies\(scope\)/);
});

test("Reels integration keeps feed actions but swaps global navigation for a comment field", () => {
  const app = read("app.js");
  const css = read("feed-surface.css");
  assert.match(app, /viewerRailAvatar.+data-creator-profile/);
  assert.match(app, /viewerReactionSummaryMarkup\(reactions\)/);
  assert.match(app, /solidViewerIcon\("heart", "viewerReactionHeart"\)/);
  assert.match(app, /data-viewer-back/);
  assert.match(app, /viewerCommentShortcut.+viewer\.addComment/);
  assert.doesNotMatch(app, /reelsViewerBottomNavMarkup|viewerNavItems/);
  assert.match(app, /querySelectorAll\('\[data-reaction-toggle="' \+ postId \+ '\"\],\[data-viewer-reactions="' \+ postId \+ '\"\]'\)\.forEach/);
  assert.match(css, /\.viewerPrimaryReaction \.reactionMetric>b/);
  assert.match(css, /\.viewerCommentShortcut\{[\s\S]*display:flex!important/);
  assert.match(css, /\.viewerActionRail>button>i\.viewerSolidIcon,[\s\S]*background:transparent!important;[\s\S]*backdrop-filter:none!important/);
  assert.match(css, /viewerCommentsOpen \.viewerActionRail/);
});

test("an open comment workspace keeps media taps local instead of opening a second post", () => {
  const app = read("app.js");
  assert.match(app, /if \(stage\?\.classList\.contains\("commentsOpen"\)\) return togglePlayback\(\)/);
  assert.match(app, /if \(article\.classList\.contains\("commentsExpanded"\)\) return/);
  assert.match(app, /event\.key === "Enter" && !stage\?\.classList\.contains\("commentsOpen"\)/);
});
