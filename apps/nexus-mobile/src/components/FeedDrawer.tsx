import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloseMark, LogoutMark } from './NexusMark';
import { drawerMarks, profileModules, socialTokens } from '../theme/social';

/**
 * The drawer of the bar. It is small and has no words: one tile per module of Nexus and one tile that
 * ends the session. Markup and geometry come from apps/nexus-web/public/feed-surface.js
 * (`feedQuickDrawerMarkup`, `feedQuickTilesMarkup`) and feed-surface.css:127-141.
 * The tiles are built every time the drawer opens, so the module being read is marked from the state
 * at that moment and a drawer that moved never answers from a stale list.
 */
export type FeedDrawerProps = {
  open: boolean;
  activeModule: string;
  onClose: () => void;
  onModule: (id: string) => void;
  onLogout: () => void;
  onNewPost: () => void;
};

export function FeedDrawer({ open, activeModule, onClose, onModule, onLogout, onNewPost }: FeedDrawerProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Închide meniul" onPress={onClose} style={styles.backdrop} />
      <View accessibilityRole="menu" accessibilityLabel="Schimbă profilul" style={styles.drawer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={onClose} style={styles.close}>
          <CloseMark size={18} />
        </Pressable>
        <View style={styles.grid}>
          {profileModules.map((module) => {
            const active = module.id === activeModule;
            return (
              <Pressable
                key={module.id}
                accessibilityRole="button"
                accessibilityLabel={module.title}
                accessibilityState={{ selected: active }}
                onPress={() => onModule(module.id)}
                style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <Text style={[styles.tileGlyph, active && styles.tileGlyphActive]}>{drawerMarks[module.id] ?? module.glyph}</Text>
              </Pressable>
            );
          })}
          {/* A new post is the one action the drawer needs beyond the five profiles. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Postare nouă"
            onPress={() => { onClose(); onNewPost(); }}
            style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Text style={styles.tileGlyph}>＋</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ieși din cont"
          onPress={onLogout}
          style={({ pressed }) => [styles.logout, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <LogoutMark size={19} />
        </Pressable>
      </View>
    </Modal>
  );
}

const { drawer } = socialTokens;

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  drawer: {
    position: 'absolute',
    top: drawer.top,
    right: drawer.right,
    alignItems: 'flex-end',
    gap: drawer.gap,
    paddingTop: drawer.paddingTop,
    paddingHorizontal: drawer.paddingInline,
    paddingBottom: drawer.paddingBottom,
    borderWidth: drawer.borderWidth,
    borderColor: socialTokens.colors.drawerBorder,
    borderRadius: drawer.radius,
    backgroundColor: socialTokens.colors.drawerSurface,
    shadowColor: '#000000',
    shadowOpacity: 0.7,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: drawer.tileGap, width: drawer.gridColumns * (drawer.tileSize + drawer.tileGap) },
  tile: {
    width: drawer.tileSize,
    height: drawer.tileSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: socialTokens.colors.tileBorder,
    borderRadius: drawer.tileRadius,
    backgroundColor: socialTokens.colors.tileSurface,
  },
  tileActive: {
    borderColor: socialTokens.colors.white,
    backgroundColor: socialTokens.colors.white,
  },
  tileGlyph: { color: socialTokens.colors.white, fontSize: drawer.tileGlyphSize, fontWeight: '800' },
  tileGlyphActive: { color: socialTokens.colors.drawerSurface },
  logout: {
    alignSelf: 'center',
    width: drawer.tileSize,
    height: drawer.tileSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: drawer.tileSize / 2,
    backgroundColor: socialTokens.colors.drawerSurface,
  },
});
