/**
 * The owner's row of buttons on the profile header — geometry, words and the one decision that depends on
 * the screen: whether a label still fits.
 *
 * The owner named the row on 17 October 2026: one line, ~40 dp tall, fully round corners, holding
 *
 *   [Editează profilul — neutral, wide] [Monetizează profilul — green, filled, wide] [round icon only]
 *
 * with the round entry carrying the share glyph and no text at all. The `⋯` that used to end this row is
 * gone: the profile's index of doors is the three bars at the top of the header (`lib/profileMenu.ts`).
 *
 * A label that does not fit is shortened instead of truncated: `Monetizează profilul` becomes
 * `Monetizează`. The fit is decided here, in one place, from the width the screen really has and the
 * font scale the reader really uses — so the test can hold both ends of the rule without a phone.
 */

/** The row's measurements, in dp. Every number is used by `ProfileHeader` and asserted by the tests. */
export const OWNER_ROW = Object.freeze({
  /** The owner asked for ~40 dp: a pill, not the 38 dp relation button and not a 44 dp block. */
  height: 40,
  radius: 20,
  gap: 8,
  /** The header's own inset, the same on both sides (`socialTokens.identity.paddingHorizontal`). */
  paddingHorizontal: 14,
  /** The round share is drawn at 40 dp and aimed at 44 dp (`hitSlop`), like every other target here. */
  shareSize: 40,
  shareTarget: 44,
  /** The disc around the share glyph, so the icon does not touch the pill's edge. */
  shareGlyph: 19,
  labelSize: 14,
  labelWeight: '800' as const,
  /** What a wide button keeps on each side of its word. */
  labelPaddingInline: 12,
});

export const OWNER_ROW_WORDS = Object.freeze({
  edit: 'Editează profilul',
  editShort: 'Editează',
  monetize: 'Monetizează profilul',
  monetizeShort: 'Monetizează',
  /** The round entry has no visible word: this is its accessible name and only its name. */
  share: 'Distribuie profilul',
});

/**
 * A deterministic width estimate for one line of text, in dp.
 *
 * React Native has no synchronous text measurement (and `adjustsFontSizeToFit` is iOS-only), so the
 * decision "does this label fit?" has to be made from the string itself. The table below is a narrow
 * approximation of the average glyph widths of the system font at 1 sp; it is deliberately a little
 * generous on capitals and on `m`/`w`, because a label that fits by 2 dp is a label that truncates on a
 * device with a different font.
 */
const NARROW = new Set(['i', 'l', 'j', 'I', '!', '|', '.', ',', ':', ';', "'", '’', ' ']);
const WIDE = new Set(['m', 'w', 'M', 'W', 'G', 'O', 'Q', '@', 'Ă', 'Â', 'Î', 'Ș', 'Ț']);

export function estimateLabelWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of String(text)) {
    if (NARROW.has(char)) units += 0.3;
    else if (WIDE.has(char)) units += 0.86;
    else if (char === char.toUpperCase() && char !== char.toLowerCase()) units += 0.68;
    else units += 0.55;
  }
  return units * fontSize;
}

/** What one wide button can hold: the row minus the insets, the two gaps, the round entry and its padding. */
export function ownerWideLabelRoom(screenWidth: number): number {
  const usable = Number(screenWidth) - OWNER_ROW.paddingHorizontal * 2 - OWNER_ROW.gap * 2 - OWNER_ROW.shareTarget;
  const perButton = usable / 2;
  return Math.max(0, perButton - OWNER_ROW.labelPaddingInline * 2);
}

export type OwnerRowLabels = { edit: string; monetize: string; share: string };

/**
 * The three words of the row for this screen and this font scale. A label that does not fit is replaced
 * by its short form — never cut with an ellipsis, and never scaled down to a size the reader did not ask
 * for. At 469 dp (the phone this project is checked on) both full labels fit at scale 1.0, and
 * `Monetizează` is what prints at 1.3.
 */
export function ownerRowLabels({ screenWidth, fontScale }: { screenWidth: number; fontScale: number }): OwnerRowLabels {
  const room = ownerWideLabelRoom(screenWidth);
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const fits = (label: string) => estimateLabelWidth(label, OWNER_ROW.labelSize * scale) <= room;
  return {
    edit: fits(OWNER_ROW_WORDS.edit) ? OWNER_ROW_WORDS.edit : OWNER_ROW_WORDS.editShort,
    monetize: fits(OWNER_ROW_WORDS.monetize) ? OWNER_ROW_WORDS.monetize : OWNER_ROW_WORDS.monetizeShort,
    share: OWNER_ROW_WORDS.share,
  };
}
