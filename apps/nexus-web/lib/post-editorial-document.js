/**
 * The server's mirror of `apps/nexus-mobile/src/lib/editorialDocument.ts`.
 *
 * A phone may place media and paragraph breaks on a page, so those facts have to survive `/api/posts`.
 * This module validates the same document the composer sends: the same block types, the same media
 * placements, the same stable ids and the same 20 000-character ceiling. A malformed page is refused
 * before a row is written, never stored as a half-readable article.
 */

export const EDITORIAL_DOCUMENT_VERSION = 1;
export const MAX_EDITORIAL_BLOCKS = 400;
export const TEXT_MAX_CHARS = 20000;
export const MAX_EDITORIAL_MEDIA = 5;
export const MIN_MEDIA_WIDTH_FRACTION = 0.28;
export const MAX_MEDIA_WIDTH_FRACTION = 1;
export const EDITORIAL_PLACEMENTS = Object.freeze(['left', 'right', 'center', 'full']);
export const EDITORIAL_MEDIA_TYPES = Object.freeze(['image', 'video']);
export const EDITORIAL_TYPOGRAPHIES = Object.freeze(['auto', 'small', 'medium', 'large']);

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const invalid = () => { throw new Error('EDITORIAL_DOCUMENT_INVALID'); };

function textOf(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
}

function roundFraction(value) {
  return Math.round(Math.min(MAX_MEDIA_WIDTH_FRACTION, Math.max(MIN_MEDIA_WIDTH_FRACTION, value)) * 1000) / 1000;
}

function blockText(block) {
  if (block.type === 'paragraph' || block.type === 'heading') return block.text;
  return '';
}

function normalizeRuns(value, text) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length) invalid();
  const runs = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
    if (Object.keys(entry).some((key) => !['text', 'bold', 'italic'].includes(key))) invalid();
    const runText = textOf(entry.text);
    if (!runText) invalid();
    if (entry.bold !== undefined && entry.bold !== true) invalid();
    if (entry.italic !== undefined && entry.italic !== true) invalid();
    return {
      text: runText,
      ...(entry.bold === true ? { bold: true } : {}),
      ...(entry.italic === true ? { italic: true } : {}),
    };
  });
  if (runs.map((run) => run.text).join('') !== text) invalid();
  return runs;
}

function normalizeBlock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (typeof value.id !== 'string' || !ID.test(value.id)) invalid();
  if (value.type === 'pagebreak') {
    if (Object.keys(value).some((key) => !['id', 'type'].includes(key))) invalid();
    return { id: value.id, type: 'pagebreak' };
  }
  if (value.type === 'paragraph' || value.type === 'heading') {
    if (Object.keys(value).some((key) => !['id', 'type', 'text', 'runs'].includes(key))) invalid();
    const text = textOf(value.text);
    if (!text.trim()) invalid();
    const runs = normalizeRuns(value.runs, text);
    return { id: value.id, type: value.type, text, ...(runs ? { runs } : {}) };
  }
  if (value.type === 'media') {
    if (Object.keys(value).some((key) => !['id', 'type', 'mediaIndex', 'mediaType', 'placement', 'widthFraction', 'wrapText'].includes(key))) invalid();
    const mediaIndex = Number(value.mediaIndex);
    const widthFraction = Number(value.widthFraction);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0 || mediaIndex >= MAX_EDITORIAL_MEDIA) invalid();
    if (!EDITORIAL_MEDIA_TYPES.includes(value.mediaType)
      || !EDITORIAL_PLACEMENTS.includes(value.placement)
      || typeof value.wrapText !== 'boolean'
      || !Number.isFinite(widthFraction)
      || widthFraction < MIN_MEDIA_WIDTH_FRACTION
      || widthFraction > MAX_MEDIA_WIDTH_FRACTION) invalid();
    return {
      id: value.id,
      type: 'media',
      mediaIndex,
      mediaType: value.mediaType,
      placement: value.placement,
      widthFraction: roundFraction(widthFraction),
      wrapText: value.wrapText,
    };
  }
  return invalid();
}

export function normalizeEditorialDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (Object.keys(value).some((key) => !['version', 'blocks', 'typography'].includes(key))) invalid();
  if (value.version !== EDITORIAL_DOCUMENT_VERSION || !Array.isArray(value.blocks)) invalid();
  if (value.blocks.length > MAX_EDITORIAL_BLOCKS) invalid();
  const blocks = value.blocks.map(normalizeBlock);
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) invalid();
  const characters = blocks.reduce((total, block) => total + Array.from(blockText(block)).length, 0);
  if (characters > TEXT_MAX_CHARS) invalid();
  const typography = value.typography === undefined ? 'auto' : value.typography;
  if (!EDITORIAL_TYPOGRAPHIES.includes(typography)) invalid();
  return { version: EDITORIAL_DOCUMENT_VERSION, blocks, typography };
}
