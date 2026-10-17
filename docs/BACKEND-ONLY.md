# Backend-ul rămas: inventar pentru aplicația nativă

Produsul final este aplicația Android nativă (`apps/nexus-mobile`). Web-ul (`apps/nexus-web`) nu mai este
interfață: **nu se șterge nimic și serviciul nu se oprește** — rămâne backend-ul (API, SQLite, fișiere) pe
Railway, plus bundle-ul static din care aplicația citește versiunea. Documentul este inventar, nu plan de
ștergere.

## 1. Endpoint-uri folosite de aplicație

Sesiune și identitate: `/api/me`, `/api/persona/switch`, `/api/onboarding`, `/api/onboarding/handle`.

Profil și relații: `/api/profiles/:handle`, `/api/social/relations`, `/api/follow`, `/api/follows`,
`/api/follow/requests`, `/api/follow/requests/:id`, `/api/profile/block`, `/api/profile/mute`.

Feed, postări, reacții: `/api/social/feed`, `/api/social/search`, `/api/social/live`, `/api/posts`,
`/api/posts/:id`, `/api/posts/:id/reaction`, `/api/posts/:id/repost`, `/api/posts/:id/save`,
`/api/posts/:id/share`, `/api/posts/:id/comments`.

Comentarii: `/api/comments/:id`, `/api/comments/:id/{reaction|save|share|report}`, `/api/comments/:id/versions`.

Stories și mesaje: `/api/stories`, `/api/stories/:id/view`, `/api/chat/conversations`,
`/api/chat/conversations/:id/messages`, `/api/chat/search`.

Notificări: `/api/notifications`, `/api/notifications/:id`, `/api/notification-preferences`.

Publicare și fișiere: `/api/uploads` (+ `/parts/:index`, `/complete`, `/cancel`), `/api/creator/drafts`
(+ `/:id`), `/api/reels/sound-suggestions`, `/media/*` (imaginile, cu cookie-ul sesiunii).

Versiunea backend-ului: `GET /app.js` — aplicația citește `NEXUS_BUILD_VERSION` din bundle-ul static al
web-ului. **Acesta este singurul motiv** pentru care `apps/nexus-web/public` rămâne servit.

## 2. Ce are nevoie Railway

Documentația completă există deja în `docs/railway-persistent-deployment.md`; pe scurt:

* build din `Dockerfile` de la rădăcină (`node:24-bookworm-slim`, `npm ci --omit=dev`, `CMD node apps/nexus-web/server.js`);
* **un** volum montat la `/data`, cu `NEXUS_DATA_DIR=/data` — baza SQLite și media sunt derivate din el;
* health check `GET /health`, o singură replică (SQLite nu scalează orizontal);
* variabile: `NODE_ENV=production`, `HOST=0.0.0.0`, `NEXUS_DEPLOYMENT_MODE=preview`,
  `NEXUS_DATA_DIR=/data`, `NEXUS_MEDIA_STORAGE_PROVIDER=local-content-addressed`,
  `NEXUS_RATE_LIMIT_MODE=trusted-edge`, `NEXUS_TRUST_PROXY=1`, `NEXUS_MVX_NETWORK=mainnet`,
  `NEXUS_SESSION_SECRET` (≥32 caractere), `NEXUS_ORIGIN`, `NEXUS_ACCEPTED_ORIGINS`; `PORT` vine de la Railway.

## 3. Ce din web nu mai este folosit ca interfață

`apps/nexus-web/public/*` (HTML, CSS, `app.js` și celelalte module de browser) nu mai este produsul: numai
`app.js` este citit, pentru `NEXUS_BUILD_VERSION`. Rutele și fișierele rămân pe disc și în container
nenișate, ca să nu se strice serviciul sau testele web existente.

## 4. Modificări de backend cerute de aplicație

### 4.1 `joined_at` în răspunsul de profil (aditiv, neimplementat pe main)

Banda de profil are citirea «Membru din <lună an>». Serverul are `users.created_at` (unix secunde), dar
**nu îl trimite** în payload-ul de profil, deci rândul lipsește pe telefon (regula: o citire fără dată nu
se inventează).

Modificare propusă — un singur câmp, în `apps/nexus-web/lib/api.js`, în obiectul `profile` al răspunsului
`GET /api/profiles/:handle` (lângă `age`):

```js
// Data creării contului, în secunde unix: banda o tipărește ca „Membru din <lună an>".
// Este o informație publică despre vechimea contului, nu despre persoană.
joined_at: Number(target.created_at) || null,
```

Compatibil înapoi: câmp adăugat, niciun câmp existent nu se schimbă; clienții care nu îl citesc îl ignoră.
Test: `apps/nexus-web/test/profile-joined-at.test.js` — citește profilul altcuiva și al propriu, verifică
`joined_at` egal cu `users.created_at` și absența lui din răspunsurile de eroare.

Stare: **pregătit pe branch-ul `backend/profile-joined-at` (commit `c430839`), testat local pe o bază veche
(fixture cu `openDb(':memory:')` + `createRepo`): `node --test test/profile-joined-at.test.js` 2/2, plus
celelalte teste de profil (19/19). Fără push și fără deploy.** Aplicarea pe Railway se face numai după
aprobarea proprietarului.

### 4.2 Data nașterii pentru cititorii altor profiluri — **nu** se schimbă

Serverul are `personas.birth_date` și trimite `birth_date` **numai proprietarului** (`api.js:3003`), iar
`age` derivat pentru toți. Aplicația recalculează vârsta local când primește data (propriul profil) și
tipărește numărul serverului în rest. Nu propunem extinderea `birth_date` la alți cititori: ar fi o
schimbare de confidențialitate, nu o necesitate tehnică.
