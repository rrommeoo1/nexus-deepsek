# NEXUS — strategie de produs unificat

> Notă: acest research snapshot precede Mobility, Action Ledger și Marketplace
> generalist. Cerințele normative sunt integrate în documentele `00`–`09`.

> Document de lucru pentru produs, branding, prioritizare și lansare. NEXUS este tratat aici ca un singur produs cu identitate, contexte, încredere, conversații și tranzacții comune — nu ca o colecție de clone TikTok/LinkedIn/Tinder/Airbnb.

## 1. Decizia de produs

NEXUS este o **rețea de viață multi-context**. O persoană are un singur cont controlat de wallet, dar își exprimă identitatea prin contexte separate: Social, Work, Dating, Travel și Market. Utilizatorul decide ce informații circulă între contexte și ce persoane pot confirma că două profiluri îi aparțin aceleiași persoane.

Formula produsului este:

**o identitate de bază + mai multe contexte + un inbox + un centru de încredere + un portofel/tranzacții**.

Avantajul nu este numărul de funcții. Avantajul este continuitatea: descoperi un creator în Social, îi poți cumpăra produsul în Market, îi poți rezerva experiența în Travel, îi poți oferi un proiect în Work și poți păstra toate conversațiile într-un singur inbox, fără ca datele din Dating să fie expuse automat în celelalte contexte.

### Decizii executive asumate

- Produsul este **social-first**, fiindcă feed-ul și conversațiile creează frecvență zilnică; modulele tranzacționale monetizează relațiile deja create.
- Publicul inițial este 18+, într-o singură piață europeană și maximum două limbi la lansarea beta. Dating, plățile și găzduirea fac o lansare pentru minori disproporționat de riscantă.
- Wallet-ul este rădăcina criptografică a contului, dar blockchain-ul rămâne invizibil în majoritatea UX-ului. Nu cerem utilizatorului să înțeleagă gas, nonce sau ABI.
- Nicio acțiune socială obișnuită — view, swipe, like, mesaj, follow — nu este publicată implicit on-chain.
- NEXUS nu expune un „scor social universal”. Reputația este contextuală, explicabilă și bazată pe dovezi; agregarea servește doar managementului de risc intern și nu devine instrument public de clasificare a persoanei.
- MVP-ul oferă o felie funcțională din fiecare context, dar adâncimea inițială este concentrată în Social, Chat, Market și plăți/escrow. Live, efectele video sofisticate și booking-ul internațional sunt ulterioare.
- Nu lansăm un token speculativ în MVP. EGLD și stablecoin-uri ESDT aprobate sunt suficiente pentru plăți. Un token devine justificat numai după product-market fit și analiză juridică.

## 2. Nume și branding

### Evaluarea numelui „Nexus”

„Nexus” exprimă foarte bine ideea de punct de legătură, este ușor de pronunțat internațional și se potrivește produsului. Dezavantajul este decisiv pentru un brand public: numele este foarte aglomerat în tehnologie și social. Există deja aplicații și rețele sociale cu Nexus în nume, inclusiv produse de social discovery și networking. Prin urmare, **NEXUS trebuie păstrat ca nume de proiect până la verificarea juridică**, nu presupus automat disponibil ca marcă.

Referințe rapide privind coliziunile de categorie: [Nexus Mobile App](https://apps.apple.com/us/app/nexus-mobile-app/id6743875112), [Nexus Social](https://www.nexussocial.network/) și [Nexus.app](https://www.nexus.app/). Acestea nu constituie o cercetare oficială de marcă; înainte de lansare sunt obligatorii verificarea EUIPO/WIPO, domeniile, App Store/Google Play și clasele comerciale relevante.

### Opțiuni de poziționare

| Variantă | Idee | Avantaj | Risc |
|---|---|---|---|
| **NEXUS** | punctul unde se întâlnesc lumile tale | exprimă imediat produsul | foarte aglomerat, protecție slabă |
| **Facet** | fiecare profil este o fațetă a aceleiași persoane | elegant, coerent cu multi-context | termen comun și deja folosit în software |
| **Mosaic** | fragmente diferite formează un întreg | cald, uman, bun vizual | foarte utilizat internațional |
| **NEXUS ONE** | un singur centru pentru toate rolurile | clarifică promisiunea | posibile asocieri istorice/confuzii de marcă |
| **NXS** | prescurtare vizuală a numelui de proiect | distinct în interfață, bun pentru icon | greu de căutat și rostit |

### Recomandare finală de lucru

Recomandarea pentru faza de construcție este **NEXUS**, cu descriptorul **„One life. Every side.”** / **„O viață. Toate laturile tale.”**. Este cel mai bun nume pentru a alinia produsul și echipa, dar decizia de lansare publică este condiționată de clearance de marcă. Dacă NEXUS nu poate fi protejat în clasele și piețele țintă, se organizează un sprint separat de naming; nu se alege din mers o variație generică de tip Nexora/Nexa, care are aceleași probleme de coliziune.

### Sistem vizual și verbal

- **Idee de logo:** un nod central și cinci arce/fațete care se aliniază într-un singur simbol; nu se folosesc motive crypto precum monede, hexagoane sau lanțuri.
- **Culoare de bază:** near-black `#090B10`, alb cald `#F5F7FA`, accent electric cyan-violet. Fiecare context primește o culoare secundară, dar navigația de bază rămâne constantă.
- **Ton:** direct, calm, protector. Produsul explică exact cine vede o acțiune și când se transferă bani.
- **Mesaj central:** „Tu alegi ce latură arăți. Încrederea și conversațiile merg cu tine.”
- **Promisiune funcțională:** „Un singur cont. Cinci contexte. Control total.”

## 3. Principii de produs

1. **Context înainte de conținut.** Orice postare, mesaj, listare sau interacțiune are un context activ și o audiență explicită.
2. **Separare implicită, legare voluntară.** Work, Social și Dating nu sunt legate public decât cu acordul utilizatorului; Dating este cel mai izolat context.
3. **Blockchain ca strat de încredere.** Ownership-ul, escrow-ul, plățile, badge-urile și dovezile de integritate sunt on-chain; media, chatul, ranking-ul și datele personale sunt off-chain.
4. **O singură relație, permisiuni diferite.** O persoană poate fi coleg în Work, prieten în Social și participant la un eveniment, fără a vedea automat Dating sau istoricul cumpărăturilor.
5. **Siguranță înainte de viralitate.** Raportarea, blocarea, consimțământul, verificarea și apelul la moderare sunt funcții de bază, nu backlog administrativ.
6. **Acțiunile ireversibile sunt evidente.** Orice tranzacție blockchain arată suma, moneda, fee-ul, destinatarul, politica de anulare și efectul exact înainte de semnare.
7. **Reputație contextuală și contestabilă.** Review-urile provin din interacțiuni eligibile, sunt separate pe rol și pot fi contestate; scorurile nu dezvăluie date sensibile.
8. **Valoare înainte de wallet funding.** Onboarding-ul, profilul, feed-ul și explorarea funcționează fără EGLD; tranzacțiile eligibile folosesc sponsored transactions/meta-transactions unde este sigur.
9. **Progresie, nu configurare masivă.** Utilizatorul creează un singur context la onboarding și activează celelalte când are nevoie.
10. **Măsurăm relații sănătoase, nu doar timp petrecut.** North-star: utilizatori activi săptămânal care au o interacțiune semnificativă — conversație reciprocă, conexiune acceptată, tranzacție sau participare la eveniment.

## 4. Modelul mental unificat

### Obiecte globale

- **Account:** wallet-ul, sesiunile, dispozitivele, setările legale și de securitate.
- **Identity Vault:** atribute verificate și consimțăminte. Dezvăluie contextelor doar afirmații necesare, de exemplu „18+”, nu data completă a nașterii.
- **Trust Center:** badge-uri, reputație contextuală, tranzacții eligibile pentru review, contestații și statutul verificărilor.
- **Inbox:** conversații 1:1 și grupuri, cu identitatea contextuală afișată și reguli cross-context.
- **Wallet & Activity:** solduri, plăți, escrow-uri, refund-uri, tips, bilete și semnături.
- **Safety Center:** block/report, filtre de mesaje, persoane ascunse, alerte, export și ștergere.

### Obiecte contextuale

- **Social:** profil public/pseudonim, feed, clipuri, stories, cercuri, creatori.
- **Work:** identitate profesională, experiență, competențe, portofoliu, conexiuni, joburi.
- **Dating:** profil opt-in, preferințe, discovery, likes, matches, safety controls.
- **Travel:** profil guest/host, listări, calendar, rezervări, experiențe și review-uri verificate.
- **Market:** profil buyer/seller, produse, oferte, livrare/predare, escrow și dispute.

### Legături între profiluri

Există trei niveluri de legare:

- **Privat:** sistemul știe că profilurile aparțin aceluiași account, nimeni altcineva nu vede legătura.
- **Selectiv:** proprietarul dezvăluie o legătură unei persoane, unui grup sau într-o tranzacție.
- **Public:** profilul afișează explicit celelalte contexte alese.

Legarea nu este simetrică implicit. Dacă Ana își arată profilul Work lui Mihai, Mihai nu primește automat acces la Social. Dezlegarea oprește accesul viitor, dar nu poate șterge informațiile deja văzute sau dovezile tranzacțiilor finalizate.

## 5. Arhitectura informațională și navigația

Aplicația mobilă are o singură cochilie și cinci destinații persistente:

1. **Home** — feed/dashboard adaptat contextului activ.
2. **Discover** — căutare și explorare contextuală; poate comuta în căutare globală doar explicit.
3. **Create** — video, post, job, date prompt, listare, stay/experience sau eveniment, în funcție de context.
4. **Inbox** — toate conversațiile, cu filtre pe context și etichetă vizibilă pentru identitatea folosită.
5. **Me** — profilul contextual; de aici se accesează Account, Trust, Wallet și Safety.

În partea superioară există **Context Switcher**, accesibil într-un gest. Schimbarea contextului modifică avatarul, culoarea de accent, home, create și regulile de audiență; Inbox și Wallet rămân comune. Înainte de publicare sau trimitere, composer-ul afișează permanent „Trimiți ca [profil] către [audiență]”.

### Home per context

- Social: file **For You** și **Following**, vertical video-first.
- Work: update-uri din rețea, oportunități și recomandări profesionale.
- Dating: discovery/swipe, matches noi și safety prompt; niciun feed public.
- Travel: destinații, stays/experiences și călătoriile active.
- Market: produse locale, following/saved searches și comenzile active.

### Centrul de activitate

Un „Activity Center” consolidează notificările fără a amesteca datele sensibile. Push-ul pentru Dating folosește text neutru dacă utilizatorul a activat privacy mode. Acțiunile financiare și de siguranță nu sunt grupate cu like-urile și au prioritate separată.

## 6. Inventarul complet de funcții și prioritizarea

Prioritatea folosește trei faze: **MVP** dovedește bucla unificată, **Phase 2** crește retenția și tranzacțiile, iar **Phase 3** adaugă scară, sofisticare și extindere internațională.

### 6.1 Platformă comună

#### MVP

- conectare xPortal/WalletConnect/web wallet/Ledger și challenge-signature;
- account unic, sesiuni pe dispozitive, logout/revocare, fallback și explicații de recovery;
- creare, editare, arhivare și schimbare între cele cinci tipuri de profil;
- matrice de vizibilitate pe profil, câmp și audiență;
- legare privat/selectiv/public între profiluri;
- alias, avatar, bio, locale, blocare, mute și report comune;
- contact/relationship graph cu roluri contextuale;
- Trust Center: verificări, badge-uri, review-uri eligibile și istoric;
- Wallet & Activity: balanțe, tranzacții, escrow, refund, receipts;
- inbox și notificări unificate, filtrabile pe context;
- căutare contextuală și deep links;
- consimțăminte, export, dezactivare și cerere de ștergere;
- telemetry, feature flags, help center și status page.

#### Phase 2

- conturi de organizație și profiluri administrate de echipă;
- delegare limitată și multi-signature pentru business/host;
- proof-of-personhood opțional și reusable KYC claims;
- recomandări cross-context numai cu opt-in;
- familie/household pentru călătorii și cumpărături;
- abonament premium și controale avansate de securitate.

#### Phase 3

- identitate portabilă și export interoperabil;
- reputație verificabilă între ecosisteme;
- mini-app/plugin framework cu permisiuni granular;
- DAO/guvernanță doar pentru domenii necritice și după maturizarea produsului.

### 6.2 Social / Fun

#### MVP

- feed video vertical For You/Following;
- upload până la 3 minute, crop de bază, cover, caption, hashtags și subtitrări;
- player adaptiv, preloading și opțiune data saver;
- like, comment/reply, follow, save, share link și report;
- pagină de sunet cu audio licențiat/original delimitat;
- preferințe explicite și feedback „nu mă interesează”;
- profil creator, drafturi locale și analytics de bază;
- comentarii filtrate și audiență public/connections/private.

#### Phase 2

- stories 24h, close friends și grupuri;
- duet, stitch, remix permissions;
- filtre/effecte, template-uri și bibliotecă audio licențiată;
- live streaming cu chat moderat, gifts și replay;
- colaborări între creatori, content series și creator subscriptions;
- recomandare ML cu explorare/control și creator fairness monitoring;
- organizare de ieșiri pornită dintr-un clip sau grup.

#### Phase 3

- studio creativ avansat, AR și efecte comunitare verificate;
- live multi-host, commerce live și ticketed streams;
- syndication/export cu watermark configurabil;
- creator marketplace, licensing și revenue-share avansat.

### 6.3 Work

#### MVP

- profil profesional: headline, experiență, educație, competențe și portofoliu;
- conexiuni, follow, postări text/media și căutare de persoane;
- CV exportabil și hash/timestamp pentru versiunea declarată;
- recomandări solicitate, acceptate și afișate explicit;
- badge-uri de verificare pentru angajator, educație sau credential.

#### Phase 2

- job listings, save/apply, pipeline pentru recruiter;
- job alerts și matching explicabil;
- pagini de companie, echipe, evenimente profesionale;
- credentiale verificabile emise de instituții;
- contracte/freelance milestones cu escrow.

#### Phase 3

- marketplace global de servicii, talent pools și referral rewards;
- skill graph și recomandări bazate pe rezultate validate;
- integrare ATS/HRIS și verificări enterprise.

### 6.4 Dating

#### MVP

- activare separată 18+, onboarding cu consimțământ și reguli de siguranță;
- profil cu poze/video, prompts, interese, intenție și preferințe;
- discovery cu filtre de bază, like/pass și match reciproc;
- chat disponibil numai după match;
- unmatch, block, report, limitare capturi unde platforma permite și privacy pentru push;
- verificare selfie/liveness prin furnizor, păstrând doar rezultatul necesar;
- locație aproximativă, fără coordonate exacte sau distanță hiperprecisă.

#### Phase 2

- filtre avansate, incognito și „cine m-a apreciat” premium;
- voice/video intro, apeluri și date check-in;
- trusted contact, share date plan și safety reminders;
- speed dating/event matching și compatibilitate explicabilă;
- dovadă opțională a unor atribute fără publicarea documentelor.

#### Phase 3

- matching asistat, travel mode, evenimente verificate și concierge;
- interoperabilitate cu contexte numai prin double consent;
- sisteme anti-fraudă și anti-harassment adaptive la scară.

### 6.5 Travel & Stay

#### MVP

- listare stay/experience cu media, locație aproximativă/publică și adresă privată după confirmare;
- calendar, disponibilitate, reguli, preț și fee breakdown;
- request-to-book, accept/refuz, escrow și anulare după politica afișată;
- itinerar, chat contextual și confirmări;
- check-in/check-out confirmation și review bilateral după tranzacție;
- verificare host și raportare/listing takedown.

#### Phase 2

- instant book pentru host eligibil, calendar sync și prețuri sezoniere;
- co-host, taxe/fee-uri regionale, depozit și damage claims;
- experiences cu capacitate, bilete NFT/non-transferabile configurabil;
- hărți, colecții și recomandări;
- split booking și grup de călătorie.

#### Phase 3

- multi-currency, payout routing și instrumente profesionale de property management;
- asigurare/garanții prin parteneri, verificare proprietate și risk scoring;
- integrare channel manager și distribuție B2B.

### 6.6 Marketplace

#### MVP

- listări produs cu categorie, stare, media, preț EGLD/stablecoin și zonă;
- browse/search/filter, favorite și seller profile;
- ofertă/contraofertă și chat legat de produs;
- cumpărare cu escrow, pickup sau livrare declarată;
- confirmare primire, refund/dispută și review tranzacțional;
- rate limits, detecție duplicate și categorii interzise.

#### Phase 2

- shipping labels/tracking, variante/cantitate și shop pages;
- promoted listings, bundles, licitații controlate;
- local meet-up safety, QR handoff și verificare produs;
- seller analytics și instrumente fiscale/export.

#### Phase 3

- cross-border compliance, customs și protecție extinsă;
- commerce din video/live, affiliate attribution și creator storefronts;
- tokenizare pentru bunuri strict unde ownership-ul digital aduce valoare reală.

### 6.7 Chat, grupuri și ieșiri

#### MVP

- 1:1 și grupuri, E2EE, text/media/reply/reactions;
- delivered/read typing opționale, search local și disappearing messages;
- identitate contextuală vizibilă, request inbox și anti-spam;
- mesaje de sistem semnate pentru ofertă, booking, escrow, refund și tip;
- creare eveniment, invitații, RSVP, sumă țintă și contribuții individuale;
- raportare mesaj și mecanism de „reportable transcript” explicit, fără a pretinde acces server-side la toate mesajele E2EE.

#### Phase 2

- voice/video calls, polls, location share temporar și event checklist;
- split exact/egal/custom, reminders și refund automat;
- community spaces, roluri, canale și moderare;
- backup criptat cu recovery controlat de utilizator.

#### Phase 3

- large communities, broadcast, bots/mini-apps permisionate;
- interoperabilitate controlată și identitate verificabilă în conversații externe.

### 6.8 Moderare, încredere și operațiuni

#### MVP

- reguli comunitare pe suprafață și categorii interzise;
- block/report/mute, severity triage și SLA-uri;
- moderare automată pre/post-publicare pentru media publică, plus review uman pentru cazuri sensibile;
- age gating, spam/fraud detection, device/session risk și wallet rate limits;
- audit trail pentru decizii, notice-and-action și apel;
- dispute queue pentru Market/Travel, cu probe, deadline și arbitraj operațional;
- emergency escalation pentru amenințări credibile și exploatare.

#### Phase 2

- trusted flaggers, moderator tooling avansat și transparency reports;
- reputation-weighted limits fără penalizări opace;
- safety classifiers multi-language și cohort monitoring.

#### Phase 3

- centre regionale de operațiuni, appeals board independent și audituri de fairness;
- programe de asigurare și parteneriate instituționale.

## 7. Fluxuri principale de utilizator

### 7.1 Onboarding wallet-first fără fricțiune inutilă

1. Utilizatorul alege „Conectează wallet” și selectează xPortal, browser wallet sau Ledger.
2. Aplicația prezintă un mesaj lizibil și cere semnarea unui challenge cu nonce și expirare; nu cere tranzacție și nu mută fonduri.
3. Account-ul este creat off-chain, iar utilizatorul acceptă termenii și declară eligibilitatea 18+.
4. Alege contextul inițial; recomandarea implicită este Social. Completează doar numele, avatarul, interesele și vizibilitatea.
5. Primește un tur de 30–45 secunde despre Context Switcher, Inbox și Wallet.
6. Crearea commitment-ului on-chain este sponsorizată/batched atunci când este necesară, nu blochează prima sesiune.

**Excepții:** challenge expirat, wallet greșit, rețea indisponibilă și tranzacție sponsorizată eșuată păstrează draftul și oferă retry; nu se creează conturi duplicate.

### 7.2 Crearea și schimbarea contextului

1. Din switcher, utilizatorul alege „Adaugă un context”.
2. Aplicația explică ce date sunt izolate și ce atribute din Identity Vault sunt cerute.
3. Utilizatorul completează minimul specific și alege cine poate descoperi profilul.
4. La schimbare, avatarul și accentul UI se modifică, iar composer-ul și Home se reconfigurează.
5. Orice draft rămâne asociat contextului original. Dacă utilizatorul încearcă să posteze din alt context, primește avertizare explicită.

### 7.3 Legarea a două profiluri

1. Din profil, utilizatorul alege „Arată și contextul Work”.
2. Selectează audiența: public, conexiuni selectate sau o singură persoană și o durată opțională.
3. Previzualizează exact câmpurile vizibile.
4. Confirmă. Destinatarul vede o legătură verificată de platformă, nu wallet-ul brut, dacă acesta nu a fost făcut public.
5. Accesul poate fi retras din Privacy Center.

### 7.4 Publicarea și consumul unui video

1. Creatorul apasă Create în Social, filmează/încarcă, taie, adaugă cover, caption, sunet și subtitrare.
2. Selectează audiența, permisiunile pentru comentarii/remix și confirmă drepturile asupra sunetului.
3. Upload-ul poate continua în fundal; clipul trece prin transcodare și verificări.
4. După publicare, feed-ul folosește interese, relații, feedback negativ, calitatea și diversitatea; nu folosește date Dating.
5. Viewer-ul poate like/comment/share/save/follow/report; creatorul vede statistici agregate.

### 7.5 Match și conversație Dating

1. Utilizatorul activează Dating și trece verificarea de vârstă/eligibilitate.
2. Configurează preferințe și vizibilitate; profilul nu apare conexiunilor excluse/blocate.
3. Like/pass rămân off-chain și private. Numai like-ul reciproc creează Match.
4. Chatul E2EE se deschide cu identități Dating. Niciun profil Social/Work nu este dezvăluit fără double consent.
5. Oricare parte poate unmatch/block/report. Raportarea cere selectarea mesajelor ce vor fi atașate ca probă, explicând ruptura limitată a confidențialității.

### 7.6 Cumpărare Market cu escrow

1. Buyer-ul deschide listarea, verifică seller badge, condiția, livrarea și totalul.
2. Poate negocia; oferta acceptată generează un checkout cu preț, fee, deadline și condiții de release/refund.
3. Buyer-ul semnează tranzacția. Contractul confirmă escrow-ul, iar chatul primește un card de stare verificabil.
4. Seller-ul predă/expediază și atașează dovada. Buyer-ul confirmă primirea sau deschide dispută înainte de deadline.
5. La confirmare, contractul distribuie plata și fee-ul. Părțile pot lăsa review doar pentru această tranzacție.
6. La dispută, fondurile rămân blocate până la acord, refund automat conform regulilor sau arbitraj autorizat.

### 7.7 Rezervare Travel

1. Guest-ul selectează perioada/participanții și vede totalul, politica de anulare, depozitul și cerințele de verificare.
2. Trimite request-to-book; perioada primește hold temporar off-chain.
3. Host-ul acceptă în termen. Guest-ul semnează escrow-ul; calendarul se blochează numai după confirmarea on-chain.
4. Adresa exactă și instrucțiunile sunt dezvăluite conform politicii după confirmare.
5. Check-in/out produc confirmări; payout-ul se eliberează conform ferestrei contractuale.
6. Review-urile devin vizibile bilateral după publicarea ambelor sau expirarea ferestrei.

### 7.8 Ieșire de grup cu split payment

1. Organizatorul creează evenimentul din Social sau Chat, invită oameni și definește bugetul.
2. Alege split egal, sume personalizate sau contribuție liberă; fiecare participant vede propria obligație.
3. Participanții semnează/plătesc individual. Fondurile pot rămâne în escrow până la atingerea pragului.
4. Dacă pragul nu este atins până la deadline, refund-ul este automat; dacă este atins, plata merge la vendor/organizator conform regulilor.
5. Biletul/QR-ul și conversația rămân în event card.

### 7.9 Tip către creator

1. Viewer-ul apasă Tip, alege EGLD/ESDT și suma.
2. UI arată creatorul, protocol/platform fee și totalul înainte de semnare.
3. După confirmare, creatorul primește receipt; afișarea publică este opt-in pentru ambele părți.

### 7.10 Dispută și apel

1. O parte selectează tranzacția eligibilă, motivul și probele; sistemul îngheață release-ul dacă fereastra contractuală permite.
2. Cealaltă parte primește deadline pentru răspuns.
3. Regulile deterministe sunt aplicate automat; cazurile ambigue intră în coadă de arbitraj cu acces minim la date.
4. Decizia include motiv, distribuția fondurilor și calea de apel.
5. Acțiunea finală este executată on-chain și înscrisă în activity trail.

### 7.11 Incognito și profil temporar

Incognito înseamnă reducerea descoperirii și ascunderea stării active, nu anonimitate față de platformă sau imunitate la reguli. Profilurile temporare nu pot primi badge-uri permanente, găzdui, vinde peste limite mici sau ocoli blocările. La expirare, conținutul off-chain se șterge conform politicii; obligațiile tranzacționale și dovezile on-chain nu pot fi șterse, fapt explicat înainte de utilizare.

### 7.12 Export și ștergere

1. Utilizatorul cere export sau ștergere din Account.
2. Reautentifică wallet-ul și primește inventarul datelor, tranzacțiilor active și retențiilor obligatorii.
3. Sistemul închide sesiunile, oprește discovery și finalizează/anulează operațiunile unde este posibil.
4. Datele off-chain eligibile sunt șterse/anonymized; cheile/CID-urile private sunt revocate.
5. Înregistrările blockchain nu pot fi eliminate. UI separă clar datele șterse de commitments/transferuri publice imuabile.

## 8. Monetizare

Monetizarea trebuie să urmeze valoarea creată, nu să penalizeze confidențialitatea sau accesul de bază.

### Surse recomandate

- **Market protection fee:** 1,5–3% din tranzacție, separat și vizibil; poate varia după categorie/risc.
- **Travel fee:** 8–14% total, împărțit transparent între host și guest; taxele și costurile procesatorilor sunt separate.
- **Creator tips:** 0–5% platform fee în funcție de campanii și subscription tier.
- **Boost-uri:** promovare pentru clipuri, joburi și listări numai dacă sunt etichetate „Sponsored”; nu se permit în Dating discovery în MVP.
- **NEXUS Plus:** controale premium (analytics, incognito Dating, saved search alerts, upload/storage superior), fără a ascunde funcțiile de siguranță după paywall.
- **NEXUS Pro:** instrumente pentru seller, creator, recruiter și host: analytics, echipă, automatizări, export și suport prioritar.
- **Ticketing/experiences:** fee per bilet și procesare.
- **Enterprise verification/API:** verificare organizații, credential issuance și integrare, în Phase 2/3.

### Ce nu monetizăm

- vânzarea datelor personale sau Dating;
- taxă pentru block/report/appeal ori pentru setări de confidențialitate de bază;
- pay-to-win mascat în ranking organic;
- staking obligatoriu pentru utilizatorul obișnuit;
- token emis doar pentru finanțare sau gamification.

### Economie fără token în MVP

Punctele și achievements sunt non-transferabile și nu promit randament. Plățile folosesc EGLD și stablecoin-uri ESDT selectate. Badge-urile sunt non-transferabile sau soulbound-like la nivel de logică și pot fi revocate/expira. Dacă se introduce ulterior un token, utilitatea minimă trebuie să provină din reduceri de fee, rewards cu buget clar și eventual guvernanță limitată; înainte sunt obligatorii opinia juridică, modelul de emisii, politica treasury, simularea abuzului și clasificarea fiscală/reglementară.

## 9. Metrici de succes și garde-fous

### North-star

**Weekly Meaningful Participants (WMP):** conturi distincte care într-o săptămână au cel puțin o conversație reciprocă, conexiune acceptată, tranzacție confirmată, booking/event participation sau contribuție creativă cu feedback autentic.

### Metrici pe bucle

- Activation: wallet conectat → primul context complet → prima acțiune semnificativă în 24h.
- Multi-context adoption: procentul utilizatorilor activi cu două contexte folosite în 30 zile, nu doar create.
- Social: completion rate, saves, „not interested”, creator retention, distribuția reach-ului.
- Chat: conversații reciproce, accept rate pentru message request, reports/1.000 conversații.
- Dating: match-to-conversation, unmatch/report rate, safety check usage; nu optimizăm doar swipe count.
- Market/Travel: GMV, conversion, completion, dispute/refund, median payout time și repeat rate.
- Trust: verificări finalizate, apeluri admise, false-positive rate și timp de soluționare.

### Garde-fous obligatorii

- crash-free sessions, p95 feed start, upload success și message delivery;
- cost per video minute și cost per monthly active user;
- fraud loss/GMV, chargeback/refund și contract failure rate;
- prevalence pentru conținut grav, median time-to-action și appeal reversal;
- expunere cross-context accidentală: țintă zero incidente confirmate;
- concentrare creator reach și bias monitoring.

## 10. Roadmap realist pentru dezvoltare asistată de agenți

Agenții reduc timpul de redactare, scaffolding, cod repetitiv, test generation și analiză. Nu elimină dependențele seriale dintre protocol, mobile, backend, media, securitate și operațiuni și nu transformă validarea mainnet într-o activitate complet paralelă. Estimările de mai jos presupun 4–6 fluxuri de agenți, decizii rapide, scope controlat, servicii managed pentru video/search și acces prompt la conturile externe.

### Etapa 0 — Definition & proof (3–5 săptămâni)

- PRD și model de domeniu stabil;
- prototip navigabil pentru Context Switcher, feed, checkout și chat;
- contract interfaces, threat model și matrice on-chain/off-chain;
- design system, analytics taxonomy și policy skeleton;
- test de fezabilitate wallet/mobile, video pipeline și meta-transactions.

**Exit:** toate fluxurile critice au contract UI/API și deciziile ireversibile sunt consemnate.

### Etapa 1 — Fundația comună (8–12 săptămâni)

- monorepo, CI/CD, environments, observability;
- auth wallet, account, profile contexts, privacy matrix;
- media upload/player, relationship graph și notification baseline;
- chat 1:1/group foundation;
- contracte identity/badges/payment primitives pe devnet;
- moderation/reporting baseline și admin console.

**Exit:** două conturi pot folosi mai multe contexte, comunica și realiza o tranzacție de test end-to-end.

### Etapa 2 — MVP integrat pe verticalele de produs (12–16 săptămâni)

- Social feed complet MVP;
- Work profile/connection/credential baseline;
- Dating discovery/match/chat izolat;
- Market listing/offers/escrow;
- Travel request-to-book/calendar/escrow;
- events/split payment, Trust Center și Wallet Activity;
- dispute and moderation workflows.

**Exit:** feature-complete pentru closed alpha pe devnet/test payments.

### Etapa 3 — Hardening și closed beta (8–12 săptămâni)

- testare integrată, load/chaos, accessibility și dispozitive reale;
- audit intern repetat și audit extern independent al contractelor înainte de bani reali;
- pen-test, privacy review, abuse simulations și incident response exercises;
- tuning ranking, video cost și rate limits;
- beta limitată, operațiuni de moderare/dispute și remedierea cohortelor.

**Exit:** release candidate, fără vulnerabilități critice/high deschise și cu rollback/pause procedures testate.

### Etapa 4 — Public beta într-o piață (12–20 săptămâni)

- rollout gradual, limite valorice, reserve/risk controls;
- creator/host/seller seeding și suport operațional;
- app store review, transparency/reporting și conformitate locală;
- primele funcții Phase 2 bazate pe date reale.

### Calendar agregat

| Rezultat | Durată realistă |
|---|---:|
| specificații + prototip validabil | 3–5 săptămâni |
| demo tehnic end-to-end | 10–16 săptămâni |
| alpha integrată cu toate cele cinci contexte, dar scope subțire | 6–8 luni |
| closed beta stabilă | 8–11 luni |
| public beta cu tranzacții limitate | 12–16 luni |
| Phase 2 matură | 18–24 luni |
| viziunea largă Phase 3 | 30–42 luni |

Nu este necesară o echipă convențională de 5–8 programatori pentru a produce rapid cod și documentație, însă produsul rămâne **XXL**: video global, E2EE, dating safety, marketplace, travel escrow și blockchain sunt fiecare domenii cu failure modes proprii. Un MVP în 2–4 luni poate fi un demo sau alpha controlată, nu o lansare publică sigură care mută bani și gestionează întâlniri/cazări între necunoscuți.

### Complexitate pe domenii

| Domeniu | Complexitate | Motiv dominant |
|---|---|---|
| identity + multi-context privacy | foarte mare | autorizare pe câmp/audiență și prevenirea scurgerilor între contexte |
| feed/video | foarte mare | media cost, latență, ranking, copyright și moderare |
| E2EE chat | foarte mare | key lifecycle, multi-device, abuse reporting și recovery |
| smart contracts/escrow | foarte mare | bani ireversibili, upgrades, dispute și edge cases |
| Dating | foarte mare | siguranță fizică, fraudă, vârstă și locație |
| Travel | foarte mare | calendar consistency, anulări, fiscalitate și incidente |
| Market | mare | fraudă, livrare, categorii interzise și dispute |
| Work | mediu–mare | verificarea credentialelor și recruiter workflows |

## 11. Ordinea de lansare și strategia de piață

Produsul este integrat arhitectural din prima zi, dar distribuția trebuie secvențiată:

1. **Social + Chat** creează obiceiul și rețeaua.
2. **Market + creator tipping** introduc tranzacții mici și dese, cu risc limitabil.
3. **Work** aduce identitate verificată și motive de utilizare non-entertainment.
4. **Travel/Experiences** reutilizează trust, chat și escrow după ce operațiunile de dispute sunt validate.
5. **Dating** se deschide pe invitație/cohorte și cu safety operations active, chiar dacă modulul există tehnic în alpha.

Wedge-ul recomandat este o comunitate urbană de creatori, freelanceri și experiențe locale. Aceeași persoană poate publica video, vinde un obiect, oferi un serviciu sau organiza o experiență; astfel, valoarea multi-context apare natural și nu trebuie explicată printr-o campanie generică „super-app”.

## 12. Criterii de scope pentru MVP

O funcție intră în MVP numai dacă îndeplinește cel puțin una dintre condiții:

- este necesară pentru bucla „descoperire → conversație → încredere → tranzacție”;
- previne o problemă materială de privacy, safety, fraud sau pierdere de fonduri;
- validează diferențiatorul multi-context;
- este cerută de distribuția App Store/Google Play ori de obligațiile legale ale pieței pilot.

Se amână dacă este predominant cosmetică, poate fi înlocuită cu un serviciu managed, necesită lichiditate/rețea globală înainte de PMF sau introduce risc financiar fără dovadă de cerere. În mod concret, live streaming, efectele AR, licitațiile, instant book, apelurile video, tokenul propriu și interoperabilitatea largă nu sunt criterii de acceptare ale MVP-ului.

## 13. Definition of Done pentru produsul integrat

MVP-ul nu este „gata” doar pentru că ecranele există. Este gata pentru closed beta când:

- fiecare acțiune afișează contextul și audiența corectă;
- nu există acces cross-context fără o regulă testată și auditabilă;
- două persoane pot parcurge end-to-end feed → profil → chat → cumpărare/booking → review;
- dating likes și chat content nu ajung pe chain și nu influențează feed-ul public;
- orice plată are idempotency, reconciliere, pause path, refund/dispute path și receipt;
- pierderea conexiunii, schimbarea wallet-ului și reîncercarea nu dublează tranzacții;
- block/report funcționează transversal, cu efectele explicate;
- contractele și backend-ul au invariants, tests și observability;
- retenția și ștergerea sunt implementate, nu doar descrise în policy;
- operațiunile pot gestiona incidente, dispute și apeluri în SLA înainte de rollout.

## 14. Concluzie

NEXUS trebuie construit ca un **sistem operațional social pentru mai multe laturi ale aceleiași vieți**. Diferențiatorul defensabil nu este că oferă cinci tab-uri, ci că păstrează separarea necesară și transportă consimțit încrederea, conversația și valoarea între contexte. Arhitectura și roadmap-ul trebuie să protejeze această idee chiar și atunci când funcțiile fiecărui context sunt inițial mai puțin adânci decât ale aplicațiilor specializate.
