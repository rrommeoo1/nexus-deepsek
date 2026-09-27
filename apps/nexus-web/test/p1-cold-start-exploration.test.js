import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

test("cold-start creators receive deterministic organic exploration without followers or synthetic boosts", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const establishedPosts = [];
    for (let index = 0; index < 20; index++) {
      const creator = repo.createUser({ handle: `established_${index}`, displayName: `Established ${index}` });
      repo.ensurePersona(creator.id, "social", { visibility: "public" });
      establishedPosts.push(repo.createPost({
        userId: creator.id, persona: "social", caption: `Established post ${index}`,
        language: "ro", regionCode: "RO-B", visibility: "public",
      }));
    }

    const coldPosts = [];
    for (let index = 0; index < 12; index++) {
      const creator = repo.createUser({ handle: `cold_start_${index}`, displayName: `Cold Start ${index}` });
      repo.ensurePersona(creator.id, "social", { visibility: "public" });
      coldPosts.push(repo.createPost({
        userId: creator.id, persona: "social", caption: `New creator ${index}`,
        language: "ro", regionCode: "RO-B", visibility: "public",
      }));
    }

    const synthetic = repo.createUser({ handle: "systemtest_cold_boost", displayName: "Synthetic boost", trafficClass: "SYSTEM_TEST" });
    repo.ensurePersona(synthetic.id, "social", { visibility: "public" });
    const syntheticPost = repo.createPost({ userId: synthetic.id, persona: "social", caption: "Never eligible", visibility: "public" });
    for (const post of coldPosts) repo.setPostReaction(synthetic.id, "social", post.id, "LOVE", true);

    const exposureByPost = new Map(coldPosts.map((post) => [post.id, 0]));
    for (let index = 0; index < 72; index++) {
      const viewer = repo.createUser({ handle: `cold_viewer_${index}`, displayName: `Viewer ${index}` });
      repo.ensurePersona(viewer.id, "social", { visibility: "public" });
      repo.updatePersona(viewer.id, "social", { contentLanguages: ["ro"], regionCode: "RO-B", nearEnabled: true });
      const seen = repo.recordSocialImpressions(viewer.id, "social", establishedPosts.map((post) => ({ post_id: post.id, dwell_ms: 250, completed: false })));
      assert.equal(seen.recorded, establishedPosts.length);

      const first = repo.listSocialFeed(viewer.id, { viewerPersona: "social", lens: "for-you", limit: 20, regionCode: "RO-B" });
      const replay = repo.listSocialFeed(viewer.id, { viewerPersona: "social", lens: "for-you", limit: 20, regionCode: "RO-B" });
      assert.deepEqual(replay.map((post) => post.id), first.map((post) => post.id));
      assert.equal(first.some((post) => post.id === syntheticPost.id), false);
      const exploration = first.filter((post) => post.ranking.exploration);
      assert.equal(exploration.length, 2);
      assert.deepEqual(first.map((post, position) => post.ranking.exploration ? position : null).filter(Number.isInteger), [4, 14]);
      for (const post of exploration) exposureByPost.set(post.id, (exposureByPost.get(post.id) ?? 0) + 1);
    }

    assert.equal([...exposureByPost.values()].every((count) => count > 0), true);
    assert.equal(repo.followCounts(coldPosts[0].user_id, "social").followers, 0);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM private_profile_access_receipts").get().count, 0);
  } finally {
    db.close();
  }
});
