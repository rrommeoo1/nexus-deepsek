# Programul agenților și Departamentul de Control Continuu

Acest document este normativ. El transformă specificațiile Nexus într-un program
de execuție: ownership pentru agenți, flux de lucru, separarea atribuțiilor,
control continuu, testare, release governance și timeline.

## 1. Model operațional

Nexus se construiește agent-heavy, dar nu ca o mulțime de agenți care modifică
simultan aceleași fișiere. Programul are trei linii independente:

```text
Owner / Product Council
        │ priorități, risc acceptat, buget și stage gates
        ▼
┌──────────────────── Delivery Guilds ─────────────────────┐
│ Product │ Platform │ Chain │ Experiences │ Media │ Data │
└──────────────────────────┬───────────────────────────────┘
                           │ build artifacts + evidence
                           ▼
┌──────────── Nexus Assurance & Control (NAC) ─────────────┐
│ QE │ AppSec │ Chain Assurance │ Privacy │ T&S/Kids       │
│ SRE/FinOps │ Model Risk │ Release/Configuration Control │
└──────────────────────────┬───────────────────────────────┘
                           │ independent pass/fail/retest
                           ▼
┌────────────── Third-line independent assurance ──────────┐
│ Internal Audit / independent assessor: samples NAC itself │
└──────────────────────────┬───────────────────────────────┘
                           ▼
┌──────────────── External release gates ──────────────────┐
│ independent audit │ counsel sign-off │ licenses/rights   │
│ app stores │ payment/identity providers │ authorities    │
└──────────────────────────────────────────────────────────┘
```

Un agent poate redacta și testa propriul cod, dar nu îl poate aproba singur pentru
release. Un agent din linia de control nu modifică implementarea pe care o evaluează;
deschide finding, verifică remedierea și păstrează evidence.

Delivery/Product/Operations sunt prima linie. NAC este a doua linie și controlează
designul/eficacitatea. Internal Audit sau un evaluator independent este linia a
treia și poate eșantiona NAC fără ca NAC să aleagă ori să modifice eșantionul.

## 2. Principii obligatorii

- `one owner per artifact`: fiecare epic, modul, contract, schemă și control are
  un singur accountable owner;
- `maker ≠ checker`: autorul nu este singurul reviewer și nu închide propriul finding;
- agenții lucrează din task packets versionate, nu din instrucțiuni conversaționale
  ambigue;
- maximum un work item activ per agent și maximum două guilds care modifică același
  bounded context într-un sprint;
- API/ABI/event/schema sunt contracte; schimbarea începe în contract, apoi consumers;
- orice cod vine împreună cu teste, telemetry, rollback și threat/privacy impact;
- release-ul este promovat, nu reconstruit diferit între staging și production;
- nicio funcție financiară/safety/Kids nu este activată doar pentru că build-ul trece;
- boții de test sunt `SYSTEM_TEST`, izolați și fără efect economic/reputațional;
- documentele `00`, `08`, `09`–`16` sunt sursa normativă; ADR-ul decide excepțiile;
- agenții produc drafturi juridice/audit evidence, nu semnătura unui auditor ori
  consilier autorizat și nu înlocuiesc operatorii de incidente fizice.

## 3. Organigrama logică a agenților

Rolurile sunt persistente logic, nu procese care trebuie să ruleze permanent.
Cu 4–6 sloturi concurente, Program Orchestrator pornește agenții după dependențe.

### 3.1 Conducere și arhitectură

| ID | Agent | Ownership | Livrabile principale |
|---|---|---|---|
| A00 | Program Orchestrator | backlog, dependențe, capacity, release train | plan, status, risk register, stage evidence index |
| A01 | Product Architect | PRD, domain boundaries, decisions, scope | epics, acceptance, ADR proposals, UX contracts |
| A02 | Solution Architect | architecture fitness și cross-module contracts | C4, ADR, dependency rules, migration plans |
| A03 | Design/Accessibility | design system și journey consistency | tokens, prototypes, WCAG/device/localization checks |

### 3.2 Platformă și infrastructură

| ID | Agent | Ownership | Livrabile principale |
|---|---|---|---|
| A10 | Platform/DevEx | monorepo, CI/CD, environments, generators | pipelines, templates, devcontainer, artifact promotion |
| A11 | Identity/Wallet | social login, embedded wallet, NativeAuth, recovery | auth modules, threat tests, provider adapters |
| A12 | Core Backend | Account/Profile/Graph/Notifications/Search | NestJS modules, OpenAPI, migrations, integration tests |
| A13 | Data/Event | Prisma/Postgres, outbox, schemas, lineage | data catalog, migrations, event registry, retention jobs |
| A14 | Realtime/Messaging | Matrix facade, E2EE ACL și websocket | device/room flows, delivery tests, abuse reporting |
| A15 | SRE/Cloud | IaC, observability, SLO, capacity și DR | environments, dashboards, alerts, restore/chaos evidence |
| A16 | P2P/Node Protocol | discovery, federation, placement, replication și receipts | Nexus Event Protocol, node daemon/SDK, conformance kit, settlement adapter |

### 3.3 Blockchain și plăți

| ID | Agent | Ownership | Livrabile principale |
|---|---|---|---|
| A20 | Chain Core | `nexus-actions`, capabilities, Supernova adapter | Rust contracts, ABI, scenario/fuzz/gas tests |
| A21 | Escrow Contracts | Market/Booking/Ride/Appointments/Tipping | state machines, invariants, liabilities, withdrawal tests |
| A22 | Chain Integration | relayers, indexer, reducer, reconciliation | TS bindings, queues, replay, mismatch repair |
| A23 | Payments/Risk | quotes, token allowlist, treasury și fraud | ledger, caps, risk rules, settlement evidence |

### 3.4 Experiențe și verticale

| ID | Agent | Ownership | Livrabile principale |
|---|---|---|---|
| A30 | Mobile Shell | Expo app, switcher, navigation, wallet signing | app shell, offline/error UX, device tests |
| A31 | Web/Admin | Next.js public/work/business/admin | SEO pages, dashboards, moderation console |
| A32 | Social/Pulse | posts, Clips, stories, aliases și Community Context | APIs/UI, feeds, integrity controls |
| A33 | Dating/Trust | discovery, compatibility, View Once și Meet Safe | isolated data/UI, verification, appeal/safety tests |
| A34 | Commerce | Market, Travel, Services, reviews și promotions | listings, calendars, checkout, disputes |
| A35 | Mobility | dispatch, geo, trips, driver eligibility și SOS | state machine, realtime, safety and city gates |
| A36 | Music/Grow | rights/player/royalties și W0/W1 content | catalog, entitlement, privacy/claims controls |
| A37 | Agent Network | Agent Profiles, A2A/MCP, test fabric | gateway, sandbox, capabilities, synthetic town |

### 3.5 Media, recomandări și Kids

| ID | Agent | Ownership | Livrabile principale |
|---|---|---|---|
| A40 | Media VOD | upload, FFmpeg, ABR, CDN, captions | pipeline, lifecycle, cost/load and delete tests |
| A41 | Watch/Live | channels, Creator Studio, managed ingest și replay | provider adapter, player, live control, failover |
| A42 | Recommender | candidates, rankers, explanations și experiments | feature contracts, models, evaluation, rollback |
| A43 | Rights/Creator | fingerprint, claims, strikes și payouts | rights graph, counter-notice, statements |
| A44 | Family/Kids | Family Center, child tenant și safe catalog | parent flows, isolation, Kids player/control tests |

## 4. Nexus Assurance & Control — departament independent

NAC are autoritate de a bloca promovarea unui artifact. Nu schimbă prioritățile de
produs și nu acceptă risc în numele owner-ului; clasifică, verifică și recomandă.

### 4.1 Celulele NAC

| ID | Control cell | Mandat | Poate bloca pentru |
|---|---|---|---|
| C01 | Quality Engineering | funcțional, contract, regresie, device, accessibility | acceptance ratat, flakiness, defect critic |
| C02 | Application Security | auth, API, mobile, supply chain, secrets | Critical/High, secret leak, exploitable dependency |
| C03 | Chain Assurance | invariants, gas, cross-shard, upgrade, reconciliation | funds/liability mismatch, replay, audit failure |
| C04 | Privacy & Data | purpose, consent, access, retention, deletion, DPIA | sensitive leak, no lawful/purpose gate, deletion failure |
| C05 | Compliance Control | country matrix, terms, provider/license evidence | feature fără country/legal/provider approval |
| C06 | Trust & Safety | UGC, fraud, moderation, appeals, incident readiness | P0/P1 gap, report/block/appeal inoperabil |
| C07 | Child Safety | Kids isolation, consent, catalog, SDK și age design | child/adult leak, open social, invalid consent, behavioral ads |
| C08 | Model Risk & Integrity | recommenders, agent behavior, bias, manipulation | unsafe amplification, hidden paid, unlabelled agent, no rollback |
| C09 | SRE/Resilience | SLO, capacity, DR, backup, chaos, on-call | restore/failover/kill switch/SLO gate ratat |
| C10 | FinOps/Economic Control | gas, CDN, provider, fraud loss, treasury | cap lipsă, unit economics peste limită, reconciliation gap |
| C11 | Release & Configuration | provenance, approvals, flags, SBOM, promotion | artifact nereproductibil, config drift, evidence incomplet |
| C12 | Assurance Analytics | populații, sampling, scorecards și recurrence | eșantion invalid, rată raportată incorect, drift ignorat |
| C13 | Decentralization Assurance | Sybil/eclipse, node-owner diversity, conformance, state sync și receipt fraud | mesh nesigur, fork, under-replication, peer concentration |

Internal Audit nu este celulă NAC, nu proiectează controalele pe care le auditează
și raportează direct Owner/Board. Auditul extern rămâne obligatoriu pentru contracte,
criptografie și alte porți unde independența formală este materială.

### 4.2 Independență și acces

- Delivery are write pe feature branches și nu poate modifica evidence semnat după gate;
- NAC are read pe cod/config și write numai pe findings, test harness, evidence index
  și control definitions; fixul aparține Delivery;
- production deploy necesită C11 + owner, iar funcțiile financiare/Kids cer și
  C03/C04/C07 după caz;
- emergency suspend este permis T&S/SRE prin break-glass; reactivarea cere maker-checker;
- audit log-ul pentru override conține motiv, expirare, compensating controls și owner;
- un risk acceptance are termen; nu poate ascunde Critical ori obligație externă.
- agenții generativi pot colecta dovezi și propune CAPA, dar nu pot închide findings
  Critical/High sau accepta riscul în numele owner-ului;
- Live kill este mecanism deterministic/preautorizat, independent de un model
  generativ, și este testat cel puțin săptămânal înainte/în timpul operării Live;
- Kids este deny-by-default: niciun model, SDK, endpoint sau feature Core nu intră
  în tenant fără control C07 explicit și test de rețea/date.

## 5. RACI pentru decizii critice

`A` = accountable, `R` = execută, `C` = consultat/verifică, `I` = informat.

| Decizie/livrabil | A | R | C | Gate extern |
|---|---|---|---|---|
| Scope și prioritate | Owner/Product Council | A00/A01 | A02, C01, C10 | nu |
| API/event contract | A02 | A12/A13 | C01/C02/C04 | nu |
| Smart contract ABI | A20/A21 | A20/A21 | C03, A22 | audit înainte de fonduri |
| Embedded wallet model | A11 | A11 | C02/C04/C05 | audit crypto + memo custody |
| Country feature enable | C05 + Owner | domain agent | C04/C06/C10 | counsel/provider/authority |
| Recommender launch | A42 | A42 | C04/C06/C08 | după caz DSA review |
| Kids country launch | A44 + Owner | A44 | C04/C05/C06/C07/C09 | counsel + app stores |
| Live public enable | A41 | A41/A43 | C06/C09/C10 | rights/provider readiness |
| Permissionless node/rewards enable | A16 + Owner | A16/A15/A22 | C02/C03/C04/C09/C10/C13 | protocol audit + receipt economics |
| Mainnet deploy cu fonduri | Owner | A20/A22/A23 | C02/C03/C09/C11 | audit independent |
| Incident P0 | Incident Commander | SRE/T&S/domain | Legal/Privacy/Comms | autorități/provider după caz |
| Production release | C11 + Owner | Platform agent | toate controalele aplicabile | gates aplicabile |

## 6. Unitatea de lucru: Agent Task Packet

Niciun agent nu primește doar „construiește modulul”. Task packet-ul conține:

```yaml
task_id: NX-AREA-0001
objective: rezultat observabil
owner_agent: Axx
review_agents: [Ayy, Czz]
normative_refs: [docs/...]
in_scope: []
out_of_scope: []
dependencies: []
contracts_changed: [openapi, abi, events, db]
data_classes: []
threats_and_failure_modes: []
acceptance_tests: []
observability: []
rollback_or_kill_switch: ...
evidence_required: []
timebox: ...
```

Un packet trebuie să încapă în 0,5–3 zile agentice. Pachetele mai mari se împart
pe contract → implementation → integration → hardening. Agentul nu extinde scope-ul
fără change request și impact asupra timeline-ului.

## 7. Workflow standard

```text
IDEA
 → TRIAGED
 → READY (contract + risks + acceptance)
 → IN_PROGRESS
 → AUTHOR_SELF_TEST
 → PEER_REVIEW
 → NAC_CONTROL_TEST
 → READY_FOR_INTEGRATION
 → INTEGRATED
 → STAGING_EVIDENCE
 → RELEASE_CANDIDATE
 → CANARY
 → RELEASED / ROLLED_BACK
```

Reguli:

1. A01/A02 definesc contractul și acceptance înainte de ecrane/cod masiv.
2. Agentul owner implementează într-un worktree/branch limitat.
3. Un peer verifică design, correctness și contract drift.
4. NAC rulează controalele aplicabile din control registry.
5. Contract tests și migration checks preced merge-ul.
6. Artifactul immutable este semnat, are SBOM/provenance și merge în staging.
7. C11 construiește Evidence Pack; lipsa dovezii înseamnă control neexecutat.
8. Canary folosește flags/caps; observability decide promovare sau rollback.

## 8. Stage gates

| Gate | Moment | Dovezi obligatorii | Decizie |
|---|---|---|---|
| G0 Scope | epic start | PRD, owner, dependencies, out-of-scope, risk class | start/refine/reject |
| G1 Architecture | înainte de build | ADR, threat/privacy/data flow, API/ABI draft | approve/rework |
| G2 Implementation | înainte de merge | tests, lint/type/static, review, migration/rollback | merge/block |
| G3 Integration | environment integrat | contract/E2E, reconciliation, telemetry, failure injection | promote/fix |
| G4 Assurance | release candidate | security/privacy/safety/model/FinOps evidence | conditional/pass/fail |
| G5 External | înainte de funcție reglementată | audit/opinie/licență/provider/store | enable/geo-block |
| G6 Canary | mainnet 1–5% | caps, SLO, incidents, cost și business guardrails | expand/rollback |
| G7 General | 25–100% | observation window și no regression | release/hold |
| G8 Post-release | 7/30 zile | control effectiveness, incidents, cost, feedback | retain/change/retire |

`conditional pass` are owner, compensating control și expiry. Nu este permis pentru
Critical, child/adult data leak, custody ambiguity, unreconciled funds sau kill
switch inoperabil.

## 9. Programul de testare

### 9.1 Piramida obligatorie

| Nivel | Rulare | Conținut |
|---|---|---|
| Static | fiecare schimbare | format/lint/type, SAST, secrets, licenses, SBOM, IaC/policy |
| Unit | fiecare schimbare | domain rules, reducers, ranking constraints, serialization |
| Property/fuzz | PR + nightly | contract invariants, parsers, state machines, privacy policies |
| Contract | PR/integration | OpenAPI, events, ABI/TS bindings, consumer-driven contracts |
| Integration | PR/nightly | DB/Redis/object storage/Matrix/provider adapters/devnet |
| E2E | nightly/release | journeys pe mobile/web, wallet, tx, escrow, report/delete |
| Non-functional | nightly/release | load, soak, chaos, accessibility, locale, device, battery/network |
| Adversarial | weekly/release | fraud, Sybil, prompt/tool injection, raids, doxxing, NCII, Kids escape |
| Recovery | monthly/release | backup/restore, replay/rebuild, key rotation, provider failover |
| Production control | continuous | canary probes etichetate, reconciliation, drift și SLO |

### 9.2 Suite pe domenii

**Blockchain:** unit/scenario/property/fuzz, exact payments, liabilities, pause,
upgrade/storage compatibility, callbacks/cross-shard, gas snapshots, ordered vs
executed, relayer drain și reducer replay. Scenariile critice rulează differential
în Rust VM/Go VM, iar indexer/reconciler verifică double-entry liabilities/balances.

**Identity/wallet:** issuer-sub linking, PKCE/state/nonce, device loss, recovery,
export, merge proof, provider outage, session capability escalation și revoke.

**Privacy:** cross-profile/field ABAC, Dating/Kids no-join, on-chain payload scan,
consent withdrawal, export/delete, backup expiry și purpose-bound access.

**Media/Live:** corrupt/resumable uploads, codec/device matrix, ABR/rebuffer, CDN
purge, rights territory, ingest failover, emergency terminate, chat raid și replay.

**Dating:** mutual eligibility, no scalar score, age gate, liveness expiry, View Once
key revoke, screenshot disclosure, Meet Safe și no-show appeals.

**Commerce/Mobility:** quote snapshot, double-spend/booking, cancellation boundaries,
refund, dispute, location TTL, driver assignment race, PIN și SOS independence.

**Recommenders/agents:** feature allowlist, reason codes, paid separation, bias,
feedback loops, agent/test exclusion, no-label deception și model rollback.

**Kids:** child token deny pe toate API-urile adulte, catalog allowlist, country/age
band, parent consent/revoke, no ad IDs, no chain child history, autoplay/time limits,
safe search, Live/chat disable și SDK network inspection.

### 9.3 Praguri de release

- zero Critical/High security findings deschise; Medium are owner/expiry;
- 100% money-moving endpoints au invariant, negative și reconciliation tests;
- 100% mutații adulte din Action Registry au exact un tx class;
- 100% endpoint-uri au auth/context/rate/idempotency classification;
- 100% date sensibile au owner, purpose, retention și access policy;
- zero contract drift OpenAPI/event/ABI în CI;
- test flake rate < 1%; quarantine nu poate ascunde release-critical tests;
- crash-free sessions ≥ 99,5% în beta și target ≥ 99,8% înainte de scale;
- API availability ≥ 99,9% pentru Global Core; payment/chain reconciliation exact;
- backup restore și reducer rebuild trec în fereastra RTO declarată;
- Kids isolation și emergency kill tests au 100% pass, fără waiver.

Coverage numeric este semnal, nu scop. Baseline: ≥80% statement/branch pe domain
core și ≥90% pe money/safety reducers, completat cu mutation/property testing.

## 10. Control Registry

Fiecare control are:

```text
control_id, objective, risk, owner, operator, evidence_source,
frequency, population, sample_method, threshold, exception_policy,
last_result, next_due, remediation_owner, mapped_requirements
```

### Frecvențe

| Cadență | Controale |
|---|---|
| la commit/PR | static, tests, dependency, schema/ABI drift, secrets, policy-as-code |
| la merge | integration, migrations, artifact signing, SBOM/provenance |
| zilnic | chain reconciliation, backup status, node replica/checkpoint health, critical alerts, moderation backlog |
| săptămânal | vulnerability triage, access changes, node conformance/Sybil signals, bot/integrity, cost anomalies |
| bilunar | sprint quality, risk review, threat/privacy deltas, model experiments |
| lunar | restore/replay, node state-sync/region loss/receipt challenge, privileged access, retention purge, vendor SLO, control sample |
| trimestrial | tabletop, disaster recovery, key rotation, DPIA/vendor/risk review |
| per release | complete Evidence Pack și applicable stage gates |
| anual/major | external audit, pen-test, policies/country packs, insurance/licensing |

Control Registry v1 pornește cu minimum 131 de controale unice, cu ID stabil,
împărțite între quality, security, chain, privacy, compliance, T&S, child safety,
FinOps, SRE și model/agent risk. Numărul poate crește, dar un control nu este șters;
este retras cu motiv, succesor și data ultimei evidence.

### Sampling

- 100% pentru T0: child contact, wallet intent, escrow liabilities, authz/E2EE keys,
  Live kill, production promotion și country enable;
- stratified risk sampling pentru moderare/dispute/appeals pe severitate, limbă,
  țară, cohortă, model/operator și outcome;
- random baseline obligatoriu lângă risk sampling pentru estimarea ratei reale;
- oversampling pentru evenimente rare/high-harm, raportat cu ponderi corecte;
- event-driven resampling după incident sau schimbare de model, policy, vendor,
  schemă, limbă, țară ori age band;
- agentul nu alege singur populația/eșantionul folosit pentru propria evaluare.

### Findings și CAPA

| Severitate | Containment | Plan CAPA | Remediere implicită |
|---|---:|---:|---:|
| Critical | imediat, țintă ≤1h | ≤24h | ≤72h sau suprafața rămâne oprită |
| High | ≤24h | ≤3 zile | ≤14 zile |
| Medium | ≤5 zile | ≤10 zile | ≤30–60 zile după risc |
| Low | în backlog controlat | următorul review | ≤90 zile sau acceptare expirabilă |

CAPA separă corecția imediată de schimbarea sistemică. Închiderea cere retest
independent și observation window; dacă același root cause revine, severitatea
crește și control-effectiveness este reevaluat.

## 11. Evidence și trasabilitate

Evidence Pack per release include:

- commit, artifact digest, dependency lock, SBOM și build provenance;
- migrations, API/event/ABI diff și compatibility report;
- test run IDs, failures, flakes, coverage/mutation și device matrix;
- threat model/privacy/data-flow delta și control results;
- smart contract gas/invariant/fuzz/scenario/reconciliation reports;
- SAST/DAST/dependency/IaC/container/mobile reports;
- moderation/safety/abuse simulations și appeal results;
- model card, datasets/features, offline/online metrics și rollback;
- performance/cost capacity și treasury/relayer budgets;
- approvals, exceptions, external findings și remediation status;
- deployment manifest, flags/caps, dashboards, alerts și rollback proof.

Evidence este content-addressed și read-only după gate. Hash-ul poate fi ancorat
periodic, dar conținutul, vulnerabilitățile, PII și secretele nu intră on-chain.

### 11A. Vendor assurance

Fiecare vendor critic — wallet/MPC, identity/liveness, Matrix, media/live/CDN,
moderation/model, payments/maps și cloud — are owner, data flow, regiuni,
subprocesatori, retention/training terms, breach SLA, audit rights, SLO, cost caps,
concentration risk, exit/export și fallback testat. Schimbarea versiunii/modelului,
termenilor, regiunii ori subprocessors declanșează G7 material-change review.

Live kill, E2EE recovery, chain index/reconciliation, wallet recovery și payment
refund nu depind de un singur API fără degraded mode ori runbook contractual.

## 12. Medii și promovare

```text
local/worktree
 → ephemeral CI per PR
 → shared integration
 → MultiversX devnet + synthetic town
 → staging cu servicii managed sandbox
 → preproduction/mainnet shadow fără efect financiar
 → mainnet canary allowlist/caps
 → production waves
```

- production data nu este copiată în non-production;
- synthetic fixtures au namespace și cleanup;
- secrets/keys/relayers/treasury sunt diferite per mediu;
- staging folosește aceeași configurație structurală și același artifact;
- mainnet shadow nu scrie acțiuni economice fără capability explicită;
- config/feature flags sunt versionate și validate de C11;
- Supernova capability este detectată live; fallback-ul rămâne testat.

## 13. Release trains

- `continuous` pentru docs/tests/non-user-facing low risk;
- săptămânal pentru backend/web în spatele flags;
- bilunar pentru mobile release candidate, ținând cont de store review;
- lunar pentru contracte non-financiare și numai cu timelock/compatibility;
- contractele financiare se lansează la milestone, nu pe calendar;
- Country Packs și Kids au release train separat;
- nu se lansează simultan două verticale financiare sau Live + Kids country nou.

Canary standard: internal → allowlist → 1% → 5% → 25% → 100%, cu minimum o
fereastră de observație adaptată riscului. Fiecare pas are stop conditions explicite.

## 14. Incident management

| Severitate | Exemplu | Răspuns inițial | Acțiune |
|---|---|---:|---|
| SEV0 | fonduri/child safety/chei compromise/pericol imediat | imediat, țintă <15 min | pause/kill, incident command, preserve evidence |
| SEV1 | auth bypass, sensitive leak, harmful live activ | <30 min | contain, notify owners, external assessment |
| SEV2 | degradare majoră, reconciliation lag, moderation breach | <2 h | mitigate, communicate, tracked fix |
| SEV3 | defect limitat fără risc imediat | business day | backlog cu SLA |

Roluri: Incident Commander, Technical Lead, Safety/Privacy/Legal liaison,
Communications și Scribe. Agenții pot detecta, corela, redacta și executa runbook-uri
reversibile; suspendarea/rollback-ul preautorizat este automat. Contactarea
autorităților, victimelor, rightsholders sau serviciilor de urgență urmează procesul
uman/legal al pieței.

Post-incident review este blameless, dar produce owners și date. Acțiunile sunt
urmărite până la retest; „monitoring added” singur nu închide cauza rădăcină.

## 15. Alocarea capacității

Pentru fiecare ciclu:

- 55% feature delivery și integrare;
- 20% quality/security/privacy/safety controls;
- 10% platform, observability și developer experience;
- 10% defecte, reliability, cost și tech debt;
- 5% discovery/spikes.

În hardening, controlul crește la 35–40%, iar feature work scade. Un release train
care nu rezervă capacitate pentru findings nu este considerat plan realist.

## 16. Timeline executabil — primele 16 săptămâni

### Săptămâna 0–1 — Program bootstrap

- A00 creează backlog, dependency map, task packet template și decision log;
- A10 creează monorepo skeleton, branch rules, CI minimal și artifact conventions;
- A02 fixează bounded contexts, CODEOWNERS logic și API/ABI governance;
- NAC publică Control Registry v1, severity model și Evidence Pack template;
- alegem furnizorii numai prin spikes/adapters, fără lock-in contractual prematur.

**Exit:** 100% epics au owner, normative refs, risk class și dependency; CI poate
rula un modul dummy end-to-end.

### Săptămâna 2–3 — Contract-first foundation

- OpenAPI/events/Prisma/ABI v0 și generator clienți;
- identity/wallet, ActionEnvelope și Profile Context threat models;
- environment/IaC skeleton, secrets boundaries și observability baseline;
- mobile/web design shell și accessibility tokens;
- test fixtures/Synthetic Town și first control probes.

**Exit:** contract drift rupe CI; trace unic traversează client → API → outbox → worker.

### Săptămâna 4–5 — First walking skeleton

- social login sandbox → embedded wallet spike → profil activ;
- session capability pe devnet → `recordAction` → indexer → reducer → UI status;
- media upload mic → transcode → signed playback;
- report/block și audit log minimal;
- C02/C03/C04 execută primul gate independent.

**Exit:** două conturi execută un follow/like devnet fără popup repetat și read model
se reconstruiește; nicio PII în tx.

### Săptămâna 6–7 — Communication și commerce slice

- Matrix E2EE facade și private action commitment;
- Market listing → chat → quote → escrow test token → release/refund;
- idempotency, reconciliation și failure injection;
- device matrix minim și restore drill.

**Exit:** flux end-to-end cu tx distincte și compensare demonstrată.

### Săptămâna 8–9 — Social media slice

- Clips feed/upload/like/comment; Pulse post/thread/alias;
- Watch channel/video/subscription/playlist allowlisted;
- recommender heuristic cu Following/Subscriptions și explanation codes;
- rights/moderation precheck și purge.

**Exit:** același asset poate produce Clip/Watch manifest, fără rights/audience bypass.

### Săptămâna 10–11 — Dating și Trust slice

- isolated Dating schema, preferences, curated candidates și match;
- Trust claims D0/D1, E2EE conversation, block/report;
- View Once non-explicit prototype și purge/evidence boundary;
- red-team pentru cross-profile, inference și target leakage.

**Exit:** zero Dating data în global search/ads/features și match target absent din tx.

### Săptămâna 12–13 — Services și operations slice

- Business Page + salon service + availability + appointment deposit;
- notification/push, review eligibility și dispute queue;
- dashboards pentru action latency, reconciliation, gas, media cost și moderation;
- incident tabletop și kill-switch rehearsal.

**Exit:** programare/check-in/outcome/review verificat și refund testat.

### Săptămâna 14–16 — Integrated technical demo

- managed Live single-host, moderated chat, emergency end și replay;
- end-to-end regression, load, chaos, accessibility și security review;
- devnet demo: onboarding → profile → Clips/Watch/Pulse → chat → Market/Appointment;
- Evidence Pack G0–G4, defect burn-down și Etapa 1 re-estimation.

**Exit:** demo tehnic repetabil, nu public beta; zero Critical/High, rollback și
restore dovedite, backlog recalibrat pe date reale.

Nexus Kids în aceste 16 săptămâni primește numai architecture/threat/privacy spike,
tenant proof și parent-flow prototype. Nu primește public catalog sau child users.

## 17. Timeline macro și release trains

| Interval | Rezultat | Gates dominante |
|---|---|---|
| 0–1 lună | program/architecture/control bootstrap | G0–G1 |
| 2–4 luni | walking skeleton și demo tehnic integrat | G2–G4 |
| 5–10 luni | fundație productizată + primele thin verticals | G3–G4 |
| 11–15 luni | closed alpha feature-complete | G4 |
| 15–20 luni | closed beta multi-country, audit și operations | G4–G6 |
| 20–28 luni | Global Core public beta în valuri | G5–G8 |
| 24–34 luni | Phase 2 Watch/Live/creator/agent maturity | gates specifice |
| 30–42 luni | Nexus Kids VOD pilot separat | C04–C07 + G5–G8 |
| 48–60+ luni | Phase 3 și verticale/licențe extinse | continuu |

Datele sunt cumulative de la start și presupun 4–6 workstreams active, servicii
managed și thin slices. Adăugarea de workstreams fără a crește review/control
capacity mărește defectele și nu scurtează calea critică.

## 18. Backlog prioritar pentru următorul ciclu

### P0 — începe imediat

1. `NX-CAP-001`: profil ChatGPT Plus, WIP, checkpoint și buget de testare.
2. `NX-PROG-001`: task packet, ownership, status și risk registry.
3. `NX-ARCH-001`: monorepo/bounded contexts/import rules/ADR.
4. `NX-CONTRACT-001`: OpenAPI/event/ABI skeleton și compatibility CI.
5. `NX-PLAT-001`: CI, artifacts, SBOM, secrets scan și ephemeral environment.
6. `NX-AUTH-001`: Identity Broker + embedded-wallet proof + recovery threat model.
7. `NX-CHAIN-001`: ActionEnvelope/capability/`nexus-actions` devnet proof.
8. `NX-CHAIN-002`: indexer/reducer/reconciliation walking skeleton.
9. `NX-MEDIA-001`: signed upload/transcode/HLS/purge proof.
10. `NX-QA-001`: test taxonomy, fixtures, quality thresholds și first E2E.
11. `NX-CTRL-001`: Control Registry/Evidence Pack/severity/stage gates.
12. `NX-SEC-001`: threat model, data classification și baseline policy-as-code.
13. `NX-OBS-001`: traces, metrics, logs, SLO și cost tags.

### P1 — după contractele P0

- profile switcher/ABAC și privacy matrix;
- Matrix E2EE facade/private actions;
- Clips/Pulse/Watch walking slices;
- Market escrow test-token slice;
- report/block/appeal și moderation queue;
- Dating isolated schema/candidate proof;
- Business/appointment slice;
- managed Live adapter proof;
- Synthetic Town și agent metric isolation.
- Nexus Node Network D0 proof: Genesis `N=1`, backup/export/recovery, permissionless
  join fără tx, apoi simulări `N=2..8` pentru `R=min(N,3)`, checkpoint replay,
  failure repair, shard activation și receipt settlement pe devnet.

### Spike-only până la gate

- Mobility public: routing/dispatch/safety proof, fără ofertă publică;
- Music catalog comercial: rights contracts, nu ingestion nelicențiat;
- Kids: tenant/consent/catalog architecture, fără child production data;
- mainnet funds: audit independent înainte de caps semnificative;
- token NXS: niciun build înainte de PMF și opinie formală.
- rewards pentru noduri permissionless: numai după D0, Sybil/eclipse red-team,
  receipt economics și conformance audit independente; join-ul fără rewards rămâne deschis.

## 19. Scorecard săptămânal

| Dimensiune | Indicator |
|---|---|
| Delivery | accepted packets, lead time, blocked age, scope changes |
| Quality | escaped defects, flake rate, mutation score, rollback rate |
| Security | open findings by age/severity, patch SLA, secret events |
| Chain | gas/action, failure/revert, reconciliation delta, execution lag |
| Privacy | denied cross-context attempts, delete SLA, access anomalies |
| Safety | P0/P1 prevalence, triage/containment, appeal overturn |
| Reliability | SLO/error budget, MTTR, restore/replay result |
| Cost | gas/WMP, CDN/minute, provider unit cost, fraud loss |
| Models | harmful exposure, diversity, reset success, drift/rollback |
| Kids | isolation violations, consent validity, catalog/safe-search escapes |
| Agents | review rework, hallucinated contract drift, unsafe tool attempts |

Scorecard-ul separă leading indicators de rezultate. Numărul de linii generate,
teste brute, tx-uri sau boți nu este productivitate și nu intră ca North-star.

## 20. Definition of Done pentru un epic

- acceptance observabil îndeplinit și demo repetabil;
- API/ABI/events/DB versionate, clients regenerate și compatibility green;
- tests aplicabile trecute, inclusiv negative/failure/recovery;
- threat/privacy/safety/data classification actualizate;
- telemetry, dashboard, alerts, SLO și cost tags active;
- migration, rollback/kill switch și restore/replay demonstrate;
- docs/runbook/support/moderation/admin actualizate;
- findings rezolvate/retestate și Evidence Pack complet;
- external/country/provider gates atașate sau feature flag default-off;
- no secrets/PII/child data în repo, logs, tx sau fixtures;
- owner și NAC semnează gate-ul aplicabil.

## 21. Primul checkpoint de conducere

La sfârșitul săptămânii 1, Owner/Product Council primește:

1. backlog P0 cu task packets și dependențe;
2. architecture/decision map și lista spikes;
3. Control Registry v1 și matricea controalelor pe epic;
4. environment/CI blueprint și cost envelope;
5. top 20 risks cu owner și early-warning indicator;
6. planul demo-ului din săptămâna 16;
7. lista explicită a porților externe și lead time estimat.

Niciun agent nu începe o verticală nouă până când fundația comună și control
capacity nu pot absorbi schimbarea. Aceasta menține viteza fără a transforma
paralelismul în rework și risc ascuns.

## 22. Profil operațional ChatGPT Plus

Rolurile din organigramă rămân ownership logic, nu agenți care consumă permanent
capacitate. În faza bootstrap se execută un singur task packet, implicit cu agentul
principal. Un worker poate fi pornit numai la cererea explicită a owner-ului și
numai pentru o componentă independentă; checker-ul T0/T1 rulează secvențial.

Testarea la scară folosește proporția țintă `90/9/1`: 90% actori și verificări
deterministe locale, 9% evaluări generative țintite și 1% review independent de
release. Astfel, mii de identități simulate nu cer mii de sesiuni LLM.

La semnalarea unei limite se închide unitatea sigură curentă și se persistă starea,
dovezile, riscurile și următoarea acțiune. Nu se cumpără credite, nu se activează
auto-recharge și nu se pornește API plătit fără aprobarea explicită a Owner-ului.
Regulile complete sunt în [`AGENTS.md`](../AGENTS.md), iar bugetarea în
[`planning/openai-plus-capacity-plan.md`](../planning/openai-plus-capacity-plan.md).
