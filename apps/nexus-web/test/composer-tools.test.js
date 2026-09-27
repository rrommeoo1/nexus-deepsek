import test from 'node:test';
import assert from 'node:assert/strict';
import { audioBufferWav, insertComposerEmoji, mountComposerTools } from '../public/composer-tools.js';
import { inspectMedia } from '../lib/media.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';

test('voice encoder produces validated mono WAV and downmixes/clamps samples', () => {
  const data = { sampleRate: 48000, length: 4, duration: 4 / 48000, numberOfChannels: 2, getChannelData: () => [1, -1, NaN, 2] };
  const bytes = audioBufferWav(data), view = new DataView(bytes);
  assert.equal(view.getUint16(22, true), 1); assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(40, true), 8); assert.equal(bytes.byteLength, 52);
  assert.deepEqual([44, 46, 48, 50].map((at) => view.getInt16(at, true)), [32767, -32768, 0, 32767]);
  assert.equal(inspectMedia(Buffer.from(bytes), 'audio/wav').status, 'ready_local_validation');
  for (const invalid of [{ length: NaN }, { length: 1.5 }, { duration: Infinity }, { duration: 62 }, { numberOfChannels: 3 }, { sampleRate: 0 }]) assert.throws(() => audioBufferWav({ ...data, ...invalid }), /audio_limit/);
});

test('a purpose-bound voice attachment survives the real repository and frontend read validator', () => {
  const db = openDb(':memory:'), repo = createRepo(db);
  try {
    const a = repo.createUser({ handle: 'voice_sender', displayName: 'SYSTEM_TEST Sender', trafficClass: 'SYSTEM_TEST' });
    const b = repo.createUser({ handle: 'voice_receiver', displayName: 'SYSTEM_TEST Receiver', trafficClass: 'SYSTEM_TEST' });
    for (const user of [a, b]) repo.ensurePersona(user.id, 'social', { visibility: 'public' });
    const conversation = repo.createDirectConversation({ creatorId: a.id, recipientId: b.id, contextPersona: 'social' });
    const media = repo.insertMedia({ hash: 'f'.repeat(64), ext: 'wav', mime: 'audio/wav', detectedMime: 'audio/wav', kind: 'audio', size: 140,
      uploadedBy: a.id, purpose: 'message_attachment', actorPersona: 'social', scanStatus: 'ready_local_validation', scanReason: 'SYSTEM_TEST' });
    const intent = { conversationId: conversation.id, senderId: a.id, senderPersona: 'social', body: '', kind: 'file', attachmentMediaId: media.id, clientNonce: 'voice-fixture-001' };
    const message = repo.sendConversationMessage(intent);
    assert.ok(message); assert.equal(message.media_kind, 'audio'); assert.equal(repo.sendConversationMessage(intent).id, message.id);
    const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
    const source = app.slice(app.indexOf('function isSafeChatTimestamp('), app.indexOf('function isSafeThreadMeeting('));
    const validate = runInNewContext(`${source}; isSafeThreadMessage`, { safeInternalMediaUrl: (url) => /^\/media\/[a-f0-9]{64}\.wav$/.test(url) ? url : null });
    const context = { ...conversation, participants: [{ id: a.id }, { id: b.id }] };
    assert.equal(validate(message, context, null), true);
    assert.equal(validate({ ...message, attachment_url: 'https://outside.invalid/voice.wav' }, context, null), false);
    assert.equal(validate({ ...message, media_kind: 'unknown' }, context, null), false);
  } finally { db.close(); }
});

test('emoji insertion replaces selection without truncating emoji at the text limit', () => {
  const input = { value: 'hello', selectionStart: 1, selectionEnd: 4, maxLength: 5,
    setRangeText(value, a, b) { this.value = this.value.slice(0, a) + value + this.value.slice(b); },
    dispatchEvent() { this.changed = true; }, focus() { this.focused = true; } };
  assert.equal(insertComposerEmoji(input, '😀'), true); assert.equal(input.value, 'h😀o'); assert.equal(input.changed, true);
  input.selectionStart = input.selectionEnd = input.value.length;
  assert.equal(insertComposerEmoji(input, '🎉'), false); assert.equal(input.value, 'h😀o');
});

class Node extends EventTarget {
  constructor() { super(); this.children = []; this.dataset = {}; this.isConnected = true; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  click() { this.clicked = true; return this.onclick?.(); }
}
function fixture(overrides = {}) {
  const saved = new Map();
  const set = (key, value) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const document = new Node(); document.createElement = () => new Node();
  set('document', document); set('isSecureContext', true);
  set('navigator', { mediaDevices: { getUserMedia: async () => { throw new Error('denied'); } } });
  set('OfflineAudioContext', class {}); set('DataTransfer', class {});
  set('MediaRecorder', class { static isTypeSupported() { return true; } });
  for (const [key, value] of Object.entries(overrides)) set(key, value);
  const form = new Node(); form.dataset.canSend = 'true';
  const input = new Node(); input.value = ''; input.disabled = false;
  const picker = new Node(); picker.files = [];
  const send = new Node();
  mountComposerTools(form, { input, picker, send, t: (key) => key, demo: overrides.demo === true });
  const control = (name) => form.children.find((node) => node.className === name);
  return { form, input, picker, send, control, document, restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } } };
}

test('composer swaps mic/send, opens selfie picker without submitting, honors admission and demo isolation', async () => {
  const f = fixture();
  try {
    assert.equal(f.send.hidden, true); assert.equal(f.control('composermic').hidden, false);
    f.input.value = 'hello'; f.input.dispatchEvent(new Event('input')); assert.equal(f.send.hidden, false);
    assert.equal(f.control('composermic').hidden, true);
    f.control('composercamera').click(); assert.equal(f.picker.capture, 'user'); assert.equal(f.picker.clicked, true); assert.equal(f.form.clicked, undefined);
    f.picker.clicked = false; f.form.dataset.canSend = 'false'; f.control('composercamera').click(); assert.equal(f.picker.clicked, false);
  } finally { f.restore(); }
  const d = fixture({ demo: true });
  try { d.control('composercamera').click(); await d.control('composermic').click(); assert.equal(d.picker.clicked, undefined); assert.equal(d.control('composerStatus').textContent, 'composer.demo'); } finally { d.restore(); }
});

test('HTTP and denied microphone produce actionable state without a fake recording', async () => {
  const f = fixture({ isSecureContext: false });
  try { await f.control('composermic').click(); assert.equal(f.control('composerStatus').textContent, 'messenger.httpsCalls'); } finally { f.restore(); }
  const d = fixture();
  try { await d.control('composermic').click(); assert.equal(d.control('composerStatus').textContent, 'composer.failed'); assert.equal(d.control('composermic').disabled, false); assert.equal(d.control('composerCancel').hidden, true); } finally { d.restore(); }
});

test('leaving or selecting an attachment during microphone permission invalidates the pending capture', async () => {
  for (const action of ['leave', 'file', 'background', 'submit']) {
    let resolve, stops = 0;
    const f = fixture({ navigator: { mediaDevices: { getUserMedia: () => new Promise((done) => { resolve = done; }) } } });
    try {
      const request = f.control('composermic').click();
      if (action === 'leave') f.form.isConnected = false;
      if (action === 'file') f.picker.dispatchEvent(new Event('change'));
      if (action === 'background') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
      if (action === 'submit') f.form.dispatchEvent(new Event('submit'));
      resolve({ getTracks: () => [{ stop() { stops++; } }] }); await request;
      assert.equal(stops, 1); assert.equal(f.control('composermic')['aria-pressed'], action === 'leave' ? undefined : 'false');
    } finally { f.restore(); }
  }
});

test('record/stop yields an unsent WAV preview; cancel discards capture and stops all tracks', async () => {
  for (const discard of [false, true]) {
    let stops = 0, instance;
    class Recorder {
      static isTypeSupported() { return true; }
      constructor() { instance = this; this.mimeType = 'audio/webm'; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['local audio fixture']) }); this.done = this.onstop(); }
    }
    class Decoder { async decodeAudioData() { return { sampleRate: 48000, length: 48, duration: .001, numberOfChannels: 1, getChannelData: () => new Float32Array(48) }; } }
    class Transfer { constructor() { this.files = []; this.items = { add: (file) => this.files.push(file) }; } }
    const f = fixture({ MediaRecorder: Recorder, OfflineAudioContext: Decoder, DataTransfer: Transfer,
      navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { stops++; } }] }) } } });
    try {
      await f.control('composermic').click(); assert.equal(f.control('composerCancel').hidden, false); assert.equal(f.send.hidden, true);
      if (discard) f.control('composerCancel').click(); else await f.control('composermic').click();
      await instance.done;
      assert.equal(stops, 1); assert.equal(f.form.clicked, undefined);
      assert.equal(f.picker.files.length, discard ? 0 : 1);
      if (!discard) { assert.equal(f.picker.files[0].type, 'audio/wav'); assert.equal(f.control('composerAudio').hidden, false); assert.equal(f.send.hidden, false); }
      f.picker.files = []; f.form.dispatchEvent(new Event('reset')); await Promise.resolve();
      assert.equal(f.control('composerAudio').hidden, true); assert.equal(f.send.hidden, true);
    } finally { f.restore(); }
  }
});
