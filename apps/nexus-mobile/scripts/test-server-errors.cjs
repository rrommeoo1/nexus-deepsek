/* global __dirname */
// Ce spune aplicația când serverul nu are ruta încă (`src/lib/serverErrors.ts`).
//
// Regula proprietarului (18 octombrie 2026): niciun ecran nu are voie să tipărească „not found"-ul brut
// al transportului. 404, 501 și 503 înseamnă „Monetizarea nu este încă activată pe server", o eroare de
// rețea spune că serverul nu răspunde, iar orice altceva păstrează vorba serverului.
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

const errors = load('src/lib/serverErrors.ts', 'serverErrors.ts');

test('404, 501 și 503 spun că monetizarea nu este încă pe server', () => {
  for (const status of [404, 501, 503]) {
    const words = errors.serverErrorWords({ status }, 'altceva');
    assert.match(words, /Monetizarea nu este încă activată pe server\./, `${status} says the missing route`);
    assert.ok(words.length > errors.MONETIZATION_NOT_DEPLOYED.length, `${status} adds what kind of failure it is`);
    assert.doesNotMatch(words, /not found/i, `${status} never repeats the transport's words`);
  }
  assert.match(errors.serverErrorWords({ status: 501 }, 'x'), /501/);
  assert.match(errors.serverErrorWords({ status: 503 }, 'x'), /503/);
  assert.match(errors.serverErrorWords({ code: 'NOT_IMPLEMENTED' }, 'x'), /501/);
});

test('o eroare de rețea spune că serverul nu răspunde, iar restul rămâne al serverului', () => {
  assert.equal(errors.serverErrorWords(new TypeError('Network request failed'), 'fallback'),
    'Serverul nu răspunde. Verifică legătura de internet și încearcă din nou.');
  assert.equal(errors.serverErrorWords({ status: 0 }, 'fallback'), 'Serverul nu răspunde. Verifică legătura de internet și încearcă din nou.');
  assert.match(errors.serverErrorWords({ status: 401 }, 'x'), /Sesiunea/);
  assert.equal(errors.serverErrorWords({ status: 500, message: 'boom' }, 'fallback'), 'fallback');
  assert.equal(errors.serverErrorWords(null, 'fallback'), 'fallback');
  assert.equal(errors.serverErrorWords(undefined, 'fallback'), 'fallback');
});

test('ecranul de monetizare nu tipărește mesajul brut și are buton de reîncercare', () => {
  const source = readFileSync(resolve(ROOT, 'src/screens/MonetizationScreen.tsx'), 'utf8');
  assert.match(source, /serverErrorWords\(/);
  assert.match(source, /Reîncearcă/);
  assert.doesNotMatch(source, /cause instanceof Error \? cause\.message/,
    'a raw transport message never reaches the reader');
});

test('presetările au ieșit din ecran: prețul îl scrie creatorul', () => {
  const source = readFileSync(resolve(ROOT, 'src/screens/MonetizationScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /PRESET_LABELS|choosePreset|presetOfDraft|draftFromPreset/);
  assert.doesNotMatch(source, /Mod avansat/);
  assert.match(source, /centsToInput/);
});
