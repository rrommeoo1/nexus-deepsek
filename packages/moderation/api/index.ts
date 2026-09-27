export type ModerationSurface = "SOCIAL" | "MARKETPLACE";
export type Severity = "P0" | "P1" | "P2" | "P3";
export type CaseState = "OPEN" | "CONTAINED" | "ACTIONED" | "DISMISSED" | "APPEALED" | "UPHELD" | "OVERTURNED" | "CLOSED";
export type ActionKind = "CONTAIN" | "ACTION" | "DISMISS" | "APPEAL" | "UPHOLD" | "OVERTURN" | "CLOSE";
export type ActorRole = "SUBJECT" | "MODERATOR" | "APPEAL_REVIEWER" | "SYSTEM";

export class ModerationPolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "ModerationPolicyError"; }
}

const ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function fail(code: string): never { throw new ModerationPolicyError(code); }
function exact<T extends string>(value: unknown, options: readonly T[], code: string): T { if (typeof value !== "string" || !options.includes(value as T)) fail(code); return value as T; }
function text(value: unknown, pattern: RegExp, code: string): string { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }
function integer(value: unknown, min: number, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < min) fail(code); return value as number; }
function iso(value: unknown, code: string): string { if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value))) fail(code); return value; }
function nullableCommitment(value: unknown, code: string): string | null { return value === null ? null : text(value, HEX64, code); }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  let own: PropertyKey[], descriptors: Record<PropertyKey, PropertyDescriptor>, proto: object | null;
  try { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code); own = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); proto = Object.getPrototypeOf(value); } catch { fail(code); }
  if (proto !== Object.prototype && proto !== null) fail(code);
  if (own.some((key) => typeof key !== "string") || own.length !== keys.length || keys.some((key) => !own.includes(key))) fail(code);
  for (const key of keys) { const descriptor = descriptors[key]; if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) fail(code); }
  return value as Record<string, unknown>;
}
function frozen<T extends object>(value: T): Readonly<T> { for (const child of Object.values(value)) if (child && typeof child === "object") frozen(child); return Object.freeze(value); }

export interface ReportEnvelope {
  schemaVersion: 1;
  reportId: string;
  caseId: string;
  surface: ModerationSurface;
  reporterCommitment: string;
  subjectAccountCommitment: string;
  contentCommitment: string;
  evidenceVaultCommitment: string;
  categoryCode: string;
  severity: Severity;
  policyVersion: number;
  reportedAt: string;
  evidenceExpiresAt: string;
  actorClass: "SYSTEM_TEST";
  issuerKeyId: string;
  signature: string;
}

export interface ModerationCase {
  schemaVersion: 1;
  caseId: string;
  reportId: string;
  surface: ModerationSurface;
  reporterCommitment: string;
  subjectAccountCommitment: string;
  contentCommitment: string;
  evidenceVaultCommitment: string;
  categoryCode: string;
  severity: Severity;
  policyVersion: number;
  state: CaseState;
  containmentExpiresAt: string | null;
  moderatorCommitment: string | null;
  appealReviewerCommitment: string | null;
  lastActionId: string;
  createdAt: string;
  updatedAt: string;
  evidenceExpiresAt: string;
  actorClass: "SYSTEM_TEST";
}

export interface ModerationAction {
  schemaVersion: 1;
  actionId: string;
  caseId: string;
  kind: ActionKind;
  actorRole: ActorRole;
  actorCommitment: string;
  reasonCode: string;
  policyVersion: number;
  actedAt: string;
  containmentExpiresAt: string | null;
  actorClass: "SYSTEM_TEST";
  issuerKeyId: string;
  signature: string;
}

export interface SignedVerifier<T> { verify(value: Readonly<T>): boolean }
export interface CheckpointVerifier<T> { verify(value: Readonly<T>): boolean }

const REPORT_KEYS = ["schemaVersion", "reportId", "caseId", "surface", "reporterCommitment", "subjectAccountCommitment", "contentCommitment", "evidenceVaultCommitment", "categoryCode", "severity", "policyVersion", "reportedAt", "evidenceExpiresAt", "actorClass", "issuerKeyId", "signature"] as const;
const ACTION_KEYS = ["schemaVersion", "actionId", "caseId", "kind", "actorRole", "actorCommitment", "reasonCode", "policyVersion", "actedAt", "containmentExpiresAt", "actorClass", "issuerKeyId", "signature"] as const;

function parseReport(value: unknown): ReportEnvelope {
  const o = plain(value, REPORT_KEYS, "REPORT_INVALID");
  if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("REPORT_INVALID");
  const report: ReportEnvelope = {
    schemaVersion: 1,
    reportId: text(o.reportId, ID, "REPORT_INVALID"),
    caseId: text(o.caseId, ID, "REPORT_INVALID"),
    surface: exact(o.surface, ["SOCIAL", "MARKETPLACE"], "SURFACE_INVALID"),
    reporterCommitment: text(o.reporterCommitment, HEX64, "REPORT_INVALID"),
    subjectAccountCommitment: text(o.subjectAccountCommitment, HEX64, "REPORT_INVALID"),
    contentCommitment: text(o.contentCommitment, HEX64, "REPORT_INVALID"),
    evidenceVaultCommitment: text(o.evidenceVaultCommitment, HEX64, "REPORT_INVALID"),
    categoryCode: text(o.categoryCode, ID, "CATEGORY_INVALID"),
    severity: exact(o.severity, ["P0", "P1", "P2", "P3"], "SEVERITY_INVALID"),
    policyVersion: integer(o.policyVersion, 1, "POLICY_VERSION_INVALID"),
    reportedAt: iso(o.reportedAt, "REPORT_TIME_INVALID"),
    evidenceExpiresAt: iso(o.evidenceExpiresAt, "REPORT_TIME_INVALID"),
    actorClass: "SYSTEM_TEST",
    issuerKeyId: text(o.issuerKeyId, ID, "REPORT_INVALID"),
    signature: text(o.signature, HEX64, "REPORT_INVALID")
  };
  if (report.reporterCommitment === report.subjectAccountCommitment || Date.parse(report.evidenceExpiresAt) <= Date.parse(report.reportedAt)) fail("REPORT_INVALID");
  return report;
}

function parseAction(value: unknown): ModerationAction {
  const o = plain(value, ACTION_KEYS, "ACTION_INVALID");
  if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("ACTION_INVALID");
  const result: ModerationAction = {
    schemaVersion: 1,
    actionId: text(o.actionId, ID, "ACTION_INVALID"),
    caseId: text(o.caseId, ID, "ACTION_INVALID"),
    kind: exact(o.kind, ["CONTAIN", "ACTION", "DISMISS", "APPEAL", "UPHOLD", "OVERTURN", "CLOSE"], "ACTION_KIND_INVALID"),
    actorRole: exact(o.actorRole, ["SUBJECT", "MODERATOR", "APPEAL_REVIEWER", "SYSTEM"], "ACTOR_ROLE_INVALID"),
    actorCommitment: text(o.actorCommitment, HEX64, "ACTION_INVALID"),
    reasonCode: text(o.reasonCode, ID, "REASON_INVALID"),
    policyVersion: integer(o.policyVersion, 1, "POLICY_VERSION_INVALID"),
    actedAt: iso(o.actedAt, "ACTION_TIME_INVALID"),
    containmentExpiresAt: o.containmentExpiresAt === null ? null : iso(o.containmentExpiresAt, "ACTION_TIME_INVALID"),
    actorClass: "SYSTEM_TEST",
    issuerKeyId: text(o.issuerKeyId, ID, "ACTION_INVALID"),
    signature: text(o.signature, HEX64, "ACTION_INVALID")
  };
  if ((result.kind === "CONTAIN") !== (result.containmentExpiresAt !== null) || (result.containmentExpiresAt !== null && Date.parse(result.containmentExpiresAt) <= Date.parse(result.actedAt))) fail("CONTAINMENT_EXPIRY_INVALID");
  return result;
}

const CASE_KEYS = ["schemaVersion", "caseId", "reportId", "surface", "reporterCommitment", "subjectAccountCommitment", "contentCommitment", "evidenceVaultCommitment", "categoryCode", "severity", "policyVersion", "state", "containmentExpiresAt", "moderatorCommitment", "appealReviewerCommitment", "lastActionId", "createdAt", "updatedAt", "evidenceExpiresAt", "actorClass"] as const;
function parseCase(value: unknown): ModerationCase {
  const o = plain(value, CASE_KEYS, "CASE_SNAPSHOT_INVALID");
  if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("CASE_SNAPSHOT_INVALID");
  const result: ModerationCase = {
    schemaVersion: 1,
    caseId: text(o.caseId, ID, "CASE_SNAPSHOT_INVALID"),
    reportId: text(o.reportId, ID, "CASE_SNAPSHOT_INVALID"),
    surface: exact(o.surface, ["SOCIAL", "MARKETPLACE"], "CASE_SNAPSHOT_INVALID"),
    reporterCommitment: text(o.reporterCommitment, HEX64, "CASE_SNAPSHOT_INVALID"),
    subjectAccountCommitment: text(o.subjectAccountCommitment, HEX64, "CASE_SNAPSHOT_INVALID"),
    contentCommitment: text(o.contentCommitment, HEX64, "CASE_SNAPSHOT_INVALID"),
    evidenceVaultCommitment: text(o.evidenceVaultCommitment, HEX64, "CASE_SNAPSHOT_INVALID"),
    categoryCode: text(o.categoryCode, ID, "CASE_SNAPSHOT_INVALID"),
    severity: exact(o.severity, ["P0", "P1", "P2", "P3"], "CASE_SNAPSHOT_INVALID"),
    policyVersion: integer(o.policyVersion, 1, "CASE_SNAPSHOT_INVALID"),
    state: exact(o.state, ["OPEN", "CONTAINED", "ACTIONED", "DISMISSED", "APPEALED", "UPHELD", "OVERTURNED", "CLOSED"], "CASE_SNAPSHOT_INVALID"),
    containmentExpiresAt: o.containmentExpiresAt === null ? null : iso(o.containmentExpiresAt, "CASE_SNAPSHOT_INVALID"),
    moderatorCommitment: nullableCommitment(o.moderatorCommitment, "CASE_SNAPSHOT_INVALID"),
    appealReviewerCommitment: nullableCommitment(o.appealReviewerCommitment, "CASE_SNAPSHOT_INVALID"),
    lastActionId: text(o.lastActionId, ID, "CASE_SNAPSHOT_INVALID"),
    createdAt: iso(o.createdAt, "CASE_SNAPSHOT_INVALID"),
    updatedAt: iso(o.updatedAt, "CASE_SNAPSHOT_INVALID"),
    evidenceExpiresAt: iso(o.evidenceExpiresAt, "CASE_SNAPSHOT_INVALID"),
    actorClass: "SYSTEM_TEST"
  };
  if (Date.parse(result.createdAt) > Date.parse(result.updatedAt) || Date.parse(result.evidenceExpiresAt) <= Date.parse(result.createdAt)) fail("CASE_SNAPSHOT_INVALID");
  return result;
}
function reportBinding(value: ReportEnvelope): string { return [value.schemaVersion, value.reportId, value.caseId, value.surface, value.reporterCommitment, value.subjectAccountCommitment, value.contentCommitment, value.evidenceVaultCommitment, value.categoryCode, value.severity, value.policyVersion, value.reportedAt, value.evidenceExpiresAt, value.actorClass, value.issuerKeyId, value.signature].join("|"); }
function actionBinding(value: ModerationAction): string { return [value.schemaVersion, value.actionId, value.caseId, value.kind, value.actorRole, value.actorCommitment, value.reasonCode, value.policyVersion, value.actedAt, value.containmentExpiresAt, value.actorClass, value.issuerKeyId, value.signature].join("|"); }
function caseBinding(value: ModerationCase): string { return CASE_KEYS.map((key) => String(value[key])).join("|"); }

export interface BlockCommand {
  schemaVersion: 1;
  blockId: string;
  blockerAccountCommitment: string;
  blockedAccountCommitment: string;
  createdAt: string;
  actorClass: "SYSTEM_TEST";
  issuerKeyId: string;
  signature: string;
}

export interface BlockEvent { ordinal: number; command: BlockCommand; fingerprint: string }
export interface BlockRegistrySnapshot { schemaVersion: 1; nextOrdinal: number; events: BlockEvent[]; checkpointHash: string }
const BLOCK_KEYS = ["schemaVersion", "blockId", "blockerAccountCommitment", "blockedAccountCommitment", "createdAt", "actorClass", "issuerKeyId", "signature"] as const;
const BLOCK_EVENT_KEYS = ["ordinal", "command", "fingerprint"] as const;
function parseBlock(value: unknown): BlockCommand {
  const o = plain(value, BLOCK_KEYS, "BLOCK_INVALID");
  if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("BLOCK_INVALID");
  const result: BlockCommand = { schemaVersion: 1, blockId: text(o.blockId, ID, "BLOCK_INVALID"), blockerAccountCommitment: text(o.blockerAccountCommitment, HEX64, "BLOCK_INVALID"), blockedAccountCommitment: text(o.blockedAccountCommitment, HEX64, "BLOCK_INVALID"), createdAt: iso(o.createdAt, "BLOCK_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: text(o.issuerKeyId, ID, "BLOCK_INVALID"), signature: text(o.signature, HEX64, "BLOCK_INVALID") };
  if (result.blockerAccountCommitment === result.blockedAccountCommitment) fail("BLOCK_INVALID");
  return result;
}
function blockBinding(value: BlockCommand): string { return BLOCK_KEYS.map((key) => String(value[key])).join("|"); }
function blockFingerprint(ordinal: number, command: BlockCommand): string { return `${ordinal}|${blockBinding(command)}`; }

export class AccountBlockRegistry {
  private readonly records = new Map<string, BlockCommand>();
  private readonly blockIds = new Set<string>();
  private readonly events: BlockEvent[] = [];
  private nextOrdinal = 1;
  block(commandInput: unknown, verifier: SignedVerifier<BlockCommand>, nowInput: unknown): Readonly<BlockCommand> {
    const command = parseBlock(commandInput), now = iso(nowInput, "BLOCK_INVALID");
    if (Date.parse(command.createdAt) > Date.parse(now)) fail("BLOCK_INVALID");
    const signed = frozen({ ...command });
    if (!verifier || verifier.verify(signed) !== true) fail("BLOCK_SIGNATURE_INVALID");
    const key = `${command.blockerAccountCommitment}>${command.blockedAccountCommitment}`;
    if (this.records.has(key) || this.blockIds.has(command.blockId)) fail("BLOCK_REPLAY");
    const event: BlockEvent = { ordinal: this.nextOrdinal++, command, fingerprint: blockFingerprint(this.nextOrdinal - 1, command) };
    this.records.set(key, command); this.blockIds.add(command.blockId); this.events.push(event);
    return frozen({ ...command });
  }
  isBlocked(blockerInput: unknown, blockedInput: unknown, surfaceInput: unknown): boolean {
    const blocker = text(blockerInput, HEX64, "BLOCK_INVALID"), blocked = text(blockedInput, HEX64, "BLOCK_INVALID");
    exact(surfaceInput, ["SOCIAL", "MARKETPLACE"], "SURFACE_INVALID");
    return this.records.has(`${blocker}>${blocked}`);
  }
  snapshot(checkpointHashInput: unknown): Readonly<BlockRegistrySnapshot> {
    const checkpointHash = text(checkpointHashInput, HEX64, "CHECKPOINT_HASH_INVALID");
    return frozen({ schemaVersion: 1 as const, nextOrdinal: this.nextOrdinal, events: this.events.map((event) => ({ ...event, command: { ...event.command } })), checkpointHash });
  }
  static restore(input: unknown, commandVerifier: SignedVerifier<BlockCommand>, checkpointVerifier: CheckpointVerifier<BlockRegistrySnapshot>, nowInput: unknown): AccountBlockRegistry {
    const o = plain(input, ["schemaVersion", "nextOrdinal", "events", "checkpointHash"], "BLOCK_SNAPSHOT_INVALID");
    if (o.schemaVersion !== 1 || !commandVerifier || !checkpointVerifier) fail("BLOCK_SNAPSHOT_INVALID");
    const nextOrdinal = integer(o.nextOrdinal, 1, "BLOCK_SNAPSHOT_INVALID"), checkpointHash = text(o.checkpointHash, HEX64, "BLOCK_SNAPSHOT_INVALID"), events: BlockEvent[] = [];
    let expected = 1;
    for (const item of Array.isArray(o.events) ? o.events : fail("BLOCK_SNAPSHOT_INVALID")) {
      const row = plain(item, BLOCK_EVENT_KEYS, "BLOCK_SNAPSHOT_INVALID"), ordinal = integer(row.ordinal, 1, "BLOCK_SNAPSHOT_INVALID"), command = parseBlock(row.command), fingerprint = text(row.fingerprint, /^.{3,4096}$/, "BLOCK_SNAPSHOT_INVALID");
      if (ordinal !== expected++ || fingerprint !== blockFingerprint(ordinal, command)) fail("BLOCK_SNAPSHOT_INVALID");
      events.push({ ordinal, command, fingerprint });
    }
    if (nextOrdinal !== expected) fail("BLOCK_SNAPSHOT_INVALID");
    const candidate = frozen({ schemaVersion: 1 as const, nextOrdinal, events: events.map((event) => ({ ...event, command: { ...event.command } })), checkpointHash });
    if (checkpointVerifier.verify(candidate) !== true) fail("BLOCK_CHECKPOINT_UNVERIFIED");
    const registry = new AccountBlockRegistry();
    for (const event of events) registry.block(event.command, commandVerifier, nowInput);
    if (registry.nextOrdinal !== nextOrdinal) fail("BLOCK_SNAPSHOT_INVALID");
    return registry;
  }
}

export interface ModerationEvent { ordinal: number; kind: "REPORT" | "ACTION"; report: ReportEnvelope | null; action: ModerationAction | null; fingerprint: string }
export interface ModerationCaseSnapshot { schemaVersion: 1; nextOrdinal: number; events: ModerationEvent[]; current: ModerationCase; checkpointHash: string }
const MODERATION_EVENT_KEYS = ["ordinal", "kind", "report", "action", "fingerprint"] as const;
function moderationEventFingerprint(ordinal: number, kind: "REPORT" | "ACTION", report: ReportEnvelope | null, action: ModerationAction | null): string { return [ordinal, kind, report === null ? "" : reportBinding(report), action === null ? "" : actionBinding(action)].join("|"); }

export class ModerationCaseMachine {
  private current: ModerationCase;
  private readonly actionIds = new Set<string>();
  private readonly events: ModerationEvent[] = [];
  private nextOrdinal = 1;

  private constructor(initial: ModerationCase) { this.current = initial; }

  private static initial(report: ReportEnvelope): ModerationCase {
    return { schemaVersion: 1, caseId: report.caseId, reportId: report.reportId, surface: report.surface, reporterCommitment: report.reporterCommitment, subjectAccountCommitment: report.subjectAccountCommitment, contentCommitment: report.contentCommitment, evidenceVaultCommitment: report.evidenceVaultCommitment, categoryCode: report.categoryCode, severity: report.severity, policyVersion: report.policyVersion, state: "OPEN", containmentExpiresAt: null, moderatorCommitment: null, appealReviewerCommitment: null, lastActionId: report.reportId, createdAt: report.reportedAt, updatedAt: report.reportedAt, evidenceExpiresAt: report.evidenceExpiresAt, actorClass: "SYSTEM_TEST" };
  }

  private append(kind: "REPORT" | "ACTION", report: ReportEnvelope | null, action: ModerationAction | null): void {
    const ordinal = this.nextOrdinal++;
    this.events.push({ ordinal, kind, report, action, fingerprint: moderationEventFingerprint(ordinal, kind, report, action) });
  }

  static open(reportInput: unknown, verifier: SignedVerifier<ReportEnvelope>, nowInput: unknown): ModerationCaseMachine {
    const report = parseReport(reportInput), now = iso(nowInput, "REPORT_TIME_INVALID");
    if (Date.parse(report.reportedAt) > Date.parse(now) || Date.parse(report.evidenceExpiresAt) <= Date.parse(now)) fail("REPORT_TIME_INVALID");
    const signed = frozen({ ...report });
    if (!verifier || verifier.verify(signed) !== true) fail("REPORT_SIGNATURE_INVALID");
    const machine = new ModerationCaseMachine(ModerationCaseMachine.initial(report));
    machine.append("REPORT", report, null);
    return machine;
  }

  view(): Readonly<ModerationCase> { return frozen({ ...this.current }); }

  apply(actionInput: unknown, verifier: SignedVerifier<ModerationAction>, nowInput: unknown): Readonly<ModerationCase> {
    const action = parseAction(actionInput), now = iso(nowInput, "ACTION_TIME_INVALID");
    if (action.caseId !== this.current.caseId || action.policyVersion !== this.current.policyVersion) fail("ACTION_BINDING_MISMATCH");
    if (Date.parse(action.actedAt) < Date.parse(this.current.updatedAt) || Date.parse(action.actedAt) > Date.parse(now)) fail("ACTION_TIME_INVALID");
    const signed = frozen({ ...action });
    if (!verifier || verifier.verify(signed) !== true) fail("ACTION_SIGNATURE_INVALID");
    if (this.actionIds.has(action.actionId) || action.actionId === this.current.reportId) fail("ACTION_REPLAY");

    let state: CaseState = this.current.state, containmentExpiresAt = this.current.containmentExpiresAt, moderator = this.current.moderatorCommitment, reviewer = this.current.appealReviewerCommitment;
    if (action.kind === "CONTAIN") {
      if (this.current.severity !== "P0" || state !== "OPEN" || !["SYSTEM", "MODERATOR"].includes(action.actorRole)) fail("TRANSITION_DENIED");
      if (action.containmentExpiresAt === null || Date.parse(action.containmentExpiresAt) <= Date.parse(now)) fail("CONTAINMENT_EXPIRED");
      if (action.actorRole === "MODERATOR" && (action.actorCommitment === this.current.reporterCommitment || action.actorCommitment === this.current.subjectAccountCommitment)) fail("REVIEWER_SEPARATION_DENIED");
      state = "CONTAINED"; containmentExpiresAt = action.containmentExpiresAt; if (action.actorRole === "MODERATOR") moderator = action.actorCommitment;
    } else if (action.kind === "ACTION" || action.kind === "DISMISS") {
      if (!["OPEN", "CONTAINED"].includes(state) || action.actorRole !== "MODERATOR" || (this.current.severity === "P0" && state !== "CONTAINED")) fail("TRANSITION_DENIED");
      if (this.current.severity === "P0" && (containmentExpiresAt === null || Date.parse(containmentExpiresAt) <= Date.parse(now))) fail("CONTAINMENT_EXPIRED");
      if (action.actorCommitment === this.current.reporterCommitment || action.actorCommitment === this.current.subjectAccountCommitment) fail("REVIEWER_SEPARATION_DENIED");
      state = action.kind === "ACTION" ? "ACTIONED" : "DISMISSED"; containmentExpiresAt = null; moderator = action.actorCommitment;
    } else if (action.kind === "APPEAL") {
      if (!["ACTIONED", "DISMISSED"].includes(state) || action.actorRole !== "SUBJECT" || action.actorCommitment !== this.current.subjectAccountCommitment) fail("TRANSITION_DENIED");
      state = "APPEALED";
    } else if (action.kind === "UPHOLD" || action.kind === "OVERTURN") {
      if (state !== "APPEALED" || action.actorRole !== "APPEAL_REVIEWER") fail("TRANSITION_DENIED");
      if (action.actorCommitment === moderator || action.actorCommitment === this.current.reporterCommitment || action.actorCommitment === this.current.subjectAccountCommitment) fail("REVIEWER_SEPARATION_DENIED");
      state = action.kind === "UPHOLD" ? "UPHELD" : "OVERTURNED"; reviewer = action.actorCommitment;
    } else if (action.kind === "CLOSE") {
      if (!["UPHELD", "OVERTURNED"].includes(state) || action.actorRole !== "SYSTEM") fail("TRANSITION_DENIED");
      state = "CLOSED";
    }
    this.actionIds.add(action.actionId);
    this.current = { ...this.current, state, containmentExpiresAt, moderatorCommitment: moderator, appealReviewerCommitment: reviewer, lastActionId: action.actionId, updatedAt: action.actedAt };
    this.append("ACTION", null, action);
    return this.view();
  }

  snapshot(checkpointHashInput: unknown): Readonly<ModerationCaseSnapshot> {
    const checkpointHash = text(checkpointHashInput, HEX64, "CHECKPOINT_HASH_INVALID");
    return frozen({ schemaVersion: 1 as const, nextOrdinal: this.nextOrdinal, events: this.events.map((event) => ({ ...event, report: event.report === null ? null : { ...event.report }, action: event.action === null ? null : { ...event.action } })), current: { ...this.current }, checkpointHash });
  }

  static restore(input: unknown, reportVerifier: SignedVerifier<ReportEnvelope>, actionVerifier: SignedVerifier<ModerationAction>, checkpointVerifier: CheckpointVerifier<ModerationCaseSnapshot>, nowInput: unknown): ModerationCaseMachine {
    const o = plain(input, ["schemaVersion", "nextOrdinal", "events", "current", "checkpointHash"], "CASE_SNAPSHOT_INVALID");
    if (o.schemaVersion !== 1 || !reportVerifier || !actionVerifier || !checkpointVerifier) fail("CASE_SNAPSHOT_INVALID");
    const nextOrdinal = integer(o.nextOrdinal, 2, "CASE_SNAPSHOT_INVALID"), checkpointHash = text(o.checkpointHash, HEX64, "CASE_SNAPSHOT_INVALID"), current = parseCase(o.current), restoreNow = iso(nowInput, "CASE_SNAPSHOT_INVALID"), events: ModerationEvent[] = [];
    if (Date.parse(current.updatedAt) > Date.parse(restoreNow)) fail("CASE_SNAPSHOT_INVALID");
    let expected = 1;
    for (const item of Array.isArray(o.events) ? o.events : fail("CASE_SNAPSHOT_INVALID")) {
      const row = plain(item, MODERATION_EVENT_KEYS, "CASE_SNAPSHOT_INVALID"), ordinal = integer(row.ordinal, 1, "CASE_SNAPSHOT_INVALID"), kind = exact(row.kind, ["REPORT", "ACTION"], "CASE_SNAPSHOT_INVALID"), report = row.report === null ? null : parseReport(row.report), action = row.action === null ? null : parseAction(row.action), fingerprint = text(row.fingerprint, /^.{3,8192}$/, "CASE_SNAPSHOT_INVALID");
      if (ordinal !== expected++ || (kind === "REPORT") !== (report !== null) || (kind === "ACTION") !== (action !== null) || (kind === "REPORT" && action !== null) || (kind === "ACTION" && report !== null) || fingerprint !== moderationEventFingerprint(ordinal, kind, report, action)) fail("CASE_SNAPSHOT_INVALID");
      events.push({ ordinal, kind, report, action, fingerprint });
    }
    if (events.length === 0 || events[0].kind !== "REPORT" || events.slice(1).some((event) => event.kind !== "ACTION") || nextOrdinal !== expected) fail("CASE_SNAPSHOT_INVALID");
    const candidate = frozen({ schemaVersion: 1 as const, nextOrdinal, events: events.map((event) => ({ ...event, report: event.report === null ? null : { ...event.report }, action: event.action === null ? null : { ...event.action } })), current: { ...current }, checkpointHash });
    if (checkpointVerifier.verify(candidate) !== true) fail("CASE_CHECKPOINT_UNVERIFIED");
    const first = events[0].report;
    if (first === null || reportVerifier.verify(frozen({ ...first })) !== true) fail("REPORT_SIGNATURE_INVALID");
    const machine = new ModerationCaseMachine(ModerationCaseMachine.initial(first));
    machine.append("REPORT", first, null);
    for (const event of events.slice(1)) {
      if (event.action === null) fail("CASE_SNAPSHOT_INVALID");
      machine.apply(event.action, actionVerifier, event.action.actedAt);
    }
    if (machine.nextOrdinal !== nextOrdinal || caseBinding(machine.current) !== caseBinding(current) || machine.events.some((event, index) => event.fingerprint !== events[index].fingerprint)) fail("CASE_SNAPSHOT_INVALID");
    return machine;
  }
}

export interface ModerationAuditTrace {
  schemaVersion: 1;
  traceId: string;
  caseCommitment: string;
  subjectAccountCommitment: string;
  evidenceVaultCommitment: string;
  surface: ModerationSurface;
  state: CaseState;
  reasonCode: string;
  occurredAt: string;
  actorClass: "SYSTEM_TEST";
}
const TRACE_KEYS = ["schemaVersion", "traceId", "caseCommitment", "subjectAccountCommitment", "evidenceVaultCommitment", "surface", "state", "reasonCode", "occurredAt", "actorClass"] as const;
export function buildModerationAuditTrace(value: unknown): Readonly<ModerationAuditTrace> {
  const o = plain(value, TRACE_KEYS, "TRACE_INVALID");
  if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("TRACE_INVALID");
  return frozen({ schemaVersion: 1, traceId: text(o.traceId, HEX64, "TRACE_INVALID"), caseCommitment: text(o.caseCommitment, HEX64, "TRACE_INVALID"), subjectAccountCommitment: text(o.subjectAccountCommitment, HEX64, "TRACE_INVALID"), evidenceVaultCommitment: text(o.evidenceVaultCommitment, HEX64, "TRACE_INVALID"), surface: exact(o.surface, ["SOCIAL", "MARKETPLACE"], "SURFACE_INVALID"), state: exact(o.state, ["OPEN", "CONTAINED", "ACTIONED", "DISMISSED", "APPEALED", "UPHELD", "OVERTURNED", "CLOSED"], "STATE_INVALID"), reasonCode: text(o.reasonCode, ID, "REASON_INVALID"), occurredAt: iso(o.occurredAt, "TRACE_INVALID"), actorClass: "SYSTEM_TEST" });
}
