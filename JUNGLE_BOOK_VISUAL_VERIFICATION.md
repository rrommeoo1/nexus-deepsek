# JUNGLE BOOK — RAPORT DE VERIFICARE VIZUALĂ

Dispozitiv: `192.168.1.184:39169` (Xiaomi 25098PN5AC, `pandora`), 1220×2656, densitate 520 (override 416).
Pachet: `app.nexus.mobile.dev`. Metro: `http://127.0.0.1:8081` (reverse pe 8081 și 5000).
Capturi: `apps/nexus-mobile/builds/visual/*.jpg` (PNG-ul de pe telefon este șters după conversie).

Stări folosite, fără amestecare:
`IMPLEMENTED` = codul există · `AUTOMATED TESTED` = testele trec · `DEVICE TESTED` = interacțiunea a
fost executată pe telefon · `VISUALLY VERIFIED` = captura a fost deschisă și inspectată ·
`BLOCKED` = nu se poate verifica (motivul este scris) · `FAILED` = criteriu neîndeplinit.

## 1. Matricea celor 27 de contexte

| Tip de postare | Feed | Full-screen | Thumbnail profil |
|---|---|---|---|
| Text scurt | `VISUALLY VERIFIED` — `feed_swipe1.jpg`, `feed_final_text.jpg` (`[test] Tweetul de verificare…`) | `VISUALLY VERIFIED` — `reader_text2.jpg`; cu insetele finale `reader_text6.jpg` (+ crop `rt6_small.jpg`, `rt6_low.jpg`) | `IMPLEMENTED` — arhiva contului nu are postare de text |
| Text lung (peste o pagină) | `IMPLEMENTED` (`textPages`, 5 pagini × 420) — `BLOCKED` fără conținut real | `IMPLEMENTED` — `BLOCKED` | `IMPLEMENTED` — `BLOCKED` |
| Fotografie | `VISUALLY VERIFIED` — `feed_canvas6.jpg`, `feed_frame_inset.jpg` | `VISUALLY VERIFIED` — `reader_canvas3.jpg` | `VISUALLY VERIFIED` — `feed_canvas4.jpg` (celula 1) |
| Video Reel | `VISUALLY VERIFIED` — `feed_swipe2.jpg` | `VISUALLY VERIFIED` — `reader_video_after.jpg`, `reader_video3.jpg` (+ `rv3_top.jpg`, `rv3_bottom.jpg`) | `VISUALLY VERIFIED` — `feed_canvas4.jpg` (celulele 5-6: placă + disc de redare) |
| Text + foto | `VISUALLY VERIFIED` — `feed_canvas6.jpg` | `VISUALLY VERIFIED` — `reader_canvas3.jpg` | `VISUALLY VERIFIED` — `feed_canvas4.jpg` (celula 3) |
| Text + video | `VISUALLY VERIFIED` — `feed_swipe2.jpg` | `VISUALLY VERIFIED` — `rv3_bottom.jpg` (autor, caption pe 3 linii, `Citește tot`, traducere) | `VISUALLY VERIFIED` — `feed_canvas4.jpg` (celula 5, caption „Test") |
| Repost | `DEVICE TESTED` (banda „a repostat la postarea @test") — linia din feed `IMPLEMENTED` | `IMPLEMENTED` | `VISUALLY VERIFIED` (marcaj „⟳" în celulă, `feed_canvas4.jpg`) |
| Quote | `IMPLEMENTED` — `BLOCKED` (niciun quote în conturile accesibile) | `IMPLEMENTED` — `BLOCKED` | `IMPLEMENTED` — `BLOCKED` |
| Conversație | `IMPLEMENTED` — `BLOCKED` | `IMPLEMENTED` — `BLOCKED` | `IMPLEMENTED` — `BLOCKED` |

## 2. Navigare și interacțiuni

| Verificare | Stare | Dovadă |
|---|---|---|
| Swipe vertical între tipuri diferite | `VISUALLY VERIFIED` | `feed_swipe1.jpg` (text) → `feed_swipe2.jpg` (clip cu text) → `feed_swipe3.jpg` (foto) |
| Atingerea unei postări de text deschide reader-ul | `VISUALLY VERIFIED` | `reader_text2.jpg` (înainte de fix: `reader_text.jpg`, rămânea în feed) |
| Atingerea unei postări cu foto/clip deschide reader-ul | `VISUALLY VERIFIED` | `reader_canvas3.jpg`, `reader_video_after.jpg` |
| Atingerea unei celule din profil deschide postarea | `DEVICE TESTED` (deschide reader-ul; indexul nu a fost numărat pe ecran) | `reader_canvas3.jpg` |
| Comentariile pornesc din reader | `DEVICE TESTED` (bara „Adaugă un comentariu…" este prezentă; nu a fost apăsată) | `reader_canvas3.jpg`, `rv3_bottom.jpg` |
| „Citește tot" apare la un caption lung | `VISUALLY VERIFIED` | `rv3_bottom.jpg` (rândul `Citește tot` sub cele 3 linii) |
| Rail-ul (reacții, comentarii, salvare, distribuire, sunet) | `VISUALLY VERIFIED` — aceleași celule 56×56 | `feed_canvas6.jpg`, `rv3_bottom.jpg` |
| Bara de tab-uri nu acoperă textul | `VISUALLY VERIFIED` | `uiautomator`: „Vezi traducerea" la 2172-2224, cadrul se termină la 2281, bara începe la 2393 |
| Back-ul reader-ului nu se suprapune peste autor | `VISUALLY VERIFIED` | `rt6_small.jpg` (săgeata sus, cadrul începe sub ea) |
| Cardul se potrivește în coloană, fără să intre sub bara de tab-uri | `VISUALLY VERIFIED` | `jb_whispers_round5.jpg` — cadru `56,363-1164,2332` (1108×1969 = 9:16), bara începe la 2393 |
| Rândul de acțiuni stă în cadru, sub text | `VISUALLY VERIFIED` | `jb_whispers_round5.jpg` — chips-uri `92,2186-663,2274`, sub ele 58 px până la piciorul cadrului |
| Notificarea „Știri oprite” are titlu și detaliu în română, fără duplicat | `VISUALLY VERIFIED` | `jb_news_round5.jpg` (o singură placă, sub ea doar butonul „Vezi Feed”) |
| Bara feed-ului are un singur punct de schimbare a citirii | `VISUALLY VERIFIED` | `jb_whispers_round5.jpg`, `jb_news_round5.jpg` (pilonul din mijloc), `jb_feed_round5.jpg` (bara Reels, fără marcă) |
| Reader-ul păstrează compoziția și se potrivește sub săgeată | `VISUALLY VERIFIED` | `jb_reader_round5.jpg` — cadru `16,270-1204,2382` (1188×2112 = 9:16), bara de comentariu la 2403 |

## 3. Ce s-a dovedit cu pixelii telefonului

- Cadrul 9:16 este exact: `uiautomator dump` pe Feed a raportat
  `Deschide postarea pe tot ecranul :: 0,112-1220,2281` → 1220×2169 (1220 × 16/9 = 2168.9).
- Aceeași compoziție în trei locuri: feed (`feed_final_text.jpg`, `feed_canvas6.jpg`), reader
  (`reader_video3.jpg`, `reader_text6.jpg`), celulă de profil (`feed_canvas4.jpg`).
- O celulă de clip nu mai este neagră: placă, disc de redare, autor, primele rânduri, chips-uri în colț
  (`feed_canvas4.jpg`, ultimele două celule).
- Un text care nu încape în trei linii primește `Citește tot` (`rv3_bottom.jpg`).

## 4. Limitări de instrumentare întâlnite

- Ecranul telefonului se stinge singur: fără `svc power stayon true` + `KEYCODE_WAKEUP`, `screencap`
  întoarce un JPG negru (prima captură a sesiunii, `baseline_feed.jpg`, a fost neagră din acest motiv).
- `adb exec-out screencap -p` nu poate fi folosit din PowerShell (octeții sunt trecuți prin conversie de
  text): scriptul capturează PNG pe telefon, îl trage ca fișier, îl convertește în JPG și șterge PNG-ul.
- O parte din JPG-urile mari produse în această sesiune nu au putut fi afișate de instrumentul de citire
  (`[media omitted: invalid or exceeds size limit]`), deși fișierul este valid (a fost decodat cu
  System.Drawing pentru a produce crop-urile). Pentru acele ecrane, dovada este crop-ul mic listat mai
  sus (ex. `rt6_low.jpg`, `rv3_bottom.jpg`) plus dump-ul `uiautomator`, nu JPG-ul integral.
- `uiautomator dump` eșuează cu `could not get idle state` pe ecranul de profil (ticker-ul animă), deci
  profilul a fost citit din capturi, nu din arbore.

## 5. Ce rămâne neacoperit (onest)

1. **Quote și conversație**: niciun astfel de post în conturile accesibile de pe telefon. Publicarea în
   producție este interzisă, deci compoziția este doar `IMPLEMENTED`.
2. **Text lung peste o pagină**: paginarea este implementată și testată (`test-post-presentation.cjs`),
   dar niciun caption real nu depășește o pagină.
3. **Indexul celulei**: deschiderea unei celule deschide postarea, dar „a cincea celulă deschide a cincea
   postare" nu a fost încă probat prin numărare pe ecran.

## 6. Runda a cincea — cardul care nu mai intră sub bara de tab-uri (19 octombrie 2026)

Capturi noi, toate din aceeași sesiune pe dispozitiv: `jb_boot_round5.jpg`, `jb_feed_round5.jpg`
(Reels), `jb_whispers_round5.jpg` (Șoapte), `jb_news_round5.jpg` (Știri), `jb_reader_round5.jpg`
(reader de text), `jb_profile_round5.jpg` (profilul propriu).

### 6.1 Ce nu era în regulă

1. **Cardul depășea coloana.** Cardul cerea toată lățimea coloanei și lăsa `aspectRatio: 9/16` să decidă
   înălțimea: pe 1220×2656, un card lat de 1168 px devenea înalt de 2076 px într-o coloană de 2030 px.
   Piciorul cadrului — rândul de acțiuni, padding-ul de jos, colțul rotund — aluneca sub bara de tab-uri,
   deci rândul citea ca lipit de bară. Acum `FeedScreen` măsoară coloana (`onColumnLayout`) și calculează
   `cardWidth` exact ca `PostStage` în reader: toată lățimea când coloana e destul de înaltă, mai îngust
   când nu e. Un singur card, niciodată tăiat.
2. **Cardul era o a doua compoziție.** `PostCard` își desena propriul cadru, propriul autor și propriul
   rând de acțiuni. Acum este `PostCanvas` (`variant="feed"`, `layout="post"`) în `PostFrame`, cu
   `PostActionRow` sub text: un card este cadrul reader-ului cu acțiunile mutate din rail într-o linie.
3. **Notificarea Știrilor era o singură propoziție englezească** și se dedubla cu linia de gol
   („Nu sunt postări de afișat.”). Acum sunt două propoziții românești, titlu + detaliu, cu numele
   produsului, iar linia de gol tace când providerul de știri este oprit.
4. **Bara feed-ului avea două adrese pentru aceeași alegere.** A rămas un singur punct de schimbare a
   citirii: pilonul din mijlocul barei, care merge prin `nextMode` peste ordinea din `socialTokens.feedModes`
   (aceeași funcție pe care o folosește și swipe-ul orizontal).

### 6.2 Ce arată pixelii telefonului

| Măsurătoare (`uiautomator dump`) | Valoare | Ce dovedește |
|---|---|---|
| Cadru card Șoapte | `56,363-1164,2332` → 1108×1969 | 9:16 exact (1108 × 16/9 = 1969); centrat, 56 px în stânga și în dreapta |
| Bara de tab-uri | începe la 2393 | 61 px liberi sub card — rândul de acțiuni nu mai atinge bara |
| Rând de acțiuni | `92,2186-663,2274` | în cadru, sub traducere, cu 58 px până la piciorul cadrului |
| Cadru reader | `16,270-1204,2382` → 1188×2112 | 9:16 exact; bara de comentariu începe la 2403, deci cadrul nu o atinge |
| Notificare Știri | text `59,396-1161,611`, butonul „Vezi Feed” la `490,832-730,947` | o singură placă în padding-ul listei; sub ea nu mai apare a doua linie de gol |
| Pilon de citire | `574,208-646,281` | un singur control de citire pe bară (glifa citirii deschise) |

### 6.3 Ce rămâne neacoperit după runda a cincea

- Aceleași trei limite din §5: quote, conversație și textul mai lung de o pagină nu există în conturile
  accesibile de pe telefon, deci compoziția lor rămâne `IMPLEMENTED`, nu `VISUALLY VERIFIED`.
- Celula de profil a fost inspectată în runda a cincea doar pe contul propriu, care este gol
  (`jb_profile_round5.jpg` — „Nicio postare încă.”); grila cu postări rămâne dovedită de `feed_canvas4.jpg`.

---

## 7. Runda a șasea — corectarea UX-ului cerut de owner

Runda a cincea a dovedit geometria, dar a lăsat în picioare exact lucrurile pe care ownerul le-a văzut pe
ecran: trei piloni de citire în antet, reacții verticale pe o postare de text, traducerea lipită de piciorul
ecranului, bara de tab-uri veșnic prezentă, un profil cu postări de text pe toată lățimea.

### 7.1 Ce s-a schimbat, pe scurt

| Cerință | Stare | Unde |
|---|---|---|
| Fără buton Play / ghilimele / Știri în antet | `DEVICE TESTED` + `VISUALLY VERIFIED` | `FeedHeader.tsx`; captura `i06_feed_photo_card.jpg` arată doar filtrul și wordmark-ul |
| Un singur filtru **Toate / Postări / Reel-uri**, sus-stânga | `VISUALLY VERIFIED` | `FeedFilter.tsx`; `uiautomator`: `Toate conținuturile` la `41,178–198,251`, `Doar Reel-uri` la `395,178–590,251` |
| Feed implicit = toate tipurile | `VISUALLY VERIFIED` | `03_feed_photo.jpg`, `06_feed_text_video.jpg` |
| Bara de tab-uri se ascunde la swipe înainte și revine la swipe înapoi | `VISUALLY VERIFIED` | `i01`, `i02`; nodul `navigation` lipsește din ierarhie când e ascunsă |
| Postări = reacții orizontale, Reel-uri = rail vertical | `VISUALLY VERIFIED` (postări) / `BLOCKED` (Reel) | `03_feed_photo.jpg`; Reel-ul nu are conținut (§5.1 din manifest) |
| Composer de răspuns care înlocuiește bara | `VISUALLY VERIFIED` | `i03_reply_composer.jpg`; scrie prin `createComment`, fără al doilea backend |
| Traducere imediat sub text | `VISUALLY VERIFIED` | `03_feed_photo.jpg` — chip-ul e la 13 px sub ultimul rând al captionului |
| Text scurt în serif, text lung în sans | `IMPLEMENTED` | `PostCanvas` §5 din cod; postarea de text nu a putut fi capturată după schimbare |
| Filigran botanic pe suprafețele de text | `VISUALLY VERIFIED` (profil) | `19_profile_photo.jpg`, celulele 5–6 |
| Thumbnail-uri de text 9:16 | `IMPLEMENTED` | `ProfileScreen.whisperTiles`; tab-ul Șoapte nu a fost atins în sesiune |
| Progres video cu timpi | `VISUALLY VERIFIED` | `06_feed_text_video.jpg` (`0:06 / 0:23`), `06_feed_text_video_seek.jpg` (`0:15 / 0:23`) |

### 7.2 Ce nu s-a putut verifica, și de ce

Toate motivele sunt scrise o dată, cu măsurători, în
`JUNGLE_BOOK_VERIFICATION/verification_manifest.md` §5:

1. **Clipurile cu descriere nu erau considerate Reel** (definiție greșită în runda 6) → filtrul REEL-URI
   apărea gol (`i05_filter_reels_empty.jpg`). Corectat în runda 7: vezi §8.
2. **Fără quote, conversație sau text > o pagină** în conturile accesibile.
3. **Reader-ul de imagine al sesiunii a refuzat fișierele după 21:15** — JPEG-urile sunt valide
   (1220×2656), dar nu au putut fi deschise; prin urmare nu sunt declarate `VISUALLY VERIFIED`.
4. **Seek-ul pe bara clipului** nu a produs o săritură vizibilă; bara și timpii sunt verificați, seek-ul
   rămâne `IMPLEMENTED`.

### 7.3 Dovezi pe telefon (runda a șasea)

`JUNGLE_BOOK_VERIFICATION/final_jpg/` (12 fișiere) + `JUNGLE_BOOK_VERIFICATION/contact_sheet.jpg` (generat de
`scripts/build-contact-sheet.ps1` din orice JPG din folder).

Măsurători `uiautomator` (1220×2656): filtru `41,178–590,251`; wordmark `945,187–1189,243`; cadru postare
`19,273–1203,2380` (1184×2107 = 9:16); rând de acțiuni `73,2236–731,2324`; composer `31,2377–1194,2532`;
bara de tab-uri `0,2393–1220,2656` (când e vizibilă).

---

## 8. Runda a șaptea — corecțiile dovedite pe telefon (19 octombrie 2026)

Runda 6 raportase un filtru, un rail și un composer care pe dispozitiv nu se comportau așa. Runda 7 a
reparat cauzele din cod și le-a dovedit, în ordinea cerută: clasificare → rail Reel → reacții de postare →
gesturi → composer → Full-Screen → chenar → profil.

### 8.1 Ce arată pixelii

| Captură | Ce se vede |
|---|---|
| `round7_all_filter.jpg` | TOATE: postarea foto `Test Nexus` și, imediat după ea în același fir, clipul `Nexus Test 02` cu rail vertical |
| `round7_posts_filter.jpg` | POSTĂRI: clipul dispare; rămâne postarea foto cu rândul orizontal de 5 acțiuni |
| `round7_reels_filter.jpg` | REEL-URI: clipul **cu descriere** e singurul element — filtrul nu mai e gol |
| `round7_reel_vertical_reactions.jpg` | Rail-ul Reel-ului: avatar, inimă, comentariu `2`, salvare, share, disc de sunet, bara `0:02 / 0:23` |
| `round7_text_horizontal_reactions.jpg` | Postarea: cinci plăci pe un singur rând, sub text, în cadru |
| `round7_navigation_hidden.jpg` | Fără bară de tab-uri, fără bandă goală: postarea urcă până deasupra butoanelor Android, filtrul stins la 24 % |
| `round7_navigation_restored.jpg` | Bara revine, feed-ul la primul element, cadrul nemișcat |
| `round7_reply_composer.jpg` | Composer-ul **existent** (`CommentsSheet`): firul, câmpul „Adaugă un comentariu…”, butonul de trimitere, lipit de tastatură |
| `round7_text_post_fullscreen.jpg` | Postarea de text `[test] Tweetul de verificare…` pe tot ecranul: statement serif, lujer, antet, rând orizontal, „Scrie un răspuns…” |
| `round7_profile_text_grid.jpg` | Celula de text din profil: 9:16 (≈400×710), nu pe toată lățimea |

`contact_sheet.jpg` a fost regenerat din `final_jpg/` (22 de celule) și inspectat: toate cele 11 capturi
round-7 se citesc.

### 8.2 Ce nu s-a putut dovedi

- **Quote / conversație / text lung** — conturile accesibile nu au astfel de postări, iar crearea lor cere
  fluxul de publicare. `BLOCKED`, cu motivul în manifest §5.2.
- **Seek-ul pe bara clipului** — rămâne `IMPLEMENTED`: `expo-video` nu expune `seekTo`, iar două atingeri pe
  bară nu au produs o săritură distinctă de redarea normală.

### 8.3 Măsurători după corecție (1220×2656)

Cadru postare `34,302–1186,2350` (1152×2048 — exact 9:16, lățime limitată de ecran, nu depășită); rând de
acțiuni `70,2238–728,2327`; bară de tab-uri `0,2393–1220,2656` când e vizibilă. Ascunsă, postarea urcă până
la `2470`, iar rămâne rezervat doar insetul sistemului (`insets.bottom`).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, 20 de fișiere, 182 de teste, 0 eșecuri (`_tests7.log`).


Măsurători `uiautomator` (1220×2656): filtru `41,178–590,251`; wordmark `945,187–1189,243`; cadru postare
`19,273–1203,2380` (1184×2107 = 9:16); rând de acțiuni `73,2236–731,2324`; composer `31,2377–1194,2532`;
bara de tab-uri `0,2393–1220,2656` (când e vizibilă).

## 9. Runda a opta — postarea se citește doar în feed (19 octombrie 2026)

Owner-ul a cerut scoaterea completă a citirii pe tot ecranul: un post și un reel sunt 9:16, deci cadrul din
feed este postarea întreagă. Runda 8 a șters viewer-ul (`MediaViewer.tsx`) și toate ușile către el, iar
comentariile au rămas pe singura suprafață care exista deja (`CommentsSheet`).

### 9.1 Ce arată pixelii

| Captură | Ce se vede |
|---|---|
| `round8_feed_no_fullscreen.jpg` | Postarea foto `Test Nexus` în cadrul 9:16 din feed, cu antet, text, „Vezi traducerea” și rândul orizontal de 5 acțiuni; bara de tab-uri jos |
| `round8_feed_tap_no_op.jpg` | După tap în mijlocul imaginii: **aceeași** pagină, fără al doilea ecran; ierarhia are aceleași 18 noduri clickable, niciunul nu numește o postare de deschis |
| `round8_comments_sheet_over_feed.jpg` | Foaia `Comentarii · 20` peste postare: sortare, firul, `Adaugă un comentariu…` și trimiterea — postarea nu se re-randează, nu există scenă media |
| `round8_reel_filter.jpg` | REEL-URI: clipul `Nexus Test 02`, rail vertical (avatar, inimă, comentariu `2`, salvare, share, sunet), bara `0:14 / 0:23` |
| `round8_reel_tap_pauses.jpg` | După tap pe clip: semnul mare `▶` — tap-ul este play/pause, nu o a doua citire |
| `round8_reel_comments_sheet.jpg` | Rail-ul → aceeași foaie `Comentarii · 2` peste reel, cu compozitorul de jos |
| `round8_profile_tile_no_op.jpg` | Grila de profil după tap pe o celulă: nicio schimbare — celula este citire, nu ușă |

`contact_sheet.jpg` a fost regenerat din `final_jpg/` (**30 de celule**) și inspectat. Celulele round-7 care
arătau reader-ul (`round7_text_post_fullscreen.jpg`, `i03_reply_composer.jpg`) rămân ca **istoric** al rundelor
6–7; comportamentul pe care îl arată a fost scos în runda 8.

### 9.2 Măsurători (1220×2656, `uiautomator`)

- Feed, postare: niciun nod clickable peste cadru; acțiunile `Deschide selectorul de reacții | 70,2238–188,2327`,
  `Comentarii | 204,2238–356,2327`, `Salvează | 371,2238–470,2327`.
- Foaia de comentarii peste feed: `EditText` „Adaugă un comentariu…” la `29,2400–1065,2510`, trimitere
  `1077,2398–1191,2512`, fundal de închidere `0,0–1220,1275`.
- Reel: mânerul de tap `Redă sau oprește clipul | 19,290–1201,2393`; rail-ul `Comentarii | 1023,1716–1169,1862`,
  `Salvează | 1023,1867–1169,2012`, `Distribuie | 1023,2018–1169,2163`.

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **191 de teste, 0 eșecuri**
(`scripts/test-no-fullscreen-post.cjs`, 9 teste noi).

### 9.3 Punctul 2 — pagina feedului este ecranul (aceleași 1220×2656)

| Captură | Ce se vede |
|---|---|
| `round8_feed_fullscreen_photo.jpg` | Postarea foto `Test Nexus` **de la marginea de sus la cea de jos**: poza începe sub ceas (nu sub o bandă neagră), autorul la `36,250`, textul la `36,1949`, „Vezi traducerea” la `36,2214`, rândul de acțiuni la `36,2356–634,2444`; bara de tab-uri stă peste fotografie, iar fotografia continuă sub ea |
| `round8_feed_fullscreen_text.jpg` | Postarea text (`[test] Tweetul de verificare…`) pe pagina întreagă: statement serif, lujerul foarte estompat, aceeași poziție a autorului și a acțiunilor — fără card, fără chenar, fără benzi |
| `round8_feed_fullscreen_reel.jpg` | Reel (`Nexus Test 02`, Konarka): rail vertical (avatar, inimă, `2`, salvare, share, sunet), ceasul `0:02 / 0:23`; clipul **landscape** își păstrează tot cadrul, iar zona rămasă este câmpul editorial (`#0F1410` măsurat), nu negru |
| `round8_feed_swipe_uniform.jpg` | Pagina următoare după swipe înainte: **aceeași** geometrie (autor sub ceas, acțiuni la aceeași înălțime, bară la `~2434`) — nimic nu se restrânge sau se extinde |

Ce s-a măsurat pe pixel: în `round8_feed_fullscreen_reel.jpg`, câmpul din spatele clipului este `#0F1410`
(verdele-card al temei), nu `#000000`; în `round8_feed_fullscreen_photo.jpg`, poza acoperă `0,0–1220,2656`,
deci nu există nicio bandă. `contact_sheet.jpg` a fost regenerat din `final_jpg/` (**34 de celule**).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **199 de teste, 0 eșecuri**
(`scripts/test-fullscreen-feed.cjs`, 8 teste noi).

### 9.4 Punctul 2, al doilea val — railul pozei și bara textului (aceleași 1220×2656)

| Captură | Ce se vede |
|---|---|
| `round8_photo_rail.jpg` | Prima pagină (`Test Nexus`, fotografie): poza acoperă tot ecranul, iar **railul din dreapta** ține avatarul (`1033,1581–1194,1701`), inima cu `1`, comentariul cu `20`, salvarea și distribuirea cu `1` — celule de `145×145 px`; jos-stânga stau autorul (`36,2041–981,2150`), captionul (`36,2165`) și „Vezi traducerea” (`36,2257–324,2335`), toate deasupra meniului (`0,2393–2656`). Niciun disc de sunet: o poză nu are ce muta |
| `round8_text_bar.jpg` | Postarea de text (`[test] Tweetul de verificare…`), meniul ascuns după swipe înainte: statement serif la `36,996–1184,1352`, „Vezi traducerea” la `36,1383`, iar bara celor cinci acțiuni la `36,2190–827,2335` — cinci celule de `146×145 px`, adică **măsura railului vertical** (înainte: `88 px`, lipite de text) |
| `round8_text_bar_menu.jpg` | Aceeași pagină de text cu meniul readus: bara stă imediat **deasupra** lui (`2335` față de `2393`), fără nicio suprapunere — „ia locul footerului”, exact cum a cerut owner-ul |
| `round8_feed_fullscreen_reel.jpg` | Clipul portrait: pagina de dinainte, neatinsă — rail complet (inclusiv discul de sunet) și ceasul `0:02 / 0:23` |

Ce s-a măsurat: o celulă de rail și o celulă de bară au aceeași `145 px` înălțime pe același ecran, deci
„aceeași dimensiune ca cea verticală” este o egalitate măsurată, nu o intenție. `contact_sheet.jpg` a fost
regenerat din `final_jpg/` (**37 de celule**).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **205 de teste, 0 eșecuri**
(`scripts/test-feed-rail.cjs`, 6 teste noi, dintre care unul rulează `openWithMedia`).
### 9.5 Al treilea val — piciorul umple banda footerului, bara textului ia toată lățimea (aceleași 1220×2656)

| Captură | Ce se vede |
|---|---|
| `round9_feed_first_page_rest.jpg` | Prima pagină (`Test Nexus`, fotografie) cu meniul prezent: railul în dreapta `1033,1581–1194,2314`, „Vezi traducerea” `36,2258–324,2332` — exact locurile din runda 8. Pe prima pagină nimic nu coboară, fiindcă meniul este mereu acolo |
| `round9_feed_clip_descent.jpg` | Pagina următoare, un clip, **meniul plecat**: railul (avatar, inimă, `2`, salvare, distribuire, disc de sunet) coboară până la `2443`, cu `120 px` mai jos decât poziția lui fără coborâre (`2323`). Poza/clipul acoperă în continuare tot ecranul; nimic nu s-a redimensionat |
| `round9_feed_photo_descent.jpg` | Pagina cu poză, meniul plecat: autorul, captionul și „Vezi traducerea” stau la piciorul ecranului, iar banda goală de sub ele a dispărut |
| `round9_feed_text_bar_descent.jpg` | Pagina de text, meniul plecat: bara celor cinci acțiuni `36..1180 × 2296..2456` — celule `36–194`, `288–440`, `534–686`, `780–934`, `1028–1180` (fiecare `158×160 px`), goluri egale de `94 px`. Bara **ia toată lățimea telefonului**: începe la marginea din stânga (`36`) și se termină la cea din dreapta (`1180`), iar marginea ei de jos stă la `200 px` de ecran (`22` padding + `48` semn de gest + `8` respirație) |
| `round9_feed_text_bar_footer.jpg` | Aceeași pagină de text după o glisare în sus, când **meniul reapare**: bara celor cinci acțiuni urcă la `2176..2336`, adică `120 px` mai sus, cu aceleași celule de `158×160 px`, și rămâne `68 px` deasupra sticlei meniului (`2404..2656`) — fără nicio suprapunere. Coborârea și urcarea sunt aceeași animație, pe același ceas de `220 ms` |

Ce s-a măsurat: coborârea este de `120–121 px` = **46 dp**, exact valoarea `footTravel(102, 48)` din
`lib/feedFoot.ts` (banda `4+50+48 = 102 dp` minus semnul de gest `48` minus respirația `8`). Bara textului are
acum celule de `158×160 px` (înainte `146×145 px`) și se întinde pe toată lățimea (înainte `36..827`), iar
poziția ei urcă și coboară cu fix aceeași `120 px`. `contact_sheet.jpg` a fost regenerat din `final_jpg/`
(**42 de celule**).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **217 teste, 0 eșecuri** (`scripts/test-feed-foot.cjs`,
6 teste — coborârea rulată pe modulul pur și invarianții `0 ≤ travel ≤ navReserve`; `scripts/test-mark-doors.cjs`,
5 teste — `openTagPage` rulat cu un router fals).

Ce nu s-a putut dovedi pe telefon: ușile `@nume` și `#subiect` — nicio legendă din feedul de azi nu conține un
`@` sau un `#`, iar fixture-ul pentru așa ceva lipsește din runda 6 încoace (§5.2 din manifest). Ele sunt
dovedite automat: `openTagPage` rulează pe modulul pur, iar `RichText` leagă fiecare segment de ușa lui.

### 9.6 Al patrulea val — panoul de reacții, ținut apăsat și glisat (aceleași 1220×2656)

| Captură | Ce se vede |
|---|---|
| `round10_reaction_column_reel.jpg` | Clip, inima din rail ținută apăsată: o **coloană subțire** în stânga railului, opt emoji de sus în jos `▼ ◆ 😡 😢 😮 😂 ❤️ 👍` (primul sub deget, la picior), iar emoji-ul de sub deget — `😮` — este vizibil mai mare decât celelalte, cu chipul „Wow” în stânga lui. Pager-ul nu s-a mișcat: poza și railul stau pe loc cât timp degetul glisează |
| `round10_reaction_bar_open.jpg` | Pagină de text, farfuria barei ținută apăsată fără glisare: **pastila orizontală** deasupra barei, opt emoji `👍 ❤️ 😂 😮 😢 😡 ◆ ▼`, primul (`👍`) crescut, chipul „Like” deasupra lui; bara de dedesubt arată `👍 1`, aprinsă |
| `round10_reaction_bar_text.jpg` | Aceeași pastilă după o glisare în dreapta: creșterea s-a mutat pe `😢`, chipul spune „Trist”, iar `😂` a revenit la mărimea celorlalte. Pagina nu s-a mișcat |
| `round10_reaction_picked_bar.jpg` | După ridicarea degetului: pastila a dispărut, farfuria barei arată `😢 1`, cu marginea și fundalul teal ale unei presări aprinse |
| `round10_reaction_tap_like.jpg` | Un **tap scurt**, fără ținere: farfuria arată `👍 1` — gestul de dinainte (like), neschimbat de panoul nou |
| `round10_reaction_heart_idle.jpg` | Un clip pe care viewerul nu a reacționat: inima farfuriei este **roșie** (`❤️`), nu conturul alb subțire de dinainte |

Ce s-a măsurat: pasul celulelor în panou este `119–120 px` = **46 dp** (opt celule, de la `976` la `1813`
pe coloană), pastila are `988 px` = **380 dp** pe ambele axe, farfuria de rail rămâne `145×145 px` (56 dp),
iar cea a barei de text `177×156 px` (68×60 dp). `contact_sheet.jpg` a fost regenerat din `final_jpg/`
(**48 de celule**).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **225 de teste, 0 eșecuri** (`scripts/test-reaction-palette.cjs`,
8 teste — `pickerIndexAt` rulat pe modulul pur, plus glifele, pragul de ținere și oprirea pagerului).

Ce nu s-a putut dovedi: reacția aleasă de un cititor de ecran (TalkBack nu ține apăsat); acolo panoul se
deschide din activare, ca înainte, iar cele opt celule rămân butoane cu numele lor.

### 9.7 Al cincilea val — anulare la ridicare, rând orizontal, rail fără avatar și fără negru (aceleași 1220×2656)

| Captură | Ce se vede |
|---|---|
| `round11_reaction_row_open.jpg` | Clip, farfuria `👍 2` ținută apăsată: **un rând orizontal** de opt emoji se deschide în stânga ei, `▼ ◆ 😡 😢 😮 😂 ❤️ 👍` de la stânga la dreapta, deci `👍` — primul — stă sub deget, crescut, cu chipul „Like” deasupra. Deasupra farfuriei nu mai este nici un avatar |
| `round11_reaction_row_haha.jpg` | Aceeași ținere, degetul mutat la stânga: creșterea a trecut pe `😂`, chipul spune „Haha”, `👍` a revenit la mărimea celorlalte. Poza și railul stau pe loc |
| `round11_reaction_row_off_row.jpg` | Degetul dus departe de rând, încă ținut: **nici un emoji crescut, nici un chip** — degetul nu mai arată nimic |
| `round11_reaction_row_cancelled.jpg` | După ridicare din acel punct: rândul a dispărut, farfuria arată tot `👍 2` — reacția a fost **anulată**, nu aleasă |
| `round11_reaction_row_love_aim.jpg` | O nouă ținere, glisată pe `❤️`: inima este crescută, chipul „Love”, restul rândului la mărimea lor |
| `round11_reaction_row_love_picked.jpg` | După ridicare: farfuria arată `❤️` cu totalul `2`, fără nici un disc negru în jurul ei |
| `round11_rail_no_avatar_bright.jpg` | Poză deschisă pe un gradient luminos: railul începe direct cu inima, fără emblema `NT` deasupra, iar inima stă pe imagine — nici un fundal negru sub ea |

Ce s-a măsurat: rândul are **380 dp** lățime (`990 px` cu marginile, `35..1025`) și **58 dp** înălțime
(`155 px`, `1716..1871`), cu celule de `119–120 px` (46 dp); marginea lui dreaptă este la `1025 px`, adică
`64 dp` de la marginea railului (`1194 px`), deci `👍` cade sub degetul care ține farfuria (`1121 px`).
Farfuria rămâne `145×145 px` (56 dp). `contact_sheet.jpg` a fost regenerat din `final_jpg/` (**55 de
celule**, ordonate natural).

Teste: `tsc --noEmit` → exit 0; `npm test` → exit 0, **228 de teste, 0 eșecuri**
(`scripts/test-reaction-palette.cjs`, 11 teste — regula degetului rulată pe modulul pur, plus forma
rândului, anularea, absența avatarului și a discului negru).

Ce nu s-a putut dovedi: un gest cu **două degete** (al doilea deget nu este ascultat — panoul rămâne al
primului), și un rând pe un ecran mai îngust de 440 dp, unde pastila de 380 dp ar intra în marginea
stângă; telefonul de verificare are 469 dp, deci cazul nu poate fi arătat aici.





