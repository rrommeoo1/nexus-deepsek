# Checkpoint — NX-WEB-SOCIAL-P01

## Identity

- Task: `NX-WEB-SOCIAL-P01` — complete the Social full-stack vertical.
- Parent: `NX-WEB-FOCUS-001`.
- Status: `in_progress`.
- Risk: `T1`, with T0 sub-controls for privacy, authentication and media safety.
- Started after independent Auth PASS (`ed6fc9de…`, review receipt `697c1130…`).
- WIP: this is the only active packet; every non-Social vertical remains deferred.
- Runtime: local LAN demo, `0.0.0.0:3000`, real funds/provider spend `0`.

## Product contract

1. Social opens on a media-first Pulse with `Near`, `For You`, `Global` and
   `Breaking`; Breaking is truthful and disabled until a configured provenance
   adapter exists.
2. Creation supports text, photo and short video with local content-addressed
   storage, processing/provenance state and no fake on-chain confirmation.
3. Engagement supports expressive reactions, private dislike, comments and
   replies, reactions on comments, follow, save, share and optional support. Free
   engagement never requires a blockchain transaction; optional value transfer is
   separately signed and remains disabled for real funds in this demo.
4. Stories have an owner-selected expiry or persistent-until-archived lifecycle.
5. Profile data, avatar, privacy, friends/follows, blocks and audience are isolated
   per persona and enforced server-side.
6. Unified Messages resolves Nexus usernames and supports 1:1/group threads,
   attachments, delivery/read state and Social/Work/Dating/Travel/Market filters.
   Text E2EE is opt-in only after exact device-key/ciphertext evidence exists;
   unsupported transports and attachments remain explicitly labelled.
7. Audio/video calls and meetings begin as explicit local capability-gated rooms;
   provider-backed claims remain unavailable until configured and verified.
8. Locale is an account/device choice. IP may be used only as a consented coarse
   Near/news hint, never as inferred nationality.
9. All user content and controls remain functional after restart; `SYSTEM_TEST`
   actors cannot affect organic ranking, reputation, payouts or adoption metrics.
10. Social nu este acceptat ca final prin simplă paritate vizuală. Fiecare control
    trebuie să fie end-to-end sau disabled onest, journeys-urile esențiale sunt
    benchmark-uite față de Instagram/TikTok, iar diferențiatorii blockchain trebuie
    să demonstreze proprietate, plată, dovadă ori transparență fără fricțiune de gas.

## First implementation slice

- Expand SQLite migrations without dropping current local data.
- Add immutable content lifecycle metadata, profile-isolated visibility and
  engagement primitives with exact server authorization.
- Replace recipient-ID message forms with username-addressed persistent threads.
- Add deterministic repository/API tests before wiring the upgraded visual UI.

## Progress — 2026-08-23

- Pulse now has server-enforced `For You`, `Near`, `Global` and truthfully disabled
  `Breaking` lenses, format filters, real stories, text/photo/video creation,
  expressive reactions, private dislike, comments/replies, saves and shares.
- Posts and stories use local content-addressed media. Post withdrawal preserves a
  thread/commitment tombstone instead of silently deleting history.
- The active persona can now edit its own avatar, display name, bio, visibility,
  message policy, interface locale, preferred content languages, region and Near
  consent without changing another persona.
- Unified Messages now uses Nexus usernames upstream, not numeric recipient IDs.
  It persists direct and group conversations, persona context, unread/read heads,
  idempotent client nonces, image/video/PDF/Office attachments and scheduled
  meetings. A local camera/microphone preview is functional; remote WebRTC and
  E2EE remain explicitly labelled unavailable rather than simulated.
- Message privacy now includes separate Inbox/Requests/Sent views, one-message
  throttling before a direct request is accepted, explicit group invitations,
  owner/admin membership controls, delivered/read receipts, expiring typing and
  presence, and owner-selected 1 minute/1 hour/24 hour/7 day message expiry.
  Expiry preserves a tombstone while clearing message body and attachment link.
- New group members cannot read pre-acceptance history: a durable message-head
  boundary is captured when the invitation is accepted. Pending invitations do
  not create delivery/read receipts for inaccessible history.
- Legacy numeric-recipient HTTP endpoints are retired with `410`, preventing a
  bypass around username resolution, blocks and per-persona message policy.
- Nexus E2EE v1 is now wired end-to-end for text messages in secure browser
  contexts. A non-extractable P-256 device private key is kept in IndexedDB;
  the server accepts only the public JWK and persists one AES-256-GCM envelope
  per exact active device. The signed-data binding covers conversation, nonce,
  sender device, recipient device and current device-set commitment.
- Sending is fail-closed on missing devices, stale device sets, duplicate
  coverage, revoked devices, invalid nonces or binding changes. The encrypted
  endpoint rejects plaintext bodies and attachments. Fetch returns only the
  caller-owned active device envelope; expired envelopes are removed before the
  durable message tombstone is written.
- The UI offers an explicit `Criptează textul pe dispozitive` control, decrypts
  locally, never renders ciphertext as content and labels failures without
  exposing cryptographic detail. On the phone LAN URL over plain HTTP, Web
  Crypto is truthfully disabled because a secure browser context requires
  HTTPS/localhost; plaintext local transport remains available and labelled.
- Legacy local messages are migrated into the new direct-conversation model on
  database open. New tables and indexes are additive; aggregate runtime migration
  confirmed the device/envelope/message schemas and SQLite integrity `ok`.
- Verification: `65/65` Node tests PASS, including browser-crypto round-trip and
  binding-tamper rejection; syntax checks PASS for DB/repository/API/UI/crypto;
  listener PID `18804` on `0.0.0.0:3000`; localhost health, LAN root and the
  crypto asset return `200`. Browser loaded `social04` with zero console errors
  or warnings. Reusable evidence is in
  `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-v1.json`.
- Direct one-to-one audio/video calls now have a real local WebRTC path. Call
  invitations and lifecycle state are durable, while SDP/ICE signaling is
  authenticated, nonce-bound, relayed through Nexus SSE/HTTP and never written to
  SQLite. One user cannot ring or join two calls across different conversations.
- The caller/callee state machine covers accept, decline, end, missed, expiry,
  concurrent busy state and restart failure. Browser controls include microphone,
  camera and hang-up, with accessible incoming/active call dialogs. Meetings remain
  scheduled group records; group media calls are truthfully labelled as requiring
  a future SFU.
- Local calls intentionally use `RTCPeerConnection({ iceServers: [] })`: there is
  no hidden STUN/TURN/provider dependency or cost. They work only where direct
  host candidates and a secure browser context are available. The LAN phone URL
  over HTTP therefore disables camera/microphone calls until HTTPS is configured.
- Current verification: `67/67` Node tests PASS; syntax checks PASS; SQLite
  integrity is `ok`, `conversation_calls` is additive and no `call_signals` table
  exists. Listener PID `5960` is on `0.0.0.0:3000`; loopback/LAN root and the call
  client asset return `200`; browser loaded `social05` with zero console errors.
  Reusable evidence is in
  `planning/evidence/NX-WEB-SOCIAL-P01-webrtc-local.json`.
- Local media admission is now fail-closed. JPEG/PNG/WebP/MP4/WebM bytes must
  match their declared MIME signature; content-address integrity is checked on
  read. PDF and Office documents stay in a separate quarantine state because no
  malware scanner is configured, and the UI says so instead of claiming a scan.
- Every upload now creates an exact user/purpose grant (`social_post`, `story`,
  `profile_avatar` or `message_attachment`). A message attachment is readable by
  its uploader and conversation members with history access, but returns `404`
  to unrelated accounts; quarantined content returns `423` and cannot be sent.
- The seven pre-existing local media rows were reclassified from stored bytes:
  all seven passed SHA-256 plus signature checks, with six post grants and one
  story grant reconstructed. SQLite integrity remains `ok`.
- Current verification is `69/69` Node tests PASS. Listener PID `5708` is on
  `0.0.0.0:3000`, loopback and LAN return `200`, and the browser loaded
  `social06` with zero console errors. Reusable evidence is in
  `planning/evidence/NX-WEB-SOCIAL-P01-media-quarantine-v1.json`.
- Social ranking local v1 is deterministic and profile-scoped. It combines
  recency, unique organic engagement, follows, post-reset affinity, preferred
  languages, consented region and bounded viewer impressions. It never consumes
  Dating signals, wallet value, special-category targeting or precise location.
- When eligible inventory exists, 10% of For You/Near/Global slots are reserved
  for unseen content and the selector caps an author at two results before an
  explicit insufficient-inventory fallback. UI shows general reasons, supports
  private `Nu mă interesează` and resets recommendations without deleting likes.
- Dislikes stay private and one-per-profile. Ranking uses unique HUMAN_ORGANIC
  actors, a five-signal threshold, Bayesian smoothing and a capped penalty, so a
  coordinated negative wave can influence but cannot independently erase a post.
  `Fake?` remains community opinion, never a factual verdict.
- `PAID`, `AGENT`, `SYSTEM_TEST` and `INCENTIVIZED` authors/interactions are
  excluded from organic ranking. The 50-actor deterministic harness confirmed
  all actors are `SYSTEM_TEST` and organic feed output is exactly zero.
- Current verification is `70/70` Node tests PASS; reaction insertion order and
  repeated rankings produce identical results. Listener PID `5300` serves
  `social07` on LAN with zero browser console errors. Reusable evidence is in
  `planning/evidence/NX-WEB-SOCIAL-P01-ranking-v1.json`.
- Trust Lens local v1 now separates author-declared provenance, automated context
  signals and factual verification. It never emits a truth percentage: ordinary
  content remains `NOT_FACT_CHECKED`, AI provenance is explicitly a declaration,
  and photo/video safety is labelled `NOT_ANALYZED_BY_LOCAL_DEMO` until a real
  visual classifier is configured and certified.
- Narrow deterministic rules stop explicit wallet-secret solicitation, direct
  violent threats and explicit illegal-drug sale text before publication. News,
  health, finance and political patterns receive context labels without takedown;
  political viewpoint is not an input. `Fake?` remains a community opinion and
  does not mutate the automated assessment.
- Reports use an exact category taxonomy and are idempotent per account, subject
  and category across every profile. Only real Social posts/comments are valid
  report targets. One report never removes content. `SYSTEM_TEST` reports are
  durably marked as excluded from enforcement. Authors can dispute a context
  label; the dispute is visible and does not silently rewrite content/history.
- Assessment, report and appeal actions append to a local SHA-256-linked audit
  log. The verifier proves internal link consistency and detects unrecomputed
  edits/reordering, but explicitly cannot prove completeness against full deletion
  or wholesale recomputation without an external trusted checkpoint. It is local
  off-chain storage, not an immutable/on-chain production vault.
- Browser QA found and fixed a legacy migration defect: identical unbound
  assessment hashes caused later legacy posts to lack a Trust record. Assessment
  hashes are now bound to subject ID, content commitment and policy version, and
  missing legacy post/comment commitments are backfilled deterministically.
- The T1 review initially found five bounded gaps. Remediation now normalizes
  punctuation/zero-width obfuscation without blocking obvious educational or
  quoted safety text, recomputes each assessment from the canonical post/comment,
  deduplicates reports account-wide, exposes the audit limitation truthfully and
  adds keyboard-bounded author-aware dialogs plus prepublication reconsideration.
- The final safety pass removes context-keyword injection: an unrelated
  `quote/condemn` token, a contradictory wallet-secret warning/solicitation and
  common illegal-sale modifiers remain blocked. Benign context is accepted only
  in tightly bounded warning/quotation forms. Reconsideration can assess a revised
  draft, but never treats the explanation itself as a bypass and never publishes
  automatically; the user must explicitly resubmit the revised draft.
- Illegal-sale detection now uses Unicode-safe token boundaries and a bounded
  sale-clause window rather than an exhaustive adjective list. Unlisted modifiers
  and Romanian trailing diacritics are covered, while a tightly structured
  educational book/article/course statement remains context rather than takedown.
- Current verification is `73/73` Node tests PASS plus 50-actor isolation PASS;
  SQLite integrity is `ok`, while the audit result is explicitly only internal
  link consistency. Listener PID `4956` serves `social12` on `0.0.0.0:3000`;
  loopback and LAN return `200`. Browser QA confirmed Trust Lens, author-only
  appeal visibility, Escape close and the fail-closed reconsideration journey.
  Reusable evidence is in
  `planning/evidence/NX-WEB-SOCIAL-P01-trust-lens-v1.json`.
- Independent T1 review FINAL04 is `PASS`: 9/9 artifact binding, `73/73`
  tests, all `TL-T1-001..005` closed and zero external/provider/economic
  effects. Receipt:
  `planning/evidence/reviews/NX-WEB-SOCIAL-P01-TRUST-LENS-C02-C04-C06-C10.yaml`.
- The Social client now opens on an immersive clip-first lane with one-card
  vertical snapping, intersection-bound muted autoplay, tap/keyboard play-pause,
  an explicit sound control and a compact action rail for reactions, comments,
  support, share and save. Reaction choices stay hidden until requested and are
  fully labelled for assistive technology.
- Optional support is separated from free engagement and organic ranking. The
  local sheet explains the proposed 90/5/3/2 creator/platform/safety/infrastructure
  allocation, requires a future separate wallet confirmation and routes to wallet
  setup without pretending that a zero-funds demo executed payment.
- Browser QA on `social27` passed action-rail discovery, sound toggle,
  play/pause, support amount selection, modal close, wallet-gate routing and Nexus
  Home return. Source parsing and deterministic contract checks pass; the full
  Node suite remains an open gate in the current sandbox because execution of the
  installed external runtime is denied.
- The active-mode identity is now concentrated in the header: the prismatic mode
  switch includes the profile avatar, while the duplicate mode/Sigil editors were
  removed from Profile. A Sigil is not rendered at all before it is earned; after
  an automatic organic-follower threshold it renders beside eligible usernames.
  Profile media opens in a full-viewport viewer with keyboard, horizontal and
  vertical swipe navigation.
- The Create flow now has a deterministic escape path. Its labelled back control
  stops camera capture and returns to Social Clips; native file-picker `cancel`
  also returns home. A focus/visibility fallback covers mobile browsers that omit
  `cancel`, while waiting 450 ms for a real selection before closing. Browser QA
  on `social29` confirmed the composer is removed and the Clips feed restored.
  Syntax parsing and six focused assertions pass; the full Node suite remains an
  open execution gate in this sandbox.
- Social now has four compact top contexts: `Mix`, `Prieteni`, `Descoperă` and
  `Caută`. The bottom dock has exactly four destinations—`Acasă`, `Mesaje`, `Live`
  and `Profil`—plus the raised central Create action. Search is server-filtered by
  profile privacy and blocks, and excludes `SYSTEM_TEST` identities.
- The Live destination implements `Acum`, `Urmărești`, `Battle` and `Campionate`.
  Discovery orders only `VERIFIED_ACTIVE` sessions by unique active
  `HUMAN_ORGANIC` viewers in a 45-second window, then qualified followers.
  Preview creation stays private and `GATED_NO_SFU`; it cannot overwrite a
  scheduled or active emission. Battle/Campionate creation saves private drafts
  with organic scoring, no paid votes and `NO_PRIZE_CONFIGURED` until moderation,
  jurisdiction and escrow gates are satisfied.
- Focused in-memory repository verification passes: one organic and one synthetic
  attendee produce an organic viewer count of one; the synthetic creator is absent
  from Search; private preview and competition draft states are correct; SQLite
  integrity is `ok`. Browser DOM QA on `social31` confirms four top contexts, the
  five-control dock (four destinations plus Create), zero unearned Sigils, Live
  tabs and truthful fallback behaviour with no console warnings/errors. The
  already-running PID still has the previous backend modules loaded, so the new
  Search/Live API and additive schema require a safe backend restart before they
  return dynamic data on the phone demo.
- The phone shell now treats the `NEXUS` wordmark as an explicit labelled Home
  control. Browser journey QA opened Profile from the Dock, activated the logo and
  proved restoration of Social Clips, `Mix` and the active Home destination.
  The Dock uses 42 px destination icons and a 58 px central Create target in the
  CSS phone coordinate system; the fake device island is hidden on real mobile.
- Clip-first rendering was restructured instead of merely enlarged. Author,
  follow, caption, Trust Lens and ranking context now sit in a bounded overlay on
  a full-height clip stage. Reactions, comments, support, share, save and sound
  remain in the reachable action rail; report and not-interested remain reachable
  through the labelled overflow menu. On the `social33` QA phone shell, the clip
  stage is 411.9 px of the 534.3 px content viewport (77.1%) and exactly matches
  the clip card height. The stale Devnet ribbon/funds strip visible in the owner
  screenshot is absent from current DOM and source.
- Social header now uses three compact prismatic controls in one row: Nexus mode,
  feed source and friends. The old separate Social top nav is no longer rendered.
  Feed source includes `For You`, `Local Trends`, `Global Trends`, `Friends`,
  `Following`, `Private Content` and `Breaking`. Friends opens `Followers`,
  `Following` and `Favorite`; favorite stars are demo-local until cross-device
  private graph sync is implemented.
- Feed media now opens a full-screen Nexus viewer from photo/card controls. The
  viewer supports arrows, swipe left/right/up/down, reaction tray, comments panel,
  save, share, support and report. Opening media records a local Social
  impression; explicit reactions remain separate actions and no blockchain or
  payment action is triggered by passive viewing.
- Private profile access is now modeled in persona settings and the Social feed
  switcher. Owners can enable a private profile paywall with price, currency and
  duration, defaulting to 15 USD for 30 days. Product rule captured in code/UI:
  90% to creator, 10% to Nexus, while the owner does not receive the visitor's
  identity. Real settlement, privacy-preserving receipts, xMoney/Nexus Pay and
  escrow remain a later bounded packet; this slice performs no payment.
- Private access economy was updated from fixed bundle to owner-chosen price per
  day, with a minimum of 1 USD or stablecoin equivalent. The visitor chooses the
  number of days, and the quote computes `price_per_day * days`; example:
  1 USD/day for 15 days means 15 USD. `Private Content` now has a subscribed
  content section backed by local private access receipts. Curiosity reveal is
  modeled as `VISITOR_REVEAL_RECIPROCAL`: it costs 2x and grants reciprocal
  access rather than unilateral visitor exposure. Demo receipts stay
  `demo_unpaid` and do not represent settlement or a real payment.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-header-feed-private-viewer-v1.json`.
  Browser QA on `social34` confirmed `/app.js?v=20260824-social34`, exactly three
  header switchers, no old top nav, `Private Content` opens its screen, friends
  tabs render, and the full-screen media viewer exposes action rail plus reaction
  tray. SourceTextModule syntax checks passed for `app.js`, `api.js`, `repo.js`
  and `db.js`. Direct `node --test` was not available because `node.exe` was not
  present in the PowerShell PATH for this session.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-private-access-economy-v2.json`.
  SourceTextModule syntax checks passed for `app.js`, `api.js`, `repo.js` and
  `db.js`. Browser smoke QA confirmed the Private feed opens, shows subscribed
  content area, per-day copy and minimum 1 USD/equivalent copy.
- Private Content demo unlock is now testable even when the user has no
  following graph yet. The UI injects three clearly demo paywalled candidates,
  applies the platform minimum `Math.max(100 cents, owner_price)` and keeps
  owner-selected prices above the floor. Static assets are cache-busted to
  `20260825-social35`. Browser smoke confirmed `Private Content` opens, shows
  3 unlockable profiles, opens the unlock sheet and quotes 15 days at
  1 USD/day as 15 USD with 13.50 USD creator share and 1.50 USD Nexus share.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-private-content-demo-unlock-v1.json`.
  Direct `npm test` was not available because `npm` was not present in the
  PowerShell PATH for this session; static runtime checks and browser smoke
  passed.
- Social feed switcher now has a final `Tweets` source for an X-like text-only
  feed. The UI maps it to `socialTopView=tweets` and `socialFormat=tweets`;
  `/api/social/feed` accepts the format and the repository filters it to
  text-only posts without attached media. The redundant sub-tabs under Stories
  (`Mix`, `Clips`, `Postări`) are no longer rendered by `renderPulse`; CSS also
  hides the legacy surface and expands the content area so posts begin directly
  after Stories.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-feed-tweets-content-space-v1.json`.
  Static runtime audit passed, `app.js`, `api.js` and `repo.js` parsed as
  modules, and browser smoke on `social36` confirmed `Tweets`, zero
  `data-format` buttons, no visible `feedTabs`, Stories present and an expanded
  `pulsePosts` height.
- Create Hub was refined around direct, user-obvious actions: `Deschide camera`
  routes to camera/capture composer, `Alege din galerie` opens the native
  image/video picker, `Story` opens the story composer with media picker and
  duration controls, and `Tweet / postare` makes the text/X-like path explicit.
  The browser smoke did not click native camera/gallery dialogs to avoid OS
  permission blocking, but confirmed all action buttons render in the live demo.
  Static assets are now cache-busted to `20260825-social37`.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-create-hub-direct-actions-v1.json`.
  Static runtime audit passed, `app.js`, `api.js` and `repo.js` parsed as
  modules, and browser smoke on `social37` confirmed `Tweets`, no visible
  `feedTabs`, zero `data-format` buttons, Stories present, expanded content
  space and the updated Create Hub copy.
- Composer was upgraded to a premium, source-aware creation flow. Create Hub now
  passes `camera`, `gallery`, `clip`, `story` or `tweet` source metadata into
  `openComposer`. `Tweet / postare` opens a text-first composer with `Tweet
  Nexus` guidance, 500-character cap and live counter. Media/story/clip entries
  remain media-first. A new `composerIntent` rail (`Tweet`, `Media`, `Story`)
  replaces the old duplicated `createKinds` toggle. Static assets are
  cache-busted to `20260825-social38`.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-premium-composer-v1.json`.
  Static runtime audit passed, `app.js`, `api.js` and `repo.js` parsed as
  modules, and browser smoke on `social38` confirmed composer source `tweet`,
  intent rail, placeholder `Scrie un tweet Nexus…`, textarea maxlength `500`,
  counter `38/500`, upload progress present and no old `createKinds` markup.
- Playability defect fixed for the empty-demo Social feed. Root cause: when
  `/api/social/feed` returned no posts, `For You/Clips` rendered no `<video>`;
  when autoplay did start, the central play affordance was invisible. Empty
  clip feeds now receive a local demo MP4 through `demoSocialFeedPosts()`, empty
  Tweets receive a text-only demo tweet, and clip cards include a central
  `data-clip-play` button that stays visible/clickable and toggles between `▶`
  and `Ⅱ`. Static assets are cache-busted to `20260825-social40`.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-playable-demo-feed-v1.json`.
  Browser smoke on `social40` confirmed one loaded local video, readyState 4,
  no video error, clickable central button, first click pauses and shows `▶`,
  second click plays and shows `Ⅱ`.
- Header switchers now behave as true toggles. Pressing `Nexus mode`, `Feed` or
  `Prieteni` once opens its sheet; pressing the same control again closes it.
  Opening one of the three closes the others to prevent overlapping dialogs.
  Static assets are cache-busted to `20260825-social41`.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-header-switcher-toggle-v1.json`.
  Browser smoke on `social41` confirmed mode/feed/friends each open with count
  `1` then close with count `0` on the second click, and Feed closes when
  Prieteni is opened.
- Story creation and For You reels were tightened. The Story rail `Story nou`
  action now opens the story composer directly with camera source
  `story_camera`; on local HTTP/mobile browsers this routes to native
  `capture=environment`. For You remains clip-first (`socialFormat=clips`) and
  the empty demo feed starts with a local playable MP4, not photos or tweets.
  Clip overlays now include transparent visible comment previews with small
  profile/avatar chips while preserving the vertical action rail for reactions,
  comments, support, share, save and sound. Static assets are cache-busted to
  `20260825-social42`.
- Evidence pack:
  `planning/evidence/NX-WEB-SOCIAL-P01-story-camera-reels-overlay-v1.json`.
  Browser smoke on `social42` confirmed For You renders 1 video clip card, no
  visible feed tabs, 6 clip quick actions, visible transparent caption,
  2 comment avatars in the preview, and Story opens a story camera composer
  with `capture=environment`.

## Remaining inside this packet

- Upgrade E2EE v1 with an audited pre-key/double-ratchet design, key rotation,
  cross-device recovery, encrypted attachments and production HTTPS before any
  Signal/WhatsApp-grade or forward-secrecy claim.
- Add production HTTPS plus optional TURN and SFU adapters before claiming reliable
  Internet calls or group meetings; provider use remains disabled by default.
- Add encrypted attachment key/lifecycle support; document release remains gated
  on a real malware scanner or content-disarm adapter.
- Add creator audio/edit tools and a configured signed-source Breaking adapter;
  extend accessible overlays across every remaining Social surface. Production-scale ranking and signed
  Global normalization remain later gates.
- Seal the final Social evidence pack and obtain independent T1 review.

## Gates

- Auth dependency: PASS.
- Existing core Social/Engage/Experience/Profile/Chat proofs: PASS, used as
  normative boundaries rather than production-completeness claims.
- Breaking news, TURN/SFU, push, moderation providers and external media services:
  disabled by default; no account creation or paid/free-tier assumption authorized.
- Completion requires a sealed Evidence Pack plus independent T1 review.
## 2026-08-25 — Collectible identity market economy

- Added `docs/23-collectible-identity-market-economy.md`.
- Defined the story prism-chain UX: overlapping stories, first-tap peek, second-tap full-screen.
- Defined transferable assets: username, story collectible, empty profile shell, transparent creator/business page.
- Defined non-transferable boundaries: wallet/private keys, messages, KYC/KYB, earned sigils, sanctions, dating history and personal reputation.
- Added architecture for username registry, story collectibles, asset market, escrow settlement, profile transfer and royalty splitter.
- Added rollout recommendation: demo UI first, devnet ownership/escrow second, production-gated profile/page transfers later.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-collectible-identity-economy-v1.json`.

## 2026-08-25 — Curiosity tokenomics extension

- Extended `docs/23-collectible-identity-market-economy.md` with `Curiosity Market`.
- Defined the economic style as `free by default, pay for curiosity`.
- Added primitives: Unlock, Reveal x2, Mutual Reveal, Peek, Collect, Gift Unlock, Friend Vault and Bounty Reveal.
- Added consent-first rules for reveal flows: anonymous, revealable, mutual reveal and never reveal.
- Added recommended Reveal x2 split: 60% revealed visitor, 30% owner/context creator, 10% Nexus.
- Reconfirmed that reviews, trust, KYC, earned badges, dating seriousness and organic reach cannot be bought.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-curiosity-tokenomics-v1.json`.

## 2026-08-25 — Curiosity UI + futuristic redesign

- Implemented Curiosity Market primitives in the local demo UI: Unlock, Collect, Reveal x2 and List/Resell.
- Added `CURIOSITY_ECONOMY` constants: 1 USD minimum settlement, 90/10 private split, 60/30/10 Reveal x2 split and local policy version.
- Added local curiosity receipts in browser storage with `demo_local_no_real_funds`; no payment provider or real funds used.
- Added prism story tap-to-peek: first tap enlarges/glows, second tap opens the economy sheet.
- Added demo collectible stories and a Mystery Reel with hidden unlock, collectible and revealable metadata.
- Applied the attached futuristic visual direction as CSS overrides: void background, glass/refraction panels, neural glow, orbital stories, action wells and luminous bottom nav arc.
- Updated cache bust to `20260825-social43`.
- Verification: `node --check apps/nexus-web/public/app.js`; `node --test apps/nexus-web/test/audit.test.js` → 20/20 passed.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-curiosity-ui-redesign-v1.json`.

## 2026-08-26 — Neural Glass visual redesign v2

- User feedback confirmed the first visual pass looked too close to the previous demo.
- Added a stronger final CSS override layer: `NX Visual Redesign v2`.
- The new layer targets the login/landing page, app shell, phone frame, three header switches, orbital stories, full-screen reel viewport, right-side action wells, holographic sheets, luminous bottom dock, messages/live/profile cards and empty states.
- Updated cache bust to `20260826-neural44` so browsers request the new CSS/JS assets.
- Verification: `node --check apps/nexus-web/public/app.js`; `node --test apps/nexus-web/test/audit.test.js` → 20/20 passed.
- Local HTTP check confirmed `/` serves `styles.css?v=20260826-neural44` and `app.js?v=20260826-neural44`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-neural-redesign-v2.json`.

## 2026-08-26 — Neural Glass visual redesign v3

- User clarified that the concept is a serious interface redesign, not a small style adjustment.
- Applied `NX Visual Redesign v3` as a stronger final CSS layer.
- Added a geometric Nexus logo mark to the login and app header.
- Reworked clip comment previews into floating glass slabs with avatar, text and reaction count.
- Strengthened footer/dock, stories, feed viewport, action wells, selectors, login panels and messages/live/profile surfaces.
- Updated cache bust to `20260826-neural45`.
- Verification: `node --check apps/nexus-web/public/app.js`; `node --test apps/nexus-web/test/audit.test.js` → 20/20 passed.
- Generated visual previews:
  - `planning/evidence/screenshots/nexus-neural45-login.png`
  - `planning/evidence/screenshots/nexus-neural45-social.png`
- Known gap: exact parity with the high-fidelity references requires component-level layout refactoring per screen, not only CSS overrides.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-neural-redesign-v3.json`.

## 2026-08-26 — Content-first reels v4

- Refactored the reel component so content occupies the full available feed card.
- Removed the persistent central Play/Pause control and the direct Support action from the reel rail.
- Added single-tap Like plus a 430 ms long-press palette for Love, Haha, Wow, Sad, Angry, Fake opinion and Dislike.
- Moved comments into an on-demand bottom drawer. It can be closed by the `×` button, the comment action, backdrop tap, swipe-down gesture or Escape.
- Creator identity, follow, description, trust hint and action rail now auto-hide after 2.6 seconds of inactivity and reappear on interaction.
- Added double-click fullscreen and a landscape content-only layout; header, stories and dock disappear in a narrow landscape viewport.
- Added three distinct local MP4 demo clips for vertical feed testing.
- Replaced the previous hexagonal brand mark with the cyan/violet Nexus `N` form and restyled the profile-mode selector.
- Raised and compacted the bottom dock while preserving the large central Create node.
- Updated cache bust to `20260826-neural46`.
- Full regression testing initially exposed a pre-existing backend defect: media-less video placeholders fabricated a Creator Studio manifest and were rejected. `repo.createPost` now keeps that manifest null unless media or an explicit edit exists.
- Verification: `node --check apps/nexus-web/public/app.js`; focused UI audit → 20/20 passed; complete local suite → 92/92 passed; local root returned HTTP 200 with neural46 assets.
- Browser-driven visual verification was blocked by the user's saved localhost permission; no bypass or alternate browser workaround was attempted.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-content-first-reels-v4.json`.

## 2026-08-26 — Fullscreen + compact comments v5

- Replaced the mobile icon-only header treatment with a visible `NEXUS` wordmark; the X now has a cyan circuit treatment inspired by the supplied reference.
- Reduced the comments drawer from 62% to at most 40% of the mobile reel and removed heavy background blur.
- Made the complete comments title/summary area a collapse control while preserving close, repeated action, backdrop, swipe-handle and Escape exits.
- A direct tap on video now enters fullscreen. Standard Fullscreen API is used for the reel stage and `webkitEnterFullscreen` is the iOS fallback.
- Fullscreen uses black canvas plus contained media, keeping action chrome available until its inactivity timeout.
- Updated cache bust to `20260826-neural47`.
- Verification: `node --check`; focused UI audit 20/20; complete local suite 92/92; LAN HTTP returned 200 with neural47 assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-fullscreen-compact-comments-v5.json`.

## 2026-08-26 — Instagram-style split comments v6

- Comment mode now changes the reel card to a 50/50 split: video above and comments below.
- Closing comments restores the reel to the complete feed card.
- Comments are ranked client-side by total reactions, then reply count, then recency.
- Comment rows expose a compact heart count and reply count instead of raw reaction codes.
- The comment action stays usable in the reduced reel, allowing the same button to close the panel.
- Updated cache bust to `20260826-neural48`.
- Verification: Node syntax pass; focused UI audit 20/20; complete local suite 92/92; LAN HTTP 200.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-split-comments-v6.json`.

## 2026-08-26 — Repost / Retweet v7

- Added a distinct persistent social action separate from external Share.
- The action is labeled `Repost` for clips/posts and `Retweet` in the Tweets feed.
- Reposts are toggleable, idempotent per active profile and expose a separate count.
- Added the action to reel controls, ordinary post actions and fullscreen media actions.
- Real posts persist via `/api/posts/:id/repost`; local demo posts use isolated UI state.
- Reposts contribute through the existing organic share signal without buying reach.
- Updated cache bust to `20260826-neural49`.

## 2026-08-26 — neural50 playback + persistent sound

- A tap directly on the active clip now toggles Play/Pause; fullscreen remains a
  separate, explicit `⛶` action.
- The central Play control is rendered only while the clip is paused and is removed
  from the visual field as soon as playback starts.
- Sound is a feed-wide preference stored under `nexus-social-muted-v1`: Mute applies
  to current and subsequent clips and survives refresh until the user toggles it.
- The first-run default remains muted so mobile autoplay can work without a surprise
  audio start.
- Verification: JavaScript syntax pass, audit `20/20`, complete web suite `92/92`,
  LAN HTTP `200` with `20260826-neural50` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-play-mute-v8.json`.

## 2026-08-27 — neural51 compact persistent creator identity

- The clip creator strip now uses a bounded 32 px avatar, ellipsized name/username,
  compact Follow and menu controls, and a stable maximum width.
- Creator identity stays visible when secondary clip chrome fades and while the
  comments split is open; description and context can still fade to protect content.
- Verification: JavaScript syntax pass, audit `20/20`, complete web suite `92/92`,
  LAN HTTP `200` with `20260826-neural51` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-creator-identity-v9.json`.

## 2026-08-27 — neural52 anchored Stories rail

- Social now has an explicit two-row viewport: a persistent Stories rail and an
  independently scrolling reel viewport.
- Vertical reel navigation uses contained overscroll and mandatory snap, preventing
  the outer shell from carrying Stories away while moving to the next clip.
- Verification: JavaScript syntax pass, audit `20/20`, complete web suite `92/92`,
  LAN HTTP `200` with `20260827-neural52` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-sticky-stories-v10.json`.

## 2026-08-27 — neural53 adaptive double-tap fullscreen

- A single video tap remains Play/Pause; a second tap within 320 ms cancels that
  action and enters fullscreen.
- Fullscreen orientation follows source metadata: landscape for horizontal clips,
  portrait for vertical/square clips, with orientation unlocked on exit.
- Videos use `object-fit: contain` at their native aspect ratio, preventing crop or
  distortion across phone viewport sizes; unsupported fullscreen falls back to the
  Nexus media viewer.
- Verification: JavaScript syntax pass, audit `20/20`, complete web suite `92/92`,
  LAN HTTP `200` with `20260827-neural53` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-responsive-fullscreen-v11.json`.

## 2026-08-27 — neural58 browser interaction audit

- A normal Like-button click now opens/closes the explicit reaction chooser; it no
  longer silently assumes LIKE. Long press remains an optional shortcut.
- Removed the effective `display:none` regression caused by a retired clip-toolbar
  rule and changed the selector to a phone-friendly 4×2 grid showing all reactions.
- Escape, a second Like click, choosing a reaction, or tapping the clip can close the
  selector without trapping the user.
- Added a deterministic media-viewer fallback for browsers without Fullscreen API.
- Browser-verified: reaction chooser, comments, more menu, sound toggle/restore and
  Play/Pause. Automated verification: syntax pass, audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural58` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-interaction-audit-v12.json`.

## 2026-08-27 — neural59 Stories yield to content

- Product decision corrected: Stories introduce the feed but must disappear after
  vertical reel navigation so content receives the full available viewport.
- At `pulsePosts.scrollTop > 18`, the Stories grid row collapses to zero, fades out,
  and stops receiving pointer input. Returning to the top restores it.
- Browser evidence confirmed `119.67 px → 0 px → 119.67 px` and opacity `1 → 0 → 1`
  across top, swipe and return-top states.
- Verification: syntax pass, audit `20/20`, full suite `92/92`, LAN HTTP `200` with
  `20260827-neural59` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-auto-hide-stories-v13.json`.
- Verification: syntax pass; focused audit 20/20; full suite 92/92; LAN HTTP 200.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-repost-v7.json`.

## 2026-08-27 — neural60 one-tap fullscreen Reels

- Any clip in the main feed now opens the dedicated Nexus Reel viewer after one
  click; the feed header, Stories and bottom dock no longer compete with the media.
- The viewer follows the approved reference hierarchy: Back/Reels/Friends at top,
  full-viewport media, a compact right action rail, creator/follow/audio/caption
  overlay and an always-reachable comment entry at the bottom.
- Tap toggles Play/Pause; the central Play control exists only while paused. Sound
  preference remains persistent, swipe changes clips, and landscape adapts without
  stretching the source media.
- Comments open as a retractable lower sheet and reactions close after selection,
  preventing interaction traps.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  localhost and LAN HTTP `200` with `20260827-neural60` assets. In-app visual reload
  was unavailable because the user's saved local-browser permission blocked it.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-reel-viewer-v14.json`.

## 2026-08-27 — neural61 real mobile viewport

- Removed the presentation-phone shell on mobile: no outer padding, metal frame,
  rounded application corners, shadow or exposed page background.
- Social feed videos now render `cover` across the complete available width and
  height, with square edges, eliminating the black side gutters visible in the
  owner's phone capture.
- The desktop showcase remains framed; the correction is scoped to real mobile
  viewports at `max-width: 760px`.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural61` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-edge-to-edge-v15.json`.

## 2026-08-27 — neural62 comment focus mode

- Opening a feed comment drawer now activates an explicit comment-focus state:
  the lower Nexus dock is removed visually and made inert/hidden for accessibility.
- The content viewport expands into the released dock area, allowing the comment
  list and composer to remain visible while reading or typing on a phone keyboard.
- Closing via the X, drawer control, scrim, downward gesture or Escape restores the
  dock and its accessibility state automatically.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural62` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-comments-dock-v16.json`.

## 2026-08-27 — neural63 persistent creator actions

- Reaction, comment and Repost/Retweet remain visible in clip feed and fullscreen;
  comment-open states no longer fade the feed action rail.
- Follow and a compact creator menu now sit beside the identity on clips, media
  viewer, posts and tweets. The menu offers Profile, Message, Not interested and
  Report, closes on toggle/outside click/Escape/selection and never traps the view.
- Message opens the unified inbox with the Nexus username prefilled; Profile opens
  isolated Social search for that creator.
- Creator identity glass now uses content width with bounded truncation instead of
  occupying a fixed long rectangle.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural63` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-creator-actions-v17.json`.

## 2026-08-27 — neural64 persistent right rail

- Corrected the hidden-chrome regression: reaction, comment, Repost, share, save
  and sound controls remain visible and interactive on the right at all times.
- The creator ellipsis menu is now anchored at the top-right beside its trigger
  (`top: 54px; right: 12px`) and cannot fall into the lower navigation area.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural64` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-persistent-rail-v18.json`.

## 2026-08-27 — neural65 transparent actions and comment threads

- Removed glass/circle backgrounds from creator identity and primary engagement;
  glyphs and counts now float directly on media with text/drop shadows only.
- The reaction trigger uses the highest-count community reaction (including Sad,
  Fake?, Angry or Dislike) and updates immediately after a reaction mutation.
- Comments are rendered as bounded reply trees: child replies follow and indent
  beneath their parent, show `Răspuns pentru @…`, and preserve `parent_id` from
  composer through API in both feed and fullscreen viewer.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural65` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-reactions-threads-v19.json`.

## 2026-08-27 — neural66 proportional reaction distribution

- Follow and ellipsis now sit directly beside the display name; long handles are
  independently truncated and can no longer push controls to the opposite side.
- Creator avatar/name opens the creator's active Story; without one it safely falls
  back to the isolated Social profile search.
- Dislike is a first-class always-visible right-rail action in feed and fullscreen.
- Reaction summary uses an explicit 80% dominance rule. Dominant distributions show
  one glyph with aggregate total; balanced distributions show the top 2–3 glyphs
  and their individual counts.
- Verification: JavaScript syntax pass, focused audit `20/20`, full suite `92/92`,
  LAN HTTP `200` with `20260827-neural66` assets.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-reaction-distribution-v20.json`.

## 2026-08-27 — neural67 product-shot visual baseline

- Applied the approved generated NEXUS mockup as a real, responsive Social UI
  rather than embedding the concept image: compact three-pill header, circular
  neon Stories, edge-to-edge media, transparent action rail and floating dock.
- Preserved all existing behavior for profile switching, feed selection, creator
  actions, reactions/dislike, threaded comments, sound, fullscreen and Create.
- Added a single final design-token layer (`--nx67-*`) to neutralize the conflicting
  experimental visual overrides without rewriting functional components.
- Verification: full local suite `92/92`; HTTP document, CSS and JS all `200`;
  HTML serves cache key `20260827-neural67`; CSS braces balanced `2522/2522`.
- Browser screenshot automation was not executed because the user's saved local
  browser-access preference blocks `127.0.0.1`; no bypass was attempted.

## 2026-08-27 — neural68 dynamic engagement and Reshare

- Replaced fixed Like/Dislike rail entries with an exact top-three reaction
  summary: only reaction types with non-zero counts appear, each with its own
  glyph and count; the empty state remains Like `0`.
- Combined Repost and external Share into one Reshare action. Its bounded sheet
  exposes Nexus friends, Repost/Retweet, WhatsApp, Messenger, copy link, Viber,
  Instagram/native share, email, X, Facebook and the device share menu.
- Replaced the generic mute control with a rotating audio-disc action that shows
  the uploaded attribution or the honest `Audio original` fallback; mute remains
  persistent and visually indicated.
- Rebuilt the five dock glyphs as consistent inline SVG icons while preserving
  the existing Social destinations and unread-message badge behavior.
- Verification: JavaScript syntax pass, full suite `92/92`, HTTP HTML/CSS/JS
  `200`, cache key `20260827-neural68`, CSS braces balanced `2566/2566`.

## 2026-08-27 — neural69 real share graph, Story Viewer and responsive parity

- Replaced the CSS wordmark with one responsive inline SVG so the same Nexus logo
  geometry is rendered on desktop and narrow mobile viewports.
- Rebuilt the clip action glyphs as scalable SVG controls and locked the central
  Create control to a true circular aspect ratio.
- Reshare now loads real Social followers/following plus recent conversation
  participants, ranks them by relationship/recency, supports search and selection,
  and sends the post through the existing conversation/message backend. No fake
  friend rows are rendered when the graph is empty.
- External share destinations now include recognizable vector marks and actionable
  WhatsApp, Telegram, Messenger, Viber, email, X, Facebook and native-share routes.
  Selecting an external destination is recorded as `external`; Nexus does not claim
  that a third-party app completed a post.
- Added persistent `story_views` state with unseen/viewed filtering. One tap opens a
  full-screen Story Viewer with timed/video-duration progress, tap/swipe/keyboard
  navigation, hold-to-pause, automatic continuation and viewed-state removal from
  the active rail.
- Verification: `node --check` passed for the client/API/repository/test sources;
  CSS braces balanced `2633/2633`; `npm test` passed `92/92`; restarted the verified
  Nexus Node process and confirmed listener `0.0.0.0:3000`, `/health` OK, page/CSS/JS
  HTTP `200`, cache key `20260827-neural69`.

## 2026-08-27 — neural70 global header, direct Camera and Live Device Check

- Enlarged the shared SVG Nexus wordmark while reducing all three header controls;
  the same shell header now remains available across feed, Messages, Live and Profile,
  with mode-specific quick labels outside Social.
- Story rail, Create → Story and Create → Clip now enter the camera flow directly.
  Gallery remains explicit and separate; denied/unsupported camera states expose Retry
  and Gallery recovery, and every navigation/close/profile switch stops active tracks.
- Live now enters an actual camera/microphone Device Check, with local preview,
  front/rear flip, camera/mic toggles, microphone level meter, secure-context failure
  guidance and a private-preview save. The UI never reports `LIVE` because the backend
  correctly remains `GATED_NO_SFU`.
- Responsive layer `neural70` sets the mobile logo to 108 px (96 px at <=360 px)
  and header controls to 32–34 px without removing the global navigation context.

## 2026-08-27 — neural71 Nexus-only policy, secure phone camera and continuous Reels

- Retired every active external Social share route and its provider artwork. Share
  controls are absent in feed, fullscreen and Profile, while the API fails closed
  with `409 SOCIAL_SHARE`; Repost/Retweet remains an internal Nexus action.
- Camera, Story and Live device checks start selfie-first. A LAN HTTPS listener on
  `0.0.0.0:3443` plus a locally generated, ignored development certificate enables
  real `getUserMedia` on a trusted phone browser; HTTP remains available for the
  one-time local root-certificate download and non-camera fallback.
- Fullscreen Reels now preserve the selected item and feed scroll, permit vertical
  swipe/Arrow navigation, preload adjacent clips, keep a single video playing,
  synchronize mute/reactions and close safely via Escape or the explicit close.
- Mobile wordmark increases to 136 px (116 px at <=360 px) while the three global
  context controls are reduced, preserving the same header across Social screens.
- SyntheticActorLab V2 ran 1,000 `SYSTEM_TEST` identities locally with 1,000 posts,
  1,000 reactions, 1,334 threaded comments/replies, 1,208 follows, 100 messages,
  125 Stories/views and other journeys. No organic, Sigil or economic contamination
  was detected; deployment gate `PASS` in 1.822 s.
- Verification: JavaScript syntax checks passed; full suite `93/93`; HTTP and HTTPS
  health `200`; phone LAN HTTPS document `200` with cache key `neural71`; camera and
  microphone policies are explicitly `self` only.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-neural71.json`.

## 2026-08-28 — producție Social contract v1

- Added `docs/24-social-production-functional-spec.md`: 23 sections, 848 lines and
  5,895 words covering Identity, Social, Profile and Messages as an executable
  behavior contract rather than a visual feature list.
- Every persistent journey now has shared request/action states, idempotency, retry,
  offline and race semantics plus explicit validation, moderation and privacy order.
- Production media limits now cover image/video/audio admission, resumable upload,
  processing/transcoding states, variants, storage/CDN behavior and honest local
  fallbacks. Clips retain the owner-approved three-minute maximum.
- Comment withdrawal uses tombstones; post owners cannot erase criticism. Reaction
  distribution, private dislike, `Fake?` community-opinion semantics and internal
  Repost/Retweet are normative.
- Nexus-only distribution overrides the generic external-share prompt: external
  app links remain forbidden and `/posts/{id}/share` stays fail-closed.
- Added P0/P1/P2/GATED delivery matrices, unresolved owner decisions, prioritized
  implementation, SLOs, data/API boundaries and release evidence requirements.
- `docs/00-master-spec.md` now routes the first delivered vertical to this contract.

## 2026-08-28 — P0 resumable upload and media privacy boundary v1

- Replaced all active Social browser uploads (composer media/audio, Story, message
  attachment and profile avatar) with a resumable local adapter. The client stores
  only upload/session idempotency metadata, resumes confirmed chunks after a network
  interruption and renders progress from bytes acknowledged by the server.
- Added durable `upload_sessions`, `upload_parts` and `outbox_events` state. Create,
  part, complete and cancel operations require bounded `Idempotency-Key` values;
  conflicting key reuse fails closed and completion emits one durable outbox event.
- Upload ownership is masked as `404`. Media grants are now scoped by user, purpose
  and active persona so a Social upload cannot be attached from Work. This is a
  privacy boundary, not merely a UI filter.
- Fixed a Critical cache-policy defect: authenticated media now uses
  `private, no-store, max-age=0`, `Pragma: no-cache` and `Vary: Cookie`, preventing
  an intermediary or browser cache from retaining protected bytes after an audience,
  block or profile-visibility change.
- Assembly integrity checks every part and the aggregate SHA-256. Integrity failures
  are terminal; unexpected local storage failures reset to a retryable state and
  require the same completion key.
- Verification: syntax checks passed; full suite `97/97`; a dedicated 100-actor
  interleaving/resume simulation completed exactly 100 uploads and 100 unique outbox
  events with no cross-owner read; SyntheticActorLab V2 passed 1,000 identities with
  no organic or Sigil contamination. All runs were local-only, zero network egress,
  zero real funds and zero incremental provider cost.
- Remaining P0: retire the legacy base64 media mutation, enforce idempotency through
  the common mutation boundary, dispatch/retry/dead-letter the outbox, complete the
  full Privacy Matrix query layer, add streaming object storage and asynchronous
  malware/transcode workers. The existing SQLite migration has a conservative legacy
  grant primary key that remains stricter than the new persona-aware schema and must
  be rebuilt transactionally before production.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-resumable-upload-v1.json`.

## 2026-08-28 — P0 authenticated mutation registry and outbox worker v1

- Retired the legacy full-body base64 `POST /api/media` boundary with permanent
  `410 MEDIA_UPLOAD_LEGACY_RETIRED`; tests now build controlled media fixtures or
  exercise the resumable contract instead of preserving the unsafe fallback.
- Every authenticated non-upload `POST`, `PUT`, `PATCH` and `DELETE` now requires a
  16–128 character `Idempotency-Key`. The browser adds a key for each action and
  upload routes retain their stricter session/part keys.
- Added a durable mutation registry scoped by account **and active persona**. Exact
  retries replay the completed status/body, changed payloads return `409`, concurrent
  duplicates receive a retryable `409`, and expired in-progress leases can recover.
  The fingerprint includes persona, method, target and exact bytes.
- Replay bodies are AES-256-GCM encrypted at rest with a key derived from the required
  server session secret. Cookies/tokens are never captured; only a strict response
  header allowlist is retained. Oversized responses are marked completed with a
  refresh instruction, never silently re-executed.
- Persona switching now updates the authenticated session record instead of issuing
  an additional session/cookie, keeping retry semantics deterministic.
- Added a local outbox worker with transactional leasing, expired-lease recovery,
  bounded batches, exponential retry and a dedicated dead-letter table. Upload event
  payloads were minimized to upload/media identifiers; user ID, purpose and media
  hash are no longer duplicated in the event/dead-letter payload.
- Message `client_nonce` replay now suppresses duplicate notifications and SSE for
  both plaintext and E2EE messages.
- Independent audit caught and prevented a broken `ALTER TABLE` definition and a
  possible Social→Work replay leak before runtime. Both controls are covered by tests.
- Verification: syntax pass; full suite `101/101`; 100 `SYSTEM_TEST` actors survived
  a 1,000-request replay storm with exactly 100 completed registry rows; worker
  publish/retry/dead-letter tests passed; separate 1,000-actor Social lab remains PASS.
  Local-only, zero network egress, zero real funds and zero incremental provider cost.
- Remaining P0/T1: the registry and domain write are not yet one database transaction,
  leaving a narrow crash-after-domain-commit/before-response-record window. Hidden
  write effects in GET routes must be split into explicit internal commands; auth
  issuance and ephemeral WebRTC/presence need specialized idempotency rather than the
  authenticated Social registry. The next packet centralizes the full read Privacy
  Matrix before moving to P1.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-mutation-outbox-v1.json`.

## 2026-08-28 — P0 centralized Privacy Matrix v1

- Added one deny-first evaluator for profile/resource reads. Its fixed order is:
  valid subjects → active resource → matching active persona → block graph → owner
  override → profile audience → resource audience. Unknown visibility values deny.
- Social, Work and every other identity are now hard boundaries for feed/profile,
  post, Story, avatar and post/Story media access. A Social session cannot open a
  Work resource even when both identities belong to the same wallet.
- Followers require the viewer→owner relation in the resource persona; friends
  require mutual following. Blocks override follows, mutual status and paid access.
- Private access receipts are evaluated centrally. Local demo receipts are valid
  only outside production; production accepts only `settled`. Expired receipts,
  wrong personas and blocked relationships deny. Private-content listings now
  re-evaluate authorization for every item rather than trusting an old receipt.
- Unified Messages intentionally remain account-level for inbox/history reads, while
  message sending remains bound to the conversation profile. Conversation membership,
  invitation state, device ownership and history boundary continue to gate reads.
- Removed hidden writes from normal profile/feed/inbox/message GET journeys: they no
  longer create profiles, touch presence, mark delivery or run expiry cleanup.
  Message read/delivery is already an explicit POST; expiry and session/call cleanup
  now run in the bounded local maintenance worker.
- Fixed an existing runtime bug revealed by the new private-access test: receipt
  commitment generation used `createHash` without importing it.
- Verification: syntax pass; full suite `104/104`; 1,000 combinatorial privacy
  decisions produced zero persona/block/inactive bypass; repository integration
  verifies public/followers/friends/private, paid access, Stories and media; the
  separate 1,000-actor Social lab remains PASS with no synthetic contamination.
- Capacity note: the independent checker hit the observable ChatGPT Plus usage limit
  before producing its cycle-3 report. Per `YELLOW` policy, implementation and all
  deterministic tests ran on the main agent only; independent T0 release sign-off is
  pending a later capacity window and is not falsely claimed.
- Remaining P0 hardening: migrate route/domain mutation completion into the same DB
  transaction, specialize auth/signaling idempotency, and rebuild the legacy
  `media_upload_grants` primary key transactionally. These are production gates, not
  blockers for the current local demo.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-privacy-matrix-v1.json`.

## 2026-08-28 — P0 atomic post publication command v1

- Post publication now commits the post row, canonical assessment, append-only
  moderation event, local intent proof, encrypted idempotent response and durable
  realtime outbox event in one SQLite transaction. A process failure can no longer
  leave a committed post behind an unfinished mutation lease.
- The generic response recorder and the atomic command share one completion
  primitive. The recorder safely becomes a no-op after the command has already
  completed its mutation row inside the transaction.
- Realtime publication moved from an inline SSE side effect to the leased outbox
  worker. Events contain only a post identifier. Public posts invalidate the public
  persona channel; private posts notify only their owner, and every client must
  refetch through the centralized Privacy Matrix.
- A crash failpoint immediately before commit proves that post, assessment, proof,
  response and outbox all roll back. After simulated lease expiry, the same command
  creates exactly one post; subsequent exact retries replay that same response.
- The crash test exposed a High transaction bug: `node:sqlite` does not expose the
  `inTransaction` property assumed by rollback guards. The affected P0 boundaries
  now track transaction state explicitly or roll back unconditionally where the
  transaction is known to be open.
- Verification: targeted atomic/outbox suite `6/6`; full suite `106/106`; separate
  SyntheticActorLab V2 passed 1,000 local-only `SYSTEM_TEST` identities, including
  1,000 posts, 1,000 reactions, 1,334 comments/replies, 100 messages and 125 Stories,
  with no organic or Sigil contamination. Network egress, real funds and incremental
  provider cost remained zero.
- Remaining P0 hardening: rebuild the legacy `media_upload_grants` key to include
  active persona, then add specialized replay boundaries for auth issuance and
  ephemeral signaling. Independent T0 sign-off remains pending a later capacity
  window and is not claimed.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-atomic-post-command-v1.json`.

## 2026-08-28 — P0 persona-aware media grant migration v1

- Rebuilt the legacy `media_upload_grants` primary key transactionally from
  `(media_id, user_id, purpose)` to `(media_id, user_id, purpose, actor_persona)`.
  The same validated media can now receive explicitly separate Social and Work
  grants without weakening purpose or owner checks.
- Migration accepts only the known legacy key shape, fails closed on an unknown
  schema, normalizes invalid historical persona values to the conservative Social
  context, recreates the lookup index and remains a no-op after a successful run.
- A pre-commit crash test proves that SQLite restores the original table and rows;
  a following run migrates once, enforces same-persona uniqueness, preserves
  cross-persona grants and remains stable after database restart.
- The stopped demo database was checkpointed before migration and a recoverable
  copy was retained at
  `apps/nexus-web/data/nexus.sqlite.pre-media-grant-v2-20260828.bak`. All 25 grant
  rows survived; `foreign_key_check` returned no violations and `integrity_check`
  returned `ok`.
- Verification: migration suite `1/1`; full suite `107/107`; SyntheticActorLab V2
  passed 1,000 local-only identities with no organic or Sigil contamination. The
  restarted demo listens on `0.0.0.0:3000` and `0.0.0.0:3443`; local HTTP, local
  HTTPS and phone-LAN HTTPS all returned `200`.
- Remaining P0 hardening: specialized replay boundaries for authentication/session
  issuance and ephemeral WebRTC signaling, followed by independent T0 sign-off when
  checker capacity becomes observable. These remain production gates.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-media-grant-migration-v1.json`.

## 2026-08-28 — P0 NativeAuth and WebRTC replay boundaries v1

- NativeAuth, herotag, alias and recovery session issuance now require an
  idempotency key and consume each signed native token into exactly one durable
  session. SQLite commits the session and encrypted consumption proof atomically;
  exact retries return the original session, while changed request, purpose or
  identity fails closed. Raw native and session tokens are never persisted.
- Sessions now include a random 128-bit `jti`; authenticated requests verify the
  stored session subject against the signed payload. Logout revokes the cookie and
  a distinct presented Bearer token so two active credentials cannot diverge.
- WebRTC signaling moved from process memory to a durable, hash-only replay guard.
  The database stores no SDP/ICE payload. Recipient, sender, call, active persona,
  signal type and payload digest are bound together; duplicate or conflicting
  nonces cannot cross users or personas and remain protected across restart.
- Signaling uses explicit at-least-once delivery: only a successful SSE write is
  acknowledged, the client retries an unacknowledged signal with the same signal
  nonce, and receiver-side nonce deduplication prevents duplicate application.
  Active-call guards survive invite timeout and expire only after the call reaches
  a terminal state plus grace.
- An initial independent review reported zero Critical, four High and three Medium
  issues. All reported issues were remediated. The post-fix checker could not run
  in the current Plus capacity window, so independent T0 re-signoff remains
  explicitly pending and is not represented as PASS.
- Verification: full suite `112/112`; 100 concurrent call pairs with 300 marked
  `SYSTEM_TEST` users; 100 session issuances with 100 unique `jti` values; crash
  rollback and restart replay tests; separate 1,000-actor Social simulation PASS
  with no organic, Sigil, privacy or thread contamination. The actual SQLite
  database passed `foreign_key_check` and `integrity_check`.
- Runtime PID `6016` listens on `0.0.0.0:3000` and `0.0.0.0:3443`; HTTP, HTTPS and
  phone-LAN HTTPS returned `200`. External share remains denied and incremental
  cost, network egress and real funds remained zero.
- Remaining P0 hardening: specialize email signup/login/session issuance under the
  same durable one-request/one-session boundary before starting P1 comments and
  visible profiles.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-auth-signaling-idempotency-v1.json`.

## 2026-08-28 — P0 email authentication idempotency v1

- Email signup-init now stores a durable, encrypted and email-bound device-wallet
  challenge. The same idempotency key returns the same nonce; reuse for another
  email fails closed. SQLite stores only a nonce digest, encrypted nonce and email
  digest, never the plaintext email or wallet secret in the challenge boundary.
- Signup now commits challenge consumption, account, all personas, email binding,
  password verifier, session and encrypted replay response in one transaction. A
  simulated crash before commit rolls everything back and leaves the challenge
  usable for the exact retry. A committed retry returns the identical session
  cookie without creating another user or session.
- Email login and verification use the same one-key/one-session boundary. Request
  equality is bound with keyed HMAC so the database does not contain a password
  oracle; session tokens and response bodies use AES-256-GCM at rest.
- Logout now requires an idempotency key, atomically revokes both cookie and a
  distinct Bearer session, and binds replays to the sorted credential digest set.
  Reusing the key for another credential set is denied.
- Google and Facebook remain truthfully disabled behind their external provider
  and embedded-wallet gate. Their callback session issuance must adopt this durable
  boundary before either provider can be enabled; no active route currently reaches
  those callbacks through a valid externally issued state.
- Verification: `117/117` full tests; five focused email-auth tests; 101 load-issued
  login commands produced 101 unique session hashes; crash/retry, encrypted storage,
  route-level exact-cookie replay and logout conflict tests all passed. The separate
  1,000-actor lab passed with no organic, Sigil, privacy or thread contamination.
- Runtime PID `9116` listens on `0.0.0.0:3000` and `0.0.0.0:3443`. Local HTTP,
  local HTTPS and phone-LAN HTTPS returned `200`; the migrated real database passed
  `foreign_key_check` and `integrity_check`.
- The P0 implementation gate is PASS. Independent T0 release sign-off remains
  pending a later Plus capacity window and is not falsely claimed; external
  production providers also remain separate formal gates.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-email-auth-idempotency-v1.json`.

## 2026-08-28 — P1 comments and visible profiles v1

- Profile reads now expose persona-scoped avatar, cover, bio, counters and posts only
  after the centralized Privacy Matrix authorizes the viewer. Cover uploads use a
  separate `profile_cover` purpose grant and cannot be reused across owners,
  purposes or active personas.
- Comments support relevant/newest/oldest ordering, nested replies, author-only
  editing with immutable versions, and author-only withdrawal as a tombstone.
  Post creators cannot erase criticism. Reports enter moderation without removing
  content automatically.
- A High privacy leak was closed: blocked authors are filtered from both comment
  bodies and viewer-specific feed counts. Realtime no longer broadcasts raw comment
  text; it emits only `comment-changed` plus `post_id`, requiring an authorized
  refetch through the Privacy Matrix.
- The first real-database restart exposed a migration placement error before the
  server began listening. The migration was corrected, a deterministic legacy
  fixture was added, and restart/integrity checks now cover the affected columns.
- Verification: focused P1 suite `3/3`; migration suite `2/2`; full suite
  `120/120`; SyntheticActorLab V2 passed 1,000 local-only `SYSTEM_TEST` identities
  with no organic, Sigil, privacy or thread contamination. The actual database has
  no foreign-key violations and `integrity_check` is `ok`.
- Mobile browser QA at `390x844` confirmed the profile surface, comment open/close
  flow, hidden bottom navigation while reading or composing comments, restored
  navigation after close, and zero browser JavaScript errors. Synthetic demo reels
  without a persistent account remain truthfully labeled unavailable rather than
  fabricating a profile.
- Runtime PID `3128` listens on `0.0.0.0:3000` and `0.0.0.0:3443`; local HTTP,
  local HTTPS and phone-LAN HTTP returned `200`. External share remains denied;
  incremental cost, real funds and external provider egress remained zero.
- P1 comments/profiles local gate is PASS. Independent T0/T1 release sign-off is
  still pending a later capacity window and is not falsely represented as PASS.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p1-comments-profiles-v1.json`.

## 2026-08-29 — P0 NativeAuth replay after logout remediation v2

- An independent checker reproduced a High replay flaw: the original
  `native_auth_consumptions` schema referenced sessions with `ON DELETE CASCADE`.
  Logout therefore erased the durable proof-consumption marker, and the same
  still-valid NativeAuth proof could create a fresh session instead of failing.
- The consumption ledger is now independent of both session and user deletion and
  remains present until its own bounded expiry. After logout, an exact replay returns
  `NATIVE_AUTH_REPLAY_UNAVAILABLE`; it never issues a replacement session.
- The legacy table is rebuilt transactionally. Unknown foreign-key shapes fail
  closed; a crash immediately before commit restores the legacy table and marker;
  the retry migrates exactly once and preserves its unique proof/key constraints.
- The quiesced demo database was copied before migration to
  `apps/nexus-web/data/nexus.sqlite.pre-native-auth-independent-20260829.bak`.
  The migrated table has no cascading foreign keys, retains its expiry index,
  passes `foreign_key_check` and reports `integrity_check=ok`.
- Verification: focused NativeAuth suite `5/5`; full suite `125/125`; separate
  SyntheticActorLab V2 passed 1,000 local-only identities with no organic, Sigil,
  privacy or thread contamination. Runtime PID `5628` returned `200` on local HTTP,
  local HTTPS and phone-LAN HTTP.
- The local P0 gate is PASS again. A post-fix independent recheck is still pending
  because the Plus checker reached its capacity window; this is not represented as
  a release PASS. Cost, external egress and real funds remained zero.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p0-native-auth-logout-replay-v2.json`.

## 2026-08-29 — P1 relationship and realtime privacy v1

- Post reaction updates no longer expose aggregate counts on a broad persona
  channel. They emit only `post_id` to the owner and reacting user. Story creation
  no longer broadcasts the complete Story object; it emits an owner-only id
  invalidation and eligible viewers refetch through the Privacy Matrix.
- A High SSE integration defect was corrected: comment invalidations had called the
  single-channel `publish` primitive using broadcast-shaped arguments. They now use
  deduplicated user-channel broadcasts and contain no comment body.
- Follow is bound to the authenticated active persona and fails closed for missing
  profiles or either direction of the block graph. Blocking atomically removes both
  follow directions and cancels pending requests; unblock never restores them.
- Private profiles no longer accept a direct follow. They create a durable pending
  request with owner-only accept/decline, requester cancellation and non-disclosing
  wrong-owner responses. The UI persists and displays `Solicitat` until resolution.
- Reaction, comment-reaction and repost aggregates are viewer-specific and exclude
  actors blocked in either direction. Dislikes remain private ranking signals.
- Verification: focused P1 suite `5/5`; full suite `125/125`; 1,000-actor lab PASS
  with no organic, Sigil, privacy or thread contamination. The real database has
  the follow-request table and both lookup indexes, no FK violations, and reports
  `integrity_check=ok`.
- Runtime PID `5628` returned `200` on local HTTP, local HTTPS and phone-LAN HTTP.
  Browser QA loaded `p1privacy1` with zero JavaScript errors. External share remains
  denied; cost, external egress and real funds remained zero.
- The local P1 privacy/realtime gate is PASS. Independent T1 recheck remains pending
  the Plus reset and is not represented as a release PASS.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p1-social-privacy-realtime-v1.json`.

## 2026-08-29 — P1 follow-request inbox UI v1

- The Social relationship switcher now has a fourth `Cereri` context. It loads
  incoming and outgoing private-profile requests separately and keeps the active
  relationship context visible in the compact header.
- Incoming requests expose owner-only `Acceptă` and `Refuză`; outgoing requests
  expose requester-only `Anulează`. Mutation controls disable while pending and
  reuse the idempotent API client. Loading, empty, failure and retry states are
  explicit rather than leaving a blank or blocked sheet.
- The four-tab layout has a phone-specific responsive treatment and is loaded as a
  versioned style layer after the established Nexus visual system. The external
  sharing surface remains denied.
- Verification: JavaScript syntax PASS; focused P1/static suite `25/25`; full suite
  `125/125`. Mobile DOM QA at `390x844` confirmed the fourth tab, truthful empty
  state, header label synchronization and second-click close without trapping the
  user. Runtime PID `5628` returned `200` on local and phone-LAN HTTP.
- Cost, external egress and real funds remained zero. The local P1 request-inbox
  gate is PASS; independent T0/T1 sign-off remains pending the Plus capacity reset
  and is not represented as a release PASS.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-p1-follow-requests-ui-v1.json`.

## 2026-08-29 — P2 Story lifecycle and continuity v1

- A High lifecycle/privacy bypass was closed. Expired or archived Stories can no
  longer record views or authorize their media through a direct identifier. Policy
  evaluation uses the persisted Story status and verifies expiry before access.
- Story API responses now use an explicit public view model. Playback fields and
  the content commitment remain available, while media ownership, validation and
  quarantine metadata are no longer exposed to clients.
- View and archive mutations require the active Social persona; repository archival
  also checks the actor persona. Archive invalidation is owner-only and contains
  only the Story id.
- The mobile viewer now suppresses the synthetic click that browsers may emit after
  a horizontal swipe, preventing accidental double-advance while preserving tap,
  keyboard, hold-to-pause and close behavior.
- Verification: Story suite `2/2`; focused Story/privacy/static suite `25/25`; full
  suite `127/127`; actual database has no FK violations and `integrity_check=ok`.
  Mobile DOM QA at `390x844` confirmed the Story rail and Create entry while the
  feed and Nexus Dock remained usable.
- Runtime PID `11036` listens on `0.0.0.0:3000`; local and phone-LAN health returned
  `200`. Cost, external egress and real funds remained zero. The local Story gate is
  PASS; independent T1 sign-off remains pending capacity reset.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-story-lifecycle-v1.json`.

## 2026-08-29 — P2 Clip continuity and fullscreen comments v1

- A High UI routing defect was reproduced in the real mobile browser: the
  fullscreen comment action reused the feed drawer handler, opening comments behind
  the inert viewer. The fullscreen action now has a separate namespace and opens
  only the panel belonging to the active clip.
- Changing the active clip closes any previous comment panel first, preventing a
  conversation from being shown under the wrong video. The panel and viewer have
  independent close paths, after which the original feed scroll, focus, playback
  and Nexus Dock are restored.
- Fullscreen ranking signals now use real bounded dwell time and maximum observed
  video progress. The artificial `1 ms` impression was removed; exposures flush on
  step or close, and image completion requires a meaningful one-second view.
- The explicit fullscreen control no longer overlaps the creator identity on narrow
  phones. Browser QA confirmed it opens the Reel instead of the profile.
- Verification: static audit `20/20`; full suite `127/127`. Mobile QA at `390x844`
  confirmed fullscreen entry, the correct comment panel/input, absence of the feed
  drawer behind it, comment close, viewer close and feed/Dock restoration.
- Runtime PID `11036` returned `200` locally and over phone LAN. Cost, external
  egress and real funds remained zero. Local Clip gate PASS; independent T1 sign-off
  remains pending capacity reset.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-clip-continuity-v1.json`.

## 2026-08-29 — P2 Messaging authorization and recovery v1

- A High fail-open UI state was closed. The message composer, attachments, E2EE
  toggle, calls and meetings now start disabled and can be enabled only after the
  server confirms active membership and conversation/request state.
- Inbox transport errors are no longer displayed as a legitimate empty inbox.
  Inbox and thread have separate retry states; a failed thread also exposes a clear
  back path while every mutation remains disabled.
- The new-conversation dialog is focused on entry and closes with Escape or its
  explicit close controls without losing the inbox.
- Existing backend gates remain covered: Nexus username addressing, direct/group
  membership, request accept/decline, receipts, typing, disappearing messages,
  resumable validated attachments, device-covered E2EE text, local WebRTC direct
  calls and scheduled meetings. External sharing remains denied.
- Verification: focused core/static suite `84/84`; full suite `128/128`. Mobile QA
  at `390x844` confirmed unified box/persona filters, truthful empty state, dialog
  open and Escape close with inbox preservation.
- Runtime PID `11036` returned `200` locally and over phone LAN. Cost, external
  egress and real funds remained zero. Local Messaging gate PASS; independent T1
  sign-off remains pending capacity reset.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-messaging-journey-v1.json`.

## 2026-08-29 — P2 Live device check and private preview v1

- Two High truthfulness/privacy defects were closed. Audience, language and comment
  settings shown by Live Studio are now validated and persisted, and discovery now
  evaluates the stored Live audience through the shared deny-first Privacy Matrix
  instead of treating every verified session as public.
- A private Live regression test proves that the owner can discover the session
  while an unrelated viewer cannot. Synthetic actors remain excluded from organic
  viewer and follower counts.
- Device Check opens with the selfie camera, stays local, stops all tracks on every
  close path and removes its visibility listener. The dialog is focusable, closes
  with Escape, and never claims that an HTTP LAN origin can safely access camera or
  microphone.
- Public broadcast remains explicitly blocked (`GATED_NO_SFU`) until HTTPS, ingest/
  SFU and Live moderation are verified. The preview defaults to `private` and saving
  it does not start a transmission.
- Verification: JavaScript syntax PASS; focused core/static suite `84/84`; full
  suite `128/128`; migrated real database contains `visibility`, `language` and
  `comments_enabled` and reports `integrity_check=ok`. Mobile QA at `390x844`
  confirmed the truthful HTTPS gate, disabled save, explicit close and preserved
  Live screen.
- Runtime PID `12996` listens on `0.0.0.0:3000`; local and phone-LAN health PASS.
  Cost, external egress and real funds remained zero. Local Live preview gate PASS;
  production broadcast and independent T0/T1 sign-off remain pending formal gates.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-live-preview-v1.json`.

## 2026-08-29 — P3 shared visual foundation v1

- A final CSS layer now owns the shared Nexus visual hierarchy instead of allowing
  older experiments to win by source order. The phone wordmark remains large and
  legible, the three context switches fit beside it, and the five-destination Dock
  uses one safe-area-aware luminous arc with a circular Create node.
- Login now presents sign-in and account creation as two clearly separated glass
  surfaces. Empty credential fields, the simple `Creează cont` action and the
  truthful automatic-wallet note are preserved; no identity or wallet behavior was
  changed by this visual packet.
- Messages now has a compact security state, clear Conversation/Request/Sent tabs,
  persona filters and a bounded neural empty state. Live has a distinct arena
  hierarchy and retains its truthful verified-session empty state and device gate.
- Focus-visible treatment, reduced-motion behavior, phone breakpoints and the
  comments-without-Dock viewport are explicit in the finishing layer.
- Verification: static visual suite `22/22`; full suite `129/129`. Mobile DOM QA at
  `390x844` confirmed Messages, new-conversation open, Escape restoration and Live
  arena navigation. Runtime PID `12996` is healthy locally and over phone LAN.
- Cost, external egress and real funds remained zero. Local visual foundation gate
  PASS; independent visual review and T0/T1 release sign-off remain pending.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P03-visual-foundation-v1.json`.

## 2026-08-29 — P3 Profile and Account Center journeys v1

- The previous single, very long account page is now three bounded journeys:
  `Profil`, `Wallet & username`, and `Acces & securitate`. The first view remains
  the persona-specific profile; wallet and recovery details no longer compete with
  avatar, cover, bio and privacy editing.
- The Profile journey keeps the public preview, independent media/identity fields,
  profile kind, Orbit, visibility, paid-private controls and Near/language choices.
  Wallet owns the MultiversX address/assets and Nexus username. Access owns login
  factors, xPortal linking, sign-out, recovery policy and demo chain activity.
- Tabs expose selected state, inactive panels are `aria-hidden`, targets are at
  least 44px, and the navigation remains reachable while the active panel scrolls.
  Seed phrase/private keys remain absent; recovery remains wallet/xPortal based.
- Verification: JavaScript syntax PASS; static visual suite `23/23`; full suite
  `130/130`. Mobile browser QA at `390x844` switched through all three panels,
  confirmed isolation, and restored Profile without a navigation trap.
- Runtime PID `12996` remains healthy locally and over phone LAN. Cost, external
  egress and real funds remained zero. Local Profile gate PASS; independent visual
  and T0/T1 release review remains pending.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P03-profile-journeys-v1.json`.

## 2026-08-29 — Local release-readiness gate v1

- A High production information leak was closed: unauthenticated `/health` no
  longer exposes user/content counts or provider configuration in production.
  Local development retains diagnostics; a regression test proves the production
  response contains only service readiness and time.
- Production now requires an absolute `NEXUS_DATA_DIR`, explicit trusted-edge mode
  and `NEXUS_TRUST_PROXY=1`, in addition to the existing secret, HTTPS origin and
  WalletConnect attestation gates. This prevents an accidental app-relative data
  volume or a falsely declared proxy/rate-limit posture.
- `npm run release:check` now runs the complete deterministic suite, 1,000 isolated
  `SYSTEM_TEST` actors and a real production process against a temporary database.
  It verifies minimal health, insecure API denial and SQLite integrity, then
  removes the bounded temporary state.
- README and `.env.example` are now release-candidate runbooks rather than old demo
  claims. No placeholder production secret is committed; external HTTPS, edge,
  SFU, provider, legal and independent audit gates are named explicitly.
- Verification: release gate PASS on Node `24.19.0`, 13 test files, 1,000 actors,
  zero synthetic issues; full suite `132/132`; static release suite `24/24`.
  Runtime PID `12700` is healthy locally and over phone LAN.
- Local release-readiness PASS does not equal a public release. External gates
  remain closed and no deploy, external egress, real funds or incremental cost was
  used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-release-readiness-v1.json`.

## 2026-08-29 — P1 Activity Center and notification preferences v1

- Messages now includes `Activitate` beside Conversations, Requests and Sent. It
  is the single in-app Activity surface, while Messages remains the only persistent
  Dock badge and no notification button was added to the header.
- Notifications and preferences are isolated by Nexus profile. Users can control
  in-app type, preview privacy and quiet hours; Dating content is always generic.
  Security/System cannot be disabled. Push and email remain fail-closed behind
  provider and explicit-consent gates.
- Mark-one and mark-all are owner-scoped and idempotent. Repeated events of the
  same type/body group for five minutes without fabricating actor identity.
- A High restart regression was found during real-DB QA: the first schema revision
  created an index before the existing table received `persona`. Migration order
  was corrected and is now covered by an idempotent legacy-schema test.
- Verification: focused `3/3`, static `25/25`, full suite `136/136`; local release
  check PASS across 14 test files and 1,000 SYSTEM_TEST actors. Browser QA loaded
  all 12 preference types with zero console errors and zero external links.
  Runtime PID `4552` is healthy locally and at `http://192.168.1.153:3000/`.
- Completion status is now evidence-based in
  `planning/NX-WEB-SOCIAL-completion-gap-matrix.md`. Public beta remains blocked
  by sessions/devices logout-all, GDPR lifecycle, operational controls,
  reconciliation and independent T0/T1 review.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-notifications-v1.json`.

## 2026-08-29 — P1 sessions, devices and logout-all v1

- Account Center now lists every active session with only a coarse browser/platform
  label, active persona and timestamps. The current session is explicit; raw token
  hashes, device fingerprints and IP addresses never enter the response or UI.
- Revoking another session requires password or xPortal NativeAuth step-up. The
  current session cannot be removed through the wrong route. Logout-all revokes
  every session and leaves one security notification for the next safe login.
- Logout-all has its own credential-bound command receipt, so an exact retry still
  succeeds after the operation has deleted the very session that authorized it.
  Conflicting credential/key reuse fails closed.
- Existing sessions are migrated and receive a coarse label on their first
  authenticated read. Real database restart added all four columns and retained
  `PRAGMA integrity_check=ok`.
- Verification: focused `3/3`, static `26/26`, full suite `140/140`; release check
  PASS across 15 files and 1,000 SYSTEM_TEST actors. Browser QA confirmed the
  Account/Access journey without executing a destructive action on the real demo
  session. Runtime PID `16064`, local and phone LAN health PASS.
- The auth/sessions must-have is now `PASS_LOCAL` in the completion matrix. Real
  WalletConnect attestation and independent T0/T1 review remain production gates.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-sessions-devices-v1.json`.

## 2026-08-29 — P1 GDPR account lifecycle v1

- Account Center now provides a step-up protected, owner-only JSON export with a
  15-minute authenticated download window. Export fields are allow-listed; seed,
  private keys, keystore, password/provider subjects, session internals and other
  users' private payloads never enter the artifact.
- Account deletion requires the exact `DELETE NEXUS` phrase, explicit acknowledgement
  that confirmed on-chain data cannot be erased, and password/xPortal step-up. It
  revokes every other session, locks new social/economic mutations and leaves a
  30-day cancellable grace period.
- The purge worker is legal-hold aware and two-phase: exact content-addressed media
  deletion must complete before the database erasure is finalized. Failures remain
  retryable, and a minimal subject-hash tombstone prevents accidental re-import.
- A High shared-data defect was prevented: the existing conversation creator FK
  could cascade-delete other participants' messages. Ownership is now transferred
  before the departing author's own data is purged.
- Verification: focused `4/4`, static plus focused `30/30`, full suite `145/145`;
  release gate PASS across 16 files and 1,000 isolated SYSTEM_TEST actors. The
  destructive worker denied execution without both controls; its real-DB dry-run
  observed zero eligible accounts and mutated nothing.
- Browser QA on build `20260829-p1gdpr1` confirmed the active-state, export and
  double-confirmation UI with zero console errors. No export or deletion action
  was executed on the real demo account. Runtime PID `17800` is healthy locally
  and at `http://192.168.1.153:3000/`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-gdpr-lifecycle-v1.json`.

## 2026-08-30 — P1 emergency containment and recovery v1

- Added DB-backed controls for all mutations, UGC publishing, media upload, Live
  start and public discovery. Affected writes fail closed and idempotently while
  reads, reports, appeals, blocking and account-safety actions stay available.
- Public health changes only to `degraded`; incident reason codes and operator
  details remain private. Pause requires a scoped approval. Resume requires a
  distinct checker and appends a tamper-evident event-chain entry with hashed
  actor identities.
- Added an executable incident/recovery runbook with severity, roles, containment,
  evidence and human/legal notification boundaries. No production on-call or
  statutory reporting capability is claimed.
- The recovery drill uses a current-schema synthetic database in a verified OS
  temporary directory. SQLite online backup, fresh-target restore, canonical
  state hash, integrity and FK checks all pass; modified backups and occupied
  restore targets are denied. The demo database is never opened by the drill.
- Verification: controls `3/3`, recovery `2/2`, static `28/28`, full suite
  `151/151`; release check PASS across 18 files and 1,000 SYSTEM_TEST actors.
  All real controls remained active and no demo containment/restore was executed.
- Runtime PID `6396` reports `ready` locally and over phone LAN at
  `http://192.168.1.153:3000/`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-emergency-recovery-v1.json`.

## 2026-08-30 — P1 Action Ledger reconciliation v1

- Successful authenticated mutations now finalize the idempotency record, one
  ActionIntent and one hash-only Outbox event in the same nested-safe SQLite
  savepoint. A fault-injection test proves that an Outbox failure rolls back the
  mutation completion and intent together.
- `outcome_status` preserves the real product result separately from a bounded
  replay response. This closes the oversized-response case where a successful
  mutation could previously appear failed during reconciliation.
- Human actions remain `LOCAL_ACCEPTED_CHAIN_DISABLED`; `SYSTEM_TEST` is always
  `EXCLUDED_SYNTHETIC`, and impressions/read/typing are `EPHEMERAL_EXCLUDED`.
  The local Outbox handler acknowledges only the durable projection and cannot
  submit a transaction or set `CONFIRMED`.
- Unknown authenticated mutation routes become `UNCLASSIFIED_MUTATION` and force
  reconciliation `MISMATCH`, preventing a new endpoint from silently passing a
  release gate without registry review.
- A guarded local derived-state repair reconciled 52/52 historical mutations.
  Final report: zero missing, duplicates, orphaned/failed events, unclassified
  actions, invalid devnet rows or PII findings; chain claim remains explicitly
  `LOCAL_ONLY_NOT_CONFIRMED`.
- Verification: action-ledger `5/5`, static `29/29`, full suite `157/157`, release
  check PASS across 19 files and 1,000 isolated SYSTEM_TEST actors. SQLite
  integrity is `ok`, FK violations are zero, and runtime PID `9616` is ready on
  localhost and phone LAN at `http://192.168.1.153:3000/`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-action-ledger-reconciliation-v1.json`.

## 2026-08-30 — Device/browser/network matrix v1

- Client mutations now fail closed before fetch when the browser is offline and
  return an explicit `OFFLINE` non-success result on transport failure. GET uses
  the specified maximum of two bounded retries; mutations are never automatically
  replayed with a new key or represented as confirmed.
- The shared shell has an accessible offline banner. Nexus SSE closes offline and
  is re-established only after reconnection; the UI does not claim cached content
  is fresh or that server-required publication/payment/account changes succeeded.
- Deterministic tests cover insecure/missing WebRTC capability, phone/narrow-phone/
  landscape breakpoints, safe areas, reduced motion and network state. Full suite
  is `160/160`; release check passes 20 files plus 1,000 SYSTEM_TEST actors.
- Localhost and LAN root/health/assets returned `200`; the local self-signed HTTPS
  health probe also returned `200`. Runtime PID `7816` listens on `0.0.0.0`.
- Browser visual interaction was not executed: saved Browser policy denied access
  to the local origin. No alternate-browser or policy workaround was attempted.
  The matrix therefore remains open for a real phone/desktop pass on trusted HTTPS
  and independent T0/T1 review; no visual PASS is fabricated.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-device-browser-network-matrix-v1.json`.

## 2026-08-30 — P1 E2EE device lifecycle v1

- Closed a High session-theft denial risk: revoking a messaging encryption device
  now requires fresh password or xPortal step-up. Both the compatibility `DELETE`
  route and the UI-oriented `POST .../revoke` route fail closed and are protected
  by the authenticated mutation/idempotency boundary.
- Account inventory returns only device ID, coarse label, algorithm, status and
  timestamps. It no longer echoes public JWK material; the server never receives
  a private E2EE key. The Account Center now provides the same coarse inventory
  and irreversible revocation journey.
- Exact replay returns the original successful response and creates one security
  notification. A revoked device cannot be revived, cannot read its old envelope,
  and a newly registered device receives no retroactive envelope for historical
  ciphertext.
- Secure send still requires the exact active-device commitment and never silently
  downgrades. E2EE remains truthful: text is locally device-covered; attachment
  encryption, key backup/safety numbers and independent protocol review are not
  claimed and remain the next packet/external gate.
- Verification: focused/static/core `98/98`, full suite `162/162`; release check
  PASS across 20 files and 1,000 isolated SYSTEM_TEST actors with zero issues.
  Incremental cost, external network and real funds remained zero.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-device-lifecycle-v1.json`.

## 2026-08-31 — P1 E2EE attachment lifecycle v1

- Secure messaging can now encrypt an attachment in the browser with a random
  AES-256-GCM content key. Only the ciphertext container is uploaded through the
  existing resumable/idempotent transport; the content key and original metadata
  travel inside the exact per-device E2EE envelopes.
- Upload admission binds `message_e2ee_attachment` to the versioned Nexus opaque
  MIME and container marker. Cross-purpose substitution is denied. The server
  records `ready_client_encrypted` and `ciphertext_not_server_scannable`; it never
  represents the object as malware-scanned.
- The message transaction rechecks the active-device commitment, owned upload
  grant, persona and encrypted media boundary. Non-participants cannot read the
  ciphertext. New/revoked devices do not receive historical content-key envelopes.
- Recipients must explicitly choose to decrypt. Ciphertext hash, message/media ID,
  conversation metadata, AES-GCM AAD, filename, MIME and clear size are verified
  locally before a download link is created; the UI never auto-opens unscanned
  content.
- Known bounded gap: an upload that completes but loses the race against a changed
  device set can leave owner-readable orphan ciphertext until retention cleanup.
  It contains no server-readable plaintext, but the deterministic orphan purge and
  key backup/safety-number UX remain the next packet. Independent crypto T1 review
  is still mandatory before public release.
- Verification: full suite `166/166`; release check PASS across 21 files and 1,000
  isolated SYSTEM_TEST actors with zero issues. External network, real funds and
  incremental cost remained zero.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-attachment-lifecycle-v1.json`.

## 2026-09-02 — P1 E2EE group/member/device epoch rotation v1

- Every new E2EE text or attachment now binds its AES-GCM AAD and HKDF salt to
  both the exact active-device commitment and a composite key-epoch commitment.
  The latter covers the conversation membership epoch and each active member's
  account security epoch.
- Group accept, group remove/leave and direct-request accept rotate the
  conversation epoch in the same `BEGIN IMMEDIATE` transaction as membership.
  Pending invitations do not receive keys and do not trigger unnecessary
  rotation.
- Adding an active device, activating a recovery device or revoking an active
  device rotates the account epoch. This invalidates captured sends across every
  affected conversation without rewriting all conversation rows.
- A block/unblock transition rotates both affected account epochs. Any active
  blocked relationship freezes E2EE key material and send fail-closed until the
  relationship or membership is resolved; no device list is returned in that
  state.
- Idempotent nonce replay is bound to both epochs. A membership/device change
  between key-material fetch and commit is rejected atomically with no message
  row. New writes cannot downgrade to the legacy v1 binding; historical v1
  ciphertext remains decryptable after the additive migration.
- The independent checker found and closed block-policy bypasses in plaintext
  send/read, attachment URL access and pending-request acceptance; a malformed
  legacy-device availability fault; broad third-party epoch churn; and an
  under-bound client-nonce replay. The shared block gate now also covers delivery,
  typing, meetings and calls, while request replay commits to every accepted
  ciphertext envelope, sender device, attachment and expiry.
- Verification: targeted group/migration/API/attachment coverage PASS; full suite
  `188/188`; release check PASS across 22 files and 1,000 isolated SYSTEM_TEST
  actors; standalone 1,000-actor lab reports zero issues. Independent bounded
  checker verdict is `PASS_LOCAL` with 0 Critical / 0 High / 0 Medium. External
  network, real funds and incremental cost remained zero.
- This is an epoch-bound per-device envelope foundation, not a claim that the
  scalable group sender-key protocol or formal cryptographic audit is complete.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-group-key-rotation-v1.json`.

## 2026-09-03 — P1 E2EE scalable group envelope v1

- Group messages now encrypt the text/attachment-metadata payload once with a
  fresh random AES-256-GCM content key. Only that key is wrapped for every active
  device through the existing epoch-bound P-256 ECDH/HKDF/AES-GCM channel.
- Shared-payload AAD and per-device wrapper AAD bind conversation, nonce, sender
  and recipient device, exact device set, epoch, shared ciphertext hash and shared
  AAD hash. The recipient verifies every binding before local decryption.
- Groups reject the legacy direct-message wire mode; direct conversations reject
  the group mode. Replay requires an identical canonical request including mode,
  shared ciphertext, wrappers, attachment and expiry.
- One additive `message_shared_ciphertexts` table stores the single opaque payload.
  API reads return it only beside the authenticated requesting device's wrapper.
  Expiry removes both layers; block, membership, history and device boundaries
  remain fail-closed.
- Independent review found two Medium availability/DoS gaps and both were closed:
  the API limit now shares the valid `50 members × 10 devices = 500` bound (a
  210-device end-to-end API fixture passes), and corrupted DB ciphertext is size-
  checked before base64 decode and canonical/in-range checked before serialization.
- Verification: focused checker `49/49`, full suite `194/194`; release check PASS
  across 24 files and 1,000 isolated SYSTEM_TEST actors with zero issues. Checker
  verdict: `PASS_LOCAL`, 0 Critical / 0 High / 0 Medium remaining. External
  network, real funds and incremental cost remained zero.
- This is intentionally described as content-key fanout, not a ratcheting Signal
  Sender Keys implementation. Formal cryptographic audit, trusted-HTTPS real-
  device interoperability and performance near 500 wrappers remain release gates.
- Protocol: `planning/NX-WEB-SOCIAL-e2ee-group-envelope-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-group-envelope-scalability-v1.json`.

## 2026-09-03 — Local 500-device group E2EE performance observation

- Added a bounded, zero-network benchmark for the maximum valid 50-member ×
  10-device group. Five hundred distinct P-256 recipient keys are generated before
  timing; exact sorted/unique wrapper coverage and first/last-device decryption are
  required for a local pass.
- Latest owner run on Node `v24.19.0`: 4,000 text bytes / 4,046 encrypted JSON
  bytes, one 4,062-byte shared ciphertext, 151,000 wrapper-ciphertext bytes, 155,062
  ciphertext bytes total, 312.99 ms encryption and 2.19/1.09 ms sampled decryption.
  The old repeated-payload shape is estimated at 2,031,000 ciphertext bytes, making
  this observation a 13.1× ciphertext-only storage reduction.
- Independent checker reproduced a PASS (`282.14 ms`, `2.03/1.07 ms`, ~4.73 MB
  observed heap delta), verified the calculation and confirmed that 501 devices are
  rejected nonzero. Verdict: `PASS_LOCAL`, 0 Critical / 0 High / 0 Medium.
- Results are explicitly `NEXUS_GROUP_ENVELOPE_V1_LOCAL_NODE` with
  `real_device_claim:false`; no phone/browser performance claim is made. Trusted-
  HTTPS real-device testing remains an external release gate.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-group-500-performance-v1.json`.

## 2026-09-03 — Opt-in browser/device E2EE lab harness v1

- Added a secure-context browser harness for 1–500 distinct P-256 device keys,
  exact group-wrapper coverage and first/last-device decryption. It remains a
  diagnostic tool, not product navigation or a production approval mechanism.
- The HTML/module are available only when `NEXUS_DEVICE_LAB=true` outside
  production. Exact static allowlisting rejects traversal, encoded separators,
  backslashes, NUL, mixed-case Windows aliases and every unrelated diagnostics
  path before filesystem resolution; disabled/production requests return 404.
- Reports contain timings/counts and boolean gates only—never keys, ciphertext,
  browser fingerprint or persistent state. The harness initiates no network
  requests. Cancellation cannot publish or enable download after expensive crypto.
- Local desktop-browser observation: 50 distinct devices PASS with exact coverage,
  first/last decrypt, 22.2 ms encryption and zero console warnings/errors. A
  500-device UI run was cancelled safely with no downloadable result. The manual
  `Android` class was only a label; no real-phone claim is made.
- Verification: focused `3/3`, full suite `197/197`; release check PASS across 25
  files and 1,000 isolated `SYSTEM_TEST` actors with zero issues. Independent
  checker verdict is `PASS_LOCAL`, 0 Critical / 0 High / 0 Medium. External
  network, real funds and incremental cost remained zero.
- Trusted-HTTPS testing on representative Android/iOS/desktop devices, formal
  crypto audit and independent T0/T1 release approval remain external gates.
- Protocol/runbook: `planning/NX-WEB-SOCIAL-e2ee-device-lab-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-device-lab-v1.json`.

## 2026-09-03 — E2EE formal-audit preparation v1

- Added a reproducible `npm run audit:e2ee:inventory` source-shape inventory for
  the current direct, group, attachment and recovery constructions. It hashes 18
  categorized client/server/schema/storage/privacy/test artifacts and validates
  28 construction-scoped markers with exact evidence lines.
- The audit brief now maps algorithms, protected assets, trust boundaries,
  adversaries, current claims, non-claims, required auditor attacks and release
  decisions. It explicitly documents server public-key substitution risk, static
  ECDH compromise impact, lack of ratchet/forward secrecy/PCS and visible metadata.
- Disappearing-message expiry is documented accurately: the server validates,
  commits and enforces it, but it is not inside client AEAD and is not
  cryptographically authenticated against a compromised server.
- Independent review found three initial and two residual Medium audit-readiness
  gaps. All were closed by expanding the artifact manifest, separating direct,
  group-shared, group-wrapper and recovery scopes, anchoring private-JWK rejection
  in actual API/repository logic, including browser recovery tests and removing
  stale hard-coded marker counts.
- Verification: inventory `28/28`, focused `2/2`, full suite `199/199`; release
  check PASS across 26 files and 1,000 isolated `SYSTEM_TEST` actors with zero
  issues. Final checker verdict: `PASS_LOCAL`, 0 Critical / 0 High / 0 Medium.
  External network, real funds and incremental cost remained zero.
- This packet is audit preparation, not a cryptographic audit. Production E2EE
  remains blocked pending a qualified formal independent audit and representative
  trusted-HTTPS real-device testing.
- Audit brief: `planning/NX-WEB-SOCIAL-e2ee-crypto-audit-brief-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-e2ee-audit-readiness-v1.json`.

## 2026-09-03 — P3 accessibility and responsive interaction audit v1

- Added one shared modal manager for focus containment, exact background
  `inert`/`aria-hidden` isolation and opener restoration. It supports nested
  dialogs, keyboard activation and excludes controls below hidden/inert/non-
  rendered ancestors.
- Removed conflicting manual app isolation from the media viewer and moderation
  sheets. Runtime fake-DOM regressions cover synchronous focus before observer
  delivery, open/close restoration, nested close and hidden controls.
- Extended focus-visible, coarse-pointer 44px target overrides, high-contrast
  preference and preserved reduced-motion behavior. Application asset versions
  were advanced to prevent a phone reload from retaining older CSS/JS.
- The independent checker found 1 High and 6 Medium issues across repeated
  review rounds; all reported code/test findings were remediated. Its final
  post-fix rerun reproduced syntax, focused, full-suite and release evidence,
  reverified all seven artifact hashes and returned `PASS_LOCAL`, with 0
  Critical / 0 High / 0 Medium findings.
- Verification: syntax PASS, focused `42/42`, full suite `205/205`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- Automated browser access to localhost was denied by a saved local permission.
  Therefore WCAG conformance, computed mobile styles and representative real-
  device accessibility remain unclaimed external/T1 gates.
- Runbook: `planning/NX-WEB-SOCIAL-accessibility-responsive-audit-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P03-accessibility-responsive-v1.json`.

## 2026-09-04 — Interface locale, content language and Near consent v1

- Added a per-persona interface resolver and bounded Romanian, English, Polish and
  Arabic catalogue for the persistent Social header/dock/feed labels. Explicit
  account choice wins; `auto` uses device/browser languages only, never IP, region,
  GPS or inferred nationality. Arabic applies RTL document semantics.
- Persona switch and profile save apply `lang`, `dir` and translated navigation
  immediately. Content-language ranking preferences remain a separate field.
- The API now rejects malformed/non-array/over-limit content-language lists instead
  of silently filtering them. Near consent is strictly boolean and cannot be enabled
  or remain enabled after its explicit region is cleared.
- Verification: syntax PASS, focused `107/107`, full suite `206/206`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- Browser navigation to localhost remained denied by the saved local permission, so
  visual RTL/layout fit and real-device rendering are not claimed.
- Independent review found one Medium semantic isolation issue: an empty Near lens
  could render unfiltered demo clips. Demo fallback is now restricted to the initial
  For You surface; empty non-For-You lenses also clear stale feed interaction state.
- A second Medium review finding showed that disabled Breaking and Near consent
  prompts could retain previous feed authors for relation suggestions. A shared
  fail-closed reset now covers API failure, provider-disabled, consent-required and
  empty-feed exits.
- Final checker verdict after remediation: `PASS_LOCAL`, 0 Critical / 0 High / 0
  Medium. Focused tests remain `107/107`, full suite `206/206`, and the release gate
  remains PASS with 1,000 isolated `SYSTEM_TEST` actors and zero issues.
- Runbook: `planning/NX-WEB-SOCIAL-locale-content-near-consent-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-locale-content-near-consent-v1.json`.

## 2026-09-04 — Localized Feed and Relations sheets v1

- Localized the Social Feed selector and Quick Relations sheet in RO/EN/PL/AR,
  including descriptions, tabs, loading/error/empty states, follow-request actions,
  favorite actions, accessibility labels and relationship-kind labels.
- Added catalogue-parity enforcement, matching cache generations for the app and
  locale module, BDI isolation for names/handles in RTL, latest-request invalidation
  for overlapping tabs and single-flight request mutations with authoritative refresh.
- Independent review found six Medium issues across truthful errors, async ordering,
  RTL identity display, stale mutation navigation, localized errors and concurrent
  mutations. All were remediated; final verdict `PASS_LOCAL`, 0 Critical / 0 High /
  0 Medium unresolved.
- Verification: syntax PASS, focused `110/110`, full suite `209/209`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- Native-language approval and representative trusted-HTTPS RTL/LTR device testing
  remain external gates; no production provider or release gate was enabled.
- Runbook: `planning/NX-WEB-SOCIAL-localized-feed-relations-sheets-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-localized-feed-relations-sheets-v1.json`.

## 2026-09-04 — Localized Feed states and post actions v1

- Localized the primary feed failure/disabled/consent/empty states and the main
  in-feed author, follow, reaction, comment drawer, save, repost/retweet, audio,
  recommendation feedback and creator-action controls in RO/EN/PL/AR.
- Replaced raw backend error/reason output on these primary surfaces with stable
  catalogue messages and advanced the app/locale cache generation together.
- External sharing remains fail-closed; no external application intent or provider
  was enabled.
- Verification: syntax PASS, focused `110/110`, full suite `209/209`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- A separate checker was unavailable after its capacity limit, so the honest local
  verdict is `PASS_LOCAL_PRIMARY_REVIEW_PENDING`, not an independent T0/T1 pass.
- Full-screen viewer, deep comment management and remaining authenticated screens
  are explicitly outside this bounded packet and remain in the localization queue.
- Runbook: `planning/NX-WEB-SOCIAL-localized-feed-states-post-actions-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-localized-feed-states-post-actions-v1.json`.

## 2026-09-04 — Localized full-screen viewer and comments v1

- Localized the continuous full-screen viewer and comment conversation surface in
  RO/EN/PL/AR, including author/actions, reaction tray, audio, loading/error/empty,
  reply/edit/withdraw/report and mutation feedback.
- Comments now distinguish failure from empty, expose Retry without raw backend
  text and provide a cancel-Reply path that clears the parent and restores the
  normal composer.
- Replaced the misleading viewer ellipsis/direct-report behavior with an adjacent
  internal Not interested/Report menu, closable by selection, outside click or
  Escape. External share remains disabled.
- Fixed a full-suite accessibility regression by binding the localized dialog name
  through a stable `aria-labelledby` target.
- Verification: syntax PASS, focused `116/116`, full suite `209/209`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The separate worker remained capacity-limited, so the result is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; no independent T0/T1 pass is claimed.
- Runbook: `planning/NX-WEB-SOCIAL-localized-fullscreen-viewer-comments-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-localized-fullscreen-viewer-comments-v1.json`.

## 2026-09-04 — Localized Trust and moderation sheets v1

- Localized Trust Lens, author dispute, report categories/results and automated
  pre-publication reconsideration in RO/EN/PL/AR.
- Replaced raw backend error/meaning output with stable catalogue messages. Known
  machine codes map to controlled explanations; unknown codes get a generic
  non-verdict context explanation and malformed assessments fail closed.
- Preserved the safety truth boundary: no truth percentage, `Fake?` is community
  opinion, provenance is not independent verification, and a successful automated
  review only updates the draft before a separate Publish confirmation.
- Verification: syntax PASS, focused `116/116`, full suite `209/209`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited; verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`, not legal/safety/T0/T1 approval.
- Runbook: `planning/NX-WEB-SOCIAL-localized-trust-moderation-sheets-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-localized-trust-moderation-sheets-v1.json`.

## 2026-09-04 — Localized Create, camera and drafts v1

- Localized the central Create Hub, composer entry context, camera permission/
  recovery states and browser-local draft library in RO/EN/PL/AR.
- Draft deletion now verifies both owner and persona; IndexedDB failure is distinct
  from empty and has Retry.
- Capture attachment failure now stops camera/microphone tracks before returning an
  error, and throwing/unsupported `MediaRecorder` fails cleanly. HTTP LAN keeps a
  truthful native-picker fallback instead of claiming live preview.
- Verification: syntax PASS, focused `116/116`, full suite `209/209`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Trusted-HTTPS Android/iOS camera testing is
  still an external gate.
- Runbook: `planning/NX-WEB-SOCIAL-localized-create-camera-drafts-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-create-camera-drafts-v1.json`.

## 2026-09-04 — Resumable upload and publish recovery v1

- Persisted the upload create idempotency key before dispatch and preserved stable
  create, part and completion keys across ambiguous responses and retries.
- Status failures no longer erase uncertain resume state. Completed sessions replay
  completion, terminal sessions restart only after authoritative confirmation and
  malformed protocol responses fail closed before byte upload.
- Social publication now reuses one mutation key for unchanged content, rotates it
  after edits, blocks duplicate submit and exposes localized recoverable errors.
- Composer, messaging/E2EE attachment and profile-media callers catch bounded upload
  failures; raw backend errors are not exposed on the updated surface.
- Verification: syntax PASS, focused `116/116`, full suite `210/210`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Real-device interruption/storage pressure
  and production multipart object storage remain external gates.
- Runbook: `planning/NX-WEB-SOCIAL-resumable-upload-publish-recovery-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-resumable-upload-publish-recovery-v1.json`.

## 2026-09-04 — Localized Creator Studio v1

- Localized Creator Studio controls, preview alternatives and rendered manifest/
  creator-audio proof in RO/EN/PL/AR with catalogue parity.
- Added preflight before upload for media/audio MIME allowlists, 20 MB audio limit,
  required media and rights declaration, and bounded 0–180 second video trim.
- Invalid files are not previewed and FileReader failure now returns a recoverable
  localized error. Server canonicalization and manifest hash binding remain
  authoritative.
- Preserved truthful scope: local non-destructive rendering only, without claims of
  muxing, transcoding, licensed catalogue or verified rights ownership.
- Verification: syntax PASS, focused `116/116`, full suite `210/210`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device codecs and visual locale matrix
  remain external gates.
- Runbook: `planning/NX-WEB-SOCIAL-localized-creator-studio-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-creator-studio-v1.json`.

## 2026-09-04 — Localized Live Studio v1

- Localized the private Live Studio setup, device controls, permission/recovery
  states, metadata and result copy in RO/EN/PL/AR with catalogue parity.
- Added a latest-request gate around `getUserMedia`: stale flip/retry/close results
  are rejected and all stale tracks are stopped.
- Saving now requires live video and audio tracks, reacts fail-closed when either
  track ends, uses a stable content-bound idempotency key and blocks duplicate
  submissions. Optional audio metering can no longer tear down a valid session.
- Preserved the truth boundary: metadata-only private preview; no broadcast, SFU,
  TURN or production moderation claim.
- Verification: syntax PASS, focused `114/114`, full suite `210/210`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; trusted-HTTPS real-device camera testing is
  still an external gate.
- Runbook: `planning/NX-WEB-SOCIAL-localized-live-studio-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-live-studio-v1.json`.

## 2026-09-04 — Localized Live discovery and competitions v1

- Localized Live discovery, Following, Battle, Championships and competition-draft
  states in RO/EN/PL/AR, including locale-aware numbers and dates.
- Malformed collection data now becomes a safe empty state; unknown statuses,
  dates and prize policies use controlled labels rather than raw server values.
- Competition drafts now use a stable edit-bound idempotency key, block duplicate
  submission and convert validated phone-local date/time to an explicit UTC instant.
- Removed raw backend reason/error rendering and added Escape close, focus entry and
  an announced result region to the draft modal.
- Preserved the truth boundary: only server-filtered organic state is shown; public
  broadcast, paid voting, prizes and SFU/TURN remain disabled.
- Verification: syntax and raw-copy audit PASS, focused `114/114`, full suite
  `210/210`; release check PASS across 27 files and 1,000 isolated `SYSTEM_TEST`
  actors with zero issues. External network, real funds and cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device linguistic/RTL review remains.
- Runbook: `planning/NX-WEB-SOCIAL-localized-live-discovery-competitions-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-live-discovery-competitions-v1.json`.

## 2026-09-04 — Localized Messages shell v1

- Localized the unified inbox shell, boxes, profile filters, E2EE disclosure,
  loading/error/empty states and conversation summaries in RO/EN/PL/AR.
- Added a latest-request gate and immutable section/filter snapshots so a delayed
  response can never overwrite the current Messages selection.
- Malformed collections fail closed; interactive conversations require a positive
  safe-integer ID, while participants, previews and unread counts are normalized.
- Removed raw backend error rendering and added tab semantics plus an announced
  loading/result region. Privacy Matrix enforcement remains server-authoritative.
- Verification: syntax PASS, focused `115/115`, full suite `211/211`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; native/real-device locale review remains.
- Runbook: `planning/NX-WEB-SOCIAL-localized-messages-shell-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-messages-shell-v1.json`.

## 2026-09-04 — Localized conversation creator v1

- Localized direct/group conversation creation in RO/EN/PL/AR, including guidance,
  validation, progress and controlled failure states.
- Added username normalization/syntax validation, exact direct cardinality, minimum
  distinct group membership and group-name preflight; server Privacy Matrix remains
  authoritative.
- Added one edit-bound idempotency key, duplicate-submit protection, detached-dialog
  completion rejection and positive safe-integer response-ID validation.
- Raw backend errors are no longer rendered on this surface; E2EE was unchanged.
- Verification: syntax PASS, focused `116/116`, full suite `212/212`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; native/real-device locale review remains.
- Runbook: `planning/NX-WEB-SOCIAL-localized-conversation-creator-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-conversation-creator-v1.json`.

## 2026-09-04 — Thread load and send recovery v1

- Added latest-request protection across conversation/device/key/message loading;
  closing a thread invalidates pending work and stale responses cannot overwrite it.
- Guarded malformed conversation, participant, message, receipt, meeting, call and
  typing collections before rendering or interaction.
- Localized the initial composer controls and recovery copy in RO/EN/PL/AR while
  preserving deny-by-default membership and Privacy Matrix admission.
- Plaintext send now retains one edit-bound idempotency key and client nonce, blocks
  double submit and ignores detached completion. Read receipts use a deterministic
  key bound to the latest visible message frontier.
- Verification: syntax PASS, focused `117/117`, full suite `213/213`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device ambiguous E2EE recovery remains.
- Runbook: `planning/NX-WEB-SOCIAL-thread-load-send-recovery-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-thread-load-send-recovery-v1.json`.

## 2026-09-05 — Localized secure thread content v1

- Localized request decisions, message content, E2EE safety, attachment states and
  direct-call capability copy in RO/EN/PL/AR with catalogue parity.
- Restricted plain attachment rendering to exact content-addressed internal media
  paths; external, absolute and malformed URLs now fail closed.
- Made accept/decline decisions single-flight and replay-safe with stable visible
  action keys, detached-completion rejection and controlled errors.
- Tracked decrypted attachment object URLs and revoked them on thread reload/close;
  malformed missing-device collections can no longer break readiness rendering.
- Verification: syntax PASS, focused `13/13`, full suite `214/214`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; native device/RTL and formal crypto review
  remain external gates.
- Runbook: `planning/NX-WEB-SOCIAL-localized-thread-content-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-thread-content-v1.json`.

## 2026-09-05 — Localized meeting and group administration v1

- Replaced prompt-based meeting/group actions with accessible Nexus dialogs and
  localized all states in RO/EN/PL/AR.
- Fixed the group-management authorization control so a loaded active owner/admin
  can use it while all other memberships remain disabled and backend-authoritative.
- Added action-specific title/username/member/date/duration validation, stable
  edit-bound mutation keys, single-flight submit and stale-dialog rejection.
- Kept invitations inside Nexus; no external calendar, messenger or share route was
  enabled. Raw backend errors are mapped to controlled recovery copy.
- Verification: syntax PASS, focused `5/5`, full suite `215/215`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device locale/accessibility review and
  production call infrastructure remain external gates.
- Runbook: `planning/NX-WEB-SOCIAL-localized-meeting-group-admin-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-meeting-group-admin-v1.json`.

## 2026-09-05 — Localized Activity Center v1

- Localized Activity loading, categories, unread/empty states and preference
  controls in RO/EN/PL/AR with locale-aware counts and catalogue parity.
- Added an independent latest-request gate so delayed Activity responses cannot
  overwrite a newly selected Messages tab or profile filter.
- Guarded notification/preference collections, positive IDs, known types, preview
  modes and quiet-hour pairs before they become interactive.
- Read-one, read-all and preference mutations now retain stable intent keys, block
  duplicate submission and reject detached/stale completion. Raw API errors are
  no longer rendered.
- Dating preview remains generic; Security/System stay mandatory; push/email and
  every external share channel remain blocked.
- Verification: syntax PASS, focused `3/3`, full suite `216/216`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- The independent worker remained capacity-limited, so the verdict is
  `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; native-device linguistic/visual review is
  still external.
- Runbook: `planning/NX-WEB-SOCIAL-localized-activity-center-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-activity-center-v1.json`.

## 2026-09-05 — Localized Profile shell v1

- Localized Profile loading/retry, section tabs and own-profile preview in
  RO/EN/PL/AR with locale-aware counters and catalogue parity.
- Bound Profile loads to a latest-request generation, selected persona and attached
  viewport so stale results cannot cross a rapid profile/screen switch.
- Made the public profile mandatory/fail-closed and converted an unavailable Account
  response into an explicit offline-safe shape rather than partial wallet claims.
- Guarded counts, post collections and positive IDs; avatar, cover and post preview
  media now render only from exact internal content-addressed paths.
- Verification: syntax PASS, focused `2/2`, full suite `217/217`; release check
  PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; independent/native-device review
  remains external because the worker is capacity-limited.
- Runbook: `planning/NX-WEB-SOCIAL-localized-profile-shell-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-profile-shell-v1.json`.

## 2026-09-05 — Localized profile edit and Privacy Matrix v1

- Localized profile identity, visibility, message policy, languages, Near consent,
  private-access settings and all save/recovery states in RO/EN/PL/AR.
- Bound the entire asynchronous save journey to the selected persona and attached
  form so delayed uploads cannot write across Social/Work/Dating/Travel/Market.
- Added one edit-bound idempotency key, duplicate-submit protection and bounded
  validation for enums, locales, region, languages, price and duration.
- Restricted existing and uploaded avatar/cover URLs to exact internal media paths;
  resumable upload stays active and raw backend errors are never displayed.
- Verification: syntax PASS, focused `3/3`, full suite `218/218`; release check PASS
  across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues. External
  network, real funds and incremental cost remained zero.
- Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; independent/native-device review
  and real payment settlement remain external gates.
- Runbook: `planning/NX-WEB-SOCIAL-localized-profile-edit-privacy-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-profile-edit-privacy-v1.json`.

## 2026-09-05 — Localized wallet and Nexus username v1

- Localized wallet identity, balances, receive-funds truth, Nexus username and copy
  recovery states in RO/EN/PL/AR with catalogue parity.
- Funding UI now requires a successful Account response, exact MultiversX address
  shape and explicit capability; real transfer and xMoney/on-ramp remain gated.
- Username save validates locally, retains one edit-bound idempotency key, blocks
  duplicate dispatch and verifies attached screen/persona plus exact response value.
- Asset rendering rejects malformed/unbounded/non-positive rows, and clipboard
  fallback no longer claims success when copying fails.
- Verification: syntax/catalogue PASS, focused `2/2`, full suite `219/219`; release
  check PASS across 27 files and 1,000 isolated `SYSTEM_TEST` actors with zero issues.
  External network, real funds and incremental cost remained zero.
- Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; production balances, on-ramp,
  transaction signing, trusted HTTPS and independent review remain gated.
- Runbook: `planning/NX-WEB-SOCIAL-localized-wallet-username-v1.md`.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-wallet-username-v1.json`.

## 2026-09-05 — Localized Account sessions v1

- Added RO/EN/PL/AR inventory/revoke states, latest-request protection and strict
  response validation with exactly one current session and a 100-row cap.
- Password revoke now has an explicit stable key, single-flight and detached/persona
  guards; raw errors are controlled. xPortal step-up remains authoritative.
- Verification: focused `2/2`, full `220/220`, release PASS with 1,000 isolated
  actors and zero issues; no external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-account-sessions-v1.json`.

## 2026-09-05 — E2EE device and recovery UI hardening v1

- Localized E2EE inventory states and added stale/persona, shape, duplicate, size,
  algorithm, status and timestamp guards before devices become interactive.
- Added explicit stable revoke keys, single-flight and detached completion checks.
- Recovery now admits bounded JSON only, clears expired capabilities before use and
  never renders raw cryptographic/provider errors; protocol code was unchanged.
- Verification: focused `4/4`, full `221/221`, release PASS with 1,000 isolated
  actors and zero issues; no external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-e2ee-device-recovery-ui-v1.json`.

## 2026-09-05 — GDPR lifecycle UI hardening v1

- Bound deletion/export loads to one latest request, attached view and persona;
  validated states, timestamps and collections before rendering.
- Restricted download navigation to expiring same-origin export IDs and 20 rows.
- Export, schedule and cancel now use stable explicit keys, single-flight and stale
  completion guards; no raw errors, deletion or purge was executed.
- Verification: focused `2/2`, full `222/222`, release PASS with 1,000 actors and
  zero issues; no external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-gdpr-lifecycle-ui-v1.json`.

## 2026-09-05 — Email auth client replay safety v1

- Login and signup now use explicit intent-bound idempotency keys, single-flight,
  local validation and detached-view guards; raw backend errors stay hidden.
- Signup retries reuse the same challenge and proof. The encrypted device wallet
  remains pending until the exact server-confirmed address/session is returned,
  with authenticated lost-response recovery for that address only.
- Rebuilt both local auth clients; focused `3/3`, full `223/223`, release PASS with
  1,000 isolated actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-email-auth-client-replay-safety-v1.json`.

## 2026-09-05 — Localized authentication shell v1

- Localized visible login, signup, account-created, recovery and xPortal states
  in RO/EN/PL/AR; device locale is applied before login and profile preference
  remains authoritative after login.
- Sanitized provider capability survives navigation back from recovery/xPortal.
  External WalletConnect errors map to controlled cancellation/timeout/failure
  states instead of being rendered verbatim.
- Locale coverage PASS; focused `4/4`, full `224/224`, release PASS with 1,000
  isolated actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-auth-shell-v1.json`.

## 2026-09-05 — Localized GDPR lifecycle shell v1

- Localized visible export/deletion explanations, step-up controls, lifecycle
  status, export rows, confirmations and success/failure states in RO/EN/PL/AR.
- Preserved latest-request/persona guards, strict response validation, same-origin
  download allowlisting, stable mutation keys and single-flight execution.
- Verification: locale coverage PASS; focused `1/1`, full `224/224`, release PASS
  with 1,000 isolated actors and zero issues. No deletion/purge, external network,
  real funds or incremental cost was used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-gdpr-lifecycle-shell-v1.json`.

## 2026-09-05 — Localized Account security shell v1

- Localized provider status, xPortal linking, custody guidance, sessions/E2EE
  inventory, recovery controls, revocation step-up, logout and chain activity in
  RO/EN/PL/AR; translated values are escaped at the HTML boundary.
- Cryptographic protocol, recovery scope, authorization and revocation semantics
  were not changed; private keys, raw fingerprints and IP data remain hidden.
- Verification: syntax and locale contract PASS; focused `1/1`, full `225/225`,
  release PASS with 1,000 isolated actors and zero issues. No external network,
  real funds or incremental cost was used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-account-security-shell-v1.json`.

## 2026-09-05 — Localized E2EE recovery actions v1

- Localized pending activation, bounded-file admission, passphrase/consent,
  generation/download, explicit activation, expiry, restore and error states in
  RO/EN/PL/AR, together with logout-all confirmation and failure copy.
- Removed raw backend error rendering from logout-all while preserving recovery
  scope, local encryption, admission limits, expiry and stale/persona guards.
- Verification: syntax/locale coverage PASS; focused `3/3`, full `226/226`, release
  PASS with 1,000 isolated actors and zero issues. No external network, funds or
  incremental cost was used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-e2ee-recovery-actions-v1.json`.

## 2026-09-05 — Localized device wallet and xPortal relink v1

- Localized device-wallet availability/recovery guidance, session xPortal step-up,
  wallet relink controls and QR accessibility labels in RO/EN/PL/AR.
- Custody, local key storage and xPortal protocol behavior were unchanged; no
  provider, chain endpoint or real credential was contacted.
- Verification: syntax/locale coverage PASS; focused `1/1`, full `227/227`, release
  PASS with 1,000 isolated actors and zero issues. No network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-device-wallet-xportal-relink-v1.json`.

## 2026-09-05 — Localized connectivity shell v1

- Localized the global offline warning and restored-connection notice in
  RO/EN/PL/AR and resynchronized the banner whenever the profile locale changes.
- Preserved fail-closed offline behavior, including closing the live event stream
  and blocking publishing, payments and account changes.
- Verification: syntax/locale coverage PASS; focused `1/1`, full `228/228`, release
  PASS with 1,000 isolated actors and zero issues. No external network or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-localized-connectivity-shell-v1.json`.

## 2026-09-05 — Public profile overlay hardening v1

- Localized the public-profile overlay in RO/EN/PL/AR and added a dedicated
  latest-request gate plus attached-view/active-persona checks.
- Validated identity, visibility, counters, bounded post rows and canonical internal
  avatar/cover/post media before rendering. Malformed data fails closed.
- The first regression run found a static accessible-name gap; replaced the dynamic
  label with a persistent `aria-labelledby` target and re-ran the modal gate `6/6`.
- Verification: focused `1/1`, full `229/229`, release PASS with 1,000 actors and
  zero issues. No external network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-public-profile-overlay-hardening-v1.json`.

## 2026-09-05 — Follow action replay safety v1

- Made shared Follow/Unfollow single-flight with an explicit stable idempotency key;
  failed/lost-response retries reuse it and confirmed intents rotate it.
- Added target/persona/response guards, detached-view protection and synchronized
  every visible Follow control for the target. Devnet hashes are shape-checked.
- Verification: focused `1/1`, full `230/230`, release PASS with 1,000 isolated
  actors and zero issues. No external network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-follow-action-replay-safety-v1.json`.

## 2026-09-05 — Follow request replay safety v1

- Added stable explicit idempotency keys across refresh for incoming Accept/Decline
  and outgoing Cancel, retaining existing single-flight protection.
- Capped lists at 80, bound requests to the active persona, confined avatars to
  internal media and required exact decision/cancel response values.
- Verification: focused `1/1`, full `231/231`, release PASS with 1,000 isolated
  actors and zero issues. No external network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-follow-request-replay-safety-v1.json`.

## 2026-09-05 — Relations and Favorites integrity v1

- Validated relation kind, 80-row bound, identity, relation/follow state and
  canonical internal avatar media before rendering Followers/Following/Favorites.
- Normalized device-local Favorites to 500 unique safe IDs and made storage errors
  failure-honest with controlled RO/EN/PL/AR copy.
- Verification: syntax/locale coverage PASS; focused `1/1`, full `232/232`, release
  PASS with 1,000 isolated actors and zero issues. No network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-relations-favorites-integrity-v1.json`.

## 2026-09-05 — Social Search result integrity v1

- Added latest-request and active-Social-persona guards so delayed responses cannot
  replace a newer query or render after a profile switch.
- Required exact query/scope/privacy/synthetic flags, capped profiles and posts at
  20 each, and validated identity, author binding, visibility, reactions and
  canonical internal media before rendering.
- Reused the hardened public-profile overlay and bound full-screen media navigation
  to the search result set instead of stale feed state.
- Verification: syntax/locale coverage PASS; focused `1/1`, full `233/233`, release
  PASS with 1,000 isolated actors and zero issues. No network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-social-search-result-integrity-v1.json`.

## 2026-09-05 — Unified message badge integrity v1

- Bound unread badge refreshes to the authenticated user and latest request, and
  invalidated pending work when returning to the unauthenticated landing screen.
- Added API query scope and privacy markers; the client requires `all/inbox`, caps
  100 unique conversations, bounds unread values and preserves the last verified
  value on malformed or failed responses.
- Verification: focused client and API checks `2/2`, full `234/234`, release PASS
  with 1,000 isolated actors and zero issues. No network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-message-badge-integrity-v1.json`.

## 2026-09-05 — Inbox result integrity v1

- Required exact inbox filter/box and server privacy scope, at most 100 unique
  conversations, and a complete fail-closed summary contract before rendering.
- Validated viewer membership, 50-member maximum, unique participant identities,
  roles/states, internal avatars, direct-message cardinality, unread values and
  last-message sender/status. Malformed data now shows the localized retry state.
- Verification: focused `1/1`, full `234/234`, release PASS with 1,000 isolated
  actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-inbox-result-integrity-v1.json`.

## 2026-09-05 — Conversation creation integrity v1

- Enforced valid conversation kinds, maximum 49 recipients plus creator, no self
  recipient and no implicit creation of a missing recipient persona.
- Bound successful UI navigation to the active persona and exact normalized
  kind/title/recipient set returned by the API, plus the complete validated
  conversation summary and participant set.
- Preserved single-flight and the same stable idempotency key for uncertain retries;
  added controlled limit/self guidance in RO/EN/PL/AR.
- Verification: focused `2/2`, full `234/234`, release PASS with 1,000 isolated
  actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-conversation-creation-integrity-v1.json`.

## 2026-09-05 — Thread response integrity v1

- Bound the active-thread response to the exact conversation, optional device and
  current viewer persona, with an explicit server privacy marker.
- Validated the complete conversation, ordered unique messages, sender and receipt
  membership, internal attachments, E2EE wrappers, meetings, calls and typing rows.
  Any malformed row now fails the whole response into a recoverable retry state;
  meeting reads are bounded to 100 rows.
- Verification: syntax PASS; focused `2/2`, audit `61/61`, full `234/234`, release
  PASS with 1,000 isolated actors and zero issues. No external network, real funds
  or incremental cost was used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-thread-response-integrity-v1.json`.

## 2026-09-06 — Thread mutation result integrity v1

- Bound plaintext/E2EE message success to conversation, sender, active persona,
  stable nonce, encryption mode and exact attachment; preserved edits made while an
  older send was in flight.
- Bound Accept/Decline to the exact conversation/actor/persona/decision and denied
  cross-profile decisions. Read acknowledgement now supplies the exact visible
  message boundary and updates receipt/head state atomically and monotonically.
- Verification: syntax PASS; focused `4/4`, full `234/234`, release PASS with 1,000
  isolated actors and zero issues. No external network, real funds or incremental
  cost was used.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-thread-mutation-result-integrity-v1.json`.

## 2026-09-06 — Thread auxiliary mutation integrity v1

- Denied typing, group administration and meeting scheduling whenever the active
  profile differs from the conversation profile; responses now bind exact actor,
  persona, conversation and requested action.
- Added stable bounded typing keys and strict UI result/resource validation for
  group and meeting actions, including detached-view and profile-switch guards.
- Bound direct-call start/decision/signal/end to explicit replay keys and validated
  call identity, participants, profile, mode and state. Signal replay now preserves
  the truthful already-delivered outcome while storing hashes only.
- Verification: syntax PASS; focused PASS; full `235/235`; release PASS with 1,000
  isolated actors and zero issues. No external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-thread-auxiliary-mutation-integrity-v1.json`.

## 2026-09-06 — Realtime recipient integrity v1

- Bound message, typing and call SSE events to exact recipient and active persona;
  stale stream generations, malformed/oversized payloads and profile switches fail
  closed before UI or call state changes.
- Reconnects SSE after persona switching and validates the authenticated stream
  handshake against captured viewer identity.
- Replaced plaintext message-row broadcasts with minimal invalidations; message
  bodies are fetched only through Privacy Matrix-protected reads.
- Verification: syntax PASS; focused PASS; full `236/236`; release PASS with 1,000
  isolated actors and zero issues. No external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-realtime-recipient-integrity-v1.json`.

## 2026-09-06 — E2EE device mutation integrity v1

- Bound device inventory, registration, recovery provisioning/activation and
  revocation to the authenticated owner, exact device and requested action.
- Added stable replay keys, prevented identity rotation after uncertain failures,
  and accepted local key changes only after exact fail-closed server results.
- Rejected owner-mismatched, secret-bearing or malformed device inventory/results.
- Verification: syntax PASS; focused device/recovery/API checks PASS; full
  `237/237`; release PASS with 1,000 isolated actors and zero issues. No external
  network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-e2ee-device-mutation-integrity-v1.json`.

## 2026-09-06 — E2EE key-material integrity v1

- Denied key-material reads when the authenticated active profile differs from the
  conversation profile and exposed an exact server-side privacy scope.
- Added bounded participant/device validation, local SHA-256 commitment replay,
  current-device coverage and consistent fail-closed state validation before use.
- Fixed the secure-send owner propagation regression revealed by packet 079.
- Verification: syntax PASS; focused `140/140`; full `239/239`; release PASS with
  1,000 isolated actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-e2ee-key-material-integrity-v1.json`.

## 2026-09-06 — E2EE decryption context integrity v1

- Bound decryption to exact message/envelope identity, device, nonce, commitment
  and epoch; rejected non-canonical public JWK/base64 inputs before Web Crypto.
- Added strict decrypted payload/metadata rules, content-addressed internal media
  references, bounded 20 MB streaming and transient content-key zeroization.
- Revoked local plaintext blob URLs on navigation/profile/page exit and preserved
  strictly identified historical v1 reads without reopening downgrade writes.
- Verification: syntax PASS; focused `148/148`; full `240/240`; release PASS with
  1,000 isolated actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-e2ee-decryption-context-integrity-v1.json`.

## 2026-09-06 — Messaging/E2EE local closure v1

- Expanded the reproducible local inventory from 18 to 20 artifacts and from 28
  to 40 construction-scoped invariants covering the 072–081 hardening sequence.
- Preserved every external non-claim and production gate; no independent audit,
  forward secrecy, key transparency or real-device claim was introduced.
- Verification: inventory `40/40`, inventory tests `2/2`, full `240/240`, release
  PASS with 1,000 isolated actors and zero issues. No network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P02-messaging-e2ee-local-closure-v1.json`.

## 2026-09-06 — Reaction mutation result integrity v1

- Added exact post/comment target, authenticated actor, active persona, normalized
  reaction and authoritative active-state fields to reaction responses.
- The browser now keeps one stable replay key for an unresolved reaction intent,
  blocks concurrent taps per post and validates the complete result before changing
  feed or fullscreen state.
- Private Dislike remains excluded from public aggregates; `Fake?` remains opinion.
- Verification: focused `6/6`; full `242/242`; release PASS with 1,000 isolated
  actors and zero issues. No external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-reaction-mutation-integrity-v1.json`.

## 2026-09-06 — Comment mutation result integrity v1

- Bound comment lists to exact post, authenticated viewer and active profile, with
  latest-request guards and a bounded fail-closed row validator.
- Added stable retry keys and single-flight state to create/reply, reaction, edit
  and author-withdrawal; exact result validation precedes every thread refresh.
- Preserved nested reply identity and append-only withdrawal tombstones/history.
- Verification: focused `74/74`; full `243/243`; release PASS with 1,000 isolated
  actors and zero issues. No external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-comment-mutation-integrity-v1.json`.

## 2026-09-06 — Social integrity sequence 085–088

- 085: Save, Repost/Retweet and Not Interested gained stable retry, single-flight
  and exact post/actor/profile/result validation.
- 086: Story list/view/archive gained viewer/profile/state binding, bounded shapes,
  latest-request guards and exact view receipts.
- 087: Feed gained exact viewer/lens/format binding, late-response rejection and
  maximum-100 complete post validation before render.
- 088: reproducible Social inventory passed 26/26 over 11 artifacts; full suite
  `249/249` across 28 files; release PASS with 1,000 isolated actors, zero issues,
  no network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-secondary-engagement-integrity-v1.json`,
  `planning/evidence/NX-WEB-SOCIAL-P02-story-result-integrity-v1.json`,
  `planning/evidence/NX-WEB-SOCIAL-P01-feed-result-integrity-v1.json`,
  `planning/evidence/NX-WEB-SOCIAL-P01-social-local-closure-v1.json`.

## 2026-09-06 — Operations closure sequence 089–098

- Revalidated resumable upload/outbox/quarantine, moderation report integrity,
  accessibility/responsiveness, runtime health, backup/restore, incident controls,
  Action Ledger, migrations, lifecycle and authentication/session boundaries.
- Ran 1,000-actor release journeys and a separate 10,000-actor bounded observation
  with no reported isolation issues; no synthetic actor can affect organic state.
- Repaired a stale group-E2EE benchmark fixture without weakening the fail-closed
  validator; 500-device exact coverage and edge-device decrypt now pass, with a
  regression test executing the same path.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-089-098-operations-closure-v1.json`.

## 2026-09-06 — Aggregate and evidence-bound gates 099–100

- Packet 099 passed full `251/251`, Social inventory `26/26`, E2EE inventory
  `40/40` and isolated release smoke with 1,000 actors and zero issues.
- Packet 100 added a reproducible evidence/hash/boundary gate. Final suite passes
  `252/252` across 29 files and package range `077-100` is locally closed.
- Public production remains blocked by trusted HTTPS/WalletConnect attestation,
  independent T0/T1 review, real-device validation, production media/Live
  infrastructure and formal legal/provider gates.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-aggregate-local-release-gate-v1.json`,
  `planning/evidence/NX-WEB-SOCIAL-evidence-bound-readiness-100-v1.json`.

## 2026-09-06 — Moderation appeal integrity 101

- Denied Trust Lens appeals unless the authenticated account is the exact post
  owner and the active profile is Social; Work-to-Social profile confusion now
  returns the same non-enumerating 404 as a wrong owner.
- Added one stable appeal key, single-flight submission and exact target,
  appellant, persona and non-enforcement result validation before UI success.
- Focused `8/8`; complete suite `253/253`; no external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-P01-moderation-appeal-integrity-v1.json`.
- Next bounded packet: `NX-WEB-SOCIAL-P01-TRUST-READ-INTEGRITY-102`.

## 2026-09-07 — Integrity sequence 102–110

- Closed Trust reads and appeals, notifications, GDPR lifecycle, profile/settings,
  Live drafts, Creator Studio publication, local drafts and camera lifecycle against
  stale responses, profile confusion, duplicate intent and malformed result state.
- Fixed camera races so an obsolete permission result cannot replace a newer
  stream, closing the composer cannot publish a pending recording and a previous
  recording timer cannot stop the current one.
- Tightened device-local draft identities to UUIDv4 or bounded local draft IDs;
  drafts remain owner/profile partitioned with a 20-item and 20 MB boundary.
- Verification: camera audit `72/72`; complete suite `255/255` across 29 files.
  No external network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-102-110-integrity-v1.json`.
- Next bounded packet: `NX-WEB-SOCIAL-P01-FULLSCREEN-CLIPS-INTEGRITY-111`.

## 2026-09-07 — Social integrity sequence 111–120

- Closed fullscreen Clip and Story session races, privacy-filtered Search/Relations
  pagination, bounded private media ranges and owner/profile-bound post lifecycle.
- Added immutable post versions and transactional Outbox events for edit, archive
  and withdrawal; public content is removed while the owner-only audit trail stays.
- Unified browser transport failures into a bounded retry/localization contract and
  added deterministic feed plus first-party asset regression budgets.
- Verification: full `262/262` across 30 files, Social inventory `44/44`, local
  release PASS with 1,000 isolated actors and zero issues. No external network,
  real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-111-120-integrity-v1.json`.
- Next sequence: `planning/NX-WEB-SOCIAL-cycles-121-150-plan.md`, beginning with
  `NX-WEB-SOCIAL-P01-OWNER-POST-CONTROLS-121`.

## 2026-09-08 — Integrity sequence 130–140

- Closed durable Story publication and highlights, bounded draft/upload quotas,
  strict regular/E2EE media delivery, signed inbox pagination, attachment cleanup,
  call leases, optimistic group administration and realtime notification state.
- Corrected the synthetic lab after the aggregate gate caught an unauthorized
  private-content interaction; the lab does not fabricate a paid entitlement.
- Notification no-op reads no longer emit phantom realtime changes, and account
  deletion security notices now use the same recipient-bound invalidation path.
- Accessibility adds explicit modal Escape targets, restored focus, reduced-motion
  and forced-colors support, plus one valid main landmark.
- Verification: full `284/284` across 32 files, Social inventory `44/44`, E2EE
  inventory `40/40`, local release PASS with 1,000 isolated actors and zero issues.
  No external network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-130-140-integrity-v1.json`.
- Next bounded packet: `NX-WEB-SOCIAL-P03-MOBILE-LAYOUT-INTEGRITY-141`.

## 2026-09-08 — Integrity sequence 141–150

- Added real-phone dynamic viewport, safe-area, landscape and RTL contracts while
  preserving full-bleed media and profile-bound language selection.
- Expanded the Privacy Matrix to 2,400 deny-first combinations and exact timed
  entitlement boundaries.
- Added deterministic crash-window, migration/restore, abuse/flood and bounded
  soak drills; synthetic traffic remains excluded from organic and enforcement state.
- Verification: full `296/296`, Social inventory `55/55`, 1,000 isolated actors
  with zero issues, bounded soak PASS and local release check PASS. No external
  network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-141-150-integrity-v1.json`.
- Next sequence: `planning/NX-WEB-SOCIAL-cycles-151-180-plan.md`.

## 2026-09-08 — Integrity sequence 151–160

- Connected the owner Story menu to archive and Highlight creation with stable
  replay keys and exact owner/persona/result validation.
- Re-verified Story media revocation, signed inbox search/pagination, offline
  failure, resumable upload cancellation, fullscreen continuity, threaded
  engagement, timed private access, narrow layouts and RTL behavior.
- Verification: aggregate `298/298` and local release check PASS. No external
  network, real funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-151-160-integrity-v1.json`.
- Next bounded packet: feed-ranking adversarial properties, cycle 161.

## 2026-09-08 — Integrity sequence 161–180

- Re-ran adversarial ranking, graph, notification, signaling, E2EE churn,
  storage pressure, moderation and account recovery suites.
- Added executable inventories for privacy-critical reads, offline supply chain,
  deployment configuration, data indexes and release evidence.
- The supply-chain audit identified the MultiversX NativeAuth client/server as
  GPL-3.0-or-later dependencies and preserved a formal distribution review gate.
- Final verification: `303/303` full tests, Social inventory `62/62`, selected
  T0/T1 `49/49`, 5,000 isolated actors with zero issues, 500 abuse actors, bounded
  soak PASS and release check PASS. No external network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-161-180-integrity-v1.json`.
- Sequence 151–180 is locally complete. External security, legal, provider,
  device and production-infrastructure gates remain open.

## 2026-09-08 — Integrity sequence 181–190

- Closed secure-by-default E2EE selection, explicit plaintext consent and
  message-attachment cancellation without allowing a silent security downgrade.
- Made Story archive/Highlight partial results recoverable and kept one stable
  retry intent.
- Preserved fullscreen sound and playback state; changed reaction UX to short-tap
  Like plus long-press/keyboard palette.
- Comments now close through toggle, X, Escape or mobile Back, hide the app dock,
  preserve threaded content and restore focus to the invoking control.
- Verification: full `316/316` across 48 files, Social inventory `62/62`, E2EE
  inventory `40/40`, critical-read inventory `18/18`, release check PASS with
  1,000 isolated actors and zero issues. No external network, funds or cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-181-190-integrity-v1.json`.
- Next bounded packet: cold-start creator exploration simulation, cycle 191.

## 2026-09-08 — Integrity sequence 191–200

- Added deterministic cold-start exploration and separated private Dislike from
  resettable Not Interested without synthetic ranking influence.
- Extended abuse simulation to coordinated follows/reports while keeping Sigils,
  takedowns and public engagement organic-only.
- Hardened Social Search controls and added automated-moderation transparency,
  exact appeals and explicit community-opinion wording without truth percentages.
- Completed persona-specific visibility, discoverability, message policy, locale
  and Near settings; Social and Work updates remain independently stored.
- Protected shared devices by keeping responses/media uncacheable and clearing
  drafts, resumable intent metadata and volatile Social state after confirmed logout.
- Restricted static delivery to known MIME types, denied dotfiles, revalidated
  executable assets and tightened CSP against script attributes, workers and frames.
- Verification: full `330/330` across 53 files; Social inventory `72/72`; E2EE
  inventory `40/40`; critical-read inventory `18/18`; release PASS with 1,000
  isolated actors and zero issues. Responsive deterministic checks passed `23/23`.
- Real-browser/device visual verification was denied by the saved local-browser
  permission and remains OPEN. External security, provider, legal and production
  infrastructure gates remain OPEN. No network, funds or incremental cost.
- Evidence: `planning/evidence/NX-WEB-SOCIAL-cycles-191-200-integrity-v1.json`.
- Next bounded packet: M1–M3 acceptance/gap inventory, cycle 201.

## 2026-09-08 — M1–M3 local-demo closure, cycles 201–230

- Added an executable M1 Identity, M2 Data Integrity and M3 Nexus Social
  acceptance inventory with 35 source-bound criteria and explicit external gates.
- M1 focused verification passed `122/122`; M2 passed `32/32` plus crash,
  migration/restore, backup, read-authorization and data-index drills; M3 passed
  `178/178`, Social `72/72`, E2EE `40/40` and 1,000 actors with zero issues.
- The final integrated suite passed `331/331` across 54 files, with deployment and
  release checks PASS_LOCAL. No external network, real funds or incremental cost.
- M1, M2 and M3 are closed only for local-demo scope. Trusted HTTPS, real providers
  and devices, current online SCA, independent audits, GPL/legal/store decisions
  and production infrastructure remain explicit release gates.
- Evidence: `planning/evidence/NX-M1-M3-cycles-201-230-local-closure-v1.json`.
