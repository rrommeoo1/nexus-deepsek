# Nexus SLO response runbook

Owner operațional: `A15`. Acest runbook este executabil întâi în medii locale și
non-production. Orice acțiune care ar crea cost, ar schimba producția sau ar
afecta fonduri cere aprobările și controalele aplicabile.

## Procedură comună

1. Confirmați ambele ferestre ale alertei și segmentul `environment/version/region/device_class`.
2. Corelați trace-urile numai prin `trace_id`; nu căutați și nu adăugați wallet,
   profil, email, telefon, locație exactă, Dating sau date Kids.
3. Delimitați impactul și aplicați cel mai mic kill switch reversibil.
4. Păstrați auditul critic, SLO-urile și agregatele de cost chiar dacă opriți
   atributele cu cardinalitate mare.
5. Deschideți incidentul cu severitatea regulii, owner `A15`, timestamp, segment,
   ipoteză și dovada rollback-ului. Escalați fondurile la `C03`, privacy la `C04`,
   Kids la `C07`, reziliența la `C09` și costul la `C10`.

## api_non_media_availability

- Verificați rata 5xx/timeout și dependențele pe regiune; scoateți din rotație
  instanța degradată sau dezactivați feature flag-ul recent.
- Recuperare: ambele burn windows sub prag și probele sintetice trec 15 minute.

## api_non_media_write_latency

- Verificați pool-ul DB, outbox lag și contention; limitați operația/dependency
  degradată, fără a pierde intentul tranzacțional.
- Recuperare: p95 sub 600 ms în segmentele afectate timp de 15 minute.

## feed_first_page_latency

- Verificați cache hit, candidate fan-out și timeout-urile rankerului; reveniți la
  rankerul deterministic sau reduceți sursele de candidates prin flag.
- Recuperare: p95 backend sub 700 ms, fără regresie de filtre safety/privacy.

## action_final_supernova_latency

- Separați `ANDROMEDA_COMPAT` de `SUPERNOVA`; verificați gateway quorum, relayer
  queue și finalitatea observată. Nu reclasificați `ORDERED` drept `EXECUTED`.
- Recuperare: p95 sub 2 s numai pentru runtime-ul Supernova confirmat.

## action_executed_success_latency

- Verificați evenimentul de execuție, callback-urile și reducer lag; activați
  fallback-ul compatibil dacă dovezile runtime diverg.
- Recuperare: p95 sub 3 s și reconciliation fără mismatch.

## chain_index_lag

- Verificați cursorul indexerului, finalitatea hyperblock și poison events;
  opriți efectele autoritative dacă event lineage nu este canonic.
- Recuperare: p95 sub 30 s și replay-ul produce aceeași stare materializată.
