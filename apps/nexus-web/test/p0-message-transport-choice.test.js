import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from 'node:vm';

const app = readFileSync(resolve(import.meta.dirname, "../public/app.js"), "utf8");

test("message composer selects E2EE by default only after exact device readiness", () => {
  assert.match(app, /const e2eeReady = canSend && Boolean\(keyMaterial\?\.ready\)/);
  assert.match(app, /secureInput\.checked = e2eeReady/);
  assert.match(app, /secureInput\.disabled = !e2eeReady/);
});

test("owner-requested composer has no acknowledgement checkbox; E2EE errors never fall back to plaintext", () => {
  assert.doesNotMatch(app, /plaintext_ack|plaintextAcknowledged|class="plaintextConsent"/);
  assert.match(app, /class="messageTransportNotice" role="status"/);
  const secureBranch = app.match(/if \(secure\) \{[\s\S]*?\n\s*return;\n\s*\}/)?.[0] || "";
  assert.match(secureBranch, /thread\.e2eeUnavailable/);
  assert.doesNotMatch(secureBranch, /plaintext_local|plaintext_ack/);
});

test('transport notice follows readiness without changing the selected transport', () => {
  const source = app.slice(app.indexOf('function syncMessageTransportChoice('), app.indexOf('async function loadThread('));
  const sync = runInNewContext(source + '; syncMessageTransportChoice');
  for (const checked of [true, false]) for (const canSend of ['true', 'false']) {
    const secure = { checked }, notice = {};
    sync({ dataset: { canSend }, querySelector: (selector) => selector.includes('input') ? secure : notice });
    assert.equal(notice.hidden, checked || canSend !== 'true');
    assert.equal(secure.checked, checked);
  }
  assert.doesNotThrow(() => sync(null));
});

test('nonempty plaintext text/file reaches sending validation without a checkbox; empty input stays blocked', () => {
  const start = app.indexOf('sendForm.addEventListener("submit", async (e) => {');
  const bodyStart = app.indexOf('\n', start);
  const stop = app.indexOf('    const attachmentCancellation = {};', bodyStart);
  const handler = app.slice(bodyStart, stop);
  for (const data of [{ body: 'Salut' }, { attachment: { size: 12 } }, { body: '  ' }]) {
    const output = {}, form = { querySelector: () => ({ disabled: false }) };
    const execute = runInNewContext('(e) => {' + handler + '; return "continue"; }', {
      FormData: class { get(key) { return data[key]; } }, document: { getElementById: () => output }, t: (key) => key,
    });
    assert.equal(execute({ currentTarget: form, preventDefault() {} }), data.body?.trim() || data.attachment?.size ? 'continue' : 'thread.messageRequired');
  }
});

test("plain and encrypted message attachments share resumable progress and cancellation", () => {
  assert.match(app, /class="messageUploadProgress"/);
  assert.match(app, /attachmentCancellation\.requested = true/);
  assert.match(app, /message_e2ee_attachment", reportAttachmentProgress, attachmentCancellation/);
  assert.match(app, /message_attachment", reportAttachmentProgress, attachmentCancellation/);
  assert.match(app, /cancellation\.requested = cancellation\.requested === true/);
});
