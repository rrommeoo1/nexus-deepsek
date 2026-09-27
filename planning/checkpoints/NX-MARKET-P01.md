# Checkpoint — NX-MARKET-P01

## Identitate

- Task: `NX-MARKET-P01` — One product listing and capped escrow path
- Owner: `A34`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un vânzător sintetic publică un anunț OLX-like permis, iar un cumpărător sintetic
parcurge un escrow plafonat până la completion sau refund, cu stare terminală și
reconciliere exactă. Nicio marfă interzisă, plată reală sau tranzacție mainnet.

## Felie de implementare

- contract exact-shape pentru listing, policy decision, ofertă și escrow intent;
- categorie allowlisted, prohibited-goods deny și moderare înainte de activare;
- preț/currency/territory/owner/profile generation legate exact;
- escrow local cu cap zero-real-value și state machine buy/refund/dispute;
- Action Ledger distinct pentru listing și observație terminală reconciliată;
- replay, substituție, expirare, conflict concurent și refund testate local;
- actori `SYSTEM_TEST`, zero rețea/provider/economic/cost.

## Gates

- `NX-PROFILE-P01`, `NX-MOD-P01`, `NX-CHAIN-001`, `NX-CHAIN-002` și
  `NX-SEC-001` sunt acceptate;
- packet-ul cere review independent C03/C05/C06/C10 înainte de `done`;
- fonduri reale, mainnet, bunuri reale, KYC extern, taxe și opinie juridică formală
  rămân excluse.

## Stare curentă

Implementarea locală și validatorul owner sunt complete. Primul review independent
T0 a returnat `CHANGES_REQUIRED` și a identificat patru gap-uri HIGH: binding complet
al autorizației, deadline-uri escrow, independența resolverului și checkpoint/replay.
Toate cele patru au fost remediate și închise. Verdict final T0: `PASS`, binding
25/25, validator independent 116/116 controale și 33 scenarii repetate de trei ori,
subject `52270ce6818788a1a23d0b55166aebbdd7a780c897a9b65c0e9fa314d43bc922`.
Receipt: `planning/evidence/reviews/NX-MARKET-P01-C03-C05-C06-C10.yaml`, SHA-256
`9745029a6336226449ffa5eed09000c6132bebc8431ae4569b3efdea20d39211`.
