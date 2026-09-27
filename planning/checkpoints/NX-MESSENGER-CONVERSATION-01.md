# NX Messenger — conversație și editor compact

Data: 2026-09-13. Packet local, fără cost sau servicii externe. Capacitate UNOBSERVED / YELLOW, numai agentul principal.

## Implementat

- Meniu ⋮ ancorat în antet, cu acțiuni existente, toggle, click exterior și Escape. Căutare locală în mesajele deja afișate/decriptate, rezultat evidențiat și navigare între rezultate; nu expediază text decriptat unui index extern.
- Editor cu Emoji, atașamente, cameră și Microfon/Trimite. Zonele tactile ale controalelor principale sunt de 44 px; inputul are 16 px. Demo folosește aceeași structură, fără capturi sau trimiteri reale.
- Emoji înlocuiește selecția la cursor și respectă limita fără a tăia un caracter compus.
- Camera invocă pickerul nativ `capture=user`, fără auto-trimitere. Comportamentul camerei este decis de browser/OS; pe desktop poate deschide selectorul de fișiere, nu un preview selfie.
- Notă vocală reală: getUserMedia numai după click și verificarea accesului, MediaRecorder, maximum 60 secunde / 10 MB comprimați, conversie locală la PCM WAV mono, preview audio și trimitere explicită prin transportul existent resumable/Idempotency/E2EE. Nu s-au adăugat endpointuri sau furnizori.
- × anulează captura. Reset, schimbare atașament, fundal, ieșire și pierderea accesului invalidează capturile în așteptare și opresc trackurile. URL-urile locale de preview sunt revocate. Inițierea este single-flight inclusiv dacă un refresh reactivează butonul.
- Fișierele audio necriptate autorizate au player în conversație. Fișierele E2EE păstrează deschiderea/decriptarea explicită și descărcarea existente; nu se declară player audio inline E2EE în acest packet.
- Asseturi modificate: versiune `20260913-thread1`. Backend neschimbat, fără migrare și fără restart necesar pentru fișierele statice.

## Probleme reparate

- High, integrare: serverul accepta media audio pentru mesaje cu `kind=file`, însă validatorul de citire UI nu accepta `media_kind=audio`; o notă vocală putea face conversația indisponibilă. Validatorul și playerul acceptă acum acest tip, păstrând URL-urile interne și verificările de autorizare.
- Medium, concurență: permisiunea microfonului putea reveni după schimbarea ecranului/fișierului. Generația capturii împiedică atașarea unui rezultat vechi.
- Medium, UX: ⋮ ducea direct la opțiuni în partea de jos. Acum deschide meniul lângă antet, fără a muta câmpurile de securitate în afara formularului.
- Bugetul CSS a fost păstrat, nu mărit: compactare whitespace și eliminare comentarii istorice `neuralXX`. Auditul verifică în continuare regulile CSS efective, nu prezența acelor comentarii. Nicio regulă funcțională Social nu a fost eliminată pentru a reduce dimensiunea.

## Verificare

- `test/composer-tools.test.js`: encoder WAV și semnătură media, limite, transport repository + validator UI cu URL extern respins și replay fără duplicat, emoji/limită, cameră fără submit, demo, HTTP, permisiune refuzată, rezultate stale, înregistrare/stop/preview și anulare. Mockuri deterministe pentru dispozitive, nu test fizic.
- `test/messenger-shell.test.js`: meniul nou, păstrarea câmpurilor E2EE în formular, apeluri și attachment picker fără auto-submit.
- `npm run release:check`: PASS inclusiv la reexecutarea finală după guardul single-flight; 77 fișiere, 1.000 actori sintetici, 0 probleme, health izolat PASS, API nesigur refuzat, external_network=false, incremental_cost=0.

## Gate deschis

Nu s-a făcut audit vizual sau test pe telefon. Permisiunea de browser pentru aplicația locală rămâne blocată conform checkpointurilor anterioare; nu a fost ocolită. HTTP LAN nu permite getUserMedia: UI explică necesitatea HTTPS. Permisiunile reale, tastatura, selectarea camerei, codecurile și gesturile dispozitivului rămân de verificat. Nu se declară paritate WhatsApp, E2EE auditat independent sau readiness producție.

Următorul packet: verificare vizuală a conversației la 320/390 px și cu tastatura, când accesul permite; separat, Stories per autor și revenirea din card/profil rămân deschise în planul Messenger.
