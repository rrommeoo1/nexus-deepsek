This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Where the app actually lives

- The Android product is now built in `src/**` with React Native screens. `src/app/index.tsx` is a native feed/profile/login entry point; `src/app/camera.tsx` and `src/components/CaptureEditor.tsx` own the native capture flow. Do not restore a WebView as the primary UI or require `localhost:5000` for the installed app.
- `apps/nexus-web` remains the existing API, data store, and functional reference. The Android client uses `EXPO_PUBLIC_NEXUS_API_URL` (default: the owner's Railway URL) through `src/lib/nexusApi.ts`. Never ship service secrets in Expo public variables. Backend and Android client have separate release/version lifecycles.
- Migration is incomplete: native email login, feed, profile, camera, local drafts, emoji, and Jamendo search/preview exist, but native wallet auth, secure durable session transfer, media composition/upload/publishing, and remaining product screens still need work. Do not call the app feature-complete or remove existing server data.
- The old WebView test account and CDP login scripts are historical development helpers, not a path through the current Android UI. Use the native form and verified API contracts for new work; do not add a new WebView bridge.

## Development loop on the Android phone (no reinstall)

- Start or attach Metro with `npm run dev:metro` / `npm run dev:open`; edits under `src/**` arrive through Fast Refresh. The legacy `dev:android` command also starts the web server, but the new native UI does not need that server unless deliberately testing a local API.
- `npm run dev:ui` reads text rendered by the phone. Verify the target route and that the device is still showing Nexus; a Metro log alone is not proof.
- Rebuild and reinstall only when native dependencies, app config, permissions, or Expo/React Native versions change: `npm run build:android:dev`, then `npm run install:android`. Never uninstall or clear app data merely to update code; local captures/drafts would be lost.
- If the device sleeps, Fast Refresh may wait until wake. `npm run dev:open` reconnects the installed development client to Metro after a cold start. Every direct `adb` command must pin the selected serial (`-s <ip:port>`) because the same Xiaomi can appear under two transports.
- Do not use `dev:login`, WebView DevTools, DOM cookies, or the old client reload as evidence for native authentication. Test native login and `/api/me` independently, with synthetic local accounts unless the owner explicitly authorizes real-account verification.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
