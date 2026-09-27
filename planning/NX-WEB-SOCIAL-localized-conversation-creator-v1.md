# Nexus Social — localized conversation creator v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-CONVERSATION-CREATOR-049`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The new-conversation dialog now follows the active persona locale in Romanian,
English, Polish and Arabic. Direct/group choice, username guidance, group naming,
validation, progress and failure states use the shared parity-checked catalogue.

Client preflight normalizes optional `@`, case and duplicate usernames. It permits
only Nexus usernames with 2–30 letters, digits or underscores, requires exactly
one recipient for a direct conversation, at least two distinct recipients for a
group and a non-empty group name. The server remains authoritative for identity,
block/follow/message policies and the active profile's Privacy Matrix.

Creation now uses a stable `Idempotency-Key` while the form is unchanged, rotates
the key after edits and blocks concurrent duplicate submission. A successful
response is accepted only with a positive safe-integer conversation ID. Closing
the dialog while a request is pending prevents the detached result from changing
the current UI. Raw backend errors are not displayed.

## Findings resolved

- **High:** a repeated create request used a fresh mutation identity and could
  duplicate a conversation after an ambiguous response. One edit-bound key is now
  retained and simultaneous submission is blocked.
- **Medium:** direct/group cardinality, username syntax and group title were left
  entirely to a server round trip. Deterministic client preflight now prevents
  avoidable invalid mutations while server privacy validation remains authoritative.
- **Medium:** malformed success data could set an invalid active conversation ID.
  Only positive safe-integer IDs are accepted.
- **Medium:** a response could complete after the dialog was closed and mutate the
  visible route. Detached forms now discard completion.
- **Medium:** the dialog used Romanian literals and raw backend errors. The bounded
  surface now has RO/EN/PL/AR catalogue parity and controlled failure copy.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/operational tests: `116/116` PASS.
- Full product suite: `212/212` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native linguistic and real-device RTL/LTR
layout review remain external gates.

## Scope boundary

This packet covers direct/group conversation creation only. It does not change
message encryption, membership epochs, thread rendering, calls or meetings.
