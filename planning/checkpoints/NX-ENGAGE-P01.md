# Checkpoint — NX-ENGAGE-P01

## Identitate

- Task: `NX-ENGAGE-P01` — Like dislike withdrawal and viral-fair ranking state machine
- Owner: `A42`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-16`
- Cost incremental maxim implicit: `0 EUR`

## Decizia de produs

- `Like`, `Dislike/Not for me`, `Report` și `$ Support` sunt acțiuni distincte;
- dislike-ul este privat, reversibil printr-un eveniment `UNDO`, dar nu poate fi
  șters sau modificat de creatorul obiectului;
- autorul poate retrage propriul conținut, fără a rescrie istoricul: corpul dispare
  public, iar proiecția păstrează tombstone, versiune și receipt minim;
- creatorul nu poate șterge comentarii ori review-uri negative; poate cere o
  moderare motivată, iar decizia are reason code și appeal;
- dislike-ul personalizează imediat feedul actorului, dar influențează global numai
  după eșantion minim, clustere independente, confidence și anti-brigading;
- dislike-ul singur nu produce takedown, sancțiune, reputație negativă sau pierdere
  financiară pentru creator;
- conținutul nou eligibil primește exploration floor, iar paid/agent/synthetic și
  reacțiile carantinate nu pot crea trend organic.

## Moduri

- Social/Pulse/Watch/Live: `Not for me`, fără total public;
- Work: `Not relevant` pe conținut/job, niciodată dislike al persoanei/CV-ului;
- Dating: `Pass`, privat, fără reputație sau score al persoanei;
- Marketplace/Travel/Business: `Not interested`; calitatea publică vine din review
  verificat după tranzacție;
- Music/Learning/Wellness: `Less like this`, semnal personal;
- Kids: `Show me less`, local/privat, fără count public sau mecanică competitivă.

## Invariante tehnice

- event log append-only și proiecții reversibile, fără update/delete al istoricului;
- o singură reacție activă per actor, obiect și generație;
- creatorul nu are capabilitate de mutare a reacțiilor altora;
- identitatea celui care dă dislike și corelarea între profile nu sunt publice;
- acțiunile primesc receipt semnat; L1 păstrează implicit numai batch commitment,
  nu graful brut de reacții;
- toate testele sunt `SYSTEM_TEST`, locale și cu efect/cost zero.

## Implementare

- contract strict: `packages/recommendations/api/engagement-contract.v1.json`;
- ledger și ranker: `packages/recommendations/api/index.ts`;
- corpus adversarial: `packages/recommendations/api/index.test.ts`;
- validator: `planning/validate-engagement-integrity.ps1`;
- owner run preliminar inițial a fost invalidat controlat după extinderea cerinței;
- owner run final va include reacțiile expresive și `FAKE_OPINION` ca sentiment
  calificat, fără verdict factual ori takedown automat;
- zero network/provider/economic/real-fund/organic-metric effects și cost `0 EUR`.

## Următorul pas

Cele trei finding-uri T0 au remedieri implementate și validate local: ranking
order-invariant cu excluderea duplicatelor conflictuale, matrice strictă
surface–object plus tipurile profilelor în comanda semnată și alocare deterministă
de minimum 10% exploration per cohortă eligibilă. Urmează owner evidence final și
re-review independent pe closure conditions.

## Închidere

- owner evidence: `planning/evidence/NX-ENGAGE-P01-validation.json`;
- owner run: `NX-ENGAGE-P01-20260816-OWNER-FINAL03`, PASS, 167 controale,
  41 scenarii ×3;
- review: `planning/evidence/reviews/NX-ENGAGE-P01-C02-C04-C06-C08-C10.yaml`;
- verdict independent: `PASS / T0_REVIEW_SATISFIED`;
- toate cele trei finding-uri HIGH sunt `CLOSED`;
- zero network/provider/economic/organic/real-fund effects, cost `0 EUR`.
