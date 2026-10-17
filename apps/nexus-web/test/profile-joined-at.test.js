import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { handleRequest } from '../lib/api.js';
import { issueSession } from '../lib/security.js';

/**
 * `joined_at` — the account's creation date, additive on the profile payload.
 *
 * The phone's profile band prints "Membru din <lună an>" and had no field to read: `users.created_at` was
 * stored but never sent. This test pins the additive field on an old database (the same in-memory fixture
 * the other profile reads use, with rows written before the field existed): every reader gets the number,
 * it is the row's own `created_at`, and a record that is not readable does not leak it.
 */
function fixture() {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: 'joined_owner', displayName: 'Joined Owner', trafficClass: 'SYSTEM_TEST' });
  const viewer = repo.createUser({ handle: 'joined_viewer', displayName: 'Joined Viewer', trafficClass: 'SYSTEM_TEST' });
  repo.ensurePersona(owner.id, 'social', { visibility: 'public' });
  repo.ensurePersona(viewer.id, 'social', { visibility: 'public' });
  // A row written before the field existed: the date is the record's own, and nothing else moves.
  const createdAt = 1735689600; // 2025-01-01T00:00:00Z
  db.prepare('UPDATE users SET created_at = ? WHERE id = ?').run(createdAt, owner.id);
  const context = { db, repo, sse: { broadcast() {}, publish() {} } };
  async function read(handle, user = viewer, persona = 'social') {
    const session = issueSession(user.id, persona);
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona, expiresAt: session.expiresAt });
    const req = { method: 'GET', url: `/api/profiles/${handle}?persona=social`,
      headers: { cookie: `nexus_session=${session.token}` }, socket: { remoteAddress: '127.0.0.182' } };
    const res = { status: 200, setHeader() {}, writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } };
    await handleRequest(req, res, context);
    return res;
  }
  return { db, repo, owner, viewer, createdAt, read };
}

test('profilul altcuiva și al propriu poartă joined_at, în secunde unix, egal cu created_at', async () => {
  const f = fixture();
  try {
    const foreign = await f.read('joined_owner', f.viewer);
    assert.equal(foreign.status, 200);
    assert.equal(foreign.body.profile.joined_at, f.createdAt);

    const own = await f.read('joined_owner', f.owner);
    assert.equal(own.status, 200);
    assert.equal(own.body.profile.joined_at, f.createdAt);
    // Data nașterii rămâne numai la proprietar; joined_at nu este o excepție de confidențialitate.
    assert.equal(foreign.body.profile.birth_date, null);
  } finally { f.db.close(); }
});

test('un profil care nu poate fi citit nu întoarce joined_at', async () => {
  const f = fixture();
  try {
    const missing = await f.read('nobody_here', f.viewer);
    assert.equal(missing.status, 404);
    assert.equal(JSON.stringify(missing.body).includes('joined_at'), false);
  } finally { f.db.close(); }
});
