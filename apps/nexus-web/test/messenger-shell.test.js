import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { inboxShell, matchesConversation, setThreadHeader, enhanceThread, personaBadge, renderConversationRow } from '../public/messenger-shell.js';

test('module selector is outside options, and badges accept known personas only', () => {
  const html = inboxShell((key) => key, (v) => v, 'inbox');
  assert.ok(html.indexOf('class="inboxModules"') < html.indexOf('</header>'));
  assert.match(html, /data-inbox-persona="all" aria-pressed="false">messenger.allMessages/);
  assert.match(html, /data-inbox-persona="social" aria-pressed="true"/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /inboxSpaces|inbox-filters|inbox-search-toggle/);
  for (const persona of ['social', 'dating', 'work']) assert.match(personaBadge(persona), new RegExp('data-persona="' + persona + '"'));
  assert.equal(personaBadge('<img onerror=alert(1)>'), '');
  assert.equal(personaBadge('constructor'), '');
});

test('conversation row keeps the authorized context avatar and labels the persona even for the same peer', () => {
  const args = { state: { user: { id: 1 } }, activeConversationId: null, t: (v) => v,
    esc: (v) => String(v).replaceAll('<', '&lt;'), safeInternalMediaUrl: (v) => v || null,
    usernameSigil: () => '', orbitStatusChip: () => '', interfaceLocale: 'ro' };
  for (const persona of ['social', 'dating', 'work']) {
    const html = renderConversationRow({ id: 1, kind: 'direct', context_persona: persona, unread: 2,
      participants: [{ id: 1 }, { id: 2, display_name: 'Peer', avatar: '/media/' + persona + '.jpg' }] }, args);
    assert.match(html, new RegExp('src="/media/' + persona + '.jpg"'));
    assert.match(html, new RegExp('data-persona="' + persona + '"'));
    assert.match(html, /data-unread="2"/);
  }
});

test('Spaces inbox has one slim search below the header and compact filter menu', () => {
  const html = inboxShell((key) => key, (value) => value, 'inbox');
  const options = html.slice(html.indexOf('<details class="inboxTools"'), html.lastIndexOf('</header>'));
  assert.doesNotMatch(options, /securityState/);
  assert.doesNotMatch(options, /id="message-search"/);
  assert.equal((html.match(/<input/g) || []).length, 1);
  assert.match(html, /id="message-search" class="inboxSearch" role="search"/);
  assert.ok(html.indexOf('id="message-search"') > html.indexOf('</header>'));
  assert.match(html, /<small>MESSAGES<\/small>/);
  assert.match(options, /data-inbox-view="unread"/);
  assert.doesNotMatch(html, /data-inbox-box="sent"|notificationSettings|inboxReturn/);
  assert.match(html, /data-inbox-view="all" aria-pressed="true"/);
  assert.match(html, /data-inbox-view="unread"/);
  assert.match(html, /data-inbox-view="group"/);
  assert.match(inboxShell((key) => key, (v) => v, 'activity'), /class="inboxReturn" data-inbox-box="inbox"/);
});

test('the shelf of moments is the Messages tray, and only the main inbox prints it', () => {
  // Wave 14f: the owner moved the shelf off the feed and into Messages, so it is the shell that draws the
  // tray and the app that fills it (`loadStories`). It sits where a tray of unseen moments is read: under the
  // search field, above the conversation list.
  const inbox = inboxShell((key) => key, (v) => v, 'inbox');
  assert.match(inbox, /<div class="stories" id="storyRail" aria-label="Stories"><\/div>/);
  assert.ok(inbox.indexOf('id="message-search"') < inbox.indexOf('id="storyRail"'), 'the tray follows the search field');
  assert.ok(inbox.indexOf('id="storyRail"') < inbox.indexOf('id="conversation-list"'), 'the tray leads the list');
  // Requests and Activity are lists of their own, not shelves.
  for (const box of ['requests', 'activity']) {
    assert.doesNotMatch(inboxShell((key) => key, (v) => v, box), /id="storyRail"/, box);
  }
});

test('quick search and unread/group filters use only supplied authorized rows', () => {
  const row = { text: 'Romeo · Weekend', unread: 3, kind: 'direct' };
  assert.equal(matchesConversation(row, '  ROMEO ', 'all'), true);
  assert.equal(matchesConversation(row, 'weekend', 'unread'), true);
  assert.equal(matchesConversation(row, '', 'group'), false);
  assert.equal(matchesConversation({ ...row, unread: 0 }, '', 'unread'), false);
  assert.equal(matchesConversation({ text: 'أصدقاء', unread: 1, kind: 'group' }, 'أصدقاء', 'group'), true);
  assert.equal(matchesConversation(row, 'unknown', 'all'), false);
});

test('pressing Messages from Activity resets the route and opens the inbox instead of reopening preferences', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function navigate(slot)'), app.indexOf('function renderUtility()'));
  const selected = [];
  const result = runInNewContext(`let inboxBox='activity', inboxFilter='all', activeConversationId=12, activeSlot='primary'; ${source}; navigate('inbox'); ({inboxBox,inboxFilter,activeConversationId,activeSlot});`, {
    state: { persona: 'dating' },
    // Wave 14g: navigate() also closes the drawer of the feed bar when the reader leaves the feed.
    feedHub: null,
    composerExit: null, closeSocialFeedSwitcher() {}, closeSocialFriendsSwitcher() {}, closeProfileSwitcher() {},
    renderNav() {}, selectModule: (module) => selected.push(module),
  });
  assert.equal(result.inboxBox, 'inbox');
  assert.equal(result.inboxFilter, 'dating');
  assert.equal(result.activeConversationId, null);
  assert.deepEqual(selected, ['chat']);
});

test('realtime header replacement retains the exact audio/video control objects and listeners', () => {
  const controls = { calls: 0, click() { this.calls++; } };
  const header = { querySelector: () => controls, append(node) { this.retained = node; } };
  setThreadHeader(header, '<span>Authorized name</span>');
  assert.equal(header.retained, controls);
  header.retained.click();
  setThreadHeader(header, '<span>Updated name</span>');
  assert.equal(header.retained.calls, 1);
});

// A small structural DOM double, not a browser renderer or physical-device test.
class Element extends EventTarget {
  constructor(tag, props = {}) { super(); this.tagName = tag; this.children = []; this.hidden = false; this.style = {}; Object.assign(this, props); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parent = this; this.children.push(node); } }
  prepend(...nodes) { this.append(...nodes); this.children = [...nodes, ...this.children.filter((node) => !nodes.includes(node))]; }
  after(node) { const parent = this.parent, index = parent.children.indexOf(this); node.remove(); node.parent = parent; parent.children.splice(index + 1, 0, node); }
  replaceWith(node) { this.after(node); this.remove(); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector[0] === '#') return this.id === selector.slice(1);
    if (selector[0] === '.') return this.className?.split(' ').includes(selector.slice(1));
    if (selector.startsWith('[name=')) return this.name === selector.slice(7, -2);
    if (selector.startsWith('[type=')) return this.type === selector.slice(7, -2);
    return this.tagName === selector;
  }
  querySelector(selector) { for (const node of this.children) { if (node.matches(selector)) return node; const match = node.querySelector(selector); if (match) return match; } return null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  focus() { this.focused = true; }
  click() { this.clicks = (this.clicks || 0) + 1; this.onclick?.(); }
}

function threadFixture() {
  const thread = new Element('section');
  const header = new Element('header', { id: 'thread-header' });
  const form = new Element('form', { id: 'send-msg', dataset: { canSend: 'false' } });
  const actions = new Element('div', { className: 'threadActions' });
  const audio = new Element('button', { id: 'audio-call', disabled: true });
  const video = new Element('button', { id: 'video-call', disabled: true });
  const security = new Element('label', { className: 'composerSecurity' });
  const secure = new Element('input', { name: 'secure', checked: true, disabled: true }); security.append(secure);
  const expires = new Element('select', { name: 'expires', value: '3600' });
  const label = new Element('label', { className: 'attachButton' });
  const picker = new Element('input', { name: 'attachment', disabled: true, files: [] }); label.append(picker);
  actions.append(audio, video, new Element('button', { id: 'schedule-meeting' }));
  form.append(security, expires, label, new Element('input', { name: 'body', value: '', disabled: true }), new Element('button', { type: 'submit', disabled: true }));
  thread.append(header, actions, new Element('div', { id: 'meeting-list' }), form, new Element('p', { className: 'threadTruth' }));
  return { thread, form, audio, video, secure, expires, picker };
}

test('thread enhancement keeps transport fields in the form and moves disabled call controls to its header', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const { thread, form, audio, video, secure, expires } = threadFixture();
    enhanceThread(thread, (key) => key);
    assert.equal(thread.querySelector('#thread-header').contains(audio), true);
    assert.equal(thread.querySelector('#thread-header').contains(video), true);
    assert.equal(audio.disabled, true);
    assert.equal(form.contains(secure), true);
    assert.equal(secure.checked, true);
    assert.equal(secure.disabled, true);
    assert.equal(form.contains(expires), true);
    const options = form.querySelector('.threadExtras');
    const more = thread.querySelector('.threadCallActions').children.at(-1);
    assert.equal(options.hidden, true);
    const menu = thread.querySelector('.conversationMenu');
    more.click(); assert.equal(menu.hidden, false); assert.equal(options.hidden, true);
    menu.children[2].click(); assert.equal(options.hidden, false); assert.equal(menu.hidden, true);
    more.click(); menu.children[2].click(); assert.equal(options.hidden, true);
    more.click(); menu.children[2].click(); assert.equal(options.hidden, false);
    options.querySelector('.closeThreadPreferences').click(); assert.equal(options.hidden, true);
    assert.equal(more.focused, true);
  } finally { globalThis.document = previous; }
});

test('real scoped chat exposes theme, notifications and expiry; no generic Options panel', () => {
  const previous = globalThis.document, storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  globalThis.document = { createElement: (tag) => new Element(tag) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) } });
  try {
    const { thread, form, expires } = threadFixture(); thread.dataset = {};
    enhanceThread(thread, (key) => key, { ownerId: 1, persona: 'social', conversationId: 4 });
    const menu = thread.querySelector('.conversationMenu'), options = form.querySelector('.threadExtras');
    const entry = (key) => menu.children.find((item) => item.textContent === key);
    assert.equal(entry('messenger.options'), undefined);
    entry('chatPrefs.theme').click(); assert.equal(options.hidden, false);
    const theme = options.children.find((item) => item.className === 'conversationPreference' && !item.hidden);
    theme.children.find((item) => item.textContent === 'chatPrefs.forest').click(); assert.equal(thread.dataset.chatTheme, 'forest');
    entry('chatPrefs.notifications').click();
    const mute = options.children.find((item) => item.className === 'conversationPreference' && !item.hidden);
    mute.children.find((item) => item.textContent === 'chatPrefs.alertsOff').click();
    assert.equal(JSON.parse([...data.values()][0]).muted, true);
    entry('chatPrefs.expiry').click(); assert.equal(expires.closest('.conversationPreference').hidden, false);
    expires.value = '3600'; expires.dispatchEvent(new Event('change'));
    assert.equal(JSON.parse([...data.values()][0]).expires, '3600'); assert.equal(form.contains(expires), true);
    const outside = new Event('click'); Object.defineProperty(outside, 'target', { value: form.querySelector('[name="body"]') }); thread.dispatchEvent(outside);
    assert.equal(options.hidden, true);
  } finally { globalThis.document = previous; if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage; }
});

test('attachment actions respect admission, choose the native picker mode and never auto-submit', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const { thread, form, picker } = threadFixture(); enhanceThread(thread, (key) => key);
    const toggle = form.querySelector('.attachToggle');
    const menu = form.querySelector('.threadAttachMenu');
    toggle.onclick(); assert.equal(menu.hidden, true);
    menu.children[1].click(); assert.equal(picker.clicks, undefined);
    picker.disabled = false;
    form.isConnected = true; form.dataset.canSend = 'true'; form.querySelector('[name="body"]').disabled = false;
    toggle.onclick(); assert.equal(menu.hidden, false);
    menu.children[1].click();
    assert.equal(picker.capture, 'user'); assert.equal(picker.accept, 'image/*');
    assert.equal(picker.clicks, 1); assert.equal(menu.hidden, true);
    menu.children[0].click(); assert.equal(picker.capture, undefined);
    assert.equal(picker.accept, 'image/*,video/*');
    picker.files = [{ name: '<script>.jpg', size: 2048 }]; picker.dispatchEvent(new Event('change'));
    const preview = form.querySelector('.threadAttachmentSelection');
    assert.equal(preview.hidden, false);
    assert.match(preview.children[0].textContent, /<script>\.jpg/);
    assert.equal(preview.children[0].innerHTML, undefined);
    assert.equal(form.clicks, undefined);
  } finally { globalThis.document = previous; }
});

test('real input is upgraded to an expanding textarea without losing field identity or admission', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const { thread, form } = threadFixture();
    const original = form.querySelector('[name="body"]'); original.tagName = 'INPUT';
    original.attributes = [{ name: 'name', value: 'body' }, { name: 'maxlength', value: '4000' }, { name: 'disabled', value: '' }];
    original.value = 'draft'; enhanceThread(thread, (key) => key);
    const textarea = form.querySelector('[name="body"]');
    assert.equal(textarea.tagName, 'textarea'); assert.equal(textarea.value, 'draft'); assert.equal(textarea.maxlength, '4000');
    assert.ok(Object.hasOwn(textarea, 'disabled')); textarea.scrollHeight = 400; textarea.dispatchEvent(new Event('input'));
    assert.equal(textarea.style.height, '132px');
  } finally { globalThis.document = previous; }
});
