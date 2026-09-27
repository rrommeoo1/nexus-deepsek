import { ConversationCapability, MessageReceipt, MessagingAccessDecision, MessagingPolicyError, OneToOneMessagingFacade, SendEnvelope, buildPrivateActionCommitment, rotateConversationCapability } from "./index";
import { NexusActionsSandbox, ActionEnvelope } from "../../chain-actions-api/index";
import { ChainReducer, IndexedChainEvent, EventAuthenticityVerifier, RepairAuthorizationVerifier, RepairCommitStore, serializeObservationForVerification, serializePayloadForVerification } from "../../chain-adapter/api/index";
declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof MessagingPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
class DeterministicIssuer<T extends object> {
  private readonly bindings = new Set<string>();
  issue(value: T): T { this.bindings.add(JSON.stringify(value)); return value; }
  verify(value: Readonly<T>): boolean { return this.bindings.has(JSON.stringify(value)); }
}
const capabilityIssuer = new DeterministicIssuer<ConversationCapability>(), sendIssuer = new DeterministicIssuer<SendEnvelope>(), accessIssuer = new DeterministicIssuer<MessagingAccessDecision>(), receiptIssuer = new DeterministicIssuer<MessageReceipt>();
const A = "1".repeat(64), B = "2".repeat(64), C = "3".repeat(64), DEVICE_KEY = "3".repeat(64), GENERIC = "4".repeat(64), PAYLOAD = "5".repeat(64), CIPHER = "6".repeat(64), NONCE = "7".repeat(64), H = "a".repeat(64), NOW = "2026-08-09T21:00:00Z", NOW_MS = Date.parse(NOW);
const capability: ConversationCapability = capabilityIssuer.issue({ schemaVersion: 1, conversationId: "CONVERSATION:1", participantAProfileCommitment: A, participantBProfileCommitment: B, activeProfileCommitment: A, sessionGeneration: 4, activeDeviceId: "DEVICE:1", keyEpoch: 2, issuedAt: "2026-08-09T20:00:00Z", expiresAt: "2026-08-09T22:00:00Z", actorClass: "SYSTEM_TEST", issuerKeyId: "KEY:CONVERSATION:1", signature: H });
const send: SendEnvelope = sendIssuer.issue({ schemaVersion: 1, messageId: "MESSAGE:1", conversationId: capability.conversationId, senderProfileCommitment: A, recipientProfileCommitment: B, senderDeviceId: capability.activeDeviceId, sessionGeneration: 4, keyEpoch: 2, ciphertextCommitment: CIPHER, messageNonceCommitment: NONCE, sentAt: NOW, actorClass: "SYSTEM_TEST", signature: "b".repeat(128) });
const recipientCapability: ConversationCapability = capabilityIssuer.issue({ ...capability, activeProfileCommitment: B, activeDeviceId: "DEVICE:2", signature: "d".repeat(64) });
const capabilityVerifier = capabilityIssuer, sendVerifier = sendIssuer, accessVerifier = accessIssuer, receiptVerifier = receiptIssuer;
function access(messageId: string, overrides: Partial<MessagingAccessDecision> = {}): MessagingAccessDecision { return accessIssuer.issue({ schemaVersion: 1, decisionId: `DECISION:${messageId}`, operation: "SEND", conversationId: capability.conversationId, messageId, actorProfileCommitment: A, actorDeviceId: capability.activeDeviceId, sessionGeneration: 4, keyEpoch: 2, blocked: false, audienceAllowed: true, deviceActive: true, evaluatedAt: NOW, expiresAt: "2026-08-09T21:05:00Z", actorClass: "SYSTEM_TEST", issuerKeyId: "KEY:POLICY:1", signature: H, ...overrides }); }
function receipt(receiptId: string, kind: MessageReceipt["kind"], actor: "SENDER" | "RECIPIENT", occurredAt: string): MessageReceipt { const cap = actor === "SENDER" ? capability : recipientCapability; return receiptIssuer.issue({ schemaVersion: 1, receiptId, messageId: send.messageId, conversationId: send.conversationId, kind, actorProfileCommitment: cap.activeProfileCommitment, actorDeviceId: cap.activeDeviceId, sessionGeneration: cap.sessionGeneration, keyEpoch: cap.keyEpoch, occurredAt, actorClass: "SYSTEM_TEST", signature: "e".repeat(128) }); }
function receiptAccess(value: MessageReceipt, overrides: Partial<MessagingAccessDecision> = {}): MessagingAccessDecision { return access(value.messageId, { decisionId: `DECISION:${value.receiptId}`, operation: value.kind === "DELIVER" ? "DELIVER" : value.kind === "READ" ? "READ" : "TOMBSTONE", actorProfileCommitment: value.actorProfileCommitment, actorDeviceId: value.actorDeviceId, sessionGeneration: value.sessionGeneration, keyEpoch: value.keyEpoch, evaluatedAt: value.occurredAt, expiresAt: "2026-08-09T21:05:00Z", ...overrides }); }

class Authenticity implements EventAuthenticityVerifier {
  private payload = ""; private observation = "";
  register(value: IndexedChainEvent): IndexedChainEvent { this.payload = serializePayloadForVerification(value.payload); this.observation = serializeObservationForVerification(value); return value; }
  verifyFinalizedObservation(value: IndexedChainEvent): boolean { return this.payload === serializePayloadForVerification(value.payload) && this.observation === serializeObservationForVerification(value); }
}

async function main(): Promise<void> {
  const facade = new OneToOneMessagingFacade();
  const stored = facade.send(send, capability, access(send.messageId), sendVerifier, capabilityVerifier, accessVerifier, NOW);
  assert(stored.state === "SENT" && stored.ciphertextCommitment === CIPHER, "allowed profiles store only ciphertext commitment");
  const serviceJson = JSON.stringify(stored);
  assert(!serviceJson.includes("recipientProfileCommitment") && !serviceJson.includes("plaintext") && !serviceJson.includes("ciphertextBase64"), "service projection excludes recipient and message material");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:BLOCKED" }, capability, access("MESSAGE:BLOCKED", { blocked: true }), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "MODERATION_BLOCKED");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:AUDIENCE" }, capability, access("MESSAGE:AUDIENCE", { audienceAllowed: false }), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "AUDIENCE_DENIED");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:DEVICE" }, capability, access("MESSAGE:DEVICE", { deviceActive: false }), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "DEVICE_REVOKED");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:STALE", sessionGeneration: 3 }, capability, access("MESSAGE:STALE"), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "CONTEXT_STALE");
  expectCode(() => facade.send(send, capability, access(send.messageId), sendVerifier, capabilityVerifier, accessVerifier, NOW), "MESSAGE_REPLAY");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:EXTRA", plaintext: "never" }, capability, access("MESSAGE:EXTRA"), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "SEND_INVALID");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:POLICY" }, capability, access("MESSAGE:OTHER"), { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "ACCESS_DECISION_BINDING_MISMATCH");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:BOOL" }, capability, { ...access("MESSAGE:BOOL"), blocked: "false" }, { verify: () => true }, capabilityVerifier, accessVerifier, NOW), "ACCESS_DECISION_INVALID");
  expectCode(() => facade.send({ ...send, messageId: "MESSAGE:FORGED" }, capability, access("MESSAGE:FORGED"), sendVerifier, capabilityVerifier, accessVerifier, NOW), "SEND_SIGNATURE_INVALID");
  const rotated = capabilityIssuer.issue({ ...capability, activeDeviceId: "DEVICE:2", keyEpoch: 3, issuedAt: NOW, signature: "c".repeat(64) });
  assert(rotateConversationCapability(capability, rotated, capabilityVerifier, NOW).keyEpoch === 3, "device key rotation advances exactly one epoch");
  expectCode(() => rotateConversationCapability(capability, capabilityIssuer.issue({ ...rotated, keyEpoch: 4 }), capabilityVerifier, NOW), "CAPABILITY_ROTATION_INVALID");

  const deliveredReceipt = receipt("RECEIPT:DELIVER:1", "DELIVER", "RECIPIENT", "2026-08-09T21:01:00Z");
  expectCode(() => facade.transition(deliveredReceipt, recipientCapability, receiptAccess(deliveredReceipt, { blocked: true }), receiptVerifier, capabilityVerifier, accessVerifier, deliveredReceipt.occurredAt), "MODERATION_BLOCKED");
  const substitutedCapability = capabilityIssuer.issue({ ...recipientCapability, participantBProfileCommitment: C, activeProfileCommitment: C, activeDeviceId: "DEVICE:3", signature: "9".repeat(64) });
  const substitutedReceipt = receiptIssuer.issue({ ...deliveredReceipt, receiptId: "RECEIPT:DELIVER:SUBSTITUTED", actorProfileCommitment: C, actorDeviceId: "DEVICE:3", signature: "8".repeat(128) });
  expectCode(() => facade.transition(substitutedReceipt, substitutedCapability, receiptAccess(substitutedReceipt), receiptVerifier, capabilityVerifier, accessVerifier, substitutedReceipt.occurredAt), "CONVERSATION_PARTICIPANTS_STALE");
  const senderDelivery = receiptIssuer.issue({ ...deliveredReceipt, receiptId: "RECEIPT:DELIVER:SENDER", actorProfileCommitment: A, actorDeviceId: capability.activeDeviceId });
  expectCode(() => facade.transition(senderDelivery, capability, receiptAccess(senderDelivery), receiptVerifier, capabilityVerifier, accessVerifier, deliveredReceipt.occurredAt), "RECEIPT_ACTOR_DENIED");
  assert(facade.transition(deliveredReceipt, recipientCapability, receiptAccess(deliveredReceipt), receiptVerifier, capabilityVerifier, accessVerifier, deliveredReceipt.occurredAt).state === "DELIVERED", "recipient delivery advances state");
  const secondDelivery = receiptIssuer.issue({ ...deliveredReceipt, receiptId: "RECEIPT:DELIVER:2" });
  expectCode(() => facade.transition(secondDelivery, recipientCapability, receiptAccess(deliveredReceipt), receiptVerifier, capabilityVerifier, accessVerifier, deliveredReceipt.occurredAt), "ACCESS_DECISION_REPLAY");
  const outOfOrderRead = receipt("RECEIPT:READ:OLD", "READ", "RECIPIENT", "2026-08-09T21:00:30Z");
  expectCode(() => facade.transition(outOfOrderRead, recipientCapability, receiptAccess(outOfOrderRead), receiptVerifier, capabilityVerifier, accessVerifier, deliveredReceipt.occurredAt), "RECEIPT_TIME_INVALID");
  const readReceipt = receipt("RECEIPT:READ:1", "READ", "RECIPIENT", "2026-08-09T21:02:00Z");
  expectCode(() => facade.transition(readReceipt, recipientCapability, receiptAccess(readReceipt, { deviceActive: false }), receiptVerifier, capabilityVerifier, accessVerifier, readReceipt.occurredAt), "DEVICE_REVOKED");
  assert(facade.transition(readReceipt, recipientCapability, receiptAccess(readReceipt), receiptVerifier, capabilityVerifier, accessVerifier, readReceipt.occurredAt).state === "READ", "recipient read advances state");
  const badTombstone = receipt("RECEIPT:TOMBSTONE:BAD", "TOMBSTONE", "RECIPIENT", "2026-08-09T21:03:00Z");
  expectCode(() => facade.transition(badTombstone, recipientCapability, receiptAccess(badTombstone), receiptVerifier, capabilityVerifier, accessVerifier, badTombstone.occurredAt), "RECEIPT_ACTOR_DENIED");
  const tombstone = receipt("RECEIPT:TOMBSTONE:1", "TOMBSTONE", "SENDER", "2026-08-09T21:03:00Z");
  assert(facade.transition(tombstone, capability, receiptAccess(tombstone, { blocked: true, audienceAllowed: false }), receiptVerifier, capabilityVerifier, accessVerifier, tombstone.occurredAt).state === "TOMBSTONED", "sender tombstone remains available after block");
  assert(facade.rotate(capability, rotated, capabilityVerifier, NOW).keyEpoch === 3, "facade persists promoted device and key epoch");
  expectCode(() => facade.rotate(capability, rotated, capabilityVerifier, NOW), "CAPABILITY_STALE");
  const staleAfterRotation = sendIssuer.issue({ ...send, messageId: "MESSAGE:STALE:AFTER:ROTATION" });
  expectCode(() => facade.send(staleAfterRotation, capability, access(staleAfterRotation.messageId), sendVerifier, capabilityVerifier, accessVerifier, "2026-08-09T21:04:00Z"), "CAPABILITY_STALE");
  const sendAfterRotation = sendIssuer.issue({ ...send, messageId: "MESSAGE:AFTER:ROTATION", senderDeviceId: rotated.activeDeviceId, keyEpoch: rotated.keyEpoch, sentAt: "2026-08-09T21:04:00Z" });
  assert(facade.send(sendAfterRotation, rotated, access(sendAfterRotation.messageId, { actorDeviceId: rotated.activeDeviceId, keyEpoch: rotated.keyEpoch, evaluatedAt: sendAfterRotation.sentAt }), sendVerifier, capabilityVerifier, accessVerifier, sendAfterRotation.sentAt).state === "SENT", "new device and epoch work after rotation");
  const snapshot = facade.snapshot("f".repeat(64)), canonicalSnapshot = JSON.stringify(snapshot);
  const restored = OneToOneMessagingFacade.restore(snapshot, sendVerifier, receiptVerifier, capabilityVerifier, accessVerifier, { verify: (candidate) => JSON.stringify(candidate) === canonicalSnapshot }, "2026-08-09T21:30:00Z");
  assert(restored.view(send.messageId)?.state === "TOMBSTONED", "message lifecycle survives verified restart");
  expectCode(() => restored.send(sendAfterRotation, rotated, access(sendAfterRotation.messageId, { actorDeviceId: rotated.activeDeviceId, keyEpoch: rotated.keyEpoch, evaluatedAt: sendAfterRotation.sentAt }), sendVerifier, capabilityVerifier, accessVerifier, sendAfterRotation.sentAt), "MESSAGE_REPLAY");
  const tombstoneReplayCurrent = receiptIssuer.issue({ ...tombstone, actorDeviceId: rotated.activeDeviceId, keyEpoch: rotated.keyEpoch, signature: "7".repeat(128) });
  expectCode(() => restored.transition(tombstoneReplayCurrent, rotated, receiptAccess(tombstoneReplayCurrent), receiptVerifier, capabilityVerifier, accessVerifier, tombstoneReplayCurrent.occurredAt), "RECEIPT_REPLAY");
  expectCode(() => restored.send(staleAfterRotation, capability, access(staleAfterRotation.messageId), sendVerifier, capabilityVerifier, accessVerifier, "2026-08-09T21:04:00Z"), "CAPABILITY_STALE");
  const substitutedAfterRestart = receiptIssuer.issue({ ...substitutedReceipt, receiptId: "RECEIPT:DELIVER:SUBSTITUTED:RESTART", messageId: sendAfterRotation.messageId, keyEpoch: substitutedCapability.keyEpoch, occurredAt: "2026-08-09T21:04:30Z", signature: "6".repeat(128) });
  expectCode(() => restored.transition(substitutedAfterRestart, substitutedCapability, receiptAccess(substitutedAfterRestart), receiptVerifier, capabilityVerifier, accessVerifier, substitutedAfterRestart.occurredAt), "CONVERSATION_PARTICIPANTS_STALE");
  expectCode(() => OneToOneMessagingFacade.restore({ ...snapshot, messages: snapshot.messages.map((message) => ({ ...message, state: "READ" })) }, sendVerifier, receiptVerifier, capabilityVerifier, accessVerifier, { verify: () => true }, "2026-08-09T21:30:00Z"), "MESSAGING_SNAPSHOT_INVALID");
  expectCode(() => OneToOneMessagingFacade.restore({ ...snapshot, events: snapshot.events.slice(0, -1) }, sendVerifier, receiptVerifier, capabilityVerifier, accessVerifier, { verify: () => true }, "2026-08-09T21:30:00Z"), "MESSAGING_SNAPSHOT_INVALID");
  expectCode(() => OneToOneMessagingFacade.restore(snapshot, sendVerifier, receiptVerifier, capabilityVerifier, accessVerifier, { verify: () => false }, "2026-08-09T21:30:00Z"), "MESSAGING_CHECKPOINT_UNVERIFIED");

  const privateCommitment = buildPrivateActionCommitment({ schemaVersion: 1, actorCommitment: A, genericCommitment: GENERIC, payloadCommitment: PAYLOAD, saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true, actorClass: "SYSTEM_TEST" });
  expectCode(() => buildPrivateActionCommitment({ ...privateCommitment, targetIncludedInClear: true }), "PRIVATE_COMMITMENT_INVALID");
  expectCode(() => buildPrivateActionCommitment({ ...privateCommitment, saltEntropyBits: 64 }), "PRIVATE_COMMITMENT_INVALID");

  const sandbox = new NexusActionsSandbox({ async verifyEd25519() { return true; } });
  const relayer = `erd1${"r".repeat(58)}`, contractAddress = `erd1${"q".repeat(58)}`;
  sandbox.registerCapability({ controller: "8".repeat(64), actorKind: "HUMAN", actorCommitment: A, sessionPublicKey: DEVICE_KEY, scopes: ["PRIVATE_COMMITMENT"], maxActions: 1, validFromMs: NOW_MS - 1_000, expiresAtMs: NOW_MS + 60_000, authorizedRelayers: [relayer] }, "8".repeat(64), NOW_MS);
  const envelope: ActionEnvelope = { version: 1, actorKind: "HUMAN", actorCommitment: A, actionType: "PRIVATE_ACTION", objectCommitment: GENERIC, payloadHashOrCid: PAYLOAD, visibilityClass: "PRIVATE_COMMITMENT", actionNonce: 1n, issuedAtMs: NOW_MS - 100, expiresAtMs: NOW_MS + 10_000, sessionPublicKey: DEVICE_KEY };
  const chainEvent = await sandbox.recordPrivateAction(GENERIC, envelope, "f".repeat(128), { chainId: "D", contractAddress, relayer, relayerAgreementVerified: true, nowMs: NOW_MS, payments: [] }, { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true });
  const publicJson = JSON.stringify(chainEvent);
  assert(chainEvent.actionClass === "PRIVATE_ACTION" && chainEvent.objectCommitment === GENERIC, "chain receives one generic private action commitment");
  assert(!publicJson.includes(B) && !publicJson.includes(CIPHER) && !publicJson.includes(NONCE) && !publicJson.includes("MESSAGE:1"), "chain event excludes target ciphertext nonce and message id");

  const authenticity = new Authenticity();
  const indexed = authenticity.register({ network: "devnet", contractAddress, originalTxHash: "9".repeat(64), sourceTxHash: "a".repeat(64), sourceKind: "SMART_CONTRACT_RESULT", eventIndex: 0, shard: 1, blockNonce: 10n, blockHash: "b".repeat(64), hyperblockNonce: 11n, hyperblockHash: "c".repeat(64), canonicality: "FINALIZED_CANONICAL", finality: "HYPERBLOCK_FINAL", contentHash: "d".repeat(64), authenticityProofHash: "e".repeat(64), payload: { kind: "ACTION_EXECUTED", aggregateId: "PRIVATE_ACTION_1", aggregateVersion: 1, actorCommitment: chainEvent.actorCommitment, objectCommitment: chainEvent.objectCommitment, actionClass: "PRIVATE_ACTION", status: "EXECUTED_SUCCESS" } });
  const repairVerifier: RepairAuthorizationVerifier = { verifyRepairAuthorization() { return false; } };
  const repairStore: RepairCommitStore = { commitRepairAtomically() { return "COMMITTED"; } };
  const reducer = new ChainReducer(authenticity, repairVerifier, repairStore);
  assert(reducer.ingest(indexed) === "APPLIED", "final private action reaches reducer");
  const reduced = reducer.snapshot();
  assert(reduced.actions.length === 1 && reduced.actions[0].status === "EXECUTED_SUCCESS" && reduced.actions[0].actionClass === "PRIVATE_ACTION" && reduced.reconciliation.status === "PASS", "private action is terminal and reconciled");

  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-CHAT-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", e2ee_boundary: { service_plaintext_fields: 0, chain_target_fields: 0, chain_ciphertext_fields: 0 }, chain: { action_class: "PRIVATE_ACTION", terminal: true, reconciled: true }, lifecycle: { sent: true, delivered: true, read: true, tombstoned: true, restored: true }, negative: { block_before_send: true, block_before_delivery: true, audience_before_send: true, revoked_device_denied: true, revoked_device_read_denied: true, stale_profile_generation_denied: true, sender_delivery_receipt_denied: true, recipient_tombstone_denied: true, recipient_substitution_denied: true, recipient_substitution_denied_after_restart: true, out_of_order_receipt_denied: true, duplicate_rotation_denied: true, old_capability_denied_after_rotation: true, old_capability_denied_after_restart: true, message_replay_denied_after_restart: true, receipt_replay_denied_after_restart: true, access_decision_replay_denied: true, snapshot_lineage_tamper_denied: true, checkpoint_required: true, plaintext_field_denied: true, policy_binding_substitution_denied: true, policy_boolean_string_denied: true, key_epoch_skip_denied: true, clear_target_attestation_denied: true, weak_entropy_denied: true }, network_operations: 0, economic_operations: 0, external_provider_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}
void main();
