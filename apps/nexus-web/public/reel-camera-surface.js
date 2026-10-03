import { cameraVideoConstraints } from "./reel-camera-quality.js?v=20261003-lens1";

const tabs = ["Hot", "For You", "Favorites", "Recent"];
const framingListeners = new WeakMap();

// How much `cover` has to cut out of a frame to fill a surface of another shape: 1 means nothing is lost, 3,26
// means two thirds of the width stay outside the screen. This is the number the camera prints, so the framing
// question is settled with the phone's own answer instead of an argument.
export function cameraSurfaceCut(streamAspect, surfaceAspect) {
  const stream = Number(streamAspect), surface = Number(surfaceAspect);
  if (!(stream > 0) || !(surface > 0)) return 0;
  const kept = stream < surface ? stream / surface : surface / stream;
  return Math.round((1 / kept) * 100) / 100;
}

export const MAX_AUTOMATIC_CAMERA_CROP = 1.2;

export function cameraNeedsFullFrame(video, camera) {
  if (!(video?.videoWidth > 0) || !(video?.videoHeight > 0)) return false;
  const width = camera?.clientWidth || globalThis.window?.innerWidth;
  const height = camera?.clientHeight || globalThis.window?.innerHeight;
  if (!(width > 0) || !(height > 0)) return true;
  return cameraSurfaceCut(video.videoWidth / video.videoHeight,
    width / height) > MAX_AUTOMATIC_CAMERA_CROP;
}

// What the phone actually handed back, on the creator's own screen for a few seconds. The framing question was
// argued from photos twice, so the numbers now show up in the camera itself while the phone answers them: what the
// sensor returned, what was asked for, how big the screen is, and how much the screen costs the picture.
export function showCameraSensorNote(video, camera, seconds = 8) {
  const status = camera?.querySelector(".reelCameraStatus");
  if (!status || !video) return;
  const report = () => {
    if (!video.videoWidth) return;
    const stream = video.videoWidth / video.videoHeight;
    const surface = camera.clientWidth / Math.max(1, camera.clientHeight);
    const fit = camera.dataset.cameraFit === "fit";
    status.textContent = "senzor " + video.videoWidth + "×" + video.videoHeight + " (" + stream.toFixed(2) + ")"
      + (camera.dataset.cameraRequest ? " · cerut " + camera.dataset.cameraRequest : "")
      + " · ecran " + camera.clientWidth + "×" + camera.clientHeight + " (" + surface.toFixed(2) + ") · "
      + (fit ? "fit complet" : "umplut, taiat " + cameraSurfaceCut(stream, surface) + "×");
    camera.classList.add("cameraNote");
    setTimeout(() => camera.classList.remove("cameraNote"), Math.max(0, seconds) * 1000);
  };
  if (video.videoWidth) report(); else video.addEventListener("loadedmetadata", report, { once: true });
}

// The control offers the next preset. The current one is explicit and never silently switches to a crop.
export function applyCameraPreset(camera, aspect = '9:16') {
  camera.dataset.cameraAspect = aspect === '3:4' ? '3:4' : '9:16';
  camera.dataset.cameraFit = 'fit';
  const output = camera.querySelector('.cameraPresetStatus');
  if (output) output.textContent = camera.dataset.cameraAspect === '3:4' ? '3:4 · pregătesc 1×' : '9:16 · pregătesc 0,7×';
  const button = camera.querySelector("#cameraFit");
  if (!button) return;
  const wide = camera.dataset.cameraAspect === '9:16';
  button.setAttribute('aria-pressed', String(!wide));
  button.setAttribute('aria-label', wide ? 'Schimbă la 3:4, zoom 1×' : 'Schimbă la 9:16, zoom 0,7×');
  button.setAttribute('title', wide ? '3:4 · 1×' : '9:16 · 0,7×');
  const label = button.querySelector("small");
  if (label) label.textContent = wide ? '3:4 · 1×' : '9:16 · 0,7×';
}

export function showCameraPresetStatus(camera, { facingMode = 'environment', lens = 'default', zoom = {}, resizeMode } = {}) {
  const output = camera.querySelector('.cameraPresetStatus');
  if (!output) return;
  const aspect = camera.dataset.cameraAspect || '9:16';
  const target = aspect === '3:4' || facingMode === 'user' ? '1×' : '0,7×';
  const label = lens === 'ultrawide' ? 'ultrawide' : zoom.matched ?
    `${Number(zoom.actual).toFixed(1).replace('.', ',')}×` :
    zoom.actual ? `${Number(zoom.actual).toFixed(1).replace('.', ',')}× · ${target} indisponibil` :
    `${target} neconfirmat`;
  output.textContent = `${aspect} · ${label}${resizeMode === 'crop-and-scale' ? ' · decupare browser' : ''}`;
}

// How the phone is held: the screen decides, not the section. A section that is still being laid out (0x0) must
// never be the reason a portrait phone is asked for a landscape frame - that is how the 1080x1920 request became
// the owner's 1920x1080 answer in the first place.
export function cameraSurfaceIsPortrait(camera) {
  return (camera?.clientHeight || window.innerHeight) > (camera?.clientWidth || window.innerWidth);
}

// What was asked of the phone, kept on the surface so the sensor note can print request and answer side by side.
export function markCameraRequest(camera, facingMode, portrait) {
  const asked = cameraVideoConstraints(facingMode, portrait, camera.dataset.cameraAspect || '9:16');
  camera.dataset.cameraRequest = asked.width.ideal + "×" + asked.height.ideal + " (" + (asked.width.ideal / asked.height.ideal).toFixed(2) + ")";
}

// The camera always uses the entire sensor answer. The 9:16 / 3:4 button changes the requested stream and export
// canvas, not object-fit:cover; a landscape-only browser remains letterboxed over a blurred full-screen backdrop.
export function syncCameraFraming(video, camera) {
  const previous = framingListeners.get(video);
  if (previous) {
    video.removeEventListener?.('loadedmetadata', previous);
    video.removeEventListener?.('resize', previous);
  }
  const open = () => { if (video.videoWidth) camera.dataset.cameraFit = 'fit'; };
  if (video.videoWidth) open(); else video.addEventListener("loadedmetadata", open, { once: true });
  video.addEventListener('resize', open);
  framingListeners.set(video, open);
}

export function reelCameraMarkup({ esc, t, selfieFirst = false, clipMode = false }) {
  const button = (id, icon, label, extra = "") => '<button id="' + id + '" type="button" aria-label="' + esc(label) + '" title="' + esc(label) + '" ' + extra + '><i aria-hidden="true">' + icon + '</i><small>' + esc(label) + '</small></button>';
  return [
    '<section class="composerCamera reelCamera" id="composerCamera" data-facing="' + (selfieFirst ? 'user' : 'environment') + '" data-camera-mode="' + (clipMode ? 'clip' : 'photo') + '" data-camera-aspect="9:16" data-camera-fit="fit" data-camera-duration="' + (clipMode ? '60' : '0') + '">',
    // The blurred copy fills unused screen space if a browser returns a landscape stream to the portrait preset.
    '<video id="composerCameraBackdrop" class="reelCameraBackdrop" autoplay muted playsinline aria-hidden="true"></video>',
    '<video id="composerCameraVideo" autoplay muted playsinline></video>',
    '<div class="reelCameraShade" aria-hidden="true"></div>',
    '<button class="reelCameraClose" id="cameraClose" type="button" aria-label="Închide">×</button>',
    '<button class="reelCameraSound" id="cameraAddSound" type="button"><i>♫</i><span>Add sound</span></button>',
    '<nav class="reelCameraTools" aria-label="Instrumente cameră">',
    button('switchCamera', '↻', t('camera.switch')),
    button('cameraFlash', 'ϟ', 'Flash', 'aria-pressed="false" hidden'),
    button('cameraEffects', '✦', 'Effects', 'aria-expanded="false"'),
    button('cameraTimer', '◴', 'Timer', 'aria-pressed="false"'),
    button('cameraLayout', '▦', 'Layout', 'aria-pressed="false" aria-expanded="false"'),
    button('cameraFit', '⤢', '3:4 · 1×', 'aria-pressed="false"'),
    button('cameraBeauty', '✣', 'Retouch', 'aria-pressed="false"'),
    button('cameraFilters', '◉', 'Filters', 'aria-expanded="false"'),
    button('cameraToolsMore', '⌄', 'Collapse tools', 'aria-expanded="true"'),
    '</nav>',
    '<div class="reelCameraLayoutMenu" id="cameraLayoutMenu" role="menu" aria-label="Layout" hidden><button type="button" data-camera-layout="off" class="active"><i>Off</i></button><button type="button" data-camera-layout="split-horizontal" aria-label="Două cadre orizontale"><i>▭</i></button><button type="button" data-camera-layout="split-vertical" aria-label="Două cadre verticale"><i>▯</i></button><button type="button" data-camera-layout="three-horizontal" aria-label="Trei cadre"><i>☰</i></button><button type="button" data-camera-layout="grid-four" aria-label="Patru cadre"><i>⊞</i></button><button type="button" data-camera-layout="grid-six" aria-label="Șase cadre"><i>▦</i></button></div>',
    '<div class="reelCameraLayoutGuide" id="cameraLayoutGuide" aria-label="Cadre layout"></div>',
    '<div class="reelCameraEffects" id="cameraEffectRail" hidden><button type="button" data-camera-filter="none" class="active"><i></i><span>Normal</span></button><button type="button" data-camera-filter="vivid"><i></i><span>Vivid</span></button><button type="button" data-camera-filter="warm"><i></i><span>Warm</span></button><button type="button" data-camera-filter="mono"><i></i><span>Mono</span></button></div>',
    '<div class="reelCameraDuration reelCameraCaptureModes" role="tablist" aria-label="Mod cameră"><button type="button" role="tab" aria-selected="' + String(!clipMode) + '" data-camera-mode="photo" class="' + (clipMode ? '' : 'active') + '">PHOTO</button><button type="button" role="tab" aria-selected="' + String(clipMode) + '" data-camera-mode="clip" class="' + (clipMode ? 'active' : '') + '">VIDEO</button></div>',
    '<div class="reelCameraCapture"><button id="capturePhoto" type="button" class="reelShutter" aria-label="' + esc(t('camera.photo')) + '"><i></i></button><button id="recordClip" type="button" class="reelShutter reelRecord" aria-label="' + esc(t('camera.clip')) + '"><i></i></button><button id="stopRecording" type="button" class="reelShutter reelStop" aria-label="' + esc(t('camera.stop')) + '" hidden><i>■</i></button><button id="finishRecording" type="button" class="reelRecordingDone" aria-label="Finalizează clipul" hidden>✓</button><button id="finishLayout" type="button" class="reelRecordingDone reelLayoutDone" aria-label="Finalizează fotografia compusă" hidden>✓</button><div class="reelCameraFaces" aria-label="Efecte rapide"><button type="button" data-camera-filter="vivid">✦</button><button type="button" data-camera-filter="warm">☀</button><button type="button" data-camera-filter="mono">◐</button></div></div>',
    '<output class="cameraRecordingElapsed" id="cameraRecordingElapsed" hidden aria-live="off"></output>',
    '<output class="reelCameraCountdown" id="cameraCountdown" hidden aria-live="assertive"></output>',
    '<button class="reelCameraGallery" id="cameraGallery" type="button" aria-label="' + esc(t('camera.gallery')) + '"><i>▧</i><b>+</b></button>',
    '<nav class="reelCameraModes" aria-label="Mod creare"><button type="button" data-camera-destination="camera" class="active">CAMERA</button><button type="button" data-camera-destination="create">CREATE</button><button type="button" data-camera-destination="live">LIVE</button></nav>',
    '<div class="cameraActiveBadge"><i></i><span>' + esc(t('camera.activeBadge')) + '</span></div>',
    '<output class="cameraPresetStatus" role="status" aria-live="polite">9:16 · pregătesc 0,7×</output>',
    '<div class="cameraRecovery" hidden><button id="retryCamera" type="button">' + esc(t('camera.retry')) + '</button></div>',
    '<small class="reelCameraStatus">' + esc(t('camera.instruction')) + '</small>',
    '</section>',
  ].join('');
}

function soundStorageKey(kind, owner) { return `nexus:jamendo:${kind}:v1:${Number(owner) || 0}`; }
function readTracks(kind, owner) {
  try { const value = JSON.parse(localStorage.getItem(soundStorageKey(kind, owner)) || '[]'); return Array.isArray(value) ? value.slice(0, 20) : []; }
  catch { return []; }
}
function writeTracks(kind, owner, tracks) {
  try { localStorage.setItem(soundStorageKey(kind, owner), JSON.stringify(tracks.slice(0, 20))); } catch { /* optional device history */ }
}

export function openReelSoundCatalogue({ api, owner, current = null, onSelect }) {
  document.querySelector('.reelSoundCatalogueBackdrop')?.remove();
  const backdrop = document.createElement('div'); backdrop.className = 'reelSoundCatalogueBackdrop';
  const sheet = document.createElement('section'); sheet.className = 'reelSoundCatalogue'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Alege sunet');
  sheet.tabIndex = -1;
  const grab = document.createElement('i'); grab.className = 'reelSoundGrab';
  const nav = document.createElement('nav'); nav.className = 'reelSoundTabs';
  const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.className = 'reelSoundSearchToggle'; searchButton.textContent = '⌕'; searchButton.setAttribute('aria-label', 'Caută sunet');
  const search = document.createElement('form'); search.className = 'reelCatalogueSearch'; search.hidden = true;
  const input = document.createElement('input'); input.type = 'search'; input.maxLength = 80; input.placeholder = 'Caută piesă sau artist';
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Caută'; search.append(input, submit);
  const list = document.createElement('div'); list.className = 'reelSoundCatalogueList'; list.setAttribute('aria-live', 'polite');
  const player = document.createElement('audio'); player.preload = 'metadata'; player.hidden = true;
  let active = 'For You'; let selected = current; let tracks = [];
  const close = () => { player.pause(); backdrop.remove(); };
  const remember = (track) => {
    const recent = [track, ...readTracks('recent', owner).filter((item) => item.id !== track.id)];
    writeTracks('recent', owner, recent);
  };
  const favorite = (track, control) => {
    const favorites = readTracks('favorites', owner); const exists = favorites.some((item) => item.id === track.id);
    writeTracks('favorites', owner, exists ? favorites.filter((item) => item.id !== track.id) : [track, ...favorites]);
    control.classList.toggle('on', !exists); control.setAttribute('aria-pressed', String(!exists));
    if (active === 'Favorites' && exists) paint(readTracks('favorites', owner));
  };
  const paint = (items) => {
    list.className = 'reelSoundCatalogueList';
    tracks = items.slice(0, 12); list.replaceChildren();
    if (!tracks.length) { const empty = document.createElement('p'); empty.textContent = active === 'Favorites' ? 'Nu ai sunete favorite încă.' : 'Nu am găsit sunete.'; list.append(empty); return; }
    const favoriteIds = new Set(readTracks('favorites', owner).map((item) => item.id));
    for (const track of tracks) {
      const row = document.createElement('article'); row.className = 'reelSoundCatalogueRow'; row.classList.toggle('selected', selected?.id === track.id);
      const cover = document.createElement('i'); cover.className = 'reelSoundCover'; if (track.image_url) { const image = document.createElement('img'); image.src = track.image_url; image.alt = ''; cover.append(image); } else cover.textContent = '♫';
      const details = document.createElement('button'); details.type = 'button'; details.className = 'reelSoundDetails';
      const name = document.createElement('b'); name.textContent = track.name;
      const meta = document.createElement('small'); const minutes = Math.floor(track.duration / 60); const seconds = String(track.duration % 60).padStart(2, '0'); meta.textContent = `${track.artist} · ${minutes}:${seconds}`; details.append(name, meta);
      details.onclick = () => { selected = track; player.src = track.audio_url; player.currentTime = Number(track.preview_offset || 0); player.play().catch(() => {}); onSelect(track); remember(track); close(); };
      const trim = document.createElement('button'); trim.type = 'button'; trim.className = 'reelSoundTrim'; trim.textContent = '✂'; trim.setAttribute('aria-label', 'Alege începutul');
      trim.onclick = () => { const maximum = Math.max(0, Number(track.duration) - Number(track.segment_seconds || 30)); const next = maximum ? (Number(track.preview_offset || 0) + 15) % (maximum + 1) : 0; track.preview_offset = Math.round(next); meta.textContent = `${track.artist} · începe la ${track.preview_offset}s`; player.src = track.audio_url; player.currentTime = track.preview_offset; player.play().catch(() => {}); };
      const save = document.createElement('button'); save.type = 'button'; save.className = 'reelSoundFavorite'; save.textContent = '♡'; save.setAttribute('aria-label', 'Favorite'); save.classList.toggle('on', favoriteIds.has(track.id)); save.setAttribute('aria-pressed', String(favoriteIds.has(track.id))); save.onclick = () => favorite(track, save);
      row.append(cover, details, trim, save); list.append(row);
    }
  };
  const load = async (tab = active, query = '') => {
    active = tab; [...nav.children].forEach((entry) => entry.classList.toggle('active', entry.dataset.tab === active)); list.className = 'reelSoundCatalogueList loading'; list.textContent = 'Se caută sunete…';
    if (tab === 'Favorites' || tab === 'Recent') return paint(readTracks(tab.toLowerCase(), owner));
    const profile = tab === 'Hot' ? { motion: 'dynamic', brightness: 'bright' } : { motion: 'moderate', brightness: 'balanced' };
    const params = new URLSearchParams({ ...profile, duration: '30', ...(query ? { q: query } : {}) });
    const result = await api(`/api/reels/sound-suggestions?${params}`).catch(() => null);
    if (!backdrop.isConnected) return;
    if (!result?.ok) { list.className = 'reelSoundCatalogueList error'; list.textContent = result?.code === 'JAMENDO_NOT_CONFIGURED' ? 'Catalogul Jamendo nu este configurat încă.' : 'Sunetele nu sunt disponibile momentan.'; return; }
    paint(result.tracks || []);
  };
  for (const label of tabs) { const entry = document.createElement('button'); entry.type = 'button'; entry.dataset.tab = label; entry.textContent = label; entry.classList.toggle('active', label === active); entry.onclick = () => load(label); nav.append(entry); }
  nav.append(searchButton); searchButton.onclick = () => { search.hidden = !search.hidden; if (!search.hidden) input.focus(); };
  search.onsubmit = (event) => { event.preventDefault(); if (input.value.trim()) load('For You', input.value.trim()); };
  sheet.append(grab, nav, search, list, player); backdrop.append(sheet); (document.querySelector('.phoneScreen') || document.body).append(backdrop);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  sheet.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  load(); sheet.focus();
  return close;
}
