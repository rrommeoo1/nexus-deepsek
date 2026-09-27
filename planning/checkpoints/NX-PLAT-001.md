# Checkpoint — NX-PLAT-001

## Identitate

- Task: `NX-PLAT-001` — CI and immutable artifact foundation
- Owner: `A10`
- Risc: `T1`
- Stare: `done`
- Data: `2026-08-02`
- Cost incremental: `0 EUR`

## Rezultat owner

- modul demonstrativ cu contract, owner și health check determinist;
- build local fără rețea, scanare de secrete și dependențe, SBOM CycloneDX 1.5;
- proveniență legată de produs, builder și workflow prin `workspace-content-sha256`;
- semnătură RSA verificată, limitată explicit la `LOCAL_EPHEMERAL_TEST_ONLY`;
- promovare în staging efemer fără rebuild și fără schimbarea digestului;
- CODEOWNERS generat pentru toate cele 45 de artefacte arhitecturale;
- workflow extern hard-disabled, cu șapte câmpuri obligatorii de aprobare, timeout și action pin-uit la SHA.

## Acceptance owner

- două build-uri reproductibile: PASS;
- digest build = digest staging: PASS;
- secret sintetic și dependență CRITICAL: DENY;
- artefact alterat și registry lipsă: DENY;
- semnătură, SBOM și proveniență verificate independent de builder: PASS;
- `RunId`, artefactele și manifestele sunt validate strict și nu pot ieși din root-urile aprobate;
- dependența CRITICAL a fost injectată în manifest și build-ul complet a refuzat-o;
- 98 assertions, zero failures.

## Evidence

- runs: `NX-PLAT-001-20260802T122104908Z-810a02eb`, `NX-PLAT-001-20260802T122104921Z-2c292391`;
- artefact/promotion SHA-256: `de8d7af00059c90d146dba6d986bc6898da344f50823675ce973f75c96bbd9a2`;
- source revision: `7d1291b90334ca228f86979d560c065a4d37296537a1cc255255928195d3e0a0`;
- review subject: `01e64ede94a4d59f9d98f01692609c43be44dd43ecddbefc15e96d98caef0f4c`;
- owner evidence: `planning/evidence/NX-PLAT-001-validation.json`.

Workspace-ul nu are metadata Git disponibilă. Proveniența nu inventează un commit:
folosește digestul canonic al materialelor, iar migrarea la commit SHA rămâne cerință
pentru CI-ul unui repository inițializat.

## Gate final

- owner validation: PASS;
- initial C11 review: CHANGES_REQUIRED;
- final C11 review: PASS, run `NX-PLAT-001-VALIDATE-20260802T122253050Z-0080c15d`;
- `C11-PLAT-001..004`: CLOSED;
- `NX-PLAT-001`: `review → done`;
- `NX-CONTRACT-001`: deschis ca următorul packet sub WIP=1;
- production trust, deploy și orice provider contorizat: în afara acestui packet și dezactivate.
