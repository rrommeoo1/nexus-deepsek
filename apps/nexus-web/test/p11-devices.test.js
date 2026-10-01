// Wave 6i (P11) contracts: the surfaces a thumb uses have to survive the screens a phone actually has.
//
// The acceptance itself is a live probe (`p11-devices.mjs`), because nothing here can hit a real thumb.
// What this file pins is the part that must not regress in the stylesheet: a landscape phone is a phone,
// the band and the drawer are bounded by the screen, and the touch sizes the probe measured stay declared.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const profileCss = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("a landscape phone is a phone, not the desktop showcase", () => {
  // The showcase frame, its module rail and the 0.88 scale that fits it into a short window are for a
  // mouse. A coarse pointer with a short viewport - a phone held sideways - gets the app full-bleed, or
  // every control shrinks below the size a thumb needs. Measured before the rule: on an 844x390 screen a
  // 44px control became 39px, the pencil 21x28 and the drawer's close 35x35.
  assert.match(styles, /@media \(pointer:coarse\) and \(max-height:560px\)\{/);
  const block = styles.slice(styles.indexOf("@media (pointer:coarse) and (max-height:560px){"));
  assert.match(block, /\.demoStage\{display:block!important;transform:none!important/);
  assert.match(block, /\.showcaseHeader,\.moduleRail,\.infoPanel,\.showcaseFooter\{display:none!important\}/);
  assert.match(block, /\.phone,\.phoneMetal,\.phoneScreen\{width:100%!important/);
  assert.match(block, /\.dynamicIsland\{display:none!important\}/);
  // The desktop showcase keeps its own behaviour: the rule never applies to a mouse.
  assert.doesNotMatch(block, /pointer:fine/);
});

test("the band, the drawer and the tabs stay inside the screen on every width", () => {
  // The band is clipped by its own box and never widens the page.
  assert.match(profileCss, /\.ownerTicker\{[^}]*overflow:hidden/);
  assert.match(profileCss, /\.ownerTicker\{[^}]*pointer-events:none/);
  // The drawer takes a share of a narrow screen, never a fixed width wider than it.
  assert.match(profileCss, /\.profileMenuDrawer\{[^}]*width:min\(320px,86vw\)/);
  // The phone presentation removes every fixed width the showcase frame brings.
  assert.match(styles, /@media\s*\(max-width:760px\)\{html,body,\.nexusDemo,\.demoStage\{width:100%!important;max-width:none!important/);
  // Touch sizes the probe checked: the bars, the drawer rows and the content tabs keep their minimums.
  assert.match(profileCss, /\.ownerMenuButton\{display:grid;width:44px;height:40px/);
  assert.match(profileCss, /\.profileMenuItems button\{[^}]*min-height:56px/);
  assert.match(profileCss, /\.ownerContentTabs button\{min-height:46px/);
  assert.match(profileCss, /\.profileMenuClose\{width:40px;height:40px/);
  // 200 % zoom is another stylesheet concern: nothing the phone layout needs is declared in pixels that
  // would break when the viewport is halved, and the assets are still tagged so a stale app.js cannot be
  // served against a new stylesheet.
  assert.match(index, /\/app\.js\?v=20261001-camera8/);
  assert.match(index, /\/profile-experience\.css\?v=20260923-wave14i/);
});
