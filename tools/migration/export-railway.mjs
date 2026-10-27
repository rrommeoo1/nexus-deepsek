#!/usr/bin/env node
/**
 * Export the hosted (Railway) instance through its own authenticated API, before anything is moved.
 *
 * It is read-only: every call is a GET except `POST /api/account/export`, which is the product's own
 * supported way to ask for an account bundle and writes nothing but an export-request row.
 *
 * What it writes, under OUT (never inside the repository, never in a temp folder):
 *   api/version.json, api/me.json, api/feed.json
 *   api/profiles/<handle>.<persona>.json        one per account and persona
 *   api/posts/<id>.json                         the full record of every post it found
 *   api/comments/<id>.json                      every page of comments
 *   api/account-export/<userId>.json            the owner's own export bundle
 *   media/<hash>.<ext>                          the bytes of every media object referenced anywhere
 *   manifest.json                               counts, sources and a sha256 of every file written
 *
 * Verification is not optional: every media file is hashed and compared with its own name, so a
 * truncated download cannot pass for a backup.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const BASE = (process.env.NEXUS_PROD_URL ?? '').replace(/\/+$/, '');
const TOKEN = (process.env.NEXUS_PROD_TOKEN ?? '').trim();
const PERSONAS = ['social', 'work', 'dating', 'travel', 'market'];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const OUT = process.argv[2] || join(homedir(), 'NexusBackups', `railway-export-${stamp}`);

if (!BASE || !TOKEN) {
  console.error('NEXUS_PROD_URL and NEXUS_PROD_TOKEN are required');
  process.exit(2);
}

const written = [];
function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }
function writeJson(rel, value) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  const text = JSON.stringify(value, null, 2);
  writeFileSync(path, text);
  written.push({ path: rel, bytes: Buffer.byteLength(text), sha256: sha(text) });
  return value;
}

async function call(path, { method = 'GET', retries = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const headers = { authorization: `Bearer ${TOKEN}`, accept: 'application/json' };
      // Every mutation the server accepts needs a stable request key; a read never does.
      if (method !== 'GET') headers['idempotency-key'] = sha(`${path}:${attempt}:${Date.now()}`).slice(0, 32);
      const answer = await fetch(`${BASE}${path}`, {
        method,
        headers,
        signal: AbortSignal.timeout(60_000),
      });
      const text = await answer.text();
      if (!answer.ok) throw new Error(`${method} ${path} -> ${answer.status} ${text.slice(0, 120)}`);
      try { return JSON.parse(text); } catch { throw new Error(`${path} did not answer JSON`); }
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function downloadMedia(ref) {
  const rel = join('media', `${ref.hash}.${ref.ext}`);
  const path = join(OUT, rel);
  if (existsSync(path)) {
    const existing = sha(await import('node:fs').then((fs) => fs.readFileSync(path)));
    if (existing !== ref.hash) throw new Error(`${ref.hash}.${ref.ext} already on disk with a different hash`);
    return { skipped: true };
  }
  const answer = await fetch(`${BASE}/media/${ref.hash}.${ref.ext}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!answer.ok) throw new Error(`media ${ref.hash}.${ref.ext} -> ${answer.status}`);
  const buf = Buffer.from(await answer.arrayBuffer());
  const actual = sha(buf);
  if (actual !== ref.hash) throw new Error(`media ${ref.hash}.${ref.ext} hash mismatch: got ${actual}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  written.push({ path: rel, bytes: buf.length, sha256: actual });
  return { bytes: buf.length };
}

/** Every media reference a payload carries, in the shapes this API actually uses. */
function mediaRefs(value, found = []) {
  if (Array.isArray(value)) { for (const item of value) mediaRefs(item, found); return found; }
  if (!value || typeof value !== 'object') return found;
  const { hash, ext } = value;
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) && typeof ext === 'string' && /^[a-z0-9]{2,8}$/.test(ext)) {
    found.push({ hash, ext, id: value.id ?? null, mime: value.mime ?? null });
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'hash' || key === 'ext') continue;
    mediaRefs(item, found);
  }
  return found;
}


const manifest = {
  format: 'jungle-book-railway-export-v1',
  exported_at: Math.floor(Date.now() / 1000),
  source: BASE,
  notes: [],
};

mkdirSync(join(OUT, 'media'), { recursive: true });
console.log(`exporting ${BASE} -> ${OUT}`);

const version = await call('/api/version');
writeJson('api/version.json', version);
manifest.source_version = version;
console.log(`source commit ${version.commit_short}`);

const me = await call('/api/me');
writeJson('api/me.json', me);
const ownerId = me?.user?.id ?? null;
const ownerHandle = me?.user?.handle ?? null;
console.log(`owner #${ownerId} ${ownerHandle}`);

const feed = await call('/api/feed?limit=100');
writeJson('api/feed.json', feed);
const feedPosts = feed.posts ?? [];
console.log(`feed posts ${feedPosts.length}`);

const handles = new Set();
for (const post of feedPosts) if (post.author?.handle) handles.add(post.author.handle);
if (ownerHandle) handles.add(ownerHandle);

// Any account the search surface will name, so an account with no post in the feed is not missed.
for (const term of ['a', 'e', 'i', 'o', 'u', 'test', 'wallet']) {
  try {
    const search = await call(`/api/social/search?q=${term}&limit=50`);
    writeJson(`api/search/${term}.json`, search);
    const candidates = [search.users, search.accounts, search.people, search.profiles].flat().filter(Boolean);
    for (const candidate of candidates) {
      const handle = candidate.handle ?? candidate.username;
      if (handle) handles.add(handle);
    }
  } catch (error) {
    manifest.notes.push(`search ${term}: ${error.message}`);
  }
}

const profiles = {};
const postIds = new Set();
const shareIds = new Set();
const sharedReplyCommentIds = new Set();

async function profileFor(handle, persona) {
  try {
    const answer = await call(`/api/profiles/${encodeURIComponent(handle)}?persona=${persona}`);
    writeJson(`api/profiles/${handle}.${persona}.json`, answer);
    profiles[`${handle}:${persona}`] = answer;
    for (const post of answer.posts ?? []) {
      postIds.add(post.id);
      if (post.author?.handle) handles.add(post.author.handle);
    }
    for (const entry of answer.reposts ?? []) {
      if (entry.share_id) shareIds.add(entry.share_id);
      if (entry.post?.id) postIds.add(entry.post.id);
      if (entry.repost?.id) postIds.add(entry.repost.id);
      if (entry.post?.author?.handle) handles.add(entry.post.author.handle);
    }
    for (const entry of answer.shared_replies ?? []) {
      if (entry.comment?.id) sharedReplyCommentIds.add(entry.comment.id);
      if (entry.post?.id) postIds.add(entry.post.id);
    }
    return answer;
  } catch (error) {
    manifest.notes.push(`profile ${handle}/${persona}: ${error.message}`);
    return null;
  }
}

const visited = new Set();
const pending = [...handles];
while (pending.length) {
  const handle = pending.shift();
  if (!handle || visited.has(handle)) continue;
  visited.add(handle);
  for (const persona of PERSONAS) await profileFor(handle, persona);
  for (const known of handles) if (!visited.has(known) && !pending.includes(known)) pending.push(known);
}

for (const post of feedPosts) postIds.add(post.id);

const postDetails = [];
for (const id of [...postIds].sort((a, b) => a - b)) {
  try {
    const answer = await call(`/api/posts/${id}`);
    writeJson(`api/posts/${id}.json`, answer);
    postDetails.push(answer.post);
    if (answer.post?.author?.handle) handles.add(answer.post.author.handle);
  } catch (error) {
    manifest.notes.push(`post ${id}: ${error.message}`);
  }
}

const allComments = [];
for (const id of [...postIds].sort((a, b) => a - b)) {
  let cursor = '';
  const pages = [];
  for (let page = 0; page < 50; page += 1) {
    try {
      const answer = await call(`/api/posts/${id}/comments?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      pages.push(answer);
      for (const comment of answer.comments ?? []) allComments.push(comment);
      if (!answer.next_cursor) break;
      cursor = answer.next_cursor;
    } catch (error) {
      manifest.notes.push(`comments ${id}: ${error.message}`);
      break;
    }
  }
  if (pages.length) writeJson(`api/comments/${id}.json`, { post_id: id, pages });
}

manifest.shared_reply_comment_ids = [...sharedReplyCommentIds];

const stories = {};
for (const persona of PERSONAS) {
  try {
    stories[persona] = await call(`/api/stories?persona=${persona}`);
    writeJson(`api/stories/${persona}.json`, stories[persona]);
  } catch (error) { manifest.notes.push(`stories ${persona}: ${error.message}`); }
}

// The owner's own bundle — the product's supported account export, including the wallet binding.
try {
  const created = await call('/api/account/export', { method: 'POST' });
  writeJson('api/account-export.request.json', created);
  const downloadPath = created?.export?.download_url;
  if (downloadPath) {
    const bundle = await call(downloadPath);
    writeJson(`api/account-export/${ownerId}.json`, bundle);
    manifest.account_export = { user_id: ownerId, download_url: downloadPath };
  }
} catch (error) {
  manifest.notes.push(`account export: ${error.message}`);
}

const media = new Map();
for (const source of [feed, me, ...Object.values(profiles), ...postDetails, ...Object.values(stories)]) {
  for (const ref of mediaRefs(source)) media.set(`${ref.hash}.${ref.ext}`, ref);
}

let downloaded = 0;
const failures = [];
for (const ref of media.values()) {
  try { await downloadMedia(ref); downloaded += 1; }
  catch (error) { failures.push(`${ref.hash}.${ref.ext}: ${error.message}`); }
}

manifest.counts = {
  accounts: visited.size,
  profiles: Object.keys(profiles).length,
  feed_posts: feedPosts.length,
  post_ids: postIds.size,
  post_details: postDetails.length,
  comments: allComments.length,
  repost_share_ids: shareIds.size,
  media_referenced: media.size,
  media_downloaded: downloaded,
  media_failed: failures.length,
  files_written: written.length,
};
manifest.handles = [...visited].sort();
manifest.media = [...media.values()].map((ref) => ({ hash: ref.hash, ext: ref.ext, id: ref.id, mime: ref.mime }));
manifest.failures = failures;
manifest.files = written;
manifest.database_access = {
  raw_sqlite_available: false,
  reason: 'the hosted deployment answers HTTP only; its SQLite file lives on the platform volume and is not reachable without platform credentials (Railway CLI login or a volume backup)',
};
writeJson('manifest.json', manifest);

console.log(`\naccounts=${manifest.counts.accounts} profiles=${manifest.counts.profiles} posts=${manifest.counts.post_details}/${manifest.counts.post_ids} comments=${manifest.counts.comments} media=${downloaded}/${media.size} files=${written.length}`);
if (failures.length) console.log(`media failures:\n  ${failures.join('\n  ')}`);
if (manifest.notes.length) console.log(`notes:\n  ${manifest.notes.join('\n  ')}`);
console.log(`\nwrote ${written.length} files into ${OUT}`);

