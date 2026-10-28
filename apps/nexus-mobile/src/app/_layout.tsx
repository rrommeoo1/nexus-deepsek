import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { blackSilver } from '../theme/blackSilver';

/**
 * The native shell. One light system bar over the content, no band of any colour under it.
 *
 * Round 8 removed the opaque `statusBand` that used to paint the top inset black on every route except
 * the camera: on the feed it was a dead strip above the post, so a 9:16 page could never reach the notch
 * — the composition started under a black bar and the owner read that as the post sitting on a band.
 * The feed now draws *under* the clock (`SafeAreaView edges={[]}` in the shell) and its own words keep
 * clear of it with `insets.top`; every other screen still keeps its content below the inset, and its own
 * surface shows through where the band used to be. Nothing is lost but the band.
 */
function NativeShell() {
  return <View style={styles.root}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: blackSilver.matteBlack } }} />
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
});
