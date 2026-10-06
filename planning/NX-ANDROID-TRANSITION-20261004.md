# Nexus Android: tranziție fără pierderea produsului web

Status: plan de execuție, nu declarație de funcționalitate Android sau de pregătire pentru Play Store.
Owner: proprietarul Nexus. Data: 2026-10-04.

## Decizia de produs

Clientul pentru utilizatorii finali este o aplicație Android distribuită, la momentul potrivit, prin Google Play. Site-ul actual nu este aplicația Android finală. Serverul, API-urile, datele, testele și istoricul Git rămân active; interfața mobilă se construiește incremental, fără ștergerea ori rescrierea simultană a tuturor funcțiilor.

Aceasta urmează ținta React Native/Expo din `docs/01-technical-architecture.md`. Nu transformăm automat codul DOM din `apps/nexus-web/public` în componente React Native și nu tratăm o simplă pagină în WebView drept rezolvare a camerei. O vedere web limitată poate păstra accesul la funcții încă nemigrate într-un build de tranziție, cu origine HTTPS permisă explicit și fără bridge nativ general pentru pagini terțe.

## Situația verificată

- Repository-ul are `apps/nexus-web` și `apps/nexus-demo`; `apps/nexus-mobile` a fost adăugat ca shell WebView peste clientul web (vezi mai jos), nu ca rescriere a ecranelor.
- Clientul web existent are 113 fișiere în `public` și 122 fișiere de test; `public/app.js` are aproximativ 9.100 de linii. Migrarea completă este un proiect etapizat, nu un build dintr-un clic.
- Backendul existent oferă rute pentru feed, profil, postări, upload și drafturi. Contractele, autentificarea, permisiunile și transferul media trebuie verificate pentru clientul Android înainte de a declara reutilizarea lor completă.
- PC-ul are Microsoft OpenJDK 17.0.20.1 și Android SDK local cu platforma API 36, Build-Tools 36.0.0 și `adb` 37.0.1. `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` și PATH sunt configurate ca variabile ale utilizatorului. Android Studio nu este instalat. Clientul `apps/nexus-mobile` rulează acum pe Xiaomi prin development build și Metro/Fast Refresh, fără reinstalare la fiecare editare JavaScript.
- Xiaomi 17 Pro este primul dispozitiv de acceptare. Comparația cu TikTok trebuie făcută din aceeași poziție și la aceeași lumină; capturile existente arată problema, dar nu măsoară singure obiectivul sau FOV-ul.
- Shell-ul Android are bara de jos apăsabilă și camera nativă în afara WebView-ului. Marcajul `creează` cedează ecranul `src/app/camera.tsx` prin `nexus:open-camera`; `window.__NEXUS_SHELL__` marchează clientul web găzduit. Pe Xiaomi au fost probate încadrările 9:16/0,7× și 3:4/1× și captura foto/video locală. Camera nu mai afișează panourile de diagnostic; zoomul inițial a fost amânat până la primul cadru pentru a evita cursa CameraX. Aceasta este o bază testabilă, nu acceptare finală a calității imaginii ori a fluxului de publicare. După captură există un editor nativ minimal cu text mobil, titlu, descriere și draft local; stickerele, locația, sunetul, compoziția finală a media și publicarea lipsesc încă. Feed-ul, profilul și celelalte ecrane rămân în WebView.

## Regula de dezvoltare și actualizare

1. Codul se dezvoltă pe PC. Un development build se instalează pe Xiaomi; telefonul poate fi oglindit pe PC. Schimbările de UI/logică JavaScript se văd prin Fast Refresh fără reinstalare. Schimbările de cod sau dependențe native cer rebuild și actualizare peste instalarea existentă.
2. Camera, editorul și draftul se testează local cu date sintetice. Backendul poate rula local; Railway rămâne mediul existent și se folosește pentru integrare numai cu autorizarea aplicabilă. Railway nu este instrumentul de compilare Android.
3. Nu se achiziționează servicii, nu se acceptă termeni noi pentru instrumente, nu se publică în producție ori Play Store fără aprobările explicite cerute de `AGENTS.md`. Proprietarul a aprobat instalarea gratuită JDK/Android SDK și acceptarea licențelor lor la 2026-10-04.
4. Codul web și datele sale nu se șterg. Fiecare etapă are teste și un checkpoint; un build de tranziție nu este prezentat ca paritate funcțională nativă.
5. Android este direcția produsului final: `+`, editorul, feed-ul, profilul și restul ecranelor se mută gradual în clientul nativ, cu backendul existent păstrat. Nu numim shell-ul WebView „aplicația finală”.
6. Fiecare release împins în producție pe Railway primește următorul număr vizibil sub logo în clientul web (`1.09` este versiunea live verificată la 2026-10-04; următoarele sunt `1.10`, `1.11` etc.). Se mărește versiunea împreună cu schimbarea pregătită pentru deploy, apoi se verifică URL-ul public și versiunea servită înainte de a raporta publicarea. Un commit local, Fast Refresh sau APK de dezvoltare nu sunt automat release Railway. Pentru buildul Android distribuit, versiunea afișată va fi aliniată cu versiunea de release, iar `versionCode` Android va crește separat conform regulilor de distribuție. Niciun deploy de producție fără aprobarea cerută de `AGENTS.md`.

## Etape și criterii de acceptare

### M0 — bază sigură și client de dezvoltare

- Păstrează baseline-ul web și testele; adaugă clientul Android în director separat și documentează contractele minime cu API-ul.
- Primul build de dezvoltare pornește pe Xiaomi, oferă navigare de bază și un traseu de revenire sigură la funcțiile încă nemigrate. Nu promite încă remedierea camerei.
- Verifică login, sesiune, linkuri externe, permisiuni, Back, rotație și persistența unui draft de test. Fără date reale sensibile în probele locale.

### M1 — primul flux mobil complet

- `+` deschide preview foto/video 9:16; butonul 3:4 este separat. Sunt afișate numai obiectivele/zoom-urile confirmate de API-ul telefonului, nu un 0,7× fictiv.
- Fotografia și video-ul au previzualizare fidelă încadrării, rezoluție și expunere măsurate, nu zoom prin CSS. O probă pe Xiaomi compară același cadru cu TikTok și camera sistemului.
- După captură: preview, text/stickere/locație mobile, redimensionabile și eliminabile; Next duce la detaliile postării, Draft salvează, Post folosește fluxul de upload verificat.
- Închiderea sau întreruperea aplicației nu pierde silențios conținutul; alegerea de a abandona un draft este explicită.

### M2+ — migrarea produsului întreg

- Mută progresiv feed, profil, mesagerie și celelalte verticale după dependențe și teste de acceptare. Funcțiile încă nemigrate rămân accesibile numai printr-un fallback delimitat și evaluat separat.
- Lansarea Play Store este un gate distinct: dispozitive reale, securitate/privacy, moderare, semnare, contul proprietarului, testare cerută de magazin și aprobare explicită.

## Următorul packet executabil

`apps/nexus-mobile` este un development client Android funcțional pe Xiaomi. Pachetul curent de cameră trebuie validat vizual pe dispozitiv după Fast Refresh, inclusiv alternarea 9:16 ↔ 3:4 și revenirea din editor, fără stack trace sau pierderea draftului. Următorul packet de produs leagă editorul nativ de contractele backend pentru upload/draft/publicare și adaugă instrumentele cerute (stickere, locație, sunet) în etape verificabile. Ulterior se migrează feed-ul și profilul nativ, apoi restul ecranelor. Railway nu livrează direct codul camerei native; site-ul și APK-ul trebuie verificate ca artefacte distincte la fiecare release.

Surse de implementare: `https://docs.expo.dev/develop/development-builds/introduction/`, `https://developer.android.com/media/camera/camerax/configuration`, `https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge`.
