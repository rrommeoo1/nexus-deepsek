# Nexus UI & Interaction Blueprint

Status: normative UX map for the visual product. This document defines what every
visible control must do before a screen may be presented as complete. It does not
claim that every planned integration is already production-ready.

## Product rules

1. The phone shell has one global create control: the centered `+` in the bottom
   navigation. It opens the mode-aware Create Hub.
2. The `NEXUS` wordmark always returns to the active profile's primary screen. In
   Social that means the clip-first feed.
3. Messages are the second destination in every mode and aggregate all modes. The
   inbox can be filtered by Social, Work, Dating, Travel and Market.
4. The avatar opens Profile & Settings. Signing out is a deliberate action inside
   Security, never a tap on the avatar.
5. Every mode owns its avatar, display name, bio, audience, relationship graph,
   message policy and recommendation preferences. The wallet and Nexus username
   belong to the account, not to a mode.
6. Free social engagement is off-chain. Blockchain is used for custody, voluntary
   payments, escrow, portable proofs and integrity commitments where it adds value.
7. Every networked screen needs loading, empty, error, offline, permission-denied
   and retry states. No button may be decorative in a release build.

## Global shell

| Control | Destination/action | Required states |
|---|---|---|
| NEXUS wordmark | Active mode home; Social -> clip-first feed | pressed, focus, offline-safe |
| Mode badge | The only profile switcher; compact overlay | current mode, profile identities, incognito marker |
| Social top rail | `Mix`, `Prieteni`, `Descoperă`, `Caută` | active context, accessible labels, loading/error/empty |
| Search | Social top-rail search over server-filtered visible profiles and posts | query validation, results, no results, privacy-safe error |
| Avatar | Profile & Settings | avatar/fallback, account warning |
| Home | Active mode primary screen | active/inactive |
| Messages | Unified inbox and the only persistent notification badge | red unread state, count, filtered source mode |
| `+` | Mode-aware Create Hub | camera/gallery permission and draft count |
| Utility | Social Live / Work Jobs / Dating Connections / Travel Trips / Market Orders | mode specific |
| Profile | Active-mode profile, wallet and settings | isolated profile data and account controls |

## Social screen graph

```text
NEXUS/Home
  -> Clip-first Feed
     -> Mix | Prieteni | Descoperă | Caută
     -> Descoperă -> Near | Global | Breaking
     -> Feed format -> Mix | Clips | Postări
     -> Story rail -> Story viewer -> reply/react/share
     -> Clip card -> react/comment/reply/share/save/download/support/follow/report
     -> Creator profile -> clips/posts/about/follow/message
  -> Messages
  -> Create Hub
     -> Camera -> Photo capture | Video record -> Editor
     -> Gallery -> Photo | Video -> Editor
     -> Story -> Camera/Gallery/Text -> Editor
     -> Text post -> Composer
     -> Drafts -> Edit | Duplicate | Delete | Publish
     -> Live -> readiness gate -> live room
  -> Live -> Acum | Urmărești | Battle | Campionate
  -> Profile & Settings
```

### Create Hub and editor

| Screen/control | Behaviour | Current delivery state |
|---|---|---|
| Camera | Requests camera/microphone only when selected; captures photo or records a clip | implementation target |
| Gallery | Opens device media picker for JPEG/PNG/WebP/MP4/WebM | implementation target |
| Story | Creates an expiring or user-persistent story | implemented, UX integration target |
| Text post | Opens caption-first composer without requiring media | implemented, UX integration target |
| Drafts | Browser-local IndexedDB drafts scoped to account/profile | implementation target |
| Live | Saves a private preview and exposes the capability gate; it cannot pretend a real ingest/SFU exists | implemented/gated |
| Crop/aspect | original, 9:16, 1:1, 4:5, 16:9 | implemented manifest |
| Filters | vivid, warm, cool, mono, contrast with intensity | implemented manifest |
| Video trim/speed/mute | local non-destructive edit manifest | implemented manifest |
| Text overlay | content, position and colour | implemented manifest |
| Audio | own/licensed file plus mandatory rights declaration | implemented manifest |
| Upload status | read, verify, upload, moderate, publish, complete | implementation target |
| Save draft | saves composition and local media blob; never wallet keys | implementation target |

### Clip-first feed contract

- On Social Home, request clips first. If clips exist, the first visible content is
  a video card and the stream uses vertical scroll snapping one card at a time.
- On phone, the clip stage owns the complete feed lane below Stories and the format
  tabs. Author, caption, Trust Lens, ranking reason and primary actions render as
  legible overlays; they must not stack as separate cards that push media below
  the fold. Secondary safety actions open from the labelled overflow control.
- Posts remain a dedicated format and may appear after the clip lane in `All`.
- Autoplay is muted and only for the intersecting card; user intent enables sound.
- A tap on the clip toggles play/pause, while the right-side action rail exposes
  reactions, comments, optional support, share, save and sound as labelled touch
  targets. The reaction palette opens on demand instead of covering the video.
- Ranking must give new content bounded exploration without buying organic reach.
- Paid promotion is labelled and ranked in a separate constrained auction.
- Feed controls and trust labels must not cover the primary video action area.
- Optional support is a separate wallet-confirmed intent and has zero organic
  ranking weight. The local zero-funds demo shows the proposed 90/5/3/2 split
  (creator/platform/safety/infrastructure) but never simulates a completed payment.

## Messages screen graph

```text
Unified Inbox
  -> All | Social | Work | Dating | Travel | Market
  -> Inbox | Requests | Archived
  -> 1:1 thread | Group thread | Meeting thread
     -> text | reply | reaction | edit-window | immutable audit event
     -> attachment picker | camera | voice note | location/contact (consent)
     -> audio call | video call | share screen | scheduled meeting
     -> disappearing message | block | report | safety controls
     -> delivery/read receipts and E2EE device status
```

The current local demo has persistent threads, groups, attachments, disappearing
messages, device E2EE for supported text and local WebRTC capability. Production
calls require TURN/SFU, abuse controls and independent security review.

## Profile & Settings graph

```text
Profile
  -> Public preview -> posts/clips/stories/saved/private collections
  -> Edit active mode -> avatar/name/bio/links/audience/message policy
  -> Relationships -> followers/following/friends/blocked per mode
  -> Account identity -> Nexus username/MultiversX address/herotag
  -> Wallet -> positive balances/top-up/transactions/security
  -> Settings
     -> Privacy by mode
     -> Notifications by mode
     -> Language/content languages/region and Near consent
     -> Accessibility/data saver/autoplay/downloads
     -> Safety/moderation/appeals/blocked accounts
     -> Devices/sessions/recovery/export/delete account/sign out
```

Seed phrases and private keys are never sent to or displayed from the Nexus server.
The device wallet may expose a guarded local recovery flow only after reauthentication.

### Social Live contract

- `Live` is the fourth persistent Social destination in the bottom dock; the
  centred `+` remains an action and is not counted as a destination.
- `Acum` ranks only verified active broadcasts by unique concurrent organic
  viewers seen in the last 45 seconds, then by qualified organic followers.
  `Urmărești` applies the same policy after filtering to followed creators.
- Viewer and follower counts exclude `SYSTEM_TEST`, paid, incentivized and known
  synthetic traffic. A payment, gift, Sigil or promotion never buys organic rank.
- A creator may configure a private local preview. Public broadcasting remains
  fail-closed until production HTTPS, SFU/TURN where needed, live moderation,
  heartbeat integrity and abuse controls are configured and reviewed.
- `Battle` is the two-creator format; `Campionate` supports groups or brackets.
  Drafts are private. Public scheduling requires eligible participants, published
  rules and moderation. Paid votes never enter the organic score.
- No prize is advertised or owed until its asset, terms, eligibility, jurisdiction
  and escrow are explicitly configured. A draft with
  `NO_PRIZE_CONFIGURED` is visibly labelled as such.

### Nexus Sigil și Orbit

Colțul din dreapta al headerului rămâne liber dacă profilul nu a câștigat nimic.
`Nexus Sigil` apare automat numai după atingerea unui prag: `Creator` la 1.000,
`Rising` la 10.000, `Pro` la 100.000, `Icon` la 1.000.000 și `Global` la
10.000.000 followers eligibili. Creatorii primesc `★`, iar paginile Business
verificate primesc `$`. Același simbol nu este disponibil manual utilizatorilor
obișnuiți, pentru ca semnificația lui să rămână clară.

În calcul intră numai followers unici `HUMAN_ORGANIC` ai profilului/modului
respectiv. Actorii `SYSTEM_TEST`, boții, conturile paid și interacțiunile
incentivized sunt excluse. În producție, activarea mai cere fraud graph, vechime,
semnale de blocare și audit independent; demo-ul local declară explicit că aceste
gates nu sunt încă operaționale. Sigil nu poate fi cumpărat și nu oferă boost în
ranking. Verificarea Business este un gate separat și nu poate fi auto-declarată
din editorul profilului.

Expresia personală este separată în `Orbit`, un status temporar, opțional și fără
efect asupra rankingului. Orbit poate include mood, oraș/loc ales manual, echipă
sau fandom, ce urmărește/ascultă utilizatorul și un gând, proverb ori zicală.
Utilizatorul alege expirarea între o oră și șapte zile și poate curăța statusul
oricând. Nexus nu deduce automat aceste câmpuri din GPS, IP, gen, vârstă,
orientare sau comportament. Numele de cluburi, filme și artiști sunt text liber,
nu badge-uri oficiale/licențiate.

## Mode-aware primary navigation

| Mode | Primary | Second | Create Hub entries | Utility | Fifth |
|---|---|---|---|---|---|
| Social | Feed (clips/posts) | Messages | camera, gallery, story, post, draft, live | Live | Profile |
| Work | Professional feed | Messages | post, clip, job, article, event, draft | Jobs | Profile |
| Dating | Discover | Messages | moment, profile media, date plan | Connections | Profile |
| Travel | Explore | Messages | stay, experience, trip story | Trips | Profile |
| Market | Browse | Messages | product listing, service listing, draft | Orders | Profile |

Mode switching is not duplicated inside Profile or in bottom navigation. It is
available only from the prismatic mode badge beside the wordmark in the header.
The badge is labelled `Nexus Social`, `Nexus Work` etc. and combines the active
mode with its avatar so the current identity remains visible without adding
another permanent navigation control.

The bottom navigation is the `Nexus Dock`: four persistent destinations with a
raised central Create action. In Social these are `Acasă`, `Mesaje`, `Live` and
`Profil`; Messages alone carries the persistent unread badge. Social search is a
real top-rail context, not a duplicated bottom control. There is no permanent
Notifications icon.

Every Dock destination has a thumb-safe icon target of at least 42 CSS pixels in
the phone shell; the central Create target is larger. The browser phone layout
does not draw a second fake device notch/status bar. The `NEXUS` wordmark is an
explicit Home control and resets Social to `Mix`, clip-first format and the first
feed page from every destination.

### Media picker return contract

- Camera and gallery cancellation must return to the active mode's normal feed;
  an empty composer must never remain as a dead-end screen.
- The composer always exposes a labelled back control that stops any active camera
  stream before returning home.
- Because mobile browsers do not emit the file-input `cancel` event consistently,
  the client also detects focus/visibility return and closes only when no file was
  selected. A real selection keeps the composer open for preview and editing.
- Draft recovery is explicit; cancelling a fresh native picker does not create a
  draft or upload any bytes.

## Release evidence gate

A page is `COMPLETE` only when its route and all visible controls have deterministic
tests, permission and failure states, responsive keyboard/screen-reader behaviour,
privacy review, abuse cases, analytics consent rules and browser/device QA evidence.
Otherwise it is labelled `PARTIAL`, `PLANNED` or `GATED` in project evidence.
