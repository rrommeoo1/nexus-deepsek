import { useEffect, useRef, useState, type ElementRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactionPalette } from './ReactionPalette';
import { SolidViewerIcon } from './SolidViewerIcon';
import { socialTokens, type ControlTone } from '../theme/social';
import {
  REACTION_EMPTY_HEART, REACTION_EMPTY_HEART_ON_PAPER, REACTION_PICKER_GLYPHS, SOCIAL_REACTIONS, compactCount,
  reactionSummary, viewerReaction,
  type ReactionSummary,
} from '../lib/socialTypes';
import { PICKER_HOLD_MS, pickerIndexAt, pickerPositionAt, type PickerAnchor, type PickerBox } from '../lib/reactionPicker';
import { describeReactionTrace, traceReaction, type ReactionTraceKind } from '../lib/reactionTrace';

/**
 * How an untouched Like press is drawn (`PostRail.heart`, `ReactionControl.heart`).
 *
 * `mark` is the drawn silver heart of round 31 — the same ink as the three presses under it. `emoji` is
 * the white-heart emoji the immersive Reels rail has always printed and which the owner asked not to
 * disturb; nothing else uses it.
 */
export type ReactionHeart = 'mark' | 'emoji';

/**
 * The reaction control of the web, drawn to its own measurements — and the panel the owner asked for
 * (19 October 2026).
 *
 * What the web gave it:
 *
 *   app.js:3567,3596-3612   `REACTION_GLYPHS` and the two summary shapes:
 *                           `reactionSummaryMarkup` (up to 3 glyph+count pairs) for a card's action row,
 *                           `viewerReactionSummaryMarkup` (one glyph + the total) for the reader's rail.
 *   app.js:3619-3623        the picker, in `SOCIAL_REACTIONS` order, with the `reaction.*` titles.
 *   feed-surface.css        `.reactionBar.expanded{grid-template-columns:repeat(4,minmax(0,1fr));
 *                           gap:7-8px;padding:10px;border:1px solid rgba(36,240,210,.3);
 *                           border-radius:16px;background:rgba(5,14,20,.96)}`; on the phone's Reels shell
 *                           the discs lose their plate and the metric is 54x42 with rows 35/11; on a card
 *                           it is 46x46 with the count at 10px/850.
 *   profile-experience.css  `.ownerWhisperAction` — the plate a whisper's row wraps this summary in, and
 *                           `.whisperCard .reactionBar{bottom:calc(100% + 6px)}` for its panel.
 *
 * What the owner changed: the panel is no longer a menu of eight glyphs with their names under them,
 * opened by tapping the plate. It is held open, and the thumb chooses: a short press is the like the
 * plate always was, a hold of `PICKER_HOLD_MS` opens `ReactionPalette` over the plate, sliding the thumb
 * grows the emoji it passes (`lib/reactionPicker.ts` turns the finger into an index — one horizontal
 * row in both zones, at the owner's second correction, growing left from a clip's rail and, since the
 * bar's like moved to the right end of the page's line, left from that plate too), and letting go
 * chooses it — or chooses nothing, if the thumb has left the pill
 * (his third: lifting the finger off the reaction cancels it, and no release may force an icon).
 *
 * One gesture, one responder: the wrapper takes the touch at the start
 * (`onStartShouldSetResponderCapture`) and keeps it until the finger lifts, so the plate and the panel
 * it opens are never two different responders and the thumb never has to start again. It hands the
 * gesture back while the panel is closed (`onResponderTerminationRequest: () => !open`), so a scroll
 * begun on the plate still scrolls the feed, and a thumb that travels before the hold cancels the hold.
 */
export function ReactionControl({ summary, onReact, variant = 'card', tone = 'night', heart = 'mark', onPanelChange }: {
  summary?: ReactionSummary | null;
  onReact: (kind: string, active: boolean) => void;
  /**
   * The page above can stop turning while the panel is open: the row's panel is dragged *along the
   * page*, and a pager would otherwise steal that drag at the native level, before any JavaScript
   * could refuse it (seen on the device with the old column, 19 October 2026). A floating bar needs
   * nothing, but the announcement costs one state change per open.
   */
  onPanelChange?: (open: boolean) => void;
  /**
   * `rail` is the reader's vertical column of actions beside a picture, a clip or a page of words; `row` is
   * the compact horizontal line a *card* carries under its words (`PostActionRow` in a 9:16 cell).
   * `whisper` and `card` are the two plates of the archive and the feed cards. The summary is the same in
   * all four — only the surface and the edge the panel grows from change (the rail's press stands at the
   * right of the screen, so its row grows left). The `bar` variant a page of words used to pass here is gone
   * with the footer the owner rejected (20 October 2026): a page's presses are the rail now (`PostRail`).
   */
  variant?: 'card' | 'rail' | 'whisper' | 'row';
  /**
   * The ground the reaction's own reading stands on (`socialTokens.post.controls`) — the paper of a page of
   * words or the night of a photograph, a clip and the profile's field. Told by the page that mounts the
   * rail (`PostRail.tone`), because a press drawn over a page can see no background of its own. The card's
   * plate, a whisper's and a row's lie on a surface their own component owns, so they ignore it.
   */
  tone?: ControlTone;
  /**
   * How the untouched press is drawn on the rail (round 31).
   *
   * `mark` draws the empty heart as a *mark* in the ground's own silver — the same ink `PostRail` hands
   * Comment, Save and Share, so the four presses are one family. `emoji` keeps the white-heart emoji the
   * immersive rail has always printed (`ReelsReader` asks for it), because the owner asked for Reels not
   * to be touched and its heart was never the reported defect.
   */
  heart?: ReactionHeart;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  /** The page above is told only when the state really changes, never on every hover. */
  useEffect(() => {
    onPanelChange?.(open);
  }, [open, onPanelChange]);
  const mine = viewerReaction(summary);
  const compact = reactionSummary(summary?.counts);
  const total = compact.total;
  const rail = variant === 'rail';
  const whisper = variant === 'whisper';
  const row = variant === 'row';
  /**
   * The edge the panel grows from: the plate of a *card* is at the left of its row, the rail's press is at
   * the right of the screen, so the rail grows to the left and its first emoji is the one under the thumb
   * that opened it. Both zones read the same way in `pickerIndexAt`.
   */
  const anchor: PickerAnchor = rail ? 'right' : 'left';
  /**
   * The one press of the rail that wears **no plate** (owner, 28 October 2026: the background behind the
   * emoji was the thing he refused — „fără fundal în spatele emoji-urilor"). The silver-and-graphite round
   * had given the like the same squircle as the four presses under it; the emoji *is* the press, so the
   * squircle, its hairline and its shadow are gone from this cell and from this cell only — comment, save
   * and share keep the material (`PostRail`).
   *
   * A reaction still has a state, and the state is the glyph itself: the empty heart of an untouched press
   * (`REACTION_EMPTY_HEART`, or its graphite twin on paper) and the chosen face for everything else. No
   * second filled plate stands in for the one that was removed.
   *
   * The ink is the press's own reading — the count under the glyph, and the fallback colour of the glyph
   * itself (an emoji paints itself, but a missing one must not print black on cream or silver on night).
   *
   * It does **not** turn over with the reaction any more (29 October 2026): an ink that inverted was the
   * second half of a plated press — white on the dark plate a taken press used to wear — and with the plate
   * gone it printed a near-white count on cream (`inkOn` is `#F4F3ED` on the paper ground). The state is the
   * glyph, so the colour of both the glyph and its count is the ground's.
   */
  const railInk = tone === 'paper' ? styles.railPaperInk : styles.railNightInk;

  /**
   * The ink of a *mark* on this ground — the one `PostRail` already gives Comment, Save and Share, so the
   * drawn empty heart of the Like press is literally the same colour as the three marks under it.
   */
  const markInk = socialTokens.post.controls[tone].mark;

  /**
   * The press's own mark: the viewer's reaction, or the empty heart of a press nobody has touched.
   *
   * The web's `viewerReactionHeart` was a white *outline* mark, which the owner read as "sters" on a
   * dark plate, so the press prints `REACTION_PICKER_GLYPHS` (the panel's own faces) — but the untouched
   * press keeps a white heart on purpose (owner, 19 October 2026: after the second tap on a like
   * "trebuie sa ramana inima alba, nu rosie"). A red heart here was `LOVE`'s own face, so a like that
   * had just been taken back looked exactly like one that still carried it. The emoji is the whole
   * state: the empty heart for nothing chosen, the chosen face for everything else — the green ring that
   * used to mark "on" is gone (`scoate-l`).
   *
   * On a page of words the empty heart follows the ground (owner, 28 October 2026): the rail there has no
   * plate behind it any more, so a *white* heart would be a white shape on cream paper. The graphite twin
   * says the same thing — „nimic ales" — in the colour the page can actually show.
   */
  const plateGlyph = mine
    ? (REACTION_PICKER_GLYPHS[mine] ?? REACTION_PICKER_GLYPHS.LIKE)
    : rail && tone === 'paper'
      ? REACTION_EMPTY_HEART_ON_PAPER
      : REACTION_EMPTY_HEART;

  /** The panel's rectangle in window coordinates — measured every time it opens (`pickerIndexAt`). */
  const box = useRef<PickerBox>({ x: 0, y: 0, width: 0, height: 0 });
  /**
   * The press's own rectangle, in the same coordinates. Since the row floats *above* the rail's press
   * (the owner's fourth correction), the thumb that holds it is below the pill — and still on the
   * press. That rectangle is handed to `pickerIndexAt`, which reads the row and the press as one
   * corridor for the thumb, so a slide never reads as "off the reaction" just because the row was
   * lifted clear of the finger.
   */
  const plateBox = useRef<PickerBox>({ x: 0, y: 0, width: 0, height: 0 });
  const plate = useRef<ElementRef<typeof View>>(null);
  const palette = useRef<ElementRef<typeof View>>(null);
  const hoverRef = useRef(0);
  /**
   * The finger along the row, in cells, as a value the panel interpolates every face's size from.
   *
   * It is written on every move (`setValue`) and never through `setState`: a thumb that slides across
   * the row would otherwise re-render the whole panel sixty times a second. The *cell* under the finger
   * is still state (`hover`), because the name chip and the chosen reaction may only change when the
   * cell does — one re-render per emoji, not per pixel.
   */
  const motion = useRef(new Animated.Value(0)).current;
  /** The gesture that is down right now: where it began, and whether it is the one that opened the panel. */
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; opened: boolean }>({
    timer: null, x: 0, y: 0, opened: false,
  });

  const measurePlate = () => {
    plate.current?.measureInWindow((x, y, width, height) => {
      plateBox.current = { x, y, width, height };
    });
  };

  const measure = () => {
    measurePlate();
    palette.current?.measureInWindow((x, y, width, height) => {
      box.current = { x, y, width, height };
      /**
       * The panel opens on the first emoji — the one under the thumb — and `measure` moves the growth
       * to the cell the thumb really is on. A thumb still on the plate reports no cell (`-1`), which is
       * why the opening growth stays where `present` put it instead of vanishing under the finger.
       */
      const point = { x: press.current.x, y: press.current.y };
      const at = pickerPositionAt(
        box.current, point, anchor, SOCIAL_REACTIONS.length, plateBox.current,
      );
      if (at >= 0) {
        motion.setValue(at);
        aim(pickerIndexAt(box.current, point, anchor, SOCIAL_REACTIONS.length, plateBox.current));
      }
    });
  };

  /**
   * The emoji the thumb points at: the only state a move writes, and only when it really changed.
   * `-1` is a real answer — the thumb has left the pill — so the growth clears and a release from
   * there chooses nothing.
   */
  const aim = (index: number) => {
    if (index === hoverRef.current) return;
    hoverRef.current = index;
    setHover(index);
    note('aim', { cell: index });
  };

  /**
   * The panel opens on the first emoji — the one drawn under the thumb, at the left of a page's bar and
   * at the right of a clip's row — and `measure` moves the growth to the cell the thumb really is on.
   * The thumb owns the choice from the first frame, so a hold and a release never land on a reaction
   * the owner did not point at. The plate is measured with it: the row is lifted clear of the finger,
   * and the plate it grew from is what keeps the finger "on" the choice.
   */
  const present = () => {
    measurePlate();
    hoverRef.current = 0;
    /**
     * The row opens with the first emoji grown — the one drawn under the thumb — and `motion` starts on
     * it, so the first frame after opening is already the magnified face rather than a row at rest.
     */
    motion.setValue(0);
    setHover(0);
    setOpen(true);
  };

  const choose = (kind: string) => {
    setOpen(false);
    onReact(kind, mine !== kind);
  };

  /**
   * The gesture's own record (`lib/reactionTrace.ts`), written on every decision and *never* on a pixel:
   * a developer reads it from Metro to see whether the phone gave the gesture to the pager, to the video
   * or to the control. It is the only way to answer "works on words, fails on a clip" with evidence.
   */
  const note = (kind: ReactionTraceKind, detail: { cell?: number; x?: number; y?: number } = {}) => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console
    console.log(describeReactionTrace(traceReaction(kind, variant, { ...detail, open })));
  };

  const stopTimer = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };

  /** One gesture from the plate to the panel: the same hand, the same touch, the same decision. */
  const grip = {
    onStartShouldSetResponderCapture: () => true,
    onResponderTerminationRequest: (event: GestureResponderEvent) => {
      const kept = !open;
      note('request', { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
      return kept;
    },
    onResponderGrant: (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      stopTimer();
      press.current = { timer: null, x: pageX, y: pageY, opened: false };
      note('grant', { x: pageX, y: pageY });
      if (open) return;
      press.current.timer = setTimeout(() => {
        press.current.timer = null;
        press.current.opened = true;
        note('hold', { x: press.current.x, y: press.current.y });
        present();
      }, PICKER_HOLD_MS);
    },
    onResponderMove: (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      if (!open) {
        /** A thumb that travels before the hold is a scroll or a swipe, never a decision. */
        if (Math.abs(pageX - press.current.x) > 10 || Math.abs(pageY - press.current.y) > 10) stopTimer();
        return;
      }
      /**
       * Two answers from one finger, and both are needed: the *fraction* (`pickerPositionAt`) feeds the
       * magnifier on every frame — that is what makes the nearest face grow while the thumb is still
       * travelling towards it — and the *cell* (`pickerIndexAt`) is the state, written only when the
       * finger really crosses into another emoji, so the name above the row and the release's choice
       * change once per emoji and not once per pixel.
       */
      const point = { x: pageX, y: pageY };
      const at = pickerPositionAt(box.current, point, anchor, SOCIAL_REACTIONS.length, plateBox.current);
      motion.setValue(at);
      aim(pickerIndexAt(box.current, point, anchor, SOCIAL_REACTIONS.length, plateBox.current));
    },
    onResponderRelease: () => {
      stopTimer();
      note('release', { cell: press.current.opened ? hoverRef.current : -1 });
      if (!open) {
        /** A short press is the like the plate always was. */
        onReact('LIKE', mine !== 'LIKE');
        return;
      }
      /** The emoji the thumb last pointed at — never the finger's raw position, which may be stale. */
      const kind = hoverRef.current >= 0 ? SOCIAL_REACTIONS[hoverRef.current] : null;
      /**
       * The thumb left the pill and let go: the panel closes unanswered. The owner asked for exactly
       * this — a release off the reactions cancels them, and nothing forces a choice.
       */
      if (!kind) {
        setOpen(false);
        return;
      }
      choose(kind);
    },
    onResponderTerminate: () => {
      stopTimer();
      note('terminate', { cell: hoverRef.current });
      /** A scroll took the gesture: the panel closes unanswered, never a reaction nobody chose. */
      if (press.current.opened) setOpen(false);
    },
  };

  return (
    <View
      ref={plate}
      collapsable={false}
      {...grip}
      style={rail
        ? styles.railWrap
        : row
          ? [styles.rowWrap, open && styles.rowWrapOpen]
          : whisper
            ? [styles.whisperWrap, open && styles.whisperWrapOpen]
            : styles.cardWrap}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deschide selectorul de reacții"
        accessibilityHint="Ține apăsat pentru a alege o reacție"
        accessibilityState={{ expanded: open, selected: Boolean(mine) }}
        /** Accessibility activation (a screen reader's click) still opens the panel it always did. */
        onPress={() => (open ? setOpen(false) : present())}
        style={rail
          ? styles.railButton
          : row
            ? [styles.rowButton, mine && styles.rowButtonOn]
            : whisper
              ? [styles.whisperButton, mine && styles.whisperButtonOn]
              : styles.cardButton}
      >
        {rail ? (
          <View style={styles.railDisc}>
            {!mine && heart === 'mark'
              ? <SolidViewerIcon kind="heartLine" size={socialTokens.reels.railIconSize} color={markInk} />
              : <Text style={[styles.railGlyph, railInk]}>{plateGlyph}</Text>}
          </View>
        ) : (
          <View style={styles.metrics}>
            {compact.entries.map((entry) => (
              <View key={entry.kind} style={styles.metric}>
                <Text style={[
                  styles.metricGlyph,
                  whisper && styles.whisperGlyph,
                  row && styles.rowGlyph,
                  whisper && mine && styles.whisperOn,
                  row && mine && styles.rowOn,
                ]}>{REACTION_PICKER_GLYPHS[entry.kind] ?? entry.glyph}</Text>
                <Text style={[
                  styles.metricCount,
                  whisper && styles.whisperCount,
                  row && styles.rowCount,
                  whisper && mine && styles.whisperOn,
                  row && mine && styles.rowOn,
                ]}>{entry.count}</Text>
              </View>
            ))}
          </View>
        )}
        {rail ? <Text style={[styles.railCount, railInk]}>{total > 0 ? compactCount(total) : ''}</Text> : null}
      </Pressable>

      {open ? (
        /**
         * The panel floats over its own plate and never moves the row it was opened from. The holder is
         * the view `measureInWindow` reads, so it must not be collapsed by the platform.
         */
        <View
          ref={palette}
          collapsable={false}
          onLayout={measure}
          style={[
            styles.paletteSlot,
            rail && styles.railPalette,
            whisper && styles.whisperPalette,
            row && styles.rowPalette,
          ]}
        >
          <ReactionPalette anchor={anchor} motion={motion} hover={hover} mine={mine} onPick={choose} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.clipQuickActions` column on the reader's rail; the card keeps its own action row. */
  railWrap: { alignItems: 'center' },
  cardWrap: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  /**
   * `.clipQuickActions>button:not(.clipRailAvatar)` — the reference's 56×56 cell, rows 39px + 14px.
   *
   * It is the press that lost its plate first (owner, 28 October 2026: the background behind the emoji is
   * what he refused — „fără fundal în spatele emoji-urilor"). The squircle, its hairline and the surface the
   * silver-and-graphite round had put here are gone; the cell, its disc and its metric row stay, so the emoji
   * is exactly as easy to hit as before. Since 29 October 2026 the three presses under it are unboxed too, so
   * the whole column is four glyphs on the page (`PostRail`).
   */
  railButton: { width: 56, minWidth: 56, height: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1 },
  /**
   * The ink of the count under the glyph — and the fallback colour of a glyph that has no face of its own.
   *
   * One ink per ground, in both states: with no plate to invert, an inverted ink would print a near-white
   * count on cream (`paper.inkOn`) or a graphite one on a photograph (`night.inkOn`).
   */
  railPaperInk: { color: socialTokens.post.controls.paper.count },
  railNightInk: { color: socialTokens.post.controls.night.count },
  cardButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  /**
   * `.clipQuickActions :is(.clipSolidIcon,.reactionMetric>b)` 36×36 on the cell's first row — the
   * `grid-template-rows:39px 14px` floor. The disc holds the mark; the 39px row is its own height.
   */
  railDisc: { width: 36, minWidth: 36, height: 39, alignItems: 'center', justifyContent: 'center' },
  /**
   * `.viewerReactionHeart` was a 29px white outline mark; the owner asked for the emoji instead, so the
   * glyph paints itself and the ground supplies only the fallback ink (`railInk`).
   */
  railGlyph: { fontSize: 26, lineHeight: 32, textAlign: 'center' },
  /** `.clipQuickActions :is(button small,.reactionMetric>em){font-size:11px;line-height:14px}` */
  railCount: { fontSize: 11, fontWeight: '800', lineHeight: 14 },
  /** `.reactionSummaryGlyphs` — up to three glyph+count pairs, in the order the summary ranked them. */
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metric: { flexDirection: 'row', alignItems: 'center' },
  metricGlyph: { fontSize: 17, lineHeight: 20 },
  metricCount: { color: '#f5f8fa', fontSize: 11, fontWeight: '800' },
  /**
   * The panel's holder. It floats above its own plate — the panel is a gesture, so it must never move
   * the row it was opened from — and carries no surface of its own: the pill is `ReactionPalette`.
   */
  paletteSlot: { marginTop: 6 },
  /**
   * Beside the rail, the row floats *above* the plate (the owner's fourth and fifth corrections, 19
   * October 2026, and his sixth on 27 October 2026). Held at the plate's own height the finger covered
   * the emoji it was choosing, and he asked for the row "puțin mai sus" — he could not see the reaction
   * his thumb was pointing at while sliding left. The holder is the plate's own 56dp cell
   * (`railButton`), so `bottom` is that cell plus 30dp of air: the pill ends 30dp above the plate's top
   * edge, which clears both a resting thumb and the grown emoji that lifts another 10dp out of the row.
   * `right: 64` leaves the pill's right edge 8dp left of the plate's own edge, in one column with it.
   */
  railPalette: { position: 'absolute', right: 64, bottom: 56 + 30, marginTop: 0, zIndex: 50 },

  /**
   * `.ownerWhisperAction` — the plate a whisper's action row gives the summary, and the one its two other
   * presses wear: `display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 10px;
   * border:1px solid transparent;border-radius:11px;background:rgba(15,30,49,.5);color:#9fb2bc;
   * font-size:12px;font-weight:700`, with `on` reading `border-color:#27dccc;color:#6eecdf`
   * (`docs/web-ref/profile/tab-3.dom.json`: the row at y=751, 38 tall, the three plates 64/43/49 wide).
   *
   * The wrapper is what the panel needs: it floats above its own button, so it must not push the row it
   * was opened from. It carries the stacking order only while it is open, so a closed plate can never
   * sit above a neighbour.
   */
  whisperWrap: { position: 'relative' },
  whisperWrapOpen: { zIndex: 60 },
  whisperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: socialTokens.archive.actionGap,
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
  /** `.reactionBar` floats: `bottom:calc(100% + 6px)` over a 38px plate, raised to 18dp on the phone. */
  whisperPalette: { position: 'absolute', left: 0, bottom: socialTokens.archive.actionMinHeight + 18, marginTop: 0, zIndex: 60 },

  /**
   * The post's action row (`variant="row"`). A picture is read with the thumb already on the words, so the
   * plate lies flat beside its neighbours: one line, a finger's height, the same 11px summary the archive
   * uses. It keeps `position:relative` for the same reason `whisperWrap` does — the panel must float.
   */
  rowWrap: { position: 'relative' },
  rowWrapOpen: { zIndex: 60 },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: socialTokens.post.action.gap,
    minHeight: socialTokens.post.action.minHeight,
    paddingHorizontal: socialTokens.post.action.paddingInline,
    borderWidth: 1,
    borderColor: socialTokens.post.action.border,
    borderRadius: socialTokens.post.action.radius,
    backgroundColor: socialTokens.post.action.surface,
  },
  rowButtonOn: { borderColor: socialTokens.post.action.borderOn, backgroundColor: socialTokens.post.action.surfaceOn },
  rowGlyph: { color: socialTokens.post.action.ink, fontSize: socialTokens.post.action.glyph, lineHeight: socialTokens.post.action.glyphLine },
  rowCount: { color: socialTokens.post.action.ink, fontSize: socialTokens.post.action.count, fontWeight: '800' },
  rowOn: { color: socialTokens.post.action.inkOn },
  /** Opened above the row's plate (34px) with 18dp of air, so the thumb never hides the grown face. */
  rowPalette: { position: 'absolute', left: 0, bottom: socialTokens.post.action.minHeight + 18, marginTop: 0, zIndex: 60 },
});
