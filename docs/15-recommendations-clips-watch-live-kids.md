# Recomandări, Clips, Watch, Live și Nexus Kids

Acest document este normativ. El definește recomandările de produs și sistemele de
recomandare pentru toate verticalele Nexus, extinde Social cu `Clips` short-form și
`Watch` long-form, adaugă live streaming și introduce `Nexus Kids` ca experiență
separată, controlată de părinte.

## 1. Modelul media unificat

Nexus nu construiește trei rețele incompatibile. Folosește aceleași primitive de
identitate, graph, conținut, media, moderare, rights, payments și Action Ledger,
dar oferă suprafețe cu obiective diferite:

```text
Create once
   ├── Clips  ─ vertical short video, remix și discovery rapid
   ├── Pulse  ─ text/media, conversație publică și actualitate
   ├── Watch  ─ video long-form, canale, playlists și subscriptions
   ├── Live   ─ transmisie în timp real, premiere și replay
   └── Kids   ─ catalog separat, selectat și controlat de părinte
```

Un asset poate avea un master și mai multe prezentări: trailer Clip, video Watch,
live replay și post Pulse. Fiecare prezentare are propriul manifest, audience,
rating, drepturi, moderare și eligibility. Distribuirea cross-surface nu duplică
fișierul și nu ocolește controalele suprafeței destinație.

## 2. Principii pentru toate recomandările

1. **Separare pe scop.** Dating, Kids, Work, Market și feedurile media au feature
   namespaces, modele și drepturi de acces distincte.
2. **Hard safety înainte de scor.** Block, privacy, vârstă, țară, drepturi, takedown,
   moderation și creator eligibility elimină candidatul înainte de ranking.
3. **Control real.** Fiecare suprafață oferă un mod neprofilat relevant:
   cronologic, Subscriptions, Following, editorial sau filtre explicite.
4. **Explicații utile.** „De ce văd asta?” arată 1–3 factori generali, sursa
   candidatului și dacă există plată, fără a dezvălui datele altor persoane.
5. **Negative feedback puternic.** `Not interested`, mute topic, block creator,
   reset history și pause personalization au efect rapid și auditabil.
6. **Diversitate constrânsă.** Re-ranking limitează repetarea creatorului, formatului,
   topicului și perspectivei; nu optimizează exclusiv timpul petrecut.
7. **Exploration plafonat.** Conținutul nou primește șanse controlate fără a depăși
   safety/quality gates și fără a fabrica engagement.
8. **Paid separat.** Promovarea nu poate fi ascunsă în scorul organic și nu poate
   învinge block, age, Dating preferences ori Kids policy.
9. **Actor integrity.** `HUMAN`, `AGENT`, `SYSTEM_TEST` și paid traffic sunt măsurate
   separat. Agenții sunt etichetați și nu produc consens uman artificial.
10. **Evaluare înainte de optimizare.** Fiecare model are model card, dataset scope,
    offline metrics, online guardrails, bias tests, rollout și rollback.

## 3. Arhitectura sistemului de recomandare

### 3.1 Pipeline comun

```text
RequestContext
  → policy/consent/context resolver
  → candidate generators
  → eligibility + safety filters
  → surface-specific ranker
  → constrained re-ranker
  → ad slotter separat
  → explanation + response
  → impression/watch/feedback telemetry
```

`RequestContext` conține profilul activ sau Kids session, suprafața, țara,
limba, vârsta/age band ca claim, safety mode, device class și consent version.
Nu conține wallet address în model și nu primește plaintext Dating/chat.

### 3.2 Candidate generators

- graph: Following, Subscriptions, friends și communities;
- content similarity: topics, embeddings și creator affinity;
- contextual: limbă, moment, device/network și suprafață;
- editorial: colecții și evenimente verificate;
- discovery: creatori/conținut nou cu quality floor;
- trending: unique-human velocity, fără paid/agent/synthetic contamination;
- continuation: Continue Watching, serie, playlist și live scheduled;
- explicit: query, filters, saved search și user-selected interests.

Generatoarele emit motivul și versiunea. Ele nu pot introduce un candidat care a
eșuat policy filtering.

### 3.3 Rank și re-rank

MVP folosește scoruri interpretabile și learning-to-rank numai după date suficiente:

```text
utility = relevance + quality + freshness + relationship + exploration
          - predicted_skip - repetition - integrity_risk - fatigue
```

Scorul final este constrâns de caps pentru același creator/topic, language mix,
new-creator floor și content-quality floor. Safety risk nu este o penalizare mică;
la pragurile definite candidatul este eliminat sau trimis la review.

### 3.4 Feature store și privacy

- feature views separate: `clips_features`, `pulse_features`, `watch_features`,
  `dating_features`, `kids_features`, `commerce_features`;
- Dating și Kids nu pot fi surse pentru ads ori alte suprafețe;
- Work poate importa interese Social numai prin acțiune explicită a utilizatorului;
- watch history poate fi dezactivat, șters sau folosit numai on-device unde este
  cerut de mode/country policy;
- raw events au TTL; agregatele au data owner, scop, versiune și delete propagation;
- embeddings sensibile sau care permit inferențe interzise sunt eliminate/testate;
- chain read model confirmă acțiuni, dar wallet/tx timing nu este feature de ranking.

### 3.5 Moduri controlate de utilizator

- `Personalized`;
- `Following/Subscriptions` cronologic;
- `Topics selected`;
- `Popular in language/country`, fără profil individual;
- `Editorial`;
- `Reset and start fresh`;
- `Pause history/personalization`;
- `Kids parent-curated`.

## 4. Recomandări pe fiecare caracteristică

| Suprafață | Obiectiv recomandat | Semnale permise | Guardrail principal |
|---|---|---|---|
| Dating | compatibilitate reciprocă și conversație sigură | filtre declarate, intenție, claims, feedback privat | fără desirability score, ads sau semnale cross-profile |
| Pulse | conversații sănătoase și informație relevantă | follows, topics, replies de calitate, surse, freshness | chronological mode, anti-outrage/brigading/doxxing |
| Clips | satisfacție pe termen lung și descoperire creatori | completion, skip, rewatch, share/save, negative feedback | repetition/fatigue caps, wellbeing breaks, sound rights |
| Watch | alegere intenționată, valoare și continuarea seriilor | click satisfaction, meaningful watch, completion, survey, subscription | fără clickbait reward sau autoplay infinit implicit |
| Live | relevanță temporală și creator eligibility | subscriptions, reminder, topic, language, event | safety/readiness gate înainte de audience growth |
| Work | relevanță profesională | skill, rol, locație declarată, seniority | fără Dating/Social sensitive inference; explicații și contestare |
| Market | potrivire query–anunț și încredere tranzacțională | text, categorie, preț, distanță, seller outcome | sponsored separat; bunuri interzise excluse înainte de rank |
| Travel | potrivire cerințe–disponibilitate | date, guests, amenities, price, verified outcomes | tax/fees complete, availability reală, fără fake scarcity |
| Services | serviciu/slot real disponibil | serviciu, staff, distanță, preț, calendar, review eligibil | paid/organic clar, credentials unde profesia cere |
| Music | gust declarat și diversitate de catalog licențiat | listens calificate, skips, saves, playlists | rights/territory gate și anti-stream fraud |
| Grow | obiectiv educațional/wellness ales | curriculum, nivel, progres privat | fără diagnostic, health ads sau transfer spre Dating |
| Mobility | ETA, eligibilitate și fairness operațional | proximitate, availability, vehicle fit, safety eligibility | nu optimizează pentru fee sau discriminare; human appeal |

## 5. Dating — recomandările mele complete

- trei moduri: `Curated` cu puține carduri bune, `Explore` și `Intent Rooms`;
- mutual eligibility înainte de ranking; un utilizator nu apare dacă preferințele
  obligatorii ale ambilor nu se intersectează;
- Compatibility Card arată compatibilități, diferențe importante și claims valabile;
- `Slow Dating` limitează match-urile active și reduce swipe-ul compulsiv;
- `Introductions` prin prieten comun numai cu acordul tuturor;
- verified events și group-first meetings pentru persoane care nu doresc 1:1 direct;
- `Second Look` pentru treceri accidentale, fără a dezvălui cine a respins pe cine;
- `Travel Mode` are etichetă, perioadă și protecții anti-scam;
- Photo Match, Adult Verified și Recent Liveness sunt dovezi separate;
- no-show și safety signals au expirare, confidence bucket, apel și review uman;
- block/unmatch/response time/sexual history/wealth/attractiveness nu formează scor;
- agenții și synthetic users sunt imposibili tehnic în candidate pool.

North-star: conversații semnificative și meet plans consensuale, cu scam/safety rate
în scădere; nu swipes, time spent sau match count brut.

## 6. Pulse — recomandările mele complete

- `Following` cronologic este mereu la un tap;
- For You combină graph, topics, freshness, source quality și perspective diversity;
- utilizatorul poate reduce reposts, quote posts, politică sau media sensibilă;
- reply ranking favorizează răspunsuri relevante, nu conflictul și numărul brut de
  reacții; conversation health este măsurat separat de engagement;
- Community Context cere surse, evaluatori umani diverși și anti-brigading;
- Trends folosesc unique-human velocity și exclud ads, agents și test traffic;
- aliasurile persistente pot construi reputație fără expunerea numelui/wallet-ului;
- postări temporare, audience controls și `Verified Human, Identity Private`;
- spaces/audio, long-form notes, newsletters și communities în Phase 2;
- DM pseudonim numai după accept; fără random anonymous chat.

## 7. Clips — experiența TikTok-like

### 7.1 Funcții

- feed vertical `For You`, `Following`, `Friends` și topic feeds;
- video 3–180 secunde în MVP; durate mai mari sunt rutate către Watch;
- camera/editor: trim, speed, transitions, captions, stickers și templates;
- sound catalog licențiat/original, attribution și territory entitlement;
- duet, stitch, remix și template reuse cu permisiune granulară a creatorului;
- reply-with-video, playlists/series și pinned clips;
- drafts locale/criptate, scheduled publish și collaboration posts;
- captions automate editabile, transcript, translations și audio descriptions;
- quality upload, data saver, offline cache controlat și cast către TV;
- like, comment, share, save, follow, not interested, report și block;
- creator analytics, originality status și rights/safety center;
- shop/service/music/Watch cards numai etichetate și eligibile.

### 7.2 Ranking Clips

Semnalele pozitive sunt completion raportat la durată, intentional rewatch,
share/save, follow-after-watch, comment quality și survey satisfaction. Skip rapid,
`not interested`, report, hide sound/topic și session fatigue sunt negative.

Nu recomandăm:

- optimizare exclusivă pentru watch time;
- serii infinite ale aceluiași creator/topic;
- promovarea provocărilor riscante;
- deducerea stării emoționale ori a categoriilor sensibile;
- conținut sexual/incidental către utilizatori care nu au opt-in eligibil;
- boosts care depășesc safety și user controls.

Wellbeing: session break, bedtime schedule, topic reset, daily time goal și autoplay
control. Pentru contul adult acestea sunt controale; pentru Kids sunt defaults
administrate de părinte.

## 8. Watch — platforma YouTube-like

### 8.1 Viewer

- Home, Subscriptions, Explore, Trending curat și History;
- pagină video cu player adaptiv, captions, chapters, transcript și quality control;
- like/dislike privat pentru creator, comments, replies, share, save și report;
- Watch Later, playlists publice/private/collaborative și queues;
- Continue Watching, series/season, premieres și scheduled live;
- channel page, subscribe/bell, members-only unde este eligibil;
- search cu filters pentru durată, dată, live, captions, limbă și rights territory;
- TV/cast, picture-in-picture, background audio numai dacă drepturile permit;
- downloads/offline numai pentru conținut eligibil și ambalare protejată;
- podcasts/video podcasts și clips generate din long-form cu attribution.

### 8.2 Creator Studio

- channel ownership personal/business și roluri owner/editor/moderator/analyst;
- upload resumable, checksum, draft, visibility și scheduled publishing;
- title, description, thumbnail, chapters, subtitles, languages și content rating;
- audience declaration, synthetic-media disclosure și paid-promotion declaration;
- end screens, cards, playlists, series și related Clip;
- copyright checks înainte de publicare și dispute/counter-notice;
- comments policy, blocked words, moderators și slow mode;
- analytics: reach, satisfaction, retention curves, traffic sources și revenue;
- memberships, tips, sponsorship disclosures și payout statements;
- content transfer între personal și Business Page cu audit.

### 8.3 Watch recommendation

Candidate sources: Subscriptions, continuation, same series/channel, search/topic,
similar content, editorial și exploration. Ranker-ul estimează probabilitatea de
alegere și satisfacția după vizionare, nu doar click-ul ori minutele brute.

Guardrails:

- clickbait detection prin mismatch thumbnail/title–content și quick-return rate;
- survey/negative feedback cântăresc mai mult decât autoplay minutes;
- topic/creator repetition caps și long-session fatigue;
- authoritative-source treatment pentru domenii cu risc, fără proclamarea automată
  a adevărului de către model;
- conținutul borderline nu este recomandat doar pentru că nu a fost încă eliminat;
- utilizatorul poate dezactiva history și folosi Subscriptions/Editorial;
- promoted video ocupă slot separat și afișează plătitorul/beneficiarul.

## 9. Pipeline VOD Watch

```text
resumable multipart upload
 → checksum + malware + media probe
 → rights fingerprint + policy precheck
 → mezzanine/private original
 → ABR ladder: 240p…4K după sursă
 → HLS/DASH CMAF + thumbnails + preview + transcript
 → human/AI moderation state
 → scheduled/READY
 → signed CDN playback
 → retention/rights/analytics
```

- nu se upscalează artificial;
- codec ladder pornește H.264/AAC; HEVC/AV1 se adaugă pe device/ROI;
- URL-urile sunt scurte și semnate; origin-ul nu este public;
- IPFS nu este player origin pentru video care necesită takedown/territory control;
- DRM se folosește numai pentru catalog premium/licențiat care îl cere;
- captions și transcript au versiune, limbă și correction workflow;
- publicarea este blocată până la rights/safety state eligibil.

## 10. Live streaming

### 10.1 Funcții Live

- schedule, waiting room, reminder, trailer și Premiere;
- RTMP/SRT ingest pentru creator; WebRTC pentru backstage și invitați;
- single/dual/multi-guest, screen share și co-host roles;
- low-latency playback, DVR, rewind, captions și live transcript;
- live chat, reactions, polls, Q&A, pinned message și moderators;
- slow mode, subscriber-only, verified-only și chat disable;
- tipping/gifts în EGLD/ESDT aprobat cu caps și fraud controls;
- clips din live, automatic replay, chapters și post-live edit;
- commerce cards numai pentru sellers/products eligibile și marcaj comercial;
- emergency end, regional blackout și rights takedown în timp real.

### 10.2 Arhitectură Live recomandată

```text
Creator encoder/mobile
 → nearest managed ingest (RTMP/SRT/WebRTC)
 → redundant origin + health/failover
 → real-time safety/rights signals
 → transcoding ABR
 → LL-HLS/CMAF CDN
 → player + separate realtime chat
 → recording/mezzanine
 → VOD moderation → Watch replay
```

În MVP/Phase 2 folosim un provider managed prin adapter. Infrastructura proprie de
ingest/transcoding global se justifică numai după volum și cost dovedite.

### 10.3 State machine și control

```text
DRAFT → SCHEDULED → PRECHECK → READY → LIVE
 → ENDED → PROCESSING_REPLAY → REPLAY_READY
          ↘ SUSPENDED / TERMINATED / RIGHTS_BLOCKED
```

- creator eligibility include account continuity, strike state și live training;
- primul live are reach limitat și moderator readiness;
- delay configurabil permite intervenție la categorii de risc;
- chatul poate fi oprit independent de stream;
- un moderator poate terminate fără a aștepta chain confirmation;
- public live chat messages sunt Action Ledger tx; typing, reactions animate și
  stream packets rămân transport/telemetrie efemeră;
- tips și memberships așteaptă `EXECUTED_SUCCESS`; replay-ul păstrează numai chatul
  conform policy/consent.

## 11. Nexus Kids — produs separat

### 11.1 Decizia de produs

`Nexus Kids` este o aplicație/binary și un tenant de date separat, administrat din
Family Center de un adult. Nu este un profil comutabil care poate ajunge accidental
în Dating, Pulse, Market, Travel, Mobility, wallet sau conținut adult.

```text
Adult Nexus account + verified parental authority
  → Family group
    → Child profile (age band, nu birth date publică)
      → Kids catalog + parent controls + encrypted local history
```

Age bands și funcțiile sunt configurate per țară și dezvoltare: preșcolar, 6–8,
9–12, 13–15 și 16–17. Clasificările magazinelor și pragurile legale nu sunt tratate
ca identice worldwide.

### 11.2 Funcții Kids

- home editorial pe age band, limbă și interese selectate de părinte/copil;
- canale verificate: educație, animație, povești, muzică, știință și sport sigur;
- search sigur cu rezultate allowlisted și safe search imposibil de dezactivat de copil;
- playlists, favorites și Continue Watching private;
- captions, audio descriptions, viteza playerului și limbaj adaptat vârstei;
- timer zilnic, bedtime, pauze, autoplay off implicit și „gata pentru azi”;
- parent-approved channels/topics, block channel/video și history reset;
- rapoarte parent-friendly, fără profil psihologic sau clasamente sociale;
- download controlat de părinte și expiry;
- conținut educațional de la școli/muzee/provideri verificați;
- explicații simple „de ce este recomandat”.

### 11.3 Ce nu există în Kids

- Dating, Pulse, Marketplace, Travel, Mobility sau wallet UI;
- public upload/broadcast al copilului;
- DM, open chat, comments libere, mentions sau random matching;
- live chat public; cel mult reacții/întrebări predefinite și moderate;
- tips, gifts, token, NFT, loot boxes sau cumpărături fără parental gate;
- ads comportamentale, remarketing, creator boosts targetate individual;
- precise location, contact sync, face/voice emotion profiling;
- follower count public, streak coerciv, public leaderboard sau dark patterns;
- cross-profile feature sharing spre serviciul adult.

### 11.4 Kids Live

- copilul nu poate fi broadcaster public în MVP/Phase 2;
- live-ul vizibil este produs de creator/instituție verificată și aprobat în catalog;
- stream-ul are delay, moderator uman, emergency terminate și recording;
- chat liber este dezactivat; Q&A este predefinit, filtrat și aprobat înainte de afișare;
- niciun link extern, contact request, fundraising sau commerce card în playerul copilului;
- replay-ul trece moderare VOD înainte de disponibilitate ulterioară;
- parent controls pot dezactiva complet Live.

### 11.5 Kids recommendations

Prioritatea este suitability și valoare, nu retenție maximă:

1. allowlisted catalog pentru country × age band;
2. parent block/allow și explicit interests;
3. developmental/educational classification;
4. quality/editorial review;
5. diversity, session limit și repetition caps;
6. feedback simplu al copilului și părintelui;
7. niciun model care deduce sănătate, emoție, vulnerabilitate ori situația familiei.

Nu există infinite scroll în age bands mici. Home are colecții finite, iar următorul
video este previzibil. Autoplay și personalized history sunt activate numai dacă
politica țării și controlul părintelui permit; opțiunea editorială rămâne completă.

### 11.6 Kids identity, consent și date

- adultul se autentifică și creează Family Group; parental authority/consent este
  versionată, revalidabilă și revocabilă;
- copilul primește un identificator intern pseudonim, nu wallet și nu social login;
- age band este suficient ori de câte ori data nașterii nu este necesară;
- telemetry este minimă, fără ad identifiers și SDK-uri neaprobate;
- history poate rămâne local/on-device; sync-ul este criptat și opt-in parental;
- voice/camera upload este dezactivat implicit; nicio biometrică pentru recomandări;
- parent export/delete și child-friendly privacy notice sunt obligatorii;
- datele Kids au chei, DB roles, analytics și retention separate;
- trecerea la un cont teen/adult nu importă automat history, identity sau graph.

### 11.7 Excepția Kids de la every-action chain

Activitatea copilului nu produce o urmă blockchain publică individuală. Watch
history, search, favorite, feedback, session și parental choices rămân off-chain,
criptate și ștergibile.

On-chain sunt permise numai:

- credentialul revocabil al adultului/Family Group, fără PII sau numele copilului;
- rights/provenance și payout pentru creatorul adult/instituție;
- audit roots agregate fără child identifiers;
- purchase/subscribe inițiat și confirmat de adult prin parental gate.

Această excepție are prioritate față de `1 user mutation = 1 tx`. Nu hash-uim
identificatori predictibili ai copilului și nu pretindem că un hash public este
anonim ori ștergibil.

## 12. Moderare, copyright și creator governance

### Video și live

- pre-upload hash/perceptual/audio fingerprint și post-upload scanning;
- nudity/sexual, violence, self-harm, dangerous challenges, hate, scams, CSAM/CSAE,
  NCII, deepfake impersonation și regulated-goods taxonomies;
- content rating și audience declaration obligatorii;
- live risk classifier, delay, human escalation și terminate controls;
- report/block la video, live, chat, comment, creator și ad;
- statement of reasons, strikes proporționale, expirare și appeal;
- trusted flaggers/rightsholder portal și emergency disclosure process;
- synthetic/altered media label și provenance unde este disponibilă;
- Kids moderation are queues, policies, staff și SLA distincte.

### Rights

- creatorul declară ownership/licență și territory;
- audio/video fingerprint produce `MATCH`, nu verdict automat final;
- rightsholder poate monetize/block/track numai în cadrul contractului și legii;
- counter-notice, dispute, mistaken-match review și repeat-infringer policy;
- music, clips, live și Watch împart rights graph, dar fiecare utilization are drepturi
  distincte; o licență pentru short clip nu implică VOD/live/offline;
- live takedown oprește stream-ul/teritoriul imediat, settlement-ul disputat se îngheață.

## 13. Monetizare recomandată

### Adult

- Watch/Clips ads transparente și suitability-aware;
- Premium fără ads, background/offline unde rights permit;
- channel memberships, tips și paid premieres;
- creator subscriptions și supporter badges;
- sponsor/paid-promotion declarations;
- revenue share după qualified views și invalid-traffic filtering;
- creator fund bugetat, fără token speculativ;
- live commerce numai pentru business/listing eligibil.

### Kids

- recomandarea de bază: abonament family sau catalog finanțat editorial;
- dacă există ads, numai contextuale, age-appropriate, fără profiling/remarketing și
  numai prin SDK/provider eligibil per magazin/țară;
- niciun tipar care presează copilul să cumpere, să convingă părintele sau să continue;
- purchase, external link și subscription change necesită parental gate;
- sponsorizarea și product placement sunt rare, declarate și excluse din conținutul
  destinat celor mai mici unde CountryPolicy o cere;
- activitatea copilului nu produce creator reward individualizat verificabil public.

## 14. Date principale

```text
channels(id, owner_kind, owner_id, handle, rating_policy, state, created_at)
channel_members(channel_id, account_id, role, permissions, PK(...))
videos(id, channel_id, kind=CLIP|WATCH|REPLAY, title, description,
       audience, age_rating, rights_state, moderation_state, manifest_id,
       published_at, scheduled_at, state)
video_localizations(video_id, locale, title, description, captions_asset_id)
video_chapters(video_id, start_ms, title, PK(...))
subscriptions(profile_id, channel_id, level, notification_mode, action_tx_hash)
playlists(id, owner_id, visibility, collaborative, action_tx_hash)
playlist_items(playlist_id, video_id, position, action_tx_hash)
watch_events(id/time, viewer_key, video_id, event_type, position_ms, occurred_at)
recommendation_requests(id, surface, context_version, model_version, created_at)
recommendation_items(request_id, object_id, source, position, reason_codes)
recommendation_feedback(id, profile_id, surface, object_id, kind, action_tx_hash?)

live_streams(id, channel_id, title, scheduled_at, state, latency_mode,
             ingest_provider_ref_cipher, replay_video_id, moderation_policy)
live_participants(stream_id, account_id, role, joined_at, left_at)
live_chat_messages(id, stream_id, actor_id, body, moderation_state, action_tx_hash)
live_interventions(id, stream_id, kind, actor_id, reason, occurred_at)

family_groups(id, adult_account_id, country_policy_version, consent_version, state)
child_profiles(id, family_group_id, age_band, locale, avatar_code, state)
child_parent_controls(child_profile_id, policy_json, version, updated_at)
kids_catalog_entries(country, age_band, video_id, editorial_state, valid_from, valid_to)
kids_history(child_profile_id, video_id, progress_cipher, updated_at, expires_at)
kids_feedback(child_profile_id, video_id, kind, created_at, expires_at)
```

`viewer_key` este rotit/pseudonimizat și nu este wallet address. Kids tabelele sunt
în schemă/cluster logic separat, fără acces pentru ads sau feature jobs adulte.

## 15. API principal

```text
GET /clips/feed?mode=for-you|following|friends|topic
POST /clips; POST /clips/{id}/duet|stitch|reply-video
POST/DELETE /clips/{id}/like|save

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
POST /live/streams/{id}/guests|moderators
POST /live/streams/{id}/chat
POST /live/streams/{id}/tips
POST /live/streams/{id}/report

POST /family/groups; POST /family/groups/{id}/children
PUT /family/children/{id}/controls
GET /kids/home; GET /kids/search; GET /kids/videos/{id}
POST /kids/videos/{id}/feedback
POST /kids/history/reset
POST /family/consent/revoke
```

API-ul Kids nu poate rezolva endpoint-uri Dating/Pulse/Market/Wallet și nu acceptă
session token adult reutilizat direct în child UI. Operațiile adulte cer reauth și
parental gate.

## 16. Action Ledger

Acțiuni cu tx individual adult:

- publish/edit/tombstone video/clip/live schedule;
- like/unlike, comment/reply, follow/subscribe și notification setting;
- playlist create/edit/add/remove, save/unsave și share;
- duet/stitch/remix și rights permission change;
- live start/end, public chat message, poll vote, report și moderation appeal;
- tip, membership, purchase, payout și rights settlement.

Excluderi de transport/telemetrie: impression, view, watch progress, buffering,
heartbeat, ABR switch, live packet, typing, presence și animated reaction burst.
Acestea nu creează obiect persistent. Kids urmează excepția din secțiunea 11.7.

## 17. Metrici și evaluare

### Recomandări adulte

- satisfaction survey și `not interested` recovery;
- meaningful watch/conversation, completion calibrat și return voluntar;
- creator/topic diversity, new creator discovery și repetition rate;
- report/block prevalence, dangerous-content exposure și appeal overturn;
- organic vs paid/agent/synthetic separation;
- chronological/non-profiled adoption și recommendation reset success;
- cost per delivered minute, startup p95 și rebuffer ratio.

### Live

- join success, glass-to-glass latency, buffering și failover recovery;
- intervention/terminate latency, severe incidents per 10k live hours;
- rights match precision/appeal, chat abuse și moderator coverage;
- replay processing SLA și tip/payment reconciliation.

### Kids

- zero cross-tenant/cross-age leakage;
- parent control success, consent validity și deletion SLA;
- age-suitability violation exposure și emergency removal latency;
- finite-session completion, healthy breaks și autoplay-off compliance;
- catalog diversity, accessibility și educational/editorial quality;
- zero behavioral ads, wallet activity, public child posts sau open chat.

Kids nu optimizează daily streak, session length, ad clicks ori creator revenue per
child. Acestea sunt anti-metrics.

## 18. Faze recomandate

### MVP adult

- Clips până la 3 minute și feed heuristic;
- Watch VOD până la 60 minute pentru creatori allowlisted;
- channels, subscriptions, playlists, captions și basic Creator Studio;
- recommendations explicabile + Following/Subscriptions/Editorial;
- rights/moderation pipeline și report/block;
- live managed numai pentru creatori verificați și evenimente allowlisted;
- single-host RTMP, LL-HLS, chat moderat, emergency end și replay.

### Phase 2 adult

- Watch upload extins/4K, series, premieres, podcasts și memberships;
- multi-guest WebRTC, DVR, live captions, tips și clips/replay;
- learning-to-rank per suprafață, experiment platform și model cards;
- Communities/Spaces și creator collaboration;
- managed live multi-region failover și rights matching matur.

### Nexus Kids pilot separat

- numai după adult media safety maturity;
- aplicație/binary separat, Family Center și parental consent;
- catalog editorial restrâns, video on-demand, search allowlisted și time controls;
- fără ads, upload, open social sau child live;
- live numai instituțional verificat după etapa VOD, chat dezactivat;
- o țară și două age bands la început, apoi Country Packs.

### Phase 3

- TV apps, mature rights marketplace, studio live tools și global edge optimization;
- Kids education partnerships, school mode și accessibility expansion;
- on-device/private recommendation pentru Kids după audit;
- infrastructură live proprie numai dacă TCO/scale depășesc providerul managed.

## 19. Release gates

- fiecare recommender are purpose, features allowlist, reason codes și rollback;
- Dating/Kids isolation tests demonstrează zero transfer spre ads/general models;
- mod cronologic/editorial și reset funcționează fără dark patterns;
- VOD/live rights, content rating, report/block, strikes și appeals sunt operaționale;
- live emergency terminate funcționează fără blockchain;
- Action Ledger clasifică toate mutațiile și exclude numai telemetria inventariată;
- CDN/origin deletion, territory block și replay moderation sunt testate;
- creator payout și tips se reconciliază cu chain-ul;
- Nexus Kids are binary/tenant/SDK inventory separat și DPIA/child-risk assessment;
- verifiable parental consent/authority, revoke, export și delete sunt testate;
- Kids nu are behavioral ads, precise location, public upload/chat, wallet sau chain
  history individual;
- age bands, content catalog și policies sunt aprobate prin Country Pack;
- app-store target audience, content rating și privacy disclosures sunt exacte;
- moderators și incident coverage corespund limbilor și orelor de live lansate.

## 20. Surse normative de pornire

- [Digital Services Act — recommender transparency](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [Comisia Europeană — DSA Guidelines for protection of minors](https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines)
- [FTC — COPPA Rule amendments 2025](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data)
- [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Google Play UGC Policy](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple — safe and age-appropriate experiences](https://developer.apple.com/kids/)
- [ICO — Children’s Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code)

Aceste surse sunt baseline pentru produs, nu o opinie juridică valabilă automat în
toate țările. Country Packs stabilesc pragul de copil, consimțământul, conținutul,
publicitatea, plățile, retenția și autoritățile aplicabile fiecărei lansări.
