# Ciclu de dezvoltare — Nexus Dev + Metro + Fast Refresh

Produsul se închide în 2–3 luni. Nu se pregătește release, keystore, Play Store sau EAS. Ciclul este:
editezi `apps/nexus-mobile/src/**` pe PC, salvezi, telefonul se actualizează singur. Backend-ul rămâne pe
Railway; `adb reverse` se folosește **numai** pentru Metro (8081), niciodată pentru API.

## Un singur pas

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/dev-start.ps1
```

Scriptul (`tools/dev-start.ps1`):

1. găsește adb și telefonul (preferă transportul `IP:port`; altfel cablul/mDNS);
2. pornește Metro pe `8081` într-o fereastră nouă, dacă nu ascultă deja (jurnal: `apps/nexus-mobile/builds/metro.log`);
3. face `adb reverse tcp:8081 tcp:8081` — doar Metro;
4. aduce Nexus Dev în prim-plan cu `am start -n app.nexus.mobile.dev/.MainActivity`;
5. îi dă adresa Metro a PC-ului din LAN (`http://<ip-lan>:8081`) prin deep link-ul dev clientului
   (`nexusdev://expo-development-client/?url=…`), ca adresa să nu fie tastată în launcher.

Opțiuni: `-MetroPort 8081`, `-Device <serial>`, `-NoMetro` (folosește Metro care rulează deja),
`-Localhost` (trimite `http://localhost:8081` prin reverse, dacă firewall-ul blochează LAN-ul).

## Telefonul

Wireless debugging (fără cablu):

```powershell
adb devices                 # trebuie să apară un singur rând „device"
adb mdns services           # lista serviciilor _adb-tls-connect._tcp
adb connect <ip>:<port>     # doar dacă telefonul nu apare singur
```

Prima conectare pe o rețea nouă cere `adb pair <ip>:<port>` cu codul din
Setări → Opțiuni dezvoltator → Wireless debugging. Windows poate cere, o singură dată, să permită Node.js
pe rețele private (portul 8081) — fără asta Metro nu răspunde pe LAN și rămâne varianta `-Localhost`.

## Redeschiderea aplicației

* în prim-plan, fără reload: `adb shell am start -n app.nexus.mobile.dev/.MainActivity`;
* reload complet (bundle nou): același deep link ca la pasul 5, sau închide/redeschide aplicația:
  `adb shell am force-stop app.nexus.mobile.dev` apoi `am start …`. Drafturile locale rămân.

Dacă launcher-ul dev cere adresa serverului, nu o tasta: rulează din nou `tools/dev-start.ps1` — deep
link-ul o completează. Dacă adresa veche rămâne în istoricul launcher-ului, ignoră-o; cea corectă este cea
pe care o scrie scriptul la final (`Metro http://<ip>:8081`).

## După Doze, ecran stins sau port schimbat

* ecran stins/Doze: o apăsare scurtă pe butonul de pornire, apoi `am start -n …/.MainActivity`
  (`tools/dev-start.ps1` face și pasul de reverse, care se pierde la reconectare);
* port ocupat: `-MetroPort 8082` (și atunci deep link-ul folosește 8082; reverse se face pentru același port);
* telefon reconectat pe altă rețea: rulează din nou scriptul, altfel telefonul caută IP-ul vechi.

## Când este nevoie de APK nou

Spun explicit **„APK NOU necesar”** doar când se schimbă ceva nativ: o dependență nativă nouă, un plugin
Expo, `app.json` (permisiuni, icon, package), `android/**`. În rest: **„doar Fast Refresh”**.

```powershell
cd apps\nexus-mobile
npm run build:android:dev     # scripts/build-android-dev.ps1 -> builds\nexus-dev-arm64.apk
adb install -r builds\nexus-dev-arm64.apk
```

`-r` păstrează datele aplicației (drafturi, sesiune). **Nu** folosi `adb uninstall` sau
`adb install -d`: acelea șterg datele locale — dacă un pas ar face-o, îți spun înainte.

## Ce vezi mereu

Ecranul de login și subsolul sertarului scriu versiunea și backend-ul:
`Android 0.1.0 · API: Railway` sau `API: local`. Originea API vine din `EXPO_PUBLIC_NEXUS_API_URL`
(implicit Railway); eticheta este calculată în `src/lib/apiOrigin.ts`.

## Reguli

* doar Nexus Dev pe telefon, cu focusul verificat (`dumpsys window | findstr mCurrentFocus`);
* fără Home, Back sau cortina de notificări; fără modificări ale setărilor telefonului;
* capturi doar prin `tools/images/safe-screencap.ps1`;
* fără costuri, fără servicii plătite, fără Play Store.
