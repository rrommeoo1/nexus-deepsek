# P0H-031 — sunet clar și preferință robustă

2026-09-14 · continuare heartbeat · un packet, agent principal, UNOBSERVED/YELLOW. Fără backend, servicii externe, cost sau migrări.

## Finding și corecție

High: `readSocialMuted()` revenea mereu la true când localStorage era inaccesibil, iar `writeSocialMuted()` ignora eroarea. După prima apăsare, următoarea calcula tot unmute; utilizatorul nu putea opri din nou sunetul prin același control.

- Preferința are acum fallback în memorie, inclusiv la eroare de citire/scriere. Prima accesare fără valoare validă este muted; fiecare intenție ulterioară funcționează în sesiunea curentă. Fără storage, persistența peste reload nu este promisă.
- Când storage funcționează, aceeași cheie existentă persistă valoarea. Evenimentele pentru alte chei sau sessionStorage nu modifică sunetul; modificarea/clear din altă filă sincronizează starea locală.
- Control comun `renderSoundToggle`: difuzor cu X / unde sonore, SVG 32 px, zonă minimum 44 px, aria-label și aria-pressed sincronizate. Discul și bara diagonală decorativă au fost eliminate vizual; atribuirea audio rămâne în title, nu se pretinde că există o pagină audio.
- La deschiderea Viewerului se aplică imediat aceeași preferință și aceeași prezentare. Schimbarea în Viewer sincronizează și feedul, fără a aștepta închiderea. Intrarea fără video nu afișează un buton de mute inert.
- Stilurile și app entrypoint: `20260914-sound1`; celelalte asseturi își păstrează versiunea. Nicio repornire backend necesară.

## Dovezi

- `social-sound.test.js`: storage refuzat/quota, alternare repetată, persistență/reload, valoare invalidă, update/clear cross-tab, ignorare sessionStorage, icon/aria/availability pe ambele suprafețe.
- Împreună cu fullscreen interaction și bugete: 8/8 PASS.
- `release:check`: PASS, 79 fișiere, 1.000 actori sintetici, 0 issues, health izolat PASS, insecure_api_denied=true, external_network=false, real_funds=false, incremental_cost=0.
- Guardul suplimentar sessionStorage și bugetele au fost retestate separat: 5/5 PASS. Reexecutarea completă finală după acest guard: PASS cu aceleași rezultate (79 fișiere / 1.000 actori / 0 issues).

## Limite și continuare

P0H-031 este FIXED-CANDIDATE, nu acceptare fizică. Browserul local rămâne blocat de preferința salvată; nu s-a încercat ocolirea. Nu sunt verificate vizual contrastele peste orice clip sau comportamentul audio al telefonului. Media fără pistă audio poate avea totuși container video; detectarea universală a pistelor nu este promisă. Pagina audio/atribuire (#032) rămâne deschisă.

Următorul packet P0H: audit gesturi #014/#015/#025, cu regresii pentru touchcancel, dublă livrare pointer/touch și overlay de comentarii. Testarea fizică rămâne gate separat.
