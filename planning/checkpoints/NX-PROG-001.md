# Checkpoint — NX-PROG-001

## Identitate

- Task: `NX-PROG-001` — Program registry and dependency graph
- Owner: `A00`
- Risc: `T1`
- Stare: `done`
- Data: `2026-08-02`
- Obiectiv: fiecare epic P0/P1 are owner unic, status, risc, referințe,
  dependențe și checkeri independenți.

## Artefacte

- `planning/backlog-p0.yaml`: 13 packets pentru fundația programului.
- `planning/backlog-p1.yaml`: 10 epics și 10 entry packets, toate fail-closed
  `blocked`, separate în demo-critical și post-demo-proof.
- `planning/validate-program.ps1`: validator cross-tier pentru ownership,
  checkeri, roluri, referințe, statusuri, dependențe și cicluri.
- `planning/evidence/NX-PROG-001-validation.json`: owner evidence cu snapshot SHA-256.
- `planning/evidence/reviews/NX-PROG-001-C11.yaml`: signoff-ul final C11 cu
  review subject, full source snapshot și hash-ul evidence-ului pre-gate.

## Decizii

- P1 nu înseamnă lansare simultană; packets rămân blocate până când dependențele P0
  și cross-P1 sunt `done`.
- Cele 10 ID-uri normative P1 sunt epics fără timebox artificial; fiecare are un
  entry packet separat de 0,5–3 zile și un singur rezultat observabil.
- Demo-critical este Profile → Moderation → Chat → Social → Market → Business;
  Dating, Live, Synthetic Town și Node D0 sunt post-demo proofs.
- Chat, Social și Dating depind explicit de Action Ledger/reducer, iar Chat și
  Market consumă contractul comun de moderare.
- Dating, Live și Node D0 sunt `T0`; Profile, Chat, Market și Moderation sunt de
  asemenea `T0` din cauza privacy, fondurilor sau safety.
- În owner evidence, un singur packet era activ: `NX-PROG-001`.

## Owner self-test

Comandă:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-program.ps1 -ExecutorRole A00
```

Rezultat așteptat și observat înainte de review:

- P0: 13 packets; P1: 10 epics + 10 entry packets; total: 33 records;
- 33/33 owned și 33/33 cu peer/control checker independent;
- 115 muchii de dependență;
- zero dependențe sau referințe lipsă;
- zero cicluri și zero taskuri ready cu dependențe neîndeplinite;
- `NX-PROG-001` este singurul packet activ.

Findings A01 remediate înainte de retest:

- `A01-PROG-001` HIGH: epics mascate ca packets de trei zile — separate în epics
  fără timebox și entry packets de maximum trei zile;
- `A01-PROG-002` HIGH: Action Ledger absent — adăugat pentru Chat/Social/Dating;
- `A01-PROG-003` MEDIUM: moderare absentă — adăugată pentru Chat/Market;
- `A01-PROG-004` MEDIUM: drum demo neprioritizat — introdus lane și milestone order;
- `A01-PROG-005` MEDIUM: validator incomplet — verifică acum record kind, timebox,
  parent/child, acceptance/evidence, coverage, lane și dependențele obligatorii.

Finding A02 remediat înainte de retest:

- `A02-PROG-001` MEDIUM: invariante semantice neverificate — validatorul impune
  acum P0-not-P1, packet-not-epic, membership parent/child invers, milestones 1–10,
  rădăcină comună `NX-CAP-001` și succesorii exacți `NX-ARCH/NX-CTRL`.
- `A02-PROG-002` LOW rămâne deferat la `NX-ARCH-001`, care definește
  `bounded_context` machine-readable înainte de writers concurenți.

## Riscuri deschise

- Structura P1 poate fi împărțită suplimentar după ADR-urile `NX-ARCH-001`; orice
  schimbare păstrează ID-urile ori declară migrarea.
- Timeline-ul P1 nu este o promisiune de lansare; se calculează după throughput și
  dependențe observate.

## Următoarea acțiune

1. `NX-PROG-001` rămâne închis cu deciziile A01/A02/C12/C11 și owner evidence
   păstrat nemodificat.
2. `NX-ARCH-001`, acum `ready`, poate deveni singurul packet `in_progress` în
   regim `root_only`; `NX-CTRL-001` rămâne `blocked` conform limitei WIP.

## Acceptance rămas

- none.
