# Fluxuri principale de utilizator

Notation: `[C]` client, `[A]` API, `[W]` wallet, `[X]` MultiversX, `[M]` Matrix.

## 0. Orice acțiune socială

1. Utilizatorul face like/comment/follow/save/share/message sau altă mutație.
2. `[C]` aplică optimistic state și construiește `ActionEnvelope` canonic.
3. Cheia de sesiune autorizată de wallet semnează envelope-ul în secure storage.
4. `[A]` verifică scope, context, nonce, privacy, rate și sponsorship quota.
5. Action Relay trimite exact un `recordAction` către contractul shardului.
6. `[X]` verifică session signature și emite `ActionRecorded`.
7. Indexer-ul marchează `ORDERED_FINAL`, apoi `EXECUTED_SUCCESS`; la eșec, UI face
   rollback/retry conform intenției idempotente.

Pentru chat/Dating/report, tipul on-chain este generic și conține numai commitment.
Operațiile financiare sar peste session capability și cer wallet signature explicită.

## 1. Onboarding social → wallet embedded

1. `[C]` utilizatorul alege Google, Apple, Facebook sau TikTok; `Am deja wallet`
   deschide xPortal, web wallet, extension sau Ledger.
2. Providerul oficial autentifică prin OIDC/Login Kit cu PKCE, state și nonce.
3. `[A]` validează issuer, subject, audience, nonce și expiry; emailul nu auto-leagă.
4. `[A]` creează/reia `Account`; Wallet Provider creează sau recuperează wallet-ul
   embedded fără ca Nexus să primească seed/private key complet.
5. `[C]` prezintă 18+, țară, Terms/Privacy, CountryPolicy și consimțăminte separate.
6. Utilizatorul configurează passkey/recovery și poate vedea adresa/export/migrare.
7. Se creează primul context; wallet-ul autorizează capability de sesiune, cu gas
   sponsorizat și fără popup la fiecare acțiune socială.
8. La prima plată/prag valoric apare step-up, suma/token/beneficiar și explicația
   ownership/recovery/ireversibilitate.
9. `Security Center` permite linkarea altui social login sau xPortal/Ledger; link/
   merge cere dovada controlului ambelor identități.

Erori tratate: provider refuzat/indisponibil, token replay, issuer/audience greșit,
identitate deja legată, recovery factor lipsă, wallet provider outage, account
conflict, relayer indisponibil și țară/funcție neeligibilă.

## 2. Creare și comutare profil

1. Din avatar, utilizatorul vede profilurile și notificările agregate minimal.
2. Selectează un context nou sau „Create profile”.
3. Composer-ul cere câmpurile strict specifice contextului și audience default.
4. Înainte de publicare, afișează ce informații pot corela profilul cu wallet-ul.
5. Comutarea actualizează atomic `activeProfileId` al sesiunii.
6. Toate tab-urile, composer-ul, search și inbox afișează o bandă cromatică a
   contextului activ; o mutație cu un context vechi primește `409 CONTEXT_STALE`.

## 3. Linkare Work + Social

1. Proprietarul inițiază link-ul din ambele profiluri proprii sau trimite o cerere.
2. Alege audiența care poate vedea legătura și ce atribute sunt partajate.
3. Confirmă distinct din fiecare context.
4. Acceptarea/revocarea produce tranzacție; un link privat publică numai commitment.
5. Oricare profil poate revoca link-ul; caches/search sunt invalidate imediat.

## 4. Feed video

1. `[C]` cere pagina cu `activeProfileId`, cursor și capability context.
2. `[A]` generează candidați, elimină block/privacy/moderation și re-rankează.
3. Clientul preîncarcă primul segment al următoarelor 1–2 clipuri.
4. Impresia se înregistrează idempotent; view-ul calificat urmează pragul definit.
5. Like/comment/follow sunt optimistic UI, fiecare primește propriul tx și devine
   definitiv numai după `CONFIRMED`.
6. „Not interested” are efect imediat și este semnal negativ mai puternic.
7. Utilizatorul poate deschide „Why this?” și reseta recomandările profilului.

## 5. Upload video, duet și stitch

1. Composer-ul verifică profilul activ, drepturile asupra sunetului și audience.
2. API emite signed multipart upload; clientul trimite direct în object storage.
3. Checksum finalizează upload-ul; status `PROCESSING`.
4. Pipeline-ul rulează probe, malware, transcoding, thumbnails și moderare.
5. `READY` pregătește manifestul; publicarea trimite `POST_CREATE` tx cu hash/CID.
   `REJECTED` oferă motiv și apel.
6. Duet/stitch creează un proiect cu `sourceContentId`, interval permis și licență;
   sursa este creditată chiar dacă embed-ul este ulterior ascuns.

## 6. Dating discovery → match → chat

1. Utilizatorul activează profilul Dating și finalizează verificarea 18+.
2. Setează preferințele, distanța și ce câmpuri sunt vizibile; locația exactă nu
   este afișată și se discretizează.
3. API filtrează reciproc criteriile, block-list și safety, apoi livrează carduri.
4. Swipe-ul rămâne privat ca payload, dar produce un tx `PRIVATE_ACTION` distinct,
   cu salt și commitment, și este limitat anti-abuz.
5. Like-ul mutual produce un alt tx commitment pentru `Match` și deschide chat E2EE;
   fiecare mesaj/edit/tombstone are propriul tx commitment.
6. În chat sunt vizibile unmatch, block, report și share-plan safety.
7. Unmatch revocă accesul viitor; politica de retenție păstrează minimul necesar
   pentru safety/reporting, nu profilul complet.

## 7. Marketplace OLX-like și escrow opțional

1. Seller-ul deschide Market din orice context; sistemul comută identitatea de
   tranzacție la profilul Market și alege categoria/schema.
2. Completează titlu, descriere, atribute, locație, stare, preț/negociabil și media,
   apoi alege `CLASSIFIED_ONLY` sau `ESCROW_CHECKOUT`.
3. Moderarea verifică bunuri interzise, scam, duplicate, trader/product safety.
4. Manifestul este stocat off-chain/IPFS public opțional; `LISTING_CREATE` tx
   publică hash/CID. Anunțul devine vizibil după confirmare.
5. Fiecare edit, renew, close, favorite, share și ofertă are propriul tx.
6. În modul classified, buyer-ul discută în chat; fiecare mesaj are tx commitment,
   iar Nexus avertizează că plata externă nu are protecție escrow.
7. În modul protejat, oferta acceptată produce quote cu expirare și checkout-ul
   afișează seller, bun, token, principal, fee, livrare și refund terms.
8. API construiește `fundOrder`; wallet-ul buyer-ului semnează.
9. Indexer-ul confirmă on-chain și comanda devine `FUNDED`, apoi seller acceptă.
10. Seller marchează fulfillment; buyer confirmă și fondurile devin withdrawable.
11. La timeout se aplică regula snapshot. La problemă, buyer/seller deschide dispută,
   încarcă probe criptate și escrow-ul rămâne blocat până la rezoluție.
12. Review-ul are tx cu rating și hash/CID; outcome-ul verificabil actualizează trust.

## 8. Stay booking

1. Guest caută pe hartă; coordonatele exacte apar numai după confirmare, conform
   politicii listing-ului.
2. Selectează intervalul; API face lock DB scurt și cere snapshot on-chain.
3. Guest vede totalul, tokenul, fee-urile, politica de anulare și regulile.
4. Wallet-ul finanțează `requestBooking`; calendarul trece `EXECUTION_PENDING`.
5. După confirmare, host acceptă sau expiră; inventarul este reconciliat.
6. Chatul primește cardul booking, instrucțiuni și safety center.
7. Check-in/out sunt confirmate; contractul eliberează după fereastra de dispute.
8. Anularea calculează split-ul din politica înghețată la booking.

## 9. Mobility: solicitare și finalizare cursă

1. Rider-ul activează Mobility, alege pickup/dropoff și accessibility needs.
2. API-ul calculează ruta, ETA, distanța și quote-ul complet cu expirare, token,
   platform fee, cancellation/no-show și maximum autorizat.
3. Rider-ul confirmă cererea; dispatch-ul trimite oferte unui grup mic de șoferi
   eligibili, online și apropiați, fără a expune date altor profiluri.
4. Primul accept valid atribuie atomic cursa. Rider-ul vede numele contextual al
   șoferului, ratingul Mobility, fotografia, vehiculul și numărul de înmatriculare.
5. Wallet-ul rider-ului finanțează escrow-ul/autorizează maximum-ul; dacă chain-ul
   nu confirmă în interval, cursa nu pornește și ambii primesc un status clar.
6. Șoferul navighează la pickup; rider-ul poate share-trip sau contacta safety.
7. La întâlnire, rider-ul comunică PIN-ul unic; hash-ul confirmă startul, PIN-ul nu
   este trimis on-chain și nu se afișează șoferului înainte.
8. În cursă, tracking-ul este efemer și accesibil doar participanților/safety.
9. Șoferul marchează finalul; tariful este cel cotat sau o ajustare permisă sub
   maximum. Depășirea cere autorizare nouă, nu debit automat.
10. Rider-ul confirmă sau fereastra expiră; contractul distribuie plata și fee-ul.
11. Ambii lasă rating Mobility. Accidentul, traseul greșit, no-show sau suma
    contestată intră în incident/dispute cu probe criptate.

Fallback-uri: rider/driver cancel, driver nu ajunge, GPS indisponibil, pierderea
conexiunii, wallet/refund pending, schimbarea vehiculului și SOS. Nicio stare critică
nu depinde exclusiv de un singur ping GPS sau de disponibilitatea blockchain-ului.

## 10. Event și split payment

1. Creatorul alege profilul Social, participanți, buget și deadline.
2. Fiecare invitat vede suma, beneficiarul și politica de refund.
3. Contribuțiile pot fi custodiate într-un escrow dedicat/booking compatibil; nu
   sunt simple promisiuni în chat.
4. La atingerea condiției, plata este executată; altfel fiecare își retrage partea.
5. Ticket-ul SFT/NFT este opțional și nu conține date personale.

## 11. Tip către creator

1. Din video/live, utilizatorul alege suma/tokenul și vede fee/split.
2. Wallet-ul semnează `tip`; pentru micro-tips se poate folosi un balance pre-funded
   doar într-o fază ulterioară și cu consimțământ separat.
3. Indexer-ul confirmă, creatorul primește notificare și retrage prin pull payment.

## 12. Report, moderare și apel

1. Reporterul selectează obiectul, categoria și risc imediat.
2. Pentru chat E2EE, alege explicit mesajele decriptate trimise ca probă.
3. API publică un tx commitment al raportului, confirmă receipt și ID; conținutul
   probei rămâne criptat. Triage-ul prioritizează safety/ilegal/fraud.
4. Moderatorul vede numai datele necesare și aplică măsură verticală/globală.
5. Persoana afectată primește motiv, regulă, durată și cale de apel.
6. Apelul este revizuit de alt operator pentru măsuri serioase; toate accesările și
   schimbările sunt auditate.

## 13. Frizer/coafor: găsire → programare → review

1. Utilizatorul deschide Services și permite locație aproximativă sau introduce orașul.
2. Caută serviciul, filtrează preț/disponibilitate/rating și vede clar organic vs promovat.
3. Deschide Business Page, alege serviciu, staff și slot.
4. Primește quote cu preț, durată, depozit, anulare și no-show snapshot.
5. Pentru depozit semnează wallet transaction; altfel session key semnează action tx.
6. După `EXECUTED_SUCCESS`, primește confirmare, calendar și reminders.
7. La sosire folosește PIN/QR; reschedule/cancel/check-in sunt tranzacții distincte.
8. După finalizare/policy settlement primește o singură eligibilitate de review.
9. Review-ul arată `programare verificată`; business-ul poate răspunde/contesta.

## 14. Promovare transparentă

1. Business/creator selectează un obiect eligibil și creează campania.
2. UI afișează buget, durată, audiență permisă, estimare și fee; create este action tx.
3. Creative-ul trece identity, safety și rights review.
4. Advertiser-ul finanțează/autorizează bugetul separat.
5. Utilizatorul vede `Promovat`, beneficiarul și „De ce văd asta?”.
6. Impresia/click-ul rămâne telemetrie; like/save/order produce tx-ul său normal.
7. Advertiser-ul primește raport antifraud și settlement reconciliat.

## 15. Music: ascultare și artist payout

1. Artistul verificat încarcă master, credits, splits, teritorii și dovezi de drepturi.
2. Release-ul rămâne blocat până la clearance; conflictul intră în rights queue.
3. Utilizatorul pornește piesa; `PLAY_START` produce action tx, progress nu.
4. Like/save/playlist/share au fiecare action tx și feedback vizibil.
5. Sistemul califică usage off-chain cu anti-fraud și generează statement periodic.
6. Statement-ul este finanțat și ancorat; payee-ul claim-uiește EGLD/ESDT aprobat.
7. Takedown-ul oprește teritoriul/asset-ul afectat și păstrează dreptul la contestație.

## 16. Grow: program general și curs

1. Utilizatorul alege Nutrition, Sport sau Learn și vede limita wellness/educațională.
2. Salvează un obiectiv privat; tx-ul are commitment generic, nu conținutul obiectivului.
3. Urmează o lecție/antrenament și controlează ce progres este păstrat sau partajat.
4. Pentru coach/tutor alege Business Page, verifică credentialele și face programare.
5. Pentru curs plătit semnează checkout; enrollment devine activ la execuție reușită.
6. La final primește certificat de completion; „acreditat” apare numai dacă verificat.
7. Datele Grow nu intră în Dating, Work, ads sau reputație globală.

## 17. Ștergere și export

1. Utilizatorul cere export semnat din Safety Center.
2. Job-ul colectează datele pe profil, linkurile și tranzacțiile, separând datele
   care provin din chain și nu pot fi șterse.
3. Ștergerea oferă opțiune per profil sau cont, cu avertisment despre escrow activ.
4. Un tx tombstone anunță ștergerea; profilul este ascuns imediat, jobs șterg
   media/index/cache după retention rules,
   iar cheile obiectelor criptate sunt distruse unde se aplică.
5. Înregistrările fiscale, antifraudă, dispute și state on-chain se păstrează numai
   pe temeiul și durata documentate; utilizatorul primește raport final.

## 18. Business creează un agent delegat

1. Owner-ul alege template-ul: support, content, booking sau marketing.
2. UI arată badge-ul AI, datele accesate, țările, endpoint-urile și bugetul.
3. Owner-ul semnează capability cu TTL/max actions/max spend; payout/ownership sunt excluse.
4. Agentul trece sandbox/conformance și publică Agent Card semnat.
5. În conversații apare `AI agent for {Business}` și opțiunea human escalation.
6. Publicarea/DM-ul urmează scopes/opt-in; fiecare mutație produce tx `actor_kind=AGENT`.
7. Owner-ul inspectează log/cost/results și poate suspenda/revoca instant.

## 19. Agent extern descoperă și angajează alt agent

1. Agentul requester caută skill/country/protocol în Agent Registry.
2. Verifică Agent Card, controller, status, preț, data classes și reputație task.
3. Cere quote; policy engine verifică capability, country și payment allowance.
4. Pentru depășirea bugetului sau efect financiar, omul primește approval request.
5. Task-ul rulează prin A2A/MCP sandbox și emite status/artifact/receipt.
6. Requester-ul acceptă sau deschide dispută; escrow-ul face settlement.
7. Outcome-ul intră numai în agent reputation și agent metrics, nu în Human MAU.

## 20. Dating: preferințe → Compatibility Card → match

1. Persoana activează Dating cu alias, vizibilitate și consimțământ separat; aplicația
   verifică 18+ înainte de discovery complet.
2. Selectează cum se descrie, persoanele pe care dorește să le întâlnească și tipul
   relației. Câmpurile pot fi ascunse public și nu sunt deduse automat.
3. Configurează filtre obligatorii și preferințe flexibile; poate exclude categorii,
   dar nu poate cere filtrare discriminatorie pe etnie, sănătate sau „scor social”.
4. Primește Compatibility Cards cu motive inteligibile, diferențe importante,
   badge-uri de verificare și data ultimei liveness — nu un procent magic.
5. Swipe-ul produce un `PRIVATE_ACTION` generic; targetul și decizia rămân off-chain.
6. La interes reciproc se creează match-ul și un canal E2EE; fiecare parte poate
   unmatch/block/report fără penalizare automată de reputație.

## 21. Dating Trust Passport și întâlnire sigură

1. Utilizatorul poate parcurge Photo Match, ID/age provider și Recent Liveness;
   Nexus păstrează claims cu expirare, nu documentul/biometria dacă nu este necesar.
2. Înainte de întâlnire, ambele părți pot face video call și văd exact ce claims sunt
   valabile; lipsa unui badge nu este prezentată automat ca vinovăție.
3. Meet Safe propune loc public, interval, contact de încredere și check-in timer.
4. La întâlnire, participanții confirmă separat prin PIN/QR; locația exactă rămâne
   criptată și nu ajunge pe chain.
5. Lipsa confirmării declanșează check-in privat, nu sancțiune publică. Un no-show
   afectează numai semnalul contextual după notificare și drept de apel.
6. `SOS` contactează imediat canalul local/ales și safety desk; tx-ul de audit este
   best-effort ulterior, niciodată o condiție pentru ajutor.

## 22. Poză View Once

1. După match, destinatarul acceptă explicit o cerere de media temporară.
2. Clientul criptează poza cu o cheie unică; upload-ul conține ciphertext și TTL.
3. Destinatarul vede avertismentul că o cameră externă nu poate fi blocată, apoi
   deschide o singură dată; cheia este invalidată la închidere/timeout.
4. Download, forward și backup sunt dezactivate; protecția OS și watermark-ul sunt
   aplicate unde platforma permite.
5. Dacă apare abuz, destinatarul poate raporta în timpul vizualizării; copia de probă
   intră explicit în evidence vault. La MVP, nuditatea/conținutul explicit este blocat.

## 23. Pulse: publicare discretă prin alias

1. Persoana creează un alias persistent și vede clar că este pseudonim public, nu
   anonimat absolut față de Nexus sau față de o cerere legală validă.
2. Alege audiența, cine poate răspunde/cita/menționa și dacă postarea expiră.
3. Composer-ul verifică doxxing, amenințări, impersonare și date personale; postarea
   publică produce action tx legat de alias, fără wallet/nume în conținutul indexat.
4. Replies, reposts, quotes și likes au propriile tx și stări pending/confirmed.
5. Un report ascunde urgent conținutul cu risc; enforcement-ul se aplică tuturor
   aliasurilor aceluiași cont, cu motiv și apel.
6. DM-ul pseudonim pornește numai după accept mutual; nu există chat aleator anonim.

## 24. Community Context și trenduri curate

1. Un utilizator uman eligibil propune o notă contextuală cu surse; acțiunea este
   publică și semnată prin alias.
2. Conturi umane cu perspective diverse evaluează utilitatea; agenții și test bots
   nu pot vota, iar brigading-ul reduce/îngheață distribuția.
3. Nota apare numai după pragurile de calitate și diversitate, cu istoric și apel.
4. Trends separă activitatea umană organică de paid, agent și synthetic traffic;
   cumpărarea promovării nu poate crea un trend „organic”.

## 25. Clips: creare → distribuție → feedback

1. Creatorul filmează/încarcă, editează, adaugă captions și selectează un sound eligibil.
2. Alege audience, remix permissions, rating și declară paid/synthetic content.
3. Pipeline-ul verifică malware, media, rights și safety, apoi produce renditions.
4. Publicarea semnată produce tx; Clip-ul intră în For You numai după eligibility.
5. Viewer-ul poate folosi Following/For You, vede „de ce”, oferă not-interested și
   poate reseta recomandările; like/comment/save/follow au câte un tx.
6. View/progress/skip sunt telemetrie cu TTL și nu produc tranzacție.

## 26. Watch: canal → video long-form → subscription

1. Owner-ul creează canal personal/Business și atribuie editor/moderator/analyst.
2. Încarcă resumable master-ul și completează title, thumbnail, chapters, captions,
   audience, territory, rights și synthetic/paid disclosures.
3. Rights/safety precheck aprobă publicarea; tx-ul fixează manifestul și versiunea.
4. Viewer-ul găsește video prin Search, Home, Subscriptions sau Editorial și poate
   vedea explicația recomandării.
5. Subscribe, bell, like, comment, Watch Later și playlist mutation produc tx-uri;
   playback progress rămâne off-chain și poate fi șters/resetat.
6. Creator Studio afișează satisfaction/retention, rights, reports și revenue fără
   a recompensa artificial clickbait-ul.

## 27. Live: schedule → stream → replay

1. Creatorul eligibil programează live-ul, audience, chat policy și moderatorii.
2. Providerul managed verifică ingestul RTMP/SRT/WebRTC, redundanța și precheck-ul.
3. `start` produce tx, dar emergency terminate funcționează fără chain; playerul
   primește LL-HLS și chatul rulează separat.
4. Chat messages persistente, polls și tips au tx; reactions animate, packets și
   presence sunt efemere. Moderatorul poate slow/disable chat ori termina stream-ul.
5. După end, recording-ul intră în rights/moderation VOD; numai replay-ul aprobat
   devine video Watch.
6. Tips/payout așteaptă execuție confirmată și sunt reconciliate înainte de retragere.

## 28. Părinte creează Nexus Kids

1. Adultul deschide Family Center, trece reauth și declară țara/relația de autoritate.
2. Primește notice potrivit jurisdicției și acordă consimțământul parental verificabil.
3. Creează child profile cu age band, limbă și avatar generic; copilul nu primește wallet.
4. Configurează time limit, bedtime, autoplay, search, topics/channels și Live off/on.
5. Kids binary primește un child session limitat exclusiv la Kids API/tenant.
6. Părintele poate vedea/șterge history, bloca un canal, revoca sesiunea/consimțământul
   și exporta/șterge profilul.

## 29. Copilul vizionează în Nexus Kids

1. Home returnează numai catalogul eligibil pentru country × age band × rights.
2. Copilul alege o colecție finită; autoplay este off implicit și timerul este vizibil.
3. Search sigur nu poate ieși din indexul Kids; „de ce văd?” folosește limbaj simplu.
4. Favorite/progress/feedback rămân criptate off-chain și ștergibile, fără tx individual.
5. La limita de timp, UI-ul încheie calm sesiunea; nu folosește streak, scarcity sau
   notificări care presează continuarea.
6. Live este disponibil numai dacă părintele permite și creatorul este verificat;
   nu există child broadcast, DM sau chat liber.
