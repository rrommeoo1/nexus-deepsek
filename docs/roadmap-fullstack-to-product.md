# Nexus — De la demo la produs (roadmap „gândit măreț")

- Data: 2026-08-19
- Regulă guvernantă: `default_deny_spend` (cost incremental 0 implicit), WIP=1,
  maker-checker, Devnet-only pentru orice on-chain.
- Poziție prezentă: demo client-only (`apps/nexus-demo`) validat; fără backend/DB/auth real.

---

## 0. Principiul director

Nu construim „un app + încă 17". Construim **un nucleu** (Identity + Pulse + Pay + Messages)
și ținem restul ca **verticale opționale** activate progresiv. Blockchain intră doar acolo
unde aduce valoare: escrow, proof de identitate, royalty, reputație portabilă.

Designul vizează un singur obiectiv observabil:

> ONE IDENTITY → MULTIPLE PERSONAS → SOCIAL GRAPH → CONTENT → MARKETPLACE → MESSAGING →
> CREATOR ECONOMY → OWNERSHIP/VERIFICATION (on-chain, opțional).

---

## 1. Arhitectura țintă (monorepo, bounded-contexts — deja parțial în `architecture/`)

```
apps/nexus-web        # clientul (extras din apps/nexus-demo)
services/api          # edge runtime (similar worker/index.ts, dar cu route reale)
services/auth         # issuer-sub identity + sesiuni (proof hash)
services/feed         # ranking/search
services/media        # upload/transcode/thumbnail (StorageProvider)
services/messaging    # WebSocket/rooms
services/payments     # Pay + escrow (Devnet)
services/notifications# push/inapp
services/moderation   # trust & safety
contracts/nexus-*     # escrow, receipts, royalties (Devnet)
packages/*            # logica domeniului existentă (reutilizabilă)
```

- **StorageProvider interface** (din secțiunea I a auditului) este PRIMUL contact cu realitatea:
  `LocalStorageProvider` (demo) → `S3CompatibleProvider` (intermediar) →
  `ContentAddressedProvider` (hash = key) → `DistributedNodeStorageProvider` (user-operated, viitor).

- **Un singur „identity provider"** cu **personae izolate** (Social/Work/Dating/Travel/Market)
  — motorul de diferențiere #1. Izolarea e deja modelată în client; în backend devine
  `persona_id` + ACL deny-by-default.

---

## 2. Fazele de livrare (fiecare = packet cu test + evidence + review)

### Phase I — Fundație reală (P0: înainte de orice user public)
1. **NX-CORE-API** — runtime API cu DB real (D1), auth local (WeApp/issuer-sub) și
   `StorageProvider`. Înlocuiește `localStorage` ca sursă de adevăr.
2. **NX-DB-001** — schema: utilizatori, personae, posturi, media, follows, momente.
3. **NX-AUTH-RT** — auth real substituind contul local (email/username + proof hash).
4. **NX-PERSONA-ACL** — izolare hard între personae (impedimentul diferențiatorului #1).
5. **NX-STORAGE-001** — interfață `StorageProvider` + chunked/resumable upload + thumbnail.

### Phase II — Experiența de bază (P1: până la beta)
6. **NX-FEED-001** — feed ranking + paginare (nu doar listă statică).
7. **NX-SEARCH-001** — căutare globală peste users/posts/listings (typo-tolerant).
8. **NX-MSG-RT** — mesagerie WebSocket 1:1/grup (E2EE off-chain).
9. **NX-NOTIF-001** — notificări in-app/push (fără a loga PII/secret).
10. **NX-MOD-001** — moderare + rate-limit + anti-abuz (dansează cu `trust-lens`/`moderation`).

### Phase III — Blockchain orientat pe valoare (P1/P2, Devnet ONLY)
11. **NX-ESCROW-001** — escrow marketplace + settlements (Devnet, apoi audit independent).
12. **NX-RCPT-001** — receipt content-addressed on-chain pentru ownership/attribution.
13. **NX-ROYALTY-001** — distribuții creator cu royalty (nu pentru fiecare like).
14. **NX-REPUTATION-001** — reputație portabilă (hash, nu PII).

### Phase IV — Scale & diferențiere (P2/P3)
15. **NX-MEDIA-PIPE** — transcodare/adaptive streaming/preload.
16. **NX-SYNTH-1000** — harnessul de 100→1000 actori logici pe backend-ul real.
17. **NX-NODE-STORE** — stocare user-operated opțională + CDN edge.
18. **NX-RECO-001** — recomandări unificate cu semnale separate per mod.

---

## 3. Ce NU punem pe blockchain (niciodată, fără excepție)

Mesaje private, PII, video/imaginile mari, feed-uri, like-uri, „conversații temporare",
profiluri de dating, wallet address legat de identitate fără consimțământ explicit.

---

## 4. Decizii de consolidare (diferențiere reală)

- **Nu „18 aplicații"**; ștergem/dezactivăm verticalele neesențiale din prima lansare.
- Nucleu de lansare: **Pulse + Pay + Profiles + Messages**.
- Fiecare modul trebuie să fie „mai simplu decât competitorul lui" — toată această
  arhitectură există ca să permită asta, nu ca să afișeze toate tab-urile.

---

## 5. Gate-uri externe (necesită aprobare explicită, conform AGENTS.md)

- **Hosting / publicare** („vizibil cu laptopul închis"): alegere Cloudflare Pages / VPS + aprobare.
- **MultiversX Devnet faucet/tranzacții**: `approval_id` + plafon + monedă + environment + expirare.
- **Audit independent** contracte + **memo legal** (custodie/DSA/GDPR/AML) = gates umane.

---

## 6. Primul pas executabil (zero cost, autonom)

Portarea clientului existent într-un `apps/nexus-web` curat + un `services/api` schelet care
expune `StorageProvider` și un prim endpoint `/me` — păstrând tot ce funcționează în demo.
Apoi fiecare fază de mai sus devine un packet verificabil, în ordinea dependențelor.