import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameraVideoConstraints, requestCameraStream, widenCameraTrack } from '../public/reel-camera-quality.js';
import { bindDraftBackup, serializeDraftWrite } from '../public/creator-draft-sync.js';
import { applyCameraFraming, reelCameraMarkup, syncCameraFraming } from '../public/reel-camera-surface.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('camera requests a detailed portrait or landscape stream without exact-device rejection', () => {
  assert.deepEqual(cameraVideoConstraints('environment', true), {
    facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 },
  });
  assert.equal(cameraVideoConstraints('user', false).width.ideal, 1920);
  assert.equal(cameraVideoConstraints('user', false).facingMode.ideal, 'user');
  const css = source('../public/reel-camera-surface.css');
  assert.match(css, /\.reelCamera > video[^}]+object-fit: cover !important/);
  assert.match(css, /\.reelCamera\[data-camera-fit="fit"\]:not\(\.layoutActive\) > video[^}]+object-fit: contain !important/);
  assert.match(css, /cameraReview #preview \.studioAsset[^}]+object-fit:contain/);
  assert.doesNotMatch(css, /reelCamera\[data-facing="user"\] > video[^}]+scaleX\(-1\)/);
  const controller = source('../public/reel-layout-controller.js');
  assert.doesNotMatch(controller, /context\.filter = video\.style\.filter/);
  assert.match(controller, /coverSourceRect\(video\.videoWidth, video\.videoHeight, aspect \* 1000, 1000\)/);
  assert.match(source('../public/post-publishing.css'), /clipStage \.studioMedia\.aspectOriginal \.studioAsset\{object-fit:contain/);
});

test('the camera request stays plain, so no constraint can crop the sensor away', () => {
  // 1.02-1.04 asked for the screen's own aspect with `resizeMode: "crop-and-scale"`. Measured on a 4:3 sensor that
  // either crops the sensor to that sliver or is ignored - and a source crop cuts exactly the slice
  // `object-fit: cover` cuts anyway, so it can never widen the field of view. Worse, when it is honoured the whole
  // wall never reaches the preview at all. The request is plain again, and the framing decision moved into the
  // preview, where the creator sees it, the sensor note reports it and one tap undoes it.
  const quality = source('../public/reel-camera-quality.js');
  // The comment in that file explains the removal, so the assertions read the code: no shaped constraint survives.
  assert.doesNotMatch(quality, /export function cameraShapedConstraints/);
  assert.doesNotMatch(quality, /cameraShapedConstraints\(facingMode/);
  assert.equal(Object.hasOwn(cameraVideoConstraints('environment', true), 'resizeMode'), false);
  assert.equal(Object.hasOwn(cameraVideoConstraints('environment', true), 'aspectRatio'), false);
  assert.deepEqual(cameraVideoConstraints('environment', true), {
    facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 },
  });
  assert.equal(cameraVideoConstraints('user', false).width.ideal, 1920);
  assert.equal(cameraVideoConstraints('user', false).facingMode.ideal, 'user');
  assert.match(quality, /export async function requestCameraStream\(facingMode, portrait, media = navigator\.mediaDevices\)/);
  assert.match(quality, /media\.getUserMedia\(\{ video: cameraVideoConstraints\(facingMode, portrait\), audio: false \}\)/);
  assert.match(quality, /export async function widenCameraTrack\(track\)/);
  assert.match(quality, /applyConstraints\(\{ advanced: \[\{ zoom: range\.min \}\] \}\)/);
  // app.js stays inside its own transfer budget: the camera request and the framing rule live in modules, and the
  // entry file only says which surface is being filled.
  const app = source('../public/app.js');
  assert.match(app, /await requestCameraStream\(facingMode, portrait\)/);
  assert.match(app, /await widenCameraTrack\(videoTrack\)/);
  assert.match(app, /syncCameraFraming\(video, camera\)/);
  const css = source('../public/reel-camera-surface.css');
  assert.match(css, /\.reelCamera > video[^}]+object-fit: cover !important/);
  assert.match(css, /\.reelCamera\[data-camera-fit="fit"\]:not\(\.layoutActive\) > video[^}]+object-fit: contain !important/);
  assert.match(css, /cameraReview #preview \.studioAsset[^}]+object-fit:contain/);
  assert.doesNotMatch(css, /reelCamera\[data-facing="user"\] > video[^}]+scaleX\(-1\)/);
  const controller = source('../public/reel-layout-controller.js');
  assert.doesNotMatch(controller, /context\.filter = video\.style\.filter/);
  assert.match(controller, /coverSourceRect\(video\.videoWidth, video\.videoHeight, aspect \* 1000, 1000\)/);
  assert.match(source('../public/post-publishing.css'), /clipStage \.studioMedia\.aspectOriginal \.studioAsset\{object-fit:contain/);
});

test('a plain request asks for a portrait or landscape stream and never swallows a denial', async () => {
  const calls = [];
  const media = { getUserMedia: async (constraints) => { calls.push(constraints); return 'stream'; } };
  assert.equal(await requestCameraStream('environment', true, media), 'stream');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].video.width.ideal, 1080);
  assert.equal(calls[0].video.height.ideal, 1920);
  assert.equal(calls[0].video.facingMode.ideal, 'environment');
  assert.equal(Object.hasOwn(calls[0].video, 'resizeMode'), false, 'nothing shapes or crops the sensor');
  assert.equal(Object.hasOwn(calls[0].video, 'aspectRatio'), false);
  // A refused permission is never retried behind the creator's back: the camera screen has to say what happened.
  const denied = { getUserMedia: async () => { const error = new Error('permisiune refuzată'); error.name = 'NotAllowedError'; throw error; } };
  await assert.rejects(() => requestCameraStream('environment', true, denied), /permisiune refuzată/);
});

test('a track that already carries a digital zoom is widened before the preview starts', async () => {
  const applied = [];
  const zoomed = { getCapabilities: () => ({ zoom: { min: 1, max: 8, step: 0.1 } }), applyConstraints: async (value) => { applied.push(value); } };
  await widenCameraTrack(zoomed);
  assert.deepEqual(applied, [{ advanced: [{ zoom: 1 }] }]);
  // A track without zoom support is left exactly as it is, and a missing track does not throw.
  await widenCameraTrack({ getCapabilities: () => ({}), applyConstraints: async () => { throw new Error('nu se cheamă'); } });
  await widenCameraTrack(undefined);
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
  assert.equal(backup.hasPending(), true);
  form.emit('input', { type: 'text' });
  release();
  assert.equal(await backup.flush(), true);
  assert.deepEqual(writes, [1, 2]);
  assert.equal(form.status.textContent, 'Draft salvat pe acest dispozitiv.');
  assert.equal(backup.hasPending(), false);
  assert.equal(timers.size, 0);
});

test('failed draft writes remain visibly unsaved and can be retried', async () => {
  const form = fakeForm(); let attempts = 0;
  const backup = bindDraftBackup(form, () => true, async () => { if (++attempts === 1) throw Error('quota'); });
  form.emit('input', { type: 'text' });
  await assert.rejects(backup.flush(), /quota/);
  assert.match(form.status.textContent, /nu a fost salvat/);
  assert.equal(backup.hasPending(), true);
  assert.equal(await backup.flush(), true);
  assert.equal(attempts, 2);
  assert.equal(backup.hasPending(), false);
});

test('explicit discard suspends queued automatic draft writes', async () => {
  const form = fakeForm(); let writes = 0; const timers = new Map(); let nextId = 0;
  const backup = bindDraftBackup(form, () => true, async () => { writes++; }, {
    setTimer(fn) { timers.set(++nextId, fn); return nextId; },
    clearTimer(id) { timers.delete(id); },
  });
  form.emit('input', { type: 'text' });
  assert.equal(timers.size, 1);
  backup.suspend();
  assert.equal(timers.size, 0);
  assert.equal(await backup.flush(), false);
  assert.equal(writes, 0);
  backup.resume();
  assert.equal(timers.size, 1);
  assert.equal(await backup.flush(), true);
  assert.equal(writes, 1);
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

test('reload warns while creator changes are unsaved and backgrounding starts a flush', () => {
  const app = source('../public/app.js');
  assert.match(app, /window\.addEventListener\('beforeunload', \(event\) => \{[\s\S]{0,180}activeDraftBackup\.hasPending\(\)/);
  assert.match(app, /event\.preventDefault\(\);\s*event\.returnValue = ''/);
  assert.match(app, /document\.hidden && activeDraftBackup\?\.hasPending\(\)\) activeDraftBackup\.flush\(\)/);
});
