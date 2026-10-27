#!/usr/bin/env node
/**
 * Build the local production database from an export of the hosted deployment.
 *
 * It writes a *new* database (it refuses to touch one that already holds accounts), preserving the ids,
 * timestamps, ownership and JSON columns the API exposed, and it copies the media bytes into the local
 * content-addressed store under their own hash. Nothing is regenerated and nothing is re-authored: a
 * post that was edited on the phone keeps its `version`, its `content_commitment`, its `text_style`
 * (with every editorial page and media placement inside it) and its `grid_position`.
 *
 * What a hosted API can never export is written down honestly instead of being invented:
 *   - password hashes and provider subject ids are excluded by the product's own export rules, so
 *     password sign-in cannot be carried across; the owner's xPortal identity is carried across, because
 *     the wallet address *is* exported (`/api/me`);
 *   - per-viewer impression rows are not exposed (only the aggregate), so the totals travel in
 *     `posts.imported_*` and every later view is counted on top of them;
 *   - the follow graph is exposed only as flags per profile (`is_following` / `following_me`), so the
 *     edges between the accounts in this instance are rebuilt from those flags.
 *
 *   node tools/migration/import-local.mjs <export-dir> --data-dir C:\Nexus\data [--session-token <token>]
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const exportDir = resolve(process.argv[2] ?? '');
function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const dataDir = resolve(flag('--data-dir', 'C:\\Nexus\\data'));
const sessionToken = flag('--session-token', process.env.NEXUS_MIGRATION_SESSION_TOKEN ?? '');

if (!existsSync(exportDir)) {
  console.error(`usage: node import-local.mjs <export-dir> --data-dir <dir>`);
  process.exit(2);
}

process.env.NEXUS_DATA_DIR = dataDir;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
mkdirSync(dataDir, { recursive: true });

// Imported after NEXUS_DATA_DIR is set: lib/db.js resolves its paths at module load.
const { openDb } = await import('../../apps/nexus-web/lib/db.js');
const { hashToken } = await import('../../apps/nexus-web/lib/security.js');

const db = openDb();
const MEDIA_DIR = join(dataDir, 'media');
mkdirSync(MEDIA_DIR, { recursive: true });

const readJson = (rel) => JSON.parse(readFileSync(join(exportDir, rel), 'utf8'));
const has = (rel) => existsSync(join(exportDir, rel));

const manifest = has('manifest.json') ? readJson('manifest.json') : { counts: {} };
const me = readJson('api/me.json');
const feed = readJson('api/feed.json');

// A fresh target only. Merging into a database that already has accounts would silently collide on
// primary keys and could overwrite a living account with an archive copy.
const existing = db.prepare('SELECT COUNT(*) n FROM users').get().n;
if (Number(existing) > 0) {
  console.error(`refusing to import: ${dataDir}\\nexus.sqlite already holds ${existing} accounts`);
  db.close();
  process.exit(3);
}

const report = {
  format: 'jungle-book-local-import-v1',
  imported_at: Math.floor(Date.now() / 1000),
  export_dir: exportDir,
  data_dir: dataDir,
  source: manifest.source ?? null,
  source_commit: manifest.source_version?.commit ?? null,
  counts: {},
  skipped: [],
};

// One transaction for the whole import: a failure half-way leaves an empty database, never a profile with
// half of somebody's posts in it. SQLite rolls back whatever this connection did not commit.
db.exec('BEGIN IMMEDIATE');

// ---------------------------------------------------------------- accounts and personas
const owner = me.user;
const ownerProfiles = me.profiles ?? [];

const users = new Map();      // id → { handle, display_name, bio, avatar, created_at }
const personas = new Map();   // `${userId}:${persona}` → row

function noteUser({ id, handle, display_name, bio = '', avatar = null, created_at = null, mvx_address = null, mvx_alias = null, linked_wallet = null, email = null, onboarded = 1 }) {
  if (!id || !handle) return;
  const current = users.get(Number(id));
  if (current) {
    // A later sighting fills gaps but never overwrites a better value.
    if (!current.display_name && display_name) current.display_name = display_name;
    if (!current.bio && bio) current.bio = bio;
    if (!current.avatar && avatar) current.avatar = avatar;
    if (!current.created_at && created_at) current.created_at = created_at;
    if (!current.mvx_address && mvx_address) current.mvx_address = mvx_address;
    return;
  }
  users.set(Number(id), {
    id: Number(id), handle, display_name: display_name || handle, bio, avatar,
    created_at: created_at ?? Math.floor(Date.now() / 1000),
    mvx_address, mvx_alias, linked_wallet, email, onboarded,
  });
}

noteUser({
  id: owner.id, handle: owner.handle, display_name: owner.display_name, bio: owner.bio ?? '',
  avatar: owner.avatar ?? null, created_at: owner.created_at,
  mvx_address: owner.mvx_address ?? null, mvx_alias: owner.mvx_alias ?? null,
  linked_wallet: owner.linked_wallet ?? null, email: owner.email ?? null,
  onboarded: owner.needs_onboarding === false ? 1 : null,
});
for (const persona of ownerProfiles) {
  personas.set(`${owner.id}:${persona.persona}`, { user_id: owner.id, ...persona });
}

for (const post of feed.posts ?? []) {
  if (post.author?.handle) {
    noteUser({ id: post.author.id, handle: post.author.handle, display_name: post.author.display_name, avatar: post.author.avatar });
  }
}

const profileFiles = readdirSync(join(exportDir, 'api', 'profiles')).filter((name) => name.endsWith('.json'));
const profileViews = [];
for (const name of profileFiles) {
  const view = readJson(join('api', 'profiles', name));
  const profile = view.profile;
  if (!profile?.user_id) continue;
  profileViews.push({ file: name, persona: profile.persona, view });
  noteUser({
    id: profile.user_id, handle: profile.handle, display_name: profile.name,
    bio: profile.bio ?? '', avatar: profile.avatar ?? null, created_at: profile.joined_at ?? null,
  });
  // The owner's own persona row was read from `/api/me`, which carries every field; a profile view only
  // carries what a reader may see, and that is what an account owned by somebody else gets.
  if (Number(profile.user_id) === Number(owner.id) && personas.has(`${profile.user_id}:${profile.persona}`)) continue;
  personas.set(`${profile.user_id}:${profile.persona}`, {
    user_id: profile.user_id,
    persona: profile.persona,
    name: profile.name,
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    avatar: profile.avatar ?? null,
    cover: profile.cover ?? null,
    cover_mode: profile.cover_mode ?? 'cover',
    cover_focus: profile.cover_focus ?? 35,
    birth_date: profile.birth_date ?? null,
    age: profile.age ?? null,
    tabs_order: Array.isArray(profile.tabs_order) ? profile.tabs_order.join(',') : (profile.tabs_order ?? ''),
    visibility: profile.visibility ?? 'friends',
    discoverability: profile.discoverability ?? 'public',
    message_policy: profile.message_policy ?? 'requests',
    profile_kind: profile.profile_kind ?? 'personal',
    updated_at: profile.joined_at ?? Math.floor(Date.now() / 1000),
  });
}

// Comments are read before the accounts are written, because a comment can be written by an account that
// never appeared in the feed or on a profile: its author is in the reply itself, and dropping the reply
// because of an ordering detail would be losing the only copy of somebody's words.
const commentRows = [];
if (has(join('api', 'comments'))) {
  for (const name of readdirSync(join(exportDir, 'api', 'comments'))) {
    if (!name.endsWith('.json')) continue;
    const thread = readJson(join('api', 'comments', name));
    for (const comment of (thread.pages ?? []).flatMap((page) => page.comments ?? [])) {
      if (!comment?.id || comment.post_id == null) continue;
      if (comment.user_id && comment.handle) {
        noteUser({ id: comment.user_id, handle: comment.handle, display_name: comment.display_name, avatar: comment.avatar, created_at: comment.created_at });
      }
      commentRows.push(comment);
    }
  }
}
// Stories name their author too, and only the author id is needed beyond what a profile already gave.

const insertUser = db.prepare(`INSERT INTO users
  (id, handle, display_name, bio, avatar, mvx_address, mvx_alias, linked_wallet, email, email_verified,
   traffic_class, account_state, onboarded_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'HUMAN_ORGANIC', 'active', ?, ?)`);
for (const user of users.values()) {
  insertUser.run(user.id, user.handle, user.display_name, user.bio ?? '', user.avatar,
    user.mvx_address, user.mvx_alias, user.linked_wallet, user.email, user.onboarded, user.created_at);
}
report.counts.users = users.size;

const insertPersona = db.prepare(`INSERT INTO personas
  (user_id, persona, name, bio, location, age, avatar, cover, cover_mode, birth_date, tabs_order,
   identity_sigil, sigil_color, profile_kind, business_verification_status, visibility, discoverability,
   message_policy, interface_locale, content_languages, region_code, near_enabled,
   private_access_enabled, private_access_price_cents, private_access_month_price_cents,
   private_access_forever_price_cents, private_access_currency, private_access_duration_days,
   updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const row of personas.values()) {
  insertPersona.run(
    row.user_id, row.persona, row.name ?? 'Profil', row.bio ?? '', row.location ?? '',
    row.age ?? null, row.avatar ?? null, row.cover ?? null, row.cover_mode ?? 'cover',
    row.birth_date ?? null, row.tabs_order ?? '', row.identity_sigil ?? 'STAR',
    row.sigil_color ?? '#20e0d0', row.profile_kind ?? 'personal',
    row.business_verification_status ?? 'unverified', row.visibility ?? 'friends',
    row.discoverability ?? 'public', row.message_policy ?? 'requests',
    row.interface_locale ?? 'auto', row.content_languages ?? '[]', row.region_code ?? null,
    Number(row.near_enabled ?? 0), Number(row.private_access_enabled ?? 0),
    Number(row.private_access_price_cents ?? 100), Number(row.private_access_month_price_cents ?? 2500),
    Number(row.private_access_forever_price_cents ?? 10000), row.private_access_currency ?? 'USD',
    Number(row.private_access_duration_days ?? 30), row.updated_at ?? Math.floor(Date.now() / 1000),
  );
}
report.counts.personas = personas.size;



// ---------------------------------------------------------------- media (metadata + bytes)
const postFiles = readdirSync(join(exportDir, 'api', 'posts')).filter((name) => name.endsWith('.json'));
const posts = postFiles.map((name) => readJson(join('api', 'posts', name)).post).filter(Boolean);
const storiesByPersona = {};
if (has('api/stories')) {
  for (const name of readdirSync(join(exportDir, 'api', 'stories'))) {
    if (!name.endsWith('.json')) continue;
    storiesByPersona[name.replace('.json', '')] = readJson(join('api', 'stories', name));
  }
}

function collectMedia(value, found) {
  if (Array.isArray(value)) { for (const item of value) collectMedia(item, found); return found; }
  if (!value || typeof value !== 'object') return found;
  const { hash, ext } = value;
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) && typeof ext === 'string' && /^[a-z0-9]{2,8}$/.test(ext)) {
    const existing = found.get(hash);
    // One row per hash: the store is content-addressed, so two posts that embedded the same picture
    // legitimately share one media row — exactly as they did on the host.
    if (!existing || (existing.id == null && value.id != null)) found.set(hash, { ...value, hash, ext });
  }
  for (const item of Object.values(value)) collectMedia(item, found);
  return found;
}

const mediaRows = new Map();
collectMedia(posts, mediaRows);
collectMedia(storiesByPersona, mediaRows);
for (const { view } of profileViews) {
  collectMedia({ avatar: view.profile?.avatar, cover: view.profile?.cover }, mediaRows);
}
collectMedia({ avatars: ownerProfiles.map((row) => row.avatar) }, mediaRows);

const insertMedia = db.prepare(`INSERT INTO media
  (id, hash, ext, mime, detected_mime, kind, size, uploaded_by, purpose, scan_status, scan_reason, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let mediaCopied = 0;
const mediaMissing = [];
for (const row of mediaRows.values()) {
  const source = join(exportDir, 'media', `${row.hash}.${row.ext}`);
  if (!existsSync(source)) { mediaMissing.push(`${row.hash}.${row.ext}`); continue; }
  const target = join(MEDIA_DIR, `${row.hash}.${row.ext}`);
  if (!existsSync(target)) copyFileSync(source, target);
  // The name is the content: a copied file that does not hash to its own name is not media, it is damage.
  const digest = createHash('sha256').update(readFileSync(target)).digest('hex');
  if (digest !== row.hash) { mediaMissing.push(`${row.hash}.${row.ext} (hash mismatch)`); continue; }
  mediaCopied += 1;
  if (row.id == null) continue;
  insertMedia.run(
    Number(row.id), row.hash, row.ext, row.mime ?? 'application/octet-stream',
    row.detected_mime ?? row.mime ?? null, row.kind ?? 'image', Number(row.size ?? 0),
    row.uploaded_by ?? null, row.purpose ?? 'social_post',
    row.scan_status ?? 'ready_local_validation', row.scan_reason ?? 'imported_from_host',
    Number(row.created_at ?? Math.floor(Date.now() / 1000)),
  );
}
report.counts.media_rows = db.prepare('SELECT COUNT(*) n FROM media').get().n;
report.counts.media_files_copied = mediaCopied;
report.media_missing = mediaMissing;

// ---------------------------------------------------------------- posts
const insertPost = db.prepare(`INSERT INTO posts
  (id, user_id, persona, kind, caption, media_id, visibility, status, language, region_code, provenance,
   media_edit_json, media_edit_hash, audio_media_id, audio_rights, audio_attribution, external_audio_json,
   text_style_json, publishing_json, content_commitment, version, edited_at, archived_at, withdrawn_at, pinned_at,
   grid_position, devnet_tx, created_at, moderation_state, moderation_reason, moderation_policy_version,
   imported_viewers, imported_impressions, imported_completed)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertPostMedia = db.prepare('INSERT INTO post_media (post_id, media_id, position) VALUES (?, ?, ?)');
const insertTag = db.prepare('INSERT INTO post_tags (post_id, kind, tag, display, position) VALUES (?, ?, ?, ?, ?)');
const hasMedia = db.prepare('SELECT 1 FROM media WHERE id = ?');

for (const post of posts) {
  insertPost.run(
    Number(post.id), Number(post.user_id), post.persona ?? 'social', post.kind ?? 'text',
    post.caption ?? '', post.media_id ?? null, post.visibility ?? 'public', post.status ?? 'active',
    post.language ?? null, post.region_code ?? null, post.provenance ?? 'user',
    post.media_edit_json ?? null, post.media_edit_hash ?? null, post.audio_media_id ?? null,
    post.audio_rights ?? null, post.audio_attribution ?? '', post.external_audio_json ?? null,
    // The stored strings themselves, not a re-serialisation of the parsed objects: `content_commitment` is
    // a hash over these exact bytes, so pretty-printing them would silently invalidate every post that has
    // a text style or publishing settings. `null` is a real answer — a post with no publishing settings —
    // and must stay null, so the fallback only runs when the field is absent altogether.
    post.text_style_json !== undefined ? post.text_style_json : (post.text_style ? JSON.stringify(post.text_style) : null),
    post.publishing_json !== undefined ? post.publishing_json : (post.publishing ? JSON.stringify(post.publishing) : null),
    post.content_commitment ?? null, Number(post.version ?? 1), post.edited_at ?? null,
    post.archived_at ?? null, post.withdrawn_at ?? null, post.pinned_at ?? null,
    post.grid_position ?? null, post.devnet_tx ?? null, Number(post.created_at),
    post.moderation_state ?? 'ACTIVE', post.moderation_reason ?? null,
    post.moderation_policy_version ?? null,
    Number(post.view_stats?.viewers ?? 0), Number(post.view_stats?.impressions ?? 0),
    Number(post.view_stats?.completed ?? 0),
  );
  const gallery = Array.isArray(post.media_list) && post.media_list.length
    ? post.media_list
    : (post.media ? [post.media] : []);
  gallery.forEach((item, index) => {
    if (item?.id != null && hasMedia.get(Number(item.id))) insertPostMedia.run(Number(post.id), Number(item.id), index);
  });
  (post.tags ?? []).forEach((tag, index) => {
    const value = String(tag.tag ?? tag.name ?? tag.value ?? '').replace(/^#/, '');
    if (!value) return;
    insertTag.run(Number(post.id), tag.kind === 'cashtag' ? 'cashtag' : 'hashtag',
      value.toLowerCase(), tag.display ?? tag.text ?? `#${value}`, Number(tag.position ?? index));
  });
}
report.counts.posts = db.prepare('SELECT COUNT(*) n FROM posts').get().n;

// A self-check that cannot be argued with: recompute every commitment from the rows just written and
// compare it with the one the host published. A mismatch means the import changed a byte of somebody's
// post, and the run must not be called a success.
const commitmentMismatch = [];
{
  const { createHash } = await import('node:crypto');
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  for (const row of db.prepare('SELECT * FROM posts').all()) {
    const payload = {
      userId: row.user_id, persona: row.persona, kind: row.kind, caption: row.caption,
      mediaId: row.media_id, visibility: row.visibility, language: row.language,
      regionCode: row.region_code, provenance: row.provenance,
      mediaEditHash: row.media_edit_hash, audioMediaId: row.audio_media_id,
      audioRights: row.audio_rights, audioAttribution: row.audio_attribution || '',
    };
    if (row.external_audio_json) payload.externalAudio = row.external_audio_json;
    if (row.text_style_json) payload.textStyle = row.text_style_json;
    if (row.publishing_json) payload.publishing = row.publishing_json;
    if (row.quoted_post_id) payload.quotedPostId = Number(row.quoted_post_id);
    if (sha(JSON.stringify(payload)) !== row.content_commitment) commitmentMismatch.push(row.id);
  }
}
report.commitment_mismatches = commitmentMismatch;
report.counts.commitments_verified = db.prepare('SELECT COUNT(*) n FROM posts').get().n - commitmentMismatch.length;
if (commitmentMismatch.length) {
  throw new Error(`import would publish posts whose content_commitment no longer matches: ${commitmentMismatch.join(',')}`);
}
report.counts.post_media = db.prepare('SELECT COUNT(*) n FROM post_media').get().n;
report.counts.post_tags = db.prepare('SELECT COUNT(*) n FROM post_tags').get().n;

// ---------------------------------------------------------------- reposts (a tile of the reposter's own)
const insertShare = db.prepare(`INSERT INTO post_shares
  (id, user_id, actor_persona, post_id, channel, grid_position, created_at) VALUES (?, ?, ?, ?, 'repost', ?, ?)`);
for (const { view } of profileViews) {
  const profile = view.profile;
  for (const entry of view.reposts ?? []) {
    const postId = entry.post?.id ?? entry.repost?.post_id;
    if (!entry.share_id || postId == null) continue;
    if (!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(Number(postId))) continue;
    insertShare.run(Number(entry.share_id), Number(profile.user_id), profile.persona ?? 'social',
      Number(postId), entry.grid_position ?? null, Number(entry.reposted_at ?? Math.floor(Date.now() / 1000)));
  }
}
report.counts.post_shares = db.prepare(`SELECT COUNT(*) n FROM post_shares WHERE channel = 'repost'`).get().n;

// ---------------------------------------------------------------- comments
const insertComment = db.prepare(`INSERT INTO comments
  (id, post_id, user_id, actor_persona, parent_id, body, status, content_commitment, edited_at,
   withdrawn_at, version, pinned_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const commentIdExists = db.prepare('SELECT 1 FROM comments WHERE id = ?');
const postIdExists = db.prepare('SELECT 1 FROM posts WHERE id = ?');
for (const comment of [...commentRows].sort((a, b) => Number(a.id) - Number(b.id))) {
  if (!comment.user_id) { report.skipped.push(`comment ${comment.id}: no author id`); continue; }
  if (!postIdExists.get(Number(comment.post_id))) { report.skipped.push(`comment ${comment.id}: post ${comment.post_id} was not exported`); continue; }
  // A reply whose parent is outside this page would fail the foreign key; it is imported as a root reply
  // and the reason is recorded, which is better than losing the words.
  const parentId = comment.parent_id != null && commentIdExists.get(Number(comment.parent_id)) ? Number(comment.parent_id) : null;
  if (comment.parent_id != null && parentId == null) report.skipped.push(`comment ${comment.id}: parent ${comment.parent_id} absent, kept as a root reply`);
  insertComment.run(
    Number(comment.id), Number(comment.post_id), Number(comment.user_id),
    comment.actor_persona ?? 'social', parentId, comment.body ?? '',
    comment.status ?? 'active', comment.content_commitment ?? null, comment.edited_at ?? null,
    comment.withdrawn_at ?? null, Number(comment.version ?? 1), comment.pinned_at ?? null,
    Number(comment.created_at ?? Math.floor(Date.now() / 1000)),
  );
}
report.counts.comments = db.prepare('SELECT COUNT(*) n FROM comments').get().n;


// ---------------------------------------------------------------- stories
const insertStory = db.prepare(`INSERT INTO stories
  (id, user_id, persona, media_id, caption, visibility, status, content_commitment, expires_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
// Each persona's reading lists the same story, because a story is not a persona's to duplicate: it is
// imported once, under its own id.
const storyRows = new Map();
for (const payload of Object.values(storiesByPersona)) {
  for (const story of payload.stories ?? []) {
    if (story?.id && story.user_id != null) storyRows.set(Number(story.id), story);
  }
}
for (const story of storyRows.values()) {
  insertStory.run(
    Number(story.id), Number(story.user_id), story.persona ?? 'social',
    story.media?.id ?? null, story.caption ?? '', story.visibility ?? 'public',
    story.status ?? 'active', story.content_commitment ?? null,
    Number(story.expires_at ?? 0), Number(story.created_at ?? Math.floor(Date.now() / 1000)),
  );
}
report.counts.stories = db.prepare('SELECT COUNT(*) n FROM stories').get().n;

// ---------------------------------------------------------------- the follow graph, from the flags
// The hosted API exposes `is_following` / `following_me` on every profile it shows and only counts
// elsewhere, so the edges between the accounts in this instance are rebuilt from those flags. An edge to
// an account that never appeared in this export cannot be invented and is left out, on purpose.
const insertFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, persona, created_at) VALUES (?, ?, ?, ?)');
const now = Math.floor(Date.now() / 1000);
for (const { view } of profileViews) {
  const profile = view.profile;
  const persona = profile.persona ?? 'social';
  if (Number(profile.user_id) === Number(owner.id)) continue;
  if (profile.is_following) insertFollow.run(Number(owner.id), Number(profile.user_id), persona, now);
  if (profile.following_me) insertFollow.run(Number(profile.user_id), Number(owner.id), persona, now);
}
report.counts.follows = db.prepare('SELECT COUNT(*) n FROM follows').get().n;

// ---------------------------------------------------------------- the phone's own session
// The token the phone already holds was signed with the host's secret, so it cannot verify here; the
// session itself is re-issued for the same device id instead, which is a deliberate, recorded step of the
// migration and not a new login. Any other device signs in again through the same xPortal flow.
if (sessionToken) {
  const sessionFile = flag('--session-file', '');
  const session = sessionFile && existsSync(sessionFile) ? JSON.parse(readFileSync(sessionFile, 'utf8')) : {};
  const tokenHash = hashToken(sessionToken);
  const expiresAt = now + 30 * 24 * 60 * 60;
  db.prepare(`INSERT OR REPLACE INTO sessions
    (token_hash, user_id, persona, device_id, device_label, device_fingerprint, last_seen_at, created_at, expires_at)
    VALUES (?, ?, 'social', ?, ?, NULL, ?, ?, ?)`)
    .run(tokenHash, Number(session.user_id ?? owner.id), session.deviceId ?? 'unknown',
      session.deviceLabel ?? 'Xiaomi MIX Flip (migrated)', now, now, expiresAt);
  report.session = { user_id: Number(owner.id), device_id_present: Boolean(session.deviceId), expires_at: expiresAt };
}

db.exec('COMMIT');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const integrity = db.prepare('PRAGMA integrity_check').get();
report.integrity = Object.values(integrity)[0];
db.close();

report.counts.total_rows = {
  users: report.counts.users, personas: report.counts.personas, posts: report.counts.posts,
  post_media: report.counts.post_media, post_tags: report.counts.post_tags,
  post_shares: report.counts.post_shares, comments: report.counts.comments,
  stories: report.counts.stories, follows: report.counts.follows, media: report.counts.media_rows,
};

writeFileSync(join(dataDir, 'import-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`imported into ${dataDir}`);
for (const [name, value] of Object.entries(report.counts.total_rows)) console.log(`  ${name} = ${value}`);
console.log(`  media files copied = ${report.counts.media_files_copied}${mediaMissing.length ? `, missing ${mediaMissing.length}` : ''}`);
console.log(`  integrity_check = ${report.integrity}`);
if (report.skipped.length) console.log(`  skipped: ${report.skipped.length} (see import-report.json)`);

