# Nexus pe Wi-Fi — mediul de lucru 3100

Adresa de lucru aleasă de owner: **http://192.168.1.153:3100/**.
3000 este mediul inițial; 3100 rulează același cod, cu baza separată
`test-labs/messenger/nexus.sqlite`. Diferențele vizibile pot proveni din cont,
date și starea sesiunii, nu dintr-o versiune de cod mai avansată.

## Ce este real și ce rămâne de test

Autentificarea, conversațiile, mesajele și atașamentele folosesc backendul real și
se păstrează în SQLite. Contactele fictive rămân SYSTEM_TEST; nu sunt persoane
reale, nu răspund automat și nu se inventează livrări/apeluri/prezență.
Acesta este un mediu local de dezvoltare, nu un release de producție sau un serviciu
pentru date sensibile. Share-ul extern și providerii plătiți nu sunt activați.

Contul existent este `lab_tester@nexus.test`; parola rămâne cea din
`test-labs/messenger/access.md`. Nu publica acel fișier sau `lab.json`.
Nu se regenerează secretul sesiunii, parolele ori datele la pornire.
Cookie-urile sunt comune porturilor aceluiași host: folosește numai 3100 în aceeași
fereastră sau un context de browser separat dacă testezi și 3000.

## Pornire și operare

Task Scheduler: **Nexus Messenger 3100**, contul Windows Romeo, la logon,
drepturi normale, fără parolă în comandă. Taskul rulează un singur proces Node;
o pornire repetată nu creează o a doua instanță. Nu există termen de două ore.
Există și un trigger de recuperare în fiecare minut: pornește serverul dacă este
oprit, dar nu întrerupe procesul deja activ. Setarea Windows de trei restarturi la
eșec nu a recuperat o terminare externă în testul local; recuperarea nu se bazează
doar pe acea setare.

Comenzi PowerShell din folderul aplicației:

```powershell
# Instalare/reinstalare a exact aceleiași configurații
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-messenger-workspace.ps1
Start-ScheduledTask -TaskName 'Nexus Messenger 3100'
Get-ScheduledTask -TaskName 'Nexus Messenger 3100'
Get-ScheduledTaskInfo -TaskName 'Nexus Messenger 3100'
# Oprire intenționată fără repornire periodică; nu șterge datele
Disable-ScheduledTask -TaskName 'Nexus Messenger 3100'
Stop-ScheduledTask -TaskName 'Nexus Messenger 3100'
# Reactivare după o oprire intenționată
Enable-ScheduledTask -TaskName 'Nexus Messenger 3100'
Start-ScheduledTask -TaskName 'Nexus Messenger 3100'
```

Pentru pornire manuală, numai când taskul și vechiul server temporizat sunt oprite:

```powershell
node --max-old-space-size=384 scripts/messenger-workspace.mjs
```

Nu porni simultan vechea comandă `messenger-lab.mjs --serve`: portul este ocupat.
Acea comandă rămâne pentru verificări limitate în timp, 600 secunde implicit,
maximum 7200. Nicio simulare de actori nu devine permanentă.

Health local: `http://192.168.1.153:3100/health`.
Log operațional: `test-labs/messenger/workspace.log`, maximum 1 MiB, rotire prin
înlocuirea jurnalului vechi. Heap Node: 384 MiB. Directorul de date este limitat
la 256 MiB, verificat la pornire și la 30 secunde. Dacă este depășit, serverul se
oprește cu eroare și păstrează datele; nu șterge încărcări sau mesaje automat.
Discul plin și problemele de Windows necesită diagnostic local; la o eroare
persistentă, dezactivează taskul înainte de intervenție. Disponibilitatea absolută
nu este garantată.

## Condiții de acces de pe telefon

- Laptop pornit, utilizatorul Windows autentificat, conectat la același Wi-Fi,
  fără repaus/hibernare. Blocarea ecranului nu este logoff; logout-ul oprește
  sesiunea interactivă. Autostartul este la login, nu înainte de login.
- Routerul trebuie să permită comunicarea între dispozitive. IP-ul actual este
  192.168.1.153; dacă DHCP îl schimbă, se schimbă și adresa. Nu s-au modificat
  routerul, rezervările DHCP, firewall-ul sau setările de repaus.
- HTTP 3100 permite verificarea mesageriei, dar nu garantează cameră live,
  microfon, WebAuthn ori E2EE în browser. Pentru acestea există aceeași aplicație
  la **https://192.168.1.153:3543/**, cu certificat local care trebuie să fie
  acceptat ca valid pe dispozitiv. Nu se dezactivează securitatea browserului.
- Accesul nu este public pe internet și nu funcționează din alt Wi-Fi fără
  infrastructură suplimentară. Nu a fost configurat niciun tunel extern.

## Dovezi din instalare

Pe 2026-09-14: task instalat/rulat, pornirea duplicată păstrează același PID;
health prin IP-ul LAN HTTP 200; login cu contul existent HTTP 200 și cookie de
sesiune emis. Înainte/după schimbarea launcherului: 3 utilizatori, 13 mesaje,
același digest al fișierului de credențiale. Baza de pe 3000 nu a fost modificată.
Recuperarea periodică a fost verificată prin terminarea controlată a procesului:
Windows a repornit automat serverul la 20:53:06 (Europe/Warsaw), fără comandă
manuală de start; health și autentificarea au revenit la HTTP 200, cele 13 mesaje
și credențialele fiind păstrate. Firewall-ul existent permite executabilul Node;
nu a fost lărgită nicio regulă de acces.
Testarea din telefon și un reboot/login Windows real nu au fost executate.
