# Nexus Pay — plăți prin username bazate pe MultiversX și xMoney

Status: specificație inițială pentru `NX-PAY-P01`  
Data evaluării: 2026-08-09  
Mod implicit de implementare: local mocks, devnet cu valoare reală zero

## 1. Decizia de arhitectură

Nexus Pay are două rails sub aceeași interfață:

1. `MultiversX Direct`: transfer non-custodial EGLD/ESDT între wallet-uri, după
   rezolvarea sigură a unui `@username`/herotag la o adresă.
2. `xMoney`: infrastructura principală pentru merchant orders, crypto checkout,
   payment links, subscriptions/refunds și viitoare servicii fiat/stablecoin numai
   unde xMoney confirmă produsul, moneda, țara și contractul comercial.

xMoney nu este presupus automat un API P2P „trimite la username”. Alias resolution
și transferul wallet-to-wallet sunt funcții Nexus/MultiversX; xMoney este adaptorul
de plată reglementat și de merchant lifecycle. Dacă xMoney lansează ulterior un rail
P2P/stablecoin compatibil, acesta intră ca versiune nouă a adaptorului, nu printr-o
presupunere în contractul curent.

```text
Nexus Pay UI
  ├─ Recipient & Alias Resolver
  │    └─ MultiversX DNS/herotag + Nexus profile binding
  ├─ Payment Policy Engine
  │    └─ country, asset allowlist, limits, sanctions/risk, age/business rules
  ├─ Direct Transfer Adapter
  │    └─ EGLD / fungible ESDT + relayed v3 where eligible
  ├─ xMoney Adapter
  │    └─ order, payment link, refund, subscription, signed webhook
  └─ Payment Ledger & Reconciler
       └─ preview → signed → submitted → ordered → executed/refunded/failed
```

## 2. Experiența „trimite la @username”

Flux:

1. user tastează `@ana` sau scanează QR;
2. resolverul normalizează Unicode, refuză mixed-script/homoglyph și rezolvă exact
   network + alias version + receiver address;
3. UI afișează numele, avatarul, badge-ul, adresa abreviată, moneda, suma, fee-ul și
   finalitatea așteptată;
4. sender confirmă prin biometric/wallet signature;
5. tranzacția include sau este legată de un `ResolutionReceipt` scurt;
6. UI separă clar `SUBMITTED`, `ORDERED`, `EXECUTED_SUCCESS` și `FAILED_TERMINAL`.

`ResolutionReceipt`:

```text
{
  alias_hash,
  alias_version,
  receiver_address,
  network,
  token_id,
  token_decimals,
  atomic_amount,
  purpose_hash?,
  issued_at,
  expires_at,
  resolver_key_id,
  signature
}
```

În momentul semnării se revalidează receipt-ul. Schimbarea aliasului, expirarea,
wrong network, wrong decimals, amount mutation ori receiver substitution refuză plata.

## 3. Stablecoins și crypto

- allowlist explicit de token ID, network, issuer, decimals și contract status;
- stablecoin status, reserve/redemption, freeze risk și jurisdicție monitorizate;
- token cu același ticker pe alt network/ID este un activ diferit;
- EGLD și ESDT direct; alte chains numai prin adaptoare distincte auditate;
- fără token arbitrar, automatic bridge ori swap ascuns în MVP;
- soldul și suma sunt afișate în unități atomice corecte și estimare fiat informativă;
- relayed v3 poate sponsoriza gas când policy/buget permite; relayer-ul nu poate
  schimba receiver, token sau amount semnat.

## 4. Integrarea xMoney

Documentația xMoney expune API-uri pentru orders, refunds, webhook notifications și
payment links, cu medii Sandbox și Production separate. Nexus implementează:

- `XMoneyOrderAdapter.createOrder` cu idempotency key Nexus;
- `getOrder` și reconciliere periodică pentru webhook lipsă/delayed;
- `proposeRefund`/refund state machine, fără credit înaintea confirmării;
- payment links one-time/recurring pentru sellers, creators și businesses;
- webhook signature verification, timestamp window, replay store și event version;
- mapping separat între `xmoney_order_id`, `nexus_payment_id` și tx hash-uri;
- dead-letter/retry determinist, fără dublarea soldului ori payoutului;
- circuit breaker care dezactivează checkout xMoney fără a bloca direct transfers,
  exportul, refunds deja datorate ori accesul la istoric.

Cheia API xMoney și webhook secret nu ajung în aplicația mobilă, repository, logs sau
Nexus Nodes permissionless. Sunt numai server-side în vault, cu rotație și least
privilege. Sandbox și Production folosesc conturi, hostnames și chei complet separate.

## 5. „Instant” înseamnă UX rapid, nu finalitate falsă

- Direct MultiversX poate arăta imediat `SUBMITTED`, apoi `ORDERED` și finalitatea
  verificată de chain/indexer.
- xMoney Crypto este un flux asincron; pending poate fi detectat rapid, dar confirmarea
  depinde de network și poate dura semnificativ. Nexus nu afișează `Paid/Final` numai
  pentru redirect ori callback de succes.
- Bunurile, payouturile și retragerile cu risc se eliberează conform finality/risk tier,
  nu după optimismul UI.

## 6. Plată către utilizator nou și erori

Transferul direct către o adresă confirmată este în general ireversibil. Pentru un
username fără wallet activ, Nexus nu trimite automat fonduri la o adresă temporară.
Opțiunea ulterioară `Claim Payment` folosește escrow cu:

- recipient commitment și expiry;
- cancel de către sender până la claim;
- claim numai după wallet binding verificat;
- refund automat la expiry;
- fără custodie Nexus asupra cheii utilizatorului.

Address book arată data ultimei verificări și avertizează când un alias și-a schimbat
wallet-ul. Pentru sume mari se cere reconfirmare, step-up auth și opțional transfer-test.

## 7. Privacy

Username-ul public mapat direct la wallet poate expune soldul și payment graph. Nexus:

- face payment alias opt-in și separat de profilele Dating/Privé/incognito;
- nu indexează global istoricul de plăți după username;
- pune în chain numai datele cerute de transfer, fără note/memo private în clar;
- stochează receipts și compliance evidence criptat, cu retention/purpose;
- permite alias payment separat pentru business și creator;
- explică faptul că un blockchain public nu oferă anonimat perfect.

Pooled settlement/relayer poate reduce legătura publică pentru payouts agregate, dar
nu este folosit pentru a evita AML, sancțiuni, taxe sau ordine legale valide.

## 8. Legal, compliance și disponibilitate

Nexus Pay nu este activ „worldwide” printr-un singur switch. Country Capability Matrix
decide separat direct transfer, merchant checkout, stablecoin, on/off-ramp, subscription,
refund și limite. Gates posibile:

- clasificare CASP/payment institution/money transmission și rolurile xMoney/Nexus;
- KYC/KYB, sanctions, transaction monitoring și source-of-funds pe praguri;
- Travel Rule unde este aplicabilă;
- consumer disclosures, refund/chargeback și complaints;
- tax/reporting și business merchant underwriting;
- stablecoin issuer/asset approval și payment provider terms.

Faptul că xMoney are infrastructură de compliance nu transferă automat toate licențele
și obligațiile către orice flux Nexus. Rolurile contractuale, țările și produsele se
confirmă formal cu xMoney și consilierii înainte de Production.

## 9. Invariants și teste obligatorii

1. sender debit = receiver credit + explicit fee, fără diferență nereconciliată;
2. un order/webhook/tx produce cel mult un credit și un payout;
3. alias/version/address/token/amount/network din preview sunt exact cele semnate;
4. stale/homoglyph/substitution/replay/wrong-decimals fail closed;
5. `verifyResolution` revalidează capabilitatea semnată inclusă în authorization,
   inclusiv țara, signature și expiry; un authorization forjat sau expirat este deny;
6. restore-ul Direct reconstruiește ordinal întregul lineage, recalculează fiecare
   fingerprint și reverifică observația chain tipată (tx, network, token, adrese,
   block, timestamp și deltele exacte); finalitatea fără balance proof autentic,
   evenimentele lipsă și evenimentele phantom sunt deny;
7. restore-ul xMoney reverifică semnăturile webhook, reconstruiește facts din events
   și impune sequence monoton, astfel încât snapshot-ul nu poate fabrica credit sau
   suprascrie un order existent.
5. `SUBMITTED` și `ORDERED` nu sunt `EXECUTED_SUCCESS`;
6. forged, duplicate, delayed și out-of-order xMoney webhooks converg;
7. refund și chargeback nu pot produce treasury sau merchant balance negativ;
8. `SYSTEM_TEST` folosește numai test tokens și are efect economic real zero;
9. provider outage nu blochează istoricul, direct transferul permis sau refunds datorate;
10. niciun secret xMoney ori production credential nu intră în client/evidence.

## 10. Livrare

- `P01`: alias resolver + direct test-ESDT devnet + xMoney local mock/webhook fixtures;
- `P02`: xMoney Sandbox numai după cont/termeni/credentials aprobate de owner, fără bani;
- `P03`: limited-country pilot, external legal/security review și reconciliation drill;
- Production/mainnet/bani reali: aprobare separată, budget, limits și kill switches.

## 11. Surse

- [xMoney Crypto API Introduction](https://docs.xmoney.com/crypto_api/introduction)
- [xMoney Sandbox and Production setup](https://docs.xmoney.com/guides/crypto/get-started)
- [xMoney Payment Links](https://docs.xmoney.com/guides/payments/payment-links)
- [xMoney payment networks and currencies](https://support.xmoney.com/en/articles/4879097-payment-networks-and-currencies)
- [MultiversX fungible ESDT transfers](https://docs.multiversx.com/tokens/fungible-tokens/)
- [MultiversX relayed transactions v3](https://docs.multiversx.com/developers/relayed-transactions/)
- [MultiversX terminology — Herotag](https://docs.multiversx.com/welcome/terminology/)

Aceste surse descriu capabilități curente, dar disponibilitatea comercială, prețurile,
licențele și monedele xMoney trebuie confirmate contractual înainte de integrarea live.
