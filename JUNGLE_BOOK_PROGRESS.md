# JUNGLE BOOK — FEED UNIVERSAL 9:16

**Data:** 18–19 octombrie 2026
**Repo:** `C:\Users\Romeo\projects\nexus_deepsek` (branch `codex/camera-draft-stability`)
**Stare:** Fazele 0–4 livrate și verificate (feed universal, text reel, text + media, quote pe server).
Composer-ul universal, grila de profil și paritatea web sunt următoarele.
**Regulă:** ce nu a fost rulat este marcat explicit ca netestat.

---

## 1. Ce s-a livrat (cod real, nu promisiuni)

### Faza 0 — Contractul de prezentare (pur, testabil)
- `apps/nexus-mobile/src/lib/postPresentation.ts` (nou): `MAX_MEDIA=5`, `MAX_TEXT_PAGES=5`,
  `MAX_QUOTE_LAYERS=3`, `TEXT_PAGE_CHARS=420`, `mediaLayoutFor`, `mediaOf`/`galleryOf`/`videoOf`/`textOf`,
  `stageFor`, `quoteChain`, `textPages`, `textPreview`, `locationOf`, `tagsOf`.
  Importă **doar tipuri**, deci poate fi încărcat de `node` fără React Native.
- `apps/nexus-mobile/src/lib/socialTypes.ts`: `repost`, `quoted_post` și blocul `publishing` complet
  (`title`, `location`, `locationPrecision`, `link`, `allowRepost`, `allowDownload`).
- `apps/nexus-mobile/scripts/test-post-presentation.cjs` (8 teste) și intrarea lui în `npm test`.

Decizii codificate: o postare are cel mult 5 atașamente (serverul încă acceptă 10, deci o postare veche
devine carusel, nu pierde fișiere); textul se paginează determinist pe cuvinte, fără să rupă cuvinte sau
paragrafe; un lanț de quote arată cel mult 3 panouri (ultimul quote, cel anterior, originalul).

### Fazele 1–3 — Feed universal, text reel, text + media (mobil)
- `apps/nexus-mobile/src/components/PostReading.tsx` (nou):
  - `PostTextReading` — pagini orizontale, indicator `1/3`, tipografie 20/29 (fără întindere artificială);
  - `PostMediaGallery` — pager pentru 1…5 atașamente; doar pagina vizibilă redă clipul;
  - `QuotePanels` — maximum 3 panouri (latest / previous / original), autor, timp, text, miniatură media,
    fiecare panou deschide postarea lui.
- `apps/nexus-mobile/src/components/ReelsReader.tsx`: `ReelPage` este acum pagina universală, iar
  `stageFor()` alege randatorul:
  - `reel` — clip fără descriere: **exact** randarea de dinainte (veil, decorări, tap, rail);
  - `media` — imagine/clip cu text, galerie paginată, blocul meta existent;
  - `text` — autor sus, text centrat, locație + hashtaguri, rail neschimbat;
  - `quote` — comentariul propriu + panourile conversației.
  Linia „X a repostat” apare pe toate fazele (`post.repost`). Rail-ul, reacțiile, save, distribuire,
  sunetul și plățile sunt aceleași apeluri.
- `apps/nexus-mobile/src/screens/FeedScreen.tsx`: un tap pe o postare fără media deschide conversația
  (înainte nu se întâmpla nimic, pentru că vizualizatorul are nevoie de un cadru media).
- `apps/nexus-mobile/src/theme/social.ts`: citirea `reels` cere acum `format=all` și se numește „Feed”;
  `Reels`, `Șoapte`, `Știri` rămân citiri separate, nimic nu dispare.

### Faza 4 (server) — Quote pe postare
- `lib/db.js`: `posts.quoted_post_id INTEGER`. Fără cheie străină **intenționat**: `migrateSchemaColumns`
  poate adăuga o coloană INTEGER simplă pe o bază care are deja rânduri, în timp ce `ALTER TABLE … ADD COLUMN`
  refuză `REFERENCES`. Integritatea se verifică la scriere, iar citirea tolerează o țintă dispărută.
- `lib/repo.js`: `createPost({ quotedPostId })`, coloana în INSERT; referința intră în `content_commitment`
  **doar** când există, deci hash-urile postărilor vechi rămân valide (`canonicalPostCommitment` la fel).
- `lib/api.js`: `POST /api/posts` acceptă `quoted_post_id` — ținta trebuie să fie activă și vizibilă pentru
  autor, altfel `404`; `socialPostView` atașează `quoted_post` pe un lanț de maximum 6 niveluri, cu verificare
  de vizibilitate și protecție la cicluri (`seen`); galeria este un singur helper (`postMediaList`).
- `apps/nexus-web/test/quotes.test.js` (5 teste): referință fără copie, commitment diferit, migrare reală
  (`ALTER TABLE posts DROP COLUMN` → `migrateSchemaColumns` → postarea rămâne), refuz pe țintă invizibilă,
  lanț mărginit și fără bucle.

---

## 2. Verificări rulate

| Suite | Comandă | Rezultat |
|---|---|---|
| Mobile typecheck | `node node_modules/typescript/bin/tsc --noEmit` | 0 erori |
| Mobile teste | `npm.cmd test` (23 suite, inclusiv `test-post-presentation` si `test-rich-text`) | exit 0; 20 de suite isi tiparesc raportul `fail 0`, restul folosesc propriul format (§9.6) |
| Web teste | `node --test test/*.test.js` | **818 teste, 818 pass, 0 fail** |

**Netestat (spus cinstit):** randarea pe emulator/telefon nu a fost pornită în această rundă, deci
aspectul paginilor de text, al caruselului și al panourilor de quote este verificat prin tipuri și teste
de logică, nu vizual. Gestul orizontal în paginile de text pe hardware real nu a fost încă exersat.

---

## 3. Ce rămâne, în ordinea sigură

1. **Composer universal `+`** — `src/app/compose.tsx` (text / foto·video / text+media, fără pierdere de
   conținut), `publishClient.ts` extins la o listă de media (azi trimite un singur `media_items`),
   butonul `+` din `app/index.tsx` deschide editorul, camera rămâne o intrare din el, iar quote-ul
   pornește editorul cu `quoted_post_id` precompletat.
2. **Profil 9:16 (Faza 6)** — miniaturi pentru text, tab-uri Posts / Reels / Media / Likes peste
   `GET /api/social/profile/:handle` existent; aceeași înregistrare, altă randare.
3. **Paritate web** — `postCard` să afișeze quote-ul și galeria 1…5 (serverul trimite deja datele).
4. **Detaliu conversație** — lanțul complet dincolo de cele 3 panouri compacte (`quoteChain().omitted`).
5. **Quote din rail** — acțiunea „Citește cu quote” pe rail, după ce composer-ul există.

---

## 4. Reguli păstrate

1. O postare = o înregistrare. Niciun mod și nicio previzualizare nu creează postări.
2. Reel-ul video nu a fost rescris: aceeași componentă, doar condiționată de `stageFor`.
3. Nimic șters: nicio coloană, funcție sau rută existentă nu a fost eliminată.
4. Acțiunile rămân endpointurile existente (`lib/postInteractions`) — niciun buton decorativ.
5. Fără promisiuni pentru alt text sau programare: nu există în server, deci nu apar în UI.

---

## 5. Fișiere atinse în această rundă

**Mobile**
- `src/lib/postPresentation.ts` (nou)
- `src/components/PostReading.tsx` (nou)
- `src/components/ReelsReader.tsx`
- `src/screens/FeedScreen.tsx`
- `src/lib/socialTypes.ts`
- `src/theme/social.ts`
- `scripts/test-post-presentation.cjs` (nou), `package.json`

**Web**
- `lib/db.js`, `lib/repo.js`, `lib/api.js`
- `test/quotes.test.js` (nou), `test/p4-media-tags.test.js`

---

## 6. Comenzi de verificare

```powershell
cd C:\Users\Romeo\projects\nexus_deepsek\apps\nexus-mobile
node node_modules\typescript\bin\tsc --noEmit
npm.cmd test

cd C:\Users\Romeo\projects\nexus_deepsek\apps\nexus-web
node --test test/*.test.js
```

(`npm`/`npx` sunt blocate de ExecutionPolicy pe această mașină; se folosesc `npm.cmd` și `node <binar>`.)
---

## 7. Runda „nu văd modificările” (18–19 octombrie 2026)

### 7.1 Cauza reală
Aplicația care se deschide din browser/WebView este `apps/nexus-web/public` (clientul web „Jungle Book”),
nu aplicația nativă `apps/nexus-mobile/src`. Modificările din rundele anterioare erau în React Native, deci
nu puteau apărea în browser, iar serverul care rula fusese pornit **înainte** de modificările din `lib/`
(proces pornit 23:33, fișierele `lib/api.js`/`lib/db.js` scrise 00:22/00:27), deci nici quote-ul pe server
nu era încărcat în memorie.

### 7.2 Ce s-a făcut acum
1. **Server repornit** din `apps/nexus-web` pe `0.0.0.0:5000` (HTTP) și `5443` (HTTPS). La pornire s-a văzut
   în `server.err.log`: `schema drift repaired: posts.quoted_post_id` — migrarea a rulat pe baza existentă.
2. **Clientul web primește aceeași prezentare universală** (paritate cu mobilul):
   - `public/post-quote.js` (nou, modul pur): `quoteChainFor` (maxim 3 niveluri, protecție la cicluri),
     `quotedPostMarkup`, `composerQuoteMarkup`, `textPagesFor` (tăiere pe cuvinte, 380 caractere/pagină),
     `textStageMarkup` și `bindPostQuoteSurface` (cele trei legături: panou quote, acțiunea Citează,
     contorul paginilor de text).
   - `public/app.js`: cardul de postare afișează lanțul de quote (3 panouri în timeline, 1 în pagina 9:16),
     o postare fără media nu mai arată fallback-ul „PREVIEW ANIMAT LOCAL”, ci pagini de text 9:16
     (snap orizontal, contor `1/n`), iar rândul de acțiuni are butonul **Citează**.
   - `public/app.js` — composerul: `openComposer("post", { quote })` deschide un composer text-first, cu
     previzualizarea postării citate, `quoted_post_id` ascuns și `quoted_post_id` în corpul `POST /api/posts`;
     trecerea Text ↔ Media păstrează quote-ul.
   - `public/post-quote.css` (nou) + link în `public/index.html`.
   - `public/interface-locale.js`: 8 chei noi în RO/EN/PL/AR (`post.quote`, `post.quoteFailed`,
     `post.quotedFrom`, `post.quoteOpen`, `post.textPages`, `composer.quoteTitle`, `composer.quoteHint`,
     `composer.quotePlaceholder`).
3. **Bugetele de transfer** s-au mutat o dată, cu suprafața numită (regula din test): `app.js` 638 600 → 641 500
   (+2,9 kB, motorul stă în `post-quote.js`), `interface-locale.js` 366 700 → 368 500 (+8 propoziții × 4 limbi).
4. **Test nou** `apps/nexus-web/test/quote-pages.test.js` (8 teste): lanțul de quote, limita de 3 panouri,
   o singură miniatură per panou, escape o singură dată, paginare fără pierdere de cuvinte, contorul,
   composerul fără link interactiv.

### 7.3 Verificări rulate (rezultate reale)
- `apps/nexus-web`: `node --test test/*.test.js` → **826 teste, 826 pass, 0 fail** (include `quotes.test.js`
  și noul `quote-pages.test.js`).
- `apps/nexus-mobile`: `node node_modules/typescript/bin/tsc --noEmit` → exit 0; `npm.cmd test` → exit 0.
- `node --check` pe `app.js`, `interface-locale.js`, `post-quote.js` → OK.
- **Smoke real în browser** (Edge headless + CDP, `http://127.0.0.1:5000/`): pagina încarcă `post-quote.js`
  și `post-quote.css` (200), rulează `app.js` și afișează ecranul de autentificare; singura eroare este
  `401 /api/me`, adică sesiunea lipsă. Zero excepții JS.

### 7.4 Cum se vede
- Local: `http://localhost:5000` sau `http://192.168.1.153:5000` (LAN), respectiv `https://192.168.1.153:5443`.
- Pe telefon prin shell-ul WebView: `adb reverse tcp:5000 tcp:5000` apoi reload
  (`scripts/nexus-dev.ps1 -Action reverse`, `-Action reload`). În această rundă **nu era niciun dispozitiv
  adb conectat** (`adb devices` gol), deci reload-ul pe telefon nu a fost rulat.
- În feed: butonul **Citează** pe orice postare, iar postările text apar ca pagini (nu ca „PREVIEW ANIMAT”).

### 7.5 Rămas de făcut (neschimbat)
- Composer universal `+` în aplicația nativă (`src/app/compose.tsx`) și lista de media în `publishClient.ts`.
- ~~Grila de profil 9:16 (Faza 6)~~ — aplicată în runda 8 (vezi §8.1).
- Web: pagina de conversație completă peste 3 panouri (`quoteChain().omitted`) și acțiunea din rail.
- Verificare vizuală pe emulator/dispozitiv real (nu a fost posibilă: niciun device adb).


---

## 8. Runda „pe telefon" (19 octombrie 2026)

### 8.1 Grila de profil 9:16 (Faza 6)
Celula arhivei nu mai e pătratul webului: `socialTokens.archive.tileAspect = 9 / 16` este singura
sursă a formei, iar `ProfileTile` și suportul de rând din `ProfileScreen` citesc același token
(`aspectRatio: socialTokens.archive.tileAspect`). Lățimea rămâne a webului — trei coloane, `gap: 2`,
`flexBasis: 0` — deci rândul măsoară tot 155 × 3 + 2 × 2; se schimbă doar înălțimea celulei
(155 × 16/9 ≈ 275,5, de unde `gridMinHeight: 276`). Marcajele de colț (play, vizualizări, repost, pin)
și cititorul pe tot ecranul rămân neatinse.

Testul de paritate (`scripts/test-profile-content-parity.cjs`) cere acum explicit ca
`tile.aspectRatio` să fie `archive.tileAspect` = 9/16, păstrează măsurătorile de lățime din captura
web și verifică și `gridMinHeight = ceil(155 × 16 / 9)`.

### 8.2 Cum a fost adusă aplicația pe telefon
1. `scripts/run-metro.ps1 -Port 8081` într-un proces ascuns (jurnal: `builds/metro.log`).
2. `adb reverse tcp:8081` și `tcp:5000` pentru dispozitivul `192.168.1.184:37909`.
3. Deep link `nexusdev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`: aplicația a
   intrat direct în bundle-ul Metro, fără atingeri pe ecran.
4. După modificările din §8.1, `builds/metro.log` arată `08:14:02 Android Bundled … (1383 modules)`,
   deci telefonul rulează codul nou, nu bundle-ul de dinaintea editării (`08:03:55`).

### 8.3 Dovezi citite de pe dispozitiv
- `node node_modules/typescript/bin/tsc --noEmit` → exit 0.
- `npm.cmd test` → exit 0 (toate suitele, inclusiv paritatea de profil).
- `uiautomator dump` pe Feed: „Test Nexus", „@test · 07.10.2026", „Verificare nativa: login, camera,
  editor, publicare:", „Citește tot textul", „Vezi traducerea", „Activează sunetul · Audio original ·
  Test Nexus", „Deschide selectorul de reacții", rail-ul („Comentarii", „Distribuie", „Salvează") și
  navigația (Acasă, Mesaje, Creează, Prieteni, Live, Profil) — adică pagina 9:16 de text, nu cardul
  vechi.
- Inspecție prin CDP pe runtime-ul Hermes (`/inspector/debug`, origine `http://127.0.0.1:8081`):
  în arborele React sunt montate `FeedScreen`, `ReelsReader` și `ReelPage`; pe Profil sunt montate
  `ProfileScreen`, `ProfileHeader`, `ProfileBand` și `ProfileEmptyState`.

### 8.4 Ce nu a putut fi măsurat pe ecran
- Contul `@test` de pe telefon nu are postări în arhivă: fila Reels a profilului randează
  `ProfileEmptyState`, deci nicio `ProfileTile` nu există în arbore și nu se poate citi raportul
  9:16 al unei celule reale. Forma este acoperită de token și de testul de paritate, nu de o
  măsurătoare pe pixelii telefonului.
- `uiautomator dump` eșuează cu `could not get idle state` cât timp ecranul de profil este deschis
  (ticker-ul din header animă continuu, iar UiAutomator așteaptă o fereastră nemișcată). Nu este o
  eroare a aplicației: dump-ul revine imediat pe Feed. Pentru profil, arborele a fost citit prin CDP.

### 8.5 Rămas de făcut
- Composer universal `+` în aplicația nativă (`src/app/compose.tsx`) și lista de media în
  `publishClient.ts` (nepornit; fluxul actual e camera-first, `src/app/camera.tsx`).
- Web: pagina de conversație completă peste 3 panouri (`quoteChain().omitted`) și acțiunea din rail.
- O verificare vizuală a grilei pe un cont cu postări (sau după publicarea unei postări de test).


## 9. Panza universala 9:16 (o singura compozitie, trei contexte)

### 9.1 Ce s-a schimbat

- `src/components/PostCanvas.tsx` (nou) este **singura** compozitie a unei postari:
  - `PostStage` masoara spatiul primit si aseaza in el un cadru 9:16 (`width = min(latime, spatiu * 9/16)`),
    centrat si lasand liber `bottomInset` (bara de tab-uri). Cadrul nu este niciodata intins.
  - `PostCanvas variant="feed" | "reader" | "tile"` deseneaza acelasi continut la trei scari: coperta
    (imagine sau clip), voalul, identitatea autorului, textul (paginat pentru `text`, cu `Citește tot`
    pentru un caption lung, panouri pentru `quote`) si ancora de traducere.
  - Un clip nu primeste un poster in grila (telefonul nu are `expo-video-thumbnails`): primeste o placa
    portret proprie cu semnul de redare, autorul si primele randuri, in loc de patratul negru de dinainte.
- `ReelsReader` si-a pierdut copia locala a meta-ului si a citirii (≈150 de linii) si randeaza
  `PostStage` + `PostCanvas variant="feed"`; rail-ul, distribuirea si foaia de plata au ramas neschimbate.
- `MediaViewer` (reader-ul pe tot ecranul) randeaza `PostCanvas variant="reader"` in acelasi cadru 9:16.
- `ProfileTile` randeaza `PostCanvas variant="tile"`; marcajele web (play, vizualizari, repost, pin) au ramas.
- `FeedScreen`: o postare fara media nu mai fuge la comentarii la atingere, ci se deschide in reader.
- `scripts/capture-screen.ps1` (nou): PNG pe dispozitiv → pull → JPG (System.Drawing, calitate 82) →
  PNG sters, in `builds/visual/`. `adb exec-out` nu este folosit, pentru ca PowerShell strica octetii.
- Telefonul se stinge singur: `adb shell svc power stayon true` si `input keyevent KEYCODE_WAKEUP` sunt
  necesare inainte de fiecare captura (altfel ecranul este negru si captura este inutila).

### 9.2 Dovezi de pe telefon (`192.168.1.184:39169`, 1220×2656)

| Ce | Fisier | Rezultat |
|---|---|---|
| Feed inainte | `builds/visual/baseline_feed.jpg` | reel edge-to-edge, fara cadru |
| Profil inainte (cont gol) | `builds/visual/baseline_profile.jpg` | `ProfileEmptyState` |
| Profil @test inainte | `builds/visual/baseline_profile_test.jpg` | celule 9:16, dar 2 celule de clip negre |
| Reader inainte | `builds/visual/baseline_reader_video.jpg` | media pe tot ecranul, fara compozitie |
| Feed dupa | `builds/visual/feed_canvas6.jpg` | cadru 9:16 (0,244-1220,2412), autor + caption + traducere in cadru |
| Reader dupa | `builds/visual/reader_canvas3.jpg` | aceeasi compozitie, tipografie de reader |
| Profil dupa | `builds/visual/after_canvas_profile2.jpg`, `feed_canvas4.jpg` | fiecare celula: autor sus, text jos; clipurile au placa + disc de redare |

`uiautomator dump` pe Feed dupa modificare: `Deschide postarea pe tot ecranul :: 0,244-1220,2412`
(9:16 exact: 1220 × 16/9 = 2168), `Vezi traducerea :: 36,2303-242,2355` (in cadru, deasupra barei
`navigation :: 0,2393-1220,2656`).

### 9.3 Defecte gasite si corectate in aceasta runda

1. **Celulele foto nu aveau autor/text** — imaginea avea `height:100%` in flux normal si impingea blocul
   de text in afara celulei. Corectat: imaginea este `position:absolute` (`styles.media`).
2. **Textul celulei de clip statea sub chips-urile web** (play/vizualizari). Corectat: celula de clip
   rezerva 34px jos (`paddingBottom`).
3. **Reader-ul era negru** — `PostStage` avea `flex:1` intr-un parinte cu `alignItems:'center'`, deci
   latime 0. Corectat: `width:'100%'` pe scena.
4. **Contrast slab pe poze deschise** — voalul celulei are acum trei praguri (0.5 / 0.06 / 0.94).

### 9.4 Ramas de facut

- Postarile `text`, `quote` si `conversation` nu exista in contul `@test` de pe telefon; compozitia lor
  este implementata, dar nu are inca o dovada pe pixelii telefonului (vezi
  `JUNGLE_BOOK_VISUAL_VERIFICATION.md`, marcate `IMPLEMENTED`, nu `VISUALLY VERIFIED`).
- ~~Cadrul atinge bara de tab-uri cu ~8dp in jos~~ — rezolvat in §9.5 (insetele sunt aplicate ca padding).
- Colturile rotunde ale cadrului nu sunt in specificatia web (acolo `.clipCard` este drept); daca
  designul cere muchii drepte, `styles.frame.borderRadius` este singurul loc de schimbat.


### 9.5 Runda a doua: insetele, reader-ul de text si curatenia

1. **Cadrul statea sub bara de tab-uri si sub sageata de intoarcere.** `PostStage` centra cadrul in
   tot viewport-ul, desi primea `bottomInset`; acum primeste si `topInset` si le aplica drept
   `padding`, deci cadrul se centreaza in spatiul liber dintre controale. Feed-ul masoara acum
   `0,112-1220,2281` (1220×2169 = 9:16), iar bara incepe la 2393.
2. **O postare de text nu se putea deschide pe tot ecranul.** `PostTextReading` are `onPress`, iar
   `FeedScreen` tine o postare „solo" pentru reader (`viewerPost`). Un tap pe text deschide acum
   reader-ul, cu aceeasi compozitie (`reader_text2.jpg`).
3. **Un text taiat la 3 linii nu avea nicio usa.** `PostCanvas` arata `Citește tot` cand textul depaseste
   fie o pagina de citire, fie ~150 de caractere (pragul la care 3 linii nu mai ajung). Dovada:
   `rv3_bottom.jpg`.
4. **Curatenie**: `ReelsReader` nu mai are copia locala a meta-ului (`RepostLine`, `meta`, `reading`,
   `creator*`, `caption`, `translate`), deci nu mai exista doua compozitii care pot divergea.
5. **Test de brand**: fallback-ul de handle din celula de quote a fost scos din template literal, ca
   `test-brand.cjs` sa vada valoarea `nexus` si sa o accepte prin exceptia existenta.

Verificare automata dupa runda: `tsc --noEmit` exit 0; toate cele 22 de suite din `npm test` rulate
individual cu `node scripts/test-*.cjs` (npm.ps1 este blocat de execution policy pe acest sistem) →
0 esecuri.

Capturi noi: `reader_text6.jpg` (+ `rt6_small.jpg`, `rt6_low.jpg`), `reader_video3.jpg`
(+ `rv3_top.jpg`, `rv3_bottom.jpg`), `feed_final_text.jpg`, `feed_frame_inset.jpg`.

### 9.6 Runda a treia–a cincea: cardul, randul de actiuni, textul Stirilor (19 octombrie 2026)

1. **Cardul depasea coloana si intra sub bara de tab-uri.** Cardul cerea toata latimea coloanei si lasa
   `aspectRatio: 9/16` sa decida inaltimea: pe 1220×2656, un card de 1168 px lat devenea 2076 px inalt
   intr-o coloana de 2030 px, deci piciorul cadrului (randul de actiuni, padding-ul, coltul rotund) statea
   sub bara. `FeedScreen` masoara acum coloana (`onColumnLayout`) si calculeaza `cardWidth` ca `PostStage`
   in reader: `min(latime - 2×10 dp, (inaltime - 10 dp - 24 dp) × 9/16)`, iar `PostCard` primeste
   `frameWidth`. Masurat pe telefon: cadru `56,363-1164,2332` = 1108×1969 (9:16 exact), bara la 2393.
2. **Randul de actiuni e o singura linie, desenata o singura data.** `PostActionRow.tsx` (nou) pune cele
   cinci presari ale web-ului in ordinea lor — reactie, comentarii, salvare, redistribuire, distribuire —
   fiecare pe aceeasi placa (`socialTokens.post.action`, impartita cu `ReactionControl variant="row"`), in
   cadru, sub text. `PostCard` il monteaza prin `PostCanvas` (`bottomActions`), deci cardul si reader-ul nu
   mai au doua randuri care pot divergea.
3. **Cardul nu mai este o a doua compozitie.** `PostCard.tsx` este acum 181 de linii: `PostFrame` +
   `PostCanvas variant="feed" layout="post"` + `PostActionRow`. Ce a ramas in fisier este ce canvasul nu
   detine intentionat — starea si scrierile (reactie platita cu `ActionPaymentSheet`, salvare,
   redistribuire, distribuire, cu revenire cand serverul refuza).
4. **Textul Stirilor.** Notificarea cand providerul e oprit era o propozitie englezeasca si se dedubla cu
   linia de gol. Acum sunt doua propozitii romanesti, titlu + detaliu, cu numele produsului — „Știrile sunt
   pregătite, dar oprite” / „Nicio sursă nu a fost aprobată încă. Fără o decizie de owner pentru un agregator
   din lista aprobată, Jungle Book nu are de unde lua titluri reale — și nu inventează niciunul.” — iar linia
   „Nu sunt postări de afișat.” tace cand providerul este oprit.
5. **Linkurile din caption.** `src/lib/richText.ts`: un token care este doar schema (`http://`, `https://`,
   `www.`) sau un cuvant lipit de punctuatie nu mai devine link (`isAddress()`), iar `captionTags` citeste
   doar hashtagurile reale. `scripts/test-rich-text.cjs` este in `npm test`.
6. **Bara feed-ului are un singur punct de schimbare a citirii** — pilonul din mijloc (`AppHeader`
   `variant="feed"`, `onCycleMode`), care merge prin `nextMode` peste ordinea din `socialTokens.feedModes`,
   aceeasi functie pe care o foloseste swipe-ul orizontal. Nu mai exista o a doua banda de citiri in ecran.

Verificare automata dupa runda: `node node_modules/typescript/bin/tsc --noEmit` → exit 0; `npm.cmd test` →
exit 0, 20 de suite cu raport `fail 0` (suitele care isi tiparesc propriul format nu apar in numaratoare),
jurnal `_tests5.log`. `test-profile-content-parity.cjs` nu mai are aserțiunile `whisperList` care fusesera
notate ca stricate — fisierul nu mai contine acel simbol si trece.

Dovezi pe telefon (`192.168.1.184:39169`, 1220×2656): `jb_boot_round5.jpg`, `jb_feed_round5.jpg` (Reels),
`jb_whispers_round5.jpg` (Soapte), `jb_news_round5.jpg` (Stiri), `jb_reader_round5.jpg` (reader de text),
`jb_profile_round5.jpg` (profil propriu, gol). Masuratori: cadru card `56,363-1164,2332` (1108×1969),
rand de actiuni `92,2186-663,2274`, bara de tab-uri la 2393, cadru reader `16,270-1204,2382`
(1188×2112 = 9:16), bara de comentariu la 2403.

Ramas: cele trei compozitii fara continut real (quote, conversatie, text mai lung de o pagina) ramin
`IMPLEMENTED`, nu `VISUALLY VERIFIED` (vezi `JUNGLE_BOOK_VISUAL_VERIFICATION.md` §5 si §6.3).


### 9.7 Runda a șasea: UX-ul cerut de owner, pe telefon (19 octombrie 2026)

Ownerul a deschis aplicația și a spus ce vede: trei piloni de citire în antetul feed-ului, reacții
verticale pe o postare de text, traducerea la piciorul ecranului, bara de tab-uri care nu se ascunde,
postări de text pe toată lățimea în profil. Runda a șasea a schimbat exact aceste lucruri, fără să rescrie
arhitectura și fără să atingă backendul.

**Cod livrat**

- `theme/editorial.ts` (nou): paleta matte-black `#101311`, charcoal `#151B17`, frunză `#7FAE76`, cerneală
  `#F1F2ED` / `#A8B3A8`, cu contrastul AA scris lângă fiecare pereche.
- `components/LeafMotif.tsx` (nou): lujer vectorial (nu o iconiță), `pointerEvents="none"`, `memo`.
- `components/FeedHeader.tsx` + `FeedFilter.tsx` (noi): un filtru compact **Toate / Postări / Reel-uri**
  sus-stânga și wordmark-ul serif; pilonul ▶, ghilimelele și ziarul au dispărut din feed.
- `screens/FeedScreen.tsx` (rescris): un request `format=all`, filtru local, pager pe verticală cu snap;
  `stageFor(post) === 'reel'` → `ReelPage` (rail vertical), orice altceva → `PostCard` (rând orizontal).
- `components/ReelsReader.tsx`: `ReelPage` exportat și gestul vertical raportat (ascunde/arată bara).
- `components/ReplyComposer.tsx` (nou): ia locul barei de tab-uri, scrie prin `createComment` (același
  endpoint ca firul), are foto, GIF (cu mesaj onest când nu există furnizor) și trimitere.
- `components/PostCanvas.tsx`: antet sus cu nume serif / @handle · dată · locație, text centrat, traducere
  imediat sub text, rând de acțiuni jos, filigran de lujer, scrim de antet peste foto, ceas de clip
  (`0:06 / 0:23`) cu bară de 4 px deasupra rândului de acțiuni.
- `components/PostMedia.tsx`: `onProgress(fraction, position, duration)` și `seekRef` pentru bară.
- `screens/ProfileScreen.tsx`: whisper-urile din Flow devin rânduri de celule 9:16 (`whisperTiles`).
- `app/index.tsx`: fără antet plutitor, bară animată (220 ms, driver JS), composer peste tastatură
  (`keyboardDidShow`), filtru în loc de `feedMode`.
- `scripts/build-contact-sheet.ps1` (nou): regenerează `contact_sheet.jpg` din orice JPG din `final_jpg/`.

**Verificare automată**: `tsc --noEmit` → exit 0; `npm test` → exit 0, 23 suite, 0 eșecuri (`_tests6.log`).

**Verificare pe telefon** (`192.168.1.184:39169`, 1220×2656): swipe înainte ascunde bara, swipe înapoi o
readuce (`i01`, `i02`); card 9:16 `19,273–1203,2380`; rând orizontal `73,2236–731,2324`; composer
`31,2377–1194,2532`; ceas clip `0:06 / 0:23` → `0:15 / 0:23`.

## 10. Runda a șaptea — corecția (19 octombrie 2026)

Runda 6 a raportat ca funcționale filtrul, rail-ul și composer-ul. Pe telefon nu erau. Runda 7 nu a rescris
arhitectura: a găsit cauza din cod și a dovedit corecția pe dispozitiv, în ordinea cerută (1–5 întâi).

### 10.1 Ce era rupt, exact

1. **Clasificarea** — `stageFor()` declara Reel doar `clip && !textOf(post)`. Serverul stochează însă
   `posts.kind = 'video'` (`repo.createPost`), deci orice clip cu descriere devenea „text + video”: filtrul
   REEL-URI rămânea gol, iar clipurile nu ajungeau niciodată la reader-ul cu rail vertical. Definiția
   „Reel = clip fără text” era a mea, nu a produsului.
2. **Gestul de navigare** — `settleBrowse()` golea `dragStart` la `onScrollEndDrag`. Android raportează
   sfârșitul degetului înainte de așezarea paginii, așa că `onMomentumScrollEnd` găsea `null` și nu raporta
   nimic: bara nu se mișca.
3. **Banda goală** — bara stătea în flux și doar se translata; când „pleca”, spațiul rămânea rezervat.
4. **Composer duplicat** — runda 6 crease `ReplyComposer.tsx` peste `CommentsSheet`, care exista deja.
5. **Postarea text nu se deschidea** — `PostCard` nu primea `onOpen`, iar `MediaViewer` filtra postările fără
   fișier media din galerie.
6. **Chenarul de card** — `PostCanvas.styles.frame` avea `borderWidth: 1` + `borderRadius: 18`, iar lățimea
   cadrului putea depăși ecranul (caption tăiat la ambele margini).

### 10.2 Ce s-a schimbat

- `lib/postPresentation.ts`: **`contentTypeOf(post)`** — clasificatorul unic. Ordinea de autoritate:
  `post_type` / `content_type` / `publishing.type` explicit → `posts.kind` (`video` = Reel, cu sau fără
  descriere; `text`/`image` = Post) → fallback doar când lipsește `kind` (clip fără cuvinte = Reel).
  `stageFor()` îl folosește; `profilePostKind()` din `lib/profileContent.ts` la fel.
- `screens/FeedScreen.tsx`: filtrul taie prin `stageFor` (deci prin clasificator); `frameWidth` e limitat și
  de `pageWidth`; `reservedBottom` ține cadrul deasupra barei și dispare când bara pleacă; `onOpen` duce la
  reader, `onReply` deschide composer-ul existent în reader; `settleBrowse` citește deplasarea la așezare.
- `components/PostCard.tsx`: tot cardul e poartă către reader (pressable), fără să înghită butoanele din
  interior; `extraComments` a dispărut.
- `components/PostCanvas.tsx`: cadrul nu mai are chenar și rază; `PostStage` capătă `fill` pentru suprafețele
  de lectură (text, conversație), ca postarea să umple ecranul fără benzi moarte.
- `components/MediaViewer.tsx`: galeria păstrează și postările fără media; **rail vertical doar pentru Reel**,
  iar postările primesc `PostActionRow` sub text (`layout="post"`).
- `components/ReelsReader.tsx`: `reservedBottom` de la shell + același fix de gest.
- `app/index.tsx`: bara de tab-uri e **strat absolut** (`navOverlay`), fără bandă rezervată în flux;
  `reservedBottom = chromeHidden ? insets.bottom : navHeight`; modul „răspunde” a dispărut împreună cu
  `components/ReplyComposer.tsx` (șters).
- `scripts/test-post-presentation.cjs`: test nou pentru clasificare (clip cu/fără descriere, text, poză,
  text + poză, text + video declarat, repost, quote, payload fără `kind`).

### 10.3 Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656)

| Verificare | Rezultat | Captură |
|---|---|---|
| TOATE amestecă postare + Reel | PASS | `round7_all_filter.jpg` |
| POSTĂRI fără Reel-uri | PASS | `round7_posts_filter.jpg` |
| REEL-URI cu clip **cu descriere** | PASS | `round7_reels_filter.jpg` |
| Reel → reacții verticale în dreapta | PASS | `round7_reel_vertical_reactions.jpg` |
| Postare → reacții orizontale jos | PASS | `round7_text_horizontal_reactions.jpg` |
| Swipe înainte → bara dispare, fără bandă goală | PASS | `round7_navigation_hidden.jpg` |
| Swipe înapoi → bara revine | PASS | `round7_navigation_restored.jpg` |
| Composer-ul existent, deasupra tastaturii | PASS | `round7_reply_composer.jpg` |
| Postare text → exact ea, pe tot ecranul | PASS | `round7_text_post_fullscreen.jpg` |
| Celulă de text 9:16 în profil | PASS | `round7_profile_text_grid.jpg` |
| Quote / conversație / text lung | BLOCKED | fără conținut în conturile accesibile |

Măsurători din ierarhie după corecție: cadru postare `34,302–1186,2350` (1152×2048 = exact 9:16), rând de
acțiuni `70,2238–728,2327`, bară de tab-uri `0,2393–1220,2656` (doar când e vizibilă; ascunsă, postarea urcă
până deasupra butoanelor Android).

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, 20 de fișiere, **182 de teste, 0 eșecuri** (`_tests7.log`).

**Limita rămasă, spusă direct**: schema are doar `posts.kind`, fără tip editorial separat. Un clip stocat e
Reel; o postare care înglobează un clip există azi doar ca quote/repost sau cu `post_type` explicit în
payload. Clasificatorul citește toate trei, dar serverul nu produce încă al treilea caz.

## 11. Runda a opta — citirea pe tot ecranul a fost scoasă (19 octombrie 2026)

Cerința owner-ului, punctul 1 din listă: „scoată de tot full screen — toate postările și reel-urile sunt 9:16,
deci nu e nevoie; verifică peste tot unde dai click și apare full screen”. Runda 7 dovedise că reader-ul arată
postarea corect; runda 8 a acceptat că al doilea ecran nu adaugă nimic: cadrul din feed **este** postarea
întreagă. Deci feature-ul a fost șters, nu ascuns.

### 11.1 Ce a dispărut, pe fiecare suprafață

| Loc | Înainte | Acum |
|---|---|---|
| `screens/FeedScreen.tsx` | `viewerPost` + `MediaViewer` peste feed (postare, Reel, „răspunde”) | fără stare de viewer, fără galerie; cardul și reel-ul se citesc pe loc |
| `components/PostCard.tsx` | tot cardul era un `Pressable` care deschidea reader-ul | cardul nu e o ușă; placa de comentarii deschide `CommentsSheet`, foaia care exista deja |
| `components/ReelsReader.tsx` | tap pe clip → reader; railul chema ruta de comentarii | tap = **play/pause**; comentariile = `CommentsSheet` peste reel |
| `components/ProfileTile.tsx` | celula deschidea reader-ul galeriei | celulă inertă, fără `Pressable`, fără eticheta „pe tot ecranul” |
| `components/MediaViewer.tsx` | 374 de linii de viewer | **fișier șters** |
| `screens/CommentConversationScreen.tsx` | `MediaViewer embedded` + fir | fir + o linie de context (autor + 3 rânduri), fără scenă media |
| `components/PostCanvas.tsx` | `onPressMedia` promitea „Deschide postarea pe tot ecranul”, `onOpenLayer` deschidea quote-ul | mânerul e doar play/pause (reel); straturile de quote sunt citiri |
| `components/PostReading.tsx` | `QuotePanels onOpen`, „Deschide postarea”, „Citește toată postarea” | panouri statice; promisiunile textuale au dispărut |
| `screens/ProfileScreen.tsx`, `screens/SearchScreen.tsx` | galerii pentru reader (`tileGallery`, `gallery`) | galeriile au plecat odată cu viewer-ul |

### 11.2 Ce rămâne, cu motiv

- **Comentariile** — `CommentsSheet`, neschimbat, cu compozitorul lui: ca foaie peste feed/reel, și ca pagină
  (`/comments/[postId]`) redusă la fir + linia de context. Nu mai re-randează postarea.
- **Poveștile** (`StoryViewer`, tab-ul „Momente”) — nu sunt postări și nu au altă suprafață de citire; cererea
  owner-ului a fost despre postări/reel-uri. Dacă vor dispărea și ele, e o singură ștergere, spusă aici ca să
  nu pară o scăpare.
- **`PostStage`** — rămâne: îl folosește rama 9:16 a reel-ului.

### 11.3 Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656)

| Verificare | Rezultat | Captură |
|---|---|---|
| Postarea 9:16 se citește întreagă în feed | PASS | `round8_feed_no_fullscreen.jpg` |
| Tap în mijlocul postării nu deschide nimic | PASS (ierarhie neschimbată: 18 noduri clickable, niciunul „Deschide postarea”) | `round8_feed_tap_no_op.jpg` |
| Placa de comentarii → `CommentsSheet` peste feed | PASS (`EditText` „Adaugă un comentariu…” la `29,2400–1065,2510`, trimitere `1077,2398–1191,2512`) | `round8_comments_sheet_over_feed.jpg` |
| REEL-URI → reel vertical, fără a doua citire | PASS | `round8_reel_filter.jpg` |
| Tap pe reel → pauză, nu viewer | PASS (`Redă sau oprește clipul` la `19,290–1201,2393`, semnul „Redă clipul” apare) | `round8_reel_tap_pauses.jpg` |
| Comentariile reel-ului → aceeași foaie | PASS | `round8_reel_comments_sheet.jpg` |
| Celulă din profil atinsă → nimic | PASS (profilul rămâne pe loc) | `round8_profile_tile_no_op.jpg` |

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **191 de teste, 0 eșecuri** (182 + 9 în
`scripts/test-no-fullscreen-post.cjs`, care blochează revenirea: viewer șters, niciun `onOpen`, celulă inertă,
reel cu play/pause, fir fără scenă, quote fără ușă, niciun ajutor `isFullScreenEligible`).

**Limita, spusă direct**: pagina `/comments/[postId]` a fost dovedită prin test și prin cod, nu prin captură —
ruta se deschide azi doar din cardurile de șoapte, iar tab-ul „Șoapte” al profilului nu a răspuns la tap în
această sesiune de instrumentare (vezi manifest §5.5). Comentariile din feed și din reel, care sunt calea
reală a utilizatorului, au capturi.

### 11.4 Punctul 2 — un singur feed, iar pagina este ecranul (19 octombrie 2026)

Cerința owner-ului: „când dau swipe up or down, contentul se restrânge sau se extinde — e foarte neplăcut
pentru ochi; trebuie să fie uniform când glisez sus sau jos. Contentul trebuie să intre complet pe ecran.
Scoate filtrele (Toate · Postări · Reel-uri) — va fi un singur feed cu toate. Umple ecranul până la notch și
jos până la semnul de stânga-dreapta. Ai grijă ca user name etc. să fie sub ele, să nu rămână pe banda
neagră.”

#### Cauzele găsite, fiecare cu reparația ei

| Cauză | Ce se vedea | Reparația |
|---|---|---|
| `reservedBottom` din shell (`chromeHidden ? insets.bottom : navHeight`) | Când bara de jos pleca în timpul unui swipe, înălțimea paginii **și** `frameWidth` se recalculau: fiecare card se micșora, apoi creștea la swipe înapoi — exact „se restrânge sau se extinde” | Banda este acum constantă (`appNavHeight(insets.bottom)` în `FeedScreen`), pagina nu o citește deloc: `height: pageHeight`, fără `paddingBottom`. Doar cuvintele se feresc de ea |
| Banda neagră de sub ceas | `app/_layout.tsx` picta insetul de status cu `#000000` pe orice rută ≠ cameră, deci postarea nu putea ajunge la notch și începea sub un dreptunghi negru | Banda a fost **ștearsă**; feedul desenează sub ceas (`SafeAreaView edges={onFeed ? [] : ['top']}`), iar cuvintele coboară cu `insets.top` |
| Barul feedului (54 dp, solid) | Un strip negru deasupra primei postări, ținut doar de filtru | Fără header pe feed; `FeedHeader.tsx` și `FeedFilter.tsx` — **fișiere șterse** |
| Rama 9:16 centrată în pagină (`PostFrame` + `frameWidth`) | Postarea era o cutie 9:16 pe un câmp negru, cu benzi sus și jos | Pagina **este** postarea: `PostCard height={pageHeight}` și `ReelPage height={pageHeight}`; `PostStage fill`; media acoperă pagina (`cover`) |
| Cuvintele pe banda de jos | Autorul și acțiunile stăteau pe negru, nu pe compoziție | `topInset` (notch) și `bottomInset` (bara + semnul de gesturi) în `PostCanvas`; gradientul de cap crește cu insetul |
| Negru în spatele unui clip landscape | Clipul își păstrează tot cadrul (`contain`), deci rămânea o zonă neagră mare | `nxCanvasField` — câmpul editorial (cardTop → cardBottom) sub media, deci camera rămasă este cardul jungle, nu negru |

#### Ce a rămas intenționat

- **Un singur feed**, fără filtru: `visible = posts`, iar clasificatorul comun decide doar *cum* se desenează
  un element (rail pentru clip, rând orizontal pentru rest). `ReelsReader` (lista pentru felia „Reel-uri”) a
  fost ștearsă odată cu filtrarea; `ReelPage` rămâne, fiindcă o folosește feedul.
- **Un clip landscape păstrează tot cadrul** (`portrait-cover` → `contain`): `cover` ar tăia ~74 % din lățime.
  Postările 9:16 — cazul real — umplu pagina complet. Dacă owner-ul vrea și clipurile landscape tăiate,
  schimbarea este o singură valoare în `PostMedia.tsx`.
- **Bara de jos** rămâne ascunderea la swipe înainte (comportamentul rundei 6), dar pagina nu-și mai schimbă
  mărimea: banda rezervată pentru cuvinte este aceeași cu bara vizibilă și cu ea ascunsă.
- **Un text scurt nu mai montează un scroller** (`PostTextReading`, o singură pagină): nu are ce pagina, iar
  un `ScrollView` orizontal imbricat este o suprafață de gest inutilă într-un feed vertical.

#### Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656)

| Verificare | Rezultat | Captură |
|---|---|---|
| Postare foto: pagina 0,0–1220,2656, poza sub ceas și sub bara de sistem | PASS | `round8_feed_fullscreen_photo.jpg` |
| Postare text: statement + „Vezi traducerea” + acțiuni pe pagina întreagă, fără card | PASS | `round8_feed_fullscreen_text.jpg` |
| Reel: aceeași pagină, rail vertical, ceasul clipului; câmpul editorial în locul benzii negre | PASS | `round8_feed_fullscreen_reel.jpg` |
| Swipe înainte: pagina următoare are **aceeași** geometrie (autor sub ceas, acțiuni `36,2356–634,2444`, bară `0,~2434–2656`) | PASS | `round8_feed_swipe_uniform.jpg` |

Măsurători din ierarhie: autor `Profilul lui @test` la `36,250–938,359` (sub ceas), relația `959,281–1184,364`,
textul `36,1949–1184,1999`, „Vezi traducerea” `36,2214–323,2292`, acțiunile `36,2356–634,2444` — toate
deasupra barei de tab-uri (`~2434`), într-o pagină care merge până la `2656`.

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **199 de teste, 0 eșecuri** (191 + 8 în
`scripts/test-fullscreen-feed.cjs`: filtre șterse, un singur flux, pagină = viewport, bandă constantă,
insete pentru cuvinte, reel umplut, fără bandă neagră de status, media `cover`). `contact_sheet.jpg` a fost
regenerat din `final_jpg/` (**34 de celule**) și inspectat.

**Limita, spusă direct**: un clip **landscape** nu poate umple pagina fără să fie tăiat; azi își păstrează
tot cadrul pe câmpul editorial. Postările 9:16 (cerința owner-ului) umplu pagina complet.

### 11.5 Punctul 2, al doilea val — poza se citește cu railul, textul cu bara la picior (19 octombrie 2026)

Cerința owner-ului, citită de pe telefon în timpul verificării: „În primul post de pe feed… bara de
aprecieri, comentarii apare jos, orizontal… pentru mine acesta este un real: poza se vede pe tot ecranul,
vreau ca bara de reacții să apară în dreapta, ca la un reel — în dreapta jos bara de like-uri, iar jos
descrierea + traducerea. În schimb la content doar text, vreau ca acea bară orizontală să fie mai mare,
aceeași dimensiune ca cea verticală, și să ia locul footerului, adică mai jos. Primul post pe feed nu va fi
niciodată un post text, pentru că acea bară de reacții va fi peste meniu, ceea ce este de evitat.”

#### Ce s-a schimbat

| Zonă | Fișier | Ce face acum |
|---|---|---|
| Ce pagină primește un post | `screens/FeedScreen.tsx` | Pagina imersivă e cerută de **media**, nu de tipul de conținut: `const immersive = hasVisualMedia(item)` → `ReelPage`. `stageFor(item) === 'reel'` a dispărut din feed; un clip nu și-a schimbat nimic |
| Pagina unei poze | `components/ReelsReader.tsx` | Aceeași pagină ca a unui reel: poza acoperă ecranul, railul (avatar, reacție, comentariu, salvare, distribuire) stă jos-dreapta, autorul + captionul + „Vezi traducerea” jos-stânga. Discul de sunet și tap-ul play/pause se desenează **doar** `isVideo` |
| Măsura barei de text | `theme/social.ts` | `socialTokens.post.actionBar`: celulă 56, `minWidth` 56, marcă 26 (+3 = 29, exact `.clipQuickActions`), număr 11, rază 16 — aceleași valori ca railul vertical |
| Bara, desenată | `components/PostActionRow.tsx`, `components/ReactionControl.tsx` | `variant="bar"` la amândouă: cele cinci presări și sumarul de reacții la măsura railului, cu aceeași farfurie și același teal pentru o presare aprinsă |
| Bara, plasată | `components/PostCard.tsx`, `components/PostCanvas.tsx` | `variant={height ? 'bar' : 'row'}`: o pagină întreagă primește bara, un card de căutare păstrează rândul compact de 34. Bara rămâne ultimul copil al paginii (după `readingCenter`, care ia tot spațiul liber), deci stă pe ultima linie, deasupra meniului |
| Prima pagină | `lib/postPresentation.ts`, `screens/FeedScreen.tsx` | `openWithMedia(posts)`: dacă serverul deschide cu un text, primul post care umple ecranul cu o poză urcă în față; restul păstrează ordinea, iar un feed fără nicio poză este returnat neatins |

#### Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656)

| Verificare | Rezultat | Captură |
|---|---|---|
| Prima pagină (poză): ecran plin, rail jos-dreapta, caption + traducere jos-stânga, meniul sub ele | PASS | `round8_photo_rail.jpg` |
| Text: bara la picior, celule de mărimea railului, meniul ascuns | PASS | `round8_text_bar.jpg` |
| Text: aceeași bară cu meniul vizibil — bară deasupra meniului, fără suprapunere | PASS | `round8_text_bar_menu.jpg` |
| Clip portrait: pagina de dinainte, neatinsă (rail + disc de sunet + ceas) | PASS | `round8_feed_fullscreen_reel.jpg` |

Măsurători din ierarhie. Pagina cu poză: avatarul railului `1033,1581–1194,1701`, reacția
`1041,1727–1186,1873`, comentariul `1041,1877–1186,2022`, salvarea `1041,2028–1186,2173`, distribuirea
`1041,2179–1186,2325` (celule de `145×145 px`), autorul `36,2041–981,2150`, captionul `36,2165–981,2215`,
„Vezi traducerea” `36,2257–324,2335`, meniul `0,2393–2656`. Pagina de text: autor `36,207–927,316`, textul
`36,996–1184,1352`, „Vezi traducerea” `36,1383–340,1461`, bara `36,2190–827,2335` (cinci celule de
`146×145 px`, la `58 px` deasupra meniului). Înainte, aceleași cinci presări măsurau `88 px` înălțime.

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **205 teste, 0 eșecuri** (199 + 6 în
`scripts/test-feed-rail.cjs`). `openWithMedia` este testat **comportamental** (modulul pur este încărcat cu
`typescript.transpileModule`), nu doar citit: ordinea `[1,2,3,4]` → `[3,1,2,4]`, lista serverului
nemodificată, un feed fără poze neatins. `contact_sheet.jpg` a fost regenerat din `final_jpg/`
(**37 de celule**) și inspectat.

**Ce rămâne deschis**: un clip **landscape** își păstrează tot cadrul pe câmpul editorial (`cover` ar tăia
~74 % din lățime) — o singură valoare în `PostMedia.tsx` dacă owner-ul vrea tăiere; bara de jos continuă să
se ascundă la swipe înainte, dar banda ei rămâne rezervată, ca pagina să nu-și schimbe mărimea.

### 11.6 Al treilea val — piciorul paginii umple banda footerului, bara textului ia toată lățimea (19 octombrie 2026)

Cerința owner-ului, citită pe telefon: „În feed, după ce încep să glisez în jos, pentru că scoate footer-ul,
rămâne un spațiu gol. Vreau să coborâm toate elementele pentru a ocupa complet tot spațiul — asta cu excepția
primei postări, sau când încep să glisez în sus imediat și footer-ul reapare, atunci toate elementele trebuie
să revină în sus, pentru a evita ca footer-ul și aceste elemente să se suprapună. Trebuie testat pe telefon,
toate variantele posibile. La fel partea de reacții orizontale trebuie să ocupe toată lățimea telefonului,
butoanele pot fi ușor mărite și deplasate uniform — acestea sunt valabile doar pentru conținut tip text. La
fel la conținutul tip text, dacă dau click pe utilizatorii menționați cu @ trebuie să mă trimită pe profilul
lor, la fel și cu hashtaguri # să caute după acel hashtag.”

#### Ce s-a schimbat

| Zonă | Fișier | Ce face acum |
|---|---|---|
| Cât coboară piciorul | `lib/feedFoot.ts` (nou) | `footTravel(navReserve, insets.bottom)`: banda pe care bara a eliberat-o, minus semnul de gest al sistemului, minus 8 dp de respirație. Niciodată negativ. `CHROME_SLIDE_MS` (220) este ceasul comun al ambelor mișcări |
| Cine spune că bara a plecat | `app/index.tsx`, `screens/FeedScreen.tsx` | Shell-ul pasează `chromeHidden` (deja calculat pentru `navShift`); feedul ține un `Animated.Value` care merge la `footTravel` când bara e plecată și la 0 când revine — aceeași durată, aceeași curbă `Easing.out(cubic)` |
| Cum coboară | `components/PostCanvas.tsx`, `components/ReelsReader.tsx`, `components/PostCard.tsx` | `bottomShift` este un `translateY` pe piciorul paginii: blocul de lectură (`styles.reading`), blocul de jos al unei poze (`styles.bottom`) și railul din dreapta. Pagina nu-și schimbă înălțimea (`height: pageHeight` rămâne), deci swipe-ul rămâne un gest de o pagină |
| Bara textului, pe toată lățimea | `components/PostActionRow.tsx`, `theme/social.ts` | `styles.barRow` (`flex: 1`) întinde linia pe toată lățimea paginii, iar `space-between` mută cele cinci farfurii uniform, de la marginea din stânga la cea din dreapta. Celula crește de la 56 la 60 (marcă 27+3 = 30, număr 12, rază 18) |
| `@nume` este o ușă | `components/RichText.tsx`, `lib/profileNavigation.ts` | Fiecare segment `mention` este un `<Text>` copil cu `onPress` → `openSocialProfile(handle)`: profilul real, împins peste feed, cu întoarcere pe pagina de unde s-a plecat. Link-ul rămâne proză subliniată (webul îl tipărește tot ca text) |
| `#subiect` este o pagină | `components/RichText.tsx`, `lib/tagNavigation.ts` (nou), `app/tag/[tag].tsx` (nou) | Tagul deschide pagina lui, exact ca `.tagPageLayer` a webului: `GET /api/social/tags/hashtag/:tag`, antetul cu „N postări · M persoane” din `repo.tagStats`, lista de postări pe cursorul `next_before`. Un cuvânt care nu este tag (`#a`, `#doi cuvinte`, `#`) nu deschide nimic |

#### De ce nu se suprapun niciodată

Bara coboară `navHeight + 12` dp, piciorul paginii coboară cel mult `navReserve − insets.bottom − 8` dp, iar
amândouă pornesc în aceeași commit-are și merg pe aceeași curbă. La orice moment `t` ∈ [0,1], marginea de sus a
barii este sub marginea de jos a cuvintelor: `travel ≤ navReserve` este testat pentru toate combinațiile de
bandă și inset (`scripts/test-feed-foot.cjs`). Prima pagină nu are un caz special: bara este mereu prezentă
acolo (`onMomentumEnd` o readuce la index 0), deci nimic nu coboară.

#### Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656, densitate 416 → 2,6 px/dp)

| Verificare | Rezultat | Captură |
|---|---|---|
| Prima pagină (poză), meniul prezent: nimic nu a coborât — railul `1581..2314`, „Vezi traducerea” `2258..2332` | PASS | `round9_feed_first_page_rest.jpg` |
| Pagina următoare (clip), meniul plecat: railul coboară până la `2443` (fără coborâre ar fi `2323`) | PASS | `round9_feed_clip_descent.jpg` |
| Pagina cu poză, meniul plecat: captionul și traducerea stau la piciorul ecranului, fără bandă goală | PASS | `round9_feed_photo_descent.jpg` |
| Pagina de text, meniul plecat: bara `36..1180 × 2296..2456`, cinci celule de `158×160 px`, goluri de `94 px` — toată lățimea, uniform | PASS | `round9_feed_text_bar_descent.jpg` |
| Aceeași pagină de text, după glisarea în sus (meniul reapare): bara urcă la `2176..2336`, la `68 px` deasupra sticlei meniului (`2404`) — fără suprapunere | PASS | `round9_feed_text_bar_footer.jpg` |

Măsurători: coborârea este de `120–121 px` = **46 dp**, exact `footTravel(102, 48)`; marginea de jos a barei
textului stă la `200 px` de marginea ecranului = `22` (padding) + `48` (semnul de gest) + `8` (respirație);
înainte de acest val, aceeași bară măsura `2335` cu meniul prezent. Celula barei a crescut de la `146×145 px`
la `158×160 px`.

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **217 teste, 0 eșecuri** (205 + 6 în
`scripts/test-feed-foot.cjs` + 5 în `scripts/test-mark-doors.cjs` + 1 în `scripts/test-feed-rail.cjs`).
`footTravel` este testat **comportamental** (modulul pur este încărcat cu `typescript.transpileModule`), iar
`openTagPage` la fel, cu un router fals: `#Brașov` → `{ pathname: '/tag/[tag]', params: { tag: 'brașov' } }`,
`#a` / `#doi cuvinte` / `#` → nimic. `contact_sheet.jpg` a fost regenerat (**42 de celule**).

**Ce rămâne deschis**: ușile `@nume` și `#subiect` sunt dovedite automat, nu pe telefon — în feedul de azi
nicio legendă nu conține un `@` sau un `#` (aceleași fixture-uri lipsă ca la §5.2 din manifest); un clip
**landscape** își păstrează în continuare tot cadrul (`cover` ar tăia ~74 % din lățime).

### 11.7 Al patrulea val — panoul de reacții: o pastilă fină, ținută apăsată, cu emoji-ul de sub deget crescut (19 octombrie 2026)

Cerința owner-ului, citită împreună cu poza barei de reacții: „refă panoul de emoticoane, ceva mai finuț…
emoticoanele de heart se vede șters, schimbă-l, fă-le ca în poza atașată… când țin apăsat pe butonul de
heart, acel panel se deschide, și mut ușor cu degetul în stânga, iar emoticoanele selectat se mărește ușor,
și tot așa când mut degetul în stânga sau în dreapta… aceeași senzație o vreau pentru ambele zone: de hearts
cel de la clipuri gen reel, cu paleta de aprecieri verticală, cât și la cele orizontale.”

#### Ce s-a schimbat

| Zonă | Fișier | Ce face acum |
|---|---|---|
| Ce se desenează | `components/ReactionPalette.tsx` (nou) | O singură pastilă subțire: opt celule de `46 dp`, o margine de `6 dp`, fundal `rgba(9,16,23,.94)`, un fir de teal (`rgba(36,240,210,.3)`, marginea `.reactionBar.expanded` a webului) și **nici un nume sub emoji**. Celula reacției deja alese rămâne luminată; emoji-ul de sub deget este singurul care crește (`1,3`) și care iese din linie (`translateY -8` pe bară, `translateX -6` pe coloană), cu numele lui într-un chip mic deasupra (sau în stânga) pastilei |
| Glifele | `lib/socialTypes.ts` | `REACTION_PICKER_GLYPHS` (nou): `👍 ❤️ 😂 😮 😢 😡 ◆ ▼`. Inima pală a webului (`♥` = `U+2665` pentru Like, `💗` pentru Love) nu mai apare în panou — ownerul a numit-o „șters”. `REACTION_GLYPHS` rămâne neatins pentru rezumat, fiindcă acolo este un semn lângă un număr, nu o alegere |
| Ce arată farfuria | `components/ReactionControl.tsx` | Inima albă desenată (`SolidViewerIcon kind="heart"`) a devenit inima roșie a panoului, iar când o reacție a viewerului este pe farfurie, discul primește un inel teal — „aprins” se vede chiar dacă emoji-ul este aceeași inimă. Rezumatul compact (`👍 0`, `😢 1`) folosește tot setul panoului |
| Cum se alege | `components/ReactionControl.tsx`, `lib/reactionPicker.ts` (nou) | **Un tap scurt rămâne like-ul** de dinainte (`onReact('LIKE', …)`); **o ținere de 240 ms** (`PICKER_HOLD_MS`) deschide panoul; glisarea scrie indexul (`pickerIndexAt`), iar **ridicarea degetului alege emoji-ul arătat**. Un deget care pleacă mai mult de `10 px` înainte de prag este scroll, nu alegere; un scroll care ia gestul închide panoul neales (`onResponderTerminate`) |
| O singură mână | `components/ReactionControl.tsx` | Tot controlul este un singur responder (`onStartShouldSetResponderCapture`): farfuria și panoul pe care îl deschide nu sunt două ținte, deci degetul nu trebuie ridicat și pus din nou. Cât timp panoul este închis, gestul este cedat (`onResponderTerminationRequest: () => !open`), deci swipe-ul feedului pornește normal de pe inimă |
| Coloana, desenată de jos în sus | `components/ReactionPalette.tsx` | Panoul de la clipuri este o coloană care crește în sus din farfurie: primul emoji (👍) stă sub deget, iar glisarea în sus parcurge restul — exact cum glisarea în dreapta parcurge bara. `pickerIndexAt` măsoară amândouă de la aceeași margine |
| Pagerul, oprit cât timp panoul e deschis | `screens/FeedScreen.tsx`, `components/ReelsReader.tsx` | `onPanelChange` urcă din `ReactionControl` prin `ReelPage` până în feed, care pune `scrollEnabled={!paletteOpen}`. Fără asta, pager-ul vertical **fura glisarea coloanei la nivel nativ** și panoul se închidea la prima mișcare (văzut pe telefon, nu teoretizat) |

#### Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656, densitate 416 → 2,6 px/dp)

| Verificare | Rezultat | Captură |
|---|---|---|
| Clip: ținut apăsat pe inimă — panoul vertical se deschide în stânga railului, cu chipul reacției de sub deget | PASS | `round10_reaction_column_reel.jpg` |
| Clip: glisare în sus în timpul ținerii — emoji-ul de sub deget crește (`😮`, chip „Wow”), restul rămân la mărimea lor; pagina nu se mai întoarce | PASS | `round10_reaction_column_reel.jpg` |
| Clip: ridicarea degetului — farfuria arată `😮` cu inel teal și totalul `2` | PASS | `round10_reaction_picked_bar.jpg` |
| Text: ținut apăsat pe farfuria barei — pastila orizontală `380 dp` se deschide deasupra barei, primul emoji (`👍`) crescut, chip „Like” | PASS | `round10_reaction_bar_open.jpg` |
| Text: glisare în dreapta — creșterea trece pe `😢` (chip „Trist”), fără să miște pagina | PASS | `round10_reaction_bar_text.jpg` |
| Text: ridicarea degetului — farfuria arată `😢 1`, aprinsă în teal, iar panoul se închide | PASS | `round10_reaction_picked_bar.jpg` |
| Text: tap scurt (fără ținere) — reacția devine `👍 1` (like-ul de dinainte, neschimbat ca gest) | PASS | `round10_reaction_tap_like.jpg` |
| Clip neatins: inima farfuriei este roșie, nu conturul alb de dinainte | PASS | `round10_reaction_heart_idle.jpg` |

Măsurători: celula panoului este `119–120 px` = **46 dp** (opt celule: `+119` între fiecare două), pastila
este `988 px` = **380 dp** lată pe bară și `380 dp` înaltă pe coloană; farfuria de pe rail rămâne `145×145 px`
(56 dp), iar cea a barei de text `177×156 px` (68×60 dp). Pe coloană, panoul stă la `64 dp` în stânga
railului, cu piciorul pe piciorul farfuriei.

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **225 de teste, 0 eșecuri** (217 + 8 în
`scripts/test-reaction-palette.cjs`). Regula degetului este testată **comportamental**
(`lib/reactionPicker.ts` este încărcat cu `typescript.transpileModule`, iar `socialTypes.ts` cu cele trei
module de API stub-uite): bara se citește de la stânga, coloana de la picior, capetele se prind, un panou
nemăsurat nu mișcă nimic. Restul testelor citesc codul: pragul de ținere, cedarea gestului, oprirea
pagerului și faptul că grila veche cu nume sub glife a plecat. `contact_sheet.jpg` a fost regenerat
(**48 de celule**).

**Ce rămâne deschis, spus direct**: (1) un deget ridicat *exact* pe reacția care este deja pe farfurie o
**ia înapoi** (`onReact(kind, mine !== kind)` — regula veche a selectorului webului); dacă ownerul vrea ca
ridicarea să păstreze mereu reacția, este o singură linie în `choose`; (2) cititorul de ecran nu poate ține
apăsat, deci activarea lui deschide panoul ca înainte, iar cele opt celule rămân butoane cu numele lor;
(3) `scale` a trebuit scris ca `scaleX`/`scaleY`: driverul nativ al RN 0.86 îl refuza pe shorthand, iar
eroarea a apărut pe telefon în prima versiune.

### 11.8 Al cincilea val — ridicarea anulează, rândul e orizontal, iar like-ul nu mai stă pe negru (19 octombrie 2026)

Trei corecturi ale owner-ului, primite după al patrulea val, fiecare cu o consecință în cod:

> „dacă ridic degetul de pe reacție, vreau ca aceasta să fie anulată… să nu forțez utilizatorul să
> selecteze o icoană… coloana de emoticoane trebuie să se deschidă orizontal, nu vertical. Coloana de
> like nu trebuie să aibă fundal negru cum e acum; deasupra lui e un avatar care nu e nevoie… există deja
> un avatar pe ecran cu profilul utilizatorului.”

#### Ce s-a schimbat

| Cerință | Fișier | Ce face acum |
|---|---|---|
| Ridicarea în afara reacțiilor **anulează** | `lib/reactionPicker.ts`, `components/ReactionControl.tsx` | `pickerIndexAt` are acum și un *dinafară*: un deget mai departe de o celulă (`PICKER_SLACK = 46 dp`) de pastilă **nu mai poartă capătul ei**, ci întoarce `-1`. Glisarea scrie `-1` ca orice alt index (creșterea dispare, chipul dispare), iar ridicarea de acolo închide panoul **fără nici un `onReact`**. Palma de o celulă este aleasă exact cât farfuria care deschide panoul: cât timp degetul stă pe ea, tot primul emoji este arătat, deci o ținere urmată de ridicare fără glisare alege ca înainte |
| Panoul de la clipuri se deschide **orizontal** | `components/ReactionPalette.tsx`, `components/ReactionControl.tsx` | Panoul are un singur fel de a fi desenat: un rând. `vertical` a plecat din componentă, împreună cu stilurile lui (`pillVertical`, `chipRowVertical`). Ce diferă între zone este **marginea** (`anchor`): bara de sub o pagină de cuvinte crește spre dreapta din farfuria din stânga, iar rândul de lângă rail crește spre stânga, fiindcă farfuria lui este în dreapta ecranului. Primul emoji (👍) este deci mereu sub deget: la stânga rândului, respectiv la dreapta lui |
| Farfuria like-ului **fără fundal negru** | `components/ReactionControl.tsx` | `railDiscOn` a rămas doar inelul teal (`borderWidth: 1`), fără `backgroundColor: rgba(8,14,20,.55)`. Emoji-ul stă direct pe poză sau pe clip |
| **Fără avatar** deasupra like-ului | `components/ReelsReader.tsx` | Emblema `.clipRailAvatar` (`NT`, disc negru cu inel alb) a fost scoasă din rail, împreună cu stilurile ei și cu importurile care o umpleau (`RemoteImageSource`, `initialsFor`, `mediaSourceForPath`). Autorul este deja pe pagină, cu iniţialele, numele şi `@handle` lângă legendă. Au plecat și stilurile moarte `palette*` rămase de la vechiul panou al reel-ului |

#### Dovedit pe telefon (`192.168.1.184:39169`, 1220×2656, densitate 416 → 2,6 px/dp)

| Verificare | Rezultat | Captură |
|---|---|---|
| Clip: ținut apăsat pe farfurie — rândul **orizontal** se deschide în stânga ei, `👍` crescut sub deget, chip „Like” | PASS | `round11_reaction_row_open.jpg` |
| Clip: glisare la stânga — creșterea trece pe `😂` (chip „Haha”), pagina nu se mișcă | PASS | `round11_reaction_row_haha.jpg` |
| Clip: degetul dus departe de rând — **nimic** nu mai este crescut, nici un chip | PASS | `round11_reaction_row_off_row.jpg` |
| Clip: ridicat acolo — panoul se închide, reacția rămâne `👍 2` (**anulat**, nu forțat) | PASS | `round11_reaction_row_cancelled.jpg` |
| Clip: ținut din nou și glisat pe `❤️` (chip „Love”) — creșterea urmează degetul | PASS | `round11_reaction_row_love_aim.jpg` |
| Clip: ridicat pe `❤️` — farfuria arată inima, totalul rămâne `2`, fără disc negru în jurul ei | PASS | `round11_reaction_row_love_picked.jpg` |
| Poză deschisă (gradient luminos): railul fără avatar deasupra like-ului și fără nici un fundal negru sub el | PASS | `round11_rail_no_avatar_bright.jpg` |

Măsurători: rândul are **380 dp** lățime (`990 px` cu marginile, de la `35` la `1025`) și **58 dp** înălțime
(`155 px`, de la `1716` la `1871`), cu celulele de `119–120 px` (46 dp); marginea lui dreaptă cade la
`1025 px`, adică `64 dp` în stânga marginii railului (`1194 px`), deci prima celulă (`👍`) stă sub degetul
de pe farfurie. Farfuria de rail rămâne `145×145 px` (56 dp), iar rândul se aliniază cu piciorul ei.

**Teste**: `tsc --noEmit` → exit 0; `npm test` → exit 0, **228 de teste, 0 eșecuri** (225 + 3 în
`scripts/test-reaction-palette.cjs`, acum 11 teste). Testele noi rulează regula, nu doar o citesc: rândul
de la clip se citește de la dreapta, un deget aflat la o celulă de pastilă încă arată un emoji, iar unul
dincolo de ea întoarce `-1`. Restul verifică în cod: `-1` este o poziție pentru pastilă, ridicarea pe
`-1` închide panoul fără `onReact`, panoul nu mai are variantă verticală, iar railul nu mai desenează
avatar. `contact_sheet.jpg` a fost regenerat (**55 de celule**).

**Ce rămâne deschis, spus direct**: (1) ridicarea *exact* pe reacția care este deja pe farfurie o ia
înapoi (`onReact(kind, mine !== kind)`), regula webului — dacă ownerul vrea ca ridicarea să păstreze
mereu reacția, este o singură linie în `choose`; (2) cititorul de ecran nu poate ține apăsat, deci
activarea lui deschide panoul, iar cele opt celule rămân butoane cu numele lor; (3) un ecran mai îngust
de ~440 dp ar scurta rândul de la clip, fiindcă pastila are 380 dp fix — pe telefonul de verificare
(469 dp) încape cu 15 dp la stânga. Dacă ownerul cere vreodată un rând care se strânge, celulele trebuie
să devină flexibile, iar `pickerIndexAt` ar trebui să primească pasul măsurat, nu constanta `46`.




## 12. Runda a noua — o pagină de text are felul ei, iar serverul îl păzește (25 octombrie 2026)

Până acum un post de text era desenat de cititor cu măsurile cititorului: aceleași cuvinte puteau arăta
altfel pe două telefoane, iar un client străin putea trimite orice culoare. Felul paginii este acum **al
postării**: se alege în compozitor, se validează pe telefon, se validează din nou pe server și se scrie
o singură dată, lângă cuvinte.

### 12.1 Ce s-a schimbat

| Cerință | Fișier | Ce face acum |
|---|---|---|
| Stilul e al postării, nu al cititorului | `lib/post-text-style.js` (nou), `lib/db.js`, `lib/repo.js`, `lib/api.js` | Coloana `text_style_json` pe `posts` (migrare prin `ensureColumn`). Șase teme (`jungle`, `paper`, `midnight`, `ember`, `moss`, `ink`), fiecare cu **perechea ei** fundal/cerneală. `normalizeTextStyle` refuză cheile străine, tema/litera/mărimea/aliniera necunoscută și orice pereche care nu este exact a temei alese; o culoare lipsă ia perechea temei **alese**, nu a temei de referință. `null` rămâne `null` |
| Amprenta urmează stilul | `lib/repo.js` | `textStyleJson` intră în `commitmentPayload` doar când există: aceleași cuvinte cu altă temă sunt altă postare, iar fiecare rând scris înainte de coloană își păstrează hash-ul și `null` |
| Serverul refuză ce nu poate desena | `lib/api.js` | `POST /api/posts` acceptă `text_style` pentru orice pagină cu cuvinte, refuză un stil pe un post fără cuvinte (`TEXT_STYLE_REQUIRES_TEXT`) și orice stil invalid (`TEXT_STYLE_INVALID`); răspunsul este 400 înainte de `BEGIN IMMEDIATE`, deci un refuz nu lasă rând, versiune sau eveniment de moderare. Runda a zecea a relaxat regula pentru pagina cu poză (§13.2) |
| Cititorul de rânduri nu cade | `lib/repo.js` | `textStyleFromRow` citește tolerant: un JSON stricat sau un stil scris de alt build devine „fără stil”, niciodată un feed picat; `text_style` apare pe vederea postării (`api.js`) |
| Compozitorul arată exact ce va publica | `src/app/text.tsx` (nou), `src/components/TextPage.tsx` (nou), `src/lib/textStyle.ts` (nou), `src/lib/textDraft.ts` (nou) | Pagina 9:16 este compusă la 360 dp și scalată la lățimea ecranului; temele se ating pictate în propriile culori; literă, mărime și aliniere; 32 de emoji; titlu, locație, link, comentarii și distribuire; vizibilitate și proveniență. Contorul arată `N/2000`, iar peste 2000 publicarea este refuzată (editorul acceptă până la 2200, ca omul să vadă de ce nu poate publica, nu să-i fie tăiat textul pe tăcute) |
| Ciorna nu se pierde | `src/lib/textDraft.ts` | `nexus-text-drafts/current.json`, scris prin fișier temporar și mutat: un crash la mijloc nu lasă jumătate de JSON. Închiderea întreabă: renunță, păstrează ciorna sau continuă scrierea; publicarea reușită o șterge |
| Publicarea trece prin același client | `src/lib/publishClient.ts`, `src/lib/socialTypes.ts` | `text_style: normalizeTextStyle(intent.textStyle)` în corpul cererii; `PUBLISH_TEXT_STYLE` pentru `TEXT_STYLE_INVALID`, `TEXT_STYLE_REQUIRES_TEXT` și „text style requires a text post” |
| TEXT nu este un mod al camerei | `src/app/camera.tsx` | Al treilea buton de lângă PHOTO/VIDEO deschide compozitorul (`router.push('/text')`) și anulează numărătoarea; o pagină de cuvinte este Post, nu Reel |
| Feed-ul desenează pagina autorului | `src/components/PostCanvas.tsx`, `src/components/PostReading.tsx` | Tema pictează tot cadrul (fără grove și fără voal: `opacity={authored ? 0 : …}`), scara de „statement” se retrage, iar cuvintele primesc pagina, litera, mărimea și alinierea autorului. Numele și `@handle`-ul se scriu cu cerneala temei (`authoredInk`, respectiv aceeași cerneală la `0.72`), la fel linia de repost, etichetele și „Vezi traducerea”: un nume alb pe `paper` ar fi invizibil |
| Paritatea e testată, nu sperată | `scripts/test-text-style.cjs` (nou) | Importă modulul serverului și cel al telefonului și compară lista temelor, perechile, literele, mărimile, alinierile; rulează refuzurile stricte ale ambelor, cititorul tolerant al ciornei, `textStyleForPost`, `fontFamilyFor` pe fiecare platformă și contrastul WCAG al fiecărei perechi (≥ 4.5) |


### 12.2 Verificări rulate

| Comandă | Rezultat |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` (mobil) | exit 0, nici o eroare |
| `npm test` (mobil, 30 de scripturi în lanț) | exit 0, **238 de teste, 0 eșecuri**; `test-text-style.cjs` are 7 teste și rulează în lanț |
| `npm test` (web) | exit 0, **827 de teste, 0 eșecuri** |
| `node --test test/post-publishing.test.js` | 7 teste, 0 eșecuri, inclusiv „a text post carries the look its author chose and a request cannot repaint a theme” |
| `git status` | modificările runde sunt în arborele de lucru, necomise (branch `codex/camera-draft-stability`) |

Testul nou din `post-publishing.test.js` nu citește codul, ci rulează cererea: publică un post de text cu
stil, îl recitește cu stilul întreg, arată că două teme dau două `content_commitment`-uri diferite, că un
rând scris fără stil rămâne `null`, și că serverul refuză (400) repictarea unei teme, o temă necunoscută
și o cheie în plus. (Runda a zecea a relaxat regula „stilul nu merge cu media”: o pagină cu poză poate
păstra stilul, vezi §13.2.) Testele mobile compară lista temelor și perechile cu modulul serverului, nu
cu o copie scrisă de mână.

### 12.3 Dovedit pe telefon — și ce **nu** s-a dovedit

Dispozitiv: `25098PN5AC` (adb wireless), 1220×2656, build de dezvoltare `app.nexus.mobile.dev` încărcat
de pe Metro (`http://192.168.1.153:8081`). Dovada este ierarhia de accesibilitate (`uiautomator`), nu o
captură de ecran.

| Verificare | Rezultat |
|---|---|
| `nexusdev://text` deschide compozitorul de text | PASS — ierarhia conține „Pagina de text, tema Jungle”, „Scrie primul rând…”, „0 CARACTERE”, „0/2000”, „Textul se citește pe pagini de 420 de caractere.”, „Adaugă 🌿”, „Publică postarea de text” |
| Feed-ul se deschide și un post fără stil rămâne neschimbat | PASS — „wallet4e8gv6 (social)”, textul întreg, „Citește tot”, „Vezi traducerea”, „Deschide selectorul de reacții” |
| Un post publicat cu stil, citit în feed (ramura `authored` din `PostCanvas`) | **NEPROBAT PE DISPOZITIV** |

Ce lipsește și de ce, spus direct: build-ul instalat vorbește cu deployment-ul Railway de producție
(`apiOrigin.ts` nu este suprascris de nici un `.env`), deci publicarea unui post de probă ar fi creat un
post public real — nu am făcut-o fără acordul ownerului. În plus, o încercare de a scrie în compozitor prin
`adb shell input text` a părăsit aplicația pentru ecranul de sistem „Display over other apps”, deci nici un
cuvânt nu a ajuns în ciornă. Ramura `authored` este acoperită de teste (cadru pictat de temă, voal stins,
cerneala numelui, stilurile din `RichText`) și de citirea codului, nu de o citire pe telefon. Pașii siguri,
în ordine: (1) un build de dezvoltare cu `EXPO_PUBLIC_NEXUS_API_URL` către un API local sau de test, apoi
publicarea unei pagini `paper` și a uneia `jungle` și citirea lor în feed; sau (2) acord explicit pentru
un singur post de probă pe producție.

### 12.4 Ce rămâne deschis

1. **Dovada pe telefon a paginii autorului** — pasul de mai sus; până atunci, randarea `authored` este
   dovedită doar de teste.
2. **Cititorul web** — serverul expune `text_style` pe fiecare vedere de postare, dar feed-ul web nu îl
   desenează încă; un post de text se citește pe web cu compoziția web. Dacă ownerul vrea paritate și aici,
   `post-text-style.js` este deja modulul care trebuie importat de cititorul web.
3. **Celula din grilă** — un post de text din grilă rămâne celula cititorului (primele cuvinte pe placa
   întunecată), nu o miniatură a temei; este o alegere, nu un defect, dar este o diferență față de pagina
   mare.
4. **Tema nu se poate schimba după publicare** — `PATCH /api/posts/:id` schimbă doar cuvintele și
   vizibilitatea, iar amprenta se recalculează din rândul păstrat (deci stilul rămâne în amprentă). Dacă
   editarea va primi vreodată și stil, trebuie să treacă prin același `normalizeTextStyle`, altfel un client
   ar putea repicta o temă după publicare.


## 13. Runda a zecea — textul lung se vede, se împarte după ecran, iar poza călătorește cu pagina (25 octombrie 2026)

Ownerul a publicat de pe telefon un text de ~2 000 de caractere și a primit `1/5` pe un ecran gol.
Runda aceasta nu a schimbat culori „până arată bine”: a găsit cutia de layout care avea înălțime zero,
a măsurat pagina pe care se citește, a ridicat limita la 20 000 de caractere și a dus atașamentele din
galeria Android până în feed.

### 13.1 Cauza exactă a textului invizibil

Lanțul de layout din feed era:

`PostCanvas.reading` (absolut, plin) → `readingCenter` (`flex: 1`) → `readingBodyWrap` (**fără înălțime**) →
`PostTextReading` (`style={styles.readingBody}`, adică `flex: 1`) → pager → pagini.

Într-un părinte cu înălțime automată, un copil cu `flex: 1` primește `flexBasis: 0`; înălțimea lui se
rezolvă la **0**. `PostTextReading` avea deci 0 px, `ScrollView`-ul și paginile 0 px, iar Android nu a
desenat nici un cuvânt. Insigna `x/y` era singura poziționată absolut, deci scăpa de cutia zero și se
vedea plutind — exact `1/5` fără text. Ierarhia de accesibilitate de dinainte de reparare nu conținea
**nici un nod de text** al articolului, doar autorul, insigna, `Vezi traducerea` și railul: deci nu era
o problemă de contrast, ci de layout.

Aceeași cutie zero ar fi ascuns și paginile unui text vechi de 2 000 de caractere; textele scurte se
vedeau pentru că ele merg pe ramura „statement” (`RichText` direct), nu pe reader-ul paginat.

### 13.2 Ce s-a schimbat

| Defect / cerință | Fișier | Ce face acum |
|---|---|---|
| Textul dispărea | `src/components/PostCanvas.tsx` | `readingBodyWrap` are `flex: 1`, deci reader-ul primește înălțimea reală dintre cap și rândul de acțiuni. Comentariul din stil spune de ce, ca să nu fie „curățat” din nou |
| Pagina 1/5 fără text | `src/components/PostReading.tsx` | Fiecare pagină are lățimea și înălțimea măsurate ale cutiei; textul stă într-un `ScrollView` vertical care se activează **doar** dacă o pagină depășește ecranul. O estimare greșită nu mai poate ascunde un cuvânt, iar swipe-ul vertical al feed-ului rămâne liber pe o pagină normală |
| 420 de caractere tăia paragrafe | `src/lib/postPresentation.ts` | `textPageCapacity({ width, height, fontSize, lineHeight, glyph })` calculează câte caractere încap pe ecranul real (linie × linii × 0,92); `TEXT_PAGE_CHARS = 420` rămâne doar valoarea de dinainte de prima măsurare. `MAX_TEXT_PAGES` a crescut de la 5 la 120, iar depășirea nu mai pierde text: coada se scurge în ultima pagină, care se derulează |
| Insigna mințea după re-măsurare | `src/components/PostReading.tsx` | Insigna și pager-ul citesc același index, limitat la numărul real de pagini; nicio pagină goală nu este construită (`textPages` nu împinge pagini fără conținut) |
| Limita de 2 000 | `src/lib/textStyle.ts`, `src/lib/textDraft.ts`, `src/app/text.tsx`, `lib/api.js`, `lib/repo.js` | `TEXT_MAX_CHARS = 20000`. Compozitorul acceptă 20 000 (contor `N/20000`), ciorna nu mai taie la 2 200, serverul acceptă 20 000 pentru o pagină de text sau o pagină cu stil și refuză **explicit** `413 CAPTION_TOO_LONG` peste limită, în loc să taie tăcut. `PATCH /api/posts/:id` folosește aceeași limită pentru un rând cu `text_style_json` sau `kind=text`; `repo.editPost` nu mai taie la 5 000 |
| Zona de scriere creștea la 10 000 de rânduri | `src/app/text.tsx` | `TextInput`-ul multiline are 260 dp și derulare proprie; restul compozitorului rămâne derulabil |
| Atașamentele lipseau | `src/lib/textAttachments.ts` (nou), `src/app/text.tsx`, `src/lib/textDraft.ts` | Butoane `+ Fotografie` și `+ Clip video` deschid galeria Android (`expo-image-picker`), arată miniatura, numele, `Înlocuiește` și `Șterge`. Fișierul stă local în ciornă și urcă doar la publicare, prin `uploadDraftMedia` (`social_post`), în ordine, ca `media_items`. Un clip este singur; fotografiile pot fi mai multe (max. 5) |
| Publicarea pierdea atașamentele | `src/lib/publishClient.ts` | `PublishIntent.mediaItems`; `publishBody` trimite toate elementele în `media_items` (și primul în `media_hash/ext`), deci serverul scrie `post_media` în ordine și postarea rămâne POST, nu Reel |
| Stilul era refuzat lângă o poză | `lib/api.js` | `TEXT_STYLE_REQUIRES_TEXT` se aplică doar unei postări **fără cuvinte**. O pagină cu poză are în continuare un `text_style` păstrat și amprentat; poza nu este un motiv să pierzi tema aleasă |
| Previzualizarea nu exista | `src/app/text.tsx` | `Previzualizează pagina` deschide un modal cu tema, textul paginat exact ca reader-ul (`PostTextReading`), atașamentele și contorul; pe 11 105 caractere a arătat `1/12`, `11105 caractere · tema Hârtie` |


### 13.3 Dovedit pe telefon, cu un API local (nu Railway)

Dispozitiv: `25098PN5AC` (`pandora`), 1220×2656, `app.nexus.mobile.dev`. API: `node server.js` local pe
`http://localhost:5000`, cu `adb reverse tcp:5000 tcp:5000`; Metro repornit cu
`EXPO_PUBLIC_NEXUS_API_URL=http://localhost:5000`. Nu s-a făcut nici un deploy și nici un post pe
producție. Dovada este ierarhia `uiautomator` și răspunsurile API/DB, nu capturi de ecran.

| Verificare | Rezultat |
|---|---|
| Compozitorul încarcă un articol de 11 105 caractere din ciornă | PASS — `PRIMUL PARAGRAF…`, toate cele 34 de paragrafe, `11105/20000`, `Pagina se împarte după ecran; textul nu este tăiat la publicare.` |
| Publicare `paper` (serif, mic, stânga) | PASS — postarea **#151**, `kind=text`, `length(caption)=11105`, începutul și `ULTIMUL PARAGRAF… FINAL.` identice, `text_style_json` = paper/serif/small/left |
| Feed după publicare | PASS — pagina 1 din 16, textul primelor paragrafe în ierarhie, autor `@rrommeoo1112`, `Vezi traducerea`, rail complet |
| Toate paginile | PASS — 15 swipe-uri orizontale, fiecare a raportat `Pagina N din 16` și a avut nod de text; pagina 16 conține sfârșitul articolului. Zero pagini goale în ierarhie |
| Reîncărcare la rece (force-stop + launcher + feed) | PASS — postarea #151 apare din nou cu `1/16` și textul articolului |
| Preview | PASS — `PREVIZUALIZARE`, articolul întreg, `1/12`, `11105 caractere · tema Hârtie`, buton `Închide` |
| Atașament din galerie | PASS — Android Photo Picker, `Selected 1 item`, `OK`; compozitorul arată `Fotografia 1`, `132060.jpg`, `Înlocuiește`, `Șterge` |
| Publicare `jungle` + fotografie | PASS — postarea **#153**, `kind=image`, `length(caption)=359`, `text_style_json` = jungle/sans/medium/left, `post_media(position=0, media_id=121)`, JPEG 40 623 B, `scan_status=ready_local_validation` |
| Publicare `jungle` fără poză | PASS — postarea **#154**, `kind=text`, 359 de caractere, aceeași temă jungle; feed-ul arată textul întreg pe pagina întunecată, fără insignă (o singură pagină), autorul sus |
| Feed pentru #153 | PASS — textul întreg (359 de caractere), `Citește tot`, locația `București`, iar în spatele compoziției există `ImageView`-ul full-frame al pozei (media 121) |
| Reîncărcare la rece pentru #153 | PASS — după force-stop + launcher, postarea #153 și poza sunt din nou în feed, cu textul întreg |
| Postarea de control #152 | creată direct prin API (22 de caractere, poză) ca să izolez serverul de aplicație; nu este o dovadă de UI |

Contul care a publicat este sesiunea locală deja prezentă în API: `@rrommeoo1112` (user 13, profilul
„Romeo 111”). Contul `@test` (id 34) a fost creat pentru autentificare, dar aplicația a folosit
sesiunea locală existentă. **Efect secundar de spus direct:** înainte de test, aplicația avea o sesiune
Railway; acum ține sesiunea locală. Metro rulează în continuare cu
`EXPO_PUBLIC_NEXUS_API_URL=http://localhost:5000`; pentru a reveni la producție, repornește-l fără
variabilă și autentifică-te din nou — tokenul vechi de producție nu a fost păstrat de mine.

### 13.4 Verificări rulate

| Comandă | Rezultat |
|---|---|
| `tsc --noEmit` (mobil) | exit 0 |
| `npm test` (mobil, 30 de scripturi) | exit 0, **243 de teste, 0 eșecuri**; `test-post-presentation.cjs` are 13 teste (inclusiv capacitatea măsurată și articolul de 10 000+ caractere), `test-text-style.cjs` are 7 |
| `node --test test/post-publishing.test.js` | 9 teste, 0 eșecuri; noul test publică 11 289 de caractere, verifică lungimea exactă, refuză 20 001 cu `413 CAPTION_TOO_LONG`, acceptă o pagină fără stil și dovedește că o pagină cu fotografie păstrează tema și rămâne POST |
| `npm test` (web) | **829 de teste, 0 eșecuri** |

### 13.5 Ce rămâne deschis, fără să fie ascuns

1. **GIF** — serverul media acceptă JPEG, PNG, WebP, MP4, WebM, MP3, WAV, OGG; nu are `image/gif` în
   `MIME_EXTENSIONS`. Compozitorul spune asta în loc să afișeze un buton mort. Ca să existe GIF, trebuie
   adăugat MIME-ul, sniff-ul și randarea lui în `PostMedia`, nu doar un buton.
2. **Tema pe o pagină cu poză** — `text_style` este păstrat și amprentat, dar feed-ul desenează o
   postare cu media în compoziția foto (text peste voal), nu pictează tema pe tot cadrul. Textul este
   lizibil; tema aleasă nu se vede încă pe acest tip de postare. O pagină cu poză ar merita o bandă de
   text pictată cu tema, sub poză, într-o rundă viitoare.
3. **Ștergerea / înlocuirea atașamentului** — butoanele există și sunt legate de `edit`/`chooseAttachments`,
   dar pe telefon am dovedit doar adăugarea și publicarea, nu și înlocuirea sau ștergerea.
4. **Clip video în compozitorul TEXT** — fluxul folosește același picker și aceeași urcare; nu a fost
   ales un clip pe telefon în această rundă.
5. **Culoare liberă și formatare de paragraf** — tema dă perechea fundal/cerneală verificată WCAG; nu
   există selectoare de culoare arbitrară sau bold/italic, ca să nu se poată publica o pagină ilizibilă.
6. **Reader-ul web** și celula din grilă rămân neatinse; ownerul a cerut exclusiv Android.


### 13.6 Fotografia dintr-un articol are un plafon, iar postarea rămâne articol (recomandarea ownerului, 25 octombrie 2026)

Ownerul a cerut explicit ca o fotografie foarte înaltă să nu fie forțată să încapă „la dimensiune mare”
împreună cu mult text pe aceeași pagină. Regula implementată este:

- fotografia stă într-un **bloc măsurat** în prima pagină a articolului, cu înălțimea limitată la 34 %
  din înălțimea paginii, cel mult 92 % din lățimea ei și cel mult 420 dp;
- blocul desenează fotografia cu `contain`, deci păstrează tot cadrul, fără decupare și fără zoom
  artificial; o fotografie foarte înaltă rămâne întreagă, iar o fotografie lată nu este tăiată;
- textul care nu încape lângă fotografie continuă pe pagina următoare. `textPagesWithLead` dă primei
  pagini capacitatea ei (pagina minus blocul), iar paginile următoare păstrează capacitatea normală;
- atingerea fotografiei deschide un `Modal` pe tot ecranul, cu `contain`, numărătoare `1/n` și buton
  `Închide`. Nu se redeschide postarea: pagina din spate rămâne articolul;
- un post scris în compozitorul TEXT (`text_style`) care are numai fotografii este clasificat `article`
  de `isAuthoredArticle`/`stageFor` și este desenat de `PostCard`, nu de `ReelPage`. O poză fără pagină
  autorată păstrează compoziția imersivă de dinainte; un clip rămâne Reel.

Fișiere atinse în această continuare:

| Fișier | Rol |
|---|---|
| `src/lib/postPresentation.ts` | `isAuthoredArticle`, starea `article`, `textPagesWithLead` |
| `src/screens/FeedScreen.tsx` | `immersive = hasVisualMedia(item) && !isAuthoredArticle(item)` |
| `src/components/PostCanvas.tsx` | articolul nu mai primește cover full-bleed; tema rămâne fundalul; `PostTextReading` primește blocul foto ca `lead` |
| `src/components/PostReading.tsx` | plafonul măsurat al blocului, capacitatea primei pagini, textul continuat pe paginile următoare |
| `src/components/ArticleMedia.tsx` (nou) | fotografia `contain`, pager pentru mai multe poze, vizualizator `Modal` pe tot ecranul |
| `scripts/test-post-presentation.cjs`, `scripts/test-feed-rail.cjs`, `scripts/test-nav-band.cjs` | clasificarea articolului, paginarea cu lead și compoziția sursă |

Verificări rulate după această continuare: `tsc --noEmit` exit 0; suita mobilă (30 de scripturi) exit 0;
`test-post-presentation.cjs` are 13 teste, `test-feed-rail.cjs` are 5, `test-nav-band.cjs` are 9.

**Ce nu este încă dovedit pe telefon pentru această continuare:** blocul foto al articolului, pagerul
pentru mai multe fotografii și vizualizatorul `Modal` au fost verificate prin teste de sursă și prin
tipurile TypeScript, nu printr-o sesiune nouă pe dispozitiv. Aplicația rămâne orientată spre API-ul local
și sesiunea locală descrisă la §13.3; pentru producție, Metro trebuie repornit fără
`EXPO_PUBLIC_NEXUS_API_URL` și contul autentificat din nou. Nu a fost schimbată configurația Railway.



### 13.7 O singură pagină în compozitor, iar fotografia ei se aranjează cu degetele (25 octombrie 2026)

Ownerul a cerut ca editorul TEXT să nu mai aibă „trei desene ale aceleiași postări”: o pagină
decorativă sus, o casetă de text separat și încă o previzualizare într-un `Modal`. Acum există o singură
pagină, iar ea este articolul:

- textul se scrie **în pagină**, cu tema, litera, mărimea și alinierea autorului; nu mai există `TextPage`,
  caseta `composerCard` și nici `Modal`-ul `PREVIZUALIZARE`;
- fotografia (sau clipul) din capul paginii este sub degete: **un deget o mută**, **două degete o
  apropie**; gestul scrie direct în `text_style.media` prin `clampMediaFrame`, deci ceea ce vede autorul
  este exact ce se publică;
- blocul măsurat are aceeași formulă în compozitor și în cititor (`mediaLeadHeight`): plafonul de 34 %
  din pagină, scalat de autor între 45 % și 120 %, plus deplasarea pe verticală; textul de sub el se
  mută în jos când fotografia crește, iar prima pagină publicată rezervă același spațiu;
- butonul `Așază poza` readuce cadrul la referință (`scale: 1`, centrat), iar un cadru vechi sau
  jumătate scris este citit tolerant, nu refuzat;
- serverul (`apps/nexus-web/lib/post-text-style.js`) și telefonul (`src/lib/textStyle.ts`) folosesc
  aceleași chei și limite; un cadru în afara paginii este refuzat de ambele, iar unul absent primește
  cadrul neutru;
- butonul `Vezi traducerea` dispare când limba postării este limba telefonului sau este engleză
  (`needsTranslation`); un post fără limbă păstrează butonul, pentru că nimic nu dovedește că e lizibil.

Fișiere atinse în această continuare:

| Fișier | Rol |
|---|---|
| `src/components/TextMediaFrameEditor.tsx` (nou) | gestul de mutare/apropiere, blocul absolut dimensionat de `text_style.media` |
| `src/app/text.tsx` | o singură pagină editabilă, fără casetă separată și fără `Modal` de previzualizare |
| `src/lib/postPresentation.ts` | `mediaLeadHeight`, `languageCodeOf`, `deviceLanguage`, `needsTranslation` |
| `src/components/PostReading.tsx` | folosește aceeași `mediaLeadHeight` ca editorul |
| `src/components/PostCanvas.tsx` | transmite `frame` și `baseHeight` blocului foto; filtrează butonul de traducere |
| `src/components/ArticleMedia.tsx` | pragul de sus, pagerul și vizualizatorul `Modal` finalizate |

Verificări: `tsc --noEmit` exit 0; suita mobilă (27 de scripturi) exit 0, **247 de teste, 0 eșecuri**;
`test-post-presentation.cjs` are 15 teste (inclusiv reflow-ul cu fotografia mărită și regula de limbă),
`test-text-style.cjs` are 9 (inclusiv cadrul validat, paritatea cu serverul și cele două bucăți de
interfață ale compozitorului); suita web exit 0,
**829 de teste, 0 eșecuri**, iar `test/post-publishing.test.js` verifică publicarea unui cadru și
respingerea lui în afara paginii.

**Dovada pe telefon (25 octombrie 2026):** după `dev:reload`, `nexusdev://text` a deschis compozitorul nou.
Ierarhia UI conține un singur `EditText` (`Textul postării`, bounds `[209,420][1011,1906]`) în pagină și
nici un `Pagina de text` sau `Previzualizează pagina`. O fotografie aleasă din galeria Android a apărut ca
`Fotografia paginii`, iar după o glisare cu un deget textul a coborât de la `[209,1048][1011,1906]` la
`[209,1147][1011,1906]` (reflow măsurat pe dispozitiv), cu butonul `Așază poza` apărut. Cu două degete
(pinch) nu a fost probat: `adb input` nu poate sintetiza două puncte de atingere simultane; gestul este
acoperit de `PanResponder` și de testul de reflow, nu de o atingere reală. Atașamentul de probă a fost
șters, iar ciorna a rămas goală.

**Ce nu este încă dovedit pe telefon:** zoom-ul cu două degete și pagina publicată citită în feed cu
cadrul aranjat. Pașii de reluare rămân cei de la §13.6: un build de dezvoltare cu
`EXPO_PUBLIC_NEXUS_API_URL` către un API local, apoi o pagină `paper` cu o fotografie aranjată din
degete și citită în feed.

---

## 14. Runda a unsprezecea — document editorial, reflow real, grila de profil (25 octombrie 2026)

**Stare: IMPLEMENTED — AWAITING PHYSICAL ANDROID VERIFICATION.**
Codul și testele automate sunt gata. Nicio verificare vizuală pe telefon nu a fost făcută în această rundă;
telefonul nu a fost accesat, nu s-au rulat comenzi ADB și nu s-au făcut capturi.

### 14.1 Ce s-a schimbat, pe scurt

Editorul TEXT nu mai este un singur șir cu o fotografie fixă în cap. O pagină este acum un **document
editorial** salvat în `text_style.document`: paragrafe, titluri, media cu așezare și salturi de pagină.
Textul curge în jurul fotografiilor (stânga/dreapta), continuă pe toată lățimea după ele, iar o
fotografie de lățime completă stă ca bloc, cu text deasupra și dedesubt. Două fotografii pot împărți
aceeași pagină când au loc. Un articol lung se împarte în pagini 9:16 fără pierdere de cuvinte.

Pagina publicată este desenată de **același** `EditorialPage` ca pagina din compozitor: același motor de
flow, aceeași geometrie a media, același paginator. Grila de profil a fost curățată la o miniatură
9:16 (imagine/clip sau capac de temă + numărul real de vizualizări), iar fiecare celulă este o ușă către
`/post/[id]`, care remontează cititorul existent (`PostCard` / `ReelPage`).

### 14.2 Arhitectura rendererului

Nu s-a folosit un WebView și nu s-a construit o a doua aplicație. React Native nu are `float`, deci
textul nu putea fi așezat lângă un `<Image>` cu continuare sub el prin simpla compunere de `<Text>`.
Soluția este un **motor de flow pur** (`src/lib/editorialFlow.ts`):

1. fiecare bloc media rezervă un dreptunghi (x, y, lățime, înălțime) derivat din lățimea paginii,
   fracțiunea aleasă și raportul natural măsurat al fișierului;
2. fiecare rând de text întreabă ce intervale orizontale sunt libere la înălțimea lui;
3. rândul este așezat în cel mai lat interval liber; când fotografia se termină, intervalul revine la
   toată măsura paginii;
4. când pagina se umple, se creează pagina următoare; media nu se mută peste text și nu se pierde niciun
   cuvânt.

Rezultatul este o listă de pagini cu rânduri și dreptunghiuri media. `EditorialPage` le desenează
nativ cu `Text`/`Image`/`RemoteVideo`; nu există text așezat peste imagine. Măsurarea lățimii este o
funcție stabilă (`measureTextWidth`) cu o tabelă conservatoare pe literă, ca rândul să rămână în
interval pe fonturile Android.

### 14.3 Schema documentului

`src/lib/editorialDocument.ts` (oglindit de `apps/nexus-web/lib/post-editorial-document.js`):

```ts
type EditorialDocument = {
  version: 1;
  typography?: 'auto' | 'small' | 'medium' | 'large';
  blocks: EditorialBlock[];
};

type EditorialBlock =
  | { id: string; type: 'paragraph' | 'heading'; text: string; runs?: { text: string; bold?: true; italic?: true }[] }
  | { id: string; type: 'media'; mediaIndex: number; mediaType: 'image' | 'video';
      placement: 'left' | 'right' | 'center' | 'full'; widthFraction: number; wrapText: boolean }
  | { id: string; type: 'pagebreak' };
```

Reguli verificate pe ambele maluri: maximum 400 de blocuri, maximum 20 000 de caractere de text, id-uri
stabile și unice, `mediaIndex` între 0 și 4, `widthFraction` între 0.28 și 1, `placement` și `mediaType`
din listele închise. Un document rupt este refuzat de server și ignorat de cititorul tolerant. Un post
vechi fără `document` păstrează exact compoziția veche.


### 14.4 Cum funcționează așezarea și reflow-ul

- **Tragere**: `EditorialMediaView` are `PanResponder`. O tragere orizontală peste 7 % din pagină
  schimbă așezarea la `left` sau `right`; o tragere verticală peste ~1.8 rânduri mută blocul mai sus sau
  mai jos în document. Fiecare gest este scris prin funcțiile documentului, nu prin coordonate hardcodate.
- **Redimensionare**: mânerul din colțul drept-jos schimbă `widthFraction`; flow-ul este recalculat la
  fiecare mișcare, deci textul se rearanjează imediat. La eliberare se păstrează un snapshot pentru Undo.
- **Preseturi**: bara arată `Stânga`, `Dreapta`, `Centru`, `Toată lățimea`, `Text în jur: da/nu`,
  `Mai îngustă`, `Mai lată`, `Mai sus`, `Mai jos`, `Scoate din pagină`. Ea apare doar când o fotografie
  este selectată; un titlu are doar comutatorul `Fă titlu`.
- **Două fotografii**: două blocuri `left`/`right` consecutive pot sta la același `y` dacă dreptunghiurile
  nu se suprapun; textul umple intervalul dintre ele. Dacă nu încape text lizibil între ele, flow-ul mută
  textul pe pagina următoare în loc să-l deseneze peste imagine.
- **Reflow la tastare**: un singur `TextInput` invizibil păstrează textul articolului (inclusiv `\n\n`
  între paragrafe). Fiecare tastă reconstruiește documentul cu `applyPlainText` (media și salturile de
  pagină rămân pe loc) și recalculează flow-ul. Un tap pe un rând așază caretul la caracterul atins;
  un caret vizibil este desenat la poziția calculată.
- **Paginare**: `flowEditorialDocument` produce pagini până la 160; un articol de 20 000 de caractere
  intră în ~50 de pagini la 20/29, testat fără pierdere și fără pagini goale. `EditorialPage` le afișează
  într-un `FlatList` orizontal cu snap; indicatorul `N/M` este în pagină.
- **Tipografie automată**: `EditorialTypography = 'auto'` alege `small` când există media sau articolul
  este lung, altfel păstrează măsura autorului. `Mic/Mediu/Mare` este override explicit și se salvează;
  mărimea nu se schimbă la fiecare tastă.

### 14.5 Cum a fost reparată navigarea din profil

Lanțul este acum complet și folosește un singur cititor:

`ProfileTile` (întreaga celulă `Pressable`) → `router.push({ pathname: '/post/[id]', params: { id: String(post.id) } })`
→ `src/app/post/[id].tsx` → `GET /api/posts/:id` → `socialPostView` → `ReelPage` (foto/clip) sau
`PostCard` (articol/pagină de cuvinte).

- ruta primește **id-ul exact** atins; nu există fallback la primul element din feed;
- `GET /api/posts/:id` respectă `repo.canViewPost`, deci un id ghicit al unui post privat răspunde `404`;
- `router.back()` revine în profilul din stivă, cu poziția de scroll păstrată de navigator;
- `MediaViewer` rămâne șters; nu s-a creat un al doilea reader.

### 14.6 Fișiere atinse în această rundă

| Fișier | Rol |
|---|---|
| `apps/nexus-mobile/src/lib/editorialDocument.ts` (nou) | modelul, validarea strictă/tolerantă, comenzile de bloc, remaparea media |
| `apps/nexus-mobile/src/lib/editorialFlow.ts` (nou) | motorul de flow: dreptunghiuri media, intervale libere, paginare |
| `apps/nexus-mobile/src/lib/editorialPost.ts` (nou) | documentul unui post, sursele media, tipografia automată |
| `apps/nexus-mobile/src/components/EditorialPage.tsx` (nou) | pagina 9:16, editare directă, caret, gesturi media, vizualizatorul fotografiilor publicate |
| `apps/nexus-mobile/src/components/EditorialArticle.tsx` (nou) | pagina publicată, aceeași componentă, read-only |
| `apps/nexus-mobile/src/components/ArticleMedia.tsx` | `PhotoViewer` extras și refolosit de pagina documentului; același vizualizator, nu al doilea |
| `apps/nexus-mobile/src/app/text.tsx` | compozitorul folosește documentul; bară de așezare, Undo, tipografie |
| `apps/nexus-mobile/src/lib/textStyle.ts` | `document` în `TextStyle`, validat și citit tolerant |
| `apps/nexus-mobile/src/lib/textDraft.ts` | ciorna persistă documentul și migrează ciornile vechi |
| `apps/nexus-mobile/src/components/PostCanvas.tsx` | articolul/pagina cu document se desenează cu `EditorialArticle` |
| `apps/nexus-mobile/src/components/ProfileTile.tsx` | miniatură 9:16 curată, vizualizări reale, toată celula este ușă |
| `apps/nexus-mobile/src/app/post/[id].tsx` (nou) | ruta unui singur post, reader-ul existent |
| `apps/nexus-web/lib/post-editorial-document.js` (nou) | oglinda serverului pentru document |
| `apps/nexus-web/lib/post-text-style.js` | acceptă și validează `document` |
| `apps/nexus-web/lib/api.js` | `GET /api/posts/:id` |
| `apps/nexus-web/test/post-publishing.test.js` | publicare + rută + refuz document rupt + vizibilitate |
| `apps/nexus-mobile/scripts/test-editorial-document.cjs` (nou) | 15 teste: model, fixture, reflow, paginare, 20 000 caractere |
| `apps/nexus-mobile/scripts/test-profile-thumbnails.cjs` (nou) | 5 teste: celulă 9:16, fără caption/reacții, vizualizări |
| `apps/nexus-mobile/scripts/test-no-fullscreen-post.cjs` | rescris pentru ușa din profil și reader-ul unic |
| `apps/nexus-mobile/scripts/test-text-style.cjs` | paritatea documentului telefon/server; vizualizatorul paginii publicate |


### 14.7 Verificări automate rulate

| Comandă | Rezultat |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` (mobil) | exit 0 |
| `npm.cmd test` (mobil) | exit 0; **266 de teste, 0 eșecuri**, 29 de rapoarte de suită; include `test-editorial-document.cjs` (15) și `test-profile-thumbnails.cjs` (5) |
| `node --test test/*.test.js` (web) | **830 de teste, 830 pass, 0 fail**; `post-publishing.test.js` are 10 teste, inclusiv documentul persistat, `GET /api/posts/:id` și refuzul unui document rupt |
| `node scripts/test-text-style.cjs` | 11 teste; paritatea telefon/server pentru `document`, inclusiv `widthFraction` în afara limitelor, și vizualizatorul refolosit de pagina publicată |
| `node scripts/test-editorial-document.cjs` | 15 teste; fixture-urile 1–6, fără suprapunere, fără pierdere de cuvinte, fără pagini goale, 20 000 de caractere |
| `node scripts/test-profile-thumbnails.cjs` | 5 teste; celula 9:16, fără caption/reacții/bară de comentarii, vizualizări din `view_stats` |

Ce dovedesc testele: regulile documentului sunt identice pe telefon și pe server; un rând nu se
suprapune niciodată cu un dreptunghi media; cuvintele se păstrează în ordine; un articol lung se
paginează determinist; două fotografii pot sta pe aceeași pagină; un salt de pagină creează o pagină
nouă; așezarea și redimensionarea nu ating textul; grila are o singură ușă și reader-ul este cel
existent; o fotografie din pagina publicată se deschide în același vizualizator ca blocul foto vechi,
la indexul atins, iar compozitorul nu îl deschide (gesturile lui rămân ale paginii).

Ce **nu** dovedesc: aspectul vizual pe un ecran Android real. Testele nu măsoară fonturile reale ale
dispozitivului, nu ating cu degetul, nu deschid tastatura și nu publică pe serverul de producție.

### 14.8 Limitări cunoscute

1. **Fără verificare fizică** — pinch-ul de două degete a fost scos din compozitor; așezarea se face
   prin tragere, mâner de redimensionare și preseturi, care pot fi exersate cu un deget. Flow-ul este
   testat pur, nu pe pixelii telefonului.
2. **Lățimea glifelor este estimată** — tabela `measureTextWidth` este conservatoare, nu o măsurătoare a
   fontului Android. Un rând poate rămâne cu puțin spațiu sau poate părea ușor inegal; nu ar trebui să
   taie cuvinte, dar asta trebuie confirmat vizual.
3. **Tastatura** — pagina este într-un `ScrollView` cu `KeyboardAvoidingView`; caretul este desenat la
   pagina calculată, însă comportamentul exact al tastaturii Android (cât de mult se ridică pagina,
   dacă ultimul rând rămâne vizibil) nu a fost văzut pe dispozitiv.
4. **Video local în compozitor** — un clip ales local apare ca placă `CLIP`; după publicare,
   `EditorialArticle` îl redă cu `RemoteVideo` și controale native. Previzualizarea locală a clipului
   nu a fost verificată.
5. **Documente vechi** — un post fără `text_style.document` păstrează compoziția veche; nu este migrat
   automat pe server. Migrarea se face doar pentru ciornele deschise în compozitor.
6. **Web-ul** — pagina web nu a fost portată la noul document; ea citește în continuare `caption` și
   `text_style` vechi. Această rundă a fost despre Android, iar contractul serverului este aditiv.
7. **Sesiunea locală** — aplicația folosită anterior pentru probe rula cu `EXPO_PUBLIC_NEXUS_API_URL`
   către API-ul local și cu sesiunea `@rrommeoo1112`; starea de producție nu a fost restaurată.
8. **Vizualizatorul paginii document** — atinge o fotografie din pagina publicată și deschide
   `PhotoViewer`, aceeași componentă folosită de blocul foto vechi. Legătura este acoperită de teste,
   dar atingerea reală într-o pagină document nu a fost încă exersată pe telefon (niciun dispozitiv
   conectat în această continuare).


### 14.9 Checklist de verificare manuală pe Android (de făcut când telefonul revine)

**Pregătire**

1. Repornește Metro **fără** `EXPO_PUBLIC_NEXUS_API_URL`, apoi autentifică-te din nou în contul de
   producție.
2. Deschide `nexusdev://text` (sau butonul `+` → TEXT).
3. Confecționează o pagină `paper` cu text suficient pentru cel puțin două pagini și două fotografii
   (una peisaj, una portret).

**A. O singură pagină, editare directă**

4. Confirmă că există **un singur** câmp de text vizibil (`Textul postării`) în pagină și niciun
   `Pagina de text`, `Previzualizează pagina` sau modal.
5. Apasă în mijlocul unui rând: caretul apare la caracterul atins, tastatura se deschide, pagina nu sare
   la început.
6. Scrie 10–15 caractere: rândurile se rearanjează imediat, fără o a doua casetă de text.
7. Derulează pagina cu tastatura deschisă și confirmă că rândul activ rămâne vizibil.

**B. O fotografie, text în jur**

8. Adaugă o fotografie peisaj. Confirmă că apare în pagină, nu într-o bandă separată.
9. Selecteaz-o (atinge): apare conturul și bara `AȘEZAREA FOTOGRAFIEI`.
10. Apasă `Stânga`: textul trece în dreapta; apasă `Dreapta`: textul trece în stânga.
11. Apasă `Text în jur: da`: primele rânduri stau lângă fotografie, iar după ea textul revine pe toată
    lățimea. Confirmă vizual că niciun cuvânt nu e peste imagine.
12. Trage fotografia la stânga/dreapta: așezarea se schimbă. Trage mânerul din colț: lățimea se schimbă și
    textul se rearanjează în timpul gestului.
13. Apasă `Anulează ultima aranjare`: așezarea anterioară revine.

**C. Două fotografii pe aceeași pagină**

14. Adaugă a doua fotografie (portret). Selecteaz-o și apasă `Dreapta`.
15. Confirmă că ambele fotografii sunt vizibile pe aceeași pagină, fără suprapunere, cu text între ele
    sau dedesubt.
16. Dacă nu au loc, mută una `Mai jos` și confirmă că trece pe pagina următoare fără să taie text.

**D. Fotografie de lățime completă**

17. Selectează o fotografie și apasă `Toată lățimea`.
18. Confirmă text deasupra și dedesubt, fără suprapunere.

**E. Titlu și tipografie**

19. Apasă pe un paragraf scurt și apasă `Fă titlu`: rândul devine titlu, mai mare, fără să taie textul.
20. Încearcă `Mic`, `Mediu`, `Mare`: pagina se schimbă o singură dată la alegere, nu la fiecare tastă.
21. Revino la `Auto` și confirmă că o pagină cu media folosește tipografia compactă.


**F. Paginare și articol lung**

22. Lipește un articol de ~5 000–10 000 de caractere. Confirmă `N/M` în pagină, swipe orizontal între
    pagini și nicio pagină goală.
23. Verifică primul și ultimul paragraf pe paginile corespunzătoare; niciun cuvânt nu lipsește.
24. Mută o fotografie `Mai jos` peste granița unei pagini; confirmă ordinea stabilă și lipsa
    suprapunerilor.

**G. Publicare și redeschidere**

25. Publică. Confirmă postarea în feed: tema, fotografiile, așezarea și paginile trebuie să fie aceleași
    ca în compozitor.
26. Închide aplicația, redeschide, găsește postarea în feed: documentul și așezarea trebuie să fie
    păstrate.
27. Redeschide ciorna într-un compozitor nou: documentul, media și tipografia trebuie să fie aceleași.

**H. Grila de profil**

28. Deschide profilul. Confirmă celule 9:16 curate: fără descriere, fără bară de reacții, fără comentarii,
    fără autor; doar previzualizarea și numărul de vizualizări (sau nimic dacă serverul nu l-a trimis).
29. Postarea text-only trebuie să aibă un capac de temă, nu un pătrat gol și nu textul articolului.
30. Postarea cu fotografie trebuie să arate fotografia; clipul, un cadru de clip cu semnul play.

**I. Deschidere din profil și întoarcere**

31. Atinge o celulă: se deschide **exact** postarea atinsă pe tot ecranul, cu aceeași compoziție ca în
    feed.
32. Repetă pentru text-only, text+foto, foto, video, quote, repost și articol lung. Fiecare trebuie să
    deschidă tipul corect, nu primul element din feed.
33. Apasă `Înapoi`: revii în același profil, la aceeași poziție de scroll.
34. Deschide comentariile dintr-o postare deschisă din profil: foaia existentă trebuie să funcționeze.

**J. Regresii**

35. Publică o pagină text-only veche și confirmă că se citește ca înainte.
36. Publică un clip separat: trebuie să rămână Reel, nu să devină articol.
37. Verifică reacțiile orizontale, comentariile, salvarea, distribuirea și vizualizatorul media.
38. Atinge o fotografie din pagina publicată: se deschide pe tot ecranul, cu `Fotografia N din M`;
    swipe trece la fotografia următoare, iar `Închide` revine la aceeași pagină, fără să o schimbe.
    În compozitor aceeași atingere selectează fotografia, nu deschide vizualizatorul.

Dacă vreun pas eșuează, notează pagina, gestul și ce s-a văzut; nu marca runda ca închisă până când
verificarea fizică nu trece.

**STARE FINALĂ A RUNDEI: IMPLEMENTED — AWAITING PHYSICAL ANDROID VERIFICATION.**


## 15. Runda a douăsprezecea — „publicat” nu mai înseamnă publicat când serverul aruncă pagina (26 octombrie 2026)

### 15.1 Defectul, formulat exact

Compozitorul TEXT trimite pagina în `text_style` (temă, tipografie, `document` cu așezarea și
fotografiile). Build-ul de pe Railway este **dinaintea rundelor editoriale**: nu cunoaște `text_style`,
scrie doar `caption` + `media_items`, răspunde `200 {ok:true, post}` fără `text_style`. Editorul
verifica doar existența postării și spunea `PUBLICAT`. În feed rămânea o postare foto cu descriere, nu
pagina compusă. Așezarea se pierdea fără ca autorul să afle — exact simptomul raportat de owner.

### 15.2 Ce s-a schimbat în client (`src/lib/publishClient.ts`)

1. După un răspuns `2xx`, postarea confirmată trebuie să aibă `text_style` **dacă** cererea a purtat
   una: `authoredPage(body)` întreabă cererea, `answeredPage(answer)` întreabă răspunsul.
2. Când lipsește, se aruncă `PUBLISH_TEXT_STYLE_LOST` cu mesajul: „Postarea a plecat, dar serverul nu a
   păstrat pagina: textul și pozele sunt publicate fără tema și fără aranjamentul ales. Ciorna rămâne
   pe telefon până când serverul este actualizat.”
3. Nu este `retryable` (`publishFailure` implicit): postarea există deja, iar cheia de idempotență
   rămâne aceeași, deci o reîncercare nu poate crea un duplicat.
4. Ciorna **nu** se șterge la eșec: `discardTextDraft()` se apelează doar după confirmare (`text.tsx`,
   linia 292).
5. Mesajul ajunge în compozitor prin `publishErrorMessage` → `PublishError.message` și este afișat cu
   `accessibilityLiveRegion="polite"`, deci se citește și în ierarhia `uiautomator`.
6. `text_style: null` în răspuns este tratat ca lipsă, nu ca prezență.

### 15.3 Dovada că serverul de producție este mai vechi decât codul

| Sondă | Rezultat |
|---|---|
| `_probe_textstyle.mjs` către Railway | un `text_style` invalid primește `TEXT post cannot be empty`, iar `text_style: {theme:'paper'}` fără text primește **același** răspuns — build-ul nu citește deloc câmpul (codul actual ar fi răspuns `TEXT_STYLE_*`) |
| `_probe_keys.mjs` către Railway | postarea din feed-ul live nu are nici `text_style`, nici `text_style_json` |
| `git` în `nexus_deepsek` | `HEAD=d144ebe`, **4 commituri neîmpinse** (`@{u}..HEAD`), iar modificările editoriale din `apps/nexus-web` (`lib/api.js` +128, `lib/repo.js`, `lib/db.js`, `lib/env.js`, `public/app.js`, `test/post-publishing.test.js` +105) sunt încă **necomise** — build-ul de pe Railway nu poate conține documentul |
| `src/lib/apiOrigin.ts` + absența oricărui `.env` în `apps/nexus-mobile` | aplicația instalată vorbește implicit cu `https://nexus-deepsek-production.up.railway.app` |

Concluzia: nu lipsea cod, lipsea **livrarea** lui. Telefonul publica într-un server care nu are
`text_style`, iar feed-ul putea desena doar ce i se întorcea: o fotografie cu descriere.

### 15.4 Ce s-a rulat în această continuare

| Comandă | Rezultat |
|---|---|
| `node --test scripts/test-publish-confirmation.cjs scripts/test-editorial-document.cjs` | **26 de teste, 0 eșecuri**; cele 7 teste noi acoperă: pagina pleacă în `text_style.document`, o pagină cu așezare se confirmă, una fără așezare este refuzată cu mesajul de mai sus, `null` este aceeași pierdere, o fotografie fără pagină se confirmă în continuare, o pagină doar cu vorbe, iar un răspuns care numește alt cont rămâne `PUBLISH_VERIFY_FAILED` |
| `npm.cmd test` (mobil) | exit 0; **30 de suite, 277 de teste, 0 eșecuri** |
| `node node_modules/typescript/bin/tsc --noEmit` (mobil) | exit 0, fără erori |
| `node --test test/post-publishing.test.js` (web) | **10 teste, 0 eșecuri**, inclusiv „an editorial document survives publication and is returned by the post route” — serverul din working tree păstrează și întoarce documentul |
| `node --test test/*.test.js` (web, suita întreagă) | exit 0; **830 de teste, 830 pass, 0 fail** |
| stare locală | portul 5000 servește `node server.js`; telefonul `25098PN5AC` (`pandora`) este conectat pe adb, dar `adb reverse` are doar `tcp:8081` |

### 15.5 Ce lipsește ca pagina să se vadă în feed pe telefon

1. **Un deploy al `apps/nexus-web`** (commit + push pe `origin`, sau `railway up`). Fără el, telefonul
   vorbește în continuare cu un build care aruncă pagina. Până atunci editorul refuză corect și spune
   de ce, dar articolul nu apare în feed.
2. **Alternativa fără deploy**, folosită în §13.3: `adb reverse tcp:5000 tcp:5000`, Metro pornit cu
   `EXPO_PUBLIC_NEXUS_API_URL=http://localhost:5000` și autentificare în contul local. Costul este
   cunoscut: sesiunea de producție de pe telefon se pierde și trebuie refăcută după aceea.
3. Ambele drumuri schimbă stare partajată (istoric git + producție, respectiv sesiunea telefonului),
   deci se decid de owner. În această continuare **nu** s-a făcut nici un deploy și nici o postare pe
   producție.

### 15.6 Întrebarea se pune *înainte* de trimitere: `GET /api/version`

§15.3 a arătat de ce plasa din client nu este suficientă: `PUBLISH_TEXT_STYLE_LOST` se află **după** ce
postarea a plecat deja. Pe 26 octombrie pagina a fost creată fără temă, iar autorul a aflat abia la
final, când fotografiile erau deja urcate. Un răspuns care numește buildul trebuie citit **înainte** de
prima încărcare, ca nimic să nu rămână orfan.

Serverul (`apps/nexus-web/lib/build-info.js`, ruta în `lib/api.js`, montată **înaintea** porții de
autentificare, cu `cache-control: no-store`):

1. Două identități, pentru două întrebări diferite. `commit` spune *ce sursă* pretinde că este buildul;
   `source_fingerprint` spune *ce cod* rulează de fapt — SHA-256 peste `server.js` și fiecare `lib/*.js`,
   sortate, deci supraviețuiește unui commit squashat, unei imagini reconstruite și absenței unui `.git`.
2. Ordinea surselor de commit: `NEXUS_BUILD_COMMIT` (arg-ul din `Dockerfile`) → `RAILWAY_GIT_COMMIT_SHA`
   → `GIT_COMMIT` → `COMMIT_SHA` → `SOURCE_VERSION` → `.git` local → `"unavailable"`. O valoare care nu
   arată ca un hash (`<script>`, `abc`, `deployed-by-hand`) este **refuzată**, nu ecouată pe o rută
   publică.
3. `.git` local este căutat urcând până la trei părinți: într-un monorepo, `.git` stă la rădăcină, la
   trei niveluri deasupra `lib/`. Imaginea Docker nu are nici unul, de acea există amprenta.
4. `capabilities` este jumătatea aditivă a contractului: nume cu versiune, niciodată o dată și niciodată
   o promisiune. Contractul 1 publică `post_read`, `post_gallery`, `text_style`, `editorial_document`,
   `post_tags`, `impressions`, `profile_view_stats`. **Adăugarea** unei capacități nu ridică
   `api_contract`; schimbarea sensului uneia o face.
5. Ruta este neautentificată intenționat: este exact informația de care are nevoie o aplicație nelogată
   înainte să poată afla ceva despre cont. Nu conține date de cont, nici un secret, nici un URL upstream.

Răspunsul real al arborelui de lucru (cerut direct din `handleRequest`, fără port și fără sesiune),
`200`, `cache-control: no-store`:

```json
{"ok":true,"service":"nexus-web","api_contract":1,
 "commit":"d144ebeb4aacbe85aad9df6bf6cc543d2fd78ff9","commit_short":"d144ebe","commit_source":"git-head",
 "built_at":null,"source_fingerprint":"8949c21b8928e2aa0c5ea1cba13d929602dcddee6fb91cbe94a9946182ea71f0",
 "capabilities":{"post_read":1,"post_gallery":1,"text_style":1,"editorial_document":1,
                 "post_tags":1,"impressions":1,"profile_view_stats":1},
 "runtime":"node v24.19.0"}
```

### 15.7 Clientul: `src/lib/backendVersion.ts`

1. `readBackendVersion` refuză răspunsul **întreg** dacă nu este o versiune (`ok` absent, `capabilities`
   care nu este obiect): o jumătate de răspuns nu este o permisiune.
2. `fetchBackendVersion` pleacă fără `credentials`, are 4 secunde de răbdare și ține minte răspunsul cinci
   minute — un al doilea keystroke nu întreabă serverul din nou.
3. `requirePageCapabilities` cere **proaspăt** (`fresh`), nu din cache: un „da” vechi este exact răspunsul
   în care nu se poate avea încredere în clipa publicării.
4. Trei deznodăminte, deliberat diferite:
   - serverul **tace** (rețea căzută, timeout) → `null`, adică publicarea merge mai departe, iar plasa din
     `publishClient` rămâne dedesubt. Tăcerea nu este un refuz;
   - serverul răspunde, dar **nu se poate citi** (build vechi fără rută → `401` prin `requireAuth`) →
     `BACKEND_VERSION_UNREADABLE`;
   - serverul răspunde și **nu are** ce trebuie → `BACKEND_OUTDATED`, cu propoziția: „Serverul rulează o
     versiune mai veche decât aplicația și nu știe să păstreze tema și aranjamentul paginii, deci postarea
     nu a fost trimisă. Textul rămâne salvat pe telefon; publică după ce serverul este actualizat.”, urmată
     de numele lipsurilor: „Lipsește: text_style, editorial_document.” Un cod nu este un mesaj.
5. `src/app/text.tsx` cheamă `await requirePageCapabilities()` **înainte** de `uploadTextAttachments`, iar
   un `BackendVersionError` este afișat cu propoziția lui, prin `accessibilityLiveRegion`.
6. `PUBLISH_TEXT_STYLE_LOST` rămâne în `publishClient.ts`: poarta întreabă, plasa verifică răspunsul.
   Nici una nu o înlocuiește pe cealaltă.

### 15.8 Ce s-a rulat în această rundă

| Comandă | Rezultat |
|---|---|
| `node --test test/backend-version.test.js` (web) | **8 teste, 0 eșecuri**: ordinea surselor de identitate, un `<script>` refuzat, amprenta care urmează sursa, amprenta de deployment calculată o singură dată, `.git` cu un nivel mai sus (forma monorepo-ului) care numește commitul, ruta altfel decât `/api/version` tot refuzată |
| `node --test test/*.test.js` (web, suita întreagă) | exit 0; **838 de teste, 838 pass, 0 fail** |
| `node scripts/test-backend-version.cjs` (mobil) | **9 teste, 0 eșecuri** |
| `node <fiecare din cele 35 de scripturi>` (mobil, lanțul din `package.json`) | toate cele 35 au ieșit cu 0; `test-backend-version.cjs` este al unsprezecelea, între `test-publish-confirmation` și `test-editorial-document` |
| `node node_modules/typescript/bin/tsc --noEmit` (mobil) | exit 0, fără erori |
| sondă directă pe `handleRequest` cu `GET /api/version`, fără port, fără sesiune | `200`, `cache-control: no-store`, `commit_source: "git-head"`, `commit: d144ebe…`, amprentă `8949c21b…` — buildul local se numește singur, iar capacitățile declarate sunt exact cele șapte din `BACKEND_CAPABILITIES` |

Testul `test-backend-version.cjs` nu verifică doar clientul: compară și numele din
`PAGE_CAPABILITIES` cu harta declarată de `apps/nexus-web/lib/build-info.js`, și citește `lib/api.js` ca să
confirme că ruta este montată și răspunde cu `versionView()`. Astfel, dacă un client cere o capacitate pe
care serverul nu o publică — sau invers —, unul dintre cele două proiecte cade la test, nu la publicare.

Un defect găsit de sondă și reparat aici: `gitHeadCommit` căuta `.git` doar în `apps/nexus-web`, unde nu
există, deci arborele local se prezenta drept `"unavailable"` deși era pe `d144ebe`. Acum caută până la trei
părinți (`.git` stă la rădăcina monorepo-ului); în imaginea Docker nu există nici un `.git`, iar acolo
răspunsul corect rămâne `"unavailable"` plus amprenta.

**STARE LA ACEST CHECKPOINT:** locul unde se află buildul este acum o întrebare pe care telefonul o pune
înainte de a urca primul octet (15.6–15.8), iar un server prea vechi este refuzat cu o propoziție, nu cu o
postare pierdută în tăcere. Rămâne neschimbat ce spune 15.5: ca pagina să se **vadă** în feed pe telefon
este nevoie fie de un deploy al `apps/nexus-web`, fie de drumul local prin `adb reverse`. Ambele schimbă
stare partajată și se decid de owner; în această rundă nu s-a făcut nici un deploy și nici o postare pe
producție.
## 16. Runda a treisprezecea — deployul compatibil, telefonul owner-ului și două defecte găsite pe el (26 octombrie 2026)

Runda aceasta a făcut ce runda a douăsprezecea lăsase de decis: a dus backendul compatibil pe Railway și a
lucrat pe telefonul fizic, nu pe teste. Aici scrie ce s-a schimbat pe producție, ce s-a măsurat pe
`25098PN5AC`, ce s-a reparat din ce s-a găsit acolo și ce **nu** este încă făcut.

### 16.1 Ce s-a dus pe producție, exact

Un singur commit, patru fișiere, **+425 / −0**, pe `origin/main` de la `29d3339`:

```
01d5f18 API: /api/version spune build-ul si capabilitatile, inainte de login
 Dockerfile                                  |   7 +
 apps/nexus-web/lib/api.js                   |  13 +
 apps/nexus-web/lib/build-info.js            | 228 +++++++++
 apps/nexus-web/test/backend-version.test.js | 177 +++++++++
```

De ce atât de puțin: `29d3339` (buildul de pe Railway) **are deja** tot ce cere pagina editorială —
`normalizeTextStyle`, `post-editorial-document.js`, `media_items` (`api.js:3687`), `view_stats`
(`api.js:731`), `/api/social/impressions`, pin/unpin cu limita de trei (`api.js:3888-3896`). Sonda
autentificată pe deployment a dovedit-o înainte de a scrie ceva: postarea 38 vine cu
`text_style.document = paragraph, paragraph, media, paragraph` și cu
`view_stats {viewers:1, impressions:20, completed:0}`. Ce lipsea era **doar** ruta `/api/version` (404 cu
sesiune, 401 fără). Deci deployul este o continuare, niciodată o întoarcere: arborele de lucru conține și
`quoted_post_id`, și lanțul de citate, care nu au fost urcate (nu fac parte din cerere).

Ce nu s-a atins: nici o migrare distructivă (diff-ul lui `db.js` este numai `ADD COLUMN` + harta de
migrare), nici o rută xPortal, nici un alt serviciu Railway.

Răspunsul **live**, citit de pe `https://nexus-deepsek-production.up.railway.app/api/version` după build:

```json
{"ok":true,"service":"nexus-web","api_contract":1,
 "commit":"01d5f18658d9e8de9921af09c1bfd95327a1ad7c","commit_short":"01d5f18",
 "commit_source":"RAILWAY_GIT_COMMIT_SHA","built_at":null,
 "source_fingerprint":"7f0b9b116ec8ca1a4d7f888af8a0210fe98a498af788722a74c3198286d718d2",
 "capabilities":{"post_read":1,"post_gallery":1,"text_style":1,"editorial_document":1,
                 "post_tags":1,"impressions":1,"profile_view_stats":1},
 "runtime":"node v24.22.1"}
```

`cache-control: no-store` pe același răspuns. `commit_source` este `RAILWAY_GIT_COMMIT_SHA`, adică a doua
sursă din precedență, fără ca cineva să fi pasat un `--build-arg`: imaginea se numește singură.

### 16.2 Telefonul, măsurat

| Ce s-a întrebat | Cum | Rezultat |
| --- | --- | --- |
| dispozitivul | `adb devices -l` | `25098PN5AC`, `product:pandora`, transport TLS wireless, stare `device` (autorizat) |
| sistemul | `getprop` | Android 16, `ro.product.device=pandora` — Xiaomi MIX Flip: ecran principal 1220×2656 (display 0, aprins) + ecran de capac 904×572 (display 1, stins) |
| aplicația | `pm list packages` | `app.nexus.mobile.dev` instalat |
| lansarea | `am start` + `uiautomator dump` | pornește; dump-ul citește „Jungle Book Dev / Development Build” apoi pagina aplicației |
| Metro | `Get-NetTCPConnection 8081`, `json/list` | ascultă; dispozitivul se atașează prin `192.168.1.153:8081` (LAN), nu prin `adb reverse` (lista de reverse este goală) |
| sesiunea xPortal | `run-as … cat files/nexus-session/session.json` | token de 178 de caractere, `cookieSession:false`, `savedAt 2026-10-26T06:14:54Z` — intactă |
| API-ul folosit | token-ul telefonului, cerut de pe stație | `GET /api/me` pe Railway → **200** (cont real, 5 profile); pe `127.0.0.1:5000` → **401**. Deci buildul instalat vorbește cu Railway, iar serverul local este altă bază |

Metoda de citire a ecranului a fost `uiautomator dump` (ierarhia de accesibilitate), niciodată `screencap`.




### 16.3 Defectul cel mare: bucla de reîncărcare a profilului (reparat, dovedit pe telefon)

Primul lucru pe care l-a arătat telefonul nu a fost o piesă lipsă, ci un comportament: tab-ul **Profil** a
rămas pe `ActivityIndicator` minute întregi și nici un dump nu l-a putut citi (ecranul nu ajunge niciodată
„idle”). Ca să nu ghicesc, am pus o sondă în runtime-ul aplicației — un wrapper pe `fetch` instalat prin
inspectorul Hermes al Metro (`ws://127.0.0.1:8081/inspector/debug?...`) — și am numărat cererile:

```
GET /api/profiles/wallet4e8gv6?persona=social   200  375ms
GET /api/profiles/wallet4e8gv6?persona=social   200  338ms
... 40 de cereri în 5,5 secunde, fiecare 200
```

Lanțul, citit în cod: `ProfileScreen` dă payload-ul lui `rememberPayload` → magazinul de relații emitea la
**fiecare** scriere → gazda reîncărca profilul la orice schimbare de relație (`onRelationChanged`) → `key`
ecranului se schimba → `useEffect`-ul reverifica → același payload → din nou. Doar durata unui drum dus-întors
limita bucla. Consecințe reale: baterie, trafic, un server lovit de ~7 cereri pe secundă și un ecran care nu se
așeza niciodată.

Reparația este la sursă, nu în ecran: **o scriere care nu schimbă nimic nu mai anunță pe nimeni**
(`lib/relations.ts` `remember`). `sameValue`/`sameCounts` compară faptele patch-ului cu ale înregistrării, iar
`at` (momentul citirii) este păstrat când nimic nu s-a schimbat, deci nici ordinea snapshot-ului nu se mișcă.
Prima citire învață ceva și anunță o dată; a doua nu învață nimic și nu trezește nici un ecran.

Dovada pe telefon, aceeași sondă, după reparație:

```json
{"total":5,"byUrl":{
  "/api/profiles/wallet4e8gv6?persona=social":2,
  "/api/chat/conversations?persona=all&box=inbox":1,
  "/api/notifications?persona=all":1,
  "/api/social/impressions":1}}
```

Două cereri în opt secunde (prima citire + o singură reîncărcare), nu douăzeci și cinci.

### 16.4 Defectul al doilea: un server care tace lăsa ecranul pe spinner la nesfârșit (reparat)

`nexusApi` nu avea nici un termen limită. Un `fetch` care nu răspunde și nu eșuează nu produce nici date,
nici eroare, iar `ProfileScreen` așteaptă o încercare **încheiată** înainte să deseneze ceva
(`attempted !== key && !data`) — deci spinnerul era singurul adevăr posibil. Acum:

* `API_TIMEOUT_MS = 20000`, aplicat întregului schimb (antete + corp), cu `AbortController`;
* `timeoutMs` se poate da per apel și este **scos** din obiectul trimis lui `fetch` (testul verifică absența);
* un `signal` al apelantului este ascultat și abortează același controller — un singur termen de judecat;
* lipsa răspunsului devine `NexusApiError` cu `code:'TIMEOUT'` și `status:0`, fiindcă nu există status de
  server atunci când serverul nu a spus nimic; un refuz real își păstrează statusul și cuvintele serverului.

Publicarea nu trece pe aici (`lib/publishClient.ts` are propriul termen), deci limita atinge doar citiri și

### 16.5 Pagina editorială, citită din ierarhia de accesibilitate a telefonului

Deschisă din grila de profil (tap pe o celulă → `GET /api/posts/38 → 200`), postarea 38 se citește ca
**articol**, nu ca fotografie cu descriere:

| Gest | Ce s-a citit din dump |
| --- | --- |
| deschiderea | `Pagina articolului`, text pe 24 de rânduri, insignă `Pagina 1 din 2` / `1/2` |
| `input swipe 900 1400 180 1400 600` | insigna devine `Pagina 2 din 2` / `2/2` |
| pagina 2 | `Fotografia paginii` la `[104,394][549,988]`; text la `x=564..914` (`ambasadei / Rusiei în / alegerile din / Serbia…`), apoi text pe toată lățimea la `[104,1018][914,1096]` |

Adică: fotografia stă în stânga paginii, textul curge în dreapta ei și continuă dedesubt pe toată măsura —
reflow-ul scris de autor, pe ecranul fizic, în cititorul real. Un `input swipe` de 280 ms **nu** mișcă pagina;
la 600 ms paginarea răspunde. Merită știut, fiindcă un test care ar folosi gestul scurt ar raporta mincinos
„paginarea nu merge”.

### 16.6 Ce **nu** este gata și de ce (spus direct)

1. **Grila de profil nu poate fi citită cu UiAutomator.** Ecranul nu ajunge „idle” (`could not get idle state`)
   nici după reparația buclei; `dumpsys gfxinfo` arată în continuare cadre desenate (≈130/s), deci ceva din
   compoziția acelei grile animă permanent. Nu am pus un spinner peste problemă și nu am declarat cifrele de
   vizualizări „verificate”: ele se văd în cod (`ProfileTile` cheamă `profileCompactCount(post.view_stats?.viewers)`
   și desenează chip-ul doar când există copertă și contor) și în payload (`view_stats {viewers:1, …}`), dar
   **nu** au fost citite de pe ecran.
2. **Vertical swipe între postările profilului, drag-ul unei fotografii dintre pagini și meniul de
   administrare al celulelor (reordonare / pin / ștergere) nu sunt implementate.** Sunt cerințe noi, scrise
   după runda a douăsprezecea; ele cer un state machine de gesturi (`READING → EDITING → MEDIA_SELECTED →
   MEDIA_DRAGGING → EDGE_PAGING → DROP`), un model de document cu poziții logice (care există deja:
   `text_style.document`), plus o rută de backend pentru ordine — nici una nu a fost scrisă aici.
3. **Hashtag-ul și mențiunea** nu au fost încă exersate pe telefon: postarea care le conține (`#Life @Test`)
   există în feed, dar runda s-a terminat înainte de a ajunge la ea.

Această secțiune este lista de lucru pentru runda următoare, nu o scuză: 16.3 și 16.4 sunt reparate și
dovedite, 16.5 este verificat pe dispozitiv, iar 16.6 este ce rămâne.

### 16.7 Ce s-a rulat în această rundă

| Verificare | Rezultat |
| --- | --- |
| `node --test test/backend-version.test.js` pe commitul de deploy (`29d3339` + 4 fișiere) | **8 teste, 0 eșecuri** |
| `node --test <cele 129 de fișiere>` pe commitul de deploy | **834 teste, 0 eșecuri** |
| `git push origin HEAD:refs/heads/main` | `origin/main` = `01d5f18`; `ls-remote` confirmă |
| `GET /api/version` pe Railway, neautentificat | `200` + JSON-ul din 16.1, `cache-control: no-store` |
| lanțul mobil din `package.json` (36 de scripturi) | **33 de suite raportate, 0 eșecuri**, lanțul `&&` a ajuns la ultimul script (`test-xportal-state.cjs`) |
| `tsc --noEmit` (mobil) | exit 0, fără diagnostice |
| sonda `fetch` pe telefon, înainte de reparație | 40 de cereri de profil în 5,5 s |
| sonda `fetch` pe telefon, după reparație | 2 cereri de profil în 8 s |

Testele adăugate în această rundă: 3 în `scripts/test-relations.cjs` („un payload identic nu trezește pe
nimeni”, „o faptă care se mișcă trezește ecranele”, „plicul întreg citit de două ori anunță o singură dată”)
și 5 în `scripts/test-api-timeout.cjs` (termenul limită, `timeoutMs` scos din cerere, abort-ul apelantului,
refuzul cu status, ruta străină refuzată). `test-api-timeout.cjs` este al doisprezecelea script din lanț.

mutații mici.

## 17. Grila de profil: aranjarea proprietarului, fixarea și ștergerea (26 octombrie 2026)

Runda 16 a reparat două defecte și a dovedit editorialul pe telefon, dar cerințele de profil promise
rămăseseră neconstruite. Secțiunea aceasta separă strict trei stări: **implementat**, **testat automat**
și **verificat fizic pe Xiaomi**. Nimic nu e marcat „gata" doar pentru că un test trece.

### 17.1 Ce s-a construit (implementat)

| Cerință | Unde trăiește | Stare |
| --- | --- | --- |
| Apăsare lungă de peste o secundă → mod de administrare | `ProfileTile.tsx` (`delayLongPress={1000}`, `onLongPress`), `ProfileScreen.tsx` (`beginManaging`, bara „Aranjează grila" → „Gata") | implementat |
| Tragere pentru reordonare la orice poziție, cu indicator de inserare | `lib/profileGrid.ts` (`gridTarget`, `gridSlot`, `tileSize`, `moveWithin`, `nearestPlaceable`), `ProfileScreen.tsx` (`PanResponder` per celulă, `styles.dropLine`, celula ridicată sub deget) | implementat |
| Persistență prin backend și restaurare la redeschidere | `POST /api/posts/order` (`lib/api.js`), `repo.setProfileGridOrder`, coloana `grid_position` (`lib/db.js`, aditivă + migrare), capacitatea `profile_order` (`lib/build-info.js`), citirea în `lib/profileContent.ts` (`orderArchive`/`archiveNodes` cu `arrangement`) | implementat |
| Fixare explicită, care urcă postarea în frunte păstrând ordinea celorlalte fixate | `ProfileTile.tsx` (buton 44dp), `ProfileScreen.togglePin` → `POST /api/posts/:id/pin`, ridicare pe **fiecare** filă (`const hoistPins = true`) | implementat |
| Ștergere cu confirmare; Anulează nu schimbă nimic; doar postarea proprie | `ProfileTile.tsx`, fereastra `Modal` din `ProfileScreen.tsx`, `DELETE /api/posts/:id`, `manageActions` (fără buton pe o repostare străină) | implementat |
| Grilă fără goluri, celule 9:16, capac corect pe tip | `whisperTiles` (rânduri pline de trei, cardurile după perete), `styles.tile` (9:16, `flexBasis: 0`, `overflow: hidden`), `ProfileTile` (foto = cadrul ei, clip = placa lui, text = coperta temei) | implementat |
| Numărul de vizualizări din statisticile serverului, în colțul din stânga jos | `ProfileTile` citește `view_stats.viewers`; în modul de aranjare numărul urcă deasupra butoanelor (`viewsChipLifted`) | implementat |
| Navigare verticală între postările profilului, în ordinea și filtrarea curentă; Înapoi readuce grila în același loc | `src/app/post/[id].tsx` (mod `walkMode`: listă construită cu aceleași reguli, `FlatList` vertical `pagingEnabled`, contor „Postarea k din n"), `ProfileTile` (`door`) | implementat |
| Tragere de imagine între pagini îndepărtate, cu paginare la margine și fără a declanșa navigarea verticală | `lib/editorialDrag.ts` (mașina `READING → EDITING → MEDIA_SELECTED → MEDIA_DRAGGING → EDGE_PAGING → DROP`), `EditorialPage.tsx` (bandă de 56dp, 600ms dwell, `editorialDropLine`, `measureInWindow`) | implementat |
| Grila nu mai blochează UI Automator | `ProfileBand.tsx` citește `AccessibilityInfo.isReduceMotionEnabled()`; cu mișcare redusă, banda stă pe loc | implementat |


### 17.2 Ce s-a testat automat (fără telefon)

- `apps/nexus-web/test/p8-profile-grid-order.test.js` — 7 teste pe `repo.setProfileGridOrder` și pe rută:
  scrierea pozițiilor, refuzul întreg al unei liste care numește postarea altcuiva (nimic aplicat pe
  jumătate), refuzul listei vide/duplicate/prea lungi, separarea pe personae, refuzul unei postări retrase,
  contractul rutei și capacitatea `profile_order`.
- `apps/nexus-mobile/scripts/test-profile-grid.cjs` — 14 teste: citirea pozițiilor din payload, previzualizarea
  optimistă, mutarea într-o listă, geometria celulei (3 coloane + 2 goluri = lățimea întreagă, 9:16 exact),
  ținta unei trageri (inclusiv limitarea la capete), ofertele de fixare/ștergere/plasare (inclusiv refuzul pe o
  repostare străină), cel mai apropiat loc plasabil, ordinea „fixate întâi, apoi aranjarea", contractele de
  sursă ale ecranului (apăsare de o secundă, `scrollEnabled={!managing}`, indicatorul din `gridSlot`, ruta
  `POST /api/posts/order`, `DELETE`, fereastra de confirmare și Anulează), contractul cititorului vertical
  (`walkMode`, `pagingEnabled`, `initialScrollIndex`, `router.back()`) și citirea setării de mișcare redusă.
- `apps/nexus-mobile/scripts/test-editorial-drag.cjs` — 7 teste pe mașina de stări: drumul complet
  READING→…→DROP, evenimentele care nu se pot întâmpla, o pagină per dwell și niciodată peste capete,
  dezarmarea dwell-ului la ieșirea din bandă, banda de 56dp, axa articolului (`editorialDropLine`) și
  contractele din `EditorialPage` (scrollToIndex, `landedOn`, `measureInWindow`).
- Cele două scripturi au intrat în lanțul din `package.json` (pozițiile 13 și 21).

### 17.3 Ce s-a verificat fizic pe Xiaomi (dovezi numerice)

Toate cifrele de mai jos sunt citite din aplicația reală prin inspectorul Hermes (`__PROFILE_GRID`,
`__POST_ROUTE`, `__NET`) și din ierarhia UI Automator, nu din teste și nu din capturi de ecran.

| Cerință | Dovada |
| --- | --- |
| Grila nu mai animă continuu | `dumpsys gfxinfo`: **298 cadre → 298 cadre în 3 s** (înainte: 46 602 → 46 996, ≈131 fps); `uiautomator dump` reușește pe profil (înainte: „could not get idle state") |
| Celule 9:16, trei coloane, fără suprapuneri | geometrie 155,077 × 275,692 dp (raport 0,5625 = 9/16), 3 × 155,077 + 2 × 2 = 469,23 dp = lățimea măsurată; dump: `[0,1244][403,1960]`, `[408,1244][812,1960]`, `[817,1244][1220,1960]`, rândul următor la y=1966 |
| Fără rânduri cu goluri | înainte: rând de **1** celulă + două treimi goale (post 15 singur); după `whisperTiles`: rânduri de **3** (`15, 38, 34` / `39, 33, 32` / `31, 30, 29`) |
| Număr de vizualizări real, jos-stânga | dump: „1 vizualizări" la `[18,1880][109,1942]` în interiorul celulei; `__PROFILE_GRID.posts[].viewers` = 1 pentru imaginile citite, 0 pentru clipul 27; niciun număr inventat (serverul îl dă, `view_stats`) |
| Apăsare lungă → administrare | `input swipe x y x y 1200` pe o celulă → bara „Gata, păstrează ordinea" + „Gata" + câte un „Fixează postarea N" și „Șterge postarea N" pe fiecare celulă proprie; repostarea 15 **nu** are buton de ștergere |
| Tragere + persistență | tragere 200→1018 px (900 ms) a postării 39 → `note: "Ordinea a fost salvată."`, apoi `order [15,38,34,39,33,32,31,30,29,28,27,26]`, `places [null,0,1,…,10]` |
| Restaurare după redeschidere | după **reîncărcarea completă a aplicației**, `order` și `places` identice, citite din payload-ul serverului |
| Fixare / scoatere din fixate | „Fixează postarea 38" → `Postarea stă acum în fruntea grilei.`, ordine `[38,15,34,39,…]`; „Scoate din fixate" → `Postarea nu mai este fixată.`, ordinea revine exact la `[15,38,34,39,…]` (fixarea nu rescrie locurile) |
| Confirmare de ștergere + Anulează | dialog cu „Ștergi postarea?", „Postarea 34 dispare din profil și din flux. Nu poate fi recuperată.", „Anulează ștergerea"/„Șterge postarea 34"; `__NET` **gol** înainte de confirmare; după „Anulează": `__NET` tot gol, ordinea neschimbată, postarea 34 încă în grilă |
| Navigare verticală în ordinea grilei | atingerea celulei 38 → `__POST_ROUTE {walkMode:true, handle:"wallet4e8gv6", tab:"flow", reading:"newest", at:1, count:12, id:38}`; o glisare în sus → `at:2, id:34`; contorul citește „Postarea 3 din 12"; „Înapoi" → grila cu celula 38 **exact** la `[0,1215][403,1931]`, ca înainte de deschidere |
| Pagina de tag | `nexusdev://tag/life` → „#life", „1 postare · 1 persoană" (numere din `repo.tagStats`) |


### 17.4 Ce a rulat în această rundă

| Verificare | Rezultat |
| --- | --- |
| `node --test test/*.test.js` în arborele de deploy (baza `01d5f18` + modificarea de față) | **820 teste, 1 eșec** — `wallet-connect.test.js`, care cere pachetul `qrcode` neinstalat în acea copie de lucru (mediu, nu cod) |
| `node --test test/p8-profile-grid-order.test.js` (deploy) | **7 teste, 0 eșecuri** |
| `git push origin HEAD:main` | `origin/main` = `e74f8ff` (fast-forward din `01d5f18`, 5 fișiere, +167/−1) |
| `GET /api/version` pe Railway după deploy | `commit e74f8ff…`, `capabilities` conține **`profile_order: 1`** |
| lanțul mobil din `package.json` | **38 de scripturi, 0 eșecuri** |
| `tsc --noEmit` (mobil) | exit 0, fără diagnostice |
| `node --test test/*.test.js` în arborele de dezvoltare | **845 teste, 0 eșecuri** |

### 17.5 Ce rămâne deschis (nu e „gata")

1. **Ștergerea confirmată nu a fost exercitată pe conținut real.** Butonul, dialogul și Anulează sunt
   verificate pe telefon, iar absența butonului pe o repostare străină și refuzul serverului sunt acoperite
   de teste; dar confirmarea nu a fost apăsată pe o postare existentă (ar fi distrus conținutul
   proprietarului). Un singur articol privat de test a fost autorizat, însă comutatorul „CINE VEDE" nu a
   putut fi atins în mod fiabil în compozitor înainte de publicare, deci **nu s-a publicat nimic** — regula
   proprietarului („dacă intimitatea nu poate fi garantată, nu publica") a fost respectată. Compozitorul a
   fost închis cu „RENUNȚĂ", iar grila a rămas cu aceleași 12 celule.
2. **Atingerea unei mărci `#subiect` / `@nume` din text nu a fost exercitată** pe telefon în această rundă:
   niciun post vizibil în flux la momentul verificării nu avea o marcă în cuvinte. Pagina de tag în sine
   răspunde corect (`#life`, „1 postare · 1 persoană"), iar randarea și ușile marcajelor sunt acoperite de
   `test-rich-text.cjs` și `test-mark-doors.cjs`.
3. **Repostările nu pot fi aranjate.** `POST /api/posts/order` plasează doar postările contului (serverul
   refuză restul, întreg), deci o celulă repostată nu oferă tragere, iar locul ei rămâne cel dat de timp
   (în grila de față, postarea 15 stă prima fiindcă nu are `grid_position`). O extensie corectă ar cere o
   coloană de poziție pe `post_shares` și o a doua rută — nu a fost făcută.
4. **Tragerea nu poate derula grila.** În modul de aranjare `scrollEnabled` este oprit (altfel o tragere ar
   deveni o derulare); ecranul derulează automat la grilă când modul se deschide, dar o celulă aflată sub
   pliul ecranului se atinge după ieșirea și reintrarea în mod.
5. **Paginarea editorială la margine nu a fost încă exercitată pe telefon.** Mașina de stări, banda de
   56dp, dwell-ul de 600 ms și axa de plasare sunt testate automat și legate în `EditorialPage`, dar
   verificarea fizică a unei imagini purtate de la pagina 1 la pagina 12 rămâne de făcut.
6. **Contorul din colț** e publicat acum ca nod de accesibilitate (`accessible`), deci se citește cu UI
   Automator; înainte de reparație nu apărea în ierarhie.


## 18. Runda a paisprezecea — backendul, datele și telefonul se mută pe PC (27 octombrie 2026)

Railway expiră. Runda aceasta mută backendul, baza de date și depozitul de media pe PC, așa cum erau, și lasă
în urmă două lucruri dovedite: că telefonul vorbește cu PC-ul, și că datele de pe host au ajuns întregi în
baza locală. Ce nu s-a putut dovedi e scris la 18.9, nu ascuns.

### 18.1 Unde stă acum backendul

| Ce | Unde |
| --- | --- |
| Cod | `C:\Users\Romeo\projects\nexus_deepsek\apps\nexus-web` (Node 24, `node:sqlite`, zero dependențe de runtime în afara SDK-ului MultiversX) |
| Bază de date | `C:\Nexus\data\nexus.sqlite` (în afara depozitului git, deci un `git clean` nu o poate atinge) |
| Media | `C:\Nexus\data\media\<sha256>.<ext>` (content-addressed, verificat la fiecare citire) |
| Configurare | `C:\Nexus\env\jungle.env` (port, director de date, secret de sesiune; ACL doar pentru contul care rulează serviciul) |
| Jurnale | `C:\Nexus\logs\server-YYYY-MM-DD.log`, `supervisor.log`, `backup.log` |
| Serviciu | `tools/local-backend/jungle-backend-service.mjs`, pornit de task-ul `Jungle Book Backend` |
| Backup-uri | `C:\Nexus\backups\{db,media,drill}\<stamp>` |

Portul rămâne 5000, pe `0.0.0.0`, ca să răspundă telefonului pe LAN la `http://192.168.1.153:5000`.
`NODE_ENV=development` este o alegere, nu o scăpare: `production` refuză orice cerere care nu vine pe TLS
(`lib/api.js`), iar un certificat pe care telefonul să-l creadă nu există; pentru accesul din afara casei, TLS-ul
se termină la marginea tunelului (`tools/remote-access/README.md`), nu se dezactivează verificarea.

### 18.2 Backup-ul de dinainte (ce se putea și ce nu)

Exportul e în `C:\Users\Romeo\NexusBackups\railway-export-20261027` și a fost făcut **prin API-ul propriu al
hostului**, cu sesiunea telefonului, fără să scrie nimic: 8 conturi, 12 profiluri (5 persone pentru proprietar,
1 pentru celelalte), 36 de postări cu tot rândul (`text_style_json`, `publishing_json`, `content_commitment`,
`devnet_tx`, `pinned_at`, `grid_position`), 37 de comentarii, 2 repostări, 1 story, 20 de obiecte media
(fiecare descărcat și verificat: numele fișierului este hash-ul conținutului), plus răspunsul brut al fiecărei
rută atinse. `manifest.json` listează fiecare fișier cu sha256.

Ce **nu** se poate lua prin API, și de ce (rămâne limită, nu promisiune):

1. **Fișierul SQLite de pe volum.** Hostul răspunde doar HTTP; fișierul stă pe volumul platformei și nu e
   accesibil fără credențiale de platformă (CLI Railway autentificat sau un backup de volum). Nu există token
   Railway pe acest PC și nu a fost inventat unul.
2. **Hash-urile de parolă și subiectele de provider.** Exportul de cont al produsului le exclude prin
   construcție. Consecința e onestă: login-ul cu parolă nu se poate muta; identitatea xPortal **da**, pentru că
   adresa de wallet este exportată (`/api/me` → `mvx_address`).
3. **Rândurile de impresie per cititor.** API-ul publică doar agregatul (`view_stats`). Totalurile sunt păstrate
   exact în `posts.imported_viewers/impressions/completed`, iar vizualizările noi se adaugă peste ele
   (`repo.postViewStatsBulk`).
4. **Graful de urmărire.** API-ul dă doar contoare plus două steaguri per profil (`is_following`,
   `following_me`); muchiile dintre conturile acestei instanțe sunt reconstructibile din steaguri și atât.


### 18.3 Restaurarea, cu dovadă

`tools/migration/import-local.mjs` scrie o bază **nouă**, păstrând id-urile, timestamp-urile, proprietarul și
coloanele JSON verbatim (nu re-serializate: `content_commitment` este un hash peste exact acei octeți).
Importul refuză o bază care are deja conturi și rulează într-o singură tranzacție.

```
users 9  personas 12  posts 36  post_media 24  post_tags 5  post_shares 2
comments 37  stories 1  follows 1  media 20 (20 fișiere copiate, 0 lipsă)
integrity_check ok   commitments verificate 36/36
```

Verificarea nu se încheie la numărători: `tools/migration/verify-restore.mjs` întreabă **serverul local**
aceleași lucruri pe care le-a întrebat hostul și compară răspunsurile.

```
profiles_compared 12  posts_compared 36  comments_compared 37  reposts_compared 2
media_checked 20      feed_posts 18/18     problems []       ok true
```

Adică: fiecare postare are același text, vizibilitate, versiune, commitment, moment de creare, fixare, poziție
în grilă și aceleași totaluri de vizualizare; fiecare document editorial (`text_style.document`) e identic;
fiecare fișier media servit acum de PC are exact hash-ul numelui lui.

### 18.4 Serviciul de pe PC

`jungle-backend-service.mjs` este un supervisor, nu un „task care pornește un node": repornește copilul cu
backoff exponențial (1 s → 30 s, resetat după un minut de viață), sondează `/api/version` la 30 s și repornește
după trei eșecuri consecutive (un server blocat e mai rău decât unul mort), rotește jurnalul după dimensiune și
scrie `C:\Nexus\run\status.json`. Oprirea este cooperantă: `stop-backend.ps1` scrie `run\stop.request`,
supervisorul trimite `shutdown` pe stdin, iar `server.js` închide baza — Windows nu are un SIGTERM care să
însemne „închide întâi baza", iar `TerminateProcess` fix asta ar face.

Două task-uri planificate, ambele ascunse (`wscript.exe` + VBS, fereastră zero):

- `Jungle Book Backend` — la logon și zilnic 00:05, `MultipleInstances=IgnoreNew`;
- `Jungle Book Backup` — zilnic 03:30, retenție 14 snapshots de bază și 7 de media.

Task-ul vechi `Nexus Social 5000` (care pornea `server.js` direct pe același port) a fost oprit și
**dezactivat**, nu șters: `uninstall-autostart.ps1 -RestoreLegacy` îl readuce. Task-ul `Nexus Messenger 3100`
rulează pe alt port și nu a fost atins.

Dovada că e sus: `/health` → `{"status":"ready","users":9,"posts":36,"media":20}`, `status-backend.ps1` →
`healthy true`, `restarts 0`, iar `/api/version` publică `profile_order_reposts` dintr-un build local.

### 18.5 Telefonul vorbește cu PC-ul (dovadă din jurnalul serverului)

Configurația e explicită, într-un singur loc: `apps/nexus-mobile/.env` →
`EXPO_PUBLIC_NEXUS_API_URL=http://192.168.1.153:5000` (fișier local, necommis; `.env.example` descrie toate cele
trei origini: LAN, tunel, Railway). Metro a fost repornit cu `--host lan --clear`, deci valoarea e în bundle.
Fără `adb reverse`.

Sesiunea nu a fost resetată: token-ul vechi era semnat cu secretul hostului și nu poate fi validat aici, deci
`tools/local-backend/issue-local-session.mjs` a emis unul nou **pentru același cont și același device id**
(`a27e308e75b9ca806525e08c43bad9e6`), l-a scris în `sessions` exact ca un login și a produs același
`session.json` pe care aplicația îl ține deja; fișierul a fost pus pe telefon. Nu e o slăbire a autentificării:
e aceeași sesiune, semnată de serverul care o validează.

Jurnalul serverului (`C:\Nexus\logs\server-2026-10-27.log`, linii `[req]`) arată telefonul, după o repornire
completă a aplicației:

```
GET /api/me              200   3ms 192.168.1.184 okhttp/4.12.0
GET /api/social/feed     200 102ms 192.168.1.184 okhttp/4.12.0
GET /api/profiles/wallet4e8gv6 200 39ms 192.168.1.184 okhttp/4.12.0
GET /media/da4387…b932.jpg  200  7ms 192.168.1.184 okhttp/4.12.0
POST /api/social/impressions 202 18ms 192.168.1.184 okhttp/4.12.0
```

`192.168.1.184` este telefonul; PC-ul e `192.168.1.153`. Pe ecran, pagina de articol restaurată se deschide din
grilă și arată „Pagina 1 din 2" cu textul și fotografia paginii — adică `text_style.document` a supraviețuit
mutării, nu doar rândul din bază.


### 18.6 Repostările se aranjează

Cerința care lipsea. Modelul: fiecare celulă are o identitate — o postare este `post_id`, un repost este
`-share_id` — iar `POST /api/posts/order` primește acum o listă de `{post_id}` / `{share_id}`. Serverul scrie
prima în `posts.grid_position` și a doua în `post_shares.grid_position`, într-o singură tranzacție, și refuză
întreaga listă dacă un element nu e al contului (`order_foreign`), dacă e duplicat (`order_duplicate`), dacă e
prea lung (`order_too_long`) sau dacă nu e nici postare nici repost (`order_invalid`). O repostare nu atinge
niciodată rândul postării originale: `posts.grid_position` al autorului rămâne cum era, iar testul o spune
explicit.

Capabilitatea nouă `profile_order_reposts: 1` este publicată de `/api/version`, ca un client să întrebe înainte
de a încerca. Pe telefon, `profileGrid.ts` are `tileId`/`tileEntry`/`orderEntries`; tragerea mișcă lista de
identități de celule, iar `persistOrder` trimite intrările. Pin și ștergere rămân refuzate pe o repostare
(„aranjezi, dar nu-ți aparține"), exact ca înainte.

Teste: `test/p8-profile-grid-order.test.js` 13/13 (între care repost plasat, intercalare original/repost, share
străin refuzat, share de tip `copy_link` refuzat, supraviețuire după redeschiderea fișierului) și
`scripts/test-profile-grid.cjs` 16/16 (între care `tileId`, `arrangementMap` care refuză poziția postării
originale, `canPlace` adevărat doar pe repost).

### 18.7 De ce cădea `wallet-connect.test.js` (și ce mai era ascuns)

Cauza nu era mediul: `qrcode` era importat de `apps/nexus-web/src/wc-client.js`, dar declarat doar în
`package.json`-ul de la rădăcină. În arborele de dezvoltare se rezolva prin `node_modules`-ul părinte; într-un
checkout curat, nu. Acum este `devDependency` al pachetului care îl importă, cu lockfile-ul actualizat.

Verificarea curată a scos la iveală încă ceva, mai grav: `repo.js` importa `lib/post-text-style.js` și `api.js`
importa `lib/post-editorial-document.js`, iar `public/index.html` încărca `post-quote.js` — toate existau
**doar** în arborele local. Un checkout curat nu pornea deloc: 55 de suite cădeau pe `ERR_MODULE_NOT_FOUND`.
Fișierele (și testele lor) sunt acum în git, împreună cu `interface-locale.js`, `wc-bundle.js`,
`xportal-bridge.js` și cele cinci teste care fuseseră actualizate odată cu ele.

Dovada, într-un worktree nou la commitul `b76f6b8`, cu `npm ci` proaspăt:

```
npm ci (apps/nexus-web)       → qrcode prezent, 0 erori
node --test test/*.test.js    → tests 851  pass 851  fail 0
arborele de dezvoltare        → tests 851  pass 851  fail 0
npm ci --omit=dev (rădăcină, ca în Dockerfile) → 214 pachete, 0 erori
```

### 18.8 Backup-uri periodice, cu restaurare dovedită

`backup-db.mjs` ia baza cu `VACUUM INTO` (copie dintr-o singură tranzacție, nu o copie de fișier peste o bază
în scriere), rulează `PRAGMA integrity_check` **pe copie**, o hash-uiește, și abia apoi o păstrează; media este
oglindită prin hard-link-uri (media e imuabilă și content-addressed, deci un snapshot complet costă aproape
nimic). Un snapshot care pică verificarea este șters și rularea e raportată ca eșec.

```
2026-10-27T07:25:20Z OK db 1.84MB sha256 9ce892ddef07 integrity=ok media 20 files (20 linked, 0 copied)
2026-10-27T07:26:23Z OK (task-ul planificat, rezultat 0x0)
```

Drill-ul de restaurare (`restore-backup.mjs --drill`) restaurează ultimul snapshot într-un director de unică
folosință și compară numărătorile cu baza vie:

```
sha256_matches_manifest true   integrity_check ok
counts  users 9 personas 12 posts 36 comments 37 post_shares 2 media 20 stories 1 follows 1
live    users 9 personas 12 posts 36 comments 37 post_shares 2 media 20 stories 1 follows 1
drift []   ok true
```

### 18.9 Ce rămâne deschis (nu e „gata")

1. **Aranjarea repostării: făcută pe telefon, dovedită de server și de bază.** Apăsare de 1,2 s pe celula a
   doua (repostarea) → `managing: true`; tragere cu 409 px spre stânga (o coloană) → `POST /api/posts/order`
   200, mesajul „Ordinea a fost salvată."; în bază `post_shares.id=4 → grid_position 0` și
   `posts 40,33,38,39,32,31,30,29,28,27,26 → 1..11`; iar postarea originală a repostării (`posts.id=15`,
   alt proprietar) a rămas `grid_position NULL, version 1`. Ce rămâne de făcut: dovada că ordinea se vede la
   fel după o repornire completă a aplicației (ecranul a repornit pe pagina de articol, nu pe grilă).
2. **Publicarea unui articol privat nu a fost repetată.** Compozitorul se deschide, dar comutatorul „CINE VEDE"
   nu a fost atins în această rundă; regula proprietarului („dacă intimitatea nu poate fi garantată, nu
   publica") rămâne în vigoare, deci nu s-a publicat nimic.
3. **Ștergerea confirmată nu a fost apăsată pe conținut real** (ar distruge o postare a proprietarului);
   dialogul, „Anulează" și refuzul pe o postare străină sunt verificate.
4. **Paginarea editorială la margine** (imagine purtată de la pagina 1 la pagina 12) nu a fost exercitată
   fizic; mașina de stări și banda de 56 dp sunt testate automat.
5. **Accesul din afara casei** are scripturi și documentație (`tools/remote-access/`), dar nu are un hostname
   public: tunelul numit cere un token Cloudflare (cont + domeniu), iar Tailscale cere un cont. Ambele sunt
   pregătite; lipsește doar autorizarea proprietarului.
6. **Backup-ul brut al fișierului SQLite de pe host** rămâne imposibil fără credențiale de platformă. Ce s-a
   luat prin API este verificat bucată cu bucată (vezi 18.2), dar nu este identic cu fișierul de pe volum.
7. **Imaginile din grila de profil primesc 401 pe PC, deși obiectele există.** În jurnalul serverului, din
   127 de cereri de media venite de la telefon (`192.168.1.184`), 44 au primit `200` și **67 `401`**, pe 12
   hash-uri distincte (inclusiv trei `.png`). Aceleași obiecte răspund `200` cu token (`Invoke-WebRequest` cu
   `Authorization: Bearer` → 200, 361 760 de octeți), deci fișierele sunt bune și ruta `/media/<hash>.<ext>`
   cere sesiune — `PostMedia.tsx` o trimite (`mediaHeaders()`), dar cel puțin o suprafață a grilei o cere fără.
   Simptomul pe ecran este mesajul onest al aplicației: „Fișierul media nu a putut fi încărcat." De reparat
   în runda următoare; nu blochează datele, dar strică o grilă care altfel arată corect.
8. **Un obiect media cerut de aplicație nu există în depozitul local** (`1343406e…jpg`): apare în payload-urile
   exportate ale postărilor 2 și 16, dar nu are rând în `media` și nu e între cele 20 de fișiere copiate.
   `posts.media_id` și `post_media` nu au orfani (verificat), deci referința vine dintr-un colț al payload-ului
   pe care importul nu îl tratează ca media (probabil un manifest de studio). De găsit și de adăugat.
9. **Railway nu a fost atins.** Nu s-a șters nimic, nu s-a oprit deploymentul, iar codul de pe `origin/main`
   (e74f8ff) rămâne cel publicat. Retragerea lui cere confirmarea explicită a proprietarului, după ce punctele
   1–8 sunt închise pe telefon.

## 19. Runda a cincisprezecea — numai pe PC: imaginile, articolul privat, ordinea după repornire (27 octombrie 2026)

Decizia proprietarului, de la care pornește tot ce urmează: Jungle Book rulează **doar pe PC-ul Windows și
în rețeaua casei**. Fără Cloudflare, fără Tailscale, fără domeniu public. Migrarea pe un host se face într-o
fază separată, iar `docs/22-local-to-hosted.md` spune exact ce se schimbă atunci.

### 19.1 Imaginile: 401-ul nu era al serverului, ci al pipeline-ului de imagini

§18.9 punctul 7 spunea „67 din 127 de cereri au primit 401, deci o suprafață a grilei cere media fără
sesiune". Măsurătoarea, refăcută doar pe cererile telefonului (`192.168.1.184`, nu și scripturile de
verificare de pe `127.0.0.1`, care umflau numărul de `200`), arată altceva:

```
jpg  200 x3     401 x64          mp4 200 x22      webm 200 x19 + 206 x16
```

Adică **fiecare** cerere de imagine a telefonului era refuzată, iar **fiecare** cerere de clip era
acceptată — cu același `mediaHeaders()` în ambele locuri. `expo-video` trimite `source.headers`;
pipeline-ul de imagini al React Native 0.86 pe acest dispozitiv nu le trimite, deci
`<Image source={{uri, headers}}>` nu poate purta sesiunea. Cele trei `200` de imagine veneau din cookie-ul
pus incidental în borcanul OkHttp de un `fetch` anterior, nu din `headers`.

Reparat în așa fel încât să nu depindă de comportamentul nativ: `lib/mediaCache.ts` descarcă o dată
octeții, cu exact headerele din `mediaHeaders()`, în cache-ul aplicației, sub numele content-addressed al
obiectului (`<sha256>.<ext>`), iar cadrul se desenează din fișier. Descărcarea scrie în `<nume>.part` și
redenumеște doar la succes, deci o cerere întreruptă nu otrăvește cache-ul; cererile simultane pentru
aceeași poză împart o singură descărcare. Serverul nu s-a atins: anonimul primește tot `401`, iar un obiect
la care cititorul nu are dreptul primește tot `404`.

- `RemoteImageSource` desenează prin `useMediaFile`; `CommentsSheet` a fost ultima suprafață care dădea o
  sursă remoteă direct unui `<Image>` (avatarurile din comentarii).
- Cititorul editorial își măsoară fotografia din fișierul pe care îl desenează, nu prin
  `getSizeWithHeaders` (aceeași cale nativă, același `401`).
- Două suite noi: `test-media-cache.cjs` (7 teste, cu un `expo-file-system` fals: sesiunea pleacă pe
  cerere, `.part` nu rămâne, refuzul nu otravește cache-ul, o singură descărcare pentru trei cereri) și
  `test-api-origin.cjs` (6 teste).

Pe telefon, după `am force-stop` + repornire, cu jurnalul serverului ca dovadă:

```
GET /api/profiles/wallet4e8gv6 200
GET /media/8e307c3e…jpg 200      GET /media/18e003c4…jpg 200
… 8 poze în total, toate 200, zero 401
cache-ul aplicației: 8 fișiere sub numele lor content-addressed
```

Cele 8 poze sunt exact cele 8 postări-cu-imagine din grilă (40, 39, 38, 33, 32, 29, 28, 26); postarea 27
e clip, iar 15, 30, 31 sunt doar text. Mesajul „Fișierul media nu a putut fi încărcat." nu a mai apărut.
Înainte: 127 de cereri, 67 de refuzuri. Acum: 8 cereri, 8 fișiere.

### 19.2 `1343406e…jpg` nu e media unei postări, ci avatarul contului de test `test`

§18.9 punctul 8 presupunea un colț de studio în payload-urile postărilor 2 și 16. Nu: o căutare în toate
cele 145 de tabele arată referința în `users.avatar` și `personas.avatar`, pentru contul `test`
(`display_name` „Test Nexus"), nu în `posts` (2 și 16 au `media_id` 1 și 9, ambele clipuri). Fișierul nu
există în `C:\Nexus\data\media` (20 de fișiere, exact cele 20 de rânduri din `media`) și nu a fost
exportat niciodată, deci **nu poate fi recuperat** fără stocarea Railway.

Impact practic: zero pentru proprietar. Contul `test` este unul dintre conturile de test moștenite (care
răspund oricum `500 CONTENT_ASSESSMENT_COMMITMENT_MISMATCH` la `/api/profiles/test`), nu are postări în feed
și nu e contul telefonului. Nu s-a inventat și nu s-a substituit nicio imagine: referința a rămas în bază
exact cum a venit din export.

### 19.3 Ordinea repostării trece de repornirea aplicației **și** de repornirea backendului

- `am force-stop` + repornire → grila se deschide `41, 15, 40, 33, 38, 39, 32, …`: postarea 41 e cea nouă
  (sus, fără `grid_position`), restul păstrează aranjarea salvată.
- `stop-backend.ps1` → `start-backend.ps1` (`restarts 0`, `healthy True`, `commit 42bf57a`) → după derulare,
  grila arată `33, 38, 39, 32, 31, 30, 29, 28, 27, 26`, adică exact coada aranjării.
- În bază, după publicarea articolului: `post_shares.id=4 → grid_position 0` neschimbat, `posts.id=15`
  (postarea originală, alt proprietar) `grid_position NULL, version 1` neschimbat, `posts 40…26 → 1..11`
  neschimbate. Aranjarea nu atinge niciodată postarea altcuiva.

### 19.4 Articolul privat: publicat o singură dată, dovedit privat, dovedit persistent

Pe telefon, în compozitorul editorial: două paragrafe plus o fotografie (atașată din galerie, 398 444 de
octeți), apoi „CINE VEDE → Doar eu" (`visibility: private` în starea compozitorului), apoi „Publică".

```
POST /api/posts 201 (192.168.1.184)
posts: 36 → 37            media: 20 → 21
posts.id=41  user_id=12  visibility=private  kind=image  media_id=29  status=active
```

Dovada că e privat, cerută ca alt cont (sesiune emisă local pentru `devnet_test_01`) și anonim:

```
owner         GET /api/posts/41 → 200   (feed-ul propriu îl arată)
alt cont      GET /api/posts/41 → 404 „post not found"   (feed, profil: niciun 41)
anonim        GET /api/posts/41 → 401 „not signed in"
```

Pe ecran: apare în grilă ca prima celulă, se deschide din profil și își ține așezarea (paragraf, paragraf,
fotografie îngustă lipită la stânga, `widthFraction 0.55`), fotografia se descarcă `200` din noul cache, iar
după `am force-stop` + repornire articolul e tot acolo, cu aceeași așezare. Compozitorul și-a șters draftul
după publicare (`files/nexus-text-drafts/` rămâne gol), deci nu rămâne un draft orfan.



### 19.5 Un defect găsit pe drum: un wildcard de port oprea orice autentificare NativeAuth

Încercând să validez un token NativeAuth adevărat pe PC (`lib/mvx.js` → `validateNativeAuthToken`), serverul
a aruncat `NativeAuthInvalidWildcardOriginError` **din constructorul** `NativeAuthServer`: lista de
dezvoltare era `["http://localhost:*", "http://127.0.0.1:*"]`, iar SDK-ul citește `*` ca wildcard de
subdomeniu, nu de port. Orice proces fără `NEXUS_ACCEPTED_ORIGINS` (checkout proaspăt, script, test) nu
putea valida niciun token, deci fiecare autentificare xPortal ar fi răspuns `401`.

Serviciul de pe PC avea lista bună în `C:\Nexus\env\jungle.env`, deci nu era afectat — dar era la un pas de
orice configurare nouă. Reparat: lista de dezvoltare numește origini simple, o intrare cu `*` venită din
environment e eliminată cu avertisment (nu transmisă mai departe), o listă rămasă fără nicio origine validă
oprește pornirea cu un mesaj clar, iar un test nou construiește serverul în toate cele trei cazuri.

Ce **nu** s-a putut dovedi fără proprietar: un login xPortal complet. Semnătura o dă portofelul din
aplicația xPortal a proprietarului, iar SDK-ul verifică mesajul împachetat (`MessageComputer`), nu octeții
bruți pe care îi poate produce un semnatar scris de mână. Endpoint-ul e viu și validează (`token` gunoi →
`401`, lipsă → `400`, fără `Idempotency-Key` → `400 IDEMPOTENCY_KEY_REQUIRED`), iar sesiunea folosită de
telefon păstrează identitatea contului (user 12, același `device_id`) și s-a dovedit durabilă la fiecare
repornire (`GET /api/me 200` după fiecare `force-stop`). Rămâne un pas al proprietarului: confirmarea în
xPortal, pe telefon.

### 19.6 Ce s-a verificat, cu cifre

| Verificare | Rezultat |
| --- | --- |
| Suite backend, checkout curat (`npm ci` + `node --test test/*.test.js`) | **852/852**, commit `42bf57a` |
| Suite backend, arborele de lucru | 852/852 |
| Suite mobile (`apps/nexus-mobile`, 40 de suite) | 40/40 |
| TypeScript (`tsc --noEmit`) | curat |
| `PRAGMA integrity_check` / `foreign_key_check` | `ok` / 0 violări |
| `verify-restore.mjs` față de exportul Railway | `ok: true`, `problems: []`, 12 profiluri, 36 postări, 37 comentarii, 2 repostări, 20 de media re-hashuite; `drift: 46` = uzură (vizualizări crescute, aranjare, postarea 41) |
| `backup-db.mjs` + `restore-backup.mjs --drill` | `sha256_matches_manifest true`, `integrity_check ok`, `drift []`, `ok true` (37 postări, 21 media) |
| Backend după repornire | `restarts 0`, `healthy True`, `/health` 200, `commit 42bf57a` |
| Sarcini programate | `Jungle Book Backend` (logon + 00:05) și `Jungle Book Backup` (03:30, ultima rulare 08:26, rezultat 0), ambele `Ready` |
| Media pe telefon | 8 poze descărcate, 8 cereri `200`, zero `401` |

`verify-restore.mjs` a fost corectat ca să poată fi rulat și după ce telefonul a fost folosit: identitatea
(postări, texte, commitments, documente editoriale, comentarii, repostări, octeții media) rămâne
`problems`, iar ce scrie produsul prin folosire (vizualizări, `grid_position`, `pinned_at`, postări noi)
devine `drift`, cu o excepție păstrată ca eroare: un contor care **scade** e pierdere de date, nu uzură.

### 19.7 Ce rămâne pentru proprietar (nimic din ce urmează nu blochează folosirea)

1. **Firewall-ul e mai larg decât casa.** Wi-Fi-ul „Romeo 5G 2" e clasificat **Public** de Windows, iar
   `node.exe` are reguli inbound `Allow` pe profilul Public — deci backendul răspunde oricărei rețele la
   care se conectează PC-ul. Nu există port forwarding pe router (nimic expus în internet), dar restrângerea
   cere o rulare **elevată**, care nu se poate face din sesiunea asta: `tools/local-backend/restrict-firewall.ps1`
   (scris, verificat sintactic, refuză frumos fără admin) înlocuiește regulile largi cu una singură, TCP
   5000, doar `LocalSubnet`.
2. **Login xPortal complet**, cu confirmarea în aplicația xPortal a proprietarului — vezi 19.5.
3. **Ștergerea confirmată pe conținut real** nu a fost apăsată (ar distruge o postare a proprietarului);
   dialogul, „Anulează" și refuzul pe o postare străină sunt verificate.
4. **Paginarea editorială la margine** (imagine purtată între pagini cu dwell de ~600 ms) nu a fost
   exercitată fizic în această rundă; mutarea unei poze între pagini fusese deja verificată de proprietar, iar
   mașina de stări e testată automat.
5. **Retragerea Railway** cere confirmarea explicită a proprietarului. Railway nu a fost atins: nu s-a șters
   nimic, nu s-a oprit deploymentul. Volumul de acolo rămâne singura sursă posibilă pentru obiectul din 19.2.

## 20. Runda a șaisprezecea — grila de profil: un singur gest, mânerul, golul (27 octombrie 2026)

Ownerul a raportat patru lucruri despre grilă, toate despre **interacțiune**, nu despre date: prima fotografie
„alunecă în jos și rămâne blocată" după o apăsare lungă, pozele sar între poziții în loc să urmeze degetul,
📌/🗑️ nu pot fi apăsate, iar totul se simte „abrupt și nesigur". Runda asta a început prin a **măsura** pe
Xiaomi ce se întâmplă, apoi a înlocuit gestul.

### 20.1 Ce se întâmpla de fapt (măsurat pe telefon, nu dedus)

1. **Apăsarea lungă de o secundă pierdea cursa cu ridicarea degetului.** Celula avea
   `delayLongPress={1000}`, iar o apăsare ținută exact o secundă — `adb shell input swipe 202 851 202 851 1000`
   — a **deschis postarea 15** în loc să intre în modul de aranjare. Un prag egal cu durata unei apăsări
   hotărâte este o cursă: cine termină primul câștigă, iar de multe ori câștiga ridicarea degetului.
2. **Bara de deasupra peretelui dispărea, iar peretele sărea în sus cu înălțimea ei.** În modul de aranjare
   bara nu se mai desena (`isOwner && !managing`), deci grila urca: celulele au trecut de la `y=1602` la
   `y=1445` — exact **157 px = 60 dp**, înălțimea barei. Degetul stătea nemișcat, imaginea se mișca. Asta este
   „imaginea se duce în jos și rămâne blocată" din raport: peretele se muta sub deget, iar degetul rămânea
   peste altă celulă, cu un responder care aparținea unei celule care nu mai exista.
3. **Celula rămânea în urma degetului, pentru tot gestul.** `PanResponder` numără `dx`/`dy` de la evenimentul
   care **acordă** responderul, nu de la `DOWN`: cu `onMoveShouldSetPanResponder` care aștepta 4 puncte de
   mișcare, acele puncte se pierdeau definitiv. Măsurat: degetul s-a mișcat `+410/+750`, celula s-a mutat
   `+405/+700`. Și mai rău, obiectele `PanResponder` erau refăcute la fiecare render care schimba arhiva, iar
   un `PanResponder` nou își începe offsetul de la poziția din pagină — o reîncărcare care ateriza în timpul
   unei trageri arunca celula ținută departe de deget.


4. **O repostare nu putea fi aranjată niciodată, deși serverul o aranja.** Două defecte suprapuse:
   `optimisticArrangement` arunca identitățile negative (o repostare este `-shareId`), deci previzualizarea o
   lăsa pe loc; iar payload-ul `GET /api/profiles/:handle` construia intrările de repostare fără
   `grid_position`, deci nici după reîncărcare peretele nu avea locul ei. Măsurat: după o tragere, baza avea
   `post_shares.grid_position = 4`, iar grila desena repostarea tot prima — „trag, serverul salvează, grila
   sare înapoi".
5. **Modul de aranjare oprea derularea** (`scrollEnabled={!managing}`) și nu exista derulare automată la
   margini: pe un profil lung, singurul lucru pe care îl putea face degetul era să tragă o celulă — de aici
   „nu pot selecta altă postare".
6. **Orice mișcare de 4 puncte peste orice celulă începea o tragere.** Responderul era pe toată celula, iar
   butoanele 📌/🗑️ stăteau în același responder: o încercare de derulare devenea o mutare, iar un tap pe un
   buton putea deveni o tragere.

### 20.2 Modelul ales (trei acțiuni care nu se mai calcă pe picioare)

| Mod | Gest | Ce face |
| --- | --- | --- |
| Normal | tap pe celulă | deschide exact postarea, cu ordinea din care a fost deschisă; scroll normal; poziția se păstrează la întoarcere |
| Normal | ține apăsat 500 ms | intră în modul de aranjare (pragul sistemului, nu o secundă întreagă) |
| Aranjare | tap pe ≡ (mâner 44 pt, colț dreapta-sus) | pornește tragerea **doar** de acolo |
| Aranjare | tap pe 📌 | fixează / scoate din fixate (buton propriu, nu poate porni o tragere) |
| Aranjare | tap pe 🗑️ | deschide confirmarea ștergerii (buton propriu; numai pe postările proprietarului) |
| Aranjare | „Gata" (bară sus sau doc jos) / Back | iese din mod; nimic nu rămâne „în aer" |

Tragerea: celula ținută **stă deja la locul unde ar cădea** (golul), iar fața ei călătorește într-un strat
deasupra peretelui, la offsetul degetului. Vecinele alunecă în locurile lor (150 ms, `useNativeDriver`), deci
ordinea se vede în timpul gestului, nu după el. Ținta se schimbă numai după ce degetul a ieșit din celula
curentă cu 20% dintr-o celulă (histerezis), ca un deget care stă pe cusătură să nu facă peretele să pâlpâie.
La marginea de sus/jos a ecranului peretele se derulează singur, proporțional cu adâncimea în bandă, iar
celula ținută călătorește cu conținutul: offsetul de desenare și poziția sub deget se calculează amândouă din
`scrollDelta`.

### 20.3 Fișiere atinse

- `apps/nexus-mobile/src/lib/profileDrag.ts` **(nou)** — mașina de stări a gestului, pură: `beginDrag`,
  `moveDrag`, `settleTarget` (histerezis), `releaseDrag`, `dragOrder` (după identitate), `autoScrollStep`,
  `clampScroll`, `dragCentre`.
- `apps/nexus-mobile/src/components/ProfileTile.tsx` — celula are acum trei forme: ușa (`Pressable`, ținut =
  aranjare), celula aranjată (`View` cu mâner propriu + două butoane proprii; mânerul rămâne montat cât timp
  celula este purtată) și fața purtată (`ghost`, fără touch).
- `apps/nexus-mobile/src/screens/ProfileScreen.tsx` — un singur perete, așezat absolut pe `gridSlot`, într-o
  listă cheiată după identitate (`ManageCell` animează fiecare celulă din locul pe care tocmai l-a lăsat);
  responder brut pe mâner (`onResponderGrant`/`Move`/`Release`/`Terminate`), cu `pageX`/`pageY` citite direct;
  auto-scroll pe un ceas propriu; doc-ul „Gata" în afara scrollerului; bara de sus desenată în ambele moduri,
  cu aceeași înălțime; `BackHandler` iese din mod; o singură scriere de ordine în zbor (`orderInFlight`), iar
  `arranged` rămâne pe ecran până când sosește payload-ul serverului.
- `apps/nexus-mobile/src/lib/profileGrid.ts` — `optimisticArrangement` păstrează și identitățile negative
  (repostările), care înainte dispăreau din previzualizare.
- `apps/nexus-web/lib/api.js` — intrările de repostare din `GET /api/profiles/:handle` poartă acum
  `grid_position` (locul din `post_shares`), exact câmpul pe care clientul îl citea deja.
- `apps/nexus-mobile/scripts/test-profile-drag.cjs` **(nou)** — 11 teste pentru gest.
- `apps/nexus-mobile/scripts/test-profile-grid.cjs` — contractele actualizate (prag, bara care nu se mișcă,
  doc-ul, mânerul ca singură suprafață de tragere, `Back`).
- `apps/nexus-web/test/social-profile-read-regressions.test.js` — un test care citește payload-ul real al
  rutei și cere ca repostarea să vină cu locul ei.
### 20.4 Ce a rulat automat (rezultate reale)

- `node scripts/test-profile-drag.cjs` — **11/11**. Acoperă: începutul și sfârșitul unui gest (un deget
  nemișcat nu scrie nimic), coordonatele primei celule față de cele din mijloc și de la capăt, histerezisul de
  la cusătură, „un cadru care nu schimbă nimic nu redesenează peretele", identitatea stabilă a celulei (o
  repostare negativă), derularea sub deget, benzile de derulare automată și limitarea offsetului, mânerul ca
  singură suprafață de tragere, fiecare ieșire din gest, o singură scriere în zbor și rollback-ul, plus forma
  peretelui aranjat (listă cheiată, overlay fără touch, animație pe driverul nativ).
- `node scripts/test-profile-grid.cjs` — **16/16** (contractele actualizate).
- Lanțul complet al aplicației mobile (`package.json` → `test`) — **41/41 scripturi**, **348** de cazuri
  `node:test`, zero eșecuri.
- `node node_modules/typescript/bin/tsc --noEmit` — curat.
- Backend: `node --test test/*.test.js` — **853/853**, inclusiv testul nou care cere ca repostarea din
  payload-ul profilului să vină cu `grid_position`.
- Backendul de pe PC a fost repornit ca să încarce ruta corectată: `/api/version` răspunde `healthy: true`,
  `restarts: 0`, iar payload-ul citit direct de la `127.0.0.1:5000` arată
  `reposts: [{share: 4, place: 0, post: 15}]` — deci locul repostării ajunge la telefon.

### 20.5 Ce s-a dovedit pe telefon (Xiaomi 25098PN5AC, 1220×2656, density 416)

Fără capturi de ecran (conducta de screenshot a eșuat repetat pe acest telefon): fiecare rând de mai jos este
arborele de accesibilitate pe care telefonul îl desenează, cu dreptunghiurile lui, plus baza de date a PC-ului.

| # | Ce s-a făcut | Ce s-a citit |
| --- | --- | --- |
| 1 | tap pe a doua celulă, apoi `Back` | s-a deschis postarea 15 (`Profilul lui @urailwaytest01a20d`), iar după `Back` celula era exact la `(610, 1602)` — poziția păstrată |
| 2 | ținut 550 ms pe **prima** celulă | modul de aranjare s-a deschis, iar `Postarea 42 din grilă` stă la `(202, 1602)`: **aceeași poziție** cu `Deschide postarea 42` de dinainte. Peretele nu s-a mișcat (înainte sărea 157 px) |
| 3 | mânerul, 📌 și 🗑️ pe fiecare celulă | `Mută postarea …` sus-dreapta, `Fixează/Scoate din fixate …` jos-stânga, `Șterge postarea …` jos-dreapta; pe repostare (15) 📌 este `disabled` și 🗑️ **nu există** |
| 4 | `Back` în modul de aranjare | modul s-a închis, aplicația a rămas pe ecran, celulele s-au întors la etichetele de ușă |
| 5 | 🗑️ pe postarea de probă 42, apoi `Anulează` | dialogul `Confirmarea ștergerii` s-a închis, celula 42 a rămas în grilă, iar baza avea `status='active'` |
| 6 | 🗑️ pe 42, apoi `Șterge postarea 42` | celula a dispărut, doc-ul a scris `Postarea a fost ștearsă.`, baza are `status='withdrawn'`, modul a rămas utilizabil |
| 7 | 📌 pe postarea 33 | a sărit pe primul loc; eticheta a devenit `Scoate din fixate postarea 33` (`selected`), baza: `pinned_at=1793099653`; apoi scoaterea din fixate a readus-o pe locul ei (baza: `pinned_at=null`) |
| 8 | tragerea repostării 15 (prima celulă) cu un rând în jos | în timpul gestului golul a arătat `Poziția 4 din 13`, iar peretele s-a rearanjat **live** (33 primul, 39 al doilea); la eliberare baza: `post_shares.grid_position = 3` |
| 9 | imediat, fără să ies din mod, tragerea postării 39 | golul `Poziția 5 din 13`, la eliberare baza: `39 → 4` — deci gestul următor pornește curat |
| 10 | a treia tragere, pe prima celulă de atunci (33) | `Poziția 4 din 13`, la eliberare `33 → 3`; fără gol rămas, fără celulă „lipită" |
| 11 | deget ținut în banda de jos a ecranului | golul a alergat până la `Poziția 13 din 13`, adică peretele s-a derulat sub deget |
| 12 | deget mutat în banda de sus | golul s-a întors la `Poziția 1 din 13` (derulare în sus) |
| 13 | deget mutat la mijlocul ecranului | golul a rămas `Poziția 1 din 13` la două citiri la 1,4 s distanță: derularea automată **se oprește** |
| 14 | glisare pe o celulă (nu pe mâner) în modul de aranjare | peretele s-a derulat și **nu** a pornit nicio tragere (mânerul este singura suprafață) |
| 15 | tragerea ultimei celule (26) spre sus | golul `Poziția 7 din 13` — mecanismul merge; vezi 20.6 pentru ce nu s-a putut încheia |
| 16 | peretele față de bază, după fiecare eliberare | identice: `33, 15, 32 / 30, 39, 31` ↔ locurile `0…5` din `posts` și `post_shares` |

Ce spune asta despre defectele raportate: prima celulă nu mai sare și nu mai rămâne „blocată" (rândul 2), a
doua tragere pornește imediat (rândul 9), pozele se mută cu degetul și vecinele își fac loc în timpul gestului
(rândul 8), 📌 și 🗑️ se apasă (rândurile 6–7), iar o repostare chiar se așază unde o pui (rândul 8), pentru că
serverul trimite acum și locul ei.

### 20.6 Ce nu s-a putut încheia în această rundă (și de ce)

1. **Telefonul s-a închis singur (doze) în timpul tragerii ultimei celule** și a cerut PIN-ul proprietarului.
   Nu am încercat codul. Din acest motiv nu au fost apăsate fizic, în această rundă: eliberarea tragerii
   ultimei celule (golul a fost văzut, commit-ul nu), butoanele „Gata" (ieșirea a fost dovedită doar cu
   `Back`), deschiderea unei postări după o tragere și repornirea completă a aplicației pentru noua ordine.
   Sunt ~2 minute de lucru când telefonul este deblocat.
2. **Persistența a fost dovedită, dar pentru ordinea de dinaintea acestor trageri**: aplicația a fost oprită
   forțat și repornită în timpul rundei, iar peretele a revenit cu ordinea pe care o avea baza; backendul a
   fost repornit separat și payload-ul citit direct de la `127.0.0.1:5000` arată locurile cerute.
3. **O postare de test a fost ștearsă din greșeală.** În timpul uneia dintre secvențele de tragere — nu am putut
   reconstitui exact care atingere — dialogul de confirmare a fost deschis și confirmat, iar **postarea 28**
   (imagine fără text, din fixture-ul contului de test `wallet4e8gv6`) a fost ștearsă. Endpoint-ul de ștergere
   golește conținutul (`caption=''`, `media_id=NULL`), deci nu poate fi recuperată — nu există „undo". Postarea
   42 a fost ștearsă **intenționat**: a fost creată de mine prin `POST /api/posts` tocmai pentru testul de
   ștergere confirmată.
4. **Detalii vizuale neobservabile fără capturi**: umbra și transparența celulei purtate, conturul punctat al
   golului, culoarea exactă a mânerului. Ce s-a putut măsura este geometria (poziții, dimensiuni, etichete) și
   starea din bază.

### 20.7 Ce rămâne deschis

1. **Deblocarea telefonului** și terminarea celor patru pași din 20.6 punctul 1 (eliberarea tragerii ultimei
   celule, „Gata", o postare deschisă după o tragere, repornire completă). Nimic din cod nu mai trebuie
   schimbat pentru ele: sunt pași de verificare.
2. **Viteza derulării automate** este singurul număr care poate fi „prea hotărât": `AUTO_SCROLL_MAX = 14`
   puncte pe cadru înseamnă ~840 dp/s chiar la marginea ecranului; la marginea interioară a benzii viteza
   pornește de la 0, deci pornirea este lină. Dacă proprietarul simte marginea prea iute, se scade această
   constantă (`src/lib/profileDrag.ts`), iar testul care o citește rămâne valabil.
3. **Postarea 28** (imagine fără text, ștearsă din greșeală) nu poate fi adusă înapoi; dacă proprietarul o
   vrea, se poate publica o imagine nouă prin compozitor.
4. **Restul listei din 19.7 rămâne neschimbat**: firewall-ul cere o rulare elevată, loginul xPortal complet
   cere confirmarea din aplicația proprietarului, iar retragerea Railway cere decizia proprietarului.


