# Autentificare xPortal — identificator obligatoriu lipsă

2026-09-14 · packet delimitat · UNOBSERVED/YELLOW · verificare secvențială T1.

## Dovezi și diagnostic

- Captura utilizatorului arată aplicația principală pe portul 3000, nu laboratorul 3100. Contul `lab_tester@nexus.test` este creat numai în baza izolată a laboratorului.
- Login API pe serverul activ 3100 cu parola existentă: HTTP 200, ok=true, handle=lab_tester. Parola nu a fost schimbată și nu este inclusă în acest checkpoint.
- Clientul `src/wc-client.js` trimitea finalizarea NativeAuth fără Idempotency-Key. Serverul solicită cheia înaintea validării tokenului.
- Reproducere locală pe serverul activ 3000, cu token invalid SYSTEM_TEST și fără cheie: HTTP 400, code=IDEMPOTENCY_KEY_REQUIRED. Nu s-a folosit portofel real și nu s-a creat o sesiune în acel test.

## Remediere

- O cheie aleatoare de 128 biți, cu prefix xportal, păstrată în memoria obiectului de pairing și atașată cererii de finalizare.
- Reutilizare la repetarea aceleiași finalizări după pierderea răspunsului; pairing nou = cheie nouă. Nu se stochează tokenul sau cheia în localStorage prin acest fix.
- Validarea semnăturii și protecțiile backend de replay rămân neschimbate; refuzul aprobării nu ajunge la endpointul de sesiune.
- Bundle recompilat cu dependențele locale: `node scripts/build-wc.mjs`. Cache app/bundle `20260914-xportal17`. Nu este necesară repornirea backendului pentru această schimbare client.

## Verificare

- 11 teste WalletConnect PASS, inclusiv verificarea cheii cu validatorul backend real, aceeași cheie/body după răspuns pierdut, cheie diferită pentru pairing nou și lipsa cererii HTTP după refuzul walletului.
- `release:check`: PASS, 80 fișiere teste, 1.000 actori, 0 issues, health PASS, insecure_api_denied=true, isolated_data=true, external_network=false, real_funds=false, incremental_cost=0.
- Checker secvențial read-only: fără findings blocante; a rerulat independent cele 11 teste (PASS). A confirmat limita: reluarea finalizării apelează din nou provider.login; stabilitatea key/body a fost verificată pentru semnătură identică în mock, nu pentru reluare pe portofel fizic.

## Limite

Nu s-a efectuat o semnare reală xPortal pe telefon. Pairing-ul, reluarea transportului mobil și acceptarea server-side a unei semnături reale rămân gate fizic; rezultatele locale nu dovedesc că toate cauzele posibile ale erorii din captură au dispărut. Nu s-au ocolit verificările NativeAuth și nu s-au schimbat conturi/parole reale, abonamente sau servicii externe.

Utilizatorul trebuie să reîncarce pagina 3000 pentru noul bundle și să pornească o conectare nouă; pentru datele de test folosește 3100 într-o filă incognito dedicată, pe același Wi-Fi. Cookie-urile aceluiași host sunt comune porturilor.
