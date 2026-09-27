import {
  MediaPipeline, MediaPolicyError, type PlaybackTokenSigner, type ReadyAttestation,
  type PlaybackAuthorizationVerifier, type PurgeReceiptVerifier, type UploadAuthorizationVerifier,
  type UploadCompletion, type UploadIntent, type ViewerRelation, type WorkerAttestationVerifier,
} from "./index";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void {
  let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof MediaPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}
const hex = (value: number): string => value.toString(16).padStart(64, "0");
const nowMs = 3_000_000;

class FixtureAuthorization implements UploadAuthorizationVerifier {
  private readonly allowed = new Map<string, string>();
  register(intent: UploadIntent): UploadIntent { this.allowed.set(intent.authorizationId, JSON.stringify(intent)); return intent; }
  verifyUploadAuthorization(intent: UploadIntent): boolean { return this.allowed.get(intent.authorizationId) === JSON.stringify(intent); }
}
class FixtureAttestation implements WorkerAttestationVerifier {
  private readonly allowed = new Map<string, string>();
  register(assetId: string, completion: UploadCompletion, value: ReadyAttestation): ReadyAttestation { this.allowed.set(value.attestationHash, JSON.stringify({ assetId, completion, value })); return value; }
  verifyReadyAttestation(assetId: string, completion: UploadCompletion, value: ReadyAttestation): boolean { return this.allowed.get(value.attestationHash) === JSON.stringify({ assetId, completion, value }); }
}
class FixturePlaybackAuthorization implements PlaybackAuthorizationVerifier {
  private readonly allowed = new Set<string>();
  register(owner: string, viewer: string, relation: ViewerRelation, territory: string): void { this.allowed.add(`${owner}:${viewer}:${relation}:${territory}`); }
  verifyPlaybackContext(owner: string, viewer: string, relation: ViewerRelation, territory: string): boolean { return this.allowed.has(`${owner}:${viewer}:${relation}:${territory}`); }
}
class FixturePurgeVerification implements PurgeReceiptVerifier {
  private readonly allowed = new Set<string>();
  register(assetId: string, target: string, receiptHash: string): void { this.allowed.add(`${assetId}:${target}:${receiptHash}`); }
  verifyPurgeReceipt(assetId: string, target: string, receiptHash: string): boolean { return this.allowed.has(`${assetId}:${target}:${receiptHash}`); }
}
const signer: PlaybackTokenSigner = { signPlaybackGrant(material: string): string { return hex(900_000 + material.length); } };
const authorization = new FixtureAuthorization(); const worker = new FixtureAttestation(); const playbackAuthorization = new FixturePlaybackAuthorization(); const purgeVerification = new FixturePurgeVerification();
const pipeline = new MediaPipeline(authorization, worker, playbackAuthorization, purgeVerification, signer);
const ownerViewer = hex(700_001); const connectionViewer = hex(700_002); const otherViewer = hex(700_003);

function intent(seed: number, overrides: Partial<UploadIntent> = {}): UploadIntent {
  return authorization.register({ assetId: hex(10_000 + seed), ownerCommitment: hex(20_000 + seed), surface: "ADULT_CLIPS", audience: "PRIVATE", territories: ["RO", "US"], expectedChecksum: hex(30_000 + seed), expectedMime: "video/mp4", maxBytes: 10_000_000, authorizationId: hex(40_000 + seed), expiresAtMs: nowMs + 60_000, ...overrides });
}
function completion(seed: number, upload: UploadIntent, overrides: Partial<UploadCompletion> = {}): UploadCompletion {
  return { completionId: hex(50_000 + seed), checksum: upload.expectedChecksum, bytes: 1_000_000, mime: "video/mp4", container: "mp4", videoCodec: "h264", audioCodec: "aac", corrupt: false, malwareVerdict: "CLEAN", ...overrides };
}
function ready(seed: number, upload: UploadIntent, completed: UploadCompletion, overrides: Partial<ReadyAttestation> = {}): ReadyAttestation {
  const value: ReadyAttestation = { jobId: hex(60_000 + seed), completionId: completed.completionId, manifestHash: hex(70_000 + seed), moderation: "APPROVED", renditions: [{ name: "360p", checksum: hex(80_000 + seed) }, { name: "720p", checksum: hex(90_000 + seed) }], attestationHash: hex(100_000 + seed), ...overrides };
  return worker.register(upload.assetId, completed, value);
}

function prepare(seed: number, overrides: Partial<UploadIntent> = {}): { upload: UploadIntent; completed: UploadCompletion; attested: ReadyAttestation } {
  const upload = intent(seed, overrides); const completed = completion(seed, upload); const attested = ready(seed, upload, completed); return { upload, completed, attested };
}

function main(): void {
  const happy = prepare(1);
  assert(pipeline.authorizeUpload(happy.upload, nowMs) === "AUTHORIZED", "signed upload authorization is accepted");
  assert(pipeline.authorizeUpload(happy.upload, nowMs) === "DUPLICATE", "duplicate authorization is idempotent");
  const conflictingIntent = intent(101, { assetId: happy.upload.assetId, audience: "PUBLIC" });
  expectCode(() => pipeline.authorizeUpload(conflictingIntent, nowMs), "ASSET_ID_CONFLICT");
  assert(pipeline.completeUpload(happy.upload.assetId, happy.completed) === "ACCEPTED", "clean supported upload is accepted");
  assert(pipeline.completeUpload(happy.upload.assetId, happy.completed) === "DUPLICATE", "duplicate completion is idempotent");
  expectCode(() => pipeline.completeUpload(happy.upload.assetId, { ...happy.completed, bytes: happy.completed.bytes + 1 }), "COMPLETION_ID_CONFLICT");
  assert(pipeline.promoteReady(happy.upload.assetId, happy.attested) === "READY", "approved worker attestation promotes asset");
  assert(pipeline.promoteReady(happy.upload.assetId, happy.attested) === "DUPLICATE", "duplicate transcode job is idempotent");
  expectCode(() => pipeline.promoteReady(happy.upload.assetId, { ...happy.attested, manifestHash: "d".repeat(64) }), "TRANSCODE_JOB_CONFLICT");

  playbackAuthorization.register(happy.upload.ownerCommitment, ownerViewer, "OWNER", "RO");
  playbackAuthorization.register(happy.upload.ownerCommitment, connectionViewer, "CONNECTION", "RO");
  playbackAuthorization.register(happy.upload.ownerCommitment, ownerViewer, "OWNER", "DE");
  const ownerGrant = pipeline.grantPlayback(happy.upload.assetId, ownerViewer, "OWNER", "RO", nowMs, 120);
  assert(ownerGrant.tokenHash.length === 64 && ownerGrant.expiresAtMs === nowMs + 120_000, "short playback grant is asset and expiry bound");
  expectCode(() => pipeline.grantPlayback(happy.upload.assetId, connectionViewer, "CONNECTION", "RO", nowMs, 120), "PLAYBACK_AUDIENCE_DENIED");
  expectCode(() => pipeline.grantPlayback(happy.upload.assetId, ownerViewer, "OWNER", "DE", nowMs, 120), "PLAYBACK_TERRITORY_DENIED");
  expectCode(() => pipeline.grantPlayback(happy.upload.assetId, otherViewer, "OTHER", "RO", nowMs, 120), "PLAYBACK_CONTEXT_UNVERIFIED");
  expectCode(() => pipeline.grantPlayback(happy.upload.assetId, ownerViewer, "OWNER", "RO", nowMs, 301), "PLAYBACK_TTL_INVALID");

  const forged = prepare(2); assert(pipeline.authorizeUpload(forged.upload, nowMs) === "AUTHORIZED", "forged fixture upload authorizes"); assert(pipeline.completeUpload(forged.upload.assetId, forged.completed) === "ACCEPTED", "forged fixture completion accepts");
  expectCode(() => pipeline.promoteReady(forged.upload.assetId, { ...forged.attested, manifestHash: "f".repeat(64) }), "READY_ATTESTATION_INVALID");
  expectCode(() => pipeline.recordPurge(forged.upload.assetId, "ORIGIN", hex(201_001)), "PURGE_NOT_REQUESTED");

  const unauthorized = { ...intent(3), authorizationId: hex(999_001) }; expectCode(() => pipeline.authorizeUpload(unauthorized, nowMs), "UPLOAD_AUTHORIZATION_INVALID");
  const expired = intent(4, { expiresAtMs: nowMs }); expectCode(() => pipeline.authorizeUpload(expired, nowMs), "UPLOAD_AUTHORIZATION_EXPIRED");
  const kids = intent(5, { surface: "KIDS" as never }); expectCode(() => pipeline.authorizeUpload(kids, nowMs), "UPLOAD_SURFACE_DENIED");

  const corrupt = prepare(6); assert(pipeline.authorizeUpload(corrupt.upload, nowMs) === "AUTHORIZED", "corrupt fixture authorizes"); expectCode(() => pipeline.completeUpload(corrupt.upload.assetId, { ...corrupt.completed, corrupt: true }), "UPLOAD_CONTENT_REJECTED"); assert(pipeline.getState(corrupt.upload.assetId) === "REJECTED", "corrupt upload fails closed");
  const malware = prepare(7); assert(pipeline.authorizeUpload(malware.upload, nowMs) === "AUTHORIZED", "malware fixture authorizes"); expectCode(() => pipeline.completeUpload(malware.upload.assetId, { ...malware.completed, malwareVerdict: "MALICIOUS" }), "UPLOAD_CONTENT_REJECTED");
  const unknownScan = prepare(8); assert(pipeline.authorizeUpload(unknownScan.upload, nowMs) === "AUTHORIZED", "unknown scan fixture authorizes"); expectCode(() => pipeline.completeUpload(unknownScan.upload.assetId, { ...unknownScan.completed, malwareVerdict: "UNKNOWN" }), "UPLOAD_CONTENT_REJECTED");
  const unsupported = prepare(9); assert(pipeline.authorizeUpload(unsupported.upload, nowMs) === "AUTHORIZED", "unsupported fixture authorizes"); expectCode(() => pipeline.completeUpload(unsupported.upload.assetId, { ...unsupported.completed, videoCodec: "av1" }), "UPLOAD_CONTENT_REJECTED");
  const checksum = prepare(10); assert(pipeline.authorizeUpload(checksum.upload, nowMs) === "AUTHORIZED", "checksum fixture authorizes"); expectCode(() => pipeline.completeUpload(checksum.upload.assetId, { ...checksum.completed, checksum: "e".repeat(64) }), "UPLOAD_CONTENT_REJECTED");

  const publicAsset = prepare(11, { audience: "PUBLIC", territories: ["US"] }); assert(pipeline.authorizeUpload(publicAsset.upload, nowMs) === "AUTHORIZED", "public upload authorizes"); assert(pipeline.completeUpload(publicAsset.upload.assetId, publicAsset.completed) === "ACCEPTED", "public upload completes"); assert(pipeline.promoteReady(publicAsset.upload.assetId, publicAsset.attested) === "READY", "public asset ready"); playbackAuthorization.register(publicAsset.upload.ownerCommitment, otherViewer, "OTHER", "US"); assert(pipeline.grantPlayback(publicAsset.upload.assetId, otherViewer, "OTHER", "US", nowMs, 60).territory === "US", "public audience grant succeeds in allowed territory");

  let purge = pipeline.requestPurge(happy.upload.assetId); assert(purge.status === "PURGING", "purge starts fail-closed lifecycle");
  assert(pipeline.requestPurge(happy.upload.assetId).status === "PURGING", "duplicate purge request is idempotent");
  expectCode(() => pipeline.recordPurge(happy.upload.assetId, "ORIGIN", hex(299_997)), "PURGE_RECEIPT_UNVERIFIED");
  for (const [index, target] of (["ORIGIN", "RENDITIONS", "INDEX", "CACHE"] as const).entries()) { purgeVerification.register(happy.upload.assetId, target, hex(200_000 + index)); purge = pipeline.recordPurge(happy.upload.assetId, target, hex(200_000 + index)); }
  assert(purge.status === "PURGED" && Object.values(purge.receipts).every((value) => value !== null), "purge receipt covers origin renditions index and cache");
  assert(pipeline.recordPurge(happy.upload.assetId, "CACHE", hex(200_003)).status === "PURGED", "purge retry is idempotent");
  purgeVerification.register(happy.upload.assetId, "CACHE", hex(299_999)); expectCode(() => pipeline.recordPurge(happy.upload.assetId, "CACHE", hex(299_999)), "PURGE_RECEIPT_CONFLICT");
  expectCode(() => pipeline.recordPurge(happy.upload.assetId, "ORIGIN", hex(299_998)), "PURGE_RECEIPT_UNVERIFIED");
  expectCode(() => pipeline.grantPlayback(happy.upload.assetId, ownerViewer, "OWNER", "RO", nowMs, 60), "PLAYBACK_NOT_READY");

  console.log(JSON.stringify({ schema_version: 1, task_id: "NX-MEDIA-001", status: "PASS", assertions, upload_policy: { corrupt: "DENY", malware: "DENY", unknown_scan: "DENY", unsupported_codec: "DENY", checksum_mismatch: "DENY", kids_surface: "DENY" }, playback_policy: { audience_bound: true, territory_bound: true, maximum_ttl_seconds: 300 }, idempotency: { authorization: true, completion: true, transcode: true, purge: true }, purge: { origin: true, renditions: true, index: true, cache: true, terminal: "PURGED" }, synthetic_only: true, network_operations: 0, economic_operations: 0 }));
}

main();
