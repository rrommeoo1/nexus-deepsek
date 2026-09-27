import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

function socialUser(repo, handle, trafficClass = "HUMAN_ORGANIC") {
  const user = repo.createUser({ handle, displayName: handle, trafficClass });
  repo.ensurePersona(user.id, "social", { visibility: "public" });
  return user;
}

test("Dislike is a private durable opinion while Not Interested is resettable personal ranking feedback", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const author = socialUser(repo, "negative_author");
    const voter = socialUser(repo, "negative_voter");
    const observer = socialUser(repo, "negative_observer");
    const dislikePost = repo.createPost({ userId: author.id, persona: "social", caption: "Dislike target", visibility: "public" });
    const hiddenPost = repo.createPost({ userId: author.id, persona: "social", caption: "Personal hide target", visibility: "public" });

    const dislike = repo.setPostReaction(voter.id, "social", dislikePost.id, "DISLIKE", true);
    assert.equal(dislike.viewer_reaction, "DISLIKE");
    assert.equal(dislike.private_dislike_by_me, true);
    assert.equal("DISLIKE" in dislike.counts, false);
    assert.equal(repo.listSocialFeed(voter.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === dislikePost.id), false);
    assert.equal(repo.listSocialFeed(observer.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === dislikePost.id), true);
    assert.deepEqual(repo.postReactionSummary(dislikePost.id, observer.id, "social"), { counts: {}, viewer_reaction: null, private_dislike_by_me: false });

    assert.equal(repo.setSocialFeedback(voter.id, "social", hiddenPost.id, "NOT_INTERESTED", true), true);
    assert.equal(repo.listSocialFeed(voter.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === hiddenPost.id), false);
    assert.equal(repo.listSocialFeed(observer.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === hiddenPost.id), true);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM post_reactions WHERE post_id = ?").get(hiddenPost.id).count, 0);

    repo.resetSocialRecommendations(voter.id, "social", 2_000_000_000);
    assert.equal(repo.listSocialFeed(voter.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === hiddenPost.id), true);
    assert.equal(repo.listSocialFeed(voter.id, { viewerPersona: "social", limit: 20 }).some((post) => post.id === dislikePost.id), false);
  } finally {
    db.close();
  }
});

test("synthetic dislikes cannot downrank organic content or alter public reaction totals", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const author = socialUser(repo, "negative_real_author");
    const viewer = socialUser(repo, "negative_real_viewer");
    const synthetic = socialUser(repo, "negative_system_actor", "SYSTEM_TEST");
    const post = repo.createPost({ userId: author.id, persona: "social", caption: "Organic target", visibility: "public" });
    const before = repo.listSocialFeed(viewer.id, { viewerPersona: "social", limit: 20 }).map((item) => item.id);
    repo.setPostReaction(synthetic.id, "social", post.id, "DISLIKE", true);
    const after = repo.listSocialFeed(viewer.id, { viewerPersona: "social", limit: 20 }).map((item) => item.id);
    assert.deepEqual(after, before);
    assert.deepEqual(repo.postReactionSummary(post.id, viewer.id, "social").counts, {});
  } finally {
    db.close();
  }
});
