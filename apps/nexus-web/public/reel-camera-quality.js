export const CAMERA_ASPECTS = Object.freeze({ '9:16': 9 / 16, '3:4': 3 / 4 });

export function cameraFrameSize(camera) {
  const width = Number(camera?.clientWidth), height = Number(camera?.clientHeight);
  if (!(width > 0) || !(height > 0)) return null;
  const ratio = CAMERA_ASPECTS[camera.dataset?.cameraAspect] || CAMERA_ASPECTS['9:16'];
  const frameWidth = Math.min(width, height * ratio);
  return { width: frameWidth, height: frameWidth / ratio };
}

export function cameraVideoConstraints(facingMode, portrait, aspect = '9:16') {
  const dimensions = portrait ? (aspect === '3:4' ? [1080, 1440] : [1080, 1920]) : [1920, 1080];
  // A native, uncropped mode is preferable. An unsupported resizeMode is ignored by older browsers.
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: dimensions[0] }, height: { ideal: dimensions[1] },
    frameRate: { ideal: 30, max: 30 },
    resizeMode: 'none',
  };
}

export async function requestCameraStream(facingMode, portrait, media = navigator.mediaDevices, aspect = '9:16') {
  return media.getUserMedia({ video: cameraVideoConstraints(facingMode, portrait, aspect), audio: false });
}

// Some Android browsers still return landscape even when portrait was requested. Never crop that answer silently.
export async function alignCameraTrack(track, { portrait = false, aspect = '9:16' } = {}) {
  const before = track?.getSettings?.();
  if (!portrait || !track?.applyConstraints || !(before?.width > 0) || before.height >= before.width) return null;
  try { await track.applyConstraints(cameraVideoConstraints(before.facingMode || 'environment', true, aspect)); }
  catch { return null; }
  const after = track.getSettings?.() || {};
  if (after.height > after.width) return after;
  try { await track.applyConstraints({ width: { ideal: before.width }, height: { ideal: before.height } }); }
  catch { /* Keep the camera's existing mode. */ }
  return null;
}

export async function setCameraZoom(track, target) {
  let range;
  try { range = track?.getCapabilities?.()?.zoom; } catch { /* Zoom is optional in mobile browsers. */ }
  const min = Number(range?.min), max = Number(range?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || !track?.applyConstraints)
    return { target, actual: null, matched: false };
  const requested = Math.max(min, Math.min(max, target));
  try {
    await track.applyConstraints({ advanced: [{ zoom: requested }] });
    const actual = Number(track.getSettings?.().zoom);
    const effective = Number.isFinite(actual) && actual > 0 ? actual : null;
    return { target, actual: effective, matched: effective !== null && Math.abs(effective - target) < .06 };
  } catch { return { target, actual: null, matched: false }; }
}

// Compatibility for older callers: use the widest setting exposed by this track.
export async function widenCameraTrack(track) {
  let min = NaN;
  try { min = Number(track?.getCapabilities?.()?.zoom?.min); } catch { /* Optional capability. */ }
  return Number.isFinite(min) && min > 0 ? setCameraZoom(track, min) : { target: null, actual: null, matched: false };
}

export function findUltraWideCamera(devices, currentDeviceId) {
  return (devices || []).find((device) => device.kind === 'videoinput' && device.deviceId &&
    device.deviceId !== currentDeviceId && !/(?:front|selfie|user)/i.test(device.label || '') &&
    /(?:ultra[\s-]?wide|wide[\s-]?angle|0[.,][5-8]\s*[x×])/i.test(device.label || '')) || null;
}

export async function openCameraPresetStream(facingMode, portrait, aspect = '9:16', media = navigator.mediaDevices) {
  let stream = await requestCameraStream(facingMode, portrait, media, aspect);
  let track = stream.getVideoTracks()[0];
  if (!track) { stream.getTracks().forEach((entry) => entry.stop()); throw new Error('NO_VIDEO_TRACK'); }
  await alignCameraTrack(track, { portrait, aspect });
  const target = aspect === '9:16' && facingMode === 'environment' ? .7 : 1;
  let zoom = await setCameraZoom(track, target);
  let lens = 'default';
  if (target === .7 && !zoom.matched && typeof media.enumerateDevices === 'function') {
    let candidate = null;
    try { candidate = findUltraWideCamera(await media.enumerateDevices(), track?.getSettings?.().deviceId); }
    catch { /* Browsers may hide alternative lenses; keep the working camera. */ }
    if (candidate) {
      let releasedOriginal = false;
      try {
        const constraints = cameraVideoConstraints(facingMode, portrait, aspect);
        delete constraints.facingMode;
        constraints.deviceId = { exact: candidate.deviceId };
        let alternative;
        try { alternative = await media.getUserMedia({ video: constraints, audio: false }); }
        catch (error) {
          // Several phones cannot open two rear lenses concurrently. Release the first only for that busy error,
          // then restore the default stream if the alternative still cannot start.
          if (!['NotReadableError', 'AbortError'].includes(error?.name)) throw error;
          stream.getTracks().forEach((entry) => entry.stop()); releasedOriginal = true;
          try { alternative = await media.getUserMedia({ video: constraints, audio: false }); }
          catch {
            stream = await requestCameraStream(facingMode, portrait, media, aspect);
            track = stream.getVideoTracks()[0];
            if (!track) { stream.getTracks().forEach((entry) => entry.stop()); throw new Error('NO_VIDEO_TRACK'); }
            await alignCameraTrack(track, { portrait, aspect });
            zoom = await setCameraZoom(track, target);
          }
        }
        if (!alternative) return { stream, track, zoom, lens };
        const alternativeTrack = alternative.getVideoTracks()[0];
        if (!alternativeTrack) {
          alternative.getTracks().forEach((entry) => entry.stop());
          if (releasedOriginal) {
            stream = await requestCameraStream(facingMode, portrait, media, aspect);
            track = stream.getVideoTracks()[0];
            if (!track) { stream.getTracks().forEach((entry) => entry.stop()); throw new Error('NO_VIDEO_TRACK'); }
            await alignCameraTrack(track, { portrait, aspect });
            zoom = await setCameraZoom(track, target);
          }
        }
        else {
          await alignCameraTrack(alternativeTrack, { portrait, aspect });
          zoom = await setCameraZoom(alternativeTrack, 1);
          if (!releasedOriginal) stream.getTracks().forEach((entry) => entry.stop());
          stream = alternative; track = alternativeTrack; lens = 'ultrawide';
        }
      } catch (error) {
        if (releasedOriginal) throw error;
        // An inaccessible second lens must not interrupt the already working stream.
      }
    }
  }
  return { stream, track, zoom, lens };
}
