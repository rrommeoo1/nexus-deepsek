# Date, API și evenimente

## 1. Delimitare on-chain/off-chain

| Date | Sursa de adevăr | Observație |
|---|---|---|
| Wallet ownership și tranzacții | MultiversX | adresa este cheia criptografică, nu profil public |
| Escrow funds/status financiar | contract | DB este proiecție reconciliată |
| Badge/ticket ownership și revocare | ESDT + contract registry | PII nu intră în atribute |
| Profile manifest commitment | contract opțional | numai hash, versiune și controller |
| Agent manifest/controller/status | agent registry | agentul este etichetat și separat de om |
| Cont, profil complet, privacy | PostgreSQL | câmpuri sensibile criptate |
| Action existence/order/hash | MultiversX Action Ledger | fiecare mutație adultă are tx distinct; Kids este exceptat |
| Feed, follow, like, comment, swipe state | read model PostgreSQL | redus din tx; private payload criptat |
| Video/audio | object storage/CDN | IPFS numai opt-in/public permanent |
| Chat plaintext/ciphertext | Matrix ciphertext | fiecare mesaj are separat tx commitment |
| Search/ranking index | derivat | reconstruibil și filtrat prin privacy |
| Calendar availability UX | PostgreSQL | rezervările finanțate reconciliate cu chain |
| Reviews și dispute evidence | PostgreSQL/evidence vault | hash/commitment obligatoriu on-chain |
| Driver live location și traseu | Redis/geo stream cu TTL + vault limitat | niciodată on-chain; acces numai cursă/safety |
| Analytics | event lake pseudonimizat | retention și access separate |

## 2. Convenții de modelare

- UUIDv7 pentru ID-uri off-chain; `wallet_address` bech32 canonical și bytes unde
  ajută indexarea; toate timestamps sunt `timestamptz` UTC.
- Money: `token_identifier`, `token_nonce`, `amount_atomic numeric(78,0)`, plus
  `display_decimals` snapshot; niciodată float.
- Soft delete numai unde este necesar operațional; pentru privacy există purge
  jobs și tabele de retention, nu „deleted=true” permanent.
- Orice tabel contextual conține `profile_id`/`actor_profile_id` și tenant policy.
- Entitățile mutabile au `version` pentru optimistic concurrency.
- Evenimentele externe și plățile au idempotency keys unice.
- Orice mutație are `action_intent_id`, `client_action_nonce`, `action_tx_hash` și
  stare chain; read model-ul nu confirmă definitiv o acțiune fără tx reușit.
- PII sensibil este envelope-encrypted cu DEK per domeniu/record și KEK în KMS.

## 3. Scheme PostgreSQL

### `identity`

```text
accounts(
  id PK, primary_wallet_address UNIQUE, status, country_code, locale,
  age_gate_status, risk_tier, created_at, last_active_at
)
auth_identities(id PK, account_id FK, issuer, subject_hash, email_cipher?, scopes,
                linked_at, last_used_at, state, UNIQUE(issuer, subject_hash))
oauth_credentials(id PK, identity_id FK, token_ref_cipher, scopes, expires_at, state)
embedded_wallets(id PK, account_id FK, address UNIQUE, provider, custody_model,
                 key_version, recovery_policy_id, state, created_at)
wallet_recovery_factors(id PK, wallet_id FK, type, public_ref, state, verified_at)
wallet_links(
  id PK, account_id FK, address UNIQUE, role, verified_at, revoked_at,
  migration_state, proof_hash
)
devices(id PK, account_id FK, public_device_key, platform, push_token_cipher,
        trust_state, last_seen_at, revoked_at)
sessions(id PK, account_id FK, device_id FK, refresh_hash, expires_at, revoked_at)
terms_acceptances(id PK, account_id FK, document_type, version, content_hash,
                  accepted_at, wallet_signature_hash)
account_merge_cases(id PK, source_account, target_account, evidence_ref_cipher,
                    state, cooldown_until, completed_at)
consents(id PK, account_id FK, purpose, version, state, collected_at, withdrawn_at)
profiles(id PK, account_id FK, type, handle, display_name_cipher, bio_cipher,
         avatar_asset_id, visibility, discovery_state, status, version,
         chain_anchor_id, created_at, deleted_at)
profile_fields(id PK, profile_id FK, field_key, value_cipher/jsonb,
               visibility_policy_id, verified_claim_id, version)
profile_links(id PK, source_profile_id, target_profile_id, audience_policy_id,
              state, requested_at, accepted_at, revoked_at)
visibility_policies(id PK, owner_profile_id, audience_type, rules_json, version)
```

Tipurile includ `SOCIAL`, `WORK`, `DATING`, `TRAVEL`, `MARKET` și `MOBILITY`.
Constrângeri: `(account_id, type)` unic în MVP; handles unice per namespace;
Dating nu apare în endpoint-uri globale fără entitlement.

### `action_ledger`

```text
session_capabilities(id PK, account_id?, profile_id?, agent_id?, actor_kind,
                     session_public_key UNIQUE,
                     shard, scope_bits, max_actions, used_actions, valid_from,
                     expires_at, state, register_tx_hash, revoke_tx_hash?)
action_intents(id PK, account_id?, actor_kind, actor_profile_id?, actor_agent_id?,
               action_type, object_type,
               object_id, payload_hash, visibility_class, client_action_nonce,
               idempotency_key UNIQUE, session_capability_id, tx_hash UNIQUE?,
               chain_status, runtime_profile, failure_code?, created_at,
               network_accepted_at, ordered_final_at, executed_at)
action_private_payloads(action_intent_id PK, encrypted_blob_ref, commitment_salt_cipher,
                        retention_class, purge_at)
action_chain_events(network, contract_address, tx_hash, event_index, shard,
                    session_key_hash, action_nonce, action_type, object_commitment,
                    payload_hash, ordered_final, execution_status, executed_at, reduced_at,
                    PK(network, tx_hash, event_index))
network_capability_observations(network, gateway, epoch, protocol_version,
                                runtime_profile, evidence_hash, observed_at)
action_reducer_checkpoints(contract_address PK, shard, block_nonce, event_cursor,
                           state_hash, updated_at)
action_projection_versions(projection, version, last_rebuild_at, state_root)
```

Un reducer aplică acțiunile confirmate în ordine. Optimistic rows au
`pending_action_intent_id`; la eșec sunt rollback sau marcate pentru retry. Un
rebuild poate reconstitui likes/comments/follows/listing lifecycle din chain și
payload-urile disponibile. Nu există batch action: un `action_intent` are un tx.

### `graph`

```text
relationships(id PK, source_profile_id, target_profile_id, kind,
              state, created_at, accepted_at, version)
blocks(id PK, blocker_profile_id, target_profile_id?, target_account_hash?,
       scope, created_at, expires_at)
circles(id PK, owner_profile_id, name_cipher, type)
circle_members(circle_id, profile_id, added_at, PK(circle_id, profile_id))
```

`target_account_hash` este accesibil numai enforcement-ului pentru block global;
API-ul public lucrează cu profiluri.

### `content`

```text
posts(id PK, profile_id FK, kind, caption, audience_policy_id, status,
      source_post_id, sound_id, published_at, expires_at, moderation_state, version)
media_assets(id PK, owner_account_id, storage_key_cipher, checksum, mime_type,
             bytes, duration_ms, width, height, state, retention_class, cid?)
media_renditions(id PK, asset_id FK, codec, bitrate, width, height,
                 storage_key_cipher, manifest_kind)
comments(id PK, post_id, author_profile_id, parent_id, body, state, created_at)
reactions(id PK, subject_type, subject_id, profile_id, kind, created_at)
follows(source_profile_id, target_profile_id, created_at, PK(...))
saves(profile_id, post_id, collection_id?, created_at, PK(...))
sounds(id PK, owner_profile_id?, rights_type, license_region, source_asset_id,
       usage_policy, status)
stories(id PK, post_id UNIQUE, expires_at, archive_state)
```

Counters afișate sunt tabele/materialized aggregates derivate, nu coloane mutate
concurent la fiecare view.

### `feed`

```text
impressions(id/time partition, profile_id, post_id, request_id, position,
            source, model_version, occurred_at)
engagement_events(id/time partition, profile_id, post_id, event_type,
                  value, watch_ms, occurred_at, dedupe_key UNIQUE)
profile_preferences(profile_id PK, topics, languages, controls, reset_version)
ranking_experiments(id, name, config, start_at, end_at)
experiment_assignments(profile_id, experiment_id, arm, assigned_at)
```

Analytics raw are retenție scurtă; features și agregatele au documentație de scop.

### `media_watch` și recomandări

```text
channels(id PK, owner_kind, owner_id, handle UNIQUE, audience_policy, state)
channel_members(channel_id, account_id, role, permissions, PK(...))
videos(id PK, channel_id, kind=CLIP|WATCH|REPLAY, title, description,
       audience, age_rating, rights_state, moderation_state, manifest_id,
       scheduled_at, published_at, state, action_tx_hash)
video_localizations(video_id, locale, title, description, captions_asset_id, PK(...))
video_chapters(video_id, start_ms, title, PK(video_id, start_ms))
subscriptions(profile_id, channel_id, level, notification_mode, action_tx_hash, PK(...))
playlists(id PK, owner_profile_id, visibility, collaborative, action_tx_hash)
playlist_items(playlist_id, video_id, position, action_tx_hash, PK(...))
live_streams(id PK, channel_id, scheduled_at, state, latency_mode,
             provider_ref_cipher, replay_video_id, moderation_policy)
live_chat_messages(id/time partition, stream_id, actor_profile_id, body,
                   moderation_state, action_tx_hash, created_at)
recommendation_requests(id PK, profile_id?, surface, context_version,
                        model_version, consent_version, created_at)
recommendation_items(request_id, object_id, source, position, reason_codes, PK(...))
recommendation_feedback(id PK, profile_id, surface, object_id, kind,
                        action_tx_hash?, created_at)
```

Watch/view/progress events sunt telemetrie partiționată cu TTL și identificator
pseudonim rotit, nu wallet. Features sunt materializate separat pentru
Clips/Pulse/Watch/Dating/commerce; politica DB interzice join-ul Dating/Kids spre ads.

### `family_kids` — schemă și tenant separat

```text
family_groups(id PK, adult_account_id, country_policy_version,
              consent_version, consent_state, created_at)
child_profiles(id PK, family_group_id, age_band, locale, avatar_code, state)
child_parent_controls(child_profile_id PK, policy_json, version, updated_at)
kids_catalog_entries(country, age_band, video_id, editorial_state,
                     valid_from, valid_to, PK(...))
kids_history(child_profile_id, video_id, progress_cipher, updated_at, expires_at, PK(...))
kids_feedback(child_profile_id, video_id, kind, created_at, expires_at)
```

Child session are audience diferită, nu are `actorProfileId` adult și nu poate fi
folosită pe endpoint-uri Dating/Pulse/Market/Travel/Mobility/Wallet. Schemele Kids
nu sunt accesibile advertising-ului, agent network sau feature jobs adulte.

### `assurance` — control și release governance

```text
work_items(id PK, parent_id?, owner_agent, risk_class, state, normative_refs,
           dependencies, acceptance, created_at, updated_at)
control_definitions(id PK, objective, risk, owner_cell, frequency, threshold,
                    exception_policy, version, active_from)
control_runs(id PK, control_id, release_id?, population_ref, result,
             started_at, completed_at, evidence_index_hash)
findings(id PK, control_run_id, severity, affected_artifact, owner_agent,
         state, due_at, retest_run_id?, risk_acceptance_id?)
evidence_artifacts(id PK, release_id, kind, content_digest, storage_ref,
                   producer, immutable_at)
releases(id PK, artifact_digest, environment, gate, state, flags_caps,
         created_at, promoted_at)
release_approvals(release_id, approver_role, approver_id, decision, reason,
                  expires_at?, created_at, PK(...))
risk_acceptances(id PK, finding_id, accountable_owner, rationale,
                 compensating_controls, expires_at, state)
incidents(id PK, severity, commander, affected_domains, state, opened_at, closed_at)
```

Delivery poate scrie work items/remediation, dar nu poate rescrie un evidence artifact
după `immutable_at` și nu poate închide propriul finding fără retest NAC. Production
promotion este refuzat server-side dacă approvals/control results lipsesc.

### `node_network` — proiecția registrului și placement

```text
node_participants(id PK, owner_wallet?, reward_enabled, bond_ref?,
                  status, manifest_hash, created_at, updated_at)
nodes(id PK, participant_id?, peer_id UNIQUE, public_key, protocol_version,
      region_bucket, jurisdiction_bucket, status, last_seen_at)
node_capabilities(node_id, capability, limits_json, attestation_ref?,
                  valid_from, valid_to?, PK(...))
application_shards(id PK, domain, partition_key_hash, epoch, policy_class,
                   replica_target, state)
shard_replicas(shard_id, node_id, role, lease_from, lease_to,
               last_checkpoint_id?, state, PK(...))
node_checkpoints(id PK, shard_id, epoch, event_cursor, state_root,
                 signer_set_hash, chain_tx_hash?, created_at)
service_jobs(id PK, kind, shard_id?, requester, input_commitment,
             policy_class, quote_id?, state, deadline_at)
service_receipts(id PK, job_id, node_id, output_commitment, usage_json,
                 proof_ref?, signature, accepted_at?)
node_challenges(id PK, node_id, kind, challenge_commitment, response_ref?,
                result, expires_at)
node_settlements(id PK, node_id, owner_wallet, period, token, gross_atomic,
                 penalty_atomic, net_atomic, merkle_leaf, claim_tx_hash?)
```

PostgreSQL este un read model local, nu registrul canonic al nodurilor recompensate.
Evenimentele MultiversX reconstruiesc claims/bond/settlement; Nexus Event Protocol
reconstruiește replicile. Registrul public nu expune endpoint-uri private, adresă
legală, topologie exactă ori metadate care ar facilita atacuri. Nodurile deschise
pot transporta numai ciphertext pentru Dating/chat/location; nu primesc cheile,
plaintext Kids/KYC, autoritate de plată ori safety evidence.

### `work`

```text
work_profiles(profile_id PK, headline, availability, location_policy)
experiences(id PK, profile_id, organization, role, start_date, end_date, data)
educations(id PK, profile_id, institution, credential, dates, data)
skills(id PK, canonical_name)
profile_skills(profile_id, skill_id, level?, verification_id?, PK(...))
recommendations(id PK, author_profile_id, subject_profile_id, body_cipher,
                state, visibility, proof_hash, created_at)
organizations(id PK, owner_account_id, name, verification_state)
jobs(id PK, organization_id, author_profile_id, title, description,
     location, employment_type, status, published_at)
applications(id PK, job_id, applicant_profile_id, status, cover_cipher, created_at)
```

### `dating` — schemă și permisiuni separate

```text
dating_profiles(profile_id PK, birth_year_cipher, identity_cipher, intent_cipher,
                location_cell_cipher, visibility_mode, discoverable, version)
dating_preferences(profile_id PK, desired_identities_cipher, hard_filters_cipher,
                   soft_preferences_cipher, distance_bucket, version)
dating_media(profile_id, asset_id, position, reveal_policy, moderation_state)
swipes(id/time partition, actor_profile_id, target_profile_id, decision,
       occurred_at, dedupe_key, expires_at)
matches(id PK, profile_low, profile_high, state, matched_at, ended_at,
        conversation_id, UNIQUE(profile_low, profile_high))
dating_verification_claims(id PK, profile_id, kind, assurance_level, issuer,
                           issued_at, expires_at, revoked_at, evidence_ref_cipher)
dating_trust_signals(id PK, profile_id, kind, value_bucket, source, observed_at,
                     appeal_state, expires_at)
dating_meet_plans(id PK, match_id, owner_profile_id, plan_cipher, due_at, state)
dating_checkins(id PK, meet_plan_id, participant_profile_id, proof_hash,
                state, occurred_at)
ephemeral_media(id PK, conversation_id, sender_profile_id, ciphertext_ref,
                key_envelope_ref, policy, expires_at, state)
ephemeral_media_views(media_id, viewer_profile_id, opened_at, closed_at,
                      capture_signal, PK(media_id, viewer_profile_id))
```

Rolurile DB de analytics/search nu au acces la această schemă. Location se
calculează în serviciul Dating și se returnează ca bucket, nu coordonate. Genul,
orientarea/dorințele, intenția și filtrele nu intră în profilul global, ads, Pulse
sau feature store. `Dating Trust Passport` este o colecție de claims și semnale pe
domeniu; nu se materializează un scor uman unic.

### `pulse` — conversație publică/pseudonimă

```text
pulse_aliases(id PK, account_id, handle, display_name, bio, avatar_asset_id,
              mode, assurance_badges, state, created_at)
pulse_posts(id PK, alias_id, parent_id?, quote_post_id?, body, media_manifest,
            audience, expires_at?, state, action_tx_hash, created_at)
pulse_relationships(actor_alias_id, target_alias_id, kind, action_tx_hash,
                    created_at, PK(actor_alias_id, target_alias_id, kind))
pulse_lists(id PK, owner_alias_id, name, visibility, created_at)
pulse_list_members(list_id, alias_id, added_at, PK(list_id, alias_id))
context_note_candidates(id PK, post_id, author_alias_id, body, state, created_at)
context_note_ratings(note_id, rater_account_id, rating, quality_weight,
                     created_at, PK(note_id, rater_account_id))
pulse_trend_windows(topic, country, window_start, human_unique, synthetic_unique,
                    paid_unique, integrity_state, PK(topic, country, window_start))
```

`pulse_aliases.account_id` este accesibil numai serviciului Alias Vault și
Trust & Safety; API-ul public nu expune account/wallet. Aliasurile sunt stabile și
pot fi sancționate la nivel de cont. Voturile Community Context acceptă numai
conturi umane eligibile, niciodată `AGENT` sau `SYSTEM_TEST`.

### `commerce`

```text
market_categories(id PK, parent_id?, slug, name_i18n, state, schema_version)
market_category_schemas(id PK, category_id, version, json_schema,
                        search_facets, moderation_rules, active_from)
listings(id PK, seller_profile_id, mode=CLASSIFIED_ONLY|ESCROW_CHECKOUT,
         category_id, schema_version, title, description, attributes_json,
         price_type=FIXED|NEGOTIABLE|FREE|CONTACT, price_token?, price_atomic?,
         location_geo, condition, status, manifest_cid?, signed_manifest_hash,
         create_action_tx, version, published_at, expires_at)
listing_media(listing_id, asset_id, position)
listing_actions(listing_id, action_intent_id, kind, version, PK(...))
saved_searches(id PK, profile_id, query_json, alert_policy, create_action_tx)
offers(id PK, listing_id, buyer_profile_id, amount_atomic, token,
       expires_at, state, version, action_tx_hash)
orders(id PK, listing_id, buyer_profile_id, seller_profile_id, quote_id,
       chain_escrow_id, state, fulfillment_type, version, created_at)
fulfillments(id PK, order_id, carrier, tracking_cipher, handoff_hash, state)
product_compliance(id PK, listing_id, trader_status, manufacturer_cipher,
                   responsible_person_cipher, safety_info, recall_state)
```

Marketplace permite orice categorie activată de schema platformei și permisă în
jurisdicție. „Orice” nu ocolește prohibited/restricted goods policy. Imobiliarele,
vehiculele și serviciile sunt anunțuri generaliste; stays rezervabile continuă în
Travel, iar transportul de persoane în Mobility.

### `travel`

```text
travel_listings(id PK, host_profile_id, kind, title, description,
                public_geo, address_cipher, timezone, capacity, rules,
                status, chain_listing_key, version)
travel_units(id PK, listing_id, name, capacity, status)
availability(unit_id, local_date, state, source, version, PK(unit_id, local_date))
rate_plans(id PK, listing_id, token, nightly_atomic, fees_json, cancellation_policy_id)
booking_holds(id PK, unit_id, start_date, end_date, expires_at, owner_request_id)
bookings(id PK, listing_id, unit_id, guest_profile_id, host_profile_id,
         start_date, end_date, timezone_snapshot, quote_id, chain_escrow_id,
         state, version, created_at)
cancellation_policies(id PK, owner_profile_id, rules_json, version)
```

Exclusion constraint Postgres/PostGIS sau range types previne overlap-ul hold-urilor
active; starea finanțată este reconciliată cu inventory guard on-chain.

### `mobility`

```text
mobility_profiles(profile_id PK, rider_enabled, driver_enabled,
                  driver_verification_state, operator_id?, version)
driver_documents(id PK, profile_id, type, encrypted_ref, issuer,
                 issued_at, expires_at, verification_state)
vehicles(id PK, driver_profile_id, registration_cipher, make, model, color,
         capacity, accessibility_json, inspection_expires_at,
         insurance_expires_at, state)
driver_availability(driver_profile_id PK, vehicle_id, state,
                    current_zone, last_location_at, version)
ride_quotes(id PK, rider_profile_id, pickup_cell_cipher, dropoff_cell_cipher,
            route_hash, distance_m, duration_s, token, fare_components_json,
            quoted_atomic, authorized_max_atomic, expires_at, terms_hash)
ride_requests(id PK, rider_profile_id, quote_id, state, requested_at, expires_at)
dispatch_offers(id PK, ride_request_id, driver_profile_id, state,
                offered_at, expires_at, response_at)
trips(id PK, ride_request_id, rider_profile_id, driver_profile_id, vehicle_id,
      quote_id, chain_escrow_id, state, start_proof_hash, completion_hash,
      requested_at, accepted_at, arrived_at, started_at, completed_at, version)
trip_events(id/time partition, trip_id, actor_profile_id?, type, payload_cipher,
            occurred_at, source, dedupe_key UNIQUE)
trip_location_segments(id PK, trip_id, encrypted_blob_ref, purpose,
                       started_at, ended_at, purge_at)
ride_incidents(id PK, trip_id, reporter_profile_id, severity, report_id,
               emergency_state, created_at)
```

Coordonatele live nu sunt actualizate în PostgreSQL la fiecare ping. Ele stau în
Redis/stream cu TTL; numai traseul necesar pentru receipt, fraudă sau incident este
comprimat și criptat cu retenție strictă. Driverul poate fi online numai dacă
documentele, vehiculul și eligibilitatea locală sunt valide.

### `business`, `services`, `promotion`, `music`, `grow`

Modelele normative complete sunt în
[`11-business-services-promotion-reviews.md`](11-business-services-promotion-reviews.md)
și [`12-music-wellness-learning.md`](12-music-wellness-learning.md). Schemele sunt
izolate, dar folosesc `identity`, `payments`, `content`, `trust` și `action_ledger`:

```text
organizations, organization_members, business_pages, business_locations
service_offerings, staff_profiles, availability_rules, appointment_holds, appointments
campaigns, ad_creatives, ad_delivery_events, ad_settlements
review_eligibilities, review_responses, review_disputes, review_aggregates

music_artists, music_releases, music_tracks, playlists, playlist_items
rights_assets, rights_parties, rights_claims, release_clearances, royalty_splits
usage_events, usage_aggregates, royalty_statements, takedown_claims

grow_providers, professional_credentials, content_items, nutrition_recipes
user_goals, meal_logs, workout_programs, workout_sessions, device_connections
courses, course_modules, lessons, enrollments, lesson_progress, assessments,
assessment_attempts, completion_credentials
```

`wellness_private` are criptare și politici separate. Rights evidence, health
content, locația privată și assessment answers nu intră în search ori analytics
general.

### `global_policy` și `agents`

Modelul complet este în
[`13-global-auth-agent-network.md`](13-global-auth-agent-network.md).

```text
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
synthetic_scenarios(id, environment, version, seed, configuration, state)
synthetic_runs(id, scenario_id, started_at, ended_at, results, cost, cleanup_state)
```

`SYSTEM_TEST` este imposibil în producția publică fără canary allowlist. Agent și
human metrics au coloane/partiții distincte; nu sunt combinate printr-un view implicit.

### `payments`

```text
quotes(id PK, kind, payer_profile_id, payee_profile_id, token_identifier,
       token_nonce, principal_atomic, fee_atomic, terms_hash, expires_at, signature)
transaction_intents(id PK, account_id, profile_id, kind, network, quote_id,
                    idempotency_key UNIQUE, unsigned_hash, tx_hash UNIQUE?, state)
chain_events(network, tx_hash, event_index, block_nonce, identifier, payload,
             finalized, processed_at, PK(network, tx_hash, event_index))
escrow_projections(id PK, contract_address, chain_id, domain, local_entity_id,
                   state, token, liability_atomic, last_event_cursor, reconciled_at)
ledger_entries(id PK, account_code, entity_id, token, debit_atomic, credit_atomic,
               source_event_id, created_at)
reconciliation_runs(id PK, started_at, finished_at, mismatches, status)
```

Ledger-ul este double-entry per token. Nu poate crea bani; fiecare journal trebuie
să fie echilibrat. Chain state rămâne autoritatea pentru custody.

### `trust`, `moderation`, `notifications`

```text
verifications(id PK, subject_profile_id, type, provider, status,
              result_claim_cipher, evidence_ref_cipher, expires_at)
attestations(id PK, subject_profile_id, domain, schema, claim_json,
             issuer, chain_id?, state, issued_at, expires_at)
reviews(id PK, author_profile_id, subject_type, subject_id, eligibility_id?,
        domain, verification_label, rating_components, body, state,
        version, chain_ref, published_at)
reports(id PK, reporter_profile_id, subject_type, subject_id, category,
        severity, description_cipher, state, created_at)
moderation_cases(id PK, report_id?, queue, assignee_id, state, sla_at, version)
evidence_items(id PK, case_id, encrypted_blob_ref, checksum, retention_until)
moderation_decisions(id PK, case_id, action, rule_id, reason, decided_by, created_at)
appeals(id PK, decision_id, appellant_profile_id, reason_cipher, state, decided_at)
admin_audit(id/time partition, actor_id, action, subject, before_hash, after_hash,
            purpose, occurred_at)
notifications(id/time partition, account_id, profile_id?, type, payload,
              priority, read_at, created_at)
notification_preferences(account_id, profile_id?, channel, type, enabled, privacy_mode)
```

Admin audit este append-only, exportat în storage WORM; moderatorii nu pot șterge
propriile urme.

## 4. API REST v1

Prefix `/v1`. Headers: `Authorization`, `X-Nexus-Profile`, `Idempotency-Key`,
`X-Client-Version`, `X-Request-Id`. Răspunsurile de listă folosesc cursor opac.

Orice endpoint mutabil nefinanciar creează sau consumă un `ActionIntent` și
returnează:

```json
{
  "data": {},
  "action": {
    "id": "uuidv7",
    "state": "RELAY_QUEUED",
    "txHash": null,
    "optimistic": true
  }
}
```

Clientul urmărește `/actions/{id}` sau websocket. Un răspuns HTTP `202` înseamnă
acceptat în relay queue, nu confirmat pe chain. Operațiile financiare returnează și
`transactionIntent`, cerând wallet signature explicită.

### Auth și cont

```text
POST /auth/native/challenge
POST /auth/native/verify
POST /auth/google|apple|facebook|tiktok/start
POST /auth/{provider}/callback
POST /auth/refresh
POST /auth/logout
GET/POST/DELETE /account/login-identities
POST /account/login-identities/{provider}/link
POST /wallets/embedded/provision
POST /wallets/{id}/recovery/setup|begin|complete
POST /wallets/link
POST /accounts/merge/prepare|confirm
GET /country-capabilities
POST /action-capabilities/prepare
POST /action-capabilities/{id}/submit-registration
DELETE /action-capabilities/{id}
POST /actions
GET  /actions/{id}
GET  /account
GET  /account/export
POST /account/deletion-requests
GET  /devices
DELETE /devices/{id}
```

### Agenți

```text
GET/POST/PATCH /agents
GET /agents/{id}/card
POST /agents/{id}/verify|suspend|revoke
GET/POST/DELETE /agents/{id}/capabilities
GET /agents/discover
POST /agent-tasks/quote
POST /agent-tasks
GET /agent-tasks/{id}
POST /agent-tasks/{id}/approve|cancel|accept|dispute
POST /agent-gateway/a2a/message
POST /agent-gateway/mcp/authorize
```

### Profile și graph

```text
GET/POST /profiles
GET/PATCH/DELETE /profiles/{id}
POST /profiles/{id}/activate
GET/PUT /profiles/{id}/privacy
POST /profile-links; POST /profile-links/{id}/accept; DELETE /profile-links/{id}
POST/DELETE /profiles/{id}/follow
POST/DELETE /profiles/{id}/block
```

### Social/feed/media

```text
GET /feed?mode=for-you|following&cursor=
POST /media/uploads; POST /media/uploads/{id}/complete
POST /posts; GET/PATCH/DELETE /posts/{id}
POST/DELETE /posts/{id}/reactions/{kind}
GET/POST /posts/{id}/comments
POST /posts/{id}/not-interested
```

### Clips, Watch, Live și recomandări

```text
GET /clips/feed?mode=for-you|following|friends|topic
POST /clips; POST /clips/{id}/duet|stitch|reply-video
GET /watch/home?mode=personalized|subscriptions|editorial
GET /watch/videos/{id}; GET /watch/channels/{id}
POST /watch/uploads; POST /watch/uploads/{id}/complete
POST/PATCH/DELETE /watch/videos/{id}
POST/DELETE /watch/channels/{id}/subscribe
GET/POST/PATCH /watch/playlists
POST /watch/videos/{id}/feedback
POST /recommendations/reset; PUT /recommendations/preferences
POST /live/streams; PATCH /live/streams/{id}
POST /live/streams/{id}/start|end|terminate
POST /live/streams/{id}/guests|moderators|chat|tips|report
```

### Family și Kids

```text
POST /family/groups; POST /family/groups/{id}/children
PUT /family/children/{id}/controls
POST /family/consent/revoke
GET /kids/home; GET /kids/search; GET /kids/videos/{id}
POST /kids/videos/{id}/feedback
POST /kids/history/reset
```

Family mutations cer reauth și parental gate. Kids feedback/history nu creează
Action Ledger tx și nu acceptă wallet address, ad identifier sau precise location.

### Assurance și release control — intern

```text
GET/POST/PATCH /assurance/work-items
GET /assurance/controls; POST /assurance/control-runs
GET/PATCH /assurance/findings; POST /assurance/findings/{id}/retest
POST /assurance/evidence; GET /assurance/releases/{id}/evidence-index
POST /assurance/risk-acceptances
POST /releases; POST /releases/{id}/approve|promote|rollback
GET/POST/PATCH /incidents
```

Endpoint-urile au service identity, maker-checker, immutable audit și ABAC. Agentul
owner nu poate apela `approve`/`close` pentru propriul artifact/finding.

### Nexus Node Network — peer/protocol

```text
GET  /node-network/v1/discover?capability=&region=&protocol=
GET  /node-network/v1/peers/{id}/public-manifest
POST /node-network/v1/nodes/manifest
GET  /node-network/v1/shards/{id}/placement
GET  /node-network/v1/shards/{id}/checkpoint
POST /node-network/v1/jobs/quote
POST /node-network/v1/jobs/{id}/accept|complete
POST /node-network/v1/receipts/{id}/challenge
GET  /node-network/v1/settlements/{nodeId}/{period}
```

Acestea sunt API-uri de protocol autentificate cu chei de nod și semnături, nu API-uri
publice de produs. Joburile sunt idempotente, au deadline, policy class, commitment
de intrare/ieșire și receipt verificabil. Orice peer poate intra fără aprobare.
Dating/chat/location folosesc numai ciphertext și topics neenumerabile; child activity,
KYC și safety evidence nu sunt rutate prin mesh.

### Dating

```text
PUT /dating/profile; PUT /dating/preferences
GET /dating/candidates
POST /dating/swipes
GET /dating/matches
POST /dating/matches/{id}/unmatch
POST /dating/verifications; GET /dating/trust-passport
POST /dating/matches/{id}/video-call
POST /dating/matches/{id}/meet-plans
POST /dating/meet-plans/{id}/check-in|safe|late|sos
PUT /dating/discretion
POST /dating/matches/{id}/media/view-once
POST /dating/media/{id}/open|close|report
```

### Pulse

```text
GET/POST/PATCH /pulse/aliases
GET /pulse/feed?mode=for-you|following|topics|latest
GET/POST/PATCH/DELETE /pulse/posts
POST /pulse/posts/{id}/reply|repost|quote|like|bookmark
POST/DELETE /pulse/aliases/{id}/follow
GET/POST/PATCH /pulse/lists
POST /pulse/context-notes
POST /pulse/context-notes/{id}/ratings
POST /pulse/posts/{id}/report
```

Operațiile publice Pulse folosesc aliasul drept actor afișat; autorizarea internă
rezolvă contul și capability-ul. Nu există endpoint de random anonymous matching.

### Commerce/travel/mobility/payments

```text
GET /market/categories
GET /market/search
GET/POST/PATCH /market/listings
POST /market/listings/{id}/renew
POST /market/listings/{id}/close
POST/DELETE /market/listings/{id}/favorite
POST /market/listings/{id}/offers
POST /market/orders/{id}/checkout
GET/POST/PATCH /travel/listings
GET /travel/availability
POST /travel/bookings/quote
POST /travel/bookings
PUT /mobility/profile
POST /mobility/driver/documents
POST /mobility/driver/availability
POST /mobility/rides/quote
POST /mobility/rides
GET  /mobility/rides/{id}
POST /mobility/rides/{id}/accept
POST /mobility/rides/{id}/arrived
POST /mobility/rides/{id}/start
POST /mobility/rides/{id}/complete
POST /mobility/rides/{id}/cancel
POST /mobility/rides/{id}/sos
POST /payments/intents
POST /payments/intents/{id}/submit
GET /payments/intents/{id}
POST /escrows/{domain}/{id}/disputes
```

Checkout/quote creează snapshot; submit nu acceptă schimbarea sumei/tokenului.

### Business, services, promotion și reviews

```text
GET/POST/PATCH /businesses
POST/DELETE /businesses/{id}/members
GET/POST/PATCH /businesses/{id}/locations
GET/POST/PATCH /businesses/{id}/services
GET/PUT /staff/{id}/availability
GET /services/search
GET /services/{id}/availability
POST /appointments/quote
POST /appointments
POST /appointments/{id}/accept|reschedule|cancel|check-in|complete|dispute
GET/POST/PATCH /promotion/campaigns
POST /promotion/campaigns/{id}/fund|pause|resume
GET /promotion/campaigns/{id}/report
GET /ads/{id}/why
GET/POST/PATCH/DELETE /reviews
POST /reviews/{id}/responses|disputes
POST /feature-feedback
```

### Music și Grow

```text
GET /music/home|search
GET /music/artists/{id}|albums/{id}|tracks/{id}
POST /music/playback/start
POST/DELETE /music/library/{type}/{id}
GET/POST/PATCH /music/playlists
POST /music/releases
GET /music/royalties/statements
POST /music/takedowns
GET /grow/home|search
GET/POST/PATCH /grow/goals
GET/POST/PATCH /grow/nutrition/logs
GET/POST /grow/workouts/sessions
GET/POST/PATCH /courses
POST /courses/{id}/enroll
GET/PUT /enrollments/{id}/progress
POST /assessments/{id}/attempts
```

### Chat, trust și safety

```text
POST /conversations
POST /conversations/{id}/join-token
POST /conversations/{id}/structured-messages
GET /trust/{profileId}
POST /verifications
POST /reports
GET /reports/{id}
POST /moderation/decisions/{id}/appeals
```

Mesajele E2EE obișnuite merg prin protocolul Matrix. API-ul Nexus gestionează ACL,
context și cardurile tranzacționale, nu plaintext-ul.

## 5. Erori și autorizare

Envelope:

```json
{
  "error": {
    "code": "CONTEXT_STALE",
    "message": "Profilul activ s-a schimbat.",
    "requestId": "...",
    "details": {}
  }
}
```

Coduri stabile: `AUTH_INVALID`, `PROFILE_FORBIDDEN`, `AUDIENCE_DENIED`,
`CONTEXT_STALE`, `IDEMPOTENCY_CONFLICT`, `QUOTE_EXPIRED`, `CHAIN_PENDING`,
`CHAIN_REVERTED`, `ESCROW_STATE_CONFLICT`, `RIDE_NO_DRIVER`, `DRIVER_INELIGIBLE`,
`RIDE_STATE_CONFLICT`, `ACTION_CAPABILITY_EXPIRED`, `ACTION_NONCE_CONFLICT`,
`ACTION_RELAY_BUDGET_EXCEEDED`, `RATE_LIMITED`, `MODERATION_BLOCKED`.
Se adaugă `CHILD_CONTEXT_FORBIDDEN`, `PARENTAL_GATE_REQUIRED`,
`AGE_BAND_INELIGIBLE`, `LIVE_NOT_ELIGIBLE`, `RIGHTS_BLOCKED` și `RECOMMENDER_PAUSED`.

Authorization pipeline:

```text
valid session → device/risk → active profile ownership → module capability
→ relationship/block → field/audience policy → resource state → rate/abuse limit
```

## 6. Evenimente de domeniu

Format comun:

```json
{
  "eventId": "uuidv7",
  "eventType": "market.order.funded.v1",
  "occurredAt": "...",
  "producer": "payments",
  "aggregateId": "...",
  "aggregateVersion": 3,
  "actorKind": "HUMAN",
  "actorProfileId": "...",
  "traceId": "...",
  "data": {},
  "privacyClass": "INTERNAL"
}
```

Familii: `action.intent.*`, `action.chain.*`, `identity.profile.*`,
`identity.social.*`, `identity.wallet.*`, `country.policy.*`,
`graph.relationship.*`, `content.post.*`,
`media.asset.*`, `media.ephemeral.*`, `dating.match.*`, `dating.verification.*`,
`dating.meet.*`, `pulse.post.*`, `pulse.context.*`, `watch.video.*`,
`live.stream.*`, `recommendation.preference.*`, `family.consent.*`,
`kids.catalog.*`, `market.order.*`, `travel.booking.*`,
`assurance.control.*`, `assurance.finding.*`, `release.gate.*`, `incident.*`,
`mobility.driver.*`, `mobility.dispatch.*`, `mobility.trip.*`,
`business.organization.*`, `services.appointment.*`, `promotion.campaign.*`,
`review.eligibility.*`, `music.rights.*`, `music.playback.*`, `music.royalty.*`,
`grow.wellness.*`, `grow.course.*`,
`node.registry.*`, `node.shard.*`, `node.job.*`, `node.receipt.*`,
`node.checkpoint.*`, `node.settlement.*`,
`agent.profile.*`, `agent.capability.*`, `agent.task.*`, `synthetic.run.*`,
`chain.transaction.*`, `escrow.*`, `trust.attestation.*`, `moderation.case.*`,
`notification.*`.

Outbox-ul este scris în aceeași tranzacție cu agregatul. Dispatcher-ul publică în
Redis Streams/BullMQ în MVP; Kafka/Redpanda se introduce numai când retenția,
throughput-ul și replay-ul justifică operarea suplimentară.

## 7. Indexare și privacy

- index document per profil/listing/post, fără wallet address sau câmpuri private;
- ACL filter server-side obligatoriu; nu ne bazăm pe ascunderea în UI;
- Dating folosește index/serviciu separat și nu este disponibil search-ului global;
- Kids folosește index allowlisted separat; nu indexează copilul și nu poate returna
  obiecte din corpusul adult chiar dacă textul/query-ul coincide;
- block/delete/suspend emit eveniment urgent de purge, nu așteaptă batch nightly;
- analytics identifiers sunt rotite/pseudonimizate și mapping-ul este separat;
- backup-urile au retention documentat și ștergerea logică este propagată prin
  tombstones până la expirarea backup-ului.

## 8. OpenAPI și schema governance

- OpenAPI 3.1 este generat/verificat în CI;
- Zod schemas sunt sursa pentru DTO TypeScript unde este practic;
- ABI, event schemas și OpenAPI au semantic versioning;
- breaking changes necesită versiune de endpoint/event și migration window;
- consumer-driven contract tests rulează pentru mobile, web, workers și indexer;
- nicio coloană/câmp sensibil nou fără data owner, scop, temei, retention și
  clasificare în catalog.
