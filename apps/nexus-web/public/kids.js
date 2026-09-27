const app = document.getElementById("kids-app");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const params = new URLSearchParams(location.hash.slice(1));
let childToken = params.get("session") || "";
if (childToken) history.replaceState(null, "", "/kids.html");
let profile = null, controls = null, videos = [], deadline = 0, timer = null, activeObjectUrl = "";

async function kidsApi(path, options = {}) {
  if (!childToken) return { ok: false, code: "KIDS_SESSION_REQUIRED" };
  const response = await fetch(path, { method: options.method || "GET", headers: { authorization: `Bearer ${childToken}`, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined, cache: "no-store", credentials: "omit" });
  const body = await response.json().catch(() => ({ ok: false, error: "Răspuns invalid" }));
  return { ...body, status: response.status };
}
const key = (scope) => `${scope}-${crypto.randomUUID()}`;

async function boot() {
  if (!childToken) return renderError("Sesiunea Kids lipsește. Un părinte trebuie să o pornească din Family Center.");
  const me = await kidsApi("/api/kids/me");
  if (!me.ok) return renderError("Sesiunea Kids a expirat. Revino în Family Center.");
  profile = me.child; controls = me.controls; deadline = Date.now() + Number(me.time_remaining_seconds || controls.daily_minutes * 60) * 1000;
  const home = await kidsApi("/api/kids/home");
  if (!home.ok) return renderError(home.code === "KIDS_TIME_LIMIT_REACHED" ? "Timpul de azi s-a încheiat. Ne vedem mâine!" : "Catalogul sigur nu poate fi încărcat.");
  videos = Array.isArray(home.videos) ? home.videos : [];
  render(); startTimer();
}

function render() {
  app.innerHTML = `<div class="kidsShell"><header class="kidsHeader"><div class="kidsBrand"><i>★</i><span><b>NEXUS KIDS</b><small>Spațiu separat · local</small></span></div><button id="kids-exit">Ieșire</button></header>
    <section class="kidsStatus"><span><b>${escapeHtml(profile.alias)} · ${escapeHtml(profile.age_band)}</b><small>Fără reclame comportamentale, mesaje, wallet sau upload public.</small></span><em id="kids-timer">${controls.daily_minutes}:00</em></section>
    <section class="kidsIntro"><h1>Ce descoperim azi?</h1><p>Catalog ales de părinte și editorial. Autoplay este întotdeauna oprit.</p></section>
    <section class="kidsGrid">${videos.length ? videos.map((video) => `<article class="kidsCard"><div class="kidsThumb"><i>▶</i></div><section><small>${escapeHtml(video.topic)} · ${escapeHtml(video.channel_title)}</small><b>${escapeHtml(video.title)}</b><p>${escapeHtml(video.description || video.why)}</p><footer><button data-play="${video.video_id}">Redă</button><button data-feedback="LOVE" data-video="${video.video_id}">♡ Îmi place</button><button data-feedback="SHOW_LESS" data-video="${video.video_id}">Mai puțin</button></footer></section></article>`).join("") : '<div class="kidsEmpty"><b>Catalogul este gol</b><span>Părintele poate aproba conținut general din Family Center.</span></div>'}</section></div>`;
  document.getElementById("kids-exit").addEventListener("click", () => { childToken = ""; clearInterval(timer); app.innerHTML = '<div class="kidsEmpty"><b>Sesiune închisă</b><span>Revino la Family Center pentru o sesiune nouă.</span></div>'; });
  app.querySelectorAll("[data-play]").forEach((button) => button.addEventListener("click", () => openPlayer(Number(button.dataset.play))));
  app.querySelectorAll("[data-feedback]").forEach((button) => button.addEventListener("click", async () => { const result = await kidsApi("/api/kids/feedback", { method: "POST", headers: { "Idempotency-Key": key("kids-feedback") }, body: { video_id: Number(button.dataset.video), kind: button.dataset.feedback } }); if (result.ok) button.textContent = "✓ Salvat privat"; }));
}

async function openPlayer(videoId) {
  const video = videos.find((item) => Number(item.video_id) === videoId); if (!video) return;
  const response = await fetch(`/api/kids/videos/${videoId}/media`, { headers: { authorization: `Bearer ${childToken}` }, cache: "no-store", credentials: "omit" });
  if (!response.ok) return;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = URL.createObjectURL(await response.blob());
  const layer = document.createElement("div"); layer.className = "kidsPlayer"; layer.innerHTML = `<section><header><b>${escapeHtml(video.title)}</b><button id="kids-player-close">Închide</button></header><video controls playsinline preload="metadata" src="${activeObjectUrl}"></video><small>Autoplay oprit · progres privat, ștergibil și fără blockchain.</small></section>`;
  document.body.append(layer); const player = layer.querySelector("video");
  const close = async () => { await kidsApi("/api/kids/progress", { method: "POST", headers: { "Idempotency-Key": key("kids-progress") }, body: { video_id: videoId, position_seconds: Math.max(0, Math.floor(player.currentTime || 0)) } }); player.pause(); layer.remove(); URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = ""; };
  layer.querySelector("#kids-player-close").addEventListener("click", close);
}

function startTimer() {
  clearInterval(timer); const update = () => { const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000)), node = document.getElementById("kids-timer"); if (node) node.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; if (!left) { clearInterval(timer); childToken = ""; document.querySelector(".kidsPlayer")?.remove(); renderError("Timpul de azi s-a încheiat. Ne vedem mâine!"); } }; update(); timer = setInterval(update, 1000);
}
function renderError(message) { app.innerHTML = `<div class="kidsEmpty"><div class="kidsError"><b>Nexus Kids</b><p>${escapeHtml(message)}</p></div></div>`; }
boot();
