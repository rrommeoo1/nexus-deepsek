import { sha256Hex } from "./security.js";

export const CREATOR_STUDIO_VERSION = 1;
export const CREATOR_ASPECTS = Object.freeze(["ORIGINAL", "VERTICAL_9_16", "SQUARE_1_1", "PORTRAIT_4_5", "LANDSCAPE_16_9"]);
export const CREATOR_FILTERS = Object.freeze(["NONE", "VIVID", "WARM", "COOL", "MONO", "HIGH_CONTRAST"]);
export const CREATOR_OVERLAY_POSITIONS = Object.freeze(["TOP", "CENTER", "BOTTOM"]);
export const CREATOR_OVERLAY_COLORS = Object.freeze(["WHITE", "BLACK", "TEAL", "YELLOW"]);
export const CREATOR_AUDIO_RIGHTS = Object.freeze(["ORIGINAL_OWNED", "LICENSED_WITH_PERMISSION"]);
export const CREATOR_VIDEO_MAX_MS = 600_000;

const MANIFEST_KEYS = ["version", "aspect", "filter", "intensity", "trimStartMs", "trimEndMs", "playbackRate", "muteOriginal", "overlay"];
const OVERLAY_KEYS = ["text", "position", "color"];
const DECORATION_KEYS = ["id", "type", "text", "x", "y", "scale", "rotation", "startMs", "endMs"];
const PLAYBACK_RATES = new Set([0.5, 1, 1.5, 2]);

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedInteger(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function normalizeCreatorStudio(input, { mediaKind } = {}) {
  if (mediaKind === "text" || mediaKind == null) {
    if (input == null) return null;
    throw new Error("CREATOR_STUDIO_MEDIA_REQUIRED");
  }
  if (!new Set(["image", "video"]).has(mediaKind)) throw new Error("CREATOR_STUDIO_MEDIA_KIND_INVALID");
  if (input == null) {
    input = {
      version: CREATOR_STUDIO_VERSION, aspect: "ORIGINAL", filter: "NONE", intensity: 0,
      trimStartMs: 0, trimEndMs: mediaKind === "video" ? CREATOR_VIDEO_MAX_MS : 0,
      playbackRate: 1, muteOriginal: false,
      overlay: { text: "", position: "BOTTOM", color: "WHITE" },
    };
  }
  const hasDecorations = Object.prototype.hasOwnProperty.call(input, "decorations");
  if (!exactKeys(input, hasDecorations ? [...MANIFEST_KEYS, "decorations"] : MANIFEST_KEYS) || input.version !== CREATOR_STUDIO_VERSION) throw new Error("CREATOR_STUDIO_MANIFEST_INVALID");
  if (!CREATOR_ASPECTS.includes(input.aspect) || !CREATOR_FILTERS.includes(input.filter)) throw new Error("CREATOR_STUDIO_MANIFEST_INVALID");
  if (!boundedInteger(input.intensity, 0, 100) || typeof input.muteOriginal !== "boolean" || !PLAYBACK_RATES.has(input.playbackRate)) {
    throw new Error("CREATOR_STUDIO_MANIFEST_INVALID");
  }
  if (!exactKeys(input.overlay, OVERLAY_KEYS) || typeof input.overlay.text !== "string" || input.overlay.text.length > 120
    || !CREATOR_OVERLAY_POSITIONS.includes(input.overlay.position) || !CREATOR_OVERLAY_COLORS.includes(input.overlay.color)) {
    throw new Error("CREATOR_STUDIO_OVERLAY_INVALID");
  }
  const overlayText = input.overlay.text.normalize("NFKC").replace(/\s+/g, " ").trim();
  let decorations;
  if (hasDecorations) {
    if (!Array.isArray(input.decorations) || input.decorations.length > 12) throw new Error("CREATOR_STUDIO_DECORATIONS_INVALID");
    decorations = input.decorations.map((item) => {
      if (!exactKeys(item, DECORATION_KEYS) || !/^[a-z0-9-]{8,80}$/i.test(String(item.id || ""))
        || !new Set(["STICKER", "LOCATION"]).has(item.type) || typeof item.text !== "string" || item.text.length < 1 || item.text.length > 120
        || !boundedInteger(item.x, 0, 100) || !boundedInteger(item.y, 0, 100)
        || typeof item.scale !== "number" || item.scale < .4 || item.scale > 3
        || !boundedInteger(item.rotation, 0, 359) || !boundedInteger(item.startMs, 0, CREATOR_VIDEO_MAX_MS)
        || !boundedInteger(item.endMs, 0, CREATOR_VIDEO_MAX_MS) || item.endMs < item.startMs) throw new Error("CREATOR_STUDIO_DECORATIONS_INVALID");
      return Object.freeze({ id: item.id, type: item.type, text: item.text.normalize("NFKC").replace(/\s+/g, " ").trim(), x: item.x, y: item.y, scale: item.scale, rotation: item.rotation, startMs: item.startMs, endMs: item.endMs });
    });
  }
  if (mediaKind === "image") {
    if (input.trimStartMs !== 0 || input.trimEndMs !== 0 || input.playbackRate !== 1 || input.muteOriginal) {
      throw new Error("CREATOR_STUDIO_IMAGE_TIMELINE_INVALID");
    }
  } else if (!boundedInteger(input.trimStartMs, 0, CREATOR_VIDEO_MAX_MS - 1)
    || !boundedInteger(input.trimEndMs, 1, CREATOR_VIDEO_MAX_MS)
    || input.trimStartMs >= input.trimEndMs) {
    throw new Error("CREATOR_STUDIO_VIDEO_TIMELINE_INVALID");
  }
  return Object.freeze({
    version: CREATOR_STUDIO_VERSION,
    aspect: input.aspect,
    filter: input.filter,
    intensity: input.intensity,
    trimStartMs: input.trimStartMs,
    trimEndMs: input.trimEndMs,
    playbackRate: input.playbackRate,
    muteOriginal: input.muteOriginal,
    overlay: Object.freeze({ text: overlayText, position: input.overlay.position, color: input.overlay.color }),
    ...(hasDecorations ? { decorations: Object.freeze(decorations) } : {}),
  });
}

export function normalizeCreatorAudio({ audioMediaId = null, rights = null, attribution = "" } = {}) {
  const hasAudio = Number.isSafeInteger(audioMediaId) && audioMediaId > 0;
  if (!hasAudio) {
    if (audioMediaId != null || rights != null || String(attribution ?? "").trim()) throw new Error("CREATOR_AUDIO_MEDIA_REQUIRED");
    return Object.freeze({ audioMediaId: null, rights: null, attribution: "" });
  }
  if (!CREATOR_AUDIO_RIGHTS.includes(rights)) throw new Error("CREATOR_AUDIO_RIGHTS_REQUIRED");
  if (typeof attribution !== "string" || attribution.length > 120) throw new Error("CREATOR_AUDIO_ATTRIBUTION_INVALID");
  return Object.freeze({ audioMediaId, rights, attribution: attribution.normalize("NFKC").replace(/\s+/g, " ").trim() });
}

export function creatorStudioHash(manifest) {
  return manifest ? sha256Hex(JSON.stringify(manifest)) : null;
}
