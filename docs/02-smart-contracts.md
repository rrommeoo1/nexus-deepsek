# Smart contracts MultiversX

Specificația detaliată și sursele oficiale sunt în
[`research-multiversx.md`](research-multiversx.md). Acest document este contractul
normativ pentru implementare.

## 1. Pachetul de contracte

```text
nexus-actions × shard      action ledger: o tranzacție per mutație
nexus-profile-registry   control minim și commitments de profil
nexus-agent-registry     agenți, controllers, manifests și capability roots
nexus-reputation         attestations și rezultate verificabile
nexus-marketplace        escrow pentru bunuri
nexus-booking            escrow pentru stays/experiences
nexus-ride               escrow pentru curse Mobility
nexus-appointments       sloturi și escrow pentru servicii locale
nexus-badge-factory      badge-uri și tickets NFT/SFT
nexus-tipping            tips și revenue splits
nexus-royalties          statements și claims pentru drepturi muzicale
```

`nexus-private-proof-registry` rămâne experimental P3 pentru dovezi ZK. În schimb,
like-urile, comentariile, swipe-urile și mesajele au din MVP tranzacții distincte
în `nexus-actions`; pentru cele private se publică numai commitments generice.

Toate contractele sunt Rust `no_std`, construite cu versiuni pin-uite ale
framework-ului stabil MultiversX, au crate `meta`, ABI, reproducible build,
scenario tests și TypeScript bindings generate din ABI.

## 2. Tipuri comune

```rust
type EntityId = u64;
type Timestamp = u64;
type BasisPoints = u16;       // 0..=10_000
type Hash32 = ManagedByteArray<Self::Api, 32>;

struct PaymentKey {
  token_identifier: EgldOrEsdtTokenIdentifier,
  token_nonce: u64,
}

enum OperationalStatus { Active, PausedNewActions, Emergency }
```

Reguli:

- bani în unități minime `BigUint`, fără floating point;
- timestamps Unix UTC și deadline-uri explicite;
- ID-urile off-chain sunt reprezentate prin hash/commitment de 32 bytes;
- fiecare structură persistentă are `schema_version`;
- niciun endpoint nu iterează peste colecții neplafonate;
- exact un payment permis per acțiune, exceptând endpoint-uri explicit batch;
- views sunt punctuale; indexarea și paginarea sunt off-chain.

## 2A. `nexus-actions` — Action Ledger per shard

Se deployează câte o instanță în fiecare execution shard. Scopul este ca orice
mutație socială/comercială nefinanciară să fie o tranzacție MultiversX, fără popup
wallet la fiecare tap și fără storage nelimitat pentru fiecare like.

```text
SessionCapability {
  controller, actor_kind, actor_commitment, session_public_key,
  scope_bits, max_actions, used_actions, valid_from, expires_at,
  last_action_nonce, state
}

ActionEnvelope {
  version, actor_kind, actor_commitment, action_type, object_commitment,
  payload_hash_or_cid, visibility_class, action_nonce,
  issued_at, expires_at, session_public_key
}
```

Endpoints:

- `registerCapability(actorKind, actorCommitment, sessionKey, scopes, maxActions, expiry)` —
  caller wallet, tranzacție explicită;
- `revokeCapability(sessionKey)` / `rotateCapability(...)` — caller controller;
- `recordAction(envelope, sessionSignature)` — caller relayer, exact o acțiune;
- `recordPrivateAction(genericCommitment, envelope, signature)` — fără target/type
  sensibil în clar;
- `pauseActionType(type)` și `pauseRelayer(address)` cu roluri limitate.

Verificări `recordAction`:

1. capability activă, neexpirată și scope pentru action class;
2. `issued_at/expires_at`, network/domain separator și contract address corecte;
3. nonce strict și action count sub limită;
4. hash canonic al envelope-ului;
5. semnătură Ed25519 verificată prin MultiversX Crypto API;
6. relayer allowlisted și privacy class validă;
7. emitere `ActionRecorded` cu commitments compacte.

Contractul păstrează capability, nonce și limite, nu o mapare pentru fiecare
acțiune. Envelope-ul este în transaction data, iar event-ul facilitează indexarea.
Read models (`likes`, `comments`, `follows`, listings, messages status) sunt reduse
off-chain din acțiuni și pot fi reconstruite. `unlike`, edit și delete sunt acțiuni
noi/tombstones; istoricul nu dispare.

Tipuri publice: `POST_CREATE`, `POST_EDIT`, `LIKE`, `UNLIKE`, `COMMENT_CREATE`,
`COMMENT_EDIT`, `COMMENT_TOMBSTONE`, `FOLLOW`, `UNFOLLOW`, `SAVE`, `SHARE`,
`LISTING_CREATE`, `LISTING_UPDATE`, `LISTING_RENEW`, `LISTING_CLOSE`, `OFFER`,
`REVIEW`, `JOB_POST`, `CONNECT`, `VIDEO_PUBLISH`, `CHANNEL_SUBSCRIBE`,
`PLAYLIST_MUTATE`, `LIVE_START`, `LIVE_END`, `LIVE_CHAT_MESSAGE`.

Tipurile sensibile sunt mascate on-chain ca `PRIVATE_ACTION` și diferențiate numai
în payload-ul criptat: message, Dating swipe/match/unmatch, report/evidence și
anumite aplicații Work. Un commitment are salt aleator puternic; hashing-ul unui
target predictibil fără salt este interzis.

Invariant: un `action_nonce` este acceptat o singură dată, relayer-ul nu poate
forja semnătura session key, capability nu poate crește scope/expiry singură și
endpoint-ul nu acceptă batch. Fiecare apel corespunde unei singure acțiuni.

`nexus-actions` refuză `actor_kind=CHILD`. Kids history/search/favorite/feedback
nu sunt ancorate individual; un adult poate semna numai un commitment generic de
consimțământ/purchase fără child identifier. Rights, payout și statements pentru
creatorii conținutului Kids folosesc contractele adulte normale.

## 3. `nexus-profile-registry`

### Date on-chain

```text
ProfileAnchor {
  id, controller, kind_code, manifest_hash, version,
  status, created_at, updated_at
}
```

`kind_code` poate ascunde tipul Dating printr-un cod generic/private anchor. Nu se
stochează nume, bio, avatar, CV, locație, preferences sau mapping-ul complet al
profilurilor unui wallet în UI.
Child profile nu este `ProfileAnchor`, nu are controller wallet și există numai în
Family/Kids tenant off-chain.

### Endpoints

- `createProfile(kindCode, manifestHash, actionId)`;
- `updateManifest(profileId, expectedVersion, newHash, actionId)`;
- `deactivateProfile(profileId, actionId)`;
- `requestLink(profileA, profileB, commitment)`;
- `acceptLink(linkId)` / `unlink(linkId)`;
- `setDelegate(profileId, address, permissionBits)`;
- `proposeControllerTransfer(profileId, newController)`;
- `acceptControllerTransfer(profileId)`.

### Invariante

- numai controller/delegate autorizat mută anchor-ul;
- versiunea crește monoton;
- linkarea cere acordul ambelor profiluri;
- transferul controller-ului nu mută tokenuri din wallet;
- `actionId` nu poate fi aplicat de două ori.

## 3A. `nexus-agent-registry`

Registrul nu execută modelul AI. El dovedește controller-ul, wallet-ul agentului,
clasa, manifest hash, capability root și statusul. Agentul este distinct de un
profil uman și evenimentele sale includ `actor_kind=AGENT`.

```text
AgentAnchor {
  agent_id, controller, agent_wallet, class_code,
  manifest_hash, capability_root, version,
  status, registered_at, updated_at
}
```

Endpoints: `registerAgent`, `updateManifest`, `setCapabilityRoot`, `suspendAgent`,
`reactivateAgent`, `proposeControllerTransfer`, `acceptControllerTransfer`,
`revokeAgent`. Transferul este în doi pași; revocarea terminală nu șterge istoricul.
Numai contractele autorizate pot înregistra task outcomes în reputation.

Invariante:

- `agent_wallet` nu poate fi legat simultan de doi controllers activi fără schemă
  explicită multi-tenant;
- un agent suspendat/revocat nu poate autoriza acțiuni noi;
- capability root are expiry și nu poate extinde permisiunile controller-ului;
- financial endpoints validează allowance separat; registry status nu transferă bani;
- `SYSTEM_TEST` este refuzat pe mainnet public în afara canary allowlist.

## 4. `nexus-reputation`

Reputația este o colecție de afirmații pe domenii, nu un număr universal.

```text
Attestation {
  id, subject_hash, domain, schema_id, claim_hash, issuer,
  issued_at, expires_at, revoked_at?, source_action_hash?
}
```

Endpoints: `issueAttestation`, `revokeAttestation`, `recordOutcome`,
`setIssuerForSchema`, `pauseSchema`. `recordOutcome` acceptă numai apeluri de la
contractele Marketplace/Booking/Ride/Appointment și issuerii Dating autorizați și
deduplică `sourceActionHash`.

Textul review-ului, rating breakdown, dating safety data și probele rămân
off-chain. Un client validează issuer, schemă, expirare și revocare; posesia unui
NFT singură nu dovedește o verificare curentă.

Dating acceptă numai claims compacte precum `adult_verified`, `photo_match`,
`recent_liveness` și outcomes `meeting_confirmed/no_show_after_appeal`. Nu stochează
gender, orientation, match, location, victim/report target sau un scor scalar.
Pulse publică post/note actions prin `nexus-actions`; alias mapping-ul nu intră în
contract, iar `actor_kind=AGENT` nu poate vota Community Context.
Clips/Watch/Live publică numai manifest/action commitments; video bytes, watch
history, viewer identity, live packets și recommendation features nu intră on-chain.

## 5. `nexus-marketplace`

Catalogul complet este off-chain/IPFS, dar create/update/renew/close pentru fiecare
anunț sunt tranzacții `nexus-actions` cu manifest hash/CID. Escrow-ul începe când
buyer-ul finanțează o comandă și îngheață hash-ul listării și al termenilor.

```text
FUNDED → ACCEPTED → FULFILLED → RELEASED
   ├──────────────→ REFUNDED
   ├──────────────→ EXPIRED
   └──────────────→ DISPUTED → RESOLVED
```

### Snapshot order

```text
OrderEscrow {
  id, listing_hash, buyer, seller, payment_key,
  principal, platform_fee_bps, terms_hash,
  accept_by, fulfil_by, auto_release_at, state
}
```

### Endpoints

- `fundOrder(...)` payable;
- `sellerAccept`, `sellerDecline`;
- `markFulfilled(fulfilmentCommitment)`;
- `buyerAccept`;
- `cancelBeforeAccept`, `claimAfterDeadline`;
- `openDispute(evidenceCommitment)`;
- `resolveDispute(buyerBps, sellerBps, resolutionHash)`;
- `withdraw(paymentKey)`.

### Invariante financiare

- `balance(contract, token) >= total_liability(token)`;
- principalul unei comenzi este alocat exact o dată;
- buyer share + seller share + fee este egal cu suma finanțată;
- fee-ul aplicat este cel din snapshot și sub hard cap;
- stările terminale nu redevin active;
- payout-ul este pull-based și un transfer eșuat nu blochează alte conturi.

## 6. `nexus-booking`

Booking are contract separat deoarece calendarul, anulările, no-show și
settlement-ul etapizat sunt diferite de vânzarea unui bun.

```text
REQUESTED/FUNDED → CONFIRMED → IN_PROGRESS → COMPLETED → RELEASED
       ├────────→ DECLINED/REFUNDED
       ├────────→ CANCELLED/PARTIAL_REFUND
       ├────────→ NO_SHOW
       └────────→ DISPUTED → RESOLVED
```

Snapshot-ul include listing hash, host/guest, interval, guests, token, total,
deposit, cancellation policy hash, fee și deadline-uri. Contractul ține o
protecție compactă pentru inventarul rezervat (`listing_key + bounded day/slot
bucket`); calendarul de căutare rămâne off-chain și este reconciliat.

Endpoints: `requestBooking`, `acceptBooking`, `declineBooking`, `cancelBooking`,
`markCheckIn`, `claimNoShow`, `completeBooking`, `openDispute`, `resolveDispute`,
`claimTimeout`, `withdraw`.

Contractul nu pretinde că poate observa curățenia, livrarea sau prezența fizică.
Faptele din lumea reală sunt confirmate bilateral ori soluționate prin dispută.

## 6A. `nexus-ride`

Dispatch-ul, traseul și locațiile sunt off-chain. Contractul începe după atribuirea
șoferului și îngheață quote-ul, plata și regulile cursei.

```text
FUNDED → DRIVER_ACCEPTED → STARTED → COMPLETED → RELEASED
   ├───────────────→ RIDER_CANCELLED / DRIVER_CANCELLED / NO_SHOW
   └───────────────→ DISPUTED → RESOLVED
```

```text
RideEscrow {
  id, ride_commitment, rider, driver_payout_address,
  payment_key, authorized_maximum, quoted_fare,
  platform_fee_bps, terms_hash, accept_by, pickup_by,
  completion_window, state
}
```

Endpoints:

- `fundRide(rideCommitment, driver, quoteHash, termsHash, ...)` payable;
- `driverAccept(rideId)` / `driverDecline(rideId)`;
- `confirmStart(rideId, startProofHash)` — PIN-ul nu apare on-chain;
- `submitCompletion(rideId, finalFare, completionHash)`;
- `riderConfirm(rideId)` / `claimAfterCompletionWindow(rideId)`;
- `cancelRide(rideId, reasonCode)` și `claimNoShow` după deadline;
- `openRideDispute(evidenceCommitment)` / `resolveRideDispute(...)`;
- `withdraw(paymentKey)`.

Reguli:

- contractul nu stochează pickup, destination, traseu sau coordonate;
- `finalFare <= authorizedMaximum`; orice depășire cere o nouă autorizare semnată;
- cancellation/no-show split provine din termenii înghețați;
- start/completion proofs sunt commitments; GPS-ul singur nu decide un litigiu;
- numai driver-ul atribuit poate accepta/porni/finaliza;
- rider și driver primesc outcome-uri separate pentru reputația Mobility;
- contractul folosește aceleași invariante de liabilities și pull-withdrawal.

## 6B. `nexus-appointments`

Contractul gestionează numai programările cu depozit/plată protejată. Catalogul,
staff-ul, adresa și calendarul UX rămân off-chain; on-chain există service/staff
commitments, intervalul, policy snapshot și liability.

```text
FUNDED → CONFIRMED → CHECKED_IN → COMPLETED → RELEASED
              ├────→ CANCELLED → REFUNDED/PARTIAL_RELEASE
              ├────→ NO_SHOW → POLICY_SETTLED
              └────→ DISPUTED → RESOLVED
```

Endpoints: `fundAppointment`, `accept`, `rescheduleByConsent`, `cancel`,
`checkInCommitment`, `confirmCompletion`, `markNoShow`, `openDispute`, `resolve`,
`withdraw`. Reschedule cere acordul ambelor părți și un snapshot nou; nu schimbă
retroactiv fee/policy. Intervalele sunt plafonate, iar suprapunerea este prevenită
prin bucket/slot compact pentru staff-ul și resursa angajată.

## 6C. `nexus-royalties`

Contractul nu stabilește drepturi de autor și nu numără stream-uri. Un proces
contractual și antifraud produce periodic un statement Merkle finanțat integral.

Endpoints: `publishStatementRoot`, `fundStatement`, `claim`, `freezeClaim`,
`unfreezeClaim`, `closePeriod`. Un claim cere proof valid și se consumă o singură
dată. Suma claims + liabilities nu depășește fondurile, freeze-ul este limitat la
claim-ul disputat, iar fondurile necontestate rămân retragibile. Split-urile
versionate însumează 10.000 bps.

## 6D. `nexus-node-registry`

Înregistrarea este permissionless: păstrează `node_id`, owner wallet opțional,
capability manifest hash, service roles, protocol range, bond opțional și status.
Un nod public fără rewards poate participa numai prin manifest P2P și nu are nevoie
de tranzacție ori aprobare. Contractul nu stochează IP, PII, dataset ori private
shard assignment în clar.

Endpoints: `registerNode`, `updateCapability`, `bond`, `requestExit`, `finalizeExit`,
`suspendNode`, `submitObjectiveFaultProof`, `setProtocolRange`. Exit are cooldown;
slashing se aplică numai la equivocation, invalid proof/receipt sau fraudă obiectiv
dovedită, nu la moderare/QoS ambiguu.

## 6E. `nexus-service-settlement`

Primește root-uri finanțate pentru epoci de storage, edge, transcode, live, relay și
index. Proprietarul nodului face claim cu Merkle proof; claim-ul se consumă o singură dată,
suma claims nu depășește funding-ul și freeze-ul afectează numai suma contestată.
Raw views, packets, IP, rooms, child IDs și locații nu intră în contract.

## 6F. `nexus-checkpoints`

Păstrează `service_class`, shard, event range, reducer/protocol version, state root și
replica-set commitment. Două roots incompatibile semnate de același node/range pot
forma equivocation proof. Snapshot-ul și event payload-urile rămân off-chain.

Node stake nu autorizează automat un outcome financiar. Contractele Escrow validează
propriile state machines/issuers. Specificația completă este în
[`17-decentralized-node-network.md`](17-decentralized-node-network.md).

## 7. `nexus-badge-factory`

Folosește capabilitățile native ESDT:

- NFT/dynamic token pentru badge unic sau credential public;
- SFT pentru o ediție de bilete;
- NFT pentru ticket/booking unic dacă este necesar.

Atributele publice sunt compacte: schema, subject commitment, issuer, emitere,
expirare, evidence hash și URI de manifest. Nu includ PII.

Endpoints: `mintBadge`, `revokeBadge`, `mintTicket`, `consumeTicket`, `setIssuer`,
`pauseSchema`. Contractul primește numai rolurile ESDT strict necesare. Badge-urile
nu sunt presupuse „soulbound”; validitatea este controlată de registrul de
revocare, iar transferul trebuie restricționat sau tratat ca simplu obiect vizual.

## 8. `nexus-tipping`

- `tip(profileHash, contentHash, splitId)` payable;
- `batchTip(items)` cu număr maxim strict;
- `setPayoutAddress(profileHash, address)` cu autorizare;
- `withdraw(paymentKey)`.

Split-urile sunt versionate, au număr mic de beneficiari și total exact 10.000
bps. Tips nu actualizează on-chain views/likes; evenimentul conține numai
commitments și date financiare necesare.

## 9. Relayers: native v3 și Action Relay

Relayer-ul este un serviciu Nexus separat cu pool de wallet-uri per shard,
deoarece relayer-ul trebuie să fie în shard-ul sender-ului. Flux:

```text
client cere intent → API validează context/risc/cotă → construiește tx
→ user semnează → relayer verifică payload neschimbat și simulează
→ relayer semnează/plătește gas → broadcast → indexer/finality
```

Allowlist-ul cuprinde contract, endpoint, token, valoare maximă și gas maxim.
Există buget per wallet/device/zi, circuit breaker și hot-wallet cap. Nexus nu
sponsorizează arbitrar transferuri; „gasless” nu elimină semnătura utilizatorului.

Acțiunile sociale folosesc un mecanism diferit: relayer-ul este caller-ul protocol,
iar `nexus-actions` verifică semnătura cheii de sesiune în payload. Astfel wallet-ul
nu semnează o tranzacție protocol la fiecare like, dar fiecare like rămâne un tx
MultiversX individual și cryptographically attributable capability-ului autorizat.

```text
device semnează envelope → Action Relay validează și simulează
→ relayer wallet trimite recordAction → contract verifică session signature
→ ActionRecorded → reducer confirmă optimistic state
```

Pool-urile, cozile și nonce-urile sunt separate pe shard. Rate limits se aplică pe
wallet/account/profile/session/device/IP/risk. Când sponsorship quota este epuizată,
clientul poate cere o tranzacție directă plătită de utilizator sau poate aștepta;
relayer-ul nu combină mai multe acțiuni într-un singur tx.

## 10. Dispute și roluri administrative

Roluri separate:

- `UPGRADER`: multisig + timelock;
- `PAUSER`: poate opri acțiuni noi, nu poate confisca;
- `TREASURY`: retrage numai fees deja contabilizate;
- `ISSUER_ADMIN`: gestionează scheme și issuers;
- `DISPUTE_RESOLVER`: decide numai escrow-uri disputate, inclusiv curse.

Dovezile sunt criptate în evidence vault off-chain; on-chain apare commitment-ul.
Rezoluția poate împărți principalul și produce un hash al deciziei. În beta,
resolver-ul este multisig maker-checker; ulterior se pot adăuga panel și apel.

## 11. Upgrade și siguranță

- owner multisig 3/5, fără wallet individual;
- upgrade hash + ABI + changelog + timelock 72h, exceptând pause;
- layout append-only/versionat și migrare batch idempotentă;
- hard caps pentru fee-uri și limite;
- `pauseNewActions` păstrează refund/withdraw pentru fondurile existente;
- build reproducibil, bytecode verificabil și canary devnet;
- contractele pot deveni imutabile numai după maturizare și plan de migrare.
- deadline-urile folosesc timestamp-uri și nu presupun durata unui block round;
- ABI-ul și state machines nu depind de scheduled execution/partial miniblocks;
- adaptorul separă finalitatea ordonării de succesul execuției sub Supernova.

## 12. Teste obligatorii

- unit/scenario blackbox, Rust VM și Go VM unde este relevant;
- capability scope/expiry/revoke, Ed25519 domain separation, nonce replay,
  relayer forgery/censorship retry și exact 1 action/event per tx;
- property/fuzz pentru tranziții, deadlines, sume și tokenuri;
- invariant tests pentru liabilities, double release și split;
- callback/retry/cross-shard și duplicate event delivery;
- Supernova: ordered-before-executed, execution failure/lag, backpressure, upgrade
  epoch, mixed gateways și fallback runtime;
- upgrade/storage migration și pause/recovery;
- gas snapshots best/worst-case;
- devnet end-to-end cu relayer, indexer și reconciler;
- static review, dependency/SBOM review și două review-uri separate de logică.

Auditul realizat în proiect produce findings, severity și remediere verificată.
Înainte de fonduri reale semnificative se cere și un audit independent, deoarece
autorul unui contract nu poate certifica independent propria implementare.
