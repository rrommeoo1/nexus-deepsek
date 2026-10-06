# Nexus Android native — checkpoint 2026-10-06

This is an implementation checkpoint, not a claim of Android/web feature parity or a production release.

## Architecture now visible on Xiaomi

- `apps/nexus-mobile/src/app/index.tsx` renders native React Native login, Social feed, own profile and a direct `+` route to the existing native camera. It does not mount `react-native-webview` or depend on `localhost:5000` for the UI.
- `apps/nexus-mobile/src/lib/nexusApi.ts` reads the existing API, defaulting to the owner-provided Railway origin. It sends credentials with requests, does not bundle a Jamendo client secret, and validates internal media paths before constructing URLs. Native authentication currently uses the existing email-login cookie endpoint; durability across a cold Android restart has **not** been proven and needs a designed secure native-session contract.
- The native editor can append emoji to movable overlay text and search/select Jamendo CC BY suggestions through `/api/reels/sound-suggestions`, or pick a local audio file. Selection metadata is preserved in the existing version-1 local draft format through optional fields. Music and overlay text are **preview/draft only**: they are not composed into a final media file or published.
- All previous local capture and draft files remain in place. No Railway production mutation or deployment was performed.

## Focused parity matrix

| Capability | Web/backend reference | Android state | Next gate |
| --- | --- | --- | --- |
| Email sign-in | `/auth/email/login`, `/api/me` | Native form and API call; device authenticated session unverified | Synthetic-account login on Xiaomi, cold-restart persistence design |
| Feed | `/api/social/feed` | Native cards with images and playable video, conditional on session | Verify real response, paging, media/auth errors |
| Own profile | `/api/profiles/:handle?persona=social` | Native summary/posts, conditional on session | Verify privacy states and navigation to other profiles |
| Camera/gallery | Existing VisionCamera/ImagePicker route | Native capture/import/draft path retained | Repeat framing/media QA after new entry point |
| Emoji | Native editor text overlay | Selectable palette, movable with text | Separate draggable/resizable emoji/sticker model and export |
| Music | Jamendo suggestion API; requires configured provider | Search, choose, preview, draft metadata | Provider configuration check, token refresh, export/publication rights |
| Publishing | Resumable `/api/uploads`, `/api/social/posts` | Not connected | Verified resumable upload, compositing, idempotent post, feed/profile proof |
| Wallet auth, chat, other verticals | Existing web/backend | Not migrated | Security-reviewed native implementations, no WebView shortcut |

## Evidence

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npx expo export --platform android --output-dir builds/native-export-check`: pass, Android bundle produced.
- `npm run dev:ui` on Xiaomi 17 Pro showed `NEXUS`, `Android 0.1.0`, the native email/password form, `Feed`, `+`, and `Profil` after Fast Refresh. The phone then switched to another app; authenticated feed/profile and camera entry were not tested in this checkpoint.
- A new APK was not required or installed: these changes affect JavaScript only. The installed development client remains v0.1.0. There was no Railway deployment.
