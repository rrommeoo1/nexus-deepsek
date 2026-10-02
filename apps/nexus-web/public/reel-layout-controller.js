import { composeReelLayout, coverSourceRect, reelLayoutCells } from './reel-layout.js?v=20261002-layout1';

function cameraFrame(video, aspect = 0) {
  const canvas = document.createElement('canvas');
  const crop = aspect > 0 ? coverSourceRect(video.videoWidth, video.videoHeight, aspect * 1000, 1000) :
    { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight };
  canvas.width = Math.max(1, Math.round(crop.sw)); canvas.height = Math.max(1, Math.round(crop.sh));
  const context = canvas.getContext('2d');
  if (!context) return null;
  // Filter is stored in the edit manifest and applied once in review/published views.
  // Baking it here made photos look different from the live camera (double filtering).
  context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function createReelLayoutController({ camera, video, guide, finish, setState, onComplete, onError }) {
  let frames = []; let active = 0; let busy = false;
  const selected = () => camera.dataset.layout || 'off';
  const hasFrames = () => frames.some(Boolean);
  const positionVideo = (cell) => {
    for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height']) video.style.removeProperty(property);
    if (!cell) return;
    for (const [property, value] of Object.entries({
      left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, right: 'auto', bottom: 'auto',
      width: `${cell.width * 100}%`, height: `${cell.height * 100}%`,
    })) video.style.setProperty(property, value, 'important');
  };
  const render = () => {
    guide.replaceChildren();
    const layout = selected(); const cells = reelLayoutCells(layout);
    camera.classList.toggle('layoutActive', layout !== 'off');
    if (layout === 'off') { camera.classList.remove('layoutComplete'); positionVideo(null); finish.hidden = true; return; }
    const complete = cells.every((_, index) => Boolean(frames[index]));
    camera.classList.toggle('layoutComplete', complete);
    positionVideo(cells[active]);
    cells.forEach((cell, index) => {
      const control = document.createElement('button'); control.type = 'button'; control.className = 'reelLayoutCell';
      control.classList.toggle('active', index === active); control.classList.toggle('captured', Boolean(frames[index]));
      Object.assign(control.style, { left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, width: `${cell.width * 100}%`, height: `${cell.height * 100}%` });
      control.setAttribute('aria-label', frames[index] ? `Refă cadrul ${index + 1}` : `Cadrul ${index + 1}`);
      if (frames[index] && (complete || index !== active)) {
        const preview = document.createElement('canvas'); preview.width = frames[index].width; preview.height = frames[index].height;
        preview.getContext('2d')?.drawImage(frames[index], 0, 0); control.append(preview);
      } else { const marker = document.createElement('b'); marker.textContent = String(index + 1); control.append(marker); }
      control.onclick = () => { active = index; if (frames[index]) frames[index] = null; setState('layout-capturing', { force: true }); render(); };
      guide.append(control);
    });
    finish.hidden = !complete;
  };
  const reset = (layout = 'off') => {
    frames = Array(reelLayoutCells(layout).length).fill(null); active = 0; camera.dataset.layout = layout; render();
    document.getElementById('cameraLayout')?.setAttribute('aria-pressed', String(layout !== 'off'));
  };
  const select = (layout, warning) => {
    if (layout !== selected() && hasFrames() && !window.confirm(warning)) return false;
    reset(layout); setState(layout === 'off' ? 'camera-ready' : 'layout-capturing', { force: true }); return true;
  };
  const capture = async () => {
    if (busy || !video.videoWidth) return false;
    busy = true;
    try {
      const aspect = selected() === 'off' && camera.dataset.cameraFit !== 'fit' ? camera.clientWidth / Math.max(1, camera.clientHeight) : 0;
      const frame = cameraFrame(video, aspect); if (!frame) throw new Error('CANVAS_UNAVAILABLE');
      setState('photo-capture', { force: true });
      if (selected() === 'off') { await onComplete(frame, 'nexus-photo'); return true; }
      const cells = reelLayoutCells(selected()); frames[active] = frame;
      const forward = frames.findIndex((entry, index) => !entry && index > active); active = forward >= 0 ? forward : frames.findIndex((entry) => !entry);
      if (active < 0) { active = cells.length - 1; setState('layout-complete', { force: true }); }
      else setState('layout-capturing', { force: true });
      render(); return true;
    } catch (error) { onError(error); return false; }
    finally { busy = false; }
  };
  const complete = async () => {
    if (busy || !reelLayoutCells(selected()).every((_, index) => Boolean(frames[index]))) return false;
    busy = true;
    try {
      const aspect = guide.clientWidth / Math.max(1, guide.clientHeight);
      const width = Math.min(1920, Math.max(720, video.videoWidth), Math.round(4096 * aspect));
      const height = Math.round(width / aspect);
      await onComplete(composeReelLayout(selected(), frames, { width, height }), 'nexus-layout'); return true;
    }
    catch (error) { onError(error); return false; }
    finally { busy = false; }
  };
  const updateMode = (clip) => { finish.hidden = clip || selected() === 'off' || !reelLayoutCells(selected()).every((_, index) => Boolean(frames[index])); document.getElementById('cameraLayout')?.toggleAttribute('hidden', clip); };
  return Object.freeze({ capture, complete, hasFrames, isComplete: () => selected() !== 'off' && reelLayoutCells(selected()).every((_, index) => Boolean(frames[index])), reset, select, selected, updateMode });
}
