# Arhitectura tehnică

## 1. Principii

- **Every action, hybrid payload:** fiecare mutație adultă intenționată este tx;
  chain-ul ține envelope/hash/commitment și settlement, iar plaintext-ul personal,
  media, căutarea, ranking-ul și transportul E2EE rămân off-chain. Kids are excepție:
  activitatea copilului nu produce tx individual.
- **Context first:** fiecare request mutabil conține profilul actor și este
  autorizat față de wallet-ul autentificat.
- **Modular înainte de distribuit:** un backend modular bine delimitat este mai
  sigur și mai rapid decât microservicii create înainte de trafic.
- **Event-driven la margini:** outbox transactional publică evenimente către
  jobs, search, notificări și indexer fără dual writes.
- **Zero custody:** aplicația nu deține cheile utilizatorilor.
- **Privacy boundaries:** serviciul de ranking nu primește date Dating brute sau
  mapping-ul dintre profiluri dacă nu este strict necesar.

## 2. Diagramă high-level

```text
┌──────────────────────────────── CLIENTS ────────────────────────────────┐
│  React Native / Expo             Next.js Web             Admin Web      │
│  feed, camera, chat, wallet      public/work/host         moderation     │
└──────────────┬────────────────────────┬────────────────────────┬─────────┘
               │ HTTPS / WS            │                        │
        ┌──────▼────────────────────────▼────────────────────────▼───────┐
        │ Edge: CDN, WAF, bot control, API gateway, rate limits         │
        └──────┬─────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────── NEXUS CORE ──────────────────────────┐
│ NestJS modular monolith                                                 │
│ Auth/Identity Broker │ Accounts/Embedded Wallets │ Profiles │ Graph     │
│ Clips/Pulse/Watch/Live │ Dating/Trust/Safety │ Market │ Country Policy   │
│ Mobility │ Business/Services │ Promotion/Reviews │ Music │ Grow       │
│ Chat facade │ Trust │ Moderation │ Notifications │ Payments │ Admin    │
│                    Transactional outbox + audit log                      │
└──────┬───────────┬───────────┬───────────┬───────────┬─────────────────┘
       │           │           │           │           │
 ┌─────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼──────────────┐
 │PostgreSQL│ │ Redis    │ │Search   │ │BullMQ   │ │Matrix homeserver │
 │source of │ │cache/RT  │ │index    │ │workers  │ │E2EE ciphertext   │
 │truth     │ │limits    │ │         │ │         │ │                  │
 └──────────┘ └─────────┘ └─────────┘ └────┬────┘ └───────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────┐
               │ Media: signed upload → object storage → FFmpeg     │
               │ → moderation → HLS renditions → CDN; optional IPFS │
               └────────────────────────────────────────────────────┘

┌──────────────────────── BLOCKCHAIN ADAPTER ─────────────────────────────┐
│ NativeAuth │ embedded-wallet adapter │ agent relay │ tx/index/reduce    │
└──────────┬──────────────────────────────────────────────────────────────┘
           │ MultiversX API/Gateway + websocket/polling
┌──────────▼──────────────── MULTIVERSX ───────────────────────────────────┐
│ Action Ledger shard 0/1/2 │ Identity │ Trust │ Badge/ticket tokens       │
│ Marketplace │ Booking │ Ride │ Appointments │ Royalties │ Tips │ Treasury│
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────── NEXUS NODE NETWORK ─────────────────────────────────┐
│ Gateways/Relays │ Shard Replicas │ Storage/Edge │ Media/Live Workers   │
│ Matrix Homeservers │ Index/Recommender │ Assurance/Checkpoint Nodes    │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Stack recomandat la 2026-08-01

Versiunile exacte se blochează în lockfile după spike-ul de compatibilitate.
Versiunile din promptul inițial (RN 0.76, Expo 52, Node 20) nu mai sunt baseline.

| Strat | Alegere | Motivație |
|---|---|---|
| Mobile | Expo SDK 57 / React Native 0.86, TypeScript strict, New Architecture | baseline stabil curent, OTA controlat și module native când sunt necesare |
| UI mobile | Tamagui + Reanimated + FlashList/video primitives | theme tokens, dark mode, animații și liste performante |
| State | TanStack Query + Zustand | server state separat de state efemer/UI |
| Web | Next.js 16 App Router | SSR/SEO pentru Work, listings și pagini publice |
| Backend | Node.js 24 LTS, NestJS 11, Fastify adapter | LTS, module clare, performanță bună |
| Contract/API | OpenAPI 3.1 + Zod; DTO generate | validare unică și clienți tipizați |
| DB | PostgreSQL 17+ cu PostGIS și `pgvector` | tranzacții, geo, ranking candidates și embeddings |
| Cache/jobs | Redis 8-compatible + BullMQ | cache, rate limits, presence, delayed jobs |
| Geo/dispatch | PostGIS + Redis GEO/geohash + WebSocket | nearby-driver candidates și tracking efemer |
| Search | Meilisearch pentru MVP; OpenSearch la nevoie | setup simplu, typo tolerance, faceting |
| Messaging | Matrix-compatible homeserver + E2EE; Nexus facade | protocol matur, fără blocarea domeniului în provider |
| Media | S3-compatible, FFmpeg workers, HLS/CMAF, CDN | cost și performanță controlabile |
| Live | managed RTMP/SRT/WebRTC ingest + LL-HLS/CMAF în P1/P2 | adapter și failover înainte de infrastructură globală proprie |
| Blockchain | Rust stable compatibil, `multiversx-sc` stabil curent, `sc-meta`, scenario tests | suport nativ și testare VM |
| MultiversX JS | `sdk-dapp`, `sdk-core`, NativeAuth server, SDK v15+ compatibil | wallet providers și tranzacții actuale |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Sentry | traces, metrics, logs și crash reporting |
| Infra | Docker, Terraform/OpenTofu, managed Kubernetes doar după nevoie | medii reproductibile fără K8s prematur în pilot |
| CI/CD | pnpm monorepo + Turborepo/Nx, GitHub Actions-compatible | cache, builds selective și contracte partajate |

Surse de versionare: [Node.js releases](https://nodejs.org/en/about/previous-releases),
[Expo SDK](https://docs.expo.dev/versions/latest/),
[NestJS 11 migration](https://docs.nestjs.com/migration-guide),
[Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16).

## 4. Topologia backend

### Module în procesul API

1. `AuthModule`: NativeAuth, sesiuni, dispozitive, risk scoring.
1A. `IdentityBrokerModule`: Google/Apple/Facebook/TikTok OIDC/Login Kit, linking.
1B. `EmbeddedWalletModule`: provision, passkey, recovery, export și external links.
2. `AccountModule`: cont, consimțăminte, wallet links, export/delete.
3. `ProfileModule`: profiluri, switch, privacy matrix și profile links.
4. `GraphModule`: follow, connect, block, close friends.
5. `ActionModule`: session capabilities, action envelopes, relay și tx status.
6. `ContentModule`: posts, stories, comments, reactions, sounds.
7. `FeedModule`: candidates, ranking, impressions și feedback.
8. `DatingModule`: preferences, candidates, swipes, matches și safety.
9. `WorkModule`: CV, skills, credentials, jobs, applications.
10. `ClassifiedsModule`: categories, ads, favorites, offers, orders și fulfillment.
11. `TravelModule`: properties, units, rates, calendar și booking intents.
12. `MobilityModule`: driver eligibility, availability, dispatch, trips, fares și safety.
13. `PaymentModule`: quotes, transaction intents, escrow și reconciliation.
14. `TrustModule`: attestations, reviews, badge status și trust vectors.
15. `MessagingModule`: Matrix facade, conversation ACL și structured messages.
16. `ModerationModule`: reports, cases, decisions, appeals și evidence vault.
17. `NotificationModule`: inbox, push, email optional și preferences.
18. `SearchModule`: index policies și privacy-filtered queries.
19. `ChainModule`: transaction construction, relay, index și confirmations.
20. `AdminModule`: RBAC/ABAC, queues, maker-checker și audit.
21. `OrganizationModule`: Business Pages, members, locations și delegare.
22. `ServiceModule`: catalog local, staff, availability și appointments.
23. `PromotionModule`: campaigns, creatives, delivery, billing și transparență.
24. `ReviewModule`: eligibility, reviews, responses, disputes și agregate.
25. `MusicModule`: catalog, rights, playback entitlement și royalty statements.
26. `GrowModule`: wellness privat, workouts, courses, providers și credentials.
27. `CountryPolicyModule`: feature/token/provider/legal-entity gates per țară.
28. `AgentModule`: Agent Profiles, manifests, capabilities, tasks și reputation.
29. `AgentGatewayModule`: A2A/MCP/OpenAPI adapters, authorization și sandbox.
30. `SyntheticTestModule`: scenario DSL, bot orchestration și metric isolation.
31. `PulseModule`: aliases, posts, graph, topics, trends și Community Context.
32. `DatingTrustModule`: verification claims, trust signals, meet plans și appeals.
33. `EphemeralMediaModule`: E2EE one-time keys, TTL, purge și report boundary.
34. `ChannelModule`: channels, ownership, roles, subscriptions și memberships.
35. `WatchModule`: long-form VOD, playlists, premieres, history și Creator Studio.
36. `LiveModule`: schedule, eligibility, ingest, guests, moderation, replay și tips.
37. `RecommendationModule`: candidate generators, per-surface rankers, explanations și reset.
38. `FamilyModule`: parental authority/consent, age bands și parent controls.
39. `KidsCatalogModule`: allowlisted catalog, editorial policy și child-safe playback.
40. `AssuranceControlModule`: controls, findings, evidence, approvals și release gates.
41. `NodeNetworkModule`: node registry facade, placement, receipts și protocol policy.

Modulele nu citesc direct tabelele altor module. Folosesc servicii publice sau
evenimente. Pentru operații atomice din același proces pot împărți o tranzacție
PostgreSQL printr-un application service explicit.

### Procese deployabile MVP

- `api`: REST + webhooks;
- `realtime`: websocket presence, typing și notificări, nu plaintext E2EE;
- `worker`: jobs generale;
- `media-worker`: probe/transcode/thumbnails/moderation;
- `audio-worker`: fingerprint, loudness, renditions și encrypted packaging;
- `chain-indexer`: loguri, confirmations, reorg handling, reconciliation;
- `action-relayer-{shard}`: verifică session envelope, cote și trimite 1 tx/acțiune;
- `action-reducer`: reconstruiește read models și repară stările din chain;
- `scheduler`: expirări, release windows, stories și retention;
- `dispatch-realtime`: driver presence, offer fan-out, trip location și ETA;
- `rights-worker`: clearance, territory entitlements, usage aggregation și statements;
- `promotion-worker`: delivery pacing, invalid traffic și billing reconciliation;
- `identity-worker`: provider token lifecycle, deauthorization și recovery alerts;
- `agent-gateway`: A2A/MCP tasks, protocol auth, sandbox și budget enforcement;
- `synthetic-orchestrator`: numai non-production/canary, cu namespace separat;
- `pulse-integrity-worker`: trends, coordination, notes bridging și alias abuse;
- `ephemeral-purge-worker`: key revoke, origin/CDN purge și verification receipts;
- `recommendation-worker`: features, candidates, offline evaluation și model rollout;
- `live-control`: provider ingest health, failover, moderation signals și emergency end;
- `live-replay-worker`: recording, VOD transcode, rights/moderation și replay publish;
- `kids-catalog-worker`: age/country eligibility, editorial expiry și cross-tenant audit;
- `control-runner`: policy-as-code, scheduled controls, evidence collection și findings;
- `release-controller`: provenance, approvals, flags/caps și environment promotion;
- `nexus-node`: Rust/libp2p daemon pentru events, shards, storage, jobs și receipts;
- `node-settlement-worker`: verifică receipt roots, disputes și node reward claims;
- `admin-web`, `public-web`, `mobile`.

Nexus Assurance & Control este independent operațional de guild-urile Delivery.
Topologia, task packets, stage gates și test program sunt definite în
[`16-agent-delivery-continuous-assurance.md`](16-agent-delivery-continuous-assurance.md).

## 5K. Nexus Node Network

- application shards sunt separate de MultiversX execution shards; placement-ul
  folosește rendezvous hashing, replica diversity și Country/DataClass filters;
- MultiversX confirmă action order/settlement; libp2p QUIC/GossipSub propagă events,
  iar reducers/checkpoints materializează și compară state off-chain;
- ActivityPub bridge deservește numai public social; Matrix federation deservește
  E2EE rooms; IPFS este numai opt-in pentru conținut public permanent;
- storage/media/live jobs folosesc off-chain quotes/receipts și settlement periodic,
  nu tx per segment/packet;
- rețeaua pornește la `N=1`; `R=min(N,target)` și shard split/merge sunt automate;
- orice peer intră fără aprobare; wallet/bond sunt necesare numai pentru anumite rewards;
- open nodes pot transporta ciphertext, dar nu primesc chei/plaintext Dating,
  child activity, location exact, KYC/tax ori safety evidence;
- specificația normativă și migrarea D0–D5 sunt în
  [`17-decentralized-node-network.md`](17-decentralized-node-network.md).

## 5. Media și feed

### Upload VOD

```text
create-upload → policy/size check → signed multipart upload → checksum
→ malware/probe → transcode ladder → thumbnail/contact sheet
→ public-content moderation → READY/REJECTED → CDN warmup → feed eligibility
```

- originalele sunt private; playback folosește URL-uri/token-uri CDN scurte;
- ladder-ul este adaptiv și calibrat pe sursă, nu upscale inutil;
- CID-ul IPFS este creat numai pentru media „pin forever” cu consimțământ clar;
- ștergerea revocă CDN, elimină origin/renditions și păstrează doar auditul minim;
- drepturile pentru sound sunt modelate separat de fișierul audio.

### Ranking MVP

1. candidate sources: following, similar content, local/trending, exploration;
2. hard filters: privacy, block, age, moderation, context, language;
3. lightweight score: completion, rewatch, skip, negative feedback, freshness,
   creator diversity și exploration;
4. constrained re-ranking pentru diversity și repetition caps;
5. logarea impresiei înainte de playback și a evenimentelor deduplicate;
6. modelele ML vin după volum și un plan documentat de evaluare/bias.

Datele Dating sunt într-un feature namespace separat și nu intră în feedul Social.

## 5A. Mobility și dispatch

```text
Driver online → location ping efemer → Redis GEO candidate set
Rider quote A→B → policy/fare/ETA → ride request
→ dispatch fan-out limitat → driver accept atomic
→ payment authorization/escrow → pickup tracking
→ rider PIN → IN_PROGRESS → arrival/end confirmation
→ fare settlement → rating / incident / dispute
```

- PostgreSQL păstrează state machine și evenimentele de cursă; Redis păstrează
  prezența și coordonatele curente cu TTL scurt;
- PostGIS calculează zone, distanțe și reguli, iar un provider de routing produce
  traseul/ETA; providerul este ascuns în spatele unui adapter;
- acceptarea șoferului folosește compare-and-set/lock pentru a preveni două
  atribuiri ale aceleiași curse;
- locația este trimisă numai în timpul disponibilității/cursei și nu intră în
  analytics generale, feed sau blockchain;
- un quote include distanță/timp estimate, componente, fee, expirare și reguli de
  ajustare. Nicio modificare materială nu este aplicată fără afișare;
- SOS/share-trip are un canal operațional separat; E2EE chat nu înlocuiește
  accesul 24/7 la incidente în piața pilot;
- GPS spoofing, device integrity și imposibil-speed sunt semnale de risc, nu
  decizii automate definitive fără cale de contestare.

## 5B. Action Ledger: o tranzacție per acțiune

```text
Wallet autorizează SessionCapability (tx)
→ device key semnează ActionEnvelope la fiecare mutație
→ API validează context/scope/nonce/rate/privacy
→ relayer-ul shardului trimite recordAction (1 tx, fără batching)
→ contractul verifică signature/capability și emite ActionRecorded
→ indexer + reducer confirmă read model-ul
```

`ActionEnvelope` compact:

```text
version, network, actorKind, actorCommitment, actionType, objectCommitment,
payloadHashOrCid, visibilityClass, clientActionNonce, issuedAt, expiresAt,
sessionPublicKey, sessionSignature
```

- `nexus-actions` se deployează în fiecare execution shard; clientul/API routează
  acțiunea către instanța configurată pentru capability/relayer;
- contractul folosește Crypto API pentru verificare Ed25519, nonce monotonic sau
  bitmap/fereastră anti-replay și capability scopes;
- tranzacția stochează envelope-ul compact în input și emite eveniment; nu creează
  un storage mapper pentru fiecare like, evitând creșterea nelimitată a storage-ului;
- public actions includ commitments indexabile; private actions includ numai
  commitment aleator puternic și encrypted evidence off-chain;
- wallet signing explicit rămâne obligatoriu pentru bani, schimbarea capability,
  payout, profil controller și operații administrative;
- optimistic UI poate afișa acțiunea imediat, dar rollback-uiește la tx failure;
- statusurile sunt `LOCAL_SIGNED → RELAY_QUEUED → NETWORK_ACCEPTED → ORDERED_FINAL
  → EXECUTION_PENDING → EXECUTED_SUCCESS|EXECUTED_FAIL`;
- adaptorul folosește runtime observat `ANDROMEDA_COMPAT`/`SUPERNOVA`; nu codifică
  o cadență fixă și nu confundă finalitatea ordonării cu execuția;
- fiecare action tx consumă gas. Sponsorship are free quota, budget caps, anti-Sybil
  și fallback „user pays”; batching-ul nu este permis de cerința de produs.

Telemetria efemeră nu intră în ledger: impressions, watch progress, scroll,
typing/presence, GPS pings și stream packets. Acestea nu modifică un obiect social
sau comercial și rămân în pipeline-uri cu retenție scurtă.

## 5C. Marketplace generalist transversal

Market este o destinație globală, nu doar Home-ul profilului Market. Orice context
poate deschide, distribui sau conversa despre un anunț; create/offer/checkout este
atribuit profilului Market pentru reputație și obligații comerciale.

- taxonomy service versionat și `category_schema` JSON pentru câmpuri dinamice;
- categorii inițiale: electronice, auto, imobiliare, casă, fashion, hobby,
  familie, business, servicii și altele permise;
- search local/global, PostGIS, facets, price/currency și saved searches;
- listing manifest în object storage/IPFS public opțional; tx-ul conține hash/CID;
- `CLASSIFIED_ONLY`: contact/ofertă fără custody; `ESCROW_CHECKOUT`: protecție;
- prohibited/restricted goods rules, trader status, GPSR/Safety Gate și duplicate/
  scam detection sunt aplicate înainte ca tx-ul să devină vizibil în index.

## 5D. Business, Services, Promotion și Review Graph

- Organization/Business este entitate separată, controlată prin wallet și RBAC;
- PostGIS + search oferă discovery local; disponibilitatea este calculată în
  PostgreSQL, iar Redis ține numai soft holds expirabile;
- `nexus-appointments` confirmă slotul și depozitul pentru fluxurile protejate;
- promotion ranking și pacing sunt off-chain, campaign changes au action tx, iar
  settlement-ul este reconciliat;
- review eligibility vine din order/booking/ride/appointment/course, nu dintr-un
  simplu claim al autorului;
- Review Graph păstrează domeniile separate și exclude rating Dating/health public.

Specificația completă este în
[`11-business-services-promotion-reviews.md`](11-business-services-promotion-reviews.md).

## 5E. Music și Grow

- Music folosește storage privat, audio ladder, signed CDN, entitlement pe teritoriu
  și rights matrix; IPFS nu livrează masterele comerciale;
- `PLAY_START` este action tx; buffer/progress/heartbeat rămân telemetrie;
- usage antifraud și royalty statements sunt off-chain, cu root/claim în
  `nexus-royalties`;
- Grow separă `wellness_private`, nu expune metrics on-chain și nu le oferă ads,
  Dating sau Work;
- cursurile reutilizează media, payments, Business, Reviews și badge infrastructure;
- funcțiile medicale și catalogul muzical comercial sunt feature-gated juridic.

Specificația completă este în
[`12-music-wellness-learning.md`](12-music-wellness-learning.md).

## 5F. Social login și wallet embedded

```text
Provider SDK/OIDC → Identity Broker → token verification + PKCE/nonce
→ Account Orchestrator → Wallet Provider Adapter → embedded wallet/passkey
→ Terms/CountryPolicy → session capability → sponsored first action
```

- provider key este `(issuer, subject)`, nu email;
- implementarea preferă xAlias/passkey ori MPC threshold auditat;
- Nexus nu păstrează seed/private key complet;
- recovery și linking cer step-up; merge cere controlul ambelor conturi;
- wallet adapter permite export/migrare și xPortal/Ledger pentru valori mari;
- provider outage nu poate bloca permanent activele.

## 5G. Agent Network și Test Bot Fabric

- `AgentProfile` este distinct de profilul uman și are badge AI permanent;
- `actor_kind=HUMAN|AGENT|SYSTEM_TEST` traversează action ledger, events și warehouse;
- A2A Agent Cards sunt semnate; MCP/tools folosesc authorization la task, nu secrets
  în manifest;
- agent capability limitează endpoints, țări, date, valoare, gas, timp și approver;
- acțiunile financiare cu impact cer allowance sau confirmare wallet umană;
- synthetic bots rulează izolat și nu apar în public/reviews/paid metrics;
- growth agents operează numai prin opt-in, inbound și API-uri aprobate;
- agents nu au acces la Dating, review eligibility, Mobility driving sau W2/W3.

Specificația completă este în
[`13-global-auth-agent-network.md`](13-global-auth-agent-network.md).

## 5H. Dating Trust, media temporară și Pulse

- Dating preferences, identity, verification și meetup data folosesc DB/keys
  separate și generic private action commitments;
- Compatibility Card calculează mutual hard filters și motive explicabile, fără
  a transfera orientarea ori dealbreakers ascunse;
- Trust Passport agregă claims/outcomes contestabile, nu un scalar de atractivitate;
- Meet Safe folosește video/liveness, PIN, trusted-contact token și TTL vault;
- View Once criptează client-side, livrează cheia o singură dată și face purge;
- screenshot protection este deterrence, nu garanție împotriva unei camere externe;
- Pulse are alias vault separat, actor-kind labels, chronological feed și integrity
  pipeline pentru trends/Community Context;
- alias public nu expune account mapping, dar enforcement break-glass rămâne auditat;
- Pulse nu oferă random anonymous chat; DM pseudonim cere accept/mutual policy.

## 5I. Clips, Watch, Live și recommender platform

- un `MediaAsset` privat poate alimenta manifest separat pentru Clip, Watch sau
  Live replay; audience/rights/moderation se verifică pentru fiecare prezentare;
- Watch folosește resumable upload, ABR HLS/DASH CMAF, signed CDN, captions,
  chapters și transcripts; IPFS nu este origin pentru media cu takedown;
- Live folosește managed RTMP/SRT/WebRTC ingest, redundant origin, ABR și LL-HLS;
  chatul/reacțiile sunt canal realtime separat, iar recording-ul intră în pipeline VOD;
- `emergency terminate` și regional rights block funcționează chiar dacă chain-ul
  sau indexer-ul nu sunt disponibili;
- recommender-ul comun orchestrează candidate generation, dar fiecare suprafață are
  feature namespace/ranker/purpose separat și oferă mod cronologic/editorial;
- modelul nu primește wallet address, tx timing, Dating plaintext sau Kids data;
- ad slotting rulează după organic ranking și nu poate învinge policy/user controls;
- specificația normativă este în
  [`15-recommendations-clips-watch-live-kids.md`](15-recommendations-clips-watch-live-kids.md).

## 5J. Nexus Kids isolation

```text
Adult Family Center ─ parental gate/consent ─ Family service
                                             │
Kids binary ─ child session ─ Kids API/DB/keys/catalog/CDN policy
                                             │
                               no route to Dating/Pulse/Market/Wallet
```

- Kids este binary, tenant, DB role, key hierarchy, analytics namespace și SDK
  inventory separat; tokenul child nu este acceptat de API-urile adulte;
- child profile nu are wallet; history/search/favorite/feedback rămân off-chain,
  criptate și ștergibile, cu sync opt-in parental;
- catalog eligibility este `country × age_band × rating × rights × editorial`;
- safe search, autoplay/time controls și block lists se aplică server-side;
- live este numai instituțional/creator-verificat, cu delay, moderator și chat liber
  dezactivat; copilul nu poate fi broadcaster public;
- chain-ul poate ancora numai adult consent credential generic, creator rights/payout
  și agregate fără child identifier.

Specificația completă este în
[`14-dating-pulse-discretion-trust.md`](14-dating-pulse-discretion-trust.md).

## 6. Blockchain adapter și consistență

- `NetworkCapabilities` detectează runtime-ul `ANDROMEDA_COMPAT` sau `SUPERNOVA`
  prin quorum de endpoint-uri oficiale; nu există switch bazat doar pe dată;
- orice mutație pornește cu un `ActionIntent`; operațiile financiare folosesc în
  plus `TransactionIntent` idempotent;
- backend-ul construiește tranzacția, wallet-ul utilizatorului o semnează;
- relayer-ul semnează numai după verificarea politicii, cotei și simulării;
- indexer-ul consideră chain-ul autoritatea pentru fonduri și emite evenimente;
- stările `ORDERED_FINAL` și `EXECUTED_SUCCESS` sunt separate; includerea/finalitatea
  nu este tratată automat ca execuție reușită sub Supernova;
- reconciler-ul compară permanent state-ul DB, evenimentele și views on-chain;
- reorg/duplicate delivery sunt tolerate prin chei `(network, tx_hash, event_index)`;
- endpoint-urile critice au idempotency keys și optimistic versioning.

Detaliile de nonce manager, execution result, backpressure, fallback și cost sunt
normative în [`10-supernova-economics-compliance.md`](10-supernova-economics-compliance.md).

## 7. Medii și infrastructură

- `local`: emulatori, wallet-uri fără fonduri, Matrix și storage locale;
- `ci`: baze efemere, Rust VM/scenarios, contract/API compatibility tests;
- `devnet`: contracte reale MultiversX și relayer cu limite mici;
- `staging`: copie de topologie, date sintetice, TestFlight/internal track;
- `mainnet-canary`: allowlist și limite financiare;
- `production`: multi-AZ, PITR, KMS/HSM, WAF, multisig și on-call.

Nicio cheie mainnet nu intră în repository, CI logs sau variabile partajate cu
mediile non-production.

## 8. SLO inițiale

| Funcție | SLO |
|---|---|
| API read/write non-media | 99,9%; p95 sub 350/600 ms |
| Feed first page | p95 sub 700 ms backend |
| Video startup | p95 sub 1,5 s pe rețeaua țintă |
| Mesaj online | 99,9%; p95 sub 2 s până la dispozitiv |
| Action acceptance local | p95 sub 300 ms până la optimistic state |
| Action ordered/final | separat per runtime/shard; țintă Supernova p95 < 2 s |
| Action executed-success | separat per runtime/shard; țintă Supernova p95 < 3 s |
| Chain index lag | p95 sub 30 s după finalitate observată |
| Escrow ledger | RPO 0 logic; reconciliere automată continuă |
| DB | RPO sub 5 min, RTO sub 60 min în beta |

SLO-urile sunt măsurate end-to-end și segmentate pe versiune, regiune și device.
