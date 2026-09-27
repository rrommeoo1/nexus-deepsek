# Checkpoint — NX-MEDIA-001

## Identitate

- Task: `NX-MEDIA-001` — VOD upload, transcode, playback and purge proof
- Owner: `A40`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-03`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un upload privat sintetic trece prin validare, moderare și transcodare locală,
produce un manifest HLS protejat de audience policy, iar ștergerea elimină origin,
renditions, index și cache din modelul testat.

## Primul packet delimitat

- state machine și contract media versionat;
- upload authorization fail-closed, checksum, size, MIME și codec policy;
- job idempotent pentru scan/moderation/transcode fără executarea unui proces arbitrar;
- playback grant scurt, legat de asset, audience și territory;
- purge state machine cu receipt complet și retry sigur;
- teste locale deterministe, fără upload extern, CDN, storage contorizat sau date reale.

## Acceptance obligatoriu

- fișierele corupte, malware-marked și formatele neacceptate sunt refuzate;
- playback-ul nu poate depăși audience ori territory;
- delete produce dovadă pentru origin, renditions, index și cache;
- duplicatele și retry-urile converg fără dublarea asset-urilor/joburilor;
- cost incremental, egress și efect economic: zero.

## În afara scope-ului curent

- provider managed, upload real, CDN public, DRM, live streaming și mainnet;
- certificarea FFmpeg/codec pe device matrix și SLA de producție;
- moderare umană sau AI externă contorizată.

## Progres implementat

- `packages/media/api/index.ts`: state machine upload → ready → purge;
- upload authorization autentificat, expirare, checksum, limită, MIME/container,
  H.264/AAC, corruption și malware verdict fail-closed;
- worker attestation autentificat pentru moderation, manifest și renditions;
- playback grant semnat, cu viewer commitment, relație verificată, audience,
  territory și TTL maxim 300 secunde;
- purge numai cu receipts verificate pentru origin, renditions, index și cache;
- retry/idempotency pentru authorization, completion, transcode și purge;
- suita TypeScript strict: `PASS`, `44/44` scenarii, zero rețea și zero efect economic;
- validator owner `NX-MEDIA-001-OWNER-20260809-01`: `PASS`, `83/83`
  controale, zero boundary findings și zero credențiale billing/producție;
- subject inițial pentru review: `063bc2a713194d93c60c76da0834f83d9e78aa7b8c430d76f1df2b00f3772e25`.

## Decizie independentă

- Verdict: `PASS` pentru skeleton-ul local;
- receipt: `planning/evidence/reviews/NX-MEDIA-001-C01-C02-C04-C06-C10.yaml`;
- SHA-256 receipt: `8bdf1135444a9309af943c63ab216213bdc734c293501939ccc050f868c92c76`;
- subject verificat: `c0dd1f71f62e9875bcea4c97cc6b866d846974cc26d671ec3e45bc1de8e039d7`;
- 17/17 artefacte, `86/86` controale și `44/44` scenarii, fără finding blocant;
- provider managed, media reală, producție, live și certificarea pe device rămân gates ulterioare.

## Următoarea acțiune

Packet-ul este închis. Succesorul activ este `NX-QA-001`.
