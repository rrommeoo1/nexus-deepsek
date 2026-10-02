import { api } from './client.js?v=20260831-p1e2eeattach2';
import { downloadPublishedPost } from './creator-export.js?v=20261001-publish1';
// Nexus clip options — the per-clip panel: captions, speed, auto-advance, data saver, download and
// offline. Every switch does something real on this device: nothing here is offered that the build
// cannot do, nothing is generated that the author did not upload, and where the platform refuses
// (the offline cache needs a secure origin) the panel says exactly that instead of failing quietly.
//
// The pure helpers are exported on their own so they can be tested in Node without a DOM.

export const CLIP_PREFERENCES_KEY = "nexus-clip-options-v1";
export const CLIP_SPEEDS = Object.freeze([0.75, 1, 1.25, 1.5, 2]);

export function defaultClipPreferences() {
  return { captions: false, autoAdvance: false, dataSaver: false, speed: 1 };
}

export function normalizeClipPreferences(value) {
  const base = defaultClipPreferences();
  if (!value || typeof value !== "object") return base;
  const speed = Number(value.speed);
  return {
    captions: value.captions === true,
    autoAdvance: value.autoAdvance === true,
    dataSaver: value.dataSaver === true,
    speed: CLIP_SPEEDS.includes(speed) ? speed : base.speed,
  };
}

export function readClipPreferences(storage) {
  try {
    const raw = storage?.getItem(CLIP_PREFERENCES_KEY);
    return normalizeClipPreferences(raw ? JSON.parse(raw) : null);
  } catch { return defaultClipPreferences(); }
}

export function writeClipPreferences(storage, next) {
  const normalized = normalizeClipPreferences(next);
  try { storage?.setItem(CLIP_PREFERENCES_KEY, JSON.stringify(normalized)); } catch { /* a private window still works, it just forgets */ }
  return normalized;
}

export function humanBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + " KB";
  return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0) + " MB";
}

// Real facts about the file the reader is about to play. The local runtime stores one rendition per
// upload, so the panel states that instead of inventing a ladder of qualities.
export function clipQualityFacts(media) {
  const bytes = Number(media?.size) || 0;
  return {
    single_rendition: true,
    kind: String(media?.kind || ""),
    mime: String(media?.mime || ""),
    bytes,
    size_label: humanBytes(bytes),
  };
}

// Captions come from the author's own WebVTT track when one exists. When it does not, the only true
// text is the post itself, and the panel says it is the post text rather than pretending it is a
// transcription of the audio.
export function captionSourceFor(post) {
  const media = post?.media || null;
  const hasTrack = media?.kind === "video" && media?.captions === true && Boolean(media?.hash);
  if (hasTrack) return { kind: "track", url: "/media/" + media.hash + ".vtt", labelKey: "x.clip.captionsAuthor" };
  const text = String(post?.caption || "").trim();
  if (text) return { kind: "text", text, labelKey: "x.clip.captionsFromText" };
  return { kind: "none", text: "", labelKey: "x.clip.captionsNone" };
}

// Offline is deliberately **not** a browser response cache: this build keeps protected Social media
// out of Cache Storage and service workers (see test/p0-offline-private-cache.test.js), so the only
// honest offline story is a real file the reader chooses to download onto the device.
export function offlinePolicy() {
  return { mode: "download_only", cache_allowed: false, reasonKey: "x.clip.offlinePolicy" };
}

// Auto-advance needs to know the neighbour: the list is the rendered clips, in order.
export function nextClipId(clips, currentId) {
  const list = Array.isArray(clips) ? clips : [];
  const index = list.findIndex((entry) => Number(entry?.id) === Number(currentId));
  if (index < 0 || index >= list.length - 1) return null;
  const next = list[index + 1];
  return Number.isSafeInteger(Number(next?.id)) ? Number(next.id) : null;
}


// Wave 14i: this mark used to be a gear drawn over the clip, in the top-left corner - the very corner the
// bar's own wordmark is in on a full-screen reel, which is why the owner read that pile as one ugly settings
// button and asked for it gone. The panel behind the mark is real and stays: the mark is the last row of the
// card's `•••` menu now, named with the same key the panel prints as its own title, so nothing had to be
// written twice and nothing was lost with the mark that left.
export function clipOptionsToggleMarkup(post, context) {
  const { esc, t } = context;
  return '<button data-clip-options-toggle="' + Number(post.id) + '" type="button" aria-expanded="false">' + esc(t("x.clip.options")) + '</button>';
}

export function clipOptionsMarkup(post, context) {
  const { esc, t, preferences = defaultClipPreferences(), offline = offlinePolicy() } = context;
  const id = Number(post.id);
  const quality = clipQualityFacts(post.media);
  const captions = captionSourceFor(post);
  const fact = [quality.mime, quality.size_label].filter(Boolean).join(" · ");
  const switchRow = (key, labelKey) => '<div class="clipOptionRow"><span>' + esc(t(labelKey)) + '</span>'
    + '<button type="button" class="clipOptionSwitch" data-clip-option="' + key + '" aria-pressed="' + (preferences[key] === true) + '">'
    + esc(t(preferences[key] === true ? "x.clip.on" : "x.clip.off")) + '</button></div>';
  return [
    '<section class="clipOptionsPanel" data-clip-options="' + id + '" hidden aria-label="' + esc(t("x.clip.options")) + '">',
    '<header><b>' + esc(t("x.clip.options")) + '</b><button type="button" data-clip-options-close aria-label="' + esc(t("x.clip.close")) + '">×</button></header>',
    '<div class="clipOptionRow"><span>' + esc(t("x.clip.quality")) + '</span><small>' + esc(fact || t("x.clip.qualityUnknown")) + '</small></div>',
    '<p class="clipOptionNote">' + esc(t("x.clip.singleRendition")) + '</p>',
    switchRow("captions", "x.clip.captions"),
    '<p class="clipOptionNote" data-clip-caption-source="' + esc(captions.kind) + '">' + esc(t(captions.labelKey)) + '</p>',
    '<div class="clipOptionRow"><span>' + esc(t("x.clip.speed")) + '</span><span class="clipSpeedGroup">'
      + CLIP_SPEEDS.map((speed) => '<button type="button" class="clipSpeed' + (speed === preferences.speed ? " on" : "") + '" data-clip-speed="' + speed + '" aria-pressed="' + (speed === preferences.speed) + '">' + speed + '×</button>').join("")
      + '</span></div>',
    switchRow("autoAdvance", "x.clip.autoAdvance"),
    '<p class="clipOptionNote">' + esc(t("x.clip.autoAdvanceNote")) + '</p>',
    switchRow("dataSaver", "x.clip.dataSaver"),
    '<p class="clipOptionNote">' + esc(t("x.clip.dataSaverNote")) + '</p>',
    '<div class="clipOptionActions">',
    '<button type="button" data-clip-download="' + id + '">' + esc(t("x.clip.download")) + '</button>',
    '</div>',
    '<p class="clipOptionNote" data-clip-offline-policy="' + esc(offline.mode) + '">' + esc(t(offline.reasonKey)) + '</p>',
    '</section>',
  ].join("");
}

export function clipSubtitlesMarkup(post, context) {
  const { esc, t } = context;
  const source = captionSourceFor(post);
  if (source.kind === "none") return "";
  const inner = source.kind === "track" ? "" : esc(source.text);
  return '<div class="clipSubtitles" data-clip-subtitles="' + Number(post.id) + '" hidden dir="auto" aria-label="' + esc(t("x.clip.captions")) + '">' + inner + '</div>';
}


const CLIP_OPTION_SWITCHES = Object.freeze(["captions", "autoAdvance", "dataSaver"]);

// Preferences are viewer-side and device-side, so they are applied to every clip on screen at once:
// a speed chosen on one clip is the speed of the timeline, not of that one card.
export function applyClipPreferences(root, preferences) {
  const prefs = normalizeClipPreferences(preferences);
  root.querySelectorAll("article.clipPost").forEach((article) => {
    const video = article.querySelector("video");
    const subtitles = article.querySelector("[data-clip-subtitles]");
    if (subtitles) subtitles.hidden = prefs.captions !== true;
    if (!video) return;
    try { video.playbackRate = prefs.speed; } catch { /* the element may not be ready yet */ }
    video.loop = prefs.autoAdvance !== true;
    video.preload = prefs.dataSaver === true ? "none" : "metadata";
    const track = video.querySelector("track[data-clip-track]");
    if (track?.track) track.track.mode = prefs.captions === true ? "showing" : "hidden";
  });
  return prefs;
}

function syncPanel(root, postId, prefs) {
  const panel = root.querySelector('.clipOptionsPanel[data-clip-options="' + Number(postId) + '"]');
  if (!panel) return;
  panel.querySelectorAll("[data-clip-speed]").forEach((button) => {
    const active = Number(button.dataset.clipSpeed) === prefs.speed;
    button.classList.toggle("on", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function bindClipOptions(root, context) {
  const { t, toast, mediaUrlFor, nextClipAfter } = context;
  const store = context.storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  let preferences = normalizeClipPreferences(context.preferences ?? readClipPreferences(store));
  const offline = offlinePolicy();
  const save = () => { preferences = writeClipPreferences(store, preferences); applyClipPreferences(root, preferences); };
  const label = (key) => (typeof t === "function" ? t(key) : key);

  root.querySelectorAll("[data-clip-options-toggle]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const article = button.closest("article");
    const panel = article?.querySelector(".clipOptionsPanel");
    if (!panel) return;
    const opening = panel.hasAttribute("hidden");
    panel.toggleAttribute("hidden", !opening);
    button.setAttribute("aria-expanded", String(opening));
    article.querySelector(".clipStage")?.classList.remove("clipChromeHidden");
  }));
  root.querySelectorAll("[data-clip-options-close]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const panel = button.closest(".clipOptionsPanel");
    panel?.setAttribute("hidden", "");
    panel?.closest("article")?.querySelector("[data-clip-options-toggle]")?.setAttribute("aria-expanded", "false");
  }));
  root.querySelectorAll("[data-clip-option]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const key = button.dataset.clipOption;
    if (!CLIP_OPTION_SWITCHES.includes(key)) return;
    preferences = { ...preferences, [key]: !(preferences[key] === true) };
    save();
    root.querySelectorAll('[data-clip-option="' + key + '"]').forEach((target) => {
      target.setAttribute("aria-pressed", String(preferences[key] === true));
      target.textContent = label(preferences[key] === true ? "x.clip.on" : "x.clip.off");
    });
    toast?.(label(preferences[key] === true ? "x.clip.on" : "x.clip.off"));
  }));
  root.querySelectorAll("[data-clip-speed]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const speed = Number(button.dataset.clipSpeed);
    if (!CLIP_SPEEDS.includes(speed)) return;
    preferences = { ...preferences, speed };
    save();
    root.querySelectorAll(".clipOptionsPanel").forEach((panel) => syncPanel(root, panel.dataset.clipOptions, preferences));
  }));
  root.querySelectorAll("[data-clip-download]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const url = mediaUrlFor?.(Number(button.dataset.clipDownload));
    if (!url || typeof document === "undefined") return toast?.(label("x.clip.downloadFailed"));
    button.disabled=true;
    try{const response=await api('/api/posts/'+Number(button.dataset.clipDownload));if(!response.ok)throw new Error(label('x.clip.downloadFailed'));await downloadPublishedPost(response.post,{notify:toast});}catch(error){toast?.(error.message);}finally{button.disabled=false;}
  }));
  // Auto-advance: when the switch is on, a finished clip rolls into the next one on screen. Loop has
  // to be off for that, which is why the switch states the trade-off in the panel.
  root.querySelectorAll("article.clipPost video").forEach((video) => video.addEventListener("ended", () => {
    if (preferences.autoAdvance !== true) return;
    const article = video.closest("article");
    const postId = Number(article?.dataset.postId || 0);
    const next = nextClipAfter?.(postId);
    const nextVideo = next ? root.querySelector('article[data-post-id="' + Number(next) + '"] video') : null;
    if (!nextVideo) return;
    nextVideo.scrollIntoView({ block: "center", behavior: "smooth" });
    nextVideo.play().catch(() => { /* a device may still require a gesture */ });
  }));
  applyClipPreferences(root, preferences);
  return { preferences: () => ({ ...preferences }), offline, apply: () => applyClipPreferences(root, preferences), save };
}
