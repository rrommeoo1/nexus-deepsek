import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NexusMark, PlusMark, type NavSlot } from './NexusMark';
import { BrandAvatar } from './BrandAvatar';
import type { MediaSource } from '../lib/socialTypes';
import { blackSilver } from '../theme/blackSilver';
import { jungle } from '../theme/jungle';
import { socialTokens } from '../theme/social';

/**
 * The bottom bar of the Social shell: seven marks in one shared pane of glass.
 *
 * Geometry comes from `socialTokens`, which transcribes the web CSS — the bar is 60px + the device inset,
 * the glass is the 50px `:before` starting 4px down and 6px in from each side, and the six drawn marks are
 * 32px discs inside it (feed-surface.css:1673-1689).
 *
 * Round 31 (owner, 31 October 2026): the bar is **matte black** — an opaque ramp from `#101113` to
 * `#090A0B`, with one silver hairline along the glass and a neutral black shadow, where it used to be a
 * green-black gradient with a green shadow. The marks are the metal: `jungle.navIdle` (`#A5A5A5`) for a
 * closed place and `jungle.navActive` (`#E1E3E5`) for the open one, so the profile tab is no longer the
 * banana it was. The account cell with no picture wears the JB fruit logo (`BrandAvatar`).
 *
 * The create cell is the one mark made of metal: a 52 dp circle painted with the palette's polish
 * (`blackSilverPolish`: bright silver at the light, silver across the body, deep mercury at the foot),
 * under a white bezel and a silver glow, with the plus drawn in **matte black** (`createGlyph`) — the
 * strongest pair the palette owns, and the prominence the owner asked for („un argintiu puternic, cu un
 * `+` închis"). The letters stay off the button (19 October 2026); the circle and the silver came back on
 * the owner's word (20 October 2026). It keeps the wider share of the row and the label `Creează`, so the
 * touch target is exactly the button it was.
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

/**
 * The bar's own height, in one place. `.appNav` is `padding-top + glass + max(padding-bottom, inset)`
 * (feed-surface.css:1673-1677), and the shell reserves exactly this band: the floating bar, the feed's
 * overlays and the reader's rail all measure it the same way, so a word never ends up behind the glass.
 */
export function appNavHeight(bottomInset: number): number {
  const tokens = socialTokens.nav;
  return tokens.paddingTop + tokens.glass.height + Math.max(tokens.paddingBottomMin, bottomInset);
}

/**
 * That same band, for the pages that scroll behind the bar (round 10).
 *
 * The bar is permanent now, so it never steps out of the way: a list that ran under it would end with a
 * row the reader could not see — or could not press. Every scrolling page therefore reserves
 * `useNavReserve()` at the foot of its content and adds its own breathing room on top. The feed measures
 * the same number by hand (`FeedScreen`) because it is paged, not scrolled; both read `appNavHeight`, so
 * the bar and the pages cannot drift apart.
 */
export function useNavReserve(): number {
  const insets = useSafeAreaInsets();
  return appNavHeight(insets.bottom);
}

export function AppNav({ active, onSelect, onOpenCreate, avatarSource, unreadCount = 0, immersive = false }: AppNavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tokens = socialTokens.nav;
  const colors = socialTokens.colors;
  const inline = width <= 380 ? tokens.paddingInlineNarrow : tokens.paddingInline;
  const barHeight = appNavHeight(insets.bottom);

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
                <View style={[styles.disc, selected && styles.discActive, slot === 'account' ? styles.discAvatar : null]}>
                  {slot === 'account' && avatarSource ? (
                    <Image source={avatarSource} style={styles.avatar} accessibilityIgnoresInvertColors />
                  ) : slot === 'account' ? (
                    /** No picture on this account: the disc wears the JB fruit logo, like every other face. */
                    <BrandAvatar size={socialTokens.nav.disc.size - 4} />
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

/**
 * The create cell: the platinum circle and the plus it carries.
 *
 * It is drawn, not shipped as a picture, for the same reason the six other marks are: the metal is four
 * stops the theme owns (`socialTokens.nav.create.polish`), so the disc cannot arrive half-sharpened on a
 * device with a different pixel ratio, and the plus cannot change shape with the system font. The `Path`
 * across the upper left is the bezel's specular — the hairline of light a polished disc has and a flat
 * grey circle never does.
 */
function CreateDisc() {
  const disc = socialTokens.nav.create;
  const colors = socialTokens.colors;
  return (
    <View style={styles.createDisc}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient
            id="nxCreatePolish"
            cx={disc.polishCenter.x}
            cy={disc.polishCenter.y}
            r="78%"
            fx={disc.polishCenter.x}
            fy={disc.polishCenter.y}
          >
            {disc.polish.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#nxCreatePolish)" />
        {/** The bezel's light: one arc on the upper left, where the gradient's own core sits. */}
        <Path
          d="M12 30 A 45 45 0 0 1 72 8"
          fill="none"
          stroke={disc.specular}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
      <PlusMark size={disc.glyphSize} color={colors.createGlyph} weight={disc.glyphStroke} />
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
  /**
   * `.appNav.social .createNav i` — the platinum disc: 52 dp, a 4 dp bezel, the plus painted in the
   * disc's own ink and one white glow underneath. The metal is the SVG above (sharp at any density);
   * `overflow: 'hidden'` keeps that drawing inside the round bezel on every device.
   */
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
    shadowRadius: socialTokens.nav.create.glowRadius,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  /** `.appNav.social button.active:not(.createNav) i` — the open place, lit from within, in the metal. */
  discActive: {
    borderColor: jungle.borderStrong,
    backgroundColor: blackSilver.washStrong,
    shadowColor: blackSilver.hairlineStrong,
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

