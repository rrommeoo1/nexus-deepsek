# Messenger HEADER-LAN-01 — corecția capturilor de pe telefon

2026-09-13. Packet de remediere a cerințelor explicite sosite în timpul lucrului; precede continuarea Stories/profil planificată în SPACES-03. Main-only, UNOBSERVED/YELLOW. Cost incremental 0. Nicio migrare sau schimbare de backend/privacy.

## Rezultatul implementat local

- Antet Nexus Messages: wordmark reutilizat din pagina principală, cu ID de gradient propriu, astfel încât X să nu depindă de SVG-ul ascuns din antetul global. Etichetă MESSAGES sub logo; logo → Home.
- Două meniuri compacte în antet, nu select nativ: modul și filtrul listei. Modul: Toate mesajele / Social / Dating / Work / Travel / Market. Filtru: Toate / Necitite / Grupuri / Cereri; Activitate păstrată ca acces secundar compact. Explicațiile E2EE nu mai ocupă meniul principal.
- O singură căutare, lată și joasă, sub antet; fără banda orizontală de module și fără titlu/toolbars duplicate. Opțiuni cu ținte tactile de minimum 44 px, selecție vizibilă, închidere la alegere, exterior sau Escape.
- Intrarea în Mesaje din navigația principală sau din alt modul selectează persona curentă. Schimbarea contului/persona resetează contextul; Toate rămâne o alegere explicită în inbox și nu schimbă identitatea activă.
- Demo local apare numai după un răspuns autorizat de inbox gol Social/All, niciodată ca înlocuitor pentru eroare. Nu se mai afișează simultan mesajul de inbox gol și un panou Demo separat. Fiecare rând păstrează eticheta Demo; datele rămân SYSTEM_TEST fără efecte reale.
- Rândurile demo reutilizează rendererul real, cu avatar și conversație drept butoane surori. Avatar → card comun; rând → conversație demonstrativă editabilă. Profilul demo este local și explicit fictiv. Audio/video în demo explică indisponibilitatea fără a porni dispozitive/apeluri. Aceasta nu este unificarea completă a rendererului de mesaje demo/real.
- Căutarea demo rămâne locală și nu afișează panouri paralele de rezultate server goale. Când există conversații reale, căutarea autorizată SPACES-02 rămâne neschimbată.

## Cauze concrete și remedii

| Severitate | Cauză | Remediere |
| --- | --- | --- |
| High UX | `crypto.randomUUID()` apelat direct înainte de `showModal()`; API absent pe multe origini HTTP LAN | Token UI local necriptografic pentru istoricul cardurilor/demo. Nu este token de autorizare sau mutație |
| High UX | Trei apeluri directe `crypto.randomUUID()` la deschiderea/resetarea editorului real | Refolosire `newUploadMutationKey`, compatibil cu mediul local, fără schimbarea regulilor de replay/Idempotency-Key |
| Medium UX | Cardurile demo nu aveau control de avatar, ci un singur buton pe rând | Renderer comun de rând și binding separat pe avatar/conversație |
| Medium UX | Opțiunile cardului real căutau controalele de apel în lista inbox, nu în ecranul ce conține threadul | Scope corect `.inboxScreen` pentru contactOptions |
| Medium UX | ID SVG duplicat între antetul global ascuns și logo-ul inbox | Gradient `nexus-messenger-x` independent |
| Medium UX | Demo plus empty state plus filtre duble ocupau ecranul | O listă unică, o căutare, două meniuri în header |

Nu s-au relaxat HTTPS, camera/microfon, E2EE, Privacy Matrix, validarea mutațiilor sau interdicția share extern. Tokenurile UI nu sunt folosite pentru autentificare. Datele demo folosesc identificatori negativi doar în adaptorul de prezentare și nu ajung în API.

## Dovezi

- `messenger-lan.test.js`: card deschis cu crypto indisponibil într-un DOM double; apel demo refuzat explicit; deschidere fără randomUUID direct; logo/gradient unic; toate cele șase module selectabile; ID-uri demo izolate.
- `messenger-shell.test.js`: header/căutare/meniuri, default Dating la intrarea din alt ecran, avatar contextual și controale distincte, păstrarea controalelor audio/video.
- Suita țintită finală `messenger-lan.test.js`, `messenger-shell.test.js`, `p1-performance-budget.test.js`: 14/14 PASS.
- `npm run release:check`: PASS după ultimele corecții; 75 fișiere de teste, 1.000 actori sintetici, 0 synthetic issues. Production health izolat PASS; insecure API denied; external_network=false, real_funds=false, incremental_cost=0.
- Bugetul CSS a detectat depășirea la introducerea headerului; eliminate regulile nefolosite ale vechiului panou Demo și meniului/search vechi, fără creșterea plafonului. Testele statice de asset version au fost actualizate odată cu versiunile CSS/JS.
- Serverul existent PID 5368 ascultă pe 3000. Acest packet schimbă asseturi statice, nu cere restart backend. Asseturile modificate au versiune `20260913-spaces3` (cu excepția helperilor neschimbați).

## Limite explicite

- Browser: accesul la http://127.0.0.1:3000 a fost refuzat de o preferință salvată a utilizatorului. Skill Browser a fost citit și urmat; nicio ocolire prin alt browser, CDP, screenshot extern sau execuție indirectă. Nu există capturi noi și nu se pretinde verificare fizică pe telefon.
- Testele DOM double/VM nu dovedesc geometria, tastatura Android sau gesturile native. Logo-ul și layoutul au nevoie în continuare de acceptare vizuală.
- Demo nu este cont real; nu se pot efectua apeluri către Mira/Alex sau livrări reale. Profilul demonstrativ nu substituie profilul complet autorizat.
- Necitite/Grupuri filtrează conversațiile încărcate; căutarea server-side are paginare autorizată. E2EE local full-text, paginarea integrală a threadului, Stories per autor și profilul complet rămân packets separate.
- Următorul pas: verificare vizuală autorizată a headerului/cardului/threadului pe dimensiuni mobile, apoi reluarea SPACES-03 Stories/profil. Nu se declară beta acceptat doar pe baza numărului de teste.
