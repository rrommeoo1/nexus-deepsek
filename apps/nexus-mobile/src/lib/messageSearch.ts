import { nexusApi } from './nexusApi';
import type { Conversation } from './socialTypes';

/**
 * The two searches of the inbox, ported from the module the phone browser loads
 * (`apps/nexus-web/public/messenger-search.js`) and from the filter predicate beside the shell
 * (`messenger-shell.js:55-57`):
 *
 *   messenger-search.js:3-8     `validSearchEnvelope` — the privacy envelope every answer must carry
 *                               before a single row is drawn: `ok`, `privacy_enforced_server_side`,
 *                               the viewer the answer belongs to, and the query it answers.
 *   messenger-search.js:11-19   `validSearchPage` — the extra contract of a message page: the server
 *                               says it cannot search encrypted text, and every row is a real message.
 *   messenger-search.js:21-53   `createMessageSearch` — one generation per reset, one cursor per page,
 *                               and a refusal (error state) instead of a duplicate row.
 *   messenger-search.js:35      the routes: `/api/chat/search` and, for conversations,
 *                               `/api/chat/conversations?...&box=…`.
 *   messenger-shell.js:55-57    `matchesConversation` — the loaded-row filter: an `unread` filter keeps
 *                               what has an unread count, a `group` filter keeps groups, and the text is
 *                               compared folded (NFKD, then the combining marks away).
 *
 * Nothing here decrypts anything: an E2EE body is never searchable server-side and the server says so
 * in the envelope (`encrypted_content_searchable_server_side === false`).
 */

/** `limit: '20'` of `messenger-search.js:32` — the page size of both searches. */
export const SEARCH_LIMIT = 20;
/** `query.length < 2 ? 'idle' : 'waiting'` (`messenger-search.js:25`) — the field is only a search at 2. */
export const SEARCH_MIN_LENGTH = 2;

/** The four boxes the inbox draws (`data-inbox-box` of `messenger-shell.js:40-41`, plus the list). */
export type InboxBox = 'inbox' | 'requests' | 'sent' | 'activity';
/** The three loaded-row filters of `[data-inbox-view]` (`messenger-shell.js:37-39`). */
export type InboxFilter = 'all' | 'unread' | 'group';

export type SearchContext = {
  persona: string;
  viewerId: number;
  viewerPersona: string;
  box?: string;
};

export type SearchState = 'idle' | 'waiting' | 'loading' | 'ready' | 'error';

/** One row of `#inbox-message-results` (`messenger-search.js:91`) — a real, plaintext message. */
export type MessageHit = {
  id: number;
  conversation_id: number;
  body: string;
  sender_handle: string;
  sender_persona?: string;
};

export type MessageSearchResult = {
  state: SearchState;
  messages: MessageHit[];
  /** The door to the next page, present only while the server returned a cursor. */
  more?: (() => void) | null;
  /** The way back from an answer that failed its own envelope. */
  retry?: () => void;
};

/** `messenger-shell.js:57` — both sides lose their accents before they are compared. */
export function foldText(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

/**
 * `matchesConversation` (`messenger-shell.js:55-57`), decision for decision: a row survives an `unread`
 * filter only with a real count, a `group` filter only as a group, and every filter still needs the
 * folded text to be inside the folded row text the caller hands in (the printed row plus its handle).
 */
export function matchesConversation(
  row: { text?: string; unread?: number | string | null; kind?: string | null },
  query: string,
  filter: InboxFilter,
): boolean {
  if (filter === 'unread' && !(Number(row.unread) > 0)) return false;
  if (filter === 'group' && row.kind !== 'group') return false;
  return foldText(row.text).includes(foldText(query).trim());
}


/** `messenger-search.js:3-8` — the envelope that has to hold before any row is trusted. */
export function validSearchEnvelope(
  result: (Record<string, any> & { query?: Record<string, any>; next_cursor?: unknown }) | null,
  context: SearchContext & { query: string; cursor: string | null },
): boolean {
  if (!result || result.ok !== true || result.privacy_enforced_server_side !== true) return false;
  if (Number(result.viewer_id) !== Number(context.viewerId)) return false;
  if (result.viewer_persona !== context.viewerPersona) return false;
  if (result.query?.text !== context.query) return false;
  if (result.query?.persona !== context.persona) return false;
  if (result.query?.limit !== SEARCH_LIMIT) return false;
  if (result.query?.cursor !== context.cursor) return false;
  const next = result.next_cursor;
  return next == null || (typeof next === 'string' && next.length <= 2048 && next.includes('.'));
}

/** `messenger-search.js:11-19` — the message page contract, one condition per field. */
export function validSearchPage(
  result: (Record<string, any> & { messages?: unknown }) | null,
  context: SearchContext & { query: string; cursor: string | null },
): boolean {
  if (!validSearchEnvelope(result, context)) return false;
  if (result?.encrypted_content_searchable_server_side !== false) return false;
  const messages = result?.messages;
  if (!Array.isArray(messages) || messages.length > SEARCH_LIMIT) return false;
  if (new Set(messages.map((row: any) => row?.id)).size !== messages.length) return false;
  return messages.every((row: any) => Number.isSafeInteger(row?.id) && row.id > 0
    && Number.isSafeInteger(row?.conversation_id) && row.conversation_id > 0
    && typeof row.body === 'string' && row.body.length <= 4000
    && typeof row.sender_handle === 'string' && /^[a-z0-9_]{2,30}$/.test(row.sender_handle));
}

/**
 * `createMessageSearch` (`messenger-search.js:21-53`) with the two rules kept verbatim: `reset`
 * invalidates whatever was in flight, and a page that repeats a row or answers with the cursor it was
 * asked for is refused as an error instead of being appended.
 */
export function createMessageSearch({ kind, context, current, render, validateConversation }: {
  kind: 'messages' | 'conversations';
  context: SearchContext;
  current: () => boolean;
  render: (result: MessageSearchResult & { conversations?: Conversation[] }) => void;
  validateConversation?: (conversation: Conversation) => boolean;
}) {
  let generation = 0;
  let query = '';
  let cursor: string | null = null;
  let rows: any[] = [];
  let busy = false;

  const reset = (text = '') => {
    generation += 1;
    query = String(text).trim().slice(0, 80);
    cursor = null;
    rows = [];
    busy = false;
    render({ state: query.length < SEARCH_MIN_LENGTH ? 'idle' : 'waiting', messages: [] });
  };

  const load = async (more = false) => {
    if (busy || query.length < SEARCH_MIN_LENGTH || !current() || (more && !cursor)) return;
    busy = true;
    const token = ++generation;
    const selected = query;
    const selectedCursor = more ? cursor : null;
    render({ state: 'loading', messages: rows as MessageHit[] });
    const params = new URLSearchParams({ persona: context.persona, q: selected, limit: String(SEARCH_LIMIT) });
    if (kind === 'conversations') params.set('box', context.box || 'inbox');
    if (selectedCursor) params.set('cursor', selectedCursor);
    const result = await nexusApi<Record<string, any>>(
      (kind === 'conversations' ? '/api/chat/conversations?' : '/api/chat/search?') + params.toString(),
    ).catch(() => null);
    if (token !== generation || !current()) return;
    busy = false;
    const expected = { ...context, query: selected, cursor: selectedCursor };
    const prior = new Set(more ? rows.map((row) => row.id) : []);
    const fail = () => render({ state: 'error', messages: [], retry: () => { void load(more); } });
    if (kind === 'conversations') {
      const items = result?.conversations as Conversation[] | undefined;
      const valid = validSearchEnvelope(result, expected)
        && result?.query?.box === (context.box || 'inbox')
        && Array.isArray(items) && items.length <= SEARCH_LIMIT
        && new Set(items!.map((row) => row?.id)).size === items!.length
        && items!.every((row) => (validateConversation ? validateConversation(row) : true));
      if (!valid || (items ?? []).some((row) => prior.has(row?.id))
        || (selectedCursor != null && result?.next_cursor === selectedCursor)) { fail(); return; }
      rows = more ? [...rows, ...(items ?? [])] : (items ?? []);
      cursor = (result?.next_cursor as string | null) ?? null;
      render({ state: 'ready', messages: [], conversations: rows as Conversation[], more: cursor ? () => { void load(true); } : null });
      return;
    }
    if (!validSearchPage(result, expected) || result!.messages.some((row: MessageHit) => prior.has(row.id))
      || (selectedCursor != null && result!.next_cursor === selectedCursor)) { fail(); return; }
    rows = more ? [...rows, ...result!.messages] : result!.messages;
    cursor = result!.next_cursor as string | null;
    render({ state: 'ready', messages: rows as MessageHit[], more: cursor ? () => { void load(true); } : null });
  };

  return { reset, load };
}