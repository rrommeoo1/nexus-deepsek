# Business, servicii locale, promovare și Review Graph

Acest document este normativ. El integrează paginile de business, programările la
frizer/coafor și alte servicii, promovarea plătită și review-urile într-un singur
sistem transversal Nexus.

## 1. Decizia de produs

`Business` nu devine un al șaptelea profil personal. Este o entitate organizațională
controlată de unul sau mai multe wallet-uri, cu delegați și permisiuni. Astfel:

- o persoană își păstrează profilele Work/Social/Market etc.;
- un salon, magazin, artist, sală, școală sau gazdă are o `Business Page`;
- aceeași pagină poate publica servicii, produse, joburi, muzică, cursuri și promoții;
- personalul operează prin roluri, fără să primească seed phrase sau acces la
  profilul privat al proprietarului;
- Business Pages, Services, Promotion și Reviews sunt servicii globale disponibile
  din toate contextele.

```text
Business Page
├── identitate juridică/publică și badge verificabil
├── locații, program, contact și politici
├── membri: owner, manager, staff, marketer, support
├── servicii + calendar + programări
├── produse/anunțuri Market
├── joburi Work
├── catalog Music / cursuri Grow, dacă este eligibil
├── promoții și analytics
└── review-uri verificate și răspunsuri
```

## 2. Business Page

### MVP

- nume comercial, logo, cover, descriere, categorie, website și canale de contact;
- statut `UNVERIFIED`, `IDENTITY_VERIFIED`, `BUSINESS_VERIFIED`, `SUSPENDED`;
- trader/non-trader și date precontractuale afișate după rol;
- una sau mai multe locații, zonă de servicii și program normal/excepții;
- portofoliu foto/video și postări;
- owner wallet plus delegați cu RBAC;
- servicii, staff public opțional, preț „de la” sau fix și durată;
- inbox comun cu asignare, fără acces la conversațiile personale ale membrilor;
- butoane book, buy, message, call/directions și follow;
- review summary pe domenii și răspuns oficial;
- analytics de bază și campanii promovate.

### Roluri

| Rol | Permisiuni principale |
|---|---|
| Owner | ownership, billing, delegați, payout, închidere |
| Manager | pagină, servicii, program, staff, dispute operaționale |
| Staff | propriul calendar, check-in și finalizare programare |
| Marketer | conținut și campanii, fără payout sau documente sensibile |
| Support | inbox/cazuri asignate, fără export general |
| Accountant | receipts, settlement și export fiscal read-only |

Acțiunile administrative sensibile cer wallet sau step-up; postările și programul
pot folosi session capability. Payout change, owner transfer și rol Owner folosesc
flow în doi pași, notificare și cooldown.

## 3. Services — frizer, coafor și servicii locale

Verticala pornește cu beauty/barber deoarece are unitate de ofertă și calendar
clar, apoi se extinde la masaj non-medical, reparații, curățenie, fotografie,
antrenori, nutriționiști eligibili și tutoring, în funcție de legislația locală.

### Descoperire

- căutare „tuns/coafor lângă mine” pe listă și hartă;
- filtre: serviciu, preț, disponibil azi, distanță, rating, limbă, accesibilitate,
  tip păr/specializare declarată și verificare business;
- rezultate organice distincte de rezultate promovate;
- pagină salon cu portofoliu, staff, servicii, preț, durată, politici și sloturi;
- alegere „oricine disponibil” sau profesionist anume;
- favorite și saved search, fiecare ca action transaction.

Locația exactă a utilizatorului nu intră on-chain. Interogările precise au TTL,
sunt separate de profilurile Dating/Work și nu se folosesc pentru publicitate fără
temei și control explicit.

### Catalog și calendar

```text
ServiceOffering {
  id, businessId, locationId, category, title, description,
  durationMinutes, bufferBefore, bufferAfter,
  priceMode, priceAtomic, currency, depositPolicyId,
  cancellationPolicyId, eligibleStaffIds, status, manifestHash
}

AvailabilityRule {
  staffId, timezone, recurrence, exceptions, capacity, version
}
```

PostgreSQL păstrează calendarul operațional. Contractul ține numai slot reservation
compactă pentru programările cu depozit/escrow și hash-ul snapshot-ului. Un lock
Redis nu confirmă o rezervare plătită; confirmarea vine numai după execuția reușită
a contractului.

### Flux programare

1. clientul alege serviciu, locație, staff și slot;
2. backend-ul face un soft hold de 5–10 minute și generează quote/policy snapshot;
3. pentru programare gratuită sau pay-at-venue se înregistrează action tx;
4. pentru depozit/plată, wallet-ul semnează apelul `nexus-appointments`;
5. contractul rezervă slotul și fondurile atomic în modelul său;
6. reminders și schimbările de calendar sunt off-chain, dar accept/reschedule/cancel
   sunt fiecare tranzacții;
7. la locație, clientul oferă PIN/QR fără PII on-chain;
8. staff/client confirmă finalizarea sau se aplică politica de timeout;
9. payout/refund se face după fereastra de dispută;
10. eligibilitatea de review este emisă o singură dată.

### Politici și protecții

- preț total, durată, depozit, anulare și no-show înainte de semnare;
- politica este snapshot, nu poate fi schimbată retroactiv;
- reschedule limitat și consensual după deadline;
- minors nu sunt acceptați în MVP; serviciile cu risc medical sunt excluse;
- provider credentials și autorizațiile se verifică unde categoria le cere;
- business-ul nu poate cumpăra badge de verificare sau șterge review negativ;
- emergency/contact și dispute nu depind de blockchain;
- cash/pay-at-venue nu primește „payment verified”, doar „appointment verified”.

## 4. Smart contract `nexus-appointments`

Contract separat de stays, deoarece sloturile scurte, staff, no-show și servicii la
locație au altă mașină de stări.

```rust
AppointmentSnapshot {
  appointment_id,
  business_hash,
  client_profile_hash,
  service_hash,
  staff_hash,
  slot_start,
  slot_end,
  policy_hash,
  token,
  total,
  deposit,
  platform_fee_bps,
  accept_deadline
}
```

Stări:

```text
HELD → FUNDED → CONFIRMED → CHECKED_IN → COMPLETED → RELEASED
                  ├────────→ CANCELLED → REFUNDED/PARTIAL_RELEASE
                  ├────────→ NO_SHOW → POLICY_SETTLED
                  └────────→ DISPUTED → RESOLVED
```

Endpoints: `fundAppointment`, `accept`, `rescheduleByConsent`, `cancel`,
`checkInCommitment`, `confirmCompletion`, `markNoShow`, `openDispute`, `resolve`,
`withdraw`. Invariantele de liabilities, pull-payment, idempotency, fee snapshot,
caps și pause sunt identice cu celelalte escrow-uri.

## 5. Promotion Engine

Promotion este o platformă comună pentru:

- post/video/creator;
- anunț Market și produs;
- Business Page, serviciu și slot disponibil;
- job;
- stay/experience unde este legal;
- piesă/album/artist licențiat;
- curs, educator, coach și eveniment.

Dating nu permite publicitate bazată pe date sensibile. Boost-ul de profil Dating
este exclus din MVP și, dacă se evaluează ulterior, este contextual, etichetat și
nu folosește orientare, sănătate sau inferențe sensibile.

### Formate MVP

- featured placement cu preț fix și durată;
- promoted card în search/feed;
- local radius campaign pentru business-uri;
- boost pentru un obiect eligibil;
- promo code/offer cu buget și perioadă;
- creator/artist collaboration disclosure.

### Flux și billing

1. advertiser-ul este identificat; trader/business verification după prag/risc;
2. selectează obiect, obiectiv, țară/zonă, limbă, buget și perioadă;
3. content/safety/copyright review are loc înainte de livrare;
4. campaign create/update/pause este action tx;
5. bugetul sau autorizarea de plată este semnată separat;
6. impresiile și click/navigation sunt telemetrie off-chain, nu tranzacții;
7. o conversie calificată user-visible produce tranzacția normală a acțiunii;
8. billing-ul este reconciliat, iar advertiser-ul primește raport și receipt;
9. refund-ul pentru trafic invalid urmează reguli publice.

Licitația/ranking-ul rulează off-chain pentru viteză. Bugetul, campaign manifest
hash și settlement periodic pot fi ancorate on-chain. Nu se publică segmentele de
audiență sau utilizatorii expuși.

### Transparență și limite

- marcaj vizibil `Promovat`/`Sponsored`;
- identitatea beneficiarului și, dacă diferă, a plătitorului;
- explicație scurtă „De ce vezi această reclamă?” și controale;
- promovarea plătită nu trece peste filtrele de siguranță/eligibilitate;
- ranking organic și paid sunt măsurate separat;
- fără targetare din date GDPR Art. 9, Dating, chat, planuri de sănătate sau incidente;
- fără dark patterns, taxe ascunse ori auto-renew neclar;
- politică specială sau interdicție pentru politică, gambling, crypto speculative,
  medicamente, alcool și alte categorii reglementate;
- archive/ad repository pregătit pentru obligațiile aplicabile la scară.

DSA cere identificarea reclamelor, a beneficiarului/plătitorului și informații
despre parametrii targetării; interzice targetarea pe categorii speciale de date.
Regulamentul P2B cere explicarea parametrilor principali de ranking și a influenței
remunerației. Implementarea pornește de la:

- [DSA, articolele 26–27](https://eur-lex.europa.eu/eli/reg/2022/2065/oj);
- [Regulamentul P2B 2019/1150](https://eur-lex.europa.eu/eli/reg/2019/1150/oj/eng).

## 6. Review Graph universal

Nu există o singură notă care amestecă dating, muncă, condus și sănătate. Există
un graf de review-uri cu subject, domeniu, eligibility și componente specifice.

```text
ReviewSubjectType =
  BUSINESS | LOCATION | SERVICE | STAFF | PRODUCT | MARKET_LISTING |
  STAY | EXPERIENCE | HOST | GUEST | RIDE_SERVICE | DRIVER | RIDER |
  TRACK | ALBUM | ARTIST | COURSE | INSTRUCTOR | COACH | EVENT |
  APP_FEATURE
```

Excluderi:

- fără rating public al profilelor Dating;
- niciun `AgentProfile` sau `SYSTEM_TEST` nu poate scrie consumer review/testimonial;
- fără rating public al rezultatelor de sănătate, greutate sau aderență;
- safety incidents sunt cazuri private, nu text liber în scor;
- `APP_FEATURE` este feedback de produs agregat, nu reputație personală.

### Eligibilitate

Un review este `VERIFIED_TRANSACTION` numai dacă există una dintre:

- order/booking/appointment/ride finalizat;
- ticket check-in;
- stream/listen eligibility antifraud pentru feedback muzical, fără a pretinde
  cumpărare;
- course enrollment plus minimum de utilizare definit;
- servicii pay-at-venue cu check-in bilateral verificat.

Alte opinii pot fi publicate doar unde produsul permite și sunt marcate
`UNVERIFIED_OPINION`. O singură eligibilitate permite un review per direcție și
subject; editarea creează versiune nouă și action tx.

### Componente

| Domeniu | Componente exemplu |
|---|---|
| salon/serviciu | calitate, punctualitate, comunicare, igienă declarată |
| marketplace | descriere, comunicare, livrare/predare |
| stay | acuratețe, curățenie, comunicare, locație |
| ride | siguranță percepută, punctualitate, curățenie; text moderat |
| muzică | apreciere/feedback, fără efect direct automat asupra redevenței |
| curs | claritate, utilitate, acuratețe, suport |
| app feature | utilitate, ușurință, stabilitate, sugestie |

### Integritate

- proof of eligibility și `eligibleActionId` unic;
- indicator vizibil verified/unverified și metodologie;
- detectare coordinated/fake reviews, conflicte și stimulente;
- review sponsorizat/incentivized este marcat, nu amestecat silențios;
- nu se comandă, cumpără sau publică review-uri false;
- business-ul poate răspunde și contesta, nu șterge selectiv;
- moderarea păstrează și review-uri negative legale;
- agregatele folosesc minimum count, confidence/Bayesian adjustment și recency;
- decizia de eliminare are reason, apel și audit;
- review commitment și eligibility pot fi on-chain; textul și breakdown-ul rămân
  off-chain pentru moderare și drepturile persoanei.

Directiva Omnibus interzice review-urile false și prezentarea înșelătoare a
review-urilor și cere informarea consumatorului despre verificare:
[Directiva (UE) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj).

## 7. Modele de date

```text
organizations(id, kind, legal_name_cipher, public_name, status, country,
              trader_status, verification_id, manifest_hash, created_at)
organization_members(organization_id, account_id, role, scopes, state, expires_at)
business_pages(id, organization_id, handle, category, description, status,
               visibility, review_summary, manifest_hash)
business_locations(id, business_id, public_address, geo_public, geo_private_cipher,
                   timezone, opening_hours, accessibility, status)
service_offerings(id, business_id, location_id, category_id, title, duration,
                  buffers, price_mode, price_atomic, token, policy_ids, status)
staff_profiles(id, business_id, work_profile_id?, public_name, bio, credential_state)
staff_services(staff_id, service_id, price_override?, duration_override?)
availability_rules(id, staff_id, timezone, recurrence, capacity, version)
availability_exceptions(id, staff_id, starts_at, ends_at, kind, version)
appointment_holds(id, service_id, staff_id, starts_at, expires_at, state)
appointments(id, client_profile_id, business_id, service_id, staff_id, slot,
             quote_id, state, chain_ref?, checkin_commitment?, review_eligibility_id)

campaigns(id, advertiser_org_id, object_type, object_id, objective, budget,
          currency, targeting_policy, starts_at, ends_at, state, manifest_hash)
ad_creatives(id, campaign_id, asset_id, disclosure, moderation_state, version)
ad_delivery_events(id/time partition, campaign_id, request_id, event_type,
                   invalid_traffic_state, occurred_at)
ad_settlements(id, campaign_id, period, amount, proof_root, chain_ref, state)

review_eligibilities(id, source_action_id UNIQUE, author_profile_id,
                     subject_type, subject_id, domain, expires_at, consumed_at)
reviews(id, eligibility_id?, author_profile_id, subject_type, subject_id,
        domain, verification_label, components, body, state, version, chain_ref)
review_responses(id, review_id, business_id, body, state, version)
review_disputes(id, review_id, reason, evidence_ref_cipher, state, decision_id)
review_aggregates(subject_type, subject_id, domain, methodology_version,
                  count, score_components, confidence, updated_at)
feature_feedback(id, feature_key, profile_id?, rating, body_cipher, app_version,
                 state, action_tx)
```

## 8. API minim

```text
GET/POST/PATCH /businesses
POST /businesses/{id}/members
DELETE /businesses/{id}/members/{memberId}
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

GET /reviews?subjectType=&subjectId=&domain=
POST/PATCH/DELETE /reviews
POST /reviews/{id}/responses
POST /reviews/{id}/disputes
POST /feature-feedback
```

## 9. Monetizare recomandată

- Business Basic gratuit: o locație, catalog și programări limitate;
- Business Pro: 15–39 EUR/lună echivalent, în funcție de piață și funcții;
- appointment protection fee: 3–8% numai când Nexus procesează depozit/plată;
- pay-at-venue: fără comision procentual în pilot, dar cu abonament/opțiuni Pro;
- promotion: pachet fix inițial, apoi CPC/CPA numai după anti-fraud matur;
- verificare business: cost furnizor + marjă mică și transparentă;
- review-urile, răspunsurile standard și ranking-ul organic nu sunt paywalled.

Prețurile sunt ipoteze de test A/B pe piața pilot, nu promisiuni. Orice taxă este
afișată înainte de semnare și inclusă în snapshot.

## 10. Release gates juridice și operaționale

- categorie/țară allowlist și memo per serviciu reglementat;
- business/trader traceability și verificare înainte de pragurile de risc;
- price/cancellation/no-show/withdrawal disclosures validate local;
- autorizații/credentiale pentru profesii și activități reglementate;
- taxe, receipts, DAC7/VAT și responsabilitatea contractuală mapate;
- Promotion Terms, ad review, advertiser identity și ad transparency funcționale;
- review methodology, fake-review controls, incentives label și appeals testate;
- DSA/P2B/consumer protection assessment semnat pentru piața pilot;
- contractul appointments auditat înainte de fonduri reale;
- suport pentru dispute și accesibilitate, fără a pretinde că badge-ul Nexus este o
  autorizație de stat.

Aceasta este o arhitectură de conformitate, nu o opinie juridică definitivă.
Lansarea unei categorii este imposibilă până când counsel autorizat în jurisdicția
țintă și, unde este cazul, autoritatea/licențiatorul confirmă cerințele aplicabile.
