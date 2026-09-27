// SYSTEM_TEST: UI-only examples. No network, persistence, user IDs or real delivery.
import { renderConversationRow, icon } from './messenger-shell.js?v=20260914-lab1';
import { openContactCard, bindDialogNavigation } from './messenger-contact.js?v=20260914-lab1';
import { mountConversationMenu, searchDisplayedMessages } from './conversation-menu.js?v=20260914-lab1';
import { mountComposerTools } from './composer-tools.js?v=20260914-lab1';
const fixtures = [
  ["Mira", "MI", "Ne vedem mâine?", "Da, la 10. Abia aștept!", "Perfect, iau și camera 📷"],
  ["Alex", "AL", "Am găsit un traseu nou.", "Cât durează?", "Cam două ore, cu pauză la lac."],
  ["Ana", "AN", "Îmi place fotografia ta!", "Mulțumesc, lumina a fost superbă.", "Cum ai editat culorile?"],
  ["Weekend · grup", "WE", "Unde mergem sâmbătă?", "Eu votez pentru munte.", "Mira: Vin și eu! 🌿"],
  ["Luca", "LU", "Ai timp de o cafea?", "După-amiază sunt liber.", "Atunci ne auzim la 16."],
  ["Irina", "IR", "Ți-am pregătit lista de locuri.", "Super, mulțumesc!", "Spune-mi care îți place."],
];
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createDemoThreads() {
  return fixtures.map(([name, initials, ...lines], index) => ({
    name, initials, key: `example-${index}`, classification: "SYSTEM_TEST",
    messages: lines.map((body, id) => ({ id, body, mine: id === 1, edited: false })),
    draft: "",
  }));
}

export function demoConversation(thread, index) {
  return { id: -(index + 1), kind: thread.name.includes('grup') ? 'group' : 'direct', title: thread.name,
    context_persona: 'social', classification: 'SYSTEM_TEST', participants: [{ id: 0 }, { id: -(index + 1), display_name: thread.name, handle: thread.key }],
    last_message: { body: thread.messages.at(-1).body }, unread: 0 };
}

export function mountInboxExamples(host, { t = (key) => key, onHistoryBack = () => history.back() } = {}) {
  if (!host) return;
  const threads = createDemoThreads();
  const section = document.createElement("section");
  section.className = "inboxDemoList";
  section.setAttribute('aria-label', 'Demo · SYSTEM_TEST');
  section.innerHTML = '<div class="chatList"></div>';
  host.append(section);
  const rows = section.querySelector('.chatList');
  const showDialog = (dialog) => {
    dialog.dataset.demoOverlay = 'true';
    const transition = bindDialogNavigation(dialog, { key: 'nexusDemo', current: () => host.isConnected, onHistoryBack });
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.showModal();
    return transition;
  };
  const renderRows = () => {
    const query = (host.closest('.inboxScreen')?.querySelector('#conversation-search')?.value || '').trim().toLocaleLowerCase();
    rows.innerHTML = threads.filter((thread) => (thread.name + ' ' + thread.messages.map((m) => m.body).join(' ')).toLocaleLowerCase().includes(query)).map((thread) =>
      renderConversationRow(demoConversation(thread, threads.indexOf(thread)), { state: { user: { id: 0 } }, t, esc: escape,
        safeInternalMediaUrl: () => null, usernameSigil: () => '', orbitStatusChip: () => '', interfaceLocale: 'ro' })
    ).join('') || '<p class="demoEmpty">Niciun exemplu găsit.</p>';
    rows.querySelectorAll('[data-conversation]').forEach((row) => {
      const index = -Number(row.dataset.conversation) - 1, thread = threads[index];
      row.querySelector('em').textContent = 'Demo';
      row.querySelector('.conversationOpen').onclick = () => openExample(thread, row.querySelector('.conversationOpen'));
      const avatar = row.querySelector('.contactAvatar');
      avatar.onclick = (event) => {
        event.stopPropagation();
        openContactCard(host.closest('.inboxScreen'), demoConversation(thread, index), avatar, {
          viewerId: 0, t, esc: escape, safeInternalMediaUrl: () => null, current: () => host.isConnected, onHistoryBack, demoOnly: true,
          onAction: (action) => action === 'profile' ? openDemoProfile(thread) : openExample(thread, avatar),
        });
      };
    });
  };
  const openDemoProfile = (thread) => {
    const dialog = document.createElement('dialog'); dialog.className = 'messengerContact';
    dialog.setAttribute('aria-label', 'Profil Demo · ' + thread.name);
    dialog.innerHTML = `<button type="button" data-contact-close aria-label="${escape(t('common.close'))}">×</button><div class="contactPhoto">${escape(thread.initials)}</div><h2>${escape(thread.name)}</h2><p>${escape(t('messenger.demoOnly'))}</p><button type="button" data-demo-message>${escape(t('publicProfile.message'))}</button>`;
    section.append(dialog);
    dialog.querySelector('[data-contact-close]').onclick = () => dialog.close();
    const transition = showDialog(dialog);
    dialog.querySelector('[data-demo-message]').onclick = () => transition(() => openExample(thread));
  };
  const openExample = (thread, trigger) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'demoConversation';
    dialog.setAttribute('aria-label', `Conversație demonstrativă cu ${thread.name}`);
    dialog.innerHTML = `<header><button type="button" data-close aria-label="Înapoi la conversații">‹</button><i>${thread.initials}</i><span><b>${escape(thread.name)}</b><small>Demo · fără trimitere reală</small></span></header><div class="msgs" aria-live="polite"></div><form class="messageComposer" data-can-send="true"><textarea name="body" id="demo-message-body" rows="1" maxlength="1000" required aria-label="Mesaj demonstrativ" placeholder="Mesaj…"></textarea><input type="file" name="attachment" hidden /><button type="button" class="attachToggle" aria-label="${escape(t('thread.attach'))}">＋</button><button type="button" data-cancel-edit hidden aria-label="Anulează editarea">×</button><button type="submit" aria-label="Adaugă în demo">↑</button><output class="demoStatus" role="status"></output></form>`;
    // Keep the dialog in its owning screen: navigating away also removes it.
    section.append(dialog);
    const controls = document.createElement('div'); controls.className = 'threadCallActions';
    for (const mode of ['video', 'audio']) {
      const call = document.createElement('button'); call.type = 'button'; call.innerHTML = icon(mode); call.setAttribute('aria-label', t('messenger.' + mode));
      call.onclick = () => { dialog.querySelector('.demoStatus').textContent = t('messenger.demoCalls'); }; controls.append(call);
    }
    dialog.querySelector('header').append(controls);
    mountConversationMenu(dialog, controls, t, [['sessions.profile', () => transition(() => openDemoProfile(thread))], ['messenger.search', () => searchDisplayedMessages(dialog, t)]]);
    const textarea = dialog.querySelector('textarea');
    const submit = dialog.querySelector('[type="submit"]');
    const cancel = dialog.querySelector('[data-cancel-edit]');
    const composer = dialog.querySelector('.messageComposer');
    mountComposerTools(composer, { input: textarea, picker: composer.querySelector('[name="attachment"]'), send: submit, t, demo: true });
    composer.querySelector('.attachToggle').onclick = () => { dialog.querySelector('.demoStatus').textContent = t('composer.demo'); };
    let editId = null;
    textarea.value = thread.draft;
    textarea.dispatchEvent(new Event('input'));
    const showMessages = () => {
      const list = dialog.querySelector('.msgs');
      list.innerHTML = thread.messages.map((message) => `<div class="msg ${message.mine ? 'me' : 'other'}"><p>${escape(message.body)}</p><time>${message.edited ? 'editat · ' : ''}demo</time>${message.mine ? `<button type="button" data-edit="${message.id}">Editează</button>` : ''}</div>`).join('');
      list.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
        editId = Number(button.dataset.edit);
        textarea.value = thread.messages.find((message) => message.id === editId).body;
        cancel.hidden = false;
        submit.textContent = '✓'; submit.setAttribute('aria-label', 'Salvează editarea');
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
      }));
      list.scrollTop = list.scrollHeight;
    };
    const endEdit = () => { editId = null; cancel.hidden = true; submit.textContent = '↑'; submit.setAttribute('aria-label', 'Adaugă în demo'); textarea.value = thread.draft; textarea.dispatchEvent(new Event('input')); };
    cancel.addEventListener('click', () => { endEdit(); textarea.focus(); });
    textarea.addEventListener('input', () => { if (editId === null) thread.draft = textarea.value; });
    dialog.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body || body.length > 1000) return;
      if (editId !== null) {
        const message = thread.messages.find((item) => item.id === editId && item.mine);
        if (!message) return;
        message.body = body; message.edited = true;
      } else {
        if (thread.messages.length >= 60) { dialog.querySelector('.demoStatus').textContent = 'Limita demo: 60 de mesaje.'; return; }
        thread.messages.push({ id: thread.messages.length, body, mine: true, edited: false });
        thread.draft = '';
      }
      endEdit(); showMessages(); textarea.focus();
    });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { dialog.remove(); renderRows(); rows.querySelector(`[data-conversation="${-(threads.indexOf(thread) + 1)}"] .conversationOpen`)?.focus(); });
    showMessages(); const transition = showDialog(dialog);
  };
  host.closest('.inboxScreen')?.querySelector('#conversation-search')?.addEventListener('input', renderRows);
  renderRows();
  host.closest('.inboxScreen')?.querySelector('#conversation-search')?.dispatchEvent(new Event('input'));
}
