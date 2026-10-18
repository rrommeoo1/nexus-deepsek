import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateCreatorProductPriceFloor, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

/**
 * The price floor migration, tested the way it will run: on a **copy** of an old database file, so the
 * original fixture survives and its old CHECK can still be proved. The old table is built by hand,
 * because `openDb` would create the new one and there would be nothing left to migrate.
 */
const OLD_SCHEMA = `
  CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE);
  CREATE TABLE creator_support_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('tip','membership')),
    title TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 100000000),
    currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
    interval_days INTEGER CHECK(interval_days IS NULL OR interval_days BETWEEN 1 AND 366),
    split_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX idx_creator_products_catalog
    ON creator_support_products(creator_id, status, kind, price_cents);
  CREATE TABLE creator_support_intents (
    id TEXT PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES creator_support_products(id) ON DELETE RESTRICT
  );
`;

function makeOldDatabase(directory) {
  const path = join(directory, "old.sqlite");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(OLD_SCHEMA);
  db.exec("INSERT INTO users (handle) VALUES ('old_creator')");
  const insert = db.prepare(
    "INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version, status) VALUES (1, 'tip', ?, ?, 'CORE_TIP_V1_90_5_3_2', ?)",
  );
  insert.run("lowest allowed", 100, "active");
  insert.run("a normal price", 200, "active");
  insert.run("the ceiling", 100000000, "paused");
  db.prepare("INSERT INTO creator_support_intents (id, product_id) VALUES ('intent-1', 2)").run();
  db.close();
  return path;
}

test("an old database is copied, rebuilt without loss, and then accepts one cent", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-price-floor-"));
  try {
    const original = makeOldDatabase(directory);
    const copy = join(directory, "copy.sqlite");
    copyFileSync(original, copy);

    const db = new DatabaseSync(copy);
    const before = db.prepare("SELECT id, title, price_cents, status FROM creator_support_products ORDER BY id").all();
    const result = migrateCreatorProductPriceFloor(db);
    assert.equal(result.migrated, true);
    assert.equal(result.carried, 3);
    assert.equal(result.before, 3);

    const after = db.prepare("SELECT id, title, price_cents, status FROM creator_support_products ORDER BY id").all();
    assert.deepEqual(after, before, "every row survived with its id, price and status");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM creator_support_intents").get().count, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // The reason the migration exists: policy v3 prices start at one cent.
    db.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (1, 'tip', 'three bani', 3, 'SPLIT_V3_70_5_4_4_1')").run();
    assert.equal(db.prepare("SELECT price_cents FROM creator_support_products WHERE title = 'three bani'").get().price_cents, 3);
    assert.throws(() => db.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (1, 'tip', 'free', 0, 'SPLIT_V3_70_5_4_4_1')").run(), /CHECK/);
    assert.throws(() => db.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (1, 'tip', 'too dear', 100000001, 'SPLIT_V3_70_5_4_4_1')").run(), /CHECK/);

    // A second run finds the new CHECK and does nothing.
    assert.deepEqual(migrateCreatorProductPriceFloor(db), { migrated: false, reason: "current", carried: 0 });
    db.close();

    // The fixture itself was never touched: its old CHECK still refuses a cent.
    const untouched = new DatabaseSync(original);
    assert.throws(
      () => untouched.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (1, 'tip', 'cent', 1, 'SPLIT_V3_70_5_4_4_1')").run(),
      /CHECK/,
    );
    untouched.close();
    assert.ok(existsSync(original));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});


test("a crash before the commit leaves the old table exactly as it was", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-price-floor-crash-"));
  try {
    const path = makeOldDatabase(directory);
    const db = new DatabaseSync(path);
    const before = db.prepare("SELECT id, price_cents FROM creator_support_products ORDER BY id").all();
    const result = migrateCreatorProductPriceFloor(db, {
      beforeCommit() { throw new Error("SYSTEM_TEST_MIGRATION_CRASH"); },
    });
    assert.equal(result.migrated, false);
    assert.equal(result.reason, "failed");
    assert.match(String(result.error), /SYSTEM_TEST_MIGRATION_CRASH/);
    assert.deepEqual(db.prepare("SELECT id, price_cents FROM creator_support_products ORDER BY id").all(), before);
    // The old CHECK is still in force, so nothing half-migrated is readable as new.

test("openDb rebuilds a database an older build wrote, and the rows are still there", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-price-floor-boot-"));
  const path = join(directory, "deployed.sqlite");
  try {
    // A database this build created, then downgraded to the old CHECK the way a deployed file looks.
    const seeded = openDb(path);
    const repo = createRepo(seeded);
    const creator = repo.createUser({ handle: "boot_creator", displayName: "SYSTEM_TEST Boot" });
    repo.ensurePersona(creator.id, "social", { visibility: "public" });
    const product = repo.createCreatorSupportProduct({ creatorId: creator.id, kind: "tip", title: "old price", priceCents: 200 });
    seeded.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      CREATE TABLE creator_support_products_old (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('tip','membership')),
        title TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 100000000),
        currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
        interval_days INTEGER CHECK(interval_days IS NULL OR interval_days BETWEEN 1 AND 366),
        split_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      INSERT INTO creator_support_products_old SELECT id, creator_id, kind, title, price_cents, currency,
        interval_days, split_version, status, created_at FROM creator_support_products;
      DROP TABLE creator_support_products;
      ALTER TABLE creator_support_products_old RENAME TO creator_support_products;
      CREATE INDEX IF NOT EXISTS idx_creator_products_catalog ON creator_support_products(creator_id, status, kind, price_cents);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    seeded.close();

    const reopened = openDb(path);
    assert.equal(reopened.prepare("SELECT title, price_cents FROM creator_support_products WHERE id = ?").get(product.id).title, "old price");
    reopened.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (?, 'tip', 'floor price', 3, 'SPLIT_V3_70_5_4_4_1')").run(creator.id);
    assert.equal(reopened.prepare("SELECT price_cents FROM creator_support_products WHERE title = 'floor price'").get().price_cents, 3);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

    assert.throws(
      () => db.prepare("INSERT INTO creator_support_products (creator_id, kind, title, price_cents, split_version) VALUES (1, 'tip', 'cent', 1, 'SPLIT_V3_70_5_4_4_1')").run(),
      /CHECK/,
    );
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

