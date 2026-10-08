/** Additive public-API fixture for the native comment tree. Never touches the DB directly. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../docs/.test-sessions.local', import.meta.url), 'utf8'));
const origin = 'https://nexus-deepsek-production.up.railway.app';
const postId = 5;
if (fixture.base !== origin || !Array.isArray(fixture.accounts) || fixture.accounts.length < 4) throw new Error('Datele locale de test nu corespund mediului așteptat.');
const apply = process.argv.includes('--apply');
const delay = () => new Promise((resolve) => setTimeout(resolve, 400));
const key = (label, account) => `native-comments-${createHash('sha256').update(`${postId}:${account.userId}:${label}:v1`).digest('hex')}`;

async function request(account, path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: { Accept: 'application/json', Origin: origin, Cookie: account.cookie,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) throw new Error(`${path}: HTTP ${response.status} ${body?.error || ''}`);
  return body;
}

const accounts = fixture.accounts.slice(0, 4);
for (const account of accounts) {
  const me = await request(account, '/api/me');
  if (Number(me.user?.id) !== Number(account.userId)) throw new Error('Sesiunea de test nu mai aparține contului așteptat.');
}
const initial = await request(accounts[0], `/api/posts/${postId}/comments?sort=oldest&cursor=0`);
const existing = new Map(initial.comments.map((comment) => [comment.body, comment]));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', postId, roots: initial.root_count, comments: initial.comments.length }));
if (!apply) process.exit(0);

async function add(label, body, accountIndex, parentId = null) {
  const known = existing.get(body);
  if (known) {
    if (Number(known.parent_id || 0) !== Number(parentId || 0)) throw new Error(`Părinte diferit pentru ${label}; nu se duplică.`);
    return known.id;
  }
  const account = accounts[accountIndex];
  const result = await request(account, `/api/posts/${postId}/comments`, {
    method: 'POST', headers: { 'Idempotency-Key': key(`comment-${label}`, account) },
    body: JSON.stringify(parentId ? { body, parent_id: parentId } : { body }),
  });
  if (Number(result.comment?.post_id) !== postId) throw new Error(`Răspuns invalid pentru ${label}.`);
  existing.set(body, result.comment);
  await delay();
  return result.comment.id;
}

const longText = '[Test arbore nativ] Un comentariu lung pentru citirea pe cinci rânduri. În prima parte descriu clar contextul fotografiei și locul în care a fost făcută. A doua parte adaugă detalii despre lumină, unghi și momentul zilei. A treia parte vorbește despre cum se păstrează conversația când cineva răspunde. A patra parte continuă cu o propoziție mai amplă, pentru ca textul să ocupe sigur mai mult de cinci rânduri pe telefon. Ultima parte verifică legătura Vezi mai mult și Vezi mai puțin, fără a folosi text fictiv în aplicație.';
let parent = await add('long-root', longText, 0);
for (let level = 1; level <= 4; level++) parent = await add(`depth-${level}`, `[Test arbore nativ] Nivelul ${level} răspunde nivelului ${level - 1}.`, level % accounts.length, parent);
const wideRoot = await add('wide-root', '[Test arbore nativ] Fir cu cel puțin opt răspunsuri directe pentru controlul Vezi încă.', 1);
for (let index = 1; index <= 9; index++) await add(`wide-${index}`, `[Test arbore nativ] Răspuns direct ${index} din 9.`, index % accounts.length, wideRoot);

for (const account of accounts.slice(1)) {
  await request(account, `/api/comments/${wideRoot}/reaction`, {
    method: 'POST', headers: { 'Idempotency-Key': key(`like-${wideRoot}`, account) },
    body: JSON.stringify({ kind: 'LIKE', active: true }),
  });
  await delay();
}
const final = await request(accounts[0], `/api/posts/${postId}/comments?sort=oldest&cursor=0`);
console.log(JSON.stringify({ status: 'added-or-reused', postId, roots: final.root_count, comments: final.comments.length, wideRoot,
  directReplies: final.comments.filter((item) => item.parent_id === wideRoot).length }));
