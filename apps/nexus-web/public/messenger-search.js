// Searches server-searchable messages only; never decrypts or uploads E2EE text.
import { personaBadge } from './messenger-shell.js?v=20260914-lab1';
function validSearchEnvelope(result, { query, persona, viewerId, viewerPersona, cursor }) {
  return result?.ok === true && result.privacy_enforced_server_side === true
    && Number(result.viewer_id) === Number(viewerId) && result.viewer_persona === viewerPersona
    && result.query?.text === query && result.query?.persona === persona
    && result.query?.limit === 20 && result.query?.cursor === cursor
    && (result.next_cursor === null || (typeof result.next_cursor === 'string' && result.next_cursor.length <= 2048 && result.next_cursor.includes('.')));
}

export function validSearchPage(result, context) {
  return validSearchEnvelope(result, context) && result.encrypted_content_searchable_server_side === false
    && Array.isArray(result.messages) && result.messages.length <= 20
    && new Set(result.messages.map((m) => m?.id)).size === result.messages.length
    && result.messages.every((m) => Number.isSafeInteger(m?.id) && m.id > 0
      && Number.isSafeInteger(m.conversation_id) && m.conversation_id > 0
      && typeof m.body === 'string' && m.body.length <= 4000
      && typeof m.sender_handle === 'string' && /^[a-z0-9_]{2,30}$/.test(m.sender_handle));
}

export function createMessageSearch({ request, context, current, render, kind = 'messages', validateConversation }) {
  let generation = 0, query = '', cursor = null, messages = [], busy = false;
  const reset = (text = '') => {
    generation++; query = String(text).trim().slice(0, 80); cursor = null; messages = []; busy = false;
    render({ state: query.length < 2 ? 'idle' : 'waiting', messages: [] });
  };
  const load = async (more = false) => {
    if (busy || query.length < 2 || !current() || (more && !cursor)) return;
    busy = true;
    const token = ++generation, selected = query, selectedCursor = more ? cursor : null;
    render({ state: 'loading', messages });
    const params = new URLSearchParams({ persona: context.persona, q: selected, limit: '20' });
    if (kind === 'conversations') params.set('box', context.box || 'inbox');
    if (selectedCursor) params.set('cursor', selectedCursor);
    const result = await request((kind === 'conversations' ? '/api/chat/conversations?' : '/api/chat/search?') + params).catch(() => null);
    if (token !== generation || !current()) return;
    busy = false;
    const prior = new Set(more ? messages.map((m) => m.id) : []);
    const items = kind === 'conversations' ? result?.conversations : result?.messages;
    const valid = kind === 'conversations'
      ? validSearchEnvelope(result, { ...context, query: selected, cursor: selectedCursor })
        && result.query.box === (context.box || 'inbox') && Array.isArray(items) && items.length <= 20
        && new Set(items.map((c) => c?.id)).size === items.length
        && items.every((c) => validateConversation?.(c, context.viewerId))
      : validSearchPage(result, { ...context, query: selected, cursor: selectedCursor });
    if (!valid || items.some((m) => prior.has(m.id)) || (selectedCursor && result.next_cursor === selectedCursor)) {
      render({ state: 'error', messages: [], retry: () => load(more) }); return;
    }
    messages = more ? [...messages, ...items] : items;
    cursor = result.next_cursor;
    render({ state: 'ready', messages, more: cursor ? () => load(true) : null });
  };
  return { reset, load };
}

export function bindMessageSearch(root, { api, context, current, t, esc, openThread, validateConversation, renderConversation, bindContacts }) {
  const form = root.querySelector('#message-search'), input = form.elements.q;
  const container = root.querySelector('#inbox-message-results');
  const conversationHost = document.createElement('div'), host = document.createElement('div');
  container.append(conversationHost, host);
  const renderSearchState = (host, result, title) => {
    host.hidden = result.state === 'idle'; host.replaceChildren();
    if (host.hidden) return false;
    const hint = document.createElement('p'); hint.textContent = title; host.append(hint);
    if (['loading', 'waiting'].includes(result.state)) { hint.textContent = t('messages.searching'); return false; }
    if (result.state === 'error') {
      hint.textContent = t('messages.searchError');
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = t('live.retry'); retry.onclick = result.retry; host.append(retry); return false;
    }
    return true;
  };
  const renderFooter = (host, result) => {
    if (!result.messages.length) { const empty = document.createElement('p'); empty.textContent = t('messages.noSearchResults'); host.append(empty); }
    if (result.more) { const more = document.createElement('button'); more.type = 'button'; more.textContent = t('messages.loadMore'); more.onclick = result.more; host.append(more); }
  };
  const conversations = createMessageSearch({ request: api, context, current, kind: 'conversations', validateConversation,
    render(result) {
      if (!root.isConnected || !renderSearchState(conversationHost, result, t('messages.inbox'))) return;
      const list = document.createElement('div'); list.className = 'chatList';
      list.innerHTML = result.messages.map(renderConversation).join(''); conversationHost.append(list);
      list.querySelectorAll('.conversationOpen').forEach((button) => { button.onclick = () => openThread(Number(button.closest('[data-conversation]').dataset.conversation)); });
      bindContacts(list, result.messages); renderFooter(conversationHost, result);
    },
  });
  let timer;
  const search = createMessageSearch({ request: api, context, current,
    render(result) {
      if (!root.isConnected) return;
      if (!renderSearchState(host, result, t('messenger.messageSearch'))) return;
      const rows = document.createElement('div'); rows.className = 'messageSearchResults';
      rows.innerHTML = result.messages.map((m) => '<button type="button" data-search-conversation="' + m.conversation_id + '" data-search-message="' + m.id + '"><b>@' + esc(m.sender_handle) + personaBadge(m.sender_persona) + '</b><span>' + esc(m.body) + '</span></button>').join('');
      rows.querySelectorAll('button').forEach((button) => { button.onclick = () => openThread(Number(button.dataset.searchConversation), Number(button.dataset.searchMessage)); });
      host.append(rows);
      renderFooter(host, result);
    },
  });
  input.addEventListener('input', () => {
    if (root.querySelector('.inboxDemoList')) {
      clearTimeout(timer); search.reset(''); conversations.reset(''); container.hidden = true; return;
    }
    clearTimeout(timer); search.reset(input.value); conversations.reset(input.value);
    container.hidden = input.value.trim().length < 2;
    root.querySelector('#conversation-list').hidden = !container.hidden;
    timer = setTimeout(() => { if (root.isConnected) { search.load(); conversations.load(); } }, 300);
  });
  form.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(timer); if (!root.querySelector('.inboxDemoList')) { search.load(); conversations.load(); } });
}
