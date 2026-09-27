import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "../public/app.js"), "utf8");

test("owner Story menu archives with a stable key and exact active-profile result", () => {
  assert.match(app, /function openStoryOwnerSheet\(story\)/);
  assert.match(app, /newUploadMutationKey\("story-archive"\)/);
  assert.match(app, /Number\(result\.actor_id\) === Number\(state\.user\.id\)/);
  assert.match(app, /result\.actor_persona === "social"/);
  assert.match(app, /result\.status === "archived"/);
});

test("owner can create a Highlight only after exact create and exact item receipts", () => {
  assert.match(app, /newUploadMutationKey\("story-highlight-create"\)/);
  assert.match(app, /newUploadMutationKey\("story-highlight-item"\)/);
  assert.match(app, /created\.action === "story_highlight_created"/);
  assert.match(app, /Number\(created\.owner_id\) === Number\(state\.user\.id\)/);
  assert.match(app, /added\.owner_persona === "social"/);
  assert.match(app, /Number\(added\.highlight_id\) === highlightId/);
  assert.match(app, /added\.story\?\.status === "archived"/);
});

test("partial Highlight failure stays recoverable and never claims Story archival", () => {
  assert.match(app, /data-story-owner-status[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(app, /Highlight-ul există, dar Story-ul nu este confirmat în el/);
  assert.match(app, /reutilizează aceeași operație, fără duplicare/);
  assert.match(app, /Highlight-ul nu a fost confirmat\. Nicio arhivare nu este presupusă/);
});
