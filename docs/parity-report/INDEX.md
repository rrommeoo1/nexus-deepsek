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
2. **Postare deschisă**: să fie dialogul full-screen al web-ului cu `.commentSurfacePost` (postarea + creatorul), `.commentPostActions` (reacție + număr de comentarii) și tab-urile `commentSort`, nu o foaie de jos.
3. **Comentarii**: arborele recursiv (`detailReply[data-depth]`, „Replying to @x", acțiunile per răspuns, `[data-reply-to]` în compozitor).
4. **Bara de reacții**: sumarul compact „glife + număr" (`reactionSummaryMarkup`) și titlurile RO ale celor opt reacții.
5. **Viewer video**: rail-ul vertical de acțiuni (reacție 56×56, comentarii, salvare, distribuie), overlay-ul de creator și blocul de legendă/trust/atribuire audio.
6. **Story viewer**: butonul `•••` („Opțiuni") nu e desenat — singura acțiune pe care web-ul o leagă de el este arhivarea propriului story (`app.js:2776`), iar un meniu inventat ar fi o minciună.

## Runda 2 (offline, până la re-verificarea pe telefon)

| Ecran | Commit | Ce s-a schimbat (cu dovada) | Nota înainte → după (măsurat) |
|---|---|---|---|
| Bara de reacții (card + rail) | _vezi commitul de față_ | `REACTION_GLYPHS` verbatim din `app.js:3567` (♥ 💗 😂 😮 😢 😠 ◆ ▼ — telefonul desena 👍/👎/🟥), `REACTION_TITLES` (`reaction.*`: Like, Love, Haha, Wow, Trist, Furios, Fake?, Dislike), `reactionSummary()` cu regula de colaps a web-ului (≥85 % → un singur glif cu totalul; maximum 3; sumar neatins = inimă cu 0) și `ReactionControl.tsx`: cardul tipărește până la 3 perechi glif+număr (`reactionSummaryMarkup`), rail-ul tipărește gliful viewer-ului + totalul (`viewerReactionSummaryMarkup`), iar selectorul e placa măsurată `.reactionBar.expanded` (4 coloane, gap 8, padding 10, r16, `rgba(5,14,20,.96)`, contur `rgba(36,240,210,.3)`, titluri RO, `aria-expanded`/`aria-selected`) | **2/10 → 7/10** |

Diferențe măsurate rămase pe bara de reacții (nu se pot face „identic", se documentează):

- placa selectorului: pe shell-ul de telefon al web-ului (`:has(.clipsScreen)`) ea devine `#050608` fără blur, iar eu păstrez `rgba(5,14,20,.96)` (media dintre cele două reguli ale web-ului);
- marcajul „neatins": web-ul folosește `solidViewerIcon('heart')` (SVG alb), nativul folosește gliful ♥ alb — același desen, fără un al doilea set de iconițe;
- discurile de reacție de pe rail: web-ul lasă `background:transparent` pe shell-ul de clips, cu touch target 54×42/48 și rânduri 35/11 px, iar nativul desenează gliful la 26 px într-un touch target 54×44 (măsurat, în așteptarea capturii pe telefon).


Sesiune: `tools/parity/device-batch.ps1 -List docs/parity-report/batch.txt` pe `192.168.1.184:41461`
(Wireless debugging), **display principal = id SurfaceFlinger `4630946949513469331`** (1220×2656, DPR 2.6);
cover-ul (904×572, stins) este ignorat. Fiecare captură a fost verificată: focus `app.nexus.mobile.dev`
înainte de fiecare input, antet PNG `89 50 4E 47`, XML `uiautomator` scris lângă.

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


