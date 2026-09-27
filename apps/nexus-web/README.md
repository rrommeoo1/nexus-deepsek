# Nexus Social — local release candidate

Nexus Social este implementarea mobile-first din produsul Nexus: autentificare
wallet/email, profile independente, feed video, Stories, comentarii threaded,
reacții, follow requests, profiluri publice/private, mesagerie și preview Live.
Rulează pe Node.js cu SQLite și media content-addressed pe disk.

Acest repository este un release candidate local, nu dovada că toate verticalele
all-in-one sunt gata de producție. Broadcast-ul Live, OAuth Web2, plățile reale,
serviciile media globale și verificarea juridică externă rămân gates explicite.

## Cerințe

- Node.js `>=22.13` (Node 24 recomandat)
- npm compatibil cu versiunea Node
- spațiu local persistent pentru baza SQLite și media

Nu este necesar un serviciu cloud pentru demo-ul local.

## Pornire locală

```bash
npm install
npm start
```

Deschide `http://localhost:3000`. Pe telefon, în aceeași rețea Wi-Fi, folosește
`http://<IP-LAN>:3000`. Serverul ascultă implicit pe `0.0.0.0`.

Camera și microfonul web cer o origine sigură. HTTP prin LAN afișează intenționat
un gate; pentru testare folosește certificatul local configurat sau un HTTPS de
încredere și adaugă originea exactă în allowlist.

## Verificare

```bash
npm test
npm run actors -- --count=1000
npm run audit:reads
npm run audit:supply-chain
npm run audit:m4-m5
npm run audit:m6-m8
npm run release:check
```

`release:check` rulează local și fără fonduri: suita completă, 1.000 de actori
`SYSTEM_TEST`, migrările și o pornire production izolată într-un director temporar.
Verifică și că API-ul production refuză HTTP, iar health-check-ul nu publică
numere de utilizatori sau starea providerilor.

`audit:reads` inventariază gărzile pentru citirile privacy-critical.
`audit:supply-chain` verifică offline lockfile-ul, integrity, originile și licențele;
nu consultă o bază CVE curentă și menține un gate juridic explicit pentru
dependențele copyleft.

Pentru o verificare manuală E2EE pe un browser/dispozitiv real, setează numai în
development `NEXUS_DEVICE_LAB=true`, pornește aplicația prin HTTPS de încredere și
deschide `/diagnostics/e2ee-device-lab`. Harness-ul nu este disponibil în
production, nu face requesturi proprii, nu persistă și nu exportă chei/ciphertext;
raportul descărcat conține numai clasa de dispozitiv aleasă manual, dimensiuni,
timpi și controale boolean. Un PASS local nu înlocuiește auditul criptografic.

`npm run audit:e2ee:inventory` emite un inventar local legat prin SHA-256 de
sursele E2EE curente, familiile de protocol, markerii de implementare izolați pe
fiecare construcție, limitele
de încredere și proprietățile care nu sunt pretinse. Comanda nu folosește rețea
sau fonduri și eșuează dacă lipsește un marker. Inventarul pregătește, dar nu
înlocuiește, auditul criptografic formal independent.

## Stare funcțională

- autentificare email cu wallet MultiversX creat și criptat în browser;
- xPortal/NativeAuth cu project/origin attestation;
- profile Social/Work/Dating/Travel/Market izolate prin Privacy Matrix;
- upload media reluabil, checksum, quarantine și Outbox idempotent;
- feed Social, Clips fullscreen, Stories, reactions/dislike, replies și saves;
- profil public/privat, follow requests, avatar/cover/bio per persona;
- inbox unificat, direct/grup, request states, E2EE text și atașamente device-covered;
- inventar E2EE coarse în Account Center; revocarea cheii cere password/xPortal
  step-up, este replay-safe și nu transferă retroactiv istoricul unei chei noi;
- apel direct WebRTC local și meetings, cu capability gates;
- Live Device Check și preview privat; broadcast public blocat fără SFU;
- actori sintetici excluși permanent din ranking, Sigil și economie;
- share extern dezactivat; distribuirea rămâne în Nexus.
- shell mobil instalabil (manifest, safe areas, fără Service Worker/cache pentru
  datele protejate), SSE profile-bound și provider local media atomic;
- Nexus Work: profil profesional separat, joburi, aplicări și notificări;
- pagini Business/Beauty, servicii, sloturi și programări concurent-safe, exclusiv
  `TEST-USDC`/`LOCAL_DEMO_NO_PAYMENT` în build-ul local.
- Nexus Market: anunțuri clasificate locale/globale, categorii, oferte cu un singur
  câștigător, comenzi și review-uri legate de tranzacție; fără plăți sau livrare reală.
- Nexus Stay: descoperire, ofertă de cazare, calendar, rezervare fără suprapuneri,
  adresă exactă vizibilă numai participanților și review-uri double-blind.
- Nexus Ride: hartă demo cu mașini sintetice, cerere, acceptare, PIN de pornire și
  lifecycle complet; coordonatele reale, rutarea, ETA și verificarea șoferului sunt
  refuzate în production până la configurarea providerilor aprobați.

## Date și migrări

În development, datele sunt în `data/`. În production, `NEXUS_DATA_DIR` trebuie să
fie o cale absolută pe volum persistent și inclusă într-o politică de backup.
Schema și migrările additive sunt aplicate la pornire; fă backup înaintea unui
upgrade și verifică `PRAGMA integrity_check` prin release gate.

Nu copia seed phrase, chei private sau credențiale reale în repository. Nexus nu
oferă export server-side de seed phrase; recuperarea cross-device este prin xPortal.
Cheile private E2EE rămân în storage-ul sigur al browserului. Revocarea unui
dispozitiv este definitivă; build-ul nu pretinde backup/sincronizare a cheilor.
Atașamentele E2EE sunt criptate în browser și încărcate resumable ca un container
opac versionat. Serverul poate verifica integritatea ciphertextului și ACL-ul, dar
nu poate scana malware conținutul; de aceea fișierul nu se deschide automat și UI
afișează avertismentul înaintea decriptării locale.

## Export și ștergere cont (GDPR)

- `POST /api/account/export` cere step-up (parolă sau xPortal) și generează un export JSON allow-list, autentificat, valabil 15 minute. Sunt excluse parolele, provider subjects, keystore/seed/private keys, tokenurile de sesiune, amprentele dispozitivelor și datele private ale altor persoane.
- `POST /api/account/deletion-request` cere step-up, textul exact `DELETE NEXUS` și confirmarea permanenței on-chain. Contul intră într-o perioadă de grație de 30 de zile; celelalte sesiuni sunt revocate și mutațiile sociale/economice sunt blocate.
- `POST /api/account/deletion-cancel` anulează în perioada de grație. Un legal hold activ blochează purge-ul fail-closed fără a expune motivul sensibil.
- `npm run account:purge:dry-run` raportează numai numărul cererilor eligibile și nu modifică date. Execuția reală cere simultan `--execute`, `NEXUS_ACCOUNT_PURGE_EXECUTE=1` și un approval ID scoped `NX-GDPR-PURGE-*`; nu se rulează asupra demo-ului fără autorizare explicită.
- Purge-ul elimină media content-addressed înainte de finalizarea tranzacției DB, lasă un tombstone fără PII și păstrează conversațiile comune transferând ownership-ul unui participant rămas. Datele deja confirmate pe blockchain nu pot fi șterse de Nexus.

## Incident containment și recovery drill

- `npm run incident:status` este read-only și afișează controalele locale. Pause/resume este disponibil numai prin CLI explicit, cu approval `NX-INC-*`; resume cere maker-checker distinct.
- `npm run recovery:drill` creează, salvează și restaurează numai o bază sintetică temporară, compară state hash/integrity/foreign keys și nu deschide baza demo.
- Procedura, severitățile, rolurile și limitele legale sunt în `docs/incident-and-recovery-runbook.md`. Un test local reușit nu demonstrează backup regional, on-call sau conformitate production.

## Action Ledger și reconciliere

- Orice mutație API autentificată finalizată cu succes produce exact un `ActionIntent` și un eveniment Outbox în același savepoint cu registrul de idempotency. Conținutul, mesajele, emailurile, locațiile și identificatorii de wallet nu intră în envelope; sunt păstrate doar commitments SHA-256.
- Acțiunile `SYSTEM_TEST` au starea `EXCLUDED_SYNTHETIC`, iar typing/read/impressions au `EPHEMERAL_EXCLUDED`. În build-ul local, celelalte intenții rămân `LOCAL_ACCEPTED_CHAIN_DISABLED`; publicarea Outbox nu trimite tranzacții și nu poate declara `CONFIRMED`.
- `npm run action:reconcile` verifică read-only corespondența mutație–intenție–Outbox și forma dovezilor locale/devnet. Reparația derivată cere simultan scriptul `action:reconcile:repair` și `NEXUS_ACTION_RECONCILE_REPAIR=1`; nu folosește rețeaua, fonduri sau date în clar.
- Un rezultat local `PASS` dovedește consistența proiecției locale, nu finalitatea MultiversX. Confirmarea on-chain va necesita relayer/indexer, receipt final și reconciliere separată aprobate pentru mediul respectiv.

## Configurare production

1. Copiază `.env.example` într-un secret store sau într-un `.env` necomis.
2. Setează `NODE_ENV=production` și un `NEXUS_SESSION_SECRET` aleator de minimum
   32 de caractere.
3. Configurează `NEXUS_ORIGIN` HTTPS și originile exacte pentru NativeAuth și
   WalletConnect Dashboard.
4. Configurează un edge HTTPS de încredere care suprascrie headerele forwarded,
   blochează accesul direct la proces și aplică rate limiting distribuit; numai
   atunci setează `NEXUS_RATE_LIMIT_MODE=trusted-edge` și `NEXUS_TRUST_PROXY=1`.
5. Setează `NEXUS_DATA_DIR` la un volum absolut, persistent și monitorizat.
6. Setează explicit `NEXUS_MEDIA_STORAGE_PROVIDER=local-content-addressed` pentru
   un singur nod; un provider distribuit cere implementare și audit separat.
7. Rulează `npm run release:check`, apoi `npm start`.
8. Monitorizează `GET /health`; în production răspunsul este intenționat minimal.

Procesul refuză să pornească în production dacă lipsesc secretul, HTTPS origin,
attestation WalletConnect, trusted-edge gate sau calea persistentă de date.

## Gates externe încă necesare

- certificat/domeniu production și edge rate limiter verificat;
- WalletConnect Project ID și origin allowlist reale;
- SFU/ingest, transcoding, CDN și moderare pentru Live/video la scară;
- object storage distribuit, push provider și testare pe dispozitive reale;
- plăți/depozite reale pentru Jobs/Business/Beauty; build-ul local nu mută fonduri;
- plăți/escrow/refund, shipping/tracking, hărți/rutare/ETA, background location,
  verificarea proprietăților, șoferilor și vehiculelor pentru Market/Stay/Ride;
- audit independent T0/T1, privacy/Kids/18+ și consultanță juridică pe piețele de
  lansare;
- provideri OAuth și plăți numai după contracte, privacy review și aprobarea de cost.

Până la închiderea acestor gates, nu eticheta build-ul local drept lansare publică.
