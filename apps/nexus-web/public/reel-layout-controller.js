import { composeReelLayout, reelLayoutCells } from './reel-layout.js?v=20261001-camera11';

function cameraFrame(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.filter = video.style.filter || 'none'; context.drawImage(video, 0, 0);
  return canvas;
}

export function createReelLayoutController({ camera, video, guide, finish, setState, onComplete, onError }) {
  let frames = []; let active = 0; let busy = false;
  const selected = () => camera.dataset.layout || 'off';
  const hasFrames = () => frames.some(Boolean);
  const render = () => {
    guide.replaceChildren();
    const layout = selected(); const cells = reelLayoutCells(layout);
    camera.classList.toggle('layoutActive', layout !== 'off');
    if (layout === 'off') { finish.hidden = true; return; }
    cells.forEach((cell, index) => {
      const control = document.createElement('button'); control.type = 'button'; control.className = 'reelLayoutCell';
      control.classList.toggle('active', index === active); control.classList.toggle('captured', Boolean(frames[index]));
      Object.assign(control.style, { left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, width: `${cell.width * 100}%`, height: `${cell.height * 100}%` });
      control.setAttribute('aria-label', frames[index] ? `Refă cadrul ${index + 1}` : `Cadrul ${index + 1}`);
      if (frames[index]) {
        const preview = document.createElement('canvas'); preview.width = frames[index].width; preview.height = frames[index].height;
        preview.getContext('2d')?.drawImage(frames[index], 0, 0); control.append(preview);
        control.onclick = () => { active = index; setState('layout-capturing', { force: true }); render(); };
      } else { const marker = document.createElement('b'); marker.textContent = String(index + 1); control.append(marker); }
      guide.append(control);
    });
    finish.hidden = frames.length !== cells.length || frames.some((frame) => !frame);
  };
  const reset = (layout = 'off') => {
    frames = []; active = 0; camera.dataset.layout = layout; render();
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
      const frame = cameraFrame(video); if (!frame) throw new Error('CANVAS_UNAVAILABLE');
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
    if (busy || frames.some((frame) => !frame)) return false;
    busy = true;
    try { await onComplete(composeReelLayout(selected(), frames, { width: video.videoWidth, height: video.videoHeight }), 'nexus-layout'); return true; }
    catch (error) { onError(error); return false; }
    finally { busy = false; }
  };
  const updateMode = (clip) => { finish.hidden = clip || selected() === 'off' || frames.some((frame) => !frame); document.getElementById('cameraLayout')?.toggleAttribute('hidden', clip); };
  return Object.freeze({ capture, complete, hasFrames, reset, select, selected, updateMode });
}
