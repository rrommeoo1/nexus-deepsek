// Presentation only. All conversations and messages still pass the application's
// server-bound authorization checks before entering this surface.
import { mountConversationMenu, searchDisplayedMessages } from './conversation-menu.js?v=20260914-lab1';
import { mountComposerTools } from './composer-tools.js?v=20260914-camera1';
import { showConversationMedia } from './message-presentation.js?v=20260914-lab1';
import { mountThreadPreferences } from './conversation-preferences.js?v=20260914-menu1';
export function personaBadge(persona) {
  const labels = { social: 'Social', dating: 'Dating', work: 'Work', travel: 'Travel', market: 'Market' };
  if (!Object.hasOwn(labels, persona)) return '';
  return '<span class="conversationPersona" data-persona="' + persona + '">' + labels[persona] + '</span>';
}

export function renderConversationRow(conversation, { state, activeConversationId, t, esc, safeInternalMediaUrl, usernameSigil, orbitStatusChip, interfaceLocale }) {
  const participants = Array.isArray(conversation.participants) ? conversation.participants.filter((participant) => participant && typeof participant === "object") : [];
  const others = participants.filter((participant) => Number(participant.id) !== Number(state.user.id));
  const title = String(conversation.kind === "group" ? (conversation.title || t("messages.group")) : (others[0]?.display_name || others[0]?.handle || t("messages.conversation")));
  const subtitle = conversation.last_message ? ((Number(conversation.last_message.sender_id) === Number(state.user.id) ? t("messages.youPrefix") : "") + (String(conversation.last_message.encryption_mode || "").startsWith("e2ee_") ? t("messages.encryptedMessage") : String(conversation.last_message.body || ""))) : (conversation.kind === "group" ? others.map((item) => "@" + String(item.handle || "")).join(", ") : t("messages.newConversation"));
  const initials = title.slice(0, 2).toUpperCase();
  const me = participants.find((participant) => Number(participant.id) === Number(state.user.id));
  const stateLabel = me?.state === "pending" ? t("messages.invitation") : conversation.status === "request" ? (Number(conversation.request_recipient_id) === Number(state.user.id) ? t("messages.request") : t("messages.waiting")) : "";
  const identity = conversation.kind === "group" ? "" : usernameSigil(others[0], conversation.context_persona);
  const id = Number(conversation.id);
  const unread = Math.max(0, Number(conversation.unread) || 0);
  return '<div class="conversationRow" data-handle="' + esc(others[0]?.handle || '') + '" data-conversation="' + id + '" data-kind="' + esc(conversation.kind) + '" data-unread="' + unread + '" data-active="' + (activeConversationId === id) + '"><button type="button" class="contactAvatar" aria-label="' + esc(title) + '" data-contact="' + id + '"><i>' + (safeInternalMediaUrl(others[0]?.avatar) ? '<img src="' + esc(safeInternalMediaUrl(others[0].avatar)) + '" alt="" loading="lazy" />' : esc(initials)) + '</i></button><button type="button" class="conversationOpen"><span><b>' + identity + esc(title) + personaBadge(conversation.context_persona) + (others[0] ? orbitStatusChip(others[0], conversation.context_persona) : '') + (stateLabel ? '<mark>' + esc(stateLabel) + '</mark>' : '') + '</b><small>' + esc((conversation.last_message?.status === "expired" ? t("messages.expiredMessage") : subtitle).slice(0, 64)) + '</small></span><em><small>' + (conversation.last_message?.created_at ? esc(new Date(conversation.last_message.created_at * 1000).toLocaleTimeString(interfaceLocale, { hour: "2-digit", minute: "2-digit" })) : "") + '</small>' + (unread ? '<strong>' + unread + '</strong>' : '') + '</em></button></div>';
}

export function inboxShell(t, esc, box, logo = 'NEXUS', selected = 'social') {
  const text = (key) => esc(t(key));
  const modules = [['all', t('messenger.allMessages')], ['social', 'Social'], ['dating', 'Dating'], ['work', 'Work'], ['travel', 'Travel'], ['market', 'Market']];
  const selectedName = modules.find(([value]) => value === selected)?.[1] || 'Social';
  return `<div class="screen scrollScreen inboxScreen messengerScreen">
    <header class="messengerTopbar">
      <button type="button" class="messengerHome" id="inbox-home" aria-label="${text('header.home')}">${logo.replaceAll('nexus-wordmark-x', 'nexus-messenger-x')}<small>MESSAGES</small></button>
      <details class="inboxModules"><summary aria-label="${text('messages.filtersLabel')}"><span>${esc(selectedName)}</span>⌄</summary><div>${modules.map(([value, label]) => `<button type="button" data-inbox-persona="${value}" aria-pressed="${value === selected}">${esc(label)}</button>`).join('')}</div></details>
      <details class="inboxTools"><summary aria-label="${text('messenger.options')}"><span id="inbox-filter-label">${text(box === 'requests' ? 'messages.requests' : 'messages.all')}</span>⌄</summary><div>
        <div class="inboxBoxes" id="inbox-boxes" aria-label="${text('messages.boxesLabel')}">
          <button type="button" data-inbox-view="all" aria-pressed="${box === 'inbox'}">${text('messages.all')}</button>
          <button type="button" data-inbox-view="unread" aria-pressed="false">${text('messenger.unread')}</button>
          <button type="button" data-inbox-view="group" aria-pressed="false">${text('conversation.group')}</button>
          <button type="button" data-inbox-box="requests" aria-pressed="${box === 'requests'}">${text('messages.requests')}</button>
          <button type="button" data-inbox-box="activity">${text('messages.activity')}</button>
        </div>
      </div></details>
    <button type="button" class="iconBtn" id="new-conversation" aria-label="${text('messages.newConversation')}">${icon('compose')}</button></header>
    <form id="message-search" class="inboxSearch" role="search"><input type="search" name="q" id="conversation-search" maxlength="80" autocomplete="off" aria-label="${text('messenger.search')}" placeholder="${text('messenger.search')}"/><button type="submit" aria-label="${text('messenger.search')}">${icon('search')}</button></form>
    ${box === 'inbox' ? '<div class="stories" id="storyRail" aria-label="Stories"></div>' : ''}
    ${box !== 'inbox' ? `<button type="button" class="inboxReturn" data-inbox-box="inbox">‹ ${text('messages.inbox')}</button>` : ''}
    <p class="inboxFilterStatus" role="status" hidden></p>
    <div id="conversation-list" aria-live="polite"><div class="notificationLoading">${text('messages.loading')}</div></div>
    <div id="inbox-message-results" aria-live="polite" hidden></div>
    <div id="inbox-examples"></div><div id="thread"></div><div id="conversation-create"></div>
  </div>`;
}

export function matchesConversation({ text, unread, kind }, query, filter) {
  return (filter !== 'unread' || Number(unread) > 0) && (filter !== 'group' || kind === 'group')
    && String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().includes(String(query).trim().normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase());
}

let disposeInbox = () => {};
export function bindInboxPresentation(root, { t, box, onInbox }) {
  disposeInbox();
  let filter = 'all';
  const search = root.querySelector('#conversation-search');
  const searchForm = root.querySelector('#message-search');
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); search.value = ''; search.dispatchEvent(new Event('input')); }
  });
  const list = root.querySelector('#conversation-list');
  const status = root.querySelector('.inboxFilterStatus');
  // The quick search never sends message contents or search text to a service.
  // It filters only already-authorized, loaded rows; pagination remains visible.
  const apply = () => {
    if (!root.isConnected) { observer.disconnect(); return; }
    const rows = [...root.querySelectorAll('#conversation-list [data-conversation], .inboxDemoList [data-conversation]')];
    for (const row of rows) row.hidden = !matchesConversation({
      text: row.textContent + ' ' + (row.dataset.handle || ''), unread: row.dataset.unread, kind: row.dataset.kind,
    }, search.value, filter);
    status.hidden = search.value.trim().length >= 2 || !(search.value || filter !== 'all');
    status.textContent = rows.some((row) => !row.hidden) ? t('messenger.loadedOnly') : t('messages.noSearchResults') + ' · ' + t('messenger.loadedOnly');
  };
  const observer = new MutationObserver(apply);
  observer.observe(list, { childList: true, subtree: true });
  disposeInbox = () => observer.disconnect();
  search.addEventListener('input', () => {
    if (search.value.trim().length >= 2) {
      filter = 'all';
      root.querySelector('#inbox-filter-label').textContent = t('messages.all');
      root.querySelectorAll('[data-inbox-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.inboxView === 'all')));
    }
    apply();
  });
  root.querySelectorAll('[data-inbox-view]').forEach((button) => button.addEventListener('click', () => {
    if (box !== 'inbox' || list.dataset.search === 'true') { onInbox(); return; }
    if (search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
    filter = button.dataset.inboxView;
    root.querySelector('#inbox-filter-label').textContent = button.textContent;
    button.closest('details').open = false;
    root.querySelectorAll('[data-inbox-view]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    apply();
  }));
  const menus = [...root.querySelectorAll('.inboxTools, .inboxModules')];
  root.addEventListener('click', (event) => { for (const menu of menus) if (!menu.contains(event.target)) menu.open = false; });
  for (const menu of menus) menu.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); menu.open = false; menu.querySelector('summary').focus(); } });
  searchForm.hidden = box === 'activity';
}

const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  compose: '<path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M14 4l3-3 5 5-3 3-9 9-5 1 1-5Z"/>',
  audio: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>',
  video: '<rect x="3" y="5" width="12" height="14" rx="3"/><path d="m15 9 6-3v12l-6-3Z"/>',
};
export const icon = (kind) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</svg>`;

// Preserve the same call controls/listeners across realtime header refreshes.
export function setThreadHeader(header, markup, avatar) {
  const controls = header.querySelector('.threadCallActions');
  header.innerHTML = markup;
  if (avatar !== undefined) {
    header.querySelector('em')?.remove();
    const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'threadAvatar';
    badge.setAttribute('aria-label', header.querySelector('b').textContent);
    if (avatar) { const image = document.createElement('img'); image.src = avatar; image.alt = ''; badge.append(image); }
    else badge.textContent = header.querySelector('b').textContent.slice(0, 2).toUpperCase();
    header.querySelector('button').after(badge);
  }
  if (controls) header.append(controls);
}

export function enhanceThread(thread, t, preferenceScope) {
  const header = thread.querySelector('#thread-header');
  const form = thread.querySelector('#send-msg');
  const originalBody = form.querySelector('[name="body"]');
  if (originalBody?.tagName === 'INPUT') {
    const textarea = document.createElement('textarea');
    for (const attr of originalBody.attributes) if (attr.name !== 'type') textarea.setAttribute(attr.name, attr.value);
    textarea.rows = 1; textarea.value = originalBody.value; textarea.setAttribute('aria-label', t('composer.message'));
    originalBody.replaceWith(textarea);
    const resize = () => { textarea.style.height = '48px'; textarea.style.height = Math.min(132, Math.max(48, textarea.scrollHeight)) + 'px'; };
    textarea.addEventListener('input', resize); form.addEventListener('reset', () => queueMicrotask(resize));
  }
  const controls = document.createElement('div'); controls.className = 'threadCallActions';
  const callStatus = document.createElement('p'); callStatus.id = 'thread-call-status'; callStatus.className = 'threadCallStatus'; callStatus.hidden = true; callStatus.setAttribute('role', 'status'); header.after(callStatus);
  for (const mode of ['audio', 'video']) {
    const button = thread.querySelector(`#${mode}-call`);
    button.innerHTML = icon(mode);
    button.setAttribute('aria-label', t(`messenger.${mode}`));
    controls.append(button);
  }
  const options = document.createElement('div'); options.className = 'threadExtras'; options.hidden = true; options.id = 'thread-extras';
  // These controls remain descendants of their form. Hiding the presentation
  // does not disable E2EE or change FormData semantics.
  options.append(form.querySelector('.composerSecurity'), form.querySelector('[name="expires"]'));
  for (const selector of ['.threadActions', '#meeting-list', '.threadTruth']) options.append(thread.querySelector(selector));
  form.prepend(options);
  const closeOptions = document.createElement('button'); closeOptions.type = 'button'; closeOptions.className = 'closeThreadPreferences'; closeOptions.textContent = '×'; closeOptions.setAttribute('aria-label', t('common.close'));
  const dismissOptions = () => { options.hidden = true; controls.querySelector('.conversationMore')?.focus(); };
  closeOptions.onclick = dismissOptions; options.prepend(closeOptions);
  const openPanel = (panel) => {
    const same = !options.hidden && !panel.hidden;
    for (const child of options.children) child.hidden = child !== closeOptions && child !== panel;
    options.hidden = same; if (!same) closeOptions.focus();
  };
  const preferenceActions = preferenceScope ? mountThreadPreferences(thread, form, options, t, preferenceScope, openPanel) : [];
  mountConversationMenu(thread, controls, t, [
    ['sessions.profile', () => thread.querySelector('.threadAvatar')?.click()],
    ['messenger.search', () => searchDisplayedMessages(thread, t)],
    ['chatPrefs.security', () => openPanel(options.querySelector('.composerSecurity'))],
    ['composer.media', () => showConversationMedia(thread, t)],
    ...preferenceActions,
    ['thread.meeting', () => openPanel(options.querySelector('.threadActions'))],
  ]);
  thread.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !options.hidden) { event.stopPropagation(); dismissOptions(); } });
  thread.addEventListener('click', (event) => {
    if (!options.hidden && !options.contains(event.target) && (!controls.contains(event.target) || event.target.closest?.('.conversationMore'))) options.hidden = true;
  });
  header.append(controls);

  const picker = form.querySelector('[name="attachment"]');
  const attach = picker.closest('label');
  const menu = document.createElement('div'); menu.className = 'threadAttachMenu'; menu.hidden = true;
  const selection = document.createElement('div'); selection.className = 'threadAttachmentSelection'; selection.hidden = true;
  const filename = document.createElement('span'); filename.setAttribute('role', 'status');
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', t('messenger.removeFile'));
  selection.append(filename, remove);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'attachToggle'; toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 12 7-7a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L13 3m-7 13 10-10a1.5 1.5 0 0 1 2 2L8 18"/></svg>';
  toggle.disabled = picker.disabled;
  toggle.setAttribute('aria-label', t('thread.attach')); toggle.setAttribute('aria-expanded', 'false');
  attach.hidden = true;
  const closeMenu = () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.onclick = () => {
    if (picker.disabled) return;
    menu.hidden = !menu.hidden; toggle.setAttribute('aria-expanded', String(!menu.hidden));
  };
  for (const [key, accept, capture] of [
    ['messenger.gallery', 'image/*,video/*', false], ['messenger.camera', 'image/*', true], ['thread.file', 'image/*,video/*,audio/wav,audio/mpeg,audio/ogg,.pdf,.docx,.xlsx,.pptx', false],
  ]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t(key);
    button.onclick = () => {
      if (picker.disabled) return;
      if (capture) { closeMenu(); thread.querySelector('.composercamera')?.click(); return; }
      picker.accept = accept;
      if (capture) picker.setAttribute('capture', 'user'); else picker.removeAttribute('capture');
      closeMenu(); picker.click();
    };
    menu.append(button);
  }
  const showSelection = () => {
    const file = picker.files?.[0];
    selection.hidden = !file;
    filename.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : '';
  };
  picker.addEventListener('change', showSelection);
  remove.onclick = () => { if (picker.disabled) return; picker.value = ''; picker.dispatchEvent(new Event('input', { bubbles: true })); showSelection(); };
  form.addEventListener('reset', () => queueMicrotask(showSelection));
  thread.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) { event.stopPropagation(); closeMenu(); toggle.focus(); } });
  thread.addEventListener('click', (event) => { if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu(); });
  form.append(selection, menu); attach.after(toggle);
  mountComposerTools(form, { input: form.querySelector('[name="body"]'), picker, send: form.querySelector('[type="submit"]'), t });
}
