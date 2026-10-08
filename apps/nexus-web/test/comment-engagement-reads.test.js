import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { issueSession } from '../lib/security.js';
import { handleRequest } from '../lib/api.js';

function response() {
  return { statusCode: 200, headers: {}, body: '', writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; }, getHeader(name) { return this.headers[name]; }, end(value) { this.body = String(value || ''); } };
}
function request(method, url, cookie, body, key) {
  const raw = Buffer.from(JSON.stringify(body || {}));
  return { method, url, headers: { 'content-type': 'application/json', cookie, 'idempotency-key': key }, socket: { remoteAddress: '127.0.0.241' },
    on(event, callback) { if (event === 'data') process.nextTick(() => callback(raw)); if (event === 'end') process.nextTick(callback); return this; }, destroy() {} };
}
function fixture() {
  const db = openDb(':memory:'); const repo = createRepo(db);
  const users = ['quote-owner', 'quote-reader', 'quote-hidden'].map((handle) => {
    const user = repo.createUser({ handle, displayName: handle });
    repo.ensurePersona(user.id, 'social', { visibility: 'public' });
    const session = issueSession(user.id, 'social');
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: 'social', expiresAt: session.expiresAt });
    return { ...user, cookie: `nexus_session=${session.token}` };
  });
  const post = repo.createPost({ userId: users[0].id, persona: 'social', kind: 'text', caption: 'Test comments', visibility: 'public' });
  const comment = repo.addSocialComment({ userId: users[0].id, postId: post.id, body: 'A source comment' });
  let counter = 0;
  return { db, repo, users, post, comment, async call(method, path, body = {}, actor = 0, key) {
    const res = response();
    await handleRequest(request(method, path, users[actor].cookie, body, key || `comment-engagement-${++counter}-unique`), res, { db, repo, sse: { broadcast() {} } });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  } };
}

test('likes expose real visible LIKE actors, not a fabricated count', async () => {
  const f = fixture();
  try {
    f.repo.setCommentReaction(f.users[1].id, 'social', f.comment.id, 'LIKE', true);
    f.repo.setCommentReaction(f.users[2].id, 'social', f.comment.id, 'LOVE', true);
    const first = await f.call('GET', `/api/comments/${f.comment.id}/likes`);
    assert.equal(first.status, 200);
    assert.equal(first.body.total_visible, 1);
    assert.equal(first.body.items[0].handle, 'quote-reader');
    assert.equal(first.body.items[0].actor_persona, 'social');
    assert.equal(first.body.items[0].body, undefined);
    f.repo.setProfileBlock(f.users[0].id, 'social', f.users[1].id, true);
    const blocked = await f.call('GET', `/api/comments/${f.comment.id}/likes`);
    assert.deepEqual(blocked.body.items, []);
    assert.equal(blocked.body.total_visible, 0);
  } finally { f.db.close(); }
});

test('quotes are authored records, paginated, replay-safe and withdrawable only by author', async () => {
  const f = fixture();
  try {
    const path = `/api/comments/${f.comment.id}/quotes`;
    assert.deepEqual((await f.call('GET', path)).body.items, []);
    const created = await f.call('POST', path, { body: 'My own context for this comment.' }, 1, 'quote-create-idempotency-0001');
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const replay = await f.call('POST', path, { body: 'My own context for this comment.' }, 1, 'quote-create-idempotency-0001');
    assert.equal(replay.body.quote.id, created.body.quote.id);
    assert.equal((await f.call('POST', path, { body: 'Second real quote.' }, 2)).status, 201);
    const page = await f.call('GET', `${path}?limit=1`);
    assert.equal(page.body.total_visible, 2);
    assert.equal(page.body.items.length, 1);
    assert.equal(page.body.next_cursor, '1');
    assert.equal((await f.call('GET', `${path}?limit=1&cursor=1`)).body.items.length, 1);
    assert.equal((await f.call('DELETE', `/api/comment-quotes/${created.body.quote.id}`, {}, 2)).status, 404);
    assert.equal((await f.call('DELETE', `/api/comment-quotes/${created.body.quote.id}`, {}, 1)).status, 200);
    assert.equal((await f.call('GET', path)).body.total_visible, 1);
    assert.equal((await f.call('GET', `${path}?limit=100`)).status, 400);
  } finally { f.db.close(); }
});
