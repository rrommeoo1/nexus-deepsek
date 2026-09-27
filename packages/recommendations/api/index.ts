export type Surface = "SOCIAL" | "PULSE" | "WATCH" | "LIVE" | "WORK" | "DATING" | "MARKET" | "TRAVEL" | "BUSINESS" | "MUSIC" | "LEARNING" | "WELLNESS" | "KIDS";
export type ProfileType = "SOCIAL" | "WORK" | "DATING" | "MARKETPLACE" | "TRAVEL" | "BUSINESS" | "MUSIC" | "LEARNING" | "WELLNESS" | "KIDS";
export type ObjectKind = "POST" | "CLIP" | "COMMENT" | "REVIEW" | "PROFILE" | "JOB" | "LISTING" | "TRACK" | "LESSON";
export type EngagementAction = "PUBLISH" | "EDIT" | "WITHDRAW" | "LIKE" | "EXPRESSIVE_REACTION" | "NEGATIVE_PREFERENCE" | "UNDO_REACTION" | "MODERATION_TOMBSTONE";
export type NegativeSemantic = "NOT_FOR_ME" | "NOT_RELEVANT" | "PASS" | "NOT_INTERESTED" | "LESS_LIKE_THIS" | "NOT_USEFUL_FOR_ME" | "SHOW_ME_LESS";
export type ExpressiveReaction = "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY" | "CELEBRATE" | "SUPPORT" | "INSIGHTFUL" | "CURIOUS" | "FAKE_OPINION";
export type Reaction = "LIKE" | ExpressiveReaction | NegativeSemantic;
export type TrafficClass = "HUMAN_ORGANIC" | "PAID" | "AGENT" | "SYSTEM_TEST" | "INCENTIVIZED";
export type RevisionKind = "NONE" | "MINOR" | "MATERIAL";

export class EngagementIntegrityError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "EngagementIntegrityError"; }
}

const ZERO = "0".repeat(64), HASH = /^[a-f0-9]{64}$/, ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SURFACES: readonly Surface[] = ["SOCIAL", "PULSE", "WATCH", "LIVE", "WORK", "DATING", "MARKET", "TRAVEL", "BUSINESS", "MUSIC", "LEARNING", "WELLNESS", "KIDS"];
const KINDS: readonly ObjectKind[] = ["POST", "CLIP", "COMMENT", "REVIEW", "PROFILE", "JOB", "LISTING", "TRACK", "LESSON"];
const ACTIONS: readonly EngagementAction[] = ["PUBLISH", "EDIT", "WITHDRAW", "LIKE", "EXPRESSIVE_REACTION", "NEGATIVE_PREFERENCE", "UNDO_REACTION", "MODERATION_TOMBSTONE"];
const REVISIONS: readonly RevisionKind[] = ["NONE", "MINOR", "MATERIAL"];
const TRAFFIC: readonly TrafficClass[] = ["HUMAN_ORGANIC", "PAID", "AGENT", "SYSTEM_TEST", "INCENTIVIZED"];
const PROFILE_TYPES: readonly ProfileType[] = ["SOCIAL", "WORK", "DATING", "MARKETPLACE", "TRAVEL", "BUSINESS", "MUSIC", "LEARNING", "WELLNESS", "KIDS"];
const EXPRESSIVE: readonly ExpressiveReaction[] = ["LOVE", "HAHA", "WOW", "SAD", "ANGRY", "CELEBRATE", "SUPPORT", "INSIGHTFUL", "CURIOUS", "FAKE_OPINION"];
export const NEGATIVE_SEMANTIC: Readonly<Record<Surface, NegativeSemantic>> = Object.freeze({ SOCIAL: "NOT_FOR_ME", PULSE: "NOT_FOR_ME", WATCH: "NOT_FOR_ME", LIVE: "NOT_FOR_ME", WORK: "NOT_RELEVANT", DATING: "PASS", MARKET: "NOT_INTERESTED", TRAVEL: "NOT_INTERESTED", BUSINESS: "NOT_INTERESTED", MUSIC: "LESS_LIKE_THIS", LEARNING: "NOT_USEFUL_FOR_ME", WELLNESS: "NOT_USEFUL_FOR_ME", KIDS: "SHOW_ME_LESS" });

function fail(code: string): never { throw new EngagementIntegrityError(code); }
function exact<T extends string>(value: unknown, values: readonly T[], code: string): T { if (typeof value !== "string" || !values.includes(value as T)) fail(code); return value as T; }
function string(value: unknown, pattern: RegExp, code: string): string { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }
function integer(value: unknown, min: number, max: number, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code); return value as number; }
function nullableHash(value: unknown, code: string): string | null { if (value === null) return null; return string(value, HASH, code); }
function nullableReaction(value: unknown, code: string): Reaction | null { if (value === null) return null; return exact(value, ["LIKE", ...EXPRESSIVE, ...Object.values(NEGATIVE_SEMANTIC)] as readonly Reaction[], code); }
function iso(value: unknown, code: string): string { const result = string(value, ISO, code); if (!Number.isFinite(Date.parse(result))) fail(code); return result; }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> { let own: PropertyKey[], descriptors: Record<PropertyKey, PropertyDescriptor>, prototype: object | null; try { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code); own = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); prototype = Object.getPrototypeOf(value); } catch { fail(code); } if ((prototype !== Object.prototype && prototype !== null) || own.some(key => typeof key !== "string") || own.length !== keys.length || keys.some(key => !own.includes(key))) fail(code); for (const key of keys) { const descriptor = descriptors[key]; if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) fail(code); } return value as Record<string, unknown>; }
function canonical(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; }
function capture<T>(value: T, code: string): T { try { return JSON.parse(canonical(value)) as T; } catch { fail(code); } }
function frozen<T extends object>(value: T): Readonly<T> { for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) frozen(child); return Object.freeze(value); }
async function sha256(value: string): Promise<string> { const subtle = globalThis.crypto?.subtle; if (!subtle) fail("ENGAGEMENT_CRYPTO_UNAVAILABLE"); const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

export interface SignedEngagementCommand { schemaVersion: 1; actionId: string; action: EngagementAction; surface: Surface; objectKind: ObjectKind; objectCommitment: string; objectGeneration: number; actorProfileCommitment: string; actorProfileType: ProfileType; ownerProfileCommitment: string; ownerProfileType: ProfileType; actorClass: "SYSTEM_TEST"; simulatedTrafficClass: TrafficClass; contentCommitment: string; priorContentCommitment: string | null; reaction: Reaction | null; revisionKind: RevisionKind; nonce: number; policyVersion: number; occurredAt: string; authorityKeyId: string; signature: string; }
export interface EngagementEvent extends SignedEngagementCommand { ordinal: number; previousEventHash: string; resultingState: "ACTIVE" | "WITHDRAWN" | "MODERATION_TOMBSTONED"; eventHash: string; }
export interface ObjectProjection { objectCommitment: string; surface: Surface; objectKind: ObjectKind; ownerProfileCommitment: string; generation: number; contentCommitment: string; state: "ACTIVE" | "WITHDRAWN" | "MODERATION_TOMBSTONED"; revisionCount: number; tombstoneReasonCommitment: string | null; }
export interface ReactionProjection { actorProfileCommitment: string; objectCommitment: string; generation: number; reaction: Reaction; private: boolean; publicCountEligible: boolean; verificationSignal: "NONE" | "FAKE_OPINION_AGGREGATE"; qualifiedSentimentEligible: boolean; }
export interface SignedCommandVerifier { verify(command: Readonly<SignedEngagementCommand>): Promise<boolean>; }

const COMMAND_KEYS = ["schemaVersion", "actionId", "action", "surface", "objectKind", "objectCommitment", "objectGeneration", "actorProfileCommitment", "actorProfileType", "ownerProfileCommitment", "ownerProfileType", "actorClass", "simulatedTrafficClass", "contentCommitment", "priorContentCommitment", "reaction", "revisionKind", "nonce", "policyVersion", "occurredAt", "authorityKeyId", "signature"] as const;
const EVENT_KEYS = [...COMMAND_KEYS, "ordinal", "previousEventHash", "resultingState", "eventHash"] as const;
function command(input: unknown): SignedEngagementCommand { const o = plain(input, COMMAND_KEYS, "ENGAGEMENT_COMMAND_INVALID"); if (o.schemaVersion !== 1 || o.actorClass !== "SYSTEM_TEST") fail("ENGAGEMENT_COMMAND_INVALID"); return { schemaVersion: 1, actionId: string(o.actionId, ID, "ENGAGEMENT_COMMAND_INVALID"), action: exact(o.action, ACTIONS, "ENGAGEMENT_COMMAND_INVALID"), surface: exact(o.surface, SURFACES, "ENGAGEMENT_COMMAND_INVALID"), objectKind: exact(o.objectKind, KINDS, "ENGAGEMENT_COMMAND_INVALID"), objectCommitment: string(o.objectCommitment, HASH, "ENGAGEMENT_COMMAND_INVALID"), objectGeneration: integer(o.objectGeneration, 1, 1_000_000, "ENGAGEMENT_COMMAND_INVALID"), actorProfileCommitment: string(o.actorProfileCommitment, HASH, "ENGAGEMENT_COMMAND_INVALID"), actorProfileType: exact(o.actorProfileType, PROFILE_TYPES, "ENGAGEMENT_COMMAND_INVALID"), ownerProfileCommitment: string(o.ownerProfileCommitment, HASH, "ENGAGEMENT_COMMAND_INVALID"), ownerProfileType: exact(o.ownerProfileType, PROFILE_TYPES, "ENGAGEMENT_COMMAND_INVALID"), actorClass: "SYSTEM_TEST", simulatedTrafficClass: exact(o.simulatedTrafficClass, TRAFFIC, "ENGAGEMENT_COMMAND_INVALID"), contentCommitment: string(o.contentCommitment, HASH, "ENGAGEMENT_COMMAND_INVALID"), priorContentCommitment: nullableHash(o.priorContentCommitment, "ENGAGEMENT_COMMAND_INVALID"), reaction: nullableReaction(o.reaction, "ENGAGEMENT_COMMAND_INVALID"), revisionKind: exact(o.revisionKind, REVISIONS, "ENGAGEMENT_COMMAND_INVALID"), nonce: integer(o.nonce, 1, Number.MAX_SAFE_INTEGER, "ENGAGEMENT_COMMAND_INVALID"), policyVersion: integer(o.policyVersion, 1, 1_000_000, "ENGAGEMENT_COMMAND_INVALID"), occurredAt: iso(o.occurredAt, "ENGAGEMENT_COMMAND_INVALID"), authorityKeyId: string(o.authorityKeyId, ID, "ENGAGEMENT_COMMAND_INVALID"), signature: string(o.signature, HASH, "ENGAGEMENT_COMMAND_INVALID") }; }
function unsigned(value: SignedEngagementCommand): Omit<SignedEngagementCommand, "signature"> { const { signature: _signature, ...rest } = value; return rest; }

export class LocalEngagementAuthority implements SignedCommandVerifier {
  constructor(public readonly keyId: string, private readonly fixtureKey: string) { string(keyId, ID, "ENGAGEMENT_AUTHORITY_INVALID"); if (fixtureKey.length < 16) fail("ENGAGEMENT_AUTHORITY_INVALID"); }
  async issue(input: Omit<SignedEngagementCommand, "signature" | "authorityKeyId">): Promise<Readonly<SignedEngagementCommand>> { const base = { ...capture(input, "ENGAGEMENT_COMMAND_INVALID"), authorityKeyId: this.keyId }; const signature = await sha256(`${this.fixtureKey}:ENGAGEMENT:${canonical(base)}`); return frozen(command({ ...base, signature })); }
  async verify(input: Readonly<SignedEngagementCommand>): Promise<boolean> { if (input.authorityKeyId !== this.keyId) return false; return input.signature === await sha256(`${this.fixtureKey}:ENGAGEMENT:${canonical(unsigned(input))}`); }
}

export interface EngagementSnapshot { schemaVersion: 1; checkpointId: string; policyVersion: number; eventCount: number; eventHeadHash: string; batchCommitment: string; events: readonly EngagementEvent[]; issuedAt: string; expiresAt: string; authorityKeyId: string; signature: string; }
export interface SnapshotAuthority { keyId: string; sign(unsignedSnapshot: Omit<EngagementSnapshot, "signature">): Promise<string>; verify(snapshot: Readonly<EngagementSnapshot>): Promise<boolean>; }
export interface DurableEngagementCheckpoint { checkpointId: string; policyVersion: number; eventCount: number; eventHeadHash: string; batchCommitment: string; }
export class LocalSnapshotAuthority implements SnapshotAuthority {
  constructor(public readonly keyId: string, private readonly fixtureKey: string) { string(keyId, ID, "ENGAGEMENT_CHECKPOINT_AUTHORITY_INVALID"); if (fixtureKey.length < 16) fail("ENGAGEMENT_CHECKPOINT_AUTHORITY_INVALID"); }
  sign(value: Omit<EngagementSnapshot, "signature">): Promise<string> { return sha256(`${this.fixtureKey}:CHECKPOINT:${canonical(value)}`); }
  async verify(value: Readonly<EngagementSnapshot>): Promise<boolean> { if (value.authorityKeyId !== this.keyId) return false; const { signature, ...base } = value; return signature === await this.sign(base); }
}

function reactionKey(commandValue: SignedEngagementCommand): string { return `${commandValue.actorProfileCommitment}|${commandValue.objectCommitment}|${commandValue.objectGeneration}`; }
function expectedReaction(commandValue: SignedEngagementCommand): Reaction | null { if (commandValue.action === "LIKE") return "LIKE"; if (commandValue.action === "NEGATIVE_PREFERENCE") return NEGATIVE_SEMANTIC[commandValue.surface]; return null; }
function profileTypeForSurface(surface: Surface): ProfileType { if (["SOCIAL", "PULSE", "WATCH", "LIVE"].includes(surface)) return "SOCIAL"; if (surface === "MARKET") return "MARKETPLACE"; return surface as ProfileType; }
function objectAllowed(surface: Surface, kind: ObjectKind): boolean { const matrix: Readonly<Record<Surface, readonly ObjectKind[]>> = { SOCIAL: ["POST", "CLIP", "COMMENT"], PULSE: ["POST", "COMMENT"], WATCH: ["CLIP", "COMMENT"], LIVE: ["CLIP", "COMMENT"], WORK: ["PROFILE", "POST", "COMMENT", "JOB"], DATING: ["PROFILE"], MARKET: ["LISTING", "REVIEW", "COMMENT"], TRAVEL: ["LISTING", "REVIEW", "COMMENT"], BUSINESS: ["LISTING", "REVIEW", "POST", "COMMENT"], MUSIC: ["TRACK", "POST", "COMMENT"], LEARNING: ["LESSON", "POST", "COMMENT"], WELLNESS: ["POST", "CLIP", "COMMENT"], KIDS: ["POST", "CLIP", "COMMENT"] }; return matrix[surface].includes(kind); }
function expressiveAllowed(surface: Surface, kind: ObjectKind, reaction: Reaction | null): boolean { if (!reaction || !EXPRESSIVE.includes(reaction as ExpressiveReaction)) return false; if (reaction === "FAKE_OPINION") return ["SOCIAL", "PULSE", "WATCH", "LIVE"].includes(surface) && ["POST", "CLIP", "COMMENT"].includes(kind); if (["SOCIAL", "PULSE", "WATCH", "LIVE"].includes(surface)) return ["LOVE", "HAHA", "WOW", "SAD", "ANGRY"].includes(reaction); if (surface === "WORK") return kind !== "PROFILE" && ["CELEBRATE", "SUPPORT", "INSIGHTFUL", "CURIOUS"].includes(reaction); if (["MARKET", "TRAVEL", "BUSINESS"].includes(surface)) return ["LOVE", "WOW"].includes(reaction); if (surface === "MUSIC") return ["LOVE", "HAHA", "WOW", "SAD"].includes(reaction); if (surface === "LEARNING") return ["INSIGHTFUL", "CURIOUS", "SUPPORT"].includes(reaction); if (surface === "WELLNESS") return ["LOVE", "SUPPORT", "INSIGHTFUL"].includes(reaction); if (surface === "KIDS") return ["LOVE", "HAHA", "WOW"].includes(reaction); return false; }

export class EngagementLedger {
  private readonly events: EngagementEvent[] = [];
  private readonly replay = new Set<string>();
  private readonly nonceHeads = new Map<string, number>();
  private readonly objects = new Map<string, ObjectProjection>();
  private readonly reactions = new Map<string, ReactionProjection>();
  private head = ZERO;
  private gate: Promise<void> = Promise.resolve();
  constructor(private readonly actionAuthority: SignedCommandVerifier, private readonly moderationAuthority: SignedCommandVerifier, private readonly actionKeyId: string, private readonly moderationKeyId: string, public readonly policyVersion = 1) {}

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> { const prior = this.gate; let release!: () => void; this.gate = new Promise<void>(resolve => { release = resolve; }); await prior; try { return await operation(); } finally { release(); } }

  private validateTransition(c: SignedEngagementCommand): ObjectProjection {
    if (c.policyVersion !== this.policyVersion) fail("ENGAGEMENT_POLICY_STALE");
    const requiredProfileType = profileTypeForSurface(c.surface);
    if (c.actorProfileType !== requiredProfileType || c.ownerProfileType !== requiredProfileType) fail("ENGAGEMENT_PROFILE_TYPE_BINDING_MISMATCH");
    if (!objectAllowed(c.surface, c.objectKind)) fail("ENGAGEMENT_SURFACE_OBJECT_DENIED");
    const current = this.objects.get(c.objectCommitment), reaction = expectedReaction(c);
    if (c.action === "PUBLISH") { if (current) fail("ENGAGEMENT_OBJECT_EXISTS"); if (c.actorProfileCommitment !== c.ownerProfileCommitment || c.objectGeneration !== 1 || c.priorContentCommitment !== null || c.reaction !== null || c.revisionKind !== "NONE") fail("ENGAGEMENT_PUBLISH_BINDING_INVALID"); return frozen({ objectCommitment: c.objectCommitment, surface: c.surface, objectKind: c.objectKind, ownerProfileCommitment: c.ownerProfileCommitment, generation: 1, contentCommitment: c.contentCommitment, state: "ACTIVE", revisionCount: 1, tombstoneReasonCommitment: null }); }
    if (!current || current.surface !== c.surface || current.objectKind !== c.objectKind || current.ownerProfileCommitment !== c.ownerProfileCommitment) fail("ENGAGEMENT_OBJECT_BINDING_MISMATCH");
    if (c.action === "EDIT") { if (current.state !== "ACTIVE" || c.actorProfileCommitment !== current.ownerProfileCommitment || c.priorContentCommitment !== current.contentCommitment || c.reaction !== null || c.revisionKind === "NONE") fail("ENGAGEMENT_EDIT_DENIED"); const generation = c.revisionKind === "MATERIAL" ? current.generation + 1 : current.generation; if (c.objectGeneration !== generation || c.contentCommitment === current.contentCommitment) fail("ENGAGEMENT_EDIT_BINDING_INVALID"); return frozen({ ...current, generation, contentCommitment: c.contentCommitment, revisionCount: current.revisionCount + 1 }); }
    if (c.action === "WITHDRAW") { if (current.state !== "ACTIVE" || c.actorProfileCommitment !== current.ownerProfileCommitment || c.objectGeneration !== current.generation || c.priorContentCommitment !== current.contentCommitment || c.reaction !== null || c.revisionKind !== "NONE") fail("ENGAGEMENT_WITHDRAW_DENIED"); return frozen({ ...current, contentCommitment: ZERO, state: "WITHDRAWN", revisionCount: current.revisionCount + 1, tombstoneReasonCommitment: c.contentCommitment }); }
    if (c.action === "MODERATION_TOMBSTONE") { if (current.state !== "ACTIVE" || c.objectGeneration !== current.generation || c.priorContentCommitment !== current.contentCommitment || c.reaction !== null || c.revisionKind !== "NONE") fail("ENGAGEMENT_MODERATION_BINDING_INVALID"); return frozen({ ...current, contentCommitment: ZERO, state: "MODERATION_TOMBSTONED", revisionCount: current.revisionCount + 1, tombstoneReasonCommitment: c.contentCommitment }); }
    if (current.state !== "ACTIVE" || c.objectGeneration !== current.generation || c.actorProfileCommitment === current.ownerProfileCommitment || c.priorContentCommitment !== current.contentCommitment || c.contentCommitment !== current.contentCommitment || c.revisionKind !== "NONE") fail("ENGAGEMENT_REACTION_DENIED");
    const key = reactionKey(c), active = this.reactions.get(key);
    if (c.action === "UNDO_REACTION") { if (!active || c.reaction !== active.reaction) fail("ENGAGEMENT_UNDO_DENIED"); return current; }
    const validReaction = c.action === "EXPRESSIVE_REACTION" ? expressiveAllowed(c.surface, c.objectKind, c.reaction) : c.reaction === reaction && reaction !== null;
    if (!validReaction || active?.reaction === c.reaction) fail("ENGAGEMENT_REACTION_INVALID");
    if ((c.surface === "WORK" && c.objectKind === "PROFILE") || (c.surface === "DATING" && c.objectKind !== "PROFILE")) fail("ENGAGEMENT_MODE_SEMANTIC_DENIED");
    return current;
  }

  async append(input: unknown): Promise<Readonly<EngagementEvent>> {
    const c = command(capture(input, "ENGAGEMENT_COMMAND_INVALID"));
    return this.exclusive(async () => {
      if (this.replay.has(c.actionId)) fail("ENGAGEMENT_REPLAY");
      const nonceHead = this.nonceHeads.get(c.actorProfileCommitment) ?? 0;
      if (c.nonce !== nonceHead + 1) fail("ENGAGEMENT_NONCE_INVALID");
      const isModeration = c.action === "MODERATION_TOMBSTONE", verifier = isModeration ? this.moderationAuthority : this.actionAuthority, expectedKey = isModeration ? this.moderationKeyId : this.actionKeyId;
      if (c.authorityKeyId !== expectedKey || !await verifier.verify(c)) fail("ENGAGEMENT_SIGNATURE_INVALID");
      if (this.replay.has(c.actionId) || c.nonce !== (this.nonceHeads.get(c.actorProfileCommitment) ?? 0) + 1) fail("ENGAGEMENT_EXECUTION_CONFLICT");
      const projection = this.validateTransition(c), resultingState = projection.state;
      const base = { ...c, ordinal: this.events.length + 1, previousEventHash: this.head, resultingState } as const;
      const event = frozen({ ...base, eventHash: await sha256(canonical(base)) });
      if (this.replay.has(c.actionId) || c.nonce !== (this.nonceHeads.get(c.actorProfileCommitment) ?? 0) + 1 || base.previousEventHash !== this.head || base.ordinal !== this.events.length + 1) fail("ENGAGEMENT_EXECUTION_CONFLICT");
      this.events.push(event); this.head = event.eventHash; this.replay.add(c.actionId); this.nonceHeads.set(c.actorProfileCommitment, c.nonce);
      if (["PUBLISH", "EDIT", "WITHDRAW", "MODERATION_TOMBSTONE"].includes(c.action)) this.objects.set(c.objectCommitment, projection);
      if (c.action === "LIKE" || c.action === "EXPRESSIVE_REACTION" || c.action === "NEGATIVE_PREFERENCE") { const isNegative = Object.values(NEGATIVE_SEMANTIC).includes(c.reaction as NegativeSemantic), isFakeOpinion = c.reaction === "FAKE_OPINION", isPrivate = isNegative || c.surface === "DATING" || c.surface === "KIDS" || isFakeOpinion; this.reactions.set(reactionKey(c), frozen({ actorProfileCommitment: c.actorProfileCommitment, objectCommitment: c.objectCommitment, generation: c.objectGeneration, reaction: c.reaction as Reaction, private: isPrivate, publicCountEligible: !isPrivate, verificationSignal: isFakeOpinion ? "FAKE_OPINION_AGGREGATE" : "NONE", qualifiedSentimentEligible: c.simulatedTrafficClass === "HUMAN_ORGANIC" })); }
      if (c.action === "UNDO_REACTION") this.reactions.delete(reactionKey(c));
      return event;
    });
  }

  object(objectCommitment: string): Readonly<ObjectProjection> { const value = this.objects.get(objectCommitment); if (!value) fail("ENGAGEMENT_OBJECT_NOT_FOUND"); return frozen({ ...value }); }
  activeReaction(actor: string, objectCommitment: string, generation: number): Readonly<ReactionProjection> | null { const value = this.reactions.get(`${actor}|${objectCommitment}|${generation}`); return value ? frozen({ ...value }) : null; }
  publicNegativeCount(_objectCommitment: string): never { fail("ENGAGEMENT_PUBLIC_NEGATIVE_COUNT_FORBIDDEN"); }
  receipts(): readonly Readonly<EngagementEvent>[] { return frozen(this.events.map(event => ({ ...event }))); }

  async exportSnapshot(checkpointId: string, issuedAt: string, expiresAt: string, authority: SnapshotAuthority): Promise<Readonly<EngagementSnapshot>> { string(checkpointId, ID, "ENGAGEMENT_SNAPSHOT_INVALID"); iso(issuedAt, "ENGAGEMENT_SNAPSHOT_INVALID"); iso(expiresAt, "ENGAGEMENT_SNAPSHOT_INVALID"); if (Date.parse(expiresAt) <= Date.parse(issuedAt)) fail("ENGAGEMENT_SNAPSHOT_INVALID"); return this.exclusive(async () => { const events = capture(this.events, "ENGAGEMENT_SNAPSHOT_INVALID") as EngagementEvent[], capturedHead = this.head; const batchCommitment = await sha256(canonical(events.map(event => event.eventHash))); const base: Omit<EngagementSnapshot, "signature"> = { schemaVersion: 1, checkpointId, policyVersion: this.policyVersion, eventCount: events.length, eventHeadHash: capturedHead, batchCommitment, events: frozen(events), issuedAt, expiresAt, authorityKeyId: authority.keyId }; return frozen({ ...base, signature: await authority.sign(base) }); }); }

  static async restore(input: unknown, actionAuthority: SignedCommandVerifier, moderationAuthority: SignedCommandVerifier, actionKeyId: string, moderationKeyId: string, snapshotAuthority: SnapshotAuthority, durable: Readonly<DurableEngagementCheckpoint>, now: string): Promise<EngagementLedger> {
    const keys = ["schemaVersion", "checkpointId", "policyVersion", "eventCount", "eventHeadHash", "batchCommitment", "events", "issuedAt", "expiresAt", "authorityKeyId", "signature"] as const;
    const captured = capture(input, "ENGAGEMENT_SNAPSHOT_INVALID"), o = plain(captured, keys, "ENGAGEMENT_SNAPSHOT_INVALID");
    if (o.schemaVersion !== 1 || !Array.isArray(o.events) || o.authorityKeyId !== snapshotAuthority.keyId || !await snapshotAuthority.verify(captured as EngagementSnapshot)) fail("ENGAGEMENT_SNAPSHOT_INVALID");
    const timestamp = iso(now, "ENGAGEMENT_SNAPSHOT_INVALID"), issuedAt = iso(o.issuedAt, "ENGAGEMENT_SNAPSHOT_INVALID"), expiresAt = iso(o.expiresAt, "ENGAGEMENT_SNAPSHOT_INVALID");
    if (Date.parse(issuedAt) > Date.parse(timestamp) || Date.parse(expiresAt) <= Date.parse(timestamp)) fail("ENGAGEMENT_SNAPSHOT_EXPIRED");
    const ledger = new EngagementLedger(actionAuthority, moderationAuthority, actionKeyId, moderationKeyId, integer(o.policyVersion, 1, 1_000_000, "ENGAGEMENT_SNAPSHOT_INVALID"));
    let expectedHead = ZERO;
    for (let index = 0; index < o.events.length; index += 1) { const raw = plain(o.events[index], EVENT_KEYS, "ENGAGEMENT_SNAPSHOT_INVALID"); const c = command(Object.fromEntries(COMMAND_KEYS.map(key => [key, raw[key]]))); if (raw.ordinal !== index + 1 || raw.previousEventHash !== expectedHead) fail("ENGAGEMENT_EVENT_LINEAGE_INVALID"); const expected = await ledger.append(c), eventHash = string(raw.eventHash, HASH, "ENGAGEMENT_EVENT_LINEAGE_INVALID"); if (expected.eventHash !== eventHash || expected.resultingState !== raw.resultingState) fail("ENGAGEMENT_EVENT_LINEAGE_INVALID"); expectedHead = eventHash; }
    const eventCount = integer(o.eventCount, 0, 1_000_000, "ENGAGEMENT_SNAPSHOT_INVALID"), eventHeadHash = string(o.eventHeadHash, HASH, "ENGAGEMENT_SNAPSHOT_INVALID"), batchCommitment = string(o.batchCommitment, HASH, "ENGAGEMENT_SNAPSHOT_INVALID");
    if (eventCount !== ledger.events.length || eventHeadHash !== expectedHead || batchCommitment !== await sha256(canonical(ledger.events.map(event => event.eventHash)))) fail("ENGAGEMENT_SNAPSHOT_LINEAGE_INVALID");
    if (durable.checkpointId !== o.checkpointId || durable.policyVersion !== ledger.policyVersion || durable.eventCount !== eventCount || durable.eventHeadHash !== eventHeadHash || durable.batchCommitment !== batchCommitment) fail("ENGAGEMENT_CHECKPOINT_STALE");
    return ledger;
  }
}

export interface RankingPolicy { policyVersion: number; minEffectiveImpressions: number; minIndependentClusters: number; maxClusterContributionBps: number; negativeConfidenceThresholdBps: number; globalNegativePenaltyCapBps: number; explorationFloorBps: number; }
export interface SimulatedImpression { actorCommitment: string; clusterCommitment: string; trafficClass: TrafficClass; quarantined: boolean; completionBps: number; rewatch: boolean; saved: boolean; shared: boolean; followed: boolean; meaningfulConversation: boolean; negative: boolean; fakeOpinion: boolean; }
export interface RankingResult { simulationOnly: true; effectiveImpressions: number; independentClusters: number; qualifiedNegativeImpressions: number; negativeLowerConfidenceBps: number; globalNegativePenaltyBps: number; explorationFloorBps: number; organicTrendEligible: boolean; removalDecision: "NEVER_FROM_DISLIKE"; scoreBps: number; excluded: Readonly<Record<"PAID" | "AGENT" | "SYSTEM_TEST" | "INCENTIVIZED" | "QUARANTINED" | "DUPLICATE", number>>; }
const POLICY_KEYS = ["policyVersion", "minEffectiveImpressions", "minIndependentClusters", "maxClusterContributionBps", "negativeConfidenceThresholdBps", "globalNegativePenaltyCapBps", "explorationFloorBps"] as const;
export function viralFairRank(policyInput: unknown, impressionsInput: unknown, isNewContent: boolean): Readonly<RankingResult> {
  const p = plain(policyInput, POLICY_KEYS, "RANKING_POLICY_INVALID"), policy: RankingPolicy = { policyVersion: integer(p.policyVersion, 1, 1_000_000, "RANKING_POLICY_INVALID"), minEffectiveImpressions: integer(p.minEffectiveImpressions, 1, 1_000_000, "RANKING_POLICY_INVALID"), minIndependentClusters: integer(p.minIndependentClusters, 2, 100_000, "RANKING_POLICY_INVALID"), maxClusterContributionBps: integer(p.maxClusterContributionBps, 1, 10_000, "RANKING_POLICY_INVALID"), negativeConfidenceThresholdBps: integer(p.negativeConfidenceThresholdBps, 1, 10_000, "RANKING_POLICY_INVALID"), globalNegativePenaltyCapBps: integer(p.globalNegativePenaltyCapBps, 0, 10_000, "RANKING_POLICY_INVALID"), explorationFloorBps: integer(p.explorationFloorBps, 0, 10_000, "RANKING_POLICY_INVALID") };
  if (typeof isNewContent !== "boolean" || !Array.isArray(impressionsInput)) fail("RANKING_INPUT_INVALID");
  const excluded = { PAID: 0, AGENT: 0, SYSTEM_TEST: 0, INCENTIVIZED: 0, QUARANTINED: 0, DUPLICATE: 0 }, parsed: SimulatedImpression[] = [];
  for (const raw of impressionsInput) { const o = plain(raw, ["actorCommitment", "clusterCommitment", "trafficClass", "quarantined", "completionBps", "rewatch", "saved", "shared", "followed", "meaningfulConversation", "negative", "fakeOpinion"], "RANKING_INPUT_INVALID"); parsed.push({ actorCommitment: string(o.actorCommitment, HASH, "RANKING_INPUT_INVALID"), clusterCommitment: string(o.clusterCommitment, HASH, "RANKING_INPUT_INVALID"), trafficClass: exact(o.trafficClass, TRAFFIC, "RANKING_INPUT_INVALID"), quarantined: typeof o.quarantined === "boolean" ? o.quarantined : fail("RANKING_INPUT_INVALID"), completionBps: integer(o.completionBps, 0, 10_000, "RANKING_INPUT_INVALID"), rewatch: typeof o.rewatch === "boolean" ? o.rewatch : fail("RANKING_INPUT_INVALID"), saved: typeof o.saved === "boolean" ? o.saved : fail("RANKING_INPUT_INVALID"), shared: typeof o.shared === "boolean" ? o.shared : fail("RANKING_INPUT_INVALID"), followed: typeof o.followed === "boolean" ? o.followed : fail("RANKING_INPUT_INVALID"), meaningfulConversation: typeof o.meaningfulConversation === "boolean" ? o.meaningfulConversation : fail("RANKING_INPUT_INVALID"), negative: typeof o.negative === "boolean" ? o.negative : fail("RANKING_INPUT_INVALID"), fakeOpinion: typeof o.fakeOpinion === "boolean" ? o.fakeOpinion : fail("RANKING_INPUT_INVALID") }); }
  parsed.sort((a, b) => a.actorCommitment.localeCompare(b.actorCommitment) || canonical(a).localeCompare(canonical(b)));
  const byActor = new Map<string, SimulatedImpression[]>(); for (const item of parsed) byActor.set(item.actorCommitment, [...(byActor.get(item.actorCommitment) ?? []), item]);
  const organic: SimulatedImpression[] = [];
  for (const items of byActor.values()) { const unique = new Set(items.map(canonical)); if (unique.size > 1) { excluded.DUPLICATE += items.length; continue; } excluded.DUPLICATE += items.length - 1; const item = items[0]; if (item.quarantined) { excluded.QUARANTINED++; continue; } if (item.trafficClass !== "HUMAN_ORGANIC") { excluded[item.trafficClass]++; continue; } organic.push(item); }
  const rawByCluster = new Map<string, SimulatedImpression[]>(); for (const item of organic) rawByCluster.set(item.clusterCommitment, [...(rawByCluster.get(item.clusterCommitment) ?? []), item]);
  const clusterCap = Math.max(1, Math.ceil(organic.length * policy.maxClusterContributionBps / 10_000)), effective = [...rawByCluster.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, items]) => items.sort((a, b) => a.actorCommitment.localeCompare(b.actorCommitment)).slice(0, clusterCap));
  const n = effective.length, clusters = new Set(effective.map(item => item.clusterCommitment)).size, negatives = effective.filter(item => item.negative || item.fakeOpinion).length;
  const z = 1.96, phat = n ? negatives / n : 0, denominator = 1 + z * z / Math.max(n, 1), centre = phat + z * z / (2 * Math.max(n, 1)), margin = z * Math.sqrt((phat * (1 - phat) + z * z / (4 * Math.max(n, 1))) / Math.max(n, 1)), lower = n ? Math.max(0, (centre - margin) / denominator) : 0, lowerBps = Math.floor(lower * 10_000);
  const gate = n >= policy.minEffectiveImpressions && clusters >= policy.minIndependentClusters && lowerBps >= policy.negativeConfidenceThresholdBps;
  const penalty = gate ? Math.min(policy.globalNegativePenaltyCapBps, lowerBps) : 0;
  const positive = effective.reduce((sum, item) => sum + item.completionBps * 0.45 + (item.rewatch ? 900 : 0) + (item.saved ? 800 : 0) + (item.shared ? 1000 : 0) + (item.followed ? 1200 : 0) + (item.meaningfulConversation ? 700 : 0), 0), satisfaction = n ? Math.min(10_000, Math.floor(positive / n)) : 0;
  const exploration = isNewContent ? policy.explorationFloorBps : 0, score = Math.max(exploration, Math.min(10_000, satisfaction - penalty));
  return frozen({ simulationOnly: true, effectiveImpressions: n, independentClusters: clusters, qualifiedNegativeImpressions: negatives, negativeLowerConfidenceBps: lowerBps, globalNegativePenaltyBps: penalty, explorationFloorBps: exploration, organicTrendEligible: n >= policy.minEffectiveImpressions && clusters >= policy.minIndependentClusters && score >= 5_000, removalDecision: "NEVER_FROM_DISLIKE", scoreBps: score, excluded: frozen(excluded) });
}

export interface ExplorationCandidate { cohortCommitment: string; candidateCommitment: string; isNew: boolean; eligible: boolean; baseScoreBps: number; trafficClass: TrafficClass; quarantined: boolean; }
export interface ExplorationAllocation { simulationOnly: true; cohortCommitment: string; inventorySlots: number; reservedNewSlots: number; selectedNewCount: number; allocationBps: number; floorSatisfied: boolean; selectedCandidateCommitments: readonly string[]; }
export function allocateExploration(policyInput: unknown, candidatesInput: unknown, inventorySlotsInput: unknown): Readonly<ExplorationAllocation> {
  const p = plain(policyInput, POLICY_KEYS, "RANKING_POLICY_INVALID"), floorBps = integer(p.explorationFloorBps, 0, 10_000, "RANKING_POLICY_INVALID"), slots = integer(inventorySlotsInput, 1, 10_000, "EXPLORATION_INPUT_INVALID");
  if (!Array.isArray(candidatesInput) || candidatesInput.length === 0) fail("EXPLORATION_INPUT_INVALID");
  const candidates: ExplorationCandidate[] = candidatesInput.map(raw => { const o = plain(raw, ["cohortCommitment", "candidateCommitment", "isNew", "eligible", "baseScoreBps", "trafficClass", "quarantined"], "EXPLORATION_INPUT_INVALID"); return { cohortCommitment: string(o.cohortCommitment, HASH, "EXPLORATION_INPUT_INVALID"), candidateCommitment: string(o.candidateCommitment, HASH, "EXPLORATION_INPUT_INVALID"), isNew: typeof o.isNew === "boolean" ? o.isNew : fail("EXPLORATION_INPUT_INVALID"), eligible: typeof o.eligible === "boolean" ? o.eligible : fail("EXPLORATION_INPUT_INVALID"), baseScoreBps: integer(o.baseScoreBps, 0, 10_000, "EXPLORATION_INPUT_INVALID"), trafficClass: exact(o.trafficClass, TRAFFIC, "EXPLORATION_INPUT_INVALID"), quarantined: typeof o.quarantined === "boolean" ? o.quarantined : fail("EXPLORATION_INPUT_INVALID") }; });
  const cohort = candidates[0].cohortCommitment; if (candidates.some(item => item.cohortCommitment !== cohort) || new Set(candidates.map(item => item.candidateCommitment)).size !== candidates.length) fail("EXPLORATION_COHORT_INVALID");
  const eligible = candidates.filter(item => item.eligible && item.trafficClass === "HUMAN_ORGANIC" && !item.quarantined).sort((a, b) => b.baseScoreBps - a.baseScoreBps || a.candidateCommitment.localeCompare(b.candidateCommitment)), availableSlots = Math.min(slots, eligible.length), reservedNewSlots = Math.min(availableSlots, Math.ceil(slots * floorBps / 10_000)), fresh = eligible.filter(item => item.isNew), selectedFresh = fresh.slice(0, reservedNewSlots), selected = [...selectedFresh];
  for (const item of eligible) { if (selected.length >= availableSlots) break; if (!selected.some(value => value.candidateCommitment === item.candidateCommitment)) selected.push(item); }
  const selectedNewCount = selected.filter(item => item.isNew).length, requiredFromAvailable = Math.min(reservedNewSlots, fresh.length), allocationBps = selected.length ? Math.floor(selectedNewCount * 10_000 / selected.length) : 0;
  return frozen({ simulationOnly: true, cohortCommitment: cohort, inventorySlots: slots, reservedNewSlots, selectedNewCount, allocationBps, floorSatisfied: selectedNewCount >= requiredFromAvailable, selectedCandidateCommitments: frozen(selected.map(item => item.candidateCommitment)) });
}
