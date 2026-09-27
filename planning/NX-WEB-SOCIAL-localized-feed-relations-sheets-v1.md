# Nexus Social — localized Feed and Relations sheets v1

Packet: `NX-WEB-SOCIAL-P01-LOCALIZE-FEED-AND-RELATIONS-SHEETS-039`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Social Feed selector and Quick Relations sheet now use the active persona's
resolved interface locale. Romanian, English, Polish and Arabic cover every label,
description, loading/error/empty state, follow-request action, favorite action and
accessibility label in this bounded surface. Relationship-kind labels are also
translated instead of displaying repository identifiers.

All translated values are escaped before insertion into generated markup. The
locale catalogue exposes a deterministic completeness check and the test suite
requires every supported locale to contain every English baseline key. English
fallback remains available only for unknown keys or unsupported explicit locales.

The application and imported locale module use the same cache-busting generation,
preventing a refreshed phone session from mixing new UI logic with a stale message
catalogue. Locale precedence, Near consent and Privacy Matrix behavior are unchanged.

## Independent review findings closed

- **Medium:** a relations API failure was silently replaced with feed-derived data
  or an empty state. It now renders a translated truthful failure and Retry action.
- **Medium:** overlapping tab requests could let a slow response replace the latest
  selection. A generation gate invalidates prior loads and has a deterministic
  runtime ordering regression test.
- **Medium:** dynamic identities could visually reorder beside Arabic copy. Display
  names now use `bdi dir="auto"`; Nexus handles use an isolated LTR run.
- **Medium:** a delayed accept/decline/cancel result could navigate back to Requests
  after the user selected another tab. Mutation completion now refreshes only while
  its originating request view is still current and connected.
- **Medium:** raw backend action errors could override localized EN/PL/AR feedback.
  Primary UI errors now use stable catalogue messages; raw detail stays out of the
  user-facing toast.
- **Medium:** concurrent mutations on separate request rows could refresh before a
  slower commit and leave stale data visible. Request actions are now single-flight:
  the first action locks the panel until its authoritative refresh completes.

## Verification

- Syntax checks: PASS for the application and locale modules.
- Focused tests: `110/110` PASS.
- Full suite: `209/209` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe checks: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The bounded independent checker identified the six Medium findings above. All
were remediated before Evidence Pack closure. Final verdict: `PASS_LOCAL`, with
0 Critical / 0 High / 0 Medium unresolved.

This is deterministic code and catalogue validation, not native-language approval
or representative-device visual validation. Native review for Polish and Arabic,
trusted-HTTPS RTL/LTR testing, wrapping at narrow widths and screen-reader journeys
remain external release gates.

## Scope boundary

This packet localizes the Feed and Relations sheets only. Other authenticated
Social sentences are intentionally left for subsequent bounded catalogue packets;
no production provider, payment, external share or deployment gate was enabled.
