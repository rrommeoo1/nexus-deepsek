export type ClipState = "ACTIVE" | "PURGED";
export type ClipAudience = "PUBLIC" | "CONNECTIONS";
export type PromotionLabel = "NONE" | "PAID_PROMOTION";

export class SocialPolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SocialPolicyError"; }
}

const HASH = /^[a-f0-9]{64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function fail(code: string): never { throw new SocialPolicyError(code); }
function text(value: unknown, pattern: RegExp, code: string): string { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }
function integer(value: unknown, min: number, max: number, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code); return value as number; }
function iso(value: unknown, code: string): string { if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value))) fail(code); return value; }
function bool(value: unknown, code: string): boolean { if (typeof value !== "boolean") fail(code); return value; }
function exact<T extends string>(value: unknown, options: readonly T[], code: string): T { if (typeof value !== "string" || !options.includes(value as T)) fail(code); return value as T; }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> { let own: PropertyKey[], descriptors: Record<PropertyKey, PropertyDescriptor>, prototype: object | null; try { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code); own = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); prototype = Object.getPrototypeOf(value); } catch { fail(code); } if (prototype !== Object.prototype && prototype !== null || own.some((key) => typeof key !== "string") || own.length !== keys.length || keys.some((key) => !own.includes(key))) fail(code); for (const key of keys) { const descriptor = descriptors[key]; if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) fail(code); } return value as Record<string, unknown>; }
function frozen<T extends object>(value: T): Readonly<T> { for (const child of Object.values(value)) if (child && typeof child === "object") frozen(child); return Object.freeze(value); }

export interface ClipPublishCommand {
  schemaVersion: 1;
  clipCommitment: string;
  assetId: string;
  manifestHash: string;
  creatorProfileCommitment: string;
  profileGeneration: number;
  durationSeconds: number;
  audience: ClipAudience;
  contentRating: "ADULT_GENERAL";
  syntheticLabel: "SYSTEM_TEST";
  promotionLabel: PromotionLabel;
  publishedAt: string;
  signature: string;
}

export interface ClipEligibilityDecision {
  schemaVersion: 1;
  decisionId: string;
  clipCommitment: string;
  assetId: string;
  manifestHash: string;
  creatorProfileCommitment: string;
  profileGeneration: number;
  audience: ClipAudience;
  moderation: "APPROVED" | "REJECTED" | "PENDING";
  rightsState: "CLEARED" | "BLOCKED" | "PENDING";
  ageEligible: boolean;
  audienceAllowed: boolean;
  promotionDeclared: boolean;
  evaluatedAt: string;
  expiresAt: string;
  issuerKeyId: string;
  signature: string;
}

export interface ClipPurgeCommand {
  schemaVersion: 1;
  purgeId: string;
  clipCommitment: string;
  assetId: string;
  reasonCode: "OWNER_DELETE" | "MODERATION_REMOVE" | "RIGHTS_REMOVE";
  occurredAt: string;
  issuerKeyId: string;
  signature: string;
}

export interface ClipEngagementDecision {
  schemaVersion: 1;
  decisionId: string;
  action: "LIKE";
  clipCommitment: string;
  actorProfileCommitment: string;
  actorProfileGeneration: number;
  blocked: boolean;
  audienceAllowed: boolean;
  deviceActive: boolean;
  evaluatedAt: string;
  expiresAt: string;
  issuerKeyId: string;
  signature: string;
}

export interface LikeExecutionAuthorization {
  schemaVersion: 1;
  authorizationId: string;
  decisionId: string;
  action: "LIKE";
  clipCommitment: string;
  actorProfileCommitment: string;
  actorProfileGeneration: number;
  sessionPublicKey: string;
  capabilityId: string;
  actionNonce: string;
  payloadCommitment: string;
  chainId: string;
  contractAddress: string;
  clipStateVersion: number;
  mediaGeneration: number;
  policyVersion: number;
  evaluatedAt: string;
  expiresAt: string;
  issuerKeyId: string;
  signature: string;
}

export interface LikeActionEnvelope { version: 1; actorKind: "HUMAN" | "AGENT"; actorCommitment: string; actionType: "LIKE"; objectCommitment: string; payloadHashOrCid: string; visibilityClass: "PUBLIC" | "CONNECTIONS"; actionNonce: bigint; issuedAtMs: number; expiresAtMs: number; sessionPublicKey: string }
export interface LikeExecutionContext { chainId: string; contractAddress: string; relayer: string; relayerAgreementVerified: boolean; nowMs: number; payments: readonly unknown[] }
export interface PreparedLikeAction { readonly envelope: LikeActionEnvelope; readonly context: LikeExecutionContext; readonly opaque: unknown }
export interface LikeRecordedEvent { identifier: "ActionRecorded"; actorCommitment: string; objectCommitment: string; actionNonce: string; actionClass: "PUBLIC_ACTION" | "PRIVATE_ACTION" }
export interface LikeActionRecorder { prepareAction(envelope: LikeActionEnvelope, signatureHex: string, context: LikeExecutionContext): Promise<PreparedLikeAction>; commitPreparedAction(prepared: PreparedLikeAction): LikeRecordedEvent; abortPreparedAction(prepared: PreparedLikeAction): void }

export interface ClipProjection {
  schemaVersion: 1;
  clipCommitment: string;
  assetId: string;
  manifestHash: string;
  creatorProfileCommitment: string;
  profileGeneration: number;
  durationSeconds: number;
  audience: ClipAudience;
  contentRating: "ADULT_GENERAL";
  syntheticLabel: "SYSTEM_TEST";
  promotionLabel: PromotionLabel;
  organicMetricEligible: false;
  kidsEligible: false;
  stateVersion: number;
  state: ClipState;
  publishedAt: string;
  updatedAt: string;
}

export interface SignedVerifier<T> { verify(value: Readonly<T>): boolean }
export interface ClipMediaBoundary { isReady(assetId: string, manifestHash: string): boolean; isPurged(assetId: string): boolean; currentGeneration(assetId: string): number }
export interface ClipProfileBoundary { isActiveProfile(profileCommitment: string, generation: number): boolean }
export interface ClipEngagementPolicyBoundary { current(actorProfileCommitment: string, clipCommitment: string): Readonly<{ version: number; blocked: boolean; audienceAllowed: boolean; deviceActive: boolean }> }

const PUBLISH_KEYS = ["schemaVersion", "clipCommitment", "assetId", "manifestHash", "creatorProfileCommitment", "profileGeneration", "durationSeconds", "audience", "contentRating", "syntheticLabel", "promotionLabel", "publishedAt", "signature"] as const;
const ELIGIBILITY_KEYS = ["schemaVersion", "decisionId", "clipCommitment", "assetId", "manifestHash", "creatorProfileCommitment", "profileGeneration", "audience", "moderation", "rightsState", "ageEligible", "audienceAllowed", "promotionDeclared", "evaluatedAt", "expiresAt", "issuerKeyId", "signature"] as const;
const PURGE_KEYS = ["schemaVersion", "purgeId", "clipCommitment", "assetId", "reasonCode", "occurredAt", "issuerKeyId", "signature"] as const;
const ENGAGEMENT_KEYS = ["schemaVersion", "decisionId", "action", "clipCommitment", "actorProfileCommitment", "actorProfileGeneration", "blocked", "audienceAllowed", "deviceActive", "evaluatedAt", "expiresAt", "issuerKeyId", "signature"] as const;
const EXECUTION_KEYS = ["schemaVersion", "authorizationId", "decisionId", "action", "clipCommitment", "actorProfileCommitment", "actorProfileGeneration", "sessionPublicKey", "capabilityId", "actionNonce", "payloadCommitment", "chainId", "contractAddress", "clipStateVersion", "mediaGeneration", "policyVersion", "evaluatedAt", "expiresAt", "issuerKeyId", "signature"] as const;
const LIKE_ENVELOPE_KEYS = ["version", "actorKind", "actorCommitment", "actionType", "objectCommitment", "payloadHashOrCid", "visibilityClass", "actionNonce", "issuedAtMs", "expiresAtMs", "sessionPublicKey"] as const;
const LIKE_CONTEXT_KEYS = ["chainId", "contractAddress", "relayer", "relayerAgreementVerified", "nowMs", "payments"] as const;

function parsePublish(value: unknown): ClipPublishCommand { const o = plain(value, PUBLISH_KEYS, "CLIP_PUBLISH_INVALID"); if (o.schemaVersion !== 1 || o.contentRating !== "ADULT_GENERAL" || o.syntheticLabel !== "SYSTEM_TEST") fail("CLIP_PUBLISH_INVALID"); return { schemaVersion: 1, clipCommitment: text(o.clipCommitment, HASH, "CLIP_PUBLISH_INVALID"), assetId: text(o.assetId, HASH, "CLIP_PUBLISH_INVALID"), manifestHash: text(o.manifestHash, HASH, "CLIP_PUBLISH_INVALID"), creatorProfileCommitment: text(o.creatorProfileCommitment, HASH, "CLIP_PUBLISH_INVALID"), profileGeneration: integer(o.profileGeneration, 1, Number.MAX_SAFE_INTEGER, "CLIP_PUBLISH_INVALID"), durationSeconds: integer(o.durationSeconds, 3, 180, "CLIP_DURATION_DENIED"), audience: exact(o.audience, ["PUBLIC", "CONNECTIONS"], "CLIP_PUBLISH_INVALID"), contentRating: "ADULT_GENERAL", syntheticLabel: "SYSTEM_TEST", promotionLabel: exact(o.promotionLabel, ["NONE", "PAID_PROMOTION"], "CLIP_PUBLISH_INVALID"), publishedAt: iso(o.publishedAt, "CLIP_PUBLISH_INVALID"), signature: text(o.signature, SIGNATURE, "CLIP_PUBLISH_INVALID") }; }
function parseEligibility(value: unknown): ClipEligibilityDecision { const o = plain(value, ELIGIBILITY_KEYS, "CLIP_ELIGIBILITY_INVALID"); if (o.schemaVersion !== 1) fail("CLIP_ELIGIBILITY_INVALID"); const result: ClipEligibilityDecision = { schemaVersion: 1, decisionId: text(o.decisionId, ID, "CLIP_ELIGIBILITY_INVALID"), clipCommitment: text(o.clipCommitment, HASH, "CLIP_ELIGIBILITY_INVALID"), assetId: text(o.assetId, HASH, "CLIP_ELIGIBILITY_INVALID"), manifestHash: text(o.manifestHash, HASH, "CLIP_ELIGIBILITY_INVALID"), creatorProfileCommitment: text(o.creatorProfileCommitment, HASH, "CLIP_ELIGIBILITY_INVALID"), profileGeneration: integer(o.profileGeneration, 1, Number.MAX_SAFE_INTEGER, "CLIP_ELIGIBILITY_INVALID"), audience: exact(o.audience, ["PUBLIC", "CONNECTIONS"], "CLIP_ELIGIBILITY_INVALID"), moderation: exact(o.moderation, ["APPROVED", "REJECTED", "PENDING"], "CLIP_ELIGIBILITY_INVALID"), rightsState: exact(o.rightsState, ["CLEARED", "BLOCKED", "PENDING"], "CLIP_ELIGIBILITY_INVALID"), ageEligible: bool(o.ageEligible, "CLIP_ELIGIBILITY_INVALID"), audienceAllowed: bool(o.audienceAllowed, "CLIP_ELIGIBILITY_INVALID"), promotionDeclared: bool(o.promotionDeclared, "CLIP_ELIGIBILITY_INVALID"), evaluatedAt: iso(o.evaluatedAt, "CLIP_ELIGIBILITY_INVALID"), expiresAt: iso(o.expiresAt, "CLIP_ELIGIBILITY_INVALID"), issuerKeyId: text(o.issuerKeyId, ID, "CLIP_ELIGIBILITY_INVALID"), signature: text(o.signature, SIGNATURE, "CLIP_ELIGIBILITY_INVALID") }; if (Date.parse(result.evaluatedAt) >= Date.parse(result.expiresAt)) fail("CLIP_ELIGIBILITY_INVALID"); return result; }
function parsePurge(value: unknown): ClipPurgeCommand { const o = plain(value, PURGE_KEYS, "CLIP_PURGE_INVALID"); if (o.schemaVersion !== 1) fail("CLIP_PURGE_INVALID"); return { schemaVersion: 1, purgeId: text(o.purgeId, ID, "CLIP_PURGE_INVALID"), clipCommitment: text(o.clipCommitment, HASH, "CLIP_PURGE_INVALID"), assetId: text(o.assetId, HASH, "CLIP_PURGE_INVALID"), reasonCode: exact(o.reasonCode, ["OWNER_DELETE", "MODERATION_REMOVE", "RIGHTS_REMOVE"], "CLIP_PURGE_INVALID"), occurredAt: iso(o.occurredAt, "CLIP_PURGE_INVALID"), issuerKeyId: text(o.issuerKeyId, ID, "CLIP_PURGE_INVALID"), signature: text(o.signature, SIGNATURE, "CLIP_PURGE_INVALID") }; }
function parseEngagement(value: unknown): ClipEngagementDecision { const o = plain(value, ENGAGEMENT_KEYS, "ENGAGEMENT_DECISION_INVALID"); if (o.schemaVersion !== 1 || o.action !== "LIKE") fail("ENGAGEMENT_DECISION_INVALID"); const result: ClipEngagementDecision = { schemaVersion: 1, decisionId: text(o.decisionId, ID, "ENGAGEMENT_DECISION_INVALID"), action: "LIKE", clipCommitment: text(o.clipCommitment, HASH, "ENGAGEMENT_DECISION_INVALID"), actorProfileCommitment: text(o.actorProfileCommitment, HASH, "ENGAGEMENT_DECISION_INVALID"), actorProfileGeneration: integer(o.actorProfileGeneration, 1, Number.MAX_SAFE_INTEGER, "ENGAGEMENT_DECISION_INVALID"), blocked: bool(o.blocked, "ENGAGEMENT_DECISION_INVALID"), audienceAllowed: bool(o.audienceAllowed, "ENGAGEMENT_DECISION_INVALID"), deviceActive: bool(o.deviceActive, "ENGAGEMENT_DECISION_INVALID"), evaluatedAt: iso(o.evaluatedAt, "ENGAGEMENT_DECISION_INVALID"), expiresAt: iso(o.expiresAt, "ENGAGEMENT_DECISION_INVALID"), issuerKeyId: text(o.issuerKeyId, ID, "ENGAGEMENT_DECISION_INVALID"), signature: text(o.signature, SIGNATURE, "ENGAGEMENT_DECISION_INVALID") }; if (Date.parse(result.evaluatedAt) >= Date.parse(result.expiresAt)) fail("ENGAGEMENT_DECISION_INVALID"); return result; }
function parseExecution(value: unknown): LikeExecutionAuthorization { const o = plain(value, EXECUTION_KEYS, "LIKE_AUTHORIZATION_INVALID"); if (o.schemaVersion !== 1 || o.action !== "LIKE") fail("LIKE_AUTHORIZATION_INVALID"); const result: LikeExecutionAuthorization = { schemaVersion: 1, authorizationId: text(o.authorizationId, ID, "LIKE_AUTHORIZATION_INVALID"), decisionId: text(o.decisionId, ID, "LIKE_AUTHORIZATION_INVALID"), action: "LIKE", clipCommitment: text(o.clipCommitment, HASH, "LIKE_AUTHORIZATION_INVALID"), actorProfileCommitment: text(o.actorProfileCommitment, HASH, "LIKE_AUTHORIZATION_INVALID"), actorProfileGeneration: integer(o.actorProfileGeneration, 1, Number.MAX_SAFE_INTEGER, "LIKE_AUTHORIZATION_INVALID"), sessionPublicKey: text(o.sessionPublicKey, HASH, "LIKE_AUTHORIZATION_INVALID"), capabilityId: text(o.capabilityId, HASH, "LIKE_AUTHORIZATION_INVALID"), actionNonce: text(o.actionNonce, /^[1-9][0-9]{0,19}$/, "LIKE_AUTHORIZATION_INVALID"), payloadCommitment: text(o.payloadCommitment, HASH, "LIKE_AUTHORIZATION_INVALID"), chainId: text(o.chainId, /^[A-Za-z0-9_-]{1,16}$/, "LIKE_AUTHORIZATION_INVALID"), contractAddress: text(o.contractAddress, /^erd1[a-z0-9]{58}$/, "LIKE_AUTHORIZATION_INVALID"), clipStateVersion: integer(o.clipStateVersion, 1, Number.MAX_SAFE_INTEGER, "LIKE_AUTHORIZATION_INVALID"), mediaGeneration: integer(o.mediaGeneration, 1, Number.MAX_SAFE_INTEGER, "LIKE_AUTHORIZATION_INVALID"), policyVersion: integer(o.policyVersion, 1, Number.MAX_SAFE_INTEGER, "LIKE_AUTHORIZATION_INVALID"), evaluatedAt: iso(o.evaluatedAt, "LIKE_AUTHORIZATION_INVALID"), expiresAt: iso(o.expiresAt, "LIKE_AUTHORIZATION_INVALID"), issuerKeyId: text(o.issuerKeyId, ID, "LIKE_AUTHORIZATION_INVALID"), signature: text(o.signature, SIGNATURE, "LIKE_AUTHORIZATION_INVALID") }; if (Date.parse(result.evaluatedAt) >= Date.parse(result.expiresAt)) fail("LIKE_AUTHORIZATION_INVALID"); return result; }
function parseLikeEnvelope(value: unknown): LikeActionEnvelope { const o = plain(value, LIKE_ENVELOPE_KEYS, "LIKE_ENVELOPE_INVALID"); if (o.version !== 1 || o.actionType !== "LIKE") fail("LIKE_ENVELOPE_INVALID"); return { version: 1, actorKind: exact(o.actorKind, ["HUMAN", "AGENT"], "LIKE_ENVELOPE_INVALID"), actorCommitment: text(o.actorCommitment, HASH, "LIKE_ENVELOPE_INVALID"), actionType: "LIKE", objectCommitment: text(o.objectCommitment, HASH, "LIKE_ENVELOPE_INVALID"), payloadHashOrCid: text(o.payloadHashOrCid, HASH, "LIKE_ENVELOPE_INVALID"), visibilityClass: exact(o.visibilityClass, ["PUBLIC", "CONNECTIONS"], "LIKE_ENVELOPE_INVALID"), actionNonce: typeof o.actionNonce === "bigint" && o.actionNonce > 0n ? o.actionNonce : fail("LIKE_ENVELOPE_INVALID"), issuedAtMs: integer(o.issuedAtMs, 0, Number.MAX_SAFE_INTEGER, "LIKE_ENVELOPE_INVALID"), expiresAtMs: integer(o.expiresAtMs, 0, Number.MAX_SAFE_INTEGER, "LIKE_ENVELOPE_INVALID"), sessionPublicKey: text(o.sessionPublicKey, HASH, "LIKE_ENVELOPE_INVALID") }; }
function parseLikeContext(value: unknown): LikeExecutionContext { const o = plain(value, LIKE_CONTEXT_KEYS, "LIKE_CONTEXT_INVALID"); if (!Array.isArray(o.payments) || o.payments.length !== 0 || o.relayerAgreementVerified !== true) fail("LIKE_CONTEXT_INVALID"); return { chainId: text(o.chainId, /^[A-Za-z0-9_-]{1,16}$/, "LIKE_CONTEXT_INVALID"), contractAddress: text(o.contractAddress, /^erd1[a-z0-9]{58}$/, "LIKE_CONTEXT_INVALID"), relayer: text(o.relayer, /^erd1[a-z0-9]{58}$/, "LIKE_CONTEXT_INVALID"), relayerAgreementVerified: true, nowMs: integer(o.nowMs, 0, Number.MAX_SAFE_INTEGER, "LIKE_CONTEXT_INVALID"), payments: [] }; }
function binding(command: ClipPublishCommand, decision: ClipEligibilityDecision): boolean { return command.clipCommitment === decision.clipCommitment && command.assetId === decision.assetId && command.manifestHash === decision.manifestHash && command.creatorProfileCommitment === decision.creatorProfileCommitment && command.profileGeneration === decision.profileGeneration && command.audience === decision.audience; }

export class SocialClipRegistry {
  private readonly clips = new Map<string, ClipProjection>();
  private readonly assetIds = new Set<string>();
  private readonly decisionIds = new Set<string>();
  private readonly engagementDecisionIds = new Set<string>();
  private readonly likeAuthorizationIds = new Set<string>();
  private readonly purgeIds = new Set<string>();
  constructor(private readonly media: ClipMediaBoundary, private readonly profiles: ClipProfileBoundary, private readonly engagementPolicy: ClipEngagementPolicyBoundary) {}

  publish(commandInput: unknown, decisionInput: unknown, commandVerifier: SignedVerifier<ClipPublishCommand>, decisionVerifier: SignedVerifier<ClipEligibilityDecision>, nowInput: unknown): Readonly<ClipProjection> {
    const command = parsePublish(commandInput), decision = parseEligibility(decisionInput), now = iso(nowInput, "CLIP_TIME_INVALID");
    if (Date.parse(command.publishedAt) > Date.parse(now) || Date.parse(decision.evaluatedAt) > Date.parse(now) || Date.parse(decision.expiresAt) <= Date.parse(now)) fail("CLIP_CONTEXT_EXPIRED");
    if (!commandVerifier || commandVerifier.verify(frozen({ ...command })) !== true) fail("CLIP_SIGNATURE_INVALID");
    if (!decisionVerifier || decisionVerifier.verify(frozen({ ...decision })) !== true) fail("CLIP_ELIGIBILITY_SIGNATURE_INVALID");
    if (!binding(command, decision)) fail("CLIP_ELIGIBILITY_BINDING_MISMATCH");
    if (decision.moderation !== "APPROVED") fail("CLIP_MODERATION_DENIED");
    if (decision.rightsState !== "CLEARED") fail("CLIP_RIGHTS_DENIED");
    if (!decision.ageEligible || !decision.audienceAllowed) fail("CLIP_AUDIENCE_DENIED");
    if (command.promotionLabel === "PAID_PROMOTION" && !decision.promotionDeclared) fail("CLIP_PROMOTION_DISCLOSURE_REQUIRED");
    if (!this.profiles.isActiveProfile(command.creatorProfileCommitment, command.profileGeneration)) fail("PROFILE_GENERATION_STALE");
    if (!this.media.isReady(command.assetId, command.manifestHash)) fail("CLIP_MEDIA_NOT_READY");
    if (this.clips.has(command.clipCommitment) || this.assetIds.has(command.assetId) || this.decisionIds.has(decision.decisionId)) fail("CLIP_REPLAY");
    const projection: ClipProjection = { schemaVersion: 1, clipCommitment: command.clipCommitment, assetId: command.assetId, manifestHash: command.manifestHash, creatorProfileCommitment: command.creatorProfileCommitment, profileGeneration: command.profileGeneration, durationSeconds: command.durationSeconds, audience: command.audience, contentRating: "ADULT_GENERAL", syntheticLabel: "SYSTEM_TEST", promotionLabel: command.promotionLabel, organicMetricEligible: false, kidsEligible: false, stateVersion: 1, state: "ACTIVE", publishedAt: command.publishedAt, updatedAt: command.publishedAt };
    this.clips.set(command.clipCommitment, projection); this.assetIds.add(command.assetId); this.decisionIds.add(decision.decisionId); return frozen({ ...projection });
  }

  async executeLike(decisionInput: unknown, authorizationInput: unknown, envelopeInput: unknown, sessionSignatureInput: unknown, contextInput: unknown, decisionVerifier: SignedVerifier<ClipEngagementDecision>, authorizationVerifier: SignedVerifier<LikeExecutionAuthorization>, recorder: LikeActionRecorder, nowInput: unknown): Promise<Readonly<LikeRecordedEvent>> {
    const decision = parseEngagement(decisionInput), authorization = parseExecution(authorizationInput), envelope = parseLikeEnvelope(envelopeInput), context = parseLikeContext(contextInput), now = iso(nowInput, "ENGAGEMENT_TIME_INVALID"), clip = this.requireClip(decision.clipCommitment), sessionSignature = text(sessionSignatureInput, SIGNATURE, "LIKE_SESSION_SIGNATURE_INVALID");
    if (Date.parse(decision.evaluatedAt) > Date.parse(now) || Date.parse(decision.expiresAt) <= Date.parse(now)) fail("ENGAGEMENT_DECISION_EXPIRED");
    if (Date.parse(authorization.evaluatedAt) > Date.parse(now) || Date.parse(authorization.expiresAt) <= Date.parse(now) || context.nowMs !== Date.parse(now)) fail("LIKE_AUTHORIZATION_EXPIRED");
    if (!decisionVerifier || decisionVerifier.verify(frozen({ ...decision })) !== true) fail("ENGAGEMENT_DECISION_SIGNATURE_INVALID");
    if (!authorizationVerifier || authorizationVerifier.verify(frozen({ ...authorization })) !== true) fail("LIKE_AUTHORIZATION_SIGNATURE_INVALID");
    if (authorization.decisionId !== decision.decisionId || authorization.clipCommitment !== decision.clipCommitment || authorization.actorProfileCommitment !== decision.actorProfileCommitment || authorization.actorProfileGeneration !== decision.actorProfileGeneration) fail("LIKE_AUTHORIZATION_BINDING_MISMATCH");
    if (envelope.actorCommitment !== authorization.actorProfileCommitment || envelope.objectCommitment !== authorization.clipCommitment || envelope.payloadHashOrCid !== authorization.payloadCommitment || envelope.sessionPublicKey !== authorization.sessionPublicKey || envelope.sessionPublicKey !== authorization.capabilityId || envelope.actionNonce.toString() !== authorization.actionNonce || context.chainId !== authorization.chainId || context.contractAddress !== authorization.contractAddress || envelope.expiresAtMs > Date.parse(authorization.expiresAt)) fail("LIKE_ENVELOPE_BINDING_MISMATCH");
    if (!this.profiles.isActiveProfile(decision.actorProfileCommitment, decision.actorProfileGeneration)) fail("PROFILE_GENERATION_STALE");
    if (clip.state !== "ACTIVE" || this.media.isPurged(clip.assetId) || !this.media.isReady(clip.assetId, clip.manifestHash)) fail("CLIP_NOT_PLAYABLE");
    if (decision.blocked) fail("ENGAGEMENT_BLOCKED"); if (!decision.audienceAllowed) fail("ENGAGEMENT_AUDIENCE_DENIED"); if (!decision.deviceActive) fail("ENGAGEMENT_DEVICE_REVOKED");
    const policy = this.engagementPolicy.current(decision.actorProfileCommitment, decision.clipCommitment); if (policy.version !== authorization.policyVersion || policy.blocked !== decision.blocked || policy.audienceAllowed !== decision.audienceAllowed || policy.deviceActive !== decision.deviceActive) fail("ENGAGEMENT_POLICY_STALE");
    const mediaGeneration = this.media.currentGeneration(clip.assetId); if (authorization.clipStateVersion !== clip.stateVersion || authorization.mediaGeneration !== mediaGeneration) fail("CLIP_EXECUTION_STATE_CONFLICT");
    if (this.engagementDecisionIds.has(decision.decisionId) || this.likeAuthorizationIds.has(authorization.authorizationId)) fail("LIKE_AUTHORIZATION_REPLAY");
    let prepared: PreparedLikeAction | null = null;
    try {
      prepared = await recorder.prepareAction(envelope, sessionSignature, context);
      const current = this.requireClip(decision.clipCommitment), currentPolicy = this.engagementPolicy.current(decision.actorProfileCommitment, decision.clipCommitment);
      if (current.state !== "ACTIVE" || current.stateVersion !== authorization.clipStateVersion || this.media.currentGeneration(current.assetId) !== authorization.mediaGeneration || this.media.isPurged(current.assetId) || !this.media.isReady(current.assetId, current.manifestHash) || !this.profiles.isActiveProfile(decision.actorProfileCommitment, decision.actorProfileGeneration) || currentPolicy.version !== authorization.policyVersion || currentPolicy.blocked !== decision.blocked || currentPolicy.audienceAllowed !== decision.audienceAllowed || currentPolicy.deviceActive !== decision.deviceActive || this.engagementDecisionIds.has(decision.decisionId) || this.likeAuthorizationIds.has(authorization.authorizationId)) fail("CLIP_EXECUTION_STATE_CONFLICT");
      const event = recorder.commitPreparedAction(prepared); prepared = null; this.engagementDecisionIds.add(decision.decisionId); this.likeAuthorizationIds.add(authorization.authorizationId); return frozen({ ...event });
    } catch (error) { if (prepared !== null) recorder.abortPreparedAction(prepared); throw error; }
  }

  purge(commandInput: unknown, verifier: SignedVerifier<ClipPurgeCommand>, nowInput: unknown): Readonly<ClipProjection> {
    const command = parsePurge(commandInput), now = iso(nowInput, "CLIP_TIME_INVALID"), clip = this.requireClip(command.clipCommitment);
    if (Date.parse(command.occurredAt) > Date.parse(now) || Date.parse(command.occurredAt) < Date.parse(clip.updatedAt)) fail("CLIP_TIME_INVALID");
    if (!verifier || verifier.verify(frozen({ ...command })) !== true) fail("CLIP_PURGE_SIGNATURE_INVALID");
    if (command.assetId !== clip.assetId) fail("CLIP_PURGE_BINDING_MISMATCH");
    if (clip.state === "PURGED" || this.purgeIds.has(command.purgeId)) fail("CLIP_PURGE_REPLAY");
    if (!this.media.isPurged(command.assetId)) fail("CLIP_PURGE_UNVERIFIED");
    const updated: ClipProjection = { ...clip, stateVersion: clip.stateVersion + 1, state: "PURGED", updatedAt: command.occurredAt }; this.clips.set(command.clipCommitment, updated); this.purgeIds.add(command.purgeId); return frozen({ ...updated });
  }

  view(clipCommitmentInput: unknown): Readonly<ClipProjection> | null { const clip = this.clips.get(text(clipCommitmentInput, HASH, "CLIP_ID_INVALID")); return clip ? frozen({ ...clip }) : null; }
  private requireClip(id: string): ClipProjection { const clip = this.clips.get(id); if (!clip) fail("CLIP_NOT_FOUND"); return clip; }
}
