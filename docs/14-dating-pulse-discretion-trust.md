# Dating avansat, discreție și Pulse

Acest document este normativ. El extinde Dating pentru identități, orientări și
intenții diverse, definește un sistem explicabil de încredere și adaugă `Pulse`, o
rețea globală de conversație publică în timp real inspirată de X, dar cu
pseudonimitate controlată și răspundere la nivel de cont.

## 1. Principii

- Dating rămâne 18+ și complet separat de Social/Work/Pulse/ads.
- Utilizatorul definește cine este, ce dorește și ce vrea să afișeze; câmpurile nu
  sunt deduse automat din comportament.
- Sex life și sexual orientation sunt date foarte sensibile și, în UE, categorii
  speciale GDPR; nu sunt targetate comercial, exportate în ranking general sau
  publicate on-chain.
- „Serios” nu devine un scor social opac. Nexus afișează dovezi și vectori
  contestabili, nu o judecată universală despre valoarea persoanei.
- Discreția față de public nu înseamnă impunitate față de block/report/safety.
- Pulse permite aliasuri și opinii pseudonime, nu rețele de conturi false sau
  random anonymous chat.
- Agenții AI sunt interziși în Dating și etichetați permanent în Pulse.

## 2. Identitate și preferințe Dating

Modelul este configurabil per țară și limbă, fără a forța o taxonomie unică globală.

### „Eu sunt”

- femeie;
- bărbat;
- non-binary / gender-diverse;
- self-described, în limitele de siguranță;
- prefer să nu afișez public.

Valorile interne folosesc coduri stabile și labels localizate. `self_description`
este criptat și moderat numai când devine vizibil. Schimbarea identității nu
produce automat review, risc sau penalizare.

### „Doresc să cunosc”

- una sau mai multe categorii selectate explicit;
- setare separată pentru cine poate vedea profilul;
- mutual eligibility: candidatul apare numai dacă preferințele de bază se
  intersectează și politicile ambilor permit;
- utilizatorul poate ascunde public selecția;
- niciun filtru nu este reutilizat în Social/Pulse/Work ori advertising.

### Tipul relației și intenția

Configurabil privat:

- relație de lungă durată;
- căsătorie/parteneriat;
- dating și cunoaștere fără grabă;
- casual dating, unde este permis și descris non-explicit;
- prietenie/companionship;
- ethical non-monogamy, cu confirmarea că persoana înțelege termenul;
- „încă explorez”, fără promisiuni artificiale.

Nexus exclude sugar dating, escorting, servicii sexuale, compensație pentru
întâlnire și orice aranjament care solicită un act sexual contra bani/cadouri.

### Compatibilitate

Filtre hard/soft controlate de utilizator:

- vârstă legală și interval;
- distanță aproximativă/zone, fără locație exactă;
- limbi și disponibilitate pentru întâlnire;
- intenție și ritm dorit;
- copii/existenți/dorință familie;
- lifestyle declarat: fumat, alcool, sport, program;
- valori, religie/cultură și politică numai opt-in, private și fără ads;
- educație/profesie ca preferință soft, fără discriminare automată;
- accessibility și communication needs;
- pets, travel, hobbies și music/content interests numai dacă sunt importate
  explicit de utilizator din alt profil.

Nu recomandăm filtre de rasă/etnie, sănătate, venit sau „atractivitate”. CountryPolicy
poate dezactiva filtre care creează risc juridic sau de siguranță.

## 3. Discovery și selecție mai bună

Discovery nu este doar swipe pe fotografie.

### Compatibility Card

Fiecare candidat poate arăta:

- intenția mutual compatibilă;
- 3–7 puncte de compatibilitate explicate;
- 1–3 diferențe/dealbreakers pe care ambii au permis să le vedem;
- nivelurile de verificare;
- disponibilitatea generală și distanța în bucket;
- data ultimei verificări foto;
- prompt audio/video voluntar;
- motivele generale „de ce apare”, fără dezvăluirea preferințelor ascunse.

### Moduri de descoperire

- `Curated`: lot mic zilnic, compatibilitate și calitate;
- `Explore`: filtre controlate și listă/hartă aproximativă;
- `Intent Rooms`: grupuri moderate după intenție/interes, fără random chat;
- `Introductions`: introducere prin prieten comun cu consimțământul tuturor;
- `Events`: întâlniri publice verificate, speed dating și group activities;
- `Second Look`: candidați trecuți accidental, fără manipulare/paywall agresiv;
- `Travel Mode`: oraș viitor, marcat vizibil și cu anti-scam friction.

### Quality over volume

- limite rezonabile de likes și mesaje introductive;
- intro prompt personalizat, nu mesaje copy-paste în masă;
- suggested questions, value/intent cards și compatibility quiz;
- unmatch fără penalizare și block/report mereu accesibil;
- nudges anti-harassment înainte de trimiterea mesajelor cu risc;
- niciun boost nu poate ocoli preference/safety/verification filters;
- premium cumpără filtre/visibility controls, nu aprobarea sau „seriozitatea”.

## 4. Dating Trust Passport

Nu există o notă unică 1–100. Passport-ul afișează semnale verificabile, sursa,
vechimea și controlul de vizibilitate.

```text
Adult verified                  yes/no + verified_at
Identity assurance              basic/strong, fără numele juridic public
Photo match & recent liveness   yes/no + age of check
Device/account continuity       new/established, în bucket
Profile completeness            factual completeness, nu attractiveness
Video call completed            mutual claim, count bucket
Meetings confirmed              0, 1–2, 3–5, 6+; numai bilateral/PIN
No-show outcomes                none/recent pattern, numai după appeal
Safety standing                 no active restriction / limited; fără detalii victimă
Intent consistency              declared/changed recently, descriptiv
```

Ce nu intră:

- număr de parteneri, sexual history sau conținut intim;
- orientare, gender, rasă, religie, sănătate ori fertilitate;
- avere, token balance, job prestige sau follower count;
- response time ca măsură de „bună purtare”;
- numărul de persoane care au dat unmatch/block fără constatare;
- popularitate/atractivitate sau ranking secret;
- agents/bots sau review-uri publice după date.

### Badge-uri utile

- `Adult Verified`;
- `Photo Verified`;
- `Recent Liveness`;
- `Video Ready`;
- `Meeting Reliable`, numai după minimum de întâlniri confirmate și fără pattern
  de no-show; are expirare;
- `Event Checked-in` pentru evenimente Nexus;
- `Safety Training Completed`, educațional, nu certificat de bună conduită.

Badge-ul nu garantează intenția sau siguranța. UI spune exact ce verifică și ce nu.

### Due process

- outcome negativ cere evidence/eligibility, nu simpla acuzație;
- no-show este confirmat prin date/PIN și fereastră de contestare;
- safety restriction poate fi temporară în urgență, apoi human review;
- utilizatorul vede factorii, data, durata și calea de apel;
- semnalele expiră și nu traversează spre Work/Market/Credit;
- incidentele victimelor nu sunt dezvăluite persoanei raportate dincolo de ceea ce
  este necesar pentru apărare/safety.

## 5. Verificarea persoanei

Niveluri progresive:

### D0 — cont adult declarat

- age gate robust, country rules și device/account risk;
- suficient numai pentru onboarding limitat, nu pentru reach maxim.

### D1 — photo match

- selfie/liveness challenge comparat cu fotografiile profilului;
- Nexus păstrează claim, provider, confidence bucket și expiry; raw biometric este
  șters rapid dacă legea/contractul permit;
- verificarea nu publică fața brută sau documentul.

### D2 — identity/age verified

- provider specializat verifică document/eID/age estimation după țară;
- Nexus primește `over18`, uniqueness/risk și optional name-match claim;
- numele juridic este ascuns implicit.

### D3 — pre-meet live verification

- selfie challenge recent sau video call in-app;
- „ready to meet” expires după o perioadă scurtă;
- candidatul vede metoda/data, nu biometric evidence.

### D4 — verified meeting

- ambii confirmă cu PIN/QR diferit la un loc public;
- GPS singur nu dovedește prezența;
- check-in-ul nu publică locația on-chain;
- un verified meeting produce numai outcome compact și eligibility internă, nu
  un review public al persoanei.

## 6. Meet Safe

Înainte de întâlnire:

- compatibility/intent recap și boundaries card privat;
- avertisment anti-romance-scam: nu trimite bani/crypto/investiții;
- in-app video call și reverse-image/fraud checks;
- propuneri de locații publice verificate și transport independent;
- plan cu oră/bucket de locație, criptat și cu TTL;
- `Trusted Contact` selectat, share link revocabil și check-in timer;
- safety code și „call me” simulation opțional;
- blocarea trimiterii de tips/crypto către un match nou până după trust threshold,
  cu avertisment și step-up.

În timpul/după:

- one-tap safety check și escalare locală; blockchain-ul nu este pe calea critică;
- utilizatorul poate marca `safe`, `need help`, `did not meet`;
- evidence vault pentru mesaje/media selectate și chain-of-custody;
- block transversal și report; emergency support în piețele declarate;
- follow-up privat despre no-show, impersonation, coercion, scam sau safety;
- fără review public al date-ului sau „hot-or-not”.

FTC avertizează că romance scams folosesc profile false, cereri de bani/crypto și
sextortion: [FTC Romance Scams](https://consumer.ftc.gov/articles/what-know-about-romance-scams)
și [FTC sextortion/romance data](https://www.ftc.gov/news-events/news/press-releases/2023/02/new-ftc-data-reveals-top-lies-told-by-romance-scammers).

## 7. Discreție și Incognito Dating

### Niveluri de vizibilitate

- `Standard`: apare candidaților mutual eligibili;
- `Selective`: apare numai unui lot mic cu criterii stricte;
- `Liked-only`: devine vizibil numai persoanelor apreciate de utilizator;
- `Invite-only`: acces prin link/token expirat sau introduction;
- `Paused`: nu apare, dar păstrează matches/chats;
- `Hidden locally`: exclude zone/workplace buckets configurate;
- `Temporary`: profilul și media expiră, dar safety/financial/legal records nu.

### Protecții

- alias și fotografie Dating separate de Social/Work;
- notificări generice: „Ai o notificare Nexus”, fără nume/fotografie;
- Dating lock cu passkey/biometric și panic switch;
- activity/online/read receipts off implicit sau pe relație;
- distanță în bucket și jitter; niciodată metri/exact location;
- ascunderea din contact list prin private matching/blinded identifiers, fără upload
  plaintext al agendei;
- block by account, chiar dacă partea își schimbă profilul;
- `Stealth Preview`: fotografia blurată până la match/approval;
- screenshot protection în ecranele sensibile unde OS permite;
- watermark discret/receiver-bound opțional pentru media privată.

Limită: nici Incognito, nici privacy relay nu garantează anonimat blockchain.
Timing-ul, wallet funding sau un dispozitiv compromis pot corela activitatea.

## 8. Fotografii și mesaje care dispar

### `View Once`

```text
sender encrypts media locally
→ upload ciphertext cu TTL
→ message commitment tx prin privacy relay
→ receiver requests one-time key after mutual match
→ view session with capture deterrence
→ key revocation + origin/CDN purge job
```

Reguli MVP:

- numai după match mutual și acceptarea explicită a media request;
- fotografii/video non-explicite; nudity/sexual media nu sunt permise la lansare;
- no background download, no backup, no forwarding și preview blur;
- key one-time/short TTL, maximum views și expiry 1h/24h/7d configurabil;
- screen recording/screenshot blocat sau detectat unde OS permite;
- avertisment: un al doilea telefon/cameră nu poate fi oprit tehnic;
- watermark receiver-bound opțional, fără a expune public identitatea;
- sender poate revoke înainte de prima vizualizare;
- receiver poate raporta în timpul ferestrei; o copie criptată se păstrează numai
  dacă utilizatorul o atașează voluntar raportului;
- metadata minimă și purge verification; backup-ul respectă expiry;
- hash/commitment on-chain nu conține thumbnail, persoană sau content class.

### Mesaje temporare

- expiry per conversație: off, 1h, 24h, 7d, 30d;
- schimbarea politicii este vizibilă ambilor și nu șterge retroactiv evidence legal;
- delete-for-everyone emite tombstone action, dar nu promite ștergerea copiilor
  făcute înainte;
- quoted/reported message intră într-un evidence boundary separat;
- safety notices și transaction receipts nu dispar ca chat casual.

Google Play cere UGC moderation, block/report, age screening și restricții pentru
sexual content; Apple poate elimina servicii folosite predominant pentru pornografie,
random/anonymous chat sau objectification:

- [Google Play UGC/dating guidance](https://support.google.com/googleplay/android-developer/answer/12923286);
- [Apple App Review 1.2](https://developer.apple.com/app-store/review/guidelines/).

## 9. Pulse — rețea tip X

Pulse este stratul global de conversație publică, știri, opinii și comunități.
Folosește aceleași profile de context, dar oferă aliasuri suplimentare controlate.

### MVP

- post scurt text + foto/video/link, thread și edit history;
- reply, repost, quote, like, bookmark, follow și lists;
- For You, Following și Topics, cu feed cronologic disponibil;
- search, hashtags, trends cu metodologie și țară/limbă;
- polls, bookmarks private, drafts și scheduled posts;
- Community Context/Notes cu surse și voturi de utilitate;
- reply controls: everyone, followers, mentioned, approved;
- quote/mention controls, block/mute/keywords și anti-pile-on limits;
- profile Social/Work/Business/Artist sau Pulse Alias;
- postări temporare 1h/24h/7d și circles;
- badge Human/Organization/Agent și provenance AI;
- fiecare mutație produce tx compact; views/impressions rămân telemetrie.

### Phase 2

- Communities moderate, roles și membership;
- live audio `Spaces`, captions și recording consent;
- long-form Notes/newsletters;
- subscriptions și creator revenue;
- federated/share-out adapters după abuse review;
- expert credentials și institutional feeds;
- advanced Community Notes cu bridge-based rating;
- public developer/agent APIs cu rate și provenance.

## 10. Identitate în Pulse

### Moduri

- `Named Context`: profil Social/Work/Business normal;
- `Persistent Alias`: pseudonim cu reputație proprie;
- `Verified Human, Identity Private`: provider confirmă adult/unique human, dar
  publicul vede numai aliasul;
- `Community Alias`: alias valabil într-o comunitate;
- `Ephemeral Post`: conținutul expiră, aliasul poate persista;
- `Agent`: etichetat permanent AI și controller type.

Nexus nu oferă random anonymous chat. DM către un alias cere mutual follow/accept,
are block/report și rate limits. Platforma poate aplica account-level enforcement,
dar moderatorii obișnuiți nu văd mapping-ul alias↔account; accesul este break-glass,
purpose-bound și auditat.

### Ce înseamnă „anonim”

- anonim/pseudonim față de public și, opțional, față de alți participanți;
- nu anonim față de enforcement-ul proporțional al platformei;
- nu anonim față de o obligație juridică validă;
- nu criptografic imposibil de corelat pe un blockchain public;
- UI folosește formularea `identity private`, nu promite „imposibil de identificat”.

## 11. Pulse Trust și Community Context

Nu există `truth score` ori ideologie corectă. Semnalele sunt:

- human/organization/agent verification;
- account/alias age bucket;
- citations/provenance;
- correction history și edit transparency;
- Community Notes helpfulness across diverse cohorts;
- confirmed impersonation/spam/manipulation outcomes;
- domain credentials voluntare și verificabile;
- original vs repost/synthetic provenance.

### Community Context

1. contributor-ul adaugă context și surse;
2. nota este invizibilă public până la minimum diverse/cohort agreement;
3. modelul detectează brigading și coordinated agents;
4. nota explică contextul, nu penalizează automat autorul;
5. appeals/corrections și methodology version sunt publice;
6. safety misinformation urgent poate primi label/măsură separată, cu policy reason;
7. boții/agenții pot propune drafturi, dar nu votează pentru publicarea notei.

## 12. Pulse safety și moderare

- harassment, threats, doxxing, NCII, impersonation, scams și illegal content;
- hash matching/fingerprinting numai cu bază și appeal;
- rate limits pentru mentions/replies/quotes și mass-follow;
- conversation health: slow mode, reply collapse și account-age gates;
- trend integrity: exclude agents/synthetic/paid și detectează coordination;
- political content/ads policy per country, archive și targeting restrictions;
- user-selectable sensitive media filter; sexual content nu este recomandat;
- visibility reduction are reason codes și appeal;
- block transversal opțional Account-wide;
- crisis/emergency și credible threat escalation locală;
- researcher/transparency access la scară, cu privacy safeguards.

Apple cere filtering, report, block și contact pentru UGC și avertizează asupra
serviciilor folosite predominant pentru random anonymous chat. Pulse este deci
public/pseudonim moderat, nu Chatroulette.

## 13. On-chain/off-chain

| Date | Unde | Motiv |
|---|---|---|
| Dating preference/identity | encrypted off-chain | categorie sensibilă |
| swipe/match/message | generic private commitment tx | existență fără target public |
| liveness/age | claim/attestation minimal | fără biometric/document |
| exact date location/plan | encrypted vault + TTL | safety și privacy |
| no-show/safety outcome | reputation contract compact, restricted | contestabil |
| disappearing media | ciphertext object storage + one-time key | purge/control |
| Pulse public post | object storage/IPFS opt-in + hash/CID tx | public audit |
| Pulse alias private mapping | separate encrypted identity vault | anti-doxxing |
| Community Note | public content + action tx | transparency |
| impressions/trends telemetry | off-chain | volum și gas |

Private relay folosește salted commitments și wallet funding pools separate. Nu
publică gender, orientation, candidate, match, report target sau meetup location.

## 14. Modele de date

```text
dating_profiles(profile_id PK, identity_cipher, public_label_cipher?,
                pronouns_cipher?, intent_cipher, visibility_mode,
                photo_reveal_policy, trust_display_policy, version)
dating_preferences(profile_id PK, desired_identities_cipher, age_range_cipher,
                   geo_policy_cipher, hard_filters_cipher, soft_weights_cipher,
                   imported_signals_consent, version)
dating_compatibility_snapshots(id, viewer_profile_id, candidate_profile_id,
                               reasons_cipher, differences_cipher, model_version,
                               expires_at)
dating_verification_claims(id, profile_id, type, provider, result,
                           confidence_bucket?, verified_at, expires_at, state)
dating_trust_signals(id, profile_id, type, source_action_id, value_bucket,
                     visibility, issued_at, expires_at, appeal_state)
dating_meet_plans(id, match_id, time_cipher, location_bucket_cipher,
                  trusted_contact_token_ref, checkin_policy, expires_at, state)
dating_meet_checkins(id, plan_id, profile_id, pin_commitment,
                     result, occurred_at, evidence_ref_cipher?)

ephemeral_media(id, conversation_id, sender_profile_id, asset_cipher_ref,
                content_class, key_ref, max_views, view_count, expires_at,
                revoked_at, purge_state, action_tx)
ephemeral_media_views(id, media_id, receiver_profile_id, opened_at,
                      capture_signal, key_consumed_at)
conversation_expiry_policies(conversation_id, ttl, version, changed_by, changed_at)

pulse_aliases(id, account_id, handle, disclosure_mode, verification_claim_id?,
              visibility, status, reputation_namespace, chain_anchor?)
pulse_posts(id, actor_kind, actor_profile_id?, alias_id?, kind, body,
            audience_policy_id, reply_policy, expires_at?, manifest_hash,
            state, action_tx)
pulse_relationships(source_actor, target_actor, kind, action_tx, created_at)
pulse_lists(id, owner_actor, name, visibility, state)
pulse_list_members(list_id, actor_ref, action_tx)
pulse_topics(id, locale, label, policy_state)
pulse_note_candidates(id, post_id, author_actor, body, sources, state, action_tx)
pulse_note_ratings(id, note_id, human_profile_id, helpfulness, bridge_cohort,
                   state, action_tx)
pulse_trends(id, region, locale, topic, score, methodology_version, window)
```

## 15. API minim

```text
PUT /dating/profile
PUT /dating/preferences
GET /dating/candidates?mode=curated|explore|second-look
GET /dating/candidates/{id}/compatibility
POST /dating/swipes
POST /dating/verifications/{type}/start|complete
GET /dating/trust/{profileId}
POST /dating/matches/{id}/video-call
POST /dating/matches/{id}/meet-plan
POST /dating/meet-plans/{id}/check-in|safe|help|did-not-meet
POST /dating/meet-plans/{id}/trusted-contact-token
POST /conversations/{id}/ephemeral-media
POST /ephemeral-media/{id}/open|revoke|report
PUT /conversations/{id}/expiry-policy

GET /pulse/feed?mode=for-you|following|topics
GET/POST/PATCH/DELETE /pulse/posts
POST/DELETE /pulse/posts/{id}/like|repost|bookmark
POST /pulse/posts/{id}/quote|reply
GET/POST/PATCH /pulse/aliases
GET/POST/PATCH /pulse/lists
GET /pulse/search|trends|topics
POST /pulse/notes
POST /pulse/notes/{id}/ratings
POST /pulse/posts/{id}/report
```

## 16. Metrici și guardrails

Dating:

- mutual match quality, meaningful conversation și consensual meet plan;
- verification adoption și false reject/appeal rates;
- impersonation/scam/no-show/severe safety incidents per 10k matches;
- block/report latency și repeat offender containment;
- nu optimizăm swipe count, time spent sau anxietatea de a pierde match-uri;
- nu afișăm Elo/desirability/popularity score.

Pulse:

- healthy conversations, unique human contributors și source/correction rate;
- harassment/doxxing/impersonation prevalence;
- appeal overturn și moderation latency;
- trends fără bot/paid contamination;
- chronological feed availability și recommender controls;
- alias abuse rate vs legitimate privacy use;
- no agent votes în Community Context.

## 17. Faze

### MVP

- identitate/preference inclusivă, intentions, hard/soft filters și Curated;
- D1 photo match, D2 adult/identity claims unde provider disponibil;
- Incognito `liked-only`, generic notifications, Dating lock și photo reveal;
- View Once non-explicit, message expiry și encrypted evidence reporting;
- Meet Safe, in-app video call, trusted contact și scam warnings;
- Dating Trust Passport fără scor scalar;
- Pulse text/media/thread/reply/repost/quote/lists/topics/trends;
- Named Context + Persistent Alias + agent labels;
- chronological feed, reply controls, block/report și temporary posts.

### Phase 2

- D3/D4 recent liveness și verified meeting;
- Intent Rooms, Introductions, verified events și advanced compatibility;
- private contact matching și ZK/selective adult/human claims după audit;
- Pulse Communities, Spaces, long form, subscriptions și Community Context matur;
- `Verified Human, Identity Private` în țările/providerii eligibili.

### Phase 3

- cross-country safety operations și verified venue network;
- privacy-preserving matching/credentials mature;
- federation/partner feeds după abuse tests;
- public transparency/research interfaces;
- country-specific identity/relationship taxonomies și advanced safety partnerships.

## 18. Release gates

- Dating 18+ robust și Play Console minor restriction configurat;
- DPIA pentru orientation/gender/location/biometric/recommender;
- explicit-consent/withdrawal și zero Dating-to-ads/cross-profile tests;
- verification vendor biometric deletion, bias/error și appeal audit;
- Trust signals explicabile, expirabile și contestabile;
- zero agents în Dating și zero public reviews/date scores;
- disappearing media crypto/purge/capture-warning/report tests;
- sexual/NCII/CSAM/sextortion policy și trained safety response;
- Meet Safe local emergency limitations și romance-scam interventions;
- Pulse UGC filters, report, block, published contact și appeals;
- alias identity vault/break-glass audit și no random anonymous chat;
- trend/notes anti-brigading și agent/paid exclusion;
- app-store review cu demo mode și exact content/rating disclosures;
- CountryPolicy pentru relationship fields, intimate content, verification și crisis routing.

Acest design oferă discreție puternică și selecție mai bună fără a promite că un
badge sau algoritm poate garanta caracterul ori siguranța unei persoane.
