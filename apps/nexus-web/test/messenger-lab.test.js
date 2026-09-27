import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { verifyPassword } from '../lib/security.js';
import { seedMessengerLab } from '../scripts/messenger-lab-seed.mjs';
import { labRuntimeSeconds } from '../scripts/messenger-lab-runtime.mjs';
import { searchEmojis } from '../public/composer-emoji.js';
import { messageDayLabel } from '../public/message-presentation.js';
import { handleRequest } from '../lib/api.js';

test('human lab sessions are explicit and bounded, retaining the short default', () => {
  assert.equal(labRuntimeSeconds(['--serve']), 600);
  assert.equal(labRuntimeSeconds(['--serve', '--runtime-seconds=7200']), 7200);
  for (const value of ['0', '59', '7201', 'Infinity', '-1', '12.5', '1e3', '']) {
    assert.throws(() => labRuntimeSeconds(['--runtime-seconds=' + value]), /LAB_RUNTIME_INVALID/);
  }
  assert.throws(() => labRuntimeSeconds(['--runtime-seconds=60', '--runtime-seconds=600']), /LAB_RUNTIME_INVALID/);
  assert.throws(() => labRuntimeSeconds(['--runtime-seconds', '600']), /LAB_RUNTIME_INVALID/);
});

test('lab fixtures persist real conversations, remain synthetic and replay without duplicates', () => {
  const db = openDb(':memory:'), repo = createRepo(db);
  try {
    const options = { password: 'local-test-password-1234' };
    seedMessengerLab(repo, options);
    const first = db.prepare('SELECT count(*) n FROM message_items').get().n;
    seedMessengerLab(repo, options);
    assert.equal(db.prepare('SELECT count(*) n FROM message_items').get().n, first);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 3);
    assert.equal(db.prepare("SELECT count(*) n FROM users WHERE traffic_class = 'SYSTEM_TEST'").get().n, 3);
    const tester = repo.getUserByEmail('lab_tester@nexus.test');
    assert.equal(verifyPassword(options.password, tester.password_hash), true);
    const social = repo.listUnifiedConversations(tester.id, { persona: 'social' });
    assert.equal(social.length, 3);
    assert.equal(repo.listUnifiedConversations(tester.id, { persona: 'work' }).length, 1);
    const mira = repo.getUserByHandle('lab_mira');
    const direct = social.find((c) => c.kind === 'direct' && c.participants.some((p) => p.id === mira.id));
    const sent = repo.sendConversationMessage({ conversationId: direct.id, senderId: tester.id, senderPersona: 'social', body: 'Actual test send', clientNonce: 'lab-live-send-001' });
    assert.ok(repo.listConversationMessages(direct.id, mira.id).some((m) => m.id === sent.id));
    assert.equal(repo.sendConversationMessage({ conversationId: direct.id, senderId: tester.id, senderPersona: 'work', body: 'Wrong persona', clientNonce: 'lab-wrong-001' }), null);
    assert.equal(repo.listConversationMessages(direct.id, repo.getUserByHandle('lab_alex').id), null);
  } finally { db.close(); }
});
test('fixture seed refuses any database containing a real user before writing', () => {
  const db = openDb(':memory:'), repo = createRepo(db);
  try { repo.createUser({ handle: 'owner', displayName: 'Owner' }); assert.throws(() => seedMessengerLab(repo, { password: 'local-test-password-1234' }), /LAB_REFUSES_REAL_USERS/); assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1); } finally { db.close(); }
});
test('lab accounts use the real email login API, not an authentication bypass', async () => {
  const db = openDb(':memory:'), repo = createRepo(db);
  try {
    const password = 'local-test-password-1234'; seedMessengerLab(repo, { password });
    const raw = Buffer.from(JSON.stringify({ email: 'lab_tester@nexus.test', password }));
    const request = { method: 'POST', url: '/auth/email/login', headers: { 'content-type': 'application/json', 'idempotency-key': 'lab-auth-test-0001' }, socket: { remoteAddress: '127.0.0.95' },
      on(event, fn) { if (event === 'data') process.nextTick(() => fn(raw)); if (event === 'end') process.nextTick(fn); return this; }, once() { return this; }, destroy() {} };
    const res = { statusCode: 200, headers: {}, writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = String(body); } };
    await handleRequest(request, res, { repo, db, sse: {}, fetcher: () => { throw new Error('External calls forbidden'); } });
    assert.equal(res.statusCode, 200); assert.equal(JSON.parse(res.body).user.handle, 'lab_tester');
    assert.ok(Object.values(res.headers).flat().some((value) => String(value).startsWith('nexus_session=')));
  } finally { db.close(); }
});
test('emoji categories/search and calendar-day labels are bounded and useful', () => {
  assert.ok(searchEmojis().length > 150); assert.ok(searchEmojis('inima').includes('❤️')); assert.ok(searchEmojis('happy').includes('😀')); assert.deepEqual(searchEmojis('unknown'), []);
  assert.ok(searchEmojis('', 1).includes('👍')); assert.ok(!searchEmojis('', 1).includes('🍕'));
  const now = new Date(2026, 8, 14, 0, 30).getTime(), yesterday = new Date(2026, 8, 13, 23, 50).getTime() / 1000;
  assert.equal(messageDayLabel(now / 1000, null, 'en', now), 'today');
  assert.equal(messageDayLabel(yesterday, null, 'en', now), 'yesterday');
  assert.equal(messageDayLabel(now / 1000, now / 1000 - 10, 'en', now), '');
});
