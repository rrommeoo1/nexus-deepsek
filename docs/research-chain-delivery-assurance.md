# Nexus — engineering assurance și release plan pentru MultiversX

> Document de cercetare și execuție, 1 august 2026. Nu înlocuiește specificațiile normative ale contractelor. Parametrii de rețea, versiunea VM/framework, gas schedule și starea activării Supernova se reverifică la fiecare release candidate.

## Obiectiv și principii de livrare

Scopul este ca Nexus să poată ține fonduri EGLD/ESDT și emite attestations fără ca un defect de contract, relayer, indexer sau backend să producă pierdere, plată dublă ori o stare financiară imposibil de reconciliat.

Principii:

1. **Chain-ul este sursa de adevăr pentru fonduri și starea contractelor.** PostgreSQL, action ledger-ul și indexer-ul sunt proiecții operaționale reconstruibile.
2. **Un singur intent produce cel mult un efect economic.** Idempotency există de la API până la endpoint, eveniment și posting contabil.
3. **Includere, execuție și finalitate sunt stări distincte.** UX-ul nu afișează „plătit” doar pentru că un hash a apărut în mempool sau într-un block.
4. **Build once, promote the same bytes.** Artifactul WASM auditat și hash-uit trece neschimbat prin testnet și mainnet; nu se recompilă pentru producție.
5. **No irreversible big bang.** Contractele financiare pornesc cu caps mici, allowlist, pause pentru intrări noi și căi de withdraw/refund care rămân active.
6. **Rețeaua este o dependență versionată.** Nexus rulează pe mainnet-ul curent și este validat separat pe mediul Supernova; activarea Supernova nu este presupusă.

MultiversX recomandă unit, integration/black-box și scenarii, iar Go VM este implementarea de referință care modelează gas-ul; testarea cross-shard reală necesită un blockchain ([Testing overview](https://docs.multiversx.com/developers/testing/testing-overview/)). Build-ul produce WASM, ABI și imports prin `sc-meta` ([Build reference](https://docs.multiversx.com/developers/meta/sc-build-reference/)).

## Workstreams și livrabile

```text
Contract specification + threat model
          │
          ├── WS1 Contracts ─────────────┐
          ├── WS2 Action ledger ─────────┤
          ├── WS3 Relayers ──────────────┼── WS6 System assurance
          ├── WS4 Indexer/reconciliation ┤         │
          └── WS5 Network/Supernova ─────┘         ├── audits
                                                    ├── testnet soak
Governance/KMS/runbooks ────────────────────────────└── capped mainnet rollout
```

### WS1 — Contracte Rust/WASM

Scope: `profile-registry`, `reputation`, `marketplace-escrow`, `booking-escrow`, `badge-factory`, `tipping` și module comune pentru access control, pause, fee caps, IDs și accounting.

Livrabile:

- machine-readable state machine pentru fiecare contract și matrice endpoint × caller × state × payment;
- layout registry pentru toate storage keys și tipurile serializate, cu `schemaVersion` și plan de migrare;
- typed proxies, ABI/ESDT ABI și TypeScript bindings generate, fără editare manuală;
- views punctuale pentru reconciliere: liability per token, escrow state, withdrawable balance, config/version;
- evenimente versionate și fixture-uri de decodare;
- scenarii de deploy, init, upgrade, pause/unpause și recovery;
- reproducible WASM, `imports.json`, ABI, codehash, SBOM, compiler/framework/container digest.

Definition of done: toate invariants automatizate trec pe Rust VM și Go VM, worst-case gas este sub buget, storage migration a fost repetată pe o copie de stare, iar audit findings eligibile sunt închise.

### WS2 — Action ledger și contabilitate operațională

Action ledger-ul este jurnalul append-only care leagă intent-ul Nexus de bytes semnați, tranzacția MultiversX, evenimente și postările contabile. Nu „corectează” chain-ul; detectează și izolează discrepanțele.

Entitate minimă `ChainAction`:

```text
actionId (UUIDv7), idempotencyKey, wallet, activeProfileHash
network/chainId, contract, endpoint, intentDigest
userSignedTxHash, signedTxBytesRef, relayer, networkTxHash, nonce
expectedToken/amount, expectedEntityId
sourceShard, destinationShard?, originalTxHash?
state, failureClass, observedAt/finalizedAt
artifactReleaseId, ABI version, correlationId
```

Stări monotone:

```text
CREATED → POLICY_VALIDATED → USER_SIGNED → RELAYER_SIGNED? → SUBMITTED
          → OBSERVED_SOURCE → EXECUTION_PENDING? → FINALIZED_SUCCESS
                                              └──→ FINALIZED_FAILED
or any non-final state → EXPIRED / RECONCILIATION_REQUIRED
```

`RECONCILIATION_REQUIRED` nu este „failed”; oprește acțiunile dependente până când chain observer-ul stabilește rezultatul. Rebroadcast-ul folosește aceiași bytes semnați; nu se fabrică o a doua tranzacție economică. O tranzacție nouă cere un nou intent și, când e cazul, o nouă semnătură.

Contabilitatea folosește journal entries echilibrate per token:

- debit: contract escrow balance / credit: escrow liability la finanțare;
- mutare liability escrow → seller/guest/platform withdrawable la settlement;
- debit withdrawable / credit on-chain outflow la withdraw finalizat;
- posting-ul se face din eveniment finalizat și se deduplică prin event identity.

Ledger invariants: `debits == credits`, nicio referință externă postată de două ori, suma liability proiectată egală cu views on-chain, iar rebuild-ul integral produce același snapshot/hash.

### WS3 — Relayer fleet

Relayed transactions v3 cer semnăturile sender-ului și relayer-ului, adaugă base gas, iar relayer-ul trebuie să fie în același shard cu sender-ul ([Relayed transactions](https://docs.multiversx.com/developers/relayed-transactions/)).

Componente:

- shard router și minimum două instanțe per shard, fără active-active signing pe aceeași cheie;
- keys în HSM/KMS, wallet separat pe shard și pe mediu, plafon de EGLD și auto-refill cu aprobări;
- policy engine cu allowlist `network + contract + endpoint + codehash`, gas cap, value cap, quota per wallet/device/IP și daily sponsorship budget;
- verifier care re-decodează tranzacția semnată de utilizator și compară digest-ul cu intent-ul aprobat înainte de cosign;
- nonce coordinator separat pentru fiecare relayer address; lock cu fencing token, detectarea nonce gap și reconciliere cu chain;
- broadcaster multi-provider cu health scoring și rebroadcast idempotent;
- kill switch pe endpoint, contract, shard și global.

Negative tests obligatorii: sender/relayer același, shard greșit, guarded relayer, relayer=guardian, endpoint nepermis, gas inflation, modificare după user signature, replay cross-network, nonce conflict, KMS indisponibil, RPC divergent și buget epuizat.

SLO operațional: zero cosign în afara policy; zero nonce reutilizat; niciun single point of failure la broadcast; cheile nu părăsesc KMS/HSM; un incident de policy închide sponsorship-ul fără a opri tranzacțiile plătite de utilizator.

### WS4 — Indexer, finality și reconciliere

Indexer-ul consumă tranzacții, smart-contract results și events. Event identity trebuie să includă tx/SCR, shard și order; indexul oficial expune `originalTxHash`, `txHash`, `shardID` și `order` ([Events index](https://docs.multiversx.com/sdk-and-tools/indices/es-index-events/)).

Pipeline:

1. ingest raw, append-only, cu cursor/checkpoint per shard/provider;
2. normalizează numai cu ABI asociat codehash-ului contractului la acel block;
3. corelează original transaction, SCR/callback și toate events;
4. marchează final numai când există finalitatea relevantă, inclusiv pașii cross-shard;
5. publică domain events idempotente către action ledger/read models;
6. rulează reconciliere views/balances/config cu chain-ul;
7. poate șterge toate proiecțiile și face replay determinist din raw log/checkpoint.

Failure drills: provider cu lag, evenimente duplicate/out-of-order, cursor pierdut, ABI necunoscut, callback întârziat, RPC providers care nu sunt de acord, 30 minute downtime, upgrade de contract la mijlocul replay-ului și rebuild total. Discrepanțele financiare deschid alertă P0/P1, blochează settlement-ul automat dependent și nu sunt „reparate” prin update SQL manual.

### WS5 — Compatibilitate mainnet și Supernova

Supernova decuplează consensus de execution și introduce backpressure dacă execuția rămâne în urmă ([Supernova architecture](https://multiversx.com/blog/supernova-decoupling-consensus-and-execution)). Documentația oficială raporta în iunie 2026 că upgrade-ul era încă în integrare/testare spre mainnet, deci statusul trebuie verificat la data release-ului, nu inferat ([MultiversX terminology — Supernova](https://docs.multiversx.com/welcome/terminology/)).

Nexus păstrează două profile de compatibilitate:

- `CURRENT_MAINNET`: versiunea și gas schedule observate la release cut;
- `SUPERNOVA_CANDIDATE/ACTIVE`: testnet, shadow fork sau mainnet după activare confirmată.

Reguli:

- nicio logică nu presupune 6 secunde sau 600 ms; deadlines sunt timestamps/rounds explicite în contract, iar UX urmărește starea, nu un `sleep`;
- action ledger separă `OBSERVED_SOURCE`, `EXECUTION_PENDING` și `FINALIZED_*` pentru a rămâne corect când consensus și execution sunt decuplate;
- load tests includ burst-uri rapide, nonce contention, tx-pool backpressure, execuție care rămâne în urmă și callbacks cross-shard;
- indexer-ul și notificările sunt testate la cadence ridicat, inclusiv ordering și duplicate events;
- gas baselines se recalculează pe gas schedule-ul mediului; nu se copiază valori dintr-o rețea în alta;
- compatibilitatea se validează prin contract bytecode/codehash identic pe ambele profile; orice diferență de VM devine release blocker;
- activarea Supernova nu schimbă state machine/ABI și nu este dependency pentru MVP. Optimizările de latență se activează prin capability flag după soak.

### WS6 — System assurance și operațiuni

Leagă contractele, wallet signing, action ledger, relayers, indexer, API, KMS, multisig și observability. Livrează threat model end-to-end, fault injection, dashboards, incident playbooks, game days și release evidence pack.

## Test pyramid și cadence

| Nivel | Ce verifică | Mediu | Când rulează |
|---|---|---|---|
| L0 static/supply chain | format, lint, denied unsafe/deps, lockfiles, secrets, ABI/storage diff | CI hermetic | fiecare PR |
| L1 unit | arithmetic, fees, policies, serialization, state guards | Rust native | fiecare PR |
| L2 property/fuzz | sequences, invariants, adversarial inputs | Rust VM/proptest/fuzzer | PR targetat + nightly |
| L3 black-box | endpoint behavior numai prin ABI/proxy | Rust VM | fiecare PR |
| L4 differential scenario | aceleași scenarii Rust VM vs Go VM, gas/logs/storage | Rust + Go VM | fiecare PR pentru critical paths; full nightly |
| L5 service integration | action ledger, relayer policy/nonce, indexer replay, double-entry | ephemeral stack + chain simulator | main branch/RC |
| L6 multi-shard E2E | async/callback, SCR, finality, provider failures | local full network/devnet/testnet | nightly + RC |
| L7 performance/chaos | sustained/burst load, lag, backpressure, restart/recovery | dedicated network/Supernova shadow | săptămânal + RC |
| L8 canary | real providers și mainnet behavior cu caps | mainnet | post-approval, progresiv |

Scenariile JSON pot rula pe Rust și Go backends și sunt potrivite pentru replay/interoperabilitate; documentația recomandă integrarea lor în CI ([Running scenarios](https://docs.multiversx.com/developers/testing/scenario/running-scenarios/), [Scenario concept](https://docs.multiversx.com/developers/testing/scenario/concept/)). Interactor traces permit capturarea unui flow și replay-ul lui pe VM-uri ([Interactors](https://docs.multiversx.com/developers/meta/interactor/interactors-overview/)).

### Invariants obligatorii

Contract/accounting:

- pentru fiecare token, `onChainContractBalance >= escrowLiability + withdrawableLiability + accruedFees`;
- intrări = ieșiri + liabilities curente; nicio valoare nu se creează/pierde prin rounding;
- un `escrowId/actionId/sourceActionId` produce un singur settlement/outcome;
- o stare terminală nu revine activă; numai tranzițiile din state machine sunt posibile;
- refund + payout + fee = principal, exact, iar fiecare split însumează 10.000 bps;
- withdrawal cumulativ ≤ withdrawable; reentrancy/retry nu dublează transferul;
- fee ≤ hard cap; config nou afectează numai operațiuni noi;
- booking inventory nu permite intervale suprapuse confirmate pentru aceeași unitate;
- badge revocat/expirat nu validează, issuer dezactivat nu emite, ticket consumat nu se reutilizează;
- owner/role/pause/upgrade guards nu pot fi ocolite prin proxy/callback;
- upgrade-ul păstrează liabilities, roles, IDs, token allowlist și state hashes.

Off-chain:

- action state este monotonic și derivabil din raw observations;
- `intentDigest` corespunde bytes semnați și endpoint-ului decodat;
- ledger journal este echilibrat și rebuild-ul este determinist;
- indexer snapshot = contract views la același finalized checkpoint;
- relayer nu cosignează în afara policy și nu reutilizează nonce;
- o notificare/read model duplicată nu produce o a doua acțiune financiară.

### Fuzz și model-based testing

- generează secvențe de endpoints, caller roles și timp, nu doar argumente izolate;
- include zero/max `BigUint`, token/nonce greșit, empty buffers, hash-uri duplicate, liste la limită și timestamp la frontieră;
- reordonează callbacks/SCR și injectează success/failure/out-of-gas;
- mută timpul înainte/înapoi numai unde simulatorul permite pentru a explora deadlines;
- compară modelul pur al state machine cu starea reală după fiecare pas;
- păstrează seed-ul oricărui failure ca test de regresie;
- rulează differential Rust VM/Go VM pentru corpus-ul minimizat.

### Gas și dimensiune WASM

Go VM este backend-ul de referință pentru gas conform documentației de testare. Pentru fiecare endpoint se păstrează baselines pe:

- cold storage vs existing storage;
- primul/ultimul element în limita acceptată;
- EGLD și fiecare ESDT acceptat;
- success, reject, timeout, dispute, callback și withdrawal;
- pre/post-upgrade și current/Supernova profile.

Gates recomandate:

- +5% față de baseline: warning și explicație în PR;
- +10% sau depășirea endpoint budget: fail, exceptând waiver semnat și baseline reaprobat;
- test cu gas limit exact estimat și cu limită insuficientă;
- max input și max storage reads/transfers rămân sub 70% din limitele curente de protocol pentru headroom. Limitele sunt configurabile și se pot schimba la epoch ([SC API limits](https://docs.multiversx.com/developers/contract-api-limits/));
- size/import diff este vizibil în PR; orice import VM nou cere review de securitate.

### Cross-shard, load și chaos

Cross-shard suite:

- contracte co-locate și pe shard-uri diferite;
- async success/error/callback fără gas suficient/retry;
- sender/relayer routing per shard;
- callback întârziat după timeout UX, dar înainte de cleanup contractual;
- source finalized, destination pending/failed și compensare;
- epoch transition în mijlocul unui flow;
- provider/indexer restart și event replay.

Load profile se dimensionează din prognoza produsului, apoi se testează la 1× sustained, 3× burst și 10× abuse pentru endpoint-urile gratuite. Criterii minime:

- zero action/event/journal loss și zero settlement duplicat;
- relayer queue revine sub prag în 15 minute după un outage de 30 minute;
- indexer ajunge la finalized head și read model-ul se reconciliază fără intervenție SQL;
- sponsorship se degradează prin rate limit, nu prin epuizarea întregului wallet;
- tx-pool/backpressure crește latența, dar nu schimbă semantica stărilor;
- serviciile pot opri ingest/broadcast, reporni și relua din checkpoint/fencing token.

## CI/CD și medii

### Medii

| Mediu | Scop | Fonduri/chei | Persistență |
|---|---|---|---|
| developer | unit/Rust VM, debugging | fixture only | efemer |
| PR ephemeral | contract + services + chain simulator | chei generate per run | efemer, artifacts păstrate |
| multi-shard local | callbacks/finality/recovery | test only | recreat nightly |
| shared devnet | wallet/provider/E2E | KMS dev, faucet | persistent, reset-aware |
| public testnet/Supernova shadow | RC, load/chaos/upgrade rehearsal | KMS test separat | release namespace |
| mainnet canary | caps mici, allowlisted wallets/assets | HSM/KMS prod + multisig | permanent |
| mainnet GA | producție | chei separate per rol/shard | permanent |

Chain Simulator este disponibil prin `sc-meta` și oferă un mediu local controlabil, dar nu înlocuiește blockchain-ul pentru cross-shard ([sc-meta CLI](https://docs.multiversx.com/developers/meta/sc-meta-cli/), [Testing overview](https://docs.multiversx.com/developers/testing/testing-overview/)).

### PR pipeline

1. verifică lockfiles, toolchain pin, license/advisory/secrets;
2. `fmt`, `clippy -D warnings`, unit/property tests;
3. build locked, ABI/storage/import/WASM diff;
4. black-box Rust VM + critical Go VM scenarios;
5. service contract tests pentru ABI/events/action ledger;
6. gas regression și invariant report;
7. semnează provenance pentru artifacts de test.

### Main/RC pipeline

1. clean reproducible build în două runners izolate; codehash-urile trebuie să coincidă. MultiversX documentează build-ul determinist prin imagini Docker înghețate și verificarea `codehash` ([Reproducible builds](https://docs.multiversx.com/developers/reproducible-contract-builds/));
2. full Rust/Go scenario corpus și fuzz corpus replay;
3. ephemeral integration + indexer rebuild + fault injection;
4. multi-shard E2E și full upgrade rehearsal;
5. deploy exact artifact pe testnet/shadow, 7–14 zile soak pentru contracte financiare;
6. generează release evidence pack și cere approvals separate;
7. semnează artifact/manifest, publică ABI/codehash/source commit și construiește proposal multisig/timelock.

Niciun job de CI nu deține cheia owner sau mainnet deployer. Deploy-ul mainnet consumă artifactul aprobat din registry și necesită multisig; mediile folosesc conturi și secrete complet separate.

## Audit gates

### Gate A — design readiness

- specificație/state machines și trust boundaries înghețate;
- asset-flow diagram și privileges matrix;
- invariants și abuse cases trasabile în teste;
- storage/upgrade/rollback strategy aprobată;
- economic caps, tokens și dispute authority explicite.

### Gate B — internal assurance

- două review-uri independente de implementator per contract financiar;
- static/supply-chain, property/fuzz, differential VM și cross-shard complete;
- threat model pentru contracts, relayers, indexer, KMS, admin și oracle-uri umane;
- zero known Critical/High; Medium are owner, termen și acceptare explicită;
- code freeze pe surface-ul auditat.

### Gate C — independent audit

- minimum un audit extern pentru orice contract care ține fonduri; două perspective pentru booking/marketplace sau TVL ridicat;
- scope = commit + reproducible codehash + compiler/framework + deployment config + roles + relayer/indexer assumptions;
- toate Critical/High remediate și retestate de auditor; Medium financiar remediat înainte de canary;
- modificările după audit sunt fie non-code config în caps aprobate, fie intră în delta audit.

### Gate D — operational readiness

- multisig/timelock/KMS ceremonies repetate;
- dashboards/alerts și 24/7 escalation pentru canary;
- pause, refund/withdraw, relayer shutdown, indexer rebuild și provider failover demonstrate într-un game day;
- reconciliation la zero discrepancy pe întregul soak;
- bug bounty/VDP activ înainte de creșterea caps.

Un audit realizat de aceiași agenți care au construit produsul este util ca internal assurance, dar nu este independent. Mainnet cu fonduri semnificative cere separarea evaluatorului de autor.

## Release, canary și rollback

### Release evidence pack

- source commit/tag, dependency/toolchain locks;
- WASM/ABI/imports/ESDT ABI și Blake2b codehash;
- reproducible-build provenance și semnături;
- storage schema/version și migration report;
- test/invariant/fuzz/gas/cross-shard/load reports;
- audit reports + remediation mapping;
- deployment addresses, owner/role addresses și code metadata;
- economic config/caps/tokens/fee/deadlines;
- runbooks și explicit go/no-go record.

### Rollout în trepte

1. **Shadow/read-only:** indexer și action ledger urmăresc contractele/test events fără funds routing.
2. **Mainnet deploy, paused:** verificare codehash/owner/roles/config și queries din minimum doi providers.
3. **Internal canary:** wallets allowlisted, un token, max TVL și max per-action foarte mici; numai flow-uri happy/refund.
4. **Closed beta:** 1% din caps țintă, dispute/manual review obligatoriu, 72h fără discrepancy.
5. **Limited GA:** 10% → 25% → 50% caps, minimum o fereastră de observație între trepte.
6. **GA:** caps aprobate; token/endpoint nou este release separat, nu config informal.

Gates automate de oprire: invariant financiar încălcat, chain/indexer divergence persistent, Critical/High security signal, anomalie withdraw, relayer policy breach, finality provider disagreement sau error rate peste SLO.

### Rollback realist

Un contract upgrade nu are rollback magic. Storage-ul este păstrat la upgrade, iar migrarea poate fi incompatibilă ([Upgrading contracts](https://docs.multiversx.com/developers/developer-reference/upgrading-smart-contracts/)). Pentru contractele cu bani:

- preferință pentru deploy `vNext` paralel, nu upgrade in-place cu schimbare mare de storage;
- oprește intrările noi în v1, păstrează withdraw/refund/settlement, routează numai acțiuni noi spre vNext;
- migrarea funds/state este explicită, per escrow sau batch plafonat, cu reconciliation după fiecare lot;
- rollback de routing = pause vNext și reactivare v1 pentru acțiuni noi numai dacă v1 este sigur; fondurile existente rămân în contractul care le contabilizează;
- pentru upgrade in-place, previous WASM se poate reinstala doar dacă noul storage rămâne backward-decodable și downgrade-ul a fost repetat înainte; altfel se pausează și se migrează înainte, nu se forțează downgrade;
- backend/indexer au backward-compatible consumers pentru minimum două versiuni de ABI/events;
- nicio procedură nu folosește `git revert` sau update SQL ca rollback financiar.

## Ownership și separarea atribuțiilor

Ownership-ul este pe roluri/workstreams; rolurile pot fi ocupate de agenți specializați, dar approvals financiare și cheile trebuie separate tehnic.

| Artefact/decizie | Responsible | Accountable | Reviewer/approval separat |
|---|---|---|---|
| state machines/contracts | Smart Contract workstream | Chain lead | Security assurance |
| action ledger/accounting | Ledger workstream | Backend lead | Chain + finance/reconciliation reviewer |
| relayer/policy/KMS | Relayer/SRE workstream | Security lead | Chain + operations approver |
| indexer/finality/replay | Indexer workstream | Data/platform lead | Chain + SRE |
| Supernova compatibility | Network workstream | Chain lead | Indexer + relayer owners |
| test evidence/fuzz/gas | Assurance workstream | Security lead | Contract owners remediate, nu aprobă singuri |
| release artifact | Build/release automation | Release manager | Security + chain lead |
| mainnet deploy/upgrade | Multisig signers | Governance owner | Timelock/public manifest |
| caps/token enablement | Product risk + treasury | Governance owner | Security/reconciliation |
| dispute resolver | Operations policy | Trust & Safety owner | separat de upgrade/treasury |

Interdicții: același credential nu poate fi relayer signer și owner; auditorul nu aprobă propriul fix singur; deployer-ul nu poate schimba caps/treasury unilateral; indexer operator nu poate crea journal corrections fără dual approval și audit trail.

## Timeline și dependențe pentru chain MVP

Estimare cu workstreams paralele și scope MVP înghețat; booking poate fi mutat după marketplace fără a bloca social MVP.

| Săptămâni | Rezultat | Dependențe/gate |
|---|---|---|
| 0–2 | protocol/toolchain pin, trust model, state machines, action schema, event/ABI conventions | decizii tokens/fees/roles |
| 2–5 | module comune + profile/tipping kernels; action ledger skeleton; indexer raw ingest; relayer policy prototype | Gate A pentru module financiare |
| 4–8 | marketplace escrow, badge/reputation; double-entry; relayer shard fleet; event projections | ABI/events v1 înghețate |
| 6–10 | booking escrow/inventory; full views/reconciliation; E2E signing → finality | marketplace invariants stabile |
| 8–12 | property/fuzz, Rust/Go scenarios, gas baselines, local multi-shard, upgrade/migration drills | feature freeze la W10 |
| 10–13 | devnet/testnet/Supernova matrix, load/chaos și 7–14 zile soak | zero reconciliation drift |
| 12–16 | independent audit + remediation; audit delta tests | Gate B înainte de audit, Gate C după retest |
| 16–18 | release candidate final, reproducible artifacts, operations game day, multisig ceremony | Gate D |
| 18–20 | mainnet paused + internal canary + closed beta | caps foarte mici, daily reconciliation |
| 20–24 | limited GA în trepte; bug bounty și monitoring | fiecare cap gate are go/no-go |

Critical path:

```text
state machines → storage/events ABI → contract implementation
  → invariant/scenario corpus → system E2E → audit freeze
  → remediation/retest → reproducible RC → mainnet canary

events ABI → action ledger/indexer → reconciliation → canary
relayed tx policy + shard routing → relayer E2E → canary sponsorship
network capability matrix → cross-shard/Supernova tests → finality readiness
```

Booking adaugă aproximativ 3–5 săptămâni de audit/test dacă este lansat simultan cu marketplace. Recomandarea de risc este marketplace + tipping în primul canary, apoi booking ca release financiar separat.

## Go/no-go checklist final

Mainnet canary pornește numai dacă:

- artifact codehash este reproductibil și identic cu cel auditat/testat;
- zero Critical/High și zero Medium financiar deschis;
- toate invariants trec pe Rust VM, Go VM și E2E relevant;
- gas/worst-case și protocol-limit headroom sunt în buget;
- cross-shard/finality matrix trece pe versiunea efectivă a rețelei;
- relayer KMS, shard routing, budget kill switch și nonce recovery au fost demonstrate;
- indexer rebuild și reconciliation produc zero diferențe;
- upgrade/pause/refund/migration game day a trecut;
- multisig, roles, code metadata, caps și token allowlist sunt verificate independent;
- monitoring/on-call/runbooks/VDP sunt active;
- există o cale sigură de a opri intrările noi fără a bloca ieșirea fondurilor existente.

Dacă oricare condiție financiară sau de finalitate nu este demonstrată, release-ul rămâne pe testnet. O dată de marketing nu poate acorda waiver unui invariant de siguranță.
