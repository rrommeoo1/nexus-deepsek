import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeModalAccessibility } from "../public/modal-accessibility.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const modalSource = await readFile(new URL("../public/modal-accessibility.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const visualFoundation = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");
const callClient = await readFile(new URL("../public/call-client.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("all modal markup has an accessible name and declares modal semantics", () => {
  const dialogs = app.match(/<[^>]+role=["']dialog["'][^>]*>/g) || [];
  assert.ok(dialogs.length >= 12, `expected broad dialog coverage, got ${dialogs.length}`);
  for (const dialog of dialogs) {
    assert.match(dialog, /aria-modal=["']true["']/);
    assert.match(dialog, /aria-(?:label|labelledby)=["'][^"']+["']/);
  }
  assert.match(index, /<html lang="ro">/);
  assert.match(index, /class="skipLink" href="#app"/);
  assert.doesNotMatch(app, /<main class="nexusDemo">/);
});

test("global modal manager traps both Tab directions and restores focus", () => {
  assert.match(app, /initializeSharedModalAccessibility\(\)/);
  assert.match(modalSource, /event\.key === 'Escape'/);
  assert.match(modalSource, /dialog\.querySelector\('\[data-modal-close\],\.sheet-close'\)/);
  assert.match(modalSource, /event\.shiftKey && current === first/);
  assert.match(modalSource, /current === last/);
  assert.match(modalSource, /restoreTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(modalSource, /new MutationObserverRef\(refresh\)/);
  assert.match(modalSource, /dialog\.setAttribute\('tabindex', '-1'\)/);
});

test("active dialogs isolate background while preserving prior accessibility state", () => {
  assert.match(modalSource, /sibling\.setAttribute\('inert', ''\)/);
  assert.match(modalSource, /sibling\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(modalSource, /previous\.inert === null/);
  assert.match(modalSource, /previous\.ariaHidden === null/);
  assert.match(modalSource, /sibling\.matches\('\.toast,\[aria-live\]'/);
  assert.doesNotMatch(modalSource, /attributeFilter:\s*\[[^\]]*'aria-hidden'/);
  assert.match(modalSource, /restoreIsolation\(\);\s*const dialogs = activeDialogs/);
  assert.doesNotMatch(app, /app\.inert = true/);
  assert.doesNotMatch(app, /previousAriaHidden|previousInert/);
});

test("focus, coarse pointer, contrast and reduced-motion preferences are explicit", () => {
  assert.match(styles, /select:focus-visible/);
  assert.match(styles, /a\[href\]:focus-visible/);
  assert.match(styles, /\[tabindex\]:not\(\[tabindex="-1"\]\):focus-visible/);
  assert.match(styles, /@media\(pointer:coarse\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.phoneScreen \.appHeader \.headerSwitches \.modeBadge\{height:44px!important;min-height:44px!important\}/);
  assert.match(styles, /\.creatorInlineActions>button,\.viewerCreatorInline>button[^\{]*\{min-height:44px!important\}/);
  assert.match(styles, /\.pulsePosts\.clipFirst \.clipCard>\.clipMoreActions button,\.commentsExpanded \.clipQuickActions button\{min-height:44px!important\}/);
  assert.match(styles, /\.creatorInlineActions>\.clipMenuButton[^\{]*\{min-width:44px!important;min-height:44px!important\}/);
  assert.match(styles, /@media\(prefers-contrast:more\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /\[inert\]\{pointer-events:none;user-select:none\}/);
  assert.match(visualFoundation, /@media \(forced-colors:active\)/);
  assert.match(visualFoundation, /animation-duration:\.01ms!important/);
  assert.match(callClient, /id="call-status" role="status" aria-live="polite"/);
  assert.match(callClient, /data-modal-close/);
});

class FakeElement {
  constructor(tag, ownerDocument, attributes = {}) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map(Object.entries(attributes));
    this.isConnected = false;
    this.rendered = true;
  }
  get hidden() { return this.hasAttribute("hidden"); }
  set hidden(value) { value ? this.setAttribute("hidden", "") : this.removeAttribute("hidden"); }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
      child.setConnected(this.isConnected);
    }
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
    this.setConnected(false);
  }
  setConnected(value) {
    this.isConnected = value;
    for (const child of this.children) child.setConnected(value);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  matches(selector) {
    if (selector === '.toast,[aria-live]') return this.attributes.get("class") === "toast" || this.hasAttribute("aria-live");
    if (selector === '[hidden],[inert],[aria-hidden="true"]') return this.hidden || this.hasAttribute("inert") || this.getAttribute("aria-hidden") === "true";
    if (selector === '[role="dialog"][aria-modal="true"]') return this.getAttribute("role") === "dialog" && this.getAttribute("aria-modal") === "true";
    if (selector === '.sheet-close') return String(this.getAttribute("class") || "").split(/\s+/).includes("sheet-close");
    if (selector === '[data-modal-close]') return this.hasAttribute("data-modal-close");
    return false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  contains(target) {
    for (let node = target; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
  querySelectorAll(selector) {
    if (selector.includes("button")) return this.descendants().filter((node) => node.tagName === "BUTTON");
    return [];
  }
  querySelector(selector) {
    const selectors = selector.split(",").map((item) => item.trim());
    return this.descendants().find((node) => selectors.some((item) => node.matches(item))) || null;
  }
  click() { this.onclick?.({ currentTarget: this, target: this }); }
  getClientRects() { return this.rendered ? [{}] : []; }
  focus() {
    this.ownerDocument.activeElement = this;
    this.ownerDocument.fire("focusin", { target: this });
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.documentElement = new FakeElement("html", this);
    this.documentElement.setConnected(true);
    this.body = new FakeElement("body", this);
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }
  create(tag, attributes) { return new FakeElement(tag, this, attributes); }
  querySelectorAll(selector) {
    return this.documentElement.descendants().filter((node) => node.matches(selector));
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  fire(type, event) { for (const listener of this.listeners.get(type) || []) listener(event); }
}

class FakeMutationObserver {
  static latest;
  constructor(callback) { this.callback = callback; FakeMutationObserver.latest = this; }
  observe() {}
  disconnect() {}
  flush() { this.callback([]); }
}

function modalFixture() {
  const documentRef = new FakeDocument();
  const appRoot = documentRef.create("main", { id: "app" });
  const opener = documentRef.create("button");
  appRoot.append(opener);
  documentRef.body.append(appRoot);
  const manager = initializeModalAccessibility({
    documentRef,
    windowRef: { getComputedStyle: () => ({ display: "block", visibility: "visible" }) },
    HTMLElementRef: FakeElement,
    NodeRef: FakeElement,
    MutationObserverRef: FakeMutationObserver,
    queueTask: (callback) => callback(),
  });
  opener.focus();
  return { documentRef, appRoot, opener, manager };
}

function createDialog(documentRef) {
  const dialog = documentRef.create("section", { role: "dialog", "aria-modal": "true" });
  const first = documentRef.create("button");
  const last = documentRef.create("button");
  dialog.append(first, last);
  return { dialog, first, last };
}

test("runtime open and close restores the app and original invoking control", () => {
  const { documentRef, appRoot, opener, manager } = modalFixture();
  const { dialog } = createDialog(documentRef);
  documentRef.body.append(dialog);
  // Mirrors feature code that focuses the dialog synchronously, before the
  // MutationObserver microtask registers it.
  dialog.focus();
  FakeMutationObserver.latest.flush();
  assert.equal(appRoot.hasAttribute("inert"), true);
  assert.equal(appRoot.getAttribute("aria-hidden"), "true");
  assert.equal(documentRef.activeElement, dialog);
  dialog.remove();
  FakeMutationObserver.latest.flush();
  assert.equal(appRoot.hasAttribute("inert"), false);
  assert.equal(appRoot.hasAttribute("aria-hidden"), false);
  assert.equal(documentRef.activeElement, opener);
  manager.destroy();
});

test("runtime nested close restores its parent control and ignores hidden controls", () => {
  const { documentRef, appRoot, manager } = modalFixture();
  const parent = createDialog(documentRef);
  const hiddenWrap = documentRef.create("div", { hidden: "" });
  const hiddenButton = documentRef.create("button");
  hiddenWrap.append(hiddenButton);
  parent.dialog.children.unshift(hiddenWrap);
  hiddenWrap.parentElement = parent.dialog;
  hiddenWrap.setConnected(parent.dialog.isConnected);
  documentRef.body.append(parent.dialog);
  FakeMutationObserver.latest.flush();
  parent.first.focus();
  const child = createDialog(documentRef);
  documentRef.body.append(child.dialog);
  FakeMutationObserver.latest.flush();
  child.dialog.remove();
  FakeMutationObserver.latest.flush();
  assert.equal(documentRef.activeElement, parent.first);
  assert.equal(appRoot.hasAttribute("inert"), true);
  let prevented = false;
  documentRef.fire("keydown", { key: "Tab", shiftKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(documentRef.activeElement, parent.last);
  assert.notEqual(documentRef.activeElement, hiddenButton);
  parent.dialog.remove();
  FakeMutationObserver.latest.flush();
  assert.equal(appRoot.hasAttribute("inert"), false);
  manager.destroy();
});

test("Escape activates only an explicit modal close control", () => {
  const { documentRef, manager } = modalFixture();
  const { dialog } = createDialog(documentRef);
  const close = documentRef.create("button", { class: "sheet-close", "data-modal-close": "" });
  dialog.append(close);
  close.onclick = () => dialog.remove();
  documentRef.body.append(dialog);
  FakeMutationObserver.latest.flush();
  let prevented = false;
  documentRef.fire("keydown", { key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dialog.isConnected, false);
  FakeMutationObserver.latest.flush();
  manager.destroy();
});
