import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { bandCopies, bandCycleMs, bandItems, bandLabel, bandRows, type BandItem, type BandRow } from '../lib/profileBand';
import { bandPositionAt, bandResumePlan, bandSignature, type BandSegment } from '../lib/bandMotion';
import { useBandScrolling } from '../lib/bandPrefs';
import type { ProfileView } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The profile's band, under the header's buttons: one slow line carrying the description, the place, the
 * month the account was created, the age and the kind of account (`MIGRATION.md` §20.1). It travels
 * leftwards in a loop with no visible seam — the run is followed by copies of itself, and the translation
 * restarts exactly where a copy stands where the first one did.
 *
 * Four things this component is careful about:
 *
 *   1. the clock. The age is derived at every render from the date of birth, and a new day is not an
 *      event anything announces — so the band re-reads the clock at the local midnight and whenever the
 *      app comes back to the foreground (`AppState`), which is when a birthday could have happened;
 *   2. the pace. `bandCycleMs` keeps the 48 seconds of the web's band on a 360-wide column, so a longer
 *      description travels at the same speed instead of finishing sooner;
 *   3. the pause. A touch stops the line exactly where it stands and the next one sends it on from the
 *      same point; the motion never depends on the system's animation settings, only on the reader's own
 *      `Banda derulantă` switch (`MIGRATION.md` §20.2, `lib/bandMotion.ts`). The position is arithmetic
 *      over a start point and a clock, never a read of the native animated value;
 *   4. the reading. The whole line is one control for the screen reader, the travelling copies are hidden
 *      from it, and the sheet opens from its own `ⓘ` — a 44dp target at the right end of the band — so a
 *      tap on the words means "pause", not "open a panel".
 */

const { band } = socialTokens;

export function ProfileBand({ profile }: { profile: ProfileView }) {
  const [clock, setClock] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  /**
   * The reader's pause, remembered against the words it was asked for: a different profile or an edit is
   * a different line, so it starts unpaused without an effect that would reset it after the fact.
   */
  const [pausedFor, setPausedFor] = useState<string | null>(null);
  const scrolling = useBandScrolling();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { setClock(Date.now()); schedule(); }, Math.max(1000, midnight.getTime() - now.getTime()));
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') setClock(Date.now()); });
    return () => { if (timer) clearTimeout(timer); subscription.remove(); };
  }, []);

  const rows = useMemo(() => bandRows(profile, clock), [profile, clock]);
  const items = useMemo(() => bandItems(rows), [rows]);
  const signature = useMemo(() => bandSignature(items), [items]);
  const paused = pausedFor === signature;

  if (!items.length) return null;

  return (
    <>
      <View style={styles.band}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scrolling && paused ? `${bandLabel(items)} (bandă oprită)` : bandLabel(items)}
          accessibilityHint={scrolling
            ? (paused ? 'Atinge pentru a porni banda' : 'Atinge pentru a opri banda')
            : 'Banda este oprită din meniu'}
          disabled={!scrolling}
          onPress={() => setPausedFor(paused ? null : signature)}
          style={styles.touch}
        >
          <BandTrack items={items} signature={signature} scrolling={scrolling} paused={paused} />
        </Pressable>
        {scrolling ? <BandFade /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Detalii profil"
          accessibilityHint="Deschide toate detaliile profilului"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 0 }}
          onPress={() => setOpen(true)}
          style={styles.info}
        >
          <Text accessible={false} style={styles.infoGlyph}>ⓘ</Text>
        </Pressable>
      </View>
      <ProfileBandSheet visible={open} rows={rows} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The fade the `ⓘ` sits on, so a reading does not run into the icon. It is a real gradient over the
 * band's own surface (`react-native-svg`, already the app's drawing library), drawn from transparent to
 * the colour that surface resolves to on black, and it never takes a touch.
 */
function BandFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="bandFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={band.fadeInk} stopOpacity={0} />
            <Stop offset="1" stopColor={band.fadeInk} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#bandFade)" />
      </Svg>
    </View>
  );
}

/**
 * One run of readings and the copies that close the loop behind it. The strip travels exactly one run's
 * width and starts again from zero, which is not a jump: at that instant the second copy stands where
 * the first one did.
 *
 * Pause and resume do not read the animated value: with the native driver the value lives on the native
 * side, so a read mid-flight answers with the point the travel started at. Instead `segment` remembers
 * where and when this stretch left, and `resting` is the point a pause froze it at — both fed to the
 * arithmetic of `lib/bandMotion.ts`. A new segment is re-anchored from the clock whenever the app comes
 * back to the foreground, so time spent in the background is not a jump either.
 */
function BandTrack({ items, signature, scrolling, paused }: {
  items: BandItem[];
  signature: string;
  scrolling: boolean;
  paused: boolean;
}) {
  const shift = useState(() => new Animated.Value(0))[0];
  const [runWidth, setRunWidth] = useState(0);
  const [bandWidth, setBandWidth] = useState(0);
  /** Bumped when the app returns to the foreground: the stretch is re-anchored to the clock. */
  const [resync, setResync] = useState(0);
  const segment = useRef<BandSegment | null>(null);
  const resting = useRef(0);
  const copies = bandCopies(runWidth, bandWidth);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setResync((tick) => tick + 1);
    });
    return () => subscription.remove();
  }, []);

  /** New words: from the beginning, whatever the pause was. */
  useEffect(() => {
    segment.current = null;
    resting.current = 0;
    shift.setValue(0);
  }, [signature, shift]);

  useEffect(() => {
    if (!scrolling) { shift.stopAnimation(); return; }
    if (runWidth <= 0) return;
    const cycle = bandCycleMs(runWidth);
    if (!cycle) return;

    if (paused) {
      /** Freeze exactly where the clock says the line stands — no snap back, no snap forward. */
      const position = segment.current
        ? bandPositionAt(segment.current, Date.now(), runWidth, cycle)
        : resting.current;
      shift.stopAnimation();
      segment.current = null;
      resting.current = position;
      shift.setValue(-position);
      return;
    }

    const from = segment.current
      ? bandPositionAt(segment.current, Date.now(), runWidth, cycle)
      : resting.current;
    let released = false;
    const roll = (position: number) => {
      const plan = bandResumePlan(position, runWidth, cycle);
      segment.current = { from: position, startedAt: Date.now() };
      shift.setValue(-position);
      Animated.timing(shift, {
        toValue: plan.toValue,
        duration: plan.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || released) return;
        /** The seam: the second copy stands exactly where the first one stood, so zero is the same picture. */
        segment.current = { from: 0, startedAt: Date.now() };
        resting.current = 0;
        shift.setValue(0);
        roll(0);
      });
    };
    roll(from);
    return () => { released = true; shift.stopAnimation(); };
  }, [paused, scrolling, runWidth, signature, resync, shift]);

  if (!scrolling) {
    return (
      <View style={styles.viewport}>
        <Text numberOfLines={1} style={styles.staticLine}>{bandLabel(items)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.viewport} onLayout={(event) => setBandWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[styles.strip, { transform: [{ translateX: shift }] }]}>
        {Array.from({ length: copies }, (_, copy) => (
          <View
            key={copy}
            style={styles.run}
            onLayout={copy === 0 ? (event) => setRunWidth(event.nativeEvent.layout.width) : undefined}
            accessibilityElementsHidden={copy > 0}
            importantForAccessibility={copy > 0 ? 'no-hide-descendants' : 'auto'}
          >
            {items.map((item, index) => (
              <View key={`${item.kind}-${index}`} style={styles.reading}>
                {item.icon ? <Text accessible={false} style={styles.icon}>{item.icon}</Text> : null}
                <Text accessible={false} style={styles.text} numberOfLines={1}>{item.text}</Text>
                <View accessible={false} style={styles.separator} />
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * The sheet the band opens: the same five facts, one to a row, with the drag the owner asked for. The
 * sheet follows the finger downwards while the grabber is held and springs back if the drag was short;
 * a long drag or a flick closes it. Its surface is the editor sheet's (`#08131c` on `#23414c`), so the
 * two panels of one profile read as one family.
 */
function ProfileBandSheet({ visible, rows, onClose }: { visible: boolean; rows: BandRow[]; onClose: () => void }) {
  const drag = useState(() => new Animated.Value(0))[0];
  const pan = useMemo(() => PanResponder.create({
    /** The head is a handle, not a scroller: the gesture is ours from the first touch. */
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => { if (gesture.dy > 0) drag.setValue(gesture.dy); },
    onPanResponderRelease: (_event, gesture) => {
      /**
       * A long drag or a flick closes the sheet at once. Waiting for the slide animation's own callback
       * to unmount it is what left an invisible sheet over the profile when the callback never arrived;
       * the modal's exit animation covers the dismissal, so nothing has to wait for it here.
       */
      if (gesture.dy > 80 || gesture.vy > 0.5) {
        drag.setValue(0);
        onClose();
        return;
      }
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => { drag.setValue(0); },
    onPanResponderTerminationRequest: () => false,
  }), [drag, onClose]);

  useEffect(() => { if (visible) drag.setValue(0); }, [drag, visible]);

  if (!rows.length) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide detaliile profilului" onPress={onClose} style={styles.backdropFill} />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: drag }] }]}
        >
          {/**
           * The whole head is the handle: the grabber and the title travel with the finger, and the drag
           * is claimed here rather than only on the 44dp pill, which is what a hand actually reaches for.
           */}
          <View style={styles.sheetHead} {...pan.panHandlers}>
            <View style={styles.grabArea}>
              <View style={styles.grabber} />
            </View>
            <Text style={styles.sheetTitle}>Detalii profil</Text>
          </View>
          <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
            {rows.map((row) => (
              <View key={row.kind} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.icon ? `${row.icon} ${row.value}` : row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /**
   * The band's own surface, one line tall, with the travels clipped by the viewport inside it. The `ⓘ` and
   * the fade it sits on are absolute children of this surface, so they cover the same pixels the reading
   * passes under; the words themselves are the pause control (`styles.touch`).
   */
  band: {
    minHeight: band.minHeight,
    paddingHorizontal: band.paddingInline,
    paddingVertical: band.paddingBlock,
    marginTop: 12,
    marginHorizontal: 14,
    borderWidth: band.edgeWidth,
    borderColor: band.border,
    borderRadius: band.radius,
    backgroundColor: band.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  touch: { justifyContent: 'center' },
  /** The gradient under the `ⓘ`: readings fade out before they reach it, and it takes no touch. */
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: band.fadeWidth },
  /** The sheet's door: 44dp wide and as tall as the band, which is the smallest target a hand needs. */
  info: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 2,
    width: band.infoSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGlyph: { color: band.infoInk, fontSize: 16, lineHeight: 20 },
  viewport: { overflow: 'hidden' },
  strip: { flexDirection: 'row' },
  run: { flexDirection: 'row', alignItems: 'center' },
  reading: { flexDirection: 'row', alignItems: 'center' },
  icon: { color: band.iconInk, fontSize: band.fontSize, marginRight: band.gap / 2 },
  text: { color: band.ink, fontSize: band.fontSize, lineHeight: band.fontSize * band.lineHeight },
  /** The dot between two readings — one after every reading, so the seam between copies reads the same. */
  separator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: band.gap,
    backgroundColor: band.separator,
    opacity: 0.8,
  },
  staticLine: { color: band.ink, fontSize: band.fontSize, lineHeight: band.fontSize * band.lineHeight },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,10,0.74)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: '86%',
    paddingTop: band.sheetPaddingTop,
    paddingHorizontal: band.sheetPaddingInline,
    paddingBottom: band.sheetPaddingBottom,
    borderWidth: 1,
    borderColor: band.sheetBorder,
    borderTopLeftRadius: band.sheetRadius,
    borderTopRightRadius: band.sheetRadius,
    backgroundColor: band.sheetSurface,
    gap: band.gap,
  },
  /** The grabber's own aim plus the title, all of it dragging the sheet (see the sheet's own comment). */
  sheetHead: { gap: band.gap },
  grabArea: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: band.grabberWidth, height: band.grabberHeight, borderRadius: 2, backgroundColor: band.grabberInk },
  sheetTitle: { color: band.sheetInk, fontSize: 16, fontWeight: '800' },
  rows: { paddingBottom: 4 },
  row: { paddingVertical: band.rowPaddingBlock, borderBottomWidth: 1, borderBottomColor: 'rgba(35,65,76,0.55)', gap: band.rowGap },
  rowLabel: { color: band.sheetLabelInk, fontSize: 11.5, lineHeight: 14 },
  rowValue: { color: band.sheetInk, fontSize: 14, lineHeight: 20 },
});
