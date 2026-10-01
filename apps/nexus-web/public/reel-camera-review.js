export function reelCameraReviewMarkup() {
  return [
    '<section class="cameraReviewActions" id="cameraReviewActions" hidden aria-label="Preview editor">',
    '<header class="cameraReviewTop"><button id="retakeCamera" type="button" aria-label="Refă captura">‹</button><span id="cameraReviewSound">♫ Add sound</span></header>',
    '<nav class="cameraReviewTools" aria-label="Instrumente preview">',
    '<button type="button" data-review-tool="settings"><i>⚙</i><span>Settings</span></button>',
    '<button type="button" data-review-tool="text"><i>Aa</i><span>Text</span></button>',
    '<button type="button" data-review-tool="stickers"><i>☺</i><span>Stickers</span></button>',
    '<button type="button" data-review-tool="effects"><i>✦</i><span>Effects</span></button>',
    '<button type="button" data-review-tool="filters"><i>◉</i><span>Filters</span></button>',
    '</nav>',
    '<section class="cameraReviewPanel" data-review-panel="settings" hidden><header><b>Settings</b><button type="button" data-review-close>×</button></header><label>Who can view<select data-review-visibility><option value="public">Everyone</option><option value="friends">Friends</option><option value="private">Only you</option></select></label><label>Content disclosure<select data-review-provenance><option value="NOT_DECLARED">Not declared</option><option value="CAMERA_CAPTURED_DECLARED">Created by me</option><option value="AI_ASSISTED">AI-assisted</option><option value="AI_GENERATED">AI-generated</option></select></label></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="text" hidden><header><b>Add text</b><button type="button" data-review-close>×</button></header><div class="cameraReviewText" data-review-text-form><input data-review-text maxlength="120" placeholder="Write on the video…"><button type="button" data-review-text-apply>Apply</button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="stickers" hidden><header><b>Stickers & GIFs</b><button type="button" data-review-close>×</button></header><div class="cameraStickerGrid"><button type="button" data-review-sticker="clock">07:26<small>Clock</small></button><button type="button" data-review-sticker="location">📍<small>Location</small></button><button type="button" data-review-sticker="mood">✨<small>GIF</small></button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="effects" hidden><header><b>Effects</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="VIVID">Glow</button><button type="button" data-review-filter="HIGH_CONTRAST">Drama</button><button type="button" data-review-filter="WARM">Sunrise</button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="filters" hidden><header><b>Filters</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="NONE">Original</button><button type="button" data-review-filter="VIVID">Vivid</button><button type="button" data-review-filter="WARM">Warm</button><button type="button" data-review-filter="MONO">Mono</button></div></section>',
    '<footer class="cameraReviewFooter"><button id="cameraReviewDraft" type="button">Save draft</button><button id="continueCameraPost" type="button">Next</button></footer>',
    '</section>',
  ].join('');
}

const CAMERA_STATES = new Set(['camera-loading', 'camera-ready', 'recording', 'processing-recording', 'review', 'publishing-details', 'error']);
const CAMERA_TRANSITIONS = Object.freeze({
  'camera-loading': new Set(['camera-ready', 'error']),
  'camera-ready': new Set(['recording', 'processing-recording', 'publishing-details', 'error']),
  recording: new Set(['processing-recording', 'error']),
  'processing-recording': new Set(['review', 'camera-ready', 'error']),
  review: new Set(['camera-loading', 'publishing-details', 'error']),
  'publishing-details': new Set(['camera-loading', 'review', 'error']),
  error: new Set(['camera-loading', 'camera-ready']),
});

export function setCameraComposerState(next, { force = false } = {}) {
  const root = document.querySelector('.cameraComposer');
  if (!root || !CAMERA_STATES.has(next)) return false;
  const current = root.dataset.cameraState || 'camera-loading';
  if (!force && current !== next && !CAMERA_TRANSITIONS[current]?.has(next)) return false;
  const surface = document.getElementById('cameraReviewActions');
  const camera = document.getElementById('composerCamera');
  const reviewing = next === 'review';
  root.dataset.cameraState = next;
  root.classList.toggle('cameraReview', reviewing);
  root.classList.toggle('cameraPublishing', next === 'publishing-details');
  if (surface) surface.hidden = !reviewing;
  if (camera) camera.hidden = reviewing || next === 'publishing-details';
  const video = document.querySelector('#preview video');
  if (video) {
    video.controls = !reviewing; video.loop = reviewing; video.muted = reviewing;
    if (reviewing) video.play().catch(() => {});
  }
  if (reviewing) {
    const sound = document.querySelector('#cameraAddSound span')?.textContent || 'Add sound';
    const label = document.getElementById('cameraReviewSound');
    if (label) label.textContent = `♫ ${sound}`;
  }
  return true;
}

export function setCameraReviewMode(visible) {
  return setCameraComposerState(visible ? 'review' : 'publishing-details', { force: true });
}

export function bindCameraReview({ input, studio, caption, restart, applyPreview, releasePreview }) {
  const root = document.querySelector('.cameraComposer');
  const form = input?.form;
  const closePanels = () => document.querySelectorAll('[data-review-panel]').forEach((panel) => { panel.hidden = true; });
  const next = () => {
    closePanels(); setCameraComposerState('publishing-details');
    caption?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    caption?.focus({ preventScroll: true });
  };
  document.getElementById('retakeCamera')?.addEventListener('click', () => {
    releasePreview?.(); input.value = ''; document.getElementById('preview')?.replaceChildren();
    if (studio) studio.hidden = true;
    closePanels(); setCameraComposerState('camera-loading', { force: true }); restart?.();
  });
  document.getElementById('continueCameraPost')?.addEventListener('click', next);
  document.getElementById('cameraReviewDraft')?.addEventListener('click', () => document.getElementById('saveDraft')?.click());
  document.querySelectorAll('[data-review-tool]').forEach((button) => button.addEventListener('click', () => {
    const panel = document.querySelector(`[data-review-panel="${button.dataset.reviewTool}"]`);
    const opening = panel?.hidden; closePanels(); if (panel) panel.hidden = !opening;
  }));
  document.querySelectorAll('[data-review-close]').forEach((button) => button.addEventListener('click', closePanels));
  const visibility = document.querySelector('[data-review-visibility]');
  const provenance = document.querySelector('[data-review-provenance]');
  if (visibility && form?.elements?.visibility) { visibility.value = form.elements.visibility.value; visibility.addEventListener('change', () => { form.elements.visibility.value = visibility.value; }); }
  if (provenance && form?.elements?.provenance) { provenance.value = form.elements.provenance.value; provenance.addEventListener('change', () => { form.elements.provenance.value = provenance.value; }); }
  document.querySelector('[data-review-text-apply]')?.addEventListener('click', () => {
    const value = document.querySelector('[data-review-text]')?.value.trim();
    if (form?.elements?.overlay_text && value) { form.elements.overlay_text.value = value; applyPreview?.(); closePanels(); }
  });
  document.querySelectorAll('[data-review-sticker]').forEach((button) => button.addEventListener('click', () => {
    const values = { clock: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), location: '📍 Location', mood: '✨' };
    if (form?.elements?.overlay_text) { form.elements.overlay_text.value = values[button.dataset.reviewSticker] || ''; applyPreview?.(); closePanels(); }
  }));
  document.querySelectorAll('[data-review-filter]').forEach((button) => button.addEventListener('click', () => {
    if (form?.elements?.studio_filter) { form.elements.studio_filter.value = button.dataset.reviewFilter; form.elements.studio_intensity.value = button.dataset.reviewFilter === 'NONE' ? '0' : '70'; applyPreview?.(); closePanels(); }
  }));
  return () => { root?.classList.remove('cameraReview'); closePanels(); };
}

export function startRecordingDial(camera, durationSeconds, clock = {}) {
  const dial = document.getElementById('stopRecording');
  const elapsed = document.getElementById('cameraRecordingElapsed');
  const duration = Math.max(1, Number(durationSeconds) || 60);
  const now = clock.now || (() => performance.now());
  const requestFrame = clock.requestFrame || ((callback) => requestAnimationFrame(callback));
  const cancelFrame = clock.cancelFrame || ((id) => cancelAnimationFrame(id));
  const started = now(); let frame = 0; let stopped = false;
  camera?.classList.add('recording');
  if (elapsed) { elapsed.hidden = false; elapsed.textContent = '00:00'; }
  const paint = (timestamp = now()) => {
    if (stopped) return;
    const seconds = Math.min(duration, (timestamp - started) / 1000);
    dial?.style.setProperty('--record-progress', `${Math.min(360, seconds / duration * 360)}deg`);
    if (elapsed) {
      const whole = Math.floor(seconds);
      elapsed.textContent = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    }
    if (seconds < duration) frame = requestFrame(paint);
  };
  paint(started);
  return () => { stopped = true; if (frame) cancelFrame(frame); camera?.classList.remove('recording'); dial?.style.removeProperty('--record-progress'); if (elapsed) elapsed.hidden = true; };
}
