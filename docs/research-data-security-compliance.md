# Nexus — arhitectură off-chain, date, securitate și conformitate UE

> Notă: acest research snapshot precede Mobility, Action Ledger și Marketplace
> generalist. Cerințele normative sunt integrate în documentele `00`–`09`.

**Versiune:** 0.9 — propunere pentru decizie de arhitectură  
**Data de referință:** 1 august 2026  
**Domeniu:** backend, model de date, API/evenimente, feed și media, chat E2EE, moderare, privacy, securitate, audit și hartă de conformitate UE

> **Limită importantă:** această secțiune conține specificații tehnice și o cartografiere informativă a obligațiilor juridice. Nu este o opinie juridică, fiscală ori de autorizare și nu înlocuiește analiza unui avocat calificat în statul de stabilire și în statele în care Nexus operează. Încadrarea concretă depinde de entitatea juridică, fluxul banilor, custodia cheilor, termenii contractuali, țările și categoriile de utilizatori. Înainte de mainnet și de accesul public trebuie obținute opinii juridice scrise pentru GDPR/DSA, servicii de plată/crypto, DAC7, protecția consumatorilor, cazare și dating.

## 1. Decizii executive

1. **Produs hibrid, nu „totul on-chain”.** Blockchain-ul păstrează proprietatea, drepturile, sumele blocate, decontările, badge-urile și hash-uri de audit. Conținutul, datele personale, mesajele, preferințele, grafurile sociale, calendarul și semnalele algoritmice rămân off-chain. Datele private nu se publică pe blockchain sau IPFS.
2. **Nexus nu custodiază cheile și, în prima versiune, nu custodiază fonduri în conturi omnibus.** Utilizatorul semnează; escrow-ul este determinist în contract, iar conversia fiat/crypto și verificările financiare sunt delegate unor PSP/CASP autorizați. Această alegere reduce, dar nu elimină, riscul MiCA/PSD2/AML.
3. **Un wallet nu poate oferi separare publică perfectă între profiluri.** Tranzacțiile semnate de aceeași adresă sunt corelabile. Pentru separare se folosesc smart-account/sub-conturi, chei de sesiune limitate și meta-tranzacții sponsorizate; backend-ul nu expune adresa wallet în API-urile publice. Interfața trebuie să explice utilizatorului limita, fără promisiuni false de anonimat.
4. **Profilurile sunt domenii de privacy distincte.** Work, Social, Dating, Travel și Marketplace au identificatori, politici, grafuri și indexuri separate. Corelarea între ele este refuzată implicit și permisă doar printr-un `ProfileLinkGrant` revocabil.
5. **Dating este 18+ de la lansare.** Social poate fi inițial tot 18+ pentru reducerea substanțială a riscului; dacă este deschis minorilor, se activează un produs separat „minor-safe”, cu privacy maxim implicit, mesagerie restrictivă, fără dating, fără reclame profilate și cu age assurance proporțional.
6. **E2EE real pentru conversații, cu metadate minime.** Serverul nu deține cheile de conținut. Raportarea abuzului este voluntară și client-side: utilizatorul selectează mesaje, iar clientul le recriptează către cheia echipei de siguranță. Mesajele „on-chain” nu sunt mesaje, ci cel mult hash-uri și confirmări de acțiuni comerciale.
7. **Fără token Nexus transferabil în MVP.** EGLD și token-uri ESDT acceptate după analiză sunt suficiente. Recompensele timpurii sunt puncte netransferabile off-chain; badge-urile sunt NFT/SFT netransferabile sau cu transfer restricționat. Un token propriu aduce cost, volatilitate, fraudă și risc MiCA fără a rezolva o nevoie de produs.
8. **Moderare auditată și contestabilă.** Orice limitare de conținut/profil are motiv codificat, explicație pentru utilizator, posibilitate de apel și jurnal imuabil intern. Sistemele automate prioritizează și propun; deciziile cu impact mare sunt revizuite uman.

## 2. Arhitectura off-chain

### 2.1 Diagramă textuală

```text
Mobile React Native / Web Next.js / Admin Console
   │ HTTPS, WebSocket, signed uploads, wallet signatures
   ▼
Edge: CDN + WAF + Bot Management + API Gateway
   │
   ├── Auth & Session ───── MultiversX gateway/indexer + relayer
   ├── Profile & Privacy ── policy engine (ABAC), consent/visibility graph
   ├── Social Graph ─────── follows, connections, blocks, profile links
   ├── Feed ─────────────── candidate retrieval → policy filter → ranker
   ├── Content ──────────── posts, comments, stories, reports, appeals
   ├── Media ────────────── upload orchestrator → queue → transcode/moderate
   ├── Messaging API ────── Matrix-compatible E2EE service / key directory
   ├── Marketplace ──────── products, orders, disputes, Safety Gate workflow
   ├── Travel ───────────── listings, availability, bookings, cancellations
   ├── Dating ───────────── preferences, candidates, private match graph
   ├── Reputation ───────── projections from verified domain events
   ├── Payments ─────────── intent orchestration; never holds private keys
   ├── Notifications ────── push/email/in-app with redacted payloads
   ├── Search ───────────── profile-specific, privacy-filtered indexes
   └── Trust & Safety ───── notice/action, queues, enforcement, transparency
   │
   ▼
Event backbone: Kafka (production) / Redpanda; schema registry; outbox pattern
   │
   ├── PostgreSQL 16: source of truth per bounded context
   ├── Redis 7: cache, rate limits, ephemeral presence; never durable truth
   ├── OpenSearch: public/searchable projections only
   ├── Object storage EU: originals/encrypted media/HLS + lifecycle rules
   ├── Data warehouse EU: pseudonymous analytics, access-restricted
   ├── KMS/HSM + secrets manager + append-only audit store
   └── IPFS pinning: only assets deliberately public and permanence-safe
```

### 2.2 Stil arhitectural și limite

- **MVP:** modular monolith NestJS pentru domeniile tranzacționale, workers separat pentru media/feed/notifications și un serviciu separat de messaging. Evită costul operațional al microserviciilor premature.
- **Scale-out:** extragere în servicii după limitele de domeniu și metrici reale. Marketplace/Travel, Feed, Media și Trust & Safety sunt primii candidați.
- **Sursă de adevăr:** PostgreSQL. Orice mutație scrie starea și un eveniment în aceeași tranzacție prin transactional outbox; publisher-ul livrează at-least-once. Consumatorii sunt idempotenti.
- **Consistență:** puternică pentru bani, rezervări, permisiuni, block și enforcement; eventuală pentru counts, search, feed și reputation projections.
- **Regiune:** datele personale UE sunt procesate implicit în regiuni UE/SEE. Orice transfer în afara SEE este inventariat, justificat și acoperit de mecanismul GDPR aplicabil, cu transfer impact assessment și măsuri suplimentare.
- **Availability:** multi-AZ pentru PostgreSQL/queue/object storage; RPO ≤ 5 minute și RTO ≤ 60 minute pentru fluxurile comerciale, RPO ≤ 15 minute/RTO ≤ 4 ore pentru funcțiile sociale.
- **Observability:** OpenTelemetry, loguri structurate fără corpuri de mesaje/token-uri/date sensibile, metrics și traces cu ID-uri pseudonime, SLO și alerte.

### 2.3 Bounded contexts

| Context | Responsabilitate | Nu are voie să facă |
|---|---|---|
| Identity | wallet challenge, cont, device, session, recovery | să expună public wallet-ul sau să țină seed/private key |
| Profile/Privacy | profiluri, switch, visibility, link grants, ABAC | să copieze automat atribute între profiluri |
| Social | follows, connections, groups, blocks | să ocolească un block prin alt profil |
| Content/Media | postări, video, comentarii, stories, rights | să publice asset privat pe IPFS |
| Feed | retrieval, ranking, explanations, controls | să folosească orientare sexuală/biometrie ori semnale cross-profile nepermise |
| Dating | discovery, like, match, safety | să emită evenimente publice sau să indexeze profilul public |
| Commerce | listing, booking/order, cancellation, dispute | să decidă unilateral transferul on-chain fără regulile escrow |
| Messaging | rooms, device keys, ciphertext, receipts | să primească chei private sau plaintext în backend |
| Reputation | dovezi și scoruri per domeniu | să producă un scor opac unic care afectează toate domeniile |
| Trust & Safety | notices, review, sanctions, appeals | să modifice dovada originală ori să emită sancțiuni nemotivate |
| Compliance | requests, retention holds, export/delete, DAC7 | să folosească datele colectate pentru compliance în ads/ranking |

## 3. Clasificarea datelor: on-chain, off-chain, IPFS

| Dată | Loc recomandat | Regula |
|---|---|---|
| adresa wallet principală | off-chain criptat; on-chain inevitabil la tranzacții | nu apare în răspunsuri publice; acces strict |
| identificator profil și tip | off-chain; commitment/hash on-chain dacă e necesar | ID public aleator, nu derivat din wallet |
| nume, bio, avatar | off-chain; IPFS numai la alegerea explicită pentru profil public | ștergere și versiuni controlate |
| CV, experiență, recomandări | off-chain criptat; hash/revocation registry on-chain | fără document sau date personale on-chain |
| orientare, preferințe dating, locație exactă | off-chain criptat pe câmp/tenant | categorie foarte sensibilă; nu on-chain/IPFS/search public |
| template biometric/liveness | ideal la furnizor, scurt-lived | Nexus păstrează rezultat și dovadă, nu selfie/template brut |
| video public | object storage + CDN; IPFS opțional după rights check | CID-ul face ștergerea practică incertă; nu pentru stories/private |
| video privat/draft/story | object storage criptat și lifecycle | niciodată IPFS; URL semnat scurt |
| mesaje | ciphertext în messaging store | nici plaintext, nici CID, nici hash per mesaj on-chain |
| listing public | PostgreSQL/search; hash/ID/preț/escrow on-chain după acceptare | datele de contact personale rămân off-chain |
| rezervare și adresă exactă | off-chain criptat; ID, termeni financiari și stare escrow on-chain | adresa dezvăluită doar părților la momentul potrivit |
| dovezi de reputație | evenimente off-chain + commitment on-chain | scoruri pe domenii; posibilitate de contestare |
| NFT badge | on-chain fără PII; metadata minimă | badge revocabil/expirabil; fără „Dating verified” public implicit |
| analytics/ranker features | feature store pseudonimizat, cu TTL | per profil; fără export către advertiser |
| audit | append-only off-chain, hash batches on-chain opțional | redacție PII și acces de tip break-glass |

**Regulă de publicare:** „public” nu înseamnă automat „permanent”. Înainte de pinning IPFS se cere o acțiune separată, se explică ireversibilitatea practică și se verifică drepturile asupra media. Chiar dacă Nexus oprește pinning-ul, alte noduri pot păstra conținutul.

## 4. Model de date și baze de date

### 4.1 Convenții

- UUIDv7/ULID pentru chei publice; PK intern poate fi UUIDv7. Niciun ID nu encodează wallet-ul.
- `created_at`, `updated_at`, `deleted_at`, `version` pe agregate; optimistic locking.
- bani ca `numeric(78,0)` în unitatea minimă și `token_identifier`; niciodată float.
- timestamp UTC `timestamptz`; intervalele de cazare ca `[start, end)`.
- date sensibile criptate cu envelope encryption: DEK per utilizator/domeniu, KEK în KMS; rotație și crypto-shredding.
- Row-Level Security pentru back-office și tabele sensibile; accesul aplicației prin roluri separate.
- Soft delete numai unde există nevoie operațională; purge real după expirarea retenției, exceptând legal hold.

### 4.2 Identity și profiluri

```text
users(
  id PK, wallet_address_enc UNIQUE, wallet_address_hmac UNIQUE,
  status, locale, country_claim, created_at, last_active_at, deleted_at
)
wallet_challenges(id, wallet_hmac, nonce_hash, domain, chain_id,
  issued_at, expires_at, consumed_at, ip_risk_id)
devices(id, user_id, public_device_key, platform, push_token_enc,
  trust_state, created_at, revoked_at, last_seen_at)
sessions(id, user_id, device_id, refresh_family_id, scopes,
  issued_at, expires_at, rotated_at, revoked_at)
profiles(id, user_id, type, handle, display_name, bio_enc, avatar_asset_id,
  visibility, lifecycle_status, created_at, deleted_at, version)
profile_attributes(id, profile_id, namespace, key, value_enc,
  sensitivity, provenance, verified_at, expires_at)
profile_link_grants(id, owner_profile_id, viewer_profile_id,
  revealed_profile_id, scopes, expires_at, revoked_at)
visibility_rules(id, resource_type, resource_id, subject_type,
  subject_id, effect, conditions_json, priority)
consent_records(id, user_id, profile_id?, purpose, notice_version,
  lawful_basis, choice, collected_at, withdrawn_at, evidence_hash)
```

`wallet_address_hmac` permite lookup determinist cu o cheie secretă separată; valoarea brută este criptată. `handle` poate fi unic în interiorul tipului de profil, nu global. `profile_link_grants` nu este listat public și poate fi unilateral revocat.

### 4.3 Graf social și siguranță

```text
relationships(id, source_profile_id, target_profile_id, type,
  state, audience, created_at, accepted_at, ended_at)
blocks(id, actor_user_id, target_user_id, actor_profile_id?, reason_code?, created_at)
groups(id, owner_profile_id, type, name, visibility, created_at)
group_members(group_id, profile_id, role, joined_at, left_at)
events(id, owner_profile_id, title, starts_at, ends_at, place_enc,
  visibility, capacity, payment_plan_id?, status)
event_members(event_id, profile_id, role, rsvp, share_amount_atomic)
safety_flags(id, subject_type, subject_id, source, severity,
  signal_json_redacted, expires_at, reviewed_at)
```

Un `block` se aplică la nivel de utilizator, chiar dacă UI-ul îl inițiază dintr-un profil. Aceasta împiedică recontactarea prin alt profil. Existența celorlalte profiluri nu este dezvăluită persoanei blocate.

### 4.4 Conținut, media și feed

```text
posts(id, author_profile_id, kind, caption, visibility, media_set_id,
  parent_post_id?, sound_id?, moderation_state, published_at, expires_at, deleted_at)
media_assets(id, owner_profile_id, kind, storage_key, content_hash,
  mime, bytes, duration_ms, width, height, status, encryption_mode,
  rights_state, moderation_state, ipfs_cid?, retention_class, deleted_at)
media_variants(id, asset_id, codec, container, bitrate, width, height,
  manifest_key, checksum, status)
comments(id, post_id, author_profile_id, parent_id?, body,
  moderation_state, created_at, deleted_at)
reactions(profile_id, target_type, target_id, type, created_at)
follows(follower_profile_id, followed_profile_id, status, created_at)
content_stats(target_type, target_id, views, likes, comments, shares,
  watch_ms, unique_viewers, updated_at)
interaction_events(id, pseudonymous_profile_key, session_id, event_type,
  target_id, value, occurred_at, expires_at)
feed_impressions(id, request_id, profile_key, item_id, position,
  model_version, reason_codes, shown_at, watched_ms, action)
```

Counters sunt projections și pot fi reconstruite. `interaction_events` are retenție scurtă și un profil key rotativ; evenimentele brute nu devin istoric permanent. Pentru duet/stitch, `parent_post_id` și rights state păstrează proveniența și permisiunea autorului.

### 4.5 Dating

```text
dating_profiles(profile_id PK, birth_date_enc, age_bucket, gender_enc?,
  orientation_enc?, approximate_geo_cell, discovery_state,
  verification_level, created_at)
dating_preferences(profile_id PK, age_min, age_max, distance_km,
  genders_enc?, intents_enc?, filters_enc, updated_at)
dating_actions(id, actor_profile_id, target_profile_id, action,
  created_at, expires_at)
matches(id, profile_a_id, profile_b_id, state, matched_at,
  conversation_id?, unmatched_at, safety_state)
dating_verifications(id, profile_id, vendor_ref_token, method,
  result, age_over_18, checked_at, expires_at, evidence_hash)
```

- Tabelul și backups sunt criptate separat; accesul operatorilor este break-glass și auditat.
- Nu există endpoint „cine m-a plăcut” care poate fi enumerat; acțiunile expiră și se șterg după politica stabilită.
- Coordonatele exacte nu sunt stocate pentru discovery. Se folosește o celulă geografică aproximativă și se introduce jitter; distanța afișată este interval, nu valoare exactă.
- Preferințele sau comportamentul Dating nu influențează Feed Work/Social, reclame, reputation sau căutarea publică.

### 4.6 Marketplace, Travel și plăți

```text
listings(id, owner_profile_id, domain, category, title, description,
  price_atomic, token_identifier, quantity, location_cell,
  exact_location_enc?, trader_status, status, chain_listing_id?, version)
listing_assets(listing_id, asset_id, sort_order)
product_compliance(listing_id, manufacturer, responsible_person,
  product_identifier, safety_info, safety_gate_state, checked_at)
availability(listing_id, date_range EXCLUDE overlap, state, source, version)
bookings(id, listing_id, guest_profile_id, host_profile_id,
  date_range, guests, price_snapshot_json, policy_snapshot_json,
  chain_escrow_id, status, version, created_at)
orders(id, listing_id, buyer_profile_id, seller_profile_id,
  quantity, amount_atomic, fee_atomic, token_identifier,
  chain_escrow_id, status, version, created_at)
payment_intents(id, aggregate_type, aggregate_id, payer_user_id,
  chain, token, amount_atomic, status, idempotency_key,
  expires_at, tx_hash?, confirmations, risk_state)
disputes(id, aggregate_type, aggregate_id, opened_by, reason,
  evidence_vault_ref, status, resolution, decided_by?, created_at, closed_at)
reviews(id, transaction_type, transaction_id, author_profile_id,
  subject_profile_id, domain, ratings_json, text, moderation_state, created_at)
seller_tax_profiles(id, user_id, country, tax_id_enc, identity_enc,
  due_diligence_state, reportable_state, updated_at)
dac7_ledger(id, seller_tax_profile_id, period, activity_type,
  consideration_atomic, fees_atomic, count, property_ref?, source_event_id)
```

`price_snapshot_json`, `policy_snapshot_json` și versiunile listing-ului fac disputa reproductibilă. Calendarul folosește constraint de excludere PostgreSQL și tranzacție serializable/row lock pentru a preveni double booking. Starea financiară off-chain se actualizează numai după confirmări on-chain și reconciliere; webhook-urile/indexer events sunt idempotente și nu sunt în sine autoritate.

### 4.7 Messaging

```text
conversations(id, type, domain_context, created_by_profile_id,
  encryption_protocol, policy_state, created_at)
conversation_members(conversation_id, profile_id, role,
  joined_epoch, left_epoch, notification_level)
device_key_packages(device_id, protocol_version, key_package,
  signature, published_at, consumed_at, expires_at)
message_envelopes(conversation_id, message_id, sender_device_id,
  epoch, ciphertext, content_type, sent_at, server_received_at, expires_at)
delivery_receipts(conversation_id, message_id, recipient_device_id,
  state, occurred_at)
key_transparency_entries(device_id, key_hash, tree_size,
  inclusion_proof, observed_at)
abuse_report_bundles(id, reporter_user_id, conversation_id,
  selected_ciphertext_refs, evidence_ciphertext_for_safety,
  reporter_statement_enc, created_at, retention_until)
```

Serverul vede apartenența, timestamp-urile și mărimea aproximativă; padding/batching reduc dar nu elimină metadatele. Push-ul conține doar `conversation_id` opac și „mesaj nou”, fără preview implicit.

### 4.8 Trust, audit și drepturile persoanei

```text
notices(id, reporter_ref, target_type, target_id, jurisdiction,
  allegation_codes, statement_enc, evidence_refs, status,
  submitted_at, decided_at)
moderation_cases(id, source_notice_id?, target_type, target_id,
  priority, queue, assignee?, policy_version, state, created_at)
moderation_decisions(id, case_id, action, territorial_scope,
  legal_basis_code?, tos_basis_code?, facts_summary, automation_role,
  decision_at, expires_at)
appeals(id, decision_id, appellant_user_id, grounds_enc,
  state, reviewer_id?, outcome, created_at, resolved_at)
audit_events(id, actor_type, actor_id, action, resource_type,
  resource_id, purpose, result, prev_hash, event_hash, occurred_at)
data_subject_requests(id, user_id, type, scope, identity_state,
  status, due_at, export_ref?, created_at, completed_at)
legal_holds(id, authority_ref, scope, reason_enc, starts_at, ends_at)
```

### 4.9 Retenție propusă (de validat juridic)

| Categorie | Retenție de produs propusă |
|---|---|
| challenge wallet | 10 minute; hash/anti-replay 24 ore |
| sesiuni revocate și device risk | 90 zile |
| video original nereușit/draft abandonat | 7/30 zile |
| stories | indisponibile după 24h; purge copii active ≤ 7 zile, backup conform ciclului |
| interaction events brute | 90 zile; agregate fără identificator până la 13 luni |
| locație precisă temporară | maximum durata sesiunii/serviciului; nu în analytics |
| dating like nereciproc | 90 zile sau la retragere; apoi purge |
| conversații | până la ștergerea utilizatorului/room policy; ciphertext purged conform alegerii, în limita obligațiilor |
| report evidence | durata cazului + perioada de contestare; de exemplu 12–24 luni în funcție de risc |
| documente comerciale/fiscale/DAC7 | perioada impusă de dreptul fiscal/contabil național; configurabilă per jurisdicție |
| audit securitate privilegiat | 12–24 luni; evenimente financiare conform obligațiilor aplicabile |
| backups | rolling 35 zile; restore urmat de reaplicarea tombstone ledger |

Politica finală trebuie să lege fiecare tabel/câmp de scop, temei, termen, trigger de ștergere și excepție legal hold. Ștergerea nu este doar `deleted_at`: un worker verificabil elimină obiecte, variante CDN, indexuri, cache, feature store și chei DEK; păstrează un tombstone minim pentru a preveni reimportul din backup.

## 5. API și contracte de evenimente

### 5.1 Reguli API

- REST JSON sub `/v1`; OpenAPI 3.1 generat și verificat în CI. WebSocket numai pentru evenimente realtime și sync messaging.
- Access token 5–10 minute; refresh token rotativ legat de device, reuse detection și revocarea familiei.
- `Idempotency-Key` obligatoriu pentru create booking/order/payment/report; răspunsul este memorat pe user+route+key.
- ETag/`If-Match` pentru profil, listing, calendar și setări; erorile folosesc RFC 9457 Problem Details.
- Cursor opac, nu offset, pentru feed/chat/listări. Limite per wallet, device, IP risk și profile; fallback accesibil pentru IP-uri partajate.
- Autorizația se face server-side prin ABAC la fiecare resursă: actor user, active profile, relationship, visibility, block, age, territory, enforcement și purpose.
- Un token de sesiune conține `sub=user_id`, `device_id`, `active_profile_id`, `session_version`, scopes; nu wallet și nu atribute sensibile.
- Toate răspunsurile sunt filtrate prin `AudienceProjection`, astfel încât câmpurile vizibile diferă după viewer. Cache key include viewer policy class și profile type.

### 5.2 Endpoint-uri esențiale

```http
POST /v1/auth/challenges
POST /v1/auth/wallet/verify
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/me

POST /v1/profiles
GET  /v1/profiles/{profileId}
PATCH /v1/profiles/{profileId}
POST /v1/profiles/{profileId}/activate
POST /v1/profile-links
DELETE /v1/profile-links/{grantId}
PUT  /v1/profiles/{profileId}/privacy

POST /v1/media/uploads                 -> presigned multipart session
POST /v1/media/uploads/{id}/complete
GET  /v1/media/{id}/status
POST /v1/posts
DELETE /v1/posts/{id}
POST /v1/posts/{id}/reactions
POST /v1/posts/{id}/comments
GET  /v1/feed?mode=for-you|following
POST /v1/feed/impressions:batch
GET  /v1/feed/explanation/{impressionId}
PUT  /v1/feed/preferences

GET  /v1/dating/candidates
POST /v1/dating/actions                {targetProfileId, action}
POST /v1/matches/{id}/unmatch
POST /v1/matches/{id}/safety-checkin

POST /v1/listings
PATCH /v1/listings/{id}
POST /v1/orders
POST /v1/bookings/quote
POST /v1/bookings
POST /v1/bookings/{id}/cancel
POST /v1/disputes
POST /v1/payment-intents
GET  /v1/payment-intents/{id}

POST /v1/conversations
POST /v1/conversations/{id}/members
GET  /v1/messaging/sync?since={cursor}
POST /v1/messaging/key-packages
POST /v1/messaging/envelopes:batch
POST /v1/conversations/{id}/report-bundle

POST /v1/notices
GET  /v1/notices/{id}
GET  /v1/moderation-decisions/{id}/statement
POST /v1/moderation-decisions/{id}/appeals
POST /v1/privacy/requests
GET  /v1/privacy/export/{oneTimeToken}
```

### 5.3 Wallet authentication

1. Clientul cere challenge cu `walletAddress`, `chainId`, `domain`, `devicePublicKey`.
2. Serverul emite nonce aleator 256-bit, o singură utilizare, TTL 5 minute, și mesaj canonic domain-bound: origin, chain, address, nonce, issued/expiry și action.
3. Wallet-ul semnează mesajul; backend-ul verifică semnătura cu SDK-ul MultiversX, address/chain/origin și consumă nonce-ul atomic.
4. La prima autentificare se creează user-ul; la revenire se emite sesiune legată de device. Operațiile sensibile cer step-up: o nouă semnătură cu payload-ul exact, nu doar JWT.
5. Meta-tranzacțiile includ intent hash, deadline, chain ID, nonce și limite de fee; relayer-ul nu poate schimba destinația/suma.

Protecții: anti-replay, anti-phishing domain binding, device attestation ca semnal (nu unic factor), refresh rotation, simulare tranzacție și afișare uman-lizibilă a sumei/tokenului/beneficiarului înainte de semnare.

### 5.4 Evenimente de domeniu

Envelope standard, versionat în schema registry:

```json
{
  "eventId": "019...",
  "eventType": "booking.confirmed.v1",
  "aggregateType": "booking",
  "aggregateId": "019...",
  "aggregateVersion": 7,
  "occurredAt": "2026-08-01T12:00:00Z",
  "producer": "commerce-api",
  "traceId": "...",
  "actor": {"type": "profile", "id": "..."},
  "privacyClass": "CONFIDENTIAL",
  "data": {}
}
```

Evenimente principale:

- `user.created`, `device.revoked`, `profile.created`, `profile.visibility.changed`, `profile.link.granted/revoked`;
- `relationship.changed`, `user.blocked`, `group.member.changed`;
- `media.uploaded`, `media.scan.completed`, `media.transcode.completed/failed`, `post.published/deleted`;
- `feed.impression`, `feed.feedback`, `model.deployed/rolled_back`;
- `dating.action.recorded` (topic strict, payload pseudonim), `match.created/ended`;
- `listing.published/suspended`, `booking.held/confirmed/cancelled/completed/disputed`, `order.*`;
- `payment.intent.created`, `chain.transaction.observed/finalized/reorged`, `escrow.released/refunded`;
- `message.abuse_reported` (fără plaintext în event bus);
- `notice.received`, `moderation.decision.issued`, `appeal.resolved`;
- `privacy.requested/completed`, `retention.purge.completed`, `security.incident.declared`.

Topic-urile Dating, Safety, Compliance și Payments au ACL și chei de criptare separate. Event bus nu conține media, documente, adrese exacte, mesaje sau token-uri de autentificare. Schema evolution este backward-compatible; contract tests blochează breaking changes.

## 6. Chat unificat cu E2EE

### 6.1 Alegere

Recomandarea este un **serviciu Matrix-compatible separat**, cu primitive E2EE mature și SDK crypto auditat, în locul unei criptografii inventate în NestJS. Pentru grupuri se poate evolua spre MLS (RFC 9420) doar după evaluarea maturității SDK-urilor mobile și audit. Nu se implementează manual Double Ratchet, Olm/Megolm sau MLS.

### 6.2 Proprietăți obligatorii

- cheie de identitate per device, semnată/confirmată prin sesiunea wallet;
- forward secrecy și post-compromise security conform protocolului ales;
- verificare device prin QR/emoji și key transparency log pentru detectarea substituirii cheilor;
- key rotation la adăugare/eliminare device/membru; un membru nou nu primește automat istoricul;
- backup de chei opțional, criptat client-side cu recovery key pe care Nexus nu o cunoaște;
- multi-device cu listă vizibilă și revoke; notificare în toate device-urile la device nou;
- attachments criptate client-side cu cheie aleatorie; blob-ul și thumbnail-ul sunt ciphertext;
- mesaje cu TTL și delete local/server ciphertext; nu se promite ștergerea copiilor deja decriptate de destinatari;
- receipts/typing/presence opt-in și mascate în Dating;
- separare de identitate: interlocutorul vede doar profilul folosit în room, exceptând granturile explicite.

### 6.3 Moderare compatibilă cu E2EE

- metadatele permit rate limits, anti-spam, graph-abuse detection și blocarea contactului, nu citirea mesajelor;
- clientul poate bloca, șterge, limita media și dezactiva previews înainte de acceptarea unei conversații;
- un report bundle conține numai mesajele selectate și context limitat, recriptate în client pentru Trust & Safety; UI-ul arată exact ce se trimite;
- dispozitivul semnează bundle-ul și include hash-chain local pentru integritate, fără a pretinde că dovedește adevărul absolut;
- sistemul nu face client-side scanning general al mesajelor private. Orice viitoare obligație/derogare trebuie analizată separat, iar schimbarea modelului de confidențialitate cere DPIA și notificare transparentă.

### 6.4 Acțiuni comerciale în chat

Mesajul poate include un `action_card` semnat cu un ID de booking/order/payment. Detaliile autoritative se încarcă din API și se verifică on-chain; cardul chat nu poate muta bani. Pe chain se poate scrie hash-ul acceptării termenilor și starea escrow, nu conversația sau hash-uri individuale ușor de corelat.

## 7. Feed, recomandări și media

### 7.1 Pipeline feed

```text
request(active profile, context)
 → eligibility/privacy/block/age/territory filter
 → candidate sources:
      following, social graph, interests, exploration, locality, freshness
 → safety/quality/dedup filter
 → lightweight ranker
 → diversity/fairness/fatigue rules
 → final policy filter (fail closed)
 → response + reason codes + impression logging
```

MVP ranker: model gradient-boosted/logistic ori rules + calibrated scores. Obiectiv multi-task cu guardrails, nu doar watch-time:

```text
score = completion + meaningful_positive + follow_intent + quality
        - fast_skip - hide/report - repetition - safety_risk - fatigue
```

Semnale admise: acțiuni din profilul activ, topic-uri alese, follow graph al profilului, limbă/țară aproximativă, freshness și calitate. Semnale interzise: conversații private, wallet balance, valoarea tranzacțiilor, Dating, biometrie, sănătate, orientare sexuală, inferențe sensibile sau legături între profiluri fără consimțământ specific.

Controale utilizator:

- Following cronologic și For You;
- „de ce văd asta?”, „nu mă interesează”, resetarea intereselor, topic controls;
- istoric și ștergere semnale de personalizare;
- opțiune neprofilată bazată pe follow/freshness, obligatorie dacă Nexus devine VLOP și recomandată de la MVP;
- boost-urile sunt etichetate clar și nu pot ocoli safety/policy.

Guvernanță: model card, dataset lineage, feature allowlist, offline evaluation, bias/safety tests, A/B cu stop conditions, canary, rollback, version la fiecare impression și audit al schimbărilor. Dating are ranker complet separat, fără „beauty score”, emotion recognition sau predicții de vulnerabilitate.

### 7.2 Upload și procesare video

1. `POST /media/uploads` verifică quota, drepturile declarate și emite multipart URLs către bucket quarantine.
2. Clientul urcă direct; serverul validează magic bytes, mime, size, checksum și finalizează atomic.
3. Worker izolat scanează malware, decompression bombs, metadata periculoasă; elimină EXIF/GPS.
4. Audio/video este decodat într-un sandbox fără network și cu limite CPU/RAM/time.
5. Trust & Safety rulează perceptual hash, politici cunoscute și clasificatoare cu praguri; cazurile neclare intră în review.
6. FFmpeg produce master mezzanine și HLS adaptive (de exemplu 360p/540p/720p/1080p dacă sursa permite), thumbnails și captions; fiecare variantă are checksum.
7. Asset READY este mutat în bucket serving; CDN folosește signed URLs/tokenized manifests pentru audiențe nepublice.
8. Publicarea se produce numai după drepturi, moderare și privacy. Failed assets se purgă după termen.

Live streaming este Phase 2: ingest RTMP/SRT/WebRTC la furnizor specializat, latență segmentată, delay buffer, rate limits, moderator kill switch, raid protection și record doar conform notice/consent. Nu se construiește transcoding live global în MVP.

### 7.3 Drepturi media

- sound library licențiată pe teritoriu și usage type; fingerprint la upload;
- provenance pentru duet/stitch; autorul poate dezactiva reutilizarea viitoare;
- notice copyright separat și repeat-infringer policy, cu counter-notice adaptat jurisdicției;
- watermarking nu substituie licența;
- generative/synthetic media poate primi provenance/label, iar conținutul comercial este declarat și etichetat.

## 8. Moderare și Trust & Safety

### 8.1 Taxonomie minimă

`ILLEGAL_CONTENT`, `CSAM`, `TERRORISM`, `THREAT_VIOLENCE`, `HARASSMENT`, `HATE`, `NON_CONSENSUAL_INTIMATE`, `SEXUAL_EXPLOITATION`, `SELF_HARM`, `SCAM_FRAUD`, `IMPERSONATION`, `DATING_SAFETY`, `UNSAFE_PRODUCT`, `COUNTERFEIT`, `COPYRIGHT`, `PRIVACY_DOXXING`, `SPAM_MANIPULATION`, `MINOR_SAFETY`.

### 8.2 Flux notice-and-action

1. Raport accesibil și fără autentificare unde DSA o cere, cu target exact, motiv, explicație și date de contact după caz.
2. Confirmare și case ID; triere automată doar pentru prioritate/duplicare.
3. Preservare minimă a dovezii și legal hold dacă este justificat.
4. Revizuire conform SLA bazat pe risc: urgență pentru pericol iminent/CSAM, rapid pentru fraudă/produs periculos, standard pentru încălcări ToS.
5. Decizie proporțională: no action, demotion, age/geo restriction, disable monetization, remove, freeze listing, suspend profile/user.
6. Statement of reasons: fapte relevante, baza ToS/legală, teritoriu/durată, rolul automatizării și calea de apel.
7. Apel la reviewer diferit; restaurare/reparare counts și reach dacă decizia este inversată.
8. Eveniment pentru transparency reporting și, când este aplicabil, transmitere către baza DSA/autoritate prin workflow aprobat.

### 8.3 Reguli operaționale

- cozi distincte pentru Social, Dating, Marketplace safety și cazuri juridice;
- least privilege, acces just-in-time, redaction, watermark și jurnalizare pentru reviewers;
- wellness/rotație pentru moderatorii expuși la conținut sever;
- quality sampling, inter-rater agreement și audit de bias pe limbă/țară/grup;
- clasificatoarele nu șterg definitiv singure decât pentru match-uri hash cu încredere foarte mare și proces juridic validat;
- recidiva este la nivel user, fără a dezvălui profilurile; sancțiunile au decay și posibilitate de contestare;
- fraud graph nu devine „social score” public.

## 9. Privacy by design

### 9.1 Principii aplicate

- purpose limitation și data minimisation la nivel de schemă/event/feature;
- privacy maxim implicit, în special Dating și conturi minori;
- fără pre-bifare, bundled consent sau dark patterns; retragerea la fel de simplă ca acordarea;
- profilul activ este vizibil permanent în chrome-ul aplicației; orice postare/tranzacție afișează profilul emitent înainte de confirmare;
- audience preview și „view as” pentru fiecare profil;
- export și ștergere self-service; exportul este criptat, expiră rapid și cere step-up;
- analytics folosește IDs pseudonime rotative și praguri de agregare; acces separat de producție;
- DPO/Privacy Engineering aprobă feature-urile cu date sensibile; DPIA înainte de Dating, biometrie, ranking la scară, minor safety și fraud profiling.

### 9.2 Matrice de vizibilitate

Ordinea de evaluare, fail-closed:

```text
global enforcement/territory/age
 → user-level block
 → resource lifecycle
 → owner audience rule
 → domain relationship
 → explicit profile-link grant
 → field-level redaction
```

Nicio regulă `PUBLIC` nu poate depăși un block, o restricție teritorială, o sancțiune sau protecția minorului. Search, notification, analytics și feed reutilizează același policy engine; nu reimplementează logică simplificată.

### 9.3 Identitate, verificare și biometrie

- verificarea este proporțională: wallet control pentru cont; document/KYC numai pentru plăți, host/trader ori obligație; liveness numai când riscul o justifică;
- furnizorul returnează un token și atribute minime (`over18`, `document_valid`, țară, expirare), nu copii de document în backend-ul general;
- separă **verificarea 1:1** („este aceeași persoană?”) de identificarea biometrică 1:N; a doua nu este necesară pentru Nexus și nu se folosește;
- fără emotion recognition, attractiveness/personality scoring sau inferarea orientării din imagini;
- selfie/template brut are TTL foarte scurt la furnizor, fără reutilizare la training; contractul definește roluri, subprocesatori, localizare, ștergere și audit;
- badge-ul public nu dezvăluie metoda sau date sensibile. Pentru Dating, badge-ul este vizibil numai în Dating.

## 10. Model de amenințări și controale

| Amenințare | Impact | Controale obligatorii |
|---|---|---|
| furt wallet / phishing signature | preluare cont și bani | domain-bound challenge, step-up, simulare și intent human-readable, device alerts, revoke sessions |
| replay / chain confusion | tranzacție repetată/greșită | nonce single-use, chain ID, deadline, contract/function/sumă în semnătură |
| relayer rău intenționat | schimbare destinație/fee | typed intent, caps, signature verify on-chain, allowlist methods |
| corelare profiluri prin wallet/telemetrie | outing Work↔Dating | sub-conturi/session keys, relayer, IDs opace, telemetry isolation, avertisment clar privind limitele chain |
| IDOR și cache leakage | date private între utilizatori | ABAC central, ownership tests, viewer-bound cache, negative authorization tests |
| insider / support abuse | acces Dating/chat/documente | JIT, dual approval, field encryption, break-glass, immutable audit, anomaly alerts |
| credential/session theft | account takeover | refresh rotation, secure enclave/keychain, cert pinning evaluat, device revoke, risk-based reauth |
| supply-chain compromise | RCE/exfiltrare | lockfiles, SBOM, signed builds, SLSA-oriented provenance, dependency scanning, minimal images |
| media parser exploit | RCE/DoS | sandbox worker, no network, limits, re-encode, patch cadence |
| upload malware/bomb | indisponibilitate/cost | size/type validation, quotas, antivirus, decompression/time limits |
| scraping și enumeration | stalking/dataset theft | nonsequential IDs, rate limits, bot defense, query budgets, honeytokens, no exact distance |
| stalking/doxxing/dating abuse | vătămare fizică | approximate location, block user-wide, consent chat, share-date safety, report rapid, no read receipts implicit |
| spam/Sybil | feed/chat fraudă | wallet + device + behavior risk, velocity limits, proof/step-up gradual; fără pay-to-bypass safety |
| recommender manipulation | radicalizare/fraudă/unfair reach | integrity signals, diversity caps, adversarial tests, explainability, rollback |
| marketplace fraud | pierderi și chargeback | trader verification, escrow state machine, shipment/evidence, risk holds, disputes |
| double booking / race | două rezervări | DB exclusion constraint + transaction/lock + on-chain idempotent escrow |
| oracle/indexer spoof/reorg | stare financiară falsă | multiple trusted endpoints, confirmations, event uniqueness, reconcile chain, reorg state |
| smart-contract bug | pierdere fonduri | invariant/property/fuzz/scenario tests, audit extern, caps, pause, timelock, bug bounty |
| E2EE key substitution | MITM chat | cross-signing, key transparency, device verification, key-change warnings |
| push/cloud leakage | dezvăluire conversații | generic push, opaque IDs, no plaintext previews implicit |
| backup restore resurrects deleted data | încălcare drepturi | tombstone ledger, purge-on-restore, crypto-shredding, restore drills |
| DDoS/cost exhaustion | downtime/factură | WAF, rate/cost quotas, backpressure, queue bounds, CDN |

### 10.1 Baseline de securitate

- threat modeling la fiecare epic și security acceptance criteria;
- TLS 1.3 extern, mTLS/workload identity intern; secrets doar în manager, rotație automată;
- KMS/HSM pentru KEK, relayer și chei operaționale; separarea atribuțiilor și multi-approval;
- SAST, DAST, SCA, secret scanning, IaC scanning, container scanning în CI;
- reproducible/signed artifacts, SBOM CycloneDX/SPDX și inventory continuu;
- segregare dev/staging/prod; fără date reale în non-prod; test data sintetică;
- pentest înainte de beta și anual/după schimbări majore; mobile, API, cloud, auth, business logic;
- incident response 24/7 pentru P0, forensic readiness, runbooks, tabletop de două ori/an;
- bug bounty după closed beta, cu safe harbor și SLA;
- business continuity și restore test trimestrial; chaos test pentru queue/indexer/provider failure.

## 11. Checklist de audit înainte de lansare

### Gate A — arhitectură și date

- [ ] Data inventory complet: câmp → scop → temei → owner → retenție → destinatari → regiune.
- [ ] Diagrame data-flow, trust boundaries și subprocesatori aprobate.
- [ ] DPIA semnat pentru multi-profile correlation, Dating, ranking, biometrie/age assurance și moderation.
- [ ] Test automat care dovedește separarea Work/Social/Dating și block user-wide.
- [ ] IPFS allowlist: niciun asset privat, temporar sau cu PII.
- [ ] Export/delete test end-to-end inclusiv cache, search, CDN, warehouse și backup tombstones.

### Gate B — aplicație și infrastructură

- [ ] Auth replay, origin/chain binding, refresh reuse și device revoke testate.
- [ ] OWASP ASVS/MASVS mapping și toate finding-urile Critical/High închise.
- [ ] Pentest independent API/mobile/cloud; re-test final.
- [ ] KMS/HSM, RBAC/JIT, break-glass, rotație secrets și audit logs verificate.
- [ ] SBOM, provenance, dependency policy și patch SLA în funcțiune.
- [ ] Restore, region/provider failover, DDoS și incident tabletop trecute.

### Gate C — E2EE

- [ ] Bibliotecă/protocol auditat; fără primitive crypto proprii.
- [ ] threat model multi-device, key substitution, recovery și lost device.
- [ ] test vectors, interoperability și external cryptography review.
- [ ] key transparency monitor și avertizare schimbare device.
- [ ] report bundle arată și trimite numai conținutul ales.
- [ ] push, logs, crashes și analytics nu conțin plaintext.

### Gate D — plăți și blockchain

- [ ] opinie scrisă privind MiCA/CASP, PSD2/EMT, AML/TFR și modelul non-custodial.
- [ ] niciun operator/aplicație nu poate semna în numele utilizatorului.
- [ ] invariant tests: conservation, authorization, replay, reentrancy, expiry, cancellation, dispute.
- [ ] audit smart contracts de minimum două echipe pentru escrow critic; remedieri re-auditate.
- [ ] multisig, timelock, caps inițiale, pause și incident communications.
- [ ] reconciliere indexer↔chain, reorg și stuck transaction runbooks.

### Gate E — Trust & Safety / conformitate

- [ ] terms/policies localizate, rezumat clar și versioning/evidence de acceptare.
- [ ] notice-action, statement of reasons și appeals testate inclusiv accesibilitate.
- [ ] DSA/GPSR points of contact, marketplace trader traceability și Safety Gate workflow.
- [ ] minor/dating safety, emergency escalation și moderator training.
- [ ] advertiser/boost labels și recommender explanations.
- [ ] DAC7 due diligence, ledger, reconciliation și reporting dry-run.
- [ ] privacy/security breach notification runbooks și matrice de autorități/termene.

## 12. Hartă de conformitate UE 2025–2026

### 12.1 GDPR și ePrivacy

GDPR impune, între altele, legalitate/transparență, minimizare, privacy by design/default, securitate, drepturi, reguli pentru categorii speciale și DPIA pentru procesări cu risc ridicat. Dating poate revela orientarea sexuală; biometria folosită pentru identificare unică este categorie specială. Art. 8 pornește de la 16 ani pentru consimțământul copilului la servicii ale societății informaționale, permițând statelor să coboare pragul până la 13; acest lucru nu stabilește singur vârsta contractuală sau accesul la Dating. Vezi textul oficial [Regulamentului (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

Controale Nexus: records of processing, DPO/representative unde se aplică, DPIA, consent ledger, age/country rules, DSR automation, breach workflow, SCC/transfer assessments, processor contracts, retention și separare profiluri. Consimțământul nu trebuie folosit ca temei universal; contract, obligație legală și interes legitim trebuie analizate pe operațiune. Marketingul direct, cookies/SDK storage și confidențialitatea comunicațiilor necesită și analiză ePrivacy conform [Directivei 2002/58/CE](https://eur-lex.europa.eu/eli/dir/2002/58/oj), plus implementarea națională.

Pentru biometrie, EDPB subliniază caracterul sensibil, riscurile de bias/discriminare și controlul persoanei; chiar dacă unele orientări au contexte specifice, ele sunt un reper de risc. Vezi pagina oficială EDPB despre [biometrie](https://www.edpb.europa.eu/topics/ai-and-technology/biometrics_en) și [opinia privind recunoașterea facială](https://www.edpb.europa.eu/news/facial-recognition-airports-individuals-should-have-maximum-control-over-biometric-data_ga). Decizia recomandată: verification 1:1 externalizată, fără bază biometrică Nexus și fără identificare 1:N.

### 12.2 Digital Services Act (DSA)

Nexus combină hosting, platformă socială, marketplace și travel platform. DSA cere, în funcție de încadrare și dimensiune, puncte de contact, termeni transparenți, notice-and-action, explicații pentru restricții, complaint handling, transparență ads/recommenders și trader traceability. Art. 25 interzice anumite dark patterns; art. 26 interzice ads profilate folosind categorii speciale; art. 27 cere parametrii principali ai recomandării; art. 28 impune protecție ridicată a minorilor și interzice ads profilate către minori când platforma știe cu suficientă certitudine. Text: [Regulamentul (UE) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj).

Ghidurile Comisiei din 14 iulie 2025 recomandă măsuri de age assurance exacte, robuste, neintruzive și nediscriminatorii și protecții contra grooming, cyberbullying, design adictiv și conținut nociv. Ghidurile sunt neobligatorii, dar pot informa evaluarea conformității: [DSA Guidelines](https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines) și [anunțul privind protecția minorilor](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors).

Dacă ajunge VLOP (pragul legal relevant este în DSA, inclusiv desemnarea de către Comisie), apar obligații suplimentare: evaluări/mitigări de riscuri sistemice, audit, researcher data access, ad repository și opțiune principală de recomandare neprofilată. Arhitectura trebuie să păstreze din prima model/version/reason per impression și evidence pentru decizii, astfel încât migrarea să fie posibilă.

### 12.3 Marketplace, Travel și protecția consumatorilor

Marketplace trebuie să indice dacă vânzătorul este trader sau persoană privată, cum sunt împărțite obligațiile și când drepturile UE ale consumatorului nu se aplică. Trebuie furnizate informații precontractuale, preț total, taxe, anulare/rambursare și, unde se aplică, dreptul de retragere. Surse: [Consumer Rights Directive — Comisia Europeană](https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en), textul [Directivei 2011/83/UE](https://eur-lex.europa.eu/eli/dir/2011/83/oj) și [Directiva (UE) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj). Excepțiile pentru cazare la date/perioade specifice, servicii deja executate și conținut digital trebuie mapate exact; nu se presupune automat un drept de 14 zile pentru orice booking.

Pentru produse de consum, GPSR impune obligații specifice marketplace-urilor: puncte de contact, înregistrare Safety Gate, procese interne, informații de trasabilitate/siguranță înainte de publicare, răspuns la ordine/notices, prevenirea reapariției și comunicarea recall-urilor. Vezi [Regulamentul (UE) 2023/988](https://eur-lex.europa.eu/eli/reg/2023/988/oj). Modelul `product_compliance` și Safety Gate worker sunt cerințe de lansare, nu backlog cosmetic.

Business users/hosts/traders primesc și transparență asupra termenilor, suspendării și parametrilor principali de ranking, inclusiv influența plății asupra ranking-ului, conform [Regulamentului Platform-to-Business (UE) 2019/1150](https://eur-lex.europa.eu/eli/reg/2019/1150/oj). Boost-urile trebuie descrise și etichetate.

Licențele/înregistrările locale pentru cazare, obligațiile de gazdă, taxe turistice, limite municipale și răspunderea pentru servicii diferă pe stat/oraș. Lansarea Travel necesită country playbook și blocarea jurisdicțiilor neverificate.

### 12.4 DAC7 și fiscalitate platforme

DAC7 acoperă operatori de platforme și activități precum închirierea de proprietăți imobiliare, servicii personale și vânzarea de bunuri; presupune colectare/verificare de date despre selleri și raportarea informațiilor de identificare și financiare. Pagina oficială a Comisiei confirmă că obligația revine operatorului și acoperă operatori UE și, în anumite situații, non-UE: [DAC7 — Taxation and Customs Union](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/dac7_en); textul este în [Directiva (UE) 2021/514](https://eur-lex.europa.eu/eli/dir/2021/514/oj).

Nexus are nevoie de seller onboarding, tax residence/TIN verification, property identifiers, ledger imuabil al consideration/fees/refunds și export anual reconciliat. Colectarea trebuie separată de profilul public și făcută înainte ca pragurile/termenele aplicabile să fie depășite. Stabilirea excluderilor și a sellerilor raportabili este muncă fiscală pe jurisdicție, nu o regulă hard-coded universală.

### 12.5 Plăți, escrow, MiCA, AML și Travel Rule

MiCA reglementează emiterea anumitor crypto-assets și servicii precum custody/admin, trading, exchange, execution și transfer; un furnizor de crypto-asset services poate necesita autorizare și obligații de conduită/custody. Text oficial: [Regulamentul (UE) 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj). Transferurile prin CASP sunt supuse informațiilor originator/beneficiary și controalelor din [Regulamentul (UE) 2023/1113](https://eur-lex.europa.eu/eli/reg/2023/1113/oj). Pentru e-money tokens există și interacțiune cu PSD2; EBA a publicat o opinie specifică privind [interacțiunea PSD2–MiCA pentru EMT](https://www.eba.europa.eu/publications-and-media/press-releases/eba-publishes-no-action-letter-interplay-between-payment-services-directive-psd23-and-markets-crypto).

Control de produs: Nexus nu păstrează seed/private keys, nu promite conversie, nu menține sold intern retragibil și nu comingle fonduri. Escrow-ul smart-contract trebuie analizat funcțional: „decentralizat/non-custodial” nu este o scutire automată. Pentru fiat/on-ramp/off-ramp, refunds și eventual EMT se integrează PSP/CASP autorizat; providerul face KYC/AML/sanctions/travel-rule acolo unde îi revine, iar contractele definesc responsabilitățile și webhook evidence. Înainte de lansare este obligatoriu un legal classification memo și un diagram funds-flow pentru fiecare token și fiecare țară.

### 12.6 Dating, minori și verificare biometrică

Nu există o singură „lege UE a dating-ului” care să rezolve produsul. Se suprapun GDPR (inclusiv categorii speciale și profiling), DSA, consumer law, drept penal/ordine de protecție și reguli naționale de vârstă. Decizia Nexus este Dating 18+, age assurance proporțional, privacy by default, locație aproximativă, contact numai după match/consimțământ, block user-wide, unmatch fără notificarea poziției, safety reporting și interdicție de inferențe sensibile.

AI Act interzice anumite practici și reglementează categorii de sisteme AI; definițiile și regulile pentru biometric categorisation/emotion recognition sunt relevante pentru verificări și filtre. Text: [Regulamentul (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj). Nexus nu implementează biometric categorisation bazată pe atribute sensibile, emotion recognition sau scoring de „atractivitate/personalitate”. Furnizorii AI de moderare/verificare intră în AI inventory, cu rol (provider/deployer), intended purpose, instructions, logging, human oversight și calendarul de aplicare verificat înainte de utilizare.

### 12.7 NIS2 și securitate operațională

NIS2 include în anexele/categoriile sale furnizori de online marketplaces și social networking services platforms, în funcție de praguri, stabilire și implementarea națională. Pentru entități în scope impune management de risc și raportarea incidentelor semnificative, inclusiv early warning în 24h, notification în 72h și raport final într-o lună, conform textului [Directivei (UE) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj). Nexus trebuie să adopte baseline-ul chiar înainte de confirmarea încadrării și să verifice legea de transpunere din țara de stabilire.

### 12.8 Matrice de lansare

| Domeniu | Decizie înainte de beta | Dovadă de control |
|---|---|---|
| GDPR | roluri controller/processor, temeiuri, DPIA, transfers | ROPA, DPIA, DPA/SCC, DSR test |
| DSA | încadrare, contact, notice/action/appeal, transparency | policy + case audit + reports |
| minors | 18+ sau produs minor-safe separat | age assurance DPIA, default matrix |
| Marketplace/GPSR | trader KYC și product safety | Safety Gate registration/workflow |
| Travel | țări/orașe permise, host licensing/tax | country playbook și geo gates |
| Consumer | trader status, terms, cancellation/refund | checkout snapshots și refund tests |
| DAC7 | operator/reportable seller/activity | due diligence + annual dry-run |
| MiCA/PSD2/AML | funds/token/service classification | legal memo + licensed partners |
| Dating/biometric | 18+, special data basis, vendor role | DPIA + vendor audit + deletion proof |
| AI Act | inventory și rol pentru fiecare sistem | AI register/model cards/oversight |
| NIS2 | entity threshold și country transposition | security program + report runbook |

## 13. Tokenomics recomandată

### 13.1 MVP: fără token propriu

**Unități economice:**

- EGLD pentru plăți native/tips unde utilizatorul acceptă volatilitatea;
- unul sau mai multe ESDT-uri adecvate doar după verificarea issuer-ului, lichidității și încadrării (pentru stable-value este preferată integrarea cu un emitent/provider conform);
- `Nexus Points` off-chain, netransferabile, fără convertibilitate, fără promisiune de valoare și fără drept la profit;
- badge/achievement NFT netransferabil sau transfer-restricționat, revocabil și expirabil; nu este vândut ca investiție;
- ticket NFT cu transfer controlat/refund rules și metadata fără date personale.

**Venituri:** fee transparent per marketplace/booking, creator/tip fee, boost publicitar etichetat și abonament premium. Fee-ul este calculat și afișat înainte de semnare; contractul separă suma seller/creator, fee-ul Nexus și eventual taxă/dispute reserve. Creator Fund este buget comercial în fiat/EGLD cu criterii publice, anti-fraud și fiscal reporting, nu yield sau staking return.

### 13.2 De ce tokenul propriu este amânat

Un token transferabil poate intra sub MiCA și poate necesita clasificare, white paper, comunicări conforme și alte obligații în funcție de structură; activitățile de exchange/custody/transfer pot aduce cerințe CASP. Buybacks, revenue share, „investiție”, APY, staking pasiv sau promisiuni de apreciere cresc riscul de altă încadrare financiară și de practici înșelătoare. Token rewards stimulează Sybil, wash trading, content farming și manipularea reputației. MiCA este aplicabilă majorității CASP din 30 decembrie 2024; autoritățile europene recomandă utilizatorilor să verifice autorizarea providerilor, conform [avertismentului comun al autorităților europene](https://www.eba.europa.eu/publications-and-media/press-releases/eu-supervisory-authorities-warn-consumers-risks-and-limited-protection-certain-crypto-assets-and).

### 13.3 Gate pentru un token Phase 3

Tokenul poate fi propus numai dacă există o utilitate tehnică pe care EGLD/ESDT existent/points nu o rezolvă și după:

1. legal classification opinion UE + țări target și analiza MiCA/market abuse/consumer/tax;
2. white paper și marketing review, dacă sunt cerute;
3. distribuție fără promisiune de profit, fără pay-to-win în dating/feed/reputation;
4. emissions cap, vesting on-chain transparent, treasury multisig/timelock;
5. anti-Sybil și limite de reward bazate pe acțiuni verificate, nu watch-time brut;
6. market manipulation surveillance și conflicte de interese;
7. audit contracts și governance incident plan;
8. votul token-holderilor limitat la parametri necritici; privacy, safety, legal compliance și fondurile utilizatorilor nu se decid prin popular vote.

Recomandarea fermă pentru 2026 rămâne: **nu lansa tokenul Nexus odată cu produsul**. Demonstrează product-market fit, fee economics și conformitatea escrow, apoi reevaluează.

## 14. Plan de implementare pentru această arie

### MVP foundation (0–4 luni)

- modular monolith, PostgreSQL/Redis/outbox, auth wallet, device/session, profile privacy engine;
- Social video VOD, media quarantine/transcoding, Following + For You explicabil;
- chat E2EE 1:1 și grupuri mici, device verification și report bundles;
- notice/action/appeal, audit, block user-wide, DSR/export/delete;
- Marketplace limitat la categorii/țări aprobate, non-custodial payment intents;
- fără IPFS pentru conținut privat, fără token, fără minori, fără live, Dating/Travel numai closed pilot.

### Beta controlled (4–9 luni)

- Dating 18+ după DPIA/vendor audit; Travel după country playbook și DAC7;
- search/feed scale, model governance, creator payouts prin partener;
- GPSR/Safety Gate, trader verification, disputes, tax ledger;
- pentest, crypto review, contract audit, incident drills, bug bounty privat.

### Scale/public (9–18 luni)

- live streaming cu provider, multi-region, Kafka/Redpanda și servicii extrase pe metrici;
- safety language coverage, transparency automation, researcher-readiness;
- NIS2 operational maturity, advanced fraud/risk și marketplace expansion;
- evaluare separată a produsului pentru minori; token numai dacă trece gate-ul Phase 3.

## 15. Criterii de acceptare ne-negociabile

1. Un utilizator Work nu poate descoperi existența profilului Dating prin API, search, feed, push, analytics ID sau URL, cu excepția unui grant explicit; corelarea publică posibilă prin aceeași adresă on-chain este explicată și redusă tehnic.
2. Niciun corp de mesaj sau attachment plaintext nu ajunge în log, analytics, crash report, push ori backend.
3. Nicio adresă exactă, preferință Dating, biometrică, CV sau document nu ajunge on-chain/IPFS.
4. Un block oprește contactul din toate profilurile țintei, fără a dezvălui lista acelor profiluri.
5. Nicio plată/booking nu este considerată finală doar pe baza unui webhook; există confirmare și reconciliere chain.
6. Orice restricție de conținut/profil are un statement of reasons și apel, exceptând limitările legale explicite documentate.
7. Delete/export este verificat end-to-end și poate fi demonstrat; backups nu reînvie datele șterse.
8. Feed-ul are opțiune neprofilată, reason codes, reset și feature allowlist; Dating nu alimentează alte rankere.
9. Lansarea cu bani reali este blocată până la funds-flow memo, audit smart contracts, pentest și parteneri autorizați unde este necesar.
10. Lansarea publică este blocată dacă DPIA, DSA workflow, GPSR/DAC7 pentru modulele active și incident response nu au owner, dovadă și test trecut.
