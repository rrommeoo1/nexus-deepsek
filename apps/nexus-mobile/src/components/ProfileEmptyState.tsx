import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { PROFILE_EMPTY_STATES, type ContentTab } from '../lib/profileContent';
import { socialTokens } from '../theme/social';

/**
 * The drawings of an empty region: `EMPTY_STATES` (`profile-experience.js:133-139`), stroked exactly the
 * way `emptyStateBlock` strokes them (`viewBox 0 0 24 24`, `fill:none`, `stroke-width:1.5`, a round cap
 * and a round join, painted in `currentColor`).
 */
const ICONS: Record<ContentTab, ReactNode> = {
  flow: <Path d="M3 12h4l2-6 3 12 2-6h7" />,
  reels: <><Rect x={4} y={5} width={16} height={14} rx={3} /><Path d="m10 9 5 3-5 3z" /></>,
  shots: <><Rect x={4} y={6} width={16} height={12} rx={3} /><Circle cx={9} cy={11} r={2} /><Path d="m5 17 5-5 4 4 3-2 2 3" /></>,
  whispers: <><Path d="M20 4c-6 1-11 5-13 11l-3 5" /><Path d="M20 4c1 5-2 9-7 10l-4 1" /></>,
  moments: <><Path d="M12 3v18" /><Path d="M3 12h18" /><Circle cx={12} cy={12} r={8.5} /></>,
};

/**
 * What a tab says while it has nothing to read: the sign, what is missing, and the one verb that fixes
 * it (`profile-experience.js:141-145`, with the words of `profile.empty.<kind>.title|detail` of the
 * ro-RO bundle, kept in `PROFILE_EMPTY_STATES`).
 *
 * The web renders all five blocks and hides the four that are not the reader's tab, because its filters
 * switch which one is on screen without rebuilding them. The phone draws the one block the tab owns:
 * there is one region on screen either way, and the reader hears one sentence instead of four.
 */
export function ProfileEmptyState({ tab }: { tab: ContentTab }) {
  const words = PROFILE_EMPTY_STATES[tab];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${words.title} ${words.detail}`}
      style={styles.block}
    >
      <Svg
        width={socialTokens.archive.emptyIconSize}
        height={socialTokens.archive.emptyIconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={socialTokens.archive.emptyIconInk}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {ICONS[tab]}
      </Svg>
      <Text accessible={false} style={styles.title}>{words.title}</Text>
      <Text accessible={false} style={styles.detail}>{words.detail}</Text>
    </View>
  );
}

/** `.ownerEmpty{min-height:208px;padding:24px 24px 34px;gap:6px;color:#93a6b0}` and its two words. */
const styles = StyleSheet.create({
  block: {
    minHeight: socialTokens.archive.emptyMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: socialTokens.archive.emptyGap,
    paddingTop: socialTokens.archive.emptyPaddingTop,
    paddingHorizontal: socialTokens.archive.emptyPaddingHorizontal,
    paddingBottom: socialTokens.archive.emptyPaddingBottom,
  },
  title: { color: socialTokens.archive.emptyTitleInk, fontSize: socialTokens.archive.emptyTitleSize, fontWeight: '600' },
  detail: {
    color: socialTokens.archive.emptyInk,
    fontSize: socialTokens.archive.emptyDetailSize,
    lineHeight: socialTokens.archive.emptyDetailLineHeight,
    textAlign: 'center',
  },
});
