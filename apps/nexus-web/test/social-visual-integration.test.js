import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createDemoThreads } from '../public/social-inbox-demo.js';

test('publish preserves caption and selected file before locking controls', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('    const publishKey = form.dataset.publishKey;');
  const end = source.indexOf('    try {', start);
  assert.ok(start > 0 && end > start);
  const file = { name: 'holiday.webm', size: 1024, type: 'video/webm' };
  const controls = [
    { name: 'caption', value: 'Un moment frumos', disabled: false },
    { name: 'file', value: file, disabled: false },
    { name: 'private_internal', value: 'omit me', disabled: true },
  ];
  // Model the HTML successful-controls rule, not a browser-rendering test.
  class SuccessfulControls {
    constructor(form) { this.values = new Map(form.querySelectorAll().filter((control) => !control.disabled).map((control) => [control.name, control.value])); }
    get(name) { return this.values.get(name); }
  }
  const result = runInNewContext(`(() => {${source.slice(start, end)}return { fd, priorDisabled };})()`, {
    form: { dataset: { publishKey: 'intent-unchanged' }, querySelectorAll: () => controls },
    FormData: SuccessfulControls,
  });
  assert.equal(result.fd.get('caption'), 'Un moment frumos');
  assert.equal(result.fd.get('file'), file);
  assert.equal(result.fd.get('private_internal'), undefined);
  assert.equal(controls.every((control) => control.disabled), true);
  assert.deepEqual(Array.from(result.priorDisabled), [false, false, true]);
});

test('example conversations are session-owned and never real-account identities', () => {
  const first = createDemoThreads();
  const second = createDemoThreads();
  first[0].messages[0].body = 'Changed in one screen';
  first[0].draft = 'Unsent example';
  assert.notEqual(second[0].messages[0].body, first[0].messages[0].body);
  assert.equal(second[0].draft, '');
  assert.equal(second.every((thread) => thread.classification === 'SYSTEM_TEST' && !('user_id' in thread) && !('conversation_id' in thread)), true);
  assert.ok(second.length >= 5);
});
