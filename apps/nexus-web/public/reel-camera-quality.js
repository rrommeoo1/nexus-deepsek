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
