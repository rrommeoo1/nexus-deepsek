# Checkpoint — NX-DATING-P01

## Identitate

- Task: `NX-DATING-P01` — Isolated candidate and private commitment proof
- Owner: `A33`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un candidat adult sintetic parcurge un flow Dating izolat, iar swipe/match produce
un commitment privat fără target, preferințe, orientare, locație sau date de safety
în loguri, payload public ori tranzacție.

## Felie de implementare

- adult/identity/liveness claims compacte și verificabile, fără raw KYC;
- Dating profile izolat de Work/Social/Search și commitment local salted;
- candidate discovery cu filtre private numai on-device/service-isolated;
- swipe și match commitment prin endpoint `PRIVATE_ACTION`;
- target/preference/location absent din envelope, event și log scanner;
- profile/capability generation, block/revoke, replay și restore fail-closed;
- actori `SYSTEM_TEST`, zero rețea/provider/economic/cost.

## Gates și excluderi

- dependențele Profile, Chat, Moderation, Security și Chain sunt acceptate;
- review independent C02/C04/C06/C08 este obligatoriu înainte de `done`;
- utilizatori/date reale, KYC/liveness extern, producție, mainnet și opinie juridică
  formală rămân excluse.

## Stare curentă

Packet acceptat T0. Validarea finală a trecut 120 controale și 26 scenarii repetate
de trei ori. Review-ul C02/C04/C06/C08 a închis toate cele patru findings, fără
constatare nouă; receipt SHA-256 `35f27141ba53887bcc4b21b5cffcc35aaacee5ef2c170c5e93bf6c58a062ade1`.
