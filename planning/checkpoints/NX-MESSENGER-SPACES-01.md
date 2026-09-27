# SPACES-01 — inbox compact, căutare și card de contact

2026-09-13. Un packet, main agent only, capacitate UNOBSERVED/YELLOW. Scope: interfața mesageriei existente. Fără deploy, servicii noi, conturi reale modificate, migrare sau cost incremental.

## Implementat local

- Varianta 3 selectată și promptul integral salvat în `../NX-MESSENGER-SPACES-03-PROMPT.md`; acesta definește și ecranele următoare, nu pretinde că toate sunt terminate.
- Inbox cu module pe un singur rând orizontal și căutare la lupă. Filtrele secundare în meniul contextual. Nume/preview mai lizibile, avatari și ținte tactile dedicate.
- Un singur input de căutare: filtrează conversațiile încărcate după nume/handle/preview; după 300 ms sau Enter caută mesajele necriptate prin endpointul existent, cu paginare și retry. Răspunsurile sunt validate pentru viewer/persona/query/cursor, rezultatele vechi sunt invalidate imediat la tastare/clear. Nu se expune plaintext E2EE serverului.
- Căutarea nu înlocuiește lista originală și nu invalidează încărcarea ei. Rezultatul deschide conversația, dar nu face încă salt la mesajul exact.
- Avatar și conversație au butoane surori, fără butoane imbricate. Avatarul oprește propagarea și deschide dialogul cu fotografie contextuală, Mesaj/Audio/Video/Profil. X, exterior, Escape nativ și istoric pentru Înapoi. Fără fotografie comună între personas.
- Acțiunile cardului sunt conectate la mecanismele existente: openThread, control audio/video după autorizare, profilul contextual când persona activă corespunde. Mismatch produce explicație, nu schimbare implicită de identitate. Grupurile deschid conversația, nu un card fals al primului participant.
- Avatarul din antetul conversației reutilizează cardul când rândul autorizat este încărcat. Apelurile păstrează verificările HTTPS/permisiuni/membership și nu sunt simulate.
- Card Social: verifică Stories prin API, arată acces pe fotografie numai când primește Stories ale contactului, le reverifică înainte de viewer. Profil Social: buton Story pe avatar când profilul raportează Stories; datele sunt validate din nou. Viewerul poate primi o listă explicită per autor, inclusiv Stories deja văzute.
- Demo nu mai este deschis implicit și nu mai are al doilea câmp de căutare. Este opt-in, SYSTEM_TEST, separat de efectele reale. Unificarea rendererului demo/real rămâne un packet separat.
- Asset nou messenger-spaces.css inclus explicit în bugetul CSS, nu exclus din măsurare. Formatare mecanică de whitespace în styles.css și p3-visual-foundation.css (4.466 caractere eliminate; valori/selectori păstrați) pentru respectarea plafonului de 355.000 bytes. Nu s-a mărit plafonul.

## Dovezi

- `node --check` app.js, messenger-contact.js și contact-stories.js: PASS.
- Suita țintită inițială: 20/20 PASS. Suita finală include validatorul Stories și bugetul de performanță.
- `npm run release:check`: PASS, 73 fișiere de teste, 1.000 actori sintetici, 0 synthetic issues; health producție izolată PASS, API nesecurizat refuzat, fără egress/fonduri/cost.
- Prima rulare a identificat versiunea statică a assetului neactualizată în test; corectată la spaces1. Bugetul extins cu noul CSS a detectat 358.627 bytes; corectat prin formatare fără schimbarea valorilor. Assertion-ul de grid acceptă whitespace opțional după virgulă, fără relaxarea valorilor.
- Teste noi: stale search (răspunsuri inversate, clear, schimbare cont), privacy envelope, duplicate pagination, single flight, retry, identitate per persona, structură sibling buttons, Stories expirate/altă persona/alt autor/media invalidă. Testele API existente confirmă blocarea și excluderea E2EE din search.

## Limite / verificări neexecutate

- Browser și telefon real: NEVERIFICAT. Restricția Browser salvată anterior nu a fost ocolită. Nu sunt livrate capturi ca dovadă a implementării și nu se declară paritate vizuală.
- Căutarea numelor este limitată la conversațiile încărcate; mesajele server-searchable sunt paginate. E2EE local search și saltul la mesajul găsit rămân de implementat.
- Stories Social-only, din endpointul existent cu maximum 100 rezultate globale. Nu este garantată găsirea tuturor Stories ale unui autor. Este necesar endpoint per autor/paginare, plus revenire exactă la card/profil după viewer. Nu se afirmă că Dating/Work au Stories.
- Cardul din antet nu funcționează încă independent de rândul inbox; pentru conversație deschisă exclusiv din rezultate istorice, avatarul este dezactivat, nu trimis către un utilizator incorect.
- Poziționarea cardului nativ este centrată pe mobil; ancorarea lângă avatar pe desktop, long-press și testele fizice de Înapoi/focus rămân de acceptat.
- Apeluri reale între două dispozitive/cross-network: NEVERIFICAT. HTTPS/TURN/SFU/permisiuni rămân gates existente. Nu s-a implementat apel de grup.
- Locked chats, renderer comun demo/real, favorite complete, ciorne/editor complet și taburile funcționale complete ale profilului rămân în prompt, nu sunt declarate finalizate aici.

## Următorul packet

SPACES-02: card independent de inbox, renderer comun demo/real, căutare exhaustivă de conversații și salt/revenire la mesajul găsit; apoi SPACES-03 pentru profil/Stories și testare vizuală autorizată.
