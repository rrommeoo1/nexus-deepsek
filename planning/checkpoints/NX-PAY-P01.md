# Checkpoint — NX-PAY-P01

## Identitate

- Task: `NX-PAY-P01` — One stablecoin transfer to a username on devnet
- Owner: `A21`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Rezultat verificabil

Doi utilizatori sintetici rezolvă un username într-un receipt semnat, cu durată
scurtă, confirmă exact wallet/network/token/decimals/amount și parcurg un transfer
test-ESDT cu finalitate distinctă. Adaptorul xMoney rămâne local și demonstrează
idempotency și reconcilierea webhook-urilor fără cont, credențiale, rețea externă,
bani reali sau acceptarea unor termeni.

## Implementare

- contract exact-shape pentru policy, capability, alias și `ResolutionReceipt`;
- normalizare ASCII/NFKC și refuz mixed-script/homoglyph;
- country/sanctions/monitoring/token/network/decimals/amount/expiry/signature binding;
- `DirectPaymentLedger` persistent prin snapshot/restore, cu replay și substitution deny;
- finalitate `PREVIEWED → SIGNED → SUBMITTED → ORDERED → EXECUTED_SUCCESS`;
- `LocalXMoneyReconciler` cu idempotency collision, webhook collision, semnătură,
  out-of-order facts, refund și replay după restart;
- runtime-ul de produs nu conține operații de rețea, proces sau provider.

## Dovadă locală

- TypeScript strict: PASS;
- 80 assertions, repetate determinist de trei ori;
- source-boundary findings: 0;
- credential-name matches: 0;
- validator owner remediation: `NX-PAY-P01-A21-BALANCEPROOF01`, PASS 116 controale;
- efecte locale/provider/economice: zero.

## Dovadă MultiversX Devnet

- wallet-uri: fixtures publice din SDK MultiversX;
- token: `USDC-350c4e`, 6 zecimale;
- transfer: `1` unitate atomică, native value `0`;
- tranzacție: `10c4e1014c9c2a212f802f6163ac3a2c4651f79e21e0c21339a7fe25439006da`;
- stare indexată: `success`, nonce `930`;
- sold expeditor: `200000 → 199999`; destinatar: `0 → 1`; imbalance `0`;
- tranzacții publice: `1`; repetări broadcast: `0`; fonduri reale: `0`;
- cost incremental: `0 EUR`; apeluri provider xMoney: `0`.

Runnerul `mxpy 11.4.1` a emis tranzacția, apoi a întâlnit un defect de tip în
awaiter-ul `--timeout`. Runnerul a refuzat replay-ul prin aprobarea single-use, iar
modul read-only `Recover` a legat receipt-ul semnat de aceeași semnătură, nonce,
payload, tranzacție indexată și istoricul identic al ambelor conturi.

## Excluderi și gate-uri

Review-ul independent inițial a returnat `CHANGES_REQUIRED` pentru authorization
forgery/staleness, Direct restore fără lineage complet și xMoney restore cu sequence/
facts fabricabile. Toate cele trei căi au acum controale runtime și probe negative;
receipt-ul independent trebuie revalidat înainte de acceptare.

- xMoney Sandbox/production necesită cont, termeni, credențiale și aprobare separată;
- mainnet, fonduri reale, custody, KYC/AML provider și lansare publică sunt excluse;
- opinia juridică și auditul financiar/security extern rămân gate-uri formale;
- review independent final C02/C03/C05/C10: `PASS`, toate cele trei findings închise;
- xMoney/mainnet/real funds/production persistence rămân excluderi ale acestui thin proof.
