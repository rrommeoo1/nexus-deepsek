import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { nexusTokens } from '../theme/tokens';
import {
  PASSWORD_HIDDEN, passwordSecureEntry, passwordVisibilityLabel, togglePasswordVisibility,
  type LocalAccountDraft, type LocalAccountLocale,
} from '../lib/loginFields';

type AuthProvider = 'google' | 'facebook';
type Locale = LocalAccountLocale;

type Props = {
  brand: ReactNode;
  locale: Locale;
  googleReady: boolean;
  facebookReady: boolean;
  walletNetwork: 'mainnet' | 'devnet';
  busy: boolean;
  error: string;
  signupError?: string;
  /**
   * What happened after "Creează cont" when the answer is good news (round 37: the account exists and
   * a confirmation message was asked for). Kept apart from `signupError` on purpose — a success
   * sentence printed in the error line teaches people to ignore the error line.
   */
  signupStatus?: string;
  /** `local-development` when this server creates accounts without a mail provider or a wallet. */
  registrationMode?: string;
  /** `local-development` when this server can set a new password without an email link. */
  recoveryMode?: string;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (draft: LocalAccountDraft) => void;
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
    handle: 'Handle (nume de utilizator)', emailOptional: 'Email (opțional)',
    localNote: 'Cont local: fără verificare de email și fără wallet · parola e stocată doar ca hash',
    identifierHint: 'Email sau @handle',
  },
  en: {
    tagline: 'One wallet. Every side of you. Every way you move.',
    signIn: 'Sign in', google: 'Continue with Google', facebook: 'Continue with Facebook',
    unconfigured: 'not configured', xportal: 'Connect xPortal',
    firstConnect: 'First connection: approve the wallet, then sign in · no payment and no transaction',
    orEmail: 'or use email', email: 'Email', password: 'Password', signInAction: 'Sign in',
    forgot: 'Forgot your password?', createAccount: 'Create account', passwordRange: 'Password (minimum 8)',
    confirmPassword: 'Confirm password', walletAuto: 'MultiversX wallet created automatically · no cost',
    handle: 'Handle (username)', emailOptional: 'Email (optional)',
    localNote: 'Local account: no email verification and no wallet · the password is stored only as a hash',
    identifierHint: 'Email or @handle',
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

/** The eye, drawn rather than typed: one glyph that matches the rest of the login card. */
function EyeMark({ crossed }: { crossed: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M1.5 12S5.2 5.5 12 5.5 22.5 12 22.5 12 18.8 18.5 12 18.5 1.5 12 1.5 12Z"
        fill="none" stroke={c.label} strokeWidth={1.6} strokeLinejoin="round"
      />
      <Path d="M12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z" fill="none" stroke={c.label} strokeWidth={1.6} />
      {crossed ? <Path d="M3.5 3.5 20.5 20.5" fill="none" stroke={c.label} strokeWidth={1.8} strokeLinecap="round" /> : null}
    </Svg>
  );
}

/**
 * One labelled text field. A secure field carries the eye: pressing it reveals the password exactly as
 * typed (`lib/loginFields.ts`), pressing it again hides it, and the value is never rewritten — the
 * hidden and the revealed state are the same characters.
 */
export function AuthField({ label, value, onChangeText, secure, email, newPassword, locale }: {
  label: string; value: string; onChangeText: (value: string) => void; secure?: boolean; email?: boolean;
  newPassword?: boolean; locale: Locale;
}) {
  const [visibility, setVisibility] = useState(PASSWORD_HIDDEN);
  const hidden = passwordSecureEntry(Boolean(secure), visibility);
  const toggleLabel = passwordVisibilityLabel(locale, visibility);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
          secureTextEntry={hidden} autoCapitalize="none" autoCorrect={false}
          underlineColorAndroid="transparent"
          maxLength={email ? 120 : 256}
          keyboardType={email ? 'email-address' : 'default'}
          autoComplete={newPassword ? 'new-password' : 'off'}
          style={[styles.input, secure && styles.inputWithEye]} />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={toggleLabel}
            accessibilityState={{ selected: visibility.revealed }}
            hitSlop={v.eye.hitSlop}
            onPress={() => setVisibility(togglePasswordVisibility)}
            style={styles.eyeButton}>
            <EyeMark crossed={!visibility.revealed} />
          </Pressable>
        ) : null}
      </View>
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

export function NexusLogin({ brand, locale, googleReady, facebookReady, walletNetwork, busy, error,
  signupError, signupStatus, registrationMode, onSignIn, onSignUp, onForgotPassword, onXPortal, onProvider }: Props) {
  const t = copy[locale];
  const localAccounts = registrationMode === 'local-development';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupHandle, setSignupHandle] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmation, setSignupConfirmation] = useState('');
  return (
    <ScrollView style={styles.landing} contentContainerStyle={styles.landingContent}
      scrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets>
      <View style={styles.card}>
        <View style={styles.brand}>{brand}</View>
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
          <AuthField label={t.identifierHint} value={email} onChangeText={setEmail} email locale={locale} />
          <AuthField label={t.password} value={password} onChangeText={setPassword} secure locale={locale} />
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
          {localAccounts ? (
            <AuthField label={t.handle} value={signupHandle} onChangeText={setSignupHandle} locale={locale} />
          ) : null}
          <AuthField label={localAccounts ? t.emailOptional : t.email} value={signupEmail}
            onChangeText={setSignupEmail} email locale={locale} />
          <AuthField label={t.passwordRange} value={signupPassword} onChangeText={setSignupPassword} secure newPassword locale={locale} />
          <AuthField label={t.confirmPassword} value={signupConfirmation} onChangeText={setSignupConfirmation} secure newPassword locale={locale} />
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => onSignUp({
              handle: signupHandle, email: signupEmail, password: signupPassword, confirmation: signupConfirmation,
            })} style={styles.button}>
            <Text style={styles.buttonText}>{t.createAccount}</Text>
          </Pressable>
          {signupError ? <Text accessibilityRole="alert" style={styles.authError}>{signupError}</Text> : null}
          {signupStatus ? <Text accessibilityLiveRegion="polite" style={styles.signupStatus}>{signupStatus}</Text> : null}
          <Text style={styles.signupNote}>◇  {localAccounts ? t.localNote : t.walletAuto}</Text>
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
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, width: '100%', height: v.field.inputHeight,
    paddingHorizontal: v.field.inputPaddingHorizontal, paddingVertical: v.field.inputPaddingVertical,
    borderWidth: v.field.inputBorderWidth, borderColor: c.fieldBorder,
    borderRadius: v.field.inputRadius, backgroundColor: c.input,
    color: c.white, fontSize: v.field.inputFontSize },
  // The eye overlaps the input's right radius instead of pushing the field narrower.
  inputWithEye: { paddingRight: v.eye.width },
  eyeButton: { position: 'absolute', right: 0, width: v.eye.width, height: v.eye.height,
    alignItems: 'center', justifyContent: 'center' },
  forgotButton: { alignSelf: 'center', minHeight: v.forgot.minHeight, padding: v.forgot.padding,
    marginTop: v.forgot.marginTop, marginBottom: v.forgot.marginBottom,
    justifyContent: 'center' },
  // React Native's public docs allow a numeric weight; its TS union omits 650.
  forgotText: { color: c.white, fontSize: v.forgot.fontSize,
    fontWeight: Number(v.forgot.fontWeight) as TextStyle['fontWeight'],
    lineHeight: v.forgot.lineHeight },
  signupNote: { color: c.providerNote, fontSize: v.signupNote.fontSize,
    lineHeight: v.signupNote.lineHeight, textAlign: 'center', marginTop: v.signupNote.marginTop },
  signupStatus: { color: c.text, fontSize: v.providerNote.fontSize,
    lineHeight: v.providerNote.lineHeight, textAlign: 'center', marginTop: 6 },
  authError: { color: c.authError, fontSize: v.providerNote.fontSize,
    lineHeight: v.providerNote.lineHeight, textAlign: 'center' },
});
