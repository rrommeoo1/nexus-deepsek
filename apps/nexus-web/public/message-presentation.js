export function messageDayLabel(timestamp, previous, locale, now = Date.now()) {
  const day = (seconds) => { const date = new Date(seconds * 1000); return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()); };
  if (!Number.isFinite(timestamp) || (previous != null && day(timestamp) === day(previous))) return '';
  const offset = Math.round((day(timestamp) - day(now / 1000)) / 86400000);
  return offset === 0 || offset === -1 ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(offset, 'day') : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(timestamp * 1000);
}

export function showConversationMedia(thread, t) {
  thread.querySelector('.conversationMedia')?.dispatchEvent(new Event('dismiss'));
  const panel = document.createElement('section'); panel.className = 'conversationMedia';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', t('common.close'));
  const list = document.createElement('div'); panel.append(close, list);
  const messages = thread.querySelector('.msgs');
  const paint = () => {
    list.replaceChildren();
    for (const item of messages.querySelectorAll('img,video,audio,a[download]')) {
      const button = document.createElement('button'); button.type = 'button';
      if (item.tagName === 'IMG') { const image = document.createElement('img'); image.src = item.src; image.alt = ''; button.append(image); }
      const label = document.createElement('span'); label.textContent = item.tagName === 'A' ? item.textContent : t('composer.media' + item.tagName); button.append(label);
      button.onclick = () => { if (!item.isConnected) return paint(); dismiss(); item.closest('.msg')?.scrollIntoView({ block: 'center' }); item.focus(); };
      list.append(button);
    }
    if (!list.children.length) list.textContent = t('composer.noMedia');
  };
  const observer = new MutationObserver((records) => { if (!thread.isConnected || !panel.isConnected) dismiss(); else if (records.some((record) => messages.contains(record.target))) paint(); });
  const dismiss = () => { observer.disconnect(); panel.remove(); };
  panel.addEventListener('dismiss', dismiss); close.onclick = dismiss;
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); dismiss(); thread.querySelector('.conversationMore')?.focus(); } });
  thread.querySelector('header').after(panel); paint();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] }); close.focus();
}
