import test from 'node:test';
import assert from 'node:assert/strict';
import { bindProfilePullRefresh } from '../public/profile-experience.js';

function fixture(refresh) {
  const handlers = new Map();
  const screen = { scrollTop: 0, isConnected: true,
    classList: { remove() {}, toggle() {} },
    addEventListener(name, handler) { handlers.set(name, handler); } };
  bindProfilePullRefresh(screen, refresh);
  const emit = (name, x = 0, y = 0, count = 1, editing = false) => handlers.get(name)({
    touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
    target: { closest: () => editing ? {} : null },
  });
  const pull = () => { emit('touchstart'); emit('touchmove', 0, 100); return emit('touchend'); };
  return { screen, emit, pull };
}

test('profile pull refresh sends one request while pending and allows the next completed gesture', async () => {
  let calls = 0, release;
  const f = fixture(() => { calls++; return new Promise((resolve) => { release = resolve; }); });
  const first = f.pull();
  await f.pull();
  assert.equal(calls, 1);
  release(); await first;
  const next = f.pull();
  assert.equal(calls, 2);
  release(); await next;
});

test('profile pull preserves editing, horizontal gestures, multi-touch, scroll and abandoned screens', async () => {
  let calls = 0;
  const f = fixture(() => { calls++; });
  f.emit('touchstart', 0, 0, 1, true); f.emit('touchmove', 0, 100); await f.emit('touchend');
  f.emit('touchstart'); f.emit('touchmove', 200, 100); await f.emit('touchend');
  f.emit('touchstart'); f.emit('touchmove', 0, 100); f.emit('touchmove', 0, 110, 2); await f.emit('touchend');
  f.screen.scrollTop = 10; await f.pull(); f.screen.scrollTop = 0;
  f.emit('touchstart'); f.emit('touchmove', 0, 100); f.emit('touchcancel'); await f.emit('touchend');
  f.emit('touchstart'); f.emit('touchmove', 0, 100); f.screen.isConnected = false; await f.emit('touchend');
  assert.equal(calls, 0);
  f.screen.isConnected = true; await f.pull();
  assert.equal(calls, 1);
});
