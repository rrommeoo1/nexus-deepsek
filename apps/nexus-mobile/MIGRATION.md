# MIGRATION.md — Nexus Android (Expo/React Native)

Memoria migrării. Se actualizează continuu: ce e gata, ce rămâne, deciziile luate, problemele cunoscute.
Referința este versiunea web (`apps/nexus-web`) și site-ul live de pe Railway. Regula de aur: se
transcriu valorile exacte din CSS/cod, nu se estimează și nu se redesenează nimic.

> **Gate curent stabilit de owner (2026-10-07): audit exhaustiv înainte de orice ecran nou.**
> Secțiunile 0–17 sunt jurnal istoric și pot conține verdicturi „gata” date după implementarea în cod,
> nu după aprobarea vizuală. Pentru decizia de migrare, prevalează §18 de mai jos: doar loginul este
> aprobat; niciun alt ecran nu primește statusul **gata** fără fișă completă, capturi comparate pe
> Railway/Xiaomi și aprobarea explicită a owner-ului. Nu se continuă cu portarea Etapei 1 până la
> închiderea inventarului de surse și confirmarea fișei ecranului următor.

Legendă stare: **gata** = portat și verificat pe Xiaomi · **parțial** = portat, neverificat pe dispozitiv
sau cu detalii lipsă · **lipsă** = neportat.

## 0. Stare globală

| # | Etapă | Stare |
| - | - | - |
| 1 | Sesiune persistentă, navigație Social (7 poziții), feed + profil reale, meniu, refresh, stări de încărcare/eroare/reluare | **gata** (codul), verificare pe dispozitiv în curs |
| 2 | „+" și camera nativă conectată la flux (foto/video/zoom/import/previzualizare, permisiuni) | **gata** (codul) — 9:16 implicit pentru foto/video, comutare directă 3:4, selfie, lumină, timer, import galerie și selecție Jamendo prin Railway; captura ajunge în composer (`camera.tsx` → `CaptureEditor` → `PublishPanel`); verificarea comenzilor noi pe Xiaomi este încă necesară |
| 3 | Editor (text, emoji/stickere mutabile, muzică Jamendo, randare finală) | **parțial** — text mutabil + emoji + căutare/previzualizare Jamendo în draft; compunere finală lipsă |
| 4 | Publicare (copertă, titlu, descriere, hashtaguri, mențiuni, locație, link, vizibilitate, comentarii, repost, AI, descărcare, watermark, draft, postare reală, fără dublare la retry) | **parțial** — formular complet (titlu, descriere, #/@, locație + precizie, link, vizibilitate, comentarii/repostare/descărcare/watermark, declarație AI, drepturi audio + atribuire), salvare în cont și publicare reală din aplicație, cu cheie de idempotency per intenție; rămân neportate: compunerea finală a fișierului (watermark/overlay ars), salvarea pe dispozitiv și etichetarea persoanelor după id |
| 5 | Restul ecranelor (comentarii, notificări, mesaje, căutare, setări etc.) | **parțial** — comentariile sunt portate (fir citit/scris prin API-ul real, `CommentsSheet`); mesaje (`MessagesScreen`), căutare (`SearchScreen`), prieteni (`FriendsScreen`) și live (`LiveScreen`) sunt **portate nativ** pe endpoint-urile reale (§12), cu stări oneste; rămân **lipsă**: notificări și setări |

## 1. Decizii tehnice (și de ce)

1. **Sesiune nativă durabilă fără WebView.** Serverul autentifică prin cookie-ul `nexus_session`, dar
   `requireAuth` (`apps/nexus-web/lib/api.js:384`) acceptă același token și ca
   `Authorization: Bearer <token>`. La login, clientul citește `Set-Cookie` din răspuns, păstrează
   tokenul în directorul privat al aplicației (`expo-file-system`, `nexus-session/session.json`) și îl
   trimite la fiecare cerere. Nu se salvează parola nicăieri.
   - Dacă platforma nu expune `Set-Cookie`, sesiunea se bazează pe cookie jar-ul nativ
     (`cookieSession: true`), iar `/api/me` este verificat la fiecare pornire. Un 401 șterge sesiunea
     locală și readuce formularul de login.
   - `expo-secure-store` ar fi mai puternic (Keystore), dar este o dependență nativă nouă ⇒ APK nou.
     S-a ales stocarea în directorul privat, cu aceeași protecție ca stocarea de cookie a platformei.
2. **Persona Social.** `GET /api/social/feed` cere persona activă `social` (409 altfel). La autentificare
   și la pornire, aplicația face exact ce face webul: `POST /api/persona/switch {persona:"social"}`.
3. **Gradiente fără dependență nouă.** CSS-ul folosește `linear-gradient`/`radial-gradient`. În React
   Native acestea sunt redate cu `react-native-svg` (`LinearGradient`/`RadialGradient` plus `Rect`), o
   bibliotecă deja instalată, în loc de `expo-linear-gradient` (ar fi cerut APK nou).
   - `inset 0 1px rgba(255,255,255,.09)` (umbră interioară, nesuportată nativ) este redat ca o bandă de
     1px la partea de sus/jos a sticlei, cu aceeași opacitate.
4. **Bara de 60px și inset-ul de sistem.** CSS-ul are `height:60px` cu `padding-bottom:max(6px, env(...))`
   și o sticlă de 50px la `top:4px`. Ca să nu se comprime sticla pe dispozitive cu bara de gesturi, în
   nativ înălțimea barei este `4 + 50 + max(6, inset.bottom)`, iar sticla rămâne exact 50px. Este
   comportamentul pe care CSS-ul îl urmărea, scris explicit.
5. **Versiuni distincte (cerința 8).** Sub logo se afișează `Android <versiune app.json>` și, când poate
   fi citit, `Backend <versiune>` extrasă din `/app.js` al originii configurate (constanta
   `NEXUS_BUILD_VERSION` a release-ului care servește contul). Nu există endpoint de versiune pe
   backend; nu se inventează niciun număr — dacă nu poate fi citit, rândul lipsеște.
   - Îmbunătățire viitoare (necesită acord, modifică backend-ul): un `GET /api/meta` care să publice
     versiunea aplicației web.
6. **Fără localhost / adb reverse.** `EXPO_PUBLIC_NEXUS_API_URL` (implicit URL-ul Railway al owner-ului)
   este singura sursă a originii (`src/lib/apiOrigin.ts`).
7. **Chei externe.** Jamendo rămâne exclusiv pe Railway (`JAMENDO_CLIENT_ID`); aplicația folosește doar
   `/api/reels/sound-suggestions` și afișează eroarea serverului când providerul nu e configurat.
8. **Frontiera de replay pentru mutații (identică cu webul).** Serverul învelește fiecare
   `POST`/`PUT`/`PATCH`/`DELETE` din afara `/api/uploads` în `prepareMutation` (`lib/api.js:1739`):
   fără `Idempotency-Key` răspunde `400 IDEMPOTENCY_KEY_REQUIRED`. `/auth/email/login` și
   `/auth/logout` sunt pe aceeași frontieră (`assertEmailAuthIdempotencyKey`). Webul completează cheia
   automat (`public/client.js` `api()`), iar loginul are cheia proprie (`data-login-key`). Clientul
   nativ face identic: `nexusApi` generează cheia pentru orice metodă mutatoare
   (`src/lib/nexusApi.ts`), iar `signInWithEmail`/`signOut` o trimit explicit (`src/lib/session.ts`).

## 2. Fișa 1 — Login / Landing

Sursă: `app.js` `renderLanding` + `styles.css`, `p3-visual-foundation.css`. Tokeni: `src/theme/tokens.ts`.

- **Elemente vizuale:** wordmark cu X colorat (`NexusLandingBrand`), tagline, panouri separate Google /
  Facebook / xPortal / email / cont nou, separator „sau cu email", câmpuri email+parolă, „Ai uitat parola?",
  nota de sub formular, versiunea sub logo. Culori, fonturi, spațieri și raze: transcrise în `tokens.ts`
  (card 430px, buton min-height 50, câmp 50/radius 14, glif 40×40 cu `clip-path` transcris în SVG).
- **Comportamente:** scroll (după raportul owner-ului pagina trebuie să fie derulabilă), tastatură cu
  `keyboardShouldPersistTaps`, stări normal/apăsat/dezactivat/busy.
- **Elemente dinamice:** text de eroare sub formular, `busy` care blochează dubla trimitere.
- **Date:** `POST /auth/email/login`, apoi `GET /api/me` (verificarea sesiunii). Google/Facebook nu sunt
  configurate pe server ⇒ butoanele raportează „neconfigurat" în loc de succes fals.
- **Detalii mici:** validare email/lungime parolă ca pe web; înscrierea (`/auth/email/signup`) răspunde
  503 în producție ⇒ mesaj explicit, fără creare de cont fictiv; recuperarea trece prin xPortal.
- **Stare nativă:** **gata** (portat anterior, verificat vizual parțial). Diferente inevitabile: fontul
  `Inter` nu este împachetat, deci geometria textului nu e identică pixel-cu-pixel.
- **Nou în etapa 1:** login-ul scrie sesiunea durabilă (token + `nexus_device_id`) și afișează versiunea
  Android + backend.
- **Frontiera de replay (verificat pe API-ul Railway):** `POST /auth/email/login` fără `Idempotency-Key`
  răspunde `400 IDEMPOTENCY_KEY_REQUIRED` (nu `401`) — cheia se cere *înainte* de verificarea
  credențialelor. Clientul nativ o trimite acum din `session.ts`, exact ca `data-login-key` de pe web.

## 3. Fișa 2 — Feed Social (Home)

Sursă: `app.js` `renderHeader`/`renderNav`/`loadFeed`, `feed-surface.js`/`feed-surface.css`,
`social-human-ux.css`, `nav-marks.js`. Tokeni: `src/theme/social.ts`; componente: `FeedHeader`,
`FeedScreen`, `PostCard`, `AppNav`, `FeedDrawer`.

- **Elemente vizuale:** antet de feed (wordmark 76×20 în cerneală albă, badge 38px cu glifa lecturii
  curente, buton modules 40×40), carduri de postare (`.post`: padding 14, border 1px `#22313c`,
  radius 14, fundal `#0b151e`), bara de jos cu 7 poziții.
- **Bara de jos (7 poziții):** casă, mesaje, căutare, **creează** (cerc), prieteni, live, profil (poza
  persoanei). Sticla: `left/right 6px`, `top 4px`, `height 50px`, `radius 26`, `border 1px
  rgba(255,255,255,.22)`, gradient `#0e1014 97% → #020305 99%`. Discurile: 32×32, `radius 12`, border
  `rgba(255,255,255,.12)`, fundal `rgba(4,5,7,.74)`; discul activ `#090a0c` cu bordură
  `rgba(255,255,255,.42)`; marcajul casei are `fill rgba(255,255,255,.08)`. Cercul „+": 44×44, `radius 19`,
  border 5px `rgba(255,255,255,.46)`, `radial-gradient(circle at 35% 28%, #fff 0, #d8dce1 38%, #343941 72%,
  #050608 100%)`, glif 23px în `#050608`. Toate cele șapte sunt centrate pe rând: sticla de 50px le ține
  pe toate, inclusiv cercul de creare.
- **Glifele** sunt SVG-urile exacte din `nav-marks.js` (`primary`, `inbox`, `search`, `friends`, `utility`,
  `account`), desenate cu `stroke-width 1.7`, `linecap/linejoin round`; „creează" este textul `+`.
- **Comportamente:** pull-to-refresh, scroll infinit cu cursor (`next_cursor`), comutarea lecturii
  (Reels → Șoapte → Știri) din badge-ul din antet, sertarul din butonul modules și din mark-ul de meniu.
- **Elemente dinamice:** skeleton la prima pagină, indicator la paginare, bară de eroare cu „Reîncearcă",
  stare goală onestă, notice-ul providerului pentru Știri.
- **Date:** `GET /api/social/feed?format=&lens=&limit=30&cursor=`. Contractele de mod sunt cele web:
  `reels→clips` (fără lens), `whispers→tweets, for-you`, `news→posts, breaking` (răspuns cu `news[]` și
  `provider`). Erori: 409 (personă greșită) și mesajul serverului; retry-ul nu dublează postări.
- **Detalii mici:** `near` fără consimțământ ⇒ text explicit.
- **Stare nativă:** **gata** pentru citire/feed/paginare/refresh **și** pentru acțiunile cardului și
  viewerul media: reacții (`/api/posts/:id/reaction`), salvare, repost și distribuire (`PostCard` +
  `lib/postInteractions`), firul de comentarii citit și scris, cu reacții și răspunsuri afișate
  (`CommentsSheet`). Lectura „Reels" este propria prezentare imersivă pe tot ecranul (`ReelsReader`):
  un singur reel în viewport, doar cel vizibil se redă, rail de creator/reacții/comentarii/salvare/
  repost/soundtrack. **Lipsă**: SSE (actualizări în timp real) și viewerul de postare unică în afara
  cardului pentru Șoapte/Știri.



## 4. Fișa 3 — Profilul propriu

Sursă: `app.js` `renderProfiles`, `profile-experience.js/.css`, `profile-ticker.js`, `feed-surface.css`.
Componente: `ProfileScreen`, `ProfileTicker`, `PostCard`.

- **Elemente vizuale:** bandă de copertă 72px, avatar 78px cu bordură albă 2px și disc `#090a0c`
  (shell-ul monochrome al contului), identitate cu numele 17px și handle/locație 12px `#9eacb5`, banda
  ticker, taburile de conținut (`background #000`, `border-bottom rgba(255,255,255,.16)`, text
  `rgba(255,255,255,.62)`, activ alb).
- **Banda ticker:** transcrisă din `profile-ticker.js`: același text de două ori, buclă fără salt,
  elemente în ordinea locație → vârstă → handle → postări → followers → following → fragmente din bio
  (split pe propoziții/`·`/`|`, max 8 fragmente, fiecare max 96 caractere), durată
  `clamp(26s, itemi×6×factor, 120s)` cu factor 1 (viteză „medie"), nici un element interactiv.
- **Comportamente:** pull-to-refresh, reîncărcare la intrarea în tab, taburi care filtrează date reale.
- **Elemente dinamice:** loading înainte de prima încărcare, eroare cu „Reîncearcă", profil restricționat
  ⇒ mesaj onest (`locked`), gol ⇒ „Nimic aici încă."
- **Date:** `GET /api/profiles/:handle?persona=social` ⇒ `{profile, posts, reposts, shared_replies, stories}`.
  Taburi: Flux = toate postările, Reels = video, Fotografii = imagini, Șoapte = text, Momente = stories
  (rail-ul de stories nu e portat încă ⇒ tab gol).
- **Detalii mici:** avatar/copertă acceptate doar ca `/media/<64hex>.<ext>` (aceeași regulă
  `safeInternalMediaUrl` ca webul); iniţiale când nu există poză.
- **Stare nativă:** **gata** pentru antet + ticker + flux de postări; **lipsă**: editorul de profil,
  highlights/albume, reposts și răspunsuri distribuite ca liste, presence, sigilii, meniul profilului
  (wallet, acces, confidențialitate, notificări, aspect), grila de fotografii, banda de stories.
- **Verificat pe dispozitiv (2026-10-07):** `docs/screens/w-profile.png` și `04-profile.png` arată ecranul
  real — copertă, avatar 78px, identitate (`@test` · Kraków), banda ticker, taburile Flux/Reels/Fotografii/
  Șoapte/Momente și un card de postare real cu reacții/comentarii/salvare/repost/distribuire.


## 5. Fișa 4 — Meniul / sertarul

Sursă: `feed-hub.js`, `feed-surface.js` (`feedQuickDrawerMarkup`, `feedQuickTilesMarkup`),
`feed-surface.css:127-141`. Componentă: `FeedDrawer`.

- **Elemente vizuale:** sertar absolut la `top 62px`, `right 10px`, gap 9, padding 14/10/10, border
  `rgba(255,255,255,.28)`, radius 17, fundal `#050608`, umbră `0 18px 42px rgba(0,0,0,.7)`; grilă de
  3 coloane de 40px cu gap 8; fiecare modul = un pătrat 40×40, radius 13, border `rgba(255,255,255,.22)`,
  fundal `#0b0c0e`, glif 14px/800; modulul activ alb pe alb-negru inversat; ultimul tile este ieșirea din
  cont (cerc, `border rgba(255,255,255,.42)`); backdrop `rgba(0,0,0,.18)`.
- **Glifele modulelor:** `social ▶`, `work ▣`, `dating ♥`, `travel ✈`, `market ◇` (ca în `feed-hub.js`),
  plus tile-ul de postare nouă `＋`.
- **Comportamente:** se deschide din mark-ul de meniu și din butonul modules; se închide la tap pe
  backdrop, la X și după alegerea unui modul; comutarea de modul apelează `POST /api/persona/switch`.
- **Elemente dinamice:** lista se construiește la fiecare deschidere, deci modulul activ este cel curent.
- **Date:** `POST /api/persona/switch`, `POST /auth/logout`.
- **Stare nativă:** **gata** pentru sertar + comutare + logout. Modulele altele decât Social afișează
  ecranul onest „nu este încă portat", nu un ecran care imită succesul.


## 6. Fișe 5–10 — Etapa 2–5 (de completat pe măsură ce se portează)

Fișele de mai jos se completează cu aceeași structură (vizual / comportamente / dinamice / date / detalii
mici / stare) înainte de a începe fiecare ecran. Ce se știe acum din auditul de cod:

| Fișă | Sursă principală | API | Stare |
| - | - | - | - |
| 5. Camera nativă | `reel-camera-surface.js/.css`, `reel-camera-framing.js`, `reel-camera-quality.js` | local + `/api/reels/sound-suggestions` pentru Add sound | **gata** (codul) — 9:16 UHD implicit, 0,7× pe obiectivul virtual, 3:4 la 1×, selfie, lumină, timer, import galerie, selecție Jamendo și permisiuni refuzabile fără blocare; verificare Xiaomi pentru comenzile noi încă lipsă |
| 6. Editor / reel | `reel-editor-overlays.js`, `clip-options.js`, `reel-sticker-catalog.js`, `composer-emoji.js` | `/api/reels/sound-suggestions` | **parțial** — text mutabil + emoji + sugestii Jamendo; stickere, redimensionare, efecte, randare finală lipsesc |
| 7. Publicare | `post-publishing.js/.css`, `creator-draft-sync.js`, `draft-policy.js` | `/api/uploads` (resumable), `/api/posts` | **parțial** — vezi 6.1 |
| 8. Comentarii | `post-detail.js/.css`, `double-tap-heart.js` | `/api/posts/:id/comments`, `/api/comments/:id/reaction` | **parțial** — firul se citește și se scrie real (`CommentsSheet`: listă, răspuns cu `parent_id`, reacție LIKE, răspunsurile-părinte afișate `↩ @autor`); lipsesc pagina dedicată de postare și inimioara de dublu-tap pe media |
| 9. Mesaje | `messenger-shell.js`, `messenger-spaces.css`, `chat-crypto.js` | `/api/messages/*` | **lipsă** — mark-ul `inbox` randează `PendingScreen("Mesaje", …)` (`index.tsx:183`) |
| 10. Căutare / Prieteni / Live / Notificări / Setări | `social-inbox-demo.js`, `profile-settings-panels.js`, `notification-preferences.js` | varie | **lipsă** — Căutare, Prieteni și Live sunt `PendingScreen` oneste (titluri exacte în §8); Notificări și Setări încă nu au ecran |

### 6.1 Etapa 4 — publicarea nativă (portată în cod)

Fluxul complet al unei capturi, de la editor la postarea reală, este acum în aplicație. Aceeași ordine
ca pe web (`creator-draft-sync.js` pentru copia din cont, handlerul `composerForm` din `app.js` pentru
publicare):

1. **verificare locală** — `normalizePublishing` (limitele și regulile câmpurilor) rulează *înainte* de
   primul octet urcat; o descriere refuzată nu costă un upload;
2. **upload sursă** — `/api/uploads`, `purpose: social_post`;
3. **upload audio** (doar dacă există fișier) — `/api/uploads`, `purpose: social_audio`, precedat de
   declarația de drepturi, obligatorie pentru `creator_audio_*`;
4. **scrierea postării** — `POST /api/posts`, un singur `Idempotency-Key` per intenție:
   regenerat de editor la orice modificare, păstrat la retry, deci o rețea care cade la jumătate
   produce o singură postare.

Module și fișiere:

| Fișier | Ce ține |
| - | - |
| `src/lib/idempotency.ts` | formatarea și validarea cheilor de mutație (`newMutationKey`, `idempotencyKeyIsValid`) |
| `src/lib/sha256.ts` | amprenta SHA-256 a fișierului (aceeași pe care o cere `/api/uploads`) |
| `src/lib/uploadClient.ts` | upload-ul resumable, `UploadProgress`, lista de MIME acceptate, mesaje în română |
| `src/lib/publishing.ts` | `PublishingDetails`, limitele, `normalizePublishing`, `captionWithToken` |
| `src/lib/publishClient.ts` | etichetele de vizibilitate/proveniență/drepturi audio, `publishBody`, `assertPublishable`, `publishPost`, `publishIntentKey` |
| `src/lib/draftsClient.ts` | `/api/creator/drafts` (GET/PUT/DELETE) și `/api/uploads` pentru copia din cont |
| `src/lib/capturePublish.ts` | ordinea pașilor 1–4, `loadEditorIdentity` (`/api/me`), `backupCapture`, `publishCapture`, `catalogAudioSelected`, `captureFlowErrorMessage` |
| `src/components/PublishPanel.tsx` | ecranul „Detalii postare”: toate câmpurile, opțiunile, starea copiei din cont, butoanele |
| `src/components/CaptureEditor.tsx` | identitatea, starea copiei din cont, cheia de idempotency, apelurile de backup/publicare |

Reguli păstrate din web, aici ca invarianți ai codului:

- fișierul urcă înainte de rând: un post refuzat lasă obiectul stocat și draftul pe telefon, niciodată
  un post pe jumătate;
- un backup eșuat nu blochează publicarea, iar o publicare reușită șterge copia din cont (dacă ștergerea
  eșuează, se spune, nu se preface reușită);
- audio Jamendo se publică prin tokenul semnat de Railway, fără a încărca fișierul Jamendo; un URL
  fără token valid este refuzat (`CatalogAudioError`), iar tokenul expirat este refuzat de server;
- un buton se oferă doar când acțiunea poate reuși: MIME refuzat (HEIC/MOV), catalog fără token sau cont
  necitit transformă „Publică” într-o propoziție care explică de ce nu.

Ce rămâne neportat din fișa 7 (declarat explicit în interfață, nu ascuns):

- **compunerea finală a fișierului**: fotografia urcă așa cum a ieșit din cameră; textul/emoji-urile
  mutate, `locationPrecision: exact/area/city` (poziția overlay-ului este trimisă ca `TOP|CENTER|BOTTOM`
  prin `overlayPosition`) și watermarkul sunt transmise ca opțiuni, dar arderea lor în pixeli este
  randarea finală, încă neportată;
- **salvarea pe dispozitiv după publicare**: comutatorul este afișat oprit, cu explicația că opțiunea
  nu există încă în aplicație (valoarea trimisă serverului rămâne cea corectă: oprit);
- **etichetarea persoanelor după id**: `captionWithToken` scrie mențiunea în descriere (exact ca pe
  site), dar selectarea unui cont real din listă nu este portată.

Verificare (fara dispozitiv, inaintea testului pe Xiaomi): `tsc --noEmit` curat, `expo lint` curat (0
probleme) si `expo export --platform android` construieste bundle-ul Hermes fara erori. Un invariant este
si verificat explicit in cod: cheia de backup se schimba la fiecare editare (`touchDraft` miste `updatedAt`,
din care se deriva `draftMutationKey`), deci o a doua „Salveaza in cont" scrie copia din cont in loc sa
redea raspunsul vechi. Ramane testul pe dispozitiv (draft persistat dupa repornire + o publicare reala), de
aceea starea din tabelul global ramane **partial**.



## 7. Probleme cunoscute și variabile lipsă

1. **M1 închis (Etapa 2):** o fotografie capturată **se întoarce** în composer. `camera.tsx` salvează
   local (`nexus-camera-tests/`) și, când există o captură, randează `CaptureEditor`
   (`camera.tsx:278`); editorul randează `PublishPanel` („Detalii postare", `CaptureEditor.tsx:292`), iar
   `onExit` restaurează camera. Rămâne doar verificarea pe dispozitiv (captură → editare → publicare).
2. **Set-Cookie pe Android:** dacă platforma nu expune antetul, sesiunea se bazează pe cookie jar-ul
   nativ. De verificat pe dispozitiv la primul test de login + repornire la rece.
3. **`expo-secure-store`** nu este instalat (ar cere APK nou). Dacă se dorește tokenul în Keystore,
   este o etapă separată cu rebuild.
4. **Versiunea backendului** se citește din `/app.js`; un endpoint dedicat (`/api/meta`) ar fi mai curat,
   dar modifică backend-ul ⇒ necesită acord.
5. **Jamendo:** dacă `JAMENDO_CLIENT_ID` nu este setat pe Railway, `/api/reels/sound-suggestions`
   răspunde 503 cu `JAMENDO_NOT_CONFIGURED`; aplicația afișează mesajul serverului, fără piese inventate.
6. **Știri (Breaking):** fără provider aprobat, serverul răspunde `provider.status = "disabled"` cu motiv;
   aplicația afișează exact motivul, fără titluri inventate.
7. **Fontul `Inter`** nu este împachetat în aplicație, deci metricile textului diferă ușor de web.
8. **Sticla barei de jos:** umbrele interioare CSS (`inset`) sunt redate ca benzi de 1px; diferență
   vizuală minimă, imposibil de reprodus identic fără CSS.

9. **Email auth pe Railway răspunde `500` — reparat în cod, așteaptă deploy (verificarea pe dispozitiv
   rămâne blocată până atunci).** Simptomul a fost reprodus local pe o copie a unei baze vechi:
   `email_auth_commands` avea doar cheia `idempotency_key`, fără coloana `purpose`, iar `SCHEMA` este
   format din `CREATE TABLE IF NOT EXISTS`, care creează un tabel nou dar nu repară niciodată unul
   existent. Reparația (varianta (a), fără ștergere de date și fără varianta (b)) se aplică la pornire,
   înainte de `db.exec(SCHEMA)`: `migrateSchemaColumns` compară fiecare tabel existent cu declarațiile
   din care este construit `SCHEMA` și adaugă aditiv coloanele lipsă (`ALTER TABLE ADD COLUMN`), iar
   `migrateEmailAuthCommands` reconstruiește tabelul de comenzi într-o singură tranzacție, copiind
   fiecare rând și citind un `purpose` lipsă ca `login` (login-ul a scris acel jurnal înainte de
   coloană, iar replay-ul reverifică `purpose`, MAC-ul cererii și subiectul). Migrarea este idempotentă
   și fail-safe: o eroare lasă tabelul vechi neatins, iar ce nu poate fi adăugat (`NOT NULL` fără
   default, chei, referințe) este raportat în log, nu ghicit. Dovezi:
   `planning/evidence/NX-WEB-SOCIAL-P01-p0-email-auth-command-migration-v1.json` (6/6 teste de migrare,
   748/748 teste, `foreign_key_check` gol, `integrity_check` ok, repornire fără nicio modificare).
   Rămâne: deploy pe `main` (Railway pornește din acest repository, branch `main`), apoi verificarea pe
   dispozitiv din punctul 1 (cameră → editor → publicare). Dacă jurnalul din deploy are o formă care nu
   poate identifica rândurile, tabelul pornește gol și rândurile vechi sunt păstrate renumite
   (`email_auth_commands_legacy`) — un replay se reia printr-un login nou, iar datele nu se șterg.

## 8. Verificare de paritate pe ecrane (audit nativ 2026-10-07)

Audit făcut citind codul de navigație și capturi reale de ecran/UI (`docs/screens/`) luate pe Xiaomi.
Cele șapte mark-uri ale barei de jos (`AppNav`, ordinea `primary, inbox, search, create, friends,
utility, account`) sunt legate în `src/app/index.tsx` astfel:

| Mark | Etichetă (`AppNav`) | Ce randează `index.tsx` | Verdict | Dovezi |
| - | - | - | - | - |
| `primary` | Acasă | `FeedHeader` + `FeedScreen` (Reels imersiv / carduri, interacțiuni reale) | **real** | `05-home.png`, `02-feed-live.png`, `03-feed-immersive.png`; `FeedScreen.tsx:118-134` |
| `inbox` | Mesaje | `PendingScreen("Mesaje", "Conversațiile nu sunt încă portate…")` | **placeholder onest** | `index.tsx:183`; `10-messages.xml` |
| `search` | Găsește oameni și conținut | `PendingScreen("Găsește oameni și conținut", "Căutarea nu este încă portată…")` | **placeholder onest** | `index.tsx:186`; `s-search.xml` |
| `create` | Creează | `router.push('/camera')` (camera nativă) | **real** | `index.tsx:211`; `w-create.png` |
| `friends` | Prieteni | `PendingScreen("Prieteni", "Relațiile (urmăritori, cereri, blocări) nu sunt încă portate…")` | **placeholder onest** | `index.tsx:184`; `s-friends.xml` |
| `utility` | Live | `PendingScreen("Live", "Transmisiunile live nu sunt încă portate…")` | **placeholder onest** | `index.tsx:185`; `w-live.xml` |
| `account` | Profil | `ProfileScreen` (profil real) | **real** | `index.tsx:182`; `w-profile.png`, `04-profile.png` |

- O personă diferită de `social` randează un al optulea caz: `PendingScreen(moduleTitle, "Acest modul
  nu este încă portat…")` (`index.tsx:187`), același comportament onest ca în §5.
- Capturile `w-search2.*`, `w-friends2.*`, `00-current*.png`, `12-friends.*`, `11-search.*` și
  `ui-profile.xml` au fost identificate prin amprentă de tip/pachet ca **system UI / altă aplicație**
  (bara de notificări `com.android.systemui`, `com.miui.securitycenter`, `com.android.chrome`) și au fost
  **șterse**; nu se folosesc ca dovezi. `w-create.xml` (18.494 B) este cadrul de cameră, fără antet de
  text. Niciuna nu se folosește ca dovadă de paritate.
- Unele dump-uri capturate erau duplicate sau etichetate greșit (`s-search.xml` = `10-messages.xml` =
  `n1.xml`; `w-live.xml` = `w-profile.xml`). Sursa primară de adevăr pentru rutare rămâne codul
  (`src/app/index.tsx`); capturile sunt doar confirmare vizuală.
- Verdict de suprafață la această dată: **3 mark-uri reale** (Acasă, Creează, Profil) plus interacțiunile
  din feed, și **4 ecrane marcate onest ca neportate** (Mesaje, Căutare, Prieteni, Live). Nu există niciun
  ecran care să imite funcționalitate inexistentă; `05-home.png` arăta o postare reală de video (cadrul
  camerei din `04-profile.png`), nu un ecran de captură — etichetarea anterioară „camera preview" era
  greșită.
- Acest audit **înlocuiește** `planning/NX-ANDROID-PARITY-AUDIT-20261004.md`, care descria o stare
  veche (shell WebView). Vezi și `planning/NX-ANDROID-PARITY-AUDIT-20261007.md`.

## 9. Reguli de siguranță pe dispozitiv (obligatorii, prioritate maximă)

Orice lucru pe telefon se face **exclusiv** în `app.nexus.mobile.dev` (Nexus Dev). Regulile de mai jos
au prioritate față de orice altă instrucțiune, inclusiv față de modul de lucru autonom.

1. **Doar Nexus Dev.** Nu se deschide, nu se comută la, nu se apasă în, nu se citește și nu se
   capturează nicio altă aplicație. Interzise explicit: Google Messages, Coinbase, aplicații bancare și
   de plăți, email, contacte, galerie/fotografii (cu excepția selectorului propriu al Nexus și doar
   pentru fișierele alese de owner), setări, browser și bara de notificări.
2. **Verificarea focusului înainte de FIECARE input** (`input tap/swipe/keyevent/text`):
   `adb shell dumpsys window | findstr mCurrentFocus`. Dacă focusul nu este `app.nexus.mobile.dev`, nu
   se trimite niciun input; revenirea se face doar cu
   `adb shell am start -n app.nexus.mobile.dev/.MainActivity`, apoi se reverifică. Dacă nu se poate
   reveni, ne oprim și întrebăm.
3. **Fără căi ocolite.** Fără `monkey`, fără intent-uri de launcher, fără `am start` pentru alte pachete,
   fără `pm`, fără nicio comandă care listează/deschide/inspecționează alte aplicații. Nu se citesc
   notificări, SMS-uri, apeluri, contacte sau datele altor aplicații (`dumpsys notification`, content
   providers etc.).
4. **Fără deblocare.** Nu se deblochează telefonul, nu se ocolește lock screen-ul, nu se introduc PIN-uri
   sau modele. Dacă telefonul e blocat, ne oprim și cerem deblocarea.
5. **Capturile doar cu Nexus în prim-plan.** `uiautomator` dump, capturi și `logcat` doar cât timp Nexus
   Dev e în prim-plan; `logcat` filtrat pe procesul aplicației (`--pid`/pachet). Dacă într-un dump,
   captură sau log apare altă aplicație, nu se citește, se șterge și se anunță.
6. **La dubiu, nu se execută.** Dacă nu suntem siguri că o acțiune poate atinge altă aplicație, nu se
   face; se folosesc doar ecranele Nexus sau se întreabă.
7. **Fără bani.** Nu se ating portofele, cripto, plăți sau achiziții nicăieri. Nu se apasă pe notificări.

Reguli suplimentare de captură (stabilite 2026-10-07):

- Navigarea se face **doar** prin elementele aplicației găsite în dump (`content-desc`, `resource-id`),
  nu cu coordonate ghicite.
- Nu se deschide și nu se trage în jos bara de notificări; nu se apasă Home.
- Dacă un tap nu are efectul așteptat, ne oprim și verificăm focusul înainte de a reîncerca.
- Dacă un dump sau o captură conține altceva decât Nexus, nu se citește, se șterge și se anunță.

## 10. Defecte de paritate și reparații (offline, fără telefon)

Fiecare rând compară codul mobil cu sursa web citată. „Reparat" înseamnă schimbat în cod și trecut de
`tsc --noEmit`; fiecare rând reparat așteaptă confirmare pe telefon (vezi §11).

| # | Defect | Cauză (cod) | Referință web | Reparație | Stare |
|---|--------|-------------|---------------|-----------|-------|
| 1 | Media 9:16 se decupa în carduri | `PostCard` avea `media:{height:380}` + `cover` (tăia portretul 9:16) | `feed-surface.css:2607-2615` (`object-fit:contain` pe cadru cu aspectul clipului, `data-video-aspect`); `:257` skeleton 4/5 | `PostCard` folosește `aspectRatio` 9:16 (clip) / 4:5 (foto) + `overflow:hidden` | **reparat** (verificare pe telefon) |
| 2 | 9:16 nu se poate reda pe tot ecranul | Lipsea un viewer full-screen (web-ul are `reelViewer`) | `feed-surface.css:2616-2623` (`object-fit:contain;background:#000`) | Component nou `MediaViewer.tsx` (Modal full-screen, `contain`, 9:16) deschis la tap pe media | **reparat** (verificare pe telefon) |
| 3 | Media Railway nu apare în feed | `/media/…` cere sesiune și întoarce `423 media quarantined` (record nevalidat) / `410 media missing` (`mediaDeliveryPolicy`) | `api.js:4801-4834`, `media.js:165-183` | `RemoteImage` primește `onError`; cardul afișează „Media nu a putut fi afișată." în loc de negru | **reparat** (verificare pe telefon) |
| 4 | Clipuri în feed | modul `reels` randează `ReelsReader` (immersiv, `cover`) doar când `posts.length>0` | `feed-surface.css:474-521` | de verificat redarea reală (`expo-video` + `Range`; server `accept-ranges: bytes`, bucăți ≤ 4 MB, `api.js:4775`) | **reparat** — redare reală confirmată pe telefon (logcat: `c2.android.vp8.decoder` + sesiune `ExpoVideo…`); `/media` refuzat nu mai lasă scenă neagră tăcută: `RemoteVideo` are `onError` (`statusChange === 'error'`) → „Clipul nu a putut fi redat." în `ReelsReader`/`MediaViewer` |
| 5 | Mesaje (inbox) | `PendingScreen("Mesaje", …)` | `messenger-shell.js` / `p2-messaging.css` | neportat | **deferred** (necesită endpoint de conversații + transport live) — **portat**: `MessagesScreen` (inbox real `GET /api/chat/conversations`, fir real, trimitere plaintext cu nonce) |
| 6 | Căutare / Prieteni / Live / persona non-social | `PendingScreen(…)` | — | neportat | **portat** — `SearchScreen` (`/api/social/search`), `FriendsScreen` (relations + cereri + decizii + follow), `LiveScreen` (`/api/social/live`, onest despre `GATED_NO_SFU`); persona non-social rămâne `PendingScreen` (onest) |
| 7 | Rezultatele din Căutare aveau chei de listă `undefined` (LogBox: `Each child in a list should have a unique "key" prop … from SearchScreen`) | `repo.searchSocial` întoarce `SELECT u.id, …` (`repo.js:1078`) → `id`, dar tipul partajat `RelationPerson` cere `user_id` (aliasat doar de `listSocialRelations`, `repo.js:1912`) | `public/app.js` (search → `renderSearchProfiles`) | tip nou `SearchProfile` (cheie `id`) în `socialTypes.ts`; `SocialSearchPage.profiles` → `SearchProfile[]`; `key={person.id}` în `SearchScreen` | **reparat** (device: warning dispărut) |
| 8 | Rezultatul din Căutare nu se deschide ca postare | `PostCard` are `onOpen?` dar nimeni nu-l dă (`FeedScreen`, `ProfileScreen`, `SearchScreen` îl omit); doar scena media deschide `MediaViewer` | `public/app.js` (rezultatul duce la postare) | — | **de făcut** (lot următor) |

## 11. Sesiune pe telefon — script de verificare (lot pregătit)

Se rulează **doar** cu `app.nexus.mobile.dev` în prim-plan, cu verificarea focusului înainte de **fiecare**
input (§9). Dacă focusul nu e Nexus sau ecranul se blochează, ne oprim și se notează unde am rămas.

**Device:** `192.168.1.184:46291` (adb: `tools\scrcpy\adb.exe`). Prescurtare mai jos: `ADB` =
`tools\scrcpy\adb.exe -s 192.168.1.184:46291`.

### 11.1 Ce se instalează sau se reîncarcă
1. Cu Metro/dev-client pornit (`npm run dev:android` sau `dev:metro`): se salvează fișierele modificate
   (`MediaViewer.tsx`, `PostCard.tsx`, `PostMedia.tsx`) și se așteaptă **Fast Refresh** în app.
2. Fără Metro: `npm run dev:reload` (`scripts/nexus-dev.ps1 -Action reload`).
3. Doar dacă lipsește buildul nativ: `npm run build:android:dev` apoi `npm run install:android`.

### 11.2 Comenzi adb de pregătire (o dată, înainte de input)
```
ADB shell dumpsys window | findstr mCurrentFocus         # trebuie app.nexus.mobile.dev/.MainActivity
ADB shell dumpsys window | findstr mCurrentFocus         # repetat înainte de FIECARE input de mai jos
ADB logcat -c
ADB shell pidof -s app.nexus.mobile.dev                  # PID pentru logcat filtrat
```

### 11.3 Pași (ordonați) și rezultatul așteptat

| Pas | Acțiune (doar prin elemente din dump: `content-desc`/`resource-id`) | Comandă | Rezultat așteptat |
|-----|---------------------------------------------------------------------|---------|-------------------|
| 1 | Feed Reels (Acasă) — primul clip | `ADB shell uiautomator dump /sdcard/nx.xml` + `ADB pull /sdcard/nx.xml docs/screens/` ; `ADB exec-out screencap -p > docs/screens/tv-feed.png` | Un clip 9:16 pe **tot ecranul**, rail (reacție/comentarii/salvare/distribuie) la dreapta |
| 2 | Tap pe media clipului → viewer | verifică focusul, apoi `ADB shell input tap <x> <y>` (centrul zonei media) | `MediaViewer` full-screen, **cadru 9:16 complet (contain)**, buton „×" sus-dreapta; audio pornit, controale native |
| 3 | Închide viewer-ul | `ADB shell input tap <x> <y>` pe „×" | Revenire la feed, fără crash |
| 4 | Comută modul (Şoapte) din header | tap pe `content-desc="…"` al butonului de mod | Listă de carduri; media păstrează 9:16 (clip) / 4:5 (foto), fără decupare |
| 5 | Deschide un card cu fotografie | tap pe card | `MediaViewer` full-screen `contain`; dacă `/media` refuză, text „Media nu a putut fi afișată." |
| 6 | Comută modul (Ştiri) | tap pe butonul de mod | Titluri (sau motivul real, dacă providerul e oprit) |
| 7 | Mark „Mesaje" | tap pe al 5-lea mark (zona ~1111,321 din `w-live.xml`) | `PendingScreen("Mesaje")` — ecran onest, fără date inventate |
| 8 | Mark „Cont"/Profil | tap pe mark | Profil real (ticker, postări) |
| 9 | Verifică logurile Nexus | `ADB logcat --pid=<PID>` (filtrat) | Fără erori noi de rețea/media; fără `423` repetat pe media validată |

### 11.4 Extragerea dovezilor
```
ADB shell screencap -p /sdcard/nx.png ; ADB pull /sdcard/nx.png docs/screens/tv-<pas>.png
ADB shell uiautomator dump /sdcard/nx.xml ; ADB pull /sdcard/nx.xml docs/screens/tv-<pas>.xml
```
Fiecare dump/captură se verifică: dacă `package` ≠ `app.nexus.mobile.dev`, se șterge și se anunță.

### 11.5 Rezultatele sesiunii (2026-10-07, lot 1)

| Pas | Rezultat real | Dovezi |
|-----|---------------|--------|
| 1 | Clip redat în immersive: scena media ocupă `[0,303][1220,2393]` (toată lățimea), rail activ; logcat: `c2.android.vp8.decoder` + `ExpoVideoBasicMediaSession` `buffered=6529ms/duration=7584ms` | `docs/screens/tv-f1.xml`, logcat |
| 2-3 | **Neefectuat** — viewer-ul se deschide din card/profil, iar „Şoapte" nu expune un card cu media | — |
| 4 | Comutare mod din badge (`role=tab`, label = titlul modului) → „Şoapte": listă de `PostCard` reale | `docs/screens/tv-04-cards.xml` |
| 5 | **Neefectuat** — primul post din „Şoapte" e doar text (`format=tweets`), fără element media | `docs/screens/tv-04-cards.xml` |
| 6 | **Neefectuat** (media reală e pe profil, nu în Şoapte) | — |
| 7 | „Mesaje" → ecran onest „Conversațiile nu sunt încă portate…", mark `selected=true` | `docs/screens/tv-07-mesaje.xml` |
| 8 | **OPRIT** — după tap a trecut în prim-plan `com.microsoft.office.outlook` („Are you trying to sign in?"). Input oprit, captura contaminată ștearsă, revenire cu `am start -n app.nexus.mobile.dev/.MainActivity` (focus reconfirmat Nexus) | — |
| 9 | — | — |

Note de execuție (importante pentru sesiunile viitoare):
- `uiautomator dump` **fără** `--compressed` întoarce doar un overlay („Tools"); cu **`--compressed`**
  întoarce tot arborele RN. Se folosește mereu `--compressed`.
- Dispozitivul are **două display-uri** (0 = 1220×2656 Nexus; 1 = 904×572 cover). `screencap` fără `-d`
  capturează primul display (cover, negru). Se folosește `screencap -p -d 4630946949513469331`.
- `.NET`/`System.Drawing` folosește directorul de proces, nu `Set-Location`: pentru prelucrarea PNG se
  dau căi absolute.
- Regula „doar Nexus" a fost respectată: la orice app străin (Outlook) input-ul a fost oprit, captura
  ștearsă și anunțat.

### 11.6 Rezultatele sesiunii (2026-10-07, lot 2 — ecranele noi + viewer)

Pre-flight: focus = `app.nexus.mobile.dev/.MainActivity`, `pidof app.nexus.mobile.dev` = PID, Metro
`:8081` → `packager-status:running` (Fast Refresh a purtat codul nou). adb raportează **două** device-uri
(telnet `192.168.1.184:46291` + o conexiune mDNS a aceluiași telefon) → orice comandă se dă cu
`-s 192.168.1.184:46291`, altfel „more than one device/emulator".

| Pas | Rezultat real | Dovezi |
|-----|---------------|--------|
| Nav | Barul are 7 destinații (Acasă, Mesaje, Găsește oameni și conținut, Creează, Prieteni, Live, Profil) — deci app-ul rulează codul nou | `docs/screens/tv-10-now.xml` |
| 7 Mesaje | `MessagesScreen` real: „Nicio conversație încă." (inbox `GET /api/chat/conversations?persona=all&box=inbox` gol) | `tv-11-mesaje.{png,xml}` |
| Căutare | `SearchScreen`: guard client „Scrie cel puțin 2 caractere pentru a căuta."; apoi „testnexusnexus" → „Niciun rezultat pentru „testnexusnexus"." (query ecouat chiar de server); apoi „test" → profil real `Test Nexus / @test` + 2 postări, una cu clip | `tv-13-search-guard.xml`, `tv-15-search-test.png`, `tv-19-search-test.{png,xml}` |
| Prieteni | `FriendsScreen`: taburi Cereri / Urmăritori / Urmărești; „Nicio cerere în așteptare." / „Nimeni aici încă." (endpoint-uri reale, goale pe acest cont) | `tv-22-friends.png`, `tv-23-friends.xml`, `tv-24-followers.png`, `tv-25-following.png` |
| Live | `LiveScreen`: „Transmisiunea publică nu este configurată pe server (GATED_NO_SFU)…", „ACUM LIVE / Nicio transmisiune activă.", „CREATORI / Niciun creator de afișat." — fără player fals | `tv-26-live.png` |
| 2-3 viewer 9:16 | Card cu clip din Căutare → tap pe scenă → `MediaViewer` full-screen: `Show player controls` (nativeControls), buton „Închide", caption „Test"; logcat: `c2.android.opus.decoder` + „Creating an asynchronous MediaCodec adapter for track type audio" | `tv-34-viewer.{png,xml}` (540 KB) |
| 9 Profil | **BLOCCAT de dispozitiv** — butonul „Profil" (x 1033-1199) cade în **inseta de gest system de pe marginea dreaptă**: tap-urile la x ≳ 1035 (inclusiv „Schimbă profilul Nexus", x 1085-1189) sunt înghițite de sistem, în timp ce 1-6 răspund. Nodul e `clickable=true, enabled=true`, fără eroare JS în logcat. Ruta `/profile` nu există (profilul e slot, iar `orientation` = `portrait`) → nu se poate ocoli prin deep link. Rămâne neconfirmat pe device. | `probe.xml`, `p2.xml`, `drawer.xml` |

Defecte găsite în lotul 2:
- **`SearchScreen` — chei de listă `undefined`** (LogBox: `Each child in a list should have a unique "key"
  prop … passed a child from SearchScreen`). Cauză reală: `repo.searchSocial` întoarce `SELECT u.id, …`
  (`repo.js:1078`), adică `id`, dar tipul partajat `RelationPerson` cere `user_id` (pe care
  `listSocialRelations` îl alias-ează, `repo.js:1912`). **Reparat**: tip nou `SearchProfile` (cheie `id`)
  în `src/lib/socialTypes.ts`, `SocialSearchPage.profiles` devine `SearchProfile[]`, randarea folosește
  `key={person.id}`. `tsc --noEmit` 0 erori, ESLint 0 probleme.
- **Paritate rămasă**: `PostCard` primește `onOpen` doar de la nimeni (`FeedScreen`, `ProfileScreen`,
  `SearchScreen` îl omit) → rezultatul din Căutare nu se deschide ca postare, doar scena media deschide
  viewer-ul. Web-ul duce rezultatul la postare; de aliniat într-un lot următor.

Note de execuție (lot 2, obligatorii pentru sesiunile viitoare):
- `uiautomator dump` așteaptă `idle` și e lent → **o singură interacțiune + un singur dump per comandă**
  (altfel se depășește limita de 30 s).
- **Nu** pune două apeluri `run_commands` cu input adb în același mesaj: se pot executa **în paralel** și
  amestecă rezultatele (s-a întâmplat: tap „Acasă" și tap „Profil" s-au suprapus).
- Pe device, `grep -E 'a|b'`: ghilimelele **duble** se consumă la argument parsing (Windows), deci `|`
  ajunge interpretat de shell-ul telefonului. Se folosesc ghilimele **simple** în interior.
- Overlay-ul „Tools" din dump este butonul **Expo Dev Menu** al aplicației (nu app străin); tap-urile la
  x≈1077-1145, y≈176-355 îl deschid (`Nexus Dev`, `exposdk:57.0.0`, Reload/Go home).
- Câmpul de căutare primește sugestii **autofill** la focus (ex. `test@nexus.ro`); `keyevent 111` (ESC) le
  închide. Dump-ul rămâne doar `app.nexus.mobile.dev`, deci nu e o fereastră străină.
- `MediaViewer` s-a închis cu BACK (`Modal.onRequestClose`), nu cu „×" (aflat la x≈1180, în zona blocată).
- Regula „doar Nexus" a fost respectată: niciun app străin nu a fost atins/deschis/citit.

## 12. Inventar de endpoint-uri web pentru ecranele neportate (verificat 2026-10-07)

Toate sunt **implementate real** în `apps/nexus-web/lib` (nu stub-uri), deci sunt disponibile pe Railway:

| Ecran | Endpoint-uri (`api.js`) | Observații |
|-------|-------------------------|-----------|
| Mesaje | `GET /api/chat/conversations` (:4982), `GET /api/chat/conversations/:id/messages` (:5095), `POST /api/chat/conversations/:id/messages` (:5125), `POST /api/chat/conversations` (:5047), `GET /api/chat/search` (:5020) | Trimitere **plaintext** disponibilă (`sendConversationMessage`); E2EE opțional pe mesaj (necesită device-uri înregistrate). `/api/messages` este **retras** (410). |
| Căutare | `GET /api/social/search?q=` (:3361) → `profiles` + `posts`; `GET /api/chat/search?q=` (:5020) | Serverul refuză <2 caractere și rate-limitează. |
| Prieteni | `GET /api/social/relations?kind=followers\|following` (:4487), `GET /api/follow/requests?direction=incoming\|outgoing` (:4412), `POST /api/follow/requests/:id/decision` (:4424), `POST /api/follow` (:4439), `GET /api/follows` (:4480) | Decizii accept/decline și follow/unfollow reale. |
| Live | `GET /api/social/live` (:3291), `POST /api/social/live/preview` (:3308), `POST /api/social/live/competitions` (:3336) | `transport.status = "GATED_NO_SFU"`: nu există SFU/relay, deci **nu se poate reda fluxul live**; lista de sesiuni/creatori este reală. |

Niciun endpoint necesar ecranelor portate din acest lot nu lipsește din backend.

## 13. Cauza reală a clipurilor Railway care nu apar în feed (2026-10-07)

Verificat în cod (`api.js:4801-4834`, `media.js:165-183`, `repo.js:1196-1233`):
1. **Livrarea media** (`GET /media/<hash>.<ext>`) cere sesiune și trece prin `mediaDeliveryPolicy`: dacă
   `scan_status != ready_local_validation` → **423 media quarantined**; dacă octeții lipsesc sau hash-ul nu
   se mai potrivește → **410 media missing**. Range e suportat (`accept-ranges: bytes`, bucăți ≤ 4 MB, 206).
2. **Feedul** exclude postările a căror media nu e validată:
   `AND (p.media_id IS NULL OR m.scan_status = 'ready_local_validation')` (`repo.js:1211`). Un clip cu media
   în carantină nu apare deloc în feed — nu este o eroare de client, de URL sau de anteturi.
3. **Clientul** înainte: un `/media` refuzat însemna cadru negru tăcut (fără `onError`). Reparat: imaginile
   (`PostCard`) afișează „Media nu a putut fi afișată.", iar clipurile au acum `RemoteVideo.onError`
   (listener `statusChange === 'error'`) → „Clipul nu a putut fi redat." în `ReelsReader` și `MediaViewer`.

Rămâne de făcut pe **server/date** (nu se poate repara din aplicație): validarea/re-procesarea media
(`scan_status`) a clipurilor Railway, ca `/media` să răspundă 200 și feedul să le includă.

## 14. Fișier de token local
`apps/nexus-mobile/buildsdiag-token.txt` (netracked, niciodată comis) — conține un **JWT** (3 segmente
base64url, header `eyJ`, 176 de caractere). Adăugat în `apps/nexus-mobile/.gitignore`
(`buildsdiag-token.txt`); nu a fost deschis, afișat sau comis. Recomandare: ștergere de pe disc dacă nu
mai este folosit de vreun unealtă de diagnostic.


## 15. Schimbare de abordare: paritate 1:1 cu web-ul (2026-10-07)

Decizie (owner): ecranele native „onest simplificate" nu mai sunt acceptate. Dacă web-ul are un
element, nativul îl are la fel — structură, ordine, iconițe, texte, culori, fonturi, dimensiuni,
spațieri, animații, gesturi, stări. Singura excepție: ce depinde de infrastructură inexistentă pe
server (ex. `GATED_NO_SFU` la Live), marcat explicit `gate`.

### 15.1 Rezultatul Pasului 1 (extragere referință web, offline, fără telefon)

Referința completă e în **`docs/PARITY-MATRIX.md`** (matricea, 119 rânduri: 8 identice / 41 diferite /
55 lipsă / 1 gate / 14 n/a) și în **`docs/web-ref/`** (capturi + DOM + markup + rețea + tokens).

Ce s-a construit:
- `tools/web-ref/harness.mjs` — Playwright-core 1.63 pe Chrome-ul de sistem, emulare mobilă identică
  telefonului: **viewport 469×1021 CSS px, DPR 2.6** (din `wm size` 1220×2656 / `wm density` 416),
  touch + user-agent Android, locale `ro-RO`;
- `tools/web-ref/dom-probe.mjs` — dump DOM per element vizibil: tag, id/clase, rol, text exact,
  geometrie în CSS px, `getComputedStyle` (culori, fonturi, margini, padding, raze, umbre,
  opacitate, overflow, z-index, flex, transform, tranziții, animații), stare (`disabled`,
  `aria-selected`), SVG inline, atribute `data-*`;
- `tools/web-ref/ctx.mjs` — navigare pe mărcile barei, click prin DOM, swipe/drag (CDP touch + mouse),
  găsirea containerului derulabil, închiderea overlay-urilor, auto-recovery;
- `tools/web-ref/crawl.mjs` — 34 de pași de craw sistematic (shell, feed×3 moduri, profil + tab-uri,
  mesaje, căutare, prieteni, live, creare, vizualizatoare, comentarii, meniuri) cu capturi PNG,
  DOM JSON, markup HTML și log de rețea;
- `tools/web-ref/extract-tokens.mjs` → `docs/web-ref/_tokens/*.json` (106 variabile CSS, fonturi,
  raze, umbre, animații, tranziții);
- `docs/PARITY-MATRIX.md` (matricea + praguri de gest + durate de animație + copy exact + endpoints).

Credențiale: `test@nexus.ro`, furnizate **doar** prin variabile de mediu (`NEXUS_TEST_EMAIL`,
`NEXUS_TEST_PASSWORD`); nu există nicio parolă scrisă în cod, în scripturi sau în fișiere comise.

### 15.2 Descoperiri care schimbă planul de implementare

1. **Feed-ul web are exact 3 citiri, nu 2**: `reels` (clips), `whispers` (tweets/Șoapte),
   `news` (posts, lents `breaking`). Swipe-ul **spre stânga** merge reels → whispers → news, iar
   **spre dreapta** merge invers (confirmat pe device: `feed/swipe-modes.json`), cu praguri fixe
   `|dx| ≥ 72`, `|dx| > |dy|*1.2`, offset `+1` la `dx<0`. Pull-to-refresh: `dy ≥ 64` cu
   `|dy| > |dx|*1.15` doar la `scrollTop ≤ 1`.
2. **Știrile au o stare reală de „gol"** pe producție: „Știrile sunt pregătite, dar oprite" /
   „Nicio sursă nu a fost aprobată încă…" — se porteză această copie, nu un feed inventat.
3. **Cardul de reel** are un rail vertical cu ordine fixă (avatar/story creator, reacție + sumar glife,
   comentarii + număr, salvare, distribuie) și un meniu `Repost / Distribuie`; reacțiile sunt 8:
   LIKE, LOVE, HAHA, WOW, SAD, ANGRY, FAKE_OPINION, DISLIKE, cu titluri românești
   Like, Love, Haha, Wow, Trist, Furios, Fake?, Dislike.
4. **Profilul** are mult mai mult decât un antet: bară de acțiuni (✎ ≡ ▶ ▦ ❝ ✦ ▾), ticker cu
   `--tickerSpan` 48s, fișă de editare `heroEditSheet` cu 10+ rânduri (inclusiv Public/Privat și
   „Prețuri și acces"), meniu `profileMenuDrawer` (7 rânduri + Logout) și switcher-ul de profiluri &
   aplicații de pe `#modeBadge` (care include și „Unde citești": for-you/local/global/following/
   photos/friends/private + Prezentare + Media fit).
5. **Mesajele** au rail de story-uri („Story-ul tău") și filtre „Toate / TE / +", plus shell-ul de
   messenger (`messenger-shell.js`, `messenger-spaces.css`) și meniul de conversație.
6. **Live** are 4 tab-uri (Acum / Urmărești / Battle / Campionate), fiecare cu stare de gol proprie,
   și un sheet „LIVE STUDIO · VERIFICARE DISPOZITIV" care se termină cu gate-ul explicit de SFU.
7. **Căutarea** are input `#social-search-input` (placeholder „Caută în Nexus Social"), notă de
   privacy, hint „Începe cu cel puțin 2 caractere" și rezultate în două secțiuni (OAMENI / CONȚINUT),
   cu acțiuni per rezultat („Gestionează postarea", „Istoric versiuni", „Vezi profilul",
   „Trimite mesaj").
8. **Compozitorul** pornește pe cameră cu cadru **9:16** și `0,7×` unde există (linia „9:16 · 0,7×
   neconfirmat" + „senzor 2×2 (1.00) · cerut 1080×1920 (0.56) · ecran 469×1021 (0.46) · fit complet"),
   cu moduri CAMERA | CREATE | LIVE | DRAFTS.

### 15.3 Starea nativă față de referință (fără indulgență)

- Shell-ul (7 mărci, geometrie, iconițe SVG, wordmark, versiune) este **aproape identic** — diferențe:
  header 56 px în loc de 72 px, lipsesc `#modeBadge`, `#feedBadge`, `#friendsBadge`, badge-ul de necitite.
- Feed: modurile există, dar cardul de reel nu are rail-ul vertical, meniul de distribuie, traducerea,
  Trust Lens, story rail, schelet/erori/„mai mult"; gesturile nu au pragurile web.
- Profil/Mesaje/Căutare/Prieteni/Live: ecrane funcționale dar **simplificate** — lipsesc fișa de
  editare, meniul, switcher-ul, story rail, tab-urile Live, sheet-ul de studio, acțiunile per rezultat.
- Suprapuneri: lipsesc detaliul de postare, story viewer, modal de cont, onboarding, toast.
- Traducere: nativul scrie texte fixe; web-ul are `interface-locale.js` (4 limbi).

### 15.4 Pasul 2 (implementare 1:1) — ordinea aprobată

1. **Fișier central de tokens** în nativ, derivat din `docs/web-ref/_tokens/css-variables.json`
   (culori `--nx-*`/`--nx67-*`, raze 8/9/10/12/13/14/16/18px, fonturi, umbre) + componente de bază
   reutilizabile (bară, header, card, butoane, tab-uri, ticker, foi de jos), **fără valori estimate**.
2. Apoi ecran cu ecran, în ordinea: shell → Feed (reels/whispers/news cu swipe și praguri web) →
   Profil (antet, bară de acțiuni, ticker, tab-uri, grilă, fișă de editare, meniu, switcher) →
   Mesaje (filtre, story rail, listă, fir) → Notificări → Căutare → Prieteni → Live (+ sheet de studio
   și gate) → Creare/Editare → Setări → restul din matrice.
3. Gesturi și animații cu **aceleași praguri și durate** ca web (`react-native-gesture-handler` +
   `reanimated`). Dacă un prag cere un APK nou (development build), se notează aici când și de ce.
4. Camera rămâne nativă (9:16 implicit, 0,7× unde există).
5. Verificare per ecran: comparație între `uiautomator dump --compressed` (nativ) și bounding box-urile
   din DOM-ul web la aceeași densitate, cu toleranța declarată în `docs/PARITY-MATRIX.md` §0:
   ±2 px geometrie, ±6 % lățime de text, wrap diferit acceptat, timpi exacți. Diferențele se raportează
   numeric și se corectează.
6. După fiecare ecran: typecheck + lint, commit pe branch-ul mobil.

### 15.5 Reguli de operare verificate în acest lot (pentru sesiunile viitoare)

- Extragerea web nu are nevoie de telefon; dacă totuși e nevoie de device, se cere explicit și se
  folosește **doar** `app.nexus.mobile.dev`, cu verificarea focusului înainte de fiecare input.
- Date de producție: **doar citire**; contul de test nu a publicat nimic în acest lot.
- Capturile se salvează pe disc pentru owner și **nu** se deschid/citesc în conversație.
- Crawl-ul se rulează în fundal (o comandă depășește 30 s); un pas = o interacțiune + un dump.
- Blocaje de interactivitate întâlnite: click-urile din header sunt interceptate de overlay-uri
  (se folosește `el.click()` prin DOM), `#phoneNav` devine `inert` cât timp un vizualizator e deschis
  (se închide cu Escape → `goBack`), iar un swipe pornit din marginea stângă declanșează gestul de
  back al Chrome (se dezactivează cu `--disable-features=OverscrollHistoryNavigation`).

## 16. Port 1:1 — gesturile, rama de shell și vizualizatorul (2026-10-07, lot 3)

Ce s-a portat (fiecare cu sursa web citată în cod):

- **Rama de shell** (`components/AppHeader.tsx`, `components/AppNav.tsx`): header **72 px**
  (`feedHeader.height` / `appHeader.height` din `theme/social.ts`, aceeași valoare în ambele variante),
  wordmark + `wordmarkBuild`, **un singur** tab de citire (`accessibilityRole="tab"`, glyph ▶ / ❝ / ▤ din
  `socialTokens.feedModes`) și cele 7 mărci ale barei cu geometria din `shell/nav-marks.json`.
- **Badge-ul de necitite** (`AppNav.tsx` + `lib/unread.ts`): pill `Math.min(unread, 99)` cu eticheta care
  poartă suma — aceeași împărțire ca `app.js:2067-2073`; sursa este suma inbox + notificări cu plafon
  9999 (`app.js:2416-2454`).
- **Swipe-ul de canal** (`lib/socialGesture.ts` + `FeedScreen.tsx`): `decideSocialGesture` transcrie
  decizia din `social-gesture.js` / `app.js:2960-3048` — `|dx| ≥ 72` **și** `|dx| > |dy|*1.2`, offset `+1`
  când `dx < 0`, apoi `nextMode` pe ordinea din `feedModes` (reels → whispers → news → reels, cu wrap, ca
  `nextFeedMode` din `app.js:2999`).
- **Vizualizatorul de media** (`components/MediaViewer.tsx`): galeria e cheiată pe postare (`gallery` de la
  ecran), contor „n / N", plăci ‹ › și „×", plus un flick = un pas prin `decideViewerGesture` (48 px, axa
  dominantă, `dx < 0` / `dy < 0` → `+1`, cu wrap ca `step()` din `app.js:5114-5133`).

Decizii explicite (și de ce se abat de la web):

- **Pull-to-refresh rămâne nativ.** Ramura verticală a deciziei (`dy ≥ 64`, `|dy| > |dx| * 1.15`,
  `scrollTop ≤ 1`) rămâne **neatinsă**: revendicarea cere `dx` dominant, deci un pull nu este niciodată
  preluat de `PanResponder`, iar `RefreshControl`-ul platformei încarcă exact pagina pe care acea ramură ar
  fi cerut-o. Consecință asumată: textele „↻ Trage pentru actualizare" / „Se actualizează" sunt ale
  platformei, nu ale web-ului.
- **Pragul de revendicare e 24 px, sub pragul de decizie (72 px).** Un gest nativ trebuie revendicat
  *înainte* de a fi decis, altfel lista îl consumă; se revendică doar un flick clar orizontal, iar copilul
  (`Pressable`) își anulează apăsarea — ceea ce ține locul `suppressFeedClickUntil = now+500` din web.
- **`ReelsReader` păstrează paginarea nativă** (`pagingEnabled` + `snapToInterval` + `onMomentumScrollEnd`),
  deci gestul de 48 px al vizualizatorului se aplică doar în `MediaViewer`; în reels, readerul vertical
  este cel care decide.

Reparat în acest lot (defecte găsite de lint-ul pe **arborele întreg**, nu de cel per fișier):

- `app/index.tsx`: `goHome` era un `useCallback` aflat **după** ieșirile timpurii de boot și de login, deci
  React vedea altă ordine de hook-uri pe acele randări — risc real de crash. Mutat lângă celelalte
  callbacks, cu motivul scris în cod.
- `components/AppNav.tsx`: `glyphWeight` era destructurat degeaba (`styles.createGlyph` îl aplică deja).

Verificare (offline, fără telefon):

- `node node_modules/typescript/bin/tsc --noEmit` → exit **0**.
- `node node_modules/eslint/bin/eslint.js src --format json` → **43 fișiere, 0 erori, 0 avertismente**.

Rămas pe acest fir (nepostat): story viewer-ul și rail-ul de story pe feed (captura web a eșuat —
`story-opened=false`, feed-ul de test nu are story-uri), compozitorul din vizualizatorul de media (trăiește
acum doar în `CommentsSheet`), fit/zoom/pan în vizualizator, atribuirea audio din reel, `#modeBadge` /
`#feedBadge` / `#friendsBadge`, plus mutarea credențialelor în variabile de mediu și recrearea datelor de
test.

## 17. Date de test realiste + credențiale în mediu + pași noi de captură (2026-10-07, lot 4)

### 17.1 Credențiale: nicio parolă în fișiere comise

Parola contului de test era **scrisă în patru fișiere comise**
(`apps/nexus-web/lib/preview-test-account.js`, `scripts/dev-test-account.mjs`,
`apps/nexus-mobile/scripts/login-webview.mjs`, `apps/nexus-mobile/scripts/nexus-dev.ps1`)
și în două README-uri. Acum vine **doar** din `NEXUS_TEST_ACCOUNT_PASSWORD`
(minim 8 caractere) și nu este niciodată tipărită:

- `lib/preview-test-account.js` expune `previewTestAccountPassword(env)` și
  `TEST_ACCOUNT_PASSWORD_ENV`; `ensurePreviewTestAccount` **nu creează contul** dacă
  variabila lipsește (avertisment, fără parolă implicită). Consecință operațională:
  deployment-ul de preview trebuie să aibă `NEXUS_TEST_ACCOUNT_PASSWORD` setat,
  altfel contul nu se auto-provisionează.
- `scripts/dev-test-account.mjs` iese cu cod 2 și un mesaj clar fără variabilă.
- `login-webview.mjs` și `nexus-dev.ps1` cer aceeași variabilă (sau argumentul
  explicit); `nexus-dev.ps1 -Action login` aruncă dacă parola lipsește.
- README-urile (`apps/nexus-web`, `apps/nexus-mobile`) trimit la variabilă și la
  `docs/TEST-DATA.md`; o căutare a parolei vechi în fișierele urmărite nu mai
  găsește nicio potrivire.

### 17.2 Set de date de test (5 conturi + conținut), documentat

- `apps/nexus-web/lib/social-fixtures.js` — plan de date + `seedSocialFixtures`;
- `apps/nexus-web/scripts/dev-social-fixtures.mjs` — CLI (`npm run dev:fixtures`),
  refuză `NODE_ENV=production`, cere `--confirm-local-db`, scrie doar local;
- `docs/TEST-DATA.md` — conturile, conținutul, politica de media, idempotența,
  limitările declarate și dovada rulării.

Cinci conturi (`ana_popescu`, `mihai_ionescu`, `elena_vasilescu`, `andrei_stan`,
`sorina_marin`) plus `test` ca Viewer: 9 urmăriri cu 3 cupluri reciproce (prieteni),
**14 postări** (5 fotografii, 6 Tweet-uri, 3 Reels), **6 story-uri**, 6 comentarii,
5 reacții, **4 conversații** (12 mesaje), **6 notificări** necitite. Media generată
este deterministă (PNG cu encoder propriu) și trecută prin pipeline-ul real;
Reels refolosesc un clip local validat sau primesc `--clip <cale>`.

Defect prins și reparat în timpul verificării: prima rulare **rescria emailul
Viewer-ului** (`test@nexus.ro` → `test@nexus.test`), ceea ce ar fi rupt identitatea
documentată (inclusiv `api.js:396`). Acum `buildAccount(owner…)` rulează cu
`{ resetPassword: false, setFixtureEmail: false }`; baza locală a fost reparată.

### 17.3 Pași noi de captură pregătiți (rulează cu credențiale)

În `tools/web-ref/crawl.mjs`:

- `messages-activity` — notificările sunt **cutia `activity` din inbox**
  (`[data-inbox-box="activity"]`, `public/messenger-shell.js`), nu un ecran separat;
- `profile-other` — profilul altei persoane se deschide din
  `[data-creator-profile]` (`public/feed-surface.js`), preferând dialogul cu `[data-follow]`;
- `create-composer-tweet` — compozitorul de text (`[data-source-jump="tweet"]`,
  dump pe `#composerForm`).

### 17.4 Verificare (offline, fără telefon)

- `node --test --test-reporter=dot` în `apps/nexus-web` → **exit 0** (389 de
  subteste trecute);
- `npm run typecheck` și `npm run lint` în `apps/nexus-mobile` → curate;
- seed pe bază aruncabilă (`NEXUS_DATA_DIR` temporar): rularea completă iese cu
  **cod 0** (stare finală: feed 14, 6 story-uri, 4 conversații, 6 notificări
  necitite); **a doua rulare iese tot cu 0** și nu creează nimic (`posts: 0`,
  `skipped: 26`, `content_sources` stabil la 23) — verificarea este starea finală,
  nu munca depusă, deci o rulare idempotentă nu este raportată ca eșec;
- baza locală de dezvoltare (`apps/nexus-web/data/nexus.sqlite`) este **seedată**:
  feed 14, 8 cu media, 6 story-uri, 4 conversații, 6 notificări necitite, media
  servibilă (`readMedia` verifică hash-ul).

### 17.5 Rămas

Recapturarea cu credențiale a celor trei pași din §17.3 și completarea rândurilor
de matrice corespunzătoare; story rail/vezualizator pe date reale (acum există
story-uri, deci `story-opened` va fi `true`); atribuirea audio din Reel; apoi
sesiunea pe telefon (gesturi: swipe de canal, pull-to-refresh, vizualizator).



### 17.6 Runda de paritate vizuală (2026-10-07) — starea reală

Paritatea reală măsurată este de aproximativ **2 din 10** pe ecranele de bază: matricea marcaseră
`identic` după cod și teste, nu după comparația cu ecranul. De acum fiecare ecran are o notă care
vine din **diferențe măsurate**, în `docs/parity-report/INDEX.md` (nota înainte, ce s-a schimbat,
ce rămâne), plus un `diff.md` numeric și un compozit `web | nativ` în `docs/parity-report/<ecran>/`.

Ce s-a reparat în runda 1 (commit-uri pe branch-ul mobil):

- `4edb4e3` — **shelf-ul de story-uri** pe ecranul Mesaje: `lib/stories.ts`,
  `components/StoryRail.tsx`, `components/StoryViewer.tsx`, cablat în `MessagesScreen`
  (antet de listă) și în `index.tsx` (propriul record de persoană).
- `de3d558` — **tap-ul pe clip deschide viewer-ul full-screen** (`ReelsReader` +
  `MediaViewer` deținut de `FeedScreen`) și **bara de conținut a profilului** e acum cinci
  iconițe (`≡ ▶ ▦ ❝ ✦`) cu citirile din săgeată, sortate cu `profileStamp/Score/Rank`.

Unelte noi (offline, fără dependențe): `tools/parity/device-batch.ps1` (lotul de capturi native,
cu verificarea `mCurrentFocus = app.nexus.mobile.dev` înainte de fiecare input și validarea antetului
PNG), `tools/parity/compare.mjs` (comparația numerică web ↔ nativ), `tools/parity/compose.ps1`
(compozitul JPEG „web | nativ"), plus lotul scris în `docs/parity-report/batch.txt`.

Rămâne de reparat, în ordinea notelor (§17.5 și INDEX): bara de sus a inbox-ului, dialogul
postării deschise cu comentarii/like-uri/reacții, arborele de răspunsuri, bara de reacții,
rail-ul viewer-ului și overlay-ul de creator.

## 18. Gate nou: audit exhaustiv înainte de următorul ecran (2026-10-07)

Această secțiune este **starea de decizie curentă**. Secțiunile anterioare documentează lucrări
istorice; „gata (codul)” de acolo nu înseamnă paritate aprobată. Loginul este singurul ecran aprobat
explicit de owner. Nu s-a modificat niciun ecran nativ în acest audit.

### 18.1 Inventar de surse și progresul lecturii

`rg --files apps/nexus-web` cu extensiile HTML/CSS/JS/MJS/JSX/TS/TSX identifică **298 de fișiere**:
102 în `public/` (interfață, inclusiv `wc-bundle.js` și `device-wallet.js` generate), 31 în `lib/`,
119 în `test/`, 43 în `scripts/`, plus `server.js`, `client/device-wallet-entry.js` și
`src/wc-client.js`. Asseturile publice relevante (SVG/PNG/WebP) sunt inventariate separat (10).

- **Inspectate direct pentru acest gate:** `public/index.html` (ordinea stylesheeturilor),
  `app.js` (MODULES/NAV, `renderHeader`, `renderView`, feed/search/profile și apelurile API),
  `profile-experience.js/.css`, `feed-surface.css`, sursele de module prin referințele API,
  `lib/api.js` prin rutele sale, `src/app/index.tsx` și ecranele native prin apelurile API.
  Auditul anterior `docs/PARITY-MATRIX.md` și `docs/web-ref/` oferă măsurători, dar nu înlocuiesc
  verificarea tuturor stărilor cerute acum.
- **De verificat integral înainte de aprobarea unei fișe:** toate cele 298 de fișiere, inclusiv
  logica de validare/permisiuni din `lib/`, cele 119 teste, modulele de UI încă neparcurse complet,
  variantele CSS finale după cascade/media queries, toate cele patru limbi din
  `interface-locale.js`, toate stările de eroare/goale/offline și răspunsurile concrete ale API.
  Pachetele generate se verifică față de fișierele-sursă și build scripts, fără a le trata ca un
  design separat. **Auditul exhaustiv nu este încă închis; nu se solicită încă aprobare de ecran.**
- Tokens centrali existenți: `src/theme/tokens.ts` (login), `src/theme/social.ts` (Social) și
  `src/theme/webTokens.ts` (variabile CSS extrase din `docs/web-ref/_tokens`). Nu se introduc valori
  noi până la verificarea cascadei și a stilului *computed* live pentru ecranul aprobat.

Site-ul **live Railway** a fost deschis la viewport de 469×1022 CSS px (referință Xiaomi) și arată
buildul web **1.11**, cu Social 7 poziții: Home, Messages, Find, Create, Friends, Live, Profile.
Capturi read-only: `planning/evidence-feed-railway-mobile-20261007.png`,
`planning/evidence-profile-railway-mobile-loaded-20261007.png`,
`planning/evidence-profile-menu-railway-mobile-20261007.png`. Capturile din `docs/screens/` și
`docs/parity-report/` sunt istorice: pot arăta alt conținut și nu sunt aprobarea owner-ului.

### 18.2 Lista de paritate — ecrane și funcții

Starea de mai jos este **funcțională în cod**, nu verdict vizual. „Parțial” înseamnă că o parte din
funcție există, dar fișa/captura/aprobarea lipsesc sau s-a măsurat diferență. Fiecare rând devine o
fișă completă (vizual/stări, comportamente, date, detalii mici, permisiuni, cache, eroare) înainte
de orice portare/corecție a acelui ecran. Sursele sunt `public/` dacă nu e precizat altfel.

| Ecran / funcție web | Sursa principală | API / date | Android acum | Fișa completă? |
| --- | --- | --- | --- | --- |
| Login / sesiune | `app.js`, `client.js`, `styles.css`, `p3-visual-foundation.css` | `/auth/email/login`, `/api/me`, `/api/providers`; cookie/token | **gata** prin aprobarea owner-ului | istorică §2; de completat pentru audit global |
| Shell Social / 7 poziții / drawer | `app.js`, `nav-marks.js`, `feed-hub.js`, `feed-surface.css` | `/api/chat/conversations`, `/api/notifications` (badge); `/api/persona/switch` | **parțial** | nu |
| Feed Reels, Whispers, News și toate lentilele | `app.js`, `feed-surface.js/.css`, `social-gesture.js` | `/api/social/feed?lens&format&cursor`, `/api/social/impressions` | **parțial** | nu |
| Card postare / acțiuni / traducere / Trust | `app.js`, `post-detail.js`, `caption-translation.js`, `ranking-reasons.js` | `/api/posts/:id/*`, `/api/social/posts/:id/trust`, feedback | **parțial** | nu |
| Viewer foto/video / postare deschisă | `app.js`, `post-detail.js/.css`, `clip-options.js` | postare, comentarii, media cu sesiune | **parțial** | nu |
| Comentarii / răspunsuri / sortare | `app.js`, `post-detail.js/.css` | `/api/posts/:id/comments`, `/api/comments/:id/*` | **parțial** | nu |
| Stories / viewer / highlights | `app.js`, `contact-stories.js` | `/api/stories*`, `/api/story-highlights*` | **parțial** | nu |
| Căutare Social / trenduri / taguri | `app.js`, `social-inbox-demo.js` | `/api/social/search`, `/api/social/tags*` | **parțial** | nu |
| Prieteni / followers / following / cereri | `app.js` | `/api/social/relations`, `/api/follow*` | **parțial** | nu |
| Live / studio / competiții | `app.js` | `/api/social/live*` (`GATED_NO_SFU` pentru stream) | **parțial** | nu |
| Profil propriu / ticker / taburi / grilă | `app.js`, `profile-experience.js/.css`, `profile-ticker.js` | `/api/account`, `/api/profiles/:handle?persona=` | **parțial** | nu |
| Profil public / acces privat | `app.js`, `profile-private-access.css`, `creator-profile.js` | `/api/profiles/:handle`, `/api/social/private-access/*` | **parțial/lipsă** | nu |
| Editare profil / copertă / avatar / locație | `profile-hero-edit.js`, `profile-location.js`, `profile-settings-panels.js` | `/api/persona/:id`, `/api/uploads` | **lipsă** | nu |
| Meniu profil / wallet / acces / privacy / aspect | `profile-menu.js`, `profile-settings-panels.js`, `app.js` | `/api/account*`, `/api/persona/:id`, `/auth/logout*` | **lipsă** (sertarul feed este alt meniu) | nu |
| Mesaje: inbox / activity / requests / filtre | `app.js`, `messenger-shell.js`, `messenger-spaces.css` | `/api/chat/conversations`, `/api/notifications*` | **parțial** | nu |
| Conversație / atașamente / E2EE / apel | `app.js`, `chat-crypto.js`, `call-client.js`, `conversation-menu.js` | `/api/chat/conversations/:id/*`, `/api/chat/devices`, `/api/uploads` | **parțial** | nu |
| Notificări și preferințe | `app.js`, `notification-preferences.js` | `/api/notifications*`, `/api/notification-preferences` | **lipsă/parțial** (activity în inbox) | nu |
| Cameră / layout / permisiuni / import | `reel-camera-*.js/.css`, `composer-camera.js/.css` | local; fără API la captură | **parțial**, nativă existentă; etapă ulterioară | nu |
| Editor / overlays / sticker / emoji | `reel-editor-overlays.js`, `reel-sticker-catalog.js`, `composer-emoji.js` | local, apoi upload | **parțial**, etapă ulterioară | nu |
| Muzică / căutare / preview | `reel-auto-sound.js`, `music-grow-module.js` | `/api/reels/sound-suggestions`; `JAMENDO_CLIENT_ID` doar server | **parțial**, etapă ulterioară | nu |
| Drafturi / ieșire / reluare | `creator-draft-sync.js`, `composer-exit.js`, `draft-policy.js` | `/api/creator/drafts*`, `/api/uploads` | **parțial**, etapă ulterioară | nu |
| Publicare / toate câmpurile / retry | `post-publishing.js/.css`, `app.js` | `/api/uploads`, `/api/posts`, `/api/stories` | **parțial**, etapă ulterioară | nu |
| Market / Stay / Ride / Beauty | `fair-verticals.js/.css`, `work-module.js` | `/api/market/*`, `/api/stay/*`, `/api/ride/*`, `/api/business/*` | **lipsă** | nu |
| Work | `work-module.js/.css` | `/api/work/*`, `/api/business/*` | **lipsă** | nu |
| Dating / Privé | `dating-module.js/.css` | `/api/dating/*`, `/api/prive/status` | **lipsă** | nu |
| Watch / Kids / family | `watch-module.js/.css`, `kids.html/js/css` | `/api/watch/*`, `/api/family*`, `/api/kids/*` | **lipsă** | nu |
| Music / Grow | `music-grow-module.js/.css` | `/api/music/*`, `/api/grow/*` | **lipsă** | nu |
| Creator / Pay / Node | `m12-module.js/.css` | `/api/creator/*`, `/api/pay/*`, `/api/node/*` | **lipsă** | nu |
| Onboarding / recuperare / wallet | `app.js`, `onboarding.js`, `device-wallet.js` | `/api/onboarding*`, `/auth/*`, `/wallets/*` | **lipsă**, exceptând login email | nu |

### 18.3 Fișă de lucru: feed Social (neconfirmată — implementarea rămâne oprită)

- **Vizual:** live Railway are wordmark SVG + versiune `1.11` sub el, selectorul unic al lecturii,
  acțiuni în dreapta, scenă neagră full-screen în Reels cu media centrată, rail vertical cu avatar,
  reacții, comentarii, salvare, distribuire și sunet, apoi caption/creator în partea de jos. Bara
  Social are 7 poziții și SVG-urile din `nav-marks.js`. CSS-ul este o cascadă cu multe suprascrieri în
  `feed-surface.css`; **nu** se folosește prima valoare găsită ca token final. Captura live este în
  §18.1. Stările `:active`, `:disabled`, `:focus-visible` și modurile Whispers/News nu sunt încă
  documentate punct-cu-punct aici.
- **Geometrie calculată pe live** (469×1022 CSS px, profil Social, Reels, înainte de scroll):
  `.appHeader.feedHeader` `[0,0,469.6,72]`, padding `10px 12px 9px`;
  `.wordmark` `[12,15.5,80,42]` (include versiunea), `.feedModes` `[98,16.5,38,40]`,
  `.feedHeaderIcon` `[415.6,15.5,42,42]`, `.clipPost` / `.clipStage`
  `[0,0,469.6,970.5]`, `.appNav.social` `[0,970.5,469.6,60]`, butonul „+”
  `[200.8,966.5,68,50]`. Fontul calculat al shellului: `Inter, ui-sans-serif, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif`; acestea sunt rezultate ale cascadei, nu ale primei
  declarații CSS. Se verifică din nou pentru fiecare mod/stare și pentru limba română.
- **Comportament confirmat în sursă:** modurile Reels → Whispers → News; swipe orizontal la
  `|dx| >= 72` și dominanță `> |dy|*1.2`; pull-to-refresh de sus la `dy >= 64` și dominanță
  `> |dx|*1.15`; paginația prin `next_cursor`; menține poziția separată a fiecărei lecturi.
  `feedScrollMemory` restabilește `scrollTop` separat per mod/lens/format; schimbarea lentilei
  începe la top. Paginarea este automată prin `IntersectionObserver` cu `rootMargin` 420px, cu
  buton „mai mult” ca fallback accesibil și gardă single-flight; o pagină ce repetă un ID existent
  este refuzată. Reel-ul pornește la vizibilitate ≥65% și se oprește când iese; impresia pe card
  nemedia pornește la ≥55%. Dublu-tap și toate timerele secundare rămân de completat.
- **Dinamic:** badge necitite din inbox+notificări, indicator „Pull to refresh”, rail cu contoare,
  media/versiune după server. Skeleton, stare goală, eroare/retry, providerul News, SSE/polling și
  textele exacte în toate limbile rămân de verificat. Nu se inventează conținut la provider oprit.
- **Stări confirmate în `loadFeed`:** `feedSkeletonMarkup` (3 elemente, `aria-busy=true`);
  răspuns invalid/eroare → `feedErrorMarkup` + retry + toast; `provider.ready` → titlurile sursei
  aprobate; `provider.disabled` → notice dedicat; `near.consent_required` → notice cu deschidere
  Profil; `posts=[]` → `feedEmptyMarkup`; la refresh indicatorul schimbă textul și blochează
  al doilea refresh. Conținutul este exclusiv cel întors de API, fără seed client-side.
- **Date:** `GET /api/social/feed?lens=<...>&format=<clips|tweets|posts>&cursor=<...>`;
  `/api/social/impressions` pentru afișări; postările poartă media protejată de sesiune. Mutările
  (reacție, save, repost, follow) cer `Idempotency-Key`. Contractul complet al răspunsurilor,
  cache-ul, invalidarea, vizibilitatea și toate codurile de eroare rămân de verificat în `lib/api.js`
  și `lib/repo.js` înainte de confirmare.
- **Android:** codul citește Railway și are 7 mărci, dar paritatea vizuală/comportamentală nu este
  aprobată; componentele `FeedScreen`, `ReelsReader`, `PostCard`, `AppNav` sunt **parțiale**.
- **Limbă decisă de owner:** comparațiile web–Xiaomi se fac **în română pe ambele ecrane**. Sesiunea
  Railway observată inițial era în engleză (`interface_locale=EN` afișat în panoul „Theme and
  appearance”); capturile din §18.1 sunt dovezi de structură, nu comparația finală de copy.
  Web-ul rezolvă limba din `interface_locale` al persoanei, apoi din limba dispozitivului
  (`app.js:609–614`); selectorul oferă `auto`, `ro`, `en`, `pl`, `ar`
  (`profile-settings-panels.js:49`). Nicio preferință a contului Railway nu a fost schimbată
  în acest checkpoint. „Meniu” în Etapa 1 include atât sertarul feedului, cât și meniul de
  setări al profilului până la clarificare, fără a înlocui unul cu celălalt.

### 18.3a Incident feed pe Xiaomi — 130434.jpg (diagnostic, fără modificarea ecranului)

Referința este postarea reală „Venice” (`post_id=2`, `@test`, 6 comentarii) din
Railway 1.11. În sesiunea web autentificată, tap pe video a deschis dialogul
„Nexus media viewer”; tap pe „Comments” a deschis panoul conversației în același
viewer. Captura Xiaomi atașată de owner are 588×1280 px. Telefonul era în
`com.openai.chatgpt` la verificarea ADB, deci nu am atins Nexus Dev și nu am
declarat un test nou efectuat pe dispozitiv. Pagina web live era încă în engleză;
textele exacte românești trebuie validate în comparația finală cerută de owner.

| Detaliu | Web (cod + observație live) | Android actual / diferență |
| --- | --- | --- |
| Antet Reels | `app.js` afișează wordmark SVG, versiune sub el, selector lectură și buton module; la 469 CSS px antetul ocupă 72 px și cuvântul începe la x=12, y=15,5. | `index.tsx` pune `floatingHeader` cu `position:absolute;top:0` în `SafeAreaView edges=['top']`. În captura 130434, logo-ul și `1.11` intră sub iconițele barei de stare Android. Antetul nu este integral vizibil. De verificat pe telefon insetul efectiv înainte de corectarea poziției; nu se ascunde status bar doar ca să mascheze eroarea. |
| Cele două benzi | Web `.clipStage:before` are gradient continuu `rgba(0,0,0,.34)` → transparent la 23–64% → `rgba(0,0,0,.52)` jos (`feed-surface.css`); fără margini drepte ale unei plăci. | `ReelsReader.tsx` desenează **două dreptunghiuri uniforme**, `topPlate` 96 cu `rgba(0,0,0,.34)` și `bottomPlate` 220 cu `rgba(0,0,0,.46)`. Acestea explică liniile drepte vizibile peste imagine. Bara Android de jos este o suprafață separată; paritatea ei se măsoară după eliminarea plăcilor, nu prin crop al videoului. |
| Încadrare | Web `feed-surface.css:2610–2623` suprascrie `object-fit` la **contain** pentru video în Reels și viewer, cu fundal negru când raportul sursei nu corespunde ecranului; păstrează cadrul complet. | `ReelsReader` pornește cu `fit='cover'` și oferă comutatorul `contain`; `MediaViewer` folosește mereu `contain`. Feedul poate decupa mai mult decât web-ul, iar viewerul schimbă brusc încadrarea. |
| Acțiuni și reacții | Web `app.js:3567` are exact `LIKE ♥, LOVE 💗, HAHA 😂, WOW 😮, SAD 😢, ANGRY 😠, FAKE_OPINION ◆, DISLIKE ▼`; reacția selectată `SAD` și totalul `1` apar în postarea Venice. Restul rail-ului folosește `solidViewerIcon` cu SVG-uri proprii pentru comentariu, bookmark/save și share/repost, nu emoji. Selectorul afișează opt reacții și starea selectată. | `ReactionControl` are aceleași opt **tipuri** și glife text, dar React Native folosește randarea emoji Android, diferită de Chromium. `ReelsReader` folosește `💬`, `🏷/🔖`, `🔁` și `♫` ca text în locul SVG-urilor web; astfel forma, culoarea și stările acțiunilor nu corespund. `ReelsReader` nu are exact meniul și metrica web pentru toate stările. Fără a înlocui tipurile de reacție server-side; diferența este în desenare și control. |
| Tap media → fullscreen | Web `openMediaViewer` construiește `reelViewer`: scena media, buton Back, overlay creator/caption, rail cu avatar + reacție/comentarii/save/share/sunet, comentariu rapid și navigare între postări. Tap pe media deschide viewer; dublu-tap are acțiunea de reacție. | `MediaViewer.tsx` este un modal negru cu media `contain`, „×”, săgeți, contor și maxim 4 linii de caption. Nu reproduce headerul, rail-ul, creatorul, selectorul de reacții sau comentariile web. Pe video gesturile viewerului sunt dezactivate în favoarea controalelor native; comportamentul diferă. |
| Arbore comentarii | Web `renderCommentThread` construiește relații după `parent_id`, sortează „Relevant/Newest”, oferă „Vezi răspunsuri (+N)” / ascundere, răspuns la comentariu cu `parent_id`, expandarea textului, acțiuni/reacții/save/repost pe fiecare răspuns și „mai multe” prin cursor. În postarea Venice se văd 5 rădăcini și un răspuns extins. Viewerul comprimă media la 34dvh și pune panoul în restul înălțimii. | `CommentsSheet.tsx` este modal transparent peste feed, nu panoul viewerului. Cere doar prima pagină, fără sortare/retry/paginare; `CommentRow` afișează `replies` ca text simplu și nu reconstruiește arborele din `parent_id`; composer-ul apelează `createComment` fără `parentId`. Butonul „răspunde” și ramurile pliante lipsesc. |
| Date, stare, acces | Feed `GET /api/social/feed?...`; viewer lucrează cu postările din feed și media autentificată; comentarii `GET /api/posts/:id/comments?sort=<relevant|newest>&cursor=<n>` cu `next_cursor`; mutații reale `POST /api/posts/:id/reaction`, `/save`, `/repost`, `POST /api/posts/:id/comments` cu `parent_id`, respectiv acțiuni pe `/api/comments/:id/*`. Web verifică persona, viewerul și cursorul, previne duplicatele, arată loading/empty/error/retry și folosește chei de idempotency. Share extern este oprit pe server; nu se simulează succesul. | Nativul citește date reale, dar contractul complet al comment tree, vizibilitatea, codurile de eroare și toate acțiunile pe comentariu nu sunt implementate/verificate. Nu se modifică backend-ul sau datele pentru un fix vizual. |

**Corecția propusă, după confirmarea fișei:** (1) măsurarea insetului pe Nexus
Dev în prim-plan, apoi poziționarea antetului în aria sigură; (2) înlocuirea
plăcilor uniforme cu gradientul extras din CSS și verificarea înălțimii scenei
față de navigația Social; (3) păstrarea cadrului complet ca pe web; (4) portarea
SVG-urilor/acțiunilor și a selectorului exact; (5) reconstruirea viewerului și
a panoului de comentarii cu arbore, sortare, paginare și mutații reale. După
fiecare corecție: capturi web/Xiaomi **în română**, verificare funcțională,
typecheck/lint. Nu necesită APK nou pentru schimbări JS/SVG existente; doar
dacă măsurarea impune configurare nativă se cere aprobarea acelei alternative.

**Necunoscute ce blochează verdictul final:** inseturile/sistem UI măsurate în
Nexus Dev (nu în ChatGPT), cascadele CSS pentru toate breakpoints/stările,
contractul complet al comment API pentru fiecare rol/permisiune și comparația
live română–română. Auditul global §18.1 și fișa integrală §18.3 rămân
neînchise; această fișă de incident nu constituie aprobarea feedului.

### 18.4 Diferență certă descoperită în profilul live

Fișa istorică §4 transcrie coperta **72 px** și avatarul **78 px**, dar cascadele ulterioare din
`profile-experience.css` schimbă rezultatul. Pe live, la 469 CSS px și profilul propriu cu copertă,
`getComputedStyle` + `getBoundingClientRect` dau **copertă 168 px**, **avatar 104 px**, identitate
suprapusă cu **−46 px**, ticker ~36 px, bara de taburi ~47 px. `--portraitSize:104px` apare în CSS la
linia 322, iar `.ownerCover{height:168px}` la linia 235. Profilul nativ din captura istorică
`docs/parity-report/profile/native-own-0.png` are alt antet, altă grilă și altă ordine a elementelor;
nu poate fi declarat „gata” pe baza datelor reale afișate sau a tokenilor vechi. Varianta live are
meniul propriu „Account and settings” cu **Profile, Wallet and username, Access and security,
Privacy, Notifications, Theme and appearance, Log out** — nu este sertarul de module din feed.

### 18.5 Regula de continuare

1. Completează auditul de surse și câte o fișă **pentru fiecare rând** din §18.2, cu stări vizuale,
   gesturi, keyboard/back/scroll, dinamică, date/permisiuni/cache, copy/validări/localizare și
   întrebări necunoscute. Marchează explicit ceea ce nu poate fi observat fără acțiuni de scriere;
   nu le executa pe Railway doar pentru audit.
2. Cere aprobarea owner-ului pentru fișa ecranului următor. Până atunci **nu edita ecranele**.
3. După aprobare, modifică doar ecranul respectiv și tokens verificați; rulează typecheck/lint/teste,
   compară capturile live web vs Nexus Dev pe Xiaomi, corectează și cere aprobare vizuală. Niciun
   ecran următor și nicio etapă 2–5 fără aprobarea corespunzătoare.

### 18.6 Verificare a acestui checkpoint de audit

- `npm run typecheck`: **0 erori**.
- `npm run lint`: **eșuează** cu 4 erori `react-hooks/set-state-in-effect` în
  `ActivityCenter.tsx` și `MessagesScreen.tsx`, plus 1 avertisment de import nefolosit în
  `ActivityCenter.tsx`. Aceste fișiere nu au fost editate în checkpoint; reparația se planifică după
  aprobarea fișelor aferente, nu se ascunde și nu se atribuie documentației.
- `git diff --check -- apps/nexus-mobile/MIGRATION.md`: **0 erori**.
- Xiaomi nu a fost atins în acest checkpoint: transportul Wireless Debugging s-a schimbat la
  `192.168.1.184:35627`, iar `mCurrentFocus` este `NotificationShade`, nu `app.nexus.mobile.dev`.
  Conform regulilor §9, nu s-au trimis inputuri și nu s-a luat captură nativă nouă.
- Nu s-a generat APK, nu s-a instalat nimic și nu s-a făcut deploy.

### 18.7 Corecție feed verificată pe Nexus Dev · 7 octombrie 2026

Owner-ul a autorizat corecțiile punctuale în Nexus Dev fără confirmare înaintea fiecărei ajustări.
Aceasta nu este aprobarea migrării altor ecrane sau a etapelor 2–5.

- Antetul Reels este poziționat sub insetul barei de stare; în captura actuală logo-ul și versiunea
  `1.11` sunt complet vizibile (`docs/parity-report/feed/native-feed-after-viewer-20261007.png`).
- Cele două plăci întunecate cu margini drepte au fost înlocuite de gradientul exact din
  `feed-surface.css`, cu opacitatea transmisă explicit prin `stopOpacity`. Prima încercare care
  trimitea `rgba()` direct în `stopColor` a acoperit media în negru pe Android; captura
  `docs/parity-report/feed/native-feed-gradient-fixed-20261007.png` confirmă corecția.
- Iconițele de comentarii, salvare, distribuire și sunet folosesc căile SVG din
  `reels-reference.js`; cele opt reacții și ordinea lor rămân cele din web. Glifele emoji ale
  reacțiilor non-LIKE folosesc randarea sistemului Android, care poate diferi de Chromium.
- Tap pe conținut deschide viewerul cu rail-ul, creatorul și comentariul rapid. Tap pe comentarii
  în feed deschide același viewer direct cu conversația, nu un modal separat.
- Conversația reconstruiește rădăcinile/răspunsurile prin `parent_id`, poate extinde/ascunde
  răspunsuri, sorta, pagina, trimite răspunsuri și folosește endpoint-urile reale pentru reacție,
  salvare și redistribuirea comentariului. Numele și avatarul sunt citite din câmpurile plate
  ale răspunsului API. Composer-ul este deasupra barei Android. Capturi:
  `docs/parity-report/comments/native-direct-stable-20261007.png` și
  `docs/parity-report/comments/native-tree-expanded-20261007.png`.
- Timestamp-urile Unix în secunde sunt convertite înainte de formatare; captura
  `docs/parity-report/comments/native-time-fixed-20261007.png` nu mai afișează anul 1970.
- Clipurile orizontale au în continuare spațiu negru sus/jos în zona **media**, fiindcă ultima
  cascadă web cere `object-fit:contain` (linia ~2610). Și captura web
  `planning/evidence-feed-railway-mobile-20261007.png` arată această încadrare. Eliminarea acelor
  spații ar cere crop (`cover`) sau un fundal duplicat; nu s-a făcut o abatere tacită de la web.
  Benzile sistemului Android din jurul status/navigation bar sunt distincte de vechile plăci.
- Verificare: `npm run typecheck` trece; ESLint pe toate fișierele native editate trece.
  `npm run lint` global rămâne roșu numai pe 4 erori și 1 avertisment preexistente din
  `ActivityCenter.tsx` și `MessagesScreen.tsx`. Nu s-a generat/instalat APK și nu s-a făcut deploy;
  modificările JS/SVG s-au văzut pe Xiaomi prin Fast Refresh. Captura web live de control era în
  engleză, deci comparația textuală finală română–română rămâne de aprobat separat.

### 18.8 Benzile la clipurile verticale · 8 octombrie 2026

Capturile owner-ului `130460.jpg` (feed) și `130458.jpg` (viewer) arată benzi negre la marginea
superioară și inferioară a clipului vertical. În feed, cauzele erau `SafeAreaView` care rezerva zona
de status și `AppNav` în fluxul layout-ului; în viewer, `contain` lăsa spațiu la un raport de ecran
mai înalt decât clipul, iar modalul nu se întindea sub bara de navigație Android.

- Modul Reels lasă media să ocupe suprafața de sub status și sub bara cu 7 iconițe. Antetul și
  navigația sunt overlay-uri; doar controalele respectă insets. Rail-ul și metadatele sunt ridicate
  deasupra navigației ca să rămână apăsabile.
- Fundalul gradient al navigației și umplerea aproape opacă a sticlei sunt omise **numai** în
  Reels; geometriile, iconițele SVG și celelalte ecrane rămân neschimbate. Opacitatea SVG a
  gradientului din antet este transmisă explicit (`stopOpacity`), nu prin `rgba()` în `stopColor`.
- Pista decodată `expo-video` decide încadrarea: media video verticală folosește `cover`, cea
  orizontală `contain`; viewerul cu comentarii deschise păstrează `contain`, deoarece panoul
  reduce zona media la 34%. Unele fișiere declară pista `1024×576` deși rotația de afișare
  este portret; pentru aceste cazuri, un thumbnail nativ la 64 px furnizează orientarea vizibilă
  (`36×64` pentru clipul de test), memorată după hash. Clipurile orizontale rămân `contain`.
  Modalul folosește `navigationBarTranslucent` și `statusBarTranslucent`.
- Bara Android cu 3 butoane rămânea gri chiar după corecțiile JS. S-a adăugat
  `expo-navigation-bar` cu contrast forțat dezactivat și culoare transparentă în configurația
  nativă; `<NavigationBar style="light" />` păstrează pictogramele albe. Aceasta **a cerut APK nou**:
  `npm run build:android:dev` a reușit, iar `adb install -r` pe Xiaomi a reușit fără resetarea
  datelor aplicației. Nu s-a făcut deploy Railway sau Play Store.
- Xiaomi 17 Pro a fost conectat prin transportul Wireless Debugging descoperit automat de ADB;
  conexiunea directă la `192.168.1.184:39165` a fost refuzată. Capturile după instalare arată
  clipul portret până sub status bar, navigația Nexus și butoanele Android, fără benzi opace:
  `docs/parity-report/feed/native-playing-games-nav-transparent-20261008.png` și
  `docs/parity-report/viewer/native-playing-games-nav-transparent-20261008.png`. Captura
  `docs/parity-report/feed/native-video-landscape-overlay-20261008.png` documentează separat
  păstrarea clipului orizontal în `contain`. Este verificare vizuală pe dispozitiv, nu aprobarea
  finală a owner-ului pentru paritatea întregului feed.
- `npm run typecheck`, ESLint focalizat pe fișierele ecranului/overlay-urilor și `git diff --check`
  trec. Lint-ul global păstrează cele 4 erori și 1 avertisment preexistente din
  `ActivityCenter.tsx` / `MessagesScreen.tsx`; nu s-au editat aceste ecrane.

### 18.9 Corecție după feedback-ul owner-ului · 8 octombrie 2026

Captura `130488.jpg` a surprins două defecte după §18.8: o muchie întunecată sub bara de stare
și notificarea `Uncaught (in promise) ... ExpoNavigationBar.setHidden ... The current activity is
no longer available`. Textul complet a fost confirmat prin UI dump numai cu Nexus Dev în prim-plan.

- `<NavigationBar style="light" />` din layout-ul React Native declanșa apeluri native asincrone
  neprotejate la schimbarea activității. Componenta a fost eliminată; stilul pictogramelor Android
  este definit în pluginul nativ `expo-navigation-bar` (`style: light` generează
  `android:windowLightNavigationBar=false`). Bara rămâne transparentă, cu contrastul forțat oprit.
- Antetul Reels își extinde gradientul original și peste insetul de status, păstrând conținutul
  la aceeași poziție. Astfel nu mai există trecerea abruptă dintre zona sistemului și antet.
- `npm run build:android:dev` a reușit (`BUILD SUCCESSFUL`), iar `adb install -r` pe Xiaomi a
  reușit. După pornire curată prin development serverul LAN, captura feed
  `docs/parity-report/feed/native-venice-final-no-seam-20261008.png` și captura viewer
  `docs/parity-report/feed/native-venice-final-20261008.png` arată zona de sus continuă și
  butoanele sistemului lizibile peste video. UI dump nu mai conține notificarea `Uncaught` după
  pornire și revenirea din viewer în feed. Nu s-a făcut deploy pe Railway.
- `npm run typecheck`, ESLint focalizat pe fișierele atinse și `git diff --check` au trecut.

### 18.10 Viewer, Jamendo și formatul camerei · 8 octombrie 2026

Feedback-ul `130503.jpg` arată că vechiul gradient întuneca tot fundul viewerului și că rail-ul
de muzică și descrierea intrau peste bara „Adaugă un comentariu”. Gradientul viewerului este acum
transparent la baza scenei; pozițiile rail-ului și descrierii sunt calculate din insetul barei
Android și din înălțimea barei de comentarii. Nu se decupează mai mult din clip pentru a ascunde
aceste benzi.

Aplicația avea numai căutare/previzualizare Jamendo și refuza publicarea unei selecții de catalog,
deși `POST /api/posts` acceptă `jamendo_selection_token`. Contractul nativ trimite acum tokenul
semnat de Railway, verifică `external_audio.id` în răspuns și refuză local un URL fără token.
Catalogul este cerut automat o singură dată la deschiderea unei capturi noi, fără a suprascrie
muzica deja aleasă. Dacă API-ul nu are `JAMENDO_CLIENT_ID` sau nu răspunde, editorul arată
eroarea reală și permite continuarea fără muzică. Fișierele Jamendo și cheia serviciului nu sunt
stocate în APK. Clipurile și fotografiile publicate cu `external_audio.provider=jamendo` au acum
redare separată prin `expo-audio`; pentru video, timpul piesei urmează segmentul de previzualizare
semnat și poziția clipului. Controlul de format existent din dreapta arată valoarea curentă
(`9:16` sau `3:4`); captura rămâne implicit `9:16`.

Editorul păstrează acum stickerele mutabile de oră, dată și locație introdusă de autor în
draftul local. Pentru postare construiește `studio_manifest` cu cheile acceptate de
`creator-studio.js`, iar feedul/viewerul nativ citesc decorurile numai când serverul întoarce
`creator_studio.integrity=VERIFIED`. Fonturile decorative suplimentare și localizarea GPS
rămân neimplementate până la alegerea explicită a variantei de font și a metodei de locație;
nu se presupune o poziție. Poziționarea decorurilor față de media importată cu un raport
necunoscut și randarea finală a fișierului exportat necesită încă verificare pe Xiaomi. Aceasta
nu este paritate completă a editorului.

Verificare locală: `npm run typecheck` și ESLint pe fișierele atinse trec. `npm run lint` global
rămâne roșu pe aceleași 4 erori din ActivityCenter/MessagesScreen și un avertisment. Nu există
transport ADB conectat la finalul acestei iterații, deci noul layout și sunetul nu au încă
verificare vizuală/auditivă pe Xiaomi. Sunt numai schimbări JS/TS; Fast Refresh este suficient
după reconectare, fără APK nou. Nu s-a făcut deploy Railway.
Manifestele generate pentru fotografie și video, fiecare în 9:16 și 3:4, cu text, oră, dată și
locație, au trecut direct prin `normalizeCreatorStudio` din backend în testul local, fără scriere
de postări.

### 18.12 Audit offline · arborele de comentarii native · 8 octombrie 2026

Surse citite înainte de implementare: `public/app.js` (`commentSurfaceMarkup`,
`renderCommentThread`, `renderBranch`, `[data-reply-to]`), `public/feed-surface.css`
(cascada finală a comentariilor), `public/interface-locale.js`, `lib/api.js`, `lib/repo.js`,
`lib/db.js`, `lib/moderation.js` și clientul nativ existent. Nu se modifică web-ul/backend-ul.

**Forma datelor.** `GET /api/posts/:id/comments` răspunde cu `ok`, `post_id`, `viewer_id`,
`viewer_persona`, `comments[]`, `sort`, `cursor`, `next_cursor`, `root_count`, `relevance`.
Fiecare comentariu are `id`, `post_id`, `user_id`, `actor_persona`, `parent_id`, `body`,
`status`, `created_at`, `edited_at`, `withdrawn_at`, `version`, `handle`, `display_name`,
`avatar`, `reply_count`, `reaction_count`, `reactions:{counts,viewer_reaction}`,
`parent_author`, plus `can_pin`, `pinned_by_owner`, `saved_by_me`, `views`,
`view_impressions`, `note_requests`, `reply_shares`, `shared_by_me`. Nu există câmp media.
`withdrawn` are `body:""` și rămâne în fir; `hidden`/`in_moderation` nu sunt statusuri
livrate de acest endpoint. Comentariile blocate/amuțite nu sunt livrate cititorului, cu
excepția tombstone-urilor retrase. Postările inaccesibile dau 404.

**Rute confirmate.** `GET /api/posts/:id/comments?sort=relevant|newest|oldest&cursor=N`
acceptă cursor multiplu de 20, între 0 și 2000; pagina cuprinde maxim 20 rădăcini **și
toți descendenții vizibili ai lor** din plafonul de 1000 comentarii. `next_cursor` paginează
numai rădăcinile. Sortarea `relevant` este pin, `reaction_count+2*reply_count`, apoi
recență; `newest`/`oldest` ordonează cronologic. Nu există endpoint separat pentru
răspunsuri: „Vezi încă N răspunsuri” în client dezvăluie local cele deja primite, fără să
pretindă o cerere de pagină la server. `POST /api/posts/:id/comments` primește
`{body,parent_id?}`, text nevid sanitizat la 1000 caractere, returnează 201 cu comentariul.
Părintele trebuie să aparțină aceleiași postări; postarea cu `publishing.allowComments=false`
dă 403, iar blocarea automată dă 422. `POST /api/comments/:id/reaction` cu
`{kind:"LIKE",active:boolean}` întoarce noul rezumat; `DISLIKE` este interzis.
`DELETE /api/comments/:id` retrage numai comentariul propriu, păstrează istoricul/firul.
`POST /api/comments/:id/report` primește categoria validă de moderare și detalii de maxim
500 de caractere; un raport individual nu elimină conținutul. Mai există PATCH editare,
POST pin al proprietarului postării, POST save/share, dar arborele curent nu le extinde.

**Limite de server.** Nu există poze/clipuri în comentarii, upload atașat, `scan_status`
pentru comentariu, limită de număr de poze ori paginare separată a unui singur fir. Nu
afișăm un control activ de galerie sau o previzualizare de poză fictivă. API-ul nu trimite
un indicator distinct `comments_disabled` la listare; clientul citește
`post.publishing.allowComments` când este disponibil și tratează 403 la trimitere.

**Design extras, nu estimat.** Cascada finală `feed-surface.css:3174-3240` suprascrie
valorile intermediare de la 2513 și 2744. Lista are fundal `#0b0d10` și padding
`5px 28px 8px` (sub 360px: 14px lateral); firul max-width 480 și margin-bottom 4; rândul are min-height 64,
margin-bottom 4, padding `5px 8px`, rază 10, grilă avatar 36 + gap 7, adâncime
`min(depth,3)*10px`. Avatarul este 36×36, circular. Nume 12/900, handle 10, timp 9,
antet 16; text 12/16, culoare `#f1f2f3`; acțiuni 20 înălțime, icon 14, contor 9.
Răspunsul are fundal gradient `#14171b→#0f1114`, bordură
`rgba(255,255,255,.065)`. Firul vertical este 1px
`rgba(255,255,255,.12)` din `.commentReplyChildren`; controlul răspunsurilor este
`#aeb4ba`, font 10/800, înălțime 25. Composerul: fundal `#0b0d10`, input
`#141414`, 42px, rază 23, font 15, bordură `rgba(255,255,255,.15)`, trimitere
alb/#050505. Aceste valori intră în `src/theme/social.ts`. Limita web de 3 rânduri
este înlocuită de cerința explicită a owner-ului de 5 rânduri; aceasta este o diferență
intenționată, nu o aproximare. Textele locale existente: „Niciun comentariu încă.”,
„Vezi mai mult”, „Vezi mai puțin”, „Mai multe conversații”, „Comentariu retras ·
istoricul este păstrat”.

**Stare înainte de lucru.** Nativul avea deja un arbore reconstruit din `parent_id`, dar
randat recursiv sub un `FlatList` de rădăcini; stare locală per subcomponentă pierdută la
virtualizare, text tăiat la 3 rânduri după lungimea în caractere, trimitere fără rând
optimist și like fără rollback optimist. De înlocuit cu rânduri plate virtualizate, stare
de fir la nivelul foii, măsurarea reală a liniilor și retry idempotent.

**Implementare locală.** `commentRows.ts` proiectează datele plate într-o singură secvență
pre-order pentru `FlatList`; controlează deschiderea primelor trei răspunsuri, dezvăluirea
câte trei și strângerea firului, fără componente recursiv imbricate. `CommentsSheet.tsx`
păstrează starea cât foaia rămâne deschisă, plafonează indentarea la nivelul 3, afișează
contextul autorului părinte, măsoară liniile reale prin `onTextLayout` pentru limita de
cinci, actualizează timpul la fiecare minut, oferă refresh, skeleton, stare goală, eroare,
retry, meniu de raportare/retragere și composer deasupra tastaturii. Comentariul nou apare
imediat în fir; pe eșec rămâne cu „Nu s-a trimis · Reîncearcă” și aceeași cheie idempotentă.
Aprecierea LIKE este optimistă și revine la rezumatul anterior dacă API-ul eșuează.
După confirmarea serverului, contorul comentariilor din card și viewer se actualizează
local fără a aștepta un refresh al feedului; când pagina completă de comentarii este
citită, se reconciliază cu numărul real de pe server. Pe Xiaomi, acesta a trecut
din 17 în 18 după reluarea datelor, fără un nou comentariu de test.
`Origin` vine din `authHeaders()`, nu dintr-un secret în APK. Tap pe cardul postării
din feed/profil/căutare deschide comentariile; media poate fi văzută separat în viewer.

**Date și verificare.** Cele 15 comentarii și 3 LIKE de pe postarea 5 sunt documentate în
`docs/TEST-DATA.md`; serverul a întors 17 comentarii sub 4 rădăcini, cu 9 răspunsuri la
comentariul 20. `node scripts/test-comment-rows.cjs` a trecut 3/3 teste, inclusiv 250
de comentarii și un ciclu malformat. `npm run typecheck` și ESLint pe fișierele atinse
trec. `npm run lint` global rămâne roșu pe patru erori preexistente din
`ActivityCenter.tsx` și `MessagesScreen.tsx` (plus un avertisment). Browserul web a fost
capturat pe aceeași postare la viewport 469×1021 în
`docs/parity-report/comments/web-post-5-20261008.jpg`; geometria DOM este în JSON-ul
alăturat. Browserul disponibil a raportat DPR 1, nu DPR 2,6, deci cerința exactă de DPR
nu este îndeplinită.

**Verificare pe Xiaomi, după reconectare.** `app.nexus.mobile.dev` a fost verificată în
prim-plan înainte de fiecare input. Captura nativă și dump-ul comprimat sunt în
`docs/parity-report/comments/native-post-5-20261008.{png,xml}`. Pe postarea 5 s-au
verificat direct: deschiderea, dezvăluirea următoarelor răspunsuri, strângerea firului
prin linie, „Vezi mai mult”/„Vezi mai puțin”, LIKE optimist cu confirmarea 3→4,
selectarea autorului pentru răspuns și trimiterea unui răspuns real. Răspunsul a rămas
după Fast Refresh; rădăcina 20 arată acum 10 răspunsuri. Tastatura Xiaomi acoperea
inițial butonul de trimitere; `CommentsSheet` ridică acum composerul deasupra marginii
tastaturii (butonul y=1359–1474 px, tastatura începe la y=1492 px), iar viewerul
folosește întreaga înălțime disponibilă. Captura și XML-ul sunt în
`docs/parity-report/comments/native-keyboard-20261008.{png,xml}`. Nu s-au modificat
setările telefonului, aplicații externe ori backend-ul.

**Comparație numerică parțială.** La lățimea de 469 CSS px, web-ul are marginea
rândului la x=27,99; nativul folosește paddingul extras de 28 dp. Poziția textului
din primul rând este x=208/2,6=80 dp, față de x≈79 CSS px calculat din margine,
paddingul 8, avatarul 36 și gap-ul 7 (diferență ≈1 dp). Composerul web începe la
y=958,3 CSS px, cel nativ la y=2403/2,6=924,2 dp (diferență absolută ≈34 dp,
corelată cu insets/viewport-ul sistemului). Antetul primului rând este cu ≈29 dp
mai sus în nativ; după alinierea offsetului sistemului, diferența relativă este
≈5 dp. Geometria măsurabilă primește **9/10** după normalizarea insets, dar acesta
nu este scorul final al întregii experiențe: web DPR 2,6, refresh, meniurile,
raportarea și proba cu 200+ comentarii pe telefon rămân neverificate. Pozele în
comentarii nu pot fi probate până nu există suport pe server. Modificările rămân
JS/TS și se văd cu Fast Refresh; nu este nevoie de APK nou.

### 18.11 Comenzi pentru camera nativă · 8 octombrie 2026

Ruta `+` din navigația Social continuă să deschidă `camera.tsx`. Foto și video pornesc în
9:16 pe întregul ecran; controlul din dreapta comută direct la 3:4 (cadrul mediu) și înapoi,
fără schimbarea rezoluțiilor deja folosite sau zoom artificial. În aceeași bară există acum
comutare spate/selfie, lumină pentru obiectivele care oferă torch sau flash și timer
0 → 3 → 10 → 0 secunde. Numărătoarea poate fi anulată și se oprește la schimbarea modului,
obiectivului ori cadrului. „Add sound” caută și previzualizează piese prin
`GET /api/reels/sound-suggestions`; selecția semnată este scrisă în draftul local al capturii,
iar editorul nu o înlocuiește automat. Dacă `JAMENDO_CLIENT_ID` lipsește pe Railway, se arată
eroarea API-ului, nu o listă fictivă. Nu există cheie Jamendo în client.

Verificat local: typecheck și ESLint focalizat trec; cele 9 teste existente de contract audio
trec. `npm run lint` global rămâne roșu numai pe cele 4 erori preexistente din
ActivityCenter/MessagesScreen (plus un avertisment). Xiaomi nu apare momentan în ADB, deci
comportamentul vizual, torch și temporizatorul nu sunt încă validate pe dispozitiv. Modificarea
este numai JS/TS și ajunge prin Fast Refresh; nu s-a creat APK nou și nu s-a făcut deploy.

### 18.13 Ajustare cerută de owner · antet și comentarii · 8 octombrie 2026

Această cerință suprascrie intenționat fișa CSS istorică §18.12 pentru prezentarea
comentariilor: rândurile nu mai au chenar, rază, fundal alternativ sau linie verticală;
au numai separator orizontal, iar răspunsurile păstrează indentarea limitată la 3 niveluri.
Nu se adaugă textura de carte propusă anterior, deoarece owner-ul a cerut un rezultat
mai discret și explicit „fără chenar”. Meniul fiecărui rând este un SVG cu trei puncte
verticale mici și țintă tactilă de minimum 44 dp. Bara de stare primește o bandă
translucidă pe toate rutele cu notificări vizibile; camera rămâne excepție deoarece își
ascunde bara de sistem. În feed-ul imersiv, antetul/wordmark-ul original SVG coboară 6 dp,
iar wordmark-ul stă într-o ramă discretă de tip emblemă TV, cu versiunea păstrată.

Contractul real pentru editare este `PATCH /api/comments/:id` cu `{body}` (maxim 1000
caractere), iar istoricul este `GET /api/comments/:id/versions` cu lista
`{version,body,content_commitment,created_at}`. Ambele sunt restrânse pe server la
**autorul comentariului și persona lui**, nu la proprietarul postării. Nativul arată
„Editează” și „Istoricul editărilor” numai acelui autor; editarea se reflectă local după
răspunsul serverului. Istoricul și panoul de editare au fost deschise pe Xiaomi pentru
un comentariu propriu; istoricul real s-a încărcat. Trimiterea unei editări nu a fost
probată pe datele Railway pentru a nu modifica un comentariu existent. Pe comentariul
altui autor, meniul a afișat doar opțiunea de raportare. În dump-ul nativ, banda de
stare ocupă y=0–150 px fizici, iar logo-ul feed-ului începe la y=201 px. Typecheck și
lint globale trec. Doar JS/TS și documentație; Fast Refresh, fără APK nou și fără deploy.

