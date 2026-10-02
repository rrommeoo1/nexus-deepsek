# Creator publishing flow — local implementation evidence

Date: 2026-10-01. Scope: capture/import → preview editor → publishing details → draft/post.
Capacity: UNOBSERVED/YELLOW; single agent. No production writes, paid services, real-user test posts or billing changes.

## Implemented

- Separate immersive review and compact, scrollable details screen. Footer buttons have fixed normal touch heights and remain outside the scrolling fields.
- Title, caption, thumbnail, hashtags, people search/mentions, manual/GPS place selection, HTTPS link, existing public/followers/friends/private audiences.
- Persisted comment/repost/download switches with server enforcement, AI declaration, opt-in local export and Nexus watermark preference.
- Crop/pan/rotation and original/music volume in a validated studio transform; shared filter rendering for preview, published presentation and export.
- Jamendo suggestions on image/video preview, bounded analysis failure fallback, segment playback, exact-track refresh for restored selections. Music stays externally referenced.
- Local autosave plus explicit account-synced drafts. Media references require owner/persona upload grants; maximum 20 account drafts; local gallery quota counts all files. Drafts available directly from camera navigation.
- Additive database migration, canonical post commitment includes publishing metadata; account export includes the new metadata/drafts and account deletion cascades drafts.
- Temporary local QA fixture was removed after browser checks.

## Executed checks

- `npm test`: initial complete run 712/712 passing; subsequently added two passing regression cases for gallery byte accounting and non-mutating sound synchronization.
- Final `npm run release:check`: PASS, all 116 test files; 1,000 synthetic actors, zero issues; isolated production-mode health PASS and insecure API denied. External network false, real funds false, incremental cost 0.
- `git diff --check`: PASS.
- Browser with isolated SYSTEM_TEST database: generated photo → preview → details → account save; preview/back preserves title, caption and comments toggle; refresh → camera Drafts → Edit restores media/title/caption.
- Browser: synthetic moving WebM (360 × 640, 2 seconds) reached loaded, playing preview and successfully published locally. Physical camera permission was denied in the automation browser; this is not a hardware-capture test.
- Browser: photo post appeared in its author's profile and full-screen viewer with title/caption. Synthetic actors remain excluded from organic feeds by design.
- Browser: opt-in photo export completed with the prepared-file status. No end-to-end video export, actual phone download manager, GPS provider or live Jamendo playback claim is made.

## External constraints / handoff

- No push or deployment performed for this packet. Production publication remains an explicit owner gate under AGENTS.md.
- Test runtime was stopped. Production credentials and existing user data were not used.
- Jamendo uses the existing configured free read integration. When unavailable, editing remains available with an honest error rather than simulated music.
- Download music only when the provider's `audiodownload_allowed` flag is true. Otherwise export omits Jamendo music and reports this; still images export as JPEG without audio. Allowed music exports carry artist/source/license credits. Source: [Jamendo tracks API](https://developer.jamendo.com/v3.0/tracks), inspected 2026-10-01.
- Video export uses browser Canvas/MediaRecorder in real time, is bounded by bytes/time, and needs a compatible browser, foreground execution and provider CORS. Animated stickers/time labels are rendered by the existing editor/catalog, not a newly purchased GIF service.
- Download restrictions govern the supported Nexus action, not screenshots, screen recording or a third-party client copying already-viewable media.
- GPS permission, microphone/camera permissions, physical Android/iOS capture, live sound and exported-video fidelity require device acceptance after an authorized deployment.
