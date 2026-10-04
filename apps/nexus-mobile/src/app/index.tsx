import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>NEXUS</Text>
        <Text style={styles.badge}>ANDROID DEV</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Nexus pentru Android</Text>
        <Text style={styles.description}>
          Acesta este un client de dezvoltare separat. Funcțiile Nexus existente rămân în aplicația web;
          migrarea lor pe Android se face etapizat.
        </Text>
        <Text style={styles.section}>Primul test: camera nativă</Text>
        <Text style={styles.description}>
          Compară încadrarea 9:16 cu 3:4 pe același telefon. Aplicația afișează 0,7× numai dacă
          obiectivul disponibil permite acest zoom real.
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/camera')}>
          <Text style={styles.buttonText}>Deschide camera de test</Text>
        </Pressable>
      </View>
      <View style={styles.bottomBar}>
        <Text style={styles.bottomLabel}>Acasă</Text>
        <Pressable accessibilityLabel="Deschide camera" accessibilityRole="button" style={styles.plus} onPress={() => router.push('/camera')}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
        <Text style={styles.bottomLabel}>Dev 0.1</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07090d' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 24 },
  brand: { color: '#f8fafc', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  badge: { color: '#a9f6e7', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', lineHeight: 38 },
  section: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 18 },
  description: { color: '#aab3be', fontSize: 15, lineHeight: 23 },
  button: { backgroundColor: '#f83d69', minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', minHeight: 80, borderTopWidth: 1, borderTopColor: '#262b32' },
  bottomLabel: { color: '#aab3be', fontSize: 13, fontWeight: '600' },
  plus: { width: 54, height: 42, borderRadius: 12, backgroundColor: '#f83d69', alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontSize: 34, fontWeight: '500', lineHeight: 38 },
});
