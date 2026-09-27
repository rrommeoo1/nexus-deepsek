import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalContentAddressedProvider, resolveMediaStorageProvider } from "../lib/storage-provider.js";
import { validateRuntimeConfig } from "../lib/env.js";

test("M4 local content-addressed provider is atomic, deterministic and path confined", () => {
  const root = mkdtempSync(join(tmpdir(), "nexus-m4-store-"));
  try {
    const provider = createLocalContentAddressedProvider(root);
    const key = `${"a".repeat(64)}.jpg`;
    assert.equal(provider.putIfAbsent(key, Buffer.from("one")).created, true);
    assert.equal(provider.putIfAbsent(key, Buffer.from("one")).created, false);
    assert.equal(provider.read(key).toString(), "one");
    assert.throws(() => provider.read("../secret"), /invalid storage object key/);
    assert.equal(provider.remove(key), true);
    assert.equal(provider.remove(key), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("M4 provider resolver fails closed for unimplemented or paid external providers", () => {
  const root = mkdtempSync(join(tmpdir(), "nexus-m4-provider-"));
  try {
    const local = resolveMediaStorageProvider({ mediaRoot: join(root, "media"), quarantineRoot: join(root, "quarantine"), env: {} });
    assert.equal(local.kind, "local-content-addressed");
    assert.equal(local.distributedReady, false);
    assert.match(local.externalProviderGate, /EXPLICIT_COST_APPROVAL/);
    assert.throws(() => resolveMediaStorageProvider({ mediaRoot: root, quarantineRoot: root, env: { NEXUS_MEDIA_STORAGE_PROVIDER: "s3" } }), /not available locally/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("M4 production configuration accepts the local default and rejects an unknown media provider", () => {
  const base = {
    NODE_ENV: "production", NEXUS_SESSION_SECRET: "x".repeat(32),
    NEXUS_WC_PROJECT_ID: "a".repeat(32), NEXUS_WC_PROJECT_ATTESTED: "true",
    NEXUS_ORIGIN: "https://nexus.example", NEXUS_WC_ATTESTED_ORIGINS: "https://nexus.example",
    NEXUS_ACCEPTED_ORIGINS: "https://nexus.example", NEXUS_RATE_LIMIT_MODE: "trusted-edge",
    NEXUS_TRUST_PROXY: "1", NEXUS_DATA_DIR: join(tmpdir(), "nexus-data"),
  };
  assert.equal(validateRuntimeConfig(base).mode, "production");
  assert.throws(() => validateRuntimeConfig({ ...base, NEXUS_MEDIA_STORAGE_PROVIDER: "s3" }), /NEXUS_MEDIA_STORAGE_PROVIDER/);
});

test("M4 mobile shell is installable metadata without caching protected responses", () => {
  const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.match(index, /rel="manifest"/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal("serviceworker" in manifest, false);
});

test("M4 realtime and push gates remain truthful and profile-bound", () => {
  const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
  assert.match(api, /channelForUser\(auth\.user\.id\)/);
  assert.match(api, /channelForCallPersona\(auth\.user\.id, auth\.persona\)/);
  assert.match(api, /push: "provider_and_consent_required"/);
  assert.match(api, /code: "CHANNEL_GATED"/);
});
