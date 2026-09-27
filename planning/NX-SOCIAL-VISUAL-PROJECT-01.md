# Nexus Social — proiect vizual 01

Data: 2026-09-10. Livrabil: `/social-design.html` (prototip navigabil + catalog vizual).
Scope: Social, Mesaje, Profil, Creare și recuperarea erorilor. Acțiunile din
prototip sunt simulări în memoria tabului; nu modifică datele aplicației.

## Direcția propusă

Conținut mare, comenzi familiare, revenire previzibilă. Păstrăm fundalul întunecat,
cyan-ul și avatarurile circulare Nexus. Accentele luminoase indică selecția sau
acțiunea principală; nu înconjoară fiecare componentă. Tema deschisă folosește
aceeași geometrie. Textul explicativ al proiectului rămâne în afara interfeței.

Îmbunătățiri propuse de arhitectură:

1. **Header contextual.** Feed: Nexus, sursă, relații, căutare. Inbox: titlu și
   acțiuni pentru conversații. Profil: username și setări. Viewer, camera și chatul
   au doar comenzile contextului, fără headerul global.
2. **O singură navigare.** Acasă / Mesaje / + / Live / Profil. Dispare în viewer,
   conversație, cameră și comentarii. În aceste stări există un X sau Înapoi.
3. **Gesturi fără schimbări surprinzătoare.** Vertical = altă postare. Orizontal =
   media aceleiași postări; la un singur element se poate merge la altă postare.
   Sursa Local/Global se schimbă din selector, nu prin swipe accidental.
4. **Comentarii exclusive.** Media ocupă aproximativ 42%, conversația 58% în
   portret. Reacțiile, identitatea și meniurile media dispar. Răspunsurile sunt
   indentate, textul are 15 px, inputul 16 px. Tastatura nu se suprapune cu dockul.
5. **Profil public separat de administrare.** Copertă, avatar, bio, statistici și
   taburi vizuale publice. Portofelul, securitatea, dispozitivele, datele și
   confidențialitatea stau în pagini private. Nu se publică automat date financiare.
6. **Mesaje imediat vizibile.** Inbox cu avatar, nume, ultimul mesaj, oră și necitite.
   Cererile sunt separate; grupurile folosesc aceeași listă. Nu există bannere E2EE
   sau texte tehnice care împing conversațiile sub fold.
7. **Acțiuni reversibile.** Salvare, urmărire și redistribuire au stare selectată și
   se pot anula. Confirmările lungi se rezervă operațiilor greu reversibile.
8. **Creare în trei etape.** Sursă → editor → audiență/publicare. Ciorna este
   punctul de recuperare, inclusiv după upload întrerupt.
9. **Story văzut accesibil.** Story-urile văzute merg la final, nu devin imposibil
   de găsit. Progres, pauză și segmente anterioare/următoare sunt vizibile.
10. **Produs sincer.** Stări cu zero date, refuz de acces, offline și eroare au
    aceeași grijă vizuală. Conținutul sintetic nu pretinde că este activitate reală.

Aceasta este o revizie propusă a gesturilor din
`NX-SOCIAL-HUMAN-EXPERIENCE-ARCHITECTURE.md`: swipe orizontal nu mai schimbă sursa
feedului în noua propunere. Aplicația actuală nu este modificată de acest livrabil.

## Catalog vizual și contractul comenzilor

Prototipul include 32 de stări accesibile din catalog. Fiecare are reguli lângă
previzualizare; pe telefon, regulile sunt sub ecranul interactiv.

| Grup | Ecrane | Comenzi și rezultate principale |
|---|---|---|
| Descoperire | Feed, Fullscreen | Tap deschide, swipe schimbă media/postarea, X/Înapoi revine; inimă, comentariu, repost, send intern, save, mute |
| Interacțiuni | Comentarii, Reacții, Trimite | Răspuns în thread, apreciere comentariu, alegere emoție, selecție destinatari și confirmare locală |
| Filtrare | Feeduri, Oamenii tăi, Căutare | Surse, formate, relații, favoriți, câmp de căutare, rezultate directe |
| Efemer | Stories | Progres, anterior/următor, pauză, reacție, răspuns, ieșire |
| Mesaje | Inbox, Cereri, Conversație | Selectează chat, acceptă/refuză cerere, scrie text, răspunde, revine în inbox |
| Conversații avansate | Atașamente, Apel, Întâlnire | Sursă atașament, toggles apel, terminare, formular întâlnire → card de mesaj simulat |
| Identitate | Profil propriu, Profil creator, Editare | Postări/Clips/Colecții/Despre, follow/message, salvare profil în sesiunea demo |
| Cont privat | Colecții, Portofel, Setări, Confidențialitate | Deschide media salvată, active fictive, setări grupate, selectoare și toggles |
| Creare | Creează, Cameră, Editor, Publicare | Alege sursă, previzualizează, configurează audiență/durată, continuă publicarea simulată |
| Recuperare creare | Upload, Ciorne, Live | Progres simulat, pauză/reia, păstrează ciorna, previzualizare Live fără transmisie |
| Acces și erori | Login, Stare goală, Offline | Intrare demonstrativă, căutare persoană, reîncercare și revenire |

## Ce este implementat în prototip

- Catalog de ecrane, mod atlas cu toate machetele și revenire în prototip.
- Temă închisă/deschisă, layout fluid pentru telefon, tabletă și desktop.
- Navigare prin linkuri directe `#feed`, `#inbox`, `#profile` etc.; istoricul
  browserului urmărește tranzițiile prototipului.
- Media ilustrativă existentă în repository; peisaje CSS, avataruri și iconuri SVG.
- Schimbare locală conținut/media prin pointer-swipe și taste săgeți.
- Comentarii și mesaje fictive; trimiterea adaugă doar în memoria tabului.
- Selecție reacții, follow/save/repost/favorite și trimitere internă simulate.
- Editarea numelui și bio, audiențe demonstrative, formular întâlnire, progres upload.
- Stări cameră, apel și Live explicit etichetate ca machete; nu accesează dispozitive.

## Ce nu dovedește prototipul

O previzualizare nu certifică funcția din backend. Redarea video reală, înregistrarea
camerei, livrarea E2EE, apelurile, uploadul reluabil, identificarea dinamică a
destinatarilor, username availability și plățile trebuie conectate separat la
serviciile existente. Unele acțiuni avansate deschid machete de selecție fără a
procesa media. Nicio performanță mobilă nu este declarată pe baza acestor machete.

## Conectarea la ceea ce există deja

| Componentă nouă | Punct existent | Regula integrării |
|---|---|---|
| Feed/Viewer | `postCard`, `openMediaViewer`, `social-gesture.js` | Un singur controller de gesturi; aceeași postare și aceeași poziție la revenire |
| Comentarii | `openViewerComments`, `renderCommentThread`, `wireCommentReplyInputs` | Păstrează parent_id, idempotency și filtrarea privacy; adaugă layout exclusiv |
| Inbox/Chat | modulele existente de conversații și `chat-crypto.js` | Nicio afirmație E2EE fără stare criptografică verificată; fixture-urile nu intră în API |
| Profil | `openCreatorProfile`, editorul de profil și Privacy Matrix | Diferențiază profilul propriu de cel vizitat și informația publică de cea privată |
| Create/Upload | composer, camera request gate și resumable upload | Nu pierde ciorna la anulare; nu dubla publicarea după retry |
| Wallet | fluxurile Nexus Pay și portofel existente | Sold real doar din date validate; nicio cheie/seed în profilul public |

## Criterii de acceptare pentru integrare

1. Preview verificat la 360, 390 și 412 px lățime, portret/landscape și zoom 200%.
2. Fără suprapunere între composer, tastatură, dock și controalele media.
3. Text de conversație minimum 15 px; input 16 px; ținte principale 44 px.
4. X, Înapoi, Escape și Home funcționează din toate stările aplicabile; focusul
   revine la elementul care a deschis panoul.
5. Trasee de 20 de schimbări succesive, fără blocare, dublă acțiune sau pierdere
   neanunțată a ciornei. Swipe pe comentarii nu schimbă media.
6. Erori 401/403/429/offline și răspunsuri întârziate au comportament explicit.
7. Headerul se retrage la vizionare; nu dispare singura cale de ieșire.
8. Datele sintetice sunt izolate de date reale, reputație, analytics și economie.
9. Testele automate, capturile de ecran și probele de touch sunt dovezi distincte.

## Referințe

- Cele patru capturi ale utilizatorului: densitate inbox, profil și feed familiar.
- [TikTok — Liking](https://support.tiktok.com/en/using-tiktok/exploring-videos/liking):
  intrare familiară pentru reacții, fără a presupune că swipe/dublu tap trebuie copiate identic.
- [Meta — Instagram DM features](https://about.fb.com/news/2025/02/new-instagram-dm-features-stay-connected/amp/):
  mesaje și instrumente contextuale, ca reper pentru o conversație ușor de folosit.
- `planning/audits/NX-SOCIAL-HUMAN-JOURNEY-MATRIX.md`: gate-ul UX existent.

## Limită de verificare a acestei livrări

Accesul Browser la `http://127.0.0.1:3000` a fost refuzat de o permisiune salvată
a utilizatorului. Nu s-au folosit alte browsere, CDP sau capturi alternative pentru
a ocoli refuzul. Verificarea vizuală/rularea gesturilor în browser rămâne NEEXECUTATĂ.
Livrabilul este servit local și poate fi deschis direct de utilizator.
