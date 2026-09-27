# Nexus Social — browser/device E2EE lab v1

Packet: `NX-WEB-SOCIAL-P01-REAL-DEVICE-LAB-HARNESS-035`  
Date: 2026-09-03  
Status: `PASS_LOCAL_HARNESS`; real-device and production gates remain open

## Purpose

This opt-in development harness measures the existing group content-key fanout in
a secure browser context. It creates 1–500 distinct P-256 recipient devices,
encrypts one 4,000-byte text payload, requires exact sorted/unique wrapper
coverage, and decrypts the first and last device samples.

It is deliberately not product navigation and cannot be served in production.
Enable it only with `NEXUS_DEVICE_LAB=true` while `NODE_ENV` is not `production`,
then open `/diagnostics/e2ee-device-lab` on localhost or a trusted HTTPS origin.

## Safety contract

- Static routing is exact and deny-by-default. The diagnostics page and module
  return 404 when disabled or in production. Raw/encoded traversal, encoded path
  separators, backslashes, NUL bytes, mixed-case Windows aliases and any other
  diagnostics route are rejected before filesystem resolution.
- The browser must expose a secure context, Web Crypto and IndexedDB. Otherwise
  the run control remains disabled.
- Keys, ciphertext and user-agent/fingerprint material are never included in the
  report. The harness initiates no fetch, XHR, WebSocket or beacon request and
  does not use browser storage.
- Cancellation is checked during key generation, after fanout encryption, after
  each edge-device decryption and immediately before publishing the report. A
  cancelled run has no downloadable result.
- The exported report is local evidence only. It cannot grant production
  approval, enable funds or replace an independent cryptographic audit.

## Local browser observation

The in-app desktop browser on `http://127.0.0.1:3099` completed a 50-device run:

- exact distinct-device coverage: PASS;
- first and last device decrypt: PASS;
- key generation: 75.2 ms;
- group encryption: 22.2 ms;
- sampled decryption: 2.5 ms / 1.5 ms;
- ciphertext: 4,062 shared bytes + 15,100 wrapper bytes;
- console warnings/errors: zero.

A separate 500-device run was cancelled from the UI. It reported cancellation,
discarded the result and kept download disabled. The manually selected `Android`
class is only a report label; this observation was not executed on Android and is
not represented as a real-phone result.

## Verification and remaining gates

- Focused harness tests: 3/3 PASS.
- Full Nexus Web suite: 197/197 PASS.
- Release check: PASS, 25 test files, 1,000 isolated `SYSTEM_TEST` actors, zero
  synthetic issues, zero external network, zero real funds and zero incremental
  cost.
- Independent bounded checker: `PASS_LOCAL`, 0 Critical / 0 High / 0 Medium.

Still mandatory before public release: trusted-HTTPS tests on representative real
Android/iOS/desktop devices, independent T0/T1 review, and a formal cryptographic
audit. The local harness must remain disabled in production.

