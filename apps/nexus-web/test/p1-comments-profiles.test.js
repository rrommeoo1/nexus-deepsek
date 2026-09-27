test("the owner arranges the five content tabs, and every reader is shown the order they chose", async () => {
  const state = fixture();
  try {
    // A profile that never arranged anything is read in the product's own order.
    const untouched = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    assert.deepEqual(untouched.body.profile.tabs_order, ["flow", "reels", "shots", "whispers", "moments"]);

    // The owner moves whispers to the left: the rest keep the product's order and follow.
    const moved = await call(state.context, "PATCH", "/api/persona/social", {
      tabs_order: ["whispers", "flow", "reels", "shots", "moments"],
    }, state.aliceCookie);
    assert.equal(moved.status, 200);
    assert.equal(moved.body.persona.tabs_order, "whispers,flow,reels,shots,moments");
    const readByVisitor = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    assert.deepEqual(readByVisitor.body.profile.tabs_order, ["whispers", "flow", "reels", "shots", "moments"]);

    // A list that forgets a tab is not an arrangement that hides it: the tab comes back, in its own place.
    const partial = await call(state.context, "PATCH", "/api/persona/social", { tabs_order: ["moments"] }, state.aliceCookie);
    assert.equal(partial.status, 200);
    assert.deepEqual(
      (await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.aliceCookie)).body.profile.tabs_order,
      ["moments", "flow", "reels", "shots", "whispers"],
    );

    // An order is a list of known tabs, each once: anything else is refused instead of half-written.
    for (const tabs_order of [["whispers", "nope"], ["flow", "flow"], [], ["a", "b", "c", "d", "e", "f"]]) {
      const refused = await call(state.context, "PATCH", "/api/persona/social", { tabs_order }, state.aliceCookie);
      assert.equal(refused.status, 400, JSON.stringify(tabs_order));
      assert.equal(refused.body.error, "tabs order invalid");
    }
    const afterRefusals = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.aliceCookie);
    assert.deepEqual(afterRefusals.body.profile.tabs_order, ["moments", "flow", "reels", "shots", "whispers"]);
  } finally { state.db.close(); }
});

test("pinning is the owner's own arrangement, three at a time, and the post itself does not change", async () => {
  const state = fixture();
  try {
    const posts = [0, 1, 2, 3].map((index) => state.repo.createPost({
      userId: state.alice.id, persona: "social", caption: "post " + index, visibility: "public",
    }));
    // Someone else's post is not the viewer's to arrange.
    const foreign = await call(state.context, "POST", `/api/posts/${posts[0].id}/pin`, { pinned: true }, state.bobCookie);
    assert.equal(foreign.status, 404);

    const body = { pinned: "yes" };
    const malformed = await call(state.context, "POST", `/api/posts/${posts[0].id}/pin`, body, state.aliceCookie);
    assert.equal(malformed.status, 400);

    const versionBefore = state.repo.getPostById(posts[0].id).version;
    for (const post of posts.slice(0, 3)) {
      const pinned = await call(state.context, "POST", `/api/posts/${post.id}/pin`, { pinned: true }, state.aliceCookie);
      assert.equal(pinned.status, 200);
      assert.equal(pinned.body.action, "post_pinned");
      assert.equal(pinned.body.pinned, true);
      assert.ok(Number(pinned.body.post.pinned_at) > 0);
    }
    // Three is the allowance: the fourth is refused with a code the interface can explain.
    const overLimit = await call(state.context, "POST", `/api/posts/${posts[3].id}/pin`, { pinned: true }, state.aliceCookie);
    assert.equal(overLimit.status, 409);
    assert.equal(overLimit.body.code, "PIN_LIMIT");

    // Unpinning is immediate, and it frees a place.
    const unpinned = await call(state.context, "POST", `/api/posts/${posts[0].id}/pin`, { pinned: false }, state.aliceCookie);
    assert.equal(unpinned.status, 200);
    assert.equal(unpinned.body.action, "post_unpinned");
    assert.equal(unpinned.body.post.pinned_at, null);
    const nowFits = await call(state.context, "POST", `/api/posts/${posts[3].id}/pin`, { pinned: true }, state.aliceCookie);
    assert.equal(nowFits.status, 200);

    // A pin is not an edit: the post keeps its version, and the profile payload is where it is read.
    assert.equal(state.repo.getPostById(posts[0].id).version, versionBefore);
    const profile = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.aliceCookie);
    assert.equal(profile.body.posts.filter((post) => Number(post.pinned_at || 0) > 0).length, 3);
    const visitor = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    assert.equal(visitor.body.posts.filter((post) => Number(post.pinned_at || 0) > 0).length, 3);
  } finally { state.db.close(); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";
import { storeMedia } from "../lib/media.js";

let mutationSequence = 0;

function fakeReq(method, url, body = {}, cookie = "", key = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)
        ? { "idempotency-key": key ?? `p1-comment-profile-${String(++mutationSequence).padStart(8, "0")}` }
        : {}),
    },
    socket: { remoteAddress: "127.0.0.92" },
    on(event, callback) {
      if (event === "data") process.nextTick(() => callback(raw));
      if (event === "end") process.nextTick(callback);
      return this;
    },
    once() { return this; },
    destroy() {},
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { if (typeof value === "string" || Buffer.isBuffer(value)) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : value; },
  };
}

function sessionCookie(repo, userId, persona = "social") {
  const session = issueSession(userId, persona);
  repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
  return `nexus_session=${session.token}`;
}

async function call(context, method, path, body, cookie, key = null) {
  const res = fakeRes();
  await handleRequest(fakeReq(method, path, body, cookie, key), res, context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers };
}

async function callWithHeaders(context, method, path, body, cookie, headers = {}) {
  const res = fakeRes();
  const req = fakeReq(method, path, body, cookie);
  Object.assign(req.headers, headers);
  await handleRequest(req, res, context);
  return { status: res.statusCode, body: res.body, headers: res.headers };
}

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sseEvents = [];
  const context = {
    db,
    repo,
    sse: {
      publish(type, payload, channels) { sseEvents.push({ type, payload, channels }); return { subscribers: 0, written: 0 }; },
      broadcast(type, payload, channels) { sseEvents.push({ type, payload, channels }); return { subscribers: 0, written: 0 }; },
      subscribe() { return () => {}; },
    },
  };
  const alice = repo.createUser({ handle: "p1_alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "p1_bob", displayName: "Bob" });
  const carol = repo.createUser({ handle: "p1_carol", displayName: "Carol" });
  for (const user of [alice, bob, carol]) {
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    repo.ensurePersona(user.id, "work", { visibility: "public" });
  }
  return {
    db, repo, context, sseEvents, alice, bob, carol,
    aliceCookie: sessionCookie(repo, alice.id),
    bobCookie: sessionCookie(repo, bob.id),
    bobWorkCookie: sessionCookie(repo, bob.id, "work"),
    carolCookie: sessionCookie(repo, carol.id),
  };
}

test("public profile exposes persona avatar/cover/counts but denies private and cross-persona reads", async () => {
  const state = fixture();
  try {
    state.repo.updatePersona(state.alice.id, "social", {
      name: "Alice Social",
      bio: "Public social profile",
      avatar: "/media/" + "a".repeat(64) + ".jpg",
      cover: "/media/" + "b".repeat(64) + ".jpg",
      visibility: "public",
    });
    state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "visible", visibility: "public" });
    const visible = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    assert.equal(visible.status, 200);
    assert.equal(visible.body.profile.name, "Alice Social");
    assert.equal(visible.body.profile.avatar, "/media/" + "a".repeat(64) + ".jpg");
    assert.equal(visible.body.profile.cover, "/media/" + "b".repeat(64) + ".jpg");
    assert.equal(visible.body.profile.counts.posts, 1);
    assert.equal(visible.body.profile.is_following, false);

    const crossPersona = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobWorkCookie);
    assert.equal(crossPersona.status, 404);

    state.repo.updatePersona(state.alice.id, "social", { visibility: "private" });
    const privateRead = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    // Discoverable restricted identities expose only the relationship shell.
    assert.equal(privateRead.status, 200);
    assert.equal(privateRead.body.locked, true);
    assert.deepEqual(privateRead.body.posts, []);
    for (const field of ["avatar", "cover", "bio", "counts", "presence"]) {
      assert.equal(field in privateRead.body.profile, false);
    }
    const ownRead = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.aliceCookie);
    assert.equal(ownRead.status, 200);
  } finally { state.db.close(); }
});

test("privacy settings are validated and isolated per persona end to end", async () => {
  const state = fixture();
  try {
    const social = await call(state.context, "PATCH", "/api/persona/social", {
      name: "Alice Social Private",
      visibility: "followers",
      discoverability: "hidden",
      message_policy: "followers",
      interface_locale: "ro",
      content_languages: ["ro", "en"],
      region_code: "PL-MAZ",
      near_enabled: true,
    }, state.aliceCookie, "p0-persona-social-privacy-0001");
    assert.equal(social.status, 200);
    assert.deepEqual({
      persona: social.body.persona.persona,
      visibility: social.body.persona.visibility,
      discoverability: social.body.persona.discoverability,
      message_policy: social.body.persona.message_policy,
      interface_locale: social.body.persona.interface_locale,
      region_code: social.body.persona.region_code,
      near_enabled: Boolean(social.body.persona.near_enabled),
    }, {
      persona: "social", visibility: "followers", discoverability: "hidden",
      message_policy: "followers", interface_locale: "ro", region_code: "PL-MAZ", near_enabled: true,
    });

    const workCookie = sessionCookie(state.repo, state.alice.id, "work");
    const work = await call(state.context, "PATCH", "/api/persona/work", {
      name: "Alice Work Public",
      visibility: "public",
      discoverability: "public",
      message_policy: "requests",
      interface_locale: "en",
      content_languages: ["en"],
      near_enabled: false,
    }, workCookie, "p0-persona-work-privacy-0001");
    assert.equal(work.status, 200);
    assert.equal(work.body.persona.visibility, "public");
    assert.equal(work.body.persona.discoverability, "public");
    assert.equal(work.body.persona.message_policy, "requests");

    const storedSocial = state.repo.getPersona(state.alice.id, "social");
    const storedWork = state.repo.getPersona(state.alice.id, "work");
    assert.equal(storedSocial.visibility, "followers");
    assert.equal(storedSocial.discoverability, "hidden");
    assert.equal(storedSocial.message_policy, "followers");
    assert.equal(storedWork.visibility, "public");
    assert.equal(storedWork.discoverability, "public");
    assert.equal(storedWork.message_policy, "requests");

    const hiddenFromSocialSearch = await call(state.context, "GET", "/api/social/search?q=p1_alice", {}, state.bobCookie);
    assert.equal(hiddenFromSocialSearch.status, 200);
    assert.equal(hiddenFromSocialSearch.body.profiles.some((profile) => profile.user_id === state.alice.id), false);

    const invalidDiscoverability = await call(state.context, "PATCH", "/api/persona/social", {
      discoverability: "public-unless-blocked",
    }, state.aliceCookie, "p0-persona-invalid-discoverability-0001");
    assert.equal(invalidDiscoverability.status, 400);
    assert.equal(state.repo.getPersona(state.alice.id, "social").discoverability, "hidden");

    const crossPersonaEdit = await call(state.context, "PATCH", "/api/persona/work", {
      visibility: "private",
    }, state.aliceCookie, "p0-persona-cross-edit-denied-0001");
    assert.equal(crossPersonaEdit.status, 409);
    assert.equal(state.repo.getPersona(state.alice.id, "work").visibility, "public");
  } finally { state.db.close(); }
});

test("comments preserve threaded history, author-only edit/withdraw and report without creator deletion", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "discussion", visibility: "public" });
    const root = await call(state.context, "POST", `/api/posts/${post.id}/comments`, { body: "Critică legitimă" }, state.bobCookie);
    assert.equal(root.status, 201);
    assert.deepEqual({ post_id: root.body.post_id, actor_id: root.body.actor_id, actor_persona: root.body.actor_persona, parent_id: root.body.parent_id },
      { post_id: post.id, actor_id: state.bob.id, actor_persona: "social", parent_id: null });
    assert.equal(root.body.comment.avatar, null);
    const reply = await call(state.context, "POST", `/api/posts/${post.id}/comments`, { body: "Răspuns în thread", parent_id: root.body.comment.id }, state.carolCookie);
    assert.equal(reply.status, 201);
    assert.equal(reply.body.comment.parent_id, root.body.comment.id);

    const creatorDelete = await call(state.context, "DELETE", `/api/comments/${root.body.comment.id}`, {}, state.aliceCookie);
    assert.equal(creatorDelete.status, 403);
    assert.equal(state.repo.getCommentById(root.body.comment.id).body, "Critică legitimă");

    const edit = await call(state.context, "PATCH", `/api/comments/${root.body.comment.id}`, { body: "Critică legitimă, clarificată" }, state.bobCookie);
    assert.equal(edit.status, 200);
    assert.deepEqual({ comment_id: edit.body.comment_id, post_id: edit.body.post_id, actor_id: edit.body.actor_id, actor_persona: edit.body.actor_persona },
      { comment_id: root.body.comment.id, post_id: post.id, actor_id: state.bob.id, actor_persona: "social" });
    assert.equal(edit.body.comment.version, 2);
    assert.equal(edit.body.history_preserved, true);
    const history = await call(state.context, "GET", `/api/comments/${root.body.comment.id}/versions`, {}, state.bobCookie);
    assert.equal(history.status, 200);
    assert.deepEqual(history.body.versions.map((version) => version.body), ["Critică legitimă", "Critică legitimă, clarificată"]);
    const historyByCreator = await call(state.context, "GET", `/api/comments/${root.body.comment.id}/versions`, {}, state.aliceCookie);
    assert.equal(historyByCreator.status, 404);

    const report = await call(state.context, "POST", `/api/comments/${root.body.comment.id}/report`, { category: "HARASSMENT_THREAT", details: "Context test" }, state.aliceCookie);
    assert.equal(report.status, 201);
    assert.deepEqual({ subject_type: report.body.subject_type, subject_id: report.body.subject_id, reporter_id: report.body.reporter_id, reporter_persona: report.body.reporter_persona, category: report.body.report.category },
      { subject_type: "comment", subject_id: root.body.comment.id, reporter_id: state.alice.id, reporter_persona: "social", category: "HARASSMENT_THREAT" });
    assert.equal(report.body.content_removed, false);
    assert.equal(state.repo.getCommentById(root.body.comment.id).status, "active");

    const withdraw = await call(state.context, "DELETE", `/api/comments/${root.body.comment.id}`, {}, state.bobCookie);
    assert.equal(withdraw.status, 200);
    assert.deepEqual({ comment_id: withdraw.body.comment_id, post_id: withdraw.body.post_id, actor_id: withdraw.body.actor_id, actor_persona: withdraw.body.actor_persona },
      { comment_id: root.body.comment.id, post_id: post.id, actor_id: state.bob.id, actor_persona: "social" });
    assert.equal(withdraw.body.tombstone, true);
    const comments = await call(state.context, "GET", `/api/posts/${post.id}/comments?sort=oldest`, {}, state.aliceCookie);
    assert.equal(comments.status, 200);
    assert.deepEqual({ post_id: comments.body.post_id, viewer_id: comments.body.viewer_id, viewer_persona: comments.body.viewer_persona, sort: comments.body.sort },
      { post_id: post.id, viewer_id: state.alice.id, viewer_persona: "social", sort: "oldest" });
    assert.equal(comments.body.comments[0].status, "withdrawn");
    assert.equal(comments.body.comments[0].body, "");
    assert.equal(comments.body.comments[1].parent_id, root.body.comment.id);
    assert.equal(state.sseEvents.some((event) => event.type === "comment" && event.payload?.comment), false);
    assert.equal(state.sseEvents.every((event) => !JSON.stringify(event).includes("Critică legitimă")), true);
  } finally { state.db.close(); }
});

test("moderation appeal is owner/profile bound, replay stable and exact-result bound", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Afirmație fără sursă", visibility: "public" });
    const aliceWorkCookie = sessionCookie(state.repo, state.alice.id, "work");
    const wrongProfile = await call(state.context, "POST", `/api/social/posts/${post.id}/appeal`, { reason: "Context satiric complet" }, aliceWorkCookie, "appeal-wrong-profile-0001");
    assert.equal(wrongProfile.status, 404);
    const wrongOwner = await call(state.context, "POST", `/api/social/posts/${post.id}/appeal`, { reason: "Context satiric complet" }, state.bobCookie, "appeal-wrong-owner-0001");
    assert.equal(wrongOwner.status, 404);
    const trust = await call(state.context, "GET", `/api/social/posts/${post.id}/trust`, {}, state.aliceCookie);
    assert.equal(trust.status, 200);
    assert.equal(trust.body.can_appeal, true);

    const key = "appeal-exact-replay-0001";
    const appealed = await call(state.context, "POST", `/api/social/posts/${post.id}/appeal`, { reason: "Este o postare satirică, nu o știre" }, state.aliceCookie, key);
    assert.equal(appealed.status, 201);
    assert.deepEqual({
      subject_type: appealed.body.subject_type, subject_id: appealed.body.subject_id,
      appellant_id: appealed.body.appellant_id, appellant_persona: appealed.body.appellant_persona,
      restriction_changed: appealed.body.restriction_changed, author_disputed: appealed.body.author_disputed,
    }, {
      subject_type: "post", subject_id: post.id, appellant_id: state.alice.id,
      appellant_persona: "social", restriction_changed: false, author_disputed: true,
    });
    assert.deepEqual(Object.keys(appealed.body.appeal).sort(), ["assessment_hash", "id", "outcome", "policy_version", "reason_code", "status"]);
    assert.equal(appealed.body.appeal.status, "RECORDED_AUTOMATED_ONLY");
    assert.match(appealed.body.appeal.assessment_hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(appealed.body.statement_of_reasons, {
      automated_only: true,
      human_review_performed: false,
      restriction_changed: false,
      label_status: appealed.body.appeal.outcome,
      policy_version: appealed.body.appeal.policy_version,
    });
    const replay = await call(state.context, "POST", `/api/social/posts/${post.id}/appeal`, { reason: "Este o postare satirică, nu o știre" }, state.aliceCookie, key);
    assert.deepEqual(replay.body, appealed.body);
    const distinctTransportIntent = await call(state.context, "POST", `/api/social/posts/${post.id}/appeal`, { reason: "A doua trimitere pentru aceeași evaluare" }, state.aliceCookie, "appeal-distinct-transport-0002");
    assert.equal(distinctTransportIntent.status, 201);
    assert.equal(distinctTransportIntent.body.appeal.id, appealed.body.appeal.id);
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM moderation_appeals WHERE subject_id = ?").get(post.id).count, 1);
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM moderation_events WHERE subject_type = 'post' AND subject_id = ? AND action = 'ASSESSMENT_APPEALED'").get(post.id).count, 1);
    assert.equal("reason" in appealed.body.appeal, false);

    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(app, /data-appeal-key=/);
    assert.match(app, /form\.dataset\.inFlight === "true"/);
    assert.match(app, /"Idempotency-Key": form\.dataset\.appealKey/);
    assert.match(app, /result\.appellant_persona === appellantPersona/);
  } finally { state.db.close(); }
});

test("Trust Lens read is viewer/profile/target bound and client rejects stale or malformed results", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Breaking news fără sursă", visibility: "public" });
    const trust = await call(state.context, "GET", `/api/social/posts/${post.id}/trust`, {}, state.bobCookie);
    assert.equal(trust.status, 200);
    assert.deepEqual({
      post_id: trust.body.post_id, viewer_id: trust.body.viewer_id,
      viewer_persona: trust.body.viewer_persona, privacy: trust.body.privacy_enforced_server_side,
    }, { post_id: post.id, viewer_id: state.bob.id, viewer_persona: "social", privacy: true });
    assert.equal(trust.body.can_appeal, false);
    assert.ok(trust.body.assessment.labels.length >= 1);
    assert.equal(trust.body.assessment.truthPercentage, null);
    assert.equal(trust.body.methodology.no_truth_score, true);
    assert.equal(trust.body.methodology.report_alone_removes_content, false);
    assert.ok(trust.body.my_reports.length <= 100);
    const denied = await call(state.context, "GET", `/api/social/posts/${post.id}/trust`, {}, state.bobWorkCookie);
    assert.equal(denied.status, 404);

    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(app, /const trustLoadGate = createLatestRequestGate\(\)/);
    assert.match(app, /Number\(r\.post_id\) !== postId/);
    assert.match(app, /r\.privacy_enforced_server_side !== true/);
    assert.match(app, /assessmentLabels\.length <= 32/);
    assert.match(app, /reportRows\.length <= 100/);
    assert.match(app, /trustLoadGate\.invalidate\(\)/);
  } finally { state.db.close(); }
});

test("comment reads hide blocked authors and viewer-specific counts do not leak them", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "privacy", visibility: "public" });
    state.repo.addSocialComment({ userId: state.bob.id, actorPersona: "social", postId: post.id, body: "blocked-body-marker" });
    state.repo.addSocialComment({ userId: state.carol.id, actorPersona: "social", postId: post.id, body: "visible comment" });
    state.repo.setProfileBlock(state.alice.id, "social", state.bob.id, true);
    const comments = await call(state.context, "GET", `/api/posts/${post.id}/comments`, {}, state.aliceCookie);
    assert.equal(comments.status, 200);
    assert.equal(comments.body.comments.length, 1);
    assert.equal(comments.body.comments[0].body, "visible comment");
    assert.equal(JSON.stringify(comments.body).includes("blocked-body-marker"), false);
    const feed = await call(state.context, "GET", "/api/social/feed?lens=for-you&format=all", {}, state.aliceCookie);
    const viewed = feed.body.posts.find((item) => Number(item.id) === Number(post.id));
    assert.equal(viewed.comment_count, 1);
  } finally { state.db.close(); }
});

test("private profiles require an owner-approved follow request and active persona cannot be bypassed", async () => {
  const state = fixture();
  try {
    state.repo.updatePersona(state.alice.id, "social", { visibility: "private" });
    const requested = await call(state.context, "POST", "/api/follow", {
      user_id: state.alice.id, persona: "social", active: true,
    }, state.bobCookie);
    assert.equal(requested.status, 202);
    assert.equal(requested.body.request_pending, true);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), false);

    const outgoing = await call(state.context, "GET", "/api/follow/requests?direction=outgoing", {}, state.bobCookie);
    const incoming = await call(state.context, "GET", "/api/follow/requests?direction=incoming", {}, state.aliceCookie);
    assert.equal(outgoing.body.requests.length, 1);
    assert.equal(incoming.body.requests.length, 1);
    assert.equal(outgoing.body.requests[0].id, incoming.body.requests[0].id);

    const wrongOwner = await call(state.context, "POST", `/api/follow/requests/${incoming.body.requests[0].id}/decision`, { decision: "accept" }, state.bobCookie);
    assert.equal(wrongOwner.status, 404);
    const accepted = await call(state.context, "POST", `/api/follow/requests/${incoming.body.requests[0].id}/decision`, { decision: "accept" }, state.aliceCookie);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.active, true);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), true);

    const crossPersona = await call(state.context, "POST", "/api/follow", {
      user_id: state.carol.id, persona: "social", active: true,
    }, state.bobWorkCookie);
    assert.equal(crossPersona.status, 400);

    const block = await call(state.context, "POST", "/api/profile/block", { user_id: state.bob.id, active: true }, state.aliceCookie);
    assert.equal(block.status, 200);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), false);
    const hiddenAttempt = await call(state.context, "POST", "/api/follow", {
      user_id: state.alice.id, persona: "social", active: true,
    }, state.bobCookie);
    assert.equal(hiddenAttempt.status, 404);
  } finally { state.db.close(); }
});

test("realtime emits private invalidations only and blocked actors do not affect visible engagement totals", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "engagement", visibility: "public" });
    const reacted = await call(state.context, "POST", `/api/posts/${post.id}/reaction`, { kind: "love" }, state.bobCookie);
    assert.equal(reacted.status, 200);
    const reactionEvent = state.sseEvents.find((event) => event.type === "post-reaction-changed");
    assert.deepEqual(reactionEvent.payload, { post_id: post.id });
    assert.deepEqual(new Set(reactionEvent.channels), new Set([`user:${state.alice.id}`, `user:${state.bob.id}`]));
    assert.equal(reactionEvent.channels.some((channel) => channel.startsWith("persona:")), false);

    const story = await call(state.context, "POST", "/api/stories", {
      caption: "private story marker", visibility: "private", persistent: true,
    }, state.aliceCookie);
    assert.equal(story.status, 201);
    const storyEvent = state.sseEvents.find((event) => event.type === "story-changed");
    assert.deepEqual(storyEvent.payload, { story_id: story.body.story.id });
    assert.deepEqual(storyEvent.channels, [`user:${state.alice.id}`]);
    assert.equal(JSON.stringify(storyEvent).includes("private story marker"), false);

    state.repo.setPostReaction(state.carol.id, "social", post.id, "LOVE", true);
    state.repo.setPostRepost(state.bob.id, "social", post.id, true);
    state.repo.setPostRepost(state.carol.id, "social", post.id, true);
    const comment = state.repo.addSocialComment({ userId: state.carol.id, actorPersona: "social", postId: post.id, body: "visible thread" });
    state.repo.setCommentReaction(state.bob.id, "social", comment.id, "LIKE", true);
    state.repo.setCommentReaction(state.alice.id, "social", comment.id, "LIKE", true);
    state.repo.setProfileBlock(state.alice.id, "social", state.bob.id, true);

    assert.deepEqual(state.repo.postReactionSummary(post.id, state.alice.id, "social").counts, { LOVE: 1 });
    assert.equal(state.repo.postRepostSummary(post.id, state.alice.id, "social").reposts, 1);
    assert.deepEqual(state.repo.commentReactionSummary(comment.id, state.alice.id, "social").counts, { LIKE: 1 });
  } finally { state.db.close(); }
});

test("reaction mutations bind the exact actor, persona, target and replayed intent", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "reaction target", visibility: "public" });
    const key = "p1-reaction-result-integrity-0001";
    const first = await call(state.context, "POST", `/api/posts/${post.id}/reaction`, { kind: "fake", active: true }, state.bobCookie, key);
    assert.equal(first.status, 200);
    assert.deepEqual({
      post_id: first.body.post_id, actor_id: first.body.actor_id, actor_persona: first.body.actor_persona,
      reaction: first.body.reaction, active: first.body.active, viewer_reaction: first.body.viewer_reaction,
    }, {
      post_id: post.id, actor_id: state.bob.id, actor_persona: "social",
      reaction: "FAKE_OPINION", active: true, viewer_reaction: "FAKE_OPINION",
    });
    assert.equal(first.body.semantics, "community_opinion_not_fact_check");

    const replay = await call(state.context, "POST", `/api/posts/${post.id}/reaction`, { kind: "fake", active: true }, state.bobCookie, key);
    assert.deepEqual(replay.body, first.body);
    assert.equal(state.repo.postReactionSummary(post.id, state.bob.id, "social").counts.FAKE_OPINION, 1);

    const comment = state.repo.addSocialComment({ userId: state.alice.id, actorPersona: "social", postId: post.id, body: "thread target" });
    const commentResult = await call(state.context, "POST", `/api/comments/${comment.id}/reaction`, { kind: "love", active: true }, state.bobCookie, "p1-comment-reaction-result-integrity-0001");
    assert.equal(commentResult.status, 200);
    assert.deepEqual({
      comment_id: commentResult.body.comment_id, post_id: commentResult.body.post_id,
      actor_id: commentResult.body.actor_id, actor_persona: commentResult.body.actor_persona,
      reaction: commentResult.body.reaction, active: commentResult.body.active,
    }, {
      comment_id: comment.id, post_id: post.id, actor_id: state.bob.id,
      actor_persona: "social", reaction: "LOVE", active: true,
    });

    const unlike = await call(state.context, "POST", `/api/posts/${post.id}/like`, { active: false }, state.bobCookie, "p1-like-result-integrity-0001");
    assert.equal(unlike.status, 200);
    assert.equal(unlike.body.post_id, post.id);
    assert.equal(unlike.body.actor_id, state.bob.id);
    assert.equal(unlike.body.active, false);
    assert.equal(unlike.body.liked_by_me, false);
    assert.equal(unlike.body.viewer_reaction, null);
  } finally { state.db.close(); }
});

test("save repost and private feedback return one exact profile-bound outcome", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "secondary engagement", visibility: "public" });
    const saved = await call(state.context, "POST", `/api/posts/${post.id}/save`, { active: true }, state.bobCookie, "p1-save-result-integrity-0001");
    assert.deepEqual({ post_id: saved.body.post_id, actor_id: saved.body.actor_id, actor_persona: saved.body.actor_persona, saved: saved.body.saved, private: saved.body.private },
      { post_id: post.id, actor_id: state.bob.id, actor_persona: "social", saved: true, private: true });
    const reposted = await call(state.context, "POST", `/api/posts/${post.id}/repost`, { active: true }, state.bobCookie, "p1-repost-result-integrity-0001");
    assert.deepEqual({ post_id: reposted.body.post_id, actor_id: reposted.body.actor_id, actor_persona: reposted.body.actor_persona, active: reposted.body.active, reposted_by_me: reposted.body.reposted_by_me, reposts: reposted.body.reposts },
      { post_id: post.id, actor_id: state.bob.id, actor_persona: "social", active: true, reposted_by_me: true, reposts: 1 });
    const feedback = await call(state.context, "POST", `/api/social/posts/${post.id}/feedback`, { kind: "NOT_INTERESTED", active: true }, state.bobCookie, "p1-feedback-result-integrity-0001");
    assert.deepEqual({ post_id: feedback.body.post_id, actor_id: feedback.body.actor_id, actor_persona: feedback.body.actor_persona, kind: feedback.body.kind, active: feedback.body.active, private: feedback.body.private },
      { post_id: post.id, actor_id: state.bob.id, actor_persona: "social", kind: "NOT_INTERESTED", active: true, private: true });
  } finally { state.db.close(); }
});

test("Social search pagination is bounded, duplicate-free and reapplies privacy on every page", async () => {
  const state = fixture();
  try {
    const created = [];
    for (let index = 0; index < 25; index += 1) {
      const user = state.repo.createUser({ handle: `pager${String(index).padStart(2, "0")}`, displayName: `Pager ${index}` });
      state.repo.ensurePersona(user.id, "social", { visibility: "public" });
      state.repo.createPost({ userId: user.id, persona: "social", caption: `pager content ${index}`, visibility: "public" });
      created.push(user);
    }
    state.repo.setProfileBlock(state.bob.id, "social", created[3].id, true);

    const first = await call(state.context, "GET", "/api/social/search?q=pager&cursor=0", {}, state.bobCookie);
    assert.equal(first.status, 200);
    assert.equal(first.body.viewer_id, state.bob.id);
    assert.equal(first.body.viewer_persona, "social");
    assert.equal(first.body.cursor, "0");
    assert.equal(first.body.next_cursor, "20");
    assert.equal(first.body.profiles.length <= 20, true);
    assert.equal(first.body.posts.length <= 20, true);
    assert.equal(first.body.profiles.some((profile) => profile.id === created[3].id), false);
    assert.equal(first.body.posts.some((post) => post.user_id === created[3].id), false);

    const second = await call(state.context, "GET", "/api/social/search?q=pager&cursor=20", {}, state.bobCookie);
    assert.equal(second.status, 200);
    assert.equal(second.body.cursor, "20");
    assert.equal(new Set([...first.body.profiles, ...second.body.profiles].map((profile) => profile.id)).size,
      first.body.profiles.length + second.body.profiles.length);
    assert.equal(new Set([...first.body.posts, ...second.body.posts].map((post) => post.id)).size,
      first.body.posts.length + second.body.posts.length);

    const invalid = await call(state.context, "GET", "/api/social/search?q=pager&cursor=10", {}, state.bobCookie);
    assert.equal(invalid.status, 400);
    const wildcardOnly = await call(state.context, "GET", "/api/social/search?q=%25_&cursor=0", {}, state.bobCookie);
    assert.equal(wildcardOnly.status, 400);
    assert.equal(wildcardOnly.body.code, "SOCIAL_SEARCH_QUERY_INVALID");
    const bidiOverride = await call(state.context, "GET", "/api/social/search?q=pa%E2%80%AEger&cursor=0", {}, state.bobCookie);
    assert.equal(bidiOverride.status, 400);
    assert.equal(bidiOverride.body.code, "SOCIAL_SEARCH_QUERY_INVALID");
  } finally { state.db.close(); }
});

test("Social relations paginate after privacy filtering and follow results bind both profiles", async () => {
  const state = fixture();
  try {
    const followers = [];
    for (let index = 0; index < 45; index += 1) {
      const user = state.repo.createUser({ handle: `relation${String(index).padStart(2, "0")}`, displayName: `Relation ${index}` });
      state.repo.ensurePersona(user.id, "social", { visibility: "public" });
      state.repo.setFollow(user.id, state.bob.id, "social", true);
      followers.push(user);
    }
    state.repo.setProfileBlock(state.bob.id, "social", followers[2].id, true);
    const first = await call(state.context, "GET", "/api/social/relations?kind=followers&cursor=0", {}, state.bobCookie);
    assert.equal(first.status, 200);
    assert.deepEqual({ viewer_id: first.body.viewer_id, viewer_persona: first.body.viewer_persona, cursor: first.body.cursor, next: first.body.next_cursor },
      { viewer_id: state.bob.id, viewer_persona: "social", cursor: "0", next: "40" });
    assert.equal(first.body.people.length, 40);
    assert.equal(first.body.people.some((person) => person.user_id === followers[2].id), false);
    const second = await call(state.context, "GET", "/api/social/relations?kind=followers&cursor=40", {}, state.bobCookie);
    assert.equal(second.status, 200);
    assert.equal(new Set([...first.body.people, ...second.body.people].map((person) => person.user_id)).size,
      first.body.people.length + second.body.people.length);

    const followed = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-exact-result-0001");
    assert.deepEqual({ actor_id: followed.body.actor_id, actor_persona: followed.body.actor_persona, target_id: followed.body.target_id, target_persona: followed.body.target_persona, active: followed.body.active },
      { actor_id: state.bob.id, actor_persona: "social", target_id: state.alice.id, target_persona: "social", active: true });
    const invalid = await call(state.context, "GET", "/api/social/relations?kind=followers&cursor=20", {}, state.bobCookie);
    assert.equal(invalid.status, 400);
  } finally { state.db.close(); }
});

test("media range reads stay private, bounded and are revoked immediately by relationship changes", async () => {
  const state = fixture();
  try {
    const bytes = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(512, 7)]);
    const stored = storeMedia(bytes, "image/png");
    const media = state.repo.insertMedia({ ...stored, uploadedBy: state.alice.id, purpose: "social_post", actorPersona: "social" });
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", mediaId: media.id, kind: "image", caption: "followers media", visibility: "followers" });
    assert.ok(post.id > 0);
    state.repo.setFollow(state.bob.id, state.alice.id, "social", true);

    const range = await callWithHeaders(state.context, "GET", `/media/${media.hash}.${media.ext}`, {}, state.bobCookie, { range: "bytes=10-29" });
    assert.equal(range.status, 206);
    assert.equal(range.headers["content-range"], `bytes 10-29/${bytes.length}`);
    assert.equal(range.headers["content-length"], 20);
    assert.equal(range.headers["cache-control"], "private, no-store, max-age=0");
    assert.equal(range.headers["x-content-type-options"], "nosniff");
    assert.match(range.headers["content-disposition"], /^inline; filename="nexus-[a-f0-9]{12}\.(?:jpg|png|webp)"$/);
    assert.equal(range.headers["cross-origin-resource-policy"], "same-origin");

    const invalid = await callWithHeaders(state.context, "GET", `/media/${media.hash}.${media.ext}`, {}, state.bobCookie, { range: "bytes=0-2,4-6" });
    assert.equal(invalid.status, 416);
    state.repo.setProfileBlock(state.alice.id, "social", state.bob.id, true);
    const revoked = await callWithHeaders(state.context, "GET", `/media/${media.hash}.${media.ext}`, {}, state.bobCookie);
    assert.equal(revoked.status, 404);
  } finally { state.db.close(); }
});

test("post lifecycle preserves immutable versions, persona ownership and exact idempotent results", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({
      userId: state.alice.id, persona: "social", caption: "Prima versiune", visibility: "public",
    });
    const editKey = "p1-post-lifecycle-edit-0001";
    const edited = await call(state.context, "PATCH", `/api/posts/${post.id}`, {
      caption: "A doua versiune", visibility: "followers",
    }, state.aliceCookie, editKey);
    assert.equal(edited.status, 200);
    assert.deepEqual({
      action: edited.body.action, owner_id: edited.body.owner_id, owner_persona: edited.body.owner_persona,
      version: edited.body.version, caption: edited.body.post.caption, visibility: edited.body.post.visibility,
    }, {
      action: "post_edited", owner_id: state.alice.id, owner_persona: "social",
      version: 2, caption: "A doua versiune", visibility: "followers",
    });

    const editReplay = await call(state.context, "PATCH", `/api/posts/${post.id}`, {
      caption: "A doua versiune", visibility: "followers",
    }, state.aliceCookie, editKey);
    assert.equal(editReplay.status, 200);
    assert.deepEqual(editReplay.body, edited.body);
    assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM post_versions WHERE post_id = ?").get(post.id).count, 2);

    const crossPersona = await call(state.context, "PATCH", `/api/posts/${post.id}`, {
      caption: "Work must not edit Social",
    }, sessionCookie(state.repo, state.alice.id, "work"), "p1-post-lifecycle-cross-persona-0001");
    assert.equal(crossPersona.status, 404);
    const wrongOwner = await call(state.context, "POST", `/api/posts/${post.id}/archive`, {}, state.bobCookie, "p1-post-lifecycle-wrong-owner-0001");
    assert.equal(wrongOwner.status, 404);

    const archived = await call(state.context, "POST", `/api/posts/${post.id}/archive`, {}, state.aliceCookie, "p1-post-lifecycle-archive-0001");
    assert.deepEqual({ action: archived.body.action, status: archived.body.status, version: archived.body.version },
      { action: "post_archived", status: "archived", version: 3 });
    const hidden = await call(state.context, "GET", "/api/social/feed?lens=for-you&format=all", {}, state.bobCookie);
    assert.equal(hidden.body.posts.some((entry) => entry.id === post.id), false);

    const withdrawn = await call(state.context, "DELETE", `/api/posts/${post.id}`, {}, state.aliceCookie, "p1-post-lifecycle-withdraw-0001");
    assert.deepEqual({ action: withdrawn.body.action, status: withdrawn.body.status, version: withdrawn.body.version, preserved: withdrawn.body.history_preserved },
      { action: "post_withdrawn", status: "withdrawn", version: 4, preserved: true });
    const stored = state.repo.getPostById(post.id);
    assert.equal(stored.caption, "");
    assert.equal(stored.media_id, null);

    const history = await call(state.context, "GET", `/api/posts/${post.id}/history`, {}, state.aliceCookie);
    assert.equal(history.status, 200);
    assert.equal(history.body.immutable_history, true);
    assert.deepEqual(history.body.versions.map((version) => [version.version, version.caption, version.status]), [
      [1, "Prima versiune", "active"],
      [2, "A doua versiune", "active"],
      [3, "A doua versiune", "archived"],
      [4, "", "withdrawn"],
    ]);
    const deniedHistory = await call(state.context, "GET", `/api/posts/${post.id}/history`, {}, state.bobCookie);
    assert.equal(deniedHistory.status, 404);
    assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM outbox_events WHERE aggregate_type = 'post_version'").get().count, 3);
  } finally { state.db.close(); }
});

test("comment pagination returns complete root conversations without duplicates or privacy orphans", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Paginare conversații", visibility: "public" });
    let blockedRoot;
    for (let index = 0; index < 25; index += 1) {
      const root = state.repo.addSocialComment({ userId: index === 3 ? state.carol.id : state.bob.id, actorPersona: "social", postId: post.id, body: `Root ${index}` });
      state.repo.addSocialComment({ userId: state.alice.id, actorPersona: "social", postId: post.id, parentId: root.id, body: `Reply ${index}` });
      if (index === 3) blockedRoot = root;
    }
    state.repo.setProfileBlock(state.bob.id, "social", state.carol.id, true);
    const first = await call(state.context, "GET", `/api/posts/${post.id}/comments?sort=relevant&cursor=0`, {}, state.bobCookie);
    assert.equal(first.status, 200);
    assert.deepEqual({ cursor: first.body.cursor, next: first.body.next_cursor, roots: first.body.root_count }, { cursor: "0", next: "20", roots: 24 });
    assert.equal(first.body.comments.some((comment) => comment.id === blockedRoot.id), false);
    assert.equal(first.body.comments.every((comment) => !comment.parent_id || first.body.comments.some((parent) => parent.id === comment.parent_id)), true);

    const second = await call(state.context, "GET", `/api/posts/${post.id}/comments?sort=relevant&cursor=20`, {}, state.bobCookie);
    assert.equal(second.status, 200);
    assert.equal(second.body.next_cursor, null);
    const combined = [...first.body.comments, ...second.body.comments];
    assert.equal(new Set(combined.map((comment) => comment.id)).size, combined.length);
    assert.equal(combined.every((comment) => !comment.parent_id || combined.some((parent) => parent.id === comment.parent_id)), true);
    assert.equal(combined.filter((comment) => !comment.parent_id).length, 24);

    const invalid = await call(state.context, "GET", `/api/posts/${post.id}/comments?sort=relevant&cursor=10`, {}, state.bobCookie);
    assert.equal(invalid.status, 400);
  } finally { state.db.close(); }
});

test("only the active-profile post owner can pin a visible active comment", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Owner moderation", visibility: "public" });
    const comment = state.repo.addSocialComment({ userId: state.bob.id, actorPersona: "social", postId: post.id, body: "Useful answer" });
    const deniedAuthor = await call(state.context, "POST", `/api/comments/${comment.id}/pin`, { active: true }, state.bobCookie, "p1-comment-pin-author-denied-0001");
    assert.equal(deniedAuthor.status, 404);
    const deniedPersona = await call(state.context, "POST", `/api/comments/${comment.id}/pin`, { active: true }, sessionCookie(state.repo, state.alice.id, "work"), "p1-comment-pin-persona-denied-0001");
    assert.equal(deniedPersona.status, 404);

    const pinned = await call(state.context, "POST", `/api/comments/${comment.id}/pin`, { active: true }, state.aliceCookie, "p1-comment-pin-owner-0001");
    assert.deepEqual({ action: pinned.body.action, comment: pinned.body.comment_id, post: pinned.body.post_id, actor: pinned.body.actor_id, persona: pinned.body.actor_persona, pinned: pinned.body.pinned },
      { action: "comment_pinned", comment: comment.id, post: post.id, actor: state.alice.id, persona: "social", pinned: true });
    const list = await call(state.context, "GET", `/api/posts/${post.id}/comments?sort=relevant&cursor=0`, {}, state.aliceCookie);
    assert.equal(list.body.comments[0].can_pin, true);
    assert.equal(list.body.comments[0].pinned_by_owner, true);

    const replay = await call(state.context, "POST", `/api/comments/${comment.id}/pin`, { active: true }, state.aliceCookie, "p1-comment-pin-owner-0001");
    assert.deepEqual(replay.body, pinned.body);
    const unpinned = await call(state.context, "POST", `/api/comments/${comment.id}/pin`, { active: false }, state.aliceCookie, "p1-comment-unpin-owner-0001");
    assert.equal(unpinned.body.action, "comment_unpinned");
    assert.equal(unpinned.body.pinned, false);
  } finally { state.db.close(); }
});

test("avatar and cover require profile-bound image grants and old media is revoked on replacement", async () => {
  const state = fixture();
  try {
    const avatarStored = storeMedia(Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(64, 1)]), "image/png");
    const coverStored = storeMedia(Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(64, 2)]), "image/png");
    const avatar = state.repo.insertMedia({ ...avatarStored, uploadedBy: state.alice.id, purpose: "profile_avatar", actorPersona: "social" });
    const cover = state.repo.insertMedia({ ...coverStored, uploadedBy: state.alice.id, purpose: "profile_cover", actorPersona: "social" });
    const avatarUrl = `/media/${avatar.hash}.${avatar.ext}`;
    const coverUrl = `/media/${cover.hash}.${cover.ext}`;
    const updated = await call(state.context, "PATCH", "/api/persona/social", { avatar: avatarUrl, cover: coverUrl }, state.aliceCookie, "p1-profile-media-update-0001");
    assert.equal(updated.status, 200);
    assert.equal(updated.body.persona.avatar, avatarUrl);
    assert.equal(updated.body.persona.cover, coverUrl);
    const visible = await callWithHeaders(state.context, "GET", avatarUrl, {}, state.bobCookie);
    assert.equal(visible.status, 200);

    const removed = await call(state.context, "PATCH", "/api/persona/social", { avatar: "" }, state.aliceCookie, "p1-profile-media-remove-0001");
    assert.equal(removed.body.persona.avatar, "");
    const revoked = await callWithHeaders(state.context, "GET", avatarUrl, {}, state.bobCookie);
    assert.equal(revoked.status, 404);
    const coverStillVisible = await callWithHeaders(state.context, "GET", coverUrl, {}, state.bobCookie);
    assert.equal(coverStillVisible.status, 200);

    const forgedVideo = state.repo.insertMedia({ hash: "f".repeat(64), ext: "mp4", mime: "video/mp4", detectedMime: "video/mp4", kind: "video", size: 20, uploadedBy: state.alice.id, purpose: "profile_avatar", actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "synthetic_fixture" });
    const deniedVideo = await call(state.context, "PATCH", "/api/persona/social", { avatar: `/media/${forgedVideo.hash}.${forgedVideo.ext}` }, state.aliceCookie, "p1-profile-media-video-denied-0001");
    assert.equal(deniedVideo.status, 400);
    const deniedCrossPersona = await call(state.context, "PATCH", "/api/persona/work", { avatar: coverUrl }, sessionCookie(state.repo, state.alice.id, "work"), "p1-profile-media-cross-persona-denied-0001");
    assert.equal(deniedCrossPersona.status, 400);
  } finally { state.db.close(); }
});

test("private access demo receipts are quote-bound previews and never unlock content", async () => {
  const state = fixture();
  try {
    state.repo.updatePersona(state.alice.id, "social", {
      visibility: "private",
      privateAccess: { enabled: true, priceCents: 125, monthPriceCents: 2500, foreverPriceCents: 10000, currency: "USDC", durationDays: 15 },
    });
    const lockedProfile = await call(state.context, "GET", "/api/profiles/p1_alice?persona=social", {}, state.bobCookie);
    assert.equal(lockedProfile.status, 200);
    assert.equal(lockedProfile.body.locked, true);
    assert.deepEqual(lockedProfile.body.posts, []);
    assert.deepEqual(lockedProfile.body.stories, []);
    assert.deepEqual(lockedProfile.body.profile.private_access, {
      enabled: true, currency: "USDC", price_24h_cents: 125, price_month_cents: 2500, price_forever_cents: 10000,
    });
    assert.equal("avatar" in lockedProfile.body.profile, false);
    assert.equal("presence" in lockedProfile.body.profile, false);
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Settled only", visibility: "private" });
    const quote = await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&days=15&kind=visitor_reveal`, {}, state.bobCookie);
    assert.equal(quote.status, 200);
    assert.deepEqual({ amount: quote.body.quote.amount_cents, owner: quote.body.quote.owner_share_cents, nexus: quote.body.quote.nexus_share_cents, multiplier: quote.body.quote.reveal_multiplier },
      { amount: 3750, owner: 3375, nexus: 375, multiplier: 2 });

    const created = await call(state.context, "POST", "/api/social/private-access/demo-receipt", {
      owner_id: state.alice.id, persona: "social", duration_days: 15, kind: "visitor_reveal",
    }, state.bobCookie, "p1-private-preview-0001");
    assert.equal(created.status, 201);
    assert.equal(created.body.receipt.status, "demo_unpaid");
    assert.equal(created.body.access_status, "preview_only_until_real_payment_settlement");
    assert.match(created.body.receipt.receipt_hash, /^[a-f0-9]{64}$/);
    assert.equal(state.repo.canViewPost(state.bob.id, "social", post), false);
    assert.equal(state.repo.listPrivateContentForViewer(state.bob.id, { persona: "social" }).posts.length, 0);

    const day = await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&term=24h`, {}, state.bobCookie);
    const month = await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&term=1month`, {}, state.bobCookie);
    const forever = await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&term=forever`, {}, state.bobCookie);
    assert.deepEqual([day.body.quote.amount_cents, month.body.quote.amount_cents, forever.body.quote.amount_cents], [125, 2500, 10000]);
    assert.deepEqual([day.body.quote.duration_days, month.body.quote.duration_days, forever.body.quote.duration_days], [1, 30, 0]);
    const foreverPreview = await call(state.context, "POST", "/api/social/private-access/demo-receipt", {
      owner_id: state.alice.id, persona: "social", term: "forever", kind: "private_content",
    }, state.bobCookie, "p1-private-preview-forever-0001");
    assert.equal(foreverPreview.status, 201);
    assert.equal(foreverPreview.body.receipt.status, "demo_unpaid");
    assert.equal(state.repo.canViewPost(state.bob.id, "social", post), false);

    const replay = await call(state.context, "POST", "/api/social/private-access/demo-receipt", {
      owner_id: state.alice.id, persona: "social", duration_days: 15, kind: "visitor_reveal",
    }, state.bobCookie, "p1-private-preview-0001");
    assert.deepEqual(replay.body, created.body);
    assert.equal((await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&days=0`, {}, state.bobCookie)).status, 400);
    assert.equal((await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=work&days=15`, {}, state.bobCookie)).status, 409);
    assert.equal((await call(state.context, "GET", `/api/social/private-access/quote?owner_id=${state.alice.id}&persona=social&days=15&kind=unknown`, {}, state.bobCookie)).status, 400);
  } finally { state.db.close(); }
});

test("Social feed cursor is signed, viewer-bound and duplicate-free after privacy changes", async () => {
  const state = fixture();
  try {
    const authors = [];
    for (let index = 0; index < 18; index += 1) {
      const author = state.repo.createUser({ handle: `feed_cursor_${index}`, displayName: `Feed ${index}` });
      state.repo.ensurePersona(author.id, "social", { visibility: "public" });
      authors.push(author);
      state.repo.createPost({ userId: author.id, persona: "social", caption: `Cursor A ${index}`, visibility: "public" });
      state.repo.createPost({ userId: author.id, persona: "social", caption: `Cursor B ${index}`, visibility: "public" });
    }
    const first = await call(state.context, "GET", "/api/social/feed?lens=for-you&format=all&limit=10", {}, state.bobCookie);
    assert.equal(first.status, 200);
    assert.equal(first.body.posts.length, 10);
    assert.equal(first.body.cursor, null);
    assert.match(first.body.next_cursor, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const firstIds = new Set(first.body.posts.map((post) => post.id));

    const hiddenAuthor = authors.find((author) => !first.body.posts.some((post) => post.user_id === author.id));
    state.repo.setProfileBlock(state.bob.id, "social", hiddenAuthor.id, true);
    const second = await call(state.context, "GET", `/api/social/feed?lens=for-you&format=all&limit=10&cursor=${encodeURIComponent(first.body.next_cursor)}`, {}, state.bobCookie);
    assert.equal(second.status, 200);
    assert.equal(second.body.cursor, first.body.next_cursor);
    assert.equal(second.body.posts.some((post) => firstIds.has(post.id)), false);
    assert.equal(second.body.posts.some((post) => post.user_id === hiddenAuthor.id), false);

    const tampered = `${first.body.next_cursor.slice(0, -1)}x`;
    assert.equal((await call(state.context, "GET", `/api/social/feed?lens=for-you&format=all&limit=10&cursor=${encodeURIComponent(tampered)}`, {}, state.bobCookie)).status, 400);
    assert.equal((await call(state.context, "GET", `/api/social/feed?lens=global&format=all&limit=10&cursor=${encodeURIComponent(first.body.next_cursor)}`, {}, state.bobCookie)).status, 400);
  } finally { state.db.close(); }
});

test("impression batches are atomic, replay-safe and bound to the active Social profile", async () => {
  const state = fixture();
  try {
    const visible = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Visible impression", visibility: "public" });
    const hidden = state.repo.createPost({ userId: state.carol.id, persona: "social", caption: "Hidden impression", visibility: "public" });
    state.repo.setProfileBlock(state.bob.id, "social", state.carol.id, true);
    const body = { entries: [
      { post_id: visible.id, dwell_ms: 1500, completed: true },
      { post_id: hidden.id, dwell_ms: 800, completed: false },
    ] };
    const first = await call(state.context, "POST", "/api/social/impressions", body, state.bobCookie, "p1-impression-batch-0001");
    assert.equal(first.status, 202);
    assert.deepEqual({ viewer: first.body.viewer_id, persona: first.body.viewer_persona, requested: first.body.requested, recorded: first.body.recorded, ids: first.body.recorded_post_ids },
      { viewer: state.bob.id, persona: "social", requested: 2, recorded: 1, ids: [visible.id] });
    const replay = await call(state.context, "POST", "/api/social/impressions", body, state.bobCookie, "p1-impression-batch-0001");
    assert.deepEqual(replay.body, first.body);
    assert.equal(state.db.prepare(`SELECT impression_count FROM social_impressions WHERE viewer_id = ? AND post_id = ?`).get(state.bob.id, visible.id).impression_count, 1);
    assert.equal(state.db.prepare(`SELECT COUNT(*) count FROM social_impressions WHERE viewer_id = ? AND post_id = ?`).get(state.bob.id, hidden.id).count, 0);
    assert.equal((await call(state.context, "POST", "/api/social/impressions", { entries: [{ post_id: visible.id }] }, state.bobWorkCookie, "p1-impression-work-denied-0001")).status, 409);
  } finally { state.db.close(); }
});

test("reaction aggregates expose top organic opinions while every Dislike remains private", () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.alice.id, persona: "social", caption: "Reaction aggregate", visibility: "public" });
    const actors = [];
    for (let index = 0; index < 13; index += 1) {
      const actor = state.repo.createUser({ handle: `reaction_actor_${index}`, displayName: `Actor ${index}` });
      state.repo.ensurePersona(actor.id, "social", { visibility: "public" });
      actors.push(actor);
    }
    actors.slice(0, 5).forEach((actor) => state.repo.setPostReaction(actor.id, "social", post.id, "LIKE", true));
    actors.slice(5, 8).forEach((actor) => state.repo.setPostReaction(actor.id, "social", post.id, "FAKE_OPINION", true));
    actors.slice(8, 10).forEach((actor) => state.repo.setPostReaction(actor.id, "social", post.id, "SAD", true));
    actors.slice(10, 12).forEach((actor) => state.repo.setPostReaction(actor.id, "social", post.id, "DISLIKE", true));
    const synthetic = state.repo.createUser({ handle: "reaction_system_test", displayName: "Synthetic", trafficClass: "SYSTEM_TEST" });
    state.repo.ensurePersona(synthetic.id, "social", { visibility: "public" });
    state.repo.setPostReaction(synthetic.id, "social", post.id, "LOVE", true);

    const summary = state.repo.postReactionSummary(post.id, state.bob.id, "social");
    assert.deepEqual(summary.counts, { FAKE_OPINION: 3, LIKE: 5, SAD: 2 });
    assert.equal("DISLIKE" in summary.counts, false);
    assert.equal("LOVE" in summary.counts, false, "SYSTEM_TEST activity must not alter organic public totals");
    assert.equal(state.repo.privateDislikeCount(post.id), 2);
    const mine = state.repo.setPostReaction(state.bob.id, "social", post.id, "DISLIKE", true);
    assert.equal(mine.private_dislike_by_me, true);
    assert.equal("DISLIKE" in mine.counts, false);
    assert.throws(() => state.repo.setPostReaction(state.bob.id, "work", post.id, "LIKE", true), /SOCIAL_REACTION_TARGET_INVALID/);
  } finally { state.db.close(); }
});

test("private follow requests converge under replay and block always wins", async () => {
  const state = fixture();
  try {
    state.repo.updatePersona(state.alice.id, "social", { visibility: "private" });
    const first = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-request-a-0001");
    const duplicateIntent = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-request-b-0001");
    assert.equal(first.status, 202);
    assert.equal(duplicateIntent.status, 202);
    assert.equal(duplicateIntent.body.request_id, first.body.request_id);
    assert.equal(state.db.prepare(`SELECT COUNT(*) count FROM follow_requests WHERE requester_id = ? AND target_id = ?`).get(state.bob.id, state.alice.id).count, 1);

    state.repo.setProfileBlock(state.alice.id, "social", state.bob.id, true);
    assert.equal(state.repo.pendingFollowRequest(state.bob.id, state.alice.id, "social"), null);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), false);
    const staleDecision = await call(state.context, "POST", `/api/follow/requests/${first.body.request_id}/decision`, { decision: "accept" }, state.aliceCookie, "p1-follow-stale-decision-0001");
    assert.equal(staleDecision.status, 404);
    const blockedRetry = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-blocked-retry-0001");
    assert.equal(blockedRetry.status, 404);

    state.repo.setProfileBlock(state.alice.id, "social", state.bob.id, false);
    const renewed = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-renewed-0001");
    assert.equal(renewed.status, 202);
    const accepted = await call(state.context, "POST", `/api/follow/requests/${renewed.body.request_id}/decision`, { decision: "accept" }, state.aliceCookie, "p1-follow-accept-0001");
    assert.equal(accepted.status, 200);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), true);
    const converged = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-after-accept-0001");
    assert.equal(converged.status, 200);
    assert.equal(converged.body.active, true);
    assert.equal(converged.body.request_pending, false);

    const removed = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: false }, state.bobCookie, "p1-follow-remove-0001");
    assert.equal(removed.body.active, false);
    assert.equal(state.repo.isFollowing(state.bob.id, state.alice.id, "social"), false);
    const requiresApprovalAgain = await call(state.context, "POST", "/api/follow", { user_id: state.alice.id, persona: "social", active: true }, state.bobCookie, "p1-follow-again-0001");
    assert.equal(requiresApprovalAgain.status, 202);
    assert.equal(requiresApprovalAgain.body.request_pending, true);
  } finally { state.db.close(); }
});
