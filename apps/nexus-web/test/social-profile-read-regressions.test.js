import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { handleRequest } from '../lib/api.js';
import { issueSession } from '../lib/security.js';

function fixture() {
  const db = openDb(':memory:'), repo = createRepo(db);
  const users = ['read_author', 'read_viewer', 'read_other'].map((handle) => {
    const user = repo.createUser({ handle, displayName: handle, trafficClass: 'SYSTEM_TEST' });
    repo.ensurePersona(user.id, 'social', { visibility: 'public' });
    return user;
  });
  const context = { db, repo, sse: { broadcast() {}, publish() {} } };
  async function read(user, persona = 'social') {
    const session = issueSession(user.id, persona);
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona, expiresAt: session.expiresAt });
    const req = { method: 'GET', url: '/api/profiles/read_author?persona=social',
      headers: { cookie: `nexus_session=${session.token}` }, socket: { remoteAddress: '127.0.0.181' } };
    const res = { status: 200, setHeader() {}, writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } };
    await handleRequest(req, res, context);
    return res;
  }
  return { db, repo, author: users[0], viewer: users[1], other: users[2], read };
}

test('Social profile finds author posts even after more than 100 newer posts by others', async () => {
  const f = fixture();
  try {
    const own = [1, 2, 3].map((n) => f.repo.createPost({ userId: f.author.id, persona: 'social', caption: `author ${n}` }));
    // Stable ordering independent of wall-clock resolution.
    f.db.prepare('UPDATE posts SET created_at = 100 WHERE user_id = ?').run(f.author.id);
    for (let i = 0; i < 105; i++) f.repo.createPost({ userId: f.other.id, persona: 'social', caption: `other ${i}` });
    const hidden = f.repo.createPost({ userId: f.author.id, persona: 'social', caption: 'private marker', visibility: 'private' });
    const response = await f.read(f.viewer);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.posts.map((post) => post.id).sort(), own.map((post) => post.id).sort());
    assert.equal(response.body.profile.counts.posts, 3);
    assert.equal(response.body.posts.some((post) => post.id === hidden.id), false);
  } finally { f.db.close(); }
});

test('private Social offer stays in its active persona and blocked/hidden profiles stay undiscoverable', async () => {
  const f = fixture();
  try {
    f.repo.updatePersona(f.author.id, 'social', { name: 'Private Social identity', visibility: 'private',
      discoverability: 'public', privateAccess: { enabled: true, priceCents: 100, currency: 'USD', durationDays: 1 } });
    const allowed = await f.read(f.viewer);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.locked, true);
    assert.deepEqual(allowed.body.posts, []);
    assert.equal('avatar' in allowed.body.profile, false);
    // Negative boundary test only: no other vertical or profile is exercised.
    const wrongPersona = await f.read(f.viewer, 'work');
    assert.equal(wrongPersona.status, 404);
    assert.equal(JSON.stringify(wrongPersona.body).includes('Private Social identity'), false);
    f.repo.setProfileBlock(f.author.id, 'social', f.viewer.id, true);
    assert.equal((await f.read(f.viewer)).status, 404);
    f.repo.setProfileBlock(f.author.id, 'social', f.viewer.id, false);
    f.repo.updatePersona(f.author.id, 'social', { discoverability: 'hidden' });
    assert.equal((await f.read(f.viewer)).status, 404);
  } finally { f.db.close(); }
});

test('discoverable restricted Social profiles expose an actionable shell, never private content', async () => {
  const f = fixture();
  try {
    f.repo.createPost({ userId: f.author.id, persona: 'social', caption: 'SECRET POST' });
    for (const visibility of ['private', 'followers', 'friends']) {
      f.repo.updatePersona(f.author.id, 'social', { visibility, discoverability: 'public', bio: 'SECRET BIO',
        avatar: '/media/' + 'a'.repeat(64) + '.jpg', cover: '/media/' + 'b'.repeat(64) + '.jpg' });
      const r = await f.read(f.viewer);
      assert.equal(r.status, 200);
      assert.equal(r.body.locked, true);
      assert.equal(r.body.profile.visibility, visibility);
      assert.equal(r.body.profile.user_id, f.author.id);
      assert.equal(r.body.profile.is_following, false);
      assert.equal(r.body.profile.follow_request_pending, false);
      assert.deepEqual(r.body.posts, []);
      assert.deepEqual(r.body.stories, []);
      for (const key of ['avatar', 'cover', 'bio', 'counts', 'presence', 'highlights', 'birth_date']) {
        assert.equal(key in r.body.profile, false, key);
      }
      assert.equal(JSON.stringify(r.body).includes('SECRET'), false);
      assert.equal((await f.read(f.viewer, 'work')).status, 404);
      f.repo.updatePersona(f.author.id, 'social', { discoverability: 'hidden' });
      assert.equal((await f.read(f.viewer)).status, 404);
    }
  } finally { f.db.close(); }
});

test('private shell reflects pending, cancellation and accepted follow without granting private entitlement', async () => {
  const f = fixture();
  try {
    f.repo.updatePersona(f.author.id, 'social', { visibility: 'private', discoverability: 'public' });
    const request = f.repo.requestFollow(f.viewer.id, f.author.id, 'social');
    assert.equal((await f.read(f.viewer)).body.profile.follow_request_pending, true);
    f.repo.cancelFollowRequest(f.viewer.id, f.author.id, 'social');
    assert.equal((await f.read(f.viewer)).body.profile.follow_request_pending, false);
    f.repo.requestFollow(f.viewer.id, f.author.id, 'social');
    f.repo.decideFollowRequest({ requestId: request.id, targetId: f.author.id, persona: 'social', decision: 'accept' });
    const accepted = (await f.read(f.viewer)).body;
    assert.equal(accepted.profile.is_following, true);
    assert.equal(accepted.profile.follow_request_pending, false);
    assert.equal(accepted.locked, true, 'following is not a private-access entitlement');
    assert.deepEqual(accepted.posts, []);
    f.repo.setProfileBlock(f.author.id, 'social', f.viewer.id, true);
    assert.equal((await f.read(f.viewer)).status, 404);
  } finally { f.db.close(); }
});
