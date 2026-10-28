import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle,
} from 'react-native';
import { nexusTokens } from '../theme/tokens';
import { AuthField } from './NexusLogin';
import {
  identifierSubmissionValue, passwordsMatch, passwordSubmissionValue, type LocalAccountLocale,
} from '../lib/loginFields';

type Props = {
  visible: boolean;
  locale: LocalAccountLocale;
  busy: boolean;
  /** The server's own sentence, shown verbatim: an honest refusal, never a fake success. */
  error: string;
  /** Set only after the server confirmed the new hash, and it names the handle it changed. */
  done: string;
  onClose: () => void;
  onSubmit: (identifier: string, password: string) => void;
};

const copy = {
  ro: {
    title: 'Recuperează parola',
    body: 'Scrie emailul sau @handle-ul contului local. Parola nouă este salvată ca hash, iar toate sesiunile vechi sunt deconectate.',
    identifier: 'Email sau @handle', password: 'Parolă nouă (minim 8)', confirm: 'Confirmă parola nouă',
    submit: 'Setează parola nouă', cancel: 'Renunță', back: 'Înapoi la autentificare',
    mismatch: 'Cele două parole nu coincid.', missing: 'Scrie emailul sau handle-ul contului.',
  },
  en: {
    title: 'Recover your password',
    body: 'Enter the email or @handle of the local account. The new password is stored as a hash, and every old session is signed out.',
    identifier: 'Email or @handle', password: 'New password (minimum 8)', confirm: 'Confirm the new password',
    submit: 'Set the new password', cancel: 'Cancel', back: 'Back to sign in',
    mismatch: 'The two passwords do not match.', missing: 'Enter the email or handle of the account.',
  },
} as const;

/**
 * "Ai uitat parola?" — answered by the server, not by the phone.
 *
 * Round 35 found the old button only set a sentence ("recuperarea se face prin xPortal"), so nothing on
 * this screen was ever checked against a real account. Here the form asks the local-development
 * endpoint, the only flow that can set a password without mail; if the account has no password (a
 * migrated identity) or the server is not a local one, the server's refusal is what is shown.
 */
export function PasswordRecoverySheet({ visible, locale, busy, error, done, onClose, onSubmit }: Props) {
  const t = copy[locale];
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = () => {
    if (!identifierSubmissionValue(identifier)) { setLocalError(t.missing); return; }
    if (!passwordsMatch(password, confirmation)) { setLocalError(t.mismatch); return; }
    setLocalError('');
    onSubmit(identifierSubmissionValue(identifier), passwordSubmissionValue(password));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.body}>{t.body}</Text>
            {done ? (
              <>
                <Text accessibilityRole="alert" style={styles.done}>{done}</Text>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.primary}>
                  <Text style={styles.primaryText}>{t.back}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <AuthField label={t.identifier} value={identifier} onChangeText={setIdentifier} locale={locale} />
                <AuthField label={t.password} value={password} onChangeText={setPassword} secure newPassword locale={locale} />
                <AuthField label={t.confirm} value={confirmation} onChangeText={setConfirmation} secure newPassword locale={locale} />
                {localError || error ? (
                  <Text accessibilityRole="alert" style={styles.error}>{localError || error}</Text>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
                  onPress={submit} style={[styles.primary, busy && styles.disabled]}>
                  <Text style={styles.primaryText}>{t.submit}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
                  <Text style={styles.cancelText}>{t.cancel}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const c = nexusTokens.colors;
const v = nexusTokens.login;
const sheet = v.recovery;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: sheet.backdrop, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: sheet.radius, borderTopRightRadius: sheet.radius,
    borderWidth: v.card.borderWidth, borderColor: c.panelBorder, maxHeight: '92%' },
  content: { paddingHorizontal: sheet.paddingHorizontal, paddingTop: sheet.paddingTop, paddingBottom: sheet.paddingBottom },
  title: { color: c.white, fontSize: sheet.titleFontSize, fontWeight: sheet.titleFontWeight as TextStyle['fontWeight'],
    marginBottom: sheet.titleMarginBottom },
  body: { color: c.providerNote, fontSize: sheet.bodyFontSize, lineHeight: sheet.bodyLineHeight, marginBottom: sheet.bodyMarginBottom },
  error: { color: c.authError, fontSize: sheet.bodyFontSize, lineHeight: sheet.bodyLineHeight, marginBottom: sheet.bodyMarginBottom },
  done: { color: c.white, fontSize: sheet.bodyFontSize, lineHeight: sheet.bodyLineHeight, marginBottom: sheet.bodyMarginBottom },
  primary: { minHeight: v.button.minHeight, borderWidth: v.button.borderWidth, borderColor: c.buttonBorder,
    borderRadius: v.button.borderRadius, backgroundColor: c.button, alignItems: 'center', justifyContent: 'center',
    marginTop: sheet.actionMarginTop, paddingHorizontal: v.button.paddingHorizontal, paddingVertical: v.button.paddingVertical },
  primaryText: { color: c.white, fontSize: v.button.fontSize, fontWeight: v.button.fontWeight, letterSpacing: v.button.letterSpacing },
  disabled: { backgroundColor: c.disabledButton, borderColor: c.disabledBorder, opacity: v.provider.disabledOpacity },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', padding: 12, marginTop: 4 },
  cancelText: { color: c.white, fontSize: v.forgot.fontSize, fontWeight: Number(v.forgot.fontWeight) as TextStyle['fontWeight'] },
});
