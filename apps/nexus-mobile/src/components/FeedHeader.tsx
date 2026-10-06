import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ModulesMark } from './NexusMark';
import { NexusWordmark } from './NexusWordmark';
import { socialTokens } from '../theme/social';

/**
 * The feed header, transcribed from feed-surface.css:16-80 and `feedModeSwitchMarkup`:
 * the wordmark on the left at 76 × 20, the name of the reading that is open as a single 38px badge in
 * the middle, and the modules button on the right at 40 × 40. Neighbouring readings stay reachable
 * through the same press, and their marks are never duplicated in the bar.
 */
export type FeedHeaderProps = {
  modeId: string;
  onCycleMode: () => void;
  onOpenDrawer: () => void;
};

export function FeedHeader({ modeId, onCycleMode, onOpenDrawer }: FeedHeaderProps) {
  const mode = socialTokens.feedModes.find((entry) => entry.id === modeId) ?? socialTokens.feedModes[0];
  return (
    <View style={styles.header}>
      <View style={styles.wordmark}>
        <NexusWordmark width={socialTokens.feedHeader.wordmarkWidth} ink={socialTokens.colors.white} />
      </View>
      <View style={styles.modes}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={mode.title}
          accessibilityState={{ selected: true }}
          onPress={onCycleMode}
          style={({ pressed }) => [styles.badge, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Text style={styles.badgeGlyph}>{mode.glyph}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Schimbă profilul Nexus"
        onPress={onOpenDrawer}
        style={({ pressed }) => [styles.icon, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <ModulesMark />
      </Pressable>
    </View>
  );
}

const { feedHeader } = socialTokens;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: feedHeader.gap,
    minHeight: feedHeader.minHeight,
    paddingTop: feedHeader.paddingTop,
    paddingBottom: feedHeader.paddingBottom,
    paddingHorizontal: feedHeader.paddingInline,
    backgroundColor: socialTokens.colors.headerSurface,
  },
  wordmark: { flexGrow: 0, flexShrink: 0 },
  modes: { flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: feedHeader.modeBadge.size,
    height: feedHeader.modeBadge.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: feedHeader.modeBadge.radius,
    borderWidth: 1,
    borderColor: socialTokens.colors.glassBorder,
    backgroundColor: socialTokens.colors.markBackground,
  },
  badgeGlyph: { color: socialTokens.colors.white, fontSize: feedHeader.modeBadge.glyphSize },
  icon: {
    width: feedHeader.iconButton.size,
    height: feedHeader.iconButton.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: feedHeader.iconButton.radius,
    borderWidth: 1,
    borderColor: socialTokens.colors.glassBorder,
    backgroundColor: socialTokens.colors.markBackground,
  },
});
