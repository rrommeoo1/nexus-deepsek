# Messenger NAV-01 — ordine deterministă card → destinație

2026-09-13. Packet autonom delimitat, main-only UNOBSERVED/YELLOW. Respectă contractul P0H „Back închide doar suprafața de deasupra” din arhitectura Human Experience. Fără egress/cost, DB, mutații reale, migrare sau modificare de privacy.

## Finding și remediere

High UX: `dialog.close()` programează evenimentul nativ de închidere, iar `history.back()` este asincron. Cardul deschidea imediat conversația/profilul/Story-ul, înainte de retragerea intrării sale de istoric. Evenimentul ulterior putea afecta suprafața nouă sau lăsa o intrare de istoric veche. Testele anterioare cu `close` sincron nu acopereau această ordine.

- Helper comun `bindDialogNavigation` pentru card și dialogurile demonstrative. Destinația așteaptă atât evenimentul close, cât și popstate-ul retragerii intrării de istoric.
- Callback-ul aplicației `retireMessengerHistory` întoarce Promise și păstrează mecanismul existent de suprimare a unei singure navigări UI.
- Click repetat: o singură tranziție. Schimbarea contului/persona/ecranului invalidează destinația în așteptare.
- Înapoi nativ nu declanșează un al doilea history.back. X restaurează focusul numai după retragerea istoricului. Tranziția la alt ecran nu mută focusul înapoi în vechiul rând.
- Un card înlocuit în istoric nu poate muta focusul sau deschide o destinație peste un overlay nou.
- Un card deja deschis este refocalizat, nu închis și recreat cu încă o intrare de istoric.
- Profil demo → mesaj folosește aceeași ordine; demo rămâne fără apeluri/mesaje reale.

## Dovezi

- Teste noi cu close și popstate controlate separat, nu tratate sincron: ordine, single-flight, schimbare cont, Back, X/focus, overlay înlocuit, destinație stale.
- `node --test test/dialog-navigation.test.js test/messenger-lan.test.js`: 10/10 PASS.
- Verificarea inițială include bugetul CSS/JS: PASS, fără creșterea plafoanelor.
- `npm run release:check`: PASS după modificările finale; 76 fișiere, 1.000 actori sintetici, 0 synthetic issues; health producție izolată PASS, insecure_api_denied=true, external_network=false, real_funds=false, incremental_cost=0.
- Asseturile JavaScript implicate au versiunea `20260913-spaces4`; nu s-a schimbat backendul și nu este necesară repornirea lui pentru aceste fișiere statice.

## Limite / următorul pas

Browserul local rămâne blocat de preferința salvată documentată în HEADER-LAN-01. Nu s-a încercat ocolirea și nu se declară acceptare vizuală sau verificare fizică a butonului Android Înapoi. Testele demonstrează logica de ordine, nu geometria ori gesturile dispozitivului.

Următorul packet: Stories per autor / revenire în profil sau card, păstrând faptul că actualul endpoint global poate omite Stories ale contactului. Acceptarea vizuală rămâne un gate deschis, nu închis prin numărul de teste.
