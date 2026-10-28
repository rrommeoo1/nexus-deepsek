/**
 * The gesture that moves a photograph through an article.
 *
 * An authored page is a stack of pages, and a picture has to be able to travel from the first of them to
 * the twelfth: a drag that can only reach what is under the finger can move a picture one screen. The
 * rule this file states is the one the owner asked for on 26 October 2026:
 *
 *   READING → EDITING → MEDIA_SELECTED → MEDIA_DRAGGING → EDGE_PAGING → DROP
 *
 * - `READING` is the page before anything is touched;
 * - `EDITING` is the composer with a caret in the words (typing and arranging are different intents);
 * - `MEDIA_SELECTED` is one picture chosen, with its width and placement controls under it;
 * - `MEDIA_DRAGGING` is the picture under the finger, following it;
 * - `EDGE_PAGING` is the same drag held inside the left or right band of the page: after
 *   `EDITORIAL_EDGE_DWELL_MS` the article turns one page and the drag keeps going, so a picture can be
 *   carried across a long article one dwell at a time without ever leaving the finger;
 * - `DROP` is the release, and it names the page the picture lands on.
 *
 * The module is pure - it imports nothing - so the whole machine can be read as numbers by the Node
 * suites, and the component only has to draw what the machine says.
 */
export const EDITORIAL_EDGE_BAND = 56;
export const EDITORIAL_EDGE_DWELL_MS = 600;

export type EditorialGestureState =
  | 'READING'
  | 'EDITING'
  | 'MEDIA_SELECTED'
  | 'MEDIA_DRAGGING'
  | 'EDGE_PAGING'
  | 'DROP';

export type EditorialEdge = 'left' | 'right';

export type EditorialGesture = {
  state: EditorialGestureState;
  /** The picture this gesture is about, or nothing. */
  blockId: string | null;
  /** The page the article stands on: the one the drop is measured from. */
  page: number;
  dx: number;
  dy: number;
  /** Which margin the finger is held in, when it is held in one. */
  edge: EditorialEdge | null;
  /** How many pages this one gesture has turned, so a long carry can be read as a number. */
  turned: number;
};

export const editorialGestureIdle: EditorialGesture = {
  state: 'READING',
  blockId: null,
  page: 0,
  dx: 0,
  dy: 0,
  edge: null,
  turned: 0,
};

export type EditorialGestureEvent =
  /** A caret was placed in the words: the composer is being edited. */
  | { type: 'edit' }
  /** A picture was chosen. */
  | { type: 'select'; blockId: string; page: number }
  /** The finger took the picture, in the page the article is showing. */
  | { type: 'begin'; blockId: string; page: number; dx?: number; dy?: number; edge?: EditorialEdge | null }
  /** The finger moved: `dx`/`dy` are its offsets, `edge` the margin it is held in (or `null`). */
  | { type: 'move'; dx: number; dy: number; edge?: EditorialEdge | null }
  /** The dwell elapsed while the finger was held in a margin. */
  | { type: 'dwell'; pages: number }
  /** Let go. */
  | { type: 'release' }
  /** A gesture was taken away (a second finger, a scroll, a closing sheet). */
  | { type: 'cancel' }
  /** The drop has been applied: the machine goes back to reading. */
  | { type: 'clear' };

const DRAGGING: readonly EditorialGestureState[] = ['MEDIA_DRAGGING', 'EDGE_PAGING'];

/** Which margin a finger is held in, in page coordinates. A band of zero never answers. */
export function editorialEdge(fingerX: number, width: number, band = EDITORIAL_EDGE_BAND): EditorialEdge | null {
  const x = Number(fingerX);
  const size = Math.max(0, Number(width) || 0);
  const reach = Math.max(0, Number(band) || 0);
  if (!Number.isFinite(x) || size <= 0 || reach <= 0) return null;
  if (x <= reach) return 'left';
  if (x >= size - reach) return 'right';
  return null;
}

/** The one step of the machine. An event the current state cannot mean is a no-op, never a state. */
export function editorialGesture(state: EditorialGesture, event: EditorialGestureEvent): EditorialGesture {
  const current = state ?? editorialGestureIdle;
  switch (event.type) {
    case 'edit':
      if (DRAGGING.includes(current.state)) return current;
      return { ...editorialGestureIdle, state: 'EDITING', page: current.page };
    case 'select':
      if (DRAGGING.includes(current.state)) return current;
      return { ...editorialGestureIdle, state: 'MEDIA_SELECTED', blockId: event.blockId, page: Math.max(0, event.page) };
    case 'begin':
      return {
        state: 'MEDIA_DRAGGING',
        blockId: event.blockId,
        page: Math.max(0, event.page),
        dx: Number(event.dx) || 0,
        dy: Number(event.dy) || 0,
        edge: event.edge ?? null,
        turned: 0,
      };
    case 'move': {
      if (!DRAGGING.includes(current.state)) return current;
      const edge = event.edge ?? null;
      /**
       * Held in a margin is its own state: that is what arms the dwell, and what the pager watches. Leaving
       * the margin disarms it without moving the picture a single point.
       */
      const next: EditorialGestureState = edge ? 'EDGE_PAGING' : 'MEDIA_DRAGGING';
      return { ...current, state: next, dx: Number(event.dx) || 0, dy: Number(event.dy) || 0, edge };
    }
    case 'dwell': {
      if (current.state !== 'EDGE_PAGING' || !current.edge) return current;
      const pages = Math.max(1, Math.trunc(Number(event.pages) || 1));
      const step = current.edge === 'right' ? 1 : -1;
      const page = Math.max(0, Math.min(pages - 1, current.page + step));
      /** The first page's left margin and the last page's right margin have nowhere to go. */
      if (page === current.page) return current;
      return { ...current, page, turned: current.turned + 1 };
    }
    case 'release':
      if (!DRAGGING.includes(current.state)) return current;
      return { ...current, state: 'DROP' };
    case 'cancel':
      return { ...editorialGestureIdle, page: current.page };
    case 'clear':
      return { ...editorialGestureIdle, page: current.page };
    default:
      return current;
  }
}

/**
 * The article's own vertical axis for a finger that has carried a picture across pages.
 *
 * Pages are stacked one under another in the flow engine (`flowEditorialDocument`), so a point inside the
 * page the article is *currently showing* stands at `page * pageHeight + y` on the article's axis. That is
 * the number `nearestLine` needs, and it is why the page the pager is on belongs to the gesture rather
 * than to the picture: the picture stays where it was authored while the article turns under the finger.
 */
export function editorialDropLine(page: number, pageHeight: number, y: number): number {
  const height = Math.max(0, Number(pageHeight) || 0);
  return Math.max(0, Math.trunc(Number(page) || 0)) * height + (Number(y) || 0);
}

