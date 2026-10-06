# Nexus Android — login visual checkpoint (2026-10-06)

Status: native login is mounted as the signed-out product screen in `src/app/index.tsx`, but **not yet visually verified or approved on Xiaomi**. Do not advance to feed, profile or menu until the owner approves login on Xiaomi.

## Evidence

- Web reference at 469 × 1022 CSS px, local copy of the existing web app: `planning/evidence-login-web-top-20261006.jpg`.
- Development-only QA screenshot: `planning/evidence-login-xiaomi-native-qa-20261006.png`. This capture is **not valid comparison evidence**: Codex was foreground, and Nexus is visible only in a small overlay. A clean capture of the normally launched app is still needed.
- Original Android login before this work: `planning/evidence-login-xiaomi-before-20261006.png`.

Computed web CSS was sampled at the reference viewport, including the final cascade in `styles.css`, `p3-visual-foundation.css` and `feed-surface.css`. The login token source is `apps/nexus-mobile/src/theme/tokens.ts`; visual components are `NexusLogin.tsx`, `NexusLandingBrand.tsx` and `NexusWordmark.tsx`. The actual card max-width is **430 px**, despite an earlier overridden `438px` declaration. The separate QA route is `src/app/login-preview.tsx`; it is disabled outside development and all actions are non-interactive. The product's signed-out state now renders `NexusLogin` directly.

## Open decisions and differences

1. The owner supplied `130312.jpg` as the first-page reference, confirming the white/silver CSS landing glyph plus `NEXUS` text for login. The native code transcribes that glyph to SVG, not the separate feed wordmark. A source adjustment removed nested React Native text runs to keep the measured CSS letter spacing consistent; it still needs a fresh Xiaomi capture.
2. The browser reference clips the signup form with no scrolling at this viewport. The native candidate allows scrolling; the owner must decide whether to preserve that defect or make signup reachable.
3. Browser and Android text glyph metrics differ because the repository does not bundle the web's `Inter` font. Exact numeric font-size/weight/spacing tokens are used; the text geometry is not pixel-identical.
4. The version line under the logo is intentionally added per owner request, shifting the auth panels downward relative to the current web landing.
5. Email sign-in now uses the existing Railway API path in the product login. Signup with local MultiversX wallet, xPortal NativeAuth, and recovery still require safe native ports; their controls currently report unavailable instead of mutating an account or claiming success. No production account mutation was used for this checkpoint.
6. After the owner reported that the long page did not scroll, the native form's `ScrollView` was made explicitly scrollable with a flex-growing content container and keyboard drag behavior. This still needs a physical swipe check on Xiaomi. The owner's `130315.jpg` is a Chrome desktop-mode view of Railway, not a capture of the native screen.
7. Source contract audit: `/auth/email/login` is available; `/auth/email/signup` returns HTTP 503 in ordinary production mode (the code permits an explicit preview-mode exception, pending an email-verification provider); `/auth/email/reset-request` returns HTTP 503 and directs recovery through xPortal. The native login now validates email length/shape and password length like the web; signup validates locally but deliberately does not create a wallet or account while the production gate is closed. xPortal requires a separate native WalletConnect/NativeAuth integration and is not implemented yet.

## Verification

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- Local arm64 development APK build from the previous checkpoint: pass; `react-native-svg` native module included, installed as an update on the Xiaomi without clearing application data. The latest product-screen mount changes only JavaScript and has **not yet been verified in a normal phone launch**.
- No Railway deploy, Play Store publication, paid service, database change, or camera/editor change.

For subsequent JS/style edits in this installed development build, Metro Fast Refresh suffices; adding another native dependency or changing app configuration will require a new APK.
