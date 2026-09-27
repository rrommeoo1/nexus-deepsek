# Messenger — acțiuni concrete și panouri care se pot închide

2026-09-14 · packet de după verificarea secvențială xPortal · cost incremental 0.

## Rezultat

- Eliminată intrarea generică Options. Meniul expune profil, căutare, criptare, fotografii/video/fișiere, temă, notificări, mesaje temporare și întâlnire/controalele existente de grup.
- Panourile auxiliare au X de 44 px, Escape, toggle și închidere la click exterior. Clickul în editor nu pierde focusul în favoarea headerului. Deschiderea altui panou ascunde conținutul anterior, astfel încât explicațiile tehnice și controalele necerute nu se mai suprapun.
- Trei teme reale: Nexus, Noapte și Pădure, aplicate fundalului și bulelor. Preferințe locale, separate prin owner/persona/conversation ID, fără conținut de mesaje în storage.
- Notificări: oprește efectiv toastul de mesaj nou pe acest dispozitiv. Nu schimbă unread counts, apeluri, date de inbox sau setările altui dispozitiv. Scope-ul este explicat în panou; nu pretindem mute sincronizat backend/push.
- Mesaje temporare: preferință locală pentru mesajele proprii viitoare, transmisă prin selectorul existent și expirarea backendului existent. Opțiuni: păstrează, 1 min, 1 h, 24 h, 7 zile. Nu modifică mesajele deja trimise sau mesajele celorlalți; resetul formularului păstrează preferința.
- Eșecul localStorage nu afișează o salvare falsă. Valorile temei/mute/expirării sunt validate strict.
- Cache app/shell/locale/messenger CSS: menu1. CSS-ul de mesagerie a fost compactat cu esbuild numai pentru whitespace, menținând bugetul existent, fără mărirea lui.

## Dovezi

- 12 teste pentru preferințe/shell PASS: separare profil/cont/fir, valori invalide, storage refuzat, aplicarea temei, mute real al toastului după verificarea destinatarului, selectorul real de expirare păstrat în formular, X/toggle/exterior/focus.
- Gate final `release:check`: PASS, 81 fișiere, 1.000 actori, 0 issues; health PASS; insecure_api_denied=true, isolated_data=true; external_network=false, real_funds=false, incremental_cost=0.
- Gate-ul final acoperă și ultima retragere a CTA-ului xPortal după eroare. Client xportal18 reconstruit anterior; nicio semnare reală pe telefon verificată.
- Laboratorul 3100/3543 repornit pentru 7.200 secunde după expirarea sesiunii precedente, fără resetarea datelor/parolelor.

## Limite rămase

Browser/telefon și conectarea xPortal reală rămân neverificate. Utilizatorul raportează în continuare blocajul xPortal; nu se închide acest incident pe baza testelor mock. Următorul packet de autentificare trebuie să identifice etapa reală care nu se finalizează, folosind diagnostice fără token/semnătură/date de portofel, nu alte afirmații premature de rezolvare.

Nu există sincronizare între dispozitive pentru preferințele locale. Protecția chatului, mute backend/push, meniul complet al fiecărui mesaj și acceptarea UX pe telefon rămân deschise.
