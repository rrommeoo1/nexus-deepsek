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
  assert.match(repoSource, /setProfileGridOrder\(userId, actorPersona, ids\) \{/);
});


test("a drag writes the places, and the archive reads them back", () => {
  const { repo, owner, mine } = world();
  const order = [mine[2].id, mine[0].id, mine[1].id];
  assert.deepEqual(repo.setProfileGridOrder(owner.id, "social", order), { order });
  assert.deepEqual(order.map((id) => Number(repo.getPostById(id).grid_position)), [0, 1, 2]);
  // A second arrangement over the same posts replaces the first one, it does not append to it.
  const again = [mine[1].id, mine[2].id, mine[0].id];
  assert.deepEqual(repo.setProfileGridOrder(owner.id, "social", again), { order: again });
  assert.deepEqual(again.map((id) => Number(repo.getPostById(id).grid_position)), [0, 1, 2]);
  assert.equal(Number(repo.getPostById(mine[0].id).version), Number(mine[0].version), "placing a post is not an edit");
});

test("an arrangement that names somebody else's post is refused whole", () => {
  const { repo, owner, mine, theirs } = world();
  repo.setProfileGridOrder(owner.id, "social", [mine[0].id, mine[1].id]);
  const refused = repo.setProfileGridOrder(owner.id, "social", [mine[2].id, theirs.id, mine[0].id]);
  assert.equal(refused.error, "order_foreign");
  assert.deepEqual(refused.foreign, [theirs.id]);
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
  assert.deepEqual(repo.setProfileGridOrder(owner.id, "work", [workPost.id]), { order: [workPost.id] });
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
