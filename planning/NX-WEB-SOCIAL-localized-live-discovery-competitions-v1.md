# Nexus Social — localized Live discovery and competitions v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-LIVE-DISCOVERY-COMPETITIONS-047`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

Live discovery, Following, Battle and Championships now follow the active persona
locale in Romanian, English, Polish and Arabic. Loading, unavailable, empty,
ranking, viewer-count, creator-board, competition and draft states use the shared
parity-checked catalogue. Numbers and dates use the active interface locale.

The surface remains truthful: it renders only server-provided, privacy-filtered
organic state. Missing or malformed arrays become safe empty states rather than
invented sessions or rankings. Unknown statuses, dates and prize policies map to
controlled labels instead of raw values.

Battle/Championship draft creation now uses a stable `Idempotency-Key` while the
form is unchanged, rotates it after an edit and prevents concurrent duplicate
submission. The local `datetime-local` value is validated in the browser and sent
as an explicit UTC ISO instant, avoiding client/server timezone ambiguity. The
server remains authoritative for the 5-minute to 366-day scheduling boundary.
Raw backend reasons and errors are not rendered.

## Findings resolved

- **High:** retrying a competition draft generated a new mutation identity and
  could create duplicates after an ambiguous response. The form now retains one
  stable key until content changes and disables duplicate submission in flight.
- **High:** a timezone-less `datetime-local` string was sent to the server, where
  interpretation could differ from the user's device timezone. The client now
  converts a validated local value to an explicit UTC ISO instant.
- **Medium:** Live response arrays and competition fields were trusted directly;
  malformed data could break the entire screen. Collection boundaries and display
  fallbacks now fail closed.
- **Medium:** discovery and competition states mixed Romanian literals, fixed
  `ro-RO` number formatting and raw server failure text. The bounded surface now
  has RO/EN/PL/AR catalogue parity and locale-aware presentation.
- **Medium:** the draft modal lacked Escape close, focus entry and an announced
  result region. These interaction and accessibility paths are now present.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/operational tests: `114/114` PASS.
- Live raw-copy audit: PASS.
- Full product suite: `210/210` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native linguistic review and RTL/LTR layout
checks on real devices remain external gates.

## Scope boundary

This packet localizes and hardens Live discovery and private competition-draft
creation. It does not activate public broadcasting, paid voting, awards, escrow,
SFU/TURN, production recording or production moderation.
