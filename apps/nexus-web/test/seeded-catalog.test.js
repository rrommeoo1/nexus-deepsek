// The ingest ledger marks catalog traffic ("seeded_catalog") and the repository keeps
// every such row out of the organic product metrics. These checks pin that contract:
// seeded rows are real database rows, yet they can never fabricate a visible metric.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.organic", displayName: "Owner Organic" });
  const reader = repo.createUser({ handle: "reader.organic", displayName: "Reader Organic" });
  const seeded = repo.createUser({ handle: "seeded.catalog", displayName: "Seeded Catalog", trafficClass: "SEEDED_CATALOG" });
  for (const user of [owner, reader, seeded]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  const post = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Organic catalog post", visibility: "public" });
  return { db, repo, owner, reader, seeded, post };
}

test("SEEDED_CATALOG is a first-class traffic class and unknown classes are refused", () => {
  const { db, repo, seeded } = fixture();
  try {
    assert.equal(repo.getUserById(seeded.id).traffic_class, "SEEDED_CATALOG");
    assert.throws(
      () => repo.createUser({ handle: "bad.class", displayName: "Bad Class", trafficClass: "ORGANIC" }),
      /USER_TRAFFIC_CLASS_INVALID/,
    );
  } finally { db.close(); }
});

test("catalog traffic never reaches organic discovery, ranking or sigils", () => {
  const { db, repo, owner, reader, seeded, post } = fixture();
  try {
    const seededPost = repo.createPost({ userId: seeded.id, persona: "social", kind: "text", caption: "Seeded catalog post", visibility: "public" });
    repo.setFollow(reader.id, owner.id, "social", true);
    repo.setFollow(seeded.id, owner.id, "social", true);
    for (const lens of ["for-you", "following"]) {
      const feed = repo.listSocialFeed(reader.id, { lens, limit: 50 });
      assert.ok(feed.some((item) => Number(item.id) === Number(post.id)), `organic post missing from ${lens}`);
      assert.ok(!feed.some((item) => Number(item.id) === Number(seededPost.id)), `seeded post leaked into ${lens}`);
    }
    assert.equal(repo.sigilProgress(seeded.id, "social").earned, false);
  } finally { db.close(); }
});

test("engagement from catalog traffic cannot fabricate a visible counter", () => {
  const { db, repo, reader, seeded, post } = fixture();
  try {
    repo.setPostReaction(seeded.id, "social", post.id, "LIKE", true);
    repo.addSocialComment({ userId: seeded.id, actorPersona: "social", postId: post.id, body: "seeded catalog comment" });
    // The rows exist, the counters stay empty: this is why the ingest never seeds engagement.
    assert.equal(repo.likeCount(post.id), 0);
    assert.deepEqual(repo.postReactionSummary(post.id, reader.id, "social").counts, {});
    assert.equal(Number(db.prepare("SELECT COUNT(*) AS count FROM post_reactions WHERE post_id = ?").get(post.id).count), 1);
    assert.equal(Number(db.prepare("SELECT COUNT(*) AS count FROM comments WHERE post_id = ?").get(post.id).count), 1);
    // A human reaction is the only thing that moves a product counter.
    repo.setPostReaction(reader.id, "social", post.id, "LIKE", true);
    assert.equal(repo.likeCount(post.id), 1);
    assert.deepEqual(repo.postReactionSummary(post.id, reader.id, "social").counts, { LIKE: 1 });
  } finally { db.close(); }
});
