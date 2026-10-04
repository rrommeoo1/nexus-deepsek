# Nexus Android — development client

Acesta este un client Android nativ **de diagnostic**, construit separat de `apps/nexus-web`. Nu înlocuiește produsul web și nu este pregătit pentru publicare. Butonul `+` deschide camera nativă, permite fotografii și clipuri de test și arată fișierul salvat pentru compararea încadrării. Nu există încă editor, draft de postare sau publicare; nimic nu este trimis la Railway.

## Ce trebuie testat pe Xiaomi

1. Conectează telefonul prin ADB USB sau Wireless debugging și verifică `adb devices -l` până apare `device`. Pe Xiaomi-ul de test, USB a eșuat la enumerare, dar asocierea ADB prin Wi-Fi a funcționat.
2. Din `apps/nexus-mobile`, pornește `npm start`. Instalează APK-ul de development, dacă nu este deja instalat, cu `adb install -r builds/nexus-dev-arm64.apk`. Deschide **Nexus Dev** și conectează-l la serverul Metro de pe același PC/rețea.
3. Apasă `+`, acordă permisiunea camerei, compară 9:16 cu 3:4 din aceeași poziție și cu aceeași lumină. Notează obiectivul și factorul de zoom afișate. În 9:16 se cere 0,7× numai dacă un obiectiv multiplu cu `minZoom <= 0.7` este expus aplicației; altfel rămâne 1× fără zoom digital.
4. Fă o fotografie și compară preview-ul fișierului salvat cu imaginea din cameră. Dimensiunile în pixeli apar în preview. Repetă pentru 3:4 și pentru video (microfonul cere permisiune; clipurile de test se opresc automat la 2 minute). Butonul „Ultimul test” redeschide ultima captură după revenirea în cameră.
5. Compară cu TikTok și camera sistemului. Un preview care umple ecranul poate decupa marginile dacă raportul senzorului diferă de cel al ecranului; fișierul salvat trebuie evaluat separat de preview.

Capturile sunt mutate în spațiul intern persistent al clientului, nu în galeria telefonului. Nu dezinstala aplicația și nu șterge datele ei dacă vrei să păstrezi aceste fișiere de test. Interfața recuperează momentan doar ultima captură, deși fișierele mai vechi nu sunt șterse automat.

Modificările TypeScript/JavaScript se încarcă din Metro fără reinstalarea APK-ului. După schimbări ale dependențelor native sau `app.json`, trebuie refăcut și reinstalat build-ul de dezvoltare. Railway nu este implicat în compilarea Android.

## Verificări locale

```powershell
npm run typecheck
npx expo lint
npx expo-doctor
npm run build:android:dev
```

Build-ul cere JDK 17 și Android SDK 36 în `JAVA_HOME` și `ANDROID_HOME` (variabile de utilizator). Scriptul copiază doar sursele clientului într-un director izolat și verificat, `C:\nxm`, deoarece calea lungă a repository-ului depășește limita Ninja pe Windows. APK-ul arm64 rezultat este copiat în `builds/nexus-dev-arm64.apk` (ignorat de Git). Nu rulează pe Xiaomi până când telefonul este conectat și utilizatorul acordă permisiunea camerei. `adb install -r` actualizează aceeași aplicație dev, fără a-i crea o instalare nouă la fiecare build. Schimbările numai în TypeScript nu cer rebuild: păstrează Metro pornit și folosește Fast Refresh.

APK-ul actual este un build **debug/development**, nu unul de Play Store. Include pagina de pornire și modulele native necesare camerei, video-ului și stocării locale. Captura și preview-ul sunt cod JavaScript livrat de Metro. Editorul și publicarea nu sunt încă implementate aici. Nu introduce date reale sensibile în acest client de diagnostic.
