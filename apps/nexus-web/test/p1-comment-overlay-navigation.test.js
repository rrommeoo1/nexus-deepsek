import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const feedStyles = readFileSync(new URL("../public/feed-surface.css", import.meta.url), "utf8");

test("feed comments are modal, toggle closed, and hide the primary dock", () => {
  assert.match(app, /class="comments clipCommentsDrawer hidden"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(app, /if \(!box\.classList\.contains\("hidden"\)\) return closeCommentsDrawer\(box\)/);
  assert.match(app, /registerCommentOverlay\(box, btn, \(\) => hideCommentsDrawer\(box\)\)/);
  assert.match(app, /nav\.inert = active/);
  assert.match(styles, /\.phoneScreen\.commentsModeActive \.appNav\{display:none!important/);
  assert.match(app, /function commentSurfaceMarkup\(post, \{ closeAttribute = "data-close-comments", loading = false \} = \{\}\)/);
  assert.match(app, /commentsDrawerMarkup\(post\)[\s\S]*?commentSurfaceMarkup\(post\)/);
  assert.doesNotMatch(app, /comments-heading-/);
});

test("comment overlays close with explicit controls, Escape, or mobile browser Back", () => {
  assert.match(app, /history\.pushState\(\{ \.\.\.history\.state, nexusCommentOverlay: token \}, ""\)/);
  assert.match(app, /window\.addEventListener\("popstate", \(\) => \{[\s\S]*?dismissCommentOverlay\(\{ fromHistory: true \}\)/);
  assert.match(app, /if \(event\.key === "Escape" && commentsPanel\) \{\s+dismissCommentOverlay\(\)/);
  assert.match(app, /panel\.querySelector\("\[data-close-viewer-comments\]"\)\.addEventListener\("click", \(\) => dismissCommentOverlay\(\)\)/);
  assert.match(app, /history\.state\?\.nexusCommentOverlay === current\.token\) \{\s+suppressNextUiPopstate = true;\s+history\.back\(\)/);
});

test("closing comments restores focus and fullscreen keeps its back control available", () => {
  assert.match(app, /current\.returnFocus\?\.isConnected/);
  assert.match(app, /current\.returnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /class="comments viewerCommentsPanel" role="region" aria-label=/);
  assert.match(app, /registerCommentOverlay\(panel, returnFocus, closeView\)/);
  assert.match(app, /if \(viewer\.querySelector\("\.viewerCommentsPanel"\)\) dismissCommentOverlay\(\)/);
  assert.match(app, /viewer\.querySelector\("\[data-viewer-back\]"\)\?\.addEventListener\("click", \(\) => \{[\s\S]*?dismissCommentOverlay\(\)/);
});

test("long comments disclose at three lines and can collapse again", () => {
  assert.match(app, /data-comment-expand aria-expanded="false" hidden/);
  assert.match(app, /row\.classList\.toggle\("commentExpanded", expanded\)/);
  assert.match(app, /post\.seeLess/);
  assert.match(feedStyles, /max-height:54px!important;-webkit-line-clamp:3!important/);
  assert.match(feedStyles, /\.commentRow\.commentExpanded \.commentTextBlock>p/);
});

test("feed and fullscreen use one compact headerless conversation surface", () => {
  assert.match(app, /function toggleComments\(btn, postCollection = currentFeedPosts\)/);
  assert.match(app, /article\?\.classList\.contains\("clipCard"\) && article\.querySelector\("\.clipStage"\)/);
  assert.match(app, /openFeedMediaViewer\(Number\(id\), postCollection, \{ openComments: true \}\)/);
  assert.match(app, /if \(options\.openComments === true\)[\s\S]*?void openViewerComments\(postId\)/);
  assert.doesNotMatch(app, /class="viewerCommentMediaSlot"/);
  assert.match(app, /commentSurfaceMarkup\(post, \{ closeAttribute: "data-close-viewer-comments", loading: true \}\)/);
  assert.match(app, /wirePostActions\(panel, mediaViewerState\?\.items \|\| currentFeedPosts\)/);
  assert.match(app, /root\.querySelectorAll\("\[data-comment-form\]"\)\.forEach\(\(f\) => f\.addEventListener\("submit", submitComment\)\)/);
  assert.doesNotMatch(app, /data-viewer-comment-form|viewer-comment-create/);
  assert.match(feedStyles, /\.reelViewer\.viewerCommentsOpen \.viewerTopBar\{display:none!important\}/);
  assert.match(feedStyles, /\.clipCommentsDrawer:not\(\.hidden\),[\s\S]*?\.reelViewer\.viewerCommentsOpen \.viewerCommentsPanel\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\) auto!important/);
  assert.match(feedStyles, /\.reelViewer\.viewerCommentsOpen \.viewerCommentsPanel\{[\s\S]*?position:absolute!important;inset:34dvh 0 0!important/);
  assert.match(feedStyles, /\.commentBack\{[\s\S]*?width:28px!important/);
  assert.match(feedStyles, /\.reelViewer\.viewerCommentsOpen \.commentSurfacePost \.commentPostCreator\{[\s\S]*?padding-inline-start:52px!important/);
  assert.match(feedStyles, /\.reelViewer\.viewerCommentsOpen \.viewerCommentsPanel \.commentRow\{[\s\S]*?border-radius:14px!important/);
  assert.match(feedStyles, /\.reelViewer\.viewerCommentsOpen \.commentComposer\{/);
});

test("reply trees start collapsed and disclose one direct reply at a time", () => {
  assert.match(app, /class="commentRepliesToggle"[^>]+data-comment-replies/);
  assert.match(app, /class="commentReplyChildren" hidden/);
  assert.match(app, /const next = replies\.find\(\(reply\) => reply\.hidden\)/);
  assert.match(app, /comments\.viewReplies/);
  assert.match(app, /comments\.hideReplies/);
  assert.match(feedStyles, /\.commentReplyChildren\[hidden\],\.commentReplyBranch\[hidden\]\{display:none!important\}/);
});

test("comment mode keeps controls quiet and cards compact", () => {
  assert.match(app, /viewerPlay\.hidden = viewer\.classList\.contains\("viewerCommentsOpen"\) \? true : !viewerVideo\?\.paused/);
  assert.match(feedStyles, /\.clipStage\.commentsOpen \.clipPlayState,[\s\S]*?\.reelViewer\.viewerCommentsOpen \.viewerPlayState\{display:none!important\}/);
  assert.match(feedStyles, /\.clipCommentsDrawer>\.clist,[\s\S]*?padding:5px 28px 8px!important/);
  assert.match(feedStyles, /align-content:start!important;grid-auto-rows:max-content!important/);
  assert.match(feedStyles, /\.commentExpandToggle:not\(\[hidden\]\)\{[\s\S]*?position:absolute!important/);
  assert.match(feedStyles, /max-width:480px!important;margin:0 auto 4px!important/);
  assert.match(feedStyles, /grid-template-columns:36px minmax\(0,1fr\)!important;gap:7px!important/);
  assert.match(feedStyles, /width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important/);
  assert.match(feedStyles, /object-fit:cover!important;object-position:center!important;border-radius:50%!important/);
  assert.match(feedStyles, /width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important/);
  assert.match(feedStyles, /body \.reelViewer\.viewerCommentsOpen \.viewerActionRail\{[\s\S]*?opacity:1!important;visibility:visible!important/);
});
