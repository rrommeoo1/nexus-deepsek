import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ModulesMark } from './NexusMark';
import { NexusWordmark } from './NexusWordmark';
import { socialTokens } from '../theme/social';

/**
 * `#phoneHeader` — the one bar of the Social shell, in the two shapes the web gives it.
 *
 * The feed wears `.appHeader.feedHeader` (feed-surface.css:16-80): the wordmark at 80px, the reading
 * that is open as a single 38 × 40 pill, and the drawer door at 42 × 42. Reels floats that bar over the
 * clip (`background:linear-gradient(180deg,rgba(2,6,12,.62),rgba(2,6,12,0))`, feed-surface.css:97);
 * Whispers and News keep it in the flow on `rgba(1,5,3,.96)` closed by `--nexus-green-line`
 * (feed-surface.css:1007-1012, 1230-1235, 1666-1672).
 *
 * Every other Social screen wears the bare `.appHeader` (social-human-ux.css:23-26): the wider white
 * wordmark and the switches the web prints off the feed — the profile, the feed and the relations
 * (app.js:1418-1438). On the feed the two plates of the reading are not printed and the profile switch
 * is hidden, so that bar shows only the reading and the door.
 */
export type AppHeaderVariant = 'feed' | 'screen';

/** One `.modeBadge` of `.headerSwitches`. The web prints the label in `b` and hides `small`/`em`. */
export type AppHeaderSwitch = {
  key: 'mode' | 'feed' | 'friends';
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export type AppHeaderProps = {
  variant: AppHeaderVariant;
  /** Reels extends its existing veil through the system status inset, without moving the controls. */
  topInset?: number;
  /** The reading that is open; the feed bar prints its glyph. */
  modeId?: string;
  /** The build the reader is on, printed in `.wordmarkBuild` under the wordmark. */
  build?: string;
  /** The switches of the non-feed bar, in the order the web prints them. Ignored on the feed. */
  switches?: AppHeaderSwitch[];
  /** `.wordmark` is the way home (`#wordmark` → `goHome()`, app.js:1443). */
  onPressWordmark: () => void;
  onOpenDrawer: () => void;
  onCycleMode?: () => void;
};

const { feedHeader, appHeader, colors, wordmarkBadge } = socialTokens;
const wordmarkLabel = 'Nexus Home · revino la prima pagină';
const drawerLabel = 'Schimbă profilul Nexus';

/** `.wordmarkBuild` — the build number on the bottom-left corner of the wordmark. */
function BuildBadge({ build }: { build?: string }) {
  if (!build) return null;
  return <Text style={styles.build}>{build}</Text>;
}

/** `.feedModes button i` — the disc of the open reading, painted in the tint that reading answers in. */
function ModeGlyph({ modeId }: { modeId: string }) {
  const glyph = socialTokens.feedModes.find((entry) => entry.id === modeId)?.glyph ?? socialTokens.feedModes[0].glyph;
  const tint = feedHeader.glyphActive[modeId as keyof typeof feedHeader.glyphActive]
    ?? { ...feedHeader.glyph, backgroundEnd: '', glow: '' };
  return (
    <View
      style={[
        styles.glyph,
        {
          width: tint.size,
          height: tint.size,
          borderRadius: tint.radius,
          borderColor: tint.borderColor,
          backgroundColor: tint.background,
          shadowColor: tint.glow || 'transparent',
        },
      ]}
    >
      {tint.backgroundEnd ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="nxModeFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={tint.background} />
              <Stop offset="1" stopColor={tint.backgroundEnd} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxModeFill)" />
        </Svg>
      ) : null}
      <Text style={{ color: colors.white, fontSize: tint.fontSize, lineHeight: tint.lineHeight }}>{glyph}</Text>
    </View>
  );
}

/** Reels is the only reading whose bar floats: the clip runs under it (feed-surface.css:96-98). */
export function headerFloats(variant: AppHeaderVariant, modeId?: string): boolean {
  return variant === 'feed' && (modeId ?? socialTokens.feedModes[0].id) === 'reels';
}

export function AppHeader({ variant, modeId, topInset = 0, build, switches = [], onPressWordmark, onOpenDrawer, onCycleMode }: AppHeaderProps) {
  const mode = socialTokens.feedModes.find((entry) => entry.id === modeId) ?? socialTokens.feedModes[0];
  const floating = headerFloats(variant, modeId);

  return (
    <View
      accessibilityRole="header"
      style={[
        styles.bar,
        variant === 'feed' ? styles.feedBar : styles.screenBar,
        floating && topInset > 0 && { height: feedHeader.height + topInset },
        variant === 'feed' && {
          paddingTop: feedHeader.paddingTop + (floating ? topInset : 0),
          paddingBottom: feedHeader.paddingBottom,
          paddingHorizontal: feedHeader.paddingInline,
          gap: feedHeader.gap,
          backgroundColor: floating ? 'transparent' : colors.feedHeaderSurface,
          borderBottomWidth: floating ? 0 : 1,
          borderBottomColor: colors.greenLine,
        },
        variant === 'screen' && {
          paddingTop: appHeader.paddingTop,
          paddingBottom: appHeader.paddingBottom,
          paddingHorizontal: appHeader.paddingInline,
          gap: appHeader.gap,
          backgroundColor: colors.appHeaderSurface,
          borderBottomWidth: 1,
          borderBottomColor: colors.appHeaderLine,
        },
      ]}
    >
      {/* Reels is the only reading whose bar floats: the clip runs under it. */}
      {floating ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="nxHeaderFill" x1="0" y1="0" x2="0" y2="1">
              {feedHeader.fillReels.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor="#02060c" stopOpacity={Number(stop.color.slice(stop.color.lastIndexOf(',') + 1, -1))} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#nxHeaderFill)" />
        </Svg>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={wordmarkLabel}
        onPress={onPressWordmark}
        style={({ pressed }) => [
          variant === 'feed' ? styles.wordmarkFeed : styles.wordmarkScreen,
          pressed && styles.pressed,
        ]}
      >
        <NexusWordmark
          width={variant === 'feed' ? feedHeader.wordmarkWidth : appHeader.wordmarkWidth}
          ink={variant === 'feed' ? colors.wordmarkReels : colors.white}
        />
        <BuildBadge build={build} />
      </Pressable>

      {variant === 'feed' ? (
        <>
          {/**
           * `.feedModes` (feed-surface.js:77): the web paints the readings as a `nav[role=tablist]` whose
           * accessible name is `feed.modesLabel` — "Ce citești". The phone keeps one cycling tab, but it wears
           * the same name and the same list role, so a screen reader meets the bar under the reading it offers.
           */}
          <View accessibilityRole="tablist" accessibilityLabel="Ce citești" style={styles.modePill}>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={mode.title}
              accessibilityState={{ selected: true }}
              onPress={onCycleMode}
              style={({ pressed }) => [styles.pillPress, pressed && styles.pressed]}
            >
              <ModeGlyph modeId={mode.id} />
            </Pressable>
          </View>
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={drawerLabel}
            onPress={onOpenDrawer}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ModulesMark size={feedHeader.iconButton.iconSize} />
          </Pressable>
        </>
      ) : (
        <View style={[styles.switches, { gap: appHeader.switchesGap }]}>
          {switches.map((entry) => (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityLabel={entry.accessibilityLabel}
              onPress={entry.onPress}
              style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={styles.badgeLabel}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  feedBar: { height: feedHeader.height },
  screenBar: { height: appHeader.height },
  pressed: { transform: [{ scale: 0.96 }] },
  spacer: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  /** `.appHeader .wordmark` — 80px on the feed, 124px off it, 42px tall with the build badge inside. */
  wordmarkFeed: { width: feedHeader.wordmarkWidth, height: 42, justifyContent: 'center', alignItems: 'center' },
  wordmarkScreen: { width: appHeader.wordmarkWidth, height: 42, justifyContent: 'center', alignItems: 'center' },
  build: {
    position: 'absolute',
    left: 0,
    bottom: -wordmarkBadge.offsetBottom,
    color: colors.white,
    fontSize: wordmarkBadge.fontSize,
    lineHeight: wordmarkBadge.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: wordmarkBadge.paddingHorizontal,
    paddingVertical: wordmarkBadge.paddingVertical,
    borderWidth: wordmarkBadge.borderWidth,
    borderColor: wordmarkBadge.borderColor,
    borderRadius: wordmarkBadge.radius,
    backgroundColor: wordmarkBadge.background,
  },
  /** `.feedModes` — the 38 × 40 column the pill is centred in. */
  modePill: { width: feedHeader.modePill.width, height: feedHeader.modePill.height, alignItems: 'center', justifyContent: 'center' },
  pillPress: { alignItems: 'center', justifyContent: 'center' },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: feedHeader.glyph.borderWidth,
    overflow: 'hidden',
  },
  switches: { flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: 'row', alignItems: 'center', height: appHeader.badge.height },
  /** `.headerSwitches .modeBadge` — one tall glass pill; the web hides the `small` and the `em`. */
  badge: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: appHeader.badge.height,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: appHeader.badge.paddingInline,
    borderWidth: appHeader.badge.borderWidth,
    borderColor: colors.badgeBorder,
    borderRadius: appHeader.badge.radius,
    backgroundColor: colors.badgeSurface,
  },
  badgeLabel: {
    color: colors.badgeInk,
    fontSize: appHeader.badge.fontSize,
    fontWeight: '800',
    letterSpacing: appHeader.badge.letterSpacing,
  },
  /** `.feedHeaderIcon` — the door that opens the drawer of profiles. */
  iconButton: {
    width: feedHeader.iconButton.size,
    height: feedHeader.iconButton.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: feedHeader.iconButton.radius,
    borderWidth: feedHeader.iconButton.borderWidth,
    borderColor: feedHeader.iconButton.borderColor,
    backgroundColor: feedHeader.iconButton.background,
  },
});
