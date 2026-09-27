# Nexus functional audit — Codex / DeepSeek handoff

## Coordination
- Scope narrowed by user: **Social only** (feed, Reels, Moments, profiles, relations, comments and Social messaging). No Dating/Stay/Market/other vertical audit or implementation. No redesign or production/dependency/provider changes.
- Codex packet `NAV-01`: author -> profile -> return; public-profile navigation and regression tests.
- Files claimed for this packet: `apps/nexus-web/public/app.js`, new `public/profile-navigation.js`, new `test/profile-navigation.test.js`.
- Follow-on Social read fixes: `lib/api.js`, `lib/repo.js`, new `test/social-profile-read-regressions.test.js`; isolated browser harness `scripts/profile-navigation-lab.mjs`.
- DeepSeek has NOT acknowledged this claim; this file is a handoff, not evidence of live agent communication.
- No `.git` repository in this copy. Preserve pre-edit copies outside source and re-check hashes before edits.
- During the repair packet, the existing server on 5000 was not restarted; 3000 was a local alias. See the activation checkpoint below for current runtime status.
- No changes to real accounts, payment access or the application database for tests.

## Baseline evidence
- 2026-09-24: `node --test --test-reporter=tap test/*.test.js`: 639 tests, 639 pass, 0 fail, ~15.6s.
- Passing automated tests are not proof of complete human journeys or mobile-device acceptance.

## Findings (initial; not a completed whole-code audit)
| ID | Severity | Evidence / effect | Status |
|---|---|---|---|
| NAV-01 | High | `openCreatorProfile` destroyed the viewer and resumed underlying feed media. | Fixed: suspend same element; behavioral tests; image-viewer browser journey |
| NAV-02 | Medium | Fullscreen author name and avatar shared `data-creator-story`. | Fixed: separate semantic targets, same visual wrapper; click and keyboard verified |
| NAV-03 | High | Profile lacked its own history entry; dismissal ordering was inconsistent. | Fixed: history-aware, single-flight dismissal; browser X and Back verified |
| NAV-04 | High | During implementation, viewer pointer capture intercepted name clicks, and redundant `inert` management interfered with shared modal isolation. | Found in browser and fixed before delivery; repeated mobile-width return remains interactive |
| REL-02 | Medium | Opening a profile post lost the real following state; stepping could restore stale button state. | Fixed: propagate profile relation into viewer items and synchronize loaded items after successful mutation |
| REL-01 | High, missing feature | Friends is mutual follow in existing Privacy Matrix. Separate accepted friendship request graph is not implemented by the existing follow button. Do not relabel Follow as Friends. | Design/model gap; no privacy semantic change in NAV-01 |
| PROFILE-01 | Medium | Public profile Clips/Stories tabs are spans, not controls; text post tiles return without navigation when absent from `mediaPosts`. | Confirmed in source, browser reproduction pending |
| PROFILE-02 | High | Public profile selected latest 100 posts globally before filtering author. | Reproduced with 105 newer posts by another author; fixed by author-scoped query before LIMIT. Still bounded to 100; full pagination/total counts are not delivered here |
| SECURITY-01 | High | Locked Social offer leaked name/handle/price into a mismatched active persona. | Reproduced (200 instead of 404), fixed; same-context offer still works; blocked and hidden remain denied |
| MAINT-01 | Medium, risk | `app.js` ~600 KB, many source-regex tests; no Git metadata in moved copy. | Avoid broad refactor; add behavioral tests and preserve backups |

## Audit coverage / next checks
| Area | Evidence now | Remaining |
|---|---|---|
| Auth / sessions / wallet | Existing suite baseline | Browser login/logout/session expiry; xPortal requires real user approval, no chain activity in audit |
| Privacy / idempotency / outbox / upload | Existing suite baseline | Adversarial journey matrix and targeted read-path gaps |
| Feed / Reels / profile | New behavior tests and authenticated browser journey | Real video on physical phone; complete feed/gesture matrix |
| Relations | Source and Privacy Matrix inspected | Distinct friend graph requirements and accepted/requested/blocked states |
| Comments / reactions / saves / internal repost | Existing suite baseline | Full two-account journeys |
| Messaging / camera / calls | Existing suite baseline | Authenticated browser, capabilities, real device, two-client calls |
| Other modules | Out of scope by user instruction | Do not audit or implement |

## Acceptance
No visual redesign. Preserve correct author and persona; pause obscured media; Back/X restore same viewer instance, current item and playback position; no stale-account restoration; navigation actions wait for history retirement. Every repair requires behavioral regression coverage. Browser and phone evidence are reported separately.

## Verification completed
- New navigation tests: 8 passed (history, single-flight destinations, context revocation, pause/resume, name/avatar routing and pointer capture, follow-state persistence).
- New Social read tests failed before the server patches and passed afterwards. Targeted read/privacy/profile suite: 32 passed.
- `npm run release:check`: PASS, 107 test files, 1,000 synthetic actors, 0 synthetic issues; isolated production smoke passed, insecure API denied. No real funds or external providers.
- App source remains below its unchanged 602,000-byte budget (601,811 bytes at this checkpoint). No CSS/design files edited.
- Browser on isolated `127.0.0.1:3217`: real email login with SYSTEM_TEST account; Social inbox -> Alex avatar -> contact -> profile -> second image fullscreen -> author click -> profile -> X and browser Back -> same `2 / 3`; next-arrow moves to `3 / 3`.
- Repeated at 390 x 844: profile return stays clickable; `inert` is not left on viewer; unfollow in profile updates underlying viewer; reopening profile shows persisted follower count 0. No observed console errors in this journey.
- Lab seeded images, not playable video. Exact video time is verified by behavioral unit test only, not real video playback or a physical phone. No claim that all gestures/calls or all Social screens are verified.
- The lab has a 900-second lifetime and a separate temporary database, no production configuration. The live 5000 server was NOT restarted. Frontend changes are available after reload; the two backend fixes require a coordinated restart of that process.

## Next Social-only packet
1. Agree/record real friendship semantics before replacing mutual-follow with a distinct friendship graph; do not silently broaden privacy.
2. Wire public-profile content tabs and text-post tiles to real destinations using existing components; retain visual design and caller return state.
3. Add author-profile pagination and true privacy-filtered totals rather than treating first-page length as the total.
4. Continue complete human journeys for comments/reactions/Moments/Social chat. Add regression tests for confirmed defects rather than more source-marker assertions.

## Handoff to DeepSeek
Read this file and the pre-edit snapshots in `.ephemeral/codex-nav-20260924/` before touching overlapping files. Do not overwrite the new profile navigation import/wiring. The backend changes are now active (checkpoint below); do not start a second worker against the same SQLite database. No direct DeepSeek acknowledgment has been received.

## Activation checkpoint — 2026-09-24, user-requested localhost:5000
- Port 5000 was no longer listening. Started one hidden `node server.js` process from `apps/nexus-web`, PID 9292, without changing `.env` or stopping any existing process.
- HTTP `http://localhost:5000/health`: ready. Existing database reports 33 users and 93 posts; no synthetic records added to it.
- Served `profile-navigation.js?v=20260924-nav1` exactly matches the current source file. Both frontend and backend repairs are active in this process.
- Syntax checks and the 10 dedicated regression tests pass on this activation.
- Opened `http://localhost:5000/` in the in-app browser. The actual sign-in screen loads; no observed browser console errors. No user session was available, so this is not an authenticated live-account acceptance test.
- Logs: `.ephemeral/server-5000-20260924-194619.out.log` and `.ephemeral/server-5000-20260924-194619.err.log` (stderr empty at activation).
- This is a running local process, not an installed auto-start service. Availability after laptop shutdown/reboot is not guaranteed by this checkpoint.
