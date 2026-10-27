/**
 * The authored look of a text post: the palette, the face and the measure the author chose for a page
 * of words that has no picture to carry it.
 *
 * A text post used to be drawn by the client from its own defaults (`PostCanvas`), so the same words
 * opened on two phones could read differently. The style is now a property of the post, written once
 * with it and validated here exactly as it will be validated by the native composer
 * (`apps/nexus-mobile/src/lib/textStyle.ts`) before anything leaves the phone.
 *
 * Only six named themes are offered, and a theme's colours are part of its definition on both sides:
 * the server stores the pair the author picked, but refuses any colour the palette does not contain,
 * so a hand-made request can neither smuggle a transparent page nor a token swap into the feed.
 */

import { normalizeEditorialDocument } from './post-editorial-document.js';

export const TEXT_THEMES = Object.freeze(['jungle', 'paper', 'midnight', 'ember', 'moss', 'ink']);
export const TEXT_FONTS = Object.freeze(['serif', 'sans', 'mono']);
export const TEXT_SIZES = Object.freeze(['small', 'medium', 'large']);
export const TEXT_ALIGNS = Object.freeze(['left', 'center']);

/** `{ background, text }` per theme; the accent is a client-side decoration, never stored. */
export const TEXT_THEME_PALETTE = Object.freeze({
  jungle: Object.freeze({ background: '#0b1f16', text: '#f2efe4' }),
  paper: Object.freeze({ background: '#f4efe2', text: '#1a221b' }),
  midnight: Object.freeze({ background: '#0a0f1c', text: '#e8eef7' }),
  ember: Object.freeze({ background: '#2a120b', text: '#fbeadf' }),
  moss: Object.freeze({ background: '#16301f', text: '#eaf3e6' }),
  ink: Object.freeze({ background: '#101214', text: '#f5f5f5' }),
});

export const TEXT_STYLE_DEFAULTS = Object.freeze({
  theme: 'jungle', font: 'serif', size: 'medium', align: 'left',
  background: TEXT_THEME_PALETTE.jungle.background,
  text: TEXT_THEME_PALETTE.jungle.text,
  media: Object.freeze({ scale: 1, x: 0, y: 0 }),
});

const TEXT_MEDIA_SCALE_MIN = 0.45;
const TEXT_MEDIA_SCALE_MAX = 1.2;
const TEXT_MEDIA_X_LIMIT = 0.4;
const TEXT_MEDIA_Y_MIN = -0.25;
const TEXT_MEDIA_Y_MAX = 0.45;

/**
 * The lead block of an article: geometry only, held inside the page. The native composer sends the
 * same numbers, so a page arranged with a finger on the phone is the page the feed draws later.
 */
function normalizeMediaFrame(value) {
  if (value === undefined) return { ...TEXT_STYLE_DEFAULTS.media };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('TEXT_STYLE_INVALID');
  const keys = Object.keys(value);
  if (keys.some((key) => !['scale', 'x', 'y'].includes(key))
    || ['scale', 'x', 'y'].some((key) => !Number.isFinite(value[key]))) {
    throw new Error('TEXT_STYLE_INVALID');
  }
  const { scale, x, y } = value;
  if (scale < TEXT_MEDIA_SCALE_MIN || scale > TEXT_MEDIA_SCALE_MAX
    || x < -TEXT_MEDIA_X_LIMIT || x > TEXT_MEDIA_X_LIMIT
    || y < TEXT_MEDIA_Y_MIN || y > TEXT_MEDIA_Y_MAX) throw new Error('TEXT_STYLE_INVALID');
  const round = (number) => Math.round(number * 1000) / 1000;
  return { scale: round(scale), x: round(x), y: round(y) };
}

const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Strict normalization. `null`/`undefined` mean "no authored style" and stay `null`, which is what
 * keeps the content commitment of every post written before this column byte-for-byte unchanged.
 * A present object must name only known keys; a missing key takes the default of its theme.
 */
export function normalizeTextStyle(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('TEXT_STYLE_INVALID');
  if (Object.keys(value).some((key) => !Object.hasOwn(TEXT_STYLE_DEFAULTS, key) && key !== 'document')) {
    throw new Error('TEXT_STYLE_INVALID');
  }
  const theme = value.theme === undefined ? TEXT_STYLE_DEFAULTS.theme : value.theme;
  if (!TEXT_THEMES.includes(theme)) throw new Error('TEXT_STYLE_INVALID');
  const palette = TEXT_THEME_PALETTE[theme];
  // A missing member takes the default of the theme that was chosen, not of the reference theme.
  const result = {
    theme,
    font: value.font === undefined ? TEXT_STYLE_DEFAULTS.font : value.font,
    size: value.size === undefined ? TEXT_STYLE_DEFAULTS.size : value.size,
    align: value.align === undefined ? TEXT_STYLE_DEFAULTS.align : value.align,
    background: value.background === undefined ? palette.background : value.background,
    text: value.text === undefined ? palette.text : value.text,
    media: normalizeMediaFrame(value.media),
  };
  if (!TEXT_FONTS.includes(result.font)) throw new Error('TEXT_STYLE_INVALID');
  if (!TEXT_SIZES.includes(result.size)) throw new Error('TEXT_STYLE_INVALID');
  if (!TEXT_ALIGNS.includes(result.align)) throw new Error('TEXT_STYLE_INVALID');
  if (typeof result.background !== 'string' || !COLOR.test(result.background)) throw new Error('TEXT_STYLE_INVALID');
  if (typeof result.text !== 'string' || !COLOR.test(result.text)) throw new Error('TEXT_STYLE_INVALID');
  result.background = result.background.toLowerCase();
  result.text = result.text.toLowerCase();
  // The pair must be the theme's own pair: a request may choose a theme, never repaint it.
  if (result.background !== palette.background || result.text !== palette.text) throw new Error('TEXT_STYLE_INVALID');
  if (value.document !== undefined) {
    try {
      result.document = normalizeEditorialDocument(value.document);
    } catch {
      throw new Error('TEXT_STYLE_INVALID');
    }
  }
  return result;
}

/** The tolerant reader of a stored row: a malformed style is "no style", never a failed feed. */
export function textStyleFromRow(row) {
  if (!row?.text_style_json) return null;
  try { return normalizeTextStyle(JSON.parse(row.text_style_json)); } catch { return null; }
}
