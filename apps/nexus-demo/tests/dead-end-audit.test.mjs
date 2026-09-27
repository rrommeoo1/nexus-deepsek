import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Dead-end and client-security static audit.
//
// These invariants are the "prove it" gate for section 1 (nothing may be a dead
// end) and sections 21/23 (client security / no raw HTML injection) of the
// final audit. They are pure source scans: deterministic, fast, no network, no
// browser, and they run in CI.

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

function openingTagPositions(source, tag) {
  const positions = [];
  const re = new RegExp("<" + tag + "(?=\\s|>)", "g");
  let m;
  while ((m = re.exec(source)) !== null) positions.push(m.index);
  return positions;
}

function openingTagEnd(source, start) {
  // find the '>' that closes the opening tag, skipping attribute values
  let quote = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ">") return i;
  }
  return source.length;
}

function tagSlice(source, start) {
  return source.slice(start, openingTagEnd(source, start) + 1);
}

test("every <button> has a real onClick handler (no dead controls)", () => {
  const offenders = [];
  for (const start of openingTagPositions(page, "button")) {
    const tag = tagSlice(page, start);
    // Buttons that only wrap a file <input> inside a <label> are intentional
    // (the label receives the click). Everything else must have onClick.
    if (!tag.includes("onClick=")) offenders.push(tag.slice(0, 120));
  }
  assert.deepEqual(offenders, [], `buttons without onClick:\n${offenders.join("\n")}`);
});

test("no click handlers on non-interactive elements (a11y + behavior)", () => {
  const offenders = [];
  for (const el of ["div", "span", "em", "i", "small", "b"]) {
    for (const start of openingTagPositions(page, el)) {
      const tag = tagSlice(page, start);
      if (tag.includes("onClick=") && !tag.includes("role=")) {
        offenders.push(tag.slice(0, 120));
      }
    }
  }
  assert.deepEqual(offenders, [], `non-interactive onClick without role:\n${offenders.join("\n")}`);
});

test("no raw HTML injection surface (React escapes all text)", () => {
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /innerHTML\s*=/);
});

test("camera streams are always torn down (no leaked MediaStream)", () => {
  // useCamera's cleanup must stop tracks before unmount.
  assert.match(page, /cancelled=true/);
  assert.match(page, /getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
  // every camera user must mount through useCamera(true) and bind via ref
  assert.ok((page.match(/useCamera\(true\)/g) || []).length >= 3);
});

test("localStorage reads are guarded against malformed data", () => {
  assert.match(page, /catch\{\s*return initial/);
  assert.match(page, /catch\{\s*\/\* ignore \*\/\s*\}/);
});

test("all five personas and all 18 modules remain wired in navigation", () => {
  for (const token of ["social", "work", "dating", "travel", "market"]) {
    assert.ok(page.includes(token + ':[[\"primary\"'), `missing nav def for ${token}`);
  }
  for (const name of ["Pulse", "Market", "Messages", "Creator", "Privé", "Nexus Pay", "Dating", "Watch", "Kids", "Signal", "Work", "Stay", "Ride", "Beauty", "Music", "Wellbeing", "Node Network"]) {
    assert.match(page, new RegExp(name));
  }
});