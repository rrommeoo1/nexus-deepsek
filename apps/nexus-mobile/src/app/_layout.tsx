import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { blackSilver } from '../theme/blackSilver';
import { logXPortal, xPortalReturnRoute } from '../lib/xportalLogin';

/**
 * Every link that brings the app back to the foreground, in one line each.
 *
 * This is not navigation: expo-router already routes these links. It is **evidence**. The xPortal
 * login is given `nexusdev://` as `redirect.native`; whether Android and xPortal honour it decides
 * whether the reader has to switch apps by hand, and until now nothing in the app recorded it — the
 * only trace was the WebView's own `app-active`, which looks identical after a manual switch. A
 * `link-return` immediately followed by `app-active` is an automatic return; `app-active` alone is
 * a manual one. No part of the URL beyond the scheme and first path segment is logged.
 */
function useReturnLinkTrace() {
  useEffect(() => {
    let live = true;
    const record = (url: string | null | undefined, cold: boolean) => {
      if (!live || !url) return;
      const route = xPortalReturnRoute(url);
      if (!route) return;
      logXPortal('link-return', { route, cold });
    };
    void Linking.getInitialURL().then((url) => record(url, true)).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => record(event.url, false));
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
}

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
  useReturnLinkTrace();
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
