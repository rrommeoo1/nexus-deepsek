# Checkpoint — NX-CTRL-001

## Identitate

- Task: `NX-CTRL-001` — Control Registry and Evidence Pack v1
- Owner: `C11`
- Risc: `T0`
- Stare: `done`
- Data: `2026-08-02`
- Cost incremental: `0 EUR`

## Rezultat owner

- `controls/control-registry.json`: 13 familii NAC și 143 controale cu ID stabil;
- 73 controale T0 au `fail_closed=true`, coverage 100%, census și `no_waiver`;
- `controls/evidence-pack.schema.json`: schemă content-addressed, sealed și append-only;
- `controls/stage-gates.json`: G0–G8, default deny, maker-checker și SLA findings;
- plan third-line independent inclus în registry, cu minimum 10% și 20 controale;
- `planning/validate-controls.ps1`: 6.132 assertions și zero failures.

## Acceptance owner

- minimum 131 controale: PASS (`143`);
- ID-uri duplicate: `0`;
- perechi objective-owner duplicate: `0`;
- T0 fail-closed și coverage 100%: PASS (`73/73`);
- author self-approval, owner-only review și author-as-checker: DENY;
- Delivery mutation pe evidence sealed: DENY;
- registry/evidence lipsă: promovare DENY.

## Evidence

- run: `NX-CTRL-001-20260802T115857572Z-431a7476`;
- review subject: `3443bdefd085696923be36bdee163ad25155772a8c705a50e915f6eb982443be`;
- owner evidence: `planning/evidence/NX-CTRL-001-validation.json`.

## Capacitate și review

Capacity band rămâne `UNOBSERVED`, deci se aplică regimul `YELLOW`: implementare
root-only și un checker secvențial independent. Checker-ul C12 trebuie să verifice
populația completă T0, schema evidence, SoD, integritatea și third-line sampling.

## Gate final

- C12 final: PASS, `6.132` assertions, `25/25` negative și `5/5` positive fixtures;
- `C12-CTRL-001..004`: CLOSED;
- `NX-CTRL-001`: `review → done`;
- `NX-PLAT-001`: `blocked → ready`;
- acceptance rămas: none.
