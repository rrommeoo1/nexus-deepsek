import { AutomatedTrustLedger, ContentEnvelope, ContentKind, DetectorVote, GovernanceRollbackAuthority, GovernanceRollbackAuthorization, ImmutableEvidenceAuthority, ModelRegistryAuthority, SignalBundle, TrustFixtureAuthority, TrustLedgerSnapshot, TrustLensError, TrustPolicy, TrustRootRegistry, TrustRootRegistryAuthority, TrustSurface, trustObjectCommitment } from "./index";

declare const process: { stdout: { write(value: string): void }; stderr: { write(value: string): void }; exitCode?: number };

let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions += 1; if (!value) throw new Error(message); }
async function expectCode(operation: () => unknown | Promise<unknown>, code: string): Promise<void> {
  assertions += 1;
  try { await operation(); throw new Error(`expected ${code}`); }
  catch (error) { if (!(error instanceof TrustLensError) || error.code !== code) throw error; }
}

const authority = new TrustFixtureAuthority("TRUST-AUTH:LOCAL_A32", "a9".repeat(32));
const evidenceAuthority = new ImmutableEvidenceAuthority("EVIDENCE-AUTH:LOCAL_C04", "b7".repeat(32));
const modelAuthority = new ModelRegistryAuthority("MODEL-AUTH:LOCAL_C06", "c5".repeat(32));
const rollbackAuthority = new GovernanceRollbackAuthority("ROLLBACK-AUTH:LOCAL_C10", "d3".repeat(32));
const registryAuthority = new TrustRootRegistryAuthority("ROOT-AUTH:LOCAL_C02", "e1".repeat(32));
let trustRegistry: Readonly<TrustRootRegistry>;
const NOW = "2026-08-15T12:00:00Z";
const ASSESSED = "2026-08-15T11:30:00Z";
const EXPIRES = "2026-08-15T18:00:00Z";
const MODEL = "31".repeat(32);
function hash(value: number): string { return (value % 256).toString(16).padStart(2, "0").repeat(32); }

async function content(index: number, surface: TrustSurface = "SOCIAL", kind: ContentKind = "POST", country = "RO"): Promise<Readonly<ContentEnvelope>> {
  return authority.issueContent({ schemaVersion: 1, contentId: `CONTENT:${String(index).padStart(3, "0")}`, contentCommitment: hash(index), activeProfileCommitment: hash(index + 80), surface, kind, country, generation: 1, createdAt: "2026-08-15T11:00:00Z", actorClass: "SYSTEM_TEST", issuerKeyId: authority.keyId });
}

interface SignalOptions {
  speechClass?: SignalBundle["speechClass"];
  provenance?: SignalBundle["provenance"];
  ai?: SignalBundle["ai"];
  evidence?: SignalBundle["evidence"];
  votes?: readonly DetectorVote[];
  legality?: SignalBundle["legality"];
  political?: SignalBundle["political"];
  assessedAt?: string;
  expiresAt?: string;
  modelVersion?: number;
  modelCommitment?: string;
  modelManifestId?: string;
}
async function signals(index: number, item: ContentEnvelope, options: SignalOptions = {}): Promise<Readonly<SignalBundle>> {
  const modelVersion = options.modelVersion ?? 1;
  const modelSetManifest = await modelAuthority.issue({ schemaVersion: 1, manifestId: options.modelManifestId ?? `MODELSET:${item.surface}:${String(modelVersion).padStart(3, "0")}`, purpose: "PUBLIC_CONTENT_TRUST", surface: item.surface, country: item.country, version: modelVersion, modelSetCommitment: options.modelCommitment ?? MODEL, effectiveAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", revoked: false, trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await modelAuthority.fingerprint(), actorClass: "SYSTEM_TEST", issuerKeyId: modelAuthority.keyId });
  return authority.issueSignals({
    schemaVersion: 1,
    signalId: `SIGNAL:${String(index).padStart(3, "0")}`,
    contentCommitment: item.contentCommitment,
    surface: item.surface,
    country: item.country,
    modelSetManifest,
    assessedAt: options.assessedAt ?? ASSESSED,
    expiresAt: options.expiresAt ?? EXPIRES,
    speechClass: options.speechClass ?? "FACTUAL_CLAIM",
    provenance: options.provenance ?? "C2PA_VERIFIED",
    ai: options.ai ?? { status: "NONE_DETECTED", lowerBps: 0, upperBps: 0, calibrated: false },
    evidence: options.evidence ?? { status: "SUPPORTED", claimCount: 1 },
    safetyVotes: options.votes ?? [{ detectorId: "DETECTOR:A", severity: "NONE" }, { detectorId: "DETECTOR:B", severity: "NONE" }, { detectorId: "DETECTOR:C", severity: "NONE" }],
    legality: options.legality ?? { match: "NONE", categoryCode: null, evidenceAttestationHash: null },
    political: options.political ?? { classification: "NONE", transparencyComplete: true, sponsorCommitment: null, electionCommitment: null },
    actorClass: "SYSTEM_TEST",
    issuerKeyId: authority.keyId
  });
}

async function buildRegistry(): Promise<Readonly<TrustRootRegistry>> {
  return registryAuthority.issue({ schemaVersion: 1, registryId: "TRUST-ROOTS:EU:001", version: 1, roots: [
    { role: "PRIMARY_TRUST", keyId: authority.keyId, publicKeyFingerprint: await authority.fingerprint(), authorityLineage: "LINEAGE:PRIMARY", administrativeDomain: "DOMAIN:TRUST", activatedAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", revoked: false },
    { role: "IMMUTABLE_EVIDENCE", keyId: evidenceAuthority.keyId, publicKeyFingerprint: await evidenceAuthority.fingerprint(), authorityLineage: "LINEAGE:EVIDENCE", administrativeDomain: "DOMAIN:EVIDENCE", activatedAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", revoked: false },
    { role: "MODEL_REGISTRY", keyId: modelAuthority.keyId, publicKeyFingerprint: await modelAuthority.fingerprint(), authorityLineage: "LINEAGE:MODEL", administrativeDomain: "DOMAIN:MODEL", activatedAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", revoked: false },
    { role: "GOVERNANCE_ROLLBACK", keyId: rollbackAuthority.keyId, publicKeyFingerprint: await rollbackAuthority.fingerprint(), authorityLineage: "LINEAGE:ROLLBACK", administrativeDomain: "DOMAIN:GOVERNANCE", activatedAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", revoked: false }
  ], activatedAt: "2026-08-15T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z", actorClass: "SYSTEM_TEST", issuerKeyId: registryAuthority.keyId });
}

function newLedger(registry: unknown = trustRegistry, primary = authority, evidence = evidenceAuthority): AutomatedTrustLedger { return new AutomatedTrustLedger(primary, evidence, modelAuthority, rollbackAuthority, registryAuthority, registry); }

async function rollback(input: Omit<GovernanceRollbackAuthorization, "schemaVersion" | "issuedAt" | "expiresAt" | "trustRegistryId" | "trustRegistryVersion" | "authorityFingerprint" | "actorClass" | "issuerKeyId" | "signature">): Promise<Readonly<GovernanceRollbackAuthorization>> {
  return rollbackAuthority.issue({ schemaVersion: 1, ...input, issuedAt: "2026-08-15T11:45:00Z", expiresAt: EXPIRES, trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await rollbackAuthority.fingerprint(), actorClass: "SYSTEM_TEST", issuerKeyId: rollbackAuthority.keyId });
}

async function policy(index = 1, country = "RO", effectiveAt = "2026-08-15T00:00:00Z", expiresAt = "2026-08-16T00:00:00Z"): Promise<Readonly<TrustPolicy>> {
  return authority.issuePolicy({ schemaVersion: 1, policyId: `POLICY:EU:${String(index).padStart(3, "0")}`, country, version: index, effectiveAt, expiresAt, immutableIllegalCategories: ["ILLEGAL:CSAM_HASH", "ILLEGAL:MALWARE_HASH"], mediumVoteThreshold: 2, highVoteThreshold: 2, ordinaryHumanPreApprovalRequired: false, probabilisticFinalTakedownAllowed: false, politicalOpinionInferenceAllowed: false, sensitivePoliticalTargetingAllowed: false, statementTemplateVersion: 1, appealRoute: "APPEAL:EU:INTERNAL", actorClass: "SYSTEM_TEST", issuerKeyId: authority.keyId });
}

async function reseal(snapshot: TrustLedgerSnapshot, mutate: (draft: Record<string, unknown>) => void): Promise<Readonly<TrustLedgerSnapshot>> {
  const draft = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  mutate(draft); delete draft.checkpointHash; delete draft.signature;
  return authority.sealSnapshot(draft as unknown as Omit<TrustLedgerSnapshot, "checkpointHash" | "signature">);
}

async function main(): Promise<void> {
  trustRegistry = await buildRegistry();
  const ledger = newLedger(), roPolicy = await policy();
  const corpus: Array<[TrustSurface, ContentKind]> = [["SOCIAL", "CLIP"], ["WORK", "POST"], ["DATING", "PROFILE"], ["MARKET", "LISTING"], ["TRAVEL", "IMAGE"], ["LIVE", "LIVE"], ["KIDS", "CLIP"]];
  for (let index = 0; index < corpus.length; index += 1) {
    const item = await content(index + 1, corpus[index][0], corpus[index][1]), bundle = await signals(index + 1, item);
    const receipt = await ledger.evaluate(item, bundle, roPolicy, `DECISION:CORPUS:${index + 1}`, NOW);
    assert(receipt.outcome === "PUBLISH_LABEL", `${item.surface} low-risk content publishes with informational labels`);
    assert(receipt.automated && !receipt.humanPreApprovalRequired && receipt.appealRoute === "APPEAL:EU:INTERNAL", `${item.surface} is automated explainable and appealable`);
    assert(receipt.labels.includes("SOURCE_VERIFIED") && receipt.labels.includes("EVIDENCE_SUPPORTED"), `${item.surface} exposes separate positive provenance and evidence signals`);
  }
  assert(ledger.projection().decisions === corpus.length, "one hundred percent of the seven-surface synthetic corpus enters the automated cascade");

  const aiContent = await content(20), aiSignals = await signals(20, aiContent, { provenance: "UNKNOWN", ai: { status: "LIKELY", lowerBps: 7200, upperBps: 8600, calibrated: true }, evidence: { status: "INSUFFICIENT", claimCount: 2 } });
  const aiReceipt = await ledger.evaluate(aiContent, aiSignals, roPolicy, "DECISION:AI:020", NOW);
  assert(aiReceipt.outcome === "PUBLISH_LABEL" && aiReceipt.labels.includes("AI_LIKELY") && aiReceipt.labels.includes("PROVENANCE_UNKNOWN"), "AI likelihood and unknown provenance add context without declaring falsehood");
  assert(JSON.stringify(aiReceipt.aiLikelihoodRangeBps) === "[7200,8600]", "only a calibrated AI range is exposed");

  const disputedContent = await content(21), disputedSignals = await signals(21, disputedContent, { evidence: { status: "DISPUTED", claimCount: 3 } });
  const disputedReceipt = await ledger.evaluate(disputedContent, disputedSignals, roPolicy, "DECISION:EVIDENCE:021", NOW);
  assert(disputedReceipt.outcome === "PUBLISH_LABEL" && disputedReceipt.labels.includes("EVIDENCE_DISPUTED") && disputedReceipt.reasonCodes.includes("FACTUAL_CONTEXT"), "disputed evidence is contextualised rather than converted to a truth score");

  const opinionContent = await content(22), opinionSignals = await signals(22, opinionContent, { speechClass: "OPINION", evidence: { status: "NOT_APPLICABLE", claimCount: 0 } });
  const opinionReceipt = await ledger.evaluate(opinionContent, opinionSignals, roPolicy, "DECISION:OPINION:022", NOW);
  assert(opinionReceipt.labels.includes("OPINION") && !opinionReceipt.labels.some(label => label.includes("FALSE")), "opinion remains a distinct non-factual class");
  await expectCode(async () => signals(23, await content(23), { speechClass: "SATIRE", evidence: { status: "SUPPORTED", claimCount: 1 } }), "TRUST_EVIDENCE_CLASS_INVALID");

  const oneVoteContent = await content(24), oneVoteSignals = await signals(24, oneVoteContent, { votes: [{ detectorId: "DETECTOR:A", severity: "CRITICAL" }, { detectorId: "DETECTOR:B", severity: "NONE" }, { detectorId: "DETECTOR:C", severity: "NONE" }] });
  const oneVoteReceipt = await ledger.evaluate(oneVoteContent, oneVoteSignals, roPolicy, "DECISION:ONE-VOTE:024", NOW);
  assert(oneVoteReceipt.outcome === "PUBLISH_LABEL" && oneVoteReceipt.reasonCodes.includes("SINGLE_SIGNAL_NOT_DECISIVE"), "one probabilistic detector cannot hold limit or block content");
  const highContent = await content(25), highSignals = await signals(25, highContent, { votes: [{ detectorId: "DETECTOR:A", severity: "HIGH" }, { detectorId: "DETECTOR:B", severity: "CRITICAL" }, { detectorId: "DETECTOR:C", severity: "NONE" }] });
  const highReceipt = await ledger.evaluate(highContent, highSignals, roPolicy, "DECISION:HIGH:025", NOW);
  assert(highReceipt.outcome === "TEMPORARY_HOLD" && highReceipt.reasonCodes.includes("INDEPENDENT_HIGH_RISK_CONSENSUS"), "two independent high-risk votes create only a temporary appealable hold");
  const mediumContent = await content(26), mediumSignals = await signals(26, mediumContent, { votes: [{ detectorId: "DETECTOR:A", severity: "MEDIUM" }, { detectorId: "DETECTOR:B", severity: "MEDIUM" }, { detectorId: "DETECTOR:C", severity: "NONE" }] });
  const mediumReceipt = await ledger.evaluate(mediumContent, mediumSignals, roPolicy, "DECISION:MEDIUM:026", NOW);
  assert(mediumReceipt.outcome === "LIMIT_DISTRIBUTION", "two independent medium-risk votes can limit distribution but cannot create final takedown");

  const illegalContent = await content(27), illegalAttestation = await evidenceAuthority.issue({ schemaVersion: 1, attestationId: "EVIDENCE:ILLEGAL:027", contentCommitment: illegalContent.contentCommitment, categoryCode: "ILLEGAL:CSAM_HASH", evidenceSetCommitment: hash(203), observedAt: ASSESSED, expiresAt: "2026-08-15T15:00:00Z", actorClass: "SYSTEM_TEST", trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await evidenceAuthority.fingerprint(), issuerKeyId: evidenceAuthority.keyId }), illegalSignals = await signals(27, illegalContent, { legality: { match: "IMMUTABLE_ILLEGAL_HASH", categoryCode: "ILLEGAL:CSAM_HASH", evidenceAttestationHash: illegalAttestation.attestationHash } });
  await expectCode(() => ledger.evaluate(illegalContent, illegalSignals, roPolicy, "DECISION:ILLEGAL:MISSING", NOW), "TRUST_EVIDENCE_ATTESTATION_REQUIRED");
  const illegalReceipt = await ledger.evaluate(illegalContent, illegalSignals, roPolicy, "DECISION:ILLEGAL:027", NOW, illegalAttestation);
  assert(illegalReceipt.outcome === "BLOCK_IMMUTABLE" && illegalReceipt.reasonCodes.length === 1 && illegalReceipt.reasonCodes[0] === "IMMUTABLE_ILLEGAL_MATCH", "only allowlisted verified immutable illegality creates the final block outcome");
  assert(illegalReceipt.expiresAt === illegalAttestation.expiresAt, "a final block receipt cannot outlive its independent evidence attestation");
  const rogueEvidenceAuthority = new ImmutableEvidenceAuthority("EVIDENCE-AUTH:ROGUE", "c8".repeat(32));
  const rogueContent = await content(127), rogueAttestation = await rogueEvidenceAuthority.issue({ schemaVersion: 1, attestationId: "EVIDENCE:ROGUE:127", contentCommitment: rogueContent.contentCommitment, categoryCode: "ILLEGAL:CSAM_HASH", evidenceSetCommitment: hash(205), observedAt: ASSESSED, expiresAt: EXPIRES, actorClass: "SYSTEM_TEST", trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await rogueEvidenceAuthority.fingerprint(), issuerKeyId: rogueEvidenceAuthority.keyId }), rogueSignals = await signals(127, rogueContent, { legality: { match: "IMMUTABLE_ILLEGAL_HASH", categoryCode: "ILLEGAL:CSAM_HASH", evidenceAttestationHash: rogueAttestation.attestationHash } });
  await expectCode(() => ledger.evaluate(rogueContent, rogueSignals, roPolicy, "DECISION:ILLEGAL:ROGUE", NOW, rogueAttestation), "TRUST_EVIDENCE_ATTESTATION_INVALID");
  const substitutedContent = await content(128), foreignEvidence = await evidenceAuthority.issue({ schemaVersion: 1, attestationId: "EVIDENCE:FOREIGN:128", contentCommitment: hash(129), categoryCode: "ILLEGAL:CSAM_HASH", evidenceSetCommitment: hash(206), observedAt: ASSESSED, expiresAt: EXPIRES, actorClass: "SYSTEM_TEST", trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await evidenceAuthority.fingerprint(), issuerKeyId: evidenceAuthority.keyId }), substitutedSignals = await signals(128, substitutedContent, { legality: { match: "IMMUTABLE_ILLEGAL_HASH", categoryCode: "ILLEGAL:CSAM_HASH", evidenceAttestationHash: foreignEvidence.attestationHash } });
  await expectCode(() => ledger.evaluate(substitutedContent, substitutedSignals, roPolicy, "DECISION:ILLEGAL:SUBSTITUTED", NOW, foreignEvidence), "TRUST_EVIDENCE_ATTESTATION_INVALID");
  const causalContent = await content(130), futureEvidence = await evidenceAuthority.issue({ schemaVersion: 1, attestationId: "EVIDENCE:FUTURE:130", contentCommitment: causalContent.contentCommitment, categoryCode: "ILLEGAL:CSAM_HASH", evidenceSetCommitment: hash(207), observedAt: "2026-08-15T11:45:00Z", expiresAt: EXPIRES, actorClass: "SYSTEM_TEST", trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await evidenceAuthority.fingerprint(), issuerKeyId: evidenceAuthority.keyId }), causalSignals = await signals(130, causalContent, { legality: { match: "IMMUTABLE_ILLEGAL_HASH", categoryCode: "ILLEGAL:CSAM_HASH", evidenceAttestationHash: futureEvidence.attestationHash } });
  await expectCode(() => ledger.evaluate(causalContent, causalSignals, roPolicy, "DECISION:ILLEGAL:FUTURE-EVIDENCE", NOW, futureEvidence), "TRUST_WINDOW_INACTIVE");
  const deniedCategoryContent = await content(28), deniedCategoryAttestation = await evidenceAuthority.issue({ schemaVersion: 1, attestationId: "EVIDENCE:ILLEGAL:028", contentCommitment: deniedCategoryContent.contentCommitment, categoryCode: "ILLEGAL:UNREGISTERED", evidenceSetCommitment: hash(204), observedAt: ASSESSED, expiresAt: EXPIRES, actorClass: "SYSTEM_TEST", trustRegistryId: trustRegistry.registryId, trustRegistryVersion: trustRegistry.version, authorityFingerprint: await evidenceAuthority.fingerprint(), issuerKeyId: evidenceAuthority.keyId }), deniedCategorySignals = await signals(28, deniedCategoryContent, { legality: { match: "IMMUTABLE_ILLEGAL_HASH", categoryCode: "ILLEGAL:UNREGISTERED", evidenceAttestationHash: deniedCategoryAttestation.attestationHash } });
  await expectCode(() => ledger.evaluate(deniedCategoryContent, deniedCategorySignals, roPolicy, "DECISION:ILLEGAL:028", NOW, deniedCategoryAttestation), "TRUST_LEGAL_CATEGORY_DENIED");

  const politicalA = await content(29), politicalB = await content(30);
  const politicalSignalsA = await signals(29, politicalA, { speechClass: "OPINION", evidence: { status: "NOT_APPLICABLE", claimCount: 0 }, political: { classification: "ORGANIC_POLITICAL", transparencyComplete: true, sponsorCommitment: null, electionCommitment: null } });
  const politicalSignalsB = await signals(30, politicalB, { speechClass: "OPINION", evidence: { status: "NOT_APPLICABLE", claimCount: 0 }, political: { classification: "ORGANIC_POLITICAL", transparencyComplete: true, sponsorCommitment: null, electionCommitment: null } });
  const politicalReceiptA = await ledger.evaluate(politicalA, politicalSignalsA, roPolicy, "DECISION:POLITICAL:A", NOW), politicalReceiptB = await ledger.evaluate(politicalB, politicalSignalsB, roPolicy, "DECISION:POLITICAL:B", NOW);
  assert(politicalReceiptA.outcome === politicalReceiptB.outcome && JSON.stringify(politicalReceiptA.labels) === JSON.stringify(politicalReceiptB.labels) && JSON.stringify(politicalReceiptA.reasonCodes) === JSON.stringify(politicalReceiptB.reasonCodes), "political viewpoints with identical safety and evidence signals receive identical decisions");
  assert(politicalReceiptA.labels.includes("POLITICAL_CONTENT") && !JSON.stringify(politicalReceiptA).match(/LEFT|RIGHT|IDEOLOGY/), "organic political expression is labelled without inferred ideology");

  const missingAdContent = await content(31), missingAdSignals = await signals(31, missingAdContent, { speechClass: "ADVERTISEMENT", political: { classification: "PAID_POLITICAL", transparencyComplete: false, sponsorCommitment: null, electionCommitment: null } });
  const missingAdReceipt = await ledger.evaluate(missingAdContent, missingAdSignals, roPolicy, "DECISION:POLITICAL-AD:031", NOW);
  assert(missingAdReceipt.outcome === "TEMPORARY_HOLD" && missingAdReceipt.reasonCodes.includes("POLITICAL_AD_TRANSPARENCY_MISSING"), "paid political content missing transparency is held automatically");
  const completeAdContent = await content(32), completeAdSignals = await signals(32, completeAdContent, { speechClass: "ADVERTISEMENT", political: { classification: "PAID_POLITICAL", transparencyComplete: true, sponsorCommitment: hash(201), electionCommitment: hash(202) } });
  const completeAdReceipt = await ledger.evaluate(completeAdContent, completeAdSignals, roPolicy, "DECISION:POLITICAL-AD:032", NOW);
  assert(completeAdReceipt.outcome === "PUBLISH_LABEL" && completeAdReceipt.labels.includes("POLITICAL_AD"), "transparent paid political content publishes with an explicit label");

  const validShapeContent = await content(40), validShapeSignals = await signals(40, validShapeContent), invalidShape = { ...validShapeContent, universalTruthScore: 9900 };
  await expectCode(() => ledger.evaluate(invalidShape, validShapeSignals, roPolicy, "DECISION:SHAPE:040", NOW), "TRUST_CONTENT_INVALID");
  const badBooleanContent = await content(41), badBooleanBase = await signals(41, badBooleanContent);
  const badBoolean = { ...badBooleanBase, ai: { ...badBooleanBase.ai, calibrated: "false" } };
  await expectCode(() => ledger.evaluate(badBooleanContent, badBoolean, roPolicy, "DECISION:BOOLEAN:041", NOW), "TRUST_SIGNALS_INVALID");
  const mismatchedContent = await content(42), mismatchedSignals = await signals(42, await content(43));
  await expectCode(() => ledger.evaluate(mismatchedContent, mismatchedSignals, roPolicy, "DECISION:BINDING:042", NOW), "TRUST_BINDING_MISMATCH");
  const expiredPolicy = await policy(2, "RO", "2026-08-14T00:00:00Z", "2026-08-15T11:59:59Z"), expiredContent = await content(44), expiredSignals = await signals(44, expiredContent);
  await expectCode(() => ledger.evaluate(expiredContent, expiredSignals, expiredPolicy, "DECISION:EXPIRED:044", NOW), "TRUST_WINDOW_INACTIVE");
  const staleContent = await content(45), staleSignals = await signals(45, staleContent, { expiresAt: "2026-08-15T11:59:59Z" });
  await expectCode(() => ledger.evaluate(staleContent, staleSignals, roPolicy, "DECISION:STALE:045", NOW), "TRUST_WINDOW_INACTIVE");
  const futureContent = await content(145), preCreationSignals = await signals(145, futureContent, { assessedAt: "2026-08-15T10:59:59Z" });
  await expectCode(() => ledger.evaluate(futureContent, preCreationSignals, roPolicy, "DECISION:PRE-CREATION:145", NOW), "TRUST_WINDOW_INACTIVE");
  const sortedContent = await content(146), normalizedSignals = await signals(146, sortedContent, { votes: [{ detectorId: "DETECTOR:C", severity: "NONE" }, { detectorId: "DETECTOR:A", severity: "NONE" }, { detectorId: "DETECTOR:B", severity: "NONE" }] });
  const normalizedReceipt = await ledger.evaluate(sortedContent, normalizedSignals, roPolicy, "DECISION:NORMALIZED:146", NOW);
  assert(normalizedReceipt.outcome === "PUBLISH_LABEL", "authority signs the normalized canonical signal representation");

  await expectCode(() => ledger.evaluate(aiContent, aiSignals, roPolicy, "DECISION:AI:REPLAY", NOW), "TRUST_DECISION_REPLAY");
  const concurrentContent = await content(46), concurrentSignals = await signals(46, concurrentContent);
  const concurrentResults = await Promise.allSettled([ledger.evaluate(concurrentContent, concurrentSignals, roPolicy, "DECISION:CONCURRENT:046", NOW), ledger.evaluate(concurrentContent, concurrentSignals, roPolicy, "DECISION:CONCURRENT:046", NOW)]);
  assert(concurrentResults.filter(result => result.status === "fulfilled").length === 1 && concurrentResults.filter(result => result.status === "rejected" && result.reason instanceof TrustLensError && result.reason.code === "TRUST_DECISION_REPLAY").length === 1, "concurrent duplicate decisions commit exactly once");

  const snapshot = await ledger.snapshot(), restored = await AutomatedTrustLedger.restore(JSON.parse(JSON.stringify(snapshot)), authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, snapshot.checkpointHash);
  assert(JSON.stringify(restored.projection()) === JSON.stringify(ledger.projection()), "fresh restore reproduces decision count receipt head outcomes and synthetic isolation");
  await expectCode(() => restored.evaluate(aiContent, aiSignals, roPolicy, "DECISION:AI:AFTER-RESTORE", NOW), "TRUST_DECISION_REPLAY");
  const captured = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>, pendingRestore = AutomatedTrustLedger.restore(captured, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, snapshot.checkpointHash); captured.receiptHead = hash(250);
  assert((await pendingRestore).projection().receiptHead === snapshot.receiptHead, "restore captures one immutable representation before asynchronous verification");
  const prefix = await reseal(snapshot, draft => { const events = draft.events as Array<Record<string, unknown>>; events.pop(); draft.nextOrdinal = events.length + 1; draft.receiptHead = events.at(-1)?.receipt && (events.at(-1)!.receipt as Record<string, unknown>).receiptHash || "0".repeat(64); });
  await expectCode(() => AutomatedTrustLedger.restore(prefix, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, snapshot.checkpointHash), "TRUST_CHECKPOINT_STALE");
  const reordered = await reseal(snapshot, draft => { const events = draft.events as unknown[]; [events[0], events[1]] = [events[1], events[0]]; });
  await expectCode(() => AutomatedTrustLedger.restore(reordered, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, reordered.checkpointHash), "TRUST_EVENT_INVALID");
  const fabricated = await reseal(snapshot, draft => { const event = (draft.events as Array<Record<string, unknown>>)[0]; (event.receipt as Record<string, unknown>).outcome = "BLOCK_IMMUTABLE"; });
  await expectCode(() => AutomatedTrustLedger.restore(fabricated, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, fabricated.checkpointHash), "TRUST_EVENT_LINEAGE_INVALID");
  const substitutedRegistrySnapshot = await reseal(snapshot, draft => { const registry = draft.trustRegistry as Record<string, unknown>, roots = registry.roots as Array<Record<string, unknown>>, evidenceRoot = roots.find(root => root.role === "IMMUTABLE_EVIDENCE")!; evidenceRoot.publicKeyFingerprint = hash(240); });
  await expectCode(() => AutomatedTrustLedger.restore(substitutedRegistrySnapshot, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, substitutedRegistrySnapshot.checkpointHash), "TRUST_REGISTRY_INVALID");
  assert(!/universalTruthScore|honestyScore|ideologyScore|attractivenessScore/.test(JSON.stringify(snapshot)), "decision history contains no prohibited universal person or viewpoint score");

  const sameRootDraft = JSON.parse(JSON.stringify(trustRegistry)) as Record<string, unknown>; delete sameRootDraft.signature;
  const sameRoots = sameRootDraft.roots as Array<Record<string, unknown>>, sameEvidenceRoot = sameRoots.find(root => root.role === "IMMUTABLE_EVIDENCE")!;
  sameEvidenceRoot.keyId = authority.keyId; sameEvidenceRoot.publicKeyFingerprint = await authority.fingerprint();
  await expectCode(() => registryAuthority.issue(sameRootDraft as unknown as Omit<TrustRootRegistry, "signature">), "TRUST_AUTHORITY_SEPARATION_INVALID");
  const inactiveRootDraft = JSON.parse(JSON.stringify(trustRegistry)) as Record<string, unknown>; delete inactiveRootDraft.signature;
  const inactiveRoots = inactiveRootDraft.roots as Array<Record<string, unknown>>, inactiveEvidenceRoot = inactiveRoots.find(root => root.role === "IMMUTABLE_EVIDENCE")!; inactiveEvidenceRoot.expiresAt = "2026-08-15T11:59:59Z";
  const inactiveRegistry = await registryAuthority.issue(inactiveRootDraft as unknown as Omit<TrustRootRegistry, "signature">), inactiveLedger = newLedger(inactiveRegistry), inactiveContent = await content(199), inactiveSignals = await signals(199, inactiveContent);
  await expectCode(() => inactiveLedger.evaluate(inactiveContent, inactiveSignals, roPolicy, "DECISION:INACTIVE-ROOT:199", NOW), "TRUST_AUTHORITY_SEPARATION_INVALID");

  const policyV1 = await policy(1), policyV2 = await policy(2), governanceLedger = newLedger();
  const governanceContent = await content(200), governanceSignals = await signals(200, governanceContent, { modelVersion: 2, modelCommitment: hash(220) });
  const governanceReceipt = await governanceLedger.evaluate(governanceContent, governanceSignals, policyV2, "DECISION:GOVERNANCE:200", NOW);
  assert(governanceReceipt.policyVersion === 2 && governanceReceipt.modelSetVersion === 2 && governanceReceipt.trustRegistryId === trustRegistry.registryId, "receipt binds current policy model manifest and trust-root registry versions");
  const stalePolicyContent = await content(201), stalePolicySignals = await signals(201, stalePolicyContent, { modelVersion: 2, modelCommitment: hash(220) });
  await expectCode(() => governanceLedger.evaluate(stalePolicyContent, stalePolicySignals, policyV1, "DECISION:POLICY-ROLLBACK:201", NOW), "TRUST_POLICY_ROLLBACK_DENIED");
  const { signature: _policySignature, ...policyV2Unsigned } = policyV2;
  const alternatePolicyV2 = await authority.issuePolicy({ ...policyV2Unsigned, appealRoute: "APPEAL:EU:ALTERNATE" });
  const alternatePolicyContent = await content(202), alternatePolicySignals = await signals(202, alternatePolicyContent, { modelVersion: 2, modelCommitment: hash(220) });
  await expectCode(() => governanceLedger.evaluate(alternatePolicyContent, alternatePolicySignals, alternatePolicyV2, "DECISION:POLICY-EQUIVOCATION:202", NOW), "TRUST_POLICY_EQUIVOCATION");
  const modelEquivocationContent = await content(203), modelEquivocationSignals = await signals(203, modelEquivocationContent, { modelVersion: 2, modelCommitment: hash(221) });
  await expectCode(() => governanceLedger.evaluate(modelEquivocationContent, modelEquivocationSignals, policyV2, "DECISION:MODEL-EQUIVOCATION:203", NOW), "TRUST_MODEL_EQUIVOCATION");
  const modelRollbackContent = await content(204), modelRollbackSignals = await signals(204, modelRollbackContent, { modelVersion: 1, modelCommitment: hash(219) });
  await expectCode(() => governanceLedger.evaluate(modelRollbackContent, modelRollbackSignals, policyV2, "DECISION:MODEL-ROLLBACK:204", NOW), "TRUST_MODEL_ROLLBACK_DENIED");
  const substitutedSameContentSignals = await signals(220, governanceContent, { modelVersion: 3, modelCommitment: hash(222) }), policyV3 = await policy(3);
  await expectCode(() => governanceLedger.evaluate(governanceContent, substitutedSameContentSignals, policyV3, "DECISION:SAME-CONTENT-SUBSTITUTION:200", NOW), "TRUST_DECISION_REPLAY");

  const policyRollbackAuthorization = await rollback({ authorizationId: "ROLLBACK:POLICY:001", domain: "POLICY", scopeKey: "POLICY:RO", fromId: policyV2.policyId, fromVersion: policyV2.version, fromCommitment: await trustObjectCommitment(policyV2), toId: policyV1.policyId, toVersion: policyV1.version, toCommitment: await trustObjectCommitment(policyV1), nonce: 1 });
  const authorizedPolicyContent = await content(205), authorizedPolicySignals = await signals(205, authorizedPolicyContent, { modelVersion: 2, modelCommitment: hash(220) });
  const authorizedPolicyReceipt = await governanceLedger.evaluate(authorizedPolicyContent, authorizedPolicySignals, policyV1, "DECISION:POLICY-AUTHORIZED:205", NOW, null, [policyRollbackAuthorization]);
  assert(authorizedPolicyReceipt.policyVersion === 1 && authorizedPolicyReceipt.rollbackAuthorizationCommitments.length === 1, "explicit policy rollback is exact bound and committed once");
  const governanceSnapshot = await governanceLedger.snapshot(), restoredGovernance = await AutomatedTrustLedger.restore(governanceSnapshot, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, governanceSnapshot.checkpointHash);
  const forwardPolicyContent = await content(206), forwardPolicySignals = await signals(206, forwardPolicyContent, { modelVersion: 2, modelCommitment: hash(220) });
  await restoredGovernance.evaluate(forwardPolicyContent, forwardPolicySignals, policyV2, "DECISION:POLICY-FORWARD:206", NOW);
  const restoredStaleContent = await content(207), restoredStaleSignals = await signals(207, restoredStaleContent, { modelVersion: 2, modelCommitment: hash(220) });
  await expectCode(() => restoredGovernance.evaluate(restoredStaleContent, restoredStaleSignals, policyV1, "DECISION:POLICY-RESTORE-DENY:207", NOW), "TRUST_POLICY_ROLLBACK_DENIED");
  await expectCode(() => restoredGovernance.evaluate(restoredStaleContent, restoredStaleSignals, policyV1, "DECISION:POLICY-REPLAY:207", NOW, null, [policyRollbackAuthorization]), "TRUST_ROLLBACK_REPLAY");
  const restoredAltContent = await content(208), restoredAltSignals = await signals(208, restoredAltContent, { modelVersion: 2, modelCommitment: hash(220) });
  await expectCode(() => restoredGovernance.evaluate(restoredAltContent, restoredAltSignals, alternatePolicyV2, "DECISION:POLICY-RESTORE-EQUIVOCATION:208", NOW), "TRUST_POLICY_EQUIVOCATION");

  const modelGovernanceLedger = newLedger(), modelHeadContent = await content(210), modelHeadSignals = await signals(210, modelHeadContent, { modelVersion: 2, modelCommitment: hash(230) });
  await modelGovernanceLedger.evaluate(modelHeadContent, modelHeadSignals, policyV1, "DECISION:MODEL-HEAD:210", NOW);
  const modelTargetContent = await content(211), modelTargetSignals = await signals(211, modelTargetContent, { modelVersion: 1, modelCommitment: hash(229) });
  await expectCode(() => modelGovernanceLedger.evaluate(modelTargetContent, modelTargetSignals, policyV1, "DECISION:MODEL-DENY:211", NOW), "TRUST_MODEL_ROLLBACK_DENIED");
  const modelRollbackAuthorization = await rollback({ authorizationId: "ROLLBACK:MODEL:002", domain: "MODEL_SET", scopeKey: "MODEL:RO:SOCIAL:PUBLIC_CONTENT_TRUST", fromId: modelHeadSignals.modelSetManifest.manifestId, fromVersion: modelHeadSignals.modelSetManifest.version, fromCommitment: await trustObjectCommitment(modelHeadSignals.modelSetManifest), toId: modelTargetSignals.modelSetManifest.manifestId, toVersion: modelTargetSignals.modelSetManifest.version, toCommitment: await trustObjectCommitment(modelTargetSignals.modelSetManifest), nonce: 2 });
  const modelAuthorizedReceipt = await modelGovernanceLedger.evaluate(modelTargetContent, modelTargetSignals, policyV1, "DECISION:MODEL-AUTHORIZED:211", NOW, null, [modelRollbackAuthorization]);
  assert(modelAuthorizedReceipt.modelSetVersion === 1 && modelAuthorizedReceipt.rollbackAuthorizationCommitments.length === 1, "explicit model rollback is exact bound and committed once");
  const modelGovernanceSnapshot = await modelGovernanceLedger.snapshot(), restoredModelGovernance = await AutomatedTrustLedger.restore(modelGovernanceSnapshot, authority, evidenceAuthority, modelAuthority, rollbackAuthority, registryAuthority, modelGovernanceSnapshot.checkpointHash);
  const modelForwardContent = await content(212), modelForwardSignals = await signals(212, modelForwardContent, { modelVersion: 2, modelCommitment: hash(230) });
  await restoredModelGovernance.evaluate(modelForwardContent, modelForwardSignals, policyV1, "DECISION:MODEL-FORWARD:212", NOW);
  const modelReplayContent = await content(213), modelReplaySignals = await signals(213, modelReplayContent, { modelVersion: 1, modelCommitment: hash(229) });
  await expectCode(() => restoredModelGovernance.evaluate(modelReplayContent, modelReplaySignals, policyV1, "DECISION:MODEL-RESTORE-DENY:213", NOW), "TRUST_MODEL_ROLLBACK_DENIED");
  await expectCode(() => restoredModelGovernance.evaluate(modelReplayContent, modelReplaySignals, policyV1, "DECISION:MODEL-REPLAY:213", NOW, null, [modelRollbackAuthorization]), "TRUST_ROLLBACK_REPLAY");

  const projection = ledger.projection();
  assert(projection.rewardsAccrued === 0 && projection.organicEvents === 0, "SYSTEM_TEST decisions produce no rewards or organic events");
  process.stdout.write(JSON.stringify({
    schema_version: 1, task_id: "NX-TRUST-P01", status: "PASS", assertions,
    corpus: { surfaces: corpus.map(row => row[0]), coverage_percent: 100, ordinary_human_preapproval_required: false },
    outcomes: projection.outcomes,
    automation: { single_probabilistic_signal_final_takedown: false, independent_vote_threshold: 2, immutable_match_only_final_block: true, immutable_evidence_independent_authority: true },
    presentation: { separate_axes: true, calibrated_ai_range_only: true, universal_truth_score: false, honesty_score: false, ideology_score: false, attractiveness_score: false },
    political_integrity: { viewpoint_parity: true, opinion_inference: false, sensitive_targeting: false, paid_ad_transparency: true },
    receipts: { exact_binding: true, signed: true, ordered_lineage: true, one_time: true, restore: true, appeal_route: true, trust_registry_bound: true, governance_heads_restored: true },
    governance: { distinct_authority_roots: true, policy_monotonic: true, policy_equivocation_denied: true, model_manifest_signed: true, model_monotonic: true, model_equivocation_denied: true, explicit_rollback_one_time: true, rollback_state_restored: true },
    negative: { exact_shape: true, boolean_string: true, binding_substitution: true, policy_expiry: true, signal_expiry: true, signal_pre_creation: true, evidence_after_signal: true, evidence_expiry_bound: true, rogue_evidence_authority: true, evidence_content_substitution: true, authority_colocation: true, inactive_root: true, trust_root_substitution: true, policy_rollback: true, policy_equivocation: true, model_rollback: true, model_equivocation: true, same_content_model_substitution: true, rollback_replay_after_restore: true, canonical_normalization: true, replay: true, concurrent_duplicate: true, snapshot_prefix: true, snapshot_reorder: true, snapshot_fabrication: true, restore_toctou: true },
    synthetic_isolation: { actor_class: "SYSTEM_TEST", rewards_accrued: 0, organic_events: 0 },
    network_operations: 0, provider_operations: 0, economic_operations: 0, real_fund_operations: 0, incremental_cost: { amount: 0, currency: "EUR" }
  }));
}

void main().catch(error => { process.stderr.write(error instanceof Error ? (error.stack ?? error.message) : String(error)); process.exitCode = 1; });
