# Nexus Social pe Wi-Fi — portul 5000

Task Scheduler păstrează aplicația reală Nexus Social disponibilă pe portul 5000:

- task: `Nexus Social 5000`;
- pornește la logon;
- dacă procesul se oprește, încearcă din nou în cel mult un minut;
- rulează cu drepturi normale, fără modificări de router, firewall sau sleep;
- folosește baza și conturile existente; nu rulează seed-uri sau simulări;
- nu activează servicii plătite.

Instalare sau verificare:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-social-workspace.ps1
Get-ScheduledTask -TaskName 'Nexus Social 5000'
Get-ScheduledTaskInfo -TaskName 'Nexus Social 5000'
```

Oprire intenționată:

```powershell
Disable-ScheduledTask -TaskName 'Nexus Social 5000'
Stop-ScheduledTask -TaskName 'Nexus Social 5000'
```

Reactivare:

```powershell
Enable-ScheduledTask -TaskName 'Nexus Social 5000'
Start-ScheduledTask -TaskName 'Nexus Social 5000'
```

Health local: `http://localhost:5000/health`.
Telefon pe același Wi-Fi: `http://192.168.1.153:5000/` cât timp această adresă LAN rămâne alocată laptopului.

