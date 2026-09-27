import {
  derivePkceChallenge,
  IdentityBrokerSandbox,
  IdentityPolicyError,
  IdentityStateRepositorySandbox,
  type Clock,
  type EntropySource,
  type ProviderClaims,
  type ProviderConfig,
  type ProviderVerifier,
  type RecoveryFactorVerifier,
  type RecoveryProofContext,
  type SocialProvider,
  type ThresholdWalletReceipt,
} from "./index";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(`ASSERT:${message}`);
}
async function expectCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> {
  let actual = "NO_ERROR";
  try { await action(); } catch (error) { actual = error instanceof IdentityPolicyError ? error.code : String(error); }
  assert(actual === code, `expected ${code}, got ${actual}`);
}

class TestClock implements Clock {
  constructor(private value: number) {}
  nowMs(): number { return this.value; }
  advance(ms: number): void { this.value += ms; }
}
class TestEntropy implements EntropySource {
  constructor(private counter = 0) {}
  next(label: "state" | "nonce" | "id"): string { this.counter += 1; return `${label}_${this.counter}_${"x".repeat(24)}`; }
}
class MockProviderVerifier implements ProviderVerifier {
  readonly claims = new Map<string, ProviderClaims>();
  calls = 0;
  async verify(_provider: SocialProvider, opaqueToken: string): Promise<ProviderClaims> {
    this.calls += 1;
    const claims = this.claims.get(opaqueToken);
    if (!claims) throw new IdentityPolicyError("PROVIDER_TOKEN_INVALID");
    return { ...claims };
  }
}
class MockFactorVerifier implements RecoveryFactorVerifier {
  async verify(publicRef: string, proof: string, context: RecoveryProofContext): Promise<boolean> {
    return proof === `valid:${publicRef}:${context.challengeId}:${context.purpose}:${context.nonce}:${context.keyVersion}:${context.verifierDomain}`;
  }
}

async function main(): Promise<void> {
const configs: ProviderConfig[] = [
  { provider: "GOOGLE", issuer: "https://accounts.google.test", audience: "nexus-google-sandbox", redirectUri: "https://local.invalid/auth/google", enabled: true },
  { provider: "APPLE", issuer: "https://appleid.apple.test", audience: "nexus-apple-sandbox", redirectUri: "https://local.invalid/auth/apple", enabled: true },
  { provider: "FACEBOOK", issuer: "https://facebook.test", audience: "nexus-facebook-sandbox", redirectUri: "https://local.invalid/auth/facebook", enabled: false },
];
const clock = new TestClock(1_000_000);
const providers = new MockProviderVerifier();
const broker = new IdentityBrokerSandbox(configs, providers, new MockFactorVerifier(), clock, new TestEntropy(), 300_000, 3_600_000);
const verifier = "v".repeat(64);
const pkce = await derivePkceChallenge(verifier);

async function login(provider: "GOOGLE" | "APPLE", token: string, subject: string, email: string) {
  const challenge = await broker.startSocialLogin(provider, pkce);
  const config = configs.find((candidate) => candidate.provider === provider)!;
  providers.claims.set(token, { issuer: config.issuer, audience: config.audience, subject, email, nonce: challenge.nonce, redirectUri: config.redirectUri, expiresAtMs: clock.nowMs() + 60_000 });
  return { challenge, result: await broker.completeSocialLogin(provider, token, challenge.state, verifier) };
}

const first = await login("GOOGLE", "opaque-token-one", "provider-subject-one", "shared@example.invalid");
assert(first.result.accountCreated, "first identity creates account");
const second = await login("APPLE", "opaque-token-two", "provider-subject-two", "shared@example.invalid");
assert(second.result.accountCreated, "same email at another issuer creates another account");
assert(first.result.accountId !== second.result.accountId, "email equality never merges accounts");
const repeat = await login("GOOGLE", "opaque-token-repeat", "provider-subject-one", "changed@example.invalid");
assert(!repeat.result.accountCreated && repeat.result.accountId === first.result.accountId, "issuer-subject is stable regardless of email");

const mismatch = await broker.startSocialLogin("GOOGLE", pkce);
providers.claims.set("bad-nonce-token", { issuer: configs[0].issuer, audience: configs[0].audience, subject: "bad", nonce: "wrong", redirectUri: configs[0].redirectUri, expiresAtMs: clock.nowMs() + 60_000 });
await expectCode(() => broker.completeSocialLogin("GOOGLE", "bad-nonce-token", mismatch.state, "q".repeat(64)), "PKCE_MISMATCH");
await expectCode(() => broker.completeSocialLogin("GOOGLE", "bad-nonce-token", mismatch.state, verifier), "STATE_REPLAY");
await expectCode(() => broker.startSocialLogin("FACEBOOK", pkce), "PROVIDER_DISABLED");
await expectCode(() => broker.completeSocialLogin("GOOGLE", "bad-nonce-token", "missing-state", verifier), "STATE_INVALID");
await expectCode(() => broker.completeSocialLogin("APPLE", "bad-nonce-token", mismatch.state, verifier), "STATE_INVALID");

async function expectClaimMismatch(token: string, mutate: (claims: ProviderClaims) => void, code: string): Promise<void> {
  const challenge = await broker.startSocialLogin("GOOGLE", pkce);
  const claims: ProviderClaims = { issuer: configs[0].issuer, audience: configs[0].audience, subject: token, nonce: challenge.nonce, redirectUri: configs[0].redirectUri, expiresAtMs: clock.nowMs() + 60_000 };
  mutate(claims);
  providers.claims.set(token, claims);
  await expectCode(() => broker.completeSocialLogin("GOOGLE", token, challenge.state, verifier), code);
}
await expectClaimMismatch("bad-issuer-token", (claims) => { claims.issuer = "https://attacker.invalid"; }, "ISSUER_MISMATCH");
await expectClaimMismatch("bad-audience-token", (claims) => { claims.audience = "another-app"; }, "AUDIENCE_MISMATCH");
await expectClaimMismatch("bad-nonce-token-two", (claims) => { claims.nonce = "another-nonce"; }, "NONCE_MISMATCH");
await expectClaimMismatch("bad-redirect-token", (claims) => { claims.redirectUri = "https://attacker.invalid/callback"; }, "REDIRECT_MISMATCH");
await expectClaimMismatch("expired-assertion-token", (claims) => { claims.expiresAtMs = clock.nowMs() - 1; }, "PROVIDER_ASSERTION_EXPIRED");
await expectClaimMismatch("missing-subject-token", (claims) => { claims.subject = ""; }, "SUBJECT_MISSING");
const expiredChallenge = await broker.startSocialLogin("GOOGLE", pkce);
clock.advance(300_001);
await expectCode(() => broker.completeSocialLogin("GOOGLE", "unverified-token", expiredChallenge.state, verifier), "CHALLENGE_EXPIRED");

const successfulChallenge = await broker.startSocialLogin("GOOGLE", pkce);
providers.claims.set("replay-token", { issuer: configs[0].issuer, audience: configs[0].audience, subject: "replay-subject", nonce: successfulChallenge.nonce, redirectUri: configs[0].redirectUri, expiresAtMs: clock.nowMs() + 60_000 });
await broker.completeSocialLogin("GOOGLE", "replay-token", successfulChallenge.state, verifier);
await expectCode(() => broker.completeSocialLogin("GOOGLE", "replay-token", successfulChallenge.state, verifier), "STATE_REPLAY");

const concurrentChallenge = await broker.startSocialLogin("GOOGLE", pkce);
providers.claims.set("concurrent-token", { issuer: configs[0].issuer, audience: configs[0].audience, subject: "concurrent-subject", nonce: concurrentChallenge.nonce, redirectUri: configs[0].redirectUri, expiresAtMs: clock.nowMs() + 60_000 });
const callsBeforeRace = providers.calls;
const concurrentResults = await Promise.allSettled([
  broker.completeSocialLogin("GOOGLE", "concurrent-token", concurrentChallenge.state, verifier),
  broker.completeSocialLogin("GOOGLE", "concurrent-token", concurrentChallenge.state, verifier),
]);
assert(concurrentResults.filter((result) => result.status === "fulfilled").length === 1, "concurrent state has at most one successful completion");
assert(concurrentResults.filter((result) => result.status === "rejected" && result.reason instanceof IdentityPolicyError && result.reason.code === "STATE_REPLAY").length === 1, "concurrent duplicate is rejected as replay");
assert(providers.calls - callsBeforeRace === 1, "concurrent state invokes provider verifier once");

const receipt: ThresholdWalletReceipt = {
  address: `erd1${"a".repeat(58)}`,
  provider: "MPC_THRESHOLD_SANDBOX",
  custodyModel: "THRESHOLD_2_OF_3",
  threshold: 2,
  shareHolders: ["DEVICE", "INDEPENDENT_RECOVERY", "NEXUS_HSM"],
  shareCommitments: ["a".repeat(64), "b".repeat(64), "c".repeat(64)],
  fullKeyAccessibleByNexus: false,
  exportSupported: true,
  keyVersion: 1,
};
const walletId = broker.provisionEmbeddedWallet(first.result.accountId, receipt);
assert(walletId.length >= 24, "wallet receives opaque id");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, fullKeyAccessibleByNexus: true } as unknown as ThresholdWalletReceipt)), "CUSTODY_BOUNDARY_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, shareHolders: ["NEXUS_HSM", "DEVICE", "INDEPENDENT_RECOVERY"] } as unknown as ThresholdWalletReceipt)), "SHARE_HOLDERS_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, shareCommitments: ["a".repeat(64), "a".repeat(64), "c".repeat(64)] })), "SHARE_COMMITMENTS_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, address: "erd1bad" })), "WALLET_ADDRESS_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, provider: "UNVERIFIED_VENDOR" } as unknown as ThresholdWalletReceipt)), "WALLET_PROVIDER_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(second.result.accountId, { ...receipt, keyVersion: 0 })), "KEY_VERSION_INVALID");
await expectCode(() => Promise.resolve(broker.provisionEmbeddedWallet(first.result.accountId, receipt)), "WALLET_ALREADY_PROVISIONED");

await expectCode(() => Promise.resolve(broker.setupRecovery(first.result.accountId, [{ factorId: "only", type: "PASSKEY", publicRef: "passkey-ref", verifierDomain: "device.passkey" }], true)), "INDEPENDENT_FACTORS_REQUIRED");
await expectCode(() => Promise.resolve(broker.setupRecovery(first.result.accountId, [
  { factorId: "passkey-a", type: "PASSKEY", publicRef: "a", verifierDomain: "device.a" },
  { factorId: "passkey-b", type: "PASSKEY", publicRef: "b", verifierDomain: "device.b" },
], true)), "INDEPENDENT_FACTORS_REQUIRED");
await expectCode(() => Promise.resolve(broker.setupRecovery(first.result.accountId, [
  { factorId: "passkey", type: "PASSKEY", publicRef: "shared-ref", verifierDomain: "device.passkey" },
  { factorId: "guardian", type: "INDEPENDENT_RECOVERY", publicRef: "shared-ref", verifierDomain: "guardian.independent" },
], true)), "INDEPENDENT_AUTHENTICATORS_REQUIRED");
await expectCode(() => Promise.resolve(broker.setupRecovery(first.result.accountId, [
  { factorId: "passkey", type: "PASSKEY", publicRef: "passkey-ref", verifierDomain: "shared.domain" },
  { factorId: "guardian", type: "INDEPENDENT_RECOVERY", publicRef: "guardian-ref", verifierDomain: "shared.domain" },
], true)), "INDEPENDENT_AUTHENTICATORS_REQUIRED");
await expectCode(() => Promise.resolve(broker.setupRecovery(first.result.accountId, [
  { factorId: "passkey", type: "PASSKEY", publicRef: "passkey-ref", verifierDomain: "device.passkey" },
  { factorId: "guardian", type: "INDEPENDENT_RECOVERY", publicRef: "guardian-ref", verifierDomain: "guardian.independent" },
], false)), "RECENT_AUTH_REQUIRED");
const recoveryFactors = [
  { factorId: "passkey", type: "PASSKEY" as const, publicRef: "passkey-ref", verifierDomain: "device.passkey" },
  { factorId: "guardian", type: "INDEPENDENT_RECOVERY" as const, publicRef: "guardian-ref", verifierDomain: "guardian.independent" },
];
broker.setupRecovery(first.result.accountId, recoveryFactors, true);
function proofsFor(challenge: { challengeId: string; purpose: string; nonce: string; keyVersion: number }) {
  return recoveryFactors.map((factor) => ({
    factorId: factor.factorId,
    proof: `valid:${factor.publicRef}:${challenge.challengeId}:${challenge.purpose}:${challenge.nonce}:${challenge.keyVersion}:${factor.verifierDomain}`,
  }));
}
const recoveryCase = broker.beginRecovery(first.result.accountId, ["passkey", "guardian"]);
const competingRecoveryCase = broker.beginRecovery(first.result.accountId, ["passkey", "guardian"]);
await expectCode(() => Promise.resolve(broker.beginRecovery(first.result.accountId, ["passkey", "unknown"])), "INDEPENDENT_FACTORS_REQUIRED");
await expectCode(() => Promise.resolve(broker.issueRecoveryProofChallenge(recoveryCase)), "RECOVERY_COOLDOWN_ACTIVE");
clock.advance(3_600_000);
const badRecoveryChallenge = broker.issueRecoveryProofChallenge(recoveryCase);
const badRecoveryProofs = proofsFor(badRecoveryChallenge);
await expectCode(() => broker.completeRecovery(recoveryCase, badRecoveryChallenge.challengeId, [{ ...badRecoveryProofs[0], proof: "invalid" }, badRecoveryProofs[1]]), "FACTOR_PROOF_INVALID");
await expectCode(() => broker.completeRecovery(recoveryCase, badRecoveryChallenge.challengeId, badRecoveryProofs), "PROOF_CHALLENGE_REPLAY");
const recoveryChallenge = broker.issueRecoveryProofChallenge(recoveryCase);
const competingRecoveryChallenge = broker.issueRecoveryProofChallenge(competingRecoveryCase);
const recoveryResults = await Promise.allSettled([
  broker.completeRecovery(recoveryCase, recoveryChallenge.challengeId, proofsFor(recoveryChallenge)),
  broker.completeRecovery(competingRecoveryCase, competingRecoveryChallenge.challengeId, proofsFor(competingRecoveryChallenge)),
]);
assert(recoveryResults.filter((result) => result.status === "fulfilled").length === 1, "parallel recovery commits one key version exactly once");
assert(recoveryResults.filter((result) => result.status === "rejected" && result.reason instanceof IdentityPolicyError && result.reason.code === "RECOVERY_COMMIT_CONFLICT").length === 1, "parallel recovery loser fails version compare-and-swap");
const recoveredResult = recoveryResults.find((result) => result.status === "fulfilled");
assert(recoveredResult?.status === "fulfilled", "parallel recovery returns one winning receipt");
const recovered = recoveredResult.value;
assert(!recovered.addressChanged && recovered.address === receipt.address, "recovery preserves wallet address");
await expectCode(() => broker.completeRecovery(recoveryCase, recoveryChallenge.challengeId, proofsFor(recoveryChallenge)), "RECOVERY_CASE_INVALID");
await expectCode(() => broker.completeRecovery(competingRecoveryCase, competingRecoveryChallenge.challengeId, proofsFor(competingRecoveryChallenge)), "RECOVERY_CASE_INVALID");

const outageChallenge = broker.issueProofChallenge(first.result.accountId, "OUTAGE_AUTH", ["passkey", "guardian"]);
const fallback = await broker.authenticateDuringProviderOutage(first.result.accountId, outageChallenge.challengeId, proofsFor(outageChallenge));
assert(fallback.method === "RECOVERY_FACTORS", "provider outage has independent recovery login");
await expectCode(() => broker.authenticateDuringProviderOutage(first.result.accountId, outageChallenge.challengeId, proofsFor(outageChallenge)), "PROOF_CHALLENGE_REPLAY");
const insufficientOutageChallenge = broker.issueProofChallenge(first.result.accountId, "OUTAGE_AUTH", ["passkey", "guardian"]);
await expectCode(() => broker.authenticateDuringProviderOutage(first.result.accountId, insufficientOutageChallenge.challengeId, [proofsFor(insufficientOutageChallenge)[0]]), "INDEPENDENT_PROOFS_REQUIRED");
const exportChallenge = broker.issueProofChallenge(first.result.accountId, "EXPORT", ["passkey", "guardian"]);
await expectCode(() => broker.authenticateDuringProviderOutage(first.result.accountId, exportChallenge.challengeId, proofsFor(exportChallenge)), "PROOF_CHALLENGE_INVALID");
await expectCode(() => broker.authorizeExport(walletId, false, exportChallenge.challengeId, proofsFor(exportChallenge)), "RECENT_AUTH_REQUIRED");
const exported = await broker.authorizeExport(walletId, true, exportChallenge.challengeId, proofsFor(exportChallenge));
assert(exported.destination === "USER_CONTROLLED_CHANNEL" && exported.nexusReceivedKey === false, "export bypasses Nexus key custody");
const insufficientExportChallenge = broker.issueProofChallenge(first.result.accountId, "EXPORT", ["passkey", "guardian"]);
await expectCode(() => broker.authorizeExport(walletId, true, insufficientExportChallenge.challengeId, [proofsFor(insufficientExportChallenge)[0]]), "INDEPENDENT_PROOFS_REQUIRED");

await expectCode(() => broker.revokeIdentity(first.result.accountId, configs[0].issuer, "provider-subject-one", false), "RECENT_AUTH_REQUIRED");
await broker.revokeIdentity(first.result.accountId, configs[0].issuer, "provider-subject-one", true);
await expectCode(() => broker.revokeIdentity(second.result.accountId, configs[1].issuer, "provider-subject-two", true), "LAST_RECOVERY_PATH");

const durableSnapshot = broker.exportDurableRepositorySnapshot();
assert(!durableSnapshot.includes("opaque-token") && !durableSnapshot.includes("provider-subject"), "durable repository excludes provider token and raw subject");
const restoredRepository = IdentityStateRepositorySandbox.restoreDurableSnapshot(durableSnapshot);
const restoredBroker = new IdentityBrokerSandbox(configs, providers, new MockFactorVerifier(), clock, new TestEntropy(10_000), 300_000, 3_600_000, restoredRepository);
await expectCode(() => restoredBroker.completeSocialLogin("GOOGLE", "replay-token", successfulChallenge.state, verifier), "STATE_REPLAY");
const revokedChallenge = await restoredBroker.startSocialLogin("GOOGLE", pkce);
providers.claims.set("revoked-after-restart-token", { issuer: configs[0].issuer, audience: configs[0].audience, subject: "provider-subject-one", nonce: revokedChallenge.nonce, redirectUri: configs[0].redirectUri, expiresAtMs: clock.nowMs() + 60_000 });
await expectCode(() => restoredBroker.completeSocialLogin("GOOGLE", "revoked-after-restart-token", revokedChallenge.state, verifier), "IDENTITY_REVOKED");
assert(JSON.stringify(restoredBroker.getSanitizedSnapshot()).includes(receipt.address), "wallet state survives repository restart");

const snapshotText = JSON.stringify(broker.getSanitizedSnapshot());
for (const forbidden of ["opaque-token", "shared@example.invalid", "changed@example.invalid", "provider-subject", "seed_phrase", "private_key"]) {
  assert(!snapshotText.includes(forbidden), `snapshot excludes ${forbidden}`);
}
const snapshot = broker.getSanitizedSnapshot() as { wallets: Array<{ fullKeyAccessibleByNexus: boolean; shareCommitments: string[]; shareHolders: string[] }> };
assert(snapshot.wallets[0].fullKeyAccessibleByNexus === false, "Nexus alone cannot reconstruct the wallet key");
assert(snapshot.wallets[0].shareCommitments.length === 3 && snapshot.wallets[0].shareHolders.length === 3, "only distributed share commitments are retained");

console.log(JSON.stringify({ task_id: "NX-AUTH-001", status: "PASS", assertions, provider_calls: providers.calls, accounts_isolated_by_issuer_subject: true, nexus_full_key_access: false, recovery_export_revoke_outage: true, synthetic_only: true }));
}

void main();
