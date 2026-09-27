# Checkpoint — NX-SOCIAL-P01

## Identitate

- Task: `NX-SOCIAL-P01` — One moderated Clip and action transaction
- Owner: `A32`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un upload video sintetic devine un Clip redabil numai după decizie de moderare,
iar un like distinct ajunge în action ledger și reducer la stare terminală cu
reconciliation `PASS`. Purge-ul trebuie să facă assetul imediat neredabil.

## Felie de implementare

- asset sintetic și manifest media existente, fără upload sau CDN real;
- exact-shape capability pentru profil, audience, asset și generație;
- state machine upload → moderation → playable → purged;
- etichetare obligatorie `SYSTEM_TEST` și excludere din metrici organice;
- un like public distinct, terminal și reconciliat prin chain sandbox/reducer;
- replay, stale profile, moderation deny și purge testate local;
- zero rețea, provider, efect economic sau cost.

## Gates

- `NX-PROFILE-P01`, `NX-MOD-P01`, `NX-MEDIA-001`, `NX-CHAIN-001`,
  `NX-CHAIN-002` și `NX-OBS-001` sunt acceptate;
- packet-ul cere review independent C01/C04/C06/C08 înainte de `done`;
- media/CDN/moderare reale, utilizatori reali, ranking de producție, mainnet și
  auditul formal rămân excluse.

## Stare curentă

Packet-ul a fost activat după acceptarea T0 a `NX-CHAT-P01`. Contractul local din
`packages/social/api` leagă exact publish-ul de asset, manifest, creator, generația
profilului, audience și o decizie separată semnată de eligibilitate. Testul compune
pipeline-ul media acceptat cu un Clip `SYSTEM_TEST`, playback limitat, un singur
`LIKE` public terminal/reconciliat și purge verificat pe ORIGIN/RENDITIONS/INDEX/CACHE.
Decizia de like este separată, semnată și legată de viewer, generația profilului,
block, audience și device; nu reutilizează generația creatorului. Finding-ul HIGH
`C04-SOCIAL-P01-001` a fost remediat prin `LikeExecutionAuthorization` one-time,
binding exact la envelope/session/nonce/domain și CAS pe state/media generation după
verificarea asincronă a semnăturii. Policy version pentru block/audience/device este
reverificată după await, iar orice conflict apelează `abortPreparedAction`; tokenul
reținut nu mai poate fi comis ulterior. Commit-ul pregătit este sincron și consumă
capability-ul împreună cu acțiunea; target substitution, purge întârziat și race de
profil/policy nu creează acțiuni. Rularea locală trece minimum 34 assertions, iar regresia
chain existentă trece 52 assertions. Synthetic/promoted rămân excluse din organic
și Kids; zero rețea, provider, efect economic și cost. Urmează Evidence Pack-ul
regenerat și re-review-ul independent T1. Re-review-ul final este `PASS` cu
116/116 controale, 34 scenarii repetate de trei ori și zero findings deschise.
