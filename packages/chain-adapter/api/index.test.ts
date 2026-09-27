import {
  ChainReducer, ReducerPolicyError, type BalanceObservedPayload, type HashProvider,
  restoreObservationFromPersistence, serializeObservationForPersistence, serializeObservationForVerification, serializePayloadForVerification,
  type DurableRepairCommit, type EventAuthenticityVerifier, type IndexedChainEvent, type IndexedPayload, type JournalPayload,
  type RepairApproval, type RepairAuthorizationVerifier, type RepairCommitStore,
} from "./index";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void {
  let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof ReducerPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}
async function expectCodeAsync(action: () => Promise<unknown>, code: string): Promise<void> {
  let actual = "NO_ERROR"; try { await action(); } catch (error) { actual = error instanceof ReducerPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}
const hex = (value: number): string => value.toString(16).padStart(64, "0");
const address = `erd1${"q".repeat(58)}`;
const actor = "a".repeat(64); const object = "b".repeat(64); const paymentKey = "c".repeat(64); const account = "d".repeat(64);

class DeterministicFixtureAuthenticity implements EventAuthenticityVerifier {
  private readonly payloadByContentHash = new Map<string, string>();
  private readonly observationByProofHash = new Map<string, string>();
  register(value: IndexedChainEvent): IndexedChainEvent {
    this.payloadByContentHash.set(value.contentHash, serializePayloadForVerification(value.payload));
    this.observationByProofHash.set(value.authenticityProofHash, serializeObservationForVerification(value)); return value;
  }
  verifyFinalizedObservation(value: IndexedChainEvent): boolean {
    return this.payloadByContentHash.get(value.contentHash) === serializePayloadForVerification(value.payload)
      && this.observationByProofHash.get(value.authenticityProofHash) === serializeObservationForVerification(value);
  }
}
const authenticity = new DeterministicFixtureAuthenticity();

class DeterministicRepairAuthorization implements RepairAuthorizationVerifier {
  private readonly issuedBindings = new Map<string, string>();
  private binding(approval: RepairApproval, events: readonly IndexedChainEvent[], subjectStateRoot: string): string {
    const eventSet = events.map((value) => `${value.network}:${value.originalTxHash}:${value.sourceTxHash}:${value.eventIndex}:${value.contentHash}:${value.authenticityProofHash}`).sort().join("|");
    return `${approval.makerRole}:${approval.checkerRole}:${approval.sourceQuorumVerified}:${approval.evidenceHash}:${approval.authoritativeSetHash}:${approval.issuedAtMs}:${approval.expiresAtMs}:${approval.economicEffect}:${subjectStateRoot}:${eventSet}`;
  }
  issue(approval: RepairApproval, events: readonly IndexedChainEvent[], subjectStateRoot: string): RepairApproval {
    this.issuedBindings.set(approval.approvalId, this.binding(approval, events, subjectStateRoot)); return approval;
  }
  verifyRepairAuthorization(approval: RepairApproval, events: readonly IndexedChainEvent[], expectedSubjectStateRoot: string): boolean {
    return this.issuedBindings.get(approval.approvalId) === this.binding(approval, events, expectedSubjectStateRoot);
  }
}
const repairAuthorization = new DeterministicRepairAuthorization();
class DeterministicDurableRepairStore implements RepairCommitStore {
  private readonly commits = new Map<string, DurableRepairCommit>();
  commitRepairAtomically(commit: DurableRepairCommit): "COMMITTED" | "REPLAY" {
    if (this.commits.has(commit.approvalId)) return "REPLAY";
    this.commits.set(commit.approvalId, JSON.parse(JSON.stringify(commit)) as DurableRepairCommit); return "COMMITTED";
  }
  get(approvalId: string): DurableRepairCommit | undefined {
    const value = this.commits.get(approvalId); return value ? JSON.parse(JSON.stringify(value)) as DurableRepairCommit : undefined;
  }
}
const durableRepairStore = new DeterministicDurableRepairStore();
const repairNowMs = 2_000_000;

function event(sequence: number, payload: IndexedPayload, overrides: Partial<IndexedChainEvent> = {}): IndexedChainEvent {
  return authenticity.register({
    network: "devnet", contractAddress: address, originalTxHash: hex(10_000 + sequence), sourceTxHash: hex(20_000 + sequence),
    sourceKind: "SMART_CONTRACT_RESULT", eventIndex: 0, shard: sequence % 3, blockNonce: BigInt(sequence), blockHash: hex(30_000 + sequence),
    hyperblockNonce: BigInt(sequence), hyperblockHash: hex(40_000 + sequence), canonicality: "FINALIZED_CANONICAL", finality: "HYPERBLOCK_FINAL",
    contentHash: hex(50_000 + sequence), authenticityProofHash: hex(60_000 + sequence), payload, ...overrides,
  });
}
function action(sequence: number, aggregateId = `action_${sequence}`, version = 1): IndexedChainEvent {
  return event(sequence, { kind: "ACTION_EXECUTED", aggregateId, aggregateVersion: version, actorCommitment: actor, objectCommitment: object, actionClass: "PUBLIC_ACTION", status: "EXECUTED_SUCCESS" });
}
function journal(sequence: number, journalId: string, postings: JournalPayload["postings"]): IndexedChainEvent {
  return event(sequence, { kind: "JOURNAL", journalId, paymentKey, postings });
}
function issueApproval(seed: number, events: readonly IndexedChainEvent[], subjectStateRoot = "0".repeat(64), overrides: Partial<RepairApproval> = {}): RepairApproval {
  const approval: RepairApproval = {
    approvalId: hex(70_000 + seed), makerRole: "A22", checkerRole: "C03", sourceQuorumVerified: true,
    evidenceHash: hex(80_000 + seed), subjectStateRoot, authoritativeSetHash: hex(90_000 + seed),
    issuedAtMs: repairNowMs - 1_000, expiresAtMs: repairNowMs + 60_000, economicEffect: false, ...overrides,
  };
  return repairAuthorization.issue(approval, events, subjectStateRoot);
}
function newReducer(repairStore: RepairCommitStore = durableRepairStore): ChainReducer { return new ChainReducer(authenticity, repairAuthorization, repairStore); }
const hasher: HashProvider = { async sha256(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (item) => item.toString(16).padStart(2, "0")).join(""); } };

async function main(): Promise<void> {
  const final = action(3);
  const reducer = newReducer();
  assert(reducer.ingest({ ...final, canonicality: "PREFINALIZED", finality: "NOT_FINAL" }) === "IGNORED_NON_FINAL", "prefinalized observation is ignored");
  assert(reducer.ingest({ ...final, canonicality: "ORPHANED", finality: "NOT_FINAL" }) === "IGNORED_NON_FINAL", "orphaned reorg observation is ignored");
  assert(reducer.ingest(final) === "APPLIED", "final canonical event applies");
  assert(reducer.ingest({ ...final }) === "DUPLICATE", "exact duplicate is idempotent");
  const firstSnapshot = reducer.snapshot();
  assert(firstSnapshot.acceptedEvents === 1 && firstSnapshot.ignoredObservations === 2 && firstSnapshot.duplicateEvents === 1, "observation counters are explicit");
  assert(firstSnapshot.actions.length === 1 && firstSnapshot.reconciliation.status === "PASS", "action projection is terminal and reconciled");
  const authenticityBaseline = action(4, "authenticity");
  const authenticityAttack = { ...authenticityBaseline, payload: { ...(authenticityBaseline.payload as Extract<IndexedPayload, { kind: "ACTION_EXECUTED" }>), objectCommitment: "5".repeat(64) } };
  expectCode(() => reducer.ingest(authenticityAttack), "EVENT_AUTHENTICITY_INVALID");
  expectCode(() => reducer.ingest({ ...action(40), authenticityProofHash: "f".repeat(64) }), "EVENT_AUTHENTICITY_INVALID");
  assert(reducer.snapshot().acceptedEvents === 1, "invalid event authenticity is denied before persistence");

  const ordered = [action(8, "shared", 2), action(2, "shared", 1), action(5)];
  const forward = newReducer(); const reverse = newReducer();
  ordered.forEach((item) => assert(forward.ingest(item) === "APPLIED", "forward event applies"));
  [...ordered].reverse().forEach((item) => assert(reverse.ingest(item) === "APPLIED", "reverse event applies"));
  assert(JSON.stringify(forward.snapshot()) === JSON.stringify(reverse.snapshot()), "out-of-order delivery converges to identical read model");
  assert(forward.snapshot().actions.find((item) => item.aggregateId === "shared")?.aggregateVersion === 2, "latest aggregate version wins deterministically");
  const persistedJson = JSON.stringify(ordered.map(serializeObservationForPersistence));
  const restoredEvents = (JSON.parse(persistedJson) as ReturnType<typeof serializeObservationForPersistence>[]).map(restoreObservationFromPersistence);
  const restartedReplay = newReducer(); restartedReplay.restoreFromPersistence(restoredEvents.map(serializeObservationForPersistence));
  assert(JSON.stringify(restartedReplay.snapshot()) === JSON.stringify(forward.snapshot()), "database serialize reload reconstructs identical deterministic state");
  const forwardRoot = await forward.createAndPromoteCheckpoint(hasher); const restartedRoot = await restartedReplay.createAndPromoteCheckpoint(hasher);
  assert(forwardRoot.stateRoot === restartedRoot.stateRoot, "database round trip preserves canonical state root");
  const substitutedLineage = restoreObservationFromPersistence({ ...serializeObservationForPersistence(ordered[0]!), blockHash: "f".repeat(64) });
  expectCode(() => newReducer().ingest(substitutedLineage), "EVENT_AUTHENTICITY_INVALID");

  const aggregateConflict = newReducer();
  assert(aggregateConflict.ingest(action(11, "conflict", 1)) === "APPLIED", "baseline aggregate applies");
  const conflictingVersion = event(12, { ...(action(112, "fixture", 1).payload as Extract<IndexedPayload, { kind: "ACTION_EXECUTED" }>), aggregateId: "conflict", objectCommitment: "f".repeat(64) });
  assert(aggregateConflict.ingest(conflictingVersion) === "RECONCILIATION_REQUIRED", "same aggregate version with divergent payload fails closed");
  assert(aggregateConflict.getLastFailure() === "AGGREGATE_VERSION_CONFLICT", "aggregate conflict reason is retained");
  expectCode(() => aggregateConflict.servedSnapshot(), "NO_VERIFIED_CHECKPOINT");
  expectCode(() => aggregateConflict.repairFromAuthoritative([authenticityAttack], issueApproval(1, [authenticityAttack]), repairNowMs), "REPAIR_EVENT_AUTHENTICITY_INVALID");

  const assetDebit = { accountClass: "CONTRACT_ASSET" as const, accountCommitment: account, side: "DEBIT" as const, amount: "100" };
  const escrowCredit = { accountClass: "ESCROW_LIABILITY" as const, accountCommitment: account, side: "CREDIT" as const, amount: "100" };
  const funding = journal(20, "1".repeat(64), [assetDebit, escrowCredit]);
  const settlement = journal(21, "2".repeat(64), [
    { accountClass: "ESCROW_LIABILITY", accountCommitment: account, side: "DEBIT", amount: "100" },
    { accountClass: "WITHDRAWAL_LIABILITY", accountCommitment: account, side: "CREDIT", amount: "90" },
    { accountClass: "PLATFORM_FEE_LIABILITY", accountCommitment: account, side: "CREDIT", amount: "10" },
  ]);
  const withdrawal = journal(22, "3".repeat(64), [
    { accountClass: "WITHDRAWAL_LIABILITY", accountCommitment: account, side: "DEBIT", amount: "90" },
    { accountClass: "CONTRACT_ASSET", accountCommitment: account, side: "CREDIT", amount: "90" },
  ]);
  const observedPayload: BalanceObservedPayload = { kind: "BALANCE_OBSERVED", paymentKey, contractBalance: "10" };
  const observed = event(23, observedPayload);
  const ledger = newReducer();
  for (const item of [funding, settlement, withdrawal, observed]) assert(ledger.ingest(item) === "APPLIED", "balanced ledger event applies");
  const ledgerSnapshot = ledger.snapshot();
  assert(ledgerSnapshot.reconciliation.status === "PASS" && ledgerSnapshot.reconciliation.balancedJournals === 3, "double-entry journals reconcile exactly");
  assert(ledgerSnapshot.accountBalances.find((item) => item.accountClass === "CONTRACT_ASSET")?.amount === "10", "asset ledger equals remaining contract balance");
  assert(ledgerSnapshot.accountBalances.find((item) => item.accountClass === "PLATFORM_FEE_LIABILITY")?.amount === "10", "remaining liability equals asset");
  const checkpoint = await ledger.createAndPromoteCheckpoint(hasher);
  assert(checkpoint.stateRoot.length === 64 && checkpoint.eventCount === 4, "verified checkpoint binds canonical state and event count");
  assert(await ledger.verifyCheckpoint(checkpoint, hasher), "checkpoint state root verifies independently");
  assert(!await ledger.verifyCheckpoint({ ...checkpoint, stateRoot: "0".repeat(64) }, hasher), "tampered checkpoint is rejected");
  (checkpoint.snapshot as { acceptedEvents: number }).acceptedEvents = 999;
  assert(!await ledger.verifyCheckpoint(checkpoint, hasher), "tampered returned checkpoint snapshot is rejected");

  const badObserved = event(24, { ...observedPayload, contractBalance: "9" });
  assert(ledger.ingest(badObserved) === "RECONCILIATION_REQUIRED", "chain balance mismatch disables mutations");
  assert(ledger.snapshot().mode === "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED", "mismatch enters rollback mode");
  assert(ledger.servedSnapshot().acceptedEvents === 4 && ledger.servedSnapshot().mode === "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED", "rollback serves last verified checkpoint isolated from returned copies");
  await expectCodeAsync(() => ledger.createAndPromoteCheckpoint(hasher), "CHECKPOINT_PROMOTION_DENIED");
  const ledgerRepairEvents = [observed, withdrawal, funding, settlement];
  const ledgerApproval = issueApproval(2, ledgerRepairEvents, checkpoint.stateRoot);
  ledger.repairFromAuthoritative(ledgerRepairEvents, ledgerApproval, repairNowMs);
  assert(ledger.snapshot().mode === "NORMAL" && ledger.snapshot().reconciliation.status === "PASS", "verified authoritative repair restores normal mode");
  const durableCommit = durableRepairStore.get(ledgerApproval.approvalId);
  assert(durableCommit?.observations.length === 4 && durableCommit.subjectStateRoot === checkpoint.stateRoot, "repair atomically persists approval consumption and replacement event set");
  expectCode(() => ledger.repairFromAuthoritative([funding], ledgerApproval, repairNowMs), "REPAIR_NOT_REQUIRED");

  assert(ledger.ingest(badObserved) === "RECONCILIATION_REQUIRED", "repair replay fixture re-enters controlled failure");
  const fabricatedApproval: RepairApproval = { ...ledgerApproval, approvalId: hex(71_111), evidenceHash: hex(81_111), authoritativeSetHash: hex(91_111) };
  expectCode(() => ledger.repairFromAuthoritative(ledgerRepairEvents, fabricatedApproval, repairNowMs), "REPAIR_AUTHORIZATION_INVALID");
  expectCode(() => ledger.repairFromAuthoritative(ledgerRepairEvents, ledgerApproval, repairNowMs), "REPAIR_APPROVAL_REPLAY");
  const wrongSubjectApproval = issueApproval(3, ledgerRepairEvents, "7".repeat(64));
  expectCode(() => ledger.repairFromAuthoritative(ledgerRepairEvents, wrongSubjectApproval, repairNowMs), "REPAIR_AUTHORIZATION_INVALID");
  const expiredApproval = issueApproval(4, ledgerRepairEvents, checkpoint.stateRoot, { issuedAtMs: repairNowMs - 10_000, expiresAtMs: repairNowMs });
  expectCode(() => ledger.repairFromAuthoritative(ledgerRepairEvents, expiredApproval, repairNowMs), "REPAIR_APPROVAL_INVALID");
  const wrongSetApproval = issueApproval(5, [funding], checkpoint.stateRoot);
  expectCode(() => ledger.repairFromAuthoritative(ledgerRepairEvents, wrongSetApproval, repairNowMs), "REPAIR_AUTHORIZATION_INVALID");

  const restartedAfterRepair = newReducer();
  restartedAfterRepair.restoreFromPersistence(durableCommit!.observations);
  const restartedRepairCheckpoint = await restartedAfterRepair.createAndPromoteCheckpoint(hasher);
  assert(restartedRepairCheckpoint.stateRoot === checkpoint.stateRoot, "restart from atomic repair commit restores the verified subject state");
  assert(restartedAfterRepair.ingest(badObserved) === "RECONCILIATION_REQUIRED", "fresh instance enters failure for cross-restart replay test");
  expectCode(() => restartedAfterRepair.repairFromAuthoritative(ledgerRepairEvents, ledgerApproval, repairNowMs), "REPAIR_APPROVAL_REPLAY");

  const malformed = newReducer();
  const unbalanced = journal(30, "4".repeat(64), [assetDebit, { ...escrowCredit, amount: "99" }]);
  expectCode(() => malformed.ingest(unbalanced), "JOURNAL_UNBALANCED");
  expectCode(() => malformed.ingest({ ...action(29), sourceKind: "CALLBACK" as never }), "SOURCE_KIND_INVALID");
  expectCode(() => malformed.ingest({ ...action(29), rawWallet: address } as never), "EVENT_SHAPE_INVALID");
  expectCode(() => malformed.ingest({ ...action(29), payload: { ...action(29).payload, rawTarget: actor } } as never), "ACTION_SHAPE_INVALID");
  const keyBaseline = action(31);
  const sameKeyDifferent = event(131, { ...(keyBaseline.payload as Extract<IndexedPayload, { kind: "ACTION_EXECUTED" }>), objectCommitment: "7".repeat(64) }, { originalTxHash: keyBaseline.originalTxHash, sourceTxHash: keyBaseline.sourceTxHash, eventIndex: keyBaseline.eventIndex, contentHash: "9".repeat(64) });
  assert(malformed.ingest(keyBaseline) === "APPLIED", "canonical key baseline applies");
  assert(malformed.ingest(sameKeyDifferent) === "RECONCILIATION_REQUIRED", "same event key with different commitment triggers reconciliation");

  const isolatedAccounts = newReducer(); assert(isolatedAccounts.ingest(funding) === "APPLIED", "account isolation funding applies");
  const wrongAccountWithdrawal = journal(25, "5".repeat(64), [
    { accountClass: "ESCROW_LIABILITY", accountCommitment: "9".repeat(64), side: "DEBIT", amount: "10" },
    { accountClass: "CONTRACT_ASSET", accountCommitment: account, side: "CREDIT", amount: "10" },
  ]);
  assert(isolatedAccounts.ingest(wrongAccountWithdrawal) === "RECONCILIATION_REQUIRED", "one account cannot spend another account liability");
  assert(isolatedAccounts.getLastFailure() === "NEGATIVE_LEDGER_BALANCE", "per-account negative balance is detected");

  const balanceConflict = newReducer(); assert(balanceConflict.ingest(funding) === "APPLIED", "balance conflict funding applies");
  const observedHundred = event(26, { kind: "BALANCE_OBSERVED", paymentKey, contractBalance: "100" });
  assert(balanceConflict.ingest(observedHundred) === "APPLIED", "first balance observation applies");
  const observedConflict = event(27, { kind: "BALANCE_OBSERVED", paymentKey, contractBalance: "99" }, { hyperblockNonce: observedHundred.hyperblockNonce });
  assert(balanceConflict.ingest(observedConflict) === "RECONCILIATION_REQUIRED", "different balances at one hyperblock require reconciliation");
  assert(balanceConflict.getLastFailure() === "BALANCE_OBSERVATION_CONFLICT", "balance conflict reason is retained");

  const bulk = Array.from({ length: 500 }, (_, index) => action(1000 + index, `bulk_${index}`));
  const rebuild = newReducer(); const seed = action(900, "seed"); assert(rebuild.ingest(seed) === "APPLIED", "rebuild seed applies");
  const seedConflict = event(901, { ...(seed.payload as Extract<IndexedPayload, { kind: "ACTION_EXECUTED" }>), objectCommitment: "6".repeat(64) }, { originalTxHash: seed.originalTxHash, sourceTxHash: seed.sourceTxHash, eventIndex: seed.eventIndex, contentHash: "8".repeat(64) });
  assert(rebuild.ingest(seedConflict) === "RECONCILIATION_REQUIRED", "rebuild fixture enters controlled failure");
  const started = Date.now(); rebuild.repairFromAuthoritative(bulk, issueApproval(6, bulk), repairNowMs); const rebuildMs = Date.now() - started;
  assert(rebuild.snapshot().actions.length === 500 && rebuild.snapshot().reconciliation.status === "PASS", "full authoritative rebuild produces complete deterministic state");
  assert(rebuildMs < 2_000, "500-event local rebuild stays inside declared 2000ms RTO fixture");

  async function expectCheckpointFence(reducerUnderTest: ChainReducer, mutation: () => unknown, label: string): Promise<void> {
    let releaseHash!: () => void; let markHashStarted!: () => void;
    const hashGate = new Promise<void>((resolve) => { releaseHash = resolve; }); const hashStarted = new Promise<void>((resolve) => { markHashStarted = resolve; });
    const delayedHasher: HashProvider = { async sha256(value: string): Promise<string> { markHashStarted(); await hashGate; return hasher.sha256(value); } };
    const pendingCheckpoint = reducerUnderTest.createAndPromoteCheckpoint(delayedHasher); await hashStarted; mutation(); releaseHash();
    await expectCodeAsync(() => pendingCheckpoint, "CHECKPOINT_CONCURRENT_MUTATION"); assert(true, label);
  }
  const concurrentCheckpoint = newReducer(); assert(concurrentCheckpoint.ingest(action(2_000, "checkpoint_seed")) === "APPLIED", "checkpoint race seed applies");
  await expectCheckpointFence(concurrentCheckpoint, () => assert(concurrentCheckpoint.ingest(action(2_001, "checkpoint_concurrent")) === "APPLIED", "concurrent applied mutation applies"), "applied mutation is generation fenced");
  const duplicateCheckpoint = newReducer(); const duplicateSeed = action(2_100, "checkpoint_duplicate"); assert(duplicateCheckpoint.ingest(duplicateSeed) === "APPLIED", "duplicate race seed applies");
  await expectCheckpointFence(duplicateCheckpoint, () => assert(duplicateCheckpoint.ingest(duplicateSeed) === "DUPLICATE", "concurrent duplicate mutates counter"), "duplicate counter mutation is generation fenced");
  const ignoredCheckpoint = newReducer(); assert(ignoredCheckpoint.ingest(action(2_200, "checkpoint_ignored_seed")) === "APPLIED", "ignored race seed applies");
  const prefinalized = event(2_201, action(2_202, "prefinalized_payload").payload, { canonicality: "PREFINALIZED", finality: "NOT_FINAL" });
  await expectCheckpointFence(ignoredCheckpoint, () => assert(ignoredCheckpoint.ingest(prefinalized) === "IGNORED_NON_FINAL", "concurrent non-final mutates counter"), "ignored observation counter mutation is generation fenced");

  console.log(JSON.stringify({ schema_version: 1, task_id: "NX-CHAIN-002", status: "PASS", assertions, replay_report: { duplicate_idempotent: true, out_of_order_converged: true, prefinalized_reorg_ignored: true, persistence_round_trip: true, state_root_preserved: true }, reconciliation_report: { balanced_journals: 3, final_asset: "10", final_liability: "10" }, failure_injection: { aggregate_conflict: "DENY", canonical_key_conflict: "DENY", balance_mismatch: "MUTATIONS_DISABLED", served_checkpoint: true, checkpoint_concurrent_mutation: "DENY", duplicate_counter_concurrent_mutation: "DENY", ignored_counter_concurrent_mutation: "DENY" }, repair_authorization: { authenticated: true, subject_bound: true, event_set_bound: true, expiring: true, replay_denied: true, cross_restart_replay_denied: true, atomic_persistent_commit: true }, rebuild_rto: { events: 500, elapsed_ms: rebuildMs, declared_limit_ms: 2000, within_limit: true }, synthetic_only: true, network_operations: 0, economic_operations: 0 }));
}

main().catch((error) => { throw error; });
