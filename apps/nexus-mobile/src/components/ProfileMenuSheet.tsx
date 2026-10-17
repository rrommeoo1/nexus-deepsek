import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  PROFILE_MENU_CLOSE_WORD, PROFILE_MENU_SWITCH_WORD, PROFILE_MENU_TITLE, PROFILE_MENU_WORD,
  profileMenuFor, type ProfileMenuId, type ProfileSwitchOption,
} from '../lib/profileMenu';
import { jungle } from '../theme/jungle';
import { JungleBackdrop } from './JungleBackdrop';
import { socialTokens } from '../theme/social';

/**
 * The sheet the three bars (≡) of my own profile open (`lib/profileMenu.ts`).
 *
 * It is a sheet and not a dropdown inside the header for a measured reason: on Android a box drawn inside
 * the header is covered by the band under it and clipped by the scroll view — the screen changed and no
 * entry was reachable on the phone on 17 October 2026. A modal is above the column by construction.
 *
 * Since 18 October 2026 this is the app's **only** menu: the drawer over the feed is gone (owner's rule —
 * the mark and its button looked bad over the clip), so the five profiles, the new post, the bell and the
 * logout are rows here. Every row comes from `profileMenuFor`, so a door the host cannot open is not drawn
 * at all; the profiles are chips because there are five of them and a column of five more rows would push
 * the money out of sight.
 */
export function ProfileMenuSheet({
  open,
  handlers,
  profiles = [],
  activePersona = '',
  onSwitchProfile,
  version = '',
  build = '',
  onClose,
}: {
  open: boolean;
  handlers: Partial<Record<ProfileMenuId, (() => void) | undefined>>;
  /** The five profiles of this account; one chip each, the open one marked. */
  profiles?: ProfileSwitchOption[];
  activePersona?: string;
  onSwitchProfile?: (persona: string) => void;
  /** `Android 0.1.0 · API: Railway`, the line the drawer's foot used to print. */
  version?: string;
  /** The JavaScript this screen is running (`lib/buildStamp.ts`). */
  build?: string;
  onClose: () => void;
}) {
  const entries = profileMenuFor(handlers);
  if (entries.length === 0) return null;
  const switchable = typeof onSwitchProfile === 'function' && profiles.length > 1;

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
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {switchable ? (
            <View style={styles.switchBlock}>
              <Text style={styles.switchLabel}>{PROFILE_MENU_SWITCH_WORD}</Text>
              <View style={styles.chips}>
                {profiles.map((entry) => {
                  const active = entry.persona === activePersona;
                  return (
                    <Pressable
                      key={entry.persona}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${PROFILE_MENU_SWITCH_WORD}: ${entry.label}`}
                      onPress={() => { onClose(); if (!active) onSwitchProfile?.(entry.persona); }}
                      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.rowOn]}
                    >
                      <Text numberOfLines={1} style={[styles.chipLabel, active && styles.chipLabelActive]}>{entry.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
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
          {version || build ? (
            <View style={styles.foot}>
              {version ? <Text style={styles.footLine}>{version}</Text> : null}
              {build ? <Text accessibilityLabel={`Build ${build}`} style={styles.footBuild}>{`build ${build}`}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
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
    maxHeight: '82%',
    padding: 10,
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
  body: { gap: 6, paddingBottom: 2 },
  switchBlock: { gap: 6, paddingBottom: 4 },
  switchLabel: {
    color: socialTokens.relations.busyInk,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 2 },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: jungle.border,
    backgroundColor: jungle.surfaceRaised,
  },
  chipActive: { borderColor: jungle.primary, backgroundColor: jungle.primary },
  chipLabel: { color: socialTokens.relations.neutralInk, fontSize: 12.5, fontWeight: '700' },
  chipLabelActive: { color: '#04120f' },
  row: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, gap: 2 },
  rowOn: { backgroundColor: jungle.surfaceRaised },
  label: { color: socialTokens.relations.neutralInk, fontSize: socialTokens.relations.menuLabelSize, fontWeight: '700' },
  hint: { color: socialTokens.relations.busyInk, fontSize: 11 },
  foot: { alignItems: 'center', gap: 2, paddingTop: 8, paddingBottom: 4 },
  footLine: { color: 'rgba(255,255,255,0.45)', fontSize: 10.5, textAlign: 'center' },
  footBuild: { color: 'rgba(255,255,255,0.34)', fontSize: 9.5, textAlign: 'center' },
});
