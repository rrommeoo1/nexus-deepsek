# Nexus Social — localized Feed states and post actions v1

Packet: `NX-WEB-SOCIAL-P01-LOCALIZE-FEED-STATES-AND-POST-ACTIONS-040`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The primary Social feed states and the in-feed post controls now use the active
persona's interface locale. Romanian, English, Polish and Arabic cover feed
failure, disabled Breaking, Near consent, empty results, author/follow state,
creator actions, reaction names and feedback, comments drawer chrome, save,
repost/retweet, audio, full-screen affordance and the internal-only sharing notice.

Feed and mutation failures no longer display raw backend error strings in these
surfaces. Stable catalogue messages are shown instead, while diagnostic detail
stays outside user-facing markup. Dynamic creator names use automatic bidi
isolation and Nexus handles remain explicit LTR runs. The locale module and main
application use one cache generation so refreshed phone sessions cannot combine
new interaction logic with an older message catalogue.

External sharing remains disabled. No WhatsApp, Telegram, Messenger, email,
social-network intent or equivalent external destination was introduced.

## Findings resolved in the packet

- **High:** feed failure text could expose an untrusted backend error/reason and
  could not be translated. Primary UI now maps failure classes to stable localized
  copy and excludes backend detail.
- **Medium:** follow, reactions, save, repost/retweet and recommendation feedback
  mixed Romanian literals with an EN/PL/AR interface. These states and mutation
  results now use catalogue keys.
- **Medium:** generated post controls lacked one deterministic catalogue contract.
  RO/EN/PL/AR parity is enforced against the English baseline by tests.
- **Medium:** a phone refresh could retain a stale locale module. Application and
  locale asset generations were advanced together.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused tests: `110/110` PASS.
- Full suite: `209/209` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probes: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

Capacity is currently constrained. A separate checker was unavailable after
reaching its usage limit, so this packet deliberately claims
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`, not an independent T0/T1 verdict. Native
language approval, trusted-HTTPS real-device RTL/LTR validation, narrow-screen
wrapping and screen-reader journeys remain external release gates.

## Scope boundary

This packet covers primary feed states and the in-feed post/action surface. The
full-screen media viewer, deep comment-thread management, Trust Lens detail,
Create, Live, Messages and Profile contain additional legacy copy and must be
localized in later bounded packets. No production provider, payment, blockchain
submission, deployment or external share gate was enabled.
