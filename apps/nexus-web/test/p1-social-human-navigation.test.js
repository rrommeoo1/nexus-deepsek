import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideSocialGesture, decideViewerGesture } from "../public/social-gesture.js";
import { FEED_DESTINATIONS } from "../public/feed-surface.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");

test("Social supports explicit pull-to-refresh on real touch devices without duplicate refreshes", () => {
  assert.match(app, /addEventListener\("touchstart"/);
  assert.match(app, /addEventListener\("touchmove"/);
  assert.match(app, /addEventListener\("touchend"/);
  assert.match(app, /decideSocialGesture\(\{ dx, dy, scrollTop: container\.scrollTop \}\)/);
  assert.match(app, /screen\?\.dataset\.refreshing === "true"/);
  assert.match(app, /screen\.setAttribute\("aria-busy", "true"\)/);
  // Wave 14f: the pull refreshes the column, and the shelf of moments is not on this screen to be asked for
  // again - it is the Messages screen's tray now, with its own loader.
  assert.match(app, /await loadFeed\(container\)\.catch\(\(\) => \{\}\);/);
  assert.match(locale, /"feed\.pullRefresh"/);
  assert.match(locale, /"feed\.refreshing"/);
});

test("gesture decision distinguishes refresh, channel swipe and normal scrolling", () => {
  assert.deepEqual(decideSocialGesture({ dx: 4, dy: 80, scrollTop: 0 }), { action: "refresh" });
  assert.deepEqual(decideSocialGesture({ dx: 4, dy: 80, scrollTop: 2 }), { action: "none" });
  assert.deepEqual(decideSocialGesture({ dx: -90, dy: 8, scrollTop: 240 }), { action: "channel", offset: 1 });
  assert.deepEqual(decideSocialGesture({ dx: 90, dy: 8, scrollTop: 240 }), { action: "channel", offset: -1 });
  assert.deepEqual(decideSocialGesture({ dx: 30, dy: 45, scrollTop: 0 }), { action: "none" });
  assert.deepEqual(decideSocialGesture({ dx: Number.NaN, dy: 80, scrollTop: 0 }), { action: "none" });
});

test("fullscreen gesture decision treats all four deliberate directions as content continuity", () => {
  assert.deepEqual(decideViewerGesture({ dx: -60, dy: 5 }), { action: "step", axis: "horizontal", offset: 1 });
  assert.deepEqual(decideViewerGesture({ dx: 60, dy: 5 }), { action: "step", axis: "horizontal", offset: -1 });
  assert.deepEqual(decideViewerGesture({ dx: 5, dy: -60 }), { action: "step", axis: "vertical", offset: 1 });
  assert.deepEqual(decideViewerGesture({ dx: 5, dy: 60 }), { action: "step", axis: "vertical", offset: -1 });
  assert.deepEqual(decideViewerGesture({ dx: 20, dy: 22 }), { action: "none" });
  assert.deepEqual(decideViewerGesture({ dx: Number.NaN, dy: 90 }), { action: "none" });
});

test("header switchers are non-modal navigation surfaces and never disable Home or the header", () => {
  assert.match(app, /socialFeedSheet" role="region" aria-labelledby="socialFeedTitle"/);
  assert.match(app, /socialFriendsSheet" role="region" aria-labelledby="socialFriendsTitle"/);
  assert.match(app, /profileSwitcher" role="region" aria-labelledby="profileSwitcherTitle"/);
  assert.doesNotMatch(app, /socialFeedSheet" role="dialog" aria-modal="true"/);
  // Wave 14g: the door panel is gone with the doors. What replaced it is a small drawer of marks, and it
  // is a modal on purpose - it puts a backdrop over the screen it opens from, so the bar and the nav under
  // that backdrop are not live while it is open, and saying so is the honest thing to say.
  const hub = readFileSync(new URL("../public/feed-surface.js", import.meta.url), "utf8");
  assert.match(hub, /class="feedQuickDrawer" role="dialog" aria-modal="true" aria-label=/);
  assert.match(hub, /data-feed-quick-backdrop/);
  assert.equal(hub.includes('data-feed-door-panel'), false, "the four-door panel left the feed with the doors");
  assert.match(app, /feedHub = mountFeedHub\(\);/);
  assert.doesNotMatch(app, /socialFeedSheet" role="dialog"/);
  assert.match(app, /function navigate\(slot\) \{\s+if \(requestActiveCameraExit\(\)\) return;\s+if \(composerExit\?\.request\(\(\) => navigate\(slot\)\)\) return;\s+feedHub\?\.close\(\);\s+closeSocialFeedSwitcher\(\);\s+closeSocialFriendsSwitcher\(\);\s+closeProfileSwitcher\(\)/);
  assert.match(app, /if \(slot === "primary"\) \{ goHome\(\); return; \}/);
});

test("Social navigation has one home target, four destinations, three readings on the swipe", () => {
  assert.match(app, /document\.getElementById\("wordmark"\)\.addEventListener\("click", goHome\)/);
  // Wave 14e: the four channels are still the destinations of the feed - they are rows of the source panel
  // - but a horizontal swipe walks the three readings, in the order the rail prints them.
  assert.deepEqual(FEED_DESTINATIONS.map((row) => row[0]).slice(0, 4), ["for-you", "local", "global", "following"]);
  assert.match(app, /activateFeedMode\(nextFeedMode\(feedMode, decision\.offset\)\)/);
  assert.doesNotMatch(app, /const channels = \[/);
  assert.match(app, /data-viewer-back/);
  assert.match(app, /decideViewerGesture\(\{ dx, dy \}\)/);
  assert.match(app, /viewer\.addEventListener\("touchstart"/);
  assert.doesNotMatch(app, /wa\.me|t\.me\/share|fb-messenger:|viber:|facebook\.com\/sharer|x\.com\/intent/);
});

test("the bottom bar is the owner's marks with Home in front of them, icons only, and every one is a door", () => {
  // G1: Change/menu was the duplicate second mark the owner removed. The remaining seven marks are
  // destinations; the header keeps the module drawer, and the last mark shows the reader's own picture.
  const marks = readFileSync(new URL("../public/nav-marks.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/social-human-ux.css", import.meta.url), "utf8");
  assert.equal(app.includes('import { NAV_LABEL_KEYS, navFaceMarkup, navIconMarkup } from "./nav-marks.js?v=20260923-wave14i";'), true, "the bar's marks are their own module");
  assert.equal(app.includes('social: [["primary","⌂","Acasă"],["inbox","◌","Mesaje"],["search","⌕","Căutare"],'), true, "the Social bar starts Home, Messages, Search");
  assert.equal(app.includes('social: [["primary","⌂","Acasă"],["menu"'), false, "the duplicate Change mark is gone");
  assert.equal(app.includes('if (slot === "primary") { goHome(); return; }'), true, "and it is the same door the wordmark is");
  for (const slot of ["search", "friends"]) {
    assert.match(marks, new RegExp(slot + ": '<"), slot + " is drawn");
  }
  assert.equal(marks.includes('Object.freeze({ menu: "header.changeProfile", search: "search.title", friends: "header.friends" })'), true, "the three names are keys the app already carries");
  assert.equal(locale.includes('"nav.menu"'), false, "no new copy was written for the bar");
  assert.match(marks, /if \(slot !== "account" \|\| !persona\?\.avatar\) return navIconMarkup\(slot, icon\);/);
  assert.match(marks, /style="width:100%;height:100%;object-fit:cover;border-radius:50%"/);
  assert.equal(app.includes("const mark = navFaceMarkup({ esc, persona, slot, icon });"), true, "the last mark is the reader");
  assert.equal(app.includes('const label = NAV_LABEL_KEYS[slot] ? t(NAV_LABEL_KEYS[slot]) : state.persona === "social" ? t("nav." + slot) : fallbackLabel;'), true, "a name is a key the app has");
  assert.equal(app.includes('if (b.dataset.slot === "friends") { openSocialFriendsSwitcher(); return; }'), true, "the relations are the sheet the header already opens");
  assert.equal(app.includes('else if (slot === "search" && state.persona === "social") { activeModule = "clips"; socialTopView = "search"; renderHeader(); renderView(); }'), true, "the search mark opens the search screen");
  // Icons only, and 26px shorter: the reading gets the room back, and the name an icon used to print under
  // itself is still read out, because it is the button's own `aria-label`.
  assert.match(css, /\.appNav button span\{display:none!important\}/);
  assert.match(css, /:root\{--nav-h:60px\}/);
  assert.match(css, /\.appNav\{height:60px!important;padding:4px 7px max\(6px,env\(safe-area-inset-bottom\)\)!important\}/);
  assert.match(css, /\.appNav button\.createNav i\{width:52px!important;min-width:52px!important;height:52px!important;min-height:52px!important;font-size:27px!important\}/);
  assert.match(css, /\.screenViewport\{height:calc\(100% - 132px\)!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.inboxScreen\) \.screenViewport,\.phoneScreen:has\(\.accountScreen\) \.screenViewport\{height:calc\(100% - var\(--nav-h,86px\)\)!important\}/);
});

test("the main logo prints the version of the deployed build", () => {
  const css = readFileSync(new URL("../public/feed-surface.css", import.meta.url), "utf8");
  // The owner's rule (2 octombrie 2026): every deploy stamps its version on the main logo, starting at 1.01.
  // The badge is decorative for assistive tech - the logo button keeps its own home label - but it is visible.
  const version = (app.match(/const NEXUS_BUILD_VERSION = "([0-9]+\.[0-9]+)";/) || [])[1];
  // The number itself changes on every deploy (the owner's rule), so the test pins the shape of the series and
  // its starting point, not one build's number.
  assert.match(version || "", /^[0-9]+\.[0-9]+$/, "the build version is a plain major.minor");
  assert.notEqual(version, "1.00", "the series starts at 1.01");
  assert.match(app, /<i class="wordmarkBuild" aria-hidden="true">' \+ NEXUS_BUILD_VERSION/);
  assert.match(css, /\.wordmark \.wordmarkBuild\{[^}]*position:absolute/);
});

