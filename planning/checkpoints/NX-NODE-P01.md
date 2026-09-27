# Checkpoint — NX-NODE-P01

## Identitate

- Task: `NX-NODE-P01` — Genesis node backup and deterministic restore
- Owner: `A16`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un singur Genesis Node local procesează un corpus fixture, exportă un checkpoint
autentificat, este eliminat exclusiv din runtime-ul efemer și este restaurat într-o
instanță nouă cu același state root și același rezultat de replay.

## Felie de implementare

- manifest D0 și identitate de nod fixture;
- event log append-only cu reducer determinist și versiune explicită;
- state root SHA-256 canonical, range și checkpoint head;
- export semnat local, exact-shape și restore fail-closed;
- replay index durabil, prefix/reorder/fabrication/tamper denial;
- backup atomic modelat local și probă fresh-instance;
- zero rețea, provider, fonduri reale și cost incremental.

## Gates și excluderi

- dependențele Architecture, Platform, Chain, Security și Observability trebuie să
  aibă evidence PASS;
- review independent C02/C03/C09/C13 este obligatoriu înainte de `done`;
- rețea P2P reală, porturi publice, cloud, mainnet, date reale, disk durability de
  producție și N=2..8 rămân în afara acestui packet.

## Stare curentă

Contractul D0, event log-ul semnat, reducerul, state root-ul, checkpoint-ul și
restore-ul fresh-instance sunt implementate. Auditul owner a închis două gap-uri
T0 înainte de review: mutațiile asincrone sunt serializate într-un singur hash
lineage, iar backup-ul validează înainte de commit, după care runtime-ul sursă este
dispus explicit și refuză orice operație. Review-ul C13 a detectat și owner-ul a
remediat `C09-NODE-P01-001`: backup-ul captează acum o singură reprezentare
canonică înainte de primul `await`, fără a reciti obiectul mutabil al apelantului.
Testul local curent trece 46 de aserțiuni de trei ori identic, inclusiv mutație
concurentă a checkpoint-ului, input cu getter, 24 append-uri concurente și duplicate
exactly-once, cu state root
`fc62d1354775779e0120c3861d3f67f28d17ff9cf778095005e12f166e68d98f` și
checkpoint hash
`a7422ae254f0727c3b2c16383c3ba3f7ef93b698192cb027f0c5aff6d6c66819`.
Revalidarea owner finală a trecut `151/151` controale și `46` scenarii, fiecare în
trei repetări deterministe. Review-ul independent C13 a închis
`C09-NODE-P01-001` fără finding nou și a emis `PASS`; receipt-ul este
`planning/evidence/reviews/NX-NODE-P01-C02-C03-C09-C13.yaml`, cu SHA-256
`de7f4a84311e6788bd483c07651f6290bb4aa5741d23dd613dad445d5bfd125c`.
Packet-ul este acceptat numai pentru fixture-ul local D0; limitele de producție și
simularea `N=2..8` rămân explicit în afara acestei acceptări și trec în
`NX-NODE-P02`.
