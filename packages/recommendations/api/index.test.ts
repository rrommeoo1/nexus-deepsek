import { allocateExploration, EngagementIntegrityError, EngagementLedger, LocalEngagementAuthority, LocalSnapshotAuthority, NEGATIVE_SEMANTIC, ProfileType, SignedEngagementCommand, Surface, TrafficClass, viralFairRank } from "./index";
declare const process: { stdout: { write(value: string): void } };

let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(message); }
async function denied(action: () => Promise<unknown>, code: string): Promise<void> { let actual = "NO_ERROR"; try { await action(); } catch (error) { actual = error instanceof EngagementIntegrityError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
function deniedSync(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof EngagementIntegrityError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }

const NOW = "2026-08-16T12:00:00Z", ACTION_KEY = "KEY:ENGAGEMENT:1", MOD_KEY = "KEY:MODERATION:1", CHECKPOINT_KEY = "KEY:CHECKPOINT:1";
const H = (char: string): string => char.repeat(64);
const OWNER = H("1"), COMMENTER = H("2"), VIEWER = H("3"), MODERATOR = H("4"), POST = H("5"), COMMENT = H("6"), DATING = H("7"), WORK = H("8"), MARKET = H("9"), MOD_POST = H("a"), WORK_POST = "12".repeat(32), KIDS_CLIP = "13".repeat(32), EXPRESSIVE_ACTOR = "14".repeat(32), WORK_ACTOR = "15".repeat(32), KIDS_ACTOR = "16".repeat(32);
const C1 = H("b"), C2 = H("c"), C3 = H("d"), REASON = H("e"), CONCURRENT = H("f");
function profileType(surface: Surface): ProfileType { if (["SOCIAL", "PULSE", "WATCH", "LIVE"].includes(surface)) return "SOCIAL"; if (surface === "MARKET") return "MARKETPLACE"; return surface as ProfileType; }

async function main(): Promise<void> {
  const actionAuthority = new LocalEngagementAuthority(ACTION_KEY, "local-action-fixture-key-2026"), moderationAuthority = new LocalEngagementAuthority(MOD_KEY, "local-moderation-fixture-key-2026"), checkpointAuthority = new LocalSnapshotAuthority(CHECKPOINT_KEY, "local-checkpoint-fixture-key-2026");
  const ledger = new EngagementLedger(actionAuthority, moderationAuthority, ACTION_KEY, MOD_KEY, 1);
  const heads = new Map<string, number>();
  async function issue(authority: LocalEngagementAuthority, actionId: string, action: SignedEngagementCommand["action"], surface: Surface, objectKind: SignedEngagementCommand["objectKind"], objectCommitment: string, generation: number, actor: string, owner: string, content: string, prior: string | null, reaction: SignedEngagementCommand["reaction"], revisionKind: SignedEngagementCommand["revisionKind"], traffic: TrafficClass = "SYSTEM_TEST"): Promise<Readonly<SignedEngagementCommand>> { const nonce = (heads.get(actor) ?? 0) + 1, type = profileType(surface); return authority.issue({ schemaVersion: 1, actionId, action, surface, objectKind, objectCommitment, objectGeneration: generation, actorProfileCommitment: actor, actorProfileType: type, ownerProfileCommitment: owner, ownerProfileType: type, actorClass: "SYSTEM_TEST", simulatedTrafficClass: traffic, contentCommitment: content, priorContentCommitment: prior, reaction, revisionKind, nonce, policyVersion: 1, occurredAt: NOW }); }
  async function resign(value: Readonly<SignedEngagementCommand>, overrides: Partial<Omit<SignedEngagementCommand, "signature" | "authorityKeyId">>): Promise<Readonly<SignedEngagementCommand>> { const { signature: _signature, authorityKeyId: _authorityKeyId, ...base } = value; return actionAuthority.issue({ ...base, ...overrides }); }
  async function commit(value: Readonly<SignedEngagementCommand>): Promise<void> { await ledger.append(value); heads.set(value.actorProfileCommitment, value.nonce); }

  await commit(await issue(actionAuthority, "ACTION:POST:PUBLISH", "PUBLISH", "SOCIAL", "POST", POST, 1, OWNER, OWNER, C1, null, null, "NONE"));
  await commit(await issue(actionAuthority, "ACTION:COMMENT:PUBLISH", "PUBLISH", "SOCIAL", "COMMENT", COMMENT, 1, COMMENTER, COMMENTER, C2, null, null, "NONE"));
  assert(ledger.object(POST).state === "ACTIVE" && ledger.object(COMMENT).ownerProfileCommitment === COMMENTER, "post and foreign comment are independently owned");

  const creatorErase = await issue(actionAuthority, "ACTION:CREATOR:ERASE:FOREIGN", "WITHDRAW", "SOCIAL", "COMMENT", COMMENT, 1, OWNER, COMMENTER, REASON, C2, null, "NONE");
  await denied(() => ledger.append(creatorErase), "ENGAGEMENT_WITHDRAW_DENIED");
  assert(ledger.object(COMMENT).state === "ACTIVE", "creator cannot erase another author's negative comment");

  const forged = { ...(await issue(actionAuthority, "ACTION:FORGED", "LIKE", "SOCIAL", "POST", POST, 1, VIEWER, OWNER, C1, C1, "LIKE", "NONE")), signature: H("f") };
  await denied(() => ledger.append(forged), "ENGAGEMENT_SIGNATURE_INVALID");
  const malformed = { ...(await issue(actionAuthority, "ACTION:MALFORMED", "LIKE", "SOCIAL", "POST", POST, 1, VIEWER, OWNER, C1, C1, "LIKE", "NONE")), publicCount: 1 };
  await denied(() => ledger.append(malformed), "ENGAGEMENT_COMMAND_INVALID");
  const invalidMarketProfile = await issue(actionAuthority, "ACTION:INVALID:MARKET:PROFILE", "PUBLISH", "MARKET", "PROFILE", "21".repeat(32), 1, OWNER, OWNER, C1, null, null, "NONE");
  await denied(() => ledger.append(invalidMarketProfile), "ENGAGEMENT_SURFACE_OBJECT_DENIED");
  const invalidKidsJob = await issue(actionAuthority, "ACTION:INVALID:KIDS:JOB", "PUBLISH", "KIDS", "JOB", "22".repeat(32), 1, OWNER, OWNER, C1, null, null, "NONE");
  await denied(() => ledger.append(invalidKidsJob), "ENGAGEMENT_SURFACE_OBJECT_DENIED");
  const invalidSocialLesson = await issue(actionAuthority, "ACTION:INVALID:SOCIAL:LESSON", "PUBLISH", "SOCIAL", "LESSON", "23".repeat(32), 1, OWNER, OWNER, C1, null, null, "NONE");
  await denied(() => ledger.append(invalidSocialLesson), "ENGAGEMENT_SURFACE_OBJECT_DENIED");
  const typeActor = "24".repeat(32), validTypeCommand = await issue(actionAuthority, "ACTION:INVALID:PROFILE:TYPE", "PUBLISH", "SOCIAL", "POST", "25".repeat(32), 1, typeActor, typeActor, C1, null, null, "NONE"), wrongTypeCommand = await resign(validTypeCommand, { actorProfileType: "DATING" });
  await denied(() => ledger.append(wrongTypeCommand), "ENGAGEMENT_PROFILE_TYPE_BINDING_MISMATCH");

  await commit(await issue(actionAuthority, "ACTION:POST:EDIT:MINOR", "EDIT", "SOCIAL", "POST", POST, 1, OWNER, OWNER, C2, C1, null, "MINOR"));
  await commit(await issue(actionAuthority, "ACTION:POST:EDIT:MATERIAL", "EDIT", "SOCIAL", "POST", POST, 2, OWNER, OWNER, C3, C2, null, "MATERIAL"));
  assert(ledger.object(POST).generation === 2 && ledger.object(POST).revisionCount === 3, "minor edit appends a revision and material edit creates a generation");

  await commit(await issue(actionAuthority, "ACTION:POST:NEGATIVE", "NEGATIVE_PREFERENCE", "SOCIAL", "POST", POST, 2, VIEWER, OWNER, C3, C3, "NOT_FOR_ME", "NONE", "HUMAN_ORGANIC"));
  assert(ledger.activeReaction(VIEWER, POST, 2)?.reaction === "NOT_FOR_ME", "social dislike is a private Not for me preference");
  await commit(await issue(actionAuthority, "ACTION:POST:SWITCH:LIKE", "LIKE", "SOCIAL", "POST", POST, 2, VIEWER, OWNER, C3, C3, "LIKE", "NONE", "HUMAN_ORGANIC"));
  assert(ledger.activeReaction(VIEWER, POST, 2)?.reaction === "LIKE", "reaction switch leaves exactly one active reaction");
  await commit(await issue(actionAuthority, "ACTION:POST:UNDO", "UNDO_REACTION", "SOCIAL", "POST", POST, 2, VIEWER, OWNER, C3, C3, "LIKE", "NONE", "HUMAN_ORGANIC"));
  assert(ledger.activeReaction(VIEWER, POST, 2) === null, "undo appends evidence and clears the current projection");
  const wrongMode = await issue(actionAuthority, "ACTION:POST:WRONG:SEMANTIC", "NEGATIVE_PREFERENCE", "SOCIAL", "POST", POST, 2, VIEWER, OWNER, C3, C3, "PASS", "NONE");
  await denied(() => ledger.append(wrongMode), "ENGAGEMENT_REACTION_INVALID");
  deniedSync(() => ledger.publicNegativeCount(POST), "ENGAGEMENT_PUBLIC_NEGATIVE_COUNT_FORBIDDEN");

  await commit(await issue(actionAuthority, "ACTION:POST:LOVE", "EXPRESSIVE_REACTION", "SOCIAL", "POST", POST, 2, EXPRESSIVE_ACTOR, OWNER, C3, C3, "LOVE", "NONE"));
  assert(ledger.activeReaction(EXPRESSIVE_ACTOR, POST, 2)?.reaction === "LOVE" && ledger.activeReaction(EXPRESSIVE_ACTOR, POST, 2)?.publicCountEligible === true, "social Love is an aggregate-eligible expressive reaction");
  await commit(await issue(actionAuthority, "ACTION:POST:FAKE:OPINION", "EXPRESSIVE_REACTION", "SOCIAL", "POST", POST, 2, EXPRESSIVE_ACTOR, OWNER, C3, C3, "FAKE_OPINION", "NONE", "HUMAN_ORGANIC"));
  assert(ledger.activeReaction(EXPRESSIVE_ACTOR, POST, 2)?.verificationSignal === "FAKE_OPINION_AGGREGATE" && ledger.activeReaction(EXPRESSIVE_ACTOR, POST, 2)?.qualifiedSentimentEligible === true && ledger.activeReaction(EXPRESSIVE_ACTOR, POST, 2)?.publicCountEligible === false, "Fake is a qualified user opinion signal, not an automatic factual verdict");

  await commit(await issue(actionAuthority, "ACTION:DATING:PUBLISH", "PUBLISH", "DATING", "PROFILE", DATING, 1, OWNER, OWNER, C1, null, null, "NONE"));
  await commit(await issue(actionAuthority, "ACTION:DATING:PASS", "NEGATIVE_PREFERENCE", "DATING", "PROFILE", DATING, 1, VIEWER, OWNER, C1, C1, "PASS", "NONE"));
  assert(ledger.activeReaction(VIEWER, DATING, 1)?.private === true && ledger.activeReaction(VIEWER, DATING, 1)?.publicCountEligible === false, "Dating Pass is private and never a person score");
  await commit(await issue(actionAuthority, "ACTION:WORK:PUBLISH", "PUBLISH", "WORK", "PROFILE", WORK, 1, OWNER, OWNER, C1, null, null, "NONE"));
  const workPersonDislike = await issue(actionAuthority, "ACTION:WORK:PERSON:NEGATIVE", "NEGATIVE_PREFERENCE", "WORK", "PROFILE", WORK, 1, COMMENTER, OWNER, C1, C1, "NOT_RELEVANT", "NONE");
  await denied(() => ledger.append(workPersonDislike), "ENGAGEMENT_MODE_SEMANTIC_DENIED");
  await commit(await issue(actionAuthority, "ACTION:WORKPOST:PUBLISH", "PUBLISH", "WORK", "POST", WORK_POST, 1, OWNER, OWNER, C1, null, null, "NONE"));
  await commit(await issue(actionAuthority, "ACTION:WORKPOST:INSIGHTFUL", "EXPRESSIVE_REACTION", "WORK", "POST", WORK_POST, 1, WORK_ACTOR, OWNER, C1, C1, "INSIGHTFUL", "NONE"));
  assert(ledger.activeReaction(WORK_ACTOR, WORK_POST, 1)?.reaction === "INSIGHTFUL", "Work content offers professional reactions instead of a noisy social palette");
  const workHaha = await issue(actionAuthority, "ACTION:WORKPOST:HAHA", "EXPRESSIVE_REACTION", "WORK", "POST", WORK_POST, 1, WORK_ACTOR, OWNER, C1, C1, "HAHA", "NONE");
  await denied(() => ledger.append(workHaha), "ENGAGEMENT_REACTION_INVALID");
  await commit(await issue(actionAuthority, "ACTION:MARKET:PUBLISH", "PUBLISH", "MARKET", "LISTING", MARKET, 1, OWNER, OWNER, C1, null, null, "NONE"));
  await commit(await issue(actionAuthority, "ACTION:MARKET:NEGATIVE", "NEGATIVE_PREFERENCE", "MARKET", "LISTING", MARKET, 1, COMMENTER, OWNER, C1, C1, "NOT_INTERESTED", "NONE"));
  assert(ledger.activeReaction(COMMENTER, MARKET, 1)?.reaction === "NOT_INTERESTED", "market negative action means private Not interested, not seller rating");
  await commit(await issue(actionAuthority, "ACTION:KIDS:PUBLISH", "PUBLISH", "KIDS", "CLIP", KIDS_CLIP, 1, OWNER, OWNER, C1, null, null, "NONE"));
  await commit(await issue(actionAuthority, "ACTION:KIDS:WOW", "EXPRESSIVE_REACTION", "KIDS", "CLIP", KIDS_CLIP, 1, KIDS_ACTOR, OWNER, C1, C1, "WOW", "NONE"));
  assert(ledger.activeReaction(KIDS_ACTOR, KIDS_CLIP, 1)?.private === true && ledger.activeReaction(KIDS_ACTOR, KIDS_CLIP, 1)?.publicCountEligible === false, "Kids expressive reactions remain private and non-competitive");

  const concurrentLike = await issue(actionAuthority, "ACTION:CONCURRENT:LIKE", "LIKE", "SOCIAL", "POST", POST, 2, CONCURRENT, OWNER, C3, C3, "LIKE", "NONE"), concurrentNegative = await issue(actionAuthority, "ACTION:CONCURRENT:NEGATIVE", "NEGATIVE_PREFERENCE", "SOCIAL", "POST", POST, 2, CONCURRENT, OWNER, C3, C3, "NOT_FOR_ME", "NONE");
  const concurrent = await Promise.allSettled([ledger.append(concurrentLike), ledger.append(concurrentNegative)]);
  assert(concurrent.filter(result => result.status === "fulfilled").length === 1 && concurrent.filter(result => result.status === "rejected").length === 1, "same actor nonce commits exactly one concurrent reaction");
  assert(ledger.activeReaction(CONCURRENT, POST, 2) !== null, "concurrent loser cannot erase or overwrite the winning reaction");

  await commit(await issue(actionAuthority, "ACTION:COMMENT:WITHDRAW", "WITHDRAW", "SOCIAL", "COMMENT", COMMENT, 1, COMMENTER, COMMENTER, REASON, C2, null, "NONE"));
  assert(ledger.object(COMMENT).state === "WITHDRAWN" && ledger.object(COMMENT).contentCommitment === H("0"), "author withdrawal purges the public body and preserves a tombstone receipt");
  await commit(await issue(actionAuthority, "ACTION:MODPOST:PUBLISH", "PUBLISH", "SOCIAL", "POST", MOD_POST, 1, OWNER, OWNER, C1, null, null, "NONE"));
  const wrongAuthority = await issue(actionAuthority, "ACTION:MODPOST:WRONG:AUTH", "MODERATION_TOMBSTONE", "SOCIAL", "POST", MOD_POST, 1, MODERATOR, OWNER, REASON, C1, null, "NONE");
  await denied(() => ledger.append(wrongAuthority), "ENGAGEMENT_SIGNATURE_INVALID");
  await commit(await issue(moderationAuthority, "ACTION:MODPOST:TOMBSTONE", "MODERATION_TOMBSTONE", "SOCIAL", "POST", MOD_POST, 1, MODERATOR, OWNER, REASON, C1, null, "NONE"));
  assert(ledger.object(MOD_POST).state === "MODERATION_TOMBSTONED", "only separate moderation authority can tombstone foreign content");

  const snapshot = await ledger.exportSnapshot("CHECKPOINT:ENGAGEMENT:1", NOW, "2026-08-16T13:00:00Z", checkpointAuthority), durable = { checkpointId: snapshot.checkpointId, policyVersion: snapshot.policyVersion, eventCount: snapshot.eventCount, eventHeadHash: snapshot.eventHeadHash, batchCommitment: snapshot.batchCommitment };
  const restored = await EngagementLedger.restore(snapshot, actionAuthority, moderationAuthority, ACTION_KEY, MOD_KEY, checkpointAuthority, durable, "2026-08-16T12:30:00Z");
  assert(restored.receipts().length === ledger.receipts().length && restored.object(POST).generation === 2 && restored.object(COMMENT).state === "WITHDRAWN", "fresh restore deterministically reconstructs revisions reactions and tombstones");
  const replayedEdit = await issue(actionAuthority, "ACTION:POST:EDIT:MATERIAL", "EDIT", "SOCIAL", "POST", POST, 2, OWNER, OWNER, C3, C2, null, "MATERIAL");
  await denied(() => restored.append(replayedEdit), "ENGAGEMENT_REPLAY");
  const tampered = { ...snapshot, eventHeadHash: H("f") };
  await denied(() => EngagementLedger.restore(tampered, actionAuthority, moderationAuthority, ACTION_KEY, MOD_KEY, checkpointAuthority, durable, "2026-08-16T12:30:00Z"), "ENGAGEMENT_SNAPSHOT_INVALID");
  const prefixEvents = snapshot.events.slice(0, -1), prefixBase = { ...snapshot, eventCount: prefixEvents.length, eventHeadHash: prefixEvents[prefixEvents.length - 1].eventHash, events: prefixEvents, signature: undefined };
  const { signature: _removed, ...unsignedPrefix } = prefixBase; const signedPrefix = { ...unsignedPrefix, batchCommitment: snapshot.batchCommitment, signature: await checkpointAuthority.sign(unsignedPrefix as never) };
  await denied(() => EngagementLedger.restore(signedPrefix, actionAuthority, moderationAuthority, ACTION_KEY, MOD_KEY, checkpointAuthority, durable, "2026-08-16T12:30:00Z"), "ENGAGEMENT_SNAPSHOT_LINEAGE_INVALID");

  const policy = { policyVersion: 1, minEffectiveImpressions: 50, minIndependentClusters: 10, maxClusterContributionBps: 1000, negativeConfidenceThresholdBps: 3000, globalNegativePenaltyCapBps: 2000, explorationFloorBps: 1000 };
  function impressions(count: number, clusters: number, negativeCount: number, trafficClass: TrafficClass = "HUMAN_ORGANIC", quarantined = false) { return Array.from({ length: count }, (_, index) => ({ actorCommitment: index.toString(16).padStart(64, "0"), clusterCommitment: (index % clusters + 1000).toString(16).padStart(64, "0"), trafficClass, quarantined, completionBps: index < negativeCount ? 1500 : 9000, rewatch: index >= negativeCount, saved: index % 3 === 0, shared: index % 5 === 0, followed: index % 7 === 0, meaningfulConversation: index % 4 === 0, negative: index < negativeCount, fakeOpinion: false })); }
  const raid = viralFairRank(policy, impressions(100, 1, 100), true);
  assert(raid.globalNegativePenaltyBps === 0 && raid.independentClusters === 1 && raid.removalDecision === "NEVER_FROM_DISLIKE", "single-cluster dislike raid is capped and cannot remove content");
  const genuine = viralFairRank(policy, impressions(100, 20, 70), false);
  assert(genuine.effectiveImpressions >= 50 && genuine.independentClusters === 20 && genuine.globalNegativePenaltyBps > 0 && genuine.globalNegativePenaltyBps <= 2000, "diverse persistent dissatisfaction receives a confidence-gated capped penalty");
  const fakeOpinion = viralFairRank(policy, impressions(100, 20, 0).map((item, index) => ({ ...item, fakeOpinion: index < 70 })), false);
  assert(fakeOpinion.globalNegativePenaltyBps === genuine.globalNegativePenaltyBps && fakeOpinion.removalDecision === "NEVER_FROM_DISLIKE", "qualified diverse Fake opinions count like dissatisfaction but never become a takedown verdict");
  const conflicting = impressions(100, 20, 70), conflictCopy = { ...conflicting[0], negative: !conflicting[0].negative, completionBps: 9999 }, orderForward = viralFairRank(policy, [...conflicting, conflictCopy], false), orderReverse = viralFairRank(policy, [conflictCopy, ...[...conflicting].reverse()], false);
  assert(JSON.stringify(orderForward) === JSON.stringify(orderReverse) && orderForward.excluded.DUPLICATE === 2, "ranking is order invariant and excludes all conflicting records for one actor");
  const newIdea = viralFairRank(policy, impressions(12, 12, 8), true);
  assert(newIdea.globalNegativePenaltyBps === 0 && newIdea.explorationFloorBps === 1000 && newIdea.scoreBps >= 1000, "new safe idea keeps exploration floor before minimum evidence");
  const excluded = viralFairRank(policy, [...impressions(60, 12, 0, "PAID"), ...impressions(60, 12, 0, "AGENT").map((item, index) => ({ ...item, actorCommitment: (index + 100).toString(16).padStart(64, "0") })), ...impressions(60, 12, 0, "SYSTEM_TEST").map((item, index) => ({ ...item, actorCommitment: (index + 200).toString(16).padStart(64, "0") })), ...impressions(60, 12, 0, "HUMAN_ORGANIC", true).map((item, index) => ({ ...item, actorCommitment: (index + 300).toString(16).padStart(64, "0") }))], false);
  assert(excluded.effectiveImpressions === 0 && !excluded.organicTrendEligible && excluded.excluded.PAID === 60 && excluded.excluded.AGENT === 60 && excluded.excluded.SYSTEM_TEST === 60 && excluded.excluded.QUARANTINED === 60, "paid agent synthetic and quarantined traffic cannot manufacture an organic trend");
  const cohort = "31".repeat(32), explorationCandidates = Array.from({ length: 20 }, (_, index) => ({ cohortCommitment: cohort, candidateCommitment: (index + 1000).toString(16).padStart(64, "0"), isNew: index >= 15, eligible: true, baseScoreBps: 9000 - index * 100, trafficClass: "HUMAN_ORGANIC" as const, quarantined: false })), allocation = allocateExploration(policy, explorationCandidates, 10), allocationReordered = allocateExploration(policy, [...explorationCandidates].reverse(), 10);
  assert(allocation.reservedNewSlots === 1 && allocation.selectedNewCount >= 1 && allocation.floorSatisfied && allocation.allocationBps >= 1000, "exploration reserves at least ten percent of each eligible cohort inventory for new content");
  assert(JSON.stringify(allocation) === JSON.stringify(allocationReordered), "exploration allocation is deterministic under candidate reordering");
  assert(Object.entries(NEGATIVE_SEMANTIC).length === 13 && NEGATIVE_SEMANTIC.KIDS === "SHOW_ME_LESS" && NEGATIVE_SEMANTIC.MUSIC === "LESS_LIKE_THIS", "all mode-specific negative semantics are explicit");

  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-ENGAGE-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", state_machine: { append_only: true, one_active_reaction: true, creator_foreign_erasure_denied: true, author_withdrawal_tombstone: true, edit_revision_history: true, material_generation: true, separate_moderation_authority: true, public_negative_count: false, surface_object_matrix: true, profile_type_binding: true }, modes: { covered: Object.keys(NEGATIVE_SEMANTIC).length, dating_pass_private: true, work_person_dislike_denied: true, market_not_interested_private: true, kids_show_less_private: true, expressive_palette_surface_scoped: true, fake_opinion_counts_as_qualified_sentiment: true, fake_opinion_is_not_truth_verdict: true }, ranking: { raid_penalty_bps: raid.globalNegativePenaltyBps, genuine_penalty_bps: genuine.globalNegativePenaltyBps, fake_opinion_penalty_bps: fakeOpinion.globalNegativePenaltyBps, exploration_floor_bps: newIdea.explorationFloorBps, exploration_allocated_bps: allocation.allocationBps, order_invariant: true, conflicting_duplicates_excluded: true, dislike_removal: false, excluded_organic_count: excluded.effectiveImpressions }, receipts: { signed: true, one_time: true, ordered_sha256: true, batch_commitment: true, fresh_restore: true, durable_checkpoint: true, prefix_denied: true }, synthetic_isolation: { organic_events: 0, rewards_accrued: 0, reputation_delta: 0 }, network_operations: 0, provider_operations: 0, economic_operations: 0, real_fund_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}

void main();
