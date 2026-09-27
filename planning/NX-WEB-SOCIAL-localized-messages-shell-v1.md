# Nexus Social — localized Messages shell v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-MESSAGES-SHELL-048`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The unified Messages shell now follows the active persona locale in Romanian,
English, Polish and Arabic. Inbox sections, profile filters, E2EE disclosure,
loading, error, empty and conversation-summary states use the shared catalogue.
Tab semantics and announced loading/results are explicit.

Inbox reads are now protected by a latest-request gate and immutable snapshots of
the selected section and profile filter. A delayed response for an older tab or
profile can no longer replace the current list. The response is also bound to the
original connected list element before rendering.

Malformed conversation collections fail closed. Entries must be objects with a
positive safe-integer ID; participants, message values and unread counts are
normalized before display. Raw backend error text is not rendered in the shell.
The backend Privacy Matrix and profile-scoped conversation query remain
authoritative and unchanged.

## Findings resolved

- **High:** an older inbox request could resolve after a tab/profile change and
  overwrite the new selection because the current DOM node was looked up only
  after the request. A latest-request token, selection snapshot and connected-node
  check now reject stale results.
- **Medium:** `response.conversations`, participant arrays and IDs were trusted
  directly. Invalid collections now become a safe empty state and invalid IDs are
  never made interactive.
- **Medium:** raw API failure text could be exposed to the user. The shell now uses
  stable localized recovery copy.
- **Medium:** inbox tabs lacked explicit tab roles, selected state and group labels.
  Accessible tab semantics and an announced loading/result region were added.
- **Medium:** shell and conversation-summary copy mixed Romanian and English.
  The bounded surface now has RO/EN/PL/AR catalogue parity.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/operational tests: `115/115` PASS.
- Full product suite: `211/211` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native linguistic and real-device RTL/LTR
layout review remain external gates.

## Scope boundary

This packet covers the inbox shell and conversation summaries only. Activity
Center content, new-conversation creation, thread/composer, calls and meeting UI
remain in subsequent bounded localization packets. No E2EE protocol or server
cryptography was changed.
