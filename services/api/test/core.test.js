import assert from "node:assert/strict";
import test from "node:test";

import { ContentAddressedProvider, LocalStorageProvider, sha256, S3CompatibleProvider } from "../src/storage-provider.js";
import { canAccess, demoIdentity, normalizePersona, PERSONAS } from "../src/identity.js";
import { createMeHandler } from "../src/handler.js";

// Plain verified session objects (the auth layer's output). No crypto in this
// packet; this is the contract NX-AUTH-RT will have to satisfy.
const sess = (over = {}) => ({ authenticated: true, id: "u1", persona: "social", ...over });

test("StorageProvider: content-addressed put/get dedupes and verifies integrity", async () => {
  const inner = new LocalStorageProvider();
  const cas = new ContentAddressedProvider(inner);

  const a = await cas.put("hello world");
  const b = await cas.put("hello world");
  assert.equal(a, b, "identical content must hash to the same key (dedup)");
  assert.equal(await cas.get(a), "hello world");
  assert.equal(await cas.exists(a), true);

  // Corrupt the underlying store: the integrity check must fail closed (null).
  inner._map.set(a, "tampered");
  assert.equal(await cas.get(a), null);
});

test("StorageProvider: S3Compatible requires an approved backend (no silent local fallback)", async () => {
  const s3 = new S3CompatibleProvider({});
  await assert.rejects(() => s3.put("k", "v"), /approved external backend/);
});

test("identity: persona normalization rejects unknown personas", () => {
  for (const p of PERSONAS) assert.equal(normalizePersona(p), p);
  assert.equal(normalizePersona("unknown"), null);
  assert.equal(normalizePersona(null), null);
});

test("identity: deny-by-default — no persona cross-over", () => {
  const c = demoIdentity({ id: "u1", persona: "social" });
  assert.equal(c.authenticated, true);

  assert.equal(canAccess({ ownerId: "u1", persona: "social" }, c), true); // owner
  assert.equal(canAccess({ ownerId: "u2", persona: "social" }, c), true); // same persona
  assert.equal(canAccess({ ownerId: "u2", persona: "work" }, c), false); // cross persona
});

test("handler /me: unauthenticated → 401, unknown identity → 401", () => {
  const users = new Map([["u1", { id: "u1", handle: "@alice" }]]);
  const me = createMeHandler({ users, profiles: new Map() });

  assert.equal(me(null).status, 401);
  assert.equal(me({ authenticated: false, id: "u1", persona: "social" }).status, 401);
  assert.equal(me(sess({ id: "ghost" })).status, 401);
});

test("handler /me: invalid persona → 400", () => {
  const users = new Map([["u1", { id: "u1", handle: "@alice" }]]);
  const me = createMeHandler({ users, profiles: new Map() });
  assert.equal(me(sess({ persona: "bogus" })).status, 400);
});

test("handler /me: valid persona → 200 with that persona only", () => {
  const users = new Map([["u1", { id: "u1", handle: "@alice" }]]);
  const profiles = new Map([
    ["u1:social", { persona: "social", name: "Alice (social)", bio: "hello" }],
    ["u1:work", { persona: "work", name: "Alice (work)", bio: "cv" }],
  ]);
  const me = createMeHandler({ users, profiles });

  const social = JSON.parse(me(sess({ persona: "social" })).body);
  assert.equal(me(sess({ persona: "social" })).status, 200);
  assert.equal(social.identity.handle, "@alice");
  assert.equal(social.persona, "social");
  assert.equal(social.profile.name, "Alice (social)");

  const work = JSON.parse(me(sess({ persona: "work" })).body);
  assert.equal(work.profile.name, "Alice (work)");
});

test("sha256 is deterministic and 64 hex chars", () => {
  const h = sha256("abc");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, sha256("abc"));
});