import type { EditorialDocument, EditorialMediaBlock, EditorialTextBlock } from './editorialDocument';
import { blockText } from './editorialDocument';
import { advanceOf, measureRun } from './fontMetrics';

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
  /** The page's reading margin, both sides. The two below override it, side by side. */
  marginX?: number;
  /**
   * The two margins of the measure, when the page's two sides are not the same number — which is every
   * page a reader reads: the words stand a modest margin in from the left, and on the right only the small
   * gap that separates them from the rail's hit area (`RAIL_LINE_AIR`). A margin that is the same on both
   * sides throws away, on the right, paper that no button stands on (owner, 28 October 2026: the text
   * „nu folosește lățimea ecranului, deși are loc până la butoane"). Omitted, each falls back to
   * `marginX`, so every caller that has no rail in its corner keeps composing exactly as before.
   */
  marginLeft?: number;
  marginRight?: number;
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
  /** The measure's two margins; `marginX` is the left one. */
  marginLeft: number;
  marginRight: number;
  marginTop: number;
};

type Token = {
  text: string;
  start: number;
  end: number;
  spaceBefore: boolean;
  /**
   * A line break the author typed stands between the previous word and this one. The page draws words,
   * never a control character, so the break becomes a new line at this token instead of a glyph — and a
   * pasted address, poem or list keeps the shape it was pasted in (`paragraphsOf` no longer folds `\n`
   * into a space).
   */
  breakBefore?: boolean;
};
type Interval = { x: number; width: number };
type FloatRect = { x: number; y: number; width: number; height: number };

/**
 * The width of a run of words — measured, not guessed (`lib/fontMetrics.ts`).
 *
 * The engine used a hand-written table of "shares of the font size" until 29 October 2026, generous on
 * purpose so that a line would never be cut on the phone. Measured against the face the phone really draws
 * (Noto Serif, `/system/fonts` on the owner's Xiaomi), that table was 2–9 % too wide, and every line broke a
 * word early: the page had a ragged right edge the owner read as „spațiu gol" beside the rail. `fontMetrics`
 * carries the real advances of every character a page can hold, read out of the font files themselves.
 */
export function glyphFactor(char: string, font: EditorialFont): number {
  return advanceOf(char, font);
}

export function measureTextWidth(text: string, fontSize: number, font: EditorialFont, bold = false): number {
  return measureRun(text, fontSize, font, bold);
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
    /** The whitespace between the two words: it carries the author's line breaks. */
    const gap = previousEnd >= 0 ? text.slice(previousEnd, start) : '';
    const pieces = splitLongWord(match[0], start, maxWidth, fontSize, font);
    pieces.forEach((piece, index) => {
      tokens.push({
        ...piece,
        spaceBefore: index === 0 && previousEnd >= 0,
        breakBefore: index === 0 && gap.includes('\n'),
      });
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
  const marginLeft = options.marginLeft === undefined ? marginX : Math.max(8, Number(options.marginLeft) || 0);
  const marginRight = options.marginRight === undefined ? marginX : Math.max(0, Number(options.marginRight) || 0);
  const marginTop = Math.max(8, Number(options.marginTop) || 30);
  const marginBottom = Math.max(8, Number(options.marginBottom) || 30);
  const paragraphGap = Math.max(0, Number(options.paragraphGap) || Math.round(lineHeight * 0.52));
  const mediaGap = Math.max(4, Number(options.mediaGap) || Math.round(lineHeight * 0.55));
  const contentWidth = Math.max(20, pageWidth - marginLeft - marginRight);
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
    const bounds: Interval[] = [{ x: marginLeft, width: contentWidth }];
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
          ? marginLeft + contentWidth - mediaWidth
          : block.placement === 'center'
            ? marginLeft + (contentWidth - mediaWidth) / 2
            : marginLeft;
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
        /** The author's own line break ends the line before this word (`Token.breakBefore`). */
        if (!empty && token.breakBefore) break;
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
    /** `marginX` stays the *left* margin, which is the number a symmetric caller has always read. */
    marginX: marginLeft,
    marginLeft,
    marginRight,
    marginTop,
  };
}
