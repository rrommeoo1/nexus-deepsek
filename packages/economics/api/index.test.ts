import { AdultCapability, DEFAULT_ECONOMIC_CONFIG, EconomicAuthorityVerifier, EconomicPolicyError, InMemoryAtomicClaimStore, PrincipalAttestation, SettlementClaimLedger, allocateCreatorPool, allocateNodePool, allocateSupport, assertConservation, assertOrganicSignal, closeTreasury, creatorPoolBudget, decideSponsorship, nodePoolBudget, qualifyEngagement, validateEconomicConfig } from "./index";
declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (e) { actual = e instanceof EconomicPolicyError ? e.code : String(e); } assert(actual === code, `expected ${code}, got ${actual}`); }
function json(value: unknown): unknown { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)); }
const H = "a".repeat(64), NOW = "2026-08-09T12:00:00Z", EPOCH = "EPOCH:2026-08";
const CORE_CONTEXT = { nowIso: NOW, epochId: EPOCH };
function att(subjectId: string, principalId = `PRINCIPAL:${subjectId}`, riskClusterId = `RISK:${subjectId}`): PrincipalAttestation { return { schemaVersion: 1, subjectId, principalId, riskClusterId, epochId: EPOCH, issuedAt: "2026-08-09T00:00:00Z", expiresAt: "2026-08-10T00:00:00Z", issuerKeyId: "ISSUER:LOCAL", proofHash: H, signature: H }; }
const verifier: EconomicAuthorityVerifier = { verifyCreator: (a, epoch, config, receipt) => a.signature === H && epoch === EPOCH && config === DEFAULT_ECONOMIC_CONFIG.configHash && receipt === H, verifyContribution: (a, _creator, config) => a.signature === H && a.epochId === EPOCH && config === DEFAULT_ECONOMIC_CONFIG.configHash, verifyNode: (a, epoch, config, receipt) => a.signature === H && epoch === EPOCH && config === DEFAULT_ECONOMIC_CONFIG.configHash && receipt === H, verifyBudget: (s) => s.signature === H, verifyAdult: (c) => c.signature === H };
const denyVerifier: EconomicAuthorityVerifier = { verifyCreator: () => false, verifyContribution: () => false, verifyNode: () => false, verifyBudget: () => false, verifyAdult: () => false };
function creator(creatorId: string, principalId?: string, riskClusterId?: string) { return { creatorId, actorClass: "HUMAN" as const, qeu: 100n, eligible: true, attestation: att(creatorId, principalId, riskClusterId), qualificationReceiptHash: H }; }
function node(nodeId: string, principalId?: string, riskClusterId?: string) { return { nodeId, verifiedUnitValueMicros: 100n, availabilityBps: 10_000, qualityBps: 10_000, diversityBps: 10_000, receiptValid: true, attestation: att(nodeId, principalId, riskClusterId), serviceReceiptHash: H }; }
function budget(revenue: bigint, spent: bigint, acquisition = 0n) { return { schemaVersion: 1, epochId: EPOCH, configHash: DEFAULT_ECONOMIC_CONFIG.configHash, eligibleNetRevenueMicros: revenue, acquisitionBudgetMicros: acquisition, spentMicrosEur: spent, issuedAt: "2026-08-09T00:00:00Z", expiresAt: "2026-08-10T00:00:00Z", issuerKeyId: "ISSUER:LOCAL", signature: H }; }
function gas(priority: "LIKE" | "COMMENT" | "SUPPORT" | "SAFETY" | "FINANCIAL", estimated: bigint, quota = 1, userPaysGas = false) { return { priority, estimatedGasMicrosEur: estimated, remainingUserQuota: quota, userPaysGas }; }
function adult(allocationId: string, overrides: Partial<AdultCapability> = {}): AdultCapability { return { schemaVersion: 1, subjectId: "PROFILE:ADULT", allocationId, countryCode: "RO", operation: "SETTLEMENT", configHash: DEFAULT_ECONOMIC_CONFIG.configHash, ageVerified: true, identityVerified: true, consentVerified: true, territoryAllowed: true, countryAllowed: true, legalMemoApproved: true, providerApproved: true, taxReportingReady: true, publicationAllowed: true, distributionChannel: "WEB", issuedAt: "2026-08-09T00:00:00Z", expiresAt: "2026-08-10T00:00:00Z", countryPolicyVersion: "POLICY:EU:1", issuerKeyId: "ISSUER:LOCAL", signature: H, ...overrides }; }
function priveContext(allocationId: string, overrides: Partial<AdultCapability> = {}, contextOverrides: Record<string, unknown> = {}) { return { nowIso: NOW, epochId: EPOCH, profileId: "PROFILE:ADULT", countryCode: "RO", operation: "SETTLEMENT", adultCapability: adult(allocationId, overrides), verifier, ...contextOverrides }; }
function charge(amountMicros: bigint, status: "CONFIRMED" | "FROZEN" | "REVERSED" = "FROZEN") { return { id: `DEDUCTION:${amountMicros}:${status}`, type: "CHARGEBACK" as const, amountMicros, receiptHash: H, status }; }
function contribution(supporterPrincipalId: string, deviceClusterId: string, walletClusterId: string, rawQeu = 100n, actorClass: "HUMAN" | "SYSTEM_TEST" | "AGENT" = "HUMAN") { return { creatorPrincipalId: "PRINCIPAL:CREATOR", rawQeu, actorClass, eligible: true, attestation: { schemaVersion: 1, supporterPrincipalId, deviceClusterId, walletClusterId, epochId: EPOCH, issuedAt: "2026-08-09T00:00:00Z", expiresAt: "2026-08-10T00:00:00Z", issuerKeyId: "ISSUER:LOCAL", proofHash: H, signature: H } }; }

function main(): void {
  const canonical = validateEconomicConfig(DEFAULT_ECONOMIC_CONFIG, NOW);
  assert(canonical.schemaVersion === 1 && Object.isFrozen(canonical) && Object.isFrozen(canonical.splits.CORE_TIP), "config snapshot is canonical and deeply frozen");
  const mutable = { ...DEFAULT_ECONOMIC_CONFIG, splits: { ...DEFAULT_ECONOMIC_CONFIG.splits, CORE_TIP: { ...DEFAULT_ECONOMIC_CONFIG.splits.CORE_TIP } } };
  const cloned = validateEconomicConfig(mutable); mutable.splits.CORE_TIP.creator = 1;
  assert(cloned.splits.CORE_TIP.creator === 9000, "post-validation mutation cannot drift canonical config");
  expectCode(() => validateEconomicConfig({ ...DEFAULT_ECONOMIC_CONFIG, extra: 1 }), "CONFIG_SHAPE_INVALID");
  expectCode(() => validateEconomicConfig({ ...DEFAULT_ECONOMIC_CONFIG, sponsoredGasHardCapBps: 801 }), "GAS_CAP_INVALID");
  expectCode(() => validateEconomicConfig({ ...DEFAULT_ECONOMIC_CONFIG, creatorPoolRevenueBps: 2001 }), "CONFIG_HARD_CAP_EXCEEDED");
  expectCode(() => validateEconomicConfig({ ...DEFAULT_ECONOMIC_CONFIG, splits: { ...DEFAULT_ECONOMIC_CONFIG.splits, CORE_TIP: { ...DEFAULT_ECONOMIC_CONFIG.splits.CORE_TIP, creator: 8999 } } }), "SPLIT_NOT_CONSERVATIVE");
  const getterConfig = { ...DEFAULT_ECONOMIC_CONFIG }; Object.defineProperty(getterConfig, "configHash", { enumerable: true, get: () => DEFAULT_ECONOMIC_CONFIG.configHash });
  expectCode(() => validateEconomicConfig(getterConfig), "CONFIG_SHAPE_INVALID");
  expectCode(() => validateEconomicConfig(new Proxy({ ...DEFAULT_ECONOMIC_CONFIG }, { ownKeys: () => { throw new Error("trap"); } })), "CONFIG_SHAPE_INVALID");
  const spoofedConfig = { ...DEFAULT_ECONOMIC_CONFIG, splits: { ...DEFAULT_ECONOMIC_CONFIG.splits, CORE_TIP: { creator: 10_000, platform: 0, safetyReserve: 0, infrastructure: 0 } } };
  expectCode(() => allocateSupport("CORE_TIP", 100n, [], "ALLOC:CONFIG:SPOOF", CORE_CONTEXT, spoofedConfig), "CONFIG_HASH_CONTENT_MISMATCH");
  expectCode(() => allocateSupport("CORE_TIP", 100n, [], "ALLOC:CONFIG:EXPIRED", { nowIso: "2027-08-01T00:00:00Z", epochId: EPOCH }), "CONFIG_NOT_ACTIVE");

  const deductions = [{ id: "DEDUCTION:TAX:1", type: "TAX" as const, amountMicros: 2n, receiptHash: H, status: "CONFIRMED" as const }, charge(1n)];
  const tip = allocateSupport("CORE_TIP", 100_000_003n, deductions, "ALLOC:TIP:1", CORE_CONTEXT);
  assert(tip.netMicros === 100_000_000n && tip.creatorMicros === 90_000_000n, "deductions precede the exact core tip split");
  assert(tip.platformMicros === 5_000_000n && tip.safetyReserveMicros === 3_000_000n && tip.infrastructureMicros === 2_000_000n, "core tip split is 90/5/3/2");
  assert(tip.frozenMicros === 1n && assertConservation(tip), "only disputed deduction is frozen and support conserves");
  assert(tip.epochId === EPOCH && tip.effectiveAt === DEFAULT_ECONOMIC_CONFIG.effectiveAt && tip.configHash === DEFAULT_ECONOMIC_CONFIG.configHash, "support output binds epoch effective date and config hash");
  for (const rate of [100n, 500n, 1500n]) { const amount = 100_000n * rate / 10_000n; const coreId = `ALLOC:CORE:${rate}`, priveId = `ALLOC:PRIVE:${rate}`; const core = allocateSupport("CORE_TIP", 100_000n, [charge(amount)], coreId, CORE_CONTEXT); const prive = allocateSupport("PRIVE", 100_000n, [charge(amount)], priveId, priveContext(priveId)); assert(core.frozenMicros === amount && core.netMicros === 100_000n - amount && assertConservation(core), `core chargeback ${rate} bps`); assert(prive.frozenMicros === amount && prive.creatorMicros === prive.netMicros * 8000n / 10_000n && assertConservation(prive), `Prive chargeback ${rate} bps`); }
  const reversed = allocateSupport("CORE_TIP", 100n, [charge(15n, "REVERSED")], "ALLOC:REVERSED:1", CORE_CONTEXT);
  assert(reversed.netMicros === 100n && reversed.reversedMicros === 15n && reversed.frozenMicros === 0n, "reversed chargeback is released from deductions");
  expectCode(() => allocateSupport("CORE_TIP", 1n, [charge(2n)], "ALLOC:OVER:1", CORE_CONTEXT), "DEDUCTIONS_EXCEED_GROSS");
  expectCode(() => allocateSupport("BONUS", 1n, [], "ALLOC:BAD:1", CORE_CONTEXT), "SUPPORT_KIND_INVALID");
  expectCode(() => allocateSupport("CORE_TIP", 1n, [{ ...charge(1n), status: "FROZEN", extra: true }], "ALLOC:BAD:2", CORE_CONTEXT), "DEDUCTION_SHAPE_INVALID");

  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:NOGATE", undefined), "ADULT_CAPABILITY_REQUIRED");
  const gatedPrive = allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:OK", priveContext("ALLOC:PRIVE:OK"));
  assert(gatedPrive.creatorMicros === 80n && gatedPrive.platformMicros === 12n, "Prive 80/12/5/3 split requires valid signed gates");
  for (const gate of ["ageVerified", "identityVerified", "consentVerified", "territoryAllowed", "countryAllowed", "legalMemoApproved", "providerApproved", "taxReportingReady", "publicationAllowed"] as const) { const allocationId = `ALLOC:PRIVE:${gate.toUpperCase()}`; expectCode(() => allocateSupport("PRIVE", 100n, [], allocationId, priveContext(allocationId, { [gate]: false })), "ADULT_GATE_DENIED"); }
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:EXPIRED", priveContext("ALLOC:PRIVE:EXPIRED", { expiresAt: "2026-08-09T01:00:00Z" })), "ADULT_CAPABILITY_EXPIRED");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:CONFIG", priveContext("ALLOC:PRIVE:CONFIG", { configHash: "b".repeat(64) })), "ADULT_CONFIG_MISMATCH");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:SIG", priveContext("ALLOC:PRIVE:SIG", {}, { verifier: denyVerifier })), "ADULT_SIGNATURE_INVALID");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:STORE", priveContext("ALLOC:PRIVE:STORE", { distributionChannel: "APP_STORE" as "WEB" })), "ADULT_DISTRIBUTION_DENIED");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:PROFILE", priveContext("ALLOC:PRIVE:PROFILE", { subjectId: "PROFILE:UNRELATED" })), "ADULT_BINDING_MISMATCH");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:COUNTRY", priveContext("ALLOC:PRIVE:COUNTRY", { countryCode: "US" })), "ADULT_BINDING_MISMATCH");
  expectCode(() => allocateSupport("PRIVE", 100n, [], "ALLOC:PRIVE:OP", priveContext("ALLOC:PRIVE:OP", { operation: "QUOTE" })), "ADULT_BINDING_MISMATCH");

  assert(creatorPoolBudget(0n, NOW) === 0n && creatorPoolBudget(1_000_000n, NOW) === 150_000n, "creator pool is funded only from eligible revenue and capped at fifteen percent");
  assert(nodePoolBudget(0n, 1_000_000n, NOW) === 0n && nodePoolBudget(1_000_000n, 1_000_000n, NOW) === 100_000n, "node pool is funded only from eligible revenue and capped at ten percent");
  expectCode(() => creatorPoolBudget(1_000_000n, "2027-08-01T00:00:00Z"), "CONFIG_NOT_ACTIVE");
  expectCode(() => nodePoolBudget(1_000_000n, 1_000_000n, "2027-08-01T00:00:00Z"), "CONFIG_NOT_ACTIVE");
  const creators = allocateCreatorPool(100_000n, [creator("CREATOR:ALPHA"), creator("CREATOR:BETA")], EPOCH, verifier, NOW);
  assert(creators.claims.length === 2 && creators.claims.every((c) => c.amountMicros <= 5_000n) && assertConservation(creators), "verified humans receive capped conservative creator claims");
  assert(creators.epochId === EPOCH && creators.effectiveAt === DEFAULT_ECONOMIC_CONFIG.effectiveAt && creators.contractVersion === "1.0.0", "creator allocation binds epoch and effective config version");
  const aliasCreators = Array.from({ length: 20 }, (_v, i) => creator(`CREATOR:ALIAS:${i}`, "PRINCIPAL:ONE", "RISK:ONE"));
  const aliasPool = allocateCreatorPool(1_000_000n, aliasCreators, EPOCH, verifier, NOW);
  assert(aliasPool.claims.reduce((s, c) => s + c.amountMicros, 0n) <= 50_000n && aliasPool.remainderMicros >= 950_000n, "twenty aliases cannot bypass human or risk-cluster cap");
  const creatorWithFalseString = { ...creator("CREATOR:FALSE"), eligible: "false" };
  expectCode(() => allocateCreatorPool(100n, [creatorWithFalseString], EPOCH, verifier, NOW), "ELIGIBILITY_INVALID");
  expectCode(() => allocateCreatorPool(100n, [{ ...creator("CREATOR:QEU"), qeu: "100" }], EPOCH, verifier, NOW), "QEU_INVALID");
  expectCode(() => allocateCreatorPool(100n, [{ ...creator("CREATOR:ENUM"), actorClass: "ROBOT" }], EPOCH, verifier, NOW), "ACTOR_CLASS_INVALID");
  expectCode(() => allocateCreatorPool(100n, [{ ...creator("CREATOR:EXTRA"), extra: 1 }], EPOCH, verifier, NOW), "CREATOR_SHAPE_INVALID");
  expectCode(() => allocateCreatorPool(100n, [{ ...creator("CREATOR:DUP") }, { ...creator("CREATOR:DUP") }], EPOCH, verifier, NOW), "CREATOR_DUPLICATE");
  assert(allocateCreatorPool(100n, [creator("CREATOR:DENIED")], EPOCH, denyVerifier, NOW).claims.length === 0, "unverified creator attestation receives zero claim");
  const syntheticCreator = { ...creator("CREATOR:SYSTEM"), actorClass: "SYSTEM_TEST" as const };
  assert(allocateCreatorPool(100n, [syntheticCreator], EPOCH, verifier, NOW).claims.length === 0, "SYSTEM_TEST traffic receives zero creator claim");

  for (const sybilPercent of [1, 10, 40]) { const rows = Array.from({ length: 100 }, (_v, i) => contribution(`SUPPORTER:${i}`, `DEVICE:${i}`, `WALLET:${i}`, 10n, i < sybilPercent ? "AGENT" : "HUMAN")); const q = qualifyEngagement(rows, EPOCH, verifier, NOW); assert(q.rejectedQeu >= BigInt(sybilPercent * 10), `${sybilPercent}% Sybil traffic is excluded`); }
  const concentratedSupporter = qualifyEngagement(Array.from({ length: 5 }, (_v, i) => contribution("SUPPORTER:ONE", `DEVICE:${i}`, `WALLET:${i}`)), EPOCH, verifier, NOW);
  assert(concentratedSupporter.acceptedQeu === 100n && concentratedSupporter.rejectedQeu === 400n, "supporter cap blocks fan-out farming");
  const concentratedDevice = qualifyEngagement(Array.from({ length: 4 }, (_v, i) => contribution(`SUPPORTER:${i}`, "DEVICE:ONE", `WALLET:${i}`)), EPOCH, verifier, NOW);
  assert(concentratedDevice.acceptedQeu === 250n, "device cluster cap blocks device aliases");
  const concentratedWallet = qualifyEngagement(Array.from({ length: 4 }, (_v, i) => contribution(`SUPPORTER:${i}`, `DEVICE:${i}`, "WALLET:ONE")), EPOCH, verifier, NOW);
  assert(concentratedWallet.acceptedQeu === 200n, "wallet cluster cap blocks wallet aliases");
  assert(qualifyEngagement([contribution("SUPPORTER:DENIED", "DEVICE:DENIED", "WALLET:DENIED")], EPOCH, denyVerifier, NOW).acceptedQeu === 0n, "untrusted engagement attestation receives zero QEU");

  const nodes = allocateNodePool(100_000n, [node("NODE:ALPHA"), { ...node("NODE:BETA"), qualityBps: 5000 }], EPOCH, verifier, NOW);
  assert(nodes.claims.length === 2 && nodes.claims[0]!.amountMicros > nodes.claims[1]!.amountMicros && assertConservation(nodes), "verified service quality affects conservative node payout");
  expectCode(() => allocateNodePool(100n, [{ ...node("NODE:FALSE"), receiptValid: "false" }], EPOCH, verifier, NOW), "RECEIPT_VALIDITY_INVALID");
  assert(allocateNodePool(100n, [node("NODE:DENIED")], EPOCH, denyVerifier, NOW).claims.length === 0, "unverified service receipt receives zero node claim");
  const rotatedNodes = Array.from({ length: 8 }, (_v, i) => node(`NODE:ALIAS:${i}`, "OWNER:STABLE", "OWNER-RISK:STABLE"));
  const concentratedNodes = allocateNodePool(1_000_000n, rotatedNodes, EPOCH, verifier, NOW);
  assert(concentratedNodes.claims.reduce((s, c) => s + c.amountMicros, 0n) <= 150_000n && concentratedNodes.remainderMicros >= 850_000n, "node alias rotation cannot bypass verified owner-cluster cap");
  expectCode(() => allocateNodePool(1n, [{ ...node("NODE:FACTOR"), availabilityBps: 10_001 }], EPOCH, verifier, NOW), "NODE_FACTOR_INVALID");

  assert(decideSponsorship(gas("LIKE", 1n), budget(1_000n, 49n), verifier, NOW) === "SPONSORED", "ordinary action can spend below five-percent target");
  assert(decideSponsorship(gas("LIKE", 2n), budget(1_000n, 49n), verifier, NOW) === "PENDING_SPONSORSHIP", "ordinary action queues at target crossing");
  assert(decideSponsorship(gas("SAFETY", 20n, 0), budget(1_000n, 50n), verifier, NOW) === "SPONSORED", "safety action may use target-to-hard-cap reserve");
  assert(decideSponsorship(gas("FINANCIAL", 11n, 0), budget(1_000n, 70n), verifier, NOW) === "PENDING_SPONSORSHIP", "financial action queues at eight-percent hard-cap crossing");
  assert(decideSponsorship(gas("COMMENT", 1n, 0, true), budget(1_000n, 80n), verifier, NOW) === "USER_PAYS_GAS", "user may opt to pay gas after sponsorship exhaustion");
  assert(decideSponsorship(gas("LIKE", 5n), budget(0n, 5n, 10n), verifier, NOW) === "SPONSORED", "explicit signed acquisition budget funds zero-revenue onboarding");
  assert(decideSponsorship(gas("LIKE", 1n), budget(0n, 10n, 10n), verifier, NOW) === "PENDING_SPONSORSHIP", "zero-revenue acquisition budget cannot be exceeded");
  expectCode(() => decideSponsorship({ ...gas("LIKE", 1n), priority: "ADMIN" }, budget(1_000n, 0n), verifier, NOW), "GAS_PRIORITY_INVALID");
  expectCode(() => decideSponsorship(gas("LIKE", 1n), budget(1_000n, 0n), denyVerifier, NOW), "GAS_SNAPSHOT_UNTRUSTED");
  expectCode(() => decideSponsorship({ ...gas("LIKE", 1n), remainingUserQuota: -1 }, budget(1_000n, 0n), verifier, NOW), "GAS_QUOTA_INVALID");
  expectCode(() => decideSponsorship(gas("LIKE", 1n), { ...budget(1_000n, 0n), spentMicrosEur: "0" }, verifier, NOW), "GAS_SNAPSHOT_INVALID");

  const claimStore = new InMemoryAtomicClaimStore(); const ledger = new SettlementClaimLedger(100n, claimStore); const claimed = ledger.claim("ALLOC:LEDGER:1", EPOCH, "PRINCIPAL:ALPHA", 70n, "CLAIM:ONE");
  assert(claimed.amountMicros === 70n && ledger.conservation().availableMicros === 30n, "claim reserves a funded liability once");
  expectCode(() => ledger.claim("ALLOC:LEDGER:1", EPOCH, "PRINCIPAL:ALPHA", 70n, "CLAIM:TWO"), "CLAIM_REPLAY");
  const freshLedger = new SettlementClaimLedger(100n, claimStore);
  expectCode(() => freshLedger.claim("ALLOC:LEDGER:1", EPOCH, "PRINCIPAL:ALPHA", 70n, "CLAIM:FRESH"), "CLAIM_REPLAY");
  const restartedStore = InMemoryAtomicClaimStore.restore(claimStore.snapshot()); const restartedLedger = new SettlementClaimLedger(100n, restartedStore);
  expectCode(() => restartedLedger.claim("ALLOC:LEDGER:1", EPOCH, "PRINCIPAL:ALPHA", 70n, "CLAIM:RESTART"), "CLAIM_REPLAY");
  expectCode(() => ledger.claim("ALLOC:LEDGER:2", EPOCH, "PRINCIPAL:BETA", 31n, "CLAIM:THREE"), "RESERVE_INSUFFICIENT");
  const restored = SettlementClaimLedger.restore(ledger.snapshot());
  expectCode(() => restored.claim("ALLOC:LEDGER:1", EPOCH, "PRINCIPAL:ALPHA", 70n, "CLAIM:RESTORE"), "CLAIM_REPLAY");
  const duplicateSnapshot = ledger.snapshot() as { schemaVersion: 1; fundedPoolMicros: bigint; availableMicros: bigint; claims: unknown[] };
  expectCode(() => SettlementClaimLedger.restore({ ...duplicateSnapshot, claims: [...duplicateSnapshot.claims, duplicateSnapshot.claims[0]] }), "LEDGER_SNAPSHOT_INVALID");
  expectCode(() => SettlementClaimLedger.restore({ ...duplicateSnapshot, claims: [{ ...(duplicateSnapshot.claims[0] as object), state: "PAID" }] }), "LEDGER_SNAPSHOT_INVALID");
  expectCode(() => SettlementClaimLedger.restore({ ...duplicateSnapshot, claims: [{ ...(duplicateSnapshot.claims[0] as object), allocationId: "ALLOC:SUBSTITUTED" }] }), "LEDGER_SNAPSHOT_INVALID");
  restored.freeze("CLAIM:ONE", 20n); const partlyPaid = restored.settle("CLAIM:ONE");
  assert(partlyPaid.paidMicros === 50n && partlyPaid.frozenMicros === 20n && restored.conservation().outstandingMicros === 20n, "only disputed claim amount remains frozen");
  const released = SettlementClaimLedger.restore(restored.snapshot()); released.releaseFrozen("CLAIM:ONE");
  assert(released.conservation().paidMicros === 70n && released.conservation().outstandingMicros === 0n, "frozen amount can be released exactly once");
  expectCode(() => released.releaseFrozen("CLAIM:ONE"), "CLAIM_ALREADY_FINAL");
  const reversedLedger = new SettlementClaimLedger(100n); reversedLedger.claim("ALLOC:LEDGER:3", EPOCH, "PRINCIPAL:GAMMA", 80n, "CLAIM:FOUR"); reversedLedger.freeze("CLAIM:FOUR", 15n); reversedLedger.settle("CLAIM:FOUR"); reversedLedger.reverseFrozen("CLAIM:FOUR");
  const lc = reversedLedger.conservation(); assert(lc.fundedMicros === lc.availableMicros + lc.outstandingMicros + lc.paidMicros + lc.reversedMicros && lc.reversedMicros === 15n, "reversal preserves exact ledger liabilities");

  assert(assertOrganicSignal({ paidSupportMicros: 0n, promoted: false, actorClass: "HUMAN", qualifiedWeight: 7n }) === 7n, "qualified human signal enters organic rank");
  assert(assertOrganicSignal({ paidSupportMicros: 1n, promoted: false, actorClass: "HUMAN", qualifiedWeight: 7n }) === 0n, "paid support has zero organic weight");
  assert(assertOrganicSignal({ paidSupportMicros: 0n, promoted: true, actorClass: "HUMAN", qualifiedWeight: 7n }) === 0n, "promoted content has zero organic weight");
  assert(assertOrganicSignal({ paidSupportMicros: 0n, promoted: false, actorClass: "SYSTEM_TEST", qualifiedWeight: 7n }) === 0n, "SYSTEM_TEST has zero organic weight");
  assert(closeTreasury({ openingMicros: 100n, realizedRevenueMicros: 50n, confirmedPayoutsMicros: 50n, variableCostsMicros: 25n, addedReservesMicros: 25n }) === 50n, "treasury closes non-negative");
  expectCode(() => closeTreasury({ openingMicros: 0n, realizedRevenueMicros: 10n, confirmedPayoutsMicros: 11n, variableCostsMicros: 0n, addedReservesMicros: 0n }), "TREASURY_NEGATIVE");

  process.stdout.write(JSON.stringify(json({ schema_version: 1, task_id: "NX-ECON-P01", status: "PASS", assertions,
    support: tip, creator_pool: creators, node_pool: nodes,
    remediation: { runtime_exact: true, creator_alias_claimed_micros: aliasPool.claims.reduce((s, c) => s + c.amountMicros, 0n), node_alias_claimed_micros: concentratedNodes.claims.reduce((s, c) => s + c.amountMicros, 0n), gas_target_and_hard_cap: true, prive_all_gates: true, adult_binding_substitution_denied: true, typed_chargebacks: true, durable_claim_replay_denied: true, fresh_instance_and_restart_replay_denied: true, config_deep_immutable: true, config_hash_spoof_and_expiry_denied: true },
    stress: { zero_revenue_creator_pool: creatorPoolBudget(0n, NOW), zero_revenue_node_pool: nodePoolBudget(0n, 1_000_000n, NOW), gas_spike: "PENDING_SPONSORSHIP", fraud_creator_claims: 0, fraud_node_claims: 0, concentrated_cluster_claim_cap_micros: 150_000, negative_treasury_denied: true, expired_pool_config_denied: true },
    ranking: { paid_to_organic_weight: 0, promoted_to_organic_weight: 0, system_test_weight: 0 }, ledger: reversedLedger.conservation(),
    network_operations: 0, economic_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } })));
}
main();
