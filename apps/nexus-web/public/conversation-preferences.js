const defaults = () => ({ theme: 'nexus', muted: false, expires: '' });
export function preferenceKey({ ownerId, persona, conversationId } = {}) {
  return Number.isSafeInteger(ownerId) && ownerId > 0 && Number.isSafeInteger(conversationId) && conversationId > 0 && /^[a-z_]{2,24}$/.test(persona || '')
    ? `nexus:conversation-prefs:v1:${ownerId}:${persona}:${conversationId}` : null;
}
export function readConversationPreferences(scope, storage) {
  try {
    const key = preferenceKey(scope); if (!key) return defaults();
    const value = JSON.parse((storage || globalThis.localStorage).getItem(key) || '{}');
    return { theme: ['nexus', 'midnight', 'forest'].includes(value?.theme) ? value.theme : 'nexus', muted: value?.muted === true,
      expires: ['', '60', '3600', '86400', '604800'].includes(value?.expires) ? value.expires : '' };
  } catch { return defaults(); }
}
export function saveConversationPreferences(scope, value, storage) {
  const key = preferenceKey(scope);
  if (!key || !['nexus', 'midnight', 'forest'].includes(value.theme) || typeof value.muted !== 'boolean' || !['', '60', '3600', '86400', '604800'].includes(value.expires)) return false;
  try { (storage || globalThis.localStorage).setItem(key, JSON.stringify({ theme: value.theme, muted: value.muted, expires: value.expires })); return true; } catch { return false; }
}

export function mountThreadPreferences(thread, form, host, t, scope, openPanel) {
  let preferences = readConversationPreferences(scope);
  const panel = (title, hint) => {
    const section = document.createElement('section'); section.className = 'conversationPreference'; section.hidden = true;
    const heading = document.createElement('b'); heading.textContent = t(title);
    const detail = document.createElement('p'); detail.textContent = t(hint);
    const status = document.createElement('output'); status.setAttribute('role', 'status');
    section.append(heading, detail, status); host.append(section); return { section, status };
  };
  const theme = panel('chatPrefs.theme', 'chatPrefs.deviceOnly');
  const mute = panel('chatPrefs.notifications', 'chatPrefs.muteHint');
  const expiry = panel('chatPrefs.expiry', 'chatPrefs.expiryHint');
  const expires = form.querySelector('[name="expires"]'); expiry.section.append(expires);
  const apply = () => { thread.dataset.chatTheme = preferences.theme; expires.value = preferences.expires; };
  const save = (patch, status) => {
    const next = { ...preferences, ...patch };
    if (!saveConversationPreferences(scope, next)) { status.textContent = t('chatPrefs.saveFailed'); apply(); return false; }
    preferences = next; status.textContent = t('chatPrefs.saved'); apply(); return true;
  };
  const choose = (group, values, key) => {
    const buttons = values.map(([value, label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = t(label);
      button.setAttribute('aria-pressed', String(preferences[key] === value));
      button.onclick = () => { if (save({ [key]: value }, group.status)) buttons.forEach((item, index) => item.setAttribute('aria-pressed', String(values[index][0] === preferences[key]))); };
      group.section.append(button); return button;
    });
  };
  choose(theme, [['nexus', 'Nexus'], ['midnight', 'chatPrefs.midnight'], ['forest', 'chatPrefs.forest']], 'theme');
  choose(mute, [[false, 'chatPrefs.alertsOn'], [true, 'chatPrefs.alertsOff']], 'muted');
  expires.addEventListener('change', () => save({ expires: expires.value }, expiry.status));
  form.addEventListener('reset', () => queueMicrotask(apply)); apply();
  return [
    ['chatPrefs.theme', () => openPanel(theme.section)],
    ['chatPrefs.notifications', () => openPanel(mute.section)],
    ['chatPrefs.expiry', () => openPanel(expiry.section)],
  ];
}
