# Nexus — reguli de execuție pentru agenți

Aceste reguli se aplică întregului repository. Documentele normative de produs sunt
`docs/00-master-product-spec.md`, `docs/08-integrated-product-addendum.md` și
`docs/09`–`docs/16`. O excepție tehnică se documentează prin ADR; o excepție de
risc cere owner, termen și control compensatoriu.

## Profil implicit: ChatGPT Plus

- Continuitatea are prioritate față de paralelism. Se execută un singur task packet
  de livrare la un moment dat.
- Există autorizare permanentă pentru acțiunile normale de dezvoltare Nexus care
  nu produc cost suplimentar. Subagenții incluși în capacitatea disponibilă pot fi
  porniți automat, dar cel mult un worker rulează alături de agentul principal; un
  checker separat se folosește secvențial pentru riscuri T0/T1.
- Niciun agent nu rămâne activ fără un rezultat delimitat. Fiecare rulare trebuie să
  lase în repository cod, document, test, finding ori Evidence Pack reutilizabil.
- Un packet urmărește un singur rezultat verificabil, atinge de regulă 1–3 fișiere
  sau un bounded context și încape în 0,5–3 zile agentice.
- Se caută țintit cu `rg`; nu se reîncarcă întregul set de documente când sunt
  suficiente referințe precise și artefactele checkpoint-ului anterior.
- Se folosesc modele și reasoning cu cost ridicat numai pentru arhitectură critică,
  fonduri, identitate, privacy/Kids, security și verificarea finală T0/T1.
- Nu se cumpără credite, nu se activează auto-recharge, nu se folosește API plătit
  și nu se modifică abonamentul fără aprobarea explicită a proprietarului.
- Regula financiară universală este `default_deny_spend`: cost incremental maxim
  implicit `0`, indiferent de provider. Include cloud/CI, storage/egress/CDN,
  media, SMS/push/maps, identity/liveness, device farms, licențe, domenii/app stores,
  servicii Matrix/IPFS și gas mainnet.
- O aprobare de cost este validă numai dacă precizează `approval_id`, provider sau
  categorie, plafon, monedă, environment, expirare și owner. Absența oricărui câmp
  înseamnă refuz; free tier-ul nu este presupus gratuit după depășirea cotei.

## Autorizare permanentă fără cost

Fără o confirmare nouă sunt permise, dacă rămân în scope-ul Nexus: citirea și
modificarea repository-ului, rularea testelor/buildurilor locale, cercetarea
read-only, folosirea capacității de agenți deja incluse, dependențe open-source
verificate și operații pe devnet/testnet fără fonduri reale.

Testele sintetice rulează implicit `local_mock_only`, fără credențiale de billing sau
producție și fără egress. Orice destinație de rețea, provider contorizat ori efect
economic trebuie permis explicit de politica machine-readable și de un approval
valid. Limitele per run pentru CPU, timp, disk și procese sunt obligatorii.

Chiar dacă nu au cost monetar, cer în continuare confirmare explicită: ștergeri
materiale sau greu reversibile, publicare/deploy în producție, tranzacții mainnet
ori fonduri reale, mesaje publice în numele owner-ului, acceptarea unor termeni sau
contracte, deschiderea de conturi externe și folosirea datelor reale sensibile.

## Benzi de capacitate

- `GREEN`: utilizare confortabilă — agent principal și maximum un worker
  independent fără cost suplimentar, autorizat permanent pentru scope-ul Nexus.
- `YELLOW`: notificare de consum ori capacitate redusă — numai agentul principal,
  packet mic, teste locale și deterministe; auditul larg se amână.
- `RED`: limită iminentă sau atinsă — se finalizează numai unitatea sigură curentă,
  se salvează checkpoint-ul și dovezile, apoi se opresc taskurile noi până la reset.

Interfața poate afișa capacitatea în mesaje, procente sau ferestre temporale. Agentul
nu inventează un procent dacă acesta nu este disponibil; notează banda și dovada
observabilă. Dacă nivelul este `UNOBSERVED`, se aplică automat regimul `YELLOW`:
numai agentul principal pentru implementare, iar singura excepție este un checker
secvențial al packet-ului curent, fără deschiderea unui workstream nou.

## Testare eficientă

- 90% din volum: teste deterministe, fixtures, state machines, property/fuzz,
  replay și actori virtuali locali.
- 9%: agenți de raționament pentru journeys, adversarial cases și explorare țintită.
- 1%: verificare independentă pentru gates T0/T1 și eșantioane de release.
- „Mii de agenți” înseamnă în principal mii de identități/logical actors simulate,
  nu mii de modele LLM simultane.
- Actorii sintetici sunt marcați `SYSTEM_TEST`, nu folosesc date reale și nu pot
  influența reputația, economia, adopția sau metricile de producție.

## Disciplina livrării

- P0 precede verticalele; dependențele și WIP limits din `planning/` sunt obligatorii.
- Se păstrează schimbările utilizatorului și se evită modificările în afara packet-ului.
- Fiecare schimbare include verificare proporțională cu riscul și un rezumat al
  dovezilor. Lipsa dovezii înseamnă control neexecutat.
- Agenții pot pregăti analiză juridică, threat models și audit evidence, dar opiniile
  juridice, auditul independent și autorizările externe rămân gates umane/formale.
