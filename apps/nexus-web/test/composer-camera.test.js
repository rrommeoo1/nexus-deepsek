import test from 'node:test';
import assert from 'node:assert/strict';
import { openComposerCamera } from '../public/composer-camera.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
class Element extends EventTarget {
  constructor(tag) { super(); this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.isConnected = true; this.videoWidth = 1080; this.videoHeight = 1920; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  focus() { this.focused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() { this.isConnected = false; }
  play() { return Promise.resolve(); }
  click() { if (!this.disabled) { this.clicked = true; return this.onclick?.(); } }
}
function setup() {
  const originals = new Map(), observations = [], requests = [], tracks = [], revoked = [], states = [];
  const replace = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const doc = new Element('document'); doc.body = new Element('body'); doc.hidden = false;
  let pendingBlob;
  doc.createElement = (tag) => {
    const element = new Element(tag);
    if (tag === 'canvas') { element.getContext = () => ({ drawImage() {} }); element.toBlob = (fn) => { pendingBlob = fn; }; }
    return element;
  };
  replace('document', doc); replace('HTMLDialogElement', Element); replace('isSecureContext', true);
  const win = new EventTarget(); replace('addEventListener', win.addEventListener.bind(win)); replace('removeEventListener', win.removeEventListener.bind(win));
  replace('setTimeout', () => 1); replace('clearTimeout', () => {});
  replace('MutationObserver', class { constructor(fn) { this.fn = fn; observations.push(this); } observe() {} disconnect() { this.disconnected = true; } });
  replace('URL', { createObjectURL: () => 'blob:local-photo', revokeObjectURL: (url) => revoked.push(url) });
  replace('DataTransfer', class { constructor() { this.files = []; this.items = { add: (file) => this.files.push(file) }; } });
  replace('navigator', { mediaDevices: { getUserMedia: (constraints) => new Promise((resolve, reject) => requests.push({ constraints, resolve, reject })) } });
  const form = new Element('form'), picker = new Element('input'), trigger = new Element('button');
  form.dataset.canSend = 'true'; picker.files = [];
  const allowed = () => form.isConnected && form.dataset.canSend === 'true';
  const close = openComposerCamera({ form, picker, trigger, allowed, t: (key) => key, notify: (text) => states.push(text) });
  const dialog = doc.body.children[0], controls = dialog.children[2];
  const action = (key) => controls.children.find((node) => node['aria-label'] === key);
  const resolveCamera = async (index = requests.length - 1) => {
    const track = new EventTarget(); track.stops = 0; track.stop = () => track.stops++; tracks.push(track);
    requests[index].resolve({ getTracks: () => [track] }); await tick(); return track;
  };
  return { doc, form, picker, trigger, dialog, action, close, requests, resolveCamera, observations, tracks, revoked, win, states,
    encode() { pendingBlob(new Blob(['photo'], { type: 'image/jpeg' })); },
    restore() { close(); for (const [key, value] of originals) if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } };
}

test('selfie capture previews locally; explicit attach selects a file but never submits', async () => {
  const f = setup(); let submits = 0, changes = 0;
  try {
    f.form.addEventListener('submit', () => submits++); f.picker.addEventListener('change', () => changes++);
    assert.equal(f.dialog.open, true);
    assert.equal(f.requests[0].constraints.audio, false);
    assert.equal(f.requests[0].constraints.video.facingMode.ideal, 'user');
    const track = await f.resolveCamera();
    const shot = f.action('camera.photo').click(); f.encode(); await shot;
    assert.equal(track.stops, 1); assert.equal(f.picker.files.length, 0);
    assert.equal(f.action('thread.attach').hidden, false);
    f.action('thread.attach').click();
    assert.equal(f.picker.files[0].type, 'image/jpeg'); assert.equal(changes, 1); assert.equal(submits, 0);
    assert.equal(f.dialog.isConnected, false); assert.equal(f.trigger.focused, true);
    assert.deepEqual(f.revoked, ['blob:local-photo']);
  } finally { f.restore(); }
});

test('switch releases front camera before requesting rear; retry discards the local photo', async () => {
  const f = setup();
  try {
    const front = await f.resolveCamera(); f.action('camera.switch').click();
    assert.equal(front.stops, 1); assert.equal(f.requests[1].constraints.video.facingMode.ideal, 'environment');
    await f.resolveCamera(); const shot = f.action('camera.photo').click(); f.encode(); await shot;
    f.action('camera.retry').click(); assert.equal(f.requests.length, 3);
    assert.equal(f.picker.files.length, 0); assert.deepEqual(f.revoked, ['blob:local-photo']);
    f.close(); const late = await f.resolveCamera(); assert.equal(late.stops, 1);
  } finally { f.restore(); }
});

test('close/background/back/permission loss discard pending camera grants and restore focus', async () => {
  for (const cause of ['close', 'background', 'back', 'permission', 'leave', 'submit']) {
    const f = setup();
    try {
      if (cause === 'close') f.close();
      if (cause === 'background') { f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); }
      if (cause === 'back') f.win.dispatchEvent(new Event('popstate'));
      if (cause === 'permission') { f.form.dataset.canSend = 'false'; f.observations[0].fn(); }
      if (cause === 'leave') { f.form.isConnected = false; f.observations[0].fn(); }
      if (cause === 'submit') f.form.dispatchEvent(new Event('submit'));
      const track = await f.resolveCamera();
      assert.equal(track.stops, 1, cause); assert.equal(f.dialog.isConnected, false, cause);
      assert.equal(f.picker.files.length, 0, cause); assert.equal(f.observations[0].disconnected, true, cause);
    } finally { f.restore(); }
  }
});

test('late photo encoding after cancel cannot attach or replace a previous file', async () => {
  const f = setup();
  try {
    const previous = new File(['old'], 'old.jpg', { type: 'image/jpeg' }); f.picker.files = [previous];
    await f.resolveCamera(); const shot = f.action('camera.photo').click();
    f.close(); f.encode(); await shot; f.action('thread.attach').click();
    assert.equal(f.picker.files[0], previous); assert.deepEqual(f.revoked, []);
  } finally { f.restore(); }
});

test('denial has recovery actions, does not claim an active camera or attach anything', async () => {
  const f = setup();
  try {
    f.requests[0].reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); await tick();
    assert.equal(f.dialog.children[1].textContent, 'camera.deniedDetail');
    assert.equal(f.action('camera.retry').hidden, false); assert.equal(f.action('camera.photo').disabled, true);
    f.action('camera.gallery').click(); assert.equal(f.picker.clicked, true); assert.equal(f.picker.capture, undefined);
    assert.equal(f.picker.files.length, 0);
  } finally { f.restore(); }
});

test('Escape cancel and backdrop close release active tracks', async () => {
  for (const name of ['cancel', 'click']) {
    const f = setup();
    try {
      const track = await f.resolveCamera(); f.dialog.dispatchEvent(new Event(name, { cancelable: true }));
      assert.equal(track.stops, 1); assert.equal(f.dialog.open, false);
    } finally { f.restore(); }
  }
});
