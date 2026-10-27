import test from "node:test";
import assert from "node:assert/strict";
import {
  QUOTE_CHAIN_LAYERS,
  TEXT_PAGE_LIMIT,
  quoteChainFor,
  quotedPostMarkup,
  composerQuoteMarkup,
  textPagesFor,
  textStageMarkup,
} from "../public/post-quote.js";

// The engine is pure markup, so the review checks the shape a reader gets, not a screenshot:
// an escaped boundary, a page that never overflows and a chain that can never loop.
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const translate = (key) => key;
const mediaList = (post) => (Array.isArray(post?.media_list)
  ? post.media_list
  : (post?.media?.hash ? [post.media] : []));
const mediaUrl = (item) => (item?.hash && item?.ext ? "/media/" + item.hash + "." + item.ext : null);
const context = { esc: escapeHtml, t: translate, captionHtml: escapeHtml, mediaList, mediaUrl, stamp: () => "2h" };

function post(id, overrides = {}) {
  return {
    id,
    caption: "Postarea " + id,
    created_at: "2026-10-18T10:00:00.000Z",
    author: { handle: "autor" + id, display_name: "Autor " + id },
    ...overrides,
  };
}

test("a quote renders the answer under the commentary and the post it answers under that", () => {
  const original = post(1);
  const answer = post(2, { quoted_post: original });
  const markup = quotedPostMarkup(answer, context);
  assert.match(markup, /class="postQuoteChain"/);
  assert.match(markup, /data-quote-open="1"/);
  assert.match(markup, /@autor1/);
  assert.match(markup, /Postarea 1/);
  assert.doesNotMatch(markup, /data-quote-open="2"/, "a post never quotes itself");
});

test("the chain is capped and stops at a cycle instead of looping forever", () => {
  const first = post(1);
  const second = post(2, { quoted_post: first });
  const third = post(3, { quoted_post: second });
  const fourth = post(4, { quoted_post: third });
  assert.equal(quoteChainFor(fourth).length, QUOTE_CHAIN_LAYERS);
  const looped = post(7);
  const middle = post(8, { quoted_post: looped });
  looped.quoted_post = middle;
  assert.equal(quoteChainFor(looped).length, 2, "each id is read once, then the walk stops");
  assert.deepEqual(quoteChainFor(post(9)), []);
});

test("the 9:16 page keeps one answer while the timeline keeps the conversation", () => {
  const fourth = post(4);
  const third = post(3, { quoted_post: fourth });
  const second = post(2, { quoted_post: third });
  const first = post(1, { quoted_post: second });
  assert.equal((quotedPostMarkup(first, context).match(/class="postQuoteLayer/g) || []).length, 3);
  assert.equal((quotedPostMarkup(first, context, { layers: 1 }).match(/class="postQuoteLayer/g) || []).length, 1);
  assert.equal(quotedPostMarkup(post(5), context), "", "a post without a quote adds no empty panel");
});

test("a quoted media post carries one thumbnail and never the whole gallery", () => {
  const quoted = post(5, {
    media_list: [
      { hash: "a".repeat(64), ext: "jpg", kind: "image" },
      { hash: "b".repeat(64), ext: "jpg", kind: "image" },
    ],
  });
  const markup = quotedPostMarkup(post(6, { quoted_post: quoted }), context);
  assert.equal((markup.match(/class="postQuoteThumb"/g) || []).length, 1);
  assert.match(markup, /\/media\/a{64}\.jpg/);
  assert.doesNotMatch(markup, /\/media\/b{64}\.jpg/);
});

test("a caption is escaped once, so a quoted post cannot inject markup", () => {
  const quoted = post(11, { caption: '<img src=x onerror="alert(1)">' });
  const markup = quotedPostMarkup(post(12, { quoted_post: quoted }), context);
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(markup, /<img src=x/);
});

test("long text becomes pages cut at word boundaries and never overflows the limit", () => {
  const words = Array.from({ length: 240 }, (_, index) => "cuvant" + index);
  const pages = textPagesFor(words.join(" "));
  assert.ok(pages.length > 1);
  for (const page of pages) {
    assert.ok(page.length <= TEXT_PAGE_LIMIT, `page of ${page.length} characters`);
    assert.doesNotMatch(page, /^ /);
    assert.doesNotMatch(page, / $/);
  }
  assert.equal(pages.join(" "), words.join(" "), "no word is lost or reordered");
  assert.deepEqual(textPagesFor("   "), []);
  assert.deepEqual(textPagesFor("Un singur gand."), ["Un singur gand."]);
});

test("a text post is a page, with a counter only when there is more than one", () => {
  const single = textStageMarkup(post(21), context);
  assert.match(single, /class="clipTextStage" data-text-stage="21"/);
  assert.match(single, /class="clipTextPage" data-page="0"/);
  assert.doesNotMatch(single, /postTextCounter/);
  const long = textStageMarkup(post(22, { caption: "propozitie lunga ".repeat(120) }), context);
  assert.match(long, /postTextCounter/);
  assert.match(long, /1\/\d+/);
  assert.equal(textStageMarkup(post(23, { caption: "" }), context), "");
});

test("the quote composer carries the id it answers and never an interactive panel", () => {
  const markup = composerQuoteMarkup(post(31), context);
  assert.match(markup, /name="quoted_post_id" value="31"/);
  assert.match(markup, /composer\.quoteHint/);
  assert.doesNotMatch(markup, /data-quote-open/, "the composer preview is not another link");
  assert.equal(composerQuoteMarkup(null, context), "");
});
