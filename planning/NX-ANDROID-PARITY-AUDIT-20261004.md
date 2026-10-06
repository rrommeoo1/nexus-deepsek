# Nexus Android — verificare de paritate la 2026-10-04

Acesta este un audit de stare, nu o declarație că migrarea nativă sau lansarea în Play Store este terminată.

## Dovezi verificate

- `origin/main` indică `ea40058b28bb722bfea5374f0720f40bdfca3014`, aceeași bază web folosită de ramura locală. Pe PC, `apps/nexus-web/server.js` rulează pe portul 5000 și `/health` răspunde. Există și modificări locale necomise peste acea bază; acestea nu sunt automat prezente pe Railway.
- Development client-ul `app.nexus.mobile.dev` v0.1.0 este instalat pe Xiaomi 17 Pro (Android 16). `adb reverse` leagă porturile 5000 și 8081; Metro funcționează. Pe telefon s-au citit din interfață atât bara nativă `NEXUS · Dev 0.1.0 live`, cât și text din feedul Nexus livrat de serverul PC.
- La momentul verificării, `https://psek-production.up.railway.app/`, `/health` și `/app.js` au răspuns toate cu HTTP 404 și `Application not found`. Nu se poate afirma că această adresă mai reprezintă ultimul deployment; este necesar URL-ul sau accesul actual la deployment pentru o comparație de versiune.
- `+` din clientul web are un handoff către `/camera` prin `nexus:open-camera` când rulează în shell. Camera nativă 9:16 / 0,7× și 3:4 / 1×, captura foto/video și fișierele locale au fost validate anterior pe Xiaomi; utilizatorul a confirmat funcționarea capturii. În această verificare, nu a fost obținută o probă end-to-end nouă a apăsării pe `+`, deoarece telefonul a revenit la altă aplicație înainte de inspecția ecranului camerei.
- Am corectat ordinea handoff-ului: un draft web cu modificări trece acum prin confirmarea de ieșire înainte de a deschide camera nativă. Testele dedicate camerei/draftului au trecut.

## Diferența față de ținta Android

Clientul Android actual este un shell React Native/Expo cu WebView către serverul web **local de pe PC**. Camera este nativă, dar după captură oferă doar preview și salvare locală; fișierul nu intră încă într-un editor nativ, în detaliile postării, în upload sau în feed/profil. Prin urmare, produsul web existent este accesibil pe Xiaomi în dezvoltare, dar nu a fost „mutat integral” într-o aplicație Android independentă. Railway nu este sursa încărcată de acest build și PC-ul trebuie să ruleze serverul local pentru WebView.

## Următorul gate funcțional

1. Confirmați URL-ul Railway actual și comparați hash-ul/versiunea deploymentului cu `origin/main`; nu presupuneți paritate din simpla existență a codului local.
2. Implementați primul flux Android complet: `+` → cameră → preview/editor → detalii → draft sau upload/post, cu persistență la întrerupere și fără bridge care copiază fișiere mari prin base64. Autentificarea și API-ul de upload trebuie contractate explicit cu backendul înainte de publicare.
3. Testați pe Xiaomi fotografii și clipuri reale, fidelitatea cadrului, ieșirea fără pierdere de draft, vizibilitatea postării în feed/profil și revenirea din fundal. Păstrați accesul tranzitoriu la funcțiile încă nemigrate, fără a-l numi client Android nativ complet.

Nu s-a făcut deploy pe Railway și nu s-au schimbat datele de producție în acest audit.
