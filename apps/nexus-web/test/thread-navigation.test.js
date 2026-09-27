import test from 'node:test';
import assert from 'node:assert/strict';
import { createThreadNavigation, messageTarget, messageWindowQuery } from '../public/thread-navigation.js';
import { createContactOptions } from '../public/messenger-contact.js';

test('message window query admits only positive exact IDs and confines device query encoding', () => {
  for (const value of [null, '', 'x', -1, 1.2, Infinity]) assert.equal(messageTarget(value), null);
  assert.equal(messageWindowQuery(null, null), '');
  const params = new URLSearchParams(messageWindowQuery('device&other=1', 72));
  assert.equal(params.get('device_id'), 'device&other=1');
  assert.equal(params.get('around_message_id'), '72');
  assert.equal(params.has('other'), false);
});

test('jump highlights once, realtime respects scroll, Latest jumps to bottom, Back restores inbox and focus', () => {
  let jumps = 0, focus = 0, highlighted = 0;
  const node = { classList: { add() { highlighted++; } }, setAttribute() {}, scrollIntoView() { jumps++; }, focus() {} };
  const box = { querySelector: () => node, scrollTop: 0, scrollHeight: 5000 };
  const viewport = { scrollTop: 500, isConnected: true }, opener = { isConnected: true, focus() { focus++; } };
  const navigation = createThreadNavigation(); navigation.enter(44, viewport, opener);
  navigation.position(box, { top: 0, atBottom: true });
  assert.equal(jumps, 1); assert.equal(highlighted, 1);
  navigation.position(box, { top: 230, atBottom: false });
  assert.equal(jumps, 1); assert.equal(box.scrollTop, 230);
  navigation.latest(); navigation.position(box, { top: 230, atBottom: false });
  assert.equal(box.scrollTop, 5000);
  viewport.scrollTop = 900; navigation.restore();
  assert.equal(viewport.scrollTop, 500); assert.equal(focus, 1); assert.equal(navigation.target, null);
});

test('contact actions use the loaded thread without an inbox row and never replace its historical window', async () => {
  let state = { user: { id: 1 }, persona: 'social' }, active = 2;
  const actions = [], audio = { disabled: false, click: () => actions.push('audio') };
  const root = { isConnected: true, querySelector: () => audio };
  const options = createContactOptions({ root, getState: () => state, t: (v) => v, esc: String, safeInternalMediaUrl: () => '', api: async () => ({}),
    openThread: async (id) => { active = id; actions.push('open'); }, activeConversation: () => active,
    openProfile: (handle) => actions.push(handle), showStories() {}, onHistoryBack() {}, toast: (text) => actions.push(text) });
  const conversation = { id: 2, context_persona: 'social' }, peer = { handle: 'peer' };
  await options.onAction('audio', conversation, peer); assert.deepEqual(actions, ['audio']);
  await options.onAction('profile', conversation, peer); assert.equal(actions.at(-1), 'peer');
  audio.disabled = true; audio.title = 'HTTPS required';
  await options.onAction('video', conversation, peer); assert.equal(actions.at(-1), 'HTTPS required');
  await options.onAction('profile', { ...conversation, context_persona: 'dating' }, peer);
  assert.match(actions.at(-1), /identityRequired dating/);
  state = { user: { id: 9 }, persona: 'social' }; const count = actions.length;
  await options.onAction('audio', conversation, peer); assert.equal(actions.length, count);
});
import { readFileSync } from 'node:fs';

test('confirmed send leaves a historical search window before reloading either message transport', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const reset = source.slice(source.indexOf('const resetConfirmedIntent ='), source.indexOf('submit.disabled = true;', source.indexOf('const resetConfirmedIntent =')));
  assert.match(reset, /form\.dataset\.messageKey !== intent\.messageKey/);
  assert.match(reset, /threadNavigation\.latest\(\)/);
  assert.match(reset, /thread\.querySelector\('\.threadWindowReturn'\)\?\.remove\(\)/);
  assert.equal((source.match(/resetConfirmedIntent\(\);\s*output\.textContent = "";\s*await loadThread\(conversationId\);/g) || []).length, 2);
});
