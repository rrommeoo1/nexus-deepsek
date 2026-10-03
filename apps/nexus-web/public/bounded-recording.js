import { coverSourceRect } from './reel-layout.js?v=20261003-fill1';
import { drawFittedCameraFrame, fittedCameraDimensions } from './reel-camera-framing.js?v=20261003-wide1';
import { cameraFrameSize } from './reel-camera-quality.js?v=20261003-lens1';

export function cameraRecordingProfile(durationSeconds, maxBytes = 20 * 1024 * 1024) {
  const seconds = Math.max(15, Math.min(600, Number(durationSeconds) || 60));
  const totalBitsPerSecond = Math.floor((maxBytes * 8 * .84) / seconds);
  const audioBitsPerSecond = Math.max(24_000, Math.min(64_000, Math.floor(totalBitsPerSecond * .12)));
  const videoBitsPerSecond = Math.max(120_000, Math.min(2_800_000, totalBitsPerSecond - audioBitsPerSecond));
  return Object.freeze({ durationSeconds: seconds, audioBitsPerSecond, videoBitsPerSecond });
}

export function createCameraRecorder(stream, Recorder = MediaRecorder, profile = {}) {
  const mimeType = Recorder.isTypeSupported?.('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
  return new Recorder(stream, {
    mimeType,
    ...(Number(profile.videoBitsPerSecond) > 0 ? { videoBitsPerSecond: Number(profile.videoBitsPerSecond) } : {}),
    ...(Number(profile.audioBitsPerSecond) > 0 ? { audioBitsPerSecond: Number(profile.audioBitsPerSecond) } : {}),
  });
}

// Legacy centre-crop fallback for explicit fill. The normal 9:16 and 3:4 presets use the fitted path below, so
// a landscape camera answer is never silently magnified to fill a portrait preview or recording.
export function framedCameraCrop(sourceWidth, sourceHeight, surfaceWidth, surfaceHeight) {
  const sw = Math.max(0, Number(sourceWidth) || 0), sh = Math.max(0, Number(sourceHeight) || 0);
  const dw = Math.max(0, Number(surfaceWidth) || 0), dh = Math.max(0, Number(surfaceHeight) || 0);
  if (!sw || !sh || !dw || !dh) return null;
  const streamAspect = sw / sh, surfaceAspect = dw / dh;
  const kept = streamAspect < surfaceAspect ? streamAspect / surfaceAspect : surfaceAspect / streamAspect;
  if (kept > .94) return null;
  const crop = coverSourceRect(sw, sh, dw, dh);
  return Object.freeze({ sx: Math.round(crop.sx), sy: Math.round(crop.sy), sw: Math.round(crop.sw), sh: Math.round(crop.sh) });
}

// The take the creator is looking at: the framed centre of the track, redrawn into a canvas at the frame's own
// resolution and recorded from there, so a clip holds what the screen shows. Returns null when nothing has to be
// cropped (the track is recorded as it arrives) or when the browser cannot draw one, so a missing canvas can never
// cost a recording.
export function createFramedCameraStream({
  video, camera, fps = 30,
  createCanvas = () => document.createElement('canvas'),
  setInterval: every = setInterval, clearInterval: stopEvery = clearInterval,
} = {}) {
  if (!video || !camera) return null;
  const fit = camera.dataset?.cameraFit === 'fit' && (camera.dataset?.layout || 'off') === 'off';
  const frame = cameraFrameSize(camera);
  const crop = fit ? null : framedCameraCrop(video.videoWidth, video.videoHeight, frame?.width, frame?.height);
  const output = fit && frame ? fittedCameraDimensions(video.videoWidth, video.videoHeight, frame.width, frame.height) : crop;
  if (!output) return null;
  const canvas = createCanvas();
  canvas.width = fit ? output.width : crop.sw; canvas.height = fit ? output.height : crop.sh;
  const context = canvas.getContext?.('2d');
  if (!context || typeof canvas.captureStream !== 'function') return null;
  const backdrop = fit ? createCanvas() : null;
  if (fit && !backdrop?.getContext?.('2d')) return null;
  const draw = () => {
    if (!video.videoWidth) return false;
    try {
      if (fit) return drawFittedCameraFrame(context, video, canvas.width, canvas.height, backdrop);
      context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
      return true;
    } catch { return false; }
  };
  if (!draw()) return null;
  let stream;
  try { stream = canvas.captureStream(Math.max(1, fps)); }
  catch { return null; }
  const timer = every(draw, Math.max(15, Math.round(1000 / Math.max(1, fps))));
  return Object.freeze({ stream, width: canvas.width, height: canvas.height, stop: () => {
    stopEvery(timer); stream?.getVideoTracks?.().forEach((track) => track.stop());
  } });
}

// The take the recorder should use: the framed canvas stream with the microphone already on it, or null when the
// whole track is the picture anyway. One call site in the entry file, one rule shared with the preview.
export function framedCameraTake(video, camera, stream, fps = 30) {
  const framed = createFramedCameraStream({ video, camera, fps });
  if (!framed) return null;
  for (const track of stream?.getAudioTracks?.() || []) framed.stream.addTrack(track);
  return framed;
}

export function cameraRecovery(camera, stopCamera, notify, message) {
  stopCamera();
  camera.querySelector('.cameraRecovery').hidden = false;
  (camera.querySelector('.reelCameraStatus') || camera.querySelector('small')).textContent = message;
  notify(message);
}

/** Bounded retained chunks, a single terminal result, and no stale UI callbacks. */
export function startBoundedRecording(recorder, {
  maxBytes = 20 * 1024 * 1024,
  maxDurationMs = 180_000,
  isCurrent,
  onResult,
  tracks = [],
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1) throw new TypeError('Invalid recording limits');
  let chunks = [], bytes = 0, settled = false, failure = null, timer;
  const cleanup = () => {
    clearTimer(timer);
    tracks.forEach((track) => track.removeEventListener('ended', interrupted));
    recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
    chunks = [];
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    let blob = null;
    if (!failure) {
      if (!bytes) failure = 'EMPTY_RECORDING';
      else {
        try {
          // MediaRecorder commonly reports `video/webm;codecs=vp8,opus`. A File's
          // MIME is an admission boundary in the composer, so keep the container
          // type canonical while the WebM bytes retain their codec metadata.
          const containerType = String(recorder.mimeType || 'video/webm').split(';', 1)[0].trim().toLowerCase() || 'video/webm';
          blob = new Blob(chunks, { type: containerType });
        }
        catch { failure = 'RECORDING_FAILED'; }
      }
    }
    cleanup();
    if (isCurrent()) onResult({ blob: failure ? null : blob, error: failure });
  };
  const fail = (reason) => {
    if (settled) return;
    failure = reason;
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* Cleanup still runs. */ }
    finish();
  };
  const interrupted = () => fail('MEDIA_INTERRUPTED');
  const stop = () => {
    if (settled) return;
    try { if (recorder.state !== 'inactive') recorder.stop(); else finish(); }
    catch { fail('RECORDING_FAILED'); }
  };
  recorder.ondataavailable = ({ data }) => {
    if (settled || !data?.size) return;
    if (!Number.isSafeInteger(data.size) || data.size < 0 || data.size > maxBytes - bytes) return fail('UPLOAD_TOO_LARGE');
    bytes += data.size;
    chunks.push(data);
  };
  recorder.onstop = finish;
  recorder.onerror = () => fail('RECORDING_FAILED');
  tracks.forEach((track) => track.addEventListener('ended', interrupted));
  try {
    recorder.start(500);
    if (!settled) timer = setTimer(stop, maxDurationMs);
  } catch { fail('RECORDING_FAILED'); }
  return Object.freeze({ stop, get settled() { return settled; } });
}
