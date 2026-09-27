import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { decideViewerGesture } from '../public/social-gesture.js';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const wiring = source.slice(source.indexOf('  viewer.addEventListener("pointerdown"'), source.indexOf('  const handleViewerVisibility ='));

function fixture() {
  const listeners = new Map(), steps = [];
  let current = true, comments = false, prevented = 0;
  const context = {
    mediaViewerState: { touch: null, pointer: null },
    isCurrentSession: () => current,
    viewer: { addEventListener: (name, listener) => listeners.set(name, listener),
      querySelector: () => comments ? {} : null, setPointerCapture() {} },
    applyViewerGesture(dx, dy) {
      if (!current || comments) return;
      const result = decideViewerGesture({ dx, dy });
      if (result.action === 'step') steps.push(result.offset);
    },
  };
  runInNewContext(wiring, context);
  const emit = (name, { x = 0, y = 0, count = name === 'touchend' ? 0 : 1, id = 1, editing = false } = {}) => {
    const point = { identifier: id, clientX: x, clientY: y };
    listeners.get(name)({ touches: Array(count).fill(point), changedTouches: [point],
      target: { closest: () => editing ? {} : null }, preventDefault: () => { prevented++; },
      pointerType: 'mouse', pointerId: id, clientX: x, clientY: y });
  };
  return { emit, context, steps, prevented: () => prevented,
    setCurrent: (value) => { current = value; }, setComments: (value) => { comments = value; } };
}

test('viewer retains deliberate four-direction continuity and ignores cancelled gestures', () => {
  const f = fixture();
  for (const [x, y] of [[0, -90], [0, 90], [-90, 0], [90, 0]]) {
    f.emit('touchstart'); f.emit('touchmove', { x, y }); f.emit('touchend', { x, y });
  }
  assert.deepEqual(f.steps, [1, -1, 1, -1]);
  f.emit('touchstart'); f.emit('touchmove', { y: -90 }); f.emit('touchcancel'); f.emit('touchend', { y: -90 });
  assert.equal(f.steps.length, 4);
});

test('pinch and unrelated finger endings never advance the viewer', () => {
  const f = fixture();
  f.emit('touchstart'); f.emit('touchmove', { y: -90 }); f.emit('touchstart', { count: 2 });
  f.emit('touchend', { y: -100 });
  f.emit('touchstart'); f.emit('touchmove', { y: -90, count: 2 }); f.emit('touchend', { y: -100 });
  f.emit('touchstart'); f.emit('touchmove', { y: -90 }); f.emit('touchend', { y: -100, id: 2 });
  assert.deepEqual(f.steps, []);
});

test('comment focus cancels the drag without capturing comment scroll or moving after dismissal', () => {
  const f = fixture();
  f.emit('touchstart'); f.setComments(true); f.emit('touchmove', { y: -90 });
  f.setComments(false); f.emit('touchend', { y: -100 });
  f.setComments(true); f.emit('touchstart'); f.emit('touchmove', { y: -90 }); f.emit('touchend', { y: -100 });
  f.setComments(false); f.emit('touchstart', { editing: true }); f.emit('touchend', { y: -100 });
  assert.deepEqual(f.steps, []);
  assert.equal(f.prevented(), 0);
});

test('an old viewer cannot write or clear gesture state belonging to its replacement', () => {
  const f = fixture();
  f.setCurrent(false);
  const replacement = { touch: { id: 8 }, pointer: { id: 9 } };
  f.context.mediaViewerState = replacement;
  for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointerup', 'pointercancel']) f.emit(name);
  assert.deepEqual(replacement, { touch: { id: 8 }, pointer: { id: 9 } });
  assert.deepEqual(f.steps, []);
});
