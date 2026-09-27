# xPortal — stare reală și așteptare limitată

2026-09-14. Packet secvențial; nu este acceptare pe telefon.

Corectat progresul dedus anterior din timerul de revenire: pairing/signature/server/complete/failed sunt acum raportate din coordonatorul real. CTA de semnare apare numai după rezolvarea approval; etapa server nu poate fi suprascrisă de un callback târziu. La redeschidere se folosește aplicația xPortal fără relansarea pairing URI. Nu se mai fac trei restarturi programate ale transportului pe fiecare revenire.

Finalizarea HTTP are timeout/abort de 25 secunde. Închiderea prin Back invalidează etapa și anulează cererea în curs; nu promitem anularea unui efect deja confirmat de server. Statusul vechi nu modifică un ecran nou. Checkerul secvențial a semnalat CTA-ul rămas după eroare; acum este retras înaintea butonului Retry.

14 teste WalletConnect PASS, rerulate independent de checker. Bundle recompilat, cache xportal18. Gate general PASS înaintea ultimei retrageri a CTA-ului; gate-ul va fi rerulat la încheierea lucrului curent. Fără sesiune reală/semnătură/relay extern folosite în teste. Posibilitatea unui blocaj specific rețelei sau dispozitivului nu este declarată rezolvată fără verificare fizică.
