import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  profileContentBuckets, profilePostKind, profileRelativeTime, renderOwnerProfileExperience,
} from "../public/profile-experience.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");

const NOW = Date.parse("2026-09-18T12:00:00Z");
const owner = Object.freeze({
  user_id: 19, handle: "romeodeepsek", persona: "social", name: "Romeo Deepsek",
  bio: "Citesc orașul dimineața.", avatar: null, cover: null, visibility: "public", is_self: true,
  counts: { posts: 27, followers: 128, following: 312 },
});

function profilePost(id, overrides = {}) {
  return {
    id, user_id: 19, persona: "social", kind: "text", caption: "Linia unu\nLinia doi",
    media: null, created_at: Math.floor(NOW / 1000) - 7200,
    reactions: { counts: {}, viewer_reaction: null }, comment_count: 0, reposts: 0,
    reposted_by_me: false, ...overrides,
  };
}

function fakeNode(dataset = {}) {
  const handlers = {};
  const children = [];
  return {
    dataset, hidden: false, handlers, children,
    parentElement: null, disabled: false,
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, addEventListener(type, handler) { handlers[type] = handler; },
    append(node) {
      // A real DOM move takes the node out of the parent it was in: the stub models that, because the whole
      // point of the stream is that the same nodes are read in one place at a time.
      const previous = node.parentElement;
      if (previous?.children) {
        const at = previous.children.indexOf(node);
        if (at >= 0) previous.children.splice(at, 1);
      }
      children.push(node);
      node.parentElement = this;
      return node;
    },
    querySelectorAll: () => [],
  };
}

// Minimal host that answers exactly the selectors the owner profile asks for, so the tab
// contract can be exercised without a browser.
function profileHost({ cards = [], tabs = [], grid = fakeNode(), list = fakeNode(), emptyStates = [], stream = fakeNode(), filters = null } = {}) {
  const selectors = {
    ".ownerPostGrid": [grid], ".ownerWhisperList": [list],
    "[data-profile-post]": cards, "[data-profile-open]": [], "[data-profile-moment]": [],
    "[data-owner-content]": tabs, "[data-owner-empty-for]": emptyStates,
    // Wave 12: the Flow is one stream of the same nodes, the filter row is a row of its own, and every post is
    // an item the stream and the filters move around.
    "[data-owner-post-item]": cards, "[data-owner-flow-stream]": [stream], "[data-owner-filters]": filters ? [filters] : [],
  };
  return {
    html: "", hidden: false,
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector: (selector) => (selectors[selector] || [])[0] || null,
    querySelectorAll: (selector) => selectors[selector] || [],
  };
}

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

test("the profile separates the media grid from the whisper timeline", () => {
  assert.equal(profilePostKind({ media: { kind: "video" } }), "video");
  assert.equal(profilePostKind({ media: { kind: "image" } }), "image");
  assert.equal(profilePostKind({ media: { kind: "audio" } }), "text");
  assert.equal(profilePostKind({}), "text");
  const buckets = profileContentBuckets([
    profilePost(1), profilePost(2, { media: { kind: "video" } }),
    profilePost(3, { media: { kind: "image" } }), profilePost(4),
  ]);
  // A profile is a personal archive: newest first, with the post id as the tie-break, so a
  // visitor always sees what was posted last.
  assert.deepEqual(buckets.tiles.map((post) => post.id), [3, 2]);
  assert.deepEqual(buckets.whispers.map((post) => post.id), [4, 1]);
  const ordered = profileContentBuckets([
    profilePost(10, { created_at: 1000 }),
    profilePost(11, { created_at: 3000 }),
    profilePost(12, { created_at: 2000 }),
  ]);
  assert.deepEqual(ordered.whispers.map((post) => post.id), [11, 12, 10]);
  assert.deepEqual(profileContentBuckets(null), { tiles: [], whispers: [] });
});

test("whisper cards are stamped in the interface language, never in English only", () => {
  assert.equal(profileRelativeTime(NOW / 1000 - 30, NOW, "ro-RO"), "acum");
  assert.equal(profileRelativeTime(NOW / 1000 - 7200, NOW, "ro-RO"), "acum 2 h");
  assert.equal(profileRelativeTime(NOW / 1000 - 7200, NOW, "en"), "2 hr. ago");
  assert.match(profileRelativeTime(NOW / 1000 - 7200, NOW, "pl"), /godz/);
  assert.match(profileRelativeTime(NOW / 1000 - 7200, NOW, "ar"), /قبل/);
  assert.equal(profileRelativeTime(NOW / 1000 + 600, NOW, "ro-RO"), "acum");
  assert.equal(profileRelativeTime("nonsense", NOW, "ro-RO"), "");
});


test("the owner hero stays compact: identity row, short bio, one timeline per tab", () => {
  const host = profileHost();
  renderOwnerProfileExperience(host, {
    profile: owner,
    posts: [
      profilePost(79, { comment_count: 3, reposts: 1, reactions: { counts: { LIKE: 2 }, viewer_reaction: "LIKE" } }),
      profilePost(80, { reposted_by_me: true }),
      profilePost(81, { media: { kind: "image", hash: "a".repeat(64), ext: "png" } }),
      profilePost(82, { media: { kind: "video", hash: "b".repeat(64), ext: "webm" } }),
    ],
    stories: [],
  }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t: (key) => key, locale: "ro-RO", now: NOW,
    controls: () => ({ summary: "<i>SUMMARY</i>", palette: "<div class=\"reactionBar\"></div>", drawer: "<div class=\"comments\"></div>" }),
  });
  const html = host.innerHTML;
  // Compressed identity bar: avatar, name, inline counters and actions share one row, and the
  // bio is clamped instead of pushing the timeline off the screen.
  assert.match(html, /<div class="ownerHero"><div class="ownerIdentity">/);
  assert.match(html, /class="ownerAvatar"/);
  // The owner's hero carries the two photo affordances: they are in the markup for the owner only, and
  // the stylesheet reveals them while the identity is in edit mode.
  assert.equal(html.includes('class="ownerAvatarSlot"'), true);
  assert.equal(html.includes('data-hero-photo="avatar"'), true);
  assert.equal(html.includes('data-hero-photo="cover"'), true);
  assert.match(html, /<div class="ownerIdentityText"><h1>/);
  // The band carries the handle, the location and the counters, so the hero prints none of them: they
  // stay once, in one screen-reader-only line, because the band is aria-hidden decoration.
  assert.match(html, /<p class="ownerFacts">@romeodeepsek · 27 profile\.posts · 128 profile\.followers · 312 profile\.following<\/p>/);
  assert.doesNotMatch(html, /class="ownerStats"/);
  assert.doesNotMatch(html, /class="ownerHandle"/);
  // Wave 6t: the pencil and the check wait at the right end of the band row, so the control that opens
  // the editor never moves when the editor opens. The name line keeps the name and the lock. The
  // description is a single block that owns its full width.
  const nameLine = html.slice(html.indexOf("<h1>"), html.indexOf("</h1>"));
  assert.match(nameLine, /data-hero-edit="name"/);
  assert.doesNotMatch(nameLine, /data-owner-edit/);
  const actions = html.slice(html.indexOf('<div class="ownerHeroActions">'), html.indexOf("</div>", html.indexOf('<div class="ownerHeroActions">')));
  assert.match(actions, /<button type="button" class="heroIconButton" data-owner-edit aria-label="profile\.editAction"[^>]*>✎<\/button>/);
  assert.match(actions, /<button type="button" class="heroIconButton heroConfirm" data-hero-confirm="profile"[^>]*hidden>✓<\/button>/);
  assert.doesNotMatch(html, /ownerBioRow/);
  assert.match(html, /<div class="ownerBioBlock"><p class="ownerBio[^>]*data-hero-bio-text>/);
  // The band and its two controls are one row; the tabs and the media grid stay siblings of the hero, and
  // the shelf of saved stories is a tab of the archive instead of a rail under the identity.
  assert.match(html, /<div class="ownerTickerRow"><div class="ownerTicker"/);
  assert.match(html, /<div class="ownerMomentsPanel" data-owner-panel="moments" hidden>/);
  assert.match(html, /<nav class="ownerContentTabs"/);
  assert.match(html, /<div class="ownerPostGrid">/);
  assert.match(html, /data-owner-location="[^"]*" aria-haspopup="listbox"/);
  assert.doesNotMatch(html, /data-owner-create/);
  // The location row is the owner's editor for a fact the band shows: the stylesheet keeps it out of
  // the profile unless the identity is being edited, and it never becomes a second copy of the band.
  assert.match(css, /\.ownerLocationRow\{position:relative;display:none/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerLocationRow\{display:flex\}/);
  assert.match(css, /\.ownerFacts\{position:absolute;width:1px;height:1px/);
  assert.match(css, /\.ownerBio\{display:-webkit-box[^}]*webkit-line-clamp:3/);
  assert.match(css, /\.ownerIdentity\{grid-template-columns:92px minmax\(0,1fr\) 40px\}/);
  // Without a cover there is nothing to overlap, and a long moment caption must not stretch its tile:
  // the shelf stays a row of circles — and wave 6t made the cover a photo instead of a strip, which is
  // the height the saved stories gave back by moving into the tabs.
  assert.match(html, /<section class="nexusOwnerProfile" data-profile-cover="0" data-cover-mode="cover">/);
  assert.match(css, /\.nexusOwnerProfile\[data-profile-cover="1"\] \.ownerIdentity\{margin-top:-46px\}/);
  assert.match(css, /\.ownerCover\{height:168px\}/);
  assert.match(css, /\.ownerMomentsPanel button\{flex:0 0 54px;min-width:0;overflow:hidden;border:0;background:none;color:#aebac1\}/);
  // One whisper after another, while the media tabs keep their own grid, newest first. Every post is an item
  // that carries what it is and when it was written; the tile inside it is the button that opens the post.
  assert.match(html, /<div class="ownerPostGrid"><div class="profileTile"[^>]*data-profile-kind="video"[^>]*><button type="button" class="profileTileOpen" data-profile-post="[0-9]+" data-profile-open="[0-9]+" data-profile-kind="video">/);
  assert.match(html, /data-profile-kind="image"/);
  assert.match(html, /<video src="\/media\/b{64}\.webm" muted playsinline>/);
  assert.match(html, /<div class="ownerWhisperList" role="region" aria-label="profile\.tabWhispers">/);
  assert.match(html, /class="ownerWhisperBody" dir="auto">Linia unu\nLinia doi<\/p>/);

test("a clip's tile says what it is and how many people watched it, in its own corner", () => {
  const host = profileHost();
  renderOwnerProfileExperience(host, {
    profile: owner,
    stories: [],
    posts: [
      profilePost(91, { media: { kind: "image", hash: "d".repeat(64), ext: "png" }, view_stats: { viewers: 77, impressions: 80, completed: 0 } }),
      profilePost(90, { media: { kind: "video", hash: "c".repeat(64), ext: "webm" }, view_stats: { viewers: 1512, impressions: 4200, completed: 900 } }),
    ],
  }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t: (key) => key, locale: "ro-RO", now: NOW,
  });
  const html = host.innerHTML;
  const grid = html.slice(html.indexOf('<div class="ownerPostGrid">'), html.indexOf('<div class="ownerWhisperList"'));
  // The number is shortened by Intl in the interface language, so the expectation is the same formatter the
  // page uses - the count is a fact about the reader's language, not a literal in this test.
  const compact = new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 }).format(1512);
  // The clip wears the play sign and the count a reader can take in at a glance, in one corner; the photo
  // wears neither, because a still picture was not watched.
  assert.match(grid, /<video src="\/media\/c{64}\.webm" muted playsinline><\/video><i class="profileTilePlay" aria-hidden="true">▶<\/i>/);
  assert.equal(grid.includes('<small class="profileTileViews" aria-label="' + compact + ' profile.views"><span aria-hidden="true">👁</span> ' + compact + "</small>"), true, "the count is one accessible sentence");
  assert.equal((grid.match(/class="profileTilePlay"/g) || []).length, 1, "only the clip carries the play sign");
  assert.equal((grid.match(/class="profileTileViews"/g) || []).length, 1, "and only the clip carries a count");
  // The pin is a control of its own, beside the button that opens the post: a button inside a button is not a
  // button, so the tile is wrapped and the pin closes the wrap.
  assert.match(grid, /<\/button><button type="button" class="profileTilePin" data-pin-post="90"/);
  assert.equal((grid.match(/class="profileTilePin"/g) || []).length, 2, "the owner can arrange either one of them");
  assert.match(css, /\.profileTilePlay,\.profileTileViews\{position:absolute;bottom:7px/);
  assert.match(css, /\.profileTilePin\{position:absolute;top:6px;right:6px/);
  // The count is what the product already measures - distinct human readers - and nothing else.
  assert.match(readFileSync(new URL("../lib/api.js", import.meta.url), "utf8"), /view_stats: repo\.postViewStats\(post\.id\),/);
});

test("whisper counts come from the post, and the card reuses the feed controls", () => {
  const host = profileHost();
  renderOwnerProfileExperience(host, { profile: owner, stories: [], posts: [
    profilePost(79, { comment_count: 3, reposts: 1, reactions: { counts: { LIKE: 2 }, viewer_reaction: "LIKE" } }),
    profilePost(80, { reposted_by_me: true }),
  ] }, {
    esc: (value) => String(value ?? ""), safeUrl: () => "", t: (key) => key, locale: "ro-RO", now: NOW,
    controls: (post) => ({
      summary: "<i>SUMMARY" + post.id + "</i>",
      palette: "<div class=\"reactionBar\">" + post.id + "</div>",
      drawer: "<div class=\"comments\" id=\"comments-" + post.id + "\"></div>",
    }),
  });
  const html = host.innerHTML;
  assert.match(html, /data-comments="79" aria-label="comments\.title"><i>◌<\/i><small>3<\/small>/);
  assert.match(html, /data-repost="79" aria-label="post\.repost"><i>⟳<\/i><small>1<\/small>/);
  assert.match(html, /<i>SUMMARY79<\/i>/);
  assert.match(html, /<div class="reactionBar">79<\/div>/);
  assert.match(html, /<div class="comments" id="comments-79"><\/div>/);
  // A whisper nobody reacted to reports real zeros instead of a showcase number.
  assert.match(html, /data-comments="80" aria-label="comments\.title"><i>◌<\/i><small>0<\/small>/);
  assert.match(html, /data-repost="80" aria-label="post\.repost"><i>⟳<\/i><small>0<\/small>/);
  assert.doesNotMatch(html, /112|2\.4K|312 Following/);
});

  assert.doesNotMatch(html, /class="textTile"/);
  assert.match(css, /\.ownerWhisperBody\{[^}]*white-space:pre-line/);
  assert.match(css, /\.ownerWhisperList\[hidden\]\{display:none!important\}/);
});

test("profile content tabs switch the grid, the timeline and the empty states together", () => {
  const cards = [
    fakeNode({ profilePost: "79", profileKind: "text" }),
    fakeNode({ profilePost: "81", profileKind: "image" }),
    fakeNode({ profilePost: "82", profileKind: "video" }),
  ];
  const tabs = ["flow", "reels", "shots", "whispers"].map((kind) => fakeNode({ ownerContent: kind }));
  const emptyStates = ["flow", "reels", "shots", "whispers"].map((kind) => fakeNode({ ownerEmptyFor: kind }));
  const grid = fakeNode(), list = fakeNode(), stream = fakeNode();
  // The posts start in their own homes, the way the render puts them there: the media in the grid, the words
  // in the list. The Flow is then built by moving those same nodes, not by drawing them again.
  cards.forEach((card) => (card.dataset.profileKind === "text" ? list : grid).append(card));
  const host = profileHost({ cards, tabs, grid, list, stream, emptyStates });
  renderOwnerProfileExperience(host, { profile: owner, stories: [], posts: [] }, {
    esc: (value) => String(value ?? ""), safeUrl: () => "", t: (key) => key, locale: "ro-RO", now: NOW,
  });
  // Flow is one timeline: everything is shown, and the three posts are in the stream together while the two
  // homes they came from step aside - a clip and a whisper follow each other by time instead of by kind.
  assert.deepEqual(cards.map((card) => card.hidden), [false, false, false]);
  assert.equal(stream.hidden, false);
  assert.equal(stream.children.length, 3, "the stream carries the same three nodes");
  assert.equal(grid.children.length, 0, "the grid is empty while the flow reads the nodes");
  assert.equal(list.children.length, 0);
  assert.deepEqual(emptyStates.map((block) => block.hidden), [true, true, true, true]);
  const select = (kind) => tabs.find((tab) => tab.dataset.ownerContent === kind).handlers.click();
  select("reels");
  assert.deepEqual(cards.map((card) => card.hidden), [true, true, false]);
  assert.equal(stream.hidden, true);
  assert.equal(grid.hidden, false);
  assert.equal(list.hidden, true);
  assert.equal(stream.children.length, 0, "the clips went back to their own grid");
  assert.equal(grid.children.length, 2);
  select("whispers");
  assert.deepEqual(cards.map((card) => card.hidden), [false, true, true]);
  assert.equal(grid.hidden, true);
  assert.equal(list.hidden, false);
  assert.equal(list.children.length, 1);
});

test("the profile reuses the feed reaction palette and conversation drawer", () => {
  assert.equal((app.match(/function reactionPaletteMarkup\(post, currentReaction = null\)/g) || []).length, 1);
  assert.equal((app.match(/function commentsDrawerMarkup\(post\)/g) || []).length, 1);
  assert.equal((app.match(/reactionPaletteMarkup\(post, currentReaction\),/g) || []).length, 1);
  // One definition, two call sites: the feed card entry and the profile whisper control set.
  assert.match(app, /^    commentsDrawerMarkup\(post\),/m);
  assert.match(app, /    drawer: commentsDrawerMarkup\(post\),/);
  assert.match(app, /function profileWhisperControls\(post\) \{/);
  assert.match(app, /controls: \(post\) => profileWhisperControls\(post\),/);
  assert.match(app, /onRendered: \(renderedHost, renderedPosts\) => \{ wirePostActions\(renderedHost, renderedPosts\); profileHeroEditor\.bindHeroInlineEdit\(renderedHost\); profileHeroEditor\.bindHeroLocation\(renderedHost\); \},/);
  assert.match(app, /onTabLeave: \(\) => document\.querySelectorAll\("#profile-preview \.clipCommentsDrawer:not\(\.hidden\)"\)\.forEach/);
  assert.match(app, /class="comments clipCommentsDrawer hidden"[^>]+role="dialog"[^>]+aria-modal="true"/);
  // The reaction palette is a popover: it floats above its own button and stops being part of
  // the card's flow, so it can never push the next whisper off the screen.
  assert.match(css, /\.ownerWhisperCard \.reactionBar button\{min-width:0\}/);
  assert.doesNotMatch(css, /\.ownerWhisperCard \.reactionBar\{position:static/);
  assert.match(css, /\.ownerWhisperCard>\.comments\{position:relative/);
  assert.equal((locale.match(/"profile\.editShort":/g) || []).length, 4);
});

