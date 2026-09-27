# Post-180 actionable gap audit — cycle 181

Date: 2026-09-08  
Scope: Nexus Social local release candidate. This inventory distinguishes local
engineering gaps from external dependencies so neither category is misreported.

## Local actionable findings

1. **High — encrypted chat is available but not selected by default.** When exact
   device coverage is ready, the composer enables E2EE but leaves the checkbox
   unchecked. This conflicts with the product expectation of encrypted messaging.
2. **High — plaintext fallback lacks explicit per-send warning.** A user can send
   server-readable plaintext when E2EE is unavailable without acknowledging that
   transport difference at the moment of sending.
3. **Medium — E2EE readiness can change after rendering.** Server-side epoch and
   device-set validation rejects stale encryption, but UI regression evidence must
   prove that it never silently retries as plaintext.
4. **Medium — Story owner recovery UI needs explicit partial-failure behavior.** A
   Highlight can be created before adding its Story fails; retry must reuse the
   intended item operation and explain the orphaned empty Highlight.
5. **Medium — interaction state machines need a renewed mobile audit.** Fullscreen
   playback, long-press reactions and the comments drawer are individually tested,
   but combined back/keyboard/visibility transitions need a bounded regression set.

## External gates (not locally resolvable)

- Live broadcast requires an approved SFU/ingest/moderation provider.
- Breaking News requires a licensed, provenance-capable realtime provider.
- Google/Facebook and password-reset delivery require configured providers.
- WalletConnect/xPortal needs real-origin and device validation.
- Current CVE/SCA, independent security/crypto review and formal legal/license
  approval remain external; MultiversX NativeAuth GPL obligations require review.
- Global storage/transcoding/CDN and a production data topology cannot be proven by
  the current single-node SQLite release candidate.

Next packet: cycle 182, E2EE secure-by-default with exact-result tests.
