// Wave 6h (P10) contracts: "why am I seeing this" is answered from the server's own signals, in the
// reader's own language, on the feed card, the post page and the profile - and the negative terms are
// part of that answer, not hidden behind the ones that promote a post.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo, SOCIAL_RANKING_REASON_KEYS, SOCIAL_RANKING_REASON_LIMIT, socialRankingReasonKeys } from "../lib/repo.js";
import {
  RANKING_REASON_KEYS, RANKING_REASON_LIMIT, rankingReasonKeys, rankingReasonLabel,
  rankingReasonListMarkup, rankingReasonMarkup, rankingReasonPrefixKey,
} from "../public/ranking-reasons.js";

const repo = readFileSync(new URL("../lib/repo.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const postDetail = readFileSync(new URL("../public/post-detail.js", import.meta.url), "utf8");
const profileJs = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const t = (key) => key;


test("the server states signals, not sentences, and the vocabulary is closed on both sides", () => {
  assert.deepEqual(RANKING_REASON_KEYS, SOCIAL_RANKING_REASON_KEYS, "the client and the server share one vocabulary");
  assert.equal(RANKING_REASON_LIMIT, SOCIAL_RANKING_REASON_LIMIT);
  // The negative and fatigue terms are named, not implied by the ranking: this was the research's point.
  for (const key of ["seen_before", "author_less", "community_dislike", "marked_opinion", "older_post"]) {
    assert.equal(RANKING_REASON_KEYS.includes(key), true, key);
  }
  // No Romanian prose is built on the server any more: the reasons are keys, and the interface translates.
  assert.doesNotMatch(repo, /reasons\.push\("/);
  assert.match(repo, /export function socialRankingReasonKeys\(signals = \{\}\)/);
  assert.match(repo, /return keys\.slice\(0, SOCIAL_RANKING_REASON_LIMIT\)/);
  // The two private signals come from the viewer's own behaviour: what they saw and what they refused.
  assert.match(repo, /const authorLess = Number\(this\.db\.prepare\(`/);
  assert.match(repo, /f\.kind = 'NOT_INTERESTED' AND p\.user_id = \?/);
  assert.match(repo, /authorLessPenalty = authorLess \? 240 : 0/);
  assert.match(repo, /seen: Number\(impressions\.impression_count\) >= 2,/);
  // The order of consequence: what put it here, then what held it back, then the baseline.
  assert.deepEqual(socialRankingReasonKeys({ exploration: true, following: true, authorLess: true, fresh: true }),
    ["exploration_new", "following_author", "author_less", "fresh_eligible"]);
  assert.deepEqual(socialRankingReasonKeys({}), []);
  assert.equal(socialRankingReasonKeys({ following: true, affinity: true, language: true, region: true, conversation: true, seen: true }).length, RANKING_REASON_LIMIT);
});

test("the client translates, drops what it does not know, and keeps the reader's own signals", () => {
  const post = { ranking: { reasons: ["following_author", "seen_before", "nonsense_key", "following_author", "exploration_new", "similar_liked", "older_post"] } };
  assert.deepEqual(rankingReasonKeys(post), ["following_author", "seen_before", "exploration_new", "similar_liked"]);
  assert.deepEqual(rankingReasonKeys({ ranking: { reasons: "following_author" } }), []);
  assert.deepEqual(rankingReasonKeys({}), []);
  assert.equal(rankingReasonLabel("following_author", t), "why.following_author");
  assert.equal(rankingReasonLabel("invented", t), "");
  assert.equal(rankingReasonPrefixKey({ context: "profile" }), "profile.whySignals");
  assert.equal(rankingReasonPrefixKey({ context: "feed" }), "post.whyVisible");
  const markup = rankingReasonMarkup(post, { esc, t, context: "feed" });
  assert.match(markup, /^<div class="rankReason" data-rank-reason data-rank-context="feed" title="post\.whyVisible">/);
  assert.equal((markup.match(/why\.following_author/g) || []).length, 1, "a reason is stated once");
  assert.equal((markup.match(/nonsense_key/g) || []).length, 0, "an unknown key is dropped, never printed");
  assert.match(markup, /why\.seen_before/);
  // Nothing from a reason becomes markup, and the list is the same answer in a reader's list form.
  const hostile = rankingReasonMarkup({ ranking: { reasons: ["following_author"] } }, { esc, t: () => '<img src=x onerror="pwn()">' });
  assert.equal(hostile.includes("<img"), false);
  const list = rankingReasonListMarkup(post, { esc, t });
  assert.match(list, /^<ul class="rankReasonList" data-rank-reason-list><li>why\.following_author<\/li>/);
  assert.equal((list.match(/<li>/g) || []).length, 4);
  assert.equal(rankingReasonListMarkup({}, { esc, t }), "");
  assert.equal(rankingReasonMarkup({}, { esc, t }), "");
});

test("the same answer reaches the feed card, the post page and the profile", () => {
  // One renderer, imported by the surfaces instead of copied into them.
  assert.match(app, /import \{ rankingReasonListMarkup, rankingReasonMarkup \} from "\.\/ranking-reasons\.js/);
  assert.match(app, /const rankingReason = rankingReasonMarkup\(post, \{ esc, t, context: "feed" \}\);/);
  assert.match(app, /const reasons = rankingReasonListMarkup\(post, \{ esc, t \}\);/);
  assert.match(app, /menuMarkup: postOptionsMenuMarkup,\n\s+postViewsMarkup,/);
  assert.match(app, /rankingReasonMarkup,\n/);
  assert.doesNotMatch(app, /post\.ranking\.reasons\.join\(" · "\)/);
  // The post page renders the same line, from the module the app hands it, and it works for a post the
  // reader reached from anywhere: the route carries the same signals.
  assert.match(postDetail, /typeof context\.rankingReasonMarkup === "function" \? context\.rankingReasonMarkup\(post, \{ esc, t \}\) : ""/);
  assert.match(api, /const explanation = repo\.socialRankingReasons\(auth\.user\.id, auth\.persona, \[id\]\)\[id\] \?\? \[\];/);
  assert.match(api, /postView\.ranking = \{ context: "post", exploration: explanation\.includes\("exploration_new"\), reasons: explanation \};/);
  // The profile marks the line as signals, because an archive is read newest first.
  assert.match(profileJs, /import \{ rankingReasonMarkup \} from '\.\/ranking-reasons\.js';/);
  assert.match(profileJs, /\+ rankingReasonMarkup\(post, \{ esc, t: tr, context: "profile" \}\)/);
  // The server explains profile posts with the same signals, without touching the archive's order.
  assert.match(api, /post\.ranking = \{ context: "profile", exploration: false, reasons: explanation\[post\.id\] \};/);
  assert.match(api, /const explanation = repo\.socialRankingReasons\(auth\.user\.id, auth\.persona, posts\.slice\(0, 24\)\.map\(\(post\) => post\.id\)\);/);
  // The stylesheet tells the two parts of the sentence apart.
  assert.match(styles, /\.rankReason\{margin:3px 0 7px;color:#9fb4bd;font-size:11px;line-height:1\.35\}\.rankReasonLabel\{color:#7fd8cf\}/);
});

test("every reason a reader can be shown exists in all four languages", () => {
  for (const key of RANKING_REASON_KEYS) {
    assert.equal(locale.split(`"why.${key}"`).length - 1, 4, key);
  }
  assert.equal(locale.split('"profile.whySignals"').length - 1, 4);
  // The wording has to be honest about the two private signals, not flattering about them.
  assert.match(locale, /"why\.seen_before": "Ai mai văzut-o de câteva ori"/);
  assert.match(locale, /"why\.author_less": "Ai cerut mai puțin din partea acestui autor"/);
  assert.match(locale, /"why\.community_dislike": "Comunitatea a reacționat negativ la ea"/);
  assert.match(locale, /"why\.repost_shared": "Ajunge la tine fiindcă altcineva a distribuit-o, fără avans"/);
});

test("a real feed explains itself, and a refused post stays refused", () => {
  const db = openDb(":memory:");
  const store = createRepo(db);
  try {
    const reader = store.createUser({ handle: "why-reader", displayName: "Reader" });
    const author = store.createUser({ handle: "why-author", displayName: "Author" });
    for (const persona of ["social"]) {
      store.ensurePersona(reader.id, persona, { visibility: "public" });
      store.ensurePersona(author.id, persona, { visibility: "public" });
    }
    store.updatePersona(reader.id, "social", { visibility: "public", regionCode: "PL-MAZ", nearEnabled: true, contentLanguages: ["ro"] });
    store.setFollow(reader.id, author.id, "social", true);
    const post = store.createPost({ userId: author.id, persona: "social", kind: "text", caption: "Prima postare", visibility: "public", language: "ro" });
    const second = store.createPost({ userId: author.id, persona: "social", kind: "text", caption: "A doua postare", visibility: "public", language: "ro" });

    const feed = store.listSocialFeed(reader.id, { lens: "for-you", format: "all", limit: 20 });
    const entry = feed.find((item) => Number(item.id) === Number(post.id));
    assert.ok(entry, "the followed author is in the feed");
    assert.equal(entry.ranking.reasons.includes("following_author"), true);
    assert.equal(entry.ranking.reasons.includes("language_preference"), true);
    assert.equal(entry.ranking.reasons.every((key) => SOCIAL_RANKING_REASON_KEYS.includes(key)), true, "only known keys leave the server");

    // Fatigue is named: a post read more than once says so instead of pretending to be new.
    store.recordSocialImpressions(reader.id, "social", [{ post_id: post.id, dwell_ms: 900, completed: false }]);
    store.recordSocialImpressions(reader.id, "social", [{ post_id: post.id, dwell_ms: 900, completed: false }]);
    const tired = store.listSocialFeed(reader.id, { lens: "for-you", format: "all", limit: 20 }).find((item) => Number(item.id) === Number(post.id));
    assert.equal(tired.ranking.reasons.includes("seen_before"), true, "the reader is told the post is one they have seen");

    // The viewer's own "less of this author" is named on the author's other post, and the post they
    // refused is gone: feedback removes one post and lowers the rest, it does not silently do both.
    assert.equal(store.setSocialFeedback(reader.id, "social", second.id, "NOT_INTERESTED", true), true);
    const afterFeedback = store.listSocialFeed(reader.id, { lens: "for-you", format: "all", limit: 20 });
    assert.equal(afterFeedback.some((item) => Number(item.id) === Number(second.id)), false);
    const related = afterFeedback.find((item) => Number(item.id) === Number(post.id));
    assert.equal(related.ranking.reasons.includes("author_less"), true, "the demotion of the rest is explained");

    // The profile explains the same post with the same signals, and its order stays chronological.
    const explanation = store.socialRankingReasons(reader.id, "social", [post.id]);
    assert.equal(explanation[post.id].includes("following_author"), true);
    assert.equal(explanation[post.id].includes("author_less"), true);
    // A post the viewer cannot see is explained with nothing, and a missing id is not an id.
    assert.deepEqual(store.socialRankingReasons(reader.id, "social", [999999, 0, "x"]), { 999999: [] });
    assert.deepEqual(Object.keys(store.socialRankingReasons(reader.id, "social", [])), []);
  } finally {
    db.close();
  }
});
