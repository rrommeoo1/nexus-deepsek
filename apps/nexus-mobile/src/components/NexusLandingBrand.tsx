import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { BRAND_NAME } from '../theme/brand';
import { nexusTokens } from '../theme/tokens';

const source = nexusTokens.login.brand;

/**
 * The lockup at the top of the login screen: the Jungle Book mark and the name under it.
 *
 * It used to transcribe the web's `.landing .brand::before` polygon, which was the old brand glyph;
 * the mark is now the same picture the launcher, the header and the drawer carry
 * (`BrandLogo`), so the login screen cannot drift from the installed app.
 */
export function NexusLandingBrand() {
  return (
    <View style={styles.row}>
      <BrandLogo variant="large" size={132} label={BRAND_NAME} />
      <Text accessibilityRole="header" style={styles.text}>{BRAND_NAME.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: source.gap, marginTop: source.marginTop, marginBottom: source.marginBottom },
  text: { color: nexusTokens.colors.white, fontSize: 26,
    fontWeight: '600', letterSpacing: 5.4 },
});
