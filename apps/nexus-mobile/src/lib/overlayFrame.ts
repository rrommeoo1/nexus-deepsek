/**
 * The one coordinate system a text over a clip stands in — the composer's preview and the published
 * post both read it, so what the author drags is what the reader sees.
 *
 * Round 41 (owner, 31 October 2026): „adaug text pe un video și previzualizarea arată altfel decât
 * postarea — textul devine prea mare, stă în alt loc, iese din ecran". The two surfaces measured the
 * same words against two different rectangles:
 *
 *   · the composer drew the media `contain` inside a centred 9:16 box as wide as the phone, and set the
 *     plain overlay text at a fixed 27 points, in a dark box, with 8 points of padding;
 *   · the published reel draws the media `cover` inside the page — which on a 469×1021 phone is a
 *     **574×1021** content rectangle, 105dp wider than the box the author dragged in — and sets the same
 *     words at `frameWidth × 0.07` (40 points) with the creator sheet's own 9/5 padding and no box.
 *
 * A text at 40 % of a 469-wide box therefore lands on a different part of the picture than a text at
 * 40 % of the 574-wide rectangle the reader gets, and it arrives 13 points larger. Nothing here is a
 * style opinion: the media rectangle is geometry (`object-fit: cover` / `contain`, the rule the phone
 * already follows in `PostMedia`), and the type is `theme/creator.ts` — the creator sheet transcribed
 * from `reel-camera-surface.css:153-158`, which the published decorations already obey.
 *
 * Pure by design: it imports only the creator tokens (a plain object), so `scripts/test-overlay-frame.cjs`
 * loads it in plain Node.
 */

import { creatorTokens } from '../theme/creator';

/** How a piece of media fills the room it is drawn in (`MediaFit` of `PostMedia`). */
export type OverlayFit = 'cover' | 'contain';

/** A rectangle in the page's own points, absolute inside the room it was measured in. */
export type OverlayRect = { width: number; height: number; left: number; top: number };

/** The kinds of decoration a manifest may carry and the phone knows how to draw. */
export type OverlayKind = 'TEXT' | 'TIME' | 'DATE' | 'LOCATION';

/** The kinds that are drawn as a label over the picture (`PostDecorations`, `studioManifest`). */
export const OVERLAY_KINDS: readonly OverlayKind[] = ['TEXT', 'TIME', 'DATE', 'LOCATION'];

/**
 * The rectangle the *content* occupies inside the room that shows it.
 *
 * `width`/`height` are the room (the page, the preview surface), `ratio` is the content's own width over
 * height (the manifest's `transform.ratio`: `9/16` for a reel, `3/4` for a photo post), and `fit` is the
 * rule the surface draws it with:
 *
 *   · `cover`  — the content fills the room and is cropped: the rectangle is the smallest one of that
 *               ratio that covers the room, so it is **larger** than the room on the short side;
 *   · `contain` — the whole frame is kept: the largest rectangle of that ratio that fits, so there are
 *               two bands of field around it.
 *
 * Both cases return the rectangle centred in the room, which is exactly what `object-fit` does. A
 * caller positions its overlays inside this rectangle and nowhere else — this is the number that used to
 * be missing between the composer and the reader.
 */
export function mediaContentRect(input: {
  width: number;
  height: number;
  ratio?: number;
  fit?: OverlayFit;
}): OverlayRect {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);
  const ratio = Number(input.ratio) > 0 ? Number(input.ratio) : 9 / 16;
  if (!width || !height) return { width: 0, height: 0, left: 0, top: 0 };
  const fit = input.fit === 'contain' ? 'contain' : 'cover';
  const rectHeight = fit === 'cover'
    ? Math.max(width / ratio, height)
    : Math.min(width / ratio, height);
  const rectWidth = rectHeight * ratio;
  return {
    width: rectWidth,
    height: rectHeight,
    left: (width - rectWidth) / 2,
    top: (height - rectHeight) / 2,
  };
}

/**
 * Cât de mică poate coborî mărimea unui sticker când compoziția însăși se micșorează (runda 49).
 *
 * `scale` este micșorarea cutiei (1 = pagina întreagă, 0,48 = previzualizarea de deasupra foii de
 * comentarii). Toate **plafoanele** tipografiei se înmulțesc cu ea, fiindcă un plafon este o măsură a
 * paginii: altfel `minFontSize: 23` — gândit pentru un telefon cu pagina întreagă — rămâne 23 și într-o
 * cutie la jumătate, iar stickerul iese cu 17 % mai mare decât compoziția din jur (măsurat pe telefon în
 * runda 48: 547 px în loc de 585 × 0,48). Rezultatul este exact pagina micșorată: același raport, aceeași
 * poziție în procente.
 */
function overlayScaleOf(scale?: number): number {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value > 1 ? 1 : value;
}

/**
 * The type size of a label, from the **content rectangle's** width — never the phone's, never the
 * preview box's. A place is set smaller than a text (`locationViewportFontRatio` of the sheet), and both
 * are held between the sheet's own bounds so a very small cell or a very large tablet still says the
 * same words at a readable size.
 *
 * `scale` (round 49) shrinks those bounds with the composition, so a reduced preview is the page times
 * that factor and not "the page's minimum", which is what made a sticker look oversized in the sheet.
 */
export function overlayFontSize(kind: OverlayKind, frameWidth: number, scale = 1): number {
  const width = Math.max(0, Number(frameWidth) || 0);
  const factor = overlayScaleOf(scale);
  const sheet = creatorTokens.decoration;
  if (kind === 'LOCATION') {
    return Math.min(sheet.locationMaxFontSize * factor, Math.max(sheet.locationMinFontSize * factor, width * sheet.locationViewportFontRatio));
  }
  return Math.min(sheet.maxFontSize * factor, Math.max(sheet.minFontSize * factor, width * sheet.viewportFontRatio));
}

/** The padding the sheet gives a label of this kind (a clock keeps more air than a sentence). */
export function overlayPadding(kind: OverlayKind, scale = 1): { horizontal: number; vertical: number } {
  const sheet = creatorTokens.decoration;
  const factor = overlayScaleOf(scale);
  return kind === 'TIME' || kind === 'DATE'
    ? { horizontal: sheet.timeHorizontalPadding * factor, vertical: sheet.timeVerticalPadding * factor }
    : { horizontal: sheet.horizontalPadding * factor, vertical: sheet.verticalPadding * factor };
}

/**
 * Colțul unei etichete: pastila unei locații este rotunjită, un text nu. Rotunjimea este și ea o măsură a
 * paginii, deci se micșorează cu ea (runda 49).
 */
export function overlayRadius(kind: OverlayKind, scale = 1): number {
  return kind === 'LOCATION' ? 22 * overlayScaleOf(scale) : 0;
}

/** Umbra subțire care ține un text alb lizibil pe o poză deschisă, micșorată cu compoziția. */
export function overlayShadowRadius(scale = 1): number {
  return 7 * overlayScaleOf(scale);
}

/** Spațierea dintre cifrele unui ceas sau ale unei date, micșorată cu compoziția. */
export function overlayLetterSpacing(kind: OverlayKind, scale = 1): number {
  return kind === 'TIME' || kind === 'DATE' ? 1 * overlayScaleOf(scale) : 0;
}

/**
 * How much of the content rectangle a label may take, as a fraction: a placed location may be wider than
 * a sentence because it is one pill on one line.
 */
/**
 * How wide a label may be, as a share of the content rectangle.
 *
 * Runda 50: `scale` is divided out, because the label is drawn at that factor *after* it was measured —
 * a text allowed 78 % of the picture and then grown by 1.8 overflowed its own box, stayed on one line and
 * was cut by the screen edge. The box a label asks for is therefore `share ÷ scale`, so what it finally
 * covers is `share`.
 */
export function overlayMaxWidth(kind: OverlayKind, scale = 1): number {
  const share = kind === 'LOCATION' ? 0.86 : 0.78;
  const factor = Number(scale) > 0 ? Number(scale) : 1;
  return share / factor;
}

/**
 * Where a label may be dragged, as a fraction of the content rectangle.
 *
 * The same two numbers the composer has always clamped to (`MovableText`), named once so a published
 * label and a dragged one cannot end up outside the picture: at 0 or 1 half of the label would hang over
 * the crop edge.
 */
export const OVERLAY_LIMITS = { min: 0.08, max: 0.92 } as const;

/** A fraction of the content rectangle, held inside `OVERLAY_LIMITS`. */
export function clampOverlayPosition(value: number): number {
  const fraction = Number(value);
  if (!Number.isFinite(fraction)) return 0.5;
  return Math.max(OVERLAY_LIMITS.min, Math.min(OVERLAY_LIMITS.max, fraction));
}

/**
 * Where the **centre** of a label really stands: at its own fraction of the content rectangle, held
 * inside the part of that rectangle the screen can show.
 *
 * `size` is the label as it was measured, *before* `scale` (a decoration carries its size as a factor),
 * so the room the label needs is `size * scale`: a text enlarged to 1.8 in the composer was measured at
 * 1, and a clamp computed from the measured width let it hang over the crop — the frog sticker at `x: 22`
 * and the ``Runda 50`` line at `x: 78` were both half cut on the owner's phone (round 50). A label wider
 * than the window is centred in it instead of pinned to an edge, which is the same rule the window itself
 * already stated for the vertical axis.
 *
 * The module stays pure, so `scripts/test-overlay-frame.cjs` proves the arithmetic without a phone.
 */
export function overlayHeldSpot(input: {
  /** The label's fraction of the content rectangle (0â€“1). */
  point: { x: number; y: number };
  /** The label's measured box, before `scale`. */
  size: { width: number; height: number };
  /** The visible part of the content rectangle, in the rectangle's own coordinates (`overlayWindow`). */
  window: { left: number; top: number; right: number; bottom: number };
  rect: { width: number; height: number };
  /** The decoration's own factor (`StudioDecoration.scale`). */
  scale?: number;
}): { x: number; y: number } {
  const factor = Number(input.scale) > 0 ? Number(input.scale) : 1;
  const width = Math.max(0, Number(input.rect?.width) || 0);
  const height = Math.max(0, Number(input.rect?.height) || 0);
  const centreX = (Number(input.point?.x) || 0) * width;
  const centreY = (Number(input.point?.y) || 0) * height;
  const spanX = Math.max(0, Number(input.size?.width) || 0) * factor;
  const spanY = Math.max(0, Number(input.size?.height) || 0) * factor;
  const window = input.window;
  const lowX = window.left + spanX / 2;
  const highX = window.right - spanX / 2;
  const lowY = window.top + spanY / 2;
  const highY = window.bottom - spanY / 2;
  return {
    x: highX < lowX ? (window.left + window.right) / 2 : Math.max(lowX, Math.min(highX, centreX)),
    y: highY < lowY ? (window.top + window.bottom) / 2 : Math.max(lowY, Math.min(highY, centreY)),
  };
}

/**
 * A fraction as the manifest stores it: whole percent, 0–100.
 *
 * The manifest is the record the server verifies and the reader replays, so the conversion lives here
 * and both directions use this one function.
 */
export function overlayPercent(fraction: number): number {
  return Math.max(0, Math.min(100, Math.round(clampOverlayPosition(fraction) * 100)));
}

/** The same number read back as a fraction of the content rectangle. */
export function overlayFraction(percent: number): number {
  const value = Number(percent);
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value / 100));
}

/**
 * The part of the content rectangle that the room can actually show, in the rectangle's own coordinates.
 *
 * A `cover` rectangle is **wider than the phone** (574 against 469 on the development device), so its two
 * outer columns are cropped away by the screen. A label placed there used to be half a word on the
 * reader's phone while the author had seen it whole in an editor that measured a smaller box; the layer
 * keeps every label inside this window (`components/PostOverlay`), in both surfaces, from these numbers.
 */
export function overlayWindow(input: {
  width: number;
  height: number;
  rect: OverlayRect;
}): { left: number; top: number; right: number; bottom: number } {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);
  const rect = input.rect;
  return {
    left: Math.max(0, -rect.left),
    top: Math.max(0, -rect.top),
    right: Math.min(rect.width, width - rect.left),
    bottom: Math.min(rect.height, height - rect.top),
  };
}
