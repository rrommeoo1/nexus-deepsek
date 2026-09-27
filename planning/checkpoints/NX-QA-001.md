# Checkpoint — NX-QA-001

## Identitate

- Task: `NX-QA-001` — Test fabric and first cross-layer E2E
- Owner: `C01`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un traseu sintetic, local și determinist leagă un client de contractul API și un
worker, păstrează același trace ID, produce dovezi legate de cerință și demonstrează
că actorii `SYSTEM_TEST` nu pot afecta metrici organice, reputație sau plăți.

## Packet delimitat

- catalog de fixtures și taxonomie pentru unit, contract, integration și E2E;
- runner local cu limite de timp, procese, disk și zero egress;
- primul E2E client → API/outbox → worker cu trace verificabil;
- registru pentru flake-uri, fără carantinarea testelor release-critical;
- izolarea deterministă a actorilor sintetici de economie și metrici;
- Evidence Pack și review independent înainte de `done`.

## În afara scope-ului curent

- device farm, provideri cloud ori servicii contorizate;
- trafic, date, credențiale sau metrici de producție;
- mii de modele LLM; scala va folosi actori logici locali.

## Următoarea acțiune

Packet închis. Succesor activ: `NX-ECON-P01`.

## Progres implementat

- contract de calitate v1 cu taxonomie `UNIT/CONTRACT/INTEGRATION/E2E`;
- harness local `CLIENT → API → OUTBOX → WORKER`, cu trace și requirement ID unic;
- replay-ul aceleiași cereri este refuzat, iar worker-ul execută o singură dată;
- failure evidence leagă testul de cerință, artefact, trace și owner;
- flake-ul este detectat pentru același input și artifact, iar un test
  `RELEASE_CRITICAL` nu poate fi pus în carantină;
- actorii `SYSTEM_TEST` folosesc numai wallet fixtures și nu pot produce payout,
  metrică organică, reputație ori review;
- testele TypeScript au `61/61` assertions și trei repetări identice;
- requirement resolver-ul refuză path inexistent, requirement lipsă, owner substituit
  și hash stale; failure evidence include `artifactHash` și outcome explicit;
- carantina normală este evaluată determinist înainte, la și după expirare;
- idempotency fixture-ul tranzacțional păstrează replay denial între instanțe și
  acoperă crash înainte și după commit-ul worker-ului;
- primul review independent a cerut aceste remedieri în receipt-ul
  `NX-QA-001-C11-C12.yaml`; un retest independent nou este obligatoriu;
- validarea owner remediată a trecut `110/110` controale și `61/61` scenarii în
  trei repetări identice, cu zero network, provider, efect economic și cost incremental;
- urmează retestul independent al subjectului remediat.

## Decizie independentă finală

- verdict `PASS`, toate cele trei findings închise;
- receipt: `planning/evidence/reviews/NX-QA-001-C11-C12.yaml`;
- SHA-256: `5c92a6ef0b4ac10ca259805c1382d4c6cfb2bef285d89ef2d73fe6a1f087288f`;
- `15/15` hashuri, `110/110` controale și `61/61` scenarii × 3;
- producția distributed exactly-once și provenance catalog de producție rămân excluse.
