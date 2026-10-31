/* global __dirname */
// Politica de navigare a conectării xPortal (`src/lib/xportalNavigation.ts`) și felul în care foaia o
// folosește. Ce se verifică aici: xPortal se pune în față numai când starea autentificării spune că
// are ce arăta (pairing nou, cerere de semnătură publicată), niciodată de două ori pentru aceeași
// aprobare, iar cele cinci propoziții urmează stadiile reale — „reușit” numai după server.
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

const nav = load('src/lib/xportalNavigation.ts');

/** One decision, written the way the sheet calls it. */
function decide(overrides) {
  return nav.xPortalLaunchDecision({ reason: 'first-open', stage: 'pairing', hasPairing: true, now: 100000, ...overrides });
}

test('întârzierile sunt cele dovedite pe telefon', () => {
  // 1,2 s după `signature`: cererea e pe relay, iar xPortal are nevoie de un moment ca să o afișeze.
  assert.equal(nav.SIGNATURE_REOPEN_DELAY_MS, 1200);
  // Un wallet proaspăt deschis nu e redeschis: Android doar ar clipi între aplicații.
  assert.equal(nav.WALLET_FRESH_LAUNCH_MS, 4000);
  assert.equal(nav.UNSTUCK_DELAY_MS, 10000);
  assert.equal(nav.READER_LAUNCH_MIN_GAP_MS, 1500);
});

test('protecția de 6 s și grația de 500 ms din pagină rămân neatinse', () => {
  // Regula de lucru: 6 s nu se scot fără dovezi. Testul e aici ca o ștergere să nu treacă neobservată.
  const timing = readFileSync(resolve(ROOT, '../nexus-web/public/xportal-timing.js'), 'utf8');
  assert.match(timing, /export const APPROVAL_SETTLE_MS = 6000;/);
  assert.match(timing, /export const SIGN_GRACE_MS = 500;/);
  assert.match(timing, /export const MAX_GRACE_MS = 6000;/);
  const page = readFileSync(resolve(ROOT, '../nexus-web/public/xportal-bridge.js'), 'utf8');
  assert.match(page, /ceiling: APPROVAL_SETTLE_MS/);
});

test('fără pairing nu se deschide nimic', () => {
  const decision = decide({ hasPairing: false });
  assert.equal(decision.launch, false);
  assert.equal(decision.skip, 'no-pairing');
});

test('prima fereastră se deschide imediat, o singură dată', () => {
  const first = decide({ reason: 'first-open' });
  assert.equal(first.launch, true);
  assert.equal(first.waitMs, 0);
  // A doua cerere pentru același pairing, la 2 s după lansare, nu mai trimite niciun intent.
  const again = decide({ reason: 'first-open', now: 102000, openedAt: 100000 });
  assert.equal(again.launch, false);
  assert.equal(again.skip, 'wallet-in-front');
  // După fereastra de 4 s, o cerere nouă (un pairing nou) poate deschide din nou.
  assert.equal(decide({ reason: 'first-open', now: 104001, openedAt: 100000 }).launch, true);
});

test('a doua fereastră cere stadiul `signature`, nu `approved`', () => {
  // `approved` = walletul a spus da, pagina încă pregătește cererea: xPortal ar arăta un ecran gol.
  const early = decide({ reason: 'signature', stage: 'approved' });
  assert.equal(early.launch, false);
  assert.equal(early.skip, 'not-signed-yet');
  const published = decide({ reason: 'signature', stage: 'signature' });
  assert.equal(published.launch, true);
  assert.equal(published.waitMs, nav.SIGNATURE_REOPEN_DELAY_MS);
});

test('a doua fereastră se deschide o singură dată per attempt', () => {
  const twice = decide({ reason: 'signature', stage: 'signature', autoReopened: true });
  assert.equal(twice.launch, false);
  assert.equal(twice.skip, 'already-reopened');
});

test('un wallet înghețat e readus o dată, după 10 s, nu peste aprobare', () => {
  const soon = decide({ reason: 'unstuck', now: 105000, openedAt: 100000 });
  assert.equal(soon.launch, false);
  assert.equal(soon.skip, 'wallet-in-front');
  assert.equal(soon.waitMs, 5000);
  assert.equal(decide({ reason: 'unstuck', now: 110000, openedAt: 100000 }).launch, true);
  // O aprobare deja primită are propriul re-open; două intent-uri ar clipi între aplicații.
  assert.equal(decide({ reason: 'unstuck', now: 120000, openedAt: 100000, autoReopened: true }).skip, 'already-reopened');
  assert.equal(decide({ reason: 'unstuck', now: 120000, openedAt: 100000, unstuckUsed: true }).skip, 'already-reopened');
});

test('un tap repetat pe „Deschide xPortal” nu trimite două intent-uri', () => {
  assert.equal(decide({ reason: 'reader', now: 100500, openedAt: 100000 }).skip, 'wallet-in-front');
  assert.equal(decide({ reason: 'reader', now: 101600, openedAt: 100000 }).launch, true);
});

test('stadiile finale nu mai deschid nimic', () => {
  for (const stage of ['idle', 'token', 'authenticated', 'failed']) {
    const decision = decide({ stage, reason: 'reader' });
    assert.equal(decision.launch, false, stage);
    assert.equal(decision.skip, 'finished', stage);
  }
});

test('cele cinci propoziții sunt cele cerute, pe stadiile lor', () => {
  assert.equal(nav.XPORTAL_OPENING_SENTENCE, 'Se deschide xPortal…');
  assert.equal(nav.XPORTAL_CONNECT_SENTENCE, 'Confirmă conectarea în xPortal');
  assert.equal(nav.XPORTAL_PREPARING_SENTENCE, 'Pregătim autentificarea…');
  assert.equal(nav.XPORTAL_SIGNATURE_SENTENCE, 'Confirmă semnătura în xPortal');
  assert.equal(nav.XPORTAL_DONE_SENTENCE, 'Autentificare reușită');
  assert.equal(nav.xPortalStageSentence('preparing'), nav.XPORTAL_OPENING_SENTENCE);
  assert.equal(nav.xPortalStageSentence('pairing'), nav.XPORTAL_CONNECT_SENTENCE);
  assert.equal(nav.xPortalStageSentence('approved'), nav.XPORTAL_PREPARING_SENTENCE);
  assert.equal(nav.xPortalStageSentence('signature'), nav.XPORTAL_SIGNATURE_SENTENCE);
  assert.equal(nav.xPortalStageSentence('authenticated'), nav.XPORTAL_DONE_SENTENCE);
  // Stadiile care nu se anunță: foaia își păstrează atunci textul paginii.
  assert.equal(nav.xPortalStageSentence('idle'), '');
  assert.equal(nav.xPortalStageSentence('expired'), '');
  assert.equal(nav.xPortalStageSentence('failed'), '');
  assert.equal(nav.xPortalStageSentence('token'), '');
});

test('fallback-ul de întoarcere se scrie înainte de a pleca din aplicație', () => {
  const hint = nav.xPortalReturnHint('signature');
  assert.match(hint, /revino în Jungle Book/);
  assert.match(hint, /recent/);
  // În `pairing` întoarcerea o face aplicația (auto-reopen), deci nu se cere nimic cititorului.
  assert.equal(nav.xPortalReturnHint('pairing'), '');
  assert.equal(nav.xPortalReturnHint('idle'), '');
});

test('foaia nu mai deschide xPortal direct, ci prin decizie', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  // Un singur loc trimite intent-ul, iar el întreabă politica.
  assert.equal((sheet.match(/void openXPortal\(/g) || []).length, 0);
  assert.match(sheet, /const decision = xPortalLaunchDecision\(\{/);
  assert.match(sheet, /if \(!decision\.launch\) \{\s*\n\s*logXPortal\('xportal-open-skipped'/);
  // Cele trei căi: pairing nou, semnătură publicată, tap-ul cititorului.
  assert.match(sheet, /void launchWallet\(parsed\.uri, 'first-open'\);/);
  assert.match(sheet, /void launchWallet\(current\.uri, 'signature', \{ scheduled: true \}\);/);
  assert.match(sheet, /void launchWallet\(current\.uri, 'unstuck', \{ scheduled: true \}\);/);
  assert.match(sheet, /void launchWallet\(pairing\.uri, 'reader'\);/);
  // Un attempt închis nu poate fi „readus” de un timer rămas în urmă.
  assert.match(sheet, /pairingRef\.current\?\.uri !== uri/);
});

test('a doua fereastră nu mai stivulește o activitate xPortal neagră', () => {
  // Măsurat pe telefon (dumpsys window): `Linking.openURL` pune doar `NEW_TASK`, iar al doilea link —
  // cel pentru semnătură — deschidea o a doua activitate `MVX` în procesul deja viu al xPortal, care
  // rămânea neagră peste un minut. `SINGLE_TOP | CLEAR_TOP` aduc task-ul în față și anunță activitatea
  // existentă; testul apără cele trei flag-uri și drumul prin care pleacă linkul.
  assert.equal(nav.WALLET_INTENT_FLAGS, 0x34000000);
  const intents = readFileSync(resolve(ROOT, 'src/lib/xportalIntents.ts'), 'utf8');
  assert.match(intents, /flags: WALLET_INTENT_FLAGS/);
  assert.match(intents, /startActivityAsync\(WALLET_INTENT_ACTION, \{ data: link, flags: WALLET_INTENT_FLAGS \}\)/);
  // Fallback-ul rămâne, ca un build fără modulul nativ să poată deschide walletul ca înainte.
  assert.match(intents, /await Linking\.openURL\(link\);/);
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  assert.match(sheet, /const transport = await openWalletRequest\(link\);/);
  // Niciun drum ocolitor prin `Linking.openURL` în foaie: ar sări peste flag-uri.
  assert.equal((sheet.match(/Linking\.openURL/g) || []).length, 0);
});

test('„reușit” se scrie numai după ce serverul a confirmat sesiunea', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/XPortalSheet.tsx'), 'utf8');
  const call = sheet.indexOf('signInWithXPortalToken(parsed.token)');
  const verified = sheet.indexOf("dispatch({ type: 'authenticated' })");
  const handed = sheet.indexOf('return onAuthenticated(result);');
  assert.ok(call > 0 && verified > call, 'stadiul `authenticated` vine după apelul la server');
  assert.ok(handed > verified, 'profilul se deschide după stadiul confirmat');
  // O singură trecere în `authenticated`, în acel `.then`.
  assert.equal((sheet.match(/type: 'authenticated'/g) || []).length, 1);
});

test('întoarcerea automată lasă o urmă: `link-return`', () => {
  const layout = readFileSync(resolve(ROOT, 'src/app/_layout.tsx'), 'utf8');
  assert.match(layout, /Linking\.addEventListener\('url'/);
  assert.match(layout, /logXPortal\('link-return', \{ route, cold \}\)/);
  const login = readFileSync(resolve(ROOT, 'src/lib/xportalLogin.ts'), 'utf8');
  assert.match(login, /export function xPortalReturnRoute/);
});

