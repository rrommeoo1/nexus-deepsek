export type SyntheticSurface = "PROFILE_SWITCH" | "CLIP_VIEW" | "CHAT_MESSAGE" | "MARKET_BROWSE";
export type ForbiddenProductionSink = "PAYOUT" | "REVIEW" | "REPUTATION" | "ORGANIC" | "ADOPTION";

export interface SyntheticActor {
  schemaVersion: 1;
  actorId: string;
  trafficClass: "SYSTEM_TEST";
  walletMode: "FIXTURE_ONLY";
  dataMode: "GENERATED_ONLY";
}

export interface SyntheticJourneyEnvelope extends SyntheticActor {
  requestId: string;
  runId: string;
  sequence: number;
  payloadCommitment: string;
  surfaces: readonly SyntheticSurface[];
}

export interface SyntheticRunRequest {
  schemaVersion: 1;
  runId: string;
  seed: number;
  actorCount: number;
  maxActors: 10_000;
  maxJourneyActions: 40_000;
  maxForbiddenAttempts: 50_000;
  timeoutMs: 30_000;
  networkAllowed: false;
  externalProcessesAllowed: false;
  realFundsAllowed: false;
}

export interface ProductionEffects {
  payoutAtomic: "0";
  reviews: 0;
  reputationDelta: 0;
  organicEvents: 0;
  adoptionEvents: 0;
}

export interface SyntheticRunReceipt {
  schemaVersion: 1;
  runId: string;
  seed: number;
  actorCount: number;
  journeyActionCount: number;
  forbiddenEffectAttempts: number;
  forbiddenEffectDenials: number;
  completedRequestCount: number;
  corpusSha256: string;
  actorClass: "SYSTEM_TEST";
  walletMode: "FIXTURE_ONLY";
  dataMode: "GENERATED_ONLY";
  productionEffects: ProductionEffects;
  networkOperations: 0;
  externalProcessOperations: 0;
  economicOperations: 0;
  incrementalCostEur: 0;
}

export interface SyntheticCheckpoint {
  schemaVersion: 1;
  checkpointVersion: 1;
  authorityKeyId: string;
  receipt: SyntheticRunReceipt;
  completedRequestIds: readonly string[];
  signature: string;
}

export class SyntheticTownError extends Error {
  constructor(readonly code: string) { super(code); this.name = "SyntheticTownError"; }
}

const ACTOR_KEYS = ["schemaVersion", "actorId", "trafficClass", "walletMode", "dataMode"] as const;
const JOURNEY_KEYS = [...ACTOR_KEYS, "requestId", "runId", "sequence", "payloadCommitment", "surfaces"] as const;
const RUN_KEYS = ["schemaVersion", "runId", "seed", "actorCount", "maxActors", "maxJourneyActions", "maxForbiddenAttempts", "timeoutMs", "networkAllowed", "externalProcessesAllowed", "realFundsAllowed"] as const;
const EFFECT_KEYS = ["payoutAtomic", "reviews", "reputationDelta", "organicEvents", "adoptionEvents"] as const;
const RECEIPT_KEYS = ["schemaVersion", "runId", "seed", "actorCount", "journeyActionCount", "forbiddenEffectAttempts", "forbiddenEffectDenials", "completedRequestCount", "corpusSha256", "actorClass", "walletMode", "dataMode", "productionEffects", "networkOperations", "externalProcessOperations", "economicOperations", "incrementalCostEur"] as const;
const CHECKPOINT_KEYS = ["schemaVersion", "checkpointVersion", "authorityKeyId", "receipt", "completedRequestIds", "signature"] as const;
const SURFACES: readonly SyntheticSurface[] = Object.freeze(["PROFILE_SWITCH", "CLIP_VIEW", "CHAT_MESSAGE", "MARKET_BROWSE"]);
const SINKS: readonly ForbiddenProductionSink[] = Object.freeze(["PAYOUT", "REVIEW", "REPUTATION", "ORGANIC", "ADOPTION"]);
const ID = /^NX-SYNTH-[A-Z0-9][A-Z0-9._:-]{2,63}$/;
const ACTOR_ID = /^SYSTEM_TEST:[0-9]{8}$/;
const REQUEST_ID = /^SYNTH-REQUEST:[0-9]{8}$/;
const HASH = /^[a-f0-9]{64}$/;
const KEY_ID = /^SYNTH-CHECKPOINT:[A-Z0-9_-]{3,32}$/;

function fail(code: string): never { throw new SyntheticTownError(code); }
function record(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value as object).sort(); const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(code);
  return value;
}
function exact<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(code); return value as T;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${canonical(source[key])}`).join(",")}}`;
}
async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle; if (!subtle) fail("CRYPTO_UNAVAILABLE");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function freeze<T extends object>(value: T): Readonly<T> { return Object.freeze(value); }

function parseActor(input: unknown): Readonly<SyntheticActor> {
  const o = record(input, ACTOR_KEYS, "SYNTHETIC_ACTOR_INVALID");
  if (o.schemaVersion !== 1 || typeof o.actorId !== "string" || !ACTOR_ID.test(o.actorId) || o.trafficClass !== "SYSTEM_TEST" || o.walletMode !== "FIXTURE_ONLY" || o.dataMode !== "GENERATED_ONLY") fail("SYNTHETIC_ACTOR_INVALID");
  return freeze({ schemaVersion: 1, actorId: o.actorId, trafficClass: "SYSTEM_TEST", walletMode: "FIXTURE_ONLY", dataMode: "GENERATED_ONLY" });
}

export function validateSyntheticActor(input: unknown): Readonly<SyntheticActor> { return parseActor(input); }

function parseJourney(input: unknown): Readonly<SyntheticJourneyEnvelope> {
  const o = record(input, JOURNEY_KEYS, "SYNTHETIC_JOURNEY_INVALID");
  const actor = parseActor(Object.fromEntries(ACTOR_KEYS.map((key) => [key, o[key]])));
  if (typeof o.requestId !== "string" || !REQUEST_ID.test(o.requestId) || typeof o.runId !== "string" || !ID.test(o.runId) || typeof o.payloadCommitment !== "string" || !HASH.test(o.payloadCommitment)) fail("SYNTHETIC_JOURNEY_INVALID");
  const sequence = integer(o.sequence, 1, 10_000, "SYNTHETIC_JOURNEY_INVALID");
  if (!Array.isArray(o.surfaces) || o.surfaces.length !== SURFACES.length || o.surfaces.some((surface, index) => surface !== SURFACES[index])) fail("SYNTHETIC_JOURNEY_INVALID");
  return freeze({ ...actor, requestId: o.requestId, runId: o.runId, sequence, payloadCommitment: o.payloadCommitment, surfaces: SURFACES });
}

function parseRun(input: unknown): Readonly<SyntheticRunRequest> {
  const o = record(input, RUN_KEYS, "SYNTHETIC_RUN_INVALID");
  if (o.schemaVersion !== 1 || typeof o.runId !== "string" || !ID.test(o.runId) || o.maxActors !== 10_000 || o.maxJourneyActions !== 40_000 || o.maxForbiddenAttempts !== 50_000 || o.timeoutMs !== 30_000 || o.networkAllowed !== false || o.externalProcessesAllowed !== false || o.realFundsAllowed !== false) fail("SYNTHETIC_RUN_INVALID");
  return freeze({ schemaVersion: 1, runId: o.runId, seed: integer(o.seed, 1, 0xffff_ffff, "SYNTHETIC_RUN_INVALID"), actorCount: integer(o.actorCount, 1, 10_000, "SYNTHETIC_RESOURCE_CAP_EXCEEDED"), maxActors: 10_000, maxJourneyActions: 40_000, maxForbiddenAttempts: 50_000, timeoutMs: 30_000, networkAllowed: false, externalProcessesAllowed: false, realFundsAllowed: false });
}

function parseEffects(input: unknown): ProductionEffects {
  const o = record(input, EFFECT_KEYS, "SYNTHETIC_CHECKPOINT_INVALID");
  if (o.payoutAtomic !== "0" || o.reviews !== 0 || o.reputationDelta !== 0 || o.organicEvents !== 0 || o.adoptionEvents !== 0) fail("SYNTHETIC_CHECKPOINT_INVALID");
  return freeze({ payoutAtomic: "0", reviews: 0, reputationDelta: 0, organicEvents: 0, adoptionEvents: 0 });
}

function parseReceipt(input: unknown): Readonly<SyntheticRunReceipt> {
  const o = record(input, RECEIPT_KEYS, "SYNTHETIC_CHECKPOINT_INVALID");
  if (o.schemaVersion !== 1 || typeof o.runId !== "string" || !ID.test(o.runId) || typeof o.corpusSha256 !== "string" || !HASH.test(o.corpusSha256) || o.actorClass !== "SYSTEM_TEST" || o.walletMode !== "FIXTURE_ONLY" || o.dataMode !== "GENERATED_ONLY" || o.networkOperations !== 0 || o.externalProcessOperations !== 0 || o.economicOperations !== 0 || o.incrementalCostEur !== 0) fail("SYNTHETIC_CHECKPOINT_INVALID");
  const actorCount = integer(o.actorCount, 1, 10_000, "SYNTHETIC_CHECKPOINT_INVALID");
  const receipt: SyntheticRunReceipt = { schemaVersion: 1, runId: o.runId, seed: integer(o.seed, 1, 0xffff_ffff, "SYNTHETIC_CHECKPOINT_INVALID"), actorCount, journeyActionCount: integer(o.journeyActionCount, 4, 40_000, "SYNTHETIC_CHECKPOINT_INVALID"), forbiddenEffectAttempts: integer(o.forbiddenEffectAttempts, 5, 50_000, "SYNTHETIC_CHECKPOINT_INVALID"), forbiddenEffectDenials: integer(o.forbiddenEffectDenials, 5, 50_000, "SYNTHETIC_CHECKPOINT_INVALID"), completedRequestCount: integer(o.completedRequestCount, 1, 10_000, "SYNTHETIC_CHECKPOINT_INVALID"), corpusSha256: o.corpusSha256, actorClass: "SYSTEM_TEST", walletMode: "FIXTURE_ONLY", dataMode: "GENERATED_ONLY", productionEffects: parseEffects(o.productionEffects), networkOperations: 0, externalProcessOperations: 0, economicOperations: 0, incrementalCostEur: 0 };
  if (receipt.journeyActionCount !== actorCount * 4 || receipt.forbiddenEffectAttempts !== actorCount * 5 || receipt.forbiddenEffectDenials !== receipt.forbiddenEffectAttempts || receipt.completedRequestCount !== actorCount) fail("SYNTHETIC_CHECKPOINT_INVALID");
  return freeze(receipt);
}

class XorShift32 {
  constructor(private state: number) { this.state >>>= 0; if (this.state === 0) fail("SYNTHETIC_SEED_INVALID"); }
  next(): number { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state; }
  commitment(): string { let out = ""; for (let i = 0; i < 8; i += 1) out += this.next().toString(16).padStart(8, "0"); return out; }
}

export class SyntheticCheckpointAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) {
    if (!KEY_ID.test(keyId) || !HASH.test(fixtureKey)) fail("CHECKPOINT_AUTHORITY_INVALID");
  }
  async sign(unsigned: Omit<SyntheticCheckpoint, "signature">): Promise<string> { return sha256(`${this.fixtureKey}:${canonical(unsigned)}`); }
  async verify(checkpoint: SyntheticCheckpoint): Promise<boolean> {
    if (checkpoint.authorityKeyId !== this.keyId) return false;
    const { signature: _signature, ...unsigned } = checkpoint;
    return checkpoint.signature === await this.sign(unsigned);
  }
}

export class SyntheticTownRunner {
  private readonly completedRequests = new Set<string>();
  private readonly completedRuns = new Set<string>();
  private journeyActions = 0;
  private forbiddenAttempts = 0;
  private forbiddenDenials = 0;
  private receipt: Readonly<SyntheticRunReceipt> | null = null;

  static actor(index: number): Readonly<SyntheticActor> {
    integer(index, 1, 10_000, "SYNTHETIC_ACTOR_INVALID");
    return freeze({ schemaVersion: 1, actorId: `SYSTEM_TEST:${index.toString().padStart(8, "0")}`, trafficClass: "SYSTEM_TEST", walletMode: "FIXTURE_ONLY", dataMode: "GENERATED_ONLY" });
  }

  static envelope(runId: string, seed: number, index: number): Readonly<SyntheticJourneyEnvelope> {
    if (!ID.test(runId)) fail("SYNTHETIC_JOURNEY_INVALID"); integer(seed, 1, 0xffff_ffff, "SYNTHETIC_SEED_INVALID");
    const generator = new XorShift32(seed); for (let current = 1; current < index; current += 1) generator.commitment();
    return freeze({ ...SyntheticTownRunner.actor(index), requestId: `SYNTH-REQUEST:${index.toString().padStart(8, "0")}`, runId, sequence: index, payloadCommitment: generator.commitment(), surfaces: SURFACES });
  }

  executeJourney(input: unknown): Readonly<SyntheticJourneyEnvelope> {
    const envelope = parseJourney(input);
    if (this.completedRequests.has(envelope.requestId)) fail("SYNTHETIC_REQUEST_REPLAY");
    this.completedRequests.add(envelope.requestId); this.journeyActions += envelope.surfaces.length;
    for (const sink of SINKS) this.attemptForbiddenEffect(envelope, sink);
    return envelope;
  }

  private attemptForbiddenEffect(envelope: SyntheticJourneyEnvelope, sink: ForbiddenProductionSink): void {
    if (envelope.trafficClass !== "SYSTEM_TEST" || envelope.walletMode !== "FIXTURE_ONLY" || envelope.dataMode !== "GENERATED_ONLY") fail("SYNTHETIC_ACTOR_INVALID");
    exact(sink, SINKS, "PRODUCTION_SINK_INVALID"); this.forbiddenAttempts += 1; this.forbiddenDenials += 1;
  }

  async run(input: unknown): Promise<Readonly<SyntheticRunReceipt>> {
    const request = parseRun(input);
    if (this.completedRuns.has(request.runId) || this.receipt !== null || this.completedRequests.size !== 0) fail("SYNTHETIC_RUN_REPLAY");
    const generator = new XorShift32(request.seed); const corpus: string[] = [];
    for (let index = 1; index <= request.actorCount; index += 1) {
      const envelope = freeze({ ...SyntheticTownRunner.actor(index), requestId: `SYNTH-REQUEST:${index.toString().padStart(8, "0")}`, runId: request.runId, sequence: index, payloadCommitment: generator.commitment(), surfaces: SURFACES });
      this.executeJourney(envelope); corpus.push(canonical(envelope));
    }
    if (this.journeyActions > request.maxJourneyActions || this.forbiddenAttempts > request.maxForbiddenAttempts) fail("SYNTHETIC_RESOURCE_CAP_EXCEEDED");
    this.completedRuns.add(request.runId);
    this.receipt = freeze({ schemaVersion: 1, runId: request.runId, seed: request.seed, actorCount: request.actorCount, journeyActionCount: this.journeyActions, forbiddenEffectAttempts: this.forbiddenAttempts, forbiddenEffectDenials: this.forbiddenDenials, completedRequestCount: this.completedRequests.size, corpusSha256: await sha256(corpus.join("\n")), actorClass: "SYSTEM_TEST", walletMode: "FIXTURE_ONLY", dataMode: "GENERATED_ONLY", productionEffects: freeze({ payoutAtomic: "0", reviews: 0, reputationDelta: 0, organicEvents: 0, adoptionEvents: 0 }), networkOperations: 0, externalProcessOperations: 0, economicOperations: 0, incrementalCostEur: 0 });
    return this.receipt;
  }

  async exportCheckpoint(authority: SyntheticCheckpointAuthority): Promise<Readonly<SyntheticCheckpoint>> {
    if (!this.receipt) fail("SYNTHETIC_RUN_INCOMPLETE");
    const unsigned = freeze({ schemaVersion: 1 as const, checkpointVersion: 1 as const, authorityKeyId: authority.keyId, receipt: this.receipt, completedRequestIds: freeze([...this.completedRequests].sort()) });
    return freeze({ ...unsigned, signature: await authority.sign(unsigned) });
  }

  static async restore(input: unknown, authority: SyntheticCheckpointAuthority): Promise<SyntheticTownRunner> {
    const o = record(input, CHECKPOINT_KEYS, "SYNTHETIC_CHECKPOINT_INVALID");
    if (o.schemaVersion !== 1 || o.checkpointVersion !== 1 || typeof o.authorityKeyId !== "string" || !KEY_ID.test(o.authorityKeyId) || typeof o.signature !== "string" || !HASH.test(o.signature) || !Array.isArray(o.completedRequestIds)) fail("SYNTHETIC_CHECKPOINT_INVALID");
    const ids = o.completedRequestIds.map((id) => { if (typeof id !== "string" || !REQUEST_ID.test(id)) fail("SYNTHETIC_CHECKPOINT_INVALID"); return id; });
    if (ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id, index) => index > 0 && ids[index - 1] >= id)) fail("SYNTHETIC_CHECKPOINT_INVALID");
    const checkpoint: SyntheticCheckpoint = { schemaVersion: 1, checkpointVersion: 1, authorityKeyId: o.authorityKeyId, receipt: parseReceipt(o.receipt), completedRequestIds: freeze(ids), signature: o.signature };
    if (!await authority.verify(checkpoint)) fail("SYNTHETIC_CHECKPOINT_SIGNATURE_INVALID");
    const regenerated = new SyntheticTownRunner();
    await regenerated.run({ schemaVersion: 1, runId: checkpoint.receipt.runId, seed: checkpoint.receipt.seed, actorCount: checkpoint.receipt.actorCount, maxActors: 10_000, maxJourneyActions: 40_000, maxForbiddenAttempts: 50_000, timeoutMs: 30_000, networkAllowed: false, externalProcessesAllowed: false, realFundsAllowed: false });
    const expected = await regenerated.exportCheckpoint(authority);
    if (canonical(expected) !== canonical(checkpoint)) fail("SYNTHETIC_CHECKPOINT_LINEAGE_INVALID");
    return regenerated;
  }

  projection(): Readonly<{ completedRequests: number; journeyActions: number; forbiddenAttempts: number; forbiddenDenials: number; productionEffects: ProductionEffects }> {
    return freeze({ completedRequests: this.completedRequests.size, journeyActions: this.journeyActions, forbiddenAttempts: this.forbiddenAttempts, forbiddenDenials: this.forbiddenDenials, productionEffects: freeze({ payoutAtomic: "0", reviews: 0, reputationDelta: 0, organicEvents: 0, adoptionEvents: 0 }) });
  }
}
