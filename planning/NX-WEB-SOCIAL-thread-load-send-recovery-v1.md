# Nexus Social — thread load and send recovery v1

Packet: `NX-WEB-SOCIAL-P02-THREAD-LOAD-SEND-RECOVERY-050`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

Conversation loading now uses a latest-request gate. A slower earlier refresh can
no longer overwrite newer messages, E2EE readiness or membership state. Closing a
thread invalidates pending loads. Conversation, participant and message IDs are
validated before interaction; malformed arrays and records fail closed.

The initial thread/composer surface now follows the active locale in Romanian,
English, Polish and Arabic. Authorization remains deny-by-default: text, file,
expiry and send controls stay disabled until the server confirms active membership
and the conversation policy permits sending.

Plaintext message submission uses one stable `Idempotency-Key` and `client_nonce`
for unchanged content. Edits rotate both values, concurrent submission is blocked,
detached completion is ignored and an empty text/file submission never reaches the
server. Attachment upload keeps the existing resumable admission boundary.
Read acknowledgement uses a deterministic key bound to user, profile,
conversation and latest visible message ID.

Encrypted sending remains protected by the existing server nonce/commitment replay
boundary and is now single-flight in the UI. This packet does not claim resumable
re-encryption of a newly generated ciphertext after an ambiguous response; the UI
instructs the user to refresh the thread before attempting another send.

## Findings resolved

- **High:** concurrent refreshes for the same conversation could render stale
  messages or stale authorization/E2EE state. Latest-request generation checks now
  run after each relevant asynchronous boundary.
- **High:** rapid plaintext submission could dispatch duplicate mutations. Send is
  now single-flight and unchanged content retains one mutation key and client nonce.
- **Medium:** malformed conversation, participant, message, receipt, meeting, call
  or typing collections could break the thread. Collection boundaries are guarded.
- **Medium:** read acknowledgement used a new random mutation identity for every
  refresh. Its key is now deterministic for the latest visible message frontier.
- **Medium:** the composer exposed raw backend/upload errors and mixed Romanian
  literals. Its bounded controls and recovery states now use RO/EN/PL/AR catalogue
  copy; raw send errors are not rendered.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/operational tests: `117/117` PASS.
- Full product suite: `213/213` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Real-device E2EE interruption and ambiguous
network recovery remain external/manual gates.

## Scope boundary

This packet covers thread-load freshness, initial composer controls, plaintext
send replay and collection guards. Message bubbles, request decisions, safety
number, encrypted-attachment recovery, calls, meetings and group management remain
separate bounded localization/audit packets. The E2EE protocol was not changed.
