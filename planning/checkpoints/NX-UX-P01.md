# Checkpoint — NX-UX-P01

## Identitate

- Task: `NX-UX-P01` — Adaptive navigation composer and visual demo proof
- Owner: `A31`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-16`
- Data remediere: `2026-08-19`
- Cost incremental: `0 EUR`

## Istoric review

- `2026-08-16` — T1 independent review `C01/C02/C04/C10` a returnat
  `CHANGES_REQUIRED` cu 2 findings MEDIUM:
  - `C02-UX-P01-001` — readability + dialog/tab semantics + accessible names;
  - `C02-UX-P01-002` — simulated-state disclosure insuficient persistent.
- Subject revizuit (respins): `7966a0994412e06758e77a58317b16d5f1ac9911973679a90bd55eb609fa98e2`.

## Remediere owner

- Readability: toate `font-size` ≥ 12px pe suprafața telefon/mobile (verificat în
  CSS-ul final); overlay-urile (composer, launcher, support, send) au `role=dialog`,
  `aria-modal`, focus inițial, focus containment (Tab), închidere pe Escape și
  focus return; grupurile de tab-uri/choices au `role=tablist`/`tab`/`aria-selected`
  sau `aria-pressed`; acțiunile icon-only au nume accesibile descriptive.
- Disclosure persistent: ribbon global
  `LOCAL INTERACTIVE DEMO · SYNTHETIC DATA · NO PROVIDERS · 0 REAL FUNDS` vizibil
  și pe mobile (nu mai depinde de `infoPanel`); label telefon
  `DEMO · SYNTHETIC · 0 FUNDS`; claims-uri de tip verificare/escrow/on-chain/Trust
  Lens/balanțe/câștiguri prefixate explicit `Demo`/`Synthetic`; a rămas un singur
  text nemarcat în Dating Connections: `Identity verified` → `Demo identity status`
  (și frază `synthetic`).
- Fără competiții/matrice comparative în UI; fără upload, provider, rețea externă,
  publicare, fonduri sau cost incremental.

## Verificare retest (deterministă, local, zero-cost)

- Build (`vinext build`): `PASS`, `dist/server/index.js` generat.
- Lint (`eslint .`): `PASS` (0 erori, 0 warning-uri).
- Teste (`node --test tests/rendered-html.test.mjs`): `3/3` PASS, inclus
  regresiile accessibility + synthetic-disclosure (font ≥12px, `role=dialog` ≥4,
  `role=tablist`, `aria-selected`, `aria-pressed`, focus trap/Escape, ribbon mobil,
  lipsa claims necalificate + `Identity\s+verified` interzis explicit).
- Subject content-addressed recomputat și potrivit.

## Evidence

- owner evidence: `planning/evidence/NX-UX-P01-validation.json` (retest).
- retest review: `planning/evidence/reviews/NX-UX-P01-C01-C02-C04-C10-retest1.yaml`.
- screenshots desktop păstrate valide (schimbarea text a afectat doar subview-ul
  Dating Connections, neinclus în capturi).

## Îmbunătățire interactivitate (2026-08-19, cost 0)

Feedback utilizator: butoanele rămase „moarte" (fără handler) făceau demo-ul să pară neterminat.
Am adăugat handleri `onClick` pe toate controalele și sheet-uri/sub-ecrane reale pentru:
- stories, comentarii, post menu, like/share/save, follow, Trust Lens;
- „Schedule meeting" (planificator zi/oră), „Video call" (sală simulată cu mute/cam/end);
- thread-uri de chat cu input + trimitere; căutare globală și notificări;
- „Edit demo profile"; navigare filtre (Market categorii, Work tabs, Dating filters, Privé tabs);
- fișe produs/job/stay, player video, Pay request/scan/history, camera simulată în composer.

Verificare: build `PASS`, lint `0/0`, teste `3/3 PASS`, server local HTTP `200`.

## Gate final

- `C02-UX-P01-001`: CLOSED (readability ≥12px + dialog/tab semantics + accessible names + regresii).
- `C02-UX-P01-002`: CLOSED (disclosure persistent pe mobile + claims marcate Demo/Synthetic + regresie `Identity\s+verified` DENY).
- `NX-UX-P01`: `review → done`.
- `NX-UX-001`: `in_progress → done`.