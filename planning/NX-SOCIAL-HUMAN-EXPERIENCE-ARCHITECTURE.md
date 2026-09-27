# Nexus Social — Human Experience Architecture

Date: 2026-09-10  
Scope: Social only  
Product state: recovery from functional prototype to human beta

## Product rule

Nexus Social has two surfaces, not a collection of unrelated screens:

1. **Feed** — fast discovery with Stories and a compact shared header.
2. **Viewer** — content fills the viewport; chrome exists only to act or leave.

Every visible control must perform an immediate action, open a useful surface, or
be removed. Technical status prose, decorative selectors and unavailable actions
do not belong in the content viewport.

## Navigation contract

| Context | Gesture/action | Result |
|---|---|---|
| Feed | Swipe up/down | Next/previous item in the active channel |
| Feed | Swipe left/right | Next/previous primary channel: For You, Local, Global, Following |
| Feed selector | Open “Mai multe formate” | Photos, Tweets, Friends, Private and Breaking without crowding the default path |
| Feed at top | Pull down past the tactile threshold | Refresh Stories and the active feed once; ignore duplicate refreshes |
| Feed | One tap on media | Open that exact item in the immersive Viewer |
| Viewer | Swipe up/left | Next item without returning to Feed |
| Viewer | Swipe down/right | Previous item without returning to Feed |
| Viewer | Tap video | Pause/play; the play glyph exists only while paused |
| Viewer | X or browser Back | Close and restore exact feed position/playback |
| Any overlay | Tap outside, swipe down, X or Back | Close only the topmost overlay |

Long-term carousel rule: horizontal movement first traverses media belonging to
the same post; only a single-asset post uses horizontal movement for feed/channel
navigation. A one-time non-blocking hint teaches this; it never becomes permanent
text.

## Persistent content actions

The same ordered rail is used in Feed and Viewer:

1. Reactions — current leading sentiment and count; tap opens the full palette.
2. Comments — opens threaded conversation without losing playback context.
3. Repost — publishes/withdraws one internal Nexus repost.
4. Send — internal Nexus recipients only; no WhatsApp/Telegram/external handoff.
5. Save — private collection state.
6. Audio — mute/unmute and later the internal audio page.

Creator identity is one compact line: avatar, name, Follow, more. The more popover
is anchored beside the trigger and contains Profile, Message, Not interested and
Report. It is not a second action bar.

## Content channels

- **Clips / For You:** video-first, full-height, ranked by watch/skip and meaningful
  interaction with a protected organic exploration floor.
- **Photos & Posts:** images, carousels and mixed posts; no forced video cards.
- **Tweets:** text-first conversation stream with replies and reposts.
- **Following/Friends/Local/Global/Private/Breaking:** source lenses, not hidden
  media-type toggles. The header always states both active type and active lens.

The separation follows current mainstream expectations: For You is immediately
personalized and interaction/watch behavior is a major signal; Following, Friends
and LIVE are distinct feeds. Nexus improves this with explicit format, explicit
ranking reason, private Dislike and no synthetic influence on organic ranking.

## Human beta content fixture

Local development must not look empty. A bounded showcase contains multiple
videos, photos, text posts, creators, reaction distributions and threaded comments.
It is visibly marked Demo, uses no real person data, creates no blockchain action,
and never affects organic metrics, recommendations or creator rewards. Demo actions
may update device-local presentation state but cannot claim a server or chain
commit.

## Simplicity budget

- Maximum three compact header controls.
- Maximum six primary content actions.
- Operational body text: 14 px minimum; counters 12 px; tap targets 44 px minimum.
- No permanent onboarding paragraph over content.
- No inactive tab, placeholder button, fake network state or unexplained symbol.
- One primary action per modal; advanced controls use progressive disclosure.
- Default view shows content, creator identity and actions—not trust/debug metadata.

## Acceptance gates

Automated correctness and human acceptance are separate:

1. Interaction/state tests pass.
2. Golden screenshots pass at 360, 390, 430 px and landscape.
3. Real Android Chrome journey passes with one hand and at 200% text.
4. Five-minute first-use study: users can change content type, open/close Viewer,
   react, comment, repost, send internally, save and mute without instruction.
5. No task leaves the user trapped; Back always closes the topmost surface.
6. Owner signs off visual hierarchy before the word “finished” is used.

## Delivery order

1. **H1 shell:** remove dead Viewer controls, add X, restore repost/internal Send,
   establish the gesture map and display enough safe demo content.
2. **H2 conversations:** comment threads, keyboard, drafts, relevance/newest and
   zero-trap overlay stack.
3. **H3 creation:** camera/gallery/record/live permissions, editor, resumable upload,
   recovery and drafts as one journey.
4. **H4 visual evidence:** screenshots, contrast, RTL/long labels, landscape and
   physical-device acceptance.
5. **H5 delight/performance:** transition timing, preloading, buffering, data saver,
   reduced motion and measured frame/input budgets.
