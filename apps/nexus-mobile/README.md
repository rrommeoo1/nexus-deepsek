# Nexus Android — development client

Acesta este un client Android nativ **de diagnostic**, construit separat de `apps/nexus-web`. Nu înlocuiește produsul web și nu este pregătit pentru publicare. În această etapă, butonul `+` deschide o cameră nativă pentru compararea încadrării pe Xiaomi; nu salvează încă poze sau video și nu trimite date la Railway.

## Ce trebuie testat pe Xiaomi

1. Conectează telefonul prin USB, activează Developer options și USB debugging și acceptă cheia PC-ului pe telefon. Verifică `adb devices -l` până apare `device`.
2. Din `apps/nexus-mobile`, pornește `npm start`. Instalează APK-ul de development cu `adb install -r builds/nexus-dev-arm64.apk`. Deschide **Nexus Dev** și conectează-l la serverul Metro de pe același PC/rețea.
3. Apasă `+`, acordă permisiunea camerei, compară 9:16 cu 3:4 din aceeași poziție și cu aceeași lumină. Notează obiectivul și factorul de zoom afișate. În 9:16 se cere 0,7× numai dacă un obiectiv multiplu cu `minZoom <= 0.7` este expus aplicației; altfel rămâne 1× fără zoom digital.
4. Compară cu TikTok și camera sistemului. Un preview care umple ecranul poate decupa marginile dacă raportul senzorului diferă de cel al ecranului; proba pe dispozitiv stabilește cât și dacă se poate compensa cu ultra-wide.

Modificările TypeScript/JavaScript se încarcă din Metro fără reinstalarea APK-ului. După schimbări ale dependențelor native sau `app.json`, trebuie refăcut și reinstalat build-ul de dezvoltare. Railway nu este implicat în compilarea Android.

## Verificări locale

```powershell
npm run typecheck
npx expo lint
npx expo-doctor
npm run build:android:dev
```

Build-ul cere JDK 17 și Android SDK 36 în `JAVA_HOME` și `ANDROID_HOME` (variabile de utilizator). Scriptul copiază doar sursele clientului într-un director izolat și verificat, `C:\nxm`, deoarece calea lungă a repository-ului depășește limita Ninja pe Windows. APK-ul arm64 rezultat este copiat în `builds/nexus-dev-arm64.apk` (ignorat de Git). Nu rulează pe Xiaomi până când telefonul este conectat și utilizatorul acordă permisiunea camerei. `adb install -r` actualizează aceeași aplicație dev, fără a-i crea o instalare nouă la fiecare build. Schimbările numai în TypeScript nu cer rebuild: păstrează Metro pornit și folosește Fast Refresh.

APK-ul actual este un build **debug/development**, nu unul de Play Store. Include doar pagina de pornire și preview-ul nativ al camerei pentru măsurarea încadrării; butonul de captură, editorul și publicarea nu sunt încă implementate aici. Nu introduce date reale în acest client de diagnostic.
