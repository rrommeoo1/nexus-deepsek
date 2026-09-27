# Nexus — departamentul independent de control continuu

> **Research snapshot, nu document normativ.** Cerințele obligatorii ale produsului rămân în documentele normative Nexus. Acest document proiectează funcția de control, testare și asigurare care verifică acele cerințe fără a le modifica.

**Versiune:** 0.9  
**Data de referință:** 1 august 2026  
**Domeniu:** Quality, Security, Privacy, Compliance, Trust & Safety, FinOps, SRE, Model Risk și Child Safety pentru Nexus Core, Watch, Live și Kids

## 1. Mandat și rezultat urmărit

Departamentul propus se numește **Nexus Assurance & Integrity (NAI)**. Misiunea lui este să producă dovezi independente, continue și reproductibile că produsul:

- funcționează conform specificațiilor și SLO-urilor;
- protejează utilizatorii, fondurile, datele și cheile;
- respectă limitele dintre profiluri și dintre suprafețele Core, Watch, Live și Kids;
- operează controalele juridice și de politică declarate;
- menține costurile, furnizorii și capacitatea în limite aprobate;
- guvernează modelele ML și agenții AI ca sisteme cu risc, nu ca autorități autonome;
- detectează rapid degradarea și blochează lansările sau funcțiile nesigure;
- păstrează probe suficiente pentru investigație, audit și remediere.

NAI este **a doua linie de apărare**. Nu construiește feature-ul, nu îl operează zilnic și nu își aprobă propriile excepții. Engineering/Product/Operations reprezintă prima linie; Internal Audit sau un auditor independent reprezintă linia a treia. NAI poate opri o lansare, cere containment sau suspenda temporar o suprafață prin mecanisme prestabilite, dar nu înlocuiește conducerea responsabilă, DPO-ul, consilierul juridic ori auditul extern.

### 1.1 Principii

1. **No evidence, no pass.** Declarațiile și capturile de ecran izolate nu sunt dovadă suficientă.
2. **No self-approval.** Creatorul, operatorul, testerul și aprobatorul unui control sunt roluri separate.
3. **Risk before coverage.** 100% controale cosmetice nu compensează un control critic neexecutat.
4. **Fail closed pentru copii, bani, privacy și access control.** Lipsa dovezii blochează funcția afectată.
5. **Continuous, not ceremonial.** Controlul rulează la schimbare și la frecvență, nu doar înainte de audit.
6. **Reproducibil și atribuibil.** Fiecare rezultat are populație, versiune, query/test, identitate de executor, timp și hash.
7. **Privacy-preserving assurance.** Controlul inspectează minimum necesar și nu creează un nou depozit de date sensibile.
8. **Automatizare cu responsabilitate umană.** Agenții AI colectează, testează și prioritizează; oamenii responsabili aprobă deciziile cu impact mare.

## 2. Poziționare și independență

```text
Board / Risk & Audit Committee
   │
   ├── Internal Audit / independent external assurance (third line)
   │
   └── Chief Assurance & Integrity Officer — NAI (second line)
         ├── Quality Assurance
         ├── Security Assurance
         ├── Privacy Assurance
         ├── Regulatory Compliance Assurance
         ├── Trust & Safety Assurance
         ├── FinOps Assurance
         ├── Reliability/SRE Assurance
         ├── Model & Agent Risk
         └── Child Safety Office

CEO / Product / CTO / Operations (first line)
   ├── build and operate controls
   ├── own risks and remediation
   └── provide source populations and access
```

Chief Assurance & Integrity Officer (CAIO) raportează funcțional Risk & Audit Committee și administrativ CEO-ului, nu CTO-ului sau Chief Product Officer. Comitetul aprobă bugetul NAI, numirea/îndepărtarea CAIO, charter-ul și orice override al unui `NO-GO` critic.

### 2.1 Drepturi de decizie

| Decizie | Prima linie | NAI | DPO/Legal/Finance | Risk & Audit Committee |
|---|---|---|---|---|
| proiectare feature | A/R | C | C după risc | I |
| proiectare control | R | A | C | I |
| operare control preventiv | R | monitor/test | C | I |
| test independent | furnizează populația | A/R | poate observa | I |
| acceptare risc Low/Medium | propune | aprobă conform delegării | C | I |
| acceptare High | propune și finanțează remedierea | recomandă | co-aprobă | A dacă depășește delegarea |
| acceptare Critical | nu poate aproba | `NO-GO` | `NO-GO` în aria sa | singurul posibil override, motivat și temporar |
| oprire de urgență | On-call R | poate iniția prin runbook | C/I | notificat |
| închidere finding | implementează | validează independent | co-semnează dacă relevant | primește escaladări |
| audit NAI | C | furnizează dovezi | C | Internal Audit A/R |

`A` = accountable, `R` = responsible, `C` = consulted, `I` = informed.

### 2.2 Conflicte interzise

- NAI nu deține backlog-ul de produs, SLO-ul de business, bugetul cloud sau target-ul de venit pe care îl testează.
- Un tester nu verifică un control pe care l-a implementat în ultimele 12 luni fără reviewer independent.
- Un agent AI nu execută și aprobă același control; instanțele separate ale aceluiași model nu sunt independență suficientă.
- Product/Engineering nu poate edita sau șterge rezultatele NAI; poate atașa răspuns și dovezi de remediere.
- Trust & Safety Operations decide cazuri individuale; T&S Assurance testează calitatea, bias-ul, SLA-ul și apelurile.
- SRE Operations gestionează incidentul; SRE Assurance verifică readiness, SLO, postmortem și remedierea.
- DPO-ul își păstrează independența legală; Privacy Assurance execută testarea și raportează atât CAIO, cât și DPO.
- Treasury/Finance operează plățile; FinOps Assurance verifică reconcilierea, costul și segregarea cheilor.
- Internal Audit nu proiectează și nu operează controalele NAI pe care le auditează.

## 3. Organizarea funcției

### 3.1 Conducere și council-uri

- **CAIO:** charter, independență, portofoliu de risc, stage gates, raport către board.
- **Assurance Control Office:** catalog, metodologie, evidence platform, issues/CAPA, training.
- **Domain Assurance Leads:** Quality, Security, Privacy, Compliance, T&S, FinOps, SRE, Model Risk, Child Safety.
- **Product Surface Leads:** Watch, Live și Kids; coordonează controalele cross-domain fără a înlocui lead-urile.
- **Assurance Engineering:** control-as-code, conectori, evidence ledger, policy engine și agenții AI.
- **Assurance Analytics:** populații, sampling, scorecards, trenduri și loss/near-miss analysis.

Council-uri:

| Council | Cadență | Scop |
|---|---|---|
| Release Assurance Board | de două ori/săptămână și la release critic | GO/CONDITIONAL/NO-GO |
| Safety & Child Risk Council | săptămânal; imediat la P0/P1 | safety metrics, cazuri sistemice, Kids/Live |
| Security & Reliability Council | săptămânal | vulns, incidents, SLO, capacity, chain dependencies |
| Privacy & Regulatory Council | bilunar | DPIA, DSR, transfers, regulatory change, launches |
| Model & Agent Risk Committee | bilunar și la model major | model approval, drift, red team, agent permissions |
| Cost & Resilience Council | lunar | unit economics, provider concentration, reserves |
| Risk & Audit Committee | trimestrial și extraordinar | appetite, overrides, chronic findings, assurance plan |

### 3.2 Dimensiune de operare

Agenții AI și control-as-code pot automatiza colectarea și testele repetitive, dar independența cere responsabili identificabili. O structură inițială credibilă are CAIO, Control Office/Assurance Engineering și câte un owner pentru domeniile critice; un singur specialist poate acoperi temporar două domenii nonconflictuale, dar Child Safety, Security, Privacy/DPO și Finance approvals nu se combină cu operațiunile pe care le controlează. La scară, capacitatea se stabilește după volum, jurisdicții, Live hours, populația Kids și severitatea incidentelor, nu doar după numărul de developeri.

## 4. Modelul controlului

### 4.1 Obiectul standard `ControlDefinition`

```yaml
control_id: SEC-IAM-003
version: 2.1
title: "Revizuirea accesului privilegiat"
objective: "Niciun acces privilegiat fără nevoie curentă și aprobare"
risk_ids: [R-SEC-04, R-PRI-07]
scope: [prod, admin, data, watch, live, kids]
criticality: T0
type: preventive|detective|corrective
mode: automated|hybrid|manual
first_line_owner: VP-Platform
control_operator: IAM-Service
independent_tester: Security-Assurance
approver: Security-Assurance-Lead
frequency: continuous+monthly-certification
population_query: "iam.snapshot.prod.v3"
test_procedure: "policy/sec/iam/privileged_access.rego"
sample_method: full_population
pass_threshold: 1.0
evidence_spec: [signed_snapshot, policy_result, approvals, exceptions]
failure_severity: Critical
remediation_sla: PT24H
stage_gates: [G3, G4, G5]
linked_requirements: [NEXUS-SEC-IAM-01]
```

Fiecare versiune schimbată are diff, motiv, autor, reviewer, dată efectivă și plan de tranziție. Un control fără owner, procedură, populație sau dovadă este `NOT DESIGNED`, nu `PASS`.

### 4.2 Tier-uri

| Tier | Exemple | Toleranță |
|---|---|---|
| **T0 — safety/financial critical** | child contact, wallet intent, escrow, authz, E2EE keys, Live kill switch | zero control failures deschise la launch; fail-closed |
| **T1 — high** | privacy boundaries, moderation appeals, backups, recommender safety | doar excepție scurtă, compensating control și owner executiv |
| **T2 — material** | quality, accessibility, cost, search freshness | conditional GO în limite măsurate |
| **T3 — operational** | reporting hygiene, optimizări noncritice | remediation în backlog controlat |

### 4.3 Stări

`DRAFT → DESIGNED → IMPLEMENTED → OPERATING → TESTED_PASS/TESTED_FAIL → REMEDIATING → RETESTED → RETIRED`.

`NOT_APPLICABLE` cere motiv, scope și aprobare NAI; nu poate fi selectat de owner-ul primei linii. `NOT_TESTED` și `NO_EVIDENCE` sunt eșecuri pentru T0/T1.

## 5. Platforma de evidence și control continuu

```text
Source systems
  Git/CI/CD · cloud/IAM/KMS · DB/schema · observability · ticketing
  moderation · DSR · model registry · wallet/chain indexers · finance · vendors
       │ read-only collectors / signed webhooks / scheduled snapshots
       ▼
Assurance Control Plane
  Control Registry → Scheduler → Policy/Test Runners → Findings → CAPA
       │                 │                 │
       │                 ├── deterministic tests / queries / simulations
       │                 └── bounded AI agents for triage and narrative
       ▼
Evidence Ledger
  immutable metadata · encrypted artifacts · hashes · lineage · retention
       │
       ├── scorecards / stage gates / alerts
       ├── auditor read room (time-bound, redacted)
       └── board risk dashboard
```

### 5.1 Entități

```text
control_definitions(id, version, owner, tester, tier, frequency, procedure_ref)
control_runs(id, control_version, scope, population_ref, started_at, completed_at,
  executor_identity, code_hash, result, confidence, evidence_manifest_hash)
evidence_artifacts(id, run_id, type, uri, content_hash, source_signature,
  classification, collected_at, retention_until, redaction_state)
observations(id, run_id, severity, condition, criteria, cause_hint, impact_scope)
findings(id, observation_id, owner, severity, state, due_at, recurrence_key)
remediation_actions(id, finding_id, action, owner, milestone, evidence_ref, state)
exceptions(id, control_id, scope, reason, compensating_controls,
  approvers, starts_at, expires_at, residual_risk)
signoffs(id, object_type, object_id, decision, signer_identity, role,
  signed_at, signature, comments)
```

### 5.2 Standard de dovadă

O dovadă acceptabilă este:

- **autentică:** vine din sursa declarată, cu service identity și semnătură/hash;
- **completă:** include populația sau justificarea eșantionului, nu doar cazurile reușite;
- **reproductibilă:** query-ul/testul și versiunile sunt păstrate;
- **temporală:** arată perioada controlată și momentul colectării;
- **atribuibilă:** separă executorul, reviewer-ul și aprobatorul;
- **minimizată:** redactează PII, plaintext E2EE, secrets și conținut traumatic;
- **tamper-evident:** manifest hash-chain/WORM; ancorarea periodică a hash-ului pe chain este opțională, fără artefacte sau PII;
- **retained by policy:** retenția depinde de risc și obligație; expirarea produce purge verificat.

Evidence collector are acces read-only și nu poate modifica sistemul sursă. Capturile de ecran sunt doar evidence auxiliar. Un rezumat generat de AI nu este evidence primar.

## 6. Catalog minim de controale

Catalogul de mai jos este baseline-ul de lansare. Fiecare rând devine o definiție versionată în Control Registry.

### 6.1 Quality Assurance — `QUA`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| QUA-01 | cerință → design → cod → test → release traceability | per PR/release; signed trace graph | 100% T0/T1 |
| QUA-02 | unit/integration/contract/e2e pe fluxuri critice | per commit; CI artifacts și coverage by risk | toate scenariile critice pass |
| QUA-03 | negative authorization și profile-isolation tests | per build/nightly | zero leakage |
| QUA-04 | mobile device/OS/network compatibility | nightly + release; device farm | matrice suportată pass |
| QUA-05 | accessibility WCAG mapping, screen reader, captions | per release + trimestrial manual | zero blocker |
| QUA-06 | localization, date/currency/RTL și legal copy version | per locale release | 100% checkout/safety copy |
| QUA-07 | schema/API backward compatibility | per PR; schema diff/consumer contracts | zero breaking neversionat |
| QUA-08 | migration rehearsal și rollback | per DB migration T0/T1 | restore/rollback demonstrat |
| QUA-09 | flaky-test quarantine control | zilnic; flake history | <1% critical suite; fără ignore silențios |
| QUA-10 | defect escape și recurrence review | săptămânal/lunar | trend în appetite; CAPA pentru recurențe |

### 6.2 Security Assurance — `SEC`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| SEC-01 | threat model și abuse cases pentru schimbări | design/per major change | 100% T0/T1 înainte de build |
| SEC-02 | SAST/SCA/secrets/IaC/container scan | fiecare build + daily DB refresh | zero Critical/High neacceptat |
| SEC-03 | SBOM, provenance și artifact signing | build/release | 100% prod artifacts |
| SEC-04 | IAM least privilege, JIT și privileged review | continuu + lunar | zero orphan/excess privilege |
| SEC-05 | KMS/HSM, rotation, secret age și separation | continuu + trimestrial ceremony | 100% keys in policy |
| SEC-06 | auth wallet anti-replay/domain/chain/intent tests | fiecare release | zero exploitable deviation |
| SEC-07 | vulnerability SLA și internet attack-surface scan | continuu | Critical containment 24h |
| SEC-08 | DAST/API/business-logic adversarial suite | nightly/release | T0 suite pass |
| SEC-09 | independent pentest și retest | pre-public, anual, major change | Critical/High closed |
| SEC-10 | smart-contract invariants/fuzz/audit/caps/pause | build + pre-mainnet | zero unresolved Critical/High |
| SEC-11 | E2EE protocol/key transparency/device-change assurance | release + quarterly | no plaintext/key substitution gap |
| SEC-12 | security logging/EDR/SIEM detection validation | weekly purple test | detection/response within SLA |

### 6.3 Privacy Assurance — `PRI`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| PRI-01 | data inventory/ROPA/schema-event diff | per schema/event change + lunar | 100% new fields mapped |
| PRI-02 | DPIA/legitimate-interest/consent gate | design și annual review | required assessment approved |
| PRI-03 | data minimisation și purpose/feature allowlist | per feature/model | zero undeclared sensitive feature |
| PRI-04 | Work/Social/Dating/Kids boundary tests | build/nightly | zero cross-boundary leakage |
| PRI-05 | consent/withdrawal/cookie SDK behavior | release + monthly crawl | choice honored end-to-end |
| PRI-06 | DSR access/export/delete/rectify workflow | weekly synthetic + monthly sample | deadline and completeness target |
| PRI-07 | retention purge și backup tombstone restore test | daily jobs + quarterly restore | 100% due objects purged |
| PRI-08 | IPFS/on-chain private-data denylist | prepublish/transaction build | zero prohibited fields/assets |
| PRI-09 | international transfer/vendor region drift | monthly + vendor change | approved routes only |
| PRI-10 | telemetry/log/crash/push privacy scan | each build + continuous DLP | zero secrets/plaintext/special data |

### 6.4 Regulatory Compliance Assurance — `CMP`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| CMP-01 | obligations register și regulatory-change intake | lunar + event-driven | owner/impact/deadline for each change |
| CMP-02 | terms/policies/copy versioning și acceptance evidence | release | approved version per territory |
| CMP-03 | DSA notice/action/statement/appeal completeness | weekly sample + monthly metrics | 100% mandatory fields; SLA target |
| CMP-04 | recommender/ad/boost transparency | release + monthly synthetic | labels/explanations available |
| CMP-05 | trader traceability și GPSR Safety Gate workflow | onboarding/listing + drill | no trader/product publish without minimum data |
| CMP-06 | consumer checkout, trader status, fee/cancel/refund copy | each checkout release | all supported scenarios pass |
| CMP-07 | DAC7 seller due diligence/ledger/reconciliation | monthly + annual dry-run | 100% reportable population reconciled |
| CMP-08 | MiCA/PSD/AML/CASP funds-flow scope control | new token/provider/flow | no launch without classification and owner |
| CMP-09 | AI system inventory/role/applicability/calendar | model/agent change + quarterly | 100% systems registered |
| CMP-10 | NIS2/entity/incident notification readiness | quarterly drill + country change | current matrix/runbook |
| CMP-11 | licenses/geo allowlist for Travel/commerce/media rights | per market launch + monthly | only approved territories/categories |

### 6.5 Trust & Safety Assurance — `TNS`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| TNS-01 | policy taxonomy, decision codes și policy-version binding | policy release | every action attributable |
| TNS-02 | moderation decision QA stratified by harm/language | weekly | precision/recall/agreement in appetite |
| TNS-03 | high-severity queue coverage și escalation | continuous | no uncovered shift/territory in scope |
| TNS-04 | report accessibility, receipt, triage și appeal | daily synthetic + weekly sample | end-to-end SLA pass |
| TNS-05 | user-wide block și ban-evasion prevention | nightly/adversarial | zero deterministic bypass |
| TNS-06 | scam/fraud/impersonation and coordinated-abuse detection | continuous + weekly review | detection and false-positive thresholds |
| TNS-07 | E2EE voluntary report bundle minimisation/integrity | release + quarterly | only user-selected evidence |
| TNS-08 | moderator access, wellness și traumatic-content handling | continuous + monthly | JIT access; exposure controls |
| TNS-09 | emergency/law-enforcement request process | quarterly drill | validated identity, legal basis, audit trail |
| TNS-10 | transparency metrics/data quality | monthly/required cadence | reconciled with case source |
| TNS-11 | adversarial abuse red team | monthly Live; quarterly platform | Critical pathways contained |

### 6.6 FinOps Assurance — `FIN`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| FIN-01 | budget/forecast/tagging și owner allocation | daily/monthly | unallocated spend < target |
| FIN-02 | spend anomaly și runaway workload kill limits | near-real-time | detection/containment within SLA |
| FIN-03 | unit cost: video-minute, stream-hour, MAU, message, model call | daily/weekly | within approved envelope |
| FIN-04 | CDN/egress/storage lifecycle and cache efficiency | daily | no material regression unexplained |
| FIN-05 | AI/token/provider usage quotas și rate plan validation | continuous/monthly | hard caps for noncritical workloads |
| FIN-06 | on-chain fee sponsorship caps and abuse | per transaction/daily | no cap bypass; reconcile 100% |
| FIN-07 | revenue/fee/escrow/indexer↔chain reconciliation | continuous/daily close | zero unexplained material variance |
| FIN-08 | invoice/contract/rate-card reconciliation | monthly | approved usage and price only |
| FIN-09 | reserve/refund/dispute/chargeback adequacy | weekly/monthly | within policy |
| FIN-10 | provider concentration and exit cost | quarterly | exit plan for critical provider |

### 6.7 Reliability/SRE Assurance — `SRE`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| SRE-01 | SLI/SLO/error-budget correctness and ownership | continuous/monthly review | all critical journeys measured |
| SRE-02 | alert coverage, actionable paging și dead-man tests | weekly | paging path passes |
| SRE-03 | backup success plus restore correctness | daily backup, quarterly restore | RPO/RTO achieved |
| SRE-04 | capacity/load/soak and overload behavior | release + monthly | graceful degradation, no unsafe bypass |
| SRE-05 | canary, feature flag, rollback and config history | each deploy | rollback within objective |
| SRE-06 | dependency/provider/indexer failure injection | monthly/quarterly | fallback/runbook works |
| SRE-07 | queue/data consistency/idempotency/reconciliation | continuous | lag/variance in limits |
| SRE-08 | DR and regional/provider failover | twice/year + major change | RTO/RPO pass |
| SRE-09 | runbook freshness/on-call access/incident tooling | monthly | 100% T0 services current |
| SRE-10 | postmortem and corrective-action effectiveness | every P0/P1 + monthly | no overdue Critical action |

### 6.8 Model & Agent Risk — `MRM`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| MRM-01 | inventory, owner, intended use, tier și prohibited uses | registration/quarterly | 100% prod models/agents |
| MRM-02 | training/eval data provenance, rights, privacy și leakage | model version | approved datasets only |
| MRM-03 | offline quality/safety/fairness/calibration benchmark | model version | minimum by segment/language |
| MRM-04 | adversarial/red-team/prompt-injection/tool-abuse tests | release + monthly for agents | no Critical path open |
| MRM-05 | shadow/canary/A-B guardrails și rollback | deployment | stop conditions active |
| MRM-06 | drift, segment performance și harm monitoring | continuous/daily | alerts within threshold |
| MRM-07 | reason codes/explanations/model card/change log | version | complete before launch |
| MRM-08 | human oversight and appeal for high-impact decisions | continuous sample | no prohibited autonomous decision |
| MRM-09 | agent identity, tool allowlist, budget și egress policy | every invocation/weekly review | zero unapproved capability |
| MRM-10 | hallucination/evidence-grounding and citation validation | each assurance report + sample | evidence-backed conclusions only |
| MRM-11 | third-party model/vendor version and retention drift | continuous/monthly | approved versions/terms only |

### 6.9 Child Safety — `CHS`

| ID | Control | Frecvență / evidence | Prag |
|---|---|---|---|
| CHS-01 | age-assurance strategy, proportionality și bypass test | release + quarterly red team | no known trivial bypass |
| CHS-02 | Kids privacy/safety defaults and immutable deny rules | build/nightly | 100% restrictive defaults |
| CHS-03 | adult↔minor contact and unknown-contact restrictions | continuous/nightly | zero unauthorized contact |
| CHS-04 | location/profile/search discoverability minimisation | release/adversarial | no exact location or external enumeration |
| CHS-05 | recommender harmful-content, rabbit-hole și age suitability | model version + daily monitoring | thresholds by harm category |
| CHS-06 | autoplay, streak, notification and night-time guardrails | release/monthly synthetic | Kids policy always applied |
| CHS-07 | ads, profiling, purchase/gifting and commercial pressure controls | release/continuous | prohibited paths impossible |
| CHS-08 | grooming/sextortion/bullying/self-harm escalation | continuous + weekly QA | priority SLA and specialist review |
| CHS-09 | child-friendly reporting/blocking/help and appeal | daily synthetic + user research | completion and comprehension target |
| CHS-10 | parental/guardian controls without unsafe surveillance | release + privacy review | age-appropriate and transparent |
| CHS-11 | staff/vendor child-safety access and vetting | before access + quarterly | approved JIT roles only |
| CHS-12 | crisis, evidence preservation and authority escalation drill | quarterly | end-to-end pass |

## 7. Controale specifice pe suprafețe

Controalele următoare sunt overlays. Ele nu înlocuiesc catalogul de domeniu.

### 7.1 Nexus Watch — video la cerere și recomandări

| ID | Control | Owner de control / prag |
|---|---|---|
| WAT-01 | asset public numai după media scan, rights și moderation state | Content Ops; zero bypass |
| WAT-02 | HLS variants, captions, audio și thumbnail correctness | Media; ≥99.9% ready assets complete |
| WAT-03 | candidate eligibility și final privacy/block/age filter | Feed; zero restricted impression |
| WAT-04 | Following cronologic și opțiune neprofilată disponibile | Feed; synthetic daily pass |
| WAT-05 | „de ce văd asta”, reset și negative feedback aplicate | Feed; propagation within SLA |
| WAT-06 | diversity/fatigue/rabbit-hole and repeat-content limits | Model Risk; segment thresholds |
| WAT-07 | ad/boost/commercial/synthetic content labels | Compliance; 100% paid impressions |
| WAT-08 | watch-time event quality, bot filtering și model-feature allowlist | Analytics; no prohibited feature |
| WAT-09 | CDN token/privacy and deleted-content purge | Privacy/SRE; purge within policy |
| WAT-10 | rights expiry/territory enforcement | Compliance; zero known out-of-rights delivery |

### 7.2 Nexus Live — streaming în timp real

Live are risc temporal mai mare; controlul post-factum nu este suficient.

| ID | Control | Owner de control / prag |
|---|---|---|
| LIV-01 | stream key/session binding, reauth și account-risk gate | Security; no replay/hijack |
| LIV-02 | pre-live eligibility, strikes, age, category și territory | T&S; 100% sessions gated |
| LIV-03 | configurable safety delay și moderator coverage by risk | Live Ops; high-risk requires coverage |
| LIV-04 | kill switch tested end-to-end, independent de generative AI | SRE/T&S; weekly, target ≤15s propagation |
| LIV-05 | real-time report, priority queue și evidence clip buffer | T&S; urgent ack target ≤5 min |
| LIV-06 | chat slow mode, follower-only, block, mute și raid defense | T&S/SRE; attack simulation pass |
| LIV-07 | gifts/tips caps, minor prohibition, fraud/refund controls | Finance/Child Safety; zero policy bypass |
| LIV-08 | ingest/transcode/CDN capacity and graceful degradation | SRE; load/chaos SLO pass |
| LIV-09 | stream recording/retention/clip access by policy | Privacy; no undeclared recording |
| LIV-10 | copyright/rights/territory takedown path | Compliance; tested each quarter |
| LIV-11 | dangerous challenge/self-harm/violence emergency playbook | Child/T&S; specialist escalation |
| LIV-12 | post-live review for severe events and recurrence graph | T&S; all P0/P1 reviewed |

### 7.3 Nexus Kids — produs separat, nu simplu „toggle”

Kids folosește namespace, policies, feature flags, analytics, model și release gate separate. Nu moștenește automat un feature Core/Watch/Live.

| ID | Control | Owner de control / prag |
|---|---|---|
| KID-01 | `kids_approved=true` explicit pentru fiecare feature/config/model | Child Safety; default false |
| KID-02 | cont privat, search off, precise location off, contact restrictiv | Privacy/Child; immutable deny |
| KID-03 | niciun Dating/Marketplace generalist/Travel host/contact adult | Architecture policy; impossible route |
| KID-04 | content age-rating și allowlist/denylist by locale | T&S; zero unrated publish to Kids |
| KID-05 | recommender separat, fără sensitive profiling/commercial objective | Model Risk; feature allowlist strict |
| KID-06 | ads profilate off; boost și influencer commercial labels/control | Compliance; 100% synthetic pass |
| KID-07 | gifting/payments/purchases off implicit; guardian flow dacă aprobat | Finance/Child; no direct minor payment |
| KID-08 | quiet hours, autoplay/session limits și break nudges | Child Safety; config locked |
| KID-09 | Live by minors off la launch; activation only after separate gate | CAIO/Risk Committee; default disabled |
| KID-10 | push generic, preview off, unknown links/media restricted | Privacy/Security; zero leakage |
| KID-11 | child-friendly terms/report/help tested for comprehension | Child Safety; research threshold |
| KID-12 | age transition/migration: child→adult without silent exposure | Privacy/Product; explicit review |

## 8. Agenți AI în Assurance

### 8.1 Roluri permise

| Agent | Funcție | Permisiuni maxime |
|---|---|---|
| Evidence Collector | colectează snapshot-uri și manifest | read-only la surse aprobate; write în evidence ingress |
| Control Runner | execută policy/test determinist | sandbox; fără prod write |
| Finding Triage | grupează/priority/duplicate suggestions | metadata redacted; nu închide finding |
| Regulatory Watch | monitorizează surse oficiale și propune impact | web allowlist; draft only |
| Model Monitor | detectează drift/harm/cost anomalies | metrics/features pseudonime |
| Incident Copilot | timeline, query suggestions, draft comms | read-only; fără containment autonom |
| Safety Queue Assist | priority/translation/redaction | content access strict; human decision la high impact |
| Audit Packager | construiește index și lineage | read-only evidence; redaction policy |
| CAPA Verifier | rerulează testul și compară evidence | nu aprobă închiderea |

### 8.2 Acțiuni interzise agenților generativi

- aprobarea propriei definiții, propriului test sau propriului rezultat;
- `GO` pentru Kids, Live, money movement, smart contracts, auth, E2EE ori regulatory classification;
- închiderea unui finding Critical/High sau acceptarea riscului;
- acces la seed/private keys, chei E2EE, producție DB unrestricted sau plaintext chat;
- ștergerea/păstrarea datelor, raportarea către autorități sau comunicarea publică fără aprobator;
- sancțiuni ireversibile asupra utilizatorului ori eliberarea escrow;
- modificarea policy/model/tool allowlist în timpul aceleiași execuții;
- folosirea conținutului Nexus pentru antrenarea unui provider extern fără aprobare și contract;
- tratarea output-ului altui agent ca dovadă primară fără verificarea sursei.

### 8.3 Identitate și izolare

Fiecare agent are workload identity, owner, model/version, prompt hash, tool allowlist, data classification ceiling, budget, timeout și egress allowlist. Credentialele sunt short-lived; acțiunile sunt semnate și logate. Instanțele de collector, tester și reviewer folosesc identități și policies diferite. Pentru controale T0, aprobarea este făcută de o persoană autorizată care inspectează evidence-ul primar și rezultatul determinist, nu doar rezumatul AI.

### 8.4 Protecție contra prompt injection și tool abuse

- conținutul inspectat este `untrusted data`, niciodată instrucțiune;
- system policy și tool schema sunt immutable la runtime;
- browser/connector egress este allowlist și read-only unde e posibil;
- output parsing tipizat, length/time/cost limits și deny-by-default;
- secrets/PII DLP înainte de model și la output;
- acțiunile cu efect sunt separate în plan → policy validation → explicit approval → deterministic executor;
- canary documents și adversarial corpus detectează exfiltrarea/instruction following;
- kill switch per agent/model/provider și fallback manual/determinist.

### 8.5 Evaluarea agenților

Scorecard per agent:

- precision/recall și, mai ales, false-negative rate pe severitate;
- grounded claim rate și invalid citation/evidence rate;
- override rate, escalations ratate și time-to-triage;
- tool-policy violations și near misses;
- segment/language performance;
- cost per control run și latency;
- data leakage/DLP alerts;
- model/provider/version drift;
- stability la replay pe același evidence set.

O degradare peste prag pune agentul în `SHADOW` sau `DISABLED`; controlul revine la procedura deterministă/manuală. Niciun control nu depinde de un agent fără fallback testat.

## 9. Sampling și testare

### 9.1 Reguli

1. **100% populație** pentru controale automate T0: money movement, privileged access, Kids contact, privacy boundary, release signatures, on-chain/IPFS denylist.
2. **Stratified risk sampling** pentru cazuri umane: severitate, limbă, țară, profil, vârstă, decizie, moderator/model și appeal outcome.
3. **Random baseline** obligatoriu lângă risk-based sampling; altfel nu se poate estima rata reală de eroare.
4. **Oversampling** pentru rare/high-harm și grupuri insuficient reprezentate; rezultatele ponderate corect la raportarea ratei globale.
5. **Adversarial/synthetic** pentru rute negative greu observabile: block bypass, profile linkage, Kids contact, wallet replay, Live raid, refund fraud.
6. **Event-driven resampling** după model/policy/vendor/schema/locale change, incident sau creșterea plângerilor.

### 9.2 Plan minim

| Populație | Sampling | Frecvență |
|---|---|---|
| release T0 controls | 100% | fiecare candidate build |
| privileged identities | 100% | continuu + certificare lunară |
| wallet/escrow events | 100% reconciliere | near-real-time și daily close |
| DSR | 100% SLA; sample conținut min. 25/lună sau toate dacă mai puține | lunar |
| moderation standard | random + stratified; mărime bazată pe volum și confidence | săptămânal |
| severe safety/Kids | 100% P0/P1 + random negatives | zilnic/săptămânal |
| appeals overturned | 100% root-cause | săptămânal |
| model impressions | telemetry 100%; labeled sample pe segment | continuu/săptămânal |
| Live sessions | 100% gates; risk sample recordings/metadata conform policy | per session/săptămânal |
| vendors critical | 100% control attestations + substantive sample | trimestrial/anual |

Mărimea eșantionului este înregistrată cu populație, confidence/margin sau justificare risk-based. „Am verificat 10 cazuri” fără populație și criteriu nu este test valid.

## 10. SLA-uri și severitate

### 10.1 Findings

| Severitate | Criteriu orientativ | Containment | Plan CAPA | Remediere implicită |
|---|---|---:|---:|---:|
| Critical | risc imediat pentru copii/fonduri/chei, exploatare activă, breach major, control T0 absent | imediat, target ≤1h | ≤24h | ≤72h sau suprafața rămâne oprită |
| High | impact material probabil, control T1 eșuat, bypass reproductibil | ≤24h | ≤3 zile | ≤14 zile |
| Medium | impact limitat/compensat | ≤5 zile | ≤10 zile | ≤30 zile |
| Low | igienă/îmbunătățire fără risc material curent | după caz | ≤30 zile | ≤90 zile |

Termenele pot fi scurtate de policy sau obligații. Extensia cere evidence, compensating control, residual risk, owner și expiry. Un finding expirat se escaladează automat; nu se „re-datează”.

### 10.2 Incidente interne

| Nivel | Acknowledge | Incident commander | Safety containment/kill | Executive/NAI informare |
|---|---:|---:|---:|---:|
| P0 | ≤5 min | ≤5 min | imediat; Live target ≤15 sec tehnic | ≤15 min |
| P1 | ≤10 min | ≤15 min | ≤30 min | ≤30 min |
| P2 | ≤30 min | ≤1h | ≤4h | daily summary |
| P3 | business hours | după caz | backlog controlat | weekly |

Acestea sunt obiective interne, nu înlocuiesc termenele legale de notificare. Privacy/Legal/Compliance pornesc separat „notification clocks” și documentează decizia de notificare.

## 11. Scorecards și risk appetite

### 11.1 Nu se folosește o medie simplă

Un singur eșec T0 produce `RED` indiferent de media celorlalte controale. Scorul orientativ al unui domeniu este:

```text
Domain score = 100
 - risk-weighted failed controls
 - overdue finding penalty
 - repeat finding penalty
 - incident/near-miss penalty
 - missing/late evidence penalty
 + sustained effectiveness credit (capped)
```

T0 = weight 20, T1 = 10, T2 = 4, T3 = 1; plafonul și calibrarea se aprobă anual. Score-ul nu ascunde numărul și vechimea finding-urilor.

### 11.2 Dashboard executiv

| Dimensiune | Metrici obligatorii |
|---|---|
| Coverage | controale due/executate, full-population %, evidence freshness |
| Effectiveness | pass rate ponderat, false assurance rate, repeat failures |
| Findings | open/overdue/age/severity, CAPA effectiveness |
| Incidents | P0/P1, MTTD/MTTA/MTTC/MTTR, recurrence, user impact |
| Safety | severe prevalence, report/appeal SLA, error by language, Live/Kids events |
| Privacy | DSR, purge, boundary failures, vendor/transfer drift |
| Security | critical exposure time, IAM drift, vuln SLA, attack simulation |
| Reliability | SLO/error budget, restore/DR, dependency failures |
| Models/agents | drift, harmful outcome, false negatives, overrides, tool violations |
| FinOps | spend/forecast, unit cost, anomaly loss avoided, reconciliation variance |

Status:

- **Green:** niciun T0/T1 failed/expired; scor ≥90; trend stabil.
- **Amber:** scor 75–89 sau finding High compensat și în SLA.
- **Red:** orice T0, High expirat, control evidence critic lipsă, scor <75 ori risk appetite depășit.
- **Black/Stop:** exploatare activă, child-safety systemic failure, loss of key/funds integrity sau incapacitate de containment.

Scorecard-urile Watch, Live și Kids sunt separate. Verde pe Nexus Core nu compensează roșu pe Kids; Kids folosește pragul cel mai strict.

## 12. Stage gates

| Gate | Moment | Evidence minim | Decizie |
|---|---|---|---|
| G0 — Intake | idee/market/feature | owner, scope, users/age/territory, preliminary risk | accept/reframe/reject |
| G1 — Risk classify | înainte de design | data/financial/safety/model/vendor classification | tier și control plan |
| G2 — Design | înainte de build | architecture, threat/abuse model, DPIA trigger, funds flow, SLO | design approved/changes |
| G3 — Build complete | code complete | traceability, CI/security/privacy tests, model card, runbooks draft | enter staging |
| G4 — Pre-production | release candidate | e2e/adversarial/load/rollback, moderation/incident readiness, legal copy | conditional/no-go/go |
| G5 — Launch | change window | signed artifacts, flags/caps/canary, owners/on-call, fresh T0 evidence | production authorization |
| G6 — Hypercare | 24h/7d/30d | telemetry, complaints, costs, safety/model/SLO deltas | expand/hold/rollback |
| G7 — Material change | model/policy/vendor/market/data/contract change | delta assessment și controls rerun | re-approval |
| G8 — Retirement | feature/vendor/model off | export/migration, retention/purge, revoked access/keys, comms | closure |

### 12.1 Hard blockers

`NO-GO` automat dacă:

- orice control T0 relevant nu este `TESTED_PASS` cu evidence proaspăt;
- există finding Critical/High exploatabil sau remediere neverificată;
- nu există rollback/kill switch funcțional pentru Live/model/agent;
- Kids primește un feature/model neaprobat explicit;
- un flux de bani/token nu are owner, funds-flow, caps și reconciliere;
- un câmp sensibil nou nu are purpose/retention/access mapping;
- nu există on-call, runbook și observability pentru critical journey;
- artefactul, config-ul sau modelul nu este identificabil și rollback-able;
- legal/DPO/Child Safety a emis hold în aria sa.

`CONDITIONAL GO` este permis numai pentru T2/T3 sau un T1 fără expunere imediată, cu compensating control, cap/flag, segment limitat, owner, dată de expirare și metrici de oprire.

## 13. Excepții, risk acceptance și CAPA

O excepție conține: control și scope exact, cauza, impact/populație, probabilitate, compensating control verificat, owner, milestones, start/expiry, rollback și aprobări. Excepțiile Critical nu sunt evergreen; override-ul board este limitat în timp și publicat intern în risk register.

Flux finding:

```text
detect → validate independently → severity → contain
 → root cause → corrective + preventive actions
 → owner evidence → independent retest
 → effectiveness observation window → close or reopen
```

Pentru recurență, severitatea crește cu un nivel dacă același root cause revine după „closure”. Închiderea administrativă fără retest este interzisă. CAPA separă corecția imediată de schimbarea sistemică: policy, design, test, training, capacity sau vendor.

## 14. Incidente și crize

### 14.1 Taxonomie comună

`SECURITY`, `PRIVACY`, `CHILD_SAFETY`, `TRUST_SAFETY`, `FINANCIAL`, `SMART_CONTRACT`, `RELIABILITY`, `MODEL_AGENT`, `LEGAL_COMPLIANCE`, `VENDOR`, cu incidente multi-label.

Un P0 are un singur Incident Commander, dar workstreams separate. NAI are un Assurance Liaison care păstrează independența, verifică timeline/evidence și poate cere containment suplimentar; nu preia operarea tehnică.

### 14.2 Runbook

1. detect/declare și freeze automat al evidence-ului relevant;
2. atribuire IC, Safety/Privacy/Security/Finance leads după taxonomie;
3. containment proporțional: feature flag, Live kill, spending cap, relayer pause, model rollback, account protection;
4. păstrare logs/evidence cu minimizare și chain of custody;
5. impact assessment: cine, ce profil/suprafață, țară, vârstă, fonduri/date, durată;
6. notification clocks și legal decision log;
7. comunicare internă și utilizator/public aprobată, factuală și versionată;
8. recovery cu validare NAI a controalelor înainte de reactivare;
9. postmortem blameless operațional, dar cu accountability pentru CAPA;
10. effectiveness review la 30/60/90 zile.

### 14.3 Cerințe speciale

- **Live:** kill path out-of-band, moderator și SRE pot iniția; test săptămânal; generative AI nu este în critical path.
- **Kids:** specialist Child Safety paged imediat; distribuția informației este need-to-know; wellbeing support pentru reviewers.
- **Smart contracts/fonduri:** caps, pause/timelock conform contractului, reconciliere și forensic snapshot înainte de reluare.
- **Model/agent:** păstrarea prompt/model/tool/version/inputs redacted/output/action trace; disable provider/model independent.
- **E2EE:** investigația nu presupune acces la plaintext; se folosesc report bundles voluntare, metadata permisă și evidence furnizat legal.

## 15. Cadența de assurance și audit

### 15.1 Operare

| Cadență | Activitate |
|---|---|
| continuu | T0 policy tests, IAM, DLP, spend, SLO, reconciliation, child/contact, model/agent monitors |
| per commit/build | CI quality/security/privacy/schema/SBOM și contract tests |
| per deploy/config/model | stage gate delta, canary, rollback, control rerun |
| zilnic | failed controls triage, P0/P1 findings, Live/Kids dashboard, finance close |
| săptămânal | moderation/safety sample, vuln/SLO review, release board, overdue CAPA |
| bilunar | Privacy/Regulatory și Model/Agent councils |
| lunar | access certification, control owner attestation, scorecards, cost/vendor drift |
| trimestrial | restore, crisis/child/notification drills, vendor assurance, risk committee |
| semestrial | DR/failover, major red-team, control rationalization și tabletop board |
| anual | enterprise risk/control assessment, pentest, external audits plan, policy refresh |
| event-driven | incident, new market/age group/token/vendor/model, material architecture/policy change |

### 15.2 Audituri independente

- Internal Audit auditează anual NAI governance, independence, evidence integrity și un eșantion de domenii, rotind scope-ul.
- Smart contracts care controlează valoare primesc audit extern înainte de mainnet și după schimbări materiale.
- E2EE/cryptography și mobile key lifecycle primesc review extern specializat.
- Pentest-ul extern acoperă API, mobile, cloud, business logic, auth wallet, profile boundaries și admin tools.
- Child Safety și moderation quality primesc assessment extern periodic, inclusiv limbi și procese de apel.
- Model/agent risk primește independent validation pentru rankere/high-impact models și agenți cu tool access.
- Financial/DAC7/payment reconciliations intră în auditul financiar/fiscal relevant.

Auditorul primește read room temporar, redacted și jurnalizat. NAI nu selectează singur eșantionul și nu poate suprima findings; management response este păstrat separat de observația auditorului.

## 16. Third-party și concentrarea furnizorilor

Pentru cloud, CDN/video, identity/age, moderation AI, push, Matrix/E2EE components, CASP/PSP, IPFS și model providers:

- due diligence înainte de contract: security/privacy/safety/financial/legal/BCP;
- data flow, rol, regiune, subprocesatori, retention/training, breach SLA și audit rights;
- inventory de versiuni și configuration drift;
- SLO și incident exercises pentru furnizori critici;
- continuous monitoring fără a confunda certificatele cu eficacitatea operațională;
- exit plan, export/deletion proof și credential/key revocation;
- alternative/fallback pentru Live kill, E2EE sync, chain indexer, payments și model agents;
- concentration threshold și board acceptance dacă nu există alternativă realistă.

## 17. Livrabile și registre

NAI menține minimum:

1. assurance charter și delegations of authority;
2. enterprise risk register și risk appetite;
3. control catalog și requirement-control-test map;
4. inventory de date, sisteme, modele, agenți, furnizori și piețe;
5. evidence ledger și auditor read room;
6. findings, exceptions, CAPA și recurrence register;
7. release/stage-gate decisions și overrides;
8. incident/near-miss și notification decision logs;
9. Watch/Live/Kids scorecards;
10. regulatory change și obligations register;
11. audit universe, annual plan, reports și management responses;
12. control coverage map pentru fiecare user journey critic.

## 18. Roadmap de implementare

### 0–30 zile — fundație

- aprobă charter, reporting line, risk appetite, T0/T1 și hard blockers;
- desemnează CAIO și domain owners; separă conturile/rolurile de Engineering;
- creează Control Registry, Finding/CAPA și evidence schema;
- inventariază critical journeys: auth/profile switch, Watch publish/feed, Live start/kill/report, Kids contact, wallet/payment/escrow, DSR;
- implementează primele controale T0 deterministe și dashboard de freshness.

### 31–90 zile — control continuu

- conectează CI/CD, IAM/KMS, observability, moderation, model registry, finance și chain indexer;
- lansează stage gates G0–G8 și Release Assurance Board;
- rulează profile-boundary, Kids deny, wallet replay, Live kill, backup restore și finance reconciliation;
- pune agenții Evidence Collector/Triage în shadow mode; măsoară false negatives și leakage;
- efectuează primul incident/child/notification tabletop și primul scorecard board.

### 91–180 zile — validare independentă

- extinde sampling pe limbi/țări și model/safety segments;
- activează agenți doar pentru rolurile care au trecut gate-ul MRM;
- rulează external pentest, cryptography review și smart-contract audit după scope;
- vendor exit/failover exercises, DR și assurance over Live/Kids;
- Internal Audit evaluează designul NAI și integritatea evidence-ului.

### 181–365 zile — maturitate

- control coverage complet pe normative requirements;
- automated regulatory diff cu aprobări umane;
- loss/near-miss-informed risk calibration și predictive indicators;
- external Child Safety/Model Risk assessment;
- reducerea controalelor duplicate, fără reducerea coverage T0/T1;
- public/internal transparency bazată pe date reconciliate și auditable.

## 19. Criterii de acceptare ale departamentului

NAI este considerat operațional numai dacă:

1. poate emite și menține un `NO-GO` fără aprobarea CTO/Product;
2. fiecare control T0 are owner prima linie, tester NAI, approver distinct, test, populație, evidence și fallback;
3. Engineering nu poate modifica evidence sau scorecards;
4. orice override este limitat, semnat, vizibil Risk & Audit Committee și expirat automat;
5. Watch, Live și Kids au scorecards și stage gates separate;
6. Live kill switch este independent de agenți generativi și testat săptămânal;
7. Kids este deny-by-default și niciun feature/model Core nu intră fără aprobare explicită;
8. agenții AI au identități/tool/data/budget boundaries și nu se auto-aprobă;
9. findings Critical/High nu se închid fără retest independent și observation window;
10. evidence-ul este reproducibil, minimizat, tamper-evident și auditable;
11. incidentele pot fi declarate, conținute, investigate și notificate prin runbook testat;
12. Internal Audit poate audita NAI fără ca NAI să aleagă sau să modifice eșantionul.

