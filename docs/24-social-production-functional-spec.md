# Nexus Social — specificație funcțională de producție

Versiune: `1.0`  
Data: `2026-08-28`  
Scope: `Identity + Social + Profile + Messages`  
Owner logic: Nexus Product Architecture  
Stare: contract normativ pentru implementare; nu reprezintă singur acceptarea juridică sau certificarea de producție.

## 0. Autoritate, scop și vocabular

Documentul transformă cerințele Social într-un contract implementabil și completează
`00-master-spec`, `03-data-api`, `04-security-compliance`, `15-recommendations-clips-watch-live-kids`,
`17-ui-action-blueprint`, `20-engagement-integrity-viral-ranking` și
`21-cross-mode-content-communication-identity`. La conflict se aplică, în ordine:

1. safety, privacy, drepturile utilizatorului și obligațiile legale;
2. deciziile explicite și mai noi ale ownerului;
3. acest document pentru comportamentul Social;
4. documentele generale pentru infrastructură și celelalte verticale.

Regula explicită actuală este **Nexus-only sharing**: Social nu deschide WhatsApp,
Telegram, Messenger, Viber, email, X, Instagram sau altă aplicație pentru distribuire.
`Repost/Retweet` este intern. Trimiterea unui conținut prin Messages va fi tot internă,
dar rămâne feature-flagged până la reactivarea explicită a distribuirii. Loginurile
Google/Facebook/Apple și xPortal sunt provideri de identitate, nu canale de share.

Etichete de livrare:

- `P0` — obligatoriu înainte de beta publică;
- `P1` — obligatoriu înainte de general availability;
- `P2` — îmbunătățire după stabilizarea nucleului;
- `GATED` — nu poate fi activat doar prin cod; cere provider, drepturi, audit sau aprobare;
- `LOCAL` — funcționează în demo-ul local, dar nu dovedește scalarea în producție.

### 0.1 Invariante de produs

- Orice acțiune este făcută de `accountId + actorProfileId + activeMode`, niciodată
  doar de wallet sau de cont.
- Social, Work, Dating și celelalte profiluri au avatar, nume, bio, graph, privacy,
  block-list, recomandări și audience independente.
- Messages agregă modurile, dar fiecare conversație păstrează identitatea de origine;
  filtrarea nu dezvăluie existența unui profil ascuns.
- PII, plaintext-ul mesajelor, seed phrase, locația exactă, biometria și conținutul
  media nu intră on-chain.
- O mutație persistentă user-visible are `Idempotency-Key`, audit event și o stare
  finală explicită. Action Ledger poate ancora compact acțiunea; simpla vizualizare,
  progress-ul video, typing și presence nu produc tranzacții.
- UI optimist nu afișează niciodată `confirmed` înainte de confirmarea autoritativă.
- Safety poate ascunde imediat conținutul; ledger-ul sau blockchain-ul nu blochează
  emergency stop, block, logout, recovery sau report.
- Conținutul retras păstrează un tombstone și istoricul minim necesar; nu este rescris
  în secret. Purge-ul legal șterge payload-ul unde legea o cere.
- Actorii sintetici sunt marcați `SYSTEM_TEST` și nu influențează ranking organic,
  Sigil, bani, analytics de business ori dovada adopției.

## 1. Contract comun pentru orice acțiune

### 1.1 Contextul cererii

Fiecare mutație primește:

```text
Session(accountId, deviceId, assuranceLevel)
+ X-Nexus-Profile(actorProfileId)
+ activeMode
+ resourceId/version
+ Idempotency-Key
+ clientTimestamp (informativ)
+ capability/session-key scope, dacă acțiunea merge în Action Ledger
```

Serverul verifică în această ordine: sesiune → ownership profil → block global →
visibility/audience → stare resursă → age/country/rights/moderation → rate/abuse →
idempotency → mutație → event/outbox → eventual chain relay.

### 1.2 Stări UI și backend

| Stare | Comportament |
|---|---|
| `IDLE` | control disponibil; nu există cerere activă |
| `LOCAL_PENDING` | UI optimist, control blocat contra dublu-submit, undo permis unde e sigur |
| `API_ACCEPTED` | mutația este durabilă off-chain; UI arată pending discret dacă chain-ul este necesar |
| `CHAIN_PENDING` | relayer a acceptat; retry/reconcile rulează server-side, fără popup repetat |
| `CONFIRMED` | reducer/read model și ledger sunt reconciliate |
| `RETRYABLE_FAILED` | rollback optimist sau stare „nu s-a trimis”; retry manual/automat bounded |
| `PERMANENT_FAILED` | motiv acționabil: privacy, ban, validation, rights, quota |
| `CONFLICT` | clientul reîncarcă versiunea autoritativă și explică schimbarea |
| `WITHDRAWN` | payload ascuns, tombstone vizibil conform audience/policy |

### 1.3 Contract de eroare

API răspunde cu `code`, mesaj localizabil, `retryable`, `retryAfter`, `correlationId`
și, numai când este sigur, `fieldErrors`. Codurile comune sunt:

`AUTH_REQUIRED`, `STEP_UP_REQUIRED`, `PROFILE_CONTEXT_INVALID`, `FORBIDDEN`,
`BLOCKED_RELATIONSHIP`, `NOT_FOUND_OR_HIDDEN`, `VERSION_CONFLICT`, `RATE_LIMITED`,
`DUPLICATE`, `MEDIA_REJECTED`, `MEDIA_QUARANTINED`, `RIGHTS_REQUIRED`,
`MODERATION_HOLD`, `CHAIN_PENDING`, `CHAIN_REJECTED`, `OFFLINE`, `SERVICE_GATED`.

Nu se diferențiază „nu există” de „nu ai acces” când diferența ar divulga un profil
privat, un block, o conversație sau un utilizator ascuns.

### 1.4 Retry, offline și race conditions

- GET: maximum două retry-uri cu jitter; nu se repetă automat pe `4xx`.
- Mutații idempotente: un retry automat după reconectare, cu aceeași cheie.
- Upload: retry per chunk; nu se retransmite fișierul complet.
- Like/unlike/follow rapid: numai ultima intenție per actor-resursă este starea finală;
  requesturile vechi nu pot inversa rezultatul mai nou.
- Comment/post/message: butonul se dezactivează până există ID autoritativ; aceeași
  cheie întoarce același rezultat, nu creează duplicate.
- Offline: drafturile și acțiunile reversibile pot intra într-o coadă locală criptată;
  publicarea, plățile, schimbarea identității și reporturile urgente cer confirmare
  server-side. Reportul offline este trimis prioritar la reconectare.

## 2. Autentificare, cont și wallet

### 2.1 Metode și stare de livrare

| Metodă | Contract | Fază |
|---|---|---|
| Email + parolă | signup/login, verificare, recovery fără expunerea seed-ului | `P0`, parțial `LOCAL` |
| xPortal | WalletConnect + NativeAuth server-side; confirmare unică și resume sigur | `P0`, `LOCAL/devnet` |
| Google | OAuth state/PKCE, cont legat de același Nexus account | `P0 GATED` de config/provider |
| Facebook | OAuth state, fără token provider păstrat inutil | `P1 GATED` |
| Apple | Sign in with Apple, obligatoriu unde politica magazinului cere echivalență | `P1 GATED` |
| Telefon/SMS | OTP cu anti-SIM-swap și provider regional | `P2 GATED`; nu se activează fără buget/vendor |
| Passkey | WebAuthn, recovery și device registry | `P1` |

### 2.2 Înregistrare email

1. Clientul validează email normalizat și parolă de minimum 10 caractere, fără
   parolă compromisă cunoscută și fără spații accidentale la capete.
2. Wallet-ul MultiversX este generat **pe dispozitiv**; serverul primește adresa și
   dovada de control, niciodată seed phrase sau cheia privată.
3. Contul pornește `EMAIL_UNVERIFIED`; browsing limitat este permis, publicarea,
   messages către necunoscuți și payout nu sunt permise.
4. Verificarea este single-use, expiră și este rate-limited. Resend nu divulgă dacă
   emailul aparține deja unui cont.
5. Se creează profilul Social cu nickname temporar și username Nexus disponibil.

Eșec după crearea wallet-ului, dar înaintea contului, păstrează wallet-ul numai pe
dispozitiv și explică reluarea. Eșec după cont folosește tranzacție DB/compensare;
nu pot exista două conturi pentru aceeași adresă, email sau provider subject.

### 2.3 Login și sesiuni

- Sesiune scurtă, refresh rotit, cookies `HttpOnly/Secure/SameSite`, CSRF pentru
  mutații browser și device registry vizibil utilizatorului.
- Login nou/suspect produce notificare internă și permite revocarea dispozitivului.
- Logout local revocă sesiunea curentă; „logout all” cere step-up și revocă toate
  refresh tokenurile/capabilities.
- 2FA: passkey/TOTP preferat; SMS numai fallback unde este justificat.
- După suspendare, toate sesiunile sunt revocate; exportul, apelul și safety center
  rămân accesibile conform legii și riscului.

### 2.4 Recovery

- Resetarea parolei nu transferă active blockchain și nu regenerează seed phrase.
- Recovery wallet este un flux separat: backup criptat controlat de utilizator,
  social/MPC recovery auditat sau import manual; niciun fallback server secret.
- Linkurile/tokenurile sunt single-use, short TTL, hash-at-rest și invalidate după
  schimbarea parolei/emailului.

### 2.5 Account Center

Include: email/provideri mascați, device-uri/sesiuni, adresa MultiversX, herotag,
username Nexus, active wallet filtrate, top-up `GATED`, capabilities, export GDPR,
deactivare, ștergere, apeluri și status moderare. Seed phrase se afișează numai
în vault client-side după reautentificare, avertisment și protecție anti-capture;
serverul nu o poate returna.

### 2.6 Schimbări sensibile

- Username: cooldown 30 zile după schimbarea voluntară; rezervare anti-squatting,
  istoric intern și redirect limitat. Transferul ca activ este separat și `GATED`.
- Email/telefon/wallet/payout: step-up, notificare pe canalul vechi, hold de risc.
- Ștergere cont: confirmare dublă, reauth, perioadă de grație 30 zile, anulare
  posibilă, apoi purge/anonymize după retention/legal hold. Activele on-chain nu pot
  fi șterse; explicația este prezentată înainte de activarea ledger-ului.
- Export: format machine-readable, link expiring, fără chei private, datele altora
  sau plaintext care nu aparține solicitantului.

## 3. Profil Social

### 3.1 Date și validare

| Câmp | Reguli |
|---|---|
| `displayName` | 1–50 grapheme clusters; Unicode normalizat; fără impersonare |
| `nexusUsername` | 3–30, litere/cifre/underscore/dot controlat, unic case-insensitive |
| avatar | imagine admisă, crop 1:1, fără SVG executabil |
| cover | 16:9 recomandat; mobile safe-area definit |
| bio | maximum 300 grapheme clusters, mentions/hashtags interne |
| links | maximum 5, `https` only, scan reputație și interstitial; nu sunt canale de share |
| pronouns/location | opționale și vizibile numai după setarea audience |
| language/theme | `system` implicit; limbă aleasă bate geolocația IP |

Vârsta și numele legal nu sunt cerute public în Social. Age assurance poate produce
un claim privat (`AGE_BAND_VERIFIED`) fără data nașterii în profil.

### 3.2 Tipuri și badge-uri

- `PERSONAL`, `CREATOR`, `BUSINESS` schimbă instrumentele, nu prioritatea arbitrară.
- Nexus Sigil se acordă automat pe criterii publicate și trafic organic calificat;
  nu poate fi selectat manual sau cumpărat.
- Verification confirmă claimuri precise (identitate, business, creator), nu
  adevărul opiniilor și nu oferă imunitate la moderare.
- Schimbarea tipului păstrează istoricul și cere revalidare pentru payout/business.

### 3.3 Taburi

`Posts`, `Clips`, `Tagged`, `Saved`, `Collections`, `Stories/Highlights`, `Archive`.
`Saved`, `Collections` și `Archive` sunt private implicit. Tagged are review manual
opțional înainte de apariția publică. Contul privat ascunde gridul conform audience,
dar nu divulga cine a solicitat acces în afara regulilor explicite.

### 3.4 Matrice privacy per profil

Setări independente: visibility, cine poate follow, comment, mention, tag, DM,
story reply, duet/stitch, download, view status, activity/presence, discoverability,
recommendation languages, region și sensitive-content level.

Audience: `PUBLIC`, `FOLLOWERS`, `FRIENDS_MUTUAL`, `CLOSE_FRIENDS`, `SPECIFIC`,
`ONLY_ME`. Serverul recalculează accesul la fiecare read; un URL sau cache nu
ocolește schimbarea de privacy. Block global se aplică înainte de orice audience.

### 3.5 Profil privat plătit

Modelul de acces temporar, preț owner-selected și split 90/10 este `GATED` pentru
payments, consumer law, tax, privacy receipts, refunds și adult-content separation.
Demo-ul nu pretinde settlement real. Prețul minim aprobat este echivalent 1 USD/zi;
accesul are start/end, entitlement revocabil, dispute/refund policy și nu permite
copierea sau revânzarea datelor persoanei.

## 4. Conținut și publicare

### 4.1 Tipuri

| Tip | Contract | Fază |
|---|---|---|
| text/tweet | 1–2.000 caractere, threads, mentions, hashtags | `P0` |
| image | 1–10 imagini, ordine și alt text per imagine | `P0` |
| clip | video vertical până la 180 secunde | `P0` |
| mixed post | text + imagini/video | `P0` |
| poll | 2–6 opțiuni, 5 min–7 zile, vot unic retractabil conform policy | `P1` |
| link preview | fetch izolat, SSRF-safe, cached, user poate elimina preview | `P1` |
| audio attached | upload cu declarație de drepturi sau catalog licențiat | `P1/GATED` |
| collab/duet/stitch | consimțământ, rights lineage, revocation behavior | `P1` |

### 4.2 Composer unic `+`

Deschide Camera, Galerie, Story, Clip, Post/Tweet, Drafts și Live Device Check.
Camera pornește selfie-first pentru Story/Create și rear-first pentru captură Clip
explicită; flip este disponibil. Închiderea, schimbarea profilului sau background
opresc imediat toate trackurile.

Composerul păstrează draft local criptat, arată progres, validări și audience înainte
de Publish. Nu semnează/publică automat. La permission denied oferă `Retry`, `Settings`
și `Gallery`; la HTTP nesigur explică HTTPS fără a pretinde că folosește camera.

### 4.3 Câmpuri comune

- caption: maximum 2.000; text tweet maximum 2.000; comment maximum 2.000;
- maximum 30 hashtags și 20 mentions; spam scoring poate reduce limitele;
- location: coarse implicit; precise location cere permisiune și expiră din metadata;
- audience obligatoriu și memorat per tip numai cu acordul utilizatorului;
- alt text: maximum 1.000 per asset; auto-suggestion marcată AI, editabilă;
- synthetic-media disclosure, paid-promotion disclosure și rights declaration;
- schedule: 10 minute–90 zile; timezone explicit, edit/cancel până la dispatch;
- comments, reactions, remix, download și notifications pot fi configurate per post.

### 4.4 Lifecycle

`DRAFT → LOCAL_VALIDATING → UPLOADING → PROCESSING → MODERATION_PRECHECK →
SCHEDULED|READY_TO_PUBLISH → PUBLISHING → PUBLISHED → EDITED|WITHDRAWN|HIDDEN`.

`FAILED_RETRYABLE`, `REJECTED_VALIDATION`, `QUARANTINED`, `RIGHTS_BLOCKED` și
`MODERATION_HOLD` sunt stări terminale/intermediare explicite. Feedul nu primește
media înainte de `PUBLISHED + playback READY`.

### 4.5 Editare, arhivare și retragere

- Caption, alt text, location, audience mai restrictiv și tagging se pot edita.
- Fișierul media publicat nu se înlocuiește silențios; se creează versiune/post nou.
- Istoricul editărilor semnificative este vizibil, cu payload sensibil minimizat.
- Autorul poate retrage postarea/comentariul; UI arată tombstone. Autorul postării
  nu poate șterge opiniile altora; poate opri comentarii noi, restricționa, raporta
  sau cere moderare motivată.
- Moderatorul poate ascunde pentru safety/legal; autorul primește motiv și apel unde
  este permis. Purge-ul legal elimină payload-ul, păstrând numai dovada minimă.
- Pin: maximum 3 postări; archive este privat și reversibil; soft-delete are grace.

## 5. Specificații media

### 5.1 Imagini

| Parametru | Producție |
|---|---|
| input | JPEG, PNG, WebP; HEIC/HEIF numai dacă se decodează client/server sigur |
| limită | 20 MB/fișier, 10 fișiere/post, 50 megapixeli decode limit |
| dimensiune | latura 320–16.384 px; orientarea EXIF este aplicată și apoi eliminată |
| output | AVIF/WebP dacă suportat + JPEG fallback; metadata sensibilă eliminată |
| variante | 160 avatar/thumb, 480, 960, 1440, original controlat |
| ratio | liber pentru post; crop preview 1:1/4:5; Story/Clip recomandat 9:16 |
| animație | GIF se convertește în video; nu se păstrează payload activ |

Compresia nu suprascrie originalul înainte ca uploadul să fie confirmat. Smart crop
este sugestie, nu modificare ireversibilă. Face detection rulează fără a crea template
biometric și poate fi dezactivată. Imaginile corupte/decompression-bomb sunt respinse.

### 5.2 Video

| Suprafață | Durată | Upload | Output |
|---|---:|---:|---|
| Clip/Reel | 1–180 s | max 1 GB | 360p, 540p, 720p, 1080p; 4K numai creator eligible |
| Social video post | 1 s–10 min | max 3 GB | 360p, 720p, 1080p, 4K condiționat |
| Story video | 1–60 s/segment | max 500 MB | 540p, 720p, 1080p |
| Message video | max 5 min | max 500 MB | 360p/720p, E2EE roadmap separat |

Input: MP4/MOV/WebM; codec admis la ingest H.264/HEVC/VP9/AV1, dar browserul primește
H.264/AAC fallback. Audio Opus/AAC este normalizat. Rezoluție minimă recomandată
720p, maxim 4K, maximum 60 fps; pixel/decode/duration limits sunt verificate cu probe,
nu din MIME/extensie.

Ratios acceptate: 9:16, 4:5, 1:1, 16:9 și surse neobișnuite în canvas letterbox/crop
controlat. Clip feed folosește viewport edge-to-edge și `cover`, cu safe zones pentru
caption/actions; viewerul oferă control de crop fără deformare.

Encoding orientativ: H.264 High, keyframe 2 s, VBR capped; 1080p 4–8 Mbps, 720p
2–4 Mbps, 540p 1–2 Mbps, 360p 0,5–1 Mbps. Valorile sunt profiluri, nu motive de
respingere a inputului valid. HLS/DASH manifest și byte-range cache sunt generate
în producție; demo-ul local servește fișierul verificat și nu pretinde transcoding.

### 5.3 Audio

Input MP3/WAV/OGG/AAC, maximum 20 MB pentru atașare Social locală și maximum 10
minute. Se generează waveform, loudness normalizat pentru playback și preview de
maximum 60 s unde licența o cere. `ORIGINAL_OWNED` sau `LICENSED_WITH_PERMISSION`
este obligatoriu; catalogul comercial și fingerprinting sunt `GATED` de drepturi.

### 5.4 Upload resumable

1. `POST /uploads` creează sesiune, chunk size 5–16 MB și TTL 24 h.
2. Clientul calculează checksum, trimite chunks paralel bounded (max 3 pe mobil).
3. La 40/70/95% eșecul păstrează offsetul confirmat; retry reia numai chunkurile lipsă.
4. Finalize verifică hash, MIME magic, probe, ownership și purpose grant.
5. Fișierul intră în quarantine; publish reference apare numai după admission.

Progresul separă `Pregătire`, `Upload`, `Verificare`, `Procesare`, `Moderare`,
`Publicare`; 100% upload nu înseamnă publicat. Închiderea app păstrează draftul și
upload ID. Cancel revocă sesiunea și programează purge multipart.

### 5.5 Processing și fallback

`RECEIVED → PROBING → SCANNING → TRANSCODING → THUMBNAILING → CAPTIONING →
MODERATION → READY`. Fiecare pas are heartbeat, timeout, retry bounded și dead-letter.
Thumbnail smart este ales din cadre safe; utilizatorul poate alege alt cadru.

La eșec:

- o variantă eșuată se regenerează fără a dubla assetul;
- dacă 1080p eșuează, 720p poate publica numai dacă minimum quality este îndeplinit;
- dacă scanner/moderation nu sunt disponibile, assetul rămâne `HOLD`, nu fail-open;
- manifestul nu referă variante lipsă;
- utilizatorul poate retry, replace draft sau withdraw.

### 5.6 Storage, CDN și cache

- Originalele sunt object storage private, content-addressed și criptate; playback
  folosește URL semnat/token de entitlement.
- Variantele publice au immutable content hash; metadata/audience nu se cache-uiește
  ca publică. Private content folosește short TTL și no shared-cache.
- CDN multi-region este `GATED` de buget/vendor; local folosește laptop storage.
- Purge block/delete/legal este urgent la origin + CDN + index; tombstone-ul nu
  permite recuperarea payloadului din UI.
- IPFS/Arweave nu primește conținut privat sau drept de ștergere; numai commitments
  ori assete opt-in realmente permanente.

## 6. Feed și recomandări

### 6.1 Surfețe

`For You` este clip-first; `Local Trends`, `Global Trends`, `Friends`, `Following`,
`Private Content`, `Breaking` și `Tweets` sunt canale explicite. Toggle cronologic
este disponibil în Following/Friends; For You rămâne recomandat și explicabil.

### 6.2 Candidate pipeline

```text
request context
→ hard eligibility: profile/privacy/block/age/country/rights/moderation
→ candidates: following, graph, interests, near coarse, exploration, trends
→ score: satisfaction + relationship + recency + quality - negative/fatigue/risk
→ diversity: author/topic/language/format caps
→ integrity: Sybil/paid/agent/incentivized filtering
→ page with stable cursor and reason codes
```

Semnale: completion, rewatch, meaningful dwell, save, internal repost, follow-after-
watch, comment quality, hide/not-for-me, dislike și reports qualified. Raw likes nu
cumpără reach. Creatorii noi primesc exploration budget; nicio categorie politică
nu este suprimată doar pentru opinie, dar misinformation context, provenance și
safety rules se aplică egal.

### 6.3 UX feed

- infinite scroll cu cursor, skeleton și maximum o media redată;
- autoplay doar la minimum 65% vizibil, loop pentru Clips, mute memorat până la
  schimbarea utilizatorului, tap play/pause și fullscreen continuu vertical;
- preload numai vecinii imediat anterior/următor; Data Saver reduce quality/preload;
- pull-to-refresh nu mută brutal utilizatorul; „postări noi” oferă acțiune explicită;
- scroll position se restaurează la ieșirea din viewer/comment/profile;
- offline arată cache recent cu marcaj și blochează acțiunile neconfirmabile;
- empty state oferă interese/follow/search, nu actori falși.

Breaking folosește numai surse/licențe configurate și arată sursa, ora, corecțiile și
gradul de verificare; în lipsa providerului afișează indisponibil, nu știri fabricate.

## 7. Interacțiuni

### 7.1 Reacții și dislike

Tap pe reacția dominantă aplică Like; long-press deschide `Love`, `Haha`, `Wow`,
`Sad`, `Angry`, `Fake?` și `Dislike/Not for me` conform suprafeței. `Fake?` este
opinia comunității, nu fact-check. UI arată maximum primele trei reacții nenule:
dacă una are ≥80% afișează glyph-ul dominant și totalul; altfel afișează distribuția
top 2–3 cu count individual.

O singură reacție publică per profil/post; schimbarea este atomică. Dislike este
privat nominal, vizibil agregat numai după threshold și abuse filtering. Brigading,
Sybil, paid și SYSTEM_TEST nu afectează ranking/reputație. Creatorul vede agregate,
nu lista nominală de dislike.

### 7.2 Comentarii

- replies sunt threaduri cu `parentId`, maximum 6 niveluri vizuale; mai adânc se
  păstrează logic și se aplatizează accesibil;
- sortări `Relevant`, `Newest`, `Oldest`; Relevant explică semnalele și evită biasul
  doar spre conturi mari;
- like/reacție pe comentariu, mention, reply specific și creator pin maximum 3;
- autorul își poate edita comentariul cu indicator/version history sau retrage cu
  tombstone; autorul postării nu poate șterge criticile altora;
- hide personal este numai pentru viewer; restrict pune comentariul în vizibilitate
  controlată și este auditabil; moderation hide are motiv și apel;
- deschiderea comments micșorează clipul la partea superioară și ocupă restul cu
  drawer; bottom nav dispare, close/back/swipe sunt întotdeauna disponibile.

### 7.3 Repost/Retweet și Nexus-only share

- Repost/Retweet este intern, toggle idempotent și păstrează original ID/autor/audience.
- Quote repost creează post nou cu lineage; retragerea originalului afișează tombstone.
- Audience-ul original este reevaluat la fiecare read; repostul nu face public un
  obiect privat și nu copiază media.
- Butonul general Share este `OFF`; API răspunde `409 SOCIAL_SHARE`. Nu există URL,
  deep-link sau logo către aplicații externe.
- O viitoare trimitere prin Nexus Messages va cere aprobare de produs, entitlement,
  target real din graph și aceeași politică privacy; niciodată contacte fabricate.

### 7.4 Save, collections și download

Save este privat, idempotent și poate adăuga în colecții private/shared `P1`.
Download este permis numai dacă ownerul și rights permit; se salvează varianta cu
watermark Nexus, autor și asset ID. Own-media export oferă originalul unde drepturile
permit. Private/paywalled/View Once nu este downloadable.

### 7.5 Follow și creator menu

Follow lângă nume; cont privat creează `REQUESTED`, public creează `FOLLOWING`.
Meniul `…` este ancorat lângă trigger și conține: View profile, Message în Nexus,
Not for me, Mute, Restrict, Block, Report. Se închide la toggle, outside tap, Escape,
back sau selecție și nu poate bloca ecranul.

## 8. Stories și Highlights

Durata implicită este 24 h, dar ownerul poate alege 1 h–365 zile sau `persistent
until archived`. Conținutul persistent este tratat ca Highlight și nu promite
efemeritate. Foto, video, text, poll, question și audio respectă rights/moderation.

Story viewer:

- tap deschide; stânga/dreapta înainte/înapoi; hold pause; swipe close; progress per
  asset; video folosește durata până la maximum 60 s/segment;
- Story-urile văzute se scot din rail-ul „unseen”, dar rămân accesibile în profil;
- reply/reaction intră în Nexus Messages, numai dacă message policy permite;
- viewers list este doar pentru owner, cu retention explicit; views anonimizate sau
  paid-reveal sunt `GATED` și nu pot induce în eroare;
- schimbarea audience/block ascunde imediat; archive automată este privată;
- camera node deschide camera reală numai în secure context și după permisiune.

Close Friends este listă separată per profil. Eliminarea unei persoane revocă accesul
viitor și cache-ul; nu poate șterge o captură deja făcută, fapt explicat utilizatorului.

## 9. Messages, calls și meetings

### 9.1 Inbox unificat

Filtre: `All`, `Social`, `Work`, `Dating`, `Travel`, `Market`, `Requests`, `Sent`.
Expeditorul apare cu avatarul/numele profilului de origine. Username Nexus este
addressing primar; serverul rezolvă exact userul și respectă block/privacy.

### 9.2 Conversații

- direct 1:1 și grup cu owner/admin/member, invite/accept și history boundary;
- requests pentru necunoscuți: un singur mesaj preview, fără read receipt/presence
  până la accept; spam quota strictă;
- text maximum 4.000, emoji/reaction, reply, edit `P1`, forward intern `P1`, search;
- sent/delivered/read per device cu setare privacy; typing/presence ephemeral;
- mute, archive, pin, block/report și media gallery;
- disappearing 1 min/1 h/24 h/7 zile; expiry șterge ciphertext/attachment grant și
  păstrează tombstone minim. Nu se promite prevenirea capturilor.

### 9.3 E2EE

Textul folosește device keys, envelope per dispozitiv, rotation la remove/block și
fără plaintext/private keys în server DB. Multi-device coverage este exactă; dacă un
device nu are cheie validă, secure send nu downgradează silențios. Attachment E2EE,
backup keys, safety-number UX și group sender keys sunt `P1` și trebuie auditate.

### 9.4 Media și voice notes

Foto/video/voice/document trec prin admission și grant de conversație. Documentele
rămân quarantine până la malware scanner. Voice note: max 15 minute, preview waveform,
record lock/cancel și permisiune mic only while recording.

### 9.5 Delete semantics

`Delete for me` elimină numai proiecția locală. `Withdraw for everyone` este permis
autorului în policy window, lasă tombstone și nu pretinde ștergerea copiilor/capturilor.
Safety/legal purge poate elimina payloadul. Forward păstrează provenance și audience;
conținutul privat care nu permite forward nu poate fi atașat.

### 9.6 Calls și Meetings

Apel audio/video 1:1: `RINGING → ACCEPTED → CONNECTING → ACTIVE → ENDED|FAILED`,
cu decline, busy, timeout, mute/camera flip/speaker și report/block. Demo WebRTC P2P
fără TURN este etichetat corect; producția cere TURN, abuse protection și observability.

Groups/Meetings cer SFU `GATED`: waiting room, host/co-host, remove/mute, screen share,
hand raise, chat, calendar intern și meeting link Nexus. Nu se deschide Teams/Zoom.
Recording este off implicit, cere consimțământ vizibil și retention.

## 10. Notificări

Tipuri: reaction, comment/reply, follow/request, mention/tag, Story reply, message,
call/meeting, Live, moderation, security, payments și system. In-app este P0; push și
email sunt `GATED` de provider/consent.

- Message este singurul badge persistent în dock; alte notificări se află în Inbox/
  Activity fără a aglomera headerul.
- Grupare: același obiect + tip într-o fereastră; actorii blocați/șterși sunt purgați.
- Granular per profil, tip, canal, quiet hours și preview privacy.
- Dating/Private poate folosi text generic; conținutul sensibil nu apare pe lockscreen.
- Mark read/all read este idempotent și multi-device; unread count este autoritativ.
- Deep-link intern verifică din nou access; nu dezvăluie resursa după block/delete.

## 11. Search, Explore și graph

Search live caută utilizatori vizibili, hashtaguri, postări, sunete și coarse location.
Debounce 250 ms, min 2 caractere pentru persoane, cursor, typo tolerance limitată și
rate limit. Query history este privată, ștergibilă și nu trece între profiluri.

Explore aplică aceleași hard gates ca feedul. Trending cere minimum volume/diversity,
bot/paid filtering și decay; nu publică „trend” din câțiva actori coordonați.
Suggested accounts explică motivul și nu folosește Dating/Kids/sensitive traits.

Graph states: `NONE`, `REQUESTED_OUT`, `REQUESTED_IN`, `FOLLOWING`, `FOLLOWED_BY`,
`MUTUAL`, `MUTED`, `RESTRICTED`, `BLOCKED`. Remove follower este silențios. Block
global prevalează, revocă follows/request/chat access și rotește cheile relevante.
Close Friends/Favorites sunt liste separate per profil și private.

## 12. Moderare, trust și siguranță

### 12.1 Pipeline automat

Pre-publication și post-publication combină reguli, hash/fingerprint, classifiers,
provenance și behavior signals. Outputul are categorie, confidence, model/version,
reason codes și action policy; nu produce un procent „adevăr” inventat.

Trust Lens separă:

- provenance: owner-declared, C2PA/metadata unde există, edit history;
- synthetic/altered media: detectat/declarat cu incertitudine;
- safety: nudity/violence/hate/scam/illegal/copyright;
- context: surse, dispute, corecții și community opinion;
- community reactions: inclusiv `Fake?`, explicit nefactuale.

### 12.2 Acțiuni

`ALLOW`, `LABEL`, `AGE_GATE`, `REDUCE_DISTRIBUTION`, `QUARANTINE`, `REMOVE`,
`LIVE_TERMINATE`, `ACCOUNT_LIMIT`, `SUSPEND`. Acțiunile cu impact au notice, motiv,
durată și apel. Automatizarea poate ține volumul, dar cazurile ambigue/impact mare
nu pot fi declarate juridic „perfecte” fără proces formal; lansarea UE cere mecanism
de contestare și oversight independent, chiar dacă trierea este automatizată.

### 12.3 Report

Ținte: user/profile/post/comment/story/message/live. Motive: spam/scam, harassment,
hate, violence, sexual/NCII, child safety, self-harm, illegal goods, impersonation,
misinformation context, copyright și other. Emergency categories au fast path.
Reporterul primește receipt/status fără a vedea datele persoanei raportate.

Abuzul de report/reaction/dislike este ponderat prin identități unice, account age,
graph diversity, burst/cohort și outcome history; nu sancționează automat o idee doar
pentru volum. Shadowban secret nu este mecanism standard; limitările sunt reasoned,
auditable și contestabile.

### 12.4 Minori și adult content

Aplicația Social adultă folosește age bands și restricted mode. Nexus Kids este
binary/tenant separat, fără open social/DM/comments/wallet/behavioral ads. Adult/Prive
este verticală separată `GATED` cu age assurance, consent, payments și geofencing;
nu poate apărea accidental în Social.

## 13. Creator Studio și analytics

Creator Studio P0/P1: trim non-destructiv, cover, crop/aspect, filters, caption,
subtitles manual/auto, audio rights, drafts, schedule, duet/stitch permissions și
manifest de editare. Efectele AI sunt declarate; originalul și manifestul sunt legate.

Analytics numai pentru trafic calificat:

- reach, impressions, unique viewers, watch time, completion, rewatches;
- reactions distribution, comments/replies, saves, internal reposts, follow conversion;
- profile visits, audience country/language/age band agregat cu thresholds;
- retention curves și best-time suggestions cu interval de încredere;
- paid, agent, incentivized și SYSTEM_TEST separate, niciodată amestecate.

Hide-like-count ascunde countul public, nu analytics private sau safety signals.
Small cohorts sunt suprimate pentru privacy. Export analytics nu conține user lists.

## 14. Live, collaboration și funcții avansate

- `LOCAL`: camera/mic Device Check și preview privat, fără afirmație LIVE.
- `GATED`: ingest, transcoding, CDN, SFU, moderation real-time, delay, emergency stop,
  recording/replay, regional rights și creator eligibility.
- Live states: `DRAFT → DEVICE_CHECK → READY → SCHEDULED|STARTING → LIVE → ENDING →
  ENDED → REPLAY_PROCESSING|REMOVED`; orice transport failure are reconnect window.
- Battle/championship nu pornește fără reguli, anti-fraudă, prize config, moderation
  și legal review. Numărul de viewers exclude bots și este etichetat.
- Duet/Stitch/Remix păstrează lineage, revenue/right splits și revocation outcome.
- Music library comercială, embed extern și QR interoperabil sunt `GATED`.
- PWA, screen reader, contrast, reduced motion, captions, focus traps și keyboard
  navigation sunt `P0/P1`; nu sunt cosmetice.

## 15. Matrice acțiune — succes, eșec și edge cases

| Acțiune | Succes | Eșec/retry | Edge case obligatoriu |
|---|---|---|---|
| signup | cont + profil + wallet proof | rollback, email generic | wallet creat, cont eșuat; duplicate identity |
| login | sesiune/device nou | no account disclosure, throttle | provider revocat, clock skew, stale WC session |
| switch profile | context schimbat atomic | revine la profilul vechi | draft/camera/call activ se închide sigur |
| upload | upload ID + processing | resume chunks | app kill la 40/70/95%, checksum mismatch |
| publish | post ID + pending/confirmed | draft păstrat | schedule race, moderation change, chain lag |
| reaction | ultima intenție câștigă | rollback count | tap rapid, actor blocat între requests |
| comment/reply | thread ID stabil | text păstrat în composer | parent retras, comments closed, duplicate submit |
| repost | reference intern | rollback toggle | original devine privat/withdrawn |
| save | stare privată | retry idempotent | content removed → tombstone/collection cleanup |
| follow | following/requested | rollback | private→public race, mutual block |
| message | local pending→sent→delivered | retry same nonce | recipient bans/blocks/leaves group mid-send |
| story view | progress și viewed state | local retry bounded | story expiră/schimbă audience în viewer |
| block | acces revocat imediat | enforcement local + retry event | open chat/viewer/cache/keys/pending requests |
| report | receipt | priority queue offline | object deleted după submit; reporter abuse |
| withdraw | tombstone + purge job | status pending | quotes/reposts/comments/chain permanence |
| delete account | grace + revoke | resume/admin support | payouts/disputes/legal hold/on-chain assets |

## 16. Date și boundaries on-chain/off-chain

### 16.1 On-chain / Action Ledger

Numai action type, actor/object commitments, nonce/generation, policy class, timestamp
de protocol și hash de payload/version. Public post/reaction/follow poate avea
commitment distinct; private actions folosesc generic salted commitment/privacy relay.
Views, dwell, progress, typing, presence și frames nu produc tranzacții.

### 16.2 Off-chain autoritativ

Cont/profil/privacy, graph read models, post/comment payload, media metadata,
recommendation features, message ciphertext/envelopes, notifications, moderation,
reports, audit și analytics. Câmpurile sensibile sunt criptate, access-logged și
retention-limited. Search index este derivat și purge-aware.

### 16.3 Entități minime

`accounts`, `devices`, `sessions`, `wallet_bindings`, `profiles`, `profile_privacy`,
`relationships`, `blocks`, `posts`, `post_versions`, `media_assets`, `media_variants`,
`upload_sessions`, `comments`, `reactions`, `reposts`, `saves`, `collections`,
`stories`, `story_views`, `conversations`, `participants`, `messages`, `receipts`,
`device_envelopes`, `notifications`, `reports`, `moderation_decisions`, `appeals`,
`action_outbox`, `chain_actions`, `ranking_impressions`, `experiments`.

Toate tabelele multi-profile au `actor_profile_id` sau o justificare ADR. Foreign
keys, version/etag, created/updated/withdrawn și traffic class sunt obligatorii unde
se aplică. Nicio cheie privată/seed nu există în schema serverului.

## 17. API și evenimente obligatorii

Prefixul țintă este `/v1`; demo-ul local poate avea rute tranzitorii documentate.

```text
POST /auth/signup|login|logout|refresh|recover
GET/DELETE /account/sessions/{id}
POST /account/export|deletion-request|deletion-cancel
GET/PUT /profiles/{id}
GET/PUT /profiles/{id}/privacy
POST/DELETE /profiles/{id}/follow|block|mute|restrict
POST /uploads
PUT /uploads/{id}/parts/{part}
POST /uploads/{id}/complete|cancel
POST/GET /posts
GET/PATCH/DELETE /posts/{id}
POST/DELETE /posts/{id}/reaction|save|repost
GET/POST /posts/{id}/comments
PATCH/DELETE /comments/{id}
GET/POST /stories
POST /stories/{id}/view|reply|archive
GET/POST /conversations
GET/POST /conversations/{id}/messages
POST /messages/{id}/reaction|withdraw
GET/PATCH /notifications|notification-preferences
POST /reports|appeals
```

`POST /posts/{id}/share` rămâne `409 SOCIAL_SHARE` până la o decizie explicită.

Evenimente: `account.*`, `profile.*`, `graph.*`, `upload.*`, `media.*`, `post.*`,
`comment.*`, `reaction.*`, `story.*`, `conversation.*`, `message.*`, `report.*`,
`moderation.*`, `notification.*`, `action_chain.*`. Outbox și consumers sunt
idempotente; payloadurile nu conțin seed, plaintext E2EE sau PII inutil.

## 18. Performanță și SLO inițial

| Flux | Țintă beta p95 | Observație |
|---|---:|---|
| authenticated API read | <300 ms regional | fără media bytes |
| feed first page | <800 ms backend, <2,5 s usable pe 4G | cached candidates + safety gates |
| reaction/follow API | <400 ms | chain confirmation separată |
| comment publish | <700 ms | moderation hold explicit |
| message accept | <500 ms | delivery separat |
| image processing | <30 s | p95, fișier valid |
| 180 s clip ready | <5 min | fără queue overload |
| search suggestions | <250 ms | debounce exclus |

Availability beta: core read/write 99,9%; safety block/report 99,95%. Error budgets,
queue depth, stuck processing, chain lag, notification lag, CDN purge și moderation
backlog au alerte. Clientul are crash-free sessions ≥99,5% înainte de public rollout.

## 19. Must have, Nice to have și feature gates

### 19.1 Must have înainte de beta publică

- email/xPortal auth sigur, recovery, sessions/devices, logout all;
- profil Social și privacy/graph/block complet izolate;
- camera/gallery, resumable upload, admission fail-closed și processing truthful;
- clip-first feed, fullscreen continuous, mute persistent, reactions, threaded
  comments, save, internal repost, follow, report și not-for-me;
- Stories cu audience, viewer, progress, expiry/persistent lifecycle;
- Nexus Messages 1:1/group, requests, attachments safe, receipts și E2EE text auditat;
- in-app notifications și granular settings;
- automated moderation + report/appeal + emergency controls;
- export/delete GDPR, accessibility, observability, backup/restore și incident runbook;
- Action Ledger reconciliation fără PII și fără wallet popup la fiecare tap;
- device/browser/network matrix și independent T1 security/privacy/safety review.

### 19.2 Nice to have după stabilizare

- polls, quote repost, shared collections, collab, duet/stitch/remix;
- subtitles auto, smart crop, advanced effects și licensed music catalog;
- passkeys, Apple, phone OTP, push/email notifications;
- creator analytics avansat, scheduling complet, PWA offline enhancements;
- group calls/Meetings SFU, production Live, Watch long-form.

### 19.3 Default-off până la gate extern/formal

- plăți reale, paid private profiles, tips/payout, adult content;
- production Live/SFU/TURN, commercial music, news provider, CDN/cloud;
- Google/Facebook/Apple/SMS fără config, terms și privacy review;
- AI moderation ca decizie finală fără appeals/oversight;
- Kids în același binary/tenant;
- share către orice aplicație externă;
- mainnet sau fonduri reale.

## 20. Ambiguități rezolvate și decizii încă necesare

### 20.1 Rezolvate aici

- Clipurile Nexus au maximum 3 minute; 15/30/60/90 s sunt preseturi, nu limite.
- Comments nu pot fi șterse de ownerul postării; autorul retrage cu tombstone,
  moderatorul ascunde motivat, iar purge-ul legal șterge payloadul.
- Story poate dura cât alege ownerul; UI diferențiază clar temporar de persistent.
- `Fake?` este reacție/opinie, separat de Trust Lens și fact-check.
- Dislike este privat nominal și agregat anti-abuz.
- Toate distribuțiile Social sunt interne; external share este oprit.
- Media reală rămâne off-chain; numai ownership/commitments/action proofs pot fi chain.

### 20.2 Necesită decizie de owner înainte de P1

1. Limba canonică a termenilor Social: `Clip` vs `Reel`, `Tweet` vs nume Nexus.
2. Fereastra exactă de edit/withdraw pentru posts, comments și messages.
3. Dacă linkurile externe de profil rămân permise cu interstitial sau sunt eliminate.
4. Dacă hide-like-count ascunde și reaction distribution publică.
5. 4K eligibility și limitele finale dependente de cost/CDN.
6. Politica exactă Close Friends după removal pentru Stories deja cache-uite.
7. Regiunile/age bands inițiale și lista de safety policies localizate.
8. Modelul legal/economic pentru private paid access înainte de orice settlement.

Până la decizie se aplică varianta privacy/safety/cost minim: link warning, fereastră
scurtă, fără 4K implicit, fără settlement real și feature flag default-off.

## 21. Recomandări prioritizate de implementare

1. `P0` — consolidează contractul de mutație/idempotency/outbox/Action Ledger pentru
   reaction, comment, follow, save, repost și message.
2. `P0` — înlocuiește uploadul local base64 cu protocol resumable, media probe și
   job state machine; păstrează adapterul local pentru zero-cost demo.
3. `P0` — finalizează privacy matrix per profil și teste combinatorii block/audience/
   cache/search/chat pentru zero cross-profile leaks.
4. `P0` — finalizează comment lifecycle, report/appeal și moderator automation cu
   reason codes; fără delete arbitrar sau truth score inventat.
5. `P0` — întărește E2EE device lifecycle și attachment quarantine; nu activa group
   calls ori document downloads înainte de scanner/TURN/SFU.
6. `P0` — construiește browser/device lab pentru camera, Stories, fullscreen, upload
   interruption, comments, keyboard și accessibility.
7. `P1` — production media variants/HLS/CDN/provider abstraction cu FinOps caps.
8. `P1` — notification service și push după consent/provider gate.
9. `P1` — creator studio, subtitles și audio rights lineage.
10. `P2` — Live/Watch/collab numai după maturity gates pentru media/safety/rights.

## 22. Definition of Done și release evidence

O funcție nu este „gata” doar pentru că butonul există. Pentru fiecare journey sunt
obligatorii:

- acceptance tests pentru success/failure/offline/race/permission/block/delete;
- authorization/privacy tests pe toate profilele și traffic classes;
- accessibility: touch target, label, focus, keyboard, screen reader, reduced motion;
- observability fără PII/secrets, SLO și alertă pentru stuck/failed queues;
- migration/rollback, backup/restore și purge behavior;
- threat/privacy/safety/media-rights delta;
- device QA pe viewporturi reale și secure camera origin;
- synthetic actor suite fără organic/economic contamination;
- evidence pack semnat și checker independent pentru T0/T1;
- feature flag + kill switch pentru Live, payments, providers și modele;
- formal legal/vendor/app-store gates unde sunt necesare.

Release-ul public rămâne blocat dacă există auth bypass, cross-profile leak, E2EE
downgrade, child/adult leak, funds ambiguity, unsafe media admission, block/report
ineficient, rollback imposibil sau afirmații false despre chain/live/encryption.
