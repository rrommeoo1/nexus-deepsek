# Nexus Android — development client

> Actualizare 2026-10-06: ecranul principal nu mai este un WebView. Este un client React Native nativ cu login email, feed, profil, cameră, editor local, emoji și căutare/previzualizare Jamendo prin API. URL-ul API implicit este `https://nexus-deepsek-production.up.railway.app`; poate fi schimbat la pornirea Metro prin `EXPO_PUBLIC_NEXUS_API_URL`. Nu mai este necesar `adb reverse tcp:5000` pentru interfața Android. Editorul nu face încă export final sau publicare, iar loginul/walletul și celelalte ecrane nu au paritate completă. Textul istoric de mai jos documentează shell-ul WebView anterior și nu trebuie folosit ca instrucțiune pentru noua interfață.

Pentru iterații Android: `npm run dev:open`, apoi modifică `src/**` și verifică cu `npm run dev:ui`; `npm run typecheck` și `npm run lint` înainte de livrare. Nu dezinstala aplicația, deoarece capturile și drafturile sunt locale. Un nou APK este necesar numai după modificări native/config, nu după fiecare editare de UI.

Acesta este **aplicația Nexus pe Android**: un shell nativ subțire care încarcă, într-un `WebView`, chiar clientul din `apps/nexus-web`. Feed, profiluri, mesagerie, cameră, portofel — tot ce există în produsul web se vede pe telefon fără să fie rescris încă în React Native.

Regula care ține totul coerent: **produsul este clientul web servit de serverul local; shell-ul Android doar îl găzduiește.** `apps/nexus-web` rămâne singura sursă de adevăr pentru ecrane, iar migrarea în React Native se face etapizat, ecran cu ecran, în `src/**`.

Ecranul principal afișează direct clientul Nexus, fără o bară nativă de dezvoltare deasupra lui. Versiunea de release apare sub logo-ul produsului web. Ecranul nativ separat este camera: marcajul `creează` din bara de jos nu montează camera web, ci deschide `src/app/camera.tsx`. Restul interfeței — bara de jos inclusă — este încă client web.

## Cum vezi aplicația pe telefon

1. Conectează telefonul prin ADB USB sau Wireless debugging și verifică `adb devices -l` până apare `device`. Pe Xiaomi-ul de test, USB a eșuat la enumerare, dar asocierea ADB prin Wi-Fi a funcționat.
2. Din `apps/nexus-mobile`, rulează `npm run dev:android`. Pornește aplicația web locală (dacă nu rulează deja), Metro, redirecționarea `adb reverse` pentru ambele porturi, deep link-ul către Metro și oglindirea scrcpy.
3. Pe telefon apare direct aplicația Nexus. Dacă scrie „Aplicația web nu este pornită", serverul local nu rulează: `npm run dev:web`, apoi `npm run dev:reload`.
4. Autentifică-te o singură dată cu contul de test: `test@nexus.ro` / `test1234` — sau, fără nicio atingere pe telefon, `npm run dev:login` (completează și trimite formularul prin CDP, apoi confirmă sesiunea pe `/api/me`). Contul nu există într-o bază locală nouă — se creează doar pe preview — deci întâi rulează, din `apps/nexus-web`, `npm run dev:test-account` (idempotent, fără rețea, fără portofel). Sesiunea este un cookie în stocarea WebView-ului pentru `http://localhost:5000`, deci supraviețuiește lui `npm run dev:reload` și repornirilor aplicației; contul nu are portofel, așa că clientul cere în continuare configurarea lui.

Dacă APK-ul nu este instalat încă: `npm run install:android` — o dată, și din nou doar după o schimbare nativă.

## Camera nativă (fluxul `creează`)

Marcajul `creează` din bara de jos nu deschide camera web: clientul postează `{ type: "nexus:open-camera", source }` pe `window.ReactNativeWebView`, shell-ul îl primește în `onMessage` și face `router.push('/camera')`. Clientul recunoaște shell-ul după flagul `window.__NEXUS_SHELL__`, injectat înainte de încărcarea scripturilor; într-un browser normal flagul lipsește, deci camera web rămâne cea implicită și fluxul de publicare nu se schimbă.

Ruperea a fost necesară pentru că ecranul web al camerei este desenat pentru un cadru de telefon (`min(100%,540px)` × `min(100dvh,820px)`), în care senzorul 3:4 intră cu benzi opace sus și jos, iar bara lui de unelte rămâne peste interfață după închidere. Ecranul nativ nu are aceste limite. Drumul înapoi nu există încă: fotografia capturată rămâne în spațiul intern al clientului și nu ajunge în composerul web (M1).

Pentru o comparație utilă, din aceeași poziție și la aceeași lumină:

- acordă permisiunea camerei, apoi compară 9:16 cu 3:4 din aceeași poziție și cu aceeași lumină; notează obiectivul și factorul de zoom afișate. În 9:16 se cere 0,7× numai dacă un obiectiv multiplu cu `minZoom <= 0.7` este expus aplicației; altfel rămâne 1× fără zoom digital;
- fă o fotografie și compară preview-ul fișierului salvat cu imaginea din cameră (dimensiunile în pixeli apar în preview); repetă pentru 3:4 și pentru video (microfonul cere permisiune, iar clipurile de test se opresc automat la 2 minute). Butonul „Ultimul test” redeschide ultima captură după revenirea în cameră;
- compară cu TikTok și cu camera sistemului: un preview care umple ecranul poate decupa marginile dacă raportul senzorului diferă de cel al ecranului, iar fișierul salvat trebuie evaluat separat de preview.

Capturile sunt mutate în spațiul intern persistent al clientului, nu în galeria telefonului. Nu dezinstala aplicația și nu șterge datele ei dacă vrei să păstrezi aceste fișiere de test. Interfața recuperează momentan doar ultima captură, deși fișierele mai vechi nu sunt șterse automat.

## Bucla de dezvoltare (fără reinstalare)

Regula buclei: **codul care se schimbă des nu are nevoie de reinstalare; doar codul nativ are.** Există două bucle, cu două surse de adevăr:

| Ce modifici | Ce faci | Cost |
| --- | --- | --- |
| Ecrane, stiluri, logică în `apps/nexus-web/public/**` — clientul web, adică partea vizibilă a aplicației | `npm run dev:reload` (reîncarcă shell-ul prin deep link, fără nicio atingere pe telefon) | secunde |
| Shell-ul Android: `apps/nexus-mobile/src/**` | Salvezi; Metro aplică Fast Refresh automat | secunde |
| Dependență cu cod nativ, `app.json` (permisiuni, pluginuri), versiune Expo/RN | `npm run build:android:dev` apoi `npm run install:android` | minute |

Fișierele statice nu au Fast Refresh, deci clientul web se citește la încărcarea paginii: de aceea există `dev:reload`. Reîncărcarea nu golește stocarea WebView-ului (DOM storage și cookie-uri pentru aceeași origine `localhost`), deci autentificarea nu se pierde.

Comenzi (din `apps/nexus-mobile`):

```powershell
npm run dev:android        # bucla completă: telefon treaz + aplicația web + Metro + adb reverse + deep link + oglindire scrcpy
npm run dev:web            # pornește doar aplicația web locală (apps/nexus-web), dacă nu rulează deja
npm run dev:reload         # reîncarcă shell-ul de pe telefon, ca să ia ultimul client web editat
npm run dev:doctor         # verifică toolchain, telefon, aplicația instalată, Metro, aplicația web, typecheck, lint
npm run dev:mirror         # doar oglindirea telefonului pe PC
npm run dev:wake           # trezește telefonul / dezactivează Doze pe durata sesiunii
npm run dev:restore        # dă telefonul înapoi: alimentare reală, screen timeout propriu, Doze activ
npm run dev:logs           # logcat pentru procesul aplicației
npm run dev:ui             # textul real randat: bara nativă plus textul din clientul web
npm run dev:login          # autentifică în clientul web de pe telefon prin CDP (contul de test, fără atingere)
npm run dev:reverse        # adb reverse tcp:8081 și tcp:5000 (Metro și aplicația web, pe localhost)
npm run dev:open           # leagă aplicația de pe telefon la Metro (deep link, fără atingere)
npm run typecheck
npx expo lint
npx expo-doctor
npm run build:android:dev  # rebuild nativ (doar când s-a schimbat ceva nativ)
npm run install:android    # adb install -r builds/nexus-dev-arm64.apk
```

`npm run dev:android` pornește aplicația web și Metro, fiecare în fereastra ei (`builds/nexus-web.log`, `builds/metro.log`, ambele cu fiecare linie marcată cu ora), apoi leagă automat shell-ul de pe telefon la Metro (deep link `nexusdev://expo-development-client/?url=http://localhost:8081`). Metro jurnalizează bundle-urile complete, nu fiecare actualizare livrată prin websocket la Fast Refresh, deci verifică ecranul țintă cu `npm run dev:ui`: citește textul randat în camera nativă ori în clientul web. Bara `Dev <versiune> live` nu mai există. `npm run dev:doctor` verifică lanțul (toolchain, telefon, `adb reverse` pe ambele porturi, Metro, aplicația web, randarea) și spune unde se rupe bucla.

### Autentificare pe telefon fără atingere (`dev:login`)

`npm run dev:login` autentifică sesiunea din WebView-ul de pe telefon fără nicio atingere pe ecran. Clientul de development expune un socket `webview_devtools_remote_<pid>` (din `webviewDebuggingEnabled={__DEV__}`), care se redirecționează prin adb pe `localhost:9222`; scriptul citește lista de ținte de la `/json`, ia adresa websocket a paginii `http://localhost:5000` și conduce DOM-ul prin Chrome DevTools Protocol: completează `#email-login-form` și îl trimite, apoi confirmă rezultatul pe `/api/me` (cookie-ul de sesiune), nu pe aspectul ecranului.

Reguli și limite:

- aplicația trebuie să fie **în prim-plan**: cât timp este în fundal, Android îngheață procesul, iar serverul DevTools al WebView-ului nu răspunde (cererea expiră). Comanda o readuce ea în prim-plan, fără deep link, deci nu are nevoie de Metro;
- procesul trebuie să ruleze deja (altfel comanda spune explicit să rulezi `npm run dev:android`), iar pagina din WebView trebuie să fie chiar clientul web (altfel trimite la `npm run dev:reload`);
- este idempotentă: dacă sesiunea este deja activă, raportează „deja autentificat” fără să mai trimită formularul;
- contul implicit este cel de test; îl poți schimba: `.\scripts\nexus-dev.ps1 -Action login -Email alt@exemplu.ro -Password 'parola-mea'`.

### Aplicația web locală și originea sigură

Shell-ul încarcă `http://localhost:5000`, nu un site public. Portul vine din `PORT` (în `apps/nexus-web/.env`); dacă îl schimbi, transmite-l și scriptului: `.\scripts\nexus-dev.ps1 -Action web -WebPort 6000`.

`localhost` este considerat de WebView o origine de încredere, la fel ca în browser: `getUserMedia` (camera și microfonul folosite de clientul web), `crypto.subtle` (E2EE) și portofelul funcționează fără un certificat HTTPS public. Alternativa locală cu `.certs` și `https://<LAN-IP>:3443` cere instalarea manuală a unui certificat pe telefon, deci nu este folosită implicit.

Diferențe față de un browser obișnuit, tratate explicit în `src/app/index.tsx`:

- **Notificările** — WebView-ul Android nu implementează `Notification`; un stub injectat înainte de încărcarea paginii evită ca apelurile clientului web să arunce și să oprească randarea.
- **Permisiunile de cameră și microfon** — sunt cerute de aplicație la pornire (`PermissionsAndroid`), pentru că WebView-ul le transmite paginii doar dacă aplicația le deține deja.
- **Deep link-urile** — `http/https` rămân în WebView; orice altă schemă (`xportal://`, `wc:`) este predată sistemului, ca autentificarea cu portofelul să ajungă în aplicația potrivită.
- **Butonul „înapoi"** — navighează în istoricul paginii cât timp există istoric, apoi iese din aplicație.
- **Camera web vs camera nativă** — clientul web primește flagul `window.__NEXUS_SHELL__` înainte de încărcarea scripturilor; în loc să monteze camera web, cere ecranul nativ `src/app/camera.tsx` printr-un mesaj `nexus:open-camera`, iar shell-ul îl deschide cu `router.push('/camera')`. WebView-ul ține ecranul din spate viu, deci sesiunea supraviețuiește revenirii din cameră.
- **Bara de sistem** — `env(safe-area-inset-*)` este `0px` în WebView, deci CSS-ul clientului nu putea rezerva spațiul barei de sistem, iar bara lui de jos rămânea sub ea și nu se putea apăsa. `SafeAreaView` încadrează acum tot shell-ul pe toate cele patru margini, iar pagina nu mai ajunge sub bara de sistem. Din același motiv nu se injectează valorile măsurate în `--nx-safe-*`: shell-ul a rezervat deja spațiul, deci s-ar plăti de două ori.

### Aplicația poate porni în launcher-ul Expo, nu în aplicație

Un client de development are două stări: încărcat de la Metro (Fast Refresh activ) sau oprit în launcher-ul Expo, pe ecranul `DEVELOPMENT SERVERS`. În a doua stare nu poate primi HMR, iar simptomul arată ca „Fast Refresh nu funcționează". După o pornire la rece (inclusiv după `am force-stop`) clientul intră în launcher, deci:

```powershell
npm run dev:open           # deep link către Metro, fără nicio atingere pe telefon
npm run dev:ui             # confirmă textul randat și nu ecranul DEVELOPMENT SERVERS
```

`npm run dev:android` face pasul singur, iar `npm run dev:doctor` eșuează explicit dacă aplicația a rămas în launcher. Măsurat pe telefonul de test: după o salvare în `src/**`, textul nou apare pe ecran în mai puțin de 6 secunde, fără reinstalare (eșantionarea prin arborele de accesibilitate are ~3 s; împingerea HMR propriu-zisă este sub o secundă).

### Telefonul trebuie să fie treaz

Xiaomi adoarme ecranul după 30 de secunde, iar când telefonul intră în Doze update-urile Fast Refresh **nu se pierd, dar sunt amânate** până la trezire; o „actualizare lentă" este de obicei telefonul adormit.

Cu ecranul stins, MIUI suspendă procesul aplicației, iar **WebView-ul nu mai încarcă nimic**: nu doar că Fast Refresh întârzie, ci clientul web se oprește la cereri, iar shell-ul rămâne pe „Se încarcă Nexus…". Simptomul arată ca o aplicație stricată (fără rețea, fără randare), deși codul este corect, iar dovada se ia doar cu ecranul aprins. Verificat pe telefonul de test: cu ecranul stins nu există nicio conexiune către portul 5000; imediat după trezire, WebView-ul descarcă pagina (șase conexiuni simultane) și își creează `Local Storage` în datele aplicației.

Pentru o buclă cu adevărat live:

- ține telefonul la încărcător — `npm run dev:wake` simulează alimentarea, pentru că `svc power stayon true` nu are efect pe baterie (iar scrcpy nu poate scrie `stay_on_while_plugged_in`, vezi mai jos);
- sau crește manual, din setările MIUI, timpul de stingere a ecranului (prin ADB valoarea nu se schimbă);
- ține telefonul **deblocat**: dacă are pattern sau PIN, `wm dismiss-keyguard` și `input swipe` sunt refuzate, deci doar degetul tău poate scoate shell-ul de sub ecranul de blocare.

`npm run dev:android` și `npm run dev:wake` rezolvă trezirea pe trei căi, pentru că MIUI nu lasă ADB-ul să schimbe nici timpul de stingere a ecranului, nici să injecteze gestul de trezire:

- simularea alimentării (`dumpsys battery set ac 1` + `set status 2`) — fără ea `svc power stayon true` nu are efect, pentru că telefonul nu crede că e la priză;
- `svc power stayon true` și `dumpsys deviceidle disable` pentru durata sesiunii;
- apăsarea butonului de alimentare (`input keyevent 26`) **doar** dacă ecranul este chiar stins, citit din `dumpsys display` (`mScreenState=ON/OFF`), ca să nu stingem telefonul din greșeală.

Revertire: `npm run dev:restore` (`dumpsys battery reset`, `svc power stayon false`, `dumpsys deviceidle enable`) sau pur și simplu repornirea telefonului.

### Oglindirea pe PC (scrcpy)

`tools/scrcpy` conține scrcpy 4.1 (open-source, descărcat cu `npm run dev:setup-scrcpy`, ignorat de Git). Scripturile îl pornesc cu `ADB` setat pe adb-ul din SDK-ul rezolvat și cu serialul telefonului, ca să nu apară confuzia „more than one device/emulator" atunci când același telefon este expus prin două transporturi ADB (IP și mDNS). Camera rămâne nativă pe telefon; pe PC se vede exact ce se vede pe telefon.

`npm run dev:android` deschide fereastra de oglindire **detached** (bucla se termină, fereastra rămâne deschisă) și nu mai deschide una nouă dacă rulează deja pentru același telefon. Pe MIUI, două facilități scrcpy sunt refuzate de sistem și nu trebuie considerate funcționale: `--stay-awake` eșuează cu `WRITE_SECURE_SETTINGS` (de aceea trezirea o face scriptul nostru, vezi mai sus), iar tastatura și mouse-ul de la PC nu pot injecta evenimente (`INJECT_EVENTS` — ar cere „USB debugging (Security Settings)"); oglindirea în sine funcționează.

### Capcane rezolvate de scripturi

- **Calea SDK-ului**: variabila de utilizator `ANDROID_HOME` poate arăta spre o cale vizibilă doar în containerul aplicației împachetate (MSIX redirecționează `%LOCALAPPDATA%` în `LocalCache`). `scripts/nexus-env.ps1` rezolvă determinist JDK-ul și SDK-ul (variabile de mediu, apoi `%LOCALAPPDATA%\Android\Sdk`, apoi `LocalCache`-ul pachetelor MSIX) și exportă `JAVA_HOME`/`ANDROID_HOME` pentru Gradle și Expo.
- **Fișierele `.ps1` se salvează UTF-8 cu BOM.** Windows PowerShell 5.1 citește fișierele fără BOM ca ANSI; diacriticele devin caractere greșite, iar un em-dash (`—`) se transformă într-o ghilimă inteligentă care închide șirul și rupe sintaxa scriptului.
- **Valorile returnate de `Invoke-WebRequest`**: în Windows PowerShell 5.1, fără `charset` în antet, `Content` este `byte[]`; verificarea `/status` decodează explicit UTF-8.
- **Prima cerere HTTP dintr-un proces PowerShell este lentă**: pornirea stivei .NET costă câteva secunde (măsurat 3–8 s pe această mașină), iar cererile următoare răspund în zeci de milisecunde. Verificările `/status` (Metro) și `/health` (aplicația web) folosesc `-TimeoutSec 10`; cu 3 s, `doctor` raporta „nu răspunde" pentru un server care rula, iar scriptul încerca să pornească un al doilea server pe portul ocupat.
- **stderr de la adb când `$ErrorActionPreference = 'Stop'`**: mesajele de progres („1 file pulled") sau avertismentele (`Activity not started`) devin erori fatale și opresc scriptul la jumătate; `Invoke-NexusAdb` rulează adb cu `Continue` și păstrează doar ieșirea standard.
- **`Start-Process` și argumentele cu spații**: `-ArgumentList` le concatenează fără ghilimele, deci `--window-title 'Nexus Dev'` ajungea la scrcpy ca două argumente (`ERROR: Unexpected additional argument: Dev`) și fereastra de oglindire se închidea imediat; titlul se trimite deja ghilimat.
- **Jurnalul Metro nu dovedește HMR**: Metro scrie în `builds/metro.log` bundle-urile complete și erorile, nu fiecare actualizare livrată prin websocket la Fast Refresh; dovada că o modificare a ajuns pe ecran se ia cu `npm run dev:ui` (textul din arborele de accesibilitate), nu din jurnal.
- **Cleartext doar în debug**: WebView-ul respectă politica de cleartext a aplicației, iar `android:usesCleartextTraffic="true"` există doar în manifestul de debug generat de `expo prebuild` (`android/app/src/debug/AndroidManifest.xml`). Un build de release ar refuza `http://localhost:5000`, deci originea sigură este o proprietate a build-ului de development, nu a WebView-ului.
- **Portul aplicației web**: `PORT` din `apps/nexus-web/.env` (în acest repository 5000, nu 3000 ca în `.env.example`) trebuie să coincidă cu `-WebPort` al scriptului și cu `adb reverse`. `server.js` citește singur `.env`-ul de lângă el (`lib/env.js` îl rezolvă față de modul, nu față de directorul curent), deci valoarea nu depinde de unde pornești comanda.

## Verificări locale

Build-ul nativ cere JDK 17 și Android SDK 36; le rezolvă singur `scripts/nexus-env.ps1`. Scriptul copiază doar sursele clientului într-un director izolat și verificat, `C:\nxm`, deoarece calea lungă a repository-ului depășește limita Ninja pe Windows. APK-ul arm64 rezultat este copiat în `builds/nexus-dev-arm64.apk` (ignorat de Git). `adb install -r` actualizează aceeași aplicație dev, fără a crea o instalare nouă la fiecare build.

APK-ul actual este un build **debug/development**, nu unul de Play Store. Conține shell-ul (`react-native-webview`, plus modulele native ale camerei, video-ului și stocării locale); ecranele produsului — feed, profil, mesagerie, editor — sunt cod web livrat de serverul local, deci nu sunt în APK. Nu introduce date reale sensibile în acest build de development: baza de date și fișierele media trăiesc pe PC, în `apps/nexus-web/data`.
