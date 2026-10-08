import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

function NativeShell() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // The camera owns a hidden system bar. Every other route gives Android's
  // notification icons a quiet backing, while preserving edge-to-edge media.
  const showStatusBand = pathname !== '/camera' && insets.top > 0;
  return <View style={styles.root}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#07090d' } }} />
    {showStatusBand ? <View pointerEvents="none" accessibilityElementsHidden style={[styles.statusBand, { height: insets.top }]} /> : null}
  </View>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NativeShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusBand: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: 'rgba(7,9,13,0.66)' },
});
