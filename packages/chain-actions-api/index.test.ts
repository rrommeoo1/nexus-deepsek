import {
  ActionLifecycleTracker, ChainPolicyError, NexusActionsSandbox, scanSerializedTransactionForPrivatePlaintext,
  selectRuntimeProfile, serializeEnvelopeForSigning, type ActionEnvelope, type CapabilityInput,
  type ExecutionContext, type NetworkCapabilityEvidence, type SignatureVerifier,
} from "./index";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(`ASSERT:${message}`); }
async function expectCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> {
  let actual = "NO_ERROR";
  try { await action(); } catch (error) { actual = error instanceof ChainPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}

class DelayedDeterministicVerifier implements SignatureVerifier {
  calls = 0;
  async sign(publicKey: string, message: Uint8Array): Promise<string> {
    const combined = new Uint8Array(publicKey.length + message.length);
    combined.set(new TextEncoder().encode(publicKey)); combined.set(message, publicKey.length);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", combined));
    return Array.from(hash, (value) => value.toString(16).padStart(2, "0")).join("").repeat(2);
  }
  async verifyEd25519(publicKeyHex: string, message: Uint8Array, signatureHex: string): Promise<boolean> {
    this.calls += 1;
    await Promise.resolve();
    return signatureHex === await this.sign(publicKeyHex, message);
  }
}

const now = 2_000_000;
const controller = "a".repeat(64);
const actor = "b".repeat(64);
const sessionKey = "c".repeat(64);
const relayer = `erd1${"r".repeat(58)}`;
const contractAddress = `erd1${"q".repeat(58)}`;
const verifier = new DelayedDeterministicVerifier();
const sandbox = new NexusActionsSandbox(verifier);
const capability: CapabilityInput = {
  controller, actorKind: "HUMAN", actorCommitment: actor, sessionPublicKey: sessionKey,
  scopes: ["SOCIAL_PUBLIC", "PRIVATE_COMMITMENT"], maxActions: 8,
  validFromMs: now - 1_000, expiresAtMs: now + 600_000, authorizedRelayers: [relayer],
};
const context: ExecutionContext = { chainId: "D", contractAddress, relayer, relayerAgreementVerified: true, nowMs: now, payments: [] };
function envelope(nonce: bigint, overrides: Partial<ActionEnvelope> = {}): ActionEnvelope {
  return {
    version: 1, actorKind: "HUMAN", actorCommitment: actor, actionType: "LIKE",
    objectCommitment: "d".repeat(64), payloadHashOrCid: "e".repeat(64), visibilityClass: "PUBLIC",
    actionNonce: nonce, issuedAtMs: now - 100, expiresAtMs: now + 60_000, sessionPublicKey: sessionKey,
    ...overrides,
  };
}
async function sign(value: ActionEnvelope, useContext = context): Promise<string> {
  return verifier.sign(value.sessionPublicKey, serializeEnvelopeForSigning(value, useContext.chainId, useContext.contractAddress));
}

async function main(): Promise<void> {
  await expectCode(() => Promise.resolve(sandbox.registerCapability(capability, "f".repeat(64), now)), "CONTROLLER_REQUIRED");
  sandbox.registerCapability(capability, controller, now);
  await expectCode(() => Promise.resolve(sandbox.registerCapability(capability, controller, now)), "CAPABILITY_ALREADY_EXISTS");

  const first = envelope(1n);
  const firstEvent = await sandbox.recordAction(first, await sign(first), context);
  assert(firstEvent.identifier === "ActionRecorded" && firstEvent.actionNonce === "1", "one public action emits one compact event");
  assert(sandbox.drainEvents().length === 1 && sandbox.drainEvents().length === 0, "event is emitted exactly once");
  await expectCode(async () => sandbox.recordAction(first, await sign(first), context), "ACTION_NONCE_REPLAY_OR_GAP");
  await expectCode(async () => sandbox.recordAction(envelope(3n), await sign(envelope(3n)), context), "ACTION_NONCE_REPLAY_OR_GAP");

  const concurrentA = envelope(2n);
  const concurrentB = envelope(2n, { payloadHashOrCid: "f".repeat(64) });
  const race = await Promise.allSettled([
    sandbox.recordAction(concurrentA, await sign(concurrentA), context),
    sandbox.recordAction(concurrentB, await sign(concurrentB), context),
  ]);
  assert(race.filter((result) => result.status === "fulfilled").length === 1, "concurrent nonce has one successful action");
  assert(race.filter((result) => result.status === "rejected" && result.reason instanceof ChainPolicyError && result.reason.code === "CAPABILITY_COMMIT_CONFLICT").length === 1, "concurrent nonce loser fails compare-and-swap");
  assert(sandbox.drainEvents().length === 1, "concurrent nonce emits exactly one event");

  const third = envelope(3n);
  const thirdSignature = await sign(third);
  await expectCode(() => sandbox.recordAction({ ...third, objectCommitment: "1".repeat(64) }, thirdSignature, context), "SESSION_SIGNATURE_INVALID");
  const wrongDomainSignature = await verifier.sign(sessionKey, serializeEnvelopeForSigning(third, "T", contractAddress));
  await expectCode(() => sandbox.recordAction(third, wrongDomainSignature, context), "SESSION_SIGNATURE_INVALID");
  await expectCode(async () => sandbox.recordAction(third, await sign(third), { ...context, relayerAgreementVerified: false }), "RELAYER_AGREEMENT_REQUIRED");
  await expectCode(async () => sandbox.recordAction(third, await sign(third), { ...context, payments: [{}] }), "ACTION_ENDPOINT_NONPAYABLE");
  await expectCode(() => sandbox.recordAction([third] as unknown as ActionEnvelope, thirdSignature, context), "BATCH_FORBIDDEN");

  await expectCode(() => Promise.resolve(sandbox.rotateCapability(sessionKey, { ...capability, sessionPublicKey: "1".repeat(64), scopes: ["SOCIAL_PUBLIC", "MARKET_PUBLIC"], maxActions: 1 }, controller, now)), "CAPABILITY_SCOPE_ESCALATION");
  await expectCode(() => Promise.resolve(sandbox.rotateCapability(sessionKey, { ...capability, sessionPublicKey: "1".repeat(64), expiresAtMs: capability.expiresAtMs + 1, maxActions: 1 }, controller, now)), "CAPABILITY_LIMIT_ESCALATION");

  const privateAction = envelope(3n, { actionType: "PRIVATE_ACTION", visibilityClass: "PRIVATE_COMMITMENT", objectCommitment: "9".repeat(64) });
  await expectCode(async () => sandbox.recordAction(privateAction, await sign(privateAction), context), "PRIVATE_ENDPOINT_REQUIRED");
  await expectCode(async () => sandbox.recordPrivateAction(privateAction.objectCommitment, privateAction, await sign(privateAction), context, { saltEntropyBits: 64, targetIncludedInClear: false, generatedOnUserDevice: true }), "PRIVATE_COMMITMENT_ATTESTATION_INVALID");
  const privateEvent = await sandbox.recordPrivateAction(privateAction.objectCommitment, privateAction, await sign(privateAction), context, { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true });
  assert(privateEvent.actionClass === "PRIVATE_ACTION" && privateEvent.objectCommitment === privateAction.objectCommitment, "private action exposes only generic commitment");
  assert(sandbox.drainEvents().length === 1, "private action emits one generic event");

  const serializedPrivate = new TextDecoder().decode(serializeEnvelopeForSigning(privateAction, context.chainId, context.contractAddress));
  assert(scanSerializedTransactionForPrivatePlaintext(serializedPrivate).length === 0, "valid private transaction contains no plaintext PII");
  assert(scanSerializedTransactionForPrivatePlaintext(`${serializedPrivate}\nname@example.invalid\nlatitude=44.4`).sort().join(",") === "coordinates,email", "privacy scanner detects injected PII fixtures");

  sandbox.pauseActionType("LIKE", true);
  const fourth = envelope(4n);
  await expectCode(async () => sandbox.recordAction(fourth, await sign(fourth), context), "ACTION_TYPE_PAUSED");
  sandbox.pauseRelayer(relayer, true);
  const share = envelope(4n, { actionType: "SHARE" });
  await expectCode(async () => sandbox.recordAction(share, await sign(share), context), "RELAYER_DENIED");

  const freshSandbox = new NexusActionsSandbox(verifier);
  freshSandbox.registerCapability({ ...capability, sessionPublicKey: "2".repeat(64), maxActions: 1 }, controller, now);
  const oneShot = envelope(1n, { sessionPublicKey: "2".repeat(64) });
  await freshSandbox.recordAction(oneShot, await sign(oneShot), context);
  const overLimit = envelope(2n, { sessionPublicKey: "2".repeat(64) });
  await expectCode(async () => freshSandbox.recordAction(overLimit, await sign(overLimit), context), "CAPABILITY_ACTION_LIMIT");
  freshSandbox.revokeCapability("2".repeat(64), controller);
  await expectCode(async () => freshSandbox.recordAction(overLimit, await sign(overLimit), context), "CAPABILITY_REVOKED");

  const hardeningSandbox = new NexusActionsSandbox(verifier);
  const hardeningKey = "3".repeat(64);
  hardeningSandbox.registerCapability({ ...capability, sessionPublicKey: hardeningKey, maxActions: 3 }, controller, now);
  const hardeningAction = envelope(1n, { sessionPublicKey: hardeningKey });
  await expectCode(() => hardeningSandbox.recordAction(hardeningAction, "bad", context), "SIGNATURE_FORMAT_INVALID");
  await expectCode(async () => hardeningSandbox.recordAction({ ...hardeningAction, actorCommitment: "4".repeat(64) }, await sign({ ...hardeningAction, actorCommitment: "4".repeat(64) }), context), "CAPABILITY_ACTOR_MISMATCH");
  const marketAction = { ...hardeningAction, actionType: "LISTING_CREATE" as const };
  await expectCode(async () => hardeningSandbox.recordAction(marketAction, await sign(marketAction), context), "CAPABILITY_SCOPE_DENIED");
  const staleAction = { ...hardeningAction, issuedAtMs: now - 600_000, expiresAtMs: now + 1 };
  await expectCode(async () => hardeningSandbox.recordAction(staleAction, await sign(staleAction), context), "ACTION_TTL_INVALID");
  const expiredAction = { ...hardeningAction, expiresAtMs: now };
  await expectCode(async () => hardeningSandbox.recordAction(expiredAction, await sign(expiredAction), context), "ACTION_TTL_INVALID");
  await expectCode(async () => hardeningSandbox.recordAction(hardeningAction, await sign(hardeningAction), { ...context, relayer: `erd1${"x".repeat(58)}` }), "RELAYER_DENIED");
  await expectCode(async () => hardeningSandbox.recordAction(hardeningAction, await sign(hardeningAction), { ...context, contractAddress: "erd1bad" }), "CONTRACT_ADDRESS_INVALID");
  await expectCode(async () => hardeningSandbox.recordAction({ ...hardeningAction, actorKind: "CHILD" as unknown as "HUMAN" }, await sign(hardeningAction), context), "ACTOR_KIND_FORBIDDEN");
  const privateMismatch = { ...hardeningAction, actionType: "PRIVATE_ACTION" as const, visibilityClass: "PRIVATE_COMMITMENT" as const, objectCommitment: "7".repeat(64) };
  await expectCode(async () => hardeningSandbox.recordPrivateAction("8".repeat(64), privateMismatch, await sign(privateMismatch), context, { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true }), "PRIVATE_ENVELOPE_INVALID");

  const revokeRaceSandbox = new NexusActionsSandbox(verifier);
  const revokeRaceKey = "5".repeat(64);
  revokeRaceSandbox.registerCapability({ ...capability, sessionPublicKey: revokeRaceKey }, controller, now);
  const revokeRaceAction = envelope(1n, { sessionPublicKey: revokeRaceKey });
  const revokePending = revokeRaceSandbox.recordAction(revokeRaceAction, await sign(revokeRaceAction), context);
  revokeRaceSandbox.revokeCapability(revokeRaceKey, controller);
  await expectCode(() => revokePending, "CAPABILITY_COMMIT_CONFLICT");
  assert(revokeRaceSandbox.drainEvents().length === 0, "revoke during verification emits no event");

  const pauseRaceSandbox = new NexusActionsSandbox(verifier);
  const pauseRaceKey = "6".repeat(64);
  pauseRaceSandbox.registerCapability({ ...capability, sessionPublicKey: pauseRaceKey }, controller, now);
  const pauseRaceAction = envelope(1n, { sessionPublicKey: pauseRaceKey, actionType: "SHARE" });
  const pausePending = pauseRaceSandbox.recordAction(pauseRaceAction, await sign(pauseRaceAction), context);
  pauseRaceSandbox.pauseActionType("SHARE", true);
  await expectCode(() => pausePending, "CAPABILITY_COMMIT_CONFLICT");
  assert(pauseRaceSandbox.drainEvents().length === 0, "pause during verification emits no event");

  const tracker = new ActionLifecycleTracker();
  tracker.queue(); tracker.submit(); tracker.observe("NETWORK_ACCEPTED", now + 1); tracker.observe("ORDERED_FINAL", now + 2);
  assert(tracker.snapshot().state === "ORDERED_FINAL" && !tracker.canApplyAuthoritativeDomainEffect(), "ordered final is not executed success");
  await expectCode(() => Promise.resolve(tracker.observe("EXECUTION_SUCCESS", now + 3, true)), "LIFECYCLE_TRANSITION_INVALID");
  tracker.observe("EXECUTION_STARTED", now + 3);
  await expectCode(() => Promise.resolve(tracker.observe("EXECUTION_SUCCESS", now + 4, false)), "EXECUTION_EVENT_REQUIRED");
  tracker.observe("EXECUTION_SUCCESS", now + 4, true);
  assert(tracker.snapshot().state === "EXECUTED_SUCCESS" && tracker.canApplyAuthoritativeDomainEffect(), "only verified execution authorizes domain effect");
  assert(tracker.snapshot().consensusTimestampMs !== tracker.snapshot().executionTimestampMs, "consensus and execution timestamps remain distinct");

  const failedTracker = new ActionLifecycleTracker();
  failedTracker.queue(); failedTracker.submit(); failedTracker.observe("NETWORK_ACCEPTED", now); failedTracker.observe("ORDERED_FINAL", now + 1); failedTracker.observe("EXECUTION_STARTED", now + 2); failedTracker.observe("EXECUTION_FAIL", now + 3);
  assert(failedTracker.snapshot().state === "EXECUTED_FAIL" && !failedTracker.canApplyAuthoritativeDomainEffect(), "execution failure remains non-authoritative");

  const evidence: NetworkCapabilityEvidence[] = [
    { sourceId: "gateway-a", chainId: "D", observedEpoch: 200, protocolVersion: "supernova-1", consensusExecutionDecoupled: true, executionResultMode: "ASYNC_INCLUDED", relayedV3: true, observedAtMs: now },
    { sourceId: "gateway-b", chainId: "D", observedEpoch: 200, protocolVersion: "supernova-1", consensusExecutionDecoupled: true, executionResultMode: "ASYNC_INCLUDED", relayedV3: true, observedAtMs: now },
  ];
  assert(selectRuntimeProfile(evidence, "D", now + 1) === "SUPERNOVA", "two consistent fresh sources activate Supernova");
  assert(selectRuntimeProfile([evidence[0]], "D", now + 1) === "ANDROMEDA_COMPAT", "one source cannot activate Supernova");
  assert(selectRuntimeProfile([evidence[0], { ...evidence[1], observedEpoch: 201 }], "D", now + 1) === "ANDROMEDA_COMPAT", "divergent evidence falls back safely");
  assert(selectRuntimeProfile(evidence, "D", now + 60_001) === "ANDROMEDA_COMPAT", "stale evidence falls back safely");

  const gas = sandbox.getGasSnapshot(privateAction, context.chainId, context.contractAddress);
  assert(gas.model === "SYNTHETIC_REGRESSION_ONLY" && gas.actualVmMeasurementRequired, "synthetic gas cannot be mislabeled as VM measurement");
  assert(gas.withinBudget && gas.estimatedUnits <= gas.maximumUnits, "synthetic action gas stays inside declared budget");
  const snapshot = sandbox.getCapabilitySnapshot(sessionKey);
  assert(snapshot.usedActions === 3 && snapshot.lastActionNonce === "3", "capability stores only bounded validation state");

  console.log(JSON.stringify({ task_id: "NX-CHAIN-001", status: "PASS", assertions, signature_checks: verifier.calls, concurrent_nonce_cas: true, ordered_not_executed: true, private_payload_findings: 0, runtime_quorum_fallback: true, gas_model: gas.model, actual_vm_pending: true, synthetic_only: true }));
}

void main();
