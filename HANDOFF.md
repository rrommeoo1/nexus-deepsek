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
| Teste locale existente | `test-relations.cjs` 20/20, `tsc --noEmit` 0 erori, suitele de profil/ticker/comentarii verzi |

## 2. Ce lucrez acum

1. **Testul final de imagine** (pasul 7): se citește **o singură dată** cea mai mică imagine validă
   din `docs/vision/` — `web-ref__feed__drawer-open.jpg` (8.3 KB, 900×1959). Rezultatul se scrie
   mai jos, în §7, și decide dacă modelul poate face verificări vizuale.
2. **Defectul antetului de profil**: bio, loc și vârsta apar de două ori — o dată sub butoane
   (`ProfileHeader.about`) și o dată în banda `ProfileTicker` (`tickerItems` le pune mereu, doar
   contoarele sunt oprite cu `counters={false}`). Se păstrează o singură apariție, sub butoane,
   conform deciziei owner-ului din `MIGRATION.md` §19.2.

## 3. Pași următori (în ordine)

1. Repară duplicarea din antet: banda primește un comutator pentru identitate (bio/loc/vârstă) și
   `ProfileScreen` îl oprește, la fel cum oprește deja contoarele. Testul `test-ticker-parity.cjs`
   se extinde cu cazul „o singură apariție”.
2. Continuă sistemul de relații acolo unde e marcat **parțial** în `MIGRATION.md` §19.4:
   rândurile de comentarii, story rail/viewer și rândul de contact din Mesaje (are nevoie de
   `user_id`-ul celuilalt participant). Notificările rămân **lipsă** ca ecran.
3. Sesiune pe telefon (una singură, cu lista de stări din `TEST-DATA.md` §8): profil propriu,
   profil public (Urmărește → Urmărești → Nu mai urmări), profil privat (Cere → Solicitat →
   anulare), acceptare din liste, aceeași stare în căutare/feed/live, block + dispariție, deblocare,
   `Mesaj` cu politică restrictivă. Capturile **numai** cu `safe-screencap.ps1`.
4. Măsurători `uiautomator dump --compressed` (px fizici ÷ 2.6) + compozit în
   `docs/parity-report/profile-header/`; apoi notele numerice în `PARITY-MATRIX.md` și
   `parity-report/INDEX.md` (runda 4 este „implementat, nemăsurat”).
5. Regenerează `docs/screens/` doar dacă e nevoie; originalul corupt rămâne `.bad`, nu se rescrie.

## 4. Defecte deschise

| # | Defect | Unde | Notă |
|---|---|---|---|
| 1 | bio + loc + vârstă tipărite de două ori | `ProfileHeader.tsx` (`about`) + `ProfileTicker.tsx` (`tickerItems`) | de reparat acum; aceeași regulă ca la contoare |
| 2 | butonul de relație lipsește pe rândurile de comentarii | `CommentRow`/`CommentsSheet` | `MIGRATION.md` §19.4 „parțial” |
| 3 | butonul de relație lipsește în story rail/viewer | `StoryRail.tsx`, `StoryViewer.tsx` | payload-ul trebuie trecut prin `rememberPayload` |
| 4 | butonul de relație lipsește pe rândul de contact din Mesaje | `MessagesScreen.tsx` / `ContactCard.tsx` | are nevoie de `user_id`-ul celuilalt participant |
| 5 | ecranul de notificări nu este portat | rând „lipsă” în `MIGRATION.md` §0 | nu se inventează |
| 6 | runda 4 nemăsurată pe telefon | `docs/parity-report/profile-header/` | `00-now.png` era corupt (acum `.bad`); se reface cu `safe-screencap.ps1` |
| 7 | `uiautomator dump` întoarce 0 noduri pe profil | banda de ticker se animă continuu | folosește `device-batch.ps1 -ReduceMotion` (pune scalele la loc în `finally`) |
| 8 | 4 erori ESLint preexistente | `ActivityCenter`, `MessagesScreen` | neatinse de loturile curente |
| 9 | payload-ul de postare nu are `following_me` | server (`socialPostView`) | documentat în `MIGRATION.md` §19.3; clientul nu ghicește |


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

- [ ] Reușit — modelul citește imagini din `docs/vision/`.
- [ ] Eșuat — modelul/providerul nu acceptă imagini; verificările vizuale se fac doar numeric și
      prin descrierile owner-ului.

(se completează imediat după citirea celei mai mici imagini valide, o singură dată)

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
