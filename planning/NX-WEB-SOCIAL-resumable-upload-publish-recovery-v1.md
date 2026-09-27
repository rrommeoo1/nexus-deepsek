# Nexus Social — resumable upload and publish recovery v1

Packet: `NX-WEB-SOCIAL-P02-RESUMABLE-UPLOAD-PUBLISH-RECOVERY-044`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The browser resumable-upload client and Social publication journey now preserve
one stable mutation identity across interrupted or ambiguous requests. A lost
create response can no longer cause the browser to mint a second upload session:
the create key is stored before network dispatch and reused on retry. Part and
completion keys remain stable as well, while server responses are structurally
validated before file bytes are sent.

Recovery behavior is explicit and fail-closed:

- a reachable `initiated` or `uploading` session resumes from confirmed parts;
- a `completed` session replays completion with the original key and recovers its
  media result;
- terminal `cancelled`, `failed` or `expired` sessions are cleared only after an
  authoritative status response, then a new session may be created;
- an unavailable status, assembling state, invalid protocol response, missing
  integrity API or unavailable local resume storage stops safely without deleting
  uncertain state;
- raw backend errors are not rendered to the user;
- the progress panel becomes a localized recoverable error state and the submit
  control is restored after failure;
- composer publication has a stable idempotency key for unchanged content and a
  new key whenever form input changes;
- message attachments, E2EE attachment upload, avatar and cover callers now catch
  upload-client failures rather than leaving an unhandled promise rejection.

Upload and publication status copy is available in Romanian, English, Polish and
Arabic with catalogue parity. External sharing remains disabled. No cloud object
store, CDN, external malware scanner, provider, real payment or chain action was
introduced.

## Findings resolved

- **High:** the create idempotency key was persisted only after the create response.
  A response lost after server commit could therefore lead to a second session.
  The complete resume envelope is now persisted before dispatch.
- **High:** a failed status read deleted local resume state. Uncertain server state
  is now preserved and the journey stops with a retryable, localized message.
- **High:** Social publish retried with a newly generated mutation key and could
  duplicate a post after an ambiguous response. The unchanged form now reuses one
  publish key; editing the form rotates it.
- **Medium:** upload failures could escape the composer, messaging or profile
  handlers as unhandled promise rejections. Every browser caller now maps the
  bounded upload errors to safe UI feedback.
- **Medium:** upload protocol fields were trusted without shape and byte-boundary
  validation. Session ID, sizes, part count and part array are validated before use.
- **Medium:** progress and failure states used Romanian strings and sometimes raw
  server errors. The bounded surface now uses stable RO/EN/PL/AR catalogue keys.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/resumable tests: `116/116` PASS.
- Full product suite: `210/210` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Upload concurrency remains covered by 100 isolated upload actors, interruption,
  idempotency conflict, cancellation, assembly retry and exactly-once outbox tests.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Real-browser interruption during upload,
mobile background/foreground recovery, storage-pressure behavior and production
object-storage multipart semantics still require trusted-HTTPS device testing and
independent T0/T1 review.

## Scope boundary

This packet covers browser upload recovery, publication idempotency, localized
upload/publish states and safe handling by the existing composer, message and
profile callers. It does not add production object storage, transcoding, CDN,
external malware scanning, Live ingest, commercial audio licensing or deployment.
