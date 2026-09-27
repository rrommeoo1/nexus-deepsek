// X-surface contracts (post page, real view counters, mute, community-note requests).
//
// Two rules are pinned here because they are the ones a product can quietly break:
//  1. a public counter describes real people only, so catalog or synthetic traffic can never
//     inflate it and one device refreshing never makes it grow;
//  2. an account-level action (mute, block, note request) never changes what the author sees
//     of their own content, and never publishes anything by itself.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { createPostDetailSurface, postDetailMarkup } from "../public/post-detail.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const repo = readFileSync(new URL("../lib/repo.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../public/post-detail.js", import.meta.url), "utf8");
const detailCss = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const profileJs = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");
// Wave 6e: the settings journeys are a module of their own, so the row that carries the sign-out is
// read from there and the binding that uses it stays in app.js.
const profilePanels = readFileSync(new URL("../public/profile-settings-panels.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.x", displayName: "Owner X" });
  const reader = repo.createUser({ handle: "reader.x", displayName: "Reader X" });
  const catalog = repo.createUser({ handle: "catalog.x", displayName: "Catalog X", trafficClass: "SEEDED_CATALOG" });
  for (const user of [owner, reader, catalog]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  const post = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Un tweet cu text", visibility: "public" });
  return { db, repo, owner, reader, catalog, post };
}

test("a view counter counts distinct human readers and refuses catalog traffic", () => {
  const { db, repo, reader, catalog, post } = fixture();
  try {
    assert.deepEqual(repo.postViewStats(post.id), { viewers: 0, impressions: 0, completed: 0 });
    repo.recordSocialImpressions(reader.id, "social", [{ post_id: post.id, dwell_ms: 400 }]);
    repo.recordSocialImpressions(catalog.id, "social", [{ post_id: post.id, dwell_ms: 900 }]);
    const organic = repo.postViewStats(post.id);
    assert.equal(organic.viewers, 1, "catalog viewers must not be counted");
    assert.equal(organic.impressions, 1);
    // The same reader opening the post again is a new impression, never a new viewer.
    repo.recordSocialImpressions(reader.id, "social", [{ post_id: post.id, dwell_ms: 0 }]);
    const repeated = repo.postViewStats(post.id);
    assert.equal(repeated.viewers, 1);
    assert.equal(repeated.impressions, 2);
    const bulk = repo.postViewStatsBulk([post.id, 999]);
    assert.equal(bulk.get(post.id).viewers, 1);
    assert.deepEqual(bulk.get(999), { viewers: 0, impressions: 0, completed: 0 });
  } finally { db.close(); }
});

test("mute removes an author from the viewer's candidates without touching the graph", () => {
  const { db, repo, owner, reader, post } = fixture();
  try {
    const visible = () => repo.listSocialFeed(reader.id, { lens: "for-you", format: "all", limit: 50 })
      .some((item) => Number(item.id) === Number(post.id));
    assert.equal(visible(), true);
    assert.equal(repo.isMuted(reader.id, "social", owner.id), false);
    assert.deepEqual(repo.setProfileMute(reader.id, "social", owner.id, true), { muted: true, scope: "account", topic: "" });
    assert.equal(visible(), false, "a muted author must not reach the candidates");
    // Mute is not block: the relationship stays as it was, and the author keeps their post.
    assert.equal(repo.isAccountBlockedBetween(reader.id, owner.id), false);
    assert.ok(repo.listSocialFeed(owner.id, { lens: "for-you", format: "all", limit: 50 })
      .some((item) => Number(item.id) === Number(post.id)));
    repo.setProfileMute(reader.id, "social", owner.id, false);
    assert.equal(visible(), true);
    // Nobody mutes themselves, and a topic mute needs a real topic.
    assert.equal(repo.isMuted(reader.id, "social", reader.id), false);
    assert.equal(repo.setProfileMute(reader.id, "social", owner.id, true, { scope: "topic", topic: "" }), null);
  } finally { db.close(); }
});

test("a community-note request is recorded once per reader and changes nothing", () => {
  const { db, repo, owner, reader, post } = fixture();
  try {
    const first = repo.requestCommunityNote({ subjectType: "post", subjectId: post.id, requesterId: reader.id });
    assert.equal(first.requests, 1);
    assert.equal(first.requested_by_me, true);
    assert.equal(first.status, "QUEUED");
    assert.equal(first.notes_published, 0);
    const again = repo.requestCommunityNote({ subjectType: "post", subjectId: post.id, requesterId: reader.id, reason: "context lipsă" });
    assert.equal(again.requests, 1, "a second request from the same reader is not a second request");
    assert.equal(repo.requestCommunityNote({ subjectType: "post", subjectId: post.id, requesterId: owner.id }).requests, 2);
    // A queue entry is not a takedown: the post is untouched and still readable.
    assert.equal(repo.getPostById(post.id).status, "active");
    assert.equal(repo.canViewPost(reader.id, "social", repo.getPostById(post.id)), true);
    assert.equal(repo.communityNoteRequestState("post", post.id, owner.id).requested_by_me, true);
    assert.equal(repo.communityNoteRequestState("post", post.id).requested_by_me, false);
    assert.equal(repo.requestCommunityNote({ subjectType: "profile", subjectId: post.id, requesterId: reader.id }), null);
  } finally { db.close(); }
});

test("replies keep their own counters: impressions, views and private saving", () => {
  const { db, repo, owner, reader, catalog, post } = fixture();
  try {
    const comment = repo.addSocialComment({ userId: owner.id, actorPersona: "social", postId: post.id, body: "Primul răspuns" });
    repo.recordCommentImpressions(reader.id, "social", [{ comment_id: comment.id, dwell_ms: 250 }]);
    repo.recordCommentImpressions(catalog.id, "social", [{ comment_id: comment.id, dwell_ms: 250 }]);
    repo.recordCommentImpressions(reader.id, "social", [{ comment_id: comment.id, dwell_ms: 0 }]);
    const stats = repo.commentViewStatsBulk([comment.id]).get(Number(comment.id));
    assert.equal(stats.viewers, 1);
    assert.equal(stats.impressions, 2);
    assert.equal(repo.recordCommentImpressions(reader.id, "social", []), null);
    assert.equal(repo.recordCommentImpressions(reader.id, "social", [{ comment_id: comment.id }, { comment_id: comment.id }]), null);
    assert.equal(repo.setSavedComment(reader.id, "social", comment.id, true), true);
    assert.equal(repo.hasSavedComment(reader.id, "social", comment.id), true);
    assert.equal(repo.hasSavedComment(owner.id, "social", comment.id), false);
    assert.equal(repo.setSavedComment(reader.id, "social", comment.id, false), false);
  } finally { db.close(); }
});

test("the post page exists as its own module and shares the card primitives", () => {
  assert.match(markup, /export function postDetailReplyMarkup\(comment, context, depth = 0\)/);
  assert.match(markup, /export function postDetailMarkup\(result, options, context\)/);
  assert.match(markup, /export function createPostDetailSurface\(context\)/);
  // Replies are read as tweets: the same counters and the same ••• menu.
  assert.match(markup, /data-comment-like="/);
  assert.match(markup, /data-comment-save="/);
  assert.match(markup, /data-reply-to="/);
  assert.match(markup, /menuMarkup\(\{ id: Number\(comment\.post_id\)/);
  assert.match(markup, /data-detail-sort="' \+ id/);
  assert.match(markup, /data-detail-more-replies="/);
  assert.match(markup, /postDetailScroll/);
  assert.match(detailCss, /\.postDetailLayer\{position:absolute;inset:0/);
  assert.match(detailCss, /\.postDetailText\{margin:12px 0 0;font-size:20px/);
  assert.equal((index.match(/post-detail\.css\?v=/g) || []).length, 1);
});

test("the timeline opens the post page and offers the full action menu", () => {
  assert.match(app, /import \{ createPostDetailSurface \} from "\.\/post-detail\.js\?v=/);
  assert.match(app, /data-post-open="' \+ post\.id \+ '"/);
  assert.match(app, /root\.querySelectorAll\("\[data-post-open\]"\)/);
  assert.match(app, /function postOptionsMenuMarkup\(post, \{ owner = false, commentId = null, muted = false, blocked = false \} = \{\}\)/);
  for (const action of ["data-follow", "data-favorite", "data-mute", "data-block", "data-not-interested", "data-copy-link", "data-report", "data-report-illegal", "data-note-request", "data-why"]) {
    assert.ok(app.includes(action), `the ••• menu must offer ${action}`);
  }
  // Report and "not interested" left the card row, so the row keeps only real actions.
  assert.doesNotMatch(app, /<button data-report="' \+ post\.id \+ '">' \+ esc\(t\("post\.report"\)\)/);
  assert.match(app, /function openDeepLinkedPost\(\)/);
  assert.match(app, /openPostDetail\(id, \{ directHash: true \}\)/);
  assert.match(markup, /if \(!directHash\) context\.registerOverlay/);
  assert.match(app, /history\.replaceState\(history\.state, "", "#post-" \+ id\)/);
  assert.match(app, /async function toggleAuthorMute\(button\)/);
  assert.match(app, /async function toggleAuthorBlock\(button\)/);
  assert.match(app, /async function requestCommunityNote\(button\)/);
  assert.match(app, /async function toggleCommentLike\(button\)/);
  assert.match(app, /async function toggleCommentSave\(button\)/);
  // Profile whispers are cards too, so they open the same post page - and the card is the item the Flow mixes
  // with the media, which is why it says so on itself.
  assert.match(profileJs, /ownerWhisperCard" data-owner-post-item="' \+ id \+ '" data-profile-post="' \+ id \+ '" data-profile-kind="text" data-post-id="' \+ id \+ '"/);
});

test("opening a post is a real view and replies travel with the same measurement", () => {
  assert.match(app, /function queueCommentImpressions\(commentIds\)/);
  assert.match(app, /const socialCommentImpressionQueue = new Map\(\);/);
  assert.match(app, /body: \{ entries, comment_entries: commentEntries \}/);
  assert.match(app, /recordImpressions: \(result\) => \{/);
  assert.match(app, /queueSocialImpression\(result\.post\.id, 1500, true\)/);
  assert.match(markup, /context\.recordImpressions\?\.\(merged\)/);
  assert.match(api, /const commentResult = requestedComments\.length \? repo\.recordCommentImpressions/);
  assert.match(api, /const requestedPosts = Array\.isArray\(body\.entries\)/);
});

test("one refresh gesture, one logout, and no app header on the profile screen", () => {
  assert.match(app, /function bindGlobalPullRefresh\(viewport\)/);
  assert.match(app, /bindGlobalPullRefresh\(document\.getElementById\("screenViewport"\)\)/);
  assert.match(app, /hint\.textContent = t\("feed\.pullRefresh"\)/);
  assert.equal((app.match(/profile-header-refresh/g) || []).length, 0);
  // The profile screen lost its app header entirely: no wordmark, no title, no Log out beside them. The
  // sign-out is a row in Access and security, next to the sessions it ends.
  assert.equal((app.match(/profile-header-logout|profileHeaderTitle|profileAppHeader/g) || []).length, 0);
  assert.match(app, /if \(activeSlot === "account"\) \{\n    \/\/ The profile screen has no app header/);
  assert.match(profilePanels, /id="profile-settings-logout"/);
  assert.match(app, /document\.getElementById\("profile-settings-logout"\)\?\.addEventListener\("click", \(\) => \{ void logoutFromProfile\(\); \}\)/);
  assert.match(detailCss, /\.nexusPullHint\{position:sticky/);
  assert.equal((locale.match(/"x\.profile\.logout":/g) || []).length, 4);
  // The sign-out dialog was Romanian whichever language the app was in; it speaks the interface language
  // now, and the copy for it exists in all four.
  assert.match(app, /dialog\.innerHTML = '<form method="dialog"><h2>' \+ esc\(t\("x\.profile\.logout"\)\)/);
  assert.match(app, /dialog\.querySelector\("\[data-logout-status\]"\)\.textContent = t\("profile\.logoutPending"\)/);
  for (const key of ["profile.logoutDetail", "profile.logoutConfirm", "profile.logoutPending", "profile.logoutFailed"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
});

test("counters stay small and a zero counter is never rendered", () => {
  assert.match(app, /function postViewsCount\(post\)/);
  assert.match(app, /if \(!count\) return '';/);
  assert.match(app, /'<span class="postViews' \+ \(compact \? ' compact' : ''\)/);
  assert.match(detailCss, /\.xPalette button span\{font-size:20px/);
  assert.match(detailCss, /\.xPalette button small\{display:none\}/);
  // The clip palette keeps its own grid overlay with its labels.
  assert.match(detailCss, /\.post\.clipPost>\.reactionBar button small\{display:block\}/);
});

test("the profile shows albums instead of a new-story tile and stays chronological", () => {
  assert.doesNotMatch(profileJs, /data-owner-create-moment/);
  assert.match(profileJs, /data-profile-album="' \+ index \+ '"/);
  assert.match(profileJs, /onAvatarPhoto\?\.\(avatar, name\)/);
  assert.match(profileJs, /if \(stories\.length\) return onStory\?\.\(0, stories\)/);
  assert.match(profileJs, /\.sort\(\(a, b\) => at\(b\) - at\(a\) \|\| Number\(b\?\.id \|\| 0\) - Number\(a\?\.id \|\| 0\)\)/);
  assert.match(app, /function openProfilePhoto\(url, name = ""\)/);
  assert.match(app, /albums: Array\.isArray\(result\.profile\?\.highlights\) \? result\.profile\.highlights : \[\]/);
  assert.match(api, /const highlights = requestedPersona === "social"/);
  assert.equal((locale.match(/"x\.profile\.albums":/g) || []).length, 4);
});

test("the server routes behind the post page exist and validate their input", () => {
  assert.match(api, /if \(method === "GET" && path\.match\(\/\^\\\/api\\\/posts\\\/\\d\+\$\/\)\)/);
  assert.match(api, /if \(!new Set\(\["relevant", "newest", "oldest"\]\)\.has\(sort\)\) return json\(res, 400, \{ ok: false, error: "reply sort invalid" \}\)/);
  assert.match(api, /if \(method === "POST" && path === "\/api\/profile\/mute"\)/);
  assert.match(api, /if \(method === "POST" && path\.match\(\/\^\\\/api\\\/comments\\\/\\d\+\\\/save\$\/\)\)/);
  assert.match(api, /commentNoteRequestMatch/);
  assert.match(api, /muted_by_me: repo\.isMuted\(auth\.user\.id, auth\.persona, post\.user_id\)/);
  assert.match(api, /view_stats: repo\.postViewStats\(post\.id\)/);
  // The demo-receipt mapper used to call an undefined name, so that route could only answer 500.
  assert.match(api, /function publicPost\(repo, post, auth\) \{\r?\n  return socialPostView\(repo, auth, post\);\r?\n\}/);
  assert.match(api, /"ILLEGAL_CONTENT"|REPORT_CATEGORIES/);
});

test("the post page tells the caller when it opens and when it closes", () => {
  // The address bar is the caller's business, so the surface reports both edges: the hash is
  // written after the overlay entry exists and cleared as soon as the page is gone.
  const registerIndex = markup.indexOf("context.registerOverlay?.(surface.layer");
  const hashIndex = markup.indexOf("context.afterOverlayRegistered?.(id)");
  assert.ok(registerIndex > 0, "the overlay must be registered");
  assert.ok(hashIndex > registerIndex, "the hash is written after the overlay entry is pushed");
  assert.match(markup, /context\.afterClose\?\.\(closedId\)/);
  const appRegister = app.indexOf("afterOverlayRegistered: (id) => {");
  const appClose = app.indexOf("afterClose: (id) => {");
  assert.ok(appRegister > 0 && appClose > appRegister);

  const calls = [];
  let mounted = true;
  const layer = { id: "postDetail", isConnected: true, remove: () => { mounted = false; calls.push("removed"); } };
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => (id === "postDetail" && mounted ? layer : null) };
  try {
    const surface = createPostDetailSurface({
      esc: (value) => String(value ?? ""), api: async () => null, toast: () => {},
      state: { user: { id: 1 }, persona: "social" }, t: (key) => key,
      safeUrl: () => "", menuMarkup: () => "", postViewsMarkup: () => "", postViewsCount: () => 0,
      reactionPaletteMarkup: () => "", reactionSummaryMarkup: () => "", followButtonLabel: () => "",
      relativeStamp: () => "", sharingEnabled: true, wirePostActions: () => {}, newMutationKey: () => "key",
      toggleCommentLike: () => {}, toggleCommentSave: () => {}, recordImpressions: () => {},
      registerOverlay: () => calls.push("register"),
      dismissOverlay: (element, fromHistory) => { calls.push(`dismiss:${fromHistory}:${element === layer}`); return false; },
      afterClose: (id) => calls.push(`hash-cleared:${id === null ? "none" : id}`),
    });
    assert.equal(surface.close(), true);
    assert.deepEqual(calls, ["dismiss:false:true", "removed", "hash-cleared:none"]);
    // Closing twice is safe and reports that there was nothing to close.
    assert.equal(surface.close(), false);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("a repost is an internal share: it lives on a profile and keeps the original post", () => {
  const { db, repo: store, owner, reader, post } = fixture();
  try {
    store.setFollow(reader.id, owner.id, "social", true);
    assert.deepEqual(store.listUserReposts(owner.id, "social", { viewerId: reader.id }), []);
    assert.equal(store.listFollowedReposts(reader.id, {}).length, 0);
    store.setPostRepost(owner.id, "social", post.id, true);
    const ownProfile = store.listUserReposts(owner.id, "social", { viewerId: owner.id });
    assert.equal(ownProfile.length, 1);
    assert.equal(Number(ownProfile[0].post.id), Number(post.id));
    assert.ok(ownProfile[0].reposted_at > 0);
    // The shared post keeps its own identity and author: nothing is copied or moderated twice.
    assert.equal(Number(ownProfile[0].post.user_id), Number(owner.id));
    // Undo removes the share everywhere and the counter follows.
    store.setPostRepost(owner.id, "social", post.id, false);
    assert.deepEqual(store.listUserReposts(owner.id, "social", { viewerId: owner.id }), []);
    assert.equal(store.listFollowedReposts(reader.id, {}).length, 0);
    assert.equal(store.postRepostSummary(post.id, owner.id, "social").reposts, 0);
  } finally { db.close(); }
});

test("a repost of someone else's post is a feed candidate, exactly once", () => {
  const { db, repo: store, owner, reader } = fixture();
  try {
    store.setFollow(reader.id, owner.id, "social", true);
    const other = store.createUser({ handle: "other.x", displayName: "Other X" });
    store.ensurePersona(other.id, "social", { visibility: "public" });
    const otherPost = store.createPost({ userId: other.id, persona: "social", kind: "text", caption: "O postare de la altcineva", visibility: "public" });
    // The Following lens carries the accounts the reader follows, so this post can arrive only
    // through a repost made by one of them.
    const following = { lens: "for-you", format: "following", limit: 50 };
    const before = store.listSocialFeed(reader.id, following);
    assert.equal(before.some((item) => Number(item.id) === Number(otherPost.id)), false);
    store.setPostRepost(owner.id, "social", otherPost.id, true);
    const after = store.listSocialFeed(reader.id, following);
    const shared = after.filter((item) => Number(item.id) === Number(otherPost.id));
    assert.equal(shared.length, 1, "a repost is one candidate, never two");
    assert.equal(shared[0].repost.reposter.handle, owner.handle);
    assert.ok(Number(shared[0].repost.reposted_at) > 0);
    // A repost is labelled as a share, and it is demoted: the reason vocabulary says both.
    assert.match(shared[0].ranking.reasons.join(" "), /repost_shared/);
    // A repost never invents a view, and the feed stays deterministic.
    assert.deepEqual(store.postViewStats(otherPost.id), { viewers: 0, impressions: 0, completed: 0 });
    const again = store.listSocialFeed(reader.id, following);
    assert.deepEqual(again.map((item) => item.id), after.map((item) => item.id));
    // Following the author as well does not duplicate the post: its own entry wins.
    store.setFollow(reader.id, other.id, "social", true);
    const dual = store.listSocialFeed(reader.id, following);
    assert.equal(dual.filter((item) => Number(item.id) === Number(otherPost.id)).length, 1);
    // Muting the reposter hides their share.
    store.setProfileMute(reader.id, "social", owner.id, true);
    const muted = store.listSocialFeed(reader.id, following);
    assert.equal(muted.some((item) => item.repost && item.repost.reposter.id === owner.id), false);
  } finally { db.close(); }
});

test("replies are rendered as a staircase whose depth stops growing", () => {
  const context = {
    esc: (value) => String(value ?? ""), t: (key) => key, state: { user: { id: 19 }, persona: "social" },
    safeUrl: () => "", menuMarkup: () => "", postViewsMarkup: () => "", postViewsCount: () => 0,
    reactionPaletteMarkup: () => "", reactionSummaryMarkup: () => "", followButtonLabel: () => "",
    relativeStamp: () => "acum", sharingEnabled: true, formatTime: null,
  };
  const context2 = { ...context, postViewsMarkup: () => "", postViewsCount: () => 0 };
  const comment = (id, parentId = null) => ({
    id, post_id: 9, parent_id: parentId, user_id: 5 + id, handle: "u" + id, display_name: "U" + id,
    body: "raspuns " + id, status: "active", created_at: 1000 + id, created_commitment: "x",
    reactions: { counts: {}, viewer_reaction: null }, views: 0, saved_by_me: false,
  });
  const comments = [comment(1), comment(2, 1), comment(3, 2), comment(4, 3), comment(5), comment(6, 5)];
  const html = postDetailMarkup({
    ok: true, post_id: 9, next_cursor: null, comments,
    post: { id: 9, user_id: 5, caption: "postare", created_at: 900, reactions: { counts: {} }, author: { handle: "u5" } },
  }, { sort: "relevant" }, context2);
  const depths = [...html.matchAll(/data-reply-id="(\d+)" data-depth="(\d+)"/g)].map((match) => match[1] + ":" + match[2]);
  // Depth follows the parent chain, not the order of the list: 1 -> 2 -> 3 -> 4 climb, 5 starts again.
  assert.deepEqual(depths, ["1:0", "2:1", "3:2", "4:3", "5:0", "6:1"]);
  assert.match(html, /data-reply-id="3" data-depth="2" style="--depth:2"/);
  assert.match(html, /class="detailReply" data-reply-id="4"/);
  // A very deep thread stops indenting instead of running off a phone screen.
  const deep = [comment(11)];
  for (let level = 12; level <= 17; level += 1) deep.push(comment(level, level - 1));
  const deepHtml = postDetailMarkup({
    ok: true, post_id: 9, next_cursor: null, comments: deep,
    post: { id: 9, user_id: 5, caption: "postare", created_at: 900, reactions: { counts: {} }, author: { handle: "u5" } },
  }, {}, context2);
  const lastDepth = Number([...deepHtml.matchAll(/data-reply-id="17" data-depth="(\d+)"/g)][0][1]);
  assert.equal(lastDepth, 5, "the staircase is capped, deeper answers keep the last step");
  assert.match(detailCss, /margin-inline-start:calc\(min\(var\(--depth,0\),5\) \* 20px\)/);
  assert.match(detailCss, /@media\(max-width:390px\)/);
  assert.match(app, /Math\.min\(5, Math\.max\(0, Number\(depth\) \|\| 0\)\)/);
  assert.match(styles, /\.c\.reply\{position:relative;margin-inline-start:calc\(min\(var\(--reply-depth,1\),5\) \* 20px\)!important/);
});

test("the reaction palette is a compact popover anchored beside its trigger", () => {
  assert.match(app, /class="reactionBar xPalette"/);
  assert.match(app, /function positionReactionPalette\(palette, button, \{ viewer = false \} = \{\}\)/);
  assert.match(app, /palette\.classList\.add\("reactionPopoverAnchored"\)/);
  assert.match(app, /--reaction-popover-left/);
  assert.match(app, /--reaction-popover-top/);
  assert.match(app, /if \(expanded\) positionReactionPalette\(palette, button, \{ viewer \}\)/);
  assert.match(app, /paletteScrollHosts\.add\(scrollHost\)/);
  assert.match(app, /scrollHost\.addEventListener\("scroll", \(\) => closeExpandedPalettes\(root\)/);
  assert.match(app, /window\.matchMedia\?\.\("\(pointer: fine\)"\)\?\.matches/);
  assert.match(app, /leaveTimer = setTimeout\(\(\) => \{/);
  assert.match(detailCss, /\.xPalette\{left:8px;right:auto;bottom:calc\(100% \+ 8px\)/);
  assert.match(detailCss, /transition:opacity \.16s ease,transform \.16s ease,visibility 0s linear \.16s/);
  assert.match(detailCss, /\.xPalette\.expanded\{opacity:1;visibility:visible;pointer-events:auto/);
  assert.match(detailCss, /\.xPalette button\{display:inline-flex;min-width:38px;min-height:38px/);
  // The card no longer reserves a full-width row for the palette.
  assert.doesNotMatch(styles, /\.reactionBar\{display:grid;grid-template-columns:repeat\(8/);
  assert.match(styles, /\.reactionBar\{position:absolute;z-index:12/);
  assert.match(styles, /\.post\{position:relative;margin-bottom:12px/);
});

test("the repost surface is wired end to end", () => {
  assert.match(app, /function repostHeaderMarkup\(repost\)/);
  assert.match(app, /data-repost-entry="1"/);
  assert.match(app, /data-repost-undo="/);
  assert.match(app, /async function undoRepost\(button\)/);
  assert.match(app, /toast\(t\(result\.reposted_by_me \? "x\.repost\.done" : "post\.repostWithdrawn"\)\)/);
  assert.match(profileJs, /__repost/);
  assert.match(profileJs, /stamp: \(post\) => Number\(post\?\.__repost\?\.reposted_at/);
  assert.match(profileJs, /profileRepostBadge/);
  assert.match(api, /const reposts = requestedPersona === "social"/);
  assert.match(api, /counts: \{ \.\.\.counts, posts: posts\.length, stories: stories\.length, reposts: reposts\.length, shared_replies: sharedReplies\.length \}/);
  assert.match(api, /const seen = \[\.\.\.new Set\(\[\.\.\.cursor\.seen/);
  assert.match(repo, /listUserReposts\(userId, actorPersona = "social"/);
  assert.match(repo, /listFollowedReposts\(viewerId, \{ viewerPersona = "social", limit = 40 \} = \{\}\)/);
  // The demotion is still there and it is now named in the vocabulary, not in a Romanian sentence.
  assert.match(repo, /if \(repost\) score -= 260;/);
  assert.match(repo, /repost: Boolean\(repost\),/);
  assert.match(repo, /repostedPostIds\.add\(id\)/);
  assert.match(app, /function removeRepostCards\(postId\)/);
  assert.match(app, /if \(!result\.reposted_by_me\) removeRepostCards\(postId\)/);
  assert.match(app, /function syncRepostControls\(postId, result\)/);
  assert.equal((locale.match(/"x\.repost\.by":/g) || []).length, 4);
});
