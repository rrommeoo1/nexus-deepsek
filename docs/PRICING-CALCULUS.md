# Prețul minim, politica de împărțire v3 și decontarea în loturi

> Actualizat 18 octombrie 2026, după decizia proprietarului: feliile în puncte de bază, creatorul
> primește minim 60 % (țintă 70 %), rezerva de infrastructură acoperă gazul, iar prețul minim se
> recalculează din parametri, nu se memorează. Toate cifrele de aici sunt produse de
> `tools/monetization/floor-table.mjs` și verificate de `test/split-policy.test.js`; niciuna nu e
> scrisă de mână.

## 1. Politica v3 (`SPLIT_V3_70_5_4_4_1`)

Feliile sunt în puncte de bază din prețul unei acțiuni plătite:

| Felie | Cont | Implicit | Rol |
|---|---|---:|---|
| `creator` | `creator:<id>:JUNGLE` | **7000** | banii creatorului |
| `network_fund` | `platform_fund:network:JUNGLE` | 500 | fondul rețelei |
| `founder` | `platform_fund:founder:JUNGLE` | 400 | cont contabil al companiei |
| `shareholders` | `platform_fund:shareholders:JUNGLE` | 400 | cont contabil al companiei |
| `burn` | `platform_fund:burn:JUNGLE` | 100 | ardere |
| `infra` | `platform_fund:infra:JUNGLE` | **restul** (~1600) | acoperă gazul |

`founder` și `shareholders` sunt **conturi contabile interne**, nu persoane și nu deținători de token.
Nicio funcție din acest modul nu transferă către o persoană: împarte un număr întreg de cenți. Orice
ieșire din aceste conturi este o decizie manuală, înregistrată, în afara codului de față.

Invarianți, verificați pentru fiecare preț (`checkSplit`):

1. **Conservare exactă**: suma feliilor = brutul, la cent. Fiecare felie se rotunjește în jos, iar
   **tot restul, inclusiv rotunjirile, merge la `infra`**. Creatorul are însă un drept de minim: dacă
   rotunjirea l-ar coborî sub 60 % (la 4 bani, 70 % ar da 2 bani = 50 %), diferența se ia din `infra`,
   nu din buzunarul lui. De aceea 0,04 este un preț valid, iar 0,03 rămâne minimul.
2. **Creator ≥ 60 %** (`min_creator_bps = 6000`); politica țintește 7000. La prețuri mici rotunjirea în
   jos poate coborî sub 60 %, iar atunci prețul e refuzat — de aici vine pragul de 3 bani.
3. **Feliile fixe ne-creator ≤ 20 %** (`max_fixed_bps = 2000`); implicit sunt 1400.
4. **`infra` acoperă gazul acțiunii** la lotul configurat, cu marjă (`infra_margin_bps`, implicit 2000).
5. **Nicio felie negativă.**

## 2. Cum se calculează prețul minim

Formula veche (`cost / 0,02`, adică de 50 de ori costul) și al doilea prag care întorcea mereu 0 au
fost **scoase**. Prețul minim este cel mai mic întreg de cenți care respectă simultan invarianții 1–5:

```
gaz_pe_acțiune (EGLD) = (gaz_decontare + gaz_ancorare) / N        (modul batched)
                      = gaz_transfer_ESDT                         (modul per_action)
cost_gaz (cenți)      = ceil( gaz_pe_acțiune × EGLD_EUR × 100 × (1 + marjă) )
P_min                 = min { P întreg ≥ 1 : checkSplit(P, cost_gaz).ok }
```

Nu are formă închisă din două motive: rotunjirea în jos a fiecărei felii și regula creatorului fac
funcția scară, nu liniară. Modulul caută crescător de la 1 cent și se oprește la primul preț valid —
deci „prețul minim” este prin construcție cel mai mic, nu o aproximare.

Parametri (toți din mediu, niciunul îngropat în cod):

| Parametru | Variabilă | Implicit |
|---|---|---|
| curs EGLD/EUR | `NEXUS_EGLD_EUR` | **30** |
| mod decontare | `NEXUS_SETTLEMENT_MODE` | `batched` |
| lot N | `NEXUS_BATCH_SIZE` | 10 |
| gaz decontare (ESDT) | `NEXUS_SETTLEMENT_GAS_LIMIT` | 500 000 |
| gaz ancorare | `NEXUS_ANCHOR_GAS_LIMIT` | 150 000 |

## 3. Tabelul prețului minim

Gaz decontare 500 000, gaz ancorare 150 000, marjă 20 %, creator minim 60 %. Valoarea din celulă este
**P_min în JUNGLE** (2 zecimale), produsă de `node tools/monetization/floor-table.mjs`:

| EGLD (€) | N = 1 | N = 10 | N = 20 | N = 50 |
|---:|---:|---:|---:|---:|
| 10 | 0,03 | 0,03 | 0,03 | 0,03 |
| 20 | 0,05 | 0,03 | 0,03 | 0,03 |
| 30 | 0,08 | 0,03 | 0,03 | 0,03 |
| 50 | 0,11 | 0,03 | 0,03 | 0,03 |

Ce spune tabelul, pe scurt:

- **Lotul este pârghia, nu cursul.** La N ≥ 10 prețul minim este 0,03 oriunde între 10 și 50 €/EGLD,
  fiindcă gazul pe acțiune scade sub un cent și rămâne doar regula creatorului.
- **O tranzacție per acțiune** (N = 1, modul `per_action`) urcă pragul cu cursul: 0,03 la 10 €, 0,05 la
  20 €, 0,08 la 30 €, 0,11 la 50 €. Aici 0,02 nu iese niciodată, iar 0,03 iese doar la 10 €/EGLD.
- **0,02 nu este atins niciodată**: la 2 bani, creatorul are drept de minim 2 bani (60 % rotunjit în
  sus), deci pentru infrastructură nu rămâne nimic — iar infrastructura trebuie să acopere cel puțin un
  cent de gaz. 0,03 este prin urmare pragul absolut al politicii v3: 2 bani creatorului, 1 ban gazului.
  Ca să coboare la 0,02 ar trebui schimbate **două** lucruri deodată: `min_creator_bps` sub 5000 și o
  marjă de infrastructură care să accepte zero. Nu am făcut niciuna; rămâne o decizie a
  proprietarului, scrisă în docs, nu o constantă în cod.

Gazul din tabel este **limită de protocol**, nu măsurătoare proprie (vezi §6). La 250 000 gas pentru
decontare și același N, celula N = 1 scade cu ~40 % (0,02 la 10 €, 0,03 la 20 €, 0,05 la 30 €,
0,07 la 50 €). Diferența dintre cele două scenarii este exact motivul pentru care cifra reală trebuie
măsurată înainte de a promite ceva.

## 4. Modurile de decontare

**`batched` (implicit).** Fanul depune JUNGLE într-un sold on-chain (o tranzacție reală, plătită de el),
fiecare acțiune plătită îi debitează soldul imediat după confirmare, iar la fiecare lot (N acțiuni sau
T minute) se face **o** decontare către creator, plus **o** ancorare a rădăcinii Merkle a chitanțelor.
Gazul pe acțiune este `(decontare + ancorare) / N`.

**`per_action`.** Fiecare acțiune plătită este propria tranzacție către creator. Este simplu de
auditat, dar costă de N ori mai mult și urcă pragul cu cursul EGLD. Se activează doar dacă prețul ales
de creator acoperă pragul calculat pentru acest mod; serverul refuză configurația care nu îl acoperă.

Costuri și riscuri, comparație:

| | `batched` | `per_action` |
|---|---|---|
| tranzacții pentru 1 000 de acțiuni | ~100 decontări + 100 ancorări + depuneri | 1 000 |
| gaz pe acțiune la N=10 | 65 000 | 500 000 |
| preț minim la 30 €/EGLD | 0,03 | 0,08 |
| întârziere până la creator | până la T minute | imediat |
| risc principal | soldul fanului ținut de platformă până la decontare | cost pe fiecare like, fragmentare |
| ancorare | o rădăcină Merkle per lot | chitanță per tranzacție |

## 5. Migrarea `price_cents`

`creator_support_products.price_cents` are azi `CHECK(price_cents BETWEEN 100 AND 100000000)`, deci
**nimic sub 1,00 JUNGLE nu poate fi stocat**. Migrarea `migrateCreatorProductPriceFloor` (§
`apps/nexus-web/lib/db.js`) reconstruiește tabelul cu `BETWEEN 1 AND 100000000`, copiază toate
rândurile, reface indecșii și rulează `PRAGMA foreign_key_check` înainte de commit. Testul o aplică pe
o **copie** a unei baze vechi, cu rânduri la ambele capete (100 și 100000000), și verifică faptul că
niciun rând nu s-a pierdut și că 1 cent este acceptat după migrare.

## 6. Starea măsurătorii (18 octombrie 2026)

Cele cinci conturi de devnet din `docs/.test-wallets.local` au **0 EGLD și niciun token**
(`tools/probe-devnet-balances.mjs`). Nu există EGLD pentru o tranzacție de test și nici token JUNGLE
emis, deci:

- gazul de 500 000 / 150 000 este **limită de protocol**, nu măsurătoare;
- prețurile din §3 se recalculează cu cifra reală imediat după alimentarea conturilor;
- fluxul real (depunere → plată → decontare → ancorare → verificare) nu poate rula încă.

Până atunci aplicația folosește un **adaptor de lanț simulat**, marcat ca atât, iar pe Railway
acțiunile plătite afișează „Plățile pe blockchain nu sunt încă active”.

| gaz per acțiune (modul `per_action`) | `NEXUS_PER_ACTION_GAS_LIMIT` | 500 000 |
| marjă infrastructură | `NEXUS_INFRA_MARGIN_BPS` | 2000 |


## 7. Modelul de autofinanțare (`tools/monetization/self-funding.mjs`)

Modelul are nevoie de **prețuri reale** ca să spună ceva; ce nu i se dă rămâne „de completat”, nu zero
ascuns. Costurile fixe (Railway, domeniu, moderare) și cele variabile (stocare/GB, trafic/GB, procesare
video/minut) sunt parametri; veniturile sunt doar cele pe care aplicația le poate produce — acțiuni
plătite, abonamente la profil privat, postări plătite, bacșișuri, boost plătit de creator. Fără publicitate.

Prețurile de cost **nu sunt inventate aici**: în repo nu există factura Railway, tariful de stocare sau
cel de procesare video, deci fiecare rând de cost lipsă apare în listă și marchează scenariul „nu” la
coloana „Sliced?”. Rezultatul de mai jos folosește doar două cifre date explicit (Railway 20 €/lună,
domeniu 1 €/lună) și arată de ce modelul trebuie completat înainte de a fi crezut.

### 7.1 Rezultatul la prețul minim (0,03 JUNGLE)

La 0,03, fiecare acțiune dă creatorului 2 bani și infrastructurii 1 ban — exact gazul unei acțiuni în
lot. **Marja platformei la prag este zero**: nu rămâne nimic pentru Railway, moderare sau stocare.
Consecința, verificată de `test/self-funding.test.js`: la 0,03 pragul de rentabilitate **nu există**
(niciun venit pe utilizator după gaz), oricâți utilizatori ar fi. Venitul platformei începe la 0,04.

### 7.2 Rezultatul la 0,05 JUNGLE, 3 acțiuni plătite/zi/fan

Costuri date: Railway 20 €, domeniu 1 €; restul „de completat”. 30 de zile, feliile v3 aplicate pe
fiecare încasare:

| Utilizatori activi | Profiluri cu plată | Venit brut | Creator | Platformă | Costuri (fix + gaz) | Profit |
|---:|---:|---:|---:|---:|---:|---:|
| 1 000 | 2 % | 90,00 € | 54,00 € | 36,00 € | 39,00 € | **−3,00 €** |
| 1 000 | 5 % | 225,00 € | 135,00 € | 90,00 € | 66,00 € | **+24,00 €** |
| 1 000 | 10 % | 450,00 € | 270,00 € | 180,00 € | 111,00 € | **+69,00 €** |
| 10 000 | 2 % | 900,00 € | 540,00 € | 360,00 € | 201,00 € | **+159,00 €** |
| 10 000 | 5 % | 2 250,00 € | 1 350,00 € | 900,00 € | 471,00 € | **+429,00 €** |
| 100 000 | 2 % | 9 000,00 € | 5 400,00 € | 3 600,00 € | 1 821,00 € | **+1 779,00 €** |

Prag de rentabilitate la acest mix: **1 167 utilizatori activi** (cu 5 % profiluri cu plată). Toate
cifrele presupun 3 acțiuni plătite pe zi **per fan plătitor**, nu per utilizator.

### 7.3 Ce nu este în tabel

- **Profilurile gratuite generează cost fără venit.** Stocarea, traficul și procesarea video pentru
  utilizatorii care nu plătesc nimic sunt în costul variabil, dar nu au nicio linie de venit. Măsurile
  din aplicație care țin costul jos: limita de durată a clipului, compresia la înregistrare,
  re-encodarea la afișare și fișierele demo mici din teste.
- **Costurile lipsă nu apar.** Dacă `storage-eur-per-gb-month`, `traffic-eur-per-gb` și
  `video-eur-per-minute` nu sunt date, profitul din tabel este un maxim, nu o previziune.
- **Gazul este estimat** la 1 ban/acțiune (lot de 10, EGLD 30 €); la 50 €/EGLD devine 2 bani și 0,03 nu
  mai acoperă nici gazul.

## 8. Ce rămâne de făcut, explicit

1. **Conturile ledger separate** pentru `network_fund`, `founder`, `shareholders` și `burn`:
   `ledger_accounts.owner_kind` are azi numai `user/platform/reserve/infra`, iar
   `support_settlements` are patru coloane. Până la o migrare aditivă, cele trei conturi de companie
   sunt stocate împreună în `reserve`, iar banii se pot reconstitui din `split_version` (documentat în
   `splitForStorage`). Nicio sumă nu se pierde; granularitatea raportării este ce lipsește.
2. **Ancorarea Merkle** într-o tranzacție: modulul de lot există în specificație (§8.4), dar nu are
   încă un loc în schemă pentru rădăcină și numărul de chitanțe.
3. **Măsurătoarea reală a gazului**: cele cinci conturi de devnet au 0 EGLD, deci cifrele rămân limite
   de protocol.
