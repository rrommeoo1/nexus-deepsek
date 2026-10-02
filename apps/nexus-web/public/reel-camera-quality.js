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

// The phone answers with a mode of its own, and on a tall screen that mode is almost always wider than the
// screen is (4:3, 16:9 or 9:16 against a 9:19.5 viewport). The preview fills the surface with `object-fit:
// cover`, so that wider image is cropped hard - which is what the owner saw as "the camera opens zoomed", on
// both PHOTO and VIDEO, because both modes read this one track. Asking for the container's own aspect together
// with `resizeMode: "crop-and-scale"` lets the browser hand back a stream already shaped like the preview, so
// the leftover crop is a few percent instead of half the picture. Both keys are ideals: a phone that does not
// know them still gets the plain request from `cameraVideoConstraints`, which stays the fallback.
export function cameraShapedConstraints(facingMode, portrait, aspect) {
  const ratio = Number(aspect);
  return {
    ...cameraVideoConstraints(facingMode, portrait),
    aspectRatio: { ideal: Number.isFinite(ratio) && ratio > 0 ? ratio : 9 / 16 },
    resizeMode: "crop-and-scale",
  };
}

// The shaped request first, the plain one as the fallback: on a phone that refuses `resizeMode` the crop is
// the old one, which is better than an error on the screen of somebody who just wanted to take a photo.
export async function requestCameraStream(facingMode, portrait, aspect, media = navigator.mediaDevices) {
  try {
    return await media.getUserMedia({ video: cameraShapedConstraints(facingMode, portrait, aspect), audio: false });
  } catch (error) {
    if (error?.name !== "OverconstrainedError" && error?.name !== "NotSupportedError") throw error;
    return media.getUserMedia({ video: cameraVideoConstraints(facingMode, portrait), audio: false });
  }
}

// A phone can hand back a track that already carries a digital zoom. The widest setting of the track is the
// honest preview, and the photo and the clip are taken from this same track, so they stay in step with it.
export async function widenCameraTrack(track) {
  const range = track?.getCapabilities?.().zoom;
  if (range && Number.isFinite(range.min)) await track.applyConstraints({ advanced: [{ zoom: range.min }] }).catch(() => {});
}
