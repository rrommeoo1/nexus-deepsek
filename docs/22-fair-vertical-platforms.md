# Nexus Fair Vertical Platforms — produs, economie și ordine de lansare

## 1. Decizia de produs

Nexus nu construiește zece clone lipite într-o aplicație. Construiește un singur
`Trust & Transaction Kernel`, folosit de interfețe specializate:

`Discover → Offer → Quote → Authorization → Escrow/Funding → Fulfillment → Settlement → Review/Dispute`

Kernelul comun conține wallet/username, profile izolate, policy per țară,
verificări contextuale, reputație contextuală, plăți, escrow, dispute, reviews
verificate, anti-fraudă, mesagerie și promovare. Fiecare verticală își păstrează
meniul, datele private, regulile, rankingul și experiența proprie.

Principiul „fair” nu înseamnă promisiunea imposibilă „zero cost”. Cardurile,
chargeback-urile, taxele de rețea, hărțile, KYC, asigurarea, licențele muzicale,
storage-ul și suportul au cost. Nexus separă obligatoriu în quote:

1. suma furnizorului/creatorului;
2. costul extern pas-through;
3. taxa Nexus, plafonată și afișată înainte de confirmare;
4. taxe și rezervă/risk hold, unde legea sau riscul le cer.

Nu există comision ascuns, pay-to-win mascat, taxă dedusă după confirmare sau
review cumpărat. Taxele de mai jos sunt ținte de design, nu tarife contractuale.

## 2. Nucleul comun anti-scam

- `Trust Passport` contextual: verificarea Work nu expune Dating, iar verificarea
  Dating nu devine scor profesional. Nu există un scor social universal.
- review numai după o tranzacție/întâlnire eligibilă; un review per participant și
  per tranzacție; dublu-orb pentru Stay, Ride, Beauty și Work interviews;
- review-ul nu se șterge arbitrar, dar poate fi ascuns legal, contestat și păstrat
  într-un audit trail cu motiv, versiune și drept de apel;
- escrow și release condiționat de dovezi de fulfillment;
- graph/device/payment risk fără publicarea identității ori relațiilor on-chain;
- duplicate listings, preț nerealist, conturi coordonate, chargeback și refund abuse
  detectate separat de rankingul organic;
- promovarea plătită este etichetată și nu cumpără reputație, review-uri sau
  eligibilitate;
- acțiunile critice au receipt/hash on-chain; media, locația precisă, KYC, sănătatea,
  mesajele și grafurile private rămân criptate off-chain.

## 3. Work — LinkedIn + Pracuj.pl, dar verificabil și util

### Experiență

- feed profesional cu postări, Clips educaționale, proiecte și evenimente;
- profil CV, portofoliu, competențe și disponibilitate, separat de Social;
- pagini business, organigramă publică opțională și administrator verificat;
- job search cu salariu/range, remote/hybrid, limbă, viză și accesibilitate;
- aplicare rapidă, CV diferit per job, pipeline candidat, interviu video și meeting;
- ATS pentru companie, scorecards structurate, scheduling și ofertă semnată;
- credentials/recomandări verificabile, fără a publica date personale pe chain;
- anti-ghost-job: expirare, confirmare periodică, timp mediu de răspuns și status
  real al procesului;
- candidate privacy: compania nu vede Social/Dating fără grant explicit.

### Economie țintă

Candidatul este gratuit. Compania plătește listare, abonament ATS sau success fee
plafonat; boost-ul este etichetat. Nexus nu vinde acces la date private și nu taxează
aplicarea candidatului.

## 4. Market — OLX discovery + Allegro protected checkout

- anunț local/global, foto/video, variante, stoc, ofertă, chat și pickup;
- Free Classified pentru contact direct, cu avertizare că nu are protecție de plată;
- Protected Checkout cu quote, escrow, shipping, tracking, confirmare și dispute;
- business sellers, catalog, factură, retur și garanție conform țării;
- verificare categorie/brand/serial opțională, duplicate și counterfeit detection;
- review numai după comandă finalizată; seller și buyer au reputații separate;
- produse interzise și restricționate controlate prin CountryPolicy;
- taxă Nexus țintă 2–4% pentru checkout protejat, exclusiv costuri externe; publicarea
  de bază poate rămâne gratuită în limite anti-spam.

## 5. Stay & Experiences — Airbnb complet, cu mai puțină ambiguitate

- proprietate, camere, facilități, reguli, calendar, iCal, preț total și hărți;
- host/property proof, co-host, experiențe, disponibilitate și instant/request book;
- quote care îngheață prețul, taxele, politica de anulare și depozitul;
- escrow: authorize/fund, check-in evidence, release, refund, dispute și payout;
- check-in PIN/QR, damage evidence criptată și acces temporar la informații;
- review dublu-orb, numai după stay/experience, cu apel și fraud clustering;
- anti-scam: adresă precisă după booking, payout delay pentru host nou, duplicate
  property detection, verificare ownership/management și suport incident;
- taxă totală Nexus țintă 6–10%, afișată integral înainte de rezervare; taxe locale,
  procesator și asigurare apar separat.

## 6. Ride — mai sigur și mai transparent decât modelul clasic

- rider/driver, ofertă cursă, ETA, pickup pin, route preview și live trip;
- verificare permis, vehicul, asigurare și cerințe locale înainte de activare;
- trip PIN, share-trip, SOS, deviation detection și privacy-preserving location;
- preț total înainte de acceptare, surge plafonat și explicat, fără manipulare dark;
- șoferul vede brut, costuri externe, taxă Nexus și net înainte de acceptare;
- plată/escrow, tip, lost item, refund, incident și review dublu-orb;
- matching bazat pe ETA, accesibilitate, siguranță și echitate, nu pe acceptare forțată;
- țintă take-rate Nexus 8–12% din fare net, dacă jurisdicția și costurile permit;
  asigurarea, taxele și procesarea rămân linii separate.

Ride este o verticală târzie: licențierea operatorului, statutul șoferilor,
asigurarea și răspunsul la incidente sunt gates per țară, nu simple funcții software.

## 7. Beauty — Booksy cu proprietatea relației client–business

- pagină salon/freelancer, servicii, durată, preț, staff, locație și portofoliu;
- calendar, sloturi, resurse, recurring availability, waitlist și rebooking;
- avans/no-show clar, anulare, reminder, pachete și gift cards;
- checkout, tip, factură și review după programare;
- consult/formular sensibil separat și criptat; fără inferențe de sănătate în ads;
- business poate alege 3–6% per booking sau SaaS fix; clientul nu plătește o taxă
  ascunsă pentru simpla programare.

## 8. Music — streaming legal și creator-first

- artist profile, releases, singles/albums, Clips cu audio licențiat, playlists,
  radio/recommendations, lyrics unde există drepturi, live și ticketing;
- upload direct pentru artiști independenți, splits între colaboratori și dashboard;
- subscription, ad-supported unde este permis, direct support, tips și merch;
- offline playback numai cu chei/licență expirabilă; takedown revocă playback/key;
- rights matrix per track/territory/use, fingerprinting și dispute de ownership;
- royalty ledger transparent, dar fără a publica listening history sau contracte;
- nu promitem catalog „ca Spotify” înainte de licențele label/publisher/CMO. Catalogul
  începe cu artiști independenți și conținut licențiat direct.

Pentru direct support, Nexus țintește 5–10% după costul procesatorului. Economia
streamingului on-demand este determinată de licențe și se lansează separat pe țări.

## 9. Wellbeing — MultiSport + pay-per-workout + nutriție educațională

- săli, studiouri, terenuri și antrenori Near Me, cu facilități și ore reale;
- acces unic `Pay per Workout` prin QR/PIN cu expiry și receipt de check-in;
- gym-ul poate vinde un antrenament, clasă, zi, pachet sau abonament; abonamentul
  nu este obligatoriu;
- booking de personal trainer, live/video session și plan de exerciții;
- catalog alimente/rețete cu ingrediente, alergeni, valori și sursa informației;
- obiective, jurnal și wearable import numai cu consimțământ granular;
- datele de sănătate sunt izolate, criptate și excluse din ads/reputație;
- conținutul este educațional; diagnostic, tratament și claims medicale cer control
  clinic/regulator separat;
- taxă Nexus țintă 5–8% per acces/sesiune ori SaaS pentru business.

## 10. Nexus Pay — username, wallet și top-up local

### Flux

`@username → alias semnat/versionat → preview beneficiar/rețea/token/sumă/fee →
confirmare biometrică/wallet → transfer → receipt → reconciliere`

- wallet non-custodial generat automat, cu export/recovery și social login numai ca
  bootstrap/recovery policy, niciodată custodie unilaterală Nexus;
- plăți username-to-username în EGLD/ESDT/stablecoin și request/split payments;
- top-up în moneda locală prin adaptoare autorizate per țară;
- stablecoin implicit doar după due diligence pentru issuer, reserve, redemption,
  chain liquidity, MiCA/CASP, sanctions și tax reporting;
- limite, cooling-off, fraud/risk, refund și dispute separate pe rail;
- Nexus fee țintă 0 pentru transfer intern fair-use cu gas sponsorship plafonat;
  top-up/withdrawal afișează costul providerului plus o taxă Nexus mică și plafonată.

### Provider strategy

1. `xMoneyCryptoAdapter` este rail-ul preferat pentru comenzi crypto, refunds și
   webhook reconciliation pe ecosistemul MultiversX. Documentația oficială descrie
   orders/refunds/webhooks și separarea sandbox/production:
   <https://docs.xmoney.com/crypto_api/introduction> și
   <https://docs.xmoney.com/guides/crypto/get-started>.
2. `xMoneyFiatAdapter`/checkout este evaluat pentru card și wallet payments; xMoney
   documentează embedded checkout, cards, Apple Pay și Google Pay:
   <https://docs.xmoney.com/guides/general/get-started>.
3. `RevolutMerchantAdapter` este o opțiune pentru cards/pay-by-bank, preauthorization,
   disputes, payouts și webhooks, dacă entitatea Nexus și țara sunt eligibile:
   <https://developer.revolut.com/docs/api/merchant>.
4. `StripeAdapter` rămâne opțional pentru fiat și piețe eligibile. Stablecoin payments
   nu este baza lansării UE: documentația Stripe indică în prezent acceptarea de către
   business-uri SUA și settlement în USD; stablecoin Connect payouts este încă private
   preview: <https://docs.stripe.com/payments/stablecoin-payments?locale=en-GB> și
   <https://docs.stripe.com/crypto/stablecoin-payouts>.

Niciun adaptor nu devine activ doar pentru că API-ul există. Sunt necesare contract,
eligibility, KYB, CountryPolicy, cost approval, security review și testare sandbox.
Dacă Nexus ține bani/chei pentru utilizator sau emite/redeem-uiește stablecoin,
perimetrul de licențiere se schimbă material. Cadrul UE MiCA și cerințele AML trebuie
validate per entitate și țară: <https://finance.ec.europa.eu/digital-finance/crypto-assets_en>.

## 11. Flywheel economic fără spam sau schemă piramidală

- creatorul/business-ul aduce publicul prin link/QR/referral atribuit;
- reward există numai după o activare umană calificată și o tranzacție finală;
- reward-ul vine exclusiv din taxa netă Nexus ori bugetul de marketing;
- fără reward pentru followers, likes, SYSTEM_TEST, bots, paid traffic necalificat,
  auto-referral sau niveluri recursive;
- referral-ul nu reduce suma creatorului, furnizorului, taxele ori rezerva;
- creatorul poate câștiga cross-module: Music → ticket/merch, Fitness → session,
  Work → course/event, Beauty → booking, Stay → experience, Privé → paid content;
- rankingul organic nu cumpără trafic: paid boost are inventar și etichetă separate.

## 12. Ordine realistă de lansare

1. Work, Market classifieds, Beauty și Wellbeing pay-per-session: valoare mare,
   operațiuni controlabile și complexitate regulatorie mai mică.
2. Protected Market, Stay și Nexus Pay sandbox/pilot pe o țară.
3. Ride numai cu licențe, insurance/incident operations și supply local.
4. Music on-demand după rights catalog; începe cu direct-upload/licențe directe.
5. Privé numai pe web separat, country-enabled, după age assurance, consent,
   payments, content safety și legal review independente.

## 13. Criteriul „mai bun decât liderul”

Nu măsurăm succesul prin numărul de funcții copiate. Fiecare verticală trebuie să
demonstreze simultan:

- un flow principal mai scurt ori mai clar;
- fee total și net furnizor vizibile înainte de acceptare;
- rate măsurabile mai mici de scam/dispute ori rezolvare mai rapidă;
- portabilitatea profilului, reputației și wallet-ului fără amestecarea privacy;
- dovadă de fulfillment/review imposibil de cumpărat;
- continuitate la `N=1` și scalare către rețeaua distribuită;
- fallback sigur când blockchainul, providerul sau indexerul întârzie;
- accesibilitate, localizare și CountryPolicy trecute în test.

Acesta este un model tehnic și economic de produs, nu o opinie juridică și nu o
promisiune de tarif. Producția cu fonduri reale cere audit extern, contracte cu
providerii și validare juridică/fiscală pentru fiecare țară activată.
