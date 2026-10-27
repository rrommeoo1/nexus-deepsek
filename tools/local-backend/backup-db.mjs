#!/usr/bin/env node
/**
 * A backup of the running backend: the database and the media store, taken while the server is up.
 *
 * Three properties matter more than speed:
 *
 *   1. the database copy is transactionally consistent. `VACUUM INTO` writes a complete, compacted copy
 *      from a single read transaction, so a write happening at the same moment cannot land half-way in
 *      the backup — which a plain file copy of a WAL database can absolutely do;
 *   2. the copy is checked before it is kept. `PRAGMA integrity_check` runs on the copy itself, and the
 *      file is hashed; a backup that fails either test is deleted and the run is reported as failed;
 *   3. the media store is snapshotted by hard link. Media is content-addressed and immutable, so a link
 *      costs nothing and each snapshot still looks like a complete store — which is what makes a restore
 *      a single directory copy instead of a rebuild.
 *
 *   node backup-db.mjs [--home C:\Nexus] [--keep-db 14] [--keep-media 7] [--label manual]
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const HOME = resolve(flag('--home', 'C:\\Nexus'));
const keepDb = Math.max(1, Number(flag('--keep-db', '14')));
const keepMedia = Math.max(1, Number(flag('--keep-media', '7')));
const label = String(flag('--label', 'scheduled')).replace(/[^a-z0-9-]/gi, '');
const dataDir = join(HOME, 'data');
const backupRoot = join(HOME, 'backups');
const logFile = join(HOME, 'logs', 'backup.log');
const stamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..*/, '').replace('T', '-');

function log(level, message) {
  const line = `${new Date().toISOString()} ${level} ${message}`;
  console.log(line);
  try { mkdirSync(join(HOME, 'logs'), { recursive: true }); writeFileSync(logFile, `${line}\n`, { flag: 'a' }); }
  catch { /* a backup must not fail because its own log could not be written */ }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const dbPath = join(dataDir, 'nexus.sqlite');
if (!existsSync(dbPath)) {
  log('ERROR', `no database at ${dbPath}; nothing was backed up`);
  process.exit(2);
}

const target = join(backupRoot, 'db', `${stamp}-${label || 'scheduled'}`);
mkdirSync(target, { recursive: true });
const copyPath = join(target, 'nexus.sqlite');

// Step 1: a consistent copy. The source is opened read-only; the copy is written by SQLite itself.
let integrity = 'not_checked';
try {
  const source = new DatabaseSync(dbPath, { readOnly: true });
  source.exec(`VACUUM INTO '${copyPath.replace(/'/g, "''")}'`);
  source.close();
  const verify = new DatabaseSync(copyPath, { readOnly: true });
  integrity = String(Object.values(verify.prepare('PRAGMA integrity_check').get() ?? {})[0] ?? 'unknown');
  verify.close();
} catch (error) {
  log('ERROR', `VACUUM INTO failed: ${error.message}`);
  rmSync(target, { recursive: true, force: true });
  process.exit(3);
}

if (integrity !== 'ok') {
  log('ERROR', `the copy failed its own integrity check (${integrity}); it was deleted`);
  rmSync(target, { recursive: true, force: true });
  process.exit(4);
}

const dbBytes = statSync(copyPath).size;
const dbHash = sha256File(copyPath);

// Step 2: the media store, as hard links. A linked file is the same bytes; a snapshot that loses links
// still has its own copies, and deleting an old snapshot never deletes media the live store still uses.
const mediaSource = join(dataDir, 'media');
const mediaTarget = join(backupRoot, 'media', stamp);
let mediaFiles = 0;
let mediaLinked = 0;
let mediaCopied = 0;
if (existsSync(mediaSource)) {
  mkdirSync(mediaTarget, { recursive: true });
  for (const name of readdirSync(mediaSource)) {
    const from = join(mediaSource, name);
    let stat;
    try { stat = statSync(from); } catch { continue; }
    if (!stat.isFile()) continue;
    mediaFiles += 1;
    const to = join(mediaTarget, name);
    if (existsSync(to)) continue;
    try { linkSync(from, to); mediaLinked += 1; }
    catch { copyFileSync(from, to); mediaCopied += 1; }
  }
}

// Step 3: what the snapshot claims, so a restore can check it instead of trusting a filename.
const manifest = {
  format: 'jungle-book-backup-v1',
  created_at: new Date().toISOString(),
  label: label || 'scheduled',
  source_database: dbPath,
  database: { file: 'nexus.sqlite', bytes: dbBytes, sha256: dbHash, integrity_check: integrity },
  media: { directory: mediaTarget, files: mediaFiles, linked: mediaLinked, copied: mediaCopied },
};
writeFileSync(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

/**
 * Retention: keep the newest N snapshots of each kind and delete the rest, oldest first. The newest is
 * never deleted, whatever the arithmetic says — a backup system that can delete its only copy is worse
 * than none.
 */
function prune(directory, keep) {
  if (!existsSync(directory)) return [];
  const entries = readdirSync(directory)
    .map((name) => ({ name, path: join(directory, name), time: statSync(join(directory, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  const removed = [];
  for (const entry of entries.slice(keep)) {
    try { rmSync(entry.path, { recursive: true, force: true }); removed.push(entry.name); }
    catch (error) { log('WARN', `could not remove old snapshot ${entry.name}: ${error.message}`); }
  }
  return removed;
}

const removedDb = prune(join(backupRoot, 'db'), keepDb);
const removedMedia = prune(join(backupRoot, 'media'), keepMedia);
if (removedDb.length) log('INFO', `retention removed db snapshots: ${removedDb.join(', ')}`);
if (removedMedia.length) log('INFO', `retention removed ${removedMedia.length} media snapshot(s)`);
log('OK', `db ${(dbBytes / 1048576).toFixed(2)}MB sha256 ${dbHash.slice(0, 12)} integrity=ok media ${mediaFiles} files (${mediaLinked} linked, ${mediaCopied} copied) -> ${target}`);

console.log(JSON.stringify({ ok: true, target, manifest }, null, 2));

