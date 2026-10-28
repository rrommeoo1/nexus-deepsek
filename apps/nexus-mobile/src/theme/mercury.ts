import { blackSilver } from './blackSilver';

/**
 * Mercury — the one neutral metal the product is allowed to be quiet in.
 *
 * The owner, 30 October 2026: „negru dur" is the defect, not the ink. Three places were reading as a
 * black hole on his phone — the four presses of a page of words, the disc of a profile with no picture
 * and the `+` of the footer — and all three were painted with the only dark value their component had.
 * This module is the single answer they share, so a later screen cannot invent a fourth grey:
 *
 *   base      #A5A5A5  the metal itself, the value the owner named; a plate, a disc, a bezel;
 *   light     #D6D8D9  where the light strikes it (the `+` disc's own highlight);
 *   deep      #7C8083  the same metal in shadow — the only shade a **glyph** may wear on paper;
 *   shadow    #5B5F62  the foot of a polished disc (never black: a black foot reads as a hole);
 *   graphite  #2B3134  the ink that *sits on* the metal. Not a ground and not a glyph on cream.
 *
 * Round 31 (31 October 2026) folded the two values the palette already owned into `blackSilver`:
 * `base` **is** `blackSilver.muted` and `deep` **is** `blackSilver.deepMercury`. `light`, `shadow` and
 * `graphite` are the metal's own specular, foot and ink — three stops of the same ramp, not a second grey
 * system — so they stay here, where the disc that needs them reads them.
 *
 * Measured (WCAG 2.1, `scripts/test-mercury.cjs` recomputes every pair):
 *
 *   graphite on base      ~5.3:1   the plus on its disc, a glyph on a plate
 *   deep on the page      ~3.5:1   a 25dp glyph on `#f4efe2` — clears 1.4.11's 3:1 for non-text
 *   base on the field     ~7.6:1   a Mercury disc on the matte field
 *
 * `base` itself is *not* offered to a glyph drawn on the cream page: it measures ~2.2:1 there, which is
 * a decoration, not a control. That is why `deep` exists and why `markOn` is a function and not a guess.
 */

export const mercury = {
  /** The owner's metal. It is `blackSilver.muted`, under the name the reader's rail has used since round 30. */
  base: blackSilver.muted,
  /** The specular of the same metal, for the highlight of a polished disc. */
  light: '#D6D8D9',
  /** The metal in shadow: the one ink a glyph may wear on a light ground. */
  deep: blackSilver.deepMercury,
  /** The foot of a polished disc — graphite, never black. */
  shadow: '#5B5F62',
  /** What sits on the metal: a plus, a silhouette. */
  graphite: '#2B3134',
  /**
   * The light ground the deep shade is measured against — the page every post of words is painted on
   * (`TEXT_THEMES.paper.background`, `socialTokens.reading.page`). It is repeated here only so a test
   * can prove the pair without importing React Native's theme module.
   */
  paper: '#f4efe2',
} as const;

/** The two grounds a Mercury mark can stand on. */
export type MercuryGround = 'paper' | 'night';

/**
 * The Mercury ink for a glyph on a given ground.
 *
 * A page of words is cream, so its presses wear the metal in shadow (`deep`, 3.5:1). Everything else —
 * a photograph, a clip, the profile's field — is dark, and there the same metal in full (`base`,
 * 7.6:1 on the field) is the mark. Nothing here is used by Reels: the reader's rail keeps its own
 * silver (`socialTokens.post.controls.night.mark`), which is unchanged by this round.
 */
export function mercuryMarkOn(ground: MercuryGround): string {
  return ground === 'paper' ? mercury.deep : mercury.base;
}

/**
 * A default avatar: the plate and the ink of whatever stands on it.
 *
 * Round 31 (31 October 2026): the face of a profile with no picture is the **JB fruit logo** — the exact
 * artwork of the launcher and of the inbox header, reused (`components/BrandAvatar.tsx`). The plate is
 * therefore the field's graphite rather than the metal: the logo is a full-colour drawing (banana, mango,
 * kiwi, papaya) and a silver plate behind it read as a washed-out sticker. Graphite is what makes the
 * fruit look like fruit, and the edge keeps the disc off the field without inventing a ring.
 *
 * `ink` stays the metal: it is what a surface with *nothing* to draw inside the disc wears (the editor's
 * `＋`), and it must never be a letter on a pale plate again.
 */
export const mercuryAvatar = {
  plate: blackSilver.graphite,
  ink: blackSilver.bright,
  /** A silhouette or a glyph inside the plate. */
  glyph: blackSilver.bright,
  /** The hairline that keeps the plate off a dark field without inventing a ring. */
  edge: blackSilver.edge,
} as const;
