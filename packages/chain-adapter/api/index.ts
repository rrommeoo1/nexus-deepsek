export type Network = "localnet" | "devnet" | "testnet" | "mainnet";
export type Canonicality = "PREFINALIZED" | "FINALIZED_CANONICAL" | "ORPHANED";
export type Finality = "NOT_FINAL" | "HYPERBLOCK_FINAL";
export type AccountClass = "CONTRACT_ASSET" | "ESCROW_LIABILITY" | "WITHDRAWAL_LIABILITY" | "PLATFORM_FEE_LIABILITY";
export type ReducerMode = "NORMAL" | "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED";

export interface ChainLineage {
  network: Network;
  contractAddress: string;
  originalTxHash: string;
  sourceTxHash: string;
  sourceKind: "TRANSACTION" | "SMART_CONTRACT_RESULT";
  eventIndex: number;
  shard: number;
  blockNonce: bigint;
  blockHash: string;
  hyperblockNonce: bigint;
  hyperblockHash: string;
  canonicality: Canonicality;
  finality: Finality;
}

export interface ActionExecutedPayload {
  kind: "ACTION_EXECUTED";
  aggregateId: string;
  aggregateVersion: number;
  actorCommitment: string;
  objectCommitment: string;
  actionClass: "PUBLIC_ACTION" | "PRIVATE_ACTION";
  status: "EXECUTED_SUCCESS";
}

export interface Posting {
  accountClass: AccountClass;
  accountCommitment: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
}

export interface JournalPayload {
  kind: "JOURNAL";
  journalId: string;
  paymentKey: string;
  postings: readonly Posting[];
}

export interface BalanceObservedPayload {
  kind: "BALANCE_OBSERVED";
  paymentKey: string;
  contractBalance: string;
}

export type IndexedPayload = ActionExecutedPayload | JournalPayload | BalanceObservedPayload;
export interface IndexedChainEvent extends ChainLineage { contentHash: string; authenticityProofHash: string; payload: IndexedPayload; }
export interface PersistedChainObservation {
  network: Network;
  contractAddress: string;
  originalTxHash: string;
  sourceTxHash: string;
  sourceKind: "TRANSACTION" | "SMART_CONTRACT_RESULT";
  eventIndex: number;
  shard: number;
  blockNonce: string;
  blockHash: string;
  hyperblockNonce: string;
  hyperblockHash: string;
  canonicality: "FINALIZED_CANONICAL";
  finality: "HYPERBLOCK_FINAL";
  contentHash: string;
  authenticityProofHash: string;
  payload: IndexedPayload;
}

export interface ActionProjection {
  aggregateId: string;
  aggregateVersion: number;
  status: "EXECUTED_SUCCESS";
  actionClass: "PUBLIC_ACTION" | "PRIVATE_ACTION";
  actorCommitment: string;
  objectCommitment: string;
  sourceEventKey: string;
}

export interface ReconciliationIssue { code: string; paymentKey?: string; detail: string; }
export interface ReconciliationReport {
  status: "PASS" | "FAIL";
  balancedJournals: number;
  paymentKeys: number;
  issues: readonly ReconciliationIssue[];
}

export interface ReducerSnapshot {
  reducerVersion: 1;
  mode: ReducerMode;
  acceptedEvents: number;
  ignoredObservations: number;
  duplicateEvents: number;
  maxHyperblockNonce: string;
  actions: readonly ActionProjection[];
  accountBalances: readonly { paymentKey: string; accountClass: AccountClass; accountCommitment: string; amount: string }[];
  observedBalances: readonly { paymentKey: string; amount: string; hyperblockNonce: string }[];
  reconciliation: ReconciliationReport;
}

export interface VerifiedCheckpoint {
  schemaVersion: 1;
  reducerVersion: 1;
  stateRoot: string;
  eventCount: number;
  maxHyperblockNonce: string;
  snapshot: ReducerSnapshot;
}

export interface HashProvider { sha256(value: string): Promise<string>; }
export interface EventAuthenticityVerifier { verifyFinalizedObservation(event: IndexedChainEvent): boolean; }
export interface RepairApproval {
  approvalId: string;
  makerRole: "A22";
  checkerRole: "C03";
  sourceQuorumVerified: true;
  evidenceHash: string;
  subjectStateRoot: string;
  authoritativeSetHash: string;
  issuedAtMs: number;
  expiresAtMs: number;
  economicEffect: false;
}
export interface RepairAuthorizationVerifier {
  verifyRepairAuthorization(approval: RepairApproval, events: readonly IndexedChainEvent[], expectedSubjectStateRoot: string): boolean;
}
export interface DurableRepairCommit {
  approvalId: string;
  subjectStateRoot: string;
  authoritativeSetHash: string;
  evidenceHash: string;
  committedAtMs: number;
  observations: readonly PersistedChainObservation[];
}
export interface RepairCommitStore {
  commitRepairAtomically(commit: DurableRepairCommit): "COMMITTED" | "REPLAY";
}

export class ReducerPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ReducerPolicyError"; }
}

const HASH = /^[a-f0-9]{64}$/;
const ADDRESS = /^erd1[a-z0-9]{58}$/;
const AGGREGATE = /^[A-Za-z0-9_-]{1,80}$/;
const AMOUNT = /^(0|[1-9][0-9]{0,77})$/;
const NETWORKS = new Set<Network>(["localnet", "devnet", "testnet", "mainnet"]);
const ACCOUNT_CLASSES = new Set<AccountClass>(["CONTRACT_ASSET", "ESCROW_LIABILITY", "WITHDRAWAL_LIABILITY", "PLATFORM_FEE_LIABILITY"]);

function requireHash(value: string, code: string): void { if (!HASH.test(value)) throw new ReducerPolicyError(code); }
function parseAmount(value: string): bigint { if (!AMOUNT.test(value)) throw new ReducerPolicyError("AMOUNT_INVALID"); return BigInt(value); }
function requireExactKeys(value: object, keys: readonly string[], code: string): void { if (Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new ReducerPolicyError(code); }
function eventKey(event: IndexedChainEvent): string { return `${event.network}|${event.originalTxHash}|${event.sourceTxHash}|${event.eventIndex}`; }
function orderKey(event: IndexedChainEvent): string {
  return `${event.hyperblockNonce.toString().padStart(24, "0")}|${event.blockNonce.toString().padStart(24, "0")}|${event.sourceTxHash}|${event.eventIndex.toString().padStart(10, "0")}`;
}
function canonicalValue(value: unknown): string {
  if (typeof value === "bigint") return `"${value.toString()}"`;
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonicalValue(nested)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function serializePayloadForVerification(payload: IndexedPayload): string { return canonicalValue(payload); }
export function serializeObservationForVerification(event: IndexedChainEvent): string {
  const { authenticityProofHash: _proof, canonicality: _canonicality, finality: _finality, ...proofMaterial } = event;
  return canonicalValue(proofMaterial);
}
function isAuthoritative(event: IndexedChainEvent): boolean { return event.canonicality === "FINALIZED_CANONICAL" && event.finality === "HYPERBLOCK_FINAL"; }

function validateLineage(event: IndexedChainEvent): void {
  requireExactKeys(event, ["network", "contractAddress", "originalTxHash", "sourceTxHash", "sourceKind", "eventIndex", "shard", "blockNonce", "blockHash", "hyperblockNonce", "hyperblockHash", "canonicality", "finality", "contentHash", "authenticityProofHash", "payload"], "EVENT_SHAPE_INVALID");
  if (!NETWORKS.has(event.network) || !ADDRESS.test(event.contractAddress)) throw new ReducerPolicyError("LINEAGE_DOMAIN_INVALID");
  for (const value of [event.originalTxHash, event.sourceTxHash, event.blockHash, event.hyperblockHash, event.contentHash, event.authenticityProofHash]) requireHash(value, "LINEAGE_HASH_INVALID");
  if (!Number.isInteger(event.eventIndex) || event.eventIndex < 0 || !Number.isInteger(event.shard) || event.shard < 0 || event.blockNonce < 0n || event.hyperblockNonce < 0n) throw new ReducerPolicyError("LINEAGE_POSITION_INVALID");
  if (event.sourceKind !== "TRANSACTION" && event.sourceKind !== "SMART_CONTRACT_RESULT") throw new ReducerPolicyError("SOURCE_KIND_INVALID");
  if (!(["PREFINALIZED", "FINALIZED_CANONICAL", "ORPHANED"] as const).includes(event.canonicality) || !(["NOT_FINAL", "HYPERBLOCK_FINAL"] as const).includes(event.finality)) throw new ReducerPolicyError("FINALITY_INVALID");
  if ((event.canonicality === "FINALIZED_CANONICAL") !== (event.finality === "HYPERBLOCK_FINAL")) throw new ReducerPolicyError("FINALITY_CANONICALITY_MISMATCH");
}

export function serializeObservationForPersistence(event: IndexedChainEvent): PersistedChainObservation {
  validateLineage(event); validatePayload(event.payload);
  if (!isAuthoritative(event)) throw new ReducerPolicyError("PERSISTENCE_NON_FINAL_EVENT");
  return {
    network: event.network, contractAddress: event.contractAddress, originalTxHash: event.originalTxHash, sourceTxHash: event.sourceTxHash,
    sourceKind: event.sourceKind, eventIndex: event.eventIndex, shard: event.shard, blockNonce: event.blockNonce.toString(), blockHash: event.blockHash,
    hyperblockNonce: event.hyperblockNonce.toString(), hyperblockHash: event.hyperblockHash, canonicality: "FINALIZED_CANONICAL", finality: "HYPERBLOCK_FINAL",
    contentHash: event.contentHash, authenticityProofHash: event.authenticityProofHash, payload: JSON.parse(JSON.stringify(event.payload)) as IndexedPayload,
  };
}

export function restoreObservationFromPersistence(record: PersistedChainObservation): IndexedChainEvent {
  requireExactKeys(record, ["network", "contractAddress", "originalTxHash", "sourceTxHash", "sourceKind", "eventIndex", "shard", "blockNonce", "blockHash", "hyperblockNonce", "hyperblockHash", "canonicality", "finality", "contentHash", "authenticityProofHash", "payload"], "PERSISTED_OBSERVATION_SHAPE_INVALID");
  if (!AMOUNT.test(record.blockNonce) || !AMOUNT.test(record.hyperblockNonce)) throw new ReducerPolicyError("PERSISTED_NONCE_INVALID");
  const event: IndexedChainEvent = { ...record, blockNonce: BigInt(record.blockNonce), hyperblockNonce: BigInt(record.hyperblockNonce), payload: JSON.parse(JSON.stringify(record.payload)) as IndexedPayload };
  validateLineage(event); validatePayload(event.payload); if (!isAuthoritative(event)) throw new ReducerPolicyError("PERSISTED_NON_FINAL_EVENT"); return event;
}

function validatePayload(payload: IndexedPayload): void {
  if (payload.kind === "ACTION_EXECUTED") {
    requireExactKeys(payload, ["kind", "aggregateId", "aggregateVersion", "actorCommitment", "objectCommitment", "actionClass", "status"], "ACTION_SHAPE_INVALID");
    if (!AGGREGATE.test(payload.aggregateId) || !Number.isInteger(payload.aggregateVersion) || payload.aggregateVersion < 1 || payload.status !== "EXECUTED_SUCCESS") throw new ReducerPolicyError("ACTION_PAYLOAD_INVALID");
    requireHash(payload.actorCommitment, "ACTION_COMMITMENT_INVALID"); requireHash(payload.objectCommitment, "ACTION_COMMITMENT_INVALID");
    if (payload.actionClass !== "PUBLIC_ACTION" && payload.actionClass !== "PRIVATE_ACTION") throw new ReducerPolicyError("ACTION_CLASS_INVALID");
    return;
  }
  if (payload.kind === "BALANCE_OBSERVED") { requireExactKeys(payload, ["kind", "paymentKey", "contractBalance"], "BALANCE_SHAPE_INVALID"); requireHash(payload.paymentKey, "PAYMENT_KEY_INVALID"); parseAmount(payload.contractBalance); return; }
  if (payload.kind !== "JOURNAL") throw new ReducerPolicyError("PAYLOAD_KIND_INVALID");
  requireExactKeys(payload, ["kind", "journalId", "paymentKey", "postings"], "JOURNAL_SHAPE_INVALID");
  requireHash(payload.journalId, "JOURNAL_ID_INVALID"); requireHash(payload.paymentKey, "PAYMENT_KEY_INVALID");
  if (!Array.isArray(payload.postings) || payload.postings.length < 2 || payload.postings.length > 16) throw new ReducerPolicyError("POSTINGS_COUNT_INVALID");
  let debit = 0n; let credit = 0n; const distinctAccounts = new Set<AccountClass>();
  for (const posting of payload.postings) {
    requireExactKeys(posting, ["accountClass", "accountCommitment", "side", "amount"], "POSTING_SHAPE_INVALID");
    if (!ACCOUNT_CLASSES.has(posting.accountClass) || (posting.side !== "DEBIT" && posting.side !== "CREDIT")) throw new ReducerPolicyError("POSTING_INVALID");
    requireHash(posting.accountCommitment, "ACCOUNT_COMMITMENT_INVALID");
    const amount = parseAmount(posting.amount); if (amount <= 0n) throw new ReducerPolicyError("POSTING_AMOUNT_INVALID");
    if (posting.side === "DEBIT") debit += amount; else credit += amount;
    distinctAccounts.add(posting.accountClass);
  }
  if (debit !== credit) throw new ReducerPolicyError("JOURNAL_UNBALANCED");
  if (distinctAccounts.size < 2) throw new ReducerPolicyError("JOURNAL_ACCOUNTING_BOUNDARY_INVALID");
}

interface CandidateState {
  actions: Map<string, ActionProjection>;
  actionVersions: Map<string, string>;
  journals: Map<string, string>;
  balances: Map<string, bigint>;
  observed: Map<string, { amount: bigint; hyperblockNonce: bigint }>;
  report: ReconciliationReport;
  maxHyperblockNonce: bigint;
}

function accountKey(paymentKey: string, accountClass: AccountClass, accountCommitment: string): string { return `${paymentKey}|${accountClass}|${accountCommitment}`; }
function buildCandidate(events: readonly IndexedChainEvent[]): CandidateState {
  const actions = new Map<string, ActionProjection>(); const actionVersions = new Map<string, string>();
  const journals = new Map<string, string>(); const balances = new Map<string, bigint>();
  const observed = new Map<string, { amount: bigint; hyperblockNonce: bigint }>(); let balancedJournals = 0; let maxHyperblockNonce = 0n;
  for (const event of [...events].sort((a, b) => orderKey(a).localeCompare(orderKey(b)))) {
    validatePayload(event.payload); if (event.hyperblockNonce > maxHyperblockNonce) maxHyperblockNonce = event.hyperblockNonce;
    const payload = event.payload;
    if (payload.kind === "ACTION_EXECUTED") {
      const versionKey = `${payload.aggregateId}|${payload.aggregateVersion}`; const material = canonicalValue(payload); const priorHash = actionVersions.get(versionKey);
      if (priorHash && priorHash !== material) throw new ReducerPolicyError("AGGREGATE_VERSION_CONFLICT");
      actionVersions.set(versionKey, material); const prior = actions.get(payload.aggregateId);
      if (!prior || payload.aggregateVersion > prior.aggregateVersion) actions.set(payload.aggregateId, { ...payload, sourceEventKey: eventKey(event) });
    } else if (payload.kind === "JOURNAL") {
      const material = canonicalValue(payload); const priorHash = journals.get(payload.journalId); if (priorHash && priorHash !== material) throw new ReducerPolicyError("JOURNAL_ID_CONFLICT");
      if (priorHash) continue; journals.set(payload.journalId, material); balancedJournals += 1;
      for (const posting of payload.postings) {
        const key = accountKey(payload.paymentKey, posting.accountClass, posting.accountCommitment); const current = balances.get(key) ?? 0n; const amount = parseAmount(posting.amount);
        const normalIncrease = posting.accountClass === "CONTRACT_ASSET" ? posting.side === "DEBIT" : posting.side === "CREDIT";
        const next = normalIncrease ? current + amount : current - amount; if (next < 0n) throw new ReducerPolicyError("NEGATIVE_LEDGER_BALANCE"); balances.set(key, next);
      }
    } else {
      const prior = observed.get(payload.paymentKey);
      const amount = parseAmount(payload.contractBalance);
      if (prior && event.hyperblockNonce === prior.hyperblockNonce && prior.amount !== amount) throw new ReducerPolicyError("BALANCE_OBSERVATION_CONFLICT");
      if (!prior || event.hyperblockNonce >= prior.hyperblockNonce) observed.set(payload.paymentKey, { amount, hyperblockNonce: event.hyperblockNonce });
    }
  }
  const issues: ReconciliationIssue[] = []; const paymentKeys = new Set<string>();
  for (const key of balances.keys()) paymentKeys.add(key.split("|")[0]!); for (const key of observed.keys()) paymentKeys.add(key);
  for (const paymentKey of [...paymentKeys].sort()) {
    let asset = 0n; let liabilities = 0n;
    for (const [key, amount] of balances) {
      const [keyPayment, accountClass] = key.split("|"); if (keyPayment !== paymentKey) continue;
      if (accountClass === "CONTRACT_ASSET") asset += amount; else liabilities += amount;
    }
    if (asset !== liabilities) issues.push({ code: "ACCOUNTING_EQUATION_MISMATCH", paymentKey, detail: `${asset}:${liabilities}` });
    const chainBalance = observed.get(paymentKey); if (chainBalance && chainBalance.amount !== asset) issues.push({ code: "CHAIN_BALANCE_MISMATCH", paymentKey, detail: `${chainBalance.amount}:${asset}` });
  }
  return { actions, actionVersions, journals, balances, observed, report: { status: issues.length === 0 ? "PASS" : "FAIL", balancedJournals, paymentKeys: paymentKeys.size, issues }, maxHyperblockNonce };
}

function cloneSnapshot(snapshot: ReducerSnapshot): ReducerSnapshot { return JSON.parse(JSON.stringify(snapshot)) as ReducerSnapshot; }
function cloneCheckpoint(checkpoint: VerifiedCheckpoint): VerifiedCheckpoint { return { ...checkpoint, snapshot: cloneSnapshot(checkpoint.snapshot) }; }
function canonicalState(snapshot: ReducerSnapshot): string { return JSON.stringify({ ...snapshot, mode: "NORMAL" }); }

export class ChainReducer {
  private readonly events = new Map<string, IndexedChainEvent>();
  private candidate: CandidateState = buildCandidate([]);
  private mode: ReducerMode = "NORMAL";
  private ignored = 0; private duplicates = 0; private checkpoint: VerifiedCheckpoint | null = null;
  private lastFailure: string | null = null;
  private generation = 0;

  constructor(
    private readonly authenticityVerifier: EventAuthenticityVerifier,
    private readonly repairAuthorizationVerifier: RepairAuthorizationVerifier,
    private readonly repairCommitStore: RepairCommitStore,
  ) {}

  restoreFromPersistence(records: readonly PersistedChainObservation[]): void {
    if (this.events.size !== 0 || this.generation !== 0 || this.mode !== "NORMAL") throw new ReducerPolicyError("PERSISTENCE_RESTORE_NOT_EMPTY");
    if (records.length === 0) throw new ReducerPolicyError("PERSISTENCE_RESTORE_EMPTY");
    const restored = new Map<string, IndexedChainEvent>();
    for (const record of records) {
      const event = restoreObservationFromPersistence(record);
      if (!this.authenticityVerifier.verifyFinalizedObservation(event)) throw new ReducerPolicyError("PERSISTED_EVENT_AUTHENTICITY_INVALID");
      const key = eventKey(event); if (restored.has(key)) throw new ReducerPolicyError("PERSISTED_DUPLICATE_KEY"); restored.set(key, event);
    }
    const candidate = buildCandidate([...restored.values()]); if (candidate.report.status !== "PASS") throw new ReducerPolicyError("PERSISTED_RECONCILIATION_FAILED");
    for (const [key, event] of restored) this.events.set(key, event); this.candidate = candidate; this.generation += 1;
  }

  ingest(event: IndexedChainEvent): "APPLIED" | "IGNORED_NON_FINAL" | "DUPLICATE" | "RECONCILIATION_REQUIRED" {
    validateLineage(event); validatePayload(event.payload);
    if (!this.authenticityVerifier.verifyFinalizedObservation(event)) throw new ReducerPolicyError("EVENT_AUTHENTICITY_INVALID");
    if (!isAuthoritative(event)) { this.ignored += 1; this.generation += 1; return "IGNORED_NON_FINAL"; }
    const key = eventKey(event); const prior = this.events.get(key);
    if (prior) {
      if (prior.contentHash === event.contentHash && canonicalValue(prior) === canonicalValue(event)) { this.duplicates += 1; this.generation += 1; return "DUPLICATE"; }
      this.enterFailure("CANONICAL_EVENT_KEY_CONFLICT"); return "RECONCILIATION_REQUIRED";
    }
    const proposed = [...this.events.values(), event];
    try {
      const candidate = buildCandidate(proposed); this.events.set(key, event); this.candidate = candidate; this.generation += 1;
      if (candidate.report.status === "FAIL") { this.enterFailure("RECONCILIATION_MISMATCH"); return "RECONCILIATION_REQUIRED"; }
      return "APPLIED";
    } catch (error) {
      this.enterFailure(error instanceof ReducerPolicyError ? error.code : "REDUCER_FAILURE"); return "RECONCILIATION_REQUIRED";
    }
  }

  private enterFailure(code: string): void { this.mode = "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED"; this.lastFailure = code; this.generation += 1; }
  getLastFailure(): string | null { return this.lastFailure; }

  snapshot(): ReducerSnapshot {
    const actions = [...this.candidate.actions.values()].sort((a, b) => a.aggregateId.localeCompare(b.aggregateId));
    const accountBalances = [...this.candidate.balances.entries()].map(([key, amount]) => { const [paymentKey, accountClass, accountCommitment] = key.split("|") as [string, AccountClass, string]; return { paymentKey, accountClass, accountCommitment, amount: amount.toString() }; }).sort((a, b) => `${a.paymentKey}|${a.accountClass}|${a.accountCommitment}`.localeCompare(`${b.paymentKey}|${b.accountClass}|${b.accountCommitment}`));
    const observedBalances = [...this.candidate.observed.entries()].map(([paymentKey, value]) => ({ paymentKey, amount: value.amount.toString(), hyperblockNonce: value.hyperblockNonce.toString() })).sort((a, b) => a.paymentKey.localeCompare(b.paymentKey));
    return { reducerVersion: 1, mode: this.mode, acceptedEvents: this.events.size, ignoredObservations: this.ignored, duplicateEvents: this.duplicates, maxHyperblockNonce: this.candidate.maxHyperblockNonce.toString(), actions, accountBalances, observedBalances, reconciliation: { ...this.candidate.report, issues: this.candidate.report.issues.map((issue) => ({ ...issue })) } };
  }

  async createAndPromoteCheckpoint(hasher: HashProvider): Promise<VerifiedCheckpoint> {
    if (this.mode !== "NORMAL" || this.candidate.report.status !== "PASS") throw new ReducerPolicyError("CHECKPOINT_PROMOTION_DENIED");
    const capturedGeneration = this.generation; const snapshot = this.snapshot(); const stateRoot = await hasher.sha256(canonicalState(snapshot)); requireHash(stateRoot, "STATE_ROOT_INVALID");
    if (this.generation !== capturedGeneration) throw new ReducerPolicyError("CHECKPOINT_CONCURRENT_MUTATION");
    const checkpoint = Object.freeze({ schemaVersion: 1 as const, reducerVersion: 1 as const, stateRoot, eventCount: snapshot.acceptedEvents, maxHyperblockNonce: snapshot.maxHyperblockNonce, snapshot: cloneSnapshot(snapshot) });
    this.checkpoint = checkpoint; return cloneCheckpoint(checkpoint);
  }

  async verifyCheckpoint(checkpoint: VerifiedCheckpoint, hasher: HashProvider): Promise<boolean> {
    if (checkpoint.schemaVersion !== 1 || checkpoint.reducerVersion !== 1 || !HASH.test(checkpoint.stateRoot)) return false;
    if (checkpoint.eventCount !== checkpoint.snapshot.acceptedEvents || checkpoint.maxHyperblockNonce !== checkpoint.snapshot.maxHyperblockNonce) return false;
    return await hasher.sha256(canonicalState(checkpoint.snapshot)) === checkpoint.stateRoot;
  }

  servedSnapshot(): ReducerSnapshot {
    if (this.mode === "NORMAL") return this.snapshot();
    if (!this.checkpoint) throw new ReducerPolicyError("NO_VERIFIED_CHECKPOINT");
    const snapshot = cloneSnapshot(this.checkpoint.snapshot); snapshot.mode = "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED"; return snapshot;
  }

  repairFromAuthoritative(events: readonly IndexedChainEvent[], approval: RepairApproval, nowMs: number): void {
    if (this.mode !== "SERVE_VERIFIED_CHECKPOINT_MUTATIONS_DISABLED") throw new ReducerPolicyError("REPAIR_NOT_REQUIRED");
    requireExactKeys(approval, ["approvalId", "makerRole", "checkerRole", "sourceQuorumVerified", "evidenceHash", "subjectStateRoot", "authoritativeSetHash", "issuedAtMs", "expiresAtMs", "economicEffect"], "REPAIR_APPROVAL_SHAPE_INVALID");
    for (const hash of [approval.approvalId, approval.evidenceHash, approval.subjectStateRoot, approval.authoritativeSetHash]) requireHash(hash, "REPAIR_EVIDENCE_INVALID");
    if (approval.makerRole !== "A22" || approval.checkerRole !== "C03" || approval.sourceQuorumVerified !== true || approval.economicEffect !== false || !Number.isSafeInteger(nowMs) || !Number.isSafeInteger(approval.issuedAtMs) || !Number.isSafeInteger(approval.expiresAtMs) || approval.issuedAtMs > nowMs || approval.expiresAtMs <= nowMs) throw new ReducerPolicyError("REPAIR_APPROVAL_INVALID");
    if (events.length === 0) throw new ReducerPolicyError("REPAIR_EMPTY_SOURCE");
    const unique = new Map<string, IndexedChainEvent>();
    for (const event of events) { validateLineage(event); validatePayload(event.payload); if (!this.authenticityVerifier.verifyFinalizedObservation(event)) throw new ReducerPolicyError("REPAIR_EVENT_AUTHENTICITY_INVALID"); if (!isAuthoritative(event)) throw new ReducerPolicyError("REPAIR_NON_FINAL_EVENT"); const key = eventKey(event); if (unique.has(key)) throw new ReducerPolicyError("REPAIR_DUPLICATE_KEY"); unique.set(key, event); }
    const expectedSubjectStateRoot = this.checkpoint?.stateRoot ?? "0".repeat(64);
    if (approval.subjectStateRoot !== expectedSubjectStateRoot || !this.repairAuthorizationVerifier.verifyRepairAuthorization(approval, events, expectedSubjectStateRoot)) throw new ReducerPolicyError("REPAIR_AUTHORIZATION_INVALID");
    const rebuilt = buildCandidate([...unique.values()]); if (rebuilt.report.status !== "PASS") throw new ReducerPolicyError("REPAIR_RECONCILIATION_FAILED");
    const durableResult = this.repairCommitStore.commitRepairAtomically({ approvalId: approval.approvalId, subjectStateRoot: expectedSubjectStateRoot, authoritativeSetHash: approval.authoritativeSetHash, evidenceHash: approval.evidenceHash, committedAtMs: nowMs, observations: [...unique.values()].map(serializeObservationForPersistence) });
    if (durableResult === "REPLAY") throw new ReducerPolicyError("REPAIR_APPROVAL_REPLAY");
    if (durableResult !== "COMMITTED") throw new ReducerPolicyError("REPAIR_DURABLE_COMMIT_INVALID");
    this.events.clear(); for (const [key, event] of unique) this.events.set(key, event); this.candidate = rebuilt; this.mode = "NORMAL"; this.lastFailure = null; this.generation += 1;
  }
}
