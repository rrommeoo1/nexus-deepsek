# Nexus Social — interface locale, content language and Near consent v1

Packet: `NX-WEB-SOCIAL-P01-LOCALE-CONTENT-NEAR-CONSENT-038`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The authenticated Social shell now resolves its interface language from the active
persona's explicit `interface_locale`. `auto` uses the browser/device language list;
it never uses IP, region, GPS or inferred nationality. The current bounded catalogue
contains Romanian, English, Polish and Arabic. Unsupported explicit values fail to
English rather than guessing a nearby identity or geography. Arabic also sets the
document direction to RTL.

The translated bounded surface includes the persistent Social dock, unread label,
three header controls, feed names/details and the profile-save acknowledgement.
Changing persona or saving the active persona applies the locale immediately and
updates `html[lang]`, `html[dir]` and the visible navigation without a reload.

Content-language preferences remain a separate ordered set used by feed ranking.
The API rejects a non-array, more than ten values or any malformed language entry;
it no longer silently drops invalid entries. Near consent is strictly boolean and
cannot be enabled—or remain enabled while its region is cleared—without an explicit
valid region. Feed selection continues to read the stored profile region only and
does not accept an IP-derived or query-supplied substitute.

## Findings closed

- **High:** `interface_locale` was persisted but did not drive the authenticated UI.
- **Medium:** malformed `content_languages` could be silently converted to an empty
  or partially filtered preference set.
- **Medium:** Near could be saved enabled without a region, leaving contradictory
  consent state.
- **Medium:** clearing the region of an already-enabled Near profile was not rejected.
- **Medium (independent review):** a valid but empty Near response could be replaced
  by unfiltered demo clips. Demo fallback is now restricted to the initial For You
  surface; every other lens clears stale feed state and shows an authentic empty state.
- **Medium (independent review):** disabled Breaking and Near-without-consent exited
  before clearing the previous feed, allowing relation suggestions to reuse stale
  authors. All unavailable/empty feed exits now share one fail-closed state reset.

## Verification

- Syntax checks: PASS for the locale module, application module and API.
- Focused tests: `107/107` PASS after one stale Romanian-only static assertion was
  updated to verify the translation key and Romanian catalogue entry together.
- Full suite: `206/206` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe checks: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The bounded independent checker reproduced the focused verification, identified the
Near/demo semantic leak above, and verified its remediation. Final verdict:
`PASS_LOCAL`, 0 Critical / 0 High / 0 Medium findings.

Automated navigation to `http://127.0.0.1:3000/` was denied by the user's saved
browser permission. No workaround was attempted. Therefore visual RTL, translated
layout fit and representative-phone rendering remain unclaimed real-browser gates.

## Remaining work

This packet is the localization and consent foundation, not complete translation of
every Social sentence. The remaining authenticated Social screens must migrate to
the same catalogue in bounded follow-up packets, followed by native-speaker review
for Romanian, Polish and Arabic and a representative-device RTL/LTR matrix.
