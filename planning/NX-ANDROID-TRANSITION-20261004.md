# Nexus Android: tranziție fără pierderea produsului web

Status: plan de execuție, nu declarație de funcționalitate Android sau de pregătire pentru Play Store.
Owner: proprietarul Nexus. Data: 2026-10-04.

## Decizia de produs

Clientul pentru utilizatorii finali este o aplicație Android distribuită, la momentul potrivit, prin Google Play. Site-ul actual nu este aplicația Android finală. Serverul, API-urile, datele, testele și istoricul Git rămân active; interfața mobilă se construiește incremental, fără ștergerea ori rescrierea simultană a tuturor funcțiilor.

Aceasta urmează ținta React Native/Expo din `docs/01-technical-architecture.md`. Nu transformăm automat codul DOM din `apps/nexus-web/public` în componente React Native și nu tratăm o simplă pagină în WebView drept rezolvare a camerei. O vedere web limitată poate păstra accesul la funcții încă nemigrate într-un build de tranziție, cu origine HTTPS permisă explicit și fără bridge nativ general pentru pagini terțe.

## Situația verificată

- Repository-ul are `apps/nexus-web` și `apps/nexus-demo`, dar încă nu are `apps/nexus-mobile`.
- Clientul web existent are 113 fișiere în `public` și 122 fișiere de test; `public/app.js` are aproximativ 9.100 de linii. Migrarea completă este un proiect etapizat, nu un build dintr-un clic.
- Backendul existent oferă rute pentru feed, profil, postări, upload și drafturi. Contractele, autentificarea, permisiunile și transferul media trebuie verificate pentru clientul Android înainte de a declara reutilizarea lor completă.
- PC-ul are Microsoft OpenJDK 17.0.20.1 și Android SDK local cu platforma API 36, Build-Tools 36.0.0 și `adb` 37.0.1. `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` și PATH sunt configurate ca variabile ale utilizatorului. Android Studio nu este instalat. Clientul `apps/nexus-mobile` a produs un APK debug arm64 pentru diagnosticul încadrării; `adb devices -l` nu a găsit încă un telefon conectat, deci funcționarea pe Xiaomi rămâne neverificată.
- Xiaomi 17 Pro este primul dispozitiv de acceptare. Comparația cu TikTok trebuie făcută din aceeași poziție și la aceeași lumină; capturile existente arată problema, dar nu măsoară singure obiectivul sau FOV-ul.

## Regula de dezvoltare și actualizare

1. Codul se dezvoltă pe PC. Un development build se instalează pe Xiaomi; telefonul poate fi oglindit pe PC. Schimbările de UI/logică JavaScript se văd prin Fast Refresh fără reinstalare. Schimbările de cod sau dependențe native cer rebuild și actualizare peste instalarea existentă.
2. Camera, editorul și draftul se testează local cu date sintetice. Backendul poate rula local; Railway rămâne mediul existent și se folosește pentru integrare numai cu autorizarea aplicabilă. Railway nu este instrumentul de compilare Android.
3. Nu se achiziționează servicii, nu se acceptă termeni noi pentru instrumente, nu se publică în producție ori Play Store fără aprobările explicite cerute de `AGENTS.md`. Proprietarul a aprobat instalarea gratuită JDK/Android SDK și acceptarea licențelor lor la 2026-10-04.
4. Codul web și datele sale nu se șterg. Fiecare etapă are teste și un checkpoint; un build de tranziție nu este prezentat ca paritate funcțională nativă.

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

`apps/nexus-mobile` este pregătit ca development client Android separat de web. Typecheck, lint, Expo Doctor, exportul bundle-ului JavaScript Android și două build-uri debug arm64 au trecut local; al doilea build a verificat scriptul repetabil. APK-ul rezultat (`app.nexus.mobile.dev`, `minSdk 24`, `targetSdk 36`) este în `apps/nexus-mobile/builds/nexus-dev-arm64.apk`, ignorat de Git. Auditul npm raportează 29 de avertismente în arborele de dependențe, ce trebuie triat înainte de lansare; nu s-a aplicat `audit fix --force`, care ar schimba incompatibil versiunile Expo. Următorul gate este conectarea Xiaomi prin USB/wireless debugging și proba pe dispozitiv a raportului 9:16, 3:4 și a obiectivelor expuse. Acest APK nu înseamnă că fluxul foto/video sau produsul Android complet sunt implementate. Railway nu este cuplat la acest build.

Surse de implementare: `https://docs.expo.dev/develop/development-builds/introduction/`, `https://developer.android.com/media/camera/camerax/configuration`, `https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge`.
