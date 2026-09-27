# Messenger — eliminarea acordului și repararea grilei editorului

2026-09-14 · un packet · agent principal · cost incremental 0.

Cerere explicită: eliminarea acordului cu bifă din captura de conversație. Prioritate față de heartbeatul generic Social, fără workstream paralel.

- Eliminat complet câmpul `plaintext_ack` și blocarea submitului bazată pe bifă. Nu există acceptare ascunsă sau consimțământ preselectat.
- Înlocuit cu o informare scurtă RO/EN/PL/AR, pe întreaga lățime a grilei, vizibilă numai când trimiterea este disponibilă fără E2EE selectat.
- Progresul uploadului primește și el întreaga lățime, nu o celulă de 44 px. Drepturile backend, profilurile, idempotency și ramura criptată terminală rămân neschimbate.
- Decizie și consecințe: `docs/adr/ADR-MESSENGER-TRANSPORT-NOTICE.md`. Inventarul a fost actualizat transparent: controlul de acord per-intent a fost înlocuit cu controlul de informare/fără fallback după eroare E2EE, nu declarat păstrat.
- Versiune cache app/locale/CSS: `20260914-compose2`.

Verificare: 14 teste țintite PASS; apoi `release:check` PASS, 80 fișiere, 1.000 actori, 0 issues, health PASS, transport nesigur refuzat în smoke production, date izolate, fără rețea externă/fonduri/cost. Primul gate a semnalat inventarul care încă cerea vechiul checkbox; actualizat conform deciziei utilizatorului, apoi verificat din nou.

Laboratorul 3100/3543 expirase; repornit pentru maximum 7.200 secunde, cu aceeași bază izolată și aceleași conturi. Nu s-au modificat datele contului real. Pornirea serverului confirmată, nu și accesul fizic de pe telefon. Browserul nu a fost folosit; acceptarea vizuală rămâne deschisă.

Restante din captura utilizatorului: simplificarea mesajelor de capabilitate audio/video și validarea layoutului pe telefon; acestea nu sunt declarate remediate prin eliminarea acordului.
