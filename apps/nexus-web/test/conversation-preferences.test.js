import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceKey, readConversationPreferences, saveConversationPreferences } from '../public/conversation-preferences.js';
import { readFileSync } from 'node:fs';

test('chat preferences are scoped by owner, profile and conversation and validate every value', () => {
  const records = new Map(), storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
  const scope = { ownerId: 1, persona: 'social', conversationId: 2 };
  const value = { theme: 'forest', muted: true, expires: '3600' };
  assert.equal(saveConversationPreferences(scope, value, storage), true);
  assert.deepEqual(readConversationPreferences(scope, storage), value);
  for (const other of [{ ...scope, ownerId: 2 }, { ...scope, persona: 'dating' }, { ...scope, conversationId: 3 }]) {
    assert.deepEqual(readConversationPreferences(other, storage), { theme: 'nexus', muted: false, expires: '' });
  }
  for (const bad of [{ ...value, theme: 'url(external)' }, { ...value, muted: 'true' }, { ...value, expires: '123' }]) assert.equal(saveConversationPreferences(scope, bad, storage), false);
  assert.equal(preferenceKey({ ...scope, ownerId: NaN }), null);
  records.set(preferenceKey(scope), '{invalid'); assert.equal(readConversationPreferences(scope, storage).muted, false);
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(saveConversationPreferences(scope, value, denied), false);
  assert.deepEqual(readConversationPreferences(scope, denied), { theme: 'nexus', muted: false, expires: '' });
});

test('mute gates only the new-message alert, keeping unread refresh and authorized events', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const events = app.slice(app.indexOf('  es.addEventListener("message",'), app.indexOf('  es.addEventListener("typing",'));
  assert.match(events, /if \(!isRecipientBound\(payload\)/);
  assert.match(events, /ownerId: viewerId, persona: viewerPersona, conversationId: Number\(payload.conversation_id\)/);
  assert.match(events, /\.muted\) toast\(t\("messages.newMessage"\)\)/);
  assert.match(events, /refreshMessageBadge\(\)/);
  assert.match(events, /renderView\(\)/);
});
