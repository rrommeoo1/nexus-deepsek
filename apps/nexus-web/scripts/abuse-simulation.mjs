// Local abuse simulation with logical SYSTEM_TEST actors. Synthetic activity can
// exercise real state machines but must never affect organic rank or enforcement.
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { completeMutationRecord, prepareMutation } from "../lib/mutation-idempotency.js";

const bounded = (value) => Math.max(10, Math.min(2_000, Number(value) || 250));

export function runAbuseSimulation({ actorCount = 250 } = {}) {
  actorCount = bounded(actorCount);
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const summary = { actors: 0, spam_posts: 0, follow_attempts: 0, report_attempts: 0, unique_reports: 0, organic_context_reports: 0, blocked: 0, denied_after_block: 0, replay_requests: 0 };
  let syntheticSigilLeak = false;
  try {
    const target = repo.createUser({ handle: "abuse_target", displayName: "Organic target" });
    const organicViewer = repo.createUser({ handle: "organic_observer", displayName: "Organic observer" });
    repo.ensurePersona(target.id, "social", { visibility: "public" });
    repo.ensurePersona(organicViewer.id, "social", { visibility: "public" });
    const targetPost = repo.createPost({ userId: target.id, persona: "social", caption: "Organic safety target", visibility: "public" });

    for (let index = 0; index < actorCount; index++) {
      const actor = repo.createUser({
        handle: `systemtest_abuse_${String(index).padStart(4, "0")}`,
        displayName: `SYSTEM_TEST abusive ${index}`,
        trafficClass: "SYSTEM_TEST",
      });
      repo.ensurePersona(actor.id, "social", { visibility: "public" });
      summary.actors++;
      repo.createPost({ userId: actor.id, persona: "social", caption: `SYSTEM_TEST repeated spam ${index}`, visibility: "public" });
      summary.spam_posts++;
      repo.setFollow(actor.id, target.id, "social", true);
      summary.follow_attempts++;
      syntheticSigilLeak ||= repo.sigilProgress(target.id, "social").qualified_followers !== 0;

      const firstReport = repo.createModerationReport({
        reporterId: actor.id, reporterPersona: "social", subjectType: "post",
        subjectId: targetPost.id, category: "SCAM_FRAUD", details: "SYSTEM_TEST flood",
      });
      const replayReport = repo.createModerationReport({
        reporterId: actor.id, reporterPersona: "social", subjectType: "post",
        subjectId: targetPost.id, category: "SCAM_FRAUD", details: "SYSTEM_TEST changed replay",
      });
      summary.report_attempts += 2;
      if (firstReport.id === replayReport.id && firstReport.outcome === "EXCLUDED_FROM_ENFORCEMENT") summary.unique_reports++;

      repo.setPostReaction(actor.id, "social", targetPost.id, index % 2 ? "LIKE" : "DISLIKE", true);
      repo.setProfileBlock(target.id, "social", actor.id, true);
      summary.blocked++;
      try { repo.setPostReaction(actor.id, "social", targetPost.id, "LIKE", true); }
      catch (error) { if (String(error?.message).includes("SOCIAL_REACTION_TARGET_INVALID")) summary.denied_after_block++; }

      const key = `systemtest-abuse-mutation-${String(index).padStart(6, "0")}`;
      const targetPath = `/api/posts/${targetPost.id}/report`;
      const body = Buffer.from('{"category":"SCAM_FRAUD"}');
      const prepared = prepareMutation({ db, userId: actor.id, actorPersona: "social", key, method: "POST", requestTarget: targetPath, body, now: 100 });
      completeMutationRecord({ db, mutationId: prepared.id, status: 201, body: '{"ok":true}', now: 101 });
      for (let wave = 0; wave < 3; wave++) {
        const replay = prepareMutation({ db, userId: actor.id, actorPersona: "social", key, method: "POST", requestTarget: targetPath, body, now: 102 + wave });
        if (replay.action === "replay") summary.replay_requests++;
      }
    }

    // Model compromised or newly-created accounts that are not yet classified as
    // synthetic. Their reports are valid context signals, never vote-count takedowns.
    const contextReporterCount = Math.min(25, actorCount);
    for (let index = 0; index < contextReporterCount; index++) {
      const reporter = repo.createUser({ handle: `context_reporter_${index}`, displayName: `Context reporter ${index}` });
      repo.ensurePersona(reporter.id, "social", { visibility: "public" });
      const report = repo.createModerationReport({
        reporterId: reporter.id, reporterPersona: "social", subjectType: "post",
        subjectId: targetPost.id, category: "SCAM_FRAUD", details: "Coordinated context-only report rehearsal",
      });
      if (report.outcome === "NO_AUTOMATIC_TAKEDOWN") summary.organic_context_reports++;
    }

    const organicFeed = repo.listSocialFeed(organicViewer.id, { viewerPersona: "social", lens: "for-you", limit: 100 });
    const reactions = repo.postReactionSummary(targetPost.id, organicViewer.id, "social");
    const checks = {
      reports_idempotent: summary.unique_reports === actorCount
        && Number(db.prepare("SELECT count(*) count FROM moderation_reports WHERE status = 'RECEIVED_TEST_EXCLUDED'").get().count) === actorCount,
      reports_excluded_from_enforcement: repo.getPostById(targetPost.id).status === "active",
      synthetic_engagement_excluded: Object.values(reactions.counts).reduce((sum, count) => sum + Number(count), 0) === 0,
      synthetic_content_excluded_from_feed: organicFeed.every((post) => post.author?.traffic_class !== "SYSTEM_TEST" && !post.author?.handle?.startsWith("systemtest_")),
      synthetic_follows_not_qualified: !syntheticSigilLeak && repo.sigilProgress(target.id, "social").qualified_followers === 0,
      block_removes_synthetic_follow_edges: repo.followCounts(target.id, "social").followers === 0,
      coordinated_reports_never_vote_takedown: summary.organic_context_reports === contextReporterCount && repo.getPostById(targetPost.id).status === "active",
      block_denies_future_engagement: summary.denied_after_block === actorCount,
      replay_flood_exactly_once: summary.replay_requests === actorCount * 3
        && Number(db.prepare("SELECT count(*) count FROM mutation_requests WHERE status = 'completed'").get().count) === actorCount,
      moderation_chain_consistent: repo.verifyModerationEventChain().internalLinkConsistency === true,
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return {
      schema: "NEXUS_SYNTHETIC_ABUSE_SIMULATION_V1", actor_count: actorCount, summary, checks,
      check_summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
      traffic_class: "SYSTEM_TEST", local_mock_only: true, network_egress: false,
      real_funds: false, incremental_cost: 0,
      trusted_edge_rate_limit_gate: "NOT_CLAIMED_LOCAL",
      gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL",
    };
  } finally { db.close(); }
}

if (process.argv[1]?.endsWith("abuse-simulation.mjs")) {
  const count = process.argv.find((value) => value.startsWith("--actors="))?.split("=")[1];
  const report = runAbuseSimulation({ actorCount: count });
  console.log(JSON.stringify(report, null, 2));
  if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
}
