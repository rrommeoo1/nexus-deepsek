# Nexus Social — planșa vizuală 01

Propunere de design generată cu instrumentul image_gen integrat. Nu este o captură a aplicației și nu dovedește implementarea funcțiilor. Imagine: `nexus-social-visual-01.png`.

## Brief de generare

Șase ecrane mobile complete, grilă 3 × 2: Feed, Fullscreen, Comentarii, Mesaje, Profil, Creează. Suprafețe near-black #090e14, cyan #6ce9e4, accente violet discrete, tipografie lizibilă, interacțiuni simple. Fără rame fizice de telefon sau browser. Fotografii și identități fictive. Feed cu stories și conținut dominant; fullscreen fără header și dock, X vizibil; comentarii în partea inferioară, fără rail de reacții sau dock; inbox cu conversații efective; profil cu cover, avatar, statistici și galerie; creare cu previzualizare selfie. Distribuire exclusiv internă. Buton Create circular. Fără donații și fără texte explicative mari în ecrane.

## Inspecția imaginii

Cele șase ecrane sunt vizibile integral. Comentariile au răspuns indentat, iar composerul nu este acoperit. Inboxul prioritizează conversațiile. Profilul separă galeria de setări. Fullscreen are ieșire vizibilă.

Diferențe de rezolvat în specificația interactivă: Follow lipsește din fullscreen în această imagine; selectorul Social nu are săgeată vizibilă; unele etichete sunt în engleză. Ilustrația nu demonstrează gesturi, dimensiuni CSS, contrast măsurat sau funcționalitatea camerei. Nu înlocuiește verificarea pe dispozitive.

## Contract de interacțiune pentru implementare

- Feed: tap pe media deschide fullscreen; vertical schimbă postarea; orizontal schimbă media din aceeași postare.
- Fullscreen: X/Back revine la poziția inițială; vertical schimbă postarea; orizontal schimbă media; mute rămâne preferință.
- Comentarii: deschiderea închide selectorul reacțiilor și ascunde railul/dockul; X/Back închide comentariile fără pierderea poziției.
- Camera: doar după permisiune; macheta nu solicită dispozitive și nu publică.
- Stările video/loading/offline/eroare și accesibilitatea cer verificări separate.
