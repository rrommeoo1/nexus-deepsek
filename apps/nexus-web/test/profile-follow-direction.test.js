import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { handleRequest } from '../lib/api.js';
import { issueSession } from '../lib/security.js';

/**
 * `GET /api/profiles/:handle` publishes both directions of the follow between the reader and the record.
 *
 * `is_following` is the viewer's side and has always been there; `following_me` is the other one, and without
 * it a record opened from a comment, a story or a search could not tell a follower from a stranger — the only
 * button the app could paint was `Urmărește`, which is wrong for half the readers (HANDOFF defect 9).
 *
 * The two directions are asserted separately and as a pair, because a payload that carries one field twice is
 * exactly the bug this test exists to prevent.
 */
function fixture() {
  const db = openDb(':memory:'), repo = createRepo(db);
  const users = ['dir_author', 'dir_viewer', 'dir_third'].map((handle) => {
    const user = repo.createUser({ handle, displayName: handle, trafficClass: 'SYSTEM_TEST' });
    repo.ensurePersona(user.id, 'social', { visibility: 'public' });
    return user;
  });
  const context = { db, repo, sse: { broadcast() {}, publish() {} } };
  async function read(handle, user, persona = 'social') {
    const session = issueSession(user.id, persona);
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona, expiresAt: session.expiresAt });
    const req = { method: 'GET', url: `/api/profiles/${handle}?persona=${persona}`,
      headers: { cookie: `nexus_session=${session.token}` }, socket: { remoteAddress: '127.0.0.182' } };
    const res = { status: 200, setHeader() {}, writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } };
    await handleRequest(req, res, context);
    return res;
  }
  return { db, repo, author: users[0], viewer: users[1], third: users[2], read };
}

test('a stranger reads a public profile with both directions false', async () => {
  const f = fixture();
  try {
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.ok, true);
    assert.equal(body.profile.is_following, false);
    assert.equal(body.profile.following_me, false);
  } finally { f.db.close(); }
});

test('I follow the author: is_following is true and following_me stays false', async () => {
  const f = fixture();
  try {
    f.repo.setFollow(f.viewer.id, f.author.id, 'social', true);
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.profile.is_following, true);
    assert.equal(body.profile.following_me, false, 'their side of the pair is unchanged by my follow');
  } finally { f.db.close(); }
});

test('the author follows me: following_me is true while is_following stays false', async () => {
  const f = fixture();
  try {
    f.repo.setFollow(f.author.id, f.viewer.id, 'social', true);
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.profile.is_following, false);
    assert.equal(body.profile.following_me, true);
  } finally { f.db.close(); }
});

test('a mutual follow reports both directions', async () => {
  const f = fixture();
  try {
    f.repo.setFollow(f.viewer.id, f.author.id, 'social', true);
    f.repo.setFollow(f.author.id, f.viewer.id, 'social', true);
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.profile.is_following, true);
    assert.equal(body.profile.following_me, true);
  } finally { f.db.close(); }
});

test('a third account does not leak into the pair', async () => {
  const f = fixture();
  try {
    f.repo.setFollow(f.author.id, f.third.id, 'social', true);
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.profile.following_me, false, 'the author follows somebody else, not the reader');
  } finally { f.db.close(); }
});

test('my own record never says that I follow myself', async () => {
  const f = fixture();
  try {
    // The repo refuses a self-follow (`SOCIAL_FOLLOW_TARGET_INVALID`, `repo.js:1789`), so the read is the
    // only thing to assert: the field is false on my own payload even when a row could exist.
    const body = (await f.read('dir_author', f.author)).body;
    assert.equal(body.profile.is_self, true);
    assert.equal(body.profile.following_me, false);
  } finally { f.db.close(); }
});

test('the locked shell of a restricted record carries the same pair', async () => {
  const f = fixture();
  try {
    f.repo.updatePersona(f.author.id, 'social', { visibility: 'private', discoverability: 'public', privateAccess: { enabled: true, priceCents: 100, currency: 'USD', durationDays: 1 } });
    f.repo.setFollow(f.author.id, f.viewer.id, 'social', true);
    const body = (await f.read('dir_author', f.viewer)).body;
    assert.equal(body.locked, true);
    assert.equal(body.profile.following_me, true, 'a locked record still tells a follower that it is followed');
    assert.equal(body.profile.is_following, false);
    assert.equal(JSON.stringify(body.profile).includes('dir_author bio'), false);
  } finally { f.db.close(); }
});
