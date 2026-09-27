# Monetizare și tokenomics

## Decizia recomandată

**Nexus nu lansează un token transferabil în MVP sau Phase 2.** Produsul folosește
EGLD pentru gas/settlement și o listă de ESDT-uri fungibile verificate pentru
plăți. Punctele de loialitate sunt off-chain, netransferabile, fără promisiune de
valoare sau conversie.

Această alegere evită trei erori comune: speculație înainte de product-market fit,
subvenționarea spamului și tratarea tokenului drept substitut pentru venit real.
MiCA acoperă inclusiv categorii de utility tokens și cere analiză în funcție de
ofertă și funcționalitate; eticheta „utility” nu este o excepție automată.

## 1. Active

| Activ | Funcție | Transferabil | On-chain |
|---|---|---:|---:|
| EGLD | gas, escrow, tips | da | da |
| ESDT aprobat | unitate de plată/escrow | da | da |
| Nexus Points | loyalty, fee rebates limitate | nu | nu |
| Verification badge | dovadă publică revocabilă | preferabil nu | opțional |
| Ticket NFT/SFT | acces eveniment/rezervare | conform regulilor | da |
| Achievement | reputație cosmetică | nu/preferabil | opțional |

Nu acceptăm tokenuri arbitrare în escrow. Allowlist-ul ia în calcul lichiditatea,
emitentul, contract/token ID, decimals, risc de freeze, jurisdicție și monitorizare.

## 1A. Economia „every action = transaction”

Fiecare acțiune consumă gas, inclusiv like, comment și message commitment. Nexus
introduce `Gas Credits` ca unitate contabilă off-chain, netransferabilă:

- free daily quota pentru utilizare normală, finanțată din growth/fees;
- cote separate pentru public, private relay și creator/seller tools;
- premium poate include o cotă mai mare, fără a cumpăra reach organic;
- după epuizare, utilizatorul așteaptă resetarea sau plătește gas-ul direct;
- Sybil/spam nu primește sponsorship nelimitat;
- treasury are cap zilnic per shard și circuit breaker automat;
- nicio acțiune nu este batch-uită: un credit sponsorizat corespunde unui tx.

Costul este calculat și monitorizat prin:

`cost/zi = acțiuni confirmate × gas mediu/acțiune × gas price × preț EGLD`.

Nu se fixează un cost în euro în specificație; gas usage se măsoară prin simulare
și devnet, iar prețul EGLD este volatil. North-star financiar include
`sponsored gas / WMP` și `sponsored gas / GMV`, nu doar tranzacțiile brute.

Guardrail economic: gas-ul sponsorizat urmărește sub 5% din venitul net și are hard
cap 8%; înainte de monetizare este un buget de achiziție plafonat. Gas pool-ul are
minimum trei luni de rezervă estimată, cap zilnic per shard și load shedding care
protejează întâi revoke/report și fluxurile financiare. Supernova reduce latența,
nu face gas-ul gratuit.

## 2. Surse de venit

### 2A. Economia Nexus Node Network

Rețeaua funcționează de la un Genesis Node și nu depinde de recompense. Participanții
care oferă voluntar resurse pot opta ulterior pentru plata muncii verificate —
storage-byte-time, egress, transcode, relay, index, live ingest și compute — în EGLD
sau ESDT aprobat.
Nu este necesar un token NXS. Joburile de volum mare rămân off-chain, produc receipts
semnate și se decontează periodic prin Merkle root/claim, nu printr-o tranzacție
pentru fiecare pachet, segment HLS ori secundă de CPU.

Nexus poate reține un orchestration/protocol fee de 5–12% din valoarea serviciului,
afișat proprietarului nodului și solicitantului. Prețurile au caps pe clasă/țară, buget maxim,
quote expiry și protecție contra self-dealing. Recompensele nu depind de views brute,
stake simplu ori recrutarea altor noduri, ci de capacitate acceptată și receipts
verificate. Stake/bond acoperă abateri obiectiv demonstrabile; latența sau moderarea
contestabilă duc la neplată, suspendare ori apel, nu la slashing arbitrar.

Join-ul public este permissionless din prima versiune. Rewards sunt dezactivate până
când receipts, costul și frauda sunt măsurate; aceasta nu împiedică relay/storage
voluntar. Treasury are caps per NodeID/wallet/owner-cluster și perioadă; niciun nod,
wallet, ASN sau cloud nu trebuie să devină punct unic economic de eșec.

- Marketplace: 3–6% din settlement, afișat înainte de plată;
- classifieds: publicare standard gratuită în limite, pachete seller și promovări
  plătite; `CLASSIFIED_ONLY` nu are transaction protection fee;
- Travel: 8–15% combinat host/guest, calibrat per categorie și jurisdicție;
- Mobility: 10–18% platform fee în pilot, afișat driverului și riderului; fără
  modificarea retroactivă a quote-ului și fără comision ascuns;
- Experiences/events: 5–12%;
- tips: 0–5%, cu creator share explicit;
- boosts: CPM/CPC sau pachet fix, etichetat „Promoted”;
- creator subscriptions: fee platformă 10–20%, după app-store/payment analysis;
- Dating Plus: filtre flexibile suplimentare, Second Look și Travel Mode; controalele
  esențiale de siguranță, block/report, Incognito de bază și verificarea 18+ nu sunt paywalled;
- costul verificării avansate poate fi passthrough, dar plata nu cumpără un rezultat,
  badge, reach, prioritate la safety sau un Trust Passport mai favorabil;
- Pulse Pro: scheduled posts, analytics și creator subscriptions; aliasul, controlul
  audienței și protecția anti-hărțuire rămân gratuite;
- Watch Premium: fără ads, background/offline numai unde drepturile permit;
- Channel memberships, paid premieres, Live tips și creator revenue share după
  invalid-traffic, rights, app-store/payment și tax gates;
- Creator Studio Pro pentru echipe, analytics, live tools și storage/encoding peste
  fair-use; safety/report/appeal nu sunt paywalled;
- Work recruiter tools: abonament B2B și featured jobs;
- verificări premium: cost passthrough + marjă, fără pay-to-trust;
- servicii host/seller: analytics, calendar, protecție și promovare.
- Business Pro și multi-location: abonament B2B;
- appointments: 3–8% numai pentru depozit/plată protejată; pay-at-venue poate rămâne
  fără procent și se monetizează prin Pro/promovare;
- Music Premium, supporter subscriptions, direct tips și artist tools;
- music promotion și royalty administration numai pe bază contractuală;
- cursuri/coach: fee transparent pe checkout și abonamente provider;
- Promotion Engine pentru post, anunț, serviciu, job, piesă și curs, cu paid/organic
  separat și fără targetare pe date sensibile.
- Agent Marketplace: 2–8% din task escrow, API plans și Business Agent seats;
- developer verification/conformance la cost + marjă, fără pay-to-trust;

Pentru Nexus Kids, modelul recomandat este abonament Family și/sau catalog editorial.
La pilot nu există ads. Dacă ulterior CountryPolicy permite publicitate, aceasta este
numai contextuală, age-appropriate, fără profiling/remarketing sau ad identifiers și
fără design care presează copilul să cumpere. Orice purchase/subscription change cere
parental gate. Activitatea copilului nu produce rewards ori creator payout individual
on-chain; creatorii sunt plătiți din agregate auditate și contracte adulte.

Fee-urile din contract au hard cap și sunt snapshot la finanțarea escrow-ului.
Schimbările viitoare nu modifică tranzacțiile existente.

Pentru Mobility, `gross fare`, platform fee, driver payout, cancellation/no-show,
tips și tax fields sunt linii distincte. Incentivele șoferilor au buget și termen
explicit; nu sunt prezentate ca venit garantat și nu folosesc un token Nexus.

## 3. Creator rewards fără token

În P2, creator fund este finanțat din venit fiat/EGLD bugetat. Alocarea se calculează
off-chain din views calificate, watch time, originalitate, safety și anti-fraudă.
Se publică periodic un Merkle root; creatorii eligibili pot claim-ui EGLD/ESDT.

Guardrails:

- caps per creator și deduplicare device/wallet;
- nu plătim like-uri brute sau invitații Sybil;
- drept de apel și motive agregate;
- reținere fiscală/reporting după jurisdicție;
- campania are buget fix, nu emisiune monetară nelimitată.

## 4. Loyalty points

Se acordă pentru acțiuni cu valoare verificabilă: tranzacție finalizată, profil
complet, contribuție moderată pozitiv, referință care produce utilizator activ.
Nu se acordă pentru swipe, view sau mesaje în masă.

Punctele pot oferi:

- relayed gas quota;
- discount temporar la boost sau fee, în limite publice;
- cosmetics și early access;
- prioritate neutră la suport, nu la dispute/safety.

Nu se vând, nu se retrag și nu sunt promovate ca investiție.

## 5. Condiții pentru evaluarea unui token NXS în P3

Se reia discuția numai dacă există simultan:

1. product-market fit și venit recurent fără token;
2. utilitate imposibil sau nepractic de realizat cu EGLD/ESDT/points;
3. opinie juridică MiCA și clasificare per piețele țintă;
4. white paper/disclosures, governance și market-abuse controls dacă sunt cerute;
5. model anti-whale/Sybil și simulări economice;
6. treasury multisig, vesting transparent și audit;
7. nicio promisiune de randament sau susținere artificială a prețului.

Până atunci, „tokenomics” Nexus înseamnă economie de comisioane și recompense
sustenabile, nu emiterea unui activ speculativ.

Ținta de contribution margin este minimum 15% în pilot după gas, media, maps,
royalties, verificări, moderation variabilă și fraud loss, apoi 25–35% la scară.
Acestea sunt gates de operare, nu promisiuni de profit. Rights expense este dedus
înainte de orice share Music, iar review-ul sau badge-ul nu poate fi cumpărat.

Traficul `AGENT` și `SYSTEM_TEST` nu produce creator rewards, review eligibility,
ad billable impressions, referral payouts sau indicatori de influență. Agent-to-agent
GMV, cost și retenție se raportează separat de economia umană. Agentul B2B își
include gas-ul în task fee ori plan, astfel încât nu consumă cota socială gratuită.

Kids traffic se raportează separat, fără ad attribution individual, referral rewards,
wallet incentives, token/NFT sau calcul public al valorii unui copil. Costul Kids este
urmărit ca `catalog + moderation + delivery minute + parental operations`, nu ca gas/action.

Sursă normativă de pornire: [Regulamentul MiCA (UE) 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj).
