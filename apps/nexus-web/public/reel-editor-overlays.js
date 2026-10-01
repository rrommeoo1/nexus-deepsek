import { STICKER_CATEGORIES, stickerCatalogPage } from './reel-sticker-catalog.js?v=20261001-camera10';

export function readStudioDecorations(form) {
  try {
    const parsed = JSON.parse(form?.elements?.studio_decorations?.value || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch { return []; }
}

export function studioDecorationsMarkup(decorations, escapeText) {
  return (Array.isArray(decorations) ? decorations : []).map((item) => '<span class="studioDecoration decoration' + escapeText(item.type === 'LOCATION' ? 'Location' : 'Sticker') + '" style="left:' + Number(item.x) + '%;top:' + Number(item.y) + '%;transform:translate(-50%,-50%) rotate(' + Number(item.rotation) + 'deg) scale(' + Number(item.scale) + ')" data-decoration-start="' + Number(item.startMs || 0) + '" data-decoration-end="' + Number(item.endMs || 600000) + '">' + escapeText(item.text) + '</span>').join('');
}

export function bindStudioDecorationTimeline(video) {
  const items = video.closest('.studioMedia')?.querySelectorAll('[data-decoration-start]') || [];
  const synchronize = () => items.forEach((item) => { const time = video.currentTime * 1000; item.hidden = time < Number(item.dataset.decorationStart || 0) || time > Number(item.dataset.decorationEnd || 600000); });
  video.addEventListener('timeupdate', synchronize); video.addEventListener('seeked', synchronize);
}

function writeDecorations(form, decorations, applyPreview) {
  if (!form?.elements?.studio_decorations) return;
  form.elements.studio_decorations.value = JSON.stringify(decorations.slice(0, 12));
  form.dispatchEvent(new Event('input', { bubbles: true }));
  applyPreview?.();
}

export function renderStudioDecorations(stage, decorations, { form = null, applyPreview = null, interactive = false } = {}) {
  stage?.querySelectorAll('.studioDecoration').forEach((node) => node.remove());
  decorations.forEach((decoration, index) => {
    const item = document.createElement('span'); item.className = `studioDecoration decoration${decoration.type === 'LOCATION' ? 'Location' : 'Sticker'}`;
    item.dataset.decorationIndex = String(index); item.style.left = `${decoration.x}%`; item.style.top = `${decoration.y}%`;
    item.style.transform = `translate(-50%,-50%) rotate(${decoration.rotation}deg) scale(${decoration.scale})`;
    item.textContent = decoration.text;
    if (interactive) {
      item.tabIndex = 0; item.setAttribute('role', 'button'); item.setAttribute('aria-label', `${decoration.text}. Mută stickerul`);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'decorationDelete'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Șterge stickerul');
      const resize = document.createElement('button'); resize.type = 'button'; resize.className = 'decorationResize'; resize.textContent = '↗'; resize.setAttribute('aria-label', 'Redimensionează stickerul');
      const rotate = document.createElement('button'); rotate.type = 'button'; rotate.className = 'decorationRotate'; rotate.textContent = '↻'; rotate.setAttribute('aria-label', 'Rotește stickerul');
      item.append(remove, resize, rotate);
      remove.onclick = (event) => { event.stopPropagation(); const next = readStudioDecorations(form); next.splice(index, 1); writeDecorations(form, next, applyPreview); };
      resize.onclick = (event) => { event.stopPropagation(); const next = readStudioDecorations(form); next[index].scale = Number(Math.min(2.4, next[index].scale + .2).toFixed(2)); writeDecorations(form, next, applyPreview); };
      rotate.onclick = (event) => { event.stopPropagation(); const next = readStudioDecorations(form); next[index].rotation = (next[index].rotation + 15) % 360; writeDecorations(form, next, applyPreview); };
      item.addEventListener('pointerdown', (event) => {
        if (event.target !== item) return;
        item.setPointerCapture?.(event.pointerId); const bounds = stage.getBoundingClientRect();
        const move = (moveEvent) => { item.style.left = `${Math.max(4, Math.min(96, (moveEvent.clientX - bounds.left) / bounds.width * 100))}%`; item.style.top = `${Math.max(4, Math.min(96, (moveEvent.clientY - bounds.top) / bounds.height * 100))}%`; };
        const finish = (upEvent) => { item.removeEventListener('pointermove', move); const next = readStudioDecorations(form); next[index].x = Math.round(Math.max(4, Math.min(96, (upEvent.clientX - bounds.left) / bounds.width * 100))); next[index].y = Math.round(Math.max(4, Math.min(96, (upEvent.clientY - bounds.top) / bounds.height * 100))); writeDecorations(form, next, applyPreview); };
        item.addEventListener('pointermove', move); item.addEventListener('pointerup', finish, { once: true });
      });
    }
    stage?.append(item);
  });
}

function newDecoration(type, text) {
  return { id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, text: String(text).slice(0, 120), x: 50, y: 48, scale: 1, rotation: 0, startMs: 0, endMs: 600000 };
}

export function bindStickerCatalogue({ form, applyPreview }) {
  const panel = document.querySelector('[data-review-panel="stickers"]'); if (!panel) return;
  const categories = panel.querySelector('[data-sticker-categories]'); const grid = panel.querySelector('[data-sticker-grid]');
  const search = panel.querySelector('[data-sticker-search]'); const more = panel.querySelector('[data-sticker-more]');
  let active = 'Trending'; let page = 0; let query = '';
  const recentKey = 'nexus:reel-stickers:recent:v1'; const favoritesKey = 'nexus:reel-stickers:favorites:v1';
  const readIds = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.slice(0, 100) : []; } catch { return []; } };
  const saveIds = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value.slice(0, 100))); } catch { /* device storage optional */ } };
  const add = (sticker) => {
    const decorations = readStudioDecorations(form); if (decorations.length >= 12) return;
    decorations.push(newDecoration('STICKER', sticker.content)); writeDecorations(form, decorations, applyPreview);
    saveIds(recentKey, [sticker.id, ...readIds(recentKey).filter((id) => id !== sticker.id)]);
  };
  const paint = (append = false) => {
    const result = stickerCatalogPage({ category: active, query, page }); if (!append) grid.replaceChildren();
    const favoriteIds = new Set(readIds(favoritesKey));
    result.items.forEach((sticker) => {
      const cell = document.createElement('article'); cell.className = 'stickerCell';
      const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'stickerChoose'; choose.textContent = sticker.content; choose.title = sticker.label; choose.onclick = () => add(sticker);
      const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'stickerFavorite'; favorite.textContent = favoriteIds.has(sticker.id) ? '♥' : '♡'; favorite.setAttribute('aria-label', 'Favorite');
      favorite.onclick = () => { const ids = readIds(favoritesKey); const has = ids.includes(sticker.id); saveIds(favoritesKey, has ? ids.filter((id) => id !== sticker.id) : [sticker.id, ...ids]); favorite.textContent = has ? '♡' : '♥'; };
      cell.append(choose, favorite); grid.append(cell);
    });
    more.hidden = !result.hasMore;
  };
  STICKER_CATEGORIES.forEach((category) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = category; button.className = category === active ? 'active' : ''; button.onclick = () => { active = category; page = 0; categories.querySelectorAll('button').forEach((entry) => entry.classList.toggle('active', entry === button)); paint(); }; categories.append(button); });
  search.addEventListener('input', () => { query = search.value.trim(); page = 0; paint(); });
  more.addEventListener('click', () => { page += 1; paint(true); }); paint();
}

export function bindLocationSticker({ form, applyPreview, api }) {
  const panel = document.querySelector('[data-review-panel="location"]'); if (!panel) return;
  const status = panel.querySelector('[data-location-status]'); const results = panel.querySelector('[data-location-results]');
  const manual = panel.querySelector('[data-location-manual]'); const addManual = panel.querySelector('[data-location-add]'); const search = panel.querySelector('[data-location-search]');
  let coords = null;
  const add = (label) => { const value = String(label || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 116); if (!value) return; const decorations = readStudioDecorations(form); if (decorations.length >= 12) return; decorations.push(newDecoration('LOCATION', `📍 ${value}`)); writeDecorations(form, decorations, applyPreview); };
  const paintResults = (items) => { results.replaceChildren(); (items || []).forEach((item) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = item.label; button.onclick = () => add(item.label); results.append(button); }); };
  panel.querySelectorAll('[data-location-precision]').forEach((button) => button.addEventListener('click', () => { panel.querySelectorAll('[data-location-precision]').forEach((entry) => entry.classList.toggle('active', entry === button)); }));
  panel.querySelector('[data-location-gps]')?.addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent = 'GPS indisponibil. Poți introduce locația manual.'; return; }
    status.textContent = 'Se caută locația…';
    navigator.geolocation.getCurrentPosition(async ({ coords: position }) => {
      coords = { lat: position.latitude, lon: position.longitude }; status.textContent = 'Locație găsită. Alege nivelul de precizie.';
      try { const response = await api(`/api/location/suggestions?kind=reverse&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`); if (response?.ok) paintResults(response.suggestions); else throw new Error('unavailable'); }
      catch { status.textContent = 'Adresa nu a putut fi verificată. Poți introduce locația manual.'; }
    }, (error) => { status.textContent = error?.code === 1 ? 'Permisiunea GPS a fost refuzată. Introdu locația manual.' : 'GPS indisponibil. Încearcă din nou sau introdu locația manual.'; }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
  });
  search?.addEventListener('click', async () => { const query = manual.value.trim(); if (!query) return; status.textContent = 'Se caută adresa…'; try { const response = await api(`/api/location/suggestions?kind=search&q=${encodeURIComponent(query)}`); paintResults(response?.ok ? response.suggestions : []); status.textContent = response?.ok ? 'Alege o locație sau folosește textul introdus.' : 'Nu am găsit adresa. Poți folosi textul introdus.'; } catch { status.textContent = 'Căutarea nu este disponibilă. Poți folosi textul introdus.'; } });
  panel.querySelectorAll('[data-location-nearby]').forEach((button) => button.addEventListener('click', async () => { if (!coords) { status.textContent = 'Activează GPS înainte de a căuta locuri apropiate.'; return; } status.textContent = 'Se caută în apropiere…'; try { const response = await api(`/api/location/suggestions?kind=${encodeURIComponent(button.dataset.locationNearby)}&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`); paintResults(response?.ok ? response.suggestions : []); status.textContent = response?.ok ? 'Alege locul.' : 'Nu am găsit locuri.'; } catch { status.textContent = 'Locurile apropiate nu sunt disponibile momentan.'; } }));
  addManual.addEventListener('click', () => add(manual.value));
}
