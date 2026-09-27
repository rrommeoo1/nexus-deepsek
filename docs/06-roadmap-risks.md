# Roadmap, estimări, complexitate și riscuri

## 1. Ipoteze de estimare

Estimarea este pentru dezvoltare asistată de agenți, cu decizii de produs luate în
proiect, 4–6 fluxuri de lucru paralele, servicii managed pentru media/live inițial
și rollout Global Core în valuri de țări. Agenții comprimă redactarea, scaffolding-ul, implementarea și
test generation; nu elimină dependențele seriale, review-ul de securitate,
dispozitivele reale, procesele app-store și observația în producție.

Dezvoltarea poate fi agent-heavy și coordonată de proprietar, dar lansarea legală
nu poate fi self-certified de aceiași agenți care construiesc produsul. Sunt
dependențe externe obligatorii: auditor independent pentru contractele cu fonduri,
counsel autorizat care semnează opiniile pe jurisdicție, rightsholders/CMO/labels
care acordă licențele, autorități pentru transport și operatori umani pentru
moderare, dispute și incidente fizice. Agenții pot pregăti codebase-ul, testele,
evidence pack-ul și drafturile; nu pot fi contraparte legală sau autoritate.

## 2. Plan de dezvoltare

Execuția pe agenți, task packets, controale, stage gates și timeline-ul primelor
16 săptămâni sunt normative în
[`16-agent-delivery-continuous-assurance.md`](16-agent-delivery-continuous-assurance.md).

### Etapa 0 — definition și proof, 3–5 săptămâni

- PRD, domain map, threat model și on-chain/off-chain matrix;
- prototip navigabil pentru switcher, feed, inbox, checkout și dispute;
- spikes: wallet/native mobile, relayed v3, HLS, Matrix multi-device;
- spike Mobility: routing/ETA, Redis GEO, dispatch atomic, background location și escrow;
- spike Action Ledger: Ed25519 session capabilities, per-shard deployment,
  throughput, gas/action, Supernova ordered-vs-executed și reducer rebuild;
- spikes: appointments slot/escrow, audio rights pipeline și Grow privacy boundary;
- spikes: xAlias/passkey/MPC wallet, Google/Apple/Facebook/TikTok login și recovery;
- spike A2A/MCP Agent Gateway, signed Agent Cards și synthetic swarm isolation;
- spikes: Dating Trust Passport, alias vault, ephemeral-key deletion și Pulse integrity;
- spikes: Watch ABR/player, managed Live ingest/failover, per-surface recommender și
  Nexus Kids binary/tenant/SDK isolation;
- ABI draft, OpenAPI draft, design system și analytics taxonomy;
- policy skeleton și catalogul de date.

Exit: fluxurile critice au contract UI/API și deciziile ireversibile sunt
consemnate.

### Etapa 1 — fundația comună, 8–12 săptămâni

- monorepo, CI/CD, environments, observability și secrets management;
- Auth, Account, Profiles, Context, Privacy, Graph și Notifications;
- upload/player video și feed heuristic minim;
- Channel/Watch primitives, recommendation contracts și managed-Live adapter;
- Matrix E2EE facade și inbox;
- contracte registry/badge/tipping/escrow pe devnet;
- `nexus-actions` per shard, Action Relay pools, session keys și chain reducer;
- admin, reports, audit și chain indexer/reconciler.
- runtime dual Supernova, NetworkCapabilities quorum, shadow index și fallback;
- Organization/Business Page, Services catalog și Review Graph primitives;
- Identity Broker, embedded wallet, recovery/export și Country Capability Matrix;
- Test Bot Fabric în CI/devnet/staging, cu `actor_kind` și metric isolation;

Exit: două wallet-uri folosesc contexte diferite, comunică și finalizează o
tranzacție test end-to-end.

### Etapa 2 — alpha integrată, 12–16 săptămâni

- Social MVP, Work baseline, Dating discovery/match, preferințe incluzive,
  Compatibility Cards, Trust Passport D0–D2 și modurile de discreție;
- Pulse baseline: aliases, threads/replies/reposts/quotes, controls, lists și moderation;
- Clips baseline și Watch allowlisted: channels, long-form VOD, subscriptions,
  playlists, captions, Creator Studio minim și recommendations controls;
- Live allowlisted: single host, managed ingest, LL-HLS, moderated chat și replay;
- Market classifieds generalist, dynamic categories, listing action tx,
  offer/order/escrow și Travel request-to-book;
- Mobility rider/driver, document eligibility, dispatch, tracking, PIN și ride escrow;
- programări frizer/coafor, staff/calendar, appointment escrow și Business Pages;
- Promotion Engine de bază, ad labels, campaign billing și review eligibility;
- Music independent catalog/player/rights baseline și Grow W0/W1/courses baseline;
- Google/Apple production auth; Facebook/TikTok când app review aprobă;
- Nexus Service Agents etichetați și Business Agent capability baseline;
- Trust Center, Wallet Activity, reviews și disputes;
- events/split, search, push și privacy lifecycle;
- View Once non-explicit, in-app pre-meet video și Meet Safe cu check-in/SOS;
- test suites pe fiecare verticală și contract testing.

Exit: feature-complete pentru closed alpha, devnet și plăți de test.

### Etapa 3 — hardening și closed beta, 8–12 săptămâni

- performance/load/chaos, accessibility și device matrix;
- fuzz/invariants/gas/cross-shard, audit intern și remediere;
- pen-test, DPIA, abuse simulations și incident exercises;
- ranking/cost tuning, data retention și moderation SLA;
- Supernova burst/backpressure/upgrade-epoch tests și gas sponsorship economics;
- music rights, ads/reviews, services și Grow compliance gates;
- embedded-wallet cryptographic audit, recovery drills și provider outage chaos;
- bot collusion/fake traffic/prompt-tool injection și AI disclosure audits;
- Dating bias/false-verification/no-show appeals, View Once/NCII/sextortion drills;
- Pulse doxxing/brigading/alias-correlation/trend-manipulation red-team;
- Clips/Watch recommender harms, rights mismatch/clickbait și creator payout tests;
- Live failover, emergency terminate, dangerous-event, chat raid și replay drills;
- canary mainnet cu caps și allowlist după audit independent.

Exit: nicio vulnerabilitate critică/high deschisă; pause/refund/restore testate.

### Etapa 4 — public beta Global Core în valuri, 12–20 săptămâni

- rollout gradual, limite valorice și risk reserves;
- seeding pentru creatori/sellers/hosts și operațiuni de dispute;
- app-store review, reporting și conformitate locală;
- Mobility se deschide într-un singur oraș numai după autorizare, driver supply,
  insurance și incident desk 24/7; restul produsului nu este blocat de acest gate;
- primele funcții P2 numai pe baza datelor reale.
- Music/Grow rămân limitate la catalog și intended purpose aprobate; nicio licență
  sau autorizare nu este substituită prin feature flag.
- Global Core se deschide pe valuri de țări/limbi; funcțiile reglementate urmează
  CountryPolicy și nu sunt promise simultan worldwide.
- Nexus Kids nu intră în adult public beta; începe ca pilot separat numai după
  maturizarea safety/rights VOD, cu o țară, două age bands și catalog restrâns.

## 3. Calendar agregat

| Rezultat | Durată de la start |
|---|---:|
| Specificație și prototip validabil | 3–5 săptămâni |
| Demo tehnic end-to-end | 14–20 săptămâni |
| Alpha integrată: contexte + wallet embedded + verticale subțiri | 11–15 luni |
| Closed beta multi-country | 15–20 luni |
| Public beta Global Core, cu verticale reglementate limitate | 20–28 luni |
| Phase 2 matură | 30–38 luni |
| Nexus Kids VOD pilot separat | 30–42 luni, numai după media safety maturity |
| Viziunea completă Phase 3 | 48–60+ luni + extindere/licențe continue |

Nexus Node Network evoluează în paralel, fără a bloca MVP-ul:

| Prag | Orizont | Țintă realistă |
|---|---:|---|
| D0 Genesis | 0–4 luni | 1 nod, protocol final, `R=1`, backup/export/recovery |
| D1 small mesh | după adopție | 2–7 noduri permissionless, `R=min(N,3)` |
| D2 adaptive mesh | după adopție | 8–31 noduri, DHT și primele shard-uri |
| D3 public service mesh | după adopție | 32–255 noduri, receipts și settlement opțional |
| D4 global mesh | după adopție | 256–2.000 noduri, locality și erasure coding |
| D5 mature network | după adopție | peste 2.000 noduri, fără expunerea plaintext Kids/Dating/KYC |

Aceste valori sunt moduri automate, nu praguri de lansare sau promisiuni de adopție. Gates și
protocolul complet sunt în [`17-decentralized-node-network.md`](17-decentralized-node-network.md).

O țintă de 3–5 luni înseamnă demo privat, nu lansare publică sigură cu escrow,
dating, rides, muzică și wellness. Catalogul muzical comercial nu are termen pur
tehnic: depinde de negocierea drepturilor. Calendarul se poate scurta printr-un
pilot subțire și feature gates, nu prin eliminarea testelor sau controalelor.

## 4. Workstreams și dependențe

```text
Product/domain ───────────────┬───────────── release governance
Design system ── mobile/web ──┤
Identity/privacy ──────────────┼─ toate verticalele
Social auth/wallet/recovery ───┤
Country policy/localization ───┤
Agent gateway/test fabric ─────┤
Blockchain ABI ─ backend ─ UI ┼─ escrow/reconciliation
Media pipeline ─ feed ────────┤
Rights/audio ─ Music ─────────┤
Business/calendar ─ Services ─┤
Promotion/reviews ────────────┤
Grow/privacy/editorial ───────┤
Matrix/E2EE ─ inbox ──────────┤
Moderation/policy ─ admin ─────┤
Data/analytics ─ ranking ──────┘
Nexus Node Network ─ protocol/placement/receipts ─ federation, storage, media și compute
Nexus Assurance & Control ─────┴─ gates/evidence independent de toate workstream-urile
```

Un ABI sau model de autorizare instabil blochează trei straturi; de aceea contract
tests și architecture decisions preced implementarea masivă a ecranelor.

## 5. Complexitate relativă

| Domeniu | Complexitate | Driver |
|---|---|---|
| Multi-context identity/privacy | foarte mare | autorizare pe câmp și prevenirea scurgerilor |
| Feed/video | foarte mare | latență, cost, ranking, copyright și moderare |
| Watch long-form | foarte mare | storage/CDN, search, rights, creator studio și monetizare |
| Live streaming | foarte mare | real-time safety, ingest/failover, latency, chat și replay |
| Recommenders multi-surface | foarte mare | privacy, feedback loops, explanations și model governance |
| Nexus Kids | critică | child privacy/safety, consent, age bands, stores și operations |
| Chat E2EE | foarte mare | keys, devices, recovery și abuse reporting |
| Smart contracts/escrow | foarte mare | fonduri ireversibile și edge cases |
| Dating | foarte mare | siguranță fizică, vârstă, fraudă, locație |
| Dating Trust/ephemeral media | foarte mare | biometric claims, due process, NCII și false assurances |
| Pulse pseudonim | foarte mare | doxxing, hărțuire, trend integrity și account-level enforcement |
| Travel | foarte mare | calendar, anulări, fiscalitate și incidente |
| Marketplace generalist | foarte mare | taxonomy, search, bunuri reglementate și fraudă pe multe categorii |
| Every-action Action Ledger | foarte mare | session keys, gas, latență, privacy și read-model consistency |
| Mobility | foarte mare | dispatch real-time, locație, siguranță fizică și autorizare |
| Supernova/action economics | foarte mare | consens/execuție, burst, gas și reconciliere |
| Business/appointments | mare | calendare, no-show, dispute și reguli locale |
| Promotion/reviews | mare | ads transparency, ranking, fraudă și autenticitate |
| Music | foarte mare | rights, DRM/CDN, fraudă și royalty accounting |
| Grow | foarte mare | health privacy, intended purpose, claims și credentials |
| Embedded wallet/social auth | foarte mare | takeover, recovery, custody și provider approval |
| Worldwide policy | foarte mare | legi, entități, plăți, limbi și operațiuni locale |
| Agent Network | foarte mare | authorization, spam, deception, tool security și economics |
| Nexus Node Network | critică | protocol distribuit, Sybil/eclipse, replicare, node incentives și legal boundaries |
| Work | mediu–mare | credentials și organizații |

## 6. Matrice de riscuri

| Risc | Prob. | Impact | Atenuare | Semnal/owner |
|---|---:|---:|---|---|
| Scope „șase clone complete” | mare | critic | thin vertical slices, exit criteria și feature flags | burn-up/Produs |
| Scurgere cross-profile | medie | critic | actor context obligatoriu, ABAC, isolation tests, logs | privacy incidents/Security |
| Exploit escrow | medie | critic | invariants, fuzz, caps, pause, multisig, audit extern | reconciliation/Chain |
| Indexer diferă de chain | medie | mare | idempotency, finality, replay și reconciler | mismatch alerts/Payments |
| Relayer drain/Sybil | mare | mare | allowlist, shard pools, quotas, simulation, budget breaker | EGLD burn/Risk |
| Costul fiecărei acțiuni | mare | critic | gas simulation, free quota, user-pays fallback, hard daily budget | EGLD/action/Finance |
| Action chain congestion/latency | medie | mare | ledger per shard, relay queues, optimistic UI, backpressure | pending p95/Chain |
| Supernova ordered ≠ executed | medie | critic | state machine separată, capability detect, shadow index, reconcile | execution lag/Chain |
| Session key compromise | medie | critic | narrow scopes, expiry, max actions, secure storage, revoke all | anomalous actions/Security |
| Reducer diferă de tx history | medie | critic | deterministic reducer, checkpoints, replay/rebuild și roots | state mismatch/Platform |
| Private-action correlation | mare | mare | generic commitments, privacy relays, salt, disclosure; no anonymity claim | privacy audit/Privacy |
| Fraudă marketplace/travel | mare | mare | limits, verification, delayed payout, evidence/disputes | loss per GMV/Risk |
| Bunuri ilegale/reglementate | mare | critic | prohibited taxonomy, premoderation, trader/GPSR, reupload detection | illegal listings/T&S |
| Dating harassment/safety | medie | critic | 18+, safety ops, block/report, approximate location | severe reports/Safety |
| Dating special-data leakage/inference | medie | critic | schemă/keys separate, consent, no ads/cross-profile, DPIA | access/tests/Privacy |
| Trust Passport discriminează sau este fals | medie | critic | claims explicabile, expirare, provider diversity, apel; fără scor scalar | false accepts/Trust |
| View Once creează falsă siguranță/sextortion | medie | critic | non-explicit launch, capture warning, report evidence, NCII response | severe media reports/Safety |
| Pulse pseudonim facilitează doxxing/hărțuire | mare | critic | alias vault, account-level block, rate/graph controls, rapid response | P0/P1 reports/T&S |
| Pulse trends/notes sunt manipulate | mare | mare | human-only voting, diversity, brigading detection, actor separation | integrity anomalies/Trust |
| Accident/incident Mobility | medie | critic | driver/vehicle/insurance gates, SOS, 24/7 desk, share trip | incidents/100k rides/Safety |
| GPS spoofing/dispatch fraud | mare | mare | device/risk signals, impossible-speed, route evidence, appeals | fraud loss/Mobility |
| Driver status/algorithmic management | medie | critic | legal classification, transparent dispatch, human review | appeals/regulatory/Legal ops |
| Mobility authorization expires | medie | critic | expiry automation, city kill switch, compliance owner | eligible supply/Compliance |
| E2EE împiedică moderarea | mare | mare | reportable transcript, metadata minimă, rate limits | report quality/Trust |
| Media/CDN cost explodează | mare | mare | duration/bitrate caps, adaptive ladder, quotas, lifecycle | cost/minute/Media |
| Copyright audio/video | mare | mare | rights model, licensed catalog, takedown/counter-notice | claims/Legal ops |
| Recomandările amplifică nociv/clickbait | mare | critic | safety-before-rank, satisfaction, diversity, controls, audits | exposure/ML Safety |
| Live transmite abuz înainte de moderare | medie | critic | eligibility, delay, human coverage, emergency end, replay review | intervention p95/T&S |
| Live provider/region cade | medie | mare | redundant ingest, adapter, health/failover și degraded mode | availability/Media |
| Rights mismatch blochează creator corect | mare | mare | fingerprint ca semnal, human dispute/counter-notice și freeze limitat | appeals/Rights |
| Date Kids ajung în ads/adult models | scăzută | critic | separate binary/tenant/keys/SDKs, deny joins și audit continuu | zero-leak/Privacy |
| Consimțământ parental invalid | medie | critic | country flow, evidence/version/revalidation/revoke și counsel gate | validity/Compliance |
| Copil expus la open chat/conținut adult | scăzută | critic | allowlist index, deny-by-default API, no open social, red-team | exposure/Kids Safety |
| Engagement Kids devine manipulator | medie | critic | finite collections, autoplay off, time limits și anti-metrics | session/Child Design |
| Music disponibilă fără drepturi complete | medie | critic | rights matrix, territory entitlement, release gate și freeze | clearance gaps/Rights |
| Streaming/royalty fraud | mare | mare | qualified usage, device/risk, caps și audit statements | invalid usage/Music |
| Review-uri false/manipulate | mare | mare | eligibility, labels, anomaly detection, appeals | fake-review rate/Trust |
| Ads netransparente/sensitive targeting | medie | critic | labels, why-this-ad, forbidden features și audit | violations/Growth |
| Double booking salon | medie | mare | soft hold + SC slot, versions, reconcile | overlap/Services |
| Grow devine produs medical implicit | medie | critic | W0–W3 classifier, intended-purpose gate și medical review | claims/Legal |
| Scurgere date Grow | medie | critic | schemă/keys separate, no-ad/no-cross-profile tests | incidents/Privacy |
| Social-login account takeover | medie | critic | issuer/sub, PKCE, step-up, cooldown, multi-factor recovery | ATO/Auth |
| Embedded wallet devine custodial | medie | critic | threshold model, export, independent audit și legal memo | key access/Wallet |
| Provider social suspendă aplicația | medie | mare | Google/Apple baseline, wallet login, adapters și no lock-in | auth success/Platform |
| Bot farm falsifică tracțiunea | mare | critic | actor_kind, metric isolation, ring detection, no rewards/reviews | bot ratio/Trust |
| Agent spam/impersonation | mare | critic | disclosure, opt-in, capability, rate, kill switch și appeals | reports/Agents |
| Prompt/tool injection | mare | critic | sandbox, egress, structured tools, approval și secret isolation | blocked calls/Security |
| Country gate ocolit | medie | critic | server/chain gate, multi-signal country și audit | denied bypass/Compliance |
| IPFS vs dreptul la ștergere | medie | mare | public opt-in only, encrypted payloads, no private PII | deletion failures/Privacy |
| Token/regulatory overreach | medie | critic | no token before PMF/opinion, points nontransferable | roadmap drift/Governance |
| DAC7/reporting incomplet | medie | mare | seller due diligence, ledger/report exports | missing tax data/Finance |
| DSA notice/action insuficient | medie | mare | notice, reasons, appeals, trader traceability | SLA/Compliance |
| Cold-start feed/market | mare | mare | city/community wedge, exploration, curated supply | WMP/liquidity/Growth |
| App-store rejection | medie | mare | dating/UGC/payment policy review și staged submission | review feedback/Release |
| App-store respinge anonimatul/conținutul sexual | medie | critic | fără random anonymous chat, 18+, non-explicit View Once, report/block | pre-review/Release |
| Vendor lock-in video/chat | medie | mediu | adapters, owned metadata, export și tested fallback | exit test/Platform |
| Agenți introduc inconsistențe | medie | mare | source-of-truth docs, schema generation, CI gates, code owners | contract drift/Architecture |
| Sybil/eclipse în rețeaua de noduri | mare | critic | stake/registration pe tier, bootstrap multiplu, peer scoring și diversity placement | peer diversity/Protocol |
| Noduri coluzive sau rezultate false | medie | critic | replici multi-owner, commitments, challenges, sampling și checkpoint audit | challenge failures/NAC |
| Under-replication/pierdere media | medie | critic | replica target, repair controller, erasure coding și restore drills | durable replicas/SRE |
| Metadate sensibile ajung în federația publică | medie | critic | policy classes, deny-by-default placement și conformance privacy tests | denied routes/Privacy |
| Concentrare la puțini node owners/cloud-uri | mare | mare | caps, owner/ASN/region diversity și public concentration dashboard | HHI/Protocol |
| Receipt fraud consumă treasury | medie | mare | signed usage, random audit, price caps și delayed settlement | disputed receipts/FinOps |
| Takedown divergent între noduri | mare | critic | signed tombstones, cache TTL, client delisting și peer scoring | stale harmful copies/T&S |
| Fork de protocol între versiuni | medie | critic | semantic versioning, compatibility window, canary și rollback | incompatible peers/Release |

## 7. Controale de scope

O funcție intră în MVP dacă:

- completează „discover → converse → trust → transact”;
- previne pierdere materială de privacy, safety, fraudă sau fonduri;
- dovedește diferențiatorul multi-context;
- este obligatorie pentru app stores sau piața pilot.

Se amână dacă este predominant cosmetică, poate fi înlocuită de un serviciu managed,
necesită efect de rețea global înainte de PMF sau adaugă risc financiar fără cerere.

## 8. Release gates

- API/ABI/backward compatibility și migration tests verzi;
- 100% din mutațiile user-visible din registry au exact un action/financial tx și
  telemetria exclusă este inventariată explicit;
- zero critical/high security findings neacceptate;
- SLO și cost budgets trecute pe workload reprezentativ;
- reconciliation fără diferențe și withdrawals/refunds simulate;
- privacy isolation suite și delete/export testate;
- Dating special-data suite, verification appeals și Meet Safe/SOS testate;
- ephemeral key/purge/capture disclosure și Alias Vault break-glass testate;
- Pulse UGC/report/block, anti-doxxing și human-only context voting testate;
- Clips/Watch rights/rating/recommender controls și reset testate;
- Live ingest failover, terminate, chat moderation, replay și payouts testate;
- Kids binary/tenant/SDK isolation, parental consent și catalog allowlist testate;
- moderation/dispute staffing și runbooks gata;
- rollout 1% → 5% → 25% → 100%, cu rollback/feature kill separat;
- post-release observation window fără lansări financiare simultane.
- fiecare artifact are maker/checker separat, Evidence Pack și Control Registry
  results; agentul autor nu își aprobă singur release-ul;
- node conformance, state sync, replica repair, owner/failure-domain diversity, receipt challenge,
  federation abuse și protocol upgrade/rollback sunt verzi înainte de tier public;

## 9. Definition of Done pentru beta

- fiecare acțiune arată profilul actor și audiența;
- fiecare mutație afișează queued/ordered/executed/failed și are tx hash verificabil;
- nicio cale cross-context fără regulă testată;
- feed → profil → chat → order/booking/ride/appointment → review funcționează end-to-end;
- Music nu servește asset fără clearance activ; statements se reconciliază;
- Grow nu expune date private către ads, Dating, Work sau search;
- social login creează/reia același wallet fără email auto-merge și recovery/export funcționează;
- agents sunt etichetați, excluși din Dating/reviews/paid metrics și revocabili;
- funcțiile indisponibile sunt refuzate conform CountryPolicy și on-chain allowlist;
- targetul like-urilor Dating și conținutul E2EE nu ajung pe chain/ranking public;
  numai commitments generice au tranzacții;
- Dating Trust Passport nu poate genera un scor unic, iar claims expiră și au apel;
- View Once nu promite screenshot-proof și blochează conținutul explicit în beta;
- Pulse expune numai aliasul, nu wallet-ul, dar poate sancționa contul; random
  anonymous chat nu există și agenții nu votează Community Context;
- Watch/Live funcționează end-to-end de la upload/ingest la rights, CDN, report,
  replay și payout; modurile Subscriptions/Editorial nu cer profilare;
- Kids child token nu poate apela API adult, nu există wallet/open social/behavioral
  ads, iar history/favorite/feedback nu creează tx public;
- orice plată are intent, idempotency, confirmation, reconciliation, dispute și receipt;
- retry/reconnect nu dublează tranzacții;
- block/report are efect transversal și apel;
- retention/delete/export sunt implementate;
- operațiunile pot răspunde incidentelor înainte de rollout.
