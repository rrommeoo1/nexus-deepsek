# Setul de date de test (Nexus, local)

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
- `docs/PARITY-MATRIX.md` — matricea de paritate; comparația de geometrie/culori
  se face pe `docs/web-ref/<ecran>/*.dom.json`, **nu** pe PNG-uri.
