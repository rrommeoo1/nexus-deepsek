# Securitate, privacy, moderare și conformitate

> Acesta este un design tehnic și o hartă de conformitate pentru lansarea pilot
> în UE/SEE. Nu este o opinie juridică locală și nu certifică independent codul.

## 1. Model de securitate

### Active critice

- fonduri și liabilities din escrow;
- controller-ul profilurilor și wallet sessions;
- cheile relayer/upgrade/issuer/resolver;
- cheile de sesiune, Action Ledger capabilities și bugetele de gas sponsorship;
- cheile E2EE ale dispozitivelor și encrypted backups;
- mapping-ul privat account ↔ profile;
- Dating preferences, locație, verificări și safety evidence;
- adrese de cazare, documente seller/host și date fiscale;
- locații live, trasee, documente driver/vehicle și incidente Mobility;
- media nepublicată, moderation evidence și admin audit.

### Adversari

- account takeover, device theft și phishing wallet;
- seller/host/buyer fraud, collusion și dispute manipulation;
- Sybil/bot farm care consumă relayer/feed/rewards;
- harasser care încearcă să coreleze profilurile;
- creator care încarcă malware/conținut ilegal/copyright;
- moderator/admin curios sau compromis;
- supply-chain compromise în npm/cargo/container;
- exploit de smart contract, indexer sau cross-shard assumptions;
- scraping și deanonymization din chain, timing și graph.
- relayer compromise/censorship, session-key theft, replay și corelarea acțiunilor private.

## 2. Controale obligatorii

### Identitate și sesiuni

- NativeAuth cu origin/chain/expiry validate server-side;
- access token scurt, refresh rotation cu reuse detection, device revoke;
- step-up wallet signature pentru schimbare wallet, payout, privacy export și roluri;
- niciun seed phrase/PEM necriptat; UI anti-phishing arată domeniul și intenția;
- account recovery nu poate transfera active blockchain fără cheia wallet;
- Guardian-compatible și session inventory accesibil utilizatorului.

### Social login și wallet embedded

- Google/Apple/Facebook/TikTok numai prin SDK/OIDC/Login Kit oficial;
- `state`, `nonce`, PKCE, exact redirect URI, issuer/audience/expiry verification;
- account key este `(issuer, subject)`; email-ul nu auto-leagă și nu auto-merge;
- scopes minime; provider token nu se păstrează fără nevoie declarată;
- link/unlink/merge/recovery cer recent auth, passkey/wallet proof și notificare;
- embedded wallet folosește xAlias/passkey sau MPC/threshold auditat;
- nicio cheie completă/seed în backend, KMS, logs, analytics ori support;
- recovery are minimum două căi, cooldown și export/migrare spre wallet extern;
- social-provider compromise nu poate muta singur fonduri peste policy/prag;
- provider deauthorization, data deletion și outage runbooks sunt testate.

### Chei de sesiune și Action Ledger

- wallet-ul autorizează explicit public key, profil commitment, scopes, max actions
  și expirare; capability nu poate transfera fonduri;
- private key este generată per device/profil și stocată în Keychain/Keystore;
- revoke all la device loss, wallet step-up pentru scope/expiry mai mare și rotație;
- domain separation include network, contract, capability și version;
- nonce anti-replay, TTL, exact one action per transaction și canonical encoding;
- relayer-ul verifică policy, dar contractul reverifică signature/scope/nonce;
- quotas și circuit breaker limitează furtul cheii și drenarea bugetului;
- public/private relay pools și logging separat reduc corelarea, fără a promite
  anonimitate criptografică perfectă.

### Autorizare multi-context

- deny by default; policy input include `accountId`, `actorProfileId`, resource,
  relation, audience, device/risk și purpose;
- `X-Nexus-Profile` nu este de încredere singur: ownership se verifică din sesiune;
- block global este aplicat înainte de search/feed/chat/listing;
- Dating rule engine și DB role separate;
- teste generate pentru fiecare pereche profil × acțiune × audiență;
- accesul intern la mapping-ul profilurilor este break-glass, justificat și auditat.

### Criptografie și secrets

- TLS 1.3 la edge și mTLS/workload identity pentru servicii sensibile;
- envelope encryption AES-256-GCM sau echivalent aprobat, nonce unic și AAD;
- KEK în KMS/HSM, rotație versionată; DEK separat pe domeniu/record;
- parole/secrete interne cu Argon2id unde se aplică, token hashes nereversibile;
- signing keys cu least privilege, multisig pentru chain administration;
- backup criptat, restore tests și key destruction documentat.

### App/mobile

- chei E2EE și refresh material în iOS Keychain/Android Keystore;
- certificate pinning evaluat cu plan de rotație, nu hardcode fragil;
- root/jailbreak este semnal de risc, nu blocare absolută;
- deep links allowlisted, clipboard și screenshots minimizate în Dating/seed flows;
- build signing, SBOM, provenance și dependency lockfiles;
- fără secrets în bundle sau analytics payload.

### API și infrastructură

- schema validation strictă, request/body limits și content-type allowlist;
- per wallet/account/device/IP/risk rate limits;
- idempotency pentru mutații financiare și replay protection;
- SSRF protection la import media/URL, malware scanning și archive bombs limits;
- WAF/bot protection, egress allowlist, private DB, service identities;
- separate cloud accounts/projects pentru prod și non-prod;
- audit WORM, clock sync, OpenTelemetry și alerting pe acțiuni privilegiate.

## 3. E2EE chat

Matrix facade gestionează identitatea contextuală și room ACL. Serverul păstrează
ciphertext, device keys, room metadata minimă și delivery state; nu poate citi
mesajele E2EE obișnuite.

Controale:

- device verification și avertisment la cheie/dispozitiv nou;
- key rotation la remove/unmatch/block și group membership change;
- encrypted backup opt-in cu recovery key controlată de utilizator;
- attachments criptate client-side cu chei separate;
- push generic, mai ales pentru Dating;
- anti-spam pe metadata/rate/reputation, nu scanare ascunsă a plaintext-ului;
- report flow exportă numai mesajele selectate, contextul și cheile necesare,
  după consimțământ explicit al reporterului;
- fiecare send/edit/tombstone are tranzacție `PRIVATE_ACTION`; chain-ul vede
  timestamp, relayer și commitment, nu ciphertext/plaintext, participanții sau room;
- mesaje financiare sunt carduri semnate/verificabile, dar conversația rămâne E2EE.

Nu promitem „zero metadata”, „perfect forward secrecy” sau backup sigur până când
testele protocolului și configurarea exactă demonstrează aceste proprietăți.

## 4. Securitatea smart contracts și audit

### Checklist de review

- access control și separarea rolurilor;
- exact payment/token/nonce validation;
- state machine completeness, terminal states și deadline boundaries;
- checks-effects-interactions/reentrancy și callbacks;
- cross-shard async failure, duplicate callback și compensare;
- arithmetic/bps/rounding/dust și BigUint resource exhaustion;
- liability/ledger/withdraw, stuck funds și failed payout;
- replay/idempotency/action IDs și nonce coordination;
- pause fără confiscare, upgrade/storage compatibility și owner compromise;
- ESDT roles, NFT transfer/revocation semantics;
- unbounded storage/loops, gas griefing și event/indexer ambiguity;
- relayer payload mutation, shard pool drain și simulation mismatch.
- capability escalation, Ed25519 domain confusion, action replay/reordering,
  duplicate reducer effects și privacy commitment dictionary attacks;
- invariantul exact `1 action envelope = 1 transaction = 1 accepted event`.

### Proces

1. threat model + specification invariants înainte de cod;
2. două review-uri interne independente pe PR;
3. static/dependency/SBOM checks;
4. unit/scenario/property/fuzz și gas snapshots;
5. devnet cross-shard/load/adversarial tests;
6. audit intern cu findings `Critical/High/Medium/Low/Informational`;
7. fix, regression și retest report;
8. audit extern înainte de mainnet cu fonduri semnificative;
9. bug bounty după remediere și monitorizare/caps progresive.

Un raport produs de autor este valoros, dar nu este audit „independent”. Acest
principiu protejează utilizatorii și proiectul, nu limitează implementarea.

## 5. Privacy by design și GDPR

### Clasificare

| Clasă | Exemple | Regim |
|---|---|---|
| Public | handle, post public, listing | minimizare, takedown, cache purge |
| Intern | IDs, flags, risk events | least privilege și retention |
| Confidențial | adresă, contact, documente fiscale | encryption și access audit |
| Special/sensibil | orientare/dating, biometric templates, health inference | evitare; temei explicit și DPIA |
| Financiar | quotes, ledger, tx, tax report | integrity, retention legală, segregare |

Datele despre viața/orientarea sexuală și biometria folosită pentru identificare
sunt categorii speciale în sensul art. 9 GDPR. Dating implică inevitabil risc de
inferare, deci are DPIA, separare și scopuri înguste. Furnizorul de liveness trebuie
să returneze pe cât posibil un claim (`18+`, verificat, expirare), nu imaginea sau
template-ul biometric brut.

### Cerințe operaționale

- data map/RoPA, controller-processor roles și DPA-uri;
- lawful basis per purpose, nu un consent generic;
- explicit consent unde este temeiul aplicabil categoriilor speciale;
- DPIA pentru Dating, age/liveness, ranking/profiling, location și fraud;
- privacy notices layered, purpose limitation și retention schedule;
- DSAR/export/rectify/delete/restrict/object și preference reset;
- SCC/transfer impact assessment pentru furnizori non-SEE;
- breach playbook și registru; notificările legale sunt evaluate în termen;
- DPO/representative după criteriile aplicabile;
- on-chain disclosure înainte de semnare: tranzacțiile nu pot fi șterse.

IPFS nu primește PII privat în clar. Pentru payload criptat, „crypto-erasure” reduce
accesibilitatea, dar CID/hash și copiile terților pot rămâne; policy-ul nu îl
descrie ca ștergere absolută.

### Impactul „every action on-chain”

- like, comment, follow, listing și alte acțiuni publice sunt permanent observabile
  prin tx/envelope, chiar dacă UI aplică ulterior un tombstone;
- Dating/chat/report folosesc generic `PRIVATE_ACTION`, salt și privacy relay, dar
  frecvența și timing-ul tranzacțiilor pot permite corelare statistică;
- același wallet și capability registration pot lega activitatea de cont;
  „Incognito” reduce descoperirea în produs, nu oferă anonimitate față de chain;
- conținutul editat/șters dispare din serviciile Nexus eligibile, însă vechiul
  hash/CID/transaction record nu poate fi șters;
- privacy notice și composer arată această consecință înainte de activarea ledger;
- reducer-ul păstrează tombstone și nu reafișează content purged, chiar dacă un
  terț poate păstra copii publice;
- nu se publică target predictibil sau PII hash-uit fără salt; un hash simplu nu
  anonimizează datele cu entropie mică.

## 6. Age assurance, Dating și AI

- MVP-ul adult este 18+; self-declaration este completată de verificare proporțională
  înainte de Dating, selling/hosting și limite financiare ridicate;
- age flow dezvăluie „peste prag”, nu data completă, când este posibil;
- metodele trebuie să fie proporționale și cât mai puțin intruzive, în linie cu
  [EDPB Statement 1/2025](https://www.edpb.europa.eu/documents/statement/statement-12025-on-age-assurance_en);
- locația Dating este aproximată; background location este opt-in și temporară;
- nu inferăm orientare, sănătate, etnie, religie sau emoții pentru ranking/ads;
- nu folosim un scor social cross-context care produce tratament nefavorabil;
- orice furnizor/model are inventory, intended use, evaluation, bias/quality,
  human oversight, incident log și transparency text.

[AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) interzice anumite forme de
social scoring și biometric categorisation sensibilă. Nexus folosește trust
contextual pentru un scop concret, nu clasificare generală a persoanei.

### 6A. Dating discret, verificare și selecție sigură

- accesul este blocat minorilor prin age gate rezonabil și step-up înainte de
  discovery; profilurile declarate 18+ neverificate au reach și funcții limitate;
- identitatea publică poate fi alias, însă platforma păstrează un cont sancționabil;
  „discret” nu este prezentat drept imposibil de identificat;
- identitatea de gen, persoanele dorite, orientarea și intenția sunt furnizate
  voluntar, criptate și folosite numai pentru mutual eligibility/compatibility;
- nu inferăm aceste atribute și nu le exportăm în ads, Pulse, Work, reputație sau
  modele generale; consimțământul explicit și retragerea lui sunt versionate;
- `Dating Trust Passport` afișează claims separate — Adult Verified, Photo Match,
  Recent Liveness, Video Ready, Meeting Reliability — nu un scor unic, popularitate
  sau rating al „valorii” persoanei;
- no-show sau incidentul nu afectează badge-ul înainte de notificare, dovezi minime,
  contestare și review uman; block/unmatch singure nu scad reputația;
- Meet Safe oferă video în aplicație, loc public, contact de încredere, check-in și
  SOS. SOS nu depinde de blockchain, relayer sau confirmarea unei tranzacții;
- money/crypto request warnings sunt obligatorii, iar tips către un match nou pot
  fi blocate până la un prag de încredere și vechime.

Dating nu permite escort, servicii sexuale, relații compensate/sugar dating,
trafic, exploatare sau conținut sexual neconsensual. Lansarea urmează politicile
[Google Play pentru UGC](https://support.google.com/googleplay/android-developer/answer/12923286),
[restricțiile de vârstă Dating](https://support.google.com/googleplay/android-developer/answer/16838200)
și [Apple App Review Guidelines 1.2](https://developer.apple.com/app-store/review/guidelines/).

### 6B. View Once și mesaje temporare

- media este E2EE, cheia per obiect se eliberează o singură dată și expiră; origin,
  CDN, cache și backup urmează purge policy verificabilă;
- View Once este disponibil numai după match mutual și request/consimțământ explicit;
  conținutul explicit este dezactivat la lansare;
- download, forward și backup sunt oprite; OS capture protection/detection și un
  watermark opțional descurajează capturile;
- UI spune clar că o cameră externă sau un dispozitiv compromis nu poate fi oprit;
  Nexus nu promite „imposibil de salvat” ori ștergere retroactivă a copiilor;
- raportarea poate păstra o copie de probă numai prin acțiune explicită a persoanei
  și într-un evidence vault cu acces purpose-bound;
- detectorii pentru nuditate/NCII/sextortion pot bloca transmiterea, dar orice
  sancțiune serioasă are review și apel.

### 6C. Pulse pseudonim, nu chat anonim aleatoriu

- utilizatorul poate publica printr-un alias persistent fără legătură publică spre
  nume, profilurile sale ori wallet; Alias Vault păstrează mapping-ul separat;
- accesul la mapping cere scop, rol, audit și procedură `break-glass`; divulgarea
  urmează numai obligația legală validă și government-request policy;
- nu există Chatroulette/random anonymous chat, deoarece crește masiv riscul de
  abuz și riscul de respingere în app stores;
- DM pseudonim cere accept mutual; reply/quote/mention au audience controls;
- anti-doxxing, impersonation, threat, NCII, scam și coordinated harassment sunt
  controale P0/P1; block-ul operează la nivel de cont, nu doar alias;
- trendurile separă human, agent, paid și synthetic traffic; agenții sunt etichetați
  și nu votează Community Context.

Apple a clarificat în februarie 2026 că random/anonymous chat intră sub regula UGC
1.2: [clarificarea Apple](https://developer.apple.com/news/?id=d75yllv4). Pulse oferă
pseudonimitate responsabilă, nu anonimat fără răspundere.

## 7. Digital Services Act și moderare

Nexus combină social network, content sharing, marketplace și travel platform și
intră în sfera serviciilor intermediare/online platform, în funcție de rolul juridic.

Baseline operațional:

- punct unic de contact și termeni clari;
- notice-and-action ușor de folosit;
- statement of reasons pentru restricții și mecanism intern de complaint/appeal;
- transparency reporting și păstrarea deciziilor necesare;
- interzicerea dark patterns și transparență pentru ads/recommenders;
- trader traceability pentru marketplace/travel/mobility și reasonable checks;
- Nexus Kids aplică protecțiile pentru minori în tenantul separat;
- evaluarea obligațiilor suplimentare dacă serviciul devine VLOP.

Regulamentul [DSA (UE) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
include explicit social networks, marketplaces și collaborative/travel platforms.
Smart contracts nu elimină responsabilitatea operatorului interfeței.

## 8. Marketplace generalist, consumatori și Travel

- seller/host declară și este verificat ca `TRADER` sau `NON_TRADER`;
- înainte de contract, UI arată identitatea părții, rolul Nexus, totalul,
  caracteristicile, anularea/refund, dispute și jurisdicția relevantă;
- pentru non-trader se explică faptul că anumite drepturi UE ale consumatorului nu
  se aplică; pentru trader se implementează informațiile/drepturile aplicabile;
- ranking parameters și paid placement sunt explicate;
- reviews sunt legate de acțiuni eligibile și marcate dacă nu sunt verificate;
- prohibited/recalled goods și host registration/licensing au workflows;
- taxonomy permite bunuri, vehicule, imobiliare și servicii, dar policy-ul blochează
  bunuri furate, droguri, arme și muniții, exploatare, documente/conturi, malware,
  contrafaceri și orice categorie ilegală; bunurile reglementate sunt activate
  numai cu verificări și reguli locale explicite;
- `CLASSIFIED_ONLY` nu implică protecție escrow; această diferență este afișată
  înainte ca utilizatorul să contacteze sau să plătească;
- reguli locale pentru short-term rental, taxe turistice și registration sunt
  feature flags pe jurisdicție; Travel nu se deschide global implicit.

Referință: [Directiva (UE) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
impune informații marketplace privind ranking-ul și statutul trader/non-trader.

## 9. DAC7 și fiscalitate de platformă

DAC7 poate acoperi închirierea imobilelor, servicii personale și vânzarea de bunuri.
Nexus trebuie să colecteze/due-diligence datele seller/host, consideration și fees,
să determine jurisdicția de raportare și să producă raport anual unde se aplică.

Design:

- tax identity vault separat și acces limitat;
- ledger nu pierde totalurile per seller, token/fiat valuation și fees;
- correction workflow, evidence și deadlines;
- retenție conform implementării naționale;
- specialist fiscal validează pragurile/excluderile și conversia crypto.

Sursă: [Comisia Europeană — DAC7](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/dac7_en).

## 9A. ePrivacy, product safety și platform-to-business

- cookies, advertising identifiers, push/email marketing și accesul la storage-ul
  dispozitivului se mapează și față de [Directiva ePrivacy 2002/58/CE](https://eur-lex.europa.eu/eli/dir/2002/58/oj)
  și implementarea națională, nu numai GDPR;
- SDK-urile non-esențiale sunt dezactivate înainte de consimțământ unde acesta este
  cerut, iar retragerea propagă configurația;
- pentru bunuri de consum, [GPSR (UE) 2023/988](https://eur-lex.europa.eu/eli/reg/2023/988/oj)
  cere analiză de marketplace, puncte de contact, Safety Gate workflow, informații
  de trasabilitate/siguranță și recall/takedown;
- Nexus păstrează `product_compliance`, manufacturer/responsible-person data,
  notices/orders și reapariția produselor retrase;
- relația cu sellers/hosts business și ranking/terms necesită și o analiză a
  [Regulamentului P2B (UE) 2019/1150](https://eur-lex.europa.eu/eli/reg/2019/1150/oj).

## 10. Crypto, plăți și custody

- Nexus rămâne non-custodial: utilizatorul semnează, contractul escrow ține fondurile
  după reguli, iar operatorul nu deține seed phrases;
- acceptarea/payout/exchange de crypto poate declanșa cerințe MiCA/CASP, AML și
  sancțiuni în funcție de serviciul exact și controlul operatorului;
- integrarea fiat, card, conversion și custodial payout se face prin furnizori
  licențiați, cu contractual allocation și KYC;
- address/sanctions screening, transaction monitoring și geofencing sunt calibrate
  după opinia formală; nu sunt inventate ca „compliance theater”;
- tokenul Nexus este amânat; analiza MiCA precede orice ofertă/listare.

Referință: [MiCA (UE) 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj).

Dacă un CASP intervine în transfer, datele originator/beneficiary și controalele
din [Regulamentul (UE) 2023/1113](https://eur-lex.europa.eu/eli/reg/2023/1113/oj)
pot deveni relevante. Interacțiunea stablecoin/e-money token cu PSD2 este validată
cu furnizorul licențiat și prin memo juridic înainte de activare.

## 11. Video, live și copyright

Fiind video-first, Nexus poate intra și în cadrul național care implementează
[Directiva serviciilor mass-media audiovizuale 2018/1808](https://eur-lex.europa.eu/eli/dir/2018/1808/oj)
pentru video-sharing platforms.

Sunt necesare:

- upload terms și licență limitată, fără transfer excesiv de drepturi;
- sound rights catalog, provenance și teritorii/expirare;
- notice/takedown/counter-notice și repeat infringer policy;
- fingerprinting numai cu bază contractuală și evaluare privacy;
- live delay, emergency termination și moderator tooling;
- protecții pentru conținut nociv/ilegal, ură și violență;
- ads/influencer disclosure și arhivarea dovezilor comerciale unde se aplică.

### Recommenders, Clips, Watch și Live

- fiecare recommender documentează parametrii principali și oferă utilizatorului
  opțiuni reale de influențare/reset, inclusiv Following/Subscriptions/Editorial;
- Dating, Kids, health, chat, incident și alte categorii sensibile sunt excluse din
  ads și din modelele generale; paid placement este marcat separat;
- candidate generation aplică age/country/rights/block/moderation înainte de scor;
- model cards, offline evaluation, controlled rollout și rollback sunt obligatorii;
- live are creator eligibility, precheck, delay configurabil, real-time escalation,
  emergency terminate, regional block și replay moderation;
- synthetic/deepfake și paid promotion sunt declarate; impersonarea frauduloasă,
  NCII, dangerous challenges și exploatarea sunt blocate;
- public live chat necesită report/block, moderators și slow/verified-only modes;
- providerul managed Live este procesator auditat, cu data region, retention,
  subprocessor, breach și exit/export clauses.

DSA cere transparență privind parametrii principali ai recommenderelor și opțiunile
de influențare; targetarea reclamelor cu date speciale este interzisă în condițiile
regulamentului: [Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj).

### Nexus Kids

Nexus Kids este produs și tenant separat. Best interests, privacy maximă implicită,
minimizarea și age-appropriate design au prioritate față de engagement și regula
adultă every-action-chain.

- parental authority/consent este verificabilă, versionată, revocabilă și separată
  de simplul parental gate al magazinului;
- se păstrează age band când data completă nu este necesară;
- fără wallet child, ad identifier, precise location, contact sync, face/voice
  profiling, behavioral ads sau cross-product feature sharing;
- fără Dating, Pulse, Market, DM, comments libere, open chat ori public child upload;
- conținutul este `country × age_band × rights × rating × editorial` allowlisted;
- live este numai creator/instituție verificată, cu delay, moderator și fără chat
  liber; copilul nu poate transmite public;
- third-party SDK inventory este separat și acceptă numai servicii eligibile pentru
  child-directed use; analytics minim sau first-party;
- history/search/favorite/feedback rămân criptate, ștergibile off-chain și nu produc
  tx individual; numai adult consent credential generic și creator rights/payout
  pot fi ancorate fără child identifier;
- parent și child au notices potrivite vârstei, export/delete, time controls,
  autoplay off, safe search și report routes.

În SUA, COPPA actualizat impune limite suplimentare asupra colectării, retenției și
divulgării către terți, inclusiv consimțământ separat pentru anumite utilizări de
publicitate: [FTC COPPA amendments](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data).
În UE, baseline-ul include [DSA Guidelines for protection of minors](https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines),
iar pentru UK se aplică analiza [ICO Children’s Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code).
Distribuția respectă [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335)
și [Apple Kids guidance](https://developer.apple.com/kids/).

### Music rights gate

Music se lansează întâi numai cu artiști independenți, licențe directe sau catalog
furnizat contractual. Fiecare asset are matrice `right × territory × tier × time`;
master, compoziție/publishing, drepturi conexe, artwork, lyrics, video și offline
sunt autorizări distincte. Upload declaration nu este singura dovadă.

- release blocat la claims conflictuale sau teritoriu neacoperit;
- fingerprinting, notice/takedown, counter-notice și repeat-infringer policy;
- statement și reporting auditabil către rightsholders;
- royalty freeze limitat, fără reținerea fondurilor necontestate;
- full catalog rămâne dezactivat până la acorduri multi-teritoriale;
- directiva DSM și regulile de gestiune colectivă sunt analizate per serviciu.

Surse: [Directiva DSM 2019/790](https://eur-lex.europa.eu/eli/dir/2019/790/oj) și
[Directiva 2014/26/UE](https://eur-lex.europa.eu/eli/dir/2014/26).

### Promotion și review-uri

- fiecare reclamă este marcată și arată beneficiarul/plătitorul și explicația
  parametrilor principali;
- targetarea nu folosește date speciale GDPR, Dating, chat, incidents sau Grow;
- organic și paid sunt separate, iar influența remunerației asupra ranking-ului
  este explicată business-urilor;
- review eligibility, metodologia și verified/unverified sunt afișate;
- review-uri false, cumpărate sau selecția numai a celor pozitive sunt interzise;
- business-ul are răspuns, contestare și apel, nu drept de ștergere arbitrară.

Surse: [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj),
[P2B](https://eur-lex.europa.eu/eli/reg/2019/1150/oj/eng) și
[Directiva Omnibus 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj).

### Grow, health și educație

Grow MVP are intended purpose de education/wellbeing W0/W1. Nu face diagnostic,
tratament, predicție de boală ori recomandare clinică. Funcțiile W2 sunt activate
numai cu profesionist eligibil și termeni locali; W3 este produs separat și blocat
de clasificare/certificare.

- health/wellness data în schemă și chei separate, fără IPFS/plaintext on-chain;
- DPIA, consimțământ granular pentru device integrations și revoke/delete;
- zero health targeting și zero transfer spre Dating, Work sau trust score;
- claims nutriționale/editoriale cu surse, author/reviewer și correction log;
- credentialele și acreditarea sunt verificate per țară;
- certificatele sunt „completion” dacă nu există acreditare confirmată.

Surse: [MDR 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng) și
[Regulamentul privind claims 1924/2006](https://eur-lex.europa.eu/eli/reg/2006/1924/oj).

## 11A. Mobility, transport alternativ și platform work

Mobility este activat public numai pe orașe/jurisdicții allowlisted. Pentru pilotul
din România, [OUG 49/2019](https://legislatie.just.ro/Public/DetaliiDocument/215598)
impune cerințe specifice operatorului platformei și transportului alternativ,
inclusiv evidența expirării documentelor, afișarea tarifului înainte de acceptare,
numărul de înmatriculare, monitorizarea curselor prin localizare, comunicarea cu
șoferul, raportarea incidentelor și o interfață de incidente disponibilă 24/7.

Gate-uri înainte de primul rider public:

- avizul tehnic aplicabil platformei și structura juridică necesară;
- afilierea numai cu operatori autorizați;
- verificarea autorizației, copiei conforme și ecusoanelor vehiculului;
- permis, atestat, inspecție, asigurare și documente cu expiry automation;
- tarif/route/vehicle/driver disclosure înainte de acceptare;
- suport și escaladare incidente 24/7, SOS și cooperare cu autoritățile;
- accessibility flow pentru mobilitate redusă;
- insurance allocation, accident process și evidențe financiar-fiscale;
- reguli de numerar dezactivate în MVP; numai plăți electronice/crypto aprobate,
  după analiza legală a instrumentului și settlement-ului.

[ARR](https://www.arr.ro/arr_doc_736_intrebari-si-raspunsuri-transport-alternativ_pg_0.htm)
descrie documentele operatorilor, copiile conforme și ecusoanele; aplicația nu
permite unui șofer să intre online când un document obligatoriu este expirat.

[Directiva privind munca pe platforme (UE) 2024/2831](https://eur-lex.europa.eu/eli/dir/2024/2831/oj)
se transpune până la 2 decembrie 2026 și vizează statutul corect al persoanelor,
transparența, supravegherea umană și protecția datelor în managementul algoritmic.
Nexus păstrează motivele dispatch/deactivation, oferă contestare umană, nu folosește
date private irelevante pentru alocarea curselor și nu presupune că eticheta
„independent contractor” determină singură statutul juridic.

### Privacy și safety pentru locație

- pickup/dropoff exact, traseul și live location sunt `RESTRICTED_LOCATION`;
- riderul vede poziția driverului numai după acceptare; driverul primește pickup-ul
  necesar și destinația conform politicii afișate;
- tracking-ul pornește numai online/în cursă și se oprește verificabil la final;
- locația live are TTL scurt; traseul păstrat pentru receipt/fraud/incident este
  criptat și separat de analytics;
- share-trip folosește token revocabil și expiră automat;
- personalul accesează traseul numai pentru un caz și un purpose auditat;
- SOS nu depinde exclusiv de blockchain, E2EE sau disponibilitatea wallet-ului;
- dispatch-ul nu penalizează automat șoferul pentru refuz fără reguli transparente
  și human review pentru efecte semnificative.

## 11B. Agenți AI, boți și automatizare

Toate conturile automatizate sunt `AgentProfile` cu controller, badge AI, manifest,
scopes și revocation. EU AI Act transparency este baseline global; utilizatorul
este informat că interacționează cu AI și poate cere human escalation.

Permis: test bots izolați, concierge Nexus, agenți delegați ai business-urilor,
external A2A agents și growth inbound/opt-in. Interzis: profil uman fals, Dating,
fake reviews/testimonials, engagement rings, ad/referral fraud, scraping, spam,
impersonation și covert influence.

Controale:

- `actor_kind` obligatoriu și metrics/warehouse separate;
- Agent Card semnat; secrets dinamice nu intră în manifest;
- A2A/MCP gateway cu OAuth/mTLS, SSRF/egress isolation și protocol versioning;
- prompt/tool injection scanning, structured arguments și output validation;
- capability per data class/tool/country/value, TTL, max actions și spend;
- human approval pentru bani, booking, publishing sensibil și efect juridic;
- zero payout/owner/recovery authority pentru agent;
- agent task artifacts/evidence, receipts și dispute;
- invalid traffic eliminat din billing, rewards și advertiser reporting;
- kill switch per agent/controller/protocol/model și incident forensics;
- test bots numai non-production ori canary allowlist fără efect comercial.

Referințe: [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj),
[FTC Fake Reviews Rule](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials),
[TikTok integrity policy](https://www.tiktok.com/community-guidelines/en/integrity-authenticity/)
și [Meta Terms](https://www.facebook.com/legal/terms).

## 11C. Operare worldwide

Conformitatea este `country × feature`, nu o afirmație globală unică. Global Core
poate fi disponibil larg; payments/payouts/Market/Travel/Services/Music/Mobility
folosesc Country Capability Matrix, legal entity, provider, tax, sanctions,
consumer, professional-license și local safety gates.

- locale și țara juridică sunt câmpuri distincte;
- Terms/Privacy/consumer disclosures au versiune și jurisdicție;
- fiecare regiune are data map, transfers, subprocessor și government-request flow;
- blockchain-ul public nu este prezentat ca având data residency;
- moderarea și emergency escalation trebuie să acopere limbile lansate;
- funcția se oprește local dacă licența/providerul/policy expiră;
- geo/VPN nu este singurul control; service, seller, payment și residence pot conta;
- lansarea mondială se face prin country packs, feature flags și rollout gradual.

## 11D. Rețea federată și noduri independente

Descentralizarea infrastructurii extinde suprafața de atac și numărul de dispozitive
care pot transporta date. Threat model-ul include Sybil, eclipse, route poisoning,
noduri coluzive, rezultate false, receipt fraud, versiuni incompatibile, cache-uri
care ignoră takedown-ul și inferențe din metadate.

Controale obligatorii:

- fiecare event, manifest, job și receipt este semnat și replay-protected;
- placement-ul folosește node owner cluster, ASN/provider, regiune și jurisdicție ca domenii
  de eșec; replicile nu se aleg numai după latență ori stake;
- peer scoring, rate limits, bootstrap multiplu și comparație DHT protejează contra
  eclipse/Sybil; checkpoint-urile ancorate periodic detectează fork-ul de read model;
- fiecare release de nod trece conformance tests, protocol-version gates, SBOM și build-uri
  reproductibile; upgrade-ul are fereastră de compatibilitate și rollback;
- storage/transcode/live rewards cer receipt și sampling/challenge; calitatea ambiguă
  produce suspendarea plății ori reputației, nu slashing automat;
- IPFS public este numai opt-in pentru conținut intenționat permanent; private,
  ephemeral, Dating, Kids, KYC, locație și evidence nu intră în public DHT;
- mesh-ul poate transporta public sau ciphertext; plaintext-ul Dating/chat/location,
  child activity, KYC și safety evidence rămâne on-device/vault și nu se rutează;
- emergency Live stop, block, revoke și legal hold au control plane operabil chiar
  dacă blockchain-ul ori o parte din federație este indisponibilă.

Federația nu elimină rolul juridic al Nexus pentru aplicațiile și serviciile pe care
le controlează. Un proprietar independent de nod nu devine automat processor Nexus;
rolul se analizează după datele și controlul real. DSA, copyright, protecția copiilor
și ordinele legale rămân aplicabile suprafețelor administrate de Nexus. Nodurile
neconforme pot păstra copii publice, dar clienții Nexus le pot delista și refuza.

## 12. Moderation policy și SLA

| Nivel | Exemplu | Țintă pilot |
|---|---|---:|
| P0 | pericol imediat, exploatare, fonduri în risc activ | triage < 15 min în acoperire |
| P1 | amenințare, doxxing, fraudă activă, bun ilegal | < 1 h |
| P2 | harassment, impersonation, scam suspect | < 24 h |
| P3 | spam, copyright standard, calitate/listing | < 72 h |

Automatizarea poate bloca temporar cazuri cu risc mare, dar măsurile serioase au
review uman și apel. Moderatorul vede minimul, iar accesul la Dating/evidence este
role- și purpose-bound. Creator/seller/host primesc regula, faptele principale,
durata și calea de contestare.

## 13. Retention baseline — de validat local

| Categorie | Baseline de produs |
|---|---:|
| Sesiuni și security logs | 90–180 zile |
| OAuth tokens | numai cât sunt necesare; revocare/purge la unlink/delete |
| Agent task inputs/artifacts | pe contract/data class; private implicit scurt |
| Synthetic test data | cleanup după run; fără export în production analytics |
| Raw feed events | 30–90 zile, apoi agregare |
| Adult Watch history | configurabil; raw 30–90 zile, apoi agregare sau purge/reset |
| Live chat/recording | conform audience/policy; replay chat separat, incident legal hold limitat |
| Kids history/feedback | local implicit sau TTL scurt criptat; purge la parent reset/delete |
| Parental consent/authority | cât child profile este activ + auditul legal minim justificat |
| Kids catalog decisions | pe durata publicării + policy/audit window, fără child behavior |
| Swipe respins/expirat | minimul necesar, de regulă 30–90 zile |
| Preferințe/atribute Dating | cât profilul este activ; purge la dezactivare, exceptând legal hold |
| Verification claims | până la expirare/revocare + audit minim; raw evidence cât mai scurt |
| Meet plan/location | TTL de ore/zile; incident evidence numai dacă este raportat |
| View Once ciphertext/keys | până la deschidere/expirare + scurtă fereastră tehnică documentată |
| Pulse alias mapping | cât aliasul/contul este activ + enforcement/legal retention justificat |
| Pulse post temporar | până la expirare + purge/cache window; tx commitment rămâne public |
| Chat ciphertext | până la delete/room policy; backup separat |
| Stories | 24h public + scurtă fereastră tehnică/moderare |
| Report/evidence | pe severitate și obligații; acces foarte limitat |
| Orders/bookings/rides/ledger/tax | conform fiscal/contractual național |
| Live trip location | TTL de minute/ore; fără istoric general |
| Incident route/evidence | numai cât cere cazul/obligația, criptat |
| Music playback raw/anti-fraud | 30–180 zile conform contractelor, apoi agregat |
| Rights/royalty/takedown records | termen contractual/fiscal/legal hold |
| Grow health/sensor raw | minim necesar, TTL scurt și ștergere controlată |
| Course/credential records | pe durata contractului și obligațiilor emitentului |
| KYC/liveness raw | nu se păstrează dacă un claim este suficient |
| Media ștearsă | purge rapid origin/CDN; backup expiry documentat |
| Node manifests/checkpoints/settlement receipts | TTL de protocol; pentru rewards, perioada financiară și anti-fraudă justificată |
| Service job payload | nu se păstrează implicit; commitment/receipt conform clasei și dispute window |
| Cache public federat | TTL + tombstone/purge propagation; conținutul IPFS permanent nu are promisiune de ștergere globală |

Duratele finale sunt introduse în retention registry cu owner, temei, start event,
exceptions/legal hold și purge verification.

## 14. Lansare: checklist de conformitate

- entitate/operator și piețe țintă stabilite;
- EUIPO/WIPO trademark clearance pentru nume;
- Terms, Community, Dating Safety, Marketplace/Travel/Mobility/Services terms, Privacy/Cookies;
- RoPA, DPIA, DPA/SCC/TIA și vendor register;
- DSA notice/action, reasons, appeals și transparency data;
- trader traceability, consumer disclosures și prohibited goods;
- DAC7 data/report pipeline și politici fiscale;
- MiCA/CASP/AML perimeter memo pentru fluxurile exacte;
- AVMS/video/copyright și live incident controls;
- Clips/Watch recommender transparency, non-profiled mode, model cards și rights gates;
- Live eligibility, delay, terminate, chat moderation, replay și provider failover tests;
- Nexus Kids binary/tenant/SDK isolation, child DPIA/risk assessment și Country Packs;
- parental consent/authority, revoke/export/delete, safe catalog și zero behavioral ads;
- Music rights matrix, rightsholder contracts, royalty reporting și takedown;
- Promotion/ad transparency, P2B ranking și review authenticity controls;
- Grow DPIA, intended-purpose boundary, professional credentials și claims review;
- insurance/risk reserve și dispute authority;
- app-store UGC/dating/payment/privacy review;
- Dating DPIA, sexual-orientation purpose tests, 18+ gate și Trust Passport appeals;
- View Once threat model, capture disclosure, NCII/sextortion runbook și purge test;
- Pulse Alias Vault, anti-doxxing, trend integrity și eliminarea random anonymous chat;
- Google/Apple/Facebook/TikTok app approval, OAuth scopes și deletion callbacks;
- embedded-wallet cryptographic audit, recovery/export și custody classification;
- country capability packs, local terms/entity/providers și language operations;
- Agent AI disclosure, A2A/MCP security, no-fake-engagement și invalid-traffic audit;
- Nexus Node Network threat model, permissionless join, conformance suite, Sybil/eclipse,
  state-sync/checkpoint, receipt-fraud, takedown propagation și protocol-upgrade tests;
- transport-platform authorization, driver/vehicle/insurance și 24/7 incident desk;
- audit contracte, pen-test, incident/breach tabletop și on-call.
- Nexus Assurance & Control separat de Delivery, Control Registry, Evidence Pack,
  findings/CAPA, maker-checker și Internal Audit third-line;

## 15. NIS2 și incident response

Online marketplaces și social networking service platforms pot intra în NIS2 în
funcție de entitate, dimensiune, stabilire și transpunerea națională. Baseline-ul
Nexus adoptă oricum risk management, supply-chain security, business continuity,
vulnerability handling, cryptography, access control și incident reporting.

Runbook-ul poate produce early warning în 24h, notificare în 72h și raport final
într-o lună când încadrarea și incidentul cer acest lucru, conform
[Directivei NIS2 (UE) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj).
Termenele exacte și autoritatea se validează în legea țării de stabilire.
