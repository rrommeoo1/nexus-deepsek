/**
 * The gesture vocabulary the Social surface answers to, ported from the module the phone browser loads
 * (`apps/nexus-web/public/social-gesture.js`) and from the two places `app.js` spends it:
 *
 *   app.js:2960-3030  `wireSocialChannelSwipe()` — a clearly horizontal flick walks the three readings
 *                     (`activateFeedMode(nextFeedMode(feedMode, offset))`, app.js:2999), and a pull at the
 *                     top of the column asks for a refresh (app.js:2983-2995). A gesture that starts on
 *                     `button,input,textarea,select,a,.comments,.reactionBar,.clipMoreActions` is ignored,
 *                     and the click that would follow it is suppressed (app.js:2985, 2998).
 *   app.js:5120-5132  the media viewer — one step per flick, `decideViewerGesture` choosing the axis the
 *                     reader meant, and the step wrapping at both ends of the gallery.
 *
 * The numbers are the web's own: 64px of pull, 72px of travel, 48px inside the viewer, and the ratios
 * 1.15 / 1.2 that decide which axis a diagonal meant. Nothing here reads or writes state, so the screens
 * own the scrolling and the rendering while the vocabulary stays in one place.
 */

/** `pullThreshold` of `decideSocialGesture` — how far the column has to be pulled at its top. */
export const PULL_THRESHOLD = 64;
/** `swipeThreshold` of `decideSocialGesture` — how far a horizontal flick has to travel. */
export const SWIPE_THRESHOLD = 72;
/** `swipeThreshold` of `decideViewerGesture` — how far a flick has to travel inside the media viewer. */
export const VIEWER_SWIPE_THRESHOLD = 48;

/** What a finished gesture on the feed surface means: nothing, a refresh, or one place along the rail. */
export type SocialGestureDecision =
  | { action: 'none' }
  | { action: 'refresh' }
  | { action: 'channel'; offset: 1 | -1 };

/** What a finished flick inside the media viewer means: nothing, or one step along the axis it meant. */
export type ViewerGestureDecision =
  | { action: 'none' }
  | { action: 'step'; axis: 'horizontal' | 'vertical'; offset: 1 | -1 };

/**
 * `decideSocialGesture` of `social-gesture.js:1-13`, decision for decision. `scrollTop` is where the feed
 * column stands, so a pull only counts at its very top; a value that is not a number answers `none`, which
 * is what keeps a half-built gesture from ever moving the reader.
 */
export function decideSocialGesture({
  dx,
  dy,
  scrollTop,
  pullThreshold = PULL_THRESHOLD,
  swipeThreshold = SWIPE_THRESHOLD,
}: {
  dx?: number;
  dy?: number;
  scrollTop?: number;
  pullThreshold?: number;
  swipeThreshold?: number;
} = {}): SocialGestureDecision {
  const horizontal = Number(dx);
  const vertical = Number(dy);
  const top = Number(scrollTop);
  if (![horizontal, vertical, top, pullThreshold, swipeThreshold].every(Number.isFinite)) return { action: 'none' };
  if (top <= 1 && vertical >= pullThreshold && Math.abs(vertical) > Math.abs(horizontal) * 1.15) {
    return { action: 'refresh' };
  }
  if (Math.abs(horizontal) >= swipeThreshold && Math.abs(horizontal) > Math.abs(vertical) * 1.2) {
    return { action: 'channel', offset: horizontal < 0 ? 1 : -1 };
  }
  return { action: 'none' };
}

/** `decideViewerGesture` of `social-gesture.js:15-24`, decision for decision. */
export function decideViewerGesture({
  dx,
  dy,
  swipeThreshold = VIEWER_SWIPE_THRESHOLD,
}: {
  dx?: number;
  dy?: number;
  swipeThreshold?: number;
} = {}): ViewerGestureDecision {
  const horizontal = Number(dx);
  const vertical = Number(dy);
  const threshold = Number(swipeThreshold);
  if (![horizontal, vertical, threshold].every(Number.isFinite) || threshold <= 0) return { action: 'none' };
  if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < threshold) return { action: 'none' };
  const axis = Math.abs(horizontal) > Math.abs(vertical) ? 'horizontal' : 'vertical';
  const delta = axis === 'horizontal' ? horizontal : vertical;
  return { action: 'step', axis, offset: delta < 0 ? 1 : -1 };
}
