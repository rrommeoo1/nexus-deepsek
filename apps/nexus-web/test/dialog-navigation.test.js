import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/messenger-contact.js', import.meta.url), 'utf8');
const navigation = source.slice(source.indexOf('export function bindDialogNavigation'), source.indexOf('export function createContactOptions')).replace('export ', '');
function fixture() {
  let closeEvent, retireComplete, authorized = true;
  const log = [];
  const dialog = { addEventListener: (name, callback) => { if (name === 'close') closeEvent = callback; },
    close() { log.push('close requested'); }, remove() { log.push('removed'); } };
  const history = { state: { route: 'inbox' }, pushState(state) { this.state = state; } };
  const options = { key: 'nexusContact', token: 'test-card', current: () => authorized,
    onHistoryBack: () => { log.push('history back'); return new Promise((resolve) => { retireComplete = resolve; }); },
    restoreFocus: () => log.push('focus') };
  const transition = runInNewContext(`${navigation}; bindDialogNavigation(dialog, options)`, { dialog, options, history });
  return { dialog, history, log, transition, closeEvent: () => closeEvent(),
    popstate: () => { history.state = { route: 'inbox' }; retireComplete(); }, revoke: () => { authorized = false; } };
}

test('destination waits for native close and popstate; repeated clicks produce only one transition', async () => {
  const f = fixture();
  const pending = f.transition(() => f.log.push('destination'));
  await f.transition(() => f.log.push('duplicate'));
  assert.deepEqual(f.log, ['close requested']);
  const closing = f.closeEvent();
  assert.deepEqual(f.log, ['close requested', 'removed', 'history back']);
  f.popstate(); await closing; await pending;
  assert.deepEqual(f.log, ['close requested', 'removed', 'history back', 'destination']);
});

test('account change while retiring history cancels the pending destination', async () => {
  const f = fixture();
  const pending = f.transition(() => f.log.push('leak'));
  const closing = f.closeEvent(); f.revoke(); f.popstate();
  await closing; await pending;
  assert.equal(f.log.includes('leak'), false);
});

test('phone Back dismisses only the top dialog without a second history traversal', async () => {
  const f = fixture();
  f.history.state = { route: 'inbox' };
  f.dialog.dismissFromHistory(); await f.closeEvent();
  assert.deepEqual(f.log, ['close requested', 'removed', 'focus']);
});

test('X restores focus only after retiring its own history entry', async () => {
  const f = fixture();
  f.dialog.close(); const closing = f.closeEvent();
  assert.equal(f.log.includes('focus'), false);
  f.popstate(); await closing;
  assert.equal(f.log.at(-1), 'focus');
});

test('closing a stale overlay never traverses another overlay history entry', async () => {
  const f = fixture();
  f.history.state = { nexusContact: 'other-card' };
  f.dialog.close(); await f.closeEvent();
  assert.equal(f.log.includes('history back'), false);
  assert.equal(f.log.includes('focus'), false);
});

test('a superseded card cannot open a destination on top of a newer overlay', async () => {
  const f = fixture();
  f.history.state = { nexusContact: 'newer-card' };
  const pending = f.transition(() => f.log.push('stale destination'));
  await f.closeEvent(); await pending;
  assert.equal(f.log.includes('stale destination'), false);
});
