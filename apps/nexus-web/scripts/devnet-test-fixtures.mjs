#!/usr/bin/env node
/**
 * The four readings the phone still misses, written through the PUBLIC API by the devnet test accounts.
 *
 * ADD-ONLY. Nothing is edited, nothing is deleted, no account is touched except the five `devnet_test_*`
 * accounts this repository created in `docs/.test-wallets.local`. The endpoint list is the app's own:
 *
 *   1. a story with the maximum lifetime (365 days, `api.js:4684`) published by @devnet_test_01;
 *   2. a plaintext message from @devnet_test_02 to @test (it follows first, so the thread is allowed);
 *   3. a PRIVATE account @devnet_test_03 with a follow request waiting for @test to answer;
 *   4. a comment by @devnet_test_04 on @test's newest public post;
 *   5. a real follower, @devnet_test_05, so "Urmăritorii" is not an empty list.
 *
 * Every mutation carries a FIXED idempotency key, so a second run replays the first answer instead of
 * writing a second story or a second comment (the server stores responses for 24 h).
 *
 * A rerun also **checks the ids `docs/TEST-DATA.md` §12.2 promised** (`story=9`, `conversation=2`,
 * `message=2`, `comment=35` on `post=25`) and exits 1 if the server answers anything else: past the 24 h
 * window a replay writes a new row, and a checklist naming the old id would silently point at nothing.
 * `--allow-drift` prints the new ids without failing, for the run that is about to update §12.2.
 *
 * Usage: node apps/nexus-web/scripts/devnet-test-fixtures.mjs [--dry-run] [--allow-drift]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const SESSIONS_FILE = resolve(ROOT, 'docs', '.test-sessions.local');
const BASE = String(process.env.NEXUS_BASE ?? 'https://nexus-deepsek-production.up.railway.app').replace(/\/+$/, '');
const TARGET_HANDLE = 'test';
const DRY_RUN = process.argv.includes('--dry-run');

const store = existsSync(SESSIONS_FILE) ? JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')) : { accounts: [] };
const devnet = (store.accounts ?? []).filter((account) => String(account.handle ?? '').startsWith('devnet_test_'));
const pick = (handle) => devnet.find((account) => account.handle === handle);
const accounts = {
  story: pick('devnet_test_01'),
  message: pick('devnet_test_02'),
  private: pick('devnet_test_03'),
  comment: pick('devnet_test_04'),
  follower: pick('devnet_test_05'),
};
for (const [role, account] of Object.entries(accounts)) {
  if (!account?.cookie) {
    console.error(`missing session for role "${role}" — run apps/nexus-web/scripts/devnet-test-accounts.mjs first`);
    process.exit(2);
  }
}

async function api(method, path, { cookie, json, op } = {}) {
  const headers = { origin: BASE, accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (json !== undefined) headers['content-type'] = 'application/json';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['idempotency-key'] = op ?? `devnet-fixture-${Date.now()}`;
  const response = await fetch(`${BASE}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
  return { status: response.status, data };
}

const ok = (result, label) => {
  if (result.status >= 400) throw new Error(`${label}: HTTP ${result.status} ${JSON.stringify(result.data).slice(0, 200)}`);
  return result.data;
};

/**
 * The ids `docs/TEST-DATA.md` §12.2 hands to the phone's checklist. A rerun inside the 24 h idempotency
 * window replays the same rows; outside it the server writes new ones, which is legitimate but means the
 * document now names rows nobody can see. That is a drift, and it is reported — not repaired here, because
 * the fixture set is add-only and this script does not decide which id the owner's checklist should carry.
 */
const CANONICAL = { story: 9, conversation: 2, message: 2, comment: 35, post: 25 };
const ACCEPT_DRIFT = process.argv.includes('--allow-drift');
const drift = [];

/** Records (or only warns about) an id that no longer matches the document, and returns what was read. */
function canonical(label, actual, wanted) {
  const got = Number(actual);
  if (!Number.isSafeInteger(got) || got <= 0) throw new Error(`${label}: the server answered no id (${actual})`);
  if (got !== wanted) {
    const line = `${label}=${got} (TEST-DATA.md §12.2 says ${wanted})`;
    if (ACCEPT_DRIFT) console.warn(`  drift (allowed): ${line}`);
    else drift.push(line);
  }
  return got;
}

async function main() {
  const target = ok(await api('GET', `/api/profiles/${TARGET_HANDLE}?persona=social`, { cookie: accounts.story.cookie }), 'read @test');
  const targetId = target.profile?.user_id;
  const targetPosts = Array.isArray(target.posts) ? target.posts : [];
  if (!Number.isSafeInteger(targetId)) throw new Error('@test has no user_id in its profile payload');
  console.log(`target @${TARGET_HANDLE} user_id=${targetId} public posts=${targetPosts.length} newest=${targetPosts[0]?.id ?? 'none'}`);
  if (DRY_RUN) return;

  // 1. story, 365 days. Text only: no media upload, no licence question, and the caption is the marker.
  const story = ok(await api('POST', '/api/stories', {
    cookie: accounts.story.cookie,
    op: 'devnet-fixture-story-max-duration',
    json: { caption: '[test] Story de verificare cu durata maximă (365 de zile). Fără valoare.', visibility: 'public', duration_hours: 8760 },
  }), 'story publish');
  const storyId = canonical('story', story.story?.id, CANONICAL.story);
  console.log(`story   id=${storyId} expires_at=${story.story?.expires_at ?? '?'} life=${story.lifecycle}`);
  // A record's own visibility gates its stories too (`privacy-matrix.js:41`): a story marked public inside a
  // followers-only profile is still a followers-only story. The author opts into public so a stranger — the
  // phone's own account, which follows @test and not @devnet_test_01 — can open it.
  ok(await api('PATCH', '/api/persona/social', {
    cookie: accounts.story.cookie, op: 'devnet-fixture-story-author-public', json: { visibility: 'public' },
  }), 'make story author public');

  // 2. the message. Following first is what makes the thread legal for a non-mutual sender.
  ok(await api('POST', '/api/follow', { cookie: accounts.message.cookie, op: 'devnet-fixture-follow-02', json: { user_id: targetId } }), 'follow @test as 02');
  const conversation = ok(await api('POST', '/api/chat/conversations', {
    cookie: accounts.message.cookie, op: 'devnet-fixture-conversation-to-test', json: { username: TARGET_HANDLE },
  }), 'open conversation');
  const conversationId = canonical('conversation', conversation.conversation?.id, CANONICAL.conversation);
  const message = ok(await api('POST', `/api/chat/conversations/${conversationId}/messages`, {
    cookie: accounts.message.cookie,
    op: 'devnet-fixture-message-to-test',
    json: { body: '[test] Mesaj de verificare de la un cont real (devnet). Fără valoare.', client_nonce: 'nexus-devnet-message-01' },
  }), 'send message');
  const messageId = canonical('message', message.message?.id, CANONICAL.message);
  console.log(`message conversation=${conversationId} id=${messageId}`);

  // 3. A private record to open from the followers list. The request that a private account *receives*
  // can only be created by the account that sends it, so the outgoing side belongs to the phone: @test
  // taps "Urmărește" on @devnet_test_03 and the button becomes "Solicitat". What this step guarantees is
  // the other half — the locked shell, read by somebody the record follows.
  ok(await api('PATCH', '/api/persona/social', {
    cookie: accounts.private.cookie, op: 'devnet-fixture-private-visibility', json: { visibility: 'private' },
  }), 'make 03 private');
  const request = await api('POST', '/api/follow', { cookie: accounts.private.cookie, op: 'devnet-fixture-request-to-test', json: { user_id: targetId } });
  ok(request, 'follow @test as 03');
  console.log(`private @${accounts.private.handle} visibility=private follows @test=${request.data?.active} (opens as a locked record that follows the viewer)`);
  // The locked shell has to answer one question even when it shows nothing else: "does this record follow
  // me?" — that is what turns the button into "Urmărește înapoi" and what `following_me` on the shell
  // exists for. 03 follows @test already, but @test's session is the phone's, not this machine's; 03 also
  // follows 05 so the same read can be proved here, with a cookie this script holds.
  ok(await api('POST', '/api/follow', {
    cookie: accounts.private.cookie, op: 'devnet-fixture-request-to-05', json: { user_id: accounts.follower.userId },
  }), 'follow 05 as 03');
  const locked = ok(await api('GET', `/api/profiles/${accounts.private.handle}?persona=social`, {
    cookie: accounts.follower.cookie,
  }), 'read 03 as 05');
  const shell = locked.profile ?? {};
  console.log(`locked shell read by 05: visibility=${shell.visibility} counts=${JSON.stringify(shell.counts)} is_following=${shell.is_following} following_me=${shell.following_me}`);
  if (shell.visibility !== 'private' || shell.following_me !== true) {
    throw new Error(`locked shell lost its direction: ${JSON.stringify({ visibility: shell.visibility, following_me: shell.following_me })}`);
  }

  // 4. a comment by somebody else on @test's newest post.
  if (targetPosts.length) {
    const postId = canonical('comment post', targetPosts[0].id, CANONICAL.post);
    const comment = ok(await api('POST', `/api/posts/${postId}/comments`, {
      cookie: accounts.comment.cookie,
      op: `devnet-fixture-comment-on-test-${postId}`,
      json: { body: '[test] Comentariu de verificare scris de un alt cont. Fără valoare.' },
    }), 'comment');
    const commentId = canonical('comment', comment.comment?.id, CANONICAL.comment);
    console.log(`comment post=${postId} id=${commentId}`);
  } else {
    console.log('comment skipped: @test has no public post to comment on');
  }

  // 5. a real follower, so the follower list is not empty on a fresh install.
  const follow = ok(await api('POST', '/api/follow', { cookie: accounts.follower.cookie, op: 'devnet-fixture-follow-05', json: { user_id: targetId } }), 'follow @test as 05');
  console.log(`follower @${accounts.follower.handle} active=${follow.active} counts=${JSON.stringify(follow.counts)}`);

  // The document is the contract the owner's checklist follows. If the server no longer answers the ids
  // written there, say so once, with the new numbers, instead of letting a screen be checked against a row
  // that has been replaced.
  if (drift.length) {
    console.error('');
    console.error('drift from docs/TEST-DATA.md §12.2 (the ids the phone checklist names):');
    for (const line of drift) console.error(`  ${line}`);
    console.error('A replay writes a new row once the 24 h idempotency window has passed. Update §12.2 (and');
    console.error('HANDOFF.md §9.3) to the ids above, or rerun with --allow-drift to print them without failing.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('devnet fixtures failed:', error?.message ?? error);
  process.exitCode = 1;
});
