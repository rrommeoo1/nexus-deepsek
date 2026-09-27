# HJ-10 — preserve composer drafts on navigation

Date: 2026-09-12. One bounded local UX recovery packet. No external services, real funds, production messages or incremental spend.

## Findings and implementation

- HIGH: Home, module/feed navigation, another composer and the draft library could replace an edited composer without asking. Connected, persona-bound composer state now gates those routes when fields or selected files differ from the last saved snapshot.
- Three localized choices: Save and exit, Keep editing, Discard and exit. Escape keeps editing. A native modal dialog confines focus while the destructive choice is pending; readable 16px copy, 48px buttons and visible keyboard focus are specified in CSS.
- Save and exit waits for successful existing IndexedDB draft persistence. A quota/write failure keeps the editor and unsaved intent. New edits made during persistence require another save; they are not implicitly marked saved.
- Duplicate save operations are single-flight. Late completion from a disconnected composer or different persona does not navigate the replacement screen.
- Active upload/recording blocks navigation with an explanatory status so the user can stop recording or complete/cancel uploading. Confirmed publish success explicitly releases the draft guard.
- The application's existing popstate handler now recognizes an open composer even when the underlying route is already Home. This does not establish universal browser/OS Back interception.
- Existing file-input/FileReader helpers moved unchanged to composer-picker.js; local draft ID generation moved unchanged to draft-policy.js. Existing source-size budgets were retained, not raised. Historical CSS comments were shortened to accommodate the scoped exit-dialog rules.
- HTML, changed module and locale/CSS cache keys advanced to camera3. Existing server privacy, idempotency/outbox, draft ownership and external-share denial remain unchanged.

## Evidence

- composer-exit.test.js: 6/6 deterministic controller tests (clean/busy navigation, cancel/discard, single-flight persistence, failed save/retry, concurrent editing, stale completion).
- Full local release:check PASS: 71 test files, 1,000 isolated synthetic actors, zero synthetic issues; local production-mode health PASS; insecure API denied. External network false, real funds false, incremental cost 0.
- One existing navigation source assertion initially failed because it required switcher cleanup to be the first statement. Updated it to require the new draft guard before the same cleanup; cleanup requirements were retained.
- Syntax check passed. Running localhost index and composer-exit.js returned HTTP 200; index references camera3.

## Limits / next

This is FIXED-CANDIDATE, not rendered/device acceptance. The saved Browser restriction was not bypassed. No mobile screenshot, physical camera/keyboard replay, native dialog rendering or complete browser-history journey was tested. No claim of Instagram/TikTok parity or production readiness.

Native page unload/closing the browser is not newly intercepted. Drafts still require explicit save. Next bounded audit should cover composer reload/history and error recovery, followed by rendered mobile replay when permitted, with emphasis on keyboard visibility and an easy return from comments/chat/fullscreen.
