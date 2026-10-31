/* global __dirname */
/**
 * Un singur registru pentru ce face cititorul cu o postare (runda 42, 31 octombrie 2026).
 *
 * Ownerul a cerut un lucru care nu se poate rezolva prin doua componente care cad de acord: „daca dau like
 * la un reel in feed, apoi il deschid din profil si il gasesc in cautare, reactia si numarul trebuie sa fie
 * aceleasi". Doua componente au doua copii; un singur registru are un singur raspuns. Testul tine exact
 * regulile pe care se sprijina promisiunea:
 *
 *   umplere    un payload umple un camp necunoscut si nu rescrie unul stiut (altfel arhiva profilului,
 *              ceruta inainte de like, ar stinge like-ul dat in feed);
 *   optimistic un like se vede abia dupa raspunsul serverului (e actiune platita), o retragere se vede
 *              imediat, iar un refuz pune starea la loc si tipareste propozitia serverului;
 *   o scriere  doua apasari pe aceeasi postare nu trimit doua like-uri (`IN_FLIGHT`);
 *   plata      402 tine cota in registru, nu anunta nimic si nu atinge reactia pana nu vine transferul;
 *   comentarii numarul creste, si nu scade niciodata din cauza unui payload mai vechi.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

/** The module, compiled and run with the three things it talks to replaced by controllable fakes. */
function load(overrides) {
  const compiled = ts.transpileModule(read('src/lib/postEngagement.ts'), {
    fileName: 'src/lib/postEngagement.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, (id) => {
    if (id in overrides) return overrides[id];
    throw new Error(`postEngagement nu are voie sa importe ${id} la rulare`);
  });
  return shim.exports;
}

/** A deferred promise, so a test can hold a write "on the wire" and look at the record meanwhile. */
function deferred() {
  let settle;
  let fail;
  const promise = new Promise((resolveIt, rejectIt) => { settle = resolveIt; fail = rejectIt; });
  return { promise, settle, fail };
}

/** Let the two microtask hops of `.then(...).catch(...)` run. */
const settleMicrotasks = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function harness() {
  const calls = [];
  const queue = [];
  const wire = (call) => {
    calls.push(call);
    const next = deferred();
    queue.push(next);
    return next.promise;
  };
  const api = {
    setPostReaction: (postId, kind, active, options) => wire({ action: 'reaction', postId, kind, active, options }),
    setPostSaved: (postId, active) => wire({ action: 'save', postId, active }),
    setPostRepost: (postId, active) => wire({ action: 'repost', postId, active }),
    sharePost: (postId) => wire({ action: 'share', postId }),
  };
  class PaymentRequired extends Error {
    constructor(message = 'Plata este necesara.') { super(message); this.status = 402; }
  }
  const store = load({
    './postInteractions': api,
    './actionPayments': {
      paymentRequired: (cause) => Boolean(cause && cause.status === 402),
      quoteFromFailure: () => ({ action: 'appreciation', price_cents: 5, balance_cents: 0, warnings: [] }),
      intentIsPaid: (intent) => Boolean(intent && intent.status === 'paid'),
    },
    './socialTypes': { viewerReaction: (summary) => (summary && summary.viewer_reaction) || null },
    react: { useSyncExternalStore: () => {} },
  });
  return { store, api, calls, queue, PaymentRequired };
}

const post = (extra = {}) => ({
  id: 53,
  comment_count: 7,
  reactions: { counts: { LIKE: 2 }, viewer_reaction: null },
  saved_by_me: false,
  reposted_by_me: false,
  ...extra,
});

test('un payload umple registrul, iar ce a facut cititorul nu este stins de o lista veche', () => {
  const { store } = harness();
  store.clearPostEngagement();

  store.seedPostEngagement(post());
  let record = store.postEngagementOf(53);
  assert.equal(record.comments, 7);
  assert.equal(record.saved, false);
  assert.deepEqual(record.summary, { counts: { LIKE: 2 }, viewer_reaction: null });

  /** Ce a scris cititorul, in feed. */
  store.rememberPostEngagement(53, { summary: { counts: { LIKE: 1, LOVE: 1 }, viewer_reaction: 'LOVE' }, saved: true });

  /** ... iar arhiva profilului, ceruta inainte de like, aterizeaza o suprafata mai tarziu. */
  store.seedPostEngagement(post({ comment_count: 9 }));
  record = store.postEngagementOf(53);
  assert.equal(record.summary.viewer_reaction, 'LOVE', 'un payload nu are voie sa stinga reactia');
  assert.deepEqual(record.summary.counts, { LIKE: 1, LOVE: 1 });
  assert.equal(record.saved, true, 'un payload nu are voie sa stinga salvarea');
  assert.equal(record.comments, 9, 'numarul de comentarii poate creste din payload');
});

test('o reactie luata inapoi se vede imediat, una pusa se vede dupa raspunsul serverului', async () => {
  const { store, queue } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post({ reactions: { counts: { LIKE: 2 }, viewer_reaction: 'LIKE' } }));

  store.reactToPost(53, 'LIKE');
  assert.equal(store.postEngagementOf(53).summary.viewer_reaction, null, 'retragerea este optimista');
  queue.shift().settle({ counts: { LIKE: 1 }, viewer_reaction: null });
  await settleMicrotasks();
  assert.deepEqual(store.postEngagementOf(53).summary, { counts: { LIKE: 1 }, viewer_reaction: null });

  store.reactToPost(53, 'LOVE');
  assert.equal(store.postEngagementOf(53).summary.viewer_reaction, null, 'like-ul platit nu se preface');
  queue.shift().settle({ counts: { LIKE: 1, LOVE: 1 }, viewer_reaction: 'LOVE' });
  await settleMicrotasks();
  assert.deepEqual(store.postEngagementOf(53).summary, { counts: { LIKE: 1, LOVE: 1 }, viewer_reaction: 'LOVE' });
});

test('doua apasari pe aceeasi postare nu trimit doua scrieri', async () => {
  const { store, calls, queue } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post());
  store.reactToPost(53, 'LIKE');
  store.reactToPost(53, 'LIKE');
  store.reactToPost(53, 'LOVE');
  assert.equal(calls.filter((call) => call.action === 'reaction').length, 1, 'o singura scriere pe zbor');
  queue.shift().settle({ counts: { LIKE: 3 }, viewer_reaction: 'LIKE' });
  await settleMicrotasks();
  assert.equal(store.postEngagementOf(53).summary.viewer_reaction, 'LIKE');
});

test('un refuz pune starea la loc si tipareste propozitia serverului', async () => {
  const { store, queue } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post({ reactions: { counts: { LIKE: 2 }, viewer_reaction: 'LIKE' } }));
  store.reactToPost(53, 'LIKE');
  queue.shift().fail(new Error('Reactia a fost refuzata.'));
  await settleMicrotasks();
  assert.equal(store.postEngagementOf(53).summary.viewer_reaction, 'LIKE', 'retragerea esuata se intoarce');
  assert.deepEqual(store.postEngagementOf(53).notice, { text: 'Reactia a fost refuzata.', tone: 'error' });
});

test('402 tine cota in registru si nu atinge reactia pana la transfer', async () => {
  const { store, calls, queue, PaymentRequired } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post());
  store.reactToPost(53, 'LIKE');
  queue.shift().fail(new PaymentRequired());
  await settleMicrotasks();
  const held = store.postEngagementOf(53);
  assert.equal(held.summary.viewer_reaction, null, 'nimic nu s-a schimbat');
  assert.equal(held.notice, null, 'o cota nu este o eroare');
  assert.equal(held.payment.kind, 'LIKE');
  assert.equal(held.payment.quote.price_cents, 5);

  /** Foaia raspunde: aceeasi reactie pleaca din nou, cu randul din registru ca `payment_intent_id`. */
  store.payForReaction(53, { id: 'intent-1', status: 'paid' });
  const last = calls.filter((call) => call.action === 'reaction').at(-1);
  assert.equal(calls.filter((call) => call.action === 'reaction').length, 2, 'a doua scriere a plecat');
  assert.equal(last.options.paymentIntentId, 'intent-1');
  queue.splice(0, queue.length);
  store.clearPostEngagement();
});

test('salvarea si repostarea se prefac, apoi se corecteaza din raspuns', async () => {
  const { store, queue } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post());

  store.togglePostSaved(53);
  assert.equal(store.postEngagementOf(53).saved, true);
  queue.shift().settle({ saved: true });
  await settleMicrotasks();
  assert.equal(store.postEngagementOf(53).saved, true);

  store.togglePostRepost(53);
  assert.equal(store.postEngagementOf(53).reposted, true);
  assert.equal(store.postEngagementOf(53).distributeOpen, false, 'panoul se inchide pe apasare');
  queue.shift().fail(new Error('Nu se poate redistribui.'));
  await settleMicrotasks();
  assert.equal(store.postEngagementOf(53).reposted, false, 'refuzul intoarce starea');
});

test('comentariile cresc si nu scad din cauza unui payload vechi', () => {
  const { store } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post());
  store.notePostComment(post());
  assert.equal(store.postEngagementOf(53).comments, 8);
  store.notePostCommentCount(53, 12);
  assert.equal(store.postEngagementOf(53).comments, 12);
  store.seedPostEngagement(post());
  assert.equal(store.postEngagementOf(53).comments, 12, 'payload-ul vechi nu taie numarul');
  store.notePostCommentCount(53, 4);
  assert.equal(store.postEngagementOf(53).comments, 12, 'un total mai mic nu este o veste');
});

test('registrul este unul: ce s-a scris intr-o suprafata se citeste in alta', () => {
  const { store } = harness();
  store.clearPostEngagement();
  store.seedPostEngagement(post());
  store.rememberPostEngagement(53, { summary: { counts: { WOW: 3 }, viewer_reaction: 'WOW' }, saved: true });
  const readElsewhere = store.postEngagementOf(53);
  assert.equal(readElsewhere.summary.viewer_reaction, 'WOW');
  assert.equal(readElsewhere.saved, true);
  /** ... iar o a doua montare a aceleiasi postari nu rescrie nimic din payload-ul ei. */
  store.seedPostEngagement(post());
  assert.equal(store.postEngagementOf(53).summary.viewer_reaction, 'WOW');
});

test('suprafetele impart registrul, foaiele si oprirea pagerului', () => {
  const card = read('src/components/PostCard.tsx');
  const reel = read('src/components/ReelsReader.tsx');
  for (const [name, source] of [['PostCard', card], ['ReelsReader', reel]]) {
    assert.match(source, /usePostEngagement\(post\)/, `${name} citeste registrul comun`);
    assert.match(source, /<PostSheets post=\{post\} engagement=\{engagement\} \/>/, `${name} monteaza aceleasi foi`);
    assert.doesNotMatch(source, /useState\(Boolean\(post\.saved_by_me\)\)/, `${name} nu mai are starea lui`);
    assert.doesNotMatch(source, /setPostReaction\(/, `${name} nu mai trimite singur reactia`);
  }
  /**
   * Ruta unui post (profilul si cautarea dau aici) oprea *nimic*: pagerul ei lua glisarea panoului. Legea
   * din feed (`scrollEnabled={!paletteOpen}`) trebuie sa fie si aici, si pe ambele tipuri de pagina.
   */
  const route = read('src/app/post/[id].tsx');
  assert.match(route, /scrollEnabled=\{!paletteOpen\}/, 'pagerul rutei se opreste cu panoul deschis');
  assert.equal((route.match(/onPanelChange=\{setPaletteOpen\}/g) || []).length, 2, 'ambele pagini anunta panoul');
});
