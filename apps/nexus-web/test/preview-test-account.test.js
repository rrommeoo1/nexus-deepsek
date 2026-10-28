import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { verifyPassword } from '../lib/security.js';
import {
  PREVIEW_TEST_ACCOUNT, TEST_ACCOUNT_PASSWORD_ENV, ensurePreviewTestAccount, previewTestAccountPassword,
} from '../lib/preview-test-account.js';

// The documented test account is provisioned from a password that only lives in the environment, and
// a database migrated from the hosted export keeps the handle `@test` without credentials (the export
// carries no `email` and no `password_hash`). These tests pin the three ways in — create, update,
// adopt — and the fact that nothing happens by accident.

const PASSWORD = 'local-test-password-1234';
const env = (extra = {}) => ({ [TEST_ACCOUNT_PASSWORD_ENV]: PASSWORD, ...extra });

function freshRepo() {
  const db = openDb(':memory:');
  return { db, repo: createRepo(db) };
}

test('the account is not provisioned outside a preview deployment unless forced', () => {
  const { repo } = freshRepo();
  assert.equal(ensurePreviewTestAccount(repo, env(), {}), null);
  assert.equal(repo.getUserByEmail(PREVIEW_TEST_ACCOUNT.email), null);
  // A password shorter than 8 characters is treated as absent, so nothing is created either.
  assert.equal(ensurePreviewTestAccount(repo, env({ [TEST_ACCOUNT_PASSWORD_ENV]: 'short' }), { force: true }), null);
  assert.equal(previewTestAccountPassword({ [TEST_ACCOUNT_PASSWORD_ENV]: 'short' }), null);
});

test('a forced seed creates the account, verifies the address and stores a verifying hash', () => {
  const { db, repo } = freshRepo();
  const user = ensurePreviewTestAccount(repo, env(), { force: true });
  assert.ok(user);
  assert.equal(user.handle, PREVIEW_TEST_ACCOUNT.handle);
  assert.equal(user.email, PREVIEW_TEST_ACCOUNT.email);
  assert.equal(user.email_verified, 1);
  assert.equal(verifyPassword(PASSWORD, user.password_hash), true);
  assert.equal(verifyPassword(PASSWORD + 'x', user.password_hash), false);
  assert.ok(repo.getPersona(user.id, 'social'), 'the social persona exists');
  // The password itself is never stored in the clear.
  assert.equal(JSON.stringify(user).includes(PASSWORD), false);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
});

test('a second run updates the same account instead of creating a second one', () => {
  const { db, repo } = freshRepo();
  const first = ensurePreviewTestAccount(repo, env(), { force: true });
  const second = ensurePreviewTestAccount(repo, env({ [TEST_ACCOUNT_PASSWORD_ENV]: 'a-different-password-1' }), { force: true });
  assert.equal(second.id, first.id);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
  assert.equal(verifyPassword('a-different-password-1', second.password_hash), true);
  assert.equal(verifyPassword(PASSWORD, second.password_hash), false, 'the old password stops working');
});

test('a migrated handle without credentials is refused unless adoption is asked for', () => {
  const { db, repo } = freshRepo();
  // Exactly what the local import leaves behind: a handle, no email, no password hash.
  const migrated = repo.createUser({ handle: PREVIEW_TEST_ACCOUNT.handle, displayName: PREVIEW_TEST_ACCOUNT.displayName });
  assert.equal(migrated.email, null);
  assert.equal(migrated.password_hash, null);
  assert.throws(() => ensurePreviewTestAccount(repo, env(), { force: true }), /already assigned/);
  assert.equal(repo.getUserById(migrated.id).password_hash, null, 'a refused seed writes nothing');
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
});

test('adoption links the email to the existing record: same id, same content, no duplicate', () => {
  const { db, repo } = freshRepo();
  const migrated = repo.createUser({ handle: PREVIEW_TEST_ACCOUNT.handle, displayName: 'Test Nexus', mvxAddress: 'erd1' + 'q'.repeat(58) });
  const persona = repo.ensurePersona(migrated.id, 'social', { name: 'Test Nexus' });
  assert.ok(persona);

  const adopted = ensurePreviewTestAccount(repo, env(), { force: true, adoptHandle: true });
  assert.equal(adopted.id, migrated.id, 'the same record, not a new account');
  assert.equal(adopted.email, PREVIEW_TEST_ACCOUNT.email);
  assert.equal(adopted.email_verified, 1);
  assert.equal(adopted.mvx_address, migrated.mvx_address, 'the wallet identity survives adoption');
  assert.equal(verifyPassword(PASSWORD, adopted.password_hash), true);
  assert.ok(repo.getPersona(migrated.id, 'social'));
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);

  // A second run now finds the account by email and only refreshes the password.
  const again = ensurePreviewTestAccount(repo, env(), { force: true, adoptHandle: true });
  assert.equal(again.id, migrated.id);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
});

test('adoption never repoints a handle that already carries another email', () => {
  const { db, repo } = freshRepo();
  const other = repo.createUser({ handle: PREVIEW_TEST_ACCOUNT.handle, displayName: 'Someone else' });
  repo.linkProvider(other.id, { email: 'not-the-test-account@nexus.test' });
  assert.throws(
    () => ensurePreviewTestAccount(repo, env(), { force: true, adoptHandle: true }),
    /already assigned to another email/,
  );
  assert.equal(repo.getUserById(other.id).email, 'not-the-test-account@nexus.test');
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
});
