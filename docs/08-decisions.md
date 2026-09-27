# Registrul deciziilor

Data de referință: 2026-08-01.

| ID | Decizie | Motiv principal |
|---|---|---|
| D-001 | Numele de lucru rămâne **Nexus** | Exprimă legătura dintre identitățile de context; lansarea este condiționată de clearance de marcă. |
| D-002 | Aplicația adultă este 18+ în MVP | Dating, plăți, marketplace, stays și ride sharing rămân inaccesibile minorilor; Nexus Kids este produs separat ulterior. |
| D-003 | Un `Account` wallet-rooted, maximum un profil activ din fiecare tip | Reduce impersonarea și păstrează separarea contextuală. Profilurile suplimentare de același tip vin după validare. |
| D-004 | Profilurile sunt contexte, nu wallet-uri distincte | Utilizatorul comută instantaneu fără fragmentarea fondurilor și recovery-ului. |
| D-005 | Nu există „social score” scalar global | Un scor unic este manipulabil, discriminatoriu și periculos pentru privacy. Folosim vectori de reputație pe domenii. |
| D-006 | Payload-uri minime on-chain | Fiecare acțiune are tranzacție, dar chain-ul primește tip, commitments și hash/CID; PII și plaintext privat rămân off-chain. |
| D-007 | Fără token NXS transferabil la lansare | Evită complexitatea MiCA, speculația și stimulentele toxice înainte de product-market fit. |
| D-008 | EGLD + ESDT-uri aprobate pentru plăți | Menține UX MultiversX și permite o unitate de cont mai stabilă pentru comerț. |
| D-009 | NestJS modular monolith în MVP | Tranzacții locale, operare simplă și dezvoltare rapidă; serviciile grele pot fi extrase ulterior. |
| D-010 | PostgreSQL este sursa de adevăr off-chain | Integritate relațională pentru identitate, rezervări, comenzi și permisiuni. |
| D-011 | S3-compatible + CDN pentru video; IPFS doar pentru artefacte selectate | Streaming performant și posibilitatea de ștergere, cu ancorare descentralizată doar unde aduce valoare. |
| D-012 | Matrix E2EE pentru chat în prima versiune | Protocol matur pentru 1:1, grupuri, dispozitive și rotația cheilor; integrarea rămâne în spatele unei interfețe proprii. |
| D-013 | Calculul feedului/matching-ului este off-chain, acțiunile au commitments on-chain | Ranking-ul cere viteză/privacy; existența mutațiilor rămâne verificabilă prin tx. |
| D-014 | Escrow-urile sunt separate pe Marketplace, Booking și Mobility | Au stări, anulări, dispute, timp real și obligații comerciale diferite. |
| D-015 | Relayed transactions v3 au buget și politici antifraudă | UX gasless, fără a transforma relayer-ul într-un robinet nelimitat. |
| D-016 | Moderarea publică este server-side; chatul E2EE este moderat prin raportare voluntară | Nu promitem simultan confidențialitate absolută și scanare server-side imposibilă. |
| D-017 | Lansare geografică limitată | MVP în România/SEE, cu interfață română și engleză; extinderea urmează verificări locale. |
| D-018 | Contractele sunt upgradeable prin multisig + timelock, apoi progresiv imutabile | Permite corecții inițiale, dar limitează riscul administrativ. |
| D-019 | Operatorul nu păstrează seed phrases sau chei wallet | Semnarea rămâne în wallet-ul utilizatorului. Cheile operaționale sunt în HSM/KMS și multisig. |
| D-020 | Orice acțiune cross-profile cere consimțământ explicit | Previne coliziunea contextelor Work, Social și Dating. |
| D-021 | Mobility este al șaselea context, cu roluri Rider și Driver | Datele de localizare, reputația și documentele șoferului cer izolare proprie. |
| D-022 | Ride sharing MVP este un pilot urban simplu | A→B, quote, match, tracking, PIN, escrow, rating, SOS și dispută; fără pooling sau multi-stop. |
| D-023 | Locațiile de cursă nu sunt on-chain | Traseul și coordonatele sunt date sensibile; chain-ul păstrează numai quote/ride commitments și settlement. |
| D-024 | Mobility se activează public numai după autorizare locală | În România, platforma și operatorii/vehiculele au cerințe specifice de transport alternativ. |
| D-025 | Orice mutație intenționată este o tranzacție MultiversX distinctă | Like, comment, follow, post, ad, offer, message, swipe, booking și ride produc câte un tx; telemetria efemeră este exclusă. |
| D-026 | `nexus-actions` este deployat per shard | Menține acțiunile sociale intra-shard cât mai des și reduce latența față de un contract unic. |
| D-027 | Cheile de sesiune semnează acțiuni sociale | Wallet-ul acordă capability limitată; relayer-ul trimite tx-ul, iar contractul verifică semnătura aplicației fără popup la fiecare like. |
| D-028 | Acțiunile private folosesc commitments prin privacy relay | Chat/Dating au tx distinct, dar nu publică plaintext, target sau legătura dintre persoane. |
| D-029 | Fără batching semantic | Cerința 1 acțiune = 1 tx are prioritate; indexer-ul poate agrega numai read models, nu tranzacțiile. |
| D-030 | Marketplace devine classifieds generalist OLX-like | Orice categorie legală este permisă prin scheme de categorie; Market este accesibil din toate contextele. |
| D-031 | Compatibilitate duală `ANDROMEDA_COMPAT`/`SUPERNOVA` | Activarea se face prin capabilități live; finalitatea ordonării nu este confundată cu succesul execuției. |
| D-032 | Supernova nu schimbă modelul de privacy/custody | Viteza mai mare nu justifică PII on-chain, wallet popup eliminat pentru bani sau lipsa reconcilierii. |
| D-033 | Business este entitate organizațională, nu profil personal nou | Același salon/artist/gym/școală poate avea membri, locații și produse fără a fragmenta multi-profilul. |
| D-034 | Programările locale folosesc `nexus-appointments` | Sloturile scurte, staff, no-show și pay-at-venue au altă mașină de stări decât stays. |
| D-035 | Promotion Engine este transversal și transparent | Paid/organic sunt separate; reclamele au beneficiar/plătitor/why-this-ad și nu folosesc date sensibile. |
| D-036 | Review Graph este pe domenii și eligibilitate | Nu există rating public Dating/health sau scor unic; review-ul verificat cere o acțiune eligibilă. |
| D-037 | Music pornește cu catalog independent licențiat | Experiența poate fi Spotify-like, dar catalogul comercial este blocat de rights matrix și acorduri. |
| D-038 | `PLAY_START` este tx, progresul audio nu | Acțiunea intenționată este verificabilă; heartbeats/buffering/progress rămân telemetrie. |
| D-039 | Royalties folosesc statements/root/claim | Chain-ul distribuie fonduri auditate, dar nu decide ownership și nu numără stream-uri brute. |
| D-040 | Grow MVP este wellness/educație W0/W1 | Diagnostic, tratament și personalizare clinică sunt excluse; datele Grow nu intră în ads/Dating/Work. |
| D-041 | Cost minim prin B2B și fair-use sponsorship | Utilizarea socială normală este sponsorizată; business, promovare și fees protejate finanțează gas-ul cu caps. |
| D-042 | Nexus este Global Core + Country Capability Packs | Rețeaua este worldwide, dar funcțiile reglementate se activează legal per țară/oraș. |
| D-043 | Social login este onboarding-ul principal | Google/Apple/Facebook/TikTok creează sau recuperează automat un wallet embedded; wallet login rămâne alternativă. |
| D-044 | Emailul nu leagă și nu unește conturi | Identitatea este `(issuer, subject)`; merge cere dovada controlului ambelor conturi/wallet-uri. |
| D-045 | Embedded wallet rămâne non-custodial și exportabil | xAlias/passkey sau threshold MPC auditat; Nexus nu poate reconstrui singur cheia. |
| D-046 | Agenții au tip de identitate distinct | `AgentProfile` și `actor_kind=AGENT`, badge AI, controller, manifest, capabilities și revocation. |
| D-047 | Test bots nu populează producția umană | Synthetic Town/devnet/staging; probes canary sunt marcate și fără review/reward/commercial effect. |
| D-048 | Growth agents sunt opt-in și autentici | Inbound, conținut oficial și API-uri aprobate; fără fake humans, scraping, spam, engagement rings sau astroturfing. |
| D-049 | Agent-to-agent este o verticală economică | A2A/MCP discovery, tasks, escrow și agent reputation separate de Human MAU/GMV. |
| D-050 | Agenții nu intră în Dating sau review-uri | Previne decepția, fake testimonials, safety risk și contaminarea reputației umane. |
| D-051 | Preferințele Dating sunt incluzive, voluntare și izolate | Genul, persoanele dorite și intenția sunt date sensibile; se folosesc numai pentru mutual eligibility și nu se inferă/exportă. |
| D-052 | Dating Trust Passport este vector de claims, nu scor scalar | Adult/photo/liveness/video/meeting reliability sunt explicabile și contestabile; nu evaluăm atractivitatea sau „valoarea” persoanei. |
| D-053 | View Once este E2EE și non-explicit la lansare | Reducem distribuirea, dar nu promitem că o cameră externă sau un dispozitiv compromis nu poate copia imaginea. |
| D-054 | Pulse este o suprafață transversală, nu încă un profil obligatoriu | Utilizatorul publică prin profil numit sau alias, fără a fragmenta identity model-ul. |
| D-055 | Discreția înseamnă pseudonimitate responsabilă | Publicul nu vede legătura alias–cont–wallet; Nexus păstrează mapping separat pentru block, safety și obligații legale valide. |
| D-056 | Nu există random anonymous chat | Este incompatibil cu poziționarea de siguranță și introduce risc sever de abuz și app-store rejection. |
| D-057 | Community Context este evaluat numai de oameni eligibili | Agenții pot semnala surse sau redacta drafturi etichetate, dar nu votează și nu creează consens artificial. |
| D-058 | Media are suprafețe comune `Clips`, `Pulse`, `Watch` și `Live` | Reutilizăm asset/graph/rights/moderation fără a forța același UX sau ranker pentru toate formatele. |
| D-059 | Fiecare suprafață are recommender și feature namespace separat | Obiectivele Dating, Pulse, Clips, Watch, commerce și Kids sunt incompatibile; evităm scurgerile și optimizarea unică pentru engagement. |
| D-060 | Fiecare recommender are mod neprofilat și reset | Following, Subscriptions, Editorial ori filtre explicite oferă control real și susțin transparența DSA. |
| D-061 | Watch începe allowlisted, cu VOD long-form și Creator Studio minim | Rights, CDN, search și moderarea trebuie demonstrate înainte de upload global nelimitat. |
| D-062 | Live folosește provider managed prin adapter | Siguranța, failover-ul și latența pot fi livrate înainte ca volumul să justifice infrastructură globală proprie. |
| D-063 | Emergency Live terminate nu depinde de blockchain | Oprirea unui incident trebuie să funcționeze chiar dacă relayer-ul, chain-ul sau indexer-ul sunt indisponibile. |
| D-064 | Nexus Kids este aplicație și tenant separat | Un mod UI în produsul adult nu izolează suficient Dating, open social, wallet, SDK-uri și date. |
| D-065 | Child profile nu are wallet | Copilul nu gestionează seed, crypto, tips, NFT sau istoric financiar; adultul controlează orice purchase. |
| D-066 | Activitatea Kids este excepție de la every-action-chain | History, search, favorite și feedback trebuie să rămână minimizate, ștergibile și fără urmă blockchain individuală. |
| D-067 | Kids nu are open social sau child broadcasting | Fără DM, comments libere, public upload/live ori random chat; Live este numai instituțional/creator-verificat și moderat. |
| D-068 | Kids nu folosește behavioral ads sau engagement-maximizing design | Modelul inițial este Family/editorial, cu autoplay off, sesiuni finite și privacy maximă implicită. |
| D-069 | Delivery și Nexus Assurance & Control sunt linii separate | Agentul care construiește nu poate fi singurul care aprobă; findings și evidence au ownership independent. |
| D-070 | Agent Task Packet este unitatea de execuție | Objective, scope, dependențe, contracte, riscuri, acceptance, telemetry și rollback sunt stabilite înainte de lucru. |
| D-071 | Release-ul folosește gates G0–G8 și artifact promotion | Build-ul care trece teste nu este automat eligibil pentru mainnet, Kids, Live sau o țară nouă. |
| D-072 | Control Registry și Evidence Pack sunt obligatorii | Un control fără dovadă verificabilă este considerat neexecutat; excepțiile au owner și expirare. |
| D-073 | Capacitatea include minimum 20% assurance | Paralelizarea agenților fără review, security, privacy, safety și reliability produce rework și risc ascuns. |
| D-074 | Agenții nu auto-certifică porțile externe | Auditul independent, opiniile juridice semnate, licențele, app stores și autoritățile rămân gates distincte. |
| D-075 | Descentralizarea Nexus este hibridă | MultiversX este settlement/registry/checkpoint; nodurile independente livrează federation, storage, media, messaging, index și compute. |
| D-076 | Shard-urile aplicației nu urmează shard-ul wallet-ului | Placement-ul folosește rendezvous hashing și policy/diversity; legarea de shard-ul chain ar expune date și ar produce rebalansări greșite. |
| D-077 | Chain-ul ordonează mutațiile, replicile materializează starea | `EXECUTED_SUCCESS` este adevărul canonic adult; Nexus Event Protocol propagă și reducer-ele deterministe reconstruiesc read models. |
| D-078 | Nodurile au roluri și tier-uri distincte | Public relay/cache nu primește automat dreptul de a procesa Dating, Kids, KYC, locație, plăți sau safety evidence. |
| D-079 | ActivityPub este bridge public, Matrix este messaging federat | Nu inventăm protocoale incompatibile pentru social public și E2EE, dar păstrăm extensii Nexus versionate. |
| D-080 | IPFS permanent este opt-in | Public revocabil folosește encryption/key control și tombstones; datele private/ephemeral nu intră în public DHT. |
| D-081 | Mesh-ul permissionless nu primește plaintext sensibil | Dating/chat/location pot folosi storage/relay orb pentru ciphertext; cheile, Kids activity, KYC și safety evidence rămân on-device/vault. |
| D-082 | Serviciile de nod se decontează periodic în EGLD/ESDT | Packet/job receipts sunt off-chain și agregate; nu emitem NXS și nu facem tx per HLS segment ori CPU unit. |
| D-083 | Slashing numai pentru abatere obiectiv demonstrabilă | Double-sign, proof fraud sau challenge failure pot fi probate; QoS și moderarea contestabilă folosesc neplată/suspendare/apel. |
| D-084 | Protocolul funcționează pentru orice `N>=1` | D0 este un Genesis Node, apoi `R=min(N,target)` și sharding adaptiv; join-ul este permissionless, fără operatori recrutați sau aprobați. |
| D-085 | Un nod este funcțional, nu descentralizat | La `N=1` există single point of failure și backup obligatoriu; UI/status nu pretinde redundanță până când există noduri independente. |
