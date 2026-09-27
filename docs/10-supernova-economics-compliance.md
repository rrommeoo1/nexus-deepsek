# Supernova readiness, cost minim și economie sustenabilă

Acest document este normativ. El definește cum rulează Nexus înainte și după
activarea Supernova, cum este sponsorizat gas-ul și ce condiții trebuie îndeplinite
pentru ca operatorul să aibă o marjă modestă fără taxe ascunse pentru utilizator.

Data de referință este 1 august 2026. La această dată, comunicările oficiale
MultiversX descriu Supernova ca fiind în drum spre mainnet, cu rețeaua de test la
blocuri de aproximativ 600 ms. În lipsa unei confirmări oficiale neechivoce a
activării pe mainnet, Nexus nu activează comportamentul Supernova după calendar,
ci numai după detectarea capabilităților rețelei live.

Surse tehnice primare:

- [Supernova: decoupling consensus and execution](https://multiversx.com/blog/supernova-decoupling-consensus-and-execution);
- [Guild Wars: testarea Supernova la 600 ms](https://multiversx.com/blog/guild-wars-winners-announced);
- [Agent Architecture: țintele comunicate pentru Supernova](https://multiversx.com/blog/agent-architecture).

## 1. Decizia de compatibilitate

Nexus păstrează două profile de runtime:

```text
ANDROMEDA_COMPAT
  model conservator, latențe istorice, finalitate și execuție urmărite prin
  adaptoarele existente

SUPERNOVA
  consens și execuție decuplate, rezultat de execuție urmărit separat,
  cozi și estimatoare adaptate backpressure-ului rețelei
```

`SUPERNOVA` se activează per network și per feature, nu global. Sursa de adevăr
este un `NetworkCapabilities` semnat/configurat din gateway-uri și API-uri oficiale,
coroborat de minimum două endpoint-uri independente. Data, versiunea aplicației sau
un singur răspuns RPC nu sunt suficiente.

```typescript
type ChainRuntimeProfile = "ANDROMEDA_COMPAT" | "SUPERNOVA";

interface NetworkCapabilities {
  chainId: string;
  observedEpoch: number;
  protocolVersion: string;
  runtime: ChainRuntimeProfile;
  consensusExecutionDecoupled: boolean;
  executionResultMode: "LEGACY" | "ASYNC_INCLUDED";
  relayedV3: boolean;
  observedAt: string;
  evidenceQuorum: number;
}
```

Fallback-ul la `ANDROMEDA_COMPAT` este automat dacă dovezile sunt divergente,
execution lag depășește pragul sau indexer-ul nu poate interpreta rezultatele.
Fallback-ul nu pierde acțiuni: oprește temporar sponsorship-ul nou, păstrează
intențiile idempotente și continuă reconcilierea.

## 2. Modelul corect de stare a tranzacției

Supernova separă ordonarea/finalitatea de execuție. De aceea Nexus nu mai folosește
un singur `CONFIRMED` pentru ambele lucruri.

```text
LOCAL_SIGNED
  → RELAY_QUEUED
  → NETWORK_ACCEPTED
  → ORDERED_FINAL
  → EXECUTION_PENDING
  → EXECUTED_SUCCESS
     sau EXECUTED_FAIL
     sau RECONCILIATION_REQUIRED
```

Reguli:

- `ORDERED_FINAL` nu autorizează livrarea bunului, check-in-ul sau payout-ul;
- numai `EXECUTED_SUCCESS` plus evenimentul/SC result așteptat schimbă autoritatea
  financiară în read model;
- `EXECUTED_FAIL` inversează numai starea optimistă off-chain, nu inventează o
  tranzacție compensatorie dacă contractul nu a schimbat fonduri;
- timeout-ul UI este distinct de timeout-ul contractual;
- aplicația afișează „Înregistrată, se execută” când cele două faze sunt separate;
- receipts conțin tx hash, status de consens, status de execuție și versiunea
  adaptorului care le-a interpretat.

Acțiunile sociale pot fi vizibile optimist, cu marcaj pending. Escrow, booking,
appointment, ride, royalty claim și payout nu devin finale în UI înainte de
`EXECUTED_SUCCESS` și reconciliere.

## 3. Schimbări în Blockchain Adapter

`ChainAdapter` expune interfața stabilă:

```typescript
interface ChainAdapter {
  getCapabilities(): Promise<NetworkCapabilities>;
  simulate(intent: ChainIntent): Promise<GasAndOutcomeEstimate>;
  submit(signed: SignedTransaction): Promise<SubmissionReceipt>;
  observe(txHash: string): AsyncIterable<ChainObservation>;
  reconcile(ref: DomainReference): Promise<ReconciliationResult>;
}
```

Implementarea Supernova include:

- nonce manager compatibil cu pool-ul de stare virtuală;
- separarea `consensusTimestamp`, `executionTimestamp` și `indexedTimestamp`;
- parser versionat pentru execution result inclusion;
- estimator de lag pe shard și contract;
- backpressure local bazat pe rata de execuție, nu doar pe includerea în bloc;
- circuit breaker per endpoint, shard, action type și treasury pool;
- retry numai pentru intenții dovedit neincluse; niciodată retransmitere oarbă;
- reconciliere de la evenimente și views on-chain, nu din răspunsul relay-ului;
- indexer dual-read în perioada de migrare și shadow comparison înainte de cutover.

Nexus nu depinde de legacy scheduled execution sau partial miniblocks. Contractele
folosesc timestamp/deadline și state machines explicite; nu codifică presupunerea
„un bloc = 6 secunde” sau „un bloc = 600 ms”.

## 4. Action Relay sub Supernova

Supernova face mai plăcut modelul `o acțiune = o tranzacție`, dar o viteză mai mare
poate produce și burst-uri mult mai mari. Relay-ul aplică:

- cozi separate per shard și clasă `PUBLIC`, `PRIVATE`, `FINANCIAL`;
- weighted fair queuing, astfel încât like spam să nu blocheze report/revoke;
- limite per capability, wallet, device, IP/risk cluster și action type;
- prioritate safety: block, report, revoke capability și escrow protection;
- estimare de gas înainte de sponsorizare și refuz determinist la depășirea capului;
- deduplicare prin `actionId`, capability nonce și payload commitment;
- autoscaling după execution lag, nu după lungimea cozii singure;
- load shedding: se amână like/save, nu revoke/report/financial reconciliation;
- maximum payload strict; media și plaintext nu intră în tranzacție.

Ținte după activarea verificată Supernova, nu promisiuni contractuale:

| Măsură | Țintă inițială |
|---|---:|
| optimistic local acceptance p95 | < 300 ms |
| ordered/final intra-shard p95 | < 2 secunde |
| executed-success intra-shard p95 | < 3 secunde |
| cross-shard end-to-end p95 | < 5 secunde |
| action tx success | > 99,7% |
| reconciliation mismatch financiar | 0 tolerat |

Țintele sunt ajustate din telemetria mainnet. Valorile de 600 ms, 100–250 ms sau
sub 2 secunde comunicate de protocol nu sunt copiate ca SLA Nexus.

## 5. Optimizarea gas-ului

„Fiecare acțiune este tranzacție” rămâne cerință, dar fiecare tranzacție trebuie să
fie minimală:

- action codes numerice și scheme versionate;
- hash-uri/commitments de 32 bytes, fără JSON, handle, text sau URL on-chain;
- event logs în loc de storage persistent când starea nu trebuie citită de contract;
- storage numai pentru capability, nonce, escrow, liability, revocation și stări
  necesare validării viitoare;
- fără colecții neplafonate sau scanări; indexarea și agregarea sunt off-chain;
- tombstone compact, fără copierea conținutului șters;
- sharding determinist pentru `nexus-actions` și contracte dedicate fluxurilor cu bani;
- simulare și regression budget pentru fiecare endpoint la fiecare release;
- ABI și payload backward-compatible în fereastra de migrare.

Fiecare endpoint are `gas_budget_baseline`, `gas_budget_max` și alertă la regresie
de peste 10%. Un PR care depășește capul fără decizie de arhitectură nu poate fi
merge-uit.

## 6. UX cu cost minim

Pentru o utilizare normală, utilizatorul nu plătește separat fiecare like,
comentariu, review sau mesaj. Fluxul este:

1. wallet-ul autorizează o capability de sesiune limitată;
2. dispozitivul semnează acțiunea fără popup repetitiv;
3. Nexus sponsorizează tranzacția din `Gas Pool` în limita fair-use;
4. UI arată costul `0 pentru tine` și statusul verificabil;
5. la abuz sau cotă epuizată, aplicația oferă cooldown, plan premium cu cotă sau
   gas plătit explicit de utilizator; acțiunea nu este taxată pe ascuns.

Politica recomandată:

| Segment | Sponsorizare |
|---|---|
| cont nou verificat | onboarding + cotă zilnică mică |
| utilizator normal | toate acțiunile sociale în fair-use |
| safety/recovery | întotdeauna sponsorizat în limite anti-abuz |
| seller/business plătitor | inclusă în abonament/campanie |
| creator/artist/educator | inclusă proporțional cu venitul produs |
| automatizări/API | plan B2B, rate și buget contractual |
| Agent Network | gas separat inclus în task/API fee; fără quota umană |
| comportament Sybil/spam | throttling, proof/verification, fără sponsorizare |

Nexus nu promite gasless nelimitat. Costul gas este variabil, iar treasury-ul are
cap zilnic per shard și un reserve minimum.

## 7. Buget și profit modest

Unit economics se măsoară pe `Weekly Monetized Participant`, nu pe download.

```text
Net Revenue
  = comisioane + abonamente + promovare + servicii B2B + music premium
    - TVA/taxe colectate - refunds - partner/app-store/payment shares

Contribution Margin
  = Net Revenue
    - gas sponsorizat - media/CDN - maps/routing - moderation variabilă
    - verificări - royalty expense - fraud/dispute loss
```

Guardrails recomandate pentru pilot:

- gas sponsorizat: țintă sub 5% din venitul net și hard cap 8%; dacă produsul nu
  monetizează încă, este buget de achiziție plafonat, nu datorie deschisă;
- media/CDN: target sub 15% din venitul verticalei Social/Music la scară;
- fraudă/refund/dispute loss: reserve separat și limite valorice;
- contribution margin: minimum 15% în pilot după costurile variabile și 25–35%
  după atingerea unei cohorte stabile;
- minimum 3 luni de gas + media reserve înainte de rollout public;
- niciun fee nu se modifică pentru o tranzacție deja finanțată;
- fiecare preț arată moneda, echivalentul orientativ, fee-ul Nexus, gas-ul și
  payout-ul celeilalte părți înainte de semnare.

Profitul nu este garantat de arhitectură. Gate-ul comercial cere LTV/CAC, retenție,
cost per minute streamed, gas/WMP și loss/GMV măsurate pe cohorta pilot.

## 8. Surse de venit prioritizate

1. pagini Business Pro și instrumente de programări;
2. promovări etichetate pentru anunțuri, servicii, postări, muzică și cursuri;
3. fee numai pentru tranzacții protejate/escrow, nu pentru simplul contact OLX-like;
4. Travel, appointments și Mobility cu comision transparent;
5. creator/artist subscriptions și music premium;
6. recruiter, analytics și team seats B2B;
7. verificări la cost + marjă mică, fără vânzarea reputației.

Ordinea minimizează dependența de un token și permite ca venitul B2B să plătească
gas-ul social al utilizatorilor.

## 9. Testare Supernova și release gates

Înainte de activarea `SUPERNOVA`:

- test vectors pentru ordered vs executed și failure după includere;
- shadow indexing minimum două săptămâni fără diferențe financiare;
- test la upgrade epoch, restart, gateway inconsistent și provider timeout;
- 10× și 100× burst pe Action Relay, cu backpressure și treasury breaker;
- cross-shard flows și callbacks verificate pe stări intermediare;
- re-submit test: nicio dublare de action, order, booking sau payout;
- contract timeouts testate fără presupuneri de block duration;
- chaos test pentru indexer lag și rezultat de execuție întârziat;
- rollback la adaptor compatibil fără pierderea intențiilor;
- audit de securitate pentru orice schimbare de ABI sau nonce/capability logic.

Release-ul public rămâne blocat dacă mainnet capability nu este confirmată,
execution result nu poate fi reconciliat sau costul sponsorizării depășește capul
pentru trei zile consecutive fără explicație și remediere.

## 10. Ce nu se schimbă prin Supernova

- blockchain-ul rămâne public; commitments nu fac automat anonime datele;
- PII, locația, sănătatea, dating target și chat plaintext rămân off-chain;
- tranzacțiile financiare cer wallet confirmation explicită;
- auditul independent al contractelor cu fonduri rămâne obligatoriu;
- licențele, autorizările, DSA/GDPR, protecția consumatorului și obligațiile fiscale
  nu devin opționale;
- SOS, moderarea și suportul nu depind de finalitatea blockchain-ului;
- Supernova nu este o justificare pentru a lansa simultan toate verticalele.
