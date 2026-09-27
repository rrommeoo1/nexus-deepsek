import { DEFAULT_PAYMENT_POLICY, DirectPaymentLedger, LocalXMoneyReconciler, PaymentCapability, PaymentPolicyError, ResolutionReceipt, authorizePayment, buildDevnetEsdtTransferDraft, normalizePaymentAlias, validatePaymentPolicy, verifyResolution } from "./index";
declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof PaymentPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
function json(value: unknown): unknown { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)); }
const H = "a".repeat(64), TX = "b".repeat(64), OTHER_TX = "c".repeat(64), NOW = "2026-08-09T12:00:00Z";
const SENDER = "erd1kyaqzaprcdnv4luvanah0gfxzzsnpaygsy6pytrexll2urtd05ts9vegu7";
const RECEIVER = "erd1r69gk66fmedhhcg24g2c5kn2f2a5k4kvpr6jfw67dn2lyydd8cfswy6ede";
const preview = { alias: "@ana", senderProfileId: "PROFILE:SENDER", senderAddress: SENDER, network: "devnet" as const, tokenId: "USDC-350c4e", tokenDecimals: 6, atomicAmount: 1n };
const alias = { alias: "@ana", aliasVersion: 7, receiverAddress: RECEIVER, network: "devnet" as const, status: "ACTIVE" as const };
function capability(overrides: Partial<PaymentCapability> = {}): PaymentCapability { return { schemaVersion: 1, subjectProfileId: "PROFILE:SENDER", countryCode: "RO", network: "devnet", tokenId: "USDC-350c4e", tokenDecimals: 6, maxAtomicAmount: 1n, directTransferAllowed: true, merchantCheckoutAllowed: true, sanctionsClear: true, transactionMonitoringClear: true, policyHash: DEFAULT_PAYMENT_POLICY.policyHash, issuedAt: "2026-08-09T11:00:00Z", expiresAt: "2026-08-09T13:00:00Z", issuerKeyId: "POLICY:LOCAL:1", signature: H, ...overrides }; }
const capabilityVerifier = { verify: (candidate: Readonly<PaymentCapability>) => candidate.signature === H && candidate.countryCode === "RO" };
const authorization = authorizePayment(preview, "MULTIVERSX_DIRECT", capability(), capabilityVerifier, NOW);
const receipt: ResolutionReceipt = { schemaVersion: 1, receiptId: "RECEIPT:PAY:1", aliasHash: H, aliasVersion: 7, senderProfileId: "PROFILE:SENDER", senderAddress: SENDER, receiverAddress: RECEIVER, network: "devnet", tokenId: "USDC-350c4e", tokenDecimals: 6, atomicAmount: 1n, policyHash: DEFAULT_PAYMENT_POLICY.policyHash, issuedAt: "2026-08-09T11:59:00Z", expiresAt: "2026-08-09T12:01:00Z", resolverKeyId: "RESOLVER:LOCAL:1", signature: H };
const resolutionVerifier = { verifyReceipt: (candidate: Readonly<ResolutionReceipt>, normalizedAlias: string) => candidate.signature === H && candidate.aliasHash === H && normalizedAlias === "@ana", verifyAddress: (address: string) => address === SENDER || address === RECEIVER };
const webhookVerifier = { verify: (event: Readonly<{ signature: string }>) => event.signature === H };
const observation = { txHash: TX, network: "devnet" as const, tokenId: "USDC-350c4e", senderAddress: SENDER, receiverAddress: RECEIVER, senderDeltaAtomic: -1n, receiverDeltaAtomic: 1n, chainStatus: "SUCCESS" as const, blockNonce: 123n, indexedAt: "2026-08-09T12:00:10Z" };
const observationVerifier = { verify: (candidate: Readonly<typeof observation>) => candidate.txHash === TX && candidate.blockNonce === 123n };

function main(): void {
  assert(normalizePaymentAlias("@ana") === "@ana", "canonical ASCII alias passes");
  for (const invalid of ["@Ana", "@аna", "@anа", "ana", "@a", "@ana💰"]) expectCode(() => normalizePaymentAlias(invalid), "ALIAS_INVALID");

  const policy = validatePaymentPolicy(DEFAULT_PAYMENT_POLICY, NOW);
  assert(Object.isFrozen(policy) && policy.realValueCap === 0 && policy.tokenId === "USDC-350c4e" && policy.maxAtomicAmount === 1n, "zero-real-value Devnet token policy is canonical");
  expectCode(() => validatePaymentPolicy({ ...DEFAULT_PAYMENT_POLICY, maxAtomicAmount: 999n }, NOW), "PAYMENT_POLICY_HASH_CONTENT_MISMATCH");
  expectCode(() => validatePaymentPolicy(DEFAULT_PAYMENT_POLICY, "2027-08-01T00:00:00Z"), "PAYMENT_POLICY_NOT_ACTIVE");
  expectCode(() => validatePaymentPolicy({ ...DEFAULT_PAYMENT_POLICY, extra: true }, NOW), "PAYMENT_POLICY_INVALID");

  assert(authorization.rail === "MULTIVERSX_DIRECT" && authorization.atomicAmount === preview.atomicAmount, "signed country capability authorizes exact direct transfer");
  expectCode(() => authorizePayment(preview, "ADMIN", capability(), capabilityVerifier, NOW), "PAYMENT_RAIL_INVALID");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ sanctionsClear: false }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_DENIED");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ transactionMonitoringClear: false }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_DENIED");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ directTransferAllowed: false }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_DENIED");
  expectCode(() => authorizePayment(preview, "XMONEY_MERCHANT", capability({ merchantCheckoutAllowed: false }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_DENIED");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ subjectProfileId: "PROFILE:OTHER" }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_BINDING_MISMATCH");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ countryCode: "ZZ" }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_SIGNATURE_INVALID");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ signature: OTHER_TX }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_SIGNATURE_INVALID");
  expectCode(() => authorizePayment({ ...preview, atomicAmount: DEFAULT_PAYMENT_POLICY.maxAtomicAmount + 1n }, "MULTIVERSX_DIRECT", capability({ maxAtomicAmount: DEFAULT_PAYMENT_POLICY.maxAtomicAmount + 1n }), capabilityVerifier, NOW), "PAYMENT_POLICY_DENIED");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", capability({ expiresAt: NOW }), capabilityVerifier, NOW), "PAYMENT_CAPABILITY_NOT_ACTIVE");
  expectCode(() => authorizePayment(preview, "MULTIVERSX_DIRECT", { ...capability(), sanctionsClear: "false" }, capabilityVerifier, NOW), "PAYMENT_CAPABILITY_INVALID");

  const verified = verifyResolution(receipt, preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW);
  assert(Object.isFrozen(verified) && verified.receiverAddress === RECEIVER, "resolution binds capability alias recipient and receipt");
  expectCode(() => verifyResolution(receipt, preview, { ...alias, aliasVersion: 8 }, authorization, resolutionVerifier, capabilityVerifier, NOW), "ALIAS_STALE_OR_SUBSTITUTED");
  expectCode(() => verifyResolution(receipt, preview, { ...alias, receiverAddress: SENDER }, authorization, resolutionVerifier, capabilityVerifier, NOW), "ALIAS_STALE_OR_SUBSTITUTED");
  expectCode(() => verifyResolution(receipt, { ...preview, atomicAmount: 2n }, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "PREVIEW_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, { ...preview, tokenDecimals: 18 }, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "PREVIEW_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, { ...preview, senderAddress: RECEIVER }, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "PREVIEW_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, preview, alias, { ...authorization, atomicAmount: 2n }, resolutionVerifier, capabilityVerifier, NOW), "AUTHORIZATION_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, preview, alias, { ...authorization, countryCode: "ZZ" }, resolutionVerifier, capabilityVerifier, NOW), "AUTHORIZATION_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, preview, alias, { ...authorization, capability: { ...authorization.capability, signature: OTHER_TX } }, resolutionVerifier, capabilityVerifier, NOW), "PAYMENT_CAPABILITY_SIGNATURE_INVALID");
  expectCode(() => verifyResolution(receipt, preview, alias, { ...authorization, capability: { ...authorization.capability, expiresAt: NOW } }, resolutionVerifier, capabilityVerifier, NOW), "PAYMENT_CAPABILITY_NOT_ACTIVE");
  expectCode(() => verifyResolution(receipt, preview, alias, { ...authorization, authorizedAt: "2020-01-01T00:00:00Z" }, resolutionVerifier, capabilityVerifier, NOW), "AUTHORIZATION_BINDING_MISMATCH");
  expectCode(() => verifyResolution(receipt, preview, alias, authorization, resolutionVerifier, capabilityVerifier, "2026-08-09T12:01:00Z"), "RESOLUTION_EXPIRED");
  expectCode(() => verifyResolution({ ...receipt, expiresAt: "2026-08-09T12:02:00Z" }, preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "RESOLUTION_LIFETIME_EXCEEDED");
  expectCode(() => verifyResolution(receipt, preview, { ...alias, status: "REVOKED" }, authorization, resolutionVerifier, capabilityVerifier, NOW), "ALIAS_REVOKED");
  expectCode(() => verifyResolution(receipt, preview, alias, authorization, { ...resolutionVerifier, verifyReceipt: () => false }, capabilityVerifier, NOW), "RESOLUTION_SIGNATURE_INVALID");
  expectCode(() => verifyResolution(receipt, preview, alias, authorization, { ...resolutionVerifier, verifyAddress: () => false }, capabilityVerifier, NOW), "RESOLUTION_SIGNATURE_INVALID");
  expectCode(() => verifyResolution({ ...receipt, atomicAmount: "1" }, preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "AMOUNT_INVALID");
  expectCode(() => verifyResolution({ ...receipt, extra: true }, preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "RESOLUTION_RECEIPT_INVALID");
  const getterReceipt = { ...receipt }; Object.defineProperty(getterReceipt, "signature", { enumerable: true, get: () => H });
  expectCode(() => verifyResolution(getterReceipt, preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "RESOLUTION_RECEIPT_INVALID");
  expectCode(() => verifyResolution(new Proxy({ ...receipt }, { ownKeys: () => { throw new Error("trap"); } }), preview, alias, authorization, resolutionVerifier, capabilityVerifier, NOW), "RESOLUTION_RECEIPT_INVALID");

  const draft = buildDevnetEsdtTransferDraft(verified, 9n);
  assert(draft.chainId === "D" && draft.sender === SENDER && draft.receiver === RECEIVER && draft.value === "0" && draft.data.startsWith("ESDTTransfer@"), "devnet ESDT draft binds signed receipt with zero native value");
  expectCode(() => buildDevnetEsdtTransferDraft({ ...receipt, tokenId: "EGLD", tokenDecimals: 18 }, 9n), "ESDT_DRAFT_INVALID");
  expectCode(() => buildDevnetEsdtTransferDraft(receipt, -1n), "NONCE_INVALID");

  const direct = new DirectPaymentLedger(); direct.create("PAYMENT:DIRECT:1", verified);
  assert(direct.transition("PAYMENT:DIRECT:1", "EVENT:SIGN:1", "SIGNED", verified).state === "SIGNED", "signature is distinct from submit");
  assert(direct.transition("PAYMENT:DIRECT:1", "EVENT:SUBMIT:1", "SUBMITTED", verified, TX).state === "SUBMITTED", "submitted is not final success");
  expectCode(() => direct.transition("PAYMENT:DIRECT:1", "EVENT:ORDER:BAD", "ORDERED", verified, OTHER_TX), "TX_HASH_SUBSTITUTED");
  assert(direct.transition("PAYMENT:DIRECT:1", "EVENT:ORDER:1", "ORDERED", verified, TX).state === "ORDERED", "ordered retains the submitted tx hash");
  expectCode(() => direct.reconcileExecution("PAYMENT:DIRECT:1", "EVENT:EXEC:UNVERIFIED", verified, observation, { verify: () => false }), "CHAIN_OBSERVATION_UNVERIFIED");
  expectCode(() => direct.reconcileExecution("PAYMENT:DIRECT:1", "EVENT:EXEC:BAD", verified, { ...observation, receiverDeltaAtomic: 0n }, observationVerifier), "CHAIN_EFFECT_MISMATCH");
  const executed = direct.reconcileExecution("PAYMENT:DIRECT:1", "EVENT:EXEC:1", verified, observation, observationVerifier);
  assert(executed.state === "EXECUTED_SUCCESS" && executed.txHash === TX, "exact indexed balance effects produce final success");
  expectCode(() => direct.transition("PAYMENT:DIRECT:1", "EVENT:AFTER:1", "FAILED_TERMINAL", verified, null, "CHAIN:FAIL"), "PAYMENT_TRANSITION_INVALID");
  const restoredDirect = DirectPaymentLedger.restore(direct.snapshot(), observationVerifier);
  assert(restoredDirect.get("PAYMENT:DIRECT:1").state === "EXECUTED_SUCCESS", "direct ledger survives snapshot restore");
  expectCode(() => restoredDirect.reconcileExecution("PAYMENT:DIRECT:1", "EVENT:EXEC:1", verified, observation, observationVerifier), "PAYMENT_EVENT_REPLAY");
  expectCode(() => DirectPaymentLedger.restore({ ...direct.snapshot(), events: [] }, observationVerifier), "DIRECT_SNAPSHOT_INVALID");
  const phantomDirect = direct.snapshot(); expectCode(() => DirectPaymentLedger.restore({ ...phantomDirect, events: [...phantomDirect.events, { ...phantomDirect.events[0], eventId: "EVENT:PHANTOM", ordinal: 5 }] }, observationVerifier), "DIRECT_SNAPSHOT_INVALID");
  expectCode(() => DirectPaymentLedger.restore({ ...direct.snapshot(), events: direct.snapshot().events.map((event, index) => index === 0 ? { ...event, fingerprint: "fabricated" } : event) }, observationVerifier), "DIRECT_SNAPSHOT_INVALID");
  expectCode(() => DirectPaymentLedger.restore({ ...direct.snapshot(), events: direct.snapshot().events.map((event) => event.nextState === "EXECUTED_SUCCESS" ? { ...event, observation: null } : event) }, observationVerifier), "DIRECT_SNAPSHOT_INVALID");
  expectCode(() => DirectPaymentLedger.restore(direct.snapshot(), { verify: () => false }), "DIRECT_SNAPSHOT_INVALID");
  const substituted = new DirectPaymentLedger(); substituted.create("PAYMENT:DIRECT:2", verified);
  expectCode(() => substituted.transition("PAYMENT:DIRECT:2", "EVENT:SUB:RECEIPT", "SIGNED", { ...receipt, atomicAmount: 2n }), "PAYMENT_RECEIPT_SUBSTITUTED");
  expectCode(() => DirectPaymentLedger.restore({ ...direct.snapshot(), records: [{ ...(direct.snapshot().records[0] as object), state: "EXECUTED_SUCCESS", txHash: null }] }, observationVerifier), "DIRECT_SNAPSHOT_INVALID");

  const xmoney = new LocalXMoneyReconciler();
  const orderInput = { nexusPaymentId: "PAYMENT:XMONEY:1", idempotencyKey: "IDEMPOTENCY:PAYMENT:1", atomicAmount: 10_000n, currency: "USDC" };
  const order = xmoney.createOrder(orderInput), sameOrder = xmoney.createOrder(orderInput);
  assert(order.orderId === sameOrder.orderId, "idempotent order create returns same order");
  expectCode(() => xmoney.createOrder({ ...orderInput, atomicAmount: 10_001n }), "XMONEY_IDEMPOTENCY_CONFLICT");
  const paidEvent = { eventId: "XMONEY:EVENT:PAID", orderId: order.orderId, state: "PAID" as const, occurredAt: NOW, signature: H };
  const paid = xmoney.applyWebhook(paidEvent, webhookVerifier, NOW);
  assert(paid.creditedNow && paid.order.state === "PAID", "first verified paid fact credits exactly once");
  const delayed = xmoney.applyWebhook({ eventId: "XMONEY:EVENT:PENDING", orderId: order.orderId, state: "PENDING", occurredAt: "2026-08-09T11:00:00Z", signature: H }, webhookVerifier, NOW);
  assert(!delayed.creditedNow && delayed.order.state === "PAID", "delayed lower fact cannot roll back paid");
  const duplicate = xmoney.applyWebhook(paidEvent, webhookVerifier, NOW);
  assert(duplicate.duplicate && !duplicate.creditedNow, "identical duplicate webhook cannot double credit");
  expectCode(() => xmoney.applyWebhook({ ...paidEvent, state: "FAILED" }, webhookVerifier, NOW), "XMONEY_EVENT_COLLISION");
  const refund = xmoney.applyWebhook({ eventId: "XMONEY:EVENT:REFUND", orderId: order.orderId, state: "REFUNDED", occurredAt: "2026-08-09T12:02:00Z", signature: H }, webhookVerifier, "2026-08-09T12:02:00Z");
  assert(refund.order.state === "REFUNDED" && !refund.order.credited, "refund removes credited projection once");
  const xmoneyRestored = LocalXMoneyReconciler.restore(xmoney.snapshot(), webhookVerifier);
  assert(xmoneyRestored.get(order.orderId).state === "REFUNDED", "xMoney reducer survives restart");
  assert(xmoneyRestored.applyWebhook(paidEvent, webhookVerifier, NOW).duplicate, "webhook replay remains denied after restart");
  const outOfOrder = new LocalXMoneyReconciler(), outOrder = outOfOrder.createOrder({ nexusPaymentId: "PAYMENT:XMONEY:2", idempotencyKey: "IDEMPOTENCY:PAYMENT:2", atomicAmount: 5_000n, currency: "USDC" });
  outOfOrder.applyWebhook({ eventId: "XMONEY:EVENT:REFUND:FIRST", orderId: outOrder.orderId, state: "REFUNDED", occurredAt: NOW, signature: H }, webhookVerifier, NOW);
  const paidAfterRefund = outOfOrder.applyWebhook({ eventId: "XMONEY:EVENT:PAID:LATE", orderId: outOrder.orderId, state: "PAID", occurredAt: "2026-08-09T11:59:00Z", signature: H }, webhookVerifier, NOW);
  assert(paidAfterRefund.order.state === "REFUNDED" && !paidAfterRefund.creditedNow && !paidAfterRefund.order.credited, "out-of-order refund and paid facts converge without credit");
  expectCode(() => xmoney.applyWebhook({ eventId: "XMONEY:EVENT:FORGED", orderId: order.orderId, state: "PAID", occurredAt: NOW, signature: OTHER_TX }, webhookVerifier, NOW), "XMONEY_SIGNATURE_INVALID");
  expectCode(() => xmoney.applyWebhook({ eventId: "XMONEY:EVENT:FUTURE", orderId: order.orderId, state: "PAID", occurredAt: "2026-08-09T12:06:00Z", signature: H }, webhookVerifier, NOW), "XMONEY_EVENT_FROM_FUTURE");
  expectCode(() => LocalXMoneyReconciler.restore({ ...xmoney.snapshot(), orders: [{ ...(xmoney.snapshot().orders[0] as object), credited: true }] }, webhookVerifier), "XMONEY_SNAPSHOT_INVALID");
  expectCode(() => LocalXMoneyReconciler.restore({ ...xmoney.snapshot(), sequence: 0 }, webhookVerifier), "XMONEY_SNAPSHOT_INVALID");
  expectCode(() => LocalXMoneyReconciler.restore({ ...xmoney.snapshot(), events: [] }, webhookVerifier), "XMONEY_SNAPSHOT_INVALID");
  const phantomXMoney = xmoney.snapshot(); expectCode(() => LocalXMoneyReconciler.restore({ ...phantomXMoney, events: [...phantomXMoney.events, { ...phantomXMoney.events[0], eventId: "XMONEY:EVENT:PHANTOM", orderId: "XMONEY:ORDER:UNKNOWN" }] }, webhookVerifier), "XMONEY_SNAPSHOT_INVALID");
  expectCode(() => LocalXMoneyReconciler.restore(xmoney.snapshot(), { verify: () => false }), "XMONEY_SNAPSHOT_INVALID");

  process.stdout.write(JSON.stringify(json({ schema_version: 1, task_id: "NX-PAY-P01", status: "PASS", assertions, policy: { hash: policy.policyHash, real_value_cap: policy.realValueCap, token_id: policy.tokenId }, resolution: verified, draft, direct_final: restoredDirect.get("PAYMENT:DIRECT:1"), xmoney_final: xmoneyRestored.get(order.orderId), negative: { homoglyph_denied: true, default_deny_capability: true, stale_alias_denied: true, forged_and_stale_authorization_denied: true, receipt_substitution_denied: true, tx_hash_substitution_denied: true, wrong_decimals_denied: true, exact_balance_effect_required: true, duplicate_submit_survives_restart: true, direct_lineage_tamper_denied: true, idempotency_collision_denied: true, forged_webhook_denied: true, duplicate_webhook_no_credit: true, out_of_order_converges: true, xmoney_lineage_and_sequence_tamper_denied: true }, network_operations: 0, economic_operations: 0, external_provider_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } })));
}
main();
