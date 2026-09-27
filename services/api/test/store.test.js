import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { JsonStore, loadMaps, persistMaps, seedData } from "../src/store.js";

const testDir = fileURLToPath(new URL("./", import.meta.url));

test("JsonStore seeds a clean file and reloads the same data (durable round-trip)", () => {
  const file = join(testDir, ".tmp-store.json");
  rmSync(file, { force: true });
  rmSync(`${file}.tmp`, { force: true });

  const store = new JsonStore(file);
  const first = store.read();
  assert.deepEqual(first, seedData());

  // Mutate through the Maps and persist, then read back through a brand-new
  // store instance pointing at the same file: durability is proven.
  const maps = loadMaps(store);
  maps.users.set("u3", { id: "u3", handle: "@carol" });
  persistMaps(store, maps);

  const reopened = new JsonStore(file);
  const reloaded = reopened.read();
  assert.equal(reloaded.users.u3.handle, "@carol");

  rmSync(file, { force: true });
  rmSync(`${file}.tmp`, { force: true });
});

test("JsonStore reset reseeds a clean local store", () => {
  const file = join(testDir, ".tmp-store2.json");
  rmSync(file, { force: true });
  rmSync(`${file}.bak`, { force: true });

  const store = new JsonStore(file);
  store.write({ users: { u9: { id: "u9", handle: "@zoe" } }, profiles: {} });
  store.reset();

  assert.deepEqual(store.read(), seedData());

  rmSync(file, { force: true });
  rmSync(`${file}.bak`, { force: true });
  rmSync(`${file}.tmp`, { force: true });
});