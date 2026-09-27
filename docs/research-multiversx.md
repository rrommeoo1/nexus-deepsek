# Nexus — arhitectura MultiversX fezabilă în 2025–2026

> Notă: acest research snapshot precede `nexus-ride` și `nexus-actions`;
> specificațiile normative sunt în `02-smart-contracts.md` și documentul `09`.

> Stare a recomandării: 1 august 2026. Versiunile SDK/framework și parametrii de rețea trebuie fixați și reverificați înaintea fiecărui release; gas schedule și limitele de protocol se pot schimba la un epoch.

## Decizia de arhitectură

Nexus trebuie construit ca aplicație hibridă, nu ca rețea socială integral on-chain:

- **On-chain:** controlul wallet-ului, registrul minimal de profile/pseudonime, hash-uri de termeni și attestations, drepturi/roluri, fonduri în escrow, settlement EGLD/ESDT, badge-uri și bilete NFT/SFT, evenimente auditabile.
- **Off-chain:** feed/video/live, chat și chei E2EE, swipe-uri și matching dating, profiluri complete și CV, căutare, locație, calendare optimizate, recomandări, moderare, dovezi KYC, probe de dispută și toate datele personale.
- **IPFS:** numai artefacte publice sau payload-uri criptate; pe chain se păstrează CID-ul și/sau un hash al unui manifest versionat. MultiversX recomandă IPFS pentru media și metadatele NFT, iar NFT/SFT au URI și atribute native ([NFT & SFT tokens](https://docs.multiversx.com/tokens/nft-tokens/)). IPFS nu este mecanism de ștergere GDPR și nu este depozit pentru date private în clar.

Motivul este atât economic, cât și de confidențialitate: storage-ul contractului este persistent și public, iar costul include datele tranzacției, execuția și persistența; costul contractelor utilizator nu este complet predictibil fără simulare ([Gas and fees](https://docs.multiversx.com/developers/gas-and-fees/overview/), [Account storage](https://docs.multiversx.com/developers/account-storage/)).

```text
Mobile/Web
  ├─ mx-sdk-dapp: wallet connect, NativeAuth, sign/send/track
  ├─ API Nexus: sesiune, profil activ, feed, chat, marketplace, booking
  └─ semnare tranzacție/mesaj
           │
           ├──────── MultiversX gateway/API ────────┐
           │                                         │
Relayer Nexus ── Relayed Transaction v3       Contracte Rust/WASM
 (EGLD + policy)                               ├─ profile-registry
                                               ├─ reputation
Indexer Nexus <── evenimente/finality ─────────├─ marketplace-escrow
  │                                            ├─ booking-escrow
  ├─ PostgreSQL (proiecții, read models)        ├─ badge-factory
  ├─ Redis/queue (nonce, jobs, idempotency)     └─ tipping
  └─ reconciliere periodică cu state on-chain

Object storage/CDN + IPFS pinning
  └─ media, manifest public, probe criptate; doar CID/hash ajunge on-chain
```

## Wallet, autentificare și sesiune

**Un wallet = un `User`; profilele Nexus sunt sub-identități de aplicație.** Nu se creează chei custodiale și nu există parolă Nexus.

1. Clientul integrează oficialul `sdk-dapp`, recomandat de MultiversX în locul integrării manuale a providerilor; acoperă logica de signing/dApp și furnizori precum xPortal prin WalletConnect, extension/web wallet, Ledger și passkey acolo unde providerul îl suportă ([SDK JS](https://docs.multiversx.com/sdk-and-tools/sdk-js/), [WalletConnect JSON-RPC](https://docs.multiversx.com/integrators/walletconnect-json-rpc-methods/)).
2. Login-ul API folosește **NativeAuth**: challenge legat de origin, block hash și expirare, semnat de wallet. Backend-ul NestJS validează semnătura, block hash-ul, expirarea și origin-ul cu `@multiversx/sdk-native-auth-server` / `@multiversx/sdk-nestjs-auth` ([NestJS Auth utilities](https://docs.multiversx.com/sdk-and-tools/sdk-nestjs/sdk-nestjs-auth/)).
3. După validare, API emite o sesiune scurtă, rotativă, legată de `walletAddress`, device și `sessionId`. Schimbarea profilului activ este o stare de sesiune off-chain; nu cere tranzacție.
4. Operațiunile financiare sau sensibile cer semnarea tranzacției, nu doar JWT-ul. Nonce-ul de cont se rezervă/coordonază și rezultatul este urmărit până la finalitate; pentru cross-shard, aplicația așteaptă finalitatea întregului flux, nu doar includerea tranzacției sursă ([Integrators FAQ](https://docs.multiversx.com/integrators/faq/)).
5. Conturile cu Guardian trebuie acceptate; relayer-ul nu poate fi și guardian, iar guarded relayer nu este permis ([Relayed transactions](https://docs.multiversx.com/developers/relayed-transactions/)).

Wallet logout/revoke, pierderea cheii și rotația wallet-ului trebuie tratate distinct. Migrarea unui cont la alt wallet nu poate fi dedusă automat; necesită semnătura wallet-ului vechi și nou sau un proces de recuperare cu verificare și întârziere, fără a putea muta activele aflate deja în wallet-ul vechi.

## Gasless și meta-tranzacții

Se folosește **Relayed Transactions v3**, versiunea recomandată de documentația curentă. Tranzacția seamănă cu una normală, dar include `relayer` și `relayerSignature`; utilizatorul continuă să semneze, iar relayer-ul plătește gas-ul. V3 adaugă un cost de bază, iar relayer-ul trebuie să fie în același shard cu sender-ul ([Relayed transactions](https://docs.multiversx.com/developers/relayed-transactions/)).

Consecințe operaționale:

- un **relayer pool per shard** cu EGLD, chei izolate în KMS/HSM și hot-wallet limits;
- endpoint `prepare-relayed-tx` care validează allowlist-ul de contract/endpoint/token, estimează gas-ul și aplică rate limit, buget per wallet și risc antifraudă;
- semnătura utilizatorului se colectează înainte de semnătura relayer-ului; relayer-ul nu modifică payload-ul semnat;
- gas sponsorship numai pentru onboarding, profile anchors, badge claim și acțiuni promoționale. Escrow-ul și transferurile de valoare rămân semnate explicit, cu sumă/token/beneficiar lizibile;
- circuit breaker pentru bugetul zilnic și protecție anti-replay prin nonce/chain ID/expirare. Chain ID-ul separă mainnet/testnet/devnet ([Network constants](https://docs.multiversx.com/developers/constants/)).

„Gasless” înseamnă că Nexus sponsorizează taxa în EGLD, nu că operațiunea nu consumă gas și nici că poate fi executată fără consimțământul wallet-ului.

## Modelul ESDT / NFT / SFT

- **Plăți:** EGLD și o listă explicită de ESDT fungibile aprobate (inițial EGLD + un stablecoin lichid/verificat). Fiecare comandă salvează `tokenIdentifier`, `nonce=0`, sumă în unități minime; fără conversie implicită și fără tokenuri arbitrare.
- **Badge de verificare:** NFT unic per atestare sau SFT per clasă, emis de `nexus-badge-factory`. Atribute compacte: `profileIdHash`, tip, issuer, `issuedAt`, `expiresAt`, `evidenceHash`, schemaVersion. Metadatele publice sunt pe IPFS. Revocarea/expirarea se verifică întotdeauna în registrul contractului, nu doar prin posesia NFT-ului.
- **Transferabilitate badge:** colecție cu roluri ESDT controlate și transfer restricționat sau badge reprezentat în primul rând de registrul de attestations, cu NFT doar ca afișaj. Nu presupunem că un NFT transferabil este „soulbound”. Rolurile speciale controlează mint/burn/update și pot restricționa transferurile ([Fungible ESDT roles](https://docs.multiversx.com/tokens/fungible-tokens/), [NFT/SFT roles](https://docs.multiversx.com/tokens/nft-tokens/)).
- **Bilete:** SFT pentru ediții identice ale unui eveniment; NFT pentru rezervare unică. Ticket-ul nu conține nume, adresă de cazare sau date private, ci `bookingIdHash/eventIdHash`, categorie și reguli. Check-in-ul arde sau marchează nonce-ul folosit.
- **Achievements:** în MVP sunt attestations/reputation events; se emit NFT numai pentru realizări rare. Nu se actualizează NFT la fiecare like.
- **Dynamic NFT:** doar dacă produsul cere metadate evolutive și politica de roluri/revocare este explicită; dynamic tokens permit update de metadata/attributes, dar cresc puterea emitentului și suprafața de audit ([NFT & SFT tokens](https://docs.multiversx.com/tokens/nft-tokens/)).

ESDT-urile sunt native protocolului, nu cer un contract de token separat; NFT are cantitate 1, SFT are cantitate mai mare de 1 și nonce nenul ([ESDT introduction](https://docs.multiversx.com/tokens/intro/), [NFT & SFT tokens](https://docs.multiversx.com/tokens/nft-tokens/)).

## Contractele și limitele lor

Contractele sunt crate-uri Rust `#![no_std]`, construite cu o versiune stabilă și pin-uită de `multiversx-sc`/`sc-meta`; framework-ul >=0.50 folosește Rust stable ([Rust version](https://docs.multiversx.com/developers/meta/rust-version)). Separarea reduce blast radius-ul, dar nu trebuie transformată într-un graf sincron fragil. Contractele care chiar necesită apel sincron se deployează intenționat în același shard; apelurile sync funcționează doar intra-shard, iar async funcționează și cross-shard și livrează rezultatul ulterior prin callback ([SC-to-SC calls](https://docs.multiversx.com/developers/developer-reference/sc-to-sc-calls/)).

### 1. `nexus-profile-registry`

**Rol:** dovada minimală că wallet-ul controlează profile Nexus și publicarea unor manifest hashes.

Storage:

- `nextProfileId: u64`;
- `owner(profileId) -> ManagedAddress`;
- `profile(profileId) -> {kindCode, manifestHash[32], version, status, createdAt}`;
- `profilesByOwner(owner) -> set<profileId>` numai dacă dimensiunea este plafonată; paginarea principală rămâne în indexer;
- `linkCommitment(profileA, profileB) -> status` numai pentru legături publice, consimțite bilateral;
- `delegates(profileId, address) -> permissionBits` opțional, pentru host/business teams.

Endpoints: `createProfile`, `updateManifest`, `deactivateProfile`, `requestLink`, `acceptLink`, `unlink`, `setDelegate`, `transferProfileController` (flow cu două semnături/acceptance). Views punctuale, nu returnări de colecții nelimitate.

Nu stochează display name, bio, CV, preferințe dating, avatar, locație, audience sau lista de followeri. Tipul `DATING` poate rămâne numai off-chain dacă simpla lui publicare ar dezvălui informație sensibilă.

### 2. `nexus-reputation`

**Rol:** attestations verificabile pe domenii, nu un scor social unic și opac.

Storage: `attestationId`, `subjectProfileHash`, `domain`, `claimHash`, `issuer`, `issuedAt`, `expiresAt`, `revoked`; allowlist de issuer per schemă; opțional agregate simple și explicabile (`completedTransactions`, dispute outcomes). Endpoints: `issueAttestation`, `revokeAttestation`, `recordOutcome` numai din contracte autorizate, `setIssuer` prin governance.

Review text, rating breakdown și dovezile rămân off-chain. Contractul acceptă outcome-uri doar de la marketplace/booking configurate, previne dublarea prin `sourceActionId` și emite evenimente. Dating score și „social score” global nu se publică.

### 3. `nexus-marketplace`

**Rol:** ofertă/ordin, custody și settlement pentru bunuri; catalogul și conversația sunt off-chain.

Model recomandat: listarea publică există în PostgreSQL, semnată de seller; on-chain începe la `fundOrder`, care fixează `listingHash`, seller, buyer, token, sumă, feeBps, shipping/fulfilment deadline și `termsHash`. Astfel nu plătim storage pentru listări care nu se vând.

Endpoints: `fundOrder` (payable), `sellerAccept`, `sellerDecline`, `markFulfilled`, `buyerAccept`, `cancelBeforeAccept`, `openDispute(evidenceCommitment)`, `resolveDispute(buyerBps, sellerBps)`, `claimAfterDeadline`, `withdraw`. Stări: `FUNDED → ACCEPTED → FULFILLED → RELEASED`, cu ramuri `CANCELLED/REFUNDED/DISPUTED/RESOLVED/EXPIRED`.

### 4. `nexus-booking`

**Rol:** rezervări și escrow pentru stays/experiences, separat de marketplace deoarece are calendar, politici de anulare și plăți etapizate.

`createBooking` fixează `listingHash`, profile hashes, interval UTC normalizat, guest count, token, deposit/total, cancellation policy hash și deadline de acceptare. Pentru prevenirea double-booking, contractul ține inventar compact pe `listingId + periodBucket` (bitmap pentru zile/sloturi) și impune limite de interval; calendarul UX rămâne off-chain și este reconciliat cu starea contractului.

Endpoints: `requestBooking` (payable), `acceptBooking`, `decline`, `cancel`, `markCheckIn`/`hostClaimNoShow`, `complete`, `openDispute`, `resolveDispute`, `claimTimeout`, `withdraw`. Un oracle uman/IoT nu este presupus: check-in și calitatea serviciului sunt fapte din lumea reală și intră în mecanismul de confirmare/dispută.

### 5. `nexus-badge-factory`

**Rol:** administrarea colecțiilor și rolurilor ESDT, mint/burn/revoke pentru badge-uri și tickets. Doar issuers aprobați pot emite; fiecare claim folosește un `evidenceHash` unic și o schemă versionată. Cheile KYC și operatorii de verificare nu primesc automat drept de upgrade/treasury.

Endpoints: `issueCollection`/setup administrativ, `mintBadge`, `revokeBadge`, `mintTicket`, `consumeTicket`, `setIssuer`, `pauseSchema`. Contractul trebuie să dețină rolurile ESDT necesare pentru creare/mint/burn/update; API-ul framework oferă operațiile locale numai dacă rolul potrivit este setat ([Smart Contract API — ESDT](https://docs.multiversx.com/developers/developer-reference/sc-api-functions/)).

### 6. `nexus-tipping`

**Rol:** tips EGLD/ESDT și creator revenue split fără a pune fiecare interacțiune socială pe chain.

Endpoints: `tip(profileHash, contentHash, splitId)` payable, `batchTip` cu limită mică, `setPayoutAddress`, `withdraw`. Contractul validează exact un payment acceptat, calculează fee-ul și alocă în ledger beneficiarilor; retragerea este **pull payment**, ca un transfer eșuat să nu blocheze tip-ul. Split-urile sunt versionate și plafonate ca număr de beneficiari. Evenimentul `TipCreated` leagă plata de un hash de conținut, nu de metadate private.

### 7. Opțional, `nexus-private-proof-registry`

Nu intră în MVP. Swipe-urile, like-urile și match-urile dating **nu se scriu on-chain**: adresele, momentul tranzacției și relația pot deveni observabile; un hash al unei valori cu entropie mică poate fi ghicit. Dacă ambii utilizatori aleg explicit, se poate publica:

- un commitment cu salt aleator puternic pentru o attestare de match;
- un credential verificabil/revocabil al furnizorului de verificare, reprezentat doar prin schema + commitment + expirare;
- un hash de transcript/consimțământ pentru arbitraj, fără conținut.

O dovadă ZK se adaugă numai după alegerea schemei, trusted setup-ului (dacă există), costului de verificare WASM și auditului criptografic; termenul „ZK” nu trebuie folosit ca substitut pentru un design de privacy complet.

## Convenții comune de contract

### Storage și ABI

- ID-uri `u64`, timestamps `u64`, procente `u16` în basis points, sume `BigUint`, hash-uri de 32 bytes, enum-uri compacte și `schemaVersion`.
- `SingleValueMapper`, keyed mappers și seturi doar unde avem limită strictă; nicio buclă peste toți utilizatorii/listările. Colecțiile mari se indexează din evenimente și se paginează off-chain. Mappers au costuri/acces diferite, iar returnarea întregii colecții este recomandată doar când volumul este mic ([Storage mappers](https://docs.multiversx.com/developers/developer-reference/storage-mappers/), [Multi-values](https://docs.multiversx.com/developers/data/multi-values/)).
- Cheile storage au prefixe unice; documentația avertizează că prefixele suprapuse pot coliziona ([SC annotations — storage](https://docs.multiversx.com/developers/developer-reference/sc-annotations/)).
- ABI generat cu `sc-meta`; atributele ESDT sunt declarate cu `#[esdt_attribute]` pentru export în ABI ([ABI](https://docs.multiversx.com/developers/data/abi/)). Bindings TypeScript se generează din ABI și se versionază împreună cu bytecode hash-ul.

### Endpoint safety

Fiecare endpoint mutabil aplică: pause flag; autentificarea caller-ului/rolului; validarea token/nonce/payment exact; stare curentă validă; deadline; protecție idempotentă prin action ID; actualizarea stării înaintea transferurilor; eveniment final. Nu există operații administrative „generic call” și nici destinatar arbitrar.

Pentru apeluri între contracte se folosesc typed proxies. Sync doar intra-shard; async/callback sau `register_promise` pentru cross-shard. Orice flux async are o stare intermediară și cale de compensare/retry; un eșec într-un shard ulterior nu trebuie presupus că anulează automat pasul deja finalizat. Documentația distinge explicit sync, async și transfer-execute și recomandă atenție la recovery/reentrancy ([SC-to-SC calls](https://docs.multiversx.com/developers/developer-reference/sc-to-sc-calls/)).

### Evenimente și indexer

Evenimente minimale, cu câmpuri indexed stabile:

`ProfileCreated`, `ProfileManifestUpdated`, `ProfileLinked`, `AttestationIssued`, `AttestationRevoked`, `OrderFunded`, `OrderStateChanged`, `BookingFunded`, `BookingStateChanged`, `DisputeOpened`, `DisputeResolved`, `BadgeMinted`, `BadgeRevoked`, `TicketConsumed`, `TipCreated`, `Withdrawal`.

Topics: `entityId`, wallet/profile hash, status/token; data: restul payload-ului compact. Event logs sunt mai ieftine decât storage și pe chain se păstrează hash-ul lor, în timp ce indexer-ele le expun pentru căutare ([SC annotations — events](https://docs.multiversx.com/developers/developer-reference/sc-annotations/), [Events index](https://docs.multiversx.com/sdk-and-tools/indices/es-index-events/)). De aceea PostgreSQL este o **proiecție reconstruibilă**, nu sursa de adevăr financiară. Consumer-ul deduplică după tx/SCR + shard + order, urmărește `originalTxHash`, așteaptă finalitatea și rulează reconciliere periodică față de views/storage.

## Escrow, dispute și settlement

Principii comune marketplace/booking:

1. Fondurile intră în contract într-o tranzacție payable și sunt atribuite unui `escrowId`; nicio confirmare API nu este considerată plată.
2. Contractul păstrează tokenul și suma exacte; prețul în fiat este doar context off-chain. Conversia/rata oracle nu intră în MVP.
3. Termenii, politica de anulare și versiunea fee-ului sunt hash-uite și înghețate la finanțare.
4. Stările și tranzițiile sunt finite, cu deadline pentru fiecare pas și funcții permissionless de timeout/cleanup.
5. În dispută, fondurile sunt blocate. Dovezile sunt criptate off-chain; on-chain apar doar commitments. Un resolver autorizat decide split-ul `buyerBps/sellerBps`, iar contractul verifică suma = 10.000.
6. Resolver-ul inițial este un multisig operațional separat de owner/upgrade; Phase 2 poate avea panel/arbitri staked, apel și SLA, dar „decentralized dispute resolution” nu poate decide automat dacă o cameră a fost curată sau coletul corespunde.
7. Settlement-ul folosește ledger + `withdraw`, cu mutex/state-before-transfer, plafon de fee și conturi contabile separate pentru principal, platform fee și dispute fee.
8. Există `pauseNewOrders`; pauza nu trebuie să confiște fonduri și păstrează căi de refund/withdraw pentru escrow-urile existente.

## Upgradeability și governance

Contractele se lansează upgradeable în devnet/beta. MultiversX cere flag-ul `upgradeable` în code metadata la deploy/upgrade; dacă este eliminat, codul și metadata devin definitiv imuabile. Storage-ul se păstrează la upgrade, iar funcția `#[upgrade]` rulează; schimbarea incompatibilă a tipurilor din storage poate produce decode errors ([Code metadata](https://docs.multiversx.com/developers/data/code-metadata/), [Upgrading contracts](https://docs.multiversx.com/developers/developer-reference/upgrading-smart-contracts/)).

Control recomandat:

- owner = contract/mecanism multisig 3-din-5, nu wallet individual;
- roluri separate: `UPGRADER`, `PAUSER`, `TREASURY`, `ISSUER_ADMIN`, `DISPUTE_RESOLVER`;
- upgrade propus cu bytecode hash + changelog + timelock 48–72h; emergency pause mai rapid, dar fără funcție de transfer arbitrar;
- limitele economice au hard caps on-chain; schimbarea fee-ului este timelocked și afectează numai tranzacții noi;
- layout de storage append-only/versionat, `set_if_empty` în upgrade și migration endpoint incremental, idempotent, cu batch limitat;
- reproducible build, bytecode/ABI publicate și devnet canary înainte de mainnet;
- opțiune ulterioară de a face immutable contractele mature numai după audituri și existența unui plan de migrare. Imutabilitatea nu se aplică prematur unui produs aflat în evoluție.

## Gas, scalare și limitări concrete

- Nu se scriu likes, views, follows, mesaje, swipe-uri sau impresii de feed on-chain. Se pot ancora periodic Merkle roots pentru campanii/rewards, cu fereastră de claim.
- Fără fan-out on-chain și fără distribuții către mii de creatori într-o tranzacție; se folosește pull/claim și batch-uri plafonate.
- Nicio iterație neplafonată. Protocolul are limite per tranzacție pentru built-ins, transfers și trie reads; valorile sunt în gas schedule și pot fi schimbate la epoch ([SC API limits](https://docs.multiversx.com/developers/contract-api-limits)).
- Hash/CID, nu JSON și text lung în storage. Eveniment în loc de storage dacă datele nu sunt necesare logicii viitoare.
- Estimarea gas se face prin simulation și scenarii cu worst-case storage; clientul păstrează buffer și afișează costul maxim. Relayed v3 adaugă propriul base cost.
- Contractele dependente se co-localizează în shard numai dacă au nevoie reală de sync; altfel fluxurile sunt event-driven și tolerate la async. Un callback eșuat are endpoint de retry/claim.
- Transferurile ESDT/NFT și apelurile payable folosesc API-urile native; un contract poate transfera EGLD/ESDT/NFT, dar rolurile ESDT sunt obligatorii pentru mint/burn/update ([Smart Contract API functions](https://docs.multiversx.com/developers/developer-reference/sc-api-functions/)).

## Privacy: garanții și limite

Blockchain-ul nu este bază de date privată. Wallet-urile, tranzacțiile, tokenurile, sumele și timing-ul pot corela profile aparent separate. Hashing-ul nu anonimizează date cu spațiu mic de căutare. IPFS public este persistent și replicabil.

Reguli obligatorii:

- niciodată PII, CV complet, document KYC, orientare/preferințe dating, coordonate exacte, conversații, calendar privat sau probe de dispută în clar pe chain/IPFS;
- manifest separat per profil și pseudonime `profileIdHash`, fără un manifest public unic care le enumeră pe toate;
- link între profile numai opt-in bilateral; backend-ul aplică visibility matrix, dar avertizează că același wallet poate crea corelare prin activitatea on-chain;
- encrypted envelope off-chain cu DEK per obiect/conversație; ștergerea cheii asigură crypto-erasure, iar CID-ul payload-ului criptat nu dezvăluie conținutul;
- mesaje „on-chain” înseamnă cel mult ciphertext/CID/hash și consimțământ explicit; nu oferă ștergere reală;
- badge-ul public dezvăluie tipul verificării. Utilizatorul alege dacă îl mintă/afișează; verificarea internă poate rămâne credential off-chain;
- incognito este profil off-chain fără anchor public; plățile din același wallet rămân corelabile. Pentru privacy financiară reală ar fi nevoie de primitive și analiză juridică dedicate, nu de o etichetă UI.

## Model de securitate și verificare

- teste Rust blackbox/scenario pentru toate tranzițiile, callbacks, timeouts, tokenuri greșite, sume zero/overflow, double claim, duplicate action IDs, pause și upgrade; scenariile pot rula față de Rust VM și Go VM ([Testing overview](https://docs.multiversx.com/developers/testing/overview/));
- invariant/property tests: `contract balance >= total liabilities`, un escrow este plătit o singură dată, split-urile însumează exact principalul, stările terminale nu redevin active, un badge revocat nu validează;
- devnet load/gas tests și test cross-shard real; reconciliere indexer după reorg/întârziere/SCR;
- threat model separat pentru relayer, owner roles, issuers, resolver, backend signer/KMS și supply-chain; chei diferite și rotație;
- audit intern automat/manual repetat, apoi audit extern independent înainte ca mainnet să țină fonduri semnificative. „Audit propriu” nu poate fi numit independent și nu elimină riscul rezidual.

## Ce intră realist în MVP MultiversX

**MVP:** NativeAuth + sdk-dapp; profile registry minimal; marketplace escrow cu EGLD și un ESDT allowlisted; tips; badge attestations limitate; relayed v3 pentru acțiuni fără valoare; indexer + reconciliere; admin multisig/pause; devnet și apoi mainnet cu caps mici.

**Phase 2:** booking escrow + inventar compact, ticket NFT/SFT, dispute panel și apel, revenue splits, mai multe ESDT-uri, migration wallet, reputation outcomes.

**Phase 3 / experimental:** dynamic credentials, Merkle reward campaigns, private proof registry/ZK după audit criptografic, arbitraj mai descentralizat. Swipe/matching, chat E2EE, feed și moderare rămân off-chain în toate fazele.

Această delimitare folosește MultiversX pentru ceea ce face bine — control criptografic, active native ESDT și settlement programabil — fără a transforma privacy-ul și UX-ul social în tranzacții publice costisitoare.
