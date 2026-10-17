import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ProfileScreen } from '../../screens/ProfileScreen';

/**
 * Somebody else's record, pushed on the stack. The header draws its own arrow back (`ProfileHeader`), so this
 * route no longer puts a floating button over the screen: the arrow and the title are one header, not two.
 *
 * A visitor's header keeps its `Mesaj` button disabled with its reason, because the inbox is a slot of the
 * shell behind this route and no conversation screen is reachable from here yet (`MIGRATION.md` §19.4).
 */
export default function SocialProfileRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const person = typeof handle === 'string' ? handle.trim() : '';

  return (
    <View style={styles.screen}>
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
