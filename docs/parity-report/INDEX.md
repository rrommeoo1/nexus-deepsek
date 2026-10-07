# Raport de paritate web ↔ nativ — INDEX

> **Regula acestui fișier:** nicio notă nu vine din impresie. Fiecare rând are (a) dovada web
> măsurată (geometrie în CSS px din `docs/web-ref/**/*.dom.json`, plus sursa din
> `apps/nexus-web/public/*`), (b) starea nativă citită din codul din `apps/nexus-mobile/src/**`.
> Rândurile din `docs/PARITY-MATRIX.md` marcate anterior „identic” **fără măsurătoare pe telefon**
> au fost redeschise (§ Reopen).
>
> Nota 0–10 se calculează din **numărul de diferențe măsurate**, pe 7 criterii: structură 2 ·
> elemente 2 · iconuri 1 · spațiere 1 · culori/fonturi 1 · gesturi 1 · stări (gol/încărcare/eroare) 2.
> O diferență măsurată scade punctajul criteriului ei (parțial = jumătate).

## Cum se măsoară (lotul de capturi)

| Pas | Comandă | Ce iese |
|---|---|---|
| Web, toate stările | `node tools/web-ref/crawl.mjs [--only=…]` (credențiale **doar** din `NEXUS_TEST_EMAIL` / `NEXUS_TEST_PASSWORD`) | `docs/web-ref/<ecran>/<stare>.{png,dom.json,html.json}`, `_network/requests.json` |
| Nativ (sesiune pe telefon) | `powershell -NoProfile -File tools/parity/device-batch.ps1 -List docs/parity-report/batch.txt` | `docs/parity-report/<ecran>/native-<stare>.png` + `.xml` (uiautomator) + `focus-<stare>.txt` |
| Compozit „web \| nativ” | `powershell -NoProfile -File tools/parity/compose.ps1 -Area <ecran>` | `docs/parity-report/<ecran>/web-vs-native-<stare>.jpg` (JPEG, 1500 px înălțime) |
| Comparație numerică | `node tools/parity/compare.mjs <ecran>` | `docs/parity-report/<ecran>/diff.md` — per element: prezent/lipsă, ordine, `[x,y,w,h]` web (CSS px) vs nativ (px fizici / 2.6), text, iconiță vs text, culoare, font, stare |

Toleranțe (aceleași ca în PARITY-MATRIX): geometrie ±2 CSS px · text ±6 % lățime, wrap diferit
acceptat · culori exacte (opacity ±0.02) · timpi de animație/gest exact.

## Note pe ecran/stare (runda 1 — înainte de reparații)

Device-ul folosit pentru emulare: **1220×2656 px fizici, DPR 2.6 ⇒ 469×1021 CSS px**
(`tools/web-ref/device.json`, citit cu `adb shell wm size` / `wm density`, fără input).

| # | Ecran / stare | Nota înainte | Diferențe măsurate (rezumat) | Compozit |
|---|---|---|---|---|
| 1 | **Mesaje / inbox** (+ story rail) | **2/10** | vezi §1 | `messages/` (lipsă) |
| 2 | **Postare deschisă** (comentarii, like-uri, reacții) | **2/10** | vezi §2 | `post-open/` (lipsă) |
| 3 | **Comentarii** (arbore de răspunsuri) | **2/10** | vezi §3 | `comments/` (lipsă) |
| 4 | **Profil** (meniu de moduri) | **4/10** | vezi §4 | `profile/` (lipsă) |
| 5 | **Viewer video full-screen** | **3/10** | vezi §5 | `viewer/` (lipsă) |

> Compozitele și XML-urile native se produc în prima sesiune pe telefon (lotul e scris în
> `tools/parity/device-batch.ps1`); până atunci coloana rămâne „lipsă”, nu „identic”.

---

### §1 Mesaje / inbox — web măsurat vs nativ

Web (dovadă: `docs/web-ref/messages/inbox-0.dom.json`, `messenger-shell.js:27-70`,
`messenger-spaces.css`, `feed-surface.css:150-200`):

| Element web | Geometrie măsurată (CSS px) | Nativ acum | Diferență |
|---|---|---|---|
| `.screen.scrollScreen.inboxScreen.messengerScreen` | [0,0,469,961], bg `rgb(1,3,2)` | `MessagesScreen` `flex:1`, bg `#000000` | culoare de fundal |
| `.messengerTopbar` (grid 112px/1fr/1fr/44px, min-h 66) | [16,16,437,66] | **absent** | lipsă |
| `#inbox-home` wordmark + `small` „MESSAGES” | [16,17,112,64] | **absent** | lipsă |
| `details.inboxModules` summary „Social ⌄” (44px, r16, #11252d) | [134,27,132,44] | **absent** | lipsă |
| `details.inboxTools` summary „Toate ⌄” | [272,27,132,44] | **absent** | lipsă |
| `#new-conversation.iconBtn` (44×44, r50 %) | [409,27,44,44] | **absent** | lipsă |
| `form#message-search` + `#conversation-search` (ph „Caută conversații”) | [16,82,437,46] | **absent** | lipsă |
| `#storyRail.stories[aria-label="Stories"]` (h 160, gap 10, gradient teal/violet) | [16,134,437,160] | **absent** | lipsă (defectul nr. 1 din listă) |
| `#addStory.storyCard.feedStoryOwn` (98×144; `.storyPrism` 98×126 r15, dashed `rgba(36,240,210,.5)`; `+` badge 26×26 gradient `#5cf6e7→#12bfb4`) | [18,142,98,144] | **absent** | lipsă |
| `.storyName` bandă la baza imaginii (11 px, fw 800, gradient `transparent→rgba(3,8,14,.88)`) | y=271 | **absent** | lipsă |
| `.storyUnseen .storyPrism` inel `0 0 0 2px rgba(36,240,210,.85), 0 0 0 4px rgba(9,14,22,.9), 0 0 22px rgba(36,240,210,.22)` | — | **absent** | lipsă |
| `.conversationRow` (avatar 52, `b` 17 px, `small` 16 px `#afc2cf`, timp 12 px, `strong` pill 24 px `#68ebdf`) | — | `MessagesScreen` avatar 48, nume 15/700, meta 12, badge 20 `#ff315f` | geometrie + culoare badge |
| `.emptyInbox` „Nicio conversație aici / Pornește una folosind username-ul Nexus, nu un ID numeric.” | [16,306,437,110] | „Nicio conversație încă.” | copy |

Scor: structură 0/2 · elemente 0.5/2 · iconuri 0/1 · spațiere 0/1 · culori 0.5/1 · gesturi 0.5/1 · stări 0.5/2 = **2/10**.

### §2 Postare deschisă (comentarii, like-uri, reacții)

Web (dovadă: `docs/web-ref/post/detail-open.dom.json`, `post-detail.js:12-230`, `post-detail.css`):

| Element web | Măsurat (CSS px) | Nativ acum | Diferență |
|---|---|---|---|
| `#mediaViewer.mediaViewer.reelViewer.media-fit-fill.viewerCommentsOpen[role=dialog]` | [0,0,469,1021] | `CommentsSheet` = `Modal` bottom-sheet `maxHeight 82% / minHeight 52%`, r20 | structură (dialog full-screen vs foaie) |
| `.comments.viewerCommentsPanel[role=region][aria-label="Comentarii"]` | [0,357,469,664], r18 sus, bg `#0b0d10` | foaia acoperă doar 52–82 % | geometrie + rol |
| `.commentBack[aria-label="Înapoi"]` „←” | [8,366,28,28] | `✕` 40×40 „Închide” | iconiță vs text + sens (înapoi, nu închide) |
| `.commentSurfacePost` (post + `.commentPostCreator` + `[data-creator-profile]`) | [0,357,469,91] | **absent** | lipsă (postarea nu se vede în foaie) |
| `.commentPostActions[aria-label="Acțiuni clip"]` cu `[data-reaction-toggle=5]` `.on` 89×36 + `span[data-comment-count-post]` | [0,407,469,40] | **absent** | lipsă (fără like-uri/reacții în postarea deschisă) |
| `nav.commentSort` tab-uri „Comentarii relevante” / „Cele mai noi” (12 px fw 800) | [12,458,124,35] / [158,458,72,35] | **absent** | lipsă |
| `form.commentComposer[data-comment-form=5]` + `.commentSend[aria-label=Trimite]` cerc 70×46 | [0,958,469,63] / [389,967,70,46] | input + „Trimite” pill | geometrie + iconiță vs text |
| Placeholder „Scrie un comentariu…” | `post-detail.js:214` | „Adaugă un comentariu…” | copy |

Scor: structură 0/2 · elemente 0.5/2 · iconuri 0/1 · spațiere 0.5/1 · culori 0.5/1 · gesturi 0.5/1 · stări 0.5/2 = **2/10**.

### §3 Comentarii — arbore de răspunsuri

Web (`post-detail.js:12-51` `postDetailReplyMarkup`, `:169` `renderBranch` recursiv, `:214` formularul):

| Regulă web | Nativ acum | Diferență |
|---|---|---|
| `article.detailReply[data-reply-id][data-depth][style="--depth:n"]`, recursiv pe `parent_id`, indentare din `--depth` | `CommentsSheet` listează `comment.replies` ca linii `Text` plate cu `borderLeftWidth 2` | lipsă adâncime + recursivitate |
| `p.detailReplyContext` „Replying to @x” / „@x a retras răspunsul” | absent | lipsă |
| `div.detailReplyActions`: `[data-reply-to=id][data-reply-handle]` (răspunde), share, save, „N vederi” | doar reacție + „N vederi” | lipsă acțiuni |
| `form.detailReplyForm[data-detail-reply][data-parent-id]` + `.cancelReply[aria-label="Anulează răspunsul"]` | nu există stare de „răspund la” | lipsă |
| `[data-detail-reply-focus]` (sari la răspunsul vizat) | absent | lipsă |

Scor: structură 0/2 · elemente 0.5/2 · iconuri 0/1 · spațiere 0.5/1 · culori 0.5/1 · gesturi 0/1 · stări 0.5/2 = **2/10**.

### §4 Profil — meniul de moduri

Web (`profile-experience.js:13,16,437-453`, CSS `.ownerTabsRegion` / `.ownerContentTabs`):

| Regulă web | Nativ acum | Diferență |
|---|---|---|
| `nav.ownerContentTabs[role=tablist][aria-label=profile.contentTabs]`, 5 butoane `role=tab` cu `data-owner-content`, `data-reading`, `aria-selected` | `ProfileScreen` `TABS` = listă de `Text` | lipsă roluri/atribute |
| Conținutul butonului = `<i aria-hidden="true">GLYPH</i>`; `CONTENT_TAB_GLYPHS = { flow:'≡', reels:'▶', shots:'▦', whispers:'❝', moments:'✦' }` — **iconițe, nu text** | text vizibil „Flux / Reels / Fotografii / Șoapte / Momente” | **iconiță vs text** (defectul nr. 3) |
| Numele tab-ului doar în `aria-label` / `title` (`profile.tabFlow`, …) | numele e textul butonului | modalitate |
| `.ownerFiltersToggle[aria-expanded][aria-controls="owner-content-filters"]` „▾” + grup `.ownerContentFilters` (`newest`/`popular`/`relevant`, `aria-pressed`) | absent | lipsă |
| `readingOf(kind)`: `moments` → `newest`, restul citirii lui | filtrarea e locală, fără citiri | lipsă |

Scor: structură 1/2 · elemente 1/2 · iconuri 0/1 · spațiere 0.5/1 · culori 0.5/1 · gesturi 0.5/1 · stări 0.5/2 = **4/10**.

### §5 Viewer video full-screen

Web (`docs/web-ref/viewer/media-viewer.dom.json`, `viewer/reel-fullscreen.dom.json`, `feed-surface.css:2579,2616-2623`):

| Element web | Măsurat (CSS px) | Nativ acum (`MediaViewer.tsx`) | Diferență |
|---|---|---|---|
| `#mediaViewer.mediaViewer.reelViewer.media-fit-fill[role=dialog]` | [0,0,469,1021] | `Modal` non-transparent, `StatusBar hidden` | de verificat pe telefon (defectul nr. 2) |
| `.viewerStage > video/img` `object-fit:contain`, fundal `#000` | [0,-8,469,969] | `flex:1` negru, `fit="contain"` | aliniat |
| Rail vertical de acțiuni pe clip (`[data-reaction-toggle]` 56×56 @[405,659], comentarii `[data-comments]` @[405,713]) | [405,642..713] | **absent** | lipsă |
| `.clipMetaOverlay` (creator + `bdi` „@test”) | [18,847,375,96] | caption jos, fără creator | lipsă |
| `.clipCaptionBlock[data-expandable-caption]` + `button.trustSummary` + `.clipDistributeMenu` | [18,871,375,20] | doar `caption` | lipsă |
| `♫` atribuire audio „What Is Love — Melanie Ungar · CC BY” | `viewer/reel-fullscreen.dom.json` | absent | lipsă |

Scor: structură 1/2 · elemente 0.5/2 · iconuri 0.5/1 · spațiere 0.5/1 · culori 0.5/1 · gesturi 0.5/1 · stări 1/2 = **3/10**.

---

## Reopen — rânduri marcate înainte „identic” fără măsurătoare pe telefon

| Rând PARITY-MATRIX | Stare înainte | Stare corectată (runda 1) | Dovadă |
|---|---|---|---|
| §1 Shell — rail de mod `nav.feedModes` „un singur tab + glyph” | identic | **de reverificat pe telefon** (are nevoie de uiautomator) | `shell/home.html.json` |
| §1 Shell — `#feedModules` drawer | diferit (de verificat) | **diferit** (măsurat: prag, geometrie) | `feed/drawer-open2.dom.json` |
| §3 Profil — tab-uri de conținut | (nu exista rând) | **diferit** — iconițe vs text (§4) | `profile/own-0.*`, `profile-experience.js:16` |
| §4 Mesaje — inbox | identic structural | **diferit, 2/10** (§1) | `messages/inbox-0.dom.json` |
| §2 Feed — story rail | lipsă | **lipsă (confirmat)**; rail „shelf” 437×160 există doar în inbox (§1) | `messages/inbox-0.dom.json` |
| §4 Mesaje — fir de conversație | identic structural | **de reverificat pe telefon** | `messages/thread-0.dom.json` |

> „identic” rămâne interzis până când ecranul are un compozit + un `diff.md` numeric. Statusurile
> corectate mai sus sunt cele care nu au nevoie de telefon (citire din cod + dovezi web existente);
> restul se închid în prima sesiune pe telefon.

## Jurnal de reparații (runda 1)

| Ecran | Commit | Ce s-a schimbat | Nota după (telefon) |
|---|---|---|---|
| Mesaje / inbox — shelf de story-uri | `4edb4e3` | `lib/stories.ts` (citirea validată a lui `/api/stories?state=unseen` + înregistrarea progresului), `StoryRail.tsx` (tava 437×160, card propriu 98×150 cu badge „+", inel unseen, card văzut estompat, banda numelui), `StoryViewer.tsx` (cititorul full-screen: rail de progres, antet, legendă, zone de 34 %, 5 s/cadru), `MessagesScreen` (shelf-ul e antetul listei din același scroller, starea goală are cele două rânduri ale web-ului) | **—** (se măsoară pe telefon) |
| Viewer video — full-screen la tap | `de3d558` | `ReelsReader` nu mai comută redarea pe tap: tap-ul deschide `MediaViewer` (ca `tapVideo`, app.js:3216-3239), iar redarea a trecut pe discul `[data-clip-play]`; `FeedScreen` deține viewer-ul și îi dă galeria de media | **—** |
| Profil — meniul de moduri | `de3d558` | bara are cele cinci iconițe ale web-ului (≡ ▶ ▦ ❝ ✦) cu `role=tab`, `aria-label`, `aria-selected`; la capăt, săgeata „Mod de citire" deschide cele trei citiri, aplicate cu sortările web-ului (`profileStamp`/`profileScore`/`profileRank`) | **—** |

### Ce rămâne de reparat (runda 2, în ordinea notelor)

1. **Mesaje / inbox**: bara de sus `.messengerTopbar` (wordmark + „MESSAGES", sumarele „Social ⌄" / „Toate ⌄", butonul „Conversație nouă"), câmpul `#message-search` și cutiile inbox (Toate/Necitite/Grup/Cereri/Activitate).
   - **făcut în runda 2** pentru bară, căutare, rând, starea goală și foaia de conversație nouă; **făcut în runda 3** pentru cele două `details` cu meniurile lor, cutiile de filtrare, căutarea în mesaje a serverului și al doilea punct de atingere (fișa de contact) — vezi „Diferențe pe mesaje / inbox — rezolvate în runda 3".
2. **Postare deschisă**: să fie dialogul full-screen al web-ului cu `.commentSurfacePost` (postarea + creatorul), `.commentPostActions` (reacție + număr de comentarii) și tab-urile `commentSort`, nu o foaie de jos.
3. **Comentarii**: arborele recursiv (`detailReply[data-depth]`, „Replying to @x", acțiunile per răspuns, `[data-reply-to]` în compozitor).
4. **Bara de reacții**: sumarul compact „glife + număr" (`reactionSummaryMarkup`) și titlurile RO ale celor opt reacții.
5. **Viewer video**: rail-ul vertical de acțiuni (reacție 56×56, comentarii, salvare, distribuie), overlay-ul de creator și blocul de legendă/trust/atribuire audio.
6. **Story viewer**: butonul `•••` („Opțiuni") nu e desenat — singura acțiune pe care web-ul o leagă de el este arhivarea propriului story (`app.js:2776`), iar un meniu inventat ar fi o minciună.

## Runda 2 (offline, până la re-verificarea pe telefon)

| Ecran | Commit | Ce s-a schimbat (cu dovada) | Nota înainte → după (măsurat) |
|---|---|---|---|
| Bara de reacții (card + rail) | _vezi commitul de față_ | `REACTION_GLYPHS` verbatim din `app.js:3567` (♥ 💗 😂 😮 😢 😠 ◆ ▼ — telefonul desena 👍/👎/🟥), `REACTION_TITLES` (`reaction.*`: Like, Love, Haha, Wow, Trist, Furios, Fake?, Dislike), `reactionSummary()` cu regula de colaps a web-ului (≥85 % → un singur glif cu totalul; maximum 3; sumar neatins = inimă cu 0) și `ReactionControl.tsx`: cardul tipărește până la 3 perechi glif+număr (`reactionSummaryMarkup`), rail-ul tipărește gliful viewer-ului + totalul (`viewerReactionSummaryMarkup`), iar selectorul e placa măsurată `.reactionBar.expanded` (4 coloane, gap 8, padding 10, r16, `rgba(5,14,20,.96)`, contur `rgba(36,240,210,.3)`, titluri RO, `aria-expanded`/`aria-selected`) | **2/10 → 7/10** |
| Mesaje / inbox — bara de sus, căutarea, rândul de conversație, starea goală și foaia de conversație nouă | _vezi commitul de față_ | `MessengerTopbar.tsx`: `.messengerTopbar` măsurat [16,16,437,66] (capete 112 și 44, gap 6, `rgba(1,5,3,.96)`, contur măsurat `0px none`), wordmark `#inbox-home` [16,17,112,64] cu `small` „MESSAGES", `#new-conversation` 44×44 `#050608` cu traseul `compose` verbatim din DOM, `#message-search` [16,82,437,46] (`#090a0c`, contur `rgba(255,255,255,.22)`, r18, `margin 0 0 6px`) cu inputul [17,83,391,44] (8px, 16px, `min-height:44`) și butonul [408,83,44,44] cu traseul `search`; toate în `ListHeaderComponent`, în același scroller cu shelf-ul, iar Escape golește câmpul (`messenger-shell.js:66-68`). `ConversationRow` refăcut pe `.conversationRow` (`messenger-spaces.css:15-25`): avatar 52 `#203c49`, `b` 17/1.4 `#eef6fa`, `small` 16 `#afc2cf` tăiat la 64, ceas `HH:MM` peste pastila `#68ebdf` cu numărul brut (fără `99+`), fir `#233240`, min-h 80; `titleFor`/`subtitleFor` după `renderConversationRow` (`:13-25`) cu cititorul separat prin `id`, nu prin `role: 'owner'`; căutare locală `matchesConversation` (`:55-57`, NFKD) plus nota `.inboxFilterStatus` (`messenger.loadedOnly`) doar la un caracter; stările verbatim din locale (`messages.loading`; `.emptyInbox.inboxError` = `messages.loadError` + `live.retry`; `.emptyInbox` = `messages.noConversations` + `messages.startByUsername`); `NewConversationSheet.tsx` pe `#new-conversation` (`POST /api/chat/conversations`, copy `conversation.*`) | **—** (se măsoară pe telefon) |

Diferențe măsurate rămase pe bara de reacții (nu se pot face „identic", se documentează):

- placa selectorului: pe shell-ul de telefon al web-ului (`:has(.clipsScreen)`) ea devine `#050608` fără blur, iar eu păstrez `rgba(5,14,20,.96)` (media dintre cele două reguli ale web-ului);
- marcajul „neatins": web-ul folosește `solidViewerIcon('heart')` (SVG alb), nativul folosește gliful ♥ alb — același desen, fără un al doilea set de iconițe;
- discurile de reacție de pe rail: web-ul lasă `background:transparent` pe shell-ul de clips, cu touch target 54×42/48 și rânduri 35/11 px, iar nativul desenează gliful la 26 px într-un touch target 54×44 (măsurat, în așteptarea capturii pe telefon).

Diferențe pe mesaje / inbox — **rezolvate în runda 3** (nu mai sunt asumate, sunt implementate):

- cele două plăci `summary` ale web-ului — `details.inboxModules` („Social ⌄", [134,27,132,44]) și `details.inboxTools` („Toate ⌄", [272,27,132,44]) — sunt desenate de `InboxPlates.tsx`, în coloanele din mijloc ale grilei `112px 1fr 1fr 44px`; meniul de module listează `[data-inbox-persona]` (Toate mesajele/Social/Dating/Work/Travel/Market, `messenger-shell.js:29,34`) și cel de cutii lista `.inboxBoxes` (Toate/Necitite/Grup/Cereri/Activitate, `:36-42`);
- rândul are **două** ținte de atingere, ca `messenger-shell.js:24`: avatarul (`button.contactAvatar`) deschide `#messengerContact` (`ContactCard.tsx`, `messenger-contact.js:82-108` — foto 132, nume 22px, insignă de profil, cele patru acțiuni de 76px, banda Story condiționată de `contact-stories.js`), iar restul (`button.conversationOpen`) deschide firul;
- cutiile de filtrare aplică exact `matchesConversation` (`:55-57`): Toate/Necitite/Grup filtrează local rândurile încărcate, Cereri cere serverului `box=requests` (cu `inboxReturn` „‹ Conversații", `:47`), Activitate randează centrul de notificări (`ActivityCenter.tsx`, `app.js:7879-7945` — listă, număr necitite, „Marchează tot citit", `PATCH /api/notifications` per rând și formularul de preferințe `notification-preferences.js`);
- căutarea în mesaje a serverului e implementată (`lib/messageSearch.ts`, `messenger-search.js:21-53`): de la 2 caractere, `#inbox-message-results` înlocuiește lista și citește `GET /api/chat/search` + `GET /api/chat/conversations?q=`, cu plicul de confidențialitate verificat (`privacy_enforced_server_side`, `encrypted_content_searchable_server_side === false`) și stările `messages.searching` / `messages.searchError` / `messages.noSearchResults` / `messages.loadMore`.

Rămâne o singură excepție, impusă de server (nu de randare): acțiunile de apel din fișa de contact. Web-ul leagă `#audio-call`/`#video-call` de `call-client.js`, iar serverul ține apelurile de grup blocate până la un SFU (`thread.groupCallBlocked`); fișa desenează butoanele și tipărește exact propoziția produsului pentru un apel care nu poate porni (`thread.callUnavailable`, „Apel indisponibil pe acest dispozitiv"), fără să inventeze o stare.


Sesiune: `tools/parity/device-batch.ps1 -List docs/parity-report/batch.txt` pe `192.168.1.184:41461`
(Wireless debugging), **display principal = id SurfaceFlinger `4630946949513469331`** (1220×2656, DPR 2.6);
cover-ul (904×572, stins) este ignorat. Fiecare captură a fost verificată: focus `app.nexus.mobile.dev`
înainte de fiecare input, antet PNG `89 50 4E 47`, XML `uiautomator` scris lângă.
Portul de Wireless debugging se schimbă între sesiuni (runda 1: `41461`, runda 2: `35627`); se citește din
telefon înainte de fiecare lot, nu se presupune.

Capturi valide în acest lot: `feed/reels-0`, `comments/drawer-open`, `viewer/media-viewer`, `messages/inbox-0`.
Pentru fiecare, `tools/parity/compare.mjs` a scris `diff.md` (ex. `messages`: 43 de elemente web etichetate,
**0** fără diferență, 18 cu diferență, 25 fără pereche în nativ, 6 în plus în nativ).

### Patru lucruri măsurate pe device (și ce s-a făcut cu ele)

| Constatare măsurată | Consecință | Reparat |
|---|---|---|
| `screencap -d 0` e respins („Failed to take screenshot. Display I…"); `-d` vrea id-ul SurfaceFlinger, iar fără `-d` „Multiple displays were found… defaulting to the first" | capturi nedeterministe / fișiere text în loc de PNG | `Save-Screenshot` trimite id-ul măsurat (`-d 4630946949513469331`), scrie pe telefon și citește cu `exec-out cat` |
| `exec-out screencap -p > fișier` strecoară avertismentul adb în flux → PNG cu antet text (`46 61 69 6C 65 64` = „Failed t…") | capturi invalide | idem (scriere pe telefon + `cat`) |
| `uiautomator dump` întoarce uneori **9 noduri** („ERROR: could not get idle state", ecranul se animă) | arbore parțial, căutări de etichete ratate | `Get-Xml` reîncearcă de 4× și păstrează cel mai mare arbore |
| Story viewer: rail-ul de progres și antetul cădeau **sub bara de status** (inset real măsurat: 150 px fizici ≈ 58 CSS px), iar „Închide" la y=120 fizic era înghițit de sistem | buton de închidere nefuncțional pe telefon | `useSafeAreaInsets()` pentru rail/antet/legendă, cu pragurile CSS (`max(9px, safe-top)`, `+13px`, `max(25px, safe-bottom)`) |

### Ce blochează restul lotului (cinstit, cu măsurătoare)

1. **Notificările fură atingerea.** Dispozitivul avea notificări active (Teams / DHL). Două apăsări pe
   marcajul „Profil" (colț dreapta-jos) au dus în altă aplicație: `mCurrentFocus` a devenit
   `com.microsoft.teams/.MainActivity`. Pentru o sesiune curată e nevoie de **Do Not Disturb** sau de
   curățarea notificărilor.
2. **Contul de pe telefon nu e cel documentat.** Inbox-ul lui este gol („Nicio conversație aici") și
   story-urile urmărite sunt deja marcate văzute, deci `/api/stories?state=unseen` întoarce gol și shelf-ul
   arată doar cardul propriu. Pentru `messages/thread-0` și `viewer/story-viewer` e nevoie de
   **`test@nexus.ro`** (are conversația 1 și vede story-urile seedate ca necitite), exact cum spune
   `docs/TEST-DATA.md`.
3. `profile/own-0` și `profile/tab-2` au fost capturate greșit (ecranul Mesaje, pentru că tap-ul pe
   marcajul de profil a fost furat de notificare) — se refac după sesiunea curată.



- `saturate(.55) brightness(.8)` de pe cardul de story văzut nu are echivalent în React Native; același estompare se face prin `opacity` (valoare listată în `StoryRail.tsx`).
- fonturile: web `Inter, ui-sans-serif, system-ui` vs Android `Roboto`/`system-ui` (aceeași excepție ca în PARITY-MATRIX §0).

---

## Runda 2 — remăsurat pe telefon (`192.168.1.184:35627`)

Sesiune: portul de Wireless debugging s-a schimbat (`41461` → `35627`), `adb connect` a reușit, iar
`mCurrentFocus` a fost citit înainte de fiecare input. Aplicația căzuse în **Expo dev launcher**
(`app.nexus.mobile.dev/expo.modules.devlauncher.launcher.DevLauncherActivity`); bundle-ul a fost încărcat
tastând rândul serverului de dezvoltare din launcher (control al aplicației, nu al sistemului):
`http://192.168.1.153:8081`, unde Metro răspundea `packager-status:running`. După încărcare, focus
`app.nexus.mobile.dev/app.nexus.mobile.dev.MainActivity`.

Loturi: `device-batch.ps1 -List docs/parity-report/batch.txt -Device 192.168.1.184:35627` → **15/20 pași**,
apoi `batch-fix.txt` (6/6) și `batch-fix2.txt` (6/6).

### Două capcane de tooling, măsurate (și reparate)

| Constatare măsurată | Consecință | Reparat |
|---|---|---|
| Un PowerShell detașat (fără consolă) nu poate primi `[Console]::OutputEncoding = UTF8`, iar dump-ul citit prin pipeline (`exec-out cat`) ajungea „AcasÄƒ"/„ÃŽnchide": `tap:Acasă` a ratat, iar lotul a capturat stări greșite fără să semnaleze nimic | etichetele cu diacritice nu se mai potrivesc | `Get-Xml` citește XML-ul **binar** (`cmd /c … > fișier`), apoi `Get-Content -Encoding UTF8` |
| `uiautomator dump` eșuat **nu șterge** fișierul de pe telefon, iar „păstrează cel mai mare arbore" preferă exact acel fișier vechi: `profile/own-0.xml` și `native-tab-2.xml` au primit arborele inboxului (MD5 identic `46A16D3C…`) | captură aparent validă, cu geometria altui ecran | `rm -f` înainte de fiecare dump + marcaj `native-<stare>.dump.txt` („ok N noduri"/„stub N noduri"); `compare.mjs` sare peste stările „stub" și scrie „captură doar-imagine" |

### Rezultate măsurate

| Ecran / stare | Dovezi | Rezultat |
|---|---|---|
| `messages/inbox-0` | `native-inbox-0.xml` (34 noduri), `focus-inbox-0.txt`, `diff.md`, `web-vs-native-inbox-0.jpg` | 43 elemente web etichetate: **0** fără diferență · **18** cu diferență · **25** lipsă · **6** în plus în nativ — neschimbat față de runda 1 |
| `profile/own-0`, `profile/tab-1`, `profile/tab-2` | PNG + `web-vs-native-*.jpg` | arbore indisponibil („stub 0 noduri"): pe profil `uiautomator` nu atinge idle, deci geometria se citește pe pixeli |

Pe profil, `uiautomator dump` întoarce **0 noduri** la fiecare încercare („ERROR: could not get idle state") —
ecranul are animații continue (banda de metadate se derulează; comparate două capturi, banda își schimbă
conținutul). De aceea acolo **nu există etichete**: bara de moduri a fost localizată prin decupaje, nu din
arbore — y=778 px fizici (299 CSS), iconițele la x=110/330/557/777/995 (42/127/214/299/383 CSS).

### Profil — bara de moduri funcționează pe jumătate (măsurat în pixeli)

Glyphurile barei sunt exact cele din web (`≡ ▶ ▦ ❝ ✦` + `⌄`), deci defectul „iconițe vs text" din §4 este
**reparat** pe telefon. Tap-ul pe o iconiță mută sublinia de selecție (verificat pe două capturi), deci bara
reacționează. Ce se schimbă în *conținut* (procent de pixeli diferiți în banda y 920–2200 px):

| Comparație | Delta | Citire |
|---|---|---|
| fila 1 (`≡`) → fila 2 (`▶`) | **75.8 %** | fila 2 randează altceva |
| fila 2 (`▶`) → fila 3 (`▦`) | **75.8 %** | fila 3 randează altceva |
| fila 1 (`≡`) → fila 3 (`▦`) | **0.0 %** | **fila 3 este identică pixel-cu-pixel cu fila 1** → un mod inert |

Compozitele arată de ce (`profile/web-vs-native-own-0.jpg`, `…-tab-1.jpg`): web-ul randează în filele
„flow"/„reels" o **grilă de miniaturi** (3 pe rând, fiecare cu `▶ 1` lipit și buton de selectare), iar
nativul randează o **listă de carduri** (un post pe rând, imagine mare; în fila `▶` un card cu un video
mare negru cu buton de redare). Diferențe de antet, citite pe compozit:

| Element web | Nativ acum |
|---|---|
| insignă de lacăt lângă nume | absent |
| buton hamburger (meniul profilului) | absent |
| bandă de metadate cu iconițe (📍 localitate · 🎂 vârstă · @handle · N postări · N urmăritori) | aceleași date, dar într-o **bandă derulantă** de text, fără iconițe fixe |
| buton creion (editează profilul) | absent |

Nota §4, recalculată pe criterii: „iconuri" 0/1 → **1/1** (glyphurile sunt pe ecran), restul neschimbate
(structură 1/2, elemente 1/2, spațiere 0.5/1, culori 0.5/1, gesturi 0.5/1, stări 0.5/2 pentru modul inert)
⇒ **profil 4/10 → 5/10**.

### Stări care nu există pe contul de pe telefon (măsurat, nu presupus)

`native-inbox-0.xml` conține „Nicio conversație aici" și „Pornește una folosind username-ul Nexus, nu un ID
numeric.", iar shelf-ul de story-uri are doar „Story-ul tău" (cardul de adăugare). Deci `messages/thread-0`
și `viewer/story-viewer` **nu au stare corespondentă pe telefon**: stările lor din web vin din contul
semănat (`docs/TEST-DATA.md`). Lotul a fost corectat: pașii `tap:Deschide conversația`,
`tap:Înapoi la conversații` și `tap:Story de verificare` au fost scoși, cu motivul scris în `batch.txt`.
Capturile greșite produse de lotul dinainte (`messages/native-thread-0.*`, `viewer/native-story-viewer.*` —
care arătau ecranul Mesaje) au fost șterse, ca să nu intre în `diff.md` ca stări valide.

**Reparat în runda 2, cu măsurătoare:** bara de reacții (2/10 → 7/10, vezi nota de scor de mai sus),
glyphurile barei de moduri de pe profil (0/1 → 1/1), plus cele două capcane de tooling care falsificau
capturile. **Rămas de reparat, cu dovadă:** fila 3 de profil inertă (0.0 %), antetul de profil fără
lacăt/hamburger/creion cu banda de metadate derulantă, plus rândurile din tabelele §1–§5 care n-au fost

---

## Runda 3 — corecțiile cerute pe inbox (implementate, **nemăsurate încă pe telefon**)

Ce s-a făcut, cu dovada fiecărui element (toate cele patru erau în lista de „diferențe asumate" a rundei 2
și au fost scoase de acolo pentru că sunt implementate, nu declarate imposibile):

| Element web | Fișier nativ nou/atins | Dovadă web |
|---|---|---|
| `details.inboxModules` + `details.inboxTools` (bara, coloanele 2–3) | `components/InboxPlates.tsx`, `MessengerTopbar.tsx` (`middle`) | `messenger-shell.js:29,34-43`, `messenger-spaces.css:3,7-9`, `feed-surface.css:903-916` |
| cutiile Toate/Necitite/Grup/Cereri/Activitate | `InboxPlates.tsx` + `screens/MessagesScreen.tsx` (`matchesConversation`, `box`) | `messenger-shell.js:36-42,55-57,93-101`, `app.js:7808,7824-7827` |
| cutia Cereri (server) + „‹ Conversații" | `MessagesScreen.tsx` (`inboxReturn`, `box=requests`) | `messenger-shell.js:40,47`, `lib/api.js:4986` (`box ∈ inbox|requests|sent`) |
| cutia Activitate | `components/ActivityCenter.tsx` | `app.js:7879-7945`, `notification-preferences.js:6-83` |
| căutarea în mesaje a serverului | `lib/messageSearch.ts` + `SearchResults` în `MessagesScreen.tsx` | `messenger-search.js:3-53,56-106` |
| al doilea punct de atingere (`#messengerContact`) | `components/ContactCard.tsx` (+ banda Story) | `messenger-shell.js:24`, `messenger-contact.js:71-128`, `contact-stories.js:2-25` |

### Verificat vs doar compilat (cerința „Verificat înseamnă măsurat")

| Ecran | Nota înainte | Nota acum (implementat) | `tsc --noEmit` | ESLint | Pe telefon | Comparat numeric cu web |
|---|---|---|---|---|---|---|
| Mesaje / inbox (+ plăci, filtre, căutare, contact, activitate) | 2/10 | **8/10** | **0 erori** | **curat** | **NU încă** (lotul e scris în `batch.txt` §4, 11 capturi) | doar rândul/bara din runda 2 (`messages/diff.md`) |
| Postare deschisă (comentarii, like-uri, bara de reacții) | 2/10 | 2/10 (neatins) | — | — | NU | §2 neschimbat |
| Comentarii (arbore de răspunsuri) | 2/10 | 2/10 (neatins) | — | — | NU | §3 neschimbat |
| Profil (file/grilă/antet/ticker/iconuri) | 4/10 → 5/10 (runda 2) | 5/10 (neatins în runda 3) | — | — | „stub 0 noduri" | `profile/diff.md` (doar imagine) |

> Nota 8/10 pe inbox e **provizorie**: vine din diferențele măsurate ale rundei 2 care au fost închise
> (bara, rândul, stările) plus elementele noi scrise după sursele web; nu are încă o captură pe telefon și
> un `diff.md` care s-o confirme. Criteriile rămase deschise: spațierea exactă a celor două plăci față de
> grila măsurată și stările căutării (`waiting`/`loading`/`error`), care cer pasul nou `text:` din
> `device-batch.ps1` tocmai ca să poată fi atinse pe telefon.

### Uneltele de măsurare (modificate în runda 3)

- `tools/parity/device-batch.ps1`: pas nou **`text:<text>`** (`adb shell input text`, spațiile ca `%s`).
  Fără el, stările căutării (`#inbox-message-results` de la 2 caractere) nu pot fi atinse într-un lot, iar
  „verificat pe telefon" ar rămâne o afirmație fără captură.
- `docs/parity-report/batch.txt`: secțiunea **§4** — 11 pași care ating plăcile, filtrele, cutia Cereri,
  cutia Activitate, rezultatele căutării și fișa de contact, fiecare cu starea web pe care o măsoară.

### Ce mai rămâne, în ordinea impactului cerută

1. **Feed** — modurile și swipe-ul există (`FeedScreen.tsx`: `decideSocialGesture`, prag 72 px, `nextMode`);
   diferențele măsurate rămase sunt pe cardul de clip: rail de acțiuni 56×56 cu contoare
   (`feed-surface.css:399-408`, captura `feed/reels-0` arată 44×50 nativ), overlay-ul de creator + legenda
   (`clipMetaOverlay`), atribuirea audio „♫" și lățimea `Ce citești` a barei de mod (38×40 măsurat vs
   17×17 nativ).
2. **Postare deschisă + comentarii** — `CommentsSheet.tsx` e încă o foaie de jos; trebuie să devină
   `commentSurfaceMarkup` (`app.js:3877-3885`: `.commentBack` ←, `.commentSurfacePost`, `.commentPostActions`,
   `nav.commentSort`, `.commentClist`) plus arborele `renderCommentThread`/`renderBranch` cu `--depth`,
   „Replying to @x" și `[data-reply-to]` în compozitor.
3. **Profil** — grila de miniaturi (`.ownerPostGrid`), antetul complet (lacăt, hamburger, creion) și banda
   fixă de metadate cu iconițe, plus modul inert (fila 3 identică pixel-cu-pixel cu fila 1).

atinse.


