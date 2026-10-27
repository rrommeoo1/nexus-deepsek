import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  REACTION_PICKER_GLYPHS, REACTION_TITLES, SOCIAL_REACTIONS,
} from '../lib/socialTypes';
import { PICKER_CELL, PICKER_EDGE, PICKER_GROW, PICKER_LIFT, type PickerAnchor } from '../lib/reactionPicker';

/**
 * The reaction panel, drawn the way the owner pointed at (19 October 2026).
 *
 * The old panel was a 4×2 grid of eight glyphs, each with its name printed under it, on a heavy plate
 * that read as a menu. The owner asked for something finer and for a heart that is not "sters", and
 * sent a picture of the phone's own bar: one thin pill of emoji, no names, and the emoji under the
 * finger grown a little. So this draws exactly that:
 *
 *   · one pill — eight cells of `PICKER_CELL`, one `PICKER_EDGE` of padding, a translucent surface and
 *     one hairline of the brand's teal (`rgba(36,240,210,.3)`), the edge the web's
 *     `.reactionBar.expanded` carries, and never a name under an emoji;
 *   · the reaction the viewer already chose keeps a faint teal cell, so the panel says what is on;
 *   · the emoji under the finger is the only one that grows (`1.3`) and that lifts out of the line — and
 *     it is the only one that prints its name, in a chip above the pill.
 *
 * The row is the only shape, at the owner's second correction: the "column" beside a clip opened
 * upward and he asked it to open **horizontally** like the one under a page of words. What changes
 * between the two zones is the edge the first emoji sits on (`anchor`), so that the emoji under the
 * thumb that opened the panel is always the first one — on the right beside a clip's rail and above the
 * plate at the right end of a text page's bar, on the left above a card's plate
 * (`lib/reactionPicker.ts` measures from the same edge).
 *
 * The panel draws; it does not decide. `motion` arrives from `ReactionControl`, which owns the one
 * gesture that opened it: it is the finger's *continuous* position along the row, in cells, and every
 * face's size is an interpolation of it — so the emoji nearest the finger grows while it is still on
 * its way there, and its neighbours shrink progressively (owner's sixth correction, 27 October 2026:
 * "emoji-ul de sub deget trebuie să crească ... continuu"). `hover` is the *cell* the thumb is over —
 * the one the chip names and a release chooses — so the growth can never disagree with the choice, and
 * a state change is still paid only when the cell really changes. `hover` is `-1` while the thumb is
 * off the pill: then nothing is named and the release that follows chooses nothing (owner's third
 * correction: lifting the finger off the reaction cancels it).
 */
export function ReactionPalette({ anchor = 'left', motion, hover, mine, onPick }: {
  /** The edge the first emoji sits on: `right` beside a clip's rail and at the right end of a page's bar, `left` under a card's row. */
  anchor?: PickerAnchor;
  /**
   * The finger along the row, in cells, as an animated value the control writes on every move. `-1`
   * parks the growth on no cell at all, so every emoji is at rest.
   */
  motion: Animated.Value;
  /** The index of the reaction under the finger; `-1` when the thumb is off the pill. */
  hover: number;
  /** The viewer's own reaction, if any: its cell stays lit. */
  mine?: string | null;
  onPick: (kind: string) => void;
}) {
  /**
   * The first emoji sits at the edge the thumb is on: the row grows away from the finger.
   */
  const order = anchor === 'right' ? [...SOCIAL_REACTIONS].reverse() : [...SOCIAL_REACTIONS];

  return (
    <View accessibilityLabel="Alege reacția" style={styles.pill}>
      {order.map((kind) => {
        const index = SOCIAL_REACTIONS.indexOf(kind);
        const grow = motion.interpolate({
          inputRange: [index - 1, index, index + 1], outputRange: [1, PICKER_GROW, 1], extrapolate: 'clamp',
        });
        const lift = motion.interpolate({
          inputRange: [index - 1, index, index + 1], outputRange: [0, PICKER_LIFT, 0], extrapolate: 'clamp',
        });
        /**
         * `scaleX`/`scaleY` rather than the `scale` shorthand: React Native 0.86's native driver
         * flattens a transform into single style props before validating it, and its allowlist names
         * the two axes but not the shorthand — the shorthand animates on the JS driver only (the
         * device printed "Style property 'scale' is not supported by native animated module").
         */
        const transform = [{ scaleX: grow }, { scaleY: grow }, { translateY: lift }];
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={REACTION_TITLES[kind] ?? kind}
            accessibilityState={{ selected: mine === kind }}
            onPress={() => onPick(kind)}
            style={[styles.cell, mine === kind && styles.cellOn, hover === index && styles.cellHover]}
          >
            <Animated.Text style={[styles.glyph, styles.mark, transform]}>
              {REACTION_PICKER_GLYPHS[kind] ?? REACTION_GLYPHS_FALLBACK[kind]}
            </Animated.Text>
            {hover === index ? (
              <View pointerEvents="none" style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text numberOfLines={1} style={styles.chipText}>{REACTION_TITLES[kind] ?? kind}</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The web's own glyphs, only if the picker set were ever missing a kind. */
const REACTION_GLYPHS_FALLBACK: Record<string, string> = {
  LIKE: '\u2665', LOVE: '\u{1F497}', HAHA: '\u{1F602}', WOW: '\u{1F62E}',
  SAD: '\u{1F622}', ANGRY: '\u{1F620}', FAKE_OPINION: '\u25C6', DISLIKE: '\u25BC',
};

const styles = StyleSheet.create({
  /** One thin pill: the panel is a gesture, not a menu — no title, no column of names, one edge. */
  pill: {
    flexDirection: 'row',
    padding: PICKER_EDGE,
    borderRadius: PICKER_CELL + PICKER_EDGE - 6,
    backgroundColor: 'rgba(9,16,23,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(36,240,210,0.3)',
    elevation: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  cell: {
    width: PICKER_CELL,
    height: PICKER_CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PICKER_CELL / 2,
  },
  /** The viewer's own reaction: a faint teal cell, so the panel opens saying what is already on. */
  cellOn: { backgroundColor: 'rgba(127,240,230,0.14)' },
  /** The emoji under the finger: one step lighter than its neighbours, never a plate of its own. */
  cellHover: { backgroundColor: 'rgba(255,255,255,0.09)' },
  glyph: { fontSize: 26, lineHeight: 32 },
  /** Only the two geometric kinds carry ink; a coloured emoji ignores it (`FAKE_OPINION`, `DISLIKE`). */
  mark: { color: '#e7f3f7', textAlign: 'center' },
  /** The name of the emoji under the finger, above the bar (the web's `reaction.*` words). */
  chipRow: { position: 'absolute', left: 0, right: 0, bottom: PICKER_CELL - 4, alignItems: 'center' },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(8,14,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipText: { color: '#dff1f6', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
});
