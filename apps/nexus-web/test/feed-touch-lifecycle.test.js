import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { decideSocialGesture } from '../public/social-gesture.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
// Execute the production event wiring against a small bubbling touch harness.
const feedCode = app.slice(app.indexOf('function wireSocialChannelSwipe('), app.indexOf('function wireFeedExposure('));
const globalCode = app.slice(app.indexOf('function bindGlobalPullRefresh('), app.indexOf('function openDeepLinkedPost('));

function fixture() {
  const feedListeners = new Map(), globalListeners = new Map();
  const effects = { feeds: 0, stories: 0, rebuilds: 0, readings: [], pull: null };
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const screen = {
    scrollTop: 0, isConnected: true, dataset: {},
    style: { setProperty: (_, value) => { effects.pull = value; }, removeProperty: () => { effects.pull = null; } },
    classList: { add() {}, remove() {}, contains: (name) => name === 'clipsScreen' },
    setAttribute() {}, removeAttribute() {}, querySelector: () => null,
    addEventListener: (name, handler) => feedListeners.set(name, handler),
  };
  const container = { dataset: {}, scrollTop: 0, closest: () => screen, addEventListener() {} };
  class Target {
    closest(selector) { return selector.includes('.scrollScreen') ? screen : null; }
  }
  const context = { Element: Target, decideSocialGesture, performance: { now: () => 0 },
    loadFeed: () => { effects.feeds++; return pending; },
    loadStories: () => { effects.stories++; return pending; },
    t: (key) => key, currentSocialFeedKey: () => 'for-you', feedMode: 'reels',
    // Wave 14e: the swipe walks the three readings, so the harness walks them the same way app.js does.
    nextFeedMode: (mode, offset) => ['reels', 'whispers', 'news'][(['reels', 'whispers', 'news'].indexOf(mode) + offset + 3) % 3],
    activateFeedMode: (value) => effects.readings.push(value),
    profileLoadGate: { invalidate() {} }, renderHeader() {}, renderView: () => { effects.rebuilds++; },
    document: { createElement: () => { throw new Error('Global handler must delegate feed gestures'); } },
  };
  runInNewContext(`${feedCode}\n${globalCode}`, context);
  context.wireSocialChannelSwipe(container);
  context.bindGlobalPullRefresh({ addEventListener: (name, handler) => globalListeners.set(name, handler) });
  const emit = (name, x = 0, y = 0, fingers = 1) => {
    const point = { identifier: 1, clientX: x, clientY: y };
    const event = { touches: Array(fingers).fill(point), changedTouches: [point], target: new Target() };
    feedListeners.get(name)?.(event);
    globalListeners.get(name)?.(event);
  };
  return { effects, emit, finish, container };
}

test('cancelled or multi-touch feed gestures never refresh or switch readings', () => {
  const f = fixture();
  for (const [x, y] of [[0, 100], [-100, 0]]) {
    f.emit('touchstart'); f.emit('touchmove', x, y); f.emit('touchcancel', x, y);
    f.emit('touchend', x, y);
  }
  f.emit('touchstart'); f.emit('touchmove', 0, 100); f.emit('touchmove', 0, 110, 2); f.emit('touchend', 0, 110);
  f.emit('touchstart', 0, 0, 2); f.emit('touchend', -100, 0);
  assert.deepEqual(f.effects, { feeds: 0, stories: 0, rebuilds: 0, readings: [], pull: null });
});

test('bubbled feed refresh retains the screen and remains single flight; next swipe still works', async () => {
  // Wave 14f: the pull refreshes the column, not the shelf - the shelf of moments is the Messages screen's
  // tray now, and it is not on this screen to be re-asked for. The single-flight rule and the swipe are the
  // same ones they were.
  const f = fixture();
  const pull = () => { f.emit('touchstart'); f.emit('touchmove', 0, 100); f.emit('touchend', 0, 100); };
  pull(); pull();
  assert.equal(f.effects.feeds, 1);
  assert.equal(f.effects.stories, 0, "the shelf is not on the feed screen any more");
  assert.equal(f.effects.rebuilds, 0);
  f.finish(); await new Promise((resolve) => setImmediate(resolve));
  f.emit('touchstart'); f.emit('touchmove', -100, 0); f.emit('touchend', -100, 0);
  assert.deepEqual(f.effects.readings, ['whispers']);
  assert.equal(f.effects.pull, null);
});
