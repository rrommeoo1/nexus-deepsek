# Checkpoint — NX-ADULT-P01

## Identitate

- Task: `NX-ADULT-P01` — Privé age consent entitlement and opaque-settlement proof
- Owner: `A43`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-16`
- Cost incremental maxim implicit: `0 EUR`

## Scope acceptat

- suprafață web/PWA 18+ separată de Nexus Core și de aplicațiile mobile-store;
- verificare sintetică age + identity pentru viewer și fiecare performer;
- consimțământ, drepturi, teritoriu și takedown legate per asset;
- entitlement privat și conținut criptat, fără IPFS public;
- purge/revocare de discovery și chei, cu evidență legală minimă;
- settlement opac și reconciliere exactă, fără metadate sensibile on-chain.

## Limite

- numai `SYSTEM_TEST`, local și deterministic;
- fără persoane, KYC, conținut adult sau media reale;
- fără provider age/liveness/payment, fără rețea, fonduri ori tranzacții;
- lansarea, country packs, legal opinion și auditul extern rămân gates formale.

## Verdict final

- Evidence Pack owner: `planning/evidence/NX-ADULT-P01-validation.json`;
- validare owner: `PASS`, 163 controale și 82 scenarii deterministe x3;
- review independent `C02/C04/C05/C06/C08`: `PASS / T0_REVIEW_SATISFIED`;
- receipt: `planning/evidence/reviews/NX-ADULT-P01-C02-C04-C05-C06-C08.yaml`;
- toate finding-urile `001`–`005` sunt `CLOSED`, cu zero efecte externe și cost `0 EUR`.

## Dovadă owner

- `packages/adult/api/index.ts`: receipts independente, publication, entitlement,
  Free Discovery 18+, paid offers, purge, opaque settlement și restore;
- camere `Paid Live` și `Paid 1:1 Call`: tarif/timer vizibil, escrow cap, metering
  semnat pe minut, oprire automată și consent pentru recording;
- creator economics: 80% baseline content, 90% tips, referral numai din taxa netă
  Nexus și zero pentru `SYSTEM_TEST`, paid/agent sau multi-level;
- `packages/adult/api/index.test.ts`: 82 aserțiuni deterministe, inclusiv revocare
  playback, generație/policy/token/fee/expiry settlement, TIP floor,
  escrow single-use, consent participant/device/purpose binding și settlement CAS
  cu exact un câștigător concurent, plus
  expirare în timpul verificării;
- `planning/validate-adult.ps1`: compile strict, trei repetări, dependency/effect/
  privacy/source-boundary gates;
- validarea owner remediată trece cu cel puțin 158 controale și 82 scenarii x3; subjectul
  final este păstrat exclusiv în Evidence Pack pentru a evita binding circular;
- zero network, provider, fonduri, identități ori media reale și cost `0 EUR`.

## Checkpoint capacitate

- banda curentă este `UNOBSERVED`, deci operarea efectivă este `YELLOW`: agentul
  principal, WIP=1, teste locale și deterministe, cost incremental 0;
- codul, testele și documentul `docs/22-fair-vertical-platforms.md` sunt salvate;
- Evidence Pack-ul anterior rămâne istoric și este intenționat stale; nu se
  folosește pentru verdictul final după remediere.
