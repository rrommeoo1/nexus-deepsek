# Nexus M6–M8 — checkpoint de închidere locală

Data: 2026-09-08  
Interval: ciclurile 251–280  
Decizie: `M6_M8_PASS_LOCAL_EXTERNAL_GATES_REMAIN_OPEN`

## Rezultat

M6, M7 și M8 sunt închise ca vertical slices executabile în demo-ul local. Nu se
pretinde paritate de producție cu OLX/Allegro, Booking/Airbnb sau Bolt și nu există
plăți ori servicii externe active.

### M6 — Fair Market

- anunțuri locale/globale, categorii, căutare și profil Market izolat;
- oferte replay-safe, un singur câștigător și quote `TEST-USDC` imuabil;
- lifecycle comandă și review numai după tranzacție finalizată;
- filtrare fail-closed pentru o listă minimă de bunuri evident interzise;
- vechiul endpoint generic de listări este retras pentru a nu ocoli controalele.

### M7 — Privacy-safe Stay

- descoperire și publicare cazare, calendar și rezervare fără suprapuneri;
- adresa exactă nu apare în discovery și este vizibilă numai participanților;
- cancel înainte de check-in, complete de host după check-out;
- review-uri double-blind până răspund ambele părți sau trec 14 zile.

### M8 — Privacy-safe Ride

- hartă interactivă locală, cu mașini marcate explicit ca sintetice;
- geolocația browserului este opțională și rămâne doar în DOM, fără persistență;
- request, acceptare cu un singur șofer, PIN hash-only, start și finalizare;
- profilul șoferului nu poate fi resetat în timpul cursei;
- toate endpoint-urile Ride sunt indisponibile în production până la configurarea
  furnizorilor aprobați de identitate, hărți, rutare și siguranță.

## Dovezi executate

- suită completă: **348/348** teste, 59 fișiere;
- inventar M6–M8: **24/24**;
- focused tests: **7/7**;
- release check: **PASS**; 1.000 actori sintetici, **0 probleme**;
- inventar citiri privacy-critical: **18/18**;
- inventar DB: 34 indexuri obligatorii, 167 totale, integrity/FK OK;
- mutation/outbox drill: **6/6**; migration/restore drill: **4/4**;
- server: `0.0.0.0:3000`, health `ready`, cost incremental/fonduri reale **0**.

Evidence Pack machine-readable:
`planning/evidence/NX-M6-M8-cycles-251-280-local-closure-v1.json`.

## Ce este vizibil în Ride și ce nu este încă real

Harta, utilizatorul și mașinile demo sunt vizibile, iar fluxul cursei este
interactiv. Mașinile sunt actori sintetici; nu sunt locații de șoferi reali.
Locații live, rutare stradală, ETA, background tracking și dispatch real cer
aplicație de șofer, consimțământ, HTTPS și provideri aprobați.

Automatizarea vizuală din browserul integrat a fost refuzată de preferința salvată
care blochează localhost. Nu s-a încercat ocolirea politicii; contractele UI și
interacțiunile rămân acoperite de testele locale.

## Gates externe rămase

1. Plăți/escrow/refund/chargeback și fiscalitate pe fiecare jurisdicție.
2. Shipping/tracking, hărți/rutare/ETA și background location.
3. Verificarea proprietăților, șoferilor, vehiculelor, asigurărilor și licențelor.
4. Teste reale pe dispozitive, geolocație, cameră și accesibilitate.
5. Operațiuni de safety/moderare și review independent security/privacy/legal.
6. Aprobări explicite pentru production, mainnet și fonduri reale.

## Următorul packet permis

M9 poate începe ca vertical slice local numai după alegerea sa din roadmap și fără
a transforma aceste gates externe în afirmații de producție.
