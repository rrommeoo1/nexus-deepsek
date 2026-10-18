/* global __dirname */
// Logarea cu xPortal, așa cum o citește telefonul (`src/lib/xportalLogin.ts`) și cum o duce la
// sesiune (`signInWithXPortalToken`, `src/lib/session.ts`). Ce se verifică aici e granița: un mesaj
// străin sau un token care nu are forma NativeAuth nu are voie să devină sesiune, iar linkul care
// deschide xPortal trebuie să fie chiar universal link-ul walletului.
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

const login = load('src/lib/xportalLogin.ts');
const sessionSource = readFileSync(resolve(ROOT, 'src/lib/session.ts'), 'utf8');

/** The page's own envelope, with the fields a real event carries. */
function envelope(type, fields = {}) {
  return JSON.stringify({ source: 'nexus-xportal', type, ...fields });
}

const TOKEN = `${'a'.repeat(84)}.${'b'.repeat(51)}.${'c'.repeat(128)}`;
const ADDRESS = `erd1${'q'.repeat(58)}`;

test('pagina de conectare se încarcă de pe chiar originea API-ului', () => {
  assert.equal(login.xPortalBridgeUrl('http://localhost:5000'), 'http://localhost:5000/xportal-bridge.html');
  assert.equal(login.xPortalBridgeUrl('https://nexus.example.com/'), 'https://nexus.example.com/xportal-bridge.html');
  // O origine fără http(s) nu poate servi pagina; refuzul e explicit, nu un URL inventat.
  assert.throws(() => login.xPortalBridgeUrl('file:///sdcard/xportal.html'), /http\(s\)/);
  assert.throws(() => login.xPortalBridgeUrl('nu-i-un-url'), /validă/);
});

test('linkul care deschide xPortal e universal link-ul walletului, cu URI-ul codificat', () => {
  const uri = 'wc:abc123@2?relay-protocol=irn&symKey=ff00';
  const link = login.xPortalDeepLink(uri);
  assert.match(link, /^https:\/\/xportal\.app\.link\/wc\?uri=/);
  assert.equal(decodeURIComponent(link.split('uri=')[1]), uri);
  // Orice altceva decât un pairing WalletConnect este refuzat: nu deschidem xPortal în gol.
  assert.throws(() => login.xPortalDeepLink('https://evil.example'), /URI de pairing/);
  assert.throws(() => login.xPortalDeepLink(''), /URI de pairing/);
});

test('handoff-ul încearcă schemele pe care xPortal le declară, în ordine', () => {
  const uri = 'wc:abc123@2?relay-protocol=irn&symKey=ff00';
  const links = login.xPortalWalletLinks(uri);
  // `wc:` este schema pe care xPortal o înregistrează pentru WalletConnect; universal link-ul e ultimul.
  assert.equal(links[0], uri);
  assert.equal(links[1], `xportal://wc?uri=${encodeURIComponent(uri)}`);
  assert.equal(links[2], `https://xportal.app.link/wc?uri=${encodeURIComponent(uri)}`);
  assert.throws(() => login.xPortalWalletLinks('nu-e-wc'), /URI de pairing/);
});

test('starea paginii ajunge la telefon ca propoziţie, nu ca HTML sau ca text nemărginit', () => {
  const event = login.parseXPortalBridgeMessage(envelope('status', { message: '  Obţin challenge-ul  ' }));
  assert.deepEqual(event, { kind: 'status', message: 'Obţin challenge-ul' });
  const long = login.parseXPortalBridgeMessage(envelope('status', { message: 'x'.repeat(500) }));
  assert.equal(long.message.length, 240);
  assert.equal(login.parseXPortalBridgeMessage(envelope('status', { message: '   ' })), null);
});


test('un token care nu are forma NativeAuth nu poate deschide sesiunea', () => {
  assert.equal(login.nativeAuthTokenIsValid(TOKEN), true);
  for (const bad of ['', 'abc', `${'a'.repeat(84)}.${'b'.repeat(51)}`, `${'a'.repeat(84)}.${'b'.repeat(51)}.${'z'.repeat(128)}`]) {
    assert.equal(login.nativeAuthTokenIsValid(bad), false, bad);
    assert.equal(login.parseXPortalBridgeMessage(envelope('token', { token: bad, address: ADDRESS })), null);
  }
  assert.equal(login.parseXPortalBridgeMessage(envelope('token', { token: TOKEN, address: 'erd1scurt' })), null);
  const good = login.parseXPortalBridgeMessage(envelope('token', { token: TOKEN, address: ADDRESS }));
  assert.deepEqual(good, { kind: 'token', token: TOKEN, address: ADDRESS });
});

test('mesajele străine, malformate sau cu alt tip sunt ignorate în bloc', () => {
  assert.equal(login.parseXPortalBridgeMessage('nu e json'), null);
  assert.equal(login.parseXPortalBridgeMessage(''), null);
  assert.equal(login.parseXPortalBridgeMessage(null), null);
  assert.equal(login.parseXPortalBridgeMessage('[1,2,3]'), null);
  // Altă pagină din WebView nu poate pretinde că e bridge-ul xPortal.
  assert.equal(login.parseXPortalBridgeMessage(JSON.stringify({ source: 'altceva', type: 'token', token: TOKEN, address: ADDRESS })), null);
  assert.equal(login.parseXPortalBridgeMessage(JSON.stringify({ type: 'token', token: TOKEN, address: ADDRESS })), null);
  assert.equal(login.parseXPortalBridgeMessage(envelope('necunoscut', { message: 'x' })), null);
});

test('eşecurile spun ce poate face cititorul, iar textul necunoscut rămâne al serverului', () => {
  assert.match(login.xPortalFailureSentence('loginul NativeAuth a fost anulat în xPortal'), /anulat/);
  assert.match(login.xPortalFailureSentence('xPortal nu a răspuns în 3 minute'), /nu a răspuns la timp/);
  assert.match(login.xPortalFailureSentence('WalletConnect nu a creat sesiunea: project id allowlist relay'), /WalletConnect Dashboard/);
  assert.equal(login.xPortalFailureSentence('token NativeAuth invalid sau expirat'), 'token NativeAuth invalid sau expirat');
  assert.match(login.xPortalFailureSentence(''), /a eșuat/);
});

test('tokenul semnat e schimbat pe sesiune de server, cu Origin şi cheie de idempotenţă', () => {
  // Ruta, antetele şi scrierea sesiunii sunt singurul drum de la semnătură la `nexus_session`.
  assert.match(sessionSource, /export async function signInWithXPortalToken\(token: string\)/);
  assert.match(sessionSource, /fetch\(`\$\{API_ORIGIN\}\/auth\/mvx\/native`/);
  assert.match(sessionSource, /Origin: API_ORIGIN/);
  assert.match(sessionSource, /'Idempotency-Key': newMutationKey\('xportal-login'\)/);
  const body = sessionSource.slice(sessionSource.indexOf('signInWithXPortalToken'));
  assert.match(body, /body: JSON\.stringify\(\{ token \}\)/);
  assert.match(body, /cookieValue\(cookies, 'nexus_session'\)/);
  assert.match(body, /writeSession\(\{ token: sessionToken, deviceId, cookieSession: !sessionToken \}\)/);
});

test('ecranul de login deschide foaia xPortal, nu mai anunţă că nu e portată', () => {
  const indexSource = readFileSync(resolve(ROOT, 'src/app/index.tsx'), 'utf8');
  assert.match(indexSource, /import \{ XPortalSheet \} from '\.\.\/components\/XPortalSheet'/);
  assert.match(indexSource, /onXPortal=\{\(\) => \{ setError\(''\); setXportalOpen\(true\); \}\}/);
  assert.match(indexSource, /<XPortalSheet\s+visible=\{xportalOpen\}/);
  assert.doesNotMatch(indexSource, /nu este încă portată/);
  // Foaia închide sesiunea numai după ce serverul a confirmat contul.
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  assert.match(sheet, /signInWithXPortalToken\(parsed\.token\)/);
  assert.match(sheet, /parseXPortalBridgeMessage\(event\.nativeEvent\.data\)/);
  assert.match(sheet, /xPortalBridgeUrl\(API_ORIGIN, \{ native: redirectNative \}\)/);
});

test('redirectul dat lui xPortal e schemă goală sau nimic', () => {
  assert.equal(login.xPortalRedirectScheme('nexusdev'), 'nexusdev://');
  assert.equal(login.xPortalRedirectScheme('  NexusDev '), 'nexusdev://');
  assert.equal(login.xPortalRedirectScheme(['nexus', 'altceva']), 'nexus://');
  // Un path, o schemă web sau un tip greșit nu sunt o adresă către aplicația asta.
  for (const bad of ['', 'nexus/app', 'https://nexus.dev', 'nexus dev', null, undefined, 42, {}, ['']]) {
    assert.equal(login.xPortalRedirectScheme(bad), '', JSON.stringify(bad));
  }
});

test('pagina primește redirectul doar ca schemă, iar universal doar ca http(s)', () => {
  const url = new URL(login.xPortalBridgeUrl('https://nexus.example.com', {
    native: 'nexusdev://',
    universal: 'https://nexus.example.com/xportal-bridge.html',
  }));
  assert.equal(url.pathname, '/xportal-bridge.html');
  assert.equal(url.searchParams.get('redirect'), 'nexusdev://');
  assert.equal(url.searchParams.get('universal'), 'https://nexus.example.com/xportal-bridge.html');
  // Fără redirect, URL-ul rămâne exact cel de dinainte: niciun parametru inventat.
  assert.equal(new URL(login.xPortalBridgeUrl('https://nexus.example.com')).search, '');
  // Un `redirect` cu path ar fi un al doilea drum în afara aplicației, deci e ignorat.
  const rejected = new URL(login.xPortalBridgeUrl('https://nexus.example.com', {
    native: 'nexus://open', universal: 'javascript:alert(1)',
  }));
  assert.equal(rejected.search, '');
});

test('fazele paginii sunt doar cele cinci pe care le înțelege foaia', () => {
  for (const phase of ['preparing', 'pairing', 'signature', 'token', 'failed']) {
    assert.deepEqual(login.parseXPortalBridgeMessage(envelope('phase', { phase })), { kind: 'phase', phase });
  }
  assert.equal(login.parseXPortalBridgeMessage(envelope('phase', { phase: 'gata' })), null);
  assert.equal(login.parseXPortalBridgeMessage(envelope('phase', {})), null);
});

test('relay-ul și copierea se citesc strict: numai `true` este `true`', () => {
  assert.deepEqual(
    login.parseXPortalBridgeMessage(envelope('relay', { connected: true, restarted: true, error: '' })),
    { kind: 'relay', connected: true, restarted: true, error: '' },
  );
  assert.deepEqual(
    login.parseXPortalBridgeMessage(envelope('relay', { connected: 'true', restarted: 1 })),
    { kind: 'relay', connected: false, restarted: false, error: '' },
  );
  assert.deepEqual(login.parseXPortalBridgeMessage(envelope('copied', { ok: true })), { kind: 'copied', ok: true });
  assert.deepEqual(login.parseXPortalBridgeMessage(envelope('copied', {})), { kind: 'copied', ok: false });
});

test('logul paginii nu poate duce pe telefon URI-ul de pairing sau cheia simetrică', () => {
  const parsed = login.parseXPortalBridgeMessage(envelope('log', {
    event: 'pairing',
    fields: {
      topic: 'abc123def456',
      uri: 'wc:abc123def456@2?symKey=ff00',
      symKey: 'ff00',
      note: 'relay-protocol irn, symkey ff00',
      waitedSeconds: 42.6,
      restarted: true,
      'bad key': 'x',
    },
  }));
  assert.equal(parsed.kind, 'log');
  assert.equal(parsed.event, 'pairing');
  assert.deepEqual(parsed.fields, { topic: 'abc123def456', waitedSeconds: 43, restarted: true });
  assert.equal(login.parseXPortalBridgeMessage(envelope('log', { event: '   ' })), null);
});

test('din URI-ul de pairing iese doar topicul, niciodată cheia', () => {
  assert.equal(login.xPortalPairingTopic('wc:abc123def456@2?relay-protocol=irn&symKey=ff00'), 'abc123def456');
  assert.equal(login.xPortalPairingTopic('https://evil.example'), '');
  assert.equal(login.xPortalPairingTopic('wc:scurt@2'), '');
  assert.equal(login.xPortalPairingTopic(undefined), '');
});

test('foaia cere reluarea relay-ului când aplicația revine în față', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  // Android suspendează socketul cât timp xPortal e în față: întoarcerea în app trebuie să-l reînvie.
  assert.match(sheet, /AppState\.addEventListener\('change'/);
  assert.match(sheet, /window\.__nexusResume/);
  assert.match(sheet, /window\.__nexusCopy/);
  // Ceasul de 120 s și starea încercării trăiesc în mașina de stări, nu în booleeni separați.
  assert.doesNotMatch(sheet, /const WAIT_SECONDS = 120;/);
  assert.match(sheet, /const \[attempt, dispatch\] = useReducer\(xPortalReduce, XPORTAL_INITIAL_STATE\);/);
  assert.match(sheet, /if \(!visible \|\| !xPortalIsWaiting\(attempt\)\) return;/);
  assert.match(sheet, /setTimeout\(\(\) => dispatch\(\{ type: 'tick' \}\), 1000\)/);
  assert.match(sheet, /\{waitLabel \? \(/);
  assert.match(sheet, /xPortalRedirectScheme\(Constants\.expoConfig\?\.scheme\)/);
  // Fără `redirect`, xPortal nu are unde să întoarcă cititorul: parametrul trebuie să plece în URL.
  assert.match(sheet, /xPortalBridgeUrl\(API_ORIGIN, \{ native: redirectNative \}\)/);
});

test('pairing-ul poartă URI-ul şi linkul; un URI care nu e wc: nu trece', () => {
  const event = login.parseXPortalBridgeMessage(envelope('pairing', {
    uri: 'wc:topic-abcdef@2?relay-protocol=irn', deepLink: 'https://xportal.app.link/wc?uri=wc%3Atopic',
  }));
  assert.equal(event.kind, 'pairing');
  assert.equal(event.uri, 'wc:topic-abcdef@2?relay-protocol=irn');
  assert.equal(event.deepLink, 'https://xportal.app.link/wc?uri=wc%3Atopic');
  // Fără link, telefonul îl construieşte din URI — niciodată invers.
  const withoutLink = login.parseXPortalBridgeMessage(envelope('pairing', { uri: 'wc:topic-abcdef@2' }));
  assert.equal(withoutLink.deepLink, login.xPortalDeepLink('wc:topic-abcdef@2'));
  // Un URI prea scurt pentru un pairing real este respins fără să arunce.
  assert.equal(login.parseXPortalBridgeMessage(envelope('pairing', { uri: 'wc:scurt' })), null);
  assert.equal(login.parseXPortalBridgeMessage(envelope('pairing', { uri: 'https://xportal.app' })), null);
});

test('încercarea întreruptă de sistem se spune, nu se uită', () => {
  const now = 1_700_000_000_000;
  const topic = 'ab'.repeat(32);
  const record = login.xPortalAttemptRecord(topic, 'pairing', now);
  assert.deepEqual(record, { topic, phase: 'pairing', startedAt: now });
  // Ce nu e topic de pairing nu devine fișier.
  assert.equal(login.xPortalAttemptRecord('scurt', 'pairing', now), null);
  assert.equal(login.xPortalAttemptRecord('', 'pairing', now), null);

  assert.match(login.describeInterruptedAttempt(record, now + 120_000), /întreruptă acum 2 min/);
  // Terminată, prea veche sau fără formă: nimic de anunțat.
  assert.equal(login.describeInterruptedAttempt({ ...record, phase: 'complete' }, now), '');
  assert.equal(login.describeInterruptedAttempt({ ...record, phase: 'failed' }, now), '');
  assert.equal(login.describeInterruptedAttempt(record, now + login.XPORTAL_ATTEMPT_MAX_AGE_MS + 1), '');
  assert.equal(login.describeInterruptedAttempt(record, now - 1), '');
  assert.equal(login.describeInterruptedAttempt(null, now), '');
  assert.equal(login.describeInterruptedAttempt({ topic: 'x' }, now), '');
  assert.equal(login.isXPortalAttemptFinished('token'), true);
  assert.equal(login.isXPortalAttemptFinished('pairing'), false);
});

test('foaia scrie nota încercării la pairing şi o şterge când încercarea se termină', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  assert.match(sheet, /writeXPortalAttempt\(xPortalAttemptRecord\(xPortalPairingTopic\(parsed\.uri\), 'pairing'\)\)/);
  assert.match(sheet, /if \(isXPortalAttemptFinished\(parsed\.phase\)\) clearXPortalAttempt\(\);/);
  assert.match(sheet, /const interrupted = readXPortalAttempt\(\);/);
  assert.match(sheet, /setResumed\(sentence\)/);
  // Nota se scrie din topicul extras din URI, niciodată din URI-ul întreg (care duce cheia simetrică).
  assert.match(sheet, /writeXPortalAttempt\(xPortalAttemptRecord\(xPortalPairingTopic/);
});

test('fraza de eroare păstrează originea exactă de adăugat în WalletConnect', () => {
  const sentence = 'xPortal nu poate porni: WalletConnect refuză originea https://nexus.example. Adaugă exact https://nexus.example în WalletConnect Cloud → Settings → Allowed origins.';
  assert.equal(login.xPortalFailureSentence(sentence), sentence);
  // Restul erorilor rămân pe rezumatul scurt.
  assert.match(login.xPortalFailureSentence('relay nu a răspuns'), /Serverul nu poate deschide conexiunea WalletConnect/);
});
