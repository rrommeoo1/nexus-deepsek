# Nexus Cross-Mode Content, Communication and Identity

## 1. Decizii de produs

Numele funcției de postări scurte text/media este **Pulse**. Este un termen propriu,
mai larg decât „tweet”: un Pulse poate conține text, fotografie, clip scurt, link,
poll, citat, repost sau thread. Composerul universal `+` oferă numai acțiunile
permise de modul activ, iar drafturile și audience-ul nu se propagă între profile.

Messages rămâne al doilea tab în toate modurile și agregă conversațiile, dar are
filtre clare `All`, `Social`, `Work`, `Dating`, `Market`, `Travel`, `Business` și
`Requests`. Identitatea de expeditor, notificările, block-list și read receipts
rămân configurabile per profil.

## 2. Stories și Highlights

Autorul alege durata: `1h`, `6h`, `24h`, `3d`, `7d` sau `Until I remove it`.
Conținutul temporar iese din story rail la expirare; opțiunea nelimitată devine
**Highlight** pe profil, astfel încât rail-ul să nu fie dominat permanent. Orice
Story poate fi mutat în Highlight sau arhivat privat înainte de expirare.

Durata aleasă nu ocolește audience, block, copyright, safety, legal hold ori purge.
Dating folosește view-once/expiring media separat, cu screenshot deterrence și
fără salvare/export implicit. Kids are audience și parental controls dedicate.

## 3. Save, offline și Download

Fiecare obiect eligibil are un buton bookmark în aceeași zonă vizuală:

- `Save in Nexus`: colecție privată, separată per profil/mod, cu foldere și search;
- `Available offline`: cache criptat în aplicație, cu expirarea drepturilor;
- `Download to device`: export doar dacă autorul și drepturile media permit.

Exportul conține watermark discret Nexus, creator handle, content commitment și un
cod verificabil. Muzica licențiată, conținutul paid/DRM, Dating, mesageria privată și
media Kids nu sunt exportabile implicit. Autorul vede și poate schimba politica
pentru download-urile viitoare; copiile deja exportate nu pot fi „retrase magic”.
Grantul offline leagă explicit profilul, device-ul, conținutul, key epoch-ul,
licența, starea drepturilor și purge epoch-ul. Expirarea, retragerea, purge-ul sau
revocarea opresc accesul inclusiv după restart. Receipt-ul de export leagă cele
patru câmpuri de watermark, device-ul și artefactul concret generat; content și
device din watermark trebuie să coincidă cu obiectul și destinația cererii.

## 4. Pulse și protecția conversației

Pulse include thread, quote, repost, poll, bookmark, traducere, edit history și
withdrawal tombstone. Repostul păstrează proveniența. Editarea materială creează o
generație nouă. Autorul postării nu poate șterge reply-ul altuia; poate configura
audience-ul înainte de publicare, block, report ori solicita moderare motivată.

## 5. Calls și Meetings

Messages oferă apel audio/video 1:1 și grup. Work adaugă **Nexus Meetings**:

- meeting instant sau programat, link/invite și calendar-ready event;
- waiting room, host/co-host, mute/remove, screen share, hand raise și breakout;
- captions, transcript și recording numai cu indicator și consimțământ explicit;
- chat, fișiere, poll, notes și task follow-up legate de meeting;
- setări de cameră/microfon, background blur, bandwidth adaptation și dial-out doar
  prin provider aprobat ulterior;
- E2EE pentru apelurile eligibile și mod de meeting gestionat cu chei rotite,
  disclosure clar când recording/transcription împiedică E2EE complet.

Dating nu dezvăluie telefonul, emailul sau profilul Work; oferă alias, blur, safety
exit și block/report. Adult și Kids au gates separate. În packetul local nu se
apelează niciun provider RTC și nu se înregistrează persoane reale.
Pentru Dating, receipt-ul E2EE leagă setul canonic de participanți, identitățile
device-urilor, suita criptografică și session-key commitment-ul; schimbarea peerului
sau a device-ului invalidează autorizarea fără a publica date de contact.

## 6. Identitate per mod

Walletul și recovery-ul sunt comune, dar prezentarea este independentă:

| Mod | Identitate afișată implicit | Date obligatorii private |
|---|---|---|
| Social/Pulse/Watch | nickname + handle | nici nume legal, nici vârstă publică |
| Work | nume profesional complet | binding organizație/credential când se verifică |
| Dating | first name sau alias controlat + vârstă | vârstă exactă/adult gate, liveness și consent |
| Adult | alias | dovadă 18+ și country/store eligibility |
| Market/Travel/Business | seller/host/business display name | datele cerute tranzacției și conformității |
| Payments | username unic Nexus | wallet binding și controale antifraudă |

Username-ul de plată este global, case-insensitive, protejat contra lookalike și nu
se reciclează imediat. Handle-urile publice pot fi diferite per profil. Nu există
auto-link public între Work, Social, Dating și Adult fără grant explicit.

## 7. Anti-cumpărare followers

Nexus interzice vânzarea followerilor și nu plătește creatorii după count brut.
Follow-ul are receipt unic; sistemul detectează burst, device/funding clusters,
reciprocitate artificială, conturi inactive și ferme de conturi. Followerii
suspecți rămân vizibili numai în audit/quarantine, sunt excluși din organic ranking,
rewards și eligibility pentru topuri, apoi sunt confirmați ori eliminați cu appeal.

UI poate afișa `qualified audience` separat de count-ul brut. Paid promotion este
etichetată și nu cumpără follow organic. Platforma nu oferă un marketplace de
followers, like-uri ori review-uri.

## 8. Șanse pentru conținut interesant

Fiecare obiect sigur și eligibil primește o fereastră minimă de explorare în
cohortele potrivite. Calitatea se estimează din satisfacție calificată, completion,
save, share, conversație utilă, revenire și răspândire între clustere, nu numai din
watch time ori mărimea creatorului. Ideile noi nu primesc penalizare globală înainte
de minimum sample și confidence.

Platforma poate acorda un boost editorial automat `NEXUS_DISCOVERY` conținutului
promițător, dar boost-ul este etichetat, limitat, cu reason code, policy version și
audit receipt. Nu se amestecă în organic trend și nu favorizează o opinie politică.
„Calitate” nu înseamnă conformitate ideologică: hard gates sunt privacy, rights,
safety și legalitate, iar restul este potrivire cu publicul și feedback calificat.

## 9. Near, For You, Global și Breaking

Suprafețele de discovery folosesc trei lentile explicite:

- **Near**: conținut din oraș/regiune și, implicit, în limbile preferate;
- **For You**: interesele profilului activ, cu mix local/global și control de reset;
- **Global**: trenduri globale normalizate după regiune, limbă, volum și clustere,
  astfel încât o singură țară sau fermă de conturi să nu domine.

Near cere consimțământ și folosește implicit geohash/cohortă aproximativă; locația
precisă este efemeră numai pentru ride, booking ori întâlnirea autorizată. Userul
poate alege orașul manual, dezactiva Near și activa traducerea. Schimbarea profilului
schimbă interesele, limbile și zona fără leakage între Social, Work și Dating.

Aceeași arhitectură se adaptează: Work are `Near / Remote / Global`; Market și
Business au `Near / Ships to me / Global`; Travel are `Near destination / Global`;
Dating are `Nearby / Travel mode` numai prin alegere explicită, fără listă globală
publică a persoanelor; Music/Learning/Wellness au `Local language / Global`.

**Breaking** este o bandă editorial-algoritmică separată. Un card poate fi inserat
rar în For You/Near/Global numai când are impact public major, freshness, relevanță
geografică și confirmare din minimum două surse independente eligibile sau o alertă
de la o autoritate competentă. Cardul arată `Developing`, sursele, timestamp,
confidence, corecțiile și `Why you see this`. Nu poate fi cumpărat, nu depinde de
orientarea politică și nu folosește reacția `Fake` ca verdict. Utilizatorul poate
reduce știrile; alertele public-safety obligatorii urmează strict legea și țara.
Dating, calls și mesaje nu sunt întrerupte. Kids nu primește breaking-news general;
doar informație age-appropriate/guardian-controlled și safety alerts aplicabile.

## 10. Receipts, timp și surse independente

Niciun gate critic nu se bazează pe un boolean trimis de client. Age/adult proof,
wallet binding, Near consent, guardian approval, participant recording consent,
E2EE session, audience/media rights, offline grant, watermark generation, Trust
evidence, sursele Breaking, official alerts și agregatele regionale sunt receipts
semnate. Fiecare receipt leagă subject, object, binding, profil/surface, generation,
jurisdiction, purpose, nonce, policy version, issuedAt și expiresAt. Rolurile AGE,
WALLET, CONSENT, TRUST, SOURCE, OFFICIAL, MEDIA, RIGHTS, MODERATION și DISCOVERY au
rădăcini de autoritate distincte; rotația sau revocarea este verificată înainte de
decizie.

Un enforcement purge semnat leagă regula, reason code-ul, teritoriul, durata și
appeal commitment-ul. Aceste date autorizează acțiunea, dar nu sunt tratate ca
verdict politic sau ca scor editorial.

Timpul de decizie vine dintr-un clock monoton injectat de runtime, nu din request.
Același clock guvernează expirarea Story, promovarea în Highlight, freshness pentru
Breaking, granturile offline și snapshoturile. Replay-ul unui snapshot folosește
timpul istoric semnat numai pentru reconstrucție, iar validitatea snapshotului este
evaluată la timpul curent autoritativ.
Clock-ul și versiunea registry-ului sunt reverificate după fiecare boundary async
și imediat înainte de commit. API-ul public nu poate furniza un timp istoric pentru
a reactiva un receipt expirat; capabilitatea de replay este internă și utilizabilă
numai în reconstrucția unui eveniment semnat.

Global nu acceptă un contor `independentClusters` declarat de client. Un candidat
global trebuie să aibă agregate regionale semnate pentru minimum două regiuni,
calculate numai din actori calificați și trafic curat, apoi normalizate înainte de
combinarea cu interesele profilului. Breaking cere separat Trust evidence și două
source-control roots distincte sau o autoritate oficială înregistrată; două domenii
controlate de aceeași rădăcină nu reprezintă corroborare independentă.

Snapshotul include bundle-ul exact al receipts folosite, statusul de revocare și un
commitment legat de durable checkpoint. Restore pe un registry proaspăt reverifică
issuerul, semnătura, lineage-ul, revocarea și bindingul înainte să refacă proiecțiile.
Restore folosește un registry izolat și îl promovează numai ca parte din rezultatul
valid; orice snapshot expirat în timpul verificării, checkpoint stale, eveniment
invalid sau prefix de nonce lipsă lasă registry-ul furnizat complet nemodificat.

## 11. Packet de implementare

`NX-EXPERIENCE-P01` va demonstra local: lifecycle Story/Highlight, Save/Offline/
Download policy, Pulse thread/repost/edit/withdraw, identity presentation matrix,
Near/For You/Global/Breaking, follower-integrity quarantine și call/meeting
authorization fără provider extern.
Integrarea RTC reală, calendarele externe, DRM/licensing, App Store gates și datele
reale rămân în afara packetului și cer aprobări/provider/legal separate.
