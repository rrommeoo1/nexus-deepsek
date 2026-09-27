// The description is the one place on a profile where an owner can point somewhere else: it stays the
// text they wrote, and only an explicit http(s) address behaves like a link.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileBioMarkup } from "../public/profile-bio-text.js";
import { renderOwnerProfileExperience } from "../public/profile-experience.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const heroEdit = readFileSync(new URL("../public/profile-hero-edit.js", import.meta.url), "utf8");
const profileExperience = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");

const anchor = (href, label) => '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';

test("a description stays the text it was written as", () => {
  assert.equal(profileBioMarkup("Citesc orasul dimineata."), "Citesc orasul dimineata.");
  assert.equal(profileBioMarkup("Linia unu\nLinia doi"), "Linia unu\nLinia doi");
  assert.equal(profileBioMarkup(""), "");
  assert.equal(profileBioMarkup(null), "");
  assert.equal(profileBioMarkup(undefined), "");
  assert.equal(profileBioMarkup("<b>nu</b> & gata"), "&lt;b&gt;nu&lt;/b&gt; &amp; gata");
  assert.equal(profileBioMarkup('ganduri "noi" & vechi'), 'ganduri &quot;noi&quot; &amp; vechi');
});

test("an address in a description becomes a link in a new tab", () => {
  assert.equal(profileBioMarkup("Vezi https://nexus.example/hello"), "Vezi " + anchor("https://nexus.example/hello", "https://nexus.example/hello"));
  assert.equal(profileBioMarkup("A si B, https://a.example si http://b.example/x?y=1"),
    "A si B, " + anchor("https://a.example", "https://a.example") + " si " + anchor("http://b.example/x?y=1", "http://b.example/x?y=1"));
  // A query string is escaped once: the attribute carries &amp; and the browser reads it back as &.
  assert.equal(profileBioMarkup("https://nexus.example/a?b=1&c=2"), anchor("https://nexus.example/a?b=1&amp;c=2", "https://nexus.example/a?b=1&amp;c=2"));
  assert.equal(profileBioMarkup("www.nexus.example/x"), anchor("https://www.nexus.example/x", "www.nexus.example/x"));
});

test("the punctuation of the sentence stays outside the link", () => {
  assert.equal(profileBioMarkup("Vezi https://nexus.example/x."), "Vezi " + anchor("https://nexus.example/x", "https://nexus.example/x") + ".");
  assert.equal(profileBioMarkup("(vezi https://nexus.example/x)"), "(vezi " + anchor("https://nexus.example/x", "https://nexus.example/x") + ")");
  assert.equal(profileBioMarkup("vezi https://nexus.example/wiki/Foo_(bar)"), "vezi " + anchor("https://nexus.example/wiki/Foo_(bar)", "https://nexus.example/wiki/Foo_(bar)"));
});

test("only http and https can become a link", () => {
  for (const hostile of ["javascript:alert(1)", "data:text/html,ceva", "vbscript:msgbox", "file:///c:/x"]) {
    assert.equal(profileBioMarkup(hostile).includes("<a "), false, hostile);
  }
  assert.equal(profileBioMarkup("apasa javascript:alert(1) acum"), "apasa javascript:alert(1) acum");
});

test("the hero keeps the text and renders the links", () => {
  assert.equal(profileExperience.includes("profile.bio ? bioOf(profile.bio)"), true);
  assert.equal(profileExperience.includes("esc(profile.bio || '')"), true);
  assert.equal(app.includes("bioMarkup: (text) => profileBioMarkup(text, esc)"), true);
  assert.equal(heroEdit.includes("parts.bioText.dataset.heroValue = body.bio;"), true);
  assert.equal(heroEdit.includes("parts.bioText.innerHTML = body.bio ? bioOf(body.bio)"), true);
  assert.equal(heroEdit.includes('if (event.target?.closest?.("a")) return;'), true);
  assert.equal(css.includes(".ownerBio a,.ownerBio a:visited{color:#67f5ed"), true);
  assert.equal(css.includes("template") || css.includes("white-space:pre-line"), true);
});

test("the copy for the identity editor exists in four languages", () => {
  for (const key of ["profile.editHint", "profileEdit.moreSummary"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.equal(locale.includes("profile.editAssetsDetail"), false, "the settings shortcut key is gone");
});

// The app escapes text with the DOM, which leaves quotes alone: an attribute written with a quote in it
// would break the value the editor reads back, so the hero escapes its attributes itself.
test("a quote in the identity cannot break the value the editor reads back", () => {
  const host = {
    html: "", hidden: false,
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const appEsc = (value) => String(value ?? "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));
  renderOwnerProfileExperience(host, {
    profile: {
      user_id: 22, handle: "p8_identity", persona: "social", name: 'Romeo "Deep" Cojan',
      bio: 'Linia unu\nVezi https://nexus.example/x "acolo"', location: "Bucuresti Nord",
      avatar: null, cover: null, visibility: "public", is_self: true,
      counts: { posts: 0, followers: 0, following: 0 },
    },
    posts: [], stories: [], albums: [],
  }, { esc: appEsc, safeUrl: () => "", t: (key) => key, bioMarkup: (value) => profileBioMarkup(value, appEsc) });
  assert.equal(host.html.includes('data-hero-value="Romeo &quot;Deep&quot; Cojan"'), true, "the name attribute escapes its quotes");
  assert.equal(host.html.includes('data-hero-value="Linia unu\nVezi https://nexus.example/x &quot;acolo&quot;"'), true, "the description attribute escapes its quotes and keeps its lines");
  assert.equal(host.html.includes('data-owner-location="Bucuresti Nord"'), true, "the city is written into the attribute as it is");
  assert.equal(host.html.includes('<a href="https://nexus.example/x" target="_blank" rel="noopener noreferrer">https://nexus.example/x</a>'), true, "the address in the description is a link");
});
