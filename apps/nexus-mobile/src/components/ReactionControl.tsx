import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SolidViewerIcon } from './SolidViewerIcon';
import { socialTokens } from '../theme/social';
import {
  REACTION_GLYPHS, REACTION_TITLES, SOCIAL_REACTIONS, compactCount, reactionSummary, viewerReaction,
  type ReactionSummary,
} from '../lib/socialTypes';

/**
 * The reaction control of the web, drawn to its own measurements.
 *
 *   app.js:3567,3596-3612   `REACTION_GLYPHS` and the two summary shapes:
 *                           `reactionSummaryMarkup` (up to 3 glyph+count pairs) for a card's action row,
 *                           `viewerReactionSummaryMarkup` (one glyph + the total) for the reader's rail.
 *   app.js:3619-3623        the picker, in `SOCIAL_REACTIONS` order, with the `reaction.*` titles.
 *   profile-experience.css  `.ownerWhisperAction` — the plate a whisper card's row wraps this same summary
 *                           in (`min-height:38px`, `padding:0 10px`, `border-radius:11px`,
 *                           `background:rgba(15,30,49,.5)`), with the glyph at 15px and the count at 12px
 *                           in the plate's own ink, and the palette floating above its own button
 *                           (`.pulsePosts.feedWhispers .whisperCard .reactionBar{bottom:calc(100% + 6px)}`).
 *   feed-surface.css:       `.reactionBar.expanded{grid-template-columns:repeat(4,minmax(0,1fr));gap:7-8px;
 *                           padding:10px;border:1px solid rgba(36,240,210,.3);border-radius:16px;
 *                           background:rgba(5,14,20,.96)}`; on the phone's Reels shell the discs lose their
 *                           plate (`background:transparent`, `border-color:transparent`) and the metric is
 *                           54x42 with rows 35/11; on a card it is 46x46 with the count at 10px/850.
 *   `.phoneScreen:has(.clipsScreen) :is(.clipSolidIcon,.reactionMetric>b)`  transparent discs
 *   `.reactionMetric>b`     52x52 disc, `border 1px rgba(255,255,255,.22)`, `background rgba(9,14,21,.86)`
 *                           (viewer) — kept only where the card is not the phone shell.
 *
 * The untouched primary mark is the crisp white heart of `solidViewerIcon('heart')`; the heart glyph in
 * white is the same mark, without a second icon set. Listed in `docs/parity-report/INDEX.md`.
 */
export function ReactionControl({ summary, onReact, variant = 'card' }: {
  summary?: ReactionSummary | null;
  onReact: (kind: string, active: boolean) => void;
  variant?: 'card' | 'rail' | 'whisper';
}) {
  const [open, setOpen] = useState(false);
  const mine = viewerReaction(summary);
  const compact = reactionSummary(summary?.counts);
  const total = compact.total;
  const rail = variant === 'rail';
  const whisper = variant === 'whisper';

  /** `viewerReactionSummaryMarkup`: the reader's own reaction (or the plain heart) plus the total. */
  const railGlyph = mine && REACTION_GLYPHS[mine] ? REACTION_GLYPHS[mine] : REACTION_GLYPHS.LIKE;

  return (
    <View style={rail ? styles.railWrap : whisper ? [styles.whisperWrap, open && styles.whisperWrapOpen] : styles.cardWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deschide selectorul de reacții"
        accessibilityState={{ expanded: open, selected: Boolean(mine) }}
        onPress={() => setOpen((value) => !value)}
        style={rail ? styles.railButton : whisper ? [styles.whisperButton, mine && styles.whisperButtonOn] : styles.cardButton}
      >
        {rail ? (
          <View style={styles.railDisc}>
            {mine && mine !== 'LIKE'
              ? <Text style={styles.railGlyph}>{railGlyph}</Text>
              : <SolidViewerIcon kind="heart" size={29} />}
          </View>
        ) : (
          <View style={styles.metrics}>
            {compact.entries.map((entry) => (
              <View key={entry.kind} style={styles.metric}>
                <Text style={[styles.metricGlyph, whisper && styles.whisperGlyph, whisper && mine && styles.whisperOn]}>{entry.glyph}</Text>
                <Text style={[styles.metricCount, whisper && styles.whisperCount, whisper && mine && styles.whisperOn]}>{entry.count}</Text>
              </View>
            ))}
          </View>
        )}
        {rail ? <Text style={styles.railCount}>{total > 0 ? compactCount(total) : ''}</Text> : null}
      </Pressable>

      {open ? (
        <View accessibilityLabel="Alege reacția" style={[styles.palette, rail && styles.railPalette, whisper && styles.whisperPalette]}>
          {SOCIAL_REACTIONS.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={REACTION_TITLES[kind] ?? kind}
              accessibilityState={{ selected: mine === kind }}
              onPress={() => {
                setOpen(false);
                onReact(kind, mine !== kind);
              }}
              style={[styles.option, mine === kind && styles.optionOn]}
            >
              <Text style={styles.optionGlyph}>{REACTION_GLYPHS[kind]}</Text>
              <Text style={styles.optionTitle} numberOfLines={1}>{REACTION_TITLES[kind] ?? kind}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  /** `.clipQuickActions` column on the reader's rail; the card keeps its own action row. */
  railWrap: { alignItems: 'center' },
  cardWrap: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  /** `.clipQuickActions>button:not(.clipRailAvatar)` — the reference's 56×56 cell, rows 39px + 14px. */
  railButton: { width: 56, minWidth: 56, height: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1 },
  cardButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  /**
   * `.clipQuickActions :is(.clipSolidIcon,.reactionMetric>b)` 36×36 on the cell's first row — the
   * `grid-template-rows:39px 14px` floor. The disc holds the mark; the 39px row is its own height.
   */
  railDisc: { width: 36, minWidth: 36, height: 39, alignItems: 'center', justifyContent: 'center' },
  /** `.clipQuickActions :is(.viewerSolidSvg,.viewerReactionHeart)` 29×29 — drawn at 28px to fill it. */
  railGlyph: { color: '#ffffff', fontSize: 28, lineHeight: 29 },
  /** `.clipQuickActions :is(button small,.reactionMetric>em){font-size:11px;line-height:14px}` */
  railCount: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  /** `.reactionSummaryGlyphs` — up to three glyph+count pairs, in the order the summary ranked them. */
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metric: { flexDirection: 'row', alignItems: 'center' },
  metricGlyph: { fontSize: 17, lineHeight: 20 },
  metricCount: { color: '#f5f8fa', fontSize: 11, fontWeight: '800' },
  /** `.reactionBar.expanded` — 4 columns, gap 8, padding 10, radius 16, `rgba(5,14,20,.96)`, teal edge. */
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    padding: 10,
    gap: 8,
    width: 280,
    borderWidth: 1,
    borderColor: 'rgba(36,240,210,0.3)',
    borderRadius: 16,
    backgroundColor: 'rgba(5,14,20,0.96)',
  },
  railPalette: { position: 'absolute', right: 64, bottom: 0, marginTop: 0, zIndex: 50 },
  option: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: 12,
  },
  /** `button[aria-pressed=true]` keeps the same plate, only brighter (no disc of its own). */
  optionOn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  optionGlyph: { fontSize: 20, lineHeight: 24 },
  optionTitle: { color: '#cfe0e8', fontSize: 10, fontWeight: '800' },
  /**
   * `.ownerWhisperAction` — the plate a whisper's action row gives the summary, and the one its two other
   * presses wear: `display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 10px;
   * border:1px solid transparent;border-radius:11px;background:rgba(15,30,49,.5);color:#9fb2bc;
   * font-size:12px;font-weight:700`, with `on` reading `border-color:#27dccc;color:#6eecdf`
   * (`docs/web-ref/profile/tab-3.dom.json`: the row at y=751, 38 tall, the three plates 64/43/49 wide).
   *
   * The wrapper is what the palette needs: the web floats it above its own button, so it must not push the
   * row it was opened from. It carries the stacking order only while it is open, so a closed plate can
   * never sit above a neighbour.
   */
  whisperWrap: { position: 'relative' },
  whisperWrapOpen: { zIndex: 60 },
  whisperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: socialTokens.archive.actionMinHeight,
    paddingHorizontal: socialTokens.archive.actionPaddingHorizontal,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: socialTokens.archive.actionRadius,
    backgroundColor: socialTokens.archive.actionSurface,
  },
  whisperButtonOn: { borderColor: socialTokens.archive.actionOnBorder },
  /** `.ownerWhisperAction .reactionSummaryGlyphs .reactionMetric b{font-size:15px}` with `em{font-size:12px}`. */
  whisperGlyph: { color: socialTokens.archive.actionInk, fontSize: socialTokens.archive.actionMetricGlyphSize, lineHeight: 18 },
  whisperCount: { color: socialTokens.archive.actionInk, fontSize: socialTokens.archive.actionMetricCountSize, fontWeight: '800' },
  /** Both parts `color:inherit`, so the plate's `on` ink paints the summary it holds. */
  whisperOn: { color: socialTokens.archive.actionOnInk },
  /** `.reactionBar.expanded` floats: `bottom:calc(100% + 6px)` over a 38px plate. */
  whisperPalette: { position: 'absolute', left: 0, bottom: socialTokens.archive.actionMinHeight + 6, marginTop: 0, zIndex: 60 },
});

