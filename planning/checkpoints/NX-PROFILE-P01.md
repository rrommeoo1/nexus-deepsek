# Checkpoint — NX-PROFILE-P01

## Identitate

- Task: `NX-PROFILE-P01` — Privacy matrix contract and denial proof
- Owner: `A12`
- Risc: `T0`
- Stare: `review`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Un singur account poate deține și comuta profile Work, Social, Dating, Travel și
Marketplace, dar fiecare citire și acțiune este evaluată în contextul profilului
activ. Un acces Dating→global și un acces Work→Social fără grant explicit trebuie
să eșueze atât în API, cât și în fixture-ul de client.

## Felie de implementare

- contract versionat de visibility și audience, exact-shape și default deny;
- subject profile, active profile, target profile, purpose și audience binding;
- switch de profil cu generație/capability invalidation pentru starea veche;
- grant explicit, revocare și expiry; fără inferență din același wallet;
- profilul Dating și modul Incognito nu expun link-uri globale implicit;
- test matrix API/client, negative access trace și snapshot/restart tamper cases;
- actori exclusiv `SYSTEM_TEST`, fără date personale sau efect economic.

## Gates

- dependențele `NX-AUTH-001`, `NX-CONTRACT-001`, `NX-SEC-001` și `NX-OBS-001`
  sunt acceptate;
- runtime local, fără provider, rețea, fonduri sau cost incremental;
- packet-ul cere review independent C01/C02/C04 înainte de `done`.

## Stare curentă

Felia locală este completă în `packages/profile/api`: contract v1.1 exact-shape,
sesiune semnată cu proveniența tipurilor de profil, switch cu generație, grant semnat
care leagă tipurile owner/grantee, deny comun API/client, izolare Dating globală și
Incognito, plus registru grant/revocare cu replay și restore verificat. Validatorul
owner a fost regenerat după remedierea finding-ului `C02-PROFILE-P01-001`: tipul
resource owner pe calea SELF este acum verificat față de proveniența semnată a
sesiunii. Validatorul este `PASS`: minimum 108 controale, 91 assertions,
25 combinații în matrice și trei repetări deterministe, fără boundary finding,
credential, rețea, provider, efect economic sau cost. Packet-ul așteaptă review-ul
independent C01/C02/C04; persistența și identitatea de producție, datele reale,
serviciul Dating/global-search și auditul formal rămân explicit excluse.
