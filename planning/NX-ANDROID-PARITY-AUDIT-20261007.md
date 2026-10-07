# Nexus Android — verificare de paritate pe ecrane la 2026-10-07

Audit de suprafață (ecrane reale vs. neportate) al clientului nativ `apps/nexus-mobile` față de
`apps/nexus-web`. Înlocuiește `NX-ANDROID-PARITY-AUDIT-20261004.md`, care descria starea veche de
shell WebView. Memoria migrării rămâne `apps/nexus-mobile/MIGRATION.md` (§8 conține același tabel).

## Metodă

- Dispozitiv: `app.nexus.mobile.dev` (Expo dev client), Android, 1220×2656 @416dpi, prin `adb`.
- Dovezi: capturi de ecran + dump-uri XML de interfață în `docs/screens/` (`w-*.png/xml`, `s-*.xml`,
  `04-profile.png`, `05-home.png`, `10-messages.*`, `11-search.*`, `12-friends.*`, `nav-home.xml`).
- Sursa de adevăr pentru rutare: `apps/nexus-mobile/src/app/index.tsx` și
  `apps/nexus-mobile/src/components/AppNav.tsx`.

## Navigație (bara de jos, 7 mark-uri)

`AppNav` randează, în ordine, `primary, inbox, search, create, friends, utility, account`, cu
etichetele `Acasă, Mesaje, Găsește oameni și conținut, Creează, Prieteni, Live, Profil`
(`AppNav.tsx:24,112-120`). `index.tsx` le leagă astfel:

| Mark | Ecran randat | Verdict | Dovadă |
| - | - | - | - |
| `primary` (Acasă) | `FeedHeader` + `FeedScreen` — Reels imersiv (`ReelsReader`) sau listă de carduri (`PostCard`), cu acțiuni reale | **real** | `05-home.png`, `02-feed-live.png`, `03-feed-immersive.png`; `FeedScreen.tsx:118-134` |
| `inbox` (Mesaje) | `PendingScreen("Mesaje", "Conversațiile nu sunt încă portate în aplicația Android…")` | **placeholder onest** | `index.tsx:183`; `10-messages.xml` |
| `search` (Găsește oameni și conținut) | `PendingScreen("Găsește oameni și conținut", "Căutarea nu este încă portată…")` | **placeholder onest** | `index.tsx:186`; `s-search.xml` |
| `create` (Creează) | `router.push('/camera')` — camera nativă | **real** | `index.tsx:211`; `w-create.png` |
| `friends` (Prieteni) | `PendingScreen("Prieteni", "Relațiile (urmăritori, cereri, blocări) nu sunt încă portate…")` | **placeholder onest** | `index.tsx:184`; `s-friends.xml` |
| `utility` (Live) | `PendingScreen("Live", "Transmisiunile live nu sunt încă portate…")` | **placeholder onest** | `index.tsx:185`; `w-live.xml` |
| `account` (Profil) | `ProfileScreen` — profil real (`GET /api/profiles/:handle?persona=social`) | **real** | `index.tsx:182`; `w-profile.png`, `04-profile.png` |

Plus cazul de modul non-`social`: `PendingScreen(moduleTitle, "Acest modul nu este încă portat…")`
(`index.tsx:187`).

## Ce s-a confirmat pe fiecare ecran real

- **Acasă / Feed** — `FeedScreen` citește `GET /api/social/feed` cu contractele web
  (`reels→clips`, `whispers→tweets/for-you`, `news→posts/breaking`), cu skeleton, paginare pe cursor,
  pull-to-refresh, bară de eroare cu „Reîncearcă" și notice-ul providerului pentru Știri. Pentru
  „Reels" randează `ReelsReader` (un reel pe viewport, doar cel vizibil se redă); altfel `PostCard`.
  Ambele au acțiuni reale: reacție (`/api/posts/:id/reaction`), salvare, repost, distribuire
  (`PostCard` + `lib/postInteractions`), plus firul de comentarii (`CommentsSheet`,
  `GET/POST /api/posts/:id/comments`, reacție la comentariu `POST /api/comments/:id/reaction`).
  `05-home.png` arăta o postare reală de video (cadrul camerei din `04-profile.png`), **nu** un ecran de
  captură — etichetarea anterioară „camera preview" era greșită.
- **Creează** — `+` deschide camera nativă (`/camera`): 9:16 / 0,7× pe obiectivul virtual, 3:4 la 1×,
  import galerie, permisiuni; captura se întoarce în composer (`CaptureEditor` → `PublishPanel`).
  Verificarea end-to-end pe dispozitiv rămâne deschisă (vezi riscuri).
- **Profil** — `w-profile.png` / `04-profile.png` arată copertă, avatar 78px, identitate
  (`@test` · Kraków), banda ticker, taburi (Flux/Reels/Fotografii/Șoapte/Momente) și un card de postare
  real cu reacții/comentarii/salvare/repost/distribuire.

## Capturi eliminate (altă aplicație / system UI)

Identificate prin amprentă de tip/pachet (fără a deschide conținutul) și **șterse**:

- `w-search2.*`, `w-friends2.*`, `12-friends.*`, `00-current*.png` — `com.android.systemui` (bara de
  notificări); png-ul de 18.848 B (hash `04F5D544…`) este imaginea barei.
- `11-search.*` — `com.miui.securitycenter` (altă aplicație).
- `ui-profile.xml` — `com.android.chrome` (browser; era referință web, nu UI de aplicație).
- `cap-d5.png`, `now-sub.png` — 904×572 (nu este ecran de telefon), proveniență neclară.

Neconcludent, păstrat: `w-create.xml` (18.494 B) — cadru de cameră fără antet de text.

## Etichetare

Unele dump-uri capturate erau duplicate sau etichetate greșit (`s-search.xml` = `10-messages.xml` =
`n1.xml`; `w-live.xml` = `w-profile.xml`). Sursa primară de adevăr pentru rutare rămâne codul
(`src/app/index.tsx`).

## Verdict

- **Paritate de suprafață:** 3 mark-uri reale (Acasă, Creează, Profil) + interacțiunile din feed;
  4 ecrane marcate onest ca neportate (Mesaje, Căutare, Prieteni, Live). Niciun ecran nu imită
  funcționalitate inexistentă.
- **Nu este paritate funcțională completă:** lipsesc mesageria, căutarea, relațiile (urmăritori/cereri/
  blocări), transmisiunile live, notificările, setările și SSE-ul în timp real.

## Riscuri / de verificat în continuare

1. Testul end-to-end pe dispozitiv pentru camera→editor→publicare (draft după repornire + o publicare
   reală), condiționat de deploy-ul pe `main` al reparației de email auth.
2. Set-Cookie pe Android (sesiunea pe cookie jar nativ) la login + repornire la rece.
3. Fără modificări de date de producție și fără deploy în acest audit.
