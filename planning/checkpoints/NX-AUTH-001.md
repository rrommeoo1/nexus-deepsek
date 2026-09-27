# Checkpoint — NX-AUTH-001

## Identitate

- Task: `NX-AUTH-001` — Identity Broker and embedded-wallet proof
- Owner: `A11`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-02`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un sandbox local demonstrează binding-ul `(issuer, subject)`, creare wallet non-custodială, recovery, export, revoke și provider outage fără date reale, servicii externe sau chei de producție.

## Acceptance obligatoriu

- email-ul nu produce auto-merge între identități;
- Nexus nu poate reconstrui singur cheia utilizatorului;
- recovery/export/revoke și provider outage sunt demonstrate;
- seed/private key nu intră în backend, logs, analytics, repository sau chain;
- toate testele sunt locale, sintetice și fără cost/egress.

## Gates păstrate

- audit criptografic independent înainte de producție;
- memo juridic de custody înainte de producție;
- niciun provider real, cont extern, deploy sau wallet cu fonduri în acest packet.

## Progres implementat

- `packages/identity/api/index.ts`: Identity Broker sandbox strict, provider verifier injectat și zero token persistence;
- binding unic `issuer + SHA-256(subject)`; email-ul nu este cheie și nu este persistat;
- OAuth/OIDC boundary: provider enabled, exact issuer/audience/nonce/redirect/expiry, state one-time și PKCE S256;
- embedded wallet receipt acceptat numai `THRESHOLD_2_OF_3`, share holders distincți, commitments-only, export suportat și `fullKeyAccessibleByNexus=false`;
- recovery cu minimum două tipuri independente, cooldown, address invariant, export user-controlled, revoke și fallback când providerul este indisponibil;
- snapshot-ul de backend exclude token, email, subject brut, seed și private key.

## Owner smoke test

- compilare TypeScript 5.9.3: strict, ES2022, CommonJS — PASS;
- run local Node 24 inițial: `27/27` aserțiuni — PASS;
- hardening retest: `45/45` aserțiuni — PASS, inclusiv issuer/audience/nonce/redirect/expiry, state replay, PKCE, custody abuse, cooldown, proof invalid și last-recovery-path;
- rezultat: issuer-subject isolation, no-email-merge, Nexus full-key access false, recovery/export/revoke/outage true;
- date: exclusiv `SYSTEM_TEST`/`.invalid`; network/provider real: nu; cost incremental: `0 EUR`.

## Evidence Pack proprietar

- validator: `planning/validate-auth.ps1`;
- evidence: `planning/evidence/NX-AUTH-001-validation.json`;
- run: `NX-AUTH-001-20260802T154454810Z-919728ff` — `PASS`;
- controale validator: `99`, teste identity: `46`, source-boundary findings: `0`;
- compilare strictă: `PASS`; network/economic operations: `0/0`; cost incremental: `0 EUR`;
- challenge-ul este consumat înaintea verificării providerului, iar reutilizarea entropiei este respinsă pentru state, nonce și ID.

## Pas următor

Packet acceptat prin verdict independent C12 `PASS`, run `NX-AUTH-001-20260802T170402576Z-52469113`, subject `1a603850c0b6cae77810a351302b77bc3616207add3135eca2153563a59c127e`. `C12-AUTH-001`, `002` și `004` sunt închise; `003` și `005` sunt închise strict pentru sandbox. Owner run: `NX-AUTH-001-20260802T170258002Z-21cba7a5`, `125` controale și `64` teste. Următorul packet activ este `NX-CHAIN-001`. Gates externe pentru audit criptografic, memo juridic și adaptorul tranzacțional de producție rămân deschise înainte de producție.
