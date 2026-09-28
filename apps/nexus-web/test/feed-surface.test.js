// Wave 14: the feed surface. The three modes are pinned by feed-news-tab.test.js; this file pins the
// parts a reader touches - the header bar, the shelf, the whisper card, the states, the end of the
// list - and, above all, that no control here is a drawing: every one of them ends in a request or a
// screen the application already had.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEED_MODES, FEED_MODE_CONTRACT, nextFeedMode, feedModeSwitchMarkup,
  feedQuickDrawerMarkup, feedQuickTilesMarkup,
  feedSkeletonMarkup, feedEmptyMarkup, feedErrorMarkup,
  feedMoreMarkup, feedStoryRailMarkup, whisperCardMarkup, feedAudioMarkup, bindFeedAudio,
} from "../public/feed-surface.js";

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const app = read("app.js");
// Wave 14i: the clip's own options panel is pinned beside the bar here, because the mark that opens it moved
// from a gear over the clip to a row of the clip's menu, and both files have to agree about that.
const clipOptions = read("clip-options.js");
// Wave 14d: the feed's surface is two modules. feed-surface.js paints the bar and the drawer of the one
// door and holds the rail of readings; feed-hub.js decides what the drawer holds. Wave 14f moved the
// shelf of moments to the Messages screen and the rail of readings onto the bar, and wave 14g put the
// reel under a floating bar, left one door on it and moved the creator's mark up the reel's rail.
const feedSurface = read("feed-surface.js");
const feedHub = read("feed-hub.js");
const shell = read("messenger-shell.js");
const css = read("feed-surface.css");
const humanUx = read("social-human-ux.css");
const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t = (key) => key;
const stamp = (seconds) => (seconds ? seconds + "s ago" : "");

test("the bar is the compact Nexus logo and current reading while the bottom bar owns the drawer", () => {
  // Wave 14i: the owner corrected the mark that left in wave 14h. The screen-with-an-arrow beside the rail
  // was not the mark he wanted gone - the gear drawn over a reel was - so the door is back on the right of
  // the bar, drawn as a screen with an arrow leaving it, and the `menu` mark of the bottom bar opens the
  // same drawer: one listener, `bindFeedHub`, answers for both.
  assert.equal(feedSurface.includes("export function feedHeaderActionsMarkup"), true, "the bar draws its door");
  assert.equal(feedSurface.includes("FEED_ICONS.modules"), true, "and it keeps the mark of the drawer");
  assert.equal(app.includes('onFeed ? feedHeaderActionsMarkup({ t, esc }) : ""'), true, "the first reel prints the right-side module drawer button");
  assert.equal(feedSurface.includes('id="feedModules" type="button" data-feed-quick-open aria-haspopup="dialog" aria-expanded="false"'), true, "the button carries the hook the drawer listens for");
  assert.equal(app.includes("clipExpand"), false, "the frame over the reel is still gone");
  const bottomBar = app.slice(app.indexOf("function renderNav"), app.indexOf("function renderInfoPanel"));
  assert.match(bottomBar, /slot === "menu" \? ' data-feed-quick-open aria-haspopup="dialog" aria-expanded="false"' : ""/);
  assert.match(bottomBar, /if \(b\.dataset\.slot === "menu"\) return;/);
  assert.match(bottomBar, /if \(b\.dataset\.slot === "friends"\) \{ openSocialFriendsSwitcher\(\); return; \}/);
  // The drawer is the small one the owner asked for: marks only, no words in it - and every mark still says
  // what it is, from the labels the app already carries, so a drawer without text is still a drawer a
  // screen reader can use and no new copy was written for it.
  const drawer = feedQuickDrawerMarkup({ t, esc });
  const tiles = feedQuickTilesMarkup({ esc, modules: [{ id: "work", glyph: "▣", title: "Work", color: "#36afff", active: false }, { id: "dating", glyph: "♥", title: "Dating", color: "#ff4e83", active: true }] });
  assert.match(drawer, /class="feedQuickLayer" data-feed-quick-layer hidden/);
  assert.match(drawer, /data-feed-quick-backdrop/);
  assert.match(drawer, /role="dialog" aria-modal="true" aria-label="header\.changeProfile" tabindex="-1" data-feed-quick-drawer/);
  assert.match(drawer, /data-feed-quick-grid/);
  assert.match(drawer, /data-feed-quick-close aria-label="common\.close" title="common\.close"/);
  assert.match(drawer, /data-feed-quick-logout aria-label="x\.profile\.logout" title="x\.profile\.logout"><svg viewBox="0 0 24 24"/);
  assert.equal(/<span|<b>|<small/.test(drawer + tiles), false, "no word is printed in the drawer");
  assert.match(tiles, /data-feed-quick-module="work"[^>]*aria-label="Work" title="Work"[^>]*aria-pressed="false"/);
  assert.match(tiles, /data-feed-quick-module="dating" class="active"[^>]*--profile-color:#ff4e83[^>]*aria-pressed="true"/);
  // The tiles are rebuilt on every open, from the state at that moment, so the marked tile is never stale.
  assert.match(feedSurface, /if \(build\) grid\.innerHTML = build\(\);/);
  // The drawer answers for its own presses: the button, a tile, the way out, Esc, a tap beside it, and the
  // focus back on the button that opened it.
  assert.match(feedSurface, /mount\.addEventListener\("click", \(event\) => \{/);
  assert.match(feedSurface, /const opener = target\.closest\("\[data-feed-quick-open\]"\)/);
  assert.match(feedSurface, /if \(tile\) \{ close\(\); onModule\?\.\(tile\.dataset\.feedQuickModule\); return; \}/);
  assert.match(feedSurface, /if \(target\.closest\("\[data-feed-quick-logout\]"\)\) \{ close\(\); onLogout\?\.\(\); \}/);
  assert.match(feedSurface, /if \(target === layer \|\| target\.closest\("\[data-feed-quick-backdrop\], \[data-feed-quick-close\]"\)\) \{ close\(\); return; \}/);
  assert.match(feedSurface, /modules: '<svg[^']*<rect x="3" y="4" width="12" height="9"[^']*M19 7h-3/);
  assert.match(feedSurface, /logout: '<svg[^']*<path d="M12 3v9"/);
  assert.match(feedSurface, /if \(event\.key !== "Escape" \|\| layer\.hidden\) return;/);
  assert.match(feedSurface, /openedBy\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(feedSurface, /button\.setAttribute\("aria-expanded", String\(!layer\.hidden && button === opener\)\)/);
  // It is mounted with the shell and fed by the app: the module switch that already existed, and the one
  // action here that ends a session.
  assert.match(app, /function mountFeedHub\(\)/);
  assert.match(app, /feedHub = mountFeedHub\(\);/);
  assert.match(app, /feedHub\.mount\(document\.querySelector\("\.phoneScreen"\)\)/);
  assert.match(app, /module: switchPersona, logout: logoutFromProfile/);
  assert.match(feedHub, /build: \(\) => feedQuickTilesMarkup\(\{ esc, modules: modules\(\) \}\)/);
  assert.match(feedHub, /onModule: \(id\) => \{ void ctx\.module\(id\); \}/);
  assert.match(feedHub, /onLogout: \(\) => ctx\.logout\(\)/);
  assert.match(feedHub, /const PERSONA_MARKS = Object\.freeze\(\{ social: "▶", work: "▣" \}\)/);
  assert.match(feedHub, /glyph: PERSONA_MARKS\[profile\[0\]\] \|\| profile\[3\]/);
  assert.match(feedHub, /screen\.insertAdjacentHTML\("beforeend", feedQuickDrawerMarkup\(\{ t, esc \}\)\)/);
  // The bar wears the tint of the reading it prints, because the tint lives on the bar as well as on the
  // screen: the bar is not a child of the screen it belongs to.
  assert.match(app, /'<header class="appHeader' \+ \(onFeed \? " feedHeader feedMode-" \+ feedMode : ""\) \+ '">'/);
  // The profile drawer keeps the ids it always had and still ends in the sign-out: it is the sheet the
  // persona plate opens on the screens that are not the feed.
  assert.match(app, /document\.getElementById\("modeBadge"\)\.addEventListener\("click", openProfileSwitcher\)/);
  assert.match(app, /feedDrawerEndMarkup\(\{ t, esc \}\)/);
  assert.match(app, /dialog\.querySelector\("\[data-profile-logout\]"\)\?\.addEventListener\("click", \(\) => \{ close\(\); void logoutFromProfile\(\); \}\)/);
  // The two plates of the old bar are not printed twice on the feed.
  assert.match(app, /onFeed \? "" : '<button class="modeBadge feedBadge" id="feedBadge"/);
  assert.match(app, /onFeed \? "" : '<button class="modeBadge friendsBadge" id="friendsBadge"/);
  // The profile screen still draws no app header of its own.
  assert.match(app, /if \(activeSlot === "account"\) \{/);
});

test("every mode waits in its own shape, and a state always offers a way forward", () => {
  for (const mode of Object.keys(FEED_MODE_CONTRACT)) {
    const skeleton = feedSkeletonMarkup({ mode, t, esc });
    assert.match(skeleton, /data-feed-skeleton/);
    assert.match(skeleton, /feed\.loading/);
    const shapes = ["feedSkeletonReel", "feedSkeletonWhisper", "feedSkeletonNews"].filter((shape) => skeleton.includes(shape));
    assert.deepEqual(shapes, [{ reels: "feedSkeletonReel", whispers: "feedSkeletonWhisper", news: "feedSkeletonNews" }[mode]], mode + " waits in its own shape");
    assert.equal(skeleton.split("feedSkeletonCard").length - 1, 3, mode + " waits in three cards");
  }
  assert.match(feedEmptyMarkup({ mode: "whispers", t, esc }), /data-feed-state="empty"/);
  assert.match(feedEmptyMarkup({ mode: "whispers", t, esc }), /feed\.empty/);
  assert.match(feedEmptyMarkup({ mode: "news", t, esc }), /feed\.breakingEmpty/);
  assert.match(feedEmptyMarkup({ mode: "reels", t, esc }), /data-feed-refresh/);
  const failure = feedErrorMarkup({ mode: "reels", t, esc });
  assert.match(failure, /role="alert"/);
  assert.match(failure, /data-feed-retry/);
  assert.match(failure, /feed\.unavailable/);
  // The feed draws the skeleton before it asks, and a failed answer keeps a retry that re-asks.
  assert.match(app, /container\.innerHTML = feedSkeletonMarkup\(\{ mode: requestedMode, t, esc, count: 3 \}\)/);
  assert.match(app, /container\.setAttribute\("aria-busy", "true"\)/);
  assert.match(app, /container\.innerHTML = feedErrorMarkup\(\{ mode: requestedMode, t, esc \}\)/);
  assert.match(app, /function wireFeedStateActions\(container\)/);
  assert.match(app, /void loadFeed\(container\)/);
});

test("the shelf is one card per moment, and every card has a picture to show", () => {
  const rail = feedStoryRailMarkup({
    stories: [
      { id: 7, author: { handle: "anna", display_name: "Anna" }, media: { kind: "image", hash: "a".repeat(64), ext: "jpg" }, viewed_by_me: false },
      { id: -7202, author: { handle: "aria.motion", display_name: "Aria Motion" }, media: { kind: "image", src: "/demo-stories/story-city.svg" }, viewed_by_me: true },
    ],
    owner: { display_name: "Romeo", avatar: "/media/avatar.jpg" },
    t, esc, mediaUrl: (story) => "/media/" + story.media.hash + "." + story.media.ext,
  });
  assert.match(rail, /<button id="addStory" class="storyCard feedStoryCard feedStoryOwn" type="button" aria-label="feed\.yourStory">/);
  assert.match(rail, /<img src="\/media\/avatar\.jpg"/);
  assert.match(rail, /class="storyAddBadge"/);
  assert.match(rail, /data-story="7"/);
  assert.match(rail, /class="storyPrism a0"/);
  assert.match(rail, /class="storyName" dir="auto">Anna</);
  assert.match(rail, /storyUnseen/);
  assert.match(rail, /storyViewed/);
  // A real moment asks for its own thumbnail; a generated one draws the artwork it carries, from the
  // same origin, so the rail never shows an empty frame or a broken-picture glyph.
  assert.match(rail, /<img src="\/media\/a{64}\.jpg"/);
  assert.match(rail, /<img src="\/demo-stories\/story-city\.svg"/);
  assert.equal(rail.includes("undefined"), false);
  // The rail keeps the hooks the viewer and the camera already answer to.
  assert.match(app, /document\.getElementById\("addStory"\)\.addEventListener\("click", \(\) => openComposer\("story", \{ camera: true, source: "story_camera" \}\)\)/);
  assert.match(app, /container\.querySelectorAll\("\[data-story\]"\)\.forEach\(\(button\) => button\.addEventListener\("click", \(\) => handleStoryPeek\(button\)\)\)/);
  assert.match(app, /bindStoryImages\(container\)/);
  // The five generated moments carry first-party artwork, not a hash this instance may not hold. They
  // live in feed-surface.js with the shelf they fill (wave 14d moved them there).
  for (const file of ["story-cove.svg", "story-city.svg", "story-mountain.svg", "story-island.svg", "story-road.svg"]) {
    assert.equal(feedSurface.includes('"/demo-stories/' + file + '"'), true, file);
  }
  assert.match(app, /demoHumanExperienceStories\(\)/);
  // Wave 14d, measured on the live page: the card was 98x150 with the picture 98x126 at its top, so the
  // accent ring sat on the card and framed 22px of empty space under the photo, while the reader's own
  // card framed the photo itself. The ring belongs to the picture, and a shadow draws it without taking
  // a single pixel from the photo the way a border would.
  // Wave 14f: the same approved cards, drawn in the tray the Messages screen prints - so the rules that
  // describe them name `inboxScreen`, the screen they are on now.
  assert.match(css, /\.inboxScreen \.stories \.storyUnseen\{border:0!important;box-shadow:none!important\}/);
  assert.match(css, /\.inboxScreen \.stories \.storyUnseen \.storyPrism\{box-shadow:0 0 0 2px rgba\(36,240,210,\.85\)/);
  assert.match(css, /\.inboxScreen \.stories \.storyViewed \.storyPrism\{box-shadow:0 0 0 2px rgba\(135,183,220,\.16\)/);
  assert.match(css, /\.inboxScreen \.stories \.feedStoryCard:not\(\.feedStoryOwn\)\{height:auto!important/);
  assert.doesNotMatch(css, /\.storyUnseen\{border:2px/);
  assert.match(css, /\.inboxScreen \.stories \.storyInitials\{position:absolute/);
  // Wave 14c, measured on the live page and not read off the file: styles.css still carries an older
  // round-avatar pass whose `b`, `img` and `video` selectors inside a prism also match this card's name,
  // its initials and its plus, so the shelf painted a 98x126 ellipse with an 18px name over the artwork.
  // The surface is read last and names the shape it wants, so a card stays a rounded rectangle.
  assert.match(css, /\.inboxScreen \.stories \.storyName\{[^}]*font-size:11px!important[^}]*border-radius:0!important\}/);
  assert.match(css, /\.inboxScreen \.stories \.storyInitials\{[^}]*font-size:19px!important[^}]*border-radius:0!important\}/);
  assert.match(css, /\.inboxScreen \.stories \.storyPrism img,\.inboxScreen \.stories \.storyPrism video\{[^}]*border-radius:inherit!important;clip-path:none!important\}/);
  assert.match(css, /\.inboxScreen \.stories \.storyAddBadge\{width:26px!important;height:26px!important/);
  assert.match(css, /\.inboxScreen \.stories \.createPrism>b:after\{content:none!important/);
});

test("the bar is one row a thumb can hit: the logo, the rail and the one drawer", () => {
  // Wave 14d, and this is the part that had to be measured rather than read: styles.css carries a later
  // `!important` `.headerSwitches{display:grid}` rule, so the feed's `display:contents` never applied and
  // an empty, zero-height switch box stayed in the bar. On the live page that box took 49px of the 390px
  // bar away from the search field (79px, of which 31px of text: "Sea…"). The rule wins now, and the field
  // takes every pixel the logo and the doors leave it.
  assert.match(css, /\.appHeader\.feedHeader \.headerSwitches\{display:contents!important;flex:0 0 auto!important;min-width:0!important;grid-template-columns:none!important;gap:0!important\}/);
  // The logo stays compact beside the one dynamic mode glyph.
  assert.match(css, /\.appHeader\.feedHeader \.wordmark\{flex:0 0 auto!important;width:auto!important;min-width:0!important/);
  assert.match(css, /\.appHeader\.feedHeader \.wordmark svg,\.appHeader\.feedHeader \.wordmark \.nexusWordmarkSvg\{width:76px!important/);
  // The logo does not grow on a wide screen: on a wide screen the phone is still a phone frame (measured:
  // 378px of bar under an 820px window), so a bigger logo there only steals width from the field.
  assert.doesNotMatch(css, /@media \(min-width:768px\)\{[\s\S]{0,220}wordmark svg/);
  // The mark is 34px and the target is 44px: the ring is transparent and it is outside the button, so the
  // bar keeps its height and the thumb keeps what the platform asks for.
  // Wave 14i: the door came back to the bar - the owner had marked the gear drawn over a reel, not this
  // button - so the mark and its ring are drawn again, and the logo, the one thing on the left, wears the
  // tint of the reading it is read in.
  assert.equal(css.includes("feedHeaderIcon"), true, "the door's mark and its ring are on the bar");
  assert.match(css, /\.appHeader\.feedHeader \.wordmark \.nexusWordmarkSvg :is\(text,circle\)\{fill:currentColor!important\}/);
  assert.match(css, /\.appHeader\.feedHeader \.wordmark \.nexusWordmarkSvg stop\{stop-color:currentColor!important\}/);
  // Wave 14e: no hairline under the bar. styles.css prints one for every header at `!important`, so this
  // file has to say `border-bottom:0`, and the shadow goes with it - measured on the live page that pair
  // was the line the owner photographed. Nothing on this bar paints a field or a plate any more, and the
  // shelf below it keeps no separator either: the rail that followed it has no box to separate itself from.
  assert.match(css, /\.appHeader\.feedHeader\{[^}]*border-bottom:0!important;box-shadow:none!important/);
  // Wave 14f: the shelf of moments is the Messages screen's tray now, and it carries no separator there
  // either - the rule followed the shelf to `inboxScreen`.
  assert.match(css, /\.inboxScreen>\.stories\{[^}]*border:0!important\}/);
  assert.equal(css.includes("feedSearchField"), false, "the field has no styles left");
  // Wave 14i: the door is back on the right of the bar, so the row it sits in is back with it - and the
  // gear that floated over a reel is gone, which is what the owner had marked in the first place.
  assert.match(css, /\.appHeader\.feedHeader \.feedHeaderIcons\{grid-column:4!important;justify-self:end!important;display:flex!important/);
  assert.equal(app.includes("clipOptionsButton"), false, "no mark floats over the clip any more");
  assert.equal(clipOptions.includes("clipOptionsButton"), false, "and the panel opens from the clip's menu");
  // Every section title the profile drawer prints goes through the translator: measured on the live page
  // before this line existed, the sheet printed the keys themselves ("feed.modesLabel"). Wave 14g left the
  // lens list exactly where it was - in the drawer the persona plate opens - so it is still pinned here.
  assert.match(feedSurface, /'<h3 class="profileSwitcherSectionTitle">' \+ esc\(t\("feed\.sectionTitle"\)\)/);
  assert.match(feedSurface, /<div class="profileHubGrid feedSourceGrid" data-feed-source>/);
  assert.match(feedSurface, /data-feed-destination="' \+ id \+ '"/);
  assert.match(feedSurface, /data-feed-presentation/);
  assert.match(feedSurface, /data-feed-fit/);
});
test("the header shows one dynamic mode mark while swipe keeps the three-mode walk", () => {
  const rail = feedModeSwitchMarkup({ active: "whispers", t, esc });
  const buttons = [...rail.matchAll(/data-feed-mode="([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(buttons, ["whispers"], "only the current reading is printed beside Nexus");
  assert.deepEqual(FEED_MODES, ["reels", "whispers", "news"], "the swipe contract keeps all readings");
  assert.doesNotMatch(rail, /feedModePuck|feedModeHint|<span>/);
  assert.match(rail, /data-feed-mode-active="whispers"/);
  assert.match(rail, /class="feedModes" role="tablist" aria-label="feed\.modesLabel"/);
  assert.match(rail, /data-feed-mode="whispers"[^>]*class="active"[^>]*aria-label="profile\.tabWhispers"/);
  assert.match(css, /\.appHeader\.feedHeader \.feedModes button\.active i\{opacity:1!important;transform:scale\(1\.28\)!important/);
  assert.match(css, /\.appHeader\.feedHeader \.feedModes\{[\s\S]*grid-column:2!important;[\s\S]*width:40px!important;[\s\S]*transform:none!important/);
  assert.match(css, /\.feedQuickClose\{[\s\S]*border-radius:50%!important/);
  // The walk the swipe takes is the rail's own order, and it wraps at both ends.
  assert.equal(nextFeedMode("reels", 1), "whispers");
  assert.equal(nextFeedMode("whispers", 1), "news");
  assert.equal(nextFeedMode("news", 1), "reels");
  assert.equal(nextFeedMode("reels", -1), "news");
  assert.equal(nextFeedMode("nothing-that-exists", 1), "whispers");
});

test("one tint per reading, on the screen and on the bar, where the rail lives", () => {
  // Violet for Reels, green for Whispers, blue for News - written on the bar as well as on the screen,
  // because the bar is not a child of the screen it belongs to.
  for (const [mode, colour] of [["reels", "#8b68d4"], ["whispers", "#43df80"], ["news", "#2fb7ff"]]) {
    assert.equal(css.includes(".appHeader.feedMode-" + mode + ",.clipsScreen.feed-" + mode + ",.phoneScreen:has(.feed-" + mode + "){--feed-tint:" + colour), true, mode + " has a tint");
  }
  assert.match(css, /\.feedModePuck\{[^}]*border:1px solid var\(--feed-tint-glow[^}]*box-shadow:0 0 18px var\(--feed-tint-glow/);
  assert.match(css, /\.feedModes button\.active\{[^}]*text-shadow:0 0 16px var\(--feed-tint-glow/);
  assert.match(css, /\.appHeader\.feedHeader \.wordmark \.nexusWordmarkSvg path\{stroke:currentColor!important\}/);
  assert.match(css, /\.clipsScreen>\.pulsePosts\{background:radial-gradient\(90% 34% at 50% 0,var\(--feed-tint-soft,transparent\),transparent 74%\)!important\}/);
  // Wave 14f: the rail is the middle of the bar, so it is one row between the logo and the two doors, and
  // the width it needs is taken before the doors give any: the rail may shrink, the way out of the screen
  // may not. It is no longer a shelf under a shelf, so it has no box and no fold either.
  assert.equal(css.includes(".feedModes{display:grid;grid-template-columns:repeat(3"), false, "the pill is not coming back");
  assert.match(css, /\.appHeader\.feedHeader \.feedModes\{[\s\S]*width:40px!important/);
  assert.match(css, /\.appHeader\.feedHeader \.feedModes button\{flex:0 1 auto!important;min-width:0!important;min-height:32px!important;padding:0 6px!important;gap:4px!important;font-size:10px!important;letter-spacing:\.02em!important\}/);
  assert.match(css, /\.appHeader\.feedHeader \.feedModes button:after\{content:"";position:absolute;inset:-6px -2px;border-radius:999px\}/);
  assert.match(css, /@media \(max-width:430px\)\{\s*\.appHeader\.feedHeader \.feedModes button i\{display:none\}/);
  assert.equal(css.includes(".clipsScreen.feedScrolled .feedModes"), false, "the rail does not leave the page any more");
  // Arabic reads the same rail from the other edge, and less motion means no motion.
  assert.match(css, /html\[dir="rtl"\] \.feedModeHint\{transform:scaleX\(-1\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*\.feedModes,\.feedModes button,\.whisperAction/);
});

test("the rail is drawn by the bar and the shelf is drawn by Messages, and the swipe stays on the column", () => {
  // Wave 14f, the owner's second mockup: the switch moved up into the bar, between the logo and the two
  // doors, and the shelf of moments moved to the Messages screen. The gesture is untouched - it listens on
  // the column, never on either control - so what is pinned here is where the two live and what is left of
  // the fold that used to hide the rail: nothing.
  const header = app.slice(app.indexOf("function renderHeader"), app.indexOf("// The one door of the feed bar keeps its state"));
  assert.match(header, /const modes = onFeed \? feedModeSwitchMarkup\(\{ active: feedMode, t, esc \}\) : ""/);
  assert.equal(header.indexOf('id="wordmark"') < header.indexOf("modes,"), true, "the rail is drawn after the logo");
  assert.equal(header.indexOf("modes,") < header.indexOf("'<div class=\"headerSwitches\">',"), true, "the rail is drawn before the switches");
  // Nothing is drawn between them: the current reading stays next to the strengthened Nexus mark.
  assert.equal(header.includes("headerActions"), false, "no door is drawn on the bar");
  // The rail answers for its own presses and arrow keys, where the rail's markup lives.
  assert.match(header, /if \(onFeed\) bindFeedModeRail\(box, \{ current: \(\) => feedMode, onSelect: activateFeedMode \}\)/);
  assert.match(feedSurface, /root\.querySelectorAll\("\[data-feed-mode\]"\)\.forEach\(\(button\) => button\.addEventListener\("click", \(\) => onSelect\(button\.dataset\.feedMode\)\)\)/);
  assert.match(feedSurface, /root\.querySelector\("\[data-feed-modes\]"\)\?\.addEventListener\("keydown"/);
  assert.match(feedSurface, /onSelect\(nextFeedMode\(current\(\), event\.key === "ArrowRight" \? 1 : -1\)\)/);
  assert.equal(app.includes("bindStoryRailAutoHide"), false, "the fold left with the shelf");
  assert.equal(app.includes('id="storyRail"'), false, "the feed screen no longer prints the shelf");
  // The tray the shell prints, and the loader that fills it, are the same ones the feed used.
  assert.match(shell, /box === 'inbox' \? '<div class="stories" id="storyRail" aria-label="Stories"><\/div>' : ''/);
  assert.match(app, /const storyTray = vp\.querySelector\("#storyRail"\);\n  if \(storyTray\) void loadStories\(storyTray\);/);
  assert.match(app, /if \(socialFormat === "clips"\) wireClipPlayback\(container\);/);
  // The swipe does not leave with the rail: it listens on the column, and it walks the three readings.
  assert.match(app, /touchSurface\.addEventListener\("touchstart"/);
  assert.match(app, /activateFeedMode\(nextFeedMode\(feedMode, decision\.offset\)\)/);
  assert.match(feedSurface, /onSelect\(button\.dataset\.feedMode\)/);
  // Every reading gets the gesture, including the ones that found nothing to show: a notice, an error and
  // an empty list are readings too, and the swipe has to be able to leave all of them. Measured on the live
  // page before this line existed, the notice path returned early and its column had no gesture at all.
  assert.match(app, /const wireReading = \(\) => \{ wireSocialChannelSwipe\(container\); \}/);
  assert.equal((app.match(/wireReading\(\);/g) || []).length, 6, "every exit of the feed render wires the reading");
});



test("a reel floats the bar while the compact Nexus identity remains visible", () => {
  // Wave 14g: the owner asked for the reel to own the whole screen, so on the Reels reading the bar stops
  // being a row above the column and becomes a layer over it - no background of its own, only a scrim - and
  // the column takes the height the bar was using. Everything here is written for Reels and for nothing
  // else: a text reading keeps the bar it had, because a headline needs the contrast.
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) #phoneHeader\{position:absolute!important;z-index:40;top:0;inset-inline:0\}/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) #phoneHeader \.appHeader\.feedHeader\{background:linear-gradient\(180deg,rgba\(2,6,12,\.62\),rgba\(2,6,12,0\)\)!important;backdrop-filter:none!important;box-shadow:none!important;border-bottom:0!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) \.screenViewport\{height:calc\(100% - 52px\)!important\}/);
  // A full-screen reel goes edge to edge under the floating bar; a column of cards starts below it, so the
  // reader who keeps the card presentation does not lose sight of the first card.
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) \.clipsScreen\.presentation-immersive>\.pulsePosts\{padding:0!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) \.clipsScreen\.presentation-cards>\.pulsePosts\{padding-top:82px!important\}/);
  // Scrolling keeps the logo and current mode, but removes the module/logout door after reel one.
  assert.match(css, /feedChromeFolded \.wordmark\{opacity:1;visibility:visible;pointer-events:auto\}/);
  assert.match(css, /feedChromeFolded \.feedHeaderIcons\{opacity:0;visibility:hidden;pointer-events:none\}/);
  assert.match(feedSurface, /const feedFoldBindings = new WeakMap\(\)/);
  assert.match(feedSurface, /if \(!bar \|\| !view\?\.classList\.contains\("feed-reels"\) \|\| !view\.classList\.contains\("presentation-immersive"\) \|\| !host\)/);
  assert.match(feedSurface, /const threshold = height > 0 \? height \* 0\.5 : 240/);
  assert.match(feedSurface, /bar\.classList\.toggle\("feedChromeFolded", Number\(host\.scrollTop \|\| 0\) >= threshold\)/);
  assert.match(feedSurface, /screen\.addEventListener\("scroll", binding\.measure, \{ capture: true, passive: true \}\)/);
  // The bar binds the fold with the rail, so the app does not have to: the bar is drawn once per screen and
  // the column is drawn once per load.
  assert.match(feedSurface, /bindReelChromeFold\(root\.closest\("\.phoneScreen"\), \{ header: root\.querySelector\("#phoneHeader"\) \}\)/);
  // The utility drawer now belongs to the header door: it opens directly below it at inline-end, while
  // inset-inline-end keeps the same relationship in a right-to-left interface.
  assert.match(css, /\.feedQuickLayer\{position:absolute;inset:0;z-index:230;display:block;padding:0\}/);
  assert.match(css, /\.feedQuickDrawer\{position:absolute;inset-block-start:62px;inset-inline-end:10px;/);
  assert.match(css, /\.feedQuickGrid\{display:grid;grid-template-columns:repeat\(3,40px\);gap:8px\}/);
  assert.match(css, /\.feedQuickGrid button\.active\{border-color:#fff;background:#fff;color:#050608;box-shadow:none\}/);
  assert.match(css, /\.feedQuickLogout\{color:#fff;border-color:rgba\(255,255,255,\.42\);background:#050608\}/);
  assert.match(css, /\.feedQuickClose\{[\s\S]*border:1px solid rgba\(255,255,255,\.5\)!important;[\s\S]*background:#050608!important;/);
  assert.match(css, /@keyframes feedQuickIn\{from\{opacity:\.4;transform:translateY\(-6px\) scale\(\.96\)\}to\{opacity:1;transform:none\}\}/);
  assert.match(css, /\.appHeader\.feedHeader \.wordmark\{[\s\S]*width:96px!important;[\s\S]*font-weight:560!important/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\.feedQuickDrawer\{animation:none!important\}/);
  // The rail keeps the creator's avatar for one-tap profile access, while the lower-left overlay names the
  // creator, exposes Follow only for another account, and keeps audio plus a bounded caption readable.
  assert.match(app, /clipCreatorAvatarMarkup\(\{ esc, t, handle: authorHandle, name: authorName, avatar: creatorAvatar \}\)/);
  assert.match(app, /'<div class="clipQuickActions" aria-label="' \+ esc\(t\("post\.actions"\)\) \+ '">',\n    clipCreatorAvatarMarkup/);
  assert.match(app, /'<div class="clipCreator clipIdentityPersistent"><button class="creatorStoryTrigger"/);
  assert.match(app, /isOwner \? '' : '<button data-follow="'/);
  assert.match(app, /class="clipMusicDisc" data-clip-sound/);
  assert.match(app, /const primaryMark = selectedKind && selectedKind !== "LIKE"/);
  assert.match(app, /primary\.glyph/);
  assert.match(app, /expandableCaptionMarkup\(captionWithTagsMarkup\(post\.caption\), \{ t, esc \}\)/);
  assert.match(feedSurface, /export function clipCreatorAvatarMarkup\(\{ esc, t, handle, name, avatar \}\)/);
  assert.match(feedSurface, /'<button class="clipRailAvatar" data-creator-story="' \+ esc\(handle\) \+ '" type="button" aria-label="' \+ esc\(t\("post\.openStory"\) \+ " " \+ name\) \+ '"><i>' \+ avatar \+ '<\/i><\/button>'/);
  assert.match(css, /\.clipStage \.clipQuickActions>\.clipRailAvatar\{width:62px!important;min-width:62px!important;min-height:54px!important/);
  assert.match(css, /\.clipStage \.clipQuickActions>\.clipRailAvatar>i img\{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%\}/);
  assert.match(humanUx, /\.clipStage \.clipMetaOverlay\{/);
  assert.match(humanUx, /-webkit-line-clamp:2!important/);
  assert.match(humanUx, /\.clipCaptionBlock\.expanded \[data-caption-text\]/);
  assert.match(humanUx, /\.clipStage \.studioProof\{display:none!important\}/);
  assert.match(css, /\.feed-reels \.clipContext\{display:none!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\) \.appNav\.social:before\{[^}]*rgba\(14,16,20,\.96\)/);
  assert.match(css, /:is\(\.clipsScreen,\.reelViewer\) \[data-follow\]\{[^}]*border:1px solid rgba\(255,255,255,\.72\)[^}]*background:rgba\(3,4,6,\.78\)/);
  assert.match(css, /\.appNav\.social:before\{[^}]*background:linear-gradient\(180deg,rgba\(14,16,20,\.96\),rgba\(2,3,5,\.98\)\)/);
  assert.match(css, /\.pulsePosts\.feedReels \.clipCard\{backdrop-filter:none!important\}/);
  assert.match(css, /\.clipQuickActions :is\(\.clipSolidIcon,\.reactionMetric>b\)[\s\S]*backdrop-filter:none!important/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.appNav\.social\{[\s\S]*background:linear-gradient\(180deg,rgba\(0,0,0,\.12\),#020304 52%,#000\)/);
  assert.match(css, /\.phoneScreen:has\(\.messengerScreen\) \.inboxSearch button/);
  assert.match(css, /\.phoneScreen:has\(\.accountScreen\) \.profileTilePin::before\{content:"⌖"/);
  assert.match(app, /captionTranslationButtonMarkup\(/);
  assert.equal(app.includes('class="clipMenuButton"'), false, "the non-functional ellipsis is absent from reels");
});

test("the completed Social shell is monochrome beyond the feed", () => {
  // The legacy foundation is intentionally left available to other Nexus modules. The final layer must
  // therefore be Social-scoped and strong enough to neutralise Search, Create, Live, News and refresh.
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.nexusWordmarkSvg\{filter:none!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) #phoneHeader \.appHeader:not\(\.feedHeader\)\{[\s\S]*background:#000!important;[\s\S]*backdrop-filter:none!important/);
  assert.match(css, /\.phoneScreen:has\(\.socialSearchScreen\) \.socialSearchForm\{[\s\S]*background:#07080a!important;[\s\S]*box-shadow:none!important/);
  assert.match(css, /\.phoneScreen:has\(\.socialSearchScreen\) \.socialSearchEmpty::before\{display:none!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.createHub\{[\s\S]*background:#050608!important/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.createHubGrid button\.primary\{[\s\S]*background:#08090b!important/);
  assert.match(css, /\.phoneScreen:has\(\.socialLiveScreen\) \.socialLiveScreen\{[\s\S]*background:#000!important/);
  assert.match(css, /\.phoneScreen:has\(\.socialLiveScreen\) \.liveTabs button\.active\{[\s\S]*background:#fff!important;[\s\S]*color:#050608!important/);
  assert.match(css, /\.phoneScreen:has\(\.socialLiveScreen\) \.liveEmpty::before\{display:none!important;filter:none!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-news\)\{--feed-tint:#fff/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-reels\) \.clipPlayState\{[\s\S]*rgba\(186,168,220,\.55\)[\s\S]*backdrop-filter:none!important/);
  assert.match(css, /html,body,#app\{[\s\S]*background:#000!important;[\s\S]*background-image:none!important/);
  assert.match(css, /\.landing::before,\.landing::after,\.landing-card::after\{display:none!important/);
  assert.match(css, /\.landing \.brand span\{[\s\S]*color:#fff!important;[\s\S]*text-shadow:none!important/);
  assert.match(css, /\.landing \.brand::before\{[\s\S]*#fff 0 38%[\s\S]*filter:none!important/);
  assert.match(css, /\.landing :is\(\.wallet-btn,\.primary-btn\)\{[\s\S]*background:#fff!important;[\s\S]*color:#050608!important/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.appHeader\.feedHeader \.wordmark\{[\s\S]*color:#fff!important;[\s\S]*filter:none!important/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.feedSkeletonCard\{[\s\S]*background:#050608!important;[\s\S]*box-shadow:none!important/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.feedSkeleton :is\(\.skeletonAvatar,\.skeletonName,\.skeletonKicker,\.skeletonMedia,\.skeletonAction,\.skeletonLine,\.skeletonMeta\)\{[\s\S]*#0c0d0f[\s\S]*#202226[\s\S]*#0c0d0f/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.feedSkeleton \.skeletonMedia\{[\s\S]*#08090b[\s\S]*#17191d[\s\S]*#08090b/);
  assert.match(index, /meta name="theme-color" content="#010302"/);
  assert.match(index, /html,body,#app\{margin:0;min-height:100%;background:#010302!important/);
});

test("a whisper is a real card: every control on it lands on the code that already owns it", () => {
  const card = whisperCardMarkup({
    id: 41, user_id: 9, created_at: 1, caption: "Gânduri #liniștite", comment_count: 6, reposts: 4,
    saved_by_me: true, visibility: "followers", author: { handle: "mike_t", display_name: "Mike T" },
  }, {
    esc, t, stamp, body: "Gânduri #liniștite", palette: '<div class="reactionBar xPalette"></div>',
    drawer: '<div class="comments clipCommentsDrawer" id="comments-41"></div>',
    menu: '<button data-report="41" type="button"></button>', summary: '<i class="reactionSummaryGlyphs"></i>', repost: "",
  });
  // One card, the same data-* hooks the clip card and the profile timeline use: like, reply, repost,
  // save, share, open, author. Nothing here is a drawing.
  for (const hook of ['data-reaction-toggle="41"', 'data-comments="41"', 'data-repost="41"', 'data-save="41"', 'data-share="41"', 'data-post-open="41"', 'data-creator-profile="mike_t"', 'id="comments-41"', "reactionBar"]) {
    assert.equal(card.includes(hook), true, hook);
  }
  // A whisper that is not public says so, and the save button says what it already is.
  assert.match(card, /class="whisperLock" aria-label="feed\.private"/);
  assert.match(card, /aria-label="post\.removeSaved"/);
  assert.match(card, /data-post-id="41" data-post-author="9"/);
  // The card is built from the words the app has and the tags the caption wrote.
  assert.match(card, /profile\.tabWhispers/);
  assert.match(app, /body: captionWithTagsMarkup\(post\.caption \|\| ""\)/);
  assert.match(app, /palette: reactionPaletteMarkup\(post, post\.reactions\?\.viewer_reaction \|\| null\)/);
  assert.match(app, /drawer: commentsDrawerMarkup\(post\)/);
  assert.match(app, /menu: postOptionsMenuMarkup\(post, \{/);
  // The whisper mode renders whisper cards and wires them with the shared action binder.
  assert.match(app, /posts\.map\(\(post\) => whisperCardMarkup\(post, whisperCardContext\(post\)\)\)\.join\(""\)/);
  assert.match(app, /wirePostActions\(container\)/);
  assert.match(css, /\.pulsePosts\.feedWhispers \.whisperCard \.reactionBar\.expanded\{/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-whispers\)\{--feed-tint:#fff;--feed-tint-soft:transparent;--feed-tint-glow:transparent/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-whispers\) \.whisperCard\{[\s\S]*background:#07080a!important/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-whispers\) \.whisperAction\.on\{[\s\S]*background:#fff!important;[\s\S]*color:#050608!important/);
  assert.match(css, /\.phoneScreen:has\(\.clipsScreen\.feed-whispers\) \.whisperCard \.reactionBar\.expanded\{[\s\S]*backdrop-filter:none!important/);
  assert.match(css, /html:has\(#app>\.boot\)[\s\S]*background:#000!important;background-image:none!important/);
  assert.match(css, /body:has\(#app>\.boot\)::after\{display:none!important;animation:none!important\}/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.pullRefreshIndicator\{[\s\S]*background:#050608!important;[\s\S]*color:#fff!important/);
  assert.match(css, /\.phoneScreen:has\(\.accountScreen\) \.accountScreen::before\{[\s\S]*background:#050608!important;[\s\S]*color:#fff!important/);
});

test("a voice note is played, paused and measured on the device, and only when a post carries one", () => {
  assert.equal(feedAudioMarkup({ audio: null }, { esc, t }), "");
  const markup = feedAudioMarkup({ audio: { hash: "c".repeat(64), ext: "webm" }, audio_attribution: "Julia" }, { esc, t });
  assert.match(markup, /data-feed-audio/);
  assert.match(markup, /src="\/media\/c{64}\.webm"/);
  assert.match(markup, /preload="none" playsinline/, "nothing is downloaded until the reader presses play");
  assert.match(markup, /data-audio-toggle aria-label="post\.play" aria-pressed="false"/);
  assert.match(markup, /data-audio-progress/);
  assert.match(markup, /data-audio-time/);
  assert.match(markup, /Julia/);
  assert.equal(typeof bindFeedAudio, "function");
  const module = read("feed-surface.js");
  assert.match(module, /if \(element && element !== keep\) element\.pause\(\)/);
  assert.match(module, /toggle\.setAttribute\("aria-label", t\(playing \? "post\.pause" : "post\.play"\)\)/);
  assert.match(module, /decodeAudioData/);
  assert.match(module, /wave\.dataset\.drawn = "1"/);
  assert.match(app, /if \(requestedMode === "whispers"\) bindFeedAudio\(container, \{ t \}\)/);

test("the end of the list loads itself, keeps the button for a keyboard, and the mode keeps the place", () => {
  assert.match(feedMoreMarkup({ t, esc, cursor: "12" }), /<button class="socialFeedMore" type="button" data-feed-more="12">search\.more<\/button>/);
  const continuation = app.slice(app.indexOf("function wireSocialFeedContinuation"), app.indexOf("function wireClipPlayback"));
  assert.match(continuation, /const loadMore = async \(\) => \{/);
  assert.match(continuation, /if \(button\.disabled \|\| button\.dataset\.feedLoading === "true"\) return;/);
  assert.match(continuation, /new IntersectionObserver\(\(entries\) => \{/);
  assert.match(continuation, /rootMargin: "0px 0px 420px 0px"/);
  assert.match(continuation, /button\.addEventListener\("click", \(\) => \{ void loadMore\(\); \}\)/);
  assert.match(continuation, /feedMode === "whispers"/);
  assert.match(continuation, /wirePostActions\(pageRoot, currentFeedPosts\)/);
  assert.match(continuation, /bindFeedAudio\(pageRoot, \{ t \}\)/);
  // Switching modes is not a page move: the place in each reading is remembered and given back.
  assert.match(app, /feedScrollMemory\.set\(feedMode \+ ":" \+ socialLens \+ ":" \+ socialFormat/);
  assert.match(app, /const remembered = Number\(feedScrollMemory\.get\(requestedMode \+ ":" \+ requestedLens \+ ":" \+ requestedFormat\) \|\| 0\)/);
  assert.match(app, /if \(remembered > 0\) container\.scrollTop = remembered;/);
  assert.match(app, /if \(!request\.isCurrent\(\)[\s\S]{0,200}\|\| feedMode !== requestedMode\) return;/);
});

test("the feed opens immersive on a phone while the optional card presentation remains available", () => {
  // G1: the approved Reels reference is now the default normal reader too. The versioned preference
  // intentionally retires the old card-first value once; an explicit new cards choice still persists.
  assert.match(app, /const SOCIAL_PRESENTATION_KEY = "nexus-social-presentation-v2";/);
  assert.match(app, /return "immersive";/);
  assert.match(app, /if \(value === "immersive" \|\| value === "cards"\) return value;/);
  assert.match(css, /\.presentation-cards \.pulsePosts\.feedReels \.clipCard\{/);
  assert.match(css, /\.clipsScreen\.presentation-immersive\.feed-reels>\.pulsePosts\.feedReels\{/);
  assert.match(css, /\.pulsePosts\.feedReels \.clipQuickActions \.clipSolidIcon \.viewerSolidSvg/);
  assert.match(css, /@media \(min-width:640px\)\{[\s\S]{0,200}calc\(\(100% - 560px\) \/ 2\)/);
  assert.match(css, /@media \(max-width:374px\)\{/);
  assert.match(css, /html\[dir="rtl"\] \.storyName\{text-align:right\}/);
  // A thread opened inside a card is a panel under the media, not a sheet floating over a screen.
  assert.match(css, /clipCard\.commentsExpanded>\.clipCommentsDrawer\{position:static!important;height:auto!important;max-height:52dvh!important/);
  // The surface ships its own stylesheet, tagged with the wave, the way the profile and the post page do.
  assert.match(index, /feed-surface\.css\?v=20260928-comments24/);
  assert.match(css, /\.pulsePosts\.feedReels \.clipQuickActions>\.clipRailAvatar\{[\s\S]*margin-bottom:14px!important;/);
  assert.equal(app.includes("./feed-surface.js?v=20260926-source2"), true);
});

test("reels align identity with the caption and combine repost with share", () => {
  assert.match(app, /function clipDistributeMarkup\(/);
  assert.match(app, /class="clipDistributeToggle" data-clip-distribute=/);
  assert.match(app, /class="clipDistributeMenu" data-clip-distribute-menu=/);
  assert.match(app, /function bindClipDistributeMenus\(root\)/);
  assert.match(app, /bindClipDistributeMenus\(root\);/);
  assert.match(css, /\.clipMetaOverlay>:is\(\.clipCreator,\.clipCaptionBlock,\.clipTranslate\)\{[\s\S]*padding-inline:0!important/);
  assert.match(css, /\.clipMetaOverlay \.creatorStoryTrigger,[\s\S]*transform:none!important/);
  assert.match(css, /\.clipDistributeMenu\{[\s\S]*inset-inline-end:64px!important;[\s\S]*background:#050608!important/);
  assert.match(css, /\.clipDistributeMenu\[hidden\]\{display:none!important\}/);
});

test("Social keeps a quiet green atmosphere while reaction marks float without black discs", () => {
  assert.match(css, /--nexus-green-canvas:#010302/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.appNav\.social\{[\s\S]*rgba\(2,7,4,\.97\)/);
  assert.match(css, /\.phoneScreen:has\(\.appNav\.social\) \.screenViewport\{[\s\S]*var\(--nexus-green-glow\)/);
  assert.match(css, /\.clipQuickActions :is\(\.clipSolidIcon,\.reactionMetric>b\),[\s\S]*\.viewerActionRail :is\(\.viewerSolidIcon,\.reactionMetric>b\)\{[\s\S]*background:transparent!important;[\s\S]*box-shadow:none!important/);
});

test("the module door is transparent and the Reels play mark is a smaller violet-white signature", () => {
  assert.match(css, /\.appHeader\.feedHeader \.feedHeaderIcon,[\s\S]*background:transparent!important;[\s\S]*box-shadow:none!important/);
  assert.match(css, /\.clipsScreen\.feed-reels\) \.appHeader\.feedHeader \.feedModes button\{[\s\S]*width:34px!important;[\s\S]*height:34px!important/);
  assert.match(css, /\.clipsScreen\.feed-reels\) \.appHeader\.feedHeader \.feedModes button\.active\{[\s\S]*#7652bd[\s\S]*color:#fff!important/);
  assert.match(css, /\.clipsScreen\.feed-reels\) \.appHeader\.feedHeader \.feedModes button\.active i\{[\s\S]*color:#fff!important;[\s\S]*font-size:13px!important/);
});

test("the reel creator copy is compact and the header uses a transparent source selector", () => {
  assert.match(css, /\.clipStage \.clipMetaOverlay\{[\s\S]*gap:0!important/);
  assert.match(css, /\.clipStage \.creatorStoryTrigger b\{[\s\S]*font-weight:900!important/);
  assert.match(css, /\.clipTranslate\{[\s\S]*align-self:flex-start!important;[\s\S]*text-align:start!important/);
  assert.match(css, /\.clipCaptionBlock\.expanded,[\s\S]*background:rgba\(1,5,3,\.44\)!important/);
  assert.match(css, /\.feedHeaderIcon:is\(:hover,\[aria-expanded=true\]\)\{[\s\S]*border-color:transparent!important;[\s\S]*background:transparent!important/);
});

test("the dynamic Nexus signature is smaller and Reels uses the vivid full-screen violet", () => {
  assert.match(css, /\.appHeader\.feedHeader \.wordmark\{[\s\S]*width:80px!important;[\s\S]*height:28px!important/);
  assert.match(css, /\.appHeader\.feedHeader \.feedModes button i\{[\s\S]*width:28px!important;[\s\S]*height:28px!important/);
  assert.match(css, /\.clipsScreen\.feed-reels\) \.appHeader\.feedHeader \.feedModes button\.active i\{[\s\S]*#9b3cff[\s\S]*#642be0/);
});

test("creator, like and comment occupy equal centred rail slots", () => {
  assert.match(css, /\.clipQuickActions\{[\s\S]*gap:4px!important/);
  assert.match(css, /\.clipQuickActions>button\{[\s\S]*flex:0 0 60px!important;[\s\S]*height:60px!important;[\s\S]*margin:0!important/);
  assert.match(css, /\.clipQuickActions>\.clipRailAvatar\{[\s\S]*place-items:center!important/);
  assert.match(css, /\.viewerActionRail>button,[\s\S]*flex:0 0 64px!important;[\s\S]*height:64px!important/);
});

test("the equal action rail is compressed into one close visual group", () => {
  assert.match(css, /\.clipQuickActions>button:not\(\.clipRailAvatar\)\{[\s\S]*flex-basis:48px!important;[\s\S]*grid-template-rows:35px 11px!important/);
  assert.match(css, /\.clipQuickActions>\.clipRailAvatar\{[\s\S]*flex-basis:52px!important;[\s\S]*height:52px!important/);
  assert.match(css, /\.clipQuickActions :is\(\.clipSolidIcon,\.reactionMetric>b\)\{[\s\S]*width:34px!important;[\s\S]*height:34px!important/);
  assert.match(css, /\.viewerActionRail>button\{[\s\S]*flex-basis:52px!important;[\s\S]*height:52px!important/);
});

test("the creator avatar stays large and separate while reaction buttons tighten", () => {
  assert.match(css, /\.clipQuickActions>\.clipRailAvatar\{[\s\S]*flex:0 0 62px!important;[\s\S]*margin:0 0 6px!important/);
  assert.match(css, /\.clipQuickActions>\.clipRailAvatar>i\{[\s\S]*width:54px!important;[\s\S]*height:54px!important/);
  assert.match(css, /\.clipQuickActions>button:not\(\.clipRailAvatar\)\{[\s\S]*flex:0 0 42px!important;[\s\S]*height:42px!important;[\s\S]*grid-template-rows:30px 10px!important/);
  assert.match(css, /\.viewerActionRail>\.viewerRailAvatar\{[\s\S]*height:68px!important;[\s\S]*margin:0 0 6px!important/);
});

test("Like and Comment sit closer while the lower actions keep breathing room", () => {
  assert.match(css, /\.clipQuickActions>button\[data-comments\]\{[\s\S]*margin-top:-12px!important/);
  assert.match(css, /\.clipQuickActions>\.clipDistributeToggle\{[\s\S]*margin-top:6px!important/);
  assert.match(css, /\.clipQuickActions>button\[data-save\]\{[\s\S]*margin-top:6px!important/);
  assert.match(css, /\.clipQuickActions>\.clipMusicDisc\{[\s\S]*margin-top:8px!important/);
});

test("the reference rail uses icon-plus-metric cells without inventing save counts", () => {
  assert.match(app, /class="railMetricPlaceholder" aria-hidden="true">•<\/small><\/button>',\s*clipDistributeMarkup/);
  assert.match(app, /data-clip-distribute="' \+ postId[\s\S]*<small>' \+ Number\(repostCount \|\| 0\)/);
  assert.match(css, /\.clipQuickActions>button:not\(\.clipRailAvatar\)\{[\s\S]*flex:0 0 56px!important;[\s\S]*grid-template-rows:39px 14px!important/);
  assert.match(css, /\.clipQuickActions :is\(\.clipSolidIcon,\.reactionMetric>b\)\{[\s\S]*width:36px!important;[\s\S]*height:36px!important/);
  assert.match(css, /\.railMetricPlaceholder,[\s\S]*visibility:hidden!important/);
});

test("the avatar rises and the primary heart drops without moving the remaining rail", () => {
  assert.match(css, /\.clipQuickActions>\.clipRailAvatar\{[\s\S]*transform:translateY\(-4px\)!important/);
  assert.match(css, /\.clipQuickActions>button\[data-reaction-toggle\]\{[\s\S]*transform:translateY\(4px\)!important/);
  assert.match(css, /\.viewerActionRail>\.viewerRailAvatar\{transform:translateY\(-4px\)!important\}/);
  assert.match(css, /\.viewerActionRail>button\[data-viewer-reactions\]\{transform:translateY\(4px\)!important\}/);
});

});

