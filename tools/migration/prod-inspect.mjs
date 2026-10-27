#!/usr/bin/env node
/**
 * Fetch one hosted endpoint and summarise it: status, top-level keys, and the shape of the first
 * element of every array. `OUT_DIR` makes it write the raw body to disk for the export run.
 *
 *   NEXUS_PROD_URL=... NEXUS_PROD_TOKEN=... node prod-inspect.mjs "/api/posts/40" [--save]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.env.NEXUS_PROD_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.NEXUS_PROD_TOKEN ?? '';
const OUT_DIR = process.env.NEXUS_EXPORT_DIR ?? '';
const path = process.argv[2];
const save = process.argv.includes('--save');

if (!BASE || !TOKEN || !path) {
  console.error('usage: NEXUS_PROD_URL NEXUS_PROD_TOKEN node prod-inspect.mjs <path> [--save]');
  process.exit(2);
}

const answer = await fetch(`${BASE}${path}`, {
  headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  signal: AbortSignal.timeout(60_000),
});
const text = await answer.text();
console.log(`status=${answer.status} bytes=${text.length} type=${answer.headers.get('content-type')}`);

let body;
try { body = JSON.parse(text); } catch { console.log(text.slice(0, 400)); process.exit(0); }

function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array[${value.length}] of ${shape(value[0], depth + 1)}`;
  if (typeof value === 'object') {
    if (depth > 2) return 'object';
    return `{${Object.entries(value).map(([k, v]) => `${k}: ${shape(v, depth + 1)}`).join(', ')}}`;
  }
  return typeof value;
}
console.log(shape(body));

if (save && OUT_DIR) {
  mkdirSync(OUT_DIR, { recursive: true });
  const name = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(body, null, 2));
  console.log(`saved ${name}.json`);
}
