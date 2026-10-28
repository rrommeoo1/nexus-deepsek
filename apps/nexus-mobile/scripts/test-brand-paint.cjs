/* global __dirname */
// Marca fără fundal (regula proprietarului, 17 octombrie 2026): numai literele, nicăieri un pătrat, un
// disc, un inel, o umbră sau o culoare în spatele lor — antet, login, inbox, bara unui post text.
// Și o dimensiune cerută: ~52 dp în antetul de 72 dp.
// Al doilea val (19 octombrie 2026): literele au plecat și din butonul + — acolo se desenează un plus.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

const header = read('src/components/AppHeader.tsx');
const nav = read('src/components/AppNav.tsx');
const logo = read('src/components/BrandLogo.tsx');
const login = read('src/components/NexusLogin.tsx');
const landing = read('src/components/NexusLandingBrand.tsx');
const menu = read('src/components/ProfileMenuSheet.tsx');
const inbox = read('src/components/MessengerTopbar.tsx');

/**
 * `social.ts` își ia culorile din două module pure: `theme/blackSilver.ts` (runda 31) și `theme/mercury.ts`,
 * care la rândul lui citește paleta. Stub-ul de `require` le încarcă pe amândouă, în ordinea în care le cere
 * fiecare fișier; restul rămâne un obiect gol, ca înainte.
 */
const themeModule = (name, deps) => {
  const compiled = ts.transpileModule(read(`src/theme/${name}.ts`), {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(shim.exports, (id) => deps[id] ?? {}, shim);
  return shim.exports;
};
const palette = themeModule('blackSilver', {});
const mercury = themeModule('mercury', { './blackSilver': palette });

const tokens = (() => {
  const compiled = ts.transpileModule(read('src/theme/social.ts'), {
    fileName: 'social.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const shim = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(
    shim.exports,
    (id) => ({ './mercury': mercury, './blackSilver': palette }[id] ?? {}),
    shim,
  );
  return shim.exports.socialTokens;
})();

test('mărcile sunt desenate la 52 dp, în anteturi de 72 dp', () => {
  assert.match(logo, /header: 52, large: 132/);
  assert.doesNotMatch(logo, /navSources|jb-mark-nav/, 'the 54 dp cut left with the create button');
  assert.equal(tokens.feedHeader.height, 72);
  assert.equal(tokens.appHeader.height, 72);
});

test('antetul nu mai are text de versiune sub marcă', () => {
  assert.doesNotMatch(header, /BuildBadge/, 'the build badge left the header');
  assert.doesNotMatch(header, /wordmarkBuild/, 'no wordmark build slot is drawn');
  assert.doesNotMatch(header, /build\?:/, 'the header takes no build prop any more');
  // Versiunea are exact două locuri: subsolul meniului ≡ și Setări › Despre (sertarul a ieșit).
  assert.match(menu, /styles\.footBuild/);
  assert.match(read('src/screens/SettingsScreen.tsx'), /Build JS/);
});

test('niciun dreptunghi, inel sau umbră în spatele mărcii din antetul ecranelor și din bara de jos', () => {
  const wordmark = header.slice(header.indexOf('wordmarkScreen:'));
  const block = wordmark.slice(0, wordmark.indexOf('},') + 2);
  assert.doesNotMatch(block, /borderWidth|borderColor|backgroundColor|shadow/, 'the header door is plain');
  assert.match(block, /width: 52/);

  /**
   * The create cell is the one exception, and it is the owner's (20 October 2026): `+` is a platinum disc
   * again — `.appNav .createNav`'s metal — drawn in four stops with a specular arc, and a dark plus on it.
   */
  assert.match(nav, /function CreateDisc\(\) \{/, 'the create cell has its own drawing');
  assert.match(nav, /<RadialGradient/, 'the disc is metal, not a flat circle');
  assert.match(nav, /disc\.polish\.map/, 'the stops come from the theme, not from the component');
  assert.doesNotMatch(nav, /BrandLogo/, 'the brand letters left the + button (owner, 19 October 2026)');
  assert.match(nav, /<PlusMark size=\{disc\.glyphSize\} color=\{colors\.createGlyph\}/, 'plusul este grafit pe metalul Mercury');
  assert.match(nav, /accessibilityLabel=\{counting \?/);
});

test('login-ul și inbox-ul arată marca fără ramă și fără versiune sub ea', () => {
  assert.doesNotMatch(landing, /borderWidth|backgroundColor|borderRadius|shadow/);
  assert.doesNotMatch(login, /styles\.version|<Text style=\{styles\.version\}/);
  assert.doesNotMatch(login, /version: string/);
  assert.match(login, /<View style=\{styles\.brand\}>\{brand\}<\/View>/);
  // Inbox-ul folosește componenta comună: nu desenează un disc în jurul ei.
  assert.match(inbox, /<BrandLogo variant="header" \/>/);
  assert.doesNotMatch(inbox, /BrandLogo[^>]*style=/, 'no frame is passed to the mark');
});
