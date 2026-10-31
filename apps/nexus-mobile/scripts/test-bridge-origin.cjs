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
  // Originea paginii de wallet e acum o decizie separată (`resolveWalletOrigin`), ca mutarea
  // backendului să nu schimbe identitatea pe care o vede xPortal.
  assert.match(sheet, /resolveWalletOrigin\(\{ configured: process\.env\.EXPO_PUBLIC_NEXUS_WALLET_URL, apiOrigin: API_ORIGIN \}\)/);
  assert.match(sheet, /xPortalBridgeUrl\(walletOrigin\.origin/);
  assert.match(sheet, /bridgeUnreachableSentence\(walletOrigin\.origin\)/);
});

test('o adresă de wallet configurată e folosită ca identitate stabilă', () => {
  const chosen = origin.resolveWalletOrigin({ configured: 'https://nexus.example.com', apiOrigin: 'http://192.168.1.153:5000' });
  assert.equal(chosen.origin, 'https://nexus.example.com');
  assert.equal(chosen.source, 'configured');
  assert.equal(chosen.problem, '');
  // Un https cu cale nu e o origine: pagina are o singură adresă, `/xportal-bridge.html`.
  assert.equal(origin.normalizeWalletOrigin('https://nexus.example.com/bridge'), '');
  assert.equal(origin.normalizeWalletOrigin('https://nexus.example.com/?x=1'), '');
  // http public nu e un context sigur, deci nu poate servi pagina.
  assert.equal(origin.normalizeWalletOrigin('http://nexus.example.com'), '');
  assert.equal(origin.normalizeWalletOrigin('http://localhost:5000'), 'http://localhost:5000');
  assert.equal(origin.normalizeWalletOrigin('https://nexus.example.com/'), 'https://nexus.example.com');
});

test('fără configurare rămâne regula dovedită, iar sursa e spusă în clar', () => {
  const lan = origin.resolveWalletOrigin({ apiOrigin: 'http://192.168.1.153:5000' });
  assert.equal(lan.origin, 'http://localhost:5000');
  assert.equal(lan.source, 'phone-loopback');
  assert.match(lan.note, /adb reverse tcp:5000 tcp:5000/);
  const https = origin.resolveWalletOrigin({ apiOrigin: 'https://nexus.example.com' });
  assert.equal(https.origin, 'https://nexus.example.com');
  assert.equal(https.source, 'api-https');
  const loopback = origin.resolveWalletOrigin({ apiOrigin: 'http://localhost:5000' });
  assert.equal(loopback.source, 'api-loopback');
  assert.equal(loopback.note, '');
});

test('o adresă de wallet greșită nu e ignorată în tăcere', () => {
  const refused = origin.resolveWalletOrigin({ configured: 'http://192.168.1.153:5000', apiOrigin: 'http://localhost:5000' });
  // Se continuă cu regula veche, dar foaia are ce afișa: altfel un build greșit ar arăta doar un eșec.
  assert.equal(refused.origin, 'http://localhost:5000');
  assert.equal(refused.source, 'api-loopback');
  assert.match(refused.problem, /https:\/\/ public/);
});
