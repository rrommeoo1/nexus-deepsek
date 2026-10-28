/**
 * How wide a page's words really are — measured from the faces the phone draws them with.
 *
 * `editorialFlow` has to know the width of a line before React Native draws it: pagination, the room a
 * photograph leaves beside it and the caret's own position are all decided in plain arithmetic. Until
 * 29 October 2026 that arithmetic used a table someone had written by hand (a lowercase letter "about"
 * 0.54 em, a space 0.28, a wide letter 0.86, then a 3.5 % safety on the total). It was the right shape and
 * the wrong numbers: measured against Noto Serif — the face `fontFamilyFor` names on Android — the table
 * over-estimated a Romanian sentence by 2–9 %, so the flow broke every line *earlier* than the paper
 * needed. That is exactly what the owner saw („rândurile se termină prea devreme, deși mai aveau loc"):
 * the last word that would have fitted was already on the next line.
 *
 * The numbers below are not estimates. They were read out of the font files the device itself renders
 * with, on 29 October 2026, from the owner's Xiaomi MIX Flip (`25098PN5AC`, 416 dpi):
 *
 *   serif  `/system/fonts/NotoSerif-Regular.ttf`, `NotoSerif-Bold.ttf` — `fontFamily: 'serif'`
 *   sans   `/system/fonts/MiSansLatinVF.ttf` and `Roboto-Regular.ttf` — `fontFamily: 'sans-serif'`,
 *          which HyperOS answers with one of the two, so every character takes the wider of them;
 *   mono   `/system/fonts/DroidSansMono.ttf` — `fontFamily: 'monospace'`, one advance for every glyph.
 *
 * Each file's `cmap` was asked for the glyph of every character and its `hmtx` for that glyph's advance,
 * divided by the font's own `unitsPerEm`. The values are thousandths of the font size, rounded **up**, so
 * the model can only ever be too wide — never too narrow: a line the flow thinks fits is a line React
 * Native can draw without cutting its last word.
 *
 * Fonts apply kerning and ligatures while shaping, which only ever *removes* width, so ignoring them keeps
 * the model on the safe side; `LINE_SAFETY` adds the last 1.5 % for sub-pixel rounding and for a face the
 * device substitutes for the one named here.
 *
 * A character no table lists — an emoji, a Cyrillic name, a CJK title — takes a class fallback, generous on
 * purpose: a word that is one pixel too wide is a clipped word, a word that is one pixel too narrow is
 * nothing at all.
 *
 * This module imports nothing, so the Node test harness can load it exactly as the renderer does.
 */

export type MetricFace = 'serif' | 'sans' | 'mono';

/**
 * The characters the tables cover, in order: printable ASCII, Latin-1 (the accents of names and of a
 * quotation), then the letters Romanian needs and the punctuation a page of words is set with.
 */
const CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00a0¡¢£¤¥¦§¨©ª«¬\u00ad®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĂăĐđŞşŢţȘșȚț–—‘’“”„•…€™';
/** Noto Serif Regular, thousandths of the font size, in `CHARS` order. */
const SERIF_REGULAR = [
  260, 334, 409, 560, 560, 896, 743, 221, 347, 347, 500, 560, 250, 311, 250, 289,
  560, 560, 560, 560, 560, 560, 560, 560, 560, 560, 287, 287, 560, 560, 560, 500,
  921, 706, 654, 614, 728, 624, 590, 714, 793, 368, 357, 701, 624, 938, 764, 743,
  605, 743, 656, 544, 613, 717, 675, 1047, 661, 625, 592, 360, 289, 360, 560, 459,
  578, 563, 614, 493, 614, 536, 370, 539, 635, 320, 300, 585, 311, 945, 646, 578,
  614, 614, 472, 452, 353, 635, 580, 862, 579, 565, 512, 429, 560, 429, 560, 260,
  334, 560, 560, 560, 560, 560, 544, 578, 846, 382, 515, 560, 311, 846, 459, 400,
  560, 400, 400, 578, 616, 618, 250, 334, 400, 397, 515, 840, 840, 840, 500, 706,
  706, 706, 706, 706, 706, 952, 614, 624, 624, 624, 624, 368, 368, 368, 368, 728,
  764, 743, 743, 743, 743, 743, 560, 743, 717, 717, 717, 717, 625, 605, 647, 563,
  563, 563, 563, 563, 563, 841, 493, 536, 536, 536, 536, 320, 320, 320, 320, 578,
  646, 578, 578, 578, 578, 578, 560, 578, 635, 635, 635, 635, 565, 614, 565, 706,
  563, 728, 614, 544, 452, 613, 353, 544, 452, 613, 353, 500, 1000, 250, 250, 451,
  451, 451, 362, 858, 560, 835,
];

/** Noto Serif Bold — what a heading is drawn with (`fontWeight: '700'`). */
const SERIF_BOLD = [
  260, 382, 508, 560, 560, 906, 801, 291, 400, 400, 502, 560, 294, 311, 294, 289,
  560, 560, 560, 560, 560, 560, 560, 560, 560, 560, 305, 305, 560, 560, 560, 550,
  921, 753, 672, 668, 768, 653, 622, 770, 819, 401, 369, 734, 654, 953, 789, 788,
  639, 788, 708, 586, 653, 748, 699, 1067, 732, 693, 667, 415, 289, 415, 560, 459,
  578, 600, 649, 527, 649, 571, 408, 561, 667, 353, 346, 637, 353, 986, 667, 613,
  646, 648, 523, 488, 405, 667, 606, 856, 646, 580, 529, 442, 560, 442, 560, 260,
  382, 560, 560, 560, 560, 560, 544, 578, 846, 420, 555, 560, 311, 846, 459, 400,
  560, 400, 400, 578, 666, 627, 294, 334, 400, 438, 555, 840, 840, 840, 550, 753,
  753, 753, 753, 753, 753, 994, 668, 653, 653, 653, 653, 401, 401, 401, 401, 768,
  789, 788, 788, 788, 788, 788, 560, 788, 748, 748, 748, 748, 693, 639, 707, 600,
  600, 600, 600, 600, 600, 875, 527, 571, 571, 571, 571, 353, 353, 353, 353, 613,
  667, 613, 613, 613, 613, 613, 560, 613, 667, 667, 667, 667, 580, 646, 580, 753,
  600, 768, 649, 586, 488, 653, 405, 586, 488, 653, 405, 500, 1000, 280, 280, 489,
  489, 489, 400, 913, 560, 835,
];

/** The wider of MiSans and Roboto — whichever of the two `sans-serif` resolves to. */
const SANS_REGULAR = [
  290, 288, 339, 706, 578, 820, 712, 190, 343, 349, 447, 612, 267, 454, 268, 413,
  634, 563, 566, 592, 591, 604, 606, 563, 630, 600, 268, 281, 612, 612, 612, 488,
  898, 666, 660, 693, 741, 587, 559, 734, 721, 272, 552, 639, 564, 880, 736, 776,
  631, 781, 635, 594, 604, 705, 670, 968, 634, 615, 600, 350, 411, 350, 445, 458,
  310, 544, 593, 525, 594, 552, 348, 591, 580, 245, 246, 507, 251, 882, 580, 571,
  593, 594, 375, 517, 355, 580, 505, 791, 497, 513, 497, 351, 245, 351, 681, 290,
  288, 578, 594, 714, 578, 241, 671, 419, 882, 448, 643, 594, 454, 787, 459, 410,
  594, 367, 367, 314, 585, 686, 500, 281, 367, 456, 643, 802, 864, 902, 488, 666,
  666, 666, 666, 666, 666, 971, 693, 587, 587, 587, 587, 272, 272, 272, 272, 772,
  736, 776, 776, 776, 776, 776, 612, 777, 705, 705, 705, 705, 615, 624, 595, 544,
  544, 544, 544, 544, 544, 890, 525, 552, 552, 552, 552, 248, 248, 248, 248, 587,
  580, 571, 571, 571, 571, 571, 612, 572, 580, 580, 580, 580, 513, 593, 513, 666,
  544, 772, 599, 594, 517, 604, 358, 594, 517, 604, 355, 657, 784, 258, 258, 402,
  402, 402, 1000, 1000, 634, 783,
];


/** Droid Sans Mono: every glyph advances 0.601 em, which is the whole point of a monospace face. */
const MONO_SHARE = 0.601;

/**
 * A face with no bold table of its own thickens when the platform asks for one. Noto Serif ships a real bold
 * (`SERIF_BOLD`), so it is never grown by a ratio; MiSans and Roboto answer `sans-serif` and the flow has
 * only their regular advance, hence the classic 4.5 % a synthetic bold adds; mono keeps its advance.
 */
const SANS_BOLD_GROWTH = 1.045;

/**
 * The share of the font size a character no table lists takes.
 *
 * An emoji is drawn by Noto Color Emoji, whose own advance is about 1.28 em; a page that carries one inside
 * its words must not have the model promise room it will not have.
 */
const EMOJI_SHARE = 1.28;
const CJK_SHARE = 1;
const OTHER_SHARE = 0.8;

/**
 * The last margin every line keeps — 1.5 %.
 *
 * The tables are exact advances from the font files; shaping can only *remove* width from them (kerning and
 * ligatures are pairs that overlap), and the platform rounds a laid-out line to its own sub-pixel grid. This
 * margin covers both, and it is far smaller than the 3.5 % the old hand-written table needed: a page that
 * keeps back 1.5 % of 420 dp loses six points of paper, while one that kept 8 % lost thirty.
 */
export const LINE_SAFETY = 1.015;

/** The index of every listed character, so a lookup is a hash and never a scan. */
const INDEX: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  Array.from(CHARS).forEach((char, index) => map.set(char, index));
  return map;
})();

function fallbackShare(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 0x20) return 0.3;
  /** Emoji, and the pictographs the colour-emoji face draws. */
  if (code >= 0x1f000 || (code >= 0x2600 && code <= 0x27bf)) return EMOJI_SHARE;
  if (code >= 0x2e80) return CJK_SHARE;
  return OTHER_SHARE;
}

/**
 * How much of the font size one character takes.
 *
 * `bold` is `fontWeight: '700'` — a heading — and each face answers it its own way: Noto Serif has a real
 * bold table, the sans faces grow by `SANS_BOLD_GROWTH`, a monospace advance does not move.
 */
export function advanceOf(char: string, face: MetricFace, bold = false): number {
  if (face === 'mono') return MONO_SHARE;
  const table = face === 'serif' ? (bold ? SERIF_BOLD : SERIF_REGULAR) : SANS_REGULAR;
  const index = INDEX.get(char);
  const share = index === undefined ? fallbackShare(char) : table[index] / 1000;
  return bold && face === 'sans' ? share * SANS_BOLD_GROWTH : share;
}

/**
 * The width of a run of text at a size, in the page's own points.
 *
 * Additive by design: the flow asks this question thousands of times per page — every word of every line is
 * tried against the room that is left — so it is a sum of advances and never a shaping call.
 */
export function measureRun(text: string, fontSize: number, face: MetricFace, bold = false): number {
  let total = 0;
  for (const char of Array.from(String(text ?? ''))) total += advanceOf(char, face, bold);
  return total * Math.max(0, Number(fontSize) || 0) * LINE_SAFETY;
}

/** The number of characters the tables describe — a test reads it to prove all three agree. */
export const METRIC_CHARS = CHARS.length;

