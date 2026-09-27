// Wave 12 (P8): the five content tabs became icons the owner can rearrange, every tab reads its archive three
// ways, a clip says how many people watched it and can be pinned to the top, and the Flow is one timeline
// where the media and the whispers follow each other by time instead of standing in two lists.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileCompactCount, profileTabOrder, postOrderAttributes, profileContentBuckets } from "../public/profile-experience.js";

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const profileJs = read("profile-experience.js");
const css = read("profile-experience.css");
const locale = read("interface-locale.js");
const app = read("app.js");
const repository = readFileSync(new URL("../lib/repo.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const database = readFileSync(new URL("../lib/db.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("the tab bar is five icons, and the name of a tab is read, not printed", () => {
  // Five words on one row spent the row on a fact the glyphs already say. The word is still there for whoever
  // reads the page with a screen reader or a tooltip: it is the accessible name of the button.
  const bar = profileJs.slice(profileJs.indexOf("'<nav class=\"ownerContentTabs\""), profileJs.indexOf("'<div class=\"ownerContentFilters\""));
  assert.equal(bar.includes("\"><i aria-hidden=\"true\">' + CONTENT_TAB_GLYPHS[kind] + '</i></button>'"), true, "the icon is the whole content of a tab");
  assert.match(bar, /aria-label="' \+ esc\(tabLabel\(kind\)\) \+ '"/);
  assert.match(bar, /title="' \+ esc\(tabLabel\(kind\)\)/);
  const glyphs = profileJs.match(/CONTENT_TAB_GLYPHS = Object\.freeze\(\{([^}]*)\}\)/);
  assert.ok(glyphs, "each tab has a glyph of its own");
  for (const kind of ["flow", "reels", "shots", "whispers", "moments"]) {
    assert.equal(glyphs[1].includes(kind + ":"), true, kind + " is on the bar");
  }
  assert.match(css, /\.ownerContentTabs button i\{font-style:normal;font-size:17px/);
});

test("the order of the tabs belongs to the profile, and a saved order can neither hide nor invent a tab", () => {
  assert.deepEqual(profileTabOrder(["whispers", "flow"]), ["whispers", "flow", "reels", "shots", "moments"]);
  assert.deepEqual(profileTabOrder("whispers,whispers,instagram"), ["whispers", "flow", "reels", "shots", "moments"]);
  assert.deepEqual(profileTabOrder(null), ["flow", "reels", "shots", "whispers", "moments"]);
  assert.deepEqual(profileTabOrder("moments,shots"), ["moments", "shots", "flow", "reels", "whispers"]);
  // The render reads the order off the profile, so the bar a reader sees is the bar the owner arranged.
  assert.match(profileJs, /const tabOrder = profileTabOrder\(profile\.tabs_order\);/);
  assert.match(profileJs, /tabOrder\.map\(\(kind, index\) =>/);
  assert.match(app, /onTabsOrder: async \(order\) => \{/);
  assert.match(app, /body: \{ tabs_order: order \}/);
  assert.match(api, /tabs_order: normaliseTabsOrder\(profile\.tabs_order\),/);
  assert.match(database, /tabs_order: "tabs_order TEXT NOT NULL DEFAULT ''",/);
  assert.match(repository, /export function normaliseTabsOrder\(value\) \{/);
});

test("a tab says how it is read, and the three ways are one arrow away", () => {
  assert.match(profileJs, /CONTENT_FILTERS = Object\.freeze\(\['newest', 'popular', 'relevant'\]\)/);
  // Nothing about the readings is on screen until it is asked for: the bar ends in one arrow, the arrow opens
  // the list, and the list says which reading is on.
  assert.match(profileJs, /'<button type="button" class="ownerFiltersToggle" data-owner-filters-toggle aria-expanded="false" aria-controls="owner-content-filters"/);
  assert.match(profileJs, /filtersToggle\?\.addEventListener\('click', \(event\) => \{/);
  assert.match(profileJs, /if \(!filtersRow\.hidden && filtersRow\.dataset\.ownerFiltersFor === currentTab\) closeFilters\(\);/);
  assert.match(profileJs, /filtersToggle\.setAttribute\('aria-expanded', 'true'\);/);
  assert.match(profileJs, /filtersToggle\.hidden = kind === 'moments';/);
  assert.match(profileJs, /const label = tr\('profile\.filtersToggle'\) \+ ': ' \+ readingLabel\(reading, tr\);/);
  // Choosing a tab is choosing a tab: the readings stay behind the arrow they belong to.
  assert.match(profileJs, /\/\/ Choosing a tab is choosing a tab: the readings stay behind the arrow they belong to\.\n    closeFilters\(\);/);
  // The order is decided by the numbers written on the nodes, not by re-reading the payload: the day it was
  // written, what it was answered with, and what this reader's own signals say about it.
  assert.match(profileJs, /const byNewest = \(a, b\) => orderNumber\(b, 'profileStamp'\) - orderNumber\(a, 'profileStamp'\);/);
  assert.match(profileJs, /const byPopular = \(a, b\) => orderNumber\(b, 'profileScore'\) - orderNumber\(a, 'profileScore'\) \|\| byNewest\(a, b\);/);
  assert.match(profileJs, /const byRelevant = \(a, b\) => orderNumber\(b, 'profileRank'\) - orderNumber\(a, 'profileRank'\) \|\| byPopular\(a, b\);/);
  const score = postOrderAttributes({ reactions: { counts: { LIKE: 3, LOVE: 2 } }, comment_count: 4, view_stats: { viewers: 10 } }, 1700000000);
  assert.equal(score.includes('data-profile-score="19"'), true, "reactions, comments and viewers together");
  assert.equal(score.includes('data-profile-stamp="1700000000"'), true);
  assert.equal(score.includes('data-profile-pin="0"'), true);
  const ranked = postOrderAttributes({ ranking: { reasons: ["FOLLOWING", "TOPIC"] } }, 5);
  assert.equal(ranked.includes('data-profile-rank="2"'), true);
  assert.equal(postOrderAttributes({}, "nonsense").includes('data-profile-stamp="0"'), true, "a stamp the record does not carry is zero");
  // And the arrow opens only readings that exist: the shelf of saved stories has none of its own.
  assert.match(profileJs, /if \(!filtersRow \|\| !filtersToggle \|\| kind === 'moments'\) return;/);
  // Each icon keeps its own reading, so opening the tab again shows the reading that tab is on.
  assert.match(profileJs, /readings\.set\(kind, button\.dataset\.ownerFilter\);/);
  assert.match(profileJs, /const readingOf = \(kind\) => \(kind === 'moments' \? CONTENT_FILTERS\[0\] : readings\.get\(kind\) \|\| CONTENT_FILTERS\[0\]\);/);
  for (const key of ["profile.filters", "profile.filtersToggle", "profile.filterNewest", "profile.filterPopular", "profile.filterRelevant"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  // The list is anchored to the arrow and never runs off the screen; the icon marks a reading that is not the
  // default, and the arrow turns teal for one.
  assert.match(css, /\.ownerTabsRegion\{position:relative;display:flex;align-items:center\}/);
  assert.match(css, /\.ownerFiltersToggle\{flex:0 0 44px/);
  assert.match(css, /\.ownerFiltersToggle\[aria-expanded="true"\],\.ownerFiltersToggle\[data-reading="popular"\]/);
  assert.match(css, /\.ownerContentFilters\{position:absolute;z-index:6;top:100%;left:var\(--filters-left,8px\)/);
  assert.match(profileJs, /filtersRow\.style\.setProperty\('--filters-left', Math\.round\(left\) \+ 'px'\);/);
  assert.match(profileJs, /button\.dataset\.reading = filter;/);
  assert.match(css, /\.ownerContentTabs button\[data-reading="popular"\]::after,\.ownerContentTabs button\[data-reading="relevant"\]::after\{content:''/);
  assert.match(css, /\.ownerContentFilters button\[aria-pressed="true"\]\{border-color:#2fbdb3/);
});

test("a tab is moved by holding it, because a finger that moves first is scrolling", () => {
  // The bug the owner found: the drag was armed on pointerdown, the page took the gesture for a scroll and
  // cancelled the pointer, so nothing ever moved. The fix is a hold before the move - and a page that stops
  // scrolling only once the tab is in the hand.
  assert.match(profileJs, /const HOLD_MS = 320;/);
  assert.match(profileJs, /const SLOP_PX = 12;/);
  assert.match(profileJs, /holdTimer = setTimeout\(\(\) => \{ holdTimer = null; pickUp\(button, event\.pointerId\); \}, HOLD_MS\);/);
  assert.match(profileJs, /if \(Math\.hypot\(event\.clientX - startX, event\.clientY - startY\) > SLOP_PX\) stopHold\(\);/);
  assert.match(profileJs, /tabBar\.addEventListener\('touchmove', \(event\) => \{ if \(dragging\) event\.preventDefault\(\); \}, \{ passive: false \}\);/);
  assert.match(profileJs, /try \{ button\.setPointerCapture\(pointerId\); \}/);
  // A held tab lifts, and the bar says that this is a move and no longer a page.
  assert.match(css, /\.ownerContentTabs button\.isLifted\{z-index:7;transform:scale\(1\.18\)/);
  assert.match(css, /\.ownerContentTabs\.isArranging\{user-select:none;touch-action:none\}/);
  // One gesture never does two things: the click a finger leaves behind after a move is ignored, and an order
  // that did not change is not written.
  assert.match(profileJs, /if \(Date\.now\(\) - arrangedAt < 700\) return;/);
  assert.match(profileJs, /const moved = orderOf\(\)\.join\(','\) !== orderAtPick;/);
  assert.match(profileJs, /if \(moved\) saveOrder\(\);/);
  // A pointer the browser cancels after the tab was already picked up is dropped as a move, not abandoned:
  // the order on the screen is the order that gets saved.
  assert.match(profileJs, /button\.addEventListener\('pointercancel', \(\) => \{ stopHold\(\); if \(dragging\) drop\(\); \}\);/);
});

test("a clip says what it is and how many people watched it, and the count is a sentence", () => {
  // The play sign and the count sit together in the bottom left corner of the tile, where a thumb looks first.
  assert.match(profileJs, /'<i class="profileTilePlay" aria-hidden="true">▶<\/i>'/);
  assert.match(profileJs, /'<small class="profileTileViews" aria-label="' \+ esc\(profileCompactCount\(views, locale\) \+ ' ' \+ tr\('profile\.views'\)\)/);
  assert.match(profileJs, /const views = Math\.max\(0, Number\(post\.view_stats\?\.viewers \|\| 0\)\);/);
  // A photo has neither a play sign nor a count: a still picture was not watched.
  assert.match(profileJs, /const corner = kind === 'video'/);
  assert.match(css, /\.profileTilePlay,\.profileTileViews\{position:absolute;bottom:7px/);
  assert.match(css, /\.profileTilePlay\{left:7px/);
  assert.match(css, /\.profileTileViews\{left:37px/);
  // 1.2K is a fact a reader can take in; the full number is still read out as the accessible name.
  assert.equal(profileCompactCount(0, "ro-RO"), "0");
  assert.equal(profileCompactCount(999, "ro-RO"), "999");
  assert.equal(profileCompactCount(1234, "ro-RO"), new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 }).format(1234));
  assert.equal(profileCompactCount(-5, "ro-RO"), "0");
  assert.equal((locale.match(/"profile\.views":/g) || []).length, 4);
});

test("pinning is the owner's, three at a time, and a pinned clip is read first on the media tabs", () => {
  // A button inside a button is not a button: the tile is a wrapper, the button opens the post, the pin sits
  // beside it as a control of its own - and only the owner's rendering draws it at all.
  assert.match(profileJs, /const pinControl = isSelf/);
  assert.match(profileJs, /'<button type="button" class="profileTilePin" data-pin-post="' \+ id \+ '" aria-pressed="' \+ \(pinnedAt > 0\)/);
  assert.match(profileJs, /class="profileTileOpen" data-profile-post=/);
  assert.match(profileJs, /\+ pinControl\n      \+ '<\/div>';/);
  assert.match(css, /\.profileTilePin\[aria-pressed="true"\]\{border-color:#2fbdb3/);
  assert.match(css, /\.profileTile\.isPinnedFirst\{outline:1px solid #2fbdb3/);
  // Three pins is the allowance and the server decides it: the interface borrows the refusal and says it.
  assert.match(repository, /const PINNED_POST_LIMIT = 3;/);
  assert.match(repository, /if \(pinnedCount >= PINNED_POST_LIMIT\) return \{ error: "pin_limit" \};/);
  assert.equal(api.includes("const postPinMatch = path.match(/^\\/api\\/posts\\/(\\d+)\\/pin$/);"), true, "the pin is its own route");
  assert.match(api, /if \(result\.error === "pin_limit"\) return json\(res, 409, \{ ok: false, code: "PIN_LIMIT"/);
  assert.match(database, /pinned_at: "pinned_at INTEGER",/);
  assert.match(app, /onPinPost: async \(postId, pinned\) => \{/);
  assert.match(app, /headers: \{ "Idempotency-Key": newUploadMutationKey\("post-pin"\) \}, body: \{ pinned \}/);
  // Pinned first on the tabs that read as a collection of clips, and only there: a timeline that jumps is not
  // a timeline, so the Flow stays chronological and a pin is a mark on the post there.
  assert.match(profileJs, /const hoistPins = kind === 'reels' \|\| kind === 'shots';/);
  assert.match(profileJs, /const ordered = items\.filter\(\(node\) => !node\.hidden\)\.sort\(hoistPins \? byPinnedThen\(sorter\) : sorter\);/);
  assert.match(profileJs, /if \(pinA > 0 && pinB > 0 && pinA !== pinB\) return pinA - pinB;/);
  for (const key of ["profile.pinAction", "profile.unpinAction", "profile.pinnedSaved", "profile.unpinnedSaved", "profile.pinLimit", "profile.pinFailed"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
});

test("the Flow is one timeline: the media and the whispers follow each other by the time they were written", () => {
  // The stream is where the nodes leave their homes, and the stylesheet weaves them: rows of three for the
  // media, the whole width for a whisper card, both in the order they were appended.
  assert.match(profileJs, /'<div class="ownerFlowStream" data-owner-flow-stream hidden><\/div>'/);
  assert.match(profileJs, /if \(stream\) items\.slice\(\)\.sort\(byNewest\)\.forEach\(\(node\) => stream\.append\(node\)\);/);
  assert.match(profileJs, /items\.forEach\(\(node\) => homeOf\.get\(node\)\?\.append\(node\)\);/);
  assert.match(profileJs, /if \(stream\) stream\.hidden = kind !== 'flow';/);
  assert.match(css, /\.ownerFlowStream\{display:grid;grid-template-columns:repeat\(3,1fr\);gap:2px;background:#060b11\}/);
  assert.match(css, /\.ownerFlowStream>\.ownerWhisperCard\{grid-column:1\/-1;margin:6px 10px\}/);
  // Every post is one node that says what it is, and the same bucket rule still decides media from words.
  assert.match(profileJs, /data-owner-post-item="' \+ id \+ '" data-profile-kind="' \+ kind \+ '"/);
  assert.match(profileJs, /ownerWhisperCard" data-owner-post-item="' \+ id \+ '" data-profile-post=/);
  const buckets = profileContentBuckets([
    { id: 1, media: { kind: "video" }, created_at: 100 },
    { id: 2, created_at: 200 },
    { id: 3, media: { kind: "image" }, created_at: 300 },
  ]);
  assert.deepEqual(buckets.tiles.map((post) => post.id), [3, 1]);
  assert.deepEqual(buckets.whispers.map((post) => post.id), [2]);
});
