/**
 * The editorial document of a text-first post.
 *
 * A text post used to be one string plus one framed lead picture. That shape cannot describe what the
 * owner asked for: paragraphs around a picture, two pictures on one page, a heading, a page break, or
 * media that keeps its placement after publication. The document below is the smallest model that
 * carries those facts without changing the old word limit.
 *
 * It is deliberately pure - it imports only types - so the Node tests can load it with
 * `typescript.transpileModule` and assert the same rules the server applies
 * (`apps/nexus-web/lib/post-editorial-document.js` is its mirror).
 */

export const EDITORIAL_DOCUMENT_VERSION = 1 as const;
export const MAX_EDITORIAL_BLOCKS = 400;
export const TEXT_MAX_CHARS = 20000;
export const MAX_EDITORIAL_MEDIA = 5;
export const MIN_MEDIA_WIDTH_FRACTION = 0.28;
export const MAX_MEDIA_WIDTH_FRACTION = 1;

export type EditorialPlacement = 'left' | 'right' | 'center' | 'full';
export const EDITORIAL_PLACEMENTS: readonly EditorialPlacement[] = ['left', 'right', 'center', 'full'];

export type EditorialMediaType = 'image' | 'video';
export const EDITORIAL_MEDIA_TYPES: readonly EditorialMediaType[] = ['image', 'video'];

/**
 * The measure of a page, as the author chose it for *this* document.
 *
 * `auto` follows the preset of `editorialSizeFor` (a long article is set smaller); every other id is
 * an override that the page keeps. `xlarge` is the poster measure added in the text-integrity round
 * (owner: „la mărime vreau și o treaptă mai mare"): a title page, a manifesto, one thought on a page.
 * The same ids are used by `TextSizeId` of `lib/textStyle.ts`, because the measure of a page is one
 * decision written in one place — the document — and stored in `text_style.size` for an older row.
 */
export type EditorialTypography = 'auto' | 'small' | 'medium' | 'large' | 'xlarge';
export const EDITORIAL_TYPOGRAPHIES: readonly EditorialTypography[] = ['auto', 'small', 'medium', 'large', 'xlarge'];

/**
 * The three measures the composer's `Mărime` door walks, in order (round 47).
 *
 * The owner asked for the same cycle everywhere — „Mic, Mediu, Mare, apoi iar Mic" — and the composer's
 * page is the fourth surface that carries it, beside the text over a picture, the stickers and the emoji.
 * `auto` is not a fourth step: it is the page's default (the measure the flow engine picks for a long
 * article), so it counts as the first step — „Mic/default", exactly as the owner wrote it. `xlarge` is
 * kept in `EDITORIAL_TYPOGRAPHIES` because rows written with it must keep opening at the measure they
 * were written at; it is simply no longer offered.
 */
export const EDITORIAL_TYPOGRAPHY_CYCLE: readonly EditorialTypography[] = ['small', 'medium', 'large'];

/**
 * Where a stored measure stands in the cycle: `auto` and `small` are the first step, `xlarge` — the
 * poster measure of older rows — is the last, and anything unknown is the first (nothing moves until
 * somebody asks for a step).
 */
export function typographyCycleIndex(typography: EditorialTypography): number {
  const index = EDITORIAL_TYPOGRAPHY_CYCLE.indexOf(typography);
  if (index >= 0) return index;
  if (typography === 'auto') return 0;
  return typography === 'xlarge' ? EDITORIAL_TYPOGRAPHY_CYCLE.length - 1 : 0;
}

/** The next measure: small (or the default) → medium → large → small, for ever. */
export function nextEditorialTypography(typography: EditorialTypography): EditorialTypography {
  return EDITORIAL_TYPOGRAPHY_CYCLE[(typographyCycleIndex(typography) + 1) % EDITORIAL_TYPOGRAPHY_CYCLE.length];
}

export type EditorialRun = {
  text: string;
  bold?: true;
  italic?: true;
};

type EditorialBlockBase = { id: string };

export type EditorialTextBlock = EditorialBlockBase & {
  type: 'paragraph' | 'heading';
  text: string;
  /** Optional inline runs. When present, their text is the same words as `text`. */
  runs?: EditorialRun[];
};

export type EditorialMediaBlock = EditorialBlockBase & {
  type: 'media';
  /** Position in the post gallery (`media_items`), never a copied file id. */
  mediaIndex: number;
  mediaType: EditorialMediaType;
  placement: EditorialPlacement;
  /** Share of the page's content width, between `MIN_MEDIA_WIDTH_FRACTION` and 1. */
  widthFraction: number;
  /** A float: surrounding words continue beside it, then use the full width after it. */
  wrapText: boolean;
};

export type EditorialPageBreakBlock = EditorialBlockBase & {
  type: 'pagebreak';
};

export type EditorialBlock = EditorialTextBlock | EditorialMediaBlock | EditorialPageBreakBlock;

export type EditorialDocument = {
  version: typeof EDITORIAL_DOCUMENT_VERSION;
  blocks: EditorialBlock[];
  /** `auto` follows the media/length preset; a named value is the author's override. */
  typography?: EditorialTypography;
};

export class EditorialDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorialDocumentError';
  }
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
let idSequence = 0;

/** A stable, URL-safe block id. The random tail prevents a collision after a cold start. */
export function newEditorialBlockId(prefix = 'b'): string {
  idSequence = (idSequence + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyEditorialDocument(): EditorialDocument {
  return { version: EDITORIAL_DOCUMENT_VERSION, blocks: [], typography: 'auto' };
}

export function paragraphBlock(text: string, id = newEditorialBlockId('p')): EditorialTextBlock {
  return { id, type: 'paragraph', text };
}

export function headingBlock(text: string, id = newEditorialBlockId('h')): EditorialTextBlock {
  return { id, type: 'heading', text };
}

export function pageBreakBlock(id = newEditorialBlockId('br')): EditorialPageBreakBlock {
  return { id, type: 'pagebreak' };
}

export function mediaBlock(
  mediaIndex: number,
  options: Partial<Pick<EditorialMediaBlock, 'placement' | 'widthFraction' | 'wrapText' | 'mediaType'>> = {},
  id = newEditorialBlockId('m'),
): EditorialMediaBlock {
  return {
    id,
    type: 'media',
    mediaIndex: Math.max(0, Math.trunc(Number(mediaIndex) || 0)),
    mediaType: options.mediaType ?? 'image',
    placement: options.placement ?? 'left',
    widthFraction: options.widthFraction ?? 0.55,
    wrapText: options.wrapText ?? true,
  };
}

export function blockText(block: EditorialBlock): string {
  if (block.type === 'paragraph' || block.type === 'heading') {
    return block.runs?.length ? block.runs.map((run) => run.text).join('') : block.text;
  }
  return '';
}

export function documentTextBlocks(document: EditorialDocument): EditorialTextBlock[] {
  return document.blocks.filter((block): block is EditorialTextBlock => block.type !== 'media' && block.type !== 'pagebreak');
}

export function documentMediaBlocks(document: EditorialDocument): EditorialMediaBlock[] {
  return document.blocks.filter((block): block is EditorialMediaBlock => block.type === 'media');
}

export function documentMediaIndexes(document: EditorialDocument): number[] {
  return documentMediaBlocks(document).map((block) => block.mediaIndex);
}

export function documentHasMedia(document: EditorialDocument): boolean {
  return documentMediaBlocks(document).length > 0;
}

export function documentCharCount(document: EditorialDocument): number {
  return documentTextBlocks(document).reduce((total, block) => total + Array.from(blockText(block)).length, 0);
}

/** The words as one plain string, in document order. This is what `posts.caption` stores. */
export function documentPlainText(document: EditorialDocument): string {
  return documentTextBlocks(document)
    .map((block) => blockText(block).trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, TEXT_MAX_CHARS);
}

/**
 * The reading offset of the whole document: each word block starts after the previous one and the
 * `\n\n` separator the hidden editor uses. The flow engine maps a caret to a line through this map.
 */
export type EditorialTextMap = {
  text: string;
  blocks: { id: string; start: number; end: number }[];
};

export function editorialTextMap(document: EditorialDocument): EditorialTextMap {
  const blocks: EditorialTextMap['blocks'] = [];
  let text = '';
  for (const block of documentTextBlocks(document)) {
    if (text) text += '\n\n';
    const start = text.length;
    text += blockText(block);
    blocks.push({ id: block.id, start, end: text.length });
  }
  return { text, blocks };
}

/** A one-block preview for a tile, a quote panel or a list row. */
export function editorialPreview(document: EditorialDocument, max = 280): { text: string; hasMore: boolean } {
  const text = documentPlainText(document).replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (text.length <= max) return { text, hasMore: false };
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const kept = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?\u2013\u2014-]+$/, '');
  return { text: `${kept}\u2026`, hasMore: true };
}

/** A legacy page of words as a document: blank lines separate paragraphs, media leads the page. */
export function documentFromPlainText(
  text: string | null | undefined,
  media: { mediaType?: EditorialMediaType }[] = [],
): EditorialDocument {
  const blocks: EditorialBlock[] = [];
  media.slice(0, MAX_EDITORIAL_MEDIA).forEach((item, index) => {
    blocks.push(mediaBlock(index, {
      mediaType: item.mediaType ?? 'image',
      placement: index === 0 ? 'left' : 'right',
      widthFraction: 0.55,
      wrapText: true,
    }));
  });
  /**
   * The same paragraphs `paragraphsOf` gives the field, so a caption that becomes a page (a post written
   * before the editorial rounds, a server-side import) keeps the author's own line breaks: a `\n` inside a
   * paragraph is a line the author wrote, a blank line separates two paragraphs.
   */
  for (const value of paragraphsOf(String(text ?? ''))) {
    if (value) blocks.push(paragraphBlock(value));
  }
  return { ...emptyEditorialDocument(), blocks };
}

export function insertParagraph(
  document: EditorialDocument,
  afterId?: string | null,
  text = '',
): EditorialDocument {
  const block = paragraphBlock(text);
  return { ...document, blocks: insertAfter(document.blocks, afterId, block) };
}

function insertAfter(blocks: EditorialBlock[], afterId: string | null | undefined, block: EditorialBlock): EditorialBlock[] {
  if (!afterId) return [...blocks, block];
  const index = blocks.findIndex((entry) => entry.id === afterId);
  if (index < 0) return [...blocks, block];
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
}

function roundFraction(value: number): number {
  return Math.round(Math.min(MAX_MEDIA_WIDTH_FRACTION, Math.max(MIN_MEDIA_WIDTH_FRACTION, value)) * 1000) / 1000;
}

function normalizeRuns(value: unknown, text: string): EditorialRun[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  const runs: EditorialRun[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    const source = entry as Record<string, unknown>;
    if (Object.keys(source).some((key) => !['text', 'bold', 'italic'].includes(key))) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    const runText = textOf(source.text);
    if (!runText) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    if (source.bold !== undefined && source.bold !== true) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    if (source.italic !== undefined && source.italic !== true) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    const run: EditorialRun = { text: runText };
    if (source.bold === true) run.bold = true;
    if (source.italic === true) run.italic = true;
    runs.push(run);
  }
  if (runs.map((run) => run.text).join('') !== text) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  return runs;
}

function normalizeBlock(value: unknown): EditorialBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  const source = value as Record<string, unknown>;
  if (typeof source.id !== 'string' || !ID.test(source.id)) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  if (source.type === 'pagebreak') {
    if (Object.keys(source).some((key) => !['id', 'type'].includes(key))) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    return { id: source.id, type: 'pagebreak' };
  }
  if (source.type === 'paragraph' || source.type === 'heading') {
    if (Object.keys(source).some((key) => !['id', 'type', 'text', 'runs'].includes(key))) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    const text = textOf(source.text);
    if (!text.trim()) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    const runs = normalizeRuns(source.runs, text);
    const block: EditorialTextBlock = { id: source.id, type: source.type, text };
    if (runs) block.runs = runs;
    return block;
  }
  if (source.type === 'media') {
    if (Object.keys(source).some((key) => !['id', 'type', 'mediaIndex', 'mediaType', 'placement', 'widthFraction', 'wrapText'].includes(key))) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    const mediaIndex = Number(source.mediaIndex);
    const widthFraction = Number(source.widthFraction);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0 || mediaIndex >= MAX_EDITORIAL_MEDIA) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    if (!EDITORIAL_MEDIA_TYPES.includes(source.mediaType as EditorialMediaType)
      || !EDITORIAL_PLACEMENTS.includes(source.placement as EditorialPlacement)
      || typeof source.wrapText !== 'boolean'
      || !Number.isFinite(widthFraction)
      || widthFraction < MIN_MEDIA_WIDTH_FRACTION
      || widthFraction > MAX_MEDIA_WIDTH_FRACTION) {
      throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
    }
    return {
      id: source.id,
      type: 'media',
      mediaIndex,
      mediaType: source.mediaType as EditorialMediaType,
      placement: source.placement as EditorialPlacement,
      widthFraction: roundFraction(widthFraction),
      wrapText: source.wrapText,
    };
  }
  throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
}

export function normalizeEditorialDocument(value: unknown): EditorialDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !['version', 'blocks', 'typography'].includes(key))) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  if (source.version !== EDITORIAL_DOCUMENT_VERSION || !Array.isArray(source.blocks)) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  if (source.blocks.length > MAX_EDITORIAL_BLOCKS) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  const blocks = source.blocks.map(normalizeBlock);
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  const characters = blocks.reduce((total, block) => total + Array.from(blockText(block)).length, 0);
  if (characters > TEXT_MAX_CHARS) throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  const typography = source.typography === undefined ? 'auto' : source.typography;
  if (!EDITORIAL_TYPOGRAPHIES.includes(typography as EditorialTypography)) {
    throw new EditorialDocumentError('EDITORIAL_DOCUMENT_INVALID');
  }
  return { version: EDITORIAL_DOCUMENT_VERSION, blocks, typography: typography as EditorialTypography };
}

/** The forgiving reader: a missing or half-written document answers `null`, never a crashed page. */
export function readEditorialDocument(value: unknown): EditorialDocument | null {
  try {
    return normalizeEditorialDocument(value);
  } catch {
    return null;
  }
}

/**
 * The paragraphs of a run of words typed or pasted into a page.
 *
 * One blank line separates two paragraphs; a single newline inside a paragraph is a soft wrap and becomes a
 * space, because a page of words has no hard line breaks — the flow decides where a line ends. A paragraph
 * keeps one trailing space when the author stopped typing right after it: that space is where the caret
 * sits, so trimming it would pull the next word against the previous one on the next keystroke. The
 * publisher drops it (`documentPlainText` trims), the editor does not.
 *
 * Shared by `applyPlainText` (the whole page, retyped) and `setBlockText` (one paragraph, edited in the
 * field a long press opens), so the two can never disagree about what a paragraph is.
 */
function paragraphsOf(value: string): string[] {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((entry) => {
      /**
       * A single line break is part of the text, not furniture of the page.
       *
       * Until the text-integrity round this line turned every `\n` into a space, so a poem, a list or an
       * address pasted from a browser was silently rewritten into prose: the author pressed `Gata` and the
       * page kept words they had not written. A blank line is still what separates two paragraphs
       * (`split` above), and a line break inside one paragraph is kept verbatim — `editorialFlow` starts a
       * new line where it finds one, and `documentPlainText` gives the break back unchanged.
       */
      const text = entry.replace(/^[ \t\n]+/, '');
      if (!text.trim()) return '';
      /** One trailing space where the author stopped typing right after a word: that is where the caret sits. */
      const spaced = /[ \t]$/.test(text);
      const body = text.replace(/[ \t\n]+$/, '');
      return spaced ? `${body} ` : body;
    })
    .filter(Boolean)
    .slice(0, MAX_EDITORIAL_BLOCKS);
}

/**
 * Replace the words of the document while keeping media and page breaks where they are.
 */
export function applyPlainText(document: EditorialDocument, value: string): EditorialDocument {
  const paragraphs = paragraphsOf(value);
  let index = 0;
  const blocks: EditorialBlock[] = [];
  for (const block of document.blocks) {
    if (block.type === 'media' || block.type === 'pagebreak') {
      blocks.push(block);
      continue;
    }
    const next = paragraphs[index++];
    if (next) blocks.push({ ...block, text: next, runs: undefined });
  }
  while (index < paragraphs.length) {
    blocks.push(paragraphBlock(paragraphs[index++]));
  }
  /**
   * The same page is returned as the same object. A caller that writes a document back on every
   * keystroke compares by identity (`applyDocument`), and a fresh object on identical words re-flows the
   * whole article for nothing.
   */
  return JSON.stringify(blocks) === JSON.stringify(document.blocks) ? document : { ...document, blocks };
}

/**
 * Replace the words of **one** paragraph — the field a long press on the page opens
 * (`EditorialPage`'s editing sheet), and the path a text pasted from a browser arrives through.
 *
 * The field holds a paragraph and a paragraph is what it writes back, so media, headings and page breaks
 * around it stay exactly where the author arranged them. A pasted passage carries its own blank lines: it
 * becomes that many paragraphs, the first of them keeping the block's own id and kind (a heading that was
 * pasted into stays a heading, and its own following paragraphs are plain ones). Empty words remove the
 * block instead of storing a paragraph with no text, because a document with a blank paragraph is one the
 * server refuses.
 *
 * `id === null` is the sheet opened on an empty page: there is no block to replace yet, so the words become
 * new paragraphs at the foot of the article.
 */
export function setBlockText(document: EditorialDocument, id: string | null, value: string): EditorialDocument {
  const paragraphs = paragraphsOf(value);
  const index = id === null
    ? -1
    : document.blocks.findIndex((block) => block.id === id && (block.type === 'paragraph' || block.type === 'heading'));
  if (id !== null && index < 0) return document;
  const anchor = index >= 0 ? document.blocks[index] : null;
  const blocks: EditorialBlock[] = [...document.blocks];
  const replacement: EditorialBlock[] = paragraphs.map((text, offset) => (
    /** The first paragraph keeps the block's own id and kind: the page re-flows in place, it does not jump. */
    offset === 0 && anchor
      ? { ...anchor, text, runs: undefined }
      : paragraphBlock(text)
  ));
  if (index >= 0) blocks.splice(index, 1, ...replacement);
  else blocks.push(...replacement);
  const trimmed = blocks.slice(0, MAX_EDITORIAL_BLOCKS);
  return JSON.stringify(trimmed) === JSON.stringify(document.blocks) ? document : { ...document, blocks: trimmed };
}

function mapBlock(document: EditorialDocument, id: string, map: (block: EditorialMediaBlock) => EditorialMediaBlock): EditorialDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => (block.id === id && block.type === 'media' ? map(block) : block)),
  };
}

export function setMediaPlacement(document: EditorialDocument, id: string, placement: EditorialPlacement): EditorialDocument {
  return mapBlock(document, id, (block) => ({
    ...block,
    placement,
    wrapText: placement === 'center' || placement === 'full' ? false : block.wrapText,
    widthFraction: placement === 'full' ? 1 : block.widthFraction,
  }));
}

export function setMediaWidth(document: EditorialDocument, id: string, widthFraction: number): EditorialDocument {
  const fraction = roundFraction(Number(widthFraction));
  return mapBlock(document, id, (block) => ({
    ...block,
    widthFraction: fraction,
    placement: fraction >= 0.995 ? 'full' : block.placement === 'full' ? 'center' : block.placement,
  }));
}

export function setMediaWrap(document: EditorialDocument, id: string, wrapText: boolean): EditorialDocument {
  return mapBlock(document, id, (block) => ({
    ...block,
    wrapText,
    placement: wrapText && (block.placement === 'center' || block.placement === 'full') ? 'left' : block.placement,
  }));
}

export function setDocumentTypography(document: EditorialDocument, typography: EditorialTypography): EditorialDocument {
  return { ...document, typography };
}

/** Move one block one step earlier (`-1`) or later (`1`). Media order on the page changes, files do not. */
export function moveEditorialBlock(document: EditorialDocument, id: string, direction: -1 | 1): EditorialDocument {
  const index = document.blocks.findIndex((block) => block.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= document.blocks.length) return document;
  const blocks = [...document.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { ...document, blocks };
}

export function removeEditorialBlock(document: EditorialDocument, id: string): EditorialDocument {
  return { ...document, blocks: document.blocks.filter((block) => block.id !== id) };
}

/**
 * Where inside the words a picture belongs: a text block and a character offset in its own text.
 *
 * The owner's sentence is "put the photo where I want in the text, at the beginning, in the middle,
 * at the end". Block order alone cannot express that, because a page is usually **one** paragraph:
 * swapping that paragraph with the picture block would throw the picture past every word at once.
 * An anchor names the exact word the reader dropped the picture on, and `placeMediaBlockAt` splits
 * the paragraph there so the same words keep flowing around the picture.
 */
export type EditorialTextAnchor = { blockId: string; offset: number };

/**
 * The character a paragraph may be cut at to leave whole words on both sides.
 *
 * A drop inside a word moves to the nearer word boundary; a paragraph made of one enormous word (a
 * pasted address) is cut where the author dropped it, because the alternative is a picture that
 * refuses to move.
 */
function splitPoint(text: string, offset: number): number {
  const length = text.length;
  const target = Math.min(length, Math.max(0, Math.trunc(Number(offset) || 0)));
  if (target <= 0 || target >= length) return target;
  const isSpace = (index: number) => /\s/.test(text[index] ?? ' ');
  if (isSpace(target - 1) || isSpace(target)) return target;
  let back = target;
  while (back > 0 && !isSpace(back - 1)) back -= 1;
  let forward = target;
  while (forward < length && !isSpace(forward)) forward += 1;
  if (back === 0 && forward >= length) return target;
  if (forward >= length) return back;
  if (back === 0) return forward;
  return target - back <= forward - target ? back : forward;
}

function withoutMedia(document: EditorialDocument, moving: EditorialMediaBlock): EditorialBlock[] {
  return document.blocks.filter((block) => block !== moving);
}

function mediaBlockOf(document: EditorialDocument, id: string): EditorialMediaBlock | null {
  const block = document.blocks.find((entry) => entry.id === id);
  return block && block.type === 'media' ? block : null;
}

/**
 * Put a media block immediately before the anchored words.
 *
 * The anchored paragraph is cut at the nearest word boundary and the picture is inserted between the
 * two halves, so the flow engine wraps the words that follow it and the article keeps every word in
 * the order it was written. The tail becomes its own paragraph, which is what the plain text
 * (`documentPlainText`) then prints; typing again (`applyPlainText`) reads those paragraphs back onto
 * the same blocks, so the picture stays where it was put.
 *
 * Inline runs are dropped from the block that is cut: a run list describes the words of one block, and
 * a split would leave it claiming text it no longer has. The composer never writes runs, so this only
 * affects a page that arrived with them.
 */
export function placeMediaBlockAt(
  document: EditorialDocument,
  id: string,
  anchor: EditorialTextAnchor | null | undefined,
): EditorialDocument {
  const moving = mediaBlockOf(document, id);
  if (!moving) return document;
  const blocks = withoutMedia(document, moving);
  if (!anchor) return { ...document, blocks: [...blocks, moving] };
  const index = blocks.findIndex((block) => (
    block.id === anchor.blockId && (block.type === 'paragraph' || block.type === 'heading')
  ));
  if (index < 0) return document;
  const target = blocks[index] as EditorialTextBlock;
  const text = blockText(target);
  const cut = splitPoint(text, anchor.offset);
  const head = text.slice(0, cut).replace(/\s+$/, '');
  const tail = text.slice(cut).replace(/^\s+/, '');
  if (!head) return { ...document, blocks: [...blocks.slice(0, index), moving, ...blocks.slice(index)] };
  if (!tail) return { ...document, blocks: [...blocks.slice(0, index + 1), moving, ...blocks.slice(index + 1)] };
  if (blocks.length + 1 > MAX_EDITORIAL_BLOCKS) return document;
  const first: EditorialTextBlock = { id: target.id, type: target.type, text: head };
  return {
    ...document,
    blocks: [...blocks.slice(0, index), first, moving, paragraphBlock(tail), ...blocks.slice(index + 1)],
  };
}

/** The picture leads the page, above the first word. */
export function placeMediaBlockAtStart(document: EditorialDocument, id: string): EditorialDocument {
  const moving = mediaBlockOf(document, id);
  if (!moving) return document;
  return { ...document, blocks: [moving, ...withoutMedia(document, moving)] };
}

/** The picture closes the page, after the last word. */
export function placeMediaBlockAtEnd(document: EditorialDocument, id: string): EditorialDocument {
  const moving = mediaBlockOf(document, id);
  if (!moving) return document;
  return { ...document, blocks: [...withoutMedia(document, moving), moving] };
}

/**
 * The picture sits at a share of the article's words: `0` leads, `1` closes, `0.5` is the middle.
 *
 * This is the toolbar's "beginning / middle / end": it counts the characters of the word blocks (not
 * the number of blocks), so a page that is one long paragraph still has a real middle.
 */
export function placeMediaBlockAtFraction(
  document: EditorialDocument,
  id: string,
  fraction: number,
): EditorialDocument {
  const moving = mediaBlockOf(document, id);
  if (!moving) return document;
  const share = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (share <= 0) return placeMediaBlockAtStart(document, id);
  if (share >= 1) return placeMediaBlockAtEnd(document, id);
  const texts = documentTextBlocks(document);
  const total = texts.reduce((sum, block) => sum + blockText(block).length, 0);
  if (!total) return placeMediaBlockAtStart(document, id);
  const wanted = total * share;
  let seen = 0;
  for (const block of texts) {
    const length = blockText(block).length;
    if (wanted <= seen + length) {
      return placeMediaBlockAt(document, id, { blockId: block.id, offset: Math.round(wanted - seen) });
    }
    seen += length;
  }
  return placeMediaBlockAtEnd(document, id);
}


export function toggleHeadingBlock(document: EditorialDocument, id: string): EditorialDocument {
  return {
    ...document,
    blocks: document.blocks.map((block): EditorialBlock => {
      if (block.id !== id || (block.type !== 'paragraph' && block.type !== 'heading')) return block;
      return { ...block, type: block.type === 'heading' ? 'paragraph' : 'heading' };
    }),
  };
}

/**
 * After an attachment is removed every later gallery position shifts. Media blocks follow the files
 * they point at, and a block whose file no longer exists is dropped rather than drawing an empty frame.
 */
export function remapMediaIndexes(document: EditorialDocument, removedIndex: number): EditorialDocument {
  const blocks = document.blocks.flatMap((block): EditorialBlock[] => {
    if (block.type !== 'media') return [block];
    if (block.mediaIndex === removedIndex) return [];
    if (block.mediaIndex < removedIndex) return [block];
    return [{ ...block, mediaIndex: block.mediaIndex - 1 }];
  });
  return { ...document, blocks };
}

/** Add a media block after the nearest text block, so a picked picture lands in the article body. */
export function appendMediaBlock(document: EditorialDocument, mediaIndex: number, mediaType: EditorialMediaType): EditorialDocument {
  const block = mediaBlock(mediaIndex, {
    mediaType,
    placement: mediaType === 'video' ? 'full' : 'left',
    widthFraction: mediaType === 'video' ? 1 : 0.55,
    wrapText: mediaType !== 'video',
  });
  const lastText = [...document.blocks].reverse().find((entry) => entry.type === 'paragraph' || entry.type === 'heading');
  return { ...document, blocks: insertAfter(document.blocks, lastText?.id, block) };
}

export type ReconciledMedia = {
  /** The page, with every media block pointing at the gallery position it now has. */
  document: EditorialDocument;
  /** The attachment positions the page really shows, in gallery order. */
  kept: number[];
};

/**
 * The page's pictures, brought back in line with the files the draft still holds.
 *
 * Two lists describe the same photographs: `draft.attachments` (the files, what is uploaded) and the
 * media blocks of `draft.document` (what the page draws). They are written by different gestures — a
 * picker appends to both, „Scoate din pagină" removes a block, a removal of a file remaps the rest — and
 * when they drift apart the *upload* wins: the publish sent every file in `attachments`, so a clip taken
 * out of the page (or left behind by a page rewritten from a paste) still travelled to the server and
 * appeared in the published post. The owner read that as „lipesc text și apare un video".
 *
 * This is the one rule that closes it: only the files a block points at are published, the gallery is
 * compacted in page order, and a block whose file is gone is dropped instead of framing nothing. A page
 * that already agrees is returned untouched (same object), so the composer can call this on every save.
 */
export function reconcileMedia(document: EditorialDocument, attachmentCount: number): ReconciledMedia {
  const room = Math.max(0, Math.min(MAX_EDITORIAL_MEDIA, Math.trunc(Number(attachmentCount) || 0)));
  const used: number[] = [];
  for (const block of document.blocks) {
    if (block.type !== 'media') continue;
    if (block.mediaIndex < 0 || block.mediaIndex >= room) continue;
    if (!used.includes(block.mediaIndex)) used.push(block.mediaIndex);
  }
  used.sort((left, right) => left - right);
  /**
   * „Already agrees" means the blocks *and* the files are the same list, not just the indices: a page whose
   * blocks all point at missing files (`used` is empty, `room` is 0 — every index is out of range) used to
   * pass this test and go out with its media blocks intact, which is the very drift this guard exists to
   * close. Counting the blocks as well as the indices is what makes the shortcut honest.
   */
  const blockCount = document.blocks.filter((block) => block.type === 'media').length;
  if (blockCount === used.length && used.length === room && used.every((value, index) => value === index)) {
    return { document, kept: used };
  }
  const blocks = document.blocks.flatMap((block): EditorialBlock[] => {
    if (block.type !== 'media') return [block];
    const index = used.indexOf(block.mediaIndex);
    return index < 0 ? [] : [{ ...block, mediaIndex: index }];
  });
  const next = { ...document, blocks };
  const unchanged = JSON.stringify(next.blocks) === JSON.stringify(document.blocks);
  return { document: unchanged ? document : next, kept: used };
}
