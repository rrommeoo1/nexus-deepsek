import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { RemoteImageSource } from '../components/PostMedia';
import {
  initialsFor, mediaSourceForPath, relativeTime,
  type ChatMessage, type Conversation, type ConversationThread, type ConversationsPage,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/** A nonce the server accepts: 8-80 chars of `[a-zA-Z0-9:_-]`, minted per send (replay-safe). */
function messageNonce(): string {
  return `nx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** The title of a conversation, read the way the unified inbox reads it: a group name, else its peers. */
function titleFor(conversation: Conversation): string {
  if (conversation.kind === 'group' && conversation.title) return conversation.title;
  const peers = (conversation.participants ?? []).filter((person) => person.role !== 'owner' || peerCount(conversation) === 1);
  const names = peers.map((person) => person.display_name || person.handle).filter(Boolean);
  if (names.length) return names.join(', ');
  return 'Conversație';
}

function peerCount(conversation: Conversation): number {
  return (conversation.participants ?? []).length;
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

/**
 * The unified inbox and one real thread behind it. The list is `GET /api/chat/conversations`
 * (persona `all`, box `inbox`) and the thread is `GET /api/chat/conversations/:id/messages`; sending is
 * the server's own plaintext boundary (`POST …/messages` with a per-send nonce). The server decides who
 * may read or reply - a thread whose profile is not the active one answers 409 and the screen prints
 * that sentence instead of a fake composer.
 */
export function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [open, setOpen] = useState<Conversation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  // The read starts in the effect, but every setState runs inside a promise callback, so nothing is
  // written to state synchronously while React runs the effect (the pattern the profile uses). Retry,
  // refresh and coming back from a thread bump `nonce` to run the same read again.
  useEffect(() => {
    let alive = true;
    nexusApi<ConversationsPage>('/api/chat/conversations?persona=all&box=inbox')
      .then((page) => { if (alive) { setConversations(page.conversations ?? []); setError(''); } })
      .catch((cause) => { if (alive) setError(describe(cause)); })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [nonce]);

  const reload = () => { setError(''); setLoading(true); setNonce((value) => value + 1); };
  const refresh = () => { setRefreshing(true); setNonce((value) => value + 1); };

  if (open) return <ThreadView conversation={open} onBack={() => { setOpen(null); refresh(); }} />;

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={socialTokens.colors.white} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={reload} style={styles.retry}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={socialTokens.colors.white} />}
          ListEmptyComponent={<Text style={styles.empty}>Nicio conversație încă.</Text>}
          renderItem={({ item }) => <ConversationRow conversation={item} onOpen={() => setOpen(item)} />}
        />
      )}
    </View>
  );
}

function ConversationRow({ conversation, onOpen }: { conversation: Conversation; onOpen: () => void }) {
  const peer = (conversation.participants ?? []).find((person) => person.role !== 'owner') ?? (conversation.participants ?? [])[0];
  const avatar = mediaSourceForPath(peer?.avatar);
  const title = titleFor(conversation);
  const preview = conversation.blocked
    ? 'Conversație blocată de regulile de confidențialitate.'
    : conversation.last_message?.body || (conversation.last_message?.attachment_url ? 'Atașament' : 'Fără mesaje încă.');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Deschide conversația cu ${title}`} onPress={onOpen} style={styles.row}>
      <View style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(title, peer?.handle)}</Text> : null}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{preview}</Text>
      </View>
      <View style={styles.rowAside}>
        {conversation.unread ? <View style={styles.badge}><Text style={styles.badgeText}>{conversation.unread > 99 ? '99+' : conversation.unread}</Text></View> : null}
        <Text style={styles.time}>{relativeTime(conversation.updated_at)}</Text>
      </View>
    </Pressable>
  );
}

function ThreadView({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const [detail, setDetail] = useState<Conversation | null>(conversation);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [nonce, setNonce] = useState(0);
  const list = useRef<FlatList<ChatMessage>>(null);

  // Same shape as the inbox effect: the read starts here, but state is written only from the promise
  // callbacks. Sending a message bumps `nonce` so the thread reloads from the server.
  useEffect(() => {
    let alive = true;
    nexusApi<ConversationThread>(`/api/chat/conversations/${conversation.id}/messages`)
      .then((thread) => { if (alive) { setDetail(thread.conversation ?? conversation); setMessages(thread.messages ?? []); setError(''); } })
      .catch((cause) => { if (alive) setError(describe(cause)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [conversation, nonce]);

  const reload = () => { setError(''); setLoading(true); setNonce((value) => value + 1); };

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setNotice('');
    try {
      await nexusApi<{ ok: true; message?: ChatMessage }>(`/api/chat/conversations/${conversation.id}/messages`, {
        method: 'POST', body: JSON.stringify({ body, kind: 'text', client_nonce: messageNonce() }),
      });
      setDraft('');
      setNonce((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof NexusApiError ? cause.message : describe(cause));
    } finally {
      setSending(false);
    }
  }, [conversation, draft]);

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la conversații" onPress={onBack} style={styles.back}>
      <Text style={styles.backText}>‹ Conversații</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.threadHead}>
        {back}
        <Text style={styles.threadTitle} numberOfLines={1}>{titleFor(detail ?? conversation)}</Text>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={socialTokens.colors.white} /></View> : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={reload} style={styles.retry}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={list}
          data={messages ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.threadList}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.empty}>Niciun mesaj în acest fir.</Text>}
          renderItem={({ item }) => <MessageBubble message={item} />}
        />
      )}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Scrie un mesaj"
          placeholderTextColor={socialTokens.colors.muted}
          accessibilityLabel="Scrie un mesaj"
          style={styles.composerInput}
          multiline
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Trimite mesajul" disabled={sending || !draft.trim()} onPress={() => void send()} style={[styles.send, (sending || !draft.trim()) && styles.sendOff]}>
          <Text style={styles.sendText}>Trimite</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.sender_persona === 'social' && message.kind !== 'system';
  const body = message.body || (message.attachment_url ? 'Atașament' : '');
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {!mine ? <Text style={styles.bubbleFrom}>{message.sender_display_name || message.sender_handle || 'Nexus'}</Text> : null}
      <Text style={styles.bubbleText}>{body}</Text>
      <Text style={styles.bubbleTime}>{relativeTime(message.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  errorText: { color: socialTokens.colors.text, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14 },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
  list: { paddingVertical: 8 },
  empty: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center', paddingTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111820', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: socialTokens.colors.muted, fontSize: 12, marginTop: 3 },
  rowAside: { alignItems: 'flex-end', gap: 4 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#ff315f', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  time: { color: socialTokens.colors.muted, fontSize: 11 },
  back: { minHeight: 40, justifyContent: 'center', paddingRight: 12 },
  backText: { color: socialTokens.colors.white, fontSize: 14, fontWeight: '700' },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  threadTitle: { flex: 1, color: socialTokens.colors.text, fontSize: 15, fontWeight: '800' },
  threadList: { padding: 12, gap: 8 },
  notice: { color: '#ffc6c6', fontSize: 12, paddingHorizontal: 14, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  composerInput: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 16, color: socialTokens.colors.text, backgroundColor: '#101a22', borderWidth: 1, borderColor: socialTokens.colors.markBorder, fontSize: 14 },
  send: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', backgroundColor: '#ffffff' },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#050608', fontWeight: '800', fontSize: 13 },
  bubble: { maxWidth: '82%', gap: 3, padding: 10, borderRadius: 16, borderWidth: 1 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#12303f', borderColor: '#1d4b60' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#101a22', borderColor: socialTokens.colors.postBorder },
  bubbleFrom: { color: socialTokens.colors.muted, fontSize: 11, fontWeight: '700' },
  bubbleText: { color: socialTokens.colors.text, fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: socialTokens.colors.muted, fontSize: 10 },
});


