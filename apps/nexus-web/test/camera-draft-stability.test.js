import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameraVideoConstraints, requestCameraStream, widenCameraTrack, alignCameraTrack, cameraFrameSize, findUltraWideCamera, openCameraPresetStream, setCameraZoom } from '../public/reel-camera-quality.js';
import { createFramedCameraStream, framedCameraCrop } from '../public/bounded-recording.js';
import { bindDraftBackup, serializeDraftWrite } from '../public/creator-draft-sync.js';
import { applyCameraPreset, reelCameraMarkup, syncCameraFraming } from '../public/reel-camera-surface.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Android camera handoff cannot bypass an unsaved composer draft', () => {
  const app = source('../public/app.js');
  const start = app.indexOf('function openComposer(mode = "post", options = {})');
  const end = app.indexOf('activeCameraExit = null;', start);
  assert.ok(start >= 0 && end > start);
  const entry = app.slice(start, end);
  const cameraExit = entry.indexOf('requestActiveCameraExit()');
  const draftExit = entry.indexOf('composerExit?.request(');
  const nativeHandoff = entry.indexOf('requestNativeCamera(');
  assert.ok(cameraExit >= 0 && cameraExit < nativeHandoff);
  assert.ok(draftExit >= 0 && draftExit < nativeHandoff);
});

test('camera requests the sensor itself in the arrangement the phone is held, without exact-device rejection', () => {
  assert.deepEqual(cameraVideoConstraints('environment', true), {
    facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 }, zoom: { ideal: .7 }, resizeMode: 'none',
  });
  assert.equal(cameraVideoConstraints('environment', true, '3:4').height.ideal, 1440);
  assert.equal(cameraVideoConstraints('user', false).width.ideal, 1920);
  assert.equal(cameraVideoConstraints('user', false).height.ideal, 1080);
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

test('the camera request prefers native, uncropped modes without a hard aspect constraint', () => {
  // Earlier releases used crop-and-scale. The new default requests 1080x1920 with resizeMode:none;
  // 3:4 requests 1080x1440. A landscape-only answer stays whole over a blurred backdrop.
  const quality = source('../public/reel-camera-quality.js');
  // The comment in that file explains the removal, so the assertions read the code: no shaped constraint survives.
  assert.doesNotMatch(quality, /export function cameraShapedConstraints/);
  assert.doesNotMatch(quality, /cameraShapedConstraints\(facingMode/);
  assert.equal(cameraVideoConstraints('environment', true).resizeMode, 'none');
  assert.equal(Object.hasOwn(cameraVideoConstraints('environment', true), 'aspectRatio'), false);
  assert.deepEqual(cameraVideoConstraints('environment', true), {
    facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 }, zoom: { ideal: .7 }, resizeMode: 'none',
  });
  assert.equal(cameraVideoConstraints('environment', true, '3:4').height.ideal, 1440);
  assert.equal(cameraVideoConstraints('user', false).width.ideal, 1920);
  assert.equal(cameraVideoConstraints('user', false).facingMode.ideal, 'user');
  assert.match(quality, /export async function requestCameraStream\(facingMode, portrait, media = navigator\.mediaDevices, aspect = '9:16', deviceId = ''\)/);
  assert.match(quality, /media\.getUserMedia\(\{ video, audio: false \}\)/);
  assert.match(quality, /export async function widenCameraTrack\(track\)/);
  assert.match(quality, /applyConstraints\(\{ advanced: \[\{ zoom: requested \}\] \}\)/);
  // A phone that answers a portrait request with a landscape mode is asked once more for the held arrangement, and
  // the mode it already had is put back when the phone cannot - the attempt can never cost resolution.
  assert.match(quality, /export async function alignCameraTrack\(track, \{ portrait = false, aspect = '9:16' \} = \{\}\)/);
  assert.match(quality, /track\.applyConstraints\(cameraVideoConstraints\(before\.facingMode \|\| 'environment', true, aspect\)\)/);
  assert.match(quality, /applyConstraints\(\{ width: \{ ideal: before\.width \}, height: \{ ideal: before\.height \} \}\)/);
  // app.js stays inside its own transfer budget: the camera request and the framing rule live in modules, and the
  // entry file only says which surface is being filled.
  const app = source('../public/app.js');
  assert.match(app, /await openCameraPresetStream\(facingMode, portrait, preset, navigator\.mediaDevices, selectedDevice\)/);
  assert.match(app, /const portrait = cameraSurfaceIsPortrait\(camera\)/);
  assert.match(app, /markCameraRequest\(camera, facingMode, portrait\)/);
  // The held arrangement and the request label live in the surface module: the section decides the first only when
  // it has been laid out, and the note prints the second next to what the phone actually answered.
  const surface = source('../public/reel-camera-surface.js');
  assert.match(surface, /export function cameraSurfaceIsPortrait\(camera\) \{[\s\S]{0,120}\(camera\?\.clientHeight \|\| window\.innerHeight\) > \(camera\?\.clientWidth \|\| window\.innerWidth\)/);
  assert.match(surface, /export function markCameraRequest\(camera, facingMode, portrait\)/);
  assert.match(surface, /camera\.dataset\.cameraRequest = asked\.width\.ideal/);
  assert.match(app, /showCameraPresetStatus\(camera, \{ facingMode, lens: opened\.lens, zoom: opened\.zoom, resizeMode:/);
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
  assert.equal(calls[0].video.resizeMode, 'none', 'the browser is asked not to crop or scale the camera source');
  assert.equal(Object.hasOwn(calls[0].video, 'aspectRatio'), false);
  // A refused permission is never retried behind the creator's back: the camera screen has to say what happened.
  const denied = { getUserMedia: async () => { const error = new Error('permisiune refuzată'); error.name = 'NotAllowedError'; throw error; } };
  await assert.rejects(() => requestCameraStream('environment', true, denied), /permisiune refuzată/);
});

test('a landscape answer to a portrait request is asked once more, and never at the cost of resolution', async () => {
  const trace = [];
  // Already portrait: nothing to ask, nothing applied.
  const settled = { getSettings: () => ({ width: 1080, height: 1920 }), applyConstraints: async (constraints) => { trace.push(constraints); } };
  assert.equal(await alignCameraTrack(settled, { portrait: true }), null);
  assert.deepEqual(trace, []);
  // A landscape screen keeps the landscape mode: the phone is held that way.
  const wide = { getSettings: () => ({ width: 1920, height: 1080 }), applyConstraints: async () => { throw new Error('must not be called'); } };
  assert.equal(await alignCameraTrack(wide, { portrait: false }), null);
  // A portrait phone whose browser agrees: the portrait settings come back.
  const mode = { width: 1920, height: 1080, facingMode: 'environment' };
  const agrees = {
    getSettings: () => ({ ...mode }),
    applyConstraints: async (constraints) => {
      trace.push(constraints);
      if (constraints.height?.ideal === 1920) { mode.width = 1080; mode.height = 1920; }
    },
  };
  assert.deepEqual(await alignCameraTrack(agrees, { portrait: true }), { width: 1080, height: 1920, facingMode: 'environment' });
  assert.equal(trace.length, 1, 'one polite question, no loop');
  assert.deepEqual(trace[0].width, { ideal: 1080 });
  assert.deepEqual(trace[0].height, { ideal: 1920 });
  // A portrait phone whose browser refuses: the mode it already had is put back, so nothing is lost.
  trace.length = 0;
  const refuses = { getSettings: () => ({ width: 1920, height: 1080 }), applyConstraints: async (constraints) => { trace.push(constraints); } };
  assert.equal(await alignCameraTrack(refuses, { portrait: true }), null);
  assert.deepEqual(trace, [
    { facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 }, zoom: { ideal: .7 }, resizeMode: 'none' },
    { width: { ideal: 1920 }, height: { ideal: 1080 } },
  ]);
  // A browser that throws is just as harmless.
  const broken = { getSettings: () => ({ width: 1920, height: 1080 }), applyConstraints: async () => { throw new Error('not supported'); } };
  assert.equal(await alignCameraTrack(broken, { portrait: true }), null);
});

test('a clip records the framed centre of the frame, and the whole track when nothing is cut', () => {
  // The owner's phone on his own screen: a 1920x1080 frame on a 469x860 surface keeps the middle 589 columns.
  assert.deepEqual(framedCameraCrop(1920, 1080, 469, 860), { sx: 666, sy: 0, sw: 589, sh: 1080 });
  // 4:3 on the same screen: less is thrown away, and the full sensor height stays.
  assert.deepEqual(framedCameraCrop(1440, 1080, 469, 860), { sx: 426, sy: 0, sw: 589, sh: 1080 });
  // A 3:4 portrait frame on a 9:19,5 screen is a 23% cut: that one is worth drawing.
  assert.deepEqual(framedCameraCrop(1440, 1920, 469, 860), { sx: 196, sy: 0, sw: 1047, sh: 1920 });
  // A 9:16 stream on the same screen loses about three percent, which is not worth a canvas: the track is recorded.
  assert.equal(framedCameraCrop(1080, 1920, 469, 860), null);
  assert.equal(framedCameraCrop(0, 0, 469, 860), null);
  assert.equal(framedCameraCrop(1920, 1080, 0, 0), null);
  assert.equal(createFramedCameraStream({ video: { videoWidth: 1080, videoHeight: 1920 }, camera: { clientWidth: 469, clientHeight: 860 } }), null);
  assert.equal(createFramedCameraStream({}), null);
  // A cropped take is drawn from that centre and stopped with the recording; without a drawing surface the track
  // is recorded instead, so a missing canvas can never cost a recording.
  const drawn = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: (...args) => drawn.push(args) }),
    captureStream: () => 'framed-stream',
  };
  const timers = [];
  const framed = createFramedCameraStream({
    video: { videoWidth: 1920, videoHeight: 1080 },
    camera: { clientWidth: 469, clientHeight: 860 },
    createCanvas: () => canvas,
    setInterval: (fn, ms) => { timers.push(ms); return 7; },
    clearInterval: (id) => { timers.push('cleared:' + id); },
  });
  assert.equal(framed.stream, 'framed-stream');
  assert.equal(framed.width, 608);
  assert.equal(framed.height, 1080);
  assert.equal(canvas.width, 608);
  assert.equal(canvas.height, 1080);
  assert.deepEqual(drawn[0], [{ videoWidth: 1920, videoHeight: 1080 }, 656, 0, 608, 1080, 0, 0, 608, 1080]);
  assert.equal(timers[0], 33, 'thirty frames a second, the same as the track');
  framed.stop();
  assert.deepEqual(timers.slice(1), ['cleared:7']);
  assert.equal(createFramedCameraStream({
    video: { videoWidth: 1920, videoHeight: 1080 },
    camera: { clientWidth: 469, clientHeight: 860 },
    createCanvas: () => ({ width: 0, height: 0, getContext: () => null }),
  }), null);
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

test('camera presets keep 9:16 at 0.7× and switch to 3:4 at 1× without cropping a source', async () => {
  const surface = { clientWidth: 469, clientHeight: 860, dataset: { cameraAspect: '9:16' } };
  const vertical = cameraFrameSize(surface);
  assert.equal(vertical.width / vertical.height, 9 / 16);
  surface.dataset.cameraAspect = '3:4';
  const portrait = cameraFrameSize(surface);
  assert.equal(portrait.width / portrait.height, 3 / 4);
  const applied = [];
  const zoomable = {
    getCapabilities: () => ({ zoom: { min: .5, max: 8, step: .1 } }),
    getSettings: () => ({ zoom: applied.at(-1)?.advanced[0].zoom }),
    applyConstraints: async (value) => { applied.push(value); },
  };
  assert.deepEqual(await setCameraZoom(zoomable, .7), { target: .7, actual: .7, matched: true });
  assert.deepEqual(await setCameraZoom(zoomable, 1), { target: 1, actual: 1, matched: true });
  assert.deepEqual(applied.map((value) => value.advanced[0].zoom), [.7, 1]);
  const standard = { ...zoomable, getCapabilities: () => ({ zoom: { min: 1, max: 4 } }) };
  assert.deepEqual(await setCameraZoom(standard, .7), { target: .7, actual: 1, matched: false });
  const unreported = { ...zoomable, getSettings: () => ({}) };
  assert.deepEqual(await setCameraZoom(unreported, .7), { target: .7, actual: null, matched: false },
    'a successful constraint is not proof that the browser changed the optical field of view');
});

test('0.7× uses an exposed ultrawide lens when the default track cannot provide it', async () => {
  const stopped = [];
  const track = (id) => ({
    getSettings: () => ({ width: 1080, height: 1920, deviceId: id, zoom: 1 }),
    getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
    applyConstraints: async () => {}, stop: () => stopped.push(id),
  });
  const standard = track('main'), ultrawide = track('ultra');
  const calls = [];
  const media = {
    getUserMedia: async (constraints) => {
      calls.push(constraints);
      const selected = constraints.video.deviceId?.exact === 'ultra' ? ultrawide : standard;
      return { getVideoTracks: () => [selected], getTracks: () => [selected] };
    },
    enumerateDevices: async () => [
      { kind: 'videoinput', deviceId: 'main', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
    ],
  };
  assert.equal(findUltraWideCamera(await media.enumerateDevices(), 'main').deviceId, 'ultra');
  const opened = await openCameraPresetStream('environment', true, '9:16', media);
  assert.equal(opened.track, ultrawide);
  assert.equal(opened.lens, 'ultrawide');
  assert.deepEqual(stopped, ['main']);
  assert.equal(calls[0].video.height.ideal, 1920);
  assert.equal(calls[1].video.deviceId.exact, 'ultra');
  const standardOnly = await openCameraPresetStream('environment', true, '3:4', media);
  assert.equal(standardOnly.track, standard);
  assert.equal(standardOnly.lens, 'default');
  assert.equal(calls[2].video.height.ideal, 1440);
});

test('an alternate rear lens can be selected explicitly when 0.7× is unavailable on the default track', async () => {
  const wide = { kind: 'videoinput', deviceId: 'wide', label: 'Rear camera 2',
    getCapabilities: () => ({ zoom: { min: .5, max: 4 } }) };
  assert.equal(findUltraWideCamera([wide], 'main'), wide);
  const calls = [];
  const track = {
    getSettings: () => ({ width: 1080, height: 1920, zoom: .7, deviceId: 'wide' }),
    getCapabilities: () => ({ zoom: { min: .5, max: 4 } }),
    applyConstraints: async () => {}, stop: () => {},
  };
  const media = {
    getUserMedia: async (constraints) => { calls.push(constraints); return { getVideoTracks: () => [track], getTracks: () => [track] }; },
    enumerateDevices: async () => { throw new Error('manual choice must not be overridden'); },
  };
  const opened = await openCameraPresetStream('environment', true, '9:16', media, wide);
  assert.equal(opened.track, track);
  assert.equal(opened.zoom.matched, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].video.deviceId.exact, 'wide');
  assert.equal(Object.hasOwn(calls[0].video, 'facingMode'), false);
});

test('a camera-busy ultrawide attempt restores a usable stream if the second lens fails', async () => {
  let defaultOpen = 0, ultraOpen = 0, stopped = 0;
  const makeTrack = () => ({
    getSettings: () => ({ width: 1080, height: 1920, deviceId: 'main', zoom: 1 }),
    getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
    applyConstraints: async () => {}, stop: () => { stopped++; },
  });
  const media = {
    getUserMedia: async ({ video }) => {
      if (video.deviceId) {
        ultraOpen++;
        const error = new Error('ultrawide unavailable'); error.name = 'NotReadableError'; throw error;
      }
      defaultOpen++;
      const current = makeTrack();
      return { getVideoTracks: () => [current], getTracks: () => [current] };
    },
    enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'ultra', label: 'Rear Ultra Wide' }],
  };
  const opened = await openCameraPresetStream('environment', true, '9:16', media);
  assert.equal(opened.lens, 'default');
  assert.equal(opened.track.getSettings().deviceId, 'main');
  assert.equal(defaultOpen, 2, 'the main camera is restored after the busy lens fails');
  assert.equal(ultraOpen, 2);
  assert.equal(stopped, 1);
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
