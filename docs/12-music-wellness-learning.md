# Music, Wellness, Sport și Learning

Acest document este normativ. El adaugă streaming muzical și zona educațională de
nutriție, sport și cursuri fără a crea aplicații izolate sau a amesteca datele
sensibile cu feed-ul, Dating ori publicitatea.

## 1. Poziționare în produsul unificat

Music și Grow sunt suprafețe globale, nu profile personale noi:

```text
Nexus
├── profile de context: Social, Work, Dating, Travel, Market, Mobility
├── servicii comune: Inbox, Wallet, Trust, Business, Reviews, Promotion
└── hub-uri globale
    ├── Music — ascultare, artiști, playlist-uri și economie de drepturi
    └── Grow
        ├── Nutrition — educație și planificare generală
        ├── Sport — programe, antrenamente și coach booking
        └── Learn — cursuri, lecții, tutoring și progres
```

O Business Page poate avea tip Artist/Label, Gym/Coach, Nutrition Professional sau
Education Provider. Profilul Work arată rolul persoanei; pagina Business operează
catalogul și plățile.

Navigația mobile folosește cinci destinații stabile — Home, Discover, Create,
Inbox, Me — iar Market, Mobility, Services, Music și Grow apar ca hub-uri în Home/
Discover și shortcut-uri configurabile. Nu se adaugă zece tab-uri permanente.

## 2. Music — promisiune și limită legală

„Gen Spotify” înseamnă experiență de ascultare și economie de catalog, nu dreptul
automat de a retransmite catalogul Spotify sau al caselor de discuri.

MVP-ul acceptă numai:

- opere originale încărcate de artistul/rightsholder-ul verificat;
- catalog distribuit printr-un partener care garantează drepturile și teritoriile;
- conținut public-domain/Creative Commons compatibil, cu atribuirea cerută;
- podcast/audio unde uploader-ul deține drepturile necesare.

Catalogul comercial larg este Phase 3 și `LICENSE_GATED`. Codul poate fi gata, dar
funcția nu se activează fără licențe pentru fiecare componentă relevantă:

- master/sound recording;
- compoziție/publishing și drepturile autorilor;
- interpret/producer related rights;
- reproducere, punere la dispoziție/communication to the public și utilizare online;
- teritoriu, durată, tip abonament/ad-supported, preview, cache/offline;
- reporting, audit, minimum guarantees și royalty allocation;
- artwork, lyrics, video și clipuri sociale separat, când se folosesc.

Directiva privind gestionarea colectivă arată că distribuția muzicii cere licențe
de la categorii diferite de titulari și reglementează licențierea multiteritorială
online: [Directiva 2014/26/UE](https://eur-lex.europa.eu/eli/dir/2014/26).
Pentru conținutul încărcat de utilizatori se aplică și analiza Art. 17 din
[Directiva DSM 2019/790](https://eur-lex.europa.eu/eli/dir/2019/790/oj).
Pentru pilotul românesc, rights counsel verifică și
[Legea nr. 8/1996](https://legislatie.just.ro/Public/DetaliiDocumentAfis/198938),
metodologiile online/mobile și organismele competente publicate de
[ORDA](https://orda.ro/organisme-de-gestiune-colectiva/); o singură licență nu este
presupusă că acoperă automat toate drepturile și toate repertoriile.

## 3. Music feature inventory

### MVP — independent catalog

- artist/label Business Page și verificare de drepturi;
- upload lossless master, cover, credits, ISRC/identificatori dacă există;
- track, single, EP/album, release date și territorial availability;
- audio processing în ladder AAC/Opus, HLS/DASH și CDN;
- Home Music, search, artist/album/track pages și queue;
- play/pause/seek, background audio, lock-screen controls și device handoff limitat;
- like/save, follow artist, playlist public/privat și share în Social/chat;
- explicit-content label și control;
- recommendations simple după context Music, fără Dating/health data;
- artist analytics: starts, qualified listens, territory, saves și revenue estimate;
- direct tips și supporter subscription, dacă app-store/payment review permite;
- takedown, counter-notice, conflict de ownership și release hold.

### Phase 2

- Premium fără reclame, quality tiers și download offline criptat;
- collaborative playlists, radio, mixes și social listening;
- lyrics numai cu licență, synced lyrics și credits complete;
- podcasts, chapters și creator ads;
- split sheets/versioned collaborators și royalty statements;
- distributor API, DDEX-ready mapping și conflict matching;
- music promotion cu fraud detection;
- clip audio licențiat pentru video, duet/stitch și stories;
- family plan numai după reevaluarea politicii 18+ și a facturării.

### Phase 3 — parteneriate

- catalog label/CMO/publisher multi-territorial;
- discovery avansat și editorial tools;
- connected devices și car integrations;
- live audio/concert ticketing;
- lossless/spatial tiers dacă drepturile și costurile permit;
- marketplace de licențiere pentru creators, separat contractual.

Funcțiile `LICENSE_GATED` pot fi dezvoltate în spatele feature flag-urilor, dar nu
pot fi populate cu fișiere nelicențiate pentru demo public.

## 4. Music media architecture

```text
Upload
  → malware/file validation
  → audio fingerprint + duplicate/conflict check
  → rights/territory release gate
  → lossless origin (private object storage)
  → FFmpeg workers: AAC/Opus renditions + loudness + waveform
  → encrypted HLS/DASH packaging
  → signed CDN delivery
  → playback telemetry
  → fraud-qualified usage ledger
  → royalty statement/root
  → claim/payout
```

IPFS nu livrează masterele comerciale. Manifestele publice selectate pot avea CID;
audio-ul licențiat folosește storage privat, signed URLs, entitlement și geo rules.
Offline folosește encrypted cache cu license expiry, device cap și revocation.

Evenimentele de playback:

- `PLAY_START` inițiat de utilizator este action tx compact;
- seek, heartbeat, buffer, bitrate și progress sunt telemetrie, nu tranzacții;
- un „qualified listen” este calculat off-chain după regula contractuală;
- replay/bot/device farm nu produce automat royalty;
- periodic, un royalty statement are Merkle root și settlement on-chain;
- like/save/add-to-playlist/review sunt fiecare action tx.

## 5. Rights ledger și royalties

```text
music_artists(id, business_id, name, bio, verification_state, manifest_hash)
music_releases(id, artist_id, type, title, cover_asset_id, release_date,
               explicit, clearance_state, manifest_hash)
music_tracks(id, release_id, primary_artist_id, title, sequence, duration_ms,
             master_asset_id, isrc?, explicit, availability_state)
music_track_artists(track_id, artist_id, role, credited_name)
playlists(id, owner_profile_id, title, visibility, cover_asset_id, state, action_tx)
playlist_items(playlist_id, track_id, position, added_by_profile_id, action_tx)

rights_assets(id, type, title, version, fingerprint, metadata_manifest_hash)
rights_parties(id, organization_id?, role, territory, verification_state)
rights_claims(id, asset_id, party_id, right_type, territories, starts_at,
              ends_at, basis, evidence_ref_cipher, state, conflict_group_id)
release_clearances(id, release_id, territory, service_tier, state, approved_by)
royalty_splits(id, asset_id, right_type, version, effective_from, total_bps)
usage_events(id/time partition, asset_id, profile_id_pseudonym, event_type,
             territory, fraud_state, occurred_at)
usage_aggregates(asset_id, territory, period, qualified_units, methodology_version)
royalty_statements(id, payee_id, period, currency, gross, deductions, net,
                   usage_root, split_version, state)
takedown_claims(id, asset_id, claimant, basis, evidence_ref, state, deadlines)
```

`nexus-royalties` nu decide cine deține copyright. El distribuie numai un statement
aprobat și versionat:

- `publishStatementRoot(period, token, total, merkleRoot, methodologyHash)`;
- `fundStatement(period)`;
- `claim(period, payee, amount, proof)`;
- `freezeClaim(statement, claimId)` pentru conflict legal;
- `withdrawUnclaimed` după termen și politica contractuală.

Invariante: suma claim-urilor nu depășește fondul, un leaf se consumă o singură
dată, split total = 10.000 bps, freeze-ul nu transferă proprietatea, iar owner-ul
nu poate retrage liabilities. Contractul este auditat înainte de bani reali.

## 6. Music monetization

- Free: catalog eligibil cu reclame/promoted content clar marcat și limite;
- Premium individual: ipoteză 4,99–7,99 EUR/lună echivalent în piața pilot;
- artist supporter subscriptions și tips;
- platform fee 5–15% pentru direct fan support, după costul payment/app-store;
- music promotion și release tools B2B;
- distribuție/licensing admin numai prin parteneri și contract separat.

`Revenue pool` și metodologia de royalties sunt publicate pe perioadă. Nexus nu
promite „per-stream rate” fix dacă contractele folosesc pool/share și nu numește
recompensă un randament. TVA, withholding, invoicing și payee KYC se aplică după
entitate și jurisdicție.

## 7. Grow — Nutrition, Sport și Learning

Grow este o platformă educațională și de wellbeing pentru adulți. În MVP nu oferă
diagnostic, tratament, predicție de boală, recomandări clinice sau substitut pentru
medic. Aceasta este o limită de intended purpose, UX, marketing și model, nu doar
un disclaimer.

### Nutrition MVP

- articole/video/cursuri despre principii generale de alimentație;
- meal planner manual și rețete cu alergeni declarați;
- obiective generale introduse de utilizator;
- jurnal privat de mese și obiceiuri;
- liste de cumpărături exportabile spre Market numai la cerere;
- filtre dietetice ca preferințe private, nefolosite la ads;
- booking cu profesionist verificat în categoriile și țările permise;
- surse/editorial review și data ultimei revizuiri;
- fără plan automat pentru boală, sarcină, tulburări alimentare sau medicație.

În România, eticheta și serviciile de dietetician sunt activate numai după
verificarea dreptului de practică și a domeniului conform
[Legii nr. 256/2015](https://legislatie.just.ro/Public/DetaliiDocumentAfis/172678).

Afirmațiile nutriționale și de sănătate din conținut sau reclame sunt controlate
conform [Regulamentului (CE) 1924/2006](https://eur-lex.europa.eu/eli/reg/2006/1924/oj).

### Sport MVP

- bibliotecă de exerciții cu demonstrații și contraindicații generale;
- programe pentru nivel, echipament și obiectiv general;
- workout player, timer, sets/reps și progres privat;
- integrare opțională cu Apple Health/Health Connect numai cu scope minim;
- coach/gym Business Pages, servicii, programări și review-uri verificate;
- challenges private/social opt-in, fără publicarea automată a greutății;
- music playlists pentru antrenament;
- safety stop și recomandare de consult medical la red flags definite editorial.

### Learning MVP

- provider/instructor pages, course catalog și module;
- video/audio/text lessons, resurse, quiz și assignment;
- enrollment, bookmarks, notes private și progres;
- live class link, calendar și tutoring appointment;
- discussion room moderat și E2EE direct chat;
- certificate de finalizare verificabil, etichetat clar;
- paid course checkout, refund policy și instructor revenue split;
- search/recommendation fără date Dating sau health.

Un certificat Nexus nu este „acreditat”, diplomă sau calificare profesională decât
dacă emitentul și programul au fost verificați pentru țara respectivă și formularea
este aprobată contractual/juridic.

## 8. Wellness/medical boundary

MDR distinge software-ul cu scop medical de software-ul pentru lifestyle/wellbeing.
Dacă intended purpose include diagnostic, prevenție, monitorizare, predicție,
prognostic sau tratament, produsul poate deveni dispozitiv medical software:
[Regulamentul (UE) 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng).

Clasificare internă obligatorie:

| Clasă | Exemplu | Decizie |
|---|---|---|
| W0 editorial | articol despre proteine | permis cu surse/review |
| W1 general wellness | plan manual de obiceiuri | permis, privacy ridicată |
| W2 professional service | consultație cu profesionist verificat | permis numai per țară, cu termeni |
| W3 clinical/medical | ajustare insulină, diagnostic, tratament | exclus; produs separat și regulatory gate |

Un model AI nu trece singur din W0/W1 în W2/W3. Orice personalizare care poate
produce efect medical intră în clinical safety review, human professional oversight,
quality management și analiză MDR/AI/data înainte de dezvoltare/lansare.

## 9. Privacy pentru date de sănătate și progres

Datele despre sănătate și unele inferențe sunt categorii speciale GDPR. Arhitectura:

- schema `wellness_private` și chei de criptare distincte;
- niciun meal/workout/body metric în IPFS sau plaintext on-chain;
- action tx generic `PRIVATE_GROW_ACTION` cu salted commitment;
- zero reutilizare în Dating, Work, credit/reputație sau ads;
- consimțământ granular pentru device integrations, cu revoke și deletion;
- coach vede numai datele selectate pentru relația și perioada respectivă;
- export și ștergere pe obiect, cu explicația limitelor tx commitment;
- logs fără valori de sănătate; support access purpose-bound;
- retention scurtă pentru raw sensor data, agregare numai dacă este necesară;
- DPIA înainte de beta, plus vendor DPA și transfer assessment;
- fără „social score” pentru greutate, dietă, performanță sau aderență.

## 10. Grow data model

```text
grow_providers(id, business_id, kind, country, verification_state, scope)
professional_credentials(id, provider_id, profession, issuer, country,
                         evidence_ref_cipher, valid_from, expires_at, status)
content_items(id, provider_id, vertical, format, title, asset_id, sources,
              editorial_state, medical_class, reviewed_at, manifest_hash)
nutrition_recipes(id, content_id, ingredients, nutrients_source, allergens, claims)
user_goals(id, profile_id, vertical, goal_cipher, state, action_tx)
meal_logs(id, profile_id, occurred_at, payload_cipher, action_tx)
workout_programs(id, provider_id, level, equipment, safety_notes, status)
workout_sessions(id, profile_id, program_id, payload_cipher, action_tx)
device_connections(id, account_id, provider, scopes, token_ref, state)

courses(id, provider_id, title, description, price, currency, accreditation_claim,
        status, manifest_hash)
course_modules(id, course_id, position, title, release_policy)
lessons(id, module_id, format, asset_id, duration, version)
enrollments(id, course_id, learner_profile_id, order_id?, state, action_tx)
lesson_progress(id, enrollment_id, lesson_id, progress_cipher, updated_at)
assessments(id, course_id, kind, rubric, version)
assessment_attempts(id, assessment_id, learner_profile_id, answer_cipher, score_cipher)
completion_credentials(id, enrollment_id, issuer_id, claim_hash, badge_ref?, status)
```

Playback/lesson progress și sensor heartbeats sunt telemetrie/stare privată și nu
produc tx la fiecare secundă. Acțiunile intenționate — enrollment, start/finalize
workout, save goal, submit assessment, review — produc câte o tranzacție compactă.

## 11. API minim

```text
GET /music/home|search
GET /music/artists/{id}|albums/{id}|tracks/{id}
POST /music/playback/start
POST/DELETE /music/library/{type}/{id}
GET/POST/PATCH /music/playlists
POST /music/releases; POST /music/releases/{id}/submit-clearance
GET /music/artists/{id}/analytics
GET /music/royalties/statements
POST /music/royalties/{id}/claim-intent
POST /music/takedowns

GET /grow/home|search
GET /grow/content/{id}
GET/POST/PATCH /grow/goals
GET/POST/PATCH /grow/nutrition/logs
GET/POST /grow/workouts/sessions
POST /grow/device-connections; DELETE /grow/device-connections/{id}
GET/POST/PATCH /courses
POST /courses/{id}/enroll
GET/PUT /enrollments/{id}/progress
POST /assessments/{id}/attempts
POST /completion-credentials/{id}/claim
```

## 12. Moderare și calitate

Music:

- fingerprint/provenance și conflict queue;
- takedown/counter-notice cu termene și human review;
- repeat infringer policy, fără filtrare oarbă a parodiei/review-ului legal;
- explicit, hate/illegal, impersonation și artificial-streaming controls;
- royalty freeze limitat la suma/asset-ul în dispută.

Grow:

- author identity, credentials și conflict-of-interest disclosure;
- surse, versionare, reviewed date și correction log;
- interdicție pentru cure miraculoase, dangerous challenges și deceptive claims;
- escaladare self-harm/eating-disorder content către safety resources, cu proces
  validat și fără diagnostic automat;
- review profesional pentru conținut W1/W2;
- instructor/provider appeal și user reporting.

## 13. Faze și release gates

### MVP/pilot

- Music cu artiști independenți/licențe directe, player, search, library și payouts
  pilot cu caps;
- Grow editorial W0/W1, programe sport generale, cursuri și booking cu provider;
- fără catalog major-label, offline, lyrics sau clinical personalization.

### Phase 2

- Music Premium/offline, distributor ingestion, advanced royalties și podcasts;
- Grow subscriptions, coach collaboration, device integrations și marketplace de
  cursuri matur;
- expansion per țară după rights/credential/consumer/privacy review.

### Phase 3

- catalog muzical comercial numai prin acorduri;
- acreditări educaționale prin parteneri;
- W2 extins și eventual produs medical separat numai după regulatory program;
- niciun W3 în aplicația consumer Nexus fără certificare și structură dedicată.

Gate-uri obligatorii:

- rights matrix `asset × right × territory × tier × time` completă;
- contracte rightsholder/CMO/distributor și royalty audit trail;
- takedown/counter-notice și funds freeze operaționale;
- app-store subscriptions, tax, invoicing și payout/KYC validate;
- DPIA Grow și interdicția health targeting testată end-to-end;
- professional credential rules și claims policy validate pe țară;
- editorial/medical board și incident workflow pentru Grow;
- `nexus-royalties` auditat independent înainte de fonduri reale;
- accessibility pentru player, cursuri și workout instructions;
- content/moderation/support capacity înainte de public beta.

Nicio formulare „legal”, „verificat”, „medical”, „acreditat” sau „Spotify-like
catalog” nu apare în marketing dacă dovada și domeniul exact nu sunt active.
