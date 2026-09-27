# MSG-01 — conversation-first Messenger

Date: 2026-09-12. Capacity UNOBSERVED/YELLOW: main agent only, one messaging UX packet.

## Delivered in the existing application

- Pressing the Messages dock resets Activity/Requests and the previous thread,
  opening the inbox. Activity and technical settings moved into a compact options
  disclosure, not the default tab surface. Sent tab removed from UI; server
  compatibility preserved. Requests has an explicit return to conversations.
- Quick search plus All/Unread/Group filtering of already-authorized, loaded rows.
  Scope is stated when filtering; Load more is retained. This is not a complete
  directory or encrypted-history search. Existing plaintext message search is
  still available in options, with a latest-request guard against stale results;
  quick-filter selection returns from those results to the inbox.
- Conversation rows expose authorized avatar/name, preview, last message time
  and unread count. No extra timestamps, online users or messages fabricated.
- Audio/video controls moved into the thread header with SVG icons and accessible
  labels, alongside the authorized avatar/name and options. Header refresh keeps
  the same control nodes/listeners. Their existing access/capability gates remain.
- HTTPS/capability/group limitations have visible, localized explanations instead
  of relying only on hover titles. No real-call success was fabricated.
- Meeting controls, disappearing-message duration and transport settings moved
  into an explicitly toggled panel. Form ownership, checked/disabled states and
  plaintext acknowledgement are retained. Safety-change notices remain separate.
- Attachment chooser: Gallery / Take photo / File through the existing native
  picker; photo requests user-facing capture. Filename/size and remove appear
  before Send. No new upload or API mutation occurs just by choosing a source.
- Thread layout now gives scrolling space to messages, keeps header/composer
  separate, and removes the four-column expiration selector from the main input
  row. Menus close by toggle, outside click and Escape. Old conflicting styles
  replaced; original source budget caps retained.
- If a subsequent thread response fails validation, send/file/call controls are
  disabled instead of retaining a prior authorized visual state.
- Creating a conversation from Activity or a different filter returns to the inbox.

## Evidence

- Six new deterministic tests in messenger-shell.test.js: actual navigation
  function replay; search/filter policy; options-only Activity layout; retained
  call-control identity; transport fields remain in form; attachment picker modes
  respect admission and do not auto-submit. DOM doubles are structural, not rendered.
- Local release:check PASS, including a re-run after the final search-return
  refinement: 72 test files / 406 tests; 1,000 synthetic actors, zero synthetic
  issues; local production-mode health PASS.
- Running localhost index and messenger-shell.js returned HTTP 200. Changed
  assets carry `20260912-messenger1`; unrelated modules keep their existing keys.
- Privacy/idempotency/outbox/external-share backend tests retained. Audit changes
  only follow moved Activity markup and changed cache keys. No new real data,
  external network, funds or incremental cost.

## Boundaries

Not the full Messenger prompt completed. Location/live location, complete voice
recording, real-message edit/reply/forward, draft continuity and group calls remain
in the execution plan. Existing six demo conversations remain separate examples;
their edit controls are not evidence of real-message edit support.

No browser screenshot or physical-phone camera/call/keyboard verification was
performed. The prior saved Browser denial was not bypassed. Local HTTP device
camera/call limitations are explained, not removed. Cross-network relay and
trusted HTTPS remain deployment/infrastructure gates. MSG-01 is FIXED-CANDIDATE,
not human beta acceptance and not WhatsApp parity.

Next: MSG-02 from `planning/NX-MESSENGER-HUMAN-BETA.md`.
