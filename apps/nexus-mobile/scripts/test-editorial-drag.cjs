/* global __dirname */
// Cross-page media dragging: the gesture machine, the margins that turn pages, and the drop that lands.
//
// The owner asked for a picture to be moved between distant pages of a long article, with the article
// paging while the finger is held at a margin, and without a vertical drag ever being mistaken for the
// profile's own swipe navigation. This suite reads the machine as numbers and the component as source, and
// leaves the physical pass to the Xiaomi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const load = (file) => {
  const code = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, () => ({}));
  return moduleShim.exports;
};

const drag = load('src/lib/editorialDrag.ts');
const page = readFileSync(resolve(ROOT, 'src/components/EditorialPage.tsx'), 'utf8');
const pageCode = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('the machine walks reading, editing, a chosen picture, a drag, an edge and a drop', () => {
  const idle = drag.editorialGestureIdle;
  assert.equal(idle.state, 'READING');

  const editing = drag.editorialGesture(idle, { type: 'edit' });
  assert.equal(editing.state, 'EDITING');

  const chosen = drag.editorialGesture(editing, { type: 'select', blockId: 'm-1', page: 2 });
  assert.equal(chosen.state, 'MEDIA_SELECTED');
  assert.equal(chosen.blockId, 'm-1');
  assert.equal(chosen.page, 2);

  const dragging = drag.editorialGesture(chosen, { type: 'begin', blockId: 'm-1', page: 2 });
  assert.equal(dragging.state, 'MEDIA_DRAGGING');

  const held = drag.editorialGesture(dragging, { type: 'move', dx: 40, dy: 10, edge: 'right' });
  assert.equal(held.state, 'EDGE_PAGING');
  assert.equal(held.edge, 'right');

  const released = drag.editorialGesture(held, { type: 'release' });
  assert.equal(released.state, 'DROP');
  assert.equal(released.page, 2);

  assert.equal(drag.editorialGesture(released, { type: 'clear' }).state, 'READING');
});

test('an event the state cannot mean changes nothing', () => {
  const idle = drag.editorialGestureIdle;
  assert.equal(drag.editorialGesture(idle, { type: 'dwell', pages: 10 }), idle, 'no dwell without a drag');
  assert.equal(drag.editorialGesture(idle, { type: 'release' }), idle, 'no release without a drag');
  assert.equal(drag.editorialGesture(idle, { type: 'move', dx: 5, dy: 5, edge: 'left' }), idle, 'no move without a drag');

  const chosen = drag.editorialGesture(idle, { type: 'select', blockId: 'm-2', page: 1 });
  assert.equal(drag.editorialGesture(chosen, { type: 'edit' }).state, 'EDITING', 'a caret may replace a selection');
  const dragging = drag.editorialGesture(chosen, { type: 'begin', blockId: 'm-2', page: 1 });
  assert.equal(drag.editorialGesture(dragging, { type: 'select', blockId: 'm-3', page: 1 }).blockId, 'm-2', 'a drag is not interrupted by a selection');
  assert.equal(drag.editorialGesture(dragging, { type: 'edit' }).state, 'MEDIA_DRAGGING');
});

test('the margin turns one page per dwell, and never past either end of the article', () => {
  const dragging = drag.editorialGesture(drag.editorialGestureIdle, { type: 'begin', blockId: 'm-1', page: 0 });
  const atEdge = drag.editorialGesture(dragging, { type: 'move', dx: 0, dy: 0, edge: 'right' });

  const first = drag.editorialGesture(atEdge, { type: 'dwell', pages: 6 });
  assert.deepEqual([first.page, first.turned, first.state], [1, 1, 'EDGE_PAGING']);
  const second = drag.editorialGesture(first, { type: 'dwell', pages: 6 });
  assert.deepEqual([second.page, second.turned], [2, 2]);

  assert.equal(drag.editorialGesture({ ...second, page: 5 }, { type: 'dwell', pages: 6 }).page, 5, 'the last page has no next page');
  assert.equal(drag.editorialGesture({ ...atEdge, page: 0, edge: 'left' }, { type: 'dwell', pages: 6 }).page, 0, 'the first page has no previous page');

  const back = drag.editorialGesture({ ...atEdge, page: 3, edge: 'left' }, { type: 'dwell', pages: 6 });
  assert.deepEqual([back.page, back.turned], [2, 1]);
});

test('leaving the margin disarms the dwell without moving the picture', () => {
  const dragging = drag.editorialGesture(drag.editorialGestureIdle, { type: 'begin', blockId: 'm-1', page: 4 });
  const atEdge = drag.editorialGesture(dragging, { type: 'move', dx: 30, dy: 20, edge: 'left' });
  const inside = drag.editorialGesture(atEdge, { type: 'move', dx: 32, dy: 22, edge: null });
  assert.equal(inside.state, 'MEDIA_DRAGGING');
  assert.equal(inside.edge, null);
  assert.deepEqual([inside.dx, inside.dy], [32, 22], 'the picture keeps the offsets the finger gave it');
  assert.equal(drag.editorialGesture(inside, { type: 'dwell', pages: 9 }).page, 4, 'no page turns without an edge');
});

test('a margin is a band of points on the page, not a guess about the finger', () => {
  assert.equal(drag.EDITORIAL_EDGE_BAND, 56);
  assert.equal(drag.EDITORIAL_EDGE_DWELL_MS, 600);
  assert.equal(drag.editorialEdge(10, 360), 'left');
  assert.equal(drag.editorialEdge(56, 360), 'left', 'the band includes its own edge');
  assert.equal(drag.editorialEdge(180, 360), null);
  assert.equal(drag.editorialEdge(304, 360), 'right');
  assert.equal(drag.editorialEdge(400, 360), 'right', 'past the page is still the right margin');
  assert.equal(drag.editorialEdge(10, 0), null, 'an unmeasured page has no margins');
});

test('the drop line is the article axis of the page the pager is showing', () => {
  assert.equal(drag.editorialDropLine(0, 700, 120), 120);
  assert.equal(drag.editorialDropLine(3, 700, 120), 2220);
  assert.equal(drag.editorialDropLine(-2, 700, 10), 10);
});

test('the page machine is what turns the composer article, and what the drop is measured from', () => {
  assert.match(pageCode, /const moveGesture = useCallback\(\(event: Parameters<typeof editorialGesture>\[1\]\) => \{/);
  assert.match(pageCode, /moveGesture\(\{ type: 'begin', blockId, page: current, dx: 0, dy: 0 \}\)/);
  assert.match(pageCode, /moveGesture\(\{ type: 'move', dx, dy, edge: editorialEdge\(Number\(moveX\) - frameOrigin\.current\.x, width\) \}\)/);
  // The dwell is armed by the edge, so leaving the band before it elapses turns nothing.
  assert.match(pageCode, /if \(gesture\.state !== 'EDGE_PAGING' \|\| !gesture\.edge\) return;/);
  assert.match(pageCode, /const next = editorialGesture\(gestureRef\.current, \{ type: 'dwell', pages: total \}\);/);
  assert.match(pageCode, /\}, EDITORIAL_EDGE_DWELL_MS\);/);
  assert.match(pageCode, /listRef\.current\?\.scrollToIndex\(\{ index: next\.page, animated: false \}\);/);
  // The drop lands where the article stands when the finger lets go, not where the picture started.
  assert.match(pageCode, /dropMedia\(blockId, box, dx, dy, landedOn\);/);
  assert.match(pageCode, /const dropY = editorialDropLine\(pageOnScreen, height, box\.y \+ dy \+ box\.height \/ 2\);/);
  // The finger's own place on the screen is what the margins are read against.
  assert.match(pageCode, /frame\.current\?\.measureInWindow\(\(x, y\) => \{ frameOrigin\.current = \{ x, y \}; \}\);/);
  assert.match(pageCode, /doors\.current\.onDragMove\(gesture\.dx, gesture\.dy, gesture\.moveX\);/);
});

