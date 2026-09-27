# Checkpoint — NX-ARCH-001

## Identitate

- Task: `NX-ARCH-001` — Monorepo bounded-context architecture
- Owner: `A02`
- Risc: `T1`
- Stare: `done`
- Data: `2026-08-02`

## Rezultat

- `architecture/bounded-contexts.yaml`: 4 zone, 27 bounded contexts, 45 artefacte,
  22 packages și 21 suprafețe API publice unice, ownership pentru toate cele 20
  de records P1 și 30 event contracts.
- `architecture/ADR-0001-monorepo-boundaries.md`: direcții de dependență,
  data/chain/media boundaries, Supernova adapter și reguli de migrare.
- `planning/validate-architecture.ps1`: 1.180 assertions, zero failures și zero
  cicluri de import.

Negative fixtures obligatorii:

- `Social → Dating internals`: DENY;
- `Core → Kids data`: DENY.
- alias dedus, suprafață lipsă și context necunoscut: DENY.
- mobile către internals Moderation: DENY;
- backend composition către date Dating/Financial: DENY;
- public web către `SAFETY_EVIDENCE`: DENY.
- public/mobile direct către `ACCOUNT_PRIVATE`: DENY;
- proiecție cross-profile neautorizată: DENY;
- `ACCOUNT_PRIVATE` sau proiecții private în event payload: DENY.

Positive fixtures:

- aplicația mobilă poate consuma API-ul public Dating;
- aplicația mobilă poate consuma aliasul public Profile;
- aplicația mobilă poate consuma contractul public Moderation;
- numai admin shell poate consuma `SAFETY_EVIDENCE`;
- `profile_core` este owner unic `ACCOUNT_PRIVATE`;
- mobile/public web consumă numai proiecția self, iar admin numai proiecția autorizată;
- Dating deține clasele sale sensibile;
- Kids deține datele child-only.

## Decizii

- accesul cross-context este numai prin public contracts sau events;
- regula implicită este deny;
- private plaintext rămâne pe device, iar chain primește commitments/events fără PII;
- integrarea Supernova este un adapter versionat, nu o dependență răspândită în domenii;
- `bounded_context` devine câmp machine-readable pentru ownership și WIP.

## Verificare

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\planning\validate-architecture.ps1 -ExecutorRole A00
```

Owner/orchestrator replay: PASS, 1.180 assertions, zero failures.

Remediere peer A10:

- `A10-ARCH-001`: RESOLVED — fiecare import permis rezolvă exact un
  `public_api_path` și un `import_specifier` existent și unic;
- dovada stale a fost înlocuită cu replay-ul A00 din `2026-08-02T09:08:38Z`;
- enforcement-ul WIP la runtime rămâne delimitat pentru `NX-PLAT-001`, fără a
  bloca această decizie de boundaries.

Remediere peer A12:

- `A12-ARCH-001`: REMEDIATED — `core_api_shell` deține `services/api`, compune
  numai contracte publice și nu deține date de domeniu;
- `A12-ARCH-002`: REMEDIATED — mobile are acces la API-ul public Moderation,
  iar internals rămân deny;
- `A12-ARCH-003`: REMEDIATED — `public_web_shell` și `admin_shell` sunt separate,
  iar public web nu are acces la `SAFETY_EVIDENCE`;
- retestul independent A12 a închis toate cele trei findings pe snapshotul curent.

## Următoarea acțiune

`NX-ARCH-001` este acceptat. `NX-CTRL-001` este `ready`, dar nu a fost pornit;
nu există niciun packet activ.

Remediere C04:

- `C04-ARCH-001`: REMEDIATED — `ACCOUNT_PRIVATE` are owner unic, transport
  criptat și purpose-bound, audience explicit și event payload deny;
- toate deciziile peer/control trebuie reluate pe snapshotul final.

## Acceptance rămas

- niciun criteriu rămas pentru `NX-ARCH-001`.

## Gate evidence

- C11 replay: `NX-ARCH-001-20260802T094454549Z-a243be37` — PASS,
  1.180 assertions, zero failures;
- A00 și signoff-urile A10/A12/A20/C01/C02/C04: PASS, toate `4/4` pe
  snapshotul final;
- acceptance: `2/2`; blocking findings: `0`;
- review subject SHA-256:
  `773bb1331afcf93c44802a6c9be63863017d3b650ac18f2e63d974fc488a5414`;
- full source snapshot SHA-256:
  `c436a4493f99e9a1e93772fe8aa6b7355aba4638b51fa49f9f88b21e992afe10`;
- cost incremental: `0 EUR`, politica `default_deny_spend` respectată.
