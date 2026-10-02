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
const LEGACY_DECORATION_KEYS = ["id", "type", "text", "x", "y", "scale", "rotation", "startMs", "endMs"];
const DECORATION_KEYS = ["id", "type", "assetId", "text", "x", "y", "scale", "rotation", "zIndex", "opacity", "style", "align", "color", "background", "animation", "startMs", "endMs", "timezone", "locationPrecision", "dynamic"];
const DECORATION_TYPES = new Set(["STICKER", "GIF", "LOCATION", "TIME", "DATE", "TEXT", "HASHTAG", "MENTION", "POLL", "DONATION", "WEATHER"]);
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
  const hasTransform = Object.prototype.hasOwnProperty.call(input, 'transform');
  if (!exactKeys(input, [...MANIFEST_KEYS,...(hasDecorations?['decorations']:[]),...(hasTransform?['transform']:[])]) || input.version !== CREATOR_STUDIO_VERSION) throw new Error("CREATOR_STUDIO_MANIFEST_INVALID");
  let transform;
  if(hasTransform){transform=input.transform;if(!exactKeys(transform,['rotation','zoom','x','y','ratio','originalVolume','musicVolume'])||![0,90,180,270].includes(transform.rotation)||Object.values(transform).some(value=>typeof value!=='number'||!Number.isFinite(value))||transform.zoom<1||transform.zoom>3||transform.x<0||transform.x>100||transform.y<0||transform.y>100||transform.ratio<0||transform.ratio>3||transform.originalVolume<0||transform.originalVolume>1||transform.musicVolume<0||transform.musicVolume>1)throw new Error('CREATOR_TRANSFORM_INVALID');}
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
      const legacy = exactKeys(item, LEGACY_DECORATION_KEYS); const full = exactKeys(item, DECORATION_KEYS);
      if ((!legacy && !full) || !/^[a-z0-9-]{8,80}$/i.test(String(item.id || "")) || !DECORATION_TYPES.has(item.type)
        || typeof item.text !== "string" || item.text.length > 120 || (!item.text.trim() && !new Set(["STICKER", "GIF", "TIME", "DATE"]).has(item.type))
        || !boundedInteger(item.x, 0, 100) || !boundedInteger(item.y, 0, 100) || typeof item.scale !== "number" || item.scale < .4 || item.scale > 3
        || !boundedInteger(item.rotation, 0, 359) || !boundedInteger(item.startMs, 0, CREATOR_VIDEO_MAX_MS) || !boundedInteger(item.endMs, 0, CREATOR_VIDEO_MAX_MS) || item.endMs < item.startMs) throw new Error("CREATOR_STUDIO_DECORATIONS_INVALID");
      const expanded = legacy ? { assetId: "", zIndex: 1, opacity: 1, style: "classic", align: "center", color: "#ffffff", background: "transparent", animation: "none", timezone: "UTC", locationPrecision: "area", dynamic: false, ...item } : item;
      if (!/^(?:|[a-z]+-\d+)$/.test(expanded.assetId) || !boundedInteger(expanded.zIndex, 0, 20) || typeof expanded.opacity !== "number" || expanded.opacity < .2 || expanded.opacity > 1
        || !/^[a-z0-9-]{1,24}$/i.test(expanded.style) || !new Set(["left", "center", "right"]).has(expanded.align) || !/^#[0-9a-f]{6}$/i.test(expanded.color) || !/^(?:transparent|#[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i.test(expanded.background)
        || !new Set(["none", "pulse"]).has(expanded.animation) || typeof expanded.timezone !== "string" || expanded.timezone.length > 64
        || !new Set(["exact", "area", "city"]).has(expanded.locationPrecision) || typeof expanded.dynamic !== "boolean") throw new Error("CREATOR_STUDIO_DECORATIONS_INVALID");
      return Object.freeze({ ...expanded, text: expanded.text.normalize("NFKC").replace(/\s+/g, " ").trim() });
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
    ...(hasTransform ? { transform: Object.freeze({...transform}) } : {}),
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
