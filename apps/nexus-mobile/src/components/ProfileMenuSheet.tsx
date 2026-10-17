import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PROFILE_MENU_CLOSE_WORD, PROFILE_MENU_TITLE, PROFILE_MENU_WORD, profileMenuFor, type ProfileMenuId } from '../lib/profileMenu';
import { jungle } from '../theme/jungle';
import { JungleBackdrop } from './JungleBackdrop';
import { socialTokens } from '../theme/social';

/**
 * The sheet the three bars of my own profile open (`lib/profileMenu.ts`).
 *
 * It is a sheet and not a dropdown inside the header for a measured reason: on Android a box drawn inside
 * the header is covered by the band under it and clipped by the scroll view — the screen changed and no
 * entry was reachable on the phone on 17 October 2026. A modal is above the column by construction.
 *
 * Nothing here is invented: the rows come from `profileMenuFor`, so a door the host cannot open is not
 * drawn at all, and the drawer's own words (logout, profile switch, new post) are not in the list.
 */
export function ProfileMenuSheet({
  open,
  handlers,
  onClose,
}: {
  open: boolean;
  handlers: Partial<Record<ProfileMenuId, (() => void) | undefined>>;
  onClose: () => void;
}) {
  const entries = profileMenuFor(handlers);
  if (entries.length === 0) return null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={PROFILE_MENU_CLOSE_WORD} onPress={onClose} style={styles.backdrop} />
      <View accessibilityRole="menu" accessibilityLabel={PROFILE_MENU_TITLE} style={styles.sheet}>
        <JungleBackdrop opacity={0.07} />
        <View style={styles.head}>
          <Text style={styles.title}>{PROFILE_MENU_TITLE}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={PROFILE_MENU_CLOSE_WORD}
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.rowOn]}
          >
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>
        {entries.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="menuitem"
            accessibilityLabel={entry.label}
            accessibilityHint={entry.hint}
            onPress={() => { onClose(); entry.run(); }}
            style={({ pressed }) => [styles.row, pressed && styles.rowOn]}
          >
            <Text numberOfLines={1} style={styles.label}>{entry.label}</Text>
            <Text numberOfLines={1} style={styles.hint}>{entry.hint}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

/** The words are also exported for the header's accessible name, so the two can never drift apart. */
export { PROFILE_MENU_WORD };

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: jungle.border,
    borderRadius: 22,
    backgroundColor: jungle.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 4 },
  title: {
    color: socialTokens.relations.neutralInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  closeGlyph: { color: socialTokens.relations.busyInk, fontSize: 14 },
  row: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, gap: 2 },
  rowOn: { backgroundColor: jungle.surfaceRaised },
  label: { color: socialTokens.relations.neutralInk, fontSize: socialTokens.relations.menuLabelSize, fontWeight: '700' },
  hint: { color: socialTokens.relations.busyInk, fontSize: 11 },
});
