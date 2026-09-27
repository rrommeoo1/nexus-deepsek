# Nexus Collectible Identity Market

Status: propunere de arhitectură economică pentru P2/P3  
Data: 2026-08-25  
Scope: username-uri Nexus, story-uri colecționabile, profile/page shells și colecții

## 1. Decizia de produs

Nexus poate avea o economie puternică în jurul curiozității, identității și
colecțiilor, dar trebuie separat foarte clar:

1. **ce este activ tranzacționabil**: username, alias, story collectible, colecție,
   profil gol, pagină de business/creator cu ownership transparent;
2. **ce nu se vinde niciodată ascuns**: wallet, chei, mesaje private, KYC, verificări,
   sigilii câștigate, sancțiuni, dating history, reputation score și review-uri
   personale.

Principiul economic este: poți cumpăra expresie, acces, colecție sau brand; nu poți
cumpăra încredere falsă.

## 2. Story UX: “prism chain”

Stories trebuie să fie vizibile, tactile și ușor misterioase, fără dark patterns.
Propunerea UI:

- story-urile intră parțial unele în altele, ca un lanț de prisme sau cristale;
- primul tap nu deschide imediat full-screen, ci face `peek`: cardul se mărește
  6–10%, se luminează pe margine și arată o micro-previzualizare de 1–2 secunde;
- al doilea tap sau swipe-up deschide story-ul full-screen;
- dacă userul nu vrea să vadă story-ul, poate continua scroll-ul fără fricțiune;
- story-urile cu status `collectible` au un mic marcaj discret `Collect`;
- story-urile deținute de user apar în `Profile → Collection`, unde pot fi expuse
  sau listate la vânzare.

Regula de bun gust: efectul trebuie să creeze curiozitate, nu să păcălească userul.
Nicio animație nu trebuie să ascundă prețul, creatorul, durata accesului ori faptul că
urmează o plată.

## 3. Tipuri de active

| Activ | Ce cumperi | Ce nu cumperi | Transferabil |
|---|---|---|---:|
| Nexus Username | dreptul de a folosi aliasul ca rutare socială/plăți | wallet, istoricul privat, reputația vechiului owner | da |
| Story Collectible | ownership/display license pentru o ediție | copyright complet, dacă nu este explicit | da |
| Profile Shell | design, handle, bio public, content public permis | KYC, badge-uri, mesaje, sancțiuni, dating trust | limitat |
| Business/Creator Page | asset de brand cu followers transparenți | review-uri frauduloase, certificări false | da, cu KYB/dispute |
| Empty Profile | username + layout fără istoric | orice reputație | da |

Un “profil complet” poate fi transferat numai ca pachet de active permise. Nexus
afișează obligatoriu `Owner changed on DATE`, iar ranking-ul intră într-un cooldown
anti-fraudă.

## 4. Username market

Username-ul Nexus este un asset rar, dar trebuie protejat contra scamului:

- rezervări pentru branduri, instituții, personalități publice și termeni sensibili;
- normalizare anti-homoglyph și anti-confuzie (`rn` vs `m`, caractere similare);
- istoric public de transfer pentru alias, fără expunerea datelor private;
- escrow pentru transfer și plată;
- cooldown după transfer înainte să poată fi revândut;
- dispute flow pentru trademark, impersonare, fraudă și cont compromis;
- `@username` poate fi folosit pentru plăți doar când ownerul activează explicit
  `Payment alias`.

La transfer, vechiul owner pierde rutarea publică, dar nu pierde walletul, istoricul
privat sau dreptul de a exporta propriile date. Noul owner primește aliasul și
dreptul de afișare, nu încrederea acumulată de altcineva.

## 5. Story collectibles

Story-ul poate avea două vieți:

1. **Story social** — conținut vizibil temporar/persistent conform setărilor autorului;
2. **Story collectible** — ediție mint-uită cu ownership, licență și preț.

Modele de mint:

- `1/1`: unic, potrivit pentru momente virale;
- `Limited edition`: 10, 100, 1000 ediții;
- `Open edition`: disponibil într-o fereastră limitată, apoi supply-ul se închide;
- `Access pass`: nu cumperi story-ul, ci acces temporar la conținut privat.

Buyer-ul poate:

- expune story-ul în colecție;
- revinde ediția;
- trimite cadou;
- folosi story-ul ca badge cosmetic în profil, dacă licența permite.

Buyer-ul nu poate:

- pretinde că el este autorul;
- elimina autorul original;
- republica media în afara licenței;
- ocoli moderation/takedown.

Dacă un story este retras pentru copyright, ilegalitate sau safety, ownership-ul poate
rămâne în wallet, dar media devine indisponibilă public și apare un tombstone.

## 6. Private curiosity economy

Pentru profile private și private content:

- ownerul setează prețul, dar minimul recomandat este echivalentul a **1 USD în
  stablecoin aprobat**, ca să evităm spamul și micro-settlement inutil;
- buyer-ul poate cumpăra acces pe zile, de exemplu 1, 7, 15 sau 30 de zile;
- split inițial: 90% creator / 10% Nexus, calculat din net settlement;
- dacă buyer-ul plătește dublu pentru “mutual reveal”, accesul devine reciproc pe
  aceeași durată numai dacă ambele părți au acceptat această regulă în setări;
- creatorul nu primește automat identitatea vizitatorului, decât dacă produsul este
  configurat ca `mutual reveal` și userul acceptă explicit.

Această economie merge în feed prin selectorul:

`For You / Local Trends / Global Trends / Friends / Following / Private Content / Tweets`

`Private Content` afișează doar conținut de la profile la care userul are acces valid
sau oferte preview eligibile.

## 6A. Curiosity Market — free by default, pay for mystery

Modelul economic recomandat pentru Nexus este `free by default, pay for curiosity`.
Utilizarea normală rămâne gratuită: feed, like, comment, follow, messages de bază,
postare normală și descoperire organică. Plățile apar doar când cineva alege
voluntar să deblocheze ceva rar, privat, ascuns, colecționabil sau reciproc.

Primitivele de produs:

| Primitive | Exemplu UX | Cine câștigă | Regula de siguranță |
|---|---|---|---|
| `Unlock` | plătești să vezi o postare/story ascunsă | creatorul + Nexus | preț clar înainte de plată |
| `Reveal` | plătești x2 să vezi cine ți-a deblocat profilul/conținutul | ownerul inițial + Nexus | numai dacă vizitatorul a acceptat reveal policy |
| `Mutual Reveal` | amândoi devin vizibili unul altuia | ambii primesc acces simetric | opt-in și reversibil pentru viitor |
| `Peek` | vezi preview limitat, fără plată | crește curiozitatea creatorului | fără conținut explicit/ilegal în preview |
| `Collect` | cumperi o ediție de story/post | creator + colecționar | licență explicită, anti-wash |
| `Gift Unlock` | plătești acces pentru un prieten | creator + receiver | receiver poate refuza |
| `Friend Vault` | listă de prieteni cu reveal reciproc | grupul | fiecare membru acceptă regulile vaultului |
| `Bounty Reveal` | pui o sumă ca un creator să facă public ceva promis | creator | creatorul acceptă înainte; nu pentru doxxing |

Diferența Nexus față de rețelele clasice este că “curiozitatea” devine un obiect
economic transparent. Dar curiozitatea nu poate fi folosită pentru șantaj, doxxing,
hărțuire, minori, revenge content sau presiune socială abuzivă.

### 6A.1 Hide-to-unlock

Autorul poate posta conținut cu una dintre stările:

- `Public`: vizibil tuturor celor eligibili;
- `Followers`: vizibil followers/connections;
- `Private Access`: vizibil celor care au abonament/acces activ;
- `Hidden Unlock`: preview public + conținut blocat contra preț;
- `Collectors Only`: vizibil deținătorilor unei ediții NFT/SFT;
- `Friend Vault`: vizibil unei liste private cu reguli de reveal reciproc;
- `Timed Mystery`: conținut ascuns până la o oră/dată, cu opțiune de early unlock.

Ownerul setează prețul, dar pentru plăți on-chain settlement-ul minim rămâne
echivalentul a 1 USD în stablecoin aprobat. Pentru sume mai mici, Nexus poate folosi
credit intern off-chain sau bundle/cart, fără settlement individual pe-chain.

UX recomandat:

```text
card blur / prism cover
  → preview sigur: titlu, autor, categorie, Trust Lens, preț, durată
  → Unlock for 2 USDC
  → confirmare: creator 90%, Nexus 10%, drepturi cumpărate
  → acces imediat
  → receipt + opțiune Collect/List dacă activul permite
```

Niciun unlock nu promite că materialul va fi “valoros”. UI trebuie să spună clar ce
cumperi: acces la conținut, nu rezultat, match, răspuns ori garanție socială.

### 6A.2 Reveal x2

`Reveal x2` este mecanica de curiozitate cea mai interesantă, dar și cea mai sensibilă.
O implementăm numai cu consimțământ anticipat.

Reguli:

- când userul deblochează un profil/conținut, vede înainte politica ownerului:
  `anonymous`, `revealable`, `mutual reveal` sau `never reveal`;
- dacă politica este `anonymous`, ownerul nu poate cumpăra ulterior identitatea;
- dacă politica este `revealable`, vizitatorul acceptă că ownerul poate plăti x2
  pentru a afla cine a deblocat;
- dacă politica este `mutual reveal`, plata x2 deschide acces simetric pentru ambele
  părți pe aceeași durată;
- reveal-ul nu expune wallet, email, telefon, locație exactă, device sau date sensibile;
- reveal-ul arată doar profilul Nexus ales pentru acel mod.

Exemplu:

```text
Mara pune profilul privat la 5 USDC / 7 zile.
Alex plătește 5 USDC și acceptă policy: revealable.
Mara vede: “1 viewer revealable”.
Mara poate plăti 10 USDC ca să afle că viewerul este @alex.social.
Din cei 10 USDC: Alex poate primi 50–70%, Mara primește reveal-ul, Nexus ia fee.
```

Această ultimă parte creează jocul economic: vizitatorul anonim nu este doar “taxat”,
ci poate fi recompensat dacă acceptă să devină revealable. Astfel curiozitatea devine
o piață reciprocă, nu doar un mecanism prin care creatorul ia bani.

Split recomandat pentru `Reveal x2`:

- 60% către persoana reveal-uită, fiindcă își monetizează discreția;
- 30% către ownerul conținutului/profilului, fiindcă a creat contextul;
- 10% către Nexus;
- pentru adult/private high-risk: reserve suplimentar inclus în fee, conform policy.

### 6A.3 Friend Vaults și cercuri de reveal

Nexus poate avea un strat social diferit de orice rețea clasică: `Vaults`.

Un Vault este o listă privată cu reguli proprii:

- `Close Friends`: story-uri și poze între prieteni;
- `Mutual Crush`: Dating/social discret, reveal doar dacă ambele persoane activează;
- `Collectors Club`: acces pentru cei care dețin anumite collectibles;
- `Local Circle`: prieteni din oraș/zonă;
- `Work Circle`: proiect/eveniment profesional;
- `Prive Circle`: 18+, cu age/country gate.

Mecanici posibile:

- `Mirror Reveal`: dacă două persoane se adaugă reciproc în același Vault, se deschide
  o conversație sau un badge privat;
- `Group Unlock`: dacă 10 prieteni contribuie câte 1 USDC, se deblochează un story
  premium pentru tot grupul;
- `Secret Drop`: creatorul pune un collectible ascuns pentru primul grup care rezolvă
  un indiciu sau atinge un milestone;
- `Temporary Mask`: userul poate participa anonim într-un Vault, dar acțiunile
  financiare rămân auditate prin commitments.

Vaults trebuie să fie private-by-design: lista membrilor nu este publică, invite-ul
expiră, iar ownerul nu poate schimba retroactiv regulile pentru conținut deja plătit.

### 6A.4 Curiosity score fără reputație falsă

Nexus poate afișa un scor fun, dar nu trebuie confundat cu încrederea.

Scoruri permise:

- `Mystery Heat`: cât de multă lume dă peek/unlock unui conținut;
- `Collector Demand`: offers, watchlist și resale interest;
- `Reveal Chemistry`: câte mutual reveals au dus la conversații non-spam;
- `Vault Energy`: activitate într-un grup privat;
- `Cultural Spark`: story/post care devine collectible/trend organic.

Scoruri interzise sau limitate:

- nu există “valoarea unei persoane”;
- nu penalizăm public pe cineva pentru că e ignorat;
- nu vindem dating seriousness;
- nu transferăm trust score odată cu profilul;
- nu permitem ca reveal payments să cumpere reach organic.

Ranking-ul poate folosi aceste semnale doar ca interes agregat și anti-fraudă, nu ca
dovadă morală despre persoană.

### 6A.5 Loop economic recomandat

```text
free feed + stories
  → prism peek creează curiozitate
  → unlock ieftin sau subscription privat
  → buyer primește acces/collectible/status cosmetic
  → creator câștigă direct
  → Nexus ia fee modest
  → conținutul bun intră în topuri organice fără pay-to-rank
  → colecționarii revând/gift-uiesc
  → royalties întorc bani creatorului
  → Vaults creează jocuri sociale și reveal reciproc
```

Acesta este nucleul economic: creatorii vin pentru venit, colecționarii pentru statut,
utilizatorii obișnuiți pentru fun, iar platforma câștigă din tranzacții reale fără
să taxeze fiecare gest social.

### 6A.6 Idei diferențiatoare

1. `Mystery Drops` — creatorii pot lansa story-uri ascunse cu supply limitat; primul
   val vede preview, apoi prețul urcă automat doar dacă există cerere reală.
2. `Curiosity Auctions` — nu licitezi pentru obiect, ci pentru primul acces/reveal.
3. `Mutual Key` — două persoane cumpără/activează o cheie comună; conținutul se
   deschide doar dacă ambele acceptă.
4. `Local Secret` — story-uri ascunse disponibile doar near-me, cu expiry scurt.
5. `Collector Rooms` — camere de profil unde expui story-uri, username-uri istorice,
   badges și artă socială cumpărată.
6. `Proof of Original Moment` — story-ul viral poate deveni un collectible cu hash
   și timestamp, fără să punem video-ul brut pe-chain.
7. `Social Escrow Challenge` — creatorul promite un drop dacă se strânge o sumă;
   dacă nu livrează, banii se întorc automat.
8. `Anonymous Support with Optional Reveal` — susții un creator anonim; poți revela
   ulterior identitatea dacă vrei credit social.
9. `Private Trend Board` — top cu conținut privat popular, dar fără leak la media.
10. `Reputation Firewall` — tot ce este cumpărat are label economic; tot ce este
    câștigat organic are label separat.

## 6B. Unități economice

Nexus nu are nevoie de token transferabil propriu pentru acest model în MVP/P2.
Unitățile recomandate sunt:

- `EGLD`: gas și settlement unde userul vrea sau unde relayer-ul nu sponsorizează;
- `approved stablecoin ESDT`: prețuri clare în USD/EUR/monedă locală;
- `Gas Credits`: cotă internă netransferabilă pentru acțiuni sociale sponsorizate;
- `Nexus Points`: loialitate netransferabilă, discount-uri și cosmetics;
- `Collectible NFTs/SFTs`: ownership pentru story-uri, passes și username wrappers;
- `Receipts`: dovezi semnate pentru unlock/reveal/access, batch-uite și ancorate.

Un token Nexus transferabil ar fi analizat doar în P3, după product-market fit,
opinie juridică și dovada că EGLD/ESDT/points nu sunt suficiente.

## 6C. Politica de preț

Recomandare:

- acces privat: minimum 1 USD echivalent stablecoin;
- hidden unlock: minimum 1 USD dacă este settlement on-chain;
- micro-unlock sub 1 USD: doar off-chain credit/bundle/cart, cu settlement periodic;
- reveal x2: exact dublul prețului inițial sau un multiplicator ales între 1.5x și
  3x, dar afișat înainte de primul unlock;
- username premium: fixed price, offer sau auction;
- story collectible: fixed price, open edition sau auction;
- profile/page transfer: escrow obligatoriu și dispute window.

Prețurile sunt alese de owner, dar Nexus poate impune:

- minime pentru a evita spam/gas waste;
- maxime temporare pentru conturi noi;
- blocaje pentru fraudă, minori, sanctioned countries și brand disputes;
- quote expiry, ca userul să nu plătească un preț modificat în fundal.

## 6D. Interdicții clare

Nu monetizăm:

- review-uri;
- Trust Passport;
- verificări personale;
- voturi politice ori verdict factual;
- acces la date sensibile fără consimțământ;
- conținut cu minori în economie tranzacționabilă;
- doxxing, revenge content, stalking, extortion;
- cumpărarea directă de reach organic;
- cumpărarea ascunsă a followers ca reputație.

Aceste limite sunt ceea ce fac economia utilizabilă legal și moral pe termen lung.

## 7. Profile/page transfers

Transferurile de profil sunt utile pentru business, creatori și branduri, dar sunt
periculoase dacă vând reputație netransparent.

Reguli:

- profil personal obișnuit: transfer dezactivat implicit;
- profil gol: transfer permis;
- pagină de business/creator: transfer permis cu KYB/KYC, escrow și anunț public;
- profil adult/Privé: transfer doar cu 18+, country policy și compliance gates;
- profil Kids: netransferabil;
- profil Work personal: netransferabil ca identitate profesională.

La transfer se resetează sau se marchează separat:

- verification badges;
- sigilii câștigate;
- trust/reputation score;
- creator monetization eligibility;
- dating seriousness;
- seller/host rating, cu excepția paginilor business transferate transparent;
- ranking weight pe followers existenți.

Followers nu sunt “vânduți” ca oameni. Ei rămân conectați la pagină numai cu notificare
și drept ușor de unfollow. Feed-ul aplică un cooldown ca noul owner să nu cumpere
reach organic instant.

## 8. Sigilii automate și status

Sigiliile nu se aleg manual ca emoji-uri. Sunt acordate automat și revocabil pe baza
unor praguri verificate:

- `Rising Creator`: creștere organică și retenție, fără fraudă;
- `Star Creator`: followers unici + engagement calificat + safety bun;
- `Trusted Seller`: tranzacții finalizate și dispute mici;
- `Verified Business`: KYB valid;
- `Premium Collector`: colecții cumpărate legal, fără wash trading;
- `Cultural Moment`: story/post cu distribuție cross-region și semnale organice.

Sigiliile nu se transferă odată cu username-ul sau profilul. Dacă un creator vinde
o pagină, noul owner începe cu propriul istoric sau cu un label separat:
`Page acquired, trust rebuilding`.

## 9. Piață, fee-uri și royalties

Tipuri de vânzare:

- fixed price;
- offer;
- auction;
- bundle;
- lease/rent pentru username premium, unde legea și politica permit;
- subscription/access pentru private content.

Split-uri recomandate:

| Tranzacție | Creator/Owner | Nexus | Royalty creator original | Reserve |
|---|---:|---:|---:|---:|
| Story primary sale | 90% | 8% | — | 2% |
| Story resale | seller 87–92% | 2–5% | 3–8% | 0–2% |
| Username sale | seller 90–95% | 5–10% | — | 0–2% |
| Private access | creator 90% | 10% | — | inclus în fee |
| Business page transfer | seller 88–94% | 4–8% | — | 2–4% |

Procentele sunt configurabile per țară/produs și se afișează înainte de semnare.
Niciun fee nu se schimbă retroactiv pentru o tranzacție existentă.

## 10. Blockchain architecture

MultiversX păstrează ownership, escrow, settlement, royalties și commitments. Media
rămâne off-chain, cu hash/CID/licență pe-chain.

Contracte recomandate:

1. `nexus-identity-registry`
   - înregistrează username-uri, status, owner, transfer locks, protected namespaces;
   - leagă aliasul de wallet și de `paymentAlias` opt-in.
2. `nexus-story-collectibles`
   - mint pentru story editions;
   - metadata CID, content hash, license hash, edition cap și royalty policy.
3. `nexus-asset-market`
   - listings, offers, auctions, bundles, expirări, cancelări;
   - allowlist pentru EGLD/ESDT stablecoins aprobate.
4. `nexus-escrow-settlement`
   - escrow, dispute, release, refund, fee split, royalties;
   - receipts one-time și state machine append-only.
5. `nexus-profile-transfer`
   - transfer pentru profile/page shells;
   - enforcement pentru resetarea non-transferables.
6. `nexus-royalty-splitter`
   - împarte automat creator/platform/referral/node reserve când este cazul.

Gas minim:

- approvals și semnături scurte off-chain;
- batch commitments pentru evenimente sociale;
- tranzacție on-chain doar pentru ownership/settlement;
- meta-transactions/sponsored gas unde policy permite;
- coș de cumpărare pentru micro-active, ca userul să nu semneze 20 de ori.

## 11. Date on-chain vs off-chain

| Date | On-chain | Off-chain |
|---|---|---|
| Username owner | da | index/search/cache |
| Username text normalizat | commitment + public alias când activ | anti-abuse metadata |
| Story media | hash/CID/licență | fișier, thumbnails, HLS, CDN/storage |
| Story ownership | da | colecții, preview cache |
| Profile shell transfer | da | bio, layout, media, public history |
| Reputation/sigils | commitments/badge revocabil | scoring brut, risk data |
| KYC/KYB | nu | provider/verificare criptată, numai status minim |
| Mesaje private | nu | E2EE ciphertext |
| Dispute/legal holds | hash/status minim | evidence vault criptat |

## 12. Fraud controls

Riscurile principale:

- cumpărare de conturi pentru scam;
- impersonare și trademark abuse;
- wash trading ca să pară un story valoros;
- profil adult vândut minorilor sau în țări blocate;
- ransomware/social extortion prin private content;
- cumpărare de followers mascată ca transfer de pagină.

Controale:

- transfer cooldown;
- caps pe conturi noi;
- proof-of-human/risk score pentru tranzacții mari;
- KYB pentru business pages;
- label public de transfer;
- ranking cooldown după transfer;
- anti-wash trading pe graph, wallet cluster și funding source;
- dispute window pentru high-value;
- country capability matrix;
- age gate strict pentru adult content;
- Kids complet exclus din economie tranzacționabilă.

## 13. Prompt strategic pentru produs

Folosește promptul acesta pentru orice iterație de design/economie pe acest modul:

```text
Ești arhitect de produs, economist de platformă și designer de trust pentru Nexus,
o rețea socială multi-profile pe MultiversX. Proiectează un marketplace de identitate
și colecții unde username-urile, story-urile, colecțiile și profile/page shells pot fi
tranzacționate rapid, dar unde reputația, verificările, KYC, mesajele private și
sigiliile câștigate nu se pot cumpăra ascuns.

Obiective:
- creează o economie interesantă pentru creatori, colecționari și curioși;
- păstrează cost minim pentru user prin sponsored gas, batch commitments și settlement
  doar când există valoare reală;
- folosește MultiversX pentru ownership, escrow, royalties, username registry și
  receipts verificabile;
- media rămâne off-chain, cu hash/CID/licență on-chain;
- protejează utilizatorii de scam, impersonare, wash trading, profiluri cumpărate și
  vânzarea reputației false;
- respectă age gates, Kids restrictions, privacy by design și country policy;
- fiecare tranzacție arată clar prețul, durata, drepturile cumpărate, fee-ul Nexus,
  payout-ul creatorului și ce nu este inclus.

Livrează:
1. UX flow complet pentru story peek → collect/buy → collection → resale;
2. UX flow complet pentru username offer → escrow → transfer → cooldown;
3. reguli pentru ce se transferă și ce se resetează la profil/page sale;
4. smart contracts și state machines;
5. fee model sustenabil, cu creator share și Nexus profit modest;
6. risk controls și compliance gates;
7. backlog MVP/P2/P3 cu criterii de acceptare.
```

## 14. Backlog recomandat

### MVP demo local

- story prism rail cu overlap, tap-to-peek și open full-screen;
- story collectible badge în UI, fără plată reală;
- profile collection tab cu mock owned stories;
- username availability UI și payment alias status;
- marketplace mock pentru `Buy story`, `Make offer`, `List in collection`;
- toate tranzacțiile marcate `demo/local no real funds`.

### P2 devnet

- username registry devnet;
- story collectible mint devnet;
- asset marketplace devnet cu escrow xEGLD/ESDT test;
- fee splitter test;
- local anti-wash simulator;
- evidence pack pentru ownership și transfer.

### P3 production-gated

- stablecoin/xMoney-capable settlement unde e permis;
- legal terms pentru digital collectibles și username transfers;
- trademark/reserved names process;
- compliance gates pentru adult/private/Kids;
- third-party audit pentru contracts;
- dispute operations și insurance/reserve policy.

## 15. Scor economic al ideii

Scor estimat: **8.4/10** dacă este implementată cu trust boundaries stricte.

De ce este puternică:

- adaugă un motiv nativ pentru blockchain, nu doar “postări on-chain”;
- creează venit pentru creatori fără să taxeze fiecare like;
- username-urile și story-urile pot deveni obiecte culturale reale;
- colecțiile dau identitate și status fără token speculativ Nexus;
- se potrivește cu social, Privé, business pages și creator economy.

Ce o poate distruge:

- dacă permitem cumpărarea reputației;
- dacă nu protejăm brandurile și impersonarea;
- dacă plățile sunt prea frecvente/scumpe;
- dacă stories devin dark pattern;
- dacă adult/private content nu are age/country gates serioase.

Direcția mea recomandată: lansăm întâi UI-ul de story prism + collection în demo,
apoi username availability/payment alias, apoi devnet mint/marketplace. Profilurile
complete se lasă pentru P3, numai după reguli juridice și anti-fraudă solide.
