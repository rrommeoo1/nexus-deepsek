export type TestLevel = "UNIT" | "CONTRACT" | "INTEGRATION" | "E2E";
export type TestCriticality = "NORMAL" | "RELEASE_CRITICAL";
export type TestOutcome = "PASS" | "FAIL";
export type JourneyStage = "CLIENT" | "API" | "OUTBOX" | "WORKER";

export interface RequirementRef {
  requirementId: string;
  artifactPath: string;
  artifactHash: string;
  owner: string;
}

export interface RequirementArtifact {
  artifactPath: string;
  artifactHash: string;
  owner: string;
  requirementIds: readonly string[];
}

export interface TestCaseDefinition {
  id: string;
  level: TestLevel;
  criticality: TestCriticality;
  owner: string;
  independentReviewer: string;
  requirement: RequirementRef;
  timeoutMs: number;
}

export interface SyntheticActor {
  id: string;
  trafficClass: "SYSTEM_TEST";
  walletMode: "FIXTURE_ONLY";
}

export interface EffectAttempt {
  payoutMicros: number;
  organicMetricDelta: number;
  reputationDelta: number;
  reviewDelta: number;
}

export interface JourneyStep {
  stage: JourneyStage;
  traceId: string;
  requestId: string;
  requirementId: string;
  actorClass: "SYSTEM_TEST";
  sequence: number;
  outcome: "ACCEPTED" | "PROCESSED";
}

export interface JourneyReceipt {
  schemaVersion: 1;
  runId: string;
  testCaseId: string;
  traceId: string;
  requirement: RequirementRef;
  steps: readonly JourneyStep[];
  workerExecutions: number;
  economicEffect: false;
  organicMetricEffect: false;
  reputationEffect: false;
  reviewEffect: false;
}

export interface FailureEvidence {
  schemaVersion: 1;
  testCaseId: string;
  requirement: RequirementRef;
  traceId: string;
  failureCode: string;
  owner: string;
  artifactHash: string;
  outcome: "FAIL";
}

export interface TestObservation {
  testCaseId: string;
  inputHash: string;
  artifactHash: string;
  outcome: TestOutcome;
}

export interface QuarantineRequest {
  testCaseId: string;
  owner: string;
  reason: string;
  expiresAt: string;
}

export class QaPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "QaPolicyError"; }
}

const SAFE_ID = /^[A-Z0-9][A-Z0-9._:-]{2,79}$/;
const SAFE_OWNER = /^[A-Z][A-Z0-9_-]{1,31}$/;
const HASH = /^[a-f0-9]{64}$/;
const TRACE = /^(?!0{32}$)[a-f0-9]{32}$/;
const PATH = /^(?![A-Za-z]:)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]{3,180}$/;
const LEVELS = new Set<TestLevel>(["UNIT", "CONTRACT", "INTEGRATION", "E2E"]);
const CRITICALITIES = new Set<TestCriticality>(["NORMAL", "RELEASE_CRITICAL"]);
const STAGES: readonly JourneyStage[] = ["CLIENT", "API", "OUTBOX", "WORKER"];

function assertSafeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value)) throw new QaPolicyError(code);
}

export class RequirementResolver {
  private readonly artifacts = new Map<string, Readonly<RequirementArtifact>>();

  constructor(artifacts: readonly RequirementArtifact[]) {
    for (const candidate of artifacts) {
      if (!candidate || !PATH.test(candidate.artifactPath) || !HASH.test(candidate.artifactHash) || !SAFE_OWNER.test(candidate.owner) || candidate.requirementIds.length === 0 || candidate.requirementIds.some((id) => !SAFE_ID.test(id))) {
        throw new QaPolicyError("REQUIREMENT_ARTIFACT_INVALID");
      }
      if (this.artifacts.has(candidate.artifactPath)) throw new QaPolicyError("REQUIREMENT_ARTIFACT_DUPLICATE");
      this.artifacts.set(candidate.artifactPath, Object.freeze({ ...candidate, requirementIds: Object.freeze([...candidate.requirementIds]) }));
    }
  }

  verify(reference: RequirementRef): Readonly<RequirementArtifact> {
    const artifact = this.artifacts.get(reference.artifactPath);
    if (!artifact) throw new QaPolicyError("REQUIREMENT_ARTIFACT_NOT_FOUND");
    if (artifact.artifactHash !== reference.artifactHash) throw new QaPolicyError("REQUIREMENT_ARTIFACT_HASH_MISMATCH");
    if (artifact.owner !== reference.owner) throw new QaPolicyError("REQUIREMENT_ARTIFACT_OWNER_MISMATCH");
    if (!artifact.requirementIds.includes(reference.requirementId)) throw new QaPolicyError("REQUIREMENT_ID_NOT_FOUND");
    return artifact;
  }
}

export function validateTestCase(input: TestCaseDefinition, resolver: RequirementResolver): Readonly<TestCaseDefinition> {
  if (!input || !SAFE_ID.test(input.id) || !LEVELS.has(input.level) || !CRITICALITIES.has(input.criticality)) {
    throw new QaPolicyError("TEST_CASE_IDENTITY_INVALID");
  }
  if (!SAFE_OWNER.test(input.owner) || !SAFE_OWNER.test(input.independentReviewer) || input.owner === input.independentReviewer) {
    throw new QaPolicyError("MAKER_CHECKER_INVALID");
  }
  if (!input.requirement || !SAFE_ID.test(input.requirement.requirementId) || !PATH.test(input.requirement.artifactPath) || !HASH.test(input.requirement.artifactHash) || !SAFE_OWNER.test(input.requirement.owner)) {
    throw new QaPolicyError("REQUIREMENT_LINK_INVALID");
  }
  if (input.requirement.owner !== input.owner) throw new QaPolicyError("REQUIREMENT_OWNER_MISMATCH");
  resolver.verify(input.requirement);
  assertSafeInteger(input.timeoutMs, "TIMEOUT_INVALID");
  if (input.timeoutMs < 1 || input.timeoutMs > 30_000) throw new QaPolicyError("TIMEOUT_INVALID");
  return Object.freeze({ ...input, requirement: Object.freeze({ ...input.requirement }) });
}

export function createSyntheticActor(id: string): Readonly<SyntheticActor> {
  if (!/^SYSTEM_TEST:[a-z0-9-]{3,64}$/.test(id)) throw new QaPolicyError("SYNTHETIC_ACTOR_ID_INVALID");
  return Object.freeze({ id, trafficClass: "SYSTEM_TEST", walletMode: "FIXTURE_ONLY" });
}

export class SyntheticIsolationLedger {
  private deniedAttempts = 0;
  private acceptedNoEffectAttempts = 0;

  apply(actor: SyntheticActor, attempt: EffectAttempt): void {
    if (actor.trafficClass !== "SYSTEM_TEST" || actor.walletMode !== "FIXTURE_ONLY") throw new QaPolicyError("ACTOR_CLASS_INVALID");
    for (const value of [attempt.payoutMicros, attempt.organicMetricDelta, attempt.reputationDelta, attempt.reviewDelta]) {
      assertSafeInteger(value, "EFFECT_VALUE_INVALID");
      if (value < 0) throw new QaPolicyError("EFFECT_VALUE_INVALID");
    }
    if (attempt.payoutMicros !== 0 || attempt.organicMetricDelta !== 0 || attempt.reputationDelta !== 0 || attempt.reviewDelta !== 0) {
      this.deniedAttempts += 1;
      throw new QaPolicyError("SYSTEM_TEST_EFFECT_FORBIDDEN");
    }
    this.acceptedNoEffectAttempts += 1;
  }

  snapshot(): Readonly<{ deniedAttempts: number; acceptedNoEffectAttempts: number; totalEconomicEffectMicros: 0 }> {
    return Object.freeze({ deniedAttempts: this.deniedAttempts, acceptedNoEffectAttempts: this.acceptedNoEffectAttempts, totalEconomicEffectMicros: 0 });
  }
}

export class FlakeRegistry {
  private readonly definitions = new Map<string, Readonly<TestCaseDefinition>>();
  private readonly observations = new Map<string, TestObservation[]>();
  private readonly quarantines = new Map<string, Readonly<QuarantineRequest>>();

  constructor(private readonly resolver: RequirementResolver) {}

  register(definition: TestCaseDefinition): void {
    const validated = validateTestCase(definition, this.resolver);
    const existing = this.definitions.get(validated.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(validated)) throw new QaPolicyError("TEST_CASE_CONFLICT");
    this.definitions.set(validated.id, validated);
  }

  observe(observation: TestObservation): void {
    if (!this.definitions.has(observation.testCaseId)) throw new QaPolicyError("TEST_CASE_UNKNOWN");
    if (!HASH.test(observation.inputHash) || !HASH.test(observation.artifactHash) || !new Set<TestOutcome>(["PASS", "FAIL"]).has(observation.outcome)) {
      throw new QaPolicyError("OBSERVATION_INVALID");
    }
    const list = this.observations.get(observation.testCaseId) ?? [];
    list.push(Object.freeze({ ...observation }));
    this.observations.set(observation.testCaseId, list);
  }

  isFlaky(testCaseId: string): boolean {
    const grouped = new Map<string, Set<TestOutcome>>();
    for (const item of this.observations.get(testCaseId) ?? []) {
      const key = `${item.inputHash}:${item.artifactHash}`;
      const outcomes = grouped.get(key) ?? new Set<TestOutcome>();
      outcomes.add(item.outcome);
      grouped.set(key, outcomes);
    }
    return [...grouped.values()].some((outcomes) => outcomes.size > 1);
  }

  quarantine(request: QuarantineRequest, nowIso: string): void {
    const definition = this.definitions.get(request.testCaseId);
    if (!definition) throw new QaPolicyError("TEST_CASE_UNKNOWN");
    if (definition.criticality === "RELEASE_CRITICAL") throw new QaPolicyError("CRITICAL_QUARANTINE_FORBIDDEN");
    if (request.owner !== definition.owner || request.reason.trim().length < 12) throw new QaPolicyError("QUARANTINE_AUTHORIZATION_INVALID");
    const now = Date.parse(nowIso); const expiry = Date.parse(request.expiresAt);
    if (!Number.isFinite(now) || !Number.isFinite(expiry) || expiry <= now || expiry - now > 7 * 86_400_000) throw new QaPolicyError("QUARANTINE_EXPIRY_INVALID");
    this.quarantines.set(request.testCaseId, Object.freeze({ ...request }));
  }

  promotionDecision(nowIso: string): Readonly<{ allowed: boolean; blockingTestIds: readonly string[]; quarantinedNormalTestIds: readonly string[] }> {
    const now = Date.parse(nowIso);
    if (!Number.isFinite(now)) throw new QaPolicyError("PROMOTION_TIME_INVALID");
    const blocking = [...this.definitions.values()]
      .filter((definition) => definition.criticality === "RELEASE_CRITICAL")
      .filter((definition) => this.isFlaky(definition.id) || (this.observations.get(definition.id) ?? []).some((item) => item.outcome === "FAIL"))
      .map((definition) => definition.id).sort();
    const activeQuarantines: string[] = [];
    for (const [testCaseId, quarantine] of this.quarantines.entries()) {
      const expiry = Date.parse(quarantine.expiresAt);
      if (!Number.isFinite(expiry)) throw new QaPolicyError("QUARANTINE_STORED_EXPIRY_INVALID");
      if (expiry > now) activeQuarantines.push(testCaseId);
    }
    return Object.freeze({ allowed: blocking.length === 0, blockingTestIds: Object.freeze(blocking), quarantinedNormalTestIds: Object.freeze(activeQuarantines.sort()) });
  }
}

export type IdempotencyState = "PENDING" | "COMPLETED";
export interface IdempotencyRecord { requestId: string; state: IdempotencyState; workerOutcomeId: string | null; }

export class DurableIdempotencyFixture {
  private readonly records = new Map<string, IdempotencyRecord>();

  constructor(snapshot: readonly IdempotencyRecord[] = []) {
    for (const record of snapshot) {
      if (!SAFE_ID.test(record.requestId) || !new Set<IdempotencyState>(["PENDING", "COMPLETED"]).has(record.state)) throw new QaPolicyError("IDEMPOTENCY_SNAPSHOT_INVALID");
      if ((record.state === "COMPLETED") !== (typeof record.workerOutcomeId === "string" && SAFE_ID.test(record.workerOutcomeId))) throw new QaPolicyError("IDEMPOTENCY_SNAPSHOT_INVALID");
      if (this.records.has(record.requestId)) throw new QaPolicyError("IDEMPOTENCY_SNAPSHOT_CONFLICT");
      this.records.set(record.requestId, { ...record });
    }
  }

  begin(requestId: string): "START" | "RESUME" {
    if (!SAFE_ID.test(requestId)) throw new QaPolicyError("JOURNEY_IDENTITY_INVALID");
    const existing = this.records.get(requestId);
    if (existing?.state === "COMPLETED") throw new QaPolicyError("REQUEST_REPLAY");
    if (existing?.state === "PENDING") return "RESUME";
    this.records.set(requestId, { requestId, state: "PENDING", workerOutcomeId: null });
    return "START";
  }

  commitWorkerOutcome(requestId: string, workerOutcomeId: string): void {
    const record = this.records.get(requestId);
    if (!record || record.state !== "PENDING" || !SAFE_ID.test(workerOutcomeId)) throw new QaPolicyError("IDEMPOTENCY_COMMIT_INVALID");
    this.records.set(requestId, { requestId, state: "COMPLETED", workerOutcomeId });
  }

  exportSnapshot(): readonly Readonly<IdempotencyRecord>[] {
    return Object.freeze([...this.records.values()].sort((a, b) => a.requestId.localeCompare(b.requestId)).map((item) => Object.freeze({ ...item })));
  }
}

export class LocalCrossLayerHarness {
  constructor(private readonly resolver: RequirementResolver, private readonly idempotency: DurableIdempotencyFixture) {}

  run(input: { runId: string; testCase: TestCaseDefinition; actor: SyntheticActor; traceId: string; requestId: string; effectAttempt: EffectAttempt; failurePoint?: "BEFORE_WORKER_COMMIT" | "AFTER_WORKER_COMMIT" }, ledger: SyntheticIsolationLedger): Readonly<JourneyReceipt> {
    const testCase = validateTestCase(input.testCase, this.resolver);
    if (testCase.level !== "E2E") throw new QaPolicyError("E2E_LEVEL_REQUIRED");
    if (!SAFE_ID.test(input.runId) || !TRACE.test(input.traceId) || !SAFE_ID.test(input.requestId)) throw new QaPolicyError("JOURNEY_IDENTITY_INVALID");
    this.idempotency.begin(input.requestId);
    ledger.apply(input.actor, input.effectAttempt);
    const steps = STAGES.map((stage, index): JourneyStep => Object.freeze({
      stage, traceId: input.traceId, requestId: input.requestId, requirementId: testCase.requirement.requirementId,
      actorClass: "SYSTEM_TEST", sequence: index + 1, outcome: stage === "WORKER" ? "PROCESSED" : "ACCEPTED",
    }));
    if (input.failurePoint === "BEFORE_WORKER_COMMIT") throw new QaPolicyError("SIMULATED_CRASH_BEFORE_WORKER_COMMIT");
    const receipt = Object.freeze({
      schemaVersion: 1, runId: input.runId, testCaseId: testCase.id, traceId: input.traceId,
      requirement: testCase.requirement, steps: Object.freeze(steps), workerExecutions: 1,
      economicEffect: false, organicMetricEffect: false, reputationEffect: false, reviewEffect: false,
    } satisfies JourneyReceipt);
    this.idempotency.commitWorkerOutcome(input.requestId, `WORKER:${input.requestId}`);
    if (input.failurePoint === "AFTER_WORKER_COMMIT") throw new QaPolicyError("SIMULATED_CRASH_AFTER_WORKER_COMMIT");
    return receipt;
  }
}

export function buildFailureEvidence(testCase: TestCaseDefinition, traceId: string, failureCode: string, resolver: RequirementResolver): Readonly<FailureEvidence> {
  const validated = validateTestCase(testCase, resolver);
  if (!TRACE.test(traceId) || !/^[A-Z][A-Z0-9_]{2,63}$/.test(failureCode)) throw new QaPolicyError("FAILURE_EVIDENCE_INVALID");
  return Object.freeze({ schemaVersion: 1, testCaseId: validated.id, requirement: validated.requirement, traceId, failureCode, owner: validated.owner, artifactHash: validated.requirement.artifactHash, outcome: "FAIL" });
}
