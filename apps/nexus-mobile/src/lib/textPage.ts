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
 *     whole 78dp left a column of nothing beside every line.
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
