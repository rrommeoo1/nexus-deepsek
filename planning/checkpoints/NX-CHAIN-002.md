# Checkpoint — NX-CHAIN-002

## Identitate

- Task: `NX-CHAIN-002` — Indexer reducer and reconciliation skeleton
- Owner: `A22`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-03`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Același read model este reconstruit determinist din evenimente chain canonice,
indiferent de duplicate, întârziere și ordine de livrare, iar orice divergență
între liabilities și balances este detectată și reparată controlat.

## Acceptance obligatoriu

- duplicatele, evenimentele out-of-order și observațiile non-finale nu modifică
  rezultatul canonic;
- reorg-ul invalidează proiecția afectată și replay-ul converge;
- double-entry liabilities și balances se reconciliază exact;
- rebuild-ul local are RTO declarat și măsurat;
- rollback: servește ultimul checkpoint verificat și dezactivează mutațiile afectate;
- fixture-uri sintetice, zero egress, zero fonduri și zero cost incremental.

## Scope

- contract de eveniment indexat și cheie de idempotency;
- reducer/checkpoint/replay determinist;
- reconciliation și repair plan fără auto-write economic;
- failure injection și Evidence Pack local.

## În afara scope-ului

- mainnet, fonduri reale, repair automat cu efect economic;
- provider managed, deploy sau date de producție;
- afirmații de performanță pentru infrastructură externă.

## Progres implementat

- reducer TypeScript strict pentru `ACTION_EXECUTED`, `JOURNAL` și
  `BALANCE_OBSERVED`, cu ordine deterministă și idempotency exact;
- bookkeeping separat pe `paymentKey + accountClass + accountCommitment`;
- schemă `indexed-observation.v1` și model `VerifiedChainObservation` care persistă
  atât `contentHash`, cât și `authenticityProofHash` pentru restart și repair;
- `EventAuthenticityVerifier` obligatoriu pe ingest și repair;
- checkpoint SHA-256 cu snapshot și event count capturate atomic prin generation
  fence; orice mutație în timpul hash-ului refuză promovarea;
- repair numai prin `RepairAuthorizationVerifier`, legat de subject state root,
  set autoritativ, rol maker/checker, quorum, expirare și approval ID single-use;
- rollback la ultima stare verificată; fără transfer, rețea sau auto-write economic.

## Remediere findings T0

- `C03-CHAIN-002-001`: remediat prin schema și modelul de persistență versionate,
  plus testul de substituție a proof hash-ului;
- `C09-CHAIN-002-002`: remediat prin generation compare-after-hash și un test
  concurent cu hasher suspendat;
- `C03-CHAIN-002-003`: remediat prin verifier injectat și teste pentru aprobare
  fabricată, replay, subject greșit, set greșit și expirare;
- retestul independent a închis cursa APPLIED, dar a cerut durabilitate completă
  pentru lineage, consumul aprobării peste restart și toate câmpurile checkpointate;
- lineage-ul complet este acum serializat, persistat și reverificat; round-trip-ul
  reconstruiește aceeași stare și același state root, iar substituția este refuzată;
- consumarea aprobării și setul replacement sunt comise atomic prin
  `RepairCommitStore`, cu `approvalId` unic și replay refuzat pe instanță nouă;
- generation fence avansează și pentru duplicate și observații non-finale;
- owner validation: `PASS`, run `NX-CHAIN-002-REMEDIATION2-20260803-03`,
  `157/157` controale și `81/81` scenarii;
- rebuild fixture: 500 evenimente în aproximativ 32 ms, limită locală 2.000 ms;
- zero boundary findings, zero credențiale billing/producție, zero egress și zero
  efect economic.

## Findings deschise

- `C09-CHAIN-002-002` este închis independent;
- `C03-CHAIN-002-001`, `C03-CHAIN-002-003` și `C09-CHAIN-002-004` sunt remediate
  de owner, dar rămân formal deschise până la retestul independent final.

## Următoarea acțiune

Packet acceptat după retestul independent `C03/C09/C10`: `PASS`, receipt
`planning/evidence/reviews/NX-CHAIN-002-C03-C09-C10.yaml`, SHA-256
`3aa677f90b187595fac4c3588201df5cb625d25d348c349f91b1bbfa7684b88f`.
Handoff-ul activ este `NX-MEDIA-001`.
