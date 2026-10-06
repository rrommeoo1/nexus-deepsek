import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NexusMark, type NavSlot } from './NexusMark';
import { socialTokens } from '../theme/social';

/**
 * The bottom bar of the Social feed: seven marks in one shared pane of glass.
 * Geometry, colours and the create circle come from socialTokens, which transcribes the web CSS —
 * the bar is 60px + the device inset, the glass is 50px starting 4px down and 6px in from each side,
 * and the six drawn marks are 32px discs inside it while the create disc is 44px, so it sits on the
 * same row instead of hanging over the edge.
 */
export type AppNavProps = {
  active: NavSlot;
  onSelect: (slot: NavSlot) => void;
  onOpenDrawer: () => void;
  onOpenCreate: () => void;
  avatarUri?: string | null;
  unreadCount?: number;
};

const slots: NavSlot[] = ['primary', 'inbox', 'search', 'create', 'friends', 'utility', 'account'];

export function AppNav({ active, onSelect, onOpenCreate, avatarUri, unreadCount = 0 }: AppNavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tokens = socialTokens.nav;
  const inline = width <= 380 ? tokens.paddingInlineNarrow : tokens.paddingInline;
  const barHeight = tokens.paddingTop + tokens.glass.height + Math.max(tokens.paddingBottomMin, insets.bottom);

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="navigation" style={[styles.bar, { height: barHeight, paddingHorizontal: inline }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxBarFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.12} />
            <Stop offset="0.52" stopColor="#020304" stopOpacity={1} />
            <Stop offset="1" stopColor="#000000" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxBarFill)" />
      </Svg>

      <View pointerEvents="none" style={styles.glass}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="nxGlassFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0e1014" stopOpacity={0.97} />
              <Stop offset="1" stopColor="#020305" stopOpacity={0.99} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxGlassFill)" />
          <Rect x={0} y={0} width="100%" height={1} fill="#ffffff" fillOpacity={0.09} />
          <Rect x={0} y={tokens.glass.height - 1} width="100%" height={1} fill="#ffffff" fillOpacity={0.04} />
        </Svg>
      </View>

      <View style={styles.row}>
        {slots.map((slot) => {
          const selected = slot === active;
          const create = slot === 'create';
          const unread = slot === 'inbox' && unreadCount > 0;
          return (
            <Pressable
              key={slot}
              accessibilityRole="button"
              accessibilityLabel={navLabels[slot]}
              accessibilityState={{ selected }}
              onPress={slot === 'create' ? onOpenCreate : () => onSelect(slot)}
              style={({ pressed }) => [styles.mark, pressed && { transform: [{ scale: tokens.mark.pressedScale }] }]}
            >
              {create ? <CreateDisc /> : (
                <View style={[styles.disc, selected && styles.discActive]}>
                  {slot === 'account' && avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityIgnoresInvertColors />
                  ) : (
                    <NexusMark slot={slot} color={unread ? '#ff7180' : socialTokens.colors.white} />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** `.appNav.social .createNav i` — the 44px circle that keeps its place on the row. */
function CreateDisc() {
  const { size, glyphSize } = socialTokens.nav.create;
  return (
    <View style={styles.createDisc}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="nxCreateFill" cx="35%" cy="28%" r="72%" fx="35%" fy="28%">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.38" stopColor="#d8dce1" />
            <Stop offset="0.72" stopColor="#343941" />
            <Stop offset="1" stopColor="#050608" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxCreateFill)" />
      </Svg>
      <Text style={[styles.createGlyph, { fontSize: glyphSize, lineHeight: glyphSize + 3 }]}>+</Text>
    </View>
  );
}

const navLabels: Record<NavSlot, string> = {
  primary: 'Acasă',
  inbox: 'Mesaje',
  search: 'Găsește oameni și conținut',
  create: 'Creează',
  friends: 'Prieteni',
  utility: 'Live',
  account: 'Profil',
};

const styles = StyleSheet.create({
  bar: {
    position: 'relative',
    borderTopWidth: socialTokens.nav.borderTopWidth,
    borderTopColor: socialTokens.colors.barTopBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.48,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  glass: {
    position: 'absolute',
    left: socialTokens.nav.glass.insetInline,
    right: socialTokens.nav.glass.insetInline,
    top: socialTokens.nav.glass.top,
    height: socialTokens.nav.glass.height,
    borderRadius: socialTokens.nav.glass.radius,
    borderWidth: socialTokens.nav.glass.borderWidth,
    borderColor: socialTokens.colors.glassBorder,
    backgroundColor: '#050608',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.52,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -8 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: socialTokens.nav.gap,
    height: socialTokens.nav.glass.height,
    marginTop: socialTokens.nav.glass.top - socialTokens.nav.paddingTop,
  },
  mark: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: socialTokens.nav.mark.maxWidth,
    height: socialTokens.nav.mark.height,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: socialTokens.nav.mark.paddingVertical,
    paddingHorizontal: socialTokens.nav.mark.paddingHorizontal,
    borderRadius: socialTokens.nav.mark.radius,
  },
  disc: {
    width: socialTokens.nav.disc.size,
    height: socialTokens.nav.disc.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.nav.disc.radius,
    borderWidth: socialTokens.nav.disc.borderWidth,
    borderColor: socialTokens.colors.markBorder,
    backgroundColor: socialTokens.colors.markBackground,
  },
  discActive: {
    borderColor: socialTokens.colors.markActiveBorder,
    backgroundColor: socialTokens.colors.markActiveBackground,
    shadowColor: '#ffffff',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  createDisc: {
    width: socialTokens.nav.create.size,
    height: socialTokens.nav.create.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.nav.create.radius,
    borderWidth: socialTokens.nav.create.borderWidth,
    borderColor: socialTokens.colors.createBorder,
    backgroundColor: socialTokens.colors.createInk,
    shadowColor: '#ffffff',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  createGlyph: {
    color: socialTokens.colors.createInk,
    fontWeight: '800',
  },
  avatar: { width: '100%', height: '100%', borderRadius: socialTokens.nav.disc.size / 2 },
});

