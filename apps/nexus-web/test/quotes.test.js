// The quote contract: a quote is a post of its own that points at the post it answers. Nothing about
// the original is copied, the reference is part of what the author signed, and the reference survives
// a database that predates it. The reader side (two panels for one quote, three for a chain) is
// covered by the mobile suite in `test-post-presentation.cjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addableColumnDeclaration, migrateSchemaColumns, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.quote", displayName: "Owner Quote" });
  const reader = repo.createUser({ handle: "reader.quote", displayName: "Reader Quote" });
  for (const user of [owner, reader]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  const original = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Originalul", visibility: "public" });
  return { db, repo, owner, reader, original };
}

test("a quote keeps a reference instead of a copy of the post it answers", () => {
  const { db, repo, owner, reader, original } = fixture();
  try {
    const quote = repo.createPost({
      userId: reader.id, persona: "social", kind: "text", caption: "Comentariul meu",
      visibility: "public", quotedPostId: original.id,
    });
    assert.equal(Number(quote.quoted_post_id), Number(original.id));
    assert.equal(quote.caption, "Comentariul meu");
    // The original is untouched: same author, same body, still readable on its own.
    const stored = repo.getPostById(original.id);
    assert.equal(stored.caption, "Originalul");
    assert.equal(Number(stored.user_id), Number(owner.id));
    assert.equal(stored.quoted_post_id, null);
    // Quoting twice publishes two posts, not two copies of the same one.
    const second = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Alt quote", visibility: "public", quotedPostId: quote.id });
    assert.notEqual(Number(second.id), Number(quote.id));
    assert.equal(Number(second.quoted_post_id), Number(quote.id));
    assert.equal(repo.getPostById(quote.id).caption, "Comentariul meu");
  } finally { db.close(); }
});

test("the reference is part of the authored commitment", () => {
  const { db, repo, owner, original } = fixture();
  try {
    const plain = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Același text", visibility: "public" });
    const quote = repo.createPost({
      userId: owner.id, persona: "social", kind: "text", caption: "Același text",
      visibility: "public", quotedPostId: original.id,
    });
    assert.match(quote.content_commitment, /^[a-f0-9]{64}$/);
    assert.notEqual(quote.content_commitment, plain.content_commitment, "quoting another post is a different post");
  } finally { db.close(); }
});

test("a database written before quotes existed gains the column without losing a post", () => {
  const db = openDb(":memory:");
  try {
    const repo = createRepo(db);
    const owner = repo.createUser({ handle: "legacy.quote", displayName: "Legacy Quote" });
    repo.ensurePersona(owner.id, "social", { visibility: "public" });
    const kept = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Scrisă înainte de quote", visibility: "public" });
    db.exec("ALTER TABLE posts DROP COLUMN quoted_post_id");
    assert.equal(db.prepare("PRAGMA table_info(posts)").all().some((column) => column.name === "quoted_post_id"), false);
    // The declaration must be one `ALTER TABLE ... ADD COLUMN` can actually append.
    assert.equal(addableColumnDeclaration("quoted_post_id INTEGER"), true);
    const repaired = migrateSchemaColumns(db);
    assert.ok(repaired.repaired.includes("posts.quoted_post_id"), "the column is appended, not deferred");
    assert.equal(db.prepare("PRAGMA table_info(posts)").all().some((column) => column.name === "quoted_post_id"), true);
    const stored = repo.getPostById(kept.id);
    assert.equal(stored.caption, "Scrisă înainte de quote");
    assert.equal(stored.quoted_post_id, null);
  } finally { db.close(); }
});

test("the API refuses a quote of a post the author cannot read", () => {
  assert.match(api, /if \(body\.quoted_post_id != null\) \{/);
  assert.match(api, /!repo\.canViewPost\(auth\.user\.id, auth\.persona, target\)/);
  assert.match(api, /postarea citată nu este disponibilă/);
  assert.match(api, /quotedPostId,\n      \}\);/);
});

test("the payload carries the chain, bounded and cycle-safe", () => {
  assert.match(api, /const QUOTE_CHAIN_PREVIEW_DEPTH = \d+;/);
  assert.match(api, /function quotedPostView\(repo, auth, postId, seen, depth = 0\) \{/);
  assert.match(api, /if \(seen\.has\(id\)\) return null;/);
  assert.match(api, /if \(!post \|\| !repo\.canViewPost\(auth\.user\.id, auth\.persona, post\)\) return null;/);
  assert.match(api, /\.\.\.\(quoted \? \{ quoted_post: quoted \} : \{\}\),/);
  assert.match(api, /const quoted = quotedPostView\(repo, auth, post\.quoted_post_id, new Set\(\[Number\(post\.id\)\]\)\);/);
});
