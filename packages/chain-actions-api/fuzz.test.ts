import {
  ActionLifecycleTracker, ChainPolicyError, NexusActionsSandbox,
  scanSerializedTransactionForPrivatePlaintext, type ActionEnvelope,
  type CapabilityInput, type ExecutionContext, type SignatureVerifier,
} from "./index";

const TASK_ID = "NX-CHAIN-001";
const CASES_PER_SEED = 512;
const FIXED_SEEDS = [
  0x1a2b3c4d, 0x5e6f7788, 0x90abcdef, 0x13579bdf,
  0x2468ace0, 0xc001d00d, 0x0badf00d, 0xdeadbeef,
] as const;
const CATEGORIES = [
  "envelope_shape", "ttl_expiry", "nonce_replay_gap", "capability_scope",
  "relayer_context", "capability_rotation", "lifecycle_finality", "privacy_batch",
] as const;
type Category = typeof CATEGORIES[number];

interface FailureReplay {
  vector_id: string;
  vector_sha256: string;
  seed: string;
  category: Category;
  variant: number;
  expected: string;
  actual: string;
}

class AcceptingVerifier implements SignatureVerifier {
  async verifyEd25519(): Promise<boolean> { return true; }
}

class XorShift32 {
  constructor(private state: number) { this.state >>>= 0; }
  next(): number {
    let value = this.state;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }
}

const now = 2_000_000;
const controller = "a".repeat(64);
const actor = "b".repeat(64);
const sessionKey = "c".repeat(64);
const relayer = `erd1${"r".repeat(58)}`;
const alternateRelayer = `erd1${"x".repeat(58)}`;
const contractAddress = `erd1${"q".repeat(58)}`;
const signature = "f".repeat(128);
const verifier = new AcceptingVerifier();

function capability(overrides: Partial<CapabilityInput> = {}): CapabilityInput {
  return {
    controller, actorKind: "HUMAN", actorCommitment: actor, sessionPublicKey: sessionKey,
    scopes: ["SOCIAL_PUBLIC", "PRIVATE_COMMITMENT"], maxActions: 4,
    validFromMs: now - 1_000, expiresAtMs: now + 600_000,
    authorizedRelayers: [relayer], ...overrides,
  };
}

function context(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    chainId: "D", contractAddress, relayer, relayerAgreementVerified: true,
    nowMs: now, payments: [], ...overrides,
  };
}

function envelope(overrides: Partial<ActionEnvelope> = {}): ActionEnvelope {
  return {
    version: 1, actorKind: "HUMAN", actorCommitment: actor, actionType: "LIKE",
    objectCommitment: "d".repeat(64), payloadHashOrCid: "e".repeat(64),
    visibilityClass: "PUBLIC", actionNonce: 1n, issuedAtMs: now - 100,
    expiresAtMs: now + 60_000, sessionPublicKey: sessionKey, ...overrides,
  };
}

function sandboxWith(input: CapabilityInput = capability()): NexusActionsSandbox {
  const sandbox = new NexusActionsSandbox(verifier);
  sandbox.registerCapability(input, input.controller, now);
  return sandbox;
}

async function capture(action: () => unknown | Promise<unknown>): Promise<string> {
  try { await action(); return "NO_ERROR"; }
  catch (error) { return error instanceof ChainPolicyError ? error.code : `UNEXPECTED:${String(error)}`; }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (item) => item.toString(16).padStart(2, "0")).join("");
}

async function runEnvelopeShape(variant: number): Promise<[string, string]> {
  const mutations: Array<[Partial<ActionEnvelope>, string]> = [
    [{ version: 2 as 1 }, "ENVELOPE_VERSION_INVALID"],
    [{ actorKind: "CHILD" as "HUMAN" }, "ACTOR_KIND_FORBIDDEN"],
    [{ actorCommitment: "bad" }, "ACTOR_COMMITMENT_INVALID"],
    [{ objectCommitment: "bad" }, "OBJECT_COMMITMENT_INVALID"],
    [{ payloadHashOrCid: "bad" }, "PAYLOAD_COMMITMENT_INVALID"],
    [{ sessionPublicKey: "bad" }, "SESSION_KEY_INVALID"],
    [{ actionType: "UNKNOWN" as "LIKE" }, "ACTION_TYPE_INVALID"],
    [{ visibilityClass: "UNKNOWN" as "PUBLIC" }, "VISIBILITY_INVALID"],
    [{ actionNonce: 0n }, "ACTION_NONCE_INVALID"],
    [{ issuedAtMs: now - 0.5 }, "ACTION_TIME_INVALID"],
  ];
  const [mutation, expected] = mutations[variant % mutations.length];
  const actual = await capture(() => sandboxWith().recordAction(envelope(mutation), signature, context()));
  return [expected, actual];
}

async function runTtlExpiry(variant: number): Promise<[string, string]> {
  const sandbox = sandboxWith();
  const index = variant % 8;
  let action = envelope();
  let execution = context();
  let expected = "ACTION_TTL_INVALID";
  if (index === 0) action = envelope({ issuedAtMs: now + 1 });
  if (index === 1) action = envelope({ expiresAtMs: now });
  if (index === 2) action = envelope({ issuedAtMs: now - 1, expiresAtMs: now + 300_001 });
  if (index === 3) { action = envelope({ expiresAtMs: now + 600_001 }); expected = "CAPABILITY_EXPIRED"; }
  if (index === 4) { execution = context({ nowMs: now + 600_000 }); expected = "CAPABILITY_EXPIRED"; }
  if (index === 5) action = envelope({ issuedAtMs: now + 50, expiresAtMs: now + 100 });
  if (index === 6) { execution = context({ nowMs: now + 60_001 }); action = envelope({ expiresAtMs: now + 60_001 }); }
  if (index === 7) action = envelope({ issuedAtMs: now - 300_001, expiresAtMs: now + 1 });
  return [expected, await capture(() => sandbox.recordAction(action, signature, execution))];
}

async function runNonce(variant: number): Promise<[string, string]> {
  const sandbox = sandboxWith();
  const index = variant % 4;
  if (index === 0) return ["ACTION_NONCE_REPLAY_OR_GAP", await capture(() => sandbox.recordAction(envelope({ actionNonce: 2n }), signature, context()))];
  if (index === 1) {
    await sandbox.recordAction(envelope(), signature, context()); sandbox.drainEvents();
    return ["ACTION_NONCE_REPLAY_OR_GAP", await capture(() => sandbox.recordAction(envelope(), signature, context()))];
  }
  if (index === 2) return ["ACTION_NONCE_INVALID", await capture(() => sandbox.recordAction(envelope({ actionNonce: -1n }), signature, context()))];
  return ["ACTION_NONCE_INVALID", await capture(() => sandbox.recordAction(envelope({ actionNonce: 1 as unknown as bigint }), signature, context()))];
}

async function runScope(variant: number): Promise<[string, string]> {
  const socialOnly = capability({ scopes: ["SOCIAL_PUBLIC"] });
  const sandbox = sandboxWith(socialOnly);
  const index = variant % 8;
  let action = envelope();
  if (index === 0) action = envelope({ actionType: "LISTING_CREATE" });
  if (index === 1) action = envelope({ actionType: "REVIEW" });
  if (index === 2 || index === 7) {
    action = envelope({ actionType: "PRIVATE_ACTION", visibilityClass: "PRIVATE_COMMITMENT", objectCommitment: "9".repeat(64) });
    return ["CAPABILITY_SCOPE_DENIED", await capture(() => sandbox.recordPrivateAction(action.objectCommitment, action, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true }))];
  }
  if (index === 3) action = envelope({ actorCommitment: "1".repeat(64) });
  if (index === 4) action = envelope({ actionType: "PRIVATE_ACTION", visibilityClass: "PRIVATE_COMMITMENT" });
  if (index === 5) action = envelope({ visibilityClass: "PRIVATE_COMMITMENT" });
  if (index === 6) {
    action = envelope({ actionType: "PRIVATE_ACTION", visibilityClass: "PRIVATE_COMMITMENT", objectCommitment: "7".repeat(64) });
    return ["PRIVATE_ENVELOPE_INVALID", await capture(() => sandbox.recordPrivateAction("8".repeat(64), action, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true }))];
  }
  const expected = index <= 1 ? "CAPABILITY_SCOPE_DENIED" : index === 3 ? "CAPABILITY_ACTOR_MISMATCH" : "PRIVATE_ENDPOINT_REQUIRED";
  return [expected, await capture(() => sandbox.recordAction(action, signature, context()))];
}

async function runRelayerContext(variant: number): Promise<[string, string]> {
  const sandbox = sandboxWith();
  const index = variant % 8;
  if (index === 7) sandbox.pauseRelayer(relayer, true);
  const mutations: Array<[Partial<ExecutionContext>, string]> = [
    [{ relayer: alternateRelayer }, "RELAYER_DENIED"],
    [{ relayerAgreementVerified: false }, "RELAYER_AGREEMENT_REQUIRED"],
    [{ payments: [{}] }, "ACTION_ENDPOINT_NONPAYABLE"],
    [{ relayer: "erd1bad" }, "RELAYER_ADDRESS_INVALID"],
    [{ contractAddress: "erd1bad" }, "CONTRACT_ADDRESS_INVALID"],
    [{ chainId: "bad chain" }, "CHAIN_ID_INVALID"],
    [{ nowMs: now + 0.5 }, "CONTEXT_TIME_INVALID"],
    [{}, "RELAYER_DENIED"],
  ];
  const [mutation, expected] = mutations[index];
  return [expected, await capture(() => sandbox.recordAction(envelope(), signature, context(mutation)))];
}

async function runRotation(variant: number): Promise<[string, string]> {
  const sandbox = sandboxWith();
  const replacementKey = "1".repeat(64);
  const baseReplacement = capability({ sessionPublicKey: replacementKey, maxActions: 4 });
  const index = variant % 8;
  if (index === 0) return ["CAPABILITY_SCOPE_ESCALATION", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, scopes: ["SOCIAL_PUBLIC", "MARKET_PUBLIC"] }, controller, now))];
  if (index === 1) return ["CAPABILITY_LIMIT_ESCALATION", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, expiresAtMs: now + 600_001 }, controller, now))];
  if (index === 2) return ["CAPABILITY_LIMIT_ESCALATION", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, maxActions: 5 }, controller, now))];
  if (index === 3) return ["CAPABILITY_IDENTITY_ESCALATION", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, actorCommitment: "2".repeat(64) }, controller, now))];
  if (index === 4) return ["CAPABILITY_IDENTITY_ESCALATION", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, actorKind: "AGENT" }, controller, now))];
  if (index === 5) return ["CONTROLLER_REQUIRED", await capture(() => sandbox.rotateCapability(sessionKey, baseReplacement, "3".repeat(64), now))];
  if (index === 6) return ["CONTROLLER_REQUIRED", await capture(() => sandbox.rotateCapability(sessionKey, { ...baseReplacement, controller: "3".repeat(64) }, controller, now))];
  sandbox.rotateCapability(sessionKey, { ...baseReplacement, scopes: ["SOCIAL_PUBLIC"], maxActions: 3, expiresAtMs: now + 500_000 }, controller, now);
  return ["CAPABILITY_REVOKED", await capture(() => sandbox.recordAction(envelope(), signature, context()))];
}

async function runLifecycle(variant: number): Promise<[string, string]> {
  const tracker = new ActionLifecycleTracker();
  const index = variant % 9;
  if (index === 0) return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.observe("NETWORK_ACCEPTED", now))];
  if (index === 1) return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.submit())];
  tracker.queue(); tracker.submit();
  if (index === 2) return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.observe("ORDERED_FINAL", now))];
  tracker.observe("NETWORK_ACCEPTED", now);
  if (index === 3) return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.observe("EXECUTION_STARTED", now + 1))];
  tracker.observe("ORDERED_FINAL", now + 1);
  if (index === 4) return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.observe("EXECUTION_SUCCESS", now + 2, true))];
  if (index === 8) return ["ORDERED_NOT_EXECUTED", tracker.snapshot().state === "ORDERED_FINAL" && !tracker.canApplyAuthoritativeDomainEffect() ? "ORDERED_NOT_EXECUTED" : "AUTHORITATIVE_TOO_EARLY"];
  tracker.observe("EXECUTION_STARTED", now + 2);
  if (index === 5) return ["EXECUTION_EVENT_REQUIRED", await capture(() => tracker.observe("EXECUTION_SUCCESS", now + 3, false))];
  if (index === 6) { tracker.observe("EXECUTION_FAIL", now + 3); return ["TERMINAL_RECONCILIATION_REQUIRED", await capture(() => tracker.observe("DIVERGENCE", now + 4))]; }
  tracker.observe("EXECUTION_SUCCESS", now + 3, true);
  return ["LIFECYCLE_TRANSITION_INVALID", await capture(() => tracker.observe("EXECUTION_SUCCESS", now + 4, true))];
}

async function runPrivacyBatch(variant: number): Promise<[string, string]> {
  const sandbox = sandboxWith();
  const privateAction = envelope({ actionType: "PRIVATE_ACTION", visibilityClass: "PRIVATE_COMMITMENT", objectCommitment: "9".repeat(64) });
  const index = variant % 11;
  if (index === 0) return ["BATCH_FORBIDDEN", await capture(() => sandbox.recordAction([envelope()] as unknown as ActionEnvelope, signature, context()))];
  if (index === 1) return ["PRIVATE_ENDPOINT_REQUIRED", await capture(() => sandbox.recordAction(privateAction, signature, context()))];
  if (index === 2) return ["PRIVATE_COMMITMENT_ATTESTATION_INVALID", await capture(() => sandbox.recordPrivateAction(privateAction.objectCommitment, privateAction, signature, context(), { saltEntropyBits: 127, targetIncludedInClear: false, generatedOnUserDevice: true }))];
  if (index === 3) return ["PRIVATE_COMMITMENT_ATTESTATION_INVALID", await capture(() => sandbox.recordPrivateAction(privateAction.objectCommitment, privateAction, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: true as false, generatedOnUserDevice: true }))];
  if (index === 4) return ["PRIVATE_COMMITMENT_ATTESTATION_INVALID", await capture(() => sandbox.recordPrivateAction(privateAction.objectCommitment, privateAction, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: false as true }))];
  if (index === 5) return ["GENERIC_COMMITMENT_INVALID", await capture(() => sandbox.recordPrivateAction("bad", privateAction, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true }))];
  if (index === 6) return ["PRIVATE_ENVELOPE_INVALID", await capture(() => sandbox.recordPrivateAction("8".repeat(64), privateAction, signature, context(), { saltEntropyBits: 128, targetIncludedInClear: false, generatedOnUserDevice: true }))];
  const fixtures: Array<[string, string]> = [
    ["name@example.invalid", "email"], ["+40 712 345 678", "phone"],
    ["https://private.invalid", "url"], ["latitude=44.4", "coordinates"],
  ];
  const [fixture, expected] = fixtures[index - 7];
  const findings = scanSerializedTransactionForPrivatePlaintext(fixture);
  return [`PRIVACY_SCAN:${expected}`, findings.includes(expected) ? `PRIVACY_SCAN:${expected}` : `PRIVACY_SCAN_MISSED:${findings.join(",")}`];
}

const runners: Record<Category, (variant: number) => Promise<[string, string]>> = {
  envelope_shape: runEnvelopeShape,
  ttl_expiry: runTtlExpiry,
  nonce_replay_gap: runNonce,
  capability_scope: runScope,
  relayer_context: runRelayerContext,
  capability_rotation: runRotation,
  lifecycle_finality: runLifecycle,
  privacy_batch: runPrivacyBatch,
};

async function main(): Promise<void> {
  const categoryCounts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
  const failures: FailureReplay[] = [];
  const replaySamples: Array<{ vector_id: string; vector_sha256: string; category: Category }> = [];
  const corpusLines: string[] = [];
  let totalCases = 0;

  for (const seed of FIXED_SEEDS) {
    const random = new XorShift32(seed);
    for (let caseIndex = 0; caseIndex < CASES_PER_SEED; caseIndex += 1) {
      const category = CATEGORIES[caseIndex % CATEGORIES.length];
      const variant = random.next();
      const vectorId = `${TASK_ID}-FZ-${seed.toString(16).padStart(8, "0")}-${caseIndex.toString().padStart(4, "0")}`;
      const [expected, actual] = await runners[category](variant);
      const descriptor = `${vectorId}|${seed}|${category}|${variant}|${expected}|${actual}`;
      const vectorSha256 = await sha256(descriptor);
      corpusLines.push(descriptor);
      categoryCounts[category] += 1;
      totalCases += 1;
      if (caseIndex < CATEGORIES.length) replaySamples.push({ vector_id: vectorId, vector_sha256: vectorSha256, category });
      if (expected !== actual && failures.length < 64) failures.push({
        vector_id: vectorId, vector_sha256: vectorSha256, seed: `0x${seed.toString(16).padStart(8, "0")}`,
        category, variant, expected, actual,
      });
    }
  }

  const receipt = {
    schema_version: 1, task_id: TASK_ID, suite: "DETERMINISTIC_PROPERTY_MUTATION_CORPUS",
    status: failures.length === 0 ? "PASS" : "FAIL", fixed_seeds: FIXED_SEEDS.map((seed) => `0x${seed.toString(16).padStart(8, "0")}`),
    cases_per_seed: CASES_PER_SEED, total_cases: totalCases, category_counts: categoryCounts,
    mutation_oracle_mismatches: failures.length, failures, replay_samples: replaySamples,
    corpus_sha256: await sha256(corpusLines.join("\n")), deterministic: true,
    local_mock_only: true, network_operations: 0, economic_operations: 0,
  };
  console.log(JSON.stringify(receipt));
  if (failures.length !== 0) throw new Error(`FUZZ_ORACLE_MISMATCHES:${failures.length}`);
}

void main();
