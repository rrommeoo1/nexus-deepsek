#!/usr/bin/env node
/**
 * Read-only reconnaissance of the hosted (Railway) deployment.
 *
 * It answers one question before anything is moved: how much real data lives on the host, and which
 * of it can this machine actually reach with the owner's own session. It never writes, never deletes
 * and never prints the token, the cookie or any secret — only shapes, counts and ids.
 *
 *   NEXUS_PROD_URL=https://host NEXUS_PROD_TOKEN=<session token> node prod-probe.mjs
 */
const BASE = (process.env.NEXUS_PROD_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.NEXUS_PROD_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('NEXUS_PROD_URL and NEXUS_PROD_TOKEN are required');
  process.exit(2);
}

async function call(path) {
  const answer = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await answer.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: answer.status, body };
}

const out = [];
function say(line) { out.push(line); console.log(line); }

const version = await call('/api/version');
say(`version ${version.status} commit=${version.body?.commit_short} caps=${Object.keys(version.body?.capabilities ?? {}).join(',')}`);

const me = await call('/api/me');
say(`me ${me.status} keys=${Object.keys(me.body ?? {}).join(',')}`);
const meUser = me.body?.user ?? me.body?.account ?? null;
if (meUser) say(`me user id=${meUser.id} handle=${meUser.handle} personas=${JSON.stringify(me.body?.personas ?? meUser.personas ?? null)}`);

const feed = await call('/api/feed?limit=100');
const feedPosts = feed.body?.posts ?? feed.body?.items ?? [];
say(`feed ${feed.status} keys=${Object.keys(feed.body ?? {}).join(',')} posts=${feedPosts.length} cursor=${JSON.stringify(feed.body?.cursor ?? feed.body?.next_cursor ?? null)}`);
if (feedPosts.length) {
  const authors = new Set(feedPosts.map((post) => post.author?.handle ?? post.handle ?? '?'));
  say(`feed authors=${[...authors].join('|')}`);
  say(`feed post keys=${Object.keys(feedPosts[0]).join(',')}`);
  say(`feed ids=${feedPosts.map((post) => post.id).join(',')}`);
}
