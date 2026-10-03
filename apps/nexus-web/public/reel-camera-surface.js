const tabs = ["Hot", "For You", "Favorites", "Recent"];

// What the phone actually handed back, on the creator's own screen for a few seconds. The framing question was
// argued from photos twice, so the numbers now show up in the camera itself while the phone answers them.
export function showCameraSensorNote(video, camera, seconds = 8) {
  const status = camera?.querySelector(".reelCameraStatus");
  if (!status || !video) return;
  const report = () => {
    if (!video.videoWidth) return;
    const stream = (video.videoWidth / video.videoHeight).toFixed(2);
    const surface = (camera.clientWidth / Math.max(1, camera.clientHeight)).toFixed(2);
    status.textContent = "senzor " + video.videoWidth + "×" + video.videoHeight + " (" + stream + ") · ecran "
      + camera.clientWidth + "×" + camera.clientHeight + " (" + surface + ") · " + (camera.dataset.cameraFit || "fit");
    camera.classList.add("cameraNote");
    setTimeout(() => camera.classList.remove("cameraNote"), Math.max(0, seconds) * 1000);
  };
  if (video.videoWidth) report(); else video.addEventListener("loadedmetadata", report, { once: true });
}

// The framing follows the stream the phone actually hands back: a portrait stream close to the screen shape fills
// it crisply - what the native camera the owner compared against does - while a wider stream would only fill it by
// cutting a large part of the picture away, so that one opens on the whole view with the blurred copy behind it.
// Whichever way it opens, the creator's own tap wins for the rest of the session.
export function applyCameraFraming(camera, fit) {
  camera.dataset.cameraFit = fit ? "fit" : "fill";
  const button = camera.querySelector("#cameraFit");
  if (!button) return;
  button.setAttribute("aria-pressed", String(Boolean(fit)));
  button.setAttribute("aria-label", fit ? "Umple ecranul" : "Încadrează complet");
  const label = button.querySelector("small");
  if (label) label.textContent = fit ? "Umple" : "Încadrează";
}

export function syncCameraFraming(video, camera) {
  const decide = () => {
    if (!video.videoWidth) return;
    const stream = video.videoWidth / video.videoHeight;
    const surface = camera.clientWidth / Math.max(1, camera.clientHeight);
    const kept = stream < surface ? stream / surface : surface / stream;
    applyCameraFraming(camera, 1 / kept > 2);
  };
  if (video.videoWidth) decide(); else video.addEventListener("loadedmetadata", decide, { once: true });
}

export function reelCameraMarkup({ esc, t, selfieFirst = false, clipMode = false }) {
  const button = (id, icon, label, extra = "") => '<button id="' + id + '" type="button" aria-label="' + esc(label) + '" title="' + esc(label) + '" ' + extra + '><i aria-hidden="true">' + icon + '</i><small>' + esc(label) + '</small></button>';
  return [
    // Fit, not fill, is the opening framing: the owner photographed his own room on 2 octombrie 2026 and the
    // phone's wider stream was cropped about 2,9x by `cover` in fill, while the whole picture is what the native
    // camera he compared with shows. "Umple" is one tap away for anybody who wants the full-bleed crop.
    '<section class="composerCamera reelCamera" id="composerCamera" data-facing="' + (selfieFirst ? 'user' : 'environment') + '" data-camera-mode="' + (clipMode ? 'clip' : 'photo') + '" data-camera-fit="fit" data-camera-duration="' + (clipMode ? '60' : '0') + '">',
    // A blurred copy of the same frame stands behind the picture: the surface still reads as full screen while
    // the creator keeps the whole field of view the phone hands back, instead of a crop of its middle.
    '<video id="composerCameraBackdrop" class="reelCameraBackdrop" muted playsinline aria-hidden="true"></video>',
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
    button('cameraFit', '⤢', 'Umple', 'aria-pressed="true"'),
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
