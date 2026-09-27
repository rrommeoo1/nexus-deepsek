# Nexus 3100 — disponibilitate locală persistentă

2026-09-14 · cerere explicită owner: 3100 ca mediu de lucru pe Wi-Fi, contul existent.
Capacitate UNOBSERVED/YELLOW: un singur agent, packet local, cost incremental 0.

## Implementat

- Launcher separat pentru utilizare umană: `apps/nexus-web/scripts/messenger-workspace.mjs`.
  Același `server.js`, aceeași bază izolată, fără seed/reset/parole noi ori conturi
  sintetice transformate în utilizatori reali. Nu există temporizator de două ore.
- Mediu whitelist fără .env/provideri/billing moșteniți; port HTTP 3100, HTTPS 3543.
  Node heap 384 MiB; director de date plafon 256 MiB, verificat la 30 secunde;
  jurnal operațional plafon 1 MiB. Datele nu sunt șterse la atingerea plafonului.
- Task Windows `Nexus Messenger 3100`: cont Romeo, Interactive/Limited, la login,
  fără termen de execuție, IgnoreNew. Trigger suplimentar de recuperare la minut.
  Serverul rulează în procesul taskului, fără copil rămas orfan.
- Document de operare `apps/nexus-web/docs/messenger-workspace.md`, cu pornire,
  oprire/dezactivare, limite de acces, HTTP vs HTTPS și date fictive vs backend real.
- Procesul temporizat 21432 / copil 17316 a fost identificat după comandă și
  proprietatea portului, apoi înlocuit. Procesul original 3000 PID 5368 neatins.

## Findings și verificări

- HIGH disponibilitate: termenul de 7200 secunde oprea mediul uman. Eliminat numai
  în launcherul persistent; simulările păstrează 600 secunde implicit / maximum 7200.
- MEDIUM recuperare: RestartCount=3 / interval 1 min nu a recuperat pe acest host
  procesul terminat extern. Nu s-a presupus că setarea este dovadă. Adăugat trigger
  periodic, apoi testat printr-o nouă terminare controlată: restart automat la
  20:53:06 Europe/Warsaw, PID 11908, fără start manual.
- Health prin IP-ul Wi-Fi HTTP 200 și login real cu `lab_tester@nexus.test` HTTP 200
  înainte și după recuperare. Nicio parolă/cookie/token în jurnalul dovezilor.
- Înainte și după: 3 utilizatori, 13 mesaje, digest de credențiale identic.
- Pornire repetată cu serverul activ: același PID, fără dublare de proces.
- 7 teste țintite PASS: izolare env/porturi, refuz producție, configurație invalidă,
  seed idempotent și privacy, autentificare reală, jurnal/disk, limite ale simulării.
- `npm run release:check`: PASS, 82 fișiere, 1000 actori, 0 issues; health PASS,
  insecure_api_denied=true, isolated_data=true, external_network=false, cost 0.
- Task instalat și lăsat Running; LAN 192.168.1.153 verificat. Nu s-au modificat
  firewall/router/DHCP, politicile de repaus sau abonamentele.

## Limite / următorul pas

Laptopul trebuie să fie pornit, autentificat în Windows, treaz și pe același Wi-Fi.
Reboot/login real și accesul fizic de pe telefon nu au fost testate. IP-ul se poate
schimba prin DHCP. Defecțiunile de sistem/stocare nu sunt acoperite de o garanție 24/7.
HTTP 3100 nu oferă un context securizat pentru cameră/apeluri/E2EE; HTTPS 3543
necesită încredere în certificatul local pe dispozitiv. Nu se pretinde producție.

Următoarele îmbunătățiri funcționale se fac în acest mediu, pe același cod.
Incidentul real xPortal rămâne deschis; acest packet verifică accesul cu email,
nu pretinde că repară autentificarea wallet sau că toate funcțiile mesageriei sunt gata.
