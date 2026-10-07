import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { MessengerSearch, MessengerTopbar } from '../components/MessengerTopbar';
import { NewConversationSheet } from '../components/NewConversationSheet';
import { RemoteImageSource } from '../components/PostMedia';
import { StoryRail } from '../components/StoryRail';
import { StoryViewer } from '../components/StoryViewer';
import { fetchStories } from '../lib/stories';
import {
  initialsFor, mediaSourceForPath, relativeTime,
  type ChatMessage, type Conversation, type ConversationParticipant, type ConversationThread, type ConversationsPage, type StoryView,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';


/** A nonce the server accepts: 8-80 chars of `[a-zA-Z0-9:_-]`, minted per send (replay-safe). */
function messageNonce(): string {
  return `nx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The title of a row, read the way the web reads it (`renderConversationRow`, messenger-shell.js:16):
 * a group prints its own name, everything else prints the first participant that is not the reader.
 */
function titleFor(conversation: Conversation, viewerId?: number): string {
  if (conversation.kind === 'group') return conversation.title || 'Grup';
  const other = othersOf(conversation, viewerId)[0];
  return other?.display_name || other?.handle || 'Conversație';
}

/** `conversation.participants.filter((item) => item.id !== state.user.id)` - the other ends of a row. */
function othersOf(conversation: Conversation, viewerId?: number): ConversationParticipant[] {
  return (conversation.participants ?? []).filter((person) => person.id !== viewerId);
}

/**
 * The second line of a row (`renderConversationRow`, messenger-shell.js:17,24): the reader's own last
 * message is prefixed, an E2EE body is named, an expired one says so, and a conversation with no
 * message yet names its group ends or falls back to `messages.newConversation`. The web cuts the line
 * at 64 characters before printing it, which is kept here.
 */
function subtitleFor(conversation: Conversation, viewerId?: number): string {
  if (conversation.blocked) return 'Conversație blocată de regulile de confidențialitate.';
  const last = conversation.last_message;
  if (!last) {
    return conversation.kind === 'group'
      ? othersOf(conversation, viewerId).map((person) => `@${person.handle}`).join(', ')
      : 'Conversație nouă';
  }
  if (last.status === 'expired') return 'Mesaj expirat';
  const mine = Number(last.sender_id) === Number(viewerId);
  const body = String(last.encryption_mode || '').startsWith('e2ee_') ? '🔒 Mesaj criptat' : String(last.body || '');
  return ((mine ? 'Tu: ' : '') + body).slice(0, 64);
}

/** `<em><small>` - the clock of the last message, `HH:MM` (`messenger-shell.js:24`). */
function clockOf(conversation: Conversation): string {
  const raw = conversation.last_message?.created_at;
  const seconds = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const date = new Date(seconds * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * The server stamps chat rows in epoch seconds (`unixepoch()`, the `message_items` schema) and the web
 * lifts every stamp by 1000 before printing it (`messenger-shell.js:24`). The shared `relativeTime`
 * counts milliseconds, so a server stamp is lifted here too - without that every date reads 1970.
 */
function millisOf(value?: number | string | null): number {
  return typeof value === 'number' ? value * 1000 : Date.parse(String(value ?? ''));
}

/** `messenger-shell.js:55-57` folds the accents away before comparing: NFKD, then the combining marks. */
function fold(value: string): string {
  /**
   * `\p{M}` of the web, written as the mark block it resolves to, so the same fold runs on the older
   * JS engine on device: ă/â/î → breve/circumflex, ș/ț → comma-below/cedilla, all inside U+0300-U+036F.
   */
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * The quick search of the web (`matchesConversation`, messenger-shell.js:55-57): both sides lose their
 * accents, then the text of the printed row plus its handle is searched for what was typed. Nothing
 * leaves the device and the server is never asked; an empty field keeps every row.
 */
function matchesQuery(conversation: Conversation, viewerId: number | undefined, query: string): boolean {
  const needle = fold(query).trim();
  if (!needle) return true;
  const unread = Math.max(0, Number(conversation.unread) || 0);
  /** `row.textContent + ' ' + row.dataset.handle` (`messenger-shell.js:77`) - what the row prints. */
  const haystack = [
    titleFor(conversation, viewerId),
    subtitleFor(conversation, viewerId),
    clockOf(conversation),
    /** The web prints the count only when there is one (`unread ? '<strong>' + unread : ''`). */
    unread ? String(unread) : '',
    othersOf(conversation, viewerId)[0]?.handle ?? '',
  ].join(' ');
  return fold(haystack).includes(needle);
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

/**
 * The unified inbox and one real thread behind it. The list is `GET /api/chat/conversations`
 * (persona `all`, box `inbox`) and the thread is `GET /api/chat/conversations/:id/messages`; sending is
 * the server's own plaintext boundary (`POST …/messages` with a per-send nonce). The server decides who
 * may read or reply - a thread whose profile is not the active one answers 409 and the screen prints
 * that sentence instead of a fake composer.
 *
 * The three children the web prints above the list inside this same scroller - `.messengerTopbar`
 * (measured 437x66 at y=16), `#message-search` (437x46 at y=82) and `#storyRail` (437x160 at y=134,
 * `docs/web-ref/messages/inbox-0.dom.json`) - are the list header here, so all of them scroll away with
 * the conversations exactly like the web's single scroller. The rail's own card is the camera door
 * (`app.js:3324 openComposer("story")`) and every other card opens the full-screen reader.
 */
export function MessagesScreen({ owner, onHome }: {
  /** The reader's own record for the shelf's first card (`activePersonaRecord()` of the web). Its `id`
   * is what tells the reader apart from the other ends of a conversation, the way `state.user.id` does. */
  owner: { id?: number; display_name?: string | null; handle?: string; avatar?: string | null };
  /** `#inbox-home` is the way home (`app.js:7752`) - the same door as `goHome()` of the shell. */
  onHome: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [open, setOpen] = useState<Conversation | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [stories, setStories] = useState<StoryView[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  /**
   * The unseen shelf. A refused read (another persona, a viewer the answer does not belong to) leaves
   * the tray empty instead of showing a stale one - the web empties the container the same way
   * (`loadStories`, app.js:3306). A story whose progress the server accepted is dropped from the shelf,
   * which is how the web's rail loses a card it has just shown.
   */
  const loadStories = useCallback(() => {
    fetchStories()
      .then((answer) => setStories(answer.stories))
      .catch(() => setStories([]));
  }, []);

  useEffect(() => { loadStories(); }, [loadStories]);


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
  const refresh = () => { setRefreshing(true); setNonce((value) => value + 1); loadStories(); };

  /** The rows the quick search keeps, in the order the server sent them. */
  const visible = useMemo(
    () => (conversations ?? []).filter((conversation) => matchesQuery(conversation, owner.id, query)),
    [conversations, owner.id, query],
  );
  /**
   * `.inboxFilterStatus` (`p2-messaging.css`, `font-size:13px;color:#acbeca`): the web hides it as soon as
   * the field holds two characters (`status.hidden = search.value.trim().length >= 2`, and it stays hidden
   * while the field is empty because there is no box to name either), so it shows while a query is there
   * but still shorter than two characters. It either names the survivors or says nothing was found
   * (`messenger-shell.js:79-80`): `messenger.loadedOnly` alone, or `messages.noSearchResults` before it.
   */
  const filterNote = query.length > 0 && query.trim().length < 2
    ? (visible.length ? 'Filtru pentru conversațiile încărcate' : 'Niciun mesaj găsit · Filtru pentru conversațiile încărcate')
    : '';

  if (open) return <ThreadView conversation={open} viewerId={owner.id} onBack={() => { setOpen(null); refresh(); }} />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={socialTokens.colors.white} />}
        /**
         * The three children the web prints above the list inside this same scroller
         * (`messenger-shell.js:32-46`): the topbar, the quick search and the shelf. The web paints them
         * while the list still holds only a note, so this header never waits for the read.
         */
        ListHeaderComponent={(
          <>
            <MessengerTopbar
              onHome={onHome}
              onNewConversation={() => { Keyboard.dismiss(); setCreating(true); }}
            />
            <MessengerSearch value={query} onChangeText={setQuery} onSubmit={() => Keyboard.dismiss()} />
            <StoryRail
              stories={stories}
              owner={owner}
              onAddStory={() => router.push('/camera')}
              onOpenStory={(index) => setViewerIndex(index)}
            />
            {filterNote ? (
              <Text accessibilityLiveRegion="polite" style={styles.filterNote}>{filterNote}</Text>
            ) : null}
          </>
        )}
        ListEmptyComponent={loading ? (
          /** `<div class="notificationLoading">${messages.loading}</div>` (`messenger-shell.js:49`). */
          <Text style={styles.loadingNote}>Încarc inboxul în siguranță…</Text>
        ) : error ? (
          /** `.emptyInbox.inboxError` (`app.js:7839`): `messages.loadError`, its detail, `live.retry`. */
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Inboxul nu poate fi încărcat</Text>
            <Text style={styles.emptyDetail}>{error}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={reload} style={styles.retry}>
              <Text style={styles.retryText}>Reîncearcă</Text>
            </Pressable>
          </View>
        ) : (
          /** `.emptyInbox` (`app.js:7844`): `messages.noConversations` over `messages.startByUsername`. */
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nicio conversație aici</Text>
            <Text style={styles.emptyDetail}>Pornește una folosind username-ul Nexus, nu un ID numeric.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ConversationRow conversation={item} viewerId={owner.id} onOpen={() => setOpen(item)} />
        )}
      />

      {creating ? (
        <NewConversationSheet
          selfHandle={owner.handle}
          onClose={() => setCreating(false)}
          onCreated={(conversation) => {
            /** `app.js:8001-8005` lands on the new conversation; the row is put back on top of the list. */
            setCreating(false);
            setConversations((current) => [conversation, ...(current ?? []).filter((row) => row.id !== conversation.id)]);
            setOpen(conversation);
          }}
        />
      ) : null}

      {viewerIndex !== null && stories.length ? (
        <StoryViewer
          stories={stories}
          startIndex={viewerIndex}
          onClose={() => { setViewerIndex(null); loadStories(); }}
        />
      ) : null}
    </View>
  );
}

/**
 * One row, at the measurements of `.messengerScreen .conversationRow` (`messenger-spaces.css:15-25`):
 * a 52px round avatar, the name over its 16px preview, then the clock over the unread count. The row is
 * one press target, the way the web's `conversationOpen` button is; the web's own avatar button opens
 * the contact card, which this app does not have, so both ends open the thread.
 */
function ConversationRow({ conversation, viewerId, onOpen }: {
  conversation: Conversation;
  viewerId?: number;
  onOpen: () => void;
}) {
  const peer = othersOf(conversation, viewerId)[0] ?? (conversation.participants ?? [])[0];
  const avatar = mediaSourceForPath(peer?.avatar);
  const title = titleFor(conversation, viewerId);
  const unread = Math.max(0, Number(conversation.unread) || 0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Deschide conversația cu ${title}`} onPress={onOpen} style={styles.row}>
      <View style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(title, peer?.handle)}</Text> : null}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{subtitleFor(conversation, viewerId)}</Text>
      </View>
      <View style={styles.rowAside}>
        <Text style={styles.time}>{clockOf(conversation)}</Text>
        {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View> : null}
      </View>
    </Pressable>
  );
}

function ThreadView({ conversation, viewerId, onBack }: { conversation: Conversation; viewerId?: number; onBack: () => void }) {
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
        <Text style={styles.threadTitle} numberOfLines={1}>{titleFor(detail ?? conversation, viewerId)}</Text>
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
      <Text style={styles.bubbleTime}>{relativeTime(millisOf(message.created_at))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  errorText: { color: socialTokens.colors.text, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14 },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
  /** `.screen{padding:15px 16px}` of the web — the inset the measured topbar/search/rail sit at x=16. */
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },
  empty: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center', paddingTop: 40 },
  /** `.notificationLoading{padding:28px;text-align:center;color:#7be7de}` (`p3-visual-foundation.css`). */
  loadingNote: { padding: 28, textAlign: 'center', color: '#7be7de', fontSize: 14 },
  /** `.inboxScreen .emptyInbox{min-height:110px;padding:14px}` (`social-human-ux.css:210`), centred column. */
  emptyBox: { minHeight: 110, padding: 14, gap: 8, alignItems: 'center', justifyContent: 'center' },
  /** `.emptyInbox b{margin-top:10px;color:#dce7e9;font-size:15px}` (`p2-messaging.css`). */
  emptyTitle: { color: '#dce7e9', fontSize: 15, fontWeight: '700', marginTop: 10 },
  /** `.emptyInbox span{max-width:260px;margin-top:5px;font-size:12px;line-height:1.5;color:#8e9ca5}`. */
  emptyDetail: { color: '#8e9ca5', fontSize: 12, lineHeight: 18, maxWidth: 260, textAlign: 'center', marginTop: 5 },
  /** `.inboxFilterStatus{font-size:13px;color:#acbeca}` (`p2-messaging.css`). */
  filterNote: { color: '#acbeca', fontSize: 13, paddingBottom: 6 },
  /**
   * `.messengerScreen .conversationRow{display:flex;align-items:center;gap:10px;min-height:80px;
   * border-bottom:1px solid #233240}` (`messenger-spaces.css:15`). The hairline is the row's own, so the
   * last row keeps it, the way the web's border-bottom does.
   */
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 80, borderBottomWidth: 1, borderBottomColor: '#233240' },
  /** `.conversationRow .contactAvatar{width:52px;height:52px;border-radius:50%;background:#203c49}` (:18). */
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: '#203c49', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  /** `.contactAvatar i{display:grid;place-items:center}` under `.conversationRow>button{color:#eef6fa}` (:17,19). */
  avatarInitials: { color: '#eef6fa', fontSize: 16, fontWeight: '800' },
  /** `.conversationOpen>span{flex:1;min-width:0;display:grid;gap:5px}` (:22) — the name over its preview. */
  rowText: { flex: 1, minWidth: 0, gap: 5 },
  /** `.conversationOpen b{font-size:17px;line-height:1.4}` (:23). */
  name: { color: '#eef6fa', fontSize: 17, lineHeight: 24, fontWeight: '700' },
  /** `.conversationOpen small{font-size:16px;color:#afc2cf}` with the ellipsis of `white-space:nowrap` (:24). */
  meta: { color: '#afc2cf', fontSize: 16 },
  /** `.conversationOpen em{display:grid;gap:6px;flex:none}` (:25) — the clock over the count. */
  rowAside: { alignItems: 'flex-end', gap: 6 },
  /** `.conversationOpen strong{min-width:24px;padding:3px;border-radius:14px;background:#68ebdf;color:#071a20;
   * font-size:13px;text-align:center}` (:25). The web prints the raw count, so no `99+` here either. */
  badge: { minWidth: 24, padding: 3, borderRadius: 14, backgroundColor: '#68ebdf', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#071a20', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  /** `.conversationOpen em small{font-size:12px}` (:25). */
  time: { color: '#afc2cf', fontSize: 12 },
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


