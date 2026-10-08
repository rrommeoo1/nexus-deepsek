/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/commentTime.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', code)(moduleShim, moduleShim.exports);
const { commentRelativeTime, commentFullDate } = moduleShim.exports;

test('vârsta comentariului trece prin secunde, minute, ore, zile, luni și ani', () => {
  const now = Date.UTC(2026, 9, 8, 20, 0, 0);
  const seconds = (age) => (now - age * 1000) / 1000;
  assert.equal(commentRelativeTime(seconds(8), now), '8 sec');
  assert.equal(commentRelativeTime(seconds(5 * 60), now), '5 min');
  assert.equal(commentRelativeTime(seconds(2 * 3600), now), '2 h');
  assert.equal(commentRelativeTime(seconds(3 * 86400), now), '3 zile');
  assert.equal(commentRelativeTime(seconds(60 * 86400), now), '2 luni');
  assert.equal(commentRelativeTime(seconds(400 * 86400), now), '1 an');
});

test('data completă include anul și ora numai când este cerută', () => {
  const value = Date.UTC(2026, 9, 8, 20, 15) / 1000;
  assert.match(commentFullDate(value), /2026/);
  assert.match(commentFullDate(value), /\d{2}:\d{2}/);
  assert.equal(commentFullDate(null), '');
});
