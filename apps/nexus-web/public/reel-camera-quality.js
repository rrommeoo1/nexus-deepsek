// Ask for a detailed sensor stream without making a hard constraint that would
// reject older phones. The recorded stream and the live preview use this same track.
export function cameraVideoConstraints(facingMode, portrait) {
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: portrait ? 1080 : 1920 },
    height: { ideal: portrait ? 1920 : 1080 },
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

// A phone can hand back a track that already carries a digital zoom. The widest setting of the track is the
// honest preview, and the photo and the clip are taken from this same track, so they stay in step with it.
export async function widenCameraTrack(track) {
  const range = track?.getCapabilities?.().zoom;
  if (range && Number.isFinite(range.min)) await track.applyConstraints({ advanced: [{ zoom: range.min }] }).catch(() => {});
}
