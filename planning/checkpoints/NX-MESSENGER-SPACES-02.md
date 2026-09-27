# SPACES-02 — căutare autorizată și revenire la mesaj

2026-09-13. Packet limitat la mesagerie. Implementare main-only, UNOBSERVED/YELLOW; checker independent secvențial pentru citirile privacy. Cost incremental 0; fără deploy, provider extern sau mesaje reale trimise.

## Implementat local

- Căutare server-side după nume contextual, username și titlu, peste întreaga listă autorizată, nu doar primele 30 de conversații. Paginare 20, cursor semnat legat de query/persona/box/viewer. Nu este discovery de persoane străine.
- O singură căutare pentru conversații și mesaje plaintext autorizate. NFKD/diacritice și case folding: „stefan” găsește „Ștefan”. Badge-ul modulului în rezultatul mesajului. Input nou, clear, schimbare cont și răspunsurile inversate nu publică rezultate stale.
- La minimum două caractere, rezultatele înlocuiesc lista, nu se adaugă unei liste aparent nefiltrate. Filtrul secundar este resetat la Toate; selectarea unui filtru secundar golește căutarea. Căutarea și filtrele locale nu pretind un AND neimplementat.
- Rezultat → fereastră autorizată de maximum 60 mesaje în jurul mesajului exact, evidențiere și focus o singură dată. „Mesaje recente” revine la capătul conversației. Înapoi restaurează poziția inboxului și controlul de origine, când DOM-ul rămâne montat.
- Deschiderea normală afișează ultimele 200 mesaje, în ordine cronologică. Refreshul păstrează poziția când utilizatorul citește istoricul. Fereastra de căutare nu marchează automat întregul istoric nevăzut ca citit.
- După confirmarea unei trimiteri plaintext sau E2EE, fereastra istorică este închisă și se afișează mesajele recente, inclusiv mesajul nou; erorile nu șterg fereastra sau ciorna.
- Avatarul antetului deschide cardul folosind conversația autorizată încărcată, independent de existența rândului în inbox. Mesaj/Audio/Video nu redeschid inutil conversația curentă; păstrează fereastra și editorul. Capabilitățile, persona și schimbarea contului sunt reverificate.
- Mesajele expirate sunt redactate la citire, inclusiv preview-ul inboxului și atașamentele, fără a aștepta jobul de curățare. Target expirat, străin sau anterior limitei de istoric → 404; blocare → refuzul existent.

## Findings rezolvate

| Severitate | Problemă | Remediere |
| --- | --- | --- |
| High | Plaintext/atașamente expirate puteau rămâne în răspuns înaintea jobului | Redactare la citire; excludere search/target; fără envelope E2EE expirat |
| High | Conversațiile lungi se deschideau la cele mai vechi 200 mesaje | Citire DESC limitată, apoi inversare pentru afișare cronologică |
| Medium | Căutarea numelui vedea numai pagina inbox încărcată | Filtrare SQL autorizată înainte de limit, paginare și cursor legat de query |
| Medium | Mesaj găsit fără salt; avatar inactiv fără rând inbox | Fereastră în jurul targetului și card pe datele threadului |
| Medium | Rezultatele blocate consumau limita căutării înainte de filtrare | Excludere SQL înainte de limit plus verificarea defensivă existentă |

## Contract API / compatibilitate

- GET `/api/chat/conversations`: `q` opțional, maximum 80 caractere, minimum 2 utile; răspunsul adaugă `query.text` numai când există query. Cursorii fără query își păstrează contractul; un cursor nu se reutilizează între termeni.
- GET `/api/chat/conversations/:id/messages`: `around_message_id` opțional, întreg pozitiv sigur; `query.around_message_id` doar pentru această fereastră. Limită 60 în jurul targetului, 200 cele mai recente fără target. Respectă membership, history boundary, block, expiry și device gates.
- SQLite primește o funcție deterministă la conexiune, fără modificare de schemă sau migrare. Citirile sunt aditive; mutațiile și Idempotency-Key rămân neschimbate. Share extern rămâne interzis.
- E2EE plaintext nu este trimis către server pentru căutare. Căutarea locală E2EE nu este implementată prin acest packet.

## Dovezi

- Suita țintită: `node --test test/messenger-spaces.test.js test/thread-navigation.test.js test/p2-message-pagination.test.js test/p1-performance-budget.test.js` → 17/17 PASS; după corecția revenirii post-trimitere, `thread-navigation.test.js` + `p1-performance-budget.test.js` → 6/6 PASS, inclusiv noua regresie structurală pentru ambele transporturi.
- Acoperire: 36 conversații/paginare fără duplicate, identitate contextuală, diacritice, cursor schimbat, box invalid, viewer invalid, 260 mesaje/latest/target, target din altă conversație, expirare înainte de cleanup, history boundary, block, late results, single-flight/retry, scroll/focus/card actions. Testele sunt deterministe, nu gesturi pe telefon.
- `npm run release:check` după ultimele modificări → PASS: 74 fișiere de teste, 1.000 actori sintetici, 0 synthetic issues. Health producție izolată PASS, API nesecurizat refuzat; external_network=false, real_funds=false, incremental_cost=0. Bugetele de transfer nu au fost mărite.
- Serverul local Node a fost repornit după release; PID 5368 ascultă pe 0.0.0.0:3000, logul confirmă HTTP 3000 și HTTPS local 3443. Loguri în `apps/nexus-web/data/server-spaces02.stdout.log` și `.stderr.log`. Nu este dovadă de browser/telefon și nu este deploy.
- Checker independent read-only: fără findings High/Critical confirmate în read paths modificate. A verificat query/cursor/viewer/persona, echivalența blocării înainte de limită, history boundary/target străin, redactarea expirării/envelope și generation gates. Testele sale locale `p2-message-pagination.test.js` + `thread-navigation.test.js`: 8/8 PASS. Nu reprezintă certificare generală de securitate.

## Limite și următorul pas

- Browser/telefon: NEVERIFICAT. Restricția Browser salvată nu a fost ocolită. Nu se declară paritate vizuală sau gesturi verificate fizic.
- Nu există încă paginare continuă înainte/după fereastra conversației; acum există latest 200 și target 60 cu revenire explicită.
- Rendererul comun demo/real, prevăzut inițial în SPACES-02, este amânat explicit pentru un packet separat; demonstrațiile rămân opt-in și fără efecte reale. SPACES-02 închide rezultatul căutare/navigare, nu toate cerințele Messenger.
- SPACES-03 urmează: Stories per autor și revenire exactă la contact/profil, apoi taburile profilului. Rămân pending locked chats, editor/media complet și acceptarea apelurilor pe două dispozitive/rețele.
