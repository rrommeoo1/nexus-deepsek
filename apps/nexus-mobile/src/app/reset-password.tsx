import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { nexusTokens } from '../theme/tokens';
import { readEmailToken, validateNewPassword } from '../lib/emailAuth';
import { confirmEmailPasswordReset, requestEmailPasswordReset } from '../lib/session';
import { AuthField } from '../components/NexusLogin';
import { passwordSubmissionValue } from '../lib/loginFields';

/**
 * `nexusdev://reset-password?token=…` — the screen the emailed reset link opens on the phone.
 *
 * Same contract as the web page (`public/reset-password.html`): the token is sent once, the password
 * reaches the server exactly as typed, and every old session is signed out by that single call. A
 * password the server refuses leaves the link usable, so the person can try again without asking for
 * a new message.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = readEmailToken(`nexusdev://reset-password?token=${String(params.token ?? '')}`);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'form' | 'done'>('form');
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [resendNote, setResendNote] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || token) return;
    started.current = true;
    setError('Linkul nu conține un cod valid. Cere unul nou mai jos.');
  }, [token]);

  const submit = useCallback(async () => {
    const complaint = validateNewPassword('ro', password, confirmation);
    if (complaint) { setError(complaint); return; }
    setError(''); setBusy(true);
    try {
      const result = await confirmEmailPasswordReset(token, passwordSubmissionValue(password));
      setHandle(result.handle);
      setState('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Parola nu a putut fi schimbată.');
    } finally { setBusy(false); }
  }, [confirmation, password, token]);

  const resend = useCallback(async () => {
    setResendNote(''); setBusy(true);
    try {
      await requestEmailPasswordReset(email);
      setResendNote('Dacă adresa are un cont cu parolă, linkul a plecat. Verifică inboxul.');
    } catch (cause) {
      setResendNote(cause instanceof Error ? cause.message : 'Linkul nu a putut fi cerut.');
    } finally { setBusy(false); }
  }, [email]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>JUNGLE BOOK</Text>
          {state === 'done' ? (
            <>
              <Text style={styles.title}>Parola a fost schimbată</Text>
              <Text style={styles.body}>
                {handle ? `Contul @${handle} are o parolă nouă, iar sesiunile vechi au fost deconectate.` : 'Sesiunile vechi au fost deconectate.'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.primary}>
                <Text style={styles.primaryText}>Intră în cont</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Alege o parolă nouă</Text>
              <Text style={styles.body}>Minim 8 caractere. Toate sesiunile deschise vor fi deconectate.</Text>
              <AuthField label="Parolă nouă" value={password} onChangeText={setPassword} secure newPassword locale="ro" />
              <AuthField label="Confirmă parola nouă" value={confirmation} onChangeText={setConfirmation} secure newPassword locale="ro" />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !token }} disabled={busy || !token}
                onPress={() => void submit()} style={[styles.primary, (busy || !token) && styles.disabled]}>
                <Text style={styles.primaryText}>{busy ? 'Se salvează…' : 'Setează parola'}</Text>
              </Pressable>

              <Text style={styles.divider}>{token ? 'Linkul nu mai merge?' : 'Cere un link nou'}</Text>
              <AuthField label="Email" value={email} onChangeText={setEmail} email locale="ro" />
              {resendNote ? <Text accessibilityRole="alert" style={styles.note}>{resendNote}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
                onPress={() => void resend()} style={[styles.secondaryButton, busy && styles.disabled]}>
                <Text style={styles.secondaryText}>Trimite un link nou</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.link}>
                <Text style={styles.linkText}>Înapoi la autentificare</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.footer}>Nimeni din echipă nu îți va cere parola, nici prin email, nici prin telefon.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const c = nexusTokens.colors;
const v = nexusTokens.login;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.canvas },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  card: { backgroundColor: c.card, borderWidth: v.card.borderWidth, borderColor: c.panelBorder, borderRadius: v.card.borderRadius,
    paddingHorizontal: v.card.paddingHorizontal, paddingVertical: 24 },
  eyebrow: { color: c.tagline, fontSize: 11, letterSpacing: 2, marginBottom: 14 },
  title: { color: c.white, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { color: c.text, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  error: { color: c.authError, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  note: { color: c.providerNote, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  divider: { color: c.tagline, fontSize: 12, letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  footer: { color: c.providerNote, fontSize: 12, lineHeight: 18, marginTop: 16 },
  primary: { minHeight: v.button.minHeight, borderWidth: v.button.borderWidth, borderColor: c.buttonBorder,
    borderRadius: v.button.borderRadius, backgroundColor: c.button, alignItems: 'center', justifyContent: 'center',
    marginTop: 6, paddingHorizontal: v.button.paddingHorizontal, paddingVertical: v.button.paddingVertical },
  primaryText: { color: c.white, fontSize: v.button.fontSize, fontWeight: v.button.fontWeight as TextStyle['fontWeight'], letterSpacing: v.button.letterSpacing },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderColor: c.buttonBorder, borderRadius: v.button.borderRadius,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  secondaryText: { color: c.white, fontSize: 14, fontWeight: '700' },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', padding: 12, marginTop: 2 },
  linkText: { color: c.white, fontSize: 13, fontWeight: '700' },
  disabled: { backgroundColor: c.disabledButton, borderColor: c.disabledBorder, opacity: 0.6 },
});
