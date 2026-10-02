import { bindLocationSticker, bindStickerCatalogue, bindTextEditor } from './reel-editor-overlays.js?v=20261001-publish1';

export function reelCameraReviewMarkup() {
  return [
    '<section class="cameraReviewActions" id="cameraReviewActions" hidden aria-label="Preview editor">',
    '<header class="cameraReviewTop"><button id="retakeCamera" type="button" aria-label="Înapoi">‹</button><button id="cameraReviewSound" type="button">♫ Add sound</button></header>',
    '<nav class="cameraReviewTools" aria-label="Instrumente preview">',
    '<button type="button" data-review-tool="settings"><i>⚙</i><span>Settings</span></button>',
    '<button type="button" data-review-tool="text"><i>Aa</i><span>Text</span></button>',
    '<button type="button" data-review-tool="stickers"><i>☺</i><span>Stickers</span></button>',
    '<button type="button" data-review-tool="location"><i>⌖</i><span>Location</span></button>',
    '<button type="button" data-review-tool="effects"><i>✦</i><span>Effects</span></button>',
    '<button type="button" data-review-tool="filters"><i>◉</i><span>Filters</span></button>',
    '</nav>',
    '<section class="cameraReviewPanel" data-review-panel="settings" hidden><header><b>Settings</b><button type="button" data-review-close>×</button></header><label>Who can view<select data-review-visibility><option value="public">Everyone</option><option value="friends">Friends</option><option value="private">Only you</option></select></label><label>Content disclosure<select data-review-provenance><option value="NOT_DECLARED">Not declared</option><option value="CAMERA_CAPTURED_DECLARED">Created by me</option><option value="AI_ASSISTED">AI-assisted</option><option value="AI_GENERATED">AI-generated</option></select></label></section>',
    '<section class="cameraReviewPanel cameraTextEditor" data-review-panel="text" hidden><div class="textEditorTop"><button type="button" data-text-background aria-label="Fundal text">A</button><div class="textColorDots"><button type="button" data-text-color="#ffffff" aria-label="Alb"></button><button type="button" data-text-color="#ff315c" aria-label="Roz"></button><button type="button" data-text-color="#25e3d2" aria-label="Turcoaz"></button><button type="button" data-text-color="#ffe34f" aria-label="Galben"></button></div><button type="button" data-text-align aria-label="Aliniere">☰</button><button type="button" class="textDone" data-text-done>Done</button></div><input class="textCanvasInput" data-review-text maxlength="120" placeholder="Scrie text…"><nav class="textStyleRail" aria-label="Stil text"><button type="button" class="active" data-text-style="classic">Classic</button><button type="button" data-text-style="elegance">Elegance</button><button type="button" data-text-style="neon">Neon</button><button type="button" data-text-style="retro">Retro</button><button type="button" data-text-style="comic">Comic</button><button type="button" data-text-style="typewriter">Typewriter</button><button type="button" data-text-style="bold">Bold</button><button type="button" data-text-style="outline">Outline</button><button type="button" data-text-style="handwriting">Handwriting</button></nav><div class="textQuickActions"><button type="button" data-text-mention>@ Mention</button><button type="button" data-text-pov>POV</button></div></section>',
    '<section class="cameraReviewPanel cameraStickerPanel" data-review-panel="stickers" hidden><i class="panelGrab" aria-hidden="true"></i><header><b>Stickers & GIFs</b><button type="button" data-review-close>×</button></header><label class="stickerSearch"><i>⌕</i><input data-sticker-search type="search" placeholder="Search GIFs and stickers"></label><nav class="stickerCategories" data-sticker-categories aria-label="Categorii stickere"></nav><h3>Recommended</h3><div class="functionalStickers"><button type="button" data-functional-sticker="mention"><b>@</b> Mention</button><button type="button" data-functional-sticker="hashtag"><b>#</b> Hashtag</button><button type="button" data-functional-sticker="poll"><b>▥</b> Poll</button><button type="button" data-functional-sticker="donation"><b>◈</b> Donation</button><button type="button" data-functional-sticker="location"><b>●</b> Location</button><button type="button" data-functional-sticker="live-time"><b>LIVE</b> 12:30</button><button type="button" data-functional-sticker="digital-clock"><b>24:00</b></button><button type="button" data-functional-sticker="analog-clock"><b>◷</b> Clock</button><button type="button" data-functional-sticker="date"><b>12/29</b></button><button type="button" data-functional-sticker="gif"><b>GIF</b></button></div><div class="cameraStickerGrid" data-sticker-grid></div><button class="stickerMore" data-sticker-more type="button">Load more</button><small class="stickerSource">Nexus Visual · local SVG catalogue · no tracking</small></section>',
    '<section class="cameraReviewPanel cameraLocationPanel" data-review-panel="location" hidden><i class="panelGrab" aria-hidden="true"></i><header><b>Location</b><button type="button" data-review-close>×</button></header><p data-location-status>GPS-ul pornește numai dacă apeși butonul.</p><button class="locationGps" data-location-gps type="button">⌖ Folosește locația mea</button><nav class="locationPrecision" aria-label="Precizia locației"><button type="button" data-location-precision="exact">Loc exact</button><button type="button" class="active" data-location-precision="area">Zonă</button><button type="button" data-location-precision="city">Oraș</button></nav><div class="locationNearby"><button type="button" data-location-nearby="restaurant">Restaurante</button><button type="button" data-location-nearby="hotel">Hoteluri</button><button type="button" data-location-nearby="attraction">Atracții</button></div><nav class="locationStyles" aria-label="Stil etichetă"><button type="button" class="active" data-location-style="pill-light">📍 București</button><button type="button" data-location-style="pill-dark">📍 București</button><button type="button" data-location-style="plain">📍 București</button></nav><div class="locationManual"><input data-location-manual maxlength="120" placeholder="Caută sau scrie o adresă"><button type="button" data-location-search>Caută</button><button type="button" data-location-add>Folosește textul</button></div><div class="locationResults" data-location-results></div><small>Geocodare © OpenStreetMap contributors, ODbL. Coordonatele nu sunt salvate în postare.</small></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="effects" hidden><header><b>Effects</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="VIVID">Glow</button><button type="button" data-review-filter="HIGH_CONTRAST">Drama</button><button type="button" data-review-filter="WARM">Sunrise</button></div></section>',
    '<section class="cameraReviewPanel compact" data-review-panel="filters" hidden><header><b>Filters</b><button type="button" data-review-close>×</button></header><div class="cameraChoiceRail"><button type="button" data-review-filter="NONE">Original</button><button type="button" data-review-filter="VIVID">Vivid</button><button type="button" data-review-filter="WARM">Warm</button><button type="button" data-review-filter="MONO">Mono</button></div></section>',
    '<section class="decorationTimeline" id="decorationTimeline" hidden><header><b>Durata elementului</b><button type="button" data-decoration-timeline-close aria-label="Închide">×</button></header><div><label>Start <output data-decoration-start-output>0.0s</output><input data-decoration-start-range type="range" min="0" max="600" step="0.1" value="0"></label><label>Final <output data-decoration-end-output>600.0s</output><input data-decoration-end-range type="range" min="0" max="600" step="0.1" value="600"></label></div></section><footer class="cameraReviewFooter"><button id="cameraReviewDraft" type="button">Save draft</button><button id="continueCameraPost" type="button">Next</button></footer>',
    '</section>',
  ].join('');
}

const CAMERA_STATES = new Set(['camera-loading', 'camera-ready', 'photo-capture', 'layout-capturing', 'layout-complete', 'recording', 'processing', 'processing-recording', 'review', 'publishing-details', 'error']);
const CAMERA_TRANSITIONS = Object.freeze({
  'camera-loading': new Set(['camera-ready', 'error']),
  'camera-ready': new Set(['photo-capture', 'layout-capturing', 'recording', 'processing', 'processing-recording', 'publishing-details', 'error']),
  'photo-capture': new Set(['layout-capturing', 'layout-complete', 'processing', 'error']),
  'layout-capturing': new Set(['photo-capture', 'layout-complete', 'camera-ready', 'error']),
  'layout-complete': new Set(['layout-capturing', 'processing', 'camera-ready', 'error']),
  processing: new Set(['review', 'camera-ready', 'error']),
  recording: new Set(['processing-recording', 'processing', 'error']),
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

export function bindCameraReview({ input, studio, caption, restart, applyPreview, releasePreview, api, beforeRetake }) {
  const root = document.querySelector('.cameraComposer');
  const form = input?.form;
  const closePanels = () => document.querySelectorAll('[data-review-panel]').forEach((panel) => { panel.hidden = true; });
  const next = () => {
    closePanels(); setCameraComposerState('publishing-details');
    document.querySelector('#preview video')?.pause();
  };
  document.getElementById('retakeCamera')?.addEventListener('click', async () => {
    if(input.files?.length && !window.confirm('Revii la cameră? Captura și editările rămân în draft.'))return;
    try { await beforeRetake?.(); } catch { window.alert('Draftul nu a putut fi salvat. Captura rămâne în preview.'); return; }
    if(!form.isConnected)return;
    delete form.dataset.draftId;
    releasePreview?.(); input.value = ''; document.getElementById('preview')?.replaceChildren();
    if (studio) studio.hidden = true;
    closePanels(); setCameraComposerState('camera-loading', { force: true }); restart?.();
  });
  document.getElementById('continueCameraPost')?.addEventListener('click', next);
  document.getElementById('cameraReviewDraft')?.addEventListener('click', () => document.getElementById('saveDraft')?.click());
  const soundPanel=document.createElement('section');soundPanel.className='cameraReviewPanel';soundPanel.dataset.reviewPanel='sound';soundPanel.hidden=true;soundPanel.innerHTML='<header><b>Sunet</b><button type="button" data-review-close>×</button></header>';
  const autoSound=document.getElementById('reelAutoSound');if(autoSound)soundPanel.append(autoSound);document.getElementById('cameraReviewActions')?.append(soundPanel);
  document.getElementById('cameraReviewSound')?.addEventListener('click',()=>{closePanels();soundPanel.hidden=false;});
  document.querySelectorAll('[data-review-tool]').forEach((button) => button.addEventListener('click', () => {
    const panel = document.querySelector(`[data-review-panel="${button.dataset.reviewTool}"]`);
    const opening = panel?.hidden; closePanels(); if (panel) panel.hidden = !opening;
  }));
  document.querySelectorAll('[data-review-close]').forEach((button) => button.addEventListener('click', closePanels));
  const visibility = document.querySelector('[data-review-visibility]');
  const provenance = document.querySelector('[data-review-provenance]');
  if (visibility && form?.elements?.visibility) { visibility.value = form.elements.visibility.value; visibility.addEventListener('change', () => { form.elements.visibility.value = visibility.value; form.dispatchEvent(new Event('input',{bubbles:true})); }); }
  if (provenance && form?.elements?.provenance) { provenance.value = form.elements.provenance.value; provenance.addEventListener('change', () => { form.elements.provenance.value = provenance.value; form.dispatchEvent(new Event('input',{bubbles:true})); }); }
  bindStickerCatalogue({ form, applyPreview });
  bindTextEditor({ form, applyPreview });
  bindLocationSticker({ form, applyPreview, api });
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
