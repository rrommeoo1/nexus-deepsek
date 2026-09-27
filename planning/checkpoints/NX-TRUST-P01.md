# Checkpoint — NX-TRUST-P01

## Identitate

- Task: `NX-TRUST-P01` — Automated Trust Lens decision and receipt proof
- Owner: `A32`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-15`
- Cost incremental maxim implicit: `0 EUR`

## Rezultat implementat

Un corpus exclusiv `SYSTEM_TEST` trece integral printr-o cascadă automată comună
pentru Social, Work, Dating, Market, Travel, Live și Kids. Motorul separă
proveniența, probabilitatea AI, dovezile factuale, safety, politica de țară și
publicitatea politică. Conținutul obișnuit cu risc scăzut se publică fără
pre-aprobare umană, iar fiecare rezultat rămâne explicabil și contestabil.

## Invariante demonstrate

- niciun scor universal de adevăr, onestitate, ideologie sau atractivitate;
- opinia, satira, predicția și afirmația factuală au clase distincte;
- niciun detector probabilistic singular nu produce singur takedown final;
- blocarea definitivă cere o potrivire de ilegalitate allowlisted și o atestare
  semnată de o autoritate independentă, legată de conținut, categorie și expirare;
- opiniile politice nu sunt inferate și nu intră în targeting;
- fiecare decizie leagă conținutul, profilul activ, țara, politica, modelele,
  motivele, expirarea și calea de contestare;
- receipt-urile au ordine SHA-256, consum one-time, checkpoint semnat și restore
  fail-closed pentru prefix, reorder, fabrication, replay și TOCTOU;
- conținutul și dovezile sensibile rămân off-chain; numai hashul receipt-ului poate
  fi ancorat într-un packet ulterior;
- procesarea locală nu produce rețea, provider, fonduri, metrici organice sau cost.

## Dovadă owner

- validator: `planning/validate-trust-lens.ps1`;
- run stabil: `NX-TRUST-P01-20260816-OWNER02`;
- așteptare: PASS, minimum 180 controale, 75 scenarii și 3 repetări identice;
- evidence pack: `planning/evidence/NX-TRUST-P01-validation.json`;
- review roles: `C01/C02/C04/C05/C06/C10`.

## Excluderi

Modelele ML reale, providerii externi, fact-check feeds, trusted-flagger endpoints,
datele reale, publicarea în producție, opiniile juridice, auditul formal, cloud/GPU,
personalul uman de apel obligatoriu și orice cost incremental rămân excluse din
acest packet local. Automatizarea primei linii nu elimină dreptul legal la apel și
supravegherea cerută pentru decizii cu impact ridicat.

## Următorul pas

Packet acceptat după review independent `PASS / T0_REVIEW_SATISFIED`.
Receipt: `planning/evidence/reviews/NX-TRUST-P01-C01-C02-C04-C05-C06-C10.yaml`,
SHA-256 `6228edc984fc1f600d6fe57e8fa3538aa69125e82fb0b9293d108e2271c6ec48`.
