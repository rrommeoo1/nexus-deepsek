import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contactIdentity, nextOverlayToken } from '../public/messenger-contact.js';
import { inboxShell, personaBadge } from '../public/messenger-shell.js';
import { createDemoThreads, demoConversation } from '../public/social-inbox-demo.js';

test('contact card opens without secure-context crypto APIs; demo calls stay explicitly unavailable', async () => {
  const source = readFileSync(new URL('../public/messenger-contact.js', import.meta.url), 'utf8');
  const navigation = source.slice(source.indexOf('export function bindDialogNavigation'), source.indexOf('export function createContactOptions')).replace('export ', '');
  const fn = source.slice(source.indexOf('export function openContactCard'), source.indexOf('export function bindContactAvatars')).replace('export ', '');
  for (const demoOnly of [false, true]) {
    const nodes = new Map(), listeners = new Map(), actions = [];
    const controls = ['message', 'audio', 'video', 'profile'].map((action) => ({ dataset: { contactAction: action } }));
    const dialog = { isConnected: true, setAttribute() {},
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); },
      querySelectorAll: () => controls,
      addEventListener(name, callback) { listeners.set(name, callback); },
      showModal() { this.open = true; }, remove() { this.isConnected = false; },
      close() { this.open = false; listeners.get('close')?.(); },
    };
    const root = { querySelector: () => null, append() {} };
    const conversation = { kind: 'direct', context_persona: 'social', participants: [{ id: 1 }, { id: 2, display_name: 'SYSTEM_TEST Peer' }] };
    const history = { state: {}, pushState(value) { this.state = value; } };
    const options = { viewerId: 1, t: (key) => key, esc: String, safeInternalMediaUrl: () => null,
      current: () => true, onAction: (action) => actions.push(action), onHistoryBack() {}, demoOnly };
    runInNewContext(`${navigation}; ${fn}; openContactCard(root, conversation, null, options);`, {
      crypto: undefined, document: { createElement: () => dialog }, history, contactIdentity, personaBadge, nextOverlayToken, icons: {}, root, conversation, options,
    });
    assert.equal(dialog.open, true);
    assert.match(history.state.nexusContact, /^messenger-ui-/);
    await controls[1].onclick();
    if (demoOnly) {
      assert.equal(dialog.open, true);
      assert.equal(nodes.get('[role="status"]').textContent, 'messenger.demoCalls');
      assert.deepEqual(actions, []);
      await controls[0].onclick();
      assert.deepEqual(actions, ['message']);
    } else assert.deepEqual(actions, ['audio']);
  }
});

test('real and demo conversation opening no longer requires crypto.randomUUID on LAN HTTP', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const demo = readFileSync(new URL('../public/social-inbox-demo.js', import.meta.url), 'utf8');
  assert.doesNotMatch(demo, /crypto\.randomUUID/);
  assert.doesNotMatch(app.slice(app.indexOf('async function openThread('), app.indexOf('async function loadThread(')), /crypto\.randomUUID/);
  const factory = app.slice(app.indexOf('function newUploadMutationKey('), app.indexOf('async function fileSha256('));
  const nonce = runInNewContext(`${factory}; newUploadMutationKey('message')`, { crypto: {} });
  assert.match(nonce, /^[A-Za-z0-9:_-]{8,80}$/);
  assert.notEqual(nextOverlayToken(), nextOverlayToken());
});

test('each module including All is selectable; cloned logo has an independent gradient and Messages label', () => {
  for (const module of ['social', 'dating', 'work', 'travel', 'market', 'all']) {
    const html = inboxShell(String, String, 'inbox', '<svg id="nexus-wordmark-x" fill="url(#nexus-wordmark-x)"></svg>', module);
    assert.match(html, new RegExp(`data-inbox-persona="${module}" aria-pressed="true"`));
    assert.doesNotMatch(html, /nexus-wordmark-x|<select|securityState|inboxSpaces/);
    assert.match(html, /url\(#nexus-messenger-x\)/);
    assert.match(html, /MESSAGES/);
    assert.equal((html.match(/id="conversation-search"/g) || []).length, 1);
  }
});

test('demo row adapter has no real IDs and preserves fixtures and contextual identity', () => {
  const threads = createDemoThreads();
  threads.forEach((thread, index) => {
    const row = demoConversation(thread, index);
    assert.equal(row.id, -index - 1);
    assert.equal(row.classification, 'SYSTEM_TEST');
    assert.equal(row.context_persona, 'social');
    assert.equal(row.participants.every((p) => p.id <= 0), true);
    assert.equal(row.last_message.body, thread.messages.at(-1).body);
  });
});
