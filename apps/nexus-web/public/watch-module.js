const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const mutationKey = (scope) => `${scope}-${crypto.randomUUID()}`;

export function renderWatchWorkspace(viewport, deps, initialTab = "editorial") {
  let tab = initialTab;
  const shell = () => {
    viewport.innerHTML = `<div class="screen scrollScreen watchWorkspace">
      <header class="watchHero"><span><small>NEXUS WATCH · LOCAL</small><h2>Watch</h2><p>Long-form intenționat, rights-first, fără autoplay infinit.</p></span><i>◉</i></header>
      <nav class="watchTabs" aria-label="Watch"><button data-tab="editorial">Editorial</button><button data-tab="subscriptions">Abonamente</button><button data-tab="studio">Studio</button><button data-tab="family">Family</button></nav>
      <div id="watch-content" aria-live="polite"><div class="watchLoading">Se verifică drepturile și accesul…</div></div>
    </div>`;
    viewport.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { tab = button.dataset.tab; load(); }));
    load();
  };
  const activate = () => viewport.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  async function load() {
    activate();
    const host = document.getElementById("watch-content");
    host.innerHTML = '<div class="watchLoading">Se încarcă…</div>';
    if (tab === "studio") return renderStudio(host, deps, () => load());
    if (tab === "family") return renderFamily(host, deps, () => load());
    const result = await deps.api(`/api/watch/home?mode=${tab}`).catch(() => null);
    if (!result?.ok || Number(result.viewer_id) !== Number(deps.state.user.id) || result.viewer_persona !== "social") return host.innerHTML = '<div class="watchEmpty"><b>Watch indisponibil</b><span>Comută pe Nexus Social și reîncearcă.</span></div>';
    const videos = Array.isArray(result.videos) ? result.videos : [];
    const continuation = Array.isArray(result.continue_watching) ? result.continue_watching : [];
    host.innerHTML = `${continuation.length ? `<section class="watchRail"><h3>Continuă vizionarea</h3>${continuation.map(videoCard).join("")}</section>` : ""}
      <section class="watchGrid">${videos.length ? videos.map(videoCard).join("") : '<div class="watchEmpty"><i>◇</i><b>Niciun video eligibil</b><span>Publicarea cere media validată local, rights declaration și policy gate.</span></div>'}</section>
      <p class="watchTruth">${escapeHtml(result.ranker)} · Streaming public/CDN extern neactivat.</p>`;
    bindVideoActions(host, deps);
  }
  shell();
}

function videoCard(video) {
  return `<article class="watchCard" data-video-id="${Number(video.id)}"><div class="watchFrame"><video controls preload="metadata" playsinline src="${escapeHtml(video.media_url)}"></video><span>${Math.ceil(Number(video.duration_seconds || 0) / 60)} min</span></div>
    <div class="watchMeta"><span><small>@${escapeHtml(video.channel_handle)}</small><b>${escapeHtml(video.title)}</b><em>${escapeHtml(video.description)}</em></span>
    ${video.owner_id === video.viewer_id ? "" : `<button data-subscribe="${Number(video.channel_id)}" data-active="${video.subscribed ? "1" : "0"}">${video.subscribed ? "Abonat" : "Abonează-te"}</button>`}</div>
    <footer><button data-progress="${Number(video.id)}">Salvează progresul</button><button data-watch-later="${Number(video.id)}">Watch later</button><small>${video.production_eligible ? "Rights verificate" : "Self-declared · demo local"}</small></footer></article>`;
}

function bindVideoActions(host, deps) {
  host.querySelectorAll("[data-subscribe]").forEach((button) => button.addEventListener("click", async () => {
    const active = button.dataset.active !== "1";
    const result = await deps.api(`/api/watch/channels/${button.dataset.subscribe}/subscription`, { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-sub") }, body: { active, notification_mode: "personalized" } });
    if (result.ok) { button.dataset.active = active ? "1" : "0"; button.textContent = active ? "Abonat" : "Abonează-te"; }
  }));
  host.querySelectorAll("[data-progress]").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest(".watchCard"), video = card.querySelector("video");
    const result = await deps.api(`/api/watch/videos/${button.dataset.progress}/progress`, { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-progress") }, body: { position_seconds: Math.max(0, Math.floor(video.currentTime || 0)) } });
    deps.toast(result.ok ? "Progres salvat privat" : "Progresul nu a putut fi salvat");
  }));
  host.querySelectorAll("[data-watch-later]").forEach((button) => button.addEventListener("click", async () => {
    let lists = await deps.api("/api/watch/playlists");
    let playlist = lists.playlists?.find((item) => item.kind === "watch_later");
    if (!playlist) {
      const created = await deps.api("/api/watch/playlists", { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-list") }, body: { title: "Watch later", visibility: "private", kind: "watch_later" } });
      playlist = created.playlist;
    }
    if (!playlist) return deps.toast("Playlist indisponibil");
    const result = await deps.api(`/api/watch/playlists/${playlist.id}/items`, { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-item") }, body: { video_id: Number(button.dataset.watchLater) } });
    deps.toast(result.ok ? "Adăugat în Watch later" : "Nu a putut fi adăugat");
  }));
}

async function renderStudio(host, deps, reload) {
  const result = await deps.api("/api/watch/channels/mine").catch(() => null);
  const channels = Array.isArray(result?.channels) ? result.channels : [];
  host.innerHTML = `<section class="watchStudio"><div><small>CREATOR STUDIO · LOCAL</small><h3>Canal și video long-form</h3><p>Upload reluabil, maximum local 20 MB. Publicarea locală nu reprezintă clearance de drepturi pentru producție.</p></div>
    <form id="watch-channel-form"><h4>Canal nou</h4><label>Handle<input name="handle" required minlength="3" maxlength="30" placeholder="canal_nexus"></label><label>Titlu<input name="title" required maxlength="80"></label><label>Descriere<textarea name="description" maxlength="600"></textarea></label><button>Crează canal</button></form>
    <form id="watch-video-form"><h4>Video nou</h4><label>Canal<select name="channel_id" required><option value="">Selectează</option>${channels.map((channel) => `<option value="${channel.id}">${escapeHtml(channel.title)}</option>`).join("")}</select></label><label>Fișier video<input name="file" type="file" accept="video/mp4,video/webm" required></label><label>Titlu<input name="title" maxlength="120" required></label><label>Descriere<textarea name="description" maxlength="3000"></textarea></label><div class="watchFormGrid"><label>Durată secunde<input name="duration_seconds" type="number" min="3" max="3600" required></label><label>Audiență<select name="audience"><option value="public">Public</option><option value="subscribers">Abonați</option><option value="private">Privat</option></select></label><label>Rating<select name="age_rating"><option value="general">General</option><option value="teen">Teen</option><option value="adult">Adult</option></select></label><label>Captions<input name="captions_language" value="und" maxlength="20"></label></div><label class="watchCheck"><input name="rights" type="checkbox" required> Declar că dețin drepturile necesare pentru acest demo.</label><progress id="watch-upload-progress" value="0" max="100"></progress><button ${channels.length ? "" : "disabled"}>Încarcă draft</button></form>
    <div id="watch-studio-result"></div></section>`;
  document.getElementById("watch-channel-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/watch/channels", { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-channel") }, body: { handle: data.get("handle"), title: data.get("title"), description: data.get("description") } });
    deps.toast(response.ok ? "Canal creat" : response.error || "Canal indisponibil"); if (response.ok) reload();
  });
  document.getElementById("watch-video-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), file = data.get("file"), progress = document.getElementById("watch-upload-progress"), output = document.getElementById("watch-studio-result");
    if (!(file instanceof File) || !file.size) return;
    form.querySelector("button").disabled = true;
    try {
      const upload = await deps.uploadMedia(file, "watch_video", (ratio) => { progress.value = Math.floor(ratio * 70); });
      const created = await deps.api("/api/watch/videos", { method: "POST", headers: { "Idempotency-Key": mutationKey("watch-video") }, body: { channel_id: Number(data.get("channel_id")), media_id: upload.media.id, title: data.get("title"), description: data.get("description"), duration_seconds: Number(data.get("duration_seconds")), audience: data.get("audience"), age_rating: data.get("age_rating"), captions_language: data.get("captions_language") || "und", rights_declared: data.get("rights") === "on" } });
      progress.value = created.ok ? 100 : 70;
      if (!created.ok) throw new Error(created.error || "Draft invalid");
      output.innerHTML = `<article class="watchDraft"><b>${escapeHtml(created.video.title)}</b><span>Draft salvat. Rights: self-declared.</span><button data-publish="${created.video.id}">Publică local</button></article>`;
      output.querySelector("[data-publish]").addEventListener("click", async () => { const published = await deps.api(`/api/watch/videos/${created.video.id}`, { method: "PATCH", headers: { "Idempotency-Key": mutationKey("watch-publish") }, body: { action: "publish" } }); deps.toast(published.ok ? "Publicat în Watch local" : published.error || "Publicare refuzată"); });
    } catch (error) { output.textContent = String(error.message || "Upload eșuat"); }
    finally { form.querySelector("button").disabled = false; }
  });
}

async function renderFamily(host, deps, reload) {
  const result = await deps.api("/api/family").catch(() => null), children = Array.isArray(result?.children) ? result.children : [];
  host.innerHTML = `<section class="familyCenter"><header><small>FAMILY CENTER · ADULT</small><h3>Nexus Kids</h3><p>Copilul primește o sesiune separată: fără wallet, Dating, mesaje, ads comportamentale sau upload public.</p></header>
    <form id="kids-child-form"><label>Alias copil<input name="alias" maxlength="30" required></label><label>Grupă de vârstă<select name="age_band"><option value="preschool">Preșcolar</option><option value="6_8">6–8</option><option value="9_12">9–12</option><option value="13_15">13–15</option><option value="16_17">16–17</option></select></label><label>Limbă<input name="locale" value="ro" maxlength="12"></label><label class="watchCheck"><input name="authority" type="checkbox" required> Confirm autoritatea parentală pentru demo-ul local.</label><button>Adaugă profil Kids</button></form>
    <div class="kidsProfiles">${children.length ? children.map((child) => `<article><i>★</i><span><b>${escapeHtml(child.alias)}</b><small>${escapeHtml(child.age_band)} · ${escapeHtml(child.locale)} · ${child.daily_minutes} min/zi</small><em>Autoplay oprit · Live ${child.live_enabled ? "permis de părinte" : "oprit"}</em></span><button data-launch-child="${child.id}">Deschide Kids</button></article>`).join("") : '<div class="watchEmpty"><b>Niciun profil Kids</b><span>Creează unul numai cu autoritate parentală.</span></div>'}</div>
    <p class="watchTruth">Authority și catalogul sunt demo local nevalidate; producția Kids rămâne blocată de DPIA, Country Pack și verificare parentală.</p></section>`;
  document.getElementById("kids-child-form").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const response = await deps.api("/api/family/children", { method: "POST", headers: { "Idempotency-Key": mutationKey("kids-child") }, body: { alias: data.get("alias"), age_band: data.get("age_band"), locale: data.get("locale"), avatar_code: "orbit", parental_authority_confirmed: data.get("authority") === "on" } }); deps.toast(response.ok ? "Profil Kids creat" : response.error || "Profil refuzat"); if (response.ok) reload(); });
  host.querySelectorAll("[data-launch-child]").forEach((button) => button.addEventListener("click", async () => { const response = await deps.api(`/api/family/children/${button.dataset.launchChild}/session`, { method: "POST", headers: { "Idempotency-Key": mutationKey("kids-session") }, body: { parental_gate_confirmed: true } }); if (!response.ok) return deps.toast(response.error || "Sesiune indisponibilă"); location.assign(response.launch_url); }));
}
