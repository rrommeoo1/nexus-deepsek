export type ActorClass = "HUMAN" | "SYSTEM_TEST" | "AGENT";
export type SupportKind = "CORE_TIP" | "CORE_SUBSCRIPTION" | "PRIVE";
export type ActionPriority = "LIKE" | "COMMENT" | "SUPPORT" | "SAFETY" | "FINANCIAL";
export type SponsorshipDecision = "SPONSORED" | "PENDING_SPONSORSHIP" | "USER_PAYS_GAS";
export type DeductionType = "TAX" | "RAIL" | "STORE" | "REFUND" | "CHARGEBACK";
export type DeductionStatus = "CONFIRMED" | "FROZEN" | "REVERSED";

export class EconomicPolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "EconomicPolicyError"; }
}

const HEX64 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/;
const COUNTRY = /^[A-Z]{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const BPS = 10_000n;
const CONFIG_KEYS = ["schemaVersion", "contractVersion", "configHash", "effectiveAt", "expiresAt", "creatorPoolRevenueBps", "creatorEpochCapMicros", "creatorClaimCapBps", "nodePoolRevenueBps", "nodeEpochCapMicros", "nodeOwnerClusterCapBps", "sponsoredGasTargetBps", "sponsoredGasHardCapBps", "splits"] as const;
const SPLIT_KEYS = ["creator", "platform", "safetyReserve", "infrastructure"] as const;

function fail(code: string): never { throw new EconomicPolicyError(code); }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  let proto: object | null; let own: PropertyKey[]; let descriptors: Record<PropertyKey, PropertyDescriptor>;
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
    proto = Object.getPrototypeOf(value); own = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value);
  } catch { fail(code); }
  if (proto !== Object.prototype && proto !== null) fail(code);
  if (own.some((key) => typeof key !== "string") || own.length !== keys.length || keys.some((key) => !own.includes(key))) fail(code);
  for (const key of keys) { const d = descriptors[key]; if (!d || !("value" in d) || d.get || d.set) fail(code); }
  return value as Record<string, unknown>;
}
function array(value: unknown, code: string): unknown[] { if (!Array.isArray(value)) fail(code); return value; }
function bool(value: unknown, code: string): boolean { if (typeof value !== "boolean") fail(code); return value; }
function bigint(value: unknown, code: string): bigint { if (typeof value !== "bigint" || value < 0n) fail(code); return value; }
function integer(value: unknown, min: number, max: number, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code); return value as number; }
function id(value: unknown, code: string): string { if (typeof value !== "string" || !SAFE_ID.test(value)) fail(code); return value; }
function exactString<T extends string>(value: unknown, choices: readonly T[], code: string): T { if (typeof value !== "string" || !choices.includes(value as T)) fail(code); return value as T; }
function iso(value: unknown, code: string): string { if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value))) fail(code); return value; }
function hash(value: unknown, code: string): string { if (typeof value !== "string" || !HEX64.test(value)) fail(code); return value; }
function country(value: unknown, code: string): string { if (typeof value !== "string" || !COUNTRY.test(value)) fail(code); return value; }
function active(issuedAt: string, expiresAt: string, now: string, code: string): void { if (Date.parse(issuedAt) > Date.parse(now) || Date.parse(expiresAt) <= Date.parse(now) || Date.parse(issuedAt) >= Date.parse(expiresAt)) fail(code); }
function deepFreeze<T extends object>(value: T): Readonly<T> { for (const item of Object.values(value)) if (item && typeof item === "object") deepFreeze(item); return Object.freeze(value); }

export interface Split { creator: number; platform: number; safetyReserve: number; infrastructure: number }
export interface EconomicConfig {
  schemaVersion: 1; contractVersion: "1.0.0"; configHash: string; effectiveAt: string; expiresAt: string;
  creatorPoolRevenueBps: number; creatorEpochCapMicros: bigint; creatorClaimCapBps: number;
  nodePoolRevenueBps: number; nodeEpochCapMicros: bigint; nodeOwnerClusterCapBps: number;
  sponsoredGasTargetBps: number; sponsoredGasHardCapBps: number;
  splits: Record<SupportKind, Split>;
}

export const DEFAULT_ECONOMIC_CONFIG: EconomicConfig = deepFreeze({
  schemaVersion: 1, contractVersion: "1.0.0", configHash: "9f15c55c5f262381f30ce02b1bc7c7e24080b585215f8d6c60795a4b8020aaf3",
  effectiveAt: "2026-08-01T00:00:00Z", expiresAt: "2027-08-01T00:00:00Z",
  creatorPoolRevenueBps: 1500, creatorEpochCapMicros: 100_000_000_000n, creatorClaimCapBps: 500,
  nodePoolRevenueBps: 1000, nodeEpochCapMicros: 100_000_000_000n, nodeOwnerClusterCapBps: 1500,
  sponsoredGasTargetBps: 500, sponsoredGasHardCapBps: 800,
  splits: {
    CORE_TIP: { creator: 9000, platform: 500, safetyReserve: 300, infrastructure: 200 },
    CORE_SUBSCRIPTION: { creator: 8500, platform: 1000, safetyReserve: 300, infrastructure: 200 },
    PRIVE: { creator: 8000, platform: 1200, safetyReserve: 500, infrastructure: 300 },
  },
});

export function validateEconomicConfig(input: unknown, nowIso?: string): Readonly<EconomicConfig> {
  const o = plain(input, CONFIG_KEYS, "CONFIG_SHAPE_INVALID");
  if (o.schemaVersion !== 1 || o.contractVersion !== "1.0.0") fail("CONFIG_VERSION_INVALID");
  const configHash = hash(o.configHash, "CONFIG_HASH_INVALID");
  const effectiveAt = iso(o.effectiveAt, "CONFIG_TIME_INVALID"); const expiresAt = iso(o.expiresAt, "CONFIG_TIME_INVALID");
  if (Date.parse(effectiveAt) >= Date.parse(expiresAt)) fail("CONFIG_TIME_INVALID");
  if (nowIso !== undefined) active(effectiveAt, expiresAt, iso(nowIso, "CONFIG_TIME_INVALID"), "CONFIG_NOT_ACTIVE");
  const result: EconomicConfig = {
    schemaVersion: 1, contractVersion: "1.0.0", configHash, effectiveAt, expiresAt,
    creatorPoolRevenueBps: integer(o.creatorPoolRevenueBps, 0, 2000, "CONFIG_HARD_CAP_EXCEEDED"),
    creatorEpochCapMicros: bigint(o.creatorEpochCapMicros, "CONFIG_MONEY_INVALID"),
    creatorClaimCapBps: integer(o.creatorClaimCapBps, 1, 500, "CONFIG_HARD_CAP_EXCEEDED"),
    nodePoolRevenueBps: integer(o.nodePoolRevenueBps, 0, 1000, "CONFIG_HARD_CAP_EXCEEDED"),
    nodeEpochCapMicros: bigint(o.nodeEpochCapMicros, "CONFIG_MONEY_INVALID"),
    nodeOwnerClusterCapBps: integer(o.nodeOwnerClusterCapBps, 1, 1500, "CONFIG_HARD_CAP_EXCEEDED"),
    sponsoredGasTargetBps: integer(o.sponsoredGasTargetBps, 0, 500, "GAS_CAP_INVALID"),
    sponsoredGasHardCapBps: integer(o.sponsoredGasHardCapBps, 0, 800, "GAS_CAP_INVALID"),
    splits: {} as Record<SupportKind, Split>,
  };
  if (result.sponsoredGasTargetBps > result.sponsoredGasHardCapBps) fail("GAS_CAP_INVALID");
  const splitMap = plain(o.splits, ["CORE_TIP", "CORE_SUBSCRIPTION", "PRIVE"], "SPLITS_SHAPE_INVALID");
  for (const kind of ["CORE_TIP", "CORE_SUBSCRIPTION", "PRIVE"] as const) {
    const row = plain(splitMap[kind], SPLIT_KEYS, "SPLIT_SHAPE_INVALID");
    const split = { creator: integer(row.creator, 0, 10000, "SPLIT_INVALID"), platform: integer(row.platform, 0, 10000, "SPLIT_INVALID"), safetyReserve: integer(row.safetyReserve, 0, 10000, "SPLIT_INVALID"), infrastructure: integer(row.infrastructure, 0, 10000, "SPLIT_INVALID") };
    if (Object.values(split).reduce((a, b) => a + b, 0) !== 10_000) fail("SPLIT_NOT_CONSERVATIVE");
    result.splits[kind] = split;
  }
  const known = DEFAULT_ECONOMIC_CONFIG;
  if (result.configHash !== known.configHash) fail("CONFIG_HASH_UNRECOGNIZED");
  const scalarMatch = result.schemaVersion === known.schemaVersion && result.contractVersion === known.contractVersion && result.effectiveAt === known.effectiveAt && result.expiresAt === known.expiresAt && result.creatorPoolRevenueBps === known.creatorPoolRevenueBps && result.creatorEpochCapMicros === known.creatorEpochCapMicros && result.creatorClaimCapBps === known.creatorClaimCapBps && result.nodePoolRevenueBps === known.nodePoolRevenueBps && result.nodeEpochCapMicros === known.nodeEpochCapMicros && result.nodeOwnerClusterCapBps === known.nodeOwnerClusterCapBps && result.sponsoredGasTargetBps === known.sponsoredGasTargetBps && result.sponsoredGasHardCapBps === known.sponsoredGasHardCapBps;
  const splitMatch = (["CORE_TIP", "CORE_SUBSCRIPTION", "PRIVE"] as const).every((kind) => SPLIT_KEYS.every((key) => result.splits[kind][key] === known.splits[kind][key]));
  if (!scalarMatch || !splitMatch) fail("CONFIG_HASH_CONTENT_MISMATCH");
  return deepFreeze(result) as Readonly<EconomicConfig>;
}

export interface PrincipalAttestation { schemaVersion: 1; subjectId: string; principalId: string; riskClusterId: string; epochId: string; issuedAt: string; expiresAt: string; issuerKeyId: string; proofHash: string; signature: string }
export interface EngagementAttestation { schemaVersion: 1; supporterPrincipalId: string; deviceClusterId: string; walletClusterId: string; epochId: string; issuedAt: string; expiresAt: string; issuerKeyId: string; proofHash: string; signature: string }
export interface AdultCapability { schemaVersion: 1; subjectId: string; allocationId: string; countryCode: string; operation: "QUOTE" | "SETTLEMENT"; configHash: string; ageVerified: boolean; identityVerified: boolean; consentVerified: boolean; territoryAllowed: boolean; countryAllowed: boolean; legalMemoApproved: boolean; providerApproved: boolean; taxReportingReady: boolean; publicationAllowed: boolean; distributionChannel: "WEB"; issuedAt: string; expiresAt: string; countryPolicyVersion: string; issuerKeyId: string; signature: string }
export interface GasBudgetSnapshot { schemaVersion: 1; epochId: string; configHash: string; eligibleNetRevenueMicros: bigint; acquisitionBudgetMicros: bigint; spentMicrosEur: bigint; issuedAt: string; expiresAt: string; issuerKeyId: string; signature: string }
export interface EconomicAuthorityVerifier { verifyCreator(attestation: Readonly<PrincipalAttestation>, epochId: string, configHash: string, qualificationReceiptHash: string): boolean; verifyContribution(attestation: Readonly<EngagementAttestation>, creatorPrincipalId: string, configHash: string): boolean; verifyNode(attestation: Readonly<PrincipalAttestation>, epochId: string, configHash: string, serviceReceiptHash: string): boolean; verifyBudget(snapshot: Readonly<GasBudgetSnapshot>): boolean; verifyAdult(capability: Readonly<AdultCapability>): boolean }

const ATTESTATION_KEYS = ["schemaVersion", "subjectId", "principalId", "riskClusterId", "epochId", "issuedAt", "expiresAt", "issuerKeyId", "proofHash", "signature"] as const;
function parseAttestation(value: unknown, now: string): PrincipalAttestation {
  const o = plain(value, ATTESTATION_KEYS, "ATTESTATION_SHAPE_INVALID"); if (o.schemaVersion !== 1) fail("ATTESTATION_VERSION_INVALID");
  const result = { schemaVersion: 1 as const, subjectId: id(o.subjectId, "ATTESTATION_ID_INVALID"), principalId: id(o.principalId, "ATTESTATION_ID_INVALID"), riskClusterId: id(o.riskClusterId, "ATTESTATION_ID_INVALID"), epochId: id(o.epochId, "ATTESTATION_ID_INVALID"), issuedAt: iso(o.issuedAt, "ATTESTATION_TIME_INVALID"), expiresAt: iso(o.expiresAt, "ATTESTATION_TIME_INVALID"), issuerKeyId: id(o.issuerKeyId, "ATTESTATION_ID_INVALID"), proofHash: hash(o.proofHash, "ATTESTATION_PROOF_INVALID"), signature: hash(o.signature, "ATTESTATION_SIGNATURE_INVALID") };
  active(result.issuedAt, result.expiresAt, now, "ATTESTATION_NOT_ACTIVE"); return deepFreeze(result) as PrincipalAttestation;
}

const DEDUCTION_KEYS = ["id", "type", "amountMicros", "receiptHash", "status"] as const;
export interface DeductionLine { id: string; type: DeductionType; amountMicros: bigint; receiptHash: string; status: DeductionStatus }
function parseDeductions(value: unknown): DeductionLine[] {
  const rows = array(value, "DEDUCTIONS_INVALID"); const seen = new Set<string>();
  return rows.map((item) => { const o = plain(item, DEDUCTION_KEYS, "DEDUCTION_SHAPE_INVALID"); const result = { id: id(o.id, "DEDUCTION_ID_INVALID"), type: exactString(o.type, ["TAX", "RAIL", "STORE", "REFUND", "CHARGEBACK"], "DEDUCTION_TYPE_INVALID"), amountMicros: bigint(o.amountMicros, "DEDUCTION_AMOUNT_INVALID"), receiptHash: hash(o.receiptHash, "DEDUCTION_RECEIPT_INVALID"), status: exactString(o.status, ["CONFIRMED", "FROZEN", "REVERSED"], "DEDUCTION_STATUS_INVALID") }; if (seen.has(result.id)) fail("DEDUCTION_DUPLICATE"); seen.add(result.id); if (result.status === "FROZEN" && result.type !== "REFUND" && result.type !== "CHARGEBACK") fail("DEDUCTION_FREEZE_INVALID"); return deepFreeze(result) as DeductionLine; });
}

const ADULT_KEYS = ["schemaVersion", "subjectId", "allocationId", "countryCode", "operation", "configHash", "ageVerified", "identityVerified", "consentVerified", "territoryAllowed", "countryAllowed", "legalMemoApproved", "providerApproved", "taxReportingReady", "publicationAllowed", "distributionChannel", "issuedAt", "expiresAt", "countryPolicyVersion", "issuerKeyId", "signature"] as const;
function parseAdult(value: unknown, expected: { profileId: string; allocationId: string; countryCode: string; operation: "QUOTE" | "SETTLEMENT"; configHash: string }, now: string, verifier: EconomicAuthorityVerifier): AdultCapability {
  const o = plain(value, ADULT_KEYS, "ADULT_CAPABILITY_REQUIRED"); if (o.schemaVersion !== 1) fail("ADULT_CAPABILITY_INVALID");
  const result: AdultCapability = { schemaVersion: 1, subjectId: id(o.subjectId, "ADULT_CAPABILITY_INVALID"), allocationId: id(o.allocationId, "ADULT_CAPABILITY_INVALID"), countryCode: country(o.countryCode, "ADULT_CAPABILITY_INVALID"), operation: exactString(o.operation, ["QUOTE", "SETTLEMENT"], "ADULT_CAPABILITY_INVALID"), configHash: hash(o.configHash, "ADULT_CAPABILITY_INVALID"), ageVerified: bool(o.ageVerified, "ADULT_CAPABILITY_INVALID"), identityVerified: bool(o.identityVerified, "ADULT_CAPABILITY_INVALID"), consentVerified: bool(o.consentVerified, "ADULT_CAPABILITY_INVALID"), territoryAllowed: bool(o.territoryAllowed, "ADULT_CAPABILITY_INVALID"), countryAllowed: bool(o.countryAllowed, "ADULT_CAPABILITY_INVALID"), legalMemoApproved: bool(o.legalMemoApproved, "ADULT_CAPABILITY_INVALID"), providerApproved: bool(o.providerApproved, "ADULT_CAPABILITY_INVALID"), taxReportingReady: bool(o.taxReportingReady, "ADULT_CAPABILITY_INVALID"), publicationAllowed: bool(o.publicationAllowed, "ADULT_CAPABILITY_INVALID"), distributionChannel: exactString(o.distributionChannel, ["WEB"], "ADULT_DISTRIBUTION_DENIED"), issuedAt: iso(o.issuedAt, "ADULT_CAPABILITY_INVALID"), expiresAt: iso(o.expiresAt, "ADULT_CAPABILITY_INVALID"), countryPolicyVersion: id(o.countryPolicyVersion, "ADULT_CAPABILITY_INVALID"), issuerKeyId: id(o.issuerKeyId, "ADULT_CAPABILITY_INVALID"), signature: hash(o.signature, "ADULT_CAPABILITY_INVALID") };
  active(result.issuedAt, result.expiresAt, now, "ADULT_CAPABILITY_EXPIRED"); if (result.configHash !== expected.configHash) fail("ADULT_CONFIG_MISMATCH"); if (result.subjectId !== expected.profileId || result.allocationId !== expected.allocationId || result.countryCode !== expected.countryCode || result.operation !== expected.operation) fail("ADULT_BINDING_MISMATCH");
  if (![result.ageVerified, result.identityVerified, result.consentVerified, result.territoryAllowed, result.countryAllowed, result.legalMemoApproved, result.providerApproved, result.taxReportingReady, result.publicationAllowed].every((v) => v === true)) fail("ADULT_GATE_DENIED");
  if (verifier.verifyAdult(deepFreeze(result)) !== true) fail("ADULT_SIGNATURE_INVALID"); return result;
}

export interface SupportAllocation { allocationId: string; epochId: string; kind: SupportKind; grossMicros: bigint; deductionsMicros: bigint; frozenMicros: bigint; reversedMicros: bigint; netMicros: bigint; creatorMicros: bigint; platformMicros: bigint; safetyReserveMicros: bigint; infrastructureMicros: bigint; configHash: string; contractVersion: string; effectiveAt: string }
export function allocateSupport(kindInput: unknown, grossInput: unknown, deductionInput: unknown, allocationIdInput: unknown, contextInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): SupportAllocation {
  const kind = exactString(kindInput, ["CORE_TIP", "CORE_SUBSCRIPTION", "PRIVE"], "SUPPORT_KIND_INVALID"); const gross = bigint(grossInput, "GROSS_INVALID"); const allocationId = id(allocationIdInput, "ALLOCATION_ID_INVALID");
  if (kind === "PRIVE" && (contextInput === null || contextInput === undefined)) fail("ADULT_CAPABILITY_REQUIRED");
  const contextKeys = kind === "PRIVE" ? ["nowIso", "epochId", "profileId", "countryCode", "operation", "adultCapability", "verifier"] : ["nowIso", "epochId"];
  const context = plain(contextInput, contextKeys, "EXECUTION_CONTEXT_INVALID"); const now = iso(context.nowIso, "EXECUTION_CONTEXT_INVALID"), epochId = id(context.epochId, "EXECUTION_CONTEXT_INVALID"); const config = validateEconomicConfig(configInput, now); const lines = parseDeductions(deductionInput);
  if (kind === "PRIVE") { const profileId = id(context.profileId, "ADULT_CAPABILITY_INVALID"), countryCode = country(context.countryCode, "ADULT_CAPABILITY_INVALID"), operation = exactString(context.operation, ["QUOTE", "SETTLEMENT"], "ADULT_CAPABILITY_INVALID"); const verifier = context.verifier as EconomicAuthorityVerifier; if (!verifier || typeof verifier.verifyAdult !== "function") fail("ADULT_CAPABILITY_INVALID"); parseAdult(context.adultCapability, { profileId, allocationId, countryCode, operation, configHash: config.configHash }, now, verifier); }
  let deductions = 0n, frozen = 0n, reversed = 0n; for (const line of lines) { if (line.status === "REVERSED") reversed += line.amountMicros; else { deductions += line.amountMicros; if (line.status === "FROZEN") frozen += line.amountMicros; } }
  if (deductions > gross) fail("DEDUCTIONS_EXCEED_GROSS"); const net = gross - deductions; const split = config.splits[kind];
  const creator = net * BigInt(split.creator) / BPS; const platform = net * BigInt(split.platform) / BPS; const safety = net * BigInt(split.safetyReserve) / BPS; const infrastructure = net - creator - platform - safety;
  return deepFreeze({ allocationId, epochId, kind, grossMicros: gross, deductionsMicros: deductions, frozenMicros: frozen, reversedMicros: reversed, netMicros: net, creatorMicros: creator, platformMicros: platform, safetyReserveMicros: safety, infrastructureMicros: infrastructure, configHash: config.configHash, contractVersion: config.contractVersion, effectiveAt: config.effectiveAt }) as SupportAllocation;
}

export function creatorPoolBudget(revenueInput: unknown, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): bigint { const revenue = bigint(revenueInput, "REVENUE_INVALID"); const now = iso(nowInput, "CONFIG_TIME_INVALID"); const c = validateEconomicConfig(configInput, now); const funded = revenue * BigInt(c.creatorPoolRevenueBps) / BPS; return funded < c.creatorEpochCapMicros ? funded : c.creatorEpochCapMicros; }
export function nodePoolBudget(revenueInput: unknown, verifiedCostInput: unknown, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): bigint { const revenue = bigint(revenueInput, "REVENUE_INVALID"); const cost = bigint(verifiedCostInput, "NODE_COST_INVALID"); const now = iso(nowInput, "CONFIG_TIME_INVALID"); const c = validateEconomicConfig(configInput, now); const funded = revenue * BigInt(c.nodePoolRevenueBps) / BPS; return [funded, cost, c.nodeEpochCapMicros].reduce((a, b) => a < b ? a : b); }

const CREATOR_KEYS = ["creatorId", "actorClass", "qeu", "eligible", "attestation", "qualificationReceiptHash"] as const;
export interface CreatorCandidate { creatorId: string; actorClass: ActorClass; qeu: bigint; eligible: boolean; attestation: PrincipalAttestation; qualificationReceiptHash: string }
export interface PoolClaim { beneficiaryId: string; principalId: string; riskClusterId: string; amountMicros: bigint }
export interface PoolAllocation { poolMicros: bigint; claims: PoolClaim[]; remainderMicros: bigint; configHash: string; contractVersion: string; effectiveAt: string; epochId: string }
export function allocateCreatorPool(poolInput: unknown, candidatesInput: unknown, epochInput: unknown, verifier: EconomicAuthorityVerifier, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): PoolAllocation {
  const pool = bigint(poolInput, "POOL_INVALID"); const epoch = id(epochInput, "EPOCH_INVALID"); const now = iso(nowInput, "ATTESTATION_TIME_INVALID"); const config = validateEconomicConfig(configInput, now); const seen = new Set<string>(); const parsed: CreatorCandidate[] = [];
  for (const item of array(candidatesInput, "CREATORS_INVALID")) { const o = plain(item, CREATOR_KEYS, "CREATOR_SHAPE_INVALID"); const creatorId = id(o.creatorId, "CREATOR_ID_INVALID"); if (seen.has(creatorId)) fail("CREATOR_DUPLICATE"); seen.add(creatorId); const row: CreatorCandidate = { creatorId, actorClass: exactString(o.actorClass, ["HUMAN", "SYSTEM_TEST", "AGENT"], "ACTOR_CLASS_INVALID"), qeu: bigint(o.qeu, "QEU_INVALID"), eligible: bool(o.eligible, "ELIGIBILITY_INVALID"), attestation: parseAttestation(o.attestation, now), qualificationReceiptHash: hash(o.qualificationReceiptHash, "QUALIFICATION_RECEIPT_INVALID") }; if (row.attestation.subjectId !== creatorId || row.attestation.epochId !== epoch) fail("ATTESTATION_BINDING_INVALID"); parsed.push(row); }
  const valid = parsed.filter((r) => r.actorClass === "HUMAN" && r.eligible === true && r.qeu > 0n && verifier.verifyCreator(r.attestation, epoch, config.configHash, r.qualificationReceiptHash) === true); const totalQeu = valid.reduce((s, r) => s + r.qeu, 0n); const principalPaid = new Map<string, bigint>(); const clusterPaid = new Map<string, bigint>(); const claims: PoolClaim[] = []; const cap = pool * BigInt(config.creatorClaimCapBps) / BPS;
  for (const row of valid.sort((a, b) => a.creatorId.localeCompare(b.creatorId))) { const requested = totalQeu === 0n ? 0n : pool * row.qeu / totalQeu; const pPaid = principalPaid.get(row.attestation.principalId) ?? 0n; const cPaid = clusterPaid.get(row.attestation.riskClusterId) ?? 0n; const amount = [requested, cap - (pPaid < cap ? pPaid : cap), cap - (cPaid < cap ? cPaid : cap)].reduce((a, b) => a < b ? a : b); if (amount > 0n) { claims.push({ beneficiaryId: row.creatorId, principalId: row.attestation.principalId, riskClusterId: row.attestation.riskClusterId, amountMicros: amount }); principalPaid.set(row.attestation.principalId, pPaid + amount); clusterPaid.set(row.attestation.riskClusterId, cPaid + amount); } }
  const paid = claims.reduce((s, r) => s + r.amountMicros, 0n); return deepFreeze({ poolMicros: pool, claims, remainderMicros: pool - paid, configHash: config.configHash, contractVersion: config.contractVersion, effectiveAt: config.effectiveAt, epochId: epoch }) as PoolAllocation;
}

const CONTRIBUTION_KEYS = ["creatorPrincipalId", "rawQeu", "actorClass", "eligible", "attestation"] as const;
const ENGAGEMENT_ATTESTATION_KEYS = ["schemaVersion", "supporterPrincipalId", "deviceClusterId", "walletClusterId", "epochId", "issuedAt", "expiresAt", "issuerKeyId", "proofHash", "signature"] as const;
export function qualifyEngagement(input: unknown, epochInput: unknown, verifier: EconomicAuthorityVerifier, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): Readonly<{ acceptedQeu: bigint; rejectedQeu: bigint }> {
  const epoch = id(epochInput, "EPOCH_INVALID"), now = iso(nowInput, "ATTESTATION_TIME_INVALID"), config = validateEconomicConfig(configInput, now);
  const supporter = new Map<string, bigint>(), device = new Map<string, bigint>(), wallet = new Map<string, bigint>(); let accepted = 0n, rejected = 0n;
  for (const item of array(input, "CONTRIBUTIONS_INVALID")) { const o = plain(item, CONTRIBUTION_KEYS, "CONTRIBUTION_SHAPE_INVALID"); const creator = id(o.creatorPrincipalId, "CONTRIBUTION_ID_INVALID"); const q = bigint(o.rawQeu, "QEU_INVALID"); const actor = exactString(o.actorClass, ["HUMAN", "SYSTEM_TEST", "AGENT"], "ACTOR_CLASS_INVALID"); const eligible = bool(o.eligible, "ELIGIBILITY_INVALID"); const a = plain(o.attestation, ENGAGEMENT_ATTESTATION_KEYS, "CONTRIBUTION_ATTESTATION_INVALID"); if (a.schemaVersion !== 1) fail("CONTRIBUTION_ATTESTATION_INVALID"); const signed: EngagementAttestation = { schemaVersion: 1, supporterPrincipalId: id(a.supporterPrincipalId, "CONTRIBUTION_ID_INVALID"), deviceClusterId: id(a.deviceClusterId, "CONTRIBUTION_ID_INVALID"), walletClusterId: id(a.walletClusterId, "CONTRIBUTION_ID_INVALID"), epochId: id(a.epochId, "CONTRIBUTION_ID_INVALID"), issuedAt: iso(a.issuedAt, "CONTRIBUTION_ATTESTATION_INVALID"), expiresAt: iso(a.expiresAt, "CONTRIBUTION_ATTESTATION_INVALID"), issuerKeyId: id(a.issuerKeyId, "CONTRIBUTION_ID_INVALID"), proofHash: hash(a.proofHash, "QUALIFICATION_RECEIPT_INVALID"), signature: hash(a.signature, "CONTRIBUTION_ATTESTATION_INVALID") }; active(signed.issuedAt, signed.expiresAt, now, "CONTRIBUTION_ATTESTATION_EXPIRED"); if (signed.epochId !== epoch) fail("ATTESTATION_BINDING_INVALID"); if (actor !== "HUMAN" || !eligible || verifier.verifyContribution(deepFreeze(signed), creator, config.configHash) !== true) { rejected += q; continue; } const s = signed.supporterPrincipalId, d = signed.deviceClusterId, w = signed.walletClusterId; const room = [100n - (supporter.get(s) ?? 0n), 250n - (device.get(d) ?? 0n), 200n - (wallet.get(w) ?? 0n)].reduce((x, y) => x < y ? x : y); const take = q < (room > 0n ? room : 0n) ? q : (room > 0n ? room : 0n); supporter.set(s, (supporter.get(s) ?? 0n) + take); device.set(d, (device.get(d) ?? 0n) + take); wallet.set(w, (wallet.get(w) ?? 0n) + take); accepted += take; rejected += q - take; }
  return deepFreeze({ acceptedQeu: accepted, rejectedQeu: rejected });
}

const NODE_KEYS = ["nodeId", "verifiedUnitValueMicros", "availabilityBps", "qualityBps", "diversityBps", "receiptValid", "attestation", "serviceReceiptHash"] as const;
export function allocateNodePool(poolInput: unknown, candidatesInput: unknown, epochInput: unknown, verifier: EconomicAuthorityVerifier, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): PoolAllocation {
  const pool = bigint(poolInput, "POOL_INVALID"); const epoch = id(epochInput, "EPOCH_INVALID"); const now = iso(nowInput, "ATTESTATION_TIME_INVALID"); const config = validateEconomicConfig(configInput, now); const seen = new Set<string>(); const rows: Array<{ nodeId: string; value: bigint; receiptValid: boolean; attestation: PrincipalAttestation; serviceReceiptHash: string }> = [];
  for (const item of array(candidatesInput, "NODES_INVALID")) { const o = plain(item, NODE_KEYS, "NODE_SHAPE_INVALID"); const nodeId = id(o.nodeId, "NODE_ID_INVALID"); if (seen.has(nodeId)) fail("NODE_DUPLICATE"); seen.add(nodeId); const attestation = parseAttestation(o.attestation, now); if (attestation.subjectId !== nodeId || attestation.epochId !== epoch) fail("ATTESTATION_BINDING_INVALID"); const base = bigint(o.verifiedUnitValueMicros, "NODE_VALUE_INVALID"); const a = integer(o.availabilityBps, 0, 10000, "NODE_FACTOR_INVALID"), q = integer(o.qualityBps, 0, 10000, "NODE_FACTOR_INVALID"), d = integer(o.diversityBps, 0, 10000, "NODE_FACTOR_INVALID"); rows.push({ nodeId, value: base * BigInt(a) * BigInt(q) * BigInt(d) / (BPS * BPS * BPS), receiptValid: bool(o.receiptValid, "RECEIPT_VALIDITY_INVALID"), attestation, serviceReceiptHash: hash(o.serviceReceiptHash, "SERVICE_RECEIPT_INVALID") }); }
  const valid = rows.filter((r) => r.receiptValid === true && r.value > 0n && verifier.verifyNode(r.attestation, epoch, config.configHash, r.serviceReceiptHash) === true); const total = valid.reduce((s, r) => s + r.value, 0n); const cap = valid.length >= 8 ? pool * BigInt(config.nodeOwnerClusterCapBps) / BPS : pool; const principalPaid = new Map<string, bigint>(), clusterPaid = new Map<string, bigint>(); const claims: PoolClaim[] = [];
  for (const row of valid.sort((a, b) => a.nodeId.localeCompare(b.nodeId))) { const requested = total === 0n ? 0n : pool * row.value / total; const pp = principalPaid.get(row.attestation.principalId) ?? 0n, cp = clusterPaid.get(row.attestation.riskClusterId) ?? 0n; const amount = [requested, cap - (pp < cap ? pp : cap), cap - (cp < cap ? cp : cap)].reduce((a, b) => a < b ? a : b); if (amount > 0n) { claims.push({ beneficiaryId: row.nodeId, principalId: row.attestation.principalId, riskClusterId: row.attestation.riskClusterId, amountMicros: amount }); principalPaid.set(row.attestation.principalId, pp + amount); clusterPaid.set(row.attestation.riskClusterId, cp + amount); } }
  const paid = claims.reduce((s, r) => s + r.amountMicros, 0n); return deepFreeze({ poolMicros: pool, claims, remainderMicros: pool - paid, configHash: config.configHash, contractVersion: config.contractVersion, effectiveAt: config.effectiveAt, epochId: epoch }) as PoolAllocation;
}

const BUDGET_KEYS = ["schemaVersion", "epochId", "configHash", "eligibleNetRevenueMicros", "acquisitionBudgetMicros", "spentMicrosEur", "issuedAt", "expiresAt", "issuerKeyId", "signature"] as const;
const SPONSOR_KEYS = ["priority", "estimatedGasMicrosEur", "remainingUserQuota", "userPaysGas"] as const;
export function decideSponsorship(input: unknown, snapshotInput: unknown, verifier: EconomicAuthorityVerifier, nowInput: unknown, configInput: unknown = DEFAULT_ECONOMIC_CONFIG): SponsorshipDecision {
  const o = plain(input, SPONSOR_KEYS, "GAS_REQUEST_INVALID"); const priority = exactString(o.priority, ["LIKE", "COMMENT", "SUPPORT", "SAFETY", "FINANCIAL"], "GAS_PRIORITY_INVALID"); const estimated = bigint(o.estimatedGasMicrosEur, "GAS_ESTIMATE_INVALID"); const quota = integer(o.remainingUserQuota, 0, 1_000_000, "GAS_QUOTA_INVALID"); const userPays = bool(o.userPaysGas, "GAS_REQUEST_INVALID");
  const s = plain(snapshotInput, BUDGET_KEYS, "GAS_SNAPSHOT_INVALID"); if (s.schemaVersion !== 1) fail("GAS_SNAPSHOT_INVALID"); const snapshot: GasBudgetSnapshot = { schemaVersion: 1, epochId: id(s.epochId, "GAS_SNAPSHOT_INVALID"), configHash: hash(s.configHash, "GAS_SNAPSHOT_INVALID"), eligibleNetRevenueMicros: bigint(s.eligibleNetRevenueMicros, "GAS_SNAPSHOT_INVALID"), acquisitionBudgetMicros: bigint(s.acquisitionBudgetMicros, "GAS_SNAPSHOT_INVALID"), spentMicrosEur: bigint(s.spentMicrosEur, "GAS_SNAPSHOT_INVALID"), issuedAt: iso(s.issuedAt, "GAS_SNAPSHOT_INVALID"), expiresAt: iso(s.expiresAt, "GAS_SNAPSHOT_INVALID"), issuerKeyId: id(s.issuerKeyId, "GAS_SNAPSHOT_INVALID"), signature: hash(s.signature, "GAS_SNAPSHOT_INVALID") };
  const now = iso(nowInput, "GAS_SNAPSHOT_INVALID"); active(snapshot.issuedAt, snapshot.expiresAt, now, "GAS_SNAPSHOT_EXPIRED"); const config = validateEconomicConfig(configInput, now); if (snapshot.configHash !== config.configHash || verifier.verifyBudget(deepFreeze(snapshot)) !== true) fail("GAS_SNAPSHOT_UNTRUSTED");
  const target = snapshot.eligibleNetRevenueMicros === 0n ? snapshot.acquisitionBudgetMicros : snapshot.eligibleNetRevenueMicros * BigInt(config.sponsoredGasTargetBps) / BPS; const hard = snapshot.eligibleNetRevenueMicros === 0n ? snapshot.acquisitionBudgetMicros : snapshot.eligibleNetRevenueMicros * BigInt(config.sponsoredGasHardCapBps) / BPS; const high = priority === "SAFETY" || priority === "FINANCIAL"; const limit = high ? hard : target;
  if (estimated > 0n && snapshot.spentMicrosEur + estimated <= limit && (high || quota > 0)) return "SPONSORED"; return userPays ? "USER_PAYS_GAS" : "PENDING_SPONSORSHIP";
}

export function assertOrganicSignal(input: unknown): bigint { const o = plain(input, ["paidSupportMicros", "promoted", "actorClass", "qualifiedWeight"], "RANKING_SIGNAL_INVALID"); const paid = bigint(o.paidSupportMicros, "RANKING_SIGNAL_INVALID"); const promoted = bool(o.promoted, "RANKING_SIGNAL_INVALID"); const actor = exactString(o.actorClass, ["HUMAN", "SYSTEM_TEST", "AGENT"], "ACTOR_CLASS_INVALID"); const weight = bigint(o.qualifiedWeight, "RANKING_SIGNAL_INVALID"); return paid === 0n && !promoted && actor === "HUMAN" ? weight : 0n; }
export function closeTreasury(input: unknown): bigint { const o = plain(input, ["openingMicros", "realizedRevenueMicros", "confirmedPayoutsMicros", "variableCostsMicros", "addedReservesMicros"], "TREASURY_INPUT_INVALID"); const closing = bigint(o.openingMicros, "TREASURY_INPUT_INVALID") + bigint(o.realizedRevenueMicros, "TREASURY_INPUT_INVALID") - bigint(o.confirmedPayoutsMicros, "TREASURY_INPUT_INVALID") - bigint(o.variableCostsMicros, "TREASURY_INPUT_INVALID") - bigint(o.addedReservesMicros, "TREASURY_INPUT_INVALID"); if (closing < 0n) fail("TREASURY_NEGATIVE"); return closing; }
export function assertConservation(value: SupportAllocation | PoolAllocation): boolean { if ("grossMicros" in value) return value.netMicros === value.creatorMicros + value.platformMicros + value.safetyReserveMicros + value.infrastructureMicros && value.grossMicros === value.netMicros + value.deductionsMicros; return value.poolMicros === value.claims.reduce((s, r) => s + r.amountMicros, 0n) + value.remainderMicros; }

type ClaimState = "RESERVED" | "PARTIAL_FROZEN" | "PAID" | "REVERSED";
interface Claim { claimId: string; allocationId: string; epochId: string; principalId: string; amountMicros: bigint; frozenMicros: bigint; paidMicros: bigint; reversedMicros: bigint; state: ClaimState }
export interface ClaimConsumptionSnapshot { schemaVersion: 1; consumedKeys: string[] }
export class InMemoryAtomicClaimStore {
  private readonly consumed = new Set<string>();
  consume(keyInput: unknown): boolean { const key = id(keyInput, "CLAIM_KEY_INVALID"); if (this.consumed.has(key)) return false; this.consumed.add(key); return true; }
  has(keyInput: unknown): boolean { return this.consumed.has(id(keyInput, "CLAIM_KEY_INVALID")); }
  snapshot(): Readonly<ClaimConsumptionSnapshot> { return deepFreeze({ schemaVersion: 1 as const, consumedKeys: [...this.consumed].sort() }); }
  static restore(input: unknown): InMemoryAtomicClaimStore { const o = plain(input, ["schemaVersion", "consumedKeys"], "CLAIM_STORE_SNAPSHOT_INVALID"); if (o.schemaVersion !== 1) fail("CLAIM_STORE_SNAPSHOT_INVALID"); const store = new InMemoryAtomicClaimStore(); for (const item of array(o.consumedKeys, "CLAIM_STORE_SNAPSHOT_INVALID")) if (!store.consume(item)) fail("CLAIM_STORE_SNAPSHOT_INVALID"); return store; }
}
export interface LedgerSnapshot { schemaVersion: 1; fundedPoolMicros: bigint; availableMicros: bigint; claims: Claim[]; consumption: ClaimConsumptionSnapshot }
function claimKey(allocationId: string, epochId: string, principalId: string): string { return `KEY:${allocationId}:${epochId}:${principalId}`; }
export class SettlementClaimLedger {
  private readonly claims = new Map<string, Claim>(); private available: bigint;
  constructor(private readonly funded: bigint, private readonly store: InMemoryAtomicClaimStore = new InMemoryAtomicClaimStore()) { this.available = bigint(funded, "LEDGER_FUNDING_INVALID"); }
  static restore(input: unknown, sharedStore?: InMemoryAtomicClaimStore): SettlementClaimLedger { const o = plain(input, ["schemaVersion", "fundedPoolMicros", "availableMicros", "claims", "consumption"], "LEDGER_SNAPSHOT_INVALID"); if (o.schemaVersion !== 1) fail("LEDGER_SNAPSHOT_INVALID"); const persisted = InMemoryAtomicClaimStore.restore(o.consumption); const store = sharedStore ?? persisted; const ledger = new SettlementClaimLedger(bigint(o.fundedPoolMicros, "LEDGER_SNAPSHOT_INVALID"), store); ledger.available = bigint(o.availableMicros, "LEDGER_SNAPSHOT_INVALID"); for (const item of array(o.claims, "LEDGER_SNAPSHOT_INVALID")) { const c = plain(item, ["claimId", "allocationId", "epochId", "principalId", "amountMicros", "frozenMicros", "paidMicros", "reversedMicros", "state"], "LEDGER_SNAPSHOT_INVALID"); const claim: Claim = { claimId: id(c.claimId, "LEDGER_SNAPSHOT_INVALID"), allocationId: id(c.allocationId, "LEDGER_SNAPSHOT_INVALID"), epochId: id(c.epochId, "LEDGER_SNAPSHOT_INVALID"), principalId: id(c.principalId, "LEDGER_SNAPSHOT_INVALID"), amountMicros: bigint(c.amountMicros, "LEDGER_SNAPSHOT_INVALID"), frozenMicros: bigint(c.frozenMicros, "LEDGER_SNAPSHOT_INVALID"), paidMicros: bigint(c.paidMicros, "LEDGER_SNAPSHOT_INVALID"), reversedMicros: bigint(c.reversedMicros, "LEDGER_SNAPSHOT_INVALID"), state: exactString(c.state, ["RESERVED", "PARTIAL_FROZEN", "PAID", "REVERSED"], "LEDGER_SNAPSHOT_INVALID") }; const key = claimKey(claim.allocationId, claim.epochId, claim.principalId); if (claim.amountMicros === 0n || ledger.claims.has(claim.claimId) || !persisted.has(key) || (sharedStore !== undefined && !sharedStore.has(key)) || claim.frozenMicros + claim.paidMicros + claim.reversedMicros > claim.amountMicros || (claim.state === "RESERVED" && (claim.frozenMicros !== 0n || claim.paidMicros !== 0n || claim.reversedMicros !== 0n)) || (claim.state === "PARTIAL_FROZEN" && claim.frozenMicros === 0n) || (claim.state === "PAID" && (claim.frozenMicros !== 0n || claim.paidMicros + claim.reversedMicros !== claim.amountMicros)) || (claim.state === "REVERSED" && (claim.frozenMicros !== 0n || claim.reversedMicros === 0n || claim.paidMicros + claim.reversedMicros !== claim.amountMicros))) fail("LEDGER_SNAPSHOT_INVALID"); ledger.claims.set(claim.claimId, claim); } ledger.assertInvariant(); return ledger; }
  claim(allocationId: unknown, epochId: unknown, principalId: unknown, amountInput: unknown, claimIdInput: unknown): Readonly<Claim> { const allocation = id(allocationId, "CLAIM_INPUT_INVALID"), epoch = id(epochId, "CLAIM_INPUT_INVALID"), principal = id(principalId, "CLAIM_INPUT_INVALID"), claimId = id(claimIdInput, "CLAIM_INPUT_INVALID"), amount = bigint(amountInput, "CLAIM_INPUT_INVALID"); const key = claimKey(allocation, epoch, principal); if (this.claims.has(claimId) || this.store.has(key)) fail("CLAIM_REPLAY"); if (amount === 0n || amount > this.available) fail("RESERVE_INSUFFICIENT"); if (!this.store.consume(key)) fail("CLAIM_REPLAY"); const claim: Claim = { claimId, allocationId: allocation, epochId: epoch, principalId: principal, amountMicros: amount, frozenMicros: 0n, paidMicros: 0n, reversedMicros: 0n, state: "RESERVED" }; this.available -= amount; this.claims.set(claimId, claim); this.assertInvariant(); return deepFreeze({ ...claim }); }
  freeze(claimIdInput: unknown, amountInput: unknown): Readonly<Claim> { const c = this.getOpen(claimIdInput); const amount = bigint(amountInput, "CLAIM_INPUT_INVALID"); if (amount === 0n || amount > c.amountMicros - c.frozenMicros - c.paidMicros - c.reversedMicros) fail("FREEZE_INVALID"); c.frozenMicros += amount; c.state = "PARTIAL_FROZEN"; this.assertInvariant(); return deepFreeze({ ...c }); }
  settle(claimIdInput: unknown): Readonly<Claim> { const c = this.getOpen(claimIdInput); const payable = c.amountMicros - c.frozenMicros - c.paidMicros - c.reversedMicros; c.paidMicros += payable; c.state = c.frozenMicros > 0n ? "PARTIAL_FROZEN" : "PAID"; this.assertInvariant(); return deepFreeze({ ...c }); }
  releaseFrozen(claimIdInput: unknown): Readonly<Claim> { const c = this.getOpen(claimIdInput); if (c.frozenMicros === 0n) fail("NO_FROZEN_AMOUNT"); c.paidMicros += c.frozenMicros; c.frozenMicros = 0n; c.state = c.paidMicros + c.reversedMicros === c.amountMicros ? "PAID" : "RESERVED"; this.assertInvariant(); return deepFreeze({ ...c }); }
  reverseFrozen(claimIdInput: unknown): Readonly<Claim> { const c = this.getOpen(claimIdInput); if (c.frozenMicros === 0n) fail("NO_FROZEN_AMOUNT"); c.reversedMicros += c.frozenMicros; c.frozenMicros = 0n; c.state = c.paidMicros + c.reversedMicros === c.amountMicros ? "REVERSED" : "RESERVED"; this.assertInvariant(); return deepFreeze({ ...c }); }
  snapshot(): Readonly<LedgerSnapshot> { return deepFreeze({ schemaVersion: 1 as const, fundedPoolMicros: this.funded, availableMicros: this.available, claims: [...this.claims.values()].sort((a, b) => a.claimId.localeCompare(b.claimId)).map((c) => ({ ...c })), consumption: this.store.snapshot() }); }
  conservation(): Readonly<{ fundedMicros: bigint; availableMicros: bigint; outstandingMicros: bigint; paidMicros: bigint; reversedMicros: bigint }> { let outstanding = 0n, paid = 0n, reversed = 0n; for (const c of this.claims.values()) { outstanding += c.amountMicros - c.paidMicros - c.reversedMicros; paid += c.paidMicros; reversed += c.reversedMicros; } return { fundedMicros: this.funded, availableMicros: this.available, outstandingMicros: outstanding, paidMicros: paid, reversedMicros: reversed }; }
  private getOpen(input: unknown): Claim { const key = id(input, "CLAIM_INPUT_INVALID"); const c = this.claims.get(key); if (!c) fail("CLAIM_NOT_FOUND"); if (c.state === "PAID" || c.state === "REVERSED") fail("CLAIM_ALREADY_FINAL"); return c; }
  private assertInvariant(): void { const c = this.conservation(); if (c.fundedMicros !== c.availableMicros + c.outstandingMicros + c.paidMicros + c.reversedMicros) fail("LEDGER_INVARIANT"); for (const row of this.claims.values()) if (row.frozenMicros + row.paidMicros + row.reversedMicros > row.amountMicros) fail("LEDGER_INVARIANT"); }
}
