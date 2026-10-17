import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, AppState, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { bandCopies, bandCycleMs, bandItems, bandLabel, bandRows, type BandItem, type BandRow } from '../lib/profileBand';
import type { ProfileView } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The profile's band, under the header's buttons: one slow line carrying the description, the place, the
 * month the account was created, the age and the kind of account (`MIGRATION.md` §20.1). The owner asked
 * for it back after the header was rebuilt, and asked for it native: the line drifts leftwards in a loop
 * with no visible seam (the run is followed by copies of itself, and the translation restarts exactly
 * where a copy stands where the first one did), it stands still when the system asks for reduced motion,
 * and touching it opens the sheet with the same five facts on rows.
 *
 * Three things this component is careful about:
 *
 *   1. the clock. The age is derived at every render from the date of birth, and a new day is not an
 *      event anything announces — so the band re-reads the clock at the local midnight and whenever the
 *      app comes back to the foreground (`AppState`), which is when a birthday could have happened;
 *   2. the pace. `bandCycleMs` keeps the 48 seconds of the web's band on a 360-wide column, so a longer
 *      description travels at the same speed instead of finishing sooner;
 *   3. the reading. The whole line is one control for the screen reader, and the travelling copies are
 *      hidden from it, so the five facts are heard once, in order.
 */

const { band } = socialTokens;

export function ProfileBand({ profile }: { profile: ProfileView }) {
  const [clock, setClock] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  /** `prefers-reduced-motion` of this shell: the band stands still instead of travelling. */
  const [reduceMotion, setReduceMotion] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => setReduceMotion(enabled));
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const rows = useMemo(() => bandRows(profile, clock), [profile, clock]);
  const items = useMemo(() => bandItems(rows), [rows]);
  if (!items.length) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalii profil: ${bandLabel(items)}`}
        accessibilityHint="Deschide toate detaliile profilului"
        onPress={() => { setHeld(false); setOpen(true); }}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        style={styles.band}
      >
        <BandTrack items={items} held={held} reduceMotion={reduceMotion} />
      </Pressable>
      <ProfileBandSheet visible={open} rows={rows} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * One run of readings and the copies that close the loop behind it. The strip travels exactly one run's
 * width and starts again from zero, which is not a jump: at that instant the second copy stands where
 * the first one did. When a finger lands on the band it holds, and lifting lets it travel on from where
 * it stands (`travelled` keeps the position outside React).
 */
function BandTrack({ items, held, reduceMotion }: { items: BandItem[]; held: boolean; reduceMotion: boolean }) {
  const shift = useState(() => new Animated.Value(0))[0];
  const [runWidth, setRunWidth] = useState(0);
  const [bandWidth, setBandWidth] = useState(0);
  const travelled = useRef(0);
  const copies = bandCopies(runWidth, bandWidth);

  useEffect(() => {
    const id = shift.addListener(({ value }) => { travelled.current = value; });
    return () => shift.removeListener(id);
  }, [shift]);

  useEffect(() => {
    if (runWidth <= 0 || held || reduceMotion) return;
    let released = false;
    const cycle = bandCycleMs(runWidth);
    const roll = (from: number) => {
      const left = Math.max(0, 1 - Math.min(1, Math.abs(from) / runWidth));
      const animation = Animated.timing(shift, {
        toValue: -runWidth,
        duration: Math.max(1, Math.round(cycle * left)),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (!finished || released) return;
        shift.setValue(0);
        travelled.current = 0;
        roll(0);
      });
    };
    roll(travelled.current);
    return () => { released = true; shift.stopAnimation(); };
  }, [held, reduceMotion, runWidth, shift]);

  if (reduceMotion) {
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
  /** The band's own surface, one line tall, with the travels clipped by the viewport inside it. */
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
