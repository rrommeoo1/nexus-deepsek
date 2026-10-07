import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NexusMark, type NavSlot } from './NexusMark';
import type { MediaSource } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The bottom bar of the Social shell: seven marks in one shared pane of glass.
 * Geometry, colours and the create circle come from socialTokens, which transcribes the web CSS — the
 * bar is 60px + the device inset, the glass is the 50px `:before` starting 4px down and 6px in from each
 * side, the six drawn marks are 32px discs inside it, and the create disc is the 52px circle the bar was
 * built around, lifted 8px and wearing a 4px white ring (feed-surface.css:1673-1689).
 */
export type AppNavProps = {
  active: NavSlot;
  onSelect: (slot: NavSlot) => void;
  onOpenCreate: () => void;
  avatarSource?: MediaSource | null;
  /** The number the inbox mark prints: the web prints `unreadMessageCount + unreadActivityCount`. */
  unreadCount?: number;
};

const slots: NavSlot[] = ['primary', 'inbox', 'search', 'create', 'friends', 'utility', 'account'];

export function AppNav({ active, onSelect, onOpenCreate, avatarSource, unreadCount = 0 }: AppNavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tokens = socialTokens.nav;
  const colors = socialTokens.colors;
  const inline = width <= 380 ? tokens.paddingInlineNarrow : tokens.paddingInline;
  const barHeight = tokens.paddingTop + tokens.glass.height + Math.max(tokens.paddingBottomMin, insets.bottom);

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="navigation" style={[styles.bar, { height: barHeight, paddingHorizontal: inline }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxBarFill" x1="0" y1="0" x2="0" y2="1">
            {tokens.fill.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxBarFill)" />
      </Svg>

      <View pointerEvents="none" style={styles.glass}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="nxGlassFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.glassFillTop} />
              <Stop offset="1" stopColor={colors.glassFillBottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxGlassFill)" />
          {/* `inset 0 1px rgba(175,211,187,.07)` — the glass wears one hairline, along its top edge. */}
          <Rect x={0} y={0} width="100%" height={1} fill={colors.glassHighlight} />
        </Svg>
      </View>

      <View style={styles.row}>
        {slots.map((slot) => {
          const selected = slot === active;
          const create = slot === 'create';
          const counting = slot === 'inbox' && unreadCount > 0;
          /** `.appNav .createNav{transform:translateY(-8px)}` — the only mark the web lifts. */
          const lift = create ? tokens.create.lift : 0;
          return (
            <Pressable
              key={slot}
              accessibilityRole="button"
              /* renderNav() names the count in the label too: `Mesaje, 3 necitite` (app.js:2065-2073). */
              accessibilityLabel={counting ? `${navLabels[slot]}, ${unreadCount} necitite` : navLabels[slot]}
              accessibilityState={{ selected }}
              onPress={create ? onOpenCreate : () => onSelect(slot)}
              style={({ pressed }) => [
                styles.mark,
                { flexGrow: create ? tokens.mark.createWidthShare : tokens.mark.widthShare },
                /* `.appNav.social>button{max-width:64px}` caps the six drawn marks; the circle is exempt. */
                create ? styles.createMark : styles.markCap,
                /* The press scale is written on top of the lift, so a press never drops the circle back. */
                { transform: pressed ? [{ translateY: -lift }, { scale: tokens.mark.pressedScale }] : [{ translateY: -lift }] },
              ]}
            >
              {create ? <CreateDisc /> : (
                <View style={[styles.disc, selected && styles.discActive, slot === 'account' && avatarSource ? styles.discAvatar : null]}>
                  {slot === 'account' && avatarSource ? (
                    <Image source={avatarSource} style={styles.avatar} accessibilityIgnoresInvertColors />
                  ) : (
                    <NexusMark slot={slot} color={colors.white} />
                  )}
                  {counting ? (
                    <Text style={styles.badge} allowFontScaling={false}>{Math.min(unreadCount, tokens.badge.maxCount)}</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** `.appNav.social .createNav i` — the 52px circle the bar was built around, and the bar's only lift. */
function CreateDisc() {
  const { size, glyphSize, glyphWeight } = socialTokens.nav.create;
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
      {/* The captured glyph is 27px/300 and ink-dark over the lit part of the gradient (node 93). */}
      <Text style={[styles.createGlyph, { fontSize: glyphSize, lineHeight: glyphSize }]}>+</Text>
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
  /**
   * `.appNav.social` — the bar is the gradient itself, with no painted top border (the green block only
   * sets `border-top-color`), so the shadow is the sole edge (node 78: `rgba(20,64,39,.11) 0 -10px 28px`).
   */
  bar: {
    position: 'relative',
    shadowColor: socialTokens.nav.shadow,
    shadowOpacity: 1,
    shadowRadius: socialTokens.nav.shadowRadius,
    shadowOffset: { width: 0, height: socialTokens.nav.shadowOffsetY },
    elevation: 12,
  },
  /** `.appNav.social:before` — one pane of glass, 50px tall, 6px in from each side and 4px down. */
  glass: {
    position: 'absolute',
    left: socialTokens.nav.glass.insetInline,
    right: socialTokens.nav.glass.insetInline,
    top: socialTokens.nav.glass.top,
    height: socialTokens.nav.glass.height,
    borderRadius: socialTokens.nav.glass.radius,
    borderWidth: socialTokens.nav.glass.borderWidth,
    borderColor: socialTokens.colors.glassBorder,
    backgroundColor: socialTokens.colors.glassFillTop,
    overflow: 'hidden',
    shadowColor: socialTokens.nav.glass.shadow,
    shadowOpacity: 1,
    shadowRadius: socialTokens.nav.glass.shadowRadius,
    shadowOffset: { width: 0, height: socialTokens.nav.glass.shadowOffsetY },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: socialTokens.nav.gap,
    height: socialTokens.nav.glass.height,
    marginTop: socialTokens.nav.glass.top - socialTokens.nav.paddingTop,
  },
  /** `.appNav button` — `height:50px`, `padding:5px 2px`, one centred glyph, no label under it. */
  mark: {
    flexShrink: 1,
    flexBasis: 0,
    height: socialTokens.nav.mark.height,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: socialTokens.nav.mark.paddingVertical,
    paddingHorizontal: socialTokens.nav.mark.paddingHorizontal,
    borderRadius: socialTokens.nav.mark.radius,
  },
  /** `.appNav.social>button{max-width:64px}` */
  markCap: { maxWidth: socialTokens.nav.mark.maxWidth },
  /** `.appNav button.createNav` — the same cell, but the 52px circle starts at its padding edge. */
  createMark: { justifyContent: 'flex-start' },
  /** `.appNav.social button i` — a 32px disc that paints no ring; only its colour is set. */
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
  /** `button[data-slot="account"] i` carries `overflow:hidden` so the picture is cut to the disc. */
  discAvatar: { overflow: 'hidden' },
  /** `.appNav.social button.active:not(.createNav) i` — the open place, lit from within. */
  discActive: {
    borderColor: socialTokens.colors.markActiveBorder,
    backgroundColor: socialTokens.colors.markActiveBackground,
    shadowColor: socialTokens.colors.markActiveShadow,
    shadowOpacity: 1,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
  },
  /** `.appNav.social .createNav i` — 52px, a 4px white ring, lit from its top-left corner. */
  createDisc: {
    width: socialTokens.nav.create.size,
    height: socialTokens.nav.create.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.nav.create.radius,
    borderWidth: socialTokens.nav.create.borderWidth,
    borderColor: socialTokens.colors.createBorder,
    backgroundColor: socialTokens.colors.createInk,
    shadowColor: socialTokens.colors.createShadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  /** `.createNav i{color:#050608}` — the glyph is ink-dark, and it sits in the lit half of the gradient. */
  createGlyph: {
    color: socialTokens.colors.createInk,
    fontWeight: socialTokens.nav.create.glyphWeight,
  },
  /** `.navBadge` — the unread pill, pinned to the top-right corner of the disc it belongs to. */
  badge: {
    position: 'absolute',
    right: socialTokens.nav.badge.offsetRight,
    top: socialTokens.nav.badge.offsetTop,
    minWidth: socialTokens.nav.badge.minWidth,
    height: socialTokens.nav.badge.height,
    paddingHorizontal: socialTokens.nav.badge.paddingInline,
    borderRadius: socialTokens.nav.badge.radius,
    borderWidth: socialTokens.nav.badge.borderWidth,
    borderColor: socialTokens.colors.navBadgeRing,
    backgroundColor: socialTokens.colors.navBadgeSurface,
    color: socialTokens.colors.navBadgeInk,
    fontSize: socialTokens.nav.badge.fontSize,
    lineHeight: socialTokens.nav.badge.height - 2 * socialTokens.nav.badge.borderWidth,
    fontWeight: '700',
    textAlign: 'center',
  },
  /** `button[data-slot="account"] i img{width:100%;height:100%;object-fit:cover}` */
  avatar: { width: '100%', height: '100%' },
});

