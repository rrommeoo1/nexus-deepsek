/**
 * Pasul 5, restul: numele de test spun „Jungle Book", nu „Nexus".
 *
 * Citește sesiunile deja salvate în `docs/.test-sessions.local` (fișier local, nu intră în git), întreabă
 * serverul cine este fiecare cont și, **numai dacă** numele sau bio-ul mai conține „Nexus", trimite un
 * `PATCH /api/profile` cu varianta Jungle Book. Nu cere parole, nu tipărește cookie-uri și nu atinge niciun
 * cont care nu are „Nexus" în text.
 *
 * Rulare: `node tools/rename-test-accounts.mjs` (scrie și `docs/TEST-DATA.md`).
 */
import { readFile, writeFile } from 'node:fs/promises';

const SESSIONS = 'docs/.test-sessions.local';
const REPORT = 'docs/TEST-DATA.md';
const BASE = process.env.NEXUS_BASE || '';

function cookieOf(account) {
  const raw = String(account.cookie ?? '');
  const value = raw.replace(/^nexus_session\s*=\s*/, '').split(';')[0];
  return `nexus_session=${value}`;
}

/** „Nexus Test 01" → „Jungle Book Test 01"; „Test Nexus" → „Test Jungle Book". */
export function jungleWords(text) {
  return String(text ?? '')
    .replace(/Jungle Book/g, 'Nexus')
    .replace(/Nexus/g, 'Jungle Book')
    .replace(/Jungle Book/g, 'Jungle Book');
}

async function call(url, cookie, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      // Production refuses an authenticated mutation that does not say where it came from (api.js:809-817)
      // and refuses one without an idempotency key, so a retry cannot become a second write.
      ...(init.method && init.method !== 'GET'
        ? { Origin: base, 'Idempotency-Key': `rename-${crypto.randomUUID()}` }
        : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, body };
}

const sessions = JSON.parse(await readFile(SESSIONS, 'utf8'));
const base = BASE || sessions.base;
const rows = [];

for (const account of sessions.accounts ?? []) {
  const cookie = cookieOf(account);
  const me = await call(`${base}/api/me`, cookie);
  if (me.status === 401 || me.status === 403) {
    rows.push({ handle: account.handle, outcome: 'sesiune expirată (401) — neredenumit', name: '', bio: '' });
    continue;
  }
  if (me.status !== 200 || !me.body?.user) {
    rows.push({ handle: account.handle, outcome: `răspuns ${me.status} — neredenumit`, name: '', bio: '' });
    continue;
  }
  const user = me.body.user;
  const display = String(user.display_name ?? '');
  const bio = String(user.bio ?? '');
  const wantsName = /nexus/i.test(display);
  const wantsBio = /nexus/i.test(bio);
  if (!wantsName && !wantsBio) {
    rows.push({ handle: account.handle, outcome: 'fără „Nexus" în text — neatins', name: display, bio });
    continue;
  }
  const patch = {};
  if (wantsName) patch.display_name = jungleWords(display).slice(0, 50);
  if (wantsBio) patch.bio = jungleWords(bio).slice(0, 300);
  const saved = await call(`${base}/api/profile`, cookie, { method: 'PATCH', body: JSON.stringify(patch) });
  rows.push({
    handle: account.handle,
    outcome: saved.status === 200 ? 'redenumit' : `refuzat (${saved.status})`,
    name: saved.status === 200 ? String(saved.body?.user?.display_name ?? patch.display_name ?? display) : display,
    bio: saved.status === 200 ? String(saved.body?.user?.bio ?? patch.bio ?? bio) : bio,
  });
}

const BEGIN = '<!-- rename-test-accounts:begin -->';
const END = '<!-- rename-test-accounts:end -->';
const table = [
  BEGIN,
  '',
  '## Numele de test, redenumite în „Jungle Book" (18 octombrie 2026)',
  '',
  'Scris de `tools/rename-test-accounts.mjs` pe baza sesiunilor din `docs/.test-sessions.local`.',
  'Coloana „stare" spune ce a răspuns serverul; un 401 este o sesiune expirată, nu un nume schimbat.',
  '',
  '| Handle | Stare | Nume afișat | Bio |',
  '| --- | --- | --- | --- |',
  ...rows.map((row) => `| @${row.handle} | ${row.outcome} | ${row.name.replace(/\|/g, '/')} | ${row.bio.replace(/\|/g, '/')} |`),
  '',
  END,
  '',
].join('\n');

/** The document stays the owner's; this script owns one marked block inside it. */
let previous = '';
try { previous = await readFile(REPORT, 'utf8'); } catch { /* first run */ }
const stripped = previous.includes(BEGIN) && previous.includes(END)
  ? `${previous.slice(0, previous.indexOf(BEGIN))}${previous.slice(previous.indexOf(END) + END.length).replace(/^\r?\n/, '')}`
  : previous;

await writeFile(REPORT, `${stripped.trimEnd()}\n\n${table}`, 'utf8');
console.log(table);
