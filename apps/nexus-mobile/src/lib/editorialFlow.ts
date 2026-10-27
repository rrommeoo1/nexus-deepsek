import type { EditorialDocument, EditorialMediaBlock, EditorialTextBlock } from './editorialDocument';
import { blockText } from './editorialDocument';

/**
 * The page flow: words around pictures, then pages.
 *
 * React Native has no CSS float. A paragraph with an image beside it cannot be expressed by nesting a
 * `<Text>` next to an `<Image>`, because the words must continue *under* the image once it ends. The
 * engine below therefore lays the article out as regions: a media block reserves a rectangle, every
 * line asks which horizontal intervals are free at its own height, and the line is placed there.
 * Nothing is positioned over a picture, and no coordinate is hand-written - the rectangles are derived
 * from the page, the media width and the measured type.
 *
 * The engine is pure and independent of React Native, so `scripts/test-editorial-flow.cjs` can prove
 * that no word is lost, no line overlaps media and that a long article pages deterministically.
 */

export type EditorialFont = 'serif' | 'sans' | 'mono';

/**
 * A rectangle of the page the **words may not enter** — the room the reader's rail keeps in the lower
 * right corner (`PostRail`), described in the page's own points.
 *
 * It is not a margin and not a media block: a margin narrows every line of the page, which is what the
 * owner rejected on 27 October 2026 („o coloană goală pe toată înălțimea, deasupra butoanelor"), while a
 * reserve narrows only the lines that really reach it. A picture is pushed below it, exactly as it is
 * pushed below another picture, so nothing is ever drawn under a button.
 */
export type EditorialReserve = { x: number; y: number; width: number; height: number };

export type EditorialFlowOptions = {
  pageWidth: number;
  pageHeight: number;
  fontSize: number;
  lineHeight: number;
  font: EditorialFont;
  align?: 'left' | 'center';
  /** A heading is set at this size; the body keeps `fontSize`. */
  headingSize?: number;
  headingLine?: number;
  marginX?: number;
  marginTop?: number;
  marginBottom?: number;
  paragraphGap?: number;
  mediaGap?: number;
  /** Measured natural aspect ratio per gallery position; 4:3 and 16:9 are the fallbacks. */
  aspectRatios?: Record<number, number>;
  /** Rooms the words must keep clear on **every** page (`EditorialReserve`): the reader's rail. */
  reserve?: EditorialReserve[];
  maxPages?: number;
};

export type EditorialLine = {
  blockId: string;
  page: number;
  text: string;
  heading: boolean;
  /** Offsets inside the block's own text, so the caret can be placed exactly. */
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center';
};

export type EditorialMediaBox = {
  blockId: string;
  page: number;
  mediaIndex: number;
  mediaType: EditorialMediaBlock['mediaType'];
  placement: EditorialMediaBlock['placement'];
  wrapText: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EditorialPage = {
  index: number;
  width: number;
  height: number;
  lines: EditorialLine[];
  media: EditorialMediaBox[];
};

export type EditorialFlow = {
  pages: EditorialPage[];
  pageCount: number;
  overflow: boolean;
  contentWidth: number;
  contentHeight: number;
  marginX: number;
  marginTop: number;
};

type Token = { text: string; start: number; end: number; spaceBefore: boolean };
type Interval = { x: number; width: number };
type FloatRect = { x: number; y: number; width: number; height: number };

/**
 * A conservative proportional width table. Values are shares of the font size for the system serif
 * and sans faces; a mono face uses a fixed advance. The table is deliberately a little generous, so a
 * line stays inside its measured interval on Android's own fonts rather than clipping its last word.
 */
const NARROW = new Set('ijl.,:;\'!|`'.split(''));
const WIDE = new Set('mwMW@%'.split(''));

export function glyphFactor(char: string, font: EditorialFont): number {
  if (font === 'mono') return 0.62;
  if (char === ' ') return 0.28;
  if (char === '\t') return 0.56;
  if (NARROW.has(char)) return 0.31;
  if (WIDE.has(char)) return 0.86;
  if (char >= 'A' && char <= 'Z') return 0.68;
  if (char >= '0' && char <= '9') return 0.56;
  if (char === '—' || char === '–') return 0.85;
  if (char === '…') return 0.8;
  if ((char.codePointAt(0) ?? 0) > 0x2000) return 0.95;
  return 0.54;
}

export function measureTextWidth(text: string, fontSize: number, font: EditorialFont, bold = false): number {
  let total = 0;
  for (const char of Array.from(text)) total += glyphFactor(char, font) * fontSize;
  return total * (bold ? 1.045 : 1) * 1.035;
}

function splitLongWord(word: string, start: number, maxWidth: number, fontSize: number, font: EditorialFont): Token[] {
  if (measureTextWidth(word, fontSize, font) <= maxWidth) {
    return [{ text: word, start, end: start + word.length, spaceBefore: false }];
  }
  const chunks: Token[] = [];
  let chunk = '';
  let chunkStart = start;
  let offset = start;
  for (const char of Array.from(word)) {
    if (chunk && measureTextWidth(`${chunk}${char}`, fontSize, font) > maxWidth) {
      chunks.push({ text: chunk, start: chunkStart, end: offset, spaceBefore: false });
      chunk = char;
      chunkStart = offset;
    } else {
      chunk += char;
    }
    offset += char.length;
  }
  if (chunk) chunks.push({ text: chunk, start: chunkStart, end: offset, spaceBefore: false });
  return chunks.length ? chunks : [{ text: word, start, end: start + word.length, spaceBefore: false }];
}

function tokensOf(block: EditorialTextBlock, fontSize: number, font: EditorialFont, maxWidth: number): Token[] {
  const text = blockText(block);
  const tokens: Token[] = [];
  let previousEnd = -1;
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const pieces = splitLongWord(match[0], start, maxWidth, fontSize, font);
    pieces.forEach((piece, index) => {
      tokens.push({ ...piece, spaceBefore: index === 0 && previousEnd >= 0 });
    });
    previousEnd = start + match[0].length;
  }
  return tokens;
}

export function flowEditorialDocument(document: EditorialDocument, options: EditorialFlowOptions): EditorialFlow {
  const pageWidth = Math.max(80, Number(options.pageWidth) || 0);
  const pageHeight = Math.max(120, Number(options.pageHeight) || 0);
  const fontSize = Math.max(8, Number(options.fontSize) || 20);
  const lineHeight = Math.max(fontSize, Number(options.lineHeight) || fontSize * 1.45);
  const headingSize = Math.max(fontSize, Number(options.headingSize) || fontSize * 1.42);
  const headingLine = Math.max(headingSize, Number(options.headingLine) || headingSize * 1.35);
  const marginX = Math.max(8, Number(options.marginX) || 26);
  const marginTop = Math.max(8, Number(options.marginTop) || 30);
  const marginBottom = Math.max(8, Number(options.marginBottom) || 30);
  const paragraphGap = Math.max(0, Number(options.paragraphGap) || Math.round(lineHeight * 0.52));
  const mediaGap = Math.max(4, Number(options.mediaGap) || Math.round(lineHeight * 0.55));
  const contentWidth = Math.max(20, pageWidth - marginX * 2);
  const contentHeight = Math.max(40, pageHeight - marginTop - marginBottom);
  const maxPages = Math.max(1, Math.trunc(Number(options.maxPages) || 160));
  const aspectRatios = options.aspectRatios ?? {};
  const align = options.align === 'center' ? 'center' : 'left';
  const font = options.font;
  /**
   * The rooms every page must keep clear (the reader's rail). They are seeded into the same list a
   * picture is: a line asks which intervals are free at its own height, and a block picture is pushed
   * below what stands in its way — so the words narrow beside the rail and a photograph never lands
   * under a button, without a single line of the page losing width above it.
   */
  const reserve: FloatRect[] = (options.reserve ?? [])
    .filter((rect) => rect && rect.width > 0 && rect.height > 0)
    .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));

  const pages: EditorialPage[] = [];
  const makePage = (): EditorialPage => ({ index: pages.length, width: pageWidth, height: pageHeight, lines: [], media: [] });
  let page = makePage();
  pages.push(page);
  let y = marginTop;
  let floats: FloatRect[] = reserve.map((rect) => ({ ...rect }));
  let overflow = false;
  const bottom = pageHeight - marginBottom;

  function newPage(): boolean {
    if (pages.length >= maxPages) {
      overflow = true;
      return false;
    }
    page = makePage();
    pages.push(page);
    y = marginTop;
    floats = reserve.map((rect) => ({ ...rect }));
    return true;
  }

  function expireFloats(): void {
    floats = floats.filter((rect) => rect.y + rect.height > y + 0.5);
  }

  function freeIntervals(top: number, height: number): Interval[] {
    const lineBottom = top + height;
    const bounds: Interval[] = [{ x: marginX, width: contentWidth }];
    const overlapping = floats
      .filter((rect) => rect.y < lineBottom && rect.y + rect.height > top)
      .sort((a, b) => a.x - b.x);
    for (const rect of overlapping) {
      for (let index = bounds.length - 1; index >= 0; index--) {
        const span = bounds[index];
        const left = span.x;
        const right = span.x + span.width;
        const cutLeft = Math.max(left, rect.x - mediaGap / 3);
        const cutRight = Math.min(right, rect.x + rect.width + mediaGap / 3);
        if (cutRight <= left || cutLeft >= right) continue;
        const pieces: Interval[] = [];
        if (cutLeft - left > 1) pieces.push({ x: left, width: cutLeft - left });
        if (right - cutRight > 1) pieces.push({ x: cutRight, width: right - cutRight });
        bounds.splice(index, 1, ...pieces);
      }
    }
    return bounds.filter((span) => span.width >= fontSize * 1.7).sort((a, b) => b.width - a.width);
  }

  function ensureLineRoom(height: number): Interval | null {
    expireFloats();
    if (y + height > bottom + 0.5 && !newPage()) return null;
    let intervals = freeIntervals(y, height);
    if (!intervals.length && floats.length) {
      if (!newPage()) return null;
      intervals = freeIntervals(y, height);
    }
    return intervals[0] ?? null;
  }

  for (const block of document.blocks) {
    if (overflow) break;
    if (block.type === 'pagebreak') {
      newPage();
      continue;
    }
    if (block.type === 'media') {
      const fraction = Math.min(1, Math.max(0.28, Number(block.widthFraction) || 0.55));
      const mediaWidth = contentWidth * fraction;
      const ratio = Math.min(3.2, Math.max(0.45, Number(aspectRatios[block.mediaIndex]) || 1.5));
      const mediaHeight = mediaWidth / ratio;
      const isFloat = (block.placement === 'left' || block.placement === 'right') && block.wrapText;
      const placeAt = (top: number): EditorialMediaBox | null => {
        if (top + mediaHeight > bottom + 0.5) return null;
        const x = block.placement === 'right'
          ? marginX + contentWidth - mediaWidth
          : block.placement === 'center'
            ? marginX + (contentWidth - mediaWidth) / 2
            : marginX;
        const box: EditorialMediaBox = {
          blockId: block.id,
          page: page.index,
          mediaIndex: block.mediaIndex,
          mediaType: block.mediaType,
          placement: block.placement,
          wrapText: block.wrapText,
          x,
          y: top,
          width: mediaWidth,
          height: mediaHeight,
        };
        page.media.push(box);
        return box;
      };

      expireFloats();
      let box = placeAt(y);
      if (!box) {
        if (!newPage()) break;
        box = placeAt(y);
      }
      if (!box) { overflow = true; break; }
      if (isFloat) {
        /** A second float may share the same top when the two do not overlap horizontally. */
        let guard = 0;
        while (box) {
          const current = box;
          const overlaps = floats.some((rect) => (
            rect.x < current.x + current.width + mediaGap
            && rect.x + rect.width + mediaGap > current.x
            && rect.y < current.y + current.height + mediaGap
            && rect.y + rect.height + mediaGap > current.y
          ));
          if (!overlaps || guard++ >= 20) break;
          page.media = page.media.filter((entry) => entry !== current);
          const lowest = Math.max(...floats.map((rect) => rect.y + rect.height));
          y = lowest + mediaGap;
          if (y + mediaHeight > bottom + 0.5 && !newPage()) { box = null; break; }
          box = placeAt(y);
          if (!box) { overflow = true; break; }
        }
        if (box) floats.push({ x: box.x, y: box.y, width: box.width, height: box.height });
      } else {
        /** A block picture waits below an active float instead of drawing over it. */
        let guard = 0;
        while (box) {
          const current = box;
          const overlaps = floats.some((rect) => (
            rect.x < current.x + current.width + mediaGap
            && rect.x + rect.width + mediaGap > current.x
            && rect.y < current.y + current.height + mediaGap
            && rect.y + rect.height + mediaGap > current.y
          ));
          if (!overlaps || guard++ >= 20) break;
          page.media = page.media.filter((entry) => entry !== current);
          const lowest = Math.max(...floats.map((rect) => rect.y + rect.height));
          y = lowest + mediaGap;
          if (y + mediaHeight > bottom + 0.5 && !newPage()) { box = null; break; }
          box = placeAt(y);
          if (!box) { overflow = true; break; }
        }
        if (!box) break;
        y = box.y + box.height + mediaGap;
        expireFloats();
      }
      continue;
    }

    const heading = block.type === 'heading';
    const size = heading ? headingSize : fontSize;
    const line = heading ? headingLine : lineHeight;
    if (heading && y + line * 2 > bottom && !newPage()) break;
    const tokens = tokensOf(block, size, font, contentWidth);
    let index = 0;
    while (index < tokens.length) {
      const interval = ensureLineRoom(line);
      if (!interval) { overflow = true; break; }
      let text = '';
      let start = tokens[index].start;
      let end = tokens[index].end;
      let empty = true;
      while (index < tokens.length) {
        const token = tokens[index];
        const prefix = empty ? '' : (token.spaceBefore ? ' ' : '');
        const candidate = `${text}${prefix}${token.text}`;
        const width = measureTextWidth(candidate, size, font, heading);
        if (!empty && width > interval.width) break;
        text = candidate;
        if (empty) start = token.start;
        end = token.end;
        empty = false;
        index += 1;
      }
      if (empty) {
        text = tokens[index].text;
        start = tokens[index].start;
        end = tokens[index].end;
        index += 1;
      }
      page.lines.push({
        blockId: block.id,
        page: page.index,
        text,
        heading,
        start,
        end,
        x: interval.x,
        y,
        width: interval.width,
        fontSize: size,
        lineHeight: line,
        align,
      });
      y += line;
    }
    y += paragraphGap;
  }

  if (pages.length > 1 && !pages[pages.length - 1].lines.length && !pages[pages.length - 1].media.length) {
    pages.pop();
  }
  return {
    pages,
    pageCount: pages.length,
    overflow,
    contentWidth,
    contentHeight,
    marginX,
    marginTop,
  };
}
