// Wave 6e (P8e) contracts: the read-only ticker band above the content tabs, and the drawer that is now
// the only index of a profile's settings. The rules that matter to a person are pinned here - the band
// is never interactive, its pace is a device setting instead of a profile one, the seven doors keep
// their order, and no control is duplicated between the panels.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderOwnerProfileExperience } from "../public/profile-experience.js";
import {
  PROFILE_TICKER_FRAGMENTS, PROFILE_TICKER_SPEED_KEY, PROFILE_TICKER_SPEEDS, applyTickerSpeed,
  nextTickerSpeed, profileTickerFragments, profileTickerItems, profileTickerMarkup, profileTickerSpan,
  readTickerSpeed, tickerSpeedId, tickerSpeedLabelKey, writeTickerSpeed,
} from "../public/profile-ticker.js";
import {
  PROFILE_MENU_ITEMS, bindProfileMenu, markProfileMenuActive, profileMenuId, profileMenuMarkup, profileMenuView,
} from "../public/profile-menu.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const panels = readFileSync(new URL("../public/profile-settings-panels.js", import.meta.url), "utf8");
const menu = readFileSync(new URL("../public/profile-menu.js", import.meta.url), "utf8");
const ticker = readFileSync(new URL("../public/profile-ticker.js", import.meta.url), "utf8");
const preferences = readFileSync(new URL("../public/notification-preferences.js", import.meta.url), "utf8");
const profileExperience = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));
const t = (key) => key;

const owner = Object.freeze({
  user_id: 19, handle: "romeodeepsek", persona: "social", name: "Romeo Coian", is_self: true,
  location: "Kraków, Polonia", visibility: "public",
  bio: "its me:) Picasso\nLala blanco. Oh",
  counts: { posts: 32, followers: 1, following: 1 },
});

function fakeNode(dataset = {}) {
  const handlers = {};
  return {
    dataset, hidden: false, handlers,
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, addEventListener(type, handler) { handlers[type] = handler; },
  };
}

// A host that answers exactly the selectors the owner profile asks for, so the hero contract can be
// exercised without a browser.
function profileHost({ cards = [], tabs = [], grid = fakeNode(), list = fakeNode(), emptyStates = [] } = {}) {
  const selectors = {
    ".ownerPostGrid": [grid], ".ownerWhisperList": [list],
    "[data-profile-post]": cards, "[data-profile-open]": [], "[data-profile-moment]": [],
    "[data-owner-content]": tabs, "[data-owner-empty-for]": emptyStates,
  };
  return {
    html: "", hidden: false,
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector: (selector) => (selectors[selector] || [])[0] || null,
    querySelectorAll: (selector) => selectors[selector] || [],
  };
}

function renderOwner() {
  const host = profileHost();
  renderOwnerProfileExperience(host, { profile: owner, posts: [], stories: [], reposts: [], shared_replies: [] }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t, locale: "ro-RO", now: Date.now(),
    controls: () => ({}), tickerSpeed: "medium",
  });
  return host.innerHTML;
}

function renderVisitor() {
  const host = profileHost();
  renderOwnerProfileExperience(host, {
    profile: { ...owner, is_self: false }, posts: [], stories: [], reposts: [], shared_replies: [],
  }, { esc, safeUrl: (value) => (value ? String(value) : ""), t, locale: "ro-RO", now: Date.now(), controls: () => ({}) });
  return host.innerHTML;
}

test("the band repeats what the record says, in the order a profile is read", () => {
  const items = profileTickerItems(owner, { t, locale: "ro-RO" });
  assert.deepEqual(items.map((item) => item.kind), ["location", "handle", "posts", "followers", "following", "bio", "bio", "bio"]);
  assert.equal(items[0].value, "Kraków, Polonia");
  assert.equal(items[1].value, "@romeodeepsek");
  assert.equal(items[2].count, "32");
  assert.equal(items[5].value, "its me:) Picasso");
  // A profile without a place, a handle or a description still produces the three counters.
  const bare = profileTickerItems({ counts: {} }, { t, locale: "ro-RO" });
  assert.deepEqual(bare.map((item) => item.kind), ["posts", "followers", "following"]);
  assert.deepEqual(bare.map((item) => item.count), ["0", "0", "0"]);
});

test("the band is text that moves: no button, no link and no tab stop inside it", () => {
  const markup = profileTickerMarkup(owner, { esc, t, locale: "ro-RO", speed: "medium" });
  assert.equal(markup.includes('data-owner-ticker data-owner-ticker-count="8"'), true);
  assert.match(markup, /style="--tickerSpan:48s"/);
  assert.equal(markup.includes('aria-hidden="true"'), true);
  assert.doesNotMatch(markup, /<button|<a |<input|<select|tabindex|contenteditable|data-hero-edit|data-owner-content/);
  // Two identical runs: the loop closes without a jump because the second run is the first one.
  const runs = [...markup.matchAll(/<span class="ownerTickerRun">([\s\S]*?)<\/span><span class="ownerTickerRun">([\s\S]*?)<\/span><\/div><\/div>/g)];
  assert.equal(runs.length, 1);
  assert.equal(runs[0][1], runs[0][2]);
  assert.equal((markup.match(/class="ownerTickerItem"/g) || []).length, 16);
});

test("a description is carried whole by the band, and what the owner wrote is never markup", () => {
  // The hero stopped printing the description, so the band carries every line of it instead of the first
  // three: the words the owner wrote stay readable on the profile, in the one place that shows them.
  assert.deepEqual(profileTickerFragments("unu\ndoi. trei · patru"), ["unu", "doi.", "trei", "patru"]);
  assert.equal(profileTickerFragments("unu\ndoi. trei · patru", 2).length, 2);
  assert.deepEqual(profileTickerFragments("   \n\n  "), []);
  assert.equal(profileTickerFragments("Linia", 0).length, 0);
  assert.equal(profileTickerFragments("x".repeat(200))[0].length, 96);
  assert.equal(profileTickerFragments("x".repeat(200))[0].endsWith("…"), true);
  const markup = profileTickerMarkup({
    handle: "<script>", location: 'a"b', bio: "<img src=x onerror=alert(1)>", counts: { posts: 1 },
  }, { esc, t, locale: "ro-RO" });
  assert.equal(markup.includes("<script>"), false);
  assert.equal(markup.includes("<img"), false);
  assert.equal(markup.includes("&lt;script&gt;"), true);
  assert.equal(markup.includes("a&quot;b"), true);
  assert.equal(markup.includes("onerror=alert(1)"), true, "the text stays the text");
  assert.equal(markup.includes("<img src"), false);
});

test("the pace of the band is a device setting, and it is not on the profile", () => {
  assert.equal(PROFILE_TICKER_SPEED_KEY, "nexus-ticker-speed-v1");
  assert.deepEqual(PROFILE_TICKER_SPEEDS.map((speed) => speed.id), ["slow", "medium", "fast"]);
  assert.equal(tickerSpeedId("nonsense"), "medium");
  assert.equal(tickerSpeedId("fast"), "fast");
  assert.equal(nextTickerSpeed("slow"), "medium");
  assert.equal(nextTickerSpeed("fast"), "slow");
  assert.equal(tickerSpeedLabelKey("fast"), "profile.tickerFast");
  const storage = new Map();
  const port = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  assert.equal(readTickerSpeed(port), "medium");
  assert.equal(writeTickerSpeed("slow", port), "slow");
  assert.equal(readTickerSpeed(port), "slow");
  assert.equal(writeTickerSpeed("nonsense", port), "medium");
  // A loop is as long as the text needs and never shorter than a readable pass.
  assert.equal(profileTickerSpan(8, "medium"), 48);
  assert.equal(profileTickerSpan(8, "slow"), 82);
  assert.equal(profileTickerSpan(1, "fast"), 26);
  assert.equal(profileTickerSpan(60, "slow"), 120);
  const band = { dataset: { ownerTickerCount: "8" }, style: { values: {}, setProperty(key, value) { this.values[key] = value; } } };
  const root = { querySelectorAll: () => [band] };
  assert.equal(applyTickerSpeed(root, "fast"), "fast");
  assert.equal(band.style.values["--tickerSpan"], "30s");
  // The profile renders the band with whatever the device chose, and the editor never offers the knob.
  assert.match(profileExperience, /const tickerSpeed = tickerSpeedOption \?\? readTickerSpeed\(\)/);
  assert.match(panels, /data-device-setting="ticker"/);
  // The row is built from the same reader the band uses, and the screen hands it over.
  assert.match(panels, /socialPresentation, tickerSpeedLabelKey, readTickerSpeed,/);
  assert.match(app, /tickerSpeedLabelKey, readTickerSpeed,/);
  assert.match(app, /if \(kind === "ticker"\) \{ writeTickerSpeed\(nextTickerSpeed\(readTickerSpeed\(\)\)\); applyTickerSpeed\(document, readTickerSpeed\(\)\); \}/);
  assert.doesNotMatch(panels, /data-device-setting="ticker"[\s\S]{0,80}data-profile-panel="profile"/);
});

test("the drawer is the seven doors, in order, and none of them is a tab", () => {
  assert.deepEqual(PROFILE_MENU_ITEMS.map((item) => item.id), ["profile", "wallet", "access", "privacy", "notifications", "appearance", "logout"]);
  assert.deepEqual(PROFILE_MENU_ITEMS.map((item) => item.label), [
    "profile.tabProfile", "profile.tabWallet", "profile.tabAccess", "profileMenu.privacy",
    "profileMenu.notifications", "profileMenu.appearance", "x.profile.logout",
  ]);
  // Every row shows a mark, and the last one is the only action in the list.
  assert.equal(PROFILE_MENU_ITEMS.every((item) => item.glyph.length >= 1), true);
  assert.equal(PROFILE_MENU_ITEMS.filter((item) => item.action).map((item) => item.id).join(","), "logout");
  assert.equal(PROFILE_MENU_ITEMS.find((item) => item.id === "logout").detail, "profile.logoutDetail");
  // The appearance row opens the device-settings panel, which keeps the app's own name for it.
  assert.equal(profileMenuView("appearance"), "settings");
  assert.equal(profileMenuView("privacy"), "privacy");
  assert.equal(profileMenuId("settings"), "appearance");
  assert.equal(profileMenuId("privacy"), "privacy");
  const markup = profileMenuMarkup({ esc, t, active: "settings" });
  assert.match(markup, /<div class="profileMenuLayer" data-profile-menu hidden>/);
  assert.match(markup, /role="dialog" aria-modal="true" aria-labelledby="profileMenuTitle" tabindex="-1"/);
  assert.match(markup, /data-modal-close data-profile-menu-close/);
  assert.equal((markup.match(/data-profile-menu-item=/g) || []).length, 7);
  assert.match(markup, /data-profile-menu-item="appearance" class="on" aria-current="true"/);
  assert.equal(markup.includes('data-profile-menu-item="logout" class="on"'), false);
  assert.match(markup, /profileMenu\.hint/);
  // The marks the rows carry are the geometric glyphs the rest of the app uses, never emoji.
  assert.doesNotMatch(markup, /data-profile-menu-item="[a-z]+"><i aria-hidden="true">[^<]*[\u{1F300}-\u{1FAFF}]/u);
});

test("the hero carries the three bars and the band sits directly above the tabs", () => {
  const hero = renderOwner();
  assert.equal(hero.includes('data-owner-menu aria-haspopup="dialog" aria-expanded="false"'), true);
  assert.match(hero, /<div class="ownerMenuSlot"><button type="button" class="ownerMenuButton" data-owner-menu/);
  assert.equal((hero.match(/class="ownerMenuBars"/g) || []).length, 1);
  assert.equal(hero.includes("ownerTicker"), true);
  // Above the tabs, below the identity: the band is the last thing before the content switcher.
  assert.equal(hero.indexOf("ownerTicker") < hero.indexOf("ownerContentTabs"), true);
  assert.equal(hero.indexOf("ownerMenuSlot") < hero.indexOf("ownerTicker"), true);
  // The tab bar is still the content switcher, and it no longer carries any settings.
  assert.match(hero, /<nav class="ownerContentTabs"/);
  assert.equal(hero.includes("data-profile-settings-tab"), false);
  // A visitor reads the same band and gets no menu: the bars are the owner's own door.
  const visitor = renderVisitor();
  assert.equal(visitor.includes("data-owner-menu"), false);
  assert.equal(visitor.includes("data-owner-ticker"), true);
});

test("the hero stops repeating the band, and keeps the facts readable for assistive tech", () => {
  const hero = renderOwner();
  // Nothing under the name prints the handle, the place or the three counters a second time.
  assert.doesNotMatch(hero, /class="ownerStats"/);
  assert.doesNotMatch(hero, /class="ownerHandle"/);
  assert.doesNotMatch(hero, /ownerLocationStatic/);
  // They exist once, in one screen-reader-only line, in the order the band reads them.
  assert.match(hero, /<p class="ownerFacts">@romeodeepsek · Kraków, Polonia · 32 profile\.posts · 1 profile\.followers · 1 profile\.following<\/p>/);
  assert.match(css, /\.ownerFacts\{position:absolute;width:1px;height:1px/);
  // The band itself stays decoration, so it is the hidden line - not the band - that carries the facts.
  assert.match(hero, /class="ownerTicker"[^>]*aria-hidden="true"/);
  // The location row is the editor, not a copy: it shows itself while the identity is being edited.
  assert.match(css, /\.ownerLocationRow\{position:relative;display:none/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerLocationRow\{display:flex\}/);
  assert.match(hero, /data-owner-location="Kraków, Polonia" aria-haspopup="listbox"/);
  // A visitor reads the same facts line and gets no editor row at all.
  const visitor = renderVisitor();
  assert.equal(visitor.includes("data-owner-location-row"), false);
  assert.equal(visitor.includes('data-owner-location="'), false);
  assert.match(visitor, /<p class="ownerFacts">@romeodeepsek · Kraków, Polonia · 32 profile\.posts/);
  assert.doesNotMatch(visitor, /class="ownerStats"/);
  // One door into the editor, two photos, and no delete or crop control anywhere: the pencil adds or
  // replaces a photo, it does not take one away, and it never asks the owner to crop one first.
  assert.equal((hero.match(/data-owner-edit/g) || []).length, 1);
  assert.equal((hero.match(/data-hero-photo=/g) || []).length, 2);
  assert.equal((hero.match(/data-hero-file=/g) || []).length, 2);
  assert.equal(hero.includes("data-hero-delete"), false);
  assert.equal(hero.includes("data-hero-crop"), false);
  assert.equal(visitor.includes("data-hero-photo="), false);
  assert.equal(visitor.includes("data-hero-file="), false);
});

test("the drawer switches a panel under the profile instead of navigating away", () => {
  // Nothing on the screen carries a settings tab any more, and the drawer is bound to the screen.
  assert.equal(app.includes("data-profile-settings-tab"), false);
  assert.equal(app.includes("profileSettingsTabs"), false);
  assert.match(app, /const profileViews = \["profile", "wallet", "access", "privacy", "notifications", "settings"\]/);
  assert.match(app, /bindProfileMenu\(vp, \{/);
  assert.match(app, /onSelect: \(id\) => setProfileSettingsView\(profileMenuView\(id\)\)/);
  assert.match(app, /onLogout: \(\) => \{ void logoutFromProfile\(\); \}/);
  assert.match(app, /markProfileMenuActive\(screen, activeTabId\(nextView\)\)/);
  assert.match(app, /if \(nextView !== "edit" && !profileViews\.includes\(nextView\)\) return;/);
  // The bar above the panels is the way back to the hero and the way into the menu.
  assert.match(panels, /<header class="accountMenuBar"><button type="button" class="accountMenuBack" data-profile-back>/);
  assert.match(panels, /data-owner-menu aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(app, /vp\.querySelector\("\[data-profile-back\]"\)\?\.addEventListener\("click", \(\) => setProfileSettingsView\("profile"\)\)/);
  // The hero owns no navigation: it asks the screen's hook for a panel.
  assert.match(app, /let profileSectionSwitcher = null;/);
  assert.match(app, /const selectProfileSection = \(id\) => profileSectionSwitcher\?\.\(id\)/);
  assert.match(app, /onContentTab: \(\) => \{ if \(host\.hidden\) selectProfileSection\("profile"\); \}/);
  // The hero is hidden only by a settings panel, never by the drawer.
  assert.match(app, /const heroView = nextView === "profile"; edit\.hidden = heroView;/);
  // Binding is real: the close control, the outside press and Escape all land on the same close.
  assert.match(menu, /layer\.querySelectorAll\("\[data-profile-menu-close\]"\)\.forEach\(\(button\) => button\.addEventListener\("click", close\)\)/);
  assert.match(menu, /if \(event\.key !== "Escape"\) return;/);
  assert.match(menu, /layer\.addEventListener\("click", \(event\) => \{[\s\S]{0,80}if \(!drawer\.contains\(event\.target\)\) close\(\);/);
  assert.match(menu, /back\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(menu, /if \(layer\.hidden\) open\(\);\n    else close\(\);/);
});

test("no setting is written twice: each control has exactly one home", () => {
  const count = (source, needle) => source.split(needle).length - 1;
  // The profile screen binds the form; it no longer builds a copy of any of these controls.
  const profileScreen = app.slice(app.indexOf("async function renderProfiles"), app.indexOf("function renderProfilePreview"));
  for (const field of ['name="visibility"', 'name="discoverability"', 'name="private_access_enabled"', 'name="message_policy"', 'name="region_code"']) {
    assert.equal(count(panels, field), 1, field);
    assert.equal(count(profileScreen, field), 0, field + " must not be rendered by the screen too");
  }
  // The privacy rows and the policy rows are two panels of one form, so one Save writes both.
  assert.match(panels, /<form id="profile-form" data-profile-key="' \+ esc\(newUploadMutationKey\("profile-save"\)\) \+ '" novalidate>/);
  assert.match(panels, /<section class="account-card privacyPanel" data-profile-panel="privacy">/);
  assert.match(panels, /<div class="profileSaveRow" data-profile-panel="profile privacy">/);
  assert.match(panels, /<\/form>/);
  assert.match(app, /const active = String\(panel\.dataset\.profilePanel \|\| ""\)\.split\(\/\\s\+\/\)\.includes\(activeTabId\(nextView\)\)/);
  // The identity fields stayed on the profile itself: the editor is the hero, not the settings form.
  assert.equal(app.includes('name="display"'), false);
  assert.equal(panels.includes('name="display"'), false);
  assert.equal(panels.includes('<textarea name="bio"'), false);
});

test("the notification preferences are one module with two surfaces", () => {
  assert.match(preferences, /export const NOTIFICATION_LABEL_KEYS/);
  assert.match(preferences, /export function notificationPreferenceForms/);
  assert.match(preferences, /export function bindNotificationPreferenceForms/);
  // The inbox renders them, and the profile menu opens them as its own panel.
  assert.match(app, /notificationPreferenceForms\(preferences, \{ esc, t, persona: settingsPersona, newKey: newUploadMutationKey \}\)/);
  assert.match(app, /bindNotificationPreferenceForms\(host, \{/);
  assert.match(panels, /data-profile-panel="notifications"/);
  assert.match(app, /api\("\/api\/notification-preferences\?persona=" \+ encodeURIComponent\(selectedPersona\)\)/);
  assert.match(app, /notificationPreferenceForms\(preferences\.preferences, \{ esc, t, persona: selectedPersona, newKey: newUploadMutationKey \}\)/);
  // A stale screen writes nothing: the panel re-checks the persona and the load gate.
  assert.match(app, /isCurrent: \(\) => loadRequest\.isCurrent\(\) && state\.persona === selectedPersona/);
});


test("the band and the drawer are styled as one dark, teal surface", () => {
  assert.match(css, /\.ownerTicker\{[^}]*pointer-events:none[^}]*user-select:none/);
  assert.match(css, /\.ownerTickerTrack\{display:flex;width:max-content;animation:ownerTickerRoll var\(--tickerSpan,48s\) linear infinite/);
  assert.match(css, /@keyframes ownerTickerRoll\{from\{transform:translate3d\(0,0,0\)\}to\{transform:translate3d\(-50%,0,0\)\}\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ownerTickerTrack\{animation:none\}\}/);
  assert.match(css, /\.ownerTickerSep\{display:inline-block;width:3px;height:3px;margin-right:11px;border-radius:50%;background:#2fbdb3/);
  assert.match(css, /\.ownerTickerCount\{display:inline-flex;align-items:baseline;gap:4px\}/);
  assert.match(css, /\.ownerMenuBars\{display:grid;width:20px;gap:4px\}/);
  assert.match(css, /\.ownerIdentity\{position:relative;display:grid;grid-template-columns:78px minmax\(0,1fr\) 40px/);
  assert.match(css, /\.ownerMenuSlot\{align-self:center;justify-self:end\}/);
  assert.match(css, /\.ownerMenuBars b\{display:block;height:2px;border-radius:2px;background:currentColor\}/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerMenuSlot\{display:none\}/);
  assert.match(css, /\.profileMenuLayer\{position:fixed;inset:0;z-index:70;display:flex;justify-content:flex-end\}/);
  assert.match(css, /\.profileMenuLayer\[hidden\]\{display:none!important\}/);
  assert.match(css, /\.profileMenuDrawer\{position:relative;display:flex;flex-direction:column;width:min\(320px,86vw\)/);
  assert.match(css, /\.profileMenuItems button\{[^}]*min-height:56px/);
  assert.match(css, /\.profileMenuItems button\.on,\.profileMenuItems button:hover\{border-color:#2fbdb3/);
  assert.match(css, /\.accountMenuBar\{position:sticky/);
  assert.equal(css.includes(".profileSettingsTabs"), false);
});

test("the four languages carry the drawer, the band and the new panels", () => {
  const keys = [
    "profileMenu.eyebrow", "profileMenu.open", "profileMenu.title", "profileMenu.hint",
    "profileMenu.privacy", "profileMenu.notifications", "profileMenu.appearance",
    "profile.backToProfile", "profile.privacyHint", "profile.tickerSpeed",
    "profile.tickerSlow", "profile.tickerMedium", "profile.tickerFast",
  ];
  for (const key of keys) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.equal((locale.match(/"profile\.followers":/g) || []).length, 4);
  // Every module the wave added is served under the wave's own asset tag.
  assert.match(index, /\/app\.js\?v=20261003-lens2/);
  for (const module of ["profile-menu.js", "profile-ticker.js", "notification-preferences.js", "profile-settings-panels.js", "profile-experience.js"]) {
    assert.equal(app.includes(`./${module}?v=20260923-wave14i`), true, module);
  }
  assert.match(index, /profile-experience\.css\?v=20260923-wave14i/);
  // Wave 14 added one more module under the same tag: the feed's own surface, and wave 14g added the
  // module that owns the small drawer of the bar (feed-hub.js).
  assert.equal(app.includes("./feed-surface.js?v=20260926-source2"), true, "feed-surface.js");
  assert.equal(app.includes("./feed-hub.js?v=20260923-wave14i"), true, "feed-hub.js");
  // Wave 14h added one more: the bottom bar's own marks and the names they are read out with moved out of
  // app.js (nav-marks.js), because that file was at its allowance and the bar grew two marks and a face.
  assert.equal(app.includes("./nav-marks.js?v=20260923-wave14i"), true, "nav-marks.js");
});
