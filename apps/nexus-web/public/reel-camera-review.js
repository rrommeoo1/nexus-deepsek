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
    '<section class="cameraReviewPanel compact" data-review-panel="text" hidden><header><b>Add text</b><button type="button" data-review-close>×</button></header><form data-review-text-form><input data-review-text maxlength="120" placeholder="Write on the video…"><button>Apply</button></form></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="stickers" hidden><header><b>Stickers & GIFs</b><button type="button" data-review-close>×</button></header><div class="cameraStickerGrid"><button type="button" data-review-sticker="clock">07:26<small>Clock</small></button><button type="button" data-review-sticker="location">📍<small>Location</small></button><button type="button" data-review-sticker="mood">✨<small>GIF</small></button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="effects" hidden><header><b>Effects</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="VIVID">Glow</button><button type="button" data-review-filter="HIGH_CONTRAST">Drama</button><button type="button" data-review-filter="WARM">Sunrise</button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="filters" hidden><header><b>Filters</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="NONE">Original</button><button type="button" data-review-filter="VIVID">Vivid</button><button type="button" data-review-filter="WARM">Warm</button><button type="button" data-review-filter="MONO">Mono</button></div></section>',
    '<footer class="cameraReviewFooter"><button id="cameraReviewStory" type="button">Your Story</button><button id="continueCameraPost" type="button">Next</button></footer>',
    '</section>',
  ].join('');
}

export function setCameraReviewMode(visible) {
  const root = document.querySelector('.cameraComposer');
  const surface = document.getElementById('cameraReviewActions');
  root?.classList.toggle('cameraReview', Boolean(visible));
  if (surface) surface.hidden = !visible;
  if (visible) {
    const sound = document.querySelector('#cameraAddSound span')?.textContent || 'Add sound';
    const label = document.getElementById('cameraReviewSound');
    if (label) label.textContent = `♫ ${sound}`;
  }
}

export function bindCameraReview({ input, studio, caption, restart, applyPreview }) {
  const root = document.querySelector('.cameraComposer');
  const form = input?.form;
  const closePanels = () => document.querySelectorAll('[data-review-panel]').forEach((panel) => { panel.hidden = true; });
  const next = (story = false) => {
    if (story && form?.elements?.visibility) form.elements.visibility.value = 'followers';
    closePanels(); setCameraReviewMode(false);
    caption?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    caption?.focus({ preventScroll: true });
  };
  document.getElementById('retakeCamera')?.addEventListener('click', () => {
    input.value = ''; document.getElementById('preview')?.replaceChildren();
    if (studio) studio.hidden = true;
    closePanels(); setCameraReviewMode(false); restart?.();
  });
  document.getElementById('continueCameraPost')?.addEventListener('click', () => next(false));
  document.getElementById('cameraReviewStory')?.addEventListener('click', () => next(true));
  document.querySelectorAll('[data-review-tool]').forEach((button) => button.addEventListener('click', () => {
    const panel = document.querySelector(`[data-review-panel="${button.dataset.reviewTool}"]`);
    const opening = panel?.hidden; closePanels(); if (panel) panel.hidden = !opening;
  }));
  document.querySelectorAll('[data-review-close]').forEach((button) => button.addEventListener('click', closePanels));
  const visibility = document.querySelector('[data-review-visibility]');
  const provenance = document.querySelector('[data-review-provenance]');
  if (visibility && form?.elements?.visibility) { visibility.value = form.elements.visibility.value; visibility.addEventListener('change', () => { form.elements.visibility.value = visibility.value; }); }
  if (provenance && form?.elements?.provenance) { provenance.value = form.elements.provenance.value; provenance.addEventListener('change', () => { form.elements.provenance.value = provenance.value; }); }
  document.querySelector('[data-review-text-form]')?.addEventListener('submit', (event) => {
    event.preventDefault(); const value = document.querySelector('[data-review-text]')?.value.trim();
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

export function startRecordingDial(camera, durationSeconds) {
  const dial = document.getElementById('stopRecording');
  const elapsed = document.getElementById('cameraRecordingElapsed');
  const duration = Math.max(1, Number(durationSeconds) || 60);
  const started = performance.now();
  camera?.classList.add('recording'); if (elapsed) elapsed.hidden = false;
  const paint = () => {
    const seconds = Math.min(duration, (performance.now() - started) / 1000);
    dial?.style.setProperty('--record-progress', `${Math.min(360, seconds / duration * 360)}deg`);
    if (elapsed) elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(Math.floor(seconds % 60)).padStart(2,'0')} / ${String(Math.floor(duration / 60)).padStart(2,'0')}:${String(duration % 60).padStart(2,'0')}`;
  };
  paint(); const timer = setInterval(paint, 100);
  return () => { clearInterval(timer); camera?.classList.remove('recording'); dial?.style.removeProperty('--record-progress'); if (elapsed) elapsed.hidden = true; };
}
