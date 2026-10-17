/**
 * The "jungle" palette, in one place.
 *
 * Every colour here is derived from the mark itself, measured — not guessed — by
 * `tools/brand/sample-palette.ps1`, which buckets the opaque pixels of `jb-mark-1024.png` and assigns
 * them to the eight fruits of the book. The run of 17 October 2026 gave:
 *
 *   leaf 38,4 % · mango 23,6 % · raspberry 14,7 % · kiwi 9,5 % · banana 7,5 % · papaya 6,2 %
 *   blueberry 0,1 % · passionfruit 0,04 %
 *
 * and the dominant buckets were `#E47424` (mango), `#EC7424` (papaya), `#F4AC04`/`#FCB404` (banana) and
 * the deep greens `#1C3404`, `#243C04`. So the field the app sits on is a dark leaf green (not pure
 * black), the primary action is kiwi, and the fruits are accents with reduced saturation — a fruit bowl,
 * not a carnival. Media surfaces stay black: a video is not tinted by a theme.
 *
 * Numeric rule that `scripts/test-theme-contrast.cjs` enforces: every text-on-surface pair below is at
 * least 4.5:1 (WCAG AA for normal text). The test computes them; this comment is the promise.
 */
export type JungleFruit = 'banana' | 'mango' | 'papaya' | 'kiwi' | 'leaf' | 'raspberry' | 'blueberry' | 'passionfruit';

/** The measured references, kept as the source of the accents (no alpha; see `ring` for tints). */
export const FRUIT: Record<JungleFruit, string> = {
  banana: '#F5D33C',
  mango: '#F59B2E',
  papaya: '#F57A4A',
  kiwi: '#8BD04A',
  leaf: '#2F9E5A',
  raspberry: '#D63357',
  blueberry: '#5A50B4',
  passionfruit: '#9A42B0',
};

export const jungle = {
  /** The field: a leaf green so dark it reads as black at a glance, but is not black. */
  canvas: '#02150D',
  /** Surfaces that sit on the field: one step lighter, never pure grey. */
  surface: '#04201A',
  surfaceRaised: '#062A22',
  /** The sheet and dialog surface (the drawer, the menus, the bottom sheets). */
  sheet: '#062A22',
  /** Hairlines: green, attenuated — never a white rule. */
  border: 'rgba(112,164,130,0.22)',
  borderStrong: 'rgba(139,208,74,0.34)',
  /** The primary action: kiwi, filled, with the field as its ink. */
  primary: '#8BD04A',
  primaryPressed: '#7CC03D',
  primaryInk: '#04160B',
  /** Secondary ink and words. */
  text: '#F2FBF5',
  textMuted: '#9FB8AB',
  textQuiet: '#7E9C8D',
  /** The bottom bar: the open mark is banana, the rest is a green-grey. */
  navActive: '#F5D33C',
  navIdle: '#8FA79A',
  /** Words that warn (a refused payout, a blocked action) — the raspberry lifted until it reads at 4.5:1. */
  dangerInk: '#FF6B8A',
  /** Media is not part of the theme: video, photo, story, camera and viewers keep black. */
  media: '#000000',
} as const;

/**
 * The discreet fruit ring: a 1 px edge on the round entries of the top corners, one fruit per door and
 * each at low saturation, so the row reads as one family instead of five colours.
 */
export const fruitRing: Record<'module' | 'menu' | 'share' | 'bell' | 'logout', string> = {
  module: 'rgba(245,211,60,0.34)',
  menu: 'rgba(139,208,74,0.34)',
  share: 'rgba(245,122,74,0.32)',
  bell: 'rgba(245,155,46,0.32)',
  logout: 'rgba(214,51,87,0.34)',
};

/** The same five doors, as surfaces: the ring's fruit, mixed into the field at 8–12 %. */
export const fruitWash: Record<'module' | 'menu' | 'share' | 'bell' | 'logout', string> = {
  module: 'rgba(245,211,60,0.08)',
  menu: 'rgba(139,208,74,0.08)',
  share: 'rgba(245,122,74,0.08)',
  bell: 'rgba(245,155,46,0.08)',
  logout: 'rgba(214,51,87,0.08)',
};

/** WCAG relative luminance of `#rrggbb`, for the contrast test and for anything that needs to check. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** The contrast ratio between two `#rrggbb` colours, as WCAG defines it. */
export function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

/** Every text-on-surface pair the theme actually paints. The contrast test walks this list. */
export const TEXT_PAIRS: ReadonlyArray<{ name: string; ink: string; surface: string }> = [
  { name: 'text pe canvas', ink: jungle.text, surface: jungle.canvas },
  { name: 'text pe surface', ink: jungle.text, surface: jungle.surface },
  { name: 'text pe surfaceRaised', ink: jungle.text, surface: jungle.surfaceRaised },
  { name: 'text pe sheet', ink: jungle.text, surface: jungle.sheet },
  { name: 'textMuted pe canvas', ink: jungle.textMuted, surface: jungle.canvas },
  { name: 'textMuted pe surface', ink: jungle.textMuted, surface: jungle.surface },
  { name: 'textMuted pe sheet', ink: jungle.textMuted, surface: jungle.sheet },
  { name: 'textQuiet pe canvas', ink: jungle.textQuiet, surface: jungle.canvas },
  { name: 'ink pe primary', ink: jungle.primaryInk, surface: jungle.primary },
  { name: 'canvas pe banana', ink: jungle.canvas, surface: FRUIT.banana },
  { name: 'navActive pe canvas', ink: jungle.navActive, surface: jungle.canvas },
  { name: 'navIdle pe canvas', ink: jungle.navIdle, surface: jungle.canvas },
  { name: 'leaf pe canvas', ink: FRUIT.leaf, surface: jungle.canvas },
  { name: 'dangerInk pe canvas', ink: jungle.dangerInk, surface: jungle.canvas },
];
