# Pragul de preț: formula de azi, eroarea de unitate și ce ar cere 0,02 JUNGLE

> Scris 18 octombrie 2026, ca răspuns la decizia proprietarului: „NU accept 1,05 JUNGLE ca preț minim”.
> Documentul nu schimbă economia; arată cifrele ca să poată fi aleasă.

## 1. Formula de azi, exact

`apps/nexus-web/lib/creator-ledger.js`:

```js
export const SETTLEMENT_SHARE_OF_PRICE = 0.02;                      // I10: costul ≤ 2% din preț
const costFloor = Math.ceil(cost_per_action_cents / SETTLEMENT_SHARE_OF_PRICE);
```

Deci **`floor_cents = ceil(cost_per_action_cents / 0,02)` = 50 × costul pe acțiune**.

Al doilea prag, `creator_floor_cents`, e calculat ca `creatorShare >= 0.5 ? 0 : Math.ceil(0)` — adică
**mereu 0**; regula „creatorul păstrează jumătate” nu mișcă pragul, e verificată separat în
`assertPriceAllowed`. Deci pragul efectiv este doar cel de cost, înmulțit cu 50.

## 2. De unde vine `2,1`

`apps/nexus-web/lib/creator-pricing.js`:

```js
export const DEFAULT_COST_PER_ACTION_CENTS = 2.1;   // „devnet measurement used by the simulator”
export function costPerActionCents(env) { … env.NEXUS_COST_PER_ACTION_CENTS … altfel 2.1 }
```

Valoarea **nu are o măsurătoare înregistrată nicăieri în repo** (nu există tranzacție, hash sau
raport). Ea se potrivește exact cu un transfer ESDT de 500 000 gas la **EGLD = 42 €**:

| mărime | valoare | calcul |
|---|---|---|
| gas price (rețea) | 1 000 000 000 atomic/gas | `erd_min_gas_price` din `/network/config` |
| transfer EGLD simplu | 50 000 gas (+1 500/byte) | 0,00005 EGLD |
| transfer ESDT | 500 000 gas | 0,0005 EGLD |
| 0,0005 EGLD × 42 € | **0,021 € = 2,1 ¢** | de aici 2,1 |

Deci **2,1 ¢ este costul ESDT la EGLD 42 €**, nu la 30 €. La 30 € același transfer costă **1,5 ¢**.
Confuzia nu e de unitate (cent vs euro — ambele sunt cenți), ci de **cursul EGLD presupus** și, mai
important, de **multiplicatorul 50** din regula de 2 %.

Cifrele proprietarului se potrivesc cu altă limită de gas:

| model | gas | cost la 30 €/EGLD |
|---|---|---|
| EGLD cu date (70 000 gas) | 70 000 | **0,21 ¢** — exact cifra proprietarului |
| ESDT la 250 000 gas | 250 000 | **0,75 ¢** — exact cifra proprietarului |

## 3. Modelul cerut: fiecare acțiune plătită = o tranzacție

Parametri (toți configurabili, niciunul îngropat în cod):

- `creator_share_bps` — cât ia creatorul din preț; ținta 6 000 (60 %), minim acceptat 5 000 (50 %).
- `platform_margin_bps` — marja platformei peste gaz; propunere 2 000 (20 % din gaz).
- `gas_per_action_egld` — măsurat pe devnet (vezi mai sus).
- `egld_eur` — cursul, parametru; nu se presupune.

Condiții simultane:

1. **creator ≥ 50 %**: `creator_share_bps ≥ 5000`.
2. **platforma acoperă gazul + marjă**: `(1 − creator_share) × P ≥ gas × (1 + margin)`.

Pragul minim este cel mai mic preț întreg (în cenți) care le respectă pe amândouă:

```
P_min_cents = ceil( gas_€ × (1 + platform_margin) × 100 / (1 − creator_share) )
```

La 60 % creator și marjă 20 %: `P_min = 3 × gas_€` (fiindcă `1,2 / 0,4 = 3`).

### Tabel: pragul la EGLD 10 / 20 / 30 / 50 €

Cost ESDT = 0,0005 EGLD pe acțiune (500 000 gas), o tranzacție per acțiune:

| EGLD (€) | gaz/acțiune (€) | gaz (¢) | **P_min, creator 60 %** | P_min, creator 50 % | P_min, creator 90 % (splitul de azi) |
|---:|---:|---:|---:|---:|---:|
| 10 | 0,005 | 0,5 | **2 ¢ (0,02)** | 2 ¢ | 5 ¢ |
| 20 | 0,010 | 1,0 | **3 ¢ (0,03)** | 3 ¢ | 10 ¢ |
| 30 | 0,015 | 1,5 | **5 ¢ (0,05)** | 4 ¢ | 15 ¢ |
| 50 | 0,025 | 2,5 | **8 ¢ (0,08)** | 6 ¢ | 25 ¢ |

Aceleași cifre cu 250 000 gas (cifra simulatorului proprietarului):

| EGLD (€) | gaz (¢) | **P_min, creator 60 %** | creator 50 % |
|---:|---:|---:|---:|
| 10 | 0,25 | **1 ¢** | 1 ¢ |
| 20 | 0,50 | **2 ¢** | 2 ¢ |
| 30 | 0,75 | **3 ¢ (0,03)** | 2 ¢ |
| 50 | 1,25 | **4 ¢** | 3 ¢ |

### Ce înseamnă pentru 0,02 și 0,03

- **0,02 JUNGLE cu 60 % creator** iese doar dacă gazul pe acțiune ≤ 0,67 ¢, adică EGLD ≤ ~13 € la
  500 000 gas, sau EGLD ≤ ~27 € la 250 000 gas.
- **0,03 JUNGLE cu 60 % creator** iese până la EGLD ~20 € (500 000 gas) sau ~40 € (250 000 gas).
- La 30 €/EGLD și 500 000 gas, **0,02 nu iese**: platforma ar primi 0,8 ¢ și ar plăti 1,5 ¢ de gaz —
  pierdere de 0,7 ¢ pe fiecare like. La 0,03 pierderea e 0,3 ¢. Deci, dacă măsurătoarea dă 500 000
  gas și EGLD e 30 €, **prețurile de 2–3 bănuți nu sunt sustenabile într-o tranzacție per acțiune**.
- Singura cale care face 0,02–0,03 sustenabile la orice curs este **agregarea**: mai multe acțiuni
  într-o singură decontare (un transfer către un contract care împarte, sau acumulare off-chain cu
  decontare periodică). Cu N acțiuni per tranzacție, gazul pe acțiune scade de N ori: la N = 10 și
  30 €/EGLD, P_min devine 0,5 ¢ și 0,02 e confortabil.


## 4. Ce trebuie schimbat în cod (nu s-a schimbat încă)

1. `SETTLEMENT_SHARE_OF_PRICE = 0.02` (regula „gazul ≤ 2 % din preț”, care umflă pragul de 50 de ori)
   se înlocuiește cu cele două condiții de la §3; `priceFloorCents` întoarce
   `{ gas_floor_cents, creator_floor_cents, floor_cents }`, cu motivul fiecăruia.
2. `DEFAULT_COST_PER_ACTION_CENTS` dispare ca număr magic: costul se calculează din
   `gas_per_action × egld_eur`, ambele parametri de mediu, iar valoarea măsurată pe devnet se scrie
   în `HANDOFF.md` cu hash-ul tranzacției.
3. `creator_support_products.price_cents` are azi `CHECK(price_cents BETWEEN 100 AND 100000000)` —
   **nimic sub 1,00 nu poate fi stocat**. Ca să încapă 0,02 e nevoie de o migrare care reconstruiește
   tabelul cu `BETWEEN 1 AND 100000000` (copiere de rânduri, fără pierderi, cu teste pe un fișier
   existent).
4. Splitul 90/5/3/2 devine `creator_share_bps` + „restul platformei”, fără felii separate.

## 5. Ce cer proprietarului

1. **Cursul de referință** pentru EGLD (10/20/30/50 €) și dacă 1 JUNGLE se tratează ca 1 € până are
   piață. Fără asta, pragul nu poate fi calculat corect.
2. **Creator 60 % sau 50 %** — cu 60 % pragul e cu 20 % mai mare.
3. **O tranzacție per acțiune sau agregare** — numai agregarea face 0,02–0,03 sustenabil la 30 €.
4. Acceptarea migrării `price_cents` (nimic sub 1,00 nu poate fi stocat azi).

| ESDT la 500 000 gas (protocol) | 500 000 | 1,5 ¢ |

Deci simulatorul proprietarului a folosit 250 000 gas pentru ESDT, jumătate din limita de protocol.
Cifra reală se stabilește **numai printr-un transfer ESDT pe devnet**, citind `gasUsed` — nu prin
presupuneri. Până atunci, calculele de mai jos folosesc **500 000 gas (conservator)**.
