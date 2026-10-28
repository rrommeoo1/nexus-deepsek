import { Platform } from 'react-native';
import { blackSilver } from './blackSilver';

/**
 * The Jungle Book editorial palette — Matte Black + Silver.
 *
 * Round 24 asked for a matte black jungle rather than a TikTok clone with green icons, and wrote the
 * field as a green-black (`#101311`), the card as a moss charcoal (`#151B17`), the panel as a pine
 * (`#1F3026`) and the one accent as a botanical leaf (`#7FAE76`). Round 31 (31 October 2026) keeps the
 * *idea* — a matte field, a card that sits on it, one accent, warm words — and takes the green out of it:
 * the field is the palette's matte black, the card and panel are graphite and elevated, and the accent is
 * the metal. A page of words is still cream paper; that is a reading surface, not chrome, and nothing here
 * touches it.
 *
 * Contrast on the field (`scripts/test-editorial-theme.cjs` recomputes it):
 *
 *   ink        #E1E3E5 on #101113  ~13.9:1
 *   inkMuted   #C4C7CB on #101113  ~10.1:1
 *   stone      #C4C7CB on #101113  ~10.1:1
 *   stoneInk   #E1E3E5 on #101113  ~13.9:1
 *
 * Every one clears WCAG AA for normal text.
 */
export const editorial = {
  /** The field every non-media surface sits on. */
  field: blackSilver.matteBlack,
  /** One step darker: the strip behind a floating bar, and the reader's own field. */
  fieldDeep: blackSilver.deepBlack,
  /** The card: graphite, so a post reads as a plate on the field instead of dissolving into it. */
  cardTop: blackSilver.graphite,
  cardBottom: blackSilver.matteBlack,
  /** The raised surface: the reply composer, a selected segment, a panel. */
  panel: blackSilver.elevated,
  /** The accent — the metal. It was the leaf (`#7FAE76`); a hashtag, a translation and a rule wear it. */
  leaf: blackSilver.silver,
  leafInk: blackSilver.bright,
  /** The same metal as a wash — never an opaque plate over a picture. */
  leafFaint: blackSilver.wash,
  leafSoft: blackSilver.washStrong,
  leafEdge: blackSilver.hairline,
  leafEdgeStrong: blackSilver.hairlineStrong,
  /** Words. */
  ink: blackSilver.text,
  inkMuted: blackSilver.textMuted,
  inkQuiet: blackSilver.textQuiet,
  /** Hairlines, never white rules. */
  hairline: blackSilver.hairline,
  hairlineSoft: blackSilver.hairlineSoft,
  /** A failure keeps the product's raspberry, lifted until it reads on the field. */
  danger: blackSilver.danger,
  dangerWash: blackSilver.dangerWash,
  /**
   * The ink the metal's *shadow* wears on the cream page — a glyph on paper, never a word. `leaf` above
   * is the metal and is invisible on `#f4efe2` (2.2:1); a mark drawn on a page of words reads this.
   */
  paperMark: blackSilver.deepMercury,
} as const;

/**
 * The vintage editorial voice: a serif for a short statement that *is* the post, and the platform's own
 * sans for anything the reader has to scan at length. `serif` on Android is Noto Serif and `Georgia` on
 * iOS — both ship with the system, so nothing is downloaded, nothing is licensed per installation, and a
 * long paragraph never becomes harder to read than it was.
 */
export const editorialType = {
  serif: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
  /** A statement: the first line of a short text post, a display name large enough to be the title. */
  display: { fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }), fontWeight: '600' as const, letterSpacing: 0.2 },
  /** A section label: small, spaced capitals — "JUNGLE BOOK", "TOATE". */
  label: { fontWeight: '800' as const, letterSpacing: 1.1 },
} as const;

/** A short post is *read* as a statement; a long one is scanned as an article. */
export const STATEMENT_CHARS = 220;
