#!/usr/bin/env node
/**
 * Read-only census of a SQLite database (schema, row counts, identity bindings).
 *
 *   node db-census.mjs <path-to-sqlite>
 *
 * It opens the file read-only, so pointing it at a live database cannot change it.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('usage: node db-census.mjs <path-to-sqlite>');
  process.exit(2);
}

const db = new DatabaseSync(file, { readOnly: true });
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all()
  .map((row) => row.name);

const counts = [];
for (const table of tables) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get();
  counts.push([table, Number(row.n)]);
}
const nonEmpty = counts.filter(([, n]) => n > 0);
console.log(`db=${file}`);
console.log(`tables=${tables.length} non_empty=${nonEmpty.length}`);
for (const [table, n] of nonEmpty.sort((a, b) => b[1] - a[1])) console.log(`  ${table} = ${n}`);

function columns(table) {
  try { return db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table).map((row) => row.name); }
  catch { return []; }
}

for (const table of ['users', 'profiles', 'personas', 'wallet_links', 'identities', 'provider_links', 'auth_identities']) {
  if (!tables.includes(table)) continue;
  console.log(`\n[${table}] columns=${columns(table).join(',')}`);
}
if (tables.includes('users')) {
  const users = db.prepare(`SELECT id, handle, display_name, email, created_at FROM users ORDER BY id`).all();
  console.log(`\nusers (${users.length}):`);
  for (const user of users.slice(0, 40)) console.log(`  #${user.id} ${user.handle} <${user.email ?? '—'}> ${user.created_at}`);
}
db.close();
