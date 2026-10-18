/**
 * The owner's row of buttons on the profile header — geometry, words and the one decision that depends on
 * the screen: whether a label still fits.
 *
 * The owner named the row on 17 October 2026, and narrowed it on 18 October 2026 to exactly two entries:
 *
 *   [Editează profilul — neutral, wide] [⋯ — round, no word]
 *
 * `Monetizează profilul` and `Distribuie profilul` are no longer buttons of the row: both are rows of the
 * `⋯` menu (`lib/profileMenu.ts`), which the round entry opens. The three bars at the top of the header
 * open the same menu, so there is still exactly one index of doors and no second one painted on the row.
 *
 * A label that does not fit is shortened instead of truncated: `Editează profilul` becomes `Editează`.
 * The fit is decided here, in one place, from the width the screen really has and the font scale the
 * reader really uses — so the test can hold both ends of the rule without a phone.
 */

/** The row's measurements, in dp. Every number is used by `ProfileHeader` and asserted by the tests. */
export const OWNER_ROW = Object.freeze({
  /** The owner asked for ~40 dp: a pill, not the 38 dp relation button and not a 44 dp block. */
  height: 40,
  radius: 20,
  gap: 8,
  /** The header's own inset, the same on both sides (`socialTokens.identity.paddingHorizontal`). */
  paddingHorizontal: 14,
  /** The round `⋯` is drawn at 40 dp and aimed at 44 dp (`hitSlop`), like every other target here. */
  menuSize: 40,
  menuTarget: 44,
  /** The three dots, sized so they read as an ellipsis and not as a full stop. */
  menuGlyph: 20,
  labelSize: 14,
  labelWeight: '800' as const,
  /** What a wide button keeps on each side of its word. */
  labelPaddingInline: 12,
});

export const OWNER_ROW_WORDS = Object.freeze({
  edit: 'Editează profilul',
  editShort: 'Editează',
  /**
   * The round entry has no visible word: this is its accessible name and only its name. It is the same
   * sentence the header's three bars use, so a screen reader hears one door with two handles.
   */
  menu: 'Deschide meniul',
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

/** What one wide button can hold: the row minus the insets, the one gap and the round entry. */
export function ownerWideLabelRoom(screenWidth: number): number {
  const usable = Number(screenWidth) - OWNER_ROW.paddingHorizontal * 2 - OWNER_ROW.gap - OWNER_ROW.menuTarget;
  return Math.max(0, usable - OWNER_ROW.labelPaddingInline * 2);
}

export type OwnerRowLabels = { edit: string };

/**
 * The one word of the row for this screen and this font scale. A label that does not fit is replaced by
 * its short form — never cut with an ellipsis, and never scaled down to a size the reader did not ask
 * for. At 469 dp (the phone this project is checked on) the full label fits at every scale the phone
 * offers; the short form exists for narrow phones and for the accessibility scales above 1.3.
 */
export function ownerRowLabels({ screenWidth, fontScale }: { screenWidth: number; fontScale: number }): OwnerRowLabels {
  const room = ownerWideLabelRoom(screenWidth);
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const fits = (label: string) => estimateLabelWidth(label, OWNER_ROW.labelSize * scale) <= room;
  return {
    edit: fits(OWNER_ROW_WORDS.edit) ? OWNER_ROW_WORDS.edit : OWNER_ROW_WORDS.editShort,
  };
}
