/* global __dirname */
// Originea paginii xPortal (round 36): walletul are nevoie de un context sigur, deci pagina lui nu poate
// rula de pe adresa LAN în `http:`. Restul aplicației rămâne pe adresa LAN.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(relative) {
  const source = readFileSync(resolve(ROOT, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, require);
  return shim.exports;
}

const origin = load('src/lib/bridgeOrigin.ts');

test('pagina xPortal cerce un context sigur: loopback sau https', () => {
  assert.equal(origin.secureBridgeOrigin('http://192.168.1.153:5000'), 'http://localhost:5000');
  assert.equal(origin.secureBridgeOrigin('http://192.168.1.153:8080'), 'http://localhost:8080');
  assert.equal(origin.secureBridgeOrigin('https://192.168.1.153:5000'), 'https://192.168.1.153:5000');
  assert.equal(origin.secureBridgeOrigin('http://localhost:5000'), 'http://localhost:5000');
  assert.equal(origin.secureBridgeOrigin('http://127.0.0.1:5000'), 'http://127.0.0.1:5000');
  assert.equal(origin.secureBridgeOrigin('http://10.0.0.2'), 'http://localhost:5000');
  assert.throws(() => origin.secureBridgeOrigin('nu-e-o-adresa'), /validă/);
  assert.throws(() => origin.secureBridgeOrigin('ftp://192.168.1.153:5000'), /http/);
});

test('mesajul de eroare spune ce trebuie deschis', () => {
  const sentence = origin.bridgeUnreachableSentence('http://192.168.1.153:5000');
  assert.match(sentence, /http:\/\/localhost:5000/);
  assert.match(sentence, /adb reverse tcp:5000 tcp:5000/);
});

test('foaia xPortal încarcă pagina din originea sigură, nu din adresa LAN', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  assert.match(sheet, /xPortalBridgeUrl\(secureBridgeOrigin\(API_ORIGIN\)/);
  assert.match(sheet, /bridgeUnreachableSentence\(API_ORIGIN\)/);
});
