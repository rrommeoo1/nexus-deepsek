/**
 * The numbers a **page of words** is set with — the one composition the owner reads as a page of a book
 * (27 October 2026).
 *
 * Two of them are the phone's own decision, and both are written down here rather than inside
 * `PostCanvas`, so they can be read by a test the way they are read by the renderer:
 *
 *   · the head. A page is the whole screen, and the author's face and name at a card's size (42dp and
 *     14dp) read as a caption over an article. The page therefore opens with a larger face and a larger
 *     name — moderately, because the title and the words are what the page is for;
 *   · the gutter. The reader's rail (`PostRail`) stands on the right of every page at `right: 10` and
 *     56dp wide, so a page of words keeps exactly that: 66dp of the page, plus 6dp of air, and not the
 *     78dp a reel keeps. The rest of the width is paper the words may use — a page that reserved the
 *     whole 78dp left a column of nothing beside every line;
 *   · the room. Even that gutter was a column: it ran the full height of the page, above buttons that
 *     only stand at its foot. A page of words written in the composer therefore keeps the rail's own
 *     rectangle instead (`wordPageRailReserve`), and the flow narrows only the lines that really reach
 *     it. The gutter above stays for a page that has no flow to narrow — the legacy reading, which is
 *     split by characters and cannot re-wrap a single line.
 *
 * A picture, a clip or a cell of a list never reads this module: `wordPageHead` and `wordPageGutter`
 * answer with what they were given, so the photograph and the reel keep the composition they had.
 */

/** The head of a page of words: a 54dp face, a 17dp name over a 13dp handle. */
export const TEXT_PAGE_HEAD = { disc: 54, name: 17, handle: 13 } as const;

/** The room the action rail keeps on a page of words: its own 56dp cell, 10dp in, plus 6dp of air. */
export const TEXT_PAGE_RAIL_GUTTER = 66 + 6;

/** At least this much of the page must stay free to the right of the words for the rail to be safe. */
export const RAIL_FOOTPRINT = 66;

/**
 * The 56×56 cell every press of the rail shares (`.clipQuickActions>button`). Exported because the room a
 * page of words keeps for the rail is *cut from* these cells: four of them make the column, and a page
 * that reserved any other height would either eat paper above the buttons or let a line run under them.
 */
export const RAIL_CELL = 56;

/** `.clipQuickActions{gap:2px}`: two clear points between two cells — the rail's own, not the page's. */
export const RAIL_GAP = 2;

/**
 * `.clipMusicDisc{margin-top:4px}`: the soundtrack's disc stands a little clear of the press above it, so
 * a rail that shows one is four points taller than its cells alone say. The page's reserve counts it.
 */
export const RAIL_SOUND_AIR = 4;

/**
 * A room at the **right edge** of a page of words, measured in the page's own points: how far it reaches
 * in (`width`), how tall it is (`height`), and how far its foot stands above the page's foot (`bottom`).
 *
 * This is the shape the rail really has, and the reason it is not a margin: the words keep it only where
 * it stands. `EditorialPage` turns it into an `EditorialReserve` for `lib/editorialFlow.ts`, which lays
 * every line around it — so the lines above the buttons keep the whole width of the paper, which is the
 * column the owner rejected on 27 October 2026 („o coloană goală pe toată înălțimea").
 */
export type RailReserve = { width: number; height: number; bottom: number };

/**
 * The room the rail keeps on a page of words, derived from where the rail is actually drawn.
 *
 * `padH` matters because the words are inset by the page's padding while the rail is not: the rail's
 * 66dp reach (a 56dp cell 10dp in from the edge) is 58dp of the measure on the feed's 14dp padding and
 * 56dp on the reader's 16dp one. `padB` and `foot` place its foot: the rail's last cell stands 26dp
 * above the frame's foot, while the words stop `padB` above it, so the room ends where the buttons end.
 * `cells` is how many presses the rail carries on this page — four on a page of words, five when the
 * page also has a soundtrack's disc to show.
 */
export function wordPageRailReserve(input: {
  padH: number;
  padB: number;
  cells: number;
  /** `PostRail`'s `RAIL_FOOT`: how far its last cell stands above the frame's foot. */
  foot: number;
  /** Does the rail show a soundtrack's disc under the presses? It stands `RAIL_SOUND_AIR` clear of them. */
  sound?: boolean;
}): RailReserve {
  const cells = Math.max(0, Math.round(input.cells));
  const air = 6;
  /** A disc needs a row of its own: with four cells the rail has none, so it pays nothing for one. */
  const disc = Boolean(input.sound) && cells > 4;
  const height = cells
    ? cells * RAIL_CELL + (cells - 1) * RAIL_GAP + (disc ? RAIL_SOUND_AIR : 0) + air
    : 0;
  return {
    width: Math.max(0, Math.round(TEXT_PAGE_RAIL_GUTTER - input.padH)),
    height: Math.round(height),
    bottom: Math.max(0, Math.round(input.foot - input.padB)),
  };
}

/** A metrics record, whatever the canvas calls its fields (`PostCanvas`'s `Metrics`). */
export type PageMetrics = { disc: number; name: number; handle: number } & Record<string, number>;

/**
 * The head a composition is set with: the page's own numbers for a page of words, and the caller's own
 * record, unchanged, for anything else (a picture, a clip, a cell of a list).
 */
export function wordPageHead<T extends PageMetrics>(metrics: T, wordPage: boolean): T {
  return wordPage ? { ...metrics, ...TEXT_PAGE_HEAD } : { ...metrics };
}

/**
 * The room the rail keeps on the right: a page of words keeps its footprint, a page of media keeps the
 * wider gutter it has always had, and a cell keeps none (its actions are a row under the words).
 */
export function wordPageGutter(metricsGutter: number | null | undefined, wordPage: boolean): number {
  const gutter = Number(metricsGutter);
  if (!(gutter > 0)) return 0;
  return wordPage ? TEXT_PAGE_RAIL_GUTTER : gutter;
}
