import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { nexusTokens } from '../theme/tokens';

type AuthProvider = 'google' | 'facebook';
type Locale = 'ro' | 'en';

type Props = {
  brand: ReactNode;
  version: string;
  locale: Locale;
  googleReady: boolean;
  facebookReady: boolean;
  walletNetwork: 'mainnet' | 'devnet';
  busy: boolean;
  error: string;
  signupError?: string;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string, confirmation: string) => void;
  onForgotPassword: () => void;
  onXPortal: () => void;
  onProvider: (provider: AuthProvider) => void;
};

const copy = {
  ro: {
    tagline: 'Un wallet. Fiecare latură a ta. Oriunde te duce viața.',
    signIn: 'Autentificare', google: 'Continuă cu Google', facebook: 'Continuă cu Facebook',
    unconfigured: 'neconfigurat', xportal: 'Conectează xPortal',
    firstConnect: 'Prima conectare: aprobă walletul, apoi semnează loginul · fără plată și fără tranzacție',
    orEmail: 'sau cu email', email: 'Email', password: 'Parolă', signInAction: 'Intră în cont',
    forgot: 'Ai uitat parola?', createAccount: 'Creează cont', passwordRange: 'Parolă (minim 8)',
    confirmPassword: 'Confirmă parola', walletAuto: 'Wallet MultiversX creat automat · fără cost',
  },
  en: {
    tagline: 'One wallet. Every side of you. Every way you move.',
    signIn: 'Sign in', google: 'Continue with Google', facebook: 'Continue with Facebook',
    unconfigured: 'not configured', xportal: 'Connect xPortal',
    firstConnect: 'First connection: approve the wallet, then sign in · no payment and no transaction',
    orEmail: 'or use email', email: 'Email', password: 'Password', signInAction: 'Sign in',
    forgot: 'Forgot your password?', createAccount: 'Create account', passwordRange: 'Password (minimum 8)',
    confirmPassword: 'Confirm password', walletAuto: 'MultiversX wallet created automatically · no cost',
  },
} as const;

function ProviderButton({ mark, label, badge, enabled, wallet, onPress }: {
  mark: string; label: string; badge: string; enabled: boolean; wallet?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !enabled }} disabled={!enabled}
      onPress={onPress} style={[styles.button, styles.providerButton, wallet && styles.walletButton, !enabled && styles.disabledButton]}>
      <View style={[styles.providerMark, wallet && styles.walletMark]}><Text style={[styles.providerMarkText, wallet && styles.walletText, !enabled && styles.disabledText]}>{mark}</Text></View>
      <Text style={[styles.providerLabel, wallet && styles.walletText, !enabled && styles.disabledText]} numberOfLines={1}>{label}</Text>
      {badge ? <Text style={[styles.providerBadge, wallet && styles.walletBadge,
        wallet && styles.walletText, !enabled && styles.disabledText]}>{badge}</Text> : null}
    </Pressable>
  );
}

function Field({ label, value, onChangeText, secure, email, newPassword }: {
  label: string; value: string; onChangeText: (value: string) => void; secure?: boolean; email?: boolean; newPassword?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
        secureTextEntry={secure} autoCapitalize="none" autoCorrect={false}
        underlineColorAndroid="transparent"
        maxLength={email ? 120 : 256}
        keyboardType={email ? 'email-address' : 'default'}
        autoComplete={newPassword ? 'new-password' : 'off'}
        style={styles.input} />
    </View>
  );
}

function Rule({ top = false }: { top?: boolean }) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ opacity: top ? v.box.topRuleOpacity : 1 }}>
      <Defs>
        <LinearGradient id={top ? 'login-box-rule' : 'login-separator-rule'} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="transparent" />
          <Stop offset="0.5" stopColor={top ? 'rgba(255,255,255,.65)' : c.rule} />
          <Stop offset="1" stopColor="transparent" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${top ? 'login-box-rule' : 'login-separator-rule'})`} />
    </Svg>
  );
}

export function NexusLogin({ brand, version, locale, googleReady, facebookReady, walletNetwork, busy, error,
  signupError, onSignIn, onSignUp, onForgotPassword, onXPortal, onProvider }: Props) {
  const t = copy[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmation, setSignupConfirmation] = useState('');
  return (
    <ScrollView style={styles.landing} contentContainerStyle={styles.landingContent}
      scrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets>
      <View style={styles.card}>
        <View style={styles.brand}>{brand}<Text style={styles.version}>{version}</Text></View>
        <Text style={styles.tagline}>{t.tagline}</Text>
        <View style={styles.authBox}>
          <View pointerEvents="none" style={styles.boxTopRule}><Rule top /></View>
          <Text style={styles.authTitle}>{t.signIn}</Text>
          <ProviderButton mark="G" label={t.google} badge={googleReady ? '' : t.unconfigured}
            enabled={googleReady && !busy} onPress={() => onProvider('google')} />
          <ProviderButton mark="f" label={t.facebook} badge={facebookReady ? '' : t.unconfigured}
            enabled={facebookReady && !busy} onPress={() => onProvider('facebook')} />
          <ProviderButton mark="◇" label={t.xportal} badge={walletNetwork} wallet
            enabled={!busy} onPress={onXPortal} />
          <Text style={styles.providerNote}>{t.firstConnect}</Text>
          <View style={styles.separator}><View style={styles.separatorRule}><Rule /></View><Text style={styles.separatorText}>{t.orEmail.toUpperCase()}</Text><View style={styles.separatorRule}><Rule /></View></View>
          <Field label={t.email} value={email} onChangeText={setEmail} email />
          <Field label={t.password} value={password} onChangeText={setPassword} secure />
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onSignIn(email, password)} style={styles.button}>
            <Text style={styles.buttonText}>{t.signInAction}</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.authError}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={onForgotPassword} style={styles.forgotButton}>
            <Text style={styles.forgotText}>{t.forgot}</Text>
          </Pressable>
        </View>
        <View style={styles.authBox}>
          <View pointerEvents="none" style={styles.boxTopRule}><Rule top /></View>
          <Text style={styles.authTitle}>{t.createAccount}</Text>
          <Field label={t.email} value={signupEmail} onChangeText={setSignupEmail} email />
          <Field label={t.passwordRange} value={signupPassword} onChangeText={setSignupPassword} secure newPassword />
          <Field label={t.confirmPassword} value={signupConfirmation} onChangeText={setSignupConfirmation} secure newPassword />
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => onSignUp(signupEmail, signupPassword, signupConfirmation)} style={styles.button}>
            <Text style={styles.buttonText}>{t.createAccount}</Text>
          </Pressable>
          {signupError ? <Text accessibilityRole="alert" style={styles.authError}>{signupError}</Text> : null}
          <Text style={styles.signupNote}>◇  {t.walletAuto}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const c = nexusTokens.colors;
const v = nexusTokens.login;

const styles = StyleSheet.create({
  landing: { flex: 1, backgroundColor: c.canvas },
  landingContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: v.root.paddingHorizontal,
    paddingTop: v.root.paddingVertical, paddingBottom: v.root.paddingVertical },
  card: { width: '100%', maxWidth: v.card.maxWidth, paddingTop: v.card.paddingTop,
    paddingHorizontal: v.card.paddingHorizontal, paddingBottom: v.card.paddingBottom,
    borderWidth: v.card.borderWidth, borderColor: c.fieldBorder,
    borderRadius: v.card.borderRadius, backgroundColor: c.card,
    shadowColor: '#000', shadowOpacity: 0.72, shadowOffset: { width: 0, height: 24 }, shadowRadius: 72 },
  brand: { alignItems: 'center', marginTop: v.brand.marginTop, marginBottom: v.brand.marginBottom },
  version: { color: c.version, fontSize: v.version.fontSize, fontWeight: v.version.fontWeight,
    letterSpacing: v.version.letterSpacing, marginTop: v.version.marginTop },
  tagline: { color: c.tagline, fontSize: v.tagline.fontSize, lineHeight: v.tagline.lineHeight,
    textAlign: 'center', maxWidth: v.tagline.maxWidth, alignSelf: 'center', marginBottom: v.tagline.marginBottom },
  authBox: { paddingHorizontal: v.box.paddingHorizontal, paddingTop: v.box.paddingTop,
    paddingBottom: v.box.paddingBottom, marginBottom: v.box.marginBottom,
    borderWidth: v.box.borderWidth, borderColor: c.panelBorder,
    borderRadius: v.box.borderRadius, backgroundColor: c.panel },
  boxTopRule: { position: 'absolute', top: v.box.topRuleTop,
    left: v.box.topRuleHorizontalInset, right: v.box.topRuleHorizontalInset,
    height: v.box.topRuleHeight },
  authTitle: { color: c.label, fontSize: v.title.fontSize, fontWeight: v.title.fontWeight,
    letterSpacing: v.title.letterSpacing, textTransform: v.title.textTransform,
    marginBottom: v.title.marginBottom },
  button: { minHeight: v.button.minHeight, borderWidth: v.button.borderWidth,
    borderColor: c.buttonBorder, borderRadius: v.button.borderRadius,
    backgroundColor: c.button, alignItems: 'center', justifyContent: 'center',
    marginBottom: v.button.marginBottom, paddingHorizontal: v.button.paddingHorizontal,
    paddingVertical: v.button.paddingVertical },
  buttonText: { color: c.white, fontSize: v.button.fontSize, fontWeight: v.button.fontWeight,
    letterSpacing: v.button.letterSpacing },
  providerButton: { flexDirection: 'row', justifyContent: 'flex-start', height: v.provider.height },
  walletButton: { backgroundColor: c.white, borderColor: c.white },
  disabledButton: { backgroundColor: c.disabledButton, borderColor: c.disabledBorder,
    opacity: v.provider.disabledOpacity },
  providerMark: { width: v.provider.markSize, height: v.provider.markSize,
    alignItems: 'center', justifyContent: 'center', marginRight: v.provider.markMarginRight,
    borderRadius: v.provider.markRadius, backgroundColor: c.providerMark },
  walletMark: { backgroundColor: c.walletBadge },
  providerMarkText: { color: c.white, fontSize: v.button.fontSize, fontWeight: v.button.fontWeight },
  providerLabel: { flexShrink: 1, color: c.white, fontSize: v.button.fontSize,
    fontWeight: v.button.fontWeight, letterSpacing: v.button.letterSpacing },
  providerBadge: { color: c.white, fontSize: v.provider.badgeFontSize,
    fontWeight: v.provider.badgeFontWeight, marginLeft: 'auto',
    paddingHorizontal: v.provider.badgePaddingHorizontal,
    paddingVertical: v.provider.badgePaddingVertical, borderRadius: v.provider.badgeBorderRadius,
    backgroundColor: c.providerMark },
  walletText: { color: c.walletText },
  walletBadge: { backgroundColor: c.walletBadge },
  disabledText: { color: c.disabledText },
  providerNote: { color: c.providerNote, fontSize: v.providerNote.fontSize,
    lineHeight: v.providerNote.lineHeight, textAlign: 'center',
    marginHorizontal: v.providerNote.marginHorizontal,
    marginTop: v.providerNote.marginTop, marginBottom: v.providerNote.marginBottom },
  separator: { flexDirection: 'row', alignItems: 'center', gap: v.separator.gap,
    marginTop: v.separator.marginTop, marginBottom: v.separator.marginBottom },
  separatorRule: { flex: 1, height: v.separator.ruleHeight },
  separatorText: { color: c.separator, fontSize: v.separator.fontSize,
    letterSpacing: v.separator.letterSpacing },
  field: { marginBottom: v.field.marginBottom },
  fieldLabel: { color: c.label, fontSize: v.field.labelFontSize, marginBottom: v.field.gap },
  input: { width: '100%', height: v.field.inputHeight,
    paddingHorizontal: v.field.inputPaddingHorizontal, paddingVertical: v.field.inputPaddingVertical,
    borderWidth: v.field.inputBorderWidth, borderColor: c.fieldBorder,
    borderRadius: v.field.inputRadius, backgroundColor: c.input,
    color: c.white, fontSize: v.field.inputFontSize },
  forgotButton: { alignSelf: 'center', minHeight: v.forgot.minHeight, padding: v.forgot.padding,
    marginTop: v.forgot.marginTop, marginBottom: v.forgot.marginBottom,
    justifyContent: 'center' },
  // React Native's public docs allow a numeric weight; its TS union omits 650.
  forgotText: { color: c.white, fontSize: v.forgot.fontSize,
    fontWeight: Number(v.forgot.fontWeight) as TextStyle['fontWeight'],
    lineHeight: v.forgot.lineHeight },
  signupNote: { color: c.providerNote, fontSize: v.signupNote.fontSize,
    lineHeight: v.signupNote.lineHeight, textAlign: 'center', marginTop: v.signupNote.marginTop },
  authError: { color: c.authError, fontSize: v.providerNote.fontSize,
    lineHeight: v.providerNote.lineHeight, textAlign: 'center' },
});
