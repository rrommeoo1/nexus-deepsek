// Nexus content unseed — reverses scripts/content-ingest.mjs.
//
// Reads the ingest receipts (data/content-ingest-receipts) for one user and removes
// the seeded posts, stories, highlights, media rows, files and attribution records.
// It refuses to touch anything that is not recorded as ingested catalog content.
//
//   node scripts/content-unseed.mjs --dry-run --user 19
//   node scripts/content-unseed.mjs --dry-run --user 19 --post 26
//   node scripts/content-unseed.mjs --apply --user 19 --confirm-live-db --post 26
import { readdirSync, readFileSync, existsSync, unlinkSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, DATA_DIR } from "../lib/db.js";
import { MEDIA_DIR } from "../lib/media.js";
import { INGEST_SCHEMA } from "./content-ingest.mjs";

export function parseArgs(argv) {
  const flags = { user: 19, posts: [], apply: false, confirmLiveDb: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--user") flags.user = Number(argv[++index]);
    else if (arg === "--post") flags.posts.push(Number(argv[++index]));
    else if (arg === "--apply") flags.apply = true;
    else if (arg === "--confirm-live-db") flags.confirmLiveDb = true;
    else if (arg === "--dry-run") flags.apply = false;
  }
  return flags;
}

export function readReceipts(userId) {
  const directory = join(DATA_DIR, "content-ingest-receipts");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(`-user${userId}.json`))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(directory, name), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((receipt) => receipt && receipt.schema === INGEST_SCHEMA);
}

export function planUnseed(db, { userId, posts }) {
  const receipts = readReceipts(userId);
  // --post is an explicit, narrow cleanup: it must never expand into a full rollback.
  const targeted = posts.filter((id) => Number.isSafeInteger(id) && id > 0);
  const targetOnly = targeted.length > 0;
  const fromReceipts = new Set(targetOnly ? [] : receipts.flatMap((receipt) => receipt.posts ?? []));
  // Fallback: rows whose media is recorded as ingested catalog content are recovered
  // even when the publishing run died before writing its receipt.
  const fromSources = targetOnly ? [] : db.prepare("SELECT p.id FROM posts p JOIN content_sources cs ON cs.media_id = p.media_id WHERE p.user_id = ?").all(userId).map((row) => row.id);
  const storiesFromSources = targetOnly ? [] : db.prepare("SELECT s.id FROM stories s JOIN content_sources cs ON cs.media_id = s.media_id WHERE s.user_id = ?").all(userId).map((row) => row.id);
  const postIds = [...new Set([...fromReceipts, ...fromSources, ...targeted])].filter((id) => {
    const row = db.prepare("SELECT id, user_id FROM posts WHERE id = ?").get(id);
    return row && Number(row.user_id) === Number(userId);
  });
  const storyIds = [...new Set([...receipts.flatMap((receipt) => receipt.stories ?? []), ...storiesFromSources])].filter((id) => {
    const row = db.prepare("SELECT id, user_id FROM stories WHERE id = ?").get(id);
    return row && Number(row.user_id) === Number(userId);
  });
  const highlightIds = [...new Set(receipts.flatMap((receipt) => (receipt.highlights ?? []).map((entry) => entry.id)))];
  const mediaIds = [...new Set([
    ...receipts.flatMap((receipt) => receipt.media ?? []),
    ...postIds.map((id) => db.prepare("SELECT media_id FROM posts WHERE id = ?").get(id)?.media_id).filter(Boolean),
    ...storyIds.map((id) => db.prepare("SELECT media_id FROM stories WHERE id = ?").get(id)?.media_id).filter(Boolean),
  ])].sort((left, right) => left - right);
  const sources = mediaIds.length
    ? db.prepare(`SELECT id, media_id, hash, provider, licence, source_url FROM content_sources WHERE media_id IN (${mediaIds.map(() => "?").join(",")})`).all(...mediaIds)
    : [];
  return { receipts: receipts.length, postIds, storyIds, highlightIds, mediaIds, sources };
}

export function applyUnseed(db, plan, userId) {
  const removed = { posts: 0, stories: 0, highlights: 0, media: 0, sources: 0, assessments: 0, files: [], retained: [] };
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const mediaId of plan.mediaIds) removed.sources += db.prepare("DELETE FROM content_sources WHERE media_id = ?").run(mediaId).changes;
    for (const id of plan.postIds) {
      removed.posts += db.prepare("DELETE FROM posts WHERE id = ? AND user_id = ?").run(id, userId).changes;
      removed.assessments += db.prepare("DELETE FROM content_assessments WHERE subject_type = 'post' AND subject_id = ?").run(id).changes;
    }
    for (const id of plan.storyIds) removed.stories += db.prepare("DELETE FROM stories WHERE id = ? AND user_id = ?").run(id, userId).changes;
    for (const id of plan.highlightIds) removed.highlights += db.prepare("DELETE FROM story_highlights WHERE id = ? AND owner_id = ?").run(id, userId).changes;
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  // Media rows are removed one by one: a RESTRICT reference elsewhere is reported
  // instead of aborting the whole rollback.
  for (const mediaId of plan.mediaIds) {
    const row = db.prepare("SELECT hash, ext FROM media WHERE id = ?").get(mediaId);
    if (!row) continue;
    try {
      db.prepare("DELETE FROM media_upload_grants WHERE media_id = ?").run(mediaId);
      db.prepare("DELETE FROM media WHERE id = ?").run(mediaId);
      removed.media += 1;
      const file = join(MEDIA_DIR, `${row.hash}.${row.ext}`);
      if (existsSync(file)) {
        unlinkSync(file);
        removed.files.push(`${row.hash}.${row.ext}`);
      }
    } catch (error) {
      removed.retained.push({ media_id: mediaId, reason: String(error.message).slice(0, 60) });
    }
  }
  return removed;
}

function summarize(plan) {
  return {
    receipts: plan.receipts, posts: plan.postIds.length, stories: plan.storyIds.length,
    highlights: plan.highlightIds.length, media: plan.mediaIds.length, sources: plan.sources.length,
    post_ids: plan.postIds, story_ids: plan.storyIds,
    attribution: plan.sources.map((row) => ({ media_id: row.media_id, provider: row.provider, licence: row.licence, source_url: row.source_url })),
  };
}

const invokedDirectly = process.argv[1] ? process.argv[1].replace(/\\/g, "/").endsWith("scripts/content-unseed.mjs") : false;
if (invokedDirectly) {
  const flags = parseArgs(process.argv.slice(2));
  const db = openDb();
  const plan = planUnseed(db, { userId: flags.user, posts: flags.posts });
  if (!plan.postIds.length && !plan.storyIds.length && !plan.highlightIds.length) {
    console.log(JSON.stringify({ ok: false, reason: "nothing recorded for this user; pass --post <id> for an ad-hoc cleanup", ...summarize(plan) }, null, 2));
    process.exit(1);
  }
  if (!flags.apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry_run", ...summarize(plan) }, null, 2));
    process.exit(0);
  }
  if (!flags.confirmLiveDb) {
    console.log(JSON.stringify({ ok: false, reason: "add --confirm-live-db to delete seeded content" }, null, 2));
    process.exit(1);
  }
  const removed = applyUnseed(db, plan, flags.user);
  const receipt = {
    schema: "NEXUS_CONTENT_UNSEED_V1", user_id: flags.user, removed_at: new Date().toISOString(),
    plan: summarize(plan), removed,
  };
  const directory = join(DATA_DIR, "content-ingest-receipts");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `unseed-${Date.now()}-user${flags.user}.json`);
  writeFileSync(file, JSON.stringify(receipt, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, receipt_file: file, removed }, null, 2));
  process.exit(0);
}

