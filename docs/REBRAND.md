# Rebrand „Jungle Book” — inventar și decizii (17 octombrie 2026)

Aplicația se numește **Jungle Book** (fost Nexus). Documentul acesta ține evidența fiecărui loc în care
apărea numele vechi: ce s-a schimbat, ce a rămas deliberat neschimbat și de ce. Este sursa de adevăr
pentru `scripts/test-brand.cjs`, care pică dacă în `src/` reapare un text vizibil cu numele vechi.

## 1. Regula

| Categorie | Ce înseamnă | Ce facem |
|---|---|---|
| **vizibil** | orice ajunge pe ecran, în vocea sistemului de accesibilitate sau în notificări: texte JSX, `label`, `title`, `placeholder`, `accessibilityLabel`, mesaje de eroare și toast-uri | se schimbă în „Jungle Book” |
| **tehnic** | identificatori de care atârnă instalarea, sesiunea, datele locale sau protocolul: package, scheme, slug, chei de stocare, cookie-uri, antete, căi API, variabile de mediu, mesaje semnate, nume de module/funcții/fișiere | **rămân neschimbați** |
| **documentație** | titluri și explicații în README, HANDOFF, MIGRATION, docs | se schimbă, cu „fost Nexus” unde ajută la orientare |

Nu s-a atins **web-ul** (`apps/nexus-web`) și nici **backend-ul**: rebrand-ul este al aplicației native.
Datele de test de pe server (de exemplu numele „Test Nexus”) rămân exact cum sunt.

Documentele istorice de produs din `docs/00…24` descriu specificația scrisă sub numele vechi și **nu** au
fost rescrise: sunt arhivă, nu interfață. S-au schimbat doar titlurile documentelor vii (README, HANDOFF,
MIGRATION, DEV-WORKFLOW) și s-a adăugat acest fișier.

## 2. Ce s-a schimbat (vizibil)

| Fișier | Text / identificator | Categorie | Decizie | Motiv |
|---|---|---|---|---|
| `src/theme/brand.ts` (nou) | `BRAND_NAME = 'Jungle Book'`, `BRAND_TICKER = 'JUNGLE'` | vizibil | schimbat (nou) | un singur loc pentru nume și simbol; `test:brand` pică la orice `JB`/`JBc` vizibil |
| `src/components/BrandLogo.tsx` (nou) | logo `header` / `circle` / `large` | vizibil | schimbat (nou) | o singură componentă încarcă marca; nimeni nu mai încarcă o imagine de brand altfel |
| `src/components/NexusLandingBrand.tsx` | glif SVG + `NEXUS` → logo mare + `JUNGLE BOOK` | vizibil | schimbat | login-ul arată marca instalată, nu un desen paralel |
| `src/components/AppHeader.tsx` | wordmark SVG → `BrandLogo header` (36 dp, 44 dp zonă de atingere) | vizibil | schimbat | antetul poartă logo-ul, nu un al doilea wordmark |
| `src/components/AppHeader.tsx` | `Nexus Home · revino la prima pagină` | vizibil (a11y) | schimbat | citit de TalkBack |
| `src/components/AppHeader.tsx` | `Schimbă profilul Nexus` | vizibil (a11y) | schimbat | citit de TalkBack |
| `src/components/AppNav.tsx` | `+` din butonul central → `BrandLogo circle` | vizibil | schimbat | logo în bara de jos; funcția, eticheta „Creează” și zona de atingere rămân |
| `src/components/FeedDrawer.tsx` | antet nou: logo + „Jungle Book” | vizibil | schimbat | sertarul se identifică |
| `src/components/FeedDrawer.tsx` | subsol `Jungle Book · Android … · API: …` | vizibil | schimbat | versiunea și originea rămân lizibile |
| `src/components/MessengerTopbar.tsx` | wordmark → logo; `Nexus Home …` | vizibil | schimbat | inbox-ul poartă aceeași marcă |
| `src/app/index.tsx` | `Se încarcă Nexus…` → `Se încarcă Jungle Book…` | vizibil | schimbat | ecranul de pornire |
| `src/app/index.tsx` | `Schimbă Nexus ${moduleTitle} …` | vizibil (a11y) | schimbat | citit de TalkBack |
| `src/app/camera.tsx` | `NEXUS` → `JUNGLE BOOK` | vizibil | schimbat | titlul camerei |
| `src/components/ActivityCenter.tsx` | `Activitate Nexus` (3 locuri) | vizibil | schimbat | ecran de activitate |
| `src/components/CaptureEditor.tsx` | `Muzică Nexus` | vizibil | schimbat | panoul de muzică |
| `src/components/ContactCard.tsx` | `Mesaj Nexus`; nume implicit `Nexus` | vizibil | schimbat | card de contact |
| `src/components/MediaViewer.tsx` | `Distribuie în afara Nexus` (etichetă + text) | vizibil | schimbat | foaia de distribuire |
| `src/components/ReelsReader.tsx` | `Distribuie în afara Nexus` | vizibil | schimbat | foaia de distribuire |
| `src/components/NewConversationSheet.tsx` | `Username Nexus`, `username-uri Nexus` | vizibil | schimbat | foaia de conversație nouă |
| `src/components/PublishPanel.tsx` | `Marcajul Nexus …`, `Watermark Nexus` | vizibil | schimbat | panoul de publicare |
| `src/components/StoryViewer.tsx` | `Nexus Story`; nume implicit `Nexus`; `@nexus` | vizibil | schimbat | viewer de story-uri |
| `src/components/ProfileWhisperCard.tsx` | nume implicit `Nexus`; `Postarea lui @nexus` | vizibil | schimbat | card de profil |
| `src/screens/MessagesScreen.tsx` | `username-ul Nexus`; nume implicit `Nexus` | vizibil | schimbat | lista de mesaje |
| `src/screens/FriendsScreen.tsx` | nume implicit `Nexus`; `@nexus` (3 locuri) | vizibil | schimbat | cereri de urmărire |
| `src/screens/LiveScreen.tsx` | nume implicit `Nexus`; `@nexus` | vizibil | schimbat | lista Live |
| `src/lib/relations.ts` | `Mesaj Nexus` | vizibil | schimbat | eticheta relației |
| `src/lib/profileContent.ts` | nume implicit `Nexus` | vizibil | schimbat | arhiva profilului |
| `app.json` | `expo.name` `Nexus Dev` → `Jungle Book Dev`; icon, adaptiveIcon, splash, favicon | vizibil | schimbat | numele de pe launcher și imaginile native |

## 3. Ce a rămas neschimbat (tehnic) și de ce

| Identificator | Unde | Decizie | Motiv |
|---|---|---|---|
| `app.nexus.mobile.dev` | `app.json`, `android/`, `nexus-dev.ps1`, `am start -n` | păstrat | package-ul este identitatea aplicației instalate; schimbarea lui ar instala o aplicație nouă, ar pierde sesiunea și drafturile |
| `scheme: "nexusdev"` | `app.json`, deep link-uri | păstrat | link-urile deja trimise ar muri |
| `slug: "nexus-mobile"` | `app.json` | păstrat | identifică proiectul pentru toolchain |
| `nexus-prefs` | `src/lib/bandPrefs.ts` etc. | păstrat | cheie de stocare locală: redenumirea pierde preferințele salvate |
| `nexus_session` (cookie + `Authorization`) | `src/lib/*` | păstrat | numele cookie-ului și al antetului sunt contract cu serverul |
| `nexus_device_id` | antet HTTP | păstrat | contract cu serverul |
| `NEXUS_*` | variabile de mediu | păstrat | configurarea de pe stație/Railway |
| `https://nexus-deepsek-production.up.railway.app` | `src/lib/apiOrigin.ts` | păstrat | adresa Railway |
| `/api/...` | toate rutele | păstrat | căile serverului |
| mesajele și challenge-urile semnate la login | `src/lib/session.ts` | păstrat | textul intră în semnătură; schimbarea lui ar rupe autentificarea |
| `nexus-session`, `nexus-uploads`, `nexus-camera-tests`, `nexus-mobile-*`, `nexus-upload-v1:*` | `src/lib/*` | păstrat | directoare de lucru, chei de idempotență și de deduplicare |
| `application/vnd.nexus.e2ee` | `src/lib/uploadClient.ts` | păstrat | tip MIME înțeles de server |
| `NexusApiError`, `nexusApi`, `nexusTokens`, `NexusLandingBrand`, `NexusMark`, `NexusLogin`, `NexusWordmark` (șters) | cod | păstrat / parțial | identificatori de cod, nu text citit de utilizator |
| `--nexus-*` | `src/theme/webTokens.ts` | păstrat | proprietăți CSS moștenite din temă |
| `[Nexus camera]` | loguri `__DEV__` | păstrat | prefix de log, nu apare în interfață |
| `NexusWordmark.tsx` | componenta wordmark-ului vechi | **șters** | nu mai are niciun consumator; `nexusTokens.graphics.wordmarkSvg` a fost eliminat odată cu ea |
| numele repo-ului, folderele `apps/nexus-*`, branch-ul, testele | infrastructură | păstrat | în afara produsului |

## 4. Ce trimite serverul și încă spune „Nexus” (propunere aditivă, nu patch în client)

Clientul afișează unele propoziții exact cum vin de la server. Nu le înlocuim în client: un `replace` ar
minți despre sursă și ar rupe traducerile. Propunerea este o schimbare **aditivă** pe backend, într-o
singură bucată, când se atinge backend-ul:

| Loc | Text | Propunere |
|---|---|---|
| `apps/nexus-web/public/interface-locale.js` — `publicProfile.message` | „Mesaj Nexus” | `brand.name` configurabil, implicit „Jungle Book”; web-ul și telefonul citesc aceeași valoare. Până atunci telefonul are propria etichetă (testul `test-relations.cjs` notează divergența) |
| `apps/nexus-web/lib/api.js` — mesaje de eroare care numesc produsul | diverse | la fel: un singur loc de brand, ca mesajul serverului să nu contrazică ecranul |
| date de test (conturi, nume afișat „Test Nexus”) | date, nu cod | **rămân** — nu sunt branding, sunt conținutul de test |

## 5. Logo: sursa, prelucrarea, verificarea

* Surse, în ordinea încercată: `apps/nexus-mobile/assets-src/jungle-book-logo-transparent.png` (dacă
  proprietarul îl pune acolo — se validează antetul `89 50 4E 47 0D 0A 1A 0A`, decodarea și existența
  pixelilor cu alfa 0) și, în lipsa lui, `apps/nexus-mobile/assets-src/jungle-book-logo.jpg`
  (JPEG valid `FF D8 FF`, 784×1168). Azi arborele are doar JPEG-ul, deci s-a folosit JPEG-ul. Niciuna
  dintre imagini nu a fost citită sau atașată în conversație; totul s-a prelucrat din terminal.
* Generator: `node tools/brand/make-assets.mjs` → `tools/brand/make-assets.ps1` (PowerShell cu C# inline
  compilat de `Add-Type`, System.Drawing, `LockBits`; fără `sharp`, fără dependențe noi). Pașii, exact
  cei din cerință:
  1. culoarea câmpului = **mediana** benzii de margine (nu un colț), plus abaterea măsurată `sigma`;
  2. distanța RGB a fiecărui pixel față de câmp; pragurile se deduc din `sigma` (rularea reală:
     `sigma = 6,89` → praguri **22 / 57**, de ordinul 18/48 cerut);
  3. componente conexe ale pixelilor „asemănători câmpului”: devin transparente cele care ating marginea
     sau depășesc **0,15%** din imagine (asta golește și contururile literelor și spațiile dintre fructe);
     cele mici rămân **opace**, ca frunzele și umbrele închise să nu dispară;
  4. decontaminarea marginii: `F = (C − (1−a)·Câmp) / a`, limitat la 0–255, ca să nu rămână halou verde;
  5. petele opace sub **20 px** sunt șterse, iar marginea este netezită pe un pixel;
  6. decupaj strâns pe caseta alfa, cu margine **4%**, într-un pătrat transparent.
* **O deviație, măsurată, de la rampa liniară.** Rampa liniară între cele două praguri, aplicată direct pe
  distanță, a produs o margine late de **49 px** (umbrele moi ale fotografiei traversează banda lent); pe
  fundal negru, frunzele din acea bandă ar fi ieșit pe jumătate transparente. De aceea alfa este decisă
  binar de prag (membru / nu e membru), masca trece printr-un **vot de majoritate 5×5** (care toacă
  scara de 1 px a umbrelor) și abia apoi printr-o **medie 3×3**, care lasă exact un pixel de tranziție.
  Rezultatul măsurat: rampa (percentila 90 a distanței până la capătul cel mai apropiat) este **3 px** la
  1024 și **1–2 px** la toate celelalte mărimi; procentul de pixeli semitransparenți aflați departe și de
  opac și de gol („ceață”) este **2,35%** la 1024 și 0 la restul.

* Ieșire în `apps/nexus-mobile/assets/brand/` (13 fișiere + `stats.json`): `jb-mark-1024.png`,
  `jb-mark-512.png`, `jb-mark-header-{1x,2x,3x}.png` (36/72/108 px = 36 dp), `jb-mark-nav-{1x,2x,3x}.png`
  (40/80/120 px = 40 dp), `jb-splash-512.png`, `jb-icon-foreground-1024.png` (literele în zona sigură de
  66%, restul transparent), `jb-icon-background-1024.png` (verde uniform `#02150D`),
  `jb-icon-monochrome-1024.png` (silueta albă din canalul alfa), `jb-icon-1024.png` (iconița pătrată pentru
  launcher-ele vechi: marca pe câmp). Fișierele vechi cu fundal (`jb-logo-*`, `jb-logo-circle-256`,
  `jb-splash-1080x1920`) sunt **șterse automat** de generator la fiecare rulare (rularea de azi a raportat
  6 fișiere vechi eliminate), deci nu pot rămâne în urmă. Fișierele din `assets/` (`icon.png`,
  `android-icon-*.png`, `splash-icon.png`, `favicon.png`) nu sunt referite de `app.json` și pot fi șterse
  într-un lot separat.
* Verificare numerică la fiecare rulare (scriptul iese cu cod 1 dacă nu se potrivește): dimensiunile
  fiecărui fișier, colțurile straturilor transparente au alfa 0, colțurile straturilor opace au alfa 255,
  fracția transparentă a pătratului între 25% și 60%, zero pete izolate, rampa de margine ≤ 3 px, ceața
  ≤ 5%, iar „probele de fruct” (punctul cel mai adânc din fiecare dintre cele două litere, găsit ca punct
  cu distanța maximă până la marginea componentei) au alfa 255. Toate acestea ajung în
  `assets/brand/stats.json`.
* Rularea reală, 17 oct 2026: câmp `#03180F` (`sigma` 6,89; praguri 22/57), litere 630×587, decupaj 680 px,
  marca **55,4% transparentă**, rampă 3 px, 0 pete, ceață 2,35%, probe la (596,490) și (164,790) cu alfa
  255, 13 fișiere. **Verificarea vizuală pe telefon rămâne a proprietarului** — dacă pe negru se vede
  halou sau lipsesc frunze, se crește raza votului de majoritate (2 → 3) și se rerulează generatorul.
* A doua rulare scrie exact aceleași fișiere: generatorul este determinist (hash-urile ambelor rulări sunt
  comparate în `make-assets.mjs`, iar un rezultat care diferă este refuzat).

* **Splash:** `expo-splash-screen` (`~57.0.10`, gratuit) este instalat, iar `app.json` îl are ca plugin cu
  `image: jb-mark-1024.png` (marca transparentă), `imageWidth: 200`, `resizeMode: contain` și
  `backgroundColor: #000000`. Fundalul este `nexusTokens.colors.canvas`, adică exact culoarea ecranului de
  login, ca să nu existe nicio săritură de culoare între splash și aplicație (înainte cheia `splash` era
  ignorată de prebuild, iar ecranul pornea alb). Cheia `splash` de la nivelul de sus a fost scoasă, ca să nu
  pară că mai are efect.
* **Bara și butonul central:** marca nu are ramă, pătrat, mască circulară sau fundal propriu — fișierul este
  transparent. Antetul și inbox-ul o desenează la 36 dp (`variant="header"`), butonul central la 70% din
  diametrul interior al inelului (`variant="nav"`, 31 dp dintr-un interior de 44 dp), login-ul la 132 dp
  (`variant="large"`). Inelul butonului și zona lui de atingere au rămas neschimbate.
* **Testul de active:** `npm run test:brand-assets` (inclus în `npm test`) citește `stats.json`, ține
  limitele în chiar fișierul testului, decodează PNG-urile cu `zlib` (fără dependențe) și compară pixelii
  cu raportul: colțuri, fracția goală, probele, plus hash-ul fiecărui fișier, ca un PNG editat de mână sau
  un `stats.json` vechi să nu poată trece. Testul a fost probat cu o valoare injectată (`specks: 3`) și a
  picat, apoi a trecut după restaurare.
* Iconița de notificare nu a fost generată: proiectul nu are `expo-notifications`, deci nu există un strat
  de notificare care să o folosească.

## 6. Anti-regresie

`node scripts/test-brand.cjs` scanează fiecare literal de text și fiecare nod text JSX din
`apps/nexus-mobile/src` și pică la orice „Nexus” care nu e în lista de excepții documentată chiar în script
(căi de modul, cookie-ul de sesiune, chei de stocare, MIME, căi API, adresa Railway). Verifică în plus că
`app.json` se numește „Jungle Book…”. Rulează în aceeași suită cu celelalte contracte.

