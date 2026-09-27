# Checkpoint — NX-NODE-P02

## Identitate

- Task: `NX-NODE-P02` — Deterministic mesh replication churn and repair
- Owner: `A16`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-15`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

O simulare exclusiv locală crește rețeaua de la un Genesis Node la opt noduri,
alege determinist `R=min(N,3)`, converge după churn și repair și reconstruiește
același catalog root și aceeași linie de receipts într-o instanță nouă.

## Felie de implementare

- join permissionless sintetic, fără wallet, bond ori tranzacție;
- rendezvous placement determinist și diversitate de failure-domain când există
  suficiente domenii eligibile;
- replicare, stare `UNDER_REPLICATED`, anti-entropy și repair la un nod nou;
- receipts locale autentificate și reconciliation fail-closed;
- snapshot/restore exact-shape, replay, prefix, reorder și tamper denial;
- rollback atomic pentru publish și repair cu fault injection;
- probe exhaustive pentru `N=1..8`, churn, repair și izolare `SYSTEM_TEST`;
- zero rețea, provider, fonduri reale, reward, port public sau cost incremental.

## Dovezi owner

- validator: `planning/validate-node-mesh.ps1`;
- run final de sigilat: owner validation după remedierea review-ului T0;
- control run remediere: `NX-NODE-P02-20260815-REMEDIATION01`, `PASS`;
- controale: `163/163`;
- scenarii: `122/122`, identice în trei repetări;
- fixture-uri: toate valorile `N=1..8`, cu replica target `1,2,3,3,3,3,3,3`;
- efecte: `0` network, provider, economic, real funds, rewards și cost incremental.

## Gates și excluderi

- dependența `NX-NODE-P01` are owner evidence și review independent `PASS`;
- review independent C02/C03/C09/C10/C13 este obligatoriu înainte de `done`;
- libp2p real, DHT/GossipSub, storage extern, cloud, public ports, mainnet,
  settlement real, hardware heterogen și SLA de producție rămân excluse.

## Stare curentă

Implementarea și probele owner sunt complete. Prima verificare T0 a găsit două
lacune de lineage: eliminarea coordonată a tuturor receipts și mutarea unui receipt
înainte de join/publicare. Restaurarea cere acum istoric nenul pentru fiecare obiect,
epoch-uri monotone și `receipt.placementEpoch >= joinedAtEpoch/publishedAtEpoch`.
Regresiile dedicate trec. Packetul rămâne în `review`; nu se deschide alt packet
până când subjectul content-addressed remediat nu primește verdict independent T0.
Review-ul C13 `NX-NODE-P02-20260815-C13-INDEPENDENT01` a trecut `163/163`
controale și `122/122` scenarii în trei repetări, a confirmat toate cele 18 hashuri
și a închis ambele observații fără finding nou. Receipt-ul
`planning/evidence/reviews/NX-NODE-P02-C02-C03-C09-C10-C13.yaml` are SHA-256
`fd5ebd3eefd09d973c0acf58ae805bdd0cf21ab270169e10a0bf0c6a70587452`.
Acceptarea rămâne limitată la mesh-ul local determinist și excluderile declarate.
