import { createHash } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "./db.js";
import { resolveMediaStorageProvider } from "./storage-provider.js";

export const MEDIA_DIR = join(DATA_DIR, "media");
export const MEDIA_QUARANTINE_DIR = join(DATA_DIR, "media-quarantine");
export const MEDIA_STORAGE = resolveMediaStorageProvider({ mediaRoot: MEDIA_DIR, quarantineRoot: MEDIA_QUARANTINE_DIR });
export const NEXUS_E2EE_ATTACHMENT_MIME = "application/vnd.nexus.e2ee";
export const NEXUS_E2EE_ATTACHMENT_MAGIC = Buffer.from("NEXUS-E2EE-ATTACHMENT-V1\0", "utf8");

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per upload
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm"]);
const AUDIO_MIME = new Set(["audio/mpeg", "audio/wav", "audio/ogg"]);
const FILE_EXTENSIONS = new Map([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
]);

const MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["video/mp4", "mp4"], ["video/webm", "webm"], ...FILE_EXTENSIONS,
  ["audio/mpeg", "mp3"], ["audio/wav", "wav"], ["audio/ogg", "ogg"],
  [NEXUS_E2EE_ATTACHMENT_MIME, "nxenc"],
]);

// A phone gallery can call a jpeg "image/jpg" or "image/pjpeg": the same container under a name that only
// some devices use. Canonicalising it here keeps the stored record honest (one name, one extension) and
// stops a photograph from being quarantined for a label the server itself should have understood.
const MIME_ALIASES = new Map([
  ["image/jpg", "image/jpeg"], ["image/jpe", "image/jpeg"], ["image/pjpeg", "image/jpeg"], ["image/x-jpeg", "image/jpeg"],
  ["image/x-png", "image/png"], ["image/x-webp", "image/webp"],
]);

export function canonicalMime(value) {
  const mime = String(value ?? "").toLowerCase().trim();
  return MIME_ALIASES.get(mime) || mime;
}

const MIME_KINDS = new Map([
  ["image/jpeg", "image"], ["image/png", "image"], ["image/webp", "image"],
  ["video/mp4", "video"], ["video/webm", "video"],
  ["audio/mpeg", "audio"], ["audio/wav", "audio"], ["audio/ogg", "audio"],
]);

function startsWithHex(buf, hex) {
  const signature = Buffer.from(hex, "hex");
  return buf.length >= signature.length && buf.subarray(0, signature.length).equals(signature);
}

export function inspectMedia(buf, declaredMime) {
  const mime = canonicalMime(declaredMime);
  let detectedMime = null;
  if (startsWithHex(buf, "ffd8ff")) detectedMime = "image/jpeg";
  else if (startsWithHex(buf, "89504e470d0a1a0a")) detectedMime = "image/png";
  else if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") detectedMime = "image/webp";
  else if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") detectedMime = "video/mp4";
  else if (startsWithHex(buf, "1a45dfa3")) detectedMime = "video/webm";
  else if (startsWithHex(buf, "494433") || startsWithHex(buf, "fffb") || startsWithHex(buf, "fff3") || startsWithHex(buf, "fff2")) detectedMime = "audio/mpeg";
  else if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") detectedMime = "audio/wav";
  else if (buf.subarray(0, 4).toString("ascii") === "OggS") detectedMime = "audio/ogg";
  else if (buf.subarray(0, 5).toString("ascii") === "%PDF-") detectedMime = "application/pdf";
  else if (startsWithHex(buf, "504b0304") && FILE_EXTENSIONS.has(mime)) detectedMime = mime;

  if (!detectedMime || detectedMime !== mime) {
    return { status: "quarantined", detectedMime, reason: "declared_type_does_not_match_file_signature" };
  }
  if (FILE_EXTENSIONS.has(mime)) {
    const ascii = mime === "application/pdf" ? buf.toString("latin1").toLowerCase() : "";
    const activePdf = ascii.includes("/javascript") || ascii.includes("/launch") || ascii.includes("/embeddedfile") || ascii.includes("/openaction");
    return {
      status: "quarantined",
      detectedMime,
      reason: activePdf ? "active_document_content_detected" : "document_requires_malware_scanner",
    };
  }
  return { status: "ready_local_validation", detectedMime, reason: "magic_signature_matched" };
}

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// Persist media content-addressed on local disk; returns metadata record.
export function storeMedia(buf, mime) {
  mime = canonicalMime(mime);
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new Error("empty media");
  }
  if (buf.length > MAX_BYTES) {
    throw new Error("media too large (max 20MB)");
  }
  const kind = IMAGE_MIME.has(mime) ? "image" : VIDEO_MIME.has(mime) ? "video" : AUDIO_MIME.has(mime) ? "audio" : FILE_EXTENSIONS.has(mime) ? "file" : null;
  if (!kind) {
    throw new Error("unsupported media type");
  }
  const hash = sha256Hex(buf);
  const ext = MIME_EXTENSIONS.get(mime);
  const inspection = inspectMedia(buf, mime);
  const provider = inspection.status === "ready_local_validation" ? MEDIA_STORAGE.serving : MEDIA_STORAGE.quarantine;
  const objectKey = `${hash}.${ext}`;
  const filePath = provider.putIfAbsent(objectKey, buf).path;
  return { hash, ext, mime, kind, size: buf.length, filePath, scanStatus: inspection.status, scanReason: inspection.reason, detectedMime: inspection.detectedMime };
}

// Client-side encrypted message attachments deliberately bypass signature and
// malware inspection because the server has no content key. Admission validates
// only a versioned opaque-container marker, size and content hash. The UI must
// never describe this state as malware-scanned or safe-to-open.
export function storeClientEncryptedMedia(buf, mime = NEXUS_E2EE_ATTACHMENT_MIME) {
  mime = String(mime ?? "").toLowerCase();
  if (mime !== NEXUS_E2EE_ATTACHMENT_MIME) throw new Error("encrypted attachment MIME invalid");
  if (!Buffer.isBuffer(buf) || buf.length < NEXUS_E2EE_ATTACHMENT_MAGIC.length + 16) throw new Error("encrypted attachment container invalid");
  if (buf.length > MAX_BYTES) throw new Error("media too large (max 20MB)");
  if (!buf.subarray(0, NEXUS_E2EE_ATTACHMENT_MAGIC.length).equals(NEXUS_E2EE_ATTACHMENT_MAGIC)) throw new Error("encrypted attachment marker invalid");
  const hash = sha256Hex(buf);
  const ext = MIME_EXTENSIONS.get(mime);
  const objectKey = `${hash}.${ext}`;
  const filePath = MEDIA_STORAGE.serving.putIfAbsent(objectKey, buf).path;
  return {
    hash, ext, mime, kind: "encrypted", size: buf.length, filePath,
    scanStatus: "ready_client_encrypted",
    scanReason: "ciphertext_not_server_scannable",
    detectedMime: null,
  };
}

// A caption track is an optional sidecar next to the content-addressed media object
// (`<hash>.vtt`). It is read with the same name discipline as the media itself, but it is not the
// media: a missing or malformed track is reported as missing, never invented.
export function captionTrackAvailability(hash) {
  const safeHash = String(hash ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(safeHash)) return false;
  const buf = MEDIA_STORAGE.serving.read(`${safeHash}.vtt`);
  return Boolean(buf && buf.length > 8 && buf.toString("utf8", 0, 6) === "WEBVTT");
}

export function readCaptionTrack(hash) {
  const safeHash = String(hash ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(safeHash)) return null;
  const buf = MEDIA_STORAGE.serving.read(`${safeHash}.vtt`);
  if (!buf || buf.length < 8 || buf.length > 512 * 1024) return null;
  const text = buf.toString("utf8");
  if (!text.startsWith("WEBVTT")) return null;
  return text;
}

// Integrity-checked read; returns null if bytes no longer match their hash.
export function readMedia(hash, ext) {
  const buf = MEDIA_STORAGE.serving.read(`${hash}.${ext}`);
  if (!buf || sha256Hex(buf) !== hash) return null;
  return buf;
}

export function inspectStoredMedia(hash, ext, mime) {
  const buf = MEDIA_STORAGE.serving.read(`${hash}.${ext}`);
  if (!buf) return { status: "quarantined", detectedMime: null, reason: "stored_media_missing" };
  if (sha256Hex(buf) !== hash) return { status: "quarantined", detectedMime: null, reason: "content_address_integrity_failed" };
  return inspectMedia(buf, mime);
}

export function mediaDeliveryPolicy(media) {
  if (!media || !/^[a-f0-9]{64}$/.test(String(media.hash || ""))) return null;
  const mime = String(media.mime || "").toLowerCase();
  const ext = String(media.ext || "").toLowerCase();
  if (media.scan_status === "ready_client_encrypted") {
    if (mime !== NEXUS_E2EE_ATTACHMENT_MIME || ext !== "nxenc" || media.kind !== "encrypted" || media.detected_mime != null) return null;
    return {
      contentType: "application/octet-stream",
      disposition: `attachment; filename="nexus-encrypted-${media.hash.slice(0, 12)}.nxenc"`,
    };
  }
  const kind = MIME_KINDS.get(mime);
  if (media.scan_status !== "ready_local_validation" || !kind || media.kind !== kind
    || media.detected_mime !== mime || MIME_EXTENSIONS.get(mime) !== ext) return null;
  return {
    contentType: mime,
    disposition: `inline; filename="nexus-${media.hash.slice(0, 12)}.${ext}"`,
  };
}

// Delete only an exact content-addressed Nexus media object. The strict name
// validation prevents a purge job from turning database data into an arbitrary
// filesystem path. Missing objects are treated as already purged so retries are
// safe and idempotent.
export function purgeStoredMedia(hash, ext) {
  const safeHash = String(hash ?? "").toLowerCase();
  const safeExt = String(ext ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(safeHash) || !new Set(MIME_EXTENSIONS.values()).has(safeExt)) {
    throw new Error("invalid content-addressed media reference");
  }
  let deleted = 0;
  const key = `${safeHash}.${safeExt}`;
  for (const provider of [MEDIA_STORAGE.serving, MEDIA_STORAGE.quarantine]) if (provider.remove(key)) deleted += 1;
  return { hash: safeHash, ext: safeExt, deleted, already_missing: deleted === 0 };
}
