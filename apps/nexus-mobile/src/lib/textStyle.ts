/**
 * The authored look of a text post, on the phone.
 *
 * `apps/nexus-web/lib/post-text-style.js` is the server's copy of these rules; the two files must
 * agree on the theme ids and on the pairs of colours, because the server stores the pair it was
 * given only when it is the pair of the chosen theme. Keeping the check here as well means a draft
 * can never carry a look the publish would refuse, and the composer can show it before sending.
 *
 * This module imports only the pure editorial-document normalizer; it is still loadable by the Node
 * test harness through a TypeScript transpile, the same way `postPresentation.ts` is.
 */

import { readEditorialDocument, type EditorialDocument } from './editorialDocument';
import type { PageMode } from './pageMode';

export type TextThemeId = 'jungle' | 'paper' | 'midnight' | 'ember' | 'moss' | 'ink';
/**
 * The faces a page can be set in.
 *
 * `serif`, `sans` and `mono` are the three the composer offered since the first page. The three added in
 * the text-integrity round were checked against `/system/etc/fonts.xml` on the owner's Xiaomi before
 * being offered: every one of them resolves to a *different* typeface on the phone, so a menu entry is a
 * face the author can see and not a synonym of another:
 *
 * - `slab` — `serif-monospace` (Noto Serif Mono): a typewriter, wide and even;
 * - `casual` — `casual` (CommingSoon): the hand-written face, for a note rather than an article;
 * - `condensed` — `sans-serif-condensed` (Roboto Condensed): narrower letters, more words per line.
 *
 * A family the phone does not have falls back to its own default (see `fontFamilyFor`), so an old Android
 * draws the page in its reading face instead of drawing nothing.
 */
export type TextFontId = 'serif' | 'sans' | 'mono' | 'slab' | 'casual' | 'condensed';
export type TextSizeId = 'small' | 'medium' | 'large' | 'xlarge';
export type TextAlignId = 'left' | 'center';
export type TextPlatform = 'ios' | 'android' | 'web' | 'default';

/**
 * Where the legacy lead picture (or clip) of a pre-document article sits, and how large it is.
 *
 * New pages place media through `document` (media blocks with their own placement and width). This
 * frame remains the geometry of an older post that has no document yet: the reader still reserves its
 * bounded room on the first page, so those pages keep reading exactly as they did before documents
 * existed.
 */
export type TextMediaFrame = {
  scale: number;
  x: number;
  y: number;
};

export const TEXT_MEDIA_FRAME_DEFAULT: Readonly<TextMediaFrame> = Object.freeze({ scale: 1, x: 0, y: 0 });
export const TEXT_MEDIA_SCALE_MIN = 0.45;
export const TEXT_MEDIA_SCALE_MAX = 1.2;
export const TEXT_MEDIA_X_LIMIT = 0.4;
export const TEXT_MEDIA_Y_MIN = -0.25;
export const TEXT_MEDIA_Y_MAX = 0.45;

export type TextStyle = {
  theme: TextThemeId;
  font: TextFontId;
  size: TextSizeId;
  align: TextAlignId;
  background: string;
  text: string;
  /** The framed lead block; absent in an older row, which reads as `TEXT_MEDIA_FRAME_DEFAULT`. */
  media: TextMediaFrame;
  /**
   * The editorial document of a page written after blocks existed. Absent on every older row, which
   * is why those pages keep their legacy composition instead of being reinterpreted.
   */
  document?: EditorialDocument | null;
};

/**
 * The colours of a page of words, whoever wrote it.
 *
 * Not the palette of a theme: a page's paper and its ink are the product's, and only what decorates it
 * is the author's (`pagePaletteOf`).
 */
export type TextPagePalette = {
  /** The one paper, `TEXT_THEMES.paper`'s — never a theme's background. */
  background: string;
  /** The page's ink: what a page of words is read in. */
  text: string;
  /** The paper's own accent, for words that must be *read*: a tag, a mention, a link, the caret. */
  mark: string;
  /** The author's accent, kept as the page's only decoration: a hairline, a rule, the frame of a chip. */
  accent: string;
};

export const TEXT_THEME_IDS: readonly TextThemeId[] = ['jungle', 'paper', 'midnight', 'ember', 'moss', 'ink'];
export const TEXT_FONT_IDS: readonly TextFontId[] = ['serif', 'sans', 'mono', 'slab', 'casual', 'condensed'];
export const TEXT_SIZE_IDS: readonly TextSizeId[] = ['small', 'medium', 'large', 'xlarge'];
export const TEXT_ALIGN_IDS: readonly TextAlignId[] = ['left', 'center'];

/** The editor's own cap on a text post (`POST /api/posts` keeps the same ceiling for a text page). */
export const TEXT_MAX_CHARS = 20000;

export const TEXT_THEMES: readonly { id: TextThemeId; label: string; background: string; text: string; accent: string }[] = [
  { id: 'jungle', label: 'Jungle', background: '#0b1f16', text: '#f2efe4', accent: '#c9a227' },
  { id: 'paper', label: 'Hârtie', background: '#f4efe2', text: '#1a221b', accent: '#2f5d45' },
  { id: 'midnight', label: 'Miez de noapte', background: '#0a0f1c', text: '#e8eef7', accent: '#5fa8d3' },
  { id: 'ember', label: 'Jar', background: '#2a120b', text: '#fbeadf', accent: '#e07a3f' },
  { id: 'moss', label: 'Mușchi', background: '#16301f', text: '#eaf3e6', accent: '#9ccb6e' },
  { id: 'ink', label: 'Cerneală', background: '#101214', text: '#f5f5f5', accent: '#b8b8b8' },
];

/**
 * The page a text post opens on before its author picks a look.
 *
 * The owner's ruling (26 October 2026): a page of words is paper, not a coloured screen — the e-paper
 * reading he asked for is the *default*, and a theme is something an author opts into. `paper` is warm
 * paper with dark ink, which is also the pair the profile cell paints (`ProfileTextTile`), so the
 * composer, the feed and the wall open on the same page instead of three different ones.
 *
 * The server holds the same default (`apps/nexus-web/lib/post-text-style.js`), and
 * `scripts/test-text-style.cjs` compares the two objects field by field: a phone that defaulted to one
 * theme while the server stored another would make a publish fail on a look nobody chose.
 */
export const TEXT_DEFAULT_THEME: TextThemeId = 'paper';

/**
 * The one paper of the product — "paper everywhere" (owner's decision, 27 October 2026).
 *
 * Six themes are offered and *none of them is a page*. A theme is what an author writes in: it may
 * change the accent the page is marked with (the hairline above a title, the rule at the head of the
 * article, the frame of a chip), the face, the measure and the alignment. The paper under all of them
 * — in the composer, in the feed, on the wall's cell and in the full reader — is this one, inked with
 * this theme's dark text. A dark text page is not something this product can draw any more, for a row
 * stored months ago (the old `jungle` default) or for one typed this evening. That rule is applied
 * when a page is painted (`pagePaletteOf`), so no stored row is rewritten and no user content is
 * touched to get the new page.
 */
export const TEXT_PAGE_THEME: TextThemeId = 'paper';

export const TEXT_FONTS: readonly { id: TextFontId; label: string }[] = [
  { id: 'serif', label: 'Serif' },
  { id: 'sans', label: 'Sans' },
  { id: 'mono', label: 'Mono' },
  { id: 'slab', label: 'Mașină' },
  { id: 'casual', label: 'De mână' },
  { id: 'condensed', label: 'Îngust' },
];

/**
 * `size` is the measure of the 9:16 page: a small one, the reference one and a poster one.
 *
 * Each size is 5–8 % smaller than it was until 29 October 2026 (owner: „textul e prea mare, vreau mai
 * compact, dar să rămână lizibil"), and every line height is tighter by the same step, because a page of
 * words is read as an article and not as a caption: on the owner's 469 dp phone the reference page used to
 * set 24 dp type on 34 dp lines (1.42) and now sets 22 dp on 31 dp (1.41) — 9 % more words per line at the
 * same measure, and a page that reads denser without losing its air. The pagination is computed from these
 * numbers (`editorialFlow`), so a page re-flowed at the new size is still one page per screen.
 */
export const TEXT_SIZES: readonly { id: TextSizeId; label: string; fontSize: number; lineHeight: number }[] = [
  { id: 'small', label: 'Mic', fontSize: 19, lineHeight: 28 },
  { id: 'medium', label: 'Mediu', fontSize: 22, lineHeight: 31 },
  { id: 'large', label: 'Mare', fontSize: 28, lineHeight: 39 },
  /**
   * The poster step (text-integrity round). It keeps the same leading ratio as the other three (1.38),
   * because a bigger page is still a page and not a headline with the lines pushed together.
   */
  { id: 'xlarge', label: 'Foarte mare', fontSize: 34, lineHeight: 47 },
];

export const TEXT_ALIGNS: readonly { id: TextAlignId; label: string }[] = [
  { id: 'left', label: 'Stânga' },
  { id: 'center', label: 'Centru' },
];

/**
 * The emoji the composer offers above the keyboard, in the groups the picker shows.
 *
 * Lifted from a row above one small input into a real picker in the text-integrity round. The set is
 * *local*: no network, no dependency (`rn-emoji-keyboard` was checked and is not in the manifest, and a
 * picker that fetches a font or a list is a picker that stops working on a bad connection). Every
 * sequence here is drawn by the system font on both platforms, which is why emoji carrying a skin tone or
 * a zero-width-joiner family are left out — they are the ones phones disagree about.
 */
export const TEXT_EMOJI_GROUPS: readonly { id: string; label: string; emoji: readonly string[] }[] = [
  {
    id: 'chipuri',
    label: 'Chipuri',
    emoji: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
      '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😬',
      '🙄', '😯', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
      '🤮', '🤧', '😷', '🤒', '🤕', '🤠', '😈', '💩', '👻', '💀', '👽', '🤖',
    ],
  },
  {
    id: 'gesturi',
    label: 'Gesturi',
    emoji: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🫂', '👀',
      '👁️', '👄', '👂', '👃', '🧠', '🫀', '🦷', '🦴', '👶', '🧒', '🧓', '👴',
    ],
  },
  {
    id: 'animale',
    label: 'Animale',
    emoji: [
      '🐅', '🐆', '🐘', '🦏', '🦛', '🐊', '🐍', '🦎', '🐢', '🦜', '🦚', '🦩',
      '🦉', '🦅', '🐒', '🦍', '🦧', '🐐', '🦌', '🐃', '🐎', '🐏', '🦙', '🐕',
      '🐈', '🐇', '🦇', '🦔', '🦦', '🦥', '🐌', '🐛', '🦗', '🐝', '🐞', '🐜',
      '🦋', '🕷️', '🐟', '🐠', '🐡', '🦈', '🐬', '🐳', '🦭', '🐙', '🦐', '🦞',
      '🦀', '🐚', '🐸', '🪶',
    ],
  },
  {
    id: 'plante',
    label: 'Plante',
    emoji: [
      '🌿', '🌱', '🍃', '🍂', '🍁', '🌳', '🌲', '🪵', '🌴', '🌵', '🌾', '🌺',
      '🌻', '🌹', '🌷', '🪷', '🌸', '💐', '🍄', '🪴', '🍀', '☘️', '🪻', '🌼',
    ],
  },
  {
    id: 'cer',
    label: 'Cer și foc',
    emoji: [
      '🌞', '🌝', '🌚', '🌙', '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '☄️',
      '🌈', '☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '🌨️', '❄️', '⛄', '💨', '💧',
      '💦', '🌊', '🫧', '☔',
    ],
  },
  {
    id: 'mancare',
    label: 'Mâncare',
    emoji: [
      '☕', '🍵', '🧉', '🥤', '🧃', '🍯', '🥭', '🍌', '🍎', '🍐', '🍊', '🍋',
      '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶️',
      '🌽', '🥕', '🍆', '🥔', '🥜', '🍞', '🥐', '🥖', '🥨', '🧀', '🥚', '🍳',
      '🥞', '🥓', '🍗', '🌭', '🍔', '🍟', '🍕', '🌮', '🍝', '🍜', '🍲', '🥗',
      '🍿', '🥫',
    ],
  },
  {
    id: 'obiecte',
    label: 'Obiecte',
    emoji: [
      '📖', '📚', '📕', '📗', '📘', '📙', '📓', '📒', '📝', '✏️', '🖊️', '🖋️',
      '🖌️', '🖍️', '📷', '📸', '📹', '🎥', '🎬', '🎧', '🎤', '🎼', '🎵', '🎶',
      '🎹', '🥁', '🎸', '🎺', '🎻', '🧭', '🔭', '🔬', '🧪', '🪔', '🕯️', '🔦',
      '📱', '💻', '⌨️', '🖥️', '🖨️', '💾', '💿', '📀', '📺', '📻', '⏰', '⌛',
      '🔑', '🗝️', '🛠️', '🔧', '🔨', '🪓', '⛏️', '🔩', '⚙️', '🧵', '🧶', '🧲',
    ],
  },
  {
    id: 'semne',
    label: 'Semne',
    emoji: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '☯️', '🕉️', '☸️', '✡️',
      '💬', '🗯️', '💭', '✅', '❌', '❗', '❓', '💯', '🔴', '🟠', '🟡', '🟢',
      '🔵', '🟣', '⚫', '⚪',
    ],
  },
];

/**
 * Every emoji of the picker, once, in the order the groups show them.
 *
 * Deduplicated: the flat list is what a caller searches and what the tests count, and a pictograph that
 * appears in two groups (a butterfly is an animal *and* a sign of spring) would otherwise be offered twice
 * under two tabs and would make „how many emoji does the picker have" two different numbers.
 */
export const TEXT_EMOJI: readonly string[] = Array.from(
  new Set(TEXT_EMOJI_GROUPS.flatMap((group) => group.emoji)),
);

/**
 * The colour the system paints behind selected text, and the handle it draws at each end.
 *
 * The owner, 29 octombrie 2026: „când selectez text apare verde" — the wash came from the Android theme,
 * whose `colorControlHighlight` is the brand mark `#2f5d45`, and a dark green rectangle under dark ink is
 * unreadable. A selection is not a brand surface: it has to keep the letters visible and it is not a
 * gesture cue. This azure keeps the page's dark ink at ~8:1 against the wash (AA at any size) and is
 * deliberately a different hue from every texture of the paper, so nobody mistakes one for the other.
 *
 * The *native* selection is kept — handles, magnifier, Copy/Cut/Paste — because a hand-built selection
 * loses the platform's own gestures; only its colour is chosen here (`selectionColor` on the field).
 */
export const TEXT_SELECTION_COLOR = '#7fc4f0';

const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The members a stored page may carry. A key outside this list is a row written by a build this one
 * does not understand, and it is refused rather than half-read (`textStyleForPost`).
 */
const TEXT_STYLE_KEYS = ['theme', 'font', 'size', 'align', 'background', 'text', 'media', 'document'] as const;

export class TextStyleError extends Error {
  constructor(readonly code: 'TEXT_STYLE_INVALID', message: string) {
    super(message);
    this.name = 'TextStyleError';
  }
}

/**
 * The palette of a theme. An id this build does not know falls back to the *default* page rather than
 * to whichever theme happens to be listed first: a stored row whose theme was renamed by a newer build
 * should open on paper, not on an unasked-for dark card.
 */
export function themeOf(theme: TextThemeId) {
  return TEXT_THEMES.find((item) => item.id === theme)
    ?? TEXT_THEMES.find((item) => item.id === TEXT_DEFAULT_THEME)
    ?? TEXT_THEMES[0];
}

export function sizeOf(size: TextSizeId) {
  return TEXT_SIZES.find((item) => item.id === size) ?? TEXT_SIZES[1];
}

/** The page a text post starts on: the e-paper default, in the reference measure and alignment. */
export function defaultTextStyle(): TextStyle {
  const theme = themeOf(TEXT_DEFAULT_THEME);
  return {
    theme: theme.id, font: 'serif', size: 'medium', align: 'left',
    background: theme.background, text: theme.text, media: { ...TEXT_MEDIA_FRAME_DEFAULT },
  };
}

/** A frame is only geometry: a number that is not finite, or is outside the page, is clamped. */
export function clampMediaFrame(value: Partial<TextMediaFrame> | null | undefined): TextMediaFrame {
  const source = value && typeof value === 'object' ? value : {};
  const number = (input: unknown, fallback: number) => (Number.isFinite(Number(input)) ? Number(input) : fallback);
  const clamp = (input: number, low: number, high: number) => Math.min(high, Math.max(low, input));
  return {
    scale: Math.round(clamp(number(source.scale, TEXT_MEDIA_FRAME_DEFAULT.scale), TEXT_MEDIA_SCALE_MIN, TEXT_MEDIA_SCALE_MAX) * 1000) / 1000,
    x: Math.round(clamp(number(source.x, TEXT_MEDIA_FRAME_DEFAULT.x), -TEXT_MEDIA_X_LIMIT, TEXT_MEDIA_X_LIMIT) * 1000) / 1000,
    y: Math.round(clamp(number(source.y, TEXT_MEDIA_FRAME_DEFAULT.y), TEXT_MEDIA_Y_MIN, TEXT_MEDIA_Y_MAX) * 1000) / 1000,
  };
}

/** The frame a reader draws for a style; a post written before the field existed gets the default. */
export function mediaFrameOf(style?: TextStyle | null): TextMediaFrame {
  return style ? clampMediaFrame(style.media) : { ...TEXT_MEDIA_FRAME_DEFAULT };
}

function readMediaFrame(value: unknown): TextMediaFrame {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...TEXT_MEDIA_FRAME_DEFAULT };
  return clampMediaFrame(value as Partial<TextMediaFrame>);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Strict normalization, rule for rule with the server: an unknown key is a caught bug, a colour that
 * is not the theme's own pair is refused, and `null` means "no authored style" (not "defaults").
 */
export function normalizeTextStyle(value: unknown): TextStyle | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TextStyleError('TEXT_STYLE_INVALID', 'Stilul textului nu este valid.');
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !(TEXT_STYLE_KEYS as readonly string[]).includes(key))) {
    throw new TextStyleError('TEXT_STYLE_INVALID', 'Stilul textului conține câmpuri necunoscute.');
  }
  const fallback = defaultTextStyle();
  const theme = source.theme === undefined ? fallback.theme : source.theme;
  const font = source.font === undefined ? fallback.font : source.font;
  const size = source.size === undefined ? fallback.size : source.size;
  const align = source.align === undefined ? fallback.align : source.align;
  if (!isOneOf(TEXT_THEME_IDS, theme) || !isOneOf(TEXT_FONT_IDS, font)
    || !isOneOf(TEXT_SIZE_IDS, size) || !isOneOf(TEXT_ALIGN_IDS, align)) {
    throw new TextStyleError('TEXT_STYLE_INVALID', 'Stilul textului nu este valid.');
  }
  /**
   * The frame is geometry, so it is validated as numbers rather than silently coerced: a request
   * may place the picture anywhere inside the page, but it may not store an unbounded block.
   */
  let media = { ...TEXT_MEDIA_FRAME_DEFAULT };
  if (source.media !== undefined) {
    if (!source.media || typeof source.media !== 'object' || Array.isArray(source.media)) {
      throw new TextStyleError('TEXT_STYLE_INVALID', 'Cadrul fotografiei nu este valid.');
    }
    const frame = source.media as Record<string, unknown>;
    const frameKeys = ['scale', 'x', 'y'];
    if (Object.keys(frame).some((key) => !frameKeys.includes(key))
      || frameKeys.some((key) => typeof frame[key] !== 'number' || !Number.isFinite(frame[key]))) {
      throw new TextStyleError('TEXT_STYLE_INVALID', 'Cadrul fotografiei nu este valid.');
    }
    if (Number(frame.scale) < TEXT_MEDIA_SCALE_MIN || Number(frame.scale) > TEXT_MEDIA_SCALE_MAX
      || Number(frame.x) < -TEXT_MEDIA_X_LIMIT || Number(frame.x) > TEXT_MEDIA_X_LIMIT
      || Number(frame.y) < TEXT_MEDIA_Y_MIN || Number(frame.y) > TEXT_MEDIA_Y_MAX) {
      throw new TextStyleError('TEXT_STYLE_INVALID', 'Cadrul fotografiei iese din pagină.');
    }
    media = clampMediaFrame(frame);
  }
  const palette = themeOf(theme);
  const background = source.background == null ? palette.background : source.background;
  const text = source.text == null ? palette.text : source.text;
  if (typeof background !== 'string' || !COLOR.test(background) || typeof text !== 'string' || !COLOR.test(text)) {
    throw new TextStyleError('TEXT_STYLE_INVALID', 'Culorile textului nu sunt valide.');
  }
  if (background.toLowerCase() !== palette.background || text.toLowerCase() !== palette.text) {
    throw new TextStyleError('TEXT_STYLE_INVALID', 'Culorile nu aparțin temei alese.');
  }
  const result: TextStyle = { theme, font, size, align, background: palette.background, text: palette.text, media };
  if (source.document !== undefined) {
    const document = readEditorialDocument(source.document);
    if (!document) throw new TextStyleError('TEXT_STYLE_INVALID', 'Pagina articolului nu este validă.');
    result.document = document;
  }
  return result;
}

/**
 * The tolerant reader for a stored draft or a post written by another build: every member that is
 * not one of the six themes falls back to the theme's default, and the pair is always the theme's
 * own, so a half-written draft still opens on a readable page.
 */
export function readTextStyle(value: unknown): TextStyle {
  const fallback = defaultTextStyle();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const source = value as Record<string, unknown>;
  const theme = isOneOf(TEXT_THEME_IDS, source.theme) ? source.theme : fallback.theme;
  const palette = themeOf(theme);
  const style: TextStyle = {
    theme,
    font: isOneOf(TEXT_FONT_IDS, source.font) ? source.font : fallback.font,
    size: isOneOf(TEXT_SIZE_IDS, source.size) ? source.size : fallback.size,
    align: isOneOf(TEXT_ALIGN_IDS, source.align) ? source.align : fallback.align,
    background: palette.background,
    text: palette.text,
    media: readMediaFrame(source.media),
  };
  const document = readEditorialDocument(source.document);
  if (document) style.document = document;
  return style;
}

/**
 * A page exactly as the **former** default wrote it: `jungle`, every other member at its own default,
 * no document and no moved picture.
 *
 * Until 26 October 2026 the composer opened on `jungle` (moss green), so every row published before
 * that day and left untouched carries this shape — and a row that carries it is indistinguishable from
 * one whose author *chose* moss green and changed nothing else. The rule this product takes (owner's
 * decision, 27 October 2026: a page of words is e-paper unless its author chose otherwise) is that the
 * untouched former default is a default, not a choice: it opens on the paper page like a row with no
 * style at all. The moment anything else was chosen — another theme, another face, another measure,
 * another alignment, a framed picture, a document — the page is the author's and is read exactly as
 * it was written.
 */
export function isFormerDefaultPage(style: TextStyle): boolean {
  const defaults = defaultTextStyle();
  const frame = mediaFrameOf(style);
  return style.theme === 'jungle'
    && style.font === defaults.font
    && style.size === defaults.size
    && style.align === defaults.align
    && style.document == null
    && frame.scale === TEXT_MEDIA_FRAME_DEFAULT.scale
    && frame.x === TEXT_MEDIA_FRAME_DEFAULT.x
    && frame.y === TEXT_MEDIA_FRAME_DEFAULT.y;
}

/**
 * What the readers draw: the page a stored `text_style` opens on, or `null` when the row carries no
 * style at all.
 *
 * Three tolerances, and no more:
 *
 * * a row with no style is `null` — the reader keeps its own composition for a post that never had a
 *   page (a quote, a picture, a clip);
 * * a member this build does not recognise (an unknown theme, an unknown key) makes the whole page
 *   unreadable and the answer `null`, rather than half-honouring a look nobody can check;
 * * a member that *is* recognised but was written by another build — a colour pair from before two
 *   papers became one, a frame from before `media` existed — is read tolerantly (`readTextStyle`), so
 *   the face, the measure and the document of that page survive the change instead of being dropped.
 *
 * The former default (`isFormerDefaultPage`) is read as the paper page. Everything else is returned as
 * the author wrote it: a theme is never silently replaced, which is the promise the composer makes when
 * it shows the page before it publishes it. What a theme is *not* any more is the paper: `pagePaletteOf`
 * paints every page on `TEXT_PAGE_THEME` and keeps the chosen theme's accent as its only decoration.
 */
export function textStyleForPost(value: unknown): TextStyle | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !(TEXT_STYLE_KEYS as readonly string[]).includes(key))) return null;
  if (source.theme !== undefined && !isOneOf(TEXT_THEME_IDS, source.theme)) return null;
  const style = readTextStyle(source);
  return isFormerDefaultPage(style) ? defaultTextStyle() : style;
}

/**
 * The page a post of words opens as: the author's look when the row carries a readable one, the paper
 * default when it does not — and never `null`, because a post of words is always a page.
 *
 * The style it answers with is the *look*: face, measure, alignment, document, framed picture, and the
 * theme it was written in (which is where the accent comes from). Its `background` and `text` members
 * are still the stored theme's pair — they are the pair the server validated, and they are never
 * painted: the colours of a page come from `pagePaletteOf`, so nothing has to be rewritten to be read
 * on paper.
 */
export function pageStyleForPost(value: unknown): TextStyle {
  return textStyleForPost(value) ?? defaultTextStyle();
}

/**
 * Hârtia de noapte (runda 46): **negru mat**, nu un gri luminat și nu un gradient.
 *
 * Perechea este a paginii, ca și cea de zi: `background`/`text` nu vin din tema autorului, ci din produs.
 * `mark` este accentul *citit* — un auriu deschis, fiindcă verdele închis al hârtiei (`#2f5d45`) ar fi
 * invizibil pe negru. `accent` rămâne al autorului, dar numai dacă se vede: `pagePaletteOf` măsoară
 * contrastul și cade pe `mark` când tema ar desena o linie pe care nimeni nu o poate citi.
 *
 * Numerele: `#0b0d0c` pe `#efece2` dă 16.5:1 (AAA), iar `#e3c777` pe același fundal dă 11.8:1 — deci
 * titlurile, citatele, tag-urile și linkurile au toate loc destul.
 */
export const PAGE_NIGHT = { background: '#0b0d0c', text: '#efece2', mark: '#e3c777' } as const;

/**
 * The colours a page of words is painted with — one page, whoever wrote it and whenever.
 *
 * `background` and `text` are always the paper's pair (`TEXT_THEMES.paper`) in `paper` mode: the warm page
 * and the dark serif ink this product reads on, whatever theme the row was stored in. In `night` mode they
 * are `PAGE_NIGHT`'s — matte black and light ink. Only `accent` follows the author's theme, and only where
 * it decorates rather than spells: a hairline above a title, the rule at the head of an article, the frame
 * of the translation chip, the outline of a selected picture. Words that have to be read — a tag, a
 * mention, a link, the caret, the `Vezi traducerea` label — take `mark`, because a gold hairline is
 * decoration and gold type on cream is a smudge.
 *
 * `mode` is the reader's own choice (`lib/pageMode.ts`), never a property of the post: the same row is
 * read on paper by day and on black at night, and nothing stored is rewritten to allow it.
 */
export function pagePaletteOf(style?: Pick<TextStyle, 'theme'> | null, mode: PageMode = 'paper'): TextPagePalette {
  const paper = themeOf(TEXT_PAGE_THEME);
  const chosen = style ? themeOf(style.theme) : paper;
  if (mode === 'night') {
    /**
     * The author's accent survives the night only if it can be seen on it. Three-to-one is the WCAG
     * threshold for a non-text graphic, which is exactly what a hairline is; below it the accent is
     * replaced by the page's own mark, so a `paper`-themed row (whose accent is a dark green) does not
     * draw a rule nobody can see.
     */
    const accent = contrastRatio(PAGE_NIGHT.background, chosen.accent) >= 3 ? chosen.accent : PAGE_NIGHT.mark;
    return { background: PAGE_NIGHT.background, text: PAGE_NIGHT.text, mark: PAGE_NIGHT.mark, accent };
  }
  return { background: paper.background, text: paper.text, mark: paper.accent, accent: chosen.accent };
}

/**
 * The platform's own face for a family; `undefined` lets the system pick its reading face.
 *
 * The Android names are the *generic* families of the platform, resolved through `/system/etc/fonts.xml`
 * — never a font file name, because a file name that a later Android renames turns a page into tofu.
 * `serif-monospace`, `casual` and `sans-serif-condensed` are the three the owner's phone really draws
 * differently from `serif`/`sans`/`mono` (checked on the Xiaomi MIX Flip in this round).
 */
export function fontFamilyFor(font: TextFontId, platform: string): string | undefined {
  const family: Record<TextFontId, { ios: string; android: string; web?: string }> = {
    serif: { ios: 'Georgia', android: 'serif', web: 'Georgia, serif' },
    mono: { ios: 'Menlo', android: 'monospace', web: 'ui-monospace, monospace' },
    sans: { ios: 'System', android: 'sans-serif' },
    slab: { ios: 'Courier New', android: 'serif-monospace', web: 'Courier New, ui-monospace, monospace' },
    casual: { ios: 'Marker Felt', android: 'casual', web: 'Comic Sans MS, cursive' },
    condensed: { ios: 'AvenirNextCondensed-Medium', android: 'sans-serif-condensed', web: 'Arial Narrow, sans-serif' },
  };
  const entry = family[font] ?? family.serif;
  if (platform === 'ios') return entry.ios;
  if (platform === 'android') return entry.android;
  if (platform === 'web') return entry.web;
  return undefined;
}

/**
 * The **metric** face a page is laid out with, which is not the face it is drawn in.
 *
 * `lib/fontMetrics.ts` carries the real advances of three font files read off the phone (Noto Serif, the
 * sans pair, DroidSansMono), and the flow (`lib/editorialFlow.ts`) measures every line with them. The three
 * faces added in the text-integrity round have no tables of their own, so each is measured with the closest
 * table it has — and always with the **wider** one, because the model must never promise a line more room
 * than its glyphs take:
 *
 * - `slab` is Noto Serif Mono, a constant advance like `mono`'s;
 * - `casual` is CommingSoon, wide and round: measured with `serif`, the widest proportional table;
 * - `condensed` is Roboto Condensed, narrower than anything tabled: also measured with `serif`, so its lines
 *   break a little early rather than losing their last word off the page.
 *
 * A wrong guess in this direction costs a word on the next line; the other direction costs a clipped word.
 */
export function metricFaceFor(font: TextFontId): 'serif' | 'sans' | 'mono' {
  const face: Record<TextFontId, 'serif' | 'sans' | 'mono'> = {
    serif: 'serif',
    mono: 'mono',
    sans: 'sans',
    slab: 'mono',
    casual: 'serif',
    condensed: 'serif',
  };
  return face[font] ?? 'serif';
}

/** WCAG relative luminance of `#rrggbb`, used by the composer to keep every pair readable. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** The contrast of a theme's pair; the test asserts every offered theme clears WCAG AA (4.5). */
export function contrastRatio(background: string, text: string): number {
  const lighter = Math.max(luminance(background), luminance(text));
  const darker = Math.min(luminance(background), luminance(text));
  return (lighter + 0.05) / (darker + 0.05);
}

