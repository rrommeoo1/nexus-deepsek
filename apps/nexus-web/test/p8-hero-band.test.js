import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileTickerItems, profileTickerMarkup } from "../public/profile-ticker.js";
import { renderOwnerProfileExperience } from "../public/profile-experience.js";

const css = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const profileTicker = readFileSync(new URL("../public/profile-ticker.js", import.meta.url), "utf8");

const NOW = Date.parse("2026-09-20T12:00:00Z");
const owner = Object.freeze({
  user_id: 19, handle: "romeodeepsek", persona: "social", name: "Romeo Deepsek",
  bio: "Linia unu\nLinia doi. Linia trei · Linia patru", avatar: null, cover: null,
  visibility: "public", is_self: true, counts: { posts: 27, followers: 128, following: 312 },
});
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const fakeNode = () => ({ dataset: {}, hidden: false, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, setAttribute() {}, addEventListener() {} });

function profileHost() {
  const empty = fakeNode();
  return {
    html: "",
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === "[data-owner-empty-for]" ? [] : []),
    ...{ __empty: empty },
  };
}

function renderOwner() {
  const host = profileHost();
  renderOwnerProfileExperience(host, { profile: owner, posts: [], stories: [] }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t: (key) => key, locale: "ro-RO", now: NOW,
    controls: () => ({ summary: "", palette: "", drawer: "" }),
  });
  return host.innerHTML;
}

test("the hero stops printing the description the band already carries", () => {
  const block = css.match(/\.ownerBioBlock\{([^}]*)\}/);
  assert.ok(block, "the description block has its own rule");
  // Out of the visual flow, for a reader and for the owner alike: the words are read in the band and written
  // in the panel, so the hero keeps one paragraph for the screen reader and never a second copy on screen.
  assert.match(block[1], /clip-path:inset\(50%\)/);
  assert.equal(/display:grid/.test(block[1]), false, "the reading view does not lay the description out");
  assert.equal(/\.nexusOwnerProfile\.heroEditing \.ownerBioBlock\{/.test(css), false, "editing does not drag the paragraph back into the flow: its field is a row of the panel");
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerLocationRow\{display:flex\}/);
});

test("the description stays in the document even though the band is decoration", () => {
  const html = renderOwner();
  // The words are still rendered once, as one paragraph, so a screen reader reads them: the band is
  // aria-hidden and a fact that lives only inside decoration is a fact lost.
  assert.match(html, /<p class="ownerBio[^"]*" data-hero-bio-text>/);
  assert.equal(html.includes("Linia trei"), true);
  const band = html.match(/<div class="ownerTicker"[^>]*>/);
  assert.ok(band, "the band is rendered");
  assert.match(band[0], /aria-hidden="true"/);
  // The facts line carries the handle, the location and the counters once.
  const facts = html.match(/<p class="ownerFacts">([^<]*)<\/p>/);
  assert.ok(facts, "the facts line exists");
  assert.match(facts[1], /@romeodeepsek/);
});

test("the band carries every line of the description, not only the first three", () => {
  const items = profileTickerItems(owner, { t: (key) => key, locale: "ro-RO" });
  const words = items.filter((item) => item.kind === "bio").map((item) => item.value);
  assert.deepEqual(words, ["Linia unu", "Linia doi.", "Linia trei", "Linia patru"]);
  // A long description is carried whole rather than summarised, and the cycle is still bounded.
  const long = profileTickerItems({ ...owner, bio: Array.from({ length: 12 }, (unused, index) => "linia " + (index + 1)).join("\n") }, { t: (key) => key });
  assert.equal(long.filter((item) => item.kind === "bio").length, 8);
  const markup = profileTickerMarkup({ ...owner, bio: "x".repeat(400) }, { esc, t: (key) => key, locale: "ro-RO" });
  assert.equal(markup.includes("x".repeat(95) + "…"), true);
  assert.equal(markup.includes("x".repeat(96) + "…"), false);
  // The band still holds no interactive element.
  assert.equal(/<(button|a|input)\b/.test(markup), false);
  assert.match(profileTicker, /PROFILE_TICKER_MAX_SPAN/);
});

// The owner's profile as it is actually read on a phone. These three tests measure the layout contract
// (where the words sit relative to a photo), the lock that is a setting, and the band's newest item.
function renderOwnerProfile(profile) {
  const host = profileHost();
  renderOwnerProfileExperience(host, { profile, posts: [], stories: [] }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t: (key) => key, locale: "ro-RO", now: NOW,
    visibilityLabel: (visibility) => "visibilityLabel:" + visibility,
    controls: () => ({ summary: "", palette: "", drawer: "" }),
  });
  return host.innerHTML;
}

test("the name is read under the cover, and the portrait keeps the band", () => {
  // Wave 9v: wave 6t pulled the identity row over the cover so the portrait overlaps it, and the words
  // travelled with it - the name, the lock and the presence line landed on the photo, where a bright cover
  // made them faint. The row still overlaps; everything that is words starts under it.
  assert.match(css, /\.nexusOwnerProfile\{--heroOverlap:46px\}/);
  // Wave 10 gave the row a second variable and a different shape: the words still start under the cover,
  // measured from the same overlap, and the portrait became the row itself instead of a circle floating
  // beside it. The wave-9v rules are still the layer above; these are the ones that decide.
  assert.match(css, /\.nexusOwnerProfile\{--portraitSize:104px;--heroWordTop:calc\(var\(--heroOverlap\) \+ 4px\)\}/);
  // Wave 11: the row stopped being three columns with a floating menu slot. The sign, the name and the
  // three bars are one line inside one flex column, so they can never drift apart when the row grows.
  assert.match(css, /\.ownerIdentity\{grid-template-columns:var\(--portraitSize\) minmax\(0,1fr\);gap:12px;align-items:stretch\}/);
  assert.match(css, /\.ownerAvatarSlot\{align-self:center;width:var\(--portraitSize\);height:var\(--portraitSize\)\}/);
  assert.match(css, /\.ownerIdentityText\{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;align-content:center;padding-top:var\(--heroWordTop\)\}/);
  assert.match(css, /\.ownerIdentityText h1\{flex:1 1 auto;min-width:0\}/);
  assert.match(css, /\.ownerMenuSlot\{flex:0 0 auto;align-self:center;margin:0 0 0 auto;padding-top:0\}/);
  assert.match(css, /\.nexusOwnerProfile\[data-profile-cover="1"\] \.ownerIdentityText\{padding-top:calc\(var\(--heroOverlap\) \+ 6px\)\}/);
  // One line for the words: the name gives way with an ellipsis before the lock ever moves, on the owner's
  // line and on a visitor's alike.
  assert.match(css, /\.ownerIdentityText h1\{flex-wrap:nowrap;font-size:19px;line-height:1\.2\}/);
  // And the bars are inside that line, not on a row of their own: the markup nests the menu slot in the
  // identity text, and the line is the one row the owner asked for between the cover and the band.
  const oneRow = renderOwnerProfile(owner);
  assert.match(oneRow, /<div class="ownerIdentityText"><h1>[\s\S]*<\/h1><p class="ownerFacts">[\s\S]*?<\/p><div class="ownerMenuSlot"><button type="button" class="ownerMenuButton" data-owner-menu/);
  assert.equal(/<\/div><div class="ownerMenuSlot">/.test(oneRow), false, "no second row for the bars");
  assert.match(css, /\.ownerIdentityText h1>bdi\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  // Without a cover there is nothing to overlap, and the words do not pay for a band that is not drawn.
  assert.match(css, /\.nexusOwnerProfile\[data-profile-cover="0"\]\{--heroOverlap:0px\}/);
  // A narrow phone pulls the row up by less, and the words follow that same number instead of a second one.
  assert.match(css, /@media\(max-width:400px\)\{\.nexusOwnerProfile\{--heroOverlap:32px\}\}/);
  assert.match(css, /\.ownerIdentityText h1\{font-size:19px;color:#f4fbfd/);
  // The portrait is still on the band, pulled up by the number the words are offset by.
  assert.match(css, /\.nexusOwnerProfile\[data-profile-cover="1"\] \.ownerIdentity\{margin-top:-46px\}/);
});

test("the lock beside the name is the lock, and the owner opens the setting behind it", () => {
  // Wave 11: the sign is always on the owner's line, and the sign is the padlock itself - closed while the
  // profile is not public, open while it is. The words stay in the tooltip and the accessible name.
  const locked = renderOwnerProfile({ ...owner, visibility: "friends" });
  const chip = locked.match(/<button type="button" class="ownerVisibility ([^"]*)"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(chip, "the owner's lock is a control");
  assert.equal(chip[1], "isLocked", "a profile that is not public reads a closed padlock");
  assert.equal(chip[2], '<i aria-hidden="true">🔒</i>', "the chip is the lock and nothing else");
  assert.match(chip[0], /aria-label="visibilityLabel:friends"/);
  assert.match(chip[0], /title="visibilityLabel:friends"/);
  assert.equal(locked.includes("data-owner-visibility"), true, "it opens the panel that edits it");
  const open = renderOwnerProfile({ ...owner, visibility: "public" });
  const openChip = open.match(/<button type="button" class="ownerVisibility ([^"]*)"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(openChip, "a public profile still shows the owner its own state");
  assert.equal(openChip[1], "isOpen");
  assert.equal(openChip[2], '<i aria-hidden="true">🔓</i>');
  assert.match(openChip[0], /aria-label="visibilityLabel:public"/);
  assert.equal(open.includes("data-owner-visibility"), true, "the open sign opens the same panel");
  // A visitor reads the same lock, with no control and no raw word on the line, and reads no sign at all on
  // a profile that is public: the lock is information, the open padlock on somebody else is noise.
  const visitor = renderOwnerProfile({ ...owner, visibility: "friends", is_self: false });
  assert.match(visitor, /<span class="ownerVisibility isLocked" role="img" aria-label="🔒 visibilityLabel:friends"/);
  assert.equal(visitor.includes("data-owner-visibility"), false);
  assert.equal(visitor.includes("visibilityLabel:friends</bdi>"), false, "the word is not printed beside the name");
  assert.equal(renderOwnerProfile({ ...owner, visibility: "public", is_self: false }).includes("ownerVisibility"), false);
});

test("a declared age travels in the band next to the place, and nothing invents one", () => {
  const items = profileTickerItems({ ...owner, location: "Kraków, Polonia", age: 43 }, { t: (key) => key, locale: "ro-RO" });
  assert.deepEqual(items.slice(0, 3).map((item) => item.kind), ["location", "age", "handle"]);
  assert.deepEqual(items[1], { kind: "age", icon: "🎂", count: "43", label: "profile.years" });
  // A profile without one carries no such item, and a number that is not a whole year is not an age.
  assert.equal(profileTickerItems(owner, { t: (key) => key }).some((item) => item.kind === "age"), false);
  assert.equal(profileTickerItems({ ...owner, age: 12 }, { t: (key) => key }).some((item) => item.kind === "age"), false);
  assert.equal(profileTickerItems({ ...owner, age: 121 }, { t: (key) => key }).some((item) => item.kind === "age"), false);
  assert.equal(profileTickerItems({ ...owner, age: "43" }, { t: (key) => key }).some((item) => item.kind === "age"), false, "a string is not a year the owner declared");
  // The band is aria-hidden decoration, so the same fact is on the facts line a screen reader reads.
  const html = renderOwnerProfile({ ...owner, age: 43 });
  assert.match(html.match(/<p class="ownerFacts">([^<]*)<\/p>/)[1], /43 profile\.years/);
});

test("a presence is a dot, and the band of facts stays home on a profile that is not public", () => {
  // Wave 10: the name line printed "Online" under the name, which spent a whole row on a word that a dot
  // says better. The words are still there - in the tooltip and the accessible name - and the dot says
  // which of the two states it is: green for someone who is there, yellow for a presence this reader may
  // see but who is not online at this moment.
  const online = renderOwnerProfile({ ...owner, presence: { visible: true, online: true } });
  assert.match(online, /<em class="ownerPresence isOnline" role="img" aria-label="profile\.presenceOnline" title="profile\.presenceOnline"><i><\/i><\/em>/);
  assert.equal(online.includes(">Online<"), false, "the word is not printed in the name line");
  const away = renderOwnerProfile({ ...owner, presence: { visible: true, online: false } });
  assert.match(away, /<em class="ownerPresence isAway" role="img" aria-label="profile\.presenceAway"/);
  assert.match(css, /\.ownerIdentityText h1 \.ownerPresence\.isAway i\{background:#ffd166/);
  // A presence that this reader may not see prints nothing at all.
  assert.equal(renderOwnerProfile(owner).includes("ownerPresence"), false);
  // The band is built from what the record says, so a private profile keeps it: the owner always reads
  // their own band, a public profile shares it with everyone who can read the profile, and a visitor on a
  // profile that is not public gets no band and no empty row where it was.
  assert.match(renderOwnerProfile({ ...owner, visibility: "private" }), /data-owner-ticker/);
  assert.match(renderOwnerProfile({ ...owner, is_self: false, visibility: "public" }), /data-owner-ticker/);
  const privateVisitor = renderOwnerProfile({ ...owner, is_self: false, visibility: "private" });
  assert.equal(privateVisitor.includes("data-owner-ticker"), false);
  assert.equal(privateVisitor.includes("ownerTickerRow"), false, "no empty row is left behind either");
  // The lock is still the setting for the owner, and the visitor reads it without a control.
  assert.match(renderOwnerProfile({ ...owner, is_self: false, visibility: "private" }), /<span class="ownerVisibility isLocked" role="img"/);
});

test("the band above the identity can be the shelf of saved stories instead of a cover", () => {
  const stories = [{ id: 1, media: { hash: "a".repeat(64), ext: "png", kind: "image" }, caption: "Ziua unu" }];
  const host = profileHost();
  renderOwnerProfileExperience(host, { profile: { ...owner, cover_mode: "stories" }, posts: [], stories }, {
    esc, safeUrl: (value) => (value ? String(value) : ""), t: (key) => key, locale: "ro-RO", now: NOW,
    controls: () => ({ summary: "", palette: "", drawer: "" }),
  });
  const html = host.innerHTML;
  assert.match(html, /data-cover-mode="stories"/);
  // The rail is in the markup either way and the mode decides which of the two is on screen, so the switch
  // is one attribute on the section: no re-render, no second copy of the tiles.
  assert.match(html, /<div class="ownerStoryRail" data-owner-story-rail>/);
  assert.match(html, /<div class="ownerStoryTiles">/);
  assert.match(html, /data-profile-moment="0"/);
  assert.match(css, /\.nexusOwnerProfile\[data-cover-mode="stories"\]\{--heroOverlap:0px\}/);
  assert.match(css, /\.nexusOwnerProfile\[data-cover-mode="stories"\] \.ownerCover\{display:none\}/);
  assert.match(css, /\.nexusOwnerProfile\[data-cover-mode="stories"\] \.ownerStoryRail\{display:grid/);
  // Wave 11: the shelf keeps its own row between the name line and the band - the order the owner reads the
  // page in - and the cover keeps the place above the identity it always had.
  const identityAt = html.indexOf("ownerIdentityText");
  const railAt = html.indexOf("data-owner-story-rail");
  const tickerAt = html.indexOf("ownerTickerRow");
  assert.ok(identityAt > -1 && railAt > -1 && tickerAt > -1, "the owner's page carries all three rows");
  assert.ok(identityAt < railAt && railAt < tickerAt, "the shelf is the row between the name and the band");
  assert.ok(html.indexOf("class=\"ownerCover\"") < identityAt, "the cover is still above the identity");
  // A record that never chose reads exactly as it did before: the cover is the default, and a profile with
  // no stories yet says so in the rail instead of showing an empty strip.
  assert.match(renderOwnerProfile(owner), /data-cover-mode="cover"/);
  assert.match(renderOwnerProfile({ ...owner, cover_mode: "stories" }), /profile\.empty\.moments\.detail/);
});

