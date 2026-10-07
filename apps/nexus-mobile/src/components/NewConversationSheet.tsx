import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import type { Conversation } from '../lib/socialTypes';

type Kind = 'direct' | 'group';

/**
 * The door `#new-conversation` opens. The web's own creator (`app.js:7951-8013`) asks for Nexus
 * usernames, checks them locally before the call, and prints the server's refusal when the profile may
 * not write. The request is the same `POST /api/chat/conversations` with
 * `{ kind, username, usernames, title }`, and on success the web lands on the new conversation
 * (`app.js:8001-8005`) — here the sheet closes and the thread opens, on the same row the inbox draws.
 *
 * The copy is the Romanian block of `interface-locale.js` (`conversation.*`), verbatim.
 */
const COPY = {
  eyebrow: 'MESAJ NOU',
  title: 'Conversație pe username',
  close: 'Închide conversația nouă',
  direct: 'Direct',
  group: 'Grup',
  usernames: 'Username Nexus',
  groupName: 'Numele grupului',
  groupHint: 'Pentru grup, separă cel puțin două username-uri prin virgulă.',
  continue: 'Continuă',
  invalidUsernames: 'Folosește username-uri Nexus de 2–30 caractere: litere, cifre sau underscore.',
  directOne: 'O conversație directă necesită exact un username.',
  groupTwo: 'Un grup necesită cel puțin două username-uri distincte.',
  tooMany: 'Un grup poate avea maximum 50 de membri, inclusiv creatorul.',
  self: 'Nu îți poți adăuga propriul username ca destinatar.',
  groupNameRequired: 'Adaugă numele grupului.',
  creating: 'Creez conversația în siguranță…',
  rateLimited: 'Prea multe încercări. Reîncearcă mai târziu.',
  failed: 'Conversația nu a putut fi creată. Verifică username-urile și setările de confidențialitate.',
};

/** The shape the web accepts, one username at a time (`app.js:7978`). */
const USERNAME = /^[a-z0-9_]{2,30}$/;

export function NewConversationSheet({ selfHandle, onClose, onCreated }: {
  /** The writer's own handle, refused as an addressee (`conversation.self`). */
  selfHandle?: string;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [kind, setKind] = useState<Kind>('direct');
  const [usernames, setUsernames] = useState('');
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const list = [...new Set(usernames.split(',').map((entry) => entry.trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];
    if (list.some((entry) => !USERNAME.test(entry))) return setNotice(COPY.invalidUsernames);
    if (kind === 'direct' && list.length !== 1) return setNotice(COPY.directOne);
    if (kind === 'group' && list.length < 2) return setNotice(COPY.groupTwo);
    if (kind === 'group' && list.length > 49) return setNotice(COPY.tooMany);
    if (list.includes(String(selfHandle || '').toLowerCase())) return setNotice(COPY.self);
    if (kind === 'group' && !title.trim()) return setNotice(COPY.groupNameRequired);
    setBusy(true);
    setNotice(COPY.creating);
    try {
      const result = await nexusApi<{ ok: true; conversation?: Conversation }>('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind, username: list[0], usernames: list, title: kind === 'group' ? title.trim() : '' }),
      });
      const created = result.conversation;
      if (!created || created.kind !== kind || !Number.isSafeInteger(Number(created.id)) || Number(created.id) <= 0) {
        setNotice(COPY.failed);
        return;
      }
      onCreated(created);
    } catch (cause) {
      setNotice(cause instanceof NexusApiError && cause.code === 'RATE_LIMITED' ? COPY.rateLimited : COPY.failed);
    } finally {
      setBusy(false);
    }
  };


  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={COPY.close} onPress={onClose} style={styles.dismiss} />
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>{COPY.eyebrow}</Text>
          <Text style={styles.title}>{COPY.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.close} onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          <View style={styles.kinds}>
            {(['direct', 'group'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === option }}
                accessibilityLabel={option === 'direct' ? COPY.direct : COPY.group}
                onPress={() => setKind(option)}
                style={[styles.kind, kind === option && styles.kindOn]}
              >
                <Text style={[styles.kindText, kind === option && styles.kindTextOn]}>
                  {option === 'direct' ? COPY.direct : COPY.group}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{COPY.usernames}</Text>
          <TextInput
            value={usernames}
            onChangeText={setUsernames}
            placeholder="@username"
            placeholderTextColor="#8e9ca5"
            accessibilityLabel={COPY.usernames}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={255}
            style={styles.input}
          />

          {kind === 'group' ? (
            <View style={styles.groupBlock}>
              <Text style={styles.label}>{COPY.groupName}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                accessibilityLabel={COPY.groupName}
                maxLength={80}
                style={styles.input}
              />
              <Text style={styles.hint}>{COPY.groupHint}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COPY.continue}
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.submit, busy && styles.submitBusy]}
          >
            {busy ? <ActivityIndicator color="#050608" /> : <Text style={styles.submitText}>{COPY.continue}</Text>}
          </Pressable>

          {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  /** The web closes the creator on a click outside the panel (`app.js:7958`). */
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** `.account-modal` — the panel the web draws the creator in. */
  panel: {
    width: '100%',
    maxWidth: 420,
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 20,
    backgroundColor: '#050608',
  },
  eyebrow: { color: '#80dcd9', fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { color: '#f5f8fa', fontSize: 19, fontWeight: '800' },
  close: { position: 'absolute', right: 8, top: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  /** `.chatKind` — the two radios of the web (`conversation.direct` / `conversation.group`). */
  kinds: { flexDirection: 'row', gap: 8 },
  kind: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    backgroundColor: '#0b0c0e',
  },
  kindOn: { borderColor: '#ffffff', backgroundColor: '#ffffff' },
  kindText: { color: '#eef8fb', fontSize: 14, fontWeight: '700' },
  kindTextOn: { color: '#050608' },
  groupBlock: { gap: 10 },
  label: { color: '#8e9ca5', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    backgroundColor: '#101a22',
    color: '#f5f8fa',
    fontSize: 15,
  },
  hint: { color: '#8e9ca5', fontSize: 12, lineHeight: 17 },
  submit: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#ffffff' },
  submitBusy: { opacity: 0.6 },
  submitText: { color: '#050608', fontSize: 14, fontWeight: '800' },
  notice: { color: '#ffc6c6', fontSize: 12, lineHeight: 17 },
});

