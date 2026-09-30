import test from 'node:test';
import assert from 'node:assert/strict';
import { startBoundedRecording, createCameraRecorder, cameraRecovery } from '../public/bounded-recording.js';

function setup(overrides = {}) {
  const results = [], scheduled = new Map();
  let current = true, next = 0;
  const track = new EventTarget();
  const recorder = {
    state: 'inactive', mimeType: 'video/webm', stops: 0,
    start() { this.state = 'recording'; },
    stop() { this.stops++; this.state = 'inactive'; this.onstop?.(); },
    ...overrides.recorder,
  };
  const job = startBoundedRecording(recorder, {
    maxBytes: 10, maxDurationMs: 100, tracks: [track],
    isCurrent: () => current, onResult: (value) => results.push(value),
    setTimer: (fn) => { scheduled.set(++next, fn); return next; },
    clearTimer: (id) => scheduled.delete(id),
  });
  const chunk = (size) => recorder.ondataavailable?.({ data: new Blob([new Uint8Array(size)]) });
  return { recorder, job, results, scheduled, track, chunk, stale: () => { current = false; } };
}

test('successful recording includes exactly accepted chunks at the byte boundary', () => {
  const x = setup(); x.chunk(4); x.chunk(6); x.job.stop();
  assert.equal(x.results.length, 1);
  assert.equal(x.results[0].blob.size, 10);
  assert.equal(x.results[0].error, null);
  assert.equal(x.scheduled.size, 0);
  x.job.stop(); x.chunk(3);
  assert.equal(x.results.length, 1);
});

test('oversize is stopped before retaining the excess chunk, never silently publishes a partial clip', () => {
  const x = setup(); x.chunk(6); x.chunk(5);
  assert.equal(x.recorder.stops, 1);
  assert.deepEqual(x.results, [{ blob: null, error: 'UPLOAD_TOO_LARGE' }]);
  assert.equal(x.job.settled, true);
  assert.equal(x.recorder.ondataavailable, null);
  assert.equal(x.scheduled.size, 0);
});

test('empty recording, start failure, stop failure and recorder error settle once', () => {
  const empty = setup(); empty.job.stop();
  assert.equal(empty.results[0].error, 'EMPTY_RECORDING');
  const start = setup({ recorder: { start() { throw Error('unsupported'); } } });
  assert.equal(start.results[0].error, 'RECORDING_FAILED');
  assert.equal(start.job.settled, true);
  const stop = setup({ recorder: { stop() { throw Error('device lost'); } } });
  stop.chunk(2); stop.job.stop();
  assert.deepEqual(stop.results, [{ blob: null, error: 'RECORDING_FAILED' }]);
  const error = setup(); error.chunk(2); error.recorder.onerror();
  assert.deepEqual(error.results, [{ blob: null, error: 'RECORDING_FAILED' }]);
});

test('ended camera tracks fail visibly; duration limit finishes valid footage', () => {
  const interrupted = setup(); interrupted.chunk(2); interrupted.track.dispatchEvent(new Event('ended'));
  assert.equal(interrupted.results[0].error, 'MEDIA_INTERRUPTED');
  interrupted.track.dispatchEvent(new Event('ended'));
  assert.equal(interrupted.results.length, 1);
  const timed = setup(); timed.chunk(5); [...timed.scheduled.values()][0]();
  assert.equal(timed.results[0].blob.size, 5);
  assert.equal(timed.scheduled.size, 0);
});

test('abandoned recorder releases callbacks and timers without touching a newer screen', () => {
  const x = setup(); x.chunk(3); x.stale(); x.job.stop();
  assert.deepEqual(x.results, []);
  assert.equal(x.scheduled.size, 0);
  assert.equal(x.recorder.onerror, null);
});

test('factory preserves WebM upload contract and recovery restores a usable camera surface', () => {
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream, options) { this.stream = stream; this.options = options; }
  }
  const stream = {};
  const recorder = createCameraRecorder(stream, Recorder);
  assert.equal(recorder.stream, stream);
  assert.equal(recorder.options.mimeType, 'video/webm;codecs=vp8,opus');
  const recovery = { hidden: true }, status = { textContent: '' }, actions = [];
  cameraRecovery({ querySelector: (selector) => selector === '.cameraRecovery' ? recovery : status }, () => actions.push('stop'), (message) => actions.push(message), 'Încearcă din nou');
  assert.deepEqual(actions, ['stop', 'Încearcă din nou']);
  assert.equal(recovery.hidden, false);
  assert.equal(status.textContent, 'Încearcă din nou');
});
