# Monetizare — riscuri și întrebări deschise (F0, 17 octombrie 2026)

Acest document **nu hotărăște nimic**. Fiecare rând este o întrebare la care doar proprietarul (împreună cu
un jurist sau cu un contabil, unde e cazul) poate răspunde. Până la răspuns, ce se blochează rămâne blocat,
chiar dacă serverul ar putea executa codul.

Regula de lucru: o întrebare se închide doar printr-o linie scrisă aici („Răspuns: … — data — cine”), nu
printr-o deducție din cod. Un răspuns parțial se notează ca atare.

## 1. Întrebări

| # | Întrebare | Ce se blochează cât timp nu are răspuns | Cine poate decide |
|---|---|---|---|
| 1 | **Ce monedă este cea reală?** `EGLD` nativ, un ESDT stabil, `TEST-USDC` doar demonstrativ, sau fiat prin xMoney? | F1 (settlement) și orice sumă afișată ca „reală”; azi totul e `TEST-USDC` cu `real_payment: false` | proprietarul + contabil |
| 2 | **Cine ține cheile la decontare?** Transfer direct din wallet-ul suportatorului în cel al creatorului (non-custodial), sau un cont al platformei care adună și apoi plătește? | modelul de ledger (conturi proprii vs. trecere), politica de refund și cerințele de securitate | proprietarul |
| 3 | **Ce se întâmplă fiscal** când un creator primește bani: TVA pe membership, impozit pe venit, factură emisă de cine? | textul din ecranul de confirmare, datele păstrate pe receipt, raportarea | contabil + jurist |
| 4 | **Rambursări și reînnoiri**: există drept de retragere, în ce fereastră, cine suportă costul? Membership-ul se reînnoiește automat sau nu? | F2 (butoane, copy), F1 (`refund`), politica de dispute | proprietarul + jurist |
| 5 | **Conturile de minori** pot trimite sau primi susțineri? Ce înseamnă „copil” aici — sub 16, sub 18, alt prag? | catalogul (cine apare), plățile, textele; serverul are deja un marcaj de confidențialitate pentru aceste conturi (`privacy: "CHILD_TENANT_…"`, `api.js:1615`) | proprietarul + jurist |
| 6 | **Magazinele de aplicații**: bunurile digitale vândute în aplicația Android necesită facturare in-app (comision de platformă)? Susținerea unui creator intră în categoria aceea? | F2 pe Android; poate însemna că ecranul de plată nu are voie să existe în app | proprietarul + consultanță de platformă |
| 7 | **AML/KYC**: de la ce sumă sau frecvență cerem verificare, în ce jurisdicții, cu ce furnizor? | payout real (F1 ruta `payouts`), pragurile, ce date colectăm | jurist + furnizor de plăți |
| 8 | **Conținut adult și jocuri de noroc** au voie să primească susțineri? Economie separată sau aceleași produse? | catalogul, regulile de vizibilitate, percepția platformei | proprietarul + jurist |
| 9 | **Cine schimbă split-ul** (90/5/3/2, 85/10/3/2), cu ce preaviz și cum se vede schimbarea într-un receipt vechi? | F1 (versionare), textele care arată împărțirea | proprietarul |
| 10 | **Cât păstrăm** receipts, hash-uri și intenții? Hash-only e suficient pentru un audit fiscal? | schema F1, politica de retenție, dreptul la ștergere | jurist + contabil |
| 11 | **Cine execută plata către creator** (rail, provider, monedă, termen) și ce se întâmplă dacă providerul refuză? | `payout_requests` și orice promisiune de tip „banii ajung în N zile” | proprietarul + furnizor |
| 12 | **Abuzul**: self-tip prin conturi multiple, card furat, spălare prin tip-uri mici repetate — ce detectăm în F1 și ce facem cu banii deja mișcați? | regulile anti-abuz, blocările, reversările | proprietarul + risc |
| 13 | **Suportul clienți**: cine răspunde la „am plătit și nu am primit”, în ce termen, cu ce dovadă? | textul de ajutor, SLA-ul, tonul din app | proprietarul |
| 14 | **Legea aplicabilă și jurisdicția** pentru comisionul platformei și pentru relația creator–suportator | termenii, contractul, unde se rezolvă un litigiu | jurist |
| 15 | **Tokenul cu valoare de referință fixă față de euro** (1 JB = 1 EUR, `reference_eur_per_jb`, doar pentru test) intră în categoria jetoanelor ancorate („asset-referenced token”) sau a monedei electronice („e-money token”) în sensul MiCA, chiar dacă nu se emit pe mainnet? Ce înseamnă asta pentru whitepaper, rezervă și autorizare? | orice ieșire din devnet, textul care explică tokenul, emisia ESDT `JUNGLE`, politica de rezervă | jurist + proprietar |
| 16 | **Cine plătește gazul** pentru decontări și retrageri? Propunerea este un portofel de trezorerie al platformei, dar cine îl alimentează, din ce buget, cu ce limită zilnică și ce se întâmplă când se golește? | `payout_requests`, worker-ul de decontare, pragul de retragere, mesajul „indisponibil temporar” | proprietar + contabil |
| 17 | **Ce se întâmplă cu fondurile din soldul intern** dacă un creator își șterge contul, dacă platforma se închide sau dacă tokenul își pierde valoarea de referință? Se răscumpără, se blochează, se donează? | politica de închidere de cont, `refund`, textul din „Despre” | proprietar + jurist |
| 18 | **Custodia soldului fanului** (modul `batched`): banii stau în contul platformei între depunere și decontare. Ce se întâmplă la insolvență, atac, sau dacă platforma se închide cu solduri pozitive? Cine răspunde? | modul `batched`, reconcilierea zilnică, textul din foaia de confirmare, limita de sold | proprietar + jurist + contabil |
| 19 | **Titluri de valoare / MiCA**: feliile `founder` și `shareholders` sunt conturi contabile, dar dacă apar ca promisiune de profit pentru deținătorii de token, intră sub MiCA sau sub legea titlurilor? | ce se scrie în „Cum se împarte o plată”, dacă feliile se pot promite public, emisia JUNGLE | jurist |
| 20 | **Taxe**: TVA pe comision, pe abonament și pe bacșiș; microtaxă; cine emite factura și către cine? | textul din chitanță, datele păstrate, raportarea | contabil + jurist |
| 21 | **KYC/AML la retragerea către persoane**: de la ce sumă, cu ce furnizor, în ce jurisdicție, și ce facem cu soldurile neidentificate? | retragerea creatorului, pragul, datele cerute | jurist + furnizor de plăți |
| 22 | **Structura companiei**: ce entitate deține conturile `platform_fund:*`, cine are drept de semnătură, cum se aprobă o ieșire din fondul fondatorului sau al acționarilor? | orice plată manuală din cele două conturi, auditul, răspunderea | proprietar + jurist |
| 23 | **Ce se întâmplă dacă JUNGLE are piață**: prețul minim este calculat la 1 JUNGLE = 1 € (parametru). Dacă tokenul se tranzacționează altfel, pragul în JUNGLE trebuie recalculat, iar sumele istorice rămân în versiunea lor. | parametrul `NEXUS_EGLD_EUR`/referința, textele care arată prețul, chitanțele vechi | proprietar + contabil |



### 1.1 Răspunsuri provizorii, doar pentru devnet (17 octombrie 2026)

Fiecare rând de mai jos este rostit de proprietar și poartă formula: **„Răspuns: provizoriu devnet, de
revizuit cu un jurist înainte de bani reali, proprietarul, 17 octombrie 2026”**. Niciunul nu închide
întrebarea — o ține deschisă pentru lansare — dar fiecare deblochează lucrul pe devnet, fără bani reali.
Toate presupun `real_payment: false` și niciun transfer pe mainnet.

| # | Răspuns provizoriu (devnet) |
|---|---|
| 1 | Monedă: tokenul de test `JUNGLE` (afișat `JB`), ESDT pe devnet, fără valoare reală. Nu se emite nimic înainte de #15; pe devnet se poate emite pentru teste, cu cheia de test. |
| 2 | Custodie: sold intern **doar pe devnet**; platforma nu ține fonduri reale. Modelul non-custodial rămâne de ales pentru lansare. |
| 3 | Fiscalitate: nu se aplică pe devnet; rămâne deschisă pentru lansare (TVA, impozit, factură). |
| 4 | Rambursări: automate la eroare tehnică sau la conținut eliminat de moderare; fereastra și reînnoirea rămân de decis pentru lansare. |
| 5 | Minori: monetizare doar pentru conturi **18+**, cu verificarea disponibilă pe server; pragul exact și textele rămân la jurist. |
| 15 | MiCA / referință fixă: în interfață nu se face nicio promisiune de valoare; `reference_eur_per_jb = 1` rămâne parametru de test; decizia despre încadrare rămâne deschisă. |
| 16 | Gaz: trezorerie a platformei **pe devnet**, alimentată cu EGLD de devnet; decontarea se face în loturi, iar pragul de retragere acoperă costul lotului. |
| 17 | Sold intern: ledger intern **doar pe devnet**, cu depunere și retragere on-chain de test; politica la închiderea contului rămâne deschisă. |

Ce rămâne complet deschis: #6–#14, plus orice ieșire din devnet, plus emiterea reală a tokenului.

## 2. Ce se face cât timp întrebările sunt deschise

* Serverul rămâne pe **`TEST-USDC`, `real_payment: false`, `real_settlements: 0`**; nicio rută nu semnează,
  nu difuzează și nu cheltuie.
* Tokenul `JUNGLE` (simbol afișat `JB`, 2 zecimale) există doar ca **decizie de test pe devnet**: nu se
  emite niciun ESDT și nu se promite nicio valoare până când #15 nu are răspuns. `reference_eur_per_jb = 1`
  este un parametru de simulare, nu o ancorare.
* Aplicația poate construi suprafețele din F2 **cu date demonstrative**, dar fiecare ecran care atinge o sumă
  poartă marcajul „demonstrativ, fără bani reali” — nu există variantă „discretă”.
* Nicio promisiune de payout, termen sau câștig nu se scrie într-un ecran până când #1, #2, #3, #11 și #14
  nu au răspuns.
* Split-ul și versiunea lui se afișează; dacă un răspuns schimbă split-ul, se schimbă **versiunea**, nu
  numerele de sub un receipt existent.

## 3. Cum se închide o întrebare

Se adaugă sub rândul respectiv (sau în tabel, coloană nouă) o linie de forma:

```
Răspuns: <decizia> — <cine> — <data> — blochează în continuare: <da/nu, ce>
```

Fără această linie, `MONETIZATION-SPEC.md` §6 nu avansează: F0 rămâne deschis, F1 nu începe, iar ecranele
din F2 nu ies din modul demonstrativ.

