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


## 21. Runda a șaptesprezecea — grila care se derulează singură, fără instrucțiuni, și pagina de citit (27 octombrie 2026)

Proprietarul a testat runda a șaisprezecea pe Xiaomi și a raportat trei lucruri: o fotografie se poate trage
doar în ecranul care se vede (grila nu se derulează sub deget), textul „Aranjează grila" de deasupra peretelui
este de prisos, iar postările de text arată ca niște dreptunghiuri verzi goale în loc să semene a pagină de
citit. Toate trei sunt reparate aici, iar fiecare are dovadă numerică de pe telefon, nu doar test automat.

### 21.1 Ce era de fapt stricat la derularea automată

Runda trecută *credea* că derularea de margine merge, pentru că testele ei treceau și pentru că „golul" alerga
la `Poziția 13 din 13`. Ce nu măsura nimeni atunci era peretele: un gol poate ajunge la ultimul loc și fără ca
grila să se fi mișcat, pentru că locul se calculează din deget + derulare. Patru defecte, toate găsite aici:

1. **Ceasul era `setInterval(16)`.** Un timer nu are cadru: când JS-ul se încarcă, tick-urile se adună sau se
   pierd, iar viteza „14 puncte pe cadru" devine altă viteză decât cea gândită. Acum bucla este
   `requestAnimationFrame`, iar viteza este în **puncte pe secundă** înmulțită cu durata reală a cadrului
   (`autoScrollStep`).
2. **Cutia măsurată era un `View`-wrapper** (`shellRef.measureInWindow`). Un `View` fără alt rol poate fi
   aplatizat din arborele nativ, iar un `View` aplatizat se măsoară ca zero — cu înălțime 0, nicio bandă de
   margine nu există, deci derularea nu pornește niciodată. Acum se măsoară **scrollerul** însuși
   (`scrollRef.measureInWindow`), cu rezervă pe `Dimensions.get('window')`, iar telemetria de pe telefon
   raportează `measured: "scroll"`.
3. **`clampScroll(…, contentAt.current, …)` cu `contentAt = 0`** răspundea „nu se poate derula", pentru că
   înălțimea conținutului sosește cu câteva cadre după montare. Zero însemna „nemăsurat", nu „perete gol".
4. **Dubla numărare a derulării** — defectul cel mai scump. `applyFinger` trimitea lui `moveDrag` deplasarea
   degetului **plus** derularea, iar `dragCentre` adăuga derularea încă o dată: în timpul derulării automate
   golul alerga de două ori mai repede decât peretele, deci o tragere lungă elibera celula la câteva rânduri
   de deget. Acum `moveDrag` primește deplasarea degetului și derularea separat (le adună o singură dată, în
   coordonatele conținutului), iar fața purtată primește suma lor.

Al cincilea lucru s-a văzut abia pe telefon, în telemetrie: **banda de jos era prea sus cu 177 de puncte**.
Insetul fusese ghicit (`navReserve + 76`), dar docul de aranjare stă în spațiul *de sub* scroller, nu peste
el, deci peretele începea să alunece la o treime de ecran. Acum marginea docului este **măsurată**
(`dockRef.measureInWindow`), iar banda este ultima parte a cutiei scrollerului care nu e acoperită.

### 21.2 Modelul de derulare, ca numere

| Mărime | Valoare | De ce |
| --- | --- | --- |
| banda de margine | 88 pt | cât un deget lung la capătul de jos al ecranului |
| viteză la marginea interioară | 120 pt/s | pornește lin, nu sare |
| viteză la marginea ecranului și dincolo | 460 pt/s | ~1,7 rânduri pe secundă; fosta 840 era prea iute |
| rampă la intrarea în bandă | 200 ms | o schimbare bruscă de viteză se simte ca un gest furat |
| cadru maxim plătit | 64 ms | o oprire a JS-ului nu teleportează peretele |
| histerezis de țintă | 20% dintr-o celulă | un deget nemișcat nu clipește între două locuri |

Bucla rulează pe cadre proprii, deci merge și când degetul stă nemișcat (nu depinde de evenimente de
mișcare), se oprește imediat ce degetul iese din bandă și nu termină niciodată gestul: doar eliberarea, anularea
sau ieșirea din mod o fac.

### 21.3 Fără „Aranjează grila"

Bara de deasupra peretelui a fost scoasă cu totul, în ambele moduri (`styles.manageBar` nu mai există). Modul
se deschide prin apăsare lungă pe o celulă (prag 500 ms, deja existent), iar ieșirea este docul de jos
(`Gata`), desenat în afara scrollerului. Pentru cititorul de ecran: fiecare celulă are în continuare
`accessibilityHint` („… Ține apăsat pentru a aranja grila."), docul se numește „Aranjarea grilei", iar
butonul lui „Gata, păstrează ordinea". Peretele pornește acum imediat sub taburi, la fel în ambele moduri,
deci intrarea în mod nu mai poate mișca nimic: nu există o bară care să apară sau să dispară.

### 21.4 Celula de text: o pagină, nu un dreptunghi verde

`src/lib/profileTextTile.ts` (nou, pur) răspunde la patru întrebări pentru fiecare postare — ce cuvinte, ce
mărime, câte rânduri, dacă pagina continuă — iar `src/components/ProfileTextTile.tsx` (nou) desenează răspunsul.

- **Titlul** este cel stocat: `publishing.title`, sau primul *heading* al documentului editorial. O postare
  fără titlu **nu** primește unul inventat din prima frază (multe dintre postările de aici nu au titlu).
- **Textul** este `caption` (paragrafele documentului când există), tăiat la 760 de caractere pe graniță de
  cuvânt; un titlu repetat ca primă linie nu se tipărește de două ori.
- **Mărimea** vine dintr-o scară (17, 16, 15, 14, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5) filtrată pe formă
  (o notă scurtă până la 17, un articol lung până la 11) și aleasă de numărul real de rânduri care încap în
  cutia măsurată a celulei. Sub 9.5 nu se coboară: acolo textul devine textură, nu frază.
- **Cele patru cazuri** din cerință: titlu + extras; notă scurtă fără titlu (mare, centrată optic, ca o pagină
  de titlu); articol lung fără titlu (începutul lui, 13+ rânduri, estompat la picioare); articol cu fotografii
  (`stageFor(post) === 'article'`) — pagina rămâne pagina, cu o bandă de imagine de 40% din măsură sub titlu,
  niciodată o fotografie care înghite textul.
- **Hârtia** este un token nou (`socialTokens.reading`): `#f5f0e4` cald, cerneală `#1b1a17`, serif, margine
  9 pt, filet subțire colorat cu accentele temei postării — tema autorului rămâne vizibilă fără să întoarcă
  celula în capac colorat.
- Celula se măsoară o dată (`onLayout`) și își recalculează pagina doar când cutia sau postarea se schimbă;
  articolul întreg nu se randează niciodată în grilă, iar atingerea deschide exact postarea, în readerul
  editorial de dinainte.

### 21.5 Ce a rulat automat (rezultate reale)

- `node scripts/test-profile-drag.cjs` — **15/15**. Noile teste: viteza pe secundă și independența de durata
  cadrului, cadrul blocat plătit o singură dată, „un perete nemăsurat nu este un perete care nu se poate
  derula", o simulare cadru cu cadru a unei trageri pe 30 de rânduri (peretele parcurge peste 600 pt, celula
  ajunge la al 5-lea rând sau mai jos, rămâne lipită de deget, ordinea scrisă are fiecare celulă o singură
  dată), direcția inversă până la primul rând, oprirea imediată la mijlocul ecranului, limitarea la capătul
  peretelui, plus contractele de sursă: buclă pe `requestAnimationFrame` (niciun `setInterval`), măsurare pe
  scroller cu rezervă pe fereastră, deplasarea degetului și derularea adunate o singură dată, docul măsurat.
- `node scripts/test-profile-grid.cjs` — **16/16**, cu contractele schimbate: „Aranjează grila" nu mai există
  în sursă, bara nu mai are nici stil, nici înălțime de 60, iar etichetele de accesibilitate rămân.
- `node scripts/test-profile-text-tile.cjs` **(nou)** — **10/10**: cele patru cazuri, diacritice/hashtag-uri/
  cuvinte lungi, text gol sau JSON stricat, mărimea urmând măsura paginii, pagina fiind hârtie caldă fără
  mușchi și fără frunză, plus contractul „atingerea deschide postarea întreagă".
- `node scripts/test-profile-thumbnails.cjs` — **6/6** (contractul vechi al capacului de temă a fost inversat).
- Lanțul complet al aplicației mobile: **42/42** scripturi, **365** de cazuri `node:test`, zero eșecuri.
- `node node_modules/typescript/bin/tsc --noEmit` — curat.
- Backend: `node --test test/*.test.js` — **853/853** (nimic din backend nu a fost atins în această rundă).
- Rămâne un singur eșec în `scripts/`, și este **dinainte de rundă**: `test-ticker-parity.cjs` nu este în
  lanțul `test` și pică pentru că `apps/nexus-web/public/profile-ticker.js` nu mai are forma valului 14i.

### 21.6 Ce s-a dovedit pe telefon (Xiaomi 25098PN5AC, 1220×2656, density 416)

Fără capturi de ecran (conducta de screenshot eșuează pe acest telefon): arborele de accesibilitate, telemetria
`__PROFILE_GRID.auto` din `logcat -s ReactNativeJS` și baza de date din `C:\Nexus\data\nexus.sqlite`.

| # | Ce s-a făcut | Ce s-a citit |
| --- | --- | --- |
| 1 | apăsare lungă pe prima celulă | modul s-a deschis, iar `Postarea 33 din grilă` stă la `[0,1087][403,1803]` — **exact** dreptunghiul lui `Deschide postarea 33` de dinainte; peretele nu se mișcă |
| 2 | arborele în modul de aranjare | `Aranjează grila` **nu există** în arbore; docul are `Aranjarea grilei`, `Gata, păstrează ordinea` și linia „Trage de mânerul ≡ …" |
| 3 | deget ținut 1,8 s la mijlocul ecranului (y=1500) | nicio derulare: celulele 32/39/40 rămân la `[408,1087]`, `[817,1087]`, `[0,1809]`, golul rămâne `Poziția 1 din 12` |
| 4 | deget mutat în banda de jos (y=2100) și ținut 2 s | peretele a urcat: celula 41 de la `y=1809` la `y=150`, golul a trecut `1 → 7`; telemetrie: `rate 219,5 pt/s`, `scroll 710,4 pt`, `content 1674,2`, `measured "scroll"`, `finger 807,7`, 422 de cadre |
| 5 | deget mutat înapoi la mijloc | golul a rămas `Poziția 7 din 12` la două citiri la 1,6 s distanță, iar celula 41 a rămas la `[0,150]`: derularea **se oprește** |
| 6 | deget ținut în banda de sus (y=120) | `rate −460 pt/s`, `scroll 710,4 → 0`, golul `7 → 1`: derularea în sus merge |
| 7 | deget coborât din nou la marginea de jos, apoi eliberat | golul a ajuns `Poziția 12 din 12`; baza: `posts.grid_position` pentru 33 a trecut `0 → 11`, restul s-au strâns cu un loc; docul: „Ordinea a fost salvată." |
| 8 | imediat, fără ieșire din mod, tragerea aceleiași celule înapoi în frunte | peretele s-a derulat în sus până la `scroll 0`, golul `Poziția 1 din 12`, iar baza a revenit exact la ordinea de dinainte: `33(0), 32(1), 39(2), 40(3), 41(4), 38(5), 31(6), 30(7), 29(8), 27(9), 26(10)`, repostarea 15 la `11` |
| 9 | 📌 pe postarea 33, apoi din nou | eticheta a devenit `Scoate din fixate postarea 33`, baza: `pinned_at=1793126168`; scoaterea din fixate a adus `pinned_at=null` și aceeași ordine |
| 10 | 🗑️ pe postarea 33, apoi `Anulează` | dialogul `Confirmarea ștergerii` s-a închis, postarea 33 este `active`, ordinea neatinsă |
| 11 | `Gata` | modul s-a închis, celula 33 stă tot la `[0,1087][403,1803]`: ieșirea nu mișcă peretele |
| 12 | glisare pe corpul unei celule în modul de aranjare | peretele s-a derulat și **nu** a pornit nicio tragere (niciun nod `Poziția …` în arbore) |
| 13 | tap pe pagina de text a postării 39 | readerul editorial s-a deschis cu „Postarea 3 din 12" și „Înapoi la profil"; `Back` a adus grila exact la poziția de dinainte |
| 14 | oprire forțată + pornire la rece | grila a revenit cu aceeași ordine (`33, 32, 39 / 40, 41, 38 …`) |
| 15 | paginile de text, măsurate în arbore | postarea 31 („Corect 🌿 🌿 🌿", 12 caractere): un rând de 68 px (26 pt, adică 17 pt cu lineHeight 1,5), așezat centrat la `y=1011` în celula `[0,684][403,1400]`, cu marginea de 24 px (9 pt); paginile lungi (575 și 757 de caractere) se desenează în blocuri de 481 px (13 rânduri) și se taie acolo, nu ies din celulă |

Ce spune asta despre cele trei raportări: o fotografie **poate** fi dusă dincolo de ecran și înapoi (rândurile
4, 6, 7, 8), „Aranjează grila" nu mai există (rândul 2), iar celulele de text conțin cuvintele reale, tipărite
ca pagină (rândul 15), cu aceeași identitate de articol când postarea are și fotografii (rândurile 13 și 15).

### 21.7 Ce rămâne deschis

1. **Fără capturi de ecran**, deci nimic despre *aspect* nu poate fi afirmat cu dovadă: umbra celulei purtate,
   nuanța exactă a hârtiei, contrastul perceput al filetului de temă. Ce este dovedit este geometria
   (dreptunghiuri, înălțimi de rând, margini) și textul care ajunge pe ecran.
2. **Un artefact de dezvoltare, nu al produsului**: un Fast Refresh care aterizează în mijlocul unei trageri
   lasă gestul fără țintă nativă, deci `UP`-ul nu mai ajunge la aplicație și bucla continuă până la repornire.
   Nu s-a scris nimic în bază (verificat), iar în release reîncărcarea nu există; dacă se dorește, se poate
   adăuga un `AppState`/reload guard în runda următoare.
3. **Viteza** este acum 120–460 pt/s, măsurată pe telefon ca 219 pt/s la mijlocul benzii și 460 la margine.
   Este singurul număr pe care proprietarul poate vrea să îl simtă altfel: se schimbă în
   `src/lib/profileDrag.ts` (`AUTO_SCROLL_MIN_SPEED`, `AUTO_SCROLL_MAX_SPEED`), iar testele citesc constantele.
4. **Rândul de jos al peretelui trece pe sub banda de navigare**, deci butoanele 📌/🗑️ ale unei celule din
   ultimul rând parțial vizibil pot fi acoperite până când peretele este derulat. Este dinainte de rundă și
   ține de geometria ecranului, nu de gest.
5. **Postarea 28** (imagine ștearsă din greșeală în runda trecută) rămâne pierdută; restul listei din 19.7
   (firewall elevat, login xPortal, decizia despre Railway) este neschimbat.

## 22. Continuarea rundei a șaptesprezecea — peretele și readerul citesc o singură listă (27 octombrie 2026)

### 22.1 Ce era de fapt stricat: două liste, nu una

Peretele și readerul pe care îl deschide o celulă compuneau ordinea de două ori, din două surse:
`ProfileScreen` aduna benzile din `archiveNodes` plus două funcții locale (`nodesOfTab`, `whisperTiles`),
iar `app/post/[id].tsx` își reconstruia lista din `answer.posts` — răspunsul lui `GET /api/posts/:id`.

Diferența nu era cosmetică. **O repostare nu este în `posts`**: ea stă în `archive.posts` cu cheia
`repost-<share_id>`, iar locul ei vine din `post_shares`, nu din postarea dusă. Citită cu
`arrangementMap(answer.posts)`, repostarea nu avea **niciun** loc, deci cădea înaintea fiecărei celule
aranjate, iar readerul, după ce deschidea postarea atinsă, mergea în ordinea greșită a peretelui (înapoi).
Măsurat pe fixture: `['repost-4', 'post-12', 'post-13', 'post-14']` în loc de
`['post-12', 'post-13', 'post-14', 'repost-4']`.

### 22.2 O singură definiție, două consumatoare

`src/lib/profileContent.ts` ține acum peretele într-un singur loc:

- `flowBands(bands, columns = 3)` — adună celulele Flow (postări și whispers) în rânduri pline de trei, iar
  cardurile de răspuns partajat sunt puse **după** perete;
- `wallBands(archive, tab, reading, { arrangement?, columns? })` — `flow` → `flowBands(archiveBands(archiveNodes(...)))`;
  taburile de colecție → `tileBands` peste `contentOfTab(orderArchive(archive.posts, ...))`; `moments` → nicio postare;
- `wallPosts(bands)` — aplatizează benzile în lista pe care o parcurge degetul (celule și whisper, **fără**
  cardurile de răspuns).

`ProfileScreen` cheamă `wallBands(archive, tab, readings[tab], { arrangement, columns: socialTokens.archive.gridColumns })`
și `wallPosts(bands)`; `app/post/[id].tsx` cheamă
`wallPosts(wallBands(archive, tab, reading, { arrangement: arrangementMap(archive.posts) }))`.
Cele două funcții locale din ecran (`nodesOfTab`, `whisperTiles`) și importurile `archiveBands`, `archiveNodes`,
`contentOfTab`, `tileBands`, `orderArchive`, `PROFILE_ARCHIVE_LIMIT` au fost șterse, din ecran și din rută.

`arrangementMap(archive.posts)` este argumentul care poartă adevărul: `archive.posts` conține și repostările
(cu cheia lor `repost-<share_id>`), deci fiecare celulă are locul pe care proprietarul l-a tras. Locul celulei
nu mai călătorește prin `door.index`: celula își spune **identitatea** (`archiveKey`), iar ruta o caută cu
`walkAnchor(list, { key, id })` — o repostare și postarea dusă au același `id`, deci un index nu le putea deosebi.

### 22.3 Golul dintre celule: rândurile scurte

Un card de răspuns partajat rupea rândul de celule, lăsând un rând de unul sau două și două treimi goale —
„golul neexplicat" din raportare. `flowBands` adună celulele în ordinea lor peste carduri și le taie în rânduri
pline de trei; `archiveBands` rămâne neatins, deci paritatea cu web-ul (`test-profile-content-parity.cjs`)
citește aceleași găleți ca înainte.

### 22.4 Un card nu este o pagină

`wallPosts` sare peste `band.kind === 'reply'`: un răspuns partajat se vede pe perete, dar nu poate fi nici
parcurs cu degetul, nici deschis ca postare. Testul numără exact asta (`cells.length === archive.posts.length`).

### 22.5 Tema implicită a paginii de cuvinte: hârtia, până la celulă

- `ProfileTextTile` avea ultimul „jungle" scris de mână: filetul celulei lua accentul lui `'jungle'` când
  postarea nu are `text_style`, deși readerul aceleiași postări se deschidea pe hârtie (`TEXT_DEFAULT_THEME`).
  Acum ia accentul temei implicite, iar `test-profile-text-tile.cjs` refuză literalul `'jungle'` în componentă.
- Compozitorul (`app/text.tsx` → `loadTextDraft` → `readTextStyle(null)`) și feed-ul (`PostCanvas` →
  `defaultTextStyle()`, ca și `EditorialArticle`) se deschideau deja pe `#f4efe2`/`#1a221b`. O pagină scrisă
  de autor își pictează tema peste tot cadrul (fără grove și fără voal), iar o postare **fără** stil rămâne pe
  compoziția ei veche — contractul „absent înseamnă «fără stil», nu «implicit»" din `test-text-style.cjs`.

### 22.6 Ce a rulat automat (rezultate reale)

- `npm test` în `apps/nexus-mobile` — **42/42** scripturi, **365** de cazuri `node:test`, zero eșecuri.
- `node --test scripts/test-profile-grid.cjs` — **18/18**, cu testul nou „the wall and the reader draw one
  list, and a repost stands where the owner dragged it": fixture de trei postări + o repostare + un răspuns
  partajat, ambele ordini dovedite (cea stricată și cea corectă), cardul rămâne în benzi dar
  `cells.length === archive.posts.length`, `whispers` → `['post-12', 'post-14', 'repost-4']`, `moments` → `[]`.
  Contractele de sursă cer `wallBands(archive, tab, reading, { arrangement: arrangementMap(archive.posts) })`
  și `wallPosts(` în rută, `wallBands(... readings[tab] ...)` și `wallPosts(bands)` în ecran, și **interzic**
  `arrangementMap(answer.posts`, `archiveNodes`, `archiveBands`, `contentOfTab`, `tileBands` și `placeOf`.
- `tsc --noEmit` — curat.
- Backend: `node --test test/*.test.js` — **853/853** (backendul nu a fost atins).

### 22.7 Ce s-a dovedit pe telefon

Nimic în această rundă: conducta ADB a rămas fără ieșire (`adb` și `uiautomator dump` întorc gol), deci nu s-a
putut atinge un perete mixt, nu s-a putut rearanja o repostare și nu s-a putut verifica restaurarea poziției
după `Back`. Ce este dovedit este lista: cele două ecrane cheamă aceeași funcție, iar testul de mai sus citește
ordinea pe care o vor desena amândouă.

### 22.8 Ce rămâne deschis

1. **Verificarea pe telefon** a peretelui mixt (10+ celule, cu repostări), a rearanjării unei repostări, a
   repornirii la rece și a `Back`-ului care trebuie să aducă peretele la celula atinsă — blocată pe ieșirea ADB.
2. **Postările vechi fără `text_style`** rămân pe compoziția jungle (voal stins, `JungleGrove`): este contractul
   scris, nu o scăpare. Dacă proprietarul vrea hârtie și pentru ele, se schimbă o singură linie în `PostCanvas`
   (`authored ?? defaultTextStyle()`) și, odată cu ea, contractele din `test-nav-band.cjs`.
3. **`test-ticker-parity.cjs`** rămâne singurul eșec din `scripts/` și este dinainte de rundă
   (`apps/nexus-web/public/profile-ticker.js` nu mai are forma valului 14i); nu este în lanțul `test`.
4. Restul listei din 21.7 (capturile de ecran, guard-ul de reload, viteza de auto-derulare, rândul de sub banda
   de navigare, postarea 28 pierdută) este neschimbat.






## 23. Hârtia peste tot — tema nu mai este pagina (27 octombrie 2026)

### 23.1 Decizia

Proprietarul a ales **opțiunea 3 — paper everywhere**: orice pagină de cuvinte și orice articol se citește pe
**aceeași** hârtie caldă (`#f4efe2`), cu cerneala întunecată a hârtiei (`#1a221b`), în compozitor, în feed, pe
celula peretelui, în reader și în previzualizare. Tema nu mai este pagina: din ea rămân **fața, măsura,
alinierea și accentul** — un filet deasupra titlului, linia din capul articolului, rama unui chip. Nicio pagină
întunecată nu se mai poate desena, nici pentru un rând scris acum, nici pentru unul scris în august.

Normalizarea se face **numai la pictare**, în `pagePaletteOf` (`src/lib/textStyle.ts`): rândul stocat nu este
rescris, iar conținutul utilizatorului nu este atins. Dovada e în baza de date, nu în intenție: postările
38–41 au în `text_style_json` exact ce au avut dintotdeauna.

```
id | has_document | theme  | font  | background | caption chars
38 | 1            | jungle | serif | #0b1f16    | 741
39 | 1            | jungle | serif | #0b1f16    | 458
40 | 1            | jungle | serif | #0b1f16    | 539
41 | 1            | jungle | serif | #0b1f16    |  96
```

### 23.2 Două accente, nu unul

O pagină are nevoie de două feluri de „accent”, iar înainte erau amestecate:

- `accent` — accentul **autorului** (`TEXT_THEMES[theme].accent`): numai **decor**. Filetul de sub nume, linia
  din capul articolului, rama chipului de traducere, conturul unei fotografii selectate.
- `mark` — accentul **hârtiei** (`TEXT_THEMES.paper.accent`, adică `#2f5d45`): numai cuvinte care trebuie
  **citite** — un tag, o mențiune, un link, cursorul, eticheta `Vezi traducerea`. Aurul pe crem (`#c9a227`) este
  un filet frumos și o pată ilizibilă, deci nu are voie să ajungă în text.

`pagePaletteOf(style)` întoarce exact aceste patru chei — `background`, `text`, `mark`, `accent` — și este
singurul loc din aplicație în care se hotărăște culoarea unei pagini de cuvinte.

### 23.3 Ce s-a schimbat, fișier cu fișier

- **`src/components/PostCanvas.tsx`** — pagina se recunoaște o dată
  (`pageStyle = stage === 'text' || stage === 'article' ? pageStyleForPost(post.text_style) : null`) și de acolo
  derivă tot: `pagePalette`, `pageInk`, `pageFaintInk`, `pageAccent`, `pageMark`, `pageChip`, `pageNotice`.
  Umplerea fundalului este `pagePalette.background`; voalul (`nxCanvasVeil`) are `opacity={pagePalette ? 0 : …}`,
  deci pagina nu mai primește nici grove, nici voal. Fotografiile, clipurile și Reels rămân neatinse:
  `pageStyle`/`pagePalette` sunt `null` acolo.
- **`src/components/ProfileTextTile.tsx`** — celula ia `pagePaletteOf(pageStyleForPost(post.text_style)).accent`,
  adică același resolver ca readerul; importurile `themeOf`/`TEXT_DEFAULT_THEME` au dispărut.
- **`src/app/text.tsx`** — mostrele de temă din compozitor pictează **hârtia** și doar un punct în accentul temei
  (`pagePaletteOf({ theme: item.id })`); comentariile din capul ecranului și din `applyStyle` spun acum că tema
  este accent, iar perechea de culori stocată rămâne doar pentru validarea serverului; confirmarea de publicare
  spune „Pagina ei este hârtie…”.
- **`src/components/EditorialPage.tsx`** — picta deja din `pagePaletteOf`, deci articolele cu document au trecut
  pe hârtie odată cu resolverul, fără nicio modificare în componentă.
- **`scripts/test-profile-door.cjs`** (nou, în lanțul `npm test`) — celula și pagina citită rămân aceeași
  postare: eticheta spune `post.id`, ruta cere `GET /api/posts/:id`, iar `walkAnchor` alege celula atinsă
  după cheie, nu după id (două celule pot purta același id: `post-8` și `repost-4`).


### 23.4 Tokenul hârtiei: `#f4efe2`, nu `#f5f0e4`

Jurnalul mai pomenise `#f5f0e4` (secțiunea despre celulă). Acela a fost **vechea** pereche a celulei de profil
și a fost scoasă atunci când celula a fost adusă pe pagina readerului. Hârtia canonică este `#f4efe2`/`#1a221b`
și este aceeași în toate cele patru locuri care trebuie să fie de acord:

- `apps/nexus-mobile/src/lib/textStyle.ts` → `TEXT_THEMES.paper`;
- `apps/nexus-mobile/src/theme/social.ts` → `socialTokens.reading.page` (cu comentariul care spune de ce);
- `apps/nexus-web/lib/post-text-style.js` → `paper` (perechea pe care serverul o validează la publicare);
- `scripts/test-text-style.cjs` și `scripts/test-profile-text-tile.cjs` (aserturi pe hex).

Nu s-a schimbat nimic aici: un al doilea token ar fi fost o a doua pagină. Ce s-a măsurat pe telefon este
`#f3efe3`, adică `#f4efe2` după conducta de afișare a panoului (o unitate pe R și una pe B) — nu o altă hârtie.

### 23.5 Ce a rulat automat (rezultate reale)

- `node node_modules/typescript/bin/tsc --noEmit` — **exit 0**, fără erori.
- `npm test` în `apps/nexus-mobile` — lanțul complet de **43** de scripturi, **0** eșecuri, `EXIT=0`
  (40 de suite `node:test` au raportat `fail 0`).
- Cazul nou din `test-text-style.cjs` („fiecare temă se citește pe aceeași hârtie, iar tema rămâne doar
  accentul”): pentru toate cele șase teme, `background`/`text` sunt perechea hârtiei, `mark` este accentul
  hârtiei, `accent` este accentul temei, iar contrastul hârtie/cerneală trece AAA; un rând `jungle` **cu
  document** se citește pe hârtie fără să fie rescris; `pageStyleForPost(null)` este `defaultTextStyle()`.
- `test-nav-band.cjs` citește acum ramura paginii din `PostCanvas` (`pagePalette`, voalul cu
  `opacity={pagePalette ? 0 : …}`), iar `test-profile-text-tile.cjs` refuză `themeOf`/`TEXT_DEFAULT_THEME`
  în celulă.
- Suita nouă `test-profile-door.cjs` (5 teste, intrată în lanțul `npm test` după `test-profile-grid.cjs`)
  leagă eticheta celulei de pagina deschisă: pentru fiecare celulă, `Deschide postarea ${post.id}` numește
  exact `id`-ul pe care ruta îl cere serverului, iar `walkAnchor` întoarce celula atinsă — inclusiv pe un
  perete care ține **același `post.id` de două ori** (`post-8` al proprietarului și `repost-4`, care îl
  distribuie): etichetele sunt identice, cheile nu, iar ancora pe id singur ar deschide cealaltă celulă. O
  celulă pe care arhiva nu o mai ține (`post-99`) dă `-1`, deci ruta deschide postarea apăsată singură.


### 23.6 Ce s-a văzut pe Xiaomi (1220×2656, dev build, Metro)

Telefonul era conectat (`adb devices -l` îl arată de două ori — aceeași serie pe două transporturi, deci se
cheamă mereu cu `-s 192.168.1.184:39097`), aplicația în prim-plan, contul `@wallet4e8gv6`.

1. **Celula peretelui** (`docs/vision/paper-profile-grid.jpg`) — grila contului `@wallet4e8gv6`, unsprezece
   celule. Toate postările de cuvinte `jungle` (39 „Riscul real…”, 40 „Railway Trial Plan”, 41 „Test privat
   local…”, 38 „La 30 septembrie…”, plus „Revolut idei”) se văd ca **pagini de hârtie**: cerneală serif
   întunecată pe crem, cu filetul auriu al temei deasupra cuvintelor. Celulele cu fotografie (echipamentul,
   becul) rămân fotografii. Etichetele celulelor sunt stabile (`Deschide postarea 41`).
2. **Pagina deschisă din celulă** — ruta scrie „Postarea 5 din 12” și „Înapoi la profil”, deci celula atinsă
   își spune identitatea, iar pagina deschisă este a ei (postarea 41, cu fotografia ei).
3. **Articolul 40** („Railway Trial Plan”, `jungle` + document) — pagina caldă, cerneală serif întunecată,
   fotografia în blocul ei, filet auriu sub nume, chip `Vezi traducerea` cu rama accentului, contor „1/2”.
   Captură: `docs/vision/paper-article-40-jungle-on-paper.jpg`.
4. **Articolul 41** („Test privat local…”, `jungle` + document, cu fotografie) — aceeași pagină, în walk:
   „Postarea 5 din 12”. Captură: `docs/vision/paper-article-41-jungle-on-paper.jpg`.
5. **Articolul 41, citit singur** (`nexusdev://post/41`, fără banda de jos) —
   `docs/vision/paper-reader-post-41.jpg`: aceeași pagină, cu chip `Vezi traducerea` în rama aurie a temei și
   eticheta în verdele hârtiei.
6. **Articolul 41 în feed** (`docs/vision/paper-feed-first.jpg`) — aceeași pagină, dar cu banda de navigare jos
   („Acasă / Mesaje / Găsește oameni și conținut / Creează / Prieteni / Live / Profil” în ierarhia de
   accesibilitate, fără „Postarea X din 12”): feed-ul pictează aceeași hârtie ca readerul, iar pagina se
   prezintă ca „Pagina articolului”.
7. **Compozitorul** (`docs/vision/paper-composer.jpg`) — fila nouă este hârtie, cu invitația în serif și filetul
   verde al hârtiei (`#2f5d45`) deasupra: tema nu mai pictează pagina nici aici.
8. **Postarea cu fotografie din feed** — neschimbată: fotografia umple cadrul, numele și meta stau pe voal.
   Captură: `docs/vision/paper-feed-photo-unchanged.jpg`. `pagePalette` este `null` acolo, exact cum trebuie.
9. **Proba de culoare**, nu de impresie: PNG-urile păstrate (`-KeepPng`) au fost eșantionate, iar hârtia este
   aceeași în toate suprafețele — `#f3efe3` în walk (patru puncte), în compozitor (trei), în celula 41 (două) și
   în readerul singur (trei). Aceeași măsurătoare arată și că tokenii sunt cei din cod, nu alții: hârtia
   `#f4efe2` → `#f3efe3`, aurul temei `#c9a227` → `#c3a342`, verdele hârtiei `#2f5d45` → `#3a5c47` (bufferul
   ecranului mută o culoare saturată mai mult decât un crem aproape neutru). Înainte de schimbare, același ecran
   se deschidea pe `#0b1f16`.
10. Toate capturile au fost făcute **numai** cu `tools/images/safe-screencap.ps1` (wrapperul peste
   `scripts/capture-android-screen.ps1`), niciodată cu `adb exec-out screencap`.

### 23.7 Ce rămâne deschis

1. **Tragerea în grilă după schimbarea `Pressable`/paginii** — de reîncercat pe telefon: rearanjare,
   repornire la rece, poziția păstrată. (Celulele răspund în continuare la atingere: eticheta
   `Deschide postarea N` deschide exact postarea N, iar `test-profile-door.cjs` ține această legătură.)
   La închiderea rundei telefonul era luat în mână (`mCurrentFocus=com.instagram.android/.InstagramMainActivity`,
   citit cu `dumpsys window`), deci gestul rămâne de făcut de proprietar — `safe-screencap.ps1` refuză corect
   o captură când fereastra activă nu este a noastră.
2. `test-ticker-parity.cjs` rămâne singurul eșec din `scripts/` și este dinainte de rundă
   (`apps/nexus-web/public/profile-ticker.js` nu mai are forma valului 14i); nu este în lanțul `test`.


## 24. Redistribuiri, paleta, banda și editorul — runda de reparat (27 octombrie 2026)

### 24.1 Punctul de plecare (măsurat, nu presupus)

- `HEAD` = `573a798`, branch `codex/camera-draft-stability`, 47 fișiere modificate + 230 nepublicate,
  moștenite din rundele anterioare. Nimic nu s-a pierdut: runda lucrează peste ele.
- Telefonul era pe **Instagram**, apoi pe **Settings/Bluetooth**. A fost readus în aplicație cu
  `am start -n app.nexus.mobile.dev/.MainActivity` (mecanismul normal de lansare), nu cu alt build.
- Backend-ul care hrănește telefonul NU este cel din repo: `apiOrigin.ts` ia gazda Metro și portul 5000,
  iar procesul care ascultă pe 5000 rulează din **`C:\Nexus`** cu baza `C:\Nexus\data\nexus.sqlite`.
  Contul logat este **user 12** (`wallet4e8gv6`, persona social) — nu user 13 din
  `apps/nexus-web/data/nexus.sqlite`, pe care prima verificare îl citise degeaba. Toate dovezile de API
  din runda asta se citesc din baza vie.
- `animator_duration_scale = 0`, `transition_animation_scale = 0`, `window_animation_scale = 0` pe Xiaomi.

### 24.2 Ce s-a dovedit stricat, cu cauza

1. **Banda profilului stă pe loc.** `ProfileBand` citește `AccessibilityInfo.isReduceMotionEnabled()`,
   care pe Android este chiar `ANIMATOR_DURATION_SCALE`; telefonul are toate cele trei scale pe 0, deci
   ramura „reduced motion" oprește linia la zero. Regresia a intrat pe 26 octombrie, când oprirea a fost
   adăugată ca să poată fi citită ierarhia UI pe telefon — adică exact efectul secundar pe care îl
   raportează proprietarul. `lib/bandMotion.ts` scrie deja decizia de produs („comutatorul produsului,
   nu al sistemului"), deci codul contrazicea documentul.
2. **Editorul de profil nu se poate salva.** Câmpurile, validarea și `PATCH /api/persona/social` merg
   (dovadă: numele a fost schimbat și scris în bază). Dar foaia are `maxHeight: '92%'` fără `flexShrink`
   pe `ScrollView`, deci rândul de salvare iese sub bara de navigație a sistemului: atins în mijloc,
   evenimentul ajunge la butonul Home și aplicația pleacă pe launcher (măsurat: `input tap 600 2545` →
   launcher; `input tap 600 2500`, în sliverul de deasupra barei → salvare scrisă în bază).
3. **Paleta de reacții** răspunde (hold 700 ms o deschide, glisarea alege, eliberarea scrie în
   `post_reactions`), dar creșterea sare din celulă în celulă: `hover` este un indice întreg, iar
   `Animated.spring` aleargă după el. Proprietarul cere ca emoji-ul să crească *continuu*, cât timp
   degetul se apropie, iar rândul să stea mai sus.


### 24.3 Ce s-a schimbat (fișiere și de ce)

1. **Redistribuiri** — `lib/profileContent.ts`: al cincilea tab este `redistribuiri`
   (`CONTENT_TAB_LABELS` → „Redistribuiri", glifa `⟳`, `CONTENT_KINDS.redistribuiri = 'repost'`,
   propozițiile stării goale). `contentOfTab` citește *nodul* (`__repost`), nu un tip de postare, iar
   `wallBands` păstrează ordinea arhivei pentru acest tab (un tab de colecție pune altfel media înaintea
   cuvintelor). `repostAttribution` scrie o linie: „Ai redistribuit" / „Redistribuit de @handle" /
   „Redistribuit"; `ProfileTile` o pune ca chip pe o celulă cu imagine, `ProfileTextTile` o tipărește pe
   hârtia paginii — o dată, niciodată de două ori. `ProfileScreen` nu mai are ramura `moments`; raftul de
   story-uri salvate rămâne desenat pe **Flux**, deasupra peretelui și doar când are ce arăta. Tab-ul
   `moments` a fost *înlocuit*, nu dublat. `ProfileEmptyState` are icoana de distribuire.
2. **Paleta de reacții** — `lib/reactionPicker.ts` are acum `pickerPositionAt` (poziția *continuă* a
   degetului, în celule: 0 … count-1, `-1` în afara pastilei) lângă `pickerIndexAt` (celula, care este
   `floor`-ul aceleiași funcții); `PICKER_GROW = 1.32`, `PICKER_LIFT = -10`. `ReactionControl` scrie
   fracția într-un `Animated.Value` la fiecare mișcare (`setValue`, fără re-randare) și ține `hover`
   (numele + alegerea) doar la schimbarea celulei; `ReactionPalette` interpolează fiecare față din
   fracție, deci emoji-ul crește cât timp degetul se apropie. Pastila stă mai sus: 30dp deasupra plăcii
   din rail (era 16) și 18dp deasupra plăcilor de card/whisper/row (era 6).
3. **Pagina de cuvinte** — `lib/textPage.ts` (nou, pur): `TEXT_PAGE_HEAD = { disc: 54, name: 17,
   handle: 13 }`, `TEXT_PAGE_RAIL_GUTTER = 72`, `RAIL_FOOTPRINT = 66`, `wordPageHead`, `wordPageGutter`.
   `PostCanvas` le cheamă numai pentru `page && !tile && stage ∈ {text, article}`: hârtia rămâne
   `absoluteFill`, capul crește, iar textul câștigă 6dp lățime pe care rail-ul le ținea degeaba (56dp
   celulă + 10dp margine + 6dp aer). O fotografie, un clip și o celulă primesc exact `metrics` de dinainte.
4. **Banda (ticker)** — `ProfileBand` nu mai citește setarea sistemului; se oprește pe atinsă (regula
   cititorului) și cât timp ecranul nu este în față (`active`, dat de `ProfileScreen` prin
   `useFocusEffect`), și pornește din punctul în care stătea când revine. Aritmetica este neschimbată
   (`lib/bandMotion.ts`).
5. **Editorul de profil** — `ProfileEditSheet` citește `useSafeAreaInsets()` și își adaugă insetul la
   padding-ul de jos (`SHEET_PADDING_BOTTOM = 18`), foaia poate folosi tot ecranul (`maxHeight: '100%'`),
   iar câmpurile se strâng și derulează (`scroll: { flexShrink: 1 }`) în loc să împingă salvarea sub bara
   de navigație a sistemului.


### 24.4 Ce s-a dovedit pe Xiaomi (27 octombrie, build dev de la Metro 192.168.1.153:8081)

Aplicația a fost readusă din dev-launcher (`nexusdev://expo-development-client/?url=…`) după ce
telefonul fusese în Instagram, apoi în Settings/Bluetooth — nu a fost lăsată într-o altă aplicație.

| Ce | Cum s-a măsurat | Rezultat |
|---|---|---|
| Al cincilea tab | `uiautomator dump` al profilului | „Redistribuiri" la `[884,964][1106,1084]`, glifa `⟳`; „Momente" nu mai există |
| Conținutul tab-ului | dump + `post_shares` din `C:\Nexus\data\nexus.sqlite` | exact două celule: postarea 27 (share 5) și postarea 15 (share 4) — singurele repostări ale userului 12 |
| Atribuirea | dump | chip „⟳ Ai redistribuit" pe celula video și rând „⟳ Ai redistribuit" pe pagina de hârtie |
| Identitatea | tap pe celula 1 → „1/2" cu clipul din Veneția (post 27); swipe → „2/2" cu „[test] Tweetul de verificare…" (post 15, @urailwaytest01a20d) | fiecare celulă deschide exact postarea pe care o numește |
| Starea goală | profilul @urailwaytest01a20d (nici o redistribuire) | „Nicio redistribuire încă. Postările pe care le redistribui din feed apar aici, cu autorul lor." |
| Banda: mișcare | două capturi la 1,8 s, diff pe regiunea benzii (`y 615…715` din JPG-ul de 900px) | **2963 / 22500** pixeși schimbați; antetul (control, `y 150…300`) **0 / 33750** |
| Banda: pauză/reluare | atinsă → dump-ul se așază și eticheta devine „(banda oprită)"; atinsă iar → două capturi diferă | banda se oprește și repornește din același loc |
| Banda: după navigare | cititor → înapoi pe profil → două capturi | diferă (banda a repornit la revenire) |
| Paleta: urmărirea degetului | `input motionevent` DOWN/MOVE + dump la fiecare pas, pe pagina de cuvinte | chip-ul: 950→„Like", 850→„Love", 750→„Haha", 650→„Wow" — fără salturi |
| Paleta: alegerea | UP la 650 | `post_reactions` (post 41, user 12) = **WOW**, exact emoji-ul arătat |
| Paleta: anulare | DOWN, MOVE în afara pastilei (300, 2400), UP | reacția a rămas WOW, pastila s-a închis |
| Paleta: mai sus | dump în timpul ținerii, înainte/după | chip-ul s-a ridicat cu 36px (≈13dp), exact cât s-a adăugat la `railPalette` |
| Paleta pe un Reel | gest pe pagina clipului postării 4 | „Love" crescut, chip „Love", iar `POST /api/posts/4/reaction` apare în `server-2026-10-27.log` — postarea afișată, nu alta |
| Capul paginii de cuvinte | dump | blocul autorului `[36,150][838,290]` (140px) față de `[36,150][838,259]` (109px) pe un clip — creșterea cerută, doar pe text |
| Lățimea articolului | dump | „Pagina articolului" ajunge la x=996 (era 981), iar placa reacției începe la 1048: textul nu intră sub butoane |
| Hârtia | capturi `paper-text-head`, `paper-repost-second` | pagina caldă acoperă tot ecranul, fără zone verzi/negre |
| Fotografie/clip neschimbate | dump pe clipul postării 4 | cap `[36,2041][981,2150]` = 109px, adică exact vechiul cap de 42dp |
| Editorul: salvare | „Editează profilul" → nume + `X` → tap în *mijlocul* butonului Salvează (600, 2423) | foaia s-a închis, aplicația a rămas în față, `personas.name` = „wallet4e8gv6 (social)X" |
| Editorul: restaurare | editat înapoi, salvat | `personas.name` = „wallet4e8gv6 (social)" |
| Editorul: anulare | tastat `Z`, apăsat × | antetul și baza rămân „wallet4e8gv6 (social)" |
| Editorul: așezarea | dump | „Salvează" la `[44,2361][1176,2486]`, deasupra barei de sistem (înainte `[44,2484][1176,2609]`, sub ea) |

Reacțiile atinse în timpul probei au fost puse la loc: postarea 41 are din nou `HAHA` (starea în care a
fost găsită), iar rândul creat pe postarea 4 a fost retras. Numele profilului a fost restaurat.


### 24.5 Teste automate (rulate, nu promise)

- `npm.cmd test` în `apps/nexus-mobile`: **EXIT=0**, 45 de scripturi, 42 de suite `node:test` cu
  `fail 0`. Suite noi: `test-profile-reposts.cjs` (5 cazuri) și `test-text-page.cjs` (5 cazuri).
- `node --test scripts/test-profile-grid.cjs` — 18/18 (testul benzii rescris pe regula nouă).
- `node --test scripts/test-reaction-palette.cjs` — 15/15, inclusiv cazul nou „lupa urmează degetul
  continuu".
- `node --test scripts/test-profile-content-parity.cjs` — 8/8 (al cincilea tab, raftul pe Flux).
- `node --test scripts/test-profile-edit.cjs` — 10/10 (cazul nou al insetului).
- `node --test scripts/test-profile-band.cjs` — 12/12; `test-hero-parity.cjs` și `test-band-motion.cjs`
  actualizate pe `active`.
- `npx.cmd tsc --noEmit` — curat.

### 24.6 Ce rămâne deschis

1. **Tragerea în grilă** după schimbarea `Pressable`/paginii rămâne neexersată pe telefon (aceeași
   blocare ca în §23.7: proprietarul trebuie să tragă, să repornească la rece și să vadă ordinea).
2. **`test-ticker-parity.cjs`** rămâne singurul eșec preexistent din `scripts/` (nu este în lanțul
   `npm test`, iar `apps/nexus-web/public/profile-ticker.js` nu mai are forma valului 14i).
3. Capturile care dovedesc runda sunt în `docs/vision/` (director git-ignorat): `paper-redistribuiri`,
   `paper-redistribuiri-empty`, `paper-repost-open`, `paper-repost-second`, `paper-text-head`,
   `picker2-hold`, `picker2-m2`, `picker2-reel`, `band-final-a|b`.


## 25. Ce a refuzat ownerul pe telefon: paleta, hârtia și banda (27 octombrie 2026)

Trei lucruri citite pe Xiaomi și refuzate în aceeași ieșire, toate trei de formă și niciunul de funcție:
emoji-ul crescut din pastilă nu era cel de sub deget („magnificarea nu e pe vârf"), o pagină de cuvinte
pierdea **o coloană goală pe toată înălțimea** în dreapta, deasupra unor butoane care stau doar jos, iar
banda de pe profil se mișca de parcă ar fi avut 36 de secunde pe tură, adică de 1,5 ori prea lent.

Niciuna dintre cele trei nu cerea un motor nou. Toate trei cereau ca un număr scris de mână să fie înlocuit
cu numărul pe care compoziția îl știe deja: centrul feței, dreptunghiul barei, lățimea coloanei.

### 25.1 Paleta: măsura pornea din colțul pastilei, nu din fața emoji-ului

`pickerPositionAt` împărțea poziția degetului la lățimea pastilei, dar pastila are două margini: măsura
pornea din marginea stângă, nu din centrul primei fețe, iar emoji-ul crescut ajungea decalat cu o jumătate
de celulă față de deget. Acum fracția se măsoară **din centrul feței** (`(x - edge - cell/2) / cell`), iar
alegerea ridicării se rotunjește (`Math.round` în `pickerIndexAt`, nu `Math.floor`): la mijlocul dintre două
fețe câștigă cea mai apropiată, nu cea din stânga. Rândul din dreapta (oglindit) citea aceeași pastilă cu
semn schimbat și a primit aceeași măsură.

Testul (`test-reaction-palette.cjs`) nu mai spune „un număr crește", ci exact ce trebuie: fracția 0 este

### 25.2 Coloana de hârtie: bara nu e o margine, e un dreptunghi

Defectul, spus pe scurt: pagina de cuvinte ținea liberi 66dp pe toată înălțimea ecranului pentru o bară de
butoane care stă numai în colțul din dreapta-jos. Deasupra butoanelor nu era nimic de ocolit, dar hârtia era
tot goală acolo — exact lucrul pe care ownerul l-a numit „o coloană goală pe toată înălțimea".

Ce s-a schimbat: fluxul editorial (`lib/editorialFlow.ts`) știa deja să așeze un rând în **intervalele
libere** la înălțimea lui — așa se strânge textul lângă o fotografie. Aceluiași mecanism i se dă acum și
bara: `EditorialReserve` este un dreptunghi pe care cuvintele nu au voie să-l calce, însămânțat în lista de
obstacole **pe fiecare pagină** (și reînsămânțat la `newPage()`), deci:

- rândurile care ating bara se îngustează doar ele (`freeIntervals` taie doar intervalul ocupat la acea
  înălțime), iar toate rândurile de deasupra butoanelor păstrează toată măsura paginii;
- o fotografie lată este împinsă sub dreptunghi, niciodată desenată sub un buton — se folosește exact
  regula după care o fotografie se așază sub alta;
- un text scurt (afirmația centrată) nu mai pierde nimic: `bodyGutter` este 0 pentru el.

Dreptunghiul nu este ghicit, este **derivat** din butoane (`wordPageRailReserve` în `lib/textPage.ts`):
înălțimea este numărul de celule × `RAIL_CELL` (56) + intervalele `RAIL_GAP` (2) + aerul discului sonor
(`RAIL_SOUND_AIR`, 4, doar când pagina are un clip) + 6dp de aer; lățimea este cât intră din bara de 66dp în
măsura paginii, adică 52dp pe feed (padding 14) și 50dp pe cititor (padding 16); piciorul stă unde stă ultima
celulă (`RAIL_FOOT` 26 minus `padB`), iar banda barei de tab-uri se anulează singură, fiind numărată și de
bară și de pagină. `PostRail` și-a expus cele trei numere, iar un test spune că modulul și componenta sunt de
acord — nu pot aluneca unul de altul în tăcere.

Măsurat cu motorul, pe o pagină de 365×700dp (telefonul ownerului, minus margini), articol de 40 de
paragrafe:

| Așezarea | Măsura rândului | Pagini |
|---|---|---|
| fără bară (ideal) | 339dp pe fiecare rând | 23 |
| **camera barei (nou)** | 339dp deasupra butoanelor, 307.7dp lângă ele (bara începe la 313) | **23** |
| coloana veche (66dp pe toată înălțimea) | 255dp pe fiecare rând | 25 |

Adică două pagini mai puțin pe un articol lung, iar pe ecran diferența nu e de pagini, ci de fel: jumătatea
de sus a paginii scrie până la marginea hârtiei, nu până la o linie verticală invizibilă. Pe un text scurt
(9 paragrafe) cele două așezări costă la fel de multe pagini (6), dar numai una arată ca o pagină.

Plumbul, fișier cu fișier: `EditorialReserve` + opțiunea `reserve` în `lib/editorialFlow.ts`; `RailReserve`,
`RAIL_CELL`, `RAIL_GAP`, `RAIL_SOUND_AIR` și `wordPageRailReserve` în `lib/textPage.ts`; `railReserve` în
`EditorialPage.tsx` (dreptunghiul se construiește în coordonatele paginii: `x = width - w`,
`y = height - bottom - h`) și în `EditorialArticle.tsx`; în `PostCanvas.tsx` — `authoredPage`, `railReserve`,
`bodyGutter`. Editorul (`src/app/text.tsx`) nu pasează nimic: nu are bară, iar pagina aranjată în editor
trebuie să arate exact ca pagina citită.

**centrul primei fețe**, 7.5 este centrul ultimei, glisarea celor 41 de eșantioane de la un capăt la altul
este monotonă (fără salt înapoi), `pickerIndexAt` rotunjește, rândul oglindit citește la fel, iar un deget
ridicat în afara pastilei nu alege nimic (`-1`).


### 25.3 Banda: 36 de secunde pe tură erau de 1,5 ori prea lente

`BAND_SECONDS` a trecut de la 36 la 24 în `lib/profileBand.ts`. `bandCycleMs` păstrează regula care era
bună — turul crește cu lățimea coloanei, cu minimul la `BAND_SECONDS` și plafonul la 2,5× (60s) — și doar
baza s-a schimbat, deci o coloană îngustă și una lată se mișcă în continuare cu aceeași viteză *liniară*,
nu cu aceeași durată. Comentariul constantei spune acum și de ce: ownerul a citit 36s pe telefon și i-a
numit de 1,5 ori prea lenți, iar 36 / 1,5 = 24.

### 25.4 Ce s-a dovedit (rulat, nu promis)

- `npm test` în `apps/nexus-mobile`: **45 de scripturi, toate trec** (`fail 0`), inclusiv cele trei suite
  atinse de rundă.
- `scripts/test-text-page.cjs` — 7 cazuri, două noi: „camera unei pagini de cuvinte este bara, nu o
  coloană" (lățime, înălțime pe celule, picior, cazul fără disc, paddingul cititorului) și „celula barei
  este cea din care se taie camera" (modulele nu pot divergea). Cazul vechi care cerea
  `paddingRight: railGutter` a fost rescris pe `bodyGutter`, fiindcă exact acea coloană a fost refuzată.
- `scripts/test-editorial-document.cjs` — 21 de cazuri, două noi, pe motor: niciun rând și nicio fotografie
  nu intră în dreptunghi, rândurile de deasupra butoanelor ating aceeași margine ca într-o pagină fără bară,
  cuvintele sunt aceleași, iar camera se cere pe **fiecare** pagină (un `pagebreak` nu o pierde).
- `scripts/test-reaction-palette.cjs` — 15/15, cu cazul rescris al măsurii din centrul feței.
- `scripts/test-profile-band.cjs` — 12/12, cu turul de 24s (24000ms la lățimea nominală, 48000ms la
  dublu), plafonul de 60000ms și `BAND_SECONDS === 24`.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` — curat.

### 25.5 Ce rămâne deschis

1. **Confirmarea fizică.** Toate trei sunt schimbări de formă, deci verdictul este al ownerului, pe telefon:
   emoji-ul ridicat să stea pe fața de sub deget, pagina de cuvinte să scrie până la margine deasupra
   butoanelor, banda să pară că merge, nu că se târăște. Sondele `adb input motionevent` rămân aproximative
   pentru pastilă — un deget adevărat este singura dovadă acceptată acolo.
2. **Pagina veche (fără document)** păstrează coloana: `PostTextReading` taie textul pe caractere și nu
   poate reîmpacheta un rând, deci cuvintele ar intra sub butoane. O pagină scrisă în editor are flux și
   scapă de coloană; una de dinainte de documente nu are cum.


## 26. Ce a refuzat ownerul a doua zi: pastila din spatele emoji-ului și lățimea paginii (28 octombrie 2026)

### 26.1 Punctul de plecare

- `HEAD` = `6fd70c5`; peste el stătea, necommis, runda argintiu-grafit (materialul celor șase butoane,
  documentată în `apps/nexus-mobile/MIGRATION.md` §25). Runda asta nu rescrie nimic din ea: corectează două
  lucruri pe care ownerul le-a citit pe telefon a doua zi.
- Telefonul: Xiaomi 25098PN5AC, `192.168.1.184:39097`, 1220×2656px la densitatea 416 (override) = **469dp
  lățime**. Metro pe 8081 și backend-ul pe 5000 rulau; aplicația a fost adusă în față cu
  `am start -n app.nexus.mobile.dev/.MainActivity` (mecanismul normal), nu cu alt build.

### 26.2 Ce s-a dovedit stricat, cu cauza

1. **Pastila din spatele emoji-ului.** Nu era o moștenire veche: runda de argintiu-grafit dăduse like-ului
   exact placa celorlalte patru apăsări (`railPaper`/`railNight` + `…On`, în `ReactionControl`). Ownerul a
   refuzat fundalul, nu emoji-ul.
2. **Lățimea paginii de cuvinte.** Două cauze suprapuse, amândouă măsurate pe ecran:
   `EditorialPage` compunea cu **o singură** margine (`Math.max(18, round(width * 0.072))`, 32dp la 441dp),
   iar `PostCanvas` adaugă peste ea paddingul paginii (14dp) → **46dp de hârtie goală pe fiecare latură**
   (textul începea la 119px și se termina la 1102px, adică 45,8 / 45,4dp, pe un ecran de 469dp);
   iar coloana veche (`wordPageGutter`) ținea 72dp *în interiorul* paddingului de 14dp, deci un text fără
   document se oprea la 383dp, cu 20dp înainte de marginea stângă a barei (403dp).

### 26.3 Ce s-a schimbat

1. **Emoji-ul fără placă** — `ReactionControl` a pierdut `railPaper`, `railPaperOn`, `railNight`,
   `railNightOn`; celula rămâne 56×56 cu discul de 36×39 și contorul. Starea reacției este glifa, nu o a
   doua placă: inima goală la o apăsare neatinsă, fața aleasă altfel. Fiindcă inima albă nu se vede pe cremă,
   inima goală urmează terenul — `REACTION_EMPTY_HEART` (🤍) noaptea, `REACTION_EMPTY_HEART_ON_PAPER` (🖤) pe
   hârtie (`lib/socialTypes.ts`). Comentariul, salvarea, distribuirea, `Urmărește` și `Editează profilul`
   păstrează materialul neschimbat.
2. **Pagina are două margini** — `lib/editorialFlow.ts` primește `marginLeft`/`marginRight` (`marginX` rămâne
   marginea din stânga pentru cine îl citea simetric), `EditorialPage` le calculează o dată: cu bară, stânga
   `max(12, 3.2 %)` (14dp la 441dp) și dreapta `RAIL_LINE_AIR` (6dp); fără bară (compozitorul), simetric ca
   înainte. `lib/textPage.ts` are acum `RAIL_LINE_AIR` ca un singur număr (intră în `TEXT_PAGE_RAIL_GUTTER`,
   în înălțimea rezervei și în marginea din dreapta a paginii citite).
3. **Coloana veche se scade din padding** — `wordPageGutter(metricsGutter, wordPage, padH)` întoarce
   `TEXT_PAGE_RAIL_GUTTER - padH` (58dp), exact dreptunghiul pe care `wordPageRailReserve` îl taie din flux;
   `PostCanvas` îi dă `metrics.padH`. O fotografie sau un clip nu primesc paddingul peste colțura lor.


### 26.4 Ce s-a măsurat pe telefon (uiautomator, nu impresii)

Pagina articolului `[36,316][1184,2226]`, celula reacției `[1048,1727][1194,1873]` (146×146px = 56×56dp),
comentariu `[1048,1878][1194,2023]`, salvare `[1048,2029][1194,2174]`, distribuire `[1048,2179][1194,2325]`.

| Ce | Înainte | Acum |
|---|---|---|
| marginea stângă a textului | 119px = 45,8dp | **72px = 27,7dp** |
| marginea dreaptă (deasupra butoanelor) | 1102px = 423,8dp | **1168px = 449,2dp** |
| rândurile care ating bara | se opreau la 1019px | se opresc la 1032px (397dp), 6dp înainte de bară |
| măsura fluxului | 378dp | **422dp** |

Pe cele patru documente reale din baza vie (`C:\Nexus\data\nexus.sqlite`, postările 46, 45, 44, 43), rulate
prin motor cu pagina de 441,5×734,6dp: aceleași cuvinte, același număr de pagini (2/4/2/2), fotografiile pe
aceleași pagini, `overflow` neschimbat. Pagina 1 a postării 44 lasă hârtie goală sub text pentru că fotografia
ei se mută pe pagina 2 — la fel se întâmpla și înainte de rundă, nu e o regresie a măsurii.

### 26.5 Ce s-a dovedit, rulat

- `npm test` în `apps/nexus-mobile`: **42 de scripturi, 393 de cazuri, `fail 0`**.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: curat.
- Teste noi: `test-text-page.cjs` — „pagina citită are o margine de citit și un singur aer până la bară"
  (marginea din dreapta este `RAIL_LINE_AIR`, pagina fără bară rămâne simetrică) și cazul coloanei vechi
  (`wordPageGutter(…, padH)` = lățimea rezervei, nu 72dp); `test-editorial-document.cjs` — „măsura paginii
  are două margini" (pe motor: niciun rând nu trece de marginea din dreapta, niciunul nu intră în dreptunghiul
  barei, rândurile de deasupra urcă până la marginea mică, pagina fără bară compune la fel ca înainte);
  `test-feed-rail.cjs` — celula reacției nu mai poartă nicio placă (`railPlate`/`railPaper:`/`railNight:`
  absente), ținta de 56×56 rămâne, inima goală urmează terenul, iar celelalte trei apăsări își păstrează
  `ground`/`groundOn`.
- Pe telefon: paleta se deschide la ținere (`input motionevent DOWN` pe celula reacției) și numele emoji-ului
  de sub deget urmează degetul (`Love` → `Furios`); deplasarea în afara pastilei și eliberarea **închid panoul
  fără să scrie nimic** (`post_reactions` pentru postarea 39 a rămas gol, total 13 reacții ca înainte); inima
  goală de pe hârtie se citește `U+1F5A4` (🖤), iar cea de pe paginile fără document `U+1F90D` (🤍).

### 26.6 Ce rămâne deschis (spus pe față)

1. **Culoarea nu poate fi citită de mine.** Nu deschid capturi ADB (unealta de imagine a refuzat mereu
   fișierele), deci „nu mai are fundal" este dovedit prin cod, prin token și prin test, nu prin ochi: placa,
   muchia și colțul au dispărut din acea celulă, iar emoji-ul e un text direct pe pagină. Verdictul vizual
   rămâne al ownerului.
2. **Mărirea emoji-ului nu se citește din ierarhie.** `uiautomator` raportează noduri, nu transformări: am
   dovedit că pastila se deschide și că celula de sub deget se schimbă odată cu degetul, dar scara de 1,72×
   rămâne o afirmație a codului (`PICKER_GROW`) plus testul paletei, nu o măsurătoare pe ecran.
3. **Trimiterea unei reacții noi nu a fost exersată pe telefon**, ca să nu ating conținutul real: potrivirea
   glifă ↔ reacție trimisă a fost citită din datele existente (postarea 44 are `WOW` în bază și 😮 pe placă).
4. **Pagina fără document** (text vechi) nu are flux, deci nu poate reîmpacheta un rând: i-am dat doar
   dreptunghiul corect al barei (58dp în loc de 72dp), nu camera pe înălțime. Nu există în baza vie o
   postare de cuvinte fără document ca s-o măsor pe ecran; regula e ținută de test.
5. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul
   `npm test`, are nevoie de `apps/nexus-web/public/profile-ticker.js`).
## 27. A treia zi: măsura din fontul telefonului, toate patru butoane fără plăci, lipitul în compozitor (29 octombrie 2026)

### 27.1 Punctul de plecare (trei propoziții de la owner)

1. „Textul e prea mare și se termină rândurile prea devreme, deși mai aveau loc" — coloana părea îngustă și cu
   spațiu gol în dreapta.
2. „Comentariul, salvarea și distribuirea au încă fundal" — runda §26 scosese placa doar de sub reacție.
3. „Apăs lung pe text, dar Paste nu apare" — textul copiat din Chrome nu putea fi lipit în compozitor.

### 27.2 Ce s-a dovedit stricat, cu cauza

1. **Măsura nu era a fontului.** `lib/editorialFlow.ts` decide unde se rupe un rând **înainte** ca React Native
   să deseneze ceva, dintr-un tabel scris de mână („o literă mică ≈ 0,54 din corp", ×1,035 la final). Citit din
   `NotoSerif-Regular.ttf` de pe telefon, tabelul acela ieșea cu **2–9 % mai lat** decât fontul real: fiecare
   rând se rupea cu un cuvânt mai devreme, iar hârtia rămasă la capăt era exact „spațiul gol" reclamat. Rândul
   întâi al postării 46: model 362,2dp, desenat 354,2dp.
2. **Trei din patru apăsări mai purtau placa.** `PostRail` aplica `styles.groundPaper`/`groundNight` pe celula
   de 56×56 a comentariului, salvării și distribuirii, iar starea „luată" era placa întoarsă (`groundOn`).
3. **Compozitorul nu avea niciun câmp sub deget.** Pagina de cuvinte este desenată de flux ca rânduri așezate
   absolut, deci un `Pressable` de rând primea apăsarea; singurul `TextInput` al componentei era cel de 1×1px,
   ascuns (`styles.hiddenInput`), cu care vorbește doar tastatura. Un `Pressable` nu are selecție, mânere și
   meniu de clipboard — de aceea Paste nu apărea niciodată.

### 27.3 Ce s-a schimbat (fișiere și de ce)

1. **`lib/fontMetrics.ts` (nou).** Avansul real al fiecărui caracter, citit din fișierele de font ale
   telefonului (`cmap` → glifă, `hmtx` → avans, ÷ `unitsPerEm`), în miimi din corp, **rotunjit în sus**, plus
   `LINE_SAFETY` de 1,5 % și clase de siguranță (emoji 1,28; CJK 1; necunoscut 0,8). Tabele: serif regular +
   serif bold (`NotoSerif-*.ttf`), sans = max(MiSans, Roboto) fiindcă `sans-serif` poate fi oricare dintre ele,
   mono = 0,601 (`DroidSansMono`). `editorialFlow.measureTextWidth` deleagă acum la el, deci tot motorul
   (rupere de rând, rupere de cuvânt lung, poziția cursorului) folosește aceeași măsură.
2. **`lib/textStyle.ts`.** `TEXT_SIZES`: `19/28`, `22/31`, `28/39` — cu 5–8 % mai mic și cu interlinierea
   strânsă cu aceeași măsură. Pagina citită, compozitorul și paginile vechi citesc toate același token.
3. **`components/RichText.tsx` + `EditorialPage`.** `allowFontScaling={false}` pe rândul publicat și pe fiecare
   segment de marcă: altfel un telefon cu textul mărit ar fi desenat litere mai mari decât cele măsurate.
4. **`components/PostRail.tsx`.** Fără `groundPaper`/`groundPaperOn`/`groundNight`/`groundNightOn`; cele trei
   apăsări folosesc `styles.cell` (56×56) singură. Starea „luată" este un punct de 4dp în `metricRow` (rândul de
   14dp pe care celula îl rezerva deja), în cerneala terenului — citește pe cremă și pe fotografie deopotrivă.
5. **`components/ReactionControl.tsx`.** Ultima urmă de cerneală întoarsă a dispărut: pe hârtie `inkOn` este
   `#F4F3ED` (cifră albă pe cremă), un rest din runda cu plăci. Starea reacției rămâne glifa.
6. **`lib/editorialDocument.ts`.** `paragraphsOf` (o singură regulă de paragraf, folosită și de
   `applyPlainText`) și `setBlockText(document, id, value)`: înlocuiește un paragraf, taie textul lipit după
   rândurile goale, păstrează pozele și salturile de pagină, scoate blocul golit și acceptă `id = null` (foaia
   deschisă pe o pagină goală → primele paragrafe ale articolului).
7. **`components/EditorialPage.tsx`.** Apăsare lungă (`FIELD_HOLD_MS` = 420ms) pe un rând sau pe hârtia goală
   deschide **foaia paragrafului**: `TextInput` nativ, multiline, `autoFocus`, cu fața și corpul paginii, peste
   hârtia ei, plus „Gata" (44dp). Câmpul ascuns este `editable={false}` cât timp foaia e deschisă, iar cursorul
   desenat de pagină dispare sub ea. Ce se scrie se întoarce în document o singură dată, la închidere.

### 27.4 Ce s-a măsurat pe telefon (uiautomator + Chrome pe device, nu impresii)

Pagina articolului `[36,316][1184,2226]` (măsura 421,5dp), postarea 46, 19 rânduri pe pagina 1:

| Ce | Înainte | Acum |
|---|---|---|
| corpul paginii | 24dp / 34dp | **22dp / 31dp** |
| înălțimea unui rând | 89px = 34,2dp | **81px = 31,2dp** |
| primul rând | „**Nu, carnea crudă nu se spală" (30 de caractere) | „**Nu, carnea crudă nu se spală înainte" (38) |
| umplerea măsurii (media rândurilor) | 80,8 % | **90,9 %** |
| hârtie goală la capătul rândului | ~81dp | **~38dp** |
| rândurile articolului (aceleași 253 de cuvinte) | 53 | **44** |
| marginea stângă / dreaptă a textului | 72px / 1168px | neschimbate (72px / 1168px) |
| rândurile care ating bara | se opresc la 1019px | la fel (1019px, 6dp înainte de bară) |
| cele patru celule ale barei | 146×146px (56×56dp) | aceleași, fără placă |

Modelul a fost verificat **independent de React Native**: o pagină servită de pe host (`adb reverse tcp:8099`) și
deschisă în Chrome pe telefon a măsurat 24 de șiruri cu `canvas.measureText` la 22px. Față de model:
serif 1,015–1,032, sans 1,017–1,050, mono 1,017 — modelul e mereu mai lat (deci nu taie), niciodată cu peste
5 %. Fixture-ul acestor 24 de măsurători este chiar în `scripts/test-font-metrics.cjs`.

### 27.5 Ce s-a dovedit, rulat

- `npm test` în `apps/nexus-mobile`: **44 de scripturi, `fail 0`** — între ele două scripturi noi:
  `test-font-metrics.cjs` (9 cazuri: modelul între măsura reală și +6 %, tabelul vechi mai lat decât fontul,
  mono cu un singur pas, bold serif propriu, caractere necunoscute socotite late, marja sub 2 %, acoperirea
  ASCII + latină extinsă + diacritice românești, rândul desenat fără scalare) și `test-text-field.cjs`
  (9 cazuri: `setBlockText` pe toate ramurile, plus sursa compozitorului — câmp nativ, multiline, `autoFocus`,
  fără `contextMenuHidden`, fără citire de clipboard, apăsare lungă pe rând și pe pagina goală, câmpul ascuns
  oprit cât timp foaia e deschisă).
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: curat.
- Pe telefon, prin ADB/uiautomator: pagina 46 se desenează la 22/31 cu numerele de mai sus; bara are patru
  celule de 56×56dp (`Deschide selectorul de reacții`, `Comentarii`, `Salvează`, `Distribuie`), comentariul
  deschide foaia „Comentarii · 0", distribuirea deschide meniul („Redistribuie în feed", „Distribuie în afara
  Jungle Book"); apăsarea lungă pe pagină deschide foaia paragrafului (`PARAGRAFUL`, `Gata`, câmp
  `android.widget.EditText` `enabled=true` `focused=true`, câmpul ascuns `enabled=false`); „Gata" scrie textul
  în pagină (`7/20000`).
- **Lipitul, cap-coadă, pe telefon** (nu pe hârtie): o pagină servită de pe host prin `adb reverse tcp:8099` a
  fost deschisă în Chrome; butonul ei a scris **977 de caractere** în clipboardul Android (`COPIAT 977
  CARACTERE`, afișat în pagină); `input keycombination 113 50` (Ctrl+V, comanda de lipire a Androidului) a
  adus textul în câmpul nativ al foii (1001 de caractere în `EditText`, cu diacritice întregi), iar „Gata" l-a
  scris în pagină: **971/20000**, două pagini, paragrafele păstrate.
- **Text + fotografie, pe telefon:** ownerul a confirmat selecția în selectorul HyperOS (pasul pe care un agent
  orb la ecran nu l-a putut face); au intrat trei atașamente, le-am redus la unul din butoanele compozitorului
  (`Șterge atașamentul 2`, `Șterge atașamentul 3`), iar pagina a trecut de la 3 la 2 pagini. Fotografia
  (ilustrație originală `bambus-illustration.png`, 900×600, împinsă în `Download` și indexată cu
  `MEDIA_SCANNER_SCAN_FILE`) a fost trasă între rânduri: **textul se împachetează în jurul ei** (rândurile de
  lângă imagine `x665-1034`, cele de sub ea `x186-1034`). Postarea a rămas **nepublicată**; baza de date
  (`C:\Nexus\data\nexus.sqlite`: 43 de postări, max id 47; 23 de rânduri media) și folderul de media (23 de
  fișiere) sunt identice înainte și după.
- Logcat după repornire: nicio linie `ReactNativeJS` și niciun `FATAL EXCEPTION`.

### 27.6 Ce rămâne deschis (spus pe față)

1. **Meniul de selecție al Android nu poate fi declanșat de ADB pe acest telefon.** Nici `input swipe x y x y
   900`, nici `input motionevent DOWN/UP` (1,1s), nici dublul tap nu scot bara cu Paste/Copiază. Dovada că nu e
   vina câmpului nou: exact aceleași gesturi nu scot meniul nici pe câmpul de comentariu, care există de mai
   multe runde. Lipirea a fost dovedită prin **comanda de lipire a Androidului** (`input keycombination 113 50`,
   adică Ctrl+V) în câmpul real: 977 de caractere copiate din Chrome au intrat în câmp și, la „Gata", în
   pagină. Verdictul „meniul apare la deget" rămâne al ownerului, care poate ține apăsat o secundă.
2. **Confirmarea din selectorul de fotografii a trebuit făcută de owner.** Arborle de accesibilitate al
   selectorului HyperOS nu are, pentru selecție multiplă, niciun buton de confirmare (`Cancel`, contorul
   „Preview (N/5)", setările de confidențialitate, grila — nimic altceva), deci un agent orb la ecran nu poate
   duce pasul până la capăt. El a apăsat; restul (reducerea la o fotografie, așezarea între rânduri,
   previzualizarea) e verificat mai sus.
3. **Un text lipit nu a fost publicat** ca postare de probă: contul este contul real xPortal al ownerului, iar
   regula rundei este să nu se publice fără acordul lui explicit. Ciorna (971 de caractere + o fotografie,
   nepublicată) a rămas în compozitor, pe telefon.
4. **Defect găsit, nereparat:** `mediaBusy` din compozitor rămâne `true` când rezultatul selectorului se
   pierde (am blocat „+ Fotografie" până la repornirea aplicației). Ar merita un `finally` cu timeout sau o
   resetare la revenirea în prim-plan. Tot acolo: un selector multi poate întoarce mai multe fișiere decât a
   ales ownerul dacă o selecție veche rămâne în starea lui (de aici trei atașamente în loc de unul).
5. **Un Reel nu a putut fi deschis:** în baza vie nu există nicio postare activă cu clip (fișierele `.webm`
   sunt pe rânduri retrase), deci regresia pentru clip e acoperită doar de componenta comună (`PostRail`) și de
   teste. Postarea de cuvinte (46, 47) și articolul cu fotografie (46) au fost deschise și verificate.
6. **Tabelele sunt ale fețelor de pe Android.** iOS (Georgia) ar avea nevoie de rândul lui; până atunci, un
   telefon iOS ar măsura cu avansurile lui Noto Serif.
7. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul `npm test`).

## 28. A patra zi: atingerea care deschide câmpul, publicarea care duce la pagină (29 octombrie 2026)

### 28.1 Punctul de plecare (ce a spus ownerul, în șase propoziții)

1. „Apăs lung 0,5–1 secundă în zona de text și **nu se întâmplă nimic**. Nu apare nici bara de editare a
   Androidului, deci nu pot lipi." — adică lipirea dovedită în §27 (977 de caractere prin Ctrl+V în câmp) nu
   ajunge la degetul lui, iar runda aceea nu are voie să se declare terminată.
2. „După ce public o postare de TEXT, mă aruncă în cameră și trebuie să ies manual." Compozitorul este deschis
   de butonul „TEXT" al vizorului, iar după publicare `router.back()` te întorcea exact acolo.
3. „Scoate selectorul de temă: o singură temă Kindle, cu hârtia și litera de acum."
4. „«Cine poate vedea?» să fie un comutator frumos, cu trei poziții: **Public / Privat / Doar eu**."
5. „Proveniența, la fel — același tip de comutator."
6. „Locația să vină din GPS, cu un **X** lângă ea; comentariile și distribuirea rămân on/off."

### 28.2 Ce s-a dovedit stricat, cu cauza (măsurat pe telefon, nu presupus)

**A. „Nu se întâmplă nimic" avea două cauze, iar a doua ar fi închis orice reparație a primeia.**

1. *Hârtia nu era o țintă.* Singura ușă spre câmp era o ținere de 420 ms care trebuia să nimerească **exact un
   rând desenat**: pagina este un flux de rânduri așezate absolut (`editorialFlow`), iar marginile, golul dintre
   paragrafe, hârtia de sub ultimul rând și spațiul de lângă fotografie nu aveau niciun `Pressable`. Pe telefon
   asta este cea mai mare parte din pagină. Măsurat: pagina `[116,309][1104,2065]`, primul rând `[72,415]`, iar
   între paragrafe un gol de 38px fără niciun nod apăsabil.
2. *Cuvintele nu erau într-un câmp pe care să-l poți selecta.* Pagina desena fiecare rând ca `Text`, iar textul
   întregii pagini trăia într-un `TextInput` **de 1×1px**, invizibil — măsurat pe telefon ca nodul „Textul
   postării", `[116,309][119,312]`, adică 3×3 pixeli. O apăsare lungă pe un `Text` nu selectează nimic, iar un
   câmp pe care nu-l vezi nu are peste ce să pună bara cu Paste: chiar când foaia paragrafului se deschidea
   (și se deschidea — dovedit cu uiautomator: `PARAGRAFUL`, `Gata`, `EditText focused=true`), degetul nu găsea
   meniul unde îl căuta.

**B. Publicarea te ducea în cameră, iar cauza era sub compozitor.** `camera.tsx` face `router.push('/text')`,
deci stiva este `[perete, cameră, text]`; `router.back()` după publicare sărea în vizor, iar cardul „PUBLICAT"
nu avea decât butonul „Închide" — tot spre cameră. Verificat în cod și pe telefon: intrarea în TEXT se face
numai din camera (`Scrie o postare de text`, `[758,2137][944,2239]`).

**C. Meniul de selecție al Android nu poate fi declanșat de ADB pe acest telefon — dovedit cu un martor.**
Experimentul de control din această rundă: aceeași apăsare lungă sintetică (`input swipe x y x y 900`, apoi
`input motionevent DOWN/UP` la 0,95 s) a fost aplicată pe **bara de adrese a Chrome** și pe **textul unei pagini
din Chrome** — nici acolo nu apare bara de selecție în arborele uiautomator (dump-urile sunt identice octet cu
octet înainte și după). Deci lipsa barei în dump nu spune nimic despre aplicația noastră: injecția de gesturi nu
ajunge la `ActionMode`. Verdictul „apare la deget" rămâne al ownerului.

**D. Selectorul de temă schimba un fir de 2px.** Pagina este `pagePaletteOf` în orice temă, deci cele șase
mostre schimbau doar accentul firului de sus: un control întreg de ecran pentru o schimbare pe care ownerul nu o
vedea ca „temă". 

**E. Două defecte lăsate deschise în §27.6** — `mediaBusy` blocat după un rezultat pierdut al galeriei, și
confuzia dintre „permisiune refuzată" și „build fără modul nativ" — au fost închise pe drum (vezi §28.3).

### 28.3 Ce s-a schimbat (fișiere și de ce)

- `src/components/EditorialPage.tsx` — **rescrisă partea de editare**: câmpul ascuns de 1×1px, cursorul desenat
  de pagină, `selectAt`, `onSelectionChange`, `caretLine`, `caretPage` și `editorialTextMap` au fost scoase;
  hârtia întreagă este acum un `Pressable` așezat *sub* rânduri și *sub* fotografii, care deschide câmpul
  paragrafului de sub deget (`paragraphAt`), iar un rând deschide același câmp cu cursorul exact la caracterul
  atins (`caretAt`). Foaia are acum o propoziție de ajutor („Ține apăsat pe un cuvânt ca să copiezi, lipești sau
  selectezi tot"), `selection` împins o singură dată din locul atingerii și eliberat la prima mișcare a
  cursorului, și un `BackHandler` care închide foaia înaintea ecranului.
- `src/app/text.tsx` — selectorul de temă și cel de aliniere au fost **scoase** (cu stilurile lor), tema ciornei
  este normalizată la `TEXT_DEFAULT_THEME`; „Cine vede" și „Proveniență" sunt acum două comutatoare segmentate
  (`Segment`, cu rol de radio, 44dp pe poziție, track derulabil pentru cele patru declarații); locația scrisă de
  mână a fost înlocuită cu rândul detectat + X; publicarea face `dismissAll()` + `push('/post/:id')` cu id-ul
  confirmat; galeria are termen (`GALLERY_DEADLINE_MS`).
- `src/lib/location.ts` — **nou**: permisiune, fix cu termen de 12 s, rotunjire la patru zecimale, geocoderul
  produsului, alegerea numelui (zonă → oraș → stradă) și tipul `PlaceDetection` care nu aruncă niciodată.
- `app.json` + `android/app/src/main/AndroidManifest.xml` — `ACCESS_COARSE_LOCATION` și
  `ACCESS_FINE_LOCATION`, plus pluginul `expo-location` cu propoziția arătată de sistem pe iOS; `expo-location`
  a intrat în `package.json`/`package-lock.json` (deci build nativ nou).
- `scripts/test-text-composer.cjs`, `scripts/test-text-location.cjs`, `scripts/test-publish-navigation.cjs` —
  **noi**; `scripts/test-text-field.cjs` rescris pentru noul drum; `scripts/test-text-style.cjs` actualizat;
  lanțul `npm test` le include.
- `apps/nexus-mobile/MIGRATION.md` §28, `docs/PARITY-MATRIX.md` §13.7, acest document.


### 28.4 Ce s-a măsurat pe telefon (Xiaomi 25098PN5AC, HyperOS/Android 16, prin ADB + uiautomator)

- **Un build nou, fiindcă modulul de locație este nativ.** Prima încercare de `npm run build:android:dev` a
  picat cinstit: `LicenceNotAcceptedException … ndk;27.1.12297006`. Cauza nu era proiectul, ci mașina — SDK-ul
  Android de aici avea **doar `platform-tools`** (nici platformă, nici build-tools, nici NDK, nici
  `cmdline-tools`), deci APK-ul de pe telefon fusese construit în altă parte. Am instalat ce lipsea
  (`cmdline-tools`, `platforms;android-36`, `build-tools;36.0.0`, `cmake;3.22.1`, `ndk;27.1.12297006`,
  licențe acceptate) și build-ul a trecut: **BUILD SUCCESSFUL in 13m 25s**, APK 114,9 MB, instalat cu
  `adb install -r` (datele aplicației păstrate). Manifestul instalat are acum `ACCESS_COARSE_LOCATION` și
  `ACCESS_FINE_LOCATION` (`granted=false` la instalare).
- **Compozitorul, fără selectoarele scoase.** LITERĂ (Serif/Sans/Mono) și MĂRIME (Auto/Mic/Mediu/Mare) au rămas;
  TEMĂ și ALINIERE nu mai există în arborele de accesibilitate. „Cine vede" este un track cu **trei** poziții
  radio: Public `[75,469][425,583]`, Privat `[435,469][785,583]`, Doar eu `[795,469][1145,583]` (350×114 px
  fiecare ≈ 127×41 dp). Atingerea pe „Privat" a dat `checked=true` pe ea și a schimbat propoziția de sub track în
  „Doar prietenii — urmărire reciprocă — o văd."; atingerea pe „Public" a adus-o înapoi. „Proveniență" are
  **patru** poziții în același tip de track, derulabil: „Nu declar", „Făcut de mine", „AI asistat", „Generat de
  AI", fiecare cu propoziția întreagă dedesubt.
- **Locația, cap-coadă.** La deschidere, rândul spune de ce are nevoie de locație și oferă „Folosește" (fără
  dialog). Apăsarea a deschis **dialogul sistemului** — „Allow Jungle Book Dev to access location info?" cu
  Approximate / Precise / **Allow only while using the app** / Only this time / Deny — deci dialogul aparține
  unei apăsări, cum cere regula. După „Allow only while using the app", locația a fost citită și numită:
  **„Czyżyny, Cracovia"** (`Scoate locația din postare` lângă ea). „Cracovia" este numele românesc al
  Cracoviei — verificat separat, aceleași coordonate cerute lui Nominatim cu `pl` răspund „Kraków" — deci
  antetul `Accept-Language: ro,en` trimis de aplicație chiar schimbă limba. **X-ul** a scos locul: rândul a
  revenit la ofertă, iar ciorna a rămas cu `publishing.location=""` și `locationDismissed=true`; după o
  repornire rece locul **nu** a mai fost readus.

- **Publicarea, cap-coadă, pe contul real, cu acordul ownerului.** O pagină de probă („Test Jungle Book:
  pagina de proba, se poate sterge…", titlu „Test publicare TEXT", vizibilitate Public, locație scoasă) a fost
  publicată din compozitor. Rezultatul, măsurat în bază: **o singură postare nouă**, `id=49`, `kind=text`,
  `visibility=public`, `provenance=NOT_DECLARED`, `title="Test publicare TEXT"`, `location=""`,
  `allowComments/allowRepost/allowDownload/watermark=true`, `text_style_json` cu `theme=paper`,
  `font=serif`, `size=medium`, `align=left` și documentul paginii (44 → **45** postări, max id 48 → **49**).
  Aplicația a sărit **direct pe pagina creată**: arborele arată pagina articolului cu textul scris, bara
  (`Deschide selectorul de reacții`, `Comentarii`, `Salvează`, `Distribuie`) și „Vezi traducerea" — **nicio
  cameră** în niciun dump de după publicare. Înapoi din postare a dus în perete/profilul de sub ea, nu în vizor.
- **Ciorna ownerului a fost protejată.** Publicarea de probă avea nevoie de un compozitor gol, iar ciorna lui
  (781 de caractere, textul Kindle) ar fi fost ștearsă de publicare. A fost copiată **în sandboxul aplicației**
  (`current.json.bak`, 2258 de octeți, identic), ștearsă pentru probă, iar după publicare **restaurată** din
  copie; compozitorul arată din nou `778/20000 CARACTERE` cu textul lui. Un test de siguranță peste ea: atingere
  pe un rând → foaia paragrafului cu textul lui, `focused=true`; Înapoi (închide tastatura), Înapoi (închide
  foaia) → compozitorul rămâne deschis, contorul tot 778, ciorna tot 781 de caractere — nicio modificare.
- **Meniul de selecție rămâne nedovedibil prin ADB** (vezi §28.2 C). Ce s-a putut dovedi: câmpul este un
  `android.widget.EditText` real, vizibil (`[162,551][1058,2030]`), `focused=true`, cu tastatura arătată
  (`mInputShown=true`), fără `contextMenuHidden` și fără nimic deasupra lui — iar React Native nu oprește
  `ActionMode`-ul de inserare: `ReactEditText.kt` instalează un callback care doar scoate „paste as plain text"
  din meniu. Verdictul „apare la deget" rămâne al ownerului.

### 28.5 Ce s-a dovedit, rulat

- `npm test` în `apps/nexus-mobile`: **50 de scripturi, `fail 0`** (exit 0), între ele patru noi/actualizate:
  `test-text-composer.cjs` (8 cazuri), `test-text-location.cjs` (5), `test-publish-navigation.cjs` (4),
  `test-text-field.cjs` (9, rescris pentru noul drum: un singur `TextInput`, fără câmp ascuns, atingere *și*
  ținere, cursorul din locul atingerii, `BackHandler`).
- `npx tsc --noEmit`: curat.
- Pe telefon, prin ADB/uiautomator: toate cele din §28.4 (layout-ul compozitorului, cele două comutatoare,
  dialogul de permisiune, locația detectată și scoasă, publicarea care deschide postarea 49, Înapoi, ciorna
  neatinsă).
- Baza de date și media înainte/după: 44 → 45 postări (doar cea de probă, cerută de owner), 24 de rânduri
  media și 24 de fișiere — neschimbate; reacțiile, salvările și comentariile existente neatinse.
- Logcat după repornire: nicio linie `ReactNativeJS` de eroare, niciun `FATAL EXCEPTION`.

### 28.6 Ce rămâne deschis (spus pe față)

1. **Bara nativă de selecție (Paste/Copiază) nu poate fi declanșată prin ADB pe acest telefon** — dovedit în
   această rundă și pe Chrome (bara de adrese și textul unei pagini), nu doar pe câmpul nostru. Ce s-a schimbat
   față de §27 este drumul: câmpul se deschide la o **atingere** oriunde pe hârtie, nu doar la o ținere pe un
   rând, iar textul nu mai stă într-un câmp invizibil. Confirmarea finală („țin apăsat în câmp → apare Paste →
   lipesc paragraful din Chrome") este a ownerului, cu degetul.
2. **Postarea de probă 49 este publică** și a fost lăsată acolo la cererea ownerului („o șterg eu mai târziu"):
   titlu „Test publicare TEXT", textul începe cu „Test Jungle Book: pagina de proba, se poate sterge.".
3. **Geocoderul are un cache pe coordonate, nu pe limbă** (`api.js`, `cacheKey` din
   `/api/location/suggestions`): cine întreabă primul pentru o zonă stabilește limba răspunsului pentru
   următoarele 15 minute. Nu s-a schimbat nimic acolo în această rundă — aplicația trimite `ro,en`, iar webul
   trimite limba lui; dacă un client cere `pl`, următorul client poate primi un nume polonez. De reparat într-o
   rundă care atinge backendul.
4. **`mediaBusy` are acum termen (5 minute), dar selectarea multiplă a galeriei HyperOS poate întoarce încă
   fișiere în plus** dintr-o selecție veche; curățarea lor rămâne manuală (butonul „Șterge atașamentul N").
5. **Un Reel nu a fost deschis** în această rundă: în baza vie nu există nicio postare activă cu clip, deci
   fluxul video e acoperit doar de componentele comune și de teste.
6. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul `npm test`).

## 29. A cincea zi: ce scrie în câmp este ce se publică — lipitul, emojiul, litera și mărimea (30 octombrie 2026)

### 29.1 Punctul de plecare (patru propoziții de la owner)

1. „Lipesc un text în compozitor, apăs **Gata**, apoi **Publică** — și în postare apare un clip care nu are nicio
   legătură cu ce am scris."
2. „Emoji-ul intră peste text, nu în câmp."
3. „Selecția e verde, ca tot restul aplicației. Pe o pagină de hârtie ar trebui să fie albastră."
4. „Am nevoie de mai multe litere și de o mărime pe care s-o citesc de la un metru."

### 29.2 Ce s-a dovedit stricat, cu cauza (citit în cod și dovedit cu teste, nu presupus)

**A. Compozitorul ținea două adevăruri, iar butoanele citeau fiecare altul.** `draft.document` era pagina desenată,
`body` era textul din câmp, iar textul lipit trăia între ele într-al treilea loc (`flight`, commit-ul câmpului).
`Publică` compunea postarea din `draft.document` și `draft.attachments` — deci cuvintele lipite, dacă nu fuseseră
închise cu `Gata` înainte de a apăsa `Publică`, nu ajungeau în `caption`, iar fișierele se luau din lista de
atașamente, nu din pagină: un clip scos din pagină se urca la publicare și apărea în postare.

**B. `reconcileMedia` avea o scurtătură care nu repara nimic.** Când nu mai era loc pentru niciun fișier
(`room === 0`), `used` rămânea gol, iar testul „documentul e deja de acord" (`used.length === room`) era
**adevărat** — așa că funcția întorcea documentul neatins, cu blocuri media care arătau spre fișiere care nu mai
existau. Un astfel de document trecea mai departe la server exact așa. Prins de testul D din runda asta.

**C. Emojiul scria în pagină, nu în câmp.** Bara chema `applyPlainText`, care rescria documentul întreg — iar
câmpul deschis, care tocmai avea focus și un cursor, își pierdea textul. Emojiul trebuie să fie o **tastă**, ca
orice altă literă.

**D. Rândurile autorului aveau două reguli.** `paragraphsOf` (calea câmpului) păstra un `\n` în mijlocul unui
paragraf, `documentFromPlainText` (calea veche) îl prefacea în spațiu: același text lipit ajungea cu un rând mai
puțin pe pagină dacă intra pe ușa cealaltă.

**E. Șase fețe, trei tabele de măsură.** Pagina se rupe pe rânduri măsurate (`measureTextWidth`), iar tabelele de
metrici există doar pentru `serif`, `sans` și `mono`. Cele trei fețe noi (`slab`, `casual`, `condensed`) nu aveau
nicio tabelă, deci ar fi fost măsurate cu fața implicită — un rând ar fi ieșit fie prea scurt, fie tăiat.

### 29.3 Ce s-a schimbat (fișiere și de ce)

- `src/app/text.tsx`: un singur adevăr la publicare —
  `page = useMemo(() => flight ? setBlockText(draft.document, flight.blockId, flight.text) : draft.document, [draft.document, flight])`,
  iar de aici se citesc `body`, contorul de caractere, ciorna și ce pleacă la server:
  `reconcileMedia(page, draft.attachments.length)` → `file = reconciled.kept.map(…)`, `caption = documentPlainText(reconciled.document)`,
  `textStyle: { …draft.style, document: reconciled.document }`. Postarea, galeria și pagina ei nu mai pot descrie
  trei articole diferite. Emoji-ul trece prin `insertRequest` (un nonce), nu prin rescrierea paginii.
- `src/components/EditorialPage.tsx`: câmpul este singurul drum al textului; `onFieldChange` anunță compozitorul
  la fiecare tastă; emoji-ul se inserează la cursor prin nonce; selecția își are culoarea ei
  (`selectionColor={TEXT_SELECTION_COLOR}`), nu accentul temei; măsura se face cu `metricFont` (`metricFaceFor`),
  desenul cu `bodyFont` (`fontFamilyFor`) — două funcții diferite, pentru că o față poate fi desenată fără să aibă
  tabelă de metrici.
- `src/components/TextToolbar.tsx`: bară mai joasă, cu trei uși care își spun starea („Literă · Serif",
  „Mărime · Mare", „Emoji"), în loc de rândurile `LITERĂ` / `MĂRIME` care ocupau tot ecranul.
- `src/lib/textStyle.ts`: `TEXT_FONT_IDS` are șase fețe (`serif`, `sans`, `mono`, `slab`, `casual`, `condensed`),
  `TEXT_SIZE_IDS` are patru trepte (`small`, `medium`, `large`, `xlarge` — 34/47), `metricFaceFor` spune cu ce
  tabelă se măsoară fiecare față (`slab → mono`, `casual → serif`, `condensed → serif`, adică cea mai lată tabelă
  apropiată, ca rândul să se rupă mai devreme, niciodată mai târziu), `TEXT_SELECTION_COLOR = '#7fc4f0'`, iar
  `TEXT_EMOJI` este liste locale de grupuri, trecute prin `Set`, ca un emoji aflat în două grupuri să nu apară de
  două ori în grilă.
- `src/lib/editorialDocument.ts`: `documentFromPlainText` refolosește `paragraphsOf`, deci un `\n` din mijlocul
  unui paragraf supraviețuiește pe orice ușă; scurtătura din `reconcileMedia` numără acum și blocuri, nu doar
  indici, deci un document cu media fără fișiere nu mai trece drept „deja de acord".
- `apps/nexus-web/lib/post-text-style.js` și `post-editorial-document.js`: listele de fețe, mărimi și măsuri
  extinse, ca serverul să nu refuze o postare scrisă cu o față nouă (un refuz aici = o postare pierdută).
- `scripts/test-text-integrity.cjs` (**nou**, 10 cazuri A–I), `scripts/test-text-field.cjs`,
  `scripts/test-text-composer.cjs`, `scripts/test-text-style.cjs` actualizate; `package.json` include noul script
  în `npm test` (51 de scripturi).

### 29.4 Ce s-a dovedit, rulat

- `npm test` în `apps/nexus-mobile`: **51 de scripturi, 439 de cazuri, `fail 0`**, exit 0.
- `scripts/test-text-integrity.cjs`, cele zece cazuri, toate trecute: A (lipit → `Gata` → `Publică` publică exact
  textul lipit și păstrează clipul de pe pagină), B (publicare fără `Gata`: compozitorul citește `page`, nu
  `draft`), B2 (fiecare tastă este o intenție nouă — o reîncercare nu repetă textul dinainte, în trei locuri),
  C (deschizi și închizi câmpul fără nicio tastă: pagina rămâne aceeași referință), D (o ciornă veche nu poate
  readuce un fișier care nu mai e pe pagină: blocul orfan iese, restul se renumerotează, o pagină curată rămâne
  aceeași referință), E (emoji = `insertRequest`, fără `applyPlainText`, `TEXT_EMOJI` fără dubluri), F (un `\n`
  scris de autor dă trei rânduri pe o singură pagină, iar dus-întors prin `documentPlainText` îl păstrează),
  G (șase fețe ↔ trei tabele, familii Android distincte, patru mărimi în ordine crescătoare, măsura pe
  `metricFont`), H (ce listează telefonul este exact ce acceptă serverul: `condensed` și `xlarge` trec de
  `normalizeTextStyle`), I (selecția e albastră de cerneală, distinctă de `palette.mark` și `palette.accent`, cu
  contrast ≥ 1,4 pe hârtie și pe cerneală).
- `npx tsc --noEmit`: exit 0, nicio linie de ieșire.
- `apps/nexus-web`: `node --test test/post-publishing.test.js` — 10 din 10 trecute (exit 0).

### 29.5 Ce nu s-a dovedit încă (spus pe față)

1. **Nimic din runda asta nu a fost văzut pe telefon.** Toate dovezile de mai sus sunt rulări pe calculator;
   verificarea pe Xiaomi MIX Flip, pe o **ciornă nepublicată**, rămâne de făcut (lipit → `Gata` → `Publică`,
   emoji la cursor, selecție albastră, cele șase fețe și cele patru mărimi).
2. **Trei fețe noi sunt măsurate cu tabela vecină** (`slab → mono`, `casual → serif`, `condensed → serif`): rândul
   se poate rupe cu un cuvânt mai devreme decât ar trebui. Greșeala este sigură (nu taie text), dar se vede; de
   judecat pe telefon înainte de a-i face tabele proprii.
3. **Webul validează și păstrează `textStyle`, dar nu desenează pagina editorială**: în `apps/nexus-web` nu
   există nicio mapare de la `font` la un `font-family` (niciun `data-font`, niciun `Georgia`, niciun `monospace`
   derivat din stil), deci cele trei fețe noi nu au deocamdată corespondent vizual în browser.
4. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul `npm test`).



## 30. A șasea zi: locația, negrul dur, Back-ul, numerotarea și traducerea (30 octombrie 2026)

### 30.1 Punctul de plecare (cinci propoziții de la owner)

1. „Pe profil, un nume lung de locație intră peste butonul din dreapta — `Editează profilul`, `Urmărește`."
2. „Scoate negrul dur: iconițele reacțiilor, avatarul implicit și butonul `+` să fie un argintiu Mercury."
3. „Dacă deschid un clip din profil și vreau înapoi, butonul Back stă peste numele profilului."
4. „Numerotarea `1/22` să fie jos, centrată, ca într-o carte — și să nu stea peste locație sau peste emoji."
5. „`Vezi traducerea` apare pe aproape fiecare postare, deși textul este deja în limba telefonului."

### 30.2 Ce s-a dovedit stricat, cu cauza

**A. Locația și ușa autorului împărțeau același rând, iar locația nu avea locul ei.** În `PostCanvas`, capul
unei postări aduna `@handle`, data și locația într-un **singur** `Text` cu `numberOfLines={1}`, iar acel text
stătea într-un rând (`styles.authorLine`) împreună cu butonul de relație (`RelationButton variant="compact"` —
`Urmărește`, `Editează profilul`). Rândul nu rezerva niciun drept pentru ușă și niciun rând pentru locație:
`authorRow` avea `flexShrink: 1` fără `minWidth: 0`, iar ușa nu avea `flexShrink: 0`. Pe un telefon îngust, cu
un font de sistem mare sau cu un nume lung de locație, textul ieșea sub buton. Verificat în cod, nu presupus.

**B. Trei valori „negre" în trei locuri diferite, fără niciun token comun.** Nu exista niciun token `mercury`
în temă. Pagina de cuvinte își desena glifele coloanei cu `post.controls.paper.ink` (`#2B3134` — citit ca negru
pe crem), avatarul implicit al profilului avea `backgroundColor: '#090a0c'` (cu o valoare mai închisă decât
câmpul pe care stătea, deci arăta ca o gaură), iar butonul `+` avea ultima oprire a gradientului `#050608` și
plusul desenat tot în `#050608`. Fiecare componentă își inventase propriul negru.

**C. Back-ul plutea peste pagină.** Ruta `src/app/post/[id].tsx` desena un disc de 42dp la `left: 12,
top: insets.top + 8`, **peste** compoziție, iar contorul plimbării (`3/22`) la `top: insets.top + 14`, centrat.
Nimic nu rezerva spațiu: `PostCard` primea `topInset={insets.top}`, deci capul autorului începea exact sub
ceasul telefonului — adică sub Back.

**D. Numerotarea era un chip negru în colț, fără bandă rezervată.** `EditorialPage` desena `1/22` ca
`position: absolute; right: 10; bottom: 8` pe `rgba(8,10,13,0.72)`, iar `PostReading` ca `right: 0; bottom: -2`
pe același gen de placă. Fluxul (`editorialFlow`) nu știa de ele: marginea de jos era `max(22, 6.4%)`, așa că
un rând putea fi așezat sub cifre, iar pe postarea deschisă din profil chipul stătea peste locație.

**E. Regula de traducere cerea dovada invers.** `needsTranslation` întorcea `true` când postarea **nu** avea
limbă („nimic nu dovedește că e limba ta"), iar compozitorul nu trimite `language` deloc — deci butonul apărea
aproape peste tot. În plus, regula veche scutea engleza pentru orice cititor, exact invers față de tabelul cerut
(română + engleză = *da*). Nicio detecție locală, niciun cache.

### 30.3 Ce s-a schimbat, fișier cu fișier

**Token nou — `apps/nexus-mobile/src/theme/mercury.ts`.** Un singur metal neutru, cu cinci nuanțe și o
funcție: `base #A5A5A5` (valoarea numită de owner), `light #D6D8D9` (lumina discului), `deep #7C8083` (metalul
în umbră — **singura** nuanță permisă unei glife pe hârtie), `shadow #5B5F62` (piciorul discului, niciodată
negru), `graphite #2B3134` (cerneala care stă *pe* metal). Contrastul fiecărei perechi este măsurat de test:
grafit pe metal 5,3:1 · metal în umbră pe hârtie 3,5:1 · metal pe câmpul junglei 7,6:1. `mercuryAvatar` dă
perechea avatarului implicit (placă + cerneală + fir), iar `mercuryMarkOn('paper' | 'night')` dă cerneala unei
glife pe cele două terenuri.

**`theme/social.ts`.** `post.controls` capătă a noua cheie `mark`, pe ambele terenuri: pe hârtie `mercury.deep`,
noaptea `#E6EAE8` — adică **neschimbat**. Ușile (`ink`) și cifrele (`count`) își păstrează cerneala. `nav.create`
are acum patru opriri Mercury (alb → lumină → metal → umbră) și două cerneluri noi: `colors.createInk =
mercury.base` (discul de sub desen) și `colors.createGlyph = mercury.graphite` (plusul).

**`components/PostRail.tsx`.** Coloana citește `markInk = controls.mark` pentru cele patru glife (comentariu,
salvare, distribuire, discu sonor) și pentru spinner; punctul de stare (`stateInk`) rămâne `controls.ink`, iar
cifrele rămân `count`. Reels nu trece `tone`, deci ia `night` — neatins.

**`components/AppNav.tsx`.** Plusul este desenat cu `colors.createGlyph`; geometria, ținta de atingere,
eticheta de accesibilitate și deschiderea compozitorului sunt exact cele de dinainte.

**`components/ProfileHeader.tsx` + `components/ProfileEditSheet.tsx` + `components/PostCanvas.tsx`.** Avatarul
implicit este `mercuryAvatar.plate` cu inițiale `mercuryAvatar.ink` (profil, editor de profil, discul autorului
din orice postare). Poza reală rămâne desenată peste placă, neschimbată.

**`lib/postChrome.ts` (nou, pur).** `POST_HEADER` (52dp bandă, buton 44dp, disc 34dp, fir, tipografie) +
`postHeaderHeight(inset)` / `postPageTopInset(inset)` — antetul își rezervă exact înălțimea, iar pagina începe
sub ea. `postHeaderNameWidth({ width, counter })` dă lățimea numelui după ce scazi ușile. `POST_HEAD` +
`postHeadArrangement({ width, padding, fontScale, actionWidth })` decid dacă ușa autorului stă **lângă** cuvinte
sau **sub** ele: `row` doar când `width − 2·pad ≥ (identityMin + action + gap) · fontScale`, altfel `stack`.

**`lib/textPage.ts`.** `PAGE_FOLIO` (bandă 26dp, inset 12dp, corp 10dp, spațiere 1,6, cerneală 68 %) și
`pageFolioBand()`. Banda este *în interiorul* marginii de jos a hârtiei, nu peste cuvinte.

**`lib/language.ts` (nou, pur).** `languageCodeOf` (normalizare `ro-RO`/`ro_RO`/`RO` → `ro`),
`deviceLanguage`/`activeLanguage`/`setReaderLanguage`/`subscribeReaderLanguage` (limba activă se poate schimba,
iar cititorii sunt anunțați), `needsTranslation` rescris (necunoscut → **nu**; fără scutirea pentru engleză),
`readLanguage`/`detectLanguage` (șapte limbi: ro, pl, en, de, fr, es, it — cuvinte-funcție + diacritice),
`detectCached` (cache mărginit la 256 de fragmente), `postLanguageOf` (metadatele bat detectorul; `und` nu este
o declarație) și `translationForPost`. Regula de pagină amestecată: dacă a doua limbă este la mai puțin de 1,8×
de prima, sau câștigătorul nu acoperă măcar 55 % din cuvinte, textul este amestecat și nu se oferă traducere.

**`components/PostCanvas.tsx`.** Locația are rândul ei, `numberOfLines={POST_HEAD.locationLines}` (două rânduri,
rupere naturală); rândul de sub nume este `@handle · dată`; ușa stă într-o coloană `flexShrink: 0`, aliniată sus
(`marginTop: POST_HEAD.actionTop`), iar numele primește `flexGrow: 1, flexShrink: 1, minWidth: 0`; pe ecran
îngust sau cu font mare, `authorLineStack` coboară ușa sub cuvinte, aliniată la dreapta. Traducerea se decide cu
`translationForPost(post, readerLanguage)`, iar `readerLanguage` vine din `useSyncExternalStore` — deci o
schimbare de limbă recalculează poarta fără reload.

**`components/EditorialPage.tsx` + `components/PostReading.tsx`.** `1/22` este acum un **folio** tipărit:
centrat pe lățimea paginii (`left: 0, right: 0, alignItems: 'center'`), la `PAGE_FOLIO.inset` deasupra piciorului,
în seriful paginii, cu cifre tabulare și la 68 % din cerneala hârtiei (≈5,4:1 pe crem). Fluxul primește
`marginBottom: max(pageFolioBand(), 6,4 %)`, iar `PostReading` păstrează banda sub cuvinte
(`pageWords.paddingBottom = PAGE_FOLIO.band`). Ambele componente sunt folosite și în feed, și în postarea
deschisă din profil, deci poziția este aceeași în toate contexte.

**`app/post/[id].tsx`.** Antet adevărat: `accessibilityRole="header"`, înălțime `postHeaderHeight(insets.top)`,
rând flex — Back (44×44 + `hitSlop`) · nume (`flex: 1, minWidth: 0`, un rând, elipsă) · contorul plimbării.
Pagina primește `topInset={postPageTopInset(insets.top)}`. `close()` păstrează istoricul (`router.canGoBack()` →
`router.back()`), apoi se întoarce la **profilul de origine** când ruta a fost deschisă dintr-un link, și doar în
ultimă instanță la feed.


### 30.4 Teste rulate efectiv (nu „ar trebui să treacă")

- `apps/nexus-mobile`: lanțul `npm test` rulat script cu script (54 de scripturi, cele 51 existente + 3 noi,
  **460 de cazuri** în total, față de 439 înainte) — 54/54 exit 0. Cele trei suite noi:
  - `scripts/test-post-chrome.cjs` (7 cazuri): antetul își rezervă `inset + 52`; numele se îngustează după uși;
    ușa autorului stă `row` pe 393dp și `stack` pe 250dp, la `fontScale 1,8` și la o ușă de 260dp; canvasul pune
    locația pe rândul ei (`numberOfLines={POST_HEAD.locationLines}`) și ține ușa într-o coloană care nu se
    micșorează; ruta are `accessibilityRole="header"`, `topInset={pageTopInset}`, Back 44×44, fără `top:
    insets.top + 8/14`; folio-ul este centrat, are bandă proprie și apare în ambele componente; traducerea
    cerută rămâne o apăsare reală în toate cele trei locuri.
  - `scripts/test-mercury.cjs` (6 cazuri): valorile tokenului; contrastul măsurat al celor patru perechi
    (WCAG, aceeași aritmetică drept `test-theme-contrast.cjs`) **și** faptul că `base` nu are voie ca glifă pe
    crem; avatarul implicit (profil, editor, disc de autor) cu poza reală neatinsă; `paper.mark = mercury.deep`
    și `night.mark = #E6EAE8` (Reels neatins, dovezile pe text); butonul `+` fără nicio oprire neagră, cu
    comportamentul și eticheta neschimbate; emoji-urile și paleta exact ca înainte (`\u{1F90D}`, `\u{1F5A4}`,
    cele opt fețe) și `ReactionControl`/`ReactionPalette` fără Mercury.
  - `scripts/test-language.cjs` (8 cazuri): normalizarea codurilor; tabelul cerut (ro/ro nu, ro/en da, pl/pl nu,
    pl/ro da, en/en nu, en/pl da, necunoscut/emoji nu, cititor fără limbă nu); limba activă se schimbă și își
    anunță abonații o singură dată; detectorul recunoaște ro/pl/en; text scurt, nume, hashtag, link, emoji și
    cifre → `''`; pagina amestecată → `''`; metadatele bat detectorul, `und` nu este declarație, iar cache-ul nu
    remăsoară aceleași cuvinte (`languageCacheSize`).
- `apps/nexus-mobile`: `node ./node_modules/typescript/bin/tsc --noEmit` — exit 0, nicio linie de ieșire.
- Suitenile existente care atingeau zona au fost actualizate acolo unde descriau **vechea** intenție:
  `test-post-presentation.cjs` (regula a plecat în `lib/language.ts`), `test-nav-band.cjs` (gradientul `+` este
  acum Mercury), `test-brand-paint.cjs` și `test-hero-parity.cjs` (stub-ul lor de `require` încarcă acum
  `theme/mercury.ts`, pentru că `social.ts` îl importă), `test-profile-grid.cjs` și
  `test-no-fullscreen-post.cjs` (Back păstrează istoricul **și** se întoarce la profilul de origine).

### 30.5 Ce nu s-a dovedit încă (spus pe față)

1. **Nimic din runda asta nu a fost văzut pe telefon.** Toate dovezile de mai sus sunt rulări pe calculator:
   suprapunerea locației, antetul cu Back, folio-ul și culoarea Mercury trebuie confirmate de owner pe Xiaomi
   MIX Flip, pe profilul lui **și** pe profilul altcuiva (butoanele diferă: `Editează profilul` vs `Urmărește`),
   plus pe o postare de text de 22 de pagini.
2. **Avatarurile din liste** (Mesaje, Prieteni, Căutare, Live, comentarii) păstrează plăcile lor reci
   (`#203c49`, `#111820`), pentru că acelea **nu** sunt negre și trecerea lor pe Mercury ar rescrie vizual niște
   liste pe care ownerul nu le-a numit. Dacă le vrea și pe ele, este o singură linie de temă per ecran.
3. **Webul are propria poartă de traducere** (`apps/nexus-web/public/caption-translation.js`): își tipărește
   butonul cu `language || "und"` și lasă browserul să detecteze. Regula nouă (necunoscut → ascuns, dominantă
   clară, fără scutirea pentru engleză) este implementată doar în aplicația mobilă; portarea în browser este o
   rundă separată.
4. **Cele trei fețe noi de text rămân măsurate cu tabela vecină** (`slab → mono`, `casual → serif`,
   `condensed → serif`) — observația din §29.5 rămâne valabilă, neatinsă de runda asta.
5. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul `npm test`).


## 31. A șaptea zi: un singur antet, folio-ul documentului, ușa la picior (31 octombrie 2026)

### 31.1 Punctul de plecare (două propoziții de la owner)

1. „Pe o postare de text, numele autorului apare de două ori, unul sub altul — o dată sus, în bara paginii,
   o dată pe hârtie."
2. „Și sus scrie `1/22`, deși pagina spune `1/3`. Când sunt la pagina a treia, `1/22` nu înseamnă nimic:
   numărul trebuie să fie al documentului, iar Back trebuie să stea undeva unde nu acoperă textul."

### 31.2 Ce s-a dovedit stricat, cu cauza

**A. Aceleași trei fapte erau tipărite de două ori, în două locuri care nu se știau între ele.** Ruta
`src/app/post/[id].tsx` desena un antet propriu — `accessibilityRole="header"`, înălțime
`postHeaderHeight(insets.top)`, cu discul de Back de 34dp, numele afișat (`display_name`) și `@handle` — peste
**orice** pagină, inclusiv peste o pagină de cuvinte. Iar pagina de cuvinte își tipărește singură capul, prin
`PostCanvas` (`TEXT_PAGE_HEAD`: disc de 54dp, nume de 17dp, handle de 13dp), fiindcă așa arată o pagină
publicată în compozitor. Rezultatul, pe orice postare de text deschisă din grilă: **numele autorului de două
ori**, la 52dp unul de altul. Niciuna dintre cele două componente nu greșea singură — contractul dintre ele
lipsea.

**B. `1/22` număra postările plimbării, nu paginile documentului.** Antetul rutei tipărea
`` `${at + 1}/${list.length}` `` — poziția în lista verticală de postări a profilului (`at`, `list`) — în timp
ce folio-ul aceleiași pagini, tipărit de `PostReading`/`EditorialPage` la piciorul hârtiei, spunea `1/3`, adică
numărul paginilor pe care fluxul chiar le produsese. Două numere, două surse, două înțelesuri: pe un ecran de
citit, al doilea număr („a câta postare din profil") nu răspunde la nicio întrebare a cititorului. Stilurile
contorului (`counter`, `counterText`, `counterSize`) trăiau în ruta postării, nu în pagină.

**C. Scoaterea antetului lua cu ea singura ușă a paginii.** După runda 30, Back stătea *în* antetul rutei
(`POST_HEADER`), iar antetul stătea peste tot. O pagină de cuvinte fără antet ar fi rămas fără nicio ieșire
— deci mutarea ușii nu era o preferință estetică, ci o consecință: ușa trebuia să ajungă într-o bandă pe care
pagina o cedează **înainte** să fie desenată, nu peste cuvinte, după. Asta a fost refuzul rundei 30 spus din
nou: un control care plutește peste compoziție nu poate fi felul în care compoziția se citește.

**D. Numărul era compus în două locuri.** Atât `PostReading`, cât și `EditorialPage` își scriau cifrele singure
(`` `${current + 1}/${total}` ``), deci puteau să nu fie de acord nici între ele, nici cu pagerul.


### 31.3 Ce s-a schimbat, fișier cu fișier

**Contract nou — `apps/nexus-mobile/src/lib/postPresentation.ts::readsAsPage`.** O singură întrebare, pusă în
același loc de toți cei care au nevoie de ea: *postarea asta se citește ca pagină de cuvinte?* Răspunsul este
`stageFor(post) === 'text' || 'article'` — un text fără media și un articol (text + `text_style` + o
fotografie) da; o poză, un clip și un citat, nu. Un citat este deliberat exclus: este o conversație desenată pe
placă întunecată, iar o ușă mată tipărită pe ea ar fi singurul control pe care paleta nu-l poate așeza.
Canvasul (`wordPage`) și ruta întreabă acum aceeași funcție, deci antetul nu poate „ști" altceva decât știe
pagina.

**Bandă nouă — `apps/nexus-mobile/src/lib/readerBar.ts`.** `READER_BAR` ține patru numere și unul de margine:
`height: 48` (banda, fără insetul telefonului), `button: 44` (ținta de apăsare), `disc: 36` (discul desenat
înăuntru — cu un punct mai mare decât cele 34dp ale antetului, fiindcă pe crem nu există hairline-ul unei
fotografii care să țină desenul), `glyph: 26`, `inline: 10` (marginea paginii). `readerBarHeight(insetBottom)`
**adună** insetul, nu îl contopește: ușa stă deasupra barei de gesturi, iar cuvintele se termină deasupra ușii.
`readerPageTopInset(insetTop)` întoarce exact `insets.top`: o pagină de cuvinte tipărește capul autorului ca
primul lucru pe hârtie, deci pornește în banda notificărilor. Dacă ar primi `postPageTopInset` (inset + 52),
hârtia ar începe cu o bandă goală sub ceas — chiar golul pe care antetul îl umplea înainte.

**Ruta — `apps/nexus-mobile/src/app/post/[id].tsx`.** Antetul se desenează numai peste paginile care **nu** au
cap propriu (`!wordPage`), neschimbat în rest. Contorul plimbării a plecat cu totul (niciun număr de postare
nu se mai tipărește nicăieri în rută). Pe o pagină de cuvinte, ruta desenează o singură bandă la picior,
goală, cu o ușă de 44dp la marginea paginii, care apasă **aceeași** funcție `close` pe care o apăsa antetul
(istoric întâi, apoi profilul plimbării, apoi feedul). Insets-urile se decid per pagină: `topInsetFor` /
`bottomInsetFor` întreabă `readsAsPage`, deci o poză primește `postPageTopInset` + `insets.bottom`, iar un
text primește `insets.top` + `readerBarHeight(insets.bottom)`.

**Un singur număr — `apps/nexus-mobile/src/lib/textPage.ts::folioLabel`.** Ambele cititoare
(`PostReading`, `EditorialPage`) tipăresc `folioLabel(current, total)`: `1/3`, `2/3`, `3/3`. O citire de o
singură pagină nu tipărește nimic (`''` — o carte nu își numerotează singura pagină), iar un index rămas în
urmă după o re-liniere tipărește ultima pagină care chiar există, niciodată una care nu există. Pagerul și
numărul sunt ținute în acord în amândouă: când fluxul produce mai puține pagini decât era cititorul, indexul
este readus (`if (page <= total - 1) return;`), iar offsetul este re-emis numai când se schimbă numărul de
pagini (`[total, box.width]`), nu la fiecare deget.

**Compoziția — `PostCanvas`, `PostCard`, `PostRail` (neschimbate în intenție, schimbate în aritmetică).**
Banda nu este desenată peste pagină: `PostCanvas` primește `bottomInset` și îl adaugă la `padB`
(`paddingBottom: metrics.padB + bottomInset`), `PostCard` dă railului `bottom={RAIL_FOOT + bottomInset}` și
panoului de distribuire `bottom={214 + bottomInset}`. Cu banda de 48dp, ultimul rând al articolului, ultima
țintă a railului și folio-ul se opresc toate deasupra ușii.

**Teste.** `scripts/test-reader-page.cjs` (nou, 8 cazuri): aritmetica benzii (insetul se adaugă, un inset
absurd nu scurtează banda, banda încape ținta de 44dp); discul în țintă și săgeata în disc; `readerPageTopInset`
fără cele 52 de puncte; `readsAsPage` adevărat numai pentru text și articol; ruta nu mai are antet peste o
pagină de cuvinte, nu mai are `${at + 1}` și nici `counterSize`; pagina este măsurată cu banda piciorului
înainte de a fi desenată (ruta, `PostCanvas`, `PostCard` — prin contracte de sursă); ușa din picior apasă
exact `close`-ul antetului, cu ambele răspunsuri; folio-ul ambelor cititoare vine din `folioLabel`, pagerul
urmează numărul și se readuce singur. `scripts/test-post-chrome.cjs` (7 cazuri) descrie acum folio-ul centrat
cu bandă proprie, iar `package.json` are `test-reader-page.cjs` în lanț, imediat după `test-post-chrome.cjs`.


### 31.4 Ce s-a dovedit, pe calculator și pe telefon

**Pe calculator.** `npm test` din `apps/nexus-mobile` (56 de scripturi, 53 de rapoarte `node:test`): zero
eșecuri, lanțul ajunge la ultimul script (`test-xportal-state.cjs`, 12 cazuri). `tsc --noEmit` (`node
./node_modules/typescript/bin/tsc`) — exit 0, nicio linie de ieșire. Cele trei suite ale zonei, rulate separat:
`test-reader-page.cjs` 8/8, `test-post-chrome.cjs` 7/7, `test-text-page.cjs` 8/8.

**Pe telefon** (Xiaomi MIX Flip, `25098PN5AC`, 1220×2656, densitate 416dpi ⇒ **2,6 px/dp**, deci ecranul are
469,2 × 1021,5 dp; aplicația `app.nexus.mobile.dev`). Toate numerele de mai jos sunt citite din
`uiautomator dump` (px) și împărțite la 2,6.

1. **Un singur antet.** Postarea 50 („Amazon Kindle e-readers…", 3 pagini) deschisă din grila profilului:
   arborele începe cu `[36,151][838,305] „Profilul lui @wallet4e8gv6"` — adică **capul paginii, la 58 dp**,
   exact `insets.top`, fără cele 52 de puncte de chrome deasupra. Nu există niciun nod `header`, niciun al
   doilea rând cu numele. Pe o poză (postarea 41), antetul rutei există și e întreg:
   `[0,0][1220,286]` (0…110 dp = 58 + 52), cu Back la `[26,160][140,275]`.
2. **Folio-ul este al documentului.** Nodul `[36,2285][1184,2321] d="Pagina 3 din 3"`, cifrele
   `[586,633]` — centrul 609,5 px = 234,4 dp, adică mijlocul celor 469,2 dp. Sus, în locul lui `1/22`, nu mai
   există nimic.
3. **Numărul urmează pagerul.** Pe aceeași postare, trei gesturi orizontale: `1/3` → `2/3` → `3/3`, iar al
   patrulea (dincolo de ultima pagină) rămâne `3/3` — nu apare `4/3` și nu apare o pagină albă.
4. **Indexul se resetează cu documentul.** Ieșire și reintrare în aceeași postare: din nou `1/3`.
5. **O pagină nu se numerotează.** Postarea „Test Jungle Book: pagina de proba…" (o singură pagină): „Pagina
   articolului" există, nodul `din 1` nu.
6. **Ușa din picior stă în banda cedată.** `[26,2414][140,2528] d="Înapoi la profilul lui @wallet4e8gv6"` =
   10…54 dp × 928,5…972,3 dp, adică 44×44 dp la marginea de 10 dp a paginii. Marginea de jos a hârtiei este
   `readerBarHeight(48)` = 96 dp deasupra marginii ecranului (925,5 dp), bara de gesturi ocupă ultimii ~48 dp,
   iar ultima țintă a railului se termină la 900 dp și folio-ul la 893 dp: nimic nu atinge ușa.
7. **Ușa duce înapoi acolo de unde ai deschis.** Deschisă din grila profilului (celula cu text Amazon Kindle),
   ușa din picior a adus ecranul **înapoi pe profilul `@wallet4e8gv6`**, cu peretele la aceeași derulare
   (`r31_foot_door_returns_to_profile.jpg`), iar jurnalul serverului arată `GET /api/profiles/wallet4e8gv6` +
   impresii după apăsare, fără niciun `GET /api/posts/50`. Deschisă dintr-un stack de linkuri (unde pagina
   anterioară era altă postare), ușa a revenit *întâi* în istoric — exact ce promite `close`: istoric, apoi
   profilul, apoi feedul.
8. **Cele două pagere nu se bat.** În plimbarea pe verticală, o tragere verticală a trecut la **următoarea
   postare** („Test Jungle Book: pagina de proba…", o pagină, fără folio), iar cele orizontale au întors
   paginile documentului. Compoziția păstrează deci contractul vechi: vertical = altă postare, orizontal =
   altă pagină a aceluiași document.

**Capturi publicate** (fiecare validată de `scripts/capture-android-screen.ps1`: focus `app.nexus.mobile.dev`,
cadru neuniform, JPG decodat complet) și **citite** una câte una, cu observația scrisă între ele:

- `r31_text_reader_foot.jpg` (19:41) — pagina 1/3: un singur cap de autor (avatar, „Mother Fucker",
  „@wallet4e8gv6 · 5 h", „Czyżyny, Cracovia"), fără antet de rută și fără `1/22`; hârtie crem, text serif pe
  toată lățimea, railul cu patru uși în dreapta; `1/3` centrat la picior, iar discul negru de Back **sub**
  folio, în banda rezervată, fără nicio linie de text dedesubt.
- `r31_profile_wall_before_tile.jpg` (19:47) — profilul din care s-a deschis celula („Mother Fucker",
  `@wallet4e8gv6`, 2 / 0 / 20, „Editează profilul", banda și grila de text).
- `r31_foot_door_lands_on_profile.jpg` (19:46) — după ușa din picior, apăsată dintr-o postare deschisă **din
  istoricul de linkuri**: Back a revenit în istoric, la postarea 25 („Good morning ❤️", Test Nexus/@test),
  care își păstrează antetul rutei și Back-ul de sus, fără bandă la picior — dovada că o pagină cu poză nu a
  fost atinsă de rundă.
- `r31_foot_door_returns_to_profile.jpg` (19:48) — după ușa din picior, apăsată dintr-o postare deschisă din
  grila profilului: ecranul este profilul, la aceeași derulare.


### 31.5 Ce nu s-a dovedit încă (spus pe față)

1. **Compozitorul nu a fost redeschis pe telefon în runda asta.** `EditorialPage` tipărește acum același
   `folioLabel`, iar pagerul lui se readuce după o re-liniere — ambele verificate prin contracte de sursă în
   `test-reader-page.cjs`, nu pe ecran. O verificare de compozitor pe telefon (scrie, liniile se rup, `1/2`
   apare/corect) rămâne de făcut.
2. **Un clip (Reel) nu a fost deschis pe telefon în runda asta.** Dovezile pentru „paginile cu media păstrează
   antetul" sunt o poză (postarea 25 și 41). Un clip trece prin `ReelPage`, altă compoziție; antetul rutei
   este desenat de aceeași condiție `!wordPage`, dar nu a fost văzut pe un clip.
3. **Banda a fost măsurată pe un singur telefon**, cu insetul de jos de ~48 dp (bară de gesturi). Pe un telefon
   cu alt inset, banda scade sau crește exact cu el (`readerBarHeight` adună, nu contopește) — aritmetica e
   testată, măsura nu.
4. **Documentul de două pagini** (`1/2`, cel din peretele profilului) nu a fost deschis în runda asta: pe
   telefon s-au văzut `1/3` (de trei ori, plus revenirea la `3/3` după un gest în plus) și o pagină fără număr.
   Aritmetica pentru N = 2 este acoperită de `folioLabel`, nu de ecran.
5. **Discul de la picior este negru mat, cu o hairline de metal** (`blackSilver.matteBlack` + `edge`), nu
   argintiu Mercury: pe crem, un disc argintiu ar fi măsurat ~1,5:1 față de propria hârtie și ar fi citit ca o
   *placă a identității*, nu ca o ieșire din pagină. Este o decizie de design a acestei runde, nu o cerință a
   ownerului: dacă o vrea argintie sau cu etichetă text („Înapoi"), este o singură schimbare în `styles.readerDisc`.
6. **Webul are propriul cititor** (`apps/nexus-web`): pagina de postare din browser își tipărește singură
   antetul și numărul. Regula din runda asta (un antet, un număr, ușa la picior) este implementată doar în
   aplicația mobilă; portarea în browser este o rundă separată.
7. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul
   `npm test`), neschimbat de runda asta.



## 32. Pagina de text deschisă din profil: fără ușă în pagină, folio mai jos, butoanele telefonului pe argint (31 octombrie 2026)

### 32.1 Ce s-a cerut (trei propoziții, un singur context)

1. „Când deschid o postare de text **din profil**, butonul Back din pagina de jos e de prisos: aplicația are
   deja Back în bara de jos. Scoate-l de acolo."
2. „Mută contorul (`1/3`) puțin mai jos, folosește spațiul de deasupra barei, și lasă textul să coboare cu el."
3. „Butoanele de jos ale telefonului (Back, Home, recente) abia se văd pe fundalul alb — dă-le un argint
   discret, dar numai aici."

Toate trei sunt despre **aceeași pagină citită din același loc**. Feed-ul, compozitorul, pozele, clipurile și
Reels-urile rămân neatinse — iar asta e jumătate din muncă: schimbarea trebuia legată de *origine*, nu de tipul
postării.

### 32.2 Cum știe ruta de unde a fost deschisă (fără deducții)

Ruta `src/app/post/[id].tsx` are de la runda 30 doi calleri, și numai unul trimite profilul:

- `components/ProfileTile.tsx` → `router.push({ pathname: '/post/[id]', params: { id, key, profile: door.handle, tab: door.tab, reading: door.reading } })`
  — peretele își spune numele;
- `src/app/text.tsx` (recepția compozitorului, după `Publică`) → `params: { id }` — fără `profile`.

Deci `handle.length > 0` **este** originea. Runda asta a numit-o explicit:

```ts
const profileOrigin = handle.length > 0;
const walkMode = profileOrigin;
```

`walkMode` rămâne numele plimbării prin arhivă (neschimbat, testat de `test-profile-grid.cjs`), iar
`profileOrigin` este numele deciziei de design. Feed-ul nu intră niciodată în ruta asta: `FeedScreen` montează
`PostCard` direct, în shell, cu bara de tab-uri deasupra — de aceea „un text deschis din feed" este, în cod,
chiar pagina din feed, iar ea nu vede niciuna dintre schimbările rundei.

### 32.3 Ce s-a schimbat, pe fișiere

**`src/lib/readerBar.ts`** — două funcții pure, lângă banda rundei 31:

- `PROFILE_READER_FOOT = { air: 10 }` + `profileReaderBottomInset(inset)` = insetul telefonului **plus** 10dp de
  hârtie. Banda de 48dp a ușii nu mai e rezervată: pagina din profil nu are ușă, deci nu are ce bandă să
  păzească. Diferența față de `readerBarHeight` este exact `READER_BAR.height − air`, nu o cifră inventată.
- `readerDoorShown({ wordPage, profileOrigin, canGoBack })` — regula, într-un singur loc: o pagină care nu e
  pagină de cuvinte nu are ușă; o pagină deschisă din altundeva decât un profil **păstrează** ușa (recepția
  compozitorului e singura ieșire de acolo); o pagină din profil **nu** o mai desenează — cu o excepție
  intenționată: o intrare fără istoric în aplicație (`nexusdev://post/<id>`), unde Back-ul telefonului ar
  închide aplicația, deci ușa rămâne singura cale spre profilul plimbării.

**`src/lib/textPage.ts`** — `PROFILE_FOLIO = { band: 16, inset: 3 }` + `folioRow(profileReader)`. Același folio,
tipărit mai jos: cifrele stau la 3dp de piciorul paginii (nu la 12), iar marginea de sub cuvinte scade de la
26dp la 16dp — deci textul coboară cu ele. `size`, `tracking` și `ink` **nu** se rescriu: se mută rândul, nu
tipul. `folioRow(false)` întoarce exact `PAGE_FOLIO`, deci feed-ul și compozitorul își păstrează rândul.

**`src/components/SystemNavBand.tsx`** (nou) — placa de metal de sub butoanele telefonului:

- o `View` de înălțimea `insets.bottom` exact, la `bottom: 0`, `backgroundColor: blackSilver.silver`
  (`#C4C7CB` — argintul Mercury, valoarea cerută de owner) și o hairline de `deepMercury` sus, ca placa să nu
  se lipească de hârtie;
- `<NavigationBar style="dark" />` din `expo-navigation-bar` cât timp placa e montată. Modulul ține un **stack**
  de intrări: la demontare o scoate și reaplică stilul aplicației (`app.json`: `style: "light"`). De aceea
  componenta nu are niciun `useEffect` de restaurare — o restaurare scrisă de mână ar fi fost al doilea loc
  care poate greși;
- `pointerEvents="none"` + `importantForAccessibility="no-hide-descendants"`: placa e fundal, butoanele rămân
  ale sistemului;
- nu se atinge `setBackgroundColorAsync` (în edge-to-edge, sub RN 0.86, nu mai există) și nu se schimbă nimic
  global: placa e desenată de ecran, pentru ecran.

**`src/app/post/[id].tsx`** — trei legături, toate pe `profileOrigin`:

```ts
const bottomInsetFor = (entry) => {
  if (!readsAsPage(entry)) return insets.bottom;                       // poză, clip, citat: neschimbat
  return profileOrigin ? profileReaderBottomInset(insets.bottom) : readerBarHeight(insets.bottom);
};
const folioFor = (entry) => folioRow(readsAsPage(entry) && profileOrigin);
const showReaderDoor = readerDoorShown({ wordPage, profileOrigin, canGoBack: router.canGoBack() });
const systemNavPlate = profileOrigin && wordPage;
```

iar în JSX: `{showReaderDoor ? <View style={styles.readerBar}>…` (ușa), `<PostCard … folio={folioFor(entry)} />`,
și `{systemNavPlate ? <SystemNavBand height={insets.bottom} /> : null}` **după** pagină și ușă, ca placa să
acopere exact ultimul inset. Sonda de dezvoltare `__POST_ROUTE` raportează acum și `profileOrigin`, `wordPage`,
`door`, `navPlate` — dar a fost mutată **sub** deciziile piciorului, fiindcă un `const` citit în lista de
dependențe a unui `useEffect` se citește înainte să existe (temporal dead zone).

**`PostCard` → `PostCanvas` → { `EditorialArticle` → `EditorialPage`, `PostTextReading` }** — un singur prop nou,
`folio?: { band, inset }`, trecut prin toate cinci, cu valoare implicită `PAGE_FOLIO`:

- `PostTextReading`: `folio ? { paddingBottom: folio.band } : null` pe containerul cuvintelor și
  `styles.folio, folio ? { bottom: folio.inset } : null` pe folio. Stilurile statice rămân neatinse, deci
  contractele rundei 31 din `test-post-chrome.cjs` trec neatinse;
- `EditorialPage`: același `bottom`, iar **marginea fluxului rămâne** `max(pageFolioBand(), 6,4%)` — deliberat:
  numărul se mută, rândurile nu, deci numărul de pagini al unui articol autorat nu se poate schimba din poziția
  cifrelor. (Pe telefon, 6,4% dintr-o pagină de 1021dp este 65dp, oricum peste oricare dintre benzi.)


### 32.4 Teste

`scripts/test-reader-page.cjs` a trecut de la 8 la **15 cazuri** (7 noi, aceleași convenții: module pure rulate
în Node + contracte de sursă, fără DOM):

1. `profileReaderBottomInset` adună insetul și păstrează doar `air`; diferența față de `readerBarHeight` este
   exact banda minus aerul;
2. `readerDoorShown` — cele cinci combinații (profil cu/fără istoric, altă origine, pagină de media);
3. `folioRow` — rândul din profil e mai jos pe ambele numere, încape numărul (`band ≥ inset + size`), nu stă pe
   muchie (`inset > 0`), iar `folioRow(false)` este exact `PAGE_FOLIO`;
4. ruta leagă toate trei de `profileOrigin`, cu `canGoBack` citit de la router și `folio={folioFor(entry)}`;
5. rândul trece prin toate cele cinci componente, iar `marginBottom`-ul fluxului rămâne cel din runda 31;
6. feed-ul și recepția compozitorului **nu** trimit niciun rând nou (`FeedScreen` nu conține `folio`);
7. `SystemNavBand`: `style="dark"`, `blackSilver.silver`, înălțimea = insetul, `pointerEvents="none"`, gardă
   `Platform.OS === 'android'`, **fără** `useEffect` de restaurare, plus contrastul `onSilver` pe `silver`
   recalculat din temă (≥ 4,5:1).

Două teste existente au fost actualizate pentru adevărul nou, nu slăbite: `test-text-page.cjs` (JSX-ul
`EditorialArticle` e acum pe mai multe linii și primește `folio`) și `test-profile-grid.cjs` (`walkMode` se
citește acum din `profileOrigin`, aceeași condiție, cu numele originii).

Pe calculator: `npm test` **verde** (56 de scripturi, 0 eșecuri), `tsc --noEmit` **exit 0**.

### 32.5 Dovezi de pe telefon (Xiaomi MIX Flip, 1220×2656 px, 2,6 px/dp ⇒ 469×1021,5 dp)

Insetul de jos al telefonului: **47,7 dp** (bară cu trei butoane: Back, Home, recente).

**Pagina 50 deschisă din profil (articol autorat, trei pagini).** Arborul de accesibilitate, citit prin sonda
care reîncearcă (dump-ul brut nu prinde starea `idle` pe perete):

| ce | înainte (runda 31) | acum (runda 32) |
| --- | --- | --- |
| ușa din picior | 44×44 dp la 10…54 × 928,5…972,3 dp | **niciun nod** `Înapoi la profilul lui @…` |
| cifrele folio-ului | jos la 893 dp (128,5 dp peste marginea de jos) | jos la **939,6 dp** (**81,9 dp** peste marginea de jos) |
| centrare | 586…633 px (centru 609,5 din 1220) | **586…633 px** (aceeași centrare) |
| piciorul paginii | 925,5 dp | **942,7 dp** |
| marginea dintre ultimul rând și cifre | — | **28,6 dp** (16dp bandă + 3dp inset + linia) |

Măsurat pe `final_jpg/r32_profile_text_reader_low_folio.jpg`, pixel cu pixel (System.Drawing, nu ochi):
placa de argint începe la **y = 2535 px** (975,0 dp) și ține până jos — **46,5 dp**, adică exact insetul,
minus hairline-ul de sus; culoarea la 4px de margine este **(196,199,204)** ≈ `#C4C7CC`, adică
`blackSilver.silver` după compresia JPG. Hârtia de deasupra plăcii, la y = 2516 px, este **(245,239,227)** —
cremul paginii, neatins. Cea mai închisă urmă a glifelor sistemului în placă este **(93,94,96)**, adică
**3,83:1** față de placă (WCAG 1.4.11 cere 3:1 pentru un control); înainte, alb pe crem, era ~1,05:1. Android
își desenează glifele în cerneala lui (noi cerem doar `style="dark"`), deci 3,83:1 este rezultatul sistemului,
nu o culoare aleasă de aplicație.

**Paginarea** (neschimbată): `1/3` → `2/3` → `3/3` la fiecare gest, iar un al patrulea gest rămâne `3/3`;
folio-ul stă la aceleași coordonate pe toate trei paginile (2407…2443 px), deci nu sare între pagini.
Reintrarea în aceeași postare pornește din nou de la `1/3`. O pagină de un singur ecran (postarea „Corect 🌿🌿🌿"
din plimbare) nu tipărește niciun număr, iar antetul rutei rămâne absent — dovada că regula se aplică *pe
pagină*, nu pe rută.

**Back-ul telefonului.** Apăsat din pagină, a adus peretele profilului la **aceeași derulare** (aceleași trei
celule sus: Kindle / „Test publicare TEXT" / Bambus) și a **readus bara de jos la starea aplicației**: negru,
glife albe — adică placa și `style="dark"` au fost date înapoi la demontare, exact cum cere cerința.

**O poză deschisă din profil (postarea 33).** Antetul rutei rămâne (`Înapoi la profilul lui @wallet4e8gv6`,
țintă 10…54 × 61,5…105,8 dp), fără folio, fără ușă la picior, fără placă: poza umple ecranul până la butoanele
telefonului, care rămân albe pe negru. Neschimbată.

**Un text din feed (postarea 51, două pagini).** Bara de tab-uri a aplicației stă sub pagină, folio-ul `1/2`
deasupra ei (2407…2443 px, adică rândul `PAGE_FOLIO` cu inset 12), fără ușă de cititor, iar bara de jos a
telefonului rămâne neagră cu glife albe. Neschimbat față de runda 31 — și singura dovadă de care aveam nevoie
pentru „feed-ul nu se atinge".

Imaginile publicate și citite: `final_jpg/r32_profile_wall_before_tile.jpg` (peretele înainte de atingere, cu
bara de jos neagră), `r32_profile_text_reader_low_folio.jpg` (pagina nouă), `r32_system_back_returns_to_profile.jpg`
(Back → profil, placa dată înapoi), `r32_profile_media_unchanged.jpg` (poza din profil), 
`r32_feed_text_page_unchanged.jpg` (pagina de text din feed). `r32_text_reader_from_profile.jpg` este **înainte**-ul
aceleiași pagini, prins pe bundle-ul rundei 31 înainte de reîncărcare: ușa neagră de 36dp la 10…54 dp și folio-ul
sus. `r32_text_reader_walk_page2.jpg` poartă un nume greșit (a fost capturat când aplicația se reîncărcase în feed);
ce conține este aceeași pagină de text din feed, cu `1/2`.


### 32.6 Ce rămâne deschis

1. **Compozitorul nu a fost redeschis pe telefon în runda asta** (rămâne §31.5.1): `EditorialPage` primește acum
   și `folio`, dar compozitorul nu trimite niciunul, deci își păstrează `PAGE_FOLIO`. Verificarea pe ecran a
   unei pagini scrise (linii re-rupte, `1/2` corect) rămâne de făcut.
2. **Un clip (Reel) deschis din profil** nu a fost văzut pe ecran nici în runda asta (§31.5.2). Poza 33 acoperă
   aceeași condiție de cod (`!wordPage` ⇒ antet, fără placă), dar un clip trece prin `ReelPage`.
3. **Glifele sistemului sunt ale sistemului**: `style="dark"` cere cerneală închisă, iar Android o desenează la
   ~3,83:1 pe argint. Dacă ownerul vrea mai mult contrast, singura pârghie a aplicației este placa (un argint
   mai deschis, `blackSilver.bright`, ar da ~5:1) — o linie în `styles.band` din `SystemNavBand.tsx`.
4. **Banda de 48dp a ușii rămâne pentru recepția compozitorului** și pentru o intrare fără istoric: acolo ușa
   există, deci are nevoie de cameră. Nu a fost deschisă pe telefon în runda asta (ruta `/post/[id]` fără
   `profile`, care cere un `Publică`).
5. **Discul rotativ cu roată dințată** care se vede pe paginile de text (x≈40…170 px, suprapus peste „altul. 2.")
   apare și în capturile rundei 31, pe bundle-ul vechi: este o unealtă de dezvoltare/meniu, nu ceva atins de
   rundă. Rămâne de identificat și scos înainte de o demonstrație — nu a fost atins aici.
6. **Webul** (`apps/nexus-web`) are propriul cititor și nu a fost portat (§31.5.6).
7. `scripts/test-ticker-parity.cjs` rămâne singurul eșec preexistent din `scripts/` (nu e în lanțul `npm test`).


## 33. „Mașină" refuzată la publicare, emoji la cursor, originea conținutului pe pagină (28 octombrie 2026)

### 33.1 Ce s-a cerut (trei defecte, trei cauze diferite)

1. „Am scris o pagină în litera **Mașină** (și în `casual`/`condensed`/`xlarge`) și la `Publică` mi s-a spus să
   aleg o temă din listă. Tema era aleasă."
2. „Apăs un emoji cu cursorul la mijlocul frazei și emoji-ul apare **la sfârșitul** paragrafului."
3. „Vreau să se vadă pe postarea publicată **ce a declarat autorul** despre cum a fost făcută — în feed și în
   profil."

Toate trei sunt despre ceva ce *există* deja într-o jumătate a produsului și lipsește în cealaltă: șase fețe
există în compozitor dar nu în server, cursorul există în câmp dar nu în panoul de emoji, declarația există în
bază dar nu pe ecran.

### 33.2 Cauza refuzului: un contract fără număr de versiune

`apps/nexus-web/lib/post-text-style.js` are șase fețe (`serif`, `sans`, `mono`, `slab`, `casual`, `condensed`)
și patru mărimi (`small`, `medium`, `large`, `xlarge`) **în arborele de lucru**, dar deployment-ul din fața
telefonului (`e74f8ff`, Railway) are allowlist-ul vechi, de trei fețe. `normalizeTextStyle` întoarce `null`
pentru `slab`, ruta răspunde `TEXT_STYLE_INVALID`, iar editorul poate tipări doar mesajul generic al câmpului
— „Alege o temă din listă" — pentru că refuzul nu numește litera.

Asta nu se putea repara în client: telefonul nu avea **niciun mod** de a afla allowlist-ul dinainte.
`GET /api/version` publica `text_style: 1` atât pentru serverul cu trei fețe, cât și pentru cel cu șase —
numărul era același, deci întrebarea nu exista. Reparația este contractul:

- `apps/nexus-web/lib/build-info.js` — `text_style: 2`, cu comentariul care spune ce înseamnă fiecare număr
  (`1` = trei fețe și trei mărimi, `2` = șase fețe și `xlarge`) și de ce un client care cere `1` trece pe un
  server `2` (un număr mai mare este un superset);
- `apps/nexus-mobile/src/lib/backendVersion.ts` — `TEXT_STYLE_CAPABILITY_V2 = 2`, cele două liste
  (`TEXT_STYLE_V2_FONTS`, `TEXT_STYLE_V2_SIZES`), etichetele fețelor pentru mesaj, codul nou
  `BACKEND_TEXT_STYLE_OLDER` și `requireTextStyleContract(style)`;
- `apps/nexus-mobile/src/app/text.tsx` — `await requireTextStyleContract(draft.style)` **înainte** de
  `requirePageCapabilities()` și de încărcarea fișierelor.

Trei răspunsuri, un singur refuz: server `>= 2` ⇒ pagina pleacă; server `1` ⇒ refuz aici, cu litera pe nume
(„litera «Mașină» (slab)"), plus propoziția că textul rămâne salvat pe telefon; server care **tace** ⇒ `null`,
adică pagina pleacă, fiindcă tăcerea este aceeași conexiune pe care ar folosi-o POST-ul, iar un hiccup de
rețea nu are voie să devină publicare blocată. O pagină în `serif`/`sans`/`mono` la `small`/`medium`/`large`
nu întreabă nimic: zero cereri, zero cache, zero mod nou de a eșua.

**Un server vechi nu se repară din telefon.** Deployment-ul Railway rămâne, până la o publicare aprobată de
owner, pe allowlist-ul de trei fețe; ce s-a câștigat aici este că refuzul este acum *spus* — și că un server
actualizat este recunoscut ca atare, fără ghicit după commit.

### 33.3 Emoji la cursor: socoteala mutată într-un modul pur

`onSelectionChange` exista din runda 9, dar consuma evenimentul doar ca să elibereze pinul atingerii
(`caret: null`) și **arunca intervalul**. Singura poziție cunoscută era deci sfârșitul șirului, iar efectul de
inserare lipea emoji-ul la coadă: `text: \`${current.text}${addition}\``.

- `apps/nexus-mobile/src/lib/textInsert.ts` (nou, fără nicio dependență la rulare) — `snapOffset` /
  `snapSelection` taie intervalul la pagină, îl pune în ordine și îl scoate din mijlocul unei perechi
  surrogate (un `slice` acolo ar rupe emoji-ul în două); `insertAtSelection(text, addition, selection)`
  întoarce `{ text, caret }`, iar `caret` este poziția pe care se sprijină **următorul** emoji. Un *cursor*
  (`start === end`) se mută cu ambele capete la stânga, o *selecție* crește în afară: altfel „selectează un
  emoji și scrie peste el" ar lăsa jumătate de caracter.
- `src/components/EditorialPage.tsx` — `field` devine `{ blockId, text, caret, selection }`; `openField`
  ține minte locul atingerii și ca prim interval; `onSelectionChange` păstrează intervalul raportat
  (`snapSelection`) în loc să-l arunce; efectul de inserare scrie la `selection ?? caret ?? text.length` și
  lasă cursorul după emoji. Fără interval raportat niciodată, comportamentul vechi rămâne (la coadă) — este
  singurul caz în care nu există nimic mai bun de folosit.
- `src/app/text.tsx` — doar comentariul lui `insertEmoji` s-a schimbat: cererea era deja corectă (nonce, nu
  rescrierea paginii).


### 33.4 Originea conținutului pe pagină: o declarație citată, nu o verificare

Declarația exista la scris (`PROVENANCE_LABELS`, `lib/publishClient.ts`), era validată și păstrată de server
(`normalizeProvenance`, `lib/moderation.js`) și venea în fiecare răspuns (`socialPostView`,
`provenance: post.provenance`). Pe partea de citire nu o desena nimeni: patru răspunsuri diferite arătau la fel.

- `src/lib/socialTypes.ts` — `SocialPost.provenance?: ContentProvenance | string | null`, cu motivul scris
  lângă el (compozitorul a trimis-o dintotdeauna; cititorul nu a tipărit-o niciodată).
- `src/lib/postOrigin.ts` (nou, pur) — `POST_ORIGIN_LABELS`, `POST_ORIGIN_HINT`, `originOf(post)`:
  - etichetele încep toate cu „Declarat": serverul păstrează ce a ales autorul, nu verifică poza, iar o
    formulare de tipul „Fotografie reală" ar preface propoziția autorului în promisiunea produsului;
  - `NOT_DECLARED` nu desenează nimic — o poartă fiecare postare scrisă înainte de compozitor, deci
    tipărirea ei ar eticheta toată arhiva și nu ar spune nimic despre nicio postare; un post nedeclarat **nu**
    este re-etichetat „creat de autor", fiindcă nimeni nu a declarat asta;
  - o valoare necunoscută (server mai nou, grafie veche) nu se ghicește: `originOf` întoarce `''`.
- `src/components/PostCanvas.tsx` — a treia linie discretă din antet, sub loc și aliniată cu numele
  (`marginLeft: head.disc + 8`), în **afara** `Pressable`-ului care duce la profil: „Asistat de AI" este o
  propoziție despre postare, nu un mod de a deschide un profil. `accessibilityLabel` = eticheta **plus**
  `POST_ORIGIN_HINT`, deci un cititor de ecran aude și ce nu este declarația. `POST_HEAD.originLines = 2`.
  Celula de arhivă (`variant="tile"`) nu o desenează: 155 px nu țin o propoziție, iar celula nu este o
  suprafață de citire.

Fiindcă feed-ul și profilul citesc aceeași compoziție (`FeedScreen`/`post/[id].tsx` → `PostCard` →
`PostCanvas`), o singură linie acoperă amândouă; `ReelPage` (poze, clipuri) folosește tot `PostCanvas`.


### 33.5 Testele rundei

Pe calculator, toate verzi (cifrele în §33.6):

- `apps/nexus-web/test/post-text-faces.test.js` (nou, 5 cazuri) — `openDb(':memory:')` + `handleRequest`:
  capacitatea raportată este `2`; matricea **144** de combinații (6 fețe × 4 mărimi × 6 teme) publică,
  persistă în rând și se întoarce întreagă prin `GET`; combinații arbitrare; contractul `1` publică neschimbat
  (pagină veche, postare fără stil); refuzurile refuză în continuare.
- `apps/nexus-web/test/post-content-origin.test.js` (nou, 4 cazuri) — toate cele patru valori
  `CONTENT_PROVENANCE` supraviețuiesc publicării, rândului, citirii postării și feed-ului; nedeclaratul rămâne
  `NOT_DECLARED` (și `USER`/`UNKNOWN`/`user` se normalizează la el); o valoare necunoscută este refuzată cu
  `provenance invalid` și nu se scrie nimic; declarația merge și pe o poză și pe o pagină cu stil, fără să
  schimbe felul sau textul.
- `apps/nexus-mobile/scripts/test-text-insert.cjs` (nou, 11 cazuri) — început/mijloc/sfârșit, înlocuirea unui
  interval, „selectează tot", fără interval (vechea comportare), interval imposibil sau invers, cursor în
  mijlocul unei perechi surrogate, rânduri noi păstrate, trei emoji consecutive, emoji compuse (familie ZWJ,
  steag, ton, inimă cu selector) — plus două teste de legare: efectul din `EditorialPage` folosește
  `insertAtSelection`, iar ce se scrie în câmp este exact ce ajunge în pagină la `Gata` (`setBlockText`).
- `apps/nexus-mobile/scripts/test-post-origin.cjs` (nou, 5 cazuri) — cele trei etichete și nedeclaratul,
  onestitatea formulării (niciun „verificat"/„real"/„garantat"), o singură etichetă per postare, în afara ușii
  de profil, celula de arhivă curată, `provenance` în tip și în `socialPostView`.
- `scripts/test-backend-version.cjs` — patru cazuri noi pentru contractul v2 (poarta întreabă o dată; server
  `1` refuză cu litera pe nume; pagina obișnuită nu întreabă nimic; serverul care tace nu blochează) și
  aserțiunea pe `build-info.js` rescrisă pe nume + valoare (`text_style: 2`).
- `scripts/test-text-field.cjs` și `scripts/test-text-integrity.cjs` — aduse la adevărul nou: pinul atingerii
  se eliberează în continuare, dar intervalul este **păstrat**, iar emoji-ul nu se mai lipește la coadă.

### 33.6 Dovezi

**Pe calculator.** `apps/nexus-web`: `node --test` complet — **862 teste, 0 eșecuri** (incluzând cele două
fișiere noi). `apps/nexus-mobile`: lanțul `npm test` — **58 de fișiere, 0 eșecuri**; `tsc --noEmit` exit 0.

**Backend local repornit.** Procesul de pe portul 5000 rula din 27 octombrie și își ținea amprenta în memorie
(`3f9ddd8b…`, `text_style: 1`). După repornire (`node --max-old-space-size=1024 server.js`, PID nou):
`source_fingerprint: c34cf0d2…`, `capabilities.text_style: 2`. Poarta telefonului, întrebată pe viu:
`slab` → acceptat (v2), `casual` + `xlarge` → acceptat, `condensed` → acceptat, `serif` + `large` → fără poartă.


**Pe telefon** (Xiaomi MIX Flip, 2,6 px/dp, ecran 1220×2656), captură
`JUNGLE_BOOK_VERIFICATION/final_jpg/r33_reader_after_reload.jpg` (`RESULT_JSON`, `focusOk: true`,
`exec-out`, 490 113 bytes): o pagină de text deschisă din profilul propriu arată, sub nume și sub loc, linia
**„Declarat: cameră"**. Măsurat în arborele de accesibilitate (`uiautomator dump`):

| element | bounds (px) | dp (÷2,6) |
| --- | --- | --- |
| nume | `[197,150][838,210]` | x 75,8…322,3 · y 57,7…80,8 |
| `@wallet4e8gv6 · 27 min` | `[197,210][838,256]` | y 80,8…98,5 |
| loc („Czyżyny, Cracovia") | `[197,258][838,304]` | y 99,2…116,9 |
| **„Declarat: cameră"** | `[197,307][839,353]` | x **75,8** · y **118,1…135,8** |

Marginea de stânga este identică cu a numelui și a locului (75,8 dp = fața de 67,8 dp + 8 dp de aer), deci
eticheta se aliniază cu coloana de cuvinte pe orice variantă; diferența față de rândul locului este de 3 px
(≈1,2 dp, adică `POST_HEAD.locationGap`), iar înălțimea de 46 px (17,7 dp) este un singur rând. Nodul are
`content-desc` = „Declarat: cameră. Ce a declarat autorul despre cum a fost făcut conținutul. Jungle Book nu
verifică declarația.", `clickable="false"`, `focusable="false"` — este text, nu parte din ușa profilului.
Restul antetului (nume, handle, ceas, loc, „Editează profilul") este neschimbat, iar pagina, folio-ul `1/2`,
railul și bara de jos arată ca în runda 32.

### 33.7 Ce rămâne deschis (și de ce nu se poate închide de aici)

1. **Deployment-ul Railway trebuie actualizat pentru ca „Mașină" să se publice în producție.** Serverul din
   fața telefonului are allowlist-ul de trei fețe; arborele are șase. Până la o publicare aprobată de owner,
   refuzul este cel *corect* (pagina nu pleacă, autorul află de ce și nu pierde textul), dar nu este succesul
   cerut. Nu se raportează ca rezolvat din client.
2. **Emoji-ul la cursor nu a fost văzut pe telefon în runda asta.** Regula este acoperită de 11 teste pure și
   de două teste de legare, iar câmpul a fost deschis pe ecran în runde anterioare, dar gestul „cursor la
   mijloc, apasă emoji" nu a fost executat pe dispozitiv: cere compozitorul deschis, o atingere în text și o
   apăsare în panoul de emoji. Este primul lucru de făcut în runda următoare, cu două capturi (înainte/după).
3. **Un post nedeclarat nu a fost văzut pe ecran** după această rundă: captura dovedește partea „cu etichetă".
   Partea „fără etichetă" este ținută de `originOf` (test) și de `{origin ? … : null}` (formă unică), dar o
   poză cu un post moștenit ar închide subiectul. Nu s-a putut face fără Back, iar regula rundelor interzice
   Back/Home în timpul capturilor.
4. **Matricea de 144 de combinații rulează pe server, nu pe telefon**: că cele șase fețe *se desenează*
   corect pe ecran este verificat de `test-text-integrity.cjs` (G) pe măsurători de font, nu de o captură.
5. **Webul** (`apps/nexus-web`) are propriul cititor și nu a fost portat nici la eticheta de origine (§31.5.6).


---

# Runda 34 — migrare locală completă, dependența Railway scoasă, audit al aplicației

**Decizia proprietarului (28 octombrie 2026):** Jungle Book rulează în întregime pe PC-ul proprietarului.
Railway nu este backendul dorit și nu este ținta de deployment. Telefonul vorbește cu PC-ul, iar nimic din
aplicație nu mai are voie să cadă, în tăcere, pe un host remote.

## 34.1 Ce s-a găsit la început (inventarul de dependențe)

Aplicația era deja locală în fapt: serviciul `tools/local-backend` ținea portul 5000, baza
`C:\Nexus\data\nexus.sqlite`, media în `C:\Nexus\data\media`, pornit de task-ul programat „Jungle Book
Backend” și vegheat de `jungle-backend-service.mjs`. Ce rămăsese erau **căi de întoarcere** și **texte**:

| componentă | unde | local/remote | Railway implicat | ce s-a făcut | cum se verifică |
| --- | --- | --- | --- | --- | --- |
| rezolvarea originii API | `src/lib/apiOrigin.ts` | **remote implicit** | da — `HOSTED_ORIGIN` | scos; implicitul este `http://localhost:5000` prin `adb reverse` | `scripts/test-api-origin.cjs` (8 teste) |
| eticheta din shell | `apiOriginLabel` | local | numele „API: Railway” | scos; orice host străin e numit pe nume | același fișier de test |
| pornirea Metro | `tools/dev-start.ps1` | **remote implicit** | da — `$apiOrigin` cădea pe Railway | origine derivată local + `adb reverse tcp:5000` când e loopback | `Parser::ParseFile` + rulare |
| script de Metro | `apps/nexus-mobile/builds/metro-railway.cmd` | remote | da | retras; `builds\metro-local.cmd` citește `.env` | fișierul întors cu codul 3 |
| text în interfață | `CommentsSheet.tsx`, `CaptureEditor.tsx` | — | „backend-ul Railway”, „selecția semnată de Railway” | „serverul”, „selecția semnată de server” | `npm test` (brand + server-errors) |
| comentarii de cod | `publishClient`, `capturePublish`, `commentNavigation`, `postInteractions`, `ProfileMenuSheet`, `SettingsScreen` | — | descriau un backend remote | rescrise la „server” | citire |
| referințe de instrument | `tools/web-ref/harness.mjs` | remote | da (implicit) | rămâne pentru arhiva de referință web, **nu** e în calea de date | citire |
| documentație istorică | `HANDOFF.md`, `MIGRATION.md`, `JUNGLE_BOOK_PROGRESS.md` | — | da, istoric | **păstrată neatinsă**: este jurnalul, nu runtime-ul | citire |
| xPortal / WalletConnect | `lib/mvx.js`, `NEXUS_WC_PROJECT_ID` | **extern, obligatoriu** | nu | neschimbat: autentificarea xPortal nu se atinge | `/auth/mvx/init` |

Cele două locuri care *foloseau* Railway în timpul rulării erau deci `apiOrigin.ts` (implicitul) și
`dev-start.ps1` (implicitul de pornire). Amândouă sunt acum locale, iar un test eșuează dacă un host
remote reapare în sursele aplicației.


## 34.2 Implicitul remote, scos din rezolvarea originii

`apiOrigin.ts` avea trei trepte, iar a treia era un deployment Railway: un build care nu găsea
`EXPO_PUBLIC_NEXUS_API_URL` și nici un host de packager citea și **scria** alt server decât al
proprietarului. Treapta a treia este acum `http://localhost:5000` — loopback-ul telefonului, adus pe PC
prin `adb reverse tcp:5000`, pe care `tools/dev-start.ps1` îl deschide când originea este loopback. Nu
există niciun alt URL în fișier, iar `scripts/test-api-origin.cjs` verifică exact asta:

* o origine configurată câștigă, fără slash final;
* un build de dezvoltare urmează PC-ul care a servit bundle-ul (LAN, portul 5000);
* un packager pe `localhost` și un build fără nicio configurare cad amândouă pe `http://localhost:5000`
  și **spun pe consolă** că au nevoie de `adb reverse tcp:5000`;
* singurele URL-uri din fișier sunt loopback-ul și șablonul `${host}` al packager-ului;
* niciun fișier din `src/lib` care atinge calea de date nu mai numește un host remote.

Consecința practică: dacă PC-ul nu răspunde, cererea **eșuează vizibil**; nu mai există un mod în care
aplicația să pară că merge pentru că vorbește cu altcineva.

## 34.3 Un singur backend, măsurat — nu presupus

Unealta nouă `tools/local-backend/audit-local.mjs` întreabă, în aceeași rulare, serviciul, baza și
depozitul de media. Baza se deschide `readOnly`; singura scriere este opțională și etichetată
(`--handle <h>` creează o sesiune ca un login, cu `device_id = "audit"`).

Rulat pe instanța vie (28 octombrie 2026, 21:21 UTC), **toate verificările au trecut**:

```
[PASS] /health răspunde 200 — status=200, environment=local_development, users=9, posts=48
[PASS] serviciul raportează starea ready — status=ready
[PASS] /api/version răspunde și anunță text_style v2 — commit=6fd70c5, api_contract=1, text_style=2
[PASS] editorial_document este anunțat — editorial_document=1
[PASS] numărul de conturi din bază este cel raportat de /health — db=9, health=9
[PASS] numărul de postări din bază este cel raportat de /health — db=48 rânduri (46 active), health=48
[PASS] fiecare rând de media are fișierul lui — 24 rânduri, 0 lipsă
[PASS] dimensiunea din bază este dimensiunea de pe disc — 0 nepotriviri
[PASS] numele fișierului este sha256-ul conținutului — 0 nepotriviri
[PASS] media se descarcă prin HTTP local, cu dimensiunea din bază — 4/4 eșantioane
[PASS] /api/me răspunde pentru contul audit — @wallet4e8gv6, persona=social
[PASS] feed-ul se încarcă din backend-ul local — 20 postări în prima pagină
[PASS] profilul propriu se încarcă, cu arhiva — 21 postări (text=7, image=13, video=1)
[PASS] o postare se citește din backend-ul local — #52 text
[note] fețe și mărimi citite din arhivă — serif/medium
[note] declarații de origine în arhivă — #52=CAMERA_CAPTURED_DECLARED, #51=CAMERA_CAPTURED_DECLARED
[note] notificări — 0 elemente
```

Cele două numărători care trebuie să fie egale — `/health` și `SELECT COUNT(*)` din fișierul de pe disc —
sunt egale, deci telefonul citește **chiar** baza din `NEXUS_DATA_DIR`, nu o copie uitată în repository
(`apps/nexus-web/data` păstrează doar baza de dezvoltare de dinaintea importului, cu 39 de conturi de test).

## 34.4 Baza de date și media: integritate, nu doar existență

| categorie | local (28 oct 2026) | dovada |
| --- | --- | --- |
| conturi | 9 | `/health` = `users` |
| profiluri (personas) | 12 | inventar |
| postări | 48 (46 active: image 21, text 17, video 8) | inventar + arhiva din API |
| media atașată | 30 legături `post_media` | inventar |
| comentarii | 41 | inventar |
| reacții / salvate | 13 / 0 | inventar |
| urmăriri | 2 | inventar |
| conversații / mesaje | 0 / 0 | inventar (mesageria nu e folosită pe acest cont) |
| fișiere media | 24 fișiere, 24 rânduri | hash + dimensiune + HTTP |
| proveniență salvată | `NOT_DECLARED` 45, `CAMERA_CAPTURED_DECLARED` 3 | inventar |

Fișierele poartă numele sha256-ului conținutului, iar toate cele 24 se decodau la dimensiunea din bază:
store-ul este conținut-adresat, deci o copiere greșită ar fi fost prinsă de hash, nu de „se încarcă poza”.


## 34.5 Toate cele șase fețe, pe backend-ul local, prin HTTP

Runda 33 a reparat *contractul* (`text_style: 2`) și a dovedit matricea în memorie
(`test/post-text-faces.test.js`). Ce lipsea era dovada că un server **pornit**, cu o **sesiune reală**,
păstrează pagina: ruta, cookie-ul, `Idempotency-Key`, rândul din SQLite și citirea înapoi.
`apps/nexus-web/scripts/text-faces-http-e2e.mjs` (`npm run test:text-faces`) face exact atât, pe un
director temporar (baza proprietarului nu este atinsă; se șterge la final):

```
[PASS] serverul local răspunde la /health — 1 conturi în baza temporară
[PASS] serverul local anunță text_style v2 — text_style=2, contract=1, commit=6fd70c5
[PASS] 144 de publicări (6 fețe × 4 mărimi × 6 teme) sunt acceptate și întoarse la fel — 144/144 prin GET /api/posts/:id
[PASS] litera serif|sans|mono|slab|casual|condensed publică și la mărimea xlarge
[PASS] pagina apare în arhiva profilului — HTTP 200, 100 postări în arhivă
[PASS] conținutul SYSTEM_TEST nu intră în feed-ul clasat — HTTP 200, 0 postări, 0 ale contului de test
[PASS] fiecare pagină este în baza de date cu stilul ei — 144/144 rânduri identice cu cererea
[PASS] toate paginile aparțin contului SYSTEM_TEST — @face_owner_e2e
[PASS] toate paginile stau în persona social — social
```

Ultimul rând de „feed” este o constatare, nu un eșec: `createUser` marchează automat `SYSTEM_TEST` (numele
contului spune asta) iar `listSocialFeed` citește numai `HUMAN_ORGANIC`, deci conținutul sintetic nu
influențează clasamentul — regula din `AGENTS.md`, verificată aici pe viu. Paginile se văd în arhiva
autorului, care este suprafața de citire pentru un cont de test.

Pe backend-ul proprietarului, aceleași două lucruri se văd direct: `/api/version` → `text_style: 2`, iar
arhiva `@wallet4e8gv6` întoarce pagini cu `text_style` (azi `serif/medium`, fiindcă atât s-a scris până
acum). Publicarea unei pagini „Mașină” rămâne o acțiune a proprietarului.

## 34.6 Originea conținutului: doar AI primește o linie

Decizia din runda 34 este mai îngustă decât eticheta din runda 33:

| valoare salvată | ce se vede |
| --- | --- |
| `NOT_DECLARED` | nimic |
| `CAMERA_CAPTURED_DECLARED` | nimic |
| `AI_ASSISTED` | **Asistat de AI** |
| `AI_GENERATED` | **Generat cu AI** |

Prefixul „Declarat:” a fost scos din textul vizibil. Propoziția pentru cititorul de ecran a rămas
(„Ce a declarat autorul… Jungle Book nu verifică declarația.”), fiindcă două cuvinte nu pot spune nici
cine a declarat, nici că nu e verificat. Valoarea salvată, cele patru valori acceptate de server și
`normalizeProvenance` sunt neatinse: s-a schimbat **doar** ce se desenează. `scripts/test-post-origin.cjs`
(5 teste) ține regula, inclusiv forma unică `{origin ? (…) : null}` din `PostCanvas` și faptul că celula de
arhivă nu tipărește nimic.

Pe telefon, postarea #52 are `CAMERA_CAPTURED_DECLARED` și **nu** mai arată nicio linie sub loc (captura
`r34_feed_after_origin_change.jpg`, antetul are exact trei rânduri: nume, `@wallet4e8gv6 · 57 min`, loc).
O pagină `AI_ASSISTED` nu a fost publicată — vezi §34.9.


## 34.7 Emoji la cursor: ce lipsea pe telefon (și de ce nu era aritmetica)

Runda 33 a reparat aritmetica (`lib/textInsert.ts`, 11 teste pure) și a păstrat intervalul raportat de
telefon. Pe dispozitiv, gestul a arătat însă altceva: scrie „Ana are mere.”, așază cursorul, apasă
„Gata”, apasă „Emoji” — emoji-ul apare **la sfârșitul frazei**.

Cauza nu era inserarea, ci drumul până la ea:

1. cât timp foaia de scriere e deschisă, tastatura acoperă bara compozitorului, deci butonul „Emoji” nu
   poate fi apăsat (măsurat: câmpul se termină la y=1783 px, bara stă la y≈2438…2482 px);
2. butonul Înapoi al telefonului nu doar ascunde tastatura — `hardwareBackPress` închide foaia;
3. `closeField` arunca foaia **și** intervalul (`setField(null)`), iar ramura din efectul de inserare care
   rulează fără foaie deschisă nu avea ce cursor să folosească și cădea pe `text.length`.

Reparația este cea mai mică ce face gestul posibil: `lastCaretRef` ține ultimul cursor cunoscut (așezat de
atingerea pe hârtie, de fiecare `onSelectionChange`, sau la închidere) și este citit de inserarea care
rulează fără foaie; dacă paragraful nu mai există, se revine la comportamentul documentat (coada ultimului
paragraf). Este un ref, nu o stare: nu re-randează pagina. `test-text-field.cjs` a primit un al zecelea test
care ține contractul.

**Pe telefon** (Xiaomi MIX Flip, focus verificat înainte de fiecare input, două capturi citite):

* `r34_emoji_at_caret.jpg` — textul `A😀na are mere.`: degetul a atins începutul rândului (offset 1), iar
  emoji-ul a intrat **între „A” și „na”**, nu la coadă. Contorul: 15/20000.
* `r34_emoji_mid_sentence.jpg` — textul `A😀na are mer😀e.`: o a doua atingere la mijlocul rândului a produs
  `mer😀e`, iar cursorul albastru se vede **imediat după** al doilea emoji (înlănțuirea funcționează).

Ce nu a fost exersat pe dispozitiv: înlocuirea unui interval selectat și emoji-ul lângă un rând nou. Ambele
sunt acoperite de teste pure (`insertAtSelection` cu `{start,end}` și cu `\n`), dar nu au o poză.

## 34.8 Dovezi

**Pe calculator.** `apps/nexus-web`: `node --test test/*.test.js` — **862 teste, 0 eșecuri**.
`apps/nexus-mobile`: lanțul `npm test` — **58 de fișiere, 0 eșecuri**, inclusiv noile
`test-api-origin.cjs` (8 teste, rescris), `test-post-origin.cjs` (5 teste, rescris) și
`test-text-field.cjs` (10 teste, unul nou). `tsc --noEmit` exit 0.
`npm run test:text-faces` — matricea de 144 prin HTTP, PASS.

**Repornire controlată.** `stop-backend.ps1` → „backend stopped cleanly”, portul 5000 închis;
`start-backend.ps1` → supervisor nou (PID 25492, copil 23636), `healthy: true`, `data dir C:\Nexus\data`,
`api/version` OK. După repornire, `audit-local.mjs` a trecut din nou toate verificările: aceleași 9 conturi,
48 de postări, 24 de fișiere media, 0 lipsă, 0 nepotriviri de hash.

**Pe telefon.** `r34_after_restart.jpg` — după ce serviciul a fost oprit și repornit, aplicația reîncărcată
arată aceeași postare din backend-ul local („Mother Fucker / @wallet4e8gv6 · 1 h / Czyżyny, Cracovia”,
pagina „1/2”, bara de jos), fără nicio linie de origine sub loc. Toate cele trei capturi au `focusOk: true`
și au trecut validarea PNG → JPG a uneltei.

**Dovada din partea serverului** (jurnalul serviciului, `NEXUS_REQUEST_LOG=1`, `C:\Nexus\logs\
server-2026-10-28.log`): cererile telefonului vin de la `192.168.1.184` cu `okhttp/4.12.0` — **47 de cereri
pe 9 rute** (`/api/social/feed`, `/api/profiles/wallet4e8gv6`, `/api/notifications`,
`/api/chat/conversations`, `POST /api/social/impressions`…), toate `200` sau `202`. Alături apar cererile
`/api/version` de pe `127.0.0.1` cu user-agent `node`, adică uneltele de audit din această rundă
(`audit-local.mjs`, `text-faces-http-e2e.mjs`), nu telefonul. Deci telefonul vorbește cu PC-ul, iar
aplicația nu mai atinge niciun alt server.


## 34.9 Railway: ce s-a inventariat, ce lipsește pentru retragere

Aplicația nu mai are nicio cale de rulare către Railway (secțiunea 34.1). Ce rămâne este **platforma**,
nu codul, iar inventarul ei nu se poate face fără accesul proprietarului: pe acest PC nu există `railway`
CLI, nici `~/.railway`, nici `RAILWAY_TOKEN`, deci nu pot fi citite serviciile, volumele, domeniile sau
backup-urile proiectului. Ce se știe din exportul deja făcut (27 octombrie, `~/NexusBackups/
railway-export-20261027`, `manifest.json`):

| ce | valoare din manifest |
| --- | --- |
| sursă | `https://nexus-deepsek-production.up.railway.app` |
| commit al instanței hosted | `e74f8ff` |
| conturi | 8 (`devnet_test_01`, `test`, `urailwaytest01a20d`…`05313a`, `wallet4e8gv6`) |
| profiluri | 12 |
| postări | 36 (18 în feed) + detalii pentru toate |
| comentarii | 37 |
| media | 20 referite, **20 descărcate**, 0 eșuate |
| fișiere scrise | 94 (API JSON + media) |
| acces SQLite direct | **nu** — „HTTP only; the SQLite file lives on the platform volume and is not reachable without platform credentials” |

Importul acelui export în `C:\Nexus\data` (`import-report.json`, 27 octombrie) a raportat
`commitments_verified: 36`, `media_files_copied: 20`, `media_missing: []`,
`commitment_mismatches: []`, `integrity: ok`. Baza locală are azi **mai mult** decât exportul (48 de
postări față de 36, 24 de fișiere față de 20), fiindcă postările de după import s-au scris direct aici.

Deci: datele și media necesare sunt local. Ce nu se poate afirma fără platformă: dacă volumul Railway mai
are vreun obiect care nu a fost niciodată expus prin API (un avatar orfan a fost deja semnalat în §18.9),
dacă există backup-uri de platformă și ce domenii/politici sunt atașate. Pașii de retragere, în ordine, și
ce se întâmplă la fiecare:

1. **Confirmare în dashboard** (owner): proiectul, serviciile, volumul, domeniile, backup-urile.
2. **Export final** dacă între timp s-a mai scris ceva: `node tools/migration/export-railway.mjs <dir>`
   cu `NEXUS_PROD_URL` + `NEXUS_PROD_TOKEN` (token de sesiune al contului, nu o parolă).
3. **Comparație** cu `C:\Nexus\data` pe id-uri și pe hash-uri de media înainte de orice oprire.
4. **Opriearea serviciului** (nu ștergerea): aplicația nu mai depinde de el, deci efectul este zero pentru
   telefon; reversibil dintr-un clic. Domeniul rămâne rezervat.
5. **Ștergerea permanentă** — separat, cu confirmare explicită, după ce un backup local a fost restaurat
   într-un drill (`restore-backup.mjs --drill`).

Nimic din pașii 3–5 nu a fost executat: nu am oprit, nu am șters și nu am modificat nimic remote.

## 34.10 Ce rămâne deschis

1. **O pagină „Mașină” publicată de owner** — contractul este v2 local, dar publicarea este acțiunea lui;
   nu s-a publicat conținut de test în feed-ul real.
2. **Eticheta „Asistat de AI” pe ecran** — nu există nicio postare cu această valoare în baza locală, iar
   a crea una ar însemna fie să public ceva nedeclarat de owner, fie să modific provenance-ul unei postări
   reale. Regula este ținută de 5 teste; o poză cere o postare AI declarată de owner.
3. **Scrierile sociale pe instanța vie** (comentariu, reacție, salvare, follow, editare de profil,
   upload de avatar/foto/clip) nu au fost exersate pe datele proprietarului — ar însemna să modific
   conținutul lui. Ele sunt acoperite de suita backend (`node --test`, 862 de teste) și de e2e-urile pe
   instanțe temporare; pe instanța vie sunt **NEVERIFICATE**.
4. **Mesageria** nu are date pe acest cont (0 conversații, 0 mesaje), deci nu are ce verifica.
5. **Webul** (`apps/nexus-web`) are propriul cititor, fără eticheta de origine și fără poarta de contract
   (§31.5.6) — neschimbat în această rundă.
6. **Sesiunea de audit** — `audit-local.mjs --handle` a scris un rând în `sessions` cu
   `device_id = "audit"`, `device_label = "audit runda 34"`. Este o adăugare documentată; se poate închide
   din aplicație ca orice sesiune.
7. ~~**Rundele 20–34 sunt necomise**~~ — comise în runda 35 (§35.1).

## 35. Checkpoint git și autentificarea locală: de ce nu intra nimeni (28 octombrie 2026)

**Ce s-a cerut:** salvarea muncii rundelor 20–34 într-un commit sigur, apoi diagnosticarea loginului cu
email/parolă (`test@nexus.ro`) și a loginului xPortal, fără a modifica datele, conturile sau parolele
owner-ului și fără a aduce Railway înapoi.

**Concluzia într-o propoziție:** munca rundelor 20–34 este salvată (commit `57c566c`), iar ambele loginuri
eșuau din **aceeași cauză de configurare locală, nu de cod**: baza adusă din exportul Railway nu are
**niciun** cont cu email și parolă (exportul nu cară credențiale), iar serverul local nu are `Project ID`
WalletConnect, deci `/auth/mvx/init` răspunde `503` înainte ca vreun relay Reown să fie contactat.

### 35.1 Checkpoint-ul

| | |
| --- | --- |
| depozit | `C:/Users/Romeo/projects/nexus_deepsek` (`https://github.com/rrommeoo1/nexus-deepsek.git`) |
| branch | `codex/camera-draft-stability` (verificat cu `git branch --show-current`, nu presupus) |
| commit | `57c566c` — `checkpoint: preserve Jungle Book rounds 20-34` |
| conținut | **174 de fișiere**, +20 860 / −2 947 |
| poziție | `ahead 24` față de `origin/codex/camera-draft-stability`; **niciun push** (nu a fost aprobat) |
| verificare | `git status --short --branch` după commit: 0 fișiere în staging, 18 rămase necomise (scratch-uri de sesiune, §35.2) |

Commitul a fost construit **pe căi explicite**, nu cu `git add -A`: `git add -u` pentru cele 107 fișiere
deja urmărite, apoi `git add <cale> …` pentru fiecare fișier nou verificat. Un `git add -A` ar fi luat și
cele 254 de intrări necunoscute de la `git status`, dintre care majoritatea sunt capturi, dump-uri și
sonde de sesiune.

### 35.2 Ce a intrat și ce a rămas afară

**A intrat** (sursă, teste, unelte, documentație):

| grup | fișiere |
| --- | --- |
| `apps/nexus-mobile/src/**` | 93 (inclusiv `postOrigin.ts`, `editorialDocument.ts`, `textInsert.ts`, `theme/editorial.ts`, `app/post/[id].tsx`, `app/tag/[tag].tsx`) |
| `apps/nexus-mobile/scripts/**` | 44 (25 de suite `test-*.cjs` noi, `build-contact-sheet.ps1`, `capture-screen.ps1`) |
| `apps/nexus-web/**` | `scripts/text-faces-http-e2e.mjs`, `test/post-text-faces.test.js`, `test/post-content-origin.test.js` |
| unelte | `scripts/capture-android-screen.ps1`, `tools/local-backend/audit-local.mjs`, `tools/parity/adb-pair.ps1`, `tools/attach-devnet-{payee,wallet}.mjs`, `tools/images/**` |
| documentație | `HANDOFF.md`, `JUNGLE_BOOK_PROGRESS.md`, `JUNGLE_BOOK_VISUAL_VERIFICATION.md`, `docs/DEV-WORKFLOW.md`, `docs/22-local-to-hosted.md`, `docs/PARITY-MATRIX.md`, `docs/MONETIZATION-SPEC.md`, `apps/nexus-mobile/README.md`, `MIGRATION.md` |
| reguli | `.clinerules`, `.clineignore`, `AGENTS.md` |

**A rămas afară, intenționat:** 18 fișiere (sonde `_*.mjs` din `tools/`, dump-uri `docs/parity-report/*.txt`,
`apps/nexus-web/.tmp-inspect.cjs`) plus folderele de dovezi (`JUNGLE_BOOK_VERIFICATION/`, `docs/screens/`,
capturile noi din `docs/parity-report/`, `planning/evidence-*.png`) și scratch-ul din rădăcină
(`_bundle_*.js`, `_xportal_base.apk`, `_wc_src/`, `_session.json`, `_*.txt`). Niciunul nu este produs: sunt
dovezi de sesiune, iar unele poartă numele contului sau id-ul dispozitivului.

`.gitignore` a fost întărit ca să nu poată fi luate din greșeală: `JUNGLE_BOOK_VERIFICATION/`,
`docs/screens/`, `docs/parity-report/**/*.{png,xml,dump.txt}`, `planning/evidence-*.png`, `/_*`
(scratch-ul din rădăcină) și `apps/nexus-mobile/_out_*.txt`. Intrarea `_*` a fost verificată înainte:
`git ls-files ':(top)_*'` întoarce **0** fișiere urmărite, deci regula nu ascunde nimic real.

**Verificarea de secrete**, pe diff-ul complet (924 KB) și apoi pe cel din staging (1,6 MB): zero potriviri
pentru `PRIVATE KEY`, `eyJhbGciOi` (JWT), `sk_live`, `AKIA…`, `NEXUS_SESSION_SECRET=<valoare>`,
`NEXUS_TEST_ACCOUNT_PASSWORD=<valoare>`, `password = "<…>"`, `mnemonic`, `xprv` și `erd1…:`. Niciun fișier
`.env`, `.sqlite`, `-wal`/`-shm`, log, imagine sau clip nu apare între cele 174. `apps/nexus-mobile/.env.example`
este singurul fișier de mediu comis — și trebuie să fie, `.gitignore` are `!**/.env.example`.

Testele au rulat **înainte** de commit, pe arborele de lucru care urma să fie comis: web `npm test`
**868 teste / 0 eșec**, mobil `npm test` **exit 0** (58 de fișiere), `tsc --noEmit` **exit 0**.

### 35.3 De ce loginul cu email eșua: contul nu există în baza locală

Instanța vie răspunde pe `http://127.0.0.1:5000` (`/health`: `status=ready`, `environment=local_development`,
`users=9`, `posts=48`, `media=24`), `/api/version` raportează `commit=6fd70c5`, `text_style=2`, `node v24.19.0`,
deci **codul din arbore**, nu un bundle vechi. Baza este `C:\Nexus\data\nexus.sqlite`, deschisă **read-only**:

| fapt | valoare |
| --- | --- |
| `test@nexus.ro` în `users` | **absent** (`SELECT * FROM users WHERE lower(email)=?` → nimic) |
| conturi în total | 9 |
| conturi cu `email` | **0** |
| conturi cu `password_hash` | **0** |
| `@test` (id 1) | `email = NULL`, `password_hash = NULL`, `email_verified = 0`, `traffic_class = HUMAN_ORGANIC`, `account_state = active`, `onboarded_at = 1`, 7 postări, o singură persona (`social`) |

Deci **loginul pe email nu poate reuși pentru nimeni**, cu nicio parolă: `POST /auth/email/login` face
`repo.getUserByEmail(email)`, iar pe un rând fără `email` întoarce `null` → `401 invalid credentials`.
Nu este „parola greșită", este „nu există credențial". Ruta veche `/auth/login` nici măcar nu mai există
(`410`, „folosește autentificarea securizată cu email sau xPortal"); cea reală este `/auth/email/login`,
cu `scrypt` + `timingSafeEqual` (§35.4).

**De unde vine golul.** Exportul care a hrănit migrarea este
`C:\Users\Romeo\NexusBackups\railway-export-20261027`; în tot JSON-ul lui nu apare **niciun** email
(`Select-String 'nexus\.ro|@…'` → 0). `tools/migration/import-local.mjs` chiar scrie coloana `email`, dar
din câmpul pe care exportul nu îl are, iar `password_hash` **nu este importat deloc** (nici nu poate fi:
API-ul public al deployment-ului nu expune hash-uri). Ce a rămas din `test@nexus.ro` de pe Railway este
**handle-ul** `@test` cu postările lui — exact ce trebuia păstrat, minus identitatea de login.

### 35.4 Parola: ce s-a putut verifica și ce nu

Algoritmul este clar din cod (`apps/nexus-web/lib/security.js`): `scryptSync(parolă, sare, 64)` cu
parametrii impliciți ai lui `node:crypto` (`N=16384, r=8, p=1`), sare de 16 octeți în hex, stocat ca
`<sare>:<hash>`, comparat cu `timingSafeEqual`; `hashPassword` refuză parolele sub 8 caractere.

Verificarea s-a făcut prin **funcția produsului** (`verifyPassword`), pe baza vie, cu două candidate — forma
reținută de owner și forma fără spațiu, singura care apare într-un artefact de build (gitignorat) al unei
autentificări reușite de pe deployment. Rezultatul este **irelevant prin construcție**: nu există hash față
de care să compare, deci `verifyPassword` nu a putut fi hrănită. Parola **nu este validată** și nu se
afirmă că este corectă. Nu a fost scrisă, tipărită, logată, salvată sau comisă, iar aici e numită doar
„forma reținută".



### 35.5 Repararea minimă: `--adopt-handle` (pregătită, **ne rulată** pe datele owner-ului)

Adoptarea unui cont migrat este o **schimbare de cod**, nu un `UPDATE` scris de mână, și e oprită implicit:

| fișier | schimbare |
| --- | --- |
| `apps/nexus-web/lib/preview-test-account.js` | opțiune nouă `adoptHandle` (implicit `false`). Cu ea: dacă emailul nu există dar handle-ul da, leagă emailul de **acea** înregistrare și îi pune parola; refuză dacă handle-ul poartă deja **alt** email („already assigned to another email"); fără flag, comportamentul de dinainte („already assigned") rămâne |
| `apps/nexus-web/scripts/dev-test-account.mjs` | flag `--adopt-handle`; tipărește explicit „email legat de contul existent @test (id 1): același cont, nicio înregistrare nouă" |
| `apps/nexus-web/test/preview-test-account.test.js` | **nou**, 6 teste: garda de preview, creare, re-rulare (aceeași înregistrare, parola veche moare), refuz fără flag, adoptare (același id, wallet-ul supraviețuiește, zero duplicate), refuz când handle-ul are alt email |

`server.js` cheamă `ensurePreviewTestAccount(repo)` fără opțiuni, deci calea de preview/producție este
**neschimbată**: adoptarea există doar pentru seeder-ul local, la cerere explicită.

**Impactul, dacă owner-ul aprobă:** se atinge **un singur rând** (`users.id = 1`, `@test`) — se scriu
`email = test@nexus.ro`, `email_verified = 1`, `password_hash` nou (sarea veche nu există, deci nu se poate
păstra), plus persona `social` dacă lipsește. Nu se creează cont, nu se mută postări, nu se șterge nimic;
`mvx_address` și `linked_wallet` rămân. Reversul este o restaurare din backup (`restore-backup.mjs`).
Comanda, după aprobare, este cea de mai jos, cu `C:\Nexus\data` ca director de date:

```powershell
$env:NEXUS_DATA_DIR='C:\Nexus\data'; $env:NEXUS_TEST_ACCOUNT_PASSWORD='<parola aleasă de owner>'
node apps\nexus-web\scripts\dev-test-account.mjs --adopt-handle
```

### 35.6 Matricea de autentificare, dovedită pe o **copie**

Ca să nu ating datele owner-ului, verificarea a rulat pe un **snapshot** luat cu API-ul de backup al SQLite
(`backup()`, 890 de pagini — fișierul viu este ținut deschis de server, deci nu se poate copia cu
`Copy-Item`), într-un director temporar, cu o instanță proprie pe portul **5099** și un
`NEXUS_SESSION_SECRET` propriu. Fișierul viu a fost recitit după teste: **neschimbat** (`test@nexus.ro`
absent, 9 conturi, 0 cu parolă). Directorul de probă a fost șters la final.

| pas | comandă / cerere | rezultat |
| --- | --- | --- |
| seeder fără flag | `dev-test-account.mjs` | **refuz**, exit 1, „preview test handle is already assigned", zero scriere |
| seeder cu flag | `dev-test-account.mjs --adopt-handle` | „adoptat: @test (id 1) <test@nexus.ro>", parolă validă: da, email verificat: da, persona social: da |
| 1. date corecte | `POST /auth/email/login` | **200**, `ok=true`, `@test`, `email_verified=true`, cookie-uri `nexus_session` + `nexus_device_id` |
| 2. sesiune | `GET /api/me` cu cookie | **200**, `@test`, `persona=social`, 5 profile |
| 3. parolă greșită | `POST /auth/email/login` | **401** `{"ok":false,"error":"invalid credentials"}` |
| 4. logout | `POST /auth/logout` → `GET /api/me` | **200**, apoi **401** (sesiunea moare) |
| 5. fără cookie | `GET /api/me` | **401** |
| 6. repornire | proces oprit, altul pornit (PID nou), **același cookie** | `GET /api/me` → **200**, `@test` — sesiunea supraviețuiește procesului |
| 7. celelalte conturi | `users` în copie | tot 9, aceleași id-uri, `@test` tot cu 7 postări |

Observație de metodă: prima încercare a pasului 6 a ieșit 401 din cauza **testului**, nu a serverului —
`Invoke-WebRequest -Headers @{Cookie=…}` este filtrat de .NET (antet restricționat). Repetat cu un
`CookieContainer` real (login → kill → restart → `/api/me` în același proces) a dat 200.


### 35.7 xPortal: cauza exactă este `503 WALLETCONNECT_PROJECT_NOT_ATTESTED`

`GET /auth/mvx/init` pe instanța vie, cu originea telefonului:

```json
503 {"ok":false,"code":"WALLETCONNECT_PROJECT_NOT_ATTESTED",
     "error":"xPortal nu este încă activat pentru http://192.168.1.153:5000. Este necesar un Project ID emis
              de WalletConnect Dashboard și această origine în Allowlist."}
```

Poarta este `walletConnectAttestation()` (`apps/nexus-web/lib/env.js`): `ready = projectIdConfigurat ȘI
dashboardAtestat ȘI origineAtestată`. În `C:\Nexus\env\jungle.env`:

| variabilă | stare acum | ce face |
| --- | --- | --- |
| `NEXUS_WC_PROJECT_ID` | **gol (0 caractere)** | fără el `projectIdConfigured = false` |
| `NEXUS_WC_PROJECT_ATTESTED` | **absent** | „allowlist-ul a fost confirmat în dashboard" |
| `NEXUS_WC_ATTESTED_ORIGINS` | **absent** | listă exactă de origini permise |
| `NEXUS_ORIGIN` | **absent** | originea se ia din `Host`, adică exact ce dă telefonul |
| `NEXUS_DEPLOYMENT_MODE` | `local` | deci **nu** se aplică implicitul de preview și nici Project ID-ul public |

Deci serverul refuză **înainte** de orice conexiune WalletConnect: pagina podului încarcă
`/xportal-bridge.html`, `/wc-bundle.js`, `/xportal-bridge.js` (toate 200) și moare la `init`. Mesajul care
ajunge în aplicație este exact ramura `wc-bundle|project id|allowlist|relay` din `xPortalFailureSentence`:
„Serverul nu poate deschide conexiunea WalletConnect acum…".

Dovada că **doar configurarea lipsește**: pe instanța de probă, cu `NEXUS_WC_PROJECT_ID` (32 hex),
`NEXUS_WC_PROJECT_ATTESTED=true` și originea în `NEXUS_WC_ATTESTED_ORIGINS`, același endpoint întoarce
**200** cu `init` real (`network=mainnet`, `chainId=1`, `signable_message`), iar cu un `Host` neatestat
întoarce **503** — regula de origine funcționează, dar cere **aceeași** origine pe care o încarcă WebView-ul.

### 35.8 Reown / allowlist: **neverificat direct**

Nu există CLI, token sau sesiune autentificată în browser pe acest PC, iar dashboard-ul Reown nu are API
public pentru allowlist. Deci **allowlist-ul rămâne de verificat de owner**, și nu se afirmă nimic despre
conținutul lui. Ce trebuie însă înțeles, ca să nu se cațăre pe peretele greșit:

1. **Acum** allowlist-ul nici nu este atins: serverul local nu dă niciun Project ID, deci nu există client
   WalletConnect care să contacteze relay-ul. Un „allowlist greșit" nu poate fi cauza de azi.
2. Când va fi atins, contează **originea paginii podului** (un origin `http(s)://…`), nu id-ul aplicației
   Android și nu schema. `app.nexus.mobile.dev` și `nexusdev://` merg doar în `metadata.redirect.native`
   (`xPortalRedirectScheme`), ca xPortal să poată întoarce cititorul în aplicație.
3. Originea reală de azi este `http://192.168.1.153:5000` (telefonul intră pe LAN: `192.168.1.184`, `okhttp`),
   deci **această** valoare ar trebui să apară în `NEXUS_WC_ATTESTED_ORIGINS` și în allowlist-ul proiectului.
4. Project ID-ul folosit de build este cel pe care serverul îl dă la `/auth/mvx/init` (`wcProjectId`) — nu o
   constantă din aplicație. Deci un singur loc de schimbat: `C:\Nexus\env\jungle.env`.

### 35.9 Al doilea zid, previzibil: contextul sigur al paginii podului

WalletConnect are nevoie de WebCrypto. `http://192.168.1.153:5000` **nu** este context sigur în WebView
(doar `localhost`, `127.0.0.1` și `https` sunt), deci chiar cu Project ID și allowlist corecte, pagina
podului poate eșua la primul apel criptografic. Varianta locală care închide și problema asta este cea pe
care `apiOrigin.ts` o are deja ca ultimă treaptă: `adb reverse tcp:5000 tcp:5000` +
`EXPO_PUBLIC_NEXUS_API_URL=http://localhost:5000`; atunci originea de atestat este `http://localhost:5000`.
Nu s-a dovedit pe telefon (ar cere Project ID real); este scris aici ca pas următor, **nu ca fapt**.

### 35.10 Ce rămâne deschis

1. **Owner:** aprobarea rulării `dev-test-account.mjs --adopt-handle` pe `C:\Nexus\data`, cu o parolă aleasă
   de el (§35.5). Fără ea, loginul pe email rămâne imposibil — previzibil, nu un bug.
2. **Owner:** Project ID-ul din Reown Cloud (proiectul „Jungle Book") + confirmarea allowlist-ului pentru
   originea aleasă, apoi cele trei variabile în `C:\Nexus\env\jungle.env` și repornirea serviciului.
3. **Owner:** verificarea allowlist-ului în dashboard — singurul pas pe care agentul nu îl poate face.
4. **Agent, după 1–2:** login pe telefon (email + xPortal) și captură. Azi ambele sunt **NEVERIFICATE** ca
   reușită pe dispozitiv; eșecul, în schimb, este dovedit (§35.11).
5. **Rămâne din runda 34:** pagina „Mașină", eticheta „Asistat de AI" pe ecran, scrierile sociale pe
   instanța vie, cititorul web fără etichetă de origine (§31.5.6), rândul de sesiune `audit`.
6. **Runda 35 nu a atins** nicio postare, niciun cont, nicio parolă și nicio variabilă din `C:\Nexus\env`.

### 35.11 Dovezi

| dovadă | unde |
| --- | --- |
| telefonul ajunge la backend-ul local și e refuzat | `C:\Nexus\logs\server-2026-10-28.log`: **8×** `POST /auth/email/login 401` și **11×** `GET /auth/mvx/init 503` de la `192.168.1.184 okhttp/4.12.0`; cele trei fișiere ale podului, `200` |
| contul nu există în baza vie | `SELECT * FROM users WHERE lower(email)=?` → gol; 9 conturi, 0 cu email, 0 cu parolă |
| exportul nu are credențiale | `NexusBackups\railway-export-20261027\**` → 0 potriviri de email |
| reparația funcționează | 6 teste noi (`preview-test-account.test.js`) + rularea pe copie (§35.6) |
| suita nu a fost atinsă | web **868/0**, mobil **58 de fișiere/0**, `tsc --noEmit` **0** |

## 36. Autentificarea completă: înscriere, recuperare de parolă, vizibilitatea parolei și xPortal (29 octombrie 2026)

Runda 36 a luat cele trei fluxuri de autentificare cap-coadă — UI → request → server → bază → sesiune — și
le-a reparat pe cele care se puteau repara fără date de la owner. Concluzia scurtă: **două butoane nu chemau
serverul deloc**, iar al treilea era oprit de o **variabilă goală** care anula o configurație completă.

### 36.1 Ce s-a reprodus înainte de orice modificare

| flux | comportament | dovada |
| --- | --- | --- |
| login email + parolă | `401 invalid credentials` | 9 conturi, 0 email, 0 hash (§35.3, recitit în §36.6) |
| „Creează cont" | doar text: „se face momentan în versiunea web" | `app/index.tsx`, `onSignUp={() => setError(...)}` — zero request-uri |
| „Ai uitat parola?" | doar text: „recuperarea se face prin xPortal" | `index.tsx`; serverul: `503` pe `reset-request`, `410` pe `reset-confirm` |
| ochi de parolă | inexistent | `secureTextEntry={secure}` |
| xPortal | `503 WALLETCONNECT_PROJECT_NOT_ATTESTED` | `GET /auth/mvx/init`, §35.7 |

Deci nu era o regresie de UI: erau **două fluxuri neimplementate** și unul **neconfigurat**.

### 36.2 Contractul de cont local (`lib/local-account.js`)

Poarta e o singură funcție, ca să poată fi citită și testată într-un loc:
`NODE_ENV !== "production"` **și** `NEXUS_DEPLOYMENT_MODE === "local"` explicit **și** peer loopback/RFC1918
**și** `NEXUS_LOCAL_ACCOUNTS !== "0"`. Când poarta zice nu, rutele răspund **404**: un deployment public nu
află nici măcar că ele există. `/api/auth-capabilities` spune ce poate serverul, fără niciun secret.

`POST /auth/local/register`: handle `[a-z0-9_]{2,30}`, parolă 8–256 **netrimată**, email opțional; scrypt
(`hashPassword`), 5 personae, sesiune imediată (201, `nexus_session` + `nexus_device_id`). Duplicat de handle
sau de email → **409**. Handle-ul existent **nu** se adoptă: rândul rămâne neatins, iar testul verifică exact
asta pe un rând de tip `@test`. Verificările sunt repetate **în tranzacție**, ca două cereri simultane să nu
poată trece amândouă.

`POST /auth/local/password-reset`: identificator email **sau** `@handle`; rescrie hash-ul, șterge tokenii de
reset, **revocă toate sesiunile** (`deleteSessionsForUser`) și notifică `security`. Cont inexistent → 404.
Cont fără parolă → **409 `ACCOUNT_WITHOUT_PASSWORD`**: o identitate migrată sau un cont wallet-only nu poate
primi parolă dintr-un formular neautentificat, altfel ar fi preluare de cont.

`POST /auth/email/login` acceptă acum și handle-ul (`@test` nu are email), cu aceleași limite de rată și
același `401` pentru „cont inexistent" și „parolă greșită".

### 36.3 Configurația xPortal: placeholder-ul gol anula fișierul complet

`jungle-backend-service.mjs` pasează fișierul de serviciu în `process.env`, iar `server.js` cheamă apoi
`loadEnv()`, care citește `apps/nexus-web/.env`. `loadEnv` sărea peste cheile deja definite — iar
`NEXUS_WC_PROJECT_ID=` (gol, din `tools/local-backend/env.example` prin installer) **era** definită, deci
anula id-ul de 32 de hex din `.env`, împreună cu `NEXUS_WC_PROJECT_ATTESTED=true` și lista de origini.

Regula nouă, într-un singur loc: **o valoare goală înseamnă „neconfigurat"**, deci un fișier ulterior o poate
completa; o valoare nenulă câștigă mereu. Măsurat după repornire:

| origine | înainte | după |
| --- | --- | --- |
| `http://127.0.0.1:5000` | 503 | **200**, `attestation=configured`, `wcProjectId` 32, `chainId=1` |
| `http://192.168.1.153:5000` | 503 | **200**, idem |
| origine neatestată (`:5001`) | 503 | **503**, cu `missing` exact |

Efect secundar, documentat: în dezvoltare, `GOOGLE_CLIENT_ID`/`SECRET` din același `.env` devin active pe
server (`/api/providers` le raportează configurate). Ecranul telefonului ține `googleReady={false}`.

### 36.4 Reown: două Project ID-uri pe același PC

`lib/env.js` publică `PUBLIC_WALLETCONNECT_PROJECT_ID` (folosit **doar** de deployment-urile preview), iar
`apps/nexus-web/.env` are un **alt** id, de 32 de hex. Serverul viu folosește acum al doilea. Dacă
`http://localhost:5000` a fost adăugat în allowlist-ul **celuilalt** proiect, relay-ul va răspunde
`3000 origin not allowed`, iar podul va afișa exact asta (`relay-refused` în `xportal-bridge.js`).
Verificarea allowlist-ului **nu s-a făcut** de aici (fără dashboard autentificat) — rămâne a owner-ului.

### 36.5 Contextul sigur: de ce podul se încarcă de pe localhost

`http://192.168.1.153:5000` **nu** e context sigur, deci `crypto.subtle` lipsește și WalletConnect nu poate
deriva chei. `lib/bridgeOrigin.ts` schimbă **doar** adresa paginii podului: când API-ul e pe LAN în `http:`,
pagina se încarcă de la `http://localhost:5000` (loopback-ul telefonului → `adb reverse tcp:5000`), care e și
context sigur, și originea confirmată de owner. Restul aplicației rămâne pe LAN; tokenul NativeAuth emis la
localhost e acceptat la `/auth/mvx/native` pentru că `isLocalDevelopmentOrigin` acceptă loopback în dezvoltare.
În producție originea e deja `https:`, deci funcția întoarce intrarea neschimbată. Dacă pagina nu se încarcă,
mesajul din foaie spune `adb reverse tcp:5000 tcp:5000`.

### 36.6 Baza vie, verificată înainte și după

Backup înainte de orice: `C:\Nexus\backups\db\2026-10-28-230046-round36-pre-auth` (`VACUUM INTO`,
`integrity_check ok`, 9 conturi / 48 postări / 4 sesiuni, hash SHA-256 în manifest). La final, baza vie
recitită: **9** conturi, **0** email, **0** `password_hash`, **48** postări, **4** sesiuni, aceleași handle-uri
(`test`, `urailwaytest01…06`, `devnet_test_01`, `devnet_test_04`, `wallet4e8gv6`). Runda 36 **nu** a scris în
baza vie: fluxurile s-au dovedit pe o instanță disponsabilă (port 5099, `NEXUS_DATA_DIR` temporar, șters).
### 36.7 Matricea de teste

| cerință | test |
| --- | --- |
| login valid / parolă greșită / cont necunoscut, răspuns identic | `local-account-auth.test.js`: 200 / 401 / 401 + `deepEqual` pe body |
| parola cu spații nu e trimată nicăieri | `loginFields` + login cu parola *fără* spații → 401 |
| ochiul nu atinge textul | `test-login-fields.cjs` (`passwordSubmissionValue` = identitate) |
| înscriere nouă, sesiune, `/api/me` | HTTP E2E **18/18 PASS** |
| duplicat handle / email, confirmare greșită, lungime, handle invalid | 400/409 + `validateLocalAccountDraft` |
| hash real, fără secrete în răspuns | `^[a-f0-9]{32}:[a-f0-9]{128}$`; JSON fără `password`/`hash`/`salt` |
| recuperare: parola nouă merge, cea veche nu, sesiunile vechi mor | 200 / 401 / 401 |
| recuperarea nu există în producție sau de la peer public | 404 + **0** rânduri scrise |
| cont fără parolă nu poate fi preluat | 409 `ACCOUNT_WITHOUT_PASSWORD` |
| xPortal: config lipsă → eroare acționabilă | 503 cu `missing` exact, **0** apeluri de rețea |
| xPortal: origine corectă → init real | 200, `init` cu originea base64url așteptată și block hash injectat |
| xPortal: origine străină | 503 |
| podul cere context sigur | `test-bridge-origin.cjs`: LAN `http:` → localhost, `https:` neschimbat |
| valoarea goală nu mai anulează configurația | test `loadEnv` cu `KEY=""` apoi fișier cu valoare |

Suita: web **879/879**, mobil **57 de grupuri / 0 eșecuri**, `tsc --noEmit` **0**.

### 36.8 Ce rămâne deschis

1. **Telefonul.** `adb devices` gol, `adb mdns services` gol, portul wireless vechi închis → reconectarea cere
   codul de pairing afișat pe telefon (setare a telefonului, interzisă regulilor). **Nicio captură în runda
   36**; fluxurile sunt dovedite pe HTTP, cu headerele clientului, nu pe ecran.
2. **Owner:** allowlist Reown pentru proiectul al cărui id e în `apps/nexus-web/.env` (§36.4).
3. **Owner:** `@test` / `test@nexus.ro` rămâne neatins; aprobarea din §35.5 e încă valabilă.
4. **Push:** commiturile rămân locale până la aprobare.
5. **Rămâne din runda 34:** pagina „Mașină", eticheta „Asistat de AI", scrierile sociale pe instanța vie,
   cititorul web fără etichetă de origine (§31.5.6), rândul de sesiune `audit`.






---

## 37. Email real: înscriere cu adresă, confirmare, resetare de parolă prin link (29 octombrie 2026)

Runda 36 a livrat conturi locale fără email. Runda 37 aduce partea care lipsea cu adevărat: un sistem de
email **real**, cu provider server-side, tokenuri de o singură folosință și linkuri care ajung în
aplicație — plus o cale de dezvoltare (captura locală) care nu pretinde niciodată că a livrat ceva.

### 37.1 Ce era înainte, măsurat

| rută | înainte | acum |
| --- | --- | --- |
| `POST /auth/email/reset-request` | `503` hardcodat („resetarea prin email nu este activă în demo") | `202` identic pentru orice adresă + mesaj real (sau capturat local) |
| `POST /auth/email/reset-confirm` | `410` („flux retras") | schimbă hash-ul, revocă sesiunile, consumă tokenul |
| înscriere cu email | doar `/auth/email/signup`, care cere **dovadă de wallet Ed25519 generat în browser** | `POST /auth/email/register`: email + parolă, fără wallet |
| confirmare de adresă | `/auth/email/verify` exista, dar niciun mesaj nu putea fi trimis | `verification/send` + `verification/confirm` |

### 37.2 Providerul: port mic, zero dependențe

`apps/nexus-web/lib/email/providers.js` are un `send()` per adaptor:

- **Resend** (`POST https://api.resend.com/emails`, bearer, `Idempotency-Key`) — principalul;
- **Brevo** (`POST https://api.brevo.com/v3/smtp/email`, header `api-key`, `htmlContent`/`textContent`) — al
  doilea adaptor real, dovada că providerul e înlocuibil;
- **capture** — scrie JSON în `NEXUS_DATA_DIR/mail-capture`, `delivered:false`, niciodată „livrat".

Niciun SDK nou: `apps/nexus-web` are deliberat zero dependențe runtime, iar ambele API-uri sunt JSON peste
HTTPS. Retry doar pe `408/425/429/5xx` și pe eroare de rețea, cu backoff exponențial și `Retry-After`
respectat (max 5 s); un `4xx` nu se reîncearcă (ar multiplica refuzul). Fiecare încercare lasă o linie
`[email] …` cu provider, eveniment, **domeniul** destinatarului și id-ul mesajului — fără token, fără link
complet, fără parolă, fără cheie.

### 37.3 Configurația: „gol" este „neconfigurat", iar producția refuză

`lib/email/config.js` validează totul într-o funcție pură (`resolveEmailConfig`), deci același răspuns dă
un răspuns, un test și un diagnostic:

- nume de provider necunoscut → **refuz** (`EMAIL_PROVIDER_UNKNOWN`), nu fallback tăcut;
- `resend`/`brevo` fără cheie sau fără expeditor → `EMAIL_API_KEY_MISSING` / `EMAIL_FROM_MISSING`, cu numele
  variabilei în răspuns;
- `capture` în producție → `EMAIL_CAPTURE_IN_PRODUCTION`;
- dezvoltare fără provider → `capture`, cu avertismentul `CAPTURE_FALLBACK` (comportamentul se vede);
- originea linkurilor: `NEXUS_EMAIL_LINK_ORIGIN`, apoi `NEXUS_ORIGIN`, apoi (doar în dezvoltare) originea
  cererii. În producție **`localhost` este refuzat** (`LINK_ORIGIN_INSECURE`), pentru că un astfel de link nu
  funcționează pentru nimeni.

Variabilele sunt citite la fiecare cerere, deci nu e nevoie de repornire după o schimbare de `.env`.

### 37.4 Tokenurile: hash, o singură folosință, expirare, revocare

Tabel nou, aditiv: `email_tokens` (`user_id`, `purpose`, `token_sha256` UNIQUE, `email`, `expires_at`,
`consumed_at`, `created_at`, `requested_ip_hash`). 32 de octeți aleatori; în bază doar `sha256`:

- consum atomic: `UPDATE … SET consumed_at = ? WHERE token_sha256 = ? AND purpose = ? AND consumed_at IS NULL
  AND expires_at > ?` — două click-uri simultane produc o confirmare și un refuz;
- un token nou **revocă** linkurile anterioare de același fel;
- un mesaj care nu a plecat este **șters**, ca să nu pornească un cooldown pentru un link pe care nimeni nu
  l-a primit;
- expirări: 24 h pentru confirmare, 30 min pentru resetare; cooldown de 60 s per cont la retrimitere.


### 37.5 Fluxurile și rutele

| rută | ce face |
| --- | --- |
| `POST /auth/email/register` | creează contul într-o tranzacție, apoi trimite confirmarea. `201` creat, `202` cont existent **neconfirmat** (retrimite linkul, nu creează al doilea rând), `409 EMAIL_TAKEN`/`HANDLE_TAKEN`, `503 EMAIL_NOT_CONFIGURED` (producție fără provider ⇒ nu se creează nimic) |
| `POST /auth/email/verification/send` | `202 {ok,requested}` — **același corp pentru orice adresă**, cu un prag de timp (`NEXUS_EMAIL_RESPONSE_FLOOR_MS`) ca diferența să nu se vadă nici pe cronometru |
| `POST /auth/email/verification/confirm` | `200 {verified,handle}`; `400 EMAIL_TOKEN_INVALID` (invalid/expirat/folosit); `409 EMAIL_TOKEN_STALE` dacă adresa contului s-a schimbat. **Nu** emite sesiune: confirmarea și conectarea sunt pași separați |
| `POST /auth/email/reset-request` | `202` identic pentru cont existent/inexistent; cont fără parolă ⇒ niciun mail (se recuperează prin xPortal), fără să spună asta |
| `POST /auth/email/reset-confirm` | validează parola **înainte** de a consuma tokenul (un refuz nu arde linkul), apoi rescrie hash-ul, revocă toate sesiunile și toate linkurile, trimite mesajul „parola a fost schimbată" (best effort) |
| `GET /api/auth-capabilities` | bloc nou `email` (`configured`, `provider`, `delivery`, `sender`, `link_origin`, `missing`, `warnings`); `registration`/`password_recovery` devin `email` când serverul are provider |
| `GET /api/email/status` | diagnostic pentru operator (provider, expeditor, origine, limite), doar de pe loopback/LAN |
| `GET /api/dev/mail-capture` | cutia poștală locală (`captured_locally`), doar cu gate-ul local **și** captură activă |

Gate-ul rutelor de cont local (`lib/local-account.js`) citește acum același `ctx.env` ca emailul, deci un
test poate descrie un deployment întreg fără să atingă `process.env`.

### 37.6 Linkurile: pagini web + deep link în aplicație

`public/verify-email.html` + `public/verify-email.js` și `public/reset-password.html` +
`public/reset-password.js` (sub CSP-ul existent: script extern, fără inline). Ambele scot tokenul din bara
de adrese imediat (`history.replaceState`), îl trimit într-un `POST`, arată propoziția serverului și oferă un
link nou dacă a expirat. Pe Android oferă și `nexusdev://verify?token=…` / `nexusdev://reset-password?token=…`
— schema declarată în `app.json`.

Pe telefon: `src/app/verify.tsx` și `src/app/reset-password.tsx` (expo-router), `src/lib/emailAuth.ts` (pur:
`emailDeepLink`, `readEmailToken`, `emailRouteFromUrl`, `validateEmailRegistrationDraft`,
`validateNewPassword`), plus `session.ts` cu cele cinci apeluri. Aplicația nu cheamă niciun provider: cheia
trăiește doar pe server. Ecranul de login alege fluxul după `/api/auth-capabilities` (`registration: "email"`
⇒ înscriere cu adresă și mesaj „verifică emailul"; `password_recovery: "email"` ⇒ foaia cere adresa și
trimite linkul).

### 37.7 Testele

- web: **894/894** (`node --test test/*.test.js`), din care **15 noi** în `test/email-delivery.test.js`
  (configurație, linkuri, template-uri, înscriere fără parolă în clar, token refolosit/expirat, rate limit,
  privacy pe reset, reset complet cu revocare de sesiuni, refuz în producție, provider căzut + retry fără
  duplicat, 429 apoi succes, captură locală + inbox local-only, capabilități, adaptoare).
- `test/core.test.js` a fost actualizat deliberat: `reset-request` `503 → 202`, `reset-confirm` `410 → 400`
  pentru un token fals, cu parola dovedită neatinsă.
- mobil: **61 scripturi, 0 eșecuri** (60 existente + `scripts/test-email-auth.cjs`), `tsc --noEmit` curat.
- HTTP real: `npm run test:email-http` → **22/22** pe o instanță de unică folosință (port 5099, director
  temporar, șters la final): înscriere → mesaj capturat → confirmare (și refuzul celei de-a doua) → login →
  cerere de resetare (și răspuns identic pentru o adresă inexistentă) → resetare (și refuzul replay-ului) →
  parola veche `401`, cea nouă `200` → mesajul de schimbare, fără link. Niciun token în răspunsuri sau log.

### 37.8 Baza vie: migrarea dovedită pe o copie

`VACUUM INTO` dintr-o conexiune **read-only** la `C:\Nexus\data\nexus.sqlite`, apoi `openDb()` pe copie:
`users 9 → 9`, `posts 48 → 48`, `sessions 4 → 4`, `personas 12 → 12`, iar tabela `email_tokens` apare cu cele
două indexuri. Fișierul viu nu a fost scris; copia a fost ștearsă. Conturile owner-ului rămân exact cum erau.

### 37.9 Ce rămâne deschis

1. **Domeniu + cont la provider** (owner): codul e gata, dar `NEXUS_EMAIL_PROVIDER`, `_API_KEY`, `_FROM` și
   `_LINK_ORIGIN` nu sunt setate, deci nu există expeditor verificat. `nexus.ro` nu are DNS (verificat).
2. **Înregistrările DNS** le publică providerul în dashboard; `node tools/email/check-dns.mjs --domain …`
   confirmă ce răspunde DNS-ul real (SPF/DKIM/DMARC). Nimic nu a fost inventat.
3. **Repornirea serviciului viu** (`stop-backend.ps1` + `start-backend.ps1`) aplică migrarea aditivă și
   activează rutele noi; până atunci `:5000` rulează codul rundei 36.
4. **Test pe telefon** (owner): `adb reverse tcp:5000 tcp:5000`, apoi linkul din captura locală
   (`GET /api/dev/mail-capture`) sau, cu provider, mesajul real.
5. Livrarea reală a unui email rămâne **NOT VERIFIED** până la pașii 1–2.

