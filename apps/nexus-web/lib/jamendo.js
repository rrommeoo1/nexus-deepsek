import { createHmac, timingSafeEqual } from "node:crypto";

const JAMENDO_ENDPOINT = "https://api.jamendo.com/v3.0/tracks/";
const SAFE_TAGS = new Set(["upbeat", "energetic", "electronic", "pop", "happy", "dance", "ambient", "cinematic", "emotional", "chillout", "chill", "acoustic", "soundtrack"]);
const SAFE_SPEEDS = new Set(["verylow", "low", "medium", "high", "veryhigh"]);

export function jamendoProfile({ motion, brightness, query = "" }) {
  const cleanQuery = String(query || "").trim().replace(/[^\p{L}\p{N} _.'-]/gu, "").slice(0, 80);
  if (cleanQuery) return { query: cleanQuery, tags: [], speed: null };
  if (motion === "dynamic" && brightness === "bright") return { tags: ["energetic", "electronic", "pop", "happy"], speed: "high" };
  if (motion === "dynamic") return { tags: ["energetic", "electronic", "dance"], speed: "high" };
  if (motion === "static" && brightness === "dark") return { tags: ["ambient", "cinematic", "emotional", "chillout"], speed: "low" };
  if (motion === "static") return { tags: ["chillout", "ambient", "acoustic"], speed: "low" };
  if (brightness === "bright") return { tags: ["happy", "pop", "upbeat"], speed: "medium" };
  if (brightness === "dark") return { tags: ["emotional", "cinematic", "ambient"], speed: "medium" };
  return { tags: ["pop", "electronic", "chillout"], speed: "medium" };
}

export function buildJamendoTracksUrl({ clientId, motion, brightness, duration, query = "" }) {
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(String(clientId || ""))) throw new Error("JAMENDO_NOT_CONFIGURED");
  const profile = jamendoProfile({ motion, brightness, query });
  const segment = Math.max(15, Math.min(60, Math.round(Number(duration) || 30)));
  const url = new URL(JAMENDO_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "20");
  url.searchParams.set("order", "popularity_total");
  url.searchParams.set("include", "licenses musicinfo");
  url.searchParams.set("audioformat", "mp31");
  url.searchParams.set("durationbetween", `${segment}_900`);
  // Synchronising a track with video creates an adaptation. Free suggestions therefore exclude
  // NoDerivatives, NonCommercial and ShareAlike conditions and retain permissive CC attribution.
  url.searchParams.set("ccnd", "false");
  url.searchParams.set("ccnc", "false");
  url.searchParams.set("ccsa", "false");
  if (profile.query) url.searchParams.set("search", profile.query);
  else {
    const tags = profile.tags.filter((tag) => SAFE_TAGS.has(tag));
    if (tags.length) url.searchParams.set("fuzzytags", tags.join("+"));
    if (SAFE_SPEEDS.has(profile.speed)) url.searchParams.set("speed", profile.speed);
  }
  return { url, segment, profile };
}

function isPermissiveCcAttribution(value) {
  try {
    const url = new URL(String(value || ""));
    return new Set(["http:", "https:"]).has(url.protocol) && url.hostname === "creativecommons.org" && /^\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)\/?$/i.test(url.pathname);
  } catch { return false; }
}

function isJamendoAudioUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com"));
  } catch { return false; }
}

function isJamendoShareUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com"));
  } catch { return false; }
}

function isJamendoImageUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && (url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com"));
  } catch { return false; }
}

export function normalizeJamendoTrack(track, segmentSeconds) {
  const id = String(track?.id || "");
  const name = String(track?.name || "").trim().slice(0, 160);
  const artist = String(track?.artist_name || "").trim().slice(0, 160);
  const audio = String(track?.audio || "");
  const shareUrl = String(track?.shareurl || track?.shorturl || "");
  const imageUrl = String(track?.image || track?.album_image || "");
  const licenseUrl = String(track?.license_ccurl || "").replace(/^http:\/\//i, "https://");
  const duration = Math.round(Number(track?.duration || 0));
  if (!/^\d{1,18}$/.test(id) || !name || !artist || duration < 15 || !isJamendoAudioUrl(audio) || !isJamendoShareUrl(shareUrl) || !isPermissiveCcAttribution(licenseUrl)) return null;
  const segment = Math.max(15, Math.min(60, Number(segmentSeconds) || 30, duration));
  const previewOffset = Math.max(0, Math.min(15, duration - segment));
  return {
    provider: "jamendo", id, name, artist, duration, audio_url: audio, share_url: shareUrl,
    image_url: isJamendoImageUrl(imageUrl) ? imageUrl : "",
    license_url: licenseUrl, license: "CC BY", attribution: `${name} — ${artist}`,
    segment_seconds: segment, preview_offset: previewOffset,
  };
}

function tokenBody(track, expiresAt) {
  return JSON.stringify({ v: 1, exp: expiresAt, track });
}

export function signJamendoSelection(track, secret, now = Date.now()) {
  const body = Buffer.from(tokenBody(track, now + 2 * 60 * 60 * 1000)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyJamendoSelection(token, secret, now = Date.now()) {
  const [body, signature, extra] = String(token || "").split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed?.v !== 1 || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
    const track = parsed.track;
    return track?.provider === "jamendo" && normalizeJamendoTrack({
      id: track.id, name: track.name, artist_name: track.artist, duration: track.duration,
      audio: track.audio_url, shareurl: track.share_url, license_ccurl: track.license_url, image: track.image_url,
    }, track.segment_seconds) ? track : null;
  } catch { return null; }
}
