/* global __dirname, process */
// The profile header, after the owner's own decision. Until wave 19 this file held the phone against the web
// hero, value for value (`.ownerCover{height:72px}`, `.ownerAvatar{78px}`, the 17px name line, the pencil at the
// end of the band's row). The owner replaced that header on purpose — no cover, a big identity block, the
// counters in a fixed row and a row of full-width relation buttons — and asked for it to be written down as a
// design decision of the owner, not as a parity failure. So this file now guards **the decision and what it
// left alone**:
//
//   * the cover is gone from the whole native profile path (screen and editor), and nothing was deleted on the
//     server: the record keeps its `cover`, the phone simply draws no band for it;
//   * the header is the reference's arrangement, drawn from `socialTokens.identity` / `socialTokens.relations`
//     with the product's own ink — the measured target and the button states are held in
//     `scripts/test-relations.cjs`, and the values come from `docs/PARITY-MATRIX.md`;
//   * the band keeps the module's readings minus the three counters, which now stand in the fixed row;
//   * the bar of tabs and the content region under it are **untouched** (`test-profile-content-parity.cjs`
//     still holds those), and the screen keeps its pull-to-refresh, its skeleton and its honest error state.
//
// 1:1 web parity for this header comes back the day the owner asks for it (the last section of
// `docs/PARITY-MATRIX.md` says so in one sentence).
//
// Usage: node scripts/test-hero-parity.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..', '..');
const HEADER = resolve(ROOT, 'src/components/ProfileHeader.tsx');
const SCREEN = resolve(ROOT, 'src/screens/ProfileScreen.tsx');
const EDIT_SHEET = resolve(ROOT, 'src/components/ProfileEditSheet.tsx');
const TICKER = resolve(ROOT, 'src/components/ProfileTicker.tsx');
const BUTTON = resolve(ROOT, 'src/components/RelationButton.tsx');
const MATRIX = resolve(REPO, 'docs/PARITY-MATRIX.md');
const MIGRATION = resolve(ROOT, 'MIGRATION.md');

const headerSource = readFileSync(HEADER, 'utf8');
const screenSource = readFileSync(SCREEN, 'utf8');
const editSource = readFileSync(EDIT_SHEET, 'utf8');
const tickerSource = readFileSync(TICKER, 'utf8');
const buttonSource = readFileSync(BUTTON, 'utf8');

/** The tokens, compiled the way the app's other scripts compile TS. */
const tokens = (() => {
  const compiled = ts.transpileModule(readFileSync(resolve(ROOT, 'src/theme/social.ts'), 'utf8'), {
    fileName: 'social.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const shim = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(shim.exports, () => ({}), shim);
  return shim.exports.socialTokens;
})();

test('decizia de design a proprietarului este scrisă, în ambele registre', () => {
  const matrix = readFileSync(MATRIX, 'utf8');
  assert.match(matrix, /decizie de design a proprietarului/i, 'PARITY-MATRIX.md names the decision as the owner\'s');
  assert.match(matrix, /antet/i, 'and names the header it is about');
  const migration = readFileSync(MIGRATION, 'utf8');
  assert.match(migration, /## 19\./, 'MIGRATION.md carries the section of the wave');
  assert.match(migration, /19\.2/, 'and the header decision inside it');
});

test('coperta a plecat din tot parcursul profilului nativ, fără să atingă serverul', () => {
  assert.doesNotMatch(screenSource, /ProfileCoverPhoto|mediaSourceForPath\(profile\?\.cover\)|cover_focus/);
  assert.doesNotMatch(editSource, /ProfileCoverPhoto|coverFrame|pickPhoto\('cover'\)/);
  // The only mention of the cover's purpose left in the editor is the uploader's own union type: nothing is
  // ever uploaded for it, because nothing in the header draws it.
  assert.doesNotMatch(editSource, /photoUrl\(draft\.cover|photoUrl\(draft\.cover/);
  // The picture is still a real field of the record: the phone stops drawing it, it does not delete it.
  const api = readFileSync(resolve(REPO, 'apps/nexus-web/lib/api.js'), 'utf8');
  assert.match(api, /cover: profile\.cover/, 'the payload still carries the cover the record holds');
  assert.match(screenSource, /useRelation\(data\?\.profile\?\.user_id\)/, 'the screen reads the record it always read');
});

test('antetul este blocurile cerute, din tokenurile produsului', () => {
  const identity = tokens.identity;
  const buttons = tokens.relations;
  assert.equal(identity.avatarSize, 92);
  assert.equal(identity.nameSize, 28);
  assert.equal(identity.handleSize, 15);
  assert.equal(identity.statCountSize, 20);
  assert.equal(identity.statLabelSize, 14);
  assert.equal(identity.minTarget, 44, 'țintele de atingere rămân 44dp');
  assert.equal(buttons.buttonHeight, 38);
  assert.equal(buttons.buttonGap, 8);
  assert.equal(buttons.roundSize, 38);

  assert.match(headerSource, /styles\.topRow/, 'rândul de sus');
  assert.match(headerSource, /styles\.identity/, 'blocul de identitate');
  assert.match(headerSource, /styles\.stats/, 'rândul fix de statistici');
  assert.match(headerSource, /styles\.buttons/, 'rândul de butoane');
  assert.match(headerSource, /styles\.about/, 'descrierea, locul și vârsta');
  assert.match(headerSource, /styles\.avatarRing/, 'inelul de story al cercului mare');
  assert.match(headerSource, /hasUnseenStory/);
  // The reader's own row is the bars; somebody else's is the arrow and the share.
  assert.match(headerSource, /Deschide meniul de setări/);
  assert.match(headerSource, /accessibilityLabel="Înapoi"/);
  assert.match(headerSource, /HEADER_WORDS\.share/);
  // The three counters are named and ordered as the owner asked, with the third one a real count of posts.
  assert.match(headerSource, /HEADER_WORDS\.following/);
  assert.match(headerSource, /HEADER_WORDS\.followers/);
  assert.match(headerSource, /HEADER_WORDS\.posts/);
  assert.match(headerSource, /counts\.posts/);
});

test('ce nu există pe server nu se desenează', () => {
  // No per-account notifications route: no bell. No verification field: no badge. No website field: the address
  // lives in the description. All three are said out loud in the header itself.
  assert.doesNotMatch(headerSource, /🔔|<Bell/);
  assert.match(headerSource, /no verification field/);
  assert.match(headerSource, /where an address lives/);
  // The description is read as a link where it carries one, exactly as the band reads it.
  assert.match(headerSource, /bioTokens\(bio\)/);
  assert.match(headerSource, /openLink/);
  assert.match(headerSource, /Vezi mai mult/);
});

test('antetul tipărește fiecare citire o singură dată, iar bara și conținutul rămân neatinse', () => {
  // §19.2 asked for the description, the address inside it, the place and the age under the buttons, and the
  // three counters in the fixed row above them. The band under the header used to print the same words again,
  // so this screen no longer draws one: the header is the only place a reading stands, and the column carries
  // each of them exactly once.
  assert.doesNotMatch(screenSource, /<ProfileTicker/, 'the band no longer repeats what the header prints');
  assert.doesNotMatch(screenSource, /styles\.bandRow|styles\.bandCell/, 'its row and cell went with it');
  // The component keeps the module's full list for any surface that has no header of its own. Both switches
  // are on by default: `counters` and `identity`, the two groups the owner's header took over.
  assert.match(tickerSource, /export function tickerItems\(profile: ProfileView \| null, counters = true, identity = true\)/);
  // The band still carries the counters when nothing else prints them: the module's own list stays intact.
  assert.match(tickerSource, /if \(counters\) \{[\s\S]*kind: 'posts'[\s\S]*kind: 'followers'[\s\S]*kind: 'following'/);
  // And the identity readings (description, place, age, handle) too, in the module's order.
  assert.match(tickerSource, /if \(identity\) \{[\s\S]*kind: 'bio'[\s\S]*kind: 'location'[\s\S]*kind: 'age'[\s\S]*kind: 'handle'/);
  // The bar of tabs and the content region are the wave-17 work, untouched here.
  assert.match(screenSource, /accessibilityRole="tablist"/);
  assert.match(screenSource, /styles\.tabsBlock/);
  assert.match(screenSource, /styles\.flowStream|styles\.grid|styles\.whisperList/);
  // Pull-to-refresh, the skeleton and the honest error state stay where they were.
  assert.match(screenSource, /<RefreshControl refreshing=\{refreshing\} onRefresh=\{onRefresh\}/);
  assert.match(screenSource, /<ActivityIndicator color=\{socialTokens\.colors\.white\}/);
  assert.match(screenSource, /<Pressable accessibilityRole="button" onPress=\{onRetry\} style=\{styles\.retry\}>/);
  assert.match(screenSource, /<Text style=\{styles\.retryText\}>Reîncearcă<\/Text>/);
});

test('butonul de relație este cel al aplicației, iar conținutul ascuns este spus, nu ghicit', () => {
  assert.match(buttonSource, /deriveRelationUi/);
  assert.match(headerSource, /ui\.message\.enabled/);
  // The hidden region's sentence comes from the same function the button reads (blocked / private / waiting).
  assert.match(headerSource, /ui\.primary\.action !== 'none'/);
  // Nothing on the band writes anything: it is still the band.
  assert.doesNotMatch(tickerSource, /RelationButton/);
});


