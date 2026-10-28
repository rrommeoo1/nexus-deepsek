/* global __dirname */
/**
 * Ce întreabă aplicația înainte să trimită o pagină (`src/lib/backendVersion.ts`).
 *
 * Defectul din 26 octombrie 2026 nu a fost o funcție lipsă, ci o întrebare lipsă: telefonul a publicat o
 * pagină pe un deployment Railway din 6 octombrie, care a păstrat descrierea și fotografiile, a aruncat
 * `text_style` și a răspuns `ok: true`. Aceste teste țin patru lucruri: răspunsul serverului este citit
 * strict, o capacitate absentă nu devine niciodată o permisiune, întrebarea se pune înainte de încărcarea
 * fișierelor, iar un server care tace nu blochează publicarea (plasa din `publishClient.ts` rămâne dedesubt).
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

const version = load('src/lib/backendVersion.ts', 'backendVersion.ts', (id) => {
  if (id === './apiOrigin') return { API_ORIGIN: 'https://api.test' };
  throw new Error(`backendVersion.ts a cerut un modul neașteptat: ${id}`);
});

const FINGERPRINT = 'c'.repeat(64);
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/** Exactly what `GET /api/version` answers on a build from this tree (`lib/build-info.js`). */
function versionAnswer(capabilities = { text_style: 1, editorial_document: 1, post_read: 1 }) {
  return {
    ok: true,
    service: 'nexus-web',
    api_contract: 1,
    commit: COMMIT,
    commit_short: COMMIT.slice(0, 7),
    commit_source: 'RAILWAY_GIT_COMMIT_SHA',
    built_at: '2026-10-26T21:53:06.000Z',
    source_fingerprint: FINGERPRINT,
    capabilities,
    runtime: 'node v24.19.0',
  };
}

/** A deployment from before the editorial rounds: it has no `/api/version`, so the route goes through auth. */
function stubFetch(answer, status = 200) {
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url: String(url), options: options ?? {} });
    return { ok: status >= 200 && status < 300, status, json: async () => answer };
  };
  return sent;
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('operația a reușit, deși nu trebuia');
}

test('un răspuns real devine o valoare citibilă, cu buildul care l-a dat', () => {
  const read = version.readBackendVersion(versionAnswer());
  assert.equal(read.apiContract, 1);
  assert.equal(read.commit, COMMIT);
  assert.equal(read.commitShort, 'a1b2c3d');
  assert.equal(read.commitSource, 'RAILWAY_GIT_COMMIT_SHA');
  assert.equal(read.fingerprint, FINGERPRINT);
  assert.equal(read.builtAt, '2026-10-26T21:53:06.000Z');
  assert.equal(read.capabilities.text_style, 1);
  assert.equal(version.capabilityVersion(read, 'editorial_document'), 1);
  assert.equal(version.capabilityVersion(read, 'nope'), 0, 'o capacitate necunoscută nu are versiune');
});

test('un răspuns care nu este o versiune este refuzat întreg, nu citit pe jumătate', () => {
  const cases = [
    null,
    undefined,
    'ok',
    { ok: false, capabilities: { text_style: 1 } },
    { ok: true, capabilities: { text_style: 1 } },
    { ok: true, api_contract: 0, capabilities: { text_style: 1 } },
    { ok: true, api_contract: 1 },
    { ok: true, api_contract: 1, capabilities: { text_style: 'yes' } },
    { ok: true, api_contract: 1, capabilities: { text_style: -1 } },
  ];
  for (const answer of cases) {
    assert.equal(version.readBackendVersion(answer), null, `acceptat din greșeală: ${JSON.stringify(answer)}`);
  }
  // A missing identity is still an answer: the fingerprint names the build when the commit cannot.
  const anonymous = version.readBackendVersion({ ok: true, api_contract: 1, capabilities: { text_style: 1 } });
  assert.equal(anonymous.commit, null);
  assert.equal(anonymous.commitShort, null);
  assert.equal(anonymous.commitSource, 'unavailable');
  assert.equal(anonymous.fingerprint, null);
});

test('o capacitate care lipsește nu este niciodată o permisiune', () => {
  // A server that was never asked, and one that answered without the field, are the same answer here.
  assert.equal(version.supportsPage(null), false);
  assert.equal(version.hasCapability(null, 'text_style'), false);
  assert.deepEqual(version.missingCapabilities(null), ['text_style', 'editorial_document']);

  const stored = version.readBackendVersion(versionAnswer({ text_style: 1 }));
  assert.deepEqual(version.missingCapabilities(stored), ['editorial_document'],
    'o pagină are nevoie de amândouă: tema și aranjamentul');
  assert.equal(version.supportsPage(stored), false);

  const whole = version.readBackendVersion(versionAnswer());
  assert.equal(version.supportsPage(whole), true);
  // A later contract can ask for more of the same field without the phone guessing what a commit holds.
  assert.equal(version.hasCapability(whole, 'text_style', 2), false);
  assert.equal(version.hasCapability(whole, 'text_style', 1), true);
});

test('întrebarea pleacă fără sesiune și fără cookie, apoi se ține minte cinci minute', async () => {
  version.resetBackendVersionCache();
  const sent = stubFetch(versionAnswer());
  const first = await version.fetchBackendVersion({ origin: 'https://api.test/', now: 1_000 });
  assert.equal(first.commit, COMMIT);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.test/api/version', 'originea se curăță de slash-ul final');
  assert.equal(sent[0].options.method, 'GET');
  assert.equal(sent[0].options.credentials, undefined, 'răspunsul despre build nu depinde de o sesiune');

  await version.fetchBackendVersion({ origin: 'https://api.test', now: 60_000 });
  assert.equal(sent.length, 1, 'un al doilea keystroke nu întreabă din nou');

  await version.fetchBackendVersion({ origin: 'https://api.test', now: 6 * 60_000 });
  assert.equal(sent.length, 2, 'după cinci minute serverul poate fi altul');
});

test('înainte de publicare întrebarea se pune proaspăt, nu din cache', async () => {
  version.resetBackendVersionCache();
  const sent = stubFetch(versionAnswer());
  await version.fetchBackendVersion({ origin: 'https://api.test', now: 1_000 });
  const asked = await version.requirePageCapabilities({ origin: 'https://api.test', now: 2_000 });
  assert.equal(sent.length, 2, 'un „da” vechi este exact răspunsul în care nu se poate avea încredere acum');
  assert.equal(asked.capabilities.text_style, 1);
});

test('un server care tace nu blochează publicarea; unul care răspunde rău o blochează', async () => {
  version.resetBackendVersionCache();
  globalThis.fetch = async () => { throw new TypeError('Network request failed'); };
  const silent = await version.fetchBackendVersion({ origin: 'https://api.test' }).catch((error) => error);
  assert.equal(silent.name, 'BackendVersionError');
  assert.equal(silent.code, 'BACKEND_VERSION_UNREACHABLE');
  assert.equal(await version.requirePageCapabilities({ origin: 'https://api.test' }), null,
    'tăcerea nu este un refuz: plasa din publishClient rămâne dedesubt');

  // The older deployment: the route is unknown, so it goes through `requireAuth` and answers 401.
  version.resetBackendVersionCache();
  stubFetch({ error: 'unauthorized' }, 401);
  const unreadable = await rejection(version.requirePageCapabilities({ origin: 'https://api.test' }));
  assert.equal(unreadable.name, 'BackendVersionError');
  assert.equal(unreadable.code, 'BACKEND_VERSION_UNREADABLE');
  assert.equal(unreadable.status, 401);
  assert.match(unreadable.message, /nu a fost trimisă/);
});

test('serverul web chiar publică aceste capacități, pe ruta pe care aplicația o întreabă', () => {
  const buildInfo = readFileSync(resolve(ROOT, '..', 'nexus-web', 'lib', 'build-info.js'), 'utf8');
  /**
   * Pe nume, nu pe valoare: `PAGE_CAPABILITIES` spune de la ce număr o pagină se întoarce întreagă, iar
   * `build-info.js` trebuie să declare cel puțin atât. `text_style` este singurul nume a cărui **valoare**
   * contează (`2` = șase fețe și `xlarge`, `apps/nexus-web/lib/post-text-style.js`), deci el se citește
   * explicit: un server care ar rămâne la `1` ar refuza „Mașină" după ce autorul a scris-o.
   */
  for (const name of Object.keys(version.PAGE_CAPABILITIES)) {
    const declared = new RegExp(`\\b${name}:\\s*(\\d+)\\b`).exec(buildInfo);
    assert.ok(declared, `nexus-web nu declară capacitatea ${name}`);
    assert.ok(Number(declared[1]) >= version.PAGE_CAPABILITIES[name], `nexus-web declară ${name} prea vechi`);
  }
  assert.match(buildInfo, /\btext_style:\s*2\b/, 'nexus-web declară a doua înțelegere a fețelor de text');
  assert.match(buildInfo, /export function versionView/);
  const api = readFileSync(resolve(ROOT, '..', 'nexus-web', 'lib', 'api.js'), 'utf8');
  assert.match(api, /path === "\/api\/version"/, 'ruta nu este montată în api.js');
  assert.match(api, /versionView\(\)/, 'ruta trebuie să răspundă cu versionView()');
  assert.equal(version.VERSION_PATH, '/api/version');
  assert.equal(version.API_CONTRACT, 1);
});

test('editorul întreabă înainte să încarce fișiere, iar textul rămâne pe telefon', () => {
  const editor = readFileSync(resolve(ROOT, 'src/app/text.tsx'), 'utf8');
  const asked = editor.indexOf('await requirePageCapabilities()');
  const uploaded = editor.indexOf('await uploadTextAttachments(');
  assert.ok(asked > 0, 'compozitorul nu întreabă ce poate serverul');
  assert.ok(uploaded > 0);
  assert.ok(asked < uploaded, 'întrebarea se pune înainte de încărcare, nu după');
  assert.match(editor, /reason\.name === 'BackendVersionError'/, 'refuzul se tipărește cu propoziția lui');

  // The net under the gate: the answer itself is still checked for a lost page.
  const publish = readFileSync(resolve(ROOT, 'src/lib/publishClient.ts'), 'utf8');
  assert.match(publish, /PUBLISH_TEXT_STYLE_LOST/);
  assert.match(publish, /authoredPage\(body\) && !answeredPage\(answer\)/);
});

test('un server vechi este numit, iar autorul află că nimic nu a plecat', async () => {
  version.resetBackendVersionCache();
  stubFetch(versionAnswer({ post_read: 1 }));
  const outdated = await rejection(version.requirePageCapabilities({ origin: 'https://api.test' }));
  assert.equal(outdated.name, 'BackendVersionError');
  assert.equal(outdated.code, 'BACKEND_OUTDATED');
  assert.match(outdated.message, /text_style/);
  assert.match(outdated.message, /editorial_document/);
  assert.match(outdated.message, /Textul rămâne salvat pe telefon/);
  assert.doesNotMatch(outdated.message, /^[A-Z_]+$/, 'mesajul este o propoziție, nu un cod');
});

/**
 * Contractul de text, a doua înțelegere (`JUNGLE_BOOK_PROGRESS.md` §33.1).
 *
 * Defectul din 28 octombrie 2026 nu a fost o literă lipsă în compozitor, ci o întrebare lipsă: serverul
 * din fața telefonului cunoștea trei fețe, compozitorul oferea șase, iar `text_style: 1` arăta exact ca
 * `text_style: 2`. Telefonul a scris pagina în „Mașină", a trimis-o, iar serverul a refuzat-o cu
 * `TEXT_STYLE_INVALID` — pe care editorul nu putea să-l tipărească altfel decât „Alege o temă din listă",
 * o propoziție despre alt câmp. Testele de aici țin cele patru răspunsuri ale porții noi.
 */
test('o pagină în „Mașină" întreabă serverul înainte să plece, și trece pe unul care știe șase fețe', async () => {
  version.resetBackendVersionCache();
  const sent = stubFetch(versionAnswer({ text_style: 2, editorial_document: 1 }));
  const accepted = await version.requireTextStyleContract({ font: 'slab', size: 'medium' }, { origin: 'https://api.test' });
  assert.equal(version.capabilityVersion(accepted, 'text_style'), 2);
  assert.equal(sent.length, 1, 'întrebarea se pune o dată, pe ruta de versiune');
  assert.match(sent[0].url, /\/api\/version$/);
});

test('pe un server care cunoaște trei fețe, pagina este oprită înainte de POST, cu litera pe nume', async () => {
  version.resetBackendVersionCache();
  stubFetch(versionAnswer({ text_style: 1, editorial_document: 1 }));
  for (const [style, named] of [
    [{ font: 'slab', size: 'medium' }, /litera „Mașină" \(slab\)/],
    [{ font: 'casual', size: 'small' }, /litera „De mână" \(casual\)/],
    [{ font: 'condensed', size: 'large' }, /litera „Îngust" \(condensed\)/],
    [{ font: 'serif', size: 'xlarge' }, /mărimea „xlarge"/],
  ]) {
    const refused = await rejection(version.requireTextStyleContract(style, { origin: 'https://api.test' }));
    assert.equal(refused.name, 'BackendVersionError', `${style.font}/${style.size} nu este refuzat`);
    assert.equal(refused.code, 'BACKEND_TEXT_STYLE_OLDER');
    assert.match(refused.message, named);
    assert.match(refused.message, /Textul rămâne salvat pe telefon/, 'autorul află că nu a pierdut pagina');
    assert.match(refused.message, /cunoaște text_style v1/, 'refuzul spune ce versiune are serverul');
  }
});

test('o pagină care nu are nevoie de nimic nou nu întreabă nimic', async () => {
  version.resetBackendVersionCache();
  const sent = stubFetch(versionAnswer({ text_style: 1, editorial_document: 1 }));
  // Fețele și mărimile dintâi trec fără nicio cerere: un server vechi rămâne folosibil pentru ele.
  assert.equal(version.textStyleNeedsV2({ font: 'serif', size: 'large' }), false);
  assert.equal(await version.requireTextStyleContract({ font: 'serif', size: 'large' }, { origin: 'https://api.test' }), null);
  assert.equal(await version.requireTextStyleContract(null, { origin: 'https://api.test' }), null);
  assert.equal(sent.length, 0, 'nicio cerere pentru o pagină obișnuită');
  // …iar cele noi sunt recunoscute fără să întrebe pe nimeni.
  for (const font of version.TEXT_STYLE_V2_FONTS) assert.equal(version.textStyleNeedsV2({ font }), true, font);
  for (const size of version.TEXT_STYLE_V2_SIZES) assert.equal(version.textStyleNeedsV2({ size }), true, size);
});

test('un server care tace nu blochează publicarea, iar plasa din client rămâne dedesubt', async () => {
  version.resetBackendVersionCache();
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  // Tăcerea este aceeași conexiune pe care ar folosi-o POST-ul: nu devine un refuz de publicare.
  assert.equal(await version.requireTextStyleContract({ font: 'slab', size: 'medium' }, { origin: 'https://api.test' }), null);
  const editor = readFileSync(resolve(ROOT, 'src/app/text.tsx'), 'utf8');
  assert.match(editor, /await requireTextStyleContract\(draft\.style\)/,
    'compozitorul întreabă contractul de text înainte de publicare');
  // Refuzul nu are nevoie de un `catch` propriu: `BackendVersionError` este deja tipărit cu propoziția lui,
  // iar `BACKEND_TEXT_STYLE_OLDER` este un cod al aceleiași clase (`lib/backendVersion.ts`).
  assert.match(editor, /reason\.name === 'BackendVersionError'/, 'refuzul este tipărit cu propoziția lui');
  const gate = editor.indexOf('await requireTextStyleContract(draft.style)');
  assert.ok(gate > 0 && gate < editor.indexOf('await uploadTextAttachments('), 'întrebarea se pune înainte de încărcare');
});

