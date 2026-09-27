# Nexus Messenger — human beta implementation

Owner request: apply the conversation-first Messenger prompt, 2026-09-12.
Scope: existing Nexus Social messaging, local-only, zero incremental spend.

This is the execution plan, not a declaration of WhatsApp parity. The latest
owner instruction supersedes the older specification's top-level Sent filter:
sent messages belong inside their conversations. The existing server filter is
retained for compatibility; no migration or external service is introduced.

## Acceptance packets

| Packet | Verifiable outcome | State |
| --- | --- | --- |
| MSG-01 | Messages opens conversations; accessible contextual controls, quick filters, attachment selection; existing audio/video controls in thread header | Implemented candidate; local deterministic checks passed; rendered/device acceptance pending |
| MSG-02 | Text and attachment drafts survive return; send/retry/edit/reply flows with explicit receipts and no duplicate intents | Pending. Existing send and receipts are present; full edit/reply/draft journey not complete |
| MSG-03 | Two-account audio/video calls under trusted HTTPS, incoming/decline/missed/reconnect/minimize; mobile permissions and back navigation | Existing local P2P wiring only. Real-device and cross-network verification pending; TURN/SFU not provisioned |
| MSG-04 | Camera preview, voice capture/preview/cancel, attachment progress and recovery across real keyboard/picker interruptions | Native photo/gallery/file selection and existing upload available; complete voice/capture journey pending |
| MSG-05 | Consent-based point/live location with duration/stop/expiry, membership revocation, encrypted payloads and provider policy | Not implemented. No simulated location button, tracking, external map provider or data egress |
| MSG-06 | Group roles/requests, media gallery, internal forwarding and group calls | Existing group administration/requests retained. Complete UX and group calling gates remain |
| MSG-07 | Rendered and physical-phone acceptance across keyboard, slow/offline, blocked access, RTL, large text and reduced motion | Pending; saved Browser restriction has not been bypassed |

## Non-negotiable acceptance

- Default screen shows conversations, not preferences or technical prose.
- Every interaction has an easy return; menus close on repeat click and Escape.
- Real account rows are server-authorized. SYSTEM_TEST examples stay separate,
  labeled and cannot place real calls or send real messages.
- Camera/file selection is not consent to send. No uploads before Send.
- Existing E2EE and explicit plaintext acknowledgement cannot be removed to
  simplify layout. No silent downgrade. No independent-audit claim.
- No external sharing, provider provisioning or incremental spend.
- A local release PASS is not physical-device UX acceptance or deployment approval.

## Next packet

### Owner addendum — module identities (2026-09-13)

Apply these rules to the rapid-avatar-card / calls / locked-chat prompt as well:

- One Nexus user can have different names, photos and profile information in
  Social, Dating, Work, Travel and Market. Resolve identity from the conversation's
  module, never by silently falling back to another module's photo.
- Keep conversations with the same person separate per module. A unified inbox
  is an authorized aggregate, not a merge of histories or identities.
- Provide a visible module selector (All / Social / Dating / Work / etc.), separate
  from All / Unread / Groups conversation-state filters. Filtering never changes
  the account's active sending identity or grants access.
- Show a clear text badge on each row, in the thread header and on messages.
  Color reinforces the badge but never replaces its text.
- Rapid avatar cards must open the matching module's profile and use that
  conversation's call/message permissions. They must not link to a public Social
  identity as a substitute for a restricted Dating identity.
- Locked chats, once implemented securely, must bind protection to owner,
  conversation and module. Search, notifications and quick cards must honor it.
- Audit same-user/multiple-module cases, missing photos, profile changes, wrong
  sending identity and filter pagination. Keep SYSTEM_TEST examples out of
  unrelated module filters.

Delivered candidate: visible module selector, contextual avatars/badges, separate
histories (existing backend), and wrong-identity send/call gating. Rapid avatar
cards and secure locked chats are still pending, not claimed implemented.

Evidence: `checkpoints/NX-MESSENGER-PERSONA-IDENTITY-01.md`.

MSG-02: preserve the real conversation draft and chosen attachment safely during
return/reopen, bound memory and account/persona scope, retain uncertain send intent
for idempotent retry, and make clearing/removing explicit. Then MSG-03 device calls.

Relevant evidence: `checkpoints/NX-MESSENGER-CONVERSATION-FIRST-01.md`.
