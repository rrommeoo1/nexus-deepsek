# Nexus Messenger — cameră reală cu preview și confirmare

2026-09-14 · packet delimitat · UNOBSERVED/YELLOW · agent principal · cost incremental 0.

## Cererea și rezultatul

Continuarea promptului pentru conversații utilizabile, nu demo inert. Precedent: `NX-MESSENGER-REAL-LAB-01.md` (conturi sintetice persistente, fotografii fictive, ore, emoji, galerie).

În acest packet s-a finalizat traseul camerei din conversația reală. Nu se declară întreg promptul finalizat. Acțiunile contextuale reply/edit/delete și prezența opt-in au nevoie de implementare de domeniu separată; nu au fost înlocuite cu controale decorative sau informații inventate.

## Implementat

- `public/composer-camera.js`: dialog local selfie implicit, comutare față/spate, fotografiere JPEG, preview, reîncercare, atașare explicită, galerie și închidere. Maximum 1920 px pe latura mare, 10 MB și sesiune de cameră 120 secunde.
- Camera cere numai video, niciodată microfon pentru fotografie. Fotografia este re-encodată prin canvas, fără transferul EXIF din sursă. Oglindirea este numai pentru preview selfie; imaginea atașată nu este oglindită.
- Nicio trimitere/upload automat. Atașarea trece prin pickerul și formularul real existente, păstrând autorizarea, transportul E2EE/consimțământul plaintext și idempotency-ul existent. Atașamentul anterior rămâne intact până la confirmare.
- Închidere X/exterior/Escape, schimbare de pagină prin popstate, submit/reset, fundal, detașare sau pierderea autorizării: stop tracks, invalidare capturi în curs, revocare object URL și cleanup listeners/observer. Focus restaurat când butonul original încă există.
- Permisiunile rezolvate după închidere nu reactivează camera. Encodingul terminat după anulare nu înlocuiește atașamentul.
- Butonul camerei și intrarea Cameră din atașamente folosesc același flux. Dacă previewul nu este disponibil, rămâne pickerul nativ și un motiv; nu pretindem preview live pe HTTP LAN.
- `composer-camera.css`: dialog adaptiv, conținut foto prioritar, controale minimum 48 px, focus vizibil, safe-area. Fără modificarea layoutului global sau a profilurilor.
- Cache entry `20260914-camera1` propagat în app → messenger-shell → composer-tools → camera. Testul de versiune statică actualizat corespunzător.

## Verificare

- 22 teste țintite PASS: composer camera/tools/shell. Șase teste de cameră includ mai multe scenarii fiecare: selfie/preview/confirmare fără submit, comutare/retry, închidere/fundal/back/revocare/leave/submit în timpul permisiunii, encoding întârziat, refuz cu galerie, Escape/exterior.
- `node --check public/composer-camera.js`: PASS.
- `npm run release:check`: PASS, 80 fișiere teste, 1.000 actori sintetici, 0 issues, health PASS, insecure_api_denied=true, isolated_data=true, external_network=false, real_funds=false, incremental_cost=0.
- Prima rulare a identificat aserțiunea de versiune veche și fixture-ul ce activa pickerul dar nu autoriza editorul. Corectate explicit; nu s-au relaxat controalele de acces.

## Neexecutat / limite

- Browserul aplicației rămâne blocat conform preferinței salvate. Nicio captură nouă, verificare fizică pe telefon, acces efectiv cameră/microfon sau apel între dispozitive nu este declarată.
- HTTPS de încredere și permisiunea dispozitivului sunt necesare pentru preview live. Nu s-au instalat certificate pe telefon și nu s-a schimbat firewallul.
- Laboratorul izolat anterior se pornește la cerere cu `node scripts/messenger-lab.mjs --serve`; acest packet nu l-a pornit și nu susține că este disponibil permanent.
- Alegerea față/spate este o preferință pentru browser; hardware-ul poate avea o singură cameră.
- Reply/react/edit/delete/forward, prezență cu acord, locked chats și acceptarea vizuală mobilă rămân deschise conform checkpointului precedent.

Următorul rezultat: reply la un mesaj real cu legătură la original și controale contextuale, autorizare la citire și teste de expirare/revocare; fără extinderea share-ului extern.
