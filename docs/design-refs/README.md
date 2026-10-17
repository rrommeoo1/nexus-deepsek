# docs/design-refs — referințele vizuale ale owner-ului

Aici stau capturile de referință cerute de owner pentru antetul de profil. **Fișierele nu sunt încă în
proiect**: agentul nu creează imagini, iar cele două capturi au fost trimise doar în conversație.

Pune, te rog, în acest director:

| Fișier | Ce este |
|---|---|
| `tiktok-profile.jpg` | modelul de aranjare (antet de profil fără copertă: nume mare, handle, trei contoare, cerc mare în dreapta, rând de butoane pe toată lățimea) |
| `nexus-profile-actual.jpg` | starea de dinainte a aplicației native (copertă, avatar mic cu inel, nume mic, bandă cu contoare) |

Reguli de folosire, ca să nu se repete eroarea de format:

* agentul **nu deschide** imaginile în conversație; măsurătorile din cerință sunt scrise în
  `docs/PARITY-MATRIX.md` §13 și în `apps/nexus-mobile/src/theme/social.ts` (`identity`, `relations`);
* culorile, fonturile și iconițele rămân ale Nexus: modelul dă **doar** aranjarea;
* comparația numerică pe telefon se face cu `uiautomator dump --compressed` (px fizici ÷ 2.6), iar compozitul
  rezultat se salvează în `docs/parity-report/profile-header/` — tot acolo, nu în conversație.
