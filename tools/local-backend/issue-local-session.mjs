#!/usr/bin/env node
/**
 * Issue a session for a device that is moving from the hosted backend to this one.
 *
 * Why this exists: a session token is an HMAC signed with the *server's* secret, and the hosted server's
 * secret is not (and should not be) exported. The phone's old token therefore cannot verify here. What
 * stays the same is the account and the device: this script mints a token for that account with this
 * machine's secret, records it in `sessions` exactly as a login would, and writes the same
 * `session.json` shape the app already keeps in its own document directory. Pushing that file to the
 * phone restores the session without a new xPortal round trip; deleting it and signing in again through
 * the normal flow also works, and is what a second device would do.
 *
 *   node tools/local-backend/issue-local-session.mjs --handle wallet4e8gv6 --device-id <id> --out file.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const HOME = resolve(flag('--home', 'C:\\Nexus'));
const envFile = join(HOME, 'env', 'jungle.env');
if (!existsSync(envFile)) {
  console.error(`no configuration at ${envFile}; run init-local-backend.mjs first`);
  process.exit(2);
}
// The server's own configuration is the only source of the secret, so a token minted here is valid there.
for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const at = line.indexOf('=');
  if (at < 1) continue;
  const key = line.slice(0, at).trim();
  if (process.env[key] === undefined) process.env[key] = line.slice(at + 1).trim();
}

const handle = flag('--handle', 'wallet4e8gv6');
// A device id is 32 hex characters or it is not a device id; a mistyped flag must never be recorded as one.
const rawDeviceId = String(flag('--device-id', '') ?? '');
const deviceId = /^[a-f0-9]{32}$/.test(rawDeviceId) ? rawDeviceId : 'migration';
const outFile = resolve(flag('--out', join(HOME, 'run', 'phone-session.json')));
const persona = flag('--persona', 'social');

const { openDb } = await import('../../apps/nexus-web/lib/db.js');
const { issueSession } = await import('../../apps/nexus-web/lib/security.js');

const db = openDb();
const user = db.prepare('SELECT id, handle FROM users WHERE handle = ?').get(handle);
if (!user) {
  console.error(`no account with handle ${handle} in this database`);
  db.close();
  process.exit(3);
}

const { token, tokenHash, expiresAt } = issueSession(Number(user.id), persona);
// `sessions.expires_at` is milliseconds everywhere else in this codebase (`requireAuth` compares it with
// `Date.now()`), so it is written in milliseconds here too: a seconds value reads as long expired.
const now = Date.now();
db.prepare(`INSERT OR REPLACE INTO sessions
  (token_hash, user_id, persona, device_id, device_label, device_fingerprint, last_seen_at, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`)
  .run(tokenHash, Number(user.id), persona, deviceId || 'migration', 'Xiaomi MIX Flip (migrated to the PC)',
    now, now, expiresAt);
const written = db.prepare('SELECT user_id, persona, device_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
console.log(`session row: ${written ? `user ${written.user_id}, persona ${written.persona}, device ${written.device_id}, expires ${written.expires_at}` : 'NOT WRITTEN'}`);
db.exec('PRAGMA wal_checkpoint(PASSIVE)');
db.close();

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify({ token, deviceId: deviceId || null, cookieSession: false, savedAt: Date.now() }, null, 2)}\n`);

console.log(`session issued for #${user.id} ${user.handle} (/api/... persona ${persona})`);
console.log(`  expires ${new Date(expiresAt).toISOString()}`);
console.log(`  written to ${outFile} (the token itself is not printed)`);
