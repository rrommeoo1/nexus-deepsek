import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { evaluatePrivacy } from "../lib/privacy-matrix.js";

const base = {
  viewerId: 1,
  viewerPersona: "social",
  ownerId: 2,
  ownerPersona: "social",
  ownerVisibility: "public",
  resourceVisibility: "public",
  resourceStatus: "active",
};

test("Privacy Matrix is deny-first across status, persona, block and audience", () => {
  assert.deepEqual(evaluatePrivacy(base), { allow: true, reason: "PUBLIC" });
  assert.equal(evaluatePrivacy({ ...base, resourceStatus: "withdrawn" }).reason, "RESOURCE_INACTIVE");
  assert.equal(evaluatePrivacy({ ...base, viewerPersona: "work" }).reason, "PERSONA_MISMATCH");
  assert.equal(evaluatePrivacy({ ...base, blocked: true }).reason, "BLOCKED");
  assert.equal(evaluatePrivacy({ ...base, ownerVisibility: "followers" }).allow, false);
  assert.equal(evaluatePrivacy({ ...base, ownerVisibility: "followers", follows: true }).allow, true);
  assert.equal(evaluatePrivacy({ ...base, resourceVisibility: "friends", follows: true }).allow, false);
  assert.equal(evaluatePrivacy({ ...base, resourceVisibility: "friends", follows: true, mutual: true }).allow, true);
  assert.equal(evaluatePrivacy({ ...base, ownerVisibility: "private", privateEntitlement: false }).allow, false);
  assert.equal(evaluatePrivacy({ ...base, ownerVisibility: "private", resourceVisibility: "private", privateEntitlement: true }).allow, true);
  assert.equal(evaluatePrivacy({ ...base, ownerVisibility: "unexpected" }).reason, "PROFILE_VISIBILITY_INVALID");
  assert.equal(evaluatePrivacy({ ...base, viewerId: 2, ownerVisibility: "private", resourceVisibility: "private" }).reason, "OWNER");
});

test("repository applies one persona-aware matrix to posts, Stories and media", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const owner = repo.createUser({ handle: "privacy-owner", displayName: "Owner" });
    const viewer = repo.createUser({ handle: "privacy-viewer", displayName: "Viewer" });
    for (const user of [owner, viewer]) {
      repo.ensurePersona(user.id, "social", { visibility: "public" });
      repo.ensurePersona(user.id, "work", { visibility: "public" });
    }
    const publicPost = repo.createPost({ userId: owner.id, persona: "social", caption: "public", visibility: "public" });
    assert.equal(repo.canViewPost(viewer.id, "social", publicPost), true);
    assert.equal(repo.canViewPost(viewer.id, "work", publicPost), false);

    repo.updatePersona(owner.id, "social", { visibility: "followers" });
    assert.equal(repo.canViewPost(viewer.id, "social", publicPost), false);
    repo.setFollow(viewer.id, owner.id, "social", true);
    assert.equal(repo.canViewPost(viewer.id, "social", publicPost), true);
    const friendsPost = repo.createPost({ userId: owner.id, persona: "social", caption: "friends", visibility: "friends" });
    assert.equal(repo.canViewPost(viewer.id, "social", friendsPost), false);
    repo.setFollow(owner.id, viewer.id, "social", true);
    assert.equal(repo.canViewPost(viewer.id, "social", friendsPost), true);

    repo.updatePersona(owner.id, "social", { visibility: "private", privateAccess: { enabled: true, priceCents: 100, currency: "USD", durationDays: 15 } });
    const privatePost = repo.createPost({ userId: owner.id, persona: "social", caption: "private", visibility: "private" });
    assert.equal(repo.canViewPost(viewer.id, "social", privatePost), false);
    const preview = repo.createPrivateAccessDemoReceipt({ viewerId: viewer.id, ownerId: owner.id, persona: "social", durationDays: 15 });
    assert.equal(preview.receipt.status, "demo_unpaid");
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social"), false, "an unpaid demo receipt must never become a privacy entitlement");
    assert.equal(repo.canViewPost(viewer.id, "social", privatePost), false);
    db.prepare(`UPDATE private_profile_access_receipts SET status = 'settled' WHERE id = ?`).run(preview.receipt.id);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social"), true);
    assert.equal(repo.canViewPost(viewer.id, "social", privatePost), true);

    const stored = repo.insertMedia({ hash: "c".repeat(64), ext: "jpg", mime: "image/jpeg", detectedMime: "image/jpeg", kind: "image", size: 4, uploadedBy: owner.id, purpose: "social_post", actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "fixture" });
    const privateMediaPost = repo.createPost({ userId: owner.id, persona: "social", kind: "image", caption: "private media", mediaId: stored.id, visibility: "private" });
    assert.equal(repo.canReadMedia(stored.id, viewer.id, "social"), true);
    assert.equal(repo.canReadMedia(stored.id, viewer.id, "work"), false);

    const story = repo.createStory({ userId: owner.id, persona: "social", caption: "private story", visibility: "private", expiresAt: Math.floor(Date.now() / 1000) + 3600 });
    assert.equal(repo.listActiveStories(viewer.id, "social").some((item) => item.id === story.id), true);
    assert.equal(repo.listActiveStories(viewer.id, "work").some((item) => item.id === story.id), false);

    repo.setProfileBlock(owner.id, "social", viewer.id, true);
    assert.equal(repo.canViewPost(viewer.id, "social", privateMediaPost), false);
    assert.equal(repo.canReadMedia(stored.id, viewer.id, "social"), false);
    assert.equal(repo.listPrivateContentForViewer(viewer.id, { persona: "social" }).posts.length, 0);
    assert.equal(repo.privateAccessQuote({ viewerId: viewer.id, ownerId: owner.id, persona: "social", durationDays: 15 }), null);
  } finally { db.close(); }
});

test("profile online presence follows persona, visibility, friendship and block gates", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const owner = repo.createUser({ handle: "presence-owner", displayName: "Owner" });
    const viewer = repo.createUser({ handle: "presence-viewer", displayName: "Viewer" });
    for (const user of [owner, viewer]) {
      repo.ensurePersona(user.id, "social", { visibility: "public" });
      repo.ensurePersona(user.id, "work", { visibility: "public" });
    }
    repo.touchPresence(owner.id, "social", 10_000);
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "public", atSeconds: 10_060 }), { visible: true, online: true });
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "work", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "public", atSeconds: 10_060 }), { visible: false, online: false });
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "private", atSeconds: 10_060 }), { visible: false, online: false });
    repo.setFollow(viewer.id, owner.id, "social", true);
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "private", atSeconds: 10_060 }), { visible: false, online: false });
    repo.setFollow(owner.id, viewer.id, "social", true);
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "private", atSeconds: 10_060 }), { visible: true, online: true });
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "private", atSeconds: 10_121 }), { visible: true, online: false });
    repo.setProfileBlock(owner.id, "social", viewer.id, true);
    assert.deepEqual(repo.profilePresenceForViewer({ viewerId: viewer.id, viewerPersona: "social", ownerId: owner.id, ownerPersona: "social", ownerVisibility: "public", atSeconds: 10_060 }), { visible: false, online: false });
  } finally { db.close(); }
});

test("1,000 synthetic privacy decisions never bypass persona, block or inactive state", () => {
  const levels = ["public", "followers", "friends", "private"];
  let deniedByHardGate = 0;
  for (let index = 0; index < 1_000; index++) {
    const blocked = index % 7 === 0;
    const mismatch = index % 11 === 0;
    const inactive = index % 13 === 0;
    const decision = evaluatePrivacy({
      ...base,
      viewerPersona: mismatch ? "work" : "social",
      ownerVisibility: levels[index % levels.length],
      resourceVisibility: levels[Math.floor(index / levels.length) % levels.length],
      resourceStatus: inactive ? "withdrawn" : "active",
      blocked,
      follows: index % 2 === 0,
      mutual: index % 3 === 0,
      privateEntitlement: index % 5 === 0,
    });
    if (blocked || mismatch || inactive) {
      assert.equal(decision.allow, false);
      deniedByHardGate++;
    }
  }
  assert.ok(deniedByHardGate > 250);
});

function oracleGate(level, { follows, mutual, privateEntitlement }) {
  if (!new Set(["public", "followers", "friends", "private"]).has(level)) return false;
  if (level === "public") return true;
  if (level === "followers") return follows;
  if (level === "friends") return mutual;
  return privateEntitlement;
}

test("exhaustive audience property matrix agrees with a deny-first oracle", () => {
  const levels = ["public", "followers", "friends", "private", "invalid"];
  const statuses = ["active", "archived", "withdrawn"];
  let cases = 0;
  for (const ownerVisibility of levels) for (const resourceVisibility of levels) {
    for (const resourceStatus of statuses) for (const viewerPersona of ["social", "work"]) {
      for (const blocked of [false, true]) for (const follows of [false, true]) {
        for (const mutual of [false, true]) for (const privateEntitlement of [false, true]) {
          const input = { ...base, ownerVisibility, resourceVisibility, resourceStatus, viewerPersona, blocked, follows, mutual, privateEntitlement };
          const actual = evaluatePrivacy(input);
          const hardDenied = resourceStatus !== "active" || viewerPersona !== "social" || blocked;
          const expected = !hardDenied
            && oracleGate(ownerVisibility, { follows, mutual, privateEntitlement })
            && oracleGate(resourceVisibility, { follows, mutual, privateEntitlement });
          assert.equal(actual.allow, expected, JSON.stringify(input));
          cases++;
        }
      }
    }
  }
  assert.equal(cases, 2_400);
});

test("private entitlement is exact-owner, exact-persona, settled and half-open in time", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const owner = repo.createUser({ handle: "privacy_time_owner", displayName: "Owner" });
    const otherOwner = repo.createUser({ handle: "privacy_time_other", displayName: "Other" });
    const viewer = repo.createUser({ handle: "privacy_time_viewer", displayName: "Viewer" });
    for (const user of [owner, otherOwner, viewer]) {
      repo.ensurePersona(user.id, "social", { visibility: "public" });
      repo.ensurePersona(user.id, "work", { visibility: "public" });
    }
    db.prepare(`INSERT INTO private_profile_access_receipts
      (viewer_id, owner_id, persona, amount_cents, currency, duration_days,
       owner_share_cents, nexus_share_cents, starts_at, expires_at, privacy_mode, status, receipt_hash)
      VALUES (?, ?, 'social', 100, 'USD', 1, 90, 10, 100, 200,
        'OWNER_ANONYMOUS', 'settled', ?)`).run(viewer.id, owner.id, "d".repeat(64));
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social", 99), false);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social", 100), true);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social", 199), true);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social", 200), false);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "work", 150), false);
    assert.equal(repo.hasActivePrivateAccess(viewer.id, otherOwner.id, "social", 150), false);
    assert.equal(repo.hasActivePrivateAccess(owner.id, owner.id, "social", 150), false);
    db.prepare(`UPDATE private_profile_access_receipts SET status = 'demo_unpaid' WHERE receipt_hash = ?`).run("d".repeat(64));
    assert.equal(repo.hasActivePrivateAccess(viewer.id, owner.id, "social", 150), false);
  } finally { db.close(); }
});
