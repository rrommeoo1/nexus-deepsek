# Specificația principală Nexus

Specificația funcțională detaliată pentru primul vertical livrat (`Identity + Social
+ Profile + Messages`) este definită în `docs/24-social-production-functional-spec.md`.
Aceasta păstrează regula curentă Nexus-only pentru distribuire și clasifică explicit
funcțiile implementate local, obligatorii, opționale și blocate de gates externe.

## 1. Rezumat executiv

Nexus este o platformă socială tranzacțională pentru adulți, construită în jurul
unei identități controlate de un wallet MultiversX. Utilizatorul are șase
profiluri de context: Social, Work, Dating, Travel, Market și Mobility. Fiecare context are
propriul nume public, avatar, bio, audiență, graf social, feed, recomandări și
setări. Serviciile de chat, trust, wallet, notificări și plăți sunt comune, fără a
dezvălui automat legătura dintre profiluri.

Produsul nu reproduce șase aplicații complete în prima versiune. Construiește un
nucleu comun și activează verticalele treptat. Avantajul diferențiator nu este
numărul funcțiilor, ci comutarea sigură de context plus încrederea și settlement-ul
portabil între tranzacții. Paginile Business, programările locale, promovarea și
review-urile sunt capabilități comune; Music și Grow sunt hub-uri globale, nu
profiluri suplimentare care fragmentează identitatea.

Media este organizată în `Clips` short-form, `Pulse` conversație, `Watch` long-form
și `Live`. `Nexus Kids` este un produs separat, administrat de părinte, fără acces
la suprafețele adulte și fără wallet/istoric individual public pe blockchain.
Nexus Node Network pornește cu un singur Genesis Node și acceptă permissionless
orice nod nou pentru federation, storage, media, messaging, index și compute.
Protocolul funcționează pentru orice `N>=1`, scalează replicarea/sharding-ul automat
și poate plăti opțional munca verificată prin MultiversX fără a publica plaintext sensibil.

### Promisiune de brand

- Nume de lucru: **Nexus**.
- Tagline: **One wallet. Every side of you. Every way you move.**
- Personalitate: încrezătoare, umană, energică, discretă.
- Sistem vizual: fundal obsidian, suprafețe grafit, accent electric violet-cyan,
  câte o culoare secundară per context.
- Simbol: un nucleu format din șase arce care se întâlnesc fără a se contopi.
- Cerință pre-lansare: căutare de marcă EUIPO/WIPO și verificare de domenii.

### Standard permanent de excelență a produsului

Nexus nu urmărește o clonă de funcții sau un demo care doar seamănă vizual cu
produsele de referință. Pentru fiecare verticală, ținta de release este paritatea
pe journeys-urile esențiale și un avantaj demonstrabil de utilitate, încredere,
cost, control ori accesibilitate. Social este comparat cu Instagram/TikTok,
Messages cu WhatsApp/Teams, Work cu LinkedIn și platformele de joburi, iar celelalte
verticale cu liderii lor relevanți. Comparația este instrument intern de calitate,
nu element al interfeței și nu justifică reproducerea identității vizuale a altuia.

Reguli de acceptare permanente:

1. Niciun buton aparent funcțional nu rămâne decorativ: acțiunea funcționează
   end-to-end sau este dezactivată cu motiv și condiție de activare adevărate.
2. Fluxurile principale sunt mobile-first, accesibile, coerente și măsurate pentru
   claritate, timp până la rezultat, erori și revenire după întrerupere.
3. Blockchain-ul este folosit numai când adaugă proprietate, settlement, dovadă,
   portabilitate, transparență ori recompense verificabile. Media, PII și semnalele
   de volum mare/private rămân off-chain; UI nu obligă utilizatorul să înțeleagă gas.
4. Fiecare capabilitate nouă documentează plusul de valoare umană, riscurile,
   costul total, mecanismul anti-abuz, dreptul de control și dovada verificabilă.
5. Monetizarea trebuie să fie sustenabilă și corectă: engagement-ul gratuit nu
   este blocat, plățile sunt explicite, creatorii văd spliturile, iar platforma nu
   optimizează dependența, înșelarea sau exploatarea persoanelor vulnerabile.
6. Privacy, safety, Kids, fonduri și identitate sunt limite de produs, nu lucrări
   cosmetice de după lansare; niciun avantaj competitiv nu le poate ocoli.
7. Un feature nu este declarat „peste nivelul pieței” fără dovezi pe benchmark-uri
   publicate intern: coverage, UX testat, performanță, reliability, fairness și
   rezultate pentru utilizator. Absența dovezii înseamnă `in_progress`.
8. Fiecare packet lasă cod, teste, Evidence Pack și findings reutilizabile. Demo-ul
   poate avea limite declarate, dar starea finală nu acceptă mock-uri prezentate ca
   servicii reale, procente inventate sau afirmații blockchain neconfirmate.

## 2. Obiective și limite

### Obiective

1. Onboarding social/passkey cu wallet embedded sub două minute.
2. Comutare de profil sub 300 ms perceput, fără relogare.
3. Feed video cu pornire rapidă și ranking specific profilului activ.
4. Conversații E2EE care pot transporta obiecte comerciale semnabile.
5. Tranzacții escrow verificabile, cu stări inteligibile și dispute rezolvabile.
6. Separare demonstrabilă a datelor și recomandărilor între contexte.
7. Moderare și mecanisme de contestare integrate de la început.
8. Orice mutație intenționată produce o tranzacție MultiversX distinctă, fără
   popup wallet la fiecare tap după autorizarea cheii de sesiune.
9. Recomandări explicabile și controlabile, cu modele separate pe verticală.
10. Watch/Live pentru creatori, cu rights, safety, monetizare și replay integrate.
11. Un standard de produs comparabil sau superior liderilor de categorie pe
    journeys-urile esențiale, demonstrat prin calitate și valoare, nu prin copiere.

### Non-obiective MVP

- plaintext sau PII on-chain; view/progress, typing, presence, GPS ping și frames
  media nu sunt mutații de produs și nu produc tranzacții;
- token transferabil sau DAO public;
- live streaming la scară mare;
- sejururi în toate jurisdicțiile;
- minori în aplicația adultă; Nexus Kids se lansează ulterior ca produs separat;
- algoritm ML complet autonom;
- stocarea permanentă a tuturor fișierelor media pe IPFS.

## 3. Modelul unificat al produsului

```text
Google/Apple/Facebook/TikTok sau wallet existent
└── Nexus Account + wallet MultiversX embedded/controlat de utilizator
    ├── Context Profiles
    │   ├── Social  ─ Clips, stories, events și creator graph
    │   ├── Work    ─ CV, rețea, joburi, recomandări
    │   ├── Dating  ─ discovery, swipe, match, safety
    │   ├── Travel   ─ host/guest, stays, experiences
    │   ├── Market   ─ vânzare, cumpărare, livrare/predare
    │   └── Mobility ─ rider/driver, curse, tracking, safety
    ├── Business & Services (pagini, staff, calendar, programări)
    ├── Music (catalog licențiat, playback, artiști, royalties)
    ├── Grow (Nutrition, Sport, Learning)
    ├── Pulse (conversație publică, aliasuri, topics și Community Context)
    ├── Watch & Live (channels, long-form, subscriptions, streams și replay)
    ├── Promotion & Review Graph
    ├── Agent Network (agenți AI etichetați, tasks și agent economy)
    ├── Nexus Assurance & Control (QE, security, privacy, safety, SRE și release)
    ├── Nexus Node Network (federation, storage, media, index și edge nodes)
    ├── Trust Passport (vectori separați și dovezi)
    ├── Unified Inbox (identități de expeditor pe context)
    ├── Wallet & Transactions
    └── Safety Center (privacy, block, reports, recovery)

Adult Nexus Account
└── Family Center → Nexus Kids app/tenant
    └── Child profile → catalog age-appropriate, parent controls, fără open social
```

### Reguli de context

- O acțiune este executată întotdeauna de un `actorProfileId`, nu direct de cont.
- API-ul refuză mutațiile fără header-ul de context și verificarea apartenenței.
- Relațiile sunt între profiluri; blocarea poate fi pe profil sau pe întreg contul.
- Linkarea a două profiluri este bilaterală, revocabilă și implicit privată.
- Wallet-ul nu este afișat în interfața socială decât dacă utilizatorul alege.
- Operatorul poate corela profilurile pentru anti-abuz, dar accesul este auditat și
  nu este disponibil ranking-ului sau personalului obișnuit.
- Modul incognito este o stare temporară a unui profil, nu un cont fără răspundere.

## 4. Capabilități comune

### Identitate și acces

- onboarding principal prin Google, Apple, Facebook sau TikTok; la primul login se
  creează/recuperează automat un wallet embedded non-custodial;
- login alternativ prin xPortal/WalletConnect, web wallet, extension, Ledger,
  passkey și providerii suportați de SDK-ul MultiversX;
- identitățile sunt legate prin `(issuer, subject)`, niciodată prin email singur;
- recovery, export/migrare și conectarea unui wallet extern sunt obligatorii;
- Nexus nu deține singur materialul suficient pentru semnarea activelor;
- NativeAuth verificat server-side, session rotation și device registry;
- acceptarea termenilor versionată și legată de wallet;
- recovery rămâne responsabilitatea wallet-ului; Nexus oferă ghidare, nu custody;
- onboarding 18+, țară, limbă, consent center și primul profil;
- relayed transactions v3 pentru wallet-signed actions și action-relay cu chei de
  sesiune pentru fluxurile sociale, ambele cu cote per wallet/device/IP.

### Every Action on MultiversX

`1 mutație intenționată = 1 tranzacție MultiversX`. Sunt incluse:

- create/edit/tombstone pentru post, comment, story, job, listing și profil anchor;
- like/unlike, follow/unfollow, save/unsave, share, connect și recommendation;
- message send/edit/delete commitment, group membership și reaction;
- Dating swipe/pass/match/unmatch ca private commitments;
- offer/counteroffer/order/booking/ride/event/split/tip și review;
- report/appeal ca evidence commitments fără conținutul raportului.

Nu sunt acțiuni: playback progress/view telemetry, impressions, scroll, typing,
presence, push delivery, GPS ping, WebRTC packets, video segments și job intern.
Nexus Kids este excepție normativă: acțiunile copilului rămân off-chain, criptate
și ștergibile; numai acțiunea adultului și rights/payout agregat pot avea tx fără child ID.

Wallet-ul autorizează o cheie Ed25519 de sesiune cu profile scopes, action scopes,
limită, device și expirare. Dispozitivul semnează un `ActionEnvelope`; un relayer
per shard îl trimite la `nexus-actions`, iar contractul verifică semnătura.
Operațiile financiare rămân semnate explicit de wallet și merg în contractele de
domeniu. Acțiunile private sunt trimise de privacy relay cu commitments și dovada
utilizatorului păstrată criptat.

UI-ul este optimist și arată stările de la `RELAY_QUEUED` până la
`ORDERED_FINAL`, `EXECUTION_PENDING`, `EXECUTED_SUCCESS` sau `EXECUTED_FAIL`.
Sub Supernova, finalitatea ordonării nu este confundată cu succesul execuției. Read model-ul
off-chain servește feed-ul rapid, dar poate fi reconstruit din tranzacții și
manifestele referite. Ștergerea produce o tranzacție tombstone; nu poate elimina
istoricul deja publicat.

### Supernova readiness și cost

- runtime dual `ANDROMEDA_COMPAT`/`SUPERNOVA`, activat prin capabilitățile observate
  ale rețelei, nu prin dată sau presupunere;
- consensul/finalitatea și rezultatul execuției sunt urmărite separat;
- Action Relay aplică backpressure per shard și fair-use sponsorship;
- utilizarea normală socială este sponsorizată, cu limite Sybil și treasury caps;
- niciun contract nu presupune o durată fixă a blocului;
- specificația completă este în [`10-supernova-economics-compliance.md`](10-supernova-economics-compliance.md).

### Context switcher

- acces permanent din avatar;
- preview pentru notificări ne-citite pe fiecare profil;
- confirmare vizuală a profilului activ în composer, chat și checkout;
- „panic switch” către Social și ascunderea rapidă a Dating;
- politici de linkare și audience per pereche de profiluri.

### Trust Passport

Nu există un scor unic. Passport-ul are componente independente:

- `identity_assurance`: wallet age, device continuity, verificări voluntare;
- `work_trust`: credentiale și recomandări;
- `commerce_trust`: comenzi finalizate, anulări, dispute;
- `host_trust` și `guest_trust`;
- `driver_trust` și `rider_trust`: curse finalizate, anulări, safety și dispute;
- `community_trust`: încălcări confirmate și contribuții;
- `dating_safety`: verificare de vârstă/liveness și incidente confirmate, fără
  expunerea preferințelor sau a unui clasament public.

Fiecare semnal are sursă, dată, expirare, contestabilitate și vizibilitate.

### Inbox unificat

- 1:1 și grupuri E2EE;
- identitatea afișată este profilul participant la conversație;
- requests inbox pentru persoane necunoscute;
- atașamente, reacții, reply, editare, ștergere locală și expirare;
- obiecte structurate: listing, booking, ride, event, split, tip, job;
- confirmările financiare sunt tranzacții semnate, nu simple mesaje;
- utilizatorul poate raporta selectiv mesaje și atașa dovezi decriptate.

### Safety și moderare

- block/mute/restrict, report cu categorii, apel și status;
- filtre pentru nuditate, violență, fraude, bunuri interzise și copyright;
- detectarea spamului și Sybil prin semnale off-chain, fără publicarea identității;
- cozi de moderare cu SLA în funcție de severitate;
- suspendare separată pe verticală sau globală;
- audit log imuabil off-chain, cu hash-uri periodice ancorate on-chain opțional.

## 5. Feature inventory și fazare

### MVP — fundament și pilot (P0)

**Platformă comună**

- NativeAuth, device/session management, profiluri și context switcher;
- privacy matrix, linkare profiluri, block/report, notifications;
- chat E2EE 1:1 și grupuri mici;
- search profil/listing, admin console și observabilitate;
- Identity Broker, wallet embedded, passkey/recovery/export și social login;
- Country Capability Matrix pentru rollout global per funcție și țară;
- Test Bot Fabric în non-production și Nexus Service Agents etichetați;
- wallet activity și tranzacții gas-sponsored eligibile.

**Social**

- upload video până la 180 secunde, transcoding HLS și thumbnail;
- For You/Following, autoplay, like, comentarii, share extern, follow, save;
- creator page, hashtags, sounds ca referințe licențiate/originale;
- ranking heuristic + explorare, feedback „not interested”;
- duet/stitch prin referință și autorizarea creatorului;
- stories foto/video 24h fără arhivare publică implicită.

**Watch și Live**

- channels, long-form VOD, subscriptions, playlists, Watch Later și Continue Watching;
- player adaptiv, captions, chapters, transcript, search și Creator Studio;
- scheduled live/Premiere, managed ingest, LL-HLS, moderatori, chat și replay;
- tips/memberships și creator payouts numai cu rights/safety/payment eligibility;
- Subscriptions/Editorial neprofilat, explicații și reset recommendations;
- fiecare publish/like/comment/subscribe/playlist/chat/tip adult produce tx conform
  clasificării; view/progress/stream packets rămân telemetrie.

**Nexus Kids — produs separat**

- Family Center, parental authority/consent, age bands și privacy maximă implicită;
- catalog editorial/allowlisted, search sigur, playlists, captions și time controls;
- fără Dating/Pulse/Market/wallet, upload public, DM, comments libere sau open chat;
- fără publicitate comportamentală, ad identifiers, precise location sau profilare
  sensibilă; autoplay off și experiențe finite implicit;
- Live numai de la creatori/instituții verificate, cu delay, moderator și fără chat liber;
- activitatea copilului rămâne criptată și ștergibilă off-chain; chain-ul ancorează
  numai consimțământ adult generic, rights/payout și agregate fără child identifier;
- specificația completă este în
  [`15-recommendations-clips-watch-live-kids.md`](15-recommendations-clips-watch-live-kids.md).

**Work**

- profil profesional, experiență, educație, skills, portfolio;
- conexiuni și recomandări cu tranzacție și hash/CID on-chain;
- job posts, căutare și aplicare prin chat/link extern;
- export CV PDF și credentiale verificabile.

**Dating**

- profil 18+, identitate și selecții incluzive, intenții, hard/soft filters;
- Curated/Explore, Compatibility Card și mutual preference eligibility;
- match mutual, chat numai după match, unmatch și safety check-in;
- selfie/liveness prin furnizor specializat; se stochează rezultatul, nu biometria
  brută, dacă fluxul și temeiul juridic permit;
- Dating Trust Passport cu Adult/Photo/Liveness/Meeting signals, fără scor scalar;
- Incognito liked-only, alias/fotografii separate, generic notifications și panic lock;
- media View Once non-explicită, E2EE, cu TTL și avertisment anti-capture;
- Meet Safe, video call, trusted contact, PIN/check-in și scam/crypto warnings;
- fiecare swipe/match/message are tranzacție de commitment prin privacy relay,
  fără a publica persoanele sau alegerea în clar.

**Pulse — conversație tip X**

- post text/media, thread, reply, repost, quote, like, bookmark și lists;
- For You, Following, Topics și feed cronologic selectabil;
- Named Context, Persistent Alias și Agent label; fără random anonymous chat;
- identitate `verified human, identity private` în faza eligibilă;
- reply/quote/mention controls, block/mute/keywords și temporary posts;
- trends fără bot/paid contamination și Community Context cu surse;
- fiecare mutație produce tx compact; views/impressions rămân off-chain.

**Market — classifieds generalist OLX-like**

- Market este accesibil global din Home, Discover, Create, Inbox și profil,
  indiferent de contextul activ; publicarea folosește profilul Market;
- anunțuri pentru bunuri, vehicule, imobiliare, servicii, electronice, casă,
  modă, hobby, business și alte categorii permise legal;
- scheme dinamice pe categorie, locație, preț, negociabil, stare și media;
- căutare locală/globală, hartă, filtre, saved searches și favorite;
- chat, ofertă/contraofertă, rezervare, predare locală sau tracking extern;
- mod `CLASSIFIED_ONLY` pentru contact direct și `ESCROW_CHECKOUT` pentru cumpărare
  protejată în EGLD/ESDT aprobat;
- fiecare create/update/renew/close/share/favorite/offer este tranzacție distinctă;
- anulare, confirmare, timeout, refund și dispute pentru checkout;
- trader/non-trader declaration, product safety și categorii interzise.

**Travel pilot**

- profil host/guest, listing, calendar și cerere de rezervare;
- quote semnat, escrow, anulare, check-in/out și review bilateral;
- lansare doar într-o jurisdicție după validarea regulilor locale.

**Mobility pilot**

- profil Rider/Driver, verificare driver, vehicul și documente cu expirare;
- cerere cursă A→B, estimare transparentă, șoferi disponibili și acceptare;
- tracking în timp real, ETA, contact E2EE, PIN de start și share trip;
- quote înghețat, escrow EGLD/ESDT aprobat, anulare/no-show și settlement;
- rating bilateral, SOS, incident report și dispută;
- fără pooling, multi-stop, curse programate sau surge complex în MVP;
- activare publică numai după autorizarea platformei și a operatorilor în orașul pilot.

**Business, Services și reviews**

- Business Pages cu locații, staff, delegați, servicii și inbox comun;
- căutare locală pentru frizer/coafor, servicii, preț, staff și slot disponibil;
- calendar, quote, depozit opțional, anulare/no-show, check-in și review verificat;
- Promotion Engine pentru obiecte eligibile, cu marcaj și explicația targetării;
- Review Graph universal, bazat pe eligibilitate tranzacțională și fără scor Dating
  sau sănătate public;
- contract `nexus-appointments` pentru programările cu depozit/escrow.

**Music și Grow pilot**

- streaming pentru catalog independent cu drepturi directe, artist pages, search,
  library, playlists, tips și royalty statements;
- fără catalog comercial nelicențiat, lyrics/offline sau promisiune de catalog Spotify;
- Grow cu educație nutrițională generală, rețete, programe sport, cursuri și booking
  cu provider eligibil;
- fără diagnostic/tratament, planuri clinice sau targetare publicitară pe date de
  sănătate;
- toate limitele sunt definite în [`12-music-wellness-learning.md`](12-music-wellness-learning.md).

### Phase 2 — retenție și tranzacții (P1)

- live streaming controlat, gifts și tipping;
- editor video, filtre, effects, sound catalog licențiat;
- grupuri sociale, evenimente, invitații, RSVP și split payment;
- experiențe Travel, instant book pentru gazde eligibile;
- livrare integrată și buyer protection extins;
- boosts etichetate clar, subscriptions și creator analytics;
- calendar availability sync, dynamic pricing asistat;
- curse programate, destinații multiple, accessibility preferences și driver incentives transparente;
- feed embedding/model learning cu feature store și experiment platform;
- mesaje temporare și backup E2EE opt-in;
- badge-uri NFT/dynamic tokens pentru ticketing și verificări publice;
- portal de transparență și automatizarea fluxurilor DAC7.
- Agent Registry, Business Agents și developer sandbox;
- Business Pro, calendar sync, mai multe locații și analytics;
- Music Premium/offline după licențiere, distributor ingestion și royalties avansate;
- Grow subscriptions, device integrations opt-in și marketplace de cursuri matur;
- Dating verified meetings, Intent Rooms, Introductions și verified events;
- Pulse Communities, Spaces, long-form, subscriptions și Community Context matur;
- Watch 4K/series/premieres/podcasts, memberships și Creator Studio avansat;
- live multi-guest, DVR, captions, tips, clipping, replay și multi-region failover;
- learning-to-rank separat pentru Clips/Pulse/Watch/Dating/commerce, cu model cards;
- Nexus Kids VOD pilot într-o țară, fără ads/open social/live al copilului;

### Phase 3 — scalare (P2)

- live multi-guest, commerce live și replay;
- Nexus Kids education partnerships, safe institutional live și on-device ranking auditat;
- creator fund cu reguli publice și anti-fraudă;
- advanced recruiting, company pages și credential issuers;
- travel multi-country, insurance partners și channel manager;
- Mobility multi-city, airport queues, fleet accounts și pooling după validarea safety;
- dispute arbitration network cu operatori acreditați;
- ZK/selective disclosure pentru vârstă și credentiale când tooling-ul este matur;
- API/SDK pentru mini-aplicații și parteneri;
- A2A/MCP gateway, agent marketplace și agent-to-agent task economy;
- privacy-preserving adult/human claims și Pulse federation după abuse tests;
- catalog muzical comercial numai prin acorduri multi-teritoriale;
- acreditări educaționale prin parteneri și eventual produs medical separat, numai
  după regulatory gate;
- localizare, accessibility completă și infrastructură multi-region;
- evaluarea unui token numai după product-market fit și opinie MiCA formală.

## 6. Indicatori de succes și guardrails

### North-star

`Weekly Trusted Interactions`: conversație mutuală, conexiune acceptată, vizionare
semnificativă cu feedback pozitiv, eveniment participat sau tranzacție finalizată,
ponderate fără a recompensa spamul.

### Metrici MVP

- onboarding completion > 65%; time-to-first-value < 5 minute;
- social-login-to-wallet success > 99%; time-to-feed p95 < 60 secunde;
- wallet recovery success și zero account merge fără dovada ambelor identități;
- Human MAU, Agent MAU și synthetic traffic raportate separat;
- D1/D7/D30 pe profil și cross-context adoption;
- video start p95 < 1,5 secunde pe conexiuni țintă;
- message delivery p95 < 2 secunde online;
- escrow reconciliation 100%; nicio diferență contabilă tolerată;
- action tx success > 99,5%, pending age p95 și gas/action pe tip/shard;
- report acknowledgement < 24h; urgențe safety < 1h în programul pilot;
- false-positive moderation și appeal overturn rate;
- dispute rate, refund time și charge/transaction failure rate;
- ride acceptance/cancellation, pickup ETA, safety incidents și earnings transparency;
- appointment conversion/no-show, utilization per staff și dispute rate;
- ad invalid-traffic rate, spend reconciliation și organic/paid separation;
- verified-review coverage, fake-review rate și appeal overturn rate;
- cost/minute Music, qualified listens, rights conflicts și royalty reconciliation;
- Grow completion, safety escalations și zero health-data ad targeting;
- Dating verification adoption, scam/no-show/safety rate și appeal accuracy;
- Pulse healthy conversations, alias abuse, source/correction și clean-trend rate;
- Clips satisfaction/diversity, Watch meaningful watch și recommendation reset success;
- Live startup/failover, incident intervention și payout reconciliation;
- Kids zero cross-tenant leak/behavioral ads/open social și parent-control success;
- separarea contextelor: zero acces neautorizat confirmat.

### Guardrails de ranking

- nu se transferă semnale Dating către Work/Social;
- nu există Dating desirability/seriousness score scalar ori public date reviews;
- Pulse alias nu este promis ca anonimat absolut și nu permite random anonymous chat;
- Kids nu folosește Dating/ad features, wallet/chain behavior sau engagement-maximizing nudges;
- nu se folosesc categorii speciale GDPR pentru targetare;
- boosts sunt marcate și nu pot învinge safety filters;
- utilizatorul poate reseta recomandările și vedea motive generale;
- măsurăm diversitatea expunerii, reclamațiile și consumul compulsiv.

## 7. Criterii de lansare

MVP-ul poate intra în beta numai dacă:

1. toate fluxurile financiare au teste de invariant și reconciliere;
2. contractele au review intern, fuzz/scenario tests și audit extern independent;
3. DPIA, RoPA, retention schedule și DSA notice/action sunt operaționale;
4. există termeni separați pentru social, dating, marketplace și travel;
5. există on-call, kill switches, pause control cu multisig și runbooks;
6. seed phrases nu apar în infrastructura Nexus;
7. backup restore, key rotation și incident response au fost exersate;
8. moderarea și appeals au personal/proces pentru volumul pilot;
9. app-store privacy labels și permisiunile mobile sunt verificate;
10. lansarea geografică a Travel/Market/Mobility este aprobată per jurisdicție;
11. driver, vehicle, insurance, platform-work și incident response controls sunt operaționale.
12. registry-ul mutațiilor adulte demonstrează că fiecare acțiune user-visible produce
    exact un tx și că acțiunile private nu publică target/plaintext; Kids respectă
    excepția de minimizare și nu creează child tx.
13. adaptorul Supernova a trecut shadow indexing și separă ordered de executed;
14. programările cu bani au contract auditat, politici snapshot și dispute;
15. reclamele și review-urile respectă transparency/eligibility și apel;
16. nicio piesă nu este disponibilă în afara rights matrix active;
17. Grow este limitat la clasele W0/W1 și a trecut DPIA/health-targeting tests.
18. embedded wallet a trecut audit criptografic, recovery/export drills și nu
    permite operatorului să reconstruiască singur cheia;
19. agenții sunt etichetați, excluși din Dating/reviews/paid metrics și limitați
    prin capabilities, budgets și kill switch;
20. fiecare funcție este activată numai unde `CountryPolicy` o permite.
21. Dating preferences/verification/location au DPIA, consent și isolation tests;
22. View Once a trecut crypto/purge/report tests și afișează limita screenshot-ului;
23. Pulse are UGC filtering, block/report, alias vault și trend anti-bot funcționale.
24. Clips/Watch/Live au rights, audience rating, report/block și recommender controls.
25. Live poate fi terminat instant, independent de chain, iar replay-ul trece moderare.
26. Nexus Kids este separat ca binary/tenant, are parental consent, catalog aprobat,
    zero behavioral ads/open social și nicio urmă publică individuală pe chain.
27. fiecare epic are owner, task packet, checker independent, Evidence Pack și
    release gate conform
    [`16-agent-delivery-continuous-assurance.md`](16-agent-delivery-continuous-assurance.md).
28. funcțiile financiare, Kids, Live și country-regulated nu pot fi auto-certificate
    de agentul care le-a construit.
29. Nexus Node Network a trecut conformance, `N=1` recovery, replica diversity când
    `N>=3`, state-sync,
    Sybil/eclipsing, storage proof, receipt fraud și protocol rollback tests.
30. open nodes pot ruta numai public sau ciphertext; nu primesc chei/plaintext Dating,
    Kids activity, precise location, KYC, tax ori safety evidence.

## 8. Surse tehnice și normative principale

- [MultiversX: Relayed Transactions v3](https://docs.multiversx.com/developers/relayed-transactions/)
- [MultiversX: Transactions și finalitate](https://docs.multiversx.com/learn/transactions/)
- [MultiversX: Smart Contract Crypto API](https://docs.multiversx.com/developers/developer-reference/sc-api-functions/)
- [MultiversX: Events](https://docs.multiversx.com/developers/developer-reference/sc-annotations/)
- [MultiversX: SDK dApp](https://docs.multiversx.com/sdk-and-tools/sdk-dapp/)
- [MultiversX: signing providers și NativeAuth](https://docs.multiversx.com/sdk-and-tools/sdk-js/sdk-js-signing-providers)
- [MultiversX: ESDT](https://docs.multiversx.com/tokens/intro/)
- [MultiversX: NFT și SFT](https://docs.multiversx.com/tokens/nft-tokens/)
- [GDPR — Regulamentul (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng)
- [Digital Services Act — Regulamentul (UE) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [MiCA — Regulamentul (UE) 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj)
- [Comisia Europeană: DAC7](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/dac7_en)
- [MultiversX: Supernova architecture](https://multiversx.com/blog/supernova-decoupling-consensus-and-execution)
- [Directiva DSM 2019/790](https://eur-lex.europa.eu/eli/dir/2019/790/oj)
- [Directiva 2014/26/UE privind drepturile muzicale online](https://eur-lex.europa.eu/eli/dir/2014/26)
- [Directiva Omnibus 2019/2161 — review-uri](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
- [MDR — Regulamentul (UE) 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng)
- [MultiversX xAlias și wallet terminology](https://docs.multiversx.com/welcome/terminology/)
- [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [TikTok Login Kit](https://developers.tiktok.com/doc/login-kit-web)
- [A2A Protocol](https://a2a-protocol.org/latest/specification/)
- [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [EDPB: cazul Grindr și datele privind orientarea sexuală](https://www.edpb.europa.eu/news/national-news/2021/norwegian-dpa-intention-issue-eu-10-million-fine-grindr-llc_en)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: clarificarea random/anonymous chat din februarie 2026](https://developer.apple.com/news/?id=d75yllv4)
- [Google Play: UGC policy](https://support.google.com/googleplay/android-developer/answer/12923286)
- [Google Play: restricția minorilor pentru Dating](https://support.google.com/googleplay/android-developer/answer/16838200)
- [FTC: romance scams](https://consumer.ftc.gov/articles/what-know-about-romance-scams)
- [FTC: COPPA Rule amendments 2025](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data)
- [Comisia Europeană: DSA Guidelines for protection of minors](https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines)
- [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Apple: safe and age-appropriate experiences](https://developer.apple.com/kids/)
- [ICO Children’s Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code)

Modelul funcțional și economic comun pentru Work, Market, Stay, Ride, Beauty,
Music, Wellbeing și Nexus Pay este normat în
[`22-fair-vertical-platforms.md`](22-fair-vertical-platforms.md).

Acest document oferă cerințe tehnice și o hartă de conformitate. Nu constituie o
opinie juridică pentru o jurisdicție specifică și nu înlocuiește certificarea
independentă a contractelor care vor administra fonduri reale.
