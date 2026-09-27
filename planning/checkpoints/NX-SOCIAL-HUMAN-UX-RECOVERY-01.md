# NX-SOCIAL-HUMAN-UX-RECOVERY-01

Date: 2026-09-10  
Scope: Nexus Social phone feed, reactions, media framing, overlay dismissal  
Status: `LOCAL_IMPLEMENTATION_COMPLETE / REAL_DEVICE_ACCEPTANCE_OPEN`

## Human finding

The local build is a technically functional prototype, not yet a consumer-ready
Instagram/TikTok/Facebook-level experience. Passing backend tests is not evidence
that text is readable, gestures feel natural, or the composition is visually
balanced on the owner's phone.

The bounded comparison is recorded in
`planning/audits/NX-SOCIAL-HUMAN-UX-GAP-100.md`. It contains exactly 100 numbered
human-visible gaps. `FIXED-CANDIDATE` means only that the correction exists in the
local build; it remains open for physical-device/owner confirmation.

## Implemented in this packet

- A final phone UX style layer loaded after the prototype styles.
- Readable phone targets for the header, logo, Stories, creator identity, action
  rail, comments and bottom navigation.
- Equal 32 px optical boxes for every reaction, including Fake and Dislike.
- Proportional reaction summary: one combined dominant reaction at >=85%, or the
  leading three reaction types when sentiment is meaningfully mixed.
- Tap and long press both open the full reaction palette.
- Reaction palette closes after selection, outside tap, downward swipe or Escape.
- Persistent `Ecran complet / Carduri` feed presentation choice.
- Explicit `For You` clip feed and separate `Fotografii & postări` channel; the
  compact header states the active content kind instead of the generic word Feed.
- Persistent `Umple / Vezi cadrul complet` media choice in the feed selector and
  the full-screen viewer; fill is the default.
- One-tap media viewer remains continuous and restores the feed position on close.
- Representative local demo Stories fill an otherwise empty development account
  without entering organic product state.
- Cache version advanced to `20260910-humanux4` for phone refreshes.

## Evidence

- `node --check public/app.js`: pass.
- `npm test`: 375 passed, 0 failed.
- Local health: HTTP 200, `status=ready`, `environment=local_development`.
- Root HTML: HTTP 200 and references `20260910-humanux4`.
- Human UX stylesheet: HTTP 200, 12,730 bytes.
- First-party performance test includes the final UX stylesheet; explicit source
  budgets pass.

## Gates deliberately left open

- Golden screenshots at 360/390/430 px and landscape.
- Physical Android Chrome acceptance for touch, keyboard, safe areas and rotation.
- Owner acceptance of hierarchy, density and perceived polish.
- P0H gesture conflict audit, buffering/loading treatment and create/upload journey.

The saved browser-control permission rejected local-page inspection during this
packet. No alternate browser-control route was used, and no unverified screenshot
claim was made.

## Next bounded packet

`NX-SOCIAL-HUMAN-UX-RECOVERY-02`: deterministic gesture map, visible media-type
context, first-use swipe hint, buffering/error states, and comment keyboard/thread
polish. Close only after code tests and physical-device evidence are separate.
