# Checkpoint — NX-BIZ-P01

## Identitate

- Task: `NX-BIZ-P01` — One salon slot and deposit proof
- Owner: `A34`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un business sintetic publică un serviciu și un slot de salon. Două rezervări
concurente pentru același slot produc exact un câștigător confirmat și un refund
exact pentru cererea pierzătoare, fără bani reali sau servicii externe.

## Felie de implementare

- pagină business și service commitment fără PII on-chain;
- slot versionat, calendar off-chain și lock/CAS determinist;
- deposit intent plafonat, token exclusiv de test și valoare reală zero;
- exact un booking confirmat pentru slotul unic;
- cererea concurentă pierde fără liability reziduală și primește refund exact;
- state machine, replay/restart, substituție, roluri și reconciliere testate local;
- actori `SYSTEM_TEST`, zero rețea/provider/economic/cost.

## Gates și excluderi

- dependențele `NX-PROFILE-P01`, `NX-MOD-P01`, `NX-CHAIN-001` și
  `NX-CHAIN-002` sunt acceptate;
- packet-ul cere review independent C03/C05/C10 înainte de `done`;
- plăți reale, mainnet, salon real, calendar/provider extern, taxe, KYC și opinie
  juridică formală rămân excluse.

## Stare curentă

Implementarea owner este completă. Primul review independent a returnat
`CHANGES_REQUIRED` cu patru findings HIGH: controller boundary, binding complet al
deciziei service, quote one-time și restore/checkpoint cu reconstruirea slotului.
Toate au fost remediate și închise. Verdict final T1: `PASS`, binding 23/23,
validator independent 104/104 și 23 scenarii repetate de trei ori, subject
`aad863ef37012212e429119aabe70a0ce54e0c5523e79ba752c0de29fc8197c2`.
Receipt: `planning/evidence/reviews/NX-BIZ-P01-C03-C05-C10.yaml`, SHA-256
`d4085635a91525d0090a9bfc8d0d08f5f86ab297498939c7bed6c981548ccb33`.
