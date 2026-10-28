import { blackSilver } from './blackSilver';

/**
 * The field the app sits on — now Matte Black + Silver, and no longer a fruit bowl.
 *
 * This module used to be the *measured* jungle (round 16): the field was a leaf green (`#02150D`) sampled
 * from the JB logo, the primary action was kiwi (`#8BD04A`), the open tab was banana (`#F5D33C`) and the
 * top corners wore eight fruit rings. Every one of those values was derived from the artwork, which is
 * exactly why they were right as artwork and wrong as UI: the logo is a drawing, the interface is chrome.
 *
 * Round 31 (owner, 31 October 2026) asked for one identity — „MATTE BLACK + SILVER" — and for the green,
 * teal and yellow branding to go. Rather than teach forty screens a new vocabulary, the jungle keeps its
 * names and reads its values from `theme/blackSilver.ts`; the table below is the whole migration:
 *
 *   canvas          #02150D  leaf green        →  matteBlack  #101113
 *   surface         #04201A  leaf              →  graphite    #1C1E20
 *   surfaceRaised   #062A22  leaf              →  elevated    #242629
 *   sheet           #062A22  leaf              →  graphite    #1C1E20
 *   border          green 22 %                 →  silver 22 %
 *   borderStrong    kiwi 34 %                  →  silver 42 %
 *   primary         #8BD04A  kiwi              →  silver      #C4C7CB
 *   primaryPressed  #7CC03D  kiwi              →  bright      #E1E3E5
 *   primaryInk      #04160B  leaf-black        →  onSilver    #101113
 *   text            #F2FBF5  mint white        →  bright      #E1E3E5
 *   textMuted       #9FB8AB  sage              →  silver      #C4C7CB
 *   textQuiet       #7E9C8D  sage              →  muted       #A5A5A5
 *   navActive       #F5D33C  banana            →  bright      #E1E3E5
 *   navIdle         #8FA79A  sage              →  muted       #A5A5A5
 *
 * What stays: `FRUIT` — the measured pigments of the fruit logo itself. They are the *drawing's* colours,
 * not a branding accent, so the artwork is preserved exactly as the owner asked; no surface paints with
 * them any more (`fruitRing`/`fruitWash` below are the metal now). `media` stays black, because a
 * photograph is never tinted by a theme, and `dangerInk` stays the lifted raspberry, because a refusal is
 * meaning and not decoration.
 */
export type JungleFruit = 'banana' | 'mango' | 'papaya' | 'kiwi' | 'leaf' | 'raspberry' | 'blueberry' | 'passionfruit';

/**
 * The measured references of the artwork (`tools/brand/sample-palette.ps1`, run of 17 October 2026).
 *
 * Kept verbatim and **never painted as chrome**: these are the pigments of `jb-mark-1024.png` — the logo
 * the owner asked to keep. A surface that wants a colour takes it from `blackSilver`.
 */
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
  /** The field: matte black. */
  canvas: blackSilver.matteBlack,
  /** Surfaces that sit on the field: graphite, one step up. */
  surface: blackSilver.graphite,
  surfaceRaised: blackSilver.elevated,
  /** The sheet and dialog surface (the drawer, the menus, the bottom sheets). */
  sheet: blackSilver.graphite,
  /** Hairlines: the metal, attenuated — never a white rule. */
  border: blackSilver.hairline,
  borderStrong: blackSilver.hairlineStrong,
  /** The primary action: silver, with the field as its ink. */
  primary: blackSilver.silver,
  primaryPressed: blackSilver.bright,
  primaryInk: blackSilver.onSilver,
  /** Secondary ink and words. */
  text: blackSilver.text,
  textMuted: blackSilver.textMuted,
  textQuiet: blackSilver.textQuiet,
  /** The bottom bar: the open mark is bright silver, the rest is muted silver. */
  navActive: blackSilver.bright,
  navIdle: blackSilver.muted,
  /** Words that warn (a refused payout, a blocked action) — meaning, kept. */
  dangerInk: '#FF6B8A',
  /** Media is not part of the theme: video, photo, story, camera and viewers keep black. */
  media: blackSilver.media,
} as const;

/**
 * The five doors of the top corners. They used to wear one fruit each (a kiwi here, a mango there); with
 * the identity unified they wear the metal instead — a quiet hairline and a wash of the same, so the row
 * still reads as one family and no door is greener than its neighbour.
 */
export const fruitRing: Record<'module' | 'menu' | 'share' | 'bell' | 'logout', string> = {
  module: blackSilver.hairlineStrong,
  menu: blackSilver.hairlineStrong,
  share: blackSilver.hairline,
  bell: blackSilver.hairline,
  logout: blackSilver.hairline,
};

/** The same five doors, as surfaces: the metal washed into the field at 8 %. */
export const fruitWash: Record<'module' | 'menu' | 'share' | 'bell' | 'logout', string> = {
  module: blackSilver.wash,
  menu: blackSilver.wash,
  share: blackSilver.wash,
  bell: blackSilver.wash,
  logout: blackSilver.wash,
};

/**
 * WCAG relative luminance and contrast. Re-exported from `blackSilver` so the contrast arithmetic lives
 * with the palette it measures, while `test-theme-contrast.cjs` keeps reading it from here.
 */
export { contrast, luminance } from './blackSilver';

/** Every text-on-surface pair this palette paints. `scripts/test-theme-contrast.cjs` walks the list. */
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
  { name: 'navActive pe canvas', ink: jungle.navActive, surface: jungle.canvas },
  { name: 'navIdle pe canvas', ink: jungle.navIdle, surface: jungle.canvas },
  { name: 'dangerInk pe canvas', ink: jungle.dangerInk, surface: jungle.canvas },
];
