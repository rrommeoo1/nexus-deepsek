# Prompt pentru DeepSeek — Jungle Book, runda 18 octombrie 2026

> Se lipește ca atare. Fiecare regulă de mai jos vine de la proprietar; ce s-a făcut deja este marcat
> „făcut", ca următoarea rundă să nu-l refacă și nici să nu-l creadă din nou.

## Rol

Ești agentul de cod al aplicației **Jungle Book** (monorepo `nexus-deepsek`, aplicația Android în
`apps/nexus-mobile`, serverul Node în `apps/nexus-web`). Lucrezi pe ramura `codex/camera-draft-stability`.
`main` se atinge **numai** pentru deploy-ul de backend aprobat, prin `git worktree` curat din `origin/main`.

## Reguli de lucru (proprietarul, nemodificate)

1. Fără imagini citite. Pe telefon lucrezi numai cu `uiautomator` dump, `dumpsys` și `pm`; niciodată capturi.
2. Pe telefon: doar aplicația cu focus verificat; fără Home, fără Back, fără tragerea cortinei.
3. Doar **devnet**. Fără costuri reale, fără chei private în text, fără secrete tipărite.
4. Push **doar** pe `codex/camera-draft-stability`, în afară de deploy-ul de backend aprobat (punctul 3).
5. Comenzi lungi se redirectează în fișier și se citesc din fișier; output gol = necunoscut, nu „a trecut".
6. La fiecare pas: `npx tsc --noEmit`, `npm test` (mobil), `node --test test/*.test.js` (web) și un commit
   cu mesajul în engleză, la timpul trecut, care spune **de ce**, nu doar ce.

## Ce s-a făcut deja (nu reface)

- Paleta Jungle (`src/theme/jungle.ts`), `JungleBackdrop` pe 9 ecrane, logo la 52/54/132 dp, banii spun
  `JUNGLE` peste tot (`CURRENCY_LABEL`, `BRAND_TICKER`), 7 dump-uri de telefon în `docs/parity-report/`.
- **Deploy F2.c pe Railway** (18 oct 2026): `main` = `da692f6`, din care `4a2603c` (ledger), `5659b7c`
  (rute F1), `ca8ad16` (prețuri F2.c) și `da692f6` (EOL LF, necesar pentru ca testele web să treacă).
  790/790 teste web verzi în worktree; `/health` 200; `GET /api/creator/pricing` 200 pentru proprietar;
  `GET /api/creator/pricing/<handle>` 200 pentru cititor; `NEXUS_SETTLE_DEMO` oprit.
- **Sertarul a ieșit complet** din aplicație; meniul `≡` are acum opt rânduri: Postare nouă, Portofel,
  Venituri, Cheltuieli, Prețurile mele, Notificări, Setări, Ieși din cont, plus chips-urile celor cinci
  profiluri. Feed-ul nu mai are nici logo, nici buton de sertar.
- **Banda de profil** merge permanent, mai repede (36 s pe 360 dp), fără comutator; un deget o oprește și
  al doilea o pornește.
- **Fără presetări** în ecranul de monetizare: creatorul scrie cele trei prețuri.
- 404/501/503 și erorile de rețea au mesaje clare + `Reîncearcă` în monetizare și portofel.

## Ce rămâne de făcut, în ordine

### A. Semnul `$` și foaia de plată a fanului (cerința centrală a rundei)

- Un profil cu **oricare** preț > 0 poartă `$` lângă nume **peste tot**: card de postare, comentarii,
  antet de profil, listă de prieteni, căutare, inbox, ticker. Sursa este `GET /api/creator/pricing/:handle`
  (`free === false`), citită o dată pe handle și ținută într-un cache de sesiune (fără rețea la fiecare randare).
- Pe profilurile gratuite, like-ul, comentariul și distribuirea merg **fără blockchain**: niciun apel de
  plată, nicio fereastră de confirmare.
- Pe profilurile cu `$`, apăsarea pe reacție deschide **`SupportConfirmSheet`** existent, cu: prețul ales de
  creator (în JUNGLE), comisionul, soldul cititorului și bugetul de sesiune (`SESSION_BUDGET_CENTS`).
  Comentariul și distribuirea trec prin aceeași foaie. Fără confirmare nu se scrie nimic.
- Pe Railway, cu `NEXUS_SETTLE_DEMO` oprit, foaia spune **`Indisponibil`** și butonul e dezactivat — nu se
  simulează succesul. Local, cu `NEXUS_SETTLE_DEMO=1`, fluxul real rulează între două conturi de test:
  verifică soldurile înainte/după, comisionul (creatorul peste 50 %) și idempotența (aceeași intenție de
  două ori = o singură decontare).
- Teste unitare pentru fiecare piesă (`formatJbc`, praguri, blocanți, `$`), `tsc`, lint, commit pe pas.

### B. Prețuri pe acțiune, alese de creator (backend)

- `PUT /api/creator/pricing` trebuie să accepte **0 pentru o acțiune** (adică „această acțiune e gratuită")
  și orice combinație; azi refuză un profil plătit dacă nu are toate trei prețurile peste prag.
- Pragul de decontare (`floor_cents`, azi 1,05 JUNGLE la un cost de 2,1 cenți) este real: sub el, o
  decontare costă mai mult decât încasează. Spune asta în ecran, nu ascunde cifra. Prețurile de 0,02 /
  0,03 JUNGLE cerute de proprietar **nu pot trece de prag** fără o decizie de cost — raportează, nu forța.
- `display_currency` vine azi `"JB"` din `apps/nexus-web/lib/creator-pricing.js`; schimbă-l în `"JUNGLE"`
  și rulează suita web înainte de orice deploy.

### C. Restul brief-ului, neînceput

- **Pasul 5, nume de test**: `.env.local` / `docs/.test-sessions.local` au cookie-urile; redenumește prin
  API numai conturile de test (`Test Nexus`, `Cont de test Nexus (Railway preview)`), nu cere parole.
  Ce răspunde 401 se notează în `docs/TEST-DATA.md`.
- **Pasul 6, APK**: verifică prin `dumpsys package` / `pm list packages` dacă „Jungle Book Dev" e instalat;
  dacă nu, `adb install -r` (păstrează datele).
- **Pasul 8, token**: dacă soldurile devnet sunt alimentate, emite tokenul `JUNGLE` (rezervă `JBK`), nume
  „Jungle", 2 zecimale, pe devnet; altfel scrie comanda și ce cere faucet-ul.
- **Pasul 9, registrul local**: investighează cele 15.849 de intenții neclasificate pe o **copie**, cu
  marcaj reversibil și reconciliere după. Railway nu se atinge.
- **Verificare pe telefon**: după fiecare schimbare, dump nou în `docs/parity-report/` și un rând în
  `HANDOFF.md` §0.6 cu ce s-a văzut, nu cu ce s-ar fi putut vedea.

## Raportare

Tabel: pas · stare · compilat · testat unitar · deployat · verificat pe telefon · ce ceri proprietarului.
Separat: **fapte verificate** (cu hash, status HTTP, număr de teste) și **presupuneri** (marcate ca atare).
