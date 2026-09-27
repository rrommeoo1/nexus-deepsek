# Messenger — testare reală izolată și conversație compactă

2026-09-14 · un packet · UNOBSERVED/YELLOW · fără subagenți sau cost incremental.

## Livrat

- Inboxul nu mai injectează automat conversațiile UI-only care dezactivau camera/microfonul. Contul real rămâne intact; dacă nu are conversații, afișează starea goală reală.
- `scripts/messenger-lab.mjs`: bază SQLite și storage separate în `apps/nexus-web/test-labs/messenger`. Refuză production, DB nemarcată, path redirecționat și orice DB cu utilizatori nesintetici. Configurația `.env` a aplicației nu este încărcată; se folosesc secret/parolă de laborator independente, fără credențiale de billing/producție. Nu există bypass de login.
- Trei conturi SYSTEM_TEST, patru conversații persistente: două directe Social, una de grup și una Work. Fotografiile sunt atașamente reale purpose-bound și avatare Social; Work nu primește fotografia prin fallback. Re-seed fără duplicarea mesajelor. Fără răspunsuri automate, receipts sau prezență inventate.
- Portrete fictive originale create cu instrumentul imagegen inclus, copiate în `apps/nexus-web/test/fixtures/messenger/mira.png` și `alex.png`, apoi în storage-ul autorizat al laboratorului. Nu sunt persoane din capturile utilizatorului.
- Bule compacte, fără badge de modul repetat în fiecare mesaj. Modulul rămâne în header; numele expeditorului se repetă numai în grup. Ore HH:mm din timestampurile reale, separatoare de zi după calendarul local.
- Editor textarea cu creștere 48–132 px, păstrând numele câmpului, limita, textul și disabled; autorizarea/placeholderul/typing folosesc și textarea.
- Agrafă SVG 24 px în zona tactilă 44 px. Peste 150 de emoji, patru categorii, căutare RO/EN la nivel de categorie/emoji și recente în memoria editorului, fără persistență comună profilurilor. Enter în căutarea emoji nu trimite mesajul.
- ⋮ include fotografii/video/fișiere deja afișate și autorizate. Galeria revine la mesajul original, se actualizează la re-render/expirare și se retrage la ieșirea din ecran. Fișierele criptate cer în continuare decriptare explicită din mesaj.
- Prezența derivată simplist din `last_seen_at` nu se mai afișează: este ascunsă până există consimțământ per profil. Nu s-a introdus un „offline” fictiv.
- Cache versiune `20260914-lab1`. Fără modificarea backendului de transport sau migrare DB. `loadEnv` acceptă explicit `NEXUS_ENV_FILE=''` pentru lansatorul izolat; producția păstrează validările obligatorii.

## Acces și limite

Pornire din `apps/nexus-web`: `node scripts/messenger-lab.mjs --serve`.

- HTTP: http://192.168.1.153:3100
- HTTPS: https://192.168.1.153:3543
- Utilizator principal: `lab_tester@nexus.test`; al doilea dispozitiv: `lab_mira@nexus.test` sau `lab_alex@nexus.test`.
- Parola și instrucțiunile sunt în fișierul local ignorat `apps/nexus-web/test-labs/messenger/access.md`. Nu distribui `lab.json`, care conține și secretul de sesiune.
- Folosește browser/fereastră privată dedicată: cookie-urile sunt comune porturilor de pe același host; loginul în laborator nu trebuie să înlocuiască sesiunea normală în aceeași fereastră.
- Serverul de laborator este limitat la 600 secunde per rulare, storage 256 MB și heap Node 384 MB; datele se păstrează la oprire. Repornește aceeași comandă pentru următoarea sesiune. Nu este un serviciu permanent ori un deploy.
- Camera/microfonul necesită HTTPS de încredere și permisiune pe dispozitiv. Certificatul rădăcină existent este oferit de server, dar instalarea/trust pe telefon nu s-au efectuat automat. Firewallul nu a fost modificat.

## Dovezi

- Teste noi: seed persistabil/idempotent, refuz DB reală înaintea scrierii, autentificare prin API email real, livrare repository către al doilea cont, deny alt profil/alt participant, categorii emoji, schimbare zi și textarea cu limită de creștere.
- `release:check`: PASS, 78 fișiere, 1.000 actori, 0 issues, health izolat PASS, insecure_api_denied=true, external_network=false, real_funds=false, incremental_cost=0.
- Testul suplimentar de login API executat separat: PASS, fără apeluri externe.
- Lansarea laboratorului: HTTP 3100 și HTTPS 3543 raportate de server. Nu este dovadă de acces LAN/telefon.
- Bugetele JS/CSS/locale păstrate; s-au eliminat comentarii CSS istorice, nu reguli funcționale. Testele rămân bazate pe selectorii reali, nu pe comentarii.

## Restul promptului — neînchis

1. Prezență cu consimțământ granular, expirare și privacy completă; momentan ascunsă.
2. Camera cu preview dedicat și comutare față/spate; rămâne capturarea/pickerul nativ existent.
3. Reply/react/edit/delete printr-un meniu contextual complet, legare la mesaj, redirecționare internă; nu sunt declarate implementate prin acest packet.
4. Favorite/mute/temă/mesaje temporare/protecție chat într-un meniu unificat: numai opțiunile deja implementate sunt expuse. Protecția reală și locația cu consimțământ rămân restante.
5. Apeluri între dispozitive, trust HTTPS, tastatură și test vizual la 320/390/430 px. Browserul rămâne blocat de preferința salvată; nu a fost ocolită. Nu declarăm acceptare umană pe baza testelor automate.

Următorul rezultat delimitat: acțiuni contextuale pe mesaj (reply și navigare la original), cu regresii pentru read-state, privacy și închidere pe mobil; apoi prezența opt-in. Pentru testele fizice/UX rămâne necesar accesul la browser/dispozitiv.
