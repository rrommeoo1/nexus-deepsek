# Prompt — reconstrucția backend-ului Nexus

> Scop: readucerea backend-ului din `apps/nexus-web` la fidelitatea demo-ului
> `apps/nexus-demo` și la specificațiile normate din `docs/00`–`docs/22`, cu
> MultiversX real pe devnet (0 fonduri reale), nu un mock offline.

## ROL

Reconstruiește backend-ul Nexus din `apps/nexus-web` ca să respecte exact:

1. UX-ul demo-ului `apps/nexus-demo` (prima pagină + toate ecranele);
2. specificațiile normative: `docs/00-master-spec.md`, `docs/01-technical-architecture.md`,
   `docs/02-smart-contracts.md`, `docs/03-data-api.md`, `docs/research-multiversx.md`;
3. regulile din `AGENTS.md`.

Rezultatul trebuie să fie un produs local funcțional, cu MultiversX real pe
**devnet**, nu dovezi inventate.

## CONSTRÂNGERI OBLIGATORII (AGENTS.md)

- `default_deny_spend`: cost incremental **0**. Doar devnet/testnet, fără fonduri
  reale, fără mainnet, fără API plătit.
- Teste sintetice `local_mock_only` acolo unde e cazul; orice destinație de
  rețea sau efect economic real cere aprobare explicită.
- Fără credite, fără auto-recharge, fără modificarea abonamentului.
- WIP=1, maker-checker, fiecare livrare lasă Evidence Pack + checkpoint.
- P0 precede verticalele; nu modificăm fișiere în afara scopului acestui task.

## OBIECTIV PRIORITAR

Backend-ul trebuie să arate și să se comporte ca demo-ul, cu aceste capabilități
reale:

### 1. Fidelitate vizuală față de demo (prima pagină + shell)

- `apps/nexus-web/public` reproduce exact interfața din `apps/nexus-demo/app/page.tsx`:
  ecranul de autentificare, telefonul cu header, rail de module, Quick Switch,
  Pulse, Market, Messages, Pay, Privé 18+, Dating, Work, Stay, Watch etc.
- Fiecare ecran din demo are cel puțin un endpoint backend real și un handler,
  nu doar HTML static. Zero „dead-ends": fiecare buton duce undeva funcțional.

### 2. MultiversX REAL (nu mock offline)

- Înlocuiește `apps/nexus-web/lib/mvx.js` (verificare Ed25519 manuală, offline)
  cu integrarea oficială `@multiversx/sdk-dapp` pe frontend și validare server-side
  NativeAuth (`@multiversx/sdk-native-auth-server` / `@multiversx/sdk-nestjs-auth`),
  conform `docs/research-multiversx.md` — secțiunea Wallet/sesiune.
- **„Conectează wallet" deschide efectiv xPortal** (WalletConnect QR/deep-link),
  web wallet, extensie sau Ledger — nu `prompt()`, nu lipire manuală de hex.
- **xAlias / herotag funcțional:** apel real către API-ul MultiversX
  `GET /address/{herotag}` (sau echivalentul din SDK) pentru `@nume` → `erd1...`,
  validat și persistat. Loginul prin herotag + dovadă de semnătură este testat end-to-end.
- **Acțiuni on-chain reale pe devnet:** `createProfile`, ancorare manifest (hash),
  tips EGLD/ESDT, escrow marketplace `fundOrder`, settlement — prin contractele Rust
  din `packages/contracts` și bindings generate. NU hashuri SHA256 inventate drept „dovadă".
- Rețea: **devnet** (chain ID `D`), explorer `devnet-explorer.multiversx.com`.

### 3. Delimitarea corectă on-chain / off-chain (NU pune totul pe chain)

Respectă matricea din `docs/research-multiversx.md` (Privacy) și `docs/03-data-api.md`:

- **ON-CHAIN:** control wallet, profil registry minimal + manifest hash, escrow,
  plăți EGLD/ESDT, tips, badges/attestations, settlement.
- **OFF-CHAIN (obligatoriu, prin design):** feed/video/live, mesaje (E2EE Matrix),
  like-uri, views, follows, swipe/match Dating, search, locație, calendar,
  recomandări, moderare. Pe chain apar **cel mult hash/commitment**, niciodată
  PII/media/mesaje în clar.
- Corectează orice cod care scrie sau pretinde că scrie mesaje/feed direct pe
  chain; în schimb ancorează commitment-uri.

### 4. Stocare și sincronizare reală

- Păstrează SQLite local pentru datele private (users, personas, posts, likes,
  comments, follows, messages, listings, devnet_actions).
- Persistența supraviețuiește refresh/relogin (test).
- Indexer/reconcilere minimală: după o tranzacție devnet, starea locală se
  actualizează doar din finalitate on-chain, nu dintr-un răspuns „pseudo-ok".

### 5. Contracte și finalitate

- Folosește `packages/contracts` pentru `nexus-profile-registry`, `nexus-marketplace`,
  `nexus-tipping`. Endpoint-urile backend expun `prepare`, `sign`, `track`, `reconcile`.
- Fiecare acțiune devnet = tranzacție reală, cu `tx_hash` real și link explorer.
- Nonce/chain ID/expirare anti-replay; relayer gasless numai dacă este cazul și
  doar pe devnet.

### 6. Testare obligatorie (măsurabilă)

- `npm test` rulează deterministic, fără rețea reală (mock/fixtures): auth NativeAuth
  (challenge/verify, herotag), signup/login, persistență, delimitare on-chain/off-chain,
  ACL persona deny-by-default.
- Teste de integrare `local_mock_only` pentru fluxul MultiversX
  (challenge → semnătură → verify → sesiune).
- Verificare manuală documentată: „Conectează wallet" deschide xPortal; herotag
  `@alex` se rezolvă; o acțiune produce un `tx_hash` real pe devnet.

## ACCEPTARE (definition of done)

1. Prima pagină + shell-ul arată identic cu demo-ul `apps/nexus-demo`.
2. „Loghează-te cu xPortal" deschide xPortal (nu prompt, nu pastă manuală de hex) pe devnet.
3. xAlias/herotag se rezolvă, iar loginul funcționează testat.
4. Profilul/escrow/tips produc tranzacții devnet reale, cu `tx_hash` + link explorer.
5. Mesajele/feed-ul/like-urile sunt off-chain, cu commitment pe chain unde
   specificația o cere — fără date private pe chain.
6. Toate testele trec; fiecare schimbare are Evidence Pack + rezumat de dovezi.