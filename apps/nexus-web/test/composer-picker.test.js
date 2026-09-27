import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { bindComposerPicker, readSelectedPreview } from '../public/composer-picker.js';

function setup() {
  const input = new EventTarget();
  const state = { current: true, draft: false, exits: 0, recoveries: 0, clicks: 0 };
  input.click = () => state.clicks++;
  input.files = [];
  const picker = bindComposerPicker(input, {
    isCurrent: () => state.current, hasDraft: () => state.draft,
    onEmptyCancel: () => state.exits++, onRecover: () => state.recoveries++,
  });
  return { input, state, picker };
}

test('only explicit cancellation leaves an empty composer, never a focus return', () => {
  const { input, state, picker } = setup();
  picker.launch();
  input.dispatchEvent(new Event('focus'));
  assert.equal(state.exits, 0);
  input.dispatchEvent(new Event('cancel'));
  assert.equal(state.exits, 1);
  assert.equal(state.clicks, 1);
});

test('cancel preserves a draft; stale picker events and launches are ignored', () => {
  const { input, state, picker } = setup();
  state.draft = true;
  input.dispatchEvent(new Event('cancel'));
  assert.equal(state.exits, 0);
  assert.equal(state.recoveries, 1);
  state.current = false;
  state.draft = false;
  input.dispatchEvent(new Event('cancel'));
  picker.launch();
  assert.equal(state.exits, 0);
  assert.equal(state.clicks, 0);
});

test('late preview cannot overwrite a newer file or a different screen', async () => {
  const first = { name: 'first.jpg' }, second = { name: 'second.jpg' };
  const input = { files: [first] };
  let resolveFirst;
  const oldRead = readSelectedPreview(input, () => new Promise((resolve) => { resolveFirst = resolve; }), () => true);
  input.files = [second];
  assert.equal(await readSelectedPreview(input, async () => 'second-preview', () => true), 'second-preview');
  resolveFirst('first-preview');
  assert.equal(await oldRead, null);
  assert.equal(await readSelectedPreview(input, async () => 'detached', () => false), null);
});

test('camera cleanup releases tracks and clears the visible active/recording state', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function stopComposerCamera(');
  const end = source.indexOf('async function startComposerCamera(', start);
  const calls = { tracks: 0, stopped: 0, invalidated: 0, cleared: false };
  const recorder = { state: 'recording', stop: () => calls.stopped++ };
  const video = { srcObject: {} }, record = { hidden: true }, stop = { hidden: false };
  const camera = { classList: { remove: () => { calls.cleared = true; } }, querySelector: () => video };
  const context = {
    activeRecorder: recorder, activeComposerStream: { getTracks: () => [1, 2].map(() => ({ stop: () => calls.tracks++ })) },
    discardedComposerRecorders: new WeakSet(), composerCameraRequestGate: { invalidate: () => calls.invalidated++ },
    document: { getElementById: (id) => ({ composerCamera: camera, recordClip: record, stopRecording: stop })[id] },
  };
  runInNewContext(source.slice(start, end) + '\nstopComposerCamera();', context);
  assert.equal(calls.tracks, 2);
  assert.equal(calls.stopped, 1);
  assert.equal(calls.invalidated, 1);
  assert.equal(calls.cleared, true);
  assert.equal(video.srcObject, null);
  assert.equal(context.activeComposerStream, null);
  assert.equal(context.discardedComposerRecorders.has(recorder), true);
  assert.equal(record.hidden, false);
  assert.equal(stop.hidden, true);
});
