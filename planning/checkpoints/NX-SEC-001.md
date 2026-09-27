# Checkpoint — NX-SEC-001

## Identitate

- Task: `NX-SEC-001` — Threat model and baseline policy-as-code
- Owner: `C02`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-02`
- Cost incremental: `0 EUR`

## Rezultat implementat

- `security/threat-model.v1.json`: 10 active critice, 16 amenințări și 10 trust boundaries;
- `security/baseline-policy.v1.json`: 20 clase de date, deny-by-default și reguli explicite pentru sink/context;
- `security/validate-security.ps1`: gate CI local determinist, fără rețea sau date reale;
- secrete, PII, date Kids/Dating, plaintext on-chain, importuri nedeclarate, acces direct la tabele străine și waivers T0 sunt respinse.

## Owner validation

- Run inițial FAIL: `NX-SEC-001-20260802T142236057Z-dfd12fb3` — trei clase arhitecturale nemapate;
- remediere: `WORK_PRIVATE`, `AGENT_PRIVATE` și `NODE_CIPHERTEXT` adăugate în politica explicită;
- Run PASS: `NX-SEC-001-20260802T142258811Z-4c944aef`;
- rezultat: `926/926` aserțiuni, 16/16 fixture-uri negative, 7/7 pozitive, 0 findings în 13 fișiere scanate;
- populație T0: `73`, toate fail-closed, coverage 100%, census și no-waiver;
- cost: `0 EUR`; rețea: nu; date de producție: nu.

## C12 initial și remediere

- Verdict inițial: `CHANGES_REQUIRED`, run `NX-SEC-001-20260802T142532670Z-27622123`;
- findings: `C12-SEC-001..006` — 1 Critical, 4 High, 1 Medium;
- remediere: clasificare derivată din schema ID și câmpurile payload-ului, parser JSON/Unicode/`.env`, parser TypeScript AST pentru importuri, SQL schema ownership, census și roluri autoritative, trust boundaries tipate, manifest canonic complet și runtime guard receipt;
- owner retest: `NX-SEC-001-20260802T145429942Z-c8355f7c`, `1134/1134`, 31/31 negative, 8/8 pozitive, zero repository findings;
- review subject curent: `39ffa0117954f0dd83bdd08135f5c6466b781f7865984a0475542a2dbc348b61` (24/24 artefacte în manifest).
- retest C12 recurent: `C12-SEC-003` a rămas deschis pentru import dinamic constant-concatenat;
- remediere finală: AST constant folding pentru string, paranteze, concatenări și template expressions; orice import/require dinamic nerezolvabil este deny;
- owner retest final: `NX-SEC-001-20260802T150302043Z-79398d39`, `1137/1137`, 34/34 negative, 8/8 pozitive;
- review subject final: `0f7663c355a396c0a7e846f3f2e0b0b05113daab335f8d69b541f2eff7a11f8b` (24/24 artefacte).

## Pas următor

Packet acceptat după verdictul independent `C12 PASS`, run `NX-SEC-001-20260802T150408236Z-d84dd763`. Toate findings `C12-SEC-001..006` sunt închise; `NX-AUTH-001` este deblocat.
