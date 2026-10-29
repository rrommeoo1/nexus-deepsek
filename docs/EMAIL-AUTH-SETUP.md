# Email real în Jungle Book — ce este implementat, ce rămâne de făcut

Acest document descrie sistemul de email adăugat în runda 37 (cod: `apps/nexus-web/lib/email/`) și,
fără să inventeze nimic, separă exact trei lucruri:

1. **ce funcționează deja, local, fără niciun cont extern** (captura locală de mesaje);
2. **ce funcționează cu un provider configurat** (trimitere reală, domeniu verificat);
3. **ce poate face doar proprietarul** (cont la provider, domeniu, DNS, plată).

Niciun domeniu, cont, cheie sau înregistrare DNS nu a fost creat de agent. `nexus.ro` apare doar în
fixture-uri de test și **nu are DNS** (interogat 29 oct 2026: `ENOTFOUND` pentru MX, TXT și `_dmarc`),
deci în acest moment **nu există un domeniu de expeditor în proiect**.

## 1. Providerul ales și de ce

| provider | rol | de ce |
| --- | --- | --- |
| **Resend** | principal | API HTTP simplu (`POST https://api.resend.com/emails`), cheie server-side, `Idempotency-Key` care împiedică o dublă livrare la retry, free tier suficient pentru început (3 000 mesaje/lună, 100/zi). Nu cere SDK: zero dependențe noi în `apps/nexus-web`, care are deliberat **zero dependențe runtime**. |
| **Brevo** | alternativă | al doilea adaptor real, ca să se vadă că providerul este înlocuibil: alt URL, alt header de autentificare (`api-key`), alt corp (`htmlContent`/`textContent`). Free tier 300/zi. |
| **capture** | dezvoltare | «cutie poștală» locală: scrie mesajul într-un director din `NEXUS_DATA_DIR` și **nu contactează niciun provider**. Orice răspuns care trece pe aici spune `captured_locally`, niciodată `delivered`. |

Portul este un singur `send()` per adaptor (`lib/email/providers.js`), deci adăugarea unui al treilea
provider (SMTP cu `nodemailer`, SES etc.) este un fișier nou, nu o rescriere a fluxurilor.

## 2. Variabile de configurare

Toate sunt citite **la fiecare cerere** din `process.env`, deci o repornire nu este necesară după o
schimbare de `.env`, iar testele le pot da explicit (`ctx.env`).

| variabilă | obligatorie | rol |
| --- | --- | --- |
| `NEXUS_EMAIL_PROVIDER` | da (producție) | `resend` \| `brevo` \| `capture`. Un nume necunoscut este refuzat, nu ignorat. |
| `NEXUS_EMAIL_API_KEY` | da (resend/brevo) | cheia providerului. **Doar pe server**; niciodată în cod mobil sau în Git. |
| `NEXUS_EMAIL_FROM` | da (resend/brevo) | expeditorul, ex. `Jungle Book <noreply@domeniul-tau.ro>`. Fără el, refuz cu numele variabilei. |
| `NEXUS_EMAIL_FROM_NAME` | nu | numele afișat, dacă nu vrei să-l scrii în `FROM`. |
| `NEXUS_EMAIL_REPLY_TO` | nu | adresa la care ajung răspunsurile (ex. suport). |
| `NEXUS_EMAIL_SUPPORT_ADDRESS` | nu | adresa tipărită în footerul mesajelor („scrie-ne la …”). |
| `NEXUS_EMAIL_LINK_ORIGIN` | da (producție) | origine publică pentru linkurile din email, ex. `https://app.domeniul-tau.ro`. În producție trebuie `https`; `localhost` este refuzat explicit. |
| `NEXUS_EMAIL_CAPTURE_DIR` | nu | directorul capturii locale (implicit `<NEXUS_DATA_DIR>/mail-capture`). |
| `NEXUS_EMAIL_TIMEOUT_MS` | nu | timeout per încercare (implicit 8000). |
| `NEXUS_EMAIL_MAX_ATTEMPTS` | nu | încercări pentru erori tranzitorii (implicit 3, maxim 5). |
| `NEXUS_EMAIL_RETRY_BASE_MS` | nu | baza backoff-ului exponențial (implicit 400). |
| `NEXUS_EMAIL_RESPONSE_FLOOR_MS` | nu | pragul minim de răspuns pentru cele două endpoint-uri care nu au voie să divulge existența contului (implicit 250). |

Unde se pun:

- **serviciul local** (`tools/local-backend/`): `C:\Nexus\env\jungle.env` — fișierul pe care îl citește
  `jungle-backend-service.mjs`. Este singurul loc recomandat pentru o cheie reală pe acest PC.
- **rulare manuală** (`npm run dev` în `apps/nexus-web`): `apps/nexus-web/.env` (gitignored).

`lib/env.js` completează doar cheile **goale sau absente**, deci o valoare goală dintr-un fișier nu mai
anulează o valoare reală din celălalt (regula din runda 36).

## 3. Configurare fără niciun cont extern (azi, pe acest PC)

Nu e nevoie de nimic: în dezvoltare, fără `NEXUS_EMAIL_PROVIDER`, sistemul folosește **captura
locală**. Înregistrarea, confirmarea, cererea de resetare și schimbarea parolei funcționează complet,
iar mesajele apar în `<NEXUS_DATA_DIR>/mail-capture/*.json`.

Citirea lor:

- `GET http://localhost:5000/api/dev/mail-capture` — doar de pe loopback/LAN și doar când captura este
  activă; răspunde `404` în orice alt caz;
- sau deschizi fișierul `.json` direct.

Fiecare mesaj capturat are `"delivered": false` și o notă explicită. **O captură nu este o livrare.**

## 4. Configurare reală — pașii care cer owner-ul

1. **Domeniu.** Ai nevoie de un domeniu pe care îl controlezi (verificarea DNS se face pe el). Nu
   există în proiect; `nexus.ro` nu răspunde în DNS. Variante: (a) un domeniu deja deținut; (b) un
   subdomeniu al lui, ex. `mail.domeniul-tau.ro`; (c) cumpărarea unui domeniu nou (cost tipic 10–15 €/an,
   **doar cu aprobarea owner-ului**). Fără domeniu verificat, Resend acceptă doar `onboarding@resend.dev`
   și doar către adresa contului propriu — util pentru un test, inutilizabil pentru utilizatori.
2. **Cont la provider** (Resend sau Brevo): cont, proiect, cheie API. Cheia se pune în
   `C:\Nexus\env\jungle.env`, niciodată în Git.
3. **Verificarea domeniului în dashboard.** Providerul afișează **el** înregistrările DNS (de obicei un
   TXT/CNAME `_domainkey` pentru DKIM, un TXT sau MX pentru SPF și, opțional, un CNAME de tracking).
   **Acest document nu conține valori DNS** și nu trebuie să conțină: ele vin din dashboard, pentru
   domeniul tău.
4. **Publicarea înregistrărilor** în zona DNS a domeniului (la registrar sau la DNS-ul folosit).
5. **Confirmarea lor, măsurată:**

   ```
   node tools/email/check-dns.mjs --domain domeniul-tau.ro --selector resend
   ```

   Tool-ul întreabă resolver-ul real și tipărește `FOUND` / `MISSING` / `UNKNOWN` pentru MX, SPF (TXT la
   apex), DMARC (`_dmarc.<domeniu>`) și DKIM (`<selector>._domainkey.<domeniu>`). Iese cu `0` doar când
   SPF, DKIM și DMARC sunt găsite. Un `UNKNOWN` înseamnă „interogarea a eșuat”, nu „lipsește”.
6. **DMARC.** Recomandat: `p=none` cu `rua=mailto:…` la început, apoi `quarantine`. Valoarea exactă o
   stabilesc owner-ul și providerul; tool-ul doar confirmă ce este publicat.
7. **Expeditorul.** `NEXUS_EMAIL_FROM=noreply@domeniul-tau.ro` (sau `Jungle Book <noreply@…>`), plus
   `NEXUS_EMAIL_SUPPORT_ADDRESS` pentru adresa de suport, dacă există una reală.
8. **Originea linkurilor.** `NEXUS_EMAIL_LINK_ORIGIN=https://…` — adresa la care utilizatorul chiar poate
   ajunge. Pentru testul pe telefon în rețeaua locală, `http://192.168.1.153:5000` este acceptat în
   dezvoltare și refuzat în producție.
9. **Test de livrare.** `POST /auth/email/register` cu o adresă reală a owner-ului, apoi verifici inboxul
   și `GET /api/email/status` (local) pentru `delivery: "provider"`.

## 5. Ce s-a schimbat în contractul API

| rută | rol | răspunsuri |
| --- | --- | --- |
| `POST /auth/email/register` | cont cu email + parolă (handle opțional) | `201` creat, `202` cont existent neconfirmat (retrimite linkul), `409 EMAIL_TAKEN`/`HANDLE_TAKEN`, `400 EMAIL_INVALID`/`PASSWORD_INVALID`, `503 EMAIL_NOT_CONFIGURED`, `429` |
| `POST /auth/email/verification/send` | retrimite confirmarea | `202 {ok,requested}` identic pentru orice adresă; `429` per IP/adresă |
| `POST /auth/email/verification/confirm` | consumă tokenul | `200 {verified,handle}`; `400 EMAIL_TOKEN_INVALID` (invalid/expirat/folosit); `409 EMAIL_TOKEN_STALE` dacă adresa s-a schimbat |
| `POST /auth/email/reset-request` | cere linkul de resetare | `202 {ok,requested}` identic pentru cont existent/inexistent; `503` dacă providerul lipsește |
| `POST /auth/email/reset-confirm` | parolă nouă cu token | `200` + sesiuni revocate; `400 EMAIL_TOKEN_INVALID`/`PASSWORD_INVALID` |
| `GET /api/auth-capabilities` | ce poate serverul | câmp nou `email` (`configured`, `provider`, `delivery`, `sender`, `link_origin`, `missing`, `warnings`) |
| `GET /api/email/status` | diagnostic local | provider, expeditor, origine, limite; `404` de pe o adresă publică |
| `GET /api/dev/mail-capture` | cutia poștală locală | mesajele capturate; `404` fără gate local + captură |

Rutele vechi rămân: `/auth/email/signup` și `/auth/email/verify` (fluxul cu dovadă de wallet),
`/auth/local/register` și `/auth/local/password-reset` (runda 36, doar local).

## 6. Politica pentru conturi neconfirmate

- **Dezvoltare:** loginul funcționează și înainte de confirmare (`login_allowed: true`), ca să poți lucra.
- **Producție:** `/auth/email/login` răspunde `403` pentru un cont cu email neconfirmat — politica care
  exista deja — iar înregistrarea **refuză** (`503 EMAIL_NOT_CONFIGURED`) dacă niciun provider nu este
  configurat, ca să nu creeze conturi care nu ar putea fi confirmate niciodată.
- Conturile existente **nu sunt atinse**: migrarea doar adaugă tabela `email_tokens`; nu șterge postări,
  nu schimbă handle-uri, nu invalidează sesiuni.

## 7. Securitate — ce este garantat prin cod

- Parola: `scrypt` (`lib/security.js`), niciodată în clar în bază sau în log; doar identificatorul se
  curăță, parola trece neatinsă.
- Tokenuri: 32 de octeți aleatori, **stocate ca `sha256`**, cu scop (`verify_email` / `reset_password`),
  adresa pentru care au fost emise, expirare (24 h / 30 min) și consum atomic (`UPDATE … WHERE
  consumed_at IS NULL`), deci o singură folosire, chiar și la două click-uri simultane.
- Un token nou **revocă** linkurile anterioare de același fel; un mesaj care nu a plecat este șters, ca
  să nu blocheze reîncercarea.
- Resetarea parolei revocă **toate** sesiunile în aceeași tranzacție.
- Enumerație: `verification/send` și `reset-request` răspund identic pentru orice adresă, fără token în
  răspuns, cu un prag de timp (`NEXUS_EMAIL_RESPONSE_FLOOR_MS`).
- Rate limit: per IP și per adresă pe fiecare rută (`enforceAuthRate`), plus cooldown de 60 s per cont.
- Log: o linie `[email] …` cu provider, eveniment, **domeniul** destinatarului și id-ul mesajului —
  niciodată token, link complet, parolă sau cheie.
- Fără endpoint neautentificat de schimbare a parolei: singura cale este tokenul primit pe email.
- Credențialele providerului nu ajung niciodată în codul mobil: cererile pleacă doar de pe server.

## 8. Linkuri, deep link și telefonul

- Linkul din email: `<origine>/verify-email.html?token=…` sau `<origine>/reset-password.html?token=…`.
  Paginile sunt statice (`apps/nexus-web/public/`), rulează sub CSP-ul existent (script extern, fără
  inline), scot tokenul din bara de adrese imediat și oferă, pe Android, și un deep link
  `nexusdev://verify?token=…` / `nexusdev://reset-password?token=…` către aplicație.
- `localhost` pe telefon înseamnă telefonul. Pentru test pe MIX Flip: `adb reverse tcp:5000 tcp:5000` și
  deschizi linkul cu `http://localhost:5000/...`; altfel folosești adresa LAN
  (`http://192.168.1.153:5000/...`), care este acceptată în dezvoltare.
- Capturile de ecran și verificarea vizuală rămân pe fluxul din `.clinerules` (o imagine pe rând,
  `scripts/capture-android-screen.ps1`).

## 9. Stare onestă (29 octombrie 2026)

| întrebare | răspuns |
| --- | --- |
| Provider ales | Resend (principal), Brevo (alternativă), captură locală în dezvoltare |
| Domeniu potrivit existent | **Nu.** `nexus.ro` nu are DNS; niciun alt domeniu al proiectului nu este configurat |
| Adresă de expeditor creată și verificată | **Nu.** Nu s-a creat niciun cont și nicio cheie; `NEXUS_EMAIL_FROM` nu este setat |
| Înregistrări DNS configurate | **Nu.** Tool-ul de verificare este gata, dar nu are ce verifica |
| Email real livrat și testat | **Nu.** Fluxul complet a fost testat cu adaptorul mock și cu captura locală (15 teste automate); livrarea reală rămâne `NOT VERIFIED` până la pașii din §4 |
| Conturi sau date modificate | **Niciuna.** Doar schemă aditivă (`email_tokens`) și cod |
