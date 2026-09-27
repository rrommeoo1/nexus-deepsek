// Nexus content ingest — dev-only, out-of-band catalog seeding.
//
// It fetches openly licensed media and text from an explicit allowlist of public
// sources (Wikimedia Commons, Openverse, Wikipedia), strips embedded metadata,
// admits every file through the real content-addressed media pipeline and then
// publishes real posts, stories and highlights through the repository layer.
//
// Nothing here runs at request time: the application keeps serving local
// /media/<hash>.<ext> objects, so the runtime stays offline.
//
//   node scripts/content-ingest.mjs --plan
//   node scripts/content-ingest.mjs --dry-run --limit 4
//   NEXUS_CONTENT_INGEST=local-catalog node scripts/content-ingest.mjs --apply --user 19 --confirm-live-db
//
// Attribution for every ingested object is stored in content_sources (see
// lib/db.js) and reported in a receipt under data/content-ingest-receipts/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openDb, DATA_DIR } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { storeMedia } from "../lib/media.js";
import { assessSocialContent } from "../lib/moderation.js";

export const INGEST_SCHEMA = "NEXUS_CONTENT_INGEST_V1";
export const INGEST_MARKER = "seeded_catalog";
export const USER_AGENT = "NexusContentIngest/1.0 (local dev catalog seeding; no runtime egress)";
// The admission budget is env-tunable so a catalog run can be rehearsed against a
// tighter cap (for example to prove the derivative path) without editing code.
const MAX_BYTES_OVERRIDE = Number(process.env.NEXUS_INGEST_MAX_BYTES || 0);
export const MAX_MEDIA_BYTES = MAX_BYTES_OVERRIDE > 0 ? MAX_BYTES_OVERRIDE : 20 * 1024 * 1024;
// A social clip feed takes clips, not documentaries: longer open video is catalogued
// elsewhere and is refused before download.
export const MAX_VIDEO_SECONDS = 600;
export const REQUEST_SPACING_MS = 700;
export const ALLOWED_SOURCE_HOSTS = Object.freeze([
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "api.openverse.org",
  "ro.wikipedia.org",
  "en.wikipedia.org",
]);
// Openverse aggregates third-party origins: only these trusted origins are accepted.
export const ALLOWED_ORIGIN_HOSTS = Object.freeze([
  "thumb.wikimedia.org",
  "upload.wikimedia.org",
  "live.staticflickr.com",
  "images.rawpixel.com",
  "cdn.stocksnap.io",
]);
export const ALLOWED_LICENCES = Object.freeze([
  "cc0", "public domain", "pd", "cc by", "cc-by", "cc by-sa", "cc-by-sa", "cc by 4.0", "cc by-sa 4.0",
]);
export const BLOCKED_CAPTION_TERMS = Object.freeze([
  "nude", "nudity", "sex", "sexual", "gore", "corpse", "execution", "beheading", "hate", "slur",
]);

const QUERIES = Object.freeze({
  photos: ["Bucharest architecture", "Carpathian mountains landscape", "street photography night city", "coffee still life", "forest fog morning", "traditional romanian village", "modern architecture facade", "harbour sunset boats"],
  clips: ["city timelapse aerial", "sea waves slow motion", "forest drone flight", "rain on window", "street traffic timelapse", "mountain clouds timelapse"],
  texts: ["București", "Carpați", "Delta Dunării", "Sighișoara", "Transilvania", "Marea Neagră", "Fotografie"],
});

export function parseArgs(argv) {
  const flags = { plan: false, dryRun: false, apply: false, confirmLiveDb: false, noStories: false, user: 19, limit: 0, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") flags.plan = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--apply") flags.apply = true;
    else if (arg === "--confirm-live-db") flags.confirmLiveDb = true;
    else if (arg === "--no-stories") flags.noStories = true;
    else if (arg === "--user") flags.user = Number(argv[++index]);
    else if (arg === "--limit") flags.limit = Number(argv[++index]);
    else if (arg === "--only") flags.only = String(argv[++index] || "");
  }
  return flags;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchJson(url, attempt = 0) {
  const host = new URL(url).host;
  if (!ALLOWED_SOURCE_HOSTS.includes(host)) throw new Error(`HOST_NOT_ALLOWED: ${host}`);
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (response.status === 429 && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}: ${host}`);
  return response.json();
}

async function fetchBinary(url, { maxBytes = MAX_MEDIA_BYTES, attempt = 0 } = {}) {
  const host = new URL(url).host;
  if (!ALLOWED_SOURCE_HOSTS.includes(host) && !ALLOWED_ORIGIN_HOSTS.includes(host)) throw new Error(`HOST_NOT_ALLOWED: ${host}`);
  // Politeness budget: stay well under one asset request per second.
  await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  // Wikimedia throttles bulk asset downloads: back off instead of dropping the asset.
  if ((response.status === 429 || response.status === 503) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
    return fetchBinary(url, { maxBytes, attempt: attempt + 1 });
  }
  if (!response.ok) throw new Error(`ASSET_HTTP_${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`ASSET_TOO_LARGE: ${declared}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error(`ASSET_TOO_LARGE: ${buffer.length}`);
  return buffer;
}

/* Licence admission: only public domain and CC licences that allow reuse are accepted. */
export function licenceDecision(rawLicence) {
  const value = String(rawLicence ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!value) return { allowed: false, reason: "licence_missing" };
  // NonCommercial and NoDerivatives variants must never enter the catalog.
  if (/non-?commercial|\bnc\b|no-?deriv|\bnd\b|noderiv/.test(value)) return { allowed: false, reason: "licence_restricted" };
  // Openverse returns SPDX-style codes with a version suffix: "by 2.0", "by-sa 4.0", "cc0".
  const code = value.replace(/\s*\d+(\.\d+)*$/, "").trim();
  if (["by", "by-sa", "cc0", "pdm", "zero", "pd"].includes(code)) {
    const normalized = code === "by" ? "cc by" : code === "by-sa" ? "cc by-sa" : code === "cc0" ? "cc0" : "public domain";
    return { allowed: true, reason: "licence_open", normalized };
  }
  const allowed = ALLOWED_LICENCES.some((licence) => value.includes(licence)) || value.includes("public domain");
  return allowed ? { allowed: true, reason: "licence_open", normalized: value } : { allowed: false, reason: "licence_not_allowlisted" };
}

/* ---- embedded metadata removal (no external tooling, no re-encode) ---- */

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* JPEG: drop APP1 (Exif/XMP), APP13 (IPTC) and COM segments, keep image data. */
export function stripJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset < buffer.length - 3) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xda) { parts.push(buffer.subarray(offset)); break; }
    if (marker === 0xd9) { parts.push(buffer.subarray(offset, offset + 2)); break; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(buffer.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return Buffer.concat(parts);
}

/* PNG: drop tEXt/zTXt/iTXt/eXIf chunks, keep everything the decoder needs. */
export function stripPngMetadata(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(signature)) return buffer;
  const parts = [buffer.subarray(0, 8)];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) break;
    if (!["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) parts.push(buffer.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

/* WebP: drop EXIF/XMP chunks and repair the RIFF size field. */
export function stripWebpMetadata(buffer) {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return buffer;
  const parts = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > buffer.length) break;
    if (!["EXIF", "XMP "].includes(fourcc)) parts.push(buffer.subarray(offset, end));
    offset = end;
  }
  const payload = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(payload.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, payload]);
}

export function stripMetadata(buffer, mime) {
  let output = buffer;
  if (mime === "image/jpeg") output = stripJpegMetadata(buffer);
  else if (mime === "image/png") output = stripPngMetadata(buffer);
  else if (mime === "image/webp") output = stripWebpMetadata(buffer);
  // Container-level video metadata (moov/udta, Matroska Tags) is reported as a
  // known limitation in the receipt instead of being claimed as removed.
  return { buffer: output, stripped: output.length !== buffer.length };
}

export function captionSafety(text) {
  const value = String(text ?? "").toLowerCase();
  // Word-boundary matching: a substring hit inside a longer word is a false positive.
  const hit = BLOCKED_CAPTION_TERMS.find((term) => new RegExp(`(^|[^a-z0-9])${term}(s|es)?([^a-z0-9]|$)`, "i").test(value));
  return hit ? { safe: false, reason: `caption_term:${hit}` } : { safe: true, reason: "ok" };
}

export function cleanCredit(value) {
  const text = stripHtml(value)
    .replace(/\b(Unknown author)(?:\s+\1\b)+/gi, "$1")
    .replace(/^\s*(\S.*?)\s+\1\s*$/i, "$1");
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

/* ---- allowlisted source adapters ---- */

export async function commonsCandidates({ query, kind = "image", limit = 8 }) {
  const filetype = kind === "video" ? "video" : "bitmap";
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search"
    + "&gsrsearch=" + encodeURIComponent(`${query} filetype:${filetype}`)
    + "&gsrnamespace=6&gsrlimit=" + Number(limit)
    + "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600";
  const data = await fetchJson(url);
  const items = Object.values(data?.query?.pages ?? {}).map((page) => {
    const info = page?.imageinfo?.[0];
    if (!info) return null;
    const meta = info.extmetadata ?? {};
    const isVideo = String(info.mime || "").startsWith("video/");
    return {
      provider: "wikimedia_commons",
      title: String(page.title || "").replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " "),
      // Transcodes are resolved in a second batched call: they are the only way to
      // publish a clip whose original exceeds the admission cap.
      fileTitle: String(page.title || "").replace(/^File:/i, ""),
      derivatives: [],
      mime: isVideo ? info.mime : (info.thumbmime || info.mime),
      declaredBytes: isVideo ? Number(info.size || 0) : 0,
      assetUrl: isVideo ? info.url : (info.thumburl || info.url),
      licence: stripHtml(meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? meta.License?.value ?? ""),
      licenceUrl: String(meta.LicenseUrl?.value ?? ""),
      author: cleanCredit(meta.Artist?.value ?? "") || "Wikimedia Commons",
      description: stripHtml(meta.ImageDescription?.value ?? ""),
      sourceUrl: String(info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`),
      // Commons hosts its own project documentation as video: it is real and openly
      // licensed, but it is not catalog material for a social profile.
      selfPromotional: /\b(wikipedia|wikimedia|wikidata|wikisource|commons)\b/i.test(`${page.title || ""} ${meta.ImageDescription?.value ?? ""}`),
    };
  }).filter((item) => item && item.assetUrl && item.mime);
  if (kind === "video") {
    const derivativeMap = await commonsVideoDerivatives(items.map((item) => item.fileTitle)).catch(() => new Map());
    for (const item of items) {
      const info = derivativeMap.get(item.fileTitle);
      item.derivatives = info?.derivatives ?? [];
      item.duration = info?.duration ?? 0;
    }
    // Smallest declared originals first: otherwise the admission cap discards the set.
    items.sort((a, b) => (a.declaredBytes || Number.MAX_SAFE_INTEGER) - (b.declaredBytes || Number.MAX_SAFE_INTEGER));
  }
  return items;
}

/* ---- video derivatives (Commons transcodes) ---- */

export function videoDerivativeOrder(derivatives) {
  const rank = (key) => { const match = /^(\d+)p/.exec(String(key || "")); return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER; };
  return (Array.isArray(derivatives) ? derivatives : [])
    .filter((entry) => entry && typeof entry.src === "string" && /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/transcoded\//.test(entry.src))
    .map((entry) => ({ key: String(entry.transcodekey || entry.key || ""), src: entry.src, mime: String(entry.type || "").split(";")[0].trim() }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

export function parseContentRange(value) {
  const match = /bytes[=\s]+\d+-\d+\/(\d+)/i.exec(String(value ?? ""));
  return match ? Number(match[1]) : 0;
}

async function commonsVideoDerivatives(titles) {
  const map = new Map();
  const wanted = (titles ?? []).filter(Boolean).slice(0, 20);
  if (!wanted.length) return map;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=videoinfo&viprop=derivatives"
    + "&titles=" + encodeURIComponent(wanted.map((title) => "File:" + title).join("|"));
  const data = await fetchJson(url);
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const info = page?.videoinfo?.[0] ?? {};
    map.set(String(page.title || "").replace(/^File:/i, ""), {
      derivatives: videoDerivativeOrder(info.derivatives ?? []),
      duration: Number(info.duration || 0),
    });
  }
  return map;
}

/* One kilobyte of a ranged GET is enough to read the real size from Content-Range. */
export async function probeRemoteSize(url, { attempt = 0 } = {}) {
  const host = new URL(url).host;
  if (!ALLOWED_SOURCE_HOSTS.includes(host)) throw new Error("HOST_NOT_ALLOWED: " + host);
  await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, range: "bytes=0-1023" } });
  if ((response.status === 429 || response.status === 503) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
    return probeRemoteSize(url, { attempt: attempt + 1 });
  }
  if (!response.ok) throw new Error("PROBE_HTTP_" + response.status);
  const bytes = parseContentRange(response.headers.get("content-range")) || Number(response.headers.get("content-length") || 0);
  const mime = String(response.headers.get("content-type") || "").split(";")[0].trim();
  await response.arrayBuffer().catch(() => null);
  return { ok: true, bytes, mime };
}

/* Lightest derivative that fits the cap, otherwise the untouched original. */
export async function resolveVideoAsset(source, { maxBytes = MAX_MEDIA_BYTES } = {}) {
  const candidates = Array.isArray(source?.derivatives) ? source.derivatives : [];
  for (const candidate of candidates) {
    const probe = await probeRemoteSize(candidate.src).catch(() => null);
    if (!probe?.ok || probe.bytes > maxBytes) continue;
    return {
      ...source,
      assetUrl: candidate.src,
      declaredBytes: probe.bytes,
      mime: ALLOWED_MIME.includes(candidate.mime) ? candidate.mime : ALLOWED_MIME.includes(probe.mime) ? probe.mime : "video/webm",
      derivativeKey: candidate.key || "derivative",
    };
  }
  return source;
}

export async function openverseCandidates({ query, limit = 8 }) {
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(query)
    + "&license_type=commercial,modification&mature=false&page_size=" + Number(limit)
    + "&extension=jpg,png,webp";
  const data = await fetchJson(url);
  return (data?.results ?? []).map((item) => {
    const assetUrl = String(item.url ?? "");
    const extension = (assetUrl.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "").toLowerCase();
    const declared = String(item.filetype ?? extension);
    const mime = declared.startsWith("png") || declared === "png" ? "image/png"
      : declared.startsWith("webp") ? "image/webp" : "image/jpeg";
    return {
      provider: "openverse",
      title: String(item.title || query).trim(),
      mime,
      // Openverse omits filesize for some sources: the download path still enforces the 20 MB cap.
      declaredBytes: Number(item.filesize || 0),
      assetUrl,
      licence: `${item.license ?? ""} ${item.license_version ?? ""}`.trim(),
      licenceUrl: String(item.license_url ?? ""),
      author: String(item.creator ?? "") || "Openverse",
      description: stripHtml(item.description ?? ""),
      sourceUrl: String(item.foreign_landing_url ?? assetUrl),
    };
  }).filter((item) => item.assetUrl && /^https:\/\//.test(item.assetUrl));
}

export async function wikipediaExtract({ title, lang = "ro" }) {
  const host = lang === "en" ? "en.wikipedia.org" : "ro.wikipedia.org";
  const url = `https://${host}/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const page = Object.values(data?.query?.pages ?? {})[0];
  const extract = String(page?.extract ?? "").replace(/\s+/g, " ").trim();
  if (!extract || !page?.title) return null;
  return {
    title: String(page.title),
    extract,
    licence: "CC BY-SA 4.0",
    author: "Wikipedia contributors",
    sourceUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, "_"))}`,
  };
}

export function trimCaption(text, limit = 240) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "")) + "…";
}

export function creditLine(source) {
  const author = String(source.author || "").slice(0, 60);
  const licence = String(source.licence || "").slice(0, 40);
  return `· ${author}${licence ? " · " + licence : ""}`;
}

/* ---- persistence helpers ---- */

export function ensureSourceTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS content_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    hash TEXT,
    provider TEXT NOT NULL,
    source_url TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    licence TEXT NOT NULL DEFAULT '',
    licence_url TEXT NOT NULL DEFAULT '',
    metadata_stripped INTEGER NOT NULL DEFAULT 0,
    ingest_marker TEXT NOT NULL DEFAULT 'seeded_catalog',
    retrieved_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
}

function recordSource(db, entry) {
  db.prepare(`INSERT INTO content_sources (media_id, hash, provider, source_url, author, licence, licence_url, metadata_stripped, ingest_marker)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    entry.mediaId ?? null, entry.hash, entry.provider, entry.sourceUrl, entry.author, entry.licence,
    entry.licenceUrl, entry.metadataStripped ? 1 : 0, entry.marker,
  );
}

function alreadyIngested(db, sourceUrl) {
  return Boolean(db.prepare("SELECT 1 FROM content_sources WHERE source_url = ? AND ingest_marker = ?")
    .get(String(sourceUrl || ""), INGEST_MARKER));
}

export const ALLOWED_MIME = Object.freeze(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);

export function admitMedia(repo, { buffer, mime, userId, purpose }) {
  if (!ALLOWED_MIME.includes(mime)) return { ok: false, reason: `mime_not_supported:${mime}` };
  const cleaned = stripMetadata(buffer, mime);
  let stored;
  try {
    stored = storeMedia(cleaned.buffer, mime);
  } catch (error) {
    return { ok: false, reason: `store:${String(error.message).slice(0, 60)}` };
  }
  if (stored.scanStatus !== "ready_local_validation") return { ok: false, reason: `scan:${stored.scanReason}` };
  const media = repo.insertMedia({
    hash: stored.hash, ext: stored.ext, mime: stored.mime, detectedMime: stored.detectedMime,
    kind: stored.kind, size: stored.size, uploadedBy: userId, purpose, actorPersona: "social",
    scanStatus: stored.scanStatus, scanReason: stored.scanReason,
  });
  if (!media) return { ok: false, reason: "media_hash_conflict" };
  return { ok: true, media, metadataStripped: cleaned.stripped, bytes: buffer.length };
}

/* Every published caption is assessed before the write; blocked captions never reach the database. */
export function captionGate(caption, kind) {
  const safety = captionSafety(caption);
  if (!safety.safe) return { ok: false, reason: safety.reason };
  const assessment = assessSocialContent({ text: caption, provenance: "NOT_DECLARED", mediaKind: kind });
  if (assessment.decision !== "ALLOW") return { ok: false, reason: `assessment:${assessment.decision}` };
  return { ok: true, assessment };
}

/* ---- publication flows ---- */

export async function publishTextPost({ repo, db, userId, source, lang = "ro", thread = 0 }) {
  const caption = [trimCaption(source.extract, 240), `· ${source.author} · ${source.licence}`].join(" ");
  const gate = captionGate(caption, "text");
  if (!gate.ok) return { ok: false, stage: "caption", reason: gate.reason, source };
  const post = repo.createPost({
    userId, persona: "social", kind: "text", caption, mediaId: null,
    visibility: "public", language: lang, regionCode: lang === "ro" ? "RO-B" : null, provenance: "NOT_DECLARED",
  });
  const replies = [];
  if (thread > 0) {
    const sentences = String(source.extract).split(/(?<=[.!?])\s+/).filter((line) => line.length > 40).slice(1, 1 + thread);
    let parentId = null;
    for (const sentence of sentences) {
      const body = [trimCaption(sentence, 240), `· ${source.author} · ${source.licence}`].join(" ");
      if (!captionGate(body, "text").ok) continue;
      const comment = repo.addSocialComment({ userId, actorPersona: "social", postId: post.id, body, parentId });
      if (!comment) break;
      replies.push(comment.id);
      parentId = comment.id;
    }
  }
  return { ok: true, post, replies, caption };
}

export async function publishStory({ repo, db, userId, source, media, caption, ttlSeconds = 86400 }) {
  const gate = captionGate(caption, media.kind);
  if (!gate.ok) return { ok: false, stage: "caption", reason: gate.reason, source };
  const story = repo.createStory({
    userId, persona: "social", mediaId: media.id, caption,
    visibility: "followers", expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  return { ok: true, story, assessment: gate.assessment.decision };
}

export function attachHighlights(repo, { userId, title, storyIds }) {
  const highlight = repo.createStoryHighlight({ ownerId: userId, actorPersona: "social", title });
  if (!highlight) return { ok: false, reason: "highlight_limit_or_duplicate" };
  const linked = [];
  for (const storyId of storyIds) {
    if (!repo.addStoryToHighlight({ highlightId: highlight.id, storyId, ownerId: userId, actorPersona: "social" })) continue;
    linked.push(storyId);
  }
  return { ok: true, highlight, linked };
}

export function writeReceipt(receipt) {
  const directory = join(DATA_DIR, "content-ingest-receipts");
  mkdirSync(directory, { recursive: true });
  // ISO timestamps carry ":" characters, which are not valid in Windows file names.
  const stamp = String(receipt.started_at).replace(/[:.]/g, "-");
  const file = join(directory, `${stamp}-user${receipt.user_id}.json`);
  writeFileSync(file, JSON.stringify(receipt, null, 2), "utf8");
  return file;
}

/* A receipt entry must name the resource that was actually stored, not the candidate:
   an oversized original is published through a Commons transcode instead. */
export function publishedEntry({ kind, source, result }) {
  return {
    kind,
    post_id: result.post.id,
    media_id: result.media.id,
    provider: source.provider,
    licence: source.licence,
    source_url: source.sourceUrl,
    caption: result.caption,
    derivative: result.source?.derivativeKey ?? null,
    bytes: result.bytes ?? null,
  };
}

/* The receipt is rewritten after every publication so a killed run stays recoverable. */
function flushReceipt(receipt) {
  receipt.receipt_file = writeReceipt(receipt);
  return receipt.receipt_file;
}

export function preflight({ db, flags }) {
  if (!flags.plan && !flags.dryRun && !flags.apply) return { ok: false, reason: "choose --plan, --dry-run or --apply" };
  if (flags.apply && process.env.NEXUS_CONTENT_INGEST !== "local-catalog") return { ok: false, reason: "set NEXUS_CONTENT_INGEST=local-catalog to allow writes" };
  if (flags.apply && !flags.confirmLiveDb) return { ok: false, reason: "add --confirm-live-db to write into the live database" };
  const user = db.prepare("SELECT id, handle, traffic_class FROM users WHERE id = ?").get(flags.user);
  if (!user) return { ok: false, reason: `user ${flags.user} not found` };
  if (user.traffic_class === "SYSTEM_TEST") return { ok: false, reason: "refusing to publish catalog content on a SYSTEM_TEST account" };
  const persona = db.prepare("SELECT persona, visibility, discoverability FROM personas WHERE user_id = ? AND persona = 'social'").get(flags.user);
  if (!persona) return { ok: false, reason: `user ${flags.user} has no social profile` };
  return { ok: true, user, persona };
}

/* ---- orchestration ---- */

function grantPurpose(db, { mediaId, userId, purpose }) {
  db.prepare("INSERT OR IGNORE INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, ?, 'social')")
    .run(mediaId, userId, purpose);
}

async function collectSources(kind, query) {
  const found = [];
  try {
    found.push(...await commonsCandidates({ query, kind: kind === "video" ? "video" : "image", limit: kind === "video" ? 8 : 6 }));
  } catch (error) {
    found.push({ error: `commons:${String(error.message).slice(0, 60)}` });
  }
  if (kind === "image") {
    try {
      found.push(...await openverseCandidates({ query, limit: 4 }));
    } catch (error) {
      found.push({ error: `openverse:${String(error.message).slice(0, 60)}` });
    }
  }
  return found;
}

async function ingestCategory(ctx, { queries, kind, purpose, target }) {
  const { repo, db, flags, receipt, language, regionCode, storyTarget, storyIds } = ctx;
  let published = 0;
  for (const query of queries) {
    if (published >= target) break;
    const candidates = await collectSources(kind, query);
    for (const source of candidates) {
      if (published >= target) break;
      if (source.error) { receipt.skipped.push({ stage: "search", reason: source.error, query }); continue; }
      // The same file surfaces in several queries and categories: one attempt per run
      // keeps the politeness budget for objects that have not been seen yet.
      if (ctx.attempted.has(source.sourceUrl)) continue;
      ctx.attempted.add(source.sourceUrl);
      const result = await ingestAsset({ repo, db, userId: flags.user, source, kind, purpose, language, regionCode });
      if (!result.ok) {
        receipt.skipped.push({ stage: result.stage, reason: result.reason, provider: source.provider, source_url: source.sourceUrl });
        continue;
      }
      published += 1;
      receipt.posts.push(result.post.id);
      receipt.media.push(result.media.id);
      if (result.metadataStripped) receipt.metadata_stripped += 1;
      receipt.published.push(publishedEntry({ kind, source, result }));
      flushReceipt(receipt);
      if (storyIds && storyIds.length < (storyTarget ?? 0)) {
        grantPurpose(db, { mediaId: result.media.id, userId: flags.user, purpose: "story" });
        const story = await publishStory({
          repo, db, userId: flags.user, source, media: result.media,
          caption: `${trimCaption(source.title, 80)} ${creditLine(source)}`.trim(),
        });
        if (story.ok) { storyIds.push(story.story.id); receipt.stories.push(story.story.id); }
        else receipt.skipped.push({ stage: "story", reason: story.reason, provider: source.provider, source_url: source.sourceUrl });
      }
    }
  }
  return published;
}

export async function runIngest({ flags }) {
  const db = openDb();
  ensureSourceTable(db);
  const repo = createRepo(db);
  const check = preflight({ db, flags });
  if (!check.ok) return { ok: false, reason: check.reason };
  const receipt = {
    schema: INGEST_SCHEMA, marker: INGEST_MARKER, mode: flags.apply ? "apply" : "dry_run", status: "in_progress",
    user_id: flags.user, handle: check.user.handle, started_at: new Date().toISOString(),
    runtime_offline: true, outbound_fetch: true, allowlisted_hosts: ALLOWED_SOURCE_HOSTS,
    posts: [], stories: [], media: [], highlights: [], replies: [], published: [], skipped: [], metadata_stripped: 0,
  };
  const target = flags.limit > 0 ? flags.limit : 0;
  const ctx = { repo, db, flags, receipt, language: "ro", regionCode: "RO-B", storyIds: [], storyTarget: 0, attempted: new Set() };
  const wanted = (key) => !flags.only || flags.only === key;

  if (!flags.apply) {
    // Dry run: validate discovery, licence admission and hosts without writing anything.
    const probes = [];
    for (const [key, queries] of Object.entries(QUERIES)) {
      const kind = key === "clips" ? "video" : key === "texts" ? "text" : "image";
      for (const query of queries.slice(0, 2)) {
        const candidates = kind === "text" ? [] : await collectSources(kind, query);
        for (const source of candidates) {
          if (source.error) { probes.push({ query, error: source.error }); continue; }
          const licence = licenceDecision(source.licence);
          probes.push({
            query, provider: source.provider, licence: source.licence, licence_ok: licence.allowed,
            licence_reason: licence.reason, mime: source.mime, declared_bytes: source.declaredBytes,
            host: (() => { try { return new URL(source.assetUrl).host; } catch { return "invalid"; } })(),
          });
        }
      }
    }
    return { ok: true, mode: "dry_run", user: check.user.handle, probes: probes.slice(0, 40), probe_count: probes.length };
  }

  if ((wanted("photos") || wanted("clips")) && !flags.noStories) ctx.storyTarget = Math.max(4, Math.min(8, target || 8));
  if (wanted("photos")) await ingestCategory(ctx, { queries: QUERIES.photos, kind: "image", purpose: "social_post", target: target || 8 });
  if (wanted("clips")) await ingestCategory(ctx, { queries: QUERIES.clips, kind: "video", purpose: "social_post", target: Math.max(2, Math.min(4, target || 4)) });

  if (wanted("texts")) {
    let textCount = 0;
    for (const title of QUERIES.texts) {
      if (textCount >= (target || 6)) break;
      let source = null;
      try {
        source = await wikipediaExtract({ title, lang: "ro" });
      } catch (error) {
        receipt.skipped.push({ stage: "wikipedia", reason: String(error.message).slice(0, 80), query: title });
        continue;
      }
      if (!source) { receipt.skipped.push({ stage: "wikipedia", reason: "empty_extract", query: title }); continue; }
      const result = await publishTextPost({ repo, db, userId: flags.user, source, lang: "ro", thread: textCount === 0 ? 2 : 0 });
      if (!result.ok) { receipt.skipped.push({ stage: "text", reason: result.reason, query: title }); continue; }
      textCount += 1;
      receipt.posts.push(result.post.id);
      receipt.replies.push(...result.replies);
      receipt.published.push({
        kind: "text", post_id: result.post.id, provider: "wikipedia", licence: source.licence,
        source_url: source.sourceUrl, caption: result.caption, thread_replies: result.replies.length,
      });
      flushReceipt(receipt);
    }
  }

  // Highlights group the stories created by this run; a bounded follow-up run (texts
  // only) still groups the account's existing stories instead of doing nothing.
  const storyPool = ctx.storyIds.length
    ? ctx.storyIds
    : db.prepare("SELECT id FROM stories WHERE user_id = ? ORDER BY id DESC LIMIT 12").all(flags.user).map((row) => row.id);
  if (storyPool.length && !flags.noStories) {
    for (const [title, index] of [["Oraș", 0], ["Natură", 2], ["Atelier", 4]]) {
      const ids = storyPool.slice(index, index + 2);
      if (ids.length < 2) continue;
      const attached = attachHighlights(repo, { userId: flags.user, title, storyIds: ids });
      if (attached.ok) receipt.highlights.push({ id: attached.highlight.id, title, story_ids: attached.linked });
      else receipt.skipped.push({ stage: "highlight", reason: attached.reason, query: title });
    }
  }

  receipt.finished_at = new Date().toISOString();
  receipt.status = "complete";
  receipt.counts = {
    posts: receipt.posts.length, stories: receipt.stories.length, media: receipt.media.length,
    highlights: receipt.highlights.length, replies: receipt.replies.length, skipped: receipt.skipped.length,
  };
  receipt.receipt_file = flushReceipt(receipt);
  return { ok: true, ...receipt.counts, user: check.user.handle, receipt_file: receipt.receipt_file, skipped: receipt.skipped.slice(0, 12) };
}

export function planSummary() {
  return {
    schema: INGEST_SCHEMA,
    marker: INGEST_MARKER,
    runtime_offline: true,
    outbound_fetch: true,
    allowlisted_hosts: ALLOWED_SOURCE_HOSTS,
    allowlisted_origin_hosts: ALLOWED_ORIGIN_HOSTS,
    allowed_licences: ALLOWED_LICENCES,
    max_media_bytes: MAX_MEDIA_BYTES,
    max_media_bytes_source: MAX_BYTES_OVERRIDE > 0 ? "NEXUS_INGEST_MAX_BYTES" : "default",
    video_derivatives: "lightest Commons transcode that fits the cap, sized with a ranged GET",
    max_video_seconds: MAX_VIDEO_SECONDS,
    categories: Object.fromEntries(Object.entries(QUERIES).map(([key, value]) => [key, value.length])),
    queries: QUERIES,
    metadata_stripping: {
      "image/jpeg": "APP1/APP13/COM segments removed",
      "image/png": "tEXt/zTXt/iTXt/eXIf chunks removed",
      "image/webp": "EXIF/XMP chunks removed",
      "video/webm": "container metadata retained (declared limitation)",
      "video/mp4": "container metadata retained (declared limitation)",
    },
  };
}

const invokedDirectly = process.argv[1] ? process.argv[1].replace(/\\/g, "/").endsWith("scripts/content-ingest.mjs") : false;
if (invokedDirectly) {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.plan) {
    console.log(JSON.stringify(planSummary(), null, 2));
    process.exit(0);
  }
  const result = await runIngest({ flags }).catch((error) => ({
    ok: false, reason: String(error?.message || error), stage: error?.stage ?? "unexpected",
  }));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}


export async function ingestAsset({ repo, db, userId, source, kind, purpose, language, regionCode }) {
  const licence = licenceDecision(source.licence);
  if (!licence.allowed) return { ok: false, stage: "licence", reason: licence.reason, source };
  if (!ALLOWED_MIME.includes(source.mime)) return { ok: false, stage: "mime", reason: `mime_not_supported:${source.mime}`, source };
  if (kind === "video" && source.selfPromotional) return { ok: false, stage: "relevance", reason: "wikimedia_self_documentation", source };
  if (kind === "video" && source.duration && source.duration > MAX_VIDEO_SECONDS) return { ok: false, stage: "duration", reason: "clip_too_long", source };
  if (alreadyIngested(db, source.sourceUrl)) return { ok: false, stage: "dedupe", reason: "already_ingested", source };
  // The batched derivative lookup can be throttled: an oversized clip gets one last
  // single-title chance before the cap rejects it.
  if (kind === "video" && !source.derivatives?.length && source.fileTitle && source.declaredBytes > MAX_MEDIA_BYTES) {
    const retry = await commonsVideoDerivatives([source.fileTitle]).catch(() => new Map());
    const info = retry.get(source.fileTitle);
    if (info?.derivatives?.length) source = { ...source, derivatives: info.derivatives, duration: source.duration || info.duration };
  }
  source = kind === "video" ? await resolveVideoAsset(source) : source;
  if (source.declaredBytes && source.declaredBytes > MAX_MEDIA_BYTES) return { ok: false, stage: "size", reason: "declared_too_large", source };
  let buffer;
  try {
    buffer = await fetchBinary(source.assetUrl);
  } catch (error) {
    return { ok: false, stage: "download", reason: String(error.message).slice(0, 80), source };
  }
  const admitted = admitMedia(repo, { buffer, mime: source.mime, userId, purpose });
  if (!admitted.ok) return { ok: false, stage: "media", reason: admitted.reason, source };
  recordSource(db, {
    mediaId: admitted.media.id, hash: admitted.media.hash, provider: source.provider, sourceUrl: source.sourceUrl,
    author: source.author, licence: source.licence, licenceUrl: source.licenceUrl,
    metadataStripped: admitted.metadataStripped, marker: INGEST_MARKER,
  });
  const caption = [trimCaption(source.description || source.title, 240), creditLine(source)].filter(Boolean).join(" ");
  const gate = captionGate(caption, kind);
  if (!gate.ok) return { ok: false, stage: "caption", reason: gate.reason, source, media: admitted.media };
  const post = repo.createPost({
    userId, persona: "social", kind, caption, mediaId: admitted.media.id,
    visibility: "public", language, regionCode, provenance: "NOT_DECLARED",
  });
  return {
    ok: true, post, media: admitted.media, source, caption,
    metadataStripped: admitted.metadataStripped, bytes: admitted.bytes,
    assessment: gate.assessment.decision,
  };
}

