import { router } from 'expo-router';
import { JungleBackdrop } from '../components/JungleBackdrop';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { ActivityCenter } from '../components/ActivityCenter';
import { ContactCard } from '../components/ContactCard';
import { InboxModulePlate, InboxToolsPlate } from '../components/InboxPlates';
import { MessengerSearch, MessengerTopbar } from '../components/MessengerTopbar';
import { NewConversationSheet } from '../components/NewConversationSheet';
import { RemoteImageSource } from '../components/PostMedia';
import { StoryRail } from '../components/StoryRail';
import { StoryViewer } from '../components/StoryViewer';
import { fetchStories } from '../lib/stories';
import {
  createMessageSearch, matchesConversation, SEARCH_MIN_LENGTH,
  type InboxBox, type InboxFilter, type MessageHit, type MessageSearchResult,
} from '../lib/messageSearch';
import {
  initialsFor, mediaSourceForPath, relativeTime,
  type ChatMessage, type Conversation, type ConversationParticipant, type ConversationThread, type ConversationsPage, type StoryView,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { openSocialProfile } from '../lib/profileNavigation';


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

/**
 * `messenger.loadedOnly` and `messages.noSearchResults` (`interface-locale.js:15,280`) — the two
 * sentences `.inboxFilterStatus` prints (`messenger-shell.js:80`).
 */
const LOADED_ONLY = 'Filtru pentru conversațiile încărcate';
const NO_SEARCH_RESULTS = 'Niciun mesaj găsit';

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
export function MessagesScreen({ owner, onHome, activePersona = 'social', initialBox, onSelectModule }: {
  /** The reader's own record for the shelf's first card (`activePersonaRecord()` of the web). Its `id`
   * is what tells the reader apart from the other ends of a conversation, the way `state.user.id` does. */
  owner: { id?: number; display_name?: string | null; handle?: string; avatar?: string | null };
  /** `#inbox-home` is the way home (`app.js:7752`) - the same door as `goHome()` of the shell. */
  onHome: () => void;
  /** `state.persona` — the profile the activity box reads its preferences for (`app.js:7882`). */
  activePersona?: string;
  /**
   * The box to open on. The drawer's bell asks for `activity` (`MIGRATION.md` §22); the inbox marks ask
   * for nothing and keep the conversations. A box chosen here stays chosen until the shell hands in
   * another one, so pressing a chip inside this screen is never undone by the prop it arrived with.
   */
  initialBox?: InboxBox;
  /** `[data-inbox-persona]` (`app.js:7809`) — the module plate switches the active profile of the account. */
  onSelectModule?: (persona: string) => void;
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
  /** Whose shelf this is (`StoriesAnswer.viewerId`): the story viewer needs it to stop drawing a self chip. */
  const [storiesViewerId, setStoriesViewerId] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  /** `inboxBox` / `inboxFilter` of `app.js:196`+`:63` — the two decisions the plates own. */
  const [box, setBox] = useState<InboxBox>(initialBox ?? 'inbox');
  const [filter, setFilter] = useState<InboxFilter>('all');
  /** The row whose avatar was pressed: `#messengerContact` (`messenger-contact.js:82`). */
  const [contactFor, setContactFor] = useState<Conversation | null>(null);
  /** `#inbox-message-results` (`messenger-search.js:58`) — the two server searches of the field. */
  const [conversationSearch, setConversationSearch] = useState<{ key: string; result: MessageSearchResult & { conversations?: Conversation[] } } | null>(null);
  const [messageSearch, setMessageSearch] = useState<{ key: string; result: MessageSearchResult } | null>(null);
  const searchTicket = useRef(0);


  /** `inboxFilter` (`app.js:196`, `:7801`): it starts as the active profile and is reset with the context. */
  const [moduleSelection, setModuleSelection] = useState({ persona: activePersona, choice: activePersona });
  const moduleChoice = moduleSelection.persona === activePersona ? moduleSelection.choice : activePersona;
  /**
   * React's own "adjusting state when a prop changes" (`react.dev/learn/you-might-not-need-an-effect`):
   * a shell that hands in another box (the drawer's bell) opens that box, and a chip pressed inside this
   * screen is not undone by the box the screen arrived with — only a new request from outside moves it.
   */
  const [openedBox, setOpenedBox] = useState<InboxBox>(initialBox ?? 'inbox');
  if (initialBox && initialBox !== openedBox) {
    setOpenedBox(initialBox);
    setBox(initialBox);
    setFilter('all');
    setQuery('');
  }
  const searchKey = JSON.stringify([query.trim(), box, moduleChoice, activePersona, owner.id]);
  const conversationHits = conversationSearch?.key === searchKey ? conversationSearch.result : { state: 'idle' as const, messages: [] };
  const messageHits = messageSearch?.key === searchKey ? messageSearch.result : { state: 'idle' as const, messages: [] };

  /**
   * The unseen shelf. A refused read (another persona, a viewer the answer does not belong to) leaves
   * the tray empty instead of showing a stale one - the web empties the container the same way
   * (`loadStories`, app.js:3306). A story whose progress the server accepted is dropped from the shelf,
   * which is how the web's rail loses a card it has just shown.
   */
  const loadStories = useCallback(() => {
    fetchStories()
      .then((answer) => { setStories(answer.stories); setStoriesViewerId(answer.viewerId); })
      .catch(() => setStories([]));
  }, []);

  useEffect(() => { loadStories(); }, [loadStories]);


  // The read starts in the effect, but every setState runs inside a promise callback, so nothing is
  // written to state synchronously while React runs the effect (the pattern the profile uses). Retry,
  // refresh and coming back from a thread bump `nonce` to run the same read again, and the box the tools
  // plate chose is part of the address the way `app.js:7828` makes it part of the web's own call. The
  // activity box is not a conversation list at all (`app.js:7824-7827`), so it asks for nothing here.
  useEffect(() => {
    if (box === 'activity') return;
    let alive = true;
    nexusApi<ConversationsPage>(`/api/chat/conversations?persona=${encodeURIComponent(moduleChoice)}&box=${box}&limit=30`)
      .then((page) => { if (alive) { setConversations(page.conversations ?? []); setError(''); } })
      .catch((cause) => { if (alive) setError(describe(cause)); })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [box, moduleChoice, nonce]);

  const reload = () => { setError(''); setLoading(true); setNonce((value) => value + 1); };
  const refresh = () => { setRefreshing(true); setNonce((value) => value + 1); loadStories(); };

  /**
   * The rows the plate filters and the field keep, in the order the server sent them: the same
   * `matchesConversation` the web runs over its printed rows (`messenger-shell.js:55-57,76-78`), with the
   * row text this screen prints plus the peer's handle, which is what the web hands in as `dataset.handle`.
   */
  const visible = useMemo(
    () => (conversations ?? []).filter((conversation) => matchesConversation({
      text: [
        titleFor(conversation, owner.id),
        subtitleFor(conversation, owner.id),
        clockOf(conversation),
        Math.max(0, Number(conversation.unread) || 0) || '',
        othersOf(conversation, owner.id)[0]?.handle ?? '',
      ].join(' '),
      unread: conversation.unread,
      kind: conversation.kind,
    }, query, filter)),
    [conversations, filter, owner.id, query],
  );

  /**
   * `#inbox-message-results` (`messenger-search.js:97-106`): from two characters on, the field stops
   * filtering the loaded rows and asks the server, the conversation list hides behind the results, and
   * both answers are debounced by the same 300ms. A shorter field resets both searches, which is what
   * `search.reset('')` does there.
   */
  useEffect(() => {
    const trimmed = query.trim();
    const ticket = ++searchTicket.current;
    if (trimmed.length < SEARCH_MIN_LENGTH || box === 'activity') return;
    const timer = setTimeout(() => {
      if (ticket !== searchTicket.current) return;
      const context = { persona: moduleChoice, viewerId: Number(owner.id), viewerPersona: activePersona, box };
      const conversationsSearch = createMessageSearch({
        kind: 'conversations',
        context,
        current: () => ticket === searchTicket.current,
        render: (result) => setConversationSearch({ key: searchKey, result }),
        validateConversation: (row) => Number.isSafeInteger(Number(row?.id)) && Number(row.id) > 0,
      });
      const messageSearch = createMessageSearch({
        kind: 'messages',
        context,
        current: () => ticket === searchTicket.current,
        render: (result) => setMessageSearch({ key: searchKey, result }),
      });
      void conversationsSearch.load();
      void messageSearch.load();
    }, 300);
    return () => clearTimeout(timer);
  }, [activePersona, box, moduleChoice, owner.id, query, searchKey]);

  /** `query.trim().length >= 2` (`messenger-search.js:102`) — the results replace the list from there. */
  const serverSearching = query.trim().length >= SEARCH_MIN_LENGTH;

  /**
   * `.inboxFilterStatus` (`messenger-shell.js:79-80`): hidden from two characters on, and hidden when
   * there is neither a query nor a filter - so it speaks whenever a filter is on, even with an empty field.
   */
  const filterNote = query.trim().length < SEARCH_MIN_LENGTH && (query.length > 0 || filter !== 'all')
    ? (visible.length ? LOADED_ONLY : `${NO_SEARCH_RESULTS} · ${LOADED_ONLY}`)
    : '';


  if (open) return <ThreadView conversation={open} viewerId={owner.id} onBack={() => { setOpen(null); refresh(); }} />;

  /** The two plates fill the middle columns of the topbar grid (`messenger-shell.js:34-43`). */
  const plates = (
    <View style={styles.plates}>
      <InboxModulePlate
        module={moduleChoice}
        onSelect={(id) => { setModuleSelection({ persona: activePersona, choice: id }); if (id !== 'all') onSelectModule?.(id); }}
      />
      <InboxToolsPlate
        box={box}
        filter={filter}
        onBox={(next) => { setBox(next); setFilter('all'); setQuery(''); }}
        /** `messenger-shell.js:95` — choosing a filter empties the field before it filters. */
        onFilter={(next) => { setFilter(next); setQuery(''); }}
      />
    </View>
  );
  const topbar = (
    <MessengerTopbar
      onHome={onHome}
      onNewConversation={() => { Keyboard.dismiss(); setCreating(true); }}
      middle={plates}
    />
  );
  /** `inboxReturn` (`messenger-shell.js:47`) — the way back from a box that is not the inbox. */
  const inboxReturn = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Conversații"
      onPress={() => { setBox('inbox'); setFilter('all'); setQuery(''); }}
      style={styles.inboxReturn}
    >
      <Text style={styles.inboxReturnText}>‹ Conversații</Text>
    </Pressable>
  );

  /**
   * The activity box is not the conversation list: the search form is hidden (`messenger-shell.js:105`)
   * and what it reads is the notification centre (`app.js:7824-7827`).
   */
  if (box === 'activity') {
    return (
      <View style={styles.screen}>
        <View style={styles.activityWrapper}>
          {topbar}
          {inboxReturn}
          <ActivityCenter filter={moduleChoice} activePersona={activePersona} viewerId={Number(owner.id)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <JungleBackdrop opacity={0.06} />
      <FlatList
        /** `#conversation-list` is hidden from two characters on (`messenger-search.js:103`). */
        data={serverSearching ? [] : visible}
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
            {topbar}
            <MessengerSearch value={query} onChangeText={setQuery} onSubmit={() => Keyboard.dismiss()} />
            {box === 'inbox' ? (
              <StoryRail
                stories={stories}
                owner={owner}
                onAddStory={() => router.push('/camera')}
                onOpenStory={(index) => setViewerIndex(index)}
              />
            ) : inboxReturn}
            {filterNote ? (
              <Text accessibilityLiveRegion="polite" style={styles.filterNote}>{filterNote}</Text>
            ) : null}
            {serverSearching ? (
              <SearchResults
                conversationsResult={conversationHits}
                messagesResult={messageHits}
                onOpenConversation={(row) => setOpen(row)}
                onOpenMessage={(hit) => {
                  const known = (conversations ?? []).find((row) => row.id === hit.conversation_id);
                  setOpen(known ?? { id: hit.conversation_id, kind: 'direct' });
                }}
                onContact={(row) => setContactFor(row)}
              />
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
            <Text style={styles.emptyDetail}>Pornește una folosind username-ul Jungle Book, nu un ID numeric.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            viewerId={owner.id}
            onOpen={() => setOpen(item)}
            onContact={() => setContactFor(item)}
          />
        )}
      />

      {contactFor ? (
        <ContactCard
          conversation={contactFor}
          viewerId={owner.id}
          onClose={() => setContactFor(null)}
          onOpenThread={() => { const row = contactFor; setContactFor(null); setOpen(row); }}
        />
      ) : null}

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
          viewerId={storiesViewerId}
          onClose={() => { setViewerIndex(null); loadStories(); }}
        />
      ) : null}
    </View>
  );
}

/**
 * One row, at the measurements of `.messengerScreen .conversationRow` (`messenger-spaces.css:15-25`):
 * a 52px round avatar, the name over its 16px preview, then the clock over the unread count. The row has
 * the web's own two tap targets (`messenger-shell.js:24`): the avatar is `button.contactAvatar` and opens
 * `#messengerContact`, and the rest is `button.conversationOpen` and opens the thread.
 */
function ConversationRow({ conversation, viewerId, onOpen, onContact }: {
  conversation: Conversation;
  viewerId?: number;
  onOpen: () => void;
  onContact: () => void;
}) {
  const peer = othersOf(conversation, viewerId)[0] ?? (conversation.participants ?? [])[0];
  const avatar = mediaSourceForPath(peer?.avatar);
  const title = titleFor(conversation, viewerId);
  const unread = Math.max(0, Number(conversation.unread) || 0);
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${peer?.handle || title}`} onPress={() => openSocialProfile(peer?.handle)} style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(title, peer?.handle)}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Deschide conversația cu ${title}`} onPress={onOpen} style={styles.rowOpen}>
        <View style={styles.rowText}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${peer?.handle || title}`} onPress={(event) => { event.stopPropagation(); openSocialProfile(peer?.handle); }}><Text style={styles.name} numberOfLines={1}>{title}</Text></Pressable>
          <Text style={styles.meta} numberOfLines={1}>{subtitleFor(conversation, viewerId)}</Text>
        </View>
        <View style={styles.rowAside}>
          <Text style={styles.time}>{clockOf(conversation)}</Text>
          {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View> : null}
        </View>
      </Pressable>
    </View>
  );
}

/**
 * `#inbox-message-results` (`messenger-search.js:56-106`): the conversation hits first, then the message
 * hits, then the footer. Each state prints what the module prints - `messages.searching` while an answer
 * is on its way, `messages.searchError` with the retry when an envelope failed, `messages.noSearchResults`
 * when nothing came back, and `messages.loadMore` while the server kept a cursor.
 */
function SearchResults({ conversationsResult, messagesResult, onOpenConversation, onOpenMessage, onContact }: {
  conversationsResult: MessageSearchResult & { conversations?: Conversation[] };
  messagesResult: MessageSearchResult;
  onOpenConversation: (row: Conversation) => void;
  onOpenMessage: (hit: MessageHit) => void;
  onContact: (row: Conversation) => void;
}) {
  const state = messagesResult.state === 'idle' ? conversationsResult.state : messagesResult.state;
  const retry = messagesResult.retry ?? conversationsResult.retry;
  const more = messagesResult.more ?? conversationsResult.more;
  const conversations = conversationsResult.conversations ?? [];
  const messages = messagesResult.messages ?? [];
  const searching = state === 'waiting' || state === 'loading';
  return (
    <View style={styles.searchResults}>
      {searching ? <Text style={styles.searchHint}>Caut…</Text> : null}
      {state === 'error' ? (
        <View style={styles.searchErrorBox}>
          <Text style={styles.searchHint}>Căutarea nu a putut fi verificată</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={() => retry?.()} style={styles.searchMore}>
            <Text style={styles.searchMoreText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}
      {conversations.map((row) => (
        <ConversationRow
          key={`c-${row.id}`}
          conversation={row}
          onOpen={() => onOpenConversation(row)}
          onContact={() => onContact(row)}
        />
      ))}
      {messages.map((hit) => (
        <Pressable
          key={`m-${hit.id}`}
          accessibilityRole="button"
          accessibilityLabel={`@${hit.sender_handle}`}
          onPress={() => onOpenMessage(hit)}
          style={styles.searchRow}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${hit.sender_handle}`} onPress={(event) => { event.stopPropagation(); openSocialProfile(hit.sender_handle); }}><Text style={styles.searchHandle}>@{hit.sender_handle}</Text></Pressable>
          <Text style={styles.searchBody} numberOfLines={2}>{hit.body}</Text>
        </Pressable>
      ))}
      {state === 'ready' && !conversations.length && !messages.length ? (
        <Text style={styles.searchHint}>Niciun mesaj găsit</Text>
      ) : null}
      {state === 'ready' && more ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Mai multe conversații" onPress={() => more()} style={styles.searchMore}>
          <Text style={styles.searchMoreText}>Mai multe conversații</Text>
        </Pressable>
      ) : null}
    </View>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Profilul persoanei din conversație" onPress={() => openSocialProfile(othersOf(detail ?? conversation, viewerId)[0]?.handle)} style={styles.threadTitle}><Text style={styles.threadTitleText} numberOfLines={1}>{titleFor(detail ?? conversation, viewerId)}</Text></Pressable>
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
      {!mine ? <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${message.sender_handle || ''}`} onPress={() => openSocialProfile(message.sender_handle)}><Text style={styles.bubbleFrom}>{message.sender_display_name || message.sender_handle || 'Jungle Book'}</Text></Pressable> : null}
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
  /** `.conversationOpen{display:flex;align-items:center;gap:10px;flex:1;min-width:0}` (`messenger-shell.js:24`). */
  rowOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** The two plates of the topbar fill the middle columns of the grid (`messenger-spaces.css:3`). */
  plates: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 6 },
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
  /** `.messengerScreen #inbox-message-results{font-size:14px;color:#afc2cf}` (`messenger-spaces.css:30`). */
  searchResults: { gap: 6, paddingBottom: 8 },
  /** `#inbox-message-results button{min-height:44px}` — the hint and the two footer buttons. */
  searchHint: { color: '#afc2cf', fontSize: 14, paddingVertical: 10 },
  searchErrorBox: { gap: 6, paddingBottom: 6 },
  /** One message hit (`messenger-search.js:91`): the handle over the body, one 44px button. */
  searchRow: { minHeight: 44, gap: 3, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#233240' },
  searchHandle: { color: '#dce7e9', fontSize: 14, fontWeight: '700' },
  searchBody: { color: '#afc2cf', fontSize: 14 },
  searchMore: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, alignSelf: 'flex-start' },
  searchMoreText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  /** `inboxReturn` (`messenger-shell.js:47`) — the way back from a box that is not the inbox. */
  inboxReturn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 14, backgroundColor: '#050608' },
  inboxReturnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  /** The activity box keeps the inbox's own inset, and its scroll fills what is left. */
  activityWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  back: { minHeight: 40, justifyContent: 'center', paddingRight: 12 },
  backText: { color: socialTokens.colors.white, fontSize: 14, fontWeight: '700' },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  threadTitle: { flex: 1 },
  threadTitleText: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '800' },
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


