# Nexus Android — Etapa 1: audit UI/API înainte de migrarea vizuală

Data: 2026-10-06. Scop: login/sesiune, feed, profil și meniurile aferente. Acesta este un audit read-only al aplicației; nu este aprobarea unei redesenări sau dovada parității native.

## Ecrane web și API-uri relevante

| Suprafață existentă | Sursă UI principală | API folosit / contract | Observație pentru portarea nativă |
| --- | --- | --- | --- |
| Landing/login | `apps/nexus-web/public/app.js` `renderLanding` și `styles.css` | `GET /api/providers`, `POST /auth/email/login`, `GET /api/me`; înscrierea și xPortal au fluxuri separate | Landing-ul are wordmark cu X colorat, tagline, panouri distincte pentru Google/Facebook/xPortal/email și cont nou; nu este formularul generic introdus în Android. |
| Sesiune/persona | `app.js` inițializare + selector de profil | `GET /api/me`, `POST /api/persona/switch`, `POST /auth/logout` | Cookie-ul WebView anterior nu este transferat automat în fetch-ul nativ. Durabilitatea autentificării Android și relogarea trebuie probate, fără a cere sau loga parola utilizatorului în teste. |
| Feed Social | `app.js` `renderHeader`, `renderNav`, `loadFeed`; `feed-surface.js`, `feed-hub.js`, `feed-surface.css`, `social-human-ux.css` | `GET /api/social/feed` cu perechi `lens`/`format` diferite pentru Reels, Whispers, News și sursele feedului; cursor pentru paginare | Header cu wordmark SVG/versiune, comutator de mod, butonul propriului drawer; navigație Social cu 7 sloturi, nu 3. Media și acțiunile sunt mai complexe decât cardul nativ actual. |
| Profilul propriu | `app.js` `renderProfiles`, `profile-experience.js`, `profile-experience.css`, `profile-menu.js` | `GET /api/account`, `GET /api/profiles/:handle?persona=social`; acțiunile profilului au endpoint-uri separate | Profilul web nu folosește antetul global; are cover/avatar, statistici, highlights, grilă și taburi proprii. Loading/error sunt desenate în același shell. |
| Meniu feed/module | `feed-surface.js` `feedQuickDrawerMarkup`, `app.js` | Folosește starea curentă; la selectarea unei persona poate apela `POST /api/persona/switch`; logout `POST /auth/logout` | Drawer compact cu iconițe, nu o listă nouă de ecrane. |
| Meniu profil | `profile-menu.js`, `profile-experience.css`, `app.js` | Se bazează pe profilul și contul încărcate; fiecare panou are contractul său | Intrări: profil, wallet, acces, confidențialitate, notificări, aspect și logout. Etapa 1 poate reproduce shell-ul/meniul, dar panourile încă nemigrate nu trebuie prezentate ca funcționale. |

În afara etapei 1 există în `app.js` module/ecrane pentru mesaje, căutare, prieteni, live, work, dating, travel, market, watch, kids, music, wellbeing, creator, node și altele. Nu sunt autorizate pentru implementare în acest pas.

## Diferența concretă față de development buildul Android

- `apps/nexus-mobile/src/app/index.tsx` conține acum un ecran nou: `NEXUS` în text simplu, `Android 0.1.0`, formular centrat și bara `Feed / + / Profil`. Captura trimisă de proprietar confirmă că acesta este vizibil pe Xiaomi și că nu corespunde UI-ului aprobat.
- Webul folosește `nexusWordmarkMarkup()` cu SVG-ul original și `NEXUS_BUILD_VERSION = "1.11"`, iar în Social `NAV.social` are șapte sloturi. Pagina profilului elimină antetul global. Acestea sunt diferențe structurale, nu doar culori de ajustat.
- Stilul web este împărțit între mai multe foi CSS, cu proprietăți precum blur/backdrop-filter, gradiente, `color-mix`, taburi și animații. React Native nu interpretează CSS/DOM; reproducerea trebuie implementată din nou și comparată pe Xiaomi cu capturi ale aceleiași stări, aceleiași dimensiuni și aceleiași versiuni de conținut.
- Feedul și profilul autentificate nu au fost probate încă în clientul nativ cu contul proprietarului. Nu se poate afirma că postările reale sau media protejată se afișează doar din faptul că apelurile API sunt scrise în cod.

## Gate înainte de editarea aplicației

Proprietarul a cerut interfață **identică**, nu o reinterpretare. Între DOM/CSS și componente React Native nu se poate garanta identitate pixel-cu-pixel fără o toleranță vizuală definită și verificări pe dispozitiv; în plus, pentru login, feed, profil și ambele meniuri trebuie fixate stările de referință (inclusiv datele afișate). Conform cerinței proprietarului, nu modifica ecranele Android până nu confirmă că acceptă o implementare React Native verificată prin comparație de capturi pe Xiaomi și definește ce abatere, dacă există, este permisă. Nu folosi WebView ca scurtătură și nu schimba designul web.

Fără această confirmare, rezultatul acestei etape este auditul de mai sus; TypeScript/lint se rulează după o modificare de cod, nu sunt probe noi de paritate vizuală.
