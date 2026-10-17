# HANDOFF — Jungle Book nativ (fost Nexus) (branch `codex/camera-draft-stability`)

Ultima actualizare: **17 octombrie 2026** (banda de profil restaurată nativ + ciclul de dezvoltare + ușa
notificărilor).
Scopul fișierului: o sesiune nouă continuă de aici fără să recitească tot istoricul și fără să
repete greșeala care a blocat task-urile anterioare.

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
