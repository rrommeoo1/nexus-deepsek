# Messenger — acces efectiv la mesajele de test

2026-09-14. Utilizatorul vedea inbox gol pe portul 3000: eliminarea demo-ului UI nu îi oferea automat acces la baza izolată cu conversații persistente. Aceasta este o problemă de livrare/testabilitate, nu dovada că mesajele au fost șterse.

## Remediere

- Laboratorul existent pornit pe 3100/3543 pentru o sesiune explicită de 7.200 secunde, cu heap 384 MB și disk 256 MB. Implicitul pentru automatizare rămâne 600 secunde.
- `messenger-lab-runtime.mjs` validează strict durata 60–7.200 secunde, refuzând valori invalide/duplicate înaintea operațiilor pe baza de date.
- Launcherul indică acum fișierul de acces, nu fișierul ce conține și secretul serverului.
- Baza de pe 3000, contul proprietarului și inboxul real nu au fost modificate. Fără amestec HUMAN/SYSTEM_TEST și fără mesaje către persoane reale.
- Adresă LAN observată: 192.168.1.153. Link de test HTTP: port 3100; HTTPS pentru cameră: 3543. O filă incognito dedicată evită înlocuirea cookie-urilor contului normal de pe același host.

## Dovezi

- Cinci teste messenger-lab PASS, inclusiv seed idempotent, refuz bază cu utilizatori reali, login real și limite runtime.
- Smoke API pe serverul pornit: login `lab_tester` PASS; 3 conversații Social; fire cu 3/4/4 mesaje, două fotografii. Nu s-au extras date din inboxul proprietarului.
- Patru conversații în seed în total: trei Social și una Work. Nu există răspunsuri automate sau interlocutori simulați prezentați online.
- Browser/telefon: neexecutat. Accesul prin Wi-Fi, certificatul și permisiunile hardware nu sunt validate de smoke-ul API.

Pornire repetabilă din `apps/nexus-web`: `node scripts/messenger-lab.mjs --serve --runtime-seconds=7200`.
Datele și parola rămân în laborator după oprire; serverul nu este permanent. Nu publicați parola sau secretul în repository. Parola de test este livrată proprietarului separat, nu în acest checkpoint.

Restant: integrarea unui acces de test comod în produs, fără schimbarea implicită a contului real; validare vizuală pe telefon. Acest packet face mediul existent accesibil acum, nu pretinde că a populat inboxul normal.
