# Nexus Engagement Integrity și Viral-Fair Ranking

## 1. Decizia

Nexus păstrează patru intenții distincte în toate suprafețele:

1. `Like` — apreciere sau relevanță pozitivă;
2. `Not for me` — preferință negativă privată, numită conform modului;
3. `Report` — suspiciune de încălcare a unei reguli;
4. `$ Support` — transfer economic voluntar.

Un dislike nu este raport, verdict de adevăr, sancțiune, rating al persoanei ori
motiv direct de retragere a banilor. Creatorul nu poate șterge reacțiile ori
conținutul altora. Autorul își poate retrage sau corecta propriul conținut, dar
operația produce o versiune nouă ori un tombstone și nu rescrie event log-ul.

## 2. Limbajul UI pe mod

| Mod/suprafață | Semnal negativ | Vizibilitate | Efect permis |
|---|---|---|---|
| Social, Clips, Pulse, Watch, Live replay | `Not for me` | numai actorului; agregat privat creatorului | personalizare imediată, semnal global calificat |
| comentarii/replies | `Disagree / Not useful` | fără total public implicit | ordine personală și quality model, nu moderare |
| Work feed | `Not relevant` | privat | topic/job relevance |
| Work profil/CV/persoană | fără dislike | — | block/report separat |
| Dating discovery | `Pass` | complet privat | elimină candidatul pentru actor; zero reputație |
| Marketplace/Travel/Business listing | `Not interested` | privat | personalizare; zero seller/host score |
| review verificat | `Helpful / Not helpful` | agregat rezistent la abuz | ordinea review-urilor, nu ratingul comerciantului |
| Music | `Less like this` | privat | track/artist taste; fără deducere directă de royalties |
| Learning/Wellness | `Not useful for me` | privat | recomandări personale |
| Kids | `Show me less` | local/privat | control explicit al feedului, fără count competitiv |

Pentru accesibilitate, fiecare icon are etichetă textuală, feedback tactil și undo.
`Report` nu este ascuns în spatele dislike-ului.

### 2.1 Reacții expresive

Tap pe butonul principal înseamnă `Like`; long-press deschide o paletă scurtă,
adaptată modului. Social/Pulse/Watch/Live folosesc `Love`, `Haha`, `Wow`, `Sad` și
`Angry`; Work folosește `Celebrate`, `Support`, `Insightful` și `Curious`;
Marketplace/Travel/Business rămân la `Love` și `Wow`; Music folosește `Love`,
`Haha`, `Wow`, `Sad`; Learning și Wellness favorizează `Insightful`, `Curious` și
`Support`; Kids păstrează numai `Love`, `Haha`, `Wow`, fără clasamente publice.
Dating nu are reacții publice asupra persoanei: numai interes privat, `Pass` și
complimente private controlate de destinatar.

Nexus afișează reacția `Fake` pe conținutul Social. În modelul de date aceasta este
`FAKE_OPINION`: opinia utilizatorului contează în sentiment și ranking după aceleași
praguri de unicitate, confidence și anti-brigading ca dislike-ul. Numărul brut nu
este public și semnalul nu produce direct takedown ori un verdict factual. Agregatul
poate solicita o analiză Trust Lens. Reacția nu este disponibilă pe persoane,
Dating sau Kids. Eticheta separată `AI-generated/provenance` vine din dovezi și
modele calibrate; conținutul creat cu AI nu este presupus fals.

## 3. Event log și dreptul de retragere

### 3.1 Evenimente append-only

```text
PUBLISH(v1)
  ├── LIKE(actor A)
  ├── DISLIKE(actor B)
  ├── UNDO_DISLIKE(actor B)
  ├── EDIT(v2, previous=v1, material=false)
  ├── EDIT(v3, previous=v2, material=true, generation=2)
  └── WITHDRAW(reason=AUTHOR_REQUEST) → TOMBSTONE
```

Nu există `UPDATE reaction` ori `DELETE event`. Undo adaugă un eveniment și face
reacția inactivă în proiecția curentă. O singură reacție este activă per
`actorProfileCommitment + objectCommitment + generation`.

### 3.2 Editare

- corecțiile de formatare/ortografie păstrează generația, dar afișează `Edited`;
- schimbarea media, linkului, prețului, afirmației principale, destinatarului ori
  sensului produce generație nouă;
- semnalele de ranking nu se transferă automat la o generație material diferită;
- istoricul public arată diferențele necesare pentru conversație, fără a expune
  date șterse legal ori informații private.

### 3.3 Retragere și ștergere

Autorul poate retrage postarea sau comentariul. Corpul și media dispar din public,
cache, index și feed conform purge policy; proiecția afișează `Retras de autor`.
Rămân numai identificatorul generic, versiunea, momentul și receipt-ul necesar
pentru integritate, antifraudă, dispute ori legal hold justificat.

Comentariile altor persoane nu devin proprietatea autorului postării. Dacă postarea
este retrasă, thread-ul poate rămâne sub un tombstone când audience-ul și siguranța
permit. În spații private, Dating și Kids se aplică politica mai restrictivă.

„Nu poate fi șters” înseamnă că nimeni nu poate rescrie în secret istoricul sau
șterge feedbackul altuia. Nu înseamnă publicare eternă a datelor personale și nu
anulează privacy, safety, copyright, ordinele autorităților ori drepturile legale.

## 4. Puterea creatorului asupra comentariilor

Creatorul poate:

- configura înainte de publicare `everyone`, `connections`, `followers` sau
  `comments off`;
- bloca un cont pentru interacțiuni viitoare;
- ascunde local un comentariu doar pentru propria experiență;
- raporta un comentariu cu o categorie și dovadă;
- solicita `HOLD_PENDING_REVIEW` pentru risc de safety, cu cotă anti-abuz.

Creatorul nu poate:

- șterge ori modifica reacția/comentariul altui autor;
- elimina selectiv review-uri negative;
- transforma dislike-ul în report;
- modifica totalurile sau event log-ul;
- plăti pentru eliminarea feedbackului.

Trust Lens sau moderarea aplică `MODERATION_TOMBSTONE` cu rule/version, teritoriu,
durată, statement of reasons și appeal. Dacă hold-ul creatorului nu este confirmat,
comentariul revine automat. Marketplace, Travel și Business permit numai dispute
pentru review verificat; comerciantul nu are hide direct.

## 5. Vizibilitatea dislike-ului

- publicul vede butonul și propria stare, nu totalul;
- creatorul vede un agregat întârziat, praguit și fără identități;
- volumele mici sunt afișate ca interval, nu număr exact;
- reacțiile suspecte/carantinate sunt excluse din creator analytics;
- Dating/Work-person/Kids nu expun nici măcar agregatul persoanei vizate;
- exporturile pentru audit/research sunt agregate și controlate.

Ascunderea totalului public reduce ținta pentru dislike raids, păstrând în același
timp semnalul util pentru recomandări.

## 6. Pipeline-ul de ranking

```text
candidate generation
 → hard eligibility (privacy/block/age/rights/moderation)
 → personal relevance
 → qualified satisfaction
 → integrity and cluster quarantine
 → exploration/freshness floor
 → diversity and creator-cap rerank
 → reason code + impression receipt
```

### 6.1 Semnal personal

`Not for me` reduce imediat conținutul similar pentru actorul care l-a apăsat.
Preferința este izolată per profil; un `Pass` din Dating nu schimbă Work, iar un
`Not relevant` din Work nu schimbă Social decât prin grant explicit.

### 6.2 Semnal global

Dislike-ul intră în penalizarea globală numai dacă sunt îndeplinite simultan:

- impresie unică și reacție autentică, una per actor/obiect/generație;
- actor uman eligibil; `AGENT`, `SYSTEM_TEST`, paid și incentivized sunt excluse;
- minimum de eșantion efectiv și minimum de clustere independente;
- contribuția unui device/wallet/funding/social cluster este plafonată;
- rata este normalizată la expuneri eligibile, limbă, cohortă și baseline-ul
  formatului, nu la numărul brut de views;
- intervalul de încredere indică nemulțumire persistentă, nu zgomot;
- burst-ul nu este în carantină pentru coordonare, reciprocitate sau brigading.

Baseline-ul de simulare pornește cu minimum `50` impresii efective, `10` clustere,
maximum `10%` contribuție per cluster și penalizare globală plafonată la `20%` din
scor. Aceste valori sunt policy-versioned și se calibrează separat pe suprafață;
nu sunt promisiuni fixe de producție.

Dislike-ul singur nu produce `REMOVE`, `SHADOWBAN`, strike, reputație negativă sau
deducere financiară. Semnalele de safety merg prin Trust Lens și `Report`.

### 6.3 Viralitate sănătoasă

Scorul viral folosește combinația:

```text
qualified completion / useful dwell
+ rewatch or return
+ save / share / follow conversion
+ conversation quality
+ cross-cluster and cross-region velocity
+ freshness and exploration
- confident dissatisfaction
- integrity risk
- creator concentration
```

Nu optimizăm exclusiv watch time ori conflictul. Un trend organic cere distribuție
între clustere independente; paid, agentic, synthetic și quarantined nu intră în
organic velocity.

### 6.4 Protecția ideilor și creatorilor noi

- `exploration floor` rezervă inițial 10% din inventarul eligibil al unei cohorte
  pentru conținut nou/divers; procentul este policy-versioned;
- nicio penalizare globală din dislike înainte de confidence gate;
- creator cap împiedică dominarea feedului de câteva conturi;
- topic diversity și serendipity evită bulele;
- un conținut controversat, dar sigur, caută cohorta potrivită în loc să fie eliminat;
- utilizatorul poate alege Following, Recent sau un feed neprofilat.

## 7. Anti-abuz

Risk engine-ul verifică:

- rate și burst pe actor/device/wallet/network bucket;
- conturi noi, funding comun, device sharing și impossible travel;
- grafuri reciproce de like/dislike și comunități foarte dense;
- acțiuni sincronizate după link extern ori call-to-action;
- discrepanța dintre dwell, completion și reacție;
- ferme de conturi, agenți nedeclarați și sponsorizare ascunsă.

O reacție suspectă intră `QUARANTINED`, nu este ștearsă. După reevaluare devine
`QUALIFIED` sau `DISQUALIFIED`, cu receipt. Creatorul nu este penalizat în timpul
incertitudinii. Actorul poate contesta limitarea contului.

## 8. Reputație și bani

- like/dislike brut nu modifică Trust Passport, Dating seriousness, seller rating,
  host rating sau professional score;
- reputația comercială vine din review-uri eligibile după order/booking/ride;
- creator rewards nu plătesc per click brut, ci dintr-un pool cu unique qualified
  audience, retenție, satisfacție și fraud reserve;
- dislike-ul nu retrage bani deja câștigați;
- `$ Support` este explicit, cu sumă, fee și recipient înainte de semnare.

Această separare reduce atât engagement farming, cât și atacurile economice prin
dislike.

## 9. Blockchain și cost

Fiecare reacție produce un `ActionEnvelope` semnat și un receipt one-time în Nexus
Action Ledger. Pentru cost și privacy, relația brută actor→obiect rămâne off-chain
criptată; batch-uri ordonate produc Merkle commitments ce pot fi ancorate pe
MultiversX. O dovadă poate demonstra includerea fără publicarea grafului social.

O tranzacție L1 separată pentru fiecare dislike ar expune preferințe sensibile,
ar facilita analizarea Dating și ar crea state/gas inutil. Modul public explicit
poate folosi relayed/meta-transactions, dar default-ul global este receipt semnat +
batch commitment. Transferurile `$ Support` și settlement rămân tranzacții on-chain.

## 10. Transparență și control UE

UI oferă `Why am I seeing this?`, parametrii principali ai rankerului, resetarea
preferințelor și alegerea între `For You`, `Following`, `Recent` și `Unprofiled`.
Aceste controale susțin transparența recommenderelor cerută de
[DSA, art. 27](https://eur-lex.europa.eu/eli/reg/2022/2065/oj).

Pentru Kids, semnalele explicite și controlul copilului/părintelui au prioritate,
fără public counts sau mecanici persuasive. Ghidurile Comisiei din 2025 recomandă
control mai mare asupra feedului și reducerea designului adictiv:
[Comisia Europeană](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors).

Politica păstrează dislike-ul util, dar totalul nu este public. Această alegere este
aliniată și cu observația publică YouTube că ascunderea count-ului a redus atacurile
coordonate, fără eliminarea butonului:
[YouTube](https://support.google.com/youtube/thread/134791097?hl=en&msgid=138209442).

Documentul este specificație de produs și control tehnic, nu opinie juridică.

## 11. Acceptance gates

- creator erasure, cross-profile leakage și reaction overwrite: zero;
- dislike→takedown/reputation/payment direct paths: zero;
- same actor/object/generation active reactions: maximum unu;
- paid/agent/synthetic/quarantined contribution la organic trend: zero;
- new-content exploration floor respectat pentru fiecare cohortă eligibilă;
- brigading corpus nu schimbă rankul organic înainte de qualification;
- edit/withdraw/undo/restore produc aceeași proiecție deterministă;
- receipt lineage, batch root și replay protection sunt verificabile;
- network/provider/economic/real-fund effects în packet-ul local: zero.
