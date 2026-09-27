# Checkpoint — NX-ECON-P01

## Identitate

- Task: `NX-ECON-P01` — Free-like, paid-support and useful-node economics contract
- Owner: `A43`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un contract economic versionat și o simulare deterministă demonstrează că engagementul
obișnuit rămâne utilizabil, suportul financiar este voluntar și separat, creatorii și
nodurile primesc numai bugete finanțate, iar treasury nu poate deveni negativă.

## Packet delimitat

- Like/Comment gratuit și buton separat `$ Support`;
- sponsorship/queue/pay-own-gas fără blocarea aplicației;
- creator pool pe qualified engagement, fără plată fixă per like/comment;
- tips, subscriptions și Privé splits configurabile cu fee caps;
- topuri organic, supporter și promoted complet separate;
- proof-of-useful-service și settlement periodic pentru noduri;
- privacy, age/consent, country și legal gates pentru Privé;
- handoff Nexus Pay: stablecoin/EGLD către username, fără custody implicită.

## Remedierea review-ului T0

- intrări runtime exact-shape; literal booleans, enums și bigint, cu refuz pentru
  extra/missing/accessor/Proxy și valori truthy ambigue;
- configurație copiată, deep-frozen și legată prin config hash/version;
- atestări semnate pentru unique-human, risk cluster, supporter/device/wallet și
  node-owner cluster; cap-urile se agregă după principal stabil, nu alias;
- snapshot de buget semnat; target 5% și hard cap 8% calculate în policy;
- capabilitate Privé semnată, neexpirată și default-deny pentru toate cele nouă gates;
- capabilitate Privé legată exact de profil, țară, allocation ID și quote/settlement;
- config hash allowlisted pe conținut, fereastră activă verificată la fiecare calcul,
  inclusiv budget/CreatorPool/NodePool, și
  output legat de epoch/effective date/version;
- deduceri tipizate cu receipts și lifecycle freeze/release/reversal;
- ledger de claims cu reserve-before-claim, store atomic, cheie derivată și replay
  refuzat în instanță nouă și după snapshot/restore.

## Dovezi owner după remediere

- validator local: `PASS`, `131/131` controale;
- scenarii TypeScript: `98/98`, repetate determinist de trei ori;
- simulări: Sybil 1/10/40%, 20 aliasuri creator, 8 aliasuri node owner,
  chargeback 1/5/15% Core și Privé, gas target/hard cap, fiecare gate 18+,
  duplicate/concurrent-equivalent claim și restore/replay;
- zero network, provider, tranzacție, fond real sau cost incremental.

## În afara scope-ului curent

- fonduri reale, mainnet, procesator extern ori termeni comerciali acceptați;
- opinie juridică formală sau aprobarea unui acquirer/card network;
- certificarea adaptorului DB distribuit și exact-once în producție;
- promisiuni de APR, venit ori profit și token Nexus transferabil.

## Verdict final

Review independent T0: `PASS`; toate cele șase findings sunt `CLOSED`. Receipt:
`planning/evidence/reviews/NX-ECON-P01-C03-C05-C08-C10.yaml`. Adaptorul DB distribuit,
producția, fondurile reale și validarea juridică externă rămân gates ulterioare.
