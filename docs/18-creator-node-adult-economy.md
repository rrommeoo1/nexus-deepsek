# Economia creatorilor, nodurilor și Nexus Privé

Status: specificație normativă inițială pentru `NX-ECON-P01`  
Data evaluării: 2026-08-09  
Aplicabilitate: worldwide, cu activare `default_deny` per țară și canal de distribuție

## 1. Decizii obligatorii

1. `Like`, comment, follow și share rămân acțiuni sociale gratuite. Fiecare acțiune
   terminală are propria tranzacție MultiversX, dar nu produce o sumă fixă de bani.
2. `$ Support` este un control separat, voluntar, cu suma și split-ul afișate înainte
   de semnare. Plata nu cumpără reach organic, badge de încredere ori decizie de safety.
3. Creatorii primesc tips/subscriptions și un fond periodic finanțat numai din venit
   eligibil realizat. Like-urile și comentariile pot contribui la un scor calificat,
   nu generează datorie directă a treasury-ului.
4. Operatorii Nexus Node sunt plătiți pentru serviciu util verificat, nu pentru node
   count, stake simplu, trafic auto-raportat, recrutare ori engagement brut.
5. Validatorii MultiversX și Nexus Nodes sunt roluri diferite. Nexus nu redirecționează
   și nu promite rewardurile protocolului MultiversX.
6. Nexus nu emite un token transferabil în MVP/Phase 2. Settlement-ul folosește EGLD
   și ESDT-uri aprobate; points și Gas Credits sunt netransferabile.
7. `Nexus Privé` este produs 18+ separat, în primul rând web, fără previews explicite
   în aplicațiile mobile generale și fără media explicită în IPFS public.

## 2. De ce nu plătim o sumă fixă la fiecare like sau comment

Un payout fix transformă instant like-ul în țintă Sybil. Costul crește cu boți, nu cu
venitul; comentariile devin spam, iar platforma acumulează datorii chiar la venit zero.
Blockchain-ul ar face frauda mai vizibilă, dar nu ar face modelul solvabil.

Separăm trei evenimente:

| Eveniment | Cost utilizator | Efect creator | Efect ranking |
|---|---:|---|---|
| `Like` | 0 în cotă; gas sponsorizat ori pending | semnal calificabil | numai organic, după anti-fraudă |
| `Comment` | 0 în cotă; gas sponsorizat ori pending | semnal de calitate, nu payout direct | organic, cu spam/quality weight |
| `$ Support` | sumă aleasă + cost afișat | payout financiar explicit | numai top Supporters, niciodată organic |

Rezultatul dorit de owner este păstrat: creatorul beneficiază de engagement, dar cel
care apasă Like nu este taxat și nu este blocat din restul aplicației.

## 3. Lifecycle pentru acțiunile on-chain gratuite

```text
tap Like/Comment
  → verificare locală de rate, capability și buget
  → SPONSORED_READY | PENDING_SPONSORSHIP | USER_PAYS_GAS
  → o tranzacție distinctă prin relayer ori wallet
  → ORDERED → EXECUTED_SUCCESS | FAILED_TERMINAL
  → reducer/indexer confirmă numărătoarea și eligibilitatea
```

- `PENDING_SPONSORSHIP` nu blochează feedul, chatul sau navigarea; acțiunea poate fi
  anulată, trimisă când se reface bugetul sau semnată imediat cu gas plătit de user.
- Numai `EXECUTED_SUCCESS` intră în contor public și în qualified engagement.
- Safety actions (`report`, `block`, `revoke`) și plățile au prioritate peste comments
  și likes când bugetul relayer-ului este aproape de cap.
- Cota zilnică este per account/device/risk cluster, nu doar per wallet nou.
- Gas sponsorizat: țintă sub 5% din venitul net eligibil, hard cap 8%, plus cap zilnic
  absolut. La venit zero există numai un buget de achiziție explicit și limitat.
- Decizia consumă un snapshot de buget semnat și versionat, legat de epoch, config hash,
  venit eligibil și spend curent; targetul și hard cap-ul sunt calculate în policy,
  niciodată acceptate drept „remaining budget” declarat de client. Prioritățile
  necunoscute sunt refuzate, iar safety/financial pot folosi numai zona 5–8%.
- Supernova reduce latența/capacitatea, dar nu este tratat drept gas gratuit. Limitele
  se recalibrează numai după benchmark și economics confirmate pe rețeaua activă.

## 4. `$ Support`, tips și subscriptions

### 4.1 Baza de calcul

`Net Support = Gross - indirect taxes - mandatory rail/store fees - refunds/chargebacks`

UI arată Gross, fiecare deducere, suma creatorului, fee-ul Nexus și moneda înainte de
semnare. Niciun procent nu este schimbat retroactiv pentru o plată deja autorizată.

### 4.2 Split-uri inițiale configurabile, cu hard cap

| Produs | Creator | Nexus gross fee | Safety/dispute reserve | Infra/relayer |
|---|---:|---:|---:|---:|
| Tip direct Core | 90% | 5% | 3% | 2% |
| Subscription Core | 85% | 10% | 3% | 2% |
| Privé subscription/PPV/tip | 80% | 12% | 5% | 3% |

Aceste procente se aplică la `Net Support`. Sunt parametri de pilot, nu promisiuni
permanente; orice schimbare viitoare are versiune, effective date, country pack și
acceptare înaintea unei noi plăți. Pentru creatori cu risc și chargeback demonstrabil
mai mic poate exista tier de creator mai bun, dar niciodată un split ascuns.

`Nexus gross fee` nu înseamnă profit net. Din el se plătesc costuri fixe, personal,
audit, asigurare, taxe ale companiei și pierderi neacoperite. Gate-ul financiar este:

- contribution margin minim 15% în pilot după costurile variabile;
- țintă 25–35% numai după scalare și măsurare;
- payout hold 7–14 zile configurabil pentru chargeback/fraudă, conform țării;
- reserve-ul nefolosit se reconciliază; nu este venit mascat.

## 5. Creator Fund — recompensa indirectă pentru engagement

La fiecare epoch:

`CreatorPool = min(PoolCap, 15% × EligibleNetPlatformRevenue)`

La venit eligibil zero, pool-ul este zero, cu excepția unei campanii promoționale cu
buget prefinanțat. Nu se creează token și nu se promite o sumă per acțiune.

Scorul creatorului este:

`QEUᵢ = Σ qualified_event_weight × human_trust × originality × safety × retention`

Controale:

- unique-human și minimum watch threshold pentru view;
- limită per supporter/device/wallet cluster și per creator;
- self-engagement, exchange rings, purchased traffic și `SYSTEM_TEST` au weight zero;
- commentul contează numai după filtre spam/duplicate/abuse și semnale de calitate;
- reports confirmate, copyright și content safety pot reduce eligibilitatea;
- max 5% din pool per creator/epoch în pilot, pentru reducerea concentrării;
- drept de explicație agregată și apel, fără expunerea detectorului anti-fraudă;
- total claims + reserve + remainder trebuie să fie exact egal cu pool-ul finanțat.

Payout:

`Payoutᵢ = min(CreatorCapᵢ, CreatorPool × QEUᵢ / ΣQEU)`

Se publică un Merkle root al distribuției și fiecare claim este one-time. Datele brute,
viewerii, istoricul privat și motivele sensibile rămân off-chain.

Boundary-ul executabil folosește numai snapshot-uri canonice, versionate și semnate.
`creatorId`, `NodeID` și `ownerCluster` nu sunt autorități: cap-urile se agregă după
principalul uman/owner și clusterul de risc din atestare. Configurația este copiată și
deep-frozen, iar câmpurile lipsă, suplimentare, accessors, tipurile ambigue și enum-urile
necunoscute sunt refuzate. Limitele pilot QEU sunt 100 per supporter, 250 per device
cluster și 200 per wallet cluster; modificarea lor cere config nou, hash nou și review.
Hashul configurației este acceptat numai dacă întregul conținut coincide cu snapshot-ul
allowlisted; aceeași valoare de hash nu poate fi reutilizată cu alte procente. Fiecare
calcul verifică fereastra `effectiveAt/expiresAt`, iar rezultatul include epoch-ul,
effective date, contract version și config hash.

## 6. Topuri care nu corup feedul

Nexus afișează topuri distincte:

- `Organic`: qualified human reach, retention, originality și safety;
- `Most Supported`: net tips/subscriptions, cu opt-out și cap anti-whale;
- `Rising`: creștere în unique supporters și retenție, nu suma totală;
- `Promoted`: inventar cumpărat, etichetat permanent;
- `Node Quality`: availability, retrieval și conformance, fără legătură cu creatorii.

Nicio plată, tip, boost ori subscription nu intră în scorul Organic. Trafi­cul de test,
agenții și bot accounts sunt separat etichetați și au impact economic/organic zero.

## 7. Unde stăm clipurile și pozele

Fișierele nu sunt stocate în blockchain. MultiversX păstrează numai starea economică,
ownership/capabilities, hashes/commitments, badge-uri, receipts și settlement.

### 7.1 Clase de stocare

| Clasă | Stocare | Exemple | Ștergere |
|---|---|---|---|
| Public permanent, opt-in | IPFS/contract storage deal | media declarată „pin forever”, manifests publice | global nu poate fi garantată |
| Public revocabil, implicit | obiecte/segmente criptate pe Nexus Storage Nodes | Clips, Watch, marketplace | revoke keys + tombstone + purge receipts |
| Privat | E2EE înainte de upload; ciphertext shards | Chat, Dating, drafts, locație | key revoke + retention/purge |
| Privé 18+ | revocabil criptat, tenant și keys separate | media matură, PPV, live replay | fără IPFS public; purge + legal hold minim |
| Kids | tenant separat, catalog semnat | conținut aprobat | retention parental/country policy |

### 7.2 Creșterea de la un nod la mii

- `N=1`: Genesis Node păstrează origin, renditions și index; backup/restore obligatoriu.
- `N=2–7`: `R=min(N,3)`, anti-entropy și replicare completă/segmentată.
- `N≥8`: placement pe shards, failure-domain diversity și repair automat.
- La scară: erasure coding pentru public revocabil și edge cache regional.
- Edge nodes primesc segments/ciphertext și chei scurte de playback, nu cheia master.
- Dating, Chat, Kids și Privé nu intră în DHT/index public și nu expun metadata topic.

Un creator poate alege public permanent numai după un warning explicit că terți pot
repina. Valoarea implicită pentru orice conținut ce trebuie retras este revocabilă.

## 8. Cum sunt plătiți cei care țin Nexus în funcțiune

### 8.1 Separarea rolurilor

- Validator MultiversX: participă la consens după regulile/stake-ul MultiversX și
  primește rewarduri direct de la protocol.
- Observer MultiversX: ajută la acces/sync, dar nu primește reward de consens.
- Nexus Node: storage, edge, transcode, relay, index, Matrix/home ori live; rewardul
  este de la economia Nexus, fără obligația de a fi validator MultiversX.

Join-ul la Nexus Node poate fi gratuit și fără wallet. Wallet-ul este cerut numai
pentru claim. Serviciile voluntare funcționează și când reward pool-ul este zero.

### 8.2 Proof of useful service

`EligibleNodeValue = CappedUnitPrice × VerifiedUnits × Availability × Quality × Diversity`

unde factorii sunt între 0 și 1, iar `VerifiedUnits` provin din receipts/challenges:

- storage: GiB-lună eligibil + possession și random retrieval probes;
- edge: bytes/minute deduplicate, confirmate prin probe independente;
- transcode: frames/pixels/profile, manifest și sampled output verification;
- live: ingest/rendition/delivery minute și SLA verificat;
- index: availability, freshness și relevance tests, fără pay-per-rank;
- relay/home: delivery availability sau plan, niciodată citirea mesajelor.

`NodePool = min(VerifiedNodeValue, NodeTreasuryCap, 10% × EligibleNetPlatformRevenue)`

Pentru servicii plătite direct de client/creator, nodul primește valoarea serviciului
minus un orchestration/protocol fee Nexus de 5–12%; default pilot 8%. Pentru servicii
gratuite, NodePool-ul poate proveni numai din buget prefinanțat ori venit realizat.

Settlement-ul este periodic după epoch/prag, folosind receipts agregate și Merkle
claims. Nu există tx per HLS segment, packet sau secundă CPU.

Fiecare claim consumă persistent cheia `(allocationId, epochId, principalId)` înainte
de payout. Ledgerul păstrează separat `available`, `outstanding`, `paid` și `reversed`;
replay-ul după restore este refuzat. Taxele, rail/store fees, refundurile și
chargeback-urile sunt linii tipizate cu receipt și stare. Numai suma contestată poate
fi `FROZEN`; release/reversal păstrează exact egalitatea cu pool-ul finanțat.
Referința locală folosește un store atomic cu snapshot/restore, reutilizabil de instanțe
noi; adaptorul distribuit de producție trebuie certificat separat prin constrângere
unică/transactional CAS și crash-recovery înainte de fonduri reale.

### 8.3 Anti-fraudă și concentrare

- canary job și capability benchmark înainte de trafic/reward;
- minimum două surse de receipt/probe pentru unități cu valoare materială;
- caps per NodeID, wallet, owner cluster, ASN, cloud, country și service class;
- diversity discount când un cluster depășește concentrarea țintă;
- bond/cooldown numai pentru servicii plătite cu risc material;
- invalid proof/equivocation/fraudă demonstrată: freeze, dispute și eventual slashing;
- downtime/QoS slab: mai puține joburi/plată, nu confiscare arbitrară;
- one-claim invariant și reconciliere exactă pool = claims + reserve + remainder.

## 9. Nexus Privé — produs adult separat

### 9.1 Poziționare

Privé este rețea de creatori adulți, nu piață de servicii sexuale. Sunt permise numai
subscriptions, PPV, tips, bundles și live după gates. Sunt interzise escort, trafficking,
conținut cu minori, non-consensual intimate imagery, impersonare/deepfake sexual fără
consimțământ și orice conținut ilegal în țara relevantă.

### 9.2 Gates obligatorii

- viewer: 18+ age assurance înainte de catalog explicit;
- creator și fiecare performer: identity + age + liveness/verificare aprobată;
- per asset: consimțământ semnat, rights, allowed uses, territory, expiry și revocare;
- moderation automată + umană înainte de publicare, nu numai după report;
- complaint/takedown/appeal, emergency containment și evidence legal hold minim;
- hash matching/CSAM escalation, NCII și deepfake controls;
- AML/sanctions/tax/reporting și payment-provider approval per țară;
- Country Capability Matrix `DENY` implicit; activare numai cu legal memo și provider.

Wallet login nu substituie verificarea de vârstă/identitate și nu elimină obligațiile
operatorului. Analiza Nexus pregătește controalele; opinia juridică formală, auditul și
acceptarea de către payment/acquirer rămân gates externe.

Fiecare quote și settlement Privé cere o capabilitate semnată, neexpirată, legată de
creator/viewer, asset și generație, manifest criptat, entitlement, quote și expirarea
sa, settlement, tokenul exact, toate spliturile, fee-schedule version, țară, policy
version, canalul `WEB`, operație și command expiry. Orice gate absent, fals,
substituit ori expirat produce `DENY`; verificarea nu este doar metadata descriptivă.

### 9.3 Distribuție

Apple interzice materialul pornografic/overtly sexual în App Store, iar Google Play
interzice aplicațiile destinate pornografiei sau gratificării sexuale. De aceea:

- Privé explicit este web/PWA separat, cu hostname, tenant, policy și analytics separate;
- aplicația Nexus generală nu afișează previews, search results ori deep links explicite;
- un wrapper mobil separat se evaluează numai dacă policy și country pack permit;
- plata web nu încearcă să ocolească reguli contractuale deja acceptate.

### 9.4 Privacy și blockchain

Nu ajung în clar on-chain: titlu/thumb explicit, identitatea creatorului/viewerului,
subscription graph, performer data, targetul unui tip privat ori entitlementul exact.
Chain-ul primește action class generic, commitments opace și settlement. Chiar și suma
și timing-ul pot permite corelare; relayer/settlement pooling și intervalele periodice
reduc, dar nu elimină complet acest risc. UI nu promite „anonimat perfect”.

### 9.5 Catalog, camere și motor de creștere

Privé are un feed `Free Discovery` pentru clipuri și imagini erotice gratuite, dar
„gratuit” înseamnă numai că nu există paywall: age assurance, country policy,
consimțământul performerilor, moderarea și drepturile rămân obligatorii. Acest feed nu
produce preview-uri explicite, rezultate de căutare sau deep-link-uri în Nexus Core,
Kids ori în distribuțiile mobile-store.

Creatorul poate combina `Subscription`, `PPV`, `Tip`, `Bundle`, `Paid Live` și
`Paid 1:1 Call`. Camerele 1:1 folosesc un preauthorization/escrow single-use la
deschidere, legat de payer, payee, sesiune, token, tarif, plafon, policy/fee version și
expirare, cu cronometru vizibil, metering receipts semnate și oprire automată când
expiră timpul sau soldul autorizat. Înregistrarea este oprită implicit și cere câte un
receipt curent pentru fiecare participant, legat de participant, device, sesiune,
scopul explicit `SESSION_RECORDING`, generație, nonce și expiry/revocation. Produsul
nu facilitează escort, întâlniri sexuale plătite sau servicii sexuale off-platform.

Splitul de pornire pentru conținut este 80% creator, 12% Nexus, 5% costuri provider și
3% reserve/chargeback; pentru tips, ținta este 90% / 5% / 2% / 3%. Country Pack-ul și
costurile reale pot reduce sau reconfigura splitul înainte de lansare, iar UI arată
întotdeauna prețul, taxa și suma netă estimată înainte de confirmare. Creatorul stabilește
prețul în limitele locale, fără promisiuni de venit garantat.

Creator referrals pot primi temporar o parte din taxa netă Nexus sau dintr-un buget
explicit de marketing după o activare umană calificată, inclusiv o activare eligibilă
în alt modul Nexus. Reward-ul nu se ia din brutul creatorului fără consimțământ, nu are
niveluri de recrutare, nu plătește followeri, conturi sintetice sau simple instalări și
nu influențează organic ranking. Astfel Privé poate alimenta adopția întregii rețele fără
a deveni schemă piramidală ori piață de engagement fals.

## 10. Invariants și kill switches

Pentru orice epoch:

1. `TreasuryClosing = Opening + RealizedRevenue - ConfirmedPayouts - Costs - Reserves ≥ 0`.
2. Creator claims nu depășesc CreatorPool finanțat.
3. Node claims nu depășesc NodePool finanțat.
4. Fiecare claim este unic și liability ledger se reconciliază exact.
5. `SYSTEM_TEST`, AGENT neeligibil și invalid traffic au payout/ranking/review impact zero.
6. Paid support și promoted inventory au organic contribution zero.
7. Gas hard cap oprește sponsorship nou, nu report/block/revoke ori accesul la sold.
8. Fraud/chargeback freeze afectează suma contestată, nu întregul wallet arbitrar.
9. Adult/Kids/private data nu intră în public IPFS, public DHT ori global search.
10. La lipsa Country Pack, provider approval sau age/consent proof, funcția este `DENY`.

Kill switches independente: `sponsorship_enabled`, `creator_pool_enabled`,
`node_rewards_enabled`, `tips_enabled`, `subscriptions_enabled`, `prive_country_enabled`,
`uploads_enabled`, `playback_enabled`. Oprirea monetizării nu blochează exportul, safety
actions, dispute, refund ori retragerea soldurilor legal disponibile.

## 11. Simulările cerute înainte de pilot

- venit zero și engagement în creștere;
- gas EGLD ×2, ×5 și congestie per shard;
- 1%, 10% și 40% trafic invalid/Sybil;
- creator dominant și supporter whale;
- chargeback 1%, 5%, 15% pe Core și Privé;
- node cluster 15%, 30%, 60% din capacity;
- storage loss, under-replication și probe frauduloase;
- payment/acquirer outage și country kill;
- CreatorPool/NodePool cu remainder, caps și claims concurente;
- payout currency volatility și insufficient reserve.

Pilotul nu pornește dacă există treasury negativ, liability mismatch, paid-to-organic
leakage, payout pentru actor sintetic, claim dublu ori funcție adult activă fără gate.

## 12. Surse și gates externe

- [MultiversX Validators Overview](https://docs.multiversx.com/validators/overview/)
- [MultiversX Relayed Transactions v3](https://docs.multiversx.com/developers/relayed-transactions/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Inappropriate Content](https://support.google.com/googleplay/android-developer/answer/9878810?hl=en)
- [EU privacy-preserving age-verification blueprint](https://digital-strategy.ec.europa.eu/en/factpages/blueprint-age-verification-solution-help-protect-minors-online)
- [Ofcom age assurance for pornography](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-pornography)
- [US DOJ 18 U.S.C. §§ 2257/2257A certifications](https://www.justice.gov/criminal/criminal-ceos/18-usc-2257-2257a-certifications)
- [NCMEC CyberTipline and reporting role](https://www.missingkids.org/ourwork/impact?embed=true)
- [Mastercard Specialty Merchant Registration Requirements](https://www.mastercard.com/content/dam/public/mastercardcom/na/global-site/documents/SPME-Manual.pdf)

Sursele sunt puncte de control, nu o opinie juridică mondială. Launch-ul se face pe
Country Packs și canale aprobate, cu audit financiar/security și consiliere juridică
externă înainte de bani reali ori conținut real.
