# Checkpoint — NX-CHAT-P01

## Identitate

- Task: `NX-CHAT-P01` — One-to-one encrypted private action proof
- Owner: `A14`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Două identități sintetice creează un canal 1:1, schimbă ciphertext end-to-end și
înregistrează pe chain/action ledger numai un commitment generic `PRIVATE_ACTION`,
fără plaintext, ciphertext, participanți ori metadate sensibile în envelope-ul
public. Blocarea globală trebuie aplicată înainte de send/read.

## Felie de implementare

- contract exact-shape pentru device/channel/session și private action commitment;
- ciphertext exclusiv off-chain, chei exclusiv client-side în fixture;
- ACL legat de profilul activ, device și generație de sesiune;
- block/moderation înainte de send, delivery și read;
- replay/restart și tombstone determinist fără scurgerea payloadului;
- actori `SYSTEM_TEST`, local mock only, zero rețea/provider/economic/cost.

## Gates

- `NX-PROFILE-P01`, `NX-MOD-P01`, `NX-AUTH-001`, `NX-PLAT-001`,
  `NX-CHAIN-001` și `NX-CHAIN-002` sunt acceptate;
- packet-ul cere review independent C01/C02/C04 înainte de `done`;
- Matrix/provider real, chei reale, date personale, push, producție, mainnet și
  auditul criptografic formal rămân excluse.

## Stare curentă

Felia locală este completă în `packages/messaging/api`: capability 1:1 legată de
profil activ, generație, device și key epoch; decizia separată a policy engine-ului
este semnată și legată exact de operație. Lifecycle-ul SENT→DELIVERED→READ→TOMBSTONED
aplică block/audience/device înainte de send/delivery/read, iar tombstone-ul rămâne
disponibil după block. Participant pair-ul și destinatarul SEND sunt fixate în
lineage-ul privat, fără expunere în proiecția publică. Rotația promovează atomic
device-ul și key epoch-ul curent, invalidează capability-ul vechi și este păstrată în
jurnal. Checkpoint-ul reconstruiește aceste legături și replay denial după restart. Fixture-ul
execută un `PRIVATE_ACTION` prin sandbox-ul chain existent și îl reduce la
`EXECUTED_SUCCESS` cu reconciliation `PASS`, fără target, message ID, nonce ori
ciphertext pe chain. După review-ul `CHANGES_REQUIRED`, finding-urile
`C02-CHAT-P01-001` și `C02-CHAT-P01-002` au fost remediate local. Validatorul owner
trece cu minimum 41 assertions și trei repetări deterministe, zero boundary finding,
credentials, rețea, provider, efect economic sau cost. Packet-ul așteaptă re-review
independent C01/C02/C04/C06; Matrix/provider, cheile și mesajele reale, push,
persistența de producție, mainnet și auditul criptografic formal rămân excluse.
Re-review-ul independent C01/C02/C04/C06 este `PASS`, cu 127/127 controale,
41 scenarii repetate de trei ori și zero findings deschise.
