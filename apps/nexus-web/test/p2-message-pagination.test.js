import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

function request(url, cookie) {
  return {
    method: "GET", url, headers: { cookie }, socket: { remoteAddress: "127.0.0.94" },
    on(event, callback) { if (event === "end") process.nextTick(callback); return this; },
    once() { return this; }, destroy() {},
  };
}

function response() {
  return {
    statusCode: 200, headers: {}, body: "",
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value || ""); },
  };
}

async function get(context, path, cookie) {
  const res = response();
  await handleRequest(request(path, cookie), res, context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} };
}

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const viewer = repo.createUser({ handle: "chat_cursor_viewer", displayName: "Viewer" });
  repo.ensurePersona(viewer.id, "social", { visibility: "public" });
  repo.ensurePersona(viewer.id, "work", { visibility: "public" });
  const session = issueSession(viewer.id, "social");
  repo.insertSession({ tokenHash: session.tokenHash, userId: viewer.id, persona: "social", expiresAt: session.expiresAt });
  return {
    db, repo, viewer, cookie: `nexus_session=${session.token}`,
    context: { db, repo, sse: { publish() { return {}; }, broadcast() { return {}; }, subscribe() { return () => {}; } } },
  };
}

test('conversation search covers older pages, Unicode names, exact personas and signed query cursors', async () => {
  const state = fixture();
  try {
    const ids = [];
    for (let i = 0; i < 36; i++) {
      const peer = state.repo.createUser({ handle: `space_peer_${i}`, displayName: 'SYSTEM_TEST Peer', trafficClass: 'SYSTEM_TEST' });
      state.repo.ensurePersona(peer.id, 'social', { name: i === 0 ? 'Ștefan Contact' : `Contact ${i}`, visibility: 'public' });
      ids.push(state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: 'social' }));
    }
    const initial = await get(state.context, '/api/chat/conversations?limit=30', state.cookie);
    assert.equal(initial.body.conversations.some((c) => c.id === ids[0].id), false);
    const found = await get(state.context, '/api/chat/conversations?persona=social&q=STEFAN&limit=20', state.cookie);
    assert.deepEqual(found.body.conversations.map((c) => c.id), [ids[0].id]);
    const first = await get(state.context, '/api/chat/conversations?persona=social&q=Contact&limit=20', state.cookie);
    assert.equal(first.body.conversations.length, 20);
    const next = await get(state.context, '/api/chat/conversations?persona=social&q=Contact&limit=20&cursor=' + encodeURIComponent(first.body.next_cursor), state.cookie);
    assert.equal(next.body.conversations.length, 16);
    assert.equal(new Set([...first.body.conversations, ...next.body.conversations].map((c) => c.id)).size, 36);
    const invalid = await get(state.context, '/api/chat/conversations?persona=social&q=STEFAN&limit=20&cursor=' + encodeURIComponent(first.body.next_cursor), state.cookie);
    assert.equal(invalid.status, 400);
    const peer = ids[0].participants.find((p) => p.id !== state.viewer.id);
    state.repo.ensurePersona(peer.id, 'work', { name: 'Confidential Work', visibility: 'public' });
    state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: 'work' });
    const hidden = await get(state.context, '/api/chat/conversations?persona=social&q=Confidential&limit=20', state.cookie);
    assert.deepEqual(hidden.body.conversations, []);
    state.repo.setProfileBlock(peer.id, 'social', state.viewer.id, true);
    const blocked = await get(state.context, '/api/chat/conversations?persona=social&q=STEFAN&limit=20', state.cookie);
    assert.deepEqual(blocked.body.conversations, []);
  } finally { state.db.close(); }
});

test('thread opens latest messages or a bounded authorized target window, never foreign or expired targets', async () => {
  const state = fixture();
  try {
    const peer = state.repo.createUser({ handle: 'window_peer', displayName: 'SYSTEM_TEST Peer', trafficClass: 'SYSTEM_TEST' });
    state.repo.ensurePersona(peer.id, 'social', { visibility: 'public' });
    const conversation = state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: 'social' });
    const messages = [];
    for (let i = 0; i < 260; i++) messages.push(state.repo.sendConversationMessage({ conversationId: conversation.id,
      senderId: state.viewer.id, senderPersona: 'social', body: 'Window needle ' + i, clientNonce: 'window-' + i }));
    const route = '/api/chat/conversations/' + conversation.id + '/messages';
    const latest = await get(state.context, route, state.cookie);
    assert.equal(latest.body.messages.length, 200);
    assert.equal(latest.body.messages.at(-1).id, messages.at(-1).id);
    assert.equal(latest.body.messages[0].id, messages[60].id);
    const target = await get(state.context, route + '?around_message_id=' + messages[20].id, state.cookie);
    assert.equal(target.body.messages.length, 60);
    assert.equal(target.body.query.around_message_id, messages[20].id);
    assert.ok(target.body.messages.some((m) => m.id === messages[20].id));
    assert.ok(target.body.messages.every((m, i, all) => !i || all[i - 1].id < m.id));
    const nonexistent = await get(state.context, route + '?around_message_id=999999', state.cookie);
    assert.equal(nonexistent.status, 404);
    const otherPeer = state.repo.createUser({ handle: 'other_window_peer', displayName: 'SYSTEM_TEST Other', trafficClass: 'SYSTEM_TEST' });
    state.repo.ensurePersona(otherPeer.id, 'social', { visibility: 'public' });
    const other = state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: otherPeer.id, contextPersona: 'social' });
    const foreign = state.repo.sendConversationMessage({ conversationId: other.id, senderId: state.viewer.id,
      senderPersona: 'social', body: 'Ștefan începe conversația', clientNonce: 'foreign-window' });
    assert.equal((await get(state.context, route + '?around_message_id=' + foreign.id, state.cookie)).status, 404);
    const folded = await get(state.context, '/api/chat/search?persona=social&q=STEFAN&limit=20', state.cookie);
    assert.deepEqual(folded.body.messages.map((m) => m.id), [foreign.id]);
    state.db.prepare('UPDATE message_items SET expires_at = unixepoch() - 1 WHERE id = ?').run(foreign.id);
    assert.equal(state.repo.getConversationDetails(other.id, state.viewer.id).last_message.body, '');
    assert.equal(state.repo.getConversationDetails(other.id, state.viewer.id).last_message.status, 'expired');
    state.db.prepare('UPDATE message_items SET expires_at = unixepoch() - 1 WHERE id = ?').run(messages[20].id);
    assert.equal((await get(state.context, route + '?around_message_id=' + messages[20].id, state.cookie)).status, 404);
    const neighbor = await get(state.context, route + '?around_message_id=' + messages[21].id, state.cookie);
    const expired = neighbor.body.messages.find((m) => m.id === messages[20].id);
    assert.equal(expired.status, 'expired'); assert.equal(expired.body, ''); assert.equal(expired.attachment_url, null);
    const search = await get(state.context, '/api/chat/search?persona=social&q=Window%20needle%2020&limit=20', state.cookie);
    assert.equal(search.body.messages.some((m) => m.id === messages[20].id), false);
    state.db.prepare('UPDATE conversation_participants SET history_start_message_id = ? WHERE user_id = ? AND conversation_id = ?')
      .run(messages[30].id, state.viewer.id, conversation.id);
    assert.equal((await get(state.context, route + '?around_message_id=' + messages[21].id, state.cookie)).status, 404);
    state.repo.setProfileBlock(peer.id, 'social', state.viewer.id, true);
    assert.equal((await get(state.context, route + '?around_message_id=' + messages[240].id, state.cookie)).status, 403);
  } finally { state.db.close(); }
});

test('one peer has separate conversations and avatars per persona; inbox filtering never substitutes another avatar', async () => {
  const state = fixture();
  try {
    const peer = state.repo.createUser({ handle: 'persona_peer', displayName: 'Peer account' });
    const ids = [];
    for (const [index, persona] of ['social', 'dating', 'work'].entries()) {
      state.repo.ensurePersona(state.viewer.id, persona, { visibility: 'public' });
      const avatar = '/media/' + String(index + 1).repeat(64) + '.jpg';
      state.repo.ensurePersona(peer.id, persona, { name: 'Peer ' + persona, avatar, visibility: 'public' });
      const conversation = state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: persona });
      ids.push(conversation.id);
      const page = await get(state.context, '/api/chat/conversations?persona=' + persona + '&box=inbox', state.cookie);
      assert.equal(page.status, 200);
      assert.equal(page.body.conversations.length, 1);
      assert.equal(page.body.conversations[0].context_persona, persona);
      const identity = page.body.conversations[0].participants.find((participant) => participant.id === peer.id);
      assert.equal(identity.avatar, avatar);
      assert.equal(identity.display_name, 'Peer ' + persona);
    }
    assert.equal(new Set(ids).size, 3);
    const all = await get(state.context, '/api/chat/conversations?persona=all&box=inbox', state.cookie);
    assert.equal(all.body.conversations.length, 3);
    state.db.prepare("UPDATE personas SET avatar = NULL WHERE user_id = ? AND persona = 'dating'").run(peer.id);
    assert.equal(state.repo.getConversationDetails(ids[1], state.viewer.id).participants.find((p) => p.id === peer.id).avatar, null);
    assert.equal(state.repo.getConversationDetails(ids[0], state.viewer.id).participants.find((p) => p.id === peer.id).avatar, '/media/' + '1'.repeat(64) + '.jpg');
    const denied = state.repo.sendConversationMessage({ conversationId: ids[0], senderId: state.viewer.id, senderPersona: 'dating', body: 'wrong identity', clientNonce: 'persona-wrong-identity' });
    assert.equal(denied, null);
  } finally { state.db.close(); }
});

test("unified inbox cursor is signed, filter-bound and duplicate-free", async () => {
  const state = fixture();
  try {
    for (let index = 0; index < 24; index++) {
      const peer = state.repo.createUser({ handle: `chat_peer_${String(index).padStart(2, "0")}`, displayName: `Peer ${index}` });
      state.repo.ensurePersona(peer.id, "social", { visibility: "public" });
      state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: "social" });
    }
    const first = await get(state.context, "/api/chat/conversations?persona=social&box=inbox&limit=10", state.cookie);
    assert.equal(first.status, 200);
    assert.equal(first.body.conversations.length, 10);
    assert.match(first.body.next_cursor, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const second = await get(state.context, `/api/chat/conversations?persona=social&box=inbox&limit=10&cursor=${encodeURIComponent(first.body.next_cursor)}`, state.cookie);
    assert.equal(second.status, 200);
    assert.equal(second.body.conversations.length, 10);
    const ids = [...first.body.conversations, ...second.body.conversations].map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    const tampered = await get(state.context, `/api/chat/conversations?persona=social&box=inbox&limit=10&cursor=${encodeURIComponent(first.body.next_cursor + "x")}`, state.cookie);
    assert.equal(tampered.status, 400);
    const crossFilter = await get(state.context, `/api/chat/conversations?persona=work&box=inbox&limit=10&cursor=${encodeURIComponent(first.body.next_cursor)}`, state.cookie);
    assert.equal(crossFilter.status, 400);
  } finally { state.db.close(); }
});

test("message search is participant-only, plaintext-only, cursor-bound and block-aware", async () => {
  const state = fixture();
  try {
    const peer = state.repo.createUser({ handle: "search_peer", displayName: "Search Peer" });
    state.repo.ensurePersona(peer.id, "social", { visibility: "public" });
    const conversation = state.repo.createDirectConversation({ creatorId: state.viewer.id, recipientId: peer.id, contextPersona: "social" });
    for (let index = 0; index < 4; index++) state.repo.sendConversationMessage({
      conversationId: conversation.id, senderId: state.viewer.id, senderPersona: "social",
      body: `nexus needle ${index}`, clientNonce: `search-${index}`,
    });
    const encrypted = state.repo.sendConversationMessage({ conversationId: conversation.id, senderId: state.viewer.id, senderPersona: "social", body: "nexus needle encrypted", clientNonce: "search-encrypted" });
    state.db.prepare("UPDATE message_items SET encryption_mode = 'e2ee_v1' WHERE id = ?").run(encrypted.id);

    const first = await get(state.context, "/api/chat/search?persona=social&q=needle&limit=2", state.cookie);
    assert.equal(first.status, 200);
    assert.equal(first.body.encrypted_content_searchable_server_side, false);
    assert.equal(first.body.messages.length, 2);
    assert.ok(first.body.messages.every((message) => !message.body.includes("encrypted")));
    const second = await get(state.context, `/api/chat/search?persona=social&q=needle&limit=2&cursor=${encodeURIComponent(first.body.next_cursor)}`, state.cookie);
    assert.equal(second.status, 200);
    assert.equal(new Set([...first.body.messages, ...second.body.messages].map((message) => message.id)).size, 4);

    state.repo.setProfileBlock(peer.id, "social", state.viewer.id, true);
    const blocked = await get(state.context, "/api/chat/search?persona=social&q=needle&limit=20", state.cookie);
    assert.deepEqual(blocked.body.messages, []);
  } finally { state.db.close(); }
});
