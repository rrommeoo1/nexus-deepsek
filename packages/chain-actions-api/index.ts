export type ActorKind = "HUMAN" | "AGENT";
export type ActionType =
  | "POST_CREATE" | "POST_EDIT" | "LIKE" | "UNLIKE" | "COMMENT_CREATE" | "COMMENT_EDIT"
  | "COMMENT_TOMBSTONE" | "FOLLOW" | "UNFOLLOW" | "SAVE" | "SHARE"
  | "LISTING_CREATE" | "LISTING_UPDATE" | "LISTING_RENEW" | "LISTING_CLOSE"
  | "OFFER" | "REVIEW" | "PRIVATE_ACTION";
export type VisibilityClass = "PUBLIC" | "CONNECTIONS" | "PRIVATE_COMMITMENT";
export type ActionScope = "SOCIAL_PUBLIC" | "MARKET_PUBLIC" | "REVIEW_PUBLIC" | "PRIVATE_COMMITMENT";
export type RuntimeProfile = "ANDROMEDA_COMPAT" | "SUPERNOVA";

export interface ActionEnvelope {
  version: 1;
  actorKind: ActorKind;
  actorCommitment: string;
  actionType: ActionType;
  objectCommitment: string;
  payloadHashOrCid: string;
  visibilityClass: VisibilityClass;
  actionNonce: bigint;
  issuedAtMs: number;
  expiresAtMs: number;
  sessionPublicKey: string;
}

export interface CapabilityInput {
  controller: string;
  actorKind: ActorKind;
  actorCommitment: string;
  sessionPublicKey: string;
  scopes: ActionScope[];
  maxActions: number;
  validFromMs: number;
  expiresAtMs: number;
  authorizedRelayers: string[];
}

interface SessionCapability extends CapabilityInput {
  scopes: ActionScope[];
  authorizedRelayers: string[];
  usedActions: number;
  lastActionNonce: bigint;
  state: "ACTIVE" | "REVOKED";
}

export interface ExecutionContext {
  chainId: string;
  contractAddress: string;
  relayer: string;
  relayerAgreementVerified: boolean;
  nowMs: number;
  payments: readonly unknown[];
}

export interface PrivateCommitmentAttestation {
  saltEntropyBits: number;
  targetIncludedInClear: false;
  generatedOnUserDevice: true;
}

export interface SignatureVerifier {
  verifyEd25519(publicKeyHex: string, message: Uint8Array, signatureHex: string): Promise<boolean>;
}

export interface ActionRecordedEvent {
  identifier: "ActionRecorded";
  actorCommitment: string;
  objectCommitment: string;
  actionNonce: string;
  actionClass: "PUBLIC_ACTION" | "PRIVATE_ACTION";
}

export interface PreparedAction {
  readonly envelope: ActionEnvelope;
  readonly context: ExecutionContext;
  readonly expectedUsedActions: number;
  readonly expectedNonce: bigint;
  readonly privateCommitment: string | null;
}

export interface GasSnapshot {
  model: "SYNTHETIC_REGRESSION_ONLY";
  payloadBytes: number;
  estimatedUnits: number;
  baselineUnits: number;
  maximumUnits: number;
  regressionPercent: number;
  withinBudget: boolean;
  actualVmMeasurementRequired: true;
}

export interface NetworkCapabilityEvidence {
  sourceId: string;
  chainId: string;
  observedEpoch: number;
  protocolVersion: string;
  consensusExecutionDecoupled: boolean;
  executionResultMode: "LEGACY" | "ASYNC_INCLUDED";
  relayedV3: boolean;
  observedAtMs: number;
}

export class ChainPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ChainPolicyError"; }
}

const utf8 = new TextEncoder();
const HASH32 = /^[a-f0-9]{64}$/;
const SIGNATURE64 = /^[a-f0-9]{128}$/;
const ADDRESS = /^erd1[a-z0-9]{58}$/;
const CHAIN_ID = /^[A-Za-z0-9_-]{1,16}$/;
const MAX_ACTION_TTL_MS = 5 * 60_000;

const actionScope: Record<ActionType, ActionScope> = {
  POST_CREATE: "SOCIAL_PUBLIC", POST_EDIT: "SOCIAL_PUBLIC", LIKE: "SOCIAL_PUBLIC",
  UNLIKE: "SOCIAL_PUBLIC", COMMENT_CREATE: "SOCIAL_PUBLIC", COMMENT_EDIT: "SOCIAL_PUBLIC",
  COMMENT_TOMBSTONE: "SOCIAL_PUBLIC", FOLLOW: "SOCIAL_PUBLIC", UNFOLLOW: "SOCIAL_PUBLIC",
  SAVE: "SOCIAL_PUBLIC", SHARE: "SOCIAL_PUBLIC", LISTING_CREATE: "MARKET_PUBLIC",
  LISTING_UPDATE: "MARKET_PUBLIC", LISTING_RENEW: "MARKET_PUBLIC", LISTING_CLOSE: "MARKET_PUBLIC",
  OFFER: "MARKET_PUBLIC", REVIEW: "REVIEW_PUBLIC", PRIVATE_ACTION: "PRIVATE_COMMITMENT",
};

function requireHash(value: string, code: string): void {
  if (!HASH32.test(value)) throw new ChainPolicyError(code);
}

function validateEnvelopeShape(envelope: ActionEnvelope): void {
  if (Array.isArray(envelope)) throw new ChainPolicyError("BATCH_FORBIDDEN");
  if (!envelope || envelope.version !== 1) throw new ChainPolicyError("ENVELOPE_VERSION_INVALID");
  if (envelope.actorKind !== "HUMAN" && envelope.actorKind !== "AGENT") throw new ChainPolicyError("ACTOR_KIND_FORBIDDEN");
  requireHash(envelope.actorCommitment, "ACTOR_COMMITMENT_INVALID");
  requireHash(envelope.objectCommitment, "OBJECT_COMMITMENT_INVALID");
  requireHash(envelope.payloadHashOrCid, "PAYLOAD_COMMITMENT_INVALID");
  requireHash(envelope.sessionPublicKey, "SESSION_KEY_INVALID");
  if (!(envelope.actionType in actionScope)) throw new ChainPolicyError("ACTION_TYPE_INVALID");
  if (!["PUBLIC", "CONNECTIONS", "PRIVATE_COMMITMENT"].includes(envelope.visibilityClass)) throw new ChainPolicyError("VISIBILITY_INVALID");
  if (typeof envelope.actionNonce !== "bigint" || envelope.actionNonce <= 0n) throw new ChainPolicyError("ACTION_NONCE_INVALID");
  if (!Number.isSafeInteger(envelope.issuedAtMs) || !Number.isSafeInteger(envelope.expiresAtMs)) throw new ChainPolicyError("ACTION_TIME_INVALID");
}

function validateContext(context: ExecutionContext): void {
  if (!CHAIN_ID.test(context.chainId)) throw new ChainPolicyError("CHAIN_ID_INVALID");
  if (!ADDRESS.test(context.contractAddress)) throw new ChainPolicyError("CONTRACT_ADDRESS_INVALID");
  if (!ADDRESS.test(context.relayer)) throw new ChainPolicyError("RELAYER_ADDRESS_INVALID");
  if (!context.relayerAgreementVerified) throw new ChainPolicyError("RELAYER_AGREEMENT_REQUIRED");
  if (context.payments.length !== 0) throw new ChainPolicyError("ACTION_ENDPOINT_NONPAYABLE");
  if (!Number.isSafeInteger(context.nowMs)) throw new ChainPolicyError("CONTEXT_TIME_INVALID");
}

export function serializeEnvelopeForSigning(envelope: ActionEnvelope, chainId: string, contractAddress: string): Uint8Array {
  validateEnvelopeShape(envelope);
  if (!CHAIN_ID.test(chainId) || !ADDRESS.test(contractAddress)) throw new ChainPolicyError("DOMAIN_SEPARATOR_INVALID");
  return utf8.encode([
    "NEXUS_ACTION", "1", chainId, contractAddress, envelope.actorKind, envelope.actorCommitment,
    envelope.actionType, envelope.objectCommitment, envelope.payloadHashOrCid, envelope.visibilityClass,
    envelope.actionNonce.toString(), envelope.issuedAtMs.toString(), envelope.expiresAtMs.toString(),
    envelope.sessionPublicKey,
  ].join("\n"));
}

export function selectRuntimeProfile(evidence: NetworkCapabilityEvidence[], expectedChainId: string, nowMs: number): RuntimeProfile {
  const fresh = evidence.filter((item) =>
    item.chainId === expectedChainId && item.observedAtMs <= nowMs && nowMs - item.observedAtMs <= 60_000,
  );
  const sourceIds = new Set(fresh.map((item) => item.sourceId));
  if (sourceIds.size < 2) return "ANDROMEDA_COMPAT";
  const versions = new Set(fresh.map((item) => `${item.observedEpoch}|${item.protocolVersion}`));
  if (versions.size !== 1) return "ANDROMEDA_COMPAT";
  return fresh.every((item) => item.consensusExecutionDecoupled && item.executionResultMode === "ASYNC_INCLUDED" && item.relayedV3)
    ? "SUPERNOVA"
    : "ANDROMEDA_COMPAT";
}

export class NexusActionsSandbox {
  private readonly capabilities = new Map<string, SessionCapability>();
  private readonly events: ActionRecordedEvent[] = [];
  private readonly pausedActionTypes = new Set<ActionType>();
  private readonly pausedRelayers = new Set<string>();
  private readonly preparedActions = new WeakSet<object>();

  constructor(private readonly signatureVerifier: SignatureVerifier) {}

  registerCapability(input: CapabilityInput, callerController: string, nowMs: number): void {
    if (callerController !== input.controller) throw new ChainPolicyError("CONTROLLER_REQUIRED");
    if (!HASH32.test(input.controller) || !HASH32.test(input.actorCommitment) || !HASH32.test(input.sessionPublicKey)) throw new ChainPolicyError("CAPABILITY_IDENTITY_INVALID");
    if (input.actorKind !== "HUMAN" && input.actorKind !== "AGENT") throw new ChainPolicyError("ACTOR_KIND_FORBIDDEN");
    if (this.capabilities.has(input.sessionPublicKey)) throw new ChainPolicyError("CAPABILITY_ALREADY_EXISTS");
    if (!Number.isInteger(input.maxActions) || input.maxActions < 1 || input.maxActions > 10_000) throw new ChainPolicyError("CAPABILITY_LIMIT_INVALID");
    if (!Number.isSafeInteger(input.validFromMs) || !Number.isSafeInteger(input.expiresAtMs) || input.validFromMs > nowMs || input.expiresAtMs <= nowMs) throw new ChainPolicyError("CAPABILITY_TIME_INVALID");
    if (input.scopes.length < 1 || new Set(input.scopes).size !== input.scopes.length || input.scopes.some((scope) => !["SOCIAL_PUBLIC", "MARKET_PUBLIC", "REVIEW_PUBLIC", "PRIVATE_COMMITMENT"].includes(scope))) throw new ChainPolicyError("CAPABILITY_SCOPE_INVALID");
    if (input.authorizedRelayers.length < 1 || new Set(input.authorizedRelayers).size !== input.authorizedRelayers.length || input.authorizedRelayers.some((address) => !ADDRESS.test(address))) throw new ChainPolicyError("CAPABILITY_RELAYER_INVALID");
    this.capabilities.set(input.sessionPublicKey, { ...input, scopes: [...input.scopes], authorizedRelayers: [...input.authorizedRelayers], usedActions: 0, lastActionNonce: 0n, state: "ACTIVE" });
  }

  rotateCapability(oldSessionKey: string, replacement: CapabilityInput, callerController: string, nowMs: number): void {
    const current = this.requireCapability(oldSessionKey);
    if (current.controller !== callerController || replacement.controller !== callerController) throw new ChainPolicyError("CONTROLLER_REQUIRED");
    if (replacement.actorKind !== current.actorKind || replacement.actorCommitment !== current.actorCommitment) throw new ChainPolicyError("CAPABILITY_IDENTITY_ESCALATION");
    if (replacement.scopes.some((scope) => !current.scopes.includes(scope))) throw new ChainPolicyError("CAPABILITY_SCOPE_ESCALATION");
    if (replacement.expiresAtMs > current.expiresAtMs || replacement.maxActions > current.maxActions - current.usedActions) throw new ChainPolicyError("CAPABILITY_LIMIT_ESCALATION");
    this.registerCapability(replacement, callerController, nowMs);
    current.state = "REVOKED";
  }

  revokeCapability(sessionKey: string, callerController: string): void {
    const capability = this.requireCapability(sessionKey);
    if (capability.controller !== callerController) throw new ChainPolicyError("CONTROLLER_REQUIRED");
    capability.state = "REVOKED";
  }

  pauseActionType(actionType: ActionType, adminAuthorized: boolean): void {
    if (!adminAuthorized) throw new ChainPolicyError("ADMIN_REQUIRED");
    this.pausedActionTypes.add(actionType);
  }

  pauseRelayer(relayer: string, adminAuthorized: boolean): void {
    if (!adminAuthorized) throw new ChainPolicyError("ADMIN_REQUIRED");
    if (!ADDRESS.test(relayer)) throw new ChainPolicyError("RELAYER_ADDRESS_INVALID");
    this.pausedRelayers.add(relayer);
  }

  async recordAction(envelope: ActionEnvelope, signatureHex: string, context: ExecutionContext): Promise<ActionRecordedEvent> {
    if (envelope.actionType === "PRIVATE_ACTION" || envelope.visibilityClass === "PRIVATE_COMMITMENT") throw new ChainPolicyError("PRIVATE_ENDPOINT_REQUIRED");
    return this.commitPreparedAction(await this.prepareAction(envelope, signatureHex, context));
  }

  async prepareAction(envelope: ActionEnvelope, signatureHex: string, context: ExecutionContext): Promise<PreparedAction> {
    if (envelope.actionType === "PRIVATE_ACTION" || envelope.visibilityClass === "PRIVATE_COMMITMENT") throw new ChainPolicyError("PRIVATE_ENDPOINT_REQUIRED");
    return this.prepare(envelope, signatureHex, context, null);
  }

  commitPreparedAction(prepared: PreparedAction): ActionRecordedEvent {
    if (!prepared || typeof prepared !== "object" || !this.preparedActions.has(prepared as object)) throw new ChainPolicyError("PREPARED_ACTION_INVALID");
    this.preparedActions.delete(prepared as object);
    const capability = this.requireCapability(prepared.envelope.sessionPublicKey);
    if (
      capability.state !== "ACTIVE" || capability.lastActionNonce !== prepared.expectedNonce - 1n || capability.usedActions !== prepared.expectedUsedActions ||
      this.pausedRelayers.has(prepared.context.relayer) || this.pausedActionTypes.has(prepared.envelope.actionType)
    ) throw new ChainPolicyError("CAPABILITY_COMMIT_CONFLICT");
    capability.lastActionNonce = prepared.expectedNonce; capability.usedActions = prepared.expectedUsedActions + 1;
    const event: ActionRecordedEvent = { identifier: "ActionRecorded", actorCommitment: prepared.envelope.actorCommitment, objectCommitment: prepared.envelope.objectCommitment, actionNonce: prepared.envelope.actionNonce.toString(), actionClass: prepared.privateCommitment === null ? "PUBLIC_ACTION" : "PRIVATE_ACTION" };
    this.events.push(event); return { ...event };
  }

  commitPreparedActionExact(prepared: PreparedAction, expected: ActionRecordedEvent): ActionRecordedEvent {
    if (!prepared || typeof prepared !== "object" || !this.preparedActions.has(prepared as object)) throw new ChainPolicyError("PREPARED_ACTION_INVALID");
    const projected: ActionRecordedEvent = {
      identifier: "ActionRecorded",
      actorCommitment: prepared.envelope.actorCommitment,
      objectCommitment: prepared.envelope.objectCommitment,
      actionNonce: prepared.envelope.actionNonce.toString(),
      actionClass: prepared.privateCommitment === null ? "PUBLIC_ACTION" : "PRIVATE_ACTION",
    };
    if (
      expected.identifier !== projected.identifier || expected.actorCommitment !== projected.actorCommitment ||
      expected.objectCommitment !== projected.objectCommitment || expected.actionNonce !== projected.actionNonce ||
      expected.actionClass !== projected.actionClass
    ) throw new ChainPolicyError("PREPARED_ACTION_BINDING_MISMATCH");
    return this.commitPreparedAction(prepared);
  }

  abortPreparedAction(prepared: PreparedAction): void {
    if (prepared && typeof prepared === "object") this.preparedActions.delete(prepared as object);
  }

  async recordPrivateAction(genericCommitment: string, envelope: ActionEnvelope, signatureHex: string, context: ExecutionContext, attestation: PrivateCommitmentAttestation): Promise<ActionRecordedEvent> {
    return this.commitPreparedAction(await this.preparePrivateAction(genericCommitment, envelope, signatureHex, context, attestation));
  }

  async preparePrivateAction(genericCommitment: string, envelope: ActionEnvelope, signatureHex: string, context: ExecutionContext, attestation: PrivateCommitmentAttestation): Promise<PreparedAction> {
    requireHash(genericCommitment, "GENERIC_COMMITMENT_INVALID");
    if (envelope.actionType !== "PRIVATE_ACTION" || envelope.visibilityClass !== "PRIVATE_COMMITMENT" || envelope.objectCommitment !== genericCommitment) throw new ChainPolicyError("PRIVATE_ENVELOPE_INVALID");
    if (attestation.saltEntropyBits < 128 || attestation.targetIncludedInClear !== false || attestation.generatedOnUserDevice !== true) throw new ChainPolicyError("PRIVATE_COMMITMENT_ATTESTATION_INVALID");
    return this.prepare(envelope, signatureHex, context, genericCommitment);
  }

  drainEvents(): ActionRecordedEvent[] { return this.events.splice(0, this.events.length).map((event) => ({ ...event })); }

  getCapabilitySnapshot(sessionKey: string): { usedActions: number; lastActionNonce: string; state: "ACTIVE" | "REVOKED"; scopes: ActionScope[] } {
    const capability = this.requireCapability(sessionKey);
    return { usedActions: capability.usedActions, lastActionNonce: capability.lastActionNonce.toString(), state: capability.state, scopes: [...capability.scopes] };
  }

  getGasSnapshot(envelope: ActionEnvelope, chainId: string, contractAddress: string): GasSnapshot {
    const payloadBytes = serializeEnvelopeForSigning(envelope, chainId, contractAddress).byteLength + 64;
    const baselineUnits = 12_000_000;
    const maximumUnits = 13_200_000;
    const estimatedUnits = 8_500_000 + payloadBytes * 1_500 + 1_000_000 + 750_000;
    const regressionPercent = ((estimatedUnits - baselineUnits) / baselineUnits) * 100;
    return { model: "SYNTHETIC_REGRESSION_ONLY", payloadBytes, estimatedUnits, baselineUnits, maximumUnits, regressionPercent, withinBudget: estimatedUnits <= maximumUnits, actualVmMeasurementRequired: true };
  }

  private async prepare(envelope: ActionEnvelope, signatureHex: string, context: ExecutionContext, privateCommitment: string | null): Promise<PreparedAction> {
    validateEnvelopeShape(envelope);
    validateContext(context);
    if (!SIGNATURE64.test(signatureHex)) throw new ChainPolicyError("SIGNATURE_FORMAT_INVALID");
    const capability = this.requireCapability(envelope.sessionPublicKey);
    if (capability.state !== "ACTIVE") throw new ChainPolicyError("CAPABILITY_REVOKED");
    if (capability.actorKind !== envelope.actorKind || capability.actorCommitment !== envelope.actorCommitment) throw new ChainPolicyError("CAPABILITY_ACTOR_MISMATCH");
    if (context.nowMs < capability.validFromMs || context.nowMs >= capability.expiresAtMs || envelope.expiresAtMs > capability.expiresAtMs) throw new ChainPolicyError("CAPABILITY_EXPIRED");
    if (envelope.issuedAtMs > context.nowMs || envelope.expiresAtMs <= context.nowMs || envelope.expiresAtMs - envelope.issuedAtMs > MAX_ACTION_TTL_MS) throw new ChainPolicyError("ACTION_TTL_INVALID");
    if (!capability.scopes.includes(actionScope[envelope.actionType])) throw new ChainPolicyError("CAPABILITY_SCOPE_DENIED");
    if (!capability.authorizedRelayers.includes(context.relayer) || this.pausedRelayers.has(context.relayer)) throw new ChainPolicyError("RELAYER_DENIED");
    if (this.pausedActionTypes.has(envelope.actionType)) throw new ChainPolicyError("ACTION_TYPE_PAUSED");
    if (capability.usedActions >= capability.maxActions) throw new ChainPolicyError("CAPABILITY_ACTION_LIMIT");
    const expectedNonce = capability.lastActionNonce + 1n;
    if (envelope.actionNonce !== expectedNonce) throw new ChainPolicyError("ACTION_NONCE_REPLAY_OR_GAP");
    if (privateCommitment === null && (envelope.actionType === "PRIVATE_ACTION" || envelope.visibilityClass === "PRIVATE_COMMITMENT")) throw new ChainPolicyError("PRIVATE_ENDPOINT_REQUIRED");
    const expectedUsedActions = capability.usedActions;
    const message = serializeEnvelopeForSigning(envelope, context.chainId, context.contractAddress);
    if (!(await this.signatureVerifier.verifyEd25519(envelope.sessionPublicKey, message, signatureHex))) throw new ChainPolicyError("SESSION_SIGNATURE_INVALID");
    // Post-await CAS closes concurrent nonce/action-limit races.
    if (
      capability.state !== "ACTIVE" || capability.lastActionNonce !== expectedNonce - 1n || capability.usedActions !== expectedUsedActions ||
      this.pausedRelayers.has(context.relayer) || this.pausedActionTypes.has(envelope.actionType)
    ) throw new ChainPolicyError("CAPABILITY_COMMIT_CONFLICT");
    const prepared: PreparedAction = Object.freeze({ envelope: Object.freeze({ ...envelope }), context: Object.freeze({ ...context, payments: Object.freeze([...context.payments]) }), expectedUsedActions, expectedNonce, privateCommitment });
    this.preparedActions.add(prepared); return prepared;
  }

  private requireCapability(sessionKey: string): SessionCapability {
    const capability = this.capabilities.get(sessionKey);
    if (!capability) throw new ChainPolicyError("CAPABILITY_NOT_FOUND");
    return capability;
  }
}

export type ActionLifecycleState =
  | "CREATED" | "RELAY_QUEUED" | "SUBMITTED" | "NETWORK_ACCEPTED" | "ORDERED_FINAL"
  | "EXECUTION_PENDING" | "EXECUTED_SUCCESS" | "EXECUTED_FAIL" | "RECONCILIATION_REQUIRED";
export type ChainObservation = "NETWORK_ACCEPTED" | "ORDERED_FINAL" | "EXECUTION_STARTED" | "EXECUTION_SUCCESS" | "EXECUTION_FAIL" | "DIVERGENCE";

export class ActionLifecycleTracker {
  private state: ActionLifecycleState = "CREATED";
  private consensusTimestampMs: number | null = null;
  private executionTimestampMs: number | null = null;
  private executionEventVerified = false;

  queue(): void { this.transition("CREATED", "RELAY_QUEUED"); }
  submit(): void { this.transition("RELAY_QUEUED", "SUBMITTED"); }

  observe(observation: ChainObservation, atMs: number, executionEventVerified = false): void {
    if (!Number.isSafeInteger(atMs)) throw new ChainPolicyError("OBSERVATION_TIME_INVALID");
    switch (observation) {
      case "NETWORK_ACCEPTED": this.transition("SUBMITTED", "NETWORK_ACCEPTED"); break;
      case "ORDERED_FINAL": this.transition("NETWORK_ACCEPTED", "ORDERED_FINAL"); this.consensusTimestampMs = atMs; break;
      case "EXECUTION_STARTED": this.transition("ORDERED_FINAL", "EXECUTION_PENDING"); break;
      case "EXECUTION_SUCCESS":
        if (!executionEventVerified) throw new ChainPolicyError("EXECUTION_EVENT_REQUIRED");
        this.transition("EXECUTION_PENDING", "EXECUTED_SUCCESS");
        this.executionTimestampMs = atMs; this.executionEventVerified = true; break;
      case "EXECUTION_FAIL": this.transition("EXECUTION_PENDING", "EXECUTED_FAIL"); this.executionTimestampMs = atMs; break;
      case "DIVERGENCE":
        if (this.state === "EXECUTED_SUCCESS" || this.state === "EXECUTED_FAIL") throw new ChainPolicyError("TERMINAL_RECONCILIATION_REQUIRED");
        this.state = "RECONCILIATION_REQUIRED"; break;
    }
  }

  canApplyAuthoritativeDomainEffect(): boolean { return this.state === "EXECUTED_SUCCESS" && this.executionEventVerified; }
  snapshot(): { state: ActionLifecycleState; consensusTimestampMs: number | null; executionTimestampMs: number | null; authoritative: boolean } {
    return { state: this.state, consensusTimestampMs: this.consensusTimestampMs, executionTimestampMs: this.executionTimestampMs, authoritative: this.canApplyAuthoritativeDomainEffect() };
  }

  private transition(expected: ActionLifecycleState, next: ActionLifecycleState): void {
    if (this.state !== expected) throw new ChainPolicyError("LIFECYCLE_TRANSITION_INVALID");
    this.state = next;
  }
}

export function scanSerializedTransactionForPrivatePlaintext(serialized: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ["phone", /(?:\+|00)[1-9][0-9 .()-]{7,}/],
    ["url", /https?:\/\//i],
    ["coordinates", /\b(?:lat(?:itude)?|lon(?:gitude)?)\s*[:=]/i],
    ["private_field", /\b(?:gender|orientation|birthdate|messageplaintext|childid|datingtarget)\b/i],
  ];
  return patterns.filter(([, pattern]) => pattern.test(serialized)).map(([name]) => name);
}
