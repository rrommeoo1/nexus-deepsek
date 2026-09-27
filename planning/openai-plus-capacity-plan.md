# Plan de capacitate — ChatGPT Plus

## 1. Decizie

Nexus pornește cu un profil de execuție optimizat pentru un singur abonament
ChatGPT Plus. Acesta este suficient pentru specificații, prototipuri, cod în pachete
mici și validare locală, dar nu reprezintă capacitate nelimitată și nu garantează
funcționarea continuă a mii de modele generative.

Obiectivul este ca atingerea unei limite să producă cel mult o pauză între task
packets, nu pierdere de context, cod sau decizii.

## 2. Cele patru benzi de execuție

| Bandă | Utilizare | Regula Nexus |
|---|---|---|
| A — Plus interactiv | design, implementare, review | un packet activ; root + maximum un worker fără cost |
| B — compute local | teste, simulări, lint, build, fuzz/replay | volum mare, deterministic, fără consum LLM per actor |
| C — credite Codex | vârf temporar de lucru | opțional, numai după aprobarea explicită a owner-ului |
| D — OpenAI API | automatizări proprii în produs/CI | buget și billing separat, numai prin decizie explicită |

Abonamentul ChatGPT și platforma API au administrare și facturare separate. Planul
nu presupune acces API plătit și nu autorizează auto-recharge.

## 3. Politica de consum

### GREEN

- un task packet în lucru;
- maximum un subagent independent, autorizat permanent dacă nu produce cost
  suplimentar și rămâne în scope-ul Nexus;
- taskul trebuie să lase checkpoint și teste înainte de un task nou.

### YELLOW

- numai agentul principal;
- se reduc citirile ample și analiza duplicată;
- se rulează local testele deterministe și se amână auditul explorator larg;
- taskurile noi se taie la un rezultat care poate fi acceptat separat.

`UNOBSERVED` se tratează obligatoriu ca `YELLOW`. Este permis un checker secvențial
pentru packet-ul curent, dar nu un al doilea packet sau workstream.

### RED

- nu se deschide un task sau workstream nou;
- se finalizează sigur operația curentă, fără schimbări distructive;
- se salvează `status`, diff, rezultate de test, riscuri și `next_action`;
- reluarea începe din acel checkpoint după reset ori după o decizie de capacitate.

## 4. Formatul checkpoint-ului

Fiecare packet încheiat sau întrerupt trebuie să poată fi reluat fără istoricul
complet al conversației și conține:

1. `task_id`, obiectiv și stare;
2. fișiere modificate și decizii luate;
3. comenzi/teste rulate și rezultat;
4. riscuri/findings încă deschise;
5. următoarea acțiune exactă și acceptance rămas.

Backlog-ul versionat și Evidence Pack-ul sunt memoria durabilă; conversația nu este
sursa unică de adevăr.

## 5. Testarea la scară

Ținta implicită este `90/9/1`:

- 90% teste locale deterministe: fixtures, personas, state machines, property tests,
  fuzzing, load, replay și failure injection;
- 9% evaluări cu agenți pentru flows complexe, adversarial journeys și triere;
- 1% review independent, concentrat pe T0/T1 și release gates.

Astfel, „10.000 de utilizatori/agenți de test” poate însemna 10.000 de actori
virtuali într-un harness, nu 10.000 de sesiuni LLM. Escaladarea la agenți generativi
se face numai pentru cazurile pe care automatizarea deterministă nu le discriminează.

## 6. Cadenta inițială

- Luni: selectarea unui singur packet `READY` și confirmarea dependențelor.
- În lucru: implementare, self-test, checkpoint după fiecare rezultat acceptabil.
- Review: checker secvențial pentru T0/T1; pentru risc mai mic, review țintit.
- Vineri sau la final de packet: actualizare scorecard, consum observat, blocaje și
  calibrarea dimensiunii packet-ului următor.

După primele patru săptămâni, A00 măsoară throughput-ul real și recalculează
timeline-ul. Estimările macro din program presupun 4–6 workstreams; un singur Plus
seat rulează intenționat mai puține workstreams și poate mări durata calendaristică.
Nu se promite un multiplicator exact înainte de măsurarea primului ciclu.

## 7. Guardrails financiare și de date

- orice credit, auto-recharge, upgrade sau API plătit cere aprobare explicită;
- `default_deny_spend` se aplică tuturor providerilor și resurselor contorizate,
  nu doar OpenAI; plafonul incremental implicit este zero;
- aprobarea conține obligatoriu ID, provider/categorie, plafon, monedă, environment,
  expirare și owner; fără toate câmpurile, apelul rămâne blocat;
- testele pornesc local/mock, fără billing/prod credentials și fără egress; limitele
  de CPU, timp, disk și procese sunt verificate înainte de rulare;
- acțiunile ireversibile, producția, mainnet/fondurile reale, comunicarea publică și
  acceptarea de obligații externe cer aprobare chiar dacă nu au cost monetar;
- se urmărește costul per accepted packet, nu numărul brut de mesaje sau agenți;
- nu se trimit secrete, chei private, PII, date Dating ori date Kids în contexte de
  test; fixtures sunt sintetice și minimizate;
- setarea de folosire a conversațiilor pentru îmbunătățirea modelelor se verifică
  înainte ca repository-ul să conțină informații confidențiale de producție.

Configurația executabilă este `planning/spend-control.yaml`; testul negativ și
validarea packet-ului sunt în `planning/validate-capacity.ps1`. Până când Platform
livrează un sandbox de rețea mai puternic, numai comenzile care trec acest guard pot
fi declarate zero-cost synthetic evidence.

## 8. Criterii de succes

- niciun packet pierdut la resetarea limitei;
- maximum un packet activ și zero agenți idle;
- majoritatea volumului de test este determinist/local;
- toate cheltuielile suplimentare au decizie explicită;
- timeline-ul se bazează pe throughput observat, nu pe presupunerea de capacitate
  nelimitată.

## 9. Surse oficiale

- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-chatgpt)
- [Using Credits for Flexible Usage in ChatGPT](https://help.openai.com/en/articles/12642688)
- [ChatGPT și API au facturare separată](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api)
- [Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)
