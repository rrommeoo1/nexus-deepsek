import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { bioTokens, type BioToken } from '../lib/profileBioText';
import type { ProfileView } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The profile's one moving part, transcribed from apps/nexus-web/public/profile-ticker.js (wave 14i):
 * two slow rows of what the record already says, directly above the content tabs. Most of it is text
 * that drifts past, and four of the readings are doors — the two counters, the place and the handle —
 * each opening a surface the app already had. Nothing in the band writes anything, and the band is not
 * one reading: every reading is its own, so a screen reader reaches them one at a time.
 *
 * The pacing is the module's arithmetic, row by row:
 *   seconds = clamp(26, round(slots × 6), 120), where `slots` is how many readings a row prints in one
 *   run once `PROFILE_TICKER_RUN_MIN` has repeated it — so the shorter row waits longer between readings
 *   instead of drifting faster than the longer one.
 *
 * Two things are the phone's own, and both are written down instead of hidden:
 *
 * 1. The owner's own words open the band (`PROFILE_TICKER_ROWS` here is `[bio, location, age, handle]`,
 *    while the module's list ends that row with `bio`). The description is read nowhere else *in this
 *    component*: a hero that prints it keeps one paragraph for it, so the band must not hide it from a
 *    screen reader either.
 * 2. The band travels on the module's own speed knob rather than on its default: `tickerSpanFor` applies
 *    `PROFILE_TICKER_SPEEDS.fast` (0.62), so the readings a real profile prints loop in 25-35 seconds
 *    instead of the 48 and more the `medium` multiplier gives. The arithmetic is the module's; only the
 *    multiplier is chosen, and it is the one the web's Appearance panel offers.
 *
 * A description is text, so the pieces of it that lead somewhere are read as links: an address opens in
 * the browser (`profile-bio-text.js`), and a mention hands its handle to the door the band already has.
 */
const SECONDS_PER_ITEM = 6;
const MIN_SPAN = 26;
const MAX_SPAN = 120;
const MAX_FRAGMENTS = 8;
const FRAGMENT_MAX = 96;
/** `PROFILE_TICKER_RUN_MIN`: a run is repeated until it is at least this many readings wide. */
const RUN_MIN = 8;
/** `PROFILE_TICKER_SPEEDS.fast` — the multiplier this band's pace is chosen from (see above). */
export const TICKER_SPEED_FACTOR = 0.62;

/**
 * `PROFILE_TICKER_ROWS` with the one reorder the phone asked for: the owner's own words open the band,
 * the place and the year follow, the handle closes that row, and the three counters are the second row.
 * The split is still the reading order — both rows drift at the same pace, and a row with nothing in it
 * is not drawn at all — and the readings themselves are the module's, value for value.
 */
const ROWS = [
  ['bio', 'location', 'age', 'handle'],
  ['posts', 'followers', 'following'],
] as const;

/**
 * `PROFILE_TICKER_ACTIONS`: four of the readings lead somewhere. `posts` prints a count and leads
 * nowhere, and a bio fragment is the owner's own words, which the hero paragraph already keeps.
 */
export const TICKER_DOORS = ['followers', 'following', 'location', 'handle'] as const;

type TickerKind = 'location' | 'age' | 'handle' | 'bio' | 'posts' | 'followers' | 'following';
export type TickerDoor = typeof TICKER_DOORS[number];

/** The four kinds that lead somewhere, asked in one place, so no reading grows a door by accident. */
const isDoor = (kind: TickerKind): kind is TickerDoor => (TICKER_DOORS as readonly TickerKind[]).includes(kind);

/** `PROFILE_TICKER_ACTION_LABEL_KEYS` → `profile.tickerOpenFollowers|Following|Location|Handle` (ro). */
export const DOOR_HINTS: Record<TickerDoor, string> = {
  followers: 'Deschide lista de urmăritori',
  following: 'Deschide lista de urmăriți',
  location: 'Deschide postările din acest loc',
  handle: 'Deschide profilul',
};

/** A reading: a number and its unit (`<b>` + `<small>` of the web), or one piece of text. */
export type TickerItem = {
  kind: TickerKind;
  icon?: string;
  count?: string;
  label?: string;
  value?: string;
  /** The pieces a description was cut into, so the ones that lead somewhere can be read as links. */
  tokens?: BioToken[];
};

/**
 * `profileTickerFragments`: the owner's words, cut exactly where the module cuts them — a line break, a
 * pipe, a middot, or the space after a sentence — then trimmed and clipped to 96 characters. The module
 * splits with a lookbehind so the punctuation stays inside the fragment; the same four cut points are
 * reached here through a marker instead, because a lookbehind is a startup error where it is unsupported.
 */
export function tickerFragments(text?: string | null, max = MAX_FRAGMENTS): string[] {
  return String(text ?? '')
    .replace(/([.!?…]+)\s+/gu, '$1\u0000')
    .split(/\u0000|\r?\n|[·|]/u)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((fragment) => (fragment.length > FRAGMENT_MAX ? `${fragment.slice(0, FRAGMENT_MAX - 1).trimEnd()}…` : fragment));
}

/** The seconds one row's run travels: `clamp(26, round(slots × 6), 120)` over the readings it prints. */
export function tickerSpan(slots: number): number {
  const count = Math.max(1, Math.floor(Number(slots)) || 1);
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(count * SECONDS_PER_ITEM)));
}

/**
 * The span a row actually travels on: the module's own seconds, multiplied by the speed knob this band
 * chose (`TICKER_SPEED_FACTOR`). A row of three counters prints nine slots once `RUN_MIN` has repeated
 * it, which is 54 seconds of the module's arithmetic and 33 of this one; a row of four readings prints
 * eight, which is 48 and 30. Both land where the product asked the band to read: a full loop in 25-35
 * seconds, at the same pace on both rows.
 */
export function tickerSpanFor(slots: number, factor = TICKER_SPEED_FACTOR): number {
  return Math.max(1, Math.round(tickerSpan(slots) * factor));
}

/**
 * `profileTickerItems`: the place, the age, the handle and the owner's own words, then the three counters.
 *
 * Two switches, both on: `counters` and `identity`. The owner's header prints all of these readings itself —
 * the description, the address inside it, the place, the age, the handle, and the three counters in its fixed
 * row (`MIGRATION.md` §19.2) — so the profile screen asks the band for neither and the column carries every
 * reading exactly once. Left on, the list is the module's own, value for value and in the module's order.
 */
export function tickerItems(profile: ProfileView | null, counters = true, identity = true): TickerItem[] {
  if (!profile) return [];
  const items: TickerItem[] = [];
  const locale = 'ro-RO';
  const count = (key: string) => Math.max(0, Number(profile.counts?.[key]) || 0).toLocaleString(locale);
  if (identity) {
    /**
     * The owner's own words open the band: every fragment of the description, in the order it was written,
     * each cut into the pieces that lead somewhere (`profile-bio-text.js`). The description is the first
     * reading of the first row, not a block above the band and not the tail of it.
     */
    for (const fragment of tickerFragments(profile.bio)) {
      items.push({ kind: 'bio', value: fragment, tokens: bioTokens(fragment) });
    }
    const location = String(profile.location || '').trim();
    if (location) items.push({ kind: 'location', icon: '📍', value: location });
    const age = profile.age;
    if (typeof age === 'number' && Number.isInteger(age) && age >= 13 && age <= 120) {
      /** An age is a count with a unit, printed the way the three counters are (`profile.years` = „ani"). */
      items.push({ kind: 'age', icon: '🎂', count: age.toLocaleString(locale), label: 'ani' });
    }
    const handle = String(profile.handle || '').trim();
    if (handle) items.push({ kind: 'handle', value: `@${handle}` });
  }
  /**
   * The three counters are the band's own readings on the web, and the phone prints them too — except where
   * the header already prints them in its fixed row, which is the owner's decision for this screen
   * (`MIGRATION.md` §19.2, `docs/PARITY-MATRIX.md`): a number printed twice in one column reads as two
   * numbers. Every other reading is untouched, so the band a profile shows is the web's band minus the row
   * that moved up, and `counters = true` keeps the module's own list intact.
   */
  if (counters) {
    items.push({ kind: 'posts', count: count('posts'), label: 'postări' });
    items.push({ kind: 'followers', count: count('followers'), label: 'followers' });
    items.push({ kind: 'following', count: count('following'), label: 'following' });
  }
  return items;
}

/**
 * `profileTickerRows`: the readings split into the module's two rows. A row with nothing in it is not drawn
 * at all, so a bare profile still gets a band carrying the three counters and no empty line above them.
 */
export function tickerRows(items: TickerItem[]): TickerItem[][] {
  return ROWS
    .map((kinds) => items.filter((item) => (kinds as readonly TickerKind[]).includes(item.kind)))
    .filter((row) => row.length > 0);
}

/**
 * `PROFILE_TICKER_RUN_MIN`: how many readings one run of this row prints — the row repeated until the run
 * is at least eight wide, so a row of three counters does not leave a hole where the loop should be.
 */
export function tickerRunSlots(row: TickerItem[]): number {
  const length = Math.max(1, row.length);
  return length * Math.max(1, Math.ceil(RUN_MIN / length));
}

/**
 * `named` of the module — what a reading says, spelled out. The module asks whether the item carries a
 * label; every counter this file builds carries one, so the same reading comes out either way.
 */
export function tickerReadingText(item: TickerItem): string {
  return item.count !== undefined ? `${item.count} ${item.label ?? ''}`.trim() : String(item.value ?? '');
}

/**
 * `arg` of the module: a door hands over what it names — the handle without its `@`, the place for the
 * place, and nothing at all for the two counters, because their door is the list itself.
 */
export function tickerDoorArg(item: TickerItem): string {
  return item.kind === 'handle' ? tickerReadingText(item).replace(/^@/, '') : String(item.value ?? '');
}

/**
 * The band. It draws its rows, holds them still under a finger, and asks the host to open a door. The band
 * itself is not a control and writes nothing (`.ownerTicker` carries `pointer-events:none`): the only
 * pressable things in it are the doors, and each of those leads to a surface that already existed.
 *
 * The hold is the stylesheet's own behaviour (`.ownerTicker.isHeld .ownerTickerTrack`): a finger that
 * lands anywhere on the band pauses both rows, and lifting it lets them travel on from where they stand -
 * a released band continues its leg instead of jumping to a fresh one.
 */
export function ProfileTicker({ profile, onDoor, counters = true, identity = true }: {
  profile: ProfileView;
  onDoor?: (door: TickerDoor, arg: string) => void;
  /** The three counters, off where the host already prints them (`MIGRATION.md` §19.2). */
  counters?: boolean;
  /** The description, the place, the age and the handle, off where the host's own header prints them. */
  identity?: boolean;
}) {
  const items = useMemo(() => tickerItems(profile, counters, identity), [profile, counters, identity]);
  const rows = useMemo(() => tickerRows(items), [items]);
  const [bandWidth, setBandWidth] = useState(0);
  /** A finger on a door holds both rows still (`.ownerTicker.isHeld` pauses every track), and lets them go. */
  const [held, setHeld] = useState(false);
  /** `@media (prefers-reduced-motion:reduce){.ownerTickerTrack{animation:none}}` — the band stands still. */
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => setReduceMotion(enabled));
    return () => { mounted = false; subscription.remove(); };
  }, []);

  if (!rows.length) return null;

  return (
    <View
      style={styles.band}
      onLayout={(event) => setBandWidth(event.nativeEvent.layout.width)}
      /**
       * A finger anywhere on the band holds both rows still, and lifting it lets them go. These three
       * callbacks are direct touch events: they report the touch without claiming it as a responder, so a
       * drag that starts on the band still belongs to the page under it - the band pauses under the
       * finger, the swipe it was brought by keeps working.
       */
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
    >
      {rows.map((row, index) => (
        <TickerTrack
          key={row[0].kind}
          row={row}
          first={index === 0}
          held={held}
          reduceMotion={reduceMotion}
          onHold={() => setHeld(true)}
          onRelease={() => setHeld(false)}
          onDoor={onDoor}
        />
      ))}
      {bandWidth > 0 ? <TickerFade width={bandWidth} /> : null}
    </View>
  );
}

/**
 * One row: the readings printed twice — the run, and the echo of it — inside a track that travels exactly
 * one run's width and starts over, so the loop closes on a reading that already stands where the first one
 * did. The rows are not the same length, so each one is given its own span: same pace, not the same speed.
 */
function TickerTrack({ row, first, held, reduceMotion, onHold, onRelease, onDoor }: {
  row: TickerItem[];
  first: boolean;
  held: boolean;
  reduceMotion: boolean;
  onHold: () => void;
  onRelease: () => void;
  onDoor?: (door: TickerDoor, arg: string) => void;
}) {
  const slots = tickerRunSlots(row);
  const passes = Math.max(1, Math.round(slots / row.length));
  const span = tickerSpanFor(slots);
  const shift = useState(() => new Animated.Value(0))[0];
  const [runWidth, setRunWidth] = useState(0);
  /** Where the track stands, kept out of React: a released band travels on from there, it does not jump. */
  const travelled = useRef(0);
  const leg = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const id = shift.addListener(({ value }) => { travelled.current = value; });
    return () => shift.removeListener(id);
  }, [shift]);

  useEffect(() => {
    if (runWidth <= 0 || held || reduceMotion) return;
    let released = false;
    const roll = (from: number) => {
      const left = Math.max(0, 1 - Math.min(1, Math.abs(from) / runWidth));
      const animation = Animated.timing(shift, {
        toValue: -runWidth,
        duration: Math.max(1, span * 1000 * left),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      leg.current = animation;
      animation.start(({ finished }) => {
        if (!finished || released) return;
        /** The echo stands exactly where the run does, so putting the strip back at zero is not a jump. */
        shift.setValue(0);
        travelled.current = 0;
        roll(0);
      });
    };
    roll(travelled.current);
    return () => { released = true; leg.current?.stop(); };
  }, [runWidth, held, reduceMotion, shift, span]);

  /** The echo is the same reading arriving behind the first one: no door of its own, nothing read twice. */
  const run = (echo: boolean) => (
    <View
      style={styles.run}
      accessibilityElementsHidden={echo}
      importantForAccessibility={echo ? 'no-hide-descendants' : 'auto'}
    >
      {Array.from({ length: passes }, (_, pass) => row.map((item, slot) => (
        <TickerReading
          /**
           * A row holds several readings of the same kind — every fragment of a description is a `bio` —
           * so the kind alone is not a key: two fragments of one description collided inside the same
           * repetition (`Encountered two children with the same key, 0-bio`). The slot joins the pass and
           * the kind, and the three of them name one printing of one reading.
           */
          key={`${pass}-${slot}-${item.kind}`}
          item={item}
          echo={echo}
          onHold={onHold}
          onRelease={onRelease}
          onDoor={onDoor}
        />
      )))}
    </View>
  );

  return (
    <View style={first ? undefined : styles.trackHairline}>
      <Animated.View style={[styles.trackRow, { transform: [{ translateX: shift }] }]}>
        <View onLayout={(event) => setRunWidth(event.nativeEvent.layout.width)}>{run(false)}</View>
        {run(true)}
      </Animated.View>
    </View>
  );
}

/**
 * One reading: the dot, an optional glyph, and then either the words, a number and its unit, or the
 * pieces of a description. Four kinds are doors, and then the whole reading is the control: its
 * accessible name says what it says first and where it goes after (`PROFILE_TICKER_ACTION_LABEL_KEYS`),
 * and it is at least a 40px target. Every reading is that tall, door or not, because the product asked
 * the band for one line height and one centre line across both rows: the stylesheet gives the floor to
 * `.ownerTickerAction` (`min-width:40px;min-height:40px`) and lets a row centre the shorter text
 * readings within it, while here the floor is the reading's own box, so a row of words and a row of
 * numbers measure the same and every reading's centre is the band's centre.
 */

/**
 * An address a description carries, opened where this shell opens addresses - the same call the feed
 * makes for a news item. Only `http(s)` reaches the browser: that is the one kind `bioTokens` produces.
 */
function openAddress(href: string): void {
  if (!/^https?:\/\//i.test(href)) return;
  void Linking.openURL(href);
}
function TickerReading({ item, echo, onHold, onRelease, onDoor }: {
  item: TickerItem;
  echo: boolean;
  onHold: () => void;
  onRelease: () => void;
  onDoor?: (door: TickerDoor, arg: string) => void;
}) {
  const door = isDoor(item.kind) ? item.kind : null;
  /** What the reading says, spelled out — `named` of the module, which the door's name begins with. */
  const reading = tickerReadingText(item);
  /** `arg` of the module: the handle without its `@`, the place for the place, and nothing for a count. */
  const arg = tickerDoorArg(item);

  const body = (pressed: boolean) => (
    <>
      <View style={styles.separator} />
      {/**
       * `.ownerTickerAction:active{color:#7ff0e6}`: the glyph carries no ink of its own, so a pressed door
       * takes its icon to cyan with the words. The two counts are doors too, but they carry no glyph.
       */}
      {item.icon ? <Text style={[styles.icon, pressed ? styles.valuePressed : null]}>{item.icon}</Text> : null}
      {item.count !== undefined ? (
        <View style={styles.countRow}>
          <Text style={styles.count} numberOfLines={1}>{item.count}</Text>
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        </View>
      ) : item.tokens?.length ? (
        /**
         * The owner's own words are text, read piece by piece, and only the pieces that lead somewhere are
         * pressable: an address opens in the browser (`profile-bio-text.js`), a mention hands its handle to
         * the door the band already has for a handle. A press on either one holds the band too.
         */
        <Text style={styles.value} numberOfLines={1}>
          {item.tokens.map((token, index) => (token.link ? (
            <Text
              key={`${index}-${token.text}`}
              style={[styles.bioLink, pressed ? styles.valuePressed : null]}
              accessibilityRole="link"
              onPressIn={onHold}
              onPressOut={onRelease}
              onPress={() => (token.link === 'mention' ? onDoor?.('handle', token.href) : openAddress(token.href))}
            >
              {token.text}
            </Text>
          ) : (
            <Text key={`${index}-${token.text}`}>{token.text}</Text>
          )))}
        </Text>
      ) : (
        <Text style={[styles.value, pressed ? styles.valuePressed : null]} numberOfLines={1}>{item.value}</Text>
      )}
    </>
  );

  if (!door) {
    return (
      <View
        style={styles.reading}
        /**
         * The description is read in this band and nowhere else on this screen - the hero keeps no such
         * paragraph - so those readings are read out like every other one; only the echo arriving behind
         * them stays out of the reading.
         */
        accessibilityElementsHidden={echo}
        importantForAccessibility={echo ? 'no-hide-descendants' : 'auto'}
      >
        {body(false)}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.reading, styles.door]}
      /** The echo of a door is the same door arriving again: it presses, but it is not read out or focused. */
      accessible={!echo}
      focusable={!echo}
      accessibilityRole={echo ? undefined : 'button'}
      accessibilityLabel={echo ? undefined : `${reading} (${DOOR_HINTS[door]})`}
      accessibilityHint={echo ? undefined : DOOR_HINTS[door]}
      onPressIn={onHold}
      onPressOut={onRelease}
      onPress={() => onDoor?.(door, arg)}
    >
      {({ pressed }) => body(!echo && pressed)}
    </Pressable>
  );
}

/**
 * The `.ownerTicker` `mask-image`: 22px at each end where the readings fade into the band's own surface.
 * A CSS mask erases what is underneath it and a native view cannot be masked that way, so the same 22px is
 * painted in the colour the translucent surface resolves to over the black hero — the pixels agree.
 */
function TickerFade({ width }: { width: number }) {
  const { fade, fadeInk } = socialTokens.ticker;
  const gradient = `nxTickerFade${useId().replace(/[^a-zA-Z0-9]/gu, '')}`;
  const edge = Math.min(0.5, fade / width);

  return (
    <Svg pointerEvents="none" style={styles.fade} width="100%" height="100%">
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={fadeInk} stopOpacity="1" />
          <Stop offset={edge} stopColor={fadeInk} stopOpacity="0" />
          <Stop offset={1 - edge} stopColor={fadeInk} stopOpacity="0" />
          <Stop offset="1" stopColor={fadeInk} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  /**
   * `.ownerTicker` inside `.ownerTickerRow`: the row adds nothing above the band and nothing between it and
   * the tabs. The own-profile capture measures that chain to the pixel — `ownerIdentity` bottom 226 =
   * `ownerTickerRow` top 226, `ownerTickerRow` bottom 268 = `ownerTabsRegion` top 268
   * (`docs/web-ref/profile/own-0.dom.json`) — so the band keeps no margin of its own.
   */
  band: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: socialTokens.ticker.border,
    borderBottomColor: socialTokens.ticker.border,
    backgroundColor: socialTokens.ticker.surface,
  },
  /** `.ownerTickerTrack + .ownerTickerTrack`: the second row carries the hairline between the two. */
  trackHairline: { borderTopWidth: 1, borderTopColor: socialTokens.ticker.rowBorder },
  /** `.ownerTickerTrack`: a run and its echo, travelling as one strip. */
  trackRow: { flexDirection: 'row' },
  /** `.ownerTickerRun`: one row of readings that never wraps (`white-space:nowrap`). */
  run: { flexDirection: 'row', alignItems: 'center' },
  /** `.ownerTickerItem`: 9px above and below, 14px after the reading, and none before it. */
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    /** `.ownerTickerAction{min-height:40px}` — and every reading is that tall, door or not (see above). */
    minHeight: socialTokens.ticker.readingHeight,
    paddingVertical: socialTokens.ticker.itemPaddingBlock,
    paddingRight: socialTokens.ticker.itemPaddingInlineEnd,
  },
  /** `.ownerTickerAction`: a reading that is a door is a control, so it is at least 40 by 40. */
  door: { minWidth: socialTokens.ticker.minTarget, minHeight: socialTokens.ticker.minTarget },
  /** `.ownerTickerSep`: the 3px dot that opens every reading. */
  separator: {
    width: socialTokens.ticker.sepSize,
    height: socialTokens.ticker.sepSize,
    borderRadius: socialTokens.ticker.sepSize / 2,
    marginRight: socialTokens.ticker.sepMarginEnd,
    backgroundColor: socialTokens.ticker.dot,
    opacity: socialTokens.ticker.dotOpacity,
  },
  /** `.ownerTickerIcon`: the place and the age carry a glyph, 11px, before their words. */
  icon: {
    marginRight: socialTokens.ticker.iconMarginEnd,
    fontSize: socialTokens.ticker.iconSize,
    /** The glyph's own line box, so a reading with an icon is exactly as tall as one without. */
    lineHeight: socialTokens.ticker.fontSize * socialTokens.ticker.lineHeight,
  },
  /** `.ownerTickerItem` itself: the ink every reading inherits, at 12.5px on 1.3 leading. */
  value: {
    color: socialTokens.ticker.ink,
    fontSize: socialTokens.ticker.fontSize,
    lineHeight: socialTokens.ticker.fontSize * socialTokens.ticker.lineHeight,
  },
  /** `.ownerTickerAction:active`: the plain words turn cyan under the finger; a count keeps its ink. */
  valuePressed: { color: socialTokens.ticker.doorInk },
  /** `.ownerBio a{color:#67f5ed;text-decoration:underline;text-underline-offset:2px}` — a link in words. */
  bioLink: { color: socialTokens.ticker.linkInk, textDecorationLine: 'underline' },
  /** `.ownerTickerCount`: the number and its unit sit on one baseline, 4px apart. */
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: socialTokens.ticker.countGap },
  /** `.ownerTickerItem b`: the number, in the brightest ink of the band, with the stylesheet's tabular figures. */
  count: {
    color: socialTokens.ticker.countInk,
    fontSize: socialTokens.ticker.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    /** The number's own line box: bold must not make its reading taller, only brighter. */
    lineHeight: socialTokens.ticker.fontSize * socialTokens.ticker.lineHeight,
  },
  /** `.ownerTickerItem small`: its unit. */
  label: {
    color: socialTokens.ticker.labelInk,
    fontSize: socialTokens.ticker.labelSize,
    /** The unit's own line box, so the number and its unit sit on one baseline in one tall box. */
    lineHeight: socialTokens.ticker.fontSize * socialTokens.ticker.lineHeight,
  },
  /** The two 22px ends of the `.ownerTicker` mask, painted in what its surface resolves to over black. */
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
