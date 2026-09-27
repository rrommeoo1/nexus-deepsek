export type MediaAudience = "PRIVATE" | "CONNECTIONS" | "PUBLIC";
export type ViewerRelation = "OWNER" | "CONNECTION" | "OTHER";
export type MediaState = "UPLOAD_AUTHORIZED" | "READY" | "REJECTED" | "PURGING" | "PURGED";
export type PurgeTarget = "ORIGIN" | "RENDITIONS" | "INDEX" | "CACHE";

export interface UploadIntent {
  assetId: string;
  ownerCommitment: string;
  surface: "ADULT_CLIPS" | "ADULT_WATCH";
  audience: MediaAudience;
  territories: readonly string[];
  expectedChecksum: string;
  expectedMime: "video/mp4";
  maxBytes: number;
  authorizationId: string;
  expiresAtMs: number;
}

export interface UploadCompletion {
  completionId: string;
  checksum: string;
  bytes: number;
  mime: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  corrupt: boolean;
  malwareVerdict: "CLEAN" | "MALICIOUS" | "UNKNOWN";
}

export interface ReadyAttestation {
  jobId: string;
  completionId: string;
  manifestHash: string;
  moderation: "APPROVED" | "REJECTED" | "PENDING";
  renditions: readonly { name: "360p" | "720p" | "1080p"; checksum: string }[];
  attestationHash: string;
}

export interface PlaybackGrant {
  assetId: string;
  manifestHash: string;
  viewerCommitment: string;
  territory: string;
  relation: ViewerRelation;
  issuedAtMs: number;
  expiresAtMs: number;
  tokenHash: string;
}

export interface PurgeReceipt {
  assetId: string;
  status: "PURGING" | "PURGED";
  receipts: Readonly<Record<PurgeTarget, string | null>>;
}

export interface UploadAuthorizationVerifier { verifyUploadAuthorization(intent: UploadIntent): boolean; }
export interface WorkerAttestationVerifier { verifyReadyAttestation(assetId: string, completion: UploadCompletion, attestation: ReadyAttestation): boolean; }
export interface PlaybackAuthorizationVerifier { verifyPlaybackContext(ownerCommitment: string, viewerCommitment: string, relation: ViewerRelation, territory: string): boolean; }
export interface PurgeReceiptVerifier { verifyPurgeReceipt(assetId: string, target: PurgeTarget, receiptHash: string): boolean; }
export interface PlaybackTokenSigner { signPlaybackGrant(material: string): string; }

export class MediaPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "MediaPolicyError"; }
}

const HASH = /^[a-f0-9]{64}$/;
const TERRITORY = /^[A-Z]{2}$/;
const MAX_UPLOAD_BYTES = 300_000_000;
const PURGE_TARGETS: readonly PurgeTarget[] = ["ORIGIN", "RENDITIONS", "INDEX", "CACHE"];

function exact(value: object, keys: readonly string[], code: string): void {
  if (Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new MediaPolicyError(code);
}
function requireHash(value: string, code: string): void { if (!HASH.test(value)) throw new MediaPolicyError(code); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
  return JSON.stringify(value);
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

interface MediaAsset {
  intent: UploadIntent;
  state: MediaState;
  completion: UploadCompletion | null;
  ready: ReadyAttestation | null;
  purgeReceipts: Record<PurgeTarget, string | null>;
}

function validateIntent(intent: UploadIntent, nowMs: number): void {
  exact(intent, ["assetId", "ownerCommitment", "surface", "audience", "territories", "expectedChecksum", "expectedMime", "maxBytes", "authorizationId", "expiresAtMs"], "UPLOAD_INTENT_SHAPE_INVALID");
  for (const value of [intent.assetId, intent.ownerCommitment, intent.expectedChecksum, intent.authorizationId]) requireHash(value, "UPLOAD_INTENT_HASH_INVALID");
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(intent.expiresAtMs) || intent.expiresAtMs <= nowMs) throw new MediaPolicyError("UPLOAD_AUTHORIZATION_EXPIRED");
  if (intent.surface !== "ADULT_CLIPS" && intent.surface !== "ADULT_WATCH") throw new MediaPolicyError("UPLOAD_SURFACE_DENIED");
  if (!(intent.audience === "PRIVATE" || intent.audience === "CONNECTIONS" || intent.audience === "PUBLIC")) throw new MediaPolicyError("UPLOAD_AUDIENCE_INVALID");
  if (intent.expectedMime !== "video/mp4" || !Number.isSafeInteger(intent.maxBytes) || intent.maxBytes < 1 || intent.maxBytes > MAX_UPLOAD_BYTES) throw new MediaPolicyError("UPLOAD_LIMIT_INVALID");
  if (!Array.isArray(intent.territories) || intent.territories.length < 1 || intent.territories.length > 249 || new Set(intent.territories).size !== intent.territories.length || intent.territories.some((item) => !TERRITORY.test(item))) throw new MediaPolicyError("UPLOAD_TERRITORY_INVALID");
}

function validateCompletion(completion: UploadCompletion): void {
  exact(completion, ["completionId", "checksum", "bytes", "mime", "container", "videoCodec", "audioCodec", "corrupt", "malwareVerdict"], "UPLOAD_COMPLETION_SHAPE_INVALID");
  requireHash(completion.completionId, "UPLOAD_COMPLETION_HASH_INVALID"); requireHash(completion.checksum, "UPLOAD_COMPLETION_HASH_INVALID");
  if (!Number.isSafeInteger(completion.bytes) || completion.bytes < 1) throw new MediaPolicyError("UPLOAD_BYTES_INVALID");
  if (typeof completion.corrupt !== "boolean" || !(completion.malwareVerdict === "CLEAN" || completion.malwareVerdict === "MALICIOUS" || completion.malwareVerdict === "UNKNOWN")) throw new MediaPolicyError("UPLOAD_SCAN_RESULT_INVALID");
}

export class MediaPipeline {
  private readonly assets = new Map<string, MediaAsset>();
  constructor(
    private readonly authorizationVerifier: UploadAuthorizationVerifier,
    private readonly attestationVerifier: WorkerAttestationVerifier,
    private readonly playbackAuthorizationVerifier: PlaybackAuthorizationVerifier,
    private readonly purgeReceiptVerifier: PurgeReceiptVerifier,
    private readonly tokenSigner: PlaybackTokenSigner,
  ) {}

  authorizeUpload(intent: UploadIntent, nowMs: number): "AUTHORIZED" | "DUPLICATE" {
    validateIntent(intent, nowMs); if (!this.authorizationVerifier.verifyUploadAuthorization(intent)) throw new MediaPolicyError("UPLOAD_AUTHORIZATION_INVALID");
    const prior = this.assets.get(intent.assetId);
    if (prior) { if (canonical(prior.intent) === canonical(intent)) return "DUPLICATE"; throw new MediaPolicyError("ASSET_ID_CONFLICT"); }
    this.assets.set(intent.assetId, { intent: clone(intent), state: "UPLOAD_AUTHORIZED", completion: null, ready: null, purgeReceipts: { ORIGIN: null, RENDITIONS: null, INDEX: null, CACHE: null } }); return "AUTHORIZED";
  }

  completeUpload(assetId: string, completion: UploadCompletion): "ACCEPTED" | "DUPLICATE" {
    requireHash(assetId, "ASSET_ID_INVALID"); validateCompletion(completion); const asset = this.requireAsset(assetId);
    if (asset.state === "REJECTED") throw new MediaPolicyError("ASSET_REJECTED");
    if (asset.state !== "UPLOAD_AUTHORIZED") throw new MediaPolicyError("UPLOAD_STATE_INVALID");
    if (asset.completion) { if (canonical(asset.completion) === canonical(completion)) return "DUPLICATE"; throw new MediaPolicyError("COMPLETION_ID_CONFLICT"); }
    if (completion.checksum !== asset.intent.expectedChecksum || completion.bytes > asset.intent.maxBytes || completion.mime !== asset.intent.expectedMime || completion.corrupt || completion.malwareVerdict !== "CLEAN" || completion.container !== "mp4" || completion.videoCodec !== "h264" || completion.audioCodec !== "aac") {
      asset.state = "REJECTED"; throw new MediaPolicyError("UPLOAD_CONTENT_REJECTED");
    }
    asset.completion = clone(completion); return "ACCEPTED";
  }

  promoteReady(assetId: string, attestation: ReadyAttestation): "READY" | "DUPLICATE" {
    const asset = this.requireAsset(assetId);
    exact(attestation, ["jobId", "completionId", "manifestHash", "moderation", "renditions", "attestationHash"], "READY_ATTESTATION_SHAPE_INVALID");
    for (const value of [attestation.jobId, attestation.completionId, attestation.manifestHash, attestation.attestationHash]) requireHash(value, "READY_ATTESTATION_HASH_INVALID");
    if (asset.ready) { if (canonical(asset.ready) === canonical(attestation)) return "DUPLICATE"; throw new MediaPolicyError("TRANSCODE_JOB_CONFLICT"); }
    if (!asset.completion || asset.state !== "UPLOAD_AUTHORIZED") throw new MediaPolicyError("READY_STATE_INVALID");
    if (attestation.completionId !== asset.completion.completionId || attestation.moderation !== "APPROVED" || attestation.renditions.length < 1 || new Set(attestation.renditions.map((item) => item.name)).size !== attestation.renditions.length) throw new MediaPolicyError("READY_ATTESTATION_DENIED");
    for (const rendition of attestation.renditions) { exact(rendition, ["name", "checksum"], "RENDITION_SHAPE_INVALID"); requireHash(rendition.checksum, "RENDITION_HASH_INVALID"); if (!(rendition.name === "360p" || rendition.name === "720p" || rendition.name === "1080p")) throw new MediaPolicyError("RENDITION_NAME_INVALID"); }
    if (!this.attestationVerifier.verifyReadyAttestation(assetId, asset.completion, attestation)) throw new MediaPolicyError("READY_ATTESTATION_INVALID");
    asset.ready = clone(attestation); asset.state = "READY"; return "READY";
  }

  grantPlayback(assetId: string, viewerCommitment: string, relation: ViewerRelation, territory: string, nowMs: number, ttlSeconds: number): PlaybackGrant {
    const asset = this.requireAsset(assetId); if (asset.state !== "READY" || !asset.ready) throw new MediaPolicyError("PLAYBACK_NOT_READY");
    requireHash(viewerCommitment, "PLAYBACK_VIEWER_INVALID");
    if (!(relation === "OWNER" || relation === "CONNECTION" || relation === "OTHER") || !TERRITORY.test(territory)) throw new MediaPolicyError("PLAYBACK_CONTEXT_INVALID");
    if (!this.playbackAuthorizationVerifier.verifyPlaybackContext(asset.intent.ownerCommitment, viewerCommitment, relation, territory)) throw new MediaPolicyError("PLAYBACK_CONTEXT_UNVERIFIED");
    const audienceAllowed = asset.intent.audience === "PUBLIC" || (asset.intent.audience === "CONNECTIONS" && (relation === "OWNER" || relation === "CONNECTION")) || (asset.intent.audience === "PRIVATE" && relation === "OWNER");
    if (!audienceAllowed) throw new MediaPolicyError("PLAYBACK_AUDIENCE_DENIED");
    if (!asset.intent.territories.includes(territory)) throw new MediaPolicyError("PLAYBACK_TERRITORY_DENIED");
    if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) throw new MediaPolicyError("PLAYBACK_TTL_INVALID");
    const unsigned = { assetId, manifestHash: asset.ready.manifestHash, viewerCommitment, territory, relation, issuedAtMs: nowMs, expiresAtMs: nowMs + ttlSeconds * 1_000 };
    const tokenHash = this.tokenSigner.signPlaybackGrant(canonical(unsigned)); requireHash(tokenHash, "PLAYBACK_TOKEN_INVALID"); return { ...unsigned, tokenHash };
  }

  requestPurge(assetId: string): PurgeReceipt {
    const asset = this.requireAsset(assetId); if (asset.state === "PURGED" || asset.state === "PURGING") return this.purgeReceipt(assetId, asset);
    asset.state = "PURGING"; return this.purgeReceipt(assetId, asset);
  }

  recordPurge(assetId: string, target: PurgeTarget, receiptHash: string): PurgeReceipt {
    const asset = this.requireAsset(assetId); if (asset.state !== "PURGING" && asset.state !== "PURGED") throw new MediaPolicyError("PURGE_NOT_REQUESTED");
    if (!PURGE_TARGETS.includes(target)) throw new MediaPolicyError("PURGE_TARGET_INVALID"); requireHash(receiptHash, "PURGE_RECEIPT_INVALID");
    if (!this.purgeReceiptVerifier.verifyPurgeReceipt(assetId, target, receiptHash)) throw new MediaPolicyError("PURGE_RECEIPT_UNVERIFIED");
    const prior = asset.purgeReceipts[target]; if (prior && prior !== receiptHash) throw new MediaPolicyError("PURGE_RECEIPT_CONFLICT"); asset.purgeReceipts[target] = receiptHash;
    if (PURGE_TARGETS.every((item) => asset.purgeReceipts[item] !== null)) asset.state = "PURGED"; return this.purgeReceipt(assetId, asset);
  }

  getState(assetId: string): MediaState { return this.requireAsset(assetId).state; }
  private requireAsset(assetId: string): MediaAsset { const asset = this.assets.get(assetId); if (!asset) throw new MediaPolicyError("ASSET_NOT_FOUND"); return asset; }
  private purgeReceipt(assetId: string, asset: MediaAsset): PurgeReceipt { return { assetId, status: asset.state === "PURGED" ? "PURGED" : "PURGING", receipts: { ...asset.purgeReceipts } }; }
}
