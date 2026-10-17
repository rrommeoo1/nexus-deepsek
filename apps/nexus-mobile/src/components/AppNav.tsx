import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { NexusMark, type NavSlot } from './NexusMark';
import { BrandLogo } from './BrandLogo';
import type { MediaSource } from '../lib/socialTypes';
import { jungle } from '../theme/jungle';
import { socialTokens } from '../theme/social';

/**
 * The bottom bar of the Social shell: seven marks in one shared pane of glass.
 * Geometry, colours and the create cell come from socialTokens, which transcribes the web CSS — the
 * bar is 60px + the device inset, the glass is the 50px `:before` starting 4px down and 6px in from each
 * side, and the six drawn marks are 32px discs inside it (feed-surface.css:1673-1689).
 *
 * The create cell is the product's mark alone: 54 dp, no ring, no disc, no gradient and no shadow behind
 * it (owner's rule, 17 October 2026). It keeps the wider share of the row and the label `Creează`, so the
 * touch target is exactly the button it was — only the paint is gone.
 */
export type AppNavProps = {
  active: NavSlot;
  onSelect: (slot: NavSlot) => void;
  onOpenCreate: () => void;
  avatarSource?: MediaSource | null;
  /** The number the inbox mark prints: the web prints `unreadMessageCount + unreadActivityCount`. */
  unreadCount?: number;
  /** Reels keeps the marks, but lets the video remain visible through their shared pane. */
  immersive?: boolean;
};

const slots: NavSlot[] = ['primary', 'inbox', 'search', 'create', 'friends', 'utility', 'account'];

export function AppNav({ active, onSelect, onOpenCreate, avatarSource, unreadCount = 0, immersive = false }: AppNavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tokens = socialTokens.nav;
  const colors = socialTokens.colors;
  const inline = width <= 380 ? tokens.paddingInlineNarrow : tokens.paddingInline;
  const barHeight = tokens.paddingTop + tokens.glass.height + Math.max(tokens.paddingBottomMin, insets.bottom);

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="navigation" style={[styles.bar, immersive && styles.immersiveBar, { height: barHeight, paddingHorizontal: inline }]}>
      {!immersive ? <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxBarFill" x1="0" y1="0" x2="0" y2="1">
            {tokens.fill.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={svgColor(stop.color)} stopOpacity={svgOpacity(stop.color)} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxBarFill)" />
      </Svg> : null}

      <View pointerEvents="none" style={[styles.glass, immersive && styles.immersiveGlass]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="nxGlassFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={svgColor(colors.glassFillTop)} stopOpacity={immersive ? 0 : svgOpacity(colors.glassFillTop)} />
              <Stop offset="1" stopColor={svgColor(colors.glassFillBottom)} stopOpacity={immersive ? 0 : svgOpacity(colors.glassFillBottom)} />
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
                /* `.appNav.social>button{max-width:64px}` caps the six drawn marks; the create cell is exempt. */
                create ? null : styles.markCap,
                /* The press scale is written on top of the lift, so a press never drops the circle back. */
                { transform: pressed ? [{ translateY: -lift }, { scale: tokens.mark.pressedScale }] : [{ translateY: -lift }] },
              ]}
            >
              {create ? <CreateDisc /> : (
                <View style={[styles.disc, selected && styles.discActive, slot === 'account' && avatarSource ? styles.discAvatar : null]}>
                  {slot === 'account' && avatarSource ? (
                    <Image source={avatarSource} style={styles.avatar} accessibilityIgnoresInvertColors />
                  ) : (
                    <NexusMark slot={slot} color={selected ? jungle.navActive : jungle.navIdle} />
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

/** The create cell: the product's mark alone — no ring, no disc, no shadow behind it. */
function CreateDisc() {
  return <BrandLogo variant="nav" />;
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

function svgColor(color: string): string {
  return color.startsWith('rgba(') ? color.replace(/,\s*[\d.]+\)$/, ')').replace('rgba(', 'rgb(') : color;
}

function svgOpacity(color: string): number {
  return color.startsWith('rgba(') ? Number(color.slice(color.lastIndexOf(',') + 1, -1)) : 1;
}

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
  immersiveBar: { elevation: 0, shadowOpacity: 0 },
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
  immersiveGlass: { backgroundColor: 'transparent', shadowOpacity: 0 },
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
    borderColor: jungle.borderStrong,
    backgroundColor: 'rgba(139,208,74,0.12)',
    shadowColor: 'rgba(139,208,74,0.34)',
    shadowOpacity: 1,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
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

