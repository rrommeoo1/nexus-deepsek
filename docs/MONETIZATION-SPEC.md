# Monetizare — F0: specificația (17 octombrie 2026)

Status: **F0 încheiat prin acest document; F1 (backend) și F2 (aplicația) nu sunt începute.**
Monedă: **`TEST-USDC`, valoare zero, fără plăți reale.** Niciun ecran și nicio rută din acest plan nu
mișcă fonduri. Întrebările care țin de bani reali, taxe, minori și magazinele de aplicații sunt în
`docs/MONETIZATION-RISKS.md` și **nu** primesc răspuns aici.

## 1. Ce decide F0 și ce nu

Decide, pentru fazele următoare:

1. **ce se vinde** — un singur lucru la început: susținerea unui creator, sub două forme (`tip`, o dată;
   `membership`, recurent lunar);
2. **cine poate primi** — numai conturi reale, active, neblocate, niciodată propriul cont;
3. **ce se vede înainte de plată** — prețul, moneda, împărțirea completă și ce anume primești;
4. **ce se vede după plată** — o confirmare cu id, hash de commitment și status; niciodată date de card,
   niciodată chei;
5. **ce se stochează** — intenții și intrări de registru, nu „solduri” inventate în client.

Nu decide: custodie, fiscalitate, rambursări obligatorii, KYC, IAP, payout real, economie pentru conținut
adult. Fiecare dintre ele are un rând în `MONETIZATION-RISKS.md` și blochează F1+ până primește răspuns.

## 2. Ce există deja în cod (inventar verificat, nu intenții)

Serverul are deja un registru de **intenții** pentru creator economy, cu split versionat și constrângeri în
schemă. Aplicația nu are încă niciun ecran care să-l folosească.

| Piesă | Unde | Stare reală | Ce lipsește |
|---|---|---|---|
| Produse de susținere (`tip`, `membership`) | `apps/nexus-web/lib/repo.js:5309`, ruta `POST /api/creator/products` (`api.js:2727`), tabel `creator_support_products` (`db.js:1461`) | **activ**: titlu 3–80, preț 100–100.000.000 cenți, interval 1–366 zile pentru membership, split versionat la creare (`CORE_TIP_V1_90_5_3_2`, `CORE_MEMBERSHIP_V1_85_10_3_2`) | editare, arhivare, listare fără autentificare |
| Intenții de susținere | `repo.js:5327`, ruta `POST /api/creator/support-intents` (`api.js:2743`), tabel `creator_support_intents` (`db.js:1473`) | **activ**: calculează creator/fee/rezervă/infra, respinge self-tip și blocările, marchează traficul sintetic `excluded_synthetic`; `status` ∈ `demo_unpaid, excluded_synthetic, settled, refunded, reversed`; `CHECK (gross_cents = creator_share_cents + nexus_fee_cents + safety_reserve_cents + infra_cents)` | settlements, refundări, reversări, solduri |
| Catalog + panou creator | `GET /api/creator/catalog` (`api.js:2719`), `GET /api/creator/dashboard` (`api.js:2710`), `repo.js:5319`, `repo.js:5354` | **activ**: catalog pe handle, panou cu produse/primite/trimise și totaluri doar pe intrări `settled` + `payout_eligible` | niciun ecran; totalurile rămân 0 până există settlements |
| Nexus Pay (cotare → intenție → istoric) | `api.js:2656`, `2689`, `2706`; `PAY_ASSETS` = `EGLD` (18 zecimale) și `TEST-USDC` (6, `LOCAL_DEMO_ONLY`); tabel `pay_transfer_intents` (`db.js:1442`) | **activ ca intenție locală**: cotare cu receipt, verificare de rețea/chain id, `authorization.enabled=false`, `real_settlements: 0` | semnare, broadcast, reconciliere on-chain — **deliberat oprite** |
| Idempotență + action ledger | `lib/mutation-idempotency.js` (TTL 24 h, lease 30 s, răspuns sigilat), aplicat tuturor mutațiilor în afară de uploads (`api.js:1739`); `lib/action-ledger.js` (intenții hash-only); `scripts/action-ledger-reconcile.mjs` | **activ și dovedit**: a doua rulare a seed-ului a primit exact aceleași id-uri (`story=9`, `comment=35`) | nimic pentru F0 |
| Abonamentele la canalele Watch | `repo.js:4869` | **bani zero**: doar stare de abonare + mod de notificare | nu face parte din monetizare |
| Recompensele de nod | `GET /api/node/status` (`api.js:2760`) | **oprite**: `rewards.enabled=false`, `funded_pool_cents=0` | decizie separată, nu în F0 |

Concluzia inventarului: **F1 nu pornește de la zero și nu are voie să inventeze un al doilea registru.**
Registrul de intenții există; F1 îi adaugă partea de **decontare** (settlement) și **solduri**, cu
constrângeri în schemă, nu doar în cod.


## 3. Modelul de produs (decizia F0)

### 3.1 Cele două produse

* **`tip`** — o singură plată, fără interval (`interval_days = null`). Eticheta în app: „Trimite o
  susținere”. Nu se afișează ca abonament și nu creează drepturi recurente.
* **`membership`** — o singură plată **pe interval** (1–366 zile), fără reînnoire automată în F1/F2.
  Eticheta: „Membru · N zile”. Reînnoirea automată e o întrebare deschisă (`MONETIZATION-RISKS.md` #4), nu
  o funcție.

Ambele sunt **produse ale creatorului**, nu ale platformei: creatorul alege titlul și prețul, platforma
aplică split-ul versionat. Un produs nu se editează după ce are intenții — se creează altul și cel vechi se
arhivează (F1), ca un receipt vechi să rămână adevărat.

### 3.2 Cine poate primi și cine poate trimite

| Regulă | Unde e deja | Notă |
|---|---|---|
| creatorul trebuie să fie `HUMAN_ORGANIC`, activ, cu profil `social` | `repo.js:5312`, `repo.js:5321` | traficul sintetic nu are catalog |
| suportatorul nu poate fi creatorul | `repo.js:5331`, plus `CHECK (supporter_id <> creator_id)` | self-tip imposibil și la nivel de schemă |
| blocările în ambele sensuri opresc susținerea | `repo.js:5321`, `repo.js:5331` | consecvent cu relațiile |
| suportator sau creator sintetic → `excluded_synthetic`, `gross_cents = 0` | `repo.js:5334` | zero efect economic, dar intenția rămâne auditată |

### 3.3 Ce se vede înainte de confirmare

Un singur ecran, patru rânduri, toate din payload (niciun calcul în client):

1. **cui** — handle, nume, avatar;
2. **ce** — titlul produsului și tipul (`tip` / `membership N zile`);
3. **cât** — prețul în **JBc** (tokenul `JUNGLE`, zecimale 2, simbol afișat `JB`), cu marcajul „demonstrativ, fără bani reali”;
4. **împărțirea** — creator 90% / platformă 5% / rezervă 3% / infrastructură 2% pentru `tip`, respectiv
   85/10/3/2 pentru `membership`, exact cum vine în intent.

Clientul **nu** are voie să calculeze split-ul, să rotunjească prețul sau să afișeze altă monedă decât cea
din răspuns. Dacă serverul nu trimite un câmp, ecranul îl lasă gol și spune de ce (§5.2).

### 3.4 Ce se vede după confirmare

Receipt-ul intenției: `id`, `status`, `currency`, sumele pe bucket-uri, `commitment` (hash) și data. Pentru
`demo_unpaid` se scrie explicit „demonstrativ, nu s-a mișcat niciun ban”; pentru `excluded_synthetic`,
„exclus din totaluri (trafic de test)”. Adresa de wallet a suportatorului nu se arată creatorului și nici
invers.


### 3.5 Tokenul, unitatea și prețurile (decizia de test)

**Nume:** Jungle. **Simbol afișat în aplicație:** `JB`. **ESDT pe MultiversX devnet.**

Ticker-ul ESDT nu poate fi `JB`. Sursa protocolului confirmă limitele: în
`mx-chain-go/vm/systemSmartContracts/esdt.go` stau `minLengthForTickerName = 3` și
`maxLengthForTickerName = 10`, deci `JB` (2 caractere) este respins, iar `JUNGLE` (6) este valid.
Alfabetul acceptat (alfanumeric, majuscule) se confirmă la emitere, când devnet-ul acceptă sau respinge
tranzacția `issue`. `JBK` rămâne rezerva dacă `JUNGLE` e deja ocupat pe devnet. Ticker-ul este o chestiune
de rețea; `JB` rămâne doar eticheta din interfață, ca la orice token cu simbol scurt afișat.

**Zecimale:** 2, deci unitatea întreagă minimă este **1 JBc = 0,01 JB**. Registrul ține doar întregi în
JBc; nu există float nicăieri în lanțul de calcul.

**Valoare de referință:** `reference_eur_per_jb = 1.00`, **doar pentru test**, parametru configurabil.
Nu este o ancorare, nu este o promisiune de răscumpărare și nu se afișează ca „1 JB = 1 €” în
interfață; ecranul arată JBc, iar echivalentul în euro apare doar în documente și în simulări.

**Prețuri mici pe acțiune** (JBc):

| Presetare | Apreciere | Comentariu | Distribuire |
|---|---:|---:|---:|
| Prietenos | 2 | 3 | 3 |
| Premium | 3 | 5 | 5 |

Tot ce nu e marcat rămâne **gratuit** și nu atinge registrul: aprecierea, comentariul și distribuirea
sunt gratuite prin definiție, iar prețul se aplică numai când creatorul a pornit explicit un produs
plătit. Un profil fără produs nu poate primi bani, iar clientul nu afișează niciun preț inventat.

#### 3.5.1 Împărțirea, verificată pe cele două prețuri mici

Split-urile versionate există deja în backend (`CORE_TIP_V1_90_5_3_2` =
creator 90% / platformă 5% / rezervă 3% / infrastructură 2%, `CORE_MEMBERSHIP_V1_85_10_3_2` =
85/10/3/2). Ambele lasă creatorului peste 50%, deci invariantul (a) este îndeplinit, iar sumele se
rotunjesc în JBc cu restul la infrastructură (niciodată la creator, niciodată pierdut):

| Preț | Split | Creator | Platformă | Rezervă | Infra | Total |
|---:|---|---:|---:|---:|---:|---:|
| 2 JBc | 90/5/3/2 | 1,80 | 0,10 | 0,06 | 0,04 | 2,00 |
| 3 JBc | 90/5/3/2 | 2,70 | 0,15 | 0,09 | 0,06 | 3,00 |
| 5 JBc | 85/10/3/2 | 4,25 | 0,50 | 0,15 | 0,10 | 5,00 |

#### 3.5.2 Costul real al unei tranzacții (citit de pe devnet, nu presupus)

`tools/monetization/simulate.mjs` citește `GET https://devnet-api.multiversx.com/network/config` și ia
cursul EGLD/EUR **ca parametru** (`--egld-eur`). Pe 17 octombrie 2026 devnetul răspundea:

| Parametru | Valoare devnet |
|---|---|
| `erd_chain_id` | `D` |
| `erd_min_gas_limit` | 50 000 |
| `erd_min_gas_price` | 1 000 000 000 wei |
| `erd_gas_per_data_byte` | 1 500 |
| `erd_gas_price_modifier` | 0,01 |

Costul unei plăți: `gas limit × gas price`. Cu limitele rezervate de un worker de decontare
(70 000 gaz pentru EGLD, 250 000 pentru ESDT), la **1 EGLD = 30 EUR** (curs ales doar pentru tabel,
nu hardcodat în cod):

| Plată | Cost |
|---|---:|
| EGLD, 70 000 gaz | 0,000070 EGLD = 0,0021 EUR |
| ESDT, 250 000 gaz | 0,000250 EGLD = 0,0075 EUR |

#### 3.5.3 Per acțiune față de lot: de ce decontarea nu poate fi individuală

Tabelul de mai jos este ieșirea reală a simulatorului (`--egld-eur 30`), pentru decontare în EGLD.
„În felia de 2%” înseamnă că costul rețelei încape în procentul de infrastructură din split, adică
prețul acoperă tranzacția fără să atingă partea creatorului.

| Preț | Mod | Acțiuni / tx | Cost / acțiune | Din venit | Creator (JBc) | Creator după cost | În felia de 2% |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | :---: |
| 2 JBc | per acțiune | 1 | 0,002100 € | 10,50% | 1,80 | 0,015900 € | **nu** |
| 2 JBc | lot de 10 | 10 | 0,000210 € | 1,05% | 1,80 | 0,017790 € | da |
| 2 JBc | lot de 100 | 100 | 0,000021 € | 0,10% | 1,80 | 0,017979 € | da |
| 3 JBc | per acțiune | 1 | 0,002100 € | 7,00% | 2,70 | 0,024900 € | **nu** |
| 3 JBc | lot de 10 | 10 | 0,000210 € | 0,70% | 2,70 | 0,026790 € | da |
| 3 JBc | lot de 100 | 100 | 0,000021 € | 0,07% | 2,70 | 0,026979 € | da |

Pentru decontare în **ESDT** costul per tranzacție este 3,6× mai mare (0,0075 EUR), deci lotul de 10
**nu** mai încape la 2 JBc (3,75% din venit); lotul minim devine **100**. Concluzia de produs: plățile
către creatori se grupează, iar pragul de retragere există pentru că fiecare retragere este o
tranzacție.

**Praguri calculate** (aceleași condiții):

* lot minim pentru felia de 2%: **6 acțiuni** la 2 JBc, **4 acțiuni** la 3 JBc (EGLD);
* prag minim de retragere, ca o plată să coste cel mult 1% din sumă: **21 JBc**;
* preț minim al unei acțiuni cu lot de 1000: **1 JBc**, deci 2 JBc are marjă;
* costul **nu** include rent-ul de stocare al conturilor noi și nici rezerva de gaz a unui contract de
  plată; ambele se adaugă la felia de 2% înainte de F1.

#### 3.5.4 Ce devin invarianți (alături de I1–I8)

| # | Invariant | Cum se testează |
|---|---|---|
| I9 | creatorul primește **minim 50%** din fiecare plată, pentru orice preț și orice split acceptat | test de proprietate peste prețuri 1…1000 JBc × ambele split-uri; verifică `creator / gross >= 0.5` |
| I10 | prețul acoperă costul real al decontării, amortizat prin lot | pentru fiecare produs creat: `price_cents >= ceil(cost_per_action / 0,02)` cu costul citit din config-ul rețelei |
| I11 | platforma **refuză** un preț care încalcă I9 sau I10 | `POST` cu preț 1 JBc → `400` cu motivul exact; produsul nu se creează |


## 4. F1 — backend

### 4.1 Tabele noi (aditive, forward-only)

| Tabel | Coloane esențiale | Constrângeri |
|---|---|---|
| `ledger_accounts` | `id`, `owner_kind` (`user`, `platform`, `reserve`, `infra`), `owner_id`, `currency`, `created_at` | unic pe (`owner_kind`, `owner_id`, `currency`) |
| `ledger_entries` | `id`, `settlement_id`, `account_id`, `direction` (`debit`, `credit`), `amount_cents`, `created_at` | `amount_cents > 0`; scriere numai prin funcția de postare |
| `support_settlements` | `id`, `intent_id` (unic), `status` (`posted`, `refunded`, `reversed`), `posted_at` | un singur settlement per intenție |
| `payout_requests` | `id`, `creator_id`, `amount_cents`, `status` (`requested`, `approved`, `paid`, `rejected`), `decided_by`, `decided_at` | `amount_cents > 0`, `amount_cents <= sold disponibil` |

Nicio coloană nu are voie să conțină email, handle sau adresă de wallet: registrul ține id-uri și sume.
Identitatea stă în `users`, nu în ledger.

### 4.2 Invarianți — fiecare devine un test care pică zgomotos

| # | Invariant | Cum se testează |
|---|---|---|
| I1 | `gross = creator + fee + rezervă + infra` pentru fiecare intenție | deja `CHECK` în schemă; testul reia cazul prin API |
| I2 | un settlement postează tot atâtea debitări câte creditări, cu sume egale | două apeluri ale funcției de postare; al doilea refuză |
| I3 | niciun sold nu devine negativ | payout peste disponibil → `409`, soldul neschimbat |
| I4 | refundarea/reversarea se face o singură dată, cu intrări compensatorii, suma totală zero | două refundări pe același intent → a doua `409` |
| I5 | totalurile din panoul creator = suma intrărilor pentru aceleași intenții | reconciliere care iese cu cod 1 la diferență |
| I6 | replay-ul aceleiași cereri nu creează al doilea settlement | același `Idempotency-Key` de două ori → același răspuns, un singur rând |
| I7 | `demo_unpaid` și `excluded_synthetic` nu intră în totaluri, solduri sau payout | totalurile rămân 0 după 10 intenții demo |
| I8 | fiecare intrare are `settlement_id` și `account_id` existente | ștergerea unui cont cu intrări e refuzată |

### 4.3 Rute F1 (toate autentificate; mutațiile au `Idempotency-Key`)

| Metodă | Rută | Răspuns | Notă |
|---|---|---|---|
| `POST` | `/api/creator/support-intents/:id/settle` | `201 { settlement }` | numai cu `NEXUS_SETTLE_DEMO=1`; altfel `409 SETTLEMENT_DISABLED` |
| `POST` | `/api/creator/support-intents/:id/refund` | `201 { settlement, reversed }` | o singură dată, motiv obligatoriu |
| `GET` | `/api/creator/ledger` | `{ accounts, entries, totals }` | doar proprietarul; fără date personale |
| `POST` | `/api/creator/payouts` | `201 { payout }` | sumă ≤ disponibil; fără bani reali |
| `GET` | `/api/creator/payouts` | `{ payouts }` | istoric |

`real_payment: false` și `real_settlements: 0` rămân în fiecare răspuns până când `MONETIZATION-RISKS.md`
#1–#5 au răspuns.

### 4.4 Migrare

Aditivă, idempotentă (`CREATE TABLE IF NOT EXISTS`), fără backfill: intențiile existente rămân
`demo_unpaid` și nu se „decontă” retroactiv. Migrarea nu atinge `users`, `pay_*` sau `creator_support_*`.


## 5. F2 — aplicația

### 5.1 Suprafețe

| Ecran | Intrare | Conținut | Stare |
|---|---|---|---|
| Foaia de susținere | meniul `⋯` al profilului → „Susține” (apare doar când catalogul are produse) | produsele, prețul, împărțirea, butonul de confirmare | **neconstruit** (lotul „meniul de profil” + F2) |
| Confirmarea | după `POST /api/creator/support-intents` | receipt-ul, `status`, „demonstrativ” | neconstruit |
| Panoul creatorului | profil propriu → „Susțineri” | produse, primite, totaluri (0 până la settlements) | neconstruit |
| Istoricul plăților | meniul `⋯` → „Plăți” | `GET /api/pay/history`, direcție, `real_settlements: 0` | neconstruit |

### 5.2 Reguli de client (aceleași ca în restul aplicației)

1. Prețul și split-ul se afișează **exact** cum vin; clientul nu calculează bani.
2. Un buton care cheltuiește cere confirmare explicită și arată moneda; dublul tap e blocat de starea
   `busy`, nu de un timeout.
3. Orice `4xx` are text românesc și un motiv: `409 SETTLEMENT_DISABLED`, `409 PAYOUT_EXCEEDS_BALANCE`,
   `403` pentru cont sintetic, `404` pentru catalog indisponibil.
4. Fără câmpuri de card, fără QR, fără semnare pe telefon: cheile nu ajung niciodată în app.
5. Zecimalele vin din monedă (6 pentru `TEST-USDC`, 18 pentru `EGLD`), nu se formatează „ca leul”.

### 5.3 Ce **nu** intră în F2

Reînnoire automată, notificări de plată, split editabil, multi-monetă, transfer către alți utilizatori din
ecranul de susținere, payout declanșat din telefon.

## 6. Ordinea și porțile

```
F0 (acest document) -> aprobarea owner-ului pe RISKS #1-#5 -> F1 (backend + teste) -> F2 (ecrane)
```

* **F0** se încheie când proprietarul a citit §3 și a răspuns la primele cinci întrebări.
* **F1** se încheie când I1–I8 sunt teste verzi și `scripts/action-ledger-reconcile.mjs` iese 0.
* **F2** se încheie când cele patru suprafețe sunt pe telefon, cu capturi, și niciun ecran nu afișează o
  sumă care nu vine din payload.

## 7. Ce rămâne explicit în afara scopului

Like-uri plătite (interzise de server prin `likes_paid: false`, `api.js:2715`), venit din trafic sintetic,
payout real, abonamente cu reînnoire automată, economie pentru conținut adult, cumpărare prin magazinele de
aplicații. Fiecare cere o decizie care nu există încă — vezi `docs/MONETIZATION-RISKS.md`.

