import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as ed25519Sign } from "node:crypto";
import { join, resolve } from "node:path";
import { UserSecretKey, Message, MessageComputer, Address } from "@multiversx/sdk-core";
import { openDb, resolveDataDirectory } from "../lib/db.js";
import { createRepo, payloadHash, normalizePersona, PERSONAS } from "../lib/repo.js";
import { hashPassword, verifyPassword, signToken, verifyToken, hashToken, sha256Hex } from "../lib/security.js";
import { inspectMedia, mediaDeliveryPolicy, storeMedia, readMedia } from "../lib/media.js";
import { generateWallet, walletFromMnemonic, encryptWallet, decryptWallet, isValidMnemonic } from "../lib/wallet.js";
import { mvxAddressToPublicKey, publicKeyToMvxAddress, createChallenge, verifyMvxSignature, resolveHerotag, validateNativeAuthToken, resolveMvxNetwork, buildNativeAuthInit, buildNativeAuthToken, nativeAuthSignableMessage, isLocalDevelopmentOrigin, createNativeAuthServer } from "../lib/mvx.js";
import { validateRuntimeConfig, walletConnectAttestation } from "../lib/env.js";
import {
  inspectLegacyWalletRows,
  purgeLegacyWalletRows,
} from "../lib/legacy-wallet-purge.js";
import { activateProvisionedRecoveryDevice, clearPendingRecoveryActivation, completeRecoveryActivationTransaction, computeConversationSafetyNumber, computeRecoveryAccountBinding, createRecoveryBundle, decryptChatAttachment, decryptChatMessage, encryptEnvelopeForDevice, encryptPayloadForDevice, evaluateSafetyObservation, openRecoveryBundle, persistPendingRecoveryActivation, readPendingRecoveryActivation, validateConversationKeyMaterial, verifySafetyObservation } from "../public/chat-crypto.js";
import { assessSocialContent, normalizeProvenance, REPORT_CATEGORIES } from "../lib/moderation.js";
import { creatorStudioHash, normalizeCreatorAudio, normalizeCreatorStudio } from "../lib/creator-studio.js";
import { applyInterfaceLocale, createInterfaceTranslator, interfaceLocaleCoverage, resolveInterfaceLocale, SUPPORTED_INTERFACE_LOCALES } from "../public/interface-locale.js";
import { createLatestRequestGate, createSingleFlightGate } from "../public/latest-request.js";

test("interface locale honors explicit account choice, device fallback and RTL without location inference", () => {
  assert.deepEqual(SUPPORTED_INTERFACE_LOCALES, ["ro", "en", "pl", "ar"]);
  assert.equal(resolveInterfaceLocale({ accountLocale: "ro", deviceLocales: ["pl-PL"] }), "ro");
  assert.equal(resolveInterfaceLocale({ accountLocale: "auto", deviceLocales: ["de-DE", "pl-PL"] }), "pl");
  assert.equal(resolveInterfaceLocale({ accountLocale: "auto", deviceLocales: ["ar-SA"] }), "ar");
  assert.equal(resolveInterfaceLocale({ accountLocale: "zz", deviceLocales: ["ro-RO"] }), "en");
  assert.equal(createInterfaceTranslator("pl")("nav.inbox"), "Wiadomości");
  assert.equal(createInterfaceTranslator("pl")("feed.sheetTitle"), "Wybierz, co chcesz zobaczyć");
  assert.equal(createInterfaceTranslator("en")("friends.requestAccepted"), "Request accepted ✓");
  assert.equal(createInterfaceTranslator("ar")("friends.empty"), "القائمة فارغة");
  assert.equal(createInterfaceTranslator("pl")("post.follow"), "Obserwuj");
  assert.equal(createInterfaceTranslator("ar")("comments.relevant"), "التعليقات ذات الصلة");
  assert.equal(createInterfaceTranslator("en")("feed.breakingDisabled"), "News is ready, but disabled");
  assert.equal(createInterfaceTranslator("pl")("viewer.backFeed"), "Wróć do strumienia");
  assert.equal(createInterfaceTranslator("ar")("comments.loadError"), "تعذر تحميل التعليقات");
  assert.equal(createInterfaceTranslator("en")("comments.withdrawnTombstone"), "Comment withdrawn · history is preserved");
  assert.equal(createInterfaceTranslator("pl")("trust.factualTitle"), "Weryfikacja faktów");
  assert.equal(createInterfaceTranslator("ar")("report.childSafety"), "سلامة الأطفال");
  assert.equal(createInterfaceTranslator("en")("review.note"), "The review is automated and fail-closed; it does not guarantee publication.");
  assert.equal(createInterfaceTranslator("en")("trust.signalPolitical"), "Political content detected; the viewpoint is not penalized.");
  assert.equal(createInterfaceTranslator("pl")("create.camera"), "Otwórz aparat");
  assert.equal(createInterfaceTranslator("ar")("draft.deleteError"), "تعذر حذف المسودة");
  assert.equal(createInterfaceTranslator("en")("camera.nativeFallback"), "The browser is using the native camera; HTTPS is required for a live preview.");
  assert.deepEqual(interfaceLocaleCoverage(), { ro: [], en: [], pl: [], ar: [] });
  const documentRef = { documentElement: { dataset: {} } };
  assert.deepEqual(applyInterfaceLocale(documentRef, "ar"), { locale: "ar", direction: "rtl" });
  assert.equal(documentRef.documentElement.lang, "ar");
  assert.equal(documentRef.documentElement.dir, "rtl");
});

test("Vercel preview data is isolated per deployment while local and production paths stay stable", () => {
  const base = resolve("preview-data-test");
  const preview = { NODE_ENV: "production", NEXUS_DEPLOYMENT_MODE: "preview", VERCEL_GIT_COMMIT_SHA: "a".repeat(40) };
  const first = resolveDataDirectory(base, preview);
  const second = resolveDataDirectory(base, { ...preview, VERCEL_GIT_COMMIT_SHA: "b".repeat(40) });
  assert.notEqual(first, second);
  assert.equal(first.startsWith(join(base, "preview-")), true);
  assert.equal(resolveDataDirectory(base, { NODE_ENV: "production", NEXUS_DEPLOYMENT_MODE: "production", VERCEL_GIT_COMMIT_SHA: "a".repeat(40) }), base);
  assert.equal(resolveDataDirectory(base, { NODE_ENV: "development", NEXUS_DEPLOYMENT_MODE: "preview" }), base);
});

test("latest request gate prevents stale tab responses from replacing the active view", () => {
  const gate = createLatestRequestGate();
  const followers = gate.begin();
  assert.equal(followers.isCurrent(), true);
  const favorites = gate.begin();
  assert.equal(followers.isCurrent(), false);
  assert.equal(favorites.isCurrent(), true);
  gate.invalidate();
  assert.equal(favorites.isCurrent(), false);
});

test("a delayed relation mutation cannot navigate back after the user changes tab", async () => {
  const gate = createLatestRequestGate();
  const requests = gate.begin();
  let finishMutation;
  const mutationFinished = new Promise((resolve) => { finishMutation = resolve; });
  const eventualUiAction = (async () => {
    await mutationFinished;
    return requests.isCurrent() ? "refresh-requests" : "keep-current-tab";
  })();
  const following = gate.begin();
  finishMutation();
  assert.equal(await eventualUiAction, "keep-current-tab");
  assert.equal(following.isCurrent(), true);
});

test("follow-request mutations are single-flight so one refresh cannot hide a later commit", async () => {
  const gate = createSingleFlightGate();
  let finishFirst;
  const firstCommit = new Promise((resolve) => { finishFirst = resolve; });
  const runMutation = async (commit) => {
    if (!gate.tryStart()) return "blocked";
    await commit;
    gate.finish();
    return "refresh-authoritative-list";
  };
  const first = runMutation(firstCommit);
  assert.equal(gate.isActive(), true);
  assert.equal(await runMutation(Promise.resolve()), "blocked");
  finishFirst();
  assert.equal(await first, "refresh-authoritative-list");
  assert.equal(gate.isActive(), false);
});

async function signupWithDeviceWallet(call, email, password, extra = {}) {
  const init = await call("/auth/email/signup-init", { email });
  assert.equal(init.status ?? init.statusCode, 200);
  const key = UserSecretKey.generate();
  const address = key.generatePublicKey().toAddress("erd").toBech32();
  const signature = Buffer.from(key.sign(Buffer.from(init.body.message, "utf8"))).toString("hex");
  return call("/auth/email/signup", {
    email,
    password,
    ...extra,
    wallet_proof: { nonce: init.body.nonce, address, signature },
  });
}

test("password hashing + verification (scrypt)", () => {
  const stored = hashPassword("hunter2secret");
  assert.ok(stored.includes(":"));
  assert.equal(verifyPassword("hunter2secret", stored), true);
  assert.equal(verifyPassword("wrong", stored), false);
});

test("signed session tokens roundtrip + expiry", () => {
  const token = signToken({ sub: 7, persona: "social", exp: Date.now() + 60000 });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 7);
  assert.equal(payload.persona, "social");
  assert.equal(hashToken(token), sha256Hex(token));
});

test("media store is content-addressed and integrity-checked", () => {
  const a = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.from("nexus-jpeg-fixture")]);
  const b = Buffer.from(a);
  const m1 = storeMedia(a, "image/jpeg");
  const m2 = storeMedia(b, "image/jpeg");
  assert.equal(m1.hash, m2.hash); // dedup by content hash
  assert.deepEqual(readMedia(m1.hash, m1.ext), a);
  assert.equal(m1.scanStatus, "ready_local_validation");
});

test("media rejects unsupported type", () => {
  assert.throws(() => storeMedia(Buffer.from("x"), "text/plain"), /unsupported/);
});

test("media delivery derives MIME and disposition only from an exact verified boundary", () => {
  const hash = "a".repeat(64);
  assert.deepEqual(mediaDeliveryPolicy({ hash, ext: "jpg", mime: "image/jpeg", detected_mime: "image/jpeg", kind: "image", scan_status: "ready_local_validation" }), {
    contentType: "image/jpeg",
    disposition: `inline; filename="nexus-${hash.slice(0, 12)}.jpg"`,
  });
  assert.equal(mediaDeliveryPolicy({ hash, ext: "jpg", mime: "text/html", detected_mime: "image/jpeg", kind: "image", scan_status: "ready_local_validation" }), null);
  assert.equal(mediaDeliveryPolicy({ hash, ext: "mp4", mime: "video/mp4", detected_mime: "image/jpeg", kind: "video", scan_status: "ready_local_validation" }), null);
  assert.deepEqual(mediaDeliveryPolicy({ hash, ext: "nxenc", mime: "application/vnd.nexus.e2ee", detected_mime: null, kind: "encrypted", scan_status: "ready_client_encrypted" }), {
    contentType: "application/octet-stream",
    disposition: `attachment; filename="nexus-encrypted-${hash.slice(0, 12)}.nxenc"`,
  });
});

test("media signature mismatch and documents remain quarantined without a malware scanner", () => {
  const fakeJpeg = inspectMedia(Buffer.from("not really a jpeg"), "image/jpeg");
  assert.equal(fakeJpeg.status, "quarantined");
  assert.equal(fakeJpeg.detectedMime, null);
  const pdf = inspectMedia(Buffer.from("%PDF-1.7\n1 0 obj\n<<>>"), "application/pdf");
  assert.equal(pdf.status, "quarantined");
  assert.equal(pdf.reason, "document_requires_malware_scanner");
  const activePdf = inspectMedia(Buffer.from("%PDF-1.7\n/OpenAction /JavaScript"), "application/pdf");
  assert.equal(activePdf.reason, "active_document_content_detected");
});

test("creator audio admits signed MP3/WAV/OGG bytes and rejects MIME substitution", () => {
  const mp3 = inspectMedia(Buffer.concat([Buffer.from("494433", "hex"), Buffer.from("nexus-audio")]), "audio/mpeg");
  assert.equal(mp3.status, "ready_local_validation");
  const wav = inspectMedia(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt ")]), "audio/wav");
  assert.equal(wav.status, "ready_local_validation");
  const ogg = inspectMedia(Buffer.concat([Buffer.from("OggS"), Buffer.from("nexus")]), "audio/ogg");
  assert.equal(ogg.status, "ready_local_validation");
  assert.equal(inspectMedia(Buffer.from("OggSnot-mp3"), "audio/mpeg").status, "quarantined");
});

test("Creator Studio canonicalizes exact non-destructive manifests and rights", () => {
  const manifest = normalizeCreatorStudio({
    version: 1, aspect: "VERTICAL_9_16", filter: "VIVID", intensity: 70,
    trimStartMs: 1_000, trimEndMs: 9_500, playbackRate: 1.5, muteOriginal: true,
    overlay: { text: "  Nexus   creator  ", position: "BOTTOM", color: "TEAL" },
  }, { mediaKind: "video" });
  assert.equal(manifest.overlay.text, "Nexus creator");
  assert.match(creatorStudioHash(manifest), /^[a-f0-9]{64}$/);
  assert.throws(() => normalizeCreatorStudio({ ...manifest, unexpected: true }, { mediaKind: "video" }), /MANIFEST_INVALID/);
  assert.throws(() => normalizeCreatorStudio({ ...manifest, trimEndMs: 1_000 }, { mediaKind: "video" }), /TIMELINE_INVALID/);
  assert.throws(() => normalizeCreatorStudio({ ...manifest, trimStartMs: 0, trimEndMs: 0 }, { mediaKind: "image" }), /IMAGE_TIMELINE_INVALID/);
  assert.equal(normalizeCreatorStudio(null, { mediaKind: "image" }).aspect, "ORIGINAL");
  assert.equal(normalizeCreatorAudio({ audioMediaId: 7, rights: "ORIGINAL_OWNED", attribution: " Artist  · track " }).attribution, "Artist · track");
  assert.throws(() => normalizeCreatorAudio({ audioMediaId: 7, rights: null }), /RIGHTS_REQUIRED/);
});

test("repo: Creator Studio binds edits and rights audio to the post commitment", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const author = repo.createUser({ handle: "studio-author", displayName: "Studio Author" });
    const viewer = repo.createUser({ handle: "studio-viewer", displayName: "Studio Viewer" });
    repo.ensurePersona(author.id, "social", { visibility: "public" });
    repo.ensurePersona(viewer.id, "social", { visibility: "public" });
    const image = repo.insertMedia({ hash: "a".repeat(64), ext: "png", mime: "image/png", detectedMime: "image/png", kind: "image", size: 20, uploadedBy: author.id, purpose: "social_post", scanStatus: "ready_local_validation", scanReason: "fixture" });
    const audio = repo.insertMedia({ hash: "b".repeat(64), ext: "wav", mime: "audio/wav", detectedMime: "audio/wav", kind: "audio", size: 20, uploadedBy: author.id, purpose: "social_audio", scanStatus: "ready_local_validation", scanReason: "fixture" });
    const manifest = normalizeCreatorStudio({
      version: 1, aspect: "SQUARE_1_1", filter: "MONO", intensity: 55,
      trimStartMs: 0, trimEndMs: 0, playbackRate: 1, muteOriginal: false,
      overlay: { text: "Nexus", position: "CENTER", color: "YELLOW" },
    }, { mediaKind: "image" });
    const post = repo.createPost({
      userId: author.id, persona: "social", kind: "image", caption: "Studio", mediaId: image.id,
      mediaEdit: manifest, audioMediaId: audio.id, audioRights: "ORIGINAL_OWNED", audioAttribution: "Studio Author · Original",
    });
    assert.equal(post.creator_studio.integrity, "VERIFIED");
    assert.equal(post.creator_studio.manifest.filter, "MONO");
    assert.equal(post.audio.id, audio.id);
    assert.equal(post.audio_rights, "ORIGINAL_OWNED");
    assert.equal(repo.canReadMedia(audio.id, viewer.id, "social"), true);
    assert.throws(() => repo.createPost({ userId: author.id, persona: "social", kind: "image", mediaId: image.id, mediaEdit: manifest, audioMediaId: audio.id }), /RIGHTS_REQUIRED/);
    db.prepare(`UPDATE posts SET media_edit_json = ? WHERE id = ?`).run(JSON.stringify({ ...manifest, intensity: 99 }), post.id);
    const tampered = repo.getPostById(post.id);
    assert.equal(tampered.creator_studio.integrity, "FAILED");
    assert.equal(tampered.audio, null);
    assert.equal(repo.canReadMedia(audio.id, viewer.id, "social"), false);
  } finally {
    db.close();
  }
});

test("multiversX bech32 address decodes to a 32-byte public key", () => {
  // A valid-looking erd1 address we control by hand is hard; assert invalid inputs fail.
  assert.equal(mvxAddressToPublicKey("not-an-address"), null);
  assert.equal(mvxAddressToPublicKey("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"), null);
});

test("mvx signature verification rejects wrong signature", () => {
  const address = "erd1";
  const ch = createChallenge({ address, persona: "social", nonce: "abc" });
  assert.equal(verifyMvxSignature(address, ch.message, "00".repeat(64)), false);
});

test("mvx bech32 address pubkey roundtrip (32-byte ed25519)", () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ type: "spki", format: "der" }).slice(-32));
  const address = publicKeyToMvxAddress(raw);
  assert.match(address, /^erd1/);
  assert.deepEqual(mvxAddressToPublicKey(address), raw);
});

test("mvx challenge rebuilds the exact message across api challenge/verify", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ type: "spki", format: "der" }).slice(-32));
  const address = publicKeyToMvxAddress(raw);

  // What /auth/mvx/challenge produces and stores:
  const challenge = createChallenge({ address, persona: "social" });
  // What /auth/mvx/verify must rebuild (with the stored issuedAt):
  const rebuilt = createChallenge({ address, persona: challenge.persona, nonce: challenge.nonce, issuedAt: challenge.issuedAt }).message;
  assert.equal(rebuilt, challenge.message);

  const signature = ed25519Sign(null, Buffer.from(challenge.message, "utf8"), privateKey).toString("hex");
  assert.equal(verifyMvxSignature(address, rebuilt, signature), true);
  assert.equal(verifyMvxSignature(address, "tampered message", signature), false);
});

test("mvx herotag resolution (xAlias) returns erd1 address via mock fetcher", async () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ type: "spki", format: "der" }).slice(-32));
  const expected = publicKeyToMvxAddress(raw);

  const fetcher = async (url) => ({
    ok: true,
    json: async () => ({ address: expected }),
  });

  // Resolves with / without leading '@'.
  assert.equal(await resolveHerotag("alex", { fetcher }), expected);
  assert.equal(await resolveHerotag("@alex", { fetcher }), expected);

  // Invalid format rejects without calling fetch.
  assert.equal(await resolveHerotag("ab", { fetcher }), null);
  assert.equal(await resolveHerotag("", { fetcher }), null);

  // When the API returns nothing usable, returns null.
  const failing = async () => ({ ok: false, json: async () => ({}) });
  assert.equal(await resolveHerotag("alex", { fetcher: failing }), null);
});

test("resolveMvxNetwork defaults to mainnet and maps devnet explicitly", () => {
  delete process.env.NEXUS_MVX_NETWORK;
  assert.equal(resolveMvxNetwork().label, "mainnet");
  assert.equal(resolveMvxNetwork().apiUrl, "https://api.multiversx.com");
  assert.equal(resolveMvxNetwork("devnet").label, "devnet");
  assert.equal(resolveMvxNetwork("devnet").apiUrl, "https://devnet-api.multiversx.com");
  assert.equal(resolveMvxNetwork("MAINNET").label, "mainnet");
});

test("buildNativeAuthInit mirrors the official native-auth client format", async () => {
  const blockHash = "a".repeat(64);
  const fetcher = async (url) => ({
    json: async () => {
      if (url.includes("/blocks/latest")) return [{ hash: blockHash }];
      return [{ hash: blockHash }];
    },
  });

  const init = await buildNativeAuthInit({
    network: "mainnet",
    origin: "https://nexus.example.com",
    expirySeconds: 86400,
    extraInfo: {},
    fetcher,
  });

  const enc = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  assert.equal(init, `${enc("https://nexus.example.com")}.${blockHash}.86400.${enc("{}")}`);
});

test("buildNativeAuthToken + nativeAuthSignableMessage assemble a valid token", () => {
  const address = "erd1qnk2vmuqywfqtdnkmauvpm8ls0xh00k8xeupuaf6cm6cd4rx89qqz0ppgl";
  const init = "abc.def.86400.e30";
  const sig = "00".repeat(64);
  const token = buildNativeAuthToken(address, init, sig);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9a-f]{128}$/);
  // signable message is address + init (exact bytes the wallet signs).
  assert.equal(nativeAuthSignableMessage(address, init), `${address}${init}`);
  assert.match(buildNativeAuthToken(address, init, sig), new RegExp(sig + "$"));
});

test("mvx native auth validation rejects malformed tokens", async () => {
  await assert.rejects(
    () => validateNativeAuthToken("not-a-token"),
    /invalid native auth token/,
  );
});

// local_mock_only integration: a wallet (simulated here with a real Ed25519
// key) signs a real NativeAuth token; the official server validator accepts it
// without any network (block timestamps are provided by an in-memory cache).
test("mvx native auth token signed by a wallet validates server-side (no network)", async () => {
  const enc = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const secret = UserSecretKey.generate();
  const address = secret.generatePublicKey().toAddress().toBech32();

  const origin = "http://192.168.1.153:3000";
  const blockHash = "a".repeat(64);
  const ttl = 3600;
  const rawBody = `${enc(origin)}.${blockHash}.${ttl}.${enc("{}")}`;
  const messageToSign = `${address}${rawBody}`;

  // Sign the exact bytes the server recomputes in validate().
  const signableMessage = new Message({
    address: new Address(address),
    data: Buffer.from(messageToSign, "utf8"),
  });
  const bytesToSign = new MessageComputer().computeBytesForSigning(signableMessage);
  const signature = Buffer.from(secret.sign(bytesToSign)).toString("hex");

  const accessToken = `${enc(address)}.${enc(rawBody)}.${signature}`;

  const issued = 1_000;
  const current = 4_500;
  const cache = {
    async getValue(key) {
      if (key === `block:timestamp:${blockHash}`) return issued;
      if (key === "block:timestamp:latest") return current;
      return undefined;
    },
    async setValue() {},
  };

  const previousOrigins = process.env.NEXUS_ACCEPTED_ORIGINS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NEXUS_ACCEPTED_ORIGINS = "http://localhost:3000";
  process.env.NODE_ENV = "development";
  try {
    const server = await createNativeAuthServer({ apiUrl: "http://unused", maxExpirySeconds: 86400, cache });
    const result = await server.validate(accessToken);
    assert.equal(result.address, address);
    assert.equal(result.origin, origin);
  } finally {
    if (previousOrigins === undefined) delete process.env.NEXUS_ACCEPTED_ORIGINS;
    else process.env.NEXUS_ACCEPTED_ORIGINS = previousOrigins;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("production runtime configuration fails closed before auth modules start", () => {
  assert.throws(() => validateRuntimeConfig({ NODE_ENV: "production" }), /NEXUS_SESSION_SECRET/);
  const valid = {
    NODE_ENV: "production",
    NEXUS_SESSION_SECRET: "s".repeat(64),
    NEXUS_WC_PROJECT_ID: "a".repeat(32),
    NEXUS_WC_PROJECT_ATTESTED: "true",
    NEXUS_WC_ATTESTED_ORIGINS: "https://nexus.example",
    NEXUS_ACCEPTED_ORIGINS: "https://nexus.example",
    NEXUS_RATE_LIMIT_MODE: "trusted-edge",
    NEXUS_TRUST_PROXY: "1",
    NEXUS_DATA_DIR: resolve("data-production-test"),
    NEXUS_ORIGIN: "https://nexus.example",
  };
  assert.deepEqual(validateRuntimeConfig(valid), { ok: true, mode: "production" });
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_ORIGIN: "http://nexus.example" }), /NEXUS_ORIGIN/);
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_RATE_LIMIT_MODE: "memory" }), /NEXUS_RATE_LIMIT_MODE/);
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_TRUST_PROXY: "0" }), /NEXUS_TRUST_PROXY/);
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_DATA_DIR: "relative-data" }), /NEXUS_DATA_DIR/);
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_WC_PROJECT_ATTESTED: "false" }), /NEXUS_WC_PROJECT_ATTESTED/);
  assert.throws(() => validateRuntimeConfig({ ...valid, NEXUS_WC_ATTESTED_ORIGINS: "https://other.example" }), /NEXUS_WC_ATTESTED_ORIGINS/);
  const preview = {
    ...valid,
    NEXUS_DEPLOYMENT_MODE: "preview",
    NEXUS_WC_PROJECT_ID: "",
    NEXUS_WC_PROJECT_ATTESTED: "false",
    NEXUS_WC_ATTESTED_ORIGINS: "",
  };
  assert.deepEqual(validateRuntimeConfig(preview), { ok: true, mode: "preview" });
  assert.throws(() => validateRuntimeConfig({ ...preview, NEXUS_SESSION_SECRET: "short" }), /NEXUS_SESSION_SECRET/);
});

test("WalletConnect readiness requires format, Dashboard attestation and exact origin", () => {
  const base = {
    NEXUS_WC_PROJECT_ID: "b".repeat(32),
    NEXUS_WC_PROJECT_ATTESTED: "true",
    NEXUS_WC_ATTESTED_ORIGINS: "http://192.168.1.153:3000,https://nexus.example",
  };
  assert.deepEqual(walletConnectAttestation(base, "http://192.168.1.153:3000"), {
    ready: true,
    projectIdConfigured: true,
    dashboardAttested: true,
    originAttested: true,
  });
  assert.equal(walletConnectAttestation({ ...base, NEXUS_WC_PROJECT_ATTESTED: "false" }, "http://192.168.1.153:3000").ready, false);
  assert.equal(walletConnectAttestation(base, "http://192.168.1.153:3001").ready, false);
  assert.equal(walletConnectAttestation({ ...base, NEXUS_WC_PROJECT_ID: "format-only" }, "http://192.168.1.153:3000").ready, false);
});

test("legacy wallet purge is permanently retired after the approved six-row deletion", () => {
  const db = openDb(":memory:");
  try {
    assert.equal(Number(db.prepare("PRAGMA secure_delete").get().secure_delete), 1);
    const user = createRepo(db).createUser({ handle: "purge-fixture", displayName: "Purge Fixture" });
    const insert = db.prepare("INSERT INTO wallets (user_id, address, kind, keystore, address_index) VALUES (?, ?, 'mnemonic', ?, 0)");
    for (let index = 0; index < 6; index += 1) {
      insert.run(user.id, `erd1fixture${index}`, JSON.stringify({ fixture: index }));
    }
    assert.deepEqual(inspectLegacyWalletRows(db), { count: 6 });
    assert.deepEqual(purgeLegacyWalletRows(db), { executed: false, before: 6, deleted: 0 });
    assert.equal(inspectLegacyWalletRows(db).count, 6);
    for (const attempt of [
      { execute: true },
      { execute: true, expectedCount: 5, approvalId: "NX-WEB-AUTH-P01-LEGACY-PURGE-20260823" },
      { execute: true, expectedCount: 6, approvalId: "NX-WEB-AUTH-P01-LEGACY-PURGE-20260823" },
    ]) {
      assert.throws(() => purgeLegacyWalletRows(db, attempt), /LEGACY_WALLET_PURGE_RETIRED/);
      assert.equal(inspectLegacyWalletRows(db).count, 6);
    }
  } finally {
    db.close();
  }
});

test("repo: persona isolation is deny-by-default (no cross-persona leak)", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const user = repo.createUser({ handle: "alice", displayName: "Alice" });
  for (const p of PERSONAS) repo.ensurePersona(user.id, p, {});
  // Persona resources are scoped per persona.
  repo.createPost({ userId: user.id, persona: "social", caption: "social post" });
  repo.createPost({ userId: user.id, persona: "work", caption: "work post" });
  assert.equal(repo.listPosts({ persona: "social" }).length, 1);
  assert.equal(repo.listPosts({ persona: "work" }).length, 1);
  assert.equal(repo.listPosts({ persona: "dating" }).length, 0);
});

test("repo: full social journey persists and survives through same DB", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const alice = repo.createUser({ handle: "alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "bob", displayName: "Bob" });
  repo.ensurePersona(alice.id, "social", { visibility: "public" });
  repo.ensurePersona(bob.id, "social", { visibility: "public" });

  const post = repo.createPost({ userId: alice.id, persona: "social", caption: "hello" });
  assert.equal(post.caption, "hello");

  repo.setFollow(alice.id, bob.id, "social", true);
  assert.equal(repo.isFollowing(alice.id, bob.id, "social"), true);

  repo.setLike(bob.id, post.id, "like", true);
  assert.equal(repo.likeCount(post.id), 1);
  assert.equal(repo.hasLiked(bob.id, post.id), true);

  repo.addComment(bob.id, post.id, "nice");
  assert.equal(repo.listComments(post.id).length, 1);

  repo.sendMessage(alice.id, bob.id, "hi bob");
  assert.equal(repo.listConversation(alice.id, bob.id).length, 1);

  const listing = repo.createListing({ userId: alice.id, persona: "market", title: "bike", price: "120 eGLD" });
  assert.equal(listing.title, "bike");

  const counts = repo.followCounts(bob.id, "social");
  assert.equal(counts.followers, 1);

  const stats = repo.stats();
  assert.equal(stats.users, 2);
  assert.equal(stats.posts, 1);

  db.close();
});

test("wallet generation derives an ed25519 mvx address from a 24-word mnemonic", () => {
  const w = generateWallet();
  assert.match(w.address, /^erd1/);
  assert.ok(w.mnemonic.split(" ").length >= 12);
  assert.equal(walletFromMnemonic(w.mnemonic, { addressIndex: 0 }).address, w.address);
});

test("wallet keystore roundtrip encrypts and decrypts the mnemonic", () => {
  const w = generateWallet();
  const ks = encryptWallet(w.mnemonic, "parola-secreta");
  const ks2 = encryptWallet(w.mnemonic, "parola-secreta");
  assert.equal(ks.kind, "mnemonic");
  assert.equal(ks.version, 2);
  assert.notEqual(ks.salt, ks2.salt);
  assert.equal(ks.cipher, "aes-256-gcm");
  // Plaintext mnemonic must never be stored inside the keystore.
  assert.ok(!JSON.stringify(ks).includes(w.mnemonic));
  assert.equal(decryptWallet(ks, "parola-secreta"), w.mnemonic);
  assert.equal(decryptWallet(ks, "parola-gresita"), null);
});

test("legacy wallet migration encryption has no production secret fallback", () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.NEXUS_WALLET_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.NEXUS_WALLET_SECRET;
  try {
    assert.throws(() => encryptWallet(generateWallet().mnemonic, "parola-secreta"), /NEXUS_WALLET_SECRET/);
    process.env.NEXUS_WALLET_SECRET = "m".repeat(64);
    const wallet = generateWallet();
    const encrypted = encryptWallet(wallet.mnemonic, "parola-secreta");
    assert.equal(decryptWallet(encrypted, "parola-secreta"), wallet.mnemonic);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
    if (previousSecret === undefined) delete process.env.NEXUS_WALLET_SECRET; else process.env.NEXUS_WALLET_SECRET = previousSecret;
  }
});

test("seed phrase validation accepts valid mnemonic, rejects garbage", () => {
  const w = generateWallet();
  assert.equal(isValidMnemonic(w.mnemonic), true);
  assert.equal(isValidMnemonic("cuvant lipsa"), false);
});

test("email signup binds a client-only wallet proof and never exposes reset bearers", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");

  const call = async (path, body, cookie) => {
    const res = fakeRes();
    await handleRequest(fakeReq("POST", path, cookie ?? "", body), res, { repo, sse, db });
    res.body = res.body ? JSON.parse(res.body) : {};
    res.status = res.statusCode;
    return res;
  };

  const signup = await signupWithDeviceWallet(call, "alex@example.com", "parola-secreta");
  assert.equal(signup.status, 201);
  assert.match(signup.body.wallet.address, /^erd1/);
  assert.equal("mnemonic" in signup.body, false);
  assert.equal(signup.body.recovery_required, true);
  assert.equal(signup.body.wallet.custody, "encrypted_on_this_device_only");
  assert.equal("verification_token" in signup.body, false);
  assert.equal("reset_token" in signup.body, false);
  assert.match(String(signup.headers["Set-Cookie"] ?? signup.headers["set-cookie"]), /^nexus_session=/);
  assert.equal(repo.listWallets(repo.getUserByEmail("alex@example.com").id).length, 0);

  // Login with email + password after verification.
  const login = await call("/auth/email/login", { email: "alex@example.com", password: "parola-secreta" });
  assert.equal(login.status, 200);
  const cookie = login.headers["set-cookie"];

  // Reset cannot disclose a bearer on the LAN demo.
  const resetReq = await call("/auth/email/reset-request", { email: "alex@example.com" });
  assert.equal(resetReq.status, 503);
  assert.equal("reset_token" in resetReq.body, false);
  const decoyResetReq = await call("/auth/email/reset-request", { email: "unknown@example.com" });
  assert.equal(decoyResetReq.status, 503);
  assert.deepEqual(Object.keys(decoyResetReq.body).sort(), Object.keys(resetReq.body).sort());
  const retired = await call("/auth/email/reset-confirm", { token: "forged", password: "noua-parola-123" });
  assert.equal(retired.status, 410);

  db.close();
});

test("Nexus username lookup resolves a local account wallet and keeps the legacy route compatible", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");

  const u = repo.createUser({ handle: "alex", displayName: "Alex", mvxAddress: "erd1qnk2vmuqywfqtdnkmauvpm8ls0xh00k8xeupuaf6cm6cd4rx89qqz0ppgl" });

  const call = async (path) => {
    const res = fakeRes();
    await handleRequest(fakeReq("GET", path, "", {}), res, { repo, sse, db });
    res.body = res.body ? JSON.parse(res.body) : {};
    res.status = res.statusCode;
    return res;
  };

  const found = await call("/auth/mvx/nexus-username?handle=@alex");
  assert.equal(found.status, 200);
  assert.equal(found.body.address, u.mvx_address);
  assert.equal(found.body.username, "alex");
  assert.equal(found.body.namespace, "nexus");

  const legacy = await call("/auth/mvx/nexus-herotag?handle=@alex");
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.address, u.mvx_address);

  const missing = await call("/auth/mvx/nexus-username?handle=necunoscut");
  assert.equal(missing.status, 404);

  const empty = await call("/auth/mvx/nexus-username");
  assert.equal(empty.status, 400);

  db.close();
});

test("claimUsername validates format and uniqueness", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const a = repo.createUser({ handle: "alice", displayName: "Alice" });
  const b = repo.createUser({ handle: "bob", displayName: "Bob" });

  // Invalid format.
  assert.equal(repo.claimUsername(a.id, "x").ok, false);
  // Taken by another user.
  assert.equal(repo.claimUsername(a.id, "bob").ok, false);
  // Valid + free.
  const r = repo.claimUsername(a.id, "xmusicpakistan");
  assert.equal(r.ok, true);
  assert.equal(r.user.handle, "xmusicpakistan");
  // Can rename own handle.
  assert.equal(repo.claimUsername(a.id, "alice").ok, true);

  db.close();
});

let fakeMutationSequence = 0;
function fakeReq(method, url, cookie, body, extraHeaders = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  const mutationHeaders = new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method)
    ? { "idempotency-key": `nexus-test-${String(++fakeMutationSequence).padStart(12, "0")}` }
    : {};
  return {
    method,
    url,
    headers: { "content-type": "application/json", cookie, ...mutationHeaders, ...extraHeaders },
    on(event, cb) {
      if (event === "data") process.nextTick(() => cb(raw));
      else if (event === "end") process.nextTick(() => cb());
      return this;
    },
    once() { return this; },
    destroy() {},
  };
}

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: "", ended: false };
  res.writeHead = (code, headers) => { res.statusCode = code; Object.assign(res.headers, headers); };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (data) => {
    res.ended = true;
    if (typeof data === "string") res.body = data;
    else if (Buffer.isBuffer(data)) res.body = data.toString("utf8");
  };
  return res;
}

function fixtureUploadedMedia(repo, { bytes, mime, purpose, userId, actorPersona = "social" }) {
  const stored = storeMedia(bytes, mime);
  const row = repo.insertMedia({ ...stored, uploadedBy: userId, purpose, actorPersona });
  const available = row.scan_status === "ready_local_validation";
  return {
    status: available ? 201 : 202,
    body: {
      ok: true,
      media: { ...row, available, url: available ? `/media/${row.hash}.${row.ext}` : null },
      safety: { local_signature_validation: true, malware_scanned: false, reason: row.scan_reason },
    },
  };
}

test("production health is useful for probes without leaking product counts or provider state", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    repo.createUser({ handle: "health-private-user", displayName: "Health Private User" });
    const { handleRequest } = await import("../lib/api.js");
    const response = fakeRes();
    await handleRequest(fakeReq("GET", "/health", "", {}), response, { repo, db, sse: { publish() {} } });
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(body).sort(), ["ok", "service", "status", "time"]);
    assert.equal(body.ok, true);
    assert.equal(body.status, "ready");
    assert.equal("users" in body, false);
    assert.equal("oauth" in body, false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    db.close();
  }
});

test("repo: post withdrawal enforces ownership and preserves a tombstone commitment", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const alice = repo.createUser({ handle: "alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "bob", displayName: "Bob" });
  const post = repo.createPost({ userId: alice.id, persona: "social", caption: "mine" });
  assert.equal(repo.deletePost(post.id, bob.id, "social"), null); // not owner
  assert.equal(repo.getPostById(post.id).caption, "mine");
  assert.equal(repo.deletePost(post.id, alice.id, "social").status, "withdrawn");
  const withdrawn = repo.getPostById(post.id);
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.caption, "");
  assert.match(withdrawn.content_commitment, /^[a-f0-9]{64}$/);
  db.close();
});

test("repo: unified messaging uses usernames upstream, isolates profile context and is replay-safe", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "msg-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "msg-bob", displayName: "Bob" });
    const carol = repo.createUser({ handle: "msg-carol", displayName: "Carol" });
    for (const user of [alice, bob, carol]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});

    const direct = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    assert.equal(direct.context_persona, "social");
    assert.deepEqual(direct.participants.map((item) => item.handle).sort(), ["msg-alice", "msg-bob"]);
    const first = repo.sendConversationMessage({ conversationId: direct.id, senderId: alice.id, senderPersona: "social", body: "hello", clientNonce: "nonce:direct:0001" });
    const replay = repo.sendConversationMessage({ conversationId: direct.id, senderId: alice.id, senderPersona: "social", body: "changed", clientNonce: "nonce:direct:0001" });
    assert.equal(replay.id, first.id);
    const second = repo.sendConversationMessage({ conversationId: direct.id, senderId: alice.id, senderPersona: "social", body: "newer", clientNonce: "nonce:direct:0002" });
    assert.equal(repo.listConversationMessages(direct.id, bob.id).length, 2);
    assert.equal(repo.listUnifiedConversations(bob.id, { persona: "social" })[0].unread, 2);
    assert.equal(repo.markConversationRead(direct.id, bob.id, first.id), true);
    assert.ok(repo.getConversationMessage(first.id).receipts[0].read_at);
    assert.equal(repo.getConversationMessage(second.id).receipts[0].read_at, null);
    assert.equal(repo.listUnifiedConversations(bob.id, { persona: "social" })[0].unread, 1);
    assert.equal(repo.markConversationRead(direct.id, bob.id, second.id), true);
    assert.equal(repo.markConversationRead(direct.id, bob.id, first.id), true, "an older replay cannot regress the read head");
    assert.equal(repo.markConversationRead(direct.id, bob.id, second.id + 1000), false);
    assert.equal(repo.listUnifiedConversations(bob.id, { persona: "social" })[0].unread, 0);
    assert.equal(repo.sendConversationMessage({ conversationId: direct.id, senderId: alice.id, senderPersona: "work", body: "wrong identity", clientNonce: "nonce:direct:0003" }), null);
    assert.equal(repo.listConversationMessages(direct.id, carol.id), null);

    const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, carol.id], title: "Echipă", contextPersona: "work" });
    assert.equal(group.kind, "group");
    assert.equal(group.participants.length, 3);
    assert.equal(group.participants.find((item) => item.id === bob.id).state, "pending");
    assert.equal(repo.scheduleConversationMeeting({ conversationId: group.id, creatorId: bob.id, title: "Too early", startsAt: 2_000_000_000, durationMinutes: 45 }), null);
    assert.equal(repo.decideGroupInvitation(group.id, bob.id, "accept").kind, "group");
    assert.equal(repo.listUnifiedConversations(alice.id, { persona: "social" }).length, 1);
    assert.equal(repo.listUnifiedConversations(alice.id, { persona: "work" }).length, 1);
    assert.equal(repo.scheduleConversationMeeting({ conversationId: group.id, creatorId: bob.id, title: "Plan", startsAt: 2_000_000_000, durationMinutes: 45 }).duration_minutes, 45);
  } finally {
    db.close();
  }
});

test("repo: message attachments require an owned locally-validated upload and conversation access", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "media-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "media-bob", displayName: "Bob" });
    const carol = repo.createUser({ handle: "media-carol", displayName: "Carol" });
    for (const user of [alice, bob, carol]) repo.ensurePersona(user.id, "social", {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const ready = repo.insertMedia({
      hash: "1".repeat(64), ext: "jpg", mime: "image/jpeg", detectedMime: "image/jpeg", kind: "image", size: 12,
      uploadedBy: alice.id, purpose: "message_attachment", scanStatus: "ready_local_validation", scanReason: "magic_signature_matched",
    });
    const quarantined = repo.insertMedia({
      hash: "2".repeat(64), ext: "pdf", mime: "application/pdf", detectedMime: "application/pdf", kind: "file", size: 12,
      uploadedBy: alice.id, purpose: "message_attachment", scanStatus: "quarantined", scanReason: "document_requires_malware_scanner",
    });
    assert.equal(repo.sendConversationMessage({ conversationId: conversation.id, senderId: bob.id, senderPersona: "social", attachmentMediaId: ready.id, kind: "image", clientNonce: "media:wrong-owner" }), null);
    assert.equal(repo.sendConversationMessage({ conversationId: conversation.id, senderId: alice.id, senderPersona: "social", attachmentMediaId: quarantined.id, kind: "file", clientNonce: "media:quarantined" }), null);
    const sent = repo.sendConversationMessage({ conversationId: conversation.id, senderId: alice.id, senderPersona: "social", attachmentMediaId: ready.id, kind: "image", clientNonce: "media:ready" });
    assert.ok(sent);
    assert.equal(repo.canReadMedia(ready.id, bob.id, "social"), true);
    assert.equal(repo.canReadMedia(ready.id, carol.id, "social"), false);
    assert.equal(repo.canReadMedia(quarantined.id, alice.id, "social"), false);
    const deduplicated = repo.insertMedia({
      hash: ready.hash, ext: ready.ext, mime: ready.mime, detectedMime: ready.detected_mime, kind: ready.kind, size: ready.size,
      uploadedBy: carol.id, purpose: "social_post", scanStatus: ready.scan_status, scanReason: ready.scan_reason,
    });
    assert.equal(deduplicated.id, ready.id);
    assert.equal(repo.hasMediaUploadGrant(ready.id, carol.id, "social_post", "social"), true);
  } finally {
    db.close();
  }
});

test("repo: message requests, receipts, expiry, presence and group administration fail closed", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "flow-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "flow-bob", displayName: "Bob" });
    const carol = repo.createUser({ handle: "flow-carol", displayName: "Carol" });
    const dan = repo.createUser({ handle: "flow-dan", displayName: "Dan" });
    for (const user of [alice, bob, carol, dan]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});

    const request = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social", requestRecipientId: bob.id });
    assert.equal(request.status, "request");
    assert.equal(request.participants.find((item) => item.id === bob.id).state, "pending");
    const expiry = Math.floor(Date.now() / 1000) + 60;
    const initial = repo.sendConversationMessage({ conversationId: request.id, senderId: alice.id, senderPersona: "social", body: "Salut", clientNonce: "request:initial:0001", expiresAt: expiry });
    assert.equal(initial.receipts.length, 1);
    assert.equal(initial.receipts[0].delivered_at, null);
    assert.equal(repo.sendConversationMessage({ conversationId: request.id, senderId: alice.id, senderPersona: "social", body: "Spam", clientNonce: "request:second:0002" }), null);
    assert.equal(repo.sendConversationMessage({ conversationId: request.id, senderId: bob.id, senderPersona: "social", body: "Before accept", clientNonce: "request:reply:0003" }), null);
    assert.equal(repo.markConversationDelivered(request.id, bob.id, 1000), true);
    assert.equal(repo.getConversationMessage(initial.id).receipts[0].delivered_at, 1000);
    assert.equal(repo.markConversationRead(request.id, bob.id), true);
    assert.ok(repo.getConversationMessage(initial.id).receipts[0].read_at);
    assert.equal(repo.decideConversationRequest(request.id, alice.id, "accept"), null);
    assert.equal(repo.decideConversationRequest(request.id, bob.id, "accept").status, "active");
    assert.ok(repo.sendConversationMessage({ conversationId: request.id, senderId: bob.id, senderPersona: "social", body: "Acceptat", clientNonce: "request:reply:0004" }));
    assert.equal(repo.purgeExpiredMessages(expiry + 1), 1);
    const expired = repo.getConversationMessage(initial.id);
    assert.equal(expired.status, "expired");
    assert.equal(expired.body, "");
    assert.equal(expired.attachment_media_id, null);

    repo.touchPresence(bob.id, "social", 5000);
    assert.equal(repo.getConversationDetails(request.id, alice.id).participants.find((item) => item.id === bob.id).last_seen_at, 5000);
    repo.setTypingIndicator(request.id, bob.id, true, 6000);
    assert.deepEqual(repo.listTypingIndicators(request.id, alice.id, 6004).map((item) => item.handle), ["flow-bob"]);
    assert.deepEqual(repo.listTypingIndicators(request.id, alice.id, 6009), []);

    const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, carol.id], title: "Core", contextPersona: "social" });
    assert.equal(repo.updateGroupTitle(group.id, bob.id, "Nope"), null);
    const beforeJoin = repo.sendConversationMessage({ conversationId: group.id, senderId: alice.id, senderPersona: "social", body: "Istoric privat", clientNonce: "group:history:0001" });
    assert.deepEqual(repo.listConversationMessages(group.id, bob.id), []);
    repo.markConversationDelivered(group.id, bob.id, 7000);
    assert.equal(repo.getConversationMessage(beforeJoin.id).receipts.find((item) => item.user_id === bob.id).delivered_at, null);
    assert.equal(repo.decideGroupInvitation(group.id, bob.id, "accept").kind, "group");
    assert.deepEqual(repo.listConversationMessages(group.id, bob.id), []);
    assert.ok(repo.sendConversationMessage({ conversationId: group.id, senderId: alice.id, senderPersona: "social", body: "După acceptare", clientNonce: "group:visible:0002" }));
    assert.deepEqual(repo.listConversationMessages(group.id, bob.id).map((item) => item.body), ["După acceptare"]);
    assert.equal(repo.addGroupMember(group.id, bob.id, dan.id), null);
    assert.equal(repo.addGroupMember(group.id, alice.id, dan.id).participants.find((item) => item.id === dan.id).state, "pending");
    assert.equal(repo.decideGroupInvitation(group.id, dan.id, "accept").kind, "group");
    assert.equal(repo.removeGroupMember(group.id, bob.id, alice.id), false);
    assert.equal(repo.removeGroupMember(group.id, alice.id, dan.id), true);
  } finally {
    db.close();
  }
});

test("repo: E2EE envelopes require exact active-device coverage and never persist plaintext/private keys", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "e2ee-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "e2ee-bob", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const aliceDevice = "device:alice:00000001";
    const bobDevice = "device:bob:0000000001";
    const publicJwkA = { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) };
    const publicJwkB = { kty: "EC", crv: "P-256", x: "C".repeat(43), y: "D".repeat(43) };
    assert.equal(repo.registerChatDevice(alice.id, { deviceId: aliceDevice, label: "Alice phone", publicJwk: { ...publicJwkA, d: "secret" } }), null);
    assert.equal(repo.registerChatDevice(alice.id, { deviceId: aliceDevice, label: "Alice phone", publicJwk: publicJwkA }).status, "active");
    assert.equal(repo.registerChatDevice(bob.id, { deviceId: bobDevice, label: "Bob phone", publicJwk: publicJwkB }).status, "active");
    assert.equal("d" in repo.listChatDevices(alice.id)[0].public_jwk, false);
    const material = repo.conversationDeviceSet(conversation.id, alice.id);
    assert.equal(material.ready, true);
    assert.deepEqual(material.devices.map((device) => device.device_id), [aliceDevice, bobDevice].sort());
    const nonce = "e2ee:nonce:00000001";
    const envelopeFor = (recipientDeviceId, commitment = material.commitment) => ({
      recipient_device_id: recipientDeviceId,
      iv_b64: Buffer.alloc(12, 1).toString("base64"),
      ciphertext_b64: Buffer.from(`cipher:${recipientDeviceId}`).toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 2,
        conversation_id: conversation.id,
        client_nonce: nonce,
        sender_device_id: aliceDevice,
        recipient_device_id: recipientDeviceId,
        device_set_commitment: commitment,
        key_epoch: material.key_epoch,
        key_epoch_commitment: material.key_epoch_commitment,
      })),
    });
    assert.equal(repo.sendEncryptedConversationMessage({
      conversationId: conversation.id,
      senderId: alice.id,
      senderPersona: "social",
      senderDeviceId: aliceDevice,
      clientNonce: nonce,
      deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment,
      envelopes: [envelopeFor(aliceDevice)],
    }).error, "device_coverage_invalid");
    const sent = repo.sendEncryptedConversationMessage({
      conversationId: conversation.id,
      senderId: alice.id,
      senderPersona: "social",
      senderDeviceId: aliceDevice,
      clientNonce: nonce,
      deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment,
      envelopes: [envelopeFor(aliceDevice), envelopeFor(bobDevice)],
    });
    assert.equal(sent.ok, true);
    assert.equal(sent.message.encryption_mode, "e2ee_v1");
    assert.equal(sent.message.body, "");
    assert.equal(repo.db.prepare(`SELECT COUNT(*) count FROM message_ciphertext_envelopes WHERE message_id = ?`).get(sent.message.id).count, 2);
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobDevice).recipient_device_id, bobDevice);
    assert.equal(repo.getMessageEnvelope(sent.message.id, alice.id, bobDevice), null);
    assert.equal(repo.sendEncryptedConversationMessage({
      conversationId: conversation.id,
      senderId: alice.id,
      senderPersona: "social",
      senderDeviceId: aliceDevice,
      clientNonce: nonce,
      deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment,
      envelopes: [envelopeFor(aliceDevice), envelopeFor(bobDevice)],
    }).replay, true);

    const bobSecond = "device:bob:0000000002";
    repo.registerChatDevice(bob.id, { deviceId: bobSecond, label: "Bob laptop", publicJwk: { kty: "EC", crv: "P-256", x: "E".repeat(43), y: "F".repeat(43) } });
    const stale = repo.sendEncryptedConversationMessage({
      conversationId: conversation.id,
      senderId: alice.id,
      senderPersona: "social",
      senderDeviceId: aliceDevice,
      clientNonce: "e2ee:nonce:00000002",
      deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment,
      envelopes: [envelopeFor(aliceDevice), envelopeFor(bobDevice)],
    });
    assert.equal(stale.error, "key_epoch_stale");
    assert.equal(repo.revokeChatDevice(bob.id, bobDevice), true);
    assert.equal(repo.registerChatDevice(bob.id, { deviceId: bobDevice, label: "revive", publicJwk: publicJwkB }), null);
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobDevice), null);
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobSecond), null);
  } finally {
    db.close();
  }
});

test("browser E2EE v1 encrypts per device, roundtrips and rejects binding tamper", async () => {
  const aliceKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const bobKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const alicePublic = await crypto.subtle.exportKey("jwk", aliceKeys.publicKey);
  const bobPublic = await crypto.subtle.exportKey("jwk", bobKeys.publicKey);
  const binding = {
    conversationId: 71,
    clientNonce: "e2ee:browser:test:0001",
    deviceSetCommitment: "a".repeat(64),
    keyEpoch: 7,
    keyEpochCommitment: "e".repeat(64),
    senderDevice: { deviceId: "device:alice:browser:1", privateKey: aliceKeys.privateKey },
    recipient: { device_id: "device:bob:browser:001", public_jwk: bobPublic },
    text: "Mesaj local criptat",
    createdAt: 1_788_000_000_000,
  };
  const encrypted = await encryptEnvelopeForDevice(binding);
  assert.notEqual(encrypted.ciphertext_b64.includes(binding.text), true);
  const message = {
    id: 401,
    conversation_id: binding.conversationId,
    kind: "encrypted",
    client_nonce: binding.clientNonce,
    sender_device_id: binding.senderDevice.deviceId,
    device_set_commitment: binding.deviceSetCommitment,
    key_epoch: binding.keyEpoch,
    key_epoch_commitment: binding.keyEpochCommitment,
    encryption_mode: "e2ee_v1",
    envelope: {
      ...encrypted,
      message_id: 401,
      conversation_id: binding.conversationId,
      client_nonce: binding.clientNonce,
      sender_device_id: binding.senderDevice.deviceId,
      device_set_commitment: binding.deviceSetCommitment,
      key_epoch: binding.keyEpoch,
      key_epoch_commitment: binding.keyEpochCommitment,
      sender_public_jwk: { kty: alicePublic.kty, crv: alicePublic.crv, x: alicePublic.x, y: alicePublic.y },
    },
  };
  assert.equal(await decryptChatMessage(message, { deviceId: binding.recipient.device_id, privateKey: bobKeys.privateKey }), binding.text);
  await assert.rejects(
    decryptChatMessage({ ...message, envelope: { ...message.envelope, device_set_commitment: "b".repeat(64) } }, { deviceId: binding.recipient.device_id, privateKey: bobKeys.privateKey }),
    /context is invalid|binding mismatch/,
  );
  await assert.rejects(
    decryptChatMessage({ ...message, client_nonce: "e2ee:browser:other:0001" }, { deviceId: binding.recipient.device_id, privateKey: bobKeys.privateKey }),
    /context is invalid/,
  );
  await assert.rejects(
    decryptChatMessage({ ...message, envelope: { ...message.envelope, message_id: 402 } }, { deviceId: binding.recipient.device_id, privateKey: bobKeys.privateKey }),
    /context is invalid/,
  );
  await assert.rejects(
    decryptChatMessage({ ...message, envelope: { ...message.envelope, sender_public_jwk: { ...message.envelope.sender_public_jwk, d: "private" } } }, { deviceId: binding.recipient.device_id, privateKey: bobKeys.privateKey }),
    /context is invalid/,
  );
});

test("browser E2EE safety number binds the canonical device set and fails closed on key changes", async () => {
  const devices = [
    { device_id: "device:safety:alice:01", user_id: 1, key_algorithm: "ECDH-P256", public_jwk: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) } },
    { device_id: "device:safety:bob:0001", user_id: 2, key_algorithm: "ECDH-P256", public_jwk: { kty: "EC", crv: "P-256", x: "C".repeat(43), y: "D".repeat(43) } },
  ];
  const commitment = sha256Hex(JSON.stringify(devices));
  const current = await computeConversationSafetyNumber({ conversation_id: 73, commitment, devices: [...devices].reverse() });
  assert.match(current.display, /^\d{5}( \d{5}){11}$/);
  assert.equal(current.compact.length, 60);
  const first = evaluateSafetyObservation(null, current, 1000);
  assert.equal(first.state, "unverified");
  const verified = verifySafetyObservation(first.record, current, 1001);
  assert.equal(verified.state, "verified");
  assert.equal(evaluateSafetyObservation(verified.record, current, 1002).state, "verified");

  const changedDevices = devices.map((device, index) => index ? { ...device, public_jwk: { ...device.public_jwk, x: "E".repeat(43) } } : device);
  const changed = await computeConversationSafetyNumber({ conversation_id: 73, commitment: sha256Hex(JSON.stringify(changedDevices)), devices: changedDevices });
  const warning = evaluateSafetyObservation(verified.record, changed, 1003);
  assert.equal(warning.state, "changed");
  assert.equal(warning.record.verifiedCommitment, current.commitment, "a changed key cannot silently replace the verified baseline");
  assert.equal(evaluateSafetyObservation(warning.record, changed, 1004).state, "changed", "the warning remains fail-closed after a reload");
  const reverified = verifySafetyObservation(warning.record, changed, 1005);
  assert.equal(reverified.state, "verified");
  assert.equal(evaluateSafetyObservation(reverified.record, changed, 1006).state, "verified");
  await assert.rejects(
    computeConversationSafetyNumber({ conversation_id: 73, commitment, devices: changedDevices }),
    /commitment mismatch/,
  );
});

test("browser validates E2EE key material against conversation, viewer, persona and exact device coverage", async () => {
  const participants = [
    { user_id: 1, handle: "alice" },
    { user_id: 2, handle: "bob" },
  ];
  const devices = [
    { device_id: "device:keymat:alice:01", user_id: 1, handle: "alice", key_algorithm: "ECDH-P256", public_jwk: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) } },
    { device_id: "device:keymat:bob:0001", user_id: 2, handle: "bob", key_algorithm: "ECDH-P256", public_jwk: { kty: "EC", crv: "P-256", x: "C".repeat(43), y: "D".repeat(43) } },
  ];
  const commitment = sha256Hex(JSON.stringify(devices.map(({ device_id, user_id, key_algorithm, public_jwk }) => ({ device_id, user_id, key_algorithm, public_jwk }))));
  const material = {
    ok: true,
    query: { conversation_id: 91, viewer_id: 1, viewer_persona: "social" },
    privacy_enforced_server_side: true,
    conversation_id: 91,
    conversation_persona: "social",
    conversation_kind: "direct",
    protocol: "NEXUS_E2EE_V2_EPOCH_BOUND_ECDH_P256_HKDF_SHA256_AES_256_GCM",
    server_has_private_keys: false,
    ratcheting_sender_key_audit_complete: false,
    commitment,
    key_epoch: 3,
    key_epoch_commitment: "e".repeat(64),
    participants,
    devices,
    users_without_devices: [],
    users_exceeding_device_limit: [],
    blocked_relationship: false,
    ready: true,
  };
  const expected = { conversationId: 91, viewerId: 1, persona: "social", currentDeviceId: devices[0].device_id };
  const valid = await validateConversationKeyMaterial(material, expected);
  assert.equal(valid.ready, true);
  assert.equal(valid.devices.length, 2);
  await assert.rejects(validateConversationKeyMaterial({ ...material, query: { ...material.query, viewer_id: 2 } }, expected), /scope is invalid/);
  await assert.rejects(validateConversationKeyMaterial({ ...material, conversation_persona: "work" }, expected), /scope is invalid/);
  await assert.rejects(validateConversationKeyMaterial({ ...material, commitment: "f".repeat(64) }, expected), /commitment mismatch/);
  await assert.rejects(validateConversationKeyMaterial({ ...material, devices: devices.map((device, index) => index ? device : { ...device, public_jwk: { ...device.public_jwk, d: "secret" } }) }, expected), /public device material is invalid/);
  await assert.rejects(validateConversationKeyMaterial(material, { ...expected, currentDeviceId: "device:keymat:unknown:01" }), /current device coverage is invalid/);
  await assert.rejects(validateConversationKeyMaterial({ ...material, ready: false }, expected), /readiness is inconsistent/);
});

test("browser E2EE recovery package is opt-in, forward-only and fails closed on wrong password or tamper", async () => {
  const generated = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const passphrase = "correct horse nexus recovery 2026";
  const createdAt = 1_788_500_000_000;
  const accountBinding = sha256Hex("NEXUS_E2EE_ACCOUNT_BINDING_V1:29:erd1fixture");
  const bundle = await createRecoveryBundle({
    accountBinding,
    deviceId: "device:recovery:00000000-0000-4000-8000-000000000029",
    publicJwk,
    privateJwk,
    passphrase,
    createdAt,
  });
  assert.equal(bundle.scope, "future_messages_only");
  assert.equal(bundle.history_start_at, createdAt);
  assert.equal(bundle.kdf.iterations, 600_000);
  assert.equal("private_jwk" in bundle, false);
  assert.equal(JSON.stringify(bundle).includes(privateJwk.d), false, "the private scalar must only exist inside authenticated ciphertext");

  const opened = await openRecoveryBundle(JSON.stringify(bundle), passphrase, accountBinding);
  assert.equal(opened.deviceId, bundle.device_id);
  assert.equal(opened.historyStartAt, createdAt);
  assert.equal(opened.privateJwk.d, privateJwk.d);
  assert.deepEqual(opened.publicJwk, { kty: "EC", crv: "P-256", x: publicJwk.x, y: publicJwk.y });

  await assert.rejects(openRecoveryBundle(bundle, "incorrect nexus recovery password", accountBinding), /package or passphrase is invalid/);
  await assert.rejects(openRecoveryBundle(bundle, passphrase, sha256Hex("different-account")), /different Nexus account/);
  const tampered = structuredClone(bundle);
  tampered.cipher.ciphertext_b64 = (tampered.cipher.ciphertext_b64[0] === "A" ? "B" : "A") + tampered.cipher.ciphertext_b64.slice(1);
  await assert.rejects(openRecoveryBundle(tampered, passphrase, accountBinding), /package or passphrase is invalid/);
  await assert.rejects(createRecoveryBundle({
    accountBinding,
    deviceId: bundle.device_id,
    publicJwk: { ...publicJwk, x: "Z".repeat(43) },
    privateJwk,
    passphrase,
    createdAt,
  }), /key pair does not match/);
  await assert.rejects(createRecoveryBundle({ accountBinding, deviceId: bundle.device_id, publicJwk, privateJwk, passphrase: "too short", createdAt }), /14-256/);
  await assert.rejects(createRecoveryBundle({ accountBinding, deviceId: bundle.device_id, publicJwk, privateJwk, passphrase: "aaaaaaaaaaaaaa", createdAt }), /too predictable/);
});

test("browser E2EE recovery account binding and explicit activation are fail-closed", async () => {
  const mvxAddress = `erd1${"q".repeat(58)}`;
  const binding = await computeRecoveryAccountBinding({ userId: 29, mvxAddress });
  assert.equal(binding, sha256Hex(`NEXUS_E2EE_ACCOUNT_BINDING_V1:29:${mvxAddress}`));
  await assert.rejects(computeRecoveryAccountBinding({ userId: 29, mvxAddress: "invalid" }), /stable Nexus account identity/);

  const activation = { deviceId: "device:recovery:00000000-0000-4000-8000-000000000030", token: "t".repeat(43) };
  const calls = [];
  const activated = await activateProvisionedRecoveryDevice(async (path, options) => {
    calls.push({ path, options });
    return {
      ok: true, active: true, replay: false, private_key_received: false,
      intent: { owner_id: 29, device_id: activation.deviceId, action: "activate_recovery" },
      device: { device_id: activation.deviceId, key_algorithm: "ECDH-P256", status: "active", registered_at: 1_999_999_900, activated_at: 2_000_000_000 },
    };
  }, activation, 29);
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /\/api\/chat\/recovery-devices\/device%3Arecovery%3A.*\/activate/);
  assert.equal(calls[0].options.headers["Idempotency-Key"], `nexus-recovery-activate:${activation.deviceId}`);
  assert.deepEqual(calls[0].options.body, { activation_token: activation.token });
  assert.equal(activated.activatedAt, 2_000_000_000_000);
  await assert.rejects(activateProvisionedRecoveryDevice(async () => ({ ok: false }), { ...activation, token: "short" }, 29), /capability is invalid/);
  await assert.rejects(activateProvisionedRecoveryDevice(async () => ({ ok: false, code: "RECOVERY_ACTIVATION_EXPIRED" }), activation, 29), /expired/i);
});

test("browser E2EE pending activation survives refresh encrypted and clears on tamper or expiry", async () => {
  const previousIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = {};
  const activation = {
    deviceId: "device:recovery:00000000-0000-4000-8000-000000000033",
    token: "r".repeat(43),
    expiresAt: 2_000_000_600,
    accountBinding: "a".repeat(64),
  };
  let stored = null;
  let clears = 0;
  try {
    await persistPendingRecoveryActivation(activation, { write: async (record) => { stored = record; }, nowSeconds: 2_000_000_000 });
    assert.equal(stored.wrappingKey.extractable, false);
    assert.equal(JSON.stringify(stored).includes(activation.token), false, "the short-lived capability is not persisted as plaintext");
    const afterRefresh = await readPendingRecoveryActivation({
      read: async () => stored,
      clear: async () => { stored = null; clears++; },
      nowSeconds: 2_000_000_001,
      accountBinding: activation.accountBinding,
    });
    assert.deepEqual(afterRefresh, activation);
    const concurrentReads = await Promise.all([1, 2, 3].map(() => readPendingRecoveryActivation({
      read: async () => stored,
      clear: async () => { clears++; },
      nowSeconds: 2_000_000_001,
      accountBinding: activation.accountBinding,
    })));
    assert.deepEqual(concurrentReads, [activation, activation, activation], "concurrent refresh reads are deterministic and do not rotate the capability");

    assert.equal(await readPendingRecoveryActivation({
      read: async () => stored,
      clear: async () => { clears++; },
      nowSeconds: 2_000_000_001,
      accountBinding: "b".repeat(64),
    }), null, "another Nexus account cannot resume this browser activation");
    assert.equal(clears, 1);

    const tampered = { ...stored, ciphertextB64: `${stored.ciphertextB64[0] === "A" ? "B" : "A"}${stored.ciphertextB64.slice(1)}` };
    assert.equal(await readPendingRecoveryActivation({ read: async () => tampered, clear: async () => { clears++; }, nowSeconds: 2_000_000_002, accountBinding: activation.accountBinding }), null);
    assert.equal(clears, 2, "tamper is cleared fail-closed");

    assert.equal(await readPendingRecoveryActivation({ read: async () => stored, clear: async () => { clears++; }, nowSeconds: activation.expiresAt, accountBinding: activation.accountBinding }), null);
    assert.equal(clears, 3, "expiry boundary is cleared fail-closed");
    await assert.rejects(
      persistPendingRecoveryActivation(activation, { write: async () => { throw new Error("SYSTEM_TEST_INDEXEDDB_WRITE_FAILURE"); }, nowSeconds: 2_000_000_000 }),
      /SYSTEM_TEST_INDEXEDDB_WRITE_FAILURE/,
    );
    await clearPendingRecoveryActivation({ clear: async () => { clears++; } });
    assert.equal(clears, 4);
  } finally {
    if (previousIndexedDb === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previousIndexedDb;
  }
});

test("browser E2EE activation persistence waits for IndexedDB transaction commit", async () => {
  const abortedTransaction = {};
  const successfulRequest = { result: undefined };
  const aborted = completeRecoveryActivationTransaction(abortedTransaction, successfulRequest, "write");
  successfulRequest.onsuccess();
  abortedTransaction.onabort();
  await assert.rejects(aborted, /transaction failed/, "request success followed by transaction abort must not be reported as durable");

  const committedTransaction = {};
  const committedRequest = { result: { durable: true } };
  const committed = completeRecoveryActivationTransaction(committedTransaction, committedRequest, "read");
  committedRequest.onsuccess();
  committedTransaction.oncomplete();
  assert.deepEqual(await committed, { durable: true });
});

test("browser E2EE attachment decrypts only an integrity-bound opaque container after explicit retrieval", async () => {
  const aliceKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const bobKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const alicePublic = await crypto.subtle.exportKey("jwk", aliceKeys.publicKey);
  const bobPublic = await crypto.subtle.exportKey("jwk", bobKeys.publicKey);
  const clearBytes = new TextEncoder().encode("private attachment bytes");
  const contentAad = JSON.stringify({ v: 1, conversation_id: 72, name: "proof.txt", mime: "text/plain", size: clearBytes.byteLength });
  const contentKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const contentKey = await crypto.subtle.importKey("raw", contentKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const contentIv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: contentIv, additionalData: new TextEncoder().encode(contentAad), tagLength: 128 }, contentKey, clearBytes));
  const magic = new TextEncoder().encode("NEXUS-E2EE-ATTACHMENT-V1\0");
  const container = new Uint8Array(magic.byteLength + ciphertext.byteLength);
  container.set(magic, 0); container.set(ciphertext, magic.byteLength);
  const cipherHash = sha256Hex(Buffer.from(container));
  const conversationId = 72;
  const clientNonce = "e2ee:attachment:browser:01";
  const commitment = "c".repeat(64);
  const keyEpoch = 3;
  const keyEpochCommitment = "d".repeat(64);
  const aliceDevice = "device:alice:attachment:1";
  const bobDevice = "device:bob:attachment:001";
  const envelope = await encryptPayloadForDevice({
    conversationId, clientNonce, deviceSetCommitment: commitment,
    keyEpoch, keyEpochCommitment,
    senderDevice: { deviceId: aliceDevice, privateKey: aliceKeys.privateKey },
    recipient: { device_id: bobDevice, public_jwk: bobPublic },
    payload: {
      v: 1, type: "attachment", text: "local caption", created_at: Date.now(), media_id: 91,
      cipher_sha256: cipherHash, content_key_b64: Buffer.from(contentKeyBytes).toString("base64"),
      content_iv_b64: Buffer.from(contentIv).toString("base64"), content_aad: contentAad,
      name: "proof.txt", mime: "text/plain", size: clearBytes.byteLength,
    },
  });
  const message = {
    id: 501, conversation_id: conversationId, attachment_media_id: 91,
    attachment_url: `/media/${cipherHash}.nxenc`, media_hash: cipherHash,
    client_nonce: clientNonce, sender_device_id: aliceDevice,
    device_set_commitment: commitment, key_epoch: keyEpoch, key_epoch_commitment: keyEpochCommitment,
    encryption_mode: "e2ee_v1", kind: "encrypted_attachment",
    envelope: {
      ...envelope, message_id: 501, conversation_id: conversationId, client_nonce: clientNonce,
      sender_device_id: aliceDevice, device_set_commitment: commitment,
      key_epoch: keyEpoch, key_epoch_commitment: keyEpochCommitment,
      sender_public_jwk: { kty: alicePublic.kty, crv: alicePublic.crv, x: alicePublic.x, y: alicePublic.y },
    },
  };
  const opened = await decryptChatAttachment(message, { deviceId: bobDevice, privateKey: bobKeys.privateKey }, async () => new Response(container));
  assert.equal(opened.name, "proof.txt");
  assert.equal(opened.text, "local caption");
  assert.equal(await opened.blob.text(), "private attachment bytes");
  const cancelled = new AbortController();
  cancelled.abort();
  let cancelledFetchCalled = false;
  await assert.rejects(
    decryptChatAttachment(message, { deviceId: bobDevice, privateKey: bobKeys.privateKey }, async () => {
      cancelledFetchCalled = true;
      return new Response(container);
    }, { signal: cancelled.signal }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(cancelledFetchCalled, false, "revoked plaintext intent must stop before network retrieval");
  const tampered = new Uint8Array(container); tampered[tampered.length - 1] ^= 1;
  await assert.rejects(
    decryptChatAttachment(message, { deviceId: bobDevice, privateKey: bobKeys.privateKey }, async () => new Response(tampered)),
    /integrity mismatch/,
  );
  await assert.rejects(
    decryptChatAttachment({ ...message, attachment_url: "https://attacker.invalid/cipher.nxenc" }, { deviceId: bobDevice, privateKey: bobKeys.privateKey }, async () => new Response(container)),
    /storage reference is invalid/,
  );
  await assert.rejects(
    decryptChatAttachment(message, { deviceId: bobDevice, privateKey: bobKeys.privateKey }, async () => new Response(container, { headers: { "content-length": String(20 * 1024 * 1024 + 1) } })),
    /too large/,
  );
});

test("repo: direct call state and ephemeral signaling authorization fail closed", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "call-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "call-bob", displayName: "Bob" });
    const carol = repo.createUser({ handle: "call-carol", displayName: "Carol" });
    for (const user of [alice, bob, carol]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const direct = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const secondDirect = repo.createDirectConversation({ creatorId: alice.id, recipientId: carol.id, contextPersona: "social" });
    const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, carol.id], title: "No group call", contextPersona: "social" });
    const nowSeconds = Math.floor(Date.now() / 1000);
    assert.equal(repo.createConversationCall({ callId: "call:group_rejected_001", conversationId: group.id, initiatorId: alice.id, mode: "video", expiresAt: nowSeconds + 60 }), null);
    const call = repo.createConversationCall({ callId: "call:direct_secure_0001", conversationId: direct.id, initiatorId: alice.id, mode: "video", expiresAt: nowSeconds + 60 });
    assert.equal(call.status, "ringing");
    assert.equal(call.participants.length, 2);
    assert.equal(repo.createConversationCall({ callId: "call:busy_rejected_0002", conversationId: direct.id, initiatorId: bob.id, mode: "audio", expiresAt: nowSeconds + 60 }), null);
    assert.equal(repo.createConversationCall({ callId: "call:user_busy_other_003", conversationId: secondDirect.id, initiatorId: carol.id, mode: "audio", expiresAt: nowSeconds + 60 }), null);
    assert.equal(repo.getConversationCall(call.call_id, carol.id), null);
    assert.equal(repo.decideConversationCall(call.call_id, alice.id, "accept", nowSeconds + 1), null);
    assert.equal(repo.decideConversationCall(call.call_id, bob.id, "accept", nowSeconds + 1).status, "active");
    const offerHash = sha256Hex("offer-a");
    const offer = repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: alice.id, type: "offer", nonce: "signal:offer:0001", payloadHash: offerHash });
    assert.equal(offer.recipient.id, bob.id);
    assert.equal(offer.replay, false);
    assert.equal(offer.shouldDeliver, true);
    assert.equal(repo.markConversationCallSignalDelivered({ callId: call.call_id, senderId: alice.id, nonce: "signal:offer:0001", payloadHash: offerHash }), true);
    assert.equal(repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: bob.id, type: "offer", nonce: "signal:offer:bad01", payloadHash: offerHash }), null);
    const offerReplay = repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: alice.id, type: "offer", nonce: "signal:offer:0001", payloadHash: offerHash });
    assert.equal(offerReplay.replay, true);
    assert.equal(offerReplay.shouldDeliver, false);
    assert.equal(repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: alice.id, type: "offer", nonce: "signal:offer:0001", payloadHash: sha256Hex("changed") }), null);
    assert.equal(repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: bob.id, type: "answer", nonce: "signal:answer:001", payloadHash: sha256Hex("answer-b") }).recipient.id, alice.id);
    assert.equal(repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: bob.id, type: "ice", nonce: "signal:ice:bob:001", payloadHash: sha256Hex("ice-b") }).recipient.id, alice.id);
    assert.equal(repo.endConversationCall(call.call_id, bob.id, nowSeconds + 2).status, "ended");
    assert.equal(repo.authorizeConversationCallSignal({ callId: call.call_id, senderId: alice.id, type: "ice", nonce: "signal:late:0001", payloadHash: sha256Hex("late") }), null);

    const restartCall = repo.createConversationCall({ callId: "call:restart_failed_0002", conversationId: direct.id, initiatorId: bob.id, mode: "audio", expiresAt: nowSeconds + 60 });
    assert.equal(restartCall.status, "ringing");
    assert.equal(repo.failOpenCallsOnStartup(nowSeconds + 3), 1);
    assert.equal(repo.getConversationCall(restartCall.call_id, alice.id).status, "failed");
  } finally {
    db.close();
  }
});

test("repo: Social profile, lenses, reactions, replies, saves and stories are isolated and persistent", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "alice-social", displayName: "Alice" });
    const bob = repo.createUser({ handle: "bob-social", displayName: "Bob" });
    for (const persona of PERSONAS) {
      repo.ensurePersona(alice.id, persona, {});
      repo.ensurePersona(bob.id, persona, {});
    }
    const orbitExpiry = Date.now() + 24 * 60 * 60 * 1000;
    repo.updatePersona(alice.id, "social", { name: "Alicia", avatar: "/media/a.jpg", orbitStatus: { mood: "FOCUSED", place: "Warsaw", now: "A synthetic series", fandom: "Test FC", quote: "Synthetic proverb", expiresAt: orbitExpiry }, visibility: "public", regionCode: "PL-MAZ", nearEnabled: true, contentLanguages: ["ro", "en"] });
    repo.updatePersona(alice.id, "work", { name: "Alice Company", visibility: "private", avatar: "/media/work.jpg" });
    repo.updatePersona(bob.id, "social", { visibility: "public", regionCode: "PL-MAZ", nearEnabled: true });
    assert.equal(repo.getPersona(alice.id, "social").name, "Alicia");
    assert.equal(repo.getPersona(alice.id, "social").orbit_mood, "FOCUSED");
    assert.equal(repo.getPersona(alice.id, "social").orbit_place, "Warsaw");
    assert.equal(repo.getPersona(alice.id, "social").orbit_now, "A synthetic series");
    assert.equal(repo.getPersona(alice.id, "social").orbit_fandom, "Test FC");
    assert.equal(repo.getPersona(alice.id, "social").orbit_quote, "Synthetic proverb");
    assert.equal(repo.getPersona(alice.id, "social").orbit_expires_at, orbitExpiry);
    assert.equal(repo.getPersona(alice.id, "work").name, "Alice Company");
    assert.notEqual(repo.getPersona(alice.id, "social").avatar, repo.getPersona(alice.id, "work").avatar);

    const nearPost = repo.createPost({ userId: alice.id, persona: "social", kind: "video", caption: "near", visibility: "public", regionCode: "PL-MAZ", language: "ro" });
    repo.createPost({ userId: alice.id, persona: "social", caption: "global", visibility: "public", regionCode: "RO-B", language: "ro" });
    assert.deepEqual(repo.listSocialFeed(bob.id, { lens: "near", regionCode: "PL-MAZ" }).map((post) => post.id), [nearPost.id]);
    assert.equal(repo.listSocialFeed(bob.id, { lens: "breaking" }).length, 0);

    let summary = repo.setPostReaction(bob.id, "social", nearPost.id, "FAKE_OPINION", true);
    assert.equal(summary.counts.FAKE_OPINION, 1);
    summary = repo.setPostReaction(bob.id, "social", nearPost.id, "DISLIKE", true);
    assert.equal(summary.counts.FAKE_OPINION, undefined);
    assert.equal(summary.private_dislike_by_me, true);
    assert.equal(repo.privateDislikeCount(nearPost.id), 1);

    const parent = repo.addSocialComment({ userId: bob.id, actorPersona: "social", postId: nearPost.id, body: "question" });
    const reply = repo.addSocialComment({ userId: alice.id, actorPersona: "social", postId: nearPost.id, parentId: parent.id, body: "answer" });
    assert.equal(reply.parent_id, parent.id);
    assert.throws(() => repo.addSocialComment({ userId: alice.id, postId: nearPost.id + 1, parentId: parent.id, body: "bad" }), /SOCIAL_COMMENT_PARENT_INVALID/);
    assert.equal(repo.setCommentReaction(alice.id, "social", parent.id, "LOVE", true).counts.LOVE, 1);

    assert.equal(repo.setSavedPost(bob.id, "social", nearPost.id, true), true);
    assert.equal(repo.hasSavedPost(bob.id, "social", nearPost.id), true);
    assert.equal(repo.recordPostShare(bob.id, "social", nearPost.id, "copy_link").shares, 1);
    assert.deepEqual(repo.setPostRepost(bob.id, "social", nearPost.id, true), { reposts: 1, reposted_by_me: true });
    assert.deepEqual(repo.setPostRepost(bob.id, "social", nearPost.id, true), { reposts: 1, reposted_by_me: true });
    assert.deepEqual(repo.setPostRepost(bob.id, "social", nearPost.id, false), { reposts: 0, reposted_by_me: false });

    const persistent = repo.createStory({ userId: alice.id, persona: "social", caption: "kept", visibility: "public", expiresAt: null });
    const expired = repo.createStory({ userId: alice.id, persona: "social", caption: "old", visibility: "public", expiresAt: 10 });
    assert.deepEqual(repo.listActiveStories(bob.id, "social", 20).map((story) => story.id), [persistent.id]);
    assert.equal(repo.listActiveStories(bob.id, "social", 20, 100, "unseen")[0].viewed_by_me, false);
    assert.deepEqual(repo.recordStoryView(persistent.id, bob.id, "social", 0.4, false), { story_id: persistent.id, progress: 0.4, viewed: false });
    assert.equal(repo.listActiveStories(bob.id, "social", 20, 100, "unseen").length, 1);
    assert.deepEqual(repo.recordStoryView(persistent.id, bob.id, "social", 1, true), { story_id: persistent.id, progress: 1, viewed: true });
    assert.equal(repo.listActiveStories(bob.id, "social", 20, 100, "unseen").length, 0);
    assert.equal(repo.listActiveStories(bob.id, "social", 20, 100, "viewed")[0].id, persistent.id);
    assert.equal(repo.archiveStory(persistent.id, bob.id), false);
    assert.equal(repo.archiveStory(persistent.id, alice.id), true);
    assert.equal(repo.listActiveStories(bob.id, "social", 20).length, 0);

    repo.setProfileBlock(bob.id, "social", alice.id, true);
    assert.equal(repo.listSocialFeed(bob.id, { lens: "global" }).length, 0);
  } finally {
    db.close();
  }
});

test("repo: Nexus Sigil is earned automatically from qualified followers and business verification", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const creator = repo.createUser({ handle: "sigil_creator", displayName: "Creator" });
    const business = repo.createUser({ handle: "sigil_business", displayName: "Business" });
    repo.ensurePersona(creator.id, "social", {});
    repo.ensurePersona(business.id, "social", {});
    repo.updatePersona(business.id, "social", { profileKind: "business" });
    assert.equal(repo.sigilProgress(creator.id, "social").earned, false);

    db.exec(`
      WITH RECURSIVE a(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM a WHERE n < 100),
        b(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM b WHERE n < 10),
        seq(n) AS (SELECT b.n * 100 + a.n FROM a CROSS JOIN b)
      INSERT INTO users (handle, display_name, traffic_class)
      SELECT 'sigil_actor_' || n, 'Sigil Actor ' || n,
        CASE WHEN n <= 1000 THEN 'HUMAN_ORGANIC' ELSE 'SYSTEM_TEST' END
      FROM seq;
    `);
    const addFollow = db.prepare(`INSERT INTO follows (follower_id, followee_id, persona) VALUES (?, ?, 'social')`);
    const actors = db.prepare(`SELECT id, traffic_class FROM users WHERE handle LIKE 'sigil_actor_%'`).all();
    for (const actor of actors) {
      addFollow.run(actor.id, creator.id);
      addFollow.run(actor.id, business.id);
    }

    const creatorSigil = repo.sigilProgress(creator.id, "social");
    assert.equal(creatorSigil.family, "creator");
    assert.equal(creatorSigil.icon, "★");
    assert.equal(creatorSigil.total_followers, 1100);
    assert.equal(creatorSigil.qualified_followers, 1000);
    assert.equal(creatorSigil.level, 1);
    assert.equal(creatorSigil.tier_name, "Creator");
    assert.equal(creatorSigil.next_threshold, 10_000);
    assert.equal(creatorSigil.production_fraud_gate, false);

    const blockedBusiness = repo.sigilProgress(business.id, "social");
    assert.equal(blockedBusiness.earned, false);
    assert.equal(blockedBusiness.eligibility, "BUSINESS_VERIFICATION_REQUIRED");
    db.prepare(`UPDATE personas SET business_verification_status = 'verified' WHERE user_id = ? AND persona = 'social'`).run(business.id);
    const businessSigil = repo.sigilProgress(business.id, "social");
    assert.equal(businessSigil.earned, true);
    assert.equal(businessSigil.icon, "$");
    assert.equal(businessSigil.level, 1);
  } finally {
    db.close();
  }
});

test("repo: Social Search and Live exclude synthetic actors and gate public broadcast", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const host = repo.createUser({ handle: "live_host", displayName: "Live Host" });
    const viewer = repo.createUser({ handle: "live_viewer", displayName: "Live Viewer" });
    const synthetic = repo.createUser({ handle: "systemtest_live", displayName: "SYSTEM_TEST Live", trafficClass: "SYSTEM_TEST" });
    for (const user of [host, viewer, synthetic]) repo.ensurePersona(user.id, "social", { visibility: "public" });
    repo.setFollow(viewer.id, host.id, "social", true);
    const preview = repo.prepareSocialLive(host.id, {
      title: "Live local verificabil",
      category: "talk",
      visibility: "public",
      language: "ro",
      commentsEnabled: false,
    });
    assert.equal(preview.status, "preview");
    assert.equal(preview.transport_status, "GATED_NO_SFU");
    assert.equal(preview.visibility, "public");
    assert.equal(preview.language, "ro");
    assert.equal(preview.comments_enabled, 0);
    const draft = repo.createSocialLiveCompetitionDraft({
      ownerId: host.id, title: "Battle organic", format: "battle", startsAt: Math.floor(Date.now() / 1000) + 600,
    });
    assert.equal(draft.status, "draft");
    assert.equal(repo.listSocialLive(host.id).live.length, 0);
    assert.equal(repo.listSocialLive(host.id).own_preview.id, preview.id);
    assert.equal(repo.listSocialLive(host.id).competitions[0].id, draft.id);

    db.prepare(`UPDATE social_live_sessions SET status = 'live', transport_status = 'VERIFIED_ACTIVE', started_at = unixepoch() WHERE id = ?`).run(preview.id);
    assert.equal(repo.prepareSocialLive(host.id, { title: "Nu suprascrie emisia", category: "music" }), null);
    assert.equal(db.prepare(`SELECT title FROM social_live_sessions WHERE id = ?`).get(preview.id).title, "Live local verificabil");
    const attend = db.prepare(`INSERT INTO social_live_attendance (session_id, viewer_id, last_heartbeat_at) VALUES (?, ?, unixepoch())`);
    attend.run(preview.id, viewer.id);
    attend.run(preview.id, synthetic.id);
    const discovery = repo.listSocialLive(viewer.id);
    assert.equal(discovery.live.length, 1);
    assert.equal(discovery.live[0].organic_viewers, 1);
    assert.equal(discovery.live[0].qualified_followers, 1);
    assert.equal(discovery.live[0].is_following, true);

    const privateHost = repo.createUser({ handle: "locked_creator", displayName: "Locked Creator" });
    repo.ensurePersona(privateHost.id, "social", { visibility: "public" });
    const privatePreview = repo.prepareSocialLive(privateHost.id, {
      title: "Live privat invizibil",
      category: "creator",
      visibility: "private",
    });
    db.prepare(`UPDATE social_live_sessions SET status = 'live', transport_status = 'VERIFIED_ACTIVE', started_at = unixepoch() WHERE id = ?`).run(privatePreview.id);
    assert.equal(repo.listSocialLive(privateHost.id).live.some((session) => session.id === privatePreview.id), true);
    assert.equal(repo.listSocialLive(viewer.id).live.some((session) => session.id === privatePreview.id), false);

    const search = repo.searchSocial(viewer.id, { query: "live host" });
    assert.deepEqual(search.profiles.map((profile) => profile.handle), ["live_host"]);
    assert.equal(search.profiles.some((profile) => profile.handle === "systemtest_live"), false);
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally {
    db.close();
  }
});

test("API: Social Search and Live expose only real local state and keep broadcasts gated", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const { issueSession } = await import("../lib/security.js");
  try {
    const owner = repo.createUser({ handle: "api-live-owner", displayName: "API Live Owner" });
    const target = repo.createUser({ handle: "api-live-target", displayName: "Target Creator" });
    const synthetic = repo.createUser({ handle: "systemtest-live-api", displayName: "Target SYSTEM_TEST", trafficClass: "SYSTEM_TEST" });
    for (const user of [owner, target, synthetic]) repo.ensurePersona(user.id, "social", { visibility: "public" });
    repo.setFollow(owner.id, target.id, "social", true);

    const session = issueSession(owner.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: owner.id, persona: "social", expiresAt: session.expiresAt });
    const cookie = `nexus_session=${session.token}`;
    const call = async (method, path, body = {}) => {
      const response = fakeRes();
      await handleRequest(fakeReq(method, path, cookie, body), response, { repo, sse, db });
      return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : {} };
    };

    const preview = await call("POST", "/api/social/live/preview", {
      title: "Live API verificabil",
      category: "education",
      visibility: "private",
      language: "ro",
      comments_enabled: false,
    });
    assert.equal(preview.status, 201);
    assert.equal(preview.body.owner_id, owner.id);
    assert.equal(preview.body.owner_persona, "social");
    assert.equal(preview.body.action, "preview_saved");
    assert.equal(preview.body.public_broadcast, false);
    assert.equal(preview.body.preview.transport_status, "GATED_NO_SFU");
    assert.equal(preview.body.preview.visibility, "private");
    assert.equal(preview.body.preview.language, "ro");
    assert.equal(preview.body.preview.comments_enabled, 0);

    const live = await call("GET", "/api/social/live");
    assert.equal(live.status, 200);
    assert.equal(live.body.viewer_id, owner.id);
    assert.equal(live.body.viewer_persona, "social");
    assert.equal(live.body.privacy_enforced_server_side, true);
    assert.deepEqual(live.body.live, []);
    assert.equal(live.body.own_preview.id, preview.body.preview.id);
    assert.equal(live.body.viewer_count_policy, "UNIQUE_ACTIVE_HUMAN_ORGANIC_45S");
    assert.equal(live.body.transport.public_broadcast, false);

    const search = await call("GET", "/api/social/search?q=Target");
    assert.equal(search.status, 200);
    assert.deepEqual(search.body.profiles.map((profile) => profile.handle), ["api-live-target"]);
    assert.equal(search.body.profiles.some((profile) => profile.handle === synthetic.handle), false);
    assert.equal(search.body.privacy_enforced_server_side, true);

    const competition = await call("POST", "/api/social/live/competitions", {
      title: "Campionat organic", format: "championship", starts_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    assert.equal(competition.status, 201);
    assert.equal(competition.body.owner_id, owner.id);
    assert.equal(competition.body.owner_persona, "social");
    assert.equal(competition.body.action, "competition_draft_saved");
    assert.equal(competition.body.published, false);
    assert.equal(competition.body.prize_escrow_configured, false);
    assert.equal((await call("GET", "/api/social/search?q=x")).status, 400);
    assert.equal(db.prepare(`PRAGMA integrity_check`).get().integrity_check, "ok");
  } finally {
    db.close();
  }
});

test("repo: Social ranking is deterministic, reserves organic exploration and contains dislike abuse", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const viewer = repo.createUser({ handle: "rank-viewer", displayName: "Viewer" });
    repo.ensurePersona(viewer.id, "social", { visibility: "public" });
    repo.updatePersona(viewer.id, "social", { contentLanguages: ["ro"], regionCode: "RO-B", nearEnabled: true });
    const authors = [];
    const posts = [];
    for (let index = 0; index < 10; index++) {
      const author = repo.createUser({ handle: `rank-author-${index}`, displayName: `Author ${index}` });
      repo.ensurePersona(author.id, "social", { visibility: "public" });
      authors.push(author);
      posts.push(repo.createPost({ userId: author.id, persona: "social", caption: `A${index}-1`, language: "ro", regionCode: "RO-B" }));
      posts.push(repo.createPost({ userId: author.id, persona: "social", caption: `A${index}-2`, language: "en", regionCode: "RO-CJ" }));
    }
    const synthetic = repo.createUser({ handle: "systemtest-ranker", displayName: "SYSTEM_TEST ranker", trafficClass: "SYSTEM_TEST" });
    repo.ensurePersona(synthetic.id, "social", { visibility: "public" });
    const syntheticPost = repo.createPost({ userId: synthetic.id, persona: "social", caption: "must never rank" });

    const first = repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20, regionCode: "RO-B" });
    const second = repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20, regionCode: "RO-B" });
    assert.deepEqual(first.map((post) => post.id), second.map((post) => post.id));
    assert.equal(first.some((post) => post.id === syntheticPost.id), false);
    assert.equal(first.filter((post) => post.ranking.exploration).length, 2);
    const authorCounts = new Map();
    for (const post of first) authorCounts.set(post.user_id, (authorCounts.get(post.user_id) ?? 0) + 1);
    assert.equal(Math.max(...authorCounts.values()), 2);

    assert.equal(repo.recordSocialImpressions(viewer.id, "social", posts.slice(0, 18).map((post) => ({ post_id: post.id, dwell_ms: 100, completed: false }))).recorded, 18);
    assert.equal(repo.recordSocialImpressions(viewer.id, "social", [{ post_id: posts[0].id }, { post_id: posts[0].id }]), null);
    const afterImpressions = repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20, regionCode: "RO-B" });
    assert.equal(afterImpressions.filter((post) => post.ranking.exploration).length, 2);

    const target = posts[0];
    for (const actor of authors.slice(0, 6)) repo.setPostReaction(actor.id, "social", target.id, "DISLIKE", true);
    const forward = repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20 }).map((post) => post.id);
    assert.equal(forward.includes(target.id), true);
    db.prepare(`DELETE FROM post_reactions WHERE post_id = ?`).run(target.id);
    for (const actor of [...authors.slice(0, 6)].reverse()) repo.setPostReaction(actor.id, "social", target.id, "DISLIKE", true);
    const reversed = repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20 }).map((post) => post.id);
    assert.deepEqual(reversed, forward);
    repo.setPostReaction(synthetic.id, "social", posts[1].id, "LOVE", true);
    assert.deepEqual(repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20 }).map((post) => post.id), reversed);

    assert.equal(repo.setSocialFeedback(viewer.id, "social", target.id, "NOT_INTERESTED", true), true);
    assert.equal(repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20 }).some((post) => post.id === target.id), false);
    const reset = repo.resetSocialRecommendations(viewer.id, "social", 2_000_000_000);
    assert.equal(reset.version, 2);
    assert.equal(repo.listSocialFeed(viewer.id, { lens: "for-you", limit: 20 }).some((post) => post.id === target.id), true);
  } finally {
    db.close();
  }
});

test("Social Trust Lens separates provenance, context and safety without inventing truth scores", () => {
  const ordinary = assessSocialContent({ text: "O fotografie din parc", provenance: "NOT_DECLARED", mediaKind: "image" });
  assert.equal(ordinary.decision, "ALLOW");
  assert.equal(ordinary.factualStatus, "NOT_FACT_CHECKED");
  assert.equal(ordinary.truthPercentage, null);
  assert.equal(ordinary.visualSafety, "NOT_ANALYZED_BY_LOCAL_DEMO");

  const political = assessSocialContent({ text: "Breaking news despre alegeri", provenance: "AI_ASSISTED" });
  assert.equal(political.decision, "ALLOW_WITH_CONTEXT");
  assert.deepEqual(political.labels.map((label) => label.code), ["POLITICAL_CONTENT", "NEWS_CLAIM", "AI_ASSISTED", "SOURCE_NOT_PROVIDED"]);
  assert.equal(political.provenance.independentlyVerified, false);
  assert.equal(normalizeProvenance("user"), "NOT_DECLARED");
  assert.equal(normalizeProvenance("fabricated"), null);
  assert.ok(REPORT_CATEGORIES.includes("MISINFORMATION_CONTEXT"));

  const credentialTheft = assessSocialContent({ text: "Trimite-mi fraza seed acum", provenance: "NOT_DECLARED" });
  assert.equal(credentialTheft.decision, "BLOCK");
  assert.equal(credentialTheft.labels.some((label) => label.code === "CREDENTIAL_THEFT_SOLICITATION"), true);

  for (const obfuscated of ["Trimite-mi fraza-seed acum", "Share.your.seed.phrase", "share your seed\u200b phrase", "I.will.kill.you"]) {
    assert.equal(assessSocialContent({ text: obfuscated, provenance: "NOT_DECLARED" }).decision, "BLOCK");
  }
  for (const benign of [
    "Do not share your seed phrase with anyone",
    "Quoted: I will kill you — I condemn this threat",
    "I sell a book about cocaine policy"
  ]) {
    assert.notEqual(assessSocialContent({ text: benign, provenance: "NOT_DECLARED" }).decision, "BLOCK");
  }
  for (const injected of [
    "I will kill you; I condemn high taxes",
    "This is not a quote: I will kill you",
    "Do not send your seed phrase; send your seed phrase to me",
    "sell cheap cocaine",
    "sell high quality heroin",
    "I sell excellent cocaine today",
    "Vând cocaină ieftină azi"
  ]) {
    assert.equal(assessSocialContent({ text: injected, provenance: "NOT_DECLARED" }).decision, "BLOCK");
  }
});

test("repo: automated moderation reports are idempotent, synthetic-safe and audit chained", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const author = repo.createUser({ handle: "trust-author", displayName: "Author" });
    const reporter = repo.createUser({ handle: "trust-reporter", displayName: "Reporter" });
    const synthetic = repo.createUser({ handle: "systemtest-trust", displayName: "SYSTEM_TEST Trust", trafficClass: "SYSTEM_TEST" });
    for (const user of [author, reporter, synthetic]) repo.ensurePersona(user.id, "social", { visibility: "public" });
    const post = repo.createPost({ userId: author.id, persona: "social", caption: "Breaking news despre alegeri", provenance: "AI_ASSISTED" });
    const assessment = assessSocialContent({ text: post.caption, provenance: post.provenance });
    repo.saveContentAssessment("post", post.id, post.content_commitment, assessment);
    repo.appendModerationEvent({ subjectType: "post", subjectId: post.id, actorKind: "AUTOMATION", action: "CONTENT_ASSESSED", reasonCode: assessment.decision, metadata: { assessmentHash: assessment.assessmentHash, enforcementChanged: false }, createdAt: 100 });

    const report = repo.createModerationReport({ reporterId: reporter.id, reporterPersona: "social", subjectType: "post", subjectId: post.id, category: "MISINFORMATION_CONTEXT" });
    const retry = repo.createModerationReport({ reporterId: reporter.id, reporterPersona: "social", subjectType: "post", subjectId: post.id, category: "MISINFORMATION_CONTEXT" });
    assert.equal(retry.id, report.id);
    for (const persona of PERSONAS) {
      repo.ensurePersona(reporter.id, persona, {});
      const retryFromAnotherProfile = repo.createModerationReport({ reporterId: reporter.id, reporterPersona: persona, subjectType: "post", subjectId: post.id, category: "MISINFORMATION_CONTEXT" });
      assert.equal(retryFromAnotherProfile.id, report.id);
    }
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM moderation_reports`).get().count, 1);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM moderation_events WHERE action = 'REPORT_RECORDED'`).get().count, 1);
    const excluded = repo.createModerationReport({ reporterId: synthetic.id, reporterPersona: "social", subjectType: "post", subjectId: post.id, category: "SCAM_FRAUD" });
    assert.equal(excluded.outcome, "EXCLUDED_FROM_ENFORCEMENT");
    assert.equal(repo.getPostById(post.id).status, "active");
    assert.throws(() => repo.createModerationReport({ reporterId: reporter.id, reporterPersona: "social", subjectType: "profile", subjectId: post.id, category: "SCAM_FRAUD" }), /MODERATION_REPORT_SUBJECT_INVALID/);
    assert.throws(() => repo.createModerationReport({ reporterId: reporter.id, reporterPersona: "social", subjectType: "post", subjectId: 999_999, category: "SCAM_FRAUD" }), /MODERATION_REPORT_SUBJECT_INVALID/);

    const mismatchedAssessment = assessSocialContent({ text: post.caption, provenance: "NOT_DECLARED" });
    assert.throws(() => repo.saveContentAssessment("post", post.id, post.content_commitment, mismatchedAssessment), /CONTENT_ASSESSMENT_CANONICAL_MISMATCH/);
    assert.throws(() => repo.saveContentAssessment("post", post.id, "0".repeat(64), assessment), /CONTENT_ASSESSMENT_COMMITMENT_MISMATCH/);

    assert.equal(repo.verifyModerationEventChain().internalLinkConsistency, true);
    db.prepare(`UPDATE moderation_events SET reason_code = 'TAMPERED' WHERE id = 1`).run();
    assert.equal(repo.verifyModerationEventChain().internalLinkConsistency, false);
    db.prepare(`DELETE FROM moderation_events`).run();
    const emptyChain = repo.verifyModerationEventChain();
    assert.equal(emptyChain.internalLinkConsistency, true);
    assert.equal(emptyChain.completenessAuthenticated, false);
    assert.match(emptyChain.limitation, /deletion|recomputation/i);
  } finally {
    db.close();
  }
});

test("API: Social feed is profile-bound, Breaking is truthful and engagement has no dead ends", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const { issueSession } = await import("../lib/security.js");
  try {
    const alice = repo.createUser({ handle: "api-alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "api-bob", displayName: "Bob" });
    for (const persona of PERSONAS) {
      repo.ensurePersona(alice.id, persona, {});
      repo.ensurePersona(bob.id, persona, {});
    }
    repo.updatePersona(alice.id, "social", { visibility: "public", regionCode: "PL-MAZ", nearEnabled: true });
    repo.updatePersona(bob.id, "social", { visibility: "public" });
    const post = repo.createPost({ userId: alice.id, persona: "social", caption: "Bună", visibility: "public", regionCode: "PL-MAZ", language: "ro" });

    const session = issueSession(bob.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: bob.id, persona: "social", expiresAt: session.expiresAt });
    const cookie = `nexus_session=${session.token}`;
    const callWith = async (sessionCookie, method, path, body = {}) => {
      const response = fakeRes();
      await handleRequest(fakeReq(method, path, sessionCookie, body), response, { repo, sse, db });
      let responseBody = {};
      if (response.body) {
        try { responseBody = JSON.parse(response.body); } catch { responseBody = response.body; }
      }
      return { status: response.statusCode, body: responseBody, headers: response.headers };
    };
    const call = (method, path, body = {}) => callWith(cookie, method, path, body);

    const noConsent = await call("GET", "/api/social/feed?lens=near");
    assert.equal(noConsent.status, 200);
    assert.equal(noConsent.body.near.status, "consent_required");
    assert.equal(noConsent.body.near.uses_ip_as_nationality, false);
    assert.equal((await call("PATCH", "/api/persona/social", { near_enabled: true })).status, 400);
    assert.equal((await call("PATCH", "/api/persona/social", { near_enabled: "true", region_code: "PL-MAZ" })).status, 400);
    assert.equal((await call("PATCH", "/api/persona/social", { content_languages: "ro" })).status, 400);
    assert.equal((await call("PATCH", "/api/persona/social", { content_languages: ["ro", "not_a_locale"] })).status, 400);
    const wrongActivePersona = await call("PATCH", "/api/persona/work", { name: "must not cross profiles" });
    assert.equal(wrongActivePersona.status, 409);
    assert.equal(wrongActivePersona.body.code, "ACTIVE_PERSONA_REQUIRED");

    // A profile rename is an identity write, not a temporary DOM label. A completely new session must
    // read the same Social name, and the account fallback must no longer resurrect the signup name.
    const renamed = await call("PATCH", "/api/persona/social", { name: "Adam Walker" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.persona.name, "Adam Walker");
    assert.equal(renamed.body.user.display_name, "Adam Walker");
    assert.equal(repo.getUserById(bob.id).display_name, "Adam Walker");
    const reconnectSession = issueSession(bob.id, "social");
    repo.insertSession({ tokenHash: reconnectSession.tokenHash, userId: bob.id, persona: "social", expiresAt: reconnectSession.expiresAt });
    const reconnected = await callWith(`nexus_session=${reconnectSession.token}`, "GET", "/api/me");
    assert.equal(reconnected.status, 200);
    assert.equal(reconnected.body.user.display_name, "Adam Walker");
    assert.equal(reconnected.body.profiles.find((item) => item.persona === "social").name, "Adam Walker");

    const profile = await call("PATCH", "/api/persona/social", { region_code: "PL-MAZ", near_enabled: true, interface_locale: "ro", content_languages: ["ro", "en"], profile_kind: "creator", orbit_status: { mood: "CURIOUS", place: "Warsaw", now: "Synthetic show", fandom: "Test FC", quote: "Synthetic wisdom", expires_hours: 24 } });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.owner_id, bob.id);
    assert.equal(profile.body.requested_persona, "social");
    assert.equal(profile.body.persona.near_enabled, 1);
    assert.deepEqual(JSON.parse(profile.body.persona.content_languages), ["ro", "en"]);
    assert.equal((await call("PATCH", "/api/persona/social", { region_code: "" })).status, 400);
    assert.equal(profile.body.persona.profile_kind, "creator");
    assert.equal(profile.body.persona.orbit_mood, "CURIOUS");
    assert.equal(profile.body.persona.orbit_place, "Warsaw");
    assert.equal(profile.body.persona.orbit_quote, "Synthetic wisdom");
    assert.ok(profile.body.persona.orbit_expires_at > Date.now());
    assert.equal((await call("PATCH", "/api/persona/social", { orbit_status: { mood: "INFERRED_HAPPY", expires_hours: 24 } })).status, 400);
    assert.equal((await call("PATCH", "/api/persona/social", { orbit_status: { mood: "JOY", expires_hours: 1000 } })).status, 400);
    assert.equal((await call("PATCH", "/api/persona/social", { identity_sigil: "STAR" })).status, 403);
    const near = await call("GET", "/api/social/feed?lens=near&format=posts");
    assert.deepEqual({ viewer_id: near.body.viewer_id, viewer_persona: near.body.viewer_persona, lens: near.body.lens, format: near.body.format, limit: near.body.limit },
      { viewer_id: bob.id, viewer_persona: "social", lens: "near", format: "posts", limit: 30 });
    assert.deepEqual(near.body.posts.map((item) => item.id), [post.id]);
    assert.equal(near.body.ranking.exploration_floor_bps, 1000);
    assert.equal(near.body.ranking.synthetic_traffic_eligible, false);
    assert.ok(Array.isArray(near.body.posts[0].ranking.reasons));
    assert.equal((await call("POST", "/api/social/impressions", { entries: [{ post_id: post.id, dwell_ms: 1200, completed: true }] })).status, 202);
    assert.equal((await call("POST", "/api/social/impressions", { entries: [{ post_id: post.id }, { post_id: post.id }] })).status, 400);
    assert.equal((await call("POST", `/api/social/posts/${post.id}/feedback`, { kind: "NOT_INTERESTED", active: true })).body.private, true);
    assert.equal((await call("GET", "/api/social/feed?lens=near&format=posts")).body.posts.length, 0);
    assert.equal((await call("POST", `/api/social/posts/${post.id}/feedback`, { kind: "NOT_INTERESTED", active: false })).status, 200);
    const resetRanking = await call("POST", "/api/social/recommendations/reset", {});
    assert.equal(resetRanking.status, 200);
    assert.equal(resetRanking.body.reactions_deleted, false);
    const publicProfile = await call("GET", "/api/profiles/api-alice?persona=social");
    assert.equal(publicProfile.status, 200);
    assert.equal(publicProfile.body.profile.handle, "api-alice");
    assert.equal(publicProfile.body.profile.counts.posts, 1);
    assert.equal("email" in publicProfile.body.profile, false);
    assert.equal("mvx_address" in publicProfile.body.profile, false);

    const breaking = await call("GET", "/api/social/feed?lens=breaking");
    assert.equal(breaking.body.viewer_id, bob.id);
    assert.equal(breaking.body.viewer_persona, "social");
    assert.equal(breaking.body.provider.status, "disabled");
    assert.deepEqual(breaking.body.posts, []);
    const crossProfile = await call("POST", "/api/posts", { persona: "work", kind: "text", caption: "wrong profile" });
    assert.equal(crossProfile.status, 403);

    const contextual = await call("POST", "/api/posts", { persona: "social", kind: "text", caption: "Breaking news despre alegeri", provenance: "AI_ASSISTED" });
    assert.equal(contextual.status, 201);
    assert.equal(contextual.body.post.trust.riskLevel, "CONTEXT");
    assert.equal(contextual.body.post.trust.factualStatus, "NOT_FACT_CHECKED");
    const blocked = await call("POST", "/api/posts", { persona: "social", kind: "text", caption: "Trimite-mi fraza seed acum", provenance: "NOT_DECLARED" });
    assert.equal(blocked.status, 422);
    assert.equal(blocked.body.statement_of_reasons.automated_only, true);
    assert.equal(blocked.body.prepublication_reconsideration_available, true);
    assert.equal(repo.listPosts({ persona: "social" }).some((item) => item.caption.includes("fraza seed")), false);
    const reconsideration = await call("POST", "/api/social/moderation/reconsider", {
      kind: "text",
      caption: "Trimite-mi fraza seed acum",
      provenance: "NOT_DECLARED",
      reason: "Este un test al filtrului, nu o solicitare reală"
    });
    assert.equal(reconsideration.status, 200);
    assert.equal(reconsideration.body.may_publish, false);
    const safeRevision = await call("POST", "/api/social/moderation/reconsider", {
      kind: "text",
      caption: "Trimite-mi fraza seed acum",
      revised_caption: "Do not share your seed phrase with anyone",
      provenance: "NOT_DECLARED",
      reason: "Am rescris mesajul ca avertisment clar"
    });
    assert.equal(safeRevision.status, 200);
    assert.equal(safeRevision.body.may_publish, true);
    assert.equal(safeRevision.body.requires_explicit_resubmission, true);
    assert.equal(repo.listPosts({ persona: "social" }).some((item) => item.caption.includes("Do not share")), false);

    const benignSafety = await call("POST", "/api/posts", { persona: "social", kind: "text", caption: "Do not share your seed phrase with anyone", provenance: "NOT_DECLARED" });
    assert.equal(benignSafety.status, 201);

    const studioPng = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from("nexus-studio-image")]);
    const studioWav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt nexus-studio-audio")]);
    const studioMedia = fixtureUploadedMedia(repo, { bytes: studioPng, mime: "image/png", purpose: "social_post", userId: bob.id });
    const studioAudio = fixtureUploadedMedia(repo, { bytes: studioWav, mime: "audio/wav", purpose: "social_audio", userId: bob.id });
    assert.equal(studioMedia.status, 201);
    assert.equal(studioAudio.status, 201);
    const protectedMediaRead = await call("GET", studioMedia.body.media.url);
    assert.equal(protectedMediaRead.status, 200);
    assert.equal(protectedMediaRead.headers["cache-control"], "private, no-store, max-age=0");
    assert.equal(protectedMediaRead.headers.vary, "Cookie");
    const studioManifest = {
      version: 1, aspect: "VERTICAL_9_16", filter: "WARM", intensity: 60,
      trimStartMs: 0, trimEndMs: 0, playbackRate: 1, muteOriginal: false,
      overlay: { text: "Creator Studio", position: "BOTTOM", color: "WHITE" },
    };
    const studioUnknownField = await call("POST", "/api/posts", {
      persona: "social", kind: "image", caption: "Studio invalid", provenance: "CAMERA_CAPTURED_DECLARED",
      media_hash: studioMedia.body.media.hash, media_ext: studioMedia.body.media.ext,
      studio_manifest: { ...studioManifest, hidden_override: true },
    });
    assert.equal(studioUnknownField.status, 400);
    const studioMissingRights = await call("POST", "/api/posts", {
      persona: "social", kind: "image", caption: "Studio fără drepturi", provenance: "CAMERA_CAPTURED_DECLARED",
      media_hash: studioMedia.body.media.hash, media_ext: studioMedia.body.media.ext,
      audio_hash: studioAudio.body.media.hash, audio_ext: studioAudio.body.media.ext,
      studio_manifest: studioManifest,
    });
    assert.equal(studioMissingRights.status, 400);
    const studioPost = await call("POST", "/api/posts", {
      persona: "social", kind: "image", caption: "Creator Studio local", provenance: "CAMERA_CAPTURED_DECLARED",
      media_hash: studioMedia.body.media.hash, media_ext: studioMedia.body.media.ext,
      studio_manifest: studioManifest,
      audio_hash: studioAudio.body.media.hash, audio_ext: studioAudio.body.media.ext,
      audio_rights: "ORIGINAL_OWNED", audio_attribution: "Bob · Original local",
    });
    assert.equal(studioPost.status, 201);
    assert.equal(studioPost.body.owner_id, bob.id);
    assert.equal(studioPost.body.owner_persona, "social");
    assert.equal(studioPost.body.action, "post_published");
    assert.deepEqual(studioPost.body.chain, { status: "not_submitted", value: 0 });
    assert.equal(studioPost.body.post.creator_studio.integrity, "VERIFIED");
    assert.equal(studioPost.body.post.creator_studio.manifest.aspect, "VERTICAL_9_16");
    assert.equal(studioPost.body.post.audio_rights, "ORIGINAL_OWNED");
    assert.match(studioPost.body.post.creator_studio.manifest_hash, /^[a-f0-9]{64}$/);
    assert.equal((await call("GET", studioPost.body.post.audio ? `/media/${studioPost.body.post.audio.hash}.${studioPost.body.post.audio.ext}` : "/missing")).status, 200);

    const trust = await call("GET", `/api/social/posts/${contextual.body.post.id}/trust`);
    assert.equal(trust.status, 200);
    assert.equal(trust.body.can_appeal, true);
    assert.equal(trust.body.methodology.no_truth_score, true);
    assert.equal(trust.body.methodology.report_alone_removes_content, false);
    const report = await call("POST", `/api/social/posts/${contextual.body.post.id}/report`, { category: "MISINFORMATION_CONTEXT", details: "Lipsește sursa" });
    assert.equal(report.status, 201);
    assert.equal(report.body.enforcement_changed, false);
    const reportRetry = await call("POST", `/api/social/posts/${contextual.body.post.id}/report`, { category: "MISINFORMATION_CONTEXT" });
    assert.equal(reportRetry.body.report.id, report.body.report.id);
    const appeal = await call("POST", `/api/social/posts/${contextual.body.post.id}/appeal`, { reason: "Este o postare satirică, nu o știre" });
    assert.equal(appeal.status, 201);
    assert.equal(appeal.body.restriction_changed, false);
    assert.equal((await call("GET", `/api/social/posts/${contextual.body.post.id}/trust`)).body.assessment.authorDisputed, true);
    const integrity = await call("GET", "/api/social/moderation/integrity");
    assert.equal(integrity.body.internal_link_consistency.internalLinkConsistency, true);
    assert.equal(integrity.body.authenticated_completeness, false);
    assert.equal(integrity.body.trusted_external_checkpoint, false);
    assert.equal("audit_chain" in integrity.body, false);

    const fakeOpinion = await call("POST", `/api/posts/${post.id}/reaction`, { kind: "fake" });
    assert.equal(fakeOpinion.status, 200);
    assert.equal(fakeOpinion.body.semantics, "community_opinion_not_fact_check");
    const dislike = await call("POST", `/api/posts/${post.id}/reaction`, { kind: "dislike" });
    assert.equal(dislike.status, 200);
    assert.equal(dislike.body.private_dislike_by_me, true);
    assert.equal("DISLIKE" in dislike.body.counts, false);

    const comment = await call("POST", `/api/posts/${post.id}/comments`, { body: "Întrebare" });
    assert.equal(comment.status, 201);
    const reply = await call("POST", `/api/posts/${post.id}/comments`, { body: "Răspuns", parent_id: comment.body.comment.id });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.comment.parent_id, comment.body.comment.id);
    assert.equal((await call("POST", `/api/comments/${comment.body.comment.id}/reaction`, { kind: "love" })).status, 200);
    assert.equal((await call("POST", `/api/posts/${post.id}/save`, { active: true })).body.private, true);
    const blockedShare = await call("POST", `/api/posts/${post.id}/share`, { channel: "copy_link" });
    assert.equal(blockedShare.status, 409);
    assert.equal(blockedShare.body.feature, "SOCIAL_SHARE");
    assert.equal(blockedShare.body.enabled, false);

    const story = await call("POST", "/api/stories", { caption: "Rămâne", persistent: true, visibility: "public" });
    assert.equal(story.status, 201);
    assert.equal(story.body.lifecycle, "persistent_until_archived");
    assert.equal((await call("GET", "/api/stories")).body.stories.length, 1);
  } finally {
    db.close();
  }
});

test("API: unified inbox creates direct/group chats by Nexus username and labels transport truthfully", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sseEvents = [];
  const sse = { broadcast(event, data, channels) { for (const channel of channels) this.publish(channel, event, data); }, publish(channel, event, data) { sseEvents.push({ channel, event, data }); return { subscribers: 1, written: 1 }; }, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const { issueSession } = await import("../lib/security.js");
  try {
    const alice = repo.createUser({ handle: "chat-alice", displayName: "Alice", passwordHash: hashPassword("alice-secure-pass-123") });
    const bob = repo.createUser({ handle: "chat-bob", displayName: "Bob", passwordHash: hashPassword("bob-secure-pass-123") });
    const carol = repo.createUser({ handle: "chat-carol", displayName: "Carol" });
    for (const user of [alice, bob, carol]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    repo.updatePersona(bob.id, "social", { messagePolicy: "requests" });
    const session = issueSession(alice.id, "social");
    repo.insertSession({ tokenHash: session.tokenHash, userId: alice.id, persona: "social", expiresAt: session.expiresAt });
    const cookie = `nexus_session=${session.token}`;
    const callWith = async (sessionCookie, method, path, body = {}, extraHeaders = {}) => {
      const response = fakeRes();
      await handleRequest(fakeReq(method, path, sessionCookie, body, extraHeaders), response, { repo, sse, db });
      let responseBody = {};
      if (response.body) {
        try { responseBody = JSON.parse(response.body); } catch { responseBody = response.body; }
      }
      return { status: response.statusCode, body: responseBody };
    };
    const call = (method, path, body = {}) => callWith(cookie, method, path, body);

    const direct = await call("POST", "/api/chat/conversations", { kind: "direct", username: "@chat-bob" });
    assert.equal(direct.status, 201);
    assert.deepEqual(direct.body.intent, { kind: "direct", context_persona: "social", recipient_handles: ["chat-bob"], title: null });
    assert.equal(direct.body.conversation.context_persona, "social");
    assert.equal(direct.body.conversation.status, "request");
    const conversationId = direct.body.conversation.id;
    const sent = await call("POST", `/api/chat/conversations/${conversationId}/messages`, { body: "Salut", client_nonce: "api:message:0001" });
    assert.equal(sent.status, 201);
    assert.deepEqual(sent.body.intent, { conversation_id: conversationId, sender_id: alice.id, sender_persona: "social", client_nonce: "api:message:0001", encryption_mode: "plaintext_local", attachment_media_id: null });
    const replay = await call("POST", `/api/chat/conversations/${conversationId}/messages`, { body: "Alt text", client_nonce: "api:message:0001" });
    assert.equal(replay.body.message.id, sent.body.message.id);
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/messages`, { body: "Spam", client_nonce: "api:message:0002" })).status, 400);
    const thread = await call("GET", `/api/chat/conversations/${conversationId}/messages`);
    assert.equal(thread.body.messages.length, 1);
    assert.deepEqual(thread.body.query, { conversation_id: conversationId, device_id: null, viewer_persona: "social" });
    assert.equal(thread.body.privacy_enforced_server_side, true);
    assert.equal(thread.body.conversation.id, conversationId);
    assert.equal(thread.body.transport.mode, "per_message");
    assert.equal(thread.body.transport.e2ee_default, false);
    assert.equal(thread.body.transport.e2ee_v1_available, true);
    assert.match(thread.body.transport.label, /registered secure-context device/);
    const read = await call("POST", `/api/chat/conversations/${conversationId}/read`, { through_message_id: sent.body.message.id });
    assert.equal(read.status, 200);
    assert.deepEqual(read.body, { ok: true, conversation_id: conversationId, viewer_id: alice.id, viewer_persona: "social", through_message_id: sent.body.message.id });
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/read`, { through_message_id: sent.body.message.id + 1000 })).status, 404);
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/meetings`, { title: "Too early", starts_at: Math.floor(Date.now() / 1000) + 3600, duration_minutes: 45 })).status, 404);

    const group = await call("POST", "/api/chat/conversations", { kind: "group", usernames: ["chat-bob", "chat-carol"], title: "Echipa" });
    assert.equal(group.status, 201);
    assert.deepEqual(group.body.intent, { kind: "group", context_persona: "social", recipient_handles: ["chat-bob", "chat-carol"], title: "Echipa" });
    assert.equal(group.body.conversation.participants.length, 3);
    assert.equal(group.body.conversation.participants.find((item) => item.id === bob.id).state, "pending");
    assert.equal((await call("POST", "/api/chat/conversations", { kind: "channel", username: "chat-bob" })).status, 400);
    assert.equal((await call("POST", "/api/chat/conversations", { kind: "group", usernames: Array.from({ length: 50 }, (_, index) => `limit_${index}`), title: "Too large" })).status, 400);
    const inbox = await call("GET", "/api/chat/conversations?persona=social");
    assert.equal(inbox.body.conversations.length, 1);
    assert.deepEqual(inbox.body.query, { persona: "social", box: "inbox", limit: 30, cursor: null });
    assert.equal(inbox.body.privacy_enforced_server_side, true);
    assert.equal(inbox.body.transport.mode, "per_message");
    assert.equal(inbox.body.transport.e2ee_v1_available, true);
    assert.equal((await call("GET", "/api/chat/conversations?persona=social&box=sent")).body.conversations.length, 1);

    const bobSession = issueSession(bob.id, "social");
    repo.insertSession({ tokenHash: bobSession.tokenHash, userId: bob.id, persona: "social", expiresAt: bobSession.expiresAt });
    const bobCookie = `nexus_session=${bobSession.token}`;
    const requests = await callWith(bobCookie, "GET", "/api/chat/conversations?persona=social&box=requests");
    assert.deepEqual(requests.body.conversations.map((item) => item.id).sort((a, b) => a - b), [conversationId, group.body.conversation.id].sort((a, b) => a - b));
    assert.equal((await callWith(bobCookie, "POST", "/api/chat/conversations", { kind: "direct", username: "chat-alice" })).status, 409);
    const bobWorkSession = issueSession(bob.id, "work");
    repo.insertSession({ tokenHash: bobWorkSession.tokenHash, userId: bob.id, persona: "work", expiresAt: bobWorkSession.expiresAt });
    assert.equal((await callWith(`nexus_session=${bobWorkSession.token}`, "POST", `/api/chat/conversations/${conversationId}/decision`, { decision: "accept" })).status, 409);
    const accepted = await callWith(bobCookie, "POST", `/api/chat/conversations/${conversationId}/decision`, { decision: "accept" });
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.body, { ok: true, conversation_id: conversationId, actor_id: bob.id, actor_persona: "social", decision: "accept", membership_state: "active", conversation_status: "active" });
    const typing = await call("POST", `/api/chat/conversations/${conversationId}/typing`, { active: true });
    assert.equal(typing.status, 200);
    assert.deepEqual(typing.body, { ok: true, intent: { conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", active: true }, expires_in_seconds: 8 });
    const typingEvent = sseEvents.find((event) => event.event === "typing" && event.channel === `user:${bob.id}`);
    assert.deepEqual(typingEvent.data, { recipient_id: bob.id, recipient_persona: "social", conversation_id: conversationId, user_id: alice.id, actor_persona: "social", active: true });
    assert.equal((await callWith(`nexus_session=${bobWorkSession.token}`, "POST", `/api/chat/conversations/${conversationId}/typing`, { active: true })).status, 404);
    const pngBytes = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from("nexus-chat-image")]);
    const imageUpload = fixtureUploadedMedia(repo, { bytes: pngBytes, mime: "image/png", purpose: "message_attachment", userId: alice.id });
    assert.equal(imageUpload.status, 201);
    assert.equal(imageUpload.body.media.available, true);
    assert.equal(imageUpload.body.safety.malware_scanned, false);
    const imageMessage = await call("POST", `/api/chat/conversations/${conversationId}/messages`, { attachment_media_id: imageUpload.body.media.id, client_nonce: "api:attachment:image:01" });
    assert.equal(imageMessage.status, 201);
    const messageEvent = sseEvents.findLast((event) => event.event === "message" && event.channel === `user:${bob.id}`);
    assert.deepEqual(messageEvent.data, { recipient_id: bob.id, recipient_persona: "social", conversation_id: conversationId, message_id: imageMessage.body.message.id, encryption_mode: "plaintext_local" });
    assert.equal("message" in messageEvent.data, false);
    const notificationInvalidations = sseEvents.filter((event) => event.event === "notification-changed" && event.channel === `user:${bob.id}`);
    assert.equal(notificationInvalidations.length > 0, true);
    assert.equal(notificationInvalidations.every((event) => event.data.recipient_id === bob.id && event.data.recipient_persona === "social" && /^[A-Za-z0-9_-]{16}$/.test(event.data.change_id)), true);
    assert.equal(new Set(notificationInvalidations.map((event) => event.data.change_id)).size, notificationInvalidations.length);
    assert.equal((await callWith(bobCookie, "GET", imageUpload.body.media.url)).status, 200);
    const carolSession = issueSession(carol.id, "social");
    repo.insertSession({ tokenHash: carolSession.tokenHash, userId: carol.id, persona: "social", expiresAt: carolSession.expiresAt });
    const carolCookie = `nexus_session=${carolSession.token}`;
    assert.equal((await callWith(carolCookie, "GET", imageUpload.body.media.url)).status, 404);
    const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>");
    const documentUpload = fixtureUploadedMedia(repo, { bytes: pdfBytes, mime: "application/pdf", purpose: "message_attachment", userId: alice.id });
    assert.equal(documentUpload.status, 202);
    assert.equal(documentUpload.body.media.available, false);
    assert.equal(documentUpload.body.safety.reason, "document_requires_malware_scanner");
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/messages`, { attachment_media_id: documentUpload.body.media.id, client_nonce: "api:attachment:pdf:01" })).status, 423);
    const meetingStartsAt = Math.floor(Date.now() / 1000) + 3600;
    const meeting = await call("POST", `/api/chat/conversations/${conversationId}/meetings`, { title: "Demo", starts_at: meetingStartsAt, duration_minutes: 45 });
    assert.equal(meeting.status, 201);
    assert.deepEqual(meeting.body.intent, { conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", title: "Demo", starts_at: meetingStartsAt, duration_minutes: 45 });
    assert.equal(meeting.body.meeting.conversation_id, conversationId);
    assert.equal(meeting.body.meeting.created_by, alice.id);
    const renamedGroup = await call("PATCH", `/api/chat/conversations/${group.body.conversation.id}/group`, { title: "Echipa Nexus", expected_title: "Echipa" });
    assert.equal(renamedGroup.status, 200);
    assert.deepEqual(renamedGroup.body.intent, { conversation_id: group.body.conversation.id, actor_id: alice.id, actor_persona: "social", action: "rename", title: "Echipa Nexus", expected_title: "Echipa" });
    assert.equal((await call("PATCH", `/api/chat/conversations/${group.body.conversation.id}/group`, { title: "Stale overwrite", expected_title: "Echipa" })).status, 409);
    const startedCall = await call("POST", `/api/chat/conversations/${conversationId}/calls`, { mode: "video" });
    assert.equal(startedCall.status, 201);
    assert.deepEqual(startedCall.body.intent, { conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", mode: "video" });
    assert.equal(startedCall.body.transport.topology, "local_p2p");
    assert.equal(startedCall.body.transport.relay, "none");
    const callId = startedCall.body.call.call_id;
    const inviteEvent = sseEvents.find((event) => event.event === "call-invite" && event.channel === `user:${bob.id}:persona:social:calls`);
    assert.equal(Boolean(inviteEvent), true);
    assert.equal(inviteEvent.data.recipient_id, bob.id);
    assert.equal(inviteEvent.data.recipient_persona, "social");
    const acceptedCall = await callWith(bobCookie, "POST", `/api/chat/calls/${callId}/decision`, { decision: "accept" });
    assert.equal(acceptedCall.status, 200);
    assert.deepEqual(acceptedCall.body.intent, { call_id: callId, conversation_id: conversationId, actor_id: bob.id, actor_persona: "social", decision: "accept" });
    const leaseHeaders = { "idempotency-key": "nexus-test-call-lease-0001" };
    const leaseBody = { lease_nonce: "lease:api:alice:0001" };
    const renewedLease = await callWith(cookie, "POST", `/api/chat/calls/${callId}/heartbeat`, leaseBody, leaseHeaders);
    assert.equal(renewedLease.status, 200);
    assert.deepEqual(renewedLease.body.intent, { call_id: callId, conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", lease_nonce: leaseBody.lease_nonce });
    assert.equal(renewedLease.body.call.participants.length, 2);
    assert.equal(renewedLease.body.lease_seconds, 25);
    const replayedLease = await callWith(cookie, "POST", `/api/chat/calls/${callId}/heartbeat`, leaseBody, leaseHeaders);
    assert.deepEqual(replayedLease.body, renewedLease.body, "one heartbeat intent replays one lease result");
    assert.equal((await call("POST", `/api/chat/calls/${callId}/heartbeat`, { lease_nonce: "bad" })).status, 400);
    const offerBody = { type: "offer", signal_nonce: "api:signal:offer:001", payload: { type: "offer", sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=Nexus\r\nt=0 0\r\n" } };
    assert.equal((await callWith(bobCookie, "POST", `/api/chat/calls/${callId}/signal`, offerBody)).status, 403);
    const deliveredSignal = await call("POST", `/api/chat/calls/${callId}/signal`, offerBody);
    assert.equal(deliveredSignal.status, 201);
    assert.deepEqual(deliveredSignal.body.intent, { call_id: callId, conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", signal_nonce: offerBody.signal_nonce, type: "offer" });
    assert.equal(deliveredSignal.body.delivered, true);
    const replayedSignal = await call("POST", `/api/chat/calls/${callId}/signal`, offerBody);
    assert.equal(replayedSignal.status, 200);
    assert.equal(replayedSignal.body.replay, true);
    assert.equal(replayedSignal.body.delivered, true);
    assert.equal((await call("POST", `/api/chat/calls/${callId}/signal`, { ...offerBody, payload: { ...offerBody.payload, sdp: offerBody.payload.sdp + "a=changed\r\n" } })).status, 403);
    assert.equal(sseEvents.filter((event) => event.event === "call-signal" && event.channel === `user:${bob.id}:persona:social:calls` && event.data.type === "offer").length, 1);
    assert.equal(repo.db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type = 'table' AND name = 'call_signals'").get().count, 0);
    const signalGuard = repo.db.prepare(`SELECT signal_nonce, signal_type, payload_sha256, delivered_at FROM call_signal_replay_guard WHERE call_id = ?`).get(callId);
    assert.equal(signalGuard.signal_nonce, offerBody.signal_nonce);
    assert.equal(signalGuard.signal_type, "offer");
    assert.match(signalGuard.payload_sha256, /^[a-f0-9]{64}$/);
    assert.equal(signalGuard.delivered_at != null, true);
    assert.equal(JSON.stringify(signalGuard).includes(offerBody.payload.sdp), false);
    const endedCall = await call("POST", `/api/chat/calls/${callId}/end`, {});
    assert.equal(endedCall.status, 200);
    assert.deepEqual(endedCall.body.intent, { call_id: callId, conversation_id: conversationId, actor_id: alice.id, actor_persona: "social", action: "end" });
    assert.equal((await call("POST", `/api/chat/calls/${callId}/signal`, { type: "ice", signal_nonce: "api:signal:late:0001", payload: { candidate: "candidate:1 1 UDP 1 127.0.0.1 9999 typ host", sdpMid: "0", sdpMLineIndex: 0 } })).status, 403);
    assert.deepEqual((await call("GET", "/api/chat/calls/current")).body.calls, []);
    assert.equal((await callWith(bobCookie, "POST", `/api/chat/conversations/${conversationId}/messages`, { body: "Acceptat", client_nonce: "api:bob:message:01", expires_in_seconds: 60 })).status, 201);
    const aliceDevice = "api:alice:device:0001";
    const bobDevice = "api:bob:device:000001";
    const jwkA = { kty: "EC", crv: "P-256", x: "G".repeat(43), y: "H".repeat(43), ext: true, key_ops: [] };
    const jwkB = { kty: "EC", crv: "P-256", x: "I".repeat(43), y: "J".repeat(43), ext: true, key_ops: [] };
    const aliceDeviceRegistration = await call("POST", "/api/chat/devices", { device_id: aliceDevice, label: "Alice test", public_jwk: jwkA });
    assert.equal(aliceDeviceRegistration.status, 201);
    assert.deepEqual(aliceDeviceRegistration.body.intent, { owner_id: alice.id, device_id: aliceDevice, action: "register" });
    const bobDeviceRegistration = await callWith(bobCookie, "POST", "/api/chat/devices", { device_id: bobDevice, label: "Bob test", public_jwk: jwkB });
    assert.equal(bobDeviceRegistration.status, 201);
    assert.deepEqual(bobDeviceRegistration.body.intent, { owner_id: bob.id, device_id: bobDevice, action: "register" });
    assert.equal((await call("POST", "/api/chat/devices", { device_id: "api:private:device:1", label: "bad", public_jwk: { ...jwkA, d: "private" } })).status, 400);
    const ownerDeviceInventory = await callWith(bobCookie, "GET", "/api/chat/devices");
    assert.deepEqual(ownerDeviceInventory.body.query, { owner_id: bob.id });
    assert.equal(ownerDeviceInventory.body.public_keys_exposed_in_account_inventory, false);
    assert.equal(ownerDeviceInventory.body.private_keys_on_server, false);
    assert.equal(ownerDeviceInventory.body.step_up, "password_or_xportal");
    assert.equal("public_jwk" in ownerDeviceInventory.body.devices[0], false);
    const keyMaterial = await call("GET", `/api/chat/conversations/${conversationId}/key-material`);
    assert.equal(keyMaterial.body.ready, true);
    assert.deepEqual(keyMaterial.body.query, { conversation_id: conversationId, viewer_id: alice.id, viewer_persona: "social" });
    assert.equal(keyMaterial.body.privacy_enforced_server_side, true);
    assert.equal(keyMaterial.body.conversation_persona, "social");
    assert.deepEqual(keyMaterial.body.participants, [{ user_id: alice.id, handle: alice.handle }, { user_id: bob.id, handle: bob.handle }]);
    assert.equal(keyMaterial.body.server_has_private_keys, false);
    assert.equal((await callWith(`nexus_session=${bobWorkSession.token}`, "GET", `/api/chat/conversations/${conversationId}/key-material`)).status, 404);
    const secureNonce = "api:e2ee:nonce:00001";
    const secureEnvelopes = keyMaterial.body.devices.map((device) => ({
      recipient_device_id: device.device_id,
      iv_b64: Buffer.alloc(12, 2).toString("base64"),
      ciphertext_b64: Buffer.from(`cipher:${device.device_id}`).toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 2,
        conversation_id: conversationId,
        client_nonce: secureNonce,
        sender_device_id: aliceDevice,
        recipient_device_id: device.device_id,
        device_set_commitment: keyMaterial.body.commitment,
        key_epoch: keyMaterial.body.key_epoch,
        key_epoch_commitment: keyMaterial.body.key_epoch_commitment,
      })),
    }));
    const secure = await call("POST", `/api/chat/conversations/${conversationId}/messages`, {
      encryption_mode: "e2ee_v1",
      sender_device_id: aliceDevice,
      client_nonce: secureNonce,
      device_set_commitment: keyMaterial.body.commitment,
      key_epoch: keyMaterial.body.key_epoch,
      key_epoch_commitment: keyMaterial.body.key_epoch_commitment,
      envelopes: secureEnvelopes,
    });
    assert.equal(secure.status, 201);
    assert.deepEqual(secure.body.intent, { conversation_id: conversationId, sender_id: alice.id, sender_persona: "social", client_nonce: secureNonce, encryption_mode: "e2ee_v1", attachment_media_id: null });
    assert.equal(secure.body.transport.e2ee, true);
    assert.equal(secure.body.transport.server_received_plaintext, false);
    assert.equal("envelope" in secure.body.message, false);
    const missingEpoch = await call("POST", `/api/chat/conversations/${conversationId}/messages`, {
      encryption_mode: "e2ee_v1", sender_device_id: aliceDevice,
      client_nonce: "api:e2ee:missing:epoch", device_set_commitment: keyMaterial.body.commitment,
      envelopes: secureEnvelopes,
    });
    assert.equal(missingEpoch.status, 400);
    const staleEpoch = await call("POST", `/api/chat/conversations/${conversationId}/messages`, {
      encryption_mode: "e2ee_v1", sender_device_id: aliceDevice,
      client_nonce: "api:e2ee:stale:epoch", device_set_commitment: keyMaterial.body.commitment,
      key_epoch: keyMaterial.body.key_epoch, key_epoch_commitment: "f".repeat(64),
      envelopes: secureEnvelopes,
    });
    assert.equal(staleEpoch.status, 409);
    assert.equal(staleEpoch.body.error, "key_epoch_stale");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM message_items WHERE client_nonce IN (?, ?)").get("api:e2ee:missing:epoch", "api:e2ee:stale:epoch").count, 0);
    const decryptedView = await callWith(bobCookie, "GET", `/api/chat/conversations/${conversationId}/messages?device_id=${encodeURIComponent(bobDevice)}`);
    assert.deepEqual(decryptedView.body.query, { conversation_id: conversationId, device_id: bobDevice, viewer_persona: "social" });
    assert.equal(decryptedView.body.privacy_enforced_server_side, true);
    const encryptedMessage = decryptedView.body.messages.find((message) => message.id === secure.body.message.id);
    assert.equal(encryptedMessage.envelope.recipient_device_id, bobDevice);
    assert.equal((await call("GET", `/api/chat/conversations/${conversationId}/messages?device_id=${encodeURIComponent(bobDevice)}`)).status, 403);
    const bobSecondDevice = "api:bob:device:000002";
    assert.equal((await callWith(bobCookie, "POST", "/api/chat/devices", { device_id: bobSecondDevice, label: "Bob new browser", public_jwk: { ...jwkB, x: "K".repeat(43), y: "L".repeat(43) } })).status, 201);
    const noRetroactiveEnvelope = await callWith(bobCookie, "GET", `/api/chat/conversations/${conversationId}/messages?device_id=${encodeURIComponent(bobSecondDevice)}`);
    assert.equal(noRetroactiveEnvelope.body.messages.find((message) => message.id === secure.body.message.id).envelope, null);
    const revokeEndpoint = `/api/chat/devices/${encodeURIComponent(bobDevice)}/revoke`;
    assert.equal((await callWith(bobCookie, "POST", revokeEndpoint, {})).status, 401);
    assert.equal(repo.getChatDevice(bobDevice).status, "active");
    assert.equal((await callWith(bobCookie, "POST", revokeEndpoint, { current_password: "wrong-password" })).status, 401);
    assert.equal(repo.getChatDevice(bobDevice).status, "active");
    const securityBefore = db.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id = ? AND type = 'security'").get(bob.id).count;
    const revokeHeaders = { "idempotency-key": "nexus-chat-device-revoke-0001" };
    const revoked = await callWith(bobCookie, "POST", revokeEndpoint, { current_password: "bob-secure-pass-123" }, revokeHeaders);
    assert.equal(revoked.status, 200);
    assert.deepEqual(revoked.body.intent, { owner_id: bob.id, device_id: bobDevice, action: "revoke" });
    assert.equal(revoked.body.device.status, "revoked");
    assert.equal(revoked.body.reversible, false);
    assert.equal(revoked.body.historical_access_transferred, false);
    const replayedRevocation = await callWith(bobCookie, "POST", revokeEndpoint, { current_password: "bob-secure-pass-123" }, revokeHeaders);
    assert.equal(replayedRevocation.status, 200);
    assert.deepEqual(replayedRevocation.body, revoked.body);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id = ? AND type = 'security'").get(bob.id).count, securityBefore + 1);
    assert.equal((await callWith(bobCookie, "GET", `/api/chat/conversations/${conversationId}/messages?device_id=${encodeURIComponent(bobDevice)}`)).status, 403);
    const revive = await callWith(bobCookie, "POST", "/api/chat/devices", { device_id: bobDevice, label: "revive forbidden", public_jwk: jwkB });
    assert.equal(revive.status, 409);
    assert.equal(revive.body.code, "CHAT_DEVICE_ID_UNAVAILABLE");
    const acceptedGroup = await callWith(bobCookie, "POST", `/api/chat/conversations/${group.body.conversation.id}/decision`, { decision: "accept" });
    assert.equal(acceptedGroup.status, 200);
    assert.deepEqual(acceptedGroup.body, { ok: true, conversation_id: group.body.conversation.id, actor_id: bob.id, actor_persona: "social", decision: "accept", membership_state: "active", conversation_status: "active" });
    assert.equal((await callWith(bobCookie, "POST", "/api/profile/block", { user_id: alice.id, active: true })).status, 200);
    assert.equal((await call("GET", `/api/chat/conversations/${conversationId}/messages`)).status, 403);
    assert.equal((await callWith(bobCookie, "GET", imageUpload.body.media.url)).status, 404, "a known attachment URL cannot bypass a conversation block");
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/messages`, { body: "blocked", client_nonce: "api:blocked:plaintext" })).status, 403);
    assert.equal((await call("POST", `/api/chat/conversations/${conversationId}/messages`, {
      encryption_mode: "e2ee_v1", sender_device_id: aliceDevice, client_nonce: secureNonce,
      device_set_commitment: keyMaterial.body.commitment, key_epoch: keyMaterial.body.key_epoch,
      key_epoch_commitment: keyMaterial.body.key_epoch_commitment, envelopes: secureEnvelopes,
    })).status, 403, "a different HTTP idempotency key cannot replay E2EE content through a block");
    assert.equal((await callWith(bobCookie, "POST", "/api/profile/block", { user_id: alice.id, active: false })).status, 200);
    assert.equal((await call("POST", "/api/chat/conversations", { kind: "direct", username: "missing-user" })).status, 404);
    assert.equal((await call("POST", "/api/messages", { to_id: bob.id, body: "privacy bypass" })).status, 410);
    assert.equal((await call("GET", `/api/messages/${bob.id}`)).status, 410);
  } finally {
    db.close();
  }
});

test("NativeAuth local-origin policy accepts the phone LAN origin only in private ranges", () => {
  assert.equal(isLocalDevelopmentOrigin("http://192.168.1.153:3000"), true);
  assert.equal(isLocalDevelopmentOrigin("http://10.0.0.4:3000"), true);
  assert.equal(isLocalDevelopmentOrigin("https://172.20.2.5"), true);
  assert.equal(isLocalDevelopmentOrigin("http://example.com"), false);
  assert.equal(isLocalDevelopmentOrigin("https://192.168.1.153.evil.example"), false);
  assert.equal(isLocalDevelopmentOrigin("javascript:alert(1)"), false);
});

test("auth throttling is deterministic and exposes a bounded retry window", async () => {
  const { consumeAuthAttempt, clearAuthAttempts } = await import("../lib/api.js");
  const scope = "system-test-rate-limit";
  const subject = "actor-20260823";
  clearAuthAttempts(scope, subject);
  assert.equal(consumeAuthAttempt(scope, subject, { limit: 2, windowMs: 1000, at: 10_000 }).allowed, true);
  assert.equal(consumeAuthAttempt(scope, subject, { limit: 2, windowMs: 1000, at: 10_100 }).allowed, true);
  const denied = consumeAuthAttempt(scope, subject, { limit: 2, windowMs: 1000, at: 10_200 });
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
  assert.equal(consumeAuthAttempt(scope, subject, { limit: 2, windowMs: 1000, at: 11_101 }).allowed, true);
  clearAuthAttempts(scope, subject);
});

test("auth rejects cross-site mutations, oversized passwords and leaked raw token storage", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");

  const crossSiteReq = fakeReq("POST", "/auth/email/signup-init", "", { email: "actor@example.invalid" });
  crossSiteReq.headers.host = "localhost:3000";
  crossSiteReq.headers.origin = "https://attacker.example";
  const crossSite = fakeRes();
  await handleRequest(crossSiteReq, crossSite, { repo, sse, db });
  assert.equal(crossSite.statusCode, 403);

  const call = async (path, body) => {
    const res = fakeRes();
    await handleRequest(fakeReq("POST", path, "", body), res, { repo, sse, db });
    res.body = res.body ? JSON.parse(res.body) : {};
    res.status = res.statusCode;
    return res;
  };
  const init = await call("/auth/email/signup-init", { email: "oversized@example.invalid" });
  const key = UserSecretKey.generate();
  const address = key.generatePublicKey().toAddress("erd").toBech32();
  const signature = Buffer.from(key.sign(Buffer.from(init.body.message))).toString("hex");
  const oversized = await call("/auth/email/signup", {
    email: "oversized@example.invalid",
    password: "x".repeat(257),
    wallet_proof: { nonce: init.body.nonce, address, signature },
  });
  assert.equal(oversized.status, 400);
  assert.equal(repo.stats().users, 0);

  const user = repo.createUser({ handle: "tokenhash", displayName: "Token Hash" });
  repo.setUserEmailVerification(user.id, "raw-verification-bearer", Date.now() + 60_000);
  repo.setPasswordReset(user.id, "raw-reset-bearer", Date.now() + 60_000);
  const stored = repo.getUserById(user.id);
  assert.equal(stored.email_verification_token, sha256Hex("raw-verification-bearer"));
  assert.equal(stored.password_reset_token, sha256Hex("raw-reset-bearer"));
  db.close();
});

test("wallet identity resolution is unique across primary and linked addresses", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const wallet = generateWallet().address;
  const owner = repo.createUser({ handle: "wallet_owner", displayName: "Owner", mvxAddress: wallet });
  const same = repo.setLinkedWallet(owner.id, wallet);
  assert.equal(same.ok, true);
  assert.equal(repo.resolveUserByWalletAddress(wallet).user.id, owner.id);
  const other = repo.createUser({ handle: "other_owner", displayName: "Other" });
  assert.equal(repo.setLinkedWallet(other.id, wallet).ok, false);
  db.close();
});

test("wallet identity is cross-column unique and xPortal-native accounts use the canonical login factor", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const wallet = "erd1qqqqqqqqqqqqqpgqcanonicalwalletidentity0000000000000000000";
  const linkedOwner = repo.createUser({ handle: "linked_owner", displayName: "Linked owner" });
  assert.equal(repo.setLinkedWallet(linkedOwner.id, wallet).ok, true);
  assert.throws(
    () => repo.createUser({ handle: "duplicate_primary", displayName: "Duplicate", mvxAddress: wallet }),
    /wallet identity/i,
  );

  const nativeWallet = "erd1qqqqqqqqqqqqqpgqnativewalletidentity000000000000000000000";
  const native = repo.createUser({ handle: "native_owner", displayName: "Native", mvxAddress: nativeWallet });
  assert.equal(repo.getXPortalLoginAddress(native), nativeWallet);
  assert.equal(repo.getXPortalLoginAddress(linkedOwner), wallet);

  const passwordOwner = repo.createUser({ handle: "password_owner", displayName: "Password", passwordHash: "synthetic", mvxAddress: "erd1qqqqqqqqqqqqqpgqlocaldevicewallet0000000000000000000000" });
  assert.equal(repo.getXPortalLoginAddress(passwordOwner), null);
  db.close();
});

test("OAuth state is provider/browser-bound, expiring and single-use", async () => {
  const { issueOAuthState, consumeOAuthState } = await import("../lib/api.js");
  const first = issueOAuthState("google", 1000, "browser-a");
  assert.match(first.state, /^[A-Za-z0-9_-]+$/);
  assert.match(first.codeChallenge, /^[A-Za-z0-9_-]+$/);
  assert.equal(consumeOAuthState("facebook", first.state, 1100, "browser-a"), null);
  assert.equal(consumeOAuthState("google", first.state, 1100, "browser-a"), null);

  const wrongBrowser = issueOAuthState("google", 2000, "browser-a");
  assert.equal(consumeOAuthState("google", wrongBrowser.state, 2100, "browser-b"), null);

  const expired = issueOAuthState("google", 3000, "browser-a");
  assert.equal(consumeOAuthState("google", expired.state, expired.expiresAt + 1, "browser-a"), null);

  const valid = issueOAuthState("facebook", 4000, "browser-a");
  const record = consumeOAuthState("facebook", valid.state, 4100, "browser-a");
  assert.ok(record?.codeVerifier);
  assert.equal(consumeOAuthState("facebook", valid.state, 4101, "browser-a"), null);
});

test("Google stays truthfully unavailable until the embedded wallet provisioner is verified", async () => {
  const previous = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    origin: process.env.NEXUS_ORIGIN,
    walletProvisioner: process.env.NEXUS_OAUTH_WALLET_PROVISIONER,
  };
  process.env.GOOGLE_CLIENT_ID = "system-test-client";
  process.env.GOOGLE_CLIENT_SECRET = "system-test-secret";
  process.env.NEXUS_ORIGIN = "http://localhost:3000";
  process.env.NEXUS_OAUTH_WALLET_PROVISIONER = "xalias";
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  try {
    const start = fakeRes();
    let providerCalls = 0;
    await handleRequest(fakeReq("GET", "/auth/google/start", "", {}), start, {
      repo, sse, db, fetcher: async () => { providerCalls += 1; throw new Error("must not call provider"); },
    });
    assert.equal(start.statusCode, 501);
    assert.equal(providerCalls, 0);
    assert.equal(repo.stats().users, 0);
  } finally {
    db.close();
    if (previous.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous.clientId;
    if (previous.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = previous.clientSecret;
    if (previous.origin === undefined) delete process.env.NEXUS_ORIGIN; else process.env.NEXUS_ORIGIN = previous.origin;
    if (previous.walletProvisioner === undefined) delete process.env.NEXUS_OAUTH_WALLET_PROVISIONER; else process.env.NEXUS_OAUTH_WALLET_PROVISIONER = previous.walletProvisioner;
  }
});

test("NativeAuth production configuration fails closed without accepted origins", async () => {
  const previousOrigins = process.env.NEXUS_ACCEPTED_ORIGINS;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.NEXUS_ACCEPTED_ORIGINS;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(createNativeAuthServer({ apiUrl: "http://unused" }), /NEXUS_ACCEPTED_ORIGINS is required/);
  } finally {
    if (previousOrigins === undefined) delete process.env.NEXUS_ACCEPTED_ORIGINS;
    else process.env.NEXUS_ACCEPTED_ORIGINS = previousOrigins;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("NativeAuth init is LAN-bound, short-lived and uses the injected block source", async () => {
  const previousOrigin = process.env.NEXUS_ORIGIN;
  const previousProjectId = process.env.NEXUS_WC_PROJECT_ID;
  const previousProjectAttested = process.env.NEXUS_WC_PROJECT_ATTESTED;
  const previousAttestedOrigins = process.env.NEXUS_WC_ATTESTED_ORIGINS;
  process.env.NEXUS_ORIGIN = "http://localhost:3000";
  process.env.NEXUS_WC_PROJECT_ID = "c".repeat(32);
  process.env.NEXUS_WC_PROJECT_ATTESTED = "true";
  process.env.NEXUS_WC_ATTESTED_ORIGINS = "http://localhost:3000";
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  let calls = 0;
  try {
    const response = fakeRes();
    await handleRequest(fakeReq("GET", "/auth/mvx/init", "", {}), response, {
      repo,
      sse,
      db,
      fetcher: async () => {
        calls += 1;
        return { json: async () => ([{ hash: "a".repeat(64) }]) };
      },
    });
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.origin, "http://localhost:3000");
    assert.equal(body.init.split(".")[2], "900");
    assert.equal(calls, 1);
  } finally {
    db.close();
    if (previousOrigin === undefined) delete process.env.NEXUS_ORIGIN; else process.env.NEXUS_ORIGIN = previousOrigin;
    if (previousProjectId === undefined) delete process.env.NEXUS_WC_PROJECT_ID; else process.env.NEXUS_WC_PROJECT_ID = previousProjectId;
    if (previousProjectAttested === undefined) delete process.env.NEXUS_WC_PROJECT_ATTESTED; else process.env.NEXUS_WC_PROJECT_ATTESTED = previousProjectAttested;
    if (previousAttestedOrigins === undefined) delete process.env.NEXUS_WC_ATTESTED_ORIGINS; else process.env.NEXUS_WC_ATTESTED_ORIGINS = previousAttestedOrigins;
  }
});

test("xPortal init fails before provider work when Dashboard/origin attestation is absent", async () => {
  const previousOrigin = process.env.NEXUS_ORIGIN;
  const previousProjectAttested = process.env.NEXUS_WC_PROJECT_ATTESTED;
  const previousAttestedOrigins = process.env.NEXUS_WC_ATTESTED_ORIGINS;
  process.env.NEXUS_ORIGIN = "http://localhost:3000";
  process.env.NEXUS_WC_PROJECT_ATTESTED = "false";
  process.env.NEXUS_WC_ATTESTED_ORIGINS = "";
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  let calls = 0;
  try {
    const response = fakeRes();
    await handleRequest(fakeReq("GET", "/auth/mvx/init", "", {}), response, {
      repo,
      sse,
      db,
      fetcher: async () => { calls += 1; throw new Error("must not run"); },
    });
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 503);
    assert.equal(body.code, "WALLETCONNECT_PROJECT_NOT_ATTESTED");
    assert.match(body.error, /WalletConnect Dashboard/);
    assert.equal(calls, 0);
  } finally {
    db.close();
    if (previousOrigin === undefined) delete process.env.NEXUS_ORIGIN; else process.env.NEXUS_ORIGIN = previousOrigin;
    if (previousProjectAttested === undefined) delete process.env.NEXUS_WC_PROJECT_ATTESTED; else process.env.NEXUS_WC_PROJECT_ATTESTED = previousProjectAttested;
    if (previousAttestedOrigins === undefined) delete process.env.NEXUS_WC_ATTESTED_ORIGINS; else process.env.NEXUS_WC_ATTESTED_ORIGINS = previousAttestedOrigins;
  }
});

test("legacy authentication bypass routes are retired fail-closed", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  for (const path of ["/auth/signup", "/auth/login", "/auth/mvx/challenge", "/auth/mvx/verify", "/wallets/import"]) {
    const response = fakeRes();
    await handleRequest(fakeReq("POST", path, "", { handle: "bypass", password: "password-123" }), response, { repo, sse, db });
    assert.equal(response.statusCode, 410, path);
  }
  assert.equal(repo.stats().users, 0);
  db.close();
});

test("production auth fails closed before state mutation on insecure transport", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousTrustProxy = process.env.NEXUS_TRUST_PROXY;
  process.env.NODE_ENV = "production";
  delete process.env.NEXUS_TRUST_PROXY;
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  try {
    const insecure = fakeRes();
    await handleRequest(fakeReq("POST", "/auth/email/login", "", { email: "nobody@example.invalid", password: "password-123" }), insecure, { repo, sse, db });
    assert.equal(insecure.statusCode, 400);
    assert.equal(repo.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);

    process.env.NEXUS_TRUST_PROXY = "1";
    const secureRequest = fakeReq("POST", "/auth/email/login", "", { email: "nobody@example.invalid", password: "password-123" });
    secureRequest.headers["x-forwarded-proto"] = "https";
    const secure = fakeRes();
    await handleRequest(secureRequest, secure, { repo, sse, db });
    assert.equal(secure.statusCode, 401);
  } finally {
    db.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousTrustProxy === undefined) delete process.env.NEXUS_TRUST_PROXY; else process.env.NEXUS_TRUST_PROXY = previousTrustProxy;
  }
});

test("external origin allows LAN development and rejects public HTTP/host injection", async () => {
  const { externalOrigin } = await import("../lib/api.js");
  const previous = process.env.NEXUS_ORIGIN;
  delete process.env.NEXUS_ORIGIN;
  try {
    assert.equal(externalOrigin({ headers: { host: "192.168.1.153:3000" }, socket: {} }), "http://192.168.1.153:3000");
    assert.throws(() => externalOrigin({ headers: { host: "example.com" }, socket: {} }), /must use https/);
    assert.throws(() => externalOrigin({ headers: { host: "example.com\\@evil.invalid" }, socket: {} }), /invalid request host/);
    process.env.NEXUS_ORIGIN = "https://nexus.example";
    assert.equal(externalOrigin({ headers: {}, socket: {} }), "https://nexus.example");
  } finally {
    if (previous === undefined) delete process.env.NEXUS_ORIGIN;
    else process.env.NEXUS_ORIGIN = previous;
  }
});

test("wallet signup rolls back user and personas if provisioning fails", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const ensurePersona = repo.ensurePersona;
  let calls = 0;
  repo.ensurePersona = (...args) => {
    calls += 1;
    if (calls === 3) throw new Error("synthetic persona provisioning failure");
    return ensurePersona.apply(repo, args);
  };
  const call = async (path, body) => {
    const res = fakeRes();
    await handleRequest(fakeReq("POST", path, "", body), res, { repo, sse, db });
    res.body = res.body ? JSON.parse(res.body) : {};
    res.status = res.statusCode;
    return res;
  };
  await assert.rejects(
    signupWithDeviceWallet(call, "rollback@example.invalid", "test-password-123"),
    /synthetic persona provisioning failure/,
  );
  assert.equal(repo.getUserByEmail("rollback@example.invalid"), null);
  assert.equal(repo.stats().users, 0);
  db.close();
});

test("account centre exposes metadata only and server seed export is retired", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");

  const call = async (method, path, body = {}, cookie = "", fetcher) => {
    const res = fakeRes();
    await handleRequest(fakeReq(method, path, cookie, body), res, { repo, sse, db, fetcher });
    res.body = res.body ? JSON.parse(res.body) : {};
    return res;
  };

  const signupAdapter = (path, body) => call("POST", path, body);
  const signup = await signupWithDeviceWallet(signupAdapter, "system-test-account@example.invalid", "test-password-123");
  assert.equal(signup.statusCode, 201);
  const address = signup.body.wallet.address;
  const login = await call("POST", "/auth/email/login", { email: "system-test-account@example.invalid", password: "test-password-123" });
  const cookie = login.headers["Set-Cookie"] ?? login.headers["set-cookie"];
  assert.ok(cookie);

  const account = await call("GET", "/api/account", {}, cookie);
  assert.equal(account.statusCode, 200);
  assert.equal(account.body.address, address);
  assert.equal(account.body.gas_asset, "EGLD");
  assert.equal(account.body.portfolio_status, "not_refreshed");
  assert.equal(account.body.custody_status, "client_device_wallet_demo_only");
  assert.equal(account.body.funding.crypto_transfer, false);
  assert.equal("mnemonic" in account.body, false);
  assert.equal(JSON.stringify(account.body).includes("keystore"), false);

  const wrong = await call("POST", "/api/security/recovery-export/authorize", { password: "wrong-password" }, cookie);
  assert.equal(wrong.statusCode, 410);
  const directReveal = await call("POST", "/api/security/recovery-export", { password: "test-password-123" }, cookie);
  assert.equal(directReveal.statusCode, 410);
  assert.equal("mnemonic" in directReveal.body, false);

  // A profile text update cannot substitute the wallet address or xAlias.
  const injected = await call("PATCH", "/api/profile", { display_name: "Test", mvx_address: generateWallet().address, mvx_alias: "forged" }, cookie);
  assert.equal(injected.statusCode, 200);
  assert.equal(injected.body.user.mvx_address, address);
  assert.notEqual(injected.body.user.mvx_alias, "forged");
  db.close();
});

test("Nexus Pay resolves an authenticated username to one exact wallet without claiming identity verification", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const aliceWallet = generateWallet();
  const bobWallet = generateWallet();
  const alice = repo.createUser({ handle: "pay_alice", displayName: "Alice", mvxAddress: aliceWallet.address });
  const bob = repo.createUser({ handle: "pay_bob", displayName: "Bob", mvxAddress: bobWallet.address });
  repo.createUser({ handle: "pay_nowallet", displayName: "No Wallet" });
  for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
  const { token, tokenHash, expiresAt } = (await import("../lib/security.js")).issueSession(alice.id, "social");
  repo.insertSession({ tokenHash, userId: alice.id, persona: "social", expiresAt });

  const call = async (path, cookie = `nexus_session=${token}`) => {
    const res = fakeRes();
    await handleRequest(fakeReq("GET", path, cookie, {}), res, { repo, sse, db });
    res.body = res.body ? JSON.parse(res.body) : {};
    return res;
  };

  const resolved = await call("/api/pay/resolve?username=@pay_bob");
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.body.namespace, "nexus");
  assert.equal(resolved.body.recipient.username, "pay_bob");
  assert.equal(resolved.body.recipient.address, bobWallet.address);
  assert.equal(resolved.body.recipient.same_account, false);
  assert.equal(resolved.body.assurance.wallet_address_bound, true);
  assert.equal(resolved.body.assurance.identity_verified, false);
  assert.deepEqual(resolved.body.settlement, { assets: ["EGLD", "ESDT"], prepared: false, signed: false, broadcast: false });
  assert.equal("display_name" in resolved.body.recipient, false);
  assert.equal("email" in resolved.body.recipient, false);

  assert.equal((await call("/api/pay/resolve?username=missing_user")).statusCode, 404);
  assert.equal((await call("/api/pay/resolve?username=pay_nowallet")).statusCode, 409);
  assert.equal((await call("/api/pay/resolve?username=%24bad")).statusCode, 400);
  assert.equal((await call("/api/pay/resolve?username=pay_bob", "")).statusCode, 401);
  db.close();
});

test("portfolio refresh returns only positive MultiversX assets", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { broadcast() {}, publish() {}, subscribe() { return () => {}; } };
  const { handleRequest } = await import("../lib/api.js");
  const wallet = generateWallet();
  const user = repo.createUser({ handle: "system_test_portfolio", displayName: "System Test", passwordHash: hashPassword("test-password-123"), mvxAddress: wallet.address });
  for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
  const { token, tokenHash, expiresAt } = (await import("../lib/security.js")).issueSession(user.id, "social");
  repo.insertSession({ tokenHash, userId: user.id, persona: "social", expiresAt });
  const fetcher = async (url) => ({
    ok: true,
    async json() {
      if (String(url).includes("/tokens?")) return [
        { identifier: "USDC-test", ticker: "USDC", name: "USD Coin", balance: "1234500", decimals: 6, assets: { website: "https://example.invalid" } },
        { identifier: "ZERO-test", ticker: "ZERO", name: "Zero", balance: "0", decimals: 18 },
      ];
      return { balance: "2000000000000000000" };
    },
  });
  const res = fakeRes();
  await handleRequest(fakeReq("GET", "/api/account?refresh=1", `nexus_session=${token}`, {}), res, { repo, sse, db, fetcher });
  const body = JSON.parse(res.body);
  assert.equal(body.portfolio_status, "verified_live");
  assert.deepEqual(body.assets.map((asset) => [asset.symbol, asset.amount]), [["EGLD", "2"], ["USDC", "1.2345"]]);
  db.close();
});
