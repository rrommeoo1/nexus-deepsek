export type DeploymentEnvironment = "LOCAL" | "DEVNET" | "STAGING" | "CANARY" | "PRODUCTION";
export type TrafficClass = "HUMAN" | "AGENT" | "SYSTEM_TEST";
export type SpanKind = "SERVER" | "PRODUCER" | "CONSUMER" | "CLIENT";
export type SpanName = "api.action.accept" | "outbox.action.publish" | "worker.action.consume" | "dependency.chain.submit";
export type Severity = "PAGE" | "TICKET";
export type CostDomain = "GAS" | "MEDIA" | "PROVIDER" | "HUMAN_AGENT" | "TEST_TRAFFIC";
export type CostUnit = "GAS_UNIT" | "MEDIA_MINUTE" | "PROVIDER_CALL" | "HUMAN_MINUTE" | "TEST_ACTION";

export interface TraceContext {
  version: "00";
  traceId: string;
  spanId: string;
  sampled: boolean;
}

export interface OutboxTraceCarrier {
  schemaVersion: 1;
  traceparent: string;
}

export interface SafeSpan {
  schemaVersion: 1;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: SpanName;
  kind: SpanKind;
  durationMs: number;
  attributes: Readonly<Record<string, string>>;
}

export interface CriticalAuditRecord {
  schemaVersion: 1;
  traceId: string;
  spanId: string;
  code: "ACTION_ACCEPTED" | "OUTBOX_PUBLISHED" | "WORKER_REJECTED" | "DEPENDENCY_FAILED";
  outcome: "ALLOW" | "DENY" | "ERROR";
}

export interface SloDefinition {
  id: string;
  owner: "A15";
  objectivePercent: number;
  windowDays: 30;
  indicator: "AVAILABILITY" | "LATENCY" | "RECOVERY" | "CONSISTENCY";
  threshold: string;
  segmentBy: readonly ["version", "region", "device_class"];
}

export interface AlertRule {
  id: string;
  sloId: string;
  owner: "A15";
  severity: Severity;
  burnRate: number;
  longWindowMinutes: number;
  shortWindowMinutes: number;
  runbook: string;
}

export interface CostEvent {
  schemaVersion: 1;
  domain: CostDomain;
  unit: CostUnit;
  quantityMicros: number;
  amountMicrosEur: number;
  environment: DeploymentEnvironment;
  trafficClass: TrafficClass;
  workload: "CHAIN_ACTION" | "VOD" | "EXTERNAL_ADAPTER" | "ASSURANCE" | "SYNTHETIC_JOURNEY";
  providerClass: "MULTIVERSX" | "OBJECT_STORAGE" | "MEDIA_PIPELINE" | "IDENTITY" | "MODEL" | "HUMAN_REVIEW" | "LOCAL_RUNTIME";
  economicEffect: false;
}

export interface CostReportRow {
  domain: CostDomain;
  quantityMicros: number;
  amountMicrosEur: number;
  events: number;
}

export class TelemetryPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "TelemetryPolicyError"; }
}

const TRACE_ID = /^(?!0{32}$)[a-f0-9]{32}$/;
const SPAN_ID = /^(?!0{16}$)[a-f0-9]{16}$/;
const TRACEPARENT = /^00-((?!0{32})[a-f0-9]{32})-((?!0{16})[a-f0-9]{16})-(00|01)$/;
const SAFE_VALUE = /^[A-Za-z0-9_.:/-]{1,80}$/;
const HIGH_CARD_VALUE = /^[a-f0-9]{16,64}$/;
const SAFE_ATTRIBUTE_KEYS = new Set([
  "service.name", "deployment.environment", "region", "device.class", "app.version",
  "operation", "outcome", "chain.runtime", "traffic.class", "dependency.type",
]);
const HIGH_CARDINALITY_KEYS = new Set(["request.id_hash", "transaction.hash"]);
const AUDIT_CODES = new Set<CriticalAuditRecord["code"]>(["ACTION_ACCEPTED", "OUTBOX_PUBLISHED", "WORKER_REJECTED", "DEPENDENCY_FAILED"]);
const AUDIT_OUTCOMES = new Set<CriticalAuditRecord["outcome"]>(["ALLOW", "DENY", "ERROR"]);
const SPAN_NAMES = new Set<SpanName>([
  "api.action.accept", "outbox.action.publish", "worker.action.consume", "dependency.chain.submit",
]);
const SPAN_KINDS = new Set<SpanKind>(["SERVER", "PRODUCER", "CONSUMER", "CLIENT"]);

export const SLO_CATALOG: readonly SloDefinition[] = Object.freeze([
  { id: "api_non_media_availability", owner: "A15", objectivePercent: 99.9, windowDays: 30, indicator: "AVAILABILITY", threshold: ">=99.9%", segmentBy: ["version", "region", "device_class"] },
  { id: "api_non_media_write_latency", owner: "A15", objectivePercent: 99.9, windowDays: 30, indicator: "LATENCY", threshold: "p95<600ms", segmentBy: ["version", "region", "device_class"] },
  { id: "feed_first_page_latency", owner: "A15", objectivePercent: 99, windowDays: 30, indicator: "LATENCY", threshold: "p95<700ms", segmentBy: ["version", "region", "device_class"] },
  { id: "action_final_supernova_latency", owner: "A15", objectivePercent: 99, windowDays: 30, indicator: "LATENCY", threshold: "p95<2000ms", segmentBy: ["version", "region", "device_class"] },
  { id: "action_executed_success_latency", owner: "A15", objectivePercent: 99, windowDays: 30, indicator: "LATENCY", threshold: "p95<3000ms", segmentBy: ["version", "region", "device_class"] },
  { id: "chain_index_lag", owner: "A15", objectivePercent: 99, windowDays: 30, indicator: "CONSISTENCY", threshold: "p95<30000ms", segmentBy: ["version", "region", "device_class"] },
]);

export const ALERT_RULES: readonly AlertRule[] = Object.freeze(SLO_CATALOG.flatMap((slo) => [
  { id: `${slo.id}_fast_burn`, sloId: slo.id, owner: "A15" as const, severity: "PAGE" as const, burnRate: 14.4, longWindowMinutes: 60, shortWindowMinutes: 5, runbook: `services/observability/runbooks/slo-response.md#${slo.id}` },
  { id: `${slo.id}_slow_burn`, sloId: slo.id, owner: "A15" as const, severity: "TICKET" as const, burnRate: 6, longWindowMinutes: 360, shortWindowMinutes: 30, runbook: `services/observability/runbooks/slo-response.md#${slo.id}` },
]));

export function createTraceContext(traceId: string, spanId: string, sampled = true): TraceContext {
  if (!TRACE_ID.test(traceId)) throw new TelemetryPolicyError("TRACE_ID_INVALID");
  if (!SPAN_ID.test(spanId)) throw new TelemetryPolicyError("SPAN_ID_INVALID");
  return { version: "00", traceId, spanId, sampled };
}

export function formatTraceparent(context: TraceContext): string {
  return `${context.version}-${context.traceId}-${context.spanId}-${context.sampled ? "01" : "00"}`;
}

export function injectOutboxTrace(context: TraceContext): OutboxTraceCarrier {
  return { schemaVersion: 1, traceparent: formatTraceparent(context) };
}

export function extractOutboxTrace(carrier: OutboxTraceCarrier): TraceContext {
  if (!carrier || carrier.schemaVersion !== 1 || Object.keys(carrier).sort().join("|") !== "schemaVersion|traceparent") {
    throw new TelemetryPolicyError("TRACE_CARRIER_INVALID");
  }
  const match = TRACEPARENT.exec(carrier.traceparent);
  if (!match?.[1] || !match[2] || !match[3]) throw new TelemetryPolicyError("TRACEPARENT_INVALID");
  return createTraceContext(match[1], match[2], match[3] === "01");
}

function validateAttributes(input: Readonly<Record<string, string>>, allowed: ReadonlySet<string>, highCardinality: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) throw new TelemetryPolicyError("ATTRIBUTE_KEY_FORBIDDEN");
    if (!(highCardinality ? HIGH_CARD_VALUE : SAFE_VALUE).test(value)) throw new TelemetryPolicyError("ATTRIBUTE_VALUE_FORBIDDEN");
    if (scanTelemetryForPrivateData({ [key]: value }).length !== 0) throw new TelemetryPolicyError("ATTRIBUTE_PRIVATE_DATA_FORBIDDEN");
    result[key] = value;
  }
  return result;
}

export class TelemetryCollector {
  private highCardinalityEnabled: boolean;
  private readonly spans: SafeSpan[] = [];
  private readonly audits: CriticalAuditRecord[] = [];
  private droppedHighCardinalityAttributes = 0;

  constructor(highCardinalityEnabled = true) { this.highCardinalityEnabled = highCardinalityEnabled; }

  setHighCardinalityEnabled(enabled: boolean): void { this.highCardinalityEnabled = enabled; }

  recordSpan(input: {
    parent: TraceContext | null;
    traceId: string;
    spanId: string;
    name: SpanName;
    kind: SpanKind;
    durationMs: number;
    attributes: Readonly<Record<string, string>>;
    highCardinalityAttributes?: Readonly<Record<string, string>>;
  }): TraceContext {
    if (!SPAN_NAMES.has(input.name) || !SPAN_KINDS.has(input.kind)) throw new TelemetryPolicyError("SPAN_SHAPE_INVALID");
    const context = createTraceContext(input.traceId, input.spanId, input.parent?.sampled ?? true);
    if (input.parent && input.parent.traceId !== input.traceId) throw new TelemetryPolicyError("TRACE_PARENT_MISMATCH");
    if (!Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > 300_000) throw new TelemetryPolicyError("SPAN_DURATION_INVALID");
    const attributes = validateAttributes(input.attributes, SAFE_ATTRIBUTE_KEYS, false);
    const high = validateAttributes(input.highCardinalityAttributes ?? {}, HIGH_CARDINALITY_KEYS, true);
    if (this.highCardinalityEnabled) Object.assign(attributes, high);
    else this.droppedHighCardinalityAttributes += Object.keys(high).length;
    this.spans.push(Object.freeze({ schemaVersion: 1, traceId: context.traceId, spanId: context.spanId, parentSpanId: input.parent?.spanId ?? null, name: input.name, kind: input.kind, durationMs: input.durationMs, attributes: Object.freeze({ ...attributes }) }));
    return context;
  }

  recordCriticalAudit(context: TraceContext, code: CriticalAuditRecord["code"], outcome: CriticalAuditRecord["outcome"]): void {
    createTraceContext(context.traceId, context.spanId, context.sampled);
    if (!AUDIT_CODES.has(code) || !AUDIT_OUTCOMES.has(outcome)) throw new TelemetryPolicyError("AUDIT_SHAPE_INVALID");
    this.audits.push(Object.freeze({ schemaVersion: 1, traceId: context.traceId, spanId: context.spanId, code, outcome }));
  }

  snapshot(): { spans: readonly SafeSpan[]; criticalAudit: readonly CriticalAuditRecord[]; droppedHighCardinalityAttributes: number } {
    return { spans: this.spans.map((span) => ({ ...span, attributes: { ...span.attributes } })), criticalAudit: this.audits.map((audit) => ({ ...audit })), droppedHighCardinalityAttributes: this.droppedHighCardinalityAttributes };
  }
}

const DOMAIN_UNIT: Readonly<Record<CostDomain, CostUnit>> = {
  GAS: "GAS_UNIT", MEDIA: "MEDIA_MINUTE", PROVIDER: "PROVIDER_CALL",
  HUMAN_AGENT: "HUMAN_MINUTE", TEST_TRAFFIC: "TEST_ACTION",
};
const COST_KEYS = ["amountMicrosEur", "domain", "economicEffect", "environment", "providerClass", "quantityMicros", "schemaVersion", "trafficClass", "unit", "workload"] as const;
const ENVIRONMENTS = new Set<DeploymentEnvironment>(["LOCAL", "DEVNET", "STAGING", "CANARY", "PRODUCTION"]);
const TRAFFIC_CLASSES = new Set<TrafficClass>(["HUMAN", "AGENT", "SYSTEM_TEST"]);
const WORKLOADS = new Set<CostEvent["workload"]>(["CHAIN_ACTION", "VOD", "EXTERNAL_ADAPTER", "ASSURANCE", "SYNTHETIC_JOURNEY"]);
const PROVIDER_CLASSES = new Set<CostEvent["providerClass"]>(["MULTIVERSX", "OBJECT_STORAGE", "MEDIA_PIPELINE", "IDENTITY", "MODEL", "HUMAN_REVIEW", "LOCAL_RUNTIME"]);

export function validateCostEvent(event: CostEvent): CostEvent {
  if (!event || Object.keys(event).sort().join("|") !== [...COST_KEYS].sort().join("|")) throw new TelemetryPolicyError("COST_SHAPE_INVALID");
  if (event.schemaVersion !== 1 || DOMAIN_UNIT[event.domain] !== event.unit || !ENVIRONMENTS.has(event.environment) || !TRAFFIC_CLASSES.has(event.trafficClass) || !WORKLOADS.has(event.workload) || !PROVIDER_CLASSES.has(event.providerClass)) throw new TelemetryPolicyError("COST_TAG_COMBINATION_INVALID");
  if (!Number.isSafeInteger(event.quantityMicros) || event.quantityMicros < 0 || !Number.isSafeInteger(event.amountMicrosEur) || event.amountMicrosEur < 0) throw new TelemetryPolicyError("COST_AMOUNT_INVALID");
  if (event.economicEffect !== false) throw new TelemetryPolicyError("ECONOMIC_EFFECT_FORBIDDEN");
  if (event.trafficClass === "SYSTEM_TEST" && event.domain !== "TEST_TRAFFIC") throw new TelemetryPolicyError("SYSTEM_TEST_COST_DOMAIN_REQUIRED");
  if (event.domain === "TEST_TRAFFIC" && (event.trafficClass !== "SYSTEM_TEST" || event.amountMicrosEur !== 0)) throw new TelemetryPolicyError("TEST_TRAFFIC_ISOLATION_REQUIRED");
  return Object.freeze({ ...event });
}

export function buildCostReport(events: readonly CostEvent[]): readonly CostReportRow[] {
  const rows = new Map<CostDomain, CostReportRow>();
  for (const candidate of events) {
    const event = validateCostEvent(candidate);
    const row = rows.get(event.domain) ?? { domain: event.domain, quantityMicros: 0, amountMicrosEur: 0, events: 0 };
    row.quantityMicros += event.quantityMicros;
    row.amountMicrosEur += event.amountMicrosEur;
    row.events += 1;
    rows.set(event.domain, row);
  }
  return (["GAS", "MEDIA", "PROVIDER", "HUMAN_AGENT", "TEST_TRAFFIC"] as const).map((domain) => Object.freeze(rows.get(domain) ?? { domain, quantityMicros: 0, amountMicrosEur: 0, events: 0 }));
}

const FORBIDDEN_KEY = /(authorization|cookie|token|secret|password|email|phone|wallet|profile|dating|child|latitude|longitude|precise.?location|message.?plaintext)/i;
const FORBIDDEN_VALUE = /(bearer\s+[a-z0-9._-]+|eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+[0-9][0-9 ()-]{7,}[0-9]|erd1[a-z0-9]{58}|\b(?:\d{1,3}\.){3}\d{1,3}\b)/i;

export function scanTelemetryForPrivateData(value: unknown): readonly string[] {
  const findings: string[] = [];
  const visited = new WeakSet<object>();
  let visitedNodes = 0;
  const visit = (node: unknown, path: string): void => {
    visitedNodes += 1;
    if (visitedNodes > 10_000) { if (!findings.includes("$telemetry:scan_limit")) findings.push("$telemetry:scan_limit"); return; }
    if (typeof node === "string") { if (FORBIDDEN_VALUE.test(node)) findings.push(`${path}:forbidden_value`); return; }
    if (node && typeof node === "object") {
      if (visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) { node.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
      for (const [key, nested] of Object.entries(node as Record<string, unknown>)) {
        if (FORBIDDEN_KEY.test(key)) findings.push(`${path}.${key}:forbidden_key`);
        visit(nested, `${path}.${key}`);
      }
    }
  };
  visit(value, "$telemetry");
  return findings;
}
