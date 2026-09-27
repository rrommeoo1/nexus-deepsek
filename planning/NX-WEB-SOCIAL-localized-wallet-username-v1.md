# Nexus Social — localized wallet and username v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-WALLET-USERNAME-056`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Account Center wallet, asset list, top-up information and Nexus username
journeys are localized in Romanian, English, Polish and Arabic. The surface stays
truthful: no fiat/on-ramp or real transfer is activated, and only a valid MultiversX
address from a successful Account response with an explicit funding capability can
open the receive-funds sheet.

Username updates validate the canonical 2–30 character syntax before dispatch,
retain one edit-bound `Idempotency-Key`, prevent duplicate submission and ignore
completion after a persona/screen switch. A response is accepted only when it
contains the exact normalized username requested; raw server/provider errors are
not rendered.

Portfolio rendering rejects malformed collections and assets, caps the displayed
collection, and shows only syntactically valid positive balances. Failed refreshes
produce a controlled no-estimate state. Clipboard fallback now verifies success and
does not claim that an address or username was copied when both copy paths fail.

## Findings resolved

- **High:** receive-funds could be offered from an offline fallback string. It now
  requires successful Account state, exact address syntax and explicit capability.
- **High:** username save had no explicit stable intent key, duplicate protection or
  response binding. All three controls are now present.
- **Medium:** portfolio response shapes and asset values were trusted by the view.
  Malformed/unbounded/non-positive entries now fail closed.
- **Medium:** clipboard fallback always announced success. It now reports success
  only after a confirmed clipboard operation.
- **Medium:** wallet/username copy and recovery states were Romanian-only and some
  failures exposed raw backend text. This surface now has parity-checked locales and
  controlled errors.

## Verification

- Syntax and locale-catalog checks: PASS.
- Focused wallet/username audit: `2/2` PASS.
- Full product suite: `219/219` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- External network: false; real funds: false; incremental cost: 0.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Live mainnet balances, xMoney/on-ramp,
transaction signing, trusted HTTPS and independent review remain external gates.

## Scope boundary

This packet does not send funds, activate an on-ramp, query a paid provider or
change wallet custody. Access/security/lifecycle panels and login localization are
separate bounded packets.
