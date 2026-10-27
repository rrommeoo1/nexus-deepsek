// The profile grid's arrangement: the owner drags a tile, the order is written down, and reopening the
// profile draws that order instead of the one time made. The arrangement is a decision about the profile
// (like a pin), so it changes no post, mints no version, and may never name somebody else's work.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { BACKEND_CAPABILITIES } from "../lib/build-info.js";

const read = (file) => readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const repoSource = read("repo.js");
const apiSource = read("api.js");
const dbSource = read("db.js");

function world() {
  const repo = createRepo(openDb(":memory:"));
  const owner = repo.createUser({ handle: "grid_owner", displayName: "Owner" });
  const other = repo.createUser({ handle: "grid_other", displayName: "Other" });
  const mine = ["a", "b", "c"].map((suffix) => repo.createPost({
    userId: owner.id, persona: "social", caption: `post ${suffix}`, visibility: "public",
  }));
  const theirs = repo.createPost({ userId: other.id, persona: "social", caption: "not mine", visibility: "public" });
  return { repo, owner, other, mine, theirs };
}

test("the arrangement is a column of its own, so no post is rewritten to place it", () => {
  assert.match(dbSource, /grid_position INTEGER,/);
  assert.match(dbSource, /grid_position: "grid_position INTEGER",/);
  assert.match(repoSource, /const PROFILE_ORDER_LIMIT = 200;/);
  assert.match(repoSource, /setProfileGridOrder\(userId, actorPersona, entries\) \{/);
  // A repost is a tile of the same grid, so its place is a column of its own too (`post_shares`), added to
  // a table that already holds rows: no share is moved by adding it.
  assert.match(dbSource, /addMissingColumns\(db, "post_shares", \{/);
  assert.match(repoSource, /UPDATE post_shares SET grid_position = \? WHERE id = \? AND user_id = \? AND actor_persona = \?/);
});


test("a drag writes the places, and the archive reads them back", () => {
  const { repo, owner, mine } = world();
  const order = [mine[2].id, mine[0].id, mine[1].id];
  const placed = repo.setProfileGridOrder(owner.id, "social", order);
  assert.deepEqual(placed.order, order);
  assert.deepEqual(placed.tiles, order.map((id) => ({ kind: "post", id })));
  assert.deepEqual(order.map((id) => Number(repo.getPostById(id).grid_position)), [0, 1, 2]);
  // A second arrangement over the same posts replaces the first one, it does not append to it.
  const again = [mine[1].id, mine[2].id, mine[0].id];
  assert.deepEqual(repo.setProfileGridOrder(owner.id, "social", again).order, again);
  assert.deepEqual(again.map((id) => Number(repo.getPostById(id).grid_position)), [0, 1, 2]);
  assert.equal(Number(repo.getPostById(mine[0].id).version), Number(mine[0].version), "placing a post is not an edit");
});

test("an arrangement that names somebody else's post is refused whole", () => {
  const { repo, owner, mine, theirs } = world();
  repo.setProfileGridOrder(owner.id, "social", [mine[0].id, mine[1].id]);
  const refused = repo.setProfileGridOrder(owner.id, "social", [mine[2].id, theirs.id, mine[0].id]);
  assert.equal(refused.error, "order_foreign");
  assert.deepEqual(refused.foreign, [{ kind: "post", id: theirs.id }]);
  // Nothing moved: the refused list was not applied half-way.
  assert.deepEqual([mine[0].id, mine[1].id].map((id) => Number(repo.getPostById(id).grid_position)), [0, 1]);
  assert.equal(repo.getPostById(mine[2].id).grid_position, null);
  assert.equal(repo.getPostById(theirs.id).grid_position, null);
});

test("a list with no place, a repeated place or too many places is refused", () => {
  const { repo, owner, mine } = world();
  assert.equal(repo.setProfileGridOrder(owner.id, "social", []).error, "order_empty");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", "1,2,3").error, "order_invalid");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [mine[0].id, mine[0].id]).error, "order_duplicate");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [mine[0].id, 0]).error, "order_invalid");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [mine[0].id, "abc"]).error, "order_invalid");
  const many = Array.from({ length: 201 }, (_, index) => index + 1);
  assert.equal(repo.setProfileGridOrder(owner.id, "social", many).error, "order_too_long");
});

test("the grid of one persona is not the grid of another", () => {
  const { repo, owner, mine } = world();
  assert.equal(repo.setProfileGridOrder(owner.id, "work", [mine[0].id]).error, "order_foreign");
  const workPost = repo.createPost({ userId: owner.id, persona: "work", caption: "work words", visibility: "public" });
  assert.deepEqual(repo.setProfileGridOrder(owner.id, "work", [workPost.id]).order, [workPost.id]);
  assert.equal(Number(repo.getPostById(workPost.id).grid_position), 0);
  assert.equal(repo.getPostById(mine[0].id).grid_position, null);
});

test("a withdrawn post stops being an answerable place", () => {
  const { repo, owner, mine } = world();
  repo.setProfileGridOrder(owner.id, "social", [mine[0].id, mine[1].id]);
  repo.deletePost(mine[0].id, owner.id, "social");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [mine[0].id, mine[1].id]).error, "order_foreign");
});


test("the route is one list, one transaction, and a capability a client may ask for", () => {
  assert.equal(BACKEND_CAPABILITIES.profile_order, 1);
  assert.match(apiSource, /if \(method === "POST" && path === "\/api\/posts\/order"\) \{/);
  assert.match(apiSource, /if \(!exactObject\(body, new Set\(\["order"\]\)\)\) return json\(res, 400, \{ ok: false, error: "order must be the only field" \}\);/);
  assert.match(apiSource, /const result = repo\.setProfileGridOrder\(auth\.user\.id, auth\.persona, body\.order\);/);
  assert.match(apiSource, /action: "posts_ordered"/);
  // Every refusal has its own status, so the phone can say which one happened.
  assert.match(apiSource, /if \(result\.error === "order_duplicate"\) return json\(res, 400, \{ ok: false, error: "order repeats a post" \}\);/);
  assert.match(apiSource, /if \(result\.error === "order_foreign"\) return json\(res, 404, \{ ok: false, error: "post not found" \}\);/);
  assert.match(apiSource, /if \(result\.error === "order_too_long"\) return json\(res, 413, \{ ok: false, code: "ORDER_TOO_LONG"/);
  // The post view is the row itself, so `grid_position` reaches the phone without a second field.
  assert.match(apiSource, /return \{\n\s+\.\.\.post,/);
});

// ---------------------------------------------------------------------------------------------------
// Reposts are tiles of the same grid.
//
// The profile an owner sees is not only their own work: a repost puts somebody else's post on their grid.
// Arranging it changes the reposter's own entry (`post_shares.grid_position`) and nothing about the post,
// so a reposter can interleave their originals and their reposts in any order without gaining a single
// permission over the post they shared.
function worldWithReposts() {
  const repo = createRepo(openDb(":memory:"));
  const owner = repo.createUser({ handle: "grid_owner", displayName: "Owner" });
  const other = repo.createUser({ handle: "grid_other", displayName: "Other" });
  const mine = ["a", "b"].map((suffix) => repo.createPost({
    userId: owner.id, persona: "social", caption: `mine ${suffix}`, visibility: "public",
  }));
  const theirs = ["x", "y"].map((suffix) => repo.createPost({
    userId: other.id, persona: "social", caption: `theirs ${suffix}`, visibility: "public",
  }));
  const shares = [];
  for (const post of theirs) {
    repo.setPostRepost(owner.id, "social", post.id, true);
    const entry = repo.listUserReposts(owner.id, "social").find((row) => Number(row.post?.id) === Number(post.id));
    shares.push({ id: entry.share_id, post });
  }
  return { repo, owner, other, mine, theirs, shares };
}

test("a repost is placed by its own share, and the original post is never touched", () => {
  const { repo, owner, mine, shares, theirs } = worldWithReposts();
  const share = shares[0];
  const placed = repo.setProfileGridOrder(owner.id, "social", [{ share_id: share.id }, mine[0].id, mine[1].id]);

  assert.deepEqual(placed.order, [mine[0].id, mine[1].id], "the post-only reading still answers");
  assert.deepEqual(placed.tiles, [
    { kind: "share", id: share.id },
    { kind: "post", id: mine[0].id },
    { kind: "post", id: mine[1].id },
  ]);

  const reposted = repo.listUserReposts(owner.id, "social").find((entry) => entry.share_id === share.id);
  assert.equal(reposted.grid_position, 0, "the repost stands first, where the owner put it");
  assert.equal(repo.getPostById(theirs[0].id).grid_position, null, "the original post keeps its own (absent) place");
  assert.equal(Number(repo.getPostById(theirs[0].id).version), Number(theirs[0].version), "arranging a repost is not an edit");
});

test("an original and a repost interleave in one arrangement", () => {
  const { repo, owner, mine, shares } = worldWithReposts();
  repo.setProfileGridOrder(owner.id, "social", [mine[0].id, { share_id: shares[1].id }, mine[1].id, { share_id: shares[0].id }]);
  const reposts = new Map(repo.listUserReposts(owner.id, "social").map((entry) => [entry.share_id, entry.grid_position]));
  assert.equal(reposts.get(shares[1].id), 1);
  assert.equal(reposts.get(shares[0].id), 3);
  assert.equal(Number(repo.getPostById(mine[1].id).grid_position), 2);
});

test("a repost somebody else made, or a share that is not a repost, is refused whole", () => {
  const { repo, owner, other, mine, shares, theirs } = worldWithReposts();
  repo.setPostRepost(other.id, "social", theirs[0].id, true);
  const foreignShare = repo.listUserReposts(other.id, "social")
    .find((entry) => Number(entry.post?.id) === Number(theirs[0].id));
  repo.setProfileGridOrder(owner.id, "social", [mine[0].id]);

  const refused = repo.setProfileGridOrder(owner.id, "social", [{ share_id: foreignShare.share_id }, mine[0].id]);
  assert.equal(refused.error, "order_foreign");
  assert.deepEqual(refused.foreign, [{ kind: "share", id: foreignShare.share_id }]);
  assert.equal(Number(repo.getPostById(mine[0].id).grid_position), 0, "the refused list was not applied half-way");

  // A share that is only a copied link is not a tile of the profile, so it has no place to write.
  const link = repo.recordPostShare(owner.id, "social", theirs[1].id, "copy_link");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [{ share_id: Number(link.id) }]).error, "order_foreign");
  assert.equal(new Set([shares[0].id, shares[1].id]).size, 2);
});

test("an entry that names both a post and a share, or neither, is refused as invalid", () => {
  const { repo, owner, mine, shares } = worldWithReposts();
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [{ post_id: mine[0].id, share_id: shares[0].id }]).error, "order_invalid");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [{}]).error, "order_invalid");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [null]).error, "order_invalid");
  assert.equal(repo.setProfileGridOrder(owner.id, "social", ["abc"]).error, "order_invalid");
  // The same tile twice is a duplicate, whichever way it is spelled.
  assert.equal(repo.setProfileGridOrder(owner.id, "social", [mine[0].id, { post_id: mine[0].id }]).error, "order_duplicate");
});

test("the arrangement of reposts survives a restart of the backend", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "grid-reposts-"));
  const file = join(directory, "nexus.sqlite");
  try {
    const first = createRepo(openDb(file));
    const owner = first.createUser({ handle: "grid_owner", displayName: "Owner" });
    const other = first.createUser({ handle: "grid_other", displayName: "Other" });
    const mine = first.createPost({ userId: owner.id, persona: "social", caption: "mine", visibility: "public" });
    const theirs = first.createPost({ userId: other.id, persona: "social", caption: "theirs", visibility: "public" });
    first.setPostRepost(owner.id, "social", theirs.id, true);
    const share = Number(first.listUserReposts(owner.id, "social")[0]?.share_id);
    assert.ok(Number.isSafeInteger(share) && share > 0, "the repost exists before the arrangement is written");
    first.setProfileGridOrder(owner.id, "social", [{ share_id: share }, mine.id]);
    first.db.close();

    // A new process would open the file exactly like this: the place is a row, not a value in memory.
    const second = createRepo(openDb(file));
    const reposts = second.listUserReposts(owner.id, "social");
    assert.equal(reposts.length, 1);
    assert.equal(reposts[0].share_id, share);
    assert.equal(reposts[0].grid_position, 0);
    assert.equal(Number(second.getPostById(mine.id).grid_position), 1);
    second.db.close();
  } finally {
    // Windows keeps a handle open for a moment after the last close, so the directory is cleaned with
    // retries instead of turning a passing test into an EPERM.
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    catch { /* the temp directory is disposable */ }
  }
});

test("the capability names repost arranging, so a client may ask instead of guess", () => {
  assert.equal(BACKEND_CAPABILITIES.profile_order_reposts, 1);
  assert.match(apiSource, /entries: result\.tiles, count: result\.tiles\.length/);
  assert.match(repoSource, /grid_position: row\.share_grid_position == null \? null : Number\(row\.share_grid_position\)/);
});



