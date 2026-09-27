// Nexus SyntheticActorLab — deterministic, local-only, zero network and zero funds.
// Logical actors exercise real repository state machines but remain SYSTEM_TEST,
// permanently excluded from organic discovery, Sigils and economics.
import { performance } from "node:perf_hooks";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

const TYPES = ["new_user", "viewer", "creator", "commenter", "follower", "private_profile", "abusive_actor", "accessibility_user", "multilingual_user", "message_request_user"];
const REACTIONS = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY", "FAKE_OPINION", "DISLIKE"];
const bounded = (value) => Math.max(2, Math.min(10_000, Number(value) || 1_000));

export function runActors({ count = 1_000, seed = 0x4e585553 } = {}) {
  count = bounded(count);
  let randomState = seed >>> 0;
  const random = () => ((randomState = (randomState * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const started = performance.now();
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const summary = { actors: 0, posts: 0, follows: 0, reactions: 0, comments: 0, replies: 0, saves: 0, reposts: 0, conversations: 0, messages: 0, stories: 0, story_views: 0, blocks: 0 };
  const issues = [];
  try {
    const actors = Array.from({ length: count }, (_, index) => {
      const type = TYPES[index % TYPES.length];
      const user = repo.createUser({ handle: `systemtest_${type}_${String(index).padStart(5, "0")}`, displayName: `SYSTEM_TEST ${type} ${index}`, bio: `SYSTEM_TEST seed=${seed}`, trafficClass: "SYSTEM_TEST" });
      repo.ensurePersona(user.id, "social", { visibility: type === "private_profile" ? "private" : "public", regionCode: index % 2 ? "PL-MAZ" : "RO-B", contentLanguages: index % 3 ? ["ro", "en"] : ["ar", "en"] });
      summary.actors++;
      return { ...user, type };
    });

    actors.forEach((actor, index) => {
      const next = actors[(index + 1) % actors.length];
      const other = actors[(index + 7) % actors.length];
      const post = repo.createPost({ userId: actor.id, persona: "social", kind: index % 3 ? "text" : "video", caption: `SYSTEM_TEST post ${index}`, visibility: actor.type === "private_profile" ? "private" : "public", regionCode: index % 2 ? "PL-MAZ" : "RO-B", language: index % 3 ? "ro" : "en" });
      summary.posts++;
      repo.setFollow(actor.id, next.id, "social", true); summary.follows++;
      if (random() > .78) { repo.setFollow(actor.id, other.id, "social", true); summary.follows++; }
      // Private profiles require a paid entitlement, not merely a follow. The local
      // lab never forges settlement, so its owner exercises the content while the
      // dedicated privacy suite verifies entitled and denied external readers.
      const reader = actor.type === "private_profile" ? actor : next;
      repo.setPostReaction(reader.id, "social", post.id, REACTIONS[index % REACTIONS.length], true); summary.reactions++;
      const parent = repo.addSocialComment({ userId: reader.id, actorPersona: "social", postId: post.id, body: `SYSTEM_TEST comment ${index}` }); summary.comments++;
      if (index % 3 === 0) { repo.addSocialComment({ userId: actor.id, actorPersona: "social", postId: post.id, parentId: parent.id, body: `SYSTEM_TEST reply ${index}` }); summary.replies++; }
      if (index % 2 === 0) { repo.setSavedPost(reader.id, "social", post.id, true); summary.saves++; }
      if (index % 6 === 0) { repo.setPostRepost(reader.id, "social", post.id, true); summary.reposts++; }
      if (index % 8 === 0) {
        const story = repo.createStory({ userId: actor.id, persona: "social", caption: `SYSTEM_TEST story ${index}`, visibility: "public", expiresAt: Math.floor(Date.now() / 1000) + 86400 });
        repo.recordStoryView(story.id, reader.id, "social", 1, true); summary.stories++; summary.story_views++;
      }
      if (index % 10 === 0) {
        const conversation = repo.createDirectConversation({ creatorId: actor.id, recipientId: next.id, contextPersona: "social" });
        if (conversation) { summary.conversations++; if (repo.sendConversationMessage({ conversationId: conversation.id, senderId: actor.id, senderPersona: "social", body: `SYSTEM_TEST message ${index}`, clientNonce: `actor:${seed}:${index}` })) summary.messages++; }
      }
      if (actor.type === "abusive_actor") { repo.setProfileBlock(next.id, "social", actor.id, true); summary.blocks++; }
    });

    const tagged = actors.every((actor) => repo.getUserById(actor.id)?.traffic_class === "SYSTEM_TEST");
    const organicLeak = actors.slice(0, 20).some((actor) => repo.listSocialFeed(actor.id, { lens: "for-you", limit: 100 }).some((post) => String(post.author?.handle || "").startsWith("systemtest_")));
    const sigilLeak = actors.slice(0, 20).some((actor) => repo.sigilProgress(actor.id, "social").earned);
    const selfFollows = Number(db.prepare(`SELECT COUNT(*) count FROM follows WHERE follower_id = followee_id`).get().count);
    const badThreads = Number(db.prepare(`SELECT COUNT(*) count FROM comments c LEFT JOIN comments p ON p.id=c.parent_id WHERE c.parent_id IS NOT NULL AND (p.id IS NULL OR p.post_id<>c.post_id)`).get().count);
    if (!tagged) issues.push({ id: "ACTOR-TAG-001", severity: "T0", journey: "creation→traffic isolation" });
    if (organicLeak) issues.push({ id: "ACTOR-RANK-001", severity: "T0", journey: "synthetic engagement→organic feed" });
    if (sigilLeak) issues.push({ id: "ACTOR-SIGIL-001", severity: "T0", journey: "synthetic followers→Sigil" });
    if (selfFollows) issues.push({ id: "ACTOR-GRAPH-001", severity: "T1", journey: "graph→self follow", actual: selfFollows });
    if (badThreads) issues.push({ id: "ACTOR-THREAD-001", severity: "T1", journey: "comments→thread", actual: badThreads });
    return { lab: "NEXUS_SYNTHETIC_ACTOR_LAB_V2", local_only: true, network_egress: false, real_funds: false, seed, count, elapsed_ms: Math.round(performance.now() - started), summary, checks: { tagged, organicLeak, sigilLeak, selfFollows, badThreads }, issues, deployment_gate: issues.length ? "BLOCKED" : "PASS" };
  } finally { db.close(); }
}

if (process.argv[1]?.endsWith("actors.js")) {
  const count = process.argv.find((arg) => arg.startsWith("--count="))?.split("=")[1] ?? process.env.ACTORS;
  const seed = process.argv.find((arg) => arg.startsWith("--seed="))?.split("=")[1];
  const report = runActors({ count, seed: seed == null ? undefined : Number(seed) });
  console.log(JSON.stringify(report, null, 2));
  if (report.deployment_gate !== "PASS") process.exitCode = 1;
}
