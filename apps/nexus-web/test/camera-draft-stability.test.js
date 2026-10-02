import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameraVideoConstraints } from '../public/reel-camera-quality.js';
import { bindDraftBackup, serializeDraftWrite } from '../public/creator-draft-sync.js';
import { reelCameraMarkup } from '../public/reel-camera-surface.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('camera requests a detailed portrait or landscape stream without exact-device rejection', () => {
  assert.deepEqual(cameraVideoConstraints('environment', true), {
    facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 },
  });
  assert.equal(cameraVideoConstraints('user', false).width.ideal, 1920);
  assert.equal(cameraVideoConstraints('user', false).facingMode.ideal, 'user');
  const css = source('../public/reel-camera-surface.css');
  assert.match(css, /\.reelCamera > video[^}]+object-fit: contain !important/);
  assert.match(css, /cameraReview #preview \.studioAsset[^}]+object-fit:contain/);
  assert.doesNotMatch(css, /reelCamera\[data-facing="user"\] > video[^}]+scaleX\(-1\)/);
  const controller = source('../public/reel-layout-controller.js');
  assert.doesNotMatch(controller, /context\.filter = video\.style\.filter/);
  assert.match(source('../public/post-publishing.css'), /clipStage \.studioMedia\.aspectOriginal \.studioAsset\{object-fit:contain/);
});

test('video mode favors usable bitrate over a hidden ten-minute recording profile', () => {
  const markup = reelCameraMarkup({ esc: String, t: String, clipMode: true });
  assert.match(markup, /data-camera-duration="60"/);
  assert.doesNotMatch(markup, /data-camera-duration="600"/);
  assert.match(source('../public/app.js'), /camera\.dataset\.cameraDuration = "60"/);
});

function fakeForm() {
  const handlers = new Map();
  const status = { textContent: '' };
  const submit = { disabled: false };
  return {
    status, submit,
    addEventListener(name, fn) { handlers.set(name, fn); },
    querySelector(selector) { return selector === '[data-draft-status]' ? status : submit; },
    emit(name, target) { handlers.get(name)?.({ target }); },
  };
}

test('captured media saves immediately; later edits are retained after an in-flight write', async () => {
  const form = fakeForm(); const writes = []; const timers = new Map(); let nextId = 0;
  let release;
  const backup = bindDraftBackup(form, () => true, async () => {
    writes.push(writes.length + 1);
    if (writes.length === 1) await new Promise((resolve) => { release = resolve; });
  }, {
    setTimer(fn) { timers.set(++nextId, fn); return nextId; },
    clearTimer(id) { timers.delete(id); },
  });
  form.emit('change', { type: 'file' });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(writes, [1]);
  form.emit('input', { type: 'text' });
  release();
  assert.equal(await backup.flush(), true);
  assert.deepEqual(writes, [1, 2]);
  assert.equal(form.status.textContent, 'Draft salvat pe acest dispozitiv.');
  assert.equal(timers.size, 0);
});

test('failed draft writes remain visibly unsaved and can be retried', async () => {
  const form = fakeForm(); let attempts = 0;
  const backup = bindDraftBackup(form, () => true, async () => { if (++attempts === 1) throw Error('quota'); });
  form.emit('input', { type: 'text' });
  await assert.rejects(backup.flush(), /quota/);
  assert.match(form.status.textContent, /nu a fost salvat/);
  assert.equal(await backup.flush(), true);
  assert.equal(attempts, 2);
});

test('draft writes for one editor execute in order even when requested together', async () => {
  const form = {}; const order = []; let release;
  const first = serializeDraftWrite(form, async () => { order.push('start first'); await new Promise((resolve) => { release = resolve; }); order.push('end first'); });
  const second = serializeDraftWrite(form, async () => { order.push('second'); });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(order, ['start first']);
  release(); await Promise.all([first, second]);
  assert.deepEqual(order, ['start first', 'end first', 'second']);
});

test('description thumbnail is not an exit target; leaving preview waits for draft persistence', () => {
  const publishing = source('../public/post-publishing.js');
  const review = source('../public/reel-camera-review.js');
  assert.match(publishing, /<div class="publishThumbnail"/);
  assert.doesNotMatch(publishing, /<button[^>]+class="publishThumbnail"[^>]+data-return-preview/);
  assert.match(review, /beforeNext && !await beforeNext\(\)/);
});
