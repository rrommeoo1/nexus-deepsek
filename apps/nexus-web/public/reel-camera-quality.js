// Ask for the widest frame the phone has, arranged the way it is held, without a hard constraint that would reject
// older phones. The recorded stream and the live preview use this same track.
//
// The owner's phone answered a 1080x1920 request with 1920x1080, read off his own screen on 3 octombrie 2026 from
// the note the camera prints, so a phone held upright can still be answered with the sensor's own landscape mode.
// Filling a 469x860 screen with that frame means cutting 3,26x out of the picture, while the same screen filled with a
// portrait frame costs about one percent - and one percent is the native camera he compares against. The request
// therefore asks for the sensor itself in the held arrangement (1080x1440, 3:4) and not for the 9:16 sliver of it:
// a phone that answers portrait lands on the screen's own shape, and a phone that answers landscape anyway hands
// back the whole sensor - a 16:9 mode has already thrown away its top and bottom.
//
// No aspect and no resize constraint is used. Measured on a 4:3 sensor, `aspectRatio: "exact"` crops the sensor to
// that sliver, and `resizeMode: "crop-and-scale"` cuts exactly the slice `object-fit: cover` cuts anyway, so a
// shaped request can never widen the field of view - it can only take the whole wall out of the preview.
export function cameraVideoConstraints(facingMode, portrait) {
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: portrait ? 1080 : 1920 },
    height: { ideal: portrait ? 1440 : 1080 },
    frameRate: { ideal: 30, max: 30 },
  };
}

// The phone answers with a mode of its own, and no constraint widens the field of view: asking for the screen's
// own aspect (1.02-1.04, `aspectRatio` + `resizeMode: "crop-and-scale"`) either makes the browser crop the sensor
// to that sliver or is ignored, and a source crop cuts exactly the slice `object-fit: cover` cuts anyway. Worse,
// a shaped request that *is* honoured hides the whole wall before the preview ever sees it. The request therefore
// stays plain and complete, and the framing decision moved to the preview, where the creator can see it and undo
// it with one tap ("Umple" / "Încadrează").
export async function requestCameraStream(facingMode, portrait, media = navigator.mediaDevices) {
  return media.getUserMedia({ video: cameraVideoConstraints(facingMode, portrait), audio: false });
}

// A phone can answer a portrait request with a landscape mode anyway (measured on the owner's phone). The live
// track is then asked once, politely, for the portrait arrangement; when the phone cannot, the mode it already had
// is put back, so the attempt can never cost resolution. Returns the portrait settings when the phone agreed,
// otherwise null. The framed preview and the framing rule work either way - this only buys back the field of view.
export async function alignCameraTrack(track, { portrait = false } = {}) {
  const before = track?.getSettings?.();
  if (!portrait || !track?.applyConstraints || !(before?.width > 0) || before.height >= before.width) return null;
  try { await track.applyConstraints(cameraVideoConstraints(before.facingMode || "environment", true)); }
  catch { return null; }
  const after = track.getSettings?.() || {};
  if (after.height > after.width) return after;
  try { await track.applyConstraints({ width: { ideal: before.width }, height: { ideal: before.height } }); }
  catch { /* The mode it already had stands. */ }
  return null;
}

// A phone can hand back a track that already carries a digital zoom. The widest setting of the track is the
// honest preview, and the photo and the clip are taken from this same track, so they stay in step with it.
export async function widenCameraTrack(track) {
  const range = track?.getCapabilities?.().zoom;
  if (range && Number.isFinite(range.min)) await track.applyConstraints({ advanced: [{ zoom: range.min }] }).catch(() => {});
}
