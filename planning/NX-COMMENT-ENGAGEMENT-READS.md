# Listele „View likes” și „View quotes” pentru comentarii — etapă API ulterioară

Stare la 2026-10-08: contractul API, schema, citirea nativă și testele sunt **pregătite local**, dar nu au fost trimise pe Railway. În aplicația conectată la backend-ul vechi, taburile arată o eroare explicită, nu o listă fictivă. Nu s-a făcut deploy.

## Contractul disponibil acum

- `GET /api/posts/:id/comments?sort=relevant|newest&cursor=…` livrează comentariile, `reply_count`, sumarul reacțiilor și numărul distribuirilor. Permite cele două filtre reale ale răspunsurilor.
- `POST /api/comments/:id/reaction` schimbă reacția proprie; nu enumeră persoanele care au reacționat.
- `POST /api/comments/:id/share` este o redistribuire internă, nu o citare cu text. `GET /api/comments/:id/context` furnizează lanțul de părinți și sumarul distribuirilor, nu lista lor.
- Nu există endpoint de citire a actorilor `LIKE` și nici model/endpoint pentru citări ale comentariilor. Un contor nu poate fi transformat în listă de persoane sau conținut fără date noi.

## Contractul local pregătit pentru etapa de backend

1. `GET /api/comments/:id/likes?cursor=…&limit=…`: actori cu reacție `LIKE` vizibili (user_id, handle, nume, avatar, persona), `next_cursor`, `total_visible`; aplică `canViewPost` și blocare/mute. Nu amestecă `LOVE` sau alte reacții.
2. `comment_quotes`: citare cu text propriu și referință la comentariul-sursă, distinctă de redistribuirea internă. `GET /api/comments/:id/quotes` listează numai citări active și vizibile; `POST` creează text moderat prin filtrul social existent, cu cheia globală de idempotency; `DELETE /api/comment-quotes/:id` retrage doar propria citare. Nu apar automat în feed/profil și nu se pretinde că reposturile vechi sunt citări.
3. Listele sunt paginate câte 20 (maximum 50) și nu înlocuiesc contoarele din firul existent. Testele locale verifică actori reali, filtrare blocare, paginare, replay idempotent și retragere. Înainte de deploy: revizie de privacy/product pentru vizibilitatea citărilor și plasarea lor în feed/profil, plus confirmarea proprietarului.

Ecranul nativ are deja taburi „Aprecieri” și „Citări” care cer exclusiv endpoint-urile reale. Până la disponibilitatea lor pe Railway arată „Lista nu este disponibilă pe versiunea actuală a backend-ului Railway.”, cu „Reîncearcă”.
