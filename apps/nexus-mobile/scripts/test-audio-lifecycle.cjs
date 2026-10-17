/* global __dirname */
// Un `pause()` pe un player expo-audio deja eliberat aruncă, iar în cleanup-ul unui efect aceea este
// moartea ecranului (camera.tsx, 17 oct 2026). Helperul e pur: primește ceva cu `pause` și `isLoaded`
// și răspunde ce a făcut, fără să arunce niciodată.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const source = readFileSync(resolve(ROOT, 'src/lib/audioLifecycle.ts'), 'utf8');
const code = ts.transpileModule(source, {
  fileName: 'audioLifecycle.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, require);
const { pauseIfAlive } = moduleShim.exports;

test('lipsa playerului nu este o eroare, este „not-loaded”', () => {
  assert.equal(pauseIfAlive(null), 'not-loaded');
  assert.equal(pauseIfAlive(undefined), 'not-loaded');
});

test('un player încărcat este pus pe pauză exact o dată', () => {
  let calls = 0;
  const player = { isLoaded: true, pause: () => { calls += 1; } };
  assert.equal(pauseIfAlive(player), 'paused');
  assert.equal(calls, 1);
});

test('un player neîncărcat nu este atins deloc', () => {
  let calls = 0;
  const player = { isLoaded: false, pause: () => { calls += 1; } };
  assert.equal(pauseIfAlive(player), 'not-loaded');
  assert.equal(calls, 0, 'nici măcar nu se încearcă');
});

test('un player eliberat este raportat, nu aruncat', () => {
  const released = { isLoaded: true, pause: () => { throw new Error('Cannot use shared object that was already released'); } };
  assert.equal(pauseIfAlive(released), 'released');
});

test('starea necunoscută (fără isLoaded) merge totuși la pause, ca înainte', () => {
  let calls = 0;
  const player = { pause: () => { calls += 1; } };
  assert.equal(pauseIfAlive(player), 'paused');
  assert.equal(calls, 1);
});
