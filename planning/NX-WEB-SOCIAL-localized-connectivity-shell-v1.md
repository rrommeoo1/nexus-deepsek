# Nexus Social — localized connectivity shell v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZED-CONNECTIVITY-SHELL-066`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The global offline warning and connection-restored notice now use the selected
RO/EN/PL/AR locale. Changing profile or its locale immediately resynchronizes the
visible banner. Offline behavior remains fail-closed: the real-time event stream
is closed, while publishing, payments and account mutations remain unavailable.

## Verification

- JavaScript syntax and locale coverage: PASS; zero missing keys in four locales.
- Focused connectivity contract `1/1` PASS.
- Full suite `228/228` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real device/network transitions and
native RTL/LTR review remain external gates.
