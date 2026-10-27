#!/usr/bin/env node
/**
 * Prepare the machine for the local backend, once.
 *
 * It creates C:\Nexus (data, env, logs, backups, run, bin), writes C:\Nexus\env\jungle.env from the
 * template with a freshly generated session secret and this machine's LAN origin, and restricts that
 * file to the current user. It never overwrites an existing env file, so running it again cannot
 * silently rotate the secret and sign every phone out.
 *
 *   node tools/local-backend/init-local-backend.mjs [--home C:\Nexus]
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argHome = (() => {
  const index = process.argv.indexOf('--home');
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : null;
})();
const HOME = resolve(argHome ?? 'C:\\Nexus');
const TEMPLATE = join(HERE, 'env.example');
const ENV_FILE = join(HOME, 'env', 'jungle.env');

function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (/^169\.254\./.test(entry.address)) continue;
      found.push({ name, address: entry.address });
    }
  }
  return found;
}

for (const dir of ['data', 'env', 'logs', 'backups', 'run', 'bin']) {
  mkdirSync(join(HOME, dir), { recursive: true });
}
console.log(`home ${HOME}`);

const lan = lanAddresses();
for (const entry of lan) console.log(`lan ${entry.name} ${entry.address}`);

if (existsSync(ENV_FILE)) {
  const keys = readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+\s*=/.test(line.trim()))
    .map((line) => line.split('=')[0].trim());
  console.log(`env file already exists (${keys.length} keys: ${keys.join(', ')}); left untouched`);
} else {
  const template = readFileSync(TEMPLATE, 'utf8');
  const port = (template.match(/^PORT=(\d+)/m)?.[1]) ?? '5000';
  const origins = ['http://localhost:5000', `http://127.0.0.1:${port}`, ...lan.map((entry) => `http://${entry.address}:${port}`)];
  const secret = randomBytes(32).toString('hex');
  const body = template
    .replace(/^NEXUS_SESSION_SECRET=.*$/m, `NEXUS_SESSION_SECRET=${secret}`)
    .replace(/^NEXUS_ACCEPTED_ORIGINS=.*$/m, `NEXUS_ACCEPTED_ORIGINS=${origins.join(',')}`);
  writeFileSync(ENV_FILE, body, { encoding: 'utf8' });
  console.log(`wrote ${ENV_FILE} (secret generated: yes, ${secret.length} chars; not printed)`);
}

// Only the account that runs the service can read the configuration or the database files.
const account = process.env.USERNAME ? `${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME}`.replace(/^\\/, '') : null;
if (account) {
  // A file needs `F` on itself; `(OI)(CI)F` only describes its children, which would leave the file
  // itself unreadable — the mistake this comment exists to prevent.
  for (const [path, grant] of [[ENV_FILE, 'F'], [join(HOME, 'data'), '(OI)(CI)F']]) {
    try {
      execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${account}:${grant}`], { stdio: 'ignore' });
      console.log(`acl restricted ${path} -> ${account}`);
    } catch (error) {
      console.warn(`acl not applied to ${path}: ${error.message}`);
    }
  }
}

console.log('\nnext:');
console.log('  powershell -ExecutionPolicy Bypass -File tools/local-backend/install-autostart.ps1');
console.log('  powershell -ExecutionPolicy Bypass -File tools/local-backend/start-backend.ps1');
