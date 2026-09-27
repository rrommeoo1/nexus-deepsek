# Checkpoint — NX-CONTRACT-001

## Identitate

- Task: `NX-CONTRACT-001` — OpenAPI, event, ABI and DB contract skeleton
- Owner: `A13`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-02`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Contracte versionate pentru API, evenimente, ABI și persistență, cu bindings TypeScript,
drift detection, reguli de breaking change și catalogarea câmpurilor sensibile.

## Acceptance obligatoriu

- breaking change fără versiune nouă și migration window: DENY;
- clienții/bindings generați compilează local;
- fiecare câmp sensibil are owner, purpose și retention;
- niciun generator, build sau test nu necesită rețea ori provider contorizat.

## Rezultat owner

- OpenAPI 3.1 pentru `POST /v1/actions` și `GET /v1/actions/{actionId}`;
- event schema `chain.action.executed.v1`, fără wallet, profil sau target privat în clar;
- ABI `NexusActions` pentru o singură acțiune per apel și zero payment;
- modele Prisma pentru intent, outbox și reducer cu chei de idempotency;
- data catalog cu 11 câmpuri și owner, purpose, legal basis, retention, classification;
- bindings TypeScript și consumer fixture generate determinist și compilate local;
- baseline care refuză breaking changes neversionate și cere migration window.

## Acceptance owner

- 262 assertions, zero failures;
- OpenAPI/event/ABI semantic version `1.0.0`, current drift `0`;
- breaking OpenAPI, event și ABI fără major bump/migration: DENY;
- major bump cu migration window complet: ALLOW;
- TypeScript `5.9.3` lock-uit cu integrity, `tsc --noEmit` exit `0`;
- generator side-effect-free în review și diff obligatoriu față de bindings versionate;
- full-surface fingerprints refuză tip/enum/security/required/payability/signature drift;
- chain read model folosește numai commitments, cu original/source tx, block și hyperblock lineage;
- event-ul terminal nu confundă `ORDERED`/`EXECUTION_PENDING` cu `EXECUTED_SUCCESS`;
- cost incremental: `0 EUR`.

## Evidence

- run: `NX-CONTRACT-001-20260802T131021856Z-c6d0664b`;
- review subject: `e58aa3ce27092ab5b8d234ca48a5a4b915df7316df388bca2c11909fe4739542`;
- owner evidence: `planning/evidence/NX-CONTRACT-001-validation.json`.

## Gate final

- owner validation: PASS;
- initial A20 review: CHANGES_REQUIRED;
- final A20 review: PASS, run `NX-CONTRACT-001-20260802T131116519Z-3e78f93c`;
- `A20-CONTRACT-001..006`: CLOSED;
- `NX-CONTRACT-001`: `review → done`;
- `NX-SEC-001`: deschis ca următor packet T0 sub WIP=1;
- mainnet, deploy și migration externă: dezactivate și în afara packet-ului.
