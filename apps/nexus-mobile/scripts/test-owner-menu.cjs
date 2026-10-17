/* global __dirname */
// Meniul `⋯` al profilului propriu, ca ordine de date: patru intrări, monetizarea prima, iar o intrare
// fără handler dispare în loc să rămână un buton care nu deschide nimic.
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

const menu = load('src/lib/ownerMenu.ts', 'ownerMenu.ts');
const pricing = load('src/lib/pricing.ts', 'pricing.ts');

test('meniul are patru intrări, în ordinea cerută', () => {
  assert.deepEqual(menu.OWNER_MENU.map((entry) => entry.id), ['monetize', 'share', 'wallet', 'settings']);
  assert.deepEqual(menu.OWNER_MENU.map((entry) => entry.label),
    ['Monetizează profilul', 'Distribuie profilul', 'Portofel', 'Setări']);
  assert.equal(menu.OWNER_MENU_WORD, 'Deschide meniul profilului');
});

test('o intrare fără handler nu este desenată', () => {
  const entries = menu.ownerMenuFor({ monetize: () => {}, settings: () => {} });
  assert.deepEqual(entries.map((entry) => entry.id), ['monetize', 'settings']);
  for (const entry of entries) assert.equal(typeof entry.run, 'function');
  assert.deepEqual(menu.ownerMenuFor({}).map((entry) => entry.id), []);
});

test('prețul se scrie în JBc cu două zecimale, iar ce nu e preț nu se ghicește', () => {
  assert.equal(pricing.formatJbc(200), '2,00 JB');
  assert.equal(pricing.formatJbc(50), '0,50 JB');
  assert.equal(pricing.formatJbc(123456), '1.234,56 JB');
  assert.equal(pricing.formatJbc(null), '—');
  assert.equal(pricing.formatJbc(-5), '—');
});

test('ce tastează ownerul devine cenți, fără rotunjiri ascunse', () => {
  assert.equal(pricing.parseJbc('2'), 200);
  assert.equal(pricing.parseJbc('2,5'), 250);
  assert.equal(pricing.parseJbc('2.50'), 250);
  assert.equal(pricing.parseJbc('0'), null);
  assert.equal(pricing.parseJbc('2,555'), null);
  assert.equal(pricing.parseJbc('abc'), null);
  assert.equal(pricing.parseJbc(''), null);
  assert.equal(pricing.parseJbc('1000001'), null, 'peste plafonul serverului');
});

test('preseturile sunt cele cerute, iar fiecare copie e independentă', () => {
  assert.deepEqual(pricing.presetPrices('prietenos'), { appreciation: 200, comment: 300, share: 300 });
  assert.deepEqual(pricing.presetPrices('premium'), { appreciation: 300, comment: 500, share: 500 });
  const copy = pricing.presetPrices('prietenos');
  copy.comment = 999;
  assert.equal(pricing.presetPrices('prietenos').comment, 300);
});

test('bugetul de sesiune nu coboară sub zero, iar prețul se arată doar când e peste zero', () => {
  assert.equal(pricing.budgetLeft(1000, 300), 700);
  assert.equal(pricing.budgetLeft(1000, 1500), 0);
  assert.equal(pricing.budgetLeft(Number.NaN, 10), 0);
  assert.equal(pricing.showsPrice(200), true);
  assert.equal(pricing.showsPrice(0), false);
  assert.equal(pricing.showsPrice(null), false);
});

test('refuzurile serverului devin propoziții pentru cititor', () => {
  assert.match(pricing.supportErrorMessage('SETTLEMENT_DISABLED', ''), /demonstrativ/);
  assert.match(pricing.supportErrorMessage('INSUFFICIENT_FUNDS', ''), /soldul/i);
  assert.equal(pricing.supportErrorMessage('CEVA_NOU', 'mesajul serverului'), 'mesajul serverului');
  assert.equal(pricing.supportErrorMessage(null, ''), 'Cererea nu a putut fi trimisă.');
});
