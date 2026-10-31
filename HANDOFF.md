## 0.45 Benzi pe hârtie, o căutare care se caută singură și avertismentul care nu se aprindea (31 octombrie 2026)

**Starea depozitului.** Cod pe ramura `codex/camera-draft-stability` (fără push, fără reinstalare, fără
ștergeri de date, fără postări publice; xPortal neatins). `tsc --noEmit` exit 0; `node scripts/run-tests.mjs`
→ `suites=72 failed=0 in 40s` (o suită nouă: `test-search-explore.cjs`, la capătul lanțului `npm test`).
`eslint` este curat pe fișierele atinse (`SearchScreen.tsx`, `ProfileTile.tsx`, `readability.ts`,
`previewSafety.ts`, `PostReadability.tsx`, `app/index.tsx`, `CaptureEditor.tsx`); `PostCanvas.tsx` (3) și
`EditorialPage.tsx` (10) păstrează exact erorile vechi `react-hooks/refs`, neatinse aici.

**Ce lipsea.** Trei lucruri, toate trei vizibile pe telefon.

1. **Postările de tip text nu aveau niciuna dintre cele două benzi de citire.** Runda 44 le scotea din sistem
   *prin construcție*: `PostCanvas` socotea terenul (`ground = pagePalette ? 'paper' : 'night'`) și apoi
   `headGeometry = ground === 'paper' ? null : …`, `footGeometry = ground === 'paper' || headInReading ? null : …`,
   iar `EditorialPage` nu desena niciun strat. Deci un text publicat — în feed, în profil, în căutare, pe ruta
   postului și în compozitor — era singurul cadru fără delimitare, deși un reel deschis în același loc avea
   amândouă benzile. Regula „hârtia nu are nevoie de umbră" era o presupunere despre contrast, nu o măsurătoare.
2. **Căutarea** era un antet de shell (logo + Social/Prieteni) deasupra unui câmp, un buton „Caută", iar
   rezultatele erau **carduri întregi** de postare (`PostCard`) într-o listă cu o coloană. Ownerul a cerut:
   fără antet, câmpul primul rând, grilă de trei coloane 9:16, numai cifra reală de vizualizări, căutare
   automată, conturi cu poză/nume/`@handle`, citire prin readerul existent, poziția păstrată la întoarcere.
3. **Avertismentul de suprapunere din compozitor nu se aprindea niciodată** (rămas deschis în 0.44, cu dovadă
   doar de sursă). Cauza nu era vizuală, ci de unitate: `studioManifest.decorationBase` scrie `x`/`y` ca
   **procente 0–100** (`percent()`), dar `CaptureEditor` le trecea direct în `frameSpotOf`, care citește
   **fracții 0–1** și le limitează. Fiecare etichetă era deci socotită în colțul de jos-dreapta al
   dreptunghiului de conținut, oriunde ar fi stat; banda descrierii e mai sus, deci `guideHits` era mereu gol.


**Ce s-a schimbat, pe fișiere:**

| fișier | de ce |
| --- | --- |
| `src/lib/readability.ts` | `READABILITY.paper` (aceeași formă, altă greutate: cap `0.26/0.16/0.09`, descriere `0.13`); `headerScrim` primește `ground` și, pe hârtie, se oprește chiar la marginea de jos a capului (o penumbră de 44 dp ar intra peste primele rânduri și ar fi acoperită de hârtia paginii); funcție nouă `wordsScrim` — banda **din interiorul** blocului măsurat, înălțime egală cu măsurătoarea, tranziție în interior; `needsHeaderScrim`/`needsDescriptionScrim` au plecat (erau regula care producea defectul) |
| `src/components/PostReadability.tsx` | `WordsBand`: blocul de cuvinte măsurat (`onLayout`) cu banda lui înaintea copiilor; `flex` păstrează așezarea unui text paginat, iar `band={false}` lasă banda paginii care o desenează singură; `onMeasure` raportează numărul mai departe |
| `src/components/PostCanvas.tsx` | capul primește bandă pe **orice** teren, cu cerneala terenului (`scrimInk = pagePalette ? pagePalette.text : editorial.fieldDeep`); ramura de lectură desenează banda cuvintelor prin `WordsBand` (declarații, citate, pagini vechi); `pageDrawsBand` evită o bandă dublă pe o pagină scrisă în compozitor; `footBand` raportează acum și banda cuvintelor |
| `src/components/EditorialPage.tsx` | banda paginii de hârtie vine din **rândurile fluxului** (`Math.min(line.y)` … `Math.max(line.y + lineHeight)`), desenată sub rânduri, sub fotografii și sub `Pressable`-ul câmpului; fiindcă este chiar desenul paginii, apare identic în compozitor și în postarea publicată |
| `src/components/PostReading.tsx` | paginile vechi (fără document) primesc aceeași bandă prin `WordsBand`, măsurată pe blocul lor |
| `src/lib/previewSafety.ts` | `decorationSpot(rect, {x, y})`: singurul loc care citește procentul din manifest ca fracție (și duce o poziție nedefinită la mijloc, nu în colț) |
| `src/components/CaptureEditor.tsx` | `guideHits` folosește `decorationSpot` — de aici încolo avertismentul se poate aprinde |
| `src/screens/SearchScreen.tsx` (rescris) | câmp primul rând (fără antet, fără buton), grilă `FlatList` cu `numColumns={3}` din `GRID_COLUMNS/GRID_GAP`, celulă cu lățime **fixă** din `tileSize` (un rând pe jumătate plin nu-și mai întinde celula pe tot ecranul — defect văzut pe telefon la „dimen"), miniaturi `ProfileTile mode="explore"`, căutare automată la 320 ms cu bilet de cerere (un răspuns vechi nu scrie peste unul nou), secțiuni Subiecte (`/api/social/tags`) și Oameni, perete de explorare din `/api/social/feed?lens=for-you` |
| `src/components/ProfileTile.tsx` | `mode: 'archive' \| 'explore'`: pe explorare cifra se vede pe **orice** celulă care o are (inclusiv paginile de cuvinte), chipul de redistribuire nu se tipărește, iar textul de accesibilitate nu mai promite o aranjare care nu există acolo |
| `src/app/index.tsx` | slotul `search` nu mai primește `AppHeader` |
| `scripts/test-search-explore.cjs` (nou) | 7 teste: fără antet + câmpul înaintea listei, trei coloane din aceleași numere ca peretele profilului, numai cifra reală, căutare automată cu bilet, aranjamentul contului, citirea prin `/post/[id]` fără niciun player în listă, poziția păstrată la întoarcere |
| `scripts/test-readability.cjs` | testele regulii vechi au fost înlocuite: hârtia primește benzi cu greutatea ei, banda cuvintelor are exact înălțimea măsurată, pagina își ia banda din rândurile fluxului, pagina veche prin `WordsBand` |
| `scripts/test-preview-safety.cjs` | test nou pentru procent ↔ fracție: `frameSpotOf` cu `y: 85` ajunge la marginea de jos (defectul), `decorationSpot` duce punctul în banda descrierii |
| `scripts/test-profile-reposts.cjs`, `scripts/test-profile-grid.cjs` | urmează chipul de redistribuire și textul de accesibilitate, acum condiționate de `mode` |
**Ce s-a văzut pe telefon** (JPG citit, nu doar fișier existent; px fizici ÷ 2,6 = dp; cadru 469 × 1022 dp):

| captură | ce arată |
| --- | --- |
| `round45-search-explore.jpg` (13:35) | **explorarea**: niciun antet deasupra câmpului (câmpul începe la ~67 dp, imediat sub ceas), eticheta „Populare acum", grilă de trei coloane: celule de 155 dp lățime (≈ `(469 − 2×2) / 3`) și 9:16, despărțite de 2 dp; fiecare celulă tipărește **numai** cifra reală („1", „4", „2", „3") în colțul de jos-stânga; un clip este o poză de afiș cu disc de redare, nu un player. Trei rânduri încap: 3 × 275 dp + 2 × 2 = 829 dp, iar un al patrulea ar cere 1 106 dp din cei ~890 rămași între câmp și bara de tab-uri |
| `round45-search-results.jpg` (13:35) | **căutare automată**: s-a tastat „test" fără nicio apăsare pe „Caută"; secțiunea „Oameni" cu șapte conturi — poză rotundă de 44 dp, nume bold, `@handle` (și „1 urmăritori" unde serverul îl dă), ușa relației în dreapta |
| `round45-search-posts.jpg` (13:36) | rezultatele de **postări** pentru „test", după ce tastatura a fost închisă printr-o glisare: aceeași grilă de trei coloane, pagini de hârtie și fotografii, fiecare cu cifra ei |
| `round45-textpost-from-search.jpg` (13:37) | **text deschis din căutare**, prin ruta comună `/post/[id]`: banda capului de la marginea de sus (peste ceas) până la ~84 dp, solidă sub nume și `@handle`, stinsă înainte de primul rând; banda descrierii exact pe cele patru rânduri (13…453 dp pe orizontală, 111…180 dp pe verticală = blocul măsurat), cu tranziția în interiorul ei; jos, ușa de întoarcere a readerului |
| `round45-search-return.jpg` (13:37) | **întoarcerea**: aceeași listă, aceeași poziție de scroll și același „test" în câmp — ecranul rămâne montat sub rută, deci nu se reîncarcă |
| `round45-feed-text.jpg` (13:39) | **text în feed**: aceleași două benzi, acum peste `Urmărește` și peste „Vezi traducerea" (banda acoperă și chipul, fiindcă el face parte din blocul de cuvinte) |
| `round45-textpost-from-profile.jpg` (13:40) | **același text deschis din profil**: identic cu cel din căutare (aceeași pagină, alt picior al ecranului) |
| `round45-text-composer-band.jpg` (13:45) | **compozitorul de text**: după ce s-a scris un rând în pagină, banda apare sub el, din rândurile fluxului (5/20000 caractere, nimic publicat) — dovedește paritatea compozitor ↔ pagină publicată, fiindcă este chiar `EditorialPage` |
| `round45-feed-now.jpg` (13:38) | **reelul de referință** în feed (Konarka, 0:07/0:23): capul sus, descrierea jos, rail-ul și discul de sunet — aceeași limbă vizuală, cu greutatea de noapte |
| `round45-search-single-row-2.jpg` (14:09) | **un rând pe jumătate plin**: căutarea „dimen" dă o singură postare, iar celula stă pe o treime din lățime (2…160 dp), nu pe tot ecranul. Înainte de lățimea fixă (`tileSize`), celula singură a rândului se întindea pe 469 dp și, cu 9:16, se făcea de trei ori mai înaltă decât ecranul (`round45-search-single-row.jpg`, 14:08) |
| `round45-editor-warning.jpg` (13:58) | **avertismentul de suprapunere, în sfârșit aprins**: textul tras în banda „Descrierea" (centru la ~684 dp, banda 617…827 dp) produce pastila „„vText peste descriere" intră sub descriere" și butonul „Mută în zona liberă". Înainte de `decorationSpot` același gest nu aprindea nimic |
| `round45-editor-warning-moved.jpg` (13:58) | butonul apăsat: eticheta sare la ~307 dp, deasupra benzii, iar avertismentul dispare |

**Ce NU s-a dovedit / rămâne deschis.** (1) Al patrulea rând de miniaturi nu încape pe acest telefon la
9:16 (aritmetica de mai sus) — ecranul arată trei rânduri, nu patru. (2) O celulă de **text** își arată
pagina, nu doar cifra: o postare de cuvinte nu are fotografie, iar pagina mică este singura ei față; cifra
rămâne singurul element de interfață de pe celulă (fără autor, fără descriere, fără reacții). (3) Pe cele
două capturi de editor, textul scris prin `adb input text` a ieșit cu un „v" în față — artefact al tastei
sintetice, nu al produsului. (4) Banda paginilor **vechi** (`PostTextReading`, fără document) are dovadă doar
de sursă și de test: în bază nu există un asemenea text cu care să se facă poza. (5) Căutarea nu paginează
încă peste primele 20 de rezultate (`next_cursor` există în răspuns, dar nu este cerut). (6) Rândul
„Subiecte" nu a putut fi văzut pe telefon: `/api/social/tags` întoarce doar etichete din ultimele 3 zile cu
minim doi autori, iar în această bază toate postările cu `#` sunt din 07.10.2026 — deci lista vine goală și
secțiunea nu se desenează. Căutarea găsește totuși postările care conțin eticheta, fiindcă serverul caută în
textul postării. (7) `round45-search-grid.jpg`
este o captură **ratată** (focus pe `com.twitter.android`, `focusOk:false`) — rămâne în `final_jpg` doar ca
urmă a incidentului, nu ca dovadă.

**Ce nu s-a atins.** Niciun push, nicio reinstalare, nicio setare a telefonului modificată, nicio postare
publică, nicio ștergere de date, nicio imagine comisă. xPortal, plățile și datele de producție neatinse.




## 0.44 Un singur sistem de citire și ghidaje care se văd: compozitorul se uită la pagina publicată, nu la o a doua socoteală (31 octombrie 2026)

**Starea depozitului.** Cod pe ramura `codex/camera-draft-stability` (fără push, fără reinstalare, fără
ștergeri de date, fără postări publice; xPortal neatins). `tsc --noEmit` exit 0; `node scripts/run-tests.mjs`
→ `suites=71 failed=0 in 28s`, cu două suite noi (`test-readability.cjs`, `test-preview-safety.cjs`) puse la
capătul lanțului `npm test`, deci intrate și în `npm run test:all`. Lotul acestei runde este **necomis**:
arborele are deja necomise rundele 42–43, iar fișierele noi (`readability.ts`, `previewSafety.ts`,
`PostReadability.tsx`) sunt dependențe ale lor — un commit tăiat pe un packet ar rupe buildul.

**Ce lipsea.** Două lucruri, amândouă vizibile pe telefon. (1) Fiecare suprafață își desena **singură** un
gradient de citire peste compoziție — card, reel, feed, media, ruta postului — deci același nume avea altă
penumbră după locul de unde era deschis postul, iar un text lung putea ieși din ea. (2) Compozitorul nu
spunea unde se termină capul, descrierea și poalele paginii, deși ownerul cere să tragă text pe fotografie
fără să-l pună sub nume; iar etichetele ghidajelor ieșeau ciuntite („Uneltele …ui", „Reacțiil…").

**Ce s-a schimbat, pe fișiere:**

| fișier | de ce |
| --- | --- |
| `src/lib/readability.ts` (nou) | geometria penumbrei ca funcție pură: o parte din cadru, ținută între 20 și 44 de puncte, blocul măsurat plus halo, descrierea ancorată la poale și crescută în sus, opriri ordonate 0–1 cu trei zecimale, și regula că **terenul** hotărăște cine are nevoie de scrim (hârtia nu, imaginea da) |
| `src/components/PostReadability.tsx` (nou) | `PostScrim` și `useBlockHeight`: capul și blocul de descriere se măsoară cu `onLayout`, iar penumbra se desenează din acele numere — niciun scrim nu are înălțime scrisă de mână |
| `src/components/PostCanvas.tsx` | desenează ambele straturi prin `PostScrim` și raportează `onChromeMeasure({ head, description })`; gradientul de teren al cardului rămâne (este pământul compoziției, nu un scrim de citire) |
| `src/components/PostCard.tsx`, `src/components/ReelsReader.tsx`, `src/screens/FeedScreen.tsx`, `src/components/PostMedia.tsx`, `src/app/post/[id].tsx` | fără gradient propriu de citire: `LinearGradient`/`stopOpacity` au acum **zero** apariții în aceste cinci fișiere (verificat prin căutare, plus testul de mai jos) |
| `src/lib/previewSafety.ts` (nou) | benzile compozitorului ca funcție pură: `head`, `description`, `system` („Poalele paginii"), plus cele măsurate de editor (`rail`, `tool`, cu `published: false`). Capul ține și banda de sus a telefonului (`max(head, systemTop)`), poalele sunt `max(foot, systemBottom)`, **descrierea stă deasupra benzii de la poale** și se taie la locul rămas; o bandă cu înălțime zero nu se desenează |
| `src/lib/previewSafety.ts` (`freeSpots`) | locurile libere stau între cap și descriere: limita de sus vine din benzile lipite de marginea de sus, cea de jos din **orice** bandă care începe mai jos (un punct sub descriere ar fi tot ascuns de cuvinte), iar pe orizontală la stânga coloanei de reacții |
| `src/lib/previewSafety.ts` (`guideLabelPlacement`, nou) | unde stă eticheta unei benzi, **în puncte de cadru**: o bandă îngustă (< 150) își ține eticheta în stânga, lipită de margine, `maxWidth` = locul rămas până la marginea cadrului; o bandă care are loc deasupra își ține eticheta deasupra liniei (ca să nu acopere primul rând de cuvinte); capul, lipit de marginea de sus, rămâne în interior, în colț |
| `src/components/CaptureEditor.tsx` | ghidajele vin din măsurători (`onChromeMeasure`, `onLayout` pe coloana de reacții și pe unelte, `pageFoot`, insets); etichetele se desenează într-un **strat propriu peste tot cadrul** (`numberOfLines={1}`), fiindcă un copil absolut poziționat este măsurat în lățimea părintelui, iar părintele are 44–53 dp; avertismentul de suprapunere spune „peste poalele paginii" |
| `scripts/test-readability.cjs` (nou) | 11 teste: geometria penumbrei, ancorarea descrierii la poale, opririle, terenul, plus paritatea de sursă — niciunul dintre cele cinci ecrane nu mai are `LinearGradient`/`stopOpacity`, iar compoziția desenează ambele straturi prin `PostScrim` |
| `scripts/test-preview-safety.cjs` (nou) | 11 teste: benzile de sus în jos, capul chiar fără descriere, descrierea mai înaltă decât locul rămas (tăiată, nu ieșită din cadru), banda măsurată preluată și cea vidă aruncată, `zonesAt` la margine inclusiv, drumul dus-întors fracție ↔ punct, locurile libere între cap și descriere (și `count` de la 1 la 12), eticheta mutată în puncte de cadru, plus legătura cu sursa: stratul separat de etichete și `guideLabelPlacement(zone.rect, screenSize.width)` |

**Ce s-a văzut pe telefon (JPG citit, nu doar fișier existent; px fizici ÷ 2,6 = dp, cadru 469 × 1022 dp):**

| captură | ce arată |
| --- | --- |
| `round44-editor-guides-7.jpg` (12:35, **după** schimbarea din 12:33) | etichetele sunt întregi: „Capul paginii" în capul benzii (4 dp de margine), „Uneltele editorului" **în stânga** plăcii de unelte — dreapta pastilei la 379 dp, placa începe la 393 dp, deci 14 dp aer și niciun cuvânt tăiat; „Reacțiile" în stânga coloanei (dreapta la 375 dp, coloana începe la 389 dp); „Descrierea" deasupra liniei descrierii (linia la 543 dp); „Poalele paginii" deasupra liniei de la poale (773 dp) |
| `round44-editor-guides-warn.jpg` (12:36) | aceleași etichete întregi pe un al doilea cadru (cap mai înalt, „1 min"), cu textul tras „Text peste video" **deasupra** benzii descrierii — deci avertismentul de suprapunere nu s-a aprins, fiindcă textul chiar nu intră în bandă |

**Ce nu s-a atins.** Niciun push, nicio reinstalare, nicio setare a telefonului modificată, nicio postare
publică, nicio imagine comisă (`docs/vision/` rămâne generat și ignorat). xPortal, plățile și datele de
producție neatinse.

**Lint.** `eslint` (prin `node node_modules/eslint/bin/eslint.js`, fiindcă `npx.ps1` este blocat de politica
de execuție a mașinii) este **curat pe fișierele acestei runde**: `readability.ts`, `previewSafety.ts`,
`PostReadability.tsx`, `CaptureEditor.tsx` — exit 0. Pe drum s-au plătit trei datorii: `Date.now()` chemat în
randare pentru `created_at`-ul previzualizării (acum o singură citire, ținută în `useState`, cu `previewCreatedAt`
în dependențele memoului) și două tipuri `Array<T>` devenite `T[]`/`readonly T[]`. Restul depozitului are
însă **33 de erori în 13 fișiere**, toate mai vechi (cel mai mare: `EditorialPage.tsx` 10, `ProfileScreen.tsx`
7, `PostCanvas.tsx` 3 — regula nouă `react-hooks/refs` peste `useRef(new Animated.Value(0)).current` din bara
clipului); nu au fost atinse aici, fiindcă o reparare a barei cere o rundă proprie de telefon. Reparațiile de
azi din `CaptureEditor.tsx` nu schimbă ce se vede (capul scrie tot „acum", iar un docblock dublat a fost șters),
deci nu au cerut o captură nouă — dovada lor este `tsc --noEmit` exit 0, `eslint` exit 0 pe cele patru fișiere
și `suites=71 failed=0`.

**Ce rămâne deschis:** (1) lotul 0.43–0.44 este necomis pe ramură — cere un commit întreg (fișierele noi
sunt dependențe, nu pot fi tăiate pe packet); (2) avertismentul de suprapunere din compozitor are dovadă
doar de sursă și de test: două încercări de tras text în bandă (`-warn`, `-warn-2`) au lăsat textul
deasupra ei, deci banda de avertisment nu s-a văzut încă pe telefon; (3) cele 33 de erori de lint din 13
fișiere, mai vechi decât runda, cu prioritate pe `PostCanvas.tsx` (bara clipului) și `EditorialPage.tsx`;
(4) grila de căutare/explorare pe trei coloane rămâne neîncepută (`Search/Explore`), după ce se închide
rândul de mai sus.

## 0.43 Un singur cap, sus, pe orice pagină: reel-ul din feed se citește ca cel din profil (31 octombrie 2026)

**Starea depozitului.** Cod pe ramura `codex/camera-draft-stability` (fără push, fără reinstalare, fără
ștergeri de date, fără postări publice; xPortal neatins). `tsc --noEmit` exit 0; 69 de suite
`scripts/test-*.cjs` exit 0 (două noi: `test-feed-reel-head.cjs`, `test-player-trace.cjs`), rulate dintr-un
proces cu `npm run test:all`. Aplicația a fost repornită cu `am force-stop` + deep link pe clientul de
dezvoltare, apoi citită pe telefon, captură cu captură.

**Ce lipsea.** Runda 41 a mutat capul unui reel deschis **din profil** sus (`ReelPage layout="post"`), dar
feed-ul cerea în continuare `layout="reel"`: același post avea două capete după locul de unde era deschis.
Ownerul a cerut o singură regulă, deci feed-ul cere acum aranjamentul paginii.

**Ce s-a schimbat, pe fișiere:**

| fișier | de ce |
| --- | --- |
| `src/screens/FeedScreen.tsx` | pagina de media a feed-ului cere `layout="post"`, `topInset={insets.top}` și `follow`: capul sus, în aceeași bandă ca pagina de cuvinte din același feed și ca ruta din profil (`readerPageTopInset` este chiar `insets.top`), cu ușa autorului, pentru că pagina de cuvinte de alături o are. Piciorul rămâne al feedului (`overlayBottom={navReserve}`) — bara de tab-uri nu există pe rută |
| `src/components/ReelsReader.tsx` | `layout` are acum implicit `post` (niciun ecran nu mai cere aranjamentul vechi), iar documentația spune de ce: un post nu poate avea două capete |
| `src/lib/playerTrace.ts` (nou) | contorul de redări vii: fiecare `RemoteVideo`/`RemoteImageSound` se anunță la montare și la demontare (`[player] ±1 #n video clip=… live=… peak=…`, doar `__DEV__`). Răspunsul la „câte decodoare ține telefonul", pe care nici o captură nu îl dă |
| `src/components/PostMedia.tsx` | ambele redări (clip + coloană sonoră Jamendo) se deschid și se închid cu bilet, în același contor |
| `scripts/test-feed-reel-head.cjs` (nou) | contractul care s-a rupt: feedul cere `post` + `insets.top` + `follow`, niciun `.tsx` nu mai cere `reel`, iar canvasul are un singur cap pe pagină (sus; jos doar în forma veche). Comentariile se taie înainte de potrivire, ca istoria din docblock-uri să nu dea testul fals |
| `scripts/test-player-trace.cjs` (nou) | contorul ca funcție (deschide/închide, bilet închis de două ori, vârf), plus legătura cu codul: cine deschide o redare o și închide la demontare |
| `tools/_diag-media-counts.mjs` (nou, doar citire) | ce postări există cu cele mai multe atașamente/clipuri, ca un test de telefon să deschidă exact cazul cel mai greu |
| `package.json` | cele două suite noi intră în lanț (`npm test`), deci și în `npm run test:all` |


**Ce s-a văzut pe telefon (JPG citit, nu doar fișier existent):**

| captură | ce arată (măsurat în px fizici ÷ 2,6) |
| --- | --- |
| `round43-feed-first.jpg` | **reel în feed**, capul sus: față de 54 dp la 14 dp de marginea stângă, „Mother Fucker" 17 dp, `@wallet4e8gv6 · 3 h`, „Bucharest", „Editează profilul" în dreapta sus; descrierea jos cu „Citește tot"; rail-ul vertical (reacție, comentarii, salvare, distribuire) neatins |
| `round43-profile-reel.jpg` | **același post deschis din profil** (față → profil → celula 1): capul stă pe aceleași rânduri, la aceeași dimensiune, cu același pilul; diferă doar piciorul — placa gri cu bara sistemului în loc de bara de tab-uri |
| `round43-profile-text.jpg` | **pagină de cuvinte deschisă din profil**: același cap (54 dp, 17 dp, `@handle · 3 z`, locul „Czyżyny, Cracovia", „Editează profilul"), foiță `1/2` jos — deci textul și reelul din profil sunt un singur bloc |
| `round43-feed-word-page.jpg` | **pagină de cuvinte în feed**: capul pe aceleași rânduri ca reelul din feed (nume la 167 px, `@` la 227 px, pilul la 173 px), foiță `1/2`, „Vezi traducerea" |
| `round43-feed-clip-rail.jpg` | **a doua pagină de media din feed**, alt autor (`@test`, „Krakow"): „Urmărești" în loc de „Editează profilul" — ușa relației funcționează pentru altcineva, nu doar pentru cititor |
| `round43-feed-caption-expanded.jpg` | „Citește tot" apăsat: descrierea urcă la 8 rânduri, „Mai puțin" jos, capul rămâne neatins sus, iar textul se termină deasupra barei de tab-uri (22 dp aer, `padB`) |
| `round43-post-clip-route.jpg` | **un clip adevărat** (postarea 27, Veneția): capul sus, descrierea jos pe 3 rânduri cu „Citește tot", rail-ul vertical, discul de sunet și bara `0:11 / 0:17` — ceasul se oprește înainte de coloana discului |
| `round43-search-reel-card.jpg` | **căutare** (`afectat`): același clip ca *card* — capul sus în card, descrierea jos, rândul de acțiuni sub ea. Căutarea nu deschide un reader separat: cardul este citirea, iar compoziția lui este `PostCard` (`layout="post"`), deci regula e aceeași |

**Ce s-a măsurat despre memorie (runda 42 lăsase trei `OutOfMemoryError` în `MediaCodecRenderer`):**

- contorul nou, citit din `adb logcat`: swiping pe **10 pagini de feed** a dat `peak=2` redări vii, fiecare
  pagină închizându-și biletul când ieșea din fereastra listei (`live=0` la final); pe **walk-ul din
  profil** (8 pagini) vârful a fost `1`. Nu s-a văzut nicio acumulare de redări și niciun `OutOfMemoryError`
  în sesiune (logcat filtrat pe `OutOfMemoryError|FATAL|MediaCodecRenderer`).
- `dumpsys meminfo app.nexus.mobile.dev`: PSS 1 015 MB înainte de cele 10 pagini, 843 MB după (RSS 1 190 →
  1 018 MB) — deci swiping-ul **nu** crește memoria; cei ~500 MB de native heap sunt ai procesului, nu ai
  unei liste de playere.
- cauza rămasă, dovedită prin citire și nu prin măsurare: `PostMediaGallery` montează un `RemoteVideo`
  pentru **fiecare** atașament (până la `MAX_MEDIA = 5`), deci un carusel de 5 clipuri ar ține 5 decodoare pe
  un singur card. În baza de acum nu există niciun astfel de post (`tools/_diag-media-counts.mjs`: toate
  postările au exact un atașament), deci nu se poate nici măsura, nici verifica vizual o schimbare acolo —
  rămâne scrisă ca următorul levier, nu făcută pe nevăzute.

**Ce s-a dovedit totuși cu degetul, după mutarea capului:** pe pagina din feed, `input motionevent
DOWN/MOVE/UP` pe Like a scris în urmă `grant → hold → aim(cell=1) → aim(cell=2) → aim(cell=3) →
release(cell=3)`, fără `terminate` — glisarea continuă de emoji a rundei 42 merge și cu capul sus.

**Ce NU s-a făcut:** nimic publicat, nicio scriere în bază, nicio setare a telefonului modificată, nicio
reinstalare, niciun push. xPortal, `docs/` și datele de producție neatinse.

**Ce rămâne deschis:** (1) un carusel de clipuri (5 atașamente) ar ține 5 decodoare — de reparat când
există un astfel de post cu care să se facă dovada vizuală; (2) ceasul previzualizării compozitorului are
încă doar dovadă de sursă (cere o captură nouă din cameră); (3) cele două pagini de media din feed pe care
le-am prins erau fotografii, iar clipul a fost citit pe rută (`round43-post-clip-route.jpg`) — compoziția
este aceeași ramură (`stage === 'reel'`/`'media'`), dar o captură a unui clip **în feed** ar închide
complet rândul.

## 0.42 Un gest, o stare, aceleași suprafețe: feed, profil și căutare (31 octombrie 2026)

**Starea depozitului.** Schimbare de cod pe ramura `codex/camera-draft-stability` (fără push, fără
reinstalare, fără ștergeri de date, fără postări publice). `tsc --noEmit` exit 0; toate cele 67 de suite
`scripts/test-*.cjs` exit 0 (două noi: `test-post-engagement.cjs`, `test-reaction-gesture.cjs`); jurnalul
`builds/metro.log` păstrează urma fiecărui gest executat pe telefon.

**Ce s-a schimbat, pe fișiere:**

| fișier | de ce |
| --- | --- |
| `src/lib/postEngagement.ts` (nou) | **un** registru pe postare: rezumat de reacții, comentarii, salvat, redistribuit, foaia deschisă, plata în așteptare. Optimist cu întoarcere, o singură scriere pe zbor (`IN_FLIGHT`), iar un payload **umple** un câmp necunoscut și nu rescrie niciodată ce a făcut cititorul |
| `src/components/PostSheets.tsx` (nou) | filele pe care le au toate suprafețele: firul de comentarii (`CommentsSheet`) și confirmarea like-ului plătit (`ActionPaymentSheet`), montate o dată, din registru |
| `src/components/PostCard.tsx`, `src/components/ReelsReader.tsx` | fără stare proprie și fără `setPostReaction/save/repost/share`: citesc registrul, montează `PostSheets`, primesc `busy` din el (reel-ul îl avea, pagina de cuvinte nu) |
| `src/lib/reactionTrace.ts` (nou) | urma gestului (`grant`/`hold`/`aim`/`release`/`terminate`/`request`), mărginită, ca telefonul să poată fi întrebat ce a făcut cu degetul |
| `src/components/ReactionControl.tsx` | scrie în urmă fiecare decizie; gestul, regula de alegere și anularea rămân neschimbate |
| `src/components/PostCanvas.tsx` | bara clipului este `Animated.Value` (nu mai re-renders compoziția de ~9×/s); `mediaClock` — ușa prin care un strat desenat de apelant (compozitorul) își trimite ceasul; scrimul capului se pictează **după** decorări, ca un sticker să nu mai treacă prin nume |
| `src/app/post/[id].tsx` | pagerul walk-ului se oprește cu panoul deschis (`scrollEnabled={!paletteOpen}`) — regula pe care feed-ul o avea din runda 9 și ruta nu; walk-ul montează câteva pagini, ca feed-ul (`initialNumToRender`/`maxToRenderPerBatch`/`windowSize`), nu 21 |
| `src/components/CaptureEditor.tsx` | ceasul previzualizării (`VideoPreview` → `PostCanvas.mediaClock`), banda rândului editorului (`postPageTopInset`) ca `×`/`Next` să nu mai stea peste avatar, iar un clip necunoscut este `contain` de la primul cadru |
| `scripts/test-post-engagement.cjs`, `scripts/test-reaction-gesture.cjs` (noi) | registrul ca funcție (umplere, optimist, refuz, 402, o scriere) + urma gestului, ceasul și banda editorului |
| `scripts/run-tests.mjs` (nou, `npm run test:all`), `tools/_diag-clip-ids.mjs` (nou, doar citire) | lanțul de 67 de suite rulat dintr-un singur proces (34 s, o linie per eșec, cod de ieșire) — prin trei shell-uri eșua tăcut; și un cititor al bazei care spune ce clipuri și ce pagini de cuvinte există, ca un test de telefon să deschidă exact postarea potrivită |
| `tools/repair-mojibake.ps1` (nou) | repara diacriticele dublu-codate de un editor (17 secvențe, pe coduri de caractere), după ce un fișier nou a ieșit cu `AcÈ›iunea` în loc de `Acțiunea` |
| `src/theme/...`, `docs` | neschimbate |

**Ce s-a văzut pe telefon (JPG citit, nu doar fișier existent):**

| captură | ce arată |
| --- | --- |
| `round42-reel-palette.jpg` | reel deschis din profil, deget ținut pe Like: pastila de 8 emoji **peste** video, emoji-ul de sub deget crescut (👍, cel din dreapta) cu chips-ul „Like" deasupra; bara `0:05 / 0:05` și discul de sunet neatinse |
| `round42-reel-head-scrim.jpg` | aceeași pagină: decorarea de pe clip („Test Video ❤ 10:35") este sub scrimul capului, iar numele, `@wallet4e8gv6 · 2 z`, `Bucharest` și „Editează profilul" se citesc peste ea |

**Ce s-a dovedit cu degetul (nu din cod):** urma din `builds/metro.log` arată aceeași secvență pe trei
suprafețe — postare de text în feed (`10:30:18` → `cell=1`), reel în feed (`10:31:06` → `cell=1`), reel
deschis din profil cu derivă verticală de 15 dp (`10:31:42` → `cell=1`) — fără niciun `terminate` cât timp
panoul era deschis.

**Capcane confirmate din nou:** (a) `uiautomator dump` cere `idle`, deci coordonatele pentru atingeri s-au
luat pe ecrane statice (clip oprit cu un tap); (b) Metro nu reîmprospătează acest telefon — fiecare lot de
verificare a cerut `am force-stop` + deep link pe clientul de dezvoltare; (c) gestul de deget se poate
reproduce fidel doar cu `input motionevent DOWN/MOVE/UP` (un `input swipe` nu ține apăsat), plus
`dumpsys window` înainte de fiecare intrare.

**Ce NU s-a făcut:** nimic publicat, nicio migrare sau ștergere în bază, nicio setare a telefonului
modificată, nicio reinstalare, niciun push. xPortal nu a fost atins.

**Ce rămâne deschis:** (1) aplicația a fost omorâtă de sistem de trei ori cu `OutOfMemoryError` în
`MediaCodecRenderer` (tombstone 09:53, 10:28) — walk-ul montează acum câteva pagini, ca feed-ul, dar
scurgerea nu este dovedită vindecată (măsurată în §0.43: vârf de două redări, nicio acumulare); (2)
previzualizarea compozitorului are ceas și `contain` corect, dar dovada vizuală cere o captură nouă din
cameră; (3) feed-ul păstrează aranjamentul rundei 8 pentru paginile lui și nu a fost mutat pe
`layout="post"` — o singură schimbare de prop, dacă ownerul o cere — **închis în §0.43**.

## 0.41 Profil: reelul se citește ca o postare, iar previzualizarea compozitorului este postarea (31 octombrie 2026)

**Starea depozitului.** Schimbare de cod pe ramura `codex/camera-draft-stability` (fără push, fără
reinstalare, fără ștergeri de date): un reel deschis din profil se citește acum cu același cap, același
picior și aceeași coloană ca o postare de cuvinte deschisă din același profil, iar previzualizarea din
compozitor desenează **compoziția publicată**, nu o aproximare a ei. `tsc --noEmit` exit 0, toate cele 66
de suite `scripts/test-*.cjs` exit 0 (două suite noi), `git status` arată doar fișierele de mai jos plus
munca necomisă de dinainte (xPortal), neatinsă.

**Ce s-a schimbat, pe fișiere:**

| fișier | de ce |
| --- | --- |
| `src/lib/overlayFrame.ts` (nou) | un singur dreptunghi pentru textul de peste un clip: `mediaContentRect` (`cover`/`contain`, ca `object-fit`), `overlayWindow` (partea vizibilă), `overlayFontSize`/`overlayPadding`/`overlayMaxWidth` din foaia creatorului, `overlayPercent`/`overlayFraction`, `OVERLAY_LIMITS` |
| `src/components/PostOverlay.tsx` (nou) | **un** renderer pentru etichetele de peste imagine, folosit și de compozitor (cu tragere), și de postarea publicată |
| `src/components/PostDecorations.tsx` | nu mai are socoteala lui: desenează cu `PostOverlay` |
| `src/lib/studioManifest.ts` | `studioDecorations()` — lista exactă pe care o publică manifestul, pe care previzualizarea o citește |
| `src/components/PostCanvas.tsx` | `mediaOverride` (fișierul local al compozitorului), `mediaOverlay` (decorările, **sub** cap și sub caption), capul mare al paginii (`pageHead`), `railFootGutter` pentru ceasul clipului, `hitSlop` de 44 dp pe bară, eroarea de **coloană sonoră** nu mai este raportată ca fișier media lipsă |
| `src/components/ReelsReader.tsx` | `layout="post"`, `topInset`/`bottomInset`, banda unică `band`, ușa autorului (`RelationButton`), `Vezi traducerea` scos de pe clipuri |
| `src/app/post/[id].tsx` | fără antet de rută peste o pagină care își tipărește capul (`ownsHead`), piciorul paginii din profil pentru orice fel de pagină, placa de metal (footerul gri) pe orice pagină din profil |
| `src/components/CaptureEditor.tsx` | previzualizarea este `PostCanvas` + `PostOverlay` + `PostRail`, în dreptunghiul publicat, cu piciorul măsurat al editorului |
| `scripts/test-overlay-frame.cjs`, `scripts/test-profile-reel.cjs` (noi) | aritmetica celor două module și faptul că amândouă suprafețele le folosesc |
| `scripts/test-post-chrome.cjs`, `test-reader-page.cjs`, `test-fullscreen-feed.cjs`, `test-feed-rail.cjs`, `test-text-page.cjs` | aserțiunile de sursă actualizate la regula rundei 41 (aceeași regulă, alt text) |

**Ce s-a văzut pe telefon (JPG citit, nu doar fișier existent):**

| captură | ce arată |
| --- | --- |
| `round41-feed-reel.jpg` → `round41-feed-overlay.jpg` | feed: „Test video❤️" era tăiat la marginea stângă („t video"), acum e întreg — `overlayWindow` ține eticheta în partea vizibilă; „Vezi traducerea" a dispărut de pe clip; bara `0:02 / 0:05` se termină la ~358 dp, discul de sunet începe la 401 dp |
| `round41-profile-reel-head.jpg` (01:20) | reel din profil, **fără** al doilea antet: cap sus (față 54 dp, nume 17 dp, `@handle · timp`, locul, „Generat cu AI"), „Editează profilul" sus-dreapta, descrierea jos, bara deasupra benzii de metal |
| `round41-reel-expanded.jpg` (01:21) | „Citește tot" → textul se desface **în sus**, marginea de jos rămâne pe loc („Mai puțin" exact unde era „Citește tot"), coloana din dreapta rămâne liberă |
| `round41-profile-text-post.jpg` (01:12) | referința: postare de cuvinte din profil — cap sus, foaie crem, coloană, `1/2`, banda de metal la picior |
| `round41-composer-preview-20261031-013840.jpg` (01:38) | compozitor: clipul umple ecranul, „Text peste video" la ~40 dp în centrul dreptunghiului de conținut, cap alb sus, coloana de reacții deasupra barei editorului |

Măsurători (px fizici ÷ 2,6): capul începe la ~150 px (58 dp = `insets.top`), avatar 140 px (54 dp), bara
clipului se oprește la ~930 px (358 dp), discul de sunet ocupă 1043–1185 px (401–456 dp), banda de metal
are înălțimea insetului (~50 px, 19 dp) — aceeași pe reel și pe pagina de cuvinte.

Restul fișierelor `round41-*` din `final_jpg` sunt **sonde**, nu dovezi: `probe-tabs`, `probe-profile`,
`profile-probe2` (ecranul pe care s-a nimerit o atingere greșită), `probe-state` (splash-ul aplicației
după ce sistemul i-a omorât procesul) și cele două variante mai vechi ale previzualizării
(`composer-preview.jpg`, `…-013052`, `…-013503`), păstrate ca să se vadă exact ce s-a corectat.

**Capcane confirmate din nou:** (a) `uiautomator dump` nu poate citi arborele cât timp un clip redă în
buclă (`could not get idle state`), deci coordonatele pentru atingeri s-au luat din arbore doar pe ecranele
statice (profil, compozitor) sau din măsurarea pixelilor din JPG; (b) Metro de pe acest telefon **nu a
reîmprospătat** fișierele editate (nici o linie `Android Bundled` după salvare) — fiecare rundă de
verificare a cerut repornirea lui (`Stop-Process` pe `expo start`, apoi `run-metro.ps1` lansat detașat prin
`Win32_Process.Create`) și `am force-stop` + deep link pe telefon; (c) procesul aplicației a fost omorât de
sistem (`kill: send 9`) de două ori în timpul verificării — nu un crash JS, nicio urmă în `logcat`.

**Ce NU s-a făcut:** nimic publicat (niciun post, niciun draft nou publicat), nicio migrare sau ștergere în
bază, nicio setare a telefonului modificată, nicio reinstalare. Textul „Text peste video" a fost scris
într-un **draft local** (ultima captură din `files/nexus-camera-tests`), care rămâne pe telefon.

**Ce rămâne deschis:** ceasul clipului nu apare în previzualizarea compozitorului (bara se naște din
progresul redării, iar `VideoPreview` nu raportează încă progres către canvas); un clip **landscape** este
preview-uit `cover` până când `VideoPreview` citește orientarea proprie (publicarea îl pune `contain`, ca
înainte); în compozitor butonul `×` al editorului stă peste avatarul capului (chrome de editor peste pagina
publicată, nu o poziție greșită a paginii).

---


## 0.40 Jungle Book Dev conectat la telefon: Metro + backend local prin `adb reverse` (31 octombrie 2026)

**Starea depozitului.** Rundă strict operațională, fără modificări de cod: aplicația instalată a fost
adusă în prim-plan și legată la Metro, iar datele ei au fost servite de backendul local prin tunelul
`adb reverse`. Nimic nu a fost push-uit; singura modificare din depozit este această secțiune.

**Ce s-a făcut, în ordinea în care s-a făcut:**

| pas | comandă / sursă | rezultat |
| --- | --- | --- |
| dispozitiv | `adb devices -l` | `adb-b42122b-huYC9y._adb-tls-connect._tcp` (Xiaomi MIX Flip, Android 17), aplicația stătea în Expo Dev Launcher |
| backend | `GET http://127.0.0.1:5000/health` | deja pornit (`node server.js`, pid 13952, supervisor în `C:\Nexus\logs\supervisor.log`): `status=ready`, `users 10`, `posts 49`, `media 25` |
| Metro (pornire) | `run-metro.ps1 -Port 8081` lansat detașat prin `Win32_Process.Create` | `Starting Metro Bundler` 00:15:50, `packager-status:running` la 00:16:07 |
| tunel | `adb -s <serial> reverse tcp:8081 tcp:8081` + `tcp:5000` | `adb -s <serial> reverse --list` → `host-24 tcp:8081 tcp:8081` · `host-24 tcp:5000 tcp:5000` |
| deschidere | `nexus-dev.ps1 -Action open` (deep link `nexusdev://expo-development-client/?url=http://localhost:8081`) | `Starting: Intent`, aplicația în prim-plan: `app.nexus.mobile.dev/.MainActivity` |
| bundle | `.expo\dev\logs\start.log` | `metro:bundling:done` id 1, 1 854 module, 33,4 s |
| client conectat | `GET /json/list` pe Metro | `app.nexus.mobile.dev (Xiaomi 25098PN5AC)` · `React Native Bridgeless [C++ connection]` · `25098PN5AC - 17 - API 37` |
| tunel din telefon | `adb shell curl -s http://localhost:5000/health` și `…:8081/status` | `status=ready` și `packager-status:running` — ambele porturi ajung în telefon |
| API servit aplicației | `C:\Nexus\logs\server-2026-10-30.log` | `GET /media/…mp4 206` cu UA `Jungle Book Dev/0.1.0 (Linux;Android 17)`, `GET /api/profiles/wallet4e8gv6 200`, `POST /api/social/impressions 202` din `127.0.0.1`; cereri noi apar după un marcaj inserat în log, deci traficul e live, nu cache |
| dovada vizuală | `scripts/capture-android-screen.ps1 -Name round40-device-connected -StrictFocus -Wake -SettleSeconds 5` | 1 220×2 656, `focusOk=true`, 930 culori, publicat în `JUNGLE_BOOK_VERIFICATION\final_jpg\round40-device-connected.jpg`; validat cu `tools/images/validate-images.ps1` (1 validă, 0 corupte) |

**Ce arată ecranul citit:** feed-ul nativ al aplicației, cu postarea video a lui `@wallet4e8gv6`
(„Bucharest · 1 z · Generat cu AI", text „Concluzie realistă …", butoanele „Citește tot" / „Vezi
traducerea", rail-ul de like/comentariu/salvare/distribuire, butonul de sunet și bara de progres
0:00/0:05). Adică shell-ul dev a luat bundle-ul de la Metro și datele de la backendul local — nu ecranul
gol al Dev Launcher-ului.

**Capcane confirmate:** (a) `adb reverse --list` fără `-s` a ieșit gol deși tunelurile existau — se
citește mereu cu serialul fixat; (b) `uiautomator dump` întoarce `ERROR: could not get idle state`
cât timp feed-ul redă video în buclă, deci `nexus-dev.ps1 -Action ui` nu poate citi arborele pe acest
ecran (dovada vine din JPG + ținta Metro + jurnalul backendului); (c) un proces pornit cu
`Start-Process` dintr-un shell care expiră moare cu tot arborele — Metro a supraviețuit doar lansat
prin `Win32_Process.Create`.

**Ce NU s-a făcut:** nu s-a reinstalat aplicația (`versionName=0.1.0`,
`lastUpdateTime=2026-10-29 21:13:02`), nu s-a golit stocarea, nu s-a șters niciun draft, nu s-a
modificat baza și nu s-a atins nicio setare a telefonului.

---


## 0.39 Autentificarea, pe telefonul real: xPortal ajunge în wallet, contul nou există, emailul real lipsește (29 octombrie 2026)

**Starea depozitului.** `codex/camera-draft-stability`, peste rundele 36–38, cu modificările acestei
runde **locale**: `run-metro.ps1 -Clear` (cache-ul Metro trebuie golit după o schimbare de `.env`),
mesajul de refuz al loginului tradus (`signInFailureMessage` în `src/lib/emailAuth.ts` + testul lui) și
un comentariu în `api.js` care spune care variabilă decide fluxul de înregistrare. **Nimic nu a fost
push-uit.** `apps/nexus-mobile/.env` (ignorat de git) are acum `http://localhost:5000`.

**Ce s-a schimbat față de §0.38:** telefonul **este** conectat (wireless debugging), deci toată partea
care lipsea atunci — lansarea aplicației, loginul, contul nou, parola uitată — a fost rulată pe
dispozitiv. Pe scurt: **aplicația se deschide, contul nou există și loginul pe email funcționează pe
telefon; xPortal ajunge până la walletul care cere amprenta owner-ului; un email real nu poate pleca,
fiindcă providerul este tot `capture`.**
### Dovada, în ordinea în care a fost luată

| pas | comandă / sursă | rezultat |
| --- | --- | --- |
| dispozitiv | `adb devices -l` | `adb-b42122b-huYC9y._adb-tls-connect._tcp device … model:25098PN5AC` (Xiaomi MIX Flip, Android 17) |
| tunel | `adb reverse --list` | `tcp:8081`, `tcp:5000` |
| aplicația | `uiautomator dump` după deep link-ul dev-client | ecranul nativ **JUNGLE BOOK / AUTENTIFICARE**: `Conectează xPortal` + `mainnet`, `SAU CU EMAIL`, `Ai uitat parola?`, `CREEAZĂ CONT` |
| captura | `scripts/capture-android-screen.ps1 -Name round39-login-bottom -StrictFocus` | 1 220×2 656, `focusOk=true`; cardul se termină la „Ai uitat parola?" — **formularul de cont nou este al doilea card, sub pliere**, se ajunge la el prin scroll |
| relay (înainte) | `node apps/nexus-mobile/builds/wc-relay-probe.cjs <origin>` | `http://localhost:5000` → **ALLOWED**; `http://127.0.0.1:5000` → ALLOWED; `http://192.168.1.153:5000` → **DENIED 3000 Unauthorized: origin not allowed**; URL-ul Railway → DENIED |
| configurație | `GET /api/auth-capabilities` | `wallet.ready=true`, `project_id_configured=true`, `project_attested=true`, `origin_attested=true` — **Project ID-ul nu mai lipsește** (`apps/nexus-web/.env`; `C:\Nexus\env\jungle.env` are `NEXUS_WC_PROJECT_ID=` gol, iar `lib/env.js` completează doar cheile goale) |
| xPortal (după fix) | `adb logcat --pid <app>` | `[xportal] provider-ready ms=349` → `pairing topic=26dfc589… reused=false ms=5817` → `xportal-opened via=xportal:` |
| xPortal (server) | `C:\Nexus\logs\server-2026-10-29.log` | `GET /xportal-bridge.html 200`, `/xportal-bridge.js 200`, `/wc-bundle.js 200`, `GET /auth/mvx/init 200 217ms` — toate de la `127.0.0.1`, cu UA-ul telefonului |
| xPortal (blocaj) | `dumpsys window` | `com.miui.securitycenter/…AppLockActivity` cu **„Unlock via fingerprint — For opening xPortal"**: blocarea de aplicații MIUI cere amprenta înainte ca xPortal să afișeze cererea |
| cont nou | formularul aplicației → `POST /auth/email/register` | **201**; ecranul: „@rrommeoo a fost creat. Verifică emailul, confirmă adresa, apoi intră în cont." |
| email | log server | `[email] verification_issued provider=capture to=yahoo.com user=13 delivery=captured_locally` — **capturat, nu livrat** |
| login | formularul aplicației | `POST /auth/email/login 200` → `GET /api/me 200`; sesiune nouă `user_id=13` |
| profil | captura `round39-profile-rrommeoo` | **rrommeoo (social) · @rrommeoo · 0 Urmărești / 0 Urmăritori / 0 Postări · Editează profilul · „Nicio postare încă."** |
| parolă greșită | `input text WrongPass-999` | server `401`; ecranul: **„Emailul sau parola nu sunt corecte."** (înainte: `invalid credentials`) |
| ochiul parolei | `uiautomator`: atributul `password` + text | o apăsare → `password=false`, text **identic** cu ce s-a tastat (19 caractere); a doua → `password=true` |
| repornire | `am force-stop` + deep link | feed autentificat, **fără** `POST /auth/email/login`; `sessions` rămâne 5 → sesiunea vine din stocare |
| logout | meniu → „Ieși din cont" | `POST /auth/logout 200`; rândul sesiunii `user_id=13` **dispare** (`sessions` 5 → 4); celelalte conturi neatinse |
| parolă uitată | captura `round39-forgot-password-sheet` + `POST /auth/email/reset-request` | foaia se deschide cu textul ei; serverul `202`, `[email] reset_issued … delivery=captured_locally` |
| baza (înainte) | `node:sqlite`, read-only | `users 9`, `posts 48`, `media 24`, `comments 41`, `personas 12`, `email_tokens 0`, `sessions 4`, `wallets 0` |
| baza (după) | la fel | `users 10`, `posts 48`, `media 24`, `comments 41`, `personas 17`, `email_tokens 2`, `wallets 0` — **singura linie nouă este `13:rrommeoo`**; cele nouă conturi vechi au rămas fără email și fără verificare |
| backup | `C:\Nexus\data\backups\nexus-before-round39-20261029-072107.sqlite` | `pragma integrity_check=ok`, `9/48/24/41/12` — luat **înainte** de orice scriere |
### Ce s-a reparat și de ce

1. **Originea aplicației nu mai este adresa LAN.** `apps/nexus-mobile/.env` a trecut de la
   `http://192.168.1.153:5000` la `http://localhost:5000`. Sonda de relay dovedește de ce: adresa LAN
   primește `3000 Unauthorized: origin not allowed`, iar un `http:` non-loopback nu este nici context
   sigur (`crypto.subtle` lipsește, deci bridge-ul WalletConnect nu s-ar putea inițializa). `localhost`
   este acceptat din oficiu de relay și a fost adăugat de owner în allowlist. **Onest:** bridge-ul își
   lua pagina de pe `secureBridgeOrigin(API_ORIGIN)` (adică tot `localhost`) și înainte, deci nu pot
   afirma că originea era singura cauză a eșecurilor din rundele 36–37 — nu există log din acele
   încercări. Ce se poate afirma: acum lanțul merge până la xPortal, iar originea LAN este dovedit
   refuzată de relay.
2. **`run-metro.ps1 -Clear`.** `EXPO_PUBLIC_*` se inline-uiește în bundle la transformare; fără golirea
   cache-ului, un Metro pornit înainte de editarea `.env` servește la nesfârșit originea veche.
3. **Fluxul real de email ajunge pe telefon.** Serverul local oferea doar contul local cu handle
   (`NEXUS_LOCAL_ACCOUNTS` deschis), care nu poate trimite niciun link. Variabila a fost pusă pe `0` în
   `C:\Nexus\env\jungle.env`: `/api/auth-capabilities` răspunde acum `registration:"email"` și
   `password_recovery:"email"`, iar al doilea card cere **adresă + parolă + confirmare** (handle-ul se
   derivă din adresă: `rrommeoo`).
4. **Refuzul de login se citește în română.** `signInFailureMessage(status, code, serverText)` în
   `src/lib/emailAuth.ts`, chemat din `signInWithEmail`: `401` → „Emailul sau parola nu sunt corecte.",
   `429`/`RATE_LIMITED` → „Prea multe încercări…", orice altceva păstrează textul serverului (singurul
   care știe motivul). Test nou în `scripts/test-email-auth.cjs`.

### Ce a rămas blocat, cu acțiunea exactă

| criteriu | stare | ce trebuie făcut |
| --- | --- | --- |
| aprobare xPortal cu amprenta | **BLOCKED** | owner-ul deblochează xPortal (App Lock MIUI + amprentă) și aprobă cererea; fereastra bridge-ului este de 5 minute, deci cererea se pornește când owner-ul este lângă telefon |
| email real către `rrommeoo@yahoo.com` | **BLOCKED** | cont Resend + cheie API în `C:\Nexus\env\jungle.env` (`NEXUS_EMAIL_PROVIDER=resend`, `NEXUS_EMAIL_API_KEY=…`, `NEXUS_EMAIL_FROM=Jungle Book <onboarding@resend.dev>`); fără domeniu verificat, Resend livrează **doar** către adresa contului, care este chiar adresa owner-ului — suficient pentru acest test |
| confirmarea adresei, resetarea reală, parola nouă aleasă de owner | **BLOCKED** pe același pas | după cheie, `POST /auth/email/verification/send` trimite linkul real; tokenul capturat azi rămâne **nefolosit**, deci contul este autentic neconfirmat |

Parola contului nou (`JungleFlip-2026-rr7`) este cunoscută de owner și de agent, nu este comisă nicăieri
și este menită să fie **înlocuită** de owner prin linkul real de resetare, ca să rămână doar la el.

**Ce NU s-a făcut:** nu s-a dezinstalat aplicația, nu s-a golit stocarea, nu s-a șters niciun draft
(compozitorul cu textul owner-ului a rămas neatins), nu s-a resetat baza, nu s-a modificat niciun cont
existent, nu s-a atins allowlist-ul Reown și nu s-a comis niciun secret.


| teste | mobil / web | **63 scripturi, 0 eșecuri**; `tsc --noEmit` exit 0; web **894/894** |




## 0.38 Aplicația nu se mai deschidea: un BOM UTF-8 în `package.json` oprea Metro (29 octombrie 2026)

**Starea depozitului.** `codex/camera-draft-stability`, peste pachetul rundei 37 (`da11da6`, `bd14006`,
`4d90f66`), cu reparația acestei runde **local**: *fix(mobile): strip the UTF-8 BOM from package.json that
stopped every Metro bundle* (`425642e`, `apps/nexus-mobile/package.json` −2/+2 linii și un script de gardă
nou). `git status -sb` arată `ahead 32`; **nimic nu a fost push-uit**. Nicio lucrare din rundele 36–37 nu a
fost atinsă: emailul, rutele, ecranele și testele lor sunt exact cum au fost comise.

**Ce s-a găsit, într-o frază:** `apps/nexus-mobile/package.json` fusese salvat cu **BOM UTF-8** (trei
octeți `EF BB BF` în fața lui `{`) în `b6f8255`, iar Metro citește fișierul cu
`JSON.parse(readFileSync(file, 'utf8'))` — deci fiecare cerere de bundle răspundea `500`, iar clientul dev
nu avea ce randa: ecran gri.

### Dovada, în ordinea în care a fost luată

| pas | comandă / sursă | rezultat |
| --- | --- | --- |
| backend | `GET http://127.0.0.1:5000/health` | `ready`, `users 9`, `posts 48`, `media 24` — **baza e intactă, nu a fost scris nimic** |
| backend | `GET /api/auth-capabilities` | `email.configured=true`, `provider=capture`, `login.email_password=true` — configurația rundei 37 e neatinsă |
| dispozitiv | `adb devices -l`, `adb mdns services`, sonde `:5555` pe LAN | **niciun telefon** (nici USB, nici wireless); `Get-PnpDevice` nu arată interfață ADB sau MTP |
| Metro (înainte) | `GET /index.bundle?platform=android&dev=true` | `500 InternalError: Unexpected token '﻿', "﻿{\n \"name\"..." is not valid JSON: …metro\src\node-haste\PackageCache.js` |
| cauza | `git cat-file blob <rev>:apps/nexus-mobile/package.json` | `efaf2d5` = `123 10 32` (fără BOM); **`b6f8255` = `239 187 191`** (BOM) |
| de ce nu a prins niciun test | `node -e "JSON.parse(fs.readFileSync('package.json','utf8'))"` | eșuează, dar `require()`/`npm`/`tsc` trec — loader-ul Node taie BOM-ul; Metro nu |
| Metro (după) | același URL | **`200`, 9 063 285 de octeți** (loopback) și **9 063 293** (LAN `192.168.1.153`) |
| manifest | `GET /` cu `expo-platform: android` | `200`; `launchAsset` = bundle-ul de mai sus, `runtimeVersion exposdk:57.0.0`, `scheme nexusdev` |
| teste | mobil | **62 scripturi / 0 eșecuri** (61 + garda nouă), `tsc --noEmit` curat, `npm run typecheck` exit 0 |
| teste | web | **894/894** |

Cronologia se potrivește cu simptomul: `start.log` din `.expo/dev/logs` arată ultimul bundle reușit la
22:03 pe 28 octombrie, iar `b6f8255` (00:13 pe 29 octombrie) a introdus BOM-ul. După aceea, Metro a fost
repornit și a început să dea `500` — aplicația a rămas pe ecran gri, cu backendul și Metro „pornite".

**Ce s-a schimbat:** cei trei octeți (5 951 → 5 948 de octeți), nimic altceva; plus
`apps/nexus-mobile/scripts/test-package-encoding.cjs`, adăugat în lanțul `npm test`. Testul pică dacă
`package.json`, `app.json` sau `tsconfig.json` mai au BOM vreodată și dacă `package.json` nu mai trece de
**exact** apelul pe care îl face Metro (`JSON.parse(readFileSync(…, 'utf8'))`, nu `require()`).

**Ce NU s-a făcut:** nu s-a dezinstalat aplicația, nu s-a golit stocarea, nu s-a resetat baza, nu s-a
revenit niciun commit și nu s-a umblat la lucrarea de email. Nu s-a atins niciun cont.

### Ce rămâne de făcut, pe telefon (owner, în ordine)

Telefonul nu a fost conectat în această rundă, deci pașii de mai jos sunt **neîncepuți**, nu „verificați":

1. Conectează Xiaomi MIX Flip pe USB, cu **Depanare USB** pornită; acceptă dialogul de autorizare.
2. `adb devices -l` trebuie să arate `25098PN5AC … device`. Dacă apare `unauthorized`, acceptă dialogul.
3. `npm run dev:reverse` (leagă `tcp:8081` și `tcp:5000`) — fără el telefonul nu vede nici bundle-ul, nici
   backendul.
4. `npm run dev:open` — deep link către bundle-ul care acum răspunde `200`. Alternativ: deschide aplicația
   și apasă pe sesiunea din dev launcher.
5. `npm run dev:doctor` — trebuie să raporteze `adb reverse` complet, „ultimul bundle" și textul real de pe
   ecran; `npm run dev:ui` dă textul, adică dovada că WebView-ul a încărcat clientul, nu doar shell-ul.
6. Abia după „verde": ecranele de login, înregistrare și „parolă uitată" pe telefon (fără să creezi conturi).

## 0.37 Email real: cont cu adresă, confirmare, parolă uitată prin link (29 octombrie 2026)

**Starea depozitului.** `codex/camera-draft-stability`, peste `b6f8255` (runda 36), cu pachetul acestei runde
**local**: *feat(email): real transactional email, address verification and link-based password reset*
(`da11da6`, 34 fișiere, +3 962 / −41) și `bd14006` (doi helperi nefolosiți, șterși), plus notele din acest
fișier. `git status -sb` arată `ahead`-ul exact; **nimic nu a fost push-uit**. `.gitignore` acoperă `/_*`;
niciun `env`, `.sqlite`, log, imagine sau APK nu intră în commit. Sondele temporare au fost șterse.

**Ce s-a găsit, într-o frază:** serverul avea un `503` hardcodat pe cererea de resetare și un `410` pe
confirmare, iar singura înscriere cu email cerea o **dovadă de wallet Ed25519 generată în browser** — deci
nici „mi-am uitat parola", nici „mi-am făcut cont cu emailul" nu puteau funcționa, oricât de bine arăta
ecranul.

### Ce s-a livrat, pe componente

| piesă | fișier | ce face |
| --- | --- | --- |
| configurare | `lib/email/config.js` | validează providerul, expeditorul și originea linkurilor; „gol" = neconfigurat; producția refuză `localhost` și `capture` |
| template-uri | `lib/email/templates.js` | 4 mesaje (confirmare, resetare, parolă schimbată, adresă schimbată): tabel 600 px, stiluri inline, fără pixel de tracking, link și ca text |
| provider | `lib/email/providers.js` | `resend` (HTTP + `Idempotency-Key`), `brevo` (HTTP, `api-key`), `capture` (fișier local, `delivered:false`); retry doar pe 429/5xx/rețea |
| tokenuri | `lib/email/tokens.js` | 32 octeți aleatori, stocați ca `sha256`, scară `verify_email`/`reset_password`, consum atomic, revocare, purjare |
| fluxuri | `lib/email/service.js` | înscriere, retrimitere, confirmare, cerere de resetare, resetare, notificare de schimbare |
| stocare | `lib/db.js`, tabel nou `email_tokens` | migrare **aditivă**; `openDb` creează tabela și pe bazele existente |
| rute | `lib/api.js` | 5 rute noi + `email` în `/api/auth-capabilities` + `/api/email/status` + `/api/dev/mail-capture` |
| clientul web | `public/app.js`, `public/interface-locale.js` | ecranul „recuperare cont" nu mai scrie „resetarea prin email nu este activă": cere adresa, cheamă `/auth/email/reset-request` și tipărește răspunsul care nu divulgă existența contului (text în 4 limbi) |

Pagini pentru linkuri: `public/verify-email.html|.js`, `public/reset-password.html|.js` (sub CSP-ul
existent, script extern). Telefon: `src/app/verify.tsx`, `src/app/reset-password.tsx`, `src/lib/emailAuth.ts`,
cinci apeluri în `session.ts`, foaia de recuperare cu mod `email`, iar ecranul de login alege fluxul după
`/api/auth-capabilities`.

### Cum îmi fac cont cu email și cum îmi recuperez parola

1. **Fără niciun provider (azi, pe acest PC):** `POST /auth/email/register` creează contul, iar mesajul se
   scrie în `C:\Nexus\data\mail-capture`. Îl citești cu `GET http://localhost:5000/api/dev/mail-capture`
   (doar de pe acest PC/LAN) sau deschizând fișierul `.json`. Fiecare mesaj capturat spune
   `"delivered": false`.
2. **Confirmarea:** deschide linkul din mesaj (`…/verify-email.html?token=…`) în browser, sau
   `nexusdev://verify?token=…` pe telefon. Serverul răspunde „adresa a fost confirmată" — și **nu** te
   conectează automat: intri cu emailul și parola.
3. **Parola uitată:** „Ai uitat parola?" → scrie adresa → primești linkul
   (`…/reset-password.html?token=…` sau `nexusdev://reset-password?token=…`) → alegi parola nouă. Toate
   sesiunile vechi sunt deconectate, iar linkul moare după prima folosire (30 de minute valabilitate).
4. **Cu un provider real:** se setează `NEXUS_EMAIL_PROVIDER`, `NEXUS_EMAIL_API_KEY`, `NEXUS_EMAIL_FROM`,
   `NEXUS_EMAIL_LINK_ORIGIN` în `C:\Nexus\env\jungle.env`; `GET /api/email/status` spune imediat dacă
   serverul vede configurația. Pașii, în ordine, în `docs/EMAIL-AUTH-SETUP.md`.

### Ce este dovedit și ce nu

| întrebare | răspuns |
| --- | --- |
| Fluxurile funcționează cap-coadă | **Da**, pe o instanță de unică folosință: `npm run test:email-http` → **22/22** (înscriere → mesaj → confirmare → login → resetare → login cu parola nouă) |
| Teste automate | web **894/894** (15 noi), mobil **61 scripturi / 0 eșecuri**, `tsc --noEmit` curat |
| Domeniu potrivit existent | **Nu.** `nexus.ro` apare doar în fixture-uri și nu are DNS (MX/TXT/`_dmarc` = `ENOTFOUND`) |
| Expeditor creat și verificat | **Nu.** Nu s-a creat niciun cont, nicio cheie, nicio adresă |
| Înregistrări DNS (SPF/DKIM/DMARC) | **Nu.** `tools/email/check-dns.mjs` e gata și a fost rulat doar pe domenii publice de probă |
| Email real livrat | **Nu — `NOT VERIFIED`.** Fluxul a fost testat cu adaptor mock și cu captura locală |
| Datele owner-ului | **Neatinse.** Migrarea a fost dovedită pe o copie `VACUUM INTO`: `users 9→9`, `posts 48→48`, `sessions 4→4`, `personas 12→12`, plus tabela nouă |
| Instanța vie `:5000` | **Repornită și verificată:** `GET /api/auth-capabilities` → `email.configured=true`, `provider=capture`, `delivery=captured_locally`, `link_origin=http://127.0.0.1:5000`, `warnings=[CAPTURE_FALLBACK]`; `GET /api/email/status` → `capture`; baza vie are acum `email_tokens` (0 rânduri) cu indexurile ei, iar `users 9 / posts 48 / sessions 4 / personas 12` au rămas identice |

### Ce trebuie să facă owner-ul

1. **Domeniu + provider:** alege un domeniu pe care îl controlează (sau aprobă cumpărarea unuia, ~10–15 €/an),
   face cont la Resend sau Brevo și pune cheia în `C:\Nexus\env\jungle.env`. Înregistrările DNS le dă
   providerul; nu sunt scrise nicăieri în repo.
2. **Verificarea lor:** `node tools/email/check-dns.mjs --domain domeniul-tau.ro --selector resend` — iese cu
   `0` doar dacă SPF, DKIM și DMARC răspund.
3. **Test pe telefon:** `adb reverse tcp:5000 tcp:5000`, apoi linkul din captura locală (sau mesajul real).
   Telefonul nu a fost conectat în această rundă, deci **nicio captură de ecran** și nicio verificare vizuală
   pentru ecranele noi.
4. **Commit și push:** commitul acestei runde este local; push-ul rămâne la aprobarea owner-ului.

### Ce a mai rămas deschis din rundele anterioare

Runda 36: allowlist-ul Reown pentru `http://localhost:5000`, xPortal cap-coadă pe telefon, `--adopt-handle`
pentru `@test`/`test@nexus.ro`, push. Runda 34: pagina „Mașină", eticheta „Asistat de AI", scrierile sociale
pe instanța vie, eticheta de origine a cititorului web (§31.5.6), rândul de sesiune `audit`.


## 0.36 Login, cont nou, parolă uitată și xPortal: două butoane care nu chemau serverul, plus o configurație care se anula singură (29 octombrie 2026)

**Starea depozitului.** `codex/camera-draft-stability`, peste `57c566c` (checkpoint rundele 20–34) și
`efaf2d5` (runda 35), cu commitul acestei runde — *feat(auth): local signup, working password recovery and a
visible password* — 18 fișiere, +1 692 / −47, **fără push**.
Staging-ul a fost golit înainte de
fiecare verificare; cele 18 sonde/dump-uri de sesiune rămân necomise intenționat. `.gitignore` acoperă
`/_*`, iar niciun `env`, `.sqlite`, log, imagine sau APK nu intră în commit.

**Ce s-a găsit, într-o frază:** două dintre cele trei fluxuri de autentificare nu erau stricate în server,
ci **nu existau deloc în aplicație** (butoanele scriau o propoziție), al treilea (xPortal) era oprit de o
**variabilă goală care anula o configurație completă** aflată în alt fișier, iar loginul pe email rămâne
oprit de datele migrate, exact ca în §0.35.

### Ce era stricat, pe fiecare flux, înainte de orice modificare

| flux | ce se întâmpla pe telefon | cauza reală (cod, nu impresie) |
| --- | --- | --- |
| login email + parolă | `401 invalid credentials` pentru orice combinație | baza vie are **9 conturi, 0 cu email, 0 cu `password_hash`** (§0.35); nu s-a schimbat în runda 36 |
| „Creează cont" | apărea o propoziție: „se face momentan în versiunea web" | `app/index.tsx`: `onSignUp={() => setError(...)}` — **niciun request**. Serverul chiar are `/auth/email/signup`, dar acela cere o **dovadă de wallet Ed25519** generat în browser peste un nonce legat de email (`verifyWalletSignupProof`), imposibil de produs de pe telefon |
| „Ai uitat parola?" | propoziția „recuperarea se face prin xPortal" | serverul răspundea **503** mereu pe `/auth/email/reset-request` și **410** pe `reset-confirm`; nu exista niciun flux de recuperare |
| ochiul de parolă | nu exista | `AuthField` avea `secureTextEntry={secure}` fix |
| xPortal | `503 WALLETCONNECT_PROJECT_NOT_ATTESTED` | `NEXUS_WC_PROJECT_ID=` **gol** în `C:\Nexus\env\jungle.env` anula valoarea reală din `apps/nexus-web/.env` (mai jos) |

### Configurația: două fișiere, iar cel gol câștiga

Serviciul citește `C:\Nexus\env\jungle.env` (prin `jungle-backend-service.mjs`), iar `server.js` mai cheamă
`loadEnv()`, care citește `apps/nexus-web/.env` (gitignored, al owner-ului). Al doilea fișier **avea deja**
tot ce trebuie pentru xPortal:

| variabilă | `C:\Nexus\env\jungle.env` | `apps/nexus-web/.env` |
| --- | --- | --- |
| `NEXUS_WC_PROJECT_ID` | **gol** (placeholder din `tools/local-backend/env.example`) | 32 hex |
| `NEXUS_WC_PROJECT_ATTESTED` | absent | `true` |
| `NEXUS_WC_ATTESTED_ORIGINS` | absent | `http://localhost:5000,http://127.0.0.1:5000,http://192.168.1.153:5000,…` |

`loadEnv` sărea peste orice cheie **deja definită**, iar „gol" nu e „nedefinit": placeholder-ul anula
valoarea reală. Regula s-a schimbat într-un singur loc (`lib/env.js`): **o valoare goală înseamnă
„neconfigurat"**, deci un fișier ulterior o poate completa; o valoare **nemenoartă** câștigă întotdeauna.
Măsurat pe serviciul viu, după repornire: `GET /auth/mvx/init` → **200** pentru `http://127.0.0.1:5000`
**și** pentru `http://192.168.1.153:5000`, `attestation=configured`, `wcProjectId` de 32 de caractere,
`chainId=1`. Efect secundar documentat: în dezvoltare, `GOOGLE_CLIENT_ID`/`SECRET` din același fișier
devin active (serverul le raportează configurate); ecranul telefonului ține în continuare `googleReady={false}`.

**Ownere, un lucru de confirmat:** id-ul din `apps/nexus-web/.env` **diferă** de
`PUBLIC_WALLETCONNECT_PROJECT_ID` din `lib/env.js` (cel publicat, folosit doar de deployment-urile preview).
Dacă `http://localhost:5000` a fost adăugat în allowlist-ul celuilalt proiect, relay-ul va răspunde
`3000 origin not allowed` și va trebui aliniat. Detaliul e în `JUNGLE_BOOK_PROGRESS.md` §36.4.


### Cont nou local, fără email și fără wallet

Noul contract e în `apps/nexus-web/lib/local-account.js`, cu poarta într-o singură funcție:
`NODE_ENV` ≠ production **și** `NEXUS_DEPLOYMENT_MODE=local` explicit **și** cererea vine de la loopback sau
RFC1918 **și** `NEXUS_LOCAL_ACCOUNTS` ≠ `0`; altfel rutele răspund **404** (nu se anunță nici măcar că există).

| rută | ce face |
| --- | --- |
| `POST /auth/local/register` | handle (2–30, `[a-z0-9_]`) + parolă (8–256, **netrimată**) + email opțional: scrypt, 5 personae, sesiune imediată (**201**). Duplicat → **409**; handle-ul existent **nu** e adoptat niciodată; refuză un handle care aparține altcuiva |
| `POST /auth/local/password-reset` | identificator email **sau** `@handle`: rescrie hash-ul, **revocă toate sesiunile**, șterge tokenii de reset. Cont inexistent → **404**; cont **fără** parolă (identitate migrată / wallet-only) → **409 `ACCOUNT_WITHOUT_PASSWORD`**, ca să nu fie preluare de cont |
| `GET /api/auth-capabilities` | ce poate serverul, fără niciun secret: `registration`, `password_recovery`, `local_accounts`, plus pentru xPortal `missing`/`source`/`ready` |

`/auth/email/login` acceptă acum **și** handle-ul (contul local poate să nu aibă email), cu aceleași limite
de rată și același `401` pentru cont inexistent și parolă greșită. `dev-test-account.mjs --adopt-handle`
rămâne separat și tot opt-in: **nu** e fluxul public de înscriere.

### Cum îmi fac cont și cum îmi recuperez parola (fără niciun serviciu de email)

1. **Cont nou, pe telefon:** deschide Jungle Book → secțiunea „Creează cont" → handle (ex. `romeo`) + parolă
   (minim 8) + confirmare → „Creează cont". Emailul e opțional și **nu** e verificat. Contul se creează cu
   parola stocată ca hash `scrypt` și intri direct în profil. Dacă handle-ul e luat: `409`, alege altul.
2. **Login normal:** „Email sau @handle" + parolă. Un cont creat doar cu handle intră cu `@handle`.
3. **Parolă uitată:** „Ai uitat parola?" → scrie `@handle`-ul (sau emailul) + parola nouă de două ori →
   „Setează parola nouă". Serverul rescrie hash-ul și **deconectează toate sesiunile**; apoi intri cu parola
   nouă. Dacă răspunsul e „acest cont nu are parolă", contul e o identitate migrată/wallet-only: acela se
   recuperează prin xPortal, nu prin formular.
4. **De ce e sigur că e doar local:** cele două rute există numai cu `NODE_ENV` ≠ production +
   `NEXUS_DEPLOYMENT_MODE=local` + cerere de pe loopback/LAN. În orice altă configurație răspund `404`, iar
   `NEXUS_LOCAL_ACCOUNTS=0` le închide și pe PC.


### Telefonul: ce s-a schimbat efectiv

- `lib/loginFields.ts` (pur, testabil): ochiul schimbă **doar** vizibilitatea, parola trece neatinsă
  (`passwordSubmissionValue` e identitatea), doar identificatorul se curăță.
- `NexusLogin`: câmp de handle la înscriere, „Email (opțional)", notă de cont local, iar toate cele trei
  câmpuri de parolă au același ochi (`AuthField`, etichetă vorbită „Arată/Ascunde parola", țintă 44×50).
- `PasswordRecoverySheet` (nou): email sau handle + parolă nouă + confirmare; succesul spune **ce handle** a
  fost schimbat, iar refuzul serverului se tipărește verbatim. Nu există mesaj de succes fals.
- `app/index.tsx`: `onSignUp` → `registerWithLocalAccount`, `onForgotPassword` → foaia, plus
  `readAuthCapabilities()` la boot. Propozițiile din runda 34 au dispărut.
- `lib/bridgeOrigin.ts` (nou): pagina podului xPortal se încarcă de pe **`http://localhost:5000`** când
  API-ul e pe LAN în `http:` (singurul `http:` care e context sigur pentru WebCrypto și singura origine din
  allowlist pe care owner-ul a confirmat-o). Restul aplicației rămâne pe LAN; tokenul NativeAuth emis la
  localhost e acceptat la `/auth/mvx/native` fiindcă callback-ul de dezvoltare acceptă loopback. Dacă pagina
  nu se încarcă, mesajul spune exact `adb reverse tcp:5000 tcp:5000`.

### Dovezi

| dovadă | unde |
| --- | --- |
| backup **înainte** de orice atingere | `C:\Nexus\backups\db\2026-10-28-230046-round36-pre-auth` (`integrity ok`, 9 conturi / 48 postări / 4 sesiuni) |
| teste web | **879/879** (`node --test test/*.test.js`), din care **11** noi în `test/local-account-auth.test.js` |
| teste mobil | **57 de grupuri, 0 eșecuri**, două scripturi noi: `test-login-fields.cjs`, `test-bridge-origin.cjs` |
| TypeScript | `tsc --noEmit` → **0** |
| flux complet, pe HTTP real | instanță disponsabilă (port 5099, date temporare, **șterse**): **18/18 PASS** — înscriere 201, `/api/me` 200, logout 200→401, login cu handle și cu email, parola cu spații *fără* spații → 401, duplicat 409, reset 200, tokenul vechi 401, parola veche 401, parola nouă 200, cont necunoscut 404 |
| persistență după repornire | proces oprit și repornit pe aceleași date: `/api/me` **200** cu tokenul de dinainte, login **200** |
| xPortal | `GET /auth/mvx/init` → **200** (`configured`, `chainId=1`) pentru `http://127.0.0.1:5000` **și** `http://192.168.1.153:5000`; 503-ul a dispărut |
| baza vie neatinsă | recitită la final: **9** conturi, **0** email, **0** hash, **48** postări, **4** sesiuni, aceleași handle-uri |

### Ce NU e dovedit (și de ce)

1. **Nimic pe telefon în runda 36.** Telefonul a ieșit din adb înainte de test (`adb devices` gol,
   `adb mdns services` gol, portul wireless vechi închis), iar reconectarea cere codul de pairing afișat pe
   telefon — adică o setare a telefonului, pe care regulile o interzic. Deci: **nicio captură în runda 36**,
   iar fluxurile de mai sus sunt dovedite pe HTTP, cu exact headerele clientului, nu pe ecran.
2. **Allowlist-ul Reown** rămâne neverificat de aici (fără dashboard autentificat). Serverul atestă acum
   `http://localhost:5000`, dar dacă relay-ul îl refuză, mesajul lui apare în pod (`relay-refused`).
3. **xPortal cap-coadă** (aprobare în xPortal, semnătură, sesiune) nu s-a testat: cere telefonul de la
   punctul 1. Nu se raportează ca reușit.

### Ce urmează, în ordine

1. **Owner, pe telefon:** `adb reverse tcp:5000 tcp:5000`, apoi deschide aplicația → „Creează cont" (handle
   + parolă) → intram automat. „Ai uitat parola?" schimbă parola oricărui cont **care are deja** una.
2. **Owner:** confirmă în Reown că `http://localhost:5000` e în allowlist-ul **proiectului al cărui id e în
   `apps/nexus-web/.env`** (nu cel din `lib/env.js`).
3. **Owner:** pentru `@test`/`test@nexus.ro` rămâne valabilă aprobarea din §0.35 (adoptare opt-in); runda 36
   **nu** a atins acel rând.
4. **Push:** cele trei commituri locale așteaptă aprobarea explicită.


## 0.35 Checkpoint git, loginul local și xPortal: două configurații, nu două bug-uri (28 octombrie 2026)

**Starea depozitului.** `codex/camera-draft-stability`, commit **`57c566c`** —
`checkpoint: preserve Jungle Book rounds 20-34` — 174 de fișiere, +20 860 / −2 947, `ahead 24`, **fără push**
(nu a fost aprobat). Staging-ul e gol, iar cele 18 fișiere rămase necomise sunt sonde/dump-uri de sesiune,
lăsate afară intenționat. Runda 35 are commitul ei separat, peste checkpoint (reparația de adoptare, testele
ei și textele de față).

**Ce s-a găsit, într-o frază:** ambele loginuri eșua în **datele și configurația locală**, nu în cod —
baza adusă din exportul Railway nu are niciun cont cu email și parolă, iar serverul local nu are Project ID
WalletConnect, deci refuză xPortal înainte de orice relay.

### Email + parolă

| întrebare | răspuns verificat |
| --- | --- |
| `test@nexus.ro` există în baza vie? | **nu**. `user_id 1` e `@test`, cu `email = NULL`, `password_hash = NULL`, 7 postări, persona `social` |
| alte conturi? | 9 în total, **0** cu `email`, **0** cu `password_hash` — deci „eșuează și celelalte" e același singur fapt |
| parola reținută se verifică? | **nu se poate verifica**: nu există hash. Nu se afirmă că e corectă. Niciun test nu a scris-o, tipărit-o sau comis-o |
| de ce lipsește? | exportul `C:\Users\Romeo\NexusBackups\railway-export-20261027` **nu conține niciun email**, iar `tools/migration/import-local.mjs` nu importă `password_hash` (API-ul public nu expune hash-uri) |
| ce răspunde serverul? | `POST /auth/email/login` → **401 `invalid credentials`** (ruta veche `/auth/login` e `410`); scrypt `N=16384,r=8,p=1`, sare 16 octeți, `salt:hash`, `timingSafeEqual`, minim 8 caractere |
| aplicația arată eroarea reală? | **da**, o tipărește verbatim (`invalid credentials`, în engleză) — nu e o eroare generică mascată |
| telefonul ajunge la PC? | **da**: 8× `POST /auth/email/login 401` în `C:\Nexus\logs\server-2026-10-28.log`, de la `192.168.1.184 okhttp/4.12.0` |

**Reparația minimă, gata dar ne rulată pe datele owner-ului:** `dev-test-account.mjs --adopt-handle`
(`lib/preview-test-account.js` capătă opțiunea `adoptHandle`, implicit `false`; `server.js` nu o folosește).
Leagă emailul de **rândul care există** (`users.id = 1`), îi pune parolă și verifică adresa; refuză dacă
handle-ul poartă alt email. Dovada, pe un **snapshot** al bazei (port 5099, director temporar, șters la
final): login **200** + `nexus_session`/`nexus_device_id`, `/api/me` **200** (`@test`, `persona=social`,
5 profile), parolă greșită **401**, logout **200** apoi **401**, fără cookie **401**, iar după repornirea
procesului același cookie dă **200**. Baza vie a fost recitită după teste: **neschimbată**. Detalii în
`JUNGLE_BOOK_PROGRESS.md` §35.6.

### xPortal / WalletConnect / Reown

`GET /auth/mvx/init` → **503 `WALLETCONNECT_PROJECT_NOT_ATTESTED`**. În `C:\Nexus\env\jungle.env`:
`NEXUS_WC_PROJECT_ID` e **gol**, iar `NEXUS_WC_PROJECT_ATTESTED`, `NEXUS_WC_ATTESTED_ORIGINS` și
`NEXUS_ORIGIN` lipsesc (`NEXUS_DEPLOYMENT_MODE=local`, deci nici implicitul de preview nu se aplică).
`walletConnectAttestation()` cere toate trei, deci serverul refuză **înainte** de relay: allowlist-ul Reown
**nu a fost atins** și nu poate fi cauza de azi. Pe instanța de probă, cu variabilele puse, același endpoint
dă **200** cu `init` real (`mainnet`, `chainId=1`), iar cu un `Host` neatestat dă **503** — regula de origine
funcționează și cere **exact** originea pe care o încarcă WebView-ul (`http://192.168.1.153:5000` azi).
**Allowlist-ul Reown rămâne neverificat de aici** (fără CLI/token/sesiune de dashboard) — îl verifică owner-ul.

De reținut pentru pasul următor: `http://192.168.1.153:5000` **nu** e context sigur (WebCrypto), deci chiar
cu Project ID corect podul poate eșua; `adb reverse tcp:5000` + `http://localhost:5000` este varianta care
închide și problema asta, iar atunci originea de atestat este `http://localhost:5000`.

### Ce urmează

1. **Owner:** aprobă `dev-test-account.mjs --adopt-handle` pe `C:\Nexus\data`, cu o parolă aleasă de el
   (§35.5 are impactul exact: un singur rând, reversibil din backup).
2. **Owner:** Project ID-ul Reown (proiectul „Jungle Book") + confirmarea allowlist-ului pentru originea
   aleasă; apoi cele patru variabile în `C:\Nexus\env\jungle.env` și repornirea serviciului.
3. **Agent, după 1–2:** login pe telefon (email și xPortal) + captură — azi **NEVERIFICATE** ca reușită.
4. **Neatinse în runda 35:** nicio postare, niciun cont, nicio parolă, nicio variabilă din `C:\Nexus\env`,
   niciun deployment. Railway rămâne „READY to stop, NOT READY to delete" (§34.9).


## 0.34 Totul local: implicitul remote scos, cele șase fețe pe backend-ul PC-ului, emoji la cursor (28 octombrie 2026)

**Decizia owner-ului:** Jungle Book rulează în întregime pe PC. Railway nu este backendul dorit și nu se
face niciun deployment acolo. Telefonul vorbește cu PC-ul.

**Starea, într-o propoziție:** aplicația era deja locală în fapt (serviciu `tools/local-backend`, port
5000, `C:\Nexus\data`, media conținut-adresată), dar mai avea două **implicituri** care puteau trimite un
build pe un host remote — `apiOrigin.ts` și `tools/dev-start.ps1` — iar emoji-ul „la cursor" nu putea fi
atins de pe telefon. Amândouă sunt închise și dovedite.

### Ce s-a schimbat

| fișier | schimbare |
| --- | --- |
| `apps/nexus-mobile/src/lib/apiOrigin.ts` | `HOSTED_ORIGIN` (Railway) **scos**; treapta a treia este `http://localhost:5000` prin `adb reverse tcp:5000`, anunțată pe consolă; `apiOriginLabel` nu mai are nume special pentru un host străin |
| `apps/nexus-mobile/scripts/test-api-origin.cjs` | rescris: 8 teste, inclusiv „niciun host remote în surse" și „singurele URL-uri din rezolvare sunt locale" |
| `tools/dev-start.ps1` | originea API derivată local (env → LAN → loopback), `adb reverse tcp:5000` când e loopback, rezumatul tipărește originea; verificat cu `Parser::ParseFile` |
| `apps/nexus-mobile/builds/metro-railway.cmd` | retras (întoarce codul 3 și trimite la `builds\metro-local.cmd`, care citește `.env`) |
| `CommentsSheet.tsx`, `CaptureEditor.tsx` | textele vizibile nu mai numesc Railway („serverul", „selecția semnată de server") |
| comentarii `publishClient`, `capturePublish`, `commentNavigation`, `postInteractions`, `ProfileMenuSheet`, `SettingsScreen` | rescrise la „server" |
| `apps/nexus-mobile/src/lib/postOrigin.ts` | **doar AI** primește etichetă: „Asistat de AI" / „Generat cu AI"; cameră, autor obișnuit și nedeclarat nu tipăresc nimic; prefixul „Declarat:" scos; valoarea salvată și validarea neatinse |
| `apps/nexus-mobile/scripts/test-post-origin.cjs` | rescris: 5 teste, ține regula de mai sus |
| `apps/nexus-mobile/src/components/EditorialPage.tsx` | **`lastCaretRef`**: cursorul supraviețuiește închiderii câmpului, deci emoji-ul apăsat după „Gata" intră la cursor, nu la coada paragrafului |
| `apps/nexus-mobile/scripts/test-text-field.cjs` | al zecelea test: contractul cursorului reținut |
| `apps/nexus-web/scripts/text-faces-http-e2e.mjs` + `npm run test:text-faces` | **nou**: 144 de publicări (6 fețe × 4 mărimi × 6 teme) prin HTTP real, pe un director temporar, plus citire, arhivă și rândul din SQLite |
| `tools/local-backend/audit-local.mjs` | **nou**: audit read-only al instanței vii (health, version, bază, hash-uri de media, HTTP de media, citiri autentificate opționale) |
| `tools/remote-access/start-quick-tunnel.ps1` | reparat: `?.Source` nu există în PowerShell 5.1 (scriptul nu pornea deloc) |
| `docs/DEV-WORKFLOW.md`, `docs/22-local-to-hosted.md`, `apps/nexus-mobile/README.md`, `apps/nexus-mobile/.env.example` | descriu noul implicit local, fără să șteargă istoricul |

### Dovezi

* `apps/nexus-web`: `node --test test/*.test.js` — **862 teste, 0 eșecuri**.
* `apps/nexus-mobile`: `npm test` — **58 de fișiere, 0 eșecuri**; `tsc --noEmit` exit 0.
* `npm run test:text-faces`: **PASS** — 144/144 acceptate și întoarse identic, toate cele șase fețe la
  `xlarge`, `144/144` rânduri identice în bază, pagina în arhivă.
* `audit-local.mjs --handle wallet4e8gv6` pe instanța vie: **toate PASS** — `/health` și
  `SELECT COUNT(*)` egale (9 conturi, 48 de postări), 24 de fișiere media cu hash și dimensiune corecte,
  media prin HTTP, `/api/me`, feed (20), arhivă (21: text 7, image 13, video 1), detaliu postare.
* Repornire controlată: `stop-backend.ps1` → „backend stopped cleanly" → `start-backend.ps1` → supervisor
  nou, `healthy: true`, `data dir C:\Nexus\data`; auditul a trecut din nou; telefonul a reîncărcat și a
  arătat aceeași postare.
* Pe telefon (MIX Flip, `focusOk: true`, fiecare captură citită):
  `r34_feed_after_origin_change.jpg` (postarea #52, `CAMERA_CAPTURED_DECLARED`, **fără** linie de origine),
  `r34_emoji_at_caret.jpg` (`A😀na are mere.` — emoji la offset 1), `r34_emoji_mid_sentence.jpg`
  (`A😀na are mer😀e.` — cursorul vizibil după al doilea emoji), `r34_after_restart.jpg` (aceeași postare
  după repornirea serviciului).
* Dinspre server (`C:\Nexus\logs\server-2026-10-28.log`, `NEXUS_REQUEST_LOG=1`): **47 de cereri de la
  `192.168.1.184` cu `okhttp/4.12.0`**, pe 9 rute, toate `200`/`202` — telefonul vorbește cu PC-ul.

### Ce rămâne deschis

1. **Retragerea Railway** este documentată, nu executată: fără CLI/`~/.railway`/`RAILWAY_TOKEN` pe acest
   PC, inventarul platformei (servicii, volum, domenii, backup-uri) cere dashboard-ul owner-ului. Datele și
   media sunt locale (exportul din 27 octombrie: 8 conturi, 36 de postări, 20 de fișiere, 0 eșuate; importul
   a raportat `integrity: ok`), dar „oprește/șterge" cere confirmare separată. Nimic remote nu a fost atins.
2. **O pagină „Mașină" publicată de owner** — serverul local o acceptă (matricea de 144), publicarea reală
   este a lui.
3. **Eticheta „Asistat de AI" pe ecran** — nu există nicio postare cu acea valoare; a crea una ar însemna
   conținut publicat sau provenance modificat fără aprobare. Regula e ținută de 5 teste.
4. **Scrieri sociale pe datele reale** (comentariu, reacție, salvare, follow, editare profil, upload) —
   NEVERIFICATE pe instanța vie, acoperite de suita backend și de e2e-urile temporare.
5. **Emoji**: înlocuirea unui interval selectat și emoji lângă rând nou sunt doar în teste pure.
6. **Webul** (`apps/nexus-web`) nu are nici eticheta de origine, nici poarta de contract (§31.5.6).
7. **O sesiune de audit** a fost scrisă în `sessions` (`device_id = "audit"`, „audit runda 34") de
   `audit-local.mjs --handle`; se poate închide ca orice sesiune.
8. **Rundele 20–34 sunt necomise** pe `codex/camera-draft-stability`; commitul cere aprobarea owner-ului.


## 0.33 „Mașină" refuzată la publicare, emoji la cursor, originea conținutului pe pagină (28 octombrie 2026)

*Jurnalul complet al rundei este în `JUNGLE_BOOK_PROGRESS.md` §33. Runda 32 rămâne imediat sub ea (§0.32).*

**Ce s-a cerut.** Trei defecte: (1) o pagină scrisă în litera **Mașină** (`slab`) — și în `casual`,
`condensed`, `xlarge` — e refuzată la `Publică` cu „Alege o temă din listă", deși tema era aleasă; (2) un emoji
apăsat cu cursorul la mijlocul frazei apare **la sfârșitul** paragrafului; (3) originea conținutului
(declarația autorului: cameră / asistat de AI / generat cu AI) nu se vede pe postarea publicată, nici în feed,
nici în profil.

**Cauza refuzului (nu era în client).** `apps/nexus-web/lib/post-text-style.js` are șase fețe **în arborele de
lucru**; deployment-ul Railway (`e74f8ff`) are allowlist-ul de trei fețe. `normalizeTextStyle` întoarce `null`
pentru `slab`, ruta răspunde `TEXT_STYLE_INVALID`, iar editorul nu poate tipări altceva decât mesajul generic
al câmpului. Telefonul nu avea cum să afle allowlist-ul: `GET /api/version` publica `text_style: 1` pentru
ambele servere. Reparația este contractul, nu o constantă în client.

**Ce s-a schimbat.**

- `apps/nexus-web/lib/build-info.js` — `text_style: 2`, cu comentariul celor două înțelegeri (`1` = trei fețe
  și trei mărimi; `2` = șase fețe și `xlarge`); un client care cere `1` trece pe un server `2`.
- `apps/nexus-mobile/src/lib/backendVersion.ts` — `TEXT_STYLE_CAPABILITY_V2`, `TEXT_STYLE_V2_FONTS`,
  `TEXT_STYLE_V2_SIZES`, `BACKEND_TEXT_STYLE_OLDER` + mesaj, `textStyleNeedsV2`, `textStyleV2Refusal` (numește
  litera: „litera «Mașină» (slab)") și `requireTextStyleContract(style)`: server `>=2` ⇒ trimite; server `1`
  ⇒ refuz înainte de POST, cu propoziția că textul rămâne pe telefon; server mut ⇒ `null` (nu blochează);
  pagină în fețele vechi ⇒ nicio cerere.
- `apps/nexus-mobile/src/app/text.tsx` — `await requireTextStyleContract(draft.style)` înaintea lui
  `requirePageCapabilities()` și a încărcării fișierelor; `PUBLISH_TEXT_STYLE` spune acum „temă, literă, mărime
  sau așezare" (nu doar „temă").
- `apps/nexus-mobile/src/lib/textInsert.ts` (nou, pur) — `snapOffset`/`snapSelection` (taie la pagină, ordonă,
  scoate cursorul din mijlocul perechii surrogate) și `insertAtSelection(text, addition, selection)` →
  `{ text, caret }`; cursorul întors hrănește inserarea următoare.
- `apps/nexus-mobile/src/components/EditorialPage.tsx` — `field` = `{ blockId, text, caret, selection }`;
  `onSelectionChange` **păstrează** intervalul (`snapSelection`) în loc să-l arunce; `openField` ține locul
  atingerii și ca prim interval; efectul de inserare scrie la `selection ?? caret ?? text.length` și lasă
  cursorul după emoji.
- `apps/nexus-mobile/src/lib/socialTypes.ts` + `src/lib/postOrigin.ts` (nou) — `SocialPost.provenance`;
  `POST_ORIGIN_LABELS` („Declarat: cameră" / „Declarat: asistat de AI" / „Declarat: generat cu AI"),
  `POST_ORIGIN_HINT`, `originOf(post)`: `NOT_DECLARED`, absent sau necunoscut ⇒ `''` (nimic desenat, nicio
  re-etichetare „creat de autor").
- `apps/nexus-mobile/src/components/PostCanvas.tsx` + `src/lib/postChrome.ts` — a treia linie din antet, sub
  loc, aliniată cu numele (`marginLeft: head.disc + 8`), **în afara** `Pressable`-ului de profil, `numberOfLines`
  = `POST_HEAD.originLines` (2), `accessibilityLabel` = eticheta + `POST_ORIGIN_HINT`; celula de arhivă
  (`tile`) nu o desenează.
- Teste noi: `apps/nexus-web/test/post-text-faces.test.js` (5 cazuri, matrice 144), `apps/nexus-web/test/
  post-content-origin.test.js` (4), `apps/nexus-mobile/scripts/test-text-insert.cjs` (11),
  `scripts/test-post-origin.cjs` (5); `test-backend-version.cjs` (+4 cazuri v2 și aserțiunea `text_style: 2`),
  iar `test-text-field.cjs` / `test-text-integrity.cjs` au fost aduse la adevărul nou. Ambele fișiere noi de
  test sunt în lanțurile `npm test` / `node --test`.

**Dovezi.** `apps/nexus-web`: **862 teste, 0 eșecuri**. `apps/nexus-mobile`: **58 de fișiere, 0 eșecuri**;
`tsc --noEmit` exit 0. Backend local repornit (rula din 27 octombrie cu amprenta în memorie): `/api/version`
dă acum `text_style: 2`, `source_fingerprint c34cf0d2…`, iar poarta telefonului, întrebată pe viu, acceptă
`slab`, `casual`+`xlarge`, `condensed` și lasă `serif` fără poartă. Pe telefon (Xiaomi MIX Flip, 2,6 px/dp):
`JUNGLE_BOOK_VERIFICATION/final_jpg/r33_reader_after_reload.jpg` arată pagina de text din profil cu linia
**„Declarat: cameră"** sub loc; `uiautomator dump` dă bounds `[197,307][839,353]` (x 75,8 dp — exact coloana
numelui și a locului; y 118,1…135,8 dp, un rând), `content-desc` cu toată propoziția, `clickable="false"`.

**Ce rămâne de făcut (nu se poate de aici).**

1. **Publicarea deployment-ului Railway** cu `text_style: 2` — fără ea, „Mașină" se publică doar pe backend-ul
   local. Refuzul actual este corect și explicat, dar nu este succesul cerut; nu raporta runda ca rezolvată în
   producție până la acel deploy (cere aprobarea owner-ului, conform `AGENTS.md`).
2. **Emoji-ul la cursor pe ecran**: compozitorul deschis, o atingere la mijlocul frazei, o apăsare în panoul de
   emoji, două capturi (înainte/după). Regula e testată; gestul nu a fost executat pe telefon.
3. **Un post nedeclarat fotografiat** (dovada părții „fără etichetă"). Cere o navigare în feed; regula rundelor
   interzice Back/Home în timpul capturilor, deci a rămas pe test.
4. Webul are propriul cititor și nu are nici eticheta de origine, nici poarta de contract (neschimbat de la
   §31.5.6).

---

## 0.32 Pagina de text deschisă din profil: fără ușă în pagină, folio mai jos, butoanele telefonului pe argint (31 octombrie 2026)

*Jurnalul complet al rundei este în `JUNGLE_BOOK_PROGRESS.md` §32. Runda 31 rămâne imediat sub ea (§0.31).*

**Ce s-a cerut.** Trei lucruri despre aceeași pagină — un text deschis **din profil**: Back-ul din pagina de jos
e de prisos (aplicația are deja Back în bara de jos); contorul `1/3` să coboare în spațiul de deasupra barei,
cu textul după el; iar butoanele telefonului (Back/Home/recente), albe pe cremă, să primească un argint discret
— **numai aici**. Feed-ul, compozitorul, pozele, clipurile și Reels-urile rămân neatinse.

**Cum e legată schimbarea de origine.** `profileOrigin = handle.length > 0`: parametrul `profile` pe care îl
trimite doar `ProfileTile` (peretele). Recepția compozitorului (`src/app/text.tsx`) trimite doar `id`; feed-ul nu
intră în rută deloc (`FeedScreen` montează `PostCard` direct). `walkMode` a devenit aliasul lui, ca nimic din
runda 30–31 să nu-și schimbe numele.

**Ce s-a schimbat.**

- `src/lib/readerBar.ts` — `PROFILE_READER_FOOT.air = 10` + `profileReaderBottomInset(inset)` (insetul telefonului
  + 10dp de hârtie, fără banda de 48dp a ușii) și `readerDoorShown({ wordPage, profileOrigin, canGoBack })` —
  regula ușii într-un singur loc, cu excepția intenționată pentru intrările fără istoric (`nexusdev://post/<id>`).
- `src/lib/textPage.ts` — `PROFILE_FOLIO = { band: 16, inset: 3 }` + `folioRow(profileReader)`: același folio,
  tipărit mai jos, cuvuntele coboară cu el; `size`/`tracking`/`ink` neschimbate; `folioRow(false)` = `PAGE_FOLIO`.
- `src/components/SystemNavBand.tsx` (nou) — placa de `blackSilver.silver` (`#C4C7CB`) de înălțimea exactă a
  insetului, cu `borderTop` de `deepMercury`, `pointerEvents="none"`, și `<NavigationBar style="dark" />` din
  `expo-navigation-bar`: modulul ține un stack, deci stilul aplicației (`app.json: light`) se întoarce singur la
  demontare. Fără `setBackgroundColorAsync` (nu mai există în edge-to-edge) și fără nicio schimbare globală.
- `src/app/post/[id].tsx` — `bottomInsetFor` alege `profileReaderBottomInset` doar pentru pagina de cuvinte din
  profil, `folioFor` dă rândul folio-ului, ușa e desenată numai când `readerDoorShown` o cere, iar
  `<SystemNavBand>` se montează după pagină și ușă. Sonda `__POST_ROUTE` raportează `profileOrigin`, `wordPage`,
  `door`, `navPlate` (mutată sub deciziile piciorului — altfel `const`-ul se citea în TDZ din lista de dependențe).
- `PostCard` → `PostCanvas` → `EditorialArticle`/`EditorialPage` + `PostTextReading` — un prop nou
  `folio?: { band, inset }`, implicit `PAGE_FOLIO`; marginea fluxului din `EditorialPage` rămâne
  `max(pageFolioBand(), 6,4%)`, ca numărul de pagini al unui articol să nu se poată mișca din poziția cifrelor.
- `scripts/test-reader-page.cjs` — 15 cazuri (7 noi); `test-text-page.cjs` și `test-profile-grid.cjs`
  actualizate pentru adevărul nou (JSX pe mai multe linii, `profileOrigin`).

**Dovezi.** Pe calculator: `npm test` verde (56 de scripturi, 0 eșecuri), `tsc --noEmit` exit 0. Pe telefon
(Xiaomi MIX Flip, 2,6 px/dp, inset de jos 47,7 dp, bară cu trei butoane): pagina 50 deschisă din profil nu mai
are niciun nod de ușă; cifrele folio-ului coboară de la 128,5 dp la **81,9 dp** peste marginea de jos (măsurat în
arborele de accesibilitate: 2407…2443 px, centrate 586…633 din 1220); piciorul paginii e la 942,7 dp; paginarea
rămâne `1/3 → 2/3 → 3/3`, iar un gest în plus rămâne `3/3`; reintrarea pornește de la `1/3`. Placa de argint
începe la y = 2535 px (975 dp), e înaltă de 46,5 dp și măsoară (196,199,204) ≈ `#C4C7CC`; cea mai închisă urmă a
glifelor sistemului în ea este (93,94,96) ⇒ **3,83:1** (înainte ~1,05:1 alb pe crem). Back-ul telefonului a
adus peretele la aceeași derulare și a **readus bara neagră cu glife albe**. Poza 33 din profil: antet + ușă de
10…54 dp, fără folio, fără placă. Textul din feed (`1/2`): neschimbat, bara de tab-uri sub pagină.
Capturi citite: `r32_profile_wall_before_tile.jpg`, `r32_text_reader_from_profile.jpg` (înainte, bundle 31),
`r32_profile_text_reader_low_folio.jpg`, `r32_system_back_returns_to_profile.jpg`, `r32_profile_media_unchanged.jpg`,
`r32_feed_text_page_unchanged.jpg`. (`r32_text_reader_walk_page2.jpg` are un nume greșit: conține pagina de text
din feed, capturată după o reîncărcare.)

**Ce urmează.**

1. Compozitorul pe telefon (rămâne și din §0.31): `EditorialPage` primește `folio`, dar compozitorul nu trimite
   niciunul — deci își păstrează rândul; de verificat pe ecran după o re-liniere.
2. Un clip (Reel) deschis din profil, ca să se vadă pe `ReelPage` că antetul rămâne și placa nu apare.
3. Intrarea fără istoric (`nexusdev://post/<id>`), unde ușa trebuie să rămână — acoperită de test, nu de ecran.
4. Decizia de design rămasă din §0.31.5: discul de la picior (acum inutil în profil, fiindcă ușa nu se mai
   desenează acolo) rămâne negru mat pentru recepția compozitorului.
5. Discul cu roată dințată care se vede pe paginile de text (x≈40…170 px) — de identificat și scos înainte de o
   demonstrație; nu a fost atins de rundă.
6. Portarea în web (`apps/nexus-web`) — rundă separată.




*Jurnalul detaliat al rundelor 20–31 este în `JUNGLE_BOOK_PROGRESS.md` §20–§31. Fișierul de față sare de la
0.19 direct la 0.31, fiindcă rundele de la 20 la 30 s-au scris acolo.*

**Ce s-a cerut.** Două propoziții de la owner, despre aceeași postare de text deschisă din grilă: numele
autorului apare de două ori, unul sub altul; iar sus scrie `1/22` (a câta postare din profil) deși pagina
spune `1/3` — numărul trebuie să fie al documentului, iar Back nu are voie să stea peste text.

**Ce era stricat.** Ruta `src/app/post/[id].tsx` desena un antet propriu peste *orice* pagină (nume +
`@handle` + disc de Back de 34dp + contorul `` `${at + 1}/${list.length}` ``), iar o pagină de cuvinte își
tipărește singură capul (`TEXT_PAGE_HEAD`, disc de 54dp) și folio-ul: pe același ecran, două anteturi, două
numere, fiecare cu alt înțeles. Scoaterea antetului lua însă cu ea singura ieșire a paginii.

**Ce s-a schimbat.**

- `src/lib/postPresentation.ts::readsAsPage` — contractul nou, `stageFor(post) ∈ {text, article}`; îl întreabă
  și canvasul (`wordPage`), și ruta.
- `src/lib/readerBar.ts` (nou) — `READER_BAR` (bandă 48, țintă 44, disc 36, glif 26, margine 10),
  `readerBarHeight(inset)` care **adună** insetul, `readerPageTopInset` = `insets.top` (o pagină de cuvinte
  pornește direct sub ceas, fără cele 52 de puncte de antet).
- `src/app/post/[id].tsx` — antetul numai peste paginile fără cap propriu (`!wordPage`); contorul plimbării a
  plecat complet; pe o pagină de cuvinte, o bandă la picior cu o ușă de 44dp care apasă același `close`
  (istoric → profilul plimbării → feed); insets-urile se decid per pagină.
- `src/lib/textPage.ts::folioLabel` — singurul număr de pe ecran, pentru ambele cititoare (`PostReading`,
  `EditorialPage`); `''` pentru o singură pagină, ultima pagină reală pentru un index rămas în urmă.
- `PostCanvas` / `PostCard` — banda este cedată **înainte** de desenare (`padB + bottomInset`,
  `RAIL_FOOT + bottomInset`, `214 + bottomInset`).
- `scripts/test-reader-page.cjs` (nou, 8 cazuri) + intrare în lanțul `npm test` după `test-post-chrome.cjs`.

**Dovezi.** Pe calculator: `npm test` verde (56 de scripturi, 0 eșecuri), `tsc --noEmit` exit 0. Pe telefon
(Xiaomi MIX Flip, 1220×2656 @416dpi ⇒ 2,6 px/dp): capul paginii începe la 58 dp (fără antet); un singur nod de
autor; folio `1/3` → `2/3` → `3/3`, iar un gest în plus rămâne `3/3`; reintrarea repornește de la `1/3`; o
pagină singură nu are număr; ușa din picior măsoară 44×44 dp la 10…54 dp × 928,5…972,3 dp, sub hârtie (care se
termină la 925,5 dp) și deasupra barei de gesturi; ușa apăsată din grila profilului a adus profilul înapoi, la
aceeași derulare. Pozele citite: `final_jpg/r31_text_reader_foot.jpg`,
`r31_foot_door_returns_to_profile.jpg`, `r31_foot_door_lands_on_profile.jpg`,
`r31_profile_wall_before_tile.jpg`.

**Ce urmează (în ordinea în care are sens).**

1. Compozitorul de text pe telefon: `EditorialPage` tipărește acum `folioLabel`, dar nu a fost redeschis pe
   ecran în runda asta (§31.5.1).
2. Un clip (Reel) deschis din grilă, ca să se vadă că antetul rutei rămâne pe `ReelPage` (§31.5.2).
3. Decizia ownerului pe discul de la picior: negru mat acum, argintiu Mercury sau cu etichetă — o linie în
   `styles.readerDisc` (§31.5.5).
4. Portarea regulii în web (`apps/nexus-web`), unde pagina de postare își tipărește singură antetul și numărul
   (§31.5.6).


## 0.19 Bara de tab-uri rămâne pe ecran, discul de platină la loc, mușchi sub cuvinte (20 octombrie 2026)

**Ce s-a cerut.** Bara de jos să fie permanentă — să nu se mai ascundă la derulare; niciun conținut să nu rămână
sub ea; butonul de creare să fie din nou discul de platină; iar pe postările fără media, în spatele cuvintelor,
un fundal discret de mușchi/frunze de junglă, care să nu concureze cu textul și nici cu ochiul.

**Bara nu se mai mișcă deloc.** `AppNav` desenează bara într-un `View` simplu, nu într-un `Animated.View` legat
de o poziție de scroll: au plecat `navHidden`, `onBrowse`, `chromeHidden`, `CHROME_SLIDE_MS` și cele două
proprietăți care le hrăneau, `bottomShift` / `shift`. Toate paginile care le mai purtau (`FeedScreen`,
`PostCard`, `ReelsReader`, `PostRail`) au trecut de la `Animated.View` la `View` — o bară care nu se ascunde
n-are nevoie de o valoare animată ca să fie unde este. Bara a rămas montată o singură dată, în shell.

**Rezerva de nav, scrisă o singură dată.** `AppNav` exportă `useNavReserve()`, care întoarce exact
`appNavHeight(insets.bottom)` — înălțimea pe care bara o ocupă pe telefonul de față, nu o constantă ghicită.
Fiecare pagină care derulează o adaugă la propriul ei spațiu de respirație, prin `contentContainerStyle`, ca
ultimul rând să poată fi dus *deasupra* barei, nu sub ea: căutare `+24`, tag `+28`, prieteni `+10`, live `+14`,
profil `+18`, inbox `+16`. Firul de conversație își ridică și composerul: `paddingBottom: 10 + navReserve`
(`MessagesScreen.tsx:602`), fiindcă acolo nu e o listă care se termină, ci un câmp lipit de marginea de jos.
Feedul paginat nu are nevoie de rezervă: fiecare pagină e ecranul întreg, iar railul ei se oprește la `RAIL_FOOT`
deasupra zonei barei.

**Discul de creare e iar platină.** `CreateDisc` din `AppNav.tsx` desenează cercul dintr-un gradient radial cu
patru opriri (`socialTokens.nav.create.polish`), peste care trece un arc specular subțire pe stânga-sus
(`specular`) — luciul pe care un disc polisat îl are și un cerc gri plat nu. Plusul e un `Path` cu `glyphStroke`
gros, nu un glif de font, ca să nu-și schimbe forma cu fontul sistemului. Câmpurile noi din temă: `polish`,
`polishCenter`, `specular`, `glowRadius`, `glyphStroke`.

**Mușchiul din spatele cuvintelor: `JungleGrove.tsx`.** Un `Svg` memoizat, un singur desen pe pagină — lumina
canopiei în colțul din dreapta-sus, un coronament îndepărtat, două raze de soare, un bolovan cu mușchi, două
frunze de palmier tăiate de margine, o ferigă, un pat de mușchi la picior, șase orhidee în colțurile de jos și o
vignetă. Trei reguli, scrise în capul fișierului, sunt tot designul:
- **discret**: cel mai puternic pigment e mușchiul de pe bolovan la 34 % din `#6fb377` și petala de orhidee la
  44 % din `#b195e6` peste `#0d1210` — un pas de culoare deasupra cardului, nu o poză; niciun `stopOpacity`
  nu trece de 0.5, iar testul o impune;
- **nu peste cuvinte**: lumina și frunzele stau la *margini*, bolovanul stă sub blocul de cuvinte, iar peste
  mijloc se lasă un „well” întunecat (`dim`: 0.36 pentru text obișnuit, 0.28 pentru un statement) înainte ca
  textul să fie așezat deasupra;
- **nu în ochi**: nimic alb, nimic saturat, nimic atât de fin încât să shimmera când pagina se mișcă —
  orhideele au cinci petale late, fără nervuri.

`PostCanvas` îl montează numai pentru un post fără media (`!hasMedia`), înaintea vălului, iar vălul scade la
`opacity={hasMedia ? 1 : 0.4}` ca să nu acopere exact ce trebuie văzut. Semnătura e seed-uită cu `post.id`, deci
aceeași postare crește mereu aceeași pădure, iar o coloană de postări de text nu e o coloană de frunze identice.
`pointerEvents="none"` și `accessible={false}`: e decor, nu conținut. Discul de redare al unui clip care nu a
pornit rămâne cum era — pe pagina de text nu există clip, deci nu se suprapune cu nimic.

**A doua cerere a aceleiași zile: bolovanul, mușchiul și orhideele.** „Un peisaj de junglă vibrant, cu un
bolovan mare acoperit de un covor gros de mușchi, orhidee mov în colțurile de jos, pădure tropicală densă în
spate și soare strecurat prin coronament — discret, plăcut, fără să deranjeze cititul.” Desenul a fost refăcut
pe cerință, cu aceleași trei reguli:
- **coronamentul** — un singur `Path` cu vârfuri de copaci peste toată lățimea, umplut cu un gradient care moare
  spre bază; e singurul strat mai *închis* decât cardul, și exact asta dă adâncime fără să adauge lumină;
- **soarele** — două raze late (9 % alb-verde sus, topite în jos), în spatele bolovanului;
- **bolovanul** — un `Path` bombat (`x 86..254`, `y 420..564`) umplut cu un gradient de la `#4b5548` la
  `#080d09`: stâncă în umbră, nu piatră gri. Peste coroană un singur `Path` de mușchi, cu marginea de jos
  atârnată în lobi inegali, plus trei smocuri care se suprapun — un strat, nu forme detașate (formele detașate
  arată ca niște ouă pe stâncă, exact ce a ieșit la prima încercare);
- **orhideele** — o tabelă `BLOOMS` (două ciorchini × trei flori: cea mare jos, una mai mică în spate, un boboc
  sus) plus `orchid()`, care desenează trei sepale, două petale late și un label; două tulpini scurte urcă din
  mușchi. Sunt singura violetă din feedul de text.
Trei constrângeri de geometrie, fiecare măsurată pe captură, nu ghicită:
1. `preserveAspectRatio="xMidYMid slice"` taie lateral un telefon mai înalt decât 360×640 — vizibil e `x 33..327`,
   deci nicio floare nu iese din intervalul ăsta (o floare tăiată e o floare plătită și nevăzută);
2. bara acoperă ultimele 63 de unități (`y > 577`), deci nicio floare nu coboară sub `y 540`; la prima versiune
   florile mari stăteau la `y 556..610` și se vedeau doar bobocii;
3. coloana `x 230..300` e a railului — o violetă sub semnul de carte ar fi o greșeală, nu un cadru; ciorchinelui
   din dreapta i s-a dat locul de lângă piciorul bolovanului, nu colțul ecranului.

Testul pădurii a crescut de la două la nouă verificări de design: dintre cele șase gradiente noi, trei sunt cerute
pe nume (`-rock`, `-carpet`, `-shaft`), tabela `BLOOMS` e citită și i se verifică pozițiile (o floare pe fiecare
latură, niciuna în coloana railului), iar „well"-ul trebuie să fie desenat *după* orhidee.

**Footerul nu mai are urmă în cod.** `src/lib/feedFoot.ts` și `scripts/test-feed-foot.cjs` au fost șterse;
`package.json` rulează în locul lor `scripts/test-nav-band.cjs` (nou, 9 verificări: bara statică, feedul fără
proprietăți de bară, rezerva fiecărei pagini, composerul inboxului, banda măsurată în feedul paginat, golul
vechiului footer, constrângerile pădurii — inclusiv bolovanul, mușchiul și orhideele —, locul ei, numai pe
postul fără media, și discul de platină).
`scripts/test-feed-rail.cjs` a fost rescris pe railul de azi (pagina imersivă condusă de media, `RAIL_FOOT`
comun, fără variantă de bară), iar `test-brand-paint.cjs`, `test-no-fullscreen-post.cjs`,
`test-fullscreen-feed.cjs` și `test-reaction-palette.cjs` au fost aduse la zi.

**Fișiere atinse:** `src/components/AppNav.tsx`, `JungleGrove.tsx` (nou), `PostCanvas.tsx`, `PostCard.tsx`,
`ReelsReader.tsx`, `PostRail.tsx`, `src/screens/FeedScreen.tsx`, `SearchScreen.tsx`, `FriendsScreen.tsx`,
`LiveScreen.tsx`, `ProfileScreen.tsx`, `MessagesScreen.tsx`, `src/app/tag/[tag].tsx`, `src/app/index.tsx`,
`src/theme/social.ts`,
`package.json`, `scripts/test-nav-band.cjs` (nou), `scripts/test-feed-rail.cjs`, `test-brand-paint.cjs`,
`test-no-fullscreen-post.cjs`, `test-fullscreen-feed.cjs`, `test-reaction-palette.cjs`.

**Verificare.**
- `node node_modules/typescript/bin/tsc --noEmit` → **exit 0**.
- `npm test` (29 de scripturi `node --test`) → **29/29 trec**, zero `✖` — rulat din nou după ce a doua cerere a
  schimbat desenul pădurii, nu doar înainte.
- `node node_modules/eslint/bin/eslint.js` pe fișierele atinse → **curat, exit 0**. Singura eroare veche din zonă,
  `react-hooks/set-state-in-effect` la `src/app/tag/[tag].tsx:65`, a fost și ea închisă: ruta își montează
  `TagScreen` cu `key={value}`, deci un tag nou e un component nou, `loading` pornește oricum `true`, iar
  `setLoading(true)` din efect doar repeta ce făcuse deja prima randare — a plecat, fără nicio schimbare de
  comportament. Tot aici: `src/app/index.tsx` păstra un `useSafeAreaInsets()` pe care mutarea rezervei în bară
  îl lăsase fără întrebuințare (avertisment `no-unused-vars`); a fost scos împreună cu importul.
- Capturi prin `scripts/capture-screen.ps1` (serial `192.168.1.184:35681`), fiecare citită înainte de a fi
  crezută, în `apps/nexus-mobile/builds/visual/`:

| Fișier | Ce dovedește |
| --- | --- |
| `r10_feed_text-20261020-221722.jpg` | feed, pagină cu poză: bara **prezentă** sub rail, discul de platină cu plus, textul se termină înainte de coloană |
| `r10_feed_next.jpg` | pagină **de text**: frunze la colțuri și ferigă jos, cuvintele pe well-ul întunecat, rail vertical, bara jos |
| `r10_search_end.jpg` | capătul rezultatelor de căutare: ultima celulă se oprește deasupra barei |
| `r10_inbox.jpg`, `r10_friends.jpg`, `r10_live.jpg`, `r10_profile_end.jpg` | fiecare pagină cu bara permanentă, conținutul nu trece sub ea |
| `r10_composer-20261020-222355.jpg` | plusul deschide camera de creare — celula de creare e atingibilă |
| `r10_new_chat-20261020-222548.jpg` | foaia „Mesaj nou" peste inbox, cu bara rămasă pe loc sub scrim |
| `r10_final_home.jpg` | după reîncărcarea de la finalul rundei (curățenia de lint): feedul, bara și discul exact ca înainte |
| `r10_grove_feed.jpg` | prima postare a feedului e un clip — acolo pădurea **nu** se desenează, pagina rămâne neagră |
| `r10_grove_next13.jpg` | prima versiune a bolovanului: se vede de ce a fost refăcută (mușchiul dispărea, florile mari stăteau sub bară, „picăturile” arătau ca niște ouă) |
| `r10_text_grove.jpg` | **semnătura vizuală a cererii a doua** (și starea finală): bolovan cu covor de mușchi și smocuri, trei orhidee în colțul din stânga, trei la piciorul din dreapta, raze de soare sus, railul liber, cuvintele perfect lizibile |

- Geometrie măsurată cu `uiautomator dump` pe pagina de text: `navigation [0,2393]-[1220,2656]`, celula de
  creare `[522,2393]-[698,2502]`, railul `[1048,1727]`→`[1048,2325]` (**68 px** liberi până la bară), capul
  `[36,150]-[927,259]`, cuvintele se opresc la `x=742` (railul începe la `1048`), „Vezi traducerea" până la
  `2335`.

**Limite cunoscute (nerezolvate aici).** (1) Butonul „Tools" al Expo (overlay de development) acoperă în
capturi primul „Urmărește" din Live și colțul dreapta-sus al unei postări — dispare într-un build fără
dev-client. (2) Composerul firului de conversație a fost verificat în cod (`paddingBottom: 10 + navReserve`) și
nu pe telefon: contul de test nu are nicio conversație, iar deschiderea uneia doar ca să privesc ar fi lăsat un
fir gol în inbox. (3) Într-o listă de căutare, celula unui clip care nu a pornit își ține discul de redare în
mijlocul ei — aproape de butonul de creare când lista e la capăt, dar este semnul celulei, nu al barei.
(4) Orhideele sunt un desen stilizat, nu botanică: cinci petale late și un label, la 44 % — destul ca să se
citească „orhidee mov", nu destul ca să pară un decupaj lipit pe ecran. (5) Bolovanul stă în banda de jos, deci
o postare de text foarte lungă își lasă ultimele rânduri peste piciorul lui; piciorul e cea mai închisă parte a
pădurii, tocmai ca textul să nu piardă contrast. (6) Dev-clientul a pierdut `adb reverse` după reconectarea
wireless și a afișat `ECONNREFUSED localhost:8081`; reloadul nu repară asta singur — `adb reverse tcp:8081
tcp:8081`, apoi `am force-stop` și relansare.


## 0.18 Feed: railul vertical pe pagina de text, capul în banda de notificări, footerul scos (20 octombrie 2026)

**Ce a cerut proprietarul, cuvânt cu cuvânt.** „pe feed, la content-ul doar cu text… header-ul trebuie ridicat
mai sus, până în banda de notificări, și zona cu reacții orizontală de jos, mutată vertical, exact la fel ca
la reels-uri… același sistem de comentarii, de paletă etc… sistemul este existent, trebuie adăugat la toate
tipurile de content… nu-mi place cum se vede ca și footer, deci trebuie scos”.

**O singură coloană, nu două.** Coloana de acțiuni a rulului era markup privat în `ReelsReader.tsx`. A devenit
`src/components/PostRail.tsx`: reaction plate (`ReactionControl variant="rail"`, deci **aceeași** paletă),
comentarii + număr, salvare, share + număr, spinner de scriere în curs și discul de sunet numai pentru clip
(`sound`, `null` pentru poză și pentru text). `PostDistributePanel` (`.clipMoreActions`: redistribuire /
distribuire) a ieșit din același fișier, ca ambele pagini să deschidă exact același meniu. `RAIL_FOOT = 26`
ține rulul și pagina de text pe aceeași linie.

**Pagina de text.** `PostCard` montează `PostRail` peste canvas (ca rulul: `bottom = RAIL_FOOT + bottomInset`,
`shift = bottomShift`) și `PostDistributePanel` la `214 + bottomInset`. `PostCanvas` are acum `page`:
- capul pornește chiar la `topInset` (banda de notificări), nu la `topInset + 22dp` — măsurat pe telefon:
  rândul autorului `[36,150][927,259]`, cu ceasul la ~110px;
- cuvintele păstrează pe dreapta `metrics.railGutter` (78), deci railul nu acoperă niciun rând;
- `bottomActions` a rămas doar pentru **celula** de listă (căutare, 9:16), care nu are rail lângă cuvinte.

**Footerul a fost scos din cod, nu doar din ecran.** `PostActionRow` nu mai are `variant` (doar rândul
compact al unei celule), `ReactionControl` nu mai are `bar`, iar `socialTokens.post.actionBar` a fost șters.
Nu mai există variantă pe care să o ceară cineva ca să readucă bara.

**O regulă veche a căzut cu footerul.** `openWithMedia()` („feedul nu se deschide pe o pagină de text, fiindcă
bara ei stă unde stă meniul”) a fost ștearsă din `lib/postPresentation.ts` și din `FeedScreen`: pagina de text
își ține presele pe rail, deasupra meniului, deci feedul respectă din nou ordinea serverului. Fiecare pagină
primește acum `onPanelChange` (paleta oprește pagerul), ca la reel.

**Fișiere atinse:** nou `src/components/PostRail.tsx`; `PostCard.tsx`, `PostCanvas.tsx`, `ReelsReader.tsx`,
`PostActionRow.tsx`, `ReactionControl.tsx`, `PostReading.tsx` (comentariu), `BrandLogo.tsx` (comentariu),
`src/lib/postPresentation.ts`, `src/screens/FeedScreen.tsx`, `src/theme/social.ts`.

**Verificare.**
- `node node_modules/typescript/bin/tsc --noEmit` → **exit 0**.
- `node node_modules/eslint/bin/eslint.js` pe fișierele atinse → curat, cu **o singură** eroare care exista
  înainte de rundă: `FeedScreen.tsx:99` `react-hooks/refs` (`useRef(new Animated.Value(0)).current` citit în
  randare). Nu e introdusă de această schimbare și n-a fost atinsă.
- Capturi prin `scripts/capture-android-screen.ps1` (serial `192.168.1.184:35681`), toate citite înainte de a
  fi crezute, în `JUNGLE_BOOK_VERIFICATION/final_jpg/`:

| Fișier | Ce dovedește |
| --- | --- |
| `r9_feed_c.jpg` | pagina de text: capul sub ceas, rail vertical în dreapta (like 1, comentariu, salvare, share), **niciun footer** |
| `r9_next.jpg` | rulul neschimbat după refactor (rail + disc de sunet + ceasul clipului) |
| `r9_share_panel.jpg` | „Distribuie postarea” se deschide de pe railul paginii de text, ca la reel |
| `r9_comments.jpg` | foaia de comentarii (`CommentsSheet`, „Comentarii · 0”, composer) se deschide de pe rail |

- Geometrie măsurată cu `uiautomator dump`: railul `[1048,1727]` → `[1048,2325]`, bara de tab-uri începe la
  `2393` (26 dp liberi sub ultima celulă), autorul `[36,150][927,259]`.

**Limite cunoscute (nerezolvate aici).** (1) Butonul „Tools” al Expo acoperă prima linie a unui statement în
capturi — e overlay de development, nu produs; dispare într-un build fără dev-client. (2) Panoul de distribuire
poate acoperi temporar pastila „Vezi traducerea” cât e deschis (la fel se întâmplă pe reel). (3) Eroarea de
lint din `FeedScreen.tsx:99` rămâne de curățat separat.


## 0.17 Capturi de ecran de încredere: o singură unealtă, carantina falsă anulată (20 octombrie 2026)

**Cauza rădăcină, dovedită.** Telefonul expune două display-uri (1220x2656 intern + 904x572
subscreen), deci `screencap` fără `-d` scrie pe stdout linia `[Warning] Multiple displays were
found, but no display id specified. Using display 0.` **înaintea** octeților PNG. Orice captură făcută
cu `adb ... > fisier.png` (redirect PowerShell) avea deci text în față: fișierul nu începea cu
`89 50 4E 47`, iar validatorul îl număra „corupt”. Nu a fost un bug de conversie JPG.

**O singură unealtă de captură.** `scripts/capture-android-screen.ps1` (nou) citește lista de
display-uri, alege display-ul aplicației, rulează `screencap -d <id> -p` pe device și scoate fișierul
cu `adb pull` (byte-exact, fără redirect), apoi validează structura PNG (semnătură, chunk-uri până la
IEND, lungime exactă, dimensiuni), decodează complet, refuză cadrul gol/negru (exit 10) și publică JPG
în `JUNGLE_BOOK_VERIFICATION/final_jpg/` fără suprascriere. Coduri de ieșire: 0 ok, 2 adb
inutilizabil, 3 niciun dispozitiv autorizat, 4 captură eșuată, 5 PNG invalid, 6 JPG invalid,
7 altă captură rulează, 8 eroare neașteptată, 9 focus greșit (`-StrictFocus`), 10 cadru gol.
`tools/images/safe-screencap.ps1` și `apps/nexus-mobile/scripts/capture-screen.ps1` au rămas doar
wrappere subțiri peste el (acceptă parametrii vechi `-Device`, `-Display`, `-Package`, `-Endpoint`).

**Carantina falsă, anulată în trei pași.** Bilanțul măsurat al rundelor de restaurare: **1029** fișiere
`.bad` la început — **429** restaurate, **2** reparate (prefix de text tăiat), **598** rămase (detaliat
mai jos). Majoritatea celor restaurate aveau date de imagine valide după prefixul de avertizare.
- `ImageTools.ps1` — `Test-ImageFile` reîncearcă o dată și compară dimensiunea între citiri: dacă s-a
  schimbat, fișierul e **ocupat** (se scrie acum), nu corupt, și nu se carantinează niciodată
  (`Locked`/`Attempts`). WebP fără codec pe Windows (`Image.FromFile` dă „Out of memory”) iese acum
  `Unsupported`, nu `corrupt`: două `.webp` din `public/` fuseseră redenumite `.bad` degeaba în prima
  rundă, exact din cauza asta.
- `ImageTools.ps1` — `Find-ImageSignatureOffset` + `Repair-ImagePrefix`: caută semnătura PNG/JPEG/WebP
  în primii 8 KB, taie prefixul și păstrează rezultatul **numai** dacă restul se decodează complet
  (`-DryRun`, `-KeepPrefix`, `-MaxPrefixBytes`). Modulul scrie într-un singur caz controlat, iar
  antetul fișierului o spune.
- `validate-images.ps1` — rescris: sare peste `node_modules`, `.git`, `.expo`, `.gradle`, `.cache`,
  `.next`, `dist`, `chrome-profile*`; `-RestoreBad` re-decodează înainte de a da numele înapoi, repară
  prefixul de text și întoarce `x.png.20261020-203033.bad` la `x.png`; size-ul raportat e net de
  prefixul eliminat; căile din afara repo-ului nu mai crapă în `Get-RelativePath`.

**Ce s-a restaurat** (`validate-images.ps1 -RestoreBad`, exit 0 pe fiecare domeniu):

| Domeniu | Restaurate | Reparate (prefix) | Rămân `.bad` |
| --- | --- | --- | --- |
| `apps/nexus-mobile/builds` | 32 | 2 (`nf5.png`, `screen-now.png`, 1220x2656) | 2 |
| `docs` | 318 | 0 | 2 |
| `planning` (rădăcină + `design/` + `evidence/`) | 19 | 0 | 0 |
| `planning/evidence/screenshots` | 10 | 0 | 0 |
| `apps/nexus-web/data/media` | 30 | 0 | 13 |
| `apps/nexus-mobile/android/app/src/main/res/drawable-*` | 5 (`splashscreen_logo.png`) | 0 | 0 |
| `apps/nexus-web/public`, `apps/nexus-demo/public` | 9 | 0 | 0 |
| `apps/nexus-web/test/fixtures/messenger`, `test-labs/messenger/media` | 4 | 0 | 0 |
| `tools/scrcpy` | 2 | 0 | 0 |
| **Total** | **429** | **2** | **55** în afara profilelor de Chrome (detaliat mai jos) |

**Starea măsurată la finalul rundei** (`Get-ChildItem -Recurse -Filter *.bad`, 20 oct 21:05): **598**
fișiere `.bad`, împărțite exact așa — **424** `planning/evidence/screenshots/**/chrome-profile*`,
**106** `.ephemeral/camera-fill-profile/Default`, **25** `apps/nexus-mobile/.expo`, **13**
`apps/nexus-web/data`, **13** `.ephemeral/web-ref-oct7/profile`, **7** `apps/nexus-demo/dist`, **5**
`apps/nexus-mobile/android`, **2** `apps/nexus-mobile/builds`, **1** `_shot1.png.bad` (rădăcină), **1**
`docs/screens/01-launch.png.bad`, **1** `docs/parity-report/profile-header`. Primele patru grupuri
(568 din 598) sunt cache-uri de browser/build, excluse intenționat din scanare — nu sunt dovezi. Cele
**13** din `apps/nexus-web/data` sunt stub-uri de 11–520 octeți scrise de ingestia web (inclusiv
`b94d27b9…jpg`, care conține textul „hello world”), deci cu adevărat stricate, iar cele **2** din
`builds` și **2** din `docs` au fost transcodate UTF-16 de redirectul `>` (`f2a-now.png.bad`,
`nf4.png.bad` e 0 octeți).

**Validarea pe tot repo-ul, citită din log** (`validate-images.ps1 -Path . -FailOnCorrupt`, 734
imagini): `valide: 729 · corupte: 1 · ocupate: 0 · necodificabile: 4 · antet nepotrivit: 67 ·
carantinate: 1`, **exit 1**. Exit 1 e corect, nu o regresie: singurul „corupt” e `_shot1.png` din
rădăcină, adică un transcript PowerShell UTF-16 (`FF FE 5B 00 57 00 61 00 72 00 6E 00`) salvat cu
extensia `.png` — acum e `_shot1.png.bad`. Cele **4** `NECODIFICABIL` sunt exact cele patru `.webp`
de demo (`nexus-web` și `nexus-demo`, `demo-creator-v2`, `demo-market-v2`) și **nu** au fost
carantinate — fixul WebP se vede în log, nu doar în teorie. Cele **67** „antet nepotrivit” sunt
JPEG-uri cu extensie `.png` (`planning/evidence/**.png`, `res/mipmap-*/ic_launcher*.webp` scrise de
altă unealtă) — conținutul se decodează, deci nu se carantinează, dar numele mint; de curățat separat.
- Cel mai important efect secundar: `splashscreen_logo.png` din `res/drawable-*` era carantinat, deci
  APK-ul se construia fără logo-ul de splash. Acum e la loc în toate cele cinci densități.

**Test pe folder de control** (`%TEMP%\nexus-restore-test`): 5 cazuri, toate corecte — nume cu marcaj
-> `a.png`; prefix de 87 octeți -> reparat în `b.png`; PNG trunchiat -> rămâne `.bad`; nume ocupat ->
CONFLICT, nimic suprascris; imagine curată -> neatinsă.

**Reguli scrise.** `.clinerules` și `AGENTS.md`: se citesc doar `JUNGLE_BOOK_VERIFICATION/final_jpg/`
și `docs/vision/` după validare, o imagine pe mesaj, `.bad` ≠ corupt, iar fluxul obligatoriu rămâne
CODE → BUILD → DEVICE TEST → JPG CAPTURE → VALIDATE → VISUAL INSPECT → REPORT. Un JPG valid dovedește
doar că s-a capturat un ecran; dovada e JPG-ul **citit** și descris.

**Rămâne deschis.**
- Telefonul adoarme în ~10 s și nu se trezește sigur din adb (senzor de proximitate suspectat);
  `-Wake -SettleSeconds <n>` ajută, dar nu garantează. De încercat `svc power stayon true` și
  `settings put system screen_off_timeout`.
- Endpoint-ul wireless e `192.168.1.184:35681`; scriptul are `192.168.1.184:39169` doar ca valoare de
  rezervă, pentru că portul se schimbă la fiecare reconectare. Când e un singur dispozitiv conectat,
  unealta îl alege singură — `-Serial <ip:port>` rămâne calea sigură.
- Ingestia web scrie stub-uri JPEG/PNG stricate în `apps/nexus-web/data/media` (libjpeg: „JPEG
  datastream contains no image”) — bug separat, nu ține de capturi.
- Rezolvat în această rundă: capturile Feed / Profil / Live / compozitor / Detalii postare sunt făcute cu unealta nouă, citite și descrise, iar `build-contact-sheet.ps1` a fost regenerat — vezi 0.17.1.
- Cele **4** `.webp` `NECODIFICABIL` (2 în `apps/nexus-web/public`, 2 în `apps/nexus-demo/public`) nu
  se mai carantinează, dar nu pot fi nici inspectate pe Windows (`Image.FromFile` dă „Out of memory”);
  `to-vision.ps1` raportează `Note` când `Why` e gol. Pentru inspecție trebuie un codec WebP sau o
  conversie offline.
- **67** fișiere au antet nepotrivit (bytes JPEG în nume `.png`, bytes PNG în nume `.webp`): se
  decodează, dar numele mint — de redenumit/convertit separat, nu de carantinat.
- `-FailOnCorrupt` pe tot repo-ul iese **1** din cauza unui singur fișier (`_shot1.png.bad`, transcript
  UTF-16 din rădăcină). Semnalul e corect; dacă vrei verde în CI, mută transcriptul sau exclude
  rădăcina.
- `svc power stayon true` **nu** a fost rulat în această rundă; ecranul a stat treaz doar pentru că
  tap-urile de navigare au fost dese.


## 0.17.1 A doua rundă de capturi: Feed, Profil, Live, compozitor, Detalii postare (20 octombrie 2026)

**Un bug real de focus, găsit de capturi și reparat.** `scripts/capture-android-screen.ps1` raporta
fereastra focalizată ca `'m'`. Cauza nu era `dumpsys`, ci felul în care PowerShell enumeră rezultatul
unui bloc `if`: forma `$matched = if (...) { @('app.nexus.mobile.dev/.MainActivity') } else { @() }`
nu păstrează array-ul, ci îl dezumflă la un singur **string**, iar `$matched[0]` întoarce primul
**caracter** — `'m'`. Fixul din cod (blocul de focus): `$focusLines` și `$nonNull` se construiesc cu
`@(...)`, `$matched` e inițializat `@()` și primește tot `@(...)`, deci `.Count` și `[0]` sunt mereu
corecte; un comentariu de acolo explică de ce nu se mai scrie `if` în dreapta egalului.

**Șase capturi, fiecare citită înainte de a fi crezută** (`exit=0`, cale `via exec-out`, toate în
`JUNGLE_BOOK_VERIFICATION/final_jpg/`):

| Fișier | Ecran | Ce se vede în JPG |
| --- | --- | --- |
| `v_01_feed.jpg` | Feed | card întreg: poză, autor `wallet4e8gv6 (social) @wallet4e8gv6 · 16 min · Bucharest`, text lung cu `Mai puțin` și `Vezi traducerea`, rail de reacții (inimă plină, 1), bară de jos plutitoare |
| `v_02_profile.jpg` | Profil | `☰`, nume `wallet4e8gv6 (social)`, `@wallet4e8gv6` cu lacăt, `1 Urmărești / 0 Urmăritori / 1 Postări`, `Editează profilul` + `...`, banda de metadate, rând de taburi-iconițe, grilă de postări |
| `v_03_live.jpg` | Live | taburi `Social` / `Prietni`, banner `Transmisiunea publică nu este configurată pe server (GATED_NO_SFU)`, `ACUM LIVE — Nicio transmisiune activă.`, listă CREATORI cu `Urmărește` / `Urmărești` |
| `v_04_composer.jpg` | Previzualizare după declanșare | foto 9:16, coloană `Aa Text` / `Stickere` / `Emoji` / `Muzică`, bara `Ascultă What Is Love — Melanie Ungar`, două hint-uri, `Next` sus **și** jos |
| `v_05_text_post.jpg` | Detalii postare, tastatură sus | `Titlu`, `Descriere` cu text scris, `80/2000 caractere`, tastatura acoperă restul formularului |
| `v_05b_text_post.jpg` | Detalii postare, formular complet | `Titlu`, `Descriere`, `hashtag sau handle` + `# Adaugă` / `@ Adaugă`, text de ajutor pentru mențiuni, `Locație` + chips `Exactă` / `Zonă` / `Oraș`, `Link`, apoi `Publică` / `Salvează în cont` / `Doar pe telefon` |

**Defecte de produs văzute în capturi** (nu defecte de captură):
- **Câmpul `Link` nu se randează** (`v_05b`): între eticheta `Link` și butonul `Publică` nu există
  niciun câmp, iar în `uiautomator` elementul are bounds inversate — `[42,2196][1178,2168]`, iar textul
  lui de ajutor `[42,2341][1178,2168]` (y de sus > y de jos, adică înălțime negativă). Secțiunea e
  împinsă sub marginea de jos și strivită; de verificat stilul secțiunii `Link` din ecranul de detalii.
- **Butonul de dezvoltare Expo** (`App Icon`, rotița din stânga, `[62,1124][176,1238]`) apare peste
  conținut în toate cele șase capturi: acoperă rândul „Această captură nu are încă o copie în cont.”,
  începutul descrierii și avatarul din lista de creatori. Nu e UI de produs; pentru dovezi curate,
  build-ul de test trebuie pornit fără dev menu.
- **Două `Next`** în compozitor (pill sus-dreapta `[1001,182][1173,284]` și bară jos
  `[52,2365][1168,2497]`) și amestec de limbi în același ecran (`Next` lângă `Previzualizare`, `Text`,
  `Stickere`, `Muzică`).
- **Nu există compunere text-only**: și `Postare nouă` din meniul `☰` (`[60,1696][1160,1832]`), și
  `Creează` din bara de jos deschid camera; textul se scrie doar ca pas de caption după o fotografie.
  Dacă produsul promite „Text Post”, fluxul lipsește.
- **Profil, banda de metadate**: începe cu `tombrie 2026` — text tăiat la început, lipsește „oc” — și
  repetă informația („Membru din octombrie 2026”); rândul de taburi de sub ea arată doar glife
  (`☰ ▶ ▢ ❝ ✨ ▾`), fără etichete vizibile.
- **Profil, grilă**: un singur tile pe coloana din stânga, coloana a doua complet neagră; legenda
  tile-ului acoperă poza fără scrim (contrast slab), iar al doilea tile e tăiat de bara de navigare —
  conținutul nu are padding pentru bara plutitoare.
- **Inițiale de avatar**: cercul arată `w(`, nu `W` — extragerea inițialelor include paranteza.
- **Live**: tabul scrie `Prietni` (lipsește `e`), `Nexus Test 01` arată `1 următori` (plural greșit),
  iar tabul activ nu are nicio stare vizuală.
- **Feed**: nimic rupt în layout; textul mare alb din poză (`sks 100 100 20:56 20.10`) e ars în
  fotografia postării, nu e UI.
- Fotografia din compozitor e mișcată (blur de expunere/autofocus) — de verificat pe build-ul dev; nu
  ține de unealta de captură. `adb shell input text` a produs text cu `%` în loc de spații: e encoding
  de unealtă, nu bug de aplicație.

**Coordonate confirmate prin `uiautomator dump`** (1220x2656, pentru rundele următoare): bara de jos
`Acasă [21,2393][185,2523]`, `Mesaje [188,2393][352,2523]`, `Creează [522,2393][698,2502]`, `Live
[868,2393][1032,2523]`, `Profil [1035,2393][1199,2523]`; `☰` din profil la `(89,232)`; în meniu
`Postare nouă (610,1764)`, `Setări (610,1612)`, `Portofel (610,1462)`, `Închide meniul (1111,1181)`;
în compozitor `Tools (109,1162)`, declanșator `(610,2374)`, `Next` de jos `(610,2431)`, `×` din editor
`(1080,238)`, confirmarea `ȘTERGE CAPTURA (931,1333)`.

**Contact sheet regenerat.** `apps/nexus-mobile/scripts/build-contact-sheet.ps1` a rescris
`JUNGLE_BOOK_VERIFICATION/contact_sheet.jpg`: 61 de celule, 1809 KB, sortate alfabetic — cele șase
capturi noi apar la final, ca `v_0*`.


## 0.16 Project ID nou, deploy aditiv pe main, ciclul A (18 octombrie 2026)

**Ce s-a schimbat.** `16dfabc0ad133a40f7a3acc23e15fc98` (Reown, al altcuiva, domeniile lui implicite) a fost înlocuit cu proiectul proprietarului `37628068772ce00f33f91f4d51273722` (redenumit Jungle Book, cu `https://nexus-deepsek-production.up.railway.app` în allowlist).
- `apps/nexus-web/lib/env.js`: valoarea implicită a `WALLETCONNECT_PROJECT_ID` este acum ID-ul proprietarului; comentariul spune de unde vine și că valoarea veche a fost a altcuiva.
- `apps/nexus-probe`/`builds/wc-relay-probe.cjs`, `test/core.test.js`, `.env.example`, `HANDOFF.md`: aceeași valoare.
- `NEXUS_ALLOW_ATTESTED_ORIGINS` și `NEXUS_ORIGIN` rămân neschimbate: attested plus originea implicită doar în modul preview, doar pentru `NEXUS_ORIGIN` (verificat în `resolveAllowedOrigins`).
- `git log -S 37628068` = un singur commit (acesta); `git log -S 16dfabc0` arată commit-ul care a introdus ID-ul străin (vezi mai jos).

**Sonda de releu** (`node builds/wc-relay-probe.cjs`, origine Railway, noul ID): **ALLOWED din prima încercare** — proiectul proprietarului nu e blocat de releu, deci nu a fost nevoie de reîncercările la 60 s.

**Rebuild bundle.** `node scripts/build-wc.mjs` a regenerat `public/wc-bundle.js` (12 KB diff, doar `"Nexus"` -> `"Jungle Book"` în textele foii; ID-ul nu e înglobat, se ia din `/auth/mvx/init`).

**Teste.** web 812/812 (32 fișiere), mobile 821/821 (45 fișiere) pe arborele de lucru.

**Deploy.** Worktree curat `nexus_deepsek-deploy-jb` din `origin/main` + exact fișierele atinse, fără `node_modules`/build-uri. Push aditiv pe `main` (commit `12f7ddf`? vezi `git log`), verificat imediat:
- `/health` 200;
- `/xportal-bridge.html` 200;
- `/wc-bundle.js` 200, zero apariții `Nexus` în textele foii;
- `/auth/mvx/init` 200 cu `wcProjectId=37628068772ce00f33f91f4d51273722`;
- `/api/profiles/test` 401 `not signed in` **cu cookie-urile locale din 17 oct** — nu e o regresie de rută: `POST /auth/email/login` cu aceleași conturi răspunde 403 `verifică adresa de email înainte de autentificare`, deci baza și conturile au supraviețuit deploy-ului, iar cookie-urile vechi nu mai trec de `requireAuth` (sesiune semnată înainte de redeploy). Pentru 200 e nevoie de o autentificare proaspătă, iar login-ul pe email e blocat de verificarea adresei.

**Ciclul A (telefon, 18 oct 17:34).** Un singur adb (`platform-tools`, `-s 192.168.1.184:36819`), focus pe `app.nexus.mobile.dev`, tap pe butonul propriu `Conectează xPortal` din ecranul de autentificare (bounds `[144,1345][1074,1484]`).
- 17:34:56 `bridge-start`, `storage-cleared keys=0`, `provider-ready ms=706`;
- 17:35:02.343 `pairing topic=e8015…5867 reused=false ms=6088` — **prima creare de pairing din toate rundele**; allowlist-ul era singurul blocaj;
- 17:35:02.379 `xportal-opened via=wc:e8015…`, xPortal (`com.elrond.maiar.wallet/com.maiar2.MainActivity.MVX`) în față; logcat MIUI arată intentul `VIEW dat=wc:e8015…` în task-ul xPortal;
- 17:35:10.685 `app-active stage=pairing`, 17:35:10.902 `relay connected=true restarted=true`, `relay-resume connected=true restarted=true wasConnected=false`;
- 17:35:11.083 `approved ms=14824` — xPortal a aprobat sesiunea;
- 17:35:31.886 al doilea `xportal-opened` (re-deschidere pentru semnătură);
- 17:37:56 fereastra de 180 s a paginii a expirat: foaia arată `Aprobat. Semnează loginul NativeAuth în xPortal…` plus `xPortal nu a răspuns la timp. Deschide xPortal și încearcă din nou.` și `xPortal nu a răspuns în 3 minute`. **Nicio semnătură, niciun token.**
- xPortal rămâne pe un splash (arborele de accesibilitate are doar un `ImageView` full-screen, 1907 bytes, fără text), iar logcat-ul MIUI scrie `exp_nofocuswindowtimeout com.elrond.maiar.wallet`; `uiautomator dump` întoarce alternativ `null root node` pentru fereastra xPortal. Deci nu pot citi ecranul xPortal și, conform regulilor, nu ating nimic în el.
- Concluzie ciclu A: pairing + aprobare funcționează cu ID-ul proprietarului; lipsește pasul de semnătură NativeAuth, iar ecranul xPortal nu poate fi verificat din adb pe acest telefon.


# HANDOFF — Jungle Book nativ (fost Nexus) (branch `codex/camera-draft-stability`)

Ultima actualizare: **18 octombrie 2026** (proiectul WalletConnect al proprietarului, `3762…3722`, are acum
originea Railway în Allowlist — sonda răspunde **ALLOWED**, deci blocajul din §0.14 a căzut; §0.15 are dovada,
înlocuirea ID-ului și de unde venea cel vechi. Foaia are o singură mașină de stări, §0.13).
Scopul fișierului: o sesiune nouă continuă de aici fără să recitească tot istoricul și fără să repete greșeala care a blocat task-urile anterioare.

## 0.15 Proiectul WalletConnect al proprietarului înlocuiește ID-ul străin (18 octombrie 2026)

**Rezultatul, într-o propoziție:** blocajul „Origin not allowed” din §0.14 nu era în cod, ci în faptul că
serverul publica un Project ID străin; proprietarul are propriul proiect Reown, redenumit **Jungle Book**, cu
`https://nexus-deepsek-production.up.railway.app` în lista de domenii permise, iar sonda de releu răspunde acum
**ALLOWED** pentru acea origine.

| Ce | Valoare |
|---|---|
| Project ID nou (public, nu e secret) | `37628068772ce00f33f91f4d51273722` |
| Nume în WalletConnect Cloud | **Jungle Book** |
| Origine adăugată de proprietar | `https://nexus-deepsek-production.up.railway.app` |
| Project ID vechi (scos din cod) | `16dfabc0ad133a40f7a3acc23e15fc98` — **nu aparține acestui proprietar** |

### De unde venea ID-ul vechi

`git log -S "16dfabc0ad133a40f7a3acc23e15fc98" --all` întoarce **un singur commit**: `4f44697` (18 oct 2026,
15:48, „Nexus xPortal: pagina punte si bundle cu redirect.native; proiect WalletConnect implicit in preview”).
Acolo a fost introdus `PUBLIC_WALLETCONNECT_PROJECT_ID` în `apps/nexus-web/lib/env.js`, ca valoare implicită
pentru modul `preview`, ca telefonul să poată testa fără să lipească variabile de mediu. Nu a fost verificat
niciodată în dashboard: sonda din §0.14 a arătat că proiectul nu are nicio origine publică, iar refuzul
`3000` venea pentru orice origine în afară de `localhost`. A fost, practic, un ID de împrumut ținut în cod.

`git log -S "37628068772ce00f33f91f4d51273722" --all` **nu întoarce nimic**: ID-ul proprietarului nu apare în
niciun commit anterior acestei runde, deci nu a fost publicat accidental și nu are istoric de curățat.

### Dovada că noul ID chiar e allowlisted (înainte de orice modificare de cod)

`builds\wc-relay-probe.cjs` (acum citește ID-ul din `NEXUS_WC_PROJECT_ID`, cu noul ID ca implicit) semnează un
JWT de relay și încearcă handshake-ul:

| Proiect | Origine trimisă | Rezultat |
|---|---|---|
| `3762…3722` | `https://nexus-deepsek-production.up.railway.app` | **ALLOWED** (niciun mesaj de eroare în 2,5 s) |
| `3762…3722` | `https://example.com` | **DENIED 3000 Unauthorized: origin not allowed** |
| `16df…fc98` (runda trecută) | `https://nexus-deepsek-production.up.railway.app` | DENIED 3000 |

Al doilea rând e important: refuzul pe o origine străină arată că proiectul **nu** e deschis tuturor, ci că
lista conține exact domeniul nostru.

### Ce s-a schimbat în cod

| Fișier | Schimbare |
|---|---|
| `apps/nexus-web/lib/env.js` | `PUBLIC_WALLETCONNECT_PROJECT_ID` = noul ID; regulile au rămas aceleași: implicitul se aplică **doar** în `NEXUS_DEPLOYMENT_MODE=preview` și **doar** când originea cerută este exact `NEXUS_ORIGIN`, iar `NEXUS_WC_PROJECT_ID` setat explicit câștigă întotdeauna |
| `apps/nexus-web/test/core.test.js` | aserțiune explicită: constanta publică este ID-ul proiectului „Jungle Book” (32 hex), ca o revenire la un ID străin să pice testul |
| `apps/nexus-mobile/builds/wc-relay-probe.cjs` | ID-ul nu mai e lipit în script: `NEXUS_WC_PROJECT_ID` → altfel noul implicit |
| `HANDOFF.md` | secțiunea de față + referințele operaționale din §0.12/§0.14 |

Bundle-ul nu înglobează ID-ul: `wc-client.js` îl primește la rulare din `/auth/mvx/init` (`wcProjectId`), deci
nu a fost nevoie de rebuild din cauza ID-ului — doar de rebuild-ul pentru textele Jungle Book (deploy în §0.16).

## 0.14 Telefonul, primul ciclu xPortal și singurul lucru care lipsește: originea allowlisted (18 octombrie 2026)

**Rezultatul rundei, într-o propoziție:** aplicația pornește de pe Railway, foaia xPortal se deschide și
își face treaba până la relay, iar relay-ul refuză **originea Railway**; WalletConnect Cloud acceptă din
oficiu doar `localhost`/`127.0.0.1`, deci singurul pas rămas este adăugarea originii în dashboard. Nu este
un defect de cod: este o listă de origini permise care nu conține domeniul aplicației.

### Ce a funcționat pe telefon (doar un singur `adb`, wireless)

| Pas | Comandă care a mers | Rezultat |
|---|---|---|
| Un singur adb | `Get-Process adb \| Stop-Process -Force`, apoi `& $adb start-server` | după restart lista era goală; `& $adb connect 192.168.1.184:36819` a readus telefonul ca `device` |
| Portul neschimbat | `& $adb mdns services` | `adb-b42122b-huYC9y _adb-tls-connect._tcp 192.168.1.184:36819` — același port ca în prompt |
| Ecran | `dumpsys power \| Select-String mWakefulness` | `Awake` |
| Prim-plan | `dumpsys activity activities \| Select-String topResumedActivity` | `app.nexus.mobile.dev/.MainActivity` pe display 0; `mCurrentFocus` arăta `null`/`SubScreenLauncher` pentru că telefonul are un al doilea display (sub-ecran), nu pentru că aplicația nu era în față |
| Metro fără origine locală | `builds\metro-railway.cmd` → `node node_modules\expo\bin\cli start --dev-client --port 8081 --clear` cu `set "EXPO_PUBLIC_NEXUS_API_URL="` | „Waiting on http://localhost:8081”, `Android Bundled 24212ms` |
| Tunel doar pentru Metro | `& $adb -s 192.168.1.184:36819 reverse tcp:8081 tcp:8081` | `host-26 tcp:8081 tcp:8081`; `reverse --remove tcp:5000` a răspuns „listener not found”, deci API-ul nu trecea prin tunel |
| Reîncărcare | `am start -a android.intent.action.VIEW -d "nexusdev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` | loginul „JUNGLE BOOK” încărcat, fără APK nou |

**Capcană de proces (de reținut):** dacă Metro e pornit în aceeași comandă care așteaptă mai mult de 30 s,
harness-ul omoară arborele de procese și Metro moare după „Waiting on 8081” (primul `page-error` din foaie a
fost exact asta: `unexpected end of stream on http://localhost:8081`). Soluția care ține: un fișier
`builds\metro-railway.cmd` pornit cu `Start-Process -WindowStyle Hidden`, apoi poll separat.

### Cronologia celor două cicluri

| # | Când (ceasul telefonului) | Ce am făcut | Ce a răspuns aplicația | Durata |
|---|---|---|---|---|
| 1 | ~17:00 | tap pe „Conectează xPortal” (609,1414, citit din `uiautomator dump`) | foaia: „conectez Nexus la WalletConnect Relay…”, apoi „Serverul nu poate deschide conexiunea WalletConnect acum…” | eșec la **46 551 ms** |
| 2 | ~17:26 | după reparația de mai jos, același tap | foaia afișează **propoziția întreagă, cu origine**: „WalletConnect nu a creat sesiunea. … dacă originea **https://nexus-deepsek-production.up.railway.app** este permisă în Allowlist. … crearea pairing-ului WalletConnect a expirat” | eșec la ~60 s |

Jurnalul paginii (Metro, `[xportal]`): `sheet-open`, `bridge-start redirectNative=true`, `storage-cleared`,
`provider-ready ms=721`, `app-active stage=preparing waitedSeconds=0`, `page-error`, apoi
`login-failed error=WalletConnect nu a creat sesiunea…`. `relay-refused` **nu** a apărut în ciclul 1: refuzul
nu a fost prins din console, deci clientul a căzut pe propoziția lui de rezervă — care, din fericire, poartă
și ea originea.

### Dovada că originea e problema (fără să ghicesc)

`builds\wc-relay-probe.cjs` semnează un JWT de relay și încearcă handshake-ul cu diverse antete:

| Origine trimisă | Rezultat |
|---|---|
| `https://nexus-deepsek-production.up.railway.app` (fără UA, UA de WebView, UA de browser, ± `packageName`) | **DENIED 3000 Unauthorized: origin not allowed** |
| `https://example.com` | DENIED 3000, aceeași propoziție |
| **fără antet `Origin`** | ALLOWED |
| `http://localhost:5000`, `http://localhost:8081`, `http://127.0.0.1:5000`, `https://localhost` | ALLOWED |

Deci: proiectul folosit atunci, `16df…fc98` (înlocuit cu proiectul proprietarului în §0.15), nu avea nicio
origine publică în listă, iar WebView-ul trimite mereu `Origin` — pagina punte este servită de `API_ORIGIN`,
adică de Railway.

### Reparația făcută în această rundă

Foaia ascundea exact informația de care avea nevoie proprietarul: `xPortalFailureSentence` păstra
propoziția paginii doar dacă ea conținea „allowed origins”/„refuză originea”, iar clientul web scrie și
„…este permisă în **Allowlist**”. Textul cu origine era deci înlocuit cu rezumatul „Verifică Project ID-ul…”.
Acum și formularea cu „Allowlist” rămâne neatinsă, cu condiția să poarte o origine `http(s)://` (fără origine,
rezumatul e răspunsul cinstit). Test: `test-xportal-login.cjs` are două cazuri noi — cel din dashboard
(`Allowed origins`) și cel de rezervă al clientului (`Allowlist` + origine).

### Ce lipsește, exact

1. ~~**Una singură, obligatorie:** adaugă în WalletConnect Cloud → proiectul `16df…fc98` → Settings → Allowed
   origins: `https://nexus-deepsek-production.up.railway.app`~~ — **rezolvat în §0.15**: proprietarul are
   proiectul **Jungle Book** (`3762…3722`), cu originea Railway în listă; sonda de releu răspunde ALLOWED.
   Ce rămâne de făcut e pe cod (ID-ul implicit, bundle-ul publicat) și pe telefon (ciclurile).
2. **Dacă vrei să testăm înainte de dashboard**, singura cale care funcționează azi este originea locală, pe
   care relay-ul o acceptă din oficiu: Metro cu `EXPO_PUBLIC_NEXUS_API_URL=http://localhost:5000`,
   `& $adb reverse tcp:5000 tcp:5000`, iar serverul local pornit cu `NEXUS_ORIGIN=http://localhost:5000`
   (altfel `/auth/mvx/init` nu attestă originea). Asta mută însă și API-ul pe laptop, deci iese din regula
   „rămâi pe Railway” — o folosim doar dacă o ceri explicit.
3. **După ce originea e în listă**, ciclurile 1–3 (inclusiv B: revenire manuală din recents, C: `force-stop` în
   timpul așteptării) pot rula fără nicio schimbare de cod. Nu e nevoie de APK nou: tot ce s-a schimbat în
   această rundă e în bundle-ul Metro (`xportalLogin.ts`).
4. **Bundle-ul de pe Railway încă se semnează „Nexus”** în două propoziții care apar în foaie („conectez Nexus
   la WalletConnect Relay…”, „Project ID-ul Nexus…”), pentru că producția are versiunea de pe `main`, iar
   rebrandul e doar pe branch. Dovadă: `GET /wc-bundle.js` are 1 345 912 B și conține „conectez Nexus” (nu
   „Jungle Book”); bundle-ul local, construit din sursa rebranduită, are textele noi. Se publică pe `main`
   aditiv, din worktree curat, imediat după ce originea e adăugată (sau înainte, dacă ceri) — altfel propunerea
   de sesiune din xPortal va arăta în continuare „Nexus”, iar regula „doar dacă scrie Jungle Book” nu poate fi
   îndeplinită la tap.

### Corectură la §0.12

Ecranul de conectare **nu** afișează „API: Railway”. Eticheta `apiOriginLabel()` este randată doar în
`index.tsx:385` (Settings) și `:405` (footer-ul profilului propriu); pe login nu există niciun subsol cu ea
(`builds\ui4.xml` nu conține „API:”). Originea aleasă se citește deocamdată din foaie (propoziția de refuz a
relay-ului o numește) sau din Settings după login. Nu am schimbat ecranul: dacă vrei eticheta și pe login,
e o linie în `NexusLogin`, dar nu blochează nimic.

## 0.13 Foaia xPortal: o singură mașină de stări (18 octombrie 2026)

**Simptomul raportat:** după o încercare de conectare care se terminase (refuz, expirare, origine refuzată),
foaia putea rămâne pe „se așteaptă aprobarea în xPortal”, iar un eveniment târziu venit din pagina punte
(`preparing`, `pairing`) readucea foaia la un pas anterior. Două locuri scriau aceeași stare (`phase` +
`seconds`), deci ultimul care scria câștiga.

**Ce s-a schimbat:**

| Fișier | Ce face acum |
|---|---|
| `apps/nexus-mobile/src/lib/xportalState.ts` (nou) | `xPortalReduce(state, event)` — singurul loc în care se schimbă starea. Stări: `idle`, `preparing`, `pairing`, `signature`, `token`, `failed`, `expired`; plus `seconds`, `reopened`, `returns`. Gărzi: `token` și `failed` sunt finale; `error` nu poate anula un `token`; un `preparing` târziu nu întoarce foaia; `active` după `expired` deschide o fereastră nouă de pairing; `tick` scade secundele doar în `preparing`/`pairing`/`signature` și trece în `expired` la 0. Ajutoare: `xPortalIsWaiting` (doar `pairing`/`signature`), `xPortalIsFinished` (`token`/`failed`), `xPortalWaitLabel`, `XPORTAL_WAIT_SECONDS = 120`. |
| `apps/nexus-mobile/src/components/XPortalSheet.tsx` | `useReducer(xPortalReduce)` în locul lui `phase`/`seconds`/`WAIT_SECONDS`; effect-urile și evenimentele trimit `open`, `close`, `phase`, `pairing`, `token`, `error`, `tick`, `reopen`, `active`. Numărătoarea de o secundă rulează **doar** cât `xPortalIsWaiting`. „Deschide din nou xPortal” trimite `reopen` (linkurile rămân vizibile și după expirare), iar listener-ul de `AppState` trimite `active` la revenire. |
| `apps/nexus-mobile/scripts/test-xportal-state.cjs` (nou) | 12 teste pe reducer: expirare la 120 s, pași care nu merg înapoi, finalitatea `token`/`failed`, `reopen`/`active`/`returns`, textul etichetei. Intrat în `npm test`. |
| `apps/nexus-mobile/scripts/test-xportal-login.cjs` | Verifică acum absența `WAIT_SECONDS = 120` din foaie și prezența `useReducer`, `xPortalIsWaiting`, `dispatch({ type: 'tick' })`, `waitLabel` (20 de teste, de la 17). |
| `apps/nexus-web/src/wc-client.js` + `public/wc-bundle.js` | Textele care ajung pe ecran în foaie nu mai numesc alt produs: „WalletConnect Jungle Book nu este configurat”, „Project ID-ul Jungle Book…”, „conectez Jungle Book la WalletConnect Relay…”, „finalizarea sesiunii Jungle Book a expirat”. Bundle-ul reconstruit cu `node scripts/build-wc.mjs`. |
| `apps/nexus-web/test/wallet-connect.test.js` | Așteaptă noile texte (`projectId` în loc de `nexusId` în testul de `finalize`). |

**Verificat pe 18 octombrie 2026 (Windows, Node 24.19):**

| Comandă | Rezultat |
|---|---|
| `apps/nexus-mobile` → `node scripts/test-xportal-state.cjs` | 12/12 |
| `apps/nexus-mobile` → `node scripts/test-xportal-login.cjs` | 20/20 |
| `apps/nexus-mobile` → `node scripts/test-brand.cjs` | ok (niciun „Nexus” vizibil în `src/`) |
| `apps/nexus-mobile` → `npx tsc --noEmit` | exit 0, fără erori |
| `apps/nexus-web` → `npm test` | **812/812** |
| `apps/nexus-web` → `node scripts/build-wc.mjs` | `public/wc-bundle.js` 1,3 mb, „built successfully” |

**Rămas de făcut aici:**

1. **Originea locală nu e în WalletConnect Cloud.** Pentru `http://192.168.1.153:5000` relay-ul răspunde
   „Origin not allowed”; foaia afișează propoziția cu originea exactă de adăugat. `API_ORIGIN` are ca
   implicit Railway (`https://nexus-deepsek-production.up.railway.app`), deci originea locală apare doar când
   Metro e pornit cu `EXPO_PUBLIC_NEXUS_API_URL=http://192.168.1.153:5000`. Două căi: (a) se pornește Metro
   **fără** acea variabilă (telefonul vorbește cu Railway, a cărei origine trebuie însă confirmată în
   dashboard), sau (b) se adaugă `http://192.168.1.153:5000` la Allowed Origins (proiectul **Jungle Book**,
   `3762…3722`, §0.15).
   Vezi §0.12 „Cum comuți între serverul local și Railway”.
2. **Testul pe telefon nu a fost făcut în această rundă** (fără dispozitiv în sesiune). Secvența: tap pe
   „Conectează”, raport „ACUM: amprenta”, așteptare ≤ 60 s, apoi logcat filtrat + `logEvent` din punte.
3. **Client WC singleton + curățarea pairing-urilor moarte + starea încercării persistată** — neînceput
   (vezi §2 „Ce lucrez acum”).

## 0.12 xPortal publicat pe Railway + comutarea local ↔ Railway (18 octombrie 2026)

**Aprobat de proprietar:** „ai acordul meu să faci push pe `main` pentru modificări de backend aditive, cu
verificare și revert”. Push făcut dintr-un worktree curat pe `origin/main`
(`C:\Users\Romeo\projects\nexus_deepsek-deploy-xportal`), commit **`4f44697`** pe `main`, fără modificări
adiacente din arborele de lucru.

| Fișier | De ce a intrat în deploy |
| --- | --- |
| `apps/nexus-web/public/xportal-bridge.html`, `xportal-bridge.js` | pagina punte nu era versionată deloc (404 pe producție) |
| `apps/nexus-web/public/wc-bundle.js` | reconstruit din `src/wc-client.js`; are `walletConnectMetadata`, `pairingTopic`, `wasConnected`; **niciun export eliminat** față de bundle-ul anterior (11 → 13) |
| `apps/nexus-web/src/wc-client.js` | sursa bundle-ului, ca bundle-ul publicat să fie reproductibil din sursa publicată |
| `apps/nexus-web/lib/env.js` | `PUBLIC_WALLETCONNECT_PROJECT_ID` + valori implicite **doar** în `NEXUS_DEPLOYMENT_MODE=preview` și **doar** pentru originea exactă din `NEXUS_ORIGIN`; variabilele de mediu au prioritate; `walletConnectAttestation` întoarce acum și `projectId` rezolvat |
| `apps/nexus-web/lib/api.js` | `/auth/mvx/init` întoarce `wcProjectId: wcAttestation.projectId` (înainte citea variabila brută, deci ar fi răspuns `null` cu valorile implicite) |
| `apps/nexus-web/test/core.test.js`, `test/wallet-connect.test.js` | testul noii reguli de attestation (11 aserțiuni) și testele clientului |

**De ce implicitul e acceptabil:** Project ID-ul WalletConnect nu este un secret — `/auth/mvx/init` îl trimite
oricui deschide pagina (`wcProjectId`). Implicitul nu poate attesta un host străin (compară exact cu
`NEXUS_ORIGIN`), nu se aplică în afara modului `preview`, iar `NEXUS_WC_*` setat explicit câștigă întotdeauna.
Gate-ul de producție reală (`NEXUS_DEPLOYMENT_MODE` absent) a rămas neschimbat: fără variabile, serverul refuză
să pornească.

**Verificat pe `https://nexus-deepsek-production.up.railway.app`, după deploy:**

| Verificare | Rezultat |
| --- | --- |
| `GET /health` | 200 `{"ok":true,"status":"ready"}` |
| `GET /xportal-bridge.html` | **200**, are `id="qr"` și `<script src="/xportal-bridge.js">` |
| `GET /xportal-bridge.js` | **200**, are `__nexusResume` și `__nexusCopy` |
| `GET /wc-bundle.js` | **200**, 1 345 879 B, are `walletConnectMetadata` / `wasConnected` |
| `GET /auth/mvx/init` cu `Origin` corect | **200**, `origin` = originea Railway, `wcProjectId` = `16df…fc98` (ID-ul de atunci; din §0.15 serverul publică `3762…3722`) |
| `GET /api/profiles/test` cu sesiune din `docs/.test-sessions.local` | **200** (câmpuri `ok,profile,posts,reposts,shared_replies,stories`) |
| `GET /` și `GET /app.js` | 200 / 200 (web-ul servește în continuare) |
| `POST /auth/email/login` cu parolă greșită | **401** `invalid credentials` (ruta de parolă funcționează) |
| `POST /auth/email/login` cu conturile de test documentate | **403** „verifică adresa de email înainte de autentificare” — toate conturile din fișier sunt neverificate, deci **loginul cu parolă nu a putut fi dus până la capăt** cu ele; codul acestei rute nu e atins de deploy |

**Neconfirmat de aici atunci:** lista de domenii permise din WalletConnect Cloud (dashboard-ul nu e citibil din
repo). Între timp proprietarul a confirmat-o pentru proiectul **Jungle Book** (`3762…3722`), §0.15: originea
`https://nexus-deepsek-production.up.railway.app` e în listă, iar sonda de releu răspunde ALLOWED. Serverul nu are
nevoie de altceva: `/auth/mvx/init` e 200 și publică `wcProjectId`.

### Cum comuți între serverul local și Railway (telefon)

Valoarea e **injectată în bundle la build**, deci schimbarea originii cere repornirea Metro cu `--clear` și
reîncărcarea aplicației. Nu se folosește `adb reverse` pentru API.

```powershell
# 1) serverul local (dacă nu rulează deja) — ascultă pe :5000, din apps/nexus-web/.env
cd C:\Users\Romeo\projects\nexus_deepsek\apps\nexus-web
node server.js

# 2) Metro cu originea locală
cd C:\Users\Romeo\projects\nexus_deepsek\apps\nexus-mobile
$env:EXPO_PUBLIC_NEXUS_API_URL='http://192.168.1.153:5000'
node node_modules\expo\bin\cli start --dev-client --port 8081 --clear

# 3) reîncărcare completă pe telefon (fără să închizi manual aplicația)
adb -s 192.168.1.184:36819 shell am force-stop app.nexus.mobile.dev
adb -s 192.168.1.184:36819 shell am start -a android.intent.action.VIEW -d "nexusdev://expo-development-client/?url=http%3A%2F%2F192.168.1.153%3A8081"
```

Pentru **Railway** (implicitul din `src/lib/apiOrigin.ts`): aceleași comenzi fără linia cu
`EXPO_PUBLIC_NEXUS_API_URL` (sau `Remove-Item Env:\EXPO_PUBLIC_NEXUS_API_URL` înainte de `expo start`), tot cu
`--clear`. Originea aleasă se citește pe ecran: subsolul ecranului de conectare și sertarul scriu
`API: local` sau `API: Railway` (`src/lib/apiOrigin.ts`). Dovadă fără să te uiți pe telefon:
`Get-NetTCPConnection -LocalPort 5000 | Where-Object RemoteAddress -eq '192.168.1.184'` arată conexiunile
telefonului către serverul local.

**Unelte:** `adb` lipsea de pe mașină; platform-tools au fost instalate în
`%LOCALAPPDATA%\Android\Sdk\platform-tools` (locul în care `scripts/nexus-env.ps1` îl caută), iar telefonul e
conectat prin ADB wireless la `192.168.1.184:36819`. `uiautomator dump` poate refuza cu
„could not get idle state” cât timp feed-ul video rulează; în cazul acela verificarea se face din
`adb logcat --pid=<pid>` și din jurnalul Metro (`builds/metro-local.log`).



## 0.11 Ce lipsește pe serverul de producție ca loginul xPortal să poată porni (18 octombrie 2026)

Verificat direct pe `https://nexus-deepsek-production.up.railway.app` — adresa pe care o folosește aplicația
instalată acum (bundle-ul Metro servit telefonului conține exact acest `API_ORIGIN`):

| Verificare | Rezultat | Ce înseamnă |
| --- | --- | --- |
| `GET /xportal-bridge.html` | **404** | pagina punte nu este în imagine: `public/xportal-bridge.html` și `xportal-bridge.js` erau neversionate, iar `Dockerfile` copiază doar `apps/nexus-web` din git |
| `GET /xportal-bridge.js` | **404** | la fel — fără pagină, WebView-ul din foaie nu are ce încărca |
| `GET /wc-bundle.js` | 200, 1 340 259 B (= `origin/main`) | bundle-ul publicat nu are `walletConnectMetadata` / `wasConnected`; cel construit local are 1 345 912 B și le are |
| `GET /auth/mvx/init` cu `Origin: https://nexus-deepsek-production.up.railway.app` | **503** `WALLETCONNECT_PROJECT_NOT_ATTESTED` | Railway rulează `NEXUS_DEPLOYMENT_MODE=preview` (`docs/railway-persistent-deployment.md`) și nu are cele trei variabile cerute de `lib/env.js` |

Consecința pe telefon: butonul xPortal se oprește la „Serverul a refuzat pagina de conectare (404).” xPortal nu
se deschide deloc, deci nici aprobarea cu amprenta nu are unde să apară.

**Ce s-a făcut** (detalii și dovezi în §0.12): cele trei fișiere au fost publicate pe `main`, iar cele trei
variabile nu mai sunt necesare — modul `preview` își attestă singur originea din `NEXUS_ORIGIN`. `GET
/auth/mvx/init` răspunde acum **200** cu `wcProjectId` pe producție.

Alternativa verificată, fără deploy: serverul local (`:5000`) este complet pregătit pentru flux
(`/xportal-bridge.html` 200, `/auth/mvx/init` 200 cu `wcProjectId`), deci telefonul poate testa cu
`EXPO_PUBLIC_NEXUS_API_URL=http://192.168.1.153:5000` — origine deja trecută în `NEXUS_WC_ATTESTED_ORIGINS`
și `NEXUS_ACCEPTED_ORIGINS` din `apps/nexus-web/.env`, iar build-ul debug permite cleartext.


## 0.10 xPortal întoarce cititorul în aplicație după aprobare (18 octombrie 2026)

Regula proprietarului: după ce aprobă în xPortal, cititorul se întoarce **singur** în Jungle Book, cu
conectarea gata — nu caută aplicația de mână, nu reia pairing-ul. Cauza găsită: metadata WalletConnect nu
avea `redirect.native`, deci xPortal nu avea unde să întoarcă; iar socketul relay al WebView-ului adoarme cât
timp xPortal e în față, deci semnătura sosită în fundal nu ajungea în `login()`.

| Unde | Fișier | Ce s-a schimbat |
| --- | --- | --- |
| client web | `apps/nexus-web/src/wc-client.js` | `walletConnectMetadata({origin, redirectNative, redirectUniversal})` scrie `metadata.redirect` (scheme trimmate, câmpul lipsește când nu e dat); `startXPortalLogin({redirect})` îl pasează providerului; `resumeXPortalTransport` întoarce `{supported, connected, restarted, wasConnected, error}`, așteaptă până la 4 s și nu aruncă niciodată |
| pagina punte | `apps/nexus-web/public/xportal-bridge.js` | citește `?redirect=` (doar schemă goală, `/^[a-z][a-z0-9+.-]{1,30}:\/\/$/`) și `?universal=` (doar http(s)); `window.__nexusResume` repornește transportul și postează `relay` + `log relay-resume`; `window.__nexusCopy` copiază linkul (clipboard, cu `execCommand` ca rezervă); faze `preparing`/`pairing`/`signature`/`token`/`failed`; QR prin `renderWcQr`; `visibilitychange` cere și ea reluarea; timeout 180 s pe login |
| pagina punte | `apps/nexus-web/public/xportal-bridge.html` | container `#qr` (132 px, fundal deschis) pentru codul QR |
| telefon | `apps/nexus-mobile/src/lib/xportalLogin.ts` | `xPortalRedirectScheme` (`nexusdev` → `nexusdev://`, orice altceva → gol), `xPortalBridgeUrl(origin, {native, universal})`, tipuri `phase`/`relay`/`copied`/`log`, `diagnosticFields` (aruncă `wc:…`, cheile și valorile cu `symKey`, taie la 64), `xPortalPairingTopic`, `logXPortal` |
| telefon | `apps/nexus-mobile/src/components/XPortalSheet.tsx` | redirect derivat din `Constants.expoConfig?.scheme`; numărătoare `WAIT_SECONDS = 120` (doar informează, pagina așteaptă mai departe); `AppState === 'active'` injectează `__nexusResume`; linkuri „Deschide xPortal din nou" și „Copiază linkul de conectare"; rânduri proprii pentru `relay` și `notice` |
| teste | `apps/nexus-web/test/wallet-connect.test.js` | 17 teste: metadata cu/fără redirect, reluarea care raportează eșecul, pagina care pasează `redirect` și postează `relay` |
| teste | `apps/nexus-mobile/scripts/test-xportal-login.cjs` | 17 teste: schema de redirect, parametrii din URL, fazele, `relay`/`copied` citite strict, logul fără symKey, topicul, foaia care cere reluarea |
| brand | `apps/nexus-mobile/scripts/test-brand.cjs` | excepția acoperă acum `__nexusResume` și `__nexusCopy` (globale de punte, nedesenate) |

**Verificat acum:** `node node_modules/typescript/bin/tsc --noEmit` → **0 erori**; `cmd /c npm test` (mobil) →
**exit 0**, `test-xportal-login` **17/17**; `node --test test/wallet-connect.test.js
test/native-auth-session.test.js test/p0-deployment-contract.test.js test/p3-localization-rtl.test.js
test/p0-offline-private-cache.test.js` → **31/31**; `node scripts/build-wc.mjs` → `public/wc-bundle.js`
(1.3 mb) conține `metadata.redirect`, `resumeXPortalTransport`, `wasConnected`.

**Rămas de făcut aici:** testul pe telefon (A: aprobare → revenire automată; B: refuz în xPortal → propoziția
„Ai anulat…"; C: revenire fără aprobare → „Se așteaptă confirmarea… (Ns)"), plus confirmarea schemei de
producție (acum `nexusdev`, din `app.json`). `AndroidManifest.xml` nu are `<queries>` pentru `xportal` — nu
blochează, fiindcă nu folosim `canOpenURL`. O conectare pornită înainte de un cold start nu se reia (topicul
nu e persistat); `singleTask` face cazul rar.

## 0.9 Rândul propriu `[Editează profilul] [⋯]` și meniul reordonat (18 octombrie 2026)

Regula proprietarului: pe profilul propriu rândul are **exact două intrări** — `Editează profilul`, lat, și
un `⋯` rotund — iar meniul deschis de ele începe cu **Monetizează profilul, Distribuie profilul, Portofel,
Setări**. Cele trei butoane din runda anterioară (editor, monetizare verde, distribuire rotundă) au fost
desfăcute; niciunul nu mai are o a doua casă în rând.

| Unde | Ce s-a schimbat |
| --- | --- |
| `src/lib/profileActions.ts` | `OWNER_ROW` ține `menuSize` / `menuTarget` / `menuGlyph` în locul `shareSize` / `shareTarget` / `shareGlyph`; `OWNER_ROW_WORDS` are doar `edit`, `editShort` și `menu: 'Deschide meniul'`; `ownerRowLabels` întoarce `{edit}`, iar `ownerWideLabelRoom` scade un singur gol și ținta rotundă (fără împărțire la 2) |
| `src/lib/profileMenu.ts` | ordinea `ProfileMenuId` și a lui `PROFILE_MENU`: primele patru porți cerute, apoi porțile fostului sertar (postare nouă, notificări, ieșire din cont) și cele două jumătăți ale registrului (Venituri, Cheltuieli) — nouă rânduri, același index de porți |
| `src/components/ProfileHeader.tsx` | rândul propriu desenează editorul și `⋯`; `⋯` are `accessibilityLabel={PROFILE_MENU_WORD}` și `accessibilityState={{expanded}}`, țintă de 44 dp prin `hitSlop=(menuTarget-menuSize)/2`; stilurile `ownerPrimary` / `ownerPrimaryLabel` / `ownerRoundShare` au fost șterse, a apărut `ownerMenuGlyph` |
| `src/screens/ProfileScreen.tsx` | `onMonetize` nu mai coboară în antet; `handlers` ale foaiei primesc `monetize`, `share` (același `Share.share` pe care îl folosea rotundul), `wallet`, `settings` în ordinea din meniu |
| `scripts/test-profile-menu.cjs` | 10 teste: ordinea celor nouă porți, geometria rândului (`menuSize`/`menuTarget`), eticheta lată care încape la scara 1 → 2 pe 469 dp, scurtarea pe un ecran de 200 dp, și antetul fără `ownerPrimary`, fără `kind="share"`, fără `onMonetize`, cu `⋯` și `expanded` |

**Verificat acum:** `node node_modules/typescript/bin/tsc --noEmit` → **0 erori**; `cmd /c npm test` (mobil) →
**exit 0**, fără niciun `fail`; `node scripts/test-profile-menu.cjs` → **10/10**.

**Rămas de făcut aici:** captura pe telefon a rândului și a meniului (ADB răspunde, dar runda asta nu a atins
dispozitivul), plus confirmarea că `⋯` și cele trei bare deschid aceeași foaie.


## 0.8 Aprecierea și comentariul se plătesc — devnet, cu citat de la server (18 octombrie 2026)

Cerința proprietarului: fiecare apreciere și fiecare comentariu este o **tranzacție reală** (3 ¢ like,
4 ¢ comentariu, distribuirea gratuită), nu un contor local. Ce s-a construit, în două repo-uri:

| Unde | Fișier | Ce face |
| --- | --- | --- |
| server | `lib/devnet-payments.js` (nou) | citește contul plătitorului de pe devnet, semnează transferul cu portofelul de test, difuzează, recitește starea; adresele vin din `docs/.test-wallets.local` |
| server | `lib/action-payments.js` (nou) | citat (`quoteAction`), plată (`payForAction`, `Idempotency-Key`), poarta (`requirePaidAction`), reconciliere pe lanț, `consumeActionPaymentIntent` — o singură folosire |
| server | `lib/api.js` | `GET /api/posts/:id/action-quote`, `POST /api/posts/:id/action-payment`, `GET /api/action-payments/:intent`; like-ul (`api.js:4006`) și comentariul (`api.js:4108`) trec prin poartă; `allowComments: false` răspunde `403` înainte de preț |
| server | `lib/db.js`, `lib/repo.js` | tabela `action_payment_intents`, index, consum atomic |
| telefon | `src/lib/actionPayments.ts` | citește citatul, știe ce înseamnă fiecare cod, formatează sumele din wei (`egldFromWei`), `paymentKeyRotates` |
| telefon | `src/components/ActionPaymentSheet.tsx` | foaia de plată: preț, comision, total, sold, cât lipsește, faucet, „verifică din nou”, chitanță cu hash și explorer |
| telefon | `PostCard.tsx`, `CommentsSheet.tsx` | la `402 PAYMENT_REQUIRED` deschid foaia; după aprobare retrimit **aceeași** scriere cu `payment_intent_id` |

Decizii care contează mai departe:

1. **Clientul nu calculează bani.** Prețul și sumele pe lanț vin din `detail.quote` al refuzului `402`;
   telefonul doar le formatează. Testul verifică faptul că suma în wei bate stringul `amount_egld`.
2. **Cheia de idempotență nu se schimbă la o conexiune căzută** — reluarea aceleiași chei este modul de a
   recupera un transfer care a plecat. Se rotește doar când serverul a închis rândul (`paymentKeyRotates`).
3. **Fără fonduri, foaia spune adevărul**: `CHAIN_INSUFFICIENT_FUNDS` cu adresa, soldul și suma necesară, plus
   un buton de recitire a soldului după faucet, ca cititorul să nu închidă foaia ca să afle că poate plăti.
4. **Serverul nu mai cade tăcut pe „simulat”.** Implicitul este `devnet`, iar un host fără portofele refuză
   plata cu `503 WALLET_STORE_MISSING` **înainte** să scrie vreun rând. Modul demonstrativ se cere explicit:
   `NEXUS_PAYMENTS_CHAIN=simulated` (sau `off`), iar rândul rămâne marcat `chain_mode: "simulated"`.

**Verificat acum:**

| Verificare | Rezultat |
| --- | --- |
| `npx tsc --noEmit` (mobil) | **0 erori** |
| `npm test` (mobil, 16 fișiere) | **exit 0**, niciun `fail`; 13 teste în `scripts/test-action-payments.cjs` |
| `node --test test/action-payments.test.js test/p1-action-ledger.test.js test/creator-pricing.test.js` | **28/28** (12 în `action-payments`, inclusiv noul „fără portofele = refuz, nu simulare”) |
| suita web întreagă (`test/*.test.js`) | **812/813** — singurul roșu este `test/wallet-connect.test.js`, care moare la import: `src/wc-client.js` cere pachetul `qrcode`, care nu e în `package.json` și nu e instalat (problema exista înainte de această rundă) |
| citat real de pe devnet pentru un like de 3 ¢ | `0.001 EGLD` + `0.000114 EGLD` comision = `0.001114 EGLD`; sold `0`, lipsă `0.001114`; `can_afford:false` |
| `payForAction` fără EGLD | refuz `402 CHAIN_INSUFFICIENT_FUNDS` cu `{address, balance_egld, required_egld, faucet_url}`, iar rândul din registru rămâne `failed` cu `tx_hash: null` |

**Blocat, cu motiv:** nu există încă un hash real. Cele cinci portofele din `docs/.test-wallets.local` au
`egld: "0"` (`tools/probe-devnet-balances.mjs`), iar faucetul devnet cere captcha în browser — nu poate fi
declanșat dintr-un script. `adb` lipsește complet (SDK-ul Android nu e instalat, `ANDROID_HOME` arată într-un
dosar gol), deci nici instalarea pe telefon nu se poate face din această sesiune.

**Următorii pași, în ordine:**

1. Faucet pentru primul portofel (`https://devnet-wallet.multiversx.com/faucet`), apoi
   `node tools/probe-devnet-balances.mjs` → `egld` peste `0.0012`.
2. `GET /api/posts/:id/action-quote?action=appreciation` → `can_afford: true` (fără asta, foaia arată corect
   cât lipsește și nu lasă butonul de plată activ).
3. Un like din telefon → `tx_hash` în chitanță; hash-ul se deschide în explorer.
4. Instalare `adb` (platform-tools) ca să repete pasul 3 pe telefon și să facă captura.

Documentul de economie a fost adus la zi: `docs/MONETIZATION-SPEC.md` §9 (contract, reguli de client, ce e
dovedit) și §8.2 (`per_action` are adaptor real; `batched` rămâne neconstruit).


## 0.1 Continuarea din 17 octombrie 2026 — F2.c (preț pe acțiune) și linia de sfârșit de rând

**Starea repo-ului la reluare:** branch `codex/camera-draft-stability`, HEAD `0525e64`, fără commit nou.
Modificate (nestaged): `lib/api.js`, `lib/db.js`, `lib/repo.js`; noi: `lib/creator-pricing.js`,
`test/creator-pricing.test.js`. Nimic nu a fost resetat, stashat sau aruncat.

**De ce picau 7 teste din suita web (dovadă, nu presupunere).** Un worktree curat pe `0525e64`
(`git worktree add`, fără modificările locale, `node_modules` legat prin joncțiune) pică **11** teste;
arborele de lucru pică **7**, toate incluse în cele 11. Deci niciun eșec nu vine din modificările F2.c.
Cauza reală a eșecurilor comune: `core.autocrlf=true` scrie în worktree CRLF, iar contractele citesc sursa
cu `\n    ` și măsoară fișierele în bytes. Măsurat: `app.js` = **647.904 B** pe disc, **638.364 B** în index
(buget 638.600) — deci bugetul „depășit" era doar `\r`. Reparat fără atingerea codului de produs:
`.gitattributes` (`* text=auto eol=lf` + reguli binary) și `tools/normalize-eol.mjs` (o singură rulare pe
`apps/nexus-web`, 117 fișiere rescrise LF). `git status` arată din nou doar cele trei fișiere modificate;
`git diff --stat` = 138 linii adăugate.

**Rezultate reale după reparație:**
`cd apps/nexus-web; node --test test/*.test.js` → **791 teste, 791 pass, 0 fail, exit 0**.
`node --test test/creator-pricing.test.js` → **11/11** (8 unitare + 3 peste `handleRequest`: citirea
proprietarului/fanului, replay-ul aceleiași chei și refuzul aceleiași chei cu alt corp, refuzurile
`IDEMPOTENCY_KEY_REQUIRED` / `FREE_WITH_PRICES` / `PRICING_INVALID` / `PRICE_BELOW_SETTLEMENT_COST`).

**Backend F2.c (deja scris, verificat acum):** `lib/creator-pricing.js` (pur: chei, preseturi 2/3/3 și
3/5/5, prag, `normalizePricingInput`, `pricingView`, `actionAffordability`), tabela
`creator_action_prices`, `repo.getCreatorActionPricing` / `setCreatorActionPricing` /
`getCreatorPricingForViewer`, rute `GET /api/creator/pricing`, `GET /api/creator/pricing/:handle`,
`PUT /api/creator/pricing` (corp exact `{free, prices}`, idempotență prin `prepareMutation`, prețul
devine produs tip real, split prin `splitAmount`, `debit_enabled:false` → `DEMO_UNPAID`).

**Telefon (F2.c), scris în continuare:**
* `src/lib/creatorPricing.ts` — normalizarea răspunsului, `validateDraft` (prag/plafon/zecimale),
  `draftFromView`/`draftFromPreset`, `presetOfView`/`presetOfDraft`, `fanPreview` (rândurile fanului,
  `Indisponibil`), `confirmationFor` (preț, comision, creator, sold, buget de sesiune, blocaje),
  `loadOwnPricing` / `loadCreatorPricing` / `saveOwnPricing`, `pricingErrorWords`;
* `scripts/test-creator-pricing.cjs` — **11/11**, adăugat în lanțul `npm test`;
* `src/components/SupportConfirmSheet.tsx` — confirmarea centrală (folosită acum de previzualizare);
* `src/screens/MonetizationScreen.tsx` — rescris: `Totul gratuit` chiar salvat (implicit când nu există
  prețuri), preseturi din server, mod avansat cu trei câmpuri, prag/plafon afișate, „Cum văd fanii” cu
  foaia de confirmare, catalog citit de la server; acțiunile necotate rămân dezactivate + `Indisponibil`.

**Comenzi și rezultate:** `node node_modules/typescript/bin/tsc --noEmit` (mobile) → **0 erori**;
`cmd /c npm test` (mobile) → **exit 0**, ultimul bloc 11/11.

**Blocaje și următorul pas concret:**
1. Foaia de susținere pentru fan (`POST /api/creator/support-intents` + receipt) nu are gazdă pe telefon:
   aplicația nu are încă suprafață de profil al altcuiva (`src/app/profile/[handle].tsx` este un shell).
   Componenta de confirmare este gata și se folosește de acolo.
2. Verificarea pe telefon (capturi) cere ADB + `NEXUS_SETTLE_DEMO=1` pentru decontări; nu s-a rulat acum.
3. Nimic nu a fost commit-uit sau push-uit. Următoarea acțiune: `git diff` pe cele trei fișiere backend,
   apoi commit separat pentru F2.c (fără `main`).


## 0.2 Continuarea din 17 octombrie 2026, seara — profilul propriu și meniul lui

**Commit-uri făcute la începutul sesiunii (pe `codex/camera-draft-stability`, push făcut):**

| Commit | Ce conține |
|---|---|
| `d0a5384` | `.gitattributes` + `tools/normalize-eol.mjs` — worktree-ul rămâne LF, deci contractele în bytes și cele cu `\n    ` măsoară ce trebuie |
| `69b0177` | F2.c backend: `lib/creator-pricing.js`, `creator_action_prices`, `repo.getCreatorActionPricing`/`setCreatorActionPricing`/`getCreatorPricingForViewer`, rutele `GET/PUT /api/creator/pricing` + `GET /api/creator/pricing/:handle`, `test/creator-pricing.test.js` |
| `2a8161d` | partea de mobil a F2.c (`creatorPricing.ts`, `SupportConfirmSheet`, `MonetizationScreen`, `test-creator-pricing.cjs`) + `HANDOFF.md` + `MONETIZATION-SPEC.md` |

Teste înainte de fiecare commit: web `791/791`, mobil `tsc` 0 erori și `npm test` exit 0.

**Pasul 1 — profilul propriu, exact cum a cerut proprietarul.** Ce s-a schimbat, în cod:

* `src/lib/profileActions.ts` (nou, pur): geometria rândului proprietarului (`OWNER_ROW`: 40 dp, rază 20,
  gol 8, rotund 40/țintă 44), cuvintele (`Editează profilul`, `Monetizează profilul`, `Distribuie profilul`)
  și decizia „încape sau se scurtează" (`estimateLabelWidth`, `ownerWideLabelRoom`, `ownerRowLabels`).
  La 469 dp / scara 1.0 ies ambele etichete lungi; la 1.3 iese `Monetizează`; la 360 dp / 1.0 tot
  `Monetizează`. Eticheta nu se truncează niciodată cu „…".
* `src/components/ProfileHeader.tsx`: rândul propriu are **trei** butoane — editor neutru (lat), monetizare
  verde plin (lat), distribuire rotundă doar cu glifa `share` (`SolidViewerIcon`), fără text. `⋯` a ieșit
  din rând. Butonul `≡` din antet are eticheta `Deschide meniul profilului` și starea `expanded`.
  Rândul vizitatorului (`Urmărește`/`Mesaj`/`⋯`) este neatins.
* `src/lib/profileMenu.ts` (nou) + `src/components/ProfileMenuSheet.tsx` (nou): meniul profilului, în ordinea
  cerută — Portofel, Venituri, Cheltuieli, Notificări, Monetizează profilul, Setări — fiecare rând cu ce
  deschide; o poartă fără ecran nu se desenează. `DRAWER_ONLY_WORDS` fixează ce nu are voie să apară:
  deconectare, schimbarea profilului, postare nouă.
* `src/screens/SettingsScreen.tsx` (nou): `Banda derulantă` (comutatorul real din `lib/bandPrefs.ts`), plus
  lectura `Android <versiune> · API: <origine>` și marcajul de build JS. Nu deconectează și nu schimbă
  profilul: spune unde sunt porțile acelea (sertarul din Acasă).
* `src/screens/WalletScreen.tsx`: `initialSheet` — `Venituri` și `Cheltuieli` din meniu deschid portofelul
  direct pe partea lui de registru; titlul rămâne `Portofel`.
* `src/app/index.tsx`: `ownerPanel` are acum `monetize | wallet | income | spending | settings`; profilul nu
  mai primește `onMenu`/`menuOpen`, deci **nu are nicio cale către sertar**. Sertarul rămâne pe Feed, din
  butonul lui.
* `src/lib/buildStamp.ts` + `scripts/stamp-build.mjs` (`npm run stamp`): marcajul de build JS (hash scurt +
  momentul, cu `+` când arborele era murdar), tipărit în subsolul sertarului sub linia de versiune.
* Teste: `scripts/test-profile-menu.cjs` (8 teste: ordinea celor șase porți, refuzul cuvintelor din sertar,
  poarta fără ecran, geometria 40/20/44, etichetele la 1.0 și 1.3, ecranul îngust, antetul fără `⋯`,
  profilul fără `setDrawerOpen`) și `scripts/test-pricing.cjs` (5 teste, mutate din `test-owner-menu.cjs`,
  care a fost șters odată cu `ownerMenu.ts` / `ProfileOwnerMenu.tsx`). `test-hero-parity.cjs` a fost
  actualizat: săgețile promit meniul profilului, nu setările.

**Rezultat:** `tsc --noEmit` 0 erori, `npm test` exit 0 (toate suitele, inclusiv cele 8 + 5 noi).

**Ce nu s-a dovedit încă:** nimic din pasul acesta nu a fost văzut pe telefon în această rundă — dump-urile
`uiautomator` cer telefonul conectat (vezi §5) și sunt trecute în tabelul de la Pasul 6.

## 0.3 Pasul 2 — marca fără fundal, mai mare (17 octombrie 2026)

**Asset-urile au fost regenerate, nu doar redimensionate în cod.** `tools/brand/make-assets.mjs` și
`make-assets.ps1` scriu acum marca de antet la **52 dp** (52/104/156 px) și marca butonului central la
**54 dp** (54/108/162 px), în loc de 36/40. Rulare: `node tools/brand/make-assets.mjs` → exit 0,
„13 files · 0 stale file(s) removed · two runs byte-identical".

Măsurători din `assets/brand/stats.json` (citite, nu privite):

| Fișier | Transparent | Rampă de margine | Ceață | Pete |
|---|---|---|---|---|
| `jb-mark-header-3x.png` | 51,29 % | 1 px | 0 | 0 |
| `jb-mark-nav-3x.png` | 51,63 % | 1 px | 0 | 0 |
| `jb-mark-1024.png` | 55,35 % | 3 px | 2,351 % | 0 |

Deci nu a fost nevoie de praguri mai strânse: colțurile sunt `0,0,0,0`, iar ceața micilor mărci este zero.

**Cod:**

* `BrandLogo`: dimensiunile implicite sunt `header: 52`, `nav: 54`, `large: 132`.
* `AppHeader`: a ieșit `BuildBadge` (textul de versiune de sub logo) și prop-ul `build`; ușa mărcii este
  acum 52 × 52, fără ramă, fără fundal și fără umbră. Antetul rămâne 72 dp (`feedHeader.height` și
  `appHeader.height` sunt amândouă 72).
* `AppNav`: celula centrală desenează **doar** `BrandLogo variant="nav"` — au ieșit discul de 52 px,
  inelul alb de 4 px, gradientul radial și umbra. Zona de atingere și eticheta `Creează` sunt aceleași.
* `NexusLogin` / `login-preview` / `app/index.tsx`: versiunea nu se mai tipărește sub marcă. Ea apare doar
  în subsolul sertarului (`Android … · API: …` + `build <hash> · <oră>`) și în **Setări › Despre**, care
  primește și versiunea serverului citită de pe `/app.js`.
* `scripts/test-brand-paint.cjs` (nou, 4 teste) ține regula: 52/54 în anteturi de 72, niciun
  `borderWidth`/`backgroundColor`/`shadow` pe ușa mărcii, fără `BuildBadge`, fără `RadialGradient` în
  bara de jos, login fără linie de versiune, sertar/inbox fără ramă.

**Rezultat:** `tsc --noEmit` 0 erori; `npm test` exit 0 (suita completă, acum cu 4 teste în plus).

## 0.4 Pașii 3 și 4 — tema jungle și fundalul (17 octombrie 2026)

**Paleta a fost extrasă din marcă, nu inventată.** `tools/brand/sample-palette.ps1` (nou) citește
`jb-mark-1024.png`, ignoră pixelii cu alpha < 200, grupează culorile pe 5 biți pe canal și atribuie fiecare
grup celui mai apropiat fruct. Rulare pe 96.403 pixeli opaci eșantionați:

| Fruct | Acoperire | Fruct | Acoperire |
|---|---|---|---|
| leaf | 38,40 % | banana | 7,51 % |
| mango | 23,57 % | papaya | 6,20 % |
| raspberry | 14,70 % | blueberry | 0,12 % |
| kiwi | 9,45 % | passionfruit | 0,04 % |

Grupurile dominante: `#E47424`, `#EC7424` (mango/papaya), `#F4AC04`, `#FCB404`, `#F4BC2C` (banana) și
verdele închis `#1C3404`, `#243C04` (leaf). De aici vin accentele din `src/theme/jungle.ts`.

**Tokens (`src/theme/jungle.ts`, un singur loc):** câmp `#02150D`, suprafețe `#04201A` / `#062A22`, borduri
`rgba(112,164,130,0.22)`, acțiune primară kiwi `#8BD04A` cu cerneala `#04160B`, `navActive` banană
`#F5D33C`, `navIdle` verde-gri `#8FA79A`, `dangerInk` `#FF6B8A`, iar `media` rămâne `#000000`.

**Contrast — `scripts/test-theme-contrast.cjs` (nou), 14 perechi, prag 4,5:1, toate trec:**

| Pereche | Raport | Pereche | Raport |
|---|---|---|---|
| text pe canvas | 17,83:1 | ink pe primary | 9,97:1 |
| text pe surface | 16,22:1 | canvas pe banana | 12,79:1 |
| text pe sheet | 14,61:1 | navActive pe canvas | 12,79:1 |
| textMuted pe canvas | 8,89:1 | navIdle pe canvas | 7,32:1 |
| textQuiet pe canvas | 6,30:1 | leaf pe canvas | 5,52:1 |
| textMuted pe sheet | 7,28:1 | dangerInk pe canvas | 7,00:1 |

Raspberry-ul pur (`#D63357`) dă doar **4,01:1** pe câmp, deci nu e folosit ca text: inelul lui rămâne
decorativ, iar cuvintele care avertizează folosesc `dangerInk`.

**Aplicare discretă (fără schimbarea structurii sau a pozițiilor):** inel de fruct pe ușile din colțul de
sus — banana pe schimbarea profilului (`AppHeader`), kiwi pe `≡` (`ProfileHeader`), papaya pe distribuire
(`ProfileHeader`), mango pe clopoțel (`FeedDrawer`), zmeură pe ieșirea din cont (`FeedDrawer`) — fiecare la
alpha 0,08–0,12; bara de jos are pictograma activă în banană și restul în verde-gri; butoanele primare
(relație, monetizare, portofel, confirmarea fanului, presetările) sunt kiwi cu cerneală de câmp. Conținutul
media nu a fost atins (testul `test-jungle-backdrop.cjs` verifică exact fișierele de media).

**Fundalul (`src/components/JungleBackdrop.tsx`, nou):** un singur strat, culoare uniformă `#02150D`
(`expo-linear-gradient` nu există în proiect), marca `jb-mark-512.png` la 90 % din lățime, opacitate 6–8 %
pe ecrane și 12 % pe login, `memo`, `pointerEvents="none"`, fără stare, efect sau animație. Folosit pe:
login și `login-preview`, Setări, Portofel, Monetizare, meniul profilului, foaia de confirmare, sertar,
lista Mesaje. **Nu** pe video, foto, story, cameră sau vizualizator.

**Rezultat:** `tsc --noEmit` 0 erori; `npm test` exit 0 (2 suite noi: contrast 14 perechi, fundal 3 teste).

## 0.5 Pasul 5 — tokenul se numește JUNGLE (17 octombrie 2026)

**Ce s-a schimbat (doar cuvinte, niciun câmp):**

* `src/lib/pricing.ts`: `CURRENCY_LABEL = 'JUNGLE'` — deci `formatJbc(200)` tipărește `2,00 JUNGLE`, iar
  `formatJbc(2)` tipărește `0,02 JUNGLE`. `CENTS_PER_JBC = 100` și numele funcțiilor rămân aceleași.
* `src/theme/brand.ts`: `BRAND_TICKER = 'JUNGLE'`.
* `src/lib/creatorPricing.ts`: `display_currency` implicit `JUNGLE` (când serverul nu trimite unul).
* `src/screens/WalletScreen.tsx`: „Scrie o sumă între 1 JUNGLE…” și eticheta de accesibilitate
  „Suma de retras în JUNGLE”.
* Presetările erau deja cele cerute (200/300/300 = 0,02/0,03/0,03 JUNGLE și 300/500/500 =
  0,03/0,05/0,05 JUNGLE), deci nu s-a atins nicio valoare.
* `scripts/test-brand.cjs` **pică acum** dacă în `src/` apare un literal vizibil cu `JB` sau `JBc`, sau dacă
  `CURRENCY_LABEL` / `BRAND_TICKER` nu sunt exact `JUNGLE`. Excepțiile sunt doar cele tehnice deja
  documentate (cookie, chei de storage, rute, pachet Android).
* `docs/MONETIZATION-SPEC.md` §3.5: simbol afișat `JUNGLE`, ticker `JUNGLE`, `JBK` doar rezervă; registrul
  rămâne în unități întregi (100 = 1 JUNGLE) și coloanele `*_cents` nu se redenumesc. `docs/REBRAND.md`:
  rândul `BRAND_TICKER` actualizat.
* `test-creator-pricing.cjs`: așteptarea `Confirmă 3,00 JUNGLE` (era `JB`).

**Rezultat:** `tsc --noEmit` 0 erori; `npm test` exit 0; `node scripts/test-brand.cjs` → „ok · no visible
«Nexus» left in src/, no «JB»/«JBc» ticker, and app.json is named Jungle Book”.

**Blocat, nu ghicit:** redenumirea numelor afișate ale conturilor de test („Test Nexus”, „Cont de test
Nexus (Railway preview)”) cere **autentificare** pe fiecare cont prin API-ul public, iar în acest arbore nu
există parole de test (cheile devnet sunt în `docs/.test-wallets.local`, dar ele semnează tranzacții, nu
deschid sesiuni web). Nu s-a încercat nicio parolă ghicită și nu s-a scris niciun secret. De făcut când
proprietarul dă credențialele celor două conturi; pașii sunt în `docs/TEST-DATA.md`.

## 0.6 Pasul 6 — verificare pe telefon (17 octombrie 2026, fără imagini)

Telefon: `adb-b42122b-huYC9y._adb-tls-connect._tcp`, focus `app.nexus.mobile.dev/.MainActivity`
(YouTube era în față; aplicația a fost adusă în prim-plan cu `am start`, fără Home/Back și fără nicio
setare schimbată). Metro răspundea pe `localhost:8081`; bundle-ul vechi a fost înlocuit prin
`adb reverse tcp:8081 tcp:8081` + deep link `nexusdev://expo-development-client/?url=…` — primul dump
arăta încă meniul vechi (`⋯`, „Închide meniul profilului”), al doilea arăta codul nou. Dovada că Metro
servește ultima versiune este chiar eticheta `Schimbă profilul Jungle Book` și meniul nou.

Dump-urile sunt text, în `docs/parity-report/ui-feed.xml`, `ui-profile-own.xml`, `ui-profile-menu.xml`,
`ui-settings.xml`, `ui-monetization.xml`, `ui-wallet.xml`, `ui-drawer.xml`; citirea lor se face cu
`node tools/ui-texts.mjs <fișier>` (unealtă nouă, fără imagini).

| Element | Ce am verificat | Rezultat |
|---|---|---|
| Antet, fără text de versiune | arborele are doar ușa `Jungle Book Home · revino la prima pagină` `[31,193][166,328]` și `Schimbă profilul Jungle Book` `[1080,206][1189,315]`; niciun nod cu „1.11” | **verificat** |
| Bara de jos | `Creează` `[522,2393][698,2502]`, clicabil; restul celor șapte noduri la locurile lor, niciun inel în arbore (marca e imagine, deci nu se poate citi din dump) | **verificat ca poziție și etichetă**; felul în care arată rămâne pentru ochiul proprietarului |
| Profil propriu — rândul de trei | `Editează profilul` `[36,673][540,777]`, `Monetizează profilul` `[560,673][1058,777]`, `Distribuie profilul` `[1079,673][1183,777]` → 194×40 dp, 191×40 dp și 40×40 dp, toate pe același rând (y = 673…777), fără `⋯` | **verificat** |
| Etichete la scara 1.0 | textul `Editează profilul` `[142,700][433,750]` și `Monetizează profilul` `[627,700][990,750]` încape întreg, fără „…” | **verificat** |
| `≡` din profil | nod `Deschide meniul profilului` `[36,181][151,296]` | **verificat** |
| Meniul profilului | exact șase rânduri, în ordine: Portofel, Venituri, Cheltuieli, Notificări, Monetizează profilul, Setări; **fără** Deconectare / Postare nouă / Schimbă profilul | **verificat** |
| Sertarul, doar pe Feed | butonul propriu `Schimbă profilul Jungle Book` deschide sertarul: cinci profile, Postare nouă, Notificări, Banda derulantă, `Ieși din cont` `[845,886][949,990]`, subsol `Jungle Book · Android 0.1.0 · API: Railway` și `build 2a8161d+ · 17 oct. 2026, 21:14 UTC` | **verificat** |
| Setări | comutator `Banda derulantă`, `Despre`: `Android 0.1.0 · API: Railway`, `Server: 1.11`, `Build JS: 2a8161d+ · 17 oct. 2026, 21:14 UTC` | **verificat** |
| Portofel, sume în JUNGLE | `0,00 JUNGLE`, `încasat 0,00 JUNGLE · retras 0,00 JUNGLE`, eticheta `Suma de retras în JUNGLE` | **verificat** |
| Monetizare, sume în JUNGLE | ecranul se deschide, dar ruta F2.c **nu este pe serverul Railway**, deci răspunsul e `not found`, totul e dezactivat și sumele sunt `—` | **blocat de deploy**, nu de cod: se dovedește după ce backend-ul F2.c ajunge pe server (Pasul 7) |
| Login cu marca ca fundal | cere deconectare, iar regula rundei interzice ieșirea din cont | **neverificat** — rămâne pentru proprietar |

**Capturi pentru proprietar** (făcute doar cu `safe-screencap.ps1`, **nu** au fost citite):
`docs/vision/jungle-drawer.jpg`, `jungle-profile-own.jpg`, `jungle-profile-menu.jpg`, `jungle-wallet.jpg`.

**Două lucruri de îndreptat, spuse aici ca să nu se piardă:** (1) când o rută lipsește, portofelul și
monetizarea tipăresc mesajul serverului, `not found`, ca propoziție pentru cititor — ar merita un text
propriu („Ruta nu există pe acest server”); (2) numele de test încă spune „Test Nexus” (vezi §0.5, blocat
pe credențiale).

## 0.7 Backend-ul F2.c pe Railway și runda de meniu/bandă (18 octombrie 2026)

**Deploy aprobat de proprietar, aditiv, doar fișiere din `apps/nexus-web`.** Făcut dintr-un `git worktree`
curat pe `origin/main` (`932d427`), pe o ramură locală `deploy/f2c-pricing`:

| Commit nou pe `main` | Ce aduce | Sursă |
| --- | --- | --- |
| `4a2603c` | ledgerul pur + testele lui (F2) | cherry-pick `860f8ac` |
| `5659b7c` | cele cinci rute F1 peste ledger | cherry-pick `29ee39f` |
| `ca8ad16` | prețul pe acțiune, rutele F2.c | cherry-pick `69b0177` |
| `da692f6` | working tree în LF + `.gitattributes` | `d0a5384`, **necesar**: fără el 36 de teste web pică pe un checkout Windows (contractele citesc sursa cu `\n`) |

Conflicte: doar `HANDOFF.md` și `docs/MONETIZATION-SPEC.md`, șterse pe `main`; le-am lăsat șterse (nu erau
necesare rutelor). `node --test test/*.test.js` în worktree: **790 teste, 790 trecute, 0 picate**.
`node_modules` a fost legat prin junction la copia locală (nu intră în git).

După push, verificat pe `https://nexus-deepsek-production.up.railway.app`:

| Verificare | Rezultat |
| --- | --- |
| `GET /health` | 200 `{"ok":true,"status":"ready"}` |
| `GET /api/creator/pricing` (proprietar, cookie din `docs/.test-sessions.local`) | **200**, `can_edit:true`, `floor_cents:105`, `max_price_cents:100000000` |
| `GET /api/creator/pricing/urailwaytest02cb2b` (cititor) | **200**, `can_edit:false`, `free:true` |
| `GET /api/me` cu aceeași sesiune | 200 |
| `NEXUS_SETTLE_DEMO` | oprit (implicit în `lib/creator-settlement.js`; necitit din shell-ul Railway — nu am acces la el) |

**Rămâne de îndreptat pe server**: `display_currency` este încă `"JB"` în `lib/creator-pricing.js:134`, deci
serverul spune o monedă pe care aplicația o afișează ca `JUNGLE` din `CURRENCY_LABEL`. Schimbarea în
`"JUNGLE"` cere o a doua urcare pe `main` — nefăcută încă.

### 0.7.1 A doua urcare pe `main` — preț pe fiecare acțiune, `JUNGLE`, `monetized` (18 octombrie 2026)

Commit `41dac1f`, aditiv, doar `apps/nexus-web`, din același worktree curat (șters la final cu
`git worktree remove`, fără forțare). Suita web: **797/797** (790 + 7 teste noi).

| Ce s-a schimbat | Unde | Efect |
| --- | --- | --- |
| `display_currency: "JUNGLE"` (era `"JB"`) | `lib/creator-pricing.js` | serverul și aplicația spun aceeași monedă |
| fiecare acțiune are prețul ei; cheie lipsă sau `0` = **gratuit** pentru acea acțiune | `normalizePricingInput`, `repo.setCreatorActionPricing` | pragul se aplică doar valorilor > 0; un produs vechi e pus pe `paused`, nu șters |
| `monetized` pe vizualizarea de preț și pe **fiecare obiect de autor din orice răspuns** | `pricingView`, `lib/creator-monetized.js`, `transport.json`, `repo.monetizedAuthorIds()` | o singură interogare per răspuns, cache 2 s, invalidată la salvare; niciun N+1 |
| `floor_reason` + `floor_basis` | `pricingView` | ecranul poate spune de ce există pragul |

Verificat pe `https://nexus-deepsek-production.up.railway.app` cu sesiunile din `docs/.test-sessions.local`
(`tools/probe-pricing-deploy.mjs`) — contul `urailwaytest01`, salvat apoi **restaurat la gratuit**:

| Verificare | Rezultat |
| --- | --- |
| `GET /health` | 200 `{"ok":true,"status":"ready"}` |
| `GET /api/me` | 200 |
| `GET /api/creator/pricing` (proprietar) | 200, `display_currency:"JUNGLE"`, `floor_cents:105`, `monetized:false` |
| `PUT` `{free:false, prices:{appreciation:105, comment:0}}` | **200**, `monetized:true`, doar aprecierea `chargeable:true`, comentariul și distribuirea `0` |
| `GET /api/creator/pricing/urailwaytest01a20d` (cititor) | 200, `creator.monetized:true` — decoratorul e viu pe server |
| `PUT` `{free:true}` (restaurare) | 200, `monetized:false`; cititorul vede din nou `creator.monetized:false` |

**Revenire**, dacă apare o problemă: `git revert 41dac1f` pe `main` (sau push la `da692f6`), apoi
`/health` și cele patru verificări de mai sus. Nicio migrare de schemă nu a fost făcută.

**Prețurile de 0,02–0,03 JUNGLE nu sunt încă posibile**, din două motive independente de acest deploy:
regula „gazul ≤ 2 % din preț” umflă pragul de 50 de ori (→ 1,05), iar
`creator_support_products.price_cents` are `CHECK(BETWEEN 100 AND …)`, deci nimic sub 1,00 nu poate
fi stocat. Cifrele, formula și tabelul la EGLD 10/20/30/50 € sunt în `docs/PRICING-CALCULUS.md`;
schimbarea economiei așteaptă decizia proprietarului (cursul de referință, 60 % sau 50 %, o
tranzacție per acțiune sau agregare).

**Aplicația, după deploy (commit `3b95223` pe `codex/camera-draft-stability`):** `validateDraft`
acceptă `0` sau câmp gol pe fiecare acțiune și aplică pragul doar valorilor peste 0; ecranul arată
inputul și pentru acțiunile încă gratuite (înainte, o acțiune fără produs nu putea primi preț deloc),
iar sub prag scrie de ce există. `npx tsc --noEmit` → 0, `npm test` (mobil) → exit 0, 12 teste în
`test-creator-pricing.cjs`.

**Soldurile devnet sunt toate zero** (`tools/probe-devnet-balances.mjs`, 18 octombrie 2026): cele cinci
adrese din `docs/.test-wallets.local` au `egld: "0"` și niciun token. Deci **măsurătoarea reală a
gazului și plata fanului pe blockchain nu pot fi făcute încă** — nu există nici token JUNGLE emis,
nici EGLD de devnet pentru gaz. Pasul de plată se construiește cu adaptor simulat, marcat ca atare,
până la alimentarea conturilor.

**Runda de UI, în cod (neinstalată pe telefon):**

- Sertarul (`FeedDrawer`) a fost **șters**; antetul de Feed nu mai are nici marca, nici butonul lui. Meniul
  `≡` are opt rânduri (Postare nouă, Portofel, Venituri, Cheltuieli, Prețurile mele, Notificări, Setări,
  Ieși din cont), chips-urile celor cinci profiluri și piciorul cu versiunea + `build`.
- Banda de profil merge **permanent**, fără comutator (`lib/bandPrefs.ts` șters), la 36 s pe 360 dp
  (era 48 s); un deget o oprește, al doilea o pornește.
- Monetizarea nu mai are presetări și nici „mod avansat”: creatorul scrie cele trei prețuri. Cere o schimbare
  de server pentru 0 pe o acțiune (azi toate trei trebuie peste pragul de 1,05 JUNGLE).
- 404 / 501 / 503 / eroare de rețea: propoziții proprii + buton `Reîncearcă` (`lib/serverErrors.ts`), în
  monetizare și în portofel.
- **Numele de test au fost redenumite** prin API-ul public, cu sesiunile din `docs/.test-sessions.local`:
  cele cinci conturi `urailwaytest*` spun acum „Jungle Book Test 0N", iar bio-ul „Cont de test Jungle Book
  (Railway preview)"; cele cinci `devnet_test_*` nu aveau „Nexus" în text și au rămas neatinse. Tabelul
  întreg este în `docs/TEST-DATA.md` (bloc marcat), scris de `tools/rename-test-accounts.mjs`.
- **Telefonul nu a putut fi folosit pentru verificarea stării**: `adb` și dispozitivul răspund
  (`app.nexus.mobile.dev`, `versionName 0.1.0`, ultima actualizare 17 oct 2026 20:35 — deci APK-ul
  „Jungle Book Dev" construit la 20:04 este cel instalat), dar deep link-ul a adus în față ecranul de
  dezvoltator, iar dump-ul `docs/parity-report/ui-menu-20261018.xml` arată doar „Tools". Nu am apăsat
  Home sau Back și nu declar verificat nimic din ce nu s-a văzut.
- **Neînceput în această rundă**: semnul `$` lângă numele creatorilor plătiți, foaia de plată a fanului
  pentru like/comentariu/distribuire, fluxul real cu `NEXUS_SETTLE_DEMO=1`, tokenul JUNGLE pe devnet și
  investigația celor 15 849 de intenții. Sunt scrise ca pași concreți în `docs/PROMPT-DEEPSEEK.md`.



## 0. Schimbarea de direcție (decizia proprietarului, 17 octombrie 2026)

**Produsul final este aplicația Android nativă (`apps/nexus-mobile`).** Web-ul de pe Railway nu mai este
interfață: nu se mai aliniază nimic la el și nu se mai lucrează pe codul lui de UI. Codul web rămâne în
repository ca sursă de comportament unde lipsește ceva și, mai ales, ca **backend** (API, SQLite, fișiere)
pe Railway — neatins, mai puțin modificările aditive cerute explicit.

Consecințe practice:

* designul se decide în aplicația nativă (`MIGRATION.md` §20–§22), nu prin paritate cu stylesheet-ul;
* `docs/BACKEND-ONLY.md` ține inventarul endpoint-urilor folosite, cerințele Railway și singura modificare
  aditivă propusă (`joined_at`), cu branch separat și teste — **fără push și fără deploy** până la aprobare;
* ciclul de lucru este Metro + Fast Refresh (`docs/DEV-WORKFLOW.md`, `tools/dev-start.ps1`), fără release,
  fără keystore, fără Play Store; „APK NOU necesar” se spune numai când se schimbă ceva nativ.

## 1. Ce e gata

| Lucru | Dovadă / stare |
|---|---|
| Uneltele de imagini: `tools/images/ImageTools.ps1`, `validate-images.ps1`, `to-vision.ps1`, `safe-screencap.ps1` | scrise, rulate, verificare proprie la fiecare scriere |
| Validarea `docs/`: 142 imagini, **1 coruptă** (`docs/screens/01-launch.png`, antet `FF FE 5B 00…` = text UTF-16 scris cu `>`), redenumită `01-launch.png.bad` | rulare 17 oct 2026; nimic șters |
| `docs/vision/`: **141 JPEG** valide, max 900 px lățime, nume plate (`parity-report__feed__x.jpg`), 14.5 MB | `validate-images.ps1 -Path docs\vision` → 141 valide, 0 corupte |
| `.clineignore` blochează `docs/screens/`, `docs/parity-report/`, `docs/web-ref/`, `docs/design-refs/`, `**/*.bad` | fișier în rădăcină |
| `.clinerules` cu regulile de imagini (a–f) și verificările vizuale | fișier în rădăcină |
| Antetul de profil nou, fără copertă (rundă 4) | commit `efc224c`; valori în `theme/social.ts` (`identity`, `relations`) |
| Modelul unificat de relații + `RelationButton` | commit `991a861`; aplicat în profil, feed, prieteni, căutare, live (`0c031ff`) |
| Auditul de relații, decizia owner-ului, datele de test | commit `75c40d9`; `MIGRATION.md` §19, `PARITY-MATRIX.md` §13, `TEST-DATA.md` §8 |
| Teste locale existente | `test-relations.cjs` 20/20 (inventarul static acoperă acum 10 fișiere; **21/21** după testul din 17 oct pe sensul de urmărire din profil), `tsc --noEmit` 0 erori, suitele de profil/ticker/comentarii verzi |
| Butonul de relație pe ultimele trei suprafețe (§19.4 închis) | rând de comentariu (`CommentsSheet`, `viewerId` din `page.viewer_id`), antetul story viewer-ului (`viewerId` din `StoriesAnswer`, trecut și de `ContactCard`), cardul de contact din Mesaje; `fetchStories` cheamă `rememberPayload(page)` — dovadă: `MIGRATION.md` §19.4, `test-relations` 20/20 cu guardul „fără chip pe fața cititorului” |
| Bio/loc/vârstă/handle **o singură dată**: rândul benzii scos din `ProfileScreen` (stilurile `bandRow`/`bandCell` odată cu el) | `tickerItems(profile, counters = true, identity = true)`; `ProfileTicker` rămâne pentru suprafețele fără antet |
| Spațiul dintre antet și bara de file | token nou `identity.paddingBottom` (12) în `theme/social.ts`, folosit de `ProfileHeader.styles.header` |
| Verificarea reparației | `tsc` 0 erori; `test-hero-parity` 6/6, `test-ticker-parity` 13/13 **la data lotului** (azi refuză referința din baseline — §2.4), `test-relations` 21/21, `test-profile-content-parity` 8/8, `test-profile-edit` 9/9, `test-comment-rows` 6/6, `test-comment-time` 2/2 |
| Banda de profil restaurată **nativ** (bio · locație · membru din · vârstă · tip cont), cu buclă pe driver nativ, reduce motion și foaie cu tragere | commit `f412178`; `ProfileBand.tsx`, `lib/profileBand.ts`, `MIGRATION.md` §20; `scripts/test-profile-band.cjs` 12/12 |
| Antetul nu mai tipărește bio/loc/vârstă (o citire, un singur loc) | `ProfileHeader.tsx` fără blocul `about`; test-hero-parity actualizat la decizia nouă |
| Ciclul de dezvoltare: `docs/DEV-WORKFLOW.md` + `tools/dev-start.ps1` + `API: Railway` lângă versiune | commit `f412178`; script rulat pe telefon (Metro pornit, reverse 8081, app în prim-plan, deep link LAN) |
| Ușa notificărilor: clopoțel în `FeedDrawer` → inbox pe cutia `Activitate` (`ActivityCenter`) | commit `f412178`; `MessagesScreen.initialBox`; verificat pe telefon |
| `joined_at` aditiv în payload-ul de profil (necesar pentru „Membru din”) | commit `c430839` (branch `backend/profile-joined-at`) **adus pe `main` ca `5b8be80`** prin cherry-pick + rebase pe `origin/main`, test `test/profile-joined-at.test.js` 2/2 + 14 teste de profil verzi, **deployat pe Railway**; `/health` 200, `/api/profiles/test` are `joined_at`, telefonul tipărește «Membru din septembrie 2026» |
| Banda se mișcă **mereu** (fără `reduce motion` al sistemului), pauză/reluare pe atingere, `ⓘ` de 44 dp pentru foaie, fade lateral | commit `5f61170`; `ProfileBand.tsx`, `lib/bandMotion.ts`, `MIGRATION.md` §20.2; `scripts/test-band-motion.cjs` 9/9 + `test-profile-band` 12/12; verificat pe telefon (§2.3) |
| Comutatorul „Banda derulantă” în sertar (implicit pornit, `nexus-prefs/band.json`) | commit `5f61170`; `lib/bandPrefs.ts`, `FeedDrawer.tsx`; starea se vede în dump ca `android.widget.Switch checked=true` |
| Lotul web/parity rămas necomis, arhivat local | branch **`wip/web-archive`** (commit `ba7bb84`, 43 de fișiere, **fără push**); `main` rămâne curat de ele; diagnosticile noi sunt în `.gitignore` |
| `following_me` în payload-ul de profil, ambele sensuri, inclusiv pe shell-ul blocat | commit `cf2c0a8` pe `main` ca `932d427`; `test/profile-follow-direction.test.js` 7/7 + 14 teste de profil verzi; **deployat** (`/health` 200, `GET /api/profiles/test` are câmpul) |
| Cinci conturi reale de devnet, cu portofel MultiversX generat local | `apps/nexus-web/scripts/devnet-test-accounts.mjs`; adrese publice în `TEST-DATA.md` §12.1, cheile doar în `docs/.test-wallets.local`; serverul primește adresa + o semnătură |
| Cele patru stări care lipseau pe telefon | `apps/nexus-web/scripts/devnet-test-fixtures.mjs`: story `9`, conversația `2` + mesajul `2`, cont privat `03`, comentariul `35`, urmăritorul `05` — add-only, chei de idempotență fixe, recitite la 17 oct |
| Sensul de urmărire pe un cont privat, dovedit | citire ca 05 pe 03 → `visibility=private`, `following_me=true`, fără contoare (`HANDOFF.md` §2.4) |


## 2. Ce lucrez acum

1. Reparația duplicării din antet este **încheiată și verificată** (`MIGRATION.md` §19.2, paragraful „Defect
   reparat”): o citire stă într-un singur loc, sub butoanele antetului — commit `7975ad2`.
2. Sistemul de relații este **încheiat pe toate suprafețele din `MIGRATION.md` §19.4**: profil, feed, prieteni,
   căutare, live **și** rândul de comentariu, story viewer-ul, cardul de contact din Mesaje. Nu mai există
   rând „parțial” în tabel — commit `f3a492a`. Ambele loturi sunt pe `codex/camera-draft-stability`; nu mai e
   nimic de comis din ele.
3. Lint-ul proiectului este **curat** (`eslint src` fără ieșire): cele patru probleme nu erau în
   `MessagesScreen`/`ActivityCenter`, ci două importuri nefolosite în `profileContent.ts` și două
   `set-state-in-effect` în `ProfileEditSheet.tsx` — commit `c7da4f3`. Comis și lotul de navigație rămas
   necomis (avatarul din viewer, rândul creatorului din reel, `openReplyThread`) — commit `25fcbf8`; fără el
   HEAD nu trecea `tsc` (`ProfileWhisperCard` importa `openReplyThread` din `0c031ff`).

### 2.1 Sesiune pe telefon — 17 octombrie 2026

Telefonul: `adb-b42122b-huYC9y._adb-tls-connect._tcp` (Wireless debugging), focus
`app.nexus.mobile.dev/.MainActivity`, cont `test@nexus.ro` pe **preview** (deci conturile sunt
`urailwaytest01..05`, nu cele locale `ana_popescu`…). Toate capturile din `docs/vision/`
(`session-start`, `batch1-*` … `batch5-*`) sunt făcute **numai** cu `safe-screencap.ps1`; niciun input nu a
fost trimis fără verificarea focusului, iar Back/Home de sistem nu au fost atinse.

| Ecran / stare | Ce s-a văzut | Verdict |
|---|---|---|
| Antet profil propriu (`@test`) | nume + handle + lacăt, contoare 2/5/7, **o** bio, **o** linie `Kraków, Polonia · 25 ani`, fără chip pe profilul propriu | verificat pe telefon |
| Antet profil străin (`@urailwaytest01a20d`) | aceleași reguli: o citire per câmp, fără dubluri de bio/loc/vârstă | verificat pe telefon |
| Chip relație: `Urmărește` → `Prieteni` | contorul profilului s-a actualizat (Următori 1→2), eticheta accesibilă poartă numele țintei (`Prieteni · Nexus Test 01 (social)`) | verificat pe telefon |
| Confirmarea „Nu mai urmări” | `RENUNȚĂ` anulează, starea rămâne `Prieteni` | verificat pe telefon |
| Meniul `⋯` | `Mutează contul`, `Blochează contul` | verificat pe telefon |
| Cont blocat | chip `Deblochează contul`; `Mesaj Nexus` dezactivat + „Mesajele sunt oprite cât timp contul este blocat.” | verificat pe telefon |
| Deblocare | chip revine la `Urmărește`; blocarea șterge urmărirea, deblocarea nu o readuce (de notat, nu defect dovedit) | verificat pe telefon |
| Bara de reacții din card | 9 opțiuni; alegerea aplică `Love` imediat, contorul 0→1, popover-ul se închide | verificat pe telefon |
| Rând de comentariu propriu | fără chip (regula cititorului), firele și sortarea (`Relevante`/`Cele mai noi`) se randă | verificat pe telefon |
| Rail-ul de acțiuni din card | reacție / comentarii / repost / salvare / distribuire, cu contoare | verificat pe telefon |
| Story viewer cu chip | **neverificat**: în preview există doar story-ul propriu, iar inelul „Story-ul tău” deschide camera | lipsă date |
| Fișa de contact din Mesaje | **neverificat**: contul nu are conversații („Nicio conversație aici”) | lipsă date |
| Chip pe comentariul altcuiva | **neverificat**: singurul comentariu din feed este al cititorului | lipsă date |
| Cerere la cont privat | **neverificat**: niciun cont privat în date și nicio parolă pentru un al doilea cont | lipsă date |
| Acceptare din liste | **neverificat**: `Cereri` gol | lipsă date |
| `Urmărește înapoi` | **nu se poate afișa**: profilul nu întoarce `following_me` (defectul 9), deși contul era deja în `Următori` | defect cunoscut |

Ce a ieșit la iveală în timpul sesiunii: **săgeata „Înapoi” de pe profilul pushuit nu este desenată și nu
primește tap** (defectul 10). Nodul există în arborele de accesibilitate la `[36,31][151,146]`, ecranul nu
arată nimic în colțul acela (`batch3-state.jpg`, `batch3-back-try.jpg`), iar ieșirea a cerut
`nexus-dev.ps1 -Action reload`. Sesiunea s-a oprit acolo și a continuat de la Acasă, nu prin ghicit.

Un corectiv de unealtă a fost necesar ca sesiunea să poată începe: `safe-screencap.ps1` chema `adb pull` cu
`$ErrorActionPreference = 'Stop'`, iar PowerShell 5.1 transformă progresul pe care adb îl scrie pe **stderr**
într-un `NativeCommandError` — fișierul se trăgea, dar JPEG-ul nu se mai scria. `Invoke-Adb` și pull-ul citesc
acum ieșirea cu preferința oprită o clipă și judecă după codul de ieșire; validarea (antet, decodare completă,
JPEG de 900 px) a rămas neatinsă, iar prima captură a sesiunii (`session-start.jpg`) a trecut prin ea.

**Unde s-a oprit sesiunea.** După ce am scris reparația pentru defectul 10, telefonul a intrat în `Dozing`, iar
`mCurrentFocus` a devenit `NotificationShade`. Conform regulii („fără focusul corect nu se trimite niciun
input”), nu s-a mai trimis nimic: reparația este **compilată și lint-curată, dar neverificată pe telefon**.
Reluarea cere doar deblocarea telefonului și readucerea Nexus Dev în prim-plan; pașii sunt: Prieteni →
Următori → un rând → săgeata „Înapoi” trebuie să fie vizibilă sub ceas și să funcționeze.

### 2.2 Sesiunea a doua pe telefon — 17 octombrie 2026, după schimbarea de direcție

Telefonul s-a trezit cu `input keyevent 224` (fără Home/Back/cortină, fără modificarea setărilor), iar
Nexus Dev a fost readus în prim-plan cu `am start -n app.nexus.mobile.dev/.MainActivity`. Metro a fost
pornit de `tools/dev-start.ps1` și telefonul s-a conectat prin LAN (`http://192.168.1.153:8081`).

| Ce s-a verificat | Rezultat |
|---|---|
| Defectul 10 — săgeata „Înapoi” pe profilul pushuit | **verificat**: nodul `Înapoi` la `[36,181][151,296]` px fizici (sub ceas), tap → revenire în lista `Urmărești` |
| Banda de profil, sub butoane | **verificat**: `Detalii profil: … · Kraków, Polonia · 25 ani · Cont public`, măsurată `y=868–914` px fizici, imediat sub rândul de butoane `y=673–772` |
| Foaia benzii (atingere) | **verificat**: rândurile Descriere / Locație / Vârstă / Tipul contului, plus `🔓 Cont public`; «Membru din» lipsește, pentru că serverul nu trimite încă `joined_at` |
| Închiderea foii prin tragere | **verificat** după ce mânerul a devenit tot capul foii (înainte, gestul nu era prins); se închide și prin atingerea fundalului |
| Mișcarea benzii | **mișcă pe driver nativ**, dar telefonul raportează „reduce motion” activ, deci banda stă pe loc, exact cum cere regula. Cu `reduceMotion` ocolit temporar (editare locală, revenită imediat), două capturi la 0,9 s distanță diferă. **Nu s-a modificat nicio setare a telefonului**; pentru animație în uz normal, proprietarul trebuie să dezactiveze „Remove animations” / să pornească scalele de animație |
| Ușa notificărilor | **verificat**: sertar → `Notificări` → `ACTIVITATE · SOCIAL`, „1 necitite”, „Marchează tot citit”, rând de mesaj, preferințe — încărcate din Railway |

Observație de unealtă: `uiautomator dump --compressed` întoarce uneori doar fundalul modalului (sau 0 noduri)
când o animație tocmai rulează; o a doua rulare după 2 s dă arborele complet. Nu este un defect al
ecranului (defectul 7 din lista veche).

### 2.3 Sesiunea a treia pe telefon — 17 octombrie 2026, banda care se mișcă mereu

Telefonul s-a trezit cu `scripts/nexus-dev.ps1 -Action wake` (ecranul era `OFF`; fără Home/Back/cortină și
fără nicio setare schimbată), Nexus Dev a fost readus în prim-plan cu `monkey -p app.nexus.mobile.dev …`,
iar bundle-ul nou a intrat prin deep link-ul `nexusdev://expo-development-client/?url=…:8081` — Fast
Refresh nu prinsese editările făcute cât timp ecranul era stins (dump-ul arăta încă eticheta veche,
`Detalii profil: …`).

| Ce s-a verificat | Rezultat |
|---|---|
| Banda se mișcă fără nicio setare a telefonului | **verificat**: `uiautomator dump` eșuează cu „could not get idle state” cât timp banda aleargă și reușește imediat după o atingere; două capturi la ~1 s (`band-live-a/b.jpg`) diferă în **15 133 px** în dreptunghiul benzii și **0** în restul ecranului |
| Atingerea = pauză exactă | **verificat**: eticheta devine `… (bandă oprită)`, iar două capturi în pauză (`band-hold-a/b.jpg`) diferă în **0 px** |
| A doua atingere = reluare din același punct | **verificat**: două capturi după reluare (`band-resume-a/b.jpg`) diferă în **15 313 px**; pauză → reluare → pauză după ~0,25 s (`band-p1/p2.jpg`) arată o deplasare de **7 px** (≈ 0,6 s de mers, cât au durat cele două `input tap`), nu un salt la zero |
| `ⓘ` deschide foaia | **verificat**: nod `Detalii profil` la `[1061,837][1176,957]` px = **44,2 × 46,2 dp** (densitate 416), peste fade; atins → foaia cu Descriere / Locație / **Membru din septembrie 2026** / Vârstă / Tipul contului |
| Comutatorul „Banda derulantă” | **verificat**: în sertar, `android.widget.Switch`, `checked=true`; oprit → banda devine text static (0 px între două capturi) și `ⓘ` rămâne; repornit → mișcarea reia din poziția înghețată |
| Subsolul sertarului | **verificat**: `Android 0.1.0 · API: Railway` la `[799,928][1156,966]` px |

Deploy-ul `joined_at` (commit `c430839` adus pe `main` ca `5b8be80`, după rebase pe `origin/main`):
`/health` → 200 `ready`, `GET /api/me` → `@test`, `GET /api/profiles/test?persona=social` → `joined_at`
prezent, iar pe telefon rândul «Membru din septembrie 2026» apare atât în bandă, cât și în foaie.

### 2.4 Sesiunea pe backend — conturi reale de devnet și cele patru stări (17 octombrie 2026)

Telefonul nu a fost atins în această rundă. Tot ce urmează s-a făcut prin API-ul public de pe Railway, cu
`Origin` și `Idempotency-Key`, iar fiecare cifră e o recitire, nu o intenție.

| Ce s-a livrat | Dovadă |
|---|---|
| `following_me` în `GET /api/profiles/:handle`, pe payload-ul normal **și** pe shell-ul blocat | commit `cf2c0a8` (pe `origin/main` ca `932d427`); `apps/nexus-web/test/profile-follow-direction.test.js` 7/7, cele 14 teste de profil verzi; **deployat**: `/health` 200 `ready`, `GET /api/profiles/test` întoarce câmpul |
| Cinci conturi reale de devnet, fiecare cu portofel MultiversX generat local | `apps/nexus-web/scripts/devnet-test-accounts.mjs`; adrese publice în `TEST-DATA.md` §12.1; cheile rămân în `docs/.test-wallets.local` (gitignored), nu ajung la server și nu se tipăresc |
| Cele patru stări care lipseau pe telefon | `apps/nexus-web/scripts/devnet-test-fixtures.mjs`: story `9` (public, 365 de zile), conversația `2` + mesajul `2` de la 02, contul privat `03` (îl urmărește pe `@test`), comentariul `35` de la 04 pe postarea `25`, urmăritorul `05` |
| Sensul de urmărire pe un cont privat | citire ca 05 pe 03: `visibility=private`, fără contoare, `following_me=true`, `is_following=false` |
| Telefonul chiar folosește câmpul | `patchFromProfile` din `lib/relations.ts` îl citește (înainte doar `patchFromPerson` o făcea, deci un profil deschis „rece” nu putea spune `Urmărește înapoi`); `socialTypes.ts` îl tipizează, shell-ul blocat inclusiv; `test-relations.cjs` 21/21 (test nou: rece, blocat, mutual, câmp absent), `tsc --noEmit` curat |

Trei lucruri s-au învățat pe piele în timpul rulării și sunt acum în scripturi:

* mutările autentificate cer **`Origin`** (`lib/api.js`); fără el răspunsul e 403 fără explicație utilă —
  ambele scripturi îl trimit;
* un story `public` într-un profil `followers` **rămâne** nevăzut de străini, fiindcă matricea de
  confidențialitate verifică întâi profilul, apoi resursa (`lib/privacy-matrix.js`) — de aceea 01 face și
  `PATCH /api/persona/social { visibility: "public" }`;
* signup-ul e plafonat la **5 conturi pe oră și pe IP**, exact câte are setul; scriptul se oprește la `429`
  în loc să reîncerce.

Ce **nu** s-a putut face de aici: `POST /auth/email/login` răspunde **403** pentru toate cele cinci conturi
(emailul nu poate fi verificat — `nexus-devnet.test` nu are inbox, iar tokenul de verificare există doar în
email). Conturile trăiesc prin cookie-ul de la signup, cu `maxAge` de 30 de zile; după aceea se creează
altele. Și: **0 EGLD** în fiecare portofel, fiindcă faucet-ul cere browser și captcha (`§9.1`).

Un contract de test rămâne roșu și **nu** e din lotul acesta: `apps/nexus-mobile/scripts/test-ticker-parity.cjs`
refuză referința (`apps/nexus-web/public/profile-ticker.js`) fiindcă baseline-ul nu conține
`PROFILE_TICKER_ROWS` / `PROFILE_TICKER_ACTIONS` / `PROFILE_TICKER_RUN_MIN` — atât testul, cât și fișierul de
referință sunt nemodificate față de `HEAD`, deci e o nepotrivire moștenită, nu o regresie. Celelalte opt
contracte de telefon trec (9/9, 6/6, 2/2, 6/6, 12/12, 8/8, 9/9, 21/21).


### 2.5 Rebrand pe telefon — 17 octombrie 2026 (blocat la instalare: telefonul nu răspunde)

> **Închis în §2.6**: telefonul a răspuns în aceeași zi, APK-ul s-a instalat peste cel vechi, iar marca,
> banda, sertarul și meniul `⋯` au fost verificate pe ecran. Tabelul de mai jos rămâne ca dovadă a ce se
> știa *înainte* de prima atingere a telefonului.

Marca a fost refăcută **transparentă** (fără ramă, fără cerc, fără fundal) și APK-ul a fost construit
o singură dată, cu splash pe `#000000`. Instalarea rămâne blocată: telefonul nu a fost vizibil pentru
adb în două încercări.

**Ce s-a dovedit local** (`aapt2 dump badging` / `dump resources`, `test-brand-assets.cjs`, `tsc`):

| Dovadă | Rezultat |
|---|---|
| pachet | `app.nexus.mobile.dev`, `versionName 0.1.0`, `minSdk 24`, `targetSdk 36` |
| etichetă | `application-label:'Jungle Book Dev'` |
| splash | `color/splashscreen_background` = `#000000` (și `drawable-night-*` identic), `windowSplashScreenAnimatedIcon` = `@drawable/splashscreen_logo` generat din `jb-mark-1024.png`, `imageWidth 200`, `contain` |
| iconițe | `mipmap-*/ic_launcher.webp` + `ic_launcher_foreground` din `jb-icon-*.png`; `drawable/ic_launcher_background.xml` rămâne `@color/iconBackground` `#02150D` |
| APK | `apps/nexus-mobile/builds/nexus-dev-arm64.apk`, 114 714 224 B, 17 oct 2026 20:04, `812 actionable tasks` |
| marcă | `test-brand-assets.cjs`: 13 fișiere, 55,4 % transparent, frânghie 3 px @1024, ceață 2,35 %, sonde 255 la (596,490) și (164,790) |
| cod | `tsc --noEmit` exit 0; `npm test` verde (inclusiv `test:brand-assets`) |

**De ce nu s-a ajuns pe telefon:** `adb devices` gol; `adb connect 192.168.1.184:46783` a trecut de la
refuz la **timeout 10060** (hostul nu răspunde — telefonul doarme, e pe altă rețea sau wireless
debugging-ul s-a oprit); `adb mdns services` gol. Nu s-a atins telefonul, nu s-a trimis niciun input și
nu s-a schimbat nicio setare.

Ce rămâne de verificat, cu ce se așteaptă:

| Ecran | Înainte | După (așteptat) | Stare |
|---|---|---|---|
| Launcher / recents | „Nexus Dev”, iconiță veche | „Jungle Book Dev”, iconița cu J+B din fructe | **APK construit** (`aapt`: label „Jungle Book Dev”), neinstalat |
| Splash | fundal alb implicit | marca în centru pe `#000000`, fără ramă | **APK construit** (fundal `#000000` în `colors.xml`), de văzut pe telefon |
| Login | glif + „NEXUS” | logo mare + „JUNGLE BOOK” + versiunea dedesubt | **doar compilat** (Fast Refresh), de verificat pe telefon |
| Antet feed | wordmark SVG | logo 36 dp în stânga, aceeași ușă spre Feed | **doar compilat**, de verificat |
| Bara de jos | `+` în cercul central | logo transparent, eticheta „Creează” neschimbată | **doar compilat**, de verificat |
| Sertar | fără nume | logo + „Jungle Book” sus; jos „Jungle Book · Android … · API: …” | **doar compilat**, de verificat |
| Camera | „NEXUS” | „JUNGLE BOOK” | **doar compilat**, de verificat |
| Ecrane goale / erori / toast-uri | „Nexus” în câteva texte | „Jungle Book” (20 de fișiere) | **testat unitar** de `test-brand.cjs`, de verificat vizual |
| Accesibilitate | „Schimbă profilul Nexus”, „Nexus Home …” | „Schimbă profilul Jungle Book”, „Jungle Book Home …” | **testat unitar** (`test-brand.cjs` scanează și `accessibilityLabel`) |

`test-brand.cjs` dovedește absența textului vechi în cod, nu felul în care arată ecranul: diferența dintre
„testat unitar” și „verificat pe telefon” rămâne deschisă până la prima sesiune cu telefonul conectat.
Punctul care cere ochiul owner-ului: dacă marca transparentă lasă un halo sau pierde frunze pe fundalul
negru, se ridică raza majorității din `make-assets.ps1` de la 2 la 3 și se rulează din nou `make-assets.mjs`
(restul rămâne determinist).
| Login | glif + „NEXUS” | logo mare + „JUNGLE BOOK” + versiunea dedesubt | **doar compilat** (Fast Refresh), de verificat pe telefon |
| Antet feed | wordmark SVG | logo 36 dp în stânga, aceeași ușă spre Feed | **doar compilat**, de verificat |
| Bara de jos | `+` în cercul central | logo circular, eticheta „Creează” neschimbată | **doar compilat**, de verificat |
| Sertar | fără nume | logo + „Jungle Book” sus; jos „Jungle Book · Android … · API: …” | **doar compilat**, de verificat |
| Camera | „NEXUS” | „JUNGLE BOOK” | **doar compilat**, de verificat |
| Ecrane goale / erori / toast-uri | „Nexus” în câteva texte | „Jungle Book” (20 de fișiere) | **testat unitar** de `test-brand.cjs`, de verificat vizual |
| Accesibilitate | „Schimbă profilul Nexus”, „Nexus Home …” | „Schimbă profilul Jungle Book”, „Jungle Book Home …” | **testat unitar** (`test-brand.cjs` scanează și `accessibilityLabel`) |

`test-brand.cjs` dovedește absența textului vechi în cod, nu felul în care arată ecranul: diferența dintre
„testat unitar” și „verificat pe telefon” rămâne deschisă până la prima sesiune cu telefonul conectat.
### 2.6 Telefonul, în sfârșit conectat — 17 octombrie 2026, seara

Telefonul a fost găsit deja în `adb devices` cu transportul mDNS `adb-b42122b-huYC9y._adb-tls-connect._tcp`
(`mdns services` → `192.168.1.184:36819`), deci nu a fost nevoie de `adb connect`. Cortina era închisă
(`NotificationShade … isOnScreen=false`, `isVisible=false`, `mHasSurface=false`), focusul era `app.nexus.mobile.dev/.MainActivity`,
iar `adb install -r apps/nexus-mobile/builds/nexus-dev-arm64.apk` a răspuns `Success` peste instalarea din
8 octombrie (sesiunea și drafturile rămân).

**Defect găsit la prima deschidere, și reparat:** ecranul de cameră arunca imediat un Render Error —
`Call to function 'AudioPlayer.pause' has been rejected … Cannot use shared object that was already released`
în `<CameraScreen(./camera.tsx)>`. `expo-audio` eliberează obiectul nativ la demontare, iar cleanup-ul apela
totuși `pause()`. Reparat în `lib/audioLifecycle.ts` (+ 5 teste) și folosit în `camera.tsx` / `PostMedia.tsx`,
commit `ffe1feb`. După reload aplicația intră normal în feed.

| Ce s-a verificat pe telefon | Rezultat |
|---|---|
| Instalare peste aplicația existentă | `Success`; `lastUpdateTime` 2026-10-08 → 2026-10-17; `versionName 0.1.0` |
| Focus înainte de fiecare input | `mCurrentFocus=…app.nexus.mobile.dev/app.nexus.mobile.dev.MainActivity`; la un moment dat telefonul a trecut pe altă aplicație (`com.twitter.android`), inputul a fost oprit imediat și aplicația a fost readusă în prim-plan |
| Sertarul | **verificat**: `Jungle Book`, tile-urile Social/Work/Dating/Travel/Market, `Postare nouă`, `Notificări`, `Banda derulantă`, `Ieși din cont`, subsol `Jungle Book · Android 0.1.0 · API: Railway` |
| Marca din antet, numeric | caseta nodului `[31,203][146,318]` = 115×115 px; fundalul din spate `rgb(2,5,3)`; cerneală 6 242 / 13 456 px = **46,4 %** (asset-ul 3x: 44,8 % la 108 px); inel de 3 px în jurul casetei: 1 428 px, **21 px peste +8** (1,5 %), deviație maximă **65** = muchia antialiasată a literei, nu un halo uniform; cele patru colțuri exact `rgb(2,5,3)` → fără ramă, fără pătrat, fără glow; cerneala atinge sus/stânga casetei, cu 18 px liberi jos = umplutura proprie a imaginii (bbox-ul asset-ului 4..103 × 8..99), deci **fără frunze tăiate** |
| Banda ticker | **verificat**: două capturi la 1,6 s distanță diferă (se mișcă); o atingere → două capturi **identice** (pauză); a doua atingere → din nou diferite (reluare); `ⓘ` → foaia `Detalii profil` cu Descriere / Locație / Membru din / Vârstă / Tipul contului |
| F2a — rândul de butoane | **verificat**: `Editează profilul` `[36,673][1064,772]` + `Deschide meniul profilului` `[1084,673][1183,772]`; „Distribuie profilul” nu mai e în rând |
| F2a — meniul `⋯` | **verificat**: foaie cu exact patru rânduri, în ordinea cerută — `Monetizează profilul` `[60,1978][1160,2113]`, `Distribuie profilul` `[60,2128][1160,2264]`, `Portofel` `[60,2279][1160,2414]`, `Setări` `[60,2430][1160,2565]` |
| F2b — Monetizează profilul | **verificat sus**: pre-pornit „Totul gratuit” cu explicația lipsei de endpoint; preseturi `Prietenos 8,00 JB total` (2+3+3) și `Premium 13,00 JB total` (3+5+5); rândurile Apreciere 2,00 / Comentariu 3,00 / Distribuire 3,00 cu `Indisponibil` |
| F2d — Portofel | **deschis, dar serverul nu are încă ruta**: ecranul afișează `not found`, fiindcă `GET /api/creator/ledger` există doar în branch, nu pe Railway. Nu este un defect al ecranului, este dovada că F1 nu e deployat |
| §9.3 | doar rândul 7 (`⋯`) este acoperit, de fapt de F2a. Rândurile 1–6 **nu au fost rulate**: reader-ul de Reels acoperă bara de taburi cu un `Pressable` pe tot ecranul, banda oprește `uiautomator dump` cât timp aleargă, iar sesiunea s-a încheiat înainte de a le relua. Nu se raportează ca verificate |

Două lucruri de unealtă, ca să nu fie redescoperite: `uiautomator dump` întoarce `ERROR: could not get idle state`
cât timp banda aleargă (se atinge banda sau se oprește din sertar comutatorul „Banda derulantă”, apoi dump-ul
reușește), iar un dump eșuat **lasă fișierul vechi** pe telefon — de aceea fiecare citire de mai sus a fost
precedată de un dump reușit în același apel.

### 2.7 Registrul local de acțiuni: cele 15 915 intenții neclasificate (doar pe o copie)

`scripts/db-copy-local.mjs` face o copie consistentă a bazei de dezvoltare (`VACUUM INTO`,
`data/reconcile-copy/nexus.sqlite`), iar `scripts/action-ledger-mark-legacy.mjs` marchează **în loc** rândurile
cu `action_type = 'UNCLASSIFIED_MUTATION'`: devin `LEGACY_ROUTE_UNMAPPED`, clasa rămâne `PRIVATE_ACTION`
(implicitul clasificatorului pentru o rută `/api/` necunoscută) și primesc `legacy_note`. Nu se șterge nimic,
`mutation_requests` rămâne neatins, iar baza vie și Railway nu sunt atinse.

| Rulare | Rezultat |
|---|---|
| reconciliere pe copie, înainte | `MISMATCH`, `unclassified_intent_ids: 15914`, restul 0 |
| marcare | `marked=15915`, `left_unclassified=0` |
| reconciliere pe copie, după | **`PASS`**, toate cele șapte contoare 0, `action_intents: 20529`, `completed_mutations: 1175`, `devnet_actions: 84` |

Pe baza vie reconcilierea rămâne `MISMATCH` — este o condiție a datelor de dezvoltare, nu a codului, și se
închide rulând cele două scripturi pe orice copie proaspătă.



## 3. Pași următori (în ordine)


1. ~~**Aprobarea backend-ului** pentru `joined_at`~~ — **închis 17 oct 2026**: cherry-pick `c430839` → `5b8be80` pe `main`, rebase pe `origin/main`, teste verzi, push, deploy; `/health` 200 și telefonul arată «Membru din septembrie 2026».
2. **Datele de test pentru stările rămase** — **închis pe 17 oct 2026**: cinci conturi reale de devnet (`devnet_test_01`…`05`, portofel generat local) au scris story-ul `9`, conversația `2` + mesajul `2`, contul privat `03` (care îl urmărește pe `@test`), comentariul `35` și urmăritorul `05`. Id-urile, adresele publice și limitele cunoscute sunt în `docs/TEST-DATA.md` §12. Rămân două lucruri care cer telefonul, nu codul: faucet-ul manual (§9.1) și cele șapte verificări din §9.3.
3. **`uiautomator dump` și animația continuă**: cât timp banda aleargă, dump-ul cere idle și **eșuează** (`could not get idle state`); pentru măsurători se atinge banda (pauză), apoi se citește arborele. Capturile: `safe-screencap.ps1`.
4. **„Urmărește înapoi” pe un profil** — **închis pe 17 oct 2026**: `GET /api/profiles/:handle` are acum `following_me` (commit `cf2c0a8`, deployat), pe payload-ul normal **și** pe shell-ul blocat. Telefonul îl citește în `lib/relations.ts` (`patchFromProfile` → `followsMe`), iar `test-relations.cjs` ține cazul: profil deschis „rece”, profil privat blocat, pereche mutuală și payload fără câmp. Dovada pe ecran rămâne captura din §9.3, rândul 4.
5. **Lotul web/parity** — arhivat pe `wip/web-archive` (commit `ba7bb84`), fără push. `main` nu îl conține.
6. **F0 monetizare** — **scris 17 oct 2026**: `docs/MONETIZATION-SPEC.md` (inventarul real: produse `tip`/`membership`, intenții cu split versionat și `CHECK` de conservare, Nexus Pay ca intenție locală, ledger hash-only) și `docs/MONETIZATION-RISKS.md` (14 întrebări, zero decizii).
7. **RISKS #1–#5 și #15–#17** — **răspunse provizoriu pe 17 oct 2026** (`MONETIZATION-RISKS.md` §1.1), valabile doar pe devnet, fiecare cu formula exactă și cu ce anume le-ar schimba: JBc intern ancorat la 1 € doar pentru test, spliturile `CORE_TIP_V1_90_5_3_2` (90/5/3/2) și `CORE_TIP_V2_85_10_3_2` (85/10/3/2), prag minim de preț = cost de settlement / 2 % (105 bani la 2,1 bani/acțiune), fără cash-out, doar payout intern către același creator. Nu sunt decizii de producție: la prima schimbare de gaz sau de curs se recalculează, nu se „ajustează din ochi”.
8. **F1 — backend** — **scris 17 oct 2026**: `apps/nexus-web/lib/creator-ledger.js` (miezul pur: `splitAmount` cu restul cel mai mare, `priceFloorCents`, `assertPriceAllowed`, postare dublă, refund, payout, `totals`, `reconcile`, `deleteAccount`) plus `test/creator-ledger.test.js` pentru I1–I11 — 11/11. **F1.2 scris în aceeași zi**: cele patru tabele din §4.1 în `lib/db.js`, `lib/creator-settlement.js` (aceleași reguli pe SQLite, fiecare scriere într-un `SAVEPOINT`), cele cinci rute din §4.3 montate în `lib/api.js` și clasa `FINANCIAL_ACTION` în `lib/action-ledger.js` — `test/creator-settlement.test.js` 10/10 (I1–I8, payout, plus scenariul identic rulat prin ambele implementări). Total 21/21, `core.test.js` 78/78, `db-migrations` + `p1-m12-pay-creator-node` 12/12. Ce rămâne înainte de F2: o chemare reală prin HTTP (testele cheamă funcțiile, nu serverul) și faptul că `scripts/action-ledger-reconcile.mjs` iese `PASS` doar pe o bază nouă — pe `data/nexus.sqlite` are 15 849 de intenții neclasificate mai vechi (`MONETIZATION-SPEC.md` §4.5). Apoi F2: cele patru suprafețe și meniul `⋯`.
7. **Rebrand „Jungle Book”** — **făcut în cod 17 oct 2026**: `docs/REBRAND.md` ține inventarul (vizibil / tehnic / documentație), `BrandLogo` este singurul încărcător de marcă, `app.json` se numește `Jungle Book Dev`, iar `scripts/test-brand.cjs` pică dacă reapare un text vizibil cu numele vechi. **APK nou construit local**: `apps/nexus-mobile/builds/nexus-dev-arm64.apk` (112 MB, debug, arm64), `aapt dump badging` confirmă `package='app.nexus.mobile.dev'` și `application-label:'Jungle Book Dev'`. Instalarea și verificarea pe telefon **nu s-au făcut**: telefonul nu era vizibil în `adb` (`adb devices` și `adb mdns services` goale), deci §9.3 rămâne neîncepută.
8. **Token și prețuri (decizia de test)** — **scris 17 oct 2026** în `MONETIZATION-SPEC.md` §3.5: `JUNGLE` ca ticker ESDT (3–10 caractere; `JB` nu e valid), simbol afișat `JB`, 2 zecimale, `reference_eur_per_jb = 1` doar pentru test, prețuri 2/3/3 și 3/5/5 JBc, plus `tools/monetization/simulate.mjs`, care citește gazul real de pe devnet și ia cursul ca parametru. Noile invarianți I9–I11 și întrebările #15–#17 (MiCA, gazul, soldul intern) sunt în documente.

9. **F1 prin HTTP real** — **închis pe 17 oct 2026**: `scripts/creator-http-e2e.mjs` (npm `test:creator-http`) pornește serverul pe o bază temporară, cheamă cele cinci rute și trece **21/21**; mutațiile cer `Idempotency-Key` (16–128 caractere sigure), iar `requestCreatorPayout` derivă id-ul din creator + cheie, deci un retry nu poate deveni a doua cerere. Rămâne **deploy-ul**: F1 nu este pe `main`/Railway, deci pe telefon `Portofel` răspunde `not found`. Nu s-a făcut de aici fiindcă cere credențiale Railway (variabile + serviciu) și confirmarea owner-ului; comenzile sigure sunt în `MONETIZATION-SPEC.md` §4.6 (aditiv, steag oprit implicit).
10. **F2a/F2b/F2d** — **făcute pe 17 oct 2026** (`9defc16`): rândul propriu `[Editează profilul][⋯]`, foaia cu `Monetizează profilul` / `Distribuie profilul` / `Portofel` / `Setări`, ecranul de monetizare cu preseturi și produs real, portofelul cu registru și cerere de retragere. Ce lipsește și de ce: prețul pe apreciere/comentariu/distribuire, „Totul gratuit”, modul avansat și plafoanele nu au **nicio rută** — sunt `Indisponibil` cu motivul scris sub ele; foaia de susținere a fanului (`POST /api/creator/support-intents`) și confirmarea cu buget de sesiune rămân de construit, iar butonul de apreciere nu poate afișa un preț pe care serverul nu îl are.
11. **§9.3, rândurile 1–6** — **neîncepute**: reader-ul de Reels acoperă bara de taburi cu un `Pressable` pe tot ecranul, iar banda oprește `uiautomator dump`. Următoarea sesiune: se pornește din `Flux` (nu din `Reels`), se oprește banda din sertar pentru citiri, apoi se reia comutatorul.
12. **Ticker `JUNGLE`** — **închis ca întrebare**: un ticker ocupat nu blochează emiterea (secvență aleatoare de 3 caractere în identificator, `mx-chain-go`), deci nu mai există „indisponibil”. Emiterea așteaptă faucet-ul: toate cele cinci portofele au `0.0000 EGLD`. Comanda e scrisă în `MONETIZATION-SPEC.md` §3.5.


## 4. Defecte deschise

| # | Defect | Unde | Notă |
|---|---|---|---|
| ~~1~~ | ~~bio + loc + vârstă tipărite de două ori~~ | ~~`ProfileHeader.tsx` + `ProfileTicker.tsx`~~ | **reparat 17 oct 2026**: banda nu se mai desenează pe profil; o citire, un singur loc (`MIGRATION.md` §19.2 „Defect reparat”) |
| ~~2~~ | ~~butonul de relație lipsește pe rândurile de comentarii~~ | ~~`CommentRow`/`CommentsSheet`~~ | **reparat 17 oct 2026**: chip compact, `viewerId` din `page.viewer_id`; rândul cititorului rămâne fără chip |
| ~~3~~ | ~~butonul de relație lipsește în story rail/viewer~~ | ~~`StoryRail.tsx`, `StoryViewer.tsx`~~ | **reparat 17 oct 2026** în viewer; railul rămâne fără chip, deliberat (geometria măsurată 98×126 și banda numelui nu încap un al doilea element) — `MIGRATION.md` §19.4 |
| ~~4~~ | ~~butonul de relație lipsește pe rândul de contact din Mesaje~~ | ~~`MessagesScreen.tsx` / `ContactCard.tsx`~~ | **reparat 17 oct 2026**: `participants[].id` era deja în payload; chipul stă între persona și acțiunile rapide |
| ~~5~~ | ~~ecranul de notificări nu este portat~~ | `FeedDrawer`, `MessagesScreen`, `ActivityCenter` | **reparat 17 oct 2026**: clopoțel în sertar → inbox pe cutia `Activitate` (`initialBox`), panoul `ActivityCenter` cu cele cinci endpointuri; verificat pe telefon (`MIGRATION.md` §22) |
| 6 | runda 4 nemăsurată pe telefon | `docs/parity-report/profile-header/` | `00-now.png` era corupt (acum `.bad`); se reface cu `safe-screencap.ps1` |
| ~~7~~ | ~~`uiautomator dump` întoarce 0 noduri pe profil~~ | unealta, nu ecranul | **explicat 17 oct 2026**: dump-ul poate prinde un cadru de animație sau doar fundalul unui modal; o a doua rulare după 2 s dă arborele complet. Nu mai e nevoie de `-ReduceMotion` pentru măsurători |
| ~~8~~ | ~~4 erori ESLint preexistente~~ | `eslint src` | **curat** din `c7da4f3`; reverificat 17 oct după lotul benzii: fără ieșire |
| ~~9~~ | ~~payload-ul de postare **și de profil** nu are `following_me`~~ | server (`socialPostView`, ruta de profil) | **închis 17 oct 2026**: `GET /api/social/relations` are `following_me` pe fiecare persoană, iar de la commit `cf2c0a8` și `GET /api/profiles/:handle` îl are — pe payload-ul normal **și** pe shell-ul blocat (`repo.profileView` / `lockedProfileShell`). `lib/relations.ts` citește fiecare payload în locul lui (`patchFromPerson` vs `patchFromProfile`), fiindcă același nume are sensuri inverse pe cele două rute (vezi #11) |
| ~~10~~ | ~~săgeata „Înapoi” de pe profilul pushuit nu este desenată și nu primește tap~~ | `src/app/profile/[handle].tsx` | **reparat și verificat pe telefon 17 oct 2026**: ruta nu avea `insets.top`; acum `useSafeAreaInsets`. Nodul `Înapoi` măsurat la `[36,181][151,296]` px fizici (sub ceas), tap → revenire în listă |
| 11 | `following_me` are **sens invers** pe două rute, și asta e intenționat | `lib/repo.js` (`listSocialRelations` vs profil / shell blocat) | `GET /api/social/relations` → `following_me` = **eu îl urmăresc** (`repo.js:1929`); `GET /api/profiles/:handle` → `following_me` = **el mă urmărește**. Fiecare e comentat la locul lui, iar clientul le citește separat (`patchFromPerson` vs `patchFromProfile`). Nu se repară o singură parte: o „unificare” atinge ambele rute, `test/profile-follow-direction.test.js`, `test-relations.cjs` și cele două apeluri din app |



## 5. Note despre telefon (verificate, nu presupuse)

- **adb**: `tools/scrcpy/adb.exe` (în repo; folderul e ignorat de git).
  `adb devices` a arătat în această sesiune un singur transport autorizat:
  `adb-b42122b-huYC9y._adb-tls-connect._tcp` (Wireless debugging).
- **mDNS**: `adb mdns services` → `adb-b42122b-huYC9y  _adb-tls-connect._tcp  192.168.1.184:34631`.
  Portul se schimbă după fiecare reconectare; nu se hardcodează.
- **Două intrări posibile**: telefonul poate apărea și cu IP (`192.168.1.184:port`) și cu numele
  mDNS. Întotdeauna se trece `-s <serial>`; `safe-screencap.ps1` alege primul transport autorizat
  și tipărește lista dacă sunt mai multe.
- **Display-uri**: ecranul principal are id-ul SurfaceFlinger **4630946949513469331**; cover-ul are
  alt id. `-d 0` NU este valid. Confirmare: `adb -s <serial> shell dumpsys SurfaceFlinger --display-id`.
- **Focus**: `adb -s <serial> shell dumpsys window | findstr mCurrentFocus` → trebuie să conțină
  `app.nexus.mobile.dev`. Fără focusul corect nu se trimite niciun input.
- **Capturi**: numai `powershell -NoProfile -File tools/images/safe-screencap.ps1 -Name <nume>`
  (screencap pe telefon → `adb pull` → validare → JPEG 900 px în `docs/vision/`).
- **Reguli de siguranță**: fără cortina de notificări, fără Home/Back, fără modificarea setărilor;
  `-ReduceMotion` este singura excepție și își pune singur valorile la loc.
- Rezoluție fizică 1220×2656, DPR 2.6 ⇒ 469×1021 CSS px.

## 6. Lecția despre imagini (de ce există tot acest aparat)

- Capturile făcute cu `adb ... > fisier.png` în PowerShell ies corupte: redirectarea amestecă text
  în fluxul binar. Dovada din acest lot: `docs/screens/01-launch.png` începea cu `FF FE 5B 00 57 00…`
  (BOM UTF-16 + „[War…”, adică text), nu cu `89 50 4E 47`. Windows nu îl putea deschide.
- O imagine invalidă citită **o singură dată** produce eroarea „unsupported image” care rămâne în
  istoricul conversației; fiecare mesaj următor o repetă, iar task-ul se blochează definitiv și
  contextul se pierde. De aceea validarea se face **înainte** de orice citire, nu după.
- Ordinea obligatorie: `validate-images.ps1` → `to-vision.ps1` → se citește **doar** din
  `docs/vision/`, **o imagine pe rând**. Fișierele `.bad` nu se ating.
- Dacă apare totuși eroarea de imagine: se oprește task-ul, se notează aici ce s-a întâmplat și se
  cere un task nou. Nu se încearcă altă imagine în același task.

## 7. Rezultatul testului de imagine

- [x] **Reușit** — modelul citește imagini din `docs/vision/`.
  - `web-ref__feed__drawer-open.jpg` (cea mai mică, 8.3 KB): cadru aproape negru, fără UI vizibil
    (luminozitate medie 18/255, măsurată cu System.Drawing) — captura a prins doar scrim-ul drawer-ului.
  - `screens__w-create.jpg` (900×1959): ecranul de creare, cameră live. Se văd clar: `×` în stânga sus,
    titlul `NEXUS` centrat, coloana din dreapta sus (flash, rotire, dinți, butonul `Cadru`), controlul de
    zoom `− 0,7× +`, pastilele `PHOTO` / `VIDEO`, declanșatorul alb, `Galerie` în stânga jos, `Ultima
    captură` în dreapta jos, bara de sistem Android jos. Textul și pozițiile sunt lizibile la 900 px.
- Concluzie: verificările vizuale se pot face pe imaginile din `docs/vision/`, în continuare **una pe
  rând** și numai după validare.


## 8. Comenzi utile

```powershell
# validare + conversie (după orice captură nouă)
powershell -NoProfile -File tools/images/validate-images.ps1
powershell -NoProfile -File tools/images/to-vision.ps1

# o captură nouă, validă din construcție
powershell -NoProfile -File tools/images/safe-screencap.ps1 -Name profile-header-own

# starea codului
cd C:\Users\Romeo\projects\nexus_deepsek
npm --prefix apps/nexus-mobile run typecheck
node apps/nexus-mobile/scripts/test-relations.cjs
node apps/nexus-mobile/scripts/test-ticker-parity.cjs
```


## 9. Am nevoie de telefon (verificări care nu se pot face de aici)

La 17 octombrie 2026 backend-ul are, în sfârșit, toate datele care lipseau pe telefon (`TEST-DATA.md` §12).
Ce rămâne cere **mâna proprietarului**: un faucet cu captcha și ochii pe ecran. Nimic din lista de mai jos nu
se poate dovedi dintr-un script, iar rezultatul nu se presupune.

### 9.1 Faucet devnet — o singură dată per portofel

Faucet-ul oficial (`https://devnet-wallet.multiversx.com/faucet`) cere browser și captcha, deci nu poate fi
apelat din script. Pentru fiecare rând: deschide pagina, lipește adresa, cere fondurile, așteaptă confirmarea.

| Handle | Adresă publică (devnet) |
|---|---|
| `devnet_test_01` | `erd1t4p9qhmv56xqrp0e069xzeedccfenzsqtgdutd3jcaf3hrlhc3kqnwkccy` |
| `devnet_test_02` | `erd1akj8squ5cutducpdpn74xnflmvr88nyjnu8cdp4re03vmqtmcm5q9g8jt5` |
| `devnet_test_03` | `erd12mf0ux4e2qpp2pzpc46mac0f9lldl5v72c8k5xae5camqyq8py5qsjqvzy` |
| `devnet_test_04` | `erd19xlqghjw2hfwp9pvfjk0s4z2ekr6l72sz9fdstwx2s4e5pzshuksgetvvn` |
| `devnet_test_05` | `erd1puhttlek4cl3dzsegkpk6u2tlz65npq372xu5s5uze5jy0th8ehqv4jgmh` |

Verificarea soldului nu cere nicio cheie și nu creează conturi: o a doua rulare a scriptului de conturi merge
pe sesiunile existente și tipărește soldul fiecăruia (`balanceOf` citește `https://devnet-api.multiversx.com`).

```powershell
node apps/nexus-web/scripts/devnet-test-accounts.mjs   # „already registered … balance=X EGLD” pentru fiecare
```

### 9.2 Pre-check-uri obligatorii înainte de orice input

1. `adb -s <serial> shell dumpsys window | findstr mCurrentFocus` → trebuie să conțină
   `app.nexus.mobile.dev/.MainActivity`. Dacă scrie `NotificationShade` sau ecranul e `Dozing`, se trezește cu
   `scripts/nexus-dev.ps1 -Action wake` (fără Home/Back/cortină) și **nu se trimite niciun input** până nu
   revine focusul.
2. Bundle-ul: `tools/dev-start.ps1` (Metro + `adb reverse`), iar dacă Fast Refresh nu a prins editările, deep
   link-ul `nexusdev://expo-development-client/?url=…:8081`.
3. Capturi: numai `powershell -NoProfile -File tools/images/safe-screencap.ps1 -Name <nume>`, apoi
   `validate-images.ps1` → `to-vision.ps1`, citite **una pe rând** din `docs/vision/`.

### 9.3 Checklist — șapte stări, fiecare cu rezultatul așteptat

| # | Unde | Ce trebuie să se vadă | Date în spate |
|---|---|---|---|
| 1 | Acasă → rail-ul de story-uri | inel nou, `devnet_test_01`, se deschide, text `[test] Story…` pe fundal (story text-only, `fallbackCaption`) | story `9`, `public`, expiră 17 oct 2027 |
| 2 | Postarea 25 a lui `@test` → comentarii | rândul `devnet_test_04` **cu chip de relație** (`Urmărește`) | comentariu `35` |
| 3 | Mesaje | conversația cu `devnet_test_02`, mesaj `[test] Mesaj de verificare…` | conversația `2`, mesajul `2` |
| 4 | Profil `devnet_test_03` (din Urmăritori sau din feed) | shell **blocat** (fără postări, fără contoare) și chip **`Urmărește înapoi`** — 03 îl urmărește pe `@test` | `visibility=private`, `following_me=true` (verificat ca 05) |
| 5 | Același profil, tap pe chip | `Solicitat` (cererea pleacă de la `@test`; 03 e privat) | `POST /api/follow` → 202 |
| 6 | Profil propriu → Urmăritori | lista **nu** mai e goală; `devnet_test_05` apare cu chip | 05 urmărește `@test`, contoare 7/2 |
| 7 | Profil propriu → `⋯` | meniul se deschide și fiecare acțiune face exact ce spune eticheta (lista de acțiuni vine din lotul „meniul de profil”, încă neconstruit) | — (depinde de cod, nu de date) |

Dacă un rând nu apare, verificarea se oprește acolo și se notează în §2 ce s-a văzut: nu se reîncearcă prin
ghicit, nu se schimbă datele și nu se șterge nimic.

### 9.4 Ce se scrie înapoi în fișier

După sesiune: un rând nou în §2.5 cu tabelul de mai sus bifat, numele capturilor (`story-foreign`,
`comment-chip`, `private-shell`, `followers-list`) și orice abatere. `following_me` are două sensuri în cod
(defectul 11) — dacă eticheta iese invers pe ecran, se notează acolo, nu se „repairă” o singură parte.

## 10. Runda 18 octombrie 2026 — politica v3, migrarea CHECK-ului, modelul de autofinanțare

### 10.1 Ce s-a livrat, pe scurt

| # | Pas | Stare | Compilat | Testat unitar | Deployat | Verificat pe blockchain | Verificat pe telefon | Ce cer de la tine |
|---|---|---|---|---|---|---|---|---|
| 1 | `docs/PRICING-CALCULUS.md` rescris: feliile v3 în bps, invarianții, formula, tabelul N×EGLD | **gata** | — | tabelul e verificat de `test/split-policy.test.js` | pe `main` (commit `30fdb7e`) | nu se aplică | nu se aplică | — |
| 2 | `lib/split-policy.js`: feliile, `minimumPriceCents`, refuzul motivat, parametri din mediu | **gata** | da | 9 teste, inclusiv proprietăți 1…1000 | da | nu se aplică | nu se aplică | — |
| 3 | Migrarea `price_cents` (1…100000000), rebuild fără pierderi | **gata** | da | 3 teste: copie a unei baze vechi, crash înainte de commit, `openDb` pe un fișier „deployed” | **da** (dovada: 3 bani acceptat pe Railway) | nu se aplică | nu se aplică | acceptarea migrării (ai cerut-o explicit) |
| 4 | `pricingView`: prag recalculat, motivul, `policy_version`, feliile pe fiecare acțiune | **gata** | da | 30 teste pricing + HTTP | **da** | nu se aplică | nu | — |
| 5 | Self-funding: `lib/self-funding.js` + `tools/monetization/self-funding.mjs` | **gata parțial** | da | 4 teste | nu (unealtă locală) | nu se aplică | nu | **prețurile reale de cost** |
| 6 | `MONETIZATION-SPEC.md` §8, `MONETIZATION-RISKS.md` #18–#23 | **gata** | — | — | pe `main` | nu se aplică | nu se aplică | răspunsuri la #18–#23 |
| 7 | PaidMark, foaia de confirmare, adaptorul simulat, feliile în ecran | **neînceput** | — | — | — | — | — | — |
| 8 | Token JUNGLE + gaz măsurat pe devnet | **blocat** | — | — | — | **nu** | — | EGLD în trezoreria devnet |
| 9 | Telefon (meniu, bandă, Monetizare, `$`, foaie) | **blocat** | — | — | — | — | **nu** | confirmi că ești pe Feed |
| 10 | Registrul local (15 849 intenții) pe o copie | **neînceput** | — | — | — | — | — | — |


### 10.2 Fapte verificate pe deploy (18 oct 2026, `main` = `30fdb7e`)

Sonda `tools/probe-policy-deploy.mjs`, rulată din `nexus_deepsek` (citește sesiunile locale, nu le tipărește):

- `/health` → **200**; `/api/me` → **200**.
- `GET /api/creator/pricing` → `floor_cents: 3`, `floor_reason: "POLICY_V3"`,
  `policy_version: "SPLIT_V3_70_5_4_4_1"`, `floor_basis: { gas_cents: 1, mode: "batched", batch_size: 10,
  egld_eur: 30 }`, `display_currency: "JUNGLE"`.
- `PUT { appreciation: 2 }` → **400** `PRICE_BELOW_SETTLEMENT_COST`, cu mesajul
  „rezerva de infrastructură (0¢) nu acoperă gazul acțiunii (1¢)”.
- `PUT { appreciation: 3, comment: 0 }` → **200**; acțiunea are `price_cents: 3`, `creator_cents: 2`,
  `infra_cents: 1`, celelalte felii 0. **Asta dovedește că migrarea CHECK-ului a rulat pe baza reală**:
  înainte, 3 bani nu putea fi scris deloc.
- Cititorul vede `creator.monetized: true` după salvare; `PUT { free: true }` → 200, iar cititorul vede
  `monetized: false`. Contul de test a fost readus la „gratuit”.

### 10.3 Fapte verificate local

- `node --test` pe fișierele atinse: **56/56** (pricing, settlement, ledger, M12, split-policy, migrare).
- Migrarea pe un fișier vechi: 3 rânduri păstrate (100, 200, 100000000), `foreign_key_check` gol, 1 ban
  acceptat după, 0 și 100000001 refuzate, iar un crash înainte de `COMMIT` lasă tabelul vechi intact.
- `test/self-funding.test.js` confirmă cifra neplăcută: **la 0,03 JUNGLE marja platformei este zero**
  (2 bani creator + 1 ban gaz), deci pragul de rentabilitate nu există la prețul minim.
- Suita web completă, într-un checkout **curat** (`nexus-check`, LF) la commitul deployat `30fdb7e`, cu
  `node_modules` legat: **801 teste, 800 pass, 1 fail** — singurul eșec este `test/wallet-connect.test.js`,
  care pică și pe `main` curat, înainte de schimbările acestei runde. Cele 11 eșecuri văzute în worktree-ul
  `nexus-main` sunt artefacte de CRLF (fișierele au 9 540 de linii CRLF acolo, 0 într-un checkout curat) și
  dispar când fișierele sunt LF.

### 10.4 Presupuneri, spuse ca presupuneri

- Gazul de **500 000** (decontare) și **150 000** (ancorare) este **limită de protocol**, nu măsurătoare.
  Nu există EGLD în conturile de devnet, deci nu s-a putut semna nimic.
- Cursul **30 €/EGLD** este implicitul configurabil, nu o cotă de piață.
- Modelul de autofinanțare folosește Railway 20 €/lună și domeniu 1 €/lună ca **exemplu**; restul
  costurilor sunt „de completat”. Profitul din §7.2 din `PRICING-CALCULUS.md` este un maxim, nu o prognoză.
- Feliile `founder` și `shareholders` sunt conturi contabile; **nu** sunt conturi ledger separate încă
  (schema are patru coloane). Banii se reconstituie din `split_version`; granularitatea lipsește.

### 10.5 Ce nu s-a făcut, și de ce

- **PaidMark și foaia de plată** (pașii 4–5 din brief): neatinse în această rundă. Backendul are acum
  `monetized` și feliile, dar componenta centrală `PaidMark` și foaia de confirmare rămân de scris.
- **Telefonul**: nu l-am deschis. Regulile rămân: numai aplicația, focus verificat, fără
  Home/Back/setări/cortină, doar devnet. Îmi trebuie confirmarea ta că ești pe Feed.
- **Registrul local**: neînceput; se face pe o copie, cu marcaj reversibil.

### 10.6 Decizii care așteaptă un răspuns scris

1. **0,02 JUNGLE**: nu este posibil cu minim 60 % pentru creator și cu infrastructura plătind gazul —
   0,03 este pragul absolut (2 bani creator + 1 ban gaz). Ca să scadă la 0,02 ar trebui coborât
   `min_creator_bps` sub 5000 **și** acceptat ca rezerva să fie zero. Nu am făcut niciuna.
2. **Cursul de referință EGLD/EUR** (acum 30, parametru `NEXUS_EGLD_EUR`).
3. **Lotul de decontare** N (acum 10) și dacă rămâne `batched`; `per_action` urcă pragul la 0,08 la 30 €.
4. **Conturile ledger separate** pentru fondator/acționari/ardere: cere o migrare aditivă
   (`owner_kind` are azi patru valori).

## 11. Runda 18 octombrie 2026 (seara) — xPortal: al doilea ecran imediat, trei cicluri cap-coadă

**Rezultatul, într-o propoziție:** loginul cu xPortal merge acum de trei ori la rând, cu un singur gest al
proprietarului (amprenta), iar al doilea ecran din xPortal („Connection established. Proceed to log in?”)
apare la ~1,2 s după aprobare, fiindcă foaia redeschide singură walletul.

### 11.1 Ce era rupt (trei cauze, nu una)

1. **Chooser-ul de walleturi.** Linkul pornea cu `wc:` gol; pe telefonul de test cinci aplicații declară
   schema `wc:` (xPortal, Binance, KuCoin, MetaMask, Once), deci Android deschidea „Open with” în loc de
   xPortal. `pm resolve-activity` arată că `xportal://wc?uri=…` se rezolvă **direct** la xPortal.
   Fix: `xPortalWalletLinks()` pune `xportal://wc?uri=…` **primul**, apoi `wc:…`, apoi universal link-ul.
2. **Al doilea ecran venea doar la întoarcere.** xPortal aprobă sesiunea pe ecranul lui și rămâne acolo;
   cererea de semnătură NativeAuth ajunge la wallet **doar când e din nou în față**, iar socketul
   aplicației moare cât timp e în fundal (`relay-close code=1006`). Fix: `scheduleReopen()` — pe
   `phase: signature` (și pe `app-active` cu `stage=signature`) foaia redeschide `xportal://wc?uri=…`
   după 1,2 s, **o singură dată per încercare** (`autoReopened`), ca aprobarea să nu poată bucla.
3. **Timeout-urile erau mai scurte decât realitatea.** Latenta măsurată de la deschiderea foii până la
   `signature-received` a fost **184 s** (runda de la 18:07), peste fereastra de 120 s a providerului și
   peste cea de 180 s a paginii. Acum **300 s pe ambele capete**: `wc-client.js` `PROVIDER_TIMEOUT_MS =
   300_000` (bundle reconstruit → `3e5`) și `public/xportal-bridge.js` (`300000`). Commits pe `origin/main`:
   `e6c4b30`, `88b02ba`. Verificat live azi pe Railway: `/xportal-bridge.js` conține `300000` și nu mai
   conține „3 minute”; `/wc-bundle.js` conține `3e5` și nu `120000`. Web: **813/813**.

### 11.2 Cele trei cicluri (dovezi din logcat, prefix `[xportal]`)

| Rundă | Foaia deschisă | Aprobare în xPortal | `auto-reopen` | Al 2-lea ecran | Connect + amprenta | `signature-received` | `token-posted` | Logout |
|---|---|---|---|---|---|---|---|---|
| 1 | 18:34:26 | 18:35:20.926 (`ms=53545`) | 18:35:22.142 | 18:35:23 | 18:35:42 / beep 18:35:44 | 18:36:41.992 (`ms=134614`) | 18:36:42.005 | 18:39:16 |
| 2 | 18:39:31 | 18:39:58.486 (`ms=25791`) | 18:39:59.694 | 18:40:00 | 18:40:16 / beep 18:40:18 | 18:40:32.854 (`ms=60169`) | 18:40:32.861 | 18:41:00 |
| 3 | 18:41:11 | 18:41:33.988 (`ms=21851`) | 18:41:35.187 | 18:41:35 | 18:41:50 / beep 18:41:52 | 18:42:06.811 (`ms=54684`) | 18:42:06.814 | 18:42:37 |

`ms=` este măsurat de la începutul încercării (deschiderea foii). În toate trei rundele semnătura a intrat
**0,20–0,24 s după** `app-active`, adică imediat ce aplicația a revenit în față: `relay connected=true
restarted=true` → `relay-resume` → `signature-received` → `token-received` → `token-posted`.

### 11.3 Ce face acum cititorul (și ce spune foaia)

1. „Conectează xPortal” → foaia pornește pairing-ul și **deschide singură** xPortal (`onMessage`, `pairing`).
2. În xPortal: **Connect**.
3. Revine **o dată** în Jungle Book → foaia redeschide xPortal automat (~1,2 s), cu al doilea ecran.
   Dacă întoarcerea se face **înainte** de orice aprobare (xPortal îngheţat), foaia aşteaptă 10 s şi îl
   redeschide singură o dată (§11.8).
4. În xPortal: **Connect + amprenta**.
5. Revine în Jungle Book → `signature-received` în ~0,2 s, sesiunea se deschide.

Textul foii numește ambele întoarceri (test nou: `textul foii spune ambele întoarceri în Jungle Book`):
„În xPortal: Connect, apoi revii în Jungle Book. xPortal se redeschide singur: Connect + amprenta, apoi
revii în Jungle Book.” După `auto-reopen`, nota din foaie spune: „xPortal e din nou în față: Connect,
amprenta, apoi revii în Jungle Book.”

### 11.4 Ce e verificat pe telefon și ce rămâne presupunere

**Verificat:** cele trei cicluri din §11.2 (logcat + dump-uri); fereastra 2 are `package=com.elrond.maiar.wallet`,
textul „Connection established. Proceed to log in?” și `button-connect`, fără Send/Amount/Transfer/Swap/Stake;
aprobarile au venit pe `xportal://wc?uri=…` fără chooser (logcat: `xportal-opened via=xportal:`); logout-ul
a revenit la `AUTENTIFICARE` de fiecare dată; `/xportal-bridge.js` și `/wc-bundle.js` de pe Railway au
timeout-urile noi.

**Presupunere (nu e implementat):** prima întoarcere ar dispărea cu un **foreground service** care ține
relay-ul viu cât timp xPortal e în față — atunci cererea de semnătură ar pleca imediat și al doilea ecran ar
apărea fără nicio întoarcere. Costul: notificare permanentă + baterie, deci nu s-a făcut. A doua întoarcere
este a walletului (după amprentă), nu a noastră.

### 11.5 Unelte: `uiautomator` se blochează pe ecrane cu animație

Ecranul de profil și foaia xPortal (WebView cu spinner) nu ajung niciodată „idle”: `uiautomator dump` atârnă
până la timeout (30 s). Workaround folosit azi:
- dump în **proces separat** + poll `stat -c %s` pe fișierul de pe telefon, apoi `pull` când are conținut;
- butonul de meniu al profilului: `14 dp + 22 dp` din zona sigură (`socialTokens.identity`) → `(94,293)` pe
  acest telefon (1220×2656, densitate 416 → 2,6 px/dp); rândul „Ieși din cont” se citește din dump-ul meniului;
- „Renunță” din foaie: `26 + 210 + 4 + 22 dp` de la baza ecranului → `y=1975`, `x=610`;
- nu se citesc imagini (regula rundei), deci totul de mai sus vine din arborele de accesibilitate și din logcat.

### 11.6 Railway ca origine implicită

`src/lib/apiOrigin.ts`: `EXPO_PUBLIC_NEXUS_API_URL`, iar în lipsa lui
`https://nexus-deepsek-production.up.railway.app`. Aplicația de pe telefon a rulat toată runda pe această
origine (pagina de punte scrie în xPortal exact `https://nexus-deepsek-production.up.railway.app`).

### 11.7 Fișiere atinse (necomise, în arborele de lucru)

- `apps/nexus-mobile/src/lib/xportalLogin.ts` — `xPortalWalletLinks()`: `xportal://` primul;
- `apps/nexus-mobile/src/components/XPortalSheet.tsx` — `autoReopened` / `reopenTimer` / `cancelReopen` /
  `scheduleReopen`, legate la `phase: signature` și la `app-active` cu `stage=signature`; `unstuckReopened` /
  `unstuckTimer` / `cancelUnstuck` / `scheduleUnstuck` (§11.8); textele de mai sus;
- `apps/nexus-mobile/src/lib/xportalState.ts` — `XPORTAL_WAIT_SECONDS = 300` (§11.8);
- `apps/nexus-mobile/scripts/test-xportal-login.cjs` — ordinea linkurilor + testul de auto-reopen + testul
  textului + testul deblocării + comparația de fereastră cu serverul; **24/24 pass**;
- `apps/nexus-mobile/scripts/test-xportal-state.cjs` — ceasul de 300 s;
- `tsc --noEmit` curat.

### 11.8 Runda a doua: xPortal îngheţat la prima deschidere (raportat de cititor)

Încercarea manuală din 18:49 a arătat în logcat exact ce lipsea:

| Ora | Eveniment | Ce însemna |
|---|---|---|
| 18:49:50.584 | `xportal-opened via=xportal:` | prima fereastră, fără chooser |
| 18:49:54.723 | `app-active stage=pairing` | cititorul a revenit după 4 s: ecranul xPortal era îngheţat |
| 18:50:10.234 | `approved ms=25771` | aprobarea a venit doar după ce a închis xPortal din Recents şi l-a redeschis |
| 18:50:11.443 | `auto-reopen` | a doua fereastră (mecanismul din §11.1, funcţional) |
| 18:50:58.679 | `signature-received ms=74238` | login reuşit, dar cu trei intervenţii manuale |

Două lucruri s-au reparat:

1. **Fereastra telefonului era 120 s** (`xportalState.ts`), în timp ce serverul şi pagina au 300 s. Foaia
   anunţa „nu a confirmat în 2 minute” cât timp cererea era încă vie pe relay (aprobarile măsurate au ajuns
   la 60–184 s). Acum `XPORTAL_WAIT_SECONDS = 300`, iar un test compară direct cu `xportal-bridge.js`
   (`300_000`) şi `wc-client.js` (`PROVIDER_TIMEOUT_MS = 300_000`), ca să nu mai poată diverge.
2. **Redeschidere de deblocare** (`scheduleUnstuck`): dacă cititorul se întoarce în app cu `stage=pairing`
   (nici o aprobare nu a venit, iar xPortal e deschis de cel puţin 5 s) şi **rămâne** aici 10 s, foaia pune
   xPortal din nou în faţă, o singură dată per încercare (`unstuckReopened`), cu nota „xPortal nu a răspuns:
   îl redeschid cu aceeaşi cerere…”. Întoarcerea în xPortal anulează redeschiderea (`AppState` →
   `cancelUnstuck`): cât timp walletul îşi face treaba, nu-i furăm ecranul. Logcat: `unstuck-reopen`.
   Un al doilea intent nu pleacă niciodată către un xPortal pus în faţă cu mai puţin de 4 s în urmă
   (`auto-reopen-skipped`), ca aprobarea şi deblocarea să nu se certe pe acelaşi ecran.

Ce **nu** poate face aplicaţia: să închidă din forţă un xPortal îngheţat (sandbox Android). De aceea nota
spune pasul pe care cititorul l-a făcut manual: închide xPortal din Recents, apoi „Deschide xPortal din nou”.
Pe MIUI cauza obişnuită a îngheţării e restricţia de pornire în fundal; se ridică per aplicaţie din
Setări → Aplicaţii → Autostart şi baterie „Fără restricţii” (pentru Jungle Book **şi** xPortal).

### 11.9 Runda a treia: cererea de semnătură pleca prea târziu (29 octombrie)

Simptomul raportat: după „Conectează xPortal”, walletul se deschidea, aprobarea trecea, iar xPortal
rămânea pe ecranul principal — **niciodată** fereastra de semnătură NativeAuth. Trei cauze, toate
măsurate în logcat (`ReactNativeJS:V`, prefix „xportal”):

| Cauză | Dovada | Reparația |
|---|---|---|
| `reopen` readucea starea la `pairing`, deci foaia nu mai recunoștea etapa `signature` | test de regresie în `test-xportal-state.cjs` | `reopen` păstrează etapa |
| cererea pleca la ~350 ms după `approved`, exact în fereastra în care transportul se restarta la întoarcerea din xPortal | `approved` 08:15:01 → wallet în fundal 08:15:02 → restart 350 ms mai târziu → nici o semnătură | așteptare de așezare (`relayResumedAt` / `waitForRelayAfter` / `APPROVAL_SETTLE_MS = 6000`) |
| **predicatul de așezare greșit**: `relayResumedAt > approvedAt` e fals în cazul sănătos, fiindcă întoarcerea din xPortal precedă aprobarea | 08:42:18.598 `relay-resume` → 08:42:18.754 `approved` → 08:42:24.774 `approval-settled relay=false` → cererea abia la 08:42:25.289, cu walletul deja rece, care nu a mai afișat nimic | `relayReadyAfter()`: socket deschis **acum** sau redeschis după aprobare (`relayConnected` din `RelayWatcher`) |

Ordinea finală, cu `WALLETCONNECT_SIGN_LOGIN_DELAY ≈ 500 ms` și redeschiderea la 1,2 s de la `phase('signature')`:
aprobare → așezare (instant când socketul e viu) → `phase('signature')` (fereastra se re-armează) →
`session` predat providerului → cerere pe relay la +500 ms → xPortal adus în față la +1,2 s **cu** cererea deja pe fir.

Diagnostic nou în logcat: `sign-request`, `sign-request-answered`, `sign-request-failed`,
`approval-settled {relay, open, resumedAfter, ms}`, `sign-request-untraced`, plus `phase('signature')` postat
și din ramura de așezare (`xportal-bridge.js`, lângă `show('Semnează loginul NativeAuth în xPortal.')`).

**Verificat:** `apps/nexus-web/test/wallet-connect.test.js` 25/25 pass (4 teste noi fixează
`relayReadyAfter`, urmărirea liveness-ului socketului, ordinea `phase('signature')` → `return session` și
câmpurile din `approval-settled`); `test-xportal-state.cjs` 13/13; `test-xportal-login.cjs` 24/24;
`node --check public/xportal-bridge.js` curat.

**Neefectuat (blocat, nu presupus reușit):** ciclul pe telefon. Încercarea începută la 08:40 a expirat la
300 s fără `sign-request-answered`, iar la 09:0x telefonul a ieşit complet din adb (`adb devices` gol,
`192.168.1.184` nu răspunde la ping, `adb mdns services` gol) — wireless debugging picat sau telefonul plecat
din rețea. Deci **nu** există dovadă că fereastra de semnătură apare după reparația de la §11.9.

**Următorul pas, pentru o sesiune nouă:**

1. Reconectează telefonul: wireless debugging pornit, apoi `apps/nexus-mobile/scripts/nexus-dev.ps1 -Action connect`
   (endpoint nou) și `-Action reverse` (serverul local e pe `adb reverse`, altfel bridge-ul ia 200 doar întâmplător).
2. `-Action open`, apoi „Conectează xPortal” → aprobare în xPortal → așteptat **`approval-settled relay=true open=true`
   la sub 1 s după `approved`** (`resumedAfter` poate fi `false`, e normal), `sign-request` la +500 ms,
   `auto-reopen`, apoi fereastra de semnătură în xPortal și `sign-request-answered`.
3. Abia după asta: `POST /auth/mvx/native` 200, `/api/me` 200, aplicația în față cu profilul corect, captură nouă
   din `JUNGLE_BOOK_VERIFICATION/final_jpg/` citită și descrisă, apoi `tools/images/validate-images.ps1` pe folder.

**Rămâne neexplicat:** la 08:4x interfața arăta o postare de la `wallet4e8gv6` deși
`files/nexus-session/session.json` fusese șters și `/api/me` răspundea 401 după logout. De verificat dacă
feed-ul servit e din cache (server ori store al aplicației) sau dacă UI-ul randează o stare veche — nu blochează
loginul, dar contrazice „signed out”.


### 11.10 Runda a patra: login complet automat, portofelul nu mai depinde de adresa backendului (29 octombrie)

Obiectivul owner-ului: „Conectează xPortal” → aprobare → semnătură → profil, **fără nicio trecere manuală**
între aplicații, iar mutarea backendului să nu mai strice WalletConnect.

Ce s-a schimbat, și de ce:

1. **Decizia de a pune xPortal în față stă într-un singur loc** (`src/lib/xportalNavigation.ts`, nou):
   `xPortalLaunchDecision({ reason, stage, hasPairing, now, openedAt, autoReopened, unstuckUsed })`, cu
   patru motive (`first-open`, `signature`, `unstuck`, `reader`) și skips explicite (`no-pairing`,
   `finished`, `wallet-in-front`, `already-reopened`, `not-signed-yet`; foaia adaugă `stale-attempt`).
   Foaia nu mai cheamă `openXPortal` din trei locuri: singurul drum e `launchWallet(uri, reason)`, care
   întreabă politica și scrie în trace `xportal-open-skipped { reason, skip }`. Regula care contează:
   **al doilea ecran din xPortal se deschide numai în `signature`** (cererea e pe relay); în `approved`
   walletul ar arăta un ecran gol — exact ce făcea rundele 36–38 să pară eșecuri.
2. **O singură redeschidere per încercare**, la 1,2 s după `phase('signature')`, plus o singură „deblocare”
   la 10 s dacă cititorul rămâne în Jungle Book (xPortal înghețat). Ambele se anulează când cititorul se
   întoarce singur în xPortal, iar garda `pairingRef.current?.uri !== uri` oprește un timer rămas în urmă
   să fure ecranul următoarei încercări.
3. **„Autentificare reușită” are stadiul ei** (`authenticated`, în `src/lib/xportalState.ts`), atins numai
   din `.then`-ul lui `signInWithXPortalToken`. Un `error` târziu din pagină nu-l mai poate anula
   (`finished()` include stadiul), iar `token` nu se afișează ca reușită.
4. **Două origini separate** (`src/lib/bridgeOrigin.ts`: `resolveWalletOrigin`). Backendul stă unde spune
   `EXPO_PUBLIC_NEXUS_API_URL`; pagina portofelului stă unde spune noua `EXPO_PUBLIC_NEXUS_WALLET_URL`
   (sau, fără ea, regula veche: https ca atare, loopback ca atare, LAN → `localhost` prin `adb reverse`).
   O valoare configurată greșit nu e ignorată: `walletOrigin.problem` se afișează în foaie.
5. **Urmă pentru „întoarcerea a fost automată”**: `_layout.tsx` scrie `link-return { route, cold }` din
   `Linking.getInitialURL()` + `addEventListener('url')`, iar foaia scrie `app-background` / `app-active`
   cu stadiul — raportul de pe telefon poate arăta dacă întoarcerea a venit din deep link sau din mână.
6. **Textele**: cinci propoziții, una per stadiu (`Se deschide xPortal…`, `Confirmă conectarea în xPortal`,
   `Pregătim autentificarea…`, `Confirmă semnătura în xPortal`, `Autentificare reușită`), plus fallback-ul
   de întoarcere doar în `signature`. `retry` remontează pagina (`bridgeKey`), deci un pairing nou.

**Dovezi (rulate, cu cod de ieșire):**

| verificare | rezultat |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` (`apps/nexus-mobile`) | **exit 0**, fără erori |
| `npm test` (`apps/nexus-mobile`, 60 suite `node:test`) | **0 fail**; `test-xportal-navigation.cjs` nou 14/14 |
| `node scripts/test-bridge-origin.cjs` | 6/6 (`normalizeWalletOrigin` / `resolveWalletOrigin`) |
| `node scripts/test-xportal-state.cjs` | 16/16 (două teste noi pentru `authenticated`) |
| `node scripts/test-xportal-login.cjs` | 25/25 (aserțiunile mutate pe `launchWallet` și pe propozițiile de stadiu; test nou pentru `xPortalReturnRoute`, fără token în log) |
| `node --test test/wallet-connect.test.js` (`apps/nexus-web`) | 29/29 |

**Neefectuat (blocat, nu presupus reușit):** cele cinci încercări reale pe telefon, cu numărarea trecerilor
manuale, **nu** au fost rulate în această rundă — deci nu există încă dovada „zero treceri manuale”.
Ordinea de verificat rămâne cea din §11.9 pasul 2, cu două linii în plus în logcat: `xportal-open-skipped
{ reason, skip }` (de ce nu s-a deschis) și `auto-reopen` urmat de `app-active` **fără** o trecere manuală
între ele. Pentru loopback, `adb reverse tcp:5000 tcp:5000` trebuie să fie activ înainte de încercare.

**Dovadă pe telefon (rulată):** aplicația a fost repornită cu `am start` pe `app.nexus.mobile.dev`, apoi
capturată cu `scripts/capture-android-screen.ps1 -Name 'xportal-origin-round4-home' -Wake -StrictFocus`
(exit 0, `focusOk=true`, 1220x2656). Imaginea citită arată feed-ul Jungle Book randat normal — card video,
nume autoare și timestamp, „Citește tot”, „Vezi traducerea”, bara de jos cu șapte pictograme — fără redbox,
fără ecran de eroare. Bundle-ul servit de Metro (`/.expo/.virtual-metro-entry.bundle`, 9.132.051 octeți) a
fost căutat cu `Select-String`: `xPortalLaunchDecision`, `resolveWalletOrigin`, `NEXUS_WALLET_URL`,
`xportal-open-skipped` și `link-return` sunt toate prezente, deci telefonul rulează exact codul din acest
packet, nu o versiune veche. `adb reverse --list` arată `tcp:5000` și `tcp:8081` active, iar
`/api/auth-capabilities` răspunde 200 — deci mediul de test e pregătit. Foaia xPortal **nu** a fost deschisă:
montarea ei creează imediat un pairing și ar porni o încercare reală care are nevoie de aprobarea owner-ului
în xPortal, deci pașii 1–5 din §11.9 rămân pentru owner, cu telefonul în mână.

**De reținut la commit:** `apps/nexus-web/public/xportal-timing.js` (modulul din care pagina își ia
`APPROVAL_SETTLE_MS = 6000` / `SIGN_GRACE_MS = 500`) este **încă neversionat** (`git status` → `??`). Dacă se
comite `xportal-bridge.js` fără el, pagina servită nu mai are de unde lua constantele; cele două fișiere se
comit împreună.

