import { AccountBlockRegistry, BlockCommand, ModerationAction, ModerationCaseMachine, ModerationPolicyError, ReportEnvelope, buildModerationAuditTrace } from "./index";
declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof ModerationPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
const H = "a".repeat(64), REPORTER = "1".repeat(64), SUBJECT = "2".repeat(64), MODERATOR = "3".repeat(64), REVIEWER = "4".repeat(64), NOW = "2026-08-09T20:00:00Z";
const reportVerifier = { verify: (value: Readonly<ReportEnvelope>) => value.signature === H && value.actorClass === "SYSTEM_TEST" };
const actionVerifier = { verify: (value: Readonly<ModerationAction>) => value.signature === H && value.actorClass === "SYSTEM_TEST" };
const blockVerifier = { verify: (value: Readonly<BlockCommand>) => value.signature === H && value.actorClass === "SYSTEM_TEST" };
function report(surface: "SOCIAL" | "MARKETPLACE", suffix: string, severity: "P0" | "P1" = "P1"): ReportEnvelope { return { schemaVersion: 1, reportId: `REPORT:${suffix}`, caseId: `CASE:${suffix}`, surface, reporterCommitment: REPORTER, subjectAccountCommitment: SUBJECT, contentCommitment: "5".repeat(64), evidenceVaultCommitment: "6".repeat(64), categoryCode: "POLICY:ILLEGAL_GOODS", severity, policyVersion: 1, reportedAt: "2026-08-09T19:00:00Z", evidenceExpiresAt: "2026-09-09T19:00:00Z", actorClass: "SYSTEM_TEST", issuerKeyId: "KEY:REPORT:1", signature: H }; }
function action(caseId: string, actionId: string, kind: ModerationAction["kind"], actorRole: ModerationAction["actorRole"], actorCommitment: string, at = NOW): ModerationAction { return { schemaVersion: 1, actionId, caseId, kind, actorRole, actorCommitment, reasonCode: `REASON:${kind}`, policyVersion: 1, actedAt: at, containmentExpiresAt: kind === "CONTAIN" ? "2026-08-10T20:00:00Z" : null, actorClass: "SYSTEM_TEST", issuerKeyId: "KEY:ACTION:1", signature: H }; }
function block(blockId: string): BlockCommand { return { schemaVersion: 1, blockId, blockerAccountCommitment: REPORTER, blockedAccountCommitment: SUBJECT, createdAt: NOW, actorClass: "SYSTEM_TEST", issuerKeyId: "KEY:BLOCK:1", signature: H }; }

function standardFlow(surface: "SOCIAL" | "MARKETPLACE", suffix: string): void {
  const machine = ModerationCaseMachine.open(report(surface, suffix), reportVerifier, NOW);
  assert(machine.view().state === "OPEN" && machine.view().surface === surface, `${surface} report opens`);
  const decided = machine.apply(action(`CASE:${suffix}`, `ACTION:${suffix}:1`, "ACTION", "MODERATOR", MODERATOR), actionVerifier, NOW);
  assert(decided.state === "ACTIONED" && decided.moderatorCommitment === MODERATOR, `${surface} moderator action`);
  const appealed = machine.apply(action(`CASE:${suffix}`, `ACTION:${suffix}:2`, "APPEAL", "SUBJECT", SUBJECT), actionVerifier, NOW);
  assert(appealed.state === "APPEALED", `${surface} subject appeal`);
  const resolved = machine.apply(action(`CASE:${suffix}`, `ACTION:${suffix}:3`, "OVERTURN", "APPEAL_REVIEWER", REVIEWER), actionVerifier, NOW);
  assert(resolved.state === "OVERTURNED" && resolved.appealReviewerCommitment === REVIEWER, `${surface} independent appeal`);
  assert(machine.apply(action(`CASE:${suffix}`, `ACTION:${suffix}:4`, "CLOSE", "SYSTEM", "7".repeat(64)), actionVerifier, NOW).state === "CLOSED", `${surface} closes`);
}

function main(): void {
  standardFlow("SOCIAL", "SOCIAL:1");
  standardFlow("MARKETPLACE", "MARKET:1");
  expectCode(() => ModerationCaseMachine.open({ ...report("SOCIAL", "BAD:EXTRA"), rawContent: "secret" }, reportVerifier, NOW), "REPORT_INVALID");
  expectCode(() => ModerationCaseMachine.open({ ...report("SOCIAL", "BAD:ACTOR"), actorClass: "HUMAN" }, reportVerifier, NOW), "REPORT_INVALID");
  expectCode(() => ModerationCaseMachine.open({ ...report("SOCIAL", "BAD:EVIDENCE"), evidenceVaultCommitment: "raw evidence" }, reportVerifier, NOW), "REPORT_INVALID");
  expectCode(() => ModerationCaseMachine.open({ ...report("SOCIAL", "BAD:SIGNATURE"), signature: "b".repeat(64) }, reportVerifier, NOW), "REPORT_SIGNATURE_INVALID");

  const p0 = ModerationCaseMachine.open(report("MARKETPLACE", "P0:1", "P0"), reportVerifier, NOW);
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:FINAL", "ACTION", "MODERATOR", MODERATOR), actionVerifier, NOW), "TRANSITION_DENIED");
  expectCode(() => p0.apply({ ...action("CASE:P0:1", "ACTION:P0:NOEXPIRY", "CONTAIN", "SYSTEM", "7".repeat(64)), containmentExpiresAt: null }, actionVerifier, NOW), "CONTAINMENT_EXPIRY_INVALID");
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:SUBJECTCONTAIN", "CONTAIN", "MODERATOR", SUBJECT), actionVerifier, NOW), "REVIEWER_SEPARATION_DENIED");
  expectCode(() => p0.apply({ ...action("CASE:P0:1", "ACTION:P0:STALECONTAIN", "CONTAIN", "SYSTEM", "7".repeat(64), "2026-08-09T19:05:00Z"), containmentExpiresAt: "2026-08-09T19:30:00Z" }, actionVerifier, NOW), "CONTAINMENT_EXPIRED");
  assert(p0.apply(action("CASE:P0:1", "ACTION:P0:CONTAIN", "CONTAIN", "SYSTEM", "7".repeat(64)), actionVerifier, NOW).state === "CONTAINED", "P0 containment precedes final decision");
  assert(p0.apply(action("CASE:P0:1", "ACTION:P0:ACTION", "ACTION", "MODERATOR", MODERATOR), actionVerifier, NOW).state === "ACTIONED", "P0 final action follows containment");
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:BADAPPEAL", "APPEAL", "SUBJECT", REPORTER), actionVerifier, NOW), "TRANSITION_DENIED");
  p0.apply(action("CASE:P0:1", "ACTION:P0:APPEAL", "APPEAL", "SUBJECT", SUBJECT), actionVerifier, NOW);
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:SAME", "UPHOLD", "APPEAL_REVIEWER", MODERATOR), actionVerifier, NOW), "REVIEWER_SEPARATION_DENIED");
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:REPORTER", "UPHOLD", "APPEAL_REVIEWER", REPORTER), actionVerifier, NOW), "REVIEWER_SEPARATION_DENIED");
  assert(p0.apply(action("CASE:P0:1", "ACTION:P0:UPHOLD", "UPHOLD", "APPEAL_REVIEWER", REVIEWER), actionVerifier, NOW).state === "UPHELD", "separate reviewer resolves P0 appeal");
  expectCode(() => p0.apply(action("CASE:P0:1", "ACTION:P0:UPHOLD", "CLOSE", "SYSTEM", "7".repeat(64)), actionVerifier, NOW), "ACTION_REPLAY");
  const expiredWindow = ModerationCaseMachine.open(report("SOCIAL", "P0:EXPIRED", "P0"), reportVerifier, "2026-08-09T19:05:00Z");
  expiredWindow.apply({ ...action("CASE:P0:EXPIRED", "ACTION:P0:EXPIRED:CONTAIN", "CONTAIN", "SYSTEM", "7".repeat(64), "2026-08-09T19:05:00Z"), containmentExpiresAt: "2026-08-09T19:30:00Z" }, actionVerifier, "2026-08-09T19:05:00Z");
  expectCode(() => expiredWindow.apply(action("CASE:P0:EXPIRED", "ACTION:P0:EXPIRED:FINAL", "ACTION", "MODERATOR", MODERATOR, "2026-08-09T19:40:00Z"), actionVerifier, "2026-08-09T19:40:00Z"), "CONTAINMENT_EXPIRED");
  const caseSnapshot = p0.snapshot("d".repeat(64)), caseCanonical = JSON.stringify(caseSnapshot);
  const restoredCase = ModerationCaseMachine.restore(caseSnapshot, reportVerifier, actionVerifier, { verify: (candidate) => JSON.stringify(candidate) === caseCanonical }, NOW);
  assert(restoredCase.view().state === "UPHELD", "case state and lineage survive verified restart");
  expectCode(() => restoredCase.apply(action("CASE:P0:1", "ACTION:P0:UPHOLD", "CLOSE", "SYSTEM", "7".repeat(64)), actionVerifier, NOW), "ACTION_REPLAY");
  expectCode(() => ModerationCaseMachine.restore({ ...caseSnapshot, current: { ...caseSnapshot.current, state: "OVERTURNED" } }, reportVerifier, actionVerifier, { verify: () => true }, NOW), "CASE_SNAPSHOT_INVALID");
  expectCode(() => ModerationCaseMachine.restore({ ...caseSnapshot, events: caseSnapshot.events.slice(0, -1) }, reportVerifier, actionVerifier, { verify: () => true }, NOW), "CASE_SNAPSHOT_INVALID");
  expectCode(() => ModerationCaseMachine.restore({ ...caseSnapshot, events: [...caseSnapshot.events].reverse() }, reportVerifier, actionVerifier, { verify: () => true }, NOW), "CASE_SNAPSHOT_INVALID");
  expectCode(() => ModerationCaseMachine.restore(caseSnapshot, reportVerifier, actionVerifier, { verify: () => false }, NOW), "CASE_CHECKPOINT_UNVERIFIED");

  const blocks = new AccountBlockRegistry();
  blocks.block(block("BLOCK:1"), blockVerifier, NOW);
  assert(blocks.isBlocked(REPORTER, SUBJECT, "SOCIAL"), "account block applies to Social");
  assert(blocks.isBlocked(REPORTER, SUBJECT, "MARKETPLACE"), "same account block applies to Marketplace");
  expectCode(() => blocks.block(block("BLOCK:2"), blockVerifier, NOW), "BLOCK_REPLAY");
  expectCode(() => blocks.block({ ...block("BLOCK:BAD"), signature: "b".repeat(64) }, blockVerifier, NOW), "BLOCK_SIGNATURE_INVALID");
  const blockSnapshot = blocks.snapshot("e".repeat(64)), blockCanonical = JSON.stringify(blockSnapshot);
  const restoredBlocks = AccountBlockRegistry.restore(blockSnapshot, blockVerifier, { verify: (candidate) => JSON.stringify(candidate) === blockCanonical }, NOW);
  assert(restoredBlocks.isBlocked(REPORTER, SUBJECT, "SOCIAL") && restoredBlocks.isBlocked(REPORTER, SUBJECT, "MARKETPLACE"), "account block survives verified restart across surfaces");
  expectCode(() => restoredBlocks.block(block("BLOCK:3"), blockVerifier, NOW), "BLOCK_REPLAY");
  expectCode(() => AccountBlockRegistry.restore({ ...blockSnapshot, nextOrdinal: 1 }, blockVerifier, { verify: () => true }, NOW), "BLOCK_SNAPSHOT_INVALID");
  expectCode(() => AccountBlockRegistry.restore(blockSnapshot, blockVerifier, { verify: () => false }, NOW), "BLOCK_CHECKPOINT_UNVERIFIED");

  const trace = buildModerationAuditTrace({ schemaVersion: 1, traceId: "8".repeat(64), caseCommitment: "9".repeat(64), subjectAccountCommitment: SUBJECT, evidenceVaultCommitment: "6".repeat(64), surface: "MARKETPLACE", state: "CONTAINED", reasonCode: "REASON:P0", occurredAt: NOW, actorClass: "SYSTEM_TEST" });
  const traceJson = JSON.stringify(trace);
  assert(!traceJson.includes("rawContent") && !traceJson.includes("POLICY:ILLEGAL_GOODS"), "audit trace contains commitments without report content");
  expectCode(() => buildModerationAuditTrace({ ...trace, content: "secret" }), "TRACE_INVALID");

  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-MOD-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", surfaces: ["SOCIAL", "MARKETPLACE"], negative: { exact_shape_denied: true, non_synthetic_denied: true, raw_evidence_denied: true, invalid_signature_denied: true, p0_final_without_containment_denied: true, containment_without_expiry_denied: true, expired_containment_registration_denied: true, expired_containment_final_action_denied: true, containment_role_substitution_denied: true, subject_substitution_appeal_denied: true, moderator_as_appeal_reviewer_denied: true, reporter_as_appeal_reviewer_denied: true, action_replay_denied_after_restart: true, case_lineage_tamper_denied: true, case_checkpoint_required: true, account_block_cross_surface: true, account_block_replay_denied_after_restart: true, block_checkpoint_required: true, trace_raw_content_denied: true }, network_operations: 0, economic_operations: 0, external_provider_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}
main();
