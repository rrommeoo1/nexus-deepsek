import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReelLayoutController } from '../public/reel-layout-controller.js';
import { openCameraExitDialog } from '../public/creator-camera-exit.js';

test('the import button clears the camera mode row instead of covering its first chip', () => {
  const css = readFileSync(new URL('../public/reel-camera-surface.css', import.meta.url), 'utf8');
  // Measured on 390x844 at :5000 (2 octombrie 2026): the mode row (CAMERA / CREATE / LIVE / DRAFTS) is
  // 34px tall and sits at `bottom: max(12px, env(safe-area-inset-bottom))`, while the 52px import button
  // used to sit at `bottom: max(17px, ...)` - its box 775..827 crossed the row 798..832 and hid the left
  // half of the first chip. The fix keeps the button on the left, one row above: row height 34px plus a
  // 12px gap. Both numbers are in the same rule, so a regression to the old single `bottom` fails here.
  assert.match(css, /\.reelCameraModes \{[^}]+bottom: max\(12px,env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.reelCamera #cameraGallery \{[^}]+bottom: calc\(max\(12px,env\(safe-area-inset-bottom\)\) \+ 46px\)/);
  assert.doesNotMatch(css, /\.reelCamera #cameraGallery \{[^}]+bottom: max\(17px/);
});

test('legacy camera rules do not turn the layout chooser into a left strip', () => {
  const legacy = readFileSync(new URL('../public/social-human-ux.css', import.meta.url), 'utf8');
  const modern = readFileSync(new URL('../public/reel-camera-surface.css', import.meta.url), 'utf8');
  assert.match(legacy, /\.composerCamera:not\(\.reelCamera\)>div:not\(\.cameraRecovery\):not\(\.cameraActiveBadge\)/);
  assert.match(modern, /\.reelCamera > \.reelCameraLayoutMenu[^}]+left:auto !important; right:53px !important/);
  assert.match(modern, /\.reelCamera\.layoutActive > \.reelCameraLayoutGuide[^}]+display:block !important/);
});

function classes() {
  const values = new Set();
  return {
    contains: (name) => values.has(name),
    add: (name) => values.add(name),
    remove: (name) => values.delete(name),
    toggle: (name, enabled) => enabled ? values.add(name) : values.delete(name),
  };
}

function cameraEnvironment() {
  const priorDocument = globalThis.document;
  const priorWindow = globalThis.window;
  const canvasCalls = [];
  const styleValues = new Map();
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return {
        width: 0, height: 0,
        getContext: () => ({ fillRect() {}, drawImage: (...args) => canvasCalls.push(args) }),
      };
      return {
        type: '', className: '', classList: classes(), style: {}, children: [],
        setAttribute() {}, append(child) { this.children.push(child); },
      };
    },
    getElementById: () => null,
  };
  globalThis.window = { confirm: () => true };
  const camera = { dataset: { layout: 'off', cameraFit: 'fill' }, clientWidth: 400, clientHeight: 800, classList: classes() };
  const video = { videoWidth: 1920, videoHeight: 1080, style: {
    setProperty(key, value) { styleValues.set(key, value); },
    removeProperty(key) { styleValues.delete(key); },
  } };
  const guide = { clientWidth: 400, clientHeight: 800, children: [],
    replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
  };
  const finish = { hidden: true };
  const completed = [];
  const controller = createReelLayoutController({
    camera, video, guide, finish, setState() {},
    async onComplete(frame, name) { completed.push({ frame, name }); },
    onError(error) { throw error; },
  });
  return {
    camera, video, guide, finish, completed, canvasCalls, styleValues, controller,
    restore() { globalThis.document = priorDocument; globalThis.window = priorWindow; },
  };
}

test('layout shows one live cell, captures each cell separately and blocks incomplete output', async () => {
  const env = cameraEnvironment();
  try {
    const { controller, camera, guide, video, finish, completed, styleValues } = env;
    controller.select('grid-four', '');
    assert.equal(camera.classList.contains('layoutActive'), true);
    assert.equal(guide.children.length, 4);
    assert.equal(styleValues.get('width'), '50%');
    assert.equal(styleValues.get('height'), '50%');
    assert.equal(await controller.complete(), false);
    await controller.capture();
    assert.equal(guide.children[0].classList.contains('captured'), true);
    assert.equal(guide.children[1].classList.contains('active'), true);
    assert.equal(styleValues.get('left'), '50%');
    assert.equal(styleValues.get('top'), '0%');
    assert.equal(controller.isComplete(), false);
    for (let index = 0; index < 3; index++) await controller.capture();
    assert.equal(controller.isComplete(), true);
    assert.equal(finish.hidden, false);
    assert.equal(video.style.opacity, undefined);
    assert.equal(await controller.complete(), true);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].name, 'nexus-layout');
    assert.equal(completed[0].frame.width, 1920);
    guide.children[0].onclick();
    assert.equal(controller.isComplete(), false);
    assert.equal(await controller.complete(), false);
    assert.equal(styleValues.get('left'), '0%');
    assert.equal(styleValues.get('top'), '0%');
    await controller.capture();
    assert.equal(controller.isComplete(), true);
  } finally { env.restore(); }
});

test('single photo follows fill crop or fits the whole sensor in a portrait composite', async () => {
  const env = cameraEnvironment();
  try {
    await env.controller.capture();
    assert.equal(env.completed[0].frame.width, 540);
    assert.equal(env.completed[0].frame.height, 1080);
    env.camera.dataset.cameraFit = 'fit';
    await env.controller.capture();
    assert.equal(env.completed[1].frame.width, 1080);
    assert.equal(env.completed[1].frame.height, 1920);
    env.camera.dataset.cameraAspect = '3:4';
    await env.controller.capture();
    assert.equal(env.completed[2].frame.width, 1080);
    assert.equal(env.completed[2].frame.height, 1440);
    const foreground = env.canvasCalls.at(-1);
    assert.deepEqual(foreground.slice(0, 5), [env.video, 0, 0, 1920, 1080]);
  } finally { env.restore(); }
});

test('camera close offers keep, save and discard; failed discard stays open', async () => {
  const priorDocument = globalThis.document;
  const controls = new Map();
  for (const action of ['keep', 'save', 'discard']) controls.set(action, { disabled: false, focus() {} });
  const status = { textContent: '' };
  const dialog = {
    className: '', removed: false, closed: false, listeners: {},
    setAttribute() {},
    querySelector(selector) { return selector === '[role="status"]' ? status : controls.get(selector.match(/data-camera-exit="([^"]+)/)?.[1]); },
    querySelectorAll() { return [...controls.values()]; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    showModal() {}, close() { this.closed = true; }, remove() { this.removed = true; },
  };
  globalThis.document = { querySelector: () => null, createElement: () => dialog, body: { append() {} } };
  try {
    let attempts = 0;
    openCameraExitDialog({ save: async () => {}, discard: async () => { if (++attempts === 1) throw Error('Delete failed'); } });
    controls.get('discard').onclick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dialog.closed, false);
    assert.match(status.textContent, /Delete failed/);
    controls.get('discard').onclick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dialog.closed, true);
    assert.equal(dialog.removed, true);
  } finally { globalThis.document = priorDocument; }
});
