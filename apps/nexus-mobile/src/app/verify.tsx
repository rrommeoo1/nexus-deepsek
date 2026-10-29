import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { nexusTokens } from '../theme/tokens';
import { readEmailToken } from '../lib/emailAuth';
import { confirmEmailVerification, requestEmailVerification } from '../lib/session';
import { AuthField } from '../components/NexusLogin';

/**
 * `nexusdev://verify?token=…` — the screen the emailed confirmation link opens on the phone.
 *
 * The `nexusdev` scheme is the one `app.json` already declares, and the web page the email actually
 * carries offers this link on Android (`public/email-link.js`). The token is read once, sent once, and
 * never shown or stored: what the screen displays is only what the server answered.
 *
 * The screen does not sign anyone in. Confirming an address and connecting are two deliberate steps.
 */
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');
  const [message, setMessage] = useState('Se verifică linkul…');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [resendNote, setResendNote] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = readEmailToken(`nexusdev://verify?token=${String(params.token ?? '')}`);
    if (!token) {
      setState('failed');
      setMessage('Linkul nu conține un cod valid. Deschide-l din mesajul primit pe email.');
      return;
    }
    void confirmEmailVerification(token).then((result) => {
      setHandle(result.handle);
      setState('done');
      setMessage('Adresa a fost confirmată. Intră în cont cu emailul și parola.');
    }).catch((cause: unknown) => {
      setState('failed');
      setMessage(cause instanceof Error ? cause.message : 'Linkul nu a putut fi folosit.');
    });
  }, [params.token]);

  const resend = useCallback(async () => {
    setBusy(true); setResendNote('');
    try {
      await requestEmailVerification(email);
      setResendNote('Dacă adresa are un cont neconfirmat, mesajul a plecat. Verifică inboxul.');
    } catch (cause) {
      setResendNote(cause instanceof Error ? cause.message : 'Mesajul nu a putut fi cerut.');
    } finally { setBusy(false); }
  }, [email]);

  const c = nexusTokens.colors;
  const v = nexusTokens.login;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>JUNGLE BOOK</Text>
        <Text style={styles.title}>{state === 'done' ? 'Adresa a fost confirmată' : state === 'failed' ? 'Linkul nu mai este valid' : 'Confirmăm adresa'}</Text>
        {state === 'checking' ? <ActivityIndicator color={c.white} style={styles.spinner} accessibilityLabel="Se verifică linkul" /> : null}
        <Text accessibilityRole="alert" style={styles.body}>
          {state === 'done' && handle ? `Contul @${handle} este confirmat. ${message}` : message}
        </Text>

        {state === 'done' ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.primary}>
            <Text style={styles.primaryText}>Intră în cont</Text>
          </Pressable>
        ) : null}

        {state === 'failed' ? (
          <>
            <AuthField label="Email" value={email} onChangeText={setEmail} email locale="ro" />
            {resendNote ? <Text accessibilityRole="alert" style={styles.error}>{resendNote}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
              onPress={() => void resend()} style={[styles.primary, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Se trimite…' : 'Cere un link nou'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.secondary}>
              <Text style={styles.secondaryText}>Înapoi la autentificare</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.note}>
          Confirmarea nu îți schimbă parola și nu îți creează un portofel. Linkul poate fi folosit o singură dată.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const c = nexusTokens.colors;
const v = nexusTokens.login;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.canvas, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  card: { backgroundColor: c.card, borderWidth: v.card.borderWidth, borderColor: c.panelBorder, borderRadius: v.card.borderRadius,
    paddingHorizontal: v.card.paddingHorizontal, paddingVertical: 24 },
  eyebrow: { color: c.tagline, fontSize: 11, letterSpacing: 2, marginBottom: 14 },
  title: { color: c.white, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { color: c.text, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  error: { color: c.authError, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  note: { color: c.providerNote, fontSize: 12, lineHeight: 18, marginTop: 12 },
  spinner: { marginBottom: 12 },
  primary: { minHeight: v.button.minHeight, borderWidth: v.button.borderWidth, borderColor: c.buttonBorder,
    borderRadius: v.button.borderRadius, backgroundColor: c.button, alignItems: 'center', justifyContent: 'center',
    marginTop: 6, paddingHorizontal: v.button.paddingHorizontal, paddingVertical: v.button.paddingVertical },
  primaryText: { color: c.white, fontSize: v.button.fontSize, fontWeight: v.button.fontWeight as TextStyle['fontWeight'], letterSpacing: v.button.letterSpacing },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', padding: 12, marginTop: 4 },
  secondaryText: { color: c.white, fontSize: 13, fontWeight: '700' },
  disabled: { backgroundColor: c.disabledButton, borderColor: c.disabledBorder, opacity: 0.6 },
});
