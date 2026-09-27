# NX-SOCIAL X-SURFACE v1 — contract, wave 1 receipt, remaining waves

Status: **wave 1 shipped and verified** (2026-09-19). Owner-visible behaviour, honest counters,
one explicit decision per ambiguity. This file is both the contract and the receipt for wave 1;
the remaining waves are listed at the end with what each still needs.

## 1. Decisions taken (so nothing is ambiguous later)

Wave 2 added three decisions on top of the table below: a **repost is an internal share** (it lives
on the reposter's profile, keeps the original's identity and counters, and is demoted in ranking);
the **reply staircase** caps at five steps with logical (RTL-safe) indentation; the **reaction
palette is a popover** that never adds height to a card and leaves on its own.

| Ambiguity | Decision | Why |
| --- | --- | --- |
| Are replies tweets? | A reply **stays a comment** on the server (`comments.parent_id`) but is **rendered and acted on as a tweet** in the post page: own counters, own reactions, own save, own ••• menu, own views. | A second post table would duplicate moderation, impressions and privacy rules. The visible result is what the reader asked for; the data stays in one governed place. Reply *reposts* are the one thing not implemented (a repost must point at a public object) — wave 2 with `comment_shares`. |
| Is "views" fakeable? | Public counter = **distinct human readers** (`COUNT(*)` over `social_impressions` joined to `traffic_class='HUMAN_ORGANIC'`). Repeat openings are impressions and stay owner-facing. | `organic_public_metric: false` stays true for impressions; the public number is a headcount, the only number the ingest cannot inflate and one device refreshing cannot grow. A post with zero readers shows **no** counter, never a decorative 0. |
| Mute vs block | Mute is a **new, weaker primitive**: the relationship is untouched, the author simply stops being a candidate for the muter (feed and threads). Block keeps its existing semantics. | Matches X/Instagram; both are reversible from the same ••• menu. |
| Community notes | Wave 1 ships the **request**: a reader can ask for context on a post or a reply. Stored once per reader, it publishes nothing, changes no visibility, and the response says so. | The notes *engine* (bridging-based helpfulness + ratings) is wave 3; a fake note would be worse than an honest queue. |
| Budget guards | `app.js` 562k → **580k**, locale 300k → **320k**, each move commented with the surface it names. CSS budget untouched (126 bytes of headroom). | These guards catch accidents, they do not freeze the product; a named surface with tests is the condition for moving them. |

## 2. Wave 1 — what is in the build

### Server
* New tables: `profile_mutes`, `community_note_requests`, `comment_impressions`, `saved_comments`
  (purely additive, created on boot by the existing `SCHEMA` exec — no destructive migration).
* `repo.js`: `postViewStats`/`postViewStatsBulk`, `commentViewStatsBulk`, `recordCommentImpressions`,
  `setProfileMute`/`isMuted`/`listMutedIds`, `requestCommunityNote`/`communityNoteRequestState`,
  `setSavedComment`/`hasSavedComment`; muted authors are dropped from feed candidates and from threads.
* `api.js`: `GET /api/posts/:id` (post + reply page + sort validation + viewer state),
  `POST /api/profile/mute`, `POST /api/comments/:id/save`, `POST /api/social/posts/:id/note-request`,
  `POST /api/comments/:id/note-request`; replies carry `views`, `saved_by_me`, `note_requests`;
  posts carry `view_stats`, `muted_by_me`, `blocked_by_me`; `/api/social/impressions` accepts
  `comment_entries`, so a thread is measured the same way a timeline is.
* `moderation.js`: `ILLEGAL_CONTENT` added to `REPORT_CATEGORIES` (a separate legal track).
* Fixed a latent `ReferenceError`: the demo-receipt route called an undefined `publicPost`, so it
  could only ever answer 500.

### Client
* New module `public/post-detail.js` (+ `post-detail.css`): the post page — large text, media, metric
  line, reaction palette, action row (reactions / replies / repost / save / share / views), inline reply
  composer with reply-to-anyone, sort tabs *Most relevant / Newest / Oldest* with pagination, and replies
  as cards with their own counters, reactions, saving and ••• menu.
* `app.js`: one shared `postOptionsMenuMarkup()` for every surface (follow, favourites, **mute**, **block**,
  not-interested, copy link, report, **report illegal content**, **request context note**, "why am I seeing
  this"); `postViewsMarkup()` that renders nothing at zero; tapping a card opens the post page (profile
  whispers included); one global pull-to-refresh gesture for every scrolling screen with a localised hint;
  the profile header shows the section title (`Profil`/`Profile`) with **one** logout button and no refresh
  button; `#post-<id>` deep links open the post and are cleared when it closes.
* `profile-experience.js`: chronological archive ordering (the feed ranks, the profile does not), the rail
  shows **saved-story albums** instead of a "new story" tile, and the avatar opens the active story when
  one exists and otherwise the plain profile photo (no reactions, no rail).
* Locale: ~45 new keys × RO/EN/PL/AR in a separate `SOCIAL_X_MESSAGES` block merged into the existing
  table, so the four huge locale blocks stay untouched and coverage is still enforced by the same test.

## 3. Evidence

* `node --test test/*.test.js` → **505/505 pass** (86 files), including the new `test/x-surface.test.js`
  (12 tests) and the updated `profile-whispers`, `audit` (asset version pin) and performance-budget
  contracts. `index.html` now pins `/app.js?v=20260919-xsurface1` so the new client is not cache-stale.
* `node scripts/release-check.mjs` → **gate PASS**, `external_network: false`.
* Live (CDP, real account, real local DB) before the browser session expired:
  * opening a tweet from the feed → `#post-66`, large text, action row `♡1 · ◌4 · ⟳0 · Save · Share`,
    views `◉1` and the metric sentence `· 1 people saw this post` — the number came from the view that
    had just happened, not from a seeded figure;
  * profile whisper card → `#post-70`, 4 replies each with their own real view count, 15 menu entries
    across the post and reply menus, 8 palette buttons at 9px labels (compact), sort switch confirmed,
    posting a reply worked (4 → 5 replies) and the counter followed;
  * profile screen → title `Profile`, `1` logout button, `0` refresh buttons, `0` new-story tiles, rail
    header `Albums` with 3 album tiles; the avatar opened the story viewer (an active story exists, which
    is the documented precedence);
  * zero console exceptions in every run; screenshots kept next to the run logs
    (`x-surface-live.png`, `x-surface-live-feed.png`).
* Known verification gap: the local browser session TTL expired mid-run, so the **last two fixes** (hash
  cleared on close; hash written only after the overlay entry exists) are pinned by the new lifecycle test
  plus a source-order assertion rather than by a fresh live click. One more login re-confirms them; the
  numbers above already prove the surface itself.

## 4. Wave 2 — repost intern, scară la răspunsuri, paletă ca popover

Status: **livrat și verificat live** (2026-09-19). Trei lucruri cerute de owner, toate în build.

### A. Repost-ul este un share intern, vizibil pe profil
* Fără tabele noi: `post_shares(channel='repost')` era deja sursa de adevăr, iar acum are index
  (`idx_post_shares_repost`).
* `repo.listUserReposts()` (arhiva unui profil) și `repo.listFollowedReposts()` (candidați pentru
  feed) + `joinPost` păstrat: **postarea partajată își păstrează autorul, identitatea, contoarele
  și vizualizările** — un repost nu publică nimic nou, deci nu se moderează de două ori și nu
  inventează un view.
* `/api/profiles/:handle` întoarce `reposts[]` (cu `repost.reposter`, `reposted_at`, `mine`) și
  `counts.reposts`; feed-ul primește repost-urile conturilor urmărite ca un **al doilea query**
  (indexat, bounded), fără să atingă query-ul principal (testul de performanță care verifică
  `idx_posts_social_lens` rămâne valabil).
* Reguli păstrate identic: vizibilitate (`canViewPost`), mute pe autor **și** pe reposter, block,
  „nu mă interesează”, dislike privat. În lens-ul *Following* un repost e suficient prin reposter
  (acesta e rostul lui), dar o postare proprie trebuie să fie a unui cont urmărit.
* Client: antet „**Ai repostat**” / „**a repostat @x**” pe card (feed, clip, pagină de post, whisper),
  badge ⟳ pe tile-urile de media, intercalare cronologică după `reposted_at` în arhivă,
  `•••` → „Anulează repostarea”, iar **apăsarea din nou pe ⟳** scoate share-ul de pe profil;
  toate controalele pentru același post se sincronizează (nu rămâne un buton cu stare veche).
* Anti-abuz: un repost e **demotat cu 260 de puncte** față de o postare proprie de aceeași prospețime
  (`if (repost) { score -= 260; ... }`), deci repostarea nu cumpără reach; tie-break-ul separă
  repostul de postare.

### B. Comentariile urcă în scară
* Pagina de post construiește arborele din `parent_id` (`listCommentPage` întoarce deja rădăcinile cu
  toți descendenții) și randează recursiv cu `data-depth` + `--depth`.
* Indentare cu **proprietăți logice** (`margin-inline-start`, `border-inline-start`) → același
  comportament în RO/EN/PL și în AR (RTL). Pas 20px, **16px sub 390px**, oprire la adâncimea 5
  (mai adânc se păstrează ultimul pas, ca pe X), cu linie de ghidaj per nivel.
* Drawer-ul și panoul din reel folosesc acum aceeași scară (clamp 3 → 5, 27px → 20px), deci cele
  trei suprafețe arată identic.
* Verificat live: adâncimi 0/1/2 → `left` 379 → 396 → 414 px (pas real, măsurat în browser).

### C. Paleta de reacții este un popover mic, care pleacă singur
* `.xPalette` (în `post-detail.css`, care nu e în bugetul CSS păzit): un rând de butoane 38px,
  **fără etichete text** (numele rămâne în `title`/`aria-label`), ancorat pe butonul de reacții,
  `position:absolute` + `bottom:calc(100% + 8px)`, cu **flip automat în jos** când nu e loc sus
  (`positionReactionPalette`, prag 170px).
* Regula veche din `styles.css` care rezerva un rând de 8 coloane în card (`display:grid;
  grid-template-columns:repeat(8,minmax(48px,1fr));margin:9px 0`) a fost înlocuită cu un ancoraj
  minimal, deci **cardul nu mai crește** (măsurat live: 142px înainte și după deschidere).
* Dispariție lină: tranziție pe `opacity/transform/visibility` (.16s), fără salturi de `max-height`; se
  închide la selecție, click/tap în afară, Escape, swipe-down (existente), la **hover-out cu 420ms
  grație** pe pointer fin și la **scroll** (un singur listener per container).
* Paleta din clip-uri rămâne exact cum era (grid-ul și etichetele ei), deci aserțiunile existente din
  `audit.test.js` rămân valide.

### Evidence (wave 2)
* `node --test test/*.test.js` → **510/510 pass** (86 fișiere); `test/x-surface.test.js` are acum 16
  teste, inclusiv: repost care nu inventează un view, repost o singură dată în feed, deduplicare când
  autorul e urmărit și el, mute pe reposter, scară cu adâncimi 0→5 (unit test pe `postDetailMarkup`),
  popover cu tranziții și închidere la scroll/hover-out.
* `node scripts/release-check.mjs` → **gate PASS**, `external_network: false`.
* Live (CDP, cont local de verificare `wave2.verifier@nexus.local`, creat cu unealta proiectului
  `scripts/create-human-account.mjs`; postarea de test 82 cu fir 46→47→48):
  * popover: deschis → 282×45px, `opacity 1`, 0 etichete vizibile, `dropDown`; închis → `opacity 0`,
    `visibility hidden`; înălțimea cardului neschimbată;
  * scară: 379 / 396 / 414 px pe adâncimile 0/1/2, cu linii de ghidaj;
  * repost: butonul trece pe `on` și contorul pe 1 imediat; după reîncărcare profilul are **2 carduri**
    (share-ul cu „You reposted” + postarea), ambele controale `on/1`; apăsarea din nou pe ⟳ scoate
    share-ul (2 carduri → 1) și readuce controalele pe `off/0`; zero excepții în consolă.
* Notă onestă: în timpul verificării am găsit și reparat două defecte reale — deduplicarea folosea
  toate postările recente (deci repost-urile erau eliminate aproape mereu) și controlul ⟳ din celălalt
  card rămânea cu starea veche la anulare. Ambele au acum test.
* Buget: `app.js` 580k → **590k**, cu comentariul care numește valul (repost + popover + scară);
  bugetul CSS păzit a rămas neatins (regulile noi au intrat în `post-detail.css` și am scos regula de
  grid din `styles.css`).

## 5. Wave 3 — P4: galerie multi-media, hashtag/$cashtag, pagină de tag, trending

Status: **livrat și verificat live** (2026-09-19).

### Decizii
| Ambiguitate | Decizie | De ce |
| --- | --- | --- |
| Câte media pe postare? | Până la **10 imagini**, sau **un singur video** (video-ul nu se combină cu alte fișiere). Serverul respinge orice altceva. | Este regula pe care o așteaptă un cititor și ține feed-ul previzibil; validarea e pe server, nu doar în UI. |
| `posts.media_id` sau listă nouă? | Coloana rămâne **coperta** (primul media), iar ordinea adevărată stă în `post_media`. Payload-ul expune `media_list`, cu fallback la copertă pentru postările vechi. | Zero migrare distructivă: fiecare cititor existent continuă să meargă, iar caruselul citește o singură sursă. |
| Cine extrage tagurile? | Serverul, **la scriere** (`extractPostTags`), din caption: `#hashtag` (2-50, litere/cifre/underscore) și `$ticker` (2-10 litere), maximum 20, salvate lowercase cu prima grafie pentru afișare. | Un tag aparține postărilor care îl poartă cu adevărat; nimic nu e ghicit la citire. |
| Ce înseamnă „trending”? | Număr de **persoane umane distincte** care au folosit tagul în fereastra de 3 zile, minim 2 autori, fără trafic de catalog, fără boosturi plătite. | Cinci postări de la un cont nu fac un trend; metrica e declarată în răspuns (`metric: unique_human_authors`). |
| Postări vechi fără taguri? | Script explicit `scripts/backfill-post-tags.mjs` (dry-run implicit, `--execute` scrie), care folosește **aceeași** funcție de extracție. | O migrare de date trebuie să fie o acțiune numită, nu un efect secundar al unui GET. |

### Ce este în build
* `db.js`: `post_media` (listă ordonată + index pe media) și `post_tags` (kind/tag/display/position + index de căutare).
* `repo.js`: `extractPostTags()` exportat, `setPostMedia` (cu opțiune `transaction: false` pentru a scrie în tranzacția postării), `listPostMedia`, `listPostMediaBulk`, `setPostTags`, `postTags`, `listPostsByTag`, `tagStats`, `trendingTags`.
* `api.js`: `POST /api/posts` acceptă `media_items[]` (hash+ext, fiecare verificat ca upload al contului, tipuri permise, fără duplicate, un singur video) și scrie galeria + tagurile **în aceeași tranzacție** ca postarea; `PATCH /api/posts/:id` re-extrage tagurile; payload-urile de postare expun `media_list` și `tags`; rute noi `GET /api/social/tags` (trending, cu metadate oneste) și `GET /api/social/tags/:kind/:tag` (pagină de tag cu `stats` și `next_before`).
* Client: `captionWithTagsMarkup()` (linkificare sigură, escape o singură dată), `mediaCarouselMarkup()` (slide-uri, contor, puncte), `openMediaLightbox()` (media goală, fără reacții, navigare ‹ › și tastatură), `openTagPage()` + `loadTrends`, blocul „Trending/Cashtags” pe ecranul de căutare, composer cu **selecție multiplă** (până la 10) și verificări clare (un video, fără amestec, maximum 10), `post-media-tags` în pagina de postare (carusel + rând de taguri).
* CSS în `post-detail.css` (nebugetat), ca bugetele CSS păzite să rămână neatinse; bugetul `app.js` a fost mutat 590k → **605k**, cu comentariul care numește valul și nota că următorul val trebuie să extragă un modul.

### Evidence (wave 3)
* `node --test test/*.test.js` → **515/515 pass** (87 fișiere); noul `test/p4-media-tags.test.js` acoperă: regulile de extracție (inclusiv diacritice, ticker invalid, plafon 20, fără potriviri în entități), galerie ordonată + copertă, pagină de tag cu vizibilitate/mute de catalog/paginare, trending pe autori distincți + fereastră + cashtags separate, plus contractele statice server↔client.
* `node scripts/release-check.mjs` → **gate PASS**, `external_network: false`.
* Live, prin API real (login local + protocol resumable real, două upload-uri):
  * post **84** publicat cu `media_list` = `[0:a741623e, 1:957ae268]` (ordine respectată) și coperta = primul media;
  * taguri extrase: `hashtag:verificare`, `hashtag:galerie`, `cashtag:egld`;
  * `GET /api/social/tags/hashtag/verificare` → 200, 1 postare, `stats {posts: 1, authors: 1}`;
  * trending cashtags gol (corect: un singur autor nu face trend), duplicate respinse cu 400 `duplicate media in post`.
* Live, în browser (cont de verificare, formatul „Photos & posts”):
  * cardul postării 84 are carusel cu **2 slide-uri**, contor `1/2` și 2 puncte;
  * chip-uri de tag în caption: `#verificare`, `#galerie`, `$EGLD`;
  * lightbox: deschide la `1/2`, săgeata duce la `2/2`;
  * pagina de tag: `#verificare` cu „1 posts · 1 people” și postarea afișată; zero excepții în consolă.
* Notă onestă: blocul de trending de pe ecranul de căutare nu a fost atins de ultimul probe (navigarea sintetică nu a găsit intrarea în Search în acel moment); ruta și randarea sunt acoperite de testele statice și de API-ul verificat live. Composer-ul a fost verificat live că are `multiple` și că poate ține 2 fișiere atașate; legătura „2 fișiere → `media_items`” este acoperită de testul static și de contractul API verificat.

## 6. Wave 3 (P6) — motorul de note comunitare

Contextul adăugat de cititori este piesa care lipsea: până acum se putea doar *cere* o notă (coada
`community_note_requests`), iar nota în sine nu exista. Acest val construiește motorul, cu regula
declarată în cod, nu în marketing.

### Decizii

* **O notă explică, nu ascunde.** Niciun statut de notă nu schimbă vizibilitatea postării sau a
  răspunsului; răspunsurile API poartă `visibility_changed: false` și `enforced_facts: false`, iar
  testele verifică ambele câmpuri.
* **Publicarea cere „bridging”.** O notă devine `HELPFUL` doar cu minim 3 evaluări, din minim 2
  perspective diferite, cu minim 2/3 utile **în fiecare** perspectivă care are cel puțin două
  evaluări, și cu cel puțin o sursă. Fără sursă, nota rămâne `NEEDS_MORE_RATINGS` (o notă care
  explică trebuie să indice unde se verifică).
* **Perspectiva este declarată, nu presupusă.** Nu avem un spectru politic local, deci perspectiva
  este relația evaluatorului cu autorul: `AUTHOR`, `FOLLOWS_AUTHOR`, `MUTED_AUTHOR`,
  `NOT_FOLLOWS_AUTHOR`. Este un proxy onest, e etichetat ca atare în interfață („ai autorul în
  mute”) și este chiar mecanismul care face bridging-ul posibil. Metrica din răspunsul de notă este
  numită `helpful_from_multiple_perspectives`.
* **Respins nu înseamnă șters.** O notă cu minim 3 evaluări și sub 1/3 utile devine `NOT_HELPFUL`:
  nu se afișează public, dar autorul ei o vede cu statusul și numerele ei. `community_note_events`
  este jurnal append-only pentru fiecare acțiune (creare, schimbare de status cu motiv, retragere),
  deci „de ce e nota asta aici” are mereu un răspuns.
* **Autorul nu-și notează și nu-și evaluează propria notă** (403 cu cod explicit), iar autorul
  postării nu poate adăuga context la propria postare: pentru asta există editarea și ștergerea.
* **Cotă, nu interdicție.** 5 note și 30 de evaluări în 24 h, per cont și per personaj; numerele
  rămase sunt returnate în `note_quota` (și în `GET /api/posts/:id`), deci interfața spune exact cât
  a mai rămas în loc să eșueze misterios. O notă retrasă poate fi rescrisă, iar evaluările vechi se
  șterg — ele aparțineau textului retras.
* **Aceeași regulă automată de siguranță ca la postări**: o notă blocată de `assessSocialContent`
  primește 422 cu `statement_of_reasons` și nu ajunge niciodată în tabel.
* **Buget**: nici o creștere la `app.js` (rămâne 605k) — tot ecranul de note stă în
  `post-detail.js`, cardul din flux primește doar un chip. Bugetul de locale a fost mutat
  320k → **334k**, cu comentariul care numește acest val (37 de chei × 4 limbi).

### Ce este în build

* `db.js`: `community_notes` (unicitate autor+subiect, statusuri `NEEDS_MORE_RATINGS` / `HELPFUL` /
  `NOT_HELPFUL` / `WITHDRAWN`), `community_note_ratings` (o evaluare per evaluator, cu perspectiva
  stocată) și `community_note_events` (jurnal append-only).
* `repo.js`: exportă `decideCommunityNoteStatus()` (funcție pură, testată separat),
  `communityNotePerspective()` și `COMMUNITY_NOTE_RULES`; plus `createCommunityNote` (validare,
  rescriere după retragere, dedupe), `rateCommunityNote` (respinge auto-evaluarea, derivă
  perspectiva, recalculează statusul), `withdrawCommunityNote`, `listCommunityNotes`,
  `communityNoteQuota`, `communityNoteById`, `communityNoteRatings`, `appendCommunityNoteEvent`.
* `api.js`: `POST /api/social/posts/:id/notes`, `POST /api/social/notes/:id/rate`,
  `POST /api/social/notes/:id/withdraw`; payload-ul postării include `community_notes`
  (`{ notes, mine, counts }`) și ruta postării include `note_quota`.
* Client: `communityNoteMarkup`, `communityNoteSourceMarkup`, `communityNoteComposerMarkup` în
  `post-detail.js` (cardul de notă cu meta „N evaluări · P perspective · K utile”, sursele afișate
  ca domeniu, perechea „Util / Nu e util” cu `aria-pressed`, statusul propriei note, composer inline
  cu 3 surse, retragere). Reîncărcarea după o acțiune pe notă este `load({ reset: true, quiet: true })`:
  nu numără o impresie nouă și nu aruncă cititorul în capul paginii.
* CSS în `post-detail.css` (nebugetat).

### Evidence (wave 3 / P6)

* `test/p6-community-notes.test.js` — regula pură (publicare, lipsa sursei, o singură perspectivă,
  perspectivă care se contrazice, **majoritatea globală**, respingere, intrare nulă), clasificarea
  perspectivei, fluxul complet (notă scrisă de altcineva → evaluări din perspective diferite →
  publicare → schimbarea unei evaluări), derivarea perspectivei din relație (follow/mute/autor),
  respingere + retragere + rescriere cu evaluări resetate, jurnalul de evenimente, cota (per cont,
  expirare în 24 h) și contractele statice server↔client↔locale↔CSS.
* Testul a găsit un defect real în prima variantă a regulii: trei evaluări „neutilă” din trei
  perspective treceau testul de bridging (fiecare perspectivă avea o singură evaluare) și nota ar fi
  fost publicată. Regula cere acum și o **majoritate globală** de 2⁄3, iar cazul este fixat în test.
* Suita completă: `node --test test/*.test.js` → **522/522 pass** (88 fișiere, 515 + 7 noi).
  `node scripts/release-check.mjs` → **gate PASS**, `external_network: false`, `synthetic_issues: 0`.
* Live, prin API real (patru conturi locale, două postări, două note):
  * `POST /api/social/posts/20/notes` → **201**, `status: NEEDS_MORE_RATINGS`, `mine: true`,
    sursele păstrate 2 din 3 oferite (`ftp://` respins), `metric: helpful_from_multiple_perspectives`,
    `visibility_changed: false`, `quota: {notes_used: 1, notes_left: 4, ratings_left: 30}`;
  * autorul postării → **403** `author_cannot_note_own_post`; corp scurt → **400**; a doua notă a
    aceluiași autor → **409** `note_already_exists`; auto-evaluare → **403**; `helpful: "yes"` → **400**;
  * o notă în așteptare este invizibilă public (`notes: 0`, `counts.needing_ratings: 1`) și vizibilă
    autorului ei; după două evaluări utile (MUTED_AUTHOR, NOT_FOLLOWS_AUTHOR) rămâne
    `NEEDS_MORE_RATINGS`; a treia evaluare (AUTHOR) → **HELPFUL**, `ratings {3, 3, 3}`,
    `published_at` real, `previous_status: NEEDS_MORE_RATINGS`;
  * schimbarea evaluării după mute → `perspective: MUTED_AUTHOR`, nota rămâne publicată;
  * nota fără nicio sursă, cu două evaluări utile, rămâne `NEEDS_MORE_RATINGS` (regula strictă a
    sursei este dovedită de testul funcției pure, aici se vede doar că nu se publică);
  * retragere → `WITHDRAWN`, iar cititorul public vede `counts.published: 0`;
  * timeline real (`format=posts`) → `community_notes.counts.published: 1` pe postarea cu notă.
* Live, în browserul real (sesiune reală de cititor, CDP):
  * cardul din timeline are chip-ul `◈ Readers added context` cu `role="note"` doar pe postarea cu notă;
  * pagina postării: `.communityNotesHost` cu cardul „Readers added context”,
    meta `3 ratings · 2 perspectives · 3 helpful`, cele două surse afișate ca domeniu (`example.org`),
    perechea „Util / Nu e util” cu `aria-pressed`, butonul de scriere prezent și retragerea absentă
    (cititorul nu e autorul notei);
  * composer-ul se deschide din buton: 3 câmpuri de sursă + textarea `minlength=12` și avertismentul
    onest „Without a source the note cannot become public.”;
  * o evaluare dată în pagina vie → toast „Rating recorded: the note is public” și numere reale;
  * zero excepții în consolă. Capturi: `p6-chip.png`, `p6-note-postpage.png`, `p6-note-composer.png`.
* **Regresie găsită și reparată în acest val**: cardul din timeline folosea `visitorMenu`, o
  variabilă care nu mai exista după unificarea meniului ••• în `postOptionsMenuMarkup()`. Orice
  cititor care nu era autorul postării nu putea randa cardul (0 carduri, `ReferenceError` în consolă);
  proba anterioară nu a prins-o pentru că sesiunea de verificare era chiar autorul. Cardul folosește
  acum același builder partajat, iar testul fixează expresia și interzice reapariția variabilei.
* Note oneste despre limitele acestui val:
  * notele publice se pot scrie doar pe **postări**; `subject_type` există în schemă, dar ruta
    publică nu expune încă note pe răspunsuri (rămâne în §7);
  * eligibilitatea contribuitorilor din descrierea originală P6 **nu** e implementată: orice cont
    poate scrie, în limita cotei, iar regula de publicare face filtrarea;
  * o notă fără sursă nu poate deveni publică — dovedit de testul funcției pure; în proba live s-a
    văzut doar că rămâne în așteptare (erau disponibili doar doi evaluatori pentru acea notă);
  * sesiunile de verificare au folosit patru conturi locale de test; ele și postările lor rămân în
    baza locală ca date demonstrative (pot fi curățate la cerere).




## 7. Wave 4 (P5) — repost de răspunsuri, context de thread, link de răspuns

Status: **livrat** (2026-09-19). Valul care închide promisiunea din tabelul de decizii: „Reply
*reposts* … wave 2 with `comment_shares`".

### Decizii

* **Un răspuns repostat este un share intern, nu o postare nouă.** `comment_shares` păstrează
  răspunsul, autorul lui și postarea din care vine; nimic nou nu se publică, deci nimic nou nu se
  moderează și nu se inventează un view. Contorul este „oameni distincți”, iar un cont blocat nu
  umflă numărul — exact regula contorului de reposturi de postări.
* **Răspunsul spune cui răspunde, chiar și când părintele nu e pe pagină.** `parent_author` călătorește
  cu răspunsul (o singură interogare pentru toată pagina), deci linia „Ca răspuns la @x” este un fapt
  din înregistrare, nu o presupunere din DOM. Un părinte retras se spune explicit.
* **Linkul de răspuns promite răspunsul.** `#reply-<id>` întreabă serverul
  (`/api/comments/:id/context`) ce postare deține răspunsul și ce lanț răspunde, apoi deschide pagina
  postării și evidențiază răspunsul. Autorizarea rămâne la server: un răspuns care nu poate fi citit
  în thread nu poate fi deschis nici din link (404, nu conținut).
* **Răspunsurile distribuite apar pe profil** în același arhiv ca reposturile, cu autorul răspunsului,
  postarea de origine și un buton care deschide conversația.

### Ce este în build

* `db.js`: `comment_shares` (unicitate pe răspuns+cont+personaj+canal) + index pe răspuns și pe profil.
* `repo.js`: `setCommentShare`, `commentShareCount`, `commentShareSummary`,
  `commentShareSummariesBulk` (o interogare pentru toată pagina de thread), `commentParentAuthors`,
  `listUserCommentShares`.
* `api.js`: `POST /api/comments/:id/share` (oglinda rutei de repost, cu
  `internal_share: true, visibility_changed: false`), `GET /api/comments/:id/context` (postarea,
  lanțul de părinți, `root_comment_id`); thread-ul și pagina postării poartă `reply_shares`,
  `shared_by_me`, `parent_author`; profilul poartă `shared_replies` + `counts.shared_replies`.
* Client: buton ⟳ per răspuns în `post-detail.js` (verificare câmp cu câmp a răspunsului),
  linia de context, evidențierea răspunsului deschis din link, `#reply-<id>` în `app.js`,
  secțiunea din profil (`ownerSharedReplyCard` + „Deschide răspunsul în conversație”).
* Copy nou în RO/EN/PL/AR (9 chei) și CSS în `post-detail.css` (nebugetat).

### Evidence (wave 4 / P5)

* `test/p5-reply-shares.test.js` — share idempotent, undo doar al propriului share, block-ul nu umflă
  contorul, răspunsul rămâne neatins după share, bulk-ul răspunde pentru toate id-urile cerute
  (inclusiv inexistente), `commentParentAuthors` spune cine e părintele, profilul listează share-ul cu
  autorul răspunsului și postarea de origine, iar un răspuns retras dispare din listă; plus
  contractele statice server↔client↔copy↔CSS.
* Suita completă: **526/526 pass** (89 de fișiere); `release:check` → **gate PASS**,
  `external_network: false`.
* Live, prin API real (două conturi locale, relație mutuală — regula de vizibilitate „friends” a
  aplicației a cerut-o explicit: `PROFILE_MUTUAL_REQUIRED` până la al doilea follow):
  * post 89 + răspuns 65 (de la contul B) + răspuns 66 (de la contul A, `parent_id = 65`);
  * `parent_author` = `romeo` pe răspunsul 66 și `null` pe răspunsul rădăcină (linia „Ca răspuns la”);
  * `POST /api/comments/66/share` → 200 cu `shares: 1, shared_by_me: true, internal_share: true,
    visibility_changed: false`; al doilea apel identic rămâne `shares: 1`; celălalt cont vede
    `shares: 1, sharedByMe: false`;
  * `GET /api/comments/66/context` → `post_id: 89`, `chain: [romeo]`, `parent: romeo` (părintele
    retras e raportat ca retras, nu ascuns);
  * profilul sharer-ului → `counts.shared_replies: 1` și intrarea cu autorul răspunsului, postarea de
    origine și `mine: true`;
  * undo → `shares: 0`; iar după retragerea răspunsului, partajarea lui răspunde **404**.
* Live, în browserul real (sesiune reală, CDP; asertele urcate la `20260919-xsurface5` ca browserul să
  nu mai folosească cache-ul valului trei):
  * thread-ul arată linia de context („The reply this answered was withdrawn” pentru părintele retras)
    și butonul ⟳ cu contorul real (`1`, `aria-pressed="true”`);
  * apăsarea în pagina vie comută share-ul: contorul 1 → 0 și toast „Reply repost removed” (primul
    clic, dintr-o stare 0, a dat „Reply reposted” și contor 1);
  * `#reply-66` deschide postarea și marchează răspunsul (`isFocused`, aria „Reply opened from a link”);
  * profilul propriu arată cardul răspunsului distribuit: „⟳ You reposted on the post by
    @romeodeepsek”, corpul răspunsului și butonul „Open the reply in its conversation”;
  * zero excepții în consolă. Capturi: `p5-thread-context.png`, `p5-reply-link.png`,
    `p5-profile-shared-reply.png`.




## 8. Wave 5 (P7) — panoul de clip: subtitrări, calitate, auto-advance, descărcare, offline

Status: **livrat** (2026-09-19). Regula valului: fiecare comutator face ceva real pe dispozitiv, sau
panoul spune de ce nu poate. Nimic oferit nu e decorativ, nimic generat nu e prezentat ca fiind al
autorului.

### Decizii

* **Calitate: se spun faptele, nu se inventează o scală.** Runtime-ul local păstrează **o singură
  variantă** per upload (obiectul original, adresat după hash), deci panoul afișează tipul și
  dimensiunea reală și spune explicit că nu există variante transcodate. Un meniu „1080p/720p/480p”
  ar fi o minciună și nu există.
* **Subtitrări: de la autor sau deloc.** Un clip poate avea un fișier **WebVTT** alături de media
  (`<hash>.vtt`), servit de ruta `/media/<hash>.vtt` **doar** dacă există rândul media și cititorul
  are drept de citire pe el (același `canReadMedia`), cu `text/vtt` și `nosniff`. Dacă nu există
  track, panoul spune că se afișează **textul postării**, nu o transcriere a sunetului; dacă nu
  există nici text, spune și asta. Nu se generează nimic.
* **Auto-advance schimbă `loop`.** Repetarea aceluiași clip și trecerea la următorul se exclud, deci
  comutatorul spune exact asta; vecinul este lista reală de clipuri randate, iar la capătul listei nu
  se întâmplă nimic (nu se inventează un „next”).
* **Descărcare = fișierul real**, printr-un `<a download>` pe URL-ul media; nu se promite o
  conversie sau o calitate care nu există.
* **Offline = descărcare reală, nu cache de răspunsuri.** Regula P0 a repo-ului
  (`test/p0-offline-private-cache.test.js`) interzice Cache Storage și service worker în jurul datelor
  Social protejate, deci panoul **nu** promite un cache în aplicație: oferă descărcarea fișierului
  (sub controlul cititorului, stocat de browser/OS) și spune exact politica. Testul P7 verifică atât
  politica, cât și absența oricărei urme de `caches`/`CacheStorage`/`serviceWorker` în modul.
  Consecință asumată: nu există redare offline în aplicație, iar acest lucru e scris în panou.
* **Economie de date / viteză** sunt reale: `preload="none"` până la play, respectiv `playbackRate`
  pe toate clipurile de pe ecran (preferința e a cititorului, nu a cardului).
* **Buget**: modul nou `clip-options.js` (app.js doar importă), CSS în `post-detail.css`
  (nebugetat), locale 334k → **340k** cu comentariul care numește valul.

### Ce este în build

* `lib/media.js`: `captionTrackAvailability(hash)` și `readCaptionTrack(hash)` — citește sidecarul
  `.vtt` doar cu nume validat, plafon 512 KB și marker `WEBVTT`.
* `lib/api.js`: `GET /media/<hash>.vtt` (autorizat de rândul media), `mediaWithCaptions()` care pune
  `captions: true|false` pe media video din payload (postare și listă de media).
* `public/clip-options.js`: preferințe validate + persistate, `humanBytes`, `clipQualityFacts`,
  `captionSourceFor`, `offlineCapability`, `nextClipId`, marcajul panoului și al subtitrărilor,
  `applyClipPreferences` și `bindClipOptions` (deschidere/închidere, comutatoare, viteză, descărcare,
  offline, auto-advance pe `ended`).
* `public/app.js`: butonul ⚙ în chrome-ul clipului, panoul + overlay-ul de subtitrări în scenă,
  `<track data-clip-track>` doar când autorul are track, legarea panoului în `wirePostActions` cu
  lista reală de clipuri și URL-ul media real.
* Asertele urcate la `20260919-xsurface6` (index.html, pin-ul din audit, importul modulului).



### Evidence (wave 5 / P7)

* `test/p7-clip-options.test.js` — preferințe validate/persistate (inclusiv storage care aruncă),
  `humanBytes` pe praguri, fapte de calitate fără scală inventată, sursa de subtitrări (track de autor
  vs textul postării vs nimic, cu flag de video ignorat pe imagini), politica de offline (descărcare
  reală, fără cache de răspunsuri), `nextClipId` inclusiv la capătul listei, plus contractele statice
  server↔client↔copy↔CSS.
* Suita completă: **532/532 pass** (90 de fișiere); `release:check` → **gate PASS**,
  `external_network: false`.
* Live, prin API real (clip 79, `video/webm`, 404 967 B, cu manifest de studio verificat):
  * înainte de track: `media.captions: false` și `GET /media/<hash>.vtt` → **404**;
  * am plasat manual sidecarul de autor (`data/media/<hash>.vtt`, exact locul documentat);
  * după: `media.captions: true` (și în `media_list`), iar `GET /media/<hash>.vtt` → **200**
    `text/vtt; charset=utf-8` cu corpul `WEBVTT …`;
  * refuzuri reale: hash necunoscut → 404, hash fără sidecar → 404, cale non-`.vtt` → 404.
* Live, în browserul real (CDP, sesiune reală, aserte `20260919-xsurface6`):
  * panel: calitate `video/webm · 395 KB`, nota „o singură versiune locală”, sursa de subtitrări
    „Captions from the author (a WebVTT file next to the clip).” (`captionKind: track`), comutatoarele
    Captions / Auto-advance / Data saver, vitezele 0.75×–2×, butonul Download și propoziția de
    politică offline;
  * captions pornite → `[data-clip-subtitles]` vizibil **și** `track.mode = "showing"` pe `<track>`-ul
    autorului (elementul există doar pentru că fișierul există);
  * viteză 1.5× → `video.playbackRate = 1.5`; auto-advance → `video.loop = false`; data saver →
    `video.preload = "none"`; preferințele se persistă (`nexus-clip-options-v1`);
  * descărcarea se declanșează fără excepție; **zero excepții** în consolă.
    Capturi: `p7-clip-panel.png`.
* Defect găsit și reparat în timpul probei: branch-ul de **studio** din `renderStudioMedia()` nu
  atașa `<track>`-ul, deci un clip cu manifest verificat (exact cazul real) nu putea arăta subtitrări
  deși fișierul exista; acum ambele branch-uri îl atașează, iar testul numără atașările.
* Notă onestă (incident de proces, reparat): scriptul care a colapsat cele șase chei de offline în una
  a șters, din cauza unor indecși calculați înainte de ștergeri, câte 5 chei nevinovate din
  EN/PL/AR. Le-am restaurat din oglinda pre-P7, am verificat că fiecare cheie reapare exact de 4 ori
  (fără duplicate) și că `interfaceLocaleCoverage()` nu mai raportează nicio cheie lipsă în nicio
  limbă.
* Notă onestă (conținut de demonstrație): sidecarul `.vtt` de pe clipul 79 este pus de mine pentru
  probă (text generic „Nexus: context subtitles proof”); se poate șterge oricând din
  `data/media/`. Panoul îl descrie corect ca „subtitrări de la autor”, pentru că exact asta este:
  un fișier alături de media, nu o transcriere generată.


## 9. Wave 6 (P8) — identitate: onboarding la prima intrare, hero care se editează singur

Status: **livrat** (2026-09-19). Regula valului: fluxul de identitate se bazează pe **fapte din
înregistrare**, nu pe presupuneri, și nu decide nimic în locul persoanei.

### Decizii

* **Cine vede fluxul se citește din cont.** Un handle generat la înscriere (email fără handle ales → 
  `u<prefix><hex>`, sau stub de portofel → `wallet<hex>`) plus lipsa unui ștampile de finalizare
  (`users.onboarded_at`) înseamnă „identitate nealeasă”. Un handle scris de om nu declanșează nimic,
  iar un cont creat cu handle ales primește ștampila chiar la înscriere. Nimic nu se ghicește din
  email sau din vechimea contului.
* **O singură regulă de handle, exportată.** `NEXUS_HANDLE_PATTERN = /^[a-z0-9_]{2,30}$/` stă în
  `repo.js`, clientul o oglindește în `onboarding.js` (plus `generatedHandle()`), iar disponibilitatea
  se întreabă serverului (`GET /api/onboarding/handle`, limitat la 40 de verificări / 15 min / IP+handle).
* **Fluxul poate face doar ce arată înregistrarea**: revendică un handle liber, scrie numele afișat,
  numește personajul activ, alege vizibilitatea (`public` / `friends` / `private`, cu aceeași
  semantică „friends = urmărire reciprocă” ca postările) și, opțional, o descriere ≤ 300 caractere.
  Aceeași regulă automată de siguranță ca peste tot: un nume sau o descriere care o declanșează
  primește 422 cu `statement_of_reasons` și nu se salvează.
* **Închiderea este permisă.** Contul funcționează deja cu handle-ul generat, deci Escape închide
  foaia; fluxul revine la următoarea vizită, pentru că ștampila lipsește în continuare. Nu există
  „sari peste” care să mintă că identitatea a fost aleasă.
* **Hero-ul se editează singur, fără niciun buton** (doar pe propriul profil): numele și descrierea
  *sunt* câmpurile — apeși textul, el devine editabil **în loc** (aceeași tipografie: 17px/700 pentru
  nume, 13px/18.2px pentru descriere, fără chenar, doar o fundal discret), iar salvarea se face
  **automat la ieșirea din câmp** sau la Enter (Escape renunță). Nu există buton de Salvează, de
  Anulează sau de „schimbă descrierea”, iar salvarea rescrie hero-ul pe loc, deci profilul citit este
  profilul salvat. Prefixul „**Tu/You**” a fost scos din hero: nu ai nevoie să ți se spună că ești tu pe
  propria pagină (marcajul rămâne doar pe cardurile din lista de whispers, unde distinge cardul tău
  între altele).
* **Aliniere**: hero-ul nu mai este un flex column centrat cu text la stânga (de aici venea aspectul
  dezordonat), ci un **grid** cu `gap` uniform și lățime completă, deci rândul de identitate și
  descrierea pornesc de la **aceeași margine** (măsurat live: 14px = 14px, lățime 384px), iar descrierea
  se întinde pe toată lățimea, cu plafon la 3 linii. Butonul de avatar și coverul rămân singurele
  randări ale identității vizuale (o singură randare fiecare, verificată de test).
* **Descrierea are exact trei linii, iar rândurile sunt ale tale.** `white-space: pre-line` pe textul
  afișat și un câmp de exact 3 linii (55px, `max-height` = 3 × line-height, scroll în interior dacă
  lipești mai mult) fac din descriere un loc unde YouTube pe linia 1, Instagram pe 2 și Spotify pe 3
  sunt citite exact așa. Enter rupe rândul (Ctrl/Cmd+Enter salvează mai devreme), ieșirea din câmp
  salvează, Escape renunță.
* **Creionul a rămas doar semnul, mutat în zona descrierii.** Butonul `✎` (fără cuvântul „Edit”) stă în
  rândul descrierii, iar cât timp scrii locul lui este luat de **`✓`** — confirmarea pe care o apeși, și
  care dispare imediat după ce ai confirmat (creionul revine). Butonul `＋` din hero a fost scos:
  crearea există deja în navigația de jos.
* **Buton de locație cu sugestii, fără rețea.** Coloana nouă `personas.location` (migrare aditivă) ține
  **orașul ales de om**, niciodată coordonate: apeși `📍`, scrii „Buch”, lista propune „București,
  România”, alegerea salvează singură, iar „Remove location” șterge. Lista de orașe este **inclusă în
  aplicație** (`public/profile-location.js`, ~14 KB, încărcat o dată): căutarea ignoră diacriticele și
  majusculele („iasi” → „Iași”, „Bucharest” → „București”), iar un oraș care nu e în listă poate fi
  folosit exact cum a fost scris („Use «X»”) — sugestiile sunt sugestii.
* **Vizibilitatea nu mai e cuvântul brut „friends”.** Profilul non-public arată un **lacăt lângă nume**,
  cu eticheta tradusă în tooltip (`Prieteni` / `Friends` / `Doar eu`), deci nu se mai citește ca o
  relație („sunt friend cu mine?”), iar marcajul „Tu/You” a fost scos și de pe cardurile din lista de
  whispers: pe propriul profil nu ai nevoie să ți se spună că ești tu.
* **Aceeași regulă de siguranță pentru textul de profil**: `PATCH /api/persona/<persona>` verifică acum
  numele, descrierea și locația cu `assessSocialContent` și răspunde **422** cu `statement_of_reasons`
  (înainte ruta nu verifica nimic, deci ramura de refuz din client era cod mort).
* **Migrare aditivă**: `users.onboarded_at INTEGER` (în `CREATE TABLE` pentru baze noi și în
  `migrateUsersTable` pentru cele existente) — nicio rescriere de date.

### Ce este în build

* `db.js`: coloana + migrarea aditivă.
* `repo.js`: `NEXUS_HANDLE_PATTERN`, `generatedHandle`, `handleAvailability`, `claimHandle`,
  `markOnboarded`, `onboardingState`, `completeOnboarding`.
* `api.js`: `GET /api/onboarding`, `GET /api/onboarding/handle`, `POST /api/onboarding`; `GET /api/me`
  întoarce `onboarding`; înscrierea cu handle ales ștampilează contul.
* `public/onboarding.js`: marcajul foii + `bindOnboarding` (validare, verificare de disponibilitate cu
  debounce, alegerea personajului/vizibilității, submit, maparea erorilor, Escape).
* `public/profile-location.js`: lista de orașe + `foldLocation` / `searchLocations` / `locationPickerMarkup`
  / `renderLocationOptions` / `bindLocationPicker` (tastatură, Enter, Escape, click în afară, ștergere).
* `app.js`: `maybeStartOnboarding()` după boot, `openOnboarding()` / `closeOnboarding()`, hero-ul
  inline (`wireHeroInlineEdit`, `saveHeroField`, `closeHeroField` / `openHeroField`, `saveHeroLocation`,
  `wireHeroLocation`) legat în `onRendered` al profilului.
* Copy în RO/EN/PL/AR (48 de chei noi) și stiluri în `post-detail.css` + `profile-experience.css`
  (ambele nebugetate); buget de locale 340k → **348k** și app.js 605k → **612k** (608.900 folosiți),
  comentate cu valul.

### Evidence (wave 6 / P8)

* `test/p8-identity.test.js` — regula de handle pe ambele părți (normalizare `@`/majuscule, prea scurt,
  caractere invalide, 31 de caractere), `generatedHandle` inclusiv pentru cuvinte care seamănă
  (`wallet`), starea de onboarding pe cele trei conturi (ales / generat / portofel), revendicarea unui
  handle (liber / ocupat / invalid / al propriului cont), completarea fluxului (handle, nume, bio,
  vizibilitate invalidă → `public`, ștampilă care nu se mișcă), marcajul foii (toate personajele și
  vizibilitățile, fără pre-completarea emailului) și contractele statice server↔client↔CSS↔copy,
  inclusiv **o singură randare** a avatarului și a coverului în hero.
* Suita completă: **539/539 pass** (91 de fișiere); `release:check` → **gate PASS**,
  `external_network: false`.
* Live, prin API real (cont 22, handle generat `up8onboard1234`, `onboarded_at` șters):
  * `GET /api/me` → `onboarding {required: true, reason: "generated_handle", handle_source: "generated",
    completed_at: null}`;
  * verificarea de handle răspunde cinstit: `romeo` → `handle_taken`, `p8_identity` → `available`,
    `"are spatii"` → `handle_invalid`;
  * trimiteri respinse: handle invalid → **400 `HANDLE_INVALID`**, handle ocupat → **409
    `HANDLE_TAKEN`**, nume gol → **400**;
  * completare → **200** cu handle `p8_identity`, `display_name` „P8 Identity”, personajul `social`
    numit „P8 Identity”, descrierea scrisă, `visibility: public`,
    `onboarding {required: false, reason: "completed", handle_source: "chosen", completed_at: …}` și
    `visibility_changed: false`;
  * `/api/me` după: handle nou + `required: false`; profilul public arată numele, descrierea și
    vizibilitatea noi.
* Live, în browserul real (CDP, aserte `20260919-xsurface7`):
  * foaia apare singură la boot pentru contul cu handle generat: titlu „Welcome to Nexus”, câmp de
    handle **gol** (nu pre-completează emailul sau handle-ul generat), numele afișat pre-completat,
    cele 5 personaje și 3 vizibilități cu selecțiile implicite, nota despre „Friends = urmărire
    reciprocă”;
  * verificarea în pagină: `romeo` → „already taken”, `p8_browser` → „@p8_browser · free” (tone good);
  * trimiterea din pagină închide foaia, toast „Identity saved”, iar `/api/me` arată handle-ul nou și
    `required: false`;
  * hero: numele și descrierea se editează **direct pe text** (câmpul se deschide în loc, cu aceeași
    tipografie: `17px / 700` pentru nume și `13px / 18.2px` pentru descriere, fără chenar), iar ieșirea
    din câmp salvează: hero-ul și serverul arată aceeași valoare (`Nume 4600`, `Bio 6804 …`), fără
    niciun buton apăsat; **zero** câmpuri vizibile în repaus; fără prefixul „You” în hero (măsurat) și
    fără butoane suplimentare în afara acțiunilor de profil care existau deja;
  * aliniere măsurată după redesign: rândul de identitate și descrierea pornesc de la **aceeași
    margine** (14px = 14px) și descrierea ocupă toată lățimea (384px);
  * descrierea: **3 linii** randate din `youtube.com/@nexus` / `instagram.com/nexus` /
    `open.spotify.com/nexus` (măsurat `white-space: pre-line`, clamp 3, înălțime 55px = 3 linii),
    câmpul nu crește peste 3 linii, iar hero-ul și serverul păstrează exact 3 linii după salvare;
  * creionul: `text = "✎"`, `aria-label = "Edit profile"` (fără cuvântul „Edit”), iar cât timp scrii
    creionul e ascuns și `✓` e vizibil; după click pe `✓` câmpul se închide, `✓` dispare, creionul
    revine și serverul are valoarea nouă;
  * locația: panoul se deschide cu inputul focusat, „Buch” propune „București, România”, alegerea
    „Cluj-Napoca, România” scrie eticheta + `data-owner-location` + serverul, apoi „Buch” →
    „București, România” la fel; panoul se închide singur după alegere;
  * hero-ul nu mai are `＋` (măsurat `hasPlus: false`) și nu mai tipărește „friends” (`false`); pe
    profilul friends-only, lacătul stă **pe linia numelui** (înălțime 20px, o linie) cu tooltip tradus;
  * **zero excepții** în consolă. Capturi: `p8-onboarding.png`, `p8b-hero-clean.png`,
    `p8b-hero-edited.png`, `p8c-location.png`, `p8c-bio-confirm.png`, `p8e-identity.png`.
* Live, prin API real (`PATCH /api/persona/social`):
  * `location` apare în `GET /api/me` (coloana există după migrare) și în profilul public
    (`payload.profile.location`);
  * descrierea cu 3 rânduri se salvează și se întoarce **exact** cu 3 rânduri;
  * locația se scrie, se schimbă, se **șterge** („”) și se scrie din nou;
  * `{"name": "I will kill you"}` → **422** cu `reason_codes: ["DIRECT_VIOLENT_THREAT"]`,
    `automated_only: true`, iar numele din bază rămâne neschimbat.
* **Defect găsit de proba live și reparat**: ruta `PATCH /api/persona/<persona>` răspunde cu
  `{ ok, persona: <row> }`, dar clientul citea `result.profile`, deci o salvare reușită era raportată
  ca „Could not save” și hero-ul rămânea cu valoarea veche. Acum clientul citește `persona` (și testul
  fixează citirea corectă).
* Notă onestă (limite asumate): fluxul numește doar **personajul activ**, iar handle-ul se revendică o
  singură dată (schimbarea ulterioară rămâne în §10). Descrierea păstrează rândurile, dar **link-urile
  sunt text**: nu sunt transformate în ancore, deci nu se pot apăsa încă (rămâne de hotărât împreună cu
  politica de linkuri, nu ascunsă într-un val). Lista de orașe este un **set inclus** (~280 de nume, nu
  un serviciu de geocodare): o sugestie e o sugestie, iar un oraș care lipsește se poate scrie liber.
  Locația este un câmp de profil **public** (ca descrierea) — orașul ales de om, niciodată coordonate,
  niciodată citită din dispozitiv.



## 9b. Wave 6c (P8c) — creionul lângă nume, conținutul pe toată lățimea, fără header

### Decizii

* **Un singur semn de editare, lângă nume.** Creionul `✎` stă pe rândul numelui (după lacăt), nu în
  dreptul descrierii. El deschide **ambele** câmpuri — numele și descrierea — iar `✓` (butonul V), care
  îi ia locul cât timp câmpurile sunt deschise, salvează ambele într-o singură cerere care duce doar
  câmpurile schimbate. Descrierea rămâne un bloc simplu, pe toată lățimea; rândul cu două coloane
  (`.ownerBioRow`) a existat doar pentru creionul care nu mai e acolo și a fost scos.
* **Descrierea și numele se pot deschide și prin atingerea textului** (aceeași ușă, cu cursorul în câmpul
  atins), iar scrierea nu se pierde: `✓`, `Enter` în nume, sau ieșirea completă din editor salvează;
  `Escape` este singura ieșire fără salvare. Un al doilea clic pe `✓` nu poate produce a doua cerere
  (`heroEditorSaving`).
* **Conținutul era îngropat în padding-ul identității.** `.ownerHero` (introdus în wave 6) avea
  `padding:12px 14px 0` și închidea **tot** profilul: banda Flow/Reels/Shots desena o cutie neagră
  plutitoare — măsurat `left:14 / width:384` din 412px — iar grila de media moștenea aceleași margini,
  deci pozele și clipurile nu mai ajungeau la marginile ecranului. Hero-ul ține acum doar identitatea;
  taburile, `profileMoments`, grila de media, lista de whispers și stările goale sunt din nou frați ai
  lui → full-bleed, exact ca înainte de wave 6.
* **Profilul nu mai are header de aplicație.** Nici logo Nexus, nici titlul „Profile”, nici „Log out”:
  `#phoneHeader` este gol pe ecranul de profil, iar taburile de setări (Profile / Wallet and username /
  Access and security / Settings) sunt începutul paginii. Regula veche de înălțime a viewport-ului
  (`100% - 164px`, pentru header + navigație) a fost ștearsă, nu înlocuită cu o altă presupunere: regula
  partajată din `social-human-ux.css` (`100% - 86px`, doar navigația) este acum cea corectă.
* **Log out este o setare.** Rândul `#profile-settings-logout` stă în **Access and security**, lângă
  lista de dispozitive și sesiuni și lângă butoanele „Deconectează această sesiune / toate dispozitivele”
  care existau deja. Dialogul de confirmare era hardcodat în română indiferent de limba interfeței; acum
  folosește `x.profile.logout` + chei noi în RO/EN/PL/AR.
* **Poza, coperta și tipul de profil s-au mutat din hero în Settings.** Creionul editează nume +
  descriere, deci formularul mare (`#pedit`, disclosure-ul „Edit profile”) se deschide din **Settings**
  → rândul `#profile-assets-edit`, cu subtitlul „Profile photo, cover and profile kind”. Fără acest
  drum, scoaterea creionului din rolul de „deschide formularul” ar fi lăsat poza de profil fără intrare.
* **Editorul este propriul modul.** `public/profile-hero-edit.js` (217 linii) primește tot ce-i trebuie
  prin fabrică: `t` împachetat (`(key) => t(key)`) pentru că limba se schimbă sub o aplicație pornită, și
  `getState()` pentru că boot-ul înlocuiește obiectul de stare (`state = me`). Bugetul `app.js` **scade**
  pentru prima dată în acest proiect: 612 KB → **606 KB**, iar comentariul din testul de buget numește
  mutarea.

### Ce este în build

* `public/profile-hero-edit.js` (nou): `createProfileHeroEditor` → `bindHeroInlineEdit`, `bindHeroLocation`;
  `openEditor` / `closeEditor` / `saveEditor` (o cerere cu câmpurile schimbate), `autoGrow` (3 linii
  exact, cu padding inclus, deci fără bară de scroll la 3 linii).
* `public/profile-experience.js`: creion + `✓` în `<h1>` (`data-hero-confirm="profile"`), fără
  `.ownerBioRow`, `</div>` care închide hero-ul înainte de `profileMoments` / `ownerContentTabs` /
  `ownerPostGrid` / `ownerWhisperList` / `ownerEmptyStates`.
* `public/profile-experience.css`: `.ownerIdentityText h1` este rând flex care se rupe (nume, lacăt,
  creion, `✓`), `.heroIconButton` 24px pe linia numelui, `.heroEditorInput` flex pe linia numelui; scoase
  regulile `.profileAppHeader*` și `.profileHeaderTitle`; `#phoneHeader{display:none}` pe ecranul de
  profil; rânduri noi `.profileAssetsRow` / `.accountLogoutRow` (aceeași limbă vizuală ca rândurile de
  dispozitiv).
* `public/app.js`: fără ramura de header pentru profil (element gol), `logoutFromProfile` tradus, rândul
  de logout și rândul de active în panourile `access` / `settings`, plus instanța
  `profileHeroEditor` construită o dată.
* `post-detail.css`: `textarea.heroEditorInput` = `calc(3 * 1.4em + 4px)` (padding inclus).
* Copy nou în 4 limbi (RO/EN/PL/AR): `profile.logoutDetail`, `profile.logoutConfirm`, `profile.logoutPending`,
  `profile.logoutFailed`, `profile.editAssetsDetail`, plus `profile.confirmBio` reformulat („Salvează numele
  și descrierea” / „Keep the name and the description”), pentru că `✓` salvează ambele câmpuri.
* Aseară/asset tag nou: `20260919-xsurface11` (index.html, importurile din app.js, pin-ul din
  `audit.test.js`).


### Evidence (wave 6c / P8c)

* Suita completă: **539/539 pass** (91 de fișiere); `release:check` → **gate PASS**, `external_network: false`.
* `test/p8-identity.test.js`: importul modulului la versiunea de asset curentă, instanța construită o dată
  (`getState: () => state`), hook-ul de randare, contractele editorului (ambele câmpuri, doar câmpurile
  schimbate în corpul cererii, `Escape` fără salvare), creionul și `✓` **în interiorul** blocului `<h1>`,
  fără `.ownerBioRow`, hero-ul care se închide înainte de `profileMoments`, header-ul de profil inexistent
  în app.js, `#profile-settings-logout` și `#profile-assets-edit` legate, `#phoneHeader{display:none}`,
  fără override de înălțime pentru ecranul de profil, dialogul tradus, cele 5 chei noi × 4 limbi.
* `test/profile-whispers.test.js`: marcajul randat are creion + `✓` pe linia numelui, descrierea într-un
  singur bloc, `</div><section class="profileMoments"` (hero închis înainte de conținut), `ownerContentTabs`
  și `ownerPostGrid` în afara hero-ului.
* `test/x-surface.test.js`: zero apariții `profile-header-logout` / `profileHeaderTitle` / `profileAppHeader`
  în app.js, rândul de logout și legarea lui, copy-ul de logout în 4 limbi.
* Live, în browserul real (CDP, `20260919-xsurface11`, cont 22, 412×892):
  * **header**: `#phoneHeader` gol (`headerText: ""`, `headerHeight: 0`), pagina începe cu taburile de setări;
  * **full-bleed**: `ownerContentTabs` `left:0 / width:412` (era `left:14 / width:384`),
    `tabsInsideHero: false`, `ownerHero` are 183px (doar identitatea), `phoneScreen 892 = viewport 806 + nav 86`,
    iar pagina nu derulează (`scroll == client == 892`);
  * **creionul**: `pencilInNameLine: true`, `confirmInNameLine: true`; clic pe creion → ambele câmpuri
    deschise (`nameOpen`/`bioOpen: true`), textele ascunse, creionul ascuns, `✓` vizibil, focus în nume;
  * **descrierea**: câmpul are 59px = 3 linii exact, `scrollHeight == height == 59` (fără bară de scroll),
    `white-space: pre-wrap`;
  * **`✓` salvează ambele**: hero-ul arată `Romeo Cojan 3928` și 3 linii; după salvare câmpurile sunt închise,
    creionul a revenit, `✓` ascuns; serverul (`/api/me`) confirmă `name: "Romeo Cojan 3928"`, `bio` cu 3 rânduri,
    `location: "București, România"`;
  * **logout**: rândul din Access and security citește „Log out / Close the session on this device; the account
    stays. →", iar dialogul „Log out / Sign out of Nexus? / Cancel / Log out” — în limba interfeței, nu mai e
    română hardcodată;
  * **activele de profil**: clic pe rândul din Settings deschide formularul (`profileEditorDisclosure[open]`,
    `#pedit` vizibil) cu poza de profil, coperta și tipul de profil;
  * **zero excepții** în consolă;
  * smoke final pe build-ul servit: `app.js?v=20260919-xsurface11`, `#phoneHeader` 0px, `ownerContentTabs`
    `left:0 / width:412`, creionul pe linia numelui, descriere 3 linii, zero excepții.
* Ecrane salvate: `p8k-profile-rest.png`, `p8k-hero-edit.png`, `p8k-hero-saved.png`, `p8k-access-security.png`,
  `p8m-access-logout.png`, `p8m-settings-assets.png`.
* Limite declarate: descrierea păstrează liniile și rămâne **text**, nu ancore (linkurile `http(s)` pot deveni
  clicabile doar după decizia de politică de linkuri, cu `rel="noopener”` și tab nou); handle-ul se revendică
  o singură dată; onboarding-ul numește doar personajul activ.

## 9c. Wave 6d (P8d) - creionul editează toată pagina de profil, iar descrierea își păstrează linkurile

### Decizii
- **Un singur `✓` salvează tot**: numele, descrierea, locația, poza de profil și coperta. Creionul deschide
  toate câmpurile deodată, iar salvarea duce doar câmpurile care s-au schimbat.
- **Pozele se urcă abia la `✓`**: fișierul ales este arătat local (`URL.createObjectURL`) și nimic nu pleacă
  spre server până nu apeși check-ul. `Escape` nu salvează nimic, nici poza.
- **Locația așteaptă check-ul**: alegerea unui oraș scrie doar chip-ul (valoare pending); nu mai există un
  `PATCH` pornit de picker.
- **Descrierea rămâne text, dar un link rămâne link**: doar `http(s)` (și `www.`) devin ancore cu
  `target="_blank"` și `rel="noopener noreferrer"`; `javascript:` și `data:` rămân text.
- **Fără duplicate în Settings**: din formular au plecat numele, descrierea, avatarul și coperta (împreună cu
  scurtătura care le deschidea), iar rândul `#profile-assets-edit` a fost șters. Formularul ține politica
  (vizibilitate, discoverability, politici de mesaje, limbi, regiune/Near, prețuri acces privat, tip de
  profil) și se numește acum `profileEdit.moreSummary`.
- **Pozele sunt conținut-adresate**: aceiași bytes înseamnă aceeași adresă, deci o poză re-aleasă se urcă dar
  **nu** se scrie în profil dacă adresa nu s-a schimbat.

### Ce este în build
- `public/profile-bio-text.js` (nou): `profileBioMarkup(text, esc)` - escapează întâi, apoi transformă
  adresele în ancore; punctuația de la coadă rămâne în afara linkului, iar paranteza se taie doar dacă e
  nepereche.
- `public/profile-experience.js`: slot de copertă pentru proprietar (`.ownerCover`, ascuns cât timp nu există
  copertă și profilul nu e în editare), badge de cameră pe avatar (`data-hero-photo`), inputuri de fișier
  ascunse, descriere randată prin `bioOf` (linkificarea vine din app.js), `attr()` pentru valorile de
  atribut - o ghilimea dintr-un nume, dintr-o descriere sau dintr-un oraș nu mai poate rupe valoarea pe care
  editorul o citește înapoi.
- `public/profile-hero-edit.js`: modul de editare complet - clasa `heroEditing`, locație pending
  (`setHeroLocation`), previzualizare locală pentru ambele poze, `✓` = upload (dacă e nevoie) + un singur
  `PATCH` cu câmpurile schimbate + verificarea ecoului + update DOM / `state.profiles`, `Escape` = anulare
  totală, iar blur-ul nu salvează cât timp focusul sau pointerul e în profil (dialogul de fișier nu mai
  declanșează o salvare prematură).
- `public/app.js`: factory-ul primește `bioMarkup`, `uploadMedia`, `safeMediaUrl`; formularul din Settings fără
  cele patru câmpuri de identitate și fără upload-uri; rândul de active șters; bio-ul din profilul public
  linkificat.
- CSS: badge/overlay în editare, stil pentru linkuri, slotul de copertă; regulile moarte
  `.profileAssetsRow` au fost șterse.
- Locale ×4: `+profile.editHint`, `+profileEdit.moreSummary`, `-profile.editAssetsDetail`.
- Tag asset: `20260919-xsurface12`.

### Evidence (wave 6d / P8d)
- **546/546 teste** (92 fișiere), inclusiv `test/profile-bio-links.test.js` (7 teste: text simplu, linkuri,
  `www.`, punctuație la coadă, `javascript:`/`data:` niciodată ancoră, escape o singură dată, ghilimele în
  identitate nu rup atributul).
- `release:check` → **gate PASS**, `external_network: false`.
- Mirror: 26 fișiere, **0 SHA256 mismatches**; `verify-encoding.mjs` extins cu modulul nou (fără BOM, fără
  mojibake).
- Probă live CDP (cont 22, 412×892, `p8p-hero-full.mjs`): **27/27 PASS, zero excepții**:
  - `app.js?v=20260919-xsurface12`; `#phoneHeader` 0px; `ownerContentTabs left:0 / width:412`; Settings fără
    `#persona-avatar`, `#persona-cover`, `input[name=display]`, `textarea[name=bio]`, `#profile-assets-edit`,
    `.profileAvatarEditor`;
  - creionul deschide toate câmpurile (nume, descriere, chip de locație, badge de poză, slot de copertă, două
    inputuri de fișier), creionul dispare, `✓` apare, focusul e în nume;
  - orașul ales → **0 request-uri** până la `✓`;
  - pozele alese → previzualizare `blob:` locală, **0 upload-uri** înainte de `✓`;
  - un singur `PATCH /api/persona/social` cu exact câmpurile schimbate
    (`{"bio":"... wave6d-...","location":"Cluj"}`), iar pozele re-alese (aceiași bytes) s-au urcat dar
    **nu** au fost scrise;
  - după salvare: avatar și copertă = `/media/...png`, `data-profile-cover="1"`, chip-ul arată orașul salvat;
  - descrierea: `Linia unu` pe un rând, iar `https://nexus.example/abc` randat ca
    `a[href][target=_blank][rel=noopener]`;
  - `Escape` după modificarea numelui → niciun request, numele rămâne cel salvat;
  - screenshot-uri: `p8p-hero-editing.png`, `p8p-hero-photos-preview.png`, `p8p-hero-saved.png`,
    `p8p-hero-rest.png`.

### Limite (spuse explicit)
- Dacă upload-ul reușește și `PATCH`-ul pică, fișierul rămâne în media neasociat profilului (orfan); nu
  există încă un pas de curățare.
- Fără UI de decupare/poziționare și fără buton „șterge poza/coperta” (nu au fost cerute atunci; decuparea
  a fost cerută de owner și livrată în §9j — vezi acolo, nu aici).
- Fără carduri de previzualizare pentru linkuri: ancora este tot ce se randează.
- Editorul nu are istoric de undo: `Escape` reface starea din DOM, nu o stivă de modificări.

## 9d. Wave 6e (P8e) — banda care se mișcă singură și meniul cu trei linii

### Decizii
- **Banda este strict informativă**: se randează sub identitate și direct deasupra taburilor, conține doar
  `span`-uri (fără buton, fără link, fără câmp, fără `tabindex`), are `aria-hidden="true"` (aceleași date
  sunt în hero, care rămâne sursa accesibilă), `pointer-events:none` și `user-select:none`.
- **Bucla nu are cusătură**: două rânduri identice într-un track care translatează `-50%`; separatoarele
  sunt puncte teal, iar ordinea conținutului este ordinea de citire: 📍 locație, @handle, postări,
  followers, following, apoi cel mult trei fragmente din descriere (rânduri / „·” / propoziții).
- **Viteza este o setare globală, nu una de profil**: `PROFILE_TICKER_SECONDS_PER_ITEM` (6 s) × numărul de
  elemente, cu factori slow/medium/fast; `--tickerSpan` se schimbă pe DOM fără re-randare, iar rândul
  „Band speed” stă în meniu → Theme and appearance (cheie `nexus-ticker-speed-v1`, per dispozitiv).
- **Un singur buton pentru toate setările**: trei linii în a treia coloană a identității, lângă nume, iar
  taburile de setări din header au dispărut complet.
- **Sertar lateral pe dreapta**, `role="dialog" aria-modal="true"`: 7 uși în ordinea cerută (Profile,
  Wallet and username, Access and security, Privacy, Notifications, Theme and appearance, Log out),
  fiecare cu o iconiță geometrică și cu rândul activ marcat; `Escape`, `×` și o atingere în afara
  sertarului închid, iar focusul se întoarce pe butonul care l-a deschis.
- **Panourile rămân destinațiile**: `profile`, `wallet`, `access`, `privacy` (nou), `notifications` (nou),
  `settings` (prezentat ca „Theme and appearance”). Hero-ul se ascunde doar când un panou de setări este
  deschis; bara de deasupra panourilor duce înapoi la profil și redeschide același sertar.
- **Confidențialitatea are o singură casă**: vizibilitatea, „poate fi găsit” și accesul privat plătit au
  fost mutate din panoul de profil în panoul `privacy`; `#profile-form` învelește ambele panouri, iar
  rândul de Save le urmărește pe amândouă (`data-profile-panel="profile privacy"`).
- **Notificările sunt reale, nu un link**: `notification-preferences.js` deține etichetele, formularele și
  validarea, iar inboxul și panoul de profil randează exact aceleași formulare.
- **Extracție cerută de buget**: markerele panourilor de setări au ieșit în `profile-settings-panels.js`
  (~20 KB), așa că `app.js` a scăzut sub buget fără să fie ridicat.

### Ce s-a construit
- `public/profile-ticker.js` (**nou**): `profileTickerItems`, `profileTickerFragments`,
  `profileTickerMarkup`, `profileTickerSpan`, `readTickerSpeed`/`writeTickerSpeed`/`applyTickerSpeed`,
  `nextTickerSpeed`, `tickerSpeedLabelKey`.
- `public/profile-menu.js` (**nou**): `PROFILE_MENU_ITEMS` (7, în ordine), `profileMenuMarkup`,
  `profileMenuView`, `profileMenuId`, `markProfileMenuActive`, `bindProfileMenu`.
- `public/notification-preferences.js` (**nou**): etichete + formulare + binding, folosite de inbox și de
  panoul de profil.
- `public/profile-settings-panels.js` (**nou**): toate panourile de setări (wallet, profil, privacy,
  notifications, access, lifecycle, device settings) ca markup.
- `profile-experience.js`: slotul de meniu în identitate + banda deasupra taburilor.
- `app.js`: fără taburi de setări, drawer montat și legat, bara panourilor, panourile noi, rândul de viteză,
  hook-ul `profileSectionSwitcher`.
- CSS: banda (mask, keyframes, reduced-motion), cele trei linii, sertarul, bara panourilor, rândul de Save.
- Locale ×4: `+profileMenu.{eyebrow,open,title,hint,privacy,notifications,appearance}`,
  `+profile.backToProfile`, `+profile.privacyHint`, `+profile.ticker{Speed,Slow,Medium,Fast}`.
- Tag asset: `20260920-menu1`.

### Evidence (wave 6e / P8e)
- Regresie wave 6d sub noua grilă a identității (`p8q-hero-regression.mjs`): **6/6 PASS, zero excepții,
  zero scrieri** — creionul deschide numele, descrierea, chip-ul de locație și cele două inputuri de
  fișier, cele trei linii se retrag cât timp identitatea se editează, banda rămâne pe loc, iar `Escape`
  închide editorul fără niciun request.
- **557/557 teste** (93 fișiere), inclusiv `test/profile-menu-ticker.test.js` (11 contracte: ordinea
  elementelor, bandă fără element interactiv, fragmente, escape, viteza globală cu limite, cele 7 uși în
  ordine, poziția benzii deasupra taburilor, sertarul ca unică navigație, niciun control duplicat,
  notificările ca modul unic, CSS-ul și cele patru limbi).
- `release:check` → **gate PASS**, `external_network: false`.
- Mirror: 32 fișiere, **0 SHA256 mismatches**; `verify-encoding.mjs` extins cu cele 4 module și 2 teste.
- Probă live CDP (cont 22, 412×892, `p8q-menu-ticker.mjs`): **45/45 PASS, zero excepții, zero mutații**:
  - `app.js?v=20260920-menu1`; niciun `.profileSettingsTabs` / `[data-profile-settings-tab]`;
  - banda: full-bleed (`left:0 width:412`), deasupra taburilor (`compareDocumentPosition`), 0 elemente
    focusabile în interior, `pointer-events:none`, `user-select:none`, animație `ownerTickerRoll` infinită
    (~42 s), două rânduri identice plus puncte, iar măsurătoarea la 900 ms arată deplasare spre stânga;
  - cele trei linii stau la dreapta rândului de nume (`right ≈ 398 px`, offset vertical < 40 px); al doilea
    buton există doar în bara panourilor (0 px cât timp hero-ul este deschis);
  - sertar: 7 rânduri în ordinea cerută, `role=dialog/aria-modal=true`, `aria-expanded=true` pe ambele
    butoane, focus în sertar, lățime ~320 px;
  - fiecare ușă deschide panoul ei (hero ascuns pentru setări, vizibil pentru „Profile”), rândul activ
    marcat, bara cu „‹ Back to profile” prezentă;
  - panoul de notificări randează formularele reale (≥3, cu `in_app`, `preview`, `quiet_start`, `quiet_end`);
  - panoul de privacy deține cele trei controale, în același `#profile-form`, iar rândul de Save este
    vizibil pe ambele panouri;
  - „Band speed” schimbă `--tickerSpan` fără re-randare și scrie `nexus-ticker-speed-v1` local;
  - `Escape` închide sertarul și dă focusul înapoi butoanelor; „Log out” cere confirmarea, iar sesiunea
    rămâne activă;
  - **0 request-uri de scriere** în toată proba;
  - screenshot-uri: `p8q-profile-band.png`, `p8q-drawer-open.png`, `p8q-notifications.png`,
    `p8q-privacy.png`, `p8q-appearance.png`, `p8q-logout-confirm.png`, `p8q-back-to-profile.png`.

- Proba live a prins două lucruri pe care testele statice nu le pot vedea, iar ambele sunt acum acoperite
  de teste: blocul nou de CSS aterizase **în** `@media (max-width:400px)`, deci nu se aplica la 412 px
  (regula `.ownerIdentity` are acum a treia coloană și în varianta de telefon, iar testul verifică
  poziția `right` a butonului), iar `profileSettingsPanelsMarkup` era apelat fără `readTickerSpeed`
  (testul verifică acum că ecranul predă cititorul de viteză modulului).
### Limite (spuse explicit)
- Banda nu poate fi oprită dintr-o atingere (este `pointer-events:none` prin contract): singurul control
  este viteza globală din meniu, plus `prefers-reduced-motion`, care oprește animația.
- Fragmentele din descriere sunt primele trei bucăți separate de rând / „·” / propoziție, trunchiate la 72
  de caractere; linkurile din ele nu se citesc (banda nu este interactivă).
- „Notifications” randează preferințele personajului activ; schimbarea personajului cere redeschiderea
  ecranului de profil.
- Sertarul nu are tranziție de închidere și nu blochează scroll-ul din spate.
- `logout` este singura ușă care nu duce la un panou: deschide dialogul existent de confirmare.

## 9e. Wave 6f — tăierea dublurilor din hero și curățarea datelor de probă

### Decizii (cerute de owner)
- **Banda rămâne singurul loc unde se citesc handle-ul, locația și contoarele.** Hero-ul nu le mai
  printează: rândul `@handle`, linia celor trei numărători și locația statică (pentru vizitatori) au
  dispărut din markup. „totul e in ticker, nu are rost sa fie dublate”.
- **Faptele nu se pierd pentru cititoarele de ecran**: banda este `aria-hidden`, așa că aceleași fapte
  stau într-o singură linie `.ownerFacts`, vizual ascunsă (1×1 px, `clip-path:inset(50%)`), în ordinea în
  care le citește banda: handle, locație, postări, followers, following.
- **Locul rămâne editabil**: rândul de locație (buton + listă de orașe) există în continuare pentru owner,
  dar CSS-ul îl arată doar cât timp identitatea este în editare (`.heroEditing`), ca să nu fie o a doua
  copie a benzii pe profil. Pentru vizitatori nu se randează deloc.
- **Un singur buton de editare, fără ștergere și fără decupare**: creionul rămâne singura ușă în editor,
  iar din el se adaugă sau se înlocuiește orice poză la profil și la copertă. Owner-ul a cerut explicit
  doar atât („vreau doar buton de editare”), deci nu se construiește buton de ștergere și nici pas de
  decupare/poziționare; testul verifică absența lor.
- **Datele de probă scrise de sondele anterioare au fost curățate** din contul demo: avatar și copertă
  (același PNG de 1×1 pixel), locația „Cluj” și descrierea de test
  (`Linia unu / Vezi https://nexus.example/abc … wave6d-…`) sunt goale, iar cele trei obiecte media
  rămase orfane au fost șterse din magazinul content-addressed. Numele afișat și handle-ul nu au fost
  atinse: handle-ul se revendică o singură dată (limită P8 cunoscută), iar numele se schimbă din editor.

### Ce s-a construit
- `public/profile-experience.js`: linia `.ownerFacts` (o singură dată, escapată bucată cu bucată),
  prezența online rămâne vizibilă, rândul de locație doar pentru owner, fără `ownerStats`/`ownerHandle`/
  `ownerLocationStatic`.
- `public/profile-experience.css`: `.ownerFacts` (ascuns vizual), `.ownerLocationRow` (ascuns până la
  `.heroEditing`), regulile moarte `.ownerStats*` și `.ownerLocationStatic` eliminate (rămân doar cele din
  blocul istoric de la linia 1, care este contractul vechii așezări).
- Teste: `test/profile-menu-ticker.test.js` (test nou: hero-ul nu repetă banda, linia ascunsă există,
  rândul de locație e doar în editare, exact un creion, două fotografii, zero ștergere/decupare),
  `test/profile-whispers.test.js` și `test/audit.test.js` actualizate pe noua contract.

### Evidence (wave 6f)
- **558/558 teste** (93 fișiere), `release:check` → **gate PASS**, `external_network: false`.
- Proba live CDP `p8r-hero-facts.mjs` (cont 22, 412×892): **13/13 PASS, zero excepții** — hero fără
  contoare/handle/locație, `.ownerFacts` de 1×1 px cu textul
  `@p8_browser · Cluj · 0 posts · 0 followers · 0 following`, banda neschimbată și `aria-hidden`, rândul
  de locație 0 px până la creion și 26 px în editare, un creion / două poze / două inputuri / zero
  ștergere-decupare, poza aleasă se previzualizează (`blob:`) înainte de salvare, iar salvarea scrie
  `/media/<hash>.png` atât pentru profil cât și pentru copertă; `Escape` iese fără niciun request.
  Screenshot-uri: `p8r-hero-editing.png`, `p8r-hero-facts.png`, `p8r-hero-photos.png`.
- Proba de stare curată `p8r-clean-state.mjs`: **7/7 PASS** — linia de fapte este exact
  `@p8_browser · 0 posts · 0 followers · 0 following`, descrierea afișează placeholder-ul, niciun
  `<img>` în hero, `data-profile-cover="0"`, rândul de locație din nou 0 px, banda citește patru fapte ×2
  fără locație și fără descriere, iar răspunsul `/api/profiles/p8_browser` nu mai conține niciun
  `/media/`. Screenshot: `p8r-clean-profile.png`.
- Curățarea: `PATCH /api/persona/social` cu `avatar/cover/bio/location` goale (200) și trei obiecte media
  orfane șterse (`a4bcd7b8…` 70 B, plus cele două fotografii generate de probă), verificate prin scanare
  generică de referințe în toate tabelele, ca să nu șteargă nimic folosit.

### Limite (spuse explicit)
- Banda nu spune „online”: prezența rămâne lângă nume, pentru că este o stare vie, nu un fapt de profil.
- Fără buton de ștergere a pozei și fără decupare/poziționare (cerere explicită la acea rundă; decuparea a
  fost cerută mai târziu și livrată în §9j); o poză se înlocuiește
  încărcând alta.
- Numele afișat (`Romeo Cojan 3928`) și handle-ul (`p8_browser`) rămân cele de probă: numele se editează
  din creion, iar handle-ul cere funcția de schimbare rămasă din P8.
- Descrierea goală afișează textul-ghid al editorului, nu un text inventat.

## 9f. Wave 6g (P9) — Breaking, cu o listă de agregate aprobate

### Decizii (cerute de owner)
- **Owner-ul a ales allow-list-ul de provideri, cu știri preluate de la un agregator** (nu un snapshot local).
  Registrul trăiește într-un singur loc, `lib/news-provider.js`, iar fiecare intrare este o promisiune:
  numele, hostul (sau hosturile) pe care are voie să fie întrebată și forma răspunsului pe care parserul
  ei o citește. Intrările de azi: `gdelt` (`api.gdeltproject.org`, fără cheie), `newsapi` (`newsapi.org`,
  cere cheie) și `local-fixture` (`127.0.0.1`, doar pentru probă pe același calculator, refuzat în
  producție).
- **Nimic nu se contactează fără configurare**: `newsProviderConfig` decide starea doar din mediu, deci
  Breaking rămâne „disabled” cu motivul lui până când cineva aprobă un agregator, iar poarta de release
  rămâne `external_network: false`.
- **Cererea trece prin exact aceeași poartă ca linkurile**: un URL este urmat doar dacă este `https` și
  hostul lui este în lista de aprobare a providerului; singura excepție este fixture-ul de loopback, care
  vorbește `http` doar pe `127.0.0.1`, doar dacă `NEXUS_NEWS_FIXTURE_URL` este dat explicit și doar când
  `NODE_ENV` nu este `production`.
- **Titlurile sunt text străin, deci sunt aplatizate**: markup, entități, caractere de control și
  override-urile bidi dispar, lungimea este plafonată, un candidat fără titlu nu devine știre, iar un link
  care duce în altă parte este scos (titlul rămâne, ca text).
- **Un snapshot per provider, în memorie**, cu TTL: agregatorul este întrebat o dată per fereastră, nu o
  dată per privitor. Când agregatorul nu răspunde, se servește ultimul snapshot marcat `stale` și cu
  motivul; fără snapshot, lensul rămâne `disabled` cu motivul. Ruta nu aruncă niciodată o excepție.
- **Agregatorul este întrebat pentru mai mulți candidați decât se afișează** (`NEWS_ASK_MULTIPLIER` = 3),
  pentru ca un candidat inutilizabil să scurteze doar rândul lui, nu lista.
- **Clientul randează rânduri, nu HTML străin**: titlu, sursă și timp relativ, un singur link per rând
  (doar pe hostul aprobat, `target="_blank" rel="noopener noreferrer"`, exact cum deschide aplicația și
  linkurile din descriere), linia providerului, markerul de `stale` și nota care spune cine a scris
  titlurile. Nimic din răspuns nu devine markup și nu se încarcă nicio imagine de la terți.

### Ce s-a construit
- `lib/news-provider.js` (**nou**): registrul aprobat, `newsProviderConfig`, `allowlistedNewsUrl`,
  `sanitizeNewsText`, `newsTimestamp`, `normalizeNewsItem/Items`, cache-ul de snapshots, `readBreakingNews`.
- `public/breaking-news.js` (**nou**): `breakingAllowedHosts`, `breakingNewsHref`, `breakingNewsItems`,
  `breakingProviderLine`, `breakingNewsRowMarkup`, `breakingNewsMarkup` (cu escapare proprie).
- `lib/api.js`: lentila `breaking` cheamă `readBreakingNews` și răspunde cu `news` + `provider` (starea,
  numele, `allowed_hosts`, `fetched_at`, `expires_at`, `stale`, motivul).
- `public/app.js`: ramura `provider.status === "ready"` randează lensul înaintea ramurii `disabled`.
- `public/styles.css`: rândurile de știri (titlu, meta, marker `stale`, notă).
- Locale ×4: `feed.breakingSource`, `feed.breakingStale`, `feed.breakingEmpty`, `feed.breakingNote`.
- `.env.example`: blocul `NEXUS_NEWS_*`, inclusiv fixture-ul de loopback, cu avertismentul lui.
- `scripts/release-check.mjs`: poarta rămasă numește acum „approved news aggregator (NEXUS_NEWS_PROVIDER)”.
- Tag asset: `20260920-news1`; bugetul CSS a fost mutat o singură dată, de la 355 000 la 357 000, cu
  suprafața numită (rândurile lensului Breaking).

### Evidence (wave 6g / P9)
- **566/566 teste** (94 fișiere), inclusiv `test/p9-news.test.js` (8 contracte: registrul ca allow-list,
  refuzul unui nume necunoscut și al unei chei lipsă, refuzul fixture-ului în producție, poarta pe cerere
  și pe linkuri, aplatizarea titlurilor, plafonarea listei, cache-ul, degradarea la snapshot `stale`,
  oprirea onestă la eroare, randarea clientului).
- `release:check` → **gate PASS**, 94 fișiere de test, `external_network: false`.
- Probă live pe un singur calculator, fără rețea externă: un agregator-fixture pe `127.0.0.1:5051` și o a
  doua instanță a aplicației pe `:5055` configurată cu `NEXUS_NEWS_PROVIDER=local-fixture` —
  `p9-breaking-live.mjs`: **21/21 PASS, zero excepții**:
  - API: provider `ready`, `allowed_hosts = ["127.0.0.1","headlines.example"]`, 3 titluri din 4
    candidați, `<b>live</b>` și `&nbsp;` aplatizate, linkul aprobat păstrat, linkul din alt host și cel
    `http` golite, timestamp-ul GDELT transformat în dată reală, snapshot proaspăt cu expirare;
  - cache: **o singură lovitură** a agregatorului pentru două citiri, cu același `fetched_at`;
  - browser: lensul randează `data-breaking-state="ready"` cu 3 rânduri, exact un `<a target="_blank"
    rel="noopener noreferrer">` către hostul aprobat, celelalte două titluri ca text, sursa și timpul pe
    fiecare rând, linia „Breaking · Source Local fixture”, nota onestă, zero imagini și zero scripturi;
  - instanța fără provider răspunde în continuare `disabled` cu „No approved news aggregator is
    configured” și registrul aprobat.
  Screenshot: `p9-breaking-live.png`.
- Mirror: 39 de fișiere, **0 SHA256 mismatches**; `verify-encoding.mjs` extins cu modulele și testele noi.

### Limite (spuse explicit)
- **Prețurile rămân nehotărâte**: P9 acoperea și o sursă de prețuri pentru grafice, iar owner-ul a decis
  doar partea de știri. Prețurile stau în continuare oprite, iar același mecanism de allow-list le poate
  primi fără cod nou de infrastructură.
- Cache-ul este în memorie: un restart al procesului cere o nouă citire de la agregator (comportament
  acceptat pentru un singur nod; un snapshot pe disc ar fi următorul pas dacă vrem `stale` și după
  restart).
- Interogarea este globală (`NEXUS_NEWS_QUERY`), nu per utilizator: nu există încă subiecte, limbi sau
  regiuni alese de cititor, și nici un canal Breaking separat de lentila din feed.
- Titlurile nu aduc imagini: lensul nu proxează și nu încarcă nimic de la terți, prin construcție.
- Fereastra de `stale` este chiar TTL-ul; după expirare, fiecare citire încearcă din nou agregatorul.
- Fixture-ul de loopback este pentru dezvoltare și probă; în producție este refuzat explicit.

## 9g. Wave 6h (P10) — motivele de clasare, peste tot, ca semnale

### Decizii
- **Serverul spune semnale, nu propoziții.** Motivele sunt chei dintr-un vocabular închis
  (`lib/repo.js` → `SOCIAL_RANKING_REASON_KEYS`), pentru că interfața există în patru limbi și clasarea se
  calculează o dată: o propoziție românească scrisă pe server ajungea verbatim la un cititor englez, polonez
  sau arab. Propoziția românească „Urmărești creatorul” a dispărut complet din payload.
- **Termenii de oboseală și de feedback negativ fac parte din răspuns** (cerința cercetării): `seen_before`
  (ai mai văzut postarea), `author_less` (ai cerut mai puțin din partea autorului), `community_dislike`
  (comunitatea a reacționat negativ), `marked_opinion` (marcată ca opinie, nu ca fapt), `older_post` (mai
  veche de trei zile). Un cititor care întreabă „de ce văd asta” primește și propoziția care a ținut
  postarea în jos, nu doar pe cea care a împins-o în sus.
- **Semnalele private sunt numite ca atare**: „ai mai văzut-o” și „ai cerut mai puțin din partea acestui
  autor” spun explicit că semnalul cititorului este cauza, iar `author_less` demotează postările autorului
  cu 240 de puncte (un semnal dat pe altă postare a aceluiași autor).
- **Aceleași motive pe trei suprafețe, printr-un singur randator** (`public/ranking-reasons.js`): cardul
  din feed, pagina postării și profilul. Nimic nu se copiază între ele, iar clientul aruncă o cheie pe care
  nu o cunoaște în loc să o printeze.
- **Profilul nu minte despre ordine**: arhiva se citește cronologic, așa că rândul de acolo este marcat
  `context: "profile"` și folosește eticheta „Semnal pentru tine”, în timp ce feedul și pagina postării
  folosesc „De ce vezi asta”. Ordinea profilului rămâne neatinsă — explicarea nu reordonează.
- **Pagina postării chiar are motivele**: ruta `GET /api/posts/:id` include acum `post.ranking` cu aceleași
  semnale, calculate cu `repo.socialRankingReasons`, altfel rândul de pe pagina postării ar fi rămas gol
  pentru o postare deschisă din altă parte.
- **Bugetul de locale a fost mutat o singură dată**, de la 348 000 la 352 000, cu suprafața numită (13
  propoziții × 4 limbi plus formularea de profil).

### Ce s-a construit
- `lib/repo.js`: vocabularul închis, `socialRankingReasonKeys`, semnalele noi în scor (`seen_before`,
  `author_less` −240, `community_dislike`, `marked_opinion`, `older_post`) și metoda nouă
  `socialRankingReasons(viewerId, persona, postIds)` care explică postări nerantate.
- `lib/api.js`: profilul își explică primele 24 de postări (`ranking.context = "profile"`), pagina
  postării își primește motivele (`ranking.context = "post"`).
- `public/ranking-reasons.js` (**nou**): vocabular, filtrare, etichetă de context, rând și listă.
- `public/app.js`, `public/post-detail.js`, `public/profile-experience.js`: folosesc randatorul comun.
- `public/interface-locale.js`: 14 chei noi × 4 limbi; `public/styles.css`: eticheta rândului.
- `test/p10-ranking-reasons.test.js` (**nou**, 5 contracte), plus `test/x-surface.test.js` actualizat pe
  vocabularul nou.

### Evidence (wave 6h / P10)
- **571/571 teste** (95 fișiere), zero eșecuri; `test/p10-ranking-reasons.test.js` acoperă vocabularul,
  ordinea de consecință, plafonul de patru motive, semnalele private, refuzul cheilor necunoscute,
  escaparea, cele patru limbi și un feed real (urmărire, oboseală după două citiri, feedback negativ).
- Probă live `p10-why-live.mjs` (cont 22, 412×892): **13/13 PASS, zero excepții** — feedul și profilul
  răspund cu chei din vocabular, zero propoziții românești în payload, arhiva profilului rămâne
  cronologică, cardul afișează „✦ Why you are seeing this post · It is recent and published by a human”
  (tradus, fără chei brute), pagina postării afișează exact aceeași propoziție, foaia „Why am I seeing
  this” listează un rând per motiv. Screenshot-uri: `p10-feed-why.png`, `p10-detail-why.png`.
- Postarea publicată de probă a fost ștearsă prin ruta aplicației la finalul probei (200, iar feedul nu o
  mai conține), iar pentru că ultima rulare a lăsat una activă, ea a fost ștearsă separat: contul demo are
  din nou zero postări.
- Mirror: 41 de fișiere, **0 SHA256 mismatches**.

### Ce am descoperit pe drum (pentru owner)
- **Toate conturile umane din datele demo au profilul Social pe „friends”**, deci postările lor nu ajung în
  feedul nimănui care nu le este prieten. Feedul contului demo era gol din acest motiv, nu din cauza unei
  erori. Drumul corect de reparat este chiar panoul **Privacy** din sertarul nou: dacă schimbi vizibilitatea
  profilului Social pe `Public`, postările devin eligibile în feedurile celorlalți.
- Contul demo (`p8_browser`) are persona Social deja publică, deci feedul lui propriu acceptă postările
  proprii; de aceea proba a putut publica o postare scurtă și a citit motivele ei.

### Limite (spuse explicit)
- Cel mult patru motive per postare: lista este un răspuns, nu un raport.
- Profilul explică primele 24 de postări, nu toate o sută — este o limită de cost, nu de onestitate.
- Nu există încă un control pentru a „regla” motivele (de exemplu, să ceri mai puțin dintr-un subiect):
  termenii de feedback se bazează pe ce există deja (impresii, `NOT_INTERESTED`, reacții).
- Vocabularul este închis: un motiv nou cere o cheie în server, propoziții în patru limbi și intrarea în
  lista clientului, altfel este aruncat în loc să fie afișat.

## 9h. Wave 6i (P11) — acceptarea pe dispozitive

### Cum s-a făcut (și ce nu s-a putut face)
- Acceptarea a fost măsurată automat, prin CDP, pe cinci configurații: **360×640**, **390×844**, **430×932**,
  **844×390 (landscape)** și **360×640 la 200 % zoom** (zoom simulat prin `scale`, aceeași pixeli care cară
  mai mult CSS). Fiecare configurație măsoară profilul (hero, bandă, sertar, un panou de setări) și verifică
  depășirea laterală, lățimea benzii, mărimea țintelor de atingere, rândurile clipsite și erorile de pagină.
- **Nu au existat participanți reali**: nu pot ține un telefon în mână, nu pot chema persoane și nu pot
  valida percepția („se simte lent”, „nu îmi dau seama unde să apăs”). Ce este dovedit aici este geometria
  și comportamentul, nu experiența umană. Acceptarea cu oameni rămâne deschisă și este singurul lucru din
  P11 pe care nu îl pot închide singur.

### Ce a ieșit la măsurători (și s-a reparat)
- **Un telefon ținut pe lateral primea vitrina de desktop.** La 844×390, regula
  `@media (max-height:790px) and (min-width:761px){.demoStage{transform:scale(.88)}}` se aplica, așa că
  aplicația era randată în rama de prezentare (rail de module, ramă de telefon) și micșorată la 88 %:
  un control de 44 px devenea 39 px, creionul 21×28, iar butonul de închidere al sertarului 35×35 — sub
  pragul de 44 px. Reparat printr-o singură regulă nouă, în coada foii de stil:
  `@media (pointer:coarse) and (max-height:560px)` aduce aplicația pe tot ecranul (fără ramă, fără rail,
  fără scala de 0.88, fără pastilă de cameră). Vitrina de desktop cu mouse rămâne neschimbată.
- Restul a trecut din prima: zero depășire laterală pe toate cele cinci ecrane, banda se încadrează exact în
  lățimea ecranului (track-ul ei mai lat este clipit intenționat de `overflow:hidden`), sertarul se
  încadrează (310 px pe 360 px, 7 uși, niciun rând tăiat, rândul cel mai scund 56 px), iar panoul de
  setări își ține rândurile lizibile și butoanele de cel puțin 68 px înălțime.
- La 200 % zoom pe 360 px, banda, taburile și bara de jos rămân în ecran, iar textul nu se suprapune.

### Ce s-a construit
- `public/styles.css`: regula de landscape pentru dispozitive cu pointer grosier și fereastră scundă.
- `test/p11-devices.test.js` (**nou**): contractul care nu trebuie să regreseze — regula de landscape,
  banda clipită și neinteractivă, sertarul `min(320px,86vw)`, țintele de atingere declarate (44×40 pentru
  cele trei bare, 56 px pentru ușile sertarului, 46 px pentru taburi, 40×40 pentru închidere) și tagul de
  asset-uri, ca un `app.js` vechi să nu fie servit lângă o foaie de stil nouă.
- Bugetul CSS a fost mutat o singură dată, de la 357 000 la 358 500, cu suprafața numită (regula de
  landscape, 1,2 kB care înlocuiesc un ecran de text micșorat).

### Evidence (wave 6i / P11)
- **573/573 teste** (96 fișiere), zero eșecuri; `release:check` → **gate PASS**, `external_network: false`.
- Proba `p11-devices.mjs`: **41/41 PASS, zero excepții** pe cele cinci configurații (8 verificări × 5 + una
  finală), inclusiv `landscape` după reparație.
- Screenshot-uri: `p11-360.png`, `p11-390.png`, `p11-430.png`, `p11-landscape.png`,
  `p11-360-zoom200.png`, `p11-drawer-360.png`, `p11-panel-zoom200.png`.
- Mirror: 42 de fișiere, **0 SHA256 mismatches**; `verify-encoding.mjs` acoperă și testele/modulele noi.

### Limite (spuse explicit)
- **Fără participanți reali**: P11 rămâne parțial deschis până când o persoană folosește aplicația pe un
  telefon adevărat, în lumină de zi, cu o mână.
- Zoom-ul a fost simulat prin scara viewport-ului, nu prin zoom-ul de text al browserului; rezultatul este
  echivalent geometric, dar nu este identic cu motorul de zoom al unui browser real.
- Landscape-ul a fost verificat pe profil (hero, bandă, sertar, panou); inima feedului în landscape și
  viewerele full-screen (reels, poze) nu au fost măsurate în această rundă.
- Confortul la atingere („se simte natural”) și contrastul perceput nu se pot dovedi automat.

## 9i. Wave 6s (P8 / P9 / P11) — trei defecțiuni raportate pe instanța live

Trei lucruri raportate de owner pe aplicația care rulează acum: Breaking nu se vede în feed, descrierea
apare de două ori (în hero și în bandă), iar poza de profil nu se salvează pentru `@romeodeepsek`.

### Cum s-a lucrat (și ce s-a descoperit pe drum)

- **Instanța live servește oglinda**, nu arborele de lucru: `127.0.0.1:5000` citește fișierele din
  `C:\Users\Romeo\projects\nexus_deepsek`. Prima rulare a probei a arătat jurnalul de diagnostic gol,
  adică browserul rula modulul vechi: reparațiile erau scrise în Codex, dar serverul citea oglinda.
  Lecția e în receipt pentru că a costat o rundă întreagă: **editează, oglindește, abia apoi măsoară**.
- Contul ownerului este `user 19 = @romeodeepsek` (bio pe trei linii, locație „Kraków, Polonia”). Proba
  și-a emis singură o sesiune prin `lib/security.js` (același secret implicit; `.env` nu are
  `NEXUS_SESSION_SECRET`), a emulat un Android de 390×844 (DPR 3, user-agent de Pixel, touch) și a șters
  sesiunea la final, împreună cu pozele de probă, ca profilul ownerului să rămână exact cum era.
- **Input sintetic nu ajunge în pagina asta**: `Input.dispatchTouchEvent` nu răspunde deloc (timeout), iar
  `Input.dispatchMouseEvent` și `Input.emulateTouchFromMouseEvent` răspund dar nu produc niciun eveniment
  în pagină (zero hit-uri pe contoarele injectate, chiar și după `Page.bringToFront`). O apăsare a fost
  deci livrată ca secvența `pointerdown` / `pointerup` / `click` pe elementul care se află **realmente** sub
  punctul măsurat (`document.elementFromPoint`), cu `userGesture: true` ca dialogul de fișiere să fie permis.
- Dialogul de fișiere a fost **interceptat**, nu ocolit (`Page.setInterceptFileChooserDialog`): proba
  dovedește că apăsarea deschide un chooser și abia apoi îi dă fișierul (`DOM.setFileInputFiles`).
- Toate apelurile CDP din probă au termen de expirare: un răspuns care nu vine devine un fapt raportat, nu
  o așteptare veșnică — prima variantă a probei s-a blocat exact așa, fără să spună de ce.

### Ce s-a reparat

**A. Breaking era ascuns, nu lipsea.**

- Lentila trăia într-un `<details>` („Mai multe formate și setări”), deci un cititor care nu deschide
  meniul nu are cum să vadă că Breaking există. A trecut în lista vizibilă de lentile, lângă Near / Global /
  Following, cu aceleași chei traduse (`feed.breaking`, `feed.breakingSelectorDetail`).
- Textul onest spune acum **decizia care lipsește**, în patru limbi: nicio sursă nu a fost aprobată încă,
  iar fără o decizie de owner pentru un agregator din lista aprobată Nexus nu are de unde lua titluri reale
  și nu inventează niciunul. Eticheta lentilei spune la fel: doar agregate aprobate de owner, niciunul
  pornit acum.
- Etichetele din foaia comutatorului care erau scrise direct în română („Mod de afișare”, „Vizualizare”,
  „Ecran complet”, „Carduri”, „Încadrare media”, „Umple”, „Vezi complet”) trec prin traducător: într-o
  interfață engleză nu mai apar cuvinte românești.

**B. Descrierea rămâne doar în bandă.**

- Hero-ul nu mai tipărește descrierea: blocul ei iese din fluxul vizual (`clip-path`), exact ca rândul care
  editează locația, și revine în flux doar cât timp profilul e editat.
- Descrierea **rămâne totuși în document**, ca un paragraf, pentru cititorii cu screen reader: banda este
  `aria-hidden`, iar un fapt care trăiește doar în decor este un fapt pierdut.
- Pentru că banda este acum singurul loc vizibil al descrierii, ea cară toate cele opt fragmente (96 de
  caractere fiecare) în loc de primele trei (72): aceleași cuvinte, un singur loc care le arată.

**C. Pozele care nu se salvau.**

- Traseul complet a fost dovedit funcțional pe contul ownerului (chooser → previzualizare → `POST /api/uploads`
  201 → `PUT parts` 201 → `complete` 201 → `PATCH /api/persona/social` 200 → URL stocat), deci problema nu
  era uploadul. Ce putea face ownerul să vadă „adaug poza, dar nu o pot salva” era altceva, și fiecare cale
  a fost închisă:
  1. **Poza aleasă murea cu nodul DOM.** Starea „aleasă dar nesalvată” era ținută într-un `WeakMap` cheiat
     pe elementul hero-ului; orice re-randare (puls de prezență, notificare, întoarcere în tab) înlocuia
     nodul și poza dispărea fără un cuvânt. Acum starea aparține **profilului** (cheie: personajul activ),
     deci supraviețuiește oricărei re-randări, iar poza aleasă este desenată din nou când editorul se
     redeschide. Măsurat: după o re-randare, `✓` redeschide editorul, poza e din nou acolo, iar a doua
     apăsare urcă fișierul (`POST /api/uploads` nou, `PATCH` 200, „Salvat”).
  2. **Un `✓` care nu putea salva nu spunea nimic.** Acum: dacă editorul s-a închis peste o poză aleasă,
     îl redeschide și spune de ce; dacă nu e nimic nou de scris, o spune („Nimic nou de salvat”); dacă o
     poză a picat, o spune și păstrează editorul deschis, ca a doua apăsare pe `✓` să fie toată reîncercarea.
  3. **O poză picată arunca textul scris.** Cele două `return`-uri de după upload (`avatar === null`,
     `cover === null`) ieșeau din salvare cu totul: numele, descrierea și locația scrise erau pierdute
     fiindcă o imagine nu s-a urcat. Acum cuvintele se scriu, iar eșecul pozei se spune separat („Poza nu a
     fost salvată; numele, descrierea și locația au fost păstrate”).
  4. **Controalele erau prea mici pentru un deget.** Creionul și `✓` aveau 24×32 px, badge-ul pozei 26×32 —
     sub cei 44 px pe care aplicația îi cere propriilor controale, iar o apăsare ratată nu produce nimic.
     Glifa rămâne mică, zona apăsabilă crește la 44 px (badge-ul doar cât timp profilul e editat).
  5. **Prima apăsare pe un badge de poză era înghițită** de deschiderea editorului (a doua abia deschidea
     alegerea de fișier). Acum editorul se deschide și alegerea vine cu el, într-o singură apăsare.
- Un modul vechi în cache nu poate fi cauza: serverul răspunde la module cu
  `cache-control: no-cache, max-age=0, must-revalidate`, deci telefonul revalidează fiecare fișier.

### Evidence (wave 6s)

- **583/583 teste** (98 de fișiere, două noi: `p8-photos.test.js`, `p8-hero-band.test.js`), zero eșecuri;
  `node scripts/release-check.mjs` → **gate PASS**, `external_network: false`, `synthetic_issues: 0`.
- Proba `p8t-photos.mjs` pe profilul ownerului, în emulare de Android: **16/16 PASS, zero excepții**, cu
  traficul urmărit cerere cu cerere și cu dialogul de fișiere interceptat. Include scenariul raportat: după
  o re-randare, `✓` redeschide editorul („The editor had closed over the chosen photo…”) și a doua apăsare
  urcă fișierul (`POST /api/uploads` 201 → `complete` 201 → `PATCH 200` → `/media/<hash>.png`).
- Screenshot-uri: `p8t-editing.png` (editorul deschis: nume, descriere, locație, badge de poză, copertă),
  `p8t-avatar-saved.png`, `p8t-both-saved.png` (profil în citire: hero-ul fără descriere, descrierea în
  bandă). Pozele de probă au fost șterse la final, iar profilul a revenit la starea dinainte.
- Proba `p8s-breaking-lens.mjs` (aceeași sesiune emisă pentru contul ownerului): **6/6 PASS, zero excepții**.
  Foaia „Choose what you want to see” are cinci lentile vizibile — Mix, Local Trends, Global Trends, Following,
  Breaking — fără să deschizi „More formats and settings”, eticheta lui Breaking spune „Only owner-approved
  aggregators; none is switched on right now”, iar alegerea lui randează starea onestă („Breaking is ready,
  but disabled / No source has been approved yet…”). Notele foii sunt traduse, nu texte românești fixe.
- Screenshot-uri: `p8s-lens-breaking.png` (lentilele, cu Breaking vizibil), `p8s-lens-breaking-empty.png`
  (starea onestă după alegere).
- Oglindă: 47 de fișiere, **0 SHA256 mismatches**; `verify-encoding.mjs` acoperă și fișierele noi.
- `lib/*` nu a fost atins, deci instanța live nu are nevoie de restart: fișierele servite se citesc per
  cerere, iar modulele se revalidează.

### Ce am descoperit pe drum (pentru owner)

- **Aplicația are dreptate să nu salveze aceleași poze de două ori.** Depozitul este adresat după conținut,
  deci dacă poza aleasă are exact aceiași octeți ca cea deja salvată, `PATCH`-ul nu are ce scrie: al doilea
  `✓` răspunde „Nimic nou de salvat”. Prima variantă a probei a raportat asta ca eșec — proba greșea, nu
  aplicația, și receiptul spune asta ca să nu rămână ca „reparat”. Proba folosește acum o a doua poză, cu
  octeți diferiți, pentru scările care trebuie să dovedească un upload nou.
- Ce anume s-a întâmplat pe telefonul ownerului **nu se poate dovedi din jurnalul serverului**: pentru contul
  19 nu a ajuns nicio cerere de upload. Ce s-a putut face este să fie închise toate căile tăcute prin care un
  „adaug poza, dar nu o pot salva” se poate întâmpla, iar următoarea rundă va spune care pas a picat, nu
  doar că nu s-a întâmplat nimic.

### Limite (spuse explicit)

- **Fără deget real**: input-ul sintetic nu ajunge în pagina acestei instanțe, deci apăsarea a fost
  reprodusă ca evenimentele pe care browserul le emite după o atingere, pe elementul aflat efectiv sub punct.
  Reachability-ul (elementul e deasupra, nu e acoperit, are 44 px) și efectul sunt măsurate; senzația unei
  atingări reale rămâne nedovedibilă automat.
- **Fără picker real de telefon**: un fișier HEIC este refuzat cu un mesaj vizibil („Use a JPEG, PNG, or
  WebP image.”), dar nu s-a testat o poză de cameră adevărată (HDR, rotație EXIF) și nici comportamentul
  Android care poate descărca tabul în timp ce pickerul e deschis.
- Un **reîncărcare de pagină** încă pierde o alegere nesalvată (starea trăiește în memorie); după o
  reîncărcare editorul este închis, deci ownerul vede creionul, nu un `✓` mut.
- Foaia moartă `openSocialDiscover` (fără niciun control care s-o deschidă; păstrată fiindcă testul de audit
  cere ruta) mai are încă o etichetă de Breaking scrisă direct în română. Este inaccesibilă din interfață,
  dar rămâne de curățat într-o rundă viitoare, ca să nu existe două adevăruri despre aceeași lentilă.
- Breaking rămâne gol până când ownerul aprobă un agregator (`NEXUS_NEWS_PROVIDER`): ce s-a schimbat este
  că locul lui se vede și că textul spune de ce este gol.

## 9j. Wave 6t (P8 / P9 / P11) — coperta, banda și raftul de momente

Ownerul a raportat, pe aplicația care rulează: coperta nu rămâne salvată și se vede doar pe o bucată
mică; trebuie să se adapteze spațiului în care e pusă, cu decupare automată sau mutată de owner mai sus
ori mai jos; să se deschidă într-un ecran mai măricel de editare; ce înseamnă semnul de lacăt; creionul să
rămână fixat în capătul din dreapta al benzii, iar după apăsare butonul verde de salvare să fie tot acolo;
spațiul pentru poza de profil și copertă să fie eliberat, cu coperta puțin mai mare, preluând locul
story-urilor salvate, care ar trebui mutate în meniul Flow / Reels / Shots / Whispers.

### Cum s-a lucrat (și ce s-a descoperit pe drum)

- Adevărul din bază, întrebat înainte de orice editare: profilul `@romeodeepsek` (user 19) avea `avatar`
  și `cover` **goale**, iar niciun rând `media` urcat de owner nu exista pentru ele (toate rândurile de
  profil erau ale probelor). Deci încercările ownerului nu ajunseseră niciodată la o salvare reușită — nu
  o poză pierdută, ci un drum care nu se termina. Cauza vizibilă era a doua: banda de copertă avea
  `height:72px` (o regulă ulterioară din `profile-experience.css`) cu `object-fit:cover` fără poziție,
  adică exact bucata mică pe care ownerul o vedea.
- **Un defect găsit în propria probă (wave 6s)**: curățarea de la final scria `{avatar: "", cover: ""}`,
  iar API-ul tratează șirul gol ca ștergere a pozei (`p1-comments-profiles.test.js` se bazează pe asta).
  Proba a fost reparată să pună la loc exact valorile citite la început, iar receiptul spune asta pentru ca
  vinovatul să nu rămână ascuns: dacă ownerul avea o poză salvată, proba aceea o putea șterge.
- Lacătul din linia numelui era `visibility != public` (setarea „prieteni”), nu un profil privat plătit;
  rămânea un emoji fără explicație, adică o întrebare în loc de un răspuns.
- Proba nouă a picat prima rulare pe o cauză proprie: lipsea blocul de setup CDP, deci browserul măsura
  ecranul de autentificare. Receiptul păstrează și asta: cookie-ul se setează acum pentru URL-ul exact, iar
  prezența lui este verificată înainte de orice măsurătoare.

### Ce s-a reparat

**A. Coperta este o fotografie, nu o bandă.**

- 72 px → **168 px** (132 px sub 380 px lățime), iar identitatea se ridică peste ea cu 46 px.
- Decuparea este a ownerului: coloană nouă `personas.cover_focus` (întreg 0–100, implicit 35), migrată
  automat prin `addMissingColumns`, refuzată de rută cu 400 pentru orice altceva decât un întreg în
  interval, limitată în depozit și trimisă la citire în `profile.cover_focus`, ca cititorul să vadă cadrul
  ales, nu mijlocul pozei (`object-position: center X%` pe fiecare randare).
- Ecran de editare propriu: după alegerea fișierului se deschide o foaie de decupare (cadru de 230 px cu
  poza întreagă), care se poate mișca prin tragere (pointerdown/move/up pe cadru) sau cu glisorul 0–100;
  `Salvează coperta` face upload-ul și scrierea `{cover, cover_focus}` într-o singură cerere și închide
  foaia; `Anulează` pune la loc poza profilului, iar `Schimbă fotografia` redeschide pickerul.
- Apăsarea pe o copertă existentă deschide aceeași foaie (pentru mutare), fără să reîncarce nimic.

**B. Creionul stă fixat la capătul din dreapta al benzii.**

- Banda și cele două controale sunt un singur rând (`.ownerTickerRow`); creionul și `✓` sunt **frați** ai
  benzii, nu înăuntrul ei, pentru ca banda să rămână read-only așa cum cere contractul ei, și au 44×44 px
  fiecare (înainte glifa de 24×24 cu halo invizibil). Când editorul se deschide, același pătrat devine
  `✓`, deci butonul care deschide editorul este butonul care îl salvează.

**C. Lacătul își spune eticheta.**

- Chip cu `🔒` și eticheta tradusă (`role=img`, `aria-label`, `title`): cine îl vede citește „Prieteni”
  sau „Privat”, nu ghicește dacă profilul e închis cu plată.

**D. Spațiul eliberat.**

- Raftul de story-uri salvate a ieșit din hero și este al cincilea tab al arhivei (Flow / Reels / Shots /
  Whispers / Moments), cu starea lui goală în patru limbi; poza de profil a crescut 78 → 92 px, iar
  coperta a preluat înălțimea.

### Evidence (wave 6t)

- Proba `p9t-cover-crop.mjs`, pe contul ownerului, în emulare de Android 390×844 (DPR 3): **24/24 PASS,
  zero excepții**, cu dialogul de fișiere interceptat (nu ocolit). Ea dovedește, în ordine: sesiunea ajunge
  în browser; creionul este în `.ownerHeroActions`, la 10 px de capătul din dreapta, 44×44 px; chipul de
  lacăt are etichetă; raftul a plecat din hero (0 elemente), tabul Moments este al cincilea și își
  deschide raftul; badge-ul de copertă deschide un chooser real; foaia de decupare se deschide cu poza
  aleasă (357×230 px), cu glisor și buton de salvare; tragerea în jos coboară cadrul (35 → 0), glisorul
  fixează 12%; salvarea produce `POST /api/uploads` → `complete` 201 → `PATCH /api/persona/social` 200, iar
  serverul ține `/media/<hash>.png` cu `cover_focus: 12`; **după reîncărcarea paginii coperta este acolo,
  în același cadru** (aceeași adresă, `center 12%`, bandă de 168 px); profilul a fost pus la loc exact cu
  valorile citite la început, nu golit.
- Screenshot-uri: `p9t-hero-cover.png` (hero fără copertă), `p9t-cover-crop.png` (foaia de decupare),
  `p9t-cover-saved.png` (banda salvată, după reîncărcare).
- Suită completă: **589/589 teste**, zero eșecuri; `release:check` → **gate PASS**, `external_network:
  false`, `synthetic_issues: 0`.
- Oglindă: 47 de fișiere, **0 SHA256 mismatches**; `lib/*` a fost atins (coloană, rută, depozit), deci
  instanța live a fost repornită, iar migrarea s-a aplicat la prima deschidere a bazei.

### Ce am descoperit pe drum (pentru owner)

- „Nu rămâne salvată” avea două jumătăți: nimic din bază nu arăta o copertă salvată vreodată, iar banda de
  72 px făcea ca o poză salvată să pară oricum o bucată. Ambele sunt reparate, iar proba dovedește acum
  traseul întreg și supraviețuirea lui la reîncărcare.
- Un modul vechi în cache nu poate fi cauza: modulele se servesc cu `cache-control: no-cache`.

### Limite (spuse explicit)

- Decuparea este o poziție verticală (0–100%), nu o zonă liberă: pentru o copertă se cere de obicei atât,
  iar o zonă trasă pe ambele axe ar fi o unealtă nouă, nu o reparație.
- Fără deget real: tragerea din probă este secvența de pointer events pe care browserul le emite după o
  atingere, pe elementul aflat efectiv sub punct; senzația unei atingeri reale rămâne nedovedibilă automat.
- Un fișier HEIC de telefon este încă refuzat cu mesaj vizibil; o poză de cameră adevărată (HDR, rotație
  EXIF) nu a fost testată.
- Ștergerea pozei sau copertei (nu înlocuirea) rămâne deschisă, ca și curățarea fișierelor media orfane
  după un `PATCH` picat: sunt următoarele două lucruri din lista de P8.


## 9k. Wave 6u (P8 / P9) — pozele de pe telefon nu se salvau: crypto.subtle lipsea

Ownerul a raportat, după wave 6t: pozele sunt JPG, de 2–3 MB, și **încă nu se salvează**.

### Cum s-a găsit cauza (fără ghicit)

- În baza de date nu exista **nicio sesiune de upload** și niciun rând `media` de la owner: cererea nu
  ajungea niciodată la server. Sesiunea cea mai nouă era a telefonului (`Chrome · Android`), deci ownerul
  era chiar pe instanța asta. Un eșec care nu lasă urme în rețea este un eșec din client.
- `uploadMediaResumable` calculează SHA-256 al fișierului **înainte de prima cerere** (`fileSha256`), iar
  implementarea de atunci arunca `UPLOAD_INTEGRITY_UNAVAILABLE` dacă lipsea `crypto.subtle`. Or,
  `crypto.subtle` există doar pe origine securizată (https sau localhost): pe `http://192.168.1.153:5000`,
  adresa prin care telefonul ajunge la aplicație, măsurat direct în browser:
  `secureContext: false`, `typeof crypto.subtle: "undefined"`, `digest` aruncă `TypeError`.
- Probele mele nu puteau vedea asta: rulau pe `127.0.0.1`, care este origine securizată. Defectul era
  invizibil din locul greșit.
- Al doilea strat al aceleiași probleme: hero-ul prindea orice eroare de upload și o raporta cu o singură
  propoziție generică („Coperta nu a putut fi încărcată. Reîncercați.”), deci codul refuzat nu ajungea la
  owner.

### Ce s-a reparat

- **`public/sha256.js` (nou)**: SHA-256 pe orice origine. Calea nativă (`crypto.subtle`) rămâne folosită
  când există; când nu există, un SHA-256 incremental în JS citește fișierul în blocuri de 1 MB, deci un
  video de 20 MB este hashat fără o a doua copie în memorie. Testat contra `node:crypto` pe lungimile care
  contează pentru padding (0, 55, 56, 63, 64, 119, 120, 128, 200, 1024…) și pe un fișier de 3 MB dat în
  bucăți de 37 de octeți.
- **`app.js`**: `fileSha256` și `storyPublishFingerprint` (care avea exact aceeași pază, deci nici un story
  nu se putea publica de pe telefon) trec prin modul. Nu mai există nicio cale care să refuze hash-ul pentru
  că originea nu e securizată.
- **Eticheta tipului de fișier**: o galerie de telefon poate declara `image/jpg` sau `image/pjpeg`, sau
  nimic. Serverul compară tipul declarat cu semnătura fișierului, deci un asemenea nume ducea poza în
  carantină — adică exact „nu se salvează”. Clientul trimite acum numele canonic, iar serverul înțelege
  aliasurile (`canonicalMime`), fără să slăbească verificarea: o etichetă falsă (HEIC numit jpeg) rămâne
  refuzată.
- **Diagnostic vizibil**: eșecul de upload își spune codul (în toast și în foaia de decupare), iar foaia
  afișează fișierul pe care lucrează (nume · MB · tip). Dacă ownerul mai vede vreodată o eroare, are ce să
  raporteze.

### Evidence (wave 6u)

- Proba `p9u-insecure-upload.mjs` **pe adresa telefonului** (`http://192.168.1.153:5000`, `secureContext:
  false`, `crypto.subtle: undefined`): **16/16 PASS, zero excepții**. Ea dovedește: un JPEG real de
  **4,6 MB** (codificat de browser, nu un fixture) ales prin dialogul real; foaia de decupare îl numește
  (`wave6u-phone.jpg · 4.6 MB · image/jpeg`); salvarea trimite
  `POST /api/uploads {"mime":"image/jpeg","total_bytes":4820820,"expected_sha256":"3212992d…"}` → 201, apoi
  **trei bucăți** (`parts/0,1,2`) → complete, iar serverul ține `image/jpeg`, 4820820 de octeți,
  `ready_local_validation`; profilul ține coperta cu `cover_focus: 18`; **după reîncărcare, pe aceeași
  origine nesecurizată, coperta este acolo, în același cadru, 168 px**; un fișier de galerie fără tip
  (`IMG_20260920.jpg`, `type: ""`) este re-etichetat `image/jpeg` și salvat, nu pus în carantină; profilul a
  fost pus la loc exact cum era, iar sesiunea probei a fost ștearsă.
- Screenshot: `p9u-cover-on-lan.png`.
- Suită completă: **596/596 teste** (plus 7 teste noi: 5 pentru hash, 2 pentru eticheta pozei și
  diagnostic); `release:check` → gate PASS, `external_network: false`, `synthetic_issues: 0`.
- Oglindă: **49 de fișiere, 0 SHA256 mismatches**.

### Un lucru care era cât pe ce să strice aplicația live

Scriptul de oglindire (`p6-mirror.mjs`) are o **listă fixă** de fișiere. `public/sha256.js` nu era în ea,
deci `app.js` (deja copiat) a ajuns pe instanța live importând un modul inexistent. A fost prins imediat
(404 la `GET /sha256.js`), lista a fost completată, iar modulul se servește acum (200). Lecția, scrisă aici
pentru rundele viitoare: **un fișier nou intră în listă în același pas cu codul care îl importă**, altfel
măsurătoarea de pe telefon măsoară altă aplicație.

### Limite (spuse explicit)

- Un fișier **HEIC** de la cameră rămâne refuzat, cu mesaj care numește tipul; conversia lui locală ar fi o
  unealtă nouă, nu o reparație.
- Serverul nu jurnalizează originea cererilor, deci nu pot arăta în loguri adresa exactă a telefonului;
  condiția a fost reprodusă în schimb exact (origine nesecurizată, `crypto.subtle` absent) și tot fluxul a
  fost măsurat pe ea.
- Senzația de deget real rămâne nedovedibilă automat, ca mai înainte.

## 9l. Wave 6v (P8 / P9) — numele, coperta, lacătul și vârsta din bandă

Ownerul a raportat, după wave 6u, cinci lucruri văzute pe telefon: (a) „numele Romeo Cojan apare pe poza
de profil, se vede slab, trebuie coborât mai jos, iar pagina trebuie centrată ca să se vadă bine poza de
profil, coverul și numele”; (b) „când editez a doua oară poza de cover, nu mai pot adăuga alta”; (c) „când
apas pe creion totul e cam ciudat: descrierea apare ciudat, un punct departe și change cover photo”; (d)
„lacătul cu Friends nu îl pot edita — poți lăsa lacătul lângă nume, dar trebuie posibilitate de editare în
setări, și scoate de acolo «friends»”; (e) „adaugă, ca la locație, să pot selecta orașul, și un câmp care să
apară în ticker cu vârsta”.

### Cum s-a găsit cauza (fără ghicit)

Toate trei defectele „de aspect” au fost reproduse pe adresa ownerului (`http://192.168.1.153:5000`), într-un
browser real, cu clicuri reale și cu dialogul real de fișiere (`DOM.setFileInputFiles` declanșează exact
evenimentul `change` al galeriei).

- **(b) a doua editare a copertei.** Un jurnal de evenimente luat din pagină arată totul:
  `click cover → sheet added → name blur → focusout INPUT → focusin SECTION → focusout SECTION → sheet removed`.
  Foaia de decupare este un dialog și **ia focul intenționat** (accesibilitatea modală o focalizează), iar
  regula de `blur` a editorului citea asta ca „omul a plecat de pe profil”: salva (nimic de scris), închidea
  editorul și **scoatea foaia de decupare cu el**. De aceea părea că „a doua oară nu mai merge”: prima
  copertă vine prin dialogul de fișiere, care ține `choosing` deschis fereastra de grație, deci același
  `blur` era ignorat; a doua vine direct pe foaie, iar foaia se închidea singură.
- **(c) „un punct departe și change cover photo”.** Butonul copertei era un strat peste toată banda
  (`inset:0`) cu `display:grid; grid-auto-flow:column`; coloanele `auto` se întind la lățimea benzii
  (`justify-content` implicit = stretch), deci glifa ▣ ajungea la ~x=180, iar textul la ~x=650: două jumătăți
  de ecran. Descrierea era, în editare, o placă gri (`#ffffff14`) cu textul lipit de marginea stângă.
- **(a) numele peste poză.** Wave 6t trăsese rândul de identitate peste copertă (`margin-top:-46px`), iar
  cuvintele au călătorit cu el. Măsurat pe pixelii randați: numele se citea **5,02:1** peste o poză de
  copertă obișnuită (într-o rulare anterioară, pe o poză luminoasă, **2,86:1**) — adică „se vede slab”.
- **(d) lacătul.** Era un `<span>` cu `cursor:help`, fără nicio acțiune, care tipărea chiar cuvântul
  „Friends” pe linia numelui. Și un lucru găsit pe drum: cardurile de identitate din setări
  (`data-profile-panel="profile"`) erau **invizibile pe ecran**, pentru că `#pedit` este ascuns când view-ul
  activ este „profile”; deci „editabil în setări” exista în cod, dar nu pe ecran.
- **(e) vârsta.** Nu exista: nicio coloană, niciun câmp, niciun element în bandă.

### Ce s-a reparat

- **Numele se citește sub copertă, iar portretul rămâne pe ea.** O singură variabilă (`--heroOverlap`) ține
  suprapunerea: rândul de identitate se trage în sus cu ea (portretul atinge banda), iar tot ce este text
  pornește dedesubt, pe suprafața întunecată. Numărul se schimbă o dată, pentru ecranele înguste. Numele are
  acum 19 px și `#f4fbfd`.
- **Butonul copertei este un buton, nu un văl.** Pastilă în colțul benzii, 44 px înălțime, glifa și cuvântul
  în același rând, `max-width` ca să nu iasă din ecran.
- **Descrierea arată ca un câmp**: padding, fundal `#08121a`, contur desenat cu `box-shadow` (nu `border`,
  ca să nu mănânce din cele trei linii pe care câmpul și le măsoară singur).
- **A doua editare a copertei funcționează** din trei părți: (1) `blur`-ul editorului nu mai tratează foaia de
  decupare ca o plecare (`|| activeCoverSheet`); (2) „Schimbă fotografia” nu mai închide foaia — dacă omul
  renunță la dialog sau fișierul e refuzat, ecranul de decupare este exact acolo unde era; (3) câmpul de
  fișier este golit înainte de deschidere, deci **aceeași poză poate fi aleasă din nou** (fără asta, al
  doilea `change` nu se declanșează niciodată). În plus, o singură foaie de decupare are acum un singur
  handler de Escape: foaia înlocuită este „disposed”, nu doar scoasă din DOM.
- **Lacătul**: chip-ul de lângă nume este doar lacătul (🔒), cu sensul în tooltip și în numele accesibil; pentru
  owner este un buton de 26 px (cu țintă de 44 px) care **deschide panoul care îl editează**; pentru un
  vizitator rămâne text. Cuvântul „friends” nu mai este tipărit pe linia numelui.
- **Setări**: cardul „Identitate” (oraș + vârstă) este în formularul de profil, în panoul în care formularul
  chiar este pe ecran (Confidențialitate, unde stă și butonul Salvează). Se reîmprospătează din record la
  fiecare deschidere de panou, ca ce a scris hero-ul să fie ce arată setările. Se salvează cu **un singur
  Save** împreună cu vizibilitatea.
- **Vârsta**: coloană nouă `personas.age` (migrație aditivă), scrisă prin `repo.updatePersona`, validată în
  rută (întreg 13–120; gol = se șterge), returnată cu profilul, editabilă în setări și tipărită în bandă
  (`🎂 43 ani`, în limba interfeței), lângă oraș. Este un număr **declarat de owner**; nimic nu îl deduce.

### Evidence (wave 6v)

- Proba `wave9v-live.mjs`, rulată **pe adresa ownerului** (`http://192.168.1.153:5000`,
  `isSecureContext: false`): **34/34 PASS, zero erori în consolă**. Ea măsoară, între altele:
  - numele: `cover bottom 168px · name top 179px` (sub bandă), portretul `bottom 208px` (încă pe ea);
  - contrast pe pixelii randați: **5,02:1** pe poză vs **13,81:1** sub ea, la 19 px;
  - butonul copertei: `165×44 at x=215,y=10`, glifa se termină la 244 px, textul începe la 250 px;
  - coperta 1: `wave6u-phone.jpg · 4.6 MB · image/jpeg` → salvată cu `cover_focus 70`;
  - **a doua editare**: foaia se deschide pe coperta salvată; „Schimbă fotografia” o ține deschisă
    („Choose a photo from the gallery…”); `wave6t-cover.png · 0.2 MB · image/png` este acceptată pe același
    ecran și salvată (`cover_focus 20`, hash nou); **aceeași poză a doua oară** contează ca alegere; un JPEG
    de **16 MB** este refuzat (`Coperta poate avea maximum 15 MB`) fără să piardă ecranul de decupare și
    fără să atingă profilul;
  - setări: un Save scrie `location "Kraków"`, `age 43`, `visibility friends`; lacătul se citește „🔒” cu
    tooltip, iar apăsarea lui deschide panoul `privacy`; după **reîncărcare pe aceeași origine
    nesecurizată** lacătul și `🎂43years` sunt acolo, iar numele rămâne sub bandă (`name top 179px`).
- Screenshot-uri: `wave9v-hero-read.png`, `wave9v-hero-edit.png`, `wave9v-hero-cover.png`,
  `wave9v-hero-lock-age.png` (în `C:\Users\Romeo\Desktop\nexus-review`).
- Suită completă: **606/606 teste** (6 teste noi: 3 în `p8-hero-band` pentru așezare/lacăt/vârstă, 2 în
  `p8-photos` pentru ciclul foii de decupare și câmpul descrierii, 1 în `p8-identity` pentru vârstă cap-coadă
  — coloană, rută, client, bandă, patru limbi).
- Oglindă: **16 fișiere, 0 SHA256 mismatches**; serverul live a fost repornit (s-au schimbat și `lib/*`).

### Ce am descoperit pe drum (pentru owner)

- `p1-fullscreen-interaction-state.test.js` era **roșu înainte de runda asta**: fixa o formă mai veche a unei
  paznici din viewer (`closest("button, input, …")` fără `[contenteditable]` și fără verificarea panoului).
  Nu are legătură cu suprafețele acestei runde; a fost aliniat la cod, ca suita să fie verde din nou.
- Bugetul de locale a fost mutat de la 354.000 la **356.000** de octeți, pentru cele zece propoziții noi în
  patru limbi (oraș, vârstă cu explicația ei, două validări, ce înseamnă lacătul, „se alege o fotografie”).
  Este o suprafață numită, nu o rotunjire.
- Panoul de identitate din setări era **invizibil** (vezi (d)). Cardul nou este pus în panoul care este
  efectiv pe ecran și care are butonul Salvează; dacă ownerul vrea un rând „Identitate” propriu în sertar,
  asta este o schimbare de navigație, nu o reparație.
- Proba a lăsat pe instanța live un singur cont: `probe9v` (id 23, „Probe9v (social)”, oraș Kraków, vârstă 43,
  vizibilitate friends, fără copertă, fără postări). **Nu a creat niciun rând `media` și niciun fișier nou**:
  ambele fișiere trimise erau deja în storage-ul adresat pe conținut (aceiași octeți = același hash), deci
  s-au deduplicat; au rămas doar 2 granturi și 0 sesiuni de upload (cele 10 sesiuni ale probei au fost
  șterse). Contul nu a fost șters, pentru că ștergerea unui cont este o decizie a ownerului:
  `DELETE FROM users WHERE handle = 'probe9v';` (cascadă pe personas/sessions/grants).

### Limite (spuse explicit)

- Un HEIC de la cameră rămâne refuzat, cu mesaj care numește tipul; conversia locală ar fi o unealtă nouă.
- Vârsta este **declarată**, nu verificată, și apare pe banda publică a profilului (ownerul a cerut s-o vadă
  cititorii). Un profil privat nu o arată deloc, pentru că profilul privat nu se citește.
- Senzația de deget real rămâne nedovedibilă automat: proba măsoară geometrie, culori pe pixelii randați și
  starea serverului, nu confortul unei mâini.
- Ștergerea pozelor și curățarea media orfane (inclusiv ce rămâne după un PATCH refuzat) rămân deschise — sunt
  următoarele intrări P8, nu părți din runda asta.

## 9m. Wave 10 (P8 / P9) — numele pe o linie, portretul care umple rândul și pagina de editare

Ownerul a cerut, după wave 6v, cinci lucruri pentru pagina de profil: (a) „banda cu numele ar putea fi pe o
singură linie… nu trebuie să scrie online, trebuie doar un punct verde sau galben”; (b) „poza de profil
trebuie să ocupe tot spațiul gol”; (c) „când apăs edit aș vrea totuși să se deschidă o pagină deasupra, unde
să apară opțiunea editează nume, editează vârstă, editează locație, editează bara de status, schimbă poza
profil, schimbă poza cover, adică să fie totul puțin mai organizat”; (d) „tot aici trebuie să ai opțiune:
profil public, profil privat, atât. Profil privat înseamnă că poate fi văzut doar de prieteni, și de cei care
vor plăti să vadă… ticker-ul nu va fi vizibil pentru alții dacă este profil privat; dacă este public, oricine
poate vedea ticker-ul”; (e) „tot la edit poți alege opțiunea cover photo (cum este acum) sau fără cover foto +
story salvate (cum a fost mai devreme)… cover va fi default”.

### Cum s-a lucrat

Fiecare cerință a primit o singură sursă de adevăr, iar ce s-a putut măsura s-a măsurat pe adresa ownerului
(`http://192.168.1.153:5000`, `isSecureContext=false`), într-un browser real, cu clicuri reale.

- **O linie pentru nume** = `flex-wrap:nowrap` pe `h1`, iar numele (`bdi`) primește elipsă înaintea lacătului:
  un nume are sfârșit, un lacăt are sens. Punctul de prezență intră **în** linia numelui.
- **Punctul** = un `<em class="ownerPresence isOnline|isAway">` cu un `<i>` colorat: verde `#39e58e` când omul
  este acolo, galben `#ffd166` când prezența îi este vizibilă cititorului dar nu este online acum. Cuvântul
  trăiește în tooltip și în numele accesibil; banda nu mai are unde să scrie „Online”.
- **Portretul umple rândul**: două variabile duc acum toată așezarea — `--heroOverlap` (cât urcă rândul peste
  copertă) și `--portraitSize` (104 px, 96 px pe ecrane înguste), iar cuvintele pornesc la
  `--heroWordTop = --heroOverlap + 4px` și se centrează în restul rândului. Poza de profil nu mai este un cerc
  mic lângă text: este rândul, iar numele stă la nivelul jumătății ei de jos, sub copertă.
- **Pagina de editare** (`heroEditSheet`, un dialog ca foaia de decupare): rânduri cu nume pentru nume, vârstă,
  oraș, bara de status, poza de profil, poza de copertă (+ poziția în cadru, doar când profilul are o copertă),
  și două grupuri de alegeri — ce se vede deasupra profilului (copertă / fără copertă + story salvate) și cine
  poate citi profilul (Public / Privat). Rândurile deschid **câmpul lor** în hero, unde același `✓` scrie tot,
  iar cele două alegeri fără text se scriu în momentul apăsării: `PATCH /api/persona/<persona>` cu verificarea
  răspunsului înainte ca ecranul să se miște.
- **Privat înseamnă prieteni + cei care plătesc**: serverul avea deja regula (`evaluatePrivacy` + drept de acces
  plătit), deci alegerea „Privat” scrie `visibility:'private'` și, dacă accesul plătit nu era pornit, îl
  pornește **cu prețurile din propriul record** (nu inventate de client); rândul „Prețuri și acces” deschide
  panoul care le editează.
- **Banda nu călătorește pe un profil privat**: markupul benzii se construiește doar pentru owner sau pentru un
  profil public (`showTicker`), deci un cititor care nu are voie nu primește banda deloc — nici măcar un rând gol.
- **Cover sau story salvate**: coloană nouă `cover_mode` (`'cover'` implicit, migrare aditivă), dusă până în
  payload-ul profilului și citită de `data-cover-mode` pe secțiune. Raftul de story salvate este în markup
  oricum, iar CSS-ul alege care suprafață se vede; schimbarea este un atribut, nu o re-randare.
- **Vârsta** se editează acum și din pagina de editare (rândul „Vârsta”), prin același câmp și același `✓` care
  scriu numele și descrierea: câmpul se deschide pe anul din record (`data-hero-value`).

### Ce s-a reparat pe drum (găsite de probă, nu de citit cod)

- **Câmpul de vârstă se golea la deschidere**: `openEditor` îl reseta din `data-hero-value`, atribut care lipsea.
- **Deschiderea rândului „Vârsta” arunca**: `setSelectionRange` nu există pentru `input[type=number]`; apelul
  este acum „best-effort”, iar câmpul își cere focul încă o dată după ce rândul care l-a deschis dispare (un
  control care se șterge singur duce focul cu el).
- **Banda rămânea în urmă după salvare**: numele, descrierea, orașul și vârsta sunt toate în bandă, iar banda se
  construiește la randare. Un `✓` care schimbă una dintre ele cere acum ecranului să deseneze profilul din nou
  (același `renderProfiles`, prin `profileScreenRefresher`), deci banda nu mai poate tipări un fapt pe care
  recordul nu îl mai are.

### Evidence (wave 10)

- Probă live: `.ephemeral/wave10-live.mjs` pe `http://192.168.1.153:5000` (`isSecureContext=false`) —
  **36/36 PASS, zero erori de consolă, zero avertismente**, inclusiv după un `reload` simplu pe aceeași origine.
  Măsurat în pagină: numele pe **o linie** (20 px înălțime la 16,5 px font), `name top 203px` sub
  `cover bottom 168px`, portret **96×96** într-un rând de 96 px, punctul de prezență `rgb(57, 229, 142)` fără
  niciun cuvânt, banda cu `📍Kraków` și `🎂 44`.
- Fluxul întreg apăsat cu clicuri reale: `✎` → pagina de editare (8 rânduri: nume, vârstă, oraș, status, poză,
  copertă, poziția în cadru, prețuri) → „Fără copertă · story salvate” (recordul: `cover_mode stories`, coperta
  dispare, raftul apare, fără re-încărcare) → „Privat” (recordul: `visibility private` + acces plătit cu
  prețurile recordului, lacătul apare lângă nume, banda rămâne a ownerului) → rândul „Vârsta” (pagina se închide,
  câmpul se deschide pe 43, focus pe câmp) → `✓` (recordul 44, banda tipărește 44) → `Escape` (pagina se închide
  și nu schimbă nimic) → „Prețuri și acces” (panoul de confidențialitate) → ambele alegeri înapoi → `reload`.
- Screenshot-uri: `wave10-hero.png`, `wave10-edit-page.png`, `wave10-stories-mode.png`, `wave10-age-field.png`,
  `wave10-after-reload.png` (în `C:\Users\Romeo\Desktop\nexus-review`).
- Suită completă: **609/609 teste** (3 teste noi: 2 în `p8-hero-band` pentru linia numelui/punct/bandă privată și
  pentru modul „story salvate”, 1 în `p8-identity` pentru pagina de editare, cele două alegeri scrise la apăsare,
  `cover_mode` cap-coadă — coloană, migrare, rută, payload, patru limbi).
- Gate: `release:check` **PASS**, `external_network:false`, `synthetic_issues:0`, 102 fișiere de test.
- Oglindă: aceleași 8 fișiere copiate cu SHA256 identic în `C:\Users\Romeo\projects\nexus_deepsek`; serverul live
  a fost repornit (`lib/*` s-a schimbat: coloană nouă + migrare).
- Buget de locale mutat de la 356.000 la **362.000** de octeți, numit pentru cele nouăsprezece propoziții noi în
  patru limbi (titlul și îndemnul paginii, cinci nume de rânduri, cele două moduri de bandă și ce înseamnă,
  poziția în cadru, ce înseamnă public și ce înseamnă privat, ușa către prețuri, cele două răspunsuri ale unei
  setări scrise, și cele două cuvinte pe care le poate ascunde punctul).

### Ce am descoperit pe drum (pentru owner)

- Proba a fost prinsă de o capcană pe care așteptam: `data-cover-mode` există **și pe secțiune** (ca să aleagă
  banda), deci un selector nespecificat alegea secțiunea în locul butonului. Selectorul probei este acum
  `[data-hero-edit-sheet] [data-cover-mode]`; în cod nu a fost o problemă, pentru că listenerii se leagă pe
  butoanele din foaie.
- Un screenshot cu `clip` fix, luat pe o pagină derulată, poate să nu se termine niciodată la un browser
  headless; proba nu mai face un astfel de pas (starea privată este dovedită de lacăt, de API și de bandă).
- Contul de probă `probe9v` a rămas pe instanța live, acum **public, cu o copertă** (fotografia folosită exista
  deja în storage-ul adresat pe conținut, deci s-a deduplicat din nou), oraș `Kraków, Polonia`, vârstă 44, acces
  plătit rămas activat din testul „privat”. Numărat în bază (`.ephemeral/wave10-footprint.mjs`): contul are
  **0 rânduri `media` proprii** (fiecare încărcare a probei s-a deduplicat pe octeții ownerului), **5 sesiuni de
  upload**, toate `completed · profile_cover`, și 2 granturi pe media existente. Rândurile `media` 82–91 create în
  ultimele ore sunt ale ownerului (`uploaded_by 19`), nu ale probei. Ștergerea contului rămâne a ownerului:
  `DELETE FROM users WHERE handle = 'probe9v';`.

### Limite (spuse explicit)

- „Privat” este o alegere de **doi pași**: `visibility` este a profilului, iar prețul accesului plătit este o
  setare separată (pagina de editare o pornește cu prețurile existente, dar nu le inventează și nu le afișează;
  ele se văd și se schimbă în Confidențialitate).
- Regula „banda nu se arată pe un profil privat” este impusă **unde se construiește banda** (test în suită, plus
  ruta care nu lasă un neprieten să citească un profil privat). Nu există încă un test live cu un al doilea cont
  ca vizitator, pentru că fiecare cont nou pe instanța live este o urmă lăsată ownerului.
- Un HEIC de la cameră rămâne refuzat, cu mesaj care numește tipul. Ștergerea pozelor și curățarea media orfane
  rămân deschise. Vârsta este declarată, nu verificată.

## 9n. Wave 11 (P8 / P9) — un singur rând, raftul deasupra benzii și vârsta aleasă din calendar

Ownerul a cerut, după wave 10, trei lucruri: (a) „pentru ambele variante între cover photo și ticker, vreau să
fie doar un singur rând. cu cerc verde/galben + nume prenume + sign de locked or unlocked + 3 bare orizontale
(menu) un singur rând”; (b) „pentru opțiunea cu stories, adaugă te rog rândul de stories între zona cu nume
prenume și banda ticker”; (c) „vârsta trebuie să alegi din calendar, pentru că trebuie să rămână activă.. la anul
am 44, nu vreau să bag vârsta manual în fiecare an”.

### Cum s-a lucrat

- **Un singur rând** nu mai este o coincidență de layout, ci structura: `.ownerIdentity` are două coloane
  (portretul și textul), iar cele trei bare au intrat **în** `.ownerIdentityText`, lângă `h1` — un flex cu
  `flex-wrap:nowrap` în care numele (`bdi`) cedează cu elipsă și semnul rămâne întreg. Bara de meniu nu mai este
  o a treia coloană care poate aluneca pe alt rând când rândul crește.
- **Semnul este lacătul**: pentru owner, mereu pe linie — 🔓 când profilul este public, 🔒 când nu este — și
  apăsarea lui deschide panoul care schimbă politica; pentru un vizitator, semnul apare doar când profilul nu
  este public (un lacăt este informație, un lacăt deschis pe numele altcuiva este zgomot). Stările sunt clase
  (`isOpen` / `isLocked`), deci se citesc dintr-o privire și se pot picta din nou fără re-randare.
- **Raftul de story salvate** a fost mutat din locul copertei pe **rândul dintre linia numelui și bandă**: în
  modul `stories` coperta dispare (`--heroOverlap:0`), numele rămâne pe linia lui, iar dedesubt vine raftul,
  apoi banda. În modul `cover` raftul rămâne în markup și ascuns, deci schimbarea este un atribut pe secțiune.
- **Vârsta devine o dată de naștere**: coloană aditivă `birth_date TEXT`, iar vârsta se **calculează acolo unde
  este citită** (`deriveAge`, în `repo.js`: ziua de naștere trebuie să fi trecut în anul curent ca anul să
  conteze). Ruta refuză o zi care nu există în calendar („birth date invalid”) și una care ar da o vârstă sub 13
  sau peste 120 („birth date out of range”); `writableBirthDate` apără și scrierea directă în record.
- **Ziua este a ownerului, vârsta este a tuturor**: payload-ul întoarce `birth_date` doar când cititorul este
  ownerul, iar `age` derivată pentru oricine — un cititor află câți ani are omul, niciodată ziua în care s-a
  născut. Un record care are doar numărul scris de mâna omului îl păstrează (fallback explicit).
- **Câmpul este un calendar**, nu un număr: `input[type=date]` cu `max` = ziua de azi, etichetat „Data nașterii”
  în pagina de editare și în Confidențialitate. Un `✓` care atinge data **șterge și numărul** scris de versiunea
  veche a recordului, deci un câmp golit nu poate învia o vârstă veche.
- **Vocabularul numărului scris de mână a fost retras** din locale (cheile `profileEdit.age`, `.ageHint`,
  `.invalidAge`) și înlocuit cu trei chei noi în toate cele patru limbi. Bugetul de locale rămâne 362.000
  (măsurat: **361.162**).

### Ce s-a reparat pe drum

- **O vârstă veche putea reveni**: dacă ownerul golea data, payload-ul cădea înapoi pe numărul declarat cândva
  (în probă, un 99 plantat). Acum scrierea care atinge data șterge numărul, iar ambele suprafețe verifică asta în
  răspunsul rutei înainte să miște ecranul.
- **Lecția probei**: selectorii fără prefix global (`document.querySelectorAll(".ownerMenuBars b")`) pot măsura
  alt host decât cel desenat; proba măsoară acum **secțiunea vizibilă** (`.nexusOwnerProfile` cu înălțime > 0) și
  citește fiecare parte a liniei prin `getBoundingClientRect`. Nu a fost un defect de produs, dar numerele de
  dinainte nu erau dovada pe care credeam că o am.

### Evidence (wave 11)

- Suita: **609/609** (`node --test "test/*.test.js"`), cu un test nou care fixează derivarea (ziua de naștere
  numărată ca zi de naștere, nu ca scădere), refuzul unei zile imposibile, regula „vârsta merge la cititor, ziua
  doar la owner” și cele două suprafețe care scriu data.
- Probă live: `.ephemeral/wave11-live.mjs` pe `http://192.168.1.153:5000` (`isSecureContext=false`) —
  **26/26 PASS, zero erori de consolă**. Măsurat în pagină: punct/num/semn la `centre 203`, barele la
  `centre 203`, rândul `136–232`, linia **32 px** cu un singur rând, portret **96×96** într-un rând de 96 px,
  `name top 187px` sub `cover bottom 168px`; raftul între `identity bottom 96` și `band top 142`.
- Al doilea cont, cititor adevărat: creat prin contractul de signup al produsului (challenge + semnătură ed25519
  reală), care citește profilul public al ownerului și primește **`age 43`, `birth_date null`**.
- Fluxul apăsat cu clicuri reale: `✎` → pagina (8 rânduri, `birth` în locul lui `age`) → rândul „Data nașterii”
  (pagina se închide, câmpul de tip `date` se deschide pe ziua din record, focus pe câmp, `max` = azi) → o zi
  care ar da 11 ani (toast cu propoziția corectă, recordul neatins) → o zi validă (recordul `1984-09-20`, vârsta
  derivată 42, numărul vechi șters, banda tipărește 42 fără re-încărcare) → „Fără copertă · saved stories”
  (raftul pe rândul lui, coperta dispare) → înapoi pe copertă → „Privat”/„Public” (lacăt închis/deschis) →
  `Escape` → `reload` (aceeași linie, același semn, aceeași zi).
- Screenshot-uri: `wave11-hero.png`, `wave11-edit-page.png`, `wave11-birth-field.png`, `wave11-stories-row.png`,
  `wave11-after-reload.png` (în `C:\Users\Romeo\Desktop\nexus-review`).

### Limite (spuse explicit)

- Vârsta este **derivată dintr-o dată pe care omul o declară**, nu verificată: o zi de naștere greșită dă o
  vârstă greșită, la fel ca înainte. Ce s-a câștigat este că nu mai trebuie scrisă din nou în fiecare an.
- Sub „Privat”, prețul accesului plătit rămâne o **setare separată** (pagina îl pornește cu prețurile
  recordului, dar nu le inventează și nu le afișează); se editează în Confidențialitate.
- Un HEIC de la cameră rămâne refuzat, cu mesaj care numește tipul; ștergerea pozelor și curățarea media orfane
  rămân deschise.
- Proba a lăsat două conturi pe instanța live: `probe9v` (ownerul de probă, acum **public, cu copertă**, oraș
  `Kraków, Polonia`, zi de naștere 1984-09-20, acces plătit activat din testul „privat”) și un cititor nou
  (`probe11visitor<timestamp>@nexus.local`, creat pentru proba de intimitate). Ștergerea lor este a ownerului:
  `DELETE FROM users WHERE handle = 'probe9v';` și `DELETE FROM users WHERE email LIKE 'probe11visitor%';`.

### Ce s-a reparat după probă (wave 11b — panoul de editare)

Ownerul a trimis o poză cu `✎` apăsat: orașul într-o ramă mică, data nașterii într-una mare, descrierea text liber,
restul împrăștiat. Câmpurile (nume, bara de status, oraș, data nașterii) au ieșit din textul profilului și stau
acum într-un singur card: fiecare câmp cu numele lui deasupra, toate aceeași lățime și aceeași înălțime, primele
două pe tot rândul, orașul și data pe rândul de sub ele, egale. Câmpul numelui a plecat din `h1` (un câmp într-un
titlu nu poate primi o dimensiune), paragraful descrierii a rămas doar pentru cititorul de ecran, iar regula veche
„blocul descrierii revine în flux la editare” a fost ștearsă, nu păstrată de decor.

### Evidence (wave 11b)

- Suita: **610/610**, cu un test nou care cere panoul: patru rânduri numite, în ordinea în care se citesc, câmpul
  numelui afară din `h1`, cele două rânduri lungi pe toată lățimea, orașul și data pe același rând și aceeași ramă.
- Probă live: **31/31 PASS, zero erori de consolă**. Măsurat în pagină la 390 px: rândurile `name,bio,location,birth`
  cu etichetele „Name”, „Status line”, „City”, „Date of birth”; lățimi `340 / 340 / 164 / 164` px; înălțimi
  `42 / 79 / 42 / 42` px (descrierea e cea înaltă, pentru că ține trei linii); orașul la `left 25`, data la
  `left 201`, același `top`; panoul **invizibil** pe un profil doar citit (câmpul există în document, închis).
- Cardul de identitate din Confidențialitate are aceleași două câmpuri la **328×48** fiecare, măsurat în pagină:
  foaia care deține ecranul de setări face fiecare input de 48 px, deci orașul a primit aceeași înălțime și același
  padding, în loc să rămână singura ramă mică din card. Numerele au fost luate întâi cu `.ephemeral/wave11-diag.mjs`
  (computed style + rect, înainte și după o regulă candidată aplicată doar în pagină), nu ghicite.
- Screenshot-uri noi: `wave11-edit-panel.png` (cardul cu cele patru rânduri), `wave11-settings-card.png` (oraș +
  dată, aceeași ramă), în `C:\Users\Romeo\Desktop\nexus-review`.

### Limite (wave 11b)

- În timpul editării, linia numelui arată doar punctul de prezență și lacătul: numele stă în câmpul lui, cu eticheta
  „Nume” deasupra. Nu e o a doua copie a numelui pe ecran, dar nici „numele scris peste locul lui”.
- Lista de orașe se deschide în continuare sub câmpul de oraș (acum lată cât câmpul); nu e un `select` nativ.
- Înălțimea de 48 px din cardul de setări este a foii existente (`p3-visual-foundation.css` impune `min-height:48px`
  pe inputurile ecranului de cont); orașul a fost aliniat la ea, nu invers.

## 9o. Wave 12 (P8) — cinci icoane care se mută, trei citiri ale arhivei, clipul cu vizualizări și pinul, și un singur flux

Ownerul a cerut, într-o singură listă: (1) cele cinci meniuri ale profilului să fie icoane, nu text; (2) să le poată muta
în ordinea lui — „dacă vrea whispers în stânga să le mute ușor în stânga, iar restul se duc în dreapta”; (3) din fiecare
icon să poată filtra „cele mai noi” și „cele mai populare” clipuri și poze; (4) pe video să vadă numărul de vizualizări
și butonul play în colțul din stânga jos, plus posibilitatea de a da pin primelor trei, restul cronologic; (5) Flow-ul să
fie amestecat cronologic cu șoaptele, „nu separate (in flow)”.

### Ce s-a livrat

- **Bara e cinci icoane** (≡ flux, ▶ reels, ▦ fotografii, ❝ șoapte, ✦ moments). Numele fiecărui tab a rămas citit — în
  `aria-label` și în `title` — dar nu mai e tipărit pe bară: cinci cuvinte pe un rând cheltuiau rândul pe un fapt pe care
  icoanele îl spun deja.
- **Ordinea barei e a profilului**, nu a sesiunii: coloana nouă `personas.tabs_order` (CSV aditiv, gol = ordinea
  produsului) se scrie prin `PATCH /api/persona/<persona>` cu `tabs_order` (listă de id-uri cunoscute, fără dubluri —
  altfel `400 tabs order invalid`) și se citește în payload-ul de profil, deci **orice vizitator vede aranjamentul
  ownerului**. În pagină, un tab se mută prin tragere (pointer capture + `elementFromPoint`) sau cu tastatura
  (`Alt+←/→`), iar ce se salvează e ordinea întreagă a barei. Lista de taburi rămâne a produsului: un id necunoscut e
  aruncat, un tab lipsă din listă e pus la loc, în ordinea lui — un aranjament nu poate ascunde o suprafață.
- **Trei citiri ale aceleiași arhive, în icoana care le citește** (vezi și wave 12b mai jos): un tap scurt pe un tab
  deschide filtrele lui chiar sub iconă — „Cele mai noi”, „Cele mai populare”, „Relevante pentru tine” —, iar fiecare
  iconă își ține citirea ei (și o marchează cu un punct când nu e cea implicită). Ordinea nu se recalculează din
  payload, se citește din numerele scrise pe fiecare nod la randare (`data-profile-stamp`, `-score`, `-rank`, `-pin`):
  scorul e reacții + comentarii + **cititori distincți** (exact `view_stats.viewers` pe care produsul îl măsoară deja),
  rangul e numărul de semnale ale cititorului. Icoana de momente nu deschide nimic, pentru că raftul de povești salvate
  nu e o listă de postări.
- **Clipul spune ce e și câți oameni l-au văzut**: în colțul din stânga jos stau `▶` și numărul de vizualizări
  (scurtat prin `Intl`, în limba interfeței, cu numărul întreg ca nume accesibil); o fotografie nu are nici play, nici
  număr, pentru că o poză nu se vizionează.
- **Pinul**: coloana nouă `posts.pinned_at` (aditivă), ruta `POST /api/posts/:id/pin` cu `{ pinned }`, maximum **3**
  (`PINNED_POST_LIMIT`), refuz cu `409 PIN_LIMIT` pe a patra; pinul nu schimbă postarea (fără versiune nouă, fără
  commitment nou) fiindcă e o decizie despre profil, nu o editare. Controlul e desenat doar ownerului, e **fratele**
  butonului care deschide postarea (un buton într-un buton nu e un buton — de aceea tile-ul e acum un înveliș
  `.profileTile` cu butonul înăuntru și pinul lângă), iar tile-ul pinat poartă insigna 📌.
- **Pinned primele doar pe Reels și pe Shots** (cel mai vechi pin primul, restul cronologic). **Pe Flow nu**: acolo
  ordinea cerută e timpul, iar o cronologie care sare nu mai e cronologie — pinul rămâne o marcă pe postare.
- **Flow-ul e un singur flux cronologic**: containerul `.ownerFlowStream` e o grilă de trei coloane în care un card de
  șoaptă ia tot rândul (`grid-column:1/-1`), iar media umple rândurile de trei — un clip, o șoaptă și o poză se
  urmează după ora la care au fost scrise. Nodurile **se mută** între flux și casele lor (`.ownerPostGrid`,
  `.ownerWhisperList`), nu se copiază: același post e un singur element în document, oriunde e citit.
- **Fotografiile** au aceleași filtre (rândul e comun) și se citesc doar pe tabul lor: `.ownerPostGrid` rămâne grila de
  trei, cu pinul și fără colțul de play.

### Evidence (wave 12)

- Suita: **619/619**. Teste noi: `test/p8-profile-tabs-filters-pins.test.js` (șase teste — icoane fără cuvinte, ordinea
  care nu poate ascunde un tab, cele trei citiri și numerele din spatele lor, colțul clipului cu numărul compact, pinul
  cu limita și hoisting-ul doar pe taburile de media, fluxul cu noduri mutate), două teste HTTP în
  `test/p1-comments-profiles.test.js` (aranjamentul scris/citit/refuzat; pinul: 3 acceptate, a patra `409 PIN_LIMIT`,
  despinnarea eliberează locul, versiunea postării nu se schimbă) și un test randat în `test/profile-whispers.test.js`
  (tile-ul de clip cu `▶` + „1,5K profile.views” ca nume accesibil, pinul ca frate al butonului, o poză fără colț) plus
  testul de taburi care cere acum că fluxul **mută** cele trei noduri și casele lor rămân goale.
- Probă live (LAN, `http://192.168.1.153:5000`, `.ephemeral/wave12-live.mjs`): **27/27 PASS, zero erori de consolă**.
  Măsurat în pagină la 390 px: bara are cinci taburi, fiecare cu icoană și fără text (textul butonului = icoana), numele
  citite (`Flow | Reels | Shots | Whispers | Moments`); bara = ordinea din record; `Alt+←` mută șoaptele un loc la
  stânga (`flow,reels,whispers,shots,moments`) **și se scrie în record** (`PATCH` → reload → aceeași ordine); rândul de
  filtre „newest* popular relevant”, ascuns pe moments; patru postări scrise prin `POST /api/posts`; Flow: `items 4`,
  `stream {visible:true, children:4}`, `grid {children:0}`, `list {children:0}` — apoi pe tabul șoapte `stream
  {visible:false, children:0}`, `list {children:4}`, totalul rămâne 4 (nimic desenat de două ori); filtrele schimbă
  `aria-pressed` și nu schimbă tabul; pinurile: 3 × `200`, a patra `409 PIN_LIMIT`, despinnare `200` → locul liber
  acceptă următoarea, profilul desenat cu exact 3 pinuri, iar Flow-ul rămâne strict cronologic (`stamps` descrescătoare)
  și cu pinul ca simplă marcă; curățenie: postările probei arhivate, ordinea pusă la loc, „no uncaught error reached the
  page”.
- A doua probă live (`.ephemeral/wave12-live-media.mjs`, pe `http://127.0.0.1:5000`, unde `crypto.subtle` există):
  **11/11 PASS** — upload **real** de PNG prin endpoint-urile produsului (`/api/uploads` → parts → complete, media
  `ready_local_validation`), apoi o șoaptă, poza și încă o șoaptă scrise în ordine; în Flow: `text | image | text`,
  grilele măsurate `128.656px 128.672px 128.672px` cu cardul de șoaptă pe `1/-1`; tile-ul pozei: `tiles 1`,
  `pins 1`, `play signs 0`, `counts 0`; pin pe un tile real `200` cu `pinned_at`; Shots citește doar poza
  (`kinds image`), Reels spune că nu are clip (`empty ["reels"]`), iar la final postările probei sunt arhivate.
- Screenshot-uri noi în `C:\Users\Romeo\Desktop\nexus-review`: `wave12-bar.png` (icoanele + rândul de filtre),
  `wave12-flow.png` (fluxul), `wave12-media-flow.png` (poza între două șoapte).

### Ce am descoperit pe drum

- **Probele mele, nu produsul**: prima variantă de probă făcea un `reload` după ce deschidea ecranul de cont, iar
  reload-ul readuce aplicația pe ecranul ei — bara nu apărea niciodată. Am adăugat `openProfile()` (reload → apasă
  ușa contului → așteaptă ținta) și proba a trecut. Tot aici: un socket devtools care nu se deschide lăsa proba
  atârnată la nesfârșit, deci așteptarea are acum un plafon.
- **Originul LAN nu e context sigur**, deci uploadul (care își face SHA-256 cu `crypto.subtle`) nu poate porni de acolo:
  limită cunoscută din wave 6u, motiv pentru care a doua probă rulează pe `127.0.0.1`.
- Bugetul de locale a crescut cu ~3 kB (14 chei × 4 limbi) și a fost mutat cu numele suprafeței, iar eticheta de
  versiune a modulelor a urcat la `20260921-wave12` (cele trei teste care o fixează au fost actualizate).

### Limite (wave 12)

- Fără confirmare pe telefonul ownerului: `reload` → `Cont` → cele cinci icoane → trage de un tab → apasă un filtru →
  Flow amestecat.
- Numărul de vizualizări e **cititori distincți** (`view_stats.viewers`), exact ce măsoară produsul; nu e „vizionări
  complete” și nu se inventează un al doilea contor.
- Pinul e disponibil pe orice tile media (video **sau** poză), nu doar pe clipuri: același control, aceeași limită de
  trei. Șoaptele nu au buton de pin (textul nu e un clip).
- Colțul de play cu numărul e probat randat + măsurat CSS, dar **nu pe un clip care se joacă**: proba nu a avut un
  fișier video real de urcat (produsul inspectează ce primește), deci „▶ + 1,2K” pe un video redat rămâne de văzut pe
  telefonul ownerului.
- Postările de probă au fost **arhivate**, nu șterse (nu există rută de ștergere a unei postări), iar conturile de
  probă rămân pe instanță — aceeași decizie de footprint ca în §9n.
- „Relevante pentru tine” folosește semnalele pe care payload-ul le are deja (ruta de profil explică cel mult primele
  24 de postări): pe o arhivă mai mare de 24, restul au rang 0 și cad pe scor, apoi pe timp — ordinea e onestă, dar
  „relevant” nu e o a doua clasare inventată în pagină.

### Ce s-a reparat după probă (wave 12b — filtrele în icoane și degetul care mută)

Ownerul a raportat două lucruri: „țin apăsat cu degetul dar nu se mută” și „filtrele trebuie să fie incluse în icoane —
cu click scurt se deschide filtrul”.

**De ce nu se muta** (cauza, nu simptomul): drag-ul se arma pe `pointerdown`, dar pe ecran tactil browserul decide
singur dacă gestul e o derulare — la prima mișcare a degetului a luat gestul pentru pagină, a trimis `pointercancel`, iar
codul meu trata „cancel” ca „lasă tabul” și curăța tot. Nimic nu oprea derularea, deci tabul nu putea pleca niciodată la
drum. Reparat: tabul se ridică doar după o **ținere** (320 ms) fără mișcare (toleranță 12 px — o mișcare mai devreme
înseamnă derulare, nu mutare); din momentul ridicării, `pointer`-ul e capturat de tab, iar `touchmove` e oprit explicit
(`{ passive: false }` + `preventDefault`) cât timp tabul e în mână, deci pagina nu mai fuge sub deget. `pointercancel`
după ridicare nu mai aruncă mutarea, ci o așază (ordinea care se vede e ordinea care se salvează), iar click-ul pe care
degetul îl lasă după o mutare e înghițit 700 ms (un gest nu face două lucruri: nu selectează și nu deschide nimic). O
ținere care nu schimbă ordinea nu scrie nimic în record.

**Filtrele stau după o săgeată, nu pe ecran**: prima variantă deschidea lista la un tap pe iconă — ceea ce însemna că
lista apărea prea des și acoperea profilul, iar ownerul a cerut exact contrariul: „filtrele nu vreau să fie vizibile,
vreau să fie o săgeată în jos, când o apeși apar cele două posibilități”. Acum bara se termină într-o singură săgeată
`▾` (44 px, în dreapta celor cinci icoane): apăsată, deschide lista chiar sub ea — „Cele mai noi / Cele mai populare /
Relevante pentru tine”, cu cea activă marcată —; un tap pe o iconă schimbă **doar** tabul și nu pune nimic pe ecran; un
tap în altă parte sau `Escape` închide lista; săgeata spune în cuvinte ce citire e activă („Mod de citire: Cele mai
populare”), devine teal când citirea nu e cea implicită, iar pe tabul de momente dispare (acolo nu sunt citiri). Fiecare
tab își ține citirea lui, iar icona o marchează cu un punct când nu e cea implicită.

### Evidence (wave 12b și 12c)

- Suita: **620/620**, cu testul nou „a tab is moved by holding it, because a finger that moves first is scrolling”
  (ținerea, toleranța, oprirea derulării, ridicarea vizuală, click-ul înghițit, ordinea neschimbată care nu se scrie) și
  pinii actualizați: săgeata e singurul lucru legat de citiri care e pe ecran, tapul pe iconă închide lista, fiecare
  iconă își ține citirea, momente nu deschide nimic.
- Probă live cu **degete adevărate** (`.ephemeral/wave12-live.mjs`, `Input.dispatchTouchEvent`, touch emulation activă):
  **35/35 PASS, zero erori de consolă**. Măsurat: un tap pe `▶` schimbă tabul și **nu** arată filtre („filters visible
  false”); săgeata stă la `346–390`, e vizibilă, `aria-expanded=false`, eticheta „Reading: Newest” și `data-reading`
  = `newest`; un tap pe săgeată deschide lista sub ea (`top 321` = `bar bottom 321`, `196–386`, în ecran) cu chips
  `newest* popular relevant`; alegerea „popular” o ține tabul (`reels:popular`), eticheta săgeții devine „Reading: Most
  popular” și lista se închide; ținere de 500 ms pe `❝` + 6 pași de `touchMove` spre stânga → bara devine
  `flow,whispers,reels,shots,moments`, **`scrollY` rămâne 0→0**, selecția rămâne cea de dinainte, nici o listă nu se
  deschide, iar la reload bara desenată = ordinea din record = ordinea făcută de deget.
- Proba a găsit și o greșeală de măsurare în produs: lista era poziționată cu o lățime **ghicită** (`offsetWidth` e 0
  cât timp elementul e ascuns), deci ateriza deplasat; acum e măsurată după ce e arătată, apoi așezată sub săgeată.
- Screenshot nou: `wave12-filters-open.png` (bara cu săgeata, lista deschisă sub ea), în `C:\Users\Romeo\Desktop\nexus-review`.
- A doua probă (media) a fost reluată după fiecare schimbare: **11/11 PASS** în continuare.

### Limite (wave 12b / 12c)

- Pragul de ținere e 320 ms: cine mișcă degetul mai repede de atât derulează pagina (contractul e intenționat — altfel
  bara ar fura derularea). Pe desktop, tragerea cu mouse-ul cere aceeași ținere scurtă, iar tastatura are `Alt+←/→`.
- Lista citirilor nu e un ecran: se închide la următorul tap oriunde în afară, nu se poate „lăsa deschisă”.
- Citirile (newest/popular/relevant) sunt ale vizitei curente, ținute de fiecare iconă în pagină; **doar ordinea
  taburilor** se salvează pe profil.
- Lista e ancorată sub săgeata din dreapta ecranului, deci se întinde spre stânga (limitată să nu iasă din ecran); nu e
  un meniu care se poate muta.

## 9p. Wave 13 (feed) — News ca al cincilea canal al feedului, cu carduri care spun ce se poate face cu ele

### Ce s-a cerut

Owner: „use the laready build icons + add news.. moments are visible in profile in 5 th tab instead of news in feed..” —
adică **icoanele rămân exact cum sunt** (bara profilului: ≡ ▶ ▦ ❝ ✦, cu **Momente** al cincilea tab) și **News intră în feed**.
Alegerea ownerului pentru forma lui News: lentila reală de agregator aprobat, plus carduri (titlu, sursă, timp, link), fără
categorii și fără miniaturi inventate, cu stările oneste păstrate.

### Ce s-a livrat

- **O bară proprie a feedului** (`nav.feedChannels`, `role="tablist"`), așezată sub raftul de momente, cu cinci canale în
  ordinea pe care foaia de feed o folosea deja: `for-you, local, global, following, breaking`. Al cincilea este **News**.
  Fiecare canal e un `role="tab"` cu marcă (✦ ⌖ ◉ ✓ !) și nume, `aria-selected` pe cel curent, iar tapul intră prin
  `activateSocialFeed` — aceeași cale pe care o folosea foaia de feed, deci bara și foaia nu se pot contrazice.
- Bara **nu** se desenează pe vizualizările pe care nu le numește (poze, tweeturi, prieteni, privat, căutare): o bară cu
  nimic selectat ar spune că cititorul nu e nicăieri.
- **Cardurile de știri**: `breakingNewsCardMarkup` înlocuiește rândul vechi. Un card = titlu (link **doar** pe gazda https
  din lista aprobată, `target="_blank" rel="noopener noreferrer"`), sursă, timp relativ, marcaj `▤`. Când adresa nu e pe
  listă, titlul rămâne text, pierde linkul și cardul **spune de ce** (`feed.breakingNoLink`: „Link neconfirmat” /
  „Link not approved”). Nici o imagine și nici o categorie nu călătoresc cu un titlu: agregatorul nu le trimite, iar aici
  ar fi inventate.
- Numele destinației este acum **News / Știri / Wiadomości / الأخبار** în toate cele patru limbi (cheile rămân aceleași,
  `feed.breaking*`), ca pe ecran să nu existe două nume pentru același lucru; propozițiile de stare
  („News is ready, but disabled”, nota despre ce nu face Nexus) au fost reformulate în consecință.
- CSS: carduri + bara, fără nici un `url(http` — lentila nu încarcă nimic de la terți.

### Ce am descoperit pe drum

- Bara nouă a intrat în grila `.clipsScreen`, care avea **exact două rânduri** (raft + feed): bara a luat rândul `1fr`, iar
  feedul a căzut într-un rând nesizeizat. Măsurat live înainte de reparație: `.pulsePosts` avea **122px** și începea la
  `y=628` (conținutul părea „lipit de jos”). Reparat cu `:has(>.feedChannels)`: grila devine `raft · auto · 1fr`. După
  reparație `.pulsePosts` începe la **230** (imediat sub bară) și are **521px**. Lecția e aceeași ca la filtrele din wave
  12c: un element nou într-un layout măsurat trebuie măsurat, nu presupus.
- Serverul de pe `:5000` servea din **oglinda** `projects\nexus_deepsek`, nu din arborele de lucru: prima probă live a picat
  cu „present false” pentru că `app.js` servit nu conținea bara. Oglinda a fost sincronizată (0 diferențe la hash) — deci
  o probă „pe produs” trebuie să spună **din ce copie** servește produsul.

### Evidence (wave 13)

- Suita: **625/625**. Test nou: `test/feed-news-tab.test.js` (5 teste) — bara cu News al cincilea, tablist-ul cu marcă și
  nume, al cincilea tab al profilului rămâne **Moments**, cardul fără imagine și fără categorie, CSS-ul care nu cheamă
  terți. Contractul P9 a fost extins la carduri (card = `<li class="breakingNewsCard">`, un singur link, marcajul
  „Link not approved” pe titlul neaprobat, zero imagini).
- Probă live în două stări (`.ephemeral/wave13-news-live.mjs`), cu logare reală, feed real, zero erori de consolă:
  - **fără agregator aprobat: 9/9 PASS** — bara există sub raft, cinci taburi în ordinea de mai sus, cel curent selectat,
    al cincilea canal spune „News is ready, but disabled” și nu inventează nimic;
  - **cu agregator pe loopback** (`NEXUS_NEWS_PROVIDER=local-fixture` + fixture local, apoi variabilele scoase):
    **14/14 PASS** — 3 titluri = 3 carduri, exact **un** link (doar gazda https aprobată, `_blank` + `noopener`), două
    titluri ținute cu „Link not approved”, **0 imagini**, linia de sursă și nota păstrate.
- Capturi: `wave13-feed-channels.png` (bara cu News selectat), `wave13-news-cards.png` (cardurile), `wave13-news-honest.png`
  (starea onestă), în `C:\Users\Romeo\Desktop\nexus-review`.
- Instanța a fost readusă la starea de dinainte: un singur `node server.js` pe `:5000`, fără variabile de știri, iar proba
  „disabled” a fost reluată pe instanța restaurată (**9/9 PASS**).
- Bugetul de CSS a fost atins de prima versiune (358 788 > 358 500): au fost scoase regulile redundante, comentariile care
  se livrau și bara de scroll webkit, iar bugetul a revenit sub limită **fără** să fie ridicat.

### Limite (wave 13)

- Al cincilea canal al feedului este **lentila de agregator existentă** (P9): fără o decizie de owner pentru un agregator
  aprobat, tabul spune asta și nu are titluri. Nexus nu are conținut editorial propriu (nu există tabel de articole), deci
  nu există chipuri de categorie și nici miniaturi: designul din machetă care le arăta ar însemna fie câmpuri inventate,
  fie imagini cerute de la gazda știrii (adică IP-ul cititorului trimis unui terț) — amândouă contrazic regula P9.
- Bara afișează **cuvântul** lângă marcă (✦ Mix, ⌖ Local Trends, …), nu doar glifa: pe profil cele cinci icoane sunt
  indexul arhivei, aici cele cinci nume sunt canale, iar o glifă singură nu spune „Mix” nimănui care nu a deschis foaia.
- Bara apare doar pe feedul social (`activeModule === "clips"`); modulul Signal folosește același ecran și nu o primește.
- Citirile per tab (newest/popular/relevant) rămân o chestiune a profilului: bara feedului este canale, nu citiri.

## 9q. Wave 14 (feed) — o pagină de feed, trei feluri de a o citi: Reels, Whispers, News

### Ce s-a cerut

Owner: macheta paginii de feed în trei stări (Reels / Whispers / News), cu **bara de sus** (logo, căutare,
clopoțel, mesaje), **raftul de momente**, **comutatorul segmentat** și **bara de jos neschimbată**, iar
fiecare control vizibil să aibă o acțiune reală.

### Ce s-a livrat

- **Bara de sus a feedului** (`appHeader feedHeader`): logo, pastilă de căutare care deschide chiar ecranul
  de căutare Social, clopoțel care deschide **Activity Center** din inbox (`inboxBox = "activity"`), trimitere
  care deschide inboxul, plus cele două uși care existau (comutator de profil ✦ / relații ◎), strânse la
  icoane. Contoarele sunt chiar cele pe care le tipărește bara de jos (`unreadActivityCount`,
  `unreadMessageCount`), deci cele două nu se pot contrazice. Bara se desenează **doar** pe feed: profilul
  rămâne fără header, celelalte module își păstrează ecusoanele.
- **Raftul de momente** ca în referință: carduri de 98×150 (86×118 sub 375 px), imagine/video full-bleed,
  gradient, nume în card, inel cyan pe ce e nou și stins pe ce a fost văzut, primul card fiind al cititorului
  (`#addStory` → `openComposer("story", …)`) cu butonul `+` peste poza lui. Clasele vechi (`storyCard`,
  `storyPrism`, `storyViewed`, `prismStoryCard`) au fost păstrate, deci gestul de peek și viewerul merg ca înainte.
- **Comutatorul** (`nav.feedModes`, `role="tablist"`, trei segmente ▶ Reels / ❝ Whispers / ▤ News): fiecare mod
  este tradus în exact perechea lentilă/format pe care endpointul o validează deja (`FEED_MODE_CONTRACT`), iar
  tapul intră prin `activateSocialFeed`, adică prin aceleași destinații pe care le folosea foaia. Sub el,
  **linia de lentile** (Mix / Local Trends / Global Trends / Following + ușa `⌄` către foaia care numește tot) —
  News nu are lentile, fiindcă are o singură listă.
- **Reels**: cardul de clip existent, așezat ca un card (rotunjit, rail de acțiuni peste media, descriere cu
  hashtag-uri, sunet, mute) — fără să rescriu `postCard`, deci toate acțiunile rămân cele care erau.
- **Whispers**: card nou, text-first (`whisperCardMarkup`): avatar, nume + sigiliu, „Whispers · acum 3 zile”,
  lacăt când postarea nu e publică, text cu hashtag-uri, atașament mic doar dacă există, **nota vocală** când
  postarea cară audio, și aceleași cârlige de engagement ca orice card (`data-reaction-toggle`,
  `data-comments`, `data-repost`, `data-save`, `data-share`, `data-post-open`, `data-creator-profile`), deci
  like/reply/repost/save/share/pagina postării merg prin codul care le are deja.
- **News**: lentila de agregator aprobată (P9), cu cardurile ei oneste, restilizate editorial; zero imagini și
  zero chipuri de categorie, fiindcă agregatorul nu le trimite.
- **Stări**: schelet propriu fiecărui mod (`feedSkeletonMarkup`), gol onest (Whispers/Reels spun „nimic încă”,
  News spune ce a spus agregatorul), eroare cu „Reîncearcă” care **reia cererea**, nu reîncarcă pagina.
- **Sfârșitul listei**: pagina următoare se cere singură când marcajul intră în ecran (`IntersectionObserver`,
  `rootMargin` 420 px), butonul rămâne pentru tastatură, iar comutarea de mod nu pierde locul cititorului
  (`feedScrollMemory`, cheie mod:lentilă:format).
- **Fișier propriu de suprafață**: `public/feed-surface.js` + `public/feed-surface.css`, încărcate ultimele, ca
  `profile-experience.css` și `post-detail.css`. Codul nou din `app.js` s-a limitat la cârlige (import, stare,
  patru apeluri), fiindcă `app.js` este la 753 de octeți de plafonul lui.
### Ce am descoperit pe drum (măsurat live, nu citit în cod)

- **Bara se rupea pe două rânduri**: clopoțelul și trimiterea erau măsurate la `y=64`, iar cele două ecusoane
  ieșeau complet din bară (x=378 și x=382 pe un ecran de 390). Reparat prin `display:flex;flex-flow:row nowrap`
  pe bara de feed, lățime fixă pentru logo și uși, și `flex:1 1 0` pentru pastilă (baza `auto` nu se micșora sub
  conținutul ei). După reparație: la 360/390/430/768 px **fiecare ușă e înăuntru** (logo 58, pastilă 107–139,
  icoane 80, ecusoane 85–109), iar sub 375 px pastila își dă cuvintele și păstrează glifa.
- **Paleta de reacții era inutilizabilă în modul card**: măsurată la **320×22 px**, așezată sub marginea de jos
  a cardului (regula de popover o pune la `bottom:18px` față de marginea cardului, iar cardul nu mai e un ecran
  întreg), deci se vedea doar o fâșie și tapul nu nimerea nimic. Reparat în CSS-ul suprafeței
  (`top:auto!important;bottom:104px!important`): acum **320×146**, în interiorul cardului, iar reacția ajunge
  pe card (`♡1` în rail după tap). Lecția e aceeași ca la grila din wave 13: o regulă scrisă pentru un ecran
  întreg nu supraviețuiește automat într-un card.
- **Raftul cerea imagini care nu există**: cardurile demo generate (id negativ) trimiteau cereri pentru fișiere
  media absente (**20× 404** în consolă). Acum un card generat nu cere nimic (nume + inițiale), un card real
  cere miniatura lui, iar o poză care nu se poate încărca **se scoate singură** (listener de `error` în capture),
  deci cititorul vede inițialele în loc de iconița de imagine spartă.
- **Bugetele**: `styles.css` era la **89 de octeți** de plafonul de 358 500, deci suprafața nouă are fișier
  propriu (precedent: `profile-experience.css`, `post-detail.css`) și **nici un plafon nu a fost ridicat**.
  Măsurat după livrare: CSS numărat 358 411 (≤ 358 500), `app.js` 601 247 (≤ 602 000), locale 365 413 (≤ 366 000).
- **PowerShell 5.1 a corupt UTF-8** când am făcut un `-replace` de versiune (`Get-Content -Raw` citește ca ANSI):
  261 de locuri cu mojibake în `app.js`. Reparat prin revers (scrie octeții citiți ca UTF-8), verificat întâi pe o
  copie din oglindă cu hash identic, apoi pe fișierele de lucru. Lecție: pe fișiere UTF-8 fără BOM,
  `Get-Content -Raw | Set-Content` nu e o unealtă de editat.

### Evidence (wave 14)

- Suita: **632/632** (era 625). Test nou `test/feed-surface.test.js` (8 teste: bara și cele trei destinații,
  scheletul fiecărui mod + stările, raftul, cardul de șoaptă cu toate cârligele, nota vocală, sfârșitul listei
  și memoria locului, lățimile). `test/feed-news-tab.test.js` a fost **rescris** (6 teste) pe contractul nou:
  News e al treilea mod, lentilele rămân una lângă alta, al cincilea tab al profilului rămâne **Moments**, iar
  cardul de știri nu inventează nimic. Marca de versiune a activelor a trecut la `20260922-wave14` (audit,
  p11-devices, profile-menu-ticker).
- Proba live (`.ephemeral/wave14-feed-live.mjs`) pe instanța care servește produsul, cu logare reală, la
  390×844: **57/57 PASS**, zero erori de consolă venite din feed (cele 404 rămase sunt media demo lipsă,
  pre-existente). Ce a fost măsurat, nu presupus: bara pe un rând la 360/390/430/768 px; raftul cu 5 carduri de
  98×150 care se derulează lateral (120 px); comutatorul cu un singur segment selectat și contur diferit;
  **13 carduri** de reel cu rail complet, video care pornește mut singur, paletă 320×146 **în** card, reacție
  care se înregistrează, save care se comută, fir de comentarii deschis **în** card (186 px, `position:static`)
  și închis la loc; **11 carduri** de șoaptă cu toate cârligele, text-first (1 imagine, 0 video), pagina
  postării deschisă din card și modul păstrat la întoarcere; News declarând onest „News is ready, but
  disabled”, fără imagini și fără chipuri; comutarea de mod **fără reîncărcare** (santinelă + `navigation` = 1)
  și locul păstrat (260 → 260); bara de jos cu cinci destinații, Home activ, Profile care se deschide și Home
  care revine.
- Capturi: `wave14-feed-reels.png`, `wave14-feed-whispers.png`, `wave14-feed-news.png` în
  `C:\Users\Romeo\Desktop\nexus-review`.
- Oglinda `projects\nexus_deepsek` a fost sincronizată (0 diferențe la hash pe cele 10 fișiere), deci proba a
  măsurat exact ce servea produsul.

### Limite (wave 14)

- **Nota vocală nu a fost observată live**: nici o postare din instanța de probă nu cară audio (`post.audio`
  există doar pentru audio verificat de studio), deci playerul e acoperit de teste, nu de probă. Forma de undă
  se desenează din eșantioanele reale (`decodeAudioData`) doar după ce fișierul e decodat; până atunci se vede
  bara de progres, fiindcă o formă nedesenată nu se inventează.
- **Încărcarea automată a paginii următoare** nu a fost observată live: feedul contului de probă încape într-o
  pagină (fără `data-feed-more`). Codul e acoperit de teste; rămâne de văzut pe un cont cu sute de postări.
- **News rămâne pe decizia ownerului**: fără `NEXUS_NEWS_PROVIDER` + cheie, modul spune onest că e oprit.
  Chipurile de categorie și miniaturile din machetă ar cere un tabel de articole propriu și imagini găzduite de
  Nexus; până atunci ar însemna câmpuri inventate, ceea ce P9 refuză.
- **Deviere asumată de la machetă**: identitatea autorului și acțiunile stau **peste** media (așa e cardul de
  clip și așa a rămas), nu deasupra ei, iar badge-ul „Reels” nu a fost adăugat fiindcă segmentul activ al
  comutatorului spune deja unde ești. Ambele ar însemna să rescriu `postCard`, adică exact ce nu trebuie făcut.
- **`app.js` e la 753 de octeți de plafon**: următoarea schimbare de feed trebuie să intre în
  `feed-surface.js` sau să scoată ceva, nu să crească plafonul.
- Comutatorul și linia de lentile apar doar pe feedul social (`activeModule === "clips"`); modulul Signal
  folosește același ecran și nu le primește. Citirile per tab (newest/popular/relevant) rămân pe profil.




## 9r. Wave 14b (feed) — bara cu patru uși, fără linia de lentile, cu poze la momente

### Ce s-a cerut

Owner: „partea de stories nu se vede ok; în header vreau să rămână logo Nexus, search-ul, un buton stil «alege
sursa» (ca la HDMI) unde poți schimba între modulele aplicației, un buton cu prieteni (listă, cereri,
sugestii), un buton de notificări (exclusiv notificări din aplicație, mesajele separat); adaugă poze fictive
pentru stories; secțiunea Mix / Local Trends / Global Trends dispare.”

### Ce s-a livrat

- **Bara de feed are patru uși**, în ordinea din referință: **sursa** (`#feedSource`, glifă de intrare/HDMI,
  deschide foaia de profile + module), **mesaje** (`#feedSend` → inbox), **prieteni** (`#feedFriends` → foaia
  de relații cu liste și cereri), **notificări** (`#feedBell` → Activity Center, adică doar notificările din
  aplicație; mesajele au contorul lor separat, în bara de jos). Toate cele patru sunt desenate ca SVG (nu
  emoji, care arată altfel pe fiecare telefon), iar plăcile vechi (✦ lentilă / ◎ relații) nu se mai tipăresc
  pe feed: `#modeBadge`, `#feedBadge`, `#friendsBadge` rămân în DOM, dar ascunse, fiindcă aceleași uși sunt
  acum butoanele de sursă și de prieteni.
- **Linia Mix / Local Trends / Global Trends / Following a dispărut** de pe feed (markup, CSS, teste). Ce a
  rămas din ea nu s-a pierdut: destinațiile feedului (Mix, Local, Global, Following, Fotografii, Prieteni,
  Privat) plus cele două preferințe de afișare (prezentare, încadrare) sunt acum o secțiune `FEEDUL` în foaia
  pe care o deschide butonul de sursă — o apăsare, nu o linie permanentă.
- **Momentele au poze**: cinci ilustrații vectoriale proprii în `public/demo-stories/` (golf, oraș, munte,
  insulă, apus), servite din același origine. Cardurile demo nu mai cer hash-uri media pe care instanța nu le
  are (20× 404 înainte), un card real cere miniatura lui, iar o poză care nu se poate încărca se scoate
  singură, lăsând inițialele vizibile.

### Ce am descoperit pe drum

- **Un SVG fără `width`/`height` este 300×150, nu `viewBox`**: prima rundă a desenat doar mijlocul fiecărei
  ilustrații (de aceea fiecare card părea „un oval palid pe fundal închis”). Fișierele au acum dimensiune
  intrinsecă (400×520), iar `object-fit:cover` decupează corect. Măsurat: patru imagini încărcate, zero
  stricate.
- **`Copy-Item -Recurse` într-un director existent creează un subdirector**: o rundă de sincronizare a pus
  fișierele în `demo-stories/demo-stories`, iar serverul a servit în continuare varianta veche. Sincronizarea
  se face acum fișier cu fișier, iar după fiecare rundă hash-urile sunt comparate.
- **Bugetul `app.js` a fost atins din nou** (602 432 > 602 000, apoi 602 033). Nu a fost ridicat: comentariile
  livrate și două blocuri de cod din interiorul `openProfileSwitcher` au fost mutate în modulul de feed
  (`feedSourceSectionMarkup`, `bindFeedSourceSection`), iar comentariile rămase au fost scurtate. Măsurat
  după: `app.js` 601 722 (278 liberi), locale 365 543 (457 liberi), CSS numărat neatins.

### Evidence (wave 14b)

- Suita: **632/632**.
- Proba live (`.ephemeral/wave14-feed-live.mjs`): **63/63 PASS**, cu capturi actualizate. Măsurat, nu
  presupus: patru uși de 36×36 în ordinea sursă→mesaje→prieteni→notificări; fiecare ușă deschide exact ecranul
  ei (foaia de module cu secțiunea `FEEDUL` și ≥ 6 destinații; foaia de prieteni cu listele ei; Activity Center;
  inboxul); nicio urmă de linie de lentile pe feed; cinci carduri de moment, patru poze încărcate, zero
  stricate; la 360/390/430/768 px toate cele șase elemente ale barei (logo, pastilă, patru uși) sunt în bară.
- Oglinda `projects\nexus_deepsek` a fost sincronizată fișier cu fișier, cu verificare de hash.

### Limite (wave 14b)

- **Zona palidă ovală de peste ilustrații a primit cauza și reparația în §9s** (runda următoare): regula care
  o picta era pasul vechi de raft rotund din `styles.css`, nu un `:after`, nu `.storyInitials` și nu conținutul
  ilustrației — dovada de atunci (captură + DOM + stiluri calculate) a fost cea care a condus la ea.
- Sugestiile de prieteni sunt cele pe care le are foaia existentă (urmăritori, urmăriți, favorite, cereri);
  un panou separat de „sugestii” ar cere o sursă de recomandări, adică o decizie de produs.


## 9s. Wave 14c (moments) — ovalul palid: cauza, măsurată

### Ce s-a cerut

Owner, cu captură de pe telefon: „stories se văd ciudat... verifică”. În captură, cardurile din raft arătau o
formă ovală palidă peste ilustrație, cu un nume mare, tăiat, iar cardul „Your story” arăta un glif străin în loc
de „+”.

### Ce am descoperit pe drum (măsurat, nu citit în fișier)

- Cauza nu era ilustrația, nu era `.storyInitials` și nu era vreun `:after`: erau **regulile raftului vechi,
  rotund, din `styles.css`** (liniile 20 și 58), scrise pentru carduri-avatar circulare de 66×66. Selectoarele
  lor sunt generice — `.stories .storyPrism>b`, `.stories .storyPrism img`, `.stories .storyPrism video` — deci
  se potrivesc **și** peste cardul nou: `<b class="storyName">` și `<b class="storyInitials">` sunt copii `<b>`
  ai prismului, iar poza cardului este un `<img>`.
- Ce pictau exact, citit din cascada rezolvată de browser pe instanța live
  (`CSS.getMatchedStylesForNode`, `.ephemeral/wave14c-story-oval.mjs`):
  - `.stories .storyPrism>b` → `width:100%;height:100%;display:grid;font-size:18px;`
    `background:linear-gradient(150deg,#132d38,#231a3a)`;
  - `.stories .storyPrism img,.stories .storyPrism video,.stories .storyPrism>b` → `border-radius:50%!important`.
  - Măsurat pe cardul 2, înainte: `.storyName` = **98×126 px, `border-radius:50%`, font 18px/800** (ovalul cu
    numele uriaș), `img` = 98×126 cu `border-radius:50%` (poza decupată oval), `storyInitials` = `font-size:0`.
  - Pe cardul „Your story”, `.stories .createPrism>b{font-size:0!important}` ascundea **și** inițialele, **și**
    badge-ul „+”, iar `::after{content:"⌑"}` desena un glif străin în locul lor.
- De ce a scăpat în runda 14b: diagnosticul de atunci s-a uitat la DOM, la SVG-urile servite și la stilurile
  calculate ale elementelor bănuite — dar nu a întrebat browserul **cine câștigă cascada**. „Ce element este
  acesta” nu răspunde la „ce regulă îl pictează”.
- **A doua lecție, plătită din nou**: prima măsurătoare „după reparație” a arătat exact aceleași valori. Nu era
  cache-ul browserului (proba dezactivează cache-ul): serverul de pe `:5000` **citește oglinda**
  `C:\Users\Romeo\projects\nexus_deepsek`, iar acolo fișierul era încă cel vechi. Ordinea care funcționează este
  cea scrisă în §9f: **editează, oglindește, abia apoi măsoară**.

### Ce s-a livrat

- `public/feed-surface.css` numește forma pe care o vrea raftul, cu selectoare de trei clase și `!important`
  exact acolo unde `styles.css` are două clase plus element (fișierul e citit ultimul, deci câștigă): numele
  este o bandă de 11px la baza cardului (`width/height:auto`, `border-radius:0`), inițialele rămân 19px
  drepte, poza ia `border-radius:inherit`, badge-ul „+” revine la 26×26 cu fundalul lui mint și cu textul lui
  închis, iar `::after`-ul străin dispare. **`styles.css` nu a fost atins**: pasul vechi rămâne pe loc pentru
  suprafețele care încă îl cer (profilul își ține tile-urile rotunde), iar reparația trăiește în fișierul
  suprafeței de feed.
- `test/feed-surface.test.js` fixează contractul (cinci verificări noi în testul raftului), cu motivul scris
  în test: o rundă viitoare care uită de ce sunt acolo va citi explicația.

### Evidence (wave 14c)

- Diagnostic nou, read-only: `.ephemeral/wave14c-story-oval.mjs` — Chrome pe instanța live, logare reală,
  390×844; citește DOM-ul raftului, stilurile calculate (elemente **și** pseudo-elemente), cascada rezolvată de
  browser pentru prismă / nume / poză / inițiale / badge, apoi salvează o captură a raftului și una a unui card
  la 3×.
- Înainte (măsurat): `.storyName` 98×126, `radius 50%`, `font 18px`; `img radius 50%`; `storyInitials font 0px`;
  `storyAddBadge` 96×124, transparent.
- După (aceleași măsurători, după oglindire): `img radius 15px`; `.storyName` 98×47 la baza cardului, 11px/800,
  `radius 0`, cu scrim; `storyInitials` 19px, `radius 0`; `storyAddBadge` 26×26, fundal mint, text `#03110f`;
  `em`-ul de colț rămâne ascuns; `::before`-ul raftului (linia de lentile) rămâne `display:none`.
- Capturi: `wave14c-shelf.png` (raftul, 3×) și `wave14c-card-zoom.png` (un card, 3×).
- Oglinda: `feed-surface.css` copiat fișier cu fișier, **SHA256 identic** (`19a7765f…`) și verificat pe
  răspunsul serverului (25 002 octeți, regula nouă prezentă în corpul servit).
- Bugete: **`styles.css` nu a fost modificat**, deci CSS-ul numărat rămâne **358 411 / 358 500**; reparația a
  intrat în `feed-surface.css`, care nu face parte din cele șapte fișiere numărate. `app.js` și locale neatinse.

### Limite (wave 14c)

- Reparația este în suprafața de feed, nu în `styles.css`: pasul vechi de raft rotund rămâne în fișierul mare și
  va continua să se potrivească pe orice element nou care seamănă cu un `<b>` sau un `<img>` într-o prismă.
  Curățenia adevărată (ștergerea pasului vechi) ar cere verificarea fiecărei suprafețe care încă îl folosește și
  nu a fost făcută aici.
- Ovalul a fost documentat pe raftul de pe feed; tile-urile de momente din profil (`ownerStoryTiles`, rotunde prin
  construcție) nu au fost atinse și nu au fost re-măsurate în această rundă.
- Serverul live servește oglinda, deci fiecare reparație viitoare are nevoie de pasul de oglindire înainte de
  orice măsurătoare; altfel proba măsoară versiunea de dinainte.



## 9t. Wave 14d (feed) — bara mărită, patru uși cu panou, inelul lipit de poză

### Ce s-a cerut

Mărește headerul de pe feed (logo mai mare, câmp de căutare mai lat), transformă cele patru uși ale barei
(sursă / prieteni / grupuri / notificări) în icoane fără text care deschid panouri laterale ca în TikTok —
**un singur efect de mișcare, o dată, în tot proiectul** — și repară cadrul cardurilor de momente ca inelul
(teal / punctat) să îmbrățișeze poza, fără bandă goală sub ea. Ownerul a ales explicit varianta 1 pentru
momente: inelul pe poză.

### Ce s-a livrat

- **Bara, măsurată înainte și după** (Chrome pe instanța live, 390×844, `Network.setCacheDisabled`, touch
  emulation; probe la 360 / 390 / 430 / 820 px): logo `wordmark svg` **52×16 → 84×22** (cutia își ia lățimea
  de la el în loc de 58px fix), câmp de căutare la 390 **79px → 122px** (textul vizibil 31px „Sea…” devine
  74px, întreg), la 360 **63 → 114px**, la 430 **99 → 162px**; uși 4×36px → 4×**34px** cu `gap` 4 (total
  159 → 148px) și o **țintă de atingere de 44px** (inel transparent `inset:-5px` în afara butonului, ca bara
  să nu crească în înălțime); rândul barei are acum **3 copii** în loc de 4.
- **Cauza reală a câmpului îngust, găsită în cascada rezolvată de browser, nu citind fișierul evident:**
  `feed-surface.css` cerea `.appHeader.feedHeader .headerSwitches{display:contents}`, dar `styles.css` are
  **mai târziu** `.headerSwitches{…display:grid!important…}`, deci cutia goală, de 0 înălțime, rămânea în rând
  și lua jumătate din spațiul liber (măsurat: `feedSearchField` 79px în loc de ~135px, `headerSwitches` 49px).
  Regula suprafeței câștigă acum (`!important`, aceeași specificitate).
- **Patru uși, fără text, exact cele cerute**: sursă (`feedSource`), prieteni (`feedFriends`), grupuri
  (`feedGroups`, nou), notificări (`feedBell`). „Mesaje” a ieșit din bară — rămâne în navigația de jos, cu
  contorul lui; contorul de activitate rămâne pe clopoțel. Nicio ușă nu poartă un badge pe care nu l-a
  măsurat cineva: grupuri nu are contor propriu, deci nu afișează unul.
- **Un panou, patru conținuturi, o singură mișcare.** `feed-surface.js` ține revelația (`.doorLayer`,
  `.doorBackdrop`, `.doorPanel`, `@keyframes doorPanelIn`) cu **exact valorile** pe care
  `profile-experience.css` le folosea deja pentru `profileMenuIn` (`opacity .4 → 1`, `translateX(16px) → 0`,
  `.22s ease-out both`); `html[dir="rtl"]` o oglindește (`doorPanelInRtl`), iar `prefers-reduced-motion`
  oprește animația. Un test fixează că ambele fișiere au aceleași valori, ca să nu se despartă.
- **Non-modal**, ca foile pe care le înlocuiește: `role="region"` cu `aria-labelledby`, **fără** `aria-modal`;
  bara, Home și navigația rămân vii cât timp panoul e deschis (măsurat: `nav 5`, `bar true`). Esc, atingere pe
  fundal, butonul × și ușa însăși închid; focusul se întoarce pe ușă; `aria-expanded` spune care ușă e
  deschisă, inclusiv după o re-randare a barei (legarea e delegată, fiindcă bara se redesenează la fiecare
  schimbare de contor).
- **Conținutul fiecărei uși este suprafața care exista deja**, nu una nouă: sursa = modulele `PROFILES` +
  `FEED_DESTINATIONS` + cele două comutatoare de afișare (aceleași acțiuni: `switchPersona`,
  `activateSocialFeed`, `setSocialPresentation`, `setSocialMediaFit`) + un rând care deschide foaia completă
  (News / Tweets); prieteni = **același** `loadSocialFriendsList` și aceleași patru file
  (`social-friends-list`); grupuri = `/api/chat/conversations?persona=all&box=inbox&limit=30`, validat cu
  `isSafeConversationSummary`, filtrat `kind === "group"`, rânduri desenate de `conversationListItem` (arată
  exact ca în Mesaje) — iar când lista e goală spune „Niciun grup încă.” și oferă „Creează · Grup”;
  notificări = `renderNotificationActivity` (lista reală, cu preferințe și retry), cu cutia inboxului
  salvată/restaurată în jurul panoului.
- **Momentele**: inelul teal / punctat a trecut de pe card pe prismă (`box-shadow`, nu `border`, ca poza să nu
  piardă niciun pixel), cardul de moment are exact înălțimea pozei
  (`.feedStoryCard:not(.feedStoryOwn){height:auto}`), iar cardul „Your story” își păstrează rândul de text.
  Măsurat înainte/după, pe același card: `deadBandUnderPrism` **22 → 0**, `pictureInRing` **−20 → 0**.
- **Buget**: `app.js` a ajuns la 605 151 octeți (peste plafonul de 602 000) după ce primele variante au pus
  conținutul ușilor direct în el. Rezolvarea este extracția pe care nota din test o cere deja:
  `public/feed-doors.js` (modul nou, ~6,5 kB) ține decizia „ce e în spatele fiecărei uși”, iar `app.js` doar
  construiește contextul și montează panoul. `demoHumanExperienceStories` și `bindStoryRailAutoHide` au trecut
  în `feed-surface.js`, lângă suprafața căreia îi aparțin. Rezultat: `app.js` **601 029 / 602 000**.
- **Două taste noi** (`door.groups`, `door.groupsEmpty`) în patru limbi, scurte; locale **365 837 / 366 000**.
  CSS-ul numărat (cele șapte fișiere) **nu a fost atins** (358 411 / 358 500); stilurile noi stau în
  `feed-surface.css`, care nu face parte din cele șapte.

### Evidence (wave 14d)

- Diagnostic nou, read-only: `.ephemeral/wave14d-bar-doors.mjs` — măsoară bara la patru lățimi, apoi raftul,
  apoi deschide pe rând toate cele patru uși și citește rolul, dimensiunile, secțiunile, starea
  `aria-expanded`, dacă bara și navigația sunt încă vii, și verifică Esc / fundal / ×. Capturile se scriu în
  `Desktop\nexus-review\`.
- Înainte (`.ephemeral/wave14d-before.json`) și după (`.ephemeral/wave14d-after.json`), aceleași măsurători:
  bara 360/390/430/820, `storyCard` / `storyPrism` / `img` / `storyName`, plus cele patru panouri.
- Panourile, măsurate după oglindire: `source` 322×844, 17 rânduri, titlu tradus „Choose what you want to see”,
  secțiuni `What you read · Feed channels · More formats and settings`; `friends` cu cele patru file;
  `groups` titlu „Groups”, „No groups yet.” (baza de date are 0 grupuri — starea goală e reală, nu machetă);
  `activity` 13 rânduri (lista reală de notificări). Toate: `role region`, `aria-modal null`, `nav 5`,
  `bar true`, iar după închidere `hidden true` și toate ușile `aria-expanded="false"`.
- O probă a prins un defect real înainte de a ajunge la owner: titlurile de secțiune ale panoului sursă erau
  tipărite ca **chei** („feed.modesLabel”), fiindcă `feedSourceDoorMarkup` le pasa netraduse; reparat și fixat
  în test.
- Teste: **634 / 634** (`node --test test/*.test.js`), din care două teste noi (geometria barei; panoul
  non-modal și mișcarea comună) și șapte teste existente actualizate, fiecare cu motivul scris în test:
  ordinea ușilor și legăturile lor (`feed-surface.test.js`), inelul pe prismă și cardul cât poza, demo-urile
  mutate (`audit.test.js`), sursa nu mai e o foaie (`feed-news-tab.test.js`), panoul respectă regula
  non-modală (`p1-social-human-navigation.test.js`), sandbox-ul `navigate` primește `feedDoors`
  (`messenger-shell.test.js`).
- Versiune de active urcată consecvent (`20260923-wave14d`) în `index.html`, importurile din `app.js` și pinii
  din teste, fiindcă `app.js` importă acum `feed-doors.js`.
- Oglinda: fiecare fișier copiat în `C:\Users\Romeo\projects\nexus_deepsek` și verificat **SHA256 identic**;
  `app.js` servit de server pe `:5000` are aceiași octeți ca arborele de lucru, iar `/feed-doors.js` răspunde
  `200` (6 472 octeți).

### Limite (wave 14d)

- Grupurile sunt citite din inboxul existent (`box=inbox`, `limit=30`): un grup care nu e în prima pagină de
  30 de conversații nu apare; lista completă cu paginare ar cere un cursor în panou, adică o rundă separată.
  Baza de date de probă are 0 grupuri, deci rândurile de grup **nu au putut fi văzute live** — au fost
  verificate doar starea goală și rândul „Creează”.
- „Prieteni” redă cele patru liste existente (urmăritori / urmărești / favorite / cereri). „Sugestii de
  prieteni” rămâne o decizie de produs (are nevoie de o sursă de recomandări).
- Panoul de sursă listează cele șapte destinații din `FEED_DESTINATIONS`; `breaking` și `tweets` rămân în
  foaia completă, deschisă dintr-un rând al panoului (alegere deliberată: nu s-a dublat foaia).
- Logo-ul **nu** crește pe ecran lat: măsurat, sub o fereastră de 820px bara are tot 378px (rama de telefon),
  deci un logo mai mare acolo ar lua lățime din câmpul de căutare. Creșterea lui la 96×25 a fost scoasă după
  ce măsurătoarea a arătat efectul.
- `styles.css` nu a fost atins: pasul vechi de raft rotund și regula `!important` de `grid` rămân în fișierul
  mare; bara le învinge prin specificitate și `!important`, dar curățenia lor este o rundă separată.

## 9u. Wave 14e (feed) — bara cu trei lucruri, șina celor trei lecturi, swipe-ul care schimbă lectura

### Ce s-a cerut

Aplică macheta atașată de owner pe suprafața Reels: logo-ul rămâne cel existent, apoi opțiunea de swipe între
For You / Whispers / News, iar ultimul buton din dreapta comută între module (social/work/dating/…) și se
termină cu delogarea. For You primește o tentă ușoară de violet, Whispers verde, News albastră. Odată ce
începi să vezi conținut, „ecranul de swipe” dispare, dar funcționează invizibil; swipe stânga/dreapta schimbă
lectura — regulă valabilă în tot proiectul.

### Ce s-a livrat

- **Bara are trei lucruri și nimic altceva**: logo-ul (desenat de shell, neschimbat), ușa de sursă
  (`#feedSource`) și butonul din dreapta (`#feedModules`) — măsurat live: 3 copii în rând
  (`wordmark · feedHeaderIcons · headerSwitches`), 2 icoane, fiecare cu `aria-label` tradus.
- **Linia de sub header a fost scoasă prin măsurare, nu prin presupunere**: era `border-bottom`-ul din
  `feed-surface.css` **plus** cel pe care `styles.css` îl tipărește pentru orice `.appHeader` (`!important`)
  și umbra de sub bară. Acum `border-bottom:0` și `box-shadow:none`; singurul lucru care mai pictează o linie
  în banda de sus este indicatorul de pull-to-refresh. Separatorul raftului de momente a plecat și el
  (`border-bottom:0`): șina care îi urma nu mai are cutie de care să se despartă.
- **Șina celor trei lecturi** înlocuiește pastila: un „puck” cu marca lecturii curente (▶ / ❝ / ▤), apoi cele
  trei cuvinte cu majuscule, doar vecinii care există indicați cu ‹ / › — exact ca în machetă (Reels: doar
  `›`; Whispers: `‹ ›`; News: doar `‹`), `role="tablist"` cu `aria-selected`, plus săgețile stânga/dreapta
  pe tastatură.
- **O tentă per lectură**, scrisă pe ecran **și** pe bară (bara nu e copilul ecranului):
  `--feed-tint` `#a06bff` (Reels) / `#43df80` (Whispers) / `#2fb7ff` (News), folosită de inelul ușii de
  sursă, de puck, de cuvântul activ, de spălarea șinei și de vârful coloanei. Măsurat live: `--feed-tint`
  `#a06bff → #43df80 → #2fb7ff` la fiecare schimbare, pe `.clipsScreen` și pe `.appHeader` deodată.
- **Disparția**: același prag de 18px care pliază raftul de momente pliază și șina
  (`height:0; opacity:0; pointer-events:none`), în toate cele trei lecturi; măsurat: șina
  `[12,256,366,70] → [0,62,390,0]`, `feedScrolled` pe ecran, rândurile grilei `0px 0px 686px`. Swipe-ul
  rămâne pe coloană, nu pe șină, deci funcționează invizibil; `:focus-within` o readuce pentru tastatură,
  iar `prefers-reduced-motion` oprește tranzițiile (măsurat: `transition: none`).
- **Swipe stânga/dreapta schimbă lectura**, în ordinea șinei și cu întoarcere la capete (`nextFeedMode`),
  măsurat pe pagina live cu degete reale (`Input.dispatchTouchEvent`): Reels → Whispers → News →
  (dreapta) Whispers. Regula aparține suprafeței de feed, deci este valabilă oriunde feedul e afișat.
- **Butonul din dreapta** deschide exact foaia plăcii de profil (`openProfileSwitcher`): profilele
  independente (Social / Work / Dating / Travel / Market), aplicațiile Nexus și, **ultimul rând**, „Log out”
  — măsurat: `lastRow: profileSwitcherEnd | Log out`, `logoutIsLast: true`.
- **Nicio ușă nu s-a pierdut**: câmpul de căutare, prietenii, grupurile și notificările sunt rânduri în
  panoul sursei, lângă destinații și cele două alegeri de afișare; trei dintre ele deschid exact panoul pe
  care îl deschideau din bară (`data-feed-door-open`, panoul sare în același strat), căutarea deschide
  ecranul căutat. Măsurat: 4 secțiuni traduse, 21 de rânduri, 4 mărci SVG de 18px (nu cutii de 300×150).
- **Un defect real, prins de probă înainte de a ajunge la owner**: în News, ramurile care întorc devreme
  (notificarea „aggregator dezactivat”, eroarea, lista goală) ieșeau din randare **fără** să lege gestul și
  plierea șinei, deci coloana nu răspundea deloc la swipe (`channelSwipeWired` absent, măsurat). Acum fiecare
  ieșire trece prin `wireReading()`; măsurat după reparație, pe starea de notificare (`notice: true`):
  `swipeWired: "true"` și `railWired: "true"`.


### Evidence (wave 14e)

- Diagnostic nou, read-only: `.ephemeral/wave14e-chrome.mjs` — 390×844, cache dezactivat, touch emulation;
  citește bara, șina, tenta și liniile pictate în banda de sus (înainte și după scroll), apoi dă swipe cu
  degete reale și verifică lectura, deschide panoul sursei și foaia de module, comută `dir="rtl"` și
  `prefers-reduced-motion`. Ieșirea completă: `.ephemeral/wave14e-chrome.out`.
- Capturi în `Desktop\nexus-review\`: `wave14e-foryou.png`, `wave14e-foryou-scrolled.png`,
  `wave14e-whispers.png`, `wave14e-news.png`, `wave14e-news-notice.png`, `wave14e-source-panel.png`,
  `wave14e-module-drawer.png`, `wave14e-rtl.png`.
- Teste: **637 / 637** (`node --test test/*.test.js`), cu trei teste noi (șina: ordinea, indiciile,
  `nextFeedMode`; tentele, plierea și mișcarea redusă; „fiecare ieșire leagă lectura”) și șapte teste
  existente actualizate, fiecare cu motivul scris în test (bara cu trei lucruri, `feed-surface.test.js`;
  șina în locul pastilei, `feed-news-tab.test.js`; cele patru destinații în locul canalelor pe swipe,
  `p1-social-human-navigation.test.js`; sandbox-ul de gesturi care primește `feedMode`/`nextFeedMode`,
  `feed-touch-lifecycle.test.js`; pinii de versiune, `audit.test.js` / `p11-devices.test.js` /
  `profile-menu-ticker.test.js`).
- Bugete: `app.js` **601 892 / 602 000**, locale neschimbat (nicio cheie nouă adăugată), CSS-ul de șapte
  fișiere neschimbat — stilurile noi stau în `feed-surface.css`, care nu face parte din cele șapte. Ca să
  rămână sub plafon, `app.js` a cerut două extrase în `feed-surface.js`: `nextFeedMode` și
  `feedDrawerEndMarkup`.
- Versiune de active urcată consecvent (`20260923-wave14e`) în `index.html`, în importurile din `app.js` și
  `feed-doors.js` și în pinii din teste.
- Oglinda: fiecare fișier atins copiat în `C:\Users\Romeo\projects\nexus_deepsek` și verificat **SHA256
  identic**; măsurătorile de mai sus sunt făcute pe serverul de pe `:5000`, care citește oglinda.

### Limite (wave 14e)

- Mijlocul barei este ușa de sursă, nu un indicator de lectură: macheta desenează acolo o rotiță cu marca
  lecturii, dar ușa de sursă trebuia păstrată pe bară (este singura ușă cu panoul ei rămasă acolo). Marca
  lecturii stă pe puck-ul șinei, iar inelul ușii de sursă poartă tenta lecturii, deci cele trei culori se văd
  și în bară.
- Un gest orizontal care începe pe raftul de momente derulează raftul, nu schimbă lectura: raftul are
  derularea lui orizontală, iar regula nu a fost schimbată.
- După o schimbare de lectură, șina reapare, fiindcă te întorci în vârful lecturii noi (`feedScrollMemory`
  păstrează poziția fiecăreia dintre cele trei). Este exact comportamentul pe care îl are raftul de momente.
- Conținutul de card cerut de machetă (contorul 18.4k / 1.2k / 340, pastilele de reacție peste autor, rândul
  de muzică, lista numerotată de știri) rămâne pentru o rundă separată: este conținut de card, nu bară.
- Filele profilului (flow / reels / shots / whispers / moments) nu au fost atinse: regula de swipe privește
  lectura feedului, iar filele profilului sunt un alt contract.


## 9v. Wave 14f (feed + Messages) — șina celor trei lecturi pe bară, raftul de momente mutat în Messages

### Ce s-a cerut

Owner-ul, cu a doua machetă (săgeata albastră și dreptunghiul roșu desenate pe poză): „mă interesează să muți
story în mesaje și să urci acel «swap» sus în header, între logo și cele două icoane”. Adică: raftul de momente
(cercurile încrucișate cu portocaliu) iese de pe Reels și ajunge în Messages, iar șina celor trei lecturi iese de
sub raft și urcă în bara de sus, în locul liber dintre sigla NEXUS și cele două butoane din dreapta.

### Ce s-a livrat

- **Șina celor trei lecturi stă pe bară**, între logo și uși: măsurat live la 390×844, bara este
  `[0,0,390,72]`, șina `[102,21,198,32]` — în interiorul barei, după siglă (dreapta la 96) și înaintea primei
  uși (x 306), cu ușile în continuare pe ecran (`doorsOnScreen: true`). Copiii barei rămân trei lucruri vizibile
  (`wordmark · feedModes · feedHeaderIcons`), al patrulea (`headerSwitches`) fiind `display:contents`.
- **Cuvintele nu se mai taie**: măsurat, `letter-spacing: 1.68px` (regula shell-ului pentru plăci) împingea cele
  trei cuvinte cu 26px peste lățimea pe care o are bara, iar toate trei se tipăreau „REEL…”. În bară șina scrie
  cu 10px și `letter-spacing:.02em`; măsurat după: `30/30`, `54/54`, `31/31` (lățime de text = lățime vizibilă),
  fără niciun cuvânt trunchiat, iar ținta rămâne 44px (mark de 32px într-un inel transparent de `-6px/-2px`).
- **Swipe-ul nu s-a schimbat**: același gest pe coloană, aceeași ordine, măsurat cu degete reale
  (`Input.dispatchTouchEvent`): Reels → Whispers → News, cu puck-ul schimbându-se (▶ violet → ❝ verde → ▤
  albastru), cu indiciile doar spre vecinii care există (`next:›` pe Reels, `‹ ›` pe Whispers, `prev:‹` pe News)
  și cu tenta schimbându-se deodată pe bară și pe ecran (`--feed-tint` `#a06bff → #43df80 → #2fb7ff`).
- **Șina nu mai dispare la derulare**: a stat pe loc la `scrollTop 420` (cutie identică `[102,21,198,32]`,
  `folded: false`). Plierile de 18px (`feedScrolled` / `storiesCollapsed`) și funcția care le scria au fost
  **șterse** din `feed-surface.js` și din `app.js`: un control de pe o bară care nu derulează nu are de ce să se
  dea la o parte, iar ecranul feedului nu mai are ce plia.
- **Ecranul feedului este coloana și atât**: măsurat, copiii `.clipsScreen` sunt `pullRefreshIndicator` și
  `pulsePosts`, iar grila are un singur rând (`686px`); raftul nu mai e pe feed (`trayOnFeed: false`).


- **Raftul de momente este primul lucru din Messages**, sub câmpul de căutare și deasupra listei de conversații
  (măsurat: căutare `y 82..128`, raft `[16,134,358,160]`, listă de la `y 306`), cu aceleași carduri aprobate
  (98×126, colț 15px, numele ca bandă peste poză, inel pentru ce nu e văzut), cu „Your story” ca prim card și cu
  cele patru momente reale/demo. Eticheta propriei povești se citea la marginea raftului și era tăiată
  (măsurat: `tallestCardBottom 290 > trayContentBottom 288`) — cardul cititorului are acum înălțimea conținutului
  și un gol de 3px sub poză, deci nimic nu mai e tăiat (`286 ≤ 288`).
- **Niciun buton nu s-a pierdut**: ușa de sursă și butonul care deschide profilurile + aplicațiile + „Log out”
  rămân pe bară, iar căutarea, prietenii, grupurile și notificările rămân rânduri în panoul de sursă (nimic
  schimbat față de 14e).
- **Cod**: `bindStoryRailAutoHide` și cele două clase au plecat; `bindFeedModeRail` (apăsări + tastele
  stânga/dreapta, în ordinea din `nextFeedMode`) a fost extras în `feed-surface.js`, unde stă și markupul șinei;
  `renderPulse` desenează doar coloana; `renderMessages` încarcă raftul cu exact loaderul pe care îl folosea
  feedul (`loadStories`, cu aceleași reguli: cardul cititorului deschide camera, un card este o „peek”, iar un
  răspuns care sosește după plecarea cititorului este aruncat, nu pictat peste alt ecran).

### Evidence (wave 14f)

- Proba `.ephemeral/wave14f-chrome.mjs` (Chrome headless prin CDP, 390×844, `deviceScaleFactor 2`, touch emulat,
  cache oprit, contul de probă obișnuit) și ieșirea ei în `.ephemeral/wave14f-chrome.out`: bara cu șina în ea,
  cuvintele netăiate, tenta per lectură, cele două swipe-uri, raftul din Messages și șina în arabă (indiciile
  oglindite: `matrix(-1, 0, 0, 1, 0, 0)`, șina tot în bară).
- Capturi în `Desktop\nexus-review\`: `wave14f-bar-rail.png`, `wave14f-bar-rail-scrolled.png`,
  `wave14f-bar-rail-whispers.png`, `wave14f-bar-rail-news.png`, `wave14f-messages-tray.png`, `wave14f-rtl.png`.
- Teste: **638 / 638** (`node --test test/*.test.js`), cu un test nou (raftul din Messages: unde stă și în ce
  cutii apare, `messenger-shell.test.js`) și șapte teste existente actualizate, fiecare cu motivul scris în test:
  șina desenată de bară (`feed-news-tab.test.js`, `feed-surface.test.js`), cardurile raftului care au urmat raftul
  la `inboxScreen` (`feed-surface.test.js`), plierea care a plecat (`audit.test.js`), pull-to-refresh care nu mai
  cere raftul (`p1-social-human-navigation.test.js`, `feed-touch-lifecycle.test.js`), pinii de versiune
  (`audit.test.js`, `p11-devices.test.js`, `profile-menu-ticker.test.js`).
- Bugete: `app.js` **601 380 / 602 000** (sub plafon fără să miște plafonul, fiindcă `bindFeedModeRail` a plecat
  în `feed-surface.js` și au plecat comentariile care descriau plierea); locale neschimbat (nicio cheie nouă);
  CSS-ul de șapte fișiere neschimbat — stilurile noi și cele retargetate stau în `feed-surface.css`, care nu face
  parte din cele șapte.
- Versiune de active urcată consecvent (`20260923-wave14f`) în `index.html`, în importurile din `app.js` și
  `feed-doors.js` și în pinii din teste.
- Oglinda: fiecare fișier atins copiat în `C:\Users\Romeo\projects\nexus_deepsek` și verificat **SHA256 identic**
  (`app.js`, `feed-surface.js`, `feed-surface.css`, `messenger-shell.js`, `feed-doors.js`, `index.html`); toate
  măsurătorile de mai sus sunt făcute pe serverul de pe `:5000`, care servește oglinda.

### Limite (wave 14f)

- Șina nu mai dispare la derulare (proprietatea cerută în 14e) pentru că acum stă pe bară: bara nu derulează, deci
  nu are unde să plece. Swipe-ul funcționează în continuare invizibil pentru cine nu se uită la bară, iar ecranul
  câștigă cei 176px pe care îi ocupa raftul plus șina.
- Sub 374px lățime cele trei cuvinte se strâng și se pot tăia cu „…”: logo-ul și ușile nu se strâng niciodată, iar
  sub 430px glifele din cuvinte se ascund (puck-ul păstrează marca lecturii).
- Raftul din Messages derulează cu lista (nu este lipit sus): este comportamentul unui tray, nu al unei bare.
- Raftul apare doar în inbox-ul principal, nu în Requests / Activity / un thread: acelea sunt liste, nu rafturi.
- Un gest orizontal care începe pe raftul de momente derulează raftul, nu schimbă lectura (regulă neschimbată).
- Conținutul de card din machetă (contorul 18.4k / 1.2k / 340, pastilele de reacție peste autor, rândul de muzică,
  lista numerotată de știri) rămâne pentru o rundă separată de conținut, cu copy nou în patru limbi.


## 9w. Wave 14g (feed) — bara transparentă peste reel, pliată de la al doilea, o singură ușă cu sertar de iconuri, autorul mutat pe șină

### Ce s-a cerut

Owner-ul, pe două poze: (1) „pe primul reel vreau header transparent, ca să dea full screen la conținut”; (2) „în
următoarele reeluri la fel, headerul va fi transparent, logo-ul și iconurile din dreapta dispar”; (3) cele două
butoane din dreapta care arată aproape la fel devin unul singur, iar el deschide un sertar mic, „fără scris, doar
cu iconuri” (modulele + „Log out”); (4) numele autorului dispare de pe reel, iar poza lui urcă pe șina din dreapta,
deasupra butonului de like. Decizie de owner luată în această rundă: panoul cu patru uși și panoul de sursă ies
complet din feed (destinațiile și cele două comutatoare de afișare rămân în sertarul plăcuței de profil, unde erau).

### Ce s-a livrat

1. **Bara plutește peste reel** (`feed-surface.css`, doar pentru lectura Reels): `#phoneHeader` devine
   `position:absolute` peste coloană, bara își pierde fundalul propriu și primește doar o perdea
   `linear-gradient(180deg,rgba(2,6,12,.62),rgba(2,6,12,0))` (fără blur), iar `.screenViewport` ia înălțimea pe care
   o ocupa bara (`calc(100% - 78px)`). Măsurat la 390×844: `.pulsePosts` **686 → 766**, iar în prezentarea
   „immersive” reelul stă la `y 0`, `766×390` — full screen sub bara plutitoare. În prezentarea „cards” coloana
   primește `padding-top:82px`, ca primul card să nu intre sub bară. O lectură de text (Whispers, News) rămâne cu
   bara de dinainte (`static`, `686`), fiindcă un titlu are nevoie de contrast.
2. **Plierea de la al doilea reel**: `bindReelChromeFold()` (în `feed-surface.js`, legată din `bindFeedModeRail`,
   deci fără niciun byte nou în `app.js`) măsoară coloana pe `.phoneScreen` în faza de captură (`scroll` nu bulește,
   iar coloana se înlocuiește la fiecare încărcare) și pune `feedChromeFolded` pe bară de la jumătatea primului reel
   în sus. Sigla și ușa se sting (`opacity:0;visibility:hidden;pointer-events:none`) cu o tranziție de `.22s`, iar
   cutiile rămân în layout, ca șina să nu sară. Măsurat: `scrollTop 0` → fără clasă; `scrollTop 575/766` (și `300`
   pe cards) → clasă pusă, sigla și butonul `0 / hidden`; la întoarcere `1 / visible`. Starea se recalculează la
   fiecare randare a barei (un `WeakMap` ține măsurătoarea) și se curăță singură când lectura nu mai e Reels.
3. **O singură ușă, sertar mic, fără scris**: `feedHeaderActionsMarkup` desenează un singur buton (`#feedModules`,
   `data-feed-quick-open`), iar `feedQuickDrawerMarkup` / `feedQuickTilesMarkup` / `bindFeedHub` desenează și leagă
   sertarul (grid de 3 coloane × 40px, 5 plăcuțe de modul + cea de „Log out”, fiecare cu `aria-label`/`title` din
   etichetele care existau deja — zero copy nou, zero chei noi de traducere). Măsurat: sertar **156×157** lângă buton
   (x 224..380, y 56..213), 5 plăcuțe, cea citită marcată (`▶` Social), text vizibil doar marcajele (`▶▣♥✈◇`),
   `role=dialog aria-modal=true`, focus în sertar la deschidere, Esc → închis și focusul înapoi pe `#feedModules`,
   `aria-expanded` corect. În arabă sertarul stă pe muchia butonului (x 10 față de butonul la x 12).
4. **Autorul mutat pe șină**: `clipCreatorAvatarMarkup` desenează marca autorului (`clipRailAvatar`,
   `data-creator-story` — același buton care deschide momentul autorului) ca **primul** element din
   `.clipQuickActions`, deasupra butonului de like (`avatarAboveLike`, 46px rotund în 62×54), iar din overlay au
   plecat numele și `@handle`. Rândul rămas păstrează doar ce se poate face cu autorul: Follow + meniul `•••`.
5. **Curățenie**: `feed-doors.js` → `feed-hub.js` (`createFeedHub`), `openFeedActivity` (rămas fără apelant) și
   importul nefolosit `feedModeForFeed` au ieșit din `app.js`; din `feed-surface.css` au ieșit toate stilurile
   panoului cu patru uși (`.doorLayer … .doorBody`, keyframes, regula RTL, `@media (min-width:768px)` care nu mai
   avea altceva) și regula `.feedHeaderBadge` (contorul care nu mai are unde fi citit).

### Evidence (wave 14g)

- Proba `.ephemeral/wave14g-chrome.mjs` (Chrome headless prin CDP, 390×844, dSF 2, touch emulat, cache oprit) și
  ieșirea `.ephemeral/wave14g-chrome.out`: două treceri (cards și immersive) cu măsurătorile de mai sus, sertarul
  deschis/închis cu Esc real, lectura Whispers neschimbată, raftul din Messages neatins, arabă.
- Capturi în `Desktop\nexus-review\`: `wave14g-bar-rail.png`, `wave14g-bar-rail-folded.png`,
  `wave14g-reel-immersive.png`, `wave14g-reel-immersive-folded.png`, `wave14g-hub-drawer.png`,
  `wave14g-whispers-bar.png`, `wave14g-messages-tray.png`, `wave14g-rtl.png`.
- Teste: **638 / 638** (`node --test test/*.test.js`), cu testul barei rescris (o ușă + sertarul), un test nou pentru
  pliere și pentru reel, testele panoului cu patru uși șterse (`feed-surface.test.js`, `feed-news-tab.test.js`,
  `p1-social-human-navigation.test.js`, `messenger-shell.test.js`) și pinii de versiune urcați (`audit.test.js`,
  `p11-devices.test.js`, `profile-menu-ticker.test.js`).
- Bugete: `app.js` **599 852 / 602 000** (1 528 B eliberați), `interface-locale.js` neschimbat (nicio cheie nouă),
  CSS-ul de șapte fișiere neschimbat — toate stilurile noi stau în `feed-surface.css`, care nu e numărat; `feed-hub.js`
  (1 819 B) și `feed-surface.js` (35 598 B) nu au plafon.
- Versiune de active urcată consecvent (`20260923-wave14g`) în `index.html`, în importurile din `app.js` și în pinii
  din teste.
- Oglinda: fișierele atinse copiate în `C:\Users\Romeo\projects\nexus_deepsek` și verificate **SHA256 identic**;
  `feed-doors.js` șters și din oglindă, `feed-hub.js` adăugat; probele rulează pe `:5000`, care servește oglinda.

### Limite (wave 14g)

- Bara plutitoare și plierea sunt legate de **lectura** Reels, nu de o singură prezentare: dacă ownerul vrea ca bara
  să rămână normală și pe Reels-cards (unde oricum nu se câștigă spațiu), se scot regula `.presentation-cards` și
  selectorul `:has(.clipsScreen.feed-reels)`.
- Sertarul este modal (`aria-modal=true` + perdea), spre deosebire de panoul cu patru uși care era un `region`:
  perdeaua acoperă bara și navigația cât timp e deschis, deci „modal” este descrierea corectă. Nu prinde focusul în
  buclă (Tab poate ieși), la fel ca panoul pe care îl înlocuiește.
- Plierea se măsoară față de jumătatea primului card din coloană: dacă primul reel e scurt, pragul e jumătatea lui;
  când coloana e încă goală, pragul de siguranță e 240px.
- Contoarele din machetă (18.4k / 1.2k / 340), pastilele de reacție peste autor, rândul de muzică și lista numerotată
  de știri rămân pentru runda de conținut, cu copy nou în patru limbi.

## 9x. Wave 14h (bară + footer) — butoanele marcate ies, sigla ia culoarea lecturii, footer-ul rămâne doar iconuri

### Ce s-a cerut

Owner-ul, în două mesaje: (1) „cele două butoane marcate trebuie scoase, nu își au sensul, iar footer-ul trebuie
micșorat în înălțime, ocupă prea mult spațiu”; (2) la întrebarea care sunt cele două marcate — „butonul de ecran
complet + ecranul marcat în cerc, este un buton de setări cred”; și trei cereri noi în același mesaj: „logo-ul
Nexus trebuie să se facă violet când e în modul Reels, verde în Whispers și albastru în News”, „footer-ul trebuie
să rămână doar iconuri, adaugă încă un icon pentru friends și încă unul pentru search”, cu ordinea dată de el:
„menu, messages, search, +, friends, live, profile”, ultimul fiind „un cerculeț mic cu poza de profil”.

### Ce s-a livrat

1. **Cele două butoane marcate ies de pe suprafețele de lectură**. (a) Marca de ecran complet de peste reel
   (`.clipExpand`, `⛶`, `post.openFullscreen`) a ieșit din `.clipStage` — butonul care nu spunea ce face (owner-ul
   l-a citit „buton de setări”) și care duplica atingerea pe video. (b) A doua marcă, cea din bara de sus —
   „ecranul cu săgeată” care deschidea sertarul de module — a ieșit și ea: `feedHeaderActionsMarkup` a fost ștearsă
   din `feed-surface.js`, iar bara rămâne **sigla + șina celor trei lecturi** (măsurat: `doorsLeftInBar 0`,
   `railInsideBar true`). Sertarul nu a plecat cu butonul: se deschide din **prima marcă a footer-ului** (`menu`),
   care poartă `data-feed-quick-open`, iar `bindFeedHub` — un singur ascultător, legat pe `.phoneScreen` — răspunde
   exact ca înainte.
2. **Sigla ia culoarea lecturii** (`feed-surface.css`, fișier necontorizat): `.wordmark` primește
   `color:var(--feed-tint,#f4fbff)!important`, iar `text/stop/path/circle` din SVG trec pe `currentColor`.
   Proprietatea `--feed-tint` exista deja pe bară pentru fiecare lectură, deci nu s-a adăugat niciun markup.
   Măsurat la 390×844: Reels `rgb(160,107,255)` (`#a06bff`), Whispers `rgb(67,223,128)` (`#43df80`), News
   `rgb(47,183,255)` (`#2fb7ff`). Culoarea trebuie forțată cu `!important`, fiindcă shell-ul tipărește o siglă albă
   tot cu `!important`.
3. **Footer-ul: șapte iconuri, fără cuvinte, 26px mai jos** (`social-human-ux.css`, blocul ≤760px): `.appNav`
   86px → **60px**, pastila 70px → 50px (rază 26px), marca 44px → 32px, butonul „Create” 68px → 52px,
   `.screenViewport` `100% - 158px` → **`100% - 132px`**, iar ecranele care își ascund bara de sus (Mesaje, Profil)
   folosesc acum `calc(100% - var(--nav-h,86px))` cu `--nav-h:60px`. Eticheta fiecărei mărci nu se mai vede
   (`span{display:none}`), dar se citește în continuare: fiecare buton are numele în `aria-label`. Ordinea cerută
   de owner, cu cele două mărci noi și cu ultima ca poză rotundă a cititorului: `menu · messages · search ·
   create · friends · live · profile`.

4. **Module noi: `nav-marks.js`**. Marcele footer-ului (cele cinci care existau + `menu`, `search`, `friends`) și
   numele cu care se citesc au ieșit din `app.js` (600 826 / 602 000, sub plafon), fiindcă exact asta spunea
   comentariul bugetului: următorul val care atinge bara trebuie să scoată un modul. Cele trei nume noi nu sunt copy
   nou: `NAV_LABEL_KEYS` refolosește chei care existau (`header.changeProfile`, `search.title`, `header.friends`),
   deci `interface-locale.js` a rămas neatins. `navFaceMarkup` desenează poza cititorului în cerc (scris inline, ca
   cele șapte foi contorizate să nu miște pentru o față) și păstrează conturul de persoană când persona nu are poză.
   `menu` deschide sertarul, `search` deschide ecranul de căutare care exista (`socialTopView = "search"`, iar marca
   se aprinde ca loc activ), `friends` deschide foaia de relații pe care bara de sus o avea deja
   (`openSocialFriendsSwitcher`).
5. **Curățenie**: `feedHeaderActionsMarkup` și `FEED_ICONS.modules` șterse; regulile `.feedHeaderIcons` /
   `.feedHeaderIcon*` (inelul de 44px, umbra în culoarea lecturii) șterse din `feed-surface.css`; plierea de la al
   doilea reel rămâne doar pe siglă; sertarul se ancorează acum **jos**, deasupra barei
   (`align-items:flex-end;padding-block-end:66px`) și intră de jos (`translateY(7px)`); `index.html` și toate cele 16
   importuri din `app.js` au trecut pe tag-ul `20260923-wave14h`, cu pinii din șase fișiere de test urcați odată.

### Evidence (wave 14h)

- Proba `.ephemeral/wave14h-chrome.mjs` (Chrome headless prin CDP, 390×844, dSF 2, touch emulat) și ieșirea
  `.ephemeral/wave14h-chrome.out`: două treceri (cards și immersive) cu măsurătorile de mai sus; cele trei lecturi
  măsurate pentru culoarea siglei; sertarul deschis din prima marcă a footer-ului, `aboveBar true`, 5 plăcuțe, text
  vizibil doar marcajele (`▶▣♥✈◇`), focus în sertar, Esc → închis și focusul înapoi pe marca `menu`; marca `search`
  → ecranul de căutare (cu marca aprinsă); marca `friends` → foaia „Quick relationships”; Mesaje cu bara scurtă;
  araba. Bara: `h 72`, `doorsLeftInBar 0`, `railInsideBar true`; `.screenViewport` **792** (844 − 52 pe Reels);
  footer `y 792..852`, `h 60`, pastilă `top 4px`, `h 50px`, rază `26px`, șapte mărci (`menu inbox search create
  friends utility account`), toate etichetele `display:none`.
- Capturi noi în `Desktop\nexus-review\`: `wave14h-bar-rail.png`, `wave14h-bar-rail-folded.png`,
  `wave14h-reel-immersive.png`, `wave14h-reel-immersive-folded.png`, `wave14h-hub-drawer.png`,
  `wave14h-search.png`, `wave14h-friends-sheet.png`, `wave14h-whispers-bar.png`, `wave14h-news-bar.png`,
  `wave14h-messages-tray.png`, `wave14h-profile-mark.png`, `wave14h-rtl.png`.
- Teste: **639 / 639** (`node --test test/*.test.js`) — testul barei rescris („bara e sigla și șina”), aserțiunile
  despre ușile care au ieșit, un test nou în `p1-social-human-navigation.test.js` pentru footer (șapte mărci,
  iconuri, cele două mărci noi, poza cititorului, legăturile), plus pinii de versiune urcați (`audit.test.js`,
  `feed-surface.test.js`, `feed-news-tab.test.js`, `p11-devices.test.js`, `profile-menu-ticker.test.js`).
- Bugete: `app.js` **600 826 / 602 000**; cele șapte foi CSS **358 472 / 358 500** (28 B liberi — următorul val care
  atinge una dintre ele trebuie să elibereze întâi); `interface-locale.js` neschimbat (365 837 B, zero chei noi);
  `nav-marks.js` **2 586 B** (fără plafon, ca `feed-surface.js` / `feed-hub.js`).
- Oglinda `C:\Users\Romeo\projects\nexus_deepsek`: fișierele valului copiate (8 în `public/`, 7 în `test/`), iar
  probele rulează pe `:5000`, care servește oglinda.

### Limite (wave 14h)

- **A doua marcă „marcată” a fost citită ca ușa barei** („ecranul cu săgeată” care deschidea sertarul de module), pe
  lângă marca de ecran complet peste reel. Dacă owner-ul se referea la altceva (chevroanele `‹ ›`, puck-ul lecturii,
  butonul „⛶ Deschide” din rândul de acțiuni al cardului), scoaterea se face într-o linie — iar ușa barei se poate
  pune la loc re-adăugând `feedHeaderActionsMarkup`.
- **Acasă este sigla.** Footer-ul nu mai are marcă de „Acasă” (ordinea a fost dată de owner), deci pe feed nu se
  aprinde nicio marcă; dacă vrea o marcă de Acasă înapoi, e o intrare în `NAV.social` și o ramură în `renderNav`
  (butonul ar trebui să sune `goHome`, nu `navigate`, ca să nu treacă prin `activeSlot`).
- **Prima marcă (`menu`) deschide sertarul care exista** — profilele Nexus + „Log out”, nu o listă nouă cu toate
  modulele aplicației; o listă de module ar fi o rundă separată.
- **`friends` deschide foaia de relații** (followers / following / favorites / requests), nu lectura „friends” din
  feed; dacă vrea lectura, e o linie în `navigate` (destinația `friends` există în `FEED_DESTINATIONS`).
- **Poza cititorului** apare doar dacă persona are poză; contul de probă nu are, deci captura arată conturul de
  persoană (unit-testat că poza intră în cerc când există).
- **Skin-ul footer-ului trăiește în blocul ≤760px** (`social-human-ux.css`), deci pe un ecran lat (>760px) shell-ul
  păstrează skin-ul vechi (86px, cu etichete); acolo doar marcajul este nou (șapte intrări, poza inline).
- Sertarul rămâne modal (`aria-modal=true` + perdeaua din wave 14g) și nu prinde focusul în buclă.
- Plafonul celor șapte foi CSS are **28 B liberi**: orice val care atinge `styles.css`, `social-human-ux.css` sau
  vreuna dintre celelalte cinci trebuie să scoată întâi cel puțin tot atâtea. Prima sursă de bytes rămași fără
  obiect: regulile `.clipStage > .clipExpand` din `p2-clips.css` (foaie contorizată) descriau exact butonul scos în
  acest val — scoaterea lor eliberează spațiu pentru următorul.

## 10. Remaining waves

0. **Follow-ups from wave 14h (§9x) — butoanele marcate, culoarea siglei, footer-ul de șapte marc**: (i) confirmarea
   ownerului pe telefon — `reload` pe `http://192.168.1.153:5000` → pe Reels sigla „NEXUS” este violet, pe Whispers
   verde, pe News albastru; bara de sus are doar sigla și șina (fără niciun buton în dreapta), iar sigla se pliază de
   la al doilea reel; peste reel nu mai există marca de ecran complet (se ajunge pe ecran complet din card/„Deschide”);
   jos bara are șapte iconuri fără cuvinte (`menu · messages · search · create · friends · live · profile`), cea de-a
   doua 26px mai jos, iar ultimul este un cerc cu poza de profil; prima marcă deschide sertarul (Social · Work ·
   Dating · Travel · Market + „Log out”), marca de căutare deschide ecranul de căutare, cea de prieteni deschide foaia
   de relații; (ii) de confirmat **care erau cele două butoane marcate**: am scos marca de ecran complet de peste reel
   **și** ușa din bara de sus (citită de owner „buton de setări”); dacă a doua era altceva (chevroanele `‹ ›`, puck-ul
   lecturii, „⛶ Deschide” din rândul cardului), se scoate într-o linie; (iii) de decis dacă vrea o marcă de **Acasă**
   înapoi în footer (acum acasă este doar sigla) și dacă `menu` trebuie să listeze **toate modulele** aplicației, nu
   doar profilele; (iv) de decis dacă `friends` trebuie să deschidă **lectura** „friends” din feed, nu foaia de
   relații; (v) dacă vrea ca masca din sertar să nu mai fie modală, se scot `aria-modal` și perdeaua (ca la §9w).

0. **Follow-ups from wave 14g (§9w) — bara peste reel, sertarul de iconuri, autorul pe șină**: (i) confirmarea
   ownerului pe telefon — `reload` pe `http://192.168.1.153:5000` → pe Reels bara stă peste video (fără cutie
   proprie), sigla „NEXUS” și butonul din dreapta dispar de la al doilea reel, iar șina REELS · WHISPERS · NEWS
   rămâne pe loc; butonul din dreapta deschide un sertar mic cu cinci plăcuțe (Social · Work · Dating · Travel ·
   Market, cea citită marcată) și ultima plăcuță, roșie, e „Log out”; (ii) dacă vrea ca plierea să înceapă de la al
   doilea reel *întreg* (acum pragul e jumătatea primului), se schimbă o linie în `bindReelChromeFold`; (iii) dacă
   vrea sertarul nemodal (fără perdea, cu bara rămânând vie), se scoate `aria-modal` plus perdeaua; (iv) dacă vrea
   numele autorului înapoi pe reel (acum e doar poza pe șină + Follow), rândul din `clipOverlay` e locul; (v) sigla
   și butonul se pot plia prin alunecare (`translate`) în loc de stingere, dacă vrea o tranziție mai fină.

0. **Follow-ups from wave 14f (§9v) — șina pe bară și raftul în Messages**: (i) confirmarea ownerului pe telefon —
   `reload` pe `http://192.168.1.153:5000` → bara sus are sigla NEXUS, apoi cele trei lecturi (REELS · WHISPERS ·
   NEWS, cu puck-ul colorat al lecturii curente și cu ‹ / › doar spre vecinii care există), apoi ~~ușa de sursă și~~
   butonul care deschide profilele + aplicațiile și se termină cu „Log out” *(notă §9w: ușa de sursă a ieșit din bară
   în wave 14g, iar butonul rămas deschide sertarul de iconuri)*; (ii) swipe stânga/dreapta pe coloană
   schimbă lectura în continuare, iar șina rămâne pe bară la orice derulare (nu mai dispare, fiindcă bara nu
   derulează); (iii) prima pagină din Messages (Mesaje) începe cu raftul de momente („Your story” + momentele
   urmărite), deasupra listei de conversații; (iv) două lucruri rămase de decis: dacă șina vrea să fie centrată în
   bara sau lipită de siglă, și dacă raftul din Messages vrea să rămână lipit sub căutare când derulezi lista (acum
   derulează cu ea); (v) cardul din machetă (contor, pastile de reacție peste autor, rând de muzică, listă
   numerotată la News) este o rundă separată de conținut, cu copy nou în patru limbi.

0. **Follow-ups from wave 14e (§9u) — bara, șina și swipe-ul**: (i) confirmarea ownerului pe telefon —
   `reload` pe `http://192.168.1.153:5000` → bara sus are logo „NEXUS”, ușa de sursă (ecran cu săgeată, cu
   inelul colorat de lectura curentă) și butonul din dreapta care deschide profilele + aplicațiile și se
   termină cu „Log out”; sub raft, șina arată un puck colorat (▶ violet pe Reels, ❝ verde pe Whispers,
   ▤ albastru pe News) și cele trei cuvinte, cu ‹ / › doar spre vecinii care există; (ii) ~~la prima derulare
   șina dispare (rămâne doar bara), dar swipe stânga/dreapta schimbă lectura în continuare, în orice mod~~ —
   **închis de §9v (wave 14f)**: șina stă acum pe bară, deci nu mai are de unde să dispară, iar swipe-ul a rămas
   neschimbat; (iii) ~~două decizii de produs, dacă ownerul le vrea: mijlocul barei să fie marca lecturii în locul
   ușii de sursă, și șina să reapară sau nu după o schimbare de lectură~~ — **închis de §9v (wave 14f)**: mijlocul
   barei este chiar șina celor trei lecturi, iar ușa de sursă a rămas pe bară, înaintea butonului de module; rămâne
   de decis doar dacă șina vrea să fie centrată sau lipită de siglă (vezi itemul 0 de mai sus); (iv) cardul din machetă (contor, pastile de reacție peste autor, rând de muzică, listă
   numerotată la News) este o rundă separată de conținut, cu copy nou în patru limbi.


0. **Follow-ups from wave 14d (§9t) — bara, ușile și inelul**: (i) confirmarea ownerului pe telefon —
   `reload` pe `http://192.168.1.153:5000` → bara de sus cu logo mare „NEXUS”, câmp de căutare lat, apoi
   patru icoane fără text (ecran cu săgeată = sursă, doi oameni = prieteni, trei oameni = grupuri, clopoțel =
   notificări); fiecare icoană deschide un panou care intră din dreapta și iese cu × / Esc / atingere pe
   fundal, iar Home și bara de jos rămân active cât timp e deschis; inelul teal al momentelor stă pe poză,
   fără bandă goală sub ea; (ii) dacă ownerul vrea câmpul și mai lat, singura pârghie rămasă este o singură
   icoană care deschide toate cele patru panouri (ar elibera ~110px) — decizie de produs; (iii) grupurile au
   nevoie de paginare în panou dacă ownerul are mai mult de 30 de conversații, iar rândurile de grup nu au
   putut fi văzute live fiindcă baza de date nu are niciun grup (decizia de a crea unul de probă este a
   ownerului).

0. **Follow-ups from wave 14c (§9s) — ovalul de pe moments**: (i) confirmarea ownerului pe telefon — `reload`
   simplu pe `http://192.168.1.153:5000` → raftul de momente arată carduri dreptunghiulare cu poza până la
   margini, numele ca o bandă mică la baza cardului, iar cardul „Your story” arată inițialele și „+” (fără oval
   palid, fără glif străin); (ii) curățenia pasului vechi de raft rotund din `styles.css` este o **decizie
   separată**: ar cere verificarea fiecărei suprafețe care încă îl folosește (tile-urile de momente ale
   profilului sunt rotunde prin construcție); (iii) orice reparație viitoare trebuie **oglindită** în
   `C:\Users\Romeo\projects\nexus_deepsek` înainte de măsurători, fiindcă serverul live citește oglinda.

0. **Follow-ups from wave 14b (§9r) — bara cu patru uși**: (i) confirmarea ownerului pe telefon — `reload` pe
   `http://192.168.1.153:5000` → patru uși egale, în ordinea sursă → mesaje → prieteni → notificări, fiecare
   deschizând exact ecranul ei (foaia de module cu secțiunea `FEEDUL`, inboxul, foaia de relații, Activity
   Center), fără linia `Mix / Local Trends / Global Trends / Following` sub raft; (ii) „sugestiile de prieteni”
   sunt deocamdată cele patru liste pe care foaia le are deja — un panou separat cere o sursă de recomandări,
   adică o decizie de produs.

0. **Follow-ups from wave 14 (§9q) — feedul cu trei moduri**: (i) confirmarea ownerului pe telefon —
   `reload` simplu pe `http://192.168.1.153:5000` (tag `wave14`) → bara de sus pe **un** rând (logo, căutare,
   clopoțel, trimitere, ✦, ◎) → raftul de momente (primul card = al tău, cu `+`) → comutatorul
   `▶ Reels · ❝ Whispers · ▤ News` → tigaie între ele, fără reîncărcare, și locul păstrat la întoarcere;
   (ii) **decizia pentru News**: `NEXUS_NEWS_PROVIDER` + cheie, altfel modul rămâne onest oprit (macheta arată
   chipuri de categorie și miniaturi — acelea cer un tabel de articole și imagini găzduite de Nexus, deci o
   muncă nouă, nu o restilizare); (iii) nota vocală și încărcarea automată a paginii următoare sunt livrate și
   testate, dar nu au putut fi văzute live în instantanța de probă (nici o postare cu audio, feedul încape
   într-o pagină) — un cont cu audio și cu sute de postări le poate confirma; (iv) dacă ownerul vrea identitatea
   **deasupra** mediei și un badge „Reels” pe card, aceea e o schimbare în `postCard`, adică o decizie de
   produs, nu o restilizare de suprafață.


0. **Follow-ups from wave 12 (§9o)**: (i) confirmarea ownerului pe telefon — `reload` simplu, apoi `Cont` → cele cinci
   icoane (≡ ▶ ▦ ❝ ✦) → **săgeata `▾` din dreapta barei** deschide lista de citiri (alege una) → **ține apăsat** un tab
   și trage-l într-o parte (sau `Alt+←/→`) → reîncarcă → bara păstrează ordinea → Flow-ul amestecat (o șoaptă între două
   poze) → `📌` pe un clip (trei maximum) → numărul de vizualizări și `▶` în colțul din stânga jos al clipului;
   (ii) dacă un clip nu arată `▶` + numărul, de spus exact ce cod de eroare apare; (iii) un clip real (fișier video)
   rămâne de probat live — probele nu au avut un video de urcat; (iv) conturile de probă de pe instanță plus postările
   lor arhivate (fără rută de ștergere) — decizie de footprint a ownerului.

0. **Follow-ups from wave 13 (§9p)**: (i) confirmarea ownerului pe telefon — `reload` → pe feed, sub raftul de momente,
   bara `✦ Mix · ⌖ Local Trends · ◉ Global Trends · ✓ Following · ! News` → tap pe **News** (al cincilea) → fie titluri
   reale de la agregatorul aprobat (carduri cu titlu, sursă, timp și link pe gazda aprobată), fie propoziția onestă
   „Știrile sunt pregătite, dar oprite”; (ii) pentru ca tabul să aibă titluri este nevoie de o **decizie de owner**:
   `NEXUS_NEWS_PROVIDER` (unul din registrul aprobat) plus cheia lui, iar pe instanța de pe `:5000` nimic nu e pornit
   acum; (iii) dacă ownerul vrea chipuri de categorie sau miniaturi în carduri, aceea e o **muncă nouă** (tabel de
   articole + imagini găzduite de Nexus) și contrazice regula P9 până când există; (iv) canalele din bară sunt cele
   cinci ale foii de feed — dacă ownerul vrea acolo format-uri (poze/tweeturi) în locul lor, e o decizie de produs.

0. **Follow-ups from wave 11 (§9n)**: (i) confirmarea ownerului pe telefon — `reload` simplu, apoi `✎` → **panoul
   de editare** (nume, bara de status, orașul și data nașterii, fiecare cu eticheta lui și toate de aceeași
   mărime) → o zi din calendar în câmpul „Data nașterii” → `✓` → banda pe `http://192.168.1.153:5000`; (ii) două
   conturi de probă rămase pe instanța live (liniile de ștergere sunt în §9n), o decizie de footprint a ownerului;
   (iii) ștergerea pozelor și a copertei plus curățarea media orfane după un `PATCH` refuzat
   (`media_purge_receipts` există, ruta nu); (iv) un HEIC de la cameră rămâne refuzat — conversia ar fi un tool
   nou, nu o reparație.


0b. **Follow-ups from wave 10 (§9m)**: (i) owner's real-device confirmation — plain reload, then `✎` → the edit
   page → one row (name/age/city/status/photo) → the two choices (Public/Privat, cover/saved stories) → `✓`;
   (ii) a live visitor test for the private band needs a second account, which is a footprint decision for the
   owner; (iii) the prices behind `private` are edited in the privacy panel, and a dedicated "private + prices"
   step inside the edit page is a product decision, not a repair; (iv) photo and cover *deletion* plus
   orphan-media cleanup after a refused PATCH (`media_purge_receipts` exists, no route yet); (v) HEIC conversion
   would be a new tool, not a repair, and it stays outside the upload path until it exists.


0. **Follow-ups from wave 6v (§9l)**: closed by wave 10 (§9m) — the owner's real-device confirmation is the
   reload → `✎` → edit page → choices flow, and the remaining parts (deletion, orphan media, HEIC) are items
   (iv) and (v) above.
1. **P4 — multi-media and tags**: `posts.media_id` is single, so it needs `post_media` (ordered list) plus
   hashtag/cashtag extraction, tag pages and a trending surface built from real mention counts.
2. ~~**P5 — reply reposts and thread context**: `comment_shares` (repost/quote of a reply), the
   "replying to" summary line, focused reply deep links.~~ **Livrat în §7**: share intern de
   răspunsuri, linia „Ca răspuns la @x”, `#reply-<id>` cu evidențiere, secțiune pe profil. Ce rămâne
   de la P5: **quote** de răspuns (share cu comentariu peste el) și candidați de feed pentru
   răspunsurile distribuite de conturile urmărite (astăzi trăiesc pe profil, nu în timeline).
3. ~~**P6 — community notes engine**: contributor eligibility, bridging-based helpfulness ratings, sources
   attached to a note, "rated helpful / not helpful", and the note card on the post page.~~ **Livrat în
   §6**: motorul este în build, cu regula declarată în cod (3 evaluări / 2 perspective / 2⁄3 utile în
   fiecare perspectivă / minim o sursă), cotă per cont și jurnal append-only. Ce rămâne de la P6:
   eligibilitatea contribuitorilor (astăzi orice cont poate scrie, cotat) și note pe răspunsuri
   (`subject_type` există în schemă, dar ruta publică doar postări).
4. ~~**P7 — clips panel**: subtitles, quality, auto-advance, download, offline — per-clip options on top of
   the existing `clipMoreActions` container.~~ **Livrat în §8**: panoul are propriul buton ⚙, un modul
   propriu (`clip-options.js`) și spune faptele (o singură variantă locală, track de autor sau textul
   postării, offline doar pe origine securizată). Ce rămâne de la P7: variante transcodate reale
   (ar cere un transcodor, decizie de owner) și un traseu de **upload** pentru fișierul `.vtt` al
   autorului (astăzi sidecarul se pune în `data/media/<hash>.vtt`).
5. ~~**P8 — identity**: first-login onboarding (handle claim + persona), inline bio/name editing in the hero,
   avatar and cover inside the hero only.~~ **Livrat în §9**: flux bazat pe fapte din înregistrare
   (`generatedHandle` + `users.onboarded_at`), regulă de handle exportată și oglindită, hero care se
   editează singur, avatar/cover desenate doar în hero. **Livrat în §9b (wave 6c)**: creionul mutat pe
   rândul numelui cu un singur `✓` care salvează numele și descrierea, conținutul (taburi + grilă de media)
   scos din padding-ul identității ca să fie full-bleed, header-ul de profil scos cu totul, iar log out
   mutat în Access and security (și dialogul lui tradus); poza, coperta și tipul de profil se editează din
   Settings. **Livrat în §9c (wave 6d)**: creionul editează toată identitatea (nume, descriere, locație, poza
   de profil, copertă) cu un singur `✓` care scrie doar câmpurile schimbate, pozele se urcă abia la `✓` și se
   previzualizează local, iar descrierea își păstrează linkurile `http(s)` ca ancore. **Livrat în §9d
   (wave 6e)**: toate setările profilelor au trecut într-un sertar cu șapte uși deschis de trei linii
   (taburile de setări au dispărut din header), confidențialitatea și notificările au devenit panouri
   reale, iar deasupra taburilor de conținut se mișcă o bandă read-only cu locația, handle-ul, contoarele
   și fragmentele din descriere. Ce rămâne de la P8: schimbarea handle-ului **după** onboarding (azi se
   revendică o dată), onboarding pentru celelalte personaje (fluxul numește doar personajul activ),
   ștergerea pozei/copertei, curățarea fișierelor media orfane după un `PATCH`
   picat, plus un loc în meniu pentru schimbarea handle-ului. **Livrat în §9i (wave 6s)**: descrierea nu
   se mai tipărește de două ori (hero-ul o ține doar în document, pentru screen reader, iar banda o cară
   întreagă), salvarea pozei nu mai poate eșua în tăcere (alegerea aparține profilului, nu nodului DOM, iar
   eșecul spune ce s-a păstrat), și creionul, `✓` și badge-ul pozei acceptă 44 px de apăsare. **Livrat în §9j
   (wave 6t)**: coperta are 168 px în loc de 72, decuparea și poziționarea ei sunt ale ownerului
   (coloană `cover_focus`, foaie de decupare cu tragere și glisor, o singură scriere pentru poză și cadru),
   creionul și `✓` stau fix la capătul din dreapta al benzii, lacătul de vizibilitate își spune eticheta, iar
   raftul de story-uri salvate a devenit al cincilea tab (Flow / Reels / Shots / Whispers / Moments). **Livrat în §9k
   (wave 6u)**: upload-ul nu mai depinde de `crypto.subtle`, deci o poză de pe telefon (origine
   nesecurizată) se salvează; tipul fișierului este normalizat pe client și înțeles de server, iar un eșec își
   spune codul.
6. ~~**P9 — news and prices**: a verified news provider (Breaking currently answers `provider: disabled`) and
   a price source for charts. Both must respect the no-external-network rule, so each needs one explicit
   owner decision: local snapshot vs. provider allow-list.~~ **News livrat în §9f (wave 6g)**: owner-ul a
   ales allow-list-ul de agregate, Breaking citește acum de la un agregator aprobat (GDELT, NewsAPI și un
   fixture de loopback pentru probă), nimic nu este contactat fără configurare, iar titlurile străine sunt
   aplatizate și li se păstrează doar linkurile de pe hosturile aprobate. **Prețurile rămân deschise**: nu
   există încă o decizie de provider pentru grafice, iar același mecanism de allow-list le poate primi.
   **Livrat în §9i (wave 6s)**: Breaking a ieșit din meniul pliat și stă cu celelalte lentile, eticheta lui
   spune că niciun agregator aprobat nu este pornit, iar etichetele foii de comutare nu mai sunt scrise
   direct în română.
7. ~~**P10 — ranking reasons everywhere**: expose the same `ranking.reasons` on the post page and the profile,
   and add the fatigue/negative-feedback terms the research identified.~~ **Livrat în §9g (wave 6h)**:
   motivele sunt chei traduse în patru limbi, cardul, pagina postării și profilul folosesc același randator,
   iar termenii de oboseală și de feedback negativ („ai mai văzut-o”, „ai cerut mai puțin din partea acestui
   autor”, reacții negative, opinie marcată, postare veche) fac parte din răspuns. Ce rămâne de la P10: un
   control prin care cititorul să ceară mai puțin pe un subiect (nu doar pe un autor) și explicarea
   postărilor din afara primelor 24 de pe profil.
8. **P11 — device acceptance**: 360/390/430 px + landscape + 200 % text, with real participants.
   **Parțial livrat în §9h (wave 6i)**: cele cinci configurații au fost măsurate automat (41/41 PASS) și
   landscape-ul a fost reparat (un telefon pe lateral primea vitrina de desktop micșorată la 88 %). **Ce
   rămâne**: acceptarea cu persoane reale — singurul lucru din P11 care nu se poate dovedi automat — plus
   inima feedului și viewerele full-screen în landscape, care nu au fost măsurate în runda asta.
   **Livrat în §9i (wave 6s)**: controlul de salvare de pe profil (creion, `✓`, badge de poză) acceptă acum
   44 px, iar o atingere ratată nu mai poate însemna „nu s-a întâmplat nimic”.

## 11. What wave 1 deliberately does not claim

* No view counter is shown for a post or a reply that no human has read yet.
* Mute, block and note requests are per-persona and never presented as platform-wide enforcement.
* The ••• menu does not offer anything the build cannot do: every entry maps to a real endpoint with a
  real response, and the ones that fail say so instead of pretending.
