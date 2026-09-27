// P4 contracts: an ordered gallery, tags extracted at write time, a tag page and honest trending.
//
// The rules that matter to a reader are pinned here: a tag belongs to the posts that really carry
// it, a gallery is ordered, and trending counts distinct people (never mentions).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo, extractPostTags } from "../lib/repo.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const detailCss = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../public/post-detail.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const backfill = readFileSync(new URL("../scripts/backfill-post-tags.mjs", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.p4", displayName: "Owner P4" });
  const reader = repo.createUser({ handle: "reader.p4", displayName: "Reader P4" });
  const catalog = repo.createUser({ handle: "catalog.p4", displayName: "Catalog P4", trafficClass: "SEEDED_CATALOG" });
  for (const user of [owner, reader, catalog]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  return { db, repo, owner, reader, catalog };
}

function addImage(repo, owner, letter) {
  const row = repo.db.prepare(`INSERT INTO media (hash, ext, mime, kind, size, uploaded_by, purpose, scan_status) VALUES (?, 'png', 'image/png', 'image', 1200, ?, 'social_post', 'ready_local_validation')`).run(letter.repeat(64), owner.id);
  const id = Number(row.lastInsertRowid);
  repo.db.prepare(`INSERT INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, 'social_post', 'social')`).run(id, owner.id);
  return id;
}

test("tags are read from the caption once, with the rules a reader expects", () => {
  const tags = extractPostTags("Salut #Nexus și $EGLD, dar nu #a sau www.x.com/$nu");
  assert.deepEqual(tags.map((entry) => entry.kind + ":" + entry.tag), ["hashtag:nexus", "cashtag:egld"]);
  // The first spelling is kept for display, the tag itself is lowercased.
  assert.equal(tags[0].display, "Nexus");
  // A cashtag is a ticker: letters only, while a hashtag may carry digits and diacritics.
  assert.deepEqual(extractPostTags("$BTC123").map((entry) => entry.tag), []);
  assert.deepEqual(extractPostTags("#românia").map((entry) => entry.tag), ["românia"]);
  // Repeats collapse and the list is bounded.
  assert.equal(extractPostTags("#unu #unu #unu").length, 1);
  assert.equal(extractPostTags(Array.from({ length: 40 }, (_, index) => "#tag" + index).join(" ")).length, 20);
  assert.deepEqual(extractPostTags(""), []);
  assert.deepEqual(extractPostTags(null), []);
  // Escaping happens at render time, so extraction must not see an escaped entity as a tag.
  assert.deepEqual(extractPostTags("5 < 6 & 7 > 2"), []);
});

test("a gallery is ordered and the cover stays the first media", () => {
  const { db, repo, owner } = fixture();
  try {
    const first = addImage(repo, owner, "a");
    const second = addImage(repo, owner, "b");
    const post = repo.createPost({ userId: owner.id, persona: "social", kind: "image", caption: "Galerie #poze", visibility: "public", mediaId: first });
    repo.setPostMedia(post.id, [second, first]);
    assert.deepEqual(repo.listPostMedia(post.id).map((item) => item.id), [second, first], "the order is the order the writer chose");
    assert.equal(repo.getPostById(post.id).media_id, second, "the cover follows the first item");
    const bulk = repo.listPostMediaBulk([post.id, 999]);
    assert.equal(bulk.get(post.id).length, 2);
    assert.deepEqual(bulk.get(999), []);
    // An empty list clears the cover instead of leaving a stale one.
    assert.equal(repo.setPostMedia(post.id, []).length, 0);
    assert.equal(repo.getPostById(post.id).media_id, null);
  } finally { db.close(); }
});

test("a tag page answers with the posts that really carry the tag", () => {
  const { db, repo, owner, reader, catalog } = fixture();
  try {
    const publicPost = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Public #Nexus", visibility: "public" });
    const followersPost = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Doar followers #Nexus", visibility: "followers" });
    const catalogPost = repo.createPost({ userId: catalog.id, persona: "social", kind: "text", caption: "Catalog #Nexus", visibility: "public" });
    for (const post of [publicPost, followersPost, catalogPost]) repo.setPostTags(post.id, extractPostTags(post.caption));
    assert.deepEqual(repo.postTags(publicPost.id).map((entry) => entry.tag), ["nexus"]);
    const visible = repo.listPostsByTag(reader.id, "social", { kind: "hashtag", tag: "nexus", limit: 30 }).map((post) => post.id);
    assert.deepEqual(visible, [publicPost.id], "a followers-only post stays hidden and catalog traffic never appears");
    repo.setFollow(reader.id, owner.id, "social", true);
    const followed = repo.listPostsByTag(reader.id, "social", { kind: "hashtag", tag: "nexus", limit: 30 }).map((post) => post.id).sort((a, b) => a - b);
    assert.deepEqual(followed, [publicPost.id, followersPost.id].sort((a, b) => a - b));
    // Pagination walks backwards in time and never repeats a post.
    const firstPage = repo.listPostsByTag(owner.id, "social", { kind: "hashtag", tag: "nexus", limit: 1 });
    assert.equal(firstPage.length, 1);
    const secondPage = repo.listPostsByTag(owner.id, "social", { kind: "hashtag", tag: "nexus", limit: 1, before: firstPage[0].created_at });
    assert.ok(!secondPage.some((post) => post.id === firstPage[0].id));
    // An edit replaces the tag set instead of appending to it.
    repo.setPostTags(publicPost.id, extractPostTags("Fără taguri acum"));
    assert.deepEqual(repo.postTags(publicPost.id), []);
    assert.equal(repo.listPostsByTag(owner.id, "social", { kind: "hashtag", tag: "nexus", limit: 5 }).some((post) => post.id === publicPost.id), false);
  } finally { db.close(); }
});

test("trending counts distinct people, not mentions", () => {
  const { db, repo, owner, reader, catalog } = fixture();
  try {
    // Five posts from one account: loud, but not a trend.
    for (let index = 0; index < 5; index += 1) {
      const spam = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Repet #spam", visibility: "public" });
      repo.setPostTags(spam.id, extractPostTags(spam.caption));
    }
    for (const user of [owner, reader]) {
      const post = repo.createPost({ userId: user.id, persona: "social", kind: "text", caption: "Vorbim #nexus", visibility: "public" });
      repo.setPostTags(post.id, extractPostTags(post.caption));
    }
    const catalogPost = repo.createPost({ userId: catalog.id, persona: "social", kind: "text", caption: "Catalog #nexus", visibility: "public" });
    repo.setPostTags(catalogPost.id, extractPostTags(catalogPost.caption));
    const trending = repo.trendingTags({ kind: "hashtag", limit: 10, minAuthors: 2 });
    assert.deepEqual(trending.map((entry) => entry.tag), ["nexus"], "five posts from one account cannot trend");
    assert.equal(trending[0].authors, 2, "catalog traffic is not an author");
    assert.equal(trending[0].posts, 2);
    assert.deepEqual(repo.tagStats("hashtag", "nexus"), { kind: "hashtag", tag: "nexus", posts: 2, authors: 2 });
    // The window is respected (and never shorter than one hour, so a burst cannot be measured in
    // seconds): pushing the posts three days back removes them from the daily trend.
    assert.equal(repo.trendingTags({ kind: "hashtag", sinceSeconds: 60, limit: 10, minAuthors: 2 }).length, 1, "the window has a one hour floor");
    repo.db.prepare(`UPDATE posts SET created_at = created_at - ?`).run(3 * 24 * 3600);
    assert.deepEqual(repo.trendingTags({ kind: "hashtag", sinceSeconds: 24 * 3600, limit: 10, minAuthors: 2 }), []);
    assert.deepEqual(repo.trendingTags({ kind: "hashtag", sinceSeconds: 7 * 24 * 3600, limit: 10, minAuthors: 2 }).map((entry) => entry.tag), ["nexus"]);
    // Cashtags are counted apart from hashtags.
    assert.deepEqual(repo.trendingTags({ kind: "cashtag", limit: 10 }).map((entry) => entry.tag), []);
  } finally { db.close(); }
});

test("the server and the client agree on the gallery, the tags and the trends", () => {
  // Server: the gallery and the tags are written with the post, and the payload always carries both.
  assert.match(api, /if \(mediaIds\.length\) repo\.setPostMedia\(post\.id, mediaIds, \{ transaction: false \}\);/);
  assert.match(api, /repo\.setPostTags\(post\.id, extractPostTags\(caption\), \{ transaction: false \}\);/);
  assert.match(api, /repo\.setPostTags\(edited\.id, extractPostTags\(caption\)\);/);
  assert.match(api, /media_list: \(\(\) => \{/);
  assert.match(api, /tags: repo\.postTags\(post\.id\),/);
  assert.match(api, /if \(kinds\.includes\("video"\) && mediaIds\.length > 1\) return json\(res, 400, \{ ok: false, error: "a video post carries one media" \}\);/);
  assert.match(api, /if \(method === "GET" && path === "\/api\/social\/tags"\)/);
  assert.match(api, /metric: "unique_human_authors", paid_boosts: false/);
  assert.match(api, /const tagPageMatch = path\.match/);
  // Client: one carousel, one lightbox, one tag page, one caption linkifier, a gallery picker.
  assert.match(app, /function captionWithTagsMarkup\(text\)/);
  assert.match(app, /function tagChipMarkup\(kind, raw\)/);
  assert.match(app, /function mediaCarouselMarkup\(post\)/);
  assert.match(app, /function openMediaLightbox\(post, index = 0\)/);
  assert.match(app, /function openTagPage\(kind, tag\)/);
  assert.match(app, /async function loadSocialTrends\(host\)/);
  assert.match(app, /void loadSocialTrends\(document\.getElementById\("social-trends"\)\)/);
  assert.match(app, /const mediaArea = carouselBlock \|\| mediaBlock;/);
  assert.match(app, /' \+ \(storyMode \|\| options\.source === "clip" \? "" : " multiple"\) \+ '/);
  assert.match(app, /const galleryAllowed = !storyMode && socialMode && pickedFiles\.length > 1;/);
  assert.match(app, /galleryMedia\.push\(\{ hash: upload\.media\.hash, ext: upload\.media\.ext \}\);/);
  assert.match(markup, /const galleryMarkup = context\.carouselFor \? context\.carouselFor\(post\) : "";/);
  assert.match(markup, /'<div class="postTagRow">' \+ post\.tags\.map/);
  assert.match(detailCss, /\.mediaCarouselTrack\{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x mandatory/);
  assert.match(detailCss, /\.tagPageLayer\{position:absolute;inset:0;z-index:45/);
  assert.match(detailCss, /\.socialTrends button\{display:grid;grid-template-columns:22px minmax\(0,1fr\)/);
  // The backfill script never invents a tag, and it stays dry unless asked to write.
  assert.match(backfill, /const execute = process\.argv\.includes\("--execute"\);/);
  assert.match(backfill, /repo\.setPostTags\(post\.id, tags\);/);
  assert.equal((locale.match(/"tags\.trending":/g) || []).length, 4);
  assert.equal((locale.match(/"post\.gallery":/g) || []).length, 4);
});
