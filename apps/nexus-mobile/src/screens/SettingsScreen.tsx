import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildLine } from '../lib/buildStamp';
import { JungleBackdrop } from '../components/JungleBackdrop';
import { BRAND_NAME } from '../theme/brand';
import { jungle } from '../theme/jungle';

/**
 * `Setări` — the last row of the profile menu (`lib/profileMenu.ts`).
 *
 * It holds the readings this app must never invent: the version, the backend it talks to and the build
 * marker of the JavaScript that is actually running (`lib/buildStamp.ts`). It used to hold the band's
 * switch too; the owner retired that on 18 October 2026 — the band always travels and a touch pauses it.
 *
 * Nothing in this screen signs out or switches a profile: those doors live in the same `≡` menu this
 * screen was opened from, and the row below says so instead of leaving a reader to search.
 */
export function SettingsScreen({
  onClose,
  version,
  server = '',
}: {
  onClose: () => void;
  /** `Android 0.1.0 · API: Railway`, the same line the menu's foot prints. */
  version: string;
  /** The version of the web build serving this account, when the server answers with one. */
  server?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <JungleBackdrop />
      <View style={styles.bar}>
        <Text style={styles.barTitle}>Setări</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide setările" onPress={onClose} hitSlop={8} style={styles.close}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>Despre</Text>
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={styles.title}>{BRAND_NAME}</Text>
            <Text style={styles.hint}>{version}</Text>
            {server ? <Text style={styles.hint}>Server: {server}</Text> : null}
            <Text style={styles.hint}>Build JS: {buildLine()}</Text>
          </View>
        </View>

        <Text style={styles.section}>Cont</Text>
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={styles.title}>Profiluri și deconectare</Text>
            <Text style={styles.hint}>
              Se schimbă din meniul ≡ al profilului: acolo sunt cele cinci profiluri, postarea nouă, notificările și ieșirea din cont.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: jungle.canvas },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  barTitle: { color: '#eaf6ff', fontSize: 18, fontWeight: '800' },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#101b24' },
  closeGlyph: { color: '#9fb3c4', fontSize: 15 },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  section: { marginTop: 14, color: '#9fb3c4', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#101b24' },
  words: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: '#eaf6ff', fontSize: 15, fontWeight: '700' },
  hint: { color: '#8fa3b4', fontSize: 12, lineHeight: 17 },
});
