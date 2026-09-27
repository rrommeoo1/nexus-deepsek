# Checkpoint NX-WEB-V1 — Nexus local full-stack product

- Data: 2026-08-19
- Task: transformare demo în produs local funcțional (web3 social, MultiversX devnet).
- Stare: livrat local, testat, server rulează pe `0.0.0.0:3000`.

## Livrabile
- `apps/nexus-web/` — produs complet (server Node + SQLite + media + frontend).
- `apps/nexus-web/test/core.test.js` — 9 teste deterministe (repo/security/media/mvx).
- `apps/nexus-web/test/audit.test.js` — 4 teste de audit static.
- `apps/nexus-web/scripts/actors.js` — 50 actori sintetici SYSTEM_TEST.
- `apps/nexus-web/.env.example` + `README.md`.
- `planning/evidence/NX-WEB-V1.json` — Evidence Pack.
- `planning/checkpoints/NX-WEB-V1.md` — acest checkpoint.

## Rezultate verificate
- `node --test`: 13/13 PASS.
- Actorii: 50 useri, 50 postări, 50 follow, 50 like, 50 comentarii, 17 mesaje, 10 listări, 50 acțiuni devnet; invarianți PASS.
- HTTP E2E: health 200, page local 200, page LAN 200, signup 201, postare 201, feed 200, devnet 200.

## Reluare / pornire
```bash
node apps/nexus-web/server.js
```

## Gates externe rămase (nu auto)
- hosting public / domeniu — aprobare owner.
- Google/Facebook live — chei client din partea owner-ului (`.env`).
- audit independent + memo legal — gates umane.