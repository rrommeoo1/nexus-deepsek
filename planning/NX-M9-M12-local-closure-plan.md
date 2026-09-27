# Nexus M9–M12 — plan unic de închidere locală

Data: 2026-09-08  
Scope: demo local, cost incremental `0`, fără fonduri reale sau servicii externe  
WIP: un singur milestone implementat și verificat la un moment dat

Status la 2026-09-10: M9, M10 și M11 sunt `PASS_LOCAL`; M12 este packet-ul activ.

## Definiția milestone-urilor

### M9 — Dating sigur și frontieră Privé 18+

- profil Dating independent, 18+, cu intenție, preferințe mutuale și zonă aproximativă;
- discovery eligibil numai după Privacy Matrix și compatibilitate bilaterală;
- pass/like replay-safe, match numai după like reciproc și unmatch/block fail-closed;
- Dating Trust Passport descriptiv, fără „desirability/seriousness score” numeric;
- plan de întâlnire cu zonă aproximativă, PIN hash-only și acces doar participanților;
- Privé rămâne safe synthetic preview: fără media explicită, plăți sau live public până
  la age assurance, country policy, consent, safety și review juridic independente.

### M10 — Watch, Live și Kids

- Watch: canale, video long-form, playlists, subscriptions și continue-watching;
- Live: programare, preview și lifecycle local; broadcast public rămâne blocat fără
  ingest/SFU/moderare/capacity provider;
- Kids: sesiune separată administrată de părinte, age-band, catalog allow-listed,
  timer și zero mesaje publice, ads comportamentale sau plăți;
- drepturile media, audience și policy se verifică înainte de discovery/playback.

### M11 — Music și Grow

- Music: artiști independenți, tracks cu rights declaration, playlists și listening
  history privat; fără promisiunea unui catalog Spotify/licențe inexistente;
- Wellbeing: business/gym, sesiuni și pay-per-workout local fără plată reală;
- Nutrition/Learn: conținut educațional, cursuri și progres privat, fără diagnostic,
  treatment claims sau transfer de health data spre ads/Dating/reputație.

### M12 — Pay, Creator Economy și Node, apoi closure integrată

- Nexus Pay: rezolvare username existentă plus quote/intent/receipt local, fără
  semnare ori settlement real; exact recipient/network/token binding;
- Creator: support/membership/royalty ledger local în `TEST-USDC`, cu split explicit,
  fără reward pentru like, bots ori trafic sintetic;
- Node: health, event commitments, checkpoint/backup evidence și provider contract
  pentru tranziția de la un nod la mai multe, fără falsă descentralizare;
- inventar M1–M12, suită completă, actori sintetici, privacy/outbox/restore și
  Evidence Pack final pentru verdictul `READY_LOCAL` sau `NOT_READY_LOCAL`.

## Ce înseamnă `READY_LOCAL`

`READY_LOCAL` înseamnă că toate verticalele au un flux local demonstrabil, stări
persistente, validări, autorizare, idempotency/outbox, UI și teste. Nu înseamnă:

- publicare în producție sau disponibilitate cu laptopul oprit;
- bani reali, mainnet, escrow, payout, refunds ori fiscalitate;
- conținut adult public, servicii Kids publice sau live la scară;
- hărți/GPS/rutare, licențe muzicale, KYC/liveness ori device attestation reale;
- audit security/privacy/crypto/accessibility ori opinie juridică independentă.

## Gate de execuție

Fiecare milestone primește inventar de acceptanță executabil și Evidence Pack.
M10 nu se declară închis înainte ca M9 să treacă; aceeași regulă se aplică până la
M12. Orice provider extern sau plată rămâne `default_deny_spend`.
