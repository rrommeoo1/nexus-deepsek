# Matricea de paritate web ↔ nativ (Nexus)

> Scop: reproducere **1:1** a aplicației web din `apps/nexus-web/public` în aplicația nativă
> `apps/nexus-mobile`. Fiecare rând are dovadă (fișier din `docs/web-ref/`) și starea reală a
> implementării native. Nu se declară „paritate" până când toate rândurile nu sunt `identic` sau
> `gate` (blocate de infrastructură inexistentă pe server, marcate explicit).

## 0. Metodă și proveniență (Pasul 1, extras offline, fără telefon)

| Aspect | Valoare |
|---|---|
| Sursă | `https://nexus-deepsek-production.up.railway.app/` (build web **1.11**, citit din `NEXUS_BUILD_VERSION`) |
| Cont | `test@nexus.ro` (doar contul de test; parola **doar** din `NEXUS_TEST_ACCOUNT_PASSWORD`, nimic scris în fișiere comise — vezi `docs/TEST-DATA.md`) |
| Dispozitiv (interogat cu `adb shell wm size` / `wm density`, fără input) | fizic **1220×2656 px**, density override **416 dpi** ⇒ **DPR 2.6** |
| Viewport de emulare | **469×1021 CSS px**, `deviceScaleFactor 2.6`, `isMobile`, `hasTouch`, UA Chrome Android 128 |
| Unealtă | `tools/web-ref/*.mjs` — Playwright-core 1.63 + Chrome de sistem (fără descărcare de browser) |
| Capturi | `docs/web-ref/<ecran>/*.png` (scală CSS ⇒ ≤1500 px/latură, **nu** se citesc în conversație) |
| DOM | `docs/web-ref/<ecran>/*.dom.json` (geometrie în CSS px, `getComputedStyle`, text exact, SVG inline, stare) |
| Markup | `docs/web-ref/<ecran>/*.html.json` (`#phoneHeader`, `#screenViewport`, `#phoneNav`, plus containere) |
| Rețea | `docs/web-ref/_network/requests.json` (metodă, path, status, formă de răspuns; secrete redactate) |
| Tokens | `docs/web-ref/_tokens/*.json` (106 variabile CSS, fonturi, raze, umbre, animații, tranziții) |
| Rulare | `node tools/web-ref/crawl.mjs [--only=pas1,pas2]` · `node tools/web-ref/extract-tokens.mjs` |

**Structura descoperită:** pagina web nu este un site mobil, ci un **showcase desktop** care
randează un telefon simulat (`.demoStage > .phone > .phoneMetal > .phoneScreen > #phoneHeader,
#screenViewport, #phoneNav`). La lățimea CSS a dispozitivului, `.showcaseHeader`, `#moduleRail`,
`.infoPanel` și `footer.showcaseFooter` primesc `display:none`, deci rămâne exact ecranul
telefonului: **header 72 px**, **viewport 969 px** (scroll intern), **bară 60 px** (total 1021).

**Toleranțe folosite la comparație (nativ vs web):**
- geometrie: **±2 CSS px** pentru poziții/dimensiuni de cutii (Yoga/React Native vs Chromium nu
  rotunjesc identic sub-pixelii);
- text: **±6 %** lățime de text și **wrap diferit acceptat** (web: `Inter, ui-sans-serif, system-ui`;
  Android: `Roboto`/`system-ui`, inevitabil alt metric);
- culori: **exact** (hex/rgba identice), opacitate ±0.02;
- timpi de animație/gest: **exact** (valorile din CSS/JS-ul web, listate mai jos).

## Legendă stare
`identic` = există în nativ cu aceleași valori · `diferit` = există dar cu valori/structură
diferite · `lipsă` = nu există în nativ · `gate` = imposibil de portat (infrastructură server
absentă), marcat în MIGRATION.md · `n/a` = element de showcase desktop, irelevant pe telefon.

## 1. Shell (header, bară, drawer)

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| `.appHeader` înălțime 72 px, `display:grid` | `shell/home.html.json`, `.appHeader` r=[0,0,469,72] | `AppHeader.tsx` — `feedBar`/`screenBar` iau `feedHeader.height` / `appHeader.height` = **72** din `theme/social.ts` (layout flex, nu grid) | identic (înălțime; grid → flex) | — |
| Wordmark SVG `NE<b>X</b>US` + bare + 3 cercuri, `#wordmark` aria „Nexus Home · revino la prima pagină" | `shell/home.html.json` (SVG exact) | `NexusWordmark.tsx` + `tokens.graphics.wordmarkSvg` | identic | — |
| Build version `1.11` imprimat în `i.wordmarkBuild` | `shell/home.html.json` | citit din `/app.js` la runtime (`fetchBackendVersion`) | identic (sursă diferită, același număr) | — |
| Rail de mod `nav.feedModes[role=tablist]` aria „Ce citești" cu **un singur** tab vizibil `#feedModeCurrent` (glyph ▶ / ❝ / ▤) | `shell/home.html.json`, `feed/swipe-modes.json` | `AppHeader.tsx` — un singur `accessibilityRole="tab"` cu `accessibilityLabel` = titlul citirii, glyph + gradient din `socialTokens.feedModes` | aliniat (un singur tab + glyph; `tablist`-ul aria „Ce citești" nu are echivalent nativ) | P1 |
| `#feedModules` buton drawer (aria „Schimbă profilul Nexus", 2 dreptunghiuri + săgeți) | `shell/home.html.json` | `FeedDrawer.tsx` | diferit (de verificat) | P1 |
| `#modeBadge` (avatar persona + „NEXUS / Social" + ⌄) | `shell/home.html.json` | absent | lipsă | P0 |
| `#feedBadge` / `#friendsBadge` (doar off-feed: „Căutare", „Followers") | `search/initial-0.dom.json` (textLines) | absent | lipsă | P1 |
| Bară `.appNav.social` 60 px, 7 mărci: primary, inbox, search, create, friends, utility(Live), account | `shell/nav-marks.json` (x=8/72/136/200/269/334/398, w=63; create 68) | `AppNav.tsx` (7 destinații) | identic structural | — |
| Geometrie marcă: `i` 32×32 r12, svg 25×25 stroke 1.7, create 44×44 r19 border 5 | `theme/social.ts` (citat din CSS) | `AppNav.tsx` + `theme/social.ts` | identic | — |
| Iconițe SVG desenate (nu emoji) pentru cele 7 mărci + față reală în `account` | `nav-marks.js`, `shell/home.html.json` (img în `i`) | `NexusMark.tsx` | identic | — |
| Etichete: Acasă, Mesaje, „Găsește oameni și conținut", Creează, Prieteni, Live, Profil | `shell/nav-marks.json` | `AppNav.tsx` | identic | — |
| Badge `hasUnread` numeric (max 99) pe inbox | `app.js:2067-2073` | `AppNav.tsx` (pill `min(unread, 99)`, eticheta poartă suma) + `lib/unread.ts` (inbox + notificări, plafon 9999) | identic (de confirmat pe device) | P2 |
| Drawer „quick" (`feedQuickLayer`/`feedQuickDrawer`): grid 3 col, tile 40, închidere ×, tile-uri module + logout | `feed/drawer-open2.html.json`, `feed-surface.js:130-144` | `FeedDrawer.tsx` | diferit | P1 |
| Stare `aria-expanded` + focus return pe opener la închidere | `feed-surface.js:151-195` | de verificat | diferit | P2 |
| Pull-to-refresh: indicator `.pullRefreshIndicator` „↻ Trage pentru actualizare" → „Se actualizează", prag **dy ≥ 64**, `|dy| > |dx|*1.15`, doar la `scrollTop ≤ 1` | `social-gesture.js`, `app.js:2976-2999`, `feed/pull-refresh-text.json` | `FeedScreen.tsx` — ramura verticală rămâne neatinsă (revendicarea cere `\|dx\|` dominant, deci un pull nu e niciodată preluat), iar `RefreshControl` încarcă exact pagina acelei ramuri; indicatorul și textele sunt ale platformei | aliniat structural (copy-ul indicatorului, nu al web-ului) | P1 |

## 2. Feed — trei citiri (Reels / Șoapte / Știri)

Contract: `FEED_MODES = ["reels","whispers","news"]` (`feed-surface.js:14`), fiecare cu
`{tab, glyph, kind, format, lens}` → `reels: clips/null`, `whispers: tweets/for-you`,
`news: posts/breaking`. Ordinea de parcurgere la swipe: **reels → whispers → news → reels**
(`nextFeedMode`, `app.js:2999`; confirmat pe device în `feed/swipe-modes.json`).

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Swipe orizontal schimbă citirea: prag **\|dx\| ≥ 72** și **\|dx\| > \|dy\|*1.2**, offset +1 la stânga | `social-gesture.js`, `app.js:2960-3048` | `lib/socialGesture.ts` (`decideSocialGesture`, transcriere verbatim) + `FeedScreen.tsx` (`PanResponder`, revendicare la 24 px orizontali) → `nextMode` (ordinea `feedModes`, cu wrap) | identic | — |
| Blocare gest dacă pornirea e pe `button,input,textarea,select,a,.comments,.reactionBar,.clipMoreActions` | `app.js:3003,3018` | n/a structural — gestul e revendicat doar dacă e clar orizontal (≥ 24 px **și** > 1.2× verticala), deci o apăsare pe buton/card/comentarii nu e niciodată furată | aliniat prin construcție | — |
| `suppressFeedClickUntil = now+500` după schimbarea de mod (anti-click accidental) | `app.js:2998` | n/a — când părintele revendică responderul, `Pressable`-ul copil își anulează apăsarea, deci nu există click accidental de suprimat | n/a | — |
| Bazin gesturi: pointer (mouse, ignoră `pointerType==='touch'`) **și** touch pe `container.closest('.clipsScreen')` | `app.js:3001-3047` | n/a (nativ are un singur sistem) | n/a | — |
| Memoria poziției per mod: `feedScrollMemory` | `app.js` (feedScrollMemory, `app.js:1510` ctx) | absent | lipsă | P2 |
| Mod reels: `#pulsePosts` clasa `feedReels clipFirst`, carduri tip `article.clipCard.clipPost` | `feed/reels-0.html.json` | FeedScreen `reels` | diferit | P0 |
| Mod șoapte: card text `.whisperCard` cu autor, „Șoapte · acum X zile", „•••" | `feed/swipe-left-1.*`, `feed-surface.js:345` | FeedScreen `whispers` | diferit | P0 |
| Mod știri: stare **gol** reală: „Știrile sunt pregătite, dar oprite" + „Nicio sursă nu a fost aprobată încă. Fără o decizie de owner pentru un agregator din lista aprobată, Nexus nu are de unde lua titluri reale — și nu inventează niciunul." | `feed/swipe-left-2.html.json` (+ textLines) | FeedScreen `news` | de verificat copy | P1 |
| Fundal imersiv: `.screen.clipsScreen.presentation-immersive.media-fit-fill.feed-reels` | `shell/home.html.json` | absent (clase CSS) | n/a | — |
| Skelet/încărcare feed: `feedSkeletonMarkup` (3 carduri, shimmer 1.5s) | `feed-surface.js:250`, `_tokens/animations.json` | `FeedScreen.tsx` → `FeedSkeleton` (4 carduri cu blocuri statice, fără shimmer) | diferit (număr de carduri + animația) | P1 |
| Stare eroare feed: `feedErrorMarkup` | `feed-surface.js:275` | `FeedScreen.tsx` — mesajul serverului + buton „Reîncearcă" (`onRetry`) și scurtătura „Vezi <citirea următoare>" | parțial (copy de comparat cu `feedErrorMarkup`) | P1 |
| Stare gol: `feedEmptyMarkup` | `feed-surface.js:264` | `FeedScreen.tsx` (`emptyNote`, cu scurtătura spre citirea următoare) | parțial (copy de comparat) | P2 |
| „Mai mult" la capăt de listă: `feedMoreMarkup` cu cursor | `feed-surface.js:441` | `FeedScreen.tsx` — cursor + `onEndReached` (prag 0.6), subsol cu spinner; fără markup-ul „mai mult" | parțial | P2 |
| Zgomot/audio: `feedAudioMarkup` + buton `♫` per card (`applySocialMuted`) | `feed-surface.js:387`, `app.js:420-453` | ReelsReader (mute toggle) | diferit | P1 |
| Story rail: shelf-ul de momente `feedStoryRailMarkup` + `bindStoryImages`; trăiește pe ecranul **Mesaje** (nu pe feed), măsurat 437×160 la y=134 | `feed-surface.js:285-331`, `messenger-shell.js:46`, `docs/web-ref/messages/inbox-0.dom.json` | **desenat**: `StoryRail.tsx` + `StoryViewer.tsx` + `lib/stories.ts`, ca antet al listei din inbox (`MessagesScreen`) | parțial — vezi `docs/parity-report/INDEX.md` §1 (măsurătoare pe telefon în așteptare) | P1 |
| Atribuire audio în reel full-screen: „♫ What Is Love — Melanie Ungar · CC BY" | `viewer/reel-fullscreen.dom.json` | absent | lipsă | P2 |

### 2.1 Anatomia cardului de reel (web, markup exact)

Sursa: `docs/web-ref/friends/switcher-open.html.json` (conține cardul 5 complet) + `feed/reels-0.html.json`.

| Element | Web (clase/aria) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Card | `article.post.postOpenable.clipCard.clipPost[data-post-id][data-post-author][data-post-open][role=article][tabindex=0]` | `PostCard.tsx` | diferit (lipsesc data-*+role/tabindex) | P1 |
| Stage media | `.clipStage > .studioMedia.aspectOriginal[data-music-volume="0.7"] > img.media.studioAsset` (cu `filter`, `transform:rotate(x) scale(x)`, `object-position`) | `PostMedia.tsx` | diferit | P0 |
| Overlay creator | `.clipMetaOverlay > .clipCreator.clipIdentityPersistent > button.creatorStoryTrigger[data-creator-story=handle]` cu avatar 24px + nume `bdi[dir=auto]` | `PostCard.tsx` (antet autor) | diferit | P1 |
| Legendă | `.clipCaptionBlock[data-expandable-caption][aria-expanded=false] > span[data-caption-text]` + `b.publishedTitle` | PostCard (text) | diferit | P1 |
| Traducere | `button.clipTranslate[data-caption-translate][data-source-language]` „Vezi traducerea" | absent | lipsă | P2 |
| Trust | `button.trustSummary[data-trust]` „◊ Trust Lens · Neverificat factual" | absent | lipsă | P2 |
| Rail acțiuni | `.clipQuickActions[aria-label="Acțiuni clip"]`: avatar creator (story), reacție (`.on` + glyphe WOW + număr), comentarii (`data-comments`, svg bubble + count), salvare (`data-save`, svg bookmark), distribuie (`data-clip-distribute`, svg share) | PostCard/ReelsReader (reacții 8, comentarii, salvare) | diferit (lipsește rail-ul vertical cu ordinea și aria) | P0 |
| Meniu distribuie | `.clipDistributeMenu[role=menu][aria-label="Repost / Distribuie"]` cu `menuitem` Repost etc., `aria-expanded` pe buton | absent | lipsă | P1 |
| Sortare comentarii | `nav.commentSort[aria-label=Comentarii]` cu tab-uri **„Comentarii relevante" / „Cele mai noi"** (`data-comment-sort=relevant|newest`) | `CommentsSheet.tsx` | de verificat | P2 |
| Listă comentarii | `div.clist[role=feed]` | CommentsSheet | diferit | P1 |
| Compozitor comentariu | `form.commentComposer[data-comment-form] > input[name=body][placeholder="Scrie un comentariu…"]` + `.cancelReply[aria-label="Anulează răspunsul"]` + `.commentSend[aria-label=Trimite]` | CommentsSheet („Adaugă un comentariu…") | diferit (placeholder!) | P1 |
| Alegător reacții (8) | `data-reaction=LIKE|LOVE|HAHA|WOW|SAD|ANGRY|FAKE_OPINION|DISLIKE`, titluri RO: Like, Love, Haha, Wow, **Trist**, **Furios**, **Fake?**, **Dislike** | `postInteractions.ts`/PostCard (8 reacții) | de verificat titluri RO | P1 |
| Buton reacție | `[data-reaction-toggle][data-reaction-display=compact][aria-label="Deschide selectorul de reacții"]` cu sumar glife + `em` număr | PostCard | diferit | P1 |

## 3. Profil (propriu și al altora)

Dovadă: `profile/own-0.*` (214 noduri, 133 butoane), `profile/tab-0..4.*`, `profile/edit-open.*`,
`profile/menu-open.*`, `profile/switcher-open.*`.

Copie exactă din hero (web): „Test Nexus" / „@test · Kraków, Polonia · 25 ani · 5 postări ·
0 followers · 0 following" / bio „Cont public pentru testarea interfeței Nexus." / pastile
„📍 Kraków, Polonia", „🎂 25 ani", „@test", „5 postări", „0 followers", „0 following", iconițe
„✎ ≡ ▶ ▦ ❝ ✦ ▾", apoi „📌 👁 1 ⏳".

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Antet profil: avatar + nume + handle + oraș + vârstă + contoare | `profile/own-0.dom.json` | `ProfileScreen.tsx` (205 linii) | diferit (simplificat) | P0 |
| Bio în hero | idem | ProfileScreen | de verificat | P1 |
| Pastile de fapte: 📍 oraș, 🎂 vârstă, @handle, N postări, N followers, N following | idem | parțial | diferit | P1 |
| Bara de acțiuni a hero-ului: ✎ (edit), ≡ (meniu), ▶, ▦, ❝, ✦, ▾ | idem | absent | lipsă | P0 |
| Iconițe de meta: 📌 (fixat), 👁 (vizualizări), ⏳ (vechime) | idem | absent | lipsă | P2 |
| Ticker (owner): `.ownerTickerRoll` cu `--tickerSpan` implicit **48s** linear infinite | `_tokens/animations.json`, `profile-ticker.js` | `ProfileTicker.tsx` (ticker:7) | de verificat durata | P1 |
| Tab-uri sub ticker (iconografice) + panoul conținutului | `profile/tab-0..4.*` | ProfileTicker + ProfileScreen (Tab:7) | diferit | P0 |
| Card „Ai repostat / la postarea @test" | `profile/own-0.dom.json` | absent | lipsă | P2 |
| Postări în profil cu „@test · acum 8 zile", „Deschide răspunsul în conversație" | idem | ProfileScreen | parțial | P1 |
| „✦ Semnal pentru tine — Ai apreciat conținut similar · Ai mai văzut-o de câteva ori · Este mai veche de trei zile" | `ranking-reasons.js`, `profile/own-0.dom.json` | absent | lipsă | P2 |
| Fișă de editare `heroEditSheet` („Editează profilul"): Nume, Data nașterii („O alegi o dată din calendar, iar vârsta se calculează singură în fiecare an: nu o mai scrii niciodată."), Orașul, Bara de status, Bio în acest mod, Fotografia de profil, Coperta („Fotografia de copertă este cea implicită.", „Fără copertă · story salvate"), „Schimbă fotografia de copertă" („16:9 recomandat · imagine separat pentru acest profil"), „Ajustează poziția în cadru", „Cine poate vedea profilul" (Public / Privat 🔒, „Profil public: oricine vede profilul și banda de deasupra lui."), „Prețuri și acces" („Ownerul alege prețul/zi; minimul este 1 USD echivalent stablecoin.") | `profile/edit-open.dom.json` (281 noduri) | absent | lipsă | P0 |
| Meniu profil `profileMenuDrawer` („PROFIL / Cont și setări", „Toate setările se deschid din acest meniu; închiderea lui te lasă pe profil."): Profil, Wallet și username, Acces și securitate, Confidențialitate, Notificări, Temă și aspect, **Logout** („Închide sesiunea pe acest dispozitiv; contul rămâne.") | `profile/menu-open.dom.json` (260 noduri), `profile-menu.js`, `profile-settings-panels.js` | absent | lipsă | P0 |
| Switcher de profiluri & aplicații (`#modeBadge`): `data-switch-persona` (Social/Work/Dating/Travel/Market, „Activ"/„›"), `data-switch-module`, nota „Profilele păstrează separat avatarul, bio, privacy și relațiile…", secțiunea „Unde citești" (`feedSourceSectionMarkup`: for-you/local/global/following/photos/friends/private + Prezentare cards/immersive + Media fit fill/fit), rândul de logout | `profile/switcher-open.html.json`, `app.js:1975-2010`, `feed-surface.js:39-56` | absent | lipsă | P0 |
| Profilul altcuiva (`renderProfilePreview`) | `app.js:9263` | absent | lipsă | P1 |
| Modal cont (`account-modal`): `renderAssetList`, `renderTopupSheet` | `app.js:9317-9345` | absent | lipsă | P2 |
| Setări: `profile-settings-panels.js`, `notification-preferences.js`, `profile-private-access.css` | fișiere sursă | absent | lipsă | P1 |

## 4. Mesaje (inbox)

Dovadă: `messages/inbox-0.*` (92 noduri), `messages/tabs.json`, `messages/thread-0.*`.

Copie exactă: header „NE X US 1.11 | MESSAGES | Social ⌄ | Toate | TE | +"; secțiune
„Story-ul tău"; stare gol „Nicio conversație aici" / „Pornește una folosind username-ul Nexus,
nu un ID numeric."

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Titlu „MESSAGES" + badge persona „Social ⌄" în header | `messages/inbox-0.dom.json` | `MessagesScreen.tsx` (257 linii) | diferit | P1 |
| Filtre „Toate" / „TE" + buton „+" | `messages/tabs.json` | MessagesScreen | de verificat | P1 |
| Rail de story-uri („Story-ul tău" + contacte) | `messages/inbox-0.html.json` (`storyRail`, `stories`) | absent | lipsă | P0 |
| Listă conversații (avatar, nume, ultim mesaj, timp, necitite) | `renderMessages` (`app.js:7797`), `isSafeConversationSummary` | MessagesScreen | diferit | P0 |
| Stare gol | idem | MessagesScreen | de verificat copy | P1 |
| Fir de conversație (`openThread`/`loadThread`) | `app.js:8039,8192` | MessagesScreen | diferit | P0 |
| Compozitor mesaj + transport (`syncMessageTransportChoice`) | `app.js:8186` | absent | lipsă | P1 |
| Indicator „scrie…" (`signalTyping`/`sendTypingState`) | `app.js:8427-8446` | absent | lipsă | P2 |
| Meniu conversație + preferințe (`conversation-menu.js`, `conversation-preferences.js`) | fișiere sursă | absent | lipsă | P2 |
| Acțiuni de fir: `manageGroup`, `scheduleMeeting` | `app.js:8467,8534` | absent | lipsă | P2 |
| Căutare messenger (`messenger-search.js`, `GET /api/chat/search`) | fișier sursă | absent | lipsă | P2 |
| Shell messenger (`messenger-shell.js`, `messenger-spaces.css`) | fișiere sursă | absent | lipsă | P1 |
## 5. Căutare

Dovadă: `search/initial-0.*` (78 noduri), `search/inputs.json`, `search/results-test-0.*` (104 noduri),
`search/result-opened.*`.

Copie exactă: „CĂUTARE SOCIALĂ GLOBALĂ" / „Găsește oameni și conținut" / input
`input#social-search-input[name=q]` placeholder **„Caută în Nexus Social"** (16,191,358,44) /
buton „Caută" / „Respectă profilurile private, blocările și izolarea Social. Rezultatele organice nu
includ actori de test sau trafic plătit." / „Începe cu cel puțin 2 caractere" /
„Demo-ul folosește indexul local verificabil; indexul federat rămâne un gate separat."

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Titlu + subtitlu | `search/initial-0.dom.json` | `SearchScreen.tsx` (131 linii) | de verificat copy | P1 |
| Input `#social-search-input` (placeholder „Caută în Nexus Social", name=q, 358×44 la y=191) | `search/inputs.json` | SearchScreen | diferit (placeholder) | P1 |
| Buton „Caută" + submit la Enter | idem | SearchScreen | de verificat | P1 |
| Notă de privacy (text exact) | idem | absent | lipsă | P1 |
| Hint „Începe cu cel puțin 2 caractere" + nota despre index | idem | absent | lipsă | P2 |
| Secțiune **OAMENI**: nume, `@handle`, „N followers" | `search/results-test-0.dom.json` | SearchScreen (profiles) | de verificat | P1 |
| Secțiune **CONȚINUT**: card + „Trust Lens · Neverificat factual", „Gestionează postarea", „Istoric versiuni", „Vezi profilul", „Trimite mesaj", „N vizualizări", „PREVIEW ANIMAT LOCAL", „Nexus Creator Studio", „Sursa clipului nu mai este disponibilă. Încarcă un clip nou din Creează." | idem | SearchScreen (posts) | diferit (lipsesc acțiuni per rezultat) | P0 |
| Deschiderea unui rezultat de postare duce la postarea completă | `search/result-opened.*` | §10 rând 8 din MIGRATION (todo) | lipsă | P0 |

## 6. Prieteni / relații

Dovadă: `friends/switcher-open.*`, `friends/drawer-buttons.json` (gol — tab-urile stau în
`.profileSwitcher`). Copie exactă: „PRIETENI SOCIAL" / „Relații rapide" / × /
tab-uri **Following | Favorite | Cereri** / stare gol „Lista este goală" / „Apasă steaua pe
persoane urmărite ca să le vezi rapid aici."

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Drawer de relații cu titlu + subtitlu | `friends/switcher-open.dom.json` | `FriendsScreen.tsx` (229 linii) | diferit (nativ = ecran, web = drawer peste ecranul curent) | P0 |
| Tab-uri Following / Favorite / Cereri | idem | FriendsScreen (Follow:17, Cereri:1, Tab:15) | de verificat | P1 |
| Stare gol per tab (text exact) | idem | de verificat | P1 |
| Acțiuni per persoană (urmărire, stea/favorit, acceptare cerere) | `app.js:1558-1598`, `GET /api/social/relations`, `POST /api/follow` | FriendsScreen | de verificat | P0 |
| Drawer care nu schimbă locul cititorului (`navigate` → `openSocialFriendsSwitcher`) | `app.js:2078` | nativ schimbă ecranul | diferit | P2 |

## 7. Live

Dovadă: `live/screen-0.*`, `live/tab-0..3.*`, `live/prepare-live.*`, `live/buttons.json`.

Copie exactă: „NEXUS SOCIAL" / „Live" / „Creatori live, Battle și Campionate" / buton
„● Pregătește Live" / tab-uri **Acum | Urmărești | Battle | Campionate** / stare gol
„Niciun Live verificat acum" / „O sesiune apare numai după verificarea transportului video,
moderării și numărului organic de spectatori." / „Ordine Live: spectatori organici concurenți, apoi
followers eligibili. Sigil-ul și plățile nu cumpără poziția."

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Titlu/descriere + buton „Pregătește Live" | `live/screen-0.dom.json` | `LiveScreen.tsx` (115 linii) | de verificat | P1 |
| Tab-uri Acum / Urmărești / Battle / Campionate | `live/buttons.json` | absent | lipsă | P0 |
| Stare gol „Acum" (text exact) | `live/tab-1.dom.json` | LiveScreen | de verificat | P1 |
| Stare gol „Urmărești": „Nimeni urmărit nu este Live" | `live/tab-2.dom.json` | absent | lipsă | P1 |
| „Battle": „1 VS 1", „Nexus Battle", „Dueluri între creatori, cu scor organic și reguli publice.", „＋ Creează", „Niciun Battle public", nota reguli/escrow | `live/tab-3.dom.json` | absent | lipsă | P1 |
| „Campionate" (același șablon) | `live/tab-3.dom.json` | absent | lipsă | P2 |
| Sheet „LIVE STUDIO · VERIFICARE DISPOZITIV": „Pregătește transmisia", „PREVIEW LOCAL · NU EȘTI LIVE", Camera/Microfon ON (sau eroare „Camera sau microfonul nu este disponibil"), „Întoarce", Titlu, Categorie (Creator/Muzică/Gaming/Discuții/Sport/Educație), Audiență (Public/Followers/Privat), Limbă, Comentarii active, „Salvează preview privat" | `live/prepare-live.dom.json` | absent | lipsă | P1 |
## 8. Creare (compozitor/cameră)

Dovadă: `create/camera-0.*` (90,7 KB markup), `create/camera-text.json`.

Copie exactă de pe suprafața de cameră (web): „×", „♫ Add sound", „↻", „✦", „◴ Timer",
„▦ Layout", „⚄ 3:4 · 1×", „✣ Retouch", „◉ Filters", „⌄", „PHOTO | VIDEO", „☀", „●", „▧", „+",
bara de moduri **CAMERA | CREATE | LIVE | DRAFTS**, plus linia de control a cadrului:
„9:16 · 0,7× neconfirmat" / „Încearcă alt obiectiv" /
„senzor 2×2 (1.00) · cerut 1080×1920 (0.56) · ecran 469×1021 (0.46) · fit complet".

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Suprafață de cameră cu cadru 9:16 implicit și 0,7× unde există | `create/camera-text.json`, `reel-camera-framing.js` | `app/camera.tsx` (464 linii) — cameră nativă | identic ca principiu (cameră nativă păstrată) | — |
| Linia de control a cadrului (sensor/cerut/ecran/fit) | idem, `reel-camera-quality.js` | de verificat | P2 |
| Buton „×" de ieșire cu confirmare (`composerExit`) | `composer-exit.js`, `requestActiveCameraExit` (`app.js:211`) | de verificat | P1 |
| Bară de moduri CAMERA / CREATE / LIVE / DRAFTS | `composer-tools.js`, `create/camera-text.json` | `app/camera.tsx` (Menu:8) | diferit | P1 |
| Sunet/melodie („Add sound", `♫`) | `composer-camera.js`, `music-grow-module.js` | absent | lipsă | P2 |
| Timer / Layout / Retouch / Filters | `composer-tools.js`, `reel-editor-overlays.js` | parțial (editor nativ) | diferit | P1 |
| Alegător de emoji (`composer-emoji.js`) și picker (`composer-picker.js`) | fișiere sursă | absent | lipsă | P2 |
| Sticker-e pentru reel (`reel-sticker-catalog.js`) + suprapuneri editor (`reel-editor-overlays.js`) | fișiere sursă | parțial | diferit | P1 |
| Opțiuni de clip (`clip-options.js`) și prezentare publicată (`published-presentation.js`) | fișiere sursă | absent | lipsă | P2 |
| Draft-uri locale + sincronizare (`draft-policy.js`, `creator-draft-sync.js`, `draftsClient.ts` nativ) | fișiere sursă + `src/lib/draftsClient.ts` | diferit | P1 |
| Flux de publicare (`post-publishing.js`, `post-publishing.css`) cu stări încărcare/eroare/reluare | fișiere sursă + `src/components/PublishPanel.tsx` | diferit | P1 |
| Etichete/locale în compoziție (`interface-locale.js` 366 KB, 4 limbi) | fișier sursă | parțial (RO în cod) | diferit | P1 |

## 9. Suprapuneri (overlay-uri) și vizualizatoare

Dovadă: `viewer/reel-fullscreen.*`, `viewer/media-viewer.*`, `comments/drawer-open.*`,
`post/detail-open.*`, `_run-log.json` (`closed-overlays: mediaViewer, reelViewer, liveSetupSheet,
liveDeviceSheet, heroEditSheet, profileMenuDrawer`).

| Element | Web (dovadă) | Nativ acum | Stare | Prior. |
|---|---|---|---|---|
| Vizualizator reel pe tot ecranul (`.reelViewer`), deschis prin tap pe `video[aria-label="Deschide Reel-ul pe tot ecranul"]` | `viewer/reel-fullscreen.dom.json` (177 noduri) | `ReelsReader.tsx` (348 linii) | diferit | P0 |
| Gest în vizualizator: `decideViewerGesture`, prag **48 px** pe axa dominantă, pas ±1 | `social-gesture.js`, `app.js:5128,5186-5225` | `lib/socialGesture.ts` (`decideViewerGesture`) folosit de `MediaViewer.tsx`; `ReelsReader.tsx` rămâne pe paginarea nativă (`pagingEnabled` + `snapToInterval`) | parțial (decizia e portată, readerul de reel nu o folosește) | P0 |
| Atribuire audio „♫ What Is Love — Melanie Ungar · CC BY" | `viewer/reel-fullscreen.dom.json` | absent | lipsă | P2 |
| Vizualizator media (`.mediaViewer`) cu compozitor „Adaugă un comentariu…" | `viewer/media-viewer.dom.json` (153 noduri) | `MediaViewer.tsx` — galerie cheiată pe postare, contor „n / N", plăci ‹ ›, „×"; compozitorul de comentarii trăiește în `CommentsSheet.tsx` (deschis din card) | parțial | P0 |
| Închidere prin `history.back()` și `Modal.onRequestClose` | `app.js:4788-4790, 4940` | MediaViewer (BACK) | identic | — |
| Gesti în vizualizatorul media (8: fit/zoom/pan/swipe) | `app.js:4911-5000` | `MediaViewer.tsx` — un flick = un pas (48 px, axa dominantă, wrap); fit/zoom/pan neportate | parțial | P1 |
| Foaie de comentarii (`.clipCommentsDrawer` + `[data-comments-scrim]`, sortare, compozitor) | `comments/drawer-open.*`, `app.js:3887-3895` | `CommentsSheet.tsx` (220 linii) | diferit | P1 |
| Detaliu postare (`post-detail.js` 33 KB, `post-detail.css` 23 KB) cu fir de răspunsuri | `post/detail-open.*` | absent | lipsă | P0 |
| Deep-link de postare `#post-<id>` și `#reply-<id>` (hash + `replaceState`) | `app.js:1228-1252,3998-4026` | absent | lipsă | P2 |
| Vizualizator de story (`.storyViewer`, gest 48 px, tap dreapta = următorul) | `app.js:3340-3400` | absent; captura a eșuat (`story-opened=false`, feed de test fără story-uri) | lipsă / de recapturat | P1 |
| Modal de cont (`.account-modal`) | `app.js:9317-9345` | absent | lipsă | P2 |
| Onboarding (`openOnboarding`/`maybeStartOnboarding`) | `onboarding.js`, `app.js:1263-1305` | absent | lipsă | P2 |
| Toast global (`#toast`) și starea rețelei (`#network-state`) | `index.html`, `app.js:397` | absent | lipsă | P2 |

## 10. Transversal (gesturi, animații, tokens, rețea, limbă)

### 10.1 Praguri de gest — valori exacte din codul web

| Gest | Valoare | Sursă |
|---|---|---|
| Swipe canal (feed) | `\|dx\| ≥ 72` **și** `\|dx\| > \|dy\| * 1.2`; offset `+1` dacă `dx < 0` | `social-gesture.js`, `app.js:2980-2999` |
| Pull-to-refresh (feed) | `scrollTop ≤ 1` **și** `dy ≥ 64` **și** `\|dy\| > \|dx\| * 1.15`; indicator `--pull-distance = min(1, dy/64)` | `social-gesture.js`, `app.js:2971-2974` |
| Swipe vizualizator (reel/media) | `max(\|dx\|,\|dy\|) ≥ 48`; axa dominantă; pas `±1` (`dx<0`/`dy<0` → +1) | `social-gesture.js`, `app.js:5128` |
| Suprimare click după gest | 500 ms (canal) / 650 ms (refresh) | `app.js:2985, 2998` |
| Zonă ignorată la gest | `button,input,textarea,select,a,.comments,.reactionBar,.clipMoreActions` | `app.js:3003, 3018` |
| Fold-ul barei pe reel | `scrollTop ≥ 0.5 * înălțimea coloanei` (fallback 240) | `feed-surface.js:241-242` |

**Cum arată aceste praguri în nativ** (`apps/nexus-mobile`): deciziile stau în `src/lib/socialGesture.ts`
(`decideSocialGesture` / `decideViewerGesture`, transcrieri ale `social-gesture.js`), iar pragul de
**revendicare** al `PanResponder` este **24 px** — sub pragul de decizie, pentru că un gest nativ trebuie
revendicat *înainte* de a putea fi decis (altfel lista îl consumă). Pull-to-refresh-ul rămâne al
`RefreshControl`-ului, iar consecințele sunt asumate în `apps/nexus-mobile/MIGRATION.md` §16.

### 10.2 Animații și tranziții (durate/easing extrase)

| Animație | Valoare | Sursă |
|---|---|---|
| `feedQuickIn` (drawer de module) | `0.18s ease-out both` | `feed-surface.css` |
| `feedShimmer` (schelet feed) | `1.5s ease-in-out infinite` | `feed-surface.css` |
| `nexusHeartPop` (dublu-tap like) | `0.72s ease-out forwards` | `double-tap-heart.js` + CSS |
| `p3PanelIn` (panouri/foi) | `0.18s ease-out both` | `p3-visual-foundation.css` |
| `profileMenuIn` (meniu profil) | `0.22s ease-out both` | `profile-experience.css` |
| `ownerTickerRoll` (ticker) | `var(--tickerSpan, 48s) linear infinite` | `profile-ticker.js` |
| `nexusMusicDisc` | `5s linear infinite` | `music-grow-module.css` |
| `carFloat`, `stickerPulse` | prezente în tokens | `_tokens/animations.json` |
| `prefers-reduced-motion` | 34 tranziții + `animation:none!important` (13 locuri) | `_tokens/transitions.json` |

### 10.3 Tokens extrași (106 variabile CSS; fișier complet: `_tokens/css-variables.json`)

| Token | Valoare | Sursă |
|---|---|---|
| `--bg / --panel / --line / --muted / --text` | `#090e14 / #131c26 / #ffffff14 / #95a5b7 / #eff4fa` | `social-design.css` |
| `--cyan / --purple / --bubble` | `#6ce9e4 / #9692ff / #243640` | `social-design.css` |
| `--panel2 / --teal / --gold / --void / --void2` | `#0d1822 / #20e0d0 / #f7b94c / #02050b / #07101a` | `styles.css` |
| `--glass / --glass2 / --violet / --pink / --softText` | `rgba(11,22,34,.58) / rgba(20,33,51,.42) / #8b5cff / #ff4f8f / #dff7ff` | `styles.css` |
| `--nx-void … --nx-muted` | `#00030a, rgba(12,24,40,.58), rgba(18,33,54,.74), #37f7ff, #24f0d2, #8c62ff, #ff4d88, rgba(160,190,255,.24), #effbff, #91a5b7` | `styles.css` |
| `--nx67-void … --nx67-muted` | `#0a0a0f, rgba(10,18,28,.76), rgba(8,15,24,.92), #00e5ff, #24ead8, rgba(135,183,220,.22), #a9bac5` | `styles.css` |
| `--nexus-screen-radius` / `--nx-viewport-height` | `18px` / `100dvh` | `screen-shell.css` / `p3-visual-foundation.css` |
| Raze frecvente | `50%`(133×), `12px`(97×), `10px`(70×), `14px`(67×), `8px`(54×), `13px`(47×), `9px`(47×), `16px`(46×), `18px`(41×), `15px`(29×) | toate CSS |
| Stivă de fonturi | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | `styles.css` |
| Umbre | 302 declarații (`_tokens/shadows.json`); card login `0 24px 72px rgba(0,0,0,.72)` | `styles.css` |

### 10.4 Endpoint-uri (log în `_network/requests.json` + inventarul MIGRATION §12)

| Ecran | Endpoint-uri |
|---|---|
| Shell/sesiune | `GET /api/me` |
| Feed | `GET /api/social/feed?format=clips|tweets|posts&lens=…&cursor=…` |
| Reacții/comentarii/salvare | `POST /api/social/posts/:id/reaction`, `GET/POST /api/social/posts/:id/comments`, `POST /api/social/posts/:id/save` |
| Profil | `GET /api/social/profiles/:handle`, `POST /api/social/profile/heros`, `PATCH /api/social/profile` |
| Mesaje | `GET /api/chat/conversations`, `GET/POST /api/chat/conversations/:id/messages`, `GET /api/chat/search` |
| Căutare | `GET /api/social/search?q=` |
| Prieteni | `GET /api/social/relations?kind=followers|following`, `GET /api/follow/requests`, `POST /api/follow`, `POST /api/follow/requests/:id/decision` |
| Live | `GET /api/social/live` (`transport.status = GATED_NO_SFU`), `POST /api/social/live/preview`, `POST /api/social/live/competitions` |
| Story | `GET /api/social/stories`, `POST /api/social/stories`, `POST /api/social/stories/:id/progress` |

### 10.5 Limbă și copie

Web-ul are `interface-locale.js` (366 KB, 4 limbi) cu toate cheile `t("…")`. Nativul scrie momentan
textele românești direct în componente → **rând de matrice: `lipsă` strat de traducere (P1)**.
Textele trebuie preluate identic din `*.dom.json → textLines`.

## 11. Acoperire (numărători)

| Secțiune | Rânduri | identic | diferit | lipsă | gate | n/a |
|---|---|---|---|---|---|---|
| 1. Shell | 15 | 6 | 4 | 3 | 0 | 2 |
| 2. Feed + card | 27 | 0 | 12 | 13 | 0 | 2 |
| 3. Profil | 17 | 0 | 4 | 11 | 0 | 2 |
| 4. Mesaje | 13 | 0 | 5 | 8 | 0 | 0 |
| 5. Căutare | 8 | 0 | 2 | 3 | 0 | 0 |
| 6. Prieteni | 5 | 0 | 2 | 0 | 0 | 3 |
| 7. Live | 9 | 0 | 1 | 6 | 1 | 1 |
| 8. Creare | 12 | 1 | 6 | 4 | 0 | 1 |
| 9. Suprapuneri | 13 | 1 | 5 | 7 | 0 | 0 |
| **Total** | **119** | **8** | **41** | **55** | **1** | **14** |

*(„de verificat" e numărat la `diferit` până la comparația numerică pe device.)*

## 12. Ce mai trebuie capturat + reguli de operare

1. Story viewer cu un cont care are story-uri (feed-ul de test nu are: `story-opened=false`).
2. Fir de conversație real (inbox-ul contului de test e gol: 0 conversații). Dovada de structură și copy
   pentru inbox există totuși (`messages/inbox-0.dom.json`, **92 noduri**, `textLines`), iar `inbox-0.png`,
   `inbox-s0.png` și `thread-0.png` sunt **aceeași imagine** — normal, cu un inbox gol pașii nu schimbă
   nimic vizibil. Regula generală observată: crawlerul emite **un PNG per grup de stare** (7 identice în
   `comments/`+`post/`, 3 în `profile/`), deci comparația de geometrie/culoare se face pe `*.dom.json`,
   nu pe PNG.
3. ~~Activitatea de notificări din inbox~~ → **pas pregătit** (`messages-activity`: `[data-inbox-box="activity"]`

## 13. DECIZIE DE DESIGN A PROPRIETARULUI — antetul profilului nativ (fără cover) + sistemul unificat de relații

**Data:** 17 octombrie 2026 · **Aplicabilitate:** **doar antetul profilului din aplicația nativă** (`apps/nexus-mobile`) și sistemul de relații al aplicației. **Nu** se aplică site-ului: `apps/nexus-web` rămâne neatins și funcțional așa cum este pe Railway.

Aceasta nu este o abatere accidentală și nu este o lipsă de paritate: este o **decizie de design a
proprietarului**. Antetul nativ al profilului a fost reproiectat după modelul unui profil de TikTok, cu
identitatea vizuală Nexus (culorile, fonturile și iconițele produsului). Rândurile din §2–§3 ale acestei
matrice care descriu `ownerCover`, `ownerAvatar` 78px, numele de 17px și creionul din rândul benzii sunt
marcate ca **deviate prin decizie**, nu ca `diferit` de corectat.

### 13.1 Ce se abate (și de ce)

| Element web | Decizia nativă | Motivul (al proprietarului) |
|---|---|---|
| `.ownerCover{height:72px}` — banda de copertă | **eliminată complet**: fără poză, fără spațiu rezervat; editorul nu mai are câmp de copertă | antetul cerut nu are copertă; o poză stocată pe server rămâne acolo, nedezvăluită |
| `.ownerAvatar` 78px cu inel alb de 2px | cerc de **92dp** cu **inel de story** (accent când există story necitit) | identitatea mare a modelului |
| nume 17px + `@handle` ascuns în bandă | nume **~28sp bold** + `@handle` **~15sp** sub el | blocul de identitate al modelului |
| contoarele (postări/urmăritori/urmăriți) în banda derulantă | **rând fix de statistici** (3 coloane, număr ~20sp peste etichetă ~14sp), apăsabile spre liste | numerele nu se repetă: scoase din bandă |
| fără butoane de relație în antet | **rând de butoane** pe toată lățimea: relația (accent), `Mesaj Nexus`, buton rotund de meniu; pe propriul profil: `Editează profilul`, `Distribuie profilul`, meniu | acțiunea corectă lângă fiecare cont, peste tot |
| creion `✎` la capătul rândului benzii | **eliminat**; editorul este primul buton lat al antetului | o singură ușă către editor, în rândul de butoane |
| fără latură de bio în hero | descriere (cu `Vezi mai mult`), adresă apăsabilă din descriere, loc și vârstă | informația contului, sub butoane |
| banda derulantă de sub hero (`ownerTickerRow`) | **scoasă din ecranul de profil**: antetul tipărește deja descrierea, locul, vârsta, handle-ul și contoarele, iar banda le repeta pe toate | o citire stă într-un singur loc; componenta `ProfileTicker` rămâne pentru suprafețele fără antet propriu, iar spațiul dintre antet și bară îl ține `identity.paddingBottom` |

### 13.2 Ce rămâne paritate 1:1 (neatins de decizie)

* banda derulantă (`ownerTicker`), ca **componentă**: aceleași citiri, același ritm, aceleași uși, cu două
  comutatoare (`counters`, `identity`, amândouă implicite `true`). Pe ecranul de profil nu se mai desenează:
  antetul §13.1 tipărește fiecare citire o singură dată. `scripts/test-ticker-parity.cjs` păstrează valorile
  webului în componentă și apără absența rândului din `ProfileScreen`;
* bara de file (≡ ▶ ▦ ❝ ✦ ⌄) și regiunea de conținut de sub ea: neschimbate (`scripts/test-profile-content-parity.cjs`);
* bara de sus a ecranului de cont: continuă să fie ascunsă de shell (`profile-experience.css:1`), iar cele trei bare ale antetului rămân singura ușă către sertar;

### 13.3 Cum se revine la 1:1

Dacă proprietarul cere vreodată antetul web și în aplicația nativă, munca este o sarcină separată: se
reintroduce `ProfileCoverPhoto` în `ProfileScreen`, se scoate `ProfileHeader`, iar `scripts/test-hero-parity.cjs`
își recapătă vechile verificări (fișierul păstrează azi decizia și ce a lăsat neatins, iar comment-ul lui
spune exact asta). Nu se modifică webul pentru asta.

   în inbox, apoi `.notificationCenter`); rularea așteaptă credențialele de mediu.
4. ~~Profilul altei persoane~~ → **pas pregătit** (`profile-other`: `[data-creator-profile]` de pe cardul de
   feed, preferând dialogul cu `[data-follow]`).
5. `search-result-open` (rezultatul de căutare deschis ca postare) — corespunde §10 rând 8.
6. Persona non-Social (Work/Dating/Travel/Market): bară, ecrane, module de sine stătătoare.
7. Onboarding, devnet, `account-modal`, setările detaliate (`profile-settings-panels.js`).
8. Compozitor: CAMERA/CREATE/LIVE/DRAFTS, unelte, emoji, draft-uri, publicare (stări de eroare) →
   **pas pregătit pentru text** (`create-composer-tweet`: slotul `create` apoi `[data-source-jump="tweet"]`,
   dump pe `#composerForm`).

**Comenzi pregătite** (rulează doar cu `NEXUS_TEST_EMAIL` / `NEXUS_TEST_PASSWORD` în mediu):

```powershell
node tools/web-ref/crawl.mjs --only=messages-activity,profile-other,create-composer-tweet
```

Capturile noi vor apărea în `docs/web-ref/messages/activity-0.*`, `docs/web-ref/profile/other-0.*` și
`docs/web-ref/create/composer-tweet.*`.


**Reguli de operare învățate în acest lot (obligatorii pentru sesiunile următoare):**
- click-urile din header sunt blocate de overlay-uri ⇒ `domClick` (`el.click()`), nu click cu
  hit-testing; înainte de fiecare pas `closeOverlays()` (Escape → `goBack` → scoaterea `inert`
  de pe `#phoneNav`);
- swipe care pornește la `x < 100` declanșează gestul de back al Chrome ⇒ lansare cu
  `--disable-features=OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation`;
- orice drag trebuie să aibă ambele axe finite (`dx`/`dy` implicite 0), altfel CDP refuză parametrii;
- un pas = o interacțiune + un dump; crawl-ul se rulează în fundal (depășește 30 s per comandă).

## 13. Date de test (pentru comparații pe conținut real)

Setul este descris în **`docs/TEST-DATA.md`**: 5 conturi
(`ana_popescu`, `mihai_ionescu`, `elena_vasilescu`, `andrei_stan`, `sorina_marin`)
plus contul de autentificare `test` (Viewer), cu 9 urmăriri / 3 cupluri reciproce,
14 postări (5 fotografii, 6 Tweet-uri, 3 Reels), 6 story-uri, 6 comentarii,
5 reacții, 4 conversații (12 mesaje) și 6 notificări necitite.

- comenzi: `npm run dev:test-account` apoi `npm run dev:fixtures -- --confirm-local-db`;
- parola vine **doar** din `NEXUS_TEST_ACCOUNT_PASSWORD`; nicio parolă nu este
  scrisă în fișiere comise;
- media generată este deterministă (PNG) și trecută prin pipeline-ul real; Reels
  refolosesc un clip local validat sau primesc `--clip`;
- **consecință pentru capturi**: cu story-uri reale în cont, pasul `story-viewer`
  are acum ce deschide (`story-opened` ar trebui să fie `true`), iar firul de
  conversație și activitatea de notificări nu mai pornesc din liste goale;
- geometria și culorile se compară pe `*.dom.json`. PNG-urile din `docs/web-ref/`
  sunt un **PNG per grup de stare** (vezi §12.2) — nu sunt o dovadă de diferență.


## 14. Starea reală măsurată (runda 1 — `docs/parity-report/INDEX.md`)

Regula acestui capitol: **niciun rând nu se declară `identic` fără o măsurătoare pe telefon** (un
`diff.md` numeric produs de `tools/parity/compare.mjs` din `uiautomator dump`, plus un compozit
`web | nativ` din `tools/parity/compose.ps1`). Rândurile de mai jos au fost deschise din nou și
corectate după ce s-a citit codul nativ și s-au măsurat dovezile web existente.

| Rând | Stare înainte | Stare corectată | Dovadă |
|---|---|---|---|
| §4 Mesaje — inbox | identic structural | **diferit (2/10)**: lipsesc `.messengerTopbar`, `#message-search`, `#storyRail`, cutiile inbox; rândul de conversație diferă (avatar 48 vs 52, nume 15 vs 17, badge 20 `#ff315f` vs 24 `#68ebdf`) | `docs/web-ref/messages/inbox-0.dom.json` |
| §4 Mesaje — fir | identic structural | **de reverificat pe telefon** | `messages/thread-0.dom.json` |
| §2 Feed — story rail | lipsă | **desenat, dar pe ecranul Mesaje** (shelf-ul nu trăiește pe feed); se măsoară pe telefon | `messenger-shell.js:46`, `feed-surface.js:285` |
| §3 Profil — bara de conținut | (nu exista rând) | **era text → reparat**: cinci iconițe `≡ ▶ ▦ ❝ ✦` cu `role=tab`, plus săgeata cu cele trei citiri | `profile-experience.js:16,443-453` |
| §2 Viewer (clip) — deschidere la tap | (nu exista rând) | **diferit → reparat**: tap-ul pe clip deschide dialogul full-screen; redarea a trecut pe `[data-clip-play]` | `app.js:3216-3239`, `docs/web-ref/viewer/media-viewer.dom.json` |
| §1 Shell — `#feedModules` drawer | diferit (de verificat) | **diferit** (măsurat: prag, geometrie) | `feed/drawer-open2.dom.json` |
| §1 Shell — rail de mod `nav.feedModes` | identic | **de reverificat pe telefon** | `shell/home.html.json` |

Restul rândurilor marcate `identic` rămân **de reverificat**, în ordinea notelor din
`docs/parity-report/INDEX.md`; fiecare primește compozit + `diff.md` înainte de a-și păstra starea.

