export type TrustSurface = "SOCIAL" | "WORK" | "DATING" | "MARKET" | "TRAVEL" | "LIVE" | "KIDS";
export type ContentKind = "POST" | "CLIP" | "IMAGE" | "AUDIO" | "LIVE" | "PROFILE" | "LISTING" | "COMMENT";
export type SpeechClass = "FACTUAL_CLAIM" | "OPINION" | "SATIRE" | "PREDICTION" | "ADVERTISEMENT" | "MIXED";
export type ProvenanceStatus = "C2PA_VERIFIED" | "CREATOR_SIGNED" | "UNKNOWN" | "INVALID";
export type AiStatus = "DECLARED" | "NONE_DETECTED" | "LIKELY" | "UNKNOWN";
export type EvidenceStatus = "SUPPORTED" | "DISPUTED" | "INSUFFICIENT" | "NOT_APPLICABLE";
export type SafetySeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PoliticalClass = "NONE" | "ORGANIC_POLITICAL" | "PAID_POLITICAL";
export type TrustOutcome = "PUBLISH" | "PUBLISH_LABEL" | "LIMIT_DISTRIBUTION" | "TEMPORARY_HOLD" | "BLOCK_IMMUTABLE";
export type TrustRole = "PRIMARY_TRUST" | "IMMUTABLE_EVIDENCE" | "MODEL_REGISTRY" | "GOVERNANCE_ROLLBACK";
export type RollbackDomain = "POLICY" | "MODEL_SET";

export class TrustLensError extends Error {
  constructor(readonly code: string) { super(code); this.name = "TrustLensError"; }
}

export interface ContentEnvelope {
  schemaVersion: 1; contentId: string; contentCommitment: string; activeProfileCommitment: string;
  surface: TrustSurface; kind: ContentKind; country: string; generation: number; createdAt: string;
  actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface DetectorVote { detectorId: string; severity: SafetySeverity }
export interface TrustRootDescriptor {
  role: TrustRole; keyId: string; publicKeyFingerprint: string; authorityLineage: string;
  administrativeDomain: string; activatedAt: string; expiresAt: string; revoked: false;
}
export interface TrustRootRegistry {
  schemaVersion: 1; registryId: string; version: number; roots: readonly TrustRootDescriptor[];
  activatedAt: string; expiresAt: string; actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface ModelSetManifest {
  schemaVersion: 1; manifestId: string; purpose: "PUBLIC_CONTENT_TRUST"; surface: TrustSurface; country: string;
  version: number; modelSetCommitment: string; effectiveAt: string; expiresAt: string; revoked: false;
  trustRegistryId: string; trustRegistryVersion: number; authorityFingerprint: string;
  actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface GovernanceRollbackAuthorization {
  schemaVersion: 1; authorizationId: string; domain: RollbackDomain; scopeKey: string;
  fromId: string; fromVersion: number; fromCommitment: string; toId: string; toVersion: number; toCommitment: string;
  issuedAt: string; expiresAt: string; nonce: number; trustRegistryId: string; trustRegistryVersion: number;
  authorityFingerprint: string; actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface ImmutableEvidenceAttestation {
  schemaVersion: 1; attestationId: string; contentCommitment: string; categoryCode: string;
  evidenceSetCommitment: string; observedAt: string; expiresAt: string; actorClass: "SYSTEM_TEST";
  trustRegistryId: string; trustRegistryVersion: number; authorityFingerprint: string;
  issuerKeyId: string; attestationHash: string; signature: string;
}
export interface SignalBundle {
  schemaVersion: 1; signalId: string; contentCommitment: string; surface: TrustSurface; country: string;
  modelSetManifest: ModelSetManifest; assessedAt: string; expiresAt: string; speechClass: SpeechClass;
  provenance: ProvenanceStatus;
  ai: { status: AiStatus; lowerBps: number; upperBps: number; calibrated: boolean };
  evidence: { status: EvidenceStatus; claimCount: number };
  safetyVotes: readonly DetectorVote[];
  legality: { match: "NONE" | "IMMUTABLE_ILLEGAL_HASH"; categoryCode: string | null; evidenceAttestationHash: string | null };
  political: { classification: PoliticalClass; transparencyComplete: boolean; sponsorCommitment: string | null; electionCommitment: string | null };
  actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface TrustPolicy {
  schemaVersion: 1; policyId: string; country: string; version: number; effectiveAt: string; expiresAt: string;
  immutableIllegalCategories: readonly string[]; mediumVoteThreshold: 2; highVoteThreshold: 2;
  ordinaryHumanPreApprovalRequired: false; probabilisticFinalTakedownAllowed: false;
  politicalOpinionInferenceAllowed: false; sensitivePoliticalTargetingAllowed: false;
  statementTemplateVersion: number; appealRoute: string; actorClass: "SYSTEM_TEST"; issuerKeyId: string; signature: string;
}
export interface TrustDecisionReceipt {
  schemaVersion: 1; decisionId: string; contentId: string; contentCommitment: string; activeProfileCommitment: string;
  surface: TrustSurface; country: string; generation: number; policyId: string; policyVersion: number;
  policyCommitment: string; modelSetManifestId: string; modelSetVersion: number; modelSetCommitment: string;
  signalBundleCommitment: string; trustRegistryId: string; trustRegistryVersion: number;
  evidenceAuthorityFingerprint: string | null; rollbackAuthorizationCommitments: readonly string[]; outcome: TrustOutcome;
  labels: readonly string[]; reasonCodes: readonly string[]; aiLikelihoodRangeBps: readonly [number, number] | null;
  decisionAt: string; expiresAt: string; statementTemplateVersion: number; appealRoute: string;
  automated: true; humanPreApprovalRequired: false; actorClass: "SYSTEM_TEST"; ordinal: number;
  previousReceiptHash: string; receiptHash: string; issuerKeyId: string; signature: string;
}
export interface TrustDecisionEvent { ordinal: number; content: ContentEnvelope; signals: SignalBundle; evidence: ImmutableEvidenceAttestation | null; policy: TrustPolicy; rollbackAuthorizations: readonly GovernanceRollbackAuthorization[]; receipt: TrustDecisionReceipt; eventHash: string }
export interface TrustLedgerSnapshot { schemaVersion: 1; nextOrdinal: number; events: readonly TrustDecisionEvent[]; receiptHead: string; trustRegistry: TrustRootRegistry; checkpointHash: string; issuerKeyId: string; signature: string }

const HEX = /^[a-f0-9]{64}$/;
const ID = /^[A-Z0-9][A-Z0-9:._-]{2,127}$/;
const COUNTRY = /^[A-Z]{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ZERO = "0".repeat(64);
const SURFACES: readonly TrustSurface[] = ["SOCIAL", "WORK", "DATING", "MARKET", "TRAVEL", "LIVE", "KIDS"];
const KINDS: readonly ContentKind[] = ["POST", "CLIP", "IMAGE", "AUDIO", "LIVE", "PROFILE", "LISTING", "COMMENT"];
const SPEECH: readonly SpeechClass[] = ["FACTUAL_CLAIM", "OPINION", "SATIRE", "PREDICTION", "ADVERTISEMENT", "MIXED"];
const SEVERITIES: readonly SafetySeverity[] = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const ROLES: readonly TrustRole[] = ["PRIMARY_TRUST", "IMMUTABLE_EVIDENCE", "MODEL_REGISTRY", "GOVERNANCE_ROLLBACK"];
const ROLLBACK_DOMAINS: readonly RollbackDomain[] = ["POLICY", "MODEL_SET"];
const CONTENT_KEYS = ["schemaVersion", "contentId", "contentCommitment", "activeProfileCommitment", "surface", "kind", "country", "generation", "createdAt", "actorClass", "issuerKeyId", "signature"] as const;
const ROOT_KEYS = ["role", "keyId", "publicKeyFingerprint", "authorityLineage", "administrativeDomain", "activatedAt", "expiresAt", "revoked"] as const;
const REGISTRY_KEYS = ["schemaVersion", "registryId", "version", "roots", "activatedAt", "expiresAt", "actorClass", "issuerKeyId", "signature"] as const;
const MODEL_MANIFEST_KEYS = ["schemaVersion", "manifestId", "purpose", "surface", "country", "version", "modelSetCommitment", "effectiveAt", "expiresAt", "revoked", "trustRegistryId", "trustRegistryVersion", "authorityFingerprint", "actorClass", "issuerKeyId", "signature"] as const;
const ROLLBACK_KEYS = ["schemaVersion", "authorizationId", "domain", "scopeKey", "fromId", "fromVersion", "fromCommitment", "toId", "toVersion", "toCommitment", "issuedAt", "expiresAt", "nonce", "trustRegistryId", "trustRegistryVersion", "authorityFingerprint", "actorClass", "issuerKeyId", "signature"] as const;
const SIGNAL_KEYS = ["schemaVersion", "signalId", "contentCommitment", "surface", "country", "modelSetManifest", "assessedAt", "expiresAt", "speechClass", "provenance", "ai", "evidence", "safetyVotes", "legality", "political", "actorClass", "issuerKeyId", "signature"] as const;
const EVIDENCE_ATTESTATION_KEYS = ["schemaVersion", "attestationId", "contentCommitment", "categoryCode", "evidenceSetCommitment", "observedAt", "expiresAt", "actorClass", "trustRegistryId", "trustRegistryVersion", "authorityFingerprint", "issuerKeyId", "attestationHash", "signature"] as const;
const POLICY_KEYS = ["schemaVersion", "policyId", "country", "version", "effectiveAt", "expiresAt", "immutableIllegalCategories", "mediumVoteThreshold", "highVoteThreshold", "ordinaryHumanPreApprovalRequired", "probabilisticFinalTakedownAllowed", "politicalOpinionInferenceAllowed", "sensitivePoliticalTargetingAllowed", "statementTemplateVersion", "appealRoute", "actorClass", "issuerKeyId", "signature"] as const;
const RECEIPT_KEYS = ["schemaVersion", "decisionId", "contentId", "contentCommitment", "activeProfileCommitment", "surface", "country", "generation", "policyId", "policyVersion", "policyCommitment", "modelSetManifestId", "modelSetVersion", "modelSetCommitment", "signalBundleCommitment", "trustRegistryId", "trustRegistryVersion", "evidenceAuthorityFingerprint", "rollbackAuthorizationCommitments", "outcome", "labels", "reasonCodes", "aiLikelihoodRangeBps", "decisionAt", "expiresAt", "statementTemplateVersion", "appealRoute", "automated", "humanPreApprovalRequired", "actorClass", "ordinal", "previousReceiptHash", "receiptHash", "issuerKeyId", "signature"] as const;
const EVENT_KEYS = ["ordinal", "content", "signals", "evidence", "policy", "rollbackAuthorizations", "receipt", "eventHash"] as const;
const SNAPSHOT_KEYS = ["schemaVersion", "nextOrdinal", "events", "receiptHead", "trustRegistry", "checkpointHash", "issuerKeyId", "signature"] as const;

function fail(code: string): never { throw new TrustLensError(code); }
function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function capture(value: unknown, code: string): unknown { try { return JSON.parse(canonical(value)); } catch { fail(code); } }
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value as object).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value as Record<string, unknown>;
}
function exact<T extends string>(value: unknown, values: readonly T[], code: string): T { if (typeof value !== "string" || !values.includes(value as T)) fail(code); return value as T; }
function patterned(value: unknown, pattern: RegExp, code: string): string { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }
function integer(value: unknown, min: number, max: number, code: string): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(code); return value; }
function bool(value: unknown, code: string): boolean { if (typeof value !== "boolean") fail(code); return value; }
function iso(value: unknown, code: string): string { const result = patterned(value, ISO, code); if (!Number.isFinite(Date.parse(result))) fail(code); return result; }
function nullableHash(value: unknown, code: string): string | null { return value === null ? null : patterned(value, HEX, code); }
function frozen<T>(value: T): Readonly<T> { if (value && typeof value === "object") { for (const child of Object.values(value as object)) frozen(child); Object.freeze(value); } return value; }
async function sha256(value: string): Promise<string> { const subtle = globalThis.crypto?.subtle; if (!subtle) fail("TRUST_CRYPTO_UNAVAILABLE"); const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function sortedUnique(values: unknown, pattern: RegExp, code: string): readonly string[] { if (!Array.isArray(values)) fail(code); const result = values.map(value => patterned(value, pattern, code)).sort(); if (new Set(result).size !== result.length) fail(code); return frozen(result); }

function parseTrustRoot(input: unknown): Readonly<TrustRootDescriptor> {
  const value = plain(input, ROOT_KEYS, "TRUST_ROOT_INVALID"), activatedAt = iso(value.activatedAt, "TRUST_ROOT_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_ROOT_INVALID");
  if (value.revoked !== false || Date.parse(expiresAt) <= Date.parse(activatedAt)) fail("TRUST_ROOT_INVALID");
  return frozen({ role: exact(value.role, ROLES, "TRUST_ROOT_INVALID"), keyId: patterned(value.keyId, ID, "TRUST_ROOT_INVALID"), publicKeyFingerprint: patterned(value.publicKeyFingerprint, HEX, "TRUST_ROOT_INVALID"), authorityLineage: patterned(value.authorityLineage, ID, "TRUST_ROOT_INVALID"), administrativeDomain: patterned(value.administrativeDomain, ID, "TRUST_ROOT_INVALID"), activatedAt, expiresAt, revoked: false });
}
function parseTrustRegistry(input: unknown): Readonly<TrustRootRegistry> {
  const value = plain(input, REGISTRY_KEYS, "TRUST_REGISTRY_INVALID"), activatedAt = iso(value.activatedAt, "TRUST_REGISTRY_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_REGISTRY_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST" || !Array.isArray(value.roots) || value.roots.length !== ROLES.length || Date.parse(expiresAt) <= Date.parse(activatedAt)) fail("TRUST_REGISTRY_INVALID");
  const roots = value.roots.map(parseTrustRoot).sort((a, b) => a.role.localeCompare(b.role));
  if (new Set(roots.map(root => root.role)).size !== ROLES.length || new Set(roots.map(root => root.keyId)).size !== ROLES.length || new Set(roots.map(root => root.publicKeyFingerprint)).size !== ROLES.length || new Set(roots.map(root => root.authorityLineage)).size !== ROLES.length || new Set(roots.map(root => root.administrativeDomain)).size !== ROLES.length) fail("TRUST_AUTHORITY_SEPARATION_INVALID");
  return frozen({ schemaVersion: 1, registryId: patterned(value.registryId, ID, "TRUST_REGISTRY_INVALID"), version: integer(value.version, 1, 1_000_000, "TRUST_REGISTRY_INVALID"), roots: frozen(roots), activatedAt, expiresAt, actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_REGISTRY_INVALID"), signature: patterned(value.signature, HEX, "TRUST_REGISTRY_INVALID") });
}
function parseModelManifest(input: unknown): Readonly<ModelSetManifest> {
  const value = plain(input, MODEL_MANIFEST_KEYS, "TRUST_MODEL_MANIFEST_INVALID"), effectiveAt = iso(value.effectiveAt, "TRUST_MODEL_MANIFEST_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_MODEL_MANIFEST_INVALID");
  if (value.schemaVersion !== 1 || value.purpose !== "PUBLIC_CONTENT_TRUST" || value.revoked !== false || value.actorClass !== "SYSTEM_TEST" || Date.parse(expiresAt) <= Date.parse(effectiveAt)) fail("TRUST_MODEL_MANIFEST_INVALID");
  return frozen({ schemaVersion: 1, manifestId: patterned(value.manifestId, ID, "TRUST_MODEL_MANIFEST_INVALID"), purpose: "PUBLIC_CONTENT_TRUST", surface: exact(value.surface, SURFACES, "TRUST_MODEL_MANIFEST_INVALID"), country: patterned(value.country, COUNTRY, "TRUST_MODEL_MANIFEST_INVALID"), version: integer(value.version, 1, 1_000_000, "TRUST_MODEL_MANIFEST_INVALID"), modelSetCommitment: patterned(value.modelSetCommitment, HEX, "TRUST_MODEL_MANIFEST_INVALID"), effectiveAt, expiresAt, revoked: false, trustRegistryId: patterned(value.trustRegistryId, ID, "TRUST_MODEL_MANIFEST_INVALID"), trustRegistryVersion: integer(value.trustRegistryVersion, 1, 1_000_000, "TRUST_MODEL_MANIFEST_INVALID"), authorityFingerprint: patterned(value.authorityFingerprint, HEX, "TRUST_MODEL_MANIFEST_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_MODEL_MANIFEST_INVALID"), signature: patterned(value.signature, HEX, "TRUST_MODEL_MANIFEST_INVALID") });
}
function parseRollback(input: unknown): Readonly<GovernanceRollbackAuthorization> {
  const value = plain(input, ROLLBACK_KEYS, "TRUST_ROLLBACK_INVALID"), issuedAt = iso(value.issuedAt, "TRUST_ROLLBACK_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_ROLLBACK_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST" || Date.parse(expiresAt) <= Date.parse(issuedAt)) fail("TRUST_ROLLBACK_INVALID");
  return frozen({ schemaVersion: 1, authorizationId: patterned(value.authorizationId, ID, "TRUST_ROLLBACK_INVALID"), domain: exact(value.domain, ROLLBACK_DOMAINS, "TRUST_ROLLBACK_INVALID"), scopeKey: patterned(value.scopeKey, ID, "TRUST_ROLLBACK_INVALID"), fromId: patterned(value.fromId, ID, "TRUST_ROLLBACK_INVALID"), fromVersion: integer(value.fromVersion, 1, 1_000_000, "TRUST_ROLLBACK_INVALID"), fromCommitment: patterned(value.fromCommitment, HEX, "TRUST_ROLLBACK_INVALID"), toId: patterned(value.toId, ID, "TRUST_ROLLBACK_INVALID"), toVersion: integer(value.toVersion, 1, 1_000_000, "TRUST_ROLLBACK_INVALID"), toCommitment: patterned(value.toCommitment, HEX, "TRUST_ROLLBACK_INVALID"), issuedAt, expiresAt, nonce: integer(value.nonce, 1, Number.MAX_SAFE_INTEGER, "TRUST_ROLLBACK_INVALID"), trustRegistryId: patterned(value.trustRegistryId, ID, "TRUST_ROLLBACK_INVALID"), trustRegistryVersion: integer(value.trustRegistryVersion, 1, 1_000_000, "TRUST_ROLLBACK_INVALID"), authorityFingerprint: patterned(value.authorityFingerprint, HEX, "TRUST_ROLLBACK_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_ROLLBACK_INVALID"), signature: patterned(value.signature, HEX, "TRUST_ROLLBACK_INVALID") });
}

function parseContent(input: unknown): Readonly<ContentEnvelope> {
  const value = plain(input, CONTENT_KEYS, "TRUST_CONTENT_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST") fail("TRUST_CONTENT_INVALID");
  return frozen({ schemaVersion: 1, contentId: patterned(value.contentId, ID, "TRUST_CONTENT_INVALID"), contentCommitment: patterned(value.contentCommitment, HEX, "TRUST_CONTENT_INVALID"), activeProfileCommitment: patterned(value.activeProfileCommitment, HEX, "TRUST_CONTENT_INVALID"), surface: exact(value.surface, SURFACES, "TRUST_CONTENT_INVALID"), kind: exact(value.kind, KINDS, "TRUST_CONTENT_INVALID"), country: patterned(value.country, COUNTRY, "TRUST_CONTENT_INVALID"), generation: integer(value.generation, 1, 1_000_000, "TRUST_CONTENT_INVALID"), createdAt: iso(value.createdAt, "TRUST_CONTENT_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_CONTENT_INVALID"), signature: patterned(value.signature, HEX, "TRUST_CONTENT_INVALID") });
}
function parseSignals(input: unknown): Readonly<SignalBundle> {
  const value = plain(input, SIGNAL_KEYS, "TRUST_SIGNALS_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST") fail("TRUST_SIGNALS_INVALID");
  const ai = plain(value.ai, ["status", "lowerBps", "upperBps", "calibrated"], "TRUST_SIGNALS_INVALID");
  const evidence = plain(value.evidence, ["status", "claimCount"], "TRUST_SIGNALS_INVALID");
  const legality = plain(value.legality, ["match", "categoryCode", "evidenceAttestationHash"], "TRUST_SIGNALS_INVALID");
  const political = plain(value.political, ["classification", "transparencyComplete", "sponsorCommitment", "electionCommitment"], "TRUST_SIGNALS_INVALID");
  if (!Array.isArray(value.safetyVotes) || value.safetyVotes.length !== 3) fail("TRUST_SIGNALS_INVALID");
  const votes = value.safetyVotes.map(item => { const vote = plain(item, ["detectorId", "severity"], "TRUST_SIGNALS_INVALID"); return frozen({ detectorId: patterned(vote.detectorId, ID, "TRUST_SIGNALS_INVALID"), severity: exact(vote.severity, SEVERITIES, "TRUST_SIGNALS_INVALID") }); }).sort((a, b) => a.detectorId.localeCompare(b.detectorId));
  if (new Set(votes.map(vote => vote.detectorId)).size !== 3) fail("TRUST_SIGNALS_INVALID");
  const speechClass = exact(value.speechClass, SPEECH, "TRUST_SIGNALS_INVALID"), evidenceStatus = exact(evidence.status, ["SUPPORTED", "DISPUTED", "INSUFFICIENT", "NOT_APPLICABLE"], "TRUST_SIGNALS_INVALID");
  const claimCount = integer(evidence.claimCount, 0, 10_000, "TRUST_SIGNALS_INVALID");
  if (["OPINION", "SATIRE", "PREDICTION"].includes(speechClass) ? evidenceStatus !== "NOT_APPLICABLE" || claimCount !== 0 : evidenceStatus === "NOT_APPLICABLE") fail("TRUST_EVIDENCE_CLASS_INVALID");
  const aiStatus = exact(ai.status, ["DECLARED", "NONE_DETECTED", "LIKELY", "UNKNOWN"], "TRUST_SIGNALS_INVALID"), lowerBps = integer(ai.lowerBps, 0, 10_000, "TRUST_SIGNALS_INVALID"), upperBps = integer(ai.upperBps, 0, 10_000, "TRUST_SIGNALS_INVALID"), calibrated = bool(ai.calibrated, "TRUST_SIGNALS_INVALID");
  if (lowerBps > upperBps || (aiStatus === "LIKELY" && !calibrated) || (aiStatus !== "LIKELY" && (lowerBps !== 0 || upperBps !== 0))) fail("TRUST_AI_RANGE_INVALID");
  const legalMatch = exact(legality.match, ["NONE", "IMMUTABLE_ILLEGAL_HASH"], "TRUST_SIGNALS_INVALID"), categoryCode = legality.categoryCode === null ? null : patterned(legality.categoryCode, ID, "TRUST_SIGNALS_INVALID"), evidenceAttestationHash = nullableHash(legality.evidenceAttestationHash, "TRUST_SIGNALS_INVALID");
  if ((legalMatch === "NONE" && (categoryCode !== null || evidenceAttestationHash !== null)) || (legalMatch === "IMMUTABLE_ILLEGAL_HASH" && (categoryCode === null || evidenceAttestationHash === null))) fail("TRUST_LEGALITY_INVALID");
  const politicalClass = exact(political.classification, ["NONE", "ORGANIC_POLITICAL", "PAID_POLITICAL"], "TRUST_SIGNALS_INVALID"), transparencyComplete = bool(political.transparencyComplete, "TRUST_SIGNALS_INVALID"), sponsorCommitment = nullableHash(political.sponsorCommitment, "TRUST_SIGNALS_INVALID"), electionCommitment = nullableHash(political.electionCommitment, "TRUST_SIGNALS_INVALID");
  if (politicalClass !== "PAID_POLITICAL" && (sponsorCommitment !== null || electionCommitment !== null || !transparencyComplete)) fail("TRUST_POLITICAL_INVALID");
  if (politicalClass === "PAID_POLITICAL" && transparencyComplete !== (sponsorCommitment !== null && electionCommitment !== null)) fail("TRUST_POLITICAL_INVALID");
  const assessedAt = iso(value.assessedAt, "TRUST_SIGNALS_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_SIGNALS_INVALID"); if (Date.parse(expiresAt) <= Date.parse(assessedAt)) fail("TRUST_SIGNALS_INVALID");
  return frozen({ schemaVersion: 1, signalId: patterned(value.signalId, ID, "TRUST_SIGNALS_INVALID"), contentCommitment: patterned(value.contentCommitment, HEX, "TRUST_SIGNALS_INVALID"), surface: exact(value.surface, SURFACES, "TRUST_SIGNALS_INVALID"), country: patterned(value.country, COUNTRY, "TRUST_SIGNALS_INVALID"), modelSetManifest: parseModelManifest(value.modelSetManifest), assessedAt, expiresAt, speechClass, provenance: exact(value.provenance, ["C2PA_VERIFIED", "CREATOR_SIGNED", "UNKNOWN", "INVALID"], "TRUST_SIGNALS_INVALID"), ai: frozen({ status: aiStatus, lowerBps, upperBps, calibrated }), evidence: frozen({ status: evidenceStatus, claimCount }), safetyVotes: frozen(votes), legality: frozen({ match: legalMatch, categoryCode, evidenceAttestationHash }), political: frozen({ classification: politicalClass, transparencyComplete, sponsorCommitment, electionCommitment }), actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_SIGNALS_INVALID"), signature: patterned(value.signature, HEX, "TRUST_SIGNALS_INVALID") });
}
function parseEvidenceAttestation(input: unknown): Readonly<ImmutableEvidenceAttestation> {
  const value = plain(input, EVIDENCE_ATTESTATION_KEYS, "TRUST_EVIDENCE_ATTESTATION_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST") fail("TRUST_EVIDENCE_ATTESTATION_INVALID");
  const observedAt = iso(value.observedAt, "TRUST_EVIDENCE_ATTESTATION_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_EVIDENCE_ATTESTATION_INVALID"); if (Date.parse(expiresAt) <= Date.parse(observedAt)) fail("TRUST_EVIDENCE_ATTESTATION_INVALID");
  return frozen({ schemaVersion: 1, attestationId: patterned(value.attestationId, ID, "TRUST_EVIDENCE_ATTESTATION_INVALID"), contentCommitment: patterned(value.contentCommitment, HEX, "TRUST_EVIDENCE_ATTESTATION_INVALID"), categoryCode: patterned(value.categoryCode, ID, "TRUST_EVIDENCE_ATTESTATION_INVALID"), evidenceSetCommitment: patterned(value.evidenceSetCommitment, HEX, "TRUST_EVIDENCE_ATTESTATION_INVALID"), observedAt, expiresAt, actorClass: "SYSTEM_TEST", trustRegistryId: patterned(value.trustRegistryId, ID, "TRUST_EVIDENCE_ATTESTATION_INVALID"), trustRegistryVersion: integer(value.trustRegistryVersion, 1, 1_000_000, "TRUST_EVIDENCE_ATTESTATION_INVALID"), authorityFingerprint: patterned(value.authorityFingerprint, HEX, "TRUST_EVIDENCE_ATTESTATION_INVALID"), issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_EVIDENCE_ATTESTATION_INVALID"), attestationHash: patterned(value.attestationHash, HEX, "TRUST_EVIDENCE_ATTESTATION_INVALID"), signature: patterned(value.signature, HEX, "TRUST_EVIDENCE_ATTESTATION_INVALID") });
}
function parsePolicy(input: unknown): Readonly<TrustPolicy> {
  const value = plain(input, POLICY_KEYS, "TRUST_POLICY_INVALID");
  if (value.schemaVersion !== 1 || value.mediumVoteThreshold !== 2 || value.highVoteThreshold !== 2 || value.ordinaryHumanPreApprovalRequired !== false || value.probabilisticFinalTakedownAllowed !== false || value.politicalOpinionInferenceAllowed !== false || value.sensitivePoliticalTargetingAllowed !== false || value.actorClass !== "SYSTEM_TEST") fail("TRUST_POLICY_INVALID");
  const effectiveAt = iso(value.effectiveAt, "TRUST_POLICY_INVALID"), expiresAt = iso(value.expiresAt, "TRUST_POLICY_INVALID"); if (Date.parse(expiresAt) <= Date.parse(effectiveAt)) fail("TRUST_POLICY_INVALID");
  return frozen({ schemaVersion: 1, policyId: patterned(value.policyId, ID, "TRUST_POLICY_INVALID"), country: patterned(value.country, COUNTRY, "TRUST_POLICY_INVALID"), version: integer(value.version, 1, 1_000_000, "TRUST_POLICY_INVALID"), effectiveAt, expiresAt, immutableIllegalCategories: sortedUnique(value.immutableIllegalCategories, ID, "TRUST_POLICY_INVALID"), mediumVoteThreshold: 2, highVoteThreshold: 2, ordinaryHumanPreApprovalRequired: false, probabilisticFinalTakedownAllowed: false, politicalOpinionInferenceAllowed: false, sensitivePoliticalTargetingAllowed: false, statementTemplateVersion: integer(value.statementTemplateVersion, 1, 1_000_000, "TRUST_POLICY_INVALID"), appealRoute: patterned(value.appealRoute, ID, "TRUST_POLICY_INVALID"), actorClass: "SYSTEM_TEST", issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_POLICY_INVALID"), signature: patterned(value.signature, HEX, "TRUST_POLICY_INVALID") });
}

function withoutSignature<T extends { signature: string }>(value: T): Omit<T, "signature"> { const { signature: _signature, ...unsigned } = value; return unsigned; }
async function commitment(value: unknown): Promise<string> { return sha256(canonical(value)); }
export async function trustObjectCommitment(value: unknown): Promise<string> { return commitment(value); }

export class TrustFixtureAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) { if (!ID.test(keyId) || !HEX.test(fixtureKey)) fail("TRUST_AUTHORITY_INVALID"); }
  private sign(kind: string, value: unknown): Promise<string> { return sha256(`${this.fixtureKey}:${kind}:${canonical(value)}`); }
  fingerprint(): Promise<string> { return sha256(`TRUST_KEY_FINGERPRINT:${this.fixtureKey}`); }
  async issueContent(input: Omit<ContentEnvelope, "signature">): Promise<Readonly<ContentEnvelope>> { const normalized = withoutSignature(parseContent({ ...capture(input, "TRUST_CONTENT_INVALID") as object, signature: ZERO })); return parseContent({ ...normalized, signature: await this.sign("CONTENT", normalized) }); }
  async issueSignals(input: Omit<SignalBundle, "signature">): Promise<Readonly<SignalBundle>> { const normalized = withoutSignature(parseSignals({ ...capture(input, "TRUST_SIGNALS_INVALID") as object, signature: ZERO })); return parseSignals({ ...normalized, signature: await this.sign("SIGNALS", normalized) }); }
  async issuePolicy(input: Omit<TrustPolicy, "signature">): Promise<Readonly<TrustPolicy>> { const normalized = withoutSignature(parsePolicy({ ...capture(input, "TRUST_POLICY_INVALID") as object, signature: ZERO })); return parsePolicy({ ...normalized, signature: await this.sign("POLICY", normalized) }); }
  async verifyContent(value: ContentEnvelope): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign("CONTENT", withoutSignature(value)); }
  async verifySignals(value: SignalBundle): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign("SIGNALS", withoutSignature(value)); }
  async verifyPolicy(value: TrustPolicy): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign("POLICY", withoutSignature(value)); }
  async signReceipt(value: Omit<TrustDecisionReceipt, "signature">): Promise<string> { return this.sign("RECEIPT", value); }
  async verifyReceipt(value: TrustDecisionReceipt): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.signReceipt(withoutSignature(value)); }
  async sealSnapshot(input: Omit<TrustLedgerSnapshot, "checkpointHash" | "signature">): Promise<Readonly<TrustLedgerSnapshot>> { const base = capture(input, "TRUST_SNAPSHOT_INVALID") as Omit<TrustLedgerSnapshot, "checkpointHash" | "signature">; const checkpointHash = await commitment(base); const unsigned = frozen({ ...base, checkpointHash }); return frozen({ ...unsigned, signature: await this.sign("CHECKPOINT", unsigned) }); }
  async verifySnapshot(value: TrustLedgerSnapshot): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign("CHECKPOINT", withoutSignature(value)); }
}

export class ImmutableEvidenceAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) { if (!ID.test(keyId) || !HEX.test(fixtureKey)) fail("TRUST_EVIDENCE_AUTHORITY_INVALID"); }
  private sign(value: unknown): Promise<string> { return sha256(`${this.fixtureKey}:IMMUTABLE_EVIDENCE:${canonical(value)}`); }
  fingerprint(): Promise<string> { return sha256(`TRUST_KEY_FINGERPRINT:${this.fixtureKey}`); }
  async issue(input: Omit<ImmutableEvidenceAttestation, "attestationHash" | "signature">): Promise<Readonly<ImmutableEvidenceAttestation>> {
    const base = capture(input, "TRUST_EVIDENCE_ATTESTATION_INVALID") as Omit<ImmutableEvidenceAttestation, "attestationHash" | "signature">, attestationHash = await commitment(base), unsigned = frozen({ ...base, attestationHash });
    return parseEvidenceAttestation({ ...unsigned, signature: await this.sign(unsigned) });
  }
  async verify(value: ImmutableEvidenceAttestation): Promise<boolean> {
    const { signature, attestationHash, ...base } = value;
    return value.issuerKeyId === this.keyId && attestationHash === await commitment(base) && signature === await this.sign({ ...base, attestationHash });
  }
}

export class TrustRootRegistryAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) { if (!ID.test(keyId) || !HEX.test(fixtureKey)) fail("TRUST_REGISTRY_AUTHORITY_INVALID"); }
  private sign(value: unknown): Promise<string> { return sha256(`${this.fixtureKey}:TRUST_ROOT_REGISTRY:${canonical(value)}`); }
  fingerprint(): Promise<string> { return sha256(`TRUST_KEY_FINGERPRINT:${this.fixtureKey}`); }
  async issue(input: Omit<TrustRootRegistry, "signature">): Promise<Readonly<TrustRootRegistry>> { const normalized = withoutSignature(parseTrustRegistry({ ...capture(input, "TRUST_REGISTRY_INVALID") as object, signature: ZERO })); return parseTrustRegistry({ ...normalized, signature: await this.sign(normalized) }); }
  async verify(value: TrustRootRegistry): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign(withoutSignature(value)); }
}

export class ModelRegistryAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) { if (!ID.test(keyId) || !HEX.test(fixtureKey)) fail("TRUST_MODEL_AUTHORITY_INVALID"); }
  private sign(value: unknown): Promise<string> { return sha256(`${this.fixtureKey}:MODEL_SET_MANIFEST:${canonical(value)}`); }
  fingerprint(): Promise<string> { return sha256(`TRUST_KEY_FINGERPRINT:${this.fixtureKey}`); }
  async issue(input: Omit<ModelSetManifest, "signature">): Promise<Readonly<ModelSetManifest>> { const normalized = withoutSignature(parseModelManifest({ ...capture(input, "TRUST_MODEL_MANIFEST_INVALID") as object, signature: ZERO })); return parseModelManifest({ ...normalized, signature: await this.sign(normalized) }); }
  async verify(value: ModelSetManifest): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign(withoutSignature(value)); }
}

export class GovernanceRollbackAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) { if (!ID.test(keyId) || !HEX.test(fixtureKey)) fail("TRUST_ROLLBACK_AUTHORITY_INVALID"); }
  private sign(value: unknown): Promise<string> { return sha256(`${this.fixtureKey}:GOVERNANCE_ROLLBACK:${canonical(value)}`); }
  fingerprint(): Promise<string> { return sha256(`TRUST_KEY_FINGERPRINT:${this.fixtureKey}`); }
  async issue(input: Omit<GovernanceRollbackAuthorization, "signature">): Promise<Readonly<GovernanceRollbackAuthorization>> { const normalized = withoutSignature(parseRollback({ ...capture(input, "TRUST_ROLLBACK_INVALID") as object, signature: ZERO })); return parseRollback({ ...normalized, signature: await this.sign(normalized) }); }
  async verify(value: GovernanceRollbackAuthorization): Promise<boolean> { return value.issuerKeyId === this.keyId && value.signature === await this.sign(withoutSignature(value)); }
}

function severityAtLeast(value: SafetySeverity, threshold: "MEDIUM" | "HIGH"): boolean { return SEVERITIES.indexOf(value) >= SEVERITIES.indexOf(threshold); }
async function decide(content: ContentEnvelope, signals: SignalBundle, evidence: ImmutableEvidenceAttestation | null, policy: TrustPolicy, registry: TrustRootRegistry, rollbackAuthorizations: readonly GovernanceRollbackAuthorization[], decisionId: string, now: string, ordinal: number, previousReceiptHash: string, authority: TrustFixtureAuthority): Promise<Readonly<TrustDecisionReceipt>> {
  const labels = new Set<string>(), reasons = new Set<string>();
  if (signals.speechClass === "OPINION") labels.add("OPINION");
  if (signals.speechClass === "SATIRE") labels.add("SATIRE");
  if (signals.speechClass === "PREDICTION") labels.add("PREDICTION");
  if (signals.provenance === "C2PA_VERIFIED") labels.add("SOURCE_VERIFIED");
  else if (signals.provenance === "CREATOR_SIGNED") labels.add("CREATOR_SIGNED");
  else { labels.add(signals.provenance === "INVALID" ? "PROVENANCE_INVALID" : "PROVENANCE_UNKNOWN"); reasons.add("PROVENANCE_CONTEXT"); }
  if (signals.ai.status === "DECLARED") labels.add("AI_DECLARED");
  if (signals.ai.status === "LIKELY") { labels.add("AI_LIKELY"); reasons.add("AI_CONTEXT"); }
  if (signals.evidence.status === "SUPPORTED") labels.add("EVIDENCE_SUPPORTED");
  if (signals.evidence.status === "DISPUTED") { labels.add("EVIDENCE_DISPUTED"); reasons.add("FACTUAL_CONTEXT"); }
  if (signals.evidence.status === "INSUFFICIENT") { labels.add("EVIDENCE_INSUFFICIENT"); reasons.add("FACTUAL_CONTEXT"); }
  if (signals.political.classification === "ORGANIC_POLITICAL") labels.add("POLITICAL_CONTENT");
  if (signals.political.classification === "PAID_POLITICAL") labels.add("POLITICAL_AD");
  const highVotes = signals.safetyVotes.filter(vote => severityAtLeast(vote.severity, "HIGH")).length;
  const mediumVotes = signals.safetyVotes.filter(vote => severityAtLeast(vote.severity, "MEDIUM")).length;
  let outcome: TrustOutcome;
  if (signals.legality.match === "IMMUTABLE_ILLEGAL_HASH") {
    if (!policy.immutableIllegalCategories.includes(signals.legality.categoryCode!)) fail("TRUST_LEGAL_CATEGORY_DENIED");
    outcome = "BLOCK_IMMUTABLE"; reasons.add("IMMUTABLE_ILLEGAL_MATCH");
  } else if (signals.political.classification === "PAID_POLITICAL" && !signals.political.transparencyComplete) {
    outcome = "TEMPORARY_HOLD"; reasons.add("POLITICAL_AD_TRANSPARENCY_MISSING");
  } else if (highVotes >= policy.highVoteThreshold) {
    outcome = "TEMPORARY_HOLD"; reasons.add("INDEPENDENT_HIGH_RISK_CONSENSUS");
  } else if (mediumVotes >= policy.mediumVoteThreshold) {
    outcome = "LIMIT_DISTRIBUTION"; reasons.add("INDEPENDENT_MEDIUM_RISK_CONSENSUS");
  } else if (highVotes === 1 || mediumVotes === 1) {
    outcome = "PUBLISH_LABEL"; labels.add("RISK_SIGNAL_UNCONFIRMED"); reasons.add("SINGLE_SIGNAL_NOT_DECISIVE");
  } else if (reasons.size > 0 || labels.size > 0) outcome = "PUBLISH_LABEL";
  else outcome = "PUBLISH";
  if (outcome === "PUBLISH_LABEL" && reasons.size === 0) reasons.add("INFORMATIONAL_LABEL");
  if (outcome === "PUBLISH") reasons.add("AUTOMATED_LOW_RISK_PASS");
  const policyCommitment = await commitment(policy), signalBundleCommitment = await commitment(signals), rollbackAuthorizationCommitments = frozen((await Promise.all(rollbackAuthorizations.map(value => commitment(value)))).sort());
  let decisionExpiresAt = Date.parse(policy.expiresAt) <= Date.parse(signals.expiresAt) ? policy.expiresAt : signals.expiresAt;
  if (Date.parse(signals.modelSetManifest.expiresAt) < Date.parse(decisionExpiresAt)) decisionExpiresAt = signals.modelSetManifest.expiresAt;
  if (evidence !== null && Date.parse(evidence.expiresAt) < Date.parse(decisionExpiresAt)) decisionExpiresAt = evidence.expiresAt;
  const base = frozen({ schemaVersion: 1 as const, decisionId, contentId: content.contentId, contentCommitment: content.contentCommitment, activeProfileCommitment: content.activeProfileCommitment, surface: content.surface, country: content.country, generation: content.generation, policyId: policy.policyId, policyVersion: policy.version, policyCommitment, modelSetManifestId: signals.modelSetManifest.manifestId, modelSetVersion: signals.modelSetManifest.version, modelSetCommitment: signals.modelSetManifest.modelSetCommitment, signalBundleCommitment, trustRegistryId: registry.registryId, trustRegistryVersion: registry.version, evidenceAuthorityFingerprint: evidence?.authorityFingerprint ?? null, rollbackAuthorizationCommitments, outcome, labels: frozen([...labels].sort()), reasonCodes: frozen([...reasons].sort()), aiLikelihoodRangeBps: signals.ai.status === "LIKELY" ? frozen([signals.ai.lowerBps, signals.ai.upperBps] as [number, number]) : null, decisionAt: now, expiresAt: decisionExpiresAt, statementTemplateVersion: policy.statementTemplateVersion, appealRoute: policy.appealRoute, automated: true as const, humanPreApprovalRequired: false as const, actorClass: "SYSTEM_TEST" as const, ordinal, previousReceiptHash, issuerKeyId: authority.keyId });
  const receiptHash = await commitment(base), unsigned = frozen({ ...base, receiptHash });
  return frozen({ ...unsigned, signature: await authority.signReceipt(unsigned) });
}

function parseReceipt(input: unknown): Readonly<TrustDecisionReceipt> {
  const value = plain(input, RECEIPT_KEYS, "TRUST_RECEIPT_INVALID");
  if (value.schemaVersion !== 1 || value.automated !== true || value.humanPreApprovalRequired !== false || value.actorClass !== "SYSTEM_TEST") fail("TRUST_RECEIPT_INVALID");
  const labels = sortedUnique(value.labels, ID, "TRUST_RECEIPT_INVALID"), reasonCodes = sortedUnique(value.reasonCodes, ID, "TRUST_RECEIPT_INVALID"), rollbackAuthorizationCommitments = sortedUnique(value.rollbackAuthorizationCommitments, HEX, "TRUST_RECEIPT_INVALID"); if (reasonCodes.length === 0 || rollbackAuthorizationCommitments.length > 2) fail("TRUST_RECEIPT_INVALID");
  let aiLikelihoodRangeBps: readonly [number, number] | null = null;
  if (value.aiLikelihoodRangeBps !== null) { if (!Array.isArray(value.aiLikelihoodRangeBps) || value.aiLikelihoodRangeBps.length !== 2) fail("TRUST_RECEIPT_INVALID"); const low = integer(value.aiLikelihoodRangeBps[0], 0, 10_000, "TRUST_RECEIPT_INVALID"), high = integer(value.aiLikelihoodRangeBps[1], 0, 10_000, "TRUST_RECEIPT_INVALID"); if (low > high) fail("TRUST_RECEIPT_INVALID"); aiLikelihoodRangeBps = frozen([low, high]); }
  return frozen({ schemaVersion: 1, decisionId: patterned(value.decisionId, ID, "TRUST_RECEIPT_INVALID"), contentId: patterned(value.contentId, ID, "TRUST_RECEIPT_INVALID"), contentCommitment: patterned(value.contentCommitment, HEX, "TRUST_RECEIPT_INVALID"), activeProfileCommitment: patterned(value.activeProfileCommitment, HEX, "TRUST_RECEIPT_INVALID"), surface: exact(value.surface, SURFACES, "TRUST_RECEIPT_INVALID"), country: patterned(value.country, COUNTRY, "TRUST_RECEIPT_INVALID"), generation: integer(value.generation, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), policyId: patterned(value.policyId, ID, "TRUST_RECEIPT_INVALID"), policyVersion: integer(value.policyVersion, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), policyCommitment: patterned(value.policyCommitment, HEX, "TRUST_RECEIPT_INVALID"), modelSetManifestId: patterned(value.modelSetManifestId, ID, "TRUST_RECEIPT_INVALID"), modelSetVersion: integer(value.modelSetVersion, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), modelSetCommitment: patterned(value.modelSetCommitment, HEX, "TRUST_RECEIPT_INVALID"), signalBundleCommitment: patterned(value.signalBundleCommitment, HEX, "TRUST_RECEIPT_INVALID"), trustRegistryId: patterned(value.trustRegistryId, ID, "TRUST_RECEIPT_INVALID"), trustRegistryVersion: integer(value.trustRegistryVersion, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), evidenceAuthorityFingerprint: nullableHash(value.evidenceAuthorityFingerprint, "TRUST_RECEIPT_INVALID"), rollbackAuthorizationCommitments, outcome: exact(value.outcome, ["PUBLISH", "PUBLISH_LABEL", "LIMIT_DISTRIBUTION", "TEMPORARY_HOLD", "BLOCK_IMMUTABLE"], "TRUST_RECEIPT_INVALID"), labels, reasonCodes, aiLikelihoodRangeBps, decisionAt: iso(value.decisionAt, "TRUST_RECEIPT_INVALID"), expiresAt: iso(value.expiresAt, "TRUST_RECEIPT_INVALID"), statementTemplateVersion: integer(value.statementTemplateVersion, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), appealRoute: patterned(value.appealRoute, ID, "TRUST_RECEIPT_INVALID"), automated: true, humanPreApprovalRequired: false, actorClass: "SYSTEM_TEST", ordinal: integer(value.ordinal, 1, 1_000_000, "TRUST_RECEIPT_INVALID"), previousReceiptHash: patterned(value.previousReceiptHash, HEX, "TRUST_RECEIPT_INVALID"), receiptHash: patterned(value.receiptHash, HEX, "TRUST_RECEIPT_INVALID"), issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_RECEIPT_INVALID"), signature: patterned(value.signature, HEX, "TRUST_RECEIPT_INVALID") });
}

interface GovernanceHead { id: string; version: number; commitment: string }
function trustRoot(registry: TrustRootRegistry, role: TrustRole): TrustRootDescriptor { return registry.roots.find(root => root.role === role) ?? fail("TRUST_ROOT_INVALID"); }

export class AutomatedTrustLedger {
  private readonly events: TrustDecisionEvent[] = [];
  private readonly decisionIds = new Set<string>();
  private readonly decisionKeys = new Set<string>();
  private readonly policyHeads = new Map<string, GovernanceHead>();
  private readonly modelHeads = new Map<string, GovernanceHead>();
  private readonly rollbackIds = new Set<string>();
  private readonly rollbackNonces = new Set<string>();
  private readonly trustRegistry: Readonly<TrustRootRegistry>;
  private operationTail: Promise<void> = Promise.resolve();
  constructor(
    private readonly authority: TrustFixtureAuthority,
    private readonly evidenceAuthority: ImmutableEvidenceAuthority,
    private readonly modelAuthority: ModelRegistryAuthority,
    private readonly rollbackAuthority: GovernanceRollbackAuthority,
    private readonly registryAuthority: TrustRootRegistryAuthority,
    trustRegistryInput: unknown
  ) { this.trustRegistry = parseTrustRegistry(capture(trustRegistryInput, "TRUST_REGISTRY_INVALID")); }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> { const previous = this.operationTail; let release!: () => void; this.operationTail = new Promise(resolve => { release = resolve; }); await previous; try { return await operation(); } finally { release(); } }
  private async validateRegistry(now: string): Promise<void> {
    if (this.trustRegistry.issuerKeyId !== this.registryAuthority.keyId || !await this.registryAuthority.verify(this.trustRegistry) || Date.parse(this.trustRegistry.activatedAt) > Date.parse(now) || Date.parse(this.trustRegistry.expiresAt) <= Date.parse(now)) fail("TRUST_REGISTRY_INVALID");
    const bindings: Array<[TrustRole, string, string]> = [
      ["PRIMARY_TRUST", this.authority.keyId, await this.authority.fingerprint()],
      ["IMMUTABLE_EVIDENCE", this.evidenceAuthority.keyId, await this.evidenceAuthority.fingerprint()],
      ["MODEL_REGISTRY", this.modelAuthority.keyId, await this.modelAuthority.fingerprint()],
      ["GOVERNANCE_ROLLBACK", this.rollbackAuthority.keyId, await this.rollbackAuthority.fingerprint()]
    ];
    const registryFingerprint = await this.registryAuthority.fingerprint();
    for (const [role, keyId, fingerprint] of bindings) {
      const root = trustRoot(this.trustRegistry, role);
      if (root.keyId !== keyId || root.publicKeyFingerprint !== fingerprint || root.revoked || Date.parse(root.activatedAt) > Date.parse(now) || Date.parse(root.expiresAt) <= Date.parse(now) || fingerprint === registryFingerprint || keyId === this.registryAuthority.keyId) fail("TRUST_AUTHORITY_SEPARATION_INVALID");
    }
  }
  private async requiredRollback(domain: RollbackDomain, scopeKey: string, head: GovernanceHead | undefined, target: GovernanceHead, rollbacks: readonly GovernanceRollbackAuthorization[], now: string): Promise<GovernanceRollbackAuthorization | null> {
    const supplied = rollbacks.find(value => value.domain === domain) ?? null;
    if (head === undefined) { if (supplied !== null) fail("TRUST_ROLLBACK_UNEXPECTED"); return null; }
    const same = head.id === target.id && head.version === target.version && head.commitment === target.commitment;
    const forward = target.version > head.version;
    const needsRollback = !same && !forward;
    if (!needsRollback) { if (supplied !== null) fail("TRUST_ROLLBACK_UNEXPECTED"); return null; }
    if (supplied === null) {
      if (domain === "POLICY") fail(target.version === head.version ? "TRUST_POLICY_EQUIVOCATION" : "TRUST_POLICY_ROLLBACK_DENIED");
      fail(target.version === head.version ? "TRUST_MODEL_EQUIVOCATION" : "TRUST_MODEL_ROLLBACK_DENIED");
    }
    const root = trustRoot(this.trustRegistry, "GOVERNANCE_ROLLBACK"), nonceKey = `${domain}|${scopeKey}|${supplied.nonce}`;
    if (!await this.rollbackAuthority.verify(supplied) || supplied.issuerKeyId !== root.keyId || supplied.authorityFingerprint !== root.publicKeyFingerprint || supplied.trustRegistryId !== this.trustRegistry.registryId || supplied.trustRegistryVersion !== this.trustRegistry.version || supplied.scopeKey !== scopeKey || supplied.fromId !== head.id || supplied.fromVersion !== head.version || supplied.fromCommitment !== head.commitment || supplied.toId !== target.id || supplied.toVersion !== target.version || supplied.toCommitment !== target.commitment || Date.parse(supplied.issuedAt) > Date.parse(now) || Date.parse(supplied.expiresAt) <= Date.parse(now)) fail("TRUST_ROLLBACK_INVALID");
    if (this.rollbackIds.has(supplied.authorizationId) || this.rollbackNonces.has(nonceKey)) fail("TRUST_ROLLBACK_REPLAY");
    return supplied;
  }
  async evaluate(contentInput: unknown, signalsInput: unknown, policyInput: unknown, decisionIdInput: unknown, nowInput: unknown, evidenceInput: unknown = null, rollbackInputs: unknown = []): Promise<Readonly<TrustDecisionReceipt>> {
    const contentCaptured = capture(contentInput, "TRUST_CONTENT_INVALID"), signalsCaptured = capture(signalsInput, "TRUST_SIGNALS_INVALID"), policyCaptured = capture(policyInput, "TRUST_POLICY_INVALID"), evidenceCaptured = evidenceInput === null ? null : capture(evidenceInput, "TRUST_EVIDENCE_ATTESTATION_INVALID"), rollbackCaptured = capture(rollbackInputs, "TRUST_ROLLBACK_INVALID"), decisionId = patterned(decisionIdInput, ID, "TRUST_DECISION_INVALID"), now = iso(nowInput, "TRUST_DECISION_INVALID");
    return this.exclusive(async () => {
      if (!Array.isArray(rollbackCaptured) || rollbackCaptured.length > 2) fail("TRUST_ROLLBACK_INVALID");
      const rollbacks = rollbackCaptured.map(parseRollback).sort((a, b) => a.domain.localeCompare(b.domain)); if (new Set(rollbacks.map(value => value.domain)).size !== rollbacks.length) fail("TRUST_ROLLBACK_INVALID");
      const content = parseContent(contentCaptured), signals = parseSignals(signalsCaptured), policy = parsePolicy(policyCaptured), manifest = signals.modelSetManifest;
      await this.validateRegistry(now);
      if (!await this.authority.verifyContent(content) || !await this.authority.verifySignals(signals) || !await this.authority.verifyPolicy(policy)) fail("TRUST_AUTHORIZATION_INVALID");
      const modelRoot = trustRoot(this.trustRegistry, "MODEL_REGISTRY");
      if (!await this.modelAuthority.verify(manifest) || manifest.issuerKeyId !== modelRoot.keyId || manifest.authorityFingerprint !== modelRoot.publicKeyFingerprint || manifest.trustRegistryId !== this.trustRegistry.registryId || manifest.trustRegistryVersion !== this.trustRegistry.version) fail("TRUST_MODEL_MANIFEST_INVALID");
      if (content.contentCommitment !== signals.contentCommitment || content.surface !== signals.surface || content.country !== signals.country || content.country !== policy.country || manifest.surface !== content.surface || manifest.country !== content.country) fail("TRUST_BINDING_MISMATCH");
      if (Date.parse(content.createdAt) > Date.parse(signals.assessedAt) || Date.parse(content.createdAt) > Date.parse(now) || Date.parse(signals.assessedAt) > Date.parse(now) || Date.parse(signals.expiresAt) <= Date.parse(now) || Date.parse(policy.effectiveAt) > Date.parse(now) || Date.parse(policy.expiresAt) <= Date.parse(now) || Date.parse(manifest.effectiveAt) > Date.parse(signals.assessedAt) || Date.parse(manifest.expiresAt) <= Date.parse(now)) fail("TRUST_WINDOW_INACTIVE");
      let evidence: Readonly<ImmutableEvidenceAttestation> | null = null;
      if (signals.legality.match === "IMMUTABLE_ILLEGAL_HASH") {
        evidence = evidenceCaptured === null ? fail("TRUST_EVIDENCE_ATTESTATION_REQUIRED") : parseEvidenceAttestation(evidenceCaptured);
        const evidenceRoot = trustRoot(this.trustRegistry, "IMMUTABLE_EVIDENCE");
        if (!await this.evidenceAuthority.verify(evidence) || evidence.issuerKeyId !== evidenceRoot.keyId || evidence.authorityFingerprint !== evidenceRoot.publicKeyFingerprint || evidence.trustRegistryId !== this.trustRegistry.registryId || evidence.trustRegistryVersion !== this.trustRegistry.version || evidence.attestationHash !== signals.legality.evidenceAttestationHash || evidence.contentCommitment !== content.contentCommitment || evidence.categoryCode !== signals.legality.categoryCode) fail("TRUST_EVIDENCE_ATTESTATION_INVALID");
        if (Date.parse(evidence.observedAt) < Date.parse(content.createdAt) || Date.parse(evidence.observedAt) > Date.parse(signals.assessedAt) || Date.parse(evidence.observedAt) > Date.parse(now) || Date.parse(evidence.expiresAt) <= Date.parse(now)) fail("TRUST_WINDOW_INACTIVE");
      } else if (evidenceCaptured !== null) fail("TRUST_EVIDENCE_ATTESTATION_UNEXPECTED");
      const key = [content.contentId, content.generation].join("|");
      if (this.decisionIds.has(decisionId) || this.decisionKeys.has(key)) fail("TRUST_DECISION_REPLAY");
      const policyCommitment = await commitment(policy), modelCommitment = await commitment(manifest), policyScope = `POLICY:${content.country}`, modelScope = `MODEL:${content.country}:${content.surface}:PUBLIC_CONTENT_TRUST`;
      const policyTarget = frozen({ id: policy.policyId, version: policy.version, commitment: policyCommitment }), modelTarget = frozen({ id: manifest.manifestId, version: manifest.version, commitment: modelCommitment });
      const policyRollback = await this.requiredRollback("POLICY", policyScope, this.policyHeads.get(content.country), policyTarget, rollbacks, now), modelRollback = await this.requiredRollback("MODEL_SET", modelScope, this.modelHeads.get(modelScope), modelTarget, rollbacks, now);
      const required = [policyRollback, modelRollback].filter((value): value is GovernanceRollbackAuthorization => value !== null).sort((a, b) => a.domain.localeCompare(b.domain));
      if (required.length !== rollbacks.length || required.some((value, index) => value.authorizationId !== rollbacks[index].authorizationId)) fail("TRUST_ROLLBACK_UNEXPECTED");
      const ordinal = this.events.length + 1, previousReceiptHash = this.events.at(-1)?.receipt.receiptHash ?? ZERO;
      const receipt = await decide(content, signals, evidence, policy, this.trustRegistry, rollbacks, decisionId, now, ordinal, previousReceiptHash, this.authority);
      const eventBase = frozen({ ordinal, content, signals, evidence, policy, rollbackAuthorizations: frozen(rollbacks), receipt }), eventHash = await commitment(eventBase);
      this.events.push(frozen({ ...eventBase, eventHash })); this.decisionIds.add(decisionId); this.decisionKeys.add(key); this.policyHeads.set(content.country, policyTarget); this.modelHeads.set(modelScope, modelTarget);
      for (const value of rollbacks) { this.rollbackIds.add(value.authorizationId); this.rollbackNonces.add(`${value.domain}|${value.scopeKey}|${value.nonce}`); }
      return receipt;
    });
  }
  async snapshot(): Promise<Readonly<TrustLedgerSnapshot>> { return this.exclusive(() => this.authority.sealSnapshot({ schemaVersion: 1, nextOrdinal: this.events.length + 1, events: frozen(this.events.map(event => frozen({ ...event }))), receiptHead: this.events.at(-1)?.receipt.receiptHash ?? ZERO, trustRegistry: this.trustRegistry, issuerKeyId: this.authority.keyId })); }
  projection(): Readonly<{ decisions: number; receiptHead: string; outcomes: Readonly<Record<TrustOutcome, number>>; policyHeads: number; modelHeads: number; consumedRollbacks: number; rewardsAccrued: 0; organicEvents: 0 }> {
    const outcomes: Record<TrustOutcome, number> = { PUBLISH: 0, PUBLISH_LABEL: 0, LIMIT_DISTRIBUTION: 0, TEMPORARY_HOLD: 0, BLOCK_IMMUTABLE: 0 }; for (const event of this.events) outcomes[event.receipt.outcome] += 1;
    return frozen({ decisions: this.events.length, receiptHead: this.events.at(-1)?.receipt.receiptHash ?? ZERO, outcomes: frozen(outcomes), policyHeads: this.policyHeads.size, modelHeads: this.modelHeads.size, consumedRollbacks: this.rollbackIds.size, rewardsAccrued: 0, organicEvents: 0 });
  }
  static async restore(input: unknown, authority: TrustFixtureAuthority, evidenceAuthority: ImmutableEvidenceAuthority, modelAuthority: ModelRegistryAuthority, rollbackAuthority: GovernanceRollbackAuthority, registryAuthority: TrustRootRegistryAuthority, expectedCheckpointHashInput: unknown): Promise<AutomatedTrustLedger> {
    const captured = capture(input, "TRUST_SNAPSHOT_INVALID"), value = plain(captured, SNAPSHOT_KEYS, "TRUST_SNAPSHOT_INVALID"), expectedCheckpointHash = patterned(expectedCheckpointHashInput, HEX, "TRUST_CHECKPOINT_STALE");
    if (value.schemaVersion !== 1 || !Array.isArray(value.events)) fail("TRUST_SNAPSHOT_INVALID");
    const snapshot: TrustLedgerSnapshot = { schemaVersion: 1, nextOrdinal: integer(value.nextOrdinal, 1, 1_000_000, "TRUST_SNAPSHOT_INVALID"), events: value.events as TrustDecisionEvent[], receiptHead: patterned(value.receiptHead, HEX, "TRUST_SNAPSHOT_INVALID"), trustRegistry: parseTrustRegistry(value.trustRegistry), checkpointHash: patterned(value.checkpointHash, HEX, "TRUST_SNAPSHOT_INVALID"), issuerKeyId: patterned(value.issuerKeyId, ID, "TRUST_SNAPSHOT_INVALID"), signature: patterned(value.signature, HEX, "TRUST_SNAPSHOT_INVALID") };
    if (snapshot.checkpointHash !== expectedCheckpointHash) fail("TRUST_CHECKPOINT_STALE");
    if (snapshot.issuerKeyId !== authority.keyId || !await authority.verifySnapshot(snapshot)) fail("TRUST_CHECKPOINT_INVALID");
    const checkpointBase = { schemaVersion: snapshot.schemaVersion, nextOrdinal: snapshot.nextOrdinal, events: snapshot.events, receiptHead: snapshot.receiptHead, trustRegistry: snapshot.trustRegistry, issuerKeyId: snapshot.issuerKeyId }; if (snapshot.checkpointHash !== await commitment(checkpointBase)) fail("TRUST_CHECKPOINT_INVALID");
    if (snapshot.nextOrdinal !== snapshot.events.length + 1) fail("TRUST_SNAPSHOT_INVALID");
    const ledger = new AutomatedTrustLedger(authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, snapshot.trustRegistry);
    await ledger.validateRegistry(snapshot.events.at(-1)?.receipt.decisionAt ?? snapshot.trustRegistry.activatedAt);
    for (let index = 0; index < snapshot.events.length; index += 1) {
      const eventValue = plain(snapshot.events[index], EVENT_KEYS, "TRUST_EVENT_INVALID"), ordinal = integer(eventValue.ordinal, 1, 1_000_000, "TRUST_EVENT_INVALID"); if (ordinal !== index + 1 || !Array.isArray(eventValue.rollbackAuthorizations)) fail("TRUST_EVENT_INVALID");
      const content = parseContent(eventValue.content), signals = parseSignals(eventValue.signals), evidence = eventValue.evidence === null ? null : parseEvidenceAttestation(eventValue.evidence), policy = parsePolicy(eventValue.policy), rollbackAuthorizations = eventValue.rollbackAuthorizations.map(parseRollback).sort((a, b) => a.domain.localeCompare(b.domain)), receipt = parseReceipt(eventValue.receipt), eventHash = patterned(eventValue.eventHash, HEX, "TRUST_EVENT_INVALID");
      const restoredReceipt = await ledger.evaluate(content, signals, policy, receipt.decisionId, receipt.decisionAt, evidence, rollbackAuthorizations);
      if (canonical(restoredReceipt) !== canonical(receipt) || eventHash !== await commitment({ ordinal, content, signals, evidence, policy, rollbackAuthorizations, receipt })) fail("TRUST_EVENT_LINEAGE_INVALID");
    }
    if (ledger.projection().receiptHead !== snapshot.receiptHead) fail("TRUST_EVENT_LINEAGE_INVALID");
    return ledger;
  }
}
