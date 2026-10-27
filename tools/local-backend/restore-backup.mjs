#!/usr/bin/env node
/**
 * Restore a backup — and prove the backup is worth restoring.
 *
 * `--drill` is the mode that matters day to day: it restores the newest snapshot into a throwaway
 * directory, checks the copy's hash and integrity, and compares its row counts with the live database.
 * Nothing live is touched by a drill, so it may run as often as anyone likes.
 *
 * `--apply` is the mode that changes the machine: it stops nothing by itself (stop the service first),
 * refuses to overwrite a database unless `--force` is given, and keeps the previous database beside the
 * new one under `nexus.sqlite.before-restore-<stamp>` instead of deleting it.
 *
 *   node restore-backup.mjs --drill
 *   node restore-backup.mjs --apply --snapshot C:\Nexus\backups\db\2026-10-27-072520-manual --force
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const HOME = resolve(flag('--home', 'C:\\Nexus'));
const drill = process.argv.includes('--drill');
const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const liveDb = join(HOME, 'data', 'nexus.sqlite');
const backupRoot = join(HOME, 'backups');
const stamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..*/, '').replace('T', '-');

if (!drill && !apply) {
  console.error('usage: node restore-backup.mjs --drill | --apply --snapshot <dir> [--force]');
  process.exit(2);
}

function newestSnapshot() {
  const directory = join(backupRoot, 'db');
  if (!existsSync(directory)) return null;
  const entries = readdirSync(directory)
    .map((name) => ({ name, path: join(directory, name), time: statSync(join(directory, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return entries[0]?.path ?? null;
}

const snapshot = resolve(flag('--snapshot', '') || newestSnapshot() || '');
if (!snapshot || !existsSync(snapshot)) {
  console.error(`no snapshot found (looked in ${join(backupRoot, 'db')})`);
  process.exit(3);
}

const manifestPath = join(snapshot, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const sourceFile = join(snapshot, 'nexus.sqlite');
if (!existsSync(sourceFile)) {
  console.error(`${snapshot} has no nexus.sqlite`);
  process.exit(4);
}

// 1. The file is the file the manifest describes, byte for byte.
const digest = createHash('sha256').update(readFileSync(sourceFile)).digest('hex');
const expected = manifest?.database?.sha256 ?? null;
if (expected && digest !== expected) {
  console.error(`snapshot is corrupt: sha256 ${digest.slice(0, 12)} but the manifest claims ${expected.slice(0, 12)}`);
  process.exit(5);
}

// 2. Restore into a directory, and check the copy where it landed.
const destination = drill
  ? join(backupRoot, 'drill', stamp)
  : join(HOME, 'data');
mkdirSync(destination, { recursive: true });
const targetDb = join(destination, 'nexus.sqlite');

if (!drill && existsSync(targetDb)) {
  if (!force) {
    console.error(`${targetDb} already exists; pass --force to keep it aside and restore over it`);
    process.exit(6);
  }
  copyFileSync(targetDb, `${targetDb}.before-restore-${stamp}`);
  console.log(`previous database kept as ${targetDb}.before-restore-${stamp}`);
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(`${targetDb}${suffix}`)) rmSync(`${targetDb}${suffix}`, { force: true });
  }
}

copyFileSync(sourceFile, targetDb);

const restored = new DatabaseSync(targetDb, { readOnly: true });
const integrity = String(Object.values(restored.prepare('PRAGMA integrity_check').get() ?? {})[0] ?? 'unknown');
const counts = {};
for (const table of ['users', 'personas', 'posts', 'comments', 'post_shares', 'media', 'stories', 'follows', 'sessions']) {
  try { counts[table] = Number(restored.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n); }
  catch { counts[table] = null; }
}
restored.close();

const report = {
  format: 'jungle-book-restore-report-v1',
  mode: drill ? 'drill' : 'apply',
  snapshot,
  restored_to: targetDb,
  sha256_matches_manifest: expected ? digest === expected : null,
  integrity_check: integrity,
  counts,
};

// 3. A drill compares itself with the live database: a restore that has silently lost half a profile is a
//    failure even when the file it came from is intact.
if (drill && existsSync(liveDb)) {
  const live = new DatabaseSync(liveDb, { readOnly: true });
  const liveCounts = {};
  for (const table of Object.keys(counts)) {
    try { liveCounts[table] = Number(live.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n); }
    catch { liveCounts[table] = null; }
  }
  live.close();
  report.live_counts = liveCounts;
  const drift = Object.keys(counts).filter((table) => counts[table] != null && liveCounts[table] != null && counts[table] !== liveCounts[table]);
  report.drift = drift.map((table) => ({ table, snapshot: counts[table], live: liveCounts[table] }));
  // `sessions` legitimately moves between a snapshot and now (a phone signing in), so it is reported but
  // does not fail the drill; every content table does.
  const contentDrift = drift.filter((table) => table !== 'sessions');
  report.ok = integrity === 'ok' && contentDrift.length === 0;
  report.note = contentDrift.length ? `content drifted since the snapshot: ${contentDrift.join(', ')}` : 'snapshot matches the live content';
} else {
  report.ok = integrity === 'ok';
}

writeFileSync(join(backupRoot, drill ? 'drill' : '.', `restore-${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 7);
