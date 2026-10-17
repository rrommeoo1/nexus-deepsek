import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../screens/ProfileScreen';

/**
 * Somebody else's record, pushed on the stack. The header draws its own arrow back (`ProfileHeader`), so this
 * route no longer puts a floating button over the screen: the arrow and the title are one header, not two.
 *
 * The route sits edge to edge, and `ProfileHeader` starts at the top of whatever it is given: without the
 * status-bar inset the header's top row — the arrow back and the share — lands *under* the clock, drawn where
 * nobody sees it and pressed by nobody (found on the phone on 17 October 2026, `HANDOFF.md` §4 #10). The tab
 * profile gets that inset from the shell; a pushed route has to ask for it.
 *
 * A visitor's header keeps its `Mesaj` button disabled with its reason, because the inbox is a slot of the
 * shell behind this route and no conversation screen is reachable from here yet (`MIGRATION.md` §19.4).
 */
export default function SocialProfileRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const person = typeof handle === 'string' ? handle.trim() : '';
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {person
        ? <ProfileScreen key={person} handle={person} onBack={() => router.back()} />
        : <Text style={styles.error}>Profil indisponibil.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  error: { color: '#ffffff', margin: 24 },
});
