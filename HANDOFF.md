# HANDOFF — Nexus nativ (branch `codex/camera-draft-stability`)

Ultima actualizare: **17 octombrie 2026** (lotul „imagini sigure + antet de profil”).
Scopul fișierului: o sesiune nouă continuă de aici fără să recitească tot istoricul și fără să
repete greșeala care a blocat task-urile anterioare.

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
| Teste locale existente | `test-relations.cjs` 20/20 (inventarul static acoperă acum 10 fișiere), `tsc --noEmit` 0 erori, suitele de profil/ticker/comentarii verzi |
| Butonul de relație pe ultimele trei suprafețe (§19.4 închis) | rând de comentariu (`CommentsSheet`, `viewerId` din `page.viewer_id`), antetul story viewer-ului (`viewerId` din `StoriesAnswer`, trecut și de `ContactCard`), cardul de contact din Mesaje; `fetchStories` cheamă `rememberPayload(page)` — dovadă: `MIGRATION.md` §19.4, `test-relations` 20/20 cu guardul „fără chip pe fața cititorului” |
| Bio/loc/vârstă/handle **o singură dată**: rândul benzii scos din `ProfileScreen` (stilurile `bandRow`/`bandCell` odată cu el) | `tickerItems(profile, counters = true, identity = true)`; `ProfileTicker` rămâne pentru suprafețele fără antet |
| Spațiul dintre antet și bara de file | token nou `identity.paddingBottom` (12) în `theme/social.ts`, folosit de `ProfileHeader.styles.header` |
| Verificarea reparației | `tsc` 0 erori; `test-hero-parity` 6/6, `test-ticker-parity` 13/13, `test-relations` 20/20, `test-profile-content-parity` 8/8, `test-profile-edit` 9/9, `test-comment-rows` 6/6, `test-comment-time` 2/2 |

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

## 3. Pași următori (în ordine)

1. Ecranul de notificări (rândul „lipsă” din `MIGRATION.md` §0) — singurul ecran neportat. Nu se inventează
   structura: se citește din `docs/web-ref/` înainte de orice desen.
2. Sesiune pe telefon: prima rundă este făcută (§2.1). Rămân stările care cer **date**, nu cod: story viewer
   cu chip, fișa de contact, chip pe comentariul altcuiva, cerere la cont privat, acceptare din liste. Se pot
   face fie pe seed-ul local (`TEST-DATA.md` §4: cele cinci conturi `ana_popescu`… plus 4 conversații), fie pe
   preview după ce se creează o conversație și un cont privat. Capturile **numai** cu `safe-screencap.ps1`.
3. Măsurători `uiautomator dump --compressed` (px fizici ÷ 2.6) + compozit în
   `docs/parity-report/profile-header/`; apoi notele numerice în `PARITY-MATRIX.md` și
   `parity-report/INDEX.md` (runda 4 este „implementat, nemăsurat”).
4. Regenerează `docs/screens/` doar dacă e nevoie; originalul corupt rămâne `.bad`, nu se rescrie.

## 4. Defecte deschise

| # | Defect | Unde | Notă |
|---|---|---|---|
| ~~1~~ | ~~bio + loc + vârstă tipărite de două ori~~ | ~~`ProfileHeader.tsx` + `ProfileTicker.tsx`~~ | **reparat 17 oct 2026**: banda nu se mai desenează pe profil; o citire, un singur loc (`MIGRATION.md` §19.2 „Defect reparat”) |
| ~~2~~ | ~~butonul de relație lipsește pe rândurile de comentarii~~ | ~~`CommentRow`/`CommentsSheet`~~ | **reparat 17 oct 2026**: chip compact, `viewerId` din `page.viewer_id`; rândul cititorului rămâne fără chip |
| ~~3~~ | ~~butonul de relație lipsește în story rail/viewer~~ | ~~`StoryRail.tsx`, `StoryViewer.tsx`~~ | **reparat 17 oct 2026** în viewer; railul rămâne fără chip, deliberat (geometria măsurată 98×126 și banda numelui nu încap un al doilea element) — `MIGRATION.md` §19.4 |
| ~~4~~ | ~~butonul de relație lipsește pe rândul de contact din Mesaje~~ | ~~`MessagesScreen.tsx` / `ContactCard.tsx`~~ | **reparat 17 oct 2026**: `participants[].id` era deja în payload; chipul stă între persona și acțiunile rapide |
| 5 | ecranul de notificări nu este portat | rând „lipsă” în `MIGRATION.md` §0 | nu se inventează |
| 6 | runda 4 nemăsurată pe telefon | `docs/parity-report/profile-header/` | `00-now.png` era corupt (acum `.bad`); se reface cu `safe-screencap.ps1` |
| 7 | `uiautomator dump` întoarce 0 noduri pe profil | banda de ticker se animă continuu | folosește `device-batch.ps1 -ReduceMotion` (pune scalele la loc în `finally`) |
| 8 | 4 erori ESLint preexistente | `ActivityCenter`, `MessagesScreen` | neatinse de loturile curente |
| 9 | payload-ul de postare **și de profil** nu are `following_me` | server (`socialPostView`, ruta de profil) | documentat în `MIGRATION.md` §19.3; verificat 17 oct pe telefon: un cont deja în `Următori` apare cu chipul `Urmărește`, nu `Urmărește înapoi`. Clientul nu ghicește |
| 10 | săgeata „Înapoi” de pe profilul pushuit nu este desenată și nu primește tap | `src/app/profile/[handle].tsx` | găsit 17 oct pe telefon: nodul `Înapoi` există în arborele de accesibilitate la `[36,31][151,146]`, dar colțul e gol și tap-ul nu face nimic; ieșirea a cerut `-Action reload`. Dovezi: `batch3-state.jpg`, `batch3-back-try.jpg` |


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
