/* global __dirname */
// A view is a reading the client reported.
//
// `view_stats.viewers` is `repo.js` `postViewStatsBulk` counting the distinct organic viewers of
// `social_impressions`, so a post nobody reports stays at zero — which is exactly what the phone showed
// while only the web client had a queue. This suite pins the phone's ledger to the web's contract
// (`public/app.js` `queueSocialImpression` / `flushSocialImpressions` / `POST /api/social/impressions`):
// one entry per post, the longest dwell, a 650 ms batch of at most 50, the web's own body, a refused batch
// kept for the next reading, and the two surfaces that report a reading.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const FILE = 'src/lib/impressions.ts';
const source = readFileSync(resolve(ROOT, FILE), 'utf8');

function load(file, requireShim) {
  const code = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const impressions = load(FILE, (id) => {
  if (id === 'react') return { useEffect() {} };
  if (id === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
  // The singleton at the bottom of the module is built at load time; nothing is sent until a reading exists.
  if (id === './nexusApi') return { nexusApi: async () => ({ ok: true }) };
  throw new Error(`impressions.ts asked for ${id}`);
});

const settle = (ms) => new Promise((done) => setTimeout(done, ms));

test('o postare citită este o singură intrare, cu cea mai lungă ședere', async () => {
  const batches = [];
  const ledger = impressions.createImpressionLedger(async (entries) => { batches.push(entries); }, { delayMs: 5 });
  ledger.note(7, 900);
  ledger.note(7, 2400, true);
  ledger.note(7, 120);
  assert.deepEqual(ledger.pending(), [{ post_id: 7, dwell_ms: 2400, completed: true }], 'one entry per post');
  await ledger.flush();
  assert.deepEqual(batches, [[{ post_id: 7, dwell_ms: 2400, completed: true }]]);
  assert.equal(ledger.pending().length, 0, 'a delivered reading leaves the queue');
});

test('ceea ce nu este un id de postare nu devine vizualizare', () => {
  const ledger = impressions.createImpressionLedger(async () => {});
  for (const id of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, undefined, null]) ledger.note(id, 900);
  assert.deepEqual(ledger.pending(), []);
});

test('un lot are cel mult 50 de intrări și pleacă singur după debounce', async () => {
  const batches = [];
  const ledger = impressions.createImpressionLedger(async (entries) => { batches.push(entries); }, { delayMs: 5 });
  for (let id = 1; id <= 60; id += 1) ledger.note(id, 1000, false);
  assert.equal(ledger.pending().length, 60);
  await settle(60);
  assert.deepEqual(batches.map((batch) => batch.length), [50, 10], 'the web sends 50 per request');
  assert.equal(ledger.pending().length, 0);
});

test('un lot refuzat se întoarce în coadă și nu insistă pe timer', async () => {
  let attempts = 0;
  const delivered = [];
  const ledger = impressions.createImpressionLedger(async () => {
    attempts += 1;
    throw new Error('offline');
  }, { delayMs: 5, onDelivered: (ids) => delivered.push(ids) });
  ledger.note(3, 1200);
  await ledger.flush();
  assert.equal(attempts, 1);
  assert.deepEqual(ledger.pending(), [{ post_id: 3, dwell_ms: 1200, completed: false }], 'the reading is kept');
  await settle(40);
  assert.equal(attempts, 1, 'a failure is not retried on a timer');
  assert.deepEqual(delivered, [], 'nothing is announced before the server accepts it');
});

test('livrarea anunță id-urile acceptate, după răspuns', async () => {
  const delivered = [];
  const ledger = impressions.createImpressionLedger(async () => ({ ok: true }), {
    delayMs: 5,
    onDelivered: (ids) => delivered.push(ids),
  });
  ledger.note(11, 900);
  ledger.note(12, 1400, true);
  await ledger.flush();
  assert.deepEqual(delivered, [[11, 12]]);
});

test('contractul este cel al webului, iar ecranele îl folosesc', () => {
  assert.match(source, /nexusApi\('\/api\/social\/impressions'/);
  assert.match(source, /body: JSON\.stringify\(\{ entries, comment_entries: \[\] \}\)/);
  assert.match(source, /const FLUSH_DELAY_MS = 650;/);
  assert.match(source, /const MAX_BATCH = 50;/);
  assert.match(source, /const MAX_DWELL_MS = 600_000;/);
  assert.match(source, /export const MIN_READ_MS = 900;/);
  assert.doesNotMatch(source, /Math\.random/, 'no invented count');

  const reader = readFileSync(resolve(ROOT, 'src/app/post/[id].tsx'), 'utf8');
  /**
   * The reader counts the page that is on screen: one post when the route was opened alone, and the
   * post of the current page when the route walks the profile's own order (`current` is either).
   */
  assert.match(reader, /usePostImpression\(current\?\.id\)/);
  assert.match(reader, /const current = walkMode \? list\[Math\.min\(at, Math\.max\(0, list\.length - 1\)\)\] \?\? null : post;/);
  const feed = readFileSync(resolve(ROOT, 'src/screens/FeedScreen.tsx'), 'utf8');
  assert.match(feed, /usePostImpression\(visible\[activeIndex\]\?\.id\)/);
  const profile = readFileSync(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), 'utf8');
  assert.match(profile, /subscribeImpressionDelivery\(\(\) => reloadQuietly\(\)\)/);
});
