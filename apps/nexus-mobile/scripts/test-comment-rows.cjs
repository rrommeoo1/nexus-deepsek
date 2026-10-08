/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/commentRows.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', code)(moduleShim, moduleShim.exports);
const { flattenCommentRows, rootCommentRows, focusedCommentRows } = moduleShim.exports;

test('pagina inițială arată doar rădăcinile, cu numărul răspunsurilor', () => {
  const comments = [{ id: 1, parent_id: null, reply_count: 8 }, { id: 2, parent_id: 1 }, { id: 3, parent_id: null }];
  const rows = rootCommentRows(comments);
  assert.deepEqual(rows.map((row) => row.comment.id), [1, 3]);
  assert.equal(rows[0].childCount, 8);
});

test('ecranul unui comentariu nu amestecă alte conversații', () => {
  const comments = [{ id: 1, parent_id: null }, { id: 2, parent_id: 1 }, { id: 3, parent_id: 2 }, { id: 4, parent_id: null }, { id: 5, parent_id: 4 }];
  const rows = focusedCommentRows(comments, 1);
  assert.deepEqual(rows.filter((row) => row.kind === 'comment').map((row) => row.comment.id), [1, 2]);
  assert.equal(rows[0].depth, 0);
  assert.equal(rows[1].kind, 'sort-tabs');
  assert.deepEqual(focusedCommentRows(comments, 2).filter((row) => row.kind === 'comment').map((row) => row.comment.id), [2, 3]);
});

test('toate răspunsurile directe sunt vizibile fără buton Vezi încă', () => {
  const comments = [{ id: 1, parent_id: null, reply_count: 11 }, ...Array.from({ length: 11 }, (_, index) => ({ id: index + 2, parent_id: 1 }))];
  const rows = focusedCommentRows(comments, 1);
  assert.equal(rows.filter((row) => row.kind === 'comment').length, 12);
  assert.equal(rows.some((row) => row.kind === 'toggle'), false);
  assert.equal(rows[0].childCount, 11);
});

test('descendenții sunt în ordine și plafonul inițial este de trei răspunsuri', () => {
  const comments = [{ id: 1, parent_id: null }, ...Array.from({ length: 9 }, (_, index) => ({ id: index + 2, parent_id: 1 }))];
  const rows = flattenCommentRows(comments, {}, {});
  assert.deepEqual(rows.filter((row) => row.kind === 'comment').map((row) => row.comment.id), [1, 2, 3, 4]);
  assert.equal(rows.at(-1).hiddenCount, 6);
  assert.equal(flattenCommentRows(comments, {}, { 1: 6 }).at(-1).hiddenCount, 3);
  assert.equal(flattenCommentRows(comments, { 1: true }, {}).at(-1).hiddenCount, 9);
});

test('patru niveluri și peste 200 comentarii nu produc componente recursive', () => {
  const comments = Array.from({ length: 250 }, (_, index) => ({ id: index + 1, parent_id: index < 4 ? (index === 0 ? null : index) : 1 }));
  const rows = flattenCommentRows(comments, {}, { 1: 300, 2: 300, 3: 300, 4: 300 });
  assert.equal(rows.filter((row) => row.kind === 'comment').length, 250);
  assert.equal(rows.find((row) => row.kind === 'comment' && row.comment.id === 4).depth, 3);
  assert.equal(rows.find((row) => row.kind === 'comment' && row.comment.id === 5).depth, 1);
});

test('referințele ciclice nu ascund comentarii și nu buclează', () => {
  const rows = flattenCommentRows([{ id: 1, parent_id: 2 }, { id: 2, parent_id: 1 }], {}, {});
  assert.equal(rows.filter((row) => row.kind === 'comment').length, 2);
});
