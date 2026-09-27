import test from "node:test";
import assert from "node:assert/strict";
import { bindDoubleTapHeart } from "../public/double-tap-heart.js";
import { bindCaptionTranslations, captionTranslationButtonMarkup } from "../public/caption-translation.js";
import { renderSoundToggle } from "../public/social-sound.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("two quick taps create one heart action and suppress the single-tap action", async () => {
  const target = new EventTarget();
  let hearts = 0;
  let singles = 0;
  bindDoubleTapHeart(target, { delay: 20, onHeart: () => { hearts += 1; }, onSingle: () => { singles += 1; } });
  target.dispatchEvent(new Event("click", { cancelable: true }));
  target.dispatchEvent(new Event("click", { cancelable: true }));
  await wait(30);
  assert.equal(hearts, 1);
  assert.equal(singles, 0);
});

test("one tap keeps the ordinary media action", async () => {
  const target = new EventTarget();
  let hearts = 0;
  let singles = 0;
  bindDoubleTapHeart(target, { delay: 15, onHeart: () => { hearts += 1; }, onSingle: () => { singles += 1; } });
  target.dispatchEvent(new Event("click", { cancelable: true }));
  await wait(25);
  assert.equal(hearts, 0);
  assert.equal(singles, 1);
});

test("media taps stay inside the player instead of bubbling into post navigation", async () => {
  const target = new EventTarget();
  let stopped = 0;
  bindDoubleTapHeart(target, { delay: 5, onSingle: () => {} });
  const event = new Event("click", { cancelable: true });
  event.stopPropagation = () => { stopped += 1; };
  target.dispatchEvent(event);
  await wait(10);
  assert.equal(stopped, 1);
});

test("the soundtrack disc keeps its music mark while its accessible state follows playback", () => {
  const classes = new Set(["clipMusicDisc"]);
  const icon = { textContent: "" };
  const label = { hidden: false };
  const attributes = {};
  const button = {
    hidden: false,
    title: "",
    dataset: { audioLabel: "Original audio · Mira" },
    classList: {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
    },
    setAttribute: (name, value) => { attributes[name] = value; },
    querySelector: (selector) => selector === "i" ? icon : selector === "small" ? label : null,
  };
  renderSoundToggle(button, false, (key) => key, true);
  assert.equal(icon.textContent, "♫");
  assert.equal(label.hidden, true);
  assert.equal(attributes["aria-pressed"], "true");
  assert.equal(button.title, "Original audio · Mira");
});

test("translation stays an honest on-device action when the browser has no translator", async () => {
  const markup = captionTranslationButtonMarkup({ language: "en", locale: "ro", esc: String });
  assert.match(markup, />Vezi traducerea<\/button>$/);
  let click;
  let notice = "";
  const text = { textContent: "Hello", innerHTML: "Hello" };
  const block = { querySelector: () => text };
  const button = {
    dataset: { sourceLanguage: "en" },
    parentElement: { querySelector: () => block },
    addEventListener: (_type, handler) => { click = handler; },
  };
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    bindCaptionTranslations({ querySelectorAll: () => [button] }, { targetLanguage: "ro", onUnavailable: (message) => { notice = message; } });
    await click({ preventDefault() {}, stopPropagation() {} });
    assert.match(notice, /nu este disponibilă/);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
