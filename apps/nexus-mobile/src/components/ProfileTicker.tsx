import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ProfileView } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The profile's one moving part, transcribed from apps/nexus-web/public/profile-ticker.js:
 * a read-only loop of what the record already says, directly above the content tabs, carrying the
 * same text twice so the loop closes without a jump. Every value is text, never a control.
 *
 * The pacing is the same arithmetic the module states:
 *   seconds = clamp(26, round(items × 6 × factor), 120), with factor 1 for the default (medium) speed.
 */
const SECONDS_PER_ITEM = 6;
const MIN_SPAN = 26;
const MAX_SPAN = 120;
const SPEED_FACTOR = 1;
const MAX_FRAGMENTS = 8;
const FRAGMENT_MAX = 96;

export type TickerItem =
  | { kind: 'location' | 'age' | 'handle' | 'bio'; icon?: string; value: string; label?: undefined }
  | { kind: 'posts' | 'followers' | 'following'; icon?: undefined; value?: undefined; count: string; label: string };

/** `profileTickerFragments`: split on sentences, line breaks, pipes and middots, then trim and clip. */
export function tickerFragments(text?: string | null, max = MAX_FRAGMENTS): string[] {
  return String(text ?? '')
    .split(/[.!?…]+\s+|\n+|[·|]/u)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((fragment) => (fragment.length > FRAGMENT_MAX ? `${fragment.slice(0, FRAGMENT_MAX - 1).trimEnd()}…` : fragment));
}

export function tickerSpan(items: number, factor = SPEED_FACTOR): number {
  const count = Math.max(1, Math.floor(Number(items)) || 1);
  const seconds = Math.round(count * SECONDS_PER_ITEM * factor);
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, seconds));
}

/** `profileTickerItems`: place, age, handle, the three counters, then the owner's own words. */
export function tickerItems(profile: ProfileView | null): TickerItem[] {
  if (!profile) return [];
  const items: TickerItem[] = [];
  const locale = 'ro-RO';
  const count = (key: string) => Math.max(0, Number(profile.counts?.[key]) || 0).toLocaleString(locale);
  const location = String(profile.location || '').trim();
  if (location) items.push({ kind: 'location', icon: '📍', value: location });
  const age = profile.age;
  if (typeof age === 'number' && Number.isInteger(age) && age >= 13 && age <= 120) {
    items.push({ kind: 'age', icon: '🎂', value: `${age.toLocaleString(locale)} ani` });
  }
  const handle = String(profile.handle || '').trim();
  if (handle) items.push({ kind: 'handle', value: `@${handle}` });
  items.push({ kind: 'posts', count: count('posts'), label: 'postări' });
  items.push({ kind: 'followers', count: count('followers'), label: 'followers' });
  items.push({ kind: 'following', count: count('following'), label: 'following' });
  for (const fragment of tickerFragments(profile.bio)) items.push({ kind: 'bio', value: fragment });
  return items;
}

export function ProfileTicker({ profile }: { profile: ProfileView }) {
  const items = useMemo(() => tickerItems(profile), [profile]);
  const span = tickerSpan(items.length);
  const shift = useState(() => new Animated.Value(0))[0];
  const [runWidth, setRunWidth] = useState(0);

  useEffect(() => {
    if (runWidth <= 0) return;
    shift.setValue(0);
    const animation = Animated.loop(
      Animated.timing(shift, {
        toValue: -runWidth,
        duration: span * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [runWidth, shift, span]);

  if (!items.length) return null;

  const run = (
    <View style={styles.run}>
      {items.map((item, index) => (
        <View key={`${item.kind}-${index}`} style={styles.item}>
          <View style={styles.separator} />
          {item.icon ? <Text style={styles.icon}>{item.icon}</Text> : null}
          {item.label ? (
            <Text style={styles.value}>
              <Text style={styles.count}>{item.count}</Text>
              {` ${item.label}`}
            </Text>
          ) : (
            <Text style={styles.value}>{item.value}</Text>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.band} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ flexDirection: 'row' }, { transform: [{ translateX: shift }] }]}>
        <View onLayout={(event) => setRunWidth(event.nativeEvent.layout.width)}>{run}</View>
        {run}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { marginTop: 12, height: 34, overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  run: { flexDirection: 'row', alignItems: 'center', height: 34 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  separator: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.34)' },
  icon: { fontSize: 13 },
  value: { color: socialTokens.colors.text, fontSize: 13 },
  count: { fontWeight: '800' },
});
