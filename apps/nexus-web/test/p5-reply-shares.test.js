// P5 contracts: a shared reply is an internal share, a reply says who it answers, and a reply link
// opens the reply itself. The rules that matter are pinned here: nothing new is published by a
// share, a blocked account never inflates the counter, and a withdrawn reply cannot be shared.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const detail = readFileSync(new URL("../public/post-detail.js", import.meta.url), "utf8");
const profileExperience = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");
const detailCss = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const planning = readFileSync(new URL("../../../planning/NX-SOCIAL-X-SURFACE-v1.md", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.p5", displayName: "Owner P5" });
  const reader = repo.createUser({ handle: "reader.p5", displayName: "Reader P5" });
  const stranger = repo.createUser({ handle: "stranger.p5", displayName: "Stranger P5" });
  for (const user of [owner, reader, stranger]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  const post = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Postarea P5", visibility: "public" });
  const reply = repo.addSocialComment({ userId: reader.id, actorPersona: "social", postId: post.id, body: "Un răspuns care poate fi repostat." });
  const nested = repo.addSocialComment({ userId: stranger.id, actorPersona: "social", postId: post.id, body: "Un răspuns la răspuns.", parentId: reply.id });
  return { db, repo, owner, reader, stranger, post, reply, nested };
}

test("a shared reply is an internal share: it counts, it is readable, and it publishes nothing", () => {
  const { db, repo, owner, reader, stranger, post, reply } = fixture();
  try {
    assert.deepEqual(repo.commentShareSummary(reply.id, reader.id, "social"), { shares: 0, shared_by_me: false });
    const shared = repo.setCommentShare(reader.id, "social", reply.id, true);
    assert.deepEqual(shared, { shares: 1, shared_by_me: true });
    // Sharing twice is not sharing twice: one account counts once, whatever the readers do.
    assert.deepEqual(repo.setCommentShare(reader.id, "social", reply.id, true), { shares: 1, shared_by_me: true });
    assert.equal(repo.commentShareSummary(reply.id, owner.id, "social").shares, 1);
    assert.equal(repo.commentShareSummary(reply.id, owner.id, "social").shared_by_me, false);
    assert.deepEqual(repo.setCommentShare(stranger.id, "social", reply.id, true), { shares: 2, shared_by_me: true });
    // Undo only removes the reader's own share.
    assert.deepEqual(repo.setCommentShare(reader.id, "social", reply.id, false), { shares: 1, shared_by_me: false });
    assert.equal(repo.commentShareCount(reply.id), 1);
    // Blocked accounts never inflate a counter, exactly like the post repost counter.
    repo.setProfileBlock(owner.id, "social", stranger.id, true);
    assert.equal(repo.commentShareCount(reply.id, owner.id, "social"), 0);
    assert.equal(repo.commentShareCount(reply.id), 1, "the record still knows the share happened");
    repo.setProfileBlock(owner.id, "social", stranger.id, false);
    // The reply itself is untouched: same body, same author, same post.
    const stored = repo.getCommentById(reply.id);
    assert.equal(stored.body, "Un răspuns care poate fi repostat.");
    assert.equal(Number(stored.user_id), Number(reader.id));
    assert.equal(Number(stored.post_id), Number(post.id));
  } finally { db.close(); }
});

test("one query answers a whole thread page", () => {
  const { db, repo, owner, reader, stranger, reply, nested } = fixture();
  try {
    repo.setCommentShare(reader.id, "social", reply.id, true);
    repo.setCommentShare(stranger.id, "social", nested.id, true);
    const bulk = repo.commentShareSummariesBulk([reply.id, nested.id, 9999], owner.id, "social");
    assert.equal(bulk.size, 3, "every id asked for is answered, even the empty ones");
    assert.deepEqual(bulk.get(Number(reply.id)), { shares: 1, shared_by_me: false });
    assert.deepEqual(bulk.get(Number(nested.id)), { shares: 1, shared_by_me: false });
    assert.deepEqual(bulk.get(9999), { shares: 0, shared_by_me: false });
    assert.equal(repo.commentShareSummariesBulk([], owner.id, "social").size, 0);
    // The parent author travels with the reply, so "Replying to @x" is true on any page.
    const parents = repo.commentParentAuthors([reply.id, nested.id]);
    assert.equal(parents.has(Number(reply.id)), false, "a root reply answers the post, not a person");
    assert.equal(parents.get(Number(nested.id)).handle, "reader.p5");
    assert.equal(Number(parents.get(Number(nested.id)).id), Number(reply.id));
  } finally { db.close(); }
});

test("the profile lists the shared replies, with the post they came from", () => {
  const { db, repo, owner, reader, stranger, post, reply, nested } = fixture();
  try {
    repo.setCommentShare(reader.id, "social", nested.id, true);
    repo.setCommentShare(stranger.id, "social", nested.id, true);
    const mine = repo.listUserCommentShares(reader.id, "social", { viewerId: owner.id, viewerPersona: "social" });
    assert.equal(mine.length, 1);
    assert.equal(Number(mine[0].comment.id), Number(nested.id));
    assert.equal(mine[0].comment.handle, "stranger.p5", "the reply keeps its own author");
    assert.equal(Number(mine[0].post.id), Number(post.id));
    assert.equal(mine[0].post_author.handle, "owner.p5");
    assert.equal(mine[0].shared_at > 0, true);
    // A share of someone else's reply is not mine, and the stranger's profile shows only theirs.
    assert.equal(repo.listUserCommentShares(stranger.id, "social").length, 1);
    assert.equal(repo.listUserCommentShares(owner.id, "social").length, 0);
    // A withdrawn reply stops being shareable material.
    repo.withdrawSocialComment({ commentId: nested.id, userId: stranger.id, actorPersona: "social" });
    assert.equal(repo.listUserCommentShares(reader.id, "social").length, 0);
  } finally { db.close(); }
});

test("the server and the client agree on reply shares, reply context and reply links", () => {
  // Server: the share route mirrors the repost route, the thread carries the shares and the parent
  // author, and the deep-link route answers with the post the reply belongs to.
  assert.match(api, /const commentShareMatch = path\.match\(\/\^\\\/api\\\/comments\\\/\(\\d\+\)\\\/share\$\//);
  assert.match(api, /const commentContextMatch = path\.match\(\/\^\\\/api\\\/comments\\\/\(\\d\+\)\\\/context\$\//);
  assert.match(api, /internal_share: true, visibility_changed: false,/);
  assert.match(api, /reply_shares: Number\(shares\.shares \|\| 0\),/);
  assert.match(api, /parent_author: parentAuthor \? \{/);
  assert.match(api, /shares: repo\.commentShareSummariesBulk\(commentIds, auth\.user\.id, auth\.persona\),/);
  assert.match(api, /parents: repo\.commentParentAuthors\(commentIds\),/);
  assert.match(api, /shared_replies: sharedReplies,/);
  // Client: one share button per reply, one context line, one focused reply, one profile section.
  assert.match(detail, /'<button type="button" data-comment-share="' \+ id \+ '"/);
  assert.match(detail, /'<p class="detailReplyContext">' \+ esc\(t\("x\.reply\.inReplyTo"\)\)/);
  assert.match(detail, /const shareReply = async \(button\) => \{/);
  assert.match(detail, /api\("\/api\/comments\/" \+ commentId \+ "\/share"/);
  assert.match(detail, /const focusLinkedReply = \(layer\) => \{/);
  assert.match(detail, /surface\.focusReplyId = Number\.isSafeInteger\(Number\(focusReplyId\)\)/);
  assert.match(app, /async function openReplyDeepLink\(commentId, \{ from = null \} = \{\}\) \{/);
  assert.match(app, /const reply = \/\^#reply-\(\\d\+\)\$\/\.exec\(location\.hash \|\| ""\);/);
  assert.match(app, /onOpenReply: \(commentId\) => \{ void openReplyDeepLink\(commentId\); \},/);
  assert.match(profileExperience, /const sharedReplyCards = \(Array\.isArray\(result\.shared_replies\)/);
  assert.match(profileExperience, /whisperCards\.join\(''\) \+ sharedReplyCards\.join\(''\)/);
  assert.match(detailCss, /\.detailReply\.isFocused\{border-left:2px solid #32e8dd/);
  assert.match(detailCss, /\.ownerSharedReplyOpen\{display:inline-flex/);
  // Four languages, the same keys, and the receipt names this wave.
  for (const key of ["x.reply.inReplyTo", "x.reply.share", "x.reply.focusLabel", "profile.sharedReplyOn", "profile.openReply"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.match(planning, /## 7\. Wave 4 \(P5\)/);
  assert.match(planning, /comment_shares/);
});
