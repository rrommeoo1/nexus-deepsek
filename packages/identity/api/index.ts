export type SocialProvider = "GOOGLE" | "APPLE" | "FACEBOOK" | "TIKTOK";
export type RecoveryFactorType = "PASSKEY" | "DEVICE" | "SOCIAL_RECOVERY" | "INDEPENDENT_RECOVERY" | "GUARDIAN";
export type RecoveryProofPurpose = "RECOVERY" | "EXPORT" | "OUTAGE_AUTH";

export interface Clock { nowMs(): number }
export interface EntropySource { next(label: "state" | "nonce" | "id"): string }
export interface ProviderClaims {
  issuer: string;
  audience: string;
  subject: string;
  email?: string;
  nonce: string;
  redirectUri: string;
  expiresAtMs: number;
}
export interface ProviderVerifier { verify(provider: SocialProvider, opaqueToken: string): Promise<ProviderClaims> }
export interface RecoveryFactorProof { factorId: string; proof: string }
export interface RecoveryProofContext {
  challengeId: string;
  accountId: string;
  walletId: string;
  purpose: RecoveryProofPurpose;
  nonce: string;
  expiresAtMs: number;
  keyVersion: number;
  verifierDomain: string;
}
export interface RecoveryFactorVerifier { verify(publicRef: string, proof: string, context: RecoveryProofContext): Promise<boolean> }

export interface ProviderConfig {
  provider: SocialProvider;
  issuer: string;
  audience: string;
  redirectUri: string;
  enabled: boolean;
}

export interface LoginChallenge {
  provider: SocialProvider;
  state: string;
  nonce: string;
  pkceChallenge: string;
  redirectUri: string;
  audience: string;
  expiresAtMs: number;
}

export interface LoginResult {
  accountId: string;
  identityKey: string;
  accountCreated: boolean;
}

export interface ThresholdWalletReceipt {
  address: string;
  provider: "XALIAS_PASSKEY" | "MPC_THRESHOLD_SANDBOX";
  custodyModel: "THRESHOLD_2_OF_3";
  threshold: 2;
  shareHolders: readonly ["DEVICE", "INDEPENDENT_RECOVERY", "NEXUS_HSM"];
  shareCommitments: readonly [string, string, string];
  fullKeyAccessibleByNexus: false;
  exportSupported: true;
  keyVersion: number;
}

export interface RecoveryFactorInput {
  factorId: string;
  type: RecoveryFactorType;
  publicRef: string;
  verifierDomain: string;
}

interface IdentityRecord {
  identityKey: string;
  issuer: string;
  subjectHash: string;
  accountId: string;
  state: "ACTIVE" | "REVOKED";
}
interface AccountRecord { accountId: string; identityKeys: Set<string>; walletId?: string; recoveryFactors: Map<string, RecoveryFactorInput> }
interface WalletRecord {
  walletId: string;
  accountId: string;
  address: string;
  provider: ThresholdWalletReceipt["provider"];
  custodyModel: ThresholdWalletReceipt["custodyModel"];
  threshold: 2;
  shareHolders: ThresholdWalletReceipt["shareHolders"];
  shareCommitments: ThresholdWalletReceipt["shareCommitments"];
  fullKeyAccessibleByNexus: false;
  exportSupported: true;
  keyVersion: number;
  state: "ACTIVE" | "RECOVERING";
}
interface PendingChallenge extends LoginChallenge { consumed: boolean }
interface RecoveryCase { caseId: string; accountId: string; walletId: string; factorIds: string[]; cooldownUntilMs: number; state: "COOLDOWN" | "COMPLETED" | "CONFLICTED" }
interface ProofChallenge {
  challengeId: string;
  accountId: string;
  walletId: string;
  purpose: RecoveryProofPurpose;
  factorIds: string[];
  nonce: string;
  expiresAtMs: number;
  keyVersion: number;
  actionId: string | null;
  consumed: boolean;
}

export interface IdentityRepositorySnapshot {
  schemaVersion: 1;
  pending: PendingChallenge[];
  identities: IdentityRecord[];
  accounts: Array<{ accountId: string; identityKeys: string[]; walletId?: string; recoveryFactors: RecoveryFactorInput[] }>;
  wallets: WalletRecord[];
  recoveries: RecoveryCase[];
  proofChallenges: ProofChallenge[];
  usedEntropy: string[];
}

export class IdentityPolicyError extends Error {
  constructor(readonly code: string) { super(code); this.name = "IdentityPolicyError" }
}

/**
 * Persistence boundary for the local proof. A production adapter must map the same
 * atomic operations to a transactional durable store with encryption at rest.
 * Export/import is deliberately explicit so restart and crash-recovery semantics
 * can be tested without adding a network or a database to this zero-cost packet.
 */
export class IdentityStateRepositorySandbox {
  readonly pending = new Map<string, PendingChallenge>();
  readonly identities = new Map<string, IdentityRecord>();
  readonly accounts = new Map<string, AccountRecord>();
  readonly wallets = new Map<string, WalletRecord>();
  readonly recoveries = new Map<string, RecoveryCase>();
  readonly proofChallenges = new Map<string, ProofChallenge>();
  readonly usedEntropy = new Set<string>();

  claimLoginChallenge(state: string, provider: SocialProvider, nowMs: number): PendingChallenge {
    const challenge = this.pending.get(state);
    if (!challenge || challenge.provider !== provider) throw new IdentityPolicyError("STATE_INVALID");
    if (challenge.consumed) throw new IdentityPolicyError("STATE_REPLAY");
    if (challenge.expiresAtMs <= nowMs) throw new IdentityPolicyError("CHALLENGE_EXPIRED");
    challenge.consumed = true;
    return challenge;
  }

  bindIdentity(identityKey: string, issuer: string, subjectHash: string, proposedAccountId: string): LoginResult {
    const existing = this.identities.get(identityKey);
    if (existing?.state === "ACTIVE") return { accountId: existing.accountId, identityKey, accountCreated: false };
    if (existing?.state === "REVOKED") throw new IdentityPolicyError("IDENTITY_REVOKED");
    const account: AccountRecord = { accountId: proposedAccountId, identityKeys: new Set([identityKey]), recoveryFactors: new Map() };
    this.accounts.set(proposedAccountId, account);
    this.identities.set(identityKey, { identityKey, issuer, subjectHash, accountId: proposedAccountId, state: "ACTIVE" });
    return { accountId: proposedAccountId, identityKey, accountCreated: true };
  }

  claimProofChallenge(challengeId: string, accountId: string, purpose: RecoveryProofPurpose, actionId: string | null, nowMs: number, keyVersion: number): ProofChallenge {
    const challenge = this.proofChallenges.get(challengeId);
    if (!challenge || challenge.accountId !== accountId || challenge.purpose !== purpose || challenge.actionId !== actionId) throw new IdentityPolicyError("PROOF_CHALLENGE_INVALID");
    if (challenge.consumed) throw new IdentityPolicyError("PROOF_CHALLENGE_REPLAY");
    if (challenge.expiresAtMs <= nowMs) throw new IdentityPolicyError("PROOF_CHALLENGE_EXPIRED");
    if (challenge.keyVersion !== keyVersion) throw new IdentityPolicyError("PROOF_KEY_VERSION_MISMATCH");
    challenge.consumed = true;
    return challenge;
  }

  exportDurableSnapshot(): string {
    const snapshot: IdentityRepositorySnapshot = {
      schemaVersion: 1,
      pending: Array.from(this.pending.values(), (value) => ({ ...value })),
      identities: Array.from(this.identities.values(), (value) => ({ ...value })),
      accounts: Array.from(this.accounts.values(), (value) => ({
        accountId: value.accountId,
        identityKeys: Array.from(value.identityKeys),
        ...(value.walletId ? { walletId: value.walletId } : {}),
        recoveryFactors: Array.from(value.recoveryFactors.values(), (factor) => ({ ...factor })),
      })),
      wallets: Array.from(this.wallets.values(), (value) => ({ ...value })),
      recoveries: Array.from(this.recoveries.values(), (value) => ({ ...value, factorIds: [...value.factorIds] })),
      proofChallenges: Array.from(this.proofChallenges.values(), (value) => ({ ...value, factorIds: [...value.factorIds] })),
      usedEntropy: Array.from(this.usedEntropy),
    };
    return JSON.stringify(snapshot);
  }

  static restoreDurableSnapshot(serialized: string): IdentityStateRepositorySandbox {
    const parsed = JSON.parse(serialized) as Partial<IdentityRepositorySnapshot>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.pending) || !Array.isArray(parsed.identities) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.wallets) || !Array.isArray(parsed.recoveries) || !Array.isArray(parsed.proofChallenges) || !Array.isArray(parsed.usedEntropy)) {
      throw new IdentityPolicyError("REPOSITORY_SNAPSHOT_INVALID");
    }
    const repository = new IdentityStateRepositorySandbox();
    for (const value of parsed.pending) repository.pending.set(value.state, { ...value });
    for (const value of parsed.identities) repository.identities.set(value.identityKey, { ...value });
    for (const value of parsed.accounts) repository.accounts.set(value.accountId, {
      accountId: value.accountId,
      identityKeys: new Set(value.identityKeys),
      ...(value.walletId ? { walletId: value.walletId } : {}),
      recoveryFactors: new Map(value.recoveryFactors.map((factor) => [factor.factorId, { ...factor }])),
    });
    for (const value of parsed.wallets) repository.wallets.set(value.walletId, { ...value });
    for (const value of parsed.recoveries) repository.recoveries.set(value.caseId, { ...value, factorIds: [...value.factorIds] });
    for (const value of parsed.proofChallenges) repository.proofChallenges.set(value.challengeId, { ...value, factorIds: [...value.factorIds] });
    for (const value of parsed.usedEntropy) repository.usedEntropy.add(value);
    return repository;
  }
}

const utf8 = new TextEncoder();
async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", utf8.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function derivePkceChallenge(verifier: string): Promise<string> {
  if (verifier.length < 43 || verifier.length > 128) throw new IdentityPolicyError("PKCE_VERIFIER_LENGTH");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", utf8.encode(verifier));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export class IdentityBrokerSandbox {
  private readonly configs = new Map<SocialProvider, ProviderConfig>();
  private get pending(): Map<string, PendingChallenge> { return this.repository.pending; }
  private get identities(): Map<string, IdentityRecord> { return this.repository.identities; }
  private get accounts(): Map<string, AccountRecord> { return this.repository.accounts; }
  private get wallets(): Map<string, WalletRecord> { return this.repository.wallets; }
  private get recoveries(): Map<string, RecoveryCase> { return this.repository.recoveries; }
  private get proofChallenges(): Map<string, ProofChallenge> { return this.repository.proofChallenges; }
  private get usedEntropy(): Set<string> { return this.repository.usedEntropy; }

  constructor(
    configs: ProviderConfig[],
    private readonly providerVerifier: ProviderVerifier,
    private readonly factorVerifier: RecoveryFactorVerifier,
    private readonly clock: Clock,
    private readonly entropy: EntropySource,
    private readonly challengeTtlMs = 5 * 60_000,
    private readonly recoveryCooldownMs = 60 * 60_000,
    private readonly repository = new IdentityStateRepositorySandbox(),
  ) {
    for (const config of configs) {
      if (this.configs.has(config.provider)) throw new IdentityPolicyError("DUPLICATE_PROVIDER_CONFIG");
      this.configs.set(config.provider, { ...config });
    }
  }

  async startSocialLogin(provider: SocialProvider, pkceChallenge: string): Promise<LoginChallenge> {
    const config = this.configs.get(provider);
    if (!config?.enabled) throw new IdentityPolicyError("PROVIDER_DISABLED");
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(pkceChallenge)) throw new IdentityPolicyError("PKCE_CHALLENGE_INVALID");
    const state = this.uniqueEntropy("state");
    const nonce = this.uniqueEntropy("nonce");
    const challenge: PendingChallenge = {
      provider, state, nonce, pkceChallenge, redirectUri: config.redirectUri,
      audience: config.audience, expiresAtMs: this.clock.nowMs() + this.challengeTtlMs, consumed: false,
    };
    this.pending.set(state, challenge);
    return {
      provider: challenge.provider,
      state: challenge.state,
      nonce: challenge.nonce,
      pkceChallenge: challenge.pkceChallenge,
      redirectUri: challenge.redirectUri,
      audience: challenge.audience,
      expiresAtMs: challenge.expiresAtMs,
    };
  }

  async completeSocialLogin(provider: SocialProvider, opaqueToken: string, state: string, pkceVerifier: string): Promise<LoginResult> {
    // Repository claim is synchronous/atomic and happens before the first await.
    // A failed PKCE/provider attempt is terminal; clients must request a new state.
    const challenge = this.repository.claimLoginChallenge(state, provider, this.clock.nowMs());
    if (await derivePkceChallenge(pkceVerifier) !== challenge.pkceChallenge) throw new IdentityPolicyError("PKCE_MISMATCH");
    const claims = await this.providerVerifier.verify(provider, opaqueToken);
    const config = this.configs.get(provider)!;
    if (claims.issuer !== config.issuer) throw new IdentityPolicyError("ISSUER_MISMATCH");
    if (claims.audience !== challenge.audience) throw new IdentityPolicyError("AUDIENCE_MISMATCH");
    if (claims.nonce !== challenge.nonce) throw new IdentityPolicyError("NONCE_MISMATCH");
    if (claims.redirectUri !== challenge.redirectUri) throw new IdentityPolicyError("REDIRECT_MISMATCH");
    if (claims.expiresAtMs <= this.clock.nowMs()) throw new IdentityPolicyError("PROVIDER_ASSERTION_EXPIRED");
    if (!claims.subject) throw new IdentityPolicyError("SUBJECT_MISSING");
    const subjectHash = await sha256Hex(`${claims.issuer}\u0000${claims.subject}`);
    const identityKey = `${claims.issuer}|${subjectHash}`;
    const accountId = this.uniqueEntropy("id");
    return this.repository.bindIdentity(identityKey, claims.issuer, subjectHash, accountId);
  }

  provisionEmbeddedWallet(accountId: string, receipt: ThresholdWalletReceipt): string {
    const account = this.requireAccount(accountId);
    if (account.walletId) throw new IdentityPolicyError("WALLET_ALREADY_PROVISIONED");
    if (receipt.custodyModel !== "THRESHOLD_2_OF_3" || receipt.threshold !== 2 || receipt.fullKeyAccessibleByNexus !== false || receipt.exportSupported !== true) {
      throw new IdentityPolicyError("CUSTODY_BOUNDARY_INVALID");
    }
    if (!(["XALIAS_PASSKEY", "MPC_THRESHOLD_SANDBOX"] as string[]).includes(receipt.provider)) throw new IdentityPolicyError("WALLET_PROVIDER_INVALID");
    if (!Number.isSafeInteger(receipt.keyVersion) || receipt.keyVersion < 1) throw new IdentityPolicyError("KEY_VERSION_INVALID");
    if ((new Set(receipt.shareHolders)).size !== 3 || receipt.shareHolders.join(",") !== "DEVICE,INDEPENDENT_RECOVERY,NEXUS_HSM") throw new IdentityPolicyError("SHARE_HOLDERS_INVALID");
    if ((new Set(receipt.shareCommitments)).size !== 3 || receipt.shareCommitments.some((value) => !/^[a-f0-9]{64}$/.test(value))) throw new IdentityPolicyError("SHARE_COMMITMENTS_INVALID");
    if (!/^erd1[a-z0-9]{20,}$/.test(receipt.address)) throw new IdentityPolicyError("WALLET_ADDRESS_INVALID");
    const walletId = this.uniqueEntropy("id");
    const wallet: WalletRecord = { walletId, accountId, address: receipt.address, provider: receipt.provider, custodyModel: receipt.custodyModel, threshold: 2, shareHolders: receipt.shareHolders, shareCommitments: receipt.shareCommitments, fullKeyAccessibleByNexus: false, exportSupported: true, keyVersion: receipt.keyVersion, state: "ACTIVE" };
    this.wallets.set(walletId, wallet);
    account.walletId = walletId;
    return walletId;
  }

  setupRecovery(accountId: string, factors: RecoveryFactorInput[], recentAuth: boolean): void {
    const account = this.requireAccount(accountId);
    if (!recentAuth) throw new IdentityPolicyError("RECENT_AUTH_REQUIRED");
    if (!account.walletId) throw new IdentityPolicyError("WALLET_REQUIRED");
    if (factors.length < 2 || new Set(factors.map((factor) => factor.factorId)).size !== factors.length || new Set(factors.map((factor) => factor.type)).size < 2) throw new IdentityPolicyError("INDEPENDENT_FACTORS_REQUIRED");
    if (new Set(factors.map((factor) => factor.publicRef)).size !== factors.length || new Set(factors.map((factor) => factor.verifierDomain)).size !== factors.length || factors.some((factor) => !/^[a-z0-9._-]{3,64}$/.test(factor.verifierDomain))) throw new IdentityPolicyError("INDEPENDENT_AUTHENTICATORS_REQUIRED");
    if (!factors.some((factor) => factor.type === "PASSKEY" || factor.type === "DEVICE")) throw new IdentityPolicyError("DEVICE_FACTOR_REQUIRED");
    if (!factors.some((factor) => factor.type === "INDEPENDENT_RECOVERY" || factor.type === "GUARDIAN" || factor.type === "SOCIAL_RECOVERY")) throw new IdentityPolicyError("RECOVERY_FACTOR_REQUIRED");
    account.recoveryFactors = new Map(factors.map((factor) => [factor.factorId, { ...factor }]));
  }

  beginRecovery(accountId: string, factorIds: string[]): string {
    const account = this.requireAccount(accountId);
    if (!account.walletId) throw new IdentityPolicyError("WALLET_REQUIRED");
    this.requireIndependentFactors(account, factorIds);
    const wallet = this.wallets.get(account.walletId)!;
    wallet.state = "RECOVERING";
    const caseId = this.uniqueEntropy("id");
    this.recoveries.set(caseId, { caseId, accountId, walletId: wallet.walletId, factorIds: [...new Set(factorIds)], cooldownUntilMs: this.clock.nowMs() + this.recoveryCooldownMs, state: "COOLDOWN" });
    return caseId;
  }

  issueRecoveryProofChallenge(caseId: string): { challengeId: string; nonce: string; expiresAtMs: number; keyVersion: number; purpose: "RECOVERY" } {
    const recovery = this.recoveries.get(caseId);
    if (!recovery || recovery.state !== "COOLDOWN") throw new IdentityPolicyError("RECOVERY_CASE_INVALID");
    if (this.clock.nowMs() < recovery.cooldownUntilMs) throw new IdentityPolicyError("RECOVERY_COOLDOWN_ACTIVE");
    return this.issueProofChallengeInternal(recovery.accountId, "RECOVERY", recovery.factorIds, recovery.caseId);
  }

  issueProofChallenge(accountId: string, purpose: "EXPORT" | "OUTAGE_AUTH", factorIds: string[]): { challengeId: string; nonce: string; expiresAtMs: number; keyVersion: number; purpose: "EXPORT" | "OUTAGE_AUTH" } {
    return this.issueProofChallengeInternal(accountId, purpose, factorIds, null);
  }

  async completeRecovery(caseId: string, challengeId: string, proofs: RecoveryFactorProof[]): Promise<{ walletId: string; address: string; addressChanged: false }> {
    const recovery = this.recoveries.get(caseId);
    if (!recovery || recovery.state !== "COOLDOWN") throw new IdentityPolicyError("RECOVERY_CASE_INVALID");
    if (this.clock.nowMs() < recovery.cooldownUntilMs) throw new IdentityPolicyError("RECOVERY_COOLDOWN_ACTIVE");
    const account = this.requireAccount(recovery.accountId);
    const claimedChallenge = await this.verifyProofs(account, "RECOVERY", recovery.caseId, challengeId, proofs);
    const wallet = this.wallets.get(recovery.walletId)!;
    // Compare-and-swap after asynchronous factor verification. Only one recovery
    // against a wallet/key version can commit, even if multiple cases were claimed.
    if (recovery.state !== "COOLDOWN" || wallet.keyVersion !== claimedChallenge.keyVersion) {
      recovery.state = "CONFLICTED";
      throw new IdentityPolicyError("RECOVERY_COMMIT_CONFLICT");
    }
    recovery.state = "COMPLETED";
    wallet.state = "ACTIVE";
    wallet.keyVersion = claimedChallenge.keyVersion + 1;
    return { walletId: wallet.walletId, address: wallet.address, addressChanged: false };
  }

  async authorizeExport(walletId: string, recentAuth: boolean, challengeId: string, proofs: RecoveryFactorProof[]): Promise<{ exportRequestId: string; address: string; destination: "USER_CONTROLLED_CHANNEL"; nexusReceivedKey: false }> {
    if (!recentAuth) throw new IdentityPolicyError("RECENT_AUTH_REQUIRED");
    const wallet = this.wallets.get(walletId);
    if (!wallet?.exportSupported) throw new IdentityPolicyError("EXPORT_UNAVAILABLE");
    const account = this.requireAccount(wallet.accountId);
    await this.verifyProofs(account, "EXPORT", null, challengeId, proofs);
    return { exportRequestId: this.uniqueEntropy("id"), address: wallet.address, destination: "USER_CONTROLLED_CHANNEL", nexusReceivedKey: false };
  }

  async authenticateDuringProviderOutage(accountId: string, challengeId: string, proofs: RecoveryFactorProof[]): Promise<{ accountId: string; method: "RECOVERY_FACTORS" }> {
    const account = this.requireAccount(accountId);
    await this.verifyProofs(account, "OUTAGE_AUTH", null, challengeId, proofs);
    return { accountId, method: "RECOVERY_FACTORS" };
  }

  async revokeIdentity(accountId: string, issuer: string, subject: string, recentAuth: boolean): Promise<void> {
    if (!recentAuth) throw new IdentityPolicyError("RECENT_AUTH_REQUIRED");
    const account = this.requireAccount(accountId);
    const subjectHash = await sha256Hex(`${issuer}\u0000${subject}`);
    const key = `${issuer}|${subjectHash}`;
    const identity = this.identities.get(key);
    if (!identity || identity.accountId !== accountId || identity.state !== "ACTIVE") throw new IdentityPolicyError("IDENTITY_NOT_ACTIVE");
    const alternativeIdentities = Array.from(account.identityKeys).filter((candidate) => candidate !== key && this.identities.get(candidate)?.state === "ACTIVE").length;
    if (alternativeIdentities === 0 && account.recoveryFactors.size < 2) throw new IdentityPolicyError("LAST_RECOVERY_PATH");
    identity.state = "REVOKED";
  }

  getSanitizedSnapshot(): unknown {
    return {
      accounts: Array.from(this.accounts.values(), (account) => ({ accountId: account.accountId, identityCount: account.identityKeys.size, walletId: account.walletId ?? null, recoveryFactorTypes: Array.from(account.recoveryFactors.values(), (factor) => factor.type).sort() })),
      identities: Array.from(this.identities.values(), (identity) => ({ identityKey: identity.identityKey, issuer: identity.issuer, subjectHash: identity.subjectHash, accountId: identity.accountId, state: identity.state })),
      wallets: Array.from(this.wallets.values(), (wallet) => ({ ...wallet })),
      pendingChallenges: this.pending.size,
      recoveryCases: Array.from(this.recoveries.values(), (recovery) => ({ ...recovery })),
      proofChallenges: Array.from(this.proofChallenges.values(), (challenge) => ({ challengeId: challenge.challengeId, accountId: challenge.accountId, walletId: challenge.walletId, purpose: challenge.purpose, factorIds: [...challenge.factorIds], nonce: challenge.nonce, expiresAtMs: challenge.expiresAtMs, keyVersion: challenge.keyVersion, actionId: challenge.actionId, consumed: challenge.consumed })),
    };
  }

  exportDurableRepositorySnapshot(): string { return this.repository.exportDurableSnapshot(); }

  private uniqueEntropy(label: "state" | "nonce" | "id"): string {
    const value = this.entropy.next(label);
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(value)) throw new IdentityPolicyError("ENTROPY_INVALID");
    if (this.usedEntropy.has(value)) throw new IdentityPolicyError("ENTROPY_REUSE");
    this.usedEntropy.add(value);
    return value;
  }
  private requireAccount(accountId: string): AccountRecord {
    const account = this.accounts.get(accountId);
    if (!account) throw new IdentityPolicyError("ACCOUNT_NOT_FOUND");
    return account;
  }
  private requireIndependentFactors(account: AccountRecord, factorIds: string[]): void {
    const factors = [...new Set(factorIds)].map((id) => account.recoveryFactors.get(id));
    if (factors.some((factor) => !factor) || factors.length < 2 || new Set(factors.map((factor) => factor!.type)).size < 2) throw new IdentityPolicyError("INDEPENDENT_FACTORS_REQUIRED");
  }
  private issueProofChallengeInternal<T extends RecoveryProofPurpose>(accountId: string, purpose: T, factorIds: string[], actionId: string | null): { challengeId: string; nonce: string; expiresAtMs: number; keyVersion: number; purpose: T } {
    const account = this.requireAccount(accountId);
    if (!account.walletId) throw new IdentityPolicyError("WALLET_REQUIRED");
    this.requireIndependentFactors(account, factorIds);
    const wallet = this.wallets.get(account.walletId)!;
    const challengeId = this.uniqueEntropy("id");
    const nonce = this.uniqueEntropy("nonce");
    const challenge: ProofChallenge = {
      challengeId, accountId, walletId: wallet.walletId, purpose, factorIds: [...new Set(factorIds)], nonce,
      expiresAtMs: this.clock.nowMs() + this.challengeTtlMs, keyVersion: wallet.keyVersion, actionId, consumed: false,
    };
    this.proofChallenges.set(challengeId, challenge);
    return { challengeId, nonce, expiresAtMs: challenge.expiresAtMs, keyVersion: challenge.keyVersion, purpose };
  }
  private async verifyProofs(account: AccountRecord, purpose: RecoveryProofPurpose, actionId: string | null, challengeId: string, proofs: RecoveryFactorProof[]): Promise<ProofChallenge> {
    if (!account.walletId) throw new IdentityPolicyError("WALLET_REQUIRED");
    const wallet = this.wallets.get(account.walletId)!;
    const challenge = this.repository.claimProofChallenge(challengeId, account.accountId, purpose, actionId, this.clock.nowMs(), wallet.keyVersion);
    const uniqueProofs = new Map(proofs.map((proof) => [proof.factorId, proof]));
    const factors = Array.from(uniqueProofs.values()).filter((proof) => challenge.factorIds.includes(proof.factorId)).map((proof) => ({ factor: account.recoveryFactors.get(proof.factorId), proof }));
    if (factors.some(({ factor }) => !factor) || factors.length < 2 || new Set(factors.map(({ factor }) => factor!.type)).size < 2) throw new IdentityPolicyError("INDEPENDENT_PROOFS_REQUIRED");
    if (new Set(factors.map(({ factor }) => factor!.publicRef)).size !== factors.length || new Set(factors.map(({ factor }) => factor!.verifierDomain)).size !== factors.length) throw new IdentityPolicyError("INDEPENDENT_AUTHENTICATORS_REQUIRED");
    for (const { factor, proof } of factors) {
      const context: RecoveryProofContext = {
        challengeId: challenge.challengeId, accountId: challenge.accountId, walletId: challenge.walletId,
        purpose: challenge.purpose, nonce: challenge.nonce, expiresAtMs: challenge.expiresAtMs,
        keyVersion: challenge.keyVersion, verifierDomain: factor!.verifierDomain,
      };
      if (!(await this.factorVerifier.verify(factor!.publicRef, proof.proof, context))) throw new IdentityPolicyError("FACTOR_PROOF_INVALID");
    }
    return challenge;
  }
}
