# MASTER PROMPT — NEXUS: FINALIZARE POST-AUDIT (BUILD-TO-PRODUCT)

Fișier reutilizabil. Folosește-l ca prompt de continuare a construcției Nexus.

---

## 0. Context obligatoriu (citește înainte de orice cod)
- Repo: monorepo Nexus. Demo curent validat: `apps/nexus-demo` (client-only, all buttons functional, localStorage).
- Lipsuri confirmate de audit (`planning/findings/FINAL-A-TO-Z-AUDIT-REPORT.md`): **fără backend, fără DB, fără auth real, fără storage extern, fără feed/search/messaging/notifications/moderation, fără blockchain rulabil**.
- Documente normative: `docs/00-master-spec.md`, `docs/01-technical-architecture.md`, `docs/16-agent-delivery-continuous-assurance.md` + `docs/09`–`docs/22`.
- Reguli non-negociabile: `AGENTS.md`. Cost incremental implicit **0**. WIP **1**. Maker-checker obligatoriu. **Devnet only** pentru on-chain. Fiecare packet lasă **Evidence Pack + checkpoint** reutilizabil.

## 1. Obiectiv
Transformă Nexus din „demo client-only" în **produs full-stack**, păstrând **18 verticale** ca primă direcție, dar cu **kill-switch**: o verticală se scoate dacă nu atinge pragul de utilitate definit în §7. Scopul final este „ONE IDENTITY → MULTIPLE PERSONAS → SOCIAL GRAPH → CONTENT → MARKETPLACE → MESSAGING → CREATOR ECONOMY → OWNERSHIP/VERIFICATION".

## 2. Principii de execuție
- **Evidență-first**: orice claim „funcționează" trebuie dovedit prin test determinist + run log, nu prin afirmație.
- **Zero dead-ends**: fiecare acțiune = handler real → validare → persistență → supraviețuiește refresh/relogin (test `dead-end-audit` extins la backend).
- **Blockchain doar unde aduce valoare** (escrow, proof identitate, royalty, reputație portabilă); **niciodată** mesaje/PII/media/feed on-chain.
- **Personae izolate** (Social/Work/Dating/Travel/Market) = motorul de diferențiere #1; ACL deny-by-default la nivel de backend.
- **Confidențialitate pt. Kids/Dating/Adult** = default deny, gates separate, fără leak cross-persona.

## 3. Fazele (în ordine strictă, fiecare = packet verificabil)

### Phase I — Fundație reală (P0)
1. **NX-CORE-API**: runtime API + DB real + auth local (issuer–sub) + `StorageProvider`. Înlocuiește `localStorage` ca sursă de adevăr.
2. **NX-DB-001**: schema (users, personae, posts, media, follows, listings, messages, escrows).
3. **NX-AUTH-RT**: înregistrare/login real, sesiuni, refresh, logout, multiple device-uri; fără conturi orfane.
4. **NX-PERSONA-ACL**: izolare hard între personae + test acces neautorizat.
5. **NX-STORAGE-001**: interfață `StorageProvider` (Local → S3Compatible → ContentAddressed), upload chunked/resumable + thumbnail + dedup hash.

### Phase II — Experiență de bază (P1, pentru beta)
6. **NX-FEED-001**: feed ranking + paginare + freshness + dedup (nu listă statică).
7. **NX-SEARCH-001**: căutare globală typo-tolerantă (users/posts/listings/produse).
8. **NX-MSG-RT**: mesagerie WebSocket 1:1/grup, E2EE off-chain, fără scurgeri cross-user.
9. **NX-NOTIF-001**: notificări in-app/push, fără a loga PII/secret.
10. **NX-MOD-001**: raportare/block/appeal + rate-limit + anti-abuz (reutilizează `packages/moderation`, `trust-lens`).

### Phase III — Blockchain orientat pe valoare (P1/P2, Devnet ONLY)
11. **NX-ESCROW-001**: escrow marketplace + settlement (Devnet; audit independent înainte de orice fond real).
12. **NX-RCPT-001**: receipt content-addressed on-chain pentru ownership/attribution (hash, nu media).
13. **NX-ROYALTY-001**: distribuții creator + royalty (nu pentru each like).
14. **NX-REPUTATION-001**: reputație portabilă (hash; fără PII pe-chain).

### Phase IV — Scale & diferențiere (P2/P3)
15. **NX-MEDIA-PIPE**: transcodare + adaptive streaming + preload + cleanup lifecycle.
16. **NX-SYNTH-1000**: harness 100→250→500→1000 actori logici (personae diverse) pe backend real; izolați ca `SYSTEM_TEST`, zero efect economic/metric.
17. **NX-NODE-STORE**: stocare user-operated opțională + CDN edge (faza târzie).
18. **NX-RECO-001**: recomandări unificate cu semnale separate per mod.

## 4. Maparea celor 18 verticale (fiecare = „thin but real", nu gol)
Pulse, Profiles, Market, Messages, Creator, Privé 18+, Nexus Pay, Dating, Watch, Kids, Signal, Work, Stay, Ride, Beauty, Music, Wellbeing, Node Network — fiecare primește **un slice end-to-end minim**: o acțiune reală persistentă + una de monetizare (unde aplică) + test. Nu se adâncește până nu funcționează nucleul.

## 5. Securitate & privacy (nu doar la final)
- XSS/SQLi/IDOR/CSRF/SSRF/JWT/replay — testate la fiecare packet care introduce endpoint/storage/socket.
- Fără secret/cheie în cod sau log; fără PII în logs.
- Curățarea MediaStream/URL-uri; permisiuni cameră tratate.
- „localStorage" dispare ca sursă de adevăr odată cu NX-CORE-API.

## 6. Harness de actori sintetici (post-backend)
Personae: new user, heavy poster, creator, seller, buyer, recruiter, job seeker, dating user, spammer, scammer, troll, bot, crypto user, power user, inactive returner. Ei execută journeys reale E2E, apoi se verifică izolarea și anti-abuzul.

## 7. Criterii de eliminare a unei verticale (kill-switch)
O verticală se marchează `DEPRECATED` dacă, după Phase II pe ea:
- nu atinge un „happy path" end-to-end în test determinist; sau
- cere cost/provider nerezonabil fără aprobare; sau
- adaugă risc de conformare (Kids/Adult/Dating) fără gate-ul legal/moderare acceptat; sau
- nu are un diferențiator clar față de competitor (e pură copie).
Decizia se scrie ca ADR + se scoate din nav, fără a șterge istoricul.

## 8. Gates externe (oprire + aprobare owner — NICIODATĂ automat)
- **Hosting/publicare** („vizibil cu laptopul închis") → aprobare owner + alegere Cloudflare Pages / VPS.
- **MultiversX Devnet faucet/tranzacții** → `approval_id`, plafon, monedă, environment, expirare.
- **Audit independent contracte + memo legal** (custodie/DSA/GDPR/AML) → gates umane.
- **Mainnet / fonduri reale / date sensibile** → interzis fără aprobare explicită.

## 9. Definiția de done (fiecare packet)
- build + lint + teste **toate PASS**;
- un test de regresie care blochează revenirea bug-ului;
- **Evidence Pack** (`planning/evidence/...`) cu run_id, subiect content-addressed, hashes artefacte, zero-effects;
- **checkpoint** (`planning/checkpoints/...`) actualizat;
- reviewer independent (sequențial) pentru gate-uri T0/T1.

## 10. Primul pas executabil (zero cost, autonom)
**NX-CORE-API**: creează `services/api` cu un endpoint `/me` (auth issuer–sub + sesiune) și un `StorageProvider` local cu test; apoi leagă clientul (`apps/nexus-web` extras din `apps/nexus-demo`) să citească de la API, nu din `localStorage`.