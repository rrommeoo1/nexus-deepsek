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
        try { blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' }); }
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
