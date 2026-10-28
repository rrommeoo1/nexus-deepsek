/**
 * Matte Black + Silver — the one palette of the product.
 *
 * The owner, 31 October 2026: „identitatea vizuală este încă inconsistentă… vreau MATTE BLACK + SILVER
 * peste tot". The app had grown four palettes that each answered a different question — the measured
 * jungle (`jungle.ts`, leaf green and banana), the botanical editorial metal (`editorial.ts`, moss and
 * kiwi), the transposed web shell (`social.ts`, green-black glass and teal accents) and Mercury
 * (`mercury.ts`, round 30). Four sources of grey is how a heart stays black while the three marks beside
 * it turn grey, how the open tab turns banana and how a default avatar becomes a hole. This module is the
 * single answer they all share now; the other modules keep their names (so no screen had to be taught a
 * new vocabulary) and read their values from here.
 *
 * The metal ramp, from the field up:
 *
 *   deepBlack    #090A0B   the floor: a bar, a sheet's foot, the ink on a bright plate
 *   matteBlack   #101113   the field every screen is painted on (was the leaf `#02150D` / `#101311`)
 *   graphite     #1C1E20   a surface that sits *on* the field: a card, a disc, a panel (was `#062A22`)
 *   elevated     #242629   the raised surface: a sheet, a pressed segment (was `#1F3026`)
 *   deepMercury  #7C8083   the metal in shadow — a glyph on cream, a hairline's centre
 *   muted        #A5A5A5   the metal, quiet: an idle tab, secondary words, a default disc
 *   silver       #C4C7CB   the metal: an icon, a border, a label (was kiwi `#8BD04A`)
 *   bright       #E1E3E5   the metal where the light strikes: the open tab, the `+`, a leading button
 *
 * Measured (WCAG 2.1; `scripts/test-theme-contrast.cjs` and `scripts/test-black-silver.cjs` recompute every
 * pair, so these numbers cannot drift from the values above):
 *
 *   bright on matteBlack      14.68:1   body words, an open tab
 *   silver on matteBlack      11.14:1   icons, labels, a quiet border
 *   muted on matteBlack        7.67:1   secondary words, an idle tab
 *   matteBlack on silver      11.14:1   the ink *on* a silver button; a leading door
 *   deepBlack on bright       15.40:1   the `+` on its disc
 *   deepMercury on matteBlack  4.74:1   the metal in shadow over the field
 *   deepMercury on paper       3.47:1   a glyph on the cream page — clears 1.4.11's 3:1, never a sentence
 *
 * What this palette deliberately does **not** touch:
 *
 *   * a page of words — the cream `#f4efe2` of the Kindle-style reader, its warm `#1a221b` ink and the
 *     six page themes the writer chooses (`lib/textStyle.ts`); a reading page is paper, not chrome;
 *   * media — a photograph, a clip, a story and a camera keep black, and an emoji keeps its own colours;
 *   * the fruit artwork — `jungle.FRUIT` still holds the measured colours of the JB logo, because those
 *     are the drawing's own pigments and not a branding accent;
 *   * meaning — a presence dot, a refusal and an unread pill keep `success`, `warning`, `danger` and
 *     `badge`, so a state is never mistaken for decoration.
 */
export const blackSilver = {
  /** The floor of the product: the bottom bar, a sheet's foot, the ink on a bright plate. */
  deepBlack: '#090A0B',
  /** The field every screen is painted on. */
  matteBlack: '#101113',
  /** A surface that sits *on* the field: a card, a disc, a panel. */
  graphite: '#1C1E20',
  /** The raised surface: a sheet, a menu, a pressed segment. */
  elevated: '#242629',
  /** The metal in shadow — a glyph on cream, the centre of a hairline. */
  deepMercury: '#7C8083',
  /** The metal, quiet: an idle tab, a secondary word, the plate of a default face. */
  muted: '#A5A5A5',
  /** The metal itself: an icon, a border, a label. */
  silver: '#C4C7CB',
  /** The metal where the light strikes: the open tab, the `+`, a leading button. */
  bright: '#E1E3E5',

  /** The ink that sits *on* the metal: a word on a silver button. */
  onSilver: '#101113',
  /** The same ink on the brightest plate (the `+` on its disc). */
  onBright: '#090A0B',

  /** Words on the field. */
  text: '#E1E3E5',
  textMuted: '#C4C7CB',
  textQuiet: '#A5A5A5',

  /** The metal at low alpha — a hairline, a wash, an edge. Never a white rule. */
  hairline: 'rgba(196,199,203,0.22)',
  hairlineSoft: 'rgba(196,199,203,0.12)',
  hairlineStrong: 'rgba(196,199,203,0.42)',
  wash: 'rgba(196,199,203,0.08)',
  washStrong: 'rgba(196,199,203,0.16)',
  /** The hairline that keeps a plate off a dark field without inventing a ring. */
  edge: 'rgba(196,199,203,0.28)',

  /**
   * Meaning, preserved (classification rule 2 of the round): a presence that is online, a presence that
   * is away, a refusal, and the unread pill. These are not branding and they are not recoloured.
   */
  success: '#39E58E',
  warning: '#FFD166',
  danger: '#FF8FA6',
  dangerWash: 'rgba(214,51,87,0.16)',
  badge: '#F14359',

  /** Media is not part of the theme: video, photo, story, camera and viewers keep black. */
  media: '#000000',
} as const;

/**
 * WCAG relative luminance of `#rrggbb` — the arithmetic every contrast check in the app shares.
 *
 * It lives beside the palette, not in a screen and not in a test, so the number a test measures is the
 * number the module promises.
 */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (index: number) => {
    const part = parseInt(value.slice(index, index + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** The contrast ratio between two colours, as WCAG 2.1 defines it. */
export function contrast(one: string, other: string): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** The four stops of a polished disc, light side first. Shared by the `+` of the footer. */
export const blackSilverPolish: readonly { offset: number; color: string }[] = [
  { offset: 0, color: blackSilver.bright },
  { offset: 0.38, color: blackSilver.silver },
  { offset: 0.72, color: blackSilver.muted },
  { offset: 1, color: blackSilver.deepMercury },
];

/**
 * Every pair this palette really paints, with the minimum WCAG ratio it owes.
 *
 * `scripts/test-black-silver.cjs` walks the list and fails the run when one pair drops below its floor,
 * so a later edit cannot quietly put a black glyph on the field and call it silver. A *glyph* owes 3:1
 * (WCAG 1.4.11, non-text contrast); a sentence owes 4.5:1 (1.4.3).
 */
export const BLACK_SILVER_PAIRS: ReadonlyArray<{ name: string; ink: string; surface: string; minimum: number }> = [
  { name: 'bright pe matteBlack', ink: blackSilver.bright, surface: blackSilver.matteBlack, minimum: 4.5 },
  { name: 'silver pe matteBlack', ink: blackSilver.silver, surface: blackSilver.matteBlack, minimum: 4.5 },
  { name: 'muted pe matteBlack', ink: blackSilver.muted, surface: blackSilver.matteBlack, minimum: 4.5 },
  { name: 'bright pe graphite', ink: blackSilver.bright, surface: blackSilver.graphite, minimum: 4.5 },
  { name: 'silver pe graphite', ink: blackSilver.silver, surface: blackSilver.graphite, minimum: 4.5 },
  { name: 'muted pe graphite', ink: blackSilver.muted, surface: blackSilver.graphite, minimum: 4.5 },
  { name: 'silver pe elevated', ink: blackSilver.silver, surface: blackSilver.elevated, minimum: 4.5 },
  { name: 'bright pe deepBlack', ink: blackSilver.bright, surface: blackSilver.deepBlack, minimum: 4.5 },
  { name: 'matteBlack pe silver', ink: blackSilver.onSilver, surface: blackSilver.silver, minimum: 4.5 },
  { name: 'matteBlack pe bright', ink: blackSilver.onSilver, surface: blackSilver.bright, minimum: 4.5 },
  { name: 'deepBlack pe bright', ink: blackSilver.onBright, surface: blackSilver.bright, minimum: 4.5 },
  { name: 'deepMercury pe matteBlack (glifă)', ink: blackSilver.deepMercury, surface: blackSilver.matteBlack, minimum: 3 },
  { name: 'deepMercury pe hârtie (glifă)', ink: blackSilver.deepMercury, surface: '#f4efe2', minimum: 3 },
  { name: 'success pe matteBlack (stare)', ink: blackSilver.success, surface: blackSilver.matteBlack, minimum: 3 },
  { name: 'warning pe matteBlack (stare)', ink: blackSilver.warning, surface: blackSilver.matteBlack, minimum: 3 },
  { name: 'danger pe matteBlack', ink: blackSilver.danger, surface: blackSilver.matteBlack, minimum: 4.5 },
];
