import { coverSourceRect } from './reel-layout.js?v=20261003-fill1';

// Keep a fitted take portrait without inventing detail that the camera did not capture.
// A landscape browser stream cannot fill a portrait screen without losing the sides.
export function fittedCameraDimensions(sourceWidth, sourceHeight, surfaceWidth, surfaceHeight) {
  const sw = Number(sourceWidth), sh = Number(sourceHeight), vw = Number(surfaceWidth), vh = Number(surfaceHeight);
  if (![sw, sh, vw, vh].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(1080 / vw, 1920 / vh, Math.sqrt(sw * sh / (vw * vh)));
  return { width: Math.max(1, Math.round(vw * scale)), height: Math.max(1, Math.round(vh * scale)) };
}

export function drawFittedCameraFrame(context, video, width, height, backdrop) {
  const sourceWidth = video?.videoWidth, sourceHeight = video?.videoHeight;
  if (!context || !backdrop || !(sourceWidth > 0) || !(sourceHeight > 0) || !(width > 0) || !(height > 0)) return false;
  const smallWidth = Math.max(48, Math.min(120, Math.round(width / 9)));
  const smallHeight = Math.max(48, Math.round(smallWidth * height / width));
  if (backdrop.width !== smallWidth) backdrop.width = smallWidth;
  if (backdrop.height !== smallHeight) backdrop.height = smallHeight;
  const background = backdrop.getContext?.('2d');
  if (!background) return false;
  const crop = coverSourceRect(sourceWidth, sourceHeight, smallWidth, smallHeight);
  background.filter = 'blur(5px) saturate(1.2)';
  background.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, smallWidth, smallHeight);
  background.filter = 'none';
  context.drawImage(backdrop, 0, 0, width, height);
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  context.fillRect(0, 0, width, height);
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const foregroundWidth = sourceWidth * scale, foregroundHeight = sourceHeight * scale;
  context.drawImage(video, 0, 0, sourceWidth, sourceHeight,
    (width - foregroundWidth) / 2, (height - foregroundHeight) / 2, foregroundWidth, foregroundHeight);
  return true;
}
