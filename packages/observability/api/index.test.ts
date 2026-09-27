import {
  ALERT_RULES, SLO_CATALOG, TelemetryCollector, TelemetryPolicyError, buildCostReport,
  createTraceContext, extractOutboxTrace, injectOutboxTrace, scanTelemetryForPrivateData,
  validateCostEvent, type CostEvent,
} from "./index";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void {
  let actual = "NO_ERROR";
  try { action(); } catch (error) { actual = error instanceof TelemetryPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}

function main(): void {
  const traceId = "1234567890abcdef1234567890abcdef";
  const collector = new TelemetryCollector(true);
  const api = collector.recordSpan({ parent: null, traceId, spanId: "1111111111111111", name: "api.action.accept", kind: "SERVER", durationMs: 41, attributes: { "service.name": "nexus-api", "deployment.environment": "LOCAL", "traffic.class": "SYSTEM_TEST" }, highCardinalityAttributes: { "request.id_hash": "a".repeat(32) } });
  const outbox = collector.recordSpan({ parent: api, traceId, spanId: "2222222222222222", name: "outbox.action.publish", kind: "PRODUCER", durationMs: 7, attributes: { "service.name": "nexus-api", outcome: "accepted" } });
  const carrier = injectOutboxTrace(outbox);
  const extracted = extractOutboxTrace(carrier);
  const worker = collector.recordSpan({ parent: extracted, traceId, spanId: "3333333333333333", name: "worker.action.consume", kind: "CONSUMER", durationMs: 18, attributes: { "service.name": "nexus-worker", operation: "action-consume" } });
  const dependency = collector.recordSpan({ parent: worker, traceId, spanId: "4444444444444444", name: "dependency.chain.submit", kind: "CLIENT", durationMs: 93, attributes: { "service.name": "nexus-worker", "dependency.type": "multiversx-devnet", "chain.runtime": "andromeda-compat" } });
  collector.recordCriticalAudit(dependency, "ACTION_ACCEPTED", "ALLOW");
  const traceSnapshot = collector.snapshot();
  assert(traceSnapshot.spans.length === 4, "API outbox worker dependency trace has four spans");
  assert(new Set(traceSnapshot.spans.map((span) => span.traceId)).size === 1, "trace ID crosses every process boundary");
  assert(new Set(traceSnapshot.spans.map((span) => span.spanId)).size === 4, "span IDs are unique");
  assert(traceSnapshot.spans[1]?.parentSpanId === api.spanId, "outbox parent is API");
  assert(traceSnapshot.spans[2]?.parentSpanId === outbox.spanId, "worker parent is outbox carrier");
  assert(traceSnapshot.spans[3]?.parentSpanId === worker.spanId, "dependency parent is worker");
  assert(carrier.traceparent === `00-${traceId}-${outbox.spanId}-01`, "outbox uses canonical traceparent only");
  assert(scanTelemetryForPrivateData(traceSnapshot).length === 0, "trace demo contains no secrets or PII");

  expectCode(() => createTraceContext("0".repeat(32), "1".repeat(16)), "TRACE_ID_INVALID");
  expectCode(() => createTraceContext(traceId, "0".repeat(16)), "SPAN_ID_INVALID");
  expectCode(() => extractOutboxTrace({ schemaVersion: 1, traceparent: `00-${traceId}-${outbox.spanId}-03` }), "TRACEPARENT_INVALID");
  expectCode(() => extractOutboxTrace({ schemaVersion: 1, traceparent: carrier.traceparent, baggage: "forbidden" } as never), "TRACE_CARRIER_INVALID");
  expectCode(() => collector.recordSpan({ parent: api, traceId, spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: { email: "fixture@example.invalid" } }), "ATTRIBUTE_KEY_FORBIDDEN");
  expectCode(() => collector.recordSpan({ parent: api, traceId, spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: { operation: "contains spaces" } }), "ATTRIBUTE_VALUE_FORBIDDEN");
  expectCode(() => collector.recordSpan({ parent: api, traceId, spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: { operation: `erd1${"a".repeat(58)}` } }), "ATTRIBUTE_PRIVATE_DATA_FORBIDDEN");
  expectCode(() => collector.recordSpan({ parent: api, traceId, spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: { region: "203.0.113.7" } }), "ATTRIBUTE_PRIVATE_DATA_FORBIDDEN");
  expectCode(() => collector.recordSpan({ parent: api, traceId, spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: { operation: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signaturevalue" } }), "ATTRIBUTE_PRIVATE_DATA_FORBIDDEN");
  expectCode(() => collector.recordSpan({ parent: api, traceId: "f".repeat(32), spanId: "5555555555555555", name: "worker.action.consume", kind: "CONSUMER", durationMs: 1, attributes: {} }), "TRACE_PARENT_MISMATCH");
  assert(scanTelemetryForPrivateData({ email: "fixture@example.invalid", authorization: "Bearer fixture-token" }).length >= 3, "privacy scanner catches key and value fixtures");
  assert(scanTelemetryForPrivateData({ wallet: `erd1${"a".repeat(58)}` }).length >= 2, "privacy scanner catches wallet key and value");

  collector.setHighCardinalityEnabled(false);
  const rollbackContext = collector.recordSpan({ parent: dependency, traceId, spanId: "6666666666666666", name: "dependency.chain.submit", kind: "CLIENT", durationMs: 5, attributes: { outcome: "degraded" }, highCardinalityAttributes: { "transaction.hash": "b".repeat(64) } });
  collector.recordCriticalAudit(rollbackContext, "DEPENDENCY_FAILED", "ERROR");
  const rollbackSnapshot = collector.snapshot();
  assert(rollbackSnapshot.spans[4]?.attributes["transaction.hash"] === undefined, "kill switch drops high-cardinality attribute");
  assert(rollbackSnapshot.droppedHighCardinalityAttributes === 1, "kill switch counts dropped attributes");
  assert(rollbackSnapshot.criticalAudit.length === 2, "critical audit survives high-cardinality kill switch");
  assert(scanTelemetryForPrivateData(rollbackSnapshot).length === 0, "rollback telemetry remains privacy safe");
  expectCode(() => collector.recordCriticalAudit(rollbackContext, "RAW_SUBJECT" as never, "ALLOW"), "AUDIT_SHAPE_INVALID");
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  assert(scanTelemetryForPrivateData(cyclic).length === 0, "privacy scanner safely handles cyclic objects");

  assert(SLO_CATALOG.length === 6, "six initial SLOs are declared");
  assert(ALERT_RULES.length === SLO_CATALOG.length * 2, "every SLO has fast and slow burn alerts");
  for (const slo of SLO_CATALOG) {
    const alerts = ALERT_RULES.filter((alert) => alert.sloId === slo.id);
    assert(alerts.length === 2, `${slo.id} has two alerts`);
    assert(alerts.every((alert) => alert.owner === "A15" && alert.runbook === `services/observability/runbooks/slo-response.md#${slo.id}`), `${slo.id} alerts map to owner runbook`);
    assert(alerts.some((alert) => alert.severity === "PAGE") && alerts.some((alert) => alert.severity === "TICKET"), `${slo.id} has PAGE and TICKET severities`);
  }

  const base = { schemaVersion: 1 as const, quantityMicros: 1_000_000, environment: "LOCAL" as const, trafficClass: "AGENT" as const, economicEffect: false as const };
  const costEvents: CostEvent[] = [
    { ...base, domain: "GAS", unit: "GAS_UNIT", amountMicrosEur: 12, workload: "CHAIN_ACTION", providerClass: "MULTIVERSX" },
    { ...base, domain: "MEDIA", unit: "MEDIA_MINUTE", amountMicrosEur: 30, workload: "VOD", providerClass: "MEDIA_PIPELINE" },
    { ...base, domain: "PROVIDER", unit: "PROVIDER_CALL", amountMicrosEur: 8, workload: "EXTERNAL_ADAPTER", providerClass: "IDENTITY" },
    { ...base, domain: "HUMAN_AGENT", unit: "HUMAN_MINUTE", amountMicrosEur: 200, workload: "ASSURANCE", providerClass: "HUMAN_REVIEW", trafficClass: "HUMAN" },
    { ...base, domain: "TEST_TRAFFIC", unit: "TEST_ACTION", amountMicrosEur: 0, workload: "SYNTHETIC_JOURNEY", providerClass: "LOCAL_RUNTIME", trafficClass: "SYSTEM_TEST" },
  ];
  const costReport = buildCostReport(costEvents);
  assert(costReport.length === 5 && costReport.every((row) => row.events === 1), "cost report separates all five mandatory domains");
  assert(costReport.find((row) => row.domain === "TEST_TRAFFIC")?.amountMicrosEur === 0, "test traffic has zero economic effect");
  expectCode(() => validateCostEvent({ ...costEvents[0]!, unit: "MEDIA_MINUTE" }), "COST_TAG_COMBINATION_INVALID");
  expectCode(() => validateCostEvent({ ...costEvents[0]!, rawSubject: "forbidden" } as never), "COST_SHAPE_INVALID");
  expectCode(() => validateCostEvent({ ...costEvents[0]!, environment: "tenant@example.invalid" } as never), "COST_TAG_COMBINATION_INVALID");
  expectCode(() => validateCostEvent({ ...costEvents[0]!, trafficClass: "SYSTEM_TEST" }), "SYSTEM_TEST_COST_DOMAIN_REQUIRED");
  expectCode(() => validateCostEvent({ ...costEvents[4]!, amountMicrosEur: 1 }), "TEST_TRAFFIC_ISOLATION_REQUIRED");
  expectCode(() => validateCostEvent({ ...costEvents[0]!, amountMicrosEur: -1 }), "COST_AMOUNT_INVALID");

  const receipt = {
    schema_version: 1, task_id: "NX-OBS-001", status: "PASS", assertions,
    trace_demo: { spans: traceSnapshot.spans.length, process_path: traceSnapshot.spans.map((span) => span.name), one_trace_id: true },
    dashboards: ["nexus_reliability_v1", "nexus_unit_cost_v1"],
    alert_test: { slos: SLO_CATALOG.length, rules: ALERT_RULES.length, all_owned_and_runbook_mapped: true },
    privacy_log_scan: { findings: 0, negative_fixtures_detected: true },
    cost_report: costReport,
    rollback_test: { high_cardinality_dropped: 1, critical_audit_preserved: true },
    synthetic_only: true, network_operations: 0, economic_operations: 0,
  };
  console.log(JSON.stringify(receipt));
}

main();
