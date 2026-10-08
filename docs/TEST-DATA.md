# Setul de date de test (Nexus: local și preview)

> Scop: un set **realist, determinist și offline** de conturi și conținut, ca
> ecranele native (Feed, Profil, Mesaje, Notificări, Viewere) să poată fi
> comparate cu referința web pe date reale, nu pe stări goale. Totul este scris
> prin stratul real de repository (`apps/nexus-web/lib/repo.js`), deci datele
> respectă aceleași reguli de vizibilitate, media și moderare ca ale unui om.

Nu conține **nicio parolă**: parola conturilor de test vine doar din variabila de
mediu `NEXUS_TEST_ACCOUNT_PASSWORD` (minim 8 caractere) și nu este scrisă în
fișiere comise, în loguri sau în baza de date în clar (doar hash-ul).

## 1. Contul cu care te autentifici

| email | handle | parolă | portofel |
|---|---|---|---|
| `test@nexus.ro` | `test` | din `NEXUS_TEST_ACCOUNT_PASSWORD` | nu are |

Contul este Viewer-ul: toate notificările, conversațiile și feed-ul de mai jos sunt
ale lui. Se creează cu `npm run dev:test-account` (idempotent, fără rețea, fără
portofel). Pe deployment-ul de preview se creează singur, tot din aceeași
variabilă (`lib/preview-test-account.js`).

## 2. Cele cinci conturi de test

| handle | nume | bio (scurtă) | oraș |
|---|---|---|---|
| `ana_popescu` | Ana Popescu | Fotograf de stradă | București |
| `mihai_ionescu` | Mihai Ionescu | Alergat & cafea | Cluj-Napoca |
| `elena_vasilescu` | Elena Vasilescu | Design & tipografie | Iași |
| `andrei_stan` | Andrei Stan | Chitară & vinil | Timișoara |
| `sorina_marin` | Sorina Marin | Film documentar 16mm | Constanța |

Fiecare cont are email `<handle>@nexus.test` **verificat**, onboarding încheiat,
personaele `social` și `work` publice, avatar și copertă generate, și parola din
`NEXUS_TEST_ACCOUNT_PASSWORD` (deci te poți autentifica și ca oricare dintre ele).
Contul de autentificare `test` **nu** este atins de acest seed: parola lui rămâne
cea dată de `npm run dev:test-account`. Niciun cont nu are portofel.

## 3. Ce conține setul

- **Graf**: fiecare cont de test îl urmărește pe `test`; `test` urmărește patru
  dintre ele, iar `sorina_marin` rămâne neurmărită (ca să existe un profil cu
  buton „Urmărește"). Trei cupluri sunt **reciproce** („prieteni"): `ana↔mihai`,
  `elena↔andrei`, `mihai↔sorina`.
- **Postări (14)**: 5 fotografii, 6 Tweet-uri (text fără media) și 3 **Reels**
  (video), plus 2 postări ale lui `test`. Toate publice, în română.
- **Stories (6)**: câte una pentru fiecare cont + una a lui `test`, publice,
  valabile 24 de ore de la seed.
- **Comentarii (6)**: trei fire, fiecare cu comentariu + răspuns, pe fotografii și
  Reels.
- **Reacții (5)**: `LIKE`, `LOVE`, `WOW` de la conturi diferite.
- **Conversații (4)**: trei directe (`test` cu Ana, Mihai, Sorina) și un grup
  „Weekend în Delta" (12 mesaje în total, cu expeditori alternați).
- **Notificări (6)**: câte una pe tip — `follow`, `reaction`, `comment`, `story`,
  `mention`, `message` — toate necitite, ca badge-ul de necitite să aibă sens.

## 4. Cum se rulează

```powershell
# 0. o singură dată per mașină: parola de test în mediu (nu în fișiere)
$env:NEXUS_TEST_ACCOUNT_PASSWORD = '...'

cd apps/nexus-web
node scripts/dev-test-account.mjs          # creează contul test@nexus.ro
npm run dev:fixtures -- --confirm-local-db # creează cele 5 conturi + conținutul
```

Opțional, pentru Reels cu video real:

```powershell
npm run dev:fixtures -- --confirm-local-db --clip C:\clips\clip1.mp4 --clip C:\clips\clip2.mp4
```

Limitele de siguranță ale comenzii:

- refuză să ruleze când `NODE_ENV=production`;
- cere explicit `--confirm-local-db` (scrie conturi și conținut în baza locală);
- scrie **doar** în `data/nexus.sqlite` și în store-ul media local
  (`data/media/`), respectând `NEXUS_DATA_DIR` dacă este setat;
- **zero trafic de rețea** și **zero portofel**.

## 5. Media: de unde vine fiecare obiect

| obiect | sursă | observație |
|---|---|---|
| avatare, coperte, fotografii, stories | PNG generat **determinist** (gradient din `seed`, encoder propriu cu `zlib`) | nu sunt fotografii: sunt **placeholdere** care trec totuși prin pipeline-ul real de media (semnătură magică, scan, politică de livrare). Aceleași seed-uri ⇒ aceiași octeți ⇒ aceleași hash-uri |
| Reels (video) | `--clip <cale>` pentru fiecare clip dat, apoi **refolosire** dintr-un obiect video deja validat local | un clip nu poate fi inventat, deci nu este fabricat niciodată. Fără `--clip` și fără niciun video local, postarea Reel rămâne **fără media** (stare validă de feed), iar scriptul o raportează explicit |

Fiecare obiect generat primește o linie de proveniență în `content_sources` cu
`ingest_marker = 'social_fixture'`, `provider = 'fixture'`,
`source_url = 'nexus-fixture://<handle>/<cheie>'` și licență `CC0`. Consecințe:

- **idempotent**: o a doua rulare nu duplică linia (cheia este `source_url`);
- **curățabil**: `content-unseed.mjs` poate elimina conținutul pentru utilizatorul
  vizat, pentru că postările/stories sunt legate de media prin `content_sources`.

## 6. Ce este garantat idempotent

Cheile naturale sunt folosite ca atare, fără tabel de evidență suplimentar:

| entitate | cheie | a doua rulare |
|---|---|---|
| cont | `handle` | actualizează parola/emailul/personaele, nu creează al doilea cont |
| urmărire | `(follower, followee, persona)` | `INSERT OR IGNORE` |
| postare | `(user_id, caption, kind)` | nu creează un duplicat |
| story | `(user_id, caption)` | nu creează un duplicat |
| comentariu | `(post_id, user_id, body)` | nu creează un duplicat |
| mesaj | `client_nonce = fixture:<conversation>:<index>` | rejucare controlată de repository |
| media | `hash` (conținut adresabil) | același obiect, aceeași linie de proveniență |
| notificare | `(user, persona, type, body redactat)` | nu creează un duplicat |

## 7. Limitări cunoscute (declarate, nu ascunse)

- **Fotografiile și stories sunt placeholdere** (gradient), nu imagini reale.
  Pentru geometrie și culori ale *interfeței* sunt suficiente; pentru comparații
  pixel-cu-pixel pe conținut nu sunt.
- **Audio pe Reels nu este inclus**: `repo.createPost` expune `audio_attribution`
  doar pentru un manifest de Creator Studio verificat, care presupune un obiect
  audio real; nu este fabricat aici. Atribuirea „♫ …" rămâne un element deschis.
- **Notificările `reaction`/`comment`/`follow`/`story`/`mention` sunt scrise direct**
  prin `repo.notify`; serverul însuși emite doar `message`/`security`/`system`
  (`lib/api.js`). Sunt date de test pentru ecranul de notificări, nu o simulare a
  unui flux de server inexistent.
- **Fără portofel** pentru niciun cont (acțiunile care cer portofel rămân gate).
- Corpusurile sunt **în română**, deliberat: referința web este în română, iar
  diferențele de wrap trebuie să apară la aceeași limbă.

## 8. Dovada rulării (offline, pe o bază aruncabilă)

Rulat pe `NEXUS_DATA_DIR` temporar, fără rețea:

```
[test-account] creat: @test (id 1) <test@nexus.ro>
[fixtures] conturi: 5 actualizate + @test
[fixtures] graf: 9 urmăriri, 3 cupluri reciproce (prieteni)
[fixtures] postări: 14 noi, 0 deja existente
[fixtures] stories: 6 | comentarii: 6 | reacții: 5 | conversații: 4 (12 mesaje) | notificări: 6
[fixtures] stare finală: {"feed":14,"feed_with_media":5,"stories":6,"conversations":4,"unread_notifications":6,
 "new_this_run":{"accounts":5,"avatars":6,"media":23,"follows":9,"mutual":3,"posts":14,"stories":6,
 "comments":6,"reactions":5,"conversations":4,"messages":12,"notifications":6,"reused_clips":0,"skipped":0}}
```

A doua rulare, pe aceeași bază (verificarea este **starea finală**, nu munca depusă,
deci o rulare idempotentă nu este raportată ca eșec):

```
[fixtures] postări: 0 noi, 14 deja existente
[fixtures] stare finală: {"feed":14,"feed_with_media":8,"stories":6,"conversations":4,"unread_notifications":6,
 "new_this_run":{"accounts":0,"avatars":6,"media":0,"follows":9,"mutual":3,"posts":0,"stories":0,
 "comments":0,"reactions":5,"conversations":4,"messages":12,"notifications":0,"reused_clips":0,"skipped":26}}
```

Ambele rulări ies cu cod **0**; `content_sources` cu marker `social_fixture`
rămâne stabil la 23.

Citiri verificate prin repository pe aceeași bază (viewer `test`):

| citire | rezultat |
|---|---|
| `listSocialFeed(owner)` | 14 postări, 6 autori, 5 fotografii / 6 text / 3 video, toate cu avatar |
| `listActiveStories(owner)` | 6 stories, 6 nevăzute, toate cu media |
| `listUnifiedConversations(owner)` | 4 conversații, 7 mesaje necitite |
| `listNotifications(owner)` | 6 notificări necitite, tipurile `comment, follow, mention, message, reaction, story` |
| `readMedia(hash, ext)` | obiectul există pe disc și trece verificarea de integritate a hash-ului |
| `content_sources` cu marker `social_fixture` | 23 (stabil între rulări) |

Cu `--clip` dat, cele 3 Reels au primit media (clipul este stocat o dată și
refolosit), iar `media_upload_grants` conținea 8 acorduri `social_post`.

## 9. Legătura cu restul lucrării

- `apps/nexus-web/lib/social-fixtures.js` — planul de date + funcția de seed
  (`seedSocialFixtures`), importabilă și dintr-un test.
- `apps/nexus-web/scripts/dev-social-fixtures.mjs` — CLI-ul (`npm run dev:fixtures`).
- `apps/nexus-web/scripts/dev-test-account.mjs` — contul de autentificare.
- `apps/nexus-web/scripts/seed-preview-test-data.mjs` — seed-ul de preview prin API-ul public (§10).
- `docs/PARITY-MATRIX.md` — matricea de paritate; comparația de geometrie/culori
  se face pe `docs/web-ref/<ecran>/*.dom.json`, **nu** pe PNG-uri.

## 10. Seed pe deployment-ul de preview (Railway, doar prin API-ul public)

Secțiunile 1–9 descriu setul **local** (`npm run dev:fixtures`, prin `lib/repo.js`). Această
secțiune descrie setul **de pe deployment-ul public**, scris exclusiv prin API-ul public (fără
acces la bază, fără modificări de configurație): `https://nexus-deepsek-production.up.railway.app`.

Scopul este verificarea pe dispozitiv: ecranele native (Feed, Profil, Stories, Mesaje,
Notificări, Viewere) primesc date reale de la serverul real, nu stări goale.

### 10.1 Cum se rulează

```powershell
cd apps/nexus-web

# 0. verifică primitivele locale (fără rețea): PNG, plan de părți, cookie de sesiune
node scripts/seed-preview-test-data.mjs --self-test

# 1. verifică ținta fără să creeze nimic (Origin, /health, mod preview pentru sign-up)
node scripts/seed-preview-test-data.mjs --preflight --target=nexus-deepsek-production.up.railway.app

# 2. seed-ul propriu-zis (creează 5 conturi + conținut)
node scripts/seed-preview-test-data.mjs --target=nexus-deepsek-production.up.railway.app --confirm

# 3. reluare fără signup, cu sesiunile salvate (a doua rulare și următoarele)
node scripts/seed-preview-test-data.mjs --target=nexus-deepsek-production.up.railway.app --confirm --resume
```

Comanda este **fail-fast**: primul răspuns neașteptat oprește rularea (fără reîncercări), păstrează
ce s-a scris deja și raportează. Endpoint-ul public de înscriere permite **5 conturi pe oră per IP**,
deci o rulare completă *este* acel buget: `--resume` există exact ca să nu fie cheltuit a doua oară.

### 10.2 Cele cinci conturi (preview)

| handle | user_id | email | nume afișat | personae |
|---|---|---|---|---|
| `urailwaytest01a20d` | 2 | `railway-test-01@nexus.test` | Nexus Test 01 | social |
| `urailwaytest02cb2b` | 3 | `railway-test-02@nexus.test` | Nexus Test 02 | social |
| `urailwaytest03850c` | 4 | `railway-test-03@nexus.test` | Nexus Test 03 | social |
| `urailwaytest043941` | 5 | `railway-test-04@nexus.test` | Nexus Test 04 | social |
| `urailwaytest05313a` | 6 | `railway-test-05@nexus.test` | Nexus Test 05 | social |

Fiecare cont s-a înscris prin `/auth/email/signup` (deci are identitatea de portofel cerută la
înscriere: adresă MultiversX + cheie, în fișierul de secrete) și are:
profil social **public**, bio `[test] Cont de test Nexus (Railway preview). Fără valoare.`,
1 fotografie sau 1 clip + 1 Tweet public, 1 story publică, 5 urmăriri (vezi 10.6).

### 10.3 Inventarul exact (id-uri canonice)

| cont | postare foto/clip | Tweet | story |
|---|---|---|---|
| `urailwaytest01a20d` | **14** (image, PNG 720×720 generat local) | **15** | **4** |
| `urailwaytest02cb2b` | **16** (video, Wikimedia Commons, CC BY-SA 4.0) | **17** | **5** |
| `urailwaytest03850c` | **18** (image, PNG generat local) | **19** | **6** |
| `urailwaytest043941` | **20** (video, Wikimedia Commons, CC BY 3.0) | **21** | **7** |
| `urailwaytest05313a` | **22** (image, PNG generat local) | **23** | **8** |

Toate postările au `visibility: public`, limbă `ro`, `provenance: NOT_DECLARED` și caption-ul
marcat `[test] … Cont de test Nexus (Railway preview). Fără valoare.`; clipurile poartă în caption
sursa, autorul și licența. Story-urile au `duration_hours: 168` (7 zile) — expiră **2026-10-14,
~11:38 UTC**. Fotografiile/story-urile sunt PNG-uri generate local (gradient, fără terți), deci
fără obligații de licență; clipurile sunt singurele materiale de la terți și sunt liber licențiate.

**Duplicatе cunoscute (de la o rulare mai veche, azi ~11:34 UTC).** Postările **6–13** și story-urile
**1–3** sunt ale acelorași conturi, cu exact aceleași caption-uri: provin dintr-o primă încercare a
acestui script făcută înainte de schema deterministă de `Idempotency-Key`, când o rerulare a fost
tratată de server ca o mutație nouă. Per cont: `6+7`, `8+9`, `10+11`, `12+13` (postări) și `1`, `2`,
`3` (story-uri); `@urailwaytest05313a` nu are duplicate. **Nu s-a șters nimic** (ștergerea cere
aprobare); efectul este doar vizual (postări în plus în feed și în grila profilului).

### 10.4 Comentarii (7)

| comentariu | autor | pe postarea |
|---|---|---|
| **12** | `urailwaytest01a20d` | **5** (a lui `test`) |
| **13** | `urailwaytest03850c` | **5** (a lui `test`) |
| **7** | `urailwaytest01a20d` | 16 (`urailwaytest02cb2b`) |
| **8** | `urailwaytest02cb2b` | 18 (`urailwaytest03850c`) |
| **9** | `urailwaytest03850c` | 20 (`urailwaytest043941`) |
| **10** | `urailwaytest043941` | 22 (`urailwaytest05313a`) |
| **11** | `urailwaytest05313a` | 14 (`urailwaytest01a20d`) |

Două comentarii ajung direct pe postarea cea mai nouă a lui `test` (post 5, „Verificare nativa…") —
deci comentariile se văd pe propriul conținut, nu doar pe al conturilor de test; cinci formează un
inel, fiecare cont comentând postarea cu media a următorului.

### 10.5 Conversație și mesaj (1 + 1)

- conversație `id=1`: `urailwaytest01a20d` → `test`;
- mesaj `id=1`, **text simplu** (fără E2EE): „[test] Mesaj simplu de verificare de la
  @urailwaytest01a20d către @test. …".

Expeditorul îl urmărește pe `test`, deci firul este permis, iar `test` îl vede în inbox ca mesaj
necitit și primește o notificare de tip `message` (serverul emite notificarea la trimiterea
mesajului, `lib/api.js` → `notifyWithInvalidation(..., "message", …)`).

### 10.6 Ce vede `test@nexus.ro` (verificat pe deployment)

| ecran | ce apare | citirea folosită ca dovadă |
|---|---|---|
| Profilurile celor 5 | `public`, bio `[test] …`, 2–4 postări, inel de stories | `GET /api/profiles/<handle>` |
| Feed „Pentru tine" | **23 postări**, toate publice — inclusiv ale conturilor pe care `test` nu le urmărește | `GET /api/social/feed?lens=for-you&format=all` |
| Stories (tray) | **8 stories**, deși `test` nu urmărește pe nimeni | `GET /api/stories?state=all` |
| Comentarii | 2 comentarii pe postarea 5 | `GET /api/posts/5/comments` |
| Mesaje | conversația 1 în inbox, 1 mesaj necitit | `GET /api/chat/conversations?box=inbox` |
| Notificări | 1 × `message` | (urmăritorii nu notifică, vezi 10.11) |
| Urmăritori | 5 urmăritori, 0 urmăriri | `GET /api/profiles/test` |

### 10.7 De ce profilurile sunt publice

O personă nouă are `visibility` implicit `friends` (= doar urmăritori reciproci). Cum `test` nu
urmărește pe nimeni, acel implicit ar ascunde *tot* conținutul de contul pentru care se face tot
exercițiul — exact bug-ul care a făcut prima încercare de comentarii să răspundă `404`. De aceea
seed-ul scrie explicit `visibility: "public"` pe fiecare profil și creează postările/story-urile cu
`visibility: public`. Bio-ul există pe **două** înregistrări, scrise de două rute: `/api/profile`
(al contului, ce poartă payload-ul „me") și `/api/persona/social` (cel citit de un vizitator pe
pagina de profil); prima rulare a scris doar prima, iar profilurile au rămas cu bio gol.

### 10.8 Idempotency și `--resume` (cum se poate rerula în siguranță)

- Fiecare mutație poartă `Idempotency-Key` = `sha256(RUN_SEED + opKey(op))` în hex (64 caractere,
  în alfabetul acceptat `[A-Za-z0-9._:-]`, lungime 16–128). Rerularea aceleiași operații
  **rejoacă** răspunsul memorat, nu creează un al doilea obiect.
- Serverul memorează răspunsul **fiecărei** mutații, inclusiv eșecurile: o cheie folosită de un
  apel care a răspuns `404` rămâne „otrăvită". Etichetele sunt de aceea **versionate**
  (`comment-v2-<handle>-<post>`, `account-bio-<handle>`, `profile-bio-<handle>`).
- Cheia este unică pe `(user_id, actor_persona, idempotency_key)`, **nu** pe rută: aceeași etichetă
  nu are voie să numească două rute diferite pentru același cont.
- Upload-ul reluat: `POST /api/uploads` rejoacă sesiunea, dar o sesiune **încheiată** refuză
  părțile; scriptul detectează starea `completed` și reia direct `POST /api/uploads/:id/complete`,
  care întoarce aceeași înregistrare media. Nimic nu se încarcă de două ori.
- `--resume` încarcă sesiunile din `docs/.test-sessions.local`, le verifică pe fiecare cu
  `GET /api/me` și sare peste înscriere (bugetul nu se cheltuie a doua oară).

### 10.9 Secrete și raport

- `docs/.test-sessions.local` (gitignored) — cookie-uri de sesiune, parolele de test (14 caractere)
  și cheile de portofel, per cont. **Nu se comite.**
- Raportul public, fără niciun secret: `%TEMP%\nexus-preview-seed-report.md` (conturi, pași, id-uri).
- Media folosită la upload: `%TEMP%\nexus-preview-seed-media` (PNG-urile generate; clipurile sunt
  descărcate în memorie, nu pe disc).

### 10.10 Verificare pe dispozitiv (checklist)

Autentificare cu `test@nexus.ro` (parola nu este în repo), apoi:

1. Feed → apar postările 14–23 (foto/clip + Tweet), cu autori diferiți și comentarii numărabile.
2. Stories → 8 inele, toate cu media; inelul „@test" nu există (contul nu are story).
3. Profil `@urailwaytest01a20d` → bio `[test] …`, 1 fotografie + 1 Tweet, buton „Urmărește".
4. Postarea 5 (a contului) → cele două comentarii 12 și 13.
5. Mesaje → conversația cu `@urailwaytest01a20d` și un mesaj nou.
6. Notificări → una de tip mesaj.

### 10.11 Limitări cunoscute (preview)

- **Duplicatе** postări 6–13 / story-uri 1–3 (10.3), rămase din prima încercare; nu se șterg fără aprobare.
- **Urmăririle și comentariile nu generează notificări pe server**: `repo.notify` este apelat doar de
  verticalele Work/Dating/Market/Travel/Beauty, de mesaje și de evenimente de securitate. Deci
  panoul de notificări al lui `test` arată doar notificarea de mesaj; cele 5 urmăriri se văd în
  lista de urmăritori, nu ca notificări.
- Story-urile trăiesc 7 zile de la seed (`duration_hours: 168`), spre deosebire de 24h în setul local.
- Conturile de preview sunt create de script (nu de `lib/preview-test-account.js`), deci au
  identitate de portofel generată local, nu wallet conectat de un om.

### 10.12 Arborele de comentarii native · 8 octombrie 2026

Postarea publică `5` a primit, numai prin API-ul public de pe Railway, 15 comentarii de
test suplimentare: o rădăcină cu text peste cinci rânduri, un lanț de patru niveluri
sub ea, o a doua rădăcină cu nouă răspunsuri directe și trei aprecieri `LIKE` de la
conturi de test diferite. După rulare, `GET /api/posts/5/comments?sort=oldest&cursor=0`
a întors `root_count=4`, `comments.length=17`; rădăcina cu nouă răspunsuri are `id=20`.
Nu s-a șters sau modificat niciun comentariu anterior. Serverul nu suportă media în
comentarii, deci nu s-a creat o fotografie fictivă.

Verificarea pe Xiaomi a adăugat, prin interfața nativă și același endpoint public,
răspunsul `TestNexusAndroid20261008` sub comentariul `20` și un `LIKE` al contului de
test la același comentariu. Firul are acum zece răspunsuri; acestea sunt date de test
adiționale, nu au înlocuit fixture-ul inițial.

Reproducere sigură: `node apps/nexus-mobile/scripts/seed-comment-thread.mjs` execută numai
preflight (sesiuni `GET /api/me` și citirea comentariilor). `--apply` execută adăugarea.
Scriptul citește exclusiv sesiunile locale gitignored `docs/.test-sessions.local`, verifică
URL-ul Railway și ID-urile conturilor, trimite `Origin` și câte un `Idempotency-Key`
determinist per mutație, apoi recitește arborele. El recunoaște textul deja adăugat și
refuză un părinte diferit, ca o reluare să nu dubleze firul. Nu afișează și nu comite
cookie-uri, parole ori chei.
