import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildLine } from '../lib/buildStamp';
import { JungleBackdrop } from '../components/JungleBackdrop';
import { BRAND_NAME } from '../theme/brand';
import { jungle } from '../theme/jungle';

/**
 * `Setări` — the last row of the profile menu (`lib/profileMenu.ts`).
 *
 * It exists because that menu may not open the drawer: the drawer holds the five profiles, the new post
 * and the logout, and the owner drew that line on 17 October 2026. So the settings a reader can really
 * change live here instead — today that is one switch (`Banda derulantă`, `lib/bandPrefs.ts`), and the
 * readings this app must never invent: the version, the backend it talks to and the build marker of the
 * JavaScript that is actually running (`lib/buildStamp.ts`).
 *
 * Nothing in this screen signs out or switches a profile. Where those doors are is printed as a reading,
 * because a reader who looks for them deserves an answer rather than a search.
 */
export function SettingsScreen({
  onClose,
  version,
  server = '',
  bandScrolling,
  onBandScrolling,
}: {
  onClose: () => void;
  /** `Android 0.1.0 · API: Railway`, the same line the drawer's foot prints. */
  version: string;
  /** The version of the web build serving this account, when the server answers with one. */
  server?: string;
  bandScrolling: boolean;
  onBandScrolling: (on: boolean) => void;
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
        <Text style={styles.section}>Profil</Text>
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={styles.title}>Banda derulantă</Text>
            <Text style={styles.hint}>Descrierea, locul, vârsta și tipul contului se mișcă sub butoane. Oprită, banda stă pe loc și rămâne citibilă.</Text>
          </View>
          <Switch
            accessibilityLabel="Banda derulantă"
            value={bandScrolling}
            onValueChange={onBandScrolling}
            trackColor={{ false: '#1c2a36', true: jungle.primary }}
            thumbColor={bandScrolling ? '#04120f' : '#8fa3b4'}
          />
        </View>

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
              Se schimbă din sertarul paginii Acasă, butonul din colțul de sus. Meniul profilului nu închide sesiunea.
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
