/* global __dirname */
// Marca fără fundal (regula proprietarului, 17 octombrie 2026): numai literele, nicăieri un pătrat, un
// disc, un inel, o umbră sau o culoare în spatele lor — antet, bara de jos, login, sertar, inbox.
// Și două dimensiuni cerute: ~52 dp în antetul de 72 dp, ~54 dp în butonul central.
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
const drawer = read('src/components/FeedDrawer.tsx');
const inbox = read('src/components/MessengerTopbar.tsx');

const tokens = (() => {
  const compiled = ts.transpileModule(read('src/theme/social.ts'), {
    fileName: 'social.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const shim = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(shim.exports, () => ({}), shim);
  return shim.exports.socialTokens;
})();

test('mărcile sunt desenate la 52 dp (antet) și 54 dp (butonul central), în anteturi de 72 dp', () => {
  assert.match(logo, /header: 52, nav: 54, large: 132/);
  assert.equal(tokens.feedHeader.height, 72);
  assert.equal(tokens.appHeader.height, 72);
});

test('antetul nu mai are text de versiune sub marcă', () => {
  assert.doesNotMatch(header, /BuildBadge/, 'the build badge left the header');
  assert.doesNotMatch(header, /wordmarkBuild/, 'no wordmark build slot is drawn');
  assert.doesNotMatch(header, /build\?:/, 'the header takes no build prop any more');
  // Versiunea are exact două locuri: subsolul sertarului și Setări › Despre.
  assert.match(drawer, /styles\.build/);
  assert.match(read('src/screens/SettingsScreen.tsx'), /Build JS/);
});

test('niciun dreptunghi, inel sau umbră în spatele mărcii din antet și din bara de jos', () => {
  const wordmark = header.slice(header.indexOf('wordmarkFeed:'));
  const block = wordmark.slice(0, wordmark.indexOf('},') + 2);
  assert.doesNotMatch(block, /borderWidth|borderColor|backgroundColor|shadow/, 'the header door is plain');
  assert.match(block, /width: 52/);

  assert.doesNotMatch(nav, /createDisc|RadialGradient|nxCreateFill/, 'the create cell paints nothing behind the mark');
  assert.match(nav, /function CreateDisc\(\) \{\s*return <BrandLogo variant="nav" \/>;/);
  assert.match(nav, /accessibilityLabel=\{counting \?/);
});

test('login-ul, sertarul și inbox-ul arată marca fără ramă și fără versiune sub ea', () => {
  assert.doesNotMatch(landing, /borderWidth|backgroundColor|borderRadius|shadow/);
  assert.doesNotMatch(login, /styles\.version|<Text style=\{styles\.version\}/);
  assert.doesNotMatch(login, /version: string/);
  assert.match(login, /<View style=\{styles\.brand\}>\{brand\}<\/View>/);
  // Sertarul și inbox-ul folosesc componenta comună: niciunul nu desenează un disc în jurul ei.
  assert.match(drawer, /<BrandLogo variant="nav" size=\{24\} \/>/);
  assert.match(inbox, /<BrandLogo variant="header" \/>/);
  assert.doesNotMatch(drawer, /BrandLogo[^>]*style=/, 'no frame is passed to the mark');
  assert.doesNotMatch(inbox, /BrandLogo[^>]*style=/, 'no frame is passed to the mark');
});
