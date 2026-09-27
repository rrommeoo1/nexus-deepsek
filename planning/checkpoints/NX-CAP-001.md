# Checkpoint — NX-CAP-001

## Identitate

- Task: `NX-CAP-001` — ChatGPT Plus capacity guardrails
- Owner: `A00`
- Risc: `T1`
- Stare: `done`
- Data: `2026-08-01`
- Obiectiv: livrarea rămâne reluabilă, iar volumul de testare este obținut în
  principal local și determinist.

## Artefacte și decizii

- `AGENTS.md` definește un singur packet activ, autorizarea permanentă fără cost,
  maximum un worker și comportamentul GREEN/YELLOW/RED.
- `planning/openai-plus-capacity-plan.md` separă Plus, compute local, creditele
  opționale și API-ul plătit.
- `planning/capacity-scorecard.yaml` este snapshot-ul machine-readable pentru
  consum, WIP și proporția testelor.
- `planning/spend-control.yaml` aplică `default_deny_spend` tuturor providerilor,
  cu plafon implicit zero și fără aprobări active.
- `planning/validate-capacity.ps1` rulează guard-ul negativ și validarea
  reproductibilă; raportul este `planning/evidence/NX-CAP-001-validation.json`.
- `planning/evidence/reviews/NX-CAP-001-C11.yaml` păstrează signoff-ul final C11,
  snapshot-ul sursă evaluat și hash-ul evidence-ului pre-gate.
- „Mii de agenți de test” sunt modelați implicit ca actori sintetici locali;
  agenții generativi sunt rezervați evaluărilor care necesită raționament.
- Nicio operație de billing, credite, auto-recharge sau API plătit nu este
  autorizată de acest packet.

## Acceptance și self-test

| ID | Criteriu | Rezultat owner |
|---|---|---|
| CAP-AT-01 | Maximum un packet activ și concurență guvernată de autorizarea permanentă fără cost | PASS |
| CAP-AT-02 | Cheltuielile suplimentare cer aprobarea owner-ului | PASS |
| CAP-AT-03 | Testele deterministe reprezintă majoritatea volumului | PASS |
| CAP-AT-04 | Packet-ul se poate relua fără istoricul conversației | PASS — acest checkpoint conține starea și next action |

Verificări executate:

- unicitatea ID-urilor din backlog;
- existența tuturor dependențelor declarate;
- existența artefactelor obligatorii;
- confirmarea `active_workstreams: 1`;
- scanarea `AGENTS.md` pentru caractere neașteptate.

Comanda owner pentru generarea evidence-ului folosește ID/timestamp unic și rol
explicit:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-capacity.ps1 -RunId <unique-id> -ObservedAt <utc-timestamp> -ExecutorRole A00
```

Checker-ul rulează un replay nou, fără reutilizarea ID-ului owner-ului:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-capacity.ps1 -ExecutorRole C11
```

Rezultat: owner self-test și aprobările maker-checker A10/C10/C11 trecute.

Snapshot-ul verificării:

- 13 taskuri și 0 ID-uri duplicate;
- 0 dependențe lipsă și 0 cicluri;
- 0 taskuri `ready` cu dependențe neîndeplinite;
- 1 packet activ din limita de 1;
- un proces copil allowlisted a executat 100 de operații locale, fără rețea ori
  efect economic și fără comandă arbitrară;
- 6 forme de approval invalid, un efect economic și un egress nepermis au fost
  respinse;
- 80 assertions, 0 failures și 0 nume de credențiale billing/producție detectate;
- un approval sintetic complet și înregistrat a fost acceptat de guard, fără a
  activa vreo aprobare ori cheltuială reală;
- unitatea de măsură este `scenario_action_equivalent`, iar proporțiile observate
  sunt calculate în scorecard;
- guardrails pentru credite și API plătit: `PASS`.

## Findings și riscuri deschise

- `CAP-F-002`: timeline-ul trebuie recalibrat după patru săptămâni de throughput.
- `CAP-F-003`: ținta 90/9/1 trebuie recalibrată după mai multe packets; măsurarea
  curentă este acum calculabilă, dar eșantionul rămâne mic.

Finding rezolvat în review:

- `CAP-F-001` (`MEDIUM`): lipsa indicatorului de consum. `AGENTS.md` și planul de
  capacitate definesc acum normativ `UNOBSERVED => YELLOW/root-only`, cu checker
  secvențial permis numai pentru packet-ul curent.
- `C10-CAP-001` (`MEDIUM`): scope de cost incomplet. Rezolvat prin politica
  universală `default_deny_spend` și schema obligatorie de approval.
- `C10-CAP-002` (`MEDIUM`): guard declarativ. Rezolvat pentru bootstrap prin
  policy parsing, proces copil allowlisted cu environment curățat, egress gol,
  scan de capabilități/credențiale, CPU/wall/disk/process caps și negative approval
  tests. Sandbox-ul general de producție rămâne livrabil Platform.
- `C10-CAP-003` (`MEDIUM`): metrici necalculabile. Rezolvat prin denominator,
  normalizare, volume, timp CPU/wall, cost incremental și cost/packet `N/A`.
- `C10-CAP-004` (`LOW`): evidence nereproductibil. Rezolvat prin script, comandă,
  raport JSON și SHA-256 pentru artefactele controlate.

Niciun finding nu autorizează creșterea WIP-ului sau cheltuieli suplimentare.

## Următoarea acțiune exactă

1. `NX-CAP-001` rămâne închis cu deciziile A10/C10/C11 și evidence-ul pre-gate
   păstrat nemodificat.
2. `NX-PROG-001`, acum `ready`, poate deveni singurul packet `in_progress` în
   regim `root_only`, conform limitei WIP.

## Acceptance rămas

- none.
