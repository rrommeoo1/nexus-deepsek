# Prompt de implementare — Nexus Messenger «Spații», varianta 3

Decizie owner: varianta 3 din `design/messenger-options-20260913/03-spatii.png` este direcția vizuală aprobată. Macheta este referință de ierarhie și stil, nu dovadă de funcționalitate. Acest document completează specificația funcțională și înlocuiește layoutul vechi cu căutări și panouri duplicate.

## Mandat

Ești product designer și inginer full-stack senior pentru Nexus. Implementează în aplicația existentă o mesagerie clară pentru oameni, folosind componente reutilizabile. Nu crea un prototip paralel. Prioritatea este conținutul: utilizatorul vede imediat conversații, citește ușor și poate ieși din orice ecran. Nu declara un flux terminat pe baza existenței butonului sau a unui test de markup.

Păstrează Privacy Matrix, identitățile separate pe module, Idempotency-Key pentru mutații, E2EE fără downgrade implicit, interdicția distribuirii externe și costul incremental zero. Păstrează modificările existente și lucrează în pachete delimitate, verificate.

## 1. Limbaj vizual comun

- Fundal midnight navy, suprafețe discrete, cyan pentru selecție; fără glow excesiv, text tehnic permanent sau rame decorative de telefon.
- Titlu compact „Mesaje”, căutare, conversație nouă, opțiuni. Un singur rând de module: Toate / Social / Dating / Work, cu celelalte module accesibile prin derulare orizontală. Filtrele Necitite / Grupuri / Cereri sunt secundare, nu încă trei rânduri permanente.
- Nume 17–18 px, preview și mesaj 16 px, metadate minimum 12 px; ținte tactile minimum 44 × 44 px. La text mărit, rândul crește, nu se taie textul util.
- La 390 × 844, ținta inboxului este cel puțin șapte conversații vizibile, fără a micșora fonturile. Validarea se face pe viewportul real al browserului, nu pe o captură desktop redusă.
- Păstrează badge text Social / Dating / Work lângă identitate. Culoarea nu este singurul indicator. Avatarul, numele, acțiunile și conținutul provin din aceeași persona.

## 2. Inbox și căutare reală

Un singur câmp de căutare, deschis de lupă, cu ștergere rapidă și Escape pentru închidere. Caută nume, handle și grupuri; separă vizual rezultatele conversațiilor de rezultatele mesajelor, fără a cere două interogări.

Căutarea respectă modulul ales, membership, block, istoricul accesibil, expiry și protecția conversației. Debounce 300 ms, anulare logică imediată a rezultatelor vechi, paginare, retry și stări loading / fără rezultate / indisponibil. Schimbarea contului, modulului sau interogării invalidează răspunsurile în curs. Enter execută imediat. Un mesaj găsit deschide conversația și, în versiunea finală, poziționează și evidențiază exact mesajul.

Pentru E2EE, caută doar pe dispozitiv în conținutul autorizat și decriptat local, dacă există această capabilitate verificată. Nu trimite plaintext decriptat serverului. Până atunci, etichetează explicit limita căutării în mesaje necriptate. Nu prezenta filtrarea celor 30 de conversații încărcate drept căutare exhaustivă în tot istoricul.

Nu afișa simultan „nu există conversații” și o listă care pare reală. Demo este opt-in, marcat SYSTEM_TEST, fără efecte externe și fără căutare separată. Ținta finală este același renderer pentru demo și real, cu adaptoare de date și efecte separate.

## 3. Avatar → card rapid → acțiune

Contractul gesturilor este obligatoriu:

| Suprafață | Atingere scurtă | Revenire |
| --- | --- | --- |
| Avatar în inbox / conversație | Card contact; nu deschide concomitent chatul | X, exterior, Escape, Înapoi |
| Restul rândului inbox | Conversație existentă | Înapoi la aceeași poziție în listă |
| Fotografie din card, dacă există Story autorizat | Viewer Story al persoanei | Înapoi la contextul inițial |
| Profil din card | Profilul aceleiași persona | Înapoi la conversație / inbox |
| Avatar din profil cu Story | Story; opțiune separată pentru fotografia mărită | Revenire la profil |

Cardul conține fotografia mărită, numele, badge-ul și Mesaj / Audio / Video / Profil. Aproape de avatar pe desktop; compact și în limitele viewportului mobil. Focus izolat cât timp este deschis, apoi restaurat fără salt de scroll. Nu folosi butoane imbricate. La grupuri, afișează informații de grup, nu fotografia unui participant ca identitate a grupului.

Mesaj deschide conversația existentă, fără duplicate. Profil folosește autorizare server și aceeași persona; nu redirecționează Dating către Social. Dacă trebuie schimbată identitatea activă, propune explicit schimbarea și revenirea, nu o efectua în tăcere. Cererile neacceptate și blocarea restricționează acțiunile și prezența.

## 4. Conversație

Antet: Înapoi, avatar/nume, badge, Audio, Video, „…”. Fără antetul global Social și fără bottom nav peste editor. Mesaje lizibile, ore discrete, reply citat și acces la original; la apăsare lungă, meniu contextual cu acțiuni permise. Editor: atașament, text, cameră, microfon/trimite. Tastatura nu acoperă editorul.

Păstrează ciorna per cont/conversație/persona, nu între identități. Atașamentele au preview, eliminare, progres și retry reluabil; selecția nu înseamnă trimitere. Trimiterea repetată rapid, pierderea răspunsului și reconnect nu produc duplicate. Explică pending / trimis / livrat / citit numai din confirmări reale. Păstrează consimțământul necesar când transportul nu este E2EE.

## 5. Audio și video

Folosește mecanismul real de apel și autorizarea conversației înainte de cameră/microfon. Același flux pentru card și antet. Ecrane: verificare → sună → apel primit / acceptat / respins / fără răspuns → conectat → reconnect sau închis. Numele și fotografia sunt contextuale.

Controale reale: închidere, mute microfon, cameră pornită/oprită, schimbare cameră, minimizare și revenire. Nu afirma difuzor selectabil, fundal activ sau suport de grup fără capabilitate implementată. Închide trackurile la terminare, refuz și eroare. Nu porni apeluri din demo.

HTTPS lipsă, permisiune refuzată, browser incompatibil, cerere neacceptată sau infrastructură lipsă au motiv concret și următor pas. Lipsa TURN/SFU și testele cross-network rămân gates, nu se maschează cu animații „conectat”. Nu activa servicii cu cost.

## 6. Profil și Stories

Profilul include avatar/cover permise, nume, bio, statistici și taburi funcționale Postări / Clips / Stories / Informații. Arhiva și Salvatele rămân private pentru owner. Mesaj / Follow și accesul la profil respectă privacy, nu simpla existență a unui handle.

Story are progres, durată reală pentru video, avans automat, tap stânga/dreapta, hold pentru pauză, swipe de închidere și buton X. Se pot revedea Stories văzute din profil; dispar doar din lista „nevăzute”. Nu porni Stories ale altor persoane dintr-un acces explicit la avatarul unui contact. Revocarea accesului, expirarea și schimbarea contului retrag imediat conținutul. Reacțiile și răspunsurile rămân în Nexus, după autorizare.

În backendul actual, Stories sunt Social-only. Nu inventa Stories Dating / Work prin reutilizarea fotografiei Social. Extinderea lor necesită contract, privacy și teste dedicate. Feedul de maximum 100 Stories nu garantează găsirea tuturor Stories ale unui autor: pregătește un endpoint/paginare per autor înainte de a declara traseul exhaustiv.

## 7. Opțiuni secundare și conversații protejate

Meniuri ușor de închis: profil, căutare în conversație, media/fișiere, favorite, mute, mesaje temporare, blocare/raportare. Ascunde opțiunile neimplementate sau afișează indisponibilitatea explicită; nu crea butoane decorative.

Conversațiile protejate necesită autentificare suplimentară reală, retragerea conținutului și reblocare la background/inactivitate/logout. Verifică listă, search, link direct, notificări, media și restaurare. Nici CSS, nici un flag localStorage nu înseamnă protecție. Nu declara această funcție disponibilă înainte de aceste controale.

## 8. Acceptare și livrare

Teste obligatorii: nume versus avatar fără dublă activare; fiecare acțiune din card; aceeași persoană în trei module; lipsă avatar; cerere neacceptată; block; profil privat; Story expirat/revocat/văzut; căutare cu diacritice, rezultate goale, mesaje E2EE, paginare, query rapid și răspunsuri inversate; mesaj găsit → original; meniu → exterior/Escape/Înapoi; ciornă, fișier și tastatură; apel între două conturi autorizate; refuz permisiune și închidere trackuri.

Verifică 320/390/430 px, landscape, text 200%, RTL, screen reader, contrast, reduced motion și offline. Folosește numai identități sintetice izolate și bugete locale finite. Testele deterministe nu substituie browserul și telefonul real.

Livrează pe fiecare packet: cod, teste, constatări și checkpoint. Categorii obligatorii în status: implementat local / verificat vizual / verificat pe telefon / indisponibil. Nu declara totul gata printr-un procent sau prin numărul de teste. Nu modifica designul ales fără un motiv UX concret documentat.

## Secvență de implementare

1. SPACES-01: inbox compact, search, avatar/card și conectarea la mecanismele existente; punct de plecare implementat în acest pachet.
2. SPACES-02: căutare exhaustivă a conversațiilor și salt la mesaj, card independent de pagina încărcată, revenire cu poziția păstrată. Implementat local conform checkpointului SPACES-02; acceptarea vizuală rămâne pending. Rendererul comun demo/real este mutat explicit într-un packet separat, nu declarat livrat.
3. SPACES-03: Stories per autor, revenire exactă, taburile reale ale profilului și aceeași identitate pe toate traseele.
4. SPACES-04: conversație completă, editor/media/voice și testele de tastatură.
5. SPACES-05: apeluri audio/video pe două dispozitive, permisiuni, reconnect și gates infrastructură.
6. SPACES-06: conversații protejate și acceptare vizuală/mobile finală. Fără etichetă „securizat” prematură.
