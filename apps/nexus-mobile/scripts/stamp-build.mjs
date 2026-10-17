#!/usr/bin/env node
/**
 * Writes the build marker `src/lib/buildStamp.ts` from this repository.
 *
 * The drawer prints the marker so the reader can tell which JavaScript the phone is running: a short
 * commit hash and the moment the stamp was taken. `+` after the hash means the tree was dirty when the
 * stamp was written — a signal, not a defect.
 *
 * This script only rewrites two constants in one file; it never touches anything else. It is deliberately
 * NOT part of `npm test`: a test must not depend on the clock, and a stale stamp is a fact worth seeing.
 *
 * Usage: node scripts/stamp-build.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'src/lib/buildStamp.ts');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

const commit = git(['rev-parse', '--short', 'HEAD']);
const dirty = git(['status', '--porcelain']).length > 0;
const marker = `${commit}${dirty ? '+' : ''}`;
const time = new Date().toISOString();

const source = readFileSync(TARGET, 'utf8');
const written = source
  .replace(/export const BUILD_COMMIT = '[^']*';/, `export const BUILD_COMMIT = '${marker}';`)
  .replace(/export const BUILD_TIME = '[^']*';/, `export const BUILD_TIME = '${time}';`);

if (written === source) {
  console.log(`unchanged · ${marker} · ${time}`);
} else {
  writeFileSync(TARGET, written, 'utf8');
  console.log(`stamped · ${marker} · ${time}`);
}
