# Checkpoint — NX-OBS-001

## Identitate

- Task: `NX-OBS-001` — Observability SLO and cost-tag baseline
- Owner: `A15`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-03`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un trace păstrează același `trace_id` de la API prin outbox și worker până la
dependency, fără secrete sau PII, iar SLO-urile, alertele, dashboard-urile și
costurile unitare au contracte locale deterministe.

## Acceptance obligatoriu

- propagare W3C Trace Context peste limita de proces, cu parentage verificabil;
- allowlist de telemetrie și scan negativ pentru secrete/PII;
- fiecare alertă are SLO, owner, severitate și runbook;
- costurile separă `gas`, `media`, `provider`, `human_agent` și `test_traffic`;
- kill switch-ul de cardinalitate nu oprește auditul critic;
- zero egress, zero provider contorizat și zero cost incremental.

## Scope

- `packages/observability/api`: API și contract operațional;
- `planning/validate-observability.ps1`: validare locală și Evidence Pack;
- fixture-uri exclusiv sintetice `SYSTEM_TEST`.

## În afara scope-ului

- instalare/deploy Prometheus, Grafana, Loki, Sentry sau OpenTelemetry Collector;
- integrare cu date reale, producție sau servicii contorizate;
- on-call extern și configurare cloud.

## Rezultat owner

- contract TypeScript fail-closed pentru W3C `traceparent` fără baggage;
- trace API → outbox → worker → dependency cu parentage verificabil;
- allowlist pentru atribute standard și cu cardinalitate mare;
- audit critic separat, păstrat când kill switch-ul dezactivează cardinalitatea mare;
- 6 SLO-uri, 12 reguli multi-window și runbook unic cu secțiune per SLO;
- dashboard-uri declarative pentru reliability și unit cost;
- cost-tagging distinct pentru gas, media, provider, human agent și test traffic;
- `SYSTEM_TEST` impune cost real zero și `economicEffect=false`;
- TypeScript strict, teste și boundary scan exclusiv local, fără egress.

## Remediere review

- `C09-OBS-001-001` (HIGH): checkerul a demonstrat că un wallet brut putea trece
  printr-o cheie allowlisted cu valoare sintactic validă;
- remediere: fiecare atribut trece acum și prin privacy scanner înainte de
  persistență, iar fixture-uri wallet `erd1…`, adresă IP și JWT în chei permise
  sunt refuzate explicit cu `ATTRIBUTE_PRIVATE_DATA_FORBIDDEN`;
- retest independent `C09/C10/C11`: `PASS`; `C09-OBS-001-001` este `CLOSED`.

## Stare curentă

Owner validation: `PASS` (`109/109` controale și `54` scenarii). Review independent
`C09/C10/C11`: `PASS`, zero findings deschise. Evidence:
`planning/evidence/NX-OBS-001-validation.json` și
`planning/evidence/reviews/NX-OBS-001-C09-C10-C11.yaml`.

Stare finală: `done`. Producția, providerii managed și on-call extern rămân în
afara packet-ului. Succesor activ: `NX-CHAIN-002`.
