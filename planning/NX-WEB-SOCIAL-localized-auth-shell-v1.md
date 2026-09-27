# Nexus Social — localized authentication shell v1

Packet: `NX-WEB-AUTH-P02-LOCALIZED-AUTH-SHELL-061`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The visible login, signup, account-created, recovery and xPortal states use the
shared RO/EN/PL/AR catalogue. Device locale is resolved before authentication;
the active profile preference takes precedence after login. Arabic applies the
existing RTL document contract. Returning from xPortal or recovery retains the
sanitized provider-capability state instead of incorrectly disabling providers.

xPortal cancellations, timeouts and generic failures are mapped to controlled
localized states. Raw WalletConnect/provider exception strings are not rendered.
No provider was contacted and no production credential was used in this packet.

## Verification

- Syntax and locale coverage: PASS, zero missing keys in all four locales.
- Focused authentication/locale checks `4/4` PASS.
- Full suite `224/224` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device RTL/LTR, production
OAuth/email verification, trusted HTTPS, xPortal attestation and independent
review remain external gates.
