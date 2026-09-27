import { ClipEligibilityDecision, ClipEngagementDecision, ClipEngagementPolicyBoundary, ClipMediaBoundary, ClipProfileBoundary, ClipPublishCommand, ClipPurgeCommand, LikeActionRecorder, LikeExecutionAuthorization, SocialClipRegistry, SocialPolicyError } from "./index";
import { MediaPipeline, MediaPolicyError, PlaybackAuthorizationVerifier, PlaybackTokenSigner, PurgeReceiptVerifier, UploadAuthorizationVerifier, UploadCompletion, UploadIntent, WorkerAttestationVerifier, ReadyAttestation } from "../../media/api/index";
import { ActionEnvelope, ChainPolicyError, NexusActionsSandbox, PreparedAction } from "../../chain-actions-api/index";
import { ChainReducer, EventAuthenticityVerifier, IndexedChainEvent, RepairAuthorizationVerifier, RepairCommitStore, serializeObservationForVerification, serializePayloadForVerification } from "../../chain-adapter/api/index";

declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectSocial(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof SocialPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
async function expectChain(action: () => Promise<unknown>, code: string): Promise<void> { let actual = "NO_ERROR"; try { await action(); } catch (error) { actual = error instanceof ChainPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
async function expectSocialAsync(action: () => Promise<unknown>, code: string): Promise<void> { let actual = "NO_ERROR"; try { await action(); } catch (error) { actual = error instanceof SocialPolicyError ? error.code : error instanceof ChainPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
function expectMedia(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof MediaPolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }

class Issuer<T extends object> {
  private readonly values = new Set<string>();
  issue(value: T): T { this.values.add(JSON.stringify(value)); return value; }
  verify(value: Readonly<T>): boolean { return this.values.has(JSON.stringify(value)); }
}
class MediaFixtures implements UploadAuthorizationVerifier, WorkerAttestationVerifier, PlaybackAuthorizationVerifier, PurgeReceiptVerifier, PlaybackTokenSigner {
  verifyUploadAuthorization(): boolean { return true; }
  verifyReadyAttestation(): boolean { return true; }
  verifyPlaybackContext(): boolean { return true; }
  verifyPurgeReceipt(): boolean { return true; }
  signPlaybackGrant(): string { return "f".repeat(64); }
}
class MediaBoundary implements ClipMediaBoundary {
  constructor(private readonly pipeline: MediaPipeline, private readonly manifest: string) {}
  isReady(assetId: string, manifestHash: string): boolean { try { return manifestHash === this.manifest && this.pipeline.getState(assetId) === "READY"; } catch { return false; } }
  isPurged(assetId: string): boolean { try { return this.pipeline.getState(assetId) === "PURGED"; } catch { return false; } }
  currentGeneration(assetId: string): number { try { return this.pipeline.getState(assetId) === "READY" ? 1 : 2; } catch { return 0; } }
}
class ProfileBoundary implements ClipProfileBoundary {
  private readonly active = new Set<string>();
  register(profile: string, generation: number): void { this.active.add(`${profile}|${generation}`); }
  revoke(profile: string, generation: number): void { this.active.delete(`${profile}|${generation}`); }
  isActiveProfile(profile: string, generation: number): boolean { return this.active.has(`${profile}|${generation}`); }
}
class EngagementPolicyBoundary implements ClipEngagementPolicyBoundary {
  private state = { version: 1, blocked: false, audienceAllowed: true, deviceActive: true };
  set(value: { version: number; blocked: boolean; audienceAllowed: boolean; deviceActive: boolean }): void { this.state = { ...value }; }
  current(): Readonly<{ version: number; blocked: boolean; audienceAllowed: boolean; deviceActive: boolean }> { return Object.freeze({ ...this.state }); }
}
class Authenticity implements EventAuthenticityVerifier {
  private payload = ""; private observation = "";
  register(value: IndexedChainEvent): IndexedChainEvent { this.payload = serializePayloadForVerification(value.payload); this.observation = serializeObservationForVerification(value); return value; }
  verifyFinalizedObservation(value: IndexedChainEvent): boolean { return this.payload === serializePayloadForVerification(value.payload) && this.observation === serializeObservationForVerification(value); }
}

const NOW = "2026-08-09T22:00:00Z", NOW_MS = Date.parse(NOW);
const ASSET = "1".repeat(64), CLIP = "2".repeat(64), CREATOR = "3".repeat(64), VIEWER = "4".repeat(64), MANIFEST = "5".repeat(64), CHECKSUM = "6".repeat(64), SESSION = "7".repeat(64), CONTROLLER = "8".repeat(64), H128 = "a".repeat(128);

async function main(): Promise<void> {
  const mediaFixtures = new MediaFixtures(), media = new MediaPipeline(mediaFixtures, mediaFixtures, mediaFixtures, mediaFixtures, mediaFixtures);
  const upload: UploadIntent = { assetId: ASSET, ownerCommitment: CREATOR, surface: "ADULT_CLIPS", audience: "PUBLIC", territories: ["RO", "DE"], expectedChecksum: CHECKSUM, expectedMime: "video/mp4", maxBytes: 20_000_000, authorizationId: "9".repeat(64), expiresAtMs: NOW_MS + 60_000 };
  const completion: UploadCompletion = { completionId: "b".repeat(64), checksum: CHECKSUM, bytes: 8_000_000, mime: "video/mp4", container: "mp4", videoCodec: "h264", audioCodec: "aac", corrupt: false, malwareVerdict: "CLEAN" };
  const ready: ReadyAttestation = { jobId: "c".repeat(64), completionId: completion.completionId, manifestHash: MANIFEST, moderation: "APPROVED", renditions: [{ name: "360p", checksum: "d".repeat(64) }, { name: "720p", checksum: "e".repeat(64) }], attestationHash: "f".repeat(64) };
  assert(media.authorizeUpload(upload, NOW_MS) === "AUTHORIZED", "synthetic media upload is authorized");
  assert(media.completeUpload(ASSET, completion) === "ACCEPTED", "clean supported upload completes");
  assert(media.promoteReady(ASSET, ready) === "READY", "approved media attestation becomes ready");
  assert(media.grantPlayback(ASSET, VIEWER, "OTHER", "RO", NOW_MS, 120).manifestHash === MANIFEST, "ready public asset receives bounded playback grant");

  const commandIssuer = new Issuer<ClipPublishCommand>(), eligibilityIssuer = new Issuer<ClipEligibilityDecision>(), engagementIssuer = new Issuer<ClipEngagementDecision>(), executionIssuer = new Issuer<LikeExecutionAuthorization>(), purgeIssuer = new Issuer<ClipPurgeCommand>();
  const command = commandIssuer.issue({ schemaVersion: 1, clipCommitment: CLIP, assetId: ASSET, manifestHash: MANIFEST, creatorProfileCommitment: CREATOR, profileGeneration: 4, durationSeconds: 45, audience: "PUBLIC", contentRating: "ADULT_GENERAL", syntheticLabel: "SYSTEM_TEST", promotionLabel: "NONE", publishedAt: NOW, signature: H128 });
  const decision = eligibilityIssuer.issue({ schemaVersion: 1, decisionId: "DECISION:CLIP:1", clipCommitment: CLIP, assetId: ASSET, manifestHash: MANIFEST, creatorProfileCommitment: CREATOR, profileGeneration: 4, audience: "PUBLIC", moderation: "APPROVED", rightsState: "CLEARED", ageEligible: true, audienceAllowed: true, promotionDeclared: false, evaluatedAt: NOW, expiresAt: "2026-08-09T22:05:00Z", issuerKeyId: "KEY:SAFETY:1", signature: H128 });
  const profiles = new ProfileBoundary(), engagementPolicy = new EngagementPolicyBoundary(); profiles.register(CREATOR, 4); profiles.register(VIEWER, 9);
  const registry = new SocialClipRegistry(new MediaBoundary(media, MANIFEST), profiles, engagementPolicy);

  expectSocial(() => registry.publish({ ...command, unexpected: true }, decision, { verify: () => true }, eligibilityIssuer, NOW), "CLIP_PUBLISH_INVALID");
  expectSocial(() => registry.publish({ ...command, clipCommitment: "0".repeat(64) }, decision, commandIssuer, eligibilityIssuer, NOW), "CLIP_SIGNATURE_INVALID");
  const staleDecision = eligibilityIssuer.issue({ ...decision, decisionId: "DECISION:CLIP:STALE", profileGeneration: 3 });
  expectSocial(() => registry.publish(command, staleDecision, commandIssuer, eligibilityIssuer, NOW), "CLIP_ELIGIBILITY_BINDING_MISMATCH");
  const staleCommand = commandIssuer.issue({ ...command, profileGeneration: 3 }), stalePairDecision = eligibilityIssuer.issue({ ...decision, decisionId: "DECISION:CLIP:STALE:PAIR", profileGeneration: 3 });
  expectSocial(() => registry.publish(staleCommand, stalePairDecision, commandIssuer, eligibilityIssuer, NOW), "PROFILE_GENERATION_STALE");
  const pendingDecision = eligibilityIssuer.issue({ ...decision, decisionId: "DECISION:CLIP:PENDING", moderation: "PENDING" });
  expectSocial(() => registry.publish(command, pendingDecision, commandIssuer, eligibilityIssuer, NOW), "CLIP_MODERATION_DENIED");
  const paidCommand = commandIssuer.issue({ ...command, promotionLabel: "PAID_PROMOTION" });
  expectSocial(() => registry.publish(paidCommand, decision, commandIssuer, eligibilityIssuer, NOW), "CLIP_PROMOTION_DISCLOSURE_REQUIRED");
  expectSocial(() => registry.publish(command, { ...decision, ageEligible: "true" }, commandIssuer, { verify: () => true }, NOW), "CLIP_ELIGIBILITY_INVALID");

  const clip = registry.publish(command, decision, commandIssuer, eligibilityIssuer, NOW);
  assert(clip.state === "ACTIVE" && clip.syntheticLabel === "SYSTEM_TEST" && clip.organicMetricEligible === false && clip.kidsEligible === false, "playable synthetic clip is labelled and excluded from organic and Kids surfaces");
  expectSocial(() => registry.publish(command, decision, commandIssuer, eligibilityIssuer, NOW), "CLIP_REPLAY");
  const relayer = `erd1${"r".repeat(58)}`, contractAddress = `erd1${"q".repeat(58)}`, context = { chainId: "D", contractAddress, relayer, relayerAgreementVerified: true, nowMs: NOW_MS, payments: [] as readonly unknown[] };
  let verificationMutation: () => void = () => {};
  const sandbox = new NexusActionsSandbox({ async verifyEd25519() { const mutate = verificationMutation; verificationMutation = () => {}; mutate(); return true; } });
  sandbox.registerCapability({ controller: CONTROLLER, actorKind: "HUMAN", actorCommitment: VIEWER, sessionPublicKey: SESSION, scopes: ["SOCIAL_PUBLIC"], maxActions: 1, validFromMs: NOW_MS - 1_000, expiresAtMs: NOW_MS + 60_000, authorizedRelayers: [relayer] }, CONTROLLER, NOW_MS);
  let retainedPrepared: PreparedAction | null = null;
  const recorder: LikeActionRecorder = { async prepareAction(envelope, signature, executionContext) { retainedPrepared = await sandbox.prepareAction(envelope as ActionEnvelope, signature, executionContext); return { envelope, context: executionContext, opaque: retainedPrepared }; }, commitPreparedAction(prepared) { return sandbox.commitPreparedAction(prepared.opaque as PreparedAction); }, abortPreparedAction(prepared) { sandbox.abortPreparedAction(prepared.opaque as PreparedAction); } };
  const likeEnvelope: ActionEnvelope = { version: 1, actorKind: "HUMAN", actorCommitment: VIEWER, actionType: "LIKE", objectCommitment: CLIP, payloadHashOrCid: MANIFEST, visibilityClass: "PUBLIC", actionNonce: 1n, issuedAtMs: NOW_MS - 100, expiresAtMs: NOW_MS + 10_000, sessionPublicKey: SESSION };
  function engagement(decisionId: string, overrides: Partial<ClipEngagementDecision> = {}): ClipEngagementDecision { return engagementIssuer.issue({ schemaVersion: 1, decisionId, action: "LIKE", clipCommitment: CLIP, actorProfileCommitment: VIEWER, actorProfileGeneration: 9, blocked: false, audienceAllowed: true, deviceActive: true, evaluatedAt: NOW, expiresAt: "2026-08-09T22:05:00Z", issuerKeyId: "KEY:ENGAGEMENT:1", signature: H128, ...overrides }); }
  function execution(value: ClipEngagementDecision, authorizationId: string, overrides: Partial<LikeExecutionAuthorization> = {}): LikeExecutionAuthorization { return executionIssuer.issue({ schemaVersion: 1, authorizationId, decisionId: value.decisionId, action: "LIKE", clipCommitment: value.clipCommitment, actorProfileCommitment: value.actorProfileCommitment, actorProfileGeneration: value.actorProfileGeneration, sessionPublicKey: SESSION, capabilityId: SESSION, actionNonce: "1", payloadCommitment: MANIFEST, chainId: "D", contractAddress, clipStateVersion: 1, mediaGeneration: 1, policyVersion: engagementPolicy.current().version, evaluatedAt: NOW, expiresAt: "2026-08-09T22:05:00Z", issuerKeyId: "KEY:RELAYER:1", signature: H128, ...overrides }); }

  const staleLike = engagement("DECISION:LIKE:STALE", { actorProfileGeneration: 8 });
  await expectSocialAsync(() => registry.executeLike(staleLike, execution(staleLike, "AUTH:LIKE:STALE"), likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "PROFILE_GENERATION_STALE");
  const blockedLike = engagement("DECISION:LIKE:BLOCKED", { blocked: true });
  await expectSocialAsync(() => registry.executeLike(blockedLike, execution(blockedLike, "AUTH:LIKE:BLOCKED"), likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "ENGAGEMENT_BLOCKED");
  const boolLike = engagement("DECISION:LIKE:BOOL");
  await expectSocialAsync(() => registry.executeLike({ ...boolLike, blocked: "false" }, execution(boolLike, "AUTH:LIKE:BOOL"), likeEnvelope, H128, context, { verify: () => true }, executionIssuer, recorder, NOW), "ENGAGEMENT_DECISION_INVALID");
  const targetLike = engagement("DECISION:LIKE:TARGET");
  await expectSocialAsync(() => registry.executeLike(targetLike, execution(targetLike, "AUTH:LIKE:TARGET"), { ...likeEnvelope, objectCommitment: "0".repeat(64) }, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "LIKE_ENVELOPE_BINDING_MISMATCH");

  const racedLike = engagement("DECISION:LIKE:RACE");
  verificationMutation = () => profiles.revoke(VIEWER, 9);
  await expectSocialAsync(() => registry.executeLike(racedLike, execution(racedLike, "AUTH:LIKE:RACE"), likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "CLIP_EXECUTION_STATE_CONFLICT");
  assert(sandbox.drainEvents().length === 0, "profile race after async signature creates no action");
  await expectChain(() => Promise.resolve(sandbox.commitPreparedAction(retainedPrepared as PreparedAction)), "PREPARED_ACTION_INVALID"); profiles.register(VIEWER, 9);

  const policyRaceLike = engagement("DECISION:LIKE:POLICY:RACE"), policyRaceAuthorization = execution(policyRaceLike, "AUTH:LIKE:POLICY:RACE");
  verificationMutation = () => engagementPolicy.set({ version: 2, blocked: true, audienceAllowed: false, deviceActive: false });
  await expectSocialAsync(() => registry.executeLike(policyRaceLike, policyRaceAuthorization, likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "CLIP_EXECUTION_STATE_CONFLICT");
  assert(sandbox.drainEvents().length === 0, "policy race after async signature creates no action");
  await expectChain(() => Promise.resolve(sandbox.commitPreparedAction(retainedPrepared as PreparedAction)), "PREPARED_ACTION_INVALID");
  engagementPolicy.set({ version: 3, blocked: false, audienceAllowed: true, deviceActive: true });

  const likeDecision = engagement("DECISION:LIKE:HAPPY"), likeAuthorization = execution(likeDecision, "AUTH:LIKE:HAPPY");
  const action = await registry.executeLike(likeDecision, likeAuthorization, likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW);
  assert(action.actionClass === "PUBLIC_ACTION" && action.objectCommitment === CLIP, "one distinct like records the clip commitment as a public action");
  await expectSocialAsync(() => registry.executeLike(likeDecision, likeAuthorization, likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "LIKE_AUTHORIZATION_REPLAY");
  await expectChain(() => sandbox.recordAction(likeEnvelope, H128, context), "CAPABILITY_ACTION_LIMIT");

  const authenticity = new Authenticity();
  const indexed = authenticity.register({ network: "devnet", contractAddress, originalTxHash: "1".repeat(64), sourceTxHash: "2".repeat(64), sourceKind: "SMART_CONTRACT_RESULT", eventIndex: 0, shard: 1, blockNonce: 20n, blockHash: "3".repeat(64), hyperblockNonce: 21n, hyperblockHash: "4".repeat(64), canonicality: "FINALIZED_CANONICAL", finality: "HYPERBLOCK_FINAL", contentHash: "5".repeat(64), authenticityProofHash: "6".repeat(64), payload: { kind: "ACTION_EXECUTED", aggregateId: "LIKE_CLIP_1", aggregateVersion: 1, actorCommitment: VIEWER, objectCommitment: CLIP, actionClass: "PUBLIC_ACTION", status: "EXECUTED_SUCCESS" } });
  const repairVerifier: RepairAuthorizationVerifier = { verifyRepairAuthorization() { return false; } }, repairStore: RepairCommitStore = { commitRepairAtomically() { return "COMMITTED"; } };
  const reducer = new ChainReducer(authenticity, repairVerifier, repairStore);
  assert(reducer.ingest(indexed) === "APPLIED", "final authentic like event is applied");
  const reduced = reducer.snapshot();
  assert(reduced.actions.length === 1 && reduced.actions[0].status === "EXECUTED_SUCCESS" && reduced.actions[0].objectCommitment === CLIP && reduced.reconciliation.status === "PASS", "like reaches terminal state with exact reconciliation");

  const purgeLikeDecision = engagement("DECISION:LIKE:PURGING"), purgeLikeAuthorization = execution(purgeLikeDecision, "AUTH:LIKE:PURGING");
  assert(media.requestPurge(ASSET).status === "PURGING", "purge removes playback eligibility immediately");
  await expectSocialAsync(() => registry.executeLike(purgeLikeDecision, purgeLikeAuthorization, likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "CLIP_NOT_PLAYABLE");
  for (const [target, hash] of [["ORIGIN", "1".repeat(64)], ["RENDITIONS", "2".repeat(64)], ["INDEX", "3".repeat(64)], ["CACHE", "4".repeat(64)]] as const) media.recordPurge(ASSET, target, hash);
  expectMedia(() => media.grantPlayback(ASSET, VIEWER, "OTHER", "RO", NOW_MS, 120), "PLAYBACK_NOT_READY");
  const purge = purgeIssuer.issue({ schemaVersion: 1, purgeId: "PURGE:CLIP:1", clipCommitment: CLIP, assetId: ASSET, reasonCode: "OWNER_DELETE", occurredAt: "2026-08-09T22:01:00Z", issuerKeyId: "KEY:MODERATION:1", signature: H128 });
  assert(registry.purge(purge, purgeIssuer, purge.occurredAt).state === "PURGED", "verified four-target media purge tombstones the clip");
  expectSocial(() => registry.purge(purge, purgeIssuer, purge.occurredAt), "CLIP_PURGE_REPLAY");
  const purgedLikeDecision = engagement("DECISION:LIKE:PURGED"), purgedLikeAuthorization = execution(purgedLikeDecision, "AUTH:LIKE:PURGED");
  await expectSocialAsync(() => registry.executeLike(purgedLikeDecision, purgedLikeAuthorization, likeEnvelope, H128, context, engagementIssuer, executionIssuer, recorder, NOW), "CLIP_NOT_PLAYABLE");

  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-SOCIAL-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", media: { authorized: true, clean: true, moderated: true, playable: true, purged: true, purge_targets: 4 }, labels: { synthetic: true, paid_declared_or_denied: true, organic_metric_eligible: false, kids_eligible: false }, action: { type: "LIKE", distinct_transaction: true, exact_authorization_binding: true, authorization_one_time: true, async_state_cas: true, policy_version_cas: true, prepared_abort: true, class: "PUBLIC_ACTION", terminal: true, reconciled: true, viewer_profile_generation: 9 }, negative: { exact_shape: true, forged_signature: true, creator_profile_generation_substitution: true, viewer_profile_generation_substitution: true, moderation_pending: true, promotion_undeclared: true, boolean_string: true, engagement_blocked: true, engagement_boolean_string: true, target_substitution: true, async_profile_race: true, async_policy_race: true, retained_prepared_commit: true, authorization_replay: true, publish_replay: true, action_replay: true, authorization_then_purge: true, engage_during_purge: true, playback_after_purge: true, purge_replay: true }, network_operations: 0, provider_operations: 0, economic_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}

void main();
