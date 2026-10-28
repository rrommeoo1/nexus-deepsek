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
 *     split by characters and cannot re-wrap a single line;
 *   · the two margins. The 66dp are measured from the *screen's* edge and the words are inset by the
 *     page's own padding, so the gutter a page keeps inside itself is `TEXT_PAGE_RAIL_GUTTER - padH`
 *     (`wordPageGutter`) — the very rectangle `wordPageRailReserve` cuts out. Keeping the full 72dp
 *     inside a page that already stands 14dp in from the edge is what left a strip of paper between the
 *     last word and the buttons (owner, 28 October 2026: textul „nu se întinde până la butoane").
 *
 * A picture, a clip or a cell of a list never reads this module: `wordPageHead` and `wordPageGutter`
 * answer with what they were given, so the photograph and the reel keep the composition they had.
 */

/**
 * The folio: the `1/22` of a page of words, and the band it owns at the foot of the paper.
 *
 * The owner, 30 October 2026: „numerotarea să fie jos, ca într-o carte". The indicator used to be a
 * dark chip pinned to the page's lower right, drawn *over* whatever the page put there — an emoji, the
 * place the author attached, the first line of the next paragraph — and nothing reserved its room.
 * A book's folio is the opposite of that: it stands centred at the foot, in the page's own face, and
 * the text column ends above it. So it is a **band**, and every surface that splits an article into
 * pages subtracts it from the measure (`EditorialPage.marginBottom`, `PostReading`'s capacity):
 *
 *   band     the height no word may enter — 26dp: a 10dp folio line plus its air;
 *   inset    how far the digits stand above the page's foot — 12dp;
 *   size     the type, in points: small, spaced, and *secondary*;
 *   tracking the letter spacing that makes `1/22` read as set type rather than as a badge.
 *
 * It is drawn on the paper itself (`pagePalette.text`, at a little over half its ink), never on a
 * plate: a folio is printed, not stuck on.
 */
export const PAGE_FOLIO = {
  band: 26,
  inset: 12,
  size: 10,
  tracking: 1.6,
  /**
   * How much of the page's ink the digits keep: enough to be read (the cream page's ink at 68 % still
   * measures ~5.4:1 against its own paper, over the 4.5:1 small text owes) and quiet enough to stay
   * behind the words, which are printed at 100 %.
   */
  ink: 0.68,
} as const;

/**
 * The paper a page of words gives up to its folio.
 *
 * `two` is `true` on a page that belongs to a reading of more than one page — the only case the
 * indicator is printed in. A surface that reserves the band for a single page too is right to do so: a
 * composer must give up the same paper its published page will, or the line that fits in the composer
 * is the line the reader pushes onto the next page.
 */
export function pageFolioBand(two = true): number {
  return two ? PAGE_FOLIO.band : 0;
}

/**
 * The same folio, printed **lower**, for the one surface that has the room: a page of words opened from a
 * profile (round 32, owner, 31 October 2026).
 *
 * Round 31 gave a page of words its way out at the foot (`lib/readerBar.ts`), in a 48dp band the page gave
 * up above the device's own inset. The owner then read the same screen and said the number sat too high —
 * „mută contorul puțin mai jos, folosește spațiul de deasupra barei" — because that band is exactly what
 * stood between the digits and the foot: 48dp of empty paper under a `1/3`.
 *
 * Round 32 takes the door off a page opened from a profile (the phone's own Back is the door there, and it
 * returns to the same profile) and hands the room back to the page. The number is reprinted in the row it
 * keeps for itself, `PROFILE_FOLIO`, and the words' own boundary follows it down by the difference.
 *
 * The row is **the same kind of row**, only closer to the foot — the arithmetic that keeps a digit off a
 * word is unchanged (`band` still clears `inset + size`):
 *
 *   band    16dp — the height no word may enter (a 10dp line plus its air; `PAGE_FOLIO` keeps 26);
 *   inset    3dp — how far the digits stand above the page's foot (12 on a page that carries a door).
 *
 * What does **not** move: `size`, `tracking` and `ink`. A folio is set type in both cases; only its
 * distance from the foot changes. Nothing else in the app reads this row — the feed, the composer route
 * and every page of media still ask for `PAGE_FOLIO` (`folioRow(false)`), which is the row they had.
 */
export const PROFILE_FOLIO = {
  band: 16,
  inset: 3,
} as const;

/** The row a folio's digits occupy on one page of words, for the surface that is drawing it. */
export function folioRow(profileReader: boolean): { band: number; inset: number } {
  return profileReader
    ? { band: PROFILE_FOLIO.band, inset: PROFILE_FOLIO.inset }
    : { band: PAGE_FOLIO.band, inset: PAGE_FOLIO.inset };
}

/**
 * The digits of the folio — `1/3`, `3/3` — from the page the reader is on and the pages the flow made.
 *
 * One function, called by both readers (`PostReading`, `EditorialPage`), because a number printed in two
 * places is a number that can disagree with itself. The `1/22` the owner saw on a three-page article
 * (31 October 2026) was exactly that: the route over the page printed a *post* counter — „postarea 1 din
 * cele 22 ale profilului" — while the paper at the foot of the same screen said `1/3`. The route draws
 * no counter at all now, and both readers print their number from here, from the pagination they
 * actually produced.
 *
 * A reading of one page prints nothing (`''`): a book does not number its only page. An index past the
 * end — a re-split caught the reader on a page that no longer exists, one frame before the reader pulls
 * itself back — prints the last page that is really there, never a page that is not.
 */
export function folioLabel(index: number, total: number): string {
  const pages = Math.max(0, Math.round(Number(total) || 0));
  if (pages < 2) return '';
  const at = Math.min(pages, Math.max(1, Math.round(Number(index) || 0) + 1));
  return `${at}/${pages}`;
}

/** The head of a page of words: a 54dp face, a 17dp name over a 13dp handle. */
export const TEXT_PAGE_HEAD = { disc: 54, name: 17, handle: 13 } as const;


/** At least this much of the page must stay free to the right of the words for the rail to be safe. */
export const RAIL_FOOTPRINT = 66;

/**
 * The air between the words and the rail's hit area — six points, measured from the rail's own foot and
 * from the page's right edge alike. It is one number because it is one decision: a line of words stops a
 * hair short of the buttons, never on them.
 */
export const RAIL_LINE_AIR = 6;

/** The room the action rail keeps on a page of words: its own 56dp cell, 10dp in, plus `RAIL_LINE_AIR`. */
export const TEXT_PAGE_RAIL_GUTTER = RAIL_FOOTPRINT + RAIL_LINE_AIR;

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
  const air = RAIL_LINE_AIR;
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
 * The room the rail keeps on the right: a page of words keeps the buttons' own reach, a page of media
 * keeps the wider gutter it has always had, and a cell keeps none (its actions are a row under the words).
 *
 * `padH` is the page's own horizontal padding, because the rail is measured from the *screen's* edge and
 * the words are measured from inside the padding: a page that stands 14dp in from the edge keeps
 * `72 - 14 = 58`dp of its own measure for a rail that reaches 72dp in — the same rectangle
 * `wordPageRailReserve` cuts out of the flow. Passing nothing keeps the whole footprint, which is what a
 * caller that draws no padding of its own wants.
 */
export function wordPageGutter(metricsGutter: number | null | undefined, wordPage: boolean, padH = 0): number {
  const gutter = Number(metricsGutter);
  if (!(gutter > 0)) return 0;
  if (!wordPage) return gutter;
  const inset = Math.max(0, Number(padH) || 0);
  return Math.max(0, TEXT_PAGE_RAIL_GUTTER - inset);
}
