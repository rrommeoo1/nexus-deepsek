# Rețea globală, wallet embedded și Agent Network

Acest document este normativ. El definește distribuția worldwide, onboarding-ul
prin Google/Facebook/TikTok/Apple cu wallet MultiversX creat automat și populația
de agenți software care testează, asistă și atrage legitim utilizatori și alți
agenți.

## 1. Decizii de produs

1. Nexus este o rețea globală, nu un produs românesc. România poate fi o piață de
   test operațional, dar arhitectura, localizarea și policy engine-ul sunt globale.
2. Login-ul principal este social/passkey cu wallet embedded creat automat.
3. Utilizatorii crypto pot conecta xPortal, WalletConnect, web wallet, extension,
   Ledger sau alt provider acceptat și pot alege wallet-ul principal.
4. Nexus nu păstrează o cheie privată completă ori seed phrase în backend.
5. Conturile AI sunt permise numai ca `Agent Profiles` etichetate și verificabile.
6. Nu folosim boți care pretind că sunt oameni, fabrică review-uri/like-uri, intră
   în Dating, trimit spam sau manipulează metricile organice.
7. Agent-to-agent este un produs real: discovery, tasks, plăți și reputație
   separate de activitatea umană.

## 2. Worldwide nu înseamnă toate funcțiile în toate țările

Nexus poate fi descărcat și poate oferi funcții sociale generale global, dar
verticalele reglementate se activează prin `Country Capability Matrix`.

```text
GLOBAL_CORE
  profile, feed, chat, creator content, Music cleared catalog, Grow W0/W1

COUNTRY_GATED
  marketplace checkout, stays, services, creator payouts, promotion, subscriptions

CITY/LICENCE_GATED
  Mobility, anumite experiențe, profesii reglementate și servicii locale

PROHIBITED/UNAVAILABLE
  sancțiuni, lipsă provider/licență, risc neacceptat sau obligații neimplementate
```

`CountryPolicy` este versionat și include:

```typescript
interface CountryPolicy {
  countryCode: string;
  legalEntity: string;
  ageFloor: number;
  availableFeatures: string[];
  blockedFeatures: string[];
  supportedTokens: string[];
  paymentProviders: string[];
  taxMode: string;
  consumerRulesVersion: string;
  dataRegion: string;
  moderationLanguageCoverage: string[];
  sanctionsMode: string;
  identityRequirements: Record<string, string>;
  effectiveFrom: string;
}
```

Reguli:

- feature gate-ul este verificat server-side și la pregătirea tranzacției;
- țara nu se decide numai din IP: residence, service location, business country,
  payment instrument și legal entity pot conta diferit;
- utilizatorul vede motivul indisponibilității și nu este împins să folosească VPN;
- contractele au allowlist de token/market/issuer unde este necesar;
- Terms, taxes, consumer rights, payouts, KYC și retention sunt localizate;
- data residency este folosită când o lege/contract o cere, fără promisiunea falsă
  că blockchain-ul public are rezidență regională;
- sancțiunile și export controls sunt verificate pentru plăți și servicii, nu pentru
  a colecta mai multe date decât este necesar.

## 3. Modelul de identitate

```text
Human
├── Nexus Account ID (intern, stabil)
├── Login Identities
│   ├── Google OIDC
│   ├── Apple
│   ├── Facebook Login
│   ├── TikTok Login Kit
│   ├── email/passkey recovery opțional
│   └── wallet providers conectați
├── Embedded MultiversX Wallet (default)
├── External/Hardware Wallets (opțional)
└── Context Profiles

Agent
├── Agent Profile + badge AI vizibil
├── controller wallet / organization
├── agent wallet sau delegated capability
├── signed Agent Card + skills
└── scopes, rate/gas/payment budgets și policy class
```

Identitatea socială autentifică persoana față de provider; nu dovedește automat
vârsta, numele juridic, reputația sau dreptul de a vinde/conduce/profesa. Acestea
au verificări separate.

## 4. Onboarding principal: social login → wallet automat

### UX

1. utilizatorul alege `Continuă cu Google`, `Apple`, `Facebook` sau `TikTok`;
2. aplicația folosește SDK/OIDC oficial și cere scope minim: identificator stabil,
   nume/alias și email numai dacă este necesar/disponibil;
3. backend-ul verifică tokenul la issuer, audience, nonce, expiry și PKCE;
4. `Account Orchestrator` caută o legătură existentă sau creează `NexusAccount`;
5. `Wallet Provisioner` creează/recuperează un wallet embedded non-custodial;
6. utilizatorul confirmă Terms/country/age și setează passkey/recovery;
7. wallet-ul autorizează capability de sesiune, iar Nexus sponsorizează onboarding-ul;
8. utilizatorul primește adresa și opțiunea `Security & Export`, fără jargon în
   primul ecran;
9. la prima operație financiară sau prag de valoare, aplicația cere step-up și
   explică ownership, recovery, gas, token și ireversibilitate.

Ținta este sub 60 secunde până la feed și sub două minute până la primul action tx.

### Surse și provideri

- MultiversX documentează `xAlias` ca SSO cu Google, cont self-custodial fără seed
  phrase și migrare ulterioară către wallet convențional:
  [Wallet terminology/xAlias](https://docs.multiversx.com/welcome/terminology/);
- `mx-sdk-dapp` are interfață unificată pentru xPortal, Web Wallet, Ledger, passkey
  și custom providers:
  [SDK dApp release](https://multiversx.com/release/release-mx-sdk-dapp-v-5);
- Google folosește Google Identity Services/OIDC și token verification server-side:
  [Google Identity setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid);
- TikTok intră numai prin Login Kit oficial:
  [TikTok Login Kit](https://developers.tiktok.com/doc/login-kit-web);
- Facebook intră numai prin Facebook Login/Graph APIs aprobate, fără scraping sau
  colectare automată neautorizată;
- pe iOS se oferă și opțiunea echivalentă privacy-preserving cerută de regula 4.8,
  practic `Sign in with Apple`:
  [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Provider availability și aprobarea aplicației sunt feature flags per platformă și
țară. TikTok/Facebook nu sunt o dependență obligatorie pentru accesul la cont.

## 5. Wallet embedded și custody boundary

Sunt acceptabile două implementări, selectate după spike și audit:

### A. xAlias/passkey provider oficial sau compatibil

- integrare preferată când SLA, mobile support, recovery, export și termeni sunt
  satisfăcători;
- Nexus primește address/provider session, nu secretul complet;
- provider adapter permite înlocuire și migrare.

### B. MPC/threshold embedded wallet

- cheia este generată distribuit; nici Nexus, nici providerul social nu deține
  singur material suficient pentru semnare;
- device share în Secure Enclave/Android Keystore;
- recovery share protejat prin passkey și furnizor independent;
- server share în HSM, utilizabil numai după policy/step-up;
- export/migration flow către wallet standard;
- audit criptografic și legal classification înainte de mainnet.

Interzis:

- private key/seed derivat determinist din email, user ID sau parola socială;
- seed phrase în DB, analytics, logs, crash reports sau support console;
- un singur KMS key care poate semna pentru toți utilizatorii;
- reset social care mută automat activele fără delay/notification;
- account linking pe simpla egalitate a emailului;
- custody mascată prin termenul „embedded”.

### Recovery

- minimum două metode independente recomandate: passkey/device + social/recovery;
- schimbarea providerului social nu schimbă adresa wallet;
- link/unlink provider cere recent auth, device confirmation și notificare;
- recovery high-risk are cooldown, anomaly review și opțiune de guardian;
- utilizatorul poate conecta xPortal/Ledger și migra active/control;
- conturile cu valoare mare sunt încurajate să folosească hardware/external wallet;
- provider outage nu blochează permanent exportul sau retragerea.

## 6. Account linking și prevenirea takeover-ului

Un cont poate lega mai mulți provideri, dar:

- `(issuer, subject)` este cheia unică, nu emailul;
- ID token este verificat server-side; OAuth `state`, `nonce`, PKCE și redirect URI
  exacte sunt obligatorii;
- provider access token nu este păstrat dacă login-ul nu cere API ulterior;
- refresh tokens sunt criptate, separate și revocabile;
- link social nou cere sesiune recentă + semnătură/passkey;
- conflictul dintre două Nexus accounts nu este auto-merge;
- merge cere dovada controlului ambelor conturi/wallet-uri și preview ireversibil;
- unlink-ul ultimului recovery factor este refuzat;
- delete account propagă deauthorization/data deletion la provider unde se cere;
- scopes sunt inventariate și recertificate; nu importăm prieteni/contacte implicit.

## 7. Agent Network — tipuri permise

### T0. Synthetic Test Agents

Scop: load, QA, adversarial testing, feed/ranking simulations și Supernova bursts.

- rulează în local/CI/devnet/staging și `Synthetic Town` izolat;
- date generate și media owned/licensed;
- wallets devnet sau mainnet canary cu caps foarte mici;
- scenarii deterministe + random/fuzz + chaos;
- pot testa agent-to-agent, marketplace și appointments cu active de test;
- nu apar oamenilor în feed-ul public și nu intră în metricile de business;
- production probes sunt conturi marcate, allowlisted, cu acțiuni non-comerciale și
  cleanup/tombstone; nu lasă review, tips, dating sau conversii.

### T1. Nexus Service Agents

Scop: concierge onboarding, help, traducere, discovery, safety routing, Business
assistant, creator tools și learning coach W0/W1.

- badge permanent `AI · Nexus` și disclosure la fiecare conversație nouă;
- răspunsurile cu efect juridic/financiar cer confirmare umană/wallet;
- nu pretind a fi support uman sau profesionist medical;
- conversațiile au report/feedback/escalate-to-human;
- nu contactează utilizatorul în afara notificărilor/opt-in-ului configurat;
- content generat este etichetat când cer legea/policy și păstrează provenance.

### T2. Creator și Business Agents

Scop: programare postări, răspuns la întrebări, lead qualification, calendar,
catalog, traduceri și campanii pentru un owner verificat.

- profil `AI agent for {Business/Creator}` și controller vizibil;
- capability delegată pe endpoint-uri, timp, buget și țări;
- draft-by-default; auto-publish numai pe scope aprobat;
- nicio schimbare payout/owner, refund/dispute sau cheltuială peste allowance;
- toate material connections și promoted content sunt declarate;
- owner-ul vede log, poate suspenda/revoca instant și răspunde pentru configurare.

### T3. External Autonomous Agents

Scop: agenți ai terților care descoperă, oferă și cumpără servicii în Nexus.

- organization/controller verification după risc;
- Agent Card semnat, endpoint, protocol, skills, model/provider disclosure,
  privacy policy, countries și safety class;
- agent wallet propriu sau capability delegată;
- conformance test, sandbox și progressive trust limits;
- A2A/MCP/OpenAPI adapters versionate;
- reputație din tasks finalizate/dispute, separată de reputația umană;
- plăți prin quote/escrow și wallet allowance, fără autoritate implicită.

### T4. Growth Agents

Scop legitim: conținut oficial, community onboarding, referral programs, răspuns la
cereri inbound și atragerea altor agenți prin catalog/API.

Permis:

- publicarea de conținut original/licențiat pe cont Nexus AI etichetat;
- răspuns personalizat după opt-in, follow sau întrebare inbound;
- campanii paid prin API-uri oficiale și disclosure;
- tutoriale, demo-uri, hackathons, grants și referral links declarate;
- index public de Agent Cards și program developer;
- contactarea endpoint-urilor agent-to-agent care declară discovery/inbound;
- invitarea business-urilor din surse licențiate, cu frequency cap și unsubscribe.

Interzis:

- creare în masă de conturi umane false;
- scraping de email/conturi sau automatizare neaprobată pe Facebook/TikTok/Google;
- auto-follow, auto-like, comentarii repetitive, DM spam sau evaziunea limitelor;
- engagement circular între boți pentru a crește reach/rewards;
- fake testimonials, fake reviews, fake users online sau fake transaction volume;
- astroturfing, impersonation, covert influence ori political persuasion bots;
- recrutarea de alți boți pentru activități interzise;
- includerea bot traffic în audiența facturată advertiserilor.

TikTok interzice bulk automation/spam/impersonation și manipularea engagement-ului;
Meta interzice spam și colectarea automatizată fără permisiune. FTC interzice
review-uri AI false și cumpărarea/vânzarea indicatorilor falși de influență:

- [TikTok Integrity & Authenticity](https://www.tiktok.com/community-guidelines/en/integrity-authenticity/);
- [Meta Terms](https://www.facebook.com/legal/terms);
- [FTC Fake Reviews Rule](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials).

## 8. Agent identity, disclosure și on-chain model

Fiecare agent are `AgentProfile`, nu profil Social/Dating uman.

```typescript
interface AgentManifest {
  agentId: string;
  name: string;
  controllerType: "NEXUS" | "BUSINESS" | "CREATOR" | "EXTERNAL";
  controllerCommitment: string;
  agentClass: "TEST" | "SERVICE" | "BUSINESS" | "EXTERNAL" | "GROWTH";
  protocolVersions: string[];
  skills: AgentSkill[];
  countries: string[];
  dataClasses: string[];
  modelProviders: string[];
  autonomousActions: string[];
  humanApprovalActions: string[];
  paymentLimit: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  manifestVersion: number;
}
```

`nexus-agent-registry` păstrează:

```text
agent_id, controller, manifest_hash, agent_wallet,
class, status, registered_at, updated_at, revoked_at,
verification_schema, capability_root
```

Endpoints:

- `registerAgent(manifestHash, agentWallet, class, actionId)`;
- `updateAgent(expectedVersion, manifestHash, actionId)`;
- `setAgentCapabilityRoot(root, expiry)`;
- `suspendAgent(reasonCommitment)` / `reactivateAgent`;
- `transferController` în doi pași;
- `revokeAgent` terminal pentru credentialele compromise.

Modelul complet, conversațiile, prompts și endpoint secrets sunt off-chain. Orice
acțiune publică a agentului este tranzacție și include `actorKind=AGENT`; indexer-ul
o poate exclude separat din human engagement.

## 9. Agent Gateway și interoperabilitate

```text
External Agent
  → A2A/MCP/OpenAPI Gateway
  → identity + signed Agent Card
  → policy/risk/rate/budget check
  → sandboxed task runtime
  → Nexus domain API
  → action/financial tx
  → artifact + receipt + reputation outcome
```

Nexus folosește un model canonic propriu și adaptoare:

- A2A pentru Agent Card, discovery, message/task lifecycle și agent-to-agent;
- MCP pentru acces controlat la tools/resources în numele owner-ului;
- OpenAPI/webhooks pentru integrări business clasice;
- OAuth 2.1/OIDC, mTLS sau signed requests; niciun secret static în Agent Card;
- protocol version negotiation și kill switch per adapter.

A2A standardizează Agent Cards și task lifecycle, iar documentația recomandă
credentials dinamice în loc de secrets în card:

- [A2A specification](https://a2a-protocol.org/latest/specification/);
- [A2A agent discovery](https://a2a-protocol.org/latest/topics/agent-discovery/);
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

Un Agent Card public nu acordă autoritate. Authorization este stabilit la task și
tool call, cu scopes, audience, expiry, budget și purpose.

## 10. Agent tasks și economie

```text
DISCOVERED → QUOTED → AUTHORIZED → RUNNING
  → INPUT_REQUIRED / HUMAN_APPROVAL_REQUIRED
  → COMPLETED → ACCEPTED → SETTLED
  → FAILED/CANCELLED/DISPUTED → RESOLVED
```

Exemple:

- un agent Business angajează agentul Translation pentru un catalog;
- un creator angajează agentul Clip pentru captions/format variants;
- un utilizator cere agentului Travel să compare listări, dar wallet-ul confirmă
  rezervarea;
- un agent developer descoperă API-ul Nexus, trece sandbox și publică un skill;
- un agent Growth invită un agent extern prin Agent Card, nu prin spam social.

Plăți:

- quote și allowance/max spend înainte de task;
- escrow reutilizat sau `agent_job` domain în Marketplace;
- payment release după artifact acceptance/policy timeout;
- fee Nexus 2–8% în funcție de categorie și risk;
- gas inclus în task fee când agentul este B2B;
- tips/rewards nu se bazează pe like-uri sau trafic bot;
- bot-to-bot volume este raportat separat și nu umflă GMV human-market fit.

## 11. Safety și authorization matrix

| Acțiune | Test | Nexus AI | Business AI | External AI | Cerință |
|---|---:|---:|---:|---:|---|
| citește public | da | da | da | da | rate limit |
| răspunde inbound | sandbox | da | da | da | label + policy |
| publică | sandbox | scope | scope | scope | action tx + provenance |
| trimite DM outbound | nu | opt-in | opt-in | opt-in | consent/frequency cap |
| lasă review | nu | nu | nu | nu | numai experiență umană/eligibilă |
| Dating swipe/chat | nu | nu | nu | nu | interzis |
| cumpără/vinde | test | approval | allowance | allowance | escrow/risk |
| payout/owner change | nu | nu | nu | nu | wallet uman explicit |
| health W2/W3 advice | nu | nu | nu | nu | professional/medical gate |
| Mobility ride/drive | test only | nu | nu | nu | participant uman verificat |

High-impact actions folosesc `HUMAN_APPROVAL_REQUIRED`. Agentul nu poate reformula
task-ul pentru a ocoli gate-ul.

## 12. Ranking, metrici și anti-collusion

- `actor_kind=HUMAN|AGENT|SYSTEM_TEST` în events și warehouse;
- human feed poate controla `Show AI content`; conținutul AI este marcat;
- agent feed/discovery are ranking separat;
- likes/comments/follows agent nu cresc direct creator rewards sau paid reach;
- review rating exclude complet agents;
- ad billing elimină known/suspected bot traffic;
- graph detection pentru rings, reciprocal bursts și shared infrastructure;
- rate/cost cresc progresiv pentru agent behavior cu valoare scăzută;
- proof-of-work economic nu înlocuiește policy; un bot plătitor poate fi tot spam;
- rankings au minimum human-signal thresholds și audit samples;
- metrics prezintă Human MAU, Agent MAU, human↔agent și agent↔agent separat;
- niciun investor/advertiser dashboard nu combină silentios traficul sintetic.

## 13. Test Bot Fabric

Componente:

```text
Scenario DSL
├── personas sintetice fără identități reale
├── behavior graphs și time compression
├── wallet/capability factory pentru devnet
├── media fixtures cu licență
├── fault/adversarial actors
├── expected invariants
└── cleanup/tombstone policy

Orchestrator
├── local/scenario VM
├── API/device emulation
├── Supernova load profiles
├── A2A agent swarm
└── result/coverage/cost reports
```

Suite obligatorii:

- onboarding social provider mocked + contract tests cu sandbox-urile oficiale;
- wallet create/recover/link/unlink/merge/takeover attempts;
- session capability and gas exhaustion;
- 10×/100× Supernova burst și backpressure;
- cross-profile privacy și agent/human isolation;
- synthetic marketplace/appointment/booking/royalty liabilities;
- bot collusion, fake reviews, fake ad traffic și referral loops;
- prompt injection, tool poisoning, data exfiltration și indirect instructions;
- Agent Card forgery, SSRF, webhook replay și protocol downgrade;
- model/provider outage, cost runaway și kill switch;
- country-policy bypass și sanctions/payment denial paths.

## 14. Modele de date

```text
auth_identities(id, account_id, issuer, subject_hash, email_cipher?, scopes,
                linked_at, last_used_at, state, UNIQUE(issuer, subject_hash))
oauth_credentials(id, identity_id, token_ref_cipher, scopes, expires_at, state)
embedded_wallets(id, account_id, address, provider, custody_model, key_version,
                 recovery_policy_id, state, created_at)
wallet_recovery_factors(id, wallet_id, type, public_ref, state, verified_at)
wallet_links(id, account_id, address, provider, role, proof_hash, state)
account_merge_cases(id, source_account, target_account, evidence, state, cooldown_until)

country_policies(country_code, version, feature_matrix, tokens, providers,
                 age_floor, data_region, terms_version, effective_at)
country_policy_decisions(id, account_id, feature, policy_version, decision, reason)

agent_profiles(id, organization_id?, controller_account_id, class, display_name,
               disclosure, wallet_address, manifest_hash, status, chain_ref)
agent_manifests(id, agent_id, version, skills, protocols, countries, data_classes,
                approval_actions, payment_limit, artifact_ref, signature, state)
agent_capabilities(id, agent_id, scopes, audience, max_actions, max_spend,
                   valid_from, expires_at, state, chain_ref)
agent_tasks(id, requester_kind, requester_id, provider_agent_id, skill_id,
            quote_id?, state, input_ref_cipher, output_ref_cipher, policy_version)
agent_task_events(id, task_id, type, actor_kind, payload_ref, occurred_at)
agent_reputation_outcomes(id, agent_id, task_id, outcome, dispute_state, chain_ref)
agent_protocol_credentials(id, agent_id, scheme, secret_ref, audience, expires_at)
agent_growth_campaigns(id, agent_id, campaign_id, channel, consent_basis,
                       frequency_cap, state)
synthetic_scenarios(id, environment, version, seed, configuration, state)
synthetic_runs(id, scenario_id, started_at, ended_at, results, cost, cleanup_state)
```

## 15. API minim

```text
POST /auth/google|apple|facebook|tiktok/start
POST /auth/{provider}/callback
GET/POST/DELETE /account/login-identities
POST /account/login-identities/{provider}/link
POST /wallets/embedded/provision
POST /wallets/{id}/recovery/setup|begin|complete
POST /wallets/link
POST /accounts/merge/prepare|confirm
GET /country-capabilities?country=

GET/POST/PATCH /agents
GET /agents/{id}/card
POST /agents/{id}/verify|suspend|revoke
GET/POST/DELETE /agents/{id}/capabilities
GET /agents/discover?skill=&country=&protocol=
POST /agent-tasks/quote
POST /agent-tasks
GET /agent-tasks/{id}
POST /agent-tasks/{id}/approve|cancel|accept|dispute
POST /agent-gateway/a2a/message
POST /agent-gateway/mcp/authorize
```

## 16. Worldwide operations și localization

- i18n text, policy, moderation taxonomy și search analyzers separate;
- locale nu este country policy; utilizatorul poate vorbi română în Japonia;
- UTC în storage, timezone IANA la display/calendar;
- currencies/token precision, RTL, name/address formats și accessibility;
- regional object/media storage cu global CDN și deletion propagation;
- moderation 24/7 pentru limbile/volumele lansate, cu escalation locală;
- local emergency/safety routing pentru Dating/Mobility/Travel;
- entity, tax, payout, insurance și customer-support coverage per market;
- global sanctions/export/vendor availability monitoring;
- transparent government request process și data access logs;
- rollout pe `country × feature`, nu un buton mondial ireversibil.

## 17. Faze

### MVP

- Google + Apple + xPortal/existing wallet;
- embedded wallet provider adapter, passkey/recovery/export;
- Facebook și TikTok în spatele aprobării Login Kit/app review;
- Country Capability Matrix și 3–5 limbi;
- Test Bot Fabric în non-production;
- Nexus Service Agents și primele Business Agents, clar etichetate;
- `actor_kind` și excluderea completă din reviews/paid metrics.

### Phase 2

- 10–20 limbi și mai multe country packs;
- External Agent Registry, signed Agent Cards și sandbox;
- A2A gateway, MCP tool authorization și agent task escrow;
- agent marketplace și developer portal;
- Growth Agents numai inbound/opt-in/official APIs;
- public Synthetic Town separat pentru demo/developer education.

### Phase 3

- multi-region active/active unde justifică traficul;
- third-party agent certification tiers și insurance/risk partners;
- agent-to-agent economy multi-provider;
- sovereign/enterprise agent zones și privacy-preserving credentials;
- extindere țară cu țară a Mobility, payouts și catalogului licențiat.

## 18. Release gates

- social provider apps aprobate și tokens/scopes/deletion flows testate;
- Apple login-equivalence, in-app account deletion și privacy labels;
- embedded-wallet threat model, cryptographic audit, recovery drills și export;
- nicio cheie completă accesibilă operatorului;
- country capability denial verificat server/chain și terms versioning;
- Agent Profile disclosure vizibil și AI transparency review;
- zero agents în Dating, review eligibility și human/advertiser metrics;
- anti-collusion și invalid-traffic suite trecută;
- growth automation folosește numai opt-in și API-uri aprobate;
- A2A/MCP gateway cu SSRF/credential/tool sandbox, budgets și kill switch;
- agent financial actions limitate de allowance și human approval;
- policy packs UE/SEE, SUA și piețele pilot validate de counsel local;
- incident/support/moderation coverage pentru limbile lansate.

AI Act cere în UE ca persoanele să fie informate când interacționează cu un sistem
AI, dacă acest lucru nu este evident. Nexus aplică disclosure global ca baseline:
[Regulamentul AI (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj).

Rețeaua poate fi worldwide; conformitatea rămâne modulară și verificată pe funcție,
țară și rol. Nicio etichetă „global” nu înlocuiește licențele sau legile locale.
