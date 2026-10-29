/* global __dirname */
// The files Metro parses as JSON must be plain UTF-8, without a byte order mark.
//
// Metro reads `package.json` with a bare `JSON.parse(readFileSync(file, 'utf8'))`
// (`metro/src/node-haste/PackageCache.js`), so three bytes in front of the `{` make **every** bundle
// request fail — the dev client then shows a grey screen while the backend, Metro itself and the
// static checks all look healthy. `node`, `npm` and `tsc` keep working because Node's loader strips
// the mark, which is why no existing test noticed. That is exactly what happened on 29 October 2026
// (`HANDOFF.md` §0.38): `apps/nexus-mobile/package.json` was saved as UTF-8-with-BOM, the bundle
// answered `500 InternalError: Unexpected token '', ... is not valid JSON`, and Jungle Book stopped
// opening on the phone.
//
// This test asserts two things and nothing else: no BOM in the JSON files Metro and Expo read, and
// `package.json` surviving the *same* call Metro makes. Run: node scripts/test-package-encoding.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
// `package.json` is the fatal one (Metro's PackageCache); `app.json` and `tsconfig.json` are read by
// Expo's config resolution with the same plain JSON.parse, so they are held to the same rule.
const JSON_FILES = ['package.json', 'app.json', 'tsconfig.json'];

test('no JSON file Metro reads starts with a UTF-8 byte order mark', () => {
  for (const name of JSON_FILES) {
    const bytes = readFileSync(join(ROOT, name));
    const hasBom = bytes.subarray(0, BOM.length).equals(BOM);
    assert.equal(
      hasBom,
      false,
      `${name} starts with a UTF-8 BOM (bytes EF BB BF). Metro cannot JSON.parse it and the app opens ` +
        'on a grey screen. Save the file as "UTF-8" (no BOM).',
    );
  }
});

test('package.json parses with the call Metro makes', () => {
  // Not `require()`: that would strip the BOM and hide the defect again.
  const parsed = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(parsed.name, 'nexus-mobile');
  assert.equal(parsed.main, 'expo-router/entry');
  assert.match(parsed.scripts.test, /node scripts\//, 'the test chain is gone');
  assert.match(
    parsed.scripts.test,
    /node scripts\/test-package-encoding\.cjs/,
    'this guard must stay in the test chain, otherwise a future BOM passes unnoticed',
  );
});
