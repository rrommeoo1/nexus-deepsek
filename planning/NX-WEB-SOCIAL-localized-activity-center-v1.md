# Nexus Social — localized Activity Center v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-ACTIVITY-CENTER-053`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

Activity Center now uses the active Romanian, English, Polish or Arabic locale for
loading, recovery, notification categories, unread counts, empty states and every
preference control. Counts follow the active locale. Unknown notification types,
invalid IDs, malformed collections and unsupported profile values are rejected
before they can become interactive UI.

An independent latest-request gate is invalidated whenever Messages changes tab or
profile. A delayed notification/preference response can therefore never replace a
newer selection. Read-one, read-all and preference updates keep one stable
`Idempotency-Key` per unchanged user intent, block duplicate submission and ignore
detached or stale completion. Failures use controlled recovery copy rather than raw
backend messages.

Quiet hours require two valid `HH:MM` values or neither. Preview modes are
allow-listed, with Dating forced to generic preview. Security/System controls stay
mandatory. Push and email remain explicitly blocked until a provider and separate
consent are configured; this packet adds no external notification channel.

## Findings resolved

- **High:** delayed Activity responses could overwrite a newly selected tab or
  profile. A dedicated request generation and selection snapshot now reject them.
- **High:** read/preference mutations used implicit disposable keys and allowed
  duplicate clicks. Visible intent now retains a stable key and is single-flight.
- **Medium:** malformed collections, IDs, types and boolean-like fields could create
  incorrect interactive controls. All response boundaries are normalized.
- **Medium:** notification settings could submit partial quiet hours or a Dating
  content preview from a tampered control. Client preflight now fails closed before
  the server's authoritative validation.
- **Medium:** the surface mixed Romanian literals with raw API errors. Controlled
  parity-checked locale copy is now used throughout.

## Verification

- Syntax checks: PASS for `app.js`, `interface-locale.js` and `audit.test.js`.
- Focused Activity audit: `3/3` PASS.
- Full product suite: `216/216` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the verdict is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native-device RTL/LTR and linguistic review
remain external gates.

## Scope boundary

This packet covers in-app Activity rendering and preferences. It does not enable
push, email, SMS, external sharing, provider billing or production delivery SLOs.
