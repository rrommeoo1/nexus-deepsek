// P6 contracts: the community-note engine.
//
// The rule a reader must be able to trust is pinned here and nowhere else: a note is public only
// when enough people found it helpful from more than one perspective, a note never changes the
// visibility of the post, an author cannot note or rate their own note, and a rejected note is
// kept instead of being deleted in silence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo, decideCommunityNoteStatus, communityNotePerspective, COMMUNITY_NOTE_RULES } from "../lib/repo.js";

const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const detail = readFileSync(new URL("../public/post-detail.js", import.meta.url), "utf8");
const detailCss = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const planning = readFileSync(new URL("../../../planning/NX-SOCIAL-X-SURFACE-v1.md", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const owner = repo.createUser({ handle: "owner.p6", displayName: "Owner P6" });
  const follower = repo.createUser({ handle: "follower.p6", displayName: "Follower P6" });
  const stranger = repo.createUser({ handle: "stranger.p6", displayName: "Stranger P6" });
  const neutral = repo.createUser({ handle: "neutral.p6", displayName: "Neutral P6" });
  for (const user of [owner, follower, stranger, neutral]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  repo.setFollow(follower.id, owner.id, "social", true);
  repo.setProfileMute(stranger.id, "social", owner.id, true);
  const post = repo.createPost({ userId: owner.id, persona: "social", kind: "text", caption: "Postare cu context lipsă", visibility: "public" });
  return { db, repo, owner, follower, stranger, neutral, post };
}

const RATE = (repo, noteId, userId, helpful, perspective) => repo.rateCommunityNote({ noteId, raterId: userId, raterPersona: "social", helpful, perspective });

test("the note rule is declared, exported and decided the same way every time", () => {
  assert.equal(COMMUNITY_NOTE_RULES.minRatings, 3);
  assert.equal(COMMUNITY_NOTE_RULES.minPerspectives, 2);
  assert.equal(COMMUNITY_NOTE_RULES.maxSources, 3);
  const a = { perspective: "FOLLOWS_AUTHOR", helpful: true };
  const b = { perspective: "NOT_FOLLOWS_AUTHOR", helpful: true };
  const c = { perspective: "MUTED_AUTHOR", helpful: true };
  // Three ratings from three perspectives, all helpful, with a source: published.
  assert.equal(decideCommunityNoteStatus([a, b, c], { sources: 1 }), "HELPFUL");
  // The same ratings without a single source stay pending: a note that explains must point somewhere.
  assert.equal(decideCommunityNoteStatus([a, b, c], { sources: 0 }), "NEEDS_MORE_RATINGS");
  // One perspective alone is not bridging.
  assert.equal(decideCommunityNoteStatus([a, a, a], { sources: 2 }), "NEEDS_MORE_RATINGS");
  // A perspective that rates twice and disagrees blocks publication, even if the total is helpful.
  assert.equal(decideCommunityNoteStatus([a, { perspective: "FOLLOWS_AUTHOR", helpful: false }, b, c], { sources: 1 }), "NEEDS_MORE_RATINGS");
  // Two out of three inside one perspective is exactly the threshold, so it passes.
  assert.equal(decideCommunityNoteStatus([a, a, { perspective: "FOLLOWS_AUTHOR", helpful: false }, b, c], { sources: 1 }), "HELPFUL");
  // Clearly rejected notes are marked, never deleted.
  const rejected = [a, b, c, { perspective: "AUTHOR", helpful: false }].map((entry) => ({ ...entry, helpful: false }));
  assert.equal(decideCommunityNoteStatus(rejected, { sources: 2 }), "NOT_HELPFUL");
  // Three perspectives that all said "not helpful" are a rejection even before the hide threshold:
  // the overall majority is required as well as the per-perspective one.
  assert.equal(decideCommunityNoteStatus(rejected.slice(0, 3), { sources: 2 }), "NOT_HELPFUL");
  // Half of the readers finding it helpful from four perspectives is not a majority: it stays
  // pending, which is honest, instead of being published on a technicality.
  assert.equal(decideCommunityNoteStatus([a, b, { perspective: "MUTED_AUTHOR", helpful: false }, { perspective: "AUTHOR", helpful: false }], { sources: 1 }), "NEEDS_MORE_RATINGS");
  // Nothing at all, or nonsense, is pending instead of published.
  assert.equal(decideCommunityNoteStatus([], { sources: 3 }), "NEEDS_MORE_RATINGS");
  assert.equal(decideCommunityNoteStatus(null, {}), "NEEDS_MORE_RATINGS");
  // A fresh helpful rating from one more perspective never flips a published note back to pending.
  assert.equal(decideCommunityNoteStatus([a, b, c, { perspective: "AUTHOR", helpful: true }], { sources: 1 }), "HELPFUL");
});

test("a perspective is the relationship the rater has to the author, and it is named as such", () => {
  assert.equal(communityNotePerspective({ isAuthor: true, followsAuthor: true, mutedAuthor: true }), "AUTHOR");
  assert.equal(communityNotePerspective({ mutedAuthor: true, followsAuthor: true }), "MUTED_AUTHOR");
test("a note is written by another reader, rated from more than one perspective, then published", () => {
  const { db, repo, owner, follower, stranger, neutral, post } = fixture();
  try {
    // The author of the post cannot add context to it; the API says the same thing.
    assert.equal(repo.createCommunityNote({ subjectId: post.id, authorId: owner.id, body: "Autorul nu poate scrie aici." }).error, "author_cannot_note_own_post");
    // A note needs a real body.
    assert.equal(repo.createCommunityNote({ subjectId: post.id, authorId: follower.id, body: "prea scurt" }).error, "note_body_invalid");
    assert.equal(repo.createCommunityNote({ subjectId: 99999, authorId: follower.id, body: "Nu există subiectul acesta." }).error, "subject_not_found");
    const created = repo.createCommunityNote({
      subjectId: post.id, authorId: follower.id, body: "Contextul lipsește: cifra din postare nu are sursă.",
      sources: ["https://example.org/raport", "not a url", "ftp://example.org/x", "https://example.org/a", "https://example.org/b"],
    });
    assert.equal(created.note.status, "NEEDS_MORE_RATINGS");
    // Only real http(s) sources survive, and no more than three.
    assert.deepEqual(created.note.sources, ["https://example.org/raport", "https://example.org/a", "https://example.org/b"]);
    assert.equal(created.note.ratings.total, 0);
    assert.equal(created.note.mine, true);
    // One note per reader per post: a second attempt is refused, not silently overwritten.
    assert.equal(repo.createCommunityNote({ subjectId: post.id, authorId: follower.id, body: "A doua notă de la același autor." }).error, "note_already_exists");
    // The note author cannot rate their own note.
    assert.equal(RATE(repo, created.note.id, follower.id, true).error, "author_cannot_rate_own_note");
    // Pending notes are invisible to everybody else, and visible to their author.
    const asStranger = repo.listCommunityNotes("post", post.id, stranger.id, "social");
    assert.deepEqual(asStranger.notes, []);
    assert.equal(asStranger.mine, null);
    const asAuthor = repo.listCommunityNotes("post", post.id, follower.id, "social");
    assert.equal(asAuthor.mine.id, created.note.id);
    assert.equal(asAuthor.notes.length, 1);
    // Two helpful ratings from two perspectives still need a third.
    // One helpful rating from the muted perspective is not publication yet: the floor is three.
    assert.equal(RATE(repo, created.note.id, stranger.id, true).status, "NEEDS_MORE_RATINGS");
    assert.equal(RATE(repo, created.note.id, neutral.id, true).status, "NEEDS_MORE_RATINGS");
    const ownerRating = RATE(repo, created.note.id, owner.id, true);
    assert.equal(ownerRating.perspective, "AUTHOR");
    assert.equal(ownerRating.status, "HELPFUL");
    assert.equal(ownerRating.previous_status, "NEEDS_MORE_RATINGS");
    const published = repo.listCommunityNotes("post", post.id, stranger.id, "social");
    assert.equal(published.notes.length, 1);
    assert.equal(published.notes[0].status, "HELPFUL");
    assert.deepEqual(published.notes[0].ratings, { total: 3, helpful: 3, perspectives: 3 });
    assert.equal(published.counts.published, 1);
    assert.equal(published.notes[0].published_at > 0, true);
    // A reader can change their mind; the rule is recomputed, not cached.
    const changed = RATE(repo, created.note.id, owner.id, false);
    assert.equal(changed.status, "HELPFUL", "one changed rating does not unpublish a bridging note");
    assert.equal(changed.previous_status, "HELPFUL");
  } finally { db.close(); }
});

test("the rater's own perspective is derived from the relationship, not from the client", () => {
  const { db, repo, owner, follower, stranger, post } = fixture();
  try {
    const note = repo.createCommunityNote({ subjectId: post.id, authorId: stranger.id, body: "Verificați cifra din postare, vă rog." }).note;
    // The follower follows the author; the author wrote the post; a muted relationship is its own.
    assert.equal(RATE(repo, note.id, follower.id, true).perspective, "FOLLOWS_AUTHOR");
    assert.equal(RATE(repo, note.id, stranger.id, true).error, "author_cannot_rate_own_note");
test("a rejected or withdrawn note is explained, not erased", () => {
  const { db, repo, owner, follower, stranger, post } = fixture();
  try {
    const created = repo.createCommunityNote({ subjectId: post.id, authorId: follower.id, body: "O notă care va fi respinsă de cititori." }).note;
    assert.equal(RATE(repo, created.id, follower.id, false).error, "author_cannot_rate_own_note");
    RATE(repo, created.id, stranger.id, false);
    RATE(repo, created.id, owner.id, false);
    const third = repo.createUser({ handle: "third.p6", displayName: "Third P6" });
    repo.ensurePersona(third.id, "social", { visibility: "public" });
    const rejected = RATE(repo, created.id, third.id, false);
    assert.equal(rejected.status, "NOT_HELPFUL");
    // Hidden from the public, still readable by its author with its status and counters.
    assert.deepEqual(repo.listCommunityNotes("post", post.id, third.id, "social").notes, []);
    const own = repo.listCommunityNotes("post", post.id, follower.id, "social");
    assert.equal(own.mine.status, "NOT_HELPFUL");
    assert.equal(own.mine.ratings.total, 3);
    assert.equal(own.mine.id, created.id);
    // The author withdraws it; the trail keeps the decision.
    const withdrawn = repo.withdrawCommunityNote({ noteId: created.id, userId: follower.id, actorPersona: "social" });
    assert.equal(withdrawn.note.status, "WITHDRAWN");
    assert.equal(repo.listCommunityNotes("post", post.id, follower.id, "social").mine, null);
    assert.equal(repo.withdrawCommunityNote({ noteId: created.id, userId: stranger.id, actorPersona: "social" }).error, "note_not_found");
    const events = repo.db.prepare(`SELECT action, reason_code FROM community_note_events WHERE note_id = ? ORDER BY id`).all(created.id);
    assert.deepEqual(events.map((event) => event.action), ["CREATED", "STATUS_CHANGED", "WITHDRAWN"]);
    assert.equal(events[1].reason_code, "NOT_HELPFUL");
    // A withdrawn note can be rewritten, but the old ratings belonged to the old text.
    const rewritten = repo.createCommunityNote({ subjectId: post.id, authorId: follower.id, body: "Am reformulat nota, acum cu o sursă clară.", sources: ["https://example.org/sursa"] });
    assert.equal(rewritten.note.id, created.id);
    assert.equal(rewritten.note.status, "NEEDS_MORE_RATINGS");
    assert.equal(rewritten.note.ratings.total, 0);
    assert.deepEqual(rewritten.note.sources, ["https://example.org/sursa"]);
  } finally { db.close(); }
});

test("the server and the client agree on the note engine", () => {
  // Server: the three note endpoints exist, the payload carries the notes, and a blocked note never
  // reaches the table.
  assert.match(api, /const noteCreateMatch = path\.match\(\/\^\\\/api\\\/social\\\/posts\\\/\(\\d\+\)\\\/notes\$\//);
  assert.match(api, /const noteRateMatch = path\.match\(\/\^\\\/api\\\/social\\\/notes\\\/\(\\d\+\)\\\/rate\$\//);
  assert.match(api, /const noteWithdrawMatch = path\.match/);
  assert.match(api, /community_notes: repo\.listCommunityNotes\("post", post\.id, auth\.user\.id, auth\.persona\),/);
  assert.match(api, /note_quota: repo\.communityNoteQuota\(auth\.user\.id, auth\.persona\),/);
  assert.match(api, /return json\(res, 429, \{ ok: false, error: "note quota reached for today", quota \}\);/);
  assert.match(api, /if \(typeof body\.helpful !== "boolean"\) return json\(res, 400, \{ ok: false, error: "rating must be helpful true or false" \}\);/);
  assert.match(api, /error: "Nota a fost oprită de o regulă automată de siguranță"/);
  assert.match(api, /visibility_changed: false, enforced_facts: false,/);
  // Client: the note block lives in the post-page module, the card only names the fact.
  assert.match(detail, /export function communityNoteMarkup\(post, result, context\)/);
  assert.match(detail, /export function communityNoteComposerMarkup\(postId, context\)/);
  assert.match(detail, /export function communityNoteSourceMarkup\(note, context\)/);
  assert.match(detail, /const notesMarkup = communityNoteMarkup\(post, result, context\);/);
  assert.match(detail, /'<form class="noteComposer" data-note-composer="' \+ Number\(postId\) \+ '" hidden>',/);
  assert.match(detail, /api\("\/api\/social\/posts\/" \+ postId \+ "\/notes"/);
  assert.match(detail, /api\("\/api\/social\/notes\/" \+ noteId \+ "\/rate"/);
  assert.match(detail, /api\("\/api\/social\/notes\/" \+ noteId \+ "\/withdraw"/);
  assert.match(detail, /const load = async \(\{ reset = false, quiet = false \} = \{\}\) => \{/);
  assert.match(detail, /if \(!quiet\) context\.recordImpressions\?\.\(merged\);/);
  // The card menu is the shared builder, and the variable that replaced it is gone: a card without
  // an owner has to render for every visitor, which is exactly what broke before this wave.
  assert.match(app, /const cardMenu = postOptionsMenuMarkup\(post, \{ owner: isOwner, muted: post\.muted_by_me === true, blocked: post\.blocked_by_me === true \}\);/);
  assert.match(app, /<div class="postCreatorMenu" hidden>' \+ cardMenu \+ '<\/div><\/div><\/div>';/);
  assert.doesNotMatch(app, /\bvisitorMenu\b/);
  // The chip and the card menu: a published note is announced on the card, and the shared menu is
  // what every visitor's ••• opens.
  assert.match(app, /const noteChip = Number\(post\.community_notes\?\.counts\?\.published \|\| 0\) > 0/);
  assert.match(app, /'<span class="postContextChip" role="note">◈ ' \+ esc\(t\("x\.notes\.title"\)\) \+ '<\/span>'/);
  assert.match(detailCss, /\.communityNote\{display:grid;gap:8px;padding:12px;border:1px solid #2a4a53;border-left:3px solid #32e8dd/);
  assert.match(detailCss, /\.communityNote\.isMine\{border-left-color:#f5c451/);
  assert.match(detailCss, /\.postContextChip\{display:inline-flex/);
  // Four languages, the same keys.
  for (const key of ["x.notes.title", "x.notes.rule", "x.notes.status.NEEDS_MORE_RATINGS", "x.notes.perspective.muted_author", "x.notes.quotaReached", "x.notes.withdrawFailed"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  // The receipt names the wave, so the surface is not shipped without a written decision.
  assert.match(planning, /## 6\. Wave 3 \(P6\)/);
  assert.match(planning, /helpful_from_multiple_perspectives/);
});

test("the quota is stated in numbers instead of failing in the dark", () => {
  const { db, repo, owner, follower, stranger, post } = fixture();
  try {
    const quota = repo.communityNoteQuota(follower.id, "social");
    assert.equal(quota.notes_used, 0);
    assert.equal(quota.notes_left, COMMUNITY_NOTE_RULES.dailyNotes);
    assert.equal(quota.ratings_left, COMMUNITY_NOTE_RULES.dailyRatings);
    assert.equal(quota.window_hours, 24);
    const note = repo.createCommunityNote({ subjectId: post.id, authorId: follower.id, body: "Nota folosită pentru verificarea cotei." }).note;
    RATE(repo, note.id, stranger.id, true);
    const after = repo.communityNoteQuota(follower.id, "social");
    assert.equal(after.notes_used, 1);
    assert.equal(after.notes_left, COMMUNITY_NOTE_RULES.dailyNotes - 1);
    assert.equal(repo.communityNoteQuota(stranger.id, "social").ratings_used, 1);
    // A quota is per reader: another account still has its own.
    assert.equal(repo.communityNoteQuota(owner.id, "social").notes_used, 0);
    // The right to write expires with the window, so yesterday never blocks today.
    const future = Math.floor(Date.now() / 1000) + 25 * 3600;
    assert.equal(repo.communityNoteQuota(follower.id, "social", future).notes_used, 0);
  } finally { db.close(); }
});

    repo.setProfileMute(follower.id, "social", owner.id, true);
    assert.equal(RATE(repo, note.id, follower.id, false).perspective, "MUTED_AUTHOR");
    assert.equal(RATE(repo, note.id, owner.id, true).perspective, "AUTHOR");
  } finally { db.close(); }
});

  assert.equal(communityNotePerspective({ followsAuthor: true }), "FOLLOWS_AUTHOR");
  assert.equal(communityNotePerspective({}), "NOT_FOLLOWS_AUTHOR");
  assert.equal(communityNotePerspective(), "NOT_FOLLOWS_AUTHOR");
});
