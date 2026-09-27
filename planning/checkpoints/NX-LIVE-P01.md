# Checkpoint — NX-LIVE-P01

## Identitate

- Task: `NX-LIVE-P01` — Managed live adapter and emergency-end contract
- Owner: `A41`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un provider managed strict local/fake pornește un singur stream sintetic, iar o
comandă deterministă de urgență îl oprește exact o dată, păstrând receipt-ul pentru
apel și intrând fail-closed la timeout ori eroare de provider.

## Felie de implementare

- contract adapter provider fără SDK, credentiale, rețea sau billing;
- state machine `DRAFT → STARTING → LIVE → ENDING → ENDED|FAILED_CLOSED`;
- eligibility creator, media/moderation/policy generation și Kids exclusion;
- idempotency, lease/fencing token, timeout și provider callback exact binding;
- emergency end independent de modele generative;
- receipt ordonat pentru apel, restore/replay și zero leakage;
- actori `SYSTEM_TEST`, zero provider/network/economic/cost.

## Gates și excluderi

- Social, Media, Moderation și Observability sunt dependințe acceptate;
- review independent C06/C09/C10 este obligatoriu înainte de `done`;
- provider real, ingest/egress video, CDN, SLA extern, utilizatori reali și producție
  rămân excluse.

## Stare curentă

Packet acceptat T0. Validarea finală a trecut 120 controale și 30 scenarii repetate
de trei ori. Review-ul C06/C09/C10 a închis toate cele trei findings, inclusiv
containment-ul CRITICAL; receipt SHA-256 `4d0ecb8ab64eeed0d362f5f2bd35341dc8f3dff621ce7a7fb7e13885567f31a1`.
