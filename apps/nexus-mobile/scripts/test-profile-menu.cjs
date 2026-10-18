/* global __dirname */
// Meniul profilului propriu (`≡` / `⋯`) ca ordine de date, și rândul de butoane al proprietarului ca geometrie.
//
// Regula proprietarului (18 octombrie 2026): rândul propriu are exact două intrări — `Editează profilul`
// lat și un `⋯` rotund — iar meniul deschis de ele începe cu Monetizează profilul, Distribuie profilul,
// Portofel, Setări; porțile fostului sertar (postare nouă, notificări, deconectare) și cele două jumătăți
// ale registrului (Venituri, Cheltuieli) urmează după ele.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(relative, fileName) {
  const source = readFileSync(resolve(ROOT, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, require);
  return shim.exports;
}

const menu = load('src/lib/profileMenu.ts', 'profileMenu.ts');
const row = load('src/lib/profileActions.ts', 'profileActions.ts');

const headerSource = readFileSync(resolve(ROOT, 'src/components/ProfileHeader.tsx'), 'utf8');
const screenSource = readFileSync(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), 'utf8');
const shellSource = readFileSync(resolve(ROOT, 'src/app/index.tsx'), 'utf8');

test('meniul are nouă porți, primele patru în ordinea cerută', () => {
  // Regula proprietarului (18 octombrie 2026): rândul propriu are un buton lat și un `⋯`, iar meniul
  // acelui `⋯` începe cu cele patru porți numite de el, în ordinea numită.
  assert.deepEqual(menu.PROFILE_MENU.slice(0, 4).map((entry) => entry.id),
    ['monetize', 'share', 'wallet', 'settings']);
  assert.deepEqual(menu.PROFILE_MENU.slice(0, 4).map((entry) => entry.label),
    ['Monetizează profilul', 'Distribuie profilul', 'Portofel', 'Setări']);
  assert.deepEqual(menu.PROFILE_MENU.map((entry) => entry.id),
    ['monetize', 'share', 'wallet', 'settings', 'newPost', 'income', 'spending', 'notifications', 'logout']);
  assert.equal(menu.PROFILE_MENU_WORD, 'Deschide meniul');
  assert.equal(menu.PROFILE_MENU_CLOSE_WORD, 'Închide meniul');
  assert.equal(menu.PROFILE_MENU_TITLE, 'Meniul Jungle Book');
  assert.equal(menu.PROFILE_MENU_SWITCH_WORD, 'Schimbă profilul');
  for (const entry of menu.PROFILE_MENU) assert.ok(entry.hint.length > 0, `${entry.id} says what it opens`);
});

test('meniul ține și porțile fostului sertar', () => {
  // Regula proprietarului (18 octombrie 2026): sertarul a ieșit din aplicație, deci tot ce avea el
  // — profiluri, postare nouă, clopoțel, deconectare — trebuie să fie acum în meniul ≡.
  const ids = menu.PROFILE_MENU.map((entry) => entry.id);
  for (const id of ['logout', 'newPost', 'notifications']) {
    assert.ok(ids.includes(id), `${id} moved from the drawer into the menu`);
  }
  assert.equal(menu.DRAWER_ONLY_WORDS, undefined, 'there is no drawer left to keep words for');
});

test('o poartă fără ecran nu este desenată', () => {
  const entries = menu.profileMenuFor({ monetize: () => {}, settings: () => {} });
  assert.deepEqual(entries.map((entry) => entry.id), ['monetize', 'settings']);
  for (const entry of entries) assert.equal(typeof entry.run, 'function');
  assert.deepEqual(menu.profileMenuFor({}).map((entry) => entry.id), []);
});


test('rândul proprietarului: 40 dp, complet rotund, țintă de 44 dp pentru `⋯`', () => {
  assert.equal(row.OWNER_ROW.height, 40);
  assert.equal(row.OWNER_ROW.radius, row.OWNER_ROW.height / 2);
  assert.equal(row.OWNER_ROW.menuSize, 40);
  assert.equal(row.OWNER_ROW.menuTarget, 44);
  assert.equal(row.OWNER_ROW_WORDS.menu, 'Deschide meniul');
  assert.equal(row.OWNER_ROW_WORDS.edit, 'Editează profilul');
});

test('eticheta singurului buton lat încape la orice scară a telefonului', () => {
  const wide = row.ownerRowLabels({ screenWidth: 469, fontScale: 1 });
  assert.equal(wide.edit, 'Editează profilul');
  assert.equal(wide.monetize, undefined, 'monetizarea a plecat în meniu');
  assert.equal(wide.share, undefined, 'distribuirea a plecat în meniu');

  const large = row.ownerRowLabels({ screenWidth: 469, fontScale: 1.5 });
  assert.equal(large.edit, 'Editează profilul', 'un singur buton lat are loc pentru eticheta întreagă');

  // Nicio etichetă aleasă nu depășește lățimea de care are parte, la nicio scară.
  const room = row.ownerWideLabelRoom(469);
  for (const scale of [1, 1.15, 1.3, 1.5, 2]) {
    const labels = row.ownerRowLabels({ screenWidth: 469, fontScale: scale });
    assert.ok(row.estimateLabelWidth(labels.edit, row.OWNER_ROW.labelSize * scale) <= room,
      `${labels.edit} at ${scale} fits in ${room.toFixed(1)} dp`);
  }
});

test('un ecran îngust scurtează eticheta înainte de a o trunchia', () => {
  const narrow = row.ownerRowLabels({ screenWidth: 200, fontScale: 1 });
  assert.equal(narrow.edit, 'Editează');
  assert.ok(row.ownerRowLabels({ screenWidth: 469, fontScale: 1 }).edit.length > narrow.edit.length);
  // Estimarea crește cu scara: aceeași etichetă nu devine mai îngustă la o scară mai mare.
  assert.ok(row.estimateLabelWidth('Editează profilul', 14) < row.estimateLabelWidth('Editează profilul', 18.2));
});


test('antetul: un buton lat și un `⋯` rotund, iar amândouă deschid meniul, nu sertarul', () => {
  assert.match(headerSource, /<View style=\{styles\.ownerRow\}>/);
  assert.match(headerSource, /onProfileMenu/);
  assert.match(headerSource, /PROFILE_MENU_WORD/);
  assert.match(headerSource, /styles\.ownerNeutral/);
  assert.match(headerSource, /styles\.ownerRound/);
  assert.match(headerSource, /⋯/, 'the round entry is the ellipsis the owner asked for');
  assert.match(headerSource, /styles\.ownerMenuGlyph/);
  assert.match(headerSource, /accessibilityState=\{\{ expanded: Boolean\(menuOpen\) \}\}/,
    'the round entry says whether the menu is open');
  assert.doesNotMatch(headerSource, /ownerPrimary/, 'the green monetisation door left the row');
  assert.doesNotMatch(headerSource, /kind="share"/, 'the share glyph left the row');
  assert.doesNotMatch(headerSource, /onMonetize/, 'monetisation is a row of the menu, not a header prop');
  assert.doesNotMatch(headerSource, /onWallet/, 'the wallet is a row of the profile menu, not a header prop');
  assert.doesNotMatch(headerSource, /Deschide meniul de setări/, 'the bars no longer promise the drawer');
});

test('sertarul a ieșit din aplicație, iar meniul îi ține porțile', () => {
  assert.match(screenSource, /<ProfileMenuSheet/);
  assert.doesNotMatch(shellSource, /FeedDrawer|drawerOpen|setDrawerOpen|bandPrefs/,
    'the shell has no drawer and no band preference any more');
  const start = shellSource.indexOf("if (slot === 'account')");
  const end = shellSource.indexOf("if (slot === 'inbox')");
  assert.ok(start > 0 && end > start, 'the account slot is still there');
  const accountBlock = shellSource.slice(start, end);
  assert.match(accountBlock, /onNotifications=\{openNotifications\}/);
  assert.match(accountBlock, /onSettings=\{\(\) => setOwnerPanel\('settings'\)\}/);
  assert.match(accountBlock, /onNewPost=/, 'new post moved from the drawer into the menu');
  assert.match(accountBlock, /onLogout=/, 'logout moved from the drawer into the menu');
  assert.match(accountBlock, /profiles=\{socialModules/, 'the five profiles are chips of the menu');
});

test('feed-ul nu mai poartă nici logo, nici buton de sertar', () => {
  const appHeader = readFileSync(resolve(ROOT, 'src/components/AppHeader.tsx'), 'utf8');
  assert.doesNotMatch(appHeader, /<ModulesMark/, 'the drawer door left the header');
  assert.doesNotMatch(appHeader, /onOpenDrawer/, 'no header opens a drawer');
  const start = appHeader.indexOf("{variant === 'feed' ? (");
  const end = appHeader.indexOf('styles.switches');
  assert.ok(start > 0 && end > start, 'the feed branch is still there');
  assert.doesNotMatch(appHeader.slice(start, end), /BrandLogo/, 'the feed bar has no mark');
});

test('setările nu mai au comutatorul benzii: banda merge mereu', () => {
  const settingsSource = readFileSync(resolve(ROOT, 'src/screens/SettingsScreen.tsx'), 'utf8');
  assert.doesNotMatch(settingsSource, /bandScrolling|Banda derulantă|Switch/,
    'the band travels on its own; a touch pauses it, and there is no switch to find');
});
