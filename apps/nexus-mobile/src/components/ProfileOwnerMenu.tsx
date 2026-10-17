import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { OWNER_MENU_WORD, ownerMenuFor } from '../lib/ownerMenu';
import { socialTokens } from '../theme/social';

/**
 * The one round entry of my own profile header. It replaces the old row of three controls: "Distribuie
 * profilul" is no longer a wide button, and the entry holds the four doors the owner named, monetisation
 * first. A door the host cannot open is not printed at all (`ownerMenuFor`), so nothing here is a label
 * without a room behind it.
 *
 * The list opens as a sheet in its own window, not as an absolutely positioned box inside the header:
 * on Android a dropdown drawn inside the header is covered by the band under it (and clipped by the
 * scroll view), which is exactly what happened on the phone on 17 October 2026 â€” the screen changed but
 * no entry was reachable. A sheet is above the column by construction.
 */
export function ProfileOwnerMenu({
  onMonetize, onShare, onWallet, onSettings, style,
}: {
  onMonetize?: () => void;
  onShare?: () => void;
  onWallet?: () => void;
  onSettings?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const entries = ownerMenuFor({ monetize: onMonetize, share: onShare, wallet: onWallet, settings: onSettings });
  if (entries.length === 0) return null;

  return (
    <View style={[styles.column, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={OWNER_MENU_WORD}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.round, (pressed || open) && styles.roundOn]}
      >
        <Text style={styles.roundGlyph}>â‹¯</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="ÃŽnchide meniul profilului" onPress={() => setOpen(false)} style={styles.backdrop} />
        <View style={styles.sheet}>
          {entries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="menuitem"
              accessibilityLabel={entry.label}
              onPress={() => { setOpen(false); entry.run(); }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]}
            >
              <Text style={styles.menuLabel}>{entry.label}</Text>
              <Text style={styles.menuHint}>{entry.hint}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { minWidth: 0 },
  round: {
    width: socialTokens.relations.roundSize,
    height: socialTokens.relations.roundSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.relations.roundSize / 2,
    borderWidth: 1,
    borderColor: socialTokens.relations.neutralBorder,
    backgroundColor: socialTokens.relations.neutralSurface,
  },
  roundOn: { backgroundColor: '#12222c' },
  roundGlyph: { color: socialTokens.relations.neutralInk, fontSize: 16, lineHeight: 18 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: socialTokens.relations.menuBorder,
    borderRadius: 20,
    backgroundColor: socialTokens.relations.menuSurface,
  },
  menuRow: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, gap: 2 },
  menuRowOn: { backgroundColor: '#12222c' },
  menuLabel: { color: socialTokens.relations.neutralInk, fontSize: socialTokens.relations.menuLabelSize, fontWeight: '700' },
  menuHint: { color: socialTokens.relations.neutralInk, opacity: 0.6, fontSize: 11 },
});

