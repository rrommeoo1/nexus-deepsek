# MSG — visible module identity

Date: 2026-09-13. One bounded packet; main agent only, local deterministic checks,
no new external service, cost, real message or database migration.

## Implemented

- Module filter is now a visible native selector below inbox search, outside the
  options menu. Existing server-filtered query and cursor checks are preserved.
- Social/Dating/Work/Travel/Market badges on conversation rows, thread header and
  message bubbles. Known-value-only renderer prevents untrusted badge markup.
- Row renderer extracted to messenger-shell.js, retaining authorized participant
  avatar, initials fallback, preview, timestamp and unread state.
- Confirmed existing repository joins participant persona using conversation
  context, not the currently selected global profile. Missing contextual avatar
  is not substituted with another profile's photo.
- Existing direct conversation key already includes both users AND persona;
  histories remain separate when the same two people communicate in multiple modes.
- Frontend canSend/canInteract now require matching active persona, consistent
  with the backend rejection of cross-persona sends/calls. Mismatch shows a
  localized instruction to change active profile. No automatic persona switch.
- Social-only demo examples no longer appear under Dating/Work filter selections.
- Original app/CSS budgets retained by removing obsolete hidden-filter styles.
  Changed entry, locale, messaging module and CSS use 20260913-personas1.

## Evidence

- New real in-memory repository/API integration test: same peer, three profiles,
  three distinct conversation IDs, correct name/avatar under every filter and in
  unified inbox; missing Dating avatar does not expose Social photo; wrong-persona
  message rejected.
- Two new presentation tests: module selector outside options; allowlisted badge
  labels and correct contextual avatar/badge/unread row output.
- Targeted suite 11/11 PASS. Full release:check PASS: 72 test files, 1,000 isolated
  synthetic actors, zero synthetic issues, local production-mode health PASS.
- No browser-rendered or physical-device acceptance. Saved Browser restriction
  was not bypassed. Tests do not establish visual parity with WhatsApp.

## Remaining

The avatar rapid-action card and secure locked chats requested in the preceding
prompt are not implemented by this packet. Their persona/privacy requirements
are recorded in NX-MESSENGER-HUMAN-BETA.md. An explicit in-thread persona-switch
journey is still needed; filtering alone is not a switch of sending identity.
