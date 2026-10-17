#!/usr/bin/env node
/**
 * Fails if a user-visible string still says "Nexus".
 *
 * The product is Jungle Book. A handful of identifiers keep the old spelling on purpose, because
 * renaming them would break installed apps, sessions or the API: the Android package, the deep-link
 * scheme, the Expo slug, the storage keys, the cookie and header names, the API paths, the
 * environment variables and the upload MIME type. Those are listed below with the reason they stay.
 *
 * What is scanned: every string literal and every JSX text node in apps/nexus-mobile/src. What is
 * not: comments, identifiers and paths (a string containing `apps/nexus-web/...` documents where a
 * port came from and never reaches a screen).
 *
 * Usage: node scripts/test-brand.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const APP_JSON = path.join(ROOT, 'app.json');

/** Strings that may contain "nexus" without being visible to a reader, with the reason. */
const EXCEPTIONS = [
  { pattern: /^apps\/nexus-web\//, reason: 'reference to the web sources a screen was ported from' },
  { pattern: /^\.\.?\//, reason: 'module specifier (import path), never drawn' },
  { pattern: /^https:\/\/nexus-[a-z-]+\.up\.railway\.app$/, reason: 'the deployed API origin' },
  { pattern: /^\[Nexus camera\]/, reason: '__DEV__ console prefix, never drawn' },
  { pattern: /nexus_session/i, reason: 'session cookie and its header form' },
  { pattern: /^nexus-prefs$/, reason: 'local storage key; renaming it would lose saved preferences' },
  { pattern: /^nexus-session$/, reason: 'on-device session directory' },
  { pattern: /^nexus-(mobile|upload|camera)/, reason: 'request id, upload/scratch directory or cache key' },
  { pattern: /^nexus-upload-v1:/, reason: 'upload deduplication key' },
  { pattern: /^application\/vnd\.nexus\.e2ee$/, reason: 'upload MIME type understood by the server' },
  { pattern: /^nexus$/, reason: 'upload kind value paired with the MIME type above' },
  { pattern: /^nexus_/, reason: 'storage/header identifier' },
  { pattern: /^NEXUS_/, reason: 'environment or build identifier' },
  { pattern: /^--nexus-/, reason: 'CSS custom property carried over from the web theme' },
  { pattern: /\/api\//, reason: 'API path' },
  { pattern: /nexus-dev/i, reason: 'local development script name' },
];

function isException(value) {
  return EXCEPTIONS.some((entry) => entry.pattern.test(value));
}

function literalValues(line) {
  const values = [];
  const literal = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let match;
  while ((match = literal.exec(line)) !== null) {
    values.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  // JSX text between a closing and an opening tag, e.g. <Text>Nexus</Text>.
  const jsx = />([^<>{}]+)</g;
  while ((match = jsx.exec(line)) !== null) {
    const text = match[1].trim();
    if (text) values.push(text);
  }
  return values;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const failures = [];
for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    for (const value of literalValues(line)) {
      if (!/nexus/i.test(value)) continue;
      if (isException(value)) continue;
      failures.push(`${path.relative(ROOT, file)}:${index + 1}  ${value.trim()}`);
    }
  });
}

const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
if (!String(app.expo.name).startsWith('Jungle Book')) {
  failures.push(`app.json  expo.name is "${app.expo.name}", expected "Jungle Book…"`);
}

if (failures.length) {
  console.error('Visible strings still carrying the old name:');
  for (const failure of failures) console.error('  ' + failure);
  console.error(`\n${failures.length} occurrence(s). Rename them to Jungle Book, or document why the string`);
  console.error('is technical in apps/nexus-mobile/scripts/test-brand.cjs (EXCEPTIONS).');
  process.exit(1);
}

console.log('ok · no visible "Nexus" left in src/, and app.json is named Jungle Book');
