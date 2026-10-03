import test from 'node:test';
import assert from 'node:assert/strict';
import { drawFittedCameraFrame, fittedCameraDimensions } from '../public/reel-camera-framing.js';
import { createFramedCameraStream } from '../public/bounded-recording.js';

test('portrait output keeps the whole landscape camera frame without fake detail', () => {
  assert.deepEqual(fittedCameraDimensions(1920, 1080, 469, 860), { width: 1047, height: 1920 });
  assert.deepEqual(fittedCameraDimensions(1080, 1920, 469, 860), { width: 1047, height: 1920 });
  assert.equal(fittedCameraDimensions(0, 1080, 469, 860), null);
  const video = { videoWidth: 1920, videoHeight: 1080 };
  const foregroundCalls = []; const backdropCalls = [];
  const foreground = { drawImage: (...args) => foregroundCalls.push(args), fillRect() {} };
  const backdrop = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => backdropCalls.push(args) }) };
  assert.equal(drawFittedCameraFrame(foreground, video, 1047, 1920, backdrop), true);
  assert.equal(foregroundCalls.length, 2);
  assert.equal(foregroundCalls[0][0], backdrop);
  assert.deepEqual(foregroundCalls[1].slice(0, 5), [video, 0, 0, 1920, 1080]);
  assert.equal(foregroundCalls[1][7], 1047);
  assert.equal(backdropCalls.length, 1);
  assert.equal(drawFittedCameraFrame(null, video, 1047, 1920, backdrop), false);
});

test('video fit records the same full-frame portrait composite and releases its track', () => {
  const draws = []; let stopped = 0; let timerStopped = 0;
  const canvases = [
    { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args), fillRect() {} }),
      captureStream: () => ({ getVideoTracks: () => [{ stop() { stopped++; } }] }) },
    { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args) }) },
  ];
  const video = { videoWidth: 1920, videoHeight: 1080 };
  const camera = { clientWidth: 469, clientHeight: 860, dataset: { cameraFit: 'fit', layout: 'off' } };
  const take = createFramedCameraStream({ video, camera, createCanvas: () => canvases.shift(),
    setInterval: () => 8, clearInterval: (timer) => { timerStopped = timer; } });
  assert.deepEqual([take.width, take.height], [1080, 1920]);
  assert.ok(draws.some((args) => args[0] === video && args[1] === 0 && args[2] === 0
    && args[3] === 1920 && args[4] === 1080));
  take.stop();
  assert.equal(timerStopped, 8);
  assert.equal(stopped, 1);
  const portraitTake = createFramedCameraStream({ video,
    camera: { ...camera, dataset: { ...camera.dataset, cameraAspect: '3:4' } },
    createCanvas: () => ({ width: 0, height: 0,
      getContext: () => ({ drawImage() {}, fillRect() {} }),
      captureStream: () => ({ getVideoTracks: () => [{ stop() {} }] }),
    }),
    setInterval: () => 9, clearInterval: () => {},
  });
  assert.deepEqual([portraitTake.width, portraitTake.height], [1080, 1440]);
  portraitTake.stop();
  const unavailable = createFramedCameraStream({ video, camera, createCanvas: () => ({
    width: 0, height: 0, getContext: () => ({ drawImage() {}, fillRect() {} }),
    captureStream() { throw Error('unsupported'); },
  }) });
  assert.equal(unavailable, null, 'an unsupported canvas recorder falls back to the uncropped source');
});
