# Nexus Social — relations and favorites integrity v1

Packet: `NX-WEB-SOCIAL-P01-RELATIONS-FAVORITES-INTEGRITY-070`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

Followers, Following and Favorites responses are now fail-closed: the requested
kind must match, lists are capped at 80, self/invalid IDs are rejected, handles,
names, relation types and follow state are validated, and avatars can resolve only
to canonical internal media. Invalid responses show the recoverable relation error.

Device-local Favorites are normalized to unique positive safe integers and capped
at 500. Storage exceptions no longer produce a false selected-star state; the UI
keeps its previous state and shows a controlled localized error in RO/EN/PL/AR.

## Verification

- Syntax and locale coverage: PASS; zero missing keys in four locales.
- Focused relations/favorites integrity check `1/1` PASS.
- Full suite `232/232` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; Favorites remain intentionally
device-local until the cross-device graph is designed and privacy-reviewed.
