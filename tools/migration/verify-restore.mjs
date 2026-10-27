#!/usr/bin/env node
/**
 * Prove that what runs on this PC is what the host had.
 *
 * It asks the *local* server the same questions the export asked the hosted one and compares the answers:
 * accounts, personas, post ids, captions, commitments, versions, pins, grid positions, view totals, media
 * hashes (downloading each one and hashing the bytes again), comments and reposts.
 *
 * A missing value is a failure, not a warning: a migration that quietly drops a post is exactly what this
 * file exists to catch.
 *
 *   NEXUS_LOCAL_URL=http://127.0.0.1:5000 NEXUS_LOCAL_TOKEN=<token> node verify-restore.mjs <export-dir>
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = (process.env.NEXUS_LOCAL_URL ?? 'http://127.0.0.1:5000').replace(/\/+$/, '');
const TOKEN = (process.env.NEXUS_LOCAL_TOKEN ?? '').trim();
const exportDir = resolve(process.argv[2] ?? '');
if (!TOKEN || !existsSync(exportDir)) {
  console.error('usage: NEXUS_LOCAL_URL=... NEXUS_LOCAL_TOKEN=... node verify-restore.mjs <export-dir>');
  process.exit(2);
}

const problems = [];
const notes = [];
function fail(message) { problems.push(message); }
function note(message) { notes.push(message); }

async function get(path, { binary = false } = {}) {
  const answer = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!answer.ok) return { status: answer.status, body: null, raw: null };
  if (binary) return { status: answer.status, raw: Buffer.from(await answer.arrayBuffer()) };
  return { status: answer.status, body: await answer.json() };
}

const readJson = (rel) => JSON.parse(readFileSync(join(exportDir, rel), 'utf8'));
const version = await get('/api/version');
if (version.status !== 200) fail(`/api/version -> ${version.status}`);

const me = await get('/api/me');
const sourceMe = readJson('api/me.json');
if (me.status !== 200) fail(`/api/me -> ${me.status} (the migrated session does not authenticate)`);
else {
  if (me.body.user.id !== sourceMe.user.id) fail(`owner id ${me.body.user.id} != ${sourceMe.user.id}`);
  if (me.body.user.handle !== sourceMe.user.handle) fail(`owner handle ${me.body.user.handle} != ${sourceMe.user.handle}`);
  if (me.body.user.mvx_address !== sourceMe.user.mvx_address) fail('owner wallet address did not survive');
  if ((me.body.profiles ?? []).length !== (sourceMe.profiles ?? []).length) {
    fail(`personas ${me.body.profiles?.length} != ${sourceMe.profiles?.length}`);
  } else {
    for (const source of sourceMe.profiles) {
      const local = me.body.profiles.find((row) => row.persona === source.persona);
      if (!local) { fail(`persona ${source.persona} missing`); continue; }
      for (const key of ['name', 'bio', 'visibility', 'discoverability', 'message_policy', 'identity_sigil']) {
        if (String(local[key] ?? '') !== String(source[key] ?? '')) fail(`persona ${source.persona}.${key}: ${local[key]} != ${source[key]}`);
      }
    }
  }
}


const profileFiles = readdirSync(join(exportDir, 'api', 'profiles')).filter((name) => name.endsWith('.json'));
let profilesCompared = 0;
let postsCompared = 0;
let commentsCompared = 0;
let repostsCompared = 0;
let mediaChecked = 0;
const mediaSeen = new Set();

for (const name of profileFiles) {
  const source = readJson(join('api', 'profiles', name));
  const handle = source.profile.handle;
  const persona = source.profile.persona;
  const answer = await get(`/api/profiles/${encodeURIComponent(handle)}?persona=${persona}`);
  if (answer.status !== 200) { fail(`profile ${handle}/${persona} -> ${answer.status}`); continue; }
  profilesCompared += 1;
  const local = answer.body;

  if (String(local.profile.user_id) !== String(source.profile.user_id)) fail(`profile ${handle}/${persona} user_id differs`);
  if (local.profile.name !== source.profile.name) fail(`profile ${handle}/${persona} name ${local.profile.name} != ${source.profile.name}`);

  const sourceIds = (source.posts ?? []).map((post) => post.id).sort((a, b) => a - b);
  const localIds = (local.posts ?? []).map((post) => post.id).sort((a, b) => a - b);
  if (sourceIds.join(',') !== localIds.join(',')) {
    fail(`profile ${handle}/${persona} post ids differ: local ${localIds.join(',')} vs source ${sourceIds.join(',')}`);
  }
  for (const sourcePost of source.posts ?? []) {
    const localPost = (local.posts ?? []).find((post) => post.id === sourcePost.id);
    if (!localPost) continue;
    postsCompared += 1;
    for (const key of ['caption', 'visibility', 'status', 'kind', 'persona', 'content_commitment', 'version', 'created_at', 'pinned_at', 'grid_position', 'devnet_tx']) {
      const a = localPost[key] ?? null;
      const b = sourcePost[key] ?? null;
      if (String(a) !== String(b)) fail(`post ${sourcePost.id}.${key}: local ${a} != source ${b}`);
    }
    const sv = sourcePost.view_stats ?? {};
    const lv = localPost.view_stats ?? {};
    for (const key of ['viewers', 'impressions', 'completed']) {
      if (Number(lv[key] ?? -1) !== Number(sv[key] ?? 0)) fail(`post ${sourcePost.id}.view_stats.${key}: local ${lv[key]} != source ${sv[key]}`);
    }
    if (JSON.stringify(localPost.text_style ?? null) !== JSON.stringify(sourcePost.text_style ?? null)) {
      fail(`post ${sourcePost.id}: text_style/editorial document differs`);
    }
    if (JSON.stringify(localPost.publishing ?? null) !== JSON.stringify(sourcePost.publishing ?? null)) {
      fail(`post ${sourcePost.id}: publishing settings differ`);
    }
    for (const media of [localPost.media, ...(localPost.media_list ?? [])].filter(Boolean)) {
      mediaSeen.add(`${media.hash}.${media.ext}`);
    }
  }

  const sourceShares = (source.reposts ?? []).map((entry) => entry.share_id).sort((a, b) => a - b);
  const localShares = (local.reposts ?? []).map((entry) => entry.share_id).sort((a, b) => a - b);
  if (sourceShares.join(',') !== localShares.join(',')) {
    fail(`profile ${handle}/${persona} repost share ids differ: local ${localShares.join(',')} vs source ${sourceShares.join(',')}`);
  }
  repostsCompared += localShares.length;

  for (const postId of sourceIds) {
    const file = join(exportDir, 'api', 'comments', `${postId}.json`);
    if (!existsSync(file)) continue;
    const thread = JSON.parse(readFileSync(file, 'utf8'));
    const expected = (thread.pages ?? []).flatMap((page) => page.comments ?? []);
    if (!expected.length) continue;
    const localThread = await get(`/api/posts/${postId}/comments?limit=100`);
    if (localThread.status !== 200) { fail(`comments ${postId} -> ${localThread.status}`); continue; }
    const localIdsSet = new Set((localThread.body.comments ?? []).map((comment) => comment.id));
    for (const comment of expected) {
      if (!localIdsSet.has(comment.id)) fail(`comment ${comment.id} on post ${postId} missing locally`);
      else commentsCompared += 1;
    }
  }
}

for (const key of mediaSeen) {
  const answer = await get(`/media/${key}`, { binary: true });
  if (answer.status !== 200) { fail(`media ${key} -> ${answer.status}`); continue; }
  const digest = createHash('sha256').update(answer.raw).digest('hex');
  if (`${digest}.${key.split('.').pop()}` !== key) fail(`media ${key} served bytes that hash to ${digest}`);
  else mediaChecked += 1;
}

const feed = await get('/api/feed?limit=50');
const sourceFeed = readJson('api/feed.json');
if (feed.status !== 200) fail(`/api/feed -> ${feed.status}`);
else {
  const localIds = new Set((feed.body.posts ?? []).map((post) => post.id));
  for (const post of sourceFeed.posts ?? []) {
    if (!localIds.has(post.id)) fail(`feed lost post ${post.id}`);
  }
}

const report = {
  format: 'jungle-book-restore-verification-v1',
  checked_at: Math.floor(Date.now() / 1000),
  target: BASE,
  target_commit: version.body?.commit ?? null,
  profiles_compared: profilesCompared,
  posts_compared: postsCompared,
  comments_compared: commentsCompared,
  reposts_compared: repostsCompared,
  media_checked: mediaChecked,
  feed_posts_source: (sourceFeed.posts ?? []).length,
  feed_posts_local: (feed.body?.posts ?? []).length,
  problems,
  notes,
  ok: problems.length === 0,
};
console.log(JSON.stringify(report, null, 2));
process.exit(problems.length ? 1 : 0);

