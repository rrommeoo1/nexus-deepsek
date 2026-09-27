# Nexus Social — Human Journey Audit Matrix

Date: 2026-09-10  
Scope: Social on mobile; local demo; zero external spend  
Rule: the owner is an acceptance sampler, not the defect-discovery system.

## Release gate

A Social build is not UX-approved because selectors exist or source-pattern tests
pass. Every P0 journey must have all three forms of evidence:

1. deterministic behavior test (state, gesture, failure and replay);
2. rendered viewport evidence at 360x800, 390x844 and 412x915, plus landscape;
3. one physical-device replay for camera, keyboard, browser Back and touch gestures.

Any trapped screen, overlapping primary controls, unreadable essential text, dead
button or gesture without visible effect fails the candidate.

## Universal human invariants

- A user can leave every overlay using its close control, Android/browser Back,
  Nexus/Home, or a documented dismiss gesture.
- Only one interaction surface owns the screen at a time. Comments hide reactions,
  creator chrome, menus and the application dock.
- Essential mobile text is at least 14 px; composer input is at least 16 px; primary
  touch targets are at least 44x44 px.
- A deliberate swipe produces exactly one transition. A short tap never changes
  content; a swipe never accidentally likes or pauses it.
- Pending, empty, offline, denied-permission and failed states always retain a way
  back and one useful recovery action.
- External share destinations remain absent. Share means an internal Nexus handoff.

## P0 journey matrix

| ID | Journey | Acceptance | Automated evidence | Render/device evidence | Status |
|---|---|---|---|---|---|
| HJ-01 | Open media from feed | One tap opens the selected item edge-to-edge; feed position is restored on close. | Existing viewer/session tests | Required each release | IMPLEMENTED, render pending |
| HJ-02 | Fullscreen vertical swipe | Up = next; down = previous; one transition; wraps continuously. | `decideViewerGesture` four-direction unit test + explicit touch path | Required on Android | IMPLEMENTED, device retest pending |
| HJ-03 | Fullscreen horizontal swipe | Left = next; right = previous; one transition; no browser navigation takeover. | `decideViewerGesture` four-direction unit test + non-passive move | Required on Android | IMPLEMENTED, device retest pending |
| HJ-04 | Open comments | Reaction tray and action rail disappear; readable threaded conversation owns lower 54% of portrait viewport. | Fullscreen comment human-contract test | Required at 360/390/412 widths | IMPLEMENTED, render pending |
| HJ-05 | Reply and keyboard | Reply is nested under its parent; input stays visible; dock stays hidden; cancel and send remain reachable. | Thread/reply and overlay tests | Required with Android keyboard | IMPLEMENTED, device retest pending |
| HJ-06 | Close comments | X, Back and Escape close only comments and restore focus/current media. | Comment overlay navigation tests | Required on Android | IMPLEMENTED, device retest pending |
| HJ-07 | Open/close header selector | Second tap, selection, Home, logo and Back close it without trapping navigation. | Non-modal navigation contract | Required at three portrait widths | IMPLEMENTED, render pending |
| HJ-08 | Pull to refresh | Downward pull at top refreshes once, shows progress and preserves a usable feed on failure. | Pure gesture + single-flight refresh tests | Required on Android | IMPLEMENTED, device retest pending |
| HJ-09 | Reaction choice | Tap opens choices; selection closes it; opening comments always collapses it. | Reaction accessibility + comment exclusivity tests | Required on Android | IMPLEMENTED, device retest pending |
| HJ-10 | Camera/create/live | Permission success shows live preview; denial has a native/retry path; closing releases tracks. | Camera request-gate tests | Physical device mandatory | OPEN in this audit cycle |

## Audit loop used from now on

1. Generate the interaction state graph from visible controls and overlays.
2. Replay P0 journeys on each target viewport and record screenshots for normal,
   loading, empty, error, comments, keyboard and fullscreen states.
3. Run overlap, contrast, text-size, target-size and safe-area assertions.
4. Replay touch, Back, rotation, offline and rapid-repeat cases.
5. Fix the highest human-severity defect, rerun the whole affected journey, then
   rerun regression and synthetic actor tests.
6. A finding becomes `VERIFIED` only with behavior plus render/device evidence;
   source-only proof is labeled `IMPLEMENTED` or `FIXED-CANDIDATE`.

This replaces the previous pattern where a broad test count could hide obvious
human failures. The next audit packet is HJ-10 camera/create/live, followed by a
full rendered pass of HJ-01 through HJ-09 when interactive browser/device capture
is available.
