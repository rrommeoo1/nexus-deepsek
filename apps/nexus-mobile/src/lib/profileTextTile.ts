/**
 * A text post's cell: which words it shows, and how big the page sets them.
 *
 * The archive draws every post as a 9:16 cell. A photograph fills its cell with itself, but a post that
 * is only words has no picture to fill anything: it used to be painted as a flat moss-green rectangle
 * with a leaf on it, which said "this cell is empty" to a reader and was the one thing the owner asked
 * to have replaced (26 October 2026). A page of words is not empty — it is the post — so the cell now
 * reads as a miniature reading page: warm e-paper, dark ink, title first, then the opening of the text.
 *
 * Why this is arithmetic and not a component
 * ------------------------------------------
 * The thumbnail is ~155 x 275 points on the reference phone and can be a third of that on a small one.
 * How many characters fit on it, and therefore how large the type may be, is a question with an answer —
 * not a guess that has to be looked at on a phone to be checked. Everything here is a pure function of
 * the stored text and the measured box, so `scripts/test-profile-text-tile.cjs` can hold all four cases
 * of the owner's brief (titled, short, long, article with pictures) to numbers, and the component only
 * paints the plan it is handed.
 *
 * The numbers are the page's, not the reader's
 * --------------------------------------------
 * This module never renders a post: it clips the stored words to a little page and picks a size from a
 * ladder. The full article keeps its own reader (`EditorialArticle`), its own pagination and its own
 * theme. Tapping the cell still opens exactly that.
 */

/** What a stored post gives a cell: its title as publishing wrote it, its words, and its page style. */
export type TextTileSource = {
  /** A `title` field on an older row; `publishing.title` is the one the composer writes today. */
  title?: string | null;
  publishing?: { title?: string | null } | null;
  /** `posts.caption`: the words of the post, newlines included. */
  caption?: string | null;
  /** `posts.text_style_json`: an authored page, whose `document` holds headings and paragraphs. */
  text_style?: { document?: unknown } | null;
  /** True when the post carries a picture or a clip this page may set beside its words. */
  hasMedia?: boolean;
};

export type TextTileCopy = {
  /** The real stored title, or `''`. A title is never invented from the first line of the text. */
  title: string;
  /** The opening of the stored text, blank lines kept so paragraphs stay paragraphs. */
  body: string;
  /** True when the stored text is longer than the cell can carry, so the page really continues. */
  cut: boolean;
};

export type TextTileShape = 'blank' | 'title' | 'titled' | 'short' | 'medium' | 'long' | 'article';

export type TextTilePlan = {
  shape: TextTileShape;
  title: string;
  body: string;
  titleSize: number;
  titleLine: number;
  titleLines: number;
  bodySize: number;
  bodyLine: number;
  bodyLines: number;
  /** The height of the picture band an article sets under its title, in points; 0 for no picture. */
  plate: number;
  /** True when the words run past the page: the cell fades them out instead of ending mid-page. */
  fade: boolean;
  /** True when some of the stored words are not on this page at all. */
  cut: boolean;
  /** True when the page has so little text that it is set in the optical middle, like a title page. */
  centred: boolean;
};

/**
 * How much of a post a cell carries.
 *
 * The longest stored article in this database is 11 105 characters; a cell holds a page, not a post.
 * 760 characters is the most that can be read at 9.5 points on the reference phone (about 25 lines),
 * and it is enough that a "long" page visibly continues instead of ending in a sentence.
 */
export const TEXT_TILE_MAX_CHARS = 760;
export const TEXT_TILE_TITLE_MAX_CHARS = 120;

/** The two thresholds that separate a short note from a paragraph from an article. */
export const TEXT_TILE_SHORT_CHARS = 90;
export const TEXT_TILE_MEDIUM_CHARS = 320;

/**
 * The ladder of body sizes, largest first, in points.
 *
 * A cell is read at arm's length, so the type is as large as the words allow and no larger: the first
 * size whose text fits the page wins, and the smallest size still has to be legible (9.5 points is the
 * floor — below it a page is a texture, not a sentence).
 */
export const TEXT_TILE_SIZES: readonly number[] = [17, 16, 15, 14, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5];

export const TEXT_TILE_MIN_SIZE = TEXT_TILE_SIZES[TEXT_TILE_SIZES.length - 1];

/** The page's own inner margin; `socialTokens.reading.margin` states the same number for the renderer. */
export const TEXT_TILE_MARGIN = 9;

/** The largest body size each shape may use: a title's page keeps the body under the title's voice. */
const SIZE_CAPS: Record<TextTileShape, number> = {
  blank: 11,
  title: 11,
  titled: 12.5,
  article: 12.5,
  short: 17,
  medium: 13,
  long: 11,
};

const SHAPE_GAP = 6;
const RULE_RESERVE = 6;

const whole = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Newlines, paragraph gaps and trailing spaces: what a stored caption looks like once it is read. */
function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A title is one line of words: a stored title with a newline in it is still a title. */
function oneLine(value: unknown): string {
  return clean(value).replace(/\s*\n+\s*/g, ' ').trim();
}

/** A prefix of the text that ends on a word boundary, so a page never ends mid-word by arithmetic. */
function bound(text: string, max: number): { text: string; cut: boolean } {
  const characters = Array.from(text);
  if (characters.length <= max) return { text, cut: false };
  const head = characters.slice(0, max).join('');
  const lastSpace = head.search(/\s\S*$/);
  return { text: (lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head).trimEnd(), cut: true };
}

/**
 * The heading and paragraph blocks of an authored page, read defensively: `text_style_json` is a stored
 * JSON column, and a row written by a hand or by an older build may hold anything at all.
 */
function blocksOf(post?: TextTileSource | null): { headings: string[]; paragraphs: string[] } {
  const headings: string[] = [];
  const paragraphs: string[] = [];
  const document = post?.text_style?.document as { blocks?: unknown } | null | undefined;
  const blocks = document && Array.isArray(document.blocks) ? document.blocks : [];
  for (const block of blocks) {
    const entry = block as { type?: unknown; text?: unknown; runs?: unknown };
    const type = String(entry?.type ?? '');
    if (type !== 'paragraph' && type !== 'heading') continue;
    const runs = Array.isArray(entry?.runs) ? entry.runs : [];
    const fromRuns = runs.map((run) => String((run as { text?: unknown })?.text ?? '')).join('');
    const text = clean(fromRuns || entry?.text);
    if (!text) continue;
    (type === 'heading' ? headings : paragraphs).push(text);
  }
  return { headings, paragraphs };
}

/**
 * The words this cell shows.
 *
 * The title is the one the post really stores: `publishing.title`, or the first heading of an authored
 * page. A post without either has no title, and this function says so — many of the text posts in this
 * database were written without one, and inventing a title from the opening sentence would set that
 * sentence in a headline's typeface and call it a title.
 */
export function textTileCopy(post?: TextTileSource | null): TextTileCopy {
  const { headings, paragraphs } = blocksOf(post);
  const stored = oneLine(post?.publishing?.title ?? post?.title);
  const title = bound(stored || headings[0] || '', TEXT_TILE_TITLE_MAX_CHARS);
  let body = paragraphs.length ? paragraphs.join('\n\n') : clean(post?.caption);
  /**
   * A legacy page (no document) often opens with its own title as the first line, because that is how
   * the composer wrote it. It must not be printed twice, once as a headline and again as a body line.
   */
  if (!paragraphs.length && title.text && body.toLowerCase().startsWith(title.text.toLowerCase())) {
    body = body.slice(title.text.length).replace(/^[\s:—–-]+/, '').trim();
  }
  const bounded = bound(body, TEXT_TILE_MAX_CHARS);
  return { title: title.text, body: bounded.text, cut: title.cut || bounded.cut };
}

/** How many characters of `size` points fit across `measure` points of a serif line. */
export function charactersPerLine(measure: number, size: number): number {
  const width = Math.max(1, whole(measure, 1));
  const points = Math.max(4, whole(size, 10));
  // A serif lowercase averages a little over half an em; 0.52 keeps the estimate on the safe side.
  return Math.max(6, Math.floor(width / (points * 0.52)));
}

/** How many lines a text takes at a given measure, counting a blank line between paragraphs as a line. */
export function estimatedLines(text: string, perLine: number): number {
  const capacity = Math.max(1, whole(perLine, 1));
  return String(text ?? '')
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / capacity)), 0);
}

function shapeOf(copy: TextTileCopy, hasMedia: boolean): TextTileShape {
  if (!copy.title && !copy.body) return 'blank';
  if (hasMedia) return 'article';
  if (copy.title) return copy.body ? 'titled' : 'title';
  if (copy.body.length <= TEXT_TILE_SHORT_CHARS) return 'short';
  if (copy.body.length <= TEXT_TILE_MEDIUM_CHARS) return 'medium';
  return 'long';
}

/**
 * The page a copy is set on, for a box the cell really measured.
 *
 * `box` is the cell's own size in points, so the same post is set larger on a tablet and smaller on a
 * narrow phone without a second rule: every measure below is derived from it. Nothing here is a fixed
 * font size — an eight-word note is set at 17 points and an article at 9.5, and the ladder between them
 * is decided by how many lines the words really need.
 */
export function planTextTile(
  copy: TextTileCopy,
  box: { width?: number; height?: number },
  options: { margin?: number; hasMedia?: boolean } = {},
): TextTilePlan {
  const margin = Math.max(0, whole(options.margin ?? TEXT_TILE_MARGIN, TEXT_TILE_MARGIN));
  const width = Math.max(40, whole(box?.width, 0));
  const height = Math.max(40, whole(box?.height, 0));
  const measure = Math.max(24, width - margin * 2);
  const pageHeight = Math.max(30, height - margin * 2);
  const title = copy.title;
  const body = copy.body;
  const hasMedia = options.hasMedia === true;
  const shape = shapeOf(copy, hasMedia);

  /** The title is the loudest thing on the page, and still has to be able to wrap to three lines. */
  let titleSize = clamp(Math.round(measure / 8), 11, 17);
  if (title.length > 64) titleSize = Math.max(10, titleSize - 2);
  if (title.length > 110) titleSize = Math.max(9, titleSize - 1);
  const titleLine = Math.round(titleSize * 1.22);
  const titleLines = title ? (body ? 3 : 5) : 0;

  /** An article keeps one picture, small enough that the words stay the page. */
  const plate = hasMedia ? Math.max(24, Math.round(measure * 0.4)) : 0;

  const reserved = RULE_RESERVE
    + (title ? titleLines * titleLine + SHAPE_GAP : 0)
    + (plate ? plate + SHAPE_GAP : 0);
  const available = Math.max(Math.round(titleSize * 1.4), pageHeight - reserved);

  const cap = SIZE_CAPS[shape] ?? TEXT_TILE_MIN_SIZE;
  const ladder = TEXT_TILE_SIZES.filter((size) => size <= cap);
  const smallest = ladder.length ? ladder[ladder.length - 1] : TEXT_TILE_MIN_SIZE;
  let bodySize = smallest;
  let bodyLine = Math.round(bodySize * 1.5);
  let bodyLines = Math.max(1, Math.floor(available / bodyLine));
  let fade = false;

  if (body) {
    let placed = false;
    for (const size of ladder) {
      const line = Math.round(size * 1.5);
      const lines = Math.max(1, Math.floor(available / line));
      const perLine = charactersPerLine(measure, size);
      if (estimatedLines(body, perLine) <= lines) {
        bodySize = size;
        bodyLine = line;
        bodyLines = lines;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Every size overflows: the smallest one, with a fade that says the page goes on.
      bodySize = smallest;
      bodyLine = Math.round(bodySize * 1.5);
      bodyLines = Math.max(1, Math.floor(available / bodyLine));
      fade = true;
    }
  }

  /**
   * A page with two lines on it and half a screen of paper under them looks like a failure; a title
   * page set in the optical middle looks like a book. Short notes and bare titles are therefore centred.
   */
  const centred = shape === 'short' || shape === 'title' || shape === 'blank';

  return {
    shape, title, body,
    titleSize, titleLine, titleLines,
    bodySize, bodyLine, bodyLines,
    plate,
    fade,
    cut: Boolean(copy.cut) || fade,
    centred,
  };
}
