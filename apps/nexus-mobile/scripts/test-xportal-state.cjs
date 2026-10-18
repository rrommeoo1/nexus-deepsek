/* global __dirname */
// Mașina de stări a conectării xPortal (`src/lib/xportalState.ts`), așa cum o conduce foaia.
// Ce se verifică aici: un attempt trece doar înainte, un `token` sau un `failed` nu mai pot fi
// resuscitate de un mesaj întârziat, iar expirarea de 120 s e singura cale către „nu a confirmat”.
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

const machine = load('src/lib/xportalState.ts');

/** The reducer applied to a list of actions, so a test reads as the story of one attempt. */
function run(actions, from = machine.XPORTAL_INITIAL_STATE) {
  return actions.reduce((state, action) => machine.xPortalReduce(state, action), from);
}

/** `n` ticks, the way the sheet's one-second timer would send them. */
function ticks(n) {
  return Array.from({ length: n }, () => ({ type: 'tick' }));
}

test('fereastra de așteptare este de 120 de secunde', () => {
  assert.equal(machine.XPORTAL_WAIT_SECONDS, 120);
  assert.equal(machine.XPORTAL_INITIAL_STATE.stage, 'idle');
  assert.equal(machine.XPORTAL_INITIAL_STATE.seconds, 120);
});

test('deschiderea foii pornește un attempt nou, în „preparing”', () => {
  const state = run([{ type: 'open' }]);
  assert.equal(state.stage, 'preparing');
  assert.equal(state.seconds, machine.XPORTAL_WAIT_SECONDS);
  assert.equal(state.reopened, 0);
  assert.equal(state.returns, 0);
});

test('pairing → signature → token, fără salt înapoi', () => {
  const state = run([
    { type: 'open' },
    { type: 'pairing' },
    { type: 'phase', phase: 'pairing' },
    { type: 'phase', phase: 'signature' },
    { type: 'token' },
  ]);
  assert.equal(state.stage, 'token');
  // Un `preparing` întârziat (pagina care se reîncarcă) nu are voie să readucă foaia în urmă.
  const late = machine.xPortalReduce(state, { type: 'phase', phase: 'preparing' });
  assert.equal(late.stage, 'token');
});


test('un pairing existent nu mai e trimis înapoi în „preparing”', () => {
  const paired = run([{ type: 'open' }, { type: 'pairing' }]);
  const state = machine.xPortalReduce(paired, { type: 'phase', phase: 'preparing' });
  assert.equal(state.stage, 'pairing');
});

test('ceasul expiră exact după 120 de secunde și doar în timpul așteptării', () => {
  const paired = run([{ type: 'open' }, { type: 'pairing' }]);
  const almost = ticks(119).reduce((state, action) => machine.xPortalReduce(state, action), paired);
  assert.equal(almost.stage, 'pairing');
  assert.equal(almost.seconds, 1);
  const expired = machine.xPortalReduce(almost, { type: 'tick' });
  assert.equal(expired.stage, 'expired');
  assert.equal(expired.seconds, 0);
  // În afara unei așteptări, un tick nu schimbă nimic.
  const idle = machine.xPortalReduce(machine.XPORTAL_INITIAL_STATE, { type: 'tick' });
  assert.equal(idle.stage, 'idle');
  assert.equal(idle.seconds, machine.XPORTAL_WAIT_SECONDS);
});

test('expirarea nu ascunde linkurile și nu mai e anunțată ca așteptare', () => {
  const expired = run([{ type: 'open' }, { type: 'pairing' }, ...ticks(120)]);
  assert.equal(expired.stage, 'expired');
  assert.equal(machine.xPortalIsWaiting(expired), false);
  const label = machine.xPortalWaitLabel(expired);
  assert.match(label, /nu a confirmat în 2 minute/);
  assert.match(label, /Redeschide xPortal/);
});

test('întoarcerea în aplicație după expirare redeschide fereastra', () => {
  const expired = run([{ type: 'open' }, { type: 'pairing' }, ...ticks(120)]);
  const back = machine.xPortalReduce(expired, { type: 'active' });
  assert.equal(back.stage, 'pairing');
  assert.equal(back.seconds, machine.XPORTAL_WAIT_SECONDS);
  assert.equal(back.returns, 1);
  assert.equal(machine.xPortalIsWaiting(back), true);
});

test('„Deschide xPortal din nou” resetează ceasul și numără redeschiderile', () => {
  const paired = run([{ type: 'open' }, { type: 'pairing' }, ...ticks(30), { type: 'active' }]);
  assert.equal(paired.returns, 1);
  assert.equal(paired.seconds, 90);
  const reopened = machine.xPortalReduce(paired, { type: 'reopen' });
  assert.equal(reopened.stage, 'pairing');
  assert.equal(reopened.seconds, machine.XPORTAL_WAIT_SECONDS);
  assert.equal(reopened.reopened, 1);
  assert.equal(reopened.returns, 1);
});

test('un token primit nu poate fi anulat de o eroare sau de un tick', () => {
  const token = run([{ type: 'open' }, { type: 'pairing' }, { type: 'token' }]);
  for (const action of [{ type: 'error' }, { type: 'tick' }, { type: 'phase', phase: 'failed' }, { type: 'pairing' }]) {
    assert.equal(machine.xPortalReduce(token, action).stage, 'token', `acțiune: ${action.type}`);
  }
  assert.equal(machine.xPortalIsFinished(token), true);
});

test('o eroare închide attempt-ul: nimic nu-l mai readuce în așteptare', () => {
  const failed = run([{ type: 'open' }, { type: 'pairing' }, { type: 'error' }]);
  assert.equal(failed.stage, 'failed');
  for (const action of [{ type: 'pairing' }, { type: 'active' }, { type: 'reopen' }, { type: 'phase', phase: 'signature' }]) {
    assert.equal(machine.xPortalReduce(failed, action).stage, 'failed', `acțiune: ${action.type}`);
  }
  assert.equal(machine.xPortalWaitLabel(failed), '');
});

test('închiderea foii șterge attempt-ul din memorie', () => {
  const closed = run([{ type: 'open' }, { type: 'pairing' }, { type: 'close' }]);
  assert.deepEqual(closed, machine.XPORTAL_INITIAL_STATE);
});

test('eticheta de așteptare spune secundele rămase și nu numește alt produs', () => {
  const paired = run([{ type: 'open' }, { type: 'pairing' }, ...ticks(15)]);
  const label = machine.xPortalWaitLabel(paired);
  assert.equal(label, 'Se așteaptă confirmarea din xPortal… (105s)');
  assert.doesNotMatch(label, /Nexus/);
  assert.equal(machine.xPortalWaitLabel(machine.XPORTAL_INITIAL_STATE), '');
});
