# Checkpoint — NX-MOD-P01

## Identitate

- Task: `NX-MOD-P01` — Common report block and appeal contract
- Owner: `A32`
- Risc: `T0`
- Stare: `review`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un contract versionat de moderare aplică aceeași mașină de stare pentru report,
block și appeal pe suprafețele Social și Marketplace, fără scurgerea conținutului
raportat în audit trace și fără ca actorii sintetici să afecteze producția.

## Felie de implementare

- envelope exact-shape pentru report, block, evidence commitment și appeal;
- tranziții fail-closed, idempotency și replay/restart determinist;
- separarea reporterului, subjectului, moderatorului și appeal reviewerului;
- urgență P0 cu containment, expiry și trasabilitate minimă;
- aceleași reguli pentru Social și Marketplace;
- actori `SYSTEM_TEST`, local mock only, zero rețea/provider/economic/cost.

## Gates

- dependențele `NX-CONTRACT-001`, `NX-SEC-001` și `NX-OBS-001` sunt acceptate;
- packet-ul cere review independent C01/C04/C06 înainte de `done`;
- producția, datele reale, clasificarea externă, raportarea legală și auditul formal
  rămân excluse.

## Stare curentă

Felia locală este completă în `packages/moderation/api`: contract v1, aceeași mașină
report/action/appeal pentru Social și Marketplace, account block comun și semnat,
containment P0 cu expiry înainte de decizia finală, separarea moderator–appeal
reviewer și audit trace numai cu commitments. Finding-ul `C04-MOD-P01-001` a fost
remediat: containment-ul expirat este refuzat atât la înregistrare, cât și înaintea
deciziei finale, iar replay-ul istoric folosește timpul semnat al evenimentului.
Jurnalele case/block sunt verificate
prin checkpoint, reconstruiesc integral starea și păstrează replay denial după
restart. Validatorul owner `NX-MOD-P01-OWNER-PREVIEW02` este `PASS`: 98 controale,
40 assertions și trei repetări deterministe, fără boundary finding, credentials,
rețea, provider, efect economic sau cost. Packet-ul așteaptă review independent
C01/C04/C06; producția, datele reale, clasificarea externă, evidence-vault provider,
raportarea legală și auditul formal T&S rămân explicit excluse.
