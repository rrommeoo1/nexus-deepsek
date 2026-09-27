# Every-action ledger și Marketplace classifieds

## 1. Regula normativă

Orice acțiune intenționată a utilizatorului care creează, schimbă sau închide o
stare de produs produce **exact o tranzacție MultiversX distinctă**.

```text
1 user mutation = 1 ActionIntent = 1 MultiversX tx = 1 terminal chain result
```

Nu se folosesc batching, rollup intern sau Merkle batch pentru a transforma mai
multe like-uri în același tx. Read models pot agrega numai după confirmare.

Nu sunt mutații: view/impression, scroll, watch progress, typing, presence, push
delivery, GPS ping, WebRTC packet, upload chunk, HLS segment, transcoding și joburi
interne. Acestea sunt telemetrie/transport efemer și nu produc obiect social.

Aceeași regulă se aplică Nexus Node Network: DHT lookup, GossipSub envelope, replica
ack, storage proof, transcode unit, cache hit și service receipt sunt infrastructură,
nu acțiuni ale utilizatorului. Ele pot fi agregate într-un settlement/checkpoint
periodic on-chain; nu încalcă regula „o mutație user-visible = o tranzacție”.

**Excepție Kids:** activitatea copilului nu produce tx public individual. History,
search, favorite, feedback, parent controls și session state sunt off-chain,
criptate și ștergibile. Chain-ul poate ancora numai acțiunea adultului, rights/payout
ale creatorului sau agregate fără child identifier.

## 2. Registrul acțiunilor

| Domeniu | Acțiune | Tranzacție | Expunere |
|---|---|---|---|
| Account | authorize/revoke session capability | `nexus-actions` direct wallet | public key + scopes |
| Profile | create/update/deactivate/link/unlink | registry/action ledger | public sau commitment |
| Social | post/edit/tombstone, like/unlike, comment/edit/tombstone | action ledger | public hash/CID |
| Social | follow/unfollow, save/unsave, share, duet/stitch | action ledger | public/policy commitment |
| Watch | channel/video publish/edit/tombstone, subscribe, playlist/save | action ledger | public hash/CID |
| Watch | comment/reply/like/report/appeal | public/private action | hash sau generic commitment |
| Live | schedule/start/end, chat message, poll vote, moderation action | action ledger | public hash/commitment |
| Live | tip/membership/payout | tipping/payment contract | financiar |
| Kids | history/search/favorite/feedback/controls | `EPHEMERAL_EXCLUDED` | off-chain criptat, fără child tx |
| Kids | adult purchase/consent credential | wallet/private action | adult commitment, fără child ID |
| Work | connect, recommendation, job post/edit/close | action ledger | public hash/CID |
| Work | application/withdraw | private action | generic commitment |
| Dating | swipe/pass/match/unmatch | private action | generic salted commitment |
| Dating | verification request/claim revoke, meet plan/check-in/safe/no-show appeal | private/reputation | generic claim/outcome commitment |
| Dating | View Once send/open/tombstone/report | private action | generic salted commitment; ciphertext off-chain |
| Chat | send/edit/tombstone/reaction/member change | private action | generic salted commitment |
| Pulse | alias create/update/deactivate | private/public action | alias commitment, fără account/wallet public |
| Pulse | post/edit/tombstone/reply/repost/quote/like/follow/list | public action | alias + object/hash/CID |
| Pulse | context note/rating/report/block | public/private action | content hash sau generic commitment |
| Market | create/edit/renew/close/share/favorite/offer | action ledger | listing/offer commitment |
| Market | fund/release/refund/dispute | marketplace contract | financiar |
| Travel | request/accept/cancel/check-in/complete/dispute | booking contract | financiar/commitment |
| Mobility | request/accept/start/complete/cancel/dispute | ride contract | financiar/commitment |
| Business | create/edit/member/location/service/calendar | action ledger | hash/commitment |
| Services | book/reschedule/cancel/check-in/complete/dispute | appointments/action | financiar/commitment |
| Promotion | campaign create/edit/pause/resume | action ledger | campaign commitment |
| Reviews | create/edit/tombstone/respond/dispute | action/reputation | hash + eligibility |
| Music | play start/like/save/playlist/share | action ledger | asset commitment |
| Music | fund/claim royalty statement | royalties contract | financiar |
| Grow | goal/workout/course/enrollment/assessment/review | public/private/financial | generic/private hash |
| Agent | register/update/suspend/revoke/capability | agent registry/action | manifest/capability hash |
| Agent | message/task/approve/cancel/accept/dispute | action/escrow | agent/task commitment |
| Events | create/invite/RSVP/contribute/cancel | action/escrow | public/private după policy |
| Trust | review/attestation/revoke | action/reputation | hash/CID/outcome |
| Safety | report/appeal/block/unblock | private action | generic commitment |
| Creator | tip/claim/split update | tipping contract | financiar |

Un endpoint nou nu poate intra în producție până când este clasificat în registry
ca `PUBLIC_ACTION`, `PRIVATE_ACTION`, `FINANCIAL_ACTION` sau `EPHEMERAL_EXCLUDED`.
Envelope-ul include obligatoriu `actor_kind=HUMAN|AGENT|SYSTEM_TEST`; acest câmp nu
poate fi schimbat de relayer și este folosit pentru policy, metrics și rewards.

## 3. Signing fără popup pentru fiecare tap

### Capability setup

1. Clientul generează o cheie Ed25519 per device și profil/context.
2. Wallet-ul semnează/trimite `registerCapability` cu scopes, limită și expirare.
3. Capability nu poate transfera EGLD/ESDT, schimba payout sau extinde propriul scope.
4. Cheia este stocată în secure hardware storage unde platforma permite.

### Action

1. Clientul encodează determinist `ActionEnvelope` și îl semnează cu session key.
2. API-ul aplică autorizare, privacy, moderation precheck, quota și idempotency.
3. Relayer-ul shardului trimite exact un endpoint call.
4. Contractul verifică Ed25519, scope, nonce, TTL și limită.
5. UI-ul optimistic trece prin ordered/execution pending, apoi success sau rollback.

Publicarea datelor false de relayer este imposibilă fără session signature;
relayer-ul poate totuși întârzia/cenzura, deci există retry, multi-relayer failover și
opțiune de direct user-paid tx pentru acțiuni publice eligibile.

## 4. Sharding și latență

Există o instanță `nexus-actions` per execution shard și un relay pool per shard.
Capability este înregistrată în instanța asignată. Router-ul nu mută o acțiune între
instanțe după semnare.

Runtime-ul este detectat ca `ANDROMEDA_COMPAT` sau `SUPERNOVA`. Nexus nu presupune o
durată fixă de bloc și nu activează Supernova după dată. UX-ul nu așteaptă blocking
confirmation pentru like/comment; afișează pending și rezolvă asincron. Plățile și
startul unei obligații financiare așteaptă `EXECUTED_SUCCESS`, nu doar finalitatea
ordonării. Backpressure-ul urmărește execution lag per shard.

## 5. Storage, events și reducer

- envelope compact în transaction input;
- event `ActionRecorded` pentru indexing; full social state nu este storage mapper;
- capability și nonce sunt storage critic;
- reducer determinist cu versiune și checkpoints per contract/shard;
- current state pentru like/follow/comment/listing este o proiecție PostgreSQL;
- replay complet, shadow rebuild și periodic state comparison;
- tx failure nu produce state confirmat; optimistic state are compensare;
- edit/delete sunt append-only actions; vechiul tx nu este eliminat.

## 6. Privacy classes

### Public

Action type, profile/object commitments și manifest hash/CID sunt indexabile. Nu se
pun adresă, telefon, coordonate exacte, documente sau alte PII în payload.

### Private

On-chain apare numai `PRIVATE_ACTION`, un commitment salted și envelope metadata
minimă. Ciphertext-ul și semnătura/evidence completă sunt păstrate criptat. Dating,
chat, report și aplicațiile Work nu publică targetul sau semantica.

Pulse publică aliasul și obiectul social, nu mapping-ul alias–account–wallet.
Postările temporare primesc un tombstone la expirare, dar tx-ul inițial rămâne
observabil; composer-ul afișează această limită. `AGENT` și `SYSTEM_TEST` nu pot
trimite `CONTEXT_NOTE_RATING`, iar traficul lor nu intră în trends organice.

Acest model ascunde conținutul, dar nu poate ascunde complet timing-ul, relayer-ul,
volumul și capability registration. Nexus nu promovează private actions ca fiind
anonime. Incognito nu schimbă proprietățile blockchain-ului.

## 7. Gas și abuse controls

- sponsored daily quota per wallet/account/profile/session/device/risk;
- pool și treasury cap per shard, alertă și automatic circuit breaker;
- endpoint/action allowlist și gas limit per tip;
- preflight simulation și canonical maximum payload bytes;
- cooldown pentru spam-like/comment/message și seller bulk actions;
- captcha/risk friction off-chain nu înlocuiește semnătura;
- quota epuizată: reset wait sau direct user-paid tx;
- financial actions nu pot folosi social session capability;
- agent capabilities au pool/budget separat și nu consumă fair-use uman;
- agent/test tx nu produc review eligibility, rewards sau billable ad events;
- gas cost dashboard pe action type, shard, cohort și feature.

## 8. Marketplace OLX-like

Market este o suprafață transversală. Se poate deschide din orice profil, dar
create/offer/sale folosește profilul Market pentru reputație, trader status și
moderare. Un anunț poate fi distribuit în Social, Work sau Chat fără duplicare.

### Categorii MVP

- electronice și electrocasnice;
- auto, moto, piese și accesorii;
- imobiliare classifieds — vânzare/chirie/contact; stays rezervabile rămân Travel;
- casă, grădină și bricolaj;
- modă și accesorii;
- sport, hobby, cărți și colecții;
- familie și copii, cu safety restrictions;
- business și echipamente;
- servicii locale/profesionale;
- animale numai dacă legislația, welfare policy și piața permit;
- „altele” numai printr-o categorie moderată, nu catch-all necontrolat.

Taxonomia este configurabilă per țară. Fiecare categorie are JSON Schema,
search facets, required attributes, pricing modes și moderation rules.

### Listing modes

`CLASSIFIED_ONLY`:

- anunț, chat și ofertă;
- plata/predarea se negociază între părți;
- Nexus nu prezintă tranzacția externă ca protejată;
- acțiunile de produs au tx, dar nu există escrow automat.

`ESCROW_CHECKOUT`:

- quote și termeni înghețați;
- buyer finanțează contractul Marketplace;
- fulfillment, release/refund, timeout și dispute;
- review eligibil numai după outcome.

### Lifecycle

```text
DRAFT → MODERATION_READY → LISTING_CREATE_TX_PENDING → ACTIVE
→ EDIT_TX / RENEW_TX / RESERVED / SOLD / CLOSED_TX / REMOVED
```

Anunțul nu devine activ înainte ca moderation precheck și tx-ul să reușească.
Eliminarea pentru safety ascunde imediat read model-ul și apoi înregistrează acțiunea
de enforcement/tombstone; indisponibilitatea chain-ului nu obligă platforma să lase
conținut ilegal vizibil.

### Search și conversație

- local/global, radius, hartă și city/region;
- full-text, typo tolerance, category facets și price ranges;
- saved searches/alerts, favorite și comparison;
- profile seller, verification, member age și reputation pe domeniu;
- offer/counteroffer cu expirare și tx per pas;
- structured chat card cu listing version/hash și warning anti-scam;
- share către feed/story/group păstrează același listing ID.

### Safety și categorii interzise

Nu se poate cumpăra/vinde literalmente orice. Sunt interzise cel puțin bunurile
ilegale, furate, contrafăcute, drogurile, armele/munițiile fără cadru permis,
exploatarea, documentele și conturile, malware-ul, datele personale și serviciile
frauduloase. Bunurile reglementate se activează numai cu policy și verificare locală.

Marketplace implementează trader/non-trader, GPSR/Safety Gate, recalls, notice and
action, ranking/ad disclosure, prohibited-goods rules și audit al moderatorilor.

## 9. Acceptance criteria

- registry-ul tuturor endpoint-urilor mutabile are clasificare completă;
- testul automat eșuează dacă o mutație confirmată nu are tx hash unic;
- niciun tx Action Ledger nu conține PII/plaintext privat;
- exact un action event este acceptat pentru fiecare action nonce;
- reducer replay produce aceeași stare ca producția;
- revoke capability oprește orice nonce ulterior;
- un wallet nu vede popup la fiecare social action după setup;
- fiecare UI object afișează pending/confirmed/failed și explorer link unde este sigur;
- listing create/edit/renew/close, favorite și offer au tx distinct;
- prohibited listing poate fi ascuns imediat chiar dacă tombstone tx este pending;
- sponsorship are caps și nu poate goli treasury peste bugetul configurat.

Surse tehnice: [MultiversX transactions](https://docs.multiversx.com/learn/transactions/),
[Crypto API](https://docs.multiversx.com/developers/developer-reference/sc-api-functions/),
[events](https://docs.multiversx.com/developers/developer-reference/sc-annotations/),
[relayed transactions v3](https://docs.multiversx.com/developers/relayed-transactions/).
