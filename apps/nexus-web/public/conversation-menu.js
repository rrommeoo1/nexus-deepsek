// Shared disclosure for real and clearly labelled demonstration conversations.
export function mountConversationMenu(thread, controls, t, actions) {
  const menu = document.createElement('div'); menu.className = 'conversationMenu'; menu.hidden = true;
  const more = document.createElement('button'); more.type = 'button'; more.className = 'conversationMore'; more.textContent = '⋮';
  more.setAttribute('aria-label', t('messenger.options')); more.setAttribute('aria-expanded', 'false');
  const close = () => { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); };
  for (const [label, action] of actions) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t(label);
    button.onclick = () => { close(); action(); }; menu.append(button);
  }
  more.onclick = () => { menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) menu.querySelector('button')?.focus(); };
  thread.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) { event.stopPropagation(); close(); more.focus(); } });
  thread.addEventListener('click', (event) => { if (!menu.contains(event.target) && !more.contains(event.target)) close(); });
  controls.append(menu, more);
  return close;
}

export function searchDisplayedMessages(thread, t) {
  thread.querySelector('.conversationSearch')?.remove();
  thread.querySelectorAll('.conversationMatch').forEach((node) => node.classList.remove('conversationMatch'));
  const bar = document.createElement('form'); bar.className = 'conversationSearch'; bar.setAttribute('role', 'search');
  const input = document.createElement('input'); input.type = 'search'; input.placeholder = t('messenger.searchLoaded'); input.setAttribute('aria-label', t('messenger.searchLoaded'));
  const count = document.createElement('output'); count.setAttribute('aria-live', 'polite');
  const next = document.createElement('button'); next.type = 'submit'; next.textContent = '↓'; next.setAttribute('aria-label', t('messenger.nextMatch'));
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', t('common.close'));
  let hits = [], index = -1;
  const fold = (text) => String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const clear = () => thread.querySelectorAll('.conversationMatch').forEach((node) => node.classList.remove('conversationMatch'));
  const show = () => { clear(); if (hits.length) { index = (index + 1) % hits.length; hits[index].classList.add('conversationMatch'); hits[index].scrollIntoView({ block: 'center' }); } count.textContent = hits.length ? `${index + 1} / ${hits.length}` : '0'; };
  input.oninput = () => { const query = fold(input.value.trim()); hits = query ? [...thread.querySelectorAll('.msgs .msg')].filter((node) => fold(node.querySelector('p')?.textContent || '').includes(query)) : []; index = -1; show(); };
  bar.onsubmit = (event) => { event.preventDefault(); hits = hits.filter((node) => node.isConnected); show(); };
  next.onclick = (event) => { event.preventDefault(); hits = hits.filter((node) => node.isConnected); show(); };
  close.onclick = () => { clear(); bar.remove(); thread.querySelector('.conversationMore')?.focus(); };
  bar.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close.click(); } });
  bar.append(input, count, next, close); thread.querySelector('header').after(bar); input.focus();
}
