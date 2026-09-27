# Nexus M11 local checkpoint

Data: 2026-09-10  
Verdict: `PASS_LOCAL` pentru M11; nu este licență muzicală, certificare medicală
sau autorizare pentru bani reali/producție.

## Music

- Artiști independenți, masters audio încărcate reluabil, tracks, bibliotecă și
  playlists au fluxuri locale persistente și UI executabil.
- Publicarea locală cere ownership-ul media și declarație de drepturi. Discovery
  exclude actorii `SYSTEM_TEST`; blocarea la nivel de cont este fail-closed.
- Un start brut de redare este marcat `unqualified` și nu produce royalty. Catalogul
  comercial, clearance-ul și plățile sunt raportate explicit ca indisponibile.
- Biblioteca și istoricul de redare sunt private și nu devin semnale publice.

## Grow / Wellbeing

- Explore, pay-per-workout local, courses și progres privat au fluxuri persistente.
- Conținutul este limitat la W0/W1 educațional; W2/diagnostic/tratament este respins.
- Rezervarea locală afișează un quote `TEST-USDC` cu split 90% provider / 10% Nexus,
  fără transfer real. Un curs plătit nu devine activ înaintea unui settlement real.
- Jurnalele private sunt criptate AES-GCM pe dispozitiv; serverul stochează numai
  ciphertext, nonce și commitment, fără reutilizare pentru ads, Dating, Work sau
  reputație.

## Findings rezolvate

- `HIGH`: Music/Grow nu erau accesibile în shell-ul mobil; comutatorul de profil
  expune acum separat aplicațiile Nexus fără a încărca navigația principală.
- `HIGH`: risc de promisiune falsă privind catalogul/licențele și royalties; contractul
  API este fail-closed și marchează publicarea drept demo local.
- `HIGH`: risc de reutilizare a datelor sensibile Grow; datele private sunt owner-only,
  ciphertext-only și excluse explicit din celelalte contexte.
- `MEDIUM`: testul static folosea o versiune cache expirată; gate-ul verifică acum
  exact bundle-ul M11 servit.

## Dovezi

- `npm run audit:m11`: 17/17 `PASS_LOCAL`.
- teste M11 focalizate: 6/6, inclusiv creator sintetic exclus din discovery/rewards.
- `npm test`: 366/366.
- `npm run audit:data`: 216 indexuri, integrity/foreign keys/query plan `PASS_LOCAL`.
- `npm run release:check`: 64 fișiere de test, 1.000 actori sintetici, zero issues,
  boot izolat de producție și health check `PASS`.

M12 este următorul packet: Nexus Pay local, Creator Economy, Node Network și
verdictul integrat M1–M12. Mainnet, bani reali, providerii externi și auditurile
independente rămân gates externe.
