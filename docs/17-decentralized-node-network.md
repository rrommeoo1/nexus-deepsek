# Nexus Node Network — descentralizare și sharding aplicațional

Acest document este normativ. El definește cum Nexus pornește cu un singur
`Genesis Node` și evoluează organic către o rețea globală cu mii de noduri
permissionless, fără dependență de furnizori de noduri desemnați și fără a pune
video, chat, locații sau date sensibile în blockchain.

## 1. Decizia arhitecturală

Nexus nu devine „fără calculatoare”. Devine o rețea în care orice utilizator poate
rula software-ul de nod, iar protocolul funcționează pentru orice `N >= 1`. La
`N=1` produsul este funcțional, dar centralizat și fără redundanță; descentralizarea
și toleranța la defect cresc automat odată cu numărul și diversitatea nodurilor.

```text
MultiversX                     Nexus Node Network
---------------------------    -----------------------------------------
identitate/control wallet      profile/posts read models
ordine acțiuni adulte          federation și social graph delivery
node announcements/proofs      storage/replication/retrieval
escrow/settlement              video transcode/cache/live delivery
roots/checkpoints              Matrix messaging/index/search
node reward settlement         recommendations și moderation services
```

Blockchain-ul nu este CDN, bază de date video sau message broker. MultiversX
Adaptive State Sharding scalează starea, tranzacțiile și rețeaua blockchain;
Nexus are nevoie separat de sharding pentru date, fișiere, camere, căutare și
compute. Supernova reduce latența ordonării/finalității și decuplează execuția,
dar nu distribuie automat backend-ul Nexus.

## 2. Patru mecanisme diferite

| Mecanism | Ce rezolvă | Ce nu rezolvă |
|---|---|---|
| MultiversX shards | tranzacții, state și consens blockchain | video, chat, search, CDN |
| Application shards | partiționarea obiectelor și workload-ului Nexus | consens economic global |
| Federation | servere independente care schimbă evenimente semnate | disponibilitatea automată a fiecărui fișier |
| P2P content/compute | routing, replicare, cache și jobs distribuite | legalitate, moderare și adevăr universal |

Nexus le combină. Nu le prezintă utilizatorului drept anonimitate absolută sau
garanție că un fișier public distribuit poate fi șters de pe orice calculator terț.

## 3. Arhitectura țintă

```text
Mobile/Web/TV clients
  │ wallet/device signatures, E2EE, on-device ranking
  ▼
Nearest Nexus Gateway Nodes ──────────────────────────────┐
  │ auth/rate/policy/routing                              │
  ├─ Event Relay Mesh ─ libp2p QUIC + GossipSub           │
  ├─ Shard Replicas ─ metadata/event logs/read models     │
  ├─ Storage Nodes ─ encrypted objects/IPFS eligible      │
  ├─ Media Nodes ─ transcode/package/thumbnail            │
  ├─ Edge Nodes ─ cache/HLS/LL-HLS/retrieval              │
  ├─ Matrix Homeservers ─ federated E2EE messaging        │
  ├─ Index Nodes ─ public search/topics/market shards     │
  ├─ Live Nodes ─ ingest/orchestrate/transcode/fanout      │
  └─ Assurance Nodes ─ challenges/receipts/checkpoints    │
          │                                               │
          └── signed receipts/checkpoints ────────────────┤
                                                          ▼
MultiversX: Action Ledger │ Node Registry │ Service Settlement │ Governance
```

Protocolul este language-neutral. Referința recomandată pentru daemonul `nexus-node`
este Rust + libp2p/QUIC/GossipSub/Kademlia, cu RocksDB/object-store adapters și gRPC.
NestJS rămâne application gateway/control API; node daemon face networking, crypto,
replication și proof/receipt handling.

## 4. Rolurile nodurilor

Orice participant poate porni un nod, iar daemonul activează automat una sau mai
multe capabilități după benchmark, resurse, conectivitate și consimțământ:

| Rol | Funcție | Hardware dominant | Acces date |
|---|---|---|---|
| Gateway | client entry, auth, policy, routing | CPU/network | envelope minim |
| Event Relay | propagare evenimente semnate | network | public/ciphertext |
| Metadata Replica | event log, reducer, read model | SSD/CPU | după shard/class |
| Storage | obiecte criptate și public permanent opt-in | disk/network | ciphertext/public |
| Media Worker | transcode, thumbnail, captions jobs | CPU/GPU | asset temporar |
| Edge Cache | HLS/CMAF/retrieval regional | network/SSD | segments criptate/publice |
| Matrix Home | rooms, E2EE ciphertext, federation | SSD/network | ciphertext/metadata minimă |
| Index | search, topics, listings și public graph | RAM/SSD | numai corpus permis |
| Live Gateway | ingest, orchestrare și failover | network/GPU | live segments |
| Recommender | public candidates/model serving | CPU/GPU | features allowlisted |
| Assurance | challenges, probes, receipts și checkpoint comparison | mixt | minim/purpose-bound |

`NodeCapabilityManifest` declară roles, protocol versions, coarse region,
data classes, hardware buckets, price opțional, bond opțional, public keys și
endpoints. Identitatea juridică nu este necesară pentru relay/cache/storage
criptat fără recompense.

## 5. Participare permissionless și trust classes

Nu există o listă de operatori care trebuie recrutați sau aprobați. Există numai
noduri și proprietarii dispozitivelor pe care rulează. Un nod se alătură printr-o
cheie `NodeID`, handshake de protocol și self-test; wallet-ul este opțional și devine
necesar numai dacă nodul dorește recompense.

### T0 — Light peer

- aplicația mobilă/web poate verifica evenimente, ține cache și ajuta discovery;
- nu este presupusă always-on și nu intră în replica durability target;
- păstrează cheile și poate face on-device ranking/decryption.

### T1 — Open full node

- se instalează pe desktop, NAS, mini-PC, server sau cloud fără aprobare;
- face relay, cache, index public și storage pentru blocuri publice ori criptate;
- intră în DHT imediat, dar primește trafic gradual după probe de disponibilitate;
- nu primește plaintext, chei private sau autoritate doar fiindcă este în rețea.

### T2 — Proven service node

- rămâne permissionless, dar dovedește resursa/munca prin challenges și receipts;
- poate publica wallet, ofertă și preț și poate primi settlement EGLD/ESDT;
- bond-ul este opțional pe servicii obișnuite și obligatoriu numai când riscul
  economic al jobului o cere;
- nu există aprobare manuală; eligibility este deterministă și contestabilă.

### T3 — Confidential/attested compute opțional

- poate executa joburi confidențiale în hardware/medii atestate, cu rezultate
  verificate și alternative on-device;
- attestation este un semnal, nu root of trust unic;
- datele sunt chunked, padded și E2EE; nodul nu primește implicit cheia.

### Authority signers — în afara rețelei de storage

- verificatorii de vârstă/KYC, instanțele, payment providers și editorii Kids emit
  claims/allowlists semnate; nu găzduiesc rețeaua și nu controlează DHT-ul;
- nodurile permissionless pot transporta numai ciphertext sau catalog public semnat;
- plaintext-ul Dating, locația exactă, child activity și safety evidence rămâne
  on-device ori în vault-uri E2EE controlate de utilizator;
- cerințele legale se atașează funcției/claim-ului, nu dreptului de a rula un nod.

## 6. Identitate și portabilitate

- wallet-ul controlează `AccountRoot`, profile anchors și server migration proofs;
- fiecare profil are DID/URI Nexus și chei de semnare separate/contextuale;
- wallet address nu este handle public și nu apare în federation payload implicit;
- utilizatorul poate rula propriul home node; altfel clientul alege automat un
  `home replica set` din nodurile disponibile, fără lock-in;
- mutarea serverului este semnată și are overlap window pentru continuitate;
- follower/subscription graph public se poate reconstrui din events/checkpoints;
- datele private se mută numai E2EE și cu confirmarea dispozitivelor;
- pierderea unui home server nu mută ownership-ul către proprietarul nodului.

Un profil public poate fi adresat ca `nexus:profile:<commitment>` și expus opțional
prin handle federat `@alias@peer.example`. Mapping-ul către wallet rămâne în
identity layer, nu în ActivityPub/Matrix public.

## 7. Nexus Event Protocol

```text
NexusEvent {
  protocol_version,
  event_id,
  actor_profile_commitment,
  actor_kind,
  object_id,
  action_class,
  prev_event_id?,
  payload_ref_or_ciphertext,
  audience_policy_hash,
  country_policy_version,
  action_tx_hash?,
  device_signature,
  created_at
}
```

### Ordine și adevăr

- pentru mutațiile adulte, `EXECUTED_SUCCESS` din MultiversX este sursa canonică a
  existenței/ordinii; nodurile pot afișa optimistic înainte și reconciliază ulterior;
- event-ul nu este valid doar fiindcă a apărut în GossipSub; nodul verifică semnătura,
  capability, schema, policy și chain state unde este obligatoriu;
- payload public are hash/CID; payload privat este ciphertext + commitment generic;
- telemetria nu intră în event log global;
- reducers sunt deterministe, versionate și comparate prin checkpoint roots;
- conflictele edit/delete sunt rezolvate prin ordine/action policy, nu last-write
  bazat pe ceasul unui server neîncrezător.

### Propagare

- QUIC pentru transport, Noise/TLS și peer identities;
- GossipSub pentru evenimente pe topics/shards, cu validation înainte de forward;
- Kademlia DHT/rendezvous pentru peer/content discovery;
- store-and-forward queues, deduplication și backpressure;
- server-to-server HTTP/gRPC fallback pentru noduri enterprise/self-hosted;
- bootstrap peers multipli, DNS/on-chain lists și peer exchange; niciun bootstrap
  unic nu este root of trust.

## 7A. Bootstrap și funcționare pentru orice `N >= 1`

Clientul include cheia și adresa Genesis Node, nu încredere nelimitată în conținutul
lui. Orice event este verificat față de semnătura utilizatorului și, pentru mutațiile
adulte, față de rezultatul MultiversX. După prima conexiune, discovery folosește peer
exchange, Kademlia DHT, mDNS local, rendezvous și ancore on-chain periodice. Pot exista
mai multe bootstrap addresses; pierderea lor nu oprește peerii deja conectați.

| Noduri eligibile `N` | Mod automat | Replici `R` | Comportament |
|---:|---|---:|---|
| 1 | Standalone/Genesis | 1 | toate rolurile pe același nod; backup local obligatoriu |
| 2 | Mirror | 2 | replicare completă; fără pretenție de quorum independent |
| 3–7 | Small mesh | `min(N,3)` | replicare completă/partială, GossipSub și anti-entropy |
| 8–31 | Partition-ready | 3 | primele shard-uri logice; fiecare nod poate avea mai multe roluri |
| 32–255 | Adaptive mesh | 3–5 | split/merge după capacitate, DHT matur și repair automat |
| 256+ | Global mesh | 3–9/erasure | locality, multe shard-uri și piețe de servicii opționale |

Formula de siguranță este `R = min(N_eligible, target_replication)`. Protocolul nu
refuză să funcționeze dacă `R` nu poate fi atins; marchează obiectul
`UNDER_REPLICATED`, păstrează o copie pe client când este posibil și îl repară când
apare următorul nod. La `N < 8` nu fragmentăm agresiv datele: replicarea simplă este
mai sigură decât sharding-ul prematur.

NAT traversal folosește QUIC hole punching și circuit relay. Un telefon este light
peer, nu replică de durabilitate; desktop/NAS/mini-PC poate deveni full node printr-un
installer cu auto-update semnat, limite de disk/bandwidth și opt-out instant.

## 7B. Cum crește rețeaua fără recrutarea unor furnizori

Distribuția nodului face parte din produs, dar contribuția de resurse este explicit
opt-in și nu este ascunsă în aplicație:

- `Nexus Light` în mobile/web: verificare, discovery, cache privat și on-device compute;
- `Nexus Home` pentru desktop/NAS: installer one-click, 5–500 GiB configurabil,
  bandwidth/metered-network schedule și sleep-safe resume;
- `Nexus Full` ca binary/container open-source: roles și limite avansate;
- capability auto-test selectează relay/storage/index/media; utilizatorul poate
  dezactiva orice rol și își poate retrage datele după handoff/re-replication;
- join-ul gratuit nu cere wallet tx, stake, companie, contract sau reward account;
- recompensele sunt un strat ulterior, opt-in, fără promisiune de venit;
- clientul afișează separat `network nodes`, `independent failure domains`,
  `replication health` și `decentralization level`, nu doar un număr marketing.

Genesis Node este fallback numai cât nu există alternative. De îndată ce clientul
învață peerii și ancorele lor, acestea se păstrează în address book; bootstrap-ul
poate fi furnizat de chain anchors, cache local, QR/invite și mai multe community
seeds. O pană a domeniului Nexus nu trebuie să oprească mesh-ul existent.

## 8. Sharding aplicațional

Nexus nu copiază regula `wallet shard = data shard`. Wallet shards sunt alegerea
protocolului MultiversX și pot evolua; social data placement are alte obiective.

### Chei de partiționare

- profile/home: rendezvous hash după `profile_commitment`;
- object/media: hash după `object_id/CID`;
- room: hash după `room_id`, replicat la homeserverele participanților;
- Pulse/topic: topic + time bucket cu split pentru hot topics;
- Market/Services: country/region/category + object hash;
- geo/Mobility: H3/geohash pentru coarse discovery; coordonatele exacte sunt E2EE
  și ajung numai la rider/driver autorizați;
- Live: `stream_id` + nearest ingest + redundant region;
- Kids: country/age catalog public semnat; child activity nu intră în mesh.

### Placement

Rendezvous hashing produce un replica set divers, filtrat înainte după:

1. data class și trust class;
2. Country Pack/jurisdiction/region;
3. node-owner independence și ASN/cloud diversity, când rețeaua este suficientă;
4. capacity/latency/price;
5. reliability/reputation;
6. randomization pentru anti-cartel/censorship resistance.

Ținta este 3 replici în minimum două regiuni și trei failure domains, dar la început
se folosește `R=min(N,3)`. Pentru date publice importante: 5–9 replici ori erasure
coding după măsurători. Când există suficientă diversitate, niciun proprietar de nod,
cloud sau ASN nu deține majoritatea replica set-ului.

### Rebalancing

- placement epochs și consistent/rendezvous hashing limitează mișcarea datelor;
- noul replica set copiază snapshot + event delta, verifică Merkle root și apoi
  primește trafic;
- vechiul set păstrează overlap TTL, apoi purge conform retention;
- hot shard splitting este controlat de load evidence, nu de un threshold fix;
- home/profile shard migration este auditat și revocabil înainte de cutover.

## 9. Disponibilitate și checkpoints

- fiecare shard are append-only signed event log și snapshots periodice;
- checkpoint-ul conține reducer version, range, state root și replica signatures;
- roots sunt comparate între noduri independente și ancorate periodic în `nexus-checkpoints`;
- un nod nou face state sync din `min(2,N_available)` surse și verifică chain/events;
- anti-entropy repară diferențe fără a rescrie evenimente canonice;
- tombstones se propagă cu prioritate și blochează reindexarea în Nexus-compliant nodes;
- audit nodes fac random retrieval/state challenges și măsoară time-to-first-byte.

Nu este necesar consens BFT între mii de noduri pentru fiecare like: MultiversX
oferă ordinea canonică, iar replica groups verifică și materializează. Pentru date
off-chain fără tx, semnătura owner-ului și regula obiectului stabilesc autoritatea.

## 10. Stocare descentralizată

### Public permanent — opt-in explicit

- CID și IPFS/IPFS Cluster ori provider storage-deal;
- replicare monitorizată și content routing prin DHT;
- creatorul vede că terții pot repina și că ștergerea globală nu poate fi garantată;
- potrivit pentru manifests, open-source, public credentials și media „pin forever”.

### Public revocabil

- segments/objects criptate, content-addressed intern și replicate la Storage Nodes;
- manifestul și playback keys sunt controlate de audience/rights service;
- tombstone oprește discovery, revocă keys și cere purge/receipt de la noduri;
- un viewer anterior poate păstra o copie; rețeaua nu promite ștergere retroactivă.

### Privat

- E2EE înainte de upload, chei numai la participanți/dispozitive;
- ciphertext-ul poate fi fragmentat pe T1/T2 fără topic sau identitate publică;
- metadata minimă, padding/batching unde merită și retention scurt;
- Dating/chat/Kids/location nu se pin-uiesc în IPFS public.

### Proof și audit

- Merkle chunk challenges pentru posesie/integritate;
- random retrieval probes din regiuni independente;
- signed storage receipts și availability windows;
- proof-of-storage extern opțional pentru arhive publice de lungă durată;
- QoS afectează selection/reward; slashing numai pentru abateri obiectiv dovedibile.

## 11. Social și Pulse federat

Nexus folosește protocol nativ semnat pentru toate funcțiile și un bridge
ActivityPub pentru interoperabilitate publică:

- Profile/Actor, inbox/outbox, Create/Update/Delete, Follow/Like/Announce/Block;
- mapping-ul bridge nu promite suport pentru Dating, payments, trust ori private aliases;
- evenimentele externe sunt `actor_kind=EXTERNAL_FEDERATED` și nu primesc automat
  rewards, verification ori trend weight;
- remote content trece sanitization, signature/origin checks, rate și moderation;
- per-server allow/deny/limit și shared-inbox backpressure;
- user export și server move fără pierderea ownership-ului Nexus.

ActivityPub este federare server-to-server, nu storage P2P și nici identitate wallet.
Bridge-ul rămâne boundary explicit, nu sursă de autoritate financiară.

## 12. Chat federat

- Matrix Server-Server API pentru homeserver federation;
- rooms replicate persistent signed events între homeserverele participante;
- E2EE plaintext/keys rămân pe dispozitive; serverele văd ciphertext și metadata;
- device/key changes, membership și server ACL sunt verificate;
- room availability crește când participanții sunt pe homeservere diferite;
- user poate folosi Genesis Node, propriul home node sau un set ales automat;
- report-ul este voluntar și trimite numai mesajele selectate/evidence necesar;
- Dating folosește E2EE, sealed sender când este posibil și rendezvous topics
  neenumerabile; Kids nu are open messaging.

Mesajul adult produce commitment Action Ledger conform politica Nexus; Matrix PDU
nu este în sine dovada economică sau autorizația unei plăți.

## 13. Video, Clips și Watch

```text
creator → nearest Gateway → encrypted/source upload shards
       → job market → 2 candidate Media Workers
       → deterministic checks + sampled verification
       → ABR segments → Storage/Edge replica sets
       → signed manifest → viewers retrieve nearest eligible copy
```

- job-urile mari sunt off-chain; numai assignment/receipt roots și settlement
  periodic sunt on-chain;
- output verification compară codec/profile/duration/segment hashes și face sampled
  re-encode/quality checks;
- Gateway nu trimite toate joburile celui mai ieftin nod; selection include
  diversity, quality, latency și capacity;
- creatorul poate alege numai propriul nod pentru conținut nelansat/sensibil;
- edge nodes cache-uiesc segmente, nu primesc automat cheia master;
- rights/territory și takedown sunt verificate înainte de discovery/playback;
- IPFS public este numai pentru conținut permanent ales explicit.

## 14. Live descentralizat

```text
broadcaster signs StreamManifest
 → `min(N,2)` ingest nodes; failure domains diferite când sunt disponibile
 → orchestrators split renditions across GPU workers
 → verifier samples outputs
 → regional edge meshes deliver LL-HLS/WebRTC
 → recording shards become moderated Watch replay
```

- primary/backup ingest primesc simultan ori prin rapid failover;
- live segments și heartbeats nu produc câte un tx;
- node receipts sunt agregate off-chain și settle periodic;
- Live kill revocă manifest/key și oprește Nexus-compliant gateways; mecanismul este
  deterministic, multi-role și nu depinde de un model AI;
- un terț poate restream-ui; descentralizarea nu poate garanta dispariția globală;
- chat este mesh separat, poate fi dezactivat fără a opri video;
- creator/account/safety eligibility precede asignarea nodurilor;
- Kids Live acceptă numai stream-uri instituționale cu manifest/catalog semnat,
  fără child broadcast sau open chat; nodurile livrează segmente, nu decid eligibilitatea.

Modelul urmează principiul „thin on-chain anchor, high-volume work off-chain”:
registry, stake și settlement pe chain; segments, quotes și verification în protocol.

## 15. Search și recomandări

### Search

- index shards pentru public content, topics, country/category și time buckets;
- query gateway alege 3–7 index nodes eligibile și face merge/rerank;
- results includ origin, object hash, moderation/rights version și freshness;
- private/Dating/Kids index nu participă la global federation;
- spam nodes sunt comparate prin overlap, signed corpus checkpoints și probes.

### Recommendations

- candidate nodes furnizează seturi publice și reason codes;
- profilul privat de interes poate rămâne on-device;
- clientul sau trusted home node face re-ranking final;
- modele/weights sunt semnate, versionate și rollbackable;
- utilizatorul păstrează Following/Subscriptions/Chronological/Editorial;
- nu există „consens” unic asupra feedului și nici model global obligatoriu;
- rewards nu se bazează pe view/engagement raportat de un singur node.

Federated learning este Phase 3 experimental, cu secure aggregation și audit; nu
este justificare pentru a colecta raw private histories.

## 16. Contracte MultiversX noi

### `nexus-node-registry`

```text
NodeRecord {
  node_owner_wallet?, node_id, capability_hash, service_roles,
  bond?, protocol_versions, status, registered_at
}
```

Endpoints: `registerNode`, `updateCapability`, `bond`, `requestExit`, `finalizeExit`,
`suspend`, `slashProof`, `setProtocolRange`.

### `nexus-service-settlement`

- epoch budget și approved ESDT/EGLD;
- receipt/Merkle root per service class;
- node claim proof și one-claim invariant;
- dispute/freeze numai pe suma contestată;
- no raw view, IP, child ID, room sau precise location.

### `nexus-checkpoints`

- shard/root/range/reducer version/replica-set commitment;
- equivocation proof pentru două roots semnate de același node/range;
- nu stochează snapshot/event payload.

### `nexus-protocol-governance`

- supported protocol versions, activation epoch, timelock și emergency minimum;
- initial multisig + public proposal/evidence; descentralizare progresivă;
- software release hash nu obligă un participant să execute cod neverificat.

Contractele financiare existente nu acceptă rezultatul unui node doar pentru că
acesta are stake; verifică proof/issuer/schema și state machine proprie.

## 17. Economia nodurilor

Rețeaua funcționează și fără recompense: Genesis Node plus resurse oferite voluntar
de utilizatori. Nexus nu are nevoie de token NXS. Când există venit, nodurile care
aleg monetizarea pot fi plătite în EGLD ori ESDT aprobat:

- storage: GiB-lună eligibil + availability/retrieval quality;
- edge: bytes/minute delivered, deduplicate și sampled;
- transcode: pixels/frames/profile, cu output verification;
- live: ingest/minute/rendition/delivery și SLA;
- index: query quality/availability, fără pay-per-rank;
- relay: delivery availability, nu volum brut auto-raportat;
- Matrix/home: subscription/B2B/plan, nu citirea mesajelor.

Settlement-ul este periodic per epoch/threshold. Un segment, packet ori view nu
devine tranzacție MultiversX; sunt operațiuni de infrastructură, nu acțiuni sociale
intenționate. Acest lucru păstrează costul controlabil.

### Anti-Sybil/economic security

- NodeID este permissionless; wallet-ul este necesar numai pentru reward claim;
- proof-of-work puzzle ușor/rate limit și reputation maturată reduc Sybil la join;
- bond și cooldown sunt cerute numai serviciilor plătite cu risc material;
- capability benchmarks și canary jobs înainte de trafic real;
- multi-source receipts, random audits și fraud graph;
- caps per node owner/wallet/ASN/cloud și cluster comportamental;
- rewards scad la concentration, failures sau invalid receipts;
- slashing numai pentru double-sign/equivocation/invalid proof ori fraudă demonstrabilă;
- performanța slabă normală duce la mai puține joburi/plată, nu confiscare arbitrară.

## 18. Security și Byzantine fault model

Adversari: Sybil/eclipsing, node collusion, data withholding, corrupted output,
false receipts, DHT poisoning, spam federation, censorship, metadata correlation,
malicious software update, compromised node owner, cloud/ASN outage și legal coercion.

Controale:

- signed events/manifests/receipts și domain separation;
- peer scoring, diversity și connection caps;
- multiple bootstrap/discovery sources și DHT response comparison;
- validation înainte de GossipSub forward;
- replica quorum/checkpoints și state-root comparison;
- end-to-end encryption, key separation și least-data node roles;
- reproducible builds, signed releases, SBOM și staged protocol activation;
- remote attestation doar ca semnal, nu root of trust unic;
- challenge/probe din noduri și regiuni independente;
- circuit breaker pe node, owner cluster, shard, protocol version și service class;
- continuous adversarial testing prin Nexus Assurance & Control.

## 19. Moderare, legal și responsabilitate

Descentralizarea nu șterge obligațiile Nexus pentru aplicațiile, gateway-urile și
serviciile pe care le controlează. Nu există „operatori Nexus” desemnați, însă
persoana care rulează un nod poate avea obligații proprii în jurisdicția sa:

- fiecare node declară țările/data classes pe care le poate servi;
- Nexus-compliant nodes aplică illegal-content, rights, block, child și country policies;
- notice/takedown/tombstone se propagă prioritar, cu reasons/appeal;
- un nod independent poate avea reguli suplimentare și le publică în manifest;
- utilizatorul poate migra dacă un nod cenzurează în afara regulilor, dar
  conținutul ilegal nu devine eligibil automat pe alt node;
- Nexus nu transmite automat evidence/PII unui node owner; cererile valide urmează
  entitatea care controlează datele/cheile și jurisdicția relevantă;
- protocolul nu publică un registry global al victimelor, reports sau preferences;
- shared hash lists au acces și governance controlate pentru a evita abuse/poisoning;
- ActivityPub/IPFS bridge nu ocolește app-store, DSA, copyright ori child safety.

### Domenii cu descentralizare limitată

| Domeniu | Model permis |
|---|---|
| Public Pulse/Clips/Watch | open federation/cache/storage după policy |
| Work/public profiles | federation opt-in și verifiable credentials |
| Chat E2EE | personal/federated home nodes; mesh-ul vede numai ciphertext |
| Dating | ciphertext pe noduri permissionless, plaintext/keys on-device, fără public index |
| Payments/escrow | audited services + MultiversX canonical state |
| Mobility location | E2EE rider↔driver, relay efemer, fără DHT public |
| Kids | catalog public semnat; activitatea copilului local/E2EE, fără open social |
| Safety evidence/KYC/tax | vault user-controlled + claims de la authority signers |

## 20. Governance

### Faza inițială

- protocol spec public, reference node open-source și conformance suite;
- Nexus Foundation/operating entity multisig + timelock pentru registry/protocol;
- Security Council poate pause strict și temporar, nu confisca ori edita conținut;
- node-participant forum consultativ și public change proposals;
- signed release manifests, changelog și minimum supported versions.

### Maturizare

- proposals cu testnet/Battle-of-Nodes/evidence și activation epoch;
- delegare graduală pentru budgets/protocol parameters;
- conflicte de interes, quorum și emergency powers limitate;
- independent node/client implementations;
- treasury transparency și node-owner/service-class concentration metrics.

Nu recomand DAO complet la lansare. Upgrade-urile urgente, child safety, smart
contracts cu fonduri și protocol compatibility cer răspundere și proceduri mature.

## 21. Protocol și APIs

```text
/nexus/peer/1.0          identify, capabilities, protocol range
/nexus/events/1.0        announce/fetch signed events
/nexus/shards/1.0        placement, snapshot, delta, checkpoint
/nexus/storage/1.0       put/get/challenge/receipt/tombstone
/nexus/media/1.0         quote/job/result/verify/receipt
/nexus/live/1.0          ingest capability/job/segment/failover
/nexus/index/1.0         query/result/corpus checkpoint
/nexus/assurance/1.0     challenge/probe/evidence without secrets
```

- Protobuf/CBOR canonical serialization și explicit max sizes;
- semantic versions + supported range negotiation;
- signed capability manifests anchored by hash;
- quotas/backpressure and payment/capability authorization;
- conformance tests publice și test vectors;
- unknown fields/version fail safely according to message class;
- private protocols nu sunt advertised pe public DHT.

## 22. SLO și decentralization scorecard

- replica health și under-replicated objects;
- node-owner/cloud/ASN/country concentration per service;
- p50/p95/p99 event propagation și retrieval;
- checkpoint divergence/recovery time;
- node conformance/version distribution;
- censorship/takedown/appeal behavior;
- transcode/live verification failures;
- reward concentration și receipt fraud;
- home-server migration success;
- public federation availability;
- private/Kids forbidden-route attempts;
- cost per GiB, delivered minute, transcode minute și live hour.

Țintă matură pentru serviciile publice: niciun owner cluster >15% din capacity/rewards,
niciun cloud/ASN >30% și minimum trei implementări independente pe rol critic.
Pragurile finale se bazează pe măsurători și threat model, nu pe marketing.

## 23. Creștere organică de la un nod la mii

Trecerea este declanșată de numărul/capacitatea observată, nu de recrutarea ori
aprobarea unor operatori. Rețeaua poate rămâne într-un mod cât este necesar.

### D0 — Genesis, din prima versiune

- un singur nod rulează gateway, event log, replica, storage, index și jobs;
- protocolul, manifests și formatul de shard sunt deja cele finale, nu un backend
  temporar care trebuie rescris;
- chain-ul și semnăturile permit unui viitor nod să verifice istoria;
- backup/export și recovery sunt obligatorii deoarece `R=1`.

### D1 — small mesh, 2–7 noduri

- orice persoană instalează nodul și intră fără aprobare;
- replicare completă sau `R=min(N,3)`, peer exchange și anti-entropy;
- încă nu pretindem independență dacă nodurile aparțin aceluiași owner/cloud.

### D2 — adaptive mesh, 8–31 noduri

- DHT, primele shard-uri, conformance probes și self-healing;
- storage/media/index roles se aleg automat după benchmark;
- ActivityPub/Matrix federation și public dashboard de sănătate.

### D3 — public service mesh, 32–255 noduri

- placement divers, sharding adaptiv și noduri recompensate opțional;
- challenges, receipts și settlement periodic;
- Live folosește două ingest nodes când sunt disponibile.

### D4 — global mesh, 256–2.000 noduri

- locality-aware edge, shard split/merge, erasure coding și multiple bootstrap sets;
- independent client/node implementations și advanced metadata protection;
- niciun nod nu primește automat plaintext sensibil.

### D5 — rețea matură, peste 2.000 noduri

- multe implementări, governance graduală și piețe media/compute mature;
- on-device recommender și personal home nodes devin uzuale;
- protocol retirement/migration și treasury governance sunt distribuite.

Orizontul tehnic estimat este 0–4 luni pentru D0, însă D1–D5 depind de adopția
voluntară. Produsul nu așteaptă un anumit număr: el degradează controlat la puține
noduri și câștigă automat redundanță și descentralizare când rețeaua crește.

## 24. Ce nu recomand

- toate datele pe fiecare node;
- video blobs sau chat plaintext on-chain;
- wallet shard folosit direct ca singura cheie de data placement;
- IPFS public pentru Dating, Kids, locație ori media ce trebuie retrasă;
- un singur DHT/bootstrap/oracle drept root of trust;
- proof-of-bandwidth bazat numai pe auto-raportarea nodului;
- reward per view/packet/like fără deduplicare și multi-party receipts;
- slashing pentru QoS ambiguu sau moderare contestabilă;
- live frames/segments ca tx separate;
- DAO complet și procesare plaintext Kids/fonduri pe noduri anonime din prima zi;
- promisiunea „nimeni nu poate cenzura/șterge/identifica”.

## 25. Release gates

- protocol spec, threat model și test vectors publice;
- la `N=1`, backup/export/recovery dovedite; la `N>=3`, no-majority placement și
  failure-domain diversity proporțională cu resursele disponibile;
- event signature/chain verification, replay și schema fuzz tests;
- DHT/GossipSub Sybil/eclipsing/load simulations;
- state sync/checkpoint divergence/rebuild tests;
- storage challenge/retrieval/tombstone/purge evidence;
- provider/job output verification și receipt fraud tests;
- Matrix/ActivityPub federation abuse, SSRF, signature, spam și ACL tests;
- node update/protocol negotiation/rollback și supply-chain audit;
- settlement liabilities, claims, disputes și treasury caps reconciliate;
- Live primary/backup/kill/replay drills;
- private/Kids routes demonstrabil absente din open-node protocols;
- Country Packs, authority signers și data roles validate înaintea funcțiilor
  reglementate, fără a transforma nodurile în custodieni de plaintext;
- canary 1% → 5% → 25% → 100% per service class, cu independent stop conditions.

## 26. Surse tehnice principale

- [MultiversX Architecture Overview](https://docs.multiversx.com/learn/architecture-overview/)
- [MultiversX terminology — Adaptive State Sharding](https://docs.multiversx.com/welcome/terminology/)
- [MultiversX Supernova — decoupling consensus and execution](https://multiversx.com/blog/supernova-decoupling-consensus-and-execution)
- [IPFS Kademlia DHT specification](https://specs.ipfs.tech/routing/kad-dht/)
- [IPFS Cluster replication](https://ipfscluster.io/documentation/guides/pinning/)
- [libp2p GossipSub](https://docs.libp2p.io/concepts/pubsub/)
- [Matrix Server-Server API](https://spec.matrix.org/latest/server-server-api/)
- [ActivityPub W3C Recommendation](https://www.w3.org/TR/activitypub/)
- [Livepeer Protocol Architecture](https://docs.livepeer.org/v2/about/protocol/architecture)
- [Filecoin storage proving](https://docs.filecoin.io/storage-providers/filecoin-economics/storage-proving)

Nexus poate ajunge la mii de noduri, dar securitatea vine din separarea rolurilor,
replicare, verificare, portabilitate, node-owner diversity și MultiversX settlement —
nu din simplul număr de servere.
