# NEXUS — program de livrare agent-heavy

> **Statut:** draft operațional, non-normativ. Acest document propune cum se execută specificațiile existente; nu le modifică și nu le suprascrie. Dacă apare un conflict, prevalează documentele normative `00`–`15` și registrul de decizii.

## 1. Mandat și rezultat

Programul livrează NEXUS ca un singur produs, prin 4–6 fluxuri active în paralel, de la Sprint 0 până la public beta Global Core. Watch și Live sunt suprafețe adulte integrate. Nexus Kids este produs separat — binary, tenant, date și operațiuni — și nu intră în public beta adult; pilotul său începe numai după maturizarea demonstrată a safety/rights pentru VOD.

Ținta programului nu este „mult cod”, ci incrementul verificabil:

```text
specificație → contract executabil → cod → teste/evidence → review independent
→ rollout limitat → telemetrie reală → decizie de extindere
```

Principii de execuție:

- un singur accountable owner pentru fiecare decizie, contract și release;
- maximum 4–6 workstreams active, chiar dacă există mai mulți agenți disponibili;
- un agent nu își aprobă singur schimbarea critică;
- API/ABI, privacy boundary și invariants se stabilizează înaintea implementării masive de UI;
- fiecare verticală folosește serviciile comune, nu își construiește propriul auth, wallet, chat, payments sau moderation;
- feature flags, country gates, value caps și allowlists sunt parte din produs;
- agenții pregătesc și verifică intern; auditorii, counsel, platformele și operatorii externi rămân porți reale acolo unde au autoritate sau răspundere.

## 2. Organigrama programului

### 2.1 Structură de comandă

```text
NEXUS Product Owner / Keyholder (uman)
  │  aprobă numai acțiuni ireversibile, chei, bugete și relații juridice
  ▼
Agent Program Director (APD) ───── Agent Product & Policy Lead (PPL)
  │                                  │
  ├─ Architecture & Contracts Council│
  ├─ Release & Evidence Council      │
  └─ Dependency / Capacity Control   │
        │
        ├─ W1 Platform Identity & Privacy
        ├─ W2 Chain, Payments & Action Ledger
        ├─ W3 Client Experience (Mobile/Web)
        ├─ W4 Realtime, Chat & Notifications
        ├─ W5 Media, Recommendations, Clips/Watch/Live
        ├─ W6 Trust, Safety, Security & Compliance
        ├─ W7 Commerce & Regulated Verticals
        ├─ W8 Data, Search, QA, SRE & FinOps
        └─ K1 Nexus Kids Cell — separată și activată ulterior
```

APD decide secvența, WIP-ul, ownerii și release train-ul. PPL decide produsul în limitele specificațiilor și menține requirement traceability. Product Owner-ul uman nu este folosit ca manager zilnic; intervine pentru custodia cheilor, contracte, bugete, acceptarea explicită a riscurilor reziduale și aprobări pe care un agent nu le poate produce legitim.

### 2.2 Workstreams și misiuni

| ID | Workstream | Accountable agent | Misiune | Output principal |
|---|---|---|---|---|
| W0 | Program & Product OS | APD + PPL | scope, ADR, backlog, dependențe, evidence și release | roadmap, decision log, release dossier |
| W1 | Identity & Privacy Platform | Platform Architect | auth, account, contexts, ABAC, social login/wallet, recovery, country policy | SDK/context envelope, policy engine, isolation tests |
| W2 | Chain, Payments & Ledger | Chain Architect | SC, relayers, session capabilities, indexer/reconciler, escrow și payouts | ABI, contracts, bindings, invariants, gas/economic report |
| W3 | Client Experience | Client Architect | React Native, web/admin, design system, accessibility, device behavior | mobile/web builds, component library, E2E journeys |
| W4 | Realtime & Messaging | Realtime Architect | Matrix/E2EE facade, inbox, push, groups, presence și event chat | key lifecycle, messaging APIs, recovery/report flows |
| W5 | Media & Recommendations | Media Architect | upload, CDN, Clips, Watch, Live, rights graph și recommender surfaces | playback/live adapters, model contracts, Creator Studio |
| W6 | Trust, Safety, Security & Compliance | Safety/Security Lead | threat models, moderation, fraud, disputes, DPIA packs și incident controls | control library, queues, audit evidence, red-team reports |
| W7 | Verticals | Domain Integration Lead | Work, Dating/Pulse, Market, Travel, Mobility, Services, Music, Grow, Promotion | thin slices care reutilizează platforma comună |
| W8 | Data, Quality & Operations | SRE/Data Lead | schema/events, analytics, search, CI, test fabric, SLO, observability, FinOps | data contracts, dashboards, environments, capacity reports |
| K1 | Nexus Kids | Kids Safety Architect | binary/tenant separat, Family Center, catalog, child privacy și parental controls | Kids app, isolated services/evidence, Country Pack |

### 2.3 Celule temporare

Pentru schimbări cu risc mare se creează celule limitate la un outcome:

- **ABI Cell:** W2 + W1 + W3 + W8; închide contractul end-to-end înainte de UI.
- **Money Movement Cell:** W2 + W6 + W8; verifică escrow, idempotency, reconciliation, caps și pause/refund.
- **Live Safety Cell:** W5 + W6 + W8; ingest, emergency terminate, moderation coverage, rights și replay.
- **Cross-Context Privacy Cell:** W1 + W3 + W6; dovedește separarea Dating/Grow/Kids de ads și general models.
- **Kids Isolation Cell:** K1 + W1 + W5 + W6 + W8; nu reutilizează token-uri adulte, SDK-uri neaprobate sau data jobs adulte.

Celula se dizolvă după ce produce evidence pack și gate decision; nu devine o nouă organizație permanentă.

## 3. Model de ownership și RACI

### 3.1 Roluri abreviate

- **OWN:** Product Owner/Keyholder uman.
- **APD:** Agent Program Director.
- **PPL:** Agent Product & Policy Lead.
- **ARCH:** Architecture & Contracts Council.
- **WS:** workstream-ul implementator relevant.
- **TSS:** Trust/Safety/Security agent lead.
- **SRE:** Data/QA/SRE agent lead.
- **EXT:** autoritate externă: auditor, counsel, rightsholder, app store, payment/provider sau regulator.
- **OPS:** operatori umani pentru moderare, dispute, incident response și suport.

`A` = accountable, `R` = responsible, `C` = consulted, `I` = informed. Fiecare rând are un singur `A` în interiorul programului; o poartă externă poate rămâne obligatorie separat.

### 3.2 RACI de program

| Decizie/livrabil | OWN | APD | PPL | ARCH | WS | TSS | SRE | EXT/OPS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| scope și prioritate trimestrială | I | A | R | C | C | C | C | I |
| acceptare/reject requirement | I | C | A/R | C | C | C | I | I |
| ADR și boundary între servicii | I | C | C | A | R | C | C | I |
| API/ABI versionat | I | C | C | A | R | C | R | I |
| implementare și teste de componentă | I | I | C | C | A/R | C | C | I |
| threat model și control design | I | C | C | C | R | A | R | C |
| release candidate build | I | A | C | C | R | R | R | I |
| acceptare risc rezidual non-critic | I | A | C | C | C | R | C | I |
| deploy devnet/staging | I | A | I | C | R | C | R | I |
| chei/mainnet deployment | A/R | C | I | C | C | C | R | I |
| audit intern smart contracts | I | C | I | C | R | A | R | I |
| audit independent smart contracts | I | C | I | C | R | C | C | A/R auditor |
| opinie juridică/country clearance | I | C | R draft | I | C | C | I | A/R counsel |
| music/video rights grant | I | I | C | I | C | R evidence | I | A/R rightsholder |
| app-store submission și răspunsuri | A | R | R | I | R | C | C | C platformă |
| live moderation și incident fizic | I | C | C | I | C | R tooling | C | A/R OPS |
| dispute adjudication cu bani reali | I | C | C | I | C | R evidence | C | A/R OPS/arbiter |
| Kids pilot authorization | A | C | R | C | R | R | C | A/R counsel/store |

### 3.3 CODEOWNERS conceptual

| Suprafață | Owner primar | Reviewer obligatoriu |
|---|---|---|
| `identity`, `context`, `privacy-policy` | W1 | W6 |
| `contracts`, `relayer`, `indexer` | W2 | W6 + W8 |
| `mobile`, `web`, `admin` | W3 | ownerul API + W6 pentru flows sensibile |
| `chat`, `e2ee`, `push` | W4 | W6 |
| `media`, `recommendation`, `live` | W5 | W6 + W8 |
| `verticals/*` | W7 | W1/W2/W5 conform dependenței |
| `data`, `events`, `search`, `infra` | W8 | ARCH + W6 |
| `kids/*` | K1 | W6 + W1; niciun auto-merge din adult lanes |

Nicio schimbare de auth, key lifecycle, policy, transfer de fonduri, live terminate sau Kids isolation nu poate fi auto-merged numai pe baza testelor generate de agentul autor.

## 4. Cadru de lucru al agenților

### 4.1 Unități de execuție

- **Epic:** outcome măsurabil, 4–12 săptămâni, cu owner și gate.
- **Capability slice:** parcurs UI–API–data–policy–telemetry, maximum un sprint.
- **Task:** schimbare atomică cu teste, sub două zile agent-time.
- **Evidence item:** test, raport, screenshot, benchmark, trace sau aprobare care demonstrează acceptarea.

Un agent primește întotdeauna: scop, artefacte normative, fișiere permise, contracte upstream, criterii de acceptare, teste obligatorii și acțiuni interzise. Rezultatul fără evidence este `implemented`, nu `accepted`.

### 4.2 Cadența

- sprint de două săptămâni; Sprint 0 are patru săptămâni;
- daily dependency sync automat, cu escaladare doar pentru blocaje reale;
- architecture/evidence council de două ori pe săptămână;
- demo integrat și release train la final de sprint;
- planning pe 6 săptămâni, roadmap revalidat trimestrial;
- red-team week după fiecare trei sprinturi de funcționalitate financiară/safety;
- zero deploy vineri pentru contracte, auth și plăți.

### 4.3 Definition of Ready

Un capability slice intră în execuție numai dacă:

- are sursă normativă și actor/context/audiență definite;
- API/ABI și schema de evenimente sunt draftate;
- datele sunt clasificate, cu retention și logging rules;
- failure modes, rollback/pause și idempotency sunt descrise;
- dependențele au versiuni disponibile, nu doar promisiuni;
- are testele de acceptare și ownerul de evidence;
- pentru bani, copii, Dating, Grow sau locație există review W6 înainte de cod.

### 4.4 Definition of Done

- cod strict, lint/type/unit/component/contract tests verzi;
- happy path, denied path, retry, timeout și duplicate event testate;
- authorization verificată server-side și, când e cazul, on-chain;
- observability, budget/cap, support runbook și data deletion path;
- client accessibility și minimum două clase de dispozitive reale;
- traceability requirement → test → build → release;
- review independent de autor pentru suprafețe critice;
- evidence pack arhivat și feature flag implicit sigur.

## 5. Dependențe și calea critică

### 5.1 Hartă

```text
Country/Policy + Data classification
        ├───────────────┬─────────────────────┐
        ▼               ▼                     ▼
Identity/Auth/Context   Trust & Safety        Rights Graph
        │               │                     │
        ├──────┬────────┴───────┐             │
        ▼      ▼                ▼             ▼
Client SDK   Chat/E2EE     Action Ledger   Media Pipeline
        │      │                │             │
        │      └──────┬─────────┘        Clips/Recommenders
        │             ▼                       │
        ├─────── Payments/Escrow              ├── Watch VOD
        │             │                       └── Live managed
        ▼             ▼                              │
Adult contexts + transactional verticals             │
        │                                             │
        └──────── integrated alpha/hardening ─────────┘
                           │
                           ▼
                    adult public beta
                           │
             media safety/rights maturity evidence
                           ▼
          Kids binary/tenant + Family/consent + catalog
                           ▼
                    Kids VOD pilot separat
```

### 5.2 Calea critică

1. CountryPolicy/data classification.
2. Identity/context envelope, session model și privacy enforcement.
3. API/ABI/event contracts + Action Ledger semantics.
4. Indexer/reconciler, payment state machines și failure handling.
5. Client SDK și admin/operations surfaces.
6. Trust/safety queues, dispute și incident tooling.
7. Media rights/moderation → Clips → Watch → allowlisted Live.
8. Integrated alpha → load/security/privacy testing → external gates.
9. Mainnet canary cu caps → closed beta → public beta waves.

Kids nu poate scurta calea prin simpla reutilizare a produsului adult: depinde de maturitatea Watch safety/rights, apoi creează o cale separată pentru authority/consent, binary/tenant, SDK inventory, catalog și child-risk assessment.

### 5.3 Reguli de dependency management

- contractele cross-workstream sunt versionate și au consumer-driven tests;
- breaking change necesită migration plan, dual-read/write când e cazul și owner pentru eliminarea versiunii vechi;
- niciun workstream nu are mai mult de două dependențe externe nerezolvate într-un sprint;
- un stub este permis pentru UI, dar nu contează ca integrare și nu trece release gate;
- blocajul extern produce degraded scope/feature gate, nu înlocuire fictivă a aprobării.

## 6. Backlog pe epics

### 6.1 Program, platformă și client

| Epic | Owner | Outcome | Dependențe | Gate de ieșire |
|---|---|---|---|---|
| GOV-01 Product OS & traceability | W0 | spec→ADR→test→release legate | documente normative | 100% P0/P1 requirements au owner/test |
| DEV-01 Monorepo & CI/CD | W8 | build/test/deploy repetabil | GOV-01 | staging reproducibil, provenance/SBOM |
| OBS-01 Telemetry & SLO | W8 | logs/metrics/traces fără date interzise | DEV-01, data catalog | alert și runbook testate |
| AUTH-01 Wallet authentication | W1 | challenge/nonce/session/revoke | policy + SDK spikes | fără replay/cross-wallet confusion |
| AUTH-02 Social auth & embedded wallet | W1 | Google/Apple baseline, recover/export | cryptographic model, provider review | recovery drills + audit gate |
| CTX-01 Account/multi-context | W1 | actor envelope și profile switch | AUTH-01 | isolation suite verde |
| PRV-01 ABAC/privacy matrix | W1/W6 | field/audience/country enforcement | CTX-01 | denied-path matrix și audit log |
| CLT-01 Design system & shell | W3 | switcher, navigation, composer identity | CTX-01 | accessibility + device baseline |
| ADM-01 Operations console | W3/W6 | reports, disputes, live control, audit | AUTH/PRV | least privilege + reason logging |

### 6.2 Chain, bani și Action Ledger

| Epic | Owner | Outcome | Dependențe | Gate de ieșire |
|---|---|---|---|---|
| CHN-01 Registry/badge/tipping | W2 | devnet SC + bindings | ABI Cell | invariants/fuzz/gas baseline |
| ACT-01 Session capabilities | W2/W1 | scoped, expiring, revocable actions | AUTH, secure storage | compromise/revoke drills |
| ACT-02 Per-shard ledger/relay | W2 | relayed action execution și fallback | ACT-01, network capabilities | ordered/executed/rejected reconciled |
| IDX-01 Indexer/reducer/reconciler | W2/W8 | deterministic read models | ACT-02 | replay from genesis/checkpoint matches |
| PAY-01 Payment primitives | W2 | EGLD/approved ESDT transfer/tip | IDX-01 | idempotency and finality proof |
| ESC-01 Generic escrow | W2/W6 | hold/release/refund/dispute/caps | PAY-01, policy | audit-ready invariants |
| ECO-01 Sponsorship economics | W2/W8 | quotas, budgets, relayer breaker | ACT/PAY | burn limits survive Sybil test |

### 6.3 Realtime, media și discovery

| Epic | Owner | Outcome | Dependențe | Gate de ieșire |
|---|---|---|---|---|
| MSG-01 E2EE messaging core | W4 | 1:1/group, multi-device, request inbox | AUTH/CTX | key/recovery/report tests |
| NTF-01 Push/activity center | W4/W3 | context-safe notifications | MSG/CTX | Dating privacy notification tests |
| MED-01 Upload/transcode/CDN | W5 | resumable upload, ABR playback | DEV/OBS | cost/startup/rebuffer targets |
| RGT-01 Rights graph & claims | W5/W6 | territory/use rights and appeals | policy/provider | takedown/counter-notice test |
| MOD-01 Content moderation | W6/W5 | scan, queue, reason, strike, appeal | ADM/MED | severe-content SLA drill |
| REC-01 Per-surface recommender | W5/W8 | feature allowlists, reason codes, controls | data/privacy/moderation | rollback/reset and harm tests |
| SRC-01 Search & discovery | W8 | ACL-aware index/query | CTX/PRV | no hidden-context leakage |
| CLP-01 Clips | W5/W3 | short upload/feed/interactions | MED/MOD/REC/ACT | end-to-end creator/viewer path |
| WAT-01 Watch VOD | W5/W3 | channels, VOD, captions, playlists, studio | MED/RGT/MOD/REC | allowlisted creator alpha |
| LIV-01 Managed Live | W5/W6 | ingest, LL-HLS, moderated chat, replay | WAT/RGT/MOD/OPS | emergency terminate + failover drill |

### 6.4 Încredere și verticale adulte

| Epic | Owner | Outcome | Dependențe | Gate de ieșire |
|---|---|---|---|---|
| TRU-01 Trust Center/reviews | W6/W7 | contextual claims, eligibility, appeals | CTX/IDX | no scalar universal score |
| DSP-01 Disputes & case management | W6/W2 | evidence, deadlines, adjudication trail | ESC/ADM | pause/refund decisions reconcile |
| SOC-01 Social graph/feed | W7/W5 | Social thin slice | CTX/CLP/MSG | meaningful interaction journey |
| WRK-01 Work | W7 | profile, connections, credentials | CTX/TRU/SRC | credential states explained |
| DAT-01 Dating baseline | W7/W6 | opt-in discovery/match/chat | CTX/MSG/PRV/TRU | 18+, isolation and safety drills |
| PUL-01 Pulse | W7/W6 | pseudonymous threads and integrity | alias vault/MOD/ACT | doxxing/brigading red-team |
| MKT-01 Marketplace | W7 | classifieds/offer/order/escrow | SRC/ESC/DSP/TRU | prohibited goods + money journey |
| TRV-01 Travel | W7 | listing/calendar/request/escrow | MKT primitives/ESC/DSP | no double booking in chaos tests |
| SRV-01 Business/services | W7 | pages, staff, slots, appointment escrow | CTX/SRC/ESC | atomic slot + cancellation |
| MOB-01 Mobility | W7/W6 | eligibility, dispatch, tracking, ride escrow | location/safety/ESC | city external gate, 24/7 desk |
| PRM-01 Promotion/reviews | W7/W6 | ad labels, billing, eligibility | REC/PAY/TRU | no sensitive targeting |
| MUS-01 Music baseline | W7/W5 | independent catalog and accounting | RGT/MED/PAY | territory rights complete |
| GRW-01 Grow baseline | W7/W6 | W0/W1 wellness/learning | PRV/credentials/policy | intended-purpose gate |
| AGT-01 Agent Gateway | W7/W6 | signed agent identity/capability/sandbox | AUTH/ACT/OBS | injection/egress/collusion tests |

### 6.5 Nexus Kids

| Epic | Owner | Outcome | Dependențe | Gate de ieșire |
|---|---|---|---|---|
| KID-00 Child-risk & country pack | K1/W6 | purpose, age bands, consent, store fit | external counsel/store guidance | approved pilot jurisdiction |
| KID-01 Separate binary/tenant | K1/W1/W8 | isolated auth, keys, DB, analytics, SDK | adult platform patterns, not adult tokens | zero cross-tenant test suite |
| KID-02 Family Center | K1/W3 | adult authority, consent/revoke/export/delete | KID-00/01 | parental flow independently reviewed |
| KID-03 Curated VOD catalog | K1/W5/W6 | age/country allowlist, safe search, controls | mature WAT/RGT/MOD | editorial and emergency removal SLA |
| KID-04 Child-safe recommendations | K1/W5 | finite, age-appropriate, explainable home | KID-03 | no profiling/ads/adult features |
| KID-05 Institutional Live | K1/W5/W6/OPS | verified broadcast, delay, no open chat | proven LIV + Kids VOD pilot | human coverage + terminate/replay drill |

## 7. Timeline de la Sprint 0 la public beta

Estimarea de bază folosește sprinturi de două săptămâni, un Sprint 0 de patru săptămâni și 4–6 workstreams active. Ținta este public beta adult în aproximativ 24 luni; intervalul realist rămâne 20–28 luni. Orice termen mai scurt presupune reducerea suprafețelor deschise, nu eliminarea gates.

### Sprint 0 — program bootstrap, săptămânile 1–4

- ratificare scope, ownership, RACI, evidence taxonomy și country hypothesis;
- spikes wallet/native, relayed v3, Matrix multi-device, HLS/Live provider, Action Ledger, recommender și Kids isolation;
- threat models și data catalog inițial;
- backlog epics, dependency graph, architecture runway și prototip;
- primele cereri către providers, app stores, auditori, counsel și rightsholders.

**Exit:** contractele critice au owner, failure modes și test plan; necunoscutele P0 au spike.

### S1–S5 — Foundation train, lunile 2–4

Fluxuri active: W1, W2, W3, W6, W8; W5 pornește după CI/media spike.

- monorepo, environments, auth wallet, context envelope și design shell;
- ABI draft, SC registry/tipping, relayer/indexer skeleton;
- media upload/player spike și Matrix facade;
- admin/report baseline, SLO și Test Bot Fabric;
- Kids rămâne design/risk only.

**Milestone M1:** demo două wallet-uri → două contexte → mesaj → tip pe devnet.

### S6–S12 — Common platform train, lunile 5–7

- privacy matrix, recovery, social auth baseline și country engine;
- Action Ledger/session capabilities, reconciler și payment/escrow primitives;
- E2EE core, push, moderation queues și dispute skeleton;
- Clips upload/feed heuristic, rights graph și recommendation contracts;
- search, analytics isolation și operations console.

**Milestone M2:** platformă comună E2E pe devnet, cu denied paths și reconciliation.

### S13–S20 — Adult product slices, lunile 8–11

- Social, Work, Dating/Pulse, Market, Travel thin slices;
- Services/appointments, events/split și Promotion baseline;
- Watch allowlisted: channels, VOD, captions, playlists, Creator Studio minim;
- Live allowlisted: single host managed ingest, moderated chat, replay și emergency end;
- Music independent și Grow W0/W1 numai în limitele rights/purpose;
- Mobility numai simulare/pilot tehnic, fără disponibilitate publică.

**Milestone M3:** feature-complete intern; toate traseele critice au test automat și runbook.

### S21–S28 — Integrated alpha, lunile 12–15

- contract și client integration hardening;
- device matrix, load, chaos, fuzz, gas și cross-shard tests;
- recommender controls, data deletion, rights disputes și payout reconciliation;
- Dating, Pulse, Live și mobility abuse/safety exercises;
- embedded wallet recovery și provider outage drills;
- external audit/counsel evidence packs pregătite.

**Milestone M4:** closed alpha. Se încadrează în fereastra normativă de aproximativ 11–15 luni.

### S29–S38 — Closed beta train, lunile 16–20

- audit independent și remediere; pen-test și DPIA/country review;
- mainnet canary allowlisted cu value caps, circuit breakers și reserve;
- creator/seller/host seeding; moderare și dispute cu personal real;
- Watch creators și Live events în allowlist;
- Mobility, Music, Grow și alte verticale reglementate rămân country/provider gated;
- cohort expansion numai dacă safety/cost/SLO gates se mențin.

**Milestone M5:** closed beta multi-country limitată, fără high/critical deschise.

### S39–S50 — Public beta waves, lunile 21–24 țintă

- Global Core pe țări/limbi în valuri;
- limits/risk reserves ajustate din date reale;
- app-store submissions, operational readiness și transparency reporting;
- Watch extins gradual; Live rămâne eligibility-based;
- funcțiile reglementate sunt deschise numai pe CountryPolicy, nu global simultan;
- noile P2 intră doar dacă nu consumă capacitatea de hardening.

**Milestone M6:** public beta adult. Fereastra de planificare este luna 20–28, chiar dacă ținta internă este luna 24.

### După public beta — Nexus Kids pilot separat

- **Lunile 24–30:** KID-00/01/02 numai dacă adult Watch are minimum două trimestre de safety/rights evidence și nu are P0/P1 structural nerezolvat.
- **Lunile 30–36:** KID-03/04, VOD catalog restrâns, o țară, două age bands, fără ads/upload/open social/wallet.
- **Lunile 36–42:** pilot VOD controlat; KID-05 institutional Live abia după rezultate favorabile, cu chat liber dezactivat.

Kids nu este folosit pentru a îmbunătăți metricile beta adult și nu împrumută history, graph, ads ID sau wallet-ul copilului.

## 8. Release gates

### G0 — Definition gate

- requirements P0/P1, owner, data class, country scope și failure behavior;
- threat model și dependency contract aprobate intern.

### G1 — Devnet integration

- auth/context/chain/message/media traseu E2E;
- reducer rebuild, duplicate/retry și denied path verificate;
- zero secrete în repo/loguri și SBOM/provenance disponibile.

### G2 — Alpha

- no critical/high security defects;
- privacy isolation, deletion și content/report flows operaționale;
- pause/refund/emergency terminate testate;
- cost și SLO în bugetul alpha.

### G3 — Mainnet canary

- audit independent pentru contracte cu fonduri și embedded-wallet cryptography;
- pen-test și remediere; multisig/keys/recovery drills;
- country legal pack și platform/provider approvals;
- operatori instruiți, on-call, dispute și incident desk;
- caps, allowlist, reserve, kill switch și rollback.

### G4 — Closed beta expansion

- minimum două release trains stabile;
- reconciliation mismatch zero nerezolvat, fraud loss în limită și payout SLA;
- safety SLA pe limbă/oră și appeal capacity;
- provider/CDN/relayer cost per active user sustenabil.

### G5 — Public beta country wave

- Country Pack valid, store listing exact și feature matrix publică;
- telemetry/consent/retention conforme;
- supply minim pentru marketplace/hosts/creators și support coverage;
- rollback pe țară/suprafață fără oprirea întregului produs.

### G-Kids — Pilot separat

- child-risk/DPIA și counsel/store clearance;
- separate binary, tenant, keys, roles, SDK inventory și analytics;
- verifiable parental authority/consent/revoke/export/delete;
- no behavioral ads, public upload, open chat, wallet sau individual chain history;
- catalog country × age allowlisted, emergency removal și moderatori specializați.

## 9. Ce poate face un program agent-heavy

### Agent-heavy, cu review intern

- PRD, ADR, schemas, OpenAPI/ABI, threat models și test plans;
- scaffolding, implementare, migrations, bindings și SDK-uri;
- unit/integration/contract/E2E/property/fuzz tests;
- static analysis, dependency/SBOM scanning și evidence collection;
- simulări de chain, replay/reconciliation, load și chaos în medii controlate;
- UI prototypes, accessibility scans și device automation;
- data catalog, DPIA/legal draft, policy draft și country-gap research;
- moderation classifier integration, rule tooling și runbooks;
- observability, dashboards, cost models și release notes;
- triere preliminară de buguri/rapoarte, fără decizia finală în cazuri sensibile.

### Porți umane sau externe obligatorii

- custodia și semnarea cu chei mainnet/multisig;
- audit independent al contractelor și criptografiei care controlează fonduri/chei;
- opinii juridice semnate, entitate, licențe, tax și country authorization;
- acorduri pentru muzică, video, hărți, plăți, transport, insurance și data providers;
- App Store/Google Play review și aprobarea social-login providers;
- moderare Live, CSAM/CSAE/NCII escalations și situații de pericol fizic;
- adjudecarea disputelor materiale și apelurilor cu efect financiar/uman;
- verificări identitate/documente când providerul sau legea cere;
- cercetare cu utilizatori, device QA fizic și accessibility expert review;
- Kids parental/child-risk assessment și operațiuni specializate;
- acceptarea explicită a riscului rezidual și bugetelor de rollout.

Agenții pot pregăti dosarul aproape complet pentru aceste porți, dar nu pot fi în același timp constructorul, auditorul independent, avocatul autorizat, rightsholder-ul, magazinul de aplicații sau operatorul de urgență.

## 10. Criterii de capacitate

### 10.1 Capacitate de livrare

| Semnal | Prag de operare | Acțiune dacă e depășit |
|---|---:|---|
| workstreams active | max. 6 | se oprește cel cu cea mai mică valoare/urgență |
| epicuri în implementare/workstream | max. 1 major + 1 maintenance | nu se pornește alt epic |
| dependențe cross-stream nerezolvate/slice | max. 2 | architecture cell sau re-slicing |
| changes critice fără reviewer independent | 0 | merge blocat |
| CI p95 | sub 30 min pentru gating suite | shard/cache sau reducere WIP, nu skip teste |
| flaky tests | sub 1% | release train blocat peste prag |
| carry-over sprint | sub 20% | se reduce scope și se corectează estimarea |
| defects P0/P1 deschise | 0 pentru release; trend descendent în dev | feature freeze/remediation |
| evidence coverage P0/P1 | 100% | gate respins |

Un nou workstream se activează numai dacă are owner, un reviewer din alt stream, environment, test budget și upstream contract stabil. Numărul de agenți nu este criteriu suficient de capacitate.

### 10.2 Buget de capacitate pe fază

- Foundation: 50% platform/security/data, 30% product slices, 20% quality/tooling.
- Integrated alpha: 35% platform, 35% vertical integration, 30% quality/safety.
- Closed beta: 20% features, 45% reliability/security/compliance, 35% operations/fixes.
- Public beta: maximum 20% new features până la două trains stabile; restul reliability, safety, costs și cohort learning.

### 10.3 Capacitate tehnică — profil inițial de test

Valorile sunt profile de test pentru prima cohortă, nu promisiuni de scală globală. W8 le recalculează după fiecare cohortă.

| Suprafață | Alpha target | Public-beta wave target | Gate |
|---|---:|---:|---|
| auth/API | 100 RPS susținut | 1.000 RPS susținut, 2× burst | p95/p99 în SLO, fără auth bypass |
| chat | 200 msg/s | 2.000 msg/s, reconnect storm | fără pierdere/duplicare semantică |
| feed starts | 50/s | 500/s, CDN cache miss scenario | startup/rebuffer în SLO |
| upload | 100 ore video/zi | 1.000 ore/zi cu quota | transcode SLA și cost/minut |
| Live | 10 streams / 2.000 viewers | 100 / 25.000 allowlisted | terminate/failover/mod coverage |
| chain relay | 20 tx/s susținut | 100 tx/s + 5× burst queue | budget breaker și reconcile |
| search | 100 QPS | 1.000 QPS | ACL leak zero, freshness target |
| payment/escrow | 1.000 cazuri test/canary | caps per country/cohort | mismatch zero, manual fallback |

Scalarea peste aceste praguri cere load evidence nou, cost model și capacity approval; nu se presupune liniaritate.

### 10.4 Capacitate operațională

Pentru fiecare limbă/țară și suprafață se calculează:

```text
necesar operatori = volum cazuri × timp mediu de lucru
                    / (ore disponibile × occupancy țintă 0,70)
```

- coverage Live există în aceleași ore în care creatorii pot porni stream;
- P0 safety are on-call și escaladare, nu doar coadă asincronă;
- dispute capacity trebuie să fie peste p95 arrivals, nu media săptămânală;
- dacă backlog-ul depășește SLA, se reduc cohorta, Live eligibility sau value caps;
- Kids cere echipă/queue/policy separată și nu folosește surplusul presupus al moderatorilor adulți.

## 11. Dashboard executiv

APD publică săptămânal un dashboard cu maximum 15 semnale:

- milestone confidence și critical-path slippage;
- WIP, dependency age și carry-over;
- build health, flaky rate și lead time;
- P0/P1 defects și control/evidence coverage;
- chain reconciliation, relayer burn și escrow exposure;
- privacy/isolation incidents;
- safety prevalence, action/appeal SLA și Live coverage;
- media startup/rebuffer/cost per delivered minute;
- fraud loss/GMV, payout/refund/dispute SLA;
- external gate status și expiration dates;
- capacity headroom pentru API/chat/media/chain/ops;
- country wave go/no-go.

Metricile sintetice/bot, agent și umane sunt etichetate separat. Test Bot Fabric nu intră în DAU, creator rewards, reviews, trends sau fraud baselines.

## 12. Reguli de go/no-go și descope

### Se face descope, nu compresie de control, când:

- un audit/counsel/provider gate întârzie;
- costul media/relayer depășește bugetul;
- safety operations nu acoperă cohorta;
- o verticală nu are supply/rights/authorization;
- un contract sau privacy boundary rămâne instabil.

Ordinea de descope recomandată:

1. se restrânge țara/cohorta/allowlist;
2. se reduce valoarea/durata/categoria;
3. se trece la read-only sau request-to-book/manual approval;
4. se dezactivează verticala afectată prin CountryPolicy;
5. se păstrează Global Core dacă izolarea este demonstrată.

Nu se elimină: auth integrity, privacy isolation, report/block/appeal, reconciliation, pause/refund, Live terminate, Kids separation sau disclosure-ul comercial.

## 13. Primele 30 de zile executabile

### Săptămâna 1

- APD creează program board, requirement IDs și dependency register;
- PPL mapează P0/P1 din documentele normative în epics;
- ARCH îngheață convențiile actor/context, money state și event envelope;
- W8 pornește monorepo/CI skeleton și evidence store;
- W6 deschide threat/data/country registers.

### Săptămâna 2

- ABI, identity, Matrix, media/live și Kids isolation spikes;
- prototip end-to-end pentru switcher, feed, inbox și checkout;
- provider/auditor/counsel/rightsholder request packs;
- test strategy pentru session keys, reducer rebuild și privacy boundaries.

### Săptămâna 3

- contract tests draft, SDK boundaries și schema evenimentelor;
- device/media cost benchmark;
- admin/report/dispute wireflow;
- prima red-team review pe cross-context și money movement.

### Săptămâna 4

- Sprint 0 demo și evidence review;
- decizii ADR, riscuri reziduale și backlog S1–S5;
- staffing/agent lane activation în limita de șase;
- gate M0 go/no-go.

**M0 Go** cere ca toate necunoscutele critice să fie fie rezolvate, fie izolate prin spike/feature gate/owner și termen. „Agenții vor găsi o soluție mai târziu” nu este o stare acceptabilă.

## 14. Concluzie operațională

Programul poate fi construit predominant de agenți, dar trebuie condus ca un sistem cu ownership, limite de WIP, review adversarial și evidence. Cea mai rapidă cale spre public beta nu este activarea tuturor agenților pe toate verticalele, ci stabilizarea platformei comune, livrarea de felii subțiri, gates independente și rollout în valuri. Watch și Live intră gradual în produsul adult; Kids rămâne separat și începe numai când NEXUS a demonstrat, nu doar a implementat, maturitatea media, rights și safety.
