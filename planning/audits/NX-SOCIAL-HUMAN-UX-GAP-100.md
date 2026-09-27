# Nexus Social — Human UX Gap Audit 100

Date: 2026-09-10  
Evidence: owner phone screenshot at 360–390 px, live local build, code inspection, and official TikTok product help.  
Verdict: the build is a functional prototype, not an Instagram/TikTok/Facebook-level consumer product. Automated backend gates must not be interpreted as human-experience acceptance.

Status legend: `FIXED-CANDIDATE` is implemented locally but still needs owner/device confirmation; `OPEN` is not release-ready. P0H blocks human beta.

## A. First impression and readability

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 001 | P0H | The Nexus logo is optically too small on the phone. | Brand is immediately recognizable without taking space from content. | FIXED-CANDIDATE |
| 002 | P0H | Header pill text falls near 7–9 px in prior overrides. | All operational labels are at least 11 px, body text at least 14 px. | FIXED-CANDIDATE |
| 003 | P0H | Action counters are difficult to read. | Counters are at least 12 px with shadow/contrast over any media. | FIXED-CANDIDATE |
| 004 | P0H | The Fake diamond has less optical weight than the heart/comment icons. | Every reaction glyph occupies the same 32 px optical box. | FIXED-CANDIDATE |
| 005 | P0H | Profile name and handle are too small for quick recognition. | Name 15 px, handle 12 px, avatar 40 px on phone. | FIXED-CANDIDATE |
| 006 | High | Too many cyan/violet glows compete with the content. | Glow identifies active state only; media remains the brightest surface. | OPEN |
| 007 | High | The feed looks like a phone mockup nested inside a phone browser. | Mobile route has no decorative device frame or rounded outer corners. | FIXED-CANDIDATE |
| 008 | High | Important labels truncate before meaning is clear. | Common labels fit; long text expands or has accessible full label. | OPEN |
| 009 | High | Typography weights do not clearly separate name, handle, caption, and metadata. | Four consistent type roles with WCAG-readable contrast. | OPEN |
| 010 | High | The UI has no visual-density setting. | Comfortable default plus a compact accessibility preference. | OPEN |

## B. Feed comprehension and control

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 011 | P0H | Users cannot tell whether they are in a clip, photo, or mixed feed. | Current feed type is explicit in the header selector. | FIXED-CANDIDATE |
| 012 | P0H | Users cannot clearly choose immersive versus card viewing. | Feed selector offers persistent “Ecran complet / Carduri”. | FIXED-CANDIDATE |
| 013 | P0H | Switching view style has no remembered preference. | Choice persists per device and restores on next visit. | FIXED-CANDIDATE |
| 014 | P0H | Swipe continuity is not obvious or sufficiently smooth. | One-item snap, next item preloaded, no blank flash. | OPEN |
| 015 | P0H | Photo, video, and text navigation rules differ without explanation. | Predictable tap/swipe contract across formats. | OPEN |
| 016 | High | No clear “new posts” affordance returns the user to fresh content. | Non-disruptive new-content banner with one-tap refresh. | OPEN |
| 017 | High | Refresh/loading feedback is weak. | Skeleton or retained-content loading with explicit retry. | FIXED-CANDIDATE |
| 018 | High | End-of-feed state feels like a technical dead end. | Suggestions, refresh, and discover actions appear at the end. | OPEN |
| 019 | High | Feed switching resets context without a visible transition. | Preserve position per feed and animate the context change. | OPEN |
| 020 | High | There is no visible way to explain “Why am I seeing this?”. | More menu exposes concise ranking reasons and controls. | OPEN |

## C. Media viewport and playback

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 021 | P0H | Media does not consistently own the available viewport. | Clip stage is edge-to-edge and content-first. | FIXED-CANDIDATE |
| 022 | P0H | Portrait media can leave unexplained side gaps. | Cover fill by default; user can switch to uncropped fit. | FIXED-CANDIDATE |
| 023 | P0H | The difference between feed playback and full-screen viewer is unclear. | One tap opens immersive viewer; back returns to exact feed position. | FIXED-CANDIDATE |
| 024 | P0H | Play/pause feedback can linger or obscure the subject. | Center glyph appears only while paused and fades immediately on play. | FIXED-CANDIDATE |
| 025 | P0H | A tap sometimes opens, pauses, or dismisses depending on layer. | One documented gesture map with no overlapping handlers. | OPEN |
| 026 | High | Full-screen viewer does not visibly teach vertical navigation. | First-use hint appears once, then never obstructs content. | OPEN |
| 027 | High | Neighbor videos are not guaranteed ready before swipe. | Metadata/first frame of adjacent item is preloaded under a budget. | OPEN |
| 028 | High | Poor connections can produce silent stalled video. | Buffer state, quality adaptation, retry, and offline message. | OPEN |
| 029 | High | Media fit is not user-selectable. | “Fill / Fit” is reachable in viewer settings and remembered. | FIXED-CANDIDATE |
| 030 | High | Landscape behavior is inconsistent with device orientation. | Landscape viewer uses full width, respects safe areas, retains actions. | FIXED-CANDIDATE |

## D. Sound and captions

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 031 | P0H | Audio state is represented by a decorative disc, not an obvious control. | Clear mute/unmute icon with persistent state. | FIXED-CANDIDATE — NX-SOCIAL-SOUND-01, phone gate open |
| 032 | High | The original-audio label truncates without opening an audio page. | Tap opens the internal Nexus audio detail/use flow. | OPEN |
| 033 | High | There is no volume adjustment on web/desktop. | Accessible volume slider where the platform permits it. | OPEN |
| 034 | High | Captions are not guaranteed visible or controllable. | Auto/manual captions toggle with language selection. | OPEN |
| 035 | High | Caption text can overlap creator/actions. | Collision-free safe zones validated at common phone sizes. | OPEN |
| 036 | Medium | Playback speed is unavailable. | 0.5×, 1×, 1.5×, 2× in viewer settings. | OPEN |
| 037 | Medium | Audio attribution has no rights/status context. | Rights state and reuse permission are visible. | OPEN |
| 038 | Medium | No audio waveform/scrub feedback exists. | Optional scrubber with elapsed/remaining time. | OPEN |
| 039 | Medium | Mute state has no cross-clip continuity test on device. | Mute persists across clips/viewer until user changes it. | FIXED-CANDIDATE |
| 040 | Medium | No reduced-audio/autoplay accessibility preference exists. | Respect OS/data-saver/reduced-motion preferences. | OPEN |

## E. Reactions and engagement

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 041 | P0H | Tapping the visible reaction previously gave Like immediately. | Tap opens the reaction palette; user explicitly chooses. | FIXED-CANDIDATE |
| 042 | P0H | Long press was the only discoverable route to reactions. | Tap and long press both open the same accessible palette. | FIXED-CANDIDATE |
| 043 | P0H | Mixed sentiment is shown as tiny stacked symbols. | Up to three readable leading reactions are displayed. | FIXED-CANDIDATE |
| 044 | P0H | Dominant Like plus a tiny minority creates clutter. | At ≥85% dominance, show one glyph with combined total. | FIXED-CANDIDATE |
| 045 | High | Reaction palette can cover key media without a clear dismiss action. | Tap outside, swipe down, Escape, or selection closes it. | FIXED-CANDIDATE |
| 046 | High | Reaction changes lack visible optimistic/rollback feedback. | Immediate state plus pending/error recovery, never double-counted. | OPEN |
| 047 | High | Dislike and Fake are visually ambiguous. | Plain-language labels/tooltips explain opinion vs moderation report. | OPEN |
| 048 | High | Reactions do not expose a breakdown view. | Tap total opens privacy-safe counts and top reactions. | OPEN |
| 049 | Medium | Double-tap Like is not consistently available in immersive view. | Double-tap gives Like with brief animation and undo path. | OPEN |
| 050 | Medium | Reaction animation does not convey success. | Subtle, reduced-motion-safe feedback without blocking playback. | OPEN |

## F. Comments and conversations

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 051 | P0H | Comments can trap the user or obscure navigation. | Explicit close, backdrop tap, swipe down, and browser Back all work. | FIXED-CANDIDATE |
| 052 | P0H | Comment drawer text is too small. | Heading 18 px, comments 14 px, input 16 px. | FIXED-CANDIDATE |
| 053 | P0H | Bottom navigation competes with the keyboard/comments. | Bottom navigation is hidden while comments are active. | FIXED-CANDIDATE |
| 054 | P0H | Replies can appear as unrelated comments. | Thread connectors, indentation, “replying to”, and collapse/expand. | FIXED-CANDIDATE |
| 055 | High | Relevant ordering has no visible alternative. | “Relevant / Newest” selector with remembered preference. | OPEN |
| 056 | High | Comment submission state is unclear. | Sending indicator, retry, duplicate prevention, preserved draft. | OPEN |
| 057 | High | Keyboard opening can hide the send control. | VisualViewport-aware composer remains above keyboard. | OPEN |
| 058 | High | Long discussions have no collapsed reply groups. | “View N replies” loads a bounded thread branch. | OPEN |
| 059 | High | Moderation actions crowd the comment line. | Long press or more menu contains report/mute/manage actions. | OPEN |
| 060 | Medium | Comment avatars/names do not always open the profile. | Avatar and username consistently open privacy-filtered profile. | OPEN |

## G. Stories

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 061 | P0H | A nearly empty local account shows only “Story nou”. | Local demo shows representative, clearly demo-labelled stories. | FIXED-CANDIDATE |
| 062 | P0H | Story thumbnails were too small to create curiosity. | 70 px media circles with readable 12 px labels on phone. | FIXED-CANDIDATE |
| 063 | P0H | Story transitions can feel disconnected. | Continuous progress bars and immediate next/previous navigation. | OPEN |
| 064 | High | Viewed-story disappearance is not explained. | Seen state is reversible through archive/history where policy allows. | OPEN |
| 065 | High | Camera permission failure does not give a strong recovery route. | Explain HTTPS/browser permission and offer gallery without dead end. | OPEN |
| 066 | High | Story viewer defaults video audio to mute without visible control. | Visible audio toggle with persistent preference. | OPEN |
| 067 | High | Story reply/reaction is absent from the normal viewing surface. | Internal reply/reaction actions respect privacy. | OPEN |
| 068 | High | Persistent vs expiring Story is not clear to viewers. | Lifecycle badge is understandable and non-intrusive. | OPEN |
| 069 | Medium | Holding to pause is not taught. | First-use affordance and accessible pause control. | OPEN |
| 070 | Medium | Story media can letterbox with no background treatment. | Fit media over a blurred/safe derived background. | OPEN |

## H. Creator identity and profile transitions

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 071 | P0H | Follow and more controls can appear detached from the name. | Creator, follow, and more form one compact readable cluster. | FIXED-CANDIDATE |
| 072 | High | Tapping the avatar has ambiguous Story/profile behavior. | Ring tap opens Story; name tap opens profile; states are visually distinct. | OPEN |
| 073 | High | Profile opening loses feed context in some paths. | Close/back returns to exact post, playback time, and scroll position. | OPEN |
| 074 | High | Follow state lacks strong pending/private feedback. | Follow, requested, following are visually unambiguous. | OPEN |
| 075 | High | Creator menu positioning can detach from the three dots. | Anchored popover appears beside its trigger and closes on outside tap. | OPEN |
| 076 | High | Handle/sigil/orbit metadata can overwhelm identity. | Progressive disclosure keeps the first line simple. | OPEN |
| 077 | Medium | Profile counters have no direct navigation semantics. | Followers/following counters open filtered lists. | OPEN |
| 078 | Medium | Profile media grid lacks stable thumbnail crop/placeholder rules. | Predictable 3-column grid, video indicator, progressive image load. | OPEN |
| 079 | Medium | Private-profile paywall language can surprise users. | Price, duration, renewal, anonymity, refund, and receipt are explicit. | OPEN |
| 080 | Medium | Profile edits do not have a clear preview/publish distinction. | Preview, save state, validation, and rollback are clear. | OPEN |

## I. Navigation, creation, and feedback

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 081 | P0H | Bottom navigation icons/labels were undersized. | 44 px icon targets and 12 px labels; 68 px central Create. | FIXED-CANDIDATE |
| 082 | P0H | Create, Story, and Live device actions can fail without obvious cause. | Permission preflight, real preview, recoverable fallback, no dead screen. | OPEN |
| 083 | P0H | Upload flow does not yet feel reliably resumable to a human. | Progress, pause/resume, background recovery, and draft state are visible. | OPEN |
| 084 | High | Create choices do not show last draft or resumable upload. | Draft/recovery tile appears with exact state and action. | OPEN |
| 085 | High | Navigation state can change without preserving scroll/playback. | Each primary tab restores its previous context. | OPEN |
| 086 | High | Toast messages can be missed and sometimes lack action. | Accessible message with retry/undo where safe. | OPEN |
| 087 | High | Back behavior differs across drawers, sheets, viewers, and routes. | One back-stack contract closes the topmost layer first. | FIXED-CANDIDATE |
| 088 | High | Loading/error/empty components are visually inconsistent. | Shared state component with context-specific recovery. | OPEN |
| 089 | Medium | Offline status is technical rather than useful. | Explain what still works and queue safe actions visibly. | OPEN |
| 090 | Medium | No first-run gesture onboarding exists. | Three skippable contextual hints, never a long tutorial. | OPEN |

## J. Trust, quality, accessibility, and parity

| # | Severity | Human-visible difference | Acceptance target | Status |
|---:|:---:|---|---|---|
| 091 | P0H | Automated tests did not include screenshot/visual-regression gates. | Golden screenshots at 360/390/430 px and landscape block regressions. | OPEN |
| 092 | P0H | No real-device human acceptance checklist gated “verified”. | Owner/device journeys must pass before human-ready is claimed. | OPEN |
| 093 | High | Trust Lens language can look like an unexplained technical badge. | Tap reveals basis, confidence, limits, appeal, and user-opinion separation. | OPEN |
| 094 | High | Accessibility labels exist unevenly across icon-only controls. | Every control has an accurate name, state, focus, and 44 px target. | OPEN |
| 095 | High | Contrast has not been measured over every sampled media frame. | Scrims/tokens pass text/icon contrast across representative frames. | OPEN |
| 096 | High | Screen-reader order may not match the visual action order. | Automated and manual VoiceOver/TalkBack journey passes. | OPEN |
| 097 | High | RTL/localized long labels can overflow the compact header. | Romanian, English, Arabic, and Polish layouts pass at 200% text. | OPEN |
| 098 | High | Performance budgets are not tied to human smoothness. | p95 input response, frame drops, LCP, memory, and data budgets defined. | OPEN |
| 099 | High | Demo fallback and real content are not always visibly distinguishable. | Demo content is labelled and impossible to mistake for organic metrics. | OPEN |
| 100 | P0H | “Tests pass” was treated as equivalent to “product feels finished”. | Release score has separate backend, UX, real-device, and owner-acceptance gates. | OPEN |

## Immediate recovery sequence

1. P0H-1: readable header/action rail, equal reaction glyphs, immersive/card switch, tap-to-open reactions, representative local Stories.
2. P0H-2: deterministic playback/full-screen gesture contract and media fit control.
3. P0H-3: comments/keyboard/threading and reliable overlay dismissal.
4. P0H-4: creation/camera/upload recovery journey.
5. P0H-5: 360/390/430 px visual regression plus physical Android acceptance.

Reference behavior was checked against TikTok's official creation, editing, comments, and recommendation documentation. Competitive products are baselines, not templates; Nexus must preserve its privacy matrix, internal-only sharing, transparent ranking, and user-controlled identities.
