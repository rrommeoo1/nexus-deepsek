# Listele „View likes” și „View quotes” pentru comentarii — etapă API ulterioară

Stare la 2026-10-08: **neimplementate**. Proprietarul a aprobat pregătirea unei etape API ulterioare, nu un deploy. Nu se afișează butoane native care mimează aceste liste până există răspunsuri reale de la server.

## Contractul disponibil acum

- `GET /api/posts/:id/comments?sort=relevant|newest&cursor=…` livrează comentariile, `reply_count`, sumarul reacțiilor și numărul distribuirilor. Permite cele două filtre reale ale răspunsurilor.
- `POST /api/comments/:id/reaction` schimbă reacția proprie; nu enumeră persoanele care au reacționat.
- `POST /api/comments/:id/share` este o redistribuire internă, nu o citare cu text. `GET /api/comments/:id/context` furnizează lanțul de părinți și sumarul distribuirilor, nu lista lor.
- Nu există endpoint de citire a actorilor `LIKE` și nici model/endpoint pentru citări ale comentariilor. Un contor nu poate fi transformat în listă de persoane sau conținut fără date noi.

## Propunere pentru etapa de backend, înainte de implementare

1. `GET /api/comments/:id/reactions?kind=LIKE&cursor=…&limit=…`: actori vizibili (id, handle, nume, avatar, persona), `next_cursor`, `total_visible`. Aplică `canViewPost` și regulile existente de blocare/mute; nu expune conturi sau reacții private prin număr ori paginare. `View likes` trebuie să însemne `LIKE`, nu suma tuturor tipurilor de reacții.
2. Definiție de produs pentru „quote”: postare/comentariu nou cu text propriu și referință verificată la comentariul-sursă. Redistribuirea internă existentă nu este o citare. După stabilirea formei și a regulilor de vizibilitate, `GET /api/comments/:id/quotes?cursor=…&limit=…` ar întoarce citările vizibile și paginarea; crearea unei citări necesită un contract separat.
3. Teste de autorizare, blocare/mute, ștergere/retragere a sursei, paginare stabilă, retry și contori coerenți. Fără date fictive, fără chei în APK, fără modificări de producție înainte de acordul de deploy.

După disponibilitatea endpoint-urilor pe Railway, ecranul nativ al comentariului poate adăuga cele două taburi funcționale lângă „Cele mai relevante” și „Cele mai noi”.
