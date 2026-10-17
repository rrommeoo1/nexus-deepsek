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
| `src/theme/brand.ts` (nou) | `BRAND_NAME = 'Jungle Book'`, `BRAND_TICKER = 'JB'` | vizibil | schimbat (nou) | un singur loc pentru nume și simbol |
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

* Sursa: `apps/nexus-mobile/assets-src/jungle-book-logo.jpg` — JPEG valid (`FF D8 FF`), 784×1168, 24 bpp.
  Nu a fost citită cu instrumente de imagine din conversație; a fost prelucrată exclusiv din terminal.
* Generator: `node tools/brand/make-assets.mjs`, care rulează `tools/brand/make-assets.ps1` (System.Drawing;
  `sharp` nu este instalat în proiect și nu s-a adăugat). Scriptul detectează singur culoarea câmpului din
  cele patru colțuri, găsește caseta literelor și decupează un pătrat cu margine de 6%.
* Ieșire în `apps/nexus-mobile/assets/brand/`: `jb-logo-1024.png`, `jb-logo-circle-256.png`,
  `jb-logo-header-{1x,2x,3x}.png` (36/72/108 px = 36 dp), `jb-icon-foreground-1024.png`,
  `jb-icon-background-1024.png`, `jb-icon-1024.png`, `jb-icon-monochrome-1024.png`,
  `jb-splash-1080x1920.png`. Fișierele vechi din `assets/` (`icon.png`, `android-icon-*.png`,
  `splash-icon.png`, `favicon.png`) au rămas pe disc dar **nu mai sunt referite de `app.json`**; se pot șterge
  într-un lot separat, după ce noul APK e confirmat pe telefon.
* Verificare numerică la fiecare rulare (scriptul iese cu cod 1 dacă nu se potrivește): dimensiunile fiecărui
  fișier, colțul opac = culoarea câmpului eșantionat, colțurile straturilor transparente au alfa 0, centrul
  are alfa 255 (monocromul poate avea centrul transparent — literele nu umplu mijlocul).
* Rularea reală, 17 oct 2026: câmp `#02150D` (împrăștiere între colțuri 9), litere 629×587, decupaj 705 px
  la (32, 200), 10 fișiere, 7,9 s. **Verificarea vizuală pe telefon rămâne a proprietarului.**
* A doua rulare a scris exact aceleași fișiere (arborele git a rămas curat), deci generatorul este
  determinist și poate fi rerulat înainte de orice build.
* **Ecranul de pornire:** `app.json` are cheia `splash`, dar prebuild-ul Expo SDK 57 o ignoră fără
  `expo-splash-screen` (dependență gratuită, neinstalată). APK-ul curent pornește cu marca în centru pe
  fundalul implicit alb; pentru `#02150D` trebuie adăugat pluginul — comenzile exacte sunt în
  `docs/DEV-WORKFLOW.md`.
* Iconița de notificare nu a fost generată: proiectul nu are `expo-notifications`, deci nu există un strat
  de notificare care să o folosească.

## 6. Anti-regresie

`node scripts/test-brand.cjs` scanează fiecare literal de text și fiecare nod text JSX din
`apps/nexus-mobile/src` și pică la orice „Nexus” care nu e în lista de excepții documentată chiar în script
(căi de modul, cookie-ul de sesiune, chei de stocare, MIME, căi API, adresa Railway). Verifică în plus că
`app.json` se numește „Jungle Book…”. Rulează în aceeași suită cu celelalte contracte.

