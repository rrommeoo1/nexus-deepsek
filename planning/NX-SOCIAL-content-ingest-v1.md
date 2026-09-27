# NX-SOCIAL content ingest v1 — receipt

Out-of-band catalog seeding for account 19 (`romeodeepsek`). The application itself
stays offline: it only serves local `/media/<hash>.<ext>` objects. Fetching happens
exclusively in `scripts/content-ingest.mjs`, run by hand, and is reversible through
`scripts/content-unseed.mjs`.

## Contract

| Item | Value |
| --- | --- |
| Schema | `NEXUS_CONTENT_INGEST_V1` |
| Marker | `provenance` is user-facing, so recovery uses `content_sources.ingest_marker = 'seeded_catalog'` + receipts in `data/content-ingest-receipts/` |
| Runtime egress | none (`release:check` still reports `external_network: false`) |
| Ingest egress | allowlisted hosts only: `commons.wikimedia.org`, `upload.wikimedia.org`, `thumb.wikimedia.org`, `api.openverse.org`, `ro.wikipedia.org`, `en.wikipedia.org` + trusted Openverse origins (`live.staticflickr.com`, `images.rawpixel.com`, `cdn.stocksnap.io`) |
| Licences admitted | CC0, Public domain/PDM, CC BY, CC BY-SA (versioned SPDX codes normalised). NC and ND variants are rejected |
| Size cap | 20 MB per asset, env-tunable through `NEXUS_INGEST_MAX_BYTES` (the same cap as the upload pipeline) |
| Clips | an oversized Commons video is published through its lightest transcode (`videoinfo` → `240p.vp9.webm` first), sized with a ranged GET because the asset cluster refuses HEAD |
| Clip duration | 600 s (`MAX_VIDEO_SECONDS`): a social clip feed takes clips, not documentaries |
| Idempotency | one attempt per source object per run; `content_sources.source_url` refuses a republish (`already_ingested`) |
| Politeness | 700 ms spacing between asset requests, 429/503 back-off with 4 attempts |
| Metadata | JPEG APP1/APP13/COM, PNG tEXt/zTXt/iTXt/eXIf, WebP EXIF/XMP removed in pure JS. Container-level video metadata is a declared limitation |
| Assessment | every caption passes `assessSocialContent` before the write; non-`ALLOW` captions are never published |
| Attribution | one `content_sources` row per admitted asset (provider, source URL, author, licence, licence URL, strip flag, retrieved_at) |
| Media admission | through the real pipeline (`storeMedia` → `repo.insertMedia` → `media_upload_grants`), so signature inspection and content addressing still apply |

## Commands

```
node scripts/content-ingest.mjs --plan
node scripts/content-ingest.mjs --dry-run --limit 4
NEXUS_CONTENT_INGEST=local-catalog node scripts/content-ingest.mjs --apply --user 19 --confirm-live-db [--only photos|clips|texts] [--limit N] [--no-stories]
NEXUS_CONTENT_INGEST=local-catalog NEXUS_INGEST_MAX_BYTES=3145728 node scripts/content-ingest.mjs --apply --user 19 --confirm-live-db --only clips
node scripts/content-unseed.mjs --dry-run --user 19
NEXUS_CONTENT_INGEST=local-catalog node scripts/content-unseed.mjs --apply --user 19 --confirm-live-db [--post <id>]
```

`--post` is a narrow cleanup and never expands into a full rollback; a full rollback is
the default when no `--post` is given. A receipt is flushed after every publication, so a
killed run stays recoverable, and a run stopped mid-flight can simply be repeated:
everything already admitted is skipped by the dedupe guard.

## Result for account 19

- 27 posts: 8 photos (Shots), 13 clips (Reels), 6 Romanian text posts (Whispers), one 2-reply thread via `comments.parent_id`
- 18 stories (24h TTL, `followers` visibility) + 3 highlights (Oraş, Natură, Atelier)
- 21 attribution rows, 20 media objects: Wikimedia Commons (CC BY-SA 4.0, Public domain, CC BY) and Openverse (by-sa 2.0, Flickr origin)

## Verification (round 2)

| Check | Result |
| --- | --- |
| Test suite, live copy and mirror | 487/487 pass (`test/content-ingest.test.js` 15, `test/seeded-catalog.test.js` 3) |
| `release:check` | PASS, `external_network: false`, 84 test files, 1000 synthetic actors with 0 issues |
| Pulse feed, live Chrome | 9 cards, no negative ids, no `demo` authors, 9/9 media loaded |
| Profile content tabs, live Chrome | Flow 17 media · Shots 8 · Reels 9 · Whispers text only; selecting a tab after a Settings panel restores the hero |
| Clip derivative, live pipeline | `Dark Skies (Timelapse HD).webm` 175 MB → published post 81 as `240p.vp9.webm`, stored 10.9 MB |
| Clip derivative, second proof | `Timelapse and Aerial of Canton 2014.webm` 56 MB → media 66 (5.6 MB), i.e. its 240p transcode |
| Dedupe guard | a repeated run reports `dedupe/already_ingested` for every clip it already published |
| Rollback drill (round 1) | full unseed removed 10 posts / 8 stories / 10 media files / 0 retained, then re-ingest repopulated |

## Round 2 — what changed

1. **Generated feed content is gone.** `demoSocialFeedPosts()` and the `allowDemoShowcase`
   merge were deleted from `public/app.js`: the Pulse feed renders exactly what
   `/api/social/feed` returned. The local showcase that remains (`demoHumanExperienceStories`)
   only fills the story rail of a *fresh* install, and the Curiosity Market keeps its own
   explicitly labelled demo objects.
2. **Profile content tabs restore the hero.** `renderOwnerProfileExperience` signals
   `onContentTab`, and `renderProfilePreview` selects the `Profile` section when the hero is
   hidden. Before this, opening a Settings tab and then a content tab updated a grid the
   viewer could not see until a reload.
3. **Clips are no longer capped by the original file size.** `commonsCandidates` resolves
   Commons transcodes with `prop=videoinfo`, `resolveVideoAsset` probes them cheapest-first
   with a ranged GET (`Content-Range` gives the true size; HEAD answers 429 on the asset
   cluster), and `MAX_VIDEO_SECONDS` refuses long documentaries.
4. **A throttled derivative lookup is retried.** The batched `videoinfo` call can be
   throttled, which used to cost every clip in that query; an oversized clip now gets one
   single-title retry at admission time.
5. **The ledger is idempotent.** `alreadyIngested` refuses a `source_url` already present in
   `content_sources`, and `ingestCategory` attempts each source object once per run instead of
   once per query.
6. **The receipt reports the stored resource.** `publishedEntry` names the derivative that was
   actually written plus the stored byte count. Live verification caught the original bug:
   post 75 is a 5.6 MB 240p transcode whose receipt said `via=original`.
7. **The admission budget is env-tunable** (`NEXUS_INGEST_MAX_BYTES`), which is how the
   derivative path was rehearsed against a tighter cap without editing code.

## Decision: SEEDED_CATALOG, and no fabricated engagement

`lib/repo.js` accepts a `SEEDED_CATALOG` traffic class next to `HUMAN_ORGANIC`, `PAID`,
`AGENT`, `SYSTEM_TEST` and `INCENTIVIZED`. Catalog rows are real rows that never count as
organic: they are excluded from discovery, ranking, qualified followers, Sigils and creator
support by the existing `traffic_class = 'HUMAN_ORGANIC'` predicates.

Cast accounts with seeded likes, follows and comments are therefore **not** created. Live
measurement shows why: `repo.postReactionSummary` and `repo.likeCount` count only organic
actors, so seeded engagement would be stored but invisible in every counter — exactly the
synthetic-traffic leak `scripts/actors.js` blocks as T0 (`ACTOR-RANK-001`). Counters on
catalog posts stay at real zeros until a real human reacts; `test/seeded-catalog.test.js`
pins that contract, including a positive control showing one human reaction does move it.

## Known limitations / next

1. Derivative discovery and probing are rate limited by Wikimedia: under sustained load a run
   can spend minutes in back-off and a clip falls back to `declared_too_large`. The fallback
   never publishes an oversized asset, and the receipt records the reason.
2. An out-of-band run writes to the same SQLite file the live server reads; the server's
   outbox dispatcher can log one `database is locked` line while a run is in flight.
3. Admitted media is recorded before the caption gate, so a caption rejected after admission
   leaves a media row and an attribution row without a post.
4. Container-level video metadata (moov/udta, Matroska Tags) is not stripped; only image
   metadata is removed in pure JS.
5. Engagement counters are real zeros on catalog posts (see the decision above).
6. Remaining roadmap: X feature surface, safety hardening and UX polish per the phase plan. The
   profile UX polish started with `planning/NX-SOCIAL-PROFILE-WHISPERS-v1.md` (compressed identity
   bar + Whispers timeline reusing the feed rail); X feature surface and safety hardening remain.