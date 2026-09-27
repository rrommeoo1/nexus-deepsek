# NX-SOCIAL profile Whispers timeline v1 — receipt

Owner request (2026-09-18): prepare the Whispers section of the profile after the attached
mock — one whisper after another, Facebook style, everything in the same flow — and compress
the avatar/description block, which used to own three quarters of the phone screen.

Scope: `public/profile-experience.js`, `public/profile-experience.css`, `public/app.js`,
`public/index.html`, `public/interface-locale.js`. No API, schema or engagement change.

## Contract

| Item | Value |
| --- | --- |
| Reading order | The Whispers tab is a single-column timeline of `text` posts, newest first. Flow/Reels/Shots keep the 3-column media grid. |
| Card shape | Identity (avatar, name, `@handle`, relative time), body with preserved line breaks, then a reaction / comment / repost rail. |
| Counters | Rendered from the post itself: `reactions.counts`, `comment_count`, `reposts`. A whisper nobody reacted to shows real zeros; no showcase numbers exist in the code path. |
| Controls | The profile renders the feed's own primitives. `reactionPaletteMarkup()` and `commentsDrawerMarkup()` have exactly one definition in `app.js` and two call sites (feed card and profile whisper), and `wirePostActions()` is invoked once for the profile host, so palette, thread and repost behave identically on both surfaces. |
| Palette and thread placement | A profile timeline is short, so the palette and the conversation open in place inside the card (`.ownerWhisperCard .reactionBar`, `.ownerWhisperCard>.comments`) instead of floating over the next whisper. |
| Tab integrity | Selecting a content tab restores the hero when Settings replaced it, and closes a whisper conversation opened in the tab being left, so the screen can never stay in comments mode behind a hidden list. |
| Compression | Identity row (78 px avatar, name, `@handle`, presence, inline counters, Edit + Create) plus a two-line clamped bio. The identity row only overlaps upward when the persona actually has a cover. Moment tiles are clamped to 54 px so a long story caption cannot stretch the rail. |
| Localisation | New key `profile.editShort` in all four locale blocks. Relative stamps come from `Intl.RelativeTimeFormat` in the interface locale, so no English-only string is emitted. |

## What changed

1. **Whispers are a timeline, not tiles.** `profileContentBuckets()` splits posts into the media
   grid and the whisper list; the old 100-character `textTile` preview is gone, so a whisper is no
   longer a square that silently does nothing when tapped.
2. **The profile reuses the feed rail.** `postCard` now calls `reactionPaletteMarkup()` and
   `commentsDrawerMarkup()` instead of holding the two markup strings inline; `profileWhisperControls()`
   supplies the same markup per whisper card. The extraction is output-identical for the feed.
3. **The hero is a compact identity bar.** Avatar 148 px → 78 px, counters inline instead of a
   56 px three-button block, Edit/Create as 34 px controls, bio clamped to two lines, cover 116 px → 72 px.
4. **Moment captions cannot stretch the rail.** Flex items default to `min-width:auto`, which made a
   nowrap caption size its own tile to 434 px; `min-width:0` restores the circle row.
5. **Tab leaving closes the thread.** `onTabLeave` closes any open whisper conversation before the
   list is hidden, which keeps `syncCommentsMode()` (bottom navigation visibility) truthful.

## Live verification (Chrome via CDP, account 19 `romeodeepsek`)

| Check | Result |
| --- | --- |
| Hero height / phone viewport | 150 px of 550 px rendered (≈0.27); previously the avatar, counters and action block alone consumed the viewport |
| Identity row vs sticky section tabs | `nameTop 213` > `tabsBottom 204` — no text hidden behind the tab bar. This is the bug the negative overlap margin used to create on a cover-less persona |
| Moment rail tiles | 9 buttons, all 48 px rendered (54 px layout) — no stretched caption |
| Whispers tab | 6 whisper cards, media grid hidden, no empty state shown |
| First card | "Romeo Deepsek (social) You · @romeodeepsek · 1 hr. ago", body line breaks preserved |
| Counters | `♡ 0`, `◌ 0`, `⟳ 0` chips inline; one seeded whisper reports its real `◌ 2` |
| Reaction | Palette expands in place inside the card (`insideCard true`, `coversNext false`, 8 buttons); LIKE writes `♡ 1` through the real endpoint and withdrawing returns `♡ 0` |
| Conversation | Drawer opens inside the card with the real empty state and form, `commentsModeActive` on; leaving the tab leaves 0 open drawers and `commentsModeActive` off |
| Feed regression | 13 feed cards keep 13 palettes / 13 drawers / 13 scrims, palette opens, thread opens and closes |
| Suite and gate | 493/493 tests in both copies (85 test files), `release:check` PASS, `external_network: false`, 0 synthetic issues |

## Not proven by this receipt

- No rendered-device acceptance at 360/390/430 px, landscape or 200% text was performed; the
  screenshots are a single Chrome window at one zoom level.
- Whisper cards intentionally expose reaction, comment and repost only. Save, internal send,
  support and the collectible entry point stay on the feed card, where their sheets exist.
- The reaction and comment journeys were rehearsed against one account and one seeded thread.
- A whisper conversation is an in-card expansion, not a modal; on a very long whisper the drawer
  still scrolls with the card.
