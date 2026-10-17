/* global __dirname */
// Meniul profilului propriu (`≡`) ca ordine de date, și rândul de butoane al proprietarului ca geometrie.
//
// Regula proprietarului (17 octombrie 2026): săgețile din antet deschid meniul profilului — Portofel,
// Venituri, Cheltuieli, Notificări, Monetizează profilul, Setări — iar sertarul (profile, postare nouă,
// clopoțel, deconectare) rămâne pe pagina de Feed, deschis din butonul lui. Rândul propriu are exact trei
// butoane: editor neutru, monetizare verde și distribuire rotundă, fără text și fără `⋯`.
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

test('meniul profilului are șase porți, în ordinea cerută', () => {
  assert.deepEqual(menu.PROFILE_MENU.map((entry) => entry.id),
    ['wallet', 'income', 'spending', 'notifications', 'monetize', 'settings']);
  assert.deepEqual(menu.PROFILE_MENU.map((entry) => entry.label),
    ['Portofel', 'Venituri', 'Cheltuieli', 'Notificări', 'Monetizează profilul', 'Setări']);
  assert.equal(menu.PROFILE_MENU_WORD, 'Deschide meniul profilului');
  assert.equal(menu.PROFILE_MENU_CLOSE_WORD, 'Închide meniul profilului');
  for (const entry of menu.PROFILE_MENU) assert.ok(entry.hint.length > 0, `${entry.id} says what it opens`);
});

test('meniul profilului nu conține nicio poartă a sertarului', () => {
  const words = menu.PROFILE_MENU.map((entry) => `${entry.label} ${entry.hint}`).join(' | ');
  for (const forbidden of menu.DRAWER_ONLY_WORDS) {
    assert.doesNotMatch(words, new RegExp(forbidden, 'i'), `the menu must not print "${forbidden}"`);
  }
  // Și nici ca identificatori: poarta din sertar nu are voie să devină o intrare de-aici.
  const ids = menu.PROFILE_MENU.map((entry) => entry.id);
  for (const id of ['logout', 'newPost', 'switchProfile', 'switch']) {
    assert.ok(!ids.includes(id), `${id} belongs to the drawer`);
  }
});

test('o poartă fără ecran nu este desenată', () => {
  const entries = menu.profileMenuFor({ monetize: () => {}, settings: () => {} });
  assert.deepEqual(entries.map((entry) => entry.id), ['monetize', 'settings']);
  for (const entry of entries) assert.equal(typeof entry.run, 'function');
  assert.deepEqual(menu.profileMenuFor({}).map((entry) => entry.id), []);
});


test('rândul proprietarului: 40 dp, complet rotund, țintă de 44 dp pentru rotund', () => {
  assert.equal(row.OWNER_ROW.height, 40);
  assert.equal(row.OWNER_ROW.radius, row.OWNER_ROW.height / 2);
  assert.equal(row.OWNER_ROW.shareSize, 40);
  assert.equal(row.OWNER_ROW.shareTarget, 44);
  assert.equal(row.OWNER_ROW_WORDS.share, 'Distribuie profilul');
});

test('etichetele încap la scara 1.0 și se scurtează la 1.3', () => {
  const wide = row.ownerRowLabels({ screenWidth: 469, fontScale: 1 });
  assert.equal(wide.edit, 'Editează profilul');
  assert.equal(wide.monetize, 'Monetizează profilul');
  assert.equal(wide.share, 'Distribuie profilul');

  const large = row.ownerRowLabels({ screenWidth: 469, fontScale: 1.3 });
  assert.equal(large.edit, 'Editează profilul');
  assert.equal(large.monetize, 'Monetizează', 'la 1.3 eticheta lungă nu încape, deci se scurtează');
  assert.equal(large.share, 'Distribuie profilul', 'butonul rotund nu are text vizibil');

  // Nicio etichetă aleasă nu depășește lățimea de care are parte, la nicio scară.
  const room = row.ownerWideLabelRoom(469);
  for (const scale of [1, 1.15, 1.3, 1.5]) {
    const labels = row.ownerRowLabels({ screenWidth: 469, fontScale: scale });
    for (const label of [labels.edit, labels.monetize]) {
      assert.ok(row.estimateLabelWidth(label, row.OWNER_ROW.labelSize * scale) <= room,
        `${label} at ${scale} fits in ${room.toFixed(1)} dp`);
    }
  }
});

test('un ecran îngust scurtează eticheta înainte de a o trunchia', () => {
  const narrow = row.ownerRowLabels({ screenWidth: 360, fontScale: 1 });
  assert.equal(narrow.monetize, 'Monetizează');
  assert.ok(row.ownerRowLabels({ screenWidth: 469, fontScale: 1 }).monetize.length > narrow.monetize.length);
  // Estimarea crește cu scara: aceeași etichetă nu devine mai îngustă la o scară mai mare.
  assert.ok(row.estimateLabelWidth('Monetizează profilul', 14) < row.estimateLabelWidth('Monetizează profilul', 18.2));
});


test('antetul: trei butoane în rând, fără `⋯`, iar săgețile deschid meniul, nu sertarul', () => {
  assert.match(headerSource, /<View style=\{styles\.ownerRow\}>/);
  assert.match(headerSource, /onProfileMenu/);
  assert.match(headerSource, /PROFILE_MENU_WORD/);
  assert.match(headerSource, /styles\.ownerNeutral/);
  assert.match(headerSource, /styles\.ownerPrimary/);
  assert.match(headerSource, /styles\.ownerRound/);
  assert.match(headerSource, /kind="share"/);
  assert.doesNotMatch(headerSource, /⋯/, 'the round `⋯` left the owner row');
  assert.doesNotMatch(headerSource, /onWallet/, 'the wallet is a row of the profile menu, not a header prop');
  assert.doesNotMatch(headerSource, /Deschide meniul de setări/, 'the bars no longer promise the drawer');
});

test('profilul nu mai are nicio cale către sertar', () => {
  assert.match(screenSource, /<ProfileMenuSheet/);
  assert.doesNotMatch(screenSource, /setDrawerOpen|FeedDrawer|drawerOpen/, 'no drawer state in the profile');
  const start = shellSource.indexOf("if (slot === 'account')");
  const end = shellSource.indexOf("if (slot === 'inbox')");
  assert.ok(start > 0 && end > start, 'the account slot is still there');
  const accountBlock = shellSource.slice(start, end);
  assert.doesNotMatch(accountBlock, /setDrawerOpen/, 'the profile opens its own menu, never the drawer');
  assert.match(accountBlock, /onNotifications=\{openNotifications\}/);
  assert.match(accountBlock, /onSettings=\{\(\) => setOwnerPanel\('settings'\)\}/);
});
