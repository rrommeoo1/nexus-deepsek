export type MessageState = "SENT" | "DELIVERED" | "READ" | "TOMBSTONED";
export class MessagingPolicyError extends Error { constructor(public readonly code: string) { super(code); this.name = "MessagingPolicyError"; } }
const ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function fail(code: string): never { throw new MessagingPolicyError(code); }
function text(value: unknown, pattern: RegExp, code: string): string { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }
function integer(value: unknown, min: number, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < min) fail(code); return value as number; }
function iso(value: unknown, code: string): string { if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value))) fail(code); return value; }
function bool(value: unknown, code: string): boolean { if (typeof value !== "boolean") fail(code); return value; }
function exact<T extends string>(value: unknown, values: readonly T[], code: string): T { if (typeof value !== "string" || !values.includes(value as T)) fail(code); return value as T; }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> { let own: PropertyKey[], descriptors: Record<PropertyKey, PropertyDescriptor>, proto: object | null; try { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code); own = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); proto = Object.getPrototypeOf(value); } catch { fail(code); } if (proto !== Object.prototype && proto !== null) fail(code); if (own.some((key) => typeof key !== "string") || own.length !== keys.length || keys.some((key) => !own.includes(key))) fail(code); for (const key of keys) { const descriptor = descriptors[key]; if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) fail(code); } return value as Record<string, unknown>; }
function frozen<T extends object>(value: T): Readonly<T> { for (const child of Object.values(value)) if (child && typeof child === "object") frozen(child); return Object.freeze(value); }

export interface ConversationCapability {
  schemaVersion: 1;
  conversationId: string;
  participantAProfileCommitment: string;
  participantBProfileCommitment: string;
  activeProfileCommitment: string;
  sessionGeneration: number;
  activeDeviceId: string;
  keyEpoch: number;
  issuedAt: string;
  expiresAt: string;
  actorClass: "SYSTEM_TEST";
  issuerKeyId: string;
  signature: string;
}
export interface SignedVerifier<T> { verify(value: Readonly<T>): boolean }
export interface CheckpointVerifier<T> { verify(value: Readonly<T>): boolean }
const CAPABILITY_KEYS = ["schemaVersion", "conversationId", "participantAProfileCommitment", "participantBProfileCommitment", "activeProfileCommitment", "sessionGeneration", "activeDeviceId", "keyEpoch", "issuedAt", "expiresAt", "actorClass", "issuerKeyId", "signature"] as const;
function parseCapability(value: unknown): ConversationCapability { const o = plain(value, CAPABILITY_KEYS, "CAPABILITY_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("CAPABILITY_INVALID"); const result: ConversationCapability = { schemaVersion: 1, conversationId: text(o.conversationId, ID, "CAPABILITY_INVALID"), participantAProfileCommitment: text(o.participantAProfileCommitment, HEX64, "CAPABILITY_INVALID"), participantBProfileCommitment: text(o.participantBProfileCommitment, HEX64, "CAPABILITY_INVALID"), activeProfileCommitment: text(o.activeProfileCommitment, HEX64, "CAPABILITY_INVALID"), sessionGeneration: integer(o.sessionGeneration, 1, "CAPABILITY_INVALID"), activeDeviceId: text(o.activeDeviceId, ID, "CAPABILITY_INVALID"), keyEpoch: integer(o.keyEpoch, 1, "CAPABILITY_INVALID"), issuedAt: iso(o.issuedAt, "CAPABILITY_INVALID"), expiresAt: iso(o.expiresAt, "CAPABILITY_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: text(o.issuerKeyId, ID, "CAPABILITY_INVALID"), signature: text(o.signature, HEX64, "CAPABILITY_INVALID") }; if (result.participantAProfileCommitment === result.participantBProfileCommitment || ![result.participantAProfileCommitment, result.participantBProfileCommitment].includes(result.activeProfileCommitment) || Date.parse(result.issuedAt) >= Date.parse(result.expiresAt)) fail("CAPABILITY_INVALID"); return result; }

export interface SendEnvelope {
  schemaVersion: 1;
  messageId: string;
  conversationId: string;
  senderProfileCommitment: string;
  recipientProfileCommitment: string;
  senderDeviceId: string;
  sessionGeneration: number;
  keyEpoch: number;
  ciphertextCommitment: string;
  messageNonceCommitment: string;
  sentAt: string;
  actorClass: "SYSTEM_TEST";
  signature: string;
}
const SEND_KEYS = ["schemaVersion", "messageId", "conversationId", "senderProfileCommitment", "recipientProfileCommitment", "senderDeviceId", "sessionGeneration", "keyEpoch", "ciphertextCommitment", "messageNonceCommitment", "sentAt", "actorClass", "signature"] as const;
function parseSend(value: unknown): SendEnvelope { const o = plain(value, SEND_KEYS, "SEND_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("SEND_INVALID"); return { schemaVersion: 1, messageId: text(o.messageId, ID, "SEND_INVALID"), conversationId: text(o.conversationId, ID, "SEND_INVALID"), senderProfileCommitment: text(o.senderProfileCommitment, HEX64, "SEND_INVALID"), recipientProfileCommitment: text(o.recipientProfileCommitment, HEX64, "SEND_INVALID"), senderDeviceId: text(o.senderDeviceId, ID, "SEND_INVALID"), sessionGeneration: integer(o.sessionGeneration, 1, "SEND_INVALID"), keyEpoch: integer(o.keyEpoch, 1, "SEND_INVALID"), ciphertextCommitment: text(o.ciphertextCommitment, HEX64, "SEND_INVALID"), messageNonceCommitment: text(o.messageNonceCommitment, HEX64, "SEND_INVALID"), sentAt: iso(o.sentAt, "SEND_INVALID"), actorClass: "SYSTEM_TEST", signature: text(o.signature, HEX128, "SEND_INVALID") }; }

export type AccessOperation = "SEND" | "DELIVER" | "READ" | "TOMBSTONE";
export interface MessagingAccessDecision {
  schemaVersion: 1;
  decisionId: string;
  operation: AccessOperation;
  conversationId: string;
  messageId: string;
  actorProfileCommitment: string;
  actorDeviceId: string;
  sessionGeneration: number;
  keyEpoch: number;
  blocked: boolean;
  audienceAllowed: boolean;
  deviceActive: boolean;
  evaluatedAt: string;
  expiresAt: string;
  actorClass: "SYSTEM_TEST";
  issuerKeyId: string;
  signature: string;
}
const ACCESS_KEYS = ["schemaVersion", "decisionId", "operation", "conversationId", "messageId", "actorProfileCommitment", "actorDeviceId", "sessionGeneration", "keyEpoch", "blocked", "audienceAllowed", "deviceActive", "evaluatedAt", "expiresAt", "actorClass", "issuerKeyId", "signature"] as const;
function parseAccess(value: unknown): MessagingAccessDecision { const o = plain(value, ACCESS_KEYS, "ACCESS_DECISION_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("ACCESS_DECISION_INVALID"); const result: MessagingAccessDecision = { schemaVersion: 1, decisionId: text(o.decisionId, ID, "ACCESS_DECISION_INVALID"), operation: exact(o.operation, ["SEND", "DELIVER", "READ", "TOMBSTONE"], "ACCESS_DECISION_INVALID"), conversationId: text(o.conversationId, ID, "ACCESS_DECISION_INVALID"), messageId: text(o.messageId, ID, "ACCESS_DECISION_INVALID"), actorProfileCommitment: text(o.actorProfileCommitment, HEX64, "ACCESS_DECISION_INVALID"), actorDeviceId: text(o.actorDeviceId, ID, "ACCESS_DECISION_INVALID"), sessionGeneration: integer(o.sessionGeneration, 1, "ACCESS_DECISION_INVALID"), keyEpoch: integer(o.keyEpoch, 1, "ACCESS_DECISION_INVALID"), blocked: bool(o.blocked, "ACCESS_DECISION_INVALID"), audienceAllowed: bool(o.audienceAllowed, "ACCESS_DECISION_INVALID"), deviceActive: bool(o.deviceActive, "ACCESS_DECISION_INVALID"), evaluatedAt: iso(o.evaluatedAt, "ACCESS_DECISION_INVALID"), expiresAt: iso(o.expiresAt, "ACCESS_DECISION_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: text(o.issuerKeyId, ID, "ACCESS_DECISION_INVALID"), signature: text(o.signature, HEX64, "ACCESS_DECISION_INVALID") }; if (Date.parse(result.evaluatedAt) >= Date.parse(result.expiresAt)) fail("ACCESS_DECISION_INVALID"); return result; }
function authorizeDecision(decisionInput: unknown, verifier: SignedVerifier<MessagingAccessDecision>, binding: { operation: AccessOperation; conversationId: string; messageId: string; actorProfileCommitment: string; actorDeviceId: string; sessionGeneration: number; keyEpoch: number }, now: string): MessagingAccessDecision { const decision = parseAccess(decisionInput); if (Date.parse(decision.evaluatedAt) > Date.parse(now) || Date.parse(decision.expiresAt) <= Date.parse(now)) fail("ACCESS_DECISION_EXPIRED"); const signed = frozen({ ...decision }); if (!verifier || verifier.verify(signed) !== true) fail("ACCESS_DECISION_SIGNATURE_INVALID"); if (decision.operation !== binding.operation || decision.conversationId !== binding.conversationId || decision.messageId !== binding.messageId || decision.actorProfileCommitment !== binding.actorProfileCommitment || decision.actorDeviceId !== binding.actorDeviceId || decision.sessionGeneration !== binding.sessionGeneration || decision.keyEpoch !== binding.keyEpoch) fail("ACCESS_DECISION_BINDING_MISMATCH"); if (!decision.deviceActive) fail("DEVICE_REVOKED"); if (binding.operation !== "TOMBSTONE") { if (decision.blocked) fail("MODERATION_BLOCKED"); if (!decision.audienceAllowed) fail("AUDIENCE_DENIED"); } return decision; }

export function rotateConversationCapability(currentInput: unknown, nextInput: unknown, verifier: SignedVerifier<ConversationCapability>, nowInput: unknown): Readonly<ConversationCapability> { const current = parseCapability(currentInput), next = parseCapability(nextInput), now = iso(nowInput, "CAPABILITY_INVALID"); if (Date.parse(current.expiresAt) <= Date.parse(now) || Date.parse(next.issuedAt) > Date.parse(now) || Date.parse(next.expiresAt) <= Date.parse(now)) fail("CAPABILITY_EXPIRED"); if (!verifier || verifier.verify(frozen({ ...current })) !== true || verifier.verify(frozen({ ...next })) !== true) fail("CAPABILITY_SIGNATURE_INVALID"); if (current.conversationId !== next.conversationId || current.participantAProfileCommitment !== next.participantAProfileCommitment || current.participantBProfileCommitment !== next.participantBProfileCommitment || current.activeProfileCommitment !== next.activeProfileCommitment || current.sessionGeneration !== next.sessionGeneration || next.keyEpoch !== current.keyEpoch + 1 || next.activeDeviceId === current.activeDeviceId || next.signature === current.signature || Date.parse(next.issuedAt) < Date.parse(current.issuedAt)) fail("CAPABILITY_ROTATION_INVALID"); return frozen({ ...next }); }

export interface MessageReceipt {
  schemaVersion: 1;
  receiptId: string;
  messageId: string;
  conversationId: string;
  kind: "DELIVER" | "READ" | "TOMBSTONE";
  actorProfileCommitment: string;
  actorDeviceId: string;
  sessionGeneration: number;
  keyEpoch: number;
  occurredAt: string;
  actorClass: "SYSTEM_TEST";
  signature: string;
}
const RECEIPT_KEYS = ["schemaVersion", "receiptId", "messageId", "conversationId", "kind", "actorProfileCommitment", "actorDeviceId", "sessionGeneration", "keyEpoch", "occurredAt", "actorClass", "signature"] as const;
function parseReceipt(value: unknown): MessageReceipt { const o = plain(value, RECEIPT_KEYS, "RECEIPT_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("RECEIPT_INVALID"); return { schemaVersion: 1, receiptId: text(o.receiptId, ID, "RECEIPT_INVALID"), messageId: text(o.messageId, ID, "RECEIPT_INVALID"), conversationId: text(o.conversationId, ID, "RECEIPT_INVALID"), kind: exact(o.kind, ["DELIVER", "READ", "TOMBSTONE"], "RECEIPT_INVALID"), actorProfileCommitment: text(o.actorProfileCommitment, HEX64, "RECEIPT_INVALID"), actorDeviceId: text(o.actorDeviceId, ID, "RECEIPT_INVALID"), sessionGeneration: integer(o.sessionGeneration, 1, "RECEIPT_INVALID"), keyEpoch: integer(o.keyEpoch, 1, "RECEIPT_INVALID"), occurredAt: iso(o.occurredAt, "RECEIPT_INVALID"), actorClass: "SYSTEM_TEST", signature: text(o.signature, HEX128, "RECEIPT_INVALID") }; }

export interface MessageProjection { schemaVersion: 1; messageId: string; conversationId: string; senderProfileCommitment: string; ciphertextCommitment: string; messageNonceCommitment: string; keyEpoch: number; state: MessageState; lastReceiptId: string | null; createdAt: string; updatedAt: string; actorClass: "SYSTEM_TEST" }
const PROJECTION_KEYS = ["schemaVersion", "messageId", "conversationId", "senderProfileCommitment", "ciphertextCommitment", "messageNonceCommitment", "keyEpoch", "state", "lastReceiptId", "createdAt", "updatedAt", "actorClass"] as const;
function parseProjection(value: unknown): MessageProjection { const o = plain(value, PROJECTION_KEYS, "MESSAGING_SNAPSHOT_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("MESSAGING_SNAPSHOT_INVALID"); const result: MessageProjection = { schemaVersion: 1, messageId: text(o.messageId, ID, "MESSAGING_SNAPSHOT_INVALID"), conversationId: text(o.conversationId, ID, "MESSAGING_SNAPSHOT_INVALID"), senderProfileCommitment: text(o.senderProfileCommitment, HEX64, "MESSAGING_SNAPSHOT_INVALID"), ciphertextCommitment: text(o.ciphertextCommitment, HEX64, "MESSAGING_SNAPSHOT_INVALID"), messageNonceCommitment: text(o.messageNonceCommitment, HEX64, "MESSAGING_SNAPSHOT_INVALID"), keyEpoch: integer(o.keyEpoch, 1, "MESSAGING_SNAPSHOT_INVALID"), state: exact(o.state, ["SENT", "DELIVERED", "READ", "TOMBSTONED"], "MESSAGING_SNAPSHOT_INVALID"), lastReceiptId: o.lastReceiptId === null ? null : text(o.lastReceiptId, ID, "MESSAGING_SNAPSHOT_INVALID"), createdAt: iso(o.createdAt, "MESSAGING_SNAPSHOT_INVALID"), updatedAt: iso(o.updatedAt, "MESSAGING_SNAPSHOT_INVALID"), actorClass: "SYSTEM_TEST" }; if (Date.parse(result.createdAt) > Date.parse(result.updatedAt) || (result.state === "SENT") !== (result.lastReceiptId === null)) fail("MESSAGING_SNAPSHOT_INVALID"); return result; }

export interface MessagingEvent { ordinal: number; kind: "SEND" | "RECEIPT" | "ROTATE"; send: SendEnvelope | null; receipt: MessageReceipt | null; previousCapability: ConversationCapability | null; capability: ConversationCapability; access: MessagingAccessDecision | null; fingerprint: string }
export interface MessagingSnapshot { schemaVersion: 1; nextOrdinal: number; events: MessagingEvent[]; messages: MessageProjection[]; checkpointHash: string }
const EVENT_KEYS = ["ordinal", "kind", "send", "receipt", "previousCapability", "capability", "access", "fingerprint"] as const;
function capabilityBinding(value: ConversationCapability): string { return CAPABILITY_KEYS.map((key) => String(value[key])).join("|"); }
function sendBinding(value: SendEnvelope): string { return SEND_KEYS.map((key) => String(value[key])).join("|"); }
function accessBinding(value: MessagingAccessDecision): string { return ACCESS_KEYS.map((key) => String(value[key])).join("|"); }
function receiptBinding(value: MessageReceipt): string { return RECEIPT_KEYS.map((key) => String(value[key])).join("|"); }
function projectionBinding(value: MessageProjection): string { return PROJECTION_KEYS.map((key) => String(value[key])).join("|"); }
function eventFingerprint(ordinal: number, kind: "SEND" | "RECEIPT" | "ROTATE", send: SendEnvelope | null, receipt: MessageReceipt | null, previousCapability: ConversationCapability | null, capability: ConversationCapability, access: MessagingAccessDecision | null): string { return [ordinal, kind, send === null ? "" : sendBinding(send), receipt === null ? "" : receiptBinding(receipt), previousCapability === null ? "" : capabilityBinding(previousCapability), capabilityBinding(capability), access === null ? "" : accessBinding(access)].join("|"); }

export class OneToOneMessagingFacade {
  private readonly messages = new Map<string, MessageProjection>();
  private readonly recipientProfiles = new Map<string, string>();
  private readonly conversationParticipants = new Map<string, string>();
  private readonly currentCapabilities = new Map<string, ConversationCapability>();
  private readonly receiptIds = new Set<string>();
  private readonly decisionIds = new Set<string>();
  private readonly events: MessagingEvent[] = [];
  private nextOrdinal = 1;
  private capabilityKey(value: ConversationCapability): string { return `${value.conversationId}|${value.activeProfileCommitment}`; }
  private participantBinding(value: ConversationCapability): string { return [value.participantAProfileCommitment, value.participantBProfileCommitment].sort().join("|"); }
  private assertConversationParticipants(value: ConversationCapability): void { const current = this.conversationParticipants.get(value.conversationId); if (current && current !== this.participantBinding(value)) fail("CONVERSATION_PARTICIPANTS_STALE"); }
  private assertCurrentCapability(value: ConversationCapability): void { const current = this.currentCapabilities.get(this.capabilityKey(value)); if (current && capabilityBinding(current) !== capabilityBinding(value)) fail("CAPABILITY_STALE"); }
  private rememberCapability(value: ConversationCapability): void { if (!this.currentCapabilities.has(this.capabilityKey(value))) this.currentCapabilities.set(this.capabilityKey(value), value); if (!this.conversationParticipants.has(value.conversationId)) this.conversationParticipants.set(value.conversationId, this.participantBinding(value)); }
  private append(kind: "SEND" | "RECEIPT" | "ROTATE", send: SendEnvelope | null, receipt: MessageReceipt | null, previousCapability: ConversationCapability | null, capability: ConversationCapability, access: MessagingAccessDecision | null): void { const ordinal = this.nextOrdinal++; this.events.push({ ordinal, kind, send, receipt, previousCapability, capability, access, fingerprint: eventFingerprint(ordinal, kind, send, receipt, previousCapability, capability, access) }); }
  rotate(currentInput: unknown, nextInput: unknown, verifier: SignedVerifier<ConversationCapability>, nowInput: unknown): Readonly<ConversationCapability> {
    const current = parseCapability(currentInput), next = rotateConversationCapability(current, nextInput, verifier, nowInput), key = this.capabilityKey(current), stored = this.currentCapabilities.get(key);
    if (!stored || capabilityBinding(stored) !== capabilityBinding(current)) fail("CAPABILITY_STALE");
    this.currentCapabilities.set(key, next); this.append("ROTATE", null, null, current, next, null); return frozen({ ...next });
  }
  send(sendInput: unknown, capabilityInput: unknown, accessInput: unknown, sendVerifier: SignedVerifier<SendEnvelope>, capabilityVerifier: SignedVerifier<ConversationCapability>, accessVerifier: SignedVerifier<MessagingAccessDecision>, nowInput: unknown): Readonly<MessageProjection> {
    const send = parseSend(sendInput), capability = parseCapability(capabilityInput), now = iso(nowInput, "SEND_TIME_INVALID");
    if (Date.parse(send.sentAt) > Date.parse(now) || Date.parse(capability.issuedAt) > Date.parse(now) || Date.parse(capability.expiresAt) <= Date.parse(now)) fail("CONTEXT_EXPIRED");
    const signedCapability = frozen({ ...capability }), signedSend = frozen({ ...send });
    if (!capabilityVerifier || capabilityVerifier.verify(signedCapability) !== true) fail("CAPABILITY_SIGNATURE_INVALID");
    if (!sendVerifier || sendVerifier.verify(signedSend) !== true) fail("SEND_SIGNATURE_INVALID");
    this.assertConversationParticipants(capability); this.assertCurrentCapability(capability);
    const participants = [capability.participantAProfileCommitment, capability.participantBProfileCommitment];
    if (send.conversationId !== capability.conversationId || send.senderProfileCommitment !== capability.activeProfileCommitment || send.sessionGeneration !== capability.sessionGeneration || send.senderDeviceId !== capability.activeDeviceId || send.keyEpoch !== capability.keyEpoch || !participants.includes(send.senderProfileCommitment) || !participants.includes(send.recipientProfileCommitment) || send.senderProfileCommitment === send.recipientProfileCommitment) fail("CONTEXT_STALE");
    const access = authorizeDecision(accessInput, accessVerifier, { operation: "SEND", conversationId: send.conversationId, messageId: send.messageId, actorProfileCommitment: send.senderProfileCommitment, actorDeviceId: send.senderDeviceId, sessionGeneration: send.sessionGeneration, keyEpoch: send.keyEpoch }, now);
    if (this.messages.has(send.messageId)) fail("MESSAGE_REPLAY");
    if (this.decisionIds.has(access.decisionId)) fail("ACCESS_DECISION_REPLAY");
    const projection: MessageProjection = { schemaVersion: 1, messageId: send.messageId, conversationId: send.conversationId, senderProfileCommitment: send.senderProfileCommitment, ciphertextCommitment: send.ciphertextCommitment, messageNonceCommitment: send.messageNonceCommitment, keyEpoch: send.keyEpoch, state: "SENT", lastReceiptId: null, createdAt: send.sentAt, updatedAt: send.sentAt, actorClass: "SYSTEM_TEST" };
    this.messages.set(send.messageId, projection);
    this.recipientProfiles.set(send.messageId, send.recipientProfileCommitment); this.rememberCapability(capability);
    this.decisionIds.add(access.decisionId); this.append("SEND", send, null, null, capability, access);
    return frozen({ ...projection });
  }
  transition(receiptInput: unknown, capabilityInput: unknown, accessInput: unknown, receiptVerifier: SignedVerifier<MessageReceipt>, capabilityVerifier: SignedVerifier<ConversationCapability>, accessVerifier: SignedVerifier<MessagingAccessDecision>, nowInput: unknown): Readonly<MessageProjection> {
    const receipt = parseReceipt(receiptInput), capability = parseCapability(capabilityInput), now = iso(nowInput, "RECEIPT_TIME_INVALID");
    if (Date.parse(receipt.occurredAt) > Date.parse(now) || Date.parse(capability.issuedAt) > Date.parse(now) || Date.parse(capability.expiresAt) <= Date.parse(now)) fail("CONTEXT_EXPIRED");
    if (!receiptVerifier || receiptVerifier.verify(frozen({ ...receipt })) !== true) fail("RECEIPT_SIGNATURE_INVALID");
    if (!capabilityVerifier || capabilityVerifier.verify(frozen({ ...capability })) !== true) fail("CAPABILITY_SIGNATURE_INVALID");
    this.assertConversationParticipants(capability); this.assertCurrentCapability(capability);
    const current = this.messages.get(receipt.messageId); if (!current) fail("MESSAGE_NOT_FOUND");
    const originalRecipient = this.recipientProfiles.get(receipt.messageId); if (!originalRecipient) fail("MESSAGE_LINEAGE_INVALID");
    if (Date.parse(receipt.occurredAt) < Date.parse(current.updatedAt)) fail("RECEIPT_TIME_INVALID");
    const operation: AccessOperation = receipt.kind === "DELIVER" ? "DELIVER" : receipt.kind === "READ" ? "READ" : "TOMBSTONE";
    if (receipt.conversationId !== current.conversationId || receipt.conversationId !== capability.conversationId || receipt.actorProfileCommitment !== capability.activeProfileCommitment || receipt.actorDeviceId !== capability.activeDeviceId || receipt.sessionGeneration !== capability.sessionGeneration || receipt.keyEpoch !== capability.keyEpoch) fail("CONTEXT_STALE");
    const participants = [capability.participantAProfileCommitment, capability.participantBProfileCommitment]; if (!participants.includes(current.senderProfileCommitment) || !participants.includes(receipt.actorProfileCommitment)) fail("CONTEXT_STALE");
    if ((receipt.kind === "DELIVER" || receipt.kind === "READ") && receipt.actorProfileCommitment !== originalRecipient) fail("RECEIPT_ACTOR_DENIED");
    if (receipt.kind === "TOMBSTONE" && receipt.actorProfileCommitment !== current.senderProfileCommitment) fail("RECEIPT_ACTOR_DENIED");
    const access = authorizeDecision(accessInput, accessVerifier, { operation, conversationId: receipt.conversationId, messageId: receipt.messageId, actorProfileCommitment: receipt.actorProfileCommitment, actorDeviceId: receipt.actorDeviceId, sessionGeneration: receipt.sessionGeneration, keyEpoch: receipt.keyEpoch }, now);
    if (this.receiptIds.has(receipt.receiptId)) fail("RECEIPT_REPLAY"); if (this.decisionIds.has(access.decisionId)) fail("ACCESS_DECISION_REPLAY");
    let state: MessageState;
    if (receipt.kind === "DELIVER") { if (current.state !== "SENT") fail("MESSAGE_STATE_CONFLICT"); state = "DELIVERED"; }
    else if (receipt.kind === "READ") { if (current.state !== "DELIVERED") fail("MESSAGE_STATE_CONFLICT"); state = "READ"; }
    else { if (current.state === "TOMBSTONED") fail("MESSAGE_STATE_CONFLICT"); state = "TOMBSTONED"; }
    const updated: MessageProjection = { ...current, state, lastReceiptId: receipt.receiptId, updatedAt: receipt.occurredAt };
    this.messages.set(receipt.messageId, updated); this.rememberCapability(capability); this.receiptIds.add(receipt.receiptId); this.decisionIds.add(access.decisionId); this.append("RECEIPT", null, receipt, null, capability, access);
    return frozen({ ...updated });
  }
  view(messageIdInput: unknown): Readonly<MessageProjection> | null { const value = this.messages.get(text(messageIdInput, ID, "MESSAGE_ID_INVALID")); return value ? frozen({ ...value }) : null; }
  snapshot(checkpointHashInput: unknown): Readonly<MessagingSnapshot> { const checkpointHash = text(checkpointHashInput, HEX64, "CHECKPOINT_HASH_INVALID"); return frozen({ schemaVersion: 1 as const, nextOrdinal: this.nextOrdinal, events: this.events.map((event) => ({ ...event, send: event.send === null ? null : { ...event.send }, receipt: event.receipt === null ? null : { ...event.receipt }, previousCapability: event.previousCapability === null ? null : { ...event.previousCapability }, capability: { ...event.capability }, access: event.access === null ? null : { ...event.access } })), messages: [...this.messages.values()].sort((a, b) => a.messageId.localeCompare(b.messageId)).map((message) => ({ ...message })), checkpointHash }); }
  static restore(input: unknown, sendVerifier: SignedVerifier<SendEnvelope>, receiptVerifier: SignedVerifier<MessageReceipt>, capabilityVerifier: SignedVerifier<ConversationCapability>, accessVerifier: SignedVerifier<MessagingAccessDecision>, checkpointVerifier: CheckpointVerifier<MessagingSnapshot>, nowInput: unknown): OneToOneMessagingFacade {
    const o = plain(input, ["schemaVersion", "nextOrdinal", "events", "messages", "checkpointHash"], "MESSAGING_SNAPSHOT_INVALID"); if (o.schemaVersion !== 1 || !sendVerifier || !receiptVerifier || !capabilityVerifier || !accessVerifier || !checkpointVerifier) fail("MESSAGING_SNAPSHOT_INVALID");
    const nextOrdinal = integer(o.nextOrdinal, 1, "MESSAGING_SNAPSHOT_INVALID"), checkpointHash = text(o.checkpointHash, HEX64, "MESSAGING_SNAPSHOT_INVALID"), now = iso(nowInput, "MESSAGING_SNAPSHOT_INVALID"), events: MessagingEvent[] = [], messages = (Array.isArray(o.messages) ? o.messages : fail("MESSAGING_SNAPSHOT_INVALID")).map(parseProjection); let expected = 1;
    if (new Set(messages.map((message) => message.messageId)).size !== messages.length || messages.some((message) => Date.parse(message.updatedAt) > Date.parse(now))) fail("MESSAGING_SNAPSHOT_INVALID");
    for (const item of Array.isArray(o.events) ? o.events : fail("MESSAGING_SNAPSHOT_INVALID")) { const row = plain(item, EVENT_KEYS, "MESSAGING_SNAPSHOT_INVALID"), ordinal = integer(row.ordinal, 1, "MESSAGING_SNAPSHOT_INVALID"), kind = exact(row.kind, ["SEND", "RECEIPT", "ROTATE"], "MESSAGING_SNAPSHOT_INVALID"), send = row.send === null ? null : parseSend(row.send), receipt = row.receipt === null ? null : parseReceipt(row.receipt), previousCapability = row.previousCapability === null ? null : parseCapability(row.previousCapability), capability = parseCapability(row.capability), access = row.access === null ? null : parseAccess(row.access), fingerprint = text(row.fingerprint, /^.{3,16384}$/, "MESSAGING_SNAPSHOT_INVALID"); const validShape = kind === "SEND" ? send !== null && receipt === null && previousCapability === null && access !== null : kind === "RECEIPT" ? send === null && receipt !== null && previousCapability === null && access !== null : send === null && receipt === null && previousCapability !== null && access === null; if (ordinal !== expected++ || !validShape || fingerprint !== eventFingerprint(ordinal, kind, send, receipt, previousCapability, capability, access)) fail("MESSAGING_SNAPSHOT_INVALID"); events.push({ ordinal, kind, send, receipt, previousCapability, capability, access, fingerprint }); }
    if (nextOrdinal !== expected) fail("MESSAGING_SNAPSHOT_INVALID");
    const candidate = frozen({ schemaVersion: 1 as const, nextOrdinal, events: events.map((event) => ({ ...event, send: event.send === null ? null : { ...event.send }, receipt: event.receipt === null ? null : { ...event.receipt }, previousCapability: event.previousCapability === null ? null : { ...event.previousCapability }, capability: { ...event.capability }, access: event.access === null ? null : { ...event.access } })), messages: messages.map((message) => ({ ...message })), checkpointHash }); if (checkpointVerifier.verify(candidate) !== true) fail("MESSAGING_CHECKPOINT_UNVERIFIED");
    const facade = new OneToOneMessagingFacade(); for (const event of events) { if (event.kind === "SEND" && event.send !== null && event.access !== null) facade.send(event.send, event.capability, event.access, sendVerifier, capabilityVerifier, accessVerifier, event.send.sentAt); else if (event.kind === "RECEIPT" && event.receipt !== null && event.access !== null) facade.transition(event.receipt, event.capability, event.access, receiptVerifier, capabilityVerifier, accessVerifier, event.receipt.occurredAt); else if (event.kind === "ROTATE" && event.previousCapability !== null) facade.rotate(event.previousCapability, event.capability, capabilityVerifier, event.capability.issuedAt); else fail("MESSAGING_SNAPSHOT_INVALID"); }
    const rebuilt = [...facade.messages.values()].sort((a, b) => a.messageId.localeCompare(b.messageId)); if (facade.nextOrdinal !== nextOrdinal || rebuilt.length !== messages.length || rebuilt.some((message, index) => projectionBinding(message) !== projectionBinding(messages[index])) || facade.events.some((event, index) => event.fingerprint !== events[index].fingerprint)) fail("MESSAGING_SNAPSHOT_INVALID"); return facade;
  }
}

export interface PrivateActionCommitment {
  schemaVersion: 1;
  actorCommitment: string;
  genericCommitment: string;
  payloadCommitment: string;
  saltEntropyBits: number;
  targetIncludedInClear: false;
  generatedOnUserDevice: true;
  actorClass: "SYSTEM_TEST";
}
const PRIVATE_KEYS = ["schemaVersion", "actorCommitment", "genericCommitment", "payloadCommitment", "saltEntropyBits", "targetIncludedInClear", "generatedOnUserDevice", "actorClass"] as const;
export function buildPrivateActionCommitment(value: unknown): Readonly<PrivateActionCommitment> { const o = plain(value, PRIVATE_KEYS, "PRIVATE_COMMITMENT_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST" || o.targetIncludedInClear !== false || o.generatedOnUserDevice !== true) fail("PRIVATE_COMMITMENT_INVALID"); const result: PrivateActionCommitment = { schemaVersion: 1, actorCommitment: text(o.actorCommitment, HEX64, "PRIVATE_COMMITMENT_INVALID"), genericCommitment: text(o.genericCommitment, HEX64, "PRIVATE_COMMITMENT_INVALID"), payloadCommitment: text(o.payloadCommitment, HEX64, "PRIVATE_COMMITMENT_INVALID"), saltEntropyBits: integer(o.saltEntropyBits, 128, "PRIVATE_COMMITMENT_INVALID"), targetIncludedInClear: false, generatedOnUserDevice: true, actorClass: "SYSTEM_TEST" }; if (result.genericCommitment === result.actorCommitment || result.genericCommitment === result.payloadCommitment) fail("PRIVATE_COMMITMENT_INVALID"); return frozen(result); }
