/* global __dirname */
// Banii așa cum are voie clientul să-i spună (`src/lib/pricing.ts`): sumele primite se tipăresc, ce
// tastează proprietarul devine cenți fără rotunjiri ascunse, iar refuzurile serverului devin propoziții.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

const pricing = (() => {
  const source = readFileSync(resolve(ROOT, 'src/lib/pricing.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: 'pricing.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, require);
  return shim.exports;
})();

const unit = pricing.CURRENCY_LABEL;

test('prețul se scrie cu două zecimale și simbolul unității', () => {
  assert.equal(pricing.formatJbc(200), `2,00 ${unit}`);
  assert.equal(pricing.formatJbc(50), `0,50 ${unit}`);
  assert.equal(pricing.formatJbc(123456), `1.234,56 ${unit}`);
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
