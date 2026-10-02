const MOTION_STATIC_MAX = 7;
const MOTION_DYNAMIC_MIN = 20;

export function classifyMotion(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < MOTION_STATIC_MAX) return "static";
  if (value >= MOTION_DYNAMIC_MIN) return "dynamic";
  return "moderate";
}

export function classifyBrightness(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 86) return "dark";
  if (value >= 166) return "bright";
  return "balanced";
}

export function reelSoundProfile({ motion, brightness }) {
  if (motion === "dynamic" && brightness === "bright") return { mood: "upbeat", tags: ["energetic", "electronic", "pop", "happy"], speed: "high" };
  if (motion === "dynamic") return { mood: "energetic", tags: ["energetic", "electronic", "dance"], speed: "high" };
  if (motion === "static" && brightness === "dark") return { mood: "cinematic", tags: ["ambient", "cinematic", "emotional", "chillout"], speed: "low" };
  if (motion === "static") return { mood: "chill", tags: ["chillout", "ambient", "acoustic"], speed: "low" };
  if (brightness === "bright") return { mood: "happy", tags: ["happy", "pop", "upbeat"], speed: "medium" };
  if (brightness === "dark") return { mood: "emotional", tags: ["emotional", "cinematic", "ambient"], speed: "medium" };
  return { mood: "balanced", tags: ["pop", "electronic", "chillout"], speed: "medium" };
}

function waitFor(target, event, rejectEvent = "error") {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("VIDEO_ANALYSIS_FAILED")); };
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(event, done); target.removeEventListener(rejectEvent, failed); };
    const timer = setTimeout(failed, 3000);
    target.addEventListener(event, done, { once: true });
    target.addEventListener(rejectEvent, failed, { once: true });
  });
}

async function seek(video, time) {
  if (Math.abs(Number(video.currentTime || 0) - time) < .02) return;
  video.currentTime = time;
  await waitFor(video, "seeked");
}

function frameLuma(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const luma = new Uint8Array(width * height);
  let total = 0;
  for (let source = 0, target = 0; source < pixels.length; source += 4, target++) {
    const value = Math.round(.2126 * pixels[source] + .7152 * pixels[source + 1] + .0722 * pixels[source + 2]);
    luma[target] = value;
    total += value;
  }
  return { luma, brightness: total / luma.length };
}

export async function analyzeReelVideo(file, { document: doc = globalThis.document, URL: Url = globalThis.URL, samples = 8 } = {}) {
  if (!file || !String(file.type || "").startsWith("video/")) throw new Error("VIDEO_REQUIRED");
  const objectUrl = Url.createObjectURL(file);
  const video = doc.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;
  try {
    await waitFor(video, "loadedmetadata");
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("VIDEO_DURATION_INVALID");
    const width = 48;
    const height = Math.max(24, Math.min(48, Math.round(width * (Number(video.videoHeight || 27) / Math.max(1, Number(video.videoWidth || 48))))));
    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("VIDEO_CANVAS_UNAVAILABLE");
    const frameCount = Math.max(3, Math.min(12, Number(samples) || 8));
    let brightnessTotal = 0;
    let motionTotal = 0;
    let previous = null;
    for (let index = 0; index < frameCount; index++) {
      await seek(video, Math.min(Math.max(.01, duration - .02), duration * ((index + .5) / frameCount)));
      context.drawImage(video, 0, 0, width, height);
      const frame = frameLuma(context, width, height);
      brightnessTotal += frame.brightness;
      if (previous) {
        let delta = 0;
        for (let pixel = 0; pixel < frame.luma.length; pixel++) delta += Math.abs(frame.luma[pixel] - previous[pixel]);
        motionTotal += delta / frame.luma.length;
      }
      previous = frame.luma;
    }
    const brightnessScore = brightnessTotal / frameCount;
    const motionScore = motionTotal / Math.max(1, frameCount - 1);
    const analysis = {
      duration: Math.round(duration * 10) / 10,
      segmentSeconds: Math.max(15, Math.min(60, Math.round(duration))),
      brightnessScore: Math.round(brightnessScore * 10) / 10,
      motionScore: Math.round(motionScore * 10) / 10,
      brightness: classifyBrightness(brightnessScore),
      motion: classifyMotion(motionScore),
    };
    return { ...analysis, ...reelSoundProfile(analysis) };
  } finally {
    video.removeAttribute("src");
    video.load?.();
    Url.revokeObjectURL(objectUrl);
  }
}

export function synchronizeReelSound(video, audio, track) {
  if (!video || !audio || !track) return () => {};
  const segment = Math.max(15, Math.min(60, Number(track.segment_seconds || 30)));
  const offset = Math.max(0, Math.min(Number(track.duration || 0) - segment, Number(track.preview_offset || 0)));
  const sync = () => {
    if (!Number.isFinite(video.currentTime)) return;
    const wanted = offset + (video.currentTime % segment);
    if (Math.abs(Number(audio.currentTime || 0) - wanted) > .45) {
      try { audio.currentTime = wanted; } catch { /* metadata is not ready yet */ }
    }
  };
  const play = () => { sync(); audio.play().catch(() => {}); };
  const pause = () => audio.pause();
  const ended = () => { audio.pause(); try { audio.currentTime = offset; } catch {} };
  video.addEventListener("play", play);
  video.addEventListener("pause", pause);
  video.addEventListener("seeking", sync);
  video.addEventListener("timeupdate", sync);
  video.addEventListener("ended", ended);
  // The editor/player owns original-sound volume and mute preferences.
  sync();
  if(!video.paused)play();
  return () => {
    video.removeEventListener("play", play);
    video.removeEventListener("pause", pause);
    video.removeEventListener("seeking", sync);
    video.removeEventListener("timeupdate", sync);
    video.removeEventListener("ended", ended);
    audio.pause();
  };
}

function button(label, className = "") {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

export function mountReelAutoSound({ panel, video, file, api, onSelection, isCurrent = () => true, preferredTrack = null }) {
  if (!panel || !video || !file) return () => {};
  let alive = true;
  let tracks = [];
  let selected = null;
  let stopSync = () => {};
  panel.hidden = false;
  panel.replaceChildren();
  const head = document.createElement("header");
  const title = document.createElement("span");
  const titleStrong = document.createElement("b"); titleStrong.textContent = "Sunet automat";
  const status = document.createElement("small"); status.textContent = "Analizăm mișcarea și lumina clipului…"; status.setAttribute("aria-live", "polite");
  title.append(titleStrong, status);
  const badge = document.createElement("em"); badge.textContent = "Jamendo · CC BY";
  head.append(title, badge);
  const current = document.createElement("div"); current.className = "reelSoundCurrent"; current.hidden = true;
  const alternatives = document.createElement("div"); alternatives.className = "reelSoundAlternatives"; alternatives.hidden = true;
  const search = document.createElement("div"); search.className = "reelSoundSearch"; search.hidden = true;
  const searchInput = document.createElement("input"); searchInput.type = "search"; searchInput.maxLength = 80; searchInput.placeholder = "Caută piesă sau artist"; searchInput.setAttribute("aria-label", searchInput.placeholder);
  const searchButton = button("Caută");
  search.append(searchInput, searchButton);
  const truth = document.createElement("p"); truth.className = "reelSoundTruth"; truth.textContent = "Se redă un segment de 15–60 secunde direct de la Jamendo. Nexus nu stochează melodia.";
  const audio = document.createElement("audio"); audio.preload = "metadata"; audio.hidden = true;
  panel.append(head, current, alternatives, search, truth, audio);

  const clearSelection = () => {
    stopSync(); stopSync = () => {};
    audio.pause(); audio.removeAttribute("src"); audio.load();
    selected = null; video.muted = false; onSelection(null);
    current.replaceChildren(); current.hidden = true;
  };
  const choose = (track) => {
    stopSync();
    selected = track;
    audio.src = track.audio_url;
    audio.load();
    if(file.type.startsWith('video/'))stopSync = synchronizeReelSound(video, audio, track);
    else {audio.currentTime=Number(track.preview_offset||0);audio.play().catch(()=>{});const limit=()=>{if(audio.currentTime>=Number(track.preview_offset||0)+Number(track.segment_seconds||30))audio.currentTime=Number(track.preview_offset||0);};audio.addEventListener('timeupdate',limit);stopSync=()=>{audio.pause();audio.removeEventListener('timeupdate',limit);};}
    onSelection(track);
    current.replaceChildren(); current.hidden = false;
    const info = document.createElement("span");
    const name = document.createElement("b"); name.textContent = track.name;
    const artist = document.createElement("small"); artist.textContent = track.artist;
    const credit = document.createElement("a"); credit.href = track.share_url; credit.target = "_blank"; credit.rel = "noopener noreferrer"; credit.textContent = `${track.license} · credit artist`;
    info.append(name, artist, credit);
    const change = button("Schimbă sunetul", "reelSoundChange");
    change.onclick = () => { alternatives.hidden = !alternatives.hidden; search.hidden = alternatives.hidden; change.setAttribute("aria-expanded", String(!alternatives.hidden)); };
    const accept = button("Păstrează", "reelSoundAccept");
    accept.onclick = () => { alternatives.hidden = true; search.hidden = true; status.textContent = "Sunet păstrat pentru publicare"; };
    const remove = button("Fără sunet", "reelSoundRemove"); remove.onclick = () => { clearSelection(); alternatives.hidden = false; search.hidden = false; status.textContent = "Fără sunet selectat"; };
    current.append(info, change, accept, remove);
    alternatives.querySelectorAll("button").forEach((entry) => entry.classList.toggle("selected", entry.dataset.trackId === track.id));
    status.textContent = "Sunet aplicat automat pe preview";
  };
  const paintTracks = (items) => {
    tracks = items.slice(0, 5);
    alternatives.replaceChildren();
    for (const track of tracks) {
      const option = button("", "reelSoundOption"); option.dataset.trackId = track.id;
      const text = document.createElement("span");
      const name = document.createElement("b"); name.textContent = track.name;
      const artist = document.createElement("small"); artist.textContent = `${track.artist} · ${track.license}`;
      text.append(name, artist);
      const mark = document.createElement("i"); mark.textContent = "♫";
      option.append(mark, text);
      option.onclick = () => choose(track);
      alternatives.append(option);
    }
    if (tracks.length) choose(tracks.find((track) => track.id === preferredTrack?.id) || tracks[0]);
  };
  let analysis = {motion:'moderate',brightness:'balanced',segmentSeconds:30};
  const request = async (query = "", trackId = "") => {
    status.textContent = query ? "Căutăm în catalogul Jamendo…" : "Căutăm un sunet potrivit…";
    const params = new URLSearchParams({
      motion: analysis.motion, brightness: analysis.brightness,
      duration: String(analysis.segmentSeconds), ...(query ? { q: query } : {}), ...(trackId ? {track_id:trackId} : {}),
    });
    const result = await api(`/api/reels/sound-suggestions?${params}`);
    if (!alive || !isCurrent()) return;
    if (!result?.ok) {
      status.textContent = result?.code === "JAMENDO_NOT_CONFIGURED" ? "Jamendo trebuie configurat de administrator" : "Sunetul automat nu este disponibil momentan";
      search.hidden = false;
      return;
    }
    if (!Array.isArray(result.tracks) || !result.tracks.length) {
      status.textContent = "Nu am găsit o piesă CC potrivită. Încearcă o căutare.";
      search.hidden = false;
      return;
    }
    paintTracks(result.tracks);
  };
  searchButton.addEventListener('click',()=>{const query=searchInput.value.trim();if(query)request(query).catch(()=>{if(alive)status.textContent='Căutarea nu a reușit. Încearcă din nou.';});});
  searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchButton.click();}});
  if (preferredTrack) paintTracks([preferredTrack]);
  (file.type.startsWith('video/')?analyzeReelVideo(file):Promise.resolve({motion:'static',brightness:'balanced',segmentSeconds:30})).then((value) => {
    if (!alive || !isCurrent()) return;
    analysis = value;
    status.textContent = `${value.motion === "dynamic" ? "Dinamic" : value.motion === "static" ? "Static" : "Mișcare moderată"} · ${value.brightness === "bright" ? "luminos" : value.brightness === "dark" ? "întunecat" : "lumină echilibrată"}`;
    return preferredTrack ? request('',preferredTrack.id) : request();
  }).catch(async () => { if (!alive || !isCurrent()) return; try { if (!preferredTrack) await request(); } catch { status.textContent = 'Sunetul nu este disponibil. Poți continua editarea.'; search.hidden=false; } });
  const root=panel.closest('.cameraComposer');
  const stageWatcher=new MutationObserver(()=>{if(root?.dataset.cameraState!=='review')audio.pause();else if(selected)audio.play().catch(()=>{});});
  if(root)stageWatcher.observe(root,{attributes:true,attributeFilter:['data-camera-state']});
  const removed=new MutationObserver(()=>{if(!panel.isConnected){alive=false;stopSync();audio.pause();removed.disconnect();stageWatcher.disconnect();}});removed.observe(document.body,{childList:true,subtree:true});
  return () => { alive = false; removed.disconnect();stageWatcher.disconnect();clearSelection(); panel.hidden = true; };
}
