# Messenger: informare despre transport în locul acordului per mesaj

2026-09-14 · decizie de produs cerută explicit de proprietar: „Nu am nevoie de acest acord, scoate-l”.

## Context

Checkboxul `plaintext_ack` ocupa o celulă îngustă din grila editorului, rezultând o coloană înaltă de text pe telefon. Acordul era o restricție frontend; backendul existent acceptă transportul `plaintext_local` pentru participanții autorizați.

## Decizie

Eliminăm checkboxul și condiția frontend care cerea bifarea lui. Nu pre-bifăm și nu stocăm un consimțământ fictiv. Nota scurtă, localizată „Fără E2EE · mesajele pot fi citite de server” apare pe lățimea editorului numai când trimiterea este permisă și E2EE nu este selectat.

Disponibilitatea E2EE și selectarea implicită la dispozitive pregătite rămân neschimbate. Ramura de trimitere criptată rămâne terminală inclusiv la eroare: nu încearcă automat trimiterea plaintext. Autorizarea participanților, separarea profilurilor, Idempotency-Key, scanarea/validarea fișierelor și interdicția distribuirii externe nu se modifică.

Consecință asumată prin cererea de produs: când transportul disponibil/selectat nu este E2EE, apăsarea Trimite poate trimite mesajul în modul plaintext fără o confirmare suplimentară. Nu descriem acel mesaj drept criptat end-to-end. Această modificare nu constituie acceptare pentru producție sau audit independent de securitate.

## Verificare

Teste pe funcția reală de afișare a notei și prevalidarea handlerului real de submit: lipsa checkboxului nu împiedică textul/fișierul nevid; conținutul gol rămâne blocat; nota nu modifică alegerea transportului. Regresiile păstrează ramura E2EE fără fallback și uploadul reluabil/anulabil.

Remedierea layoutului include progresul uploadului pe întreaga lățime a grilei, prevenind repetarea aceleiași probleme la alte elemente auxiliare. Acceptarea vizuală pe telefon rămâne neexecutată.
