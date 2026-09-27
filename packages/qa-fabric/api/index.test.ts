import {
  DurableIdempotencyFixture, FlakeRegistry, LocalCrossLayerHarness, QaPolicyError, RequirementResolver, SyntheticIsolationLedger,
  buildFailureEvidence, createSyntheticActor, validateTestCase,
  type TestCaseDefinition,
} from "./index";

declare const process: { stdout: { write(value: string): void } };

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void {
  let actual = "NO_ERROR";
  try { action(); } catch (error) { actual = error instanceof QaPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}

const critical: TestCaseDefinition = {
  id: "NX-QA-E2E-001", level: "E2E", criticality: "RELEASE_CRITICAL", owner: "C01", independentReviewer: "C11",
  requirement: { requirementId: "NX-QA-001-AT-03", artifactPath: "planning/backlog-p0.yaml", artifactHash: "a".repeat(64), owner: "C01" }, timeoutMs: 5_000,
};
const normal: TestCaseDefinition = {
  id: "NX-QA-UNIT-001", level: "UNIT", criticality: "NORMAL", owner: "C01", independentReviewer: "C12",
  requirement: { requirementId: "NX-QA-001-AT-01", artifactPath: "planning/backlog-p0.yaml", artifactHash: "a".repeat(64), owner: "C01" }, timeoutMs: 1_000,
};

function main(): void {
  const resolver = new RequirementResolver([{ artifactPath: "planning/backlog-p0.yaml", artifactHash: "a".repeat(64), owner: "C01", requirementIds: ["NX-QA-001-AT-01", "NX-QA-001-AT-03"] }]);
  assert(validateTestCase(critical, resolver).id === critical.id, "critical case validates");
  assert(validateTestCase(normal, resolver).level === "UNIT", "test taxonomy validates");
  expectCode(() => validateTestCase({ ...critical, owner: "C11" }, resolver), "MAKER_CHECKER_INVALID");
  expectCode(() => validateTestCase({ ...critical, independentReviewer: "C01" }, resolver), "MAKER_CHECKER_INVALID");
  expectCode(() => validateTestCase({ ...critical, requirement: { ...critical.requirement, owner: "A10" } }, resolver), "REQUIREMENT_OWNER_MISMATCH");
  expectCode(() => validateTestCase({ ...critical, requirement: { ...critical.requirement, artifactPath: "../secret" } }, resolver), "REQUIREMENT_LINK_INVALID");
  expectCode(() => validateTestCase({ ...critical, requirement: { ...critical.requirement, artifactPath: "nonexistent/normative-artifact.yaml" } }, resolver), "REQUIREMENT_ARTIFACT_NOT_FOUND");
  expectCode(() => validateTestCase({ ...critical, requirement: { ...critical.requirement, artifactHash: "b".repeat(64) } }, resolver), "REQUIREMENT_ARTIFACT_HASH_MISMATCH");
  expectCode(() => validateTestCase({ ...critical, requirement: { ...critical.requirement, requirementId: "NX-QA-001-AT-MISSING" } }, resolver), "REQUIREMENT_ID_NOT_FOUND");
  expectCode(() => new RequirementResolver([{ artifactPath: "planning/backlog-p0.yaml", artifactHash: "a".repeat(64), owner: "A10", requirementIds: ["NX-QA-001-AT-03"] }]).verify(critical.requirement), "REQUIREMENT_ARTIFACT_OWNER_MISMATCH");
  expectCode(() => validateTestCase({ ...critical, timeoutMs: 0 }, resolver), "TIMEOUT_INVALID");
  expectCode(() => validateTestCase({ ...critical, timeoutMs: 30_001 }, resolver), "TIMEOUT_INVALID");

  const actor = createSyntheticActor("SYSTEM_TEST:creator-0001");
  assert(actor.trafficClass === "SYSTEM_TEST" && actor.walletMode === "FIXTURE_ONLY", "synthetic actor is visibly tagged and fixture-only");
  expectCode(() => createSyntheticActor("human:creator-0001"), "SYNTHETIC_ACTOR_ID_INVALID");
  const ledger = new SyntheticIsolationLedger();
  ledger.apply(actor, { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 });
  assert(ledger.snapshot().acceptedNoEffectAttempts === 1, "zero-effect synthetic operation is accepted");
  expectCode(() => ledger.apply(actor, { payoutMicros: 1, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 }), "SYSTEM_TEST_EFFECT_FORBIDDEN");
  expectCode(() => ledger.apply(actor, { payoutMicros: 0, organicMetricDelta: 1, reputationDelta: 0, reviewDelta: 0 }), "SYSTEM_TEST_EFFECT_FORBIDDEN");
  expectCode(() => ledger.apply(actor, { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 1, reviewDelta: 0 }), "SYSTEM_TEST_EFFECT_FORBIDDEN");
  expectCode(() => ledger.apply(actor, { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 1 }), "SYSTEM_TEST_EFFECT_FORBIDDEN");
  expectCode(() => ledger.apply(actor, { payoutMicros: -1, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 }), "EFFECT_VALUE_INVALID");
  assert(ledger.snapshot().deniedAttempts === 4, "all four economic and organic effect classes are denied");
  assert(ledger.snapshot().totalEconomicEffectMicros === 0, "synthetic tests cannot create payout");

  const idempotency = new DurableIdempotencyFixture();
  const harness = new LocalCrossLayerHarness(resolver, idempotency);
  const traceId = "1234567890abcdef1234567890abcdef";
  const receipt = harness.run({ runId: "NX-QA-001-RUN-001", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:0001", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger);
  assert(receipt.steps.length === 4, "client API outbox worker E2E has four stages");
  assert(receipt.steps.map((step) => step.stage).join("|") === "CLIENT|API|OUTBOX|WORKER", "E2E stage order is deterministic");
  assert(new Set(receipt.steps.map((step) => step.traceId)).size === 1, "trace ID crosses client API outbox and worker");
  assert(new Set(receipt.steps.map((step) => step.requestId)).size === 1, "request ID crosses every boundary");
  assert(receipt.steps.every((step, index) => step.sequence === index + 1), "sequence is monotonic");
  assert(receipt.steps.every((step) => step.actorClass === "SYSTEM_TEST"), "synthetic classification survives every boundary");
  assert(receipt.steps.every((step) => step.requirementId === critical.requirement.requirementId), "requirement ID survives every boundary");
  assert(receipt.workerExecutions === 1, "worker processes request exactly once");
  assert(!receipt.economicEffect && !receipt.organicMetricEffect && !receipt.reputationEffect && !receipt.reviewEffect, "E2E has zero protected effects");
  expectCode(() => harness.run({ runId: "NX-QA-001-RUN-002", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:0001", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger), "REQUEST_REPLAY");
  const recreatedHarness = new LocalCrossLayerHarness(resolver, new DurableIdempotencyFixture(idempotency.exportSnapshot()));
  expectCode(() => recreatedHarness.run({ runId: "NX-QA-001-RUN-002B", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:0001", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger), "REQUEST_REPLAY");
  expectCode(() => harness.run({ runId: "NX-QA-001-RUN-003", testCase: normal, actor, traceId, requestId: "REQ:SYSTEM_TEST:0002", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger), "E2E_LEVEL_REQUIRED");
  expectCode(() => harness.run({ runId: "NX-QA-001-RUN-004", testCase: critical, actor, traceId: "0".repeat(32), requestId: "REQ:SYSTEM_TEST:0003", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger), "JOURNEY_IDENTITY_INVALID");

  const beforeStore = new DurableIdempotencyFixture();
  expectCode(() => new LocalCrossLayerHarness(resolver, beforeStore).run({ runId: "NX-QA-001-CRASH-BEFORE", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:BEFORE", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 }, failurePoint: "BEFORE_WORKER_COMMIT" }, ledger), "SIMULATED_CRASH_BEFORE_WORKER_COMMIT");
  const resumedBefore = new LocalCrossLayerHarness(resolver, new DurableIdempotencyFixture(beforeStore.exportSnapshot())).run({ runId: "NX-QA-001-RESUME-BEFORE", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:BEFORE", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger);
  assert(resumedBefore.workerExecutions === 1, "crash before worker commit resumes to one committed execution");
  const afterStore = new DurableIdempotencyFixture();
  expectCode(() => new LocalCrossLayerHarness(resolver, afterStore).run({ runId: "NX-QA-001-CRASH-AFTER", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:AFTER", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 }, failurePoint: "AFTER_WORKER_COMMIT" }, ledger), "SIMULATED_CRASH_AFTER_WORKER_COMMIT");
  const restoredAfter = new LocalCrossLayerHarness(resolver, new DurableIdempotencyFixture(afterStore.exportSnapshot()));
  expectCode(() => restoredAfter.run({ runId: "NX-QA-001-RESUME-AFTER", testCase: critical, actor, traceId, requestId: "REQ:SYSTEM_TEST:AFTER", effectAttempt: { payoutMicros: 0, organicMetricDelta: 0, reputationDelta: 0, reviewDelta: 0 } }, ledger), "REQUEST_REPLAY");
  assert(afterStore.exportSnapshot().filter((item) => item.state === "COMPLETED").length === 1, "crash after worker commit remains exactly once across fresh instance");

  const failure = buildFailureEvidence(critical, traceId, "WORKER_ASSERTION_FAILED", resolver);
  assert(failure.requirement.requirementId === "NX-QA-001-AT-03", "failure links to requirement");
  assert(failure.requirement.artifactPath === "planning/backlog-p0.yaml", "failure links to normative artifact");
  assert(failure.owner === "C01", "failure links to accountable owner");
  assert(failure.traceId === traceId, "failure links to trace");
  assert(failure.artifactHash === critical.requirement.artifactHash && failure.outcome === "FAIL", "failure binds artifact hash and explicit outcome");
  expectCode(() => buildFailureEvidence(critical, traceId, "bad code", resolver), "FAILURE_EVIDENCE_INVALID");

  const registry = new FlakeRegistry(resolver);
  registry.register(critical); registry.register(critical); registry.register(normal);
  expectCode(() => registry.register({ ...critical, timeoutMs: 4_999 }), "TEST_CASE_CONFLICT");
  const inputHash = "a".repeat(64); const artifactHash = "b".repeat(64);
  registry.observe({ testCaseId: critical.id, inputHash, artifactHash, outcome: "PASS" });
  registry.observe({ testCaseId: critical.id, inputHash, artifactHash, outcome: "PASS" });
  assert(!registry.isFlaky(critical.id), "repeated deterministic PASS is not a flake");
  assert(registry.promotionDecision("2026-08-09T00:00:00Z").allowed, "passing critical test permits promotion");
  registry.observe({ testCaseId: critical.id, inputHash, artifactHash, outcome: "FAIL" });
  assert(registry.isFlaky(critical.id), "same input and artifact with mixed outcomes is a flake");
  assert(!registry.promotionDecision("2026-08-09T00:00:00Z").allowed, "critical flake blocks promotion");
  assert(registry.promotionDecision("2026-08-09T00:00:00Z").blockingTestIds[0] === critical.id, "critical blocker is named");
  expectCode(() => registry.quarantine({ testCaseId: critical.id, owner: "C01", reason: "temporary environment issue", expiresAt: "2026-08-10T00:00:00Z" }, "2026-08-09T00:00:00Z"), "CRITICAL_QUARANTINE_FORBIDDEN");
  expectCode(() => registry.quarantine({ testCaseId: normal.id, owner: "A10", reason: "temporary environment issue", expiresAt: "2026-08-10T00:00:00Z" }, "2026-08-09T00:00:00Z"), "QUARANTINE_AUTHORIZATION_INVALID");
  expectCode(() => registry.quarantine({ testCaseId: normal.id, owner: "C01", reason: "temporary environment issue", expiresAt: "2026-08-20T00:00:00Z" }, "2026-08-09T00:00:00Z"), "QUARANTINE_EXPIRY_INVALID");
  registry.quarantine({ testCaseId: normal.id, owner: "C01", reason: "temporary fixture repair", expiresAt: "2026-08-10T00:00:00Z" }, "2026-08-09T00:00:00Z");
  assert(registry.promotionDecision("2026-08-09T23:59:59Z").quarantinedNormalTestIds[0] === normal.id, "bounded normal quarantine is visible before expiry");
  assert(registry.promotionDecision("2026-08-10T00:00:00Z").quarantinedNormalTestIds.length === 0, "normal quarantine is inactive at expiry");
  assert(registry.promotionDecision("2026-08-11T00:00:00Z").quarantinedNormalTestIds.length === 0, "normal quarantine remains inactive after expiry");
  expectCode(() => registry.promotionDecision("not-a-time"), "PROMOTION_TIME_INVALID");
  expectCode(() => registry.observe({ testCaseId: "UNKNOWN", inputHash, artifactHash, outcome: "PASS" }), "TEST_CASE_UNKNOWN");
  expectCode(() => registry.observe({ testCaseId: normal.id, inputHash: "bad", artifactHash, outcome: "PASS" }), "OBSERVATION_INVALID");

  const result = {
    schema_version: 1, task_id: "NX-QA-001", status: "PASS", assertions,
    taxonomy: ["UNIT", "CONTRACT", "INTEGRATION", "E2E"],
    e2e: { process_path: receipt.steps.map((step) => step.stage), one_trace_id: true, worker_executions: receipt.workerExecutions, requirement_linked: true },
    flake: { detected: registry.isFlaky(critical.id), release_critical_promotion_blocked: !registry.promotionDecision("2026-08-09T00:00:00Z").allowed, release_critical_quarantine_forbidden: true, expired_normal_quarantines_active: 0 },
    evidence_binding: { artifact_hash_present: true, outcome_present: true, nonexistent_artifact_denied: true, stale_hash_denied: true, missing_requirement_denied: true },
    idempotency: { cross_instance_replay_denied: true, crash_before_resumed_once: true, crash_after_replay_denied: true },
    synthetic_isolation: { actor_class: actor.trafficClass, fixture_wallet_only: true, denied_effect_attempts: ledger.snapshot().deniedAttempts, economic_effect_micros: 0, organic_metric_effect: 0, reputation_effect: 0, review_effect: 0 },
    network_operations: 0, external_process_operations: 0, economic_operations: 0, incremental_cost: { amount: 0, currency: "EUR" },
  };
  process.stdout.write(JSON.stringify(result));
}

main();
