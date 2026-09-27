# Checkpoint — NX-EXPERIENCE-P01

## Identitate

- Task: `NX-EXPERIENCE-P01` — Story Pulse save download call meeting and identity policy proof
- Owner: `A42`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-16`
- Cost incremental maxim implicit: `0 EUR`

## Scope acceptat

- Story cu durată `1h / 6h / 24h / 3d / 7d / Until I remove it` și Highlight;
- `Pulse` pentru text, foto, clip, link, poll, quote, repost și thread;
- Save in Nexus, offline cache și download pe device ca operații distincte;
- watermark Nexus și rights/license/audience gates pentru export;
- audio/video calls și Work Meetings cu room/participant/consent/E2EE policy;
- identitate separată: Work full name, Social nickname, Dating age proof, Adult 18+,
  payment username global;
- follower-integrity și excluderea paid/agent/synthetic/quarantine;
- `Near / For You / Global` și `Breaking` cu localizare aproximativă, limbă,
  corroborare, sources, corrections și reason codes.

## Limite

- numai `SYSTEM_TEST`, local și deterministic;
- fără RTC/calendar/CDN/maps/DRM/identity provider extern;
- fără date reale, trafic organic, plăți, fonduri sau tranzacții;
- integrarea de producție, licensing, legal și audit extern rămân gates distincte.

## Rezultat

Packetul local sintetic este acceptat. State machines și boundary-urile pentru
Story/Highlight, Pulse, save/download, identity presentation, discovery și rooms
au trecut validarea owner și review-ul independent T0.

## Dovadă owner

- implementare: `packages/experience/api/index.ts`;
- scenarii: `packages/experience/api/index.test.ts`;
- validator: `planning/validate-experience.ps1`;
- 167 controale și 77 aserțiuni de journey, repetate determinist de trei ori;
- compile TypeScript strict, source-boundary fail-closed și zero efecte externe;
- `Near` este profile-scoped și folosește doar zonă aproximativă cu consimțământ;
- `Global` combină interesul profilului cu popularitate normalizată cross-region;
- `Breaking` cere receipt de evidence valid plus minimum două surse independente
  sau alertă oficială, refuză paid/political targeting și nu întrerupe suprafețele private.

Evidence owner: `planning/evidence/NX-EXPERIENCE-P01-validation.json`, SHA-256
`c4c9b01021916804bda03af4447a5be49499bfe50d208862d1a08e8d5c83a75e`, subject
`efa38be4944940c7fca21e432253ed0e1555cfbc35fc60e157bc313d33fa47b7`.

Review-ul independent `C02/C04/C06/C08/C10` este `PASS / T0_REVIEW_SATISFIED`.
Receipt: `planning/evidence/reviews/NX-EXPERIENCE-P01-C02-C04-C06-C08-C10.yaml`,
SHA-256 `3e4e6a7b7c5833114820386a3146ece62eab52f6811daa8c4dea2aa9704a4744`.
Niciun provider extern, fond real sau cost incremental nu a fost utilizat.
