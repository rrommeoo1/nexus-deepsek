// Backfill the ordered media list and the tags of posts written before those tables existed.
//
//   node scripts/backfill-post-tags.mjs              (dry run: reports what it would write)
//   node scripts/backfill-post-tags.mjs --execute    (writes)
//
// The extraction is the same function the API uses at write time, so a backfilled post is
// indistinguishable from a new one. Nothing is invented: a caption without tags stays without.
import { openDb } from "../lib/db.js";
import { createRepo, extractPostTags } from "../lib/repo.js";

const execute = process.argv.includes("--execute");
const db = openDb(process.env.NEXUS_DB || undefined);
const repo = createRepo(db);

try {
  const posts = db.prepare(`SELECT id, caption, media_id FROM posts WHERE status = 'active' ORDER BY id ASC`).all();
  const summary = { scanned: posts.length, withTags: 0, tagsWritten: 0, mediaRowsWritten: 0, execute };
  for (const post of posts) {
    const tags = extractPostTags(post.caption);
    if (tags.length) summary.withTags += 1;
    if (execute) {
      repo.setPostTags(post.id, tags);
      const existing = repo.listPostMedia(post.id);
      if (!existing.length && post.media_id) summary.mediaRowsWritten += repo.setPostMedia(post.id, [post.media_id]).length;
    }
    summary.tagsWritten += tags.length;
  }
  console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
  if (!execute) console.log("Dry run only. Re-run with --execute to write these rows.");
} finally {
  db.close();
}
