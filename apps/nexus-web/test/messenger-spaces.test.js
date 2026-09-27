import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageSearch, validSearchPage } from '../public/messenger-search.js';
import { contactIdentity } from '../public/messenger-contact.js';
import { renderConversationRow } from '../public/messenger-shell.js';
import { contactStories } from '../public/contact-stories.js';

test('contact Stories reject cross-persona, expired, malformed or foreign author media', () => {
  const options = { viewerId: 1, peerId: 2, safeUrl: (url) => url.startsWith('/media/'), now: 100 };
  const story = { id: 1, user_id: 2, persona: 'social', status: 'active', visibility: 'private', caption: 'Hello',
    author: { id: 2, handle: 'peer_user' }, created_at: 50, content_commitment: 'a'.repeat(64), expires_at: 200, lifecycle: 'expires', view_progress: 1 };
  const result = { ok: true, viewer_id: 1, viewer_persona: 'social', state: 'all', stories: [story] };
  assert.equal(contactStories(result, options).length, 1); // seen Stories remain accessible here
  assert.equal(contactStories({ ...result, viewer_persona: 'dating' }, options), null);
  assert.equal(contactStories({ ...result, viewer_id: 4 }, options), null);
  for (const change of [{ expires_at: 99 }, { persona: 'work' }, { author: { id: 3, handle: 'other' } },
    { media: { kind: 'image', hash: '../../secret', ext: 'jpg' } }]) {
    assert.equal(contactStories({ ...result, stories: [{ ...story, ...change }] }, options), null);
  }
  assert.deepEqual(contactStories({ ...result, stories: [{ ...story, user_id: 3 }] }, options), []);
});

const context = { persona: 'social', viewerId: 1, viewerPersona: 'social' };
const page = (q, messages = [], cursor = null, next = null) => ({ ok: true, privacy_enforced_server_side: true,
  encrypted_content_searchable_server_side: false, viewer_id: 1, viewer_persona: 'social',
  query: { text: q, persona: 'social', limit: 20, cursor }, messages, next_cursor: next });
const message = (id) => ({ id, conversation_id: 2, sender_handle: 'peer_user', body: 'hello' });

test('search validates viewer, persona, encryption boundary, cursor and duplicate identities', () => {
  const expected = { ...context, query: 'hello', cursor: null };
  assert.equal(validSearchPage(page('hello', [message(1)]), expected), true);
  for (const change of [{ viewer_id: 2 }, { viewer_persona: 'dating' }, { encrypted_content_searchable_server_side: true },
    { privacy_enforced_server_side: false }, { messages: [message(1), message(1)] }, { messages: [{ ...message(1), id: -1 }] }]) {
    assert.equal(validSearchPage({ ...page('hello'), ...change }, expected), false);
  }
  assert.equal(validSearchPage(page('old'), expected), false);
  assert.equal(validSearchPage(page('hello', [], 'foreign.cursor'), expected), false);
});

test('typing, clearing and account changes suppress late search results', async () => {
  const pending = [], states = []; let authorized = true;
  const search = createMessageSearch({ context, current: () => authorized, render: (s) => states.push(s),
    request: () => new Promise((resolve) => pending.push(resolve)) });
  search.reset('old'); const old = search.load();
  search.reset('new'); const recent = search.load();
  pending[1](page('new', [message(2)])); await recent;
  pending[0](page('old', [message(1)])); await old;
  assert.equal(states.at(-1).messages[0].id, 2);
  search.reset('last'); const last = search.load(); search.reset('');
  pending[2](page('last', [message(3)])); await last;
  assert.equal(states.at(-1).state, 'idle');
  search.reset('peer'); const switched = search.load(); authorized = false;
  pending[3](page('peer', [message(4)])); await switched;
  assert.equal(states.at(-1).state, 'loading'); // no old-account result delivered
});

test('pagination is single-flight, retries failures, rejects duplicate pages', async () => {
  const states = [], pending = [], urls = [];
  const search = createMessageSearch({ context, current: () => true, render: (s) => states.push(s),
    request: (url) => { urls.push(url); return new Promise((resolve) => pending.push(resolve)); } });
  search.reset('hello'); const first = search.load(); await search.load();
  assert.equal(urls.length, 1); pending[0](null); await first;
  assert.equal(states.at(-1).state, 'error'); const retry = states.at(-1).retry();
  pending[1](page('hello', [message(1)], null, 'next.cursor')); await retry;
  const next = states.at(-1).more();
  assert.match(urls.at(-1), /cursor=next.cursor/);
  pending[2](page('hello', [message(1)], 'next.cursor')); await next;
  assert.equal(states.at(-1).state, 'error');
});

test('contact identity is contextual, groups never masquerade as a person', () => {
  const conversation = { kind: 'direct', context_persona: 'dating', participants: [{ id: 1 }, { id: 2, avatar: '/media/dating.jpg' }] };
  assert.equal(contactIdentity(conversation, 1).avatar, '/media/dating.jpg');
  assert.equal(contactIdentity(conversation, 1).persona, 'dating');
  assert.equal(contactIdentity({ ...conversation, kind: 'group' }, 1), null);
  assert.equal(contactIdentity({ ...conversation, context_persona: 'unknown' }, 1), null);
});

test('conversation search uses authorized server pages and rejects a mismatched box or unsafe row', async () => {
  const states = [], urls = [], responses = [];
  const result = (items, cursor = null, next = null) => ({ ...page('peer', [], cursor, next),
    query: { ...page('peer').query, box: 'requests', cursor }, conversations: items });
  const search = createMessageSearch({ kind: 'conversations', context: { ...context, box: 'requests' },
    current: () => true, render: (state) => states.push(state),
    validateConversation: (row, viewer) => Number.isSafeInteger(row.id) && row.id > 0 && row.viewer === viewer,
    request: async (url) => { urls.push(url); return responses.shift(); } });
  search.reset('peer');
  responses.push(result([{ id: 7, viewer: 1 }], null, 'next.page')); await search.load();
  assert.match(urls[0], /^\/api\/chat\/conversations\?/);
  assert.equal(new URLSearchParams(urls[0].split('?')[1]).get('box'), 'requests');
  responses.push(result([{ id: 8, viewer: 1 }], 'next.page')); await states.at(-1).more();
  assert.deepEqual(states.at(-1).messages.map((row) => row.id), [7, 8]);
  search.reset('peer');
  responses.push({ ...result([]), query: { ...result([]).query, box: 'inbox' } }); await search.load();
  assert.equal(states.at(-1).state, 'error');
  responses.push(result([{ id: 9, viewer: 2 }])); await states.at(-1).retry();
  assert.equal(states.at(-1).state, 'error');
});

test('avatar and conversation are sibling keyboard controls, never nested buttons', () => {
  const html = renderConversationRow({ id: 2, kind: 'direct', context_persona: 'social', participants: [{ id: 1 }, { id: 2, handle: 'peer', display_name: 'Peer' }] }, {
    state: { user: { id: 1 } }, t: (v) => v, esc: String, safeInternalMediaUrl: () => null, usernameSigil: () => '', orbitStatusChip: () => '', interfaceLocale: 'ro',
  });
  assert.match(html, /^<div class="conversationRow"/);
  assert.match(html, /class="contactAvatar"[^>]*data-contact="2"/);
  assert.match(html, /<\/button><button type="button" class="conversationOpen">/);
  assert.equal((html.match(/<button /g) || []).length, 2);
  assert.equal((html.match(/<\/button>/g) || []).length, 2);
});
