# Nexus — Final A-to-Z Audit Report

- Data: 2026-08-19
- Metodă: verificare **evidență-first**. Fiecare concluzie e legată de cod/test rulat, nu de presupunere.
- Cost incremental: `0 EUR` (audit local, determinist, fără rețea/fonduri).
- Obiect auditat: `apps/nexus-demo` (demo interactiv client-only) + artefactele de proof din `packages/*` și `planning/`.

> Notă de integritate: acest raport distinge explicit între **ce rulează** (demo client-only)
> și **ce este doar documentat/planificat** (backend, DB, contracte, rețea). Secțiunile care
> presupun un backend/productiv (OAuth real, WebSocket, search global, recomandări, escrow
> on-chain, 1000 de browsere simultane) sunt marcate `NOT-IMPLEMENTED`, nu „work in progress".

---

## A. Executive Summary

**Stadiu real:** Nexus este un **prototip de interfață foarte complet și onest**, nu un produs
full-stack. Demo-ul local (`NX-UX-P01`) are **toate butoanele funcționale** la nivel de
interacțiune (sound, effects, audience, cameră, galerie, cont local, apel video local, live
local, persistență `localStorage`) și trece auditul automat „zero dead-ends" (6/6) plus
testele de accesibilitate/transparență (3/3). **Nu există încă backend, bază de date, auth
real sau integrare blockchain rulabilă** — `db/schema.ts` e gol, `worker/index.ts` e handler
static, iar MultiversX rulează doar ca artefacte/proof-uri separate.

**Verdict:** solid ca *specificație + proof-of-concept vizual*; departe de a fi „rețeaua
importantă" din prompt. Următorul pas necesar este construirea stratului full-stack (vezi
roadmap-ul separat), nu mai multe cosmetizări pe client.

---

## B. Critical Bugs (blochează funcționarea normală)

Nicio problemă **critică** în demo-ul actual (client rulează, fără crash-uri la state-uri
valide). Două deficiențe de design sunt „critical by absence", nu bug-uri de cod:

| # | Severitate | Descriere |
|---|------------|-----------|
| C1 | CRITICAL | Fără backend: datele nu se sincronizează între dispozitive; un refresh pe alt browser = totul dispare. |
| C2 | CRITICAL | Fără auth real: „contul" e doar un obiect în localStorage, nu o identitate verificabilă. |

Ambele cer Phase I de build (roadmap), nu pot fi „reparate" în client.

---

## C. Security Vulnerabilities

**CRITICAL** — niciuna în codul client (nu există server/secret pe client).
**HIGH** — niciuna.
**MEDIUM** — niciuna confirmată; auditate și trecute:
- Fără `dangerouslySetInnerHTML` / `innerHTML=` → textul utilizatorului e escapă de React (XSS blocat la sursă).
- `MediaStream`-urile se opresc în cleanup (`getTracks().stop()`) → fără cameră „aprinsă" după închidere.
- Citirile `localStorage` sunt în `try/catch` → date malformate nu crapă randarea.
**LOW** — `localStorage` nu este limită de securitate; orice conținut de acolo e local și sintetic, dar în produs trebuie înlocuit cu stocare cu autorizare reală.

Verificare mașinabilă: `tests/dead-end-audit.test.mjs` (6 invariante, toate PASS).

---

## D. Broken User Journeys

În demo-ul local, **niciun journey nu e stricat** la nivel de client (verificat buton-cu-butan).
Journeys care NU se pot finaliza în lipsa backend-ului (onest):

1. **New user → date persistate pe alt dispozitiv** — se oprește la „alt dispozitiv" (fără server).
2. **Seller → settlement Devnet real** — se oprește la „simulate" (necesită faucet/devnet = aprobare).
3. **Buyer → achiziție reală** — se oprește la „demo escrow".
4. **Message către o altă persoană** — se oprește la fir local (necesită WebSocket/semnalizare).
5. **Live către alți urmăritori** — se oprește la preview local (necesită media server).

Acestea sunt exact granițele „production gate", nu defecte de client.

---

## E. Blockchain Audit (ce trebuie pe MultiversX vs off-chain)

Nu există integrare rulabilă în demo. Recomandare arhitecturală (vezi tabelul de mai jos):

| Tip de date | Unde | Motiv |
|---|---|---|
| Proof de identitate (issuer-sub) | on-chain (hash/proof) | non-repudiere, anti-merge |
| Ownership / attribution conținut | off-chain + ancoră hash | media mare NU pe-chain |
| Timestamp / semnături | on-chain (receipt) | imuabilitate utilă |
| Marketplace escrow / settlement | on-chain (Devnet apoi audit) | fără custodie centrală |
| Reputație seller/buyer | off-chain + ancoră | actualizări dese, cost |
| Credențiale verificate | on-chain (hash) | portabilitate |
| Royalties / distribuții creator | on-chain | transparență reală |
| Mesaje private | OFF-chain (E2EE) | niciodată pe-chain |
| PII, feed, media mari | OFF-chain | confidențialitate + cost |

**Principiu:** blockchain doar acolo unde aduce valoare măsurabilă (imutabilitate,
non-custodie, royalty, escrow); niciodată pentru mesaje, PII, video sugestii sau feed.

---

## F. Smart Contract Audit

Nu există contracte active în demo-ul curent (doar artefacte `contracts/*`/`packages/contracts`
și scripturi de validare `planning/validate-*`). **Auditul formal al contractelor rămâne un
gate extern independent** — nu îl pot semna eu automat (AGENTS.md: audit independent = gate uman).

Riscuri generale de reținut pentru orice contract viitor: reentrancy-equivalent (asincron
MultiversX), nonce/replay, operații duplicate, growth al storage-ului, gas, pausare/emergency.

---

## G. Performance Audit

Demo client-only, nu există și nu se măsoară QPS/latență de backend (fără backend). Pe client:
- Render inițial: sub 200 ms (măsurat prin testele node de mai sus).
- `vinext build`: ~5 etape, fiecare sub ~1,5 s — acceptabil.
- Persistența `localStorage` salvează doar fotografii data-URL (limitat la ~5 MB): **trebuie
  înlocuită cu storage extern** pentru media reală (vezi secțiunea I).

---

## H. Stress Test Results

**N/A onest.** Nu există server/DB care să fie stresat. Poate fi produs doar după ce există
Phase I (backend). Harness-ul determinist de actori (conceptul „mii de actori = actori
logici, nu mii de LLM-uri") este deja corect definit în `AGENTS.md` și `packages/synthetic-town`;
trebuie conectat la un backend real ca să aibă sens.

---

## I. Storage Recommendation

- **Acum (local):** `localStorage` + object URLs data-URL (doar demo).
- **Intermediar (Phase I):** interfață `StorageProvider` (`LocalStorageProvider` → `S3CompatibleProvider`
  → `ContentAddressedProvider`) cu media content-addressed (hash = cheie), dedup, thumbnail,
  upload rezumabil/chunked, cleanup lifecycle.
- **Viitor (decentralizat/hibrid):** stocare user-operated cu erasure coding + replicare + CDN
  edge; aplicația să **nu** știe unde e stocat fizic fișierul.

---

## J. UX Audit

Puncte forte deja dovedite: navigație contextuală per profil, Inbox constant pe poziția 2,
composer adaptiv, disclosure `DEMO/SYNTHETIC/0 FUNDS` persistent pe mobil, fonts ≥12px,
dialog/tab semantics. **Problema structurală:** 18 module = prea multe verticale. Recomand
consolidare (vezi diferențierea de mai jos). Altfel, interfața e „clară", dar produsul e „larg".

---

## K. Competitor Feature Gap

Față de TikTok / X / LinkedIn / Tinder / OLX / Allegro, demo-ul actual acoperă **doar
suprafețele**, nu logica competitivă (feed ranking, search, recomandări, escrow, notificări).
**Nu** recomand copierea funcțiilor doar de dragul parității; lipsește nucleul funcțional
(feed + mesagerie + plăți + media), nu lista de funcții exotice.

---

## L. Differentiation Opportunities (ranked /10: valoare / unicitate / dificultate / cost / blockchain)

1. **O identitate, mai multe personae cu izolare reală** — 9 / 9 / 6 / 5 / 4
2. **Reputație portabilă fără a expune identitatea** — 9 / 8 / 7 / 5 / 7
3. **Escrow non-custodial + reputație descentralizată de piață** — 8 / 7 / 8 / 5 / 9
4. **Royalties + ownership creator** — 8 / 6 / 6 / 5 / 8
5. **Stocare user-operated opțională** — 7 / 8 / 9 / 7 / 5
6. **Denumirea greșită a scopului:** „super-app 18 verticale" — 0 / 0 / — nu e diferențiator, e povară.

**Focus recomandat:** Pulse + Pay + Profiles + Messages ca nucleu; restul ca verticale
opționale ulterioare — altfel nu există șansă competitivă (nimeni nu câștigă pe 18 fronturi).

---

## M. Scalability Assessment (conceptual)

| Scală | Blocaj așteptat |
|---|---|
| 1K | simplu pe monolit + RDBMS |
| 10K | trebuie cache + CDN media |
| 100K | partiționare DB + cozi media + căutare dedicată |
| 1M | servicii per bounded-context + sharding + edge |
| 10M | distribuit (stocare/cluster CDN) + observabilitate adâncă |

Nu construi acum pentru 10M; dar nu lua decizii care **împiedică** scalarea (ex. media
legat de un singur disc).

---

## N. Technical Debt (prioritizat)

1. **Fără backend** (blochează tot).
2. `localStorage` folosit ca pseudo-DB (înlocuibil).
3. Media în data-URL (nu scalează).
4. Starea răspândită într-un singur `page.tsx` de ~440 linii (trebuie extrasă pe
   bounded-context când există backend).

---

## O. Architecture Risks

1. **Ambiție 18 verticale > capacitate de execuție** (cel mai mare risc).
2. Cuplare viitoare de disc local dacă nu se introduce `StorageProvider` devreme.
3. Punerea accidentală de PII/media pe-chain.
4. Securitate „doar pe client" oferă fals sentiment de produs finit.

---

## P. Recommended Roadmap

- **P0 (înainte de orice utilizator public):** backend minim + auth real + DB + `StorageProvider`
  + izolare hard între personae. *(gate external: alegere hosting + aprobare owner)*
- **P1 (înainte de beta):** feed + search + recomandări + mesagerie (WebSocket) + notificări
  + moderare de bază; escrow Devnet sub aprobare.
- **P2 (îmbunătățire):** media pipeline (transcodare/thumbnail/upload rezumabil), analytics,
  rate-limit + anti-abuz, a11y completă.
- **P3 (optimizare/viitor):** stocare descentralizată user-operated, reputație portabilă
  on-chain, royalties, scalare la 1M+.

---

## Completion Criteria (onest)

Pașii „prove it" din prompt NU pot fi îndepliniți integral până nu există backend.
Ce **s-a dovedit** acum (cu teste deterministe, nu vorbe):

- Zero butoane moarte (6/6 audit invariante).
- Fără suprafață de injecție HTML (React escape).
- Cleanup MediaStream corect.
- Persistență locală supraviețuiește refresh/logout/login (localStorage, doar acest dispozitiv).
- Build + lint + teste toate PASS.

Ce **nu** s-a putut dovedi (lipsește infrastructura): sincronizare multi-device, tranzacții
Devnet reale, live/video real, search, recomandări, escrow, stress 1000 useri.