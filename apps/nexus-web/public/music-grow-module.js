const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const key = (scope) => `${scope}-${crypto.randomUUID()}`;
const money = (cents) => `${(Number(cents || 0) / 100).toFixed(2)} TEST-USDC`;

export function renderMusicWorkspace(viewport, deps) {
  let tab = "discover";
  let query = "";
  viewport.innerHTML = `<div class="screen scrollScreen musicWorkspace">
    <header class="musicHero"><span><small>NEXUS MUSIC · RIGHTS-FIRST</small><h2>Music</h2><p>Ascultă artiști independenți. Niciun catalog comercial nu este presupus licențiat.</p></span><i>♫</i></header>
    <nav class="mgTabs" aria-label="Music"><button class="active" data-music-tab="discover">Discover</button><button data-music-tab="library">Library</button><button data-music-tab="playlists">Playlists</button><button data-music-tab="studio">Studio</button></nav>
    <div id="music-content" aria-live="polite"></div>
  </div>`;
  viewport.querySelectorAll("[data-music-tab]").forEach((button) => button.addEventListener("click", () => {
    tab = button.dataset.musicTab;
    viewport.querySelectorAll("[data-music-tab]").forEach((item) => item.classList.toggle("active", item === button));
    load();
  }));

  async function load() {
    const host = document.getElementById("music-content");
    host.innerHTML = '<div class="mgLoading">Se verifică drepturile și accesul…</div>';
    if (tab === "studio") return renderMusicStudio(host, deps, load);
    if (tab === "playlists") return renderMusicPlaylists(host, deps);
    const result = await deps.api(`/api/music/home?q=${encodeURIComponent(query)}`).catch(() => null);
    if (!result?.ok || Number(result.viewer_id) !== Number(deps.state.user.id)) return host.innerHTML = unavailable("Music nu este disponibil acum.");
    const tracks = tab === "library" ? result.library : result.tracks;
    host.innerHTML = `${tab === "discover" ? `<form id="music-search" class="mgSearch"><input name="q" value="${esc(query)}" maxlength="80" placeholder="Caută artist sau track" aria-label="Caută în Music"><button>Caută</button></form>` : ""}
      <section class="musicTracks">${tracks.length ? tracks.map(trackCard).join("") : unavailable(tab === "library" ? "Biblioteca ta este goală." : "Niciun track eligibil publicat încă.")}</section>
      <p class="mgTruth">${esc(result.ranker)} · Istoricul și biblioteca sunt private. Un play start nu produce automat royalty.</p>`;
    document.getElementById("music-search")?.addEventListener("submit", (event) => { event.preventDefault(); query = String(new FormData(event.currentTarget).get("q") || "").trim(); load(); });
    bindTrackActions(host, deps, load);
  }
  load();
}

function trackCard(track) {
  return `<article class="musicTrack" data-track="${Number(track.id)}"><div class="musicCover"><i>♫</i><span>${track.explicit ? "EXPLICIT" : "ORIGINAL / CLEARED DEMO"}</span></div>
    <div class="musicMeta"><small>@${esc(track.owner_handle)} · ${esc(track.rights_basis)}</small><b>${esc(track.title)}</b><em>${esc(track.stage_name)} · ${Math.ceil(Number(track.duration_seconds) / 60)} min</em></div>
    <audio controls preload="metadata" src="${esc(track.media_url)}"></audio>
    <footer><button data-music-save="${track.id}" data-active="${track.saved ? "1" : "0"}">${track.saved ? "✓ În Library" : "+ Library"}</button><button data-music-queue="${track.id}">+ Playlist</button><small>${track.production_eligible ? "Rights verificate" : "Self-declared · local"}</small></footer></article>`;
}

function bindTrackActions(host, deps, reload) {
  host.querySelectorAll(".musicTrack audio").forEach((audio) => {
    let recorded = false;
    audio.addEventListener("play", async () => {
      if (recorded) return;
      recorded = true;
      const trackId = Number(audio.closest(".musicTrack").dataset.track);
      const response = await deps.api("/api/music/playback/start", { method: "POST", headers: { "Idempotency-Key": key("music-play") }, body: { track_id: trackId } });
      if (!response.ok) { recorded = false; audio.pause(); deps.toast(response.error || "Redarea nu este autorizată"); }
    });
  });
  host.querySelectorAll("[data-music-save]").forEach((button) => button.addEventListener("click", async () => {
    const active = button.dataset.active !== "1";
    const response = await deps.api(`/api/music/library/${button.dataset.musicSave}`, { method: "PUT", headers: { "Idempotency-Key": key("music-library") }, body: { active } });
    if (!response.ok) return deps.toast(response.error || "Library indisponibilă");
    button.dataset.active = active ? "1" : "0"; button.textContent = active ? "✓ În Library" : "+ Library";
  }));
  host.querySelectorAll("[data-music-queue]").forEach((button) => button.addEventListener("click", async () => {
    let lists = await deps.api("/api/music/playlists");
    let playlist = lists.playlists?.find((item) => item.title === "My Nexus queue");
    if (!playlist) {
      const created = await deps.api("/api/music/playlists", { method: "POST", headers: { "Idempotency-Key": key("music-playlist") }, body: { title: "My Nexus queue", visibility: "private" } });
      playlist = created.playlist;
    }
    if (!playlist) return deps.toast("Playlist indisponibil");
    const response = await deps.api(`/api/music/playlists/${playlist.id}/items`, { method: "POST", headers: { "Idempotency-Key": key("music-item") }, body: { track_id: Number(button.dataset.musicQueue) } });
    deps.toast(response.ok ? "Adăugat în playlist" : response.error || "Nu a putut fi adăugat");
  }));
}

async function renderMusicStudio(host, deps, reload) {
  const result = await deps.api("/api/music/artists/mine").catch(() => null);
  const artist = result?.artist;
  if (!artist) {
    host.innerHTML = `<section class="mgPanel"><small>ARTIST PAGE · LOCAL</small><h3>Creează pagina de artist</h3><p>Doar muzică originală, public-domain, Creative Commons compatibilă sau licențiată direct.</p>
      <form id="artist-form"><label>Nume artistic<input name="stage_name" maxlength="80" required></label><label>Bio<textarea name="bio" maxlength="800"></textarea></label><label class="mgCheck"><input type="checkbox" name="rights" required> Confirm că voi încărca numai conținut pentru care dețin drepturile.</label><button>Creează pagina</button></form></section>`;
    document.getElementById("artist-form").addEventListener("submit", async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const response = await deps.api("/api/music/artists", { method: "POST", headers: { "Idempotency-Key": key("music-artist") }, body: { stage_name: data.get("stage_name"), bio: data.get("bio"), rights_declaration_confirmed: data.get("rights") === "on" } });
      deps.toast(response.ok ? "Pagina de artist a fost creată" : response.error || "Pagina nu a putut fi creată"); if (response.ok) reload();
    });
    return;
  }
  host.innerHTML = `<section class="mgPanel"><header><span><small>ARTIST STUDIO · SELF-DECLARED LOCAL</small><h3>${esc(artist.stage_name)}</h3><p>${esc(artist.bio)}</p></span><i>♫</i></header>
    <form id="track-form"><label>Master audio<input name="file" type="file" accept="audio/mpeg,audio/wav,audio/ogg" required></label><label>Titlu<input name="title" maxlength="120" required></label>
      <div class="mgGrid"><label>Durată secunde<input name="duration_seconds" type="number" min="3" max="3600" required></label><label>Drepturi<select name="rights_basis"><option value="original">Original</option><option value="public_domain">Public domain</option><option value="creative_commons">Creative Commons</option><option value="direct_license">Licență directă</option></select></label></div>
      <label>Atribuire / referință licență<textarea name="attribution" maxlength="500"></textarea></label><label class="mgCheck"><input type="checkbox" name="explicit"> Conținut explicit</label><label class="mgCheck"><input type="checkbox" name="rights" required> Declar drepturile pentru master, compoziție și publicare în demo.</label>
      <progress id="music-upload-progress" value="0" max="100"></progress><button>Încarcă draft</button></form><div id="track-result"></div></section>`;
  document.getElementById("track-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), file = data.get("file"), progress = document.getElementById("music-upload-progress"), output = document.getElementById("track-result");
    if (!(file instanceof File) || !file.size) return;
    const submit = form.querySelector("button"); submit.disabled = true;
    try {
      const upload = await deps.uploadMedia(file, "music_master", (ratio) => { progress.value = Math.floor(ratio * 70); });
      const created = await deps.api("/api/music/tracks", { method: "POST", headers: { "Idempotency-Key": key("music-track") }, body: { artist_id: artist.id, media_id: upload.media.id, title: data.get("title"), duration_seconds: Number(data.get("duration_seconds")), rights_basis: data.get("rights_basis"), attribution: data.get("attribution"), explicit: data.get("explicit") === "on", rights_declared: data.get("rights") === "on" } });
      if (!created.ok) throw new Error(created.error || "Track invalid");
      progress.value = 100;
      output.innerHTML = `<article class="mgDraft"><span><b>${esc(created.track.title)}</b><small>Draft local · fără clearance comercial</small></span><button data-publish-track="${created.track.id}">Publică local</button></article>`;
      output.querySelector("[data-publish-track]").addEventListener("click", async () => {
        const published = await deps.api(`/api/music/tracks/${created.track.id}`, { method: "PATCH", headers: { "Idempotency-Key": key("music-publish") }, body: { action: "publish" } });
        deps.toast(published.ok ? "Track publicat în catalogul local" : published.error || "Publicare refuzată");
      });
    } catch (error) { output.textContent = String(error.message || "Upload eșuat"); }
    finally { submit.disabled = false; }
  });
}

async function renderMusicPlaylists(host, deps) {
  const result = await deps.api("/api/music/playlists").catch(() => null), lists = Array.isArray(result?.playlists) ? result.playlists : [];
  host.innerHTML = `<section class="mgPanel"><small>PRIVATE BY DEFAULT</small><h3>Playlist-urile tale</h3><form id="music-playlist-form" class="mgInline"><input name="title" maxlength="80" placeholder="Playlist nou" required><select name="visibility"><option value="private">Privat</option><option value="public">Public</option></select><button>Creează</button></form>
    <div class="mgList">${lists.length ? lists.map((list) => `<article><span><b>${esc(list.title)}</b><small>${esc(list.visibility)} · ${list.items.length} track-uri</small></span></article>`).join("") : unavailable("Niciun playlist încă.")}</div></section>`;
  document.getElementById("music-playlist-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/music/playlists", { method: "POST", headers: { "Idempotency-Key": key("music-list") }, body: { title: data.get("title"), visibility: data.get("visibility") } });
    deps.toast(response.ok ? "Playlist creat" : response.error || "Playlist indisponibil"); if (response.ok) renderMusicPlaylists(host, deps);
  });
}

export function renderGrowWorkspace(viewport, deps) {
  let tab = "explore";
  viewport.innerHTML = `<div class="screen scrollScreen growWorkspace"><header class="growHero"><span><small>NEXUS GROW · W0/W1 ONLY</small><h2>Grow</h2><p>Sport, nutriție și educație generală. Fără diagnostic sau profilare medicală.</p></span><i>＋</i></header>
    <nav class="mgTabs" aria-label="Grow"><button class="active" data-grow-tab="explore">Explore</button><button data-grow-tab="workouts">Workouts</button><button data-grow-tab="courses">Courses</button><button data-grow-tab="private">Private</button></nav><div id="grow-content" aria-live="polite"></div></div>`;
  viewport.querySelectorAll("[data-grow-tab]").forEach((button) => button.addEventListener("click", () => {
    tab = button.dataset.growTab; viewport.querySelectorAll("[data-grow-tab]").forEach((item) => item.classList.toggle("active", item === button)); load();
  }));
  const load = () => tab === "workouts" ? renderWorkouts(document.getElementById("grow-content"), deps) : tab === "courses" ? renderCourses(document.getElementById("grow-content"), deps) : tab === "private" ? renderGrowPrivate(document.getElementById("grow-content"), deps) : renderGrowExplore(document.getElementById("grow-content"), deps);
  load();
}

async function renderGrowExplore(host, deps) {
  const result = await deps.api("/api/grow/home").catch(() => null), content = Array.isArray(result?.content) ? result.content : [];
  host.innerHTML = `<section class="growBoundary"><b>Limită de siguranță</b><span>Conținut educațional și wellbeing general W0/W1. Nu înlocuiește medicul și nu intră în ads, Dating, Work sau reputație.</span></section>
    <div class="growCards">${content.length ? content.map((item) => `<article><i>${item.vertical === "sport" ? "◎" : item.vertical === "nutrition" ? "◇" : "▣"}</i><span><small>${esc(item.vertical)} · ${esc(item.medical_class)} · @${esc(item.owner_handle)}</small><b>${esc(item.title)}</b><p>${esc(item.summary)}</p><em>Sursă: ${esc(item.source_note)}</em></span></article>`).join("") : unavailable("Niciun material editorial eligibil încă.")}</div>
    <details class="mgPanel"><summary>Publică material W0/W1 local</summary><form id="grow-content-form"><div class="mgGrid"><label>Verticală<select name="vertical"><option value="nutrition">Nutrition</option><option value="sport">Sport</option><option value="learn">Learning</option></select></label><label>Format<select name="format"><option value="article">Articol</option><option value="video">Video</option><option value="program">Program</option><option value="course_intro">Intro curs</option></select></label></div><label>Titlu<input name="title" maxlength="120" required></label><label>Rezumat<textarea name="summary" maxlength="2000" required></textarea></label><label>Surse / review editorial<textarea name="source_note" maxlength="1000" required></textarea></label><label>Clasă<select name="medical_class"><option value="W0">W0 editorial</option><option value="W1">W1 wellbeing general</option></select></label><label class="mgCheck"><input name="confirm" type="checkbox" required> Confirm că nu oferă diagnostic sau tratament.</label><button>Salvează local</button></form></details>`;
  document.getElementById("grow-content-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/grow/content", { method: "POST", headers: { "Idempotency-Key": key("grow-content") }, body: { vertical: data.get("vertical"), format: data.get("format"), title: data.get("title"), summary: data.get("summary"), source_note: data.get("source_note"), medical_class: data.get("medical_class"), non_medical_confirmed: data.get("confirm") === "on" } });
    deps.toast(response.ok ? "Material W0/W1 salvat local" : response.error || "Material refuzat"); if (response.ok) renderGrowExplore(host, deps);
  });
}

async function renderWorkouts(host, deps) {
  const [offerResult, home] = await Promise.all([deps.api("/api/grow/workouts/offers").catch(() => null), deps.api("/api/grow/home?vertical=sport").catch(() => null)]);
  const offers = Array.isArray(offerResult?.offers) ? offerResult.offers : [], sport = Array.isArray(home?.content) ? home.content : [];
  host.innerHTML = `<section class="growCards">${offers.length ? offers.map((offer) => `<article><i>◎</i><span><small>@${esc(offer.provider_handle)} · ${offer.access_minutes} min</small><b>${esc(offer.title)}</b><em>${money(offer.price_cents)} · Nexus 10% / provider 90%</em></span><button data-reserve-workout="${offer.id}">Rezervă demo</button></article>`).join("") : unavailable("Nicio sesiune disponibilă.")}</section>
    <details class="mgPanel"><summary>Oferă o sesiune pay-per-workout</summary><form id="workout-offer-form"><label>Program sport eligibil<select name="content_id" required><option value="">Selectează</option>${sport.filter((item) => Number(item.owner_id) === Number(deps.state.user.id)).map((item) => `<option value="${item.id}">${esc(item.title)}</option>`).join("")}</select></label><label>Titlu sesiune<input name="title" maxlength="120" required></label><div class="mgGrid"><label>Minute<input name="access_minutes" type="number" min="15" max="480" value="60" required></label><label>Preț cenți TEST-USDC<input name="price_cents" type="number" min="0" max="100000000" value="1000" required></label></div><button>Creează oferta locală</button></form></details>
    <p class="mgTruth">Nu se debitează nimic. Rezervarea păstrează doar quote-ul local și split-ul transparent.</p>`;
  host.querySelectorAll("[data-reserve-workout]").forEach((button) => button.addEventListener("click", async () => {
    const response = await deps.api(`/api/grow/workouts/offers/${button.dataset.reserveWorkout}/reserve`, { method: "POST", headers: { "Idempotency-Key": key("grow-reserve") }, body: {} });
    deps.toast(response.ok ? "Rezervare demo creată · fără plată" : response.error || "Rezervare indisponibilă");
  }));
  document.getElementById("workout-offer-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/grow/workouts/offers", { method: "POST", headers: { "Idempotency-Key": key("grow-offer") }, body: { content_id: Number(data.get("content_id")), title: data.get("title"), access_minutes: Number(data.get("access_minutes")), price_cents: Number(data.get("price_cents")) } });
    deps.toast(response.ok ? "Oferta a fost publicată local" : response.error || "Oferta a fost refuzată"); if (response.ok) renderWorkouts(host, deps);
  });
}

async function renderCourses(host, deps) {
  const [catalog, mine] = await Promise.all([deps.api("/api/grow/courses").catch(() => null), deps.api("/api/grow/enrollments").catch(() => null)]);
  const courses = Array.isArray(catalog?.courses) ? catalog.courses : [], enrollments = Array.isArray(mine?.enrollments) ? mine.enrollments : [];
  const enrolled = new Map(enrollments.map((item) => [Number(item.course_id), item]));
  host.innerHTML = `<section class="growCards">${courses.length ? courses.map((course) => { const own = Number(course.owner_id) === Number(deps.state.user.id), item = enrolled.get(Number(course.id)); return `<article><i>▣</i><span><small>@${esc(course.owner_handle)} · ${esc(course.accreditation_claim)}</small><b>${esc(course.title)}</b><p>${esc(course.description)}</p><em>${money(course.price_cents)}</em>${item ? `<progress value="${item.progress_percent}" max="100"></progress><small>${esc(item.status)} · ${item.progress_percent}%</small>` : ""}</span>${own ? "" : item ? (item.status === "active" || item.status === "completed" ? `<button data-course-progress="${course.id}" data-progress="${item.progress_percent}">+10%</button>` : '<button disabled>Plată neactivată</button>') : `<button data-course-enroll="${course.id}">Înscrie-te</button>`}</article>`; }).join("") : unavailable("Niciun curs publicat încă.")}</section>
    <details class="mgPanel"><summary>Publică un curs local</summary><form id="course-form"><label>Titlu<input name="title" maxlength="120" required></label><label>Descriere<textarea name="description" maxlength="3000" required></textarea></label><label>Preț cenți TEST-USDC<input name="price_cents" type="number" min="0" max="100000000" value="0" required></label><label class="mgCheck"><input name="confirm" type="checkbox" required> Confirm că certificatul Nexus nu este acreditare profesională.</label><button>Publică local</button></form></details>`;
  host.querySelectorAll("[data-course-enroll]").forEach((button) => button.addEventListener("click", async () => {
    const response = await deps.api(`/api/grow/courses/${button.dataset.courseEnroll}/enroll`, { method: "POST", headers: { "Idempotency-Key": key("grow-enroll") }, body: {} });
    deps.toast(response.ok ? (response.enrollment.status === "active" ? "Înscriere activă" : "Înscriere salvată; plata nu este activă") : response.error || "Înscriere indisponibilă"); if (response.ok) renderCourses(host, deps);
  }));
  host.querySelectorAll("[data-course-progress]").forEach((button) => button.addEventListener("click", async () => {
    const next = Math.min(100, Number(button.dataset.progress) + 10);
    const response = await deps.api(`/api/grow/courses/${button.dataset.courseProgress}/progress`, { method: "PUT", headers: { "Idempotency-Key": key("grow-progress") }, body: { progress_percent: next } });
    deps.toast(response.ok ? "Progres salvat privat" : response.error || "Progres indisponibil"); if (response.ok) renderCourses(host, deps);
  }));
  document.getElementById("course-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/grow/courses", { method: "POST", headers: { "Idempotency-Key": key("grow-course") }, body: { title: data.get("title"), description: data.get("description"), price_cents: Number(data.get("price_cents")), not_accredited_confirmed: data.get("confirm") === "on" } });
    deps.toast(response.ok ? "Curs publicat local" : response.error || "Curs refuzat"); if (response.ok) renderCourses(host, deps);
  });
}

const GROW_DEVICE_KEY = "nexus-grow-device-key-v1";
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromB64 = (value) => Uint8Array.from(atob(String(value).replaceAll("-", "+").replaceAll("_", "/") + "===".slice((String(value).length + 3) % 4)), (char) => char.charCodeAt(0));
async function growCryptoKey() {
  let raw = localStorage.getItem(GROW_DEVICE_KEY);
  if (!raw) { const bytes = crypto.getRandomValues(new Uint8Array(32)); raw = toB64(bytes); localStorage.setItem(GROW_DEVICE_KEY, raw); }
  return crypto.subtle.importKey("raw", fromB64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptGrow(text) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await growCryptoKey(), new TextEncoder().encode(text)));
  return { ciphertext: toB64(ciphertext), nonce: toB64(nonce) };
}
async function decryptGrow(entry) {
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(entry.nonce) }, await growCryptoKey(), fromB64(entry.ciphertext))); }
  catch { return "🔒 Cheia acestui dispozitiv nu mai este disponibilă."; }
}

async function renderGrowPrivate(host, deps) {
  const result = await deps.api("/api/grow/private").catch(() => null), entries = Array.isArray(result?.entries) ? result.entries : [];
  const decoded = await Promise.all(entries.map(async (entry) => ({ ...entry, text: await decryptGrow(entry) })));
  host.innerHTML = `<section class="growVault"><header><i>◇</i><span><small>DEVICE-ENCRYPTED · OWNER ONLY</small><h3>Private progress</h3><p>Serverul primește numai ciphertext. Cheia rămâne în acest browser; pierderea ei face notițele nerecuperabile.</p></span></header>
    <form id="grow-private-form"><div class="mgGrid"><label>Verticală<select name="vertical"><option value="nutrition">Nutrition</option><option value="sport">Sport</option><option value="learn">Learning</option></select></label><label>Tip<select name="kind"><option value="goal">Obiectiv</option><option value="journal">Jurnal</option><option value="note">Notiță</option><option value="progress">Progres</option></select></label></div><label>Notiță privată<textarea name="text" maxlength="2000" required></textarea></label><label>Retenție<select name="days"><option value="7">7 zile</option><option value="30">30 zile</option><option value="90">90 zile</option></select></label><button>Criptează și salvează</button></form>
    <div class="growPrivateList">${decoded.length ? decoded.map((entry) => `<article><span><small>${esc(entry.vertical)} · ${esc(entry.kind)} · expiră ${new Date(entry.expires_at * 1000).toLocaleDateString()}</small><b>${esc(entry.text)}</b></span><button data-delete-grow="${entry.id}" aria-label="Șterge notița">×</button></article>`).join("") : unavailable("Nicio notiță privată pe acest dispozitiv.")}</div>
    <p class="mgTruth">Nu este folosit în ads, Dating, Work, credit sau reputație. Nu este stocat on-chain ori IPFS.</p></section>`;
  document.getElementById("grow-private-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), encrypted = await encryptGrow(String(data.get("text") || ""));
    const response = await deps.api("/api/grow/private", { method: "POST", headers: { "Idempotency-Key": key("grow-private") }, body: { vertical: data.get("vertical"), kind: data.get("kind"), ...encrypted, expires_at: Math.floor(Date.now() / 1000) + Number(data.get("days")) * 86400 } });
    deps.toast(response.ok ? "Salvat criptat pe dispozitiv" : response.error || "Salvare refuzată"); if (response.ok) renderGrowPrivate(host, deps);
  });
  host.querySelectorAll("[data-delete-grow]").forEach((button) => button.addEventListener("click", async () => {
    const response = await deps.api(`/api/grow/private/${button.dataset.deleteGrow}`, { method: "DELETE", headers: { "Idempotency-Key": key("grow-delete") }, body: {} });
    deps.toast(response.ok ? "Notiță ștearsă" : response.error || "Ștergere refuzată"); if (response.ok) renderGrowPrivate(host, deps);
  }));
}

function unavailable(message) { return `<div class="mgEmpty"><i>◇</i><b>${esc(message)}</b><span>Începe local, fără provider extern și fără cost.</span></div>`; }
