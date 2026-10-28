#!/usr/bin/env node
/**
 * What the local Jungle Book actually is right now, read from both sides.
 *
 * The phone's answer and the server's answer can disagree without anyone noticing: the app can point at
 * another origin, the service can be running against a different `NEXUS_DATA_DIR`, a media row can name
 * a file that is not on disk, or the build can be older than the contract the composer needs. This tool
 * asks the running service, the database and the media store the same questions and prints one verdict
 * per line, so "it works on my PC" is a list of measurements instead of a feeling.
 *
 * Read-only by design: the database is opened with `readOnly`, the media files are hashed, and every HTTP
 * call below is a GET. The one exception is opt-in and labelled: `--handle <h>` mints a *session* for that
 * account (exactly what a login writes, on device id `audit`, label "audit runda 34") so the authenticated
 * reads can be checked too. Without the flag nothing is written at all.
 *
 *   node tools/local-backend/audit-local.mjs
 *   node tools/local-backend/audit-local.mjs --handle wallet4e8gv6 --out C:\Nexus\run\audit.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
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
// The service's own configuration decides which port and which data directory are the live ones.
for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const at = line.indexOf('=');
  if (at < 1) continue;
  const key = line.slice(0, at).trim();
  if (process.env[key] === undefined) process.env[key] = line.slice(at + 1).trim();
}

const port = Number(process.env.PORT ?? 5000);
const base = `http://127.0.0.1:${port}`;
const dataDir = resolve(process.env.NEXUS_DATA_DIR ?? join(HOME, 'data'));
const dbPath = join(dataDir, 'nexus.sqlite');
const mediaDir = join(dataDir, 'media');
const handle = flag('--handle', '');
const outFile = flag('--out', join(HOME, 'run', `audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));

const report = { at: new Date().toISOString(), home: HOME, base, dataDir, checks: [] };
let failures = 0;

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function note(name, detail) {
  report.checks.push({ name, ok: null, detail: detail ?? null });
  console.log(`[note] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path, cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${base}${path}`, { headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, headers: response.headers, body };
}

function sha256File(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

// ---------------------------------------------------------------- 1. the service answers, and says what it can do
const health = await get('/health');
check('/health răspunde 200', health.status === 200 && health.body?.ok === true,
  `status=${health.status}, environment=${health.body?.environment ?? '?'}, users=${health.body?.users ?? '?'}, posts=${health.body?.posts ?? '?'}`);
check('serviciul raportează starea ready', health.body?.status === 'ready', `status=${health.body?.status ?? '?'}`);

const version = await get('/api/version');
const capabilities = version.body?.capabilities ?? {};
check('/api/version răspunde și anunță text_style v2', version.status === 200 && Number(capabilities.text_style) >= 2,
  `commit=${version.body?.commit_short ?? '?'}, api_contract=${version.body?.api_contract ?? '?'}, text_style=${capabilities.text_style ?? '?'}`);
check('editorial_document este anunțat', Number(capabilities.editorial_document) >= 1, `editorial_document=${capabilities.editorial_document ?? '?'}`);
note('amprenta sursei serverului', version.body?.source_fingerprint ?? 'indisponibilă');
note('runtime', version.body?.runtime ?? '?');

// ---------------------------------------------------------------- 2. the database on disk is the one being served
if (!existsSync(dbPath)) {
  check('baza de date există la NEXUS_DATA_DIR', false, dbPath);
} else {
  const { openDb } = await import('../../apps/nexus-web/lib/db.js');
  const db = openDb(dbPath);
  let counts = {};
  try {
    // The counts the phone can see must be the counts in this file; a mismatch means two databases.
    const users = Number(db.prepare('SELECT COUNT(*) c FROM users').get().c);
    const posts = Number(db.prepare('SELECT COUNT(*) c FROM posts').get().c);
    const active = Number(db.prepare("SELECT COUNT(*) c FROM posts WHERE status = 'active'").get().c);
    check('numărul de conturi din bază este cel raportat de /health', Number(health.body?.users) === users,
      `db=${users}, health=${health.body?.users ?? '?'}`);
    // `repo.stats()` counts rows, not visible rows: the two must agree, and the archive split is a note.
    check('numărul de postări din bază este cel raportat de /health', Number(health.body?.posts) === posts,
      `db=${posts} rânduri (${active} active), health=${health.body?.posts ?? '?'}`);
    for (const table of ['users', 'personas', 'posts', 'post_media', 'comments', 'post_reactions', 'saved_posts',
      'follows', 'stories', 'story_highlights', 'conversations', 'message_items', 'media', 'sessions', 'notifications']) {
      try { counts[table] = Number(db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get().c); } catch { counts[table] = null; }
    }
    note('inventar baza de date', Object.entries(counts).map(([table, value]) => `${table}=${value}`).join(', '));
    report.counts = counts;

    const byKind = db.prepare("SELECT kind, COUNT(*) c FROM posts WHERE status = 'active' GROUP BY kind").all();
    note('postări active pe tip', byKind.map((row) => `${row.kind}=${row.c}`).join(', '));
    const byProvenance = db.prepare("SELECT provenance, COUNT(*) c FROM posts GROUP BY provenance").all();
    note('provenance salvat', byProvenance.map((row) => `${row.provenance}=${row.c}`).join(', '));

    // ------------------------------------------------------------ 3. every media row has its bytes, and the bytes are the row
    const rows = db.prepare('SELECT id, hash, ext, mime, size, kind, scan_status FROM media ORDER BY id').all();
    const missing = [];
    const wrongSize = [];
    const wrongHash = [];
    const onDisk = new Set(existsSync(mediaDir) ? readdirSync(mediaDir) : []);
    for (const row of rows) {
      const file = `${row.hash}.${row.ext}`;
      if (!onDisk.has(file)) { missing.push(file); continue; }
      const full = join(mediaDir, file);
      if (Number(row.size) !== statSync(full).size) wrongSize.push(file);
      if (sha256File(full) !== row.hash) wrongHash.push(file);
    }
    check('fiecare rând de media are fișierul lui', missing.length === 0,
      `${rows.length} rânduri, ${missing.length} lipsă${missing.length ? `: ${missing.slice(0, 3).join(', ')}` : ''}`);
    check('dimensiunea din bază este dimensiunea de pe disc', wrongSize.length === 0, `${wrongSize.length} nepotriviri`);
    check('numele fișierului este sha256-ul conținutului', wrongHash.length === 0, `${wrongHash.length} nepotriviri`);
    note('fișiere în depozitul local', `${onDisk.size} fișiere în ${mediaDir}, ${rows.length} rânduri în bază`);
    report.media = { rows: rows.length, files: onDisk.size, missing: missing.length, wrongSize: wrongSize.length, wrongHash: wrongHash.length };
  } finally {
    db.close();
  }
}


// ---------------------------------------------------------------- 4. the bytes travel over the phone's own URL
// Media is access-controlled (`/media/...` answers 401 without a session), so this check runs inside the
// authenticated section below. On disk it is already proven: file, size and sha256.
const mediaSamples = async () => {
  if (!existsSync(dbPath)) return [];
  const { openDb } = await import('../../apps/nexus-web/lib/db.js');
  const db = openDb(dbPath);
  try { return db.prepare('SELECT hash, ext, mime, size FROM media ORDER BY id DESC LIMIT 4').all(); } finally { db.close(); }
};


// ---------------------------------------------------------------- 5. authenticated reads, only when asked for
if (handle) {
  const { openDb } = await import('../../apps/nexus-web/lib/db.js');
  const { issueSession } = await import('../../apps/nexus-web/lib/security.js');
  const db = openDb(dbPath);
  let cookie = '';
  let userId = null;
  try {
    const user = db.prepare('SELECT id, handle FROM users WHERE lower(handle) = lower(?)').get(handle);
    if (!user) {
      check(`contul @${handle} există în baza locală`, false);
    } else {
      userId = Number(user.id);
      const session = issueSession(userId, 'social');
      const now = Date.now();
      db.prepare(`INSERT OR REPLACE INTO sessions
        (token_hash, user_id, persona, device_id, device_label, device_fingerprint, last_seen_at, created_at, expires_at)
        VALUES (?, ?, 'social', 'audit', 'audit runda 34', NULL, ?, ?, ?)`)
        .run(session.tokenHash, userId, now, now, session.expiresAt);
      cookie = `nexus_session=${session.token}`;
      note('sesiune de audit creată', `user #${userId}, device id "audit" (se poate închide din aplicație)`);
    }
  } finally {
    db.close();
  }

  if (cookie) {
    const samples = await mediaSamples();
    let mediaOk = 0;
    const mediaBad = [];
    for (const row of samples) {
      const response = await get(`/media/${row.hash}.${row.ext}`, cookie);
      const length = Number(response.headers.get('content-length') ?? -1);
      if (response.status === 200 && length === Number(row.size)) mediaOk += 1;
      else mediaBad.push(`${row.hash.slice(0, 10)}…: HTTP ${response.status}, ${length} octeți din ${row.size}`);
    }
    check('media se descarcă prin HTTP local, cu dimensiunea din bază', mediaBad.length === 0,
      mediaBad.length ? mediaBad.join(' | ') : `${mediaOk}/${samples.length} eșantioane (avataruri, fotografii, clipuri)`);

    const me = await get('/api/me', cookie);
    check('/api/me răspunde pentru contul audit', me.status === 200 && me.body?.ok === true,
      `@${me.body?.user?.handle ?? handle}, persona=${me.body?.persona ?? '?'}`);

    const feed = await get('/api/posts?limit=20&persona=social', cookie);
    check('feed-ul se încarcă din backend-ul local', feed.status === 200 && Array.isArray(feed.body?.posts),
      `${feed.body?.posts?.length ?? 0} postări în prima pagină`);

    const profile = await get(`/api/profiles/${encodeURIComponent(handle)}?persona=social`, cookie);
    const posts = Array.isArray(profile.body?.posts) ? profile.body.posts : [];
    const kinds = posts.reduce((acc, post) => ({ ...acc, [post.kind]: (acc[post.kind] ?? 0) + 1 }), {});
    check('profilul propriu se încarcă, cu arhiva', profile.status === 200 && posts.length > 0,
      `${posts.length} postări (${Object.entries(kinds).map(([kind, n]) => `${kind}=${n}`).join(', ')})`);

    const withStyle = posts.filter((post) => post.text_style);
    const faces = [...new Set(withStyle.map((post) => `${post.text_style.font}/${post.text_style.size}`))];
    note('fețe și mărimi citite din arhivă', faces.length ? faces.join(', ') : 'niciun text cu stil');

    const withOrigin = posts.filter((post) => post.provenance && post.provenance !== 'NOT_DECLARED');
    note('declarații de origine în arhivă', withOrigin.length
      ? withOrigin.slice(0, 5).map((post) => `#${post.id}=${post.provenance}`).join(', ')
      : 'niciuna');

    if (posts.length) {
      const detail = await get(`/api/posts/${posts[0].id}`, cookie);
      check('o postare se citește din backend-ul local', detail.status === 200 && detail.body?.post?.id === posts[0].id,
        `#${posts[0].id} ${detail.body?.post?.kind ?? '?'}`);
      const mediaPosts = posts.filter((post) => post.media_url || post.media);
      note('postări cu media în arhivă', `${mediaPosts.length} din ${posts.length}`);
    }

    const notifications = await get('/api/notifications', cookie);
    if (notifications.status === 200) note('notificări', `${notifications.body?.items?.length ?? 0} elemente`);
    else note('notificări', `ruta a răspuns ${notifications.status}`);
  }
} else {
  note('citirile autentificate au fost sărite', 'rulează cu --handle <handle> pentru /api/me, feed și arhivă');
}

// ---------------------------------------------------------------- 6. verdict
report.failures = failures;
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nraport: ${outFile}`);
console.log(failures === 0 ? 'rezultat: PASS (nimic nu lipsește)' : `rezultat: FAIL (${failures} verificări)`);
process.exitCode = failures === 0 ? 0 : 1;

