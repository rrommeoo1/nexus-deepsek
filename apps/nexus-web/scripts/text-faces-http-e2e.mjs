// F1 prin HTTP real: șase fețe × patru mărimi × șase teme, pe un server local, nu în memorie.
//
// De ce un script lângă `test/post-text-faces.test.js`: testul cheamă `handleRequest` direct, deci NU
// dovedește ruta, cookie-ul de sesiune, `Idempotency-Key`, citirea din API sau rândul din baza de date.
// Aici fiecare pas trece prin serverul aplicației, pe TCP, exact cum trece telefonul — iar la final
// scriptul închide serverul, deschide fișierul SQLite și numără rândurile scrise.
//
// Ce NU atinge: `C:\Nexus\data`. Baza e un director temporar, șters la final, cu un singur cont
// `SYSTEM_TEST`; nimic nu ajunge în feed-ul real și niciun fișier al proprietarului nu e modificat.
//
// Rulare: `node scripts/text-faces-http-e2e.mjs` (sau `npm run test:text-faces`).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { issueSession } from '../lib/security.js';
import { TEXT_FONTS, TEXT_SIZES, TEXT_THEMES, TEXT_THEME_PALETTE } from '../lib/post-text-style.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '..');
const HANDLE = 'face_owner_e2e';
let failures = 0;

function record(name, ok, detail) {
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(base, child, deadlineMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    if (child.exitCode !== null) throw new Error(`serverul a ieșit cu codul ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return await response.json();
    } catch { /* încă pornește */ }
    await new Promise((step) => setTimeout(step, 250));
  }
  throw new Error('serverul nu a răspuns la /health în 30s');
}

async function call(base, cookie, method, path, body, key) {
  const headers = { 'content-type': 'application/json', 'user-agent': 'jungle-faces-e2e/1.0' };
  if (cookie) headers.cookie = cookie;
  if (key) headers['idempotency-key'] = key;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { status: response.status, body: payload };
}

/** The style the server is expected to store: the palette is the server's, not the request's. */
function expectedStyle({ theme, font, size }) {
  const palette = TEXT_THEME_PALETTE[theme];
  return {
    theme, font, size, align: 'left',
    background: palette.background.toLowerCase(),
    text: palette.text.toLowerCase(),
    media: { scale: 1, x: 0, y: 0 },
  };
}
async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), 'jungle-faces-e2e-'));
  const dbPath = join(dataDir, 'nexus.sqlite');
  const port = await freePort();
  const httpsPort = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let child = null;
  let cookie = '';
  const written = [];
  try {
    // ---- contul de test, scris înainte ca serverul să deschidă baza ----
    const seed = openDb(dbPath);
    try {
      const repo = createRepo(seed);
      const user = repo.createUser({ handle: HANDLE, displayName: 'SYSTEM_TEST Fețe' });
      repo.ensurePersona(user.id, 'social', { visibility: 'public' });
      const session = issueSession(user.id, 'social');
      repo.insertSession({
        tokenHash: session.tokenHash, userId: user.id, persona: 'social',
        expiresAt: session.expiresAt, deviceId: 'fac0000000000000000000000000000', deviceLabel: 'faces e2e',
      });
      cookie = `nexus_session=${session.token}`;
    } finally {
      seed.close();
    }

    child = spawn(process.execPath, ['server.js'], {
      cwd: WEB_ROOT,
      env: { ...process.env, NODE_ENV: 'development', PORT: String(port), HTTPS_PORT: String(httpsPort), NEXUS_DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});

    const health = await waitForHealth(base, child);
    record('serverul local răspunde la /health', health?.ok === true, `${health?.users ?? '?'} conturi în baza temporară`);

    // ---- contractul, așa cum îl vede telefonul ----
    const version = await call(base, cookie, 'GET', '/api/version');
    const textStyle = Number(version.body?.capabilities?.text_style ?? 0);
    record('serverul local anunță text_style v2', textStyle >= 2,
      `text_style=${textStyle}, contract=${version.body?.api_contract}, commit=${version.body?.commit_short}`);

    // ---- matricea completă: fiecare față, fiecare mărime, fiecare temă ----
    const mismatched = [];
    for (const theme of TEXT_THEMES) {
      for (const font of TEXT_FONTS) {
        for (const size of TEXT_SIZES) {
          const caption = `Pagina în ${font}/${size}, tema ${theme}.`;
          const created = await call(base, cookie, 'POST', '/api/posts', {
            kind: 'text', caption, text_style: { theme, font, size, align: 'left' },
          }, `faces-${theme}-${font}-${size}-r34`);
          if (created.status !== 201) {
            mismatched.push(`${font}/${size}/${theme}: HTTP ${created.status} ${JSON.stringify(created.body)}`);
            continue;
          }
          const read = await call(base, cookie, 'GET', `/api/posts/${created.body.post.id}`);
          const wanted = expectedStyle({ theme, font, size });
          if (read.status !== 200) mismatched.push(`${font}/${size}/${theme}: citirea a răspuns ${read.status}`);
          else if (JSON.stringify(read.body.post.text_style) !== JSON.stringify(wanted)) {
            mismatched.push(`${font}/${size}/${theme}: stilul întors diferă (${JSON.stringify(read.body.post.text_style)})`);
          } else if (read.body.post.caption !== caption) {
            mismatched.push(`${font}/${size}/${theme}: caption diferit`);
          } else {
            written.push({ id: created.body.post.id, caption, style: wanted });
          }
        }
      }
    }
    record('144 de publicări (6 fețe × 4 mărimi × 6 teme) sunt acceptate și întoarse la fel',
      mismatched.length === 0 && written.length === 144,
      mismatched.length ? mismatched.slice(0, 4).join(' | ') : `${written.length}/144 verificate prin GET /api/posts/:id`);

    // ---- cele șase fețe, numite explicit: „Mașină” trebuie să treacă ----
    for (const font of ['serif', 'sans', 'mono', 'slab', 'casual', 'condensed']) {
      const found = written.some((row) => row.style.font === font && row.style.size === 'xlarge');
      record(`litera ${font} publică și la mărimea xlarge`, found);
    }

    // ---- arhiva autorului arată paginile, iar contul sintetic nu intră în clasament ----
    const profile = await call(base, cookie, 'GET', `/api/profiles/${HANDLE}?persona=social`);
    const newest = written[written.length - 1];
    const archive = Array.isArray(profile.body?.posts) ? profile.body.posts : [];
    record('pagina apare în arhiva profilului', archive.some((post) => post.id === newest?.id),
      `HTTP ${profile.status}, ${archive.length} postări în arhivă`);
    /**
     * `createUser` marchează contul `SYSTEM_TEST` pentru că numele lui spune asta, iar clasamentul social
     * citește doar `HUMAN_ORGANIC` (`listSocialFeed`). Deci feed-ul răspunde 200 și gol: un cont sintetic nu
     * poate influența rangul, exact regula din `AGENTS.md`. Vizualizarea pe telefon a etichetelor de origine
     * se face cu contul proprietarului, nu cu acesta.
     */
    const feed = await call(base, cookie, 'GET', '/api/posts?limit=50&persona=social');
    const leaked = Array.isArray(feed.body?.posts)
      ? feed.body.posts.filter((post) => written.some((item) => item.id === post.id)).length
      : -1;
    record('conținutul SYSTEM_TEST nu intră în feed-ul clasat', feed.status === 200 && leaked === 0,
      `HTTP ${feed.status}, ${feed.body?.posts?.length ?? 0} postări, ${leaked} ale contului de test`);


  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((done) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); done(); }, 4000);
        child.once('exit', () => { clearTimeout(timer); done(); });
      });
    }
    // ---- ce a rămas pe disc, citit cu serverul oprit ----
    try {
      const db = openDb(dbPath);
      try {
        const rows = db.prepare('SELECT id, caption, text_style_json FROM posts ORDER BY id').all();
        const persisted = rows.filter((row) => {
          const style = JSON.parse(row.text_style_json || 'null');
          const match = written.find((item) => item.id === row.id);
          return match && row.caption === match.caption && JSON.stringify(style) === JSON.stringify(match.style);
        });
        record('fiecare pagină este în baza de date cu stilul ei', persisted.length === 144 && rows.length === 144,
          `${persisted.length}/${rows.length} rânduri identice cu cererea`);
        const owners = db.prepare('SELECT DISTINCT u.handle AS handle FROM posts p JOIN users u ON u.id = p.user_id').all();
        record('toate paginile aparțin contului SYSTEM_TEST',
          owners.length === 1 && owners[0].handle === HANDLE, owners.map((row) => `@${row.handle}`).join(', '));
        const personas = db.prepare('SELECT DISTINCT persona FROM posts').all().map((row) => row.persona);
        record('toate paginile stau în persona social', personas.length === 1 && personas[0] === 'social', personas.join(', '));
      } finally {
        db.close();
      }
    } catch (error) {
      record('baza de date poate fi citită după oprirea serverului', false, String(error?.message ?? error));
    }
    rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(failures === 0 ? '\nrezultat: PASS' : `\nrezultat: FAIL (${failures})`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();

