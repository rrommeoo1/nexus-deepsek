# MIGRATION.md — Nexus Android (Expo/React Native)

Memoria migrării. Se actualizează continuu: ce e gata, ce rămâne, deciziile luate, problemele cunoscute.
Referința este versiunea web (`apps/nexus-web`) și site-ul live de pe Railway. Regula de aur: se
transcriu valorile exacte din CSS/cod, nu se estimează și nu se redesenează nimic.

Legendă stare: **gata** = portat și verificat pe Xiaomi · **parțial** = portat, neverificat pe dispozitiv
sau cu detalii lipsă · **lipsă** = neportat.

## 0. Stare globală

| # | Etapă | Stare |
| - | - | - |
| 1 | Sesiune persistentă, navigație Social (7 poziții), feed + profil reale, meniu, refresh, stări de încărcare/eroare/reluare | **gata** (codul), verificare pe dispozitiv în curs |
| 2 | „+" și camera nativă conectată la flux (foto/video/zoom/import/previzualizare, permisiuni) | **gata** (codul) — camera există (9:16, 0,7×, 3:4 la 1×, import galerie, permisiuni) și captura se întoarce în composer (`camera.tsx` → `CaptureEditor` → `PublishPanel`); verificare pe dispozitiv în curs |
| 3 | Editor (text, emoji/stickere mutabile, muzică Jamendo, randare finală) | **parțial** — text mutabil + emoji + căutare/previzualizare Jamendo în draft; compunere finală lipsă |
| 4 | Publicare (copertă, titlu, descriere, hashtaguri, mențiuni, locație, link, vizibilitate, comentarii, repost, AI, descărcare, watermark, draft, postare reală, fără dublare la retry) | **parțial** — formular complet (titlu, descriere, #/@, locație + precizie, link, vizibilitate, comentarii/repostare/descărcare/watermark, declarație AI, drepturi audio + atribuire), salvare în cont și publicare reală din aplicație, cu cheie de idempotency per intenție; rămân neportate: compunerea finală a fișierului (watermark/overlay ars), salvarea pe dispozitiv și etichetarea persoanelor după id |
| 5 | Restul ecranelor (comentarii, notificări, mesaje, căutare, setări etc.) | **parțial** — comentariile sunt portate (fir citit/scris prin API-ul real, `CommentsSheet`); mesaje, căutare, prieteni și live sunt marcate *onest* ca neportate (`PendingScreen`, vezi §8); notificări și setări rămân **lipsă** |

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
| 5. Camera nativă | `reel-camera-surface.js/.css`, `reel-camera-framing.js`, `reel-camera-quality.js` | niciunul (local) | **gata** (codul) — 9:16 UHD, 0,7× pe obiectivul virtual, 3:4 la 1×, import galerie, permisiuni refuzabile fără blocare; captura se întoarce în composer (editor → „Detalii postare") |
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
- audio din catalog (Jamendo) **nu** poate fi publicat din aplicație: serverul are nevoie de fișierul
  urcat, deci panoul explică refuzul în loc să încerce (`CatalogAudioError`);
- un buton se oferă doar când acțiunea poate reuși: MIME refuzat (HEIC/MOV), catalog audio sau cont
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
| 4 | Clipuri în feed | modul `reels` randează `ReelsReader` (immersiv, `cover`) doar când `posts.length>0` | `feed-surface.css:474-521` | de verificat redarea reală (`expo-video` + `Range`; server `accept-ranges: bytes`, bucăți ≤ 4 MB, `api.js:4775`) | **de verificat pe telefon** |
| 5 | Mesaje (inbox) | `PendingScreen("Mesaje", …)` | `messenger-shell.js` / `p2-messaging.css` | neportat | **deferred** (necesită endpoint de conversații + transport live) |
| 6 | Căutare / Prieteni / Live / persona non-social | `PendingScreen(…)` | — | neportat | **deferred** |

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

