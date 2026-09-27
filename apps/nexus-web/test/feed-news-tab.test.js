// Wave 14: the feed is one page with three ways to read it - Reels, Whispers, News - and the lens
// line under the switch still names every channel the feed sheet has.
//
// Decisions pinned here, because each of them is easy to undo by accident:
//  1. the switch selects between panels, and each mode maps to the lens/format pair the feed endpoint
//     already validates, so a mode can never ask for something the server would answer differently;
//  2. the profile bar keeps Moments as its fifth tab while the feed's third mode is News - the same
//     slot in two surfaces, on purpose, because a saved story is not a headline;
//  3. a news card carries only what the approved aggregator sent - headline, source, time and a link
//     when the host is on the allow-list - because a picture or a category chip here would be invented.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FEED_MODES, FEED_MODE_CONTRACT, feedModeForFeed, feedModeSwitchMarkup, feedSourceSectionMarkup } from "../public/feed-surface.js";
import { breakingNewsCardMarkup, breakingNewsMarkup } from "../public/breaking-news.js";
import { profileTabOrder } from "../public/profile-experience.js";

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const app = read("app.js");
const locale = read("interface-locale.js");
const styles = read("styles.css");
const feedCss = read("feed-surface.css");

test("News is one of three modes, and each mode is the request the feed already understands", () => {
  assert.deepEqual(FEED_MODES, ["reels", "whispers", "news"]);
  assert.equal(FEED_MODE_CONTRACT.reels.format, "clips");
  assert.equal(FEED_MODE_CONTRACT.whispers.format, "tweets");
  assert.equal(FEED_MODE_CONTRACT.whispers.lens, "for-you");
  assert.equal(FEED_MODE_CONTRACT.news.lens, "breaking");
  // A mode that arrived from anywhere else (a sheet, a swipe, a deep link) is named by the same rule.
  assert.equal(feedModeForFeed("tweets"), "whispers");
  assert.equal(feedModeForFeed("breaking"), "news");
  for (const feed of ["for-you", "local", "global", "following"]) assert.equal(feedModeForFeed(feed), "reels");
  // Wave 14f: the rail is drawn by the bar (`renderHeader`), between the logo and the two doors, and it
  // answers for its own presses and arrow keys (`bindFeedModeRail`), so the feed screen is the column alone:
  // the shelf of moments is the Messages screen's tray.
  const header = app.slice(app.indexOf("function renderHeader"), app.indexOf("// The activity box lives inside the inbox module"));
  assert.match(header, /const modes = onFeed \? feedModeSwitchMarkup\(\{ active: feedMode, t, esc \}\) : ""/);
  assert.match(header, /if \(onFeed\) bindFeedModeRail\(box, \{ current: \(\) => feedMode, onSelect: activateFeedMode \}\)/);
  assert.match(read("feed-surface.js"), /root\.querySelectorAll\("\[data-feed-mode\]"\)\.forEach\(\(button\) => button\.addEventListener\("click", \(\) => onSelect\(button\.dataset\.feedMode\)\)\)/);
  const pulse = app.slice(app.indexOf("function renderPulse"), app.indexOf("function renderPrivateContent"));
  assert.equal(pulse.includes('id="storyRail"'), false, "the feed screen prints no shelf");
  assert.equal(pulse.includes("feedModeSwitchMarkup"), false, "the switch is not the feed screen's to draw");
  assert.match(pulse, /'<div class="pulsePosts" id="pulsePosts"><\/div>'/);
  // Wave 14b: no lens line under the switch. What the feed reads is chosen in the source sheet.
  assert.equal(pulse.includes("Lens"), false, "the feed draws no lens line");
  assert.equal(read("feed-surface.js").includes("feedLensChipsMarkup"), false, "the lens line is gone, not hidden");
  // Every mode goes through the same destinations the sheet uses, so the switch cannot drift from the feed.
  const activate = app.slice(app.indexOf("function activateFeedMode"), app.indexOf("function currentSocialFeedKey"));
  assert.match(activate, /if \(mode === "news"\) activateSocialFeed\("breaking"\)/);
  assert.match(activate, /else if \(mode === "whispers"\) activateSocialFeed\("tweets"\)/);
  assert.match(activate, /else activateSocialFeed\(reelsLensFeed\)/);
});


test("the switch shows only the active reading, and the feed's destinations live in the source sheet", () => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (key) => key;
  const markup = feedModeSwitchMarkup({ active: "whispers", t, esc });
  assert.match(markup, /<nav class="feedModes" role="tablist" aria-label="feed\.modesLabel"/);
  assert.equal(markup.split('role="tab"').length - 1, 1);
  assert.match(markup, /data-feed-mode="whispers" aria-selected="true"[^>]*class="active"/);
  assert.doesNotMatch(markup, /data-feed-mode="reels"/);
  assert.doesNotMatch(markup, /data-feed-mode="news"/);
  // The active mark keeps its accessible name even though no visible label is printed.
  assert.match(markup, /profile\.tabWhispers/);
  // Every destination the feed still has, and both display choices, are rows of the source sheet.
  const section = feedSourceSectionMarkup({ t, esc, current: "for-you", presentation: "cards", mediaFit: "fill" });
  assert.match(section, /feed\.sectionTitle/);
  for (const id of ["for-you", "local", "global", "following", "photos", "friends", "private"]) {
    assert.match(section, new RegExp('data-feed-destination="' + id + '"'));
  }
  assert.match(section, /data-feed-destination="for-you" class="active"/);
  assert.match(section, /data-feed-presentation/);
  assert.match(section, /data-feed-fit/);
  assert.match(app, /feedSourceSectionMarkup\(\{ t, esc, current: currentSocialFeedKey\(\), presentation: socialPresentation, mediaFit: socialMediaFit \}\)/);
  assert.match(app, /bindFeedSourceSection\(dialog, \{/);
  assert.match(app, /onDestination: \(feed\) => \{ close\(\); activateSocialFeed\(feed\); \}/);
  // Wave 14g: the source door and its panel left the feed with the search, the friends, the groups and the
  // notifications, so the destinations and the two display choices are read where they already were: in the
  // drawer the persona plate opens. The one door left on the bar is a drawer of marks with no words in it.
  assert.match(app, /feedSourceSectionMarkup\(\{ t, esc, current: currentSocialFeedKey\(\), presentation: socialPresentation, mediaFit: socialMediaFit \}\)/);
  assert.match(app, /bindFeedSourceSection\(dialog, \{/);
  assert.match(app, /onDestination: \(feed\) => \{ close\(\); activateSocialFeed\(feed\); \}/);
  assert.equal(read("feed-surface.js").includes("feedSourceDoorMarkup"), false, "the source panel is not drawn anywhere");
  assert.equal(read("feed-surface.js").includes("data-feed-source-feed"), false, "no row opens a lens from a panel");
  assert.equal(read("app.js").includes("mountFeedDoors"), false, "the four-door panel left the feed");
  assert.match(app, /feedHub = mountFeedHub\(\);/);
  assert.match(read("feed-hub.js"), /feedQuickTilesMarkup\(\{ esc, modules: modules\(\) \}\)/);
});

test("the fifth tab of the profile is still Moments: News belongs to the feed", () => {
  assert.deepEqual(profileTabOrder(null), ["flow", "reels", "shots", "whispers", "moments"]);
  assert.equal(profileTabOrder(null).includes("news"), false);
  assert.match(locale, /"feed\.breaking": "News"/);
  assert.match(locale, /"feed\.breaking": "Știri"/);
  assert.match(locale, /"feed\.breaking": "Wiadomości"/);
  assert.match(locale, /"feed\.breaking": "الأخبار"/);
  // Wave 14 added three sentences for the surface and one for the voice note, in all four languages.
  for (const key of ["feed.channelsLabel", "feed.breakingNoLink", "feed.modesLabel", "feed.loading", "feed.yourStory", "feed.sectionTitle", "post.pause"]) {
    assert.equal(locale.split('"' + key + '"').length - 1, 4, key + " exists in four languages");
  }
});


test("a news card shows what the aggregator sent, and never a picture or a category", () => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const t = (key) => key;
  const card = breakingNewsCardMarkup(
    { title: "Ports reopen", source: "example-news.org", href: "https://api.gdeltproject.org/x", published_at: 1 },
    { esc, t, stamp: "2 h ago" },
  );
  assert.match(card, /<li class="breakingNewsCard" data-breaking-item>/);
  assert.match(card, /<a class="breakingNewsTitle" href="https:\/\/api\.gdeltproject\.org\/x" target="_blank" rel="noopener noreferrer">Ports reopen<\/a>/);
  assert.match(card, /<small class="breakingNewsMeta">example-news\.org · 2 h ago<\/small>/);
  assert.equal(card.includes("breakingNewsHeld"), false);
  assert.equal(card.includes("<img"), false, "no image travels with a headline");
  const payload = {
    provider: { status: "ready", name: "GDELT", allowed_hosts: ["api.gdeltproject.org"] },
    news: [{ title: "Off-list", url: "https://elsewhere.example/x", source: "elsewhere.example", published_at: 2 }],
  };
  const lens = breakingNewsMarkup(payload, { esc, t, stamp: () => "1 h ago" });
  assert.equal(lens.includes("href="), false, "an address nobody approved is not followed");
  assert.match(lens, /feed\.breakingNoLink/);
  assert.equal(/breakingNewsChip|breakingNewsImage|data-news-category/.test(lens), false, "a card carries no invented field");
});

test("the section, the card and the player are styles, not requests: none of them loads a third party", () => {
  // Wave 14f: the rail of readings is on the bar now, so the sheet describes it there - one row, sharing
  // width with the logo and the doors instead of a column of two under the shelf.
  assert.match(feedCss, /\.appHeader\.feedHeader \.feedModes\{flex:1 1 auto!important;min-width:0!important;display:flex!important/);
  assert.match(feedCss, /\.feedModes button\.active\{color:#f6fbff;text-shadow:0 0 16px var\(--feed-tint-glow/);
  // Wave 14i: the door is on the bar again - the owner had marked the gear over a reel, not this button -
  // and it still loads nothing from anybody: the mark is one inline path.
  assert.match(feedCss, /\.appHeader\.feedHeader \.feedHeaderIcon\{width:40px;height:40px/);
  assert.match(feedCss, /\.appHeader\.feedHeader \.feedHeaderIcon svg\{width:21px;height:21px;fill:none;stroke:currentColor/);
  assert.equal(/\.feedLensBar/.test(feedCss), false, "the lens line has no styles left");
  assert.match(feedCss, /\.whisperCard\{position:relative;display:grid/);
  assert.match(feedCss, /\.feedAudio\{display:grid/);
  assert.match(feedCss, /\.breakingNewsCard\{display:grid;grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(feedCss, /prefers-reduced-motion/);
  // The feed still loads nothing from a third party, and the card shape the news contract pins is
  // untouched in the sheet the shell has always carried.
  assert.equal(styles.includes("url(http"), false);
  assert.equal(feedCss.includes("url(http"), false);
  assert.match(styles, /\.breakingNewsCard\{display:grid;grid-template-columns:auto minmax\(0,1fr\) auto/);
});
