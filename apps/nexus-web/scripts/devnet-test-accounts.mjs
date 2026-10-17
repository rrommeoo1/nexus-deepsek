#!/usr/bin/env node
/**
 * Five real Nexus test accounts, each with its own MultiversX **devnet** wallet.
 *
 * Why devnet: the product is a native app and the social surfaces need more than one real account behind
 * them — a story somebody else published, a message from a stranger, a private account with a pending
 * request, a comment written by a different person. The existing Railway fixtures are unverifiable by
 * design (`@nexus.test` addresses, see `docs/TEST-DATA.md` §11), so this script makes accounts the same way
 * a person does: a wallet generated locally, `/auth/email/signup-init`, a signed challenge, then
 * `/auth/email/signup`. Nothing is bypassed, no rate limit is worked around, and the server never sees a
 * mnemonic or a private key — only the public address and one signature.
 *
 * DEVNET ONLY. No mainnet address, no real funds, no real value. The five wallets start empty on purpose:
 * social actions cost nothing, and the funding step (the official faucet) is written down in `HANDOFF.md`
 * rather than automated, because the faucet is a browser form with a captcha.
 *
 * Secrets never leave this machine and never reach git:
 *   * mnemonics and secret keys  → `docs/.test-wallets.local` (gitignored, chmod 600 where the OS allows)
 *   * passwords, cookies, ids    → `docs/.test-sessions.local` (gitignored, the file the fixture script uses)
 * Only public addresses and handles are printable, and only those go to `docs/TEST-DATA.md`.
 *
 * Usage (from the repository root):
 *   node apps/nexus-web/scripts/devnet-test-accounts.mjs
 *   node apps/nexus-web/scripts/devnet-test-accounts.mjs --dry-run     # wallets only, no HTTP
 *   NEXUS_BASE=https://… node apps/nexus-web/scripts/devnet-test-accounts.mjs
 *
 * The signup route is limited to 5 successful registrations per hour per IP (`api.js:934`). One run is
 * exactly 5 accounts; a second run inside the same hour is refused by the server, and the script stops and
 * says so instead of retrying.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Mnemonic, UserSecretKey } from '@multiversx/sdk-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const WALLETS_FILE = resolve(ROOT, 'docs', '.test-wallets.local');
const SESSIONS_FILE = resolve(ROOT, 'docs', '.test-sessions.local');
const BASE = String(process.env.NEXUS_BASE ?? 'https://nexus-deepsek-production.up.railway.app').replace(/\/+$/, '');
const DEVNET_API = 'https://devnet-api.multiversx.com';
const COUNT = Math.max(1, Math.min(5, Number(process.env.NEXUS_TEST_ACCOUNTS ?? 5)));
const DRY_RUN = process.argv.includes('--dry-run');

const readJson = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
};

const writePrivate = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* Windows ignores POSIX modes; the file is local either way. */ }
};

const idem = (prefix) => `${prefix}-${randomBytes(8).toString('hex')}`;

async function call(path, { method = 'GET', cookie, body, key } = {}) {
  // The server refuses an authenticated mutation without an origin (`api.js`, "origin obligatoriu pentru
  // mutații autentificate"), the same rule the app satisfies by talking to its own origin.
  const headers = { accept: 'application/json', origin: BASE };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (key) headers['idempotency-key'] = key;
  const response = await fetch(`${BASE}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* a non-JSON error body is reported as text */ }
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return { status: response.status, data, text, cookies };
}

/** The cookie the app would keep: the server's own `nexus_session`, not the whole Set-Cookie line. */
function sessionCookie(cookies) {
  for (const line of cookies) {
    const match = /(?:^|,\s*)(nexus_session=[^;,\s]+)/.exec(line);
    if (match) return match[1];
  }
  return '';
}

/** The five devnet wallets, generated once and then reused, so a rerun never orphans an address. */
function loadWallets() {
  const store = readJson(WALLETS_FILE, {
    note: 'Local-only. Devnet test wallets for the Nexus test accounts. Never commit, never paste a mnemonic or a secret key into docs, logs, reports or chat. Public addresses may be quoted.',
    network: 'devnet',
    created_at: new Date().toISOString(),
    wallets: [],
  });
  let created = 0;
  while (store.wallets.length < COUNT) {
    const index = store.wallets.length + 1;
    const mnemonic = Mnemonic.generate();
    const secretKey = mnemonic.deriveKey(0);
    store.wallets.push({
      index,
      handle: `devnet_test_${String(index).padStart(2, '0')}`,
      email: `nexus.devnet${String(index).padStart(2, '0')}@nexus-devnet.test`,
      display_name: `Test devnet ${String(index).padStart(2, '0')}`,
      network: 'devnet',
      address: secretKey.generatePublicKey().toAddress().toBech32(),
      mnemonic: mnemonic.toString(),
      secret_key_hex: secretKey.hex().toString(),
      created_at: new Date().toISOString(),
    });
    created += 1;
  }
  if (created) writePrivate(WALLETS_FILE, store);
  return { store, created };
}

/** Balance from the public devnet API: read-only, no key, no wallet software. */
async function balanceOf(address) {
  try {
    const response = await fetch(`${DEVNET_API}/accounts/${address}`, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const data = await response.json();
    const wei = BigInt(String(data?.balance ?? '0'));
    const whole = wei / 10n ** 18n;
    const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fraction}`;
  } catch {
    return null;
  }
}

function saveSession(account) {
  const store = readJson(SESSIONS_FILE, { note: 'Local-only. Session cookies, test passwords and wallet secret keys for the Railway preview test accounts. Never commit, never paste into docs or reports.', base: BASE, written_at: new Date().toISOString(), accounts: [] });
  const accounts = Array.isArray(store.accounts) ? store.accounts : [];
  const at = accounts.findIndex((entry) => entry.email === account.email);
  if (at >= 0) accounts[at] = { ...accounts[at], ...account };
  else accounts.push(account);
  writePrivate(SESSIONS_FILE, { ...store, base: BASE, written_at: new Date().toISOString(), accounts });
}

async function register(wallet) {
  const password = randomBytes(12).toString('base64url');
  const init = await call('/auth/email/signup-init', { method: 'POST', body: { email: wallet.email }, key: idem('devnet-signup-init') });
  if (init.status !== 200 || !init.data?.message) {
    return { ok: false, step: 'signup-init', status: init.status, message: init.data?.error ?? init.text.slice(0, 160) };
  }
  // The message is the server's own sentence (`api.js:316`), so the signature proves this address read it.
  const secretKey = UserSecretKey.fromString(wallet.secret_key_hex);
  const signature = Buffer.from(secretKey.sign(Buffer.from(init.data.message, 'utf8'))).toString('hex');
  const signup = await call('/auth/email/signup', {
    method: 'POST',
    key: idem('devnet-signup'),
    body: {
      email: wallet.email,
      password,
      handle: wallet.handle,
      display_name: wallet.display_name,
      wallet_proof: { nonce: init.data.nonce, address: wallet.address, signature },
    },
  });
  if (signup.status === 429) {
    return { ok: false, step: 'signup', status: 429, message: 'rate limit: 5 registrations per hour per IP — rerun after the window' };
  }
  if (signup.status !== 201) {
    return { ok: false, step: 'signup', status: signup.status, message: signup.data?.code ?? signup.data?.error ?? signup.text.slice(0, 160) };
  }
  const cookie = sessionCookie(signup.cookies);
  const userId = signup.data?.user?.id ?? null;
  // The bio is the marker every later check uses to tell a test account from a real one.
  const bio = await applyBio(cookie);
  return {
    ok: true,
    cookie,
    userId,
    handle: signup.data?.user?.handle ?? wallet.handle,
    password,
    bioStatus: bio,
    emailStatus: signup.data?.email_status ?? null,
  };
}

async function applyBio(cookie) {
  const bio = await call('/api/persona/social', {
    method: 'PATCH',
    cookie,
    key: idem('devnet-bio'),
    body: { bio: '[test]' },
  });
  return bio.status;
}

/**
 * A rerun must not try to register an address twice: the signup route answers 409 for a known email, and
 * every extra attempt spends the hourly allowance. An account whose session already exists is finished by
 * re-applying the marker instead, which is also the repair path when the marker was refused the first time.
 */
function existingSession(email) {
  const store = readJson(SESSIONS_FILE, { accounts: [] });
  const accounts = Array.isArray(store.accounts) ? store.accounts : [];
  const entry = accounts.find((account) => account.email === email && account.cookie);
  return entry ?? null;
}

async function main() {
  const { store, created } = loadWallets();
  console.log(`devnet wallets: ${store.wallets.length} in docs/.test-wallets.local (${created} new this run), base ${BASE}`);
  console.log('nothing private is printed here: addresses and handles only\n');
  if (DRY_RUN) {
    for (const wallet of store.wallets) console.log(`  ${wallet.handle}  ${wallet.address}`);
    return;
  }
  const rows = [];
  for (const wallet of store.wallets) {
    const existing = existingSession(wallet.email);
    if (existing) {
      const bioStatus = await applyBio(existing.cookie);
      const balance = await balanceOf(wallet.address);
      saveSession({ ...existing, bio_status: bioStatus, balance_egld: balance });
      console.log(`${wallet.handle}  already registered  userId=${existing.userId}  bio=${bioStatus}  balance=${balance ?? 'unknown'} EGLD  ${wallet.address}`);
      rows.push({ handle: existing.handle ?? wallet.handle, address: wallet.address, ok: bioStatus < 400, userId: existing.userId, balance, step: 'bio', status: bioStatus });
      continue;
    }
    const result = await register(wallet);
    if (!result.ok) {
      console.log(`${wallet.handle}  FAILED at ${result.step} (${result.status}): ${result.message}`);
      rows.push({ handle: wallet.handle, address: wallet.address, ok: false, step: result.step, status: result.status });
      if (result.status === 429) break;
      continue;
    }
    const balance = await balanceOf(wallet.address);
    saveSession({
      index: wallet.index,
      email: wallet.email,
      password: result.password,
      display: wallet.display_name,
      handle: result.handle,
      userId: result.userId,
      walletAddress: wallet.address,
      walletSecretKeyHex: wallet.secret_key_hex,
      cookie: result.cookie,
      plan: 'devnet-test',
      mediaItem: null,
      bio_status: result.bioStatus,
      email_status: result.emailStatus,
      balance_egld: balance,
    });
    console.log(`${wallet.handle}  registered  userId=${result.userId}  bio=${result.bioStatus}  balance=${balance ?? 'unknown'} EGLD  ${wallet.address}`);
    rows.push({ handle: result.handle, address: wallet.address, ok: true, userId: result.userId, balance });
  }
  const failed = rows.filter((row) => !row.ok);
  console.log(`\ndone: ${rows.length - failed.length}/${rows.length} registered`);
  if (rows.some((row) => row.ok && (row.balance === '0.0000' || row.balance === null))) {
    console.log('funding: the wallets start empty. The devnet faucet is a browser form with a captcha, so it stays manual:');
    console.log('  https://devnet-wallet.multiversx.com/faucet  (paste one address, request EGLD, repeat per wallet)');
    console.log('  social actions cost nothing; the faucet is only needed for on-chain experiments (ESDT, deposits).');
  }
  if (failed.length) {
    console.log('\nnot registered:');
    for (const row of failed) console.log(`  ${row.handle}  ${row.step} ${row.status}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('devnet test accounts failed:', error?.message ?? error);
  process.exitCode = 1;
});
