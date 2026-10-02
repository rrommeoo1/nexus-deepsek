export const REEL_LAYOUTS = Object.freeze({
  off: Object.freeze([{ x: 0, y: 0, width: 1, height: 1 }]),
  'split-horizontal': Object.freeze([
    { x: 0, y: 0, width: 1, height: .5 },
    { x: 0, y: .5, width: 1, height: .5 },
  ]),
  'split-vertical': Object.freeze([
    { x: 0, y: 0, width: .5, height: 1 },
    { x: .5, y: 0, width: .5, height: 1 },
  ]),
  'three-horizontal': Object.freeze([
    { x: 0, y: 0, width: 1, height: 1 / 3 },
    { x: 0, y: 1 / 3, width: 1, height: 1 / 3 },
    { x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
  ]),
  'grid-four': Object.freeze([
    { x: 0, y: 0, width: .5, height: .5 }, { x: .5, y: 0, width: .5, height: .5 },
    { x: 0, y: .5, width: .5, height: .5 }, { x: .5, y: .5, width: .5, height: .5 },
  ]),
  'grid-six': Object.freeze([
    { x: 0, y: 0, width: .5, height: 1 / 3 }, { x: .5, y: 0, width: .5, height: 1 / 3 },
    { x: 0, y: 1 / 3, width: .5, height: 1 / 3 }, { x: .5, y: 1 / 3, width: .5, height: 1 / 3 },
    { x: 0, y: 2 / 3, width: .5, height: 1 / 3 }, { x: .5, y: 2 / 3, width: .5, height: 1 / 3 },
  ]),
});

export function reelLayoutCells(layout) {
  return REEL_LAYOUTS[layout] || REEL_LAYOUTS.off;
}

export function coverSourceRect(sourceWidth, sourceHeight, destinationWidth, destinationHeight) {
  const sw = Math.max(1, Number(sourceWidth) || 1); const sh = Math.max(1, Number(sourceHeight) || 1);
  const dw = Math.max(1, Number(destinationWidth) || 1); const dh = Math.max(1, Number(destinationHeight) || 1);
  const sourceRatio = sw / sh; const destinationRatio = dw / dh;
  if (sourceRatio > destinationRatio) {
    const width = sh * destinationRatio;
    return { sx: (sw - width) / 2, sy: 0, sw: width, sh };
  }
  const height = sw / destinationRatio;
  return { sx: 0, sy: (sh - height) / 2, sw, sh: height };
}

export function composeReelLayout(layout, frames, { width, height, createCanvas = () => document.createElement('canvas') } = {}) {
  const cells = reelLayoutCells(layout);
  if (layout === 'off' || frames.length !== cells.length || !cells.every((_, index) => Boolean(frames[index]))) throw new Error('LAYOUT_INCOMPLETE');
  const output = createCanvas(); output.width = Math.max(1, Math.round(Number(width) || frames[0].width)); output.height = Math.max(1, Math.round(Number(height) || frames[0].height));
  const context = output.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.fillStyle = '#000'; context.fillRect(0, 0, output.width, output.height);
  cells.forEach((cell, index) => {
    const frame = frames[index];
    const dx = Math.round(cell.x * output.width); const dy = Math.round(cell.y * output.height);
    const dw = Math.round(cell.width * output.width); const dh = Math.round(cell.height * output.height);
    const crop = coverSourceRect(frame.width, frame.height, dw, dh);
    context.drawImage(frame, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh);
  });
  return output;
}

export function canvasBlob(canvas, type = 'image/jpeg', quality = .92) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('CANVAS_ENCODE_FAILED')), type, quality));
}
