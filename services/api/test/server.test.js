import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { JsonStore } from "../src/store.js";
import { createNexusServer } from "../src/server.js";

const testDir = fileURLToPath(new URL("./", import.meta.url));

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function request(port, path, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const body = await res.json();
  return { status: res.status, body };
}

function tmpStore() {
  const store = new JsonStore(join(testDir, ".tmp-srv.json"));
  rmSync(store.filePath, { force: true });
  rmSync(`${store.filePath}.tmp`, { force: true });
  return store;
}

test("server: /health returns live counts", async () => {
  const store = tmpStore();
  const server = createNexusServer({ store });
  const port = await listen(server);
  try {
    const { status, body } = await request(port, "/health");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.users, 2);
    assert.equal(body.profiles, 3);
  } finally {
    server.close();
    rmSync(store.filePath, { force: true });
  }
});

test("server: /me resolves identity + persona and rejects invalid persona", async () => {
  const store = tmpStore();
  const server = createNexusServer({ store });
  const port = await listen(server);
  try {
    const ok = await request(port, "/me", {
      "x-nexus-id": "u1",
      "x-nexus-persona": "work",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.identity.handle, "@alice");
    assert.equal(ok.body.persona, "work");
    assert.equal(ok.body.profile.name, "Alice (work)");

    const bad = await request(port, "/me", {
      "x-nexus-id": "u1",
      "x-nexus-persona": "bogus",
    });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
    rmSync(store.filePath, { force: true });
  }
});

test("server: /profiles denies cross-persona read (deny-by-default)", async () => {
  const store = tmpStore();
  const server = createNexusServer({ store });
  const port = await listen(server);
  try {
    const allowed = await request(port, "/profiles/social", {
      "x-nexus-id": "u1",
      "x-nexus-persona": "social",
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.profile.name, "Alice (social)");

    const denied = await request(port, "/profiles/social", {
      "x-nexus-id": "u1",
      "x-nexus-persona": "work",
    });
    assert.equal(denied.status, 401);
    assert.equal(denied.body.error, "persona out of scope");
  } finally {
    server.close();
    rmSync(store.filePath, { force: true });
  }
});

test("server: unknown route -> 404, invalid persona -> 400", async () => {
  const store = tmpStore();
  const server = createNexusServer({ store });
  const port = await listen(server);
  try {
    const notFound = await request(port, "/nope");
    assert.equal(notFound.status, 404);

    const bad = await request(port, "/profiles/unknown", {
      "x-nexus-id": "u1",
      "x-nexus-persona": "social",
    });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
    rmSync(store.filePath, { force: true });
  }
});