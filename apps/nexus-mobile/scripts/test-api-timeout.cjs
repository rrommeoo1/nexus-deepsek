/* global __dirname */
/**
 * Ce se întâmplă când serverul tace (`src/lib/nexusApi.ts`).
 *
 * Măsurat pe telefonul owner-ului pe 26 octombrie 2026: tab-ul Profil a stat pe `ActivityIndicator`
 * minute întregi, pentru că `fetch` nu răspunsese și nu eșuase. `ProfileScreen` așteaptă o încercare
 * încheiată înainte să deseneze ceva (`attempted !== key && !data`), deci un răspuns care nu vine nu e un
 * spinner, e o absență de răspuns. Aceste teste țin patru lucruri: un termen limită există, el ajunge la
 * `fetch` ca abort, lipsa răspunsului devine `TIMEOUT` (nu un `undefined` aruncat), iar un apel normal
 * rămâne neatins și nu lasă nici un timer în urmă.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(relative, fileName, requireShim) {
  const source = readFileSync(resolve(ROOT, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, requireShim ?? require);
  return shim.exports;
}

const api = load('src/lib/nexusApi.ts', 'nexusApi.ts', (id) => {
  if (id === './apiOrigin') return { API_ORIGIN: 'https://api.test' };
  if (id === './idempotency') return { newMutationKey: () => 'key-test' };
  if (id === './session') return { authHeaders: () => ({ Authorization: 'Bearer test-token' }) };
  throw new Error(`nexusApi.ts a cerut un modul neașteptat: ${id}`);
});

test('a server that never answers ends as TIMEOUT instead of an eternal spinner', async () => {
  const observed = [];
  globalThis.fetch = (url, options) => {
    observed.push({ url: String(url), options });
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    });
  };
  const started = Date.now();
  await assert.rejects(
    () => api.nexusApi('/api/profiles/wallet4e8gv6?persona=social', { timeoutMs: 60 }),
    (error) => {
      assert.equal(error.name, 'Error');
      assert.equal(error.code, 'TIMEOUT');
      assert.equal(error.status, 0, 'nu există un status de server când serverul nu a răspuns');
      assert.match(error.message, /nu a răspuns/);
      return true;
    },
  );
  assert.ok(Date.now() - started < 5000, 'termenul limită este al apelului, nu al rețelei');
  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.signal.aborted, true, 'fetch-ul a fost întrerupt, nu doar abandonat');
});

test('the deadline is stripped from the request and never reaches fetch', async () => {
  const observed = [];
  globalThis.fetch = async (url, options) => {
    observed.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({ ok: true, value: 7 }) };
  };
  const answer = await api.nexusApi('/api/me', { timeoutMs: 5000 });
  assert.equal(answer.value, 7);
  assert.equal('timeoutMs' in observed[0].options, false);
  assert.equal(observed[0].options.credentials, 'include');
  assert.equal(observed[0].options.headers.Authorization, 'Bearer test-token');
});

test('a caller that aborts is not a timeout, and the answer still carries its own reason', async () => {
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('user left'), { name: 'AbortError' })));
  });
  const controller = new AbortController();
  const pending = api.nexusApi('/api/social/feed', { timeoutMs: 5000, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => {
    assert.equal(error.code === 'TIMEOUT', false, 'o renunțare a cititorului nu este o eroare de server');
    assert.equal(error.message, 'user left');
    return true;
  });
});

test('a refusal keeps its status and the server\'s own words', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: 'postarea nu există' }) });
  await assert.rejects(
    () => api.nexusApi('/api/posts/999999', { timeoutMs: 5000 }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, 'postarea nu există');
      return true;
    },
  );
});

test('the app deadline is twenty seconds and the route still refuses a foreign path', async () => {
  assert.equal(api.API_TIMEOUT_MS, 20000);
  await assert.rejects(() => api.nexusApi('https://elsewhere.test/api/me'), /Cale API invalidă/);
});
