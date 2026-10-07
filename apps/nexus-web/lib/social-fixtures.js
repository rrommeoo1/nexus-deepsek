// Realistic, deterministic, offline test-data set for the native port.
//
// Five named accounts (see docs/TEST-DATA.md) plus the documented test account as
// the viewer: follows, mutual friendships, Reels, photographs, tweets, stories,
// comments, direct conversations and notifications. Everything is written through
// the real repository state machine, so the data obeys the same privacy, media
// and moderation rules as content created by a person.
//
// No network. No wallet. No secret in this file: the account password arrives as
// an argument from NEXUS_TEST_ACCOUNT_PASSWORD (see scripts/dev-social-fixtures.mjs).
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { storeMedia } from "./media.js";
import { hashPassword } from "./security.js";

export const FIXTURE_MARKER = "social_fixture";
export const FIXTURE_EMAIL_DOMAIN = "nexus.test";
const FIXTURE_CLIP_NAMES = Object.freeze(["video/mp4", "video/webm"]);

// Five accounts. Handles obey the product's own rule (`/^[a-z0-9_]{2,30}$/`, see
// repo.claimHandle), so they survive a rename flow and can be typed by hand.
export const FIXTURE_PEERS = Object.freeze([
  { handle: "ana_popescu", displayName: "Ana Popescu", bio: "Fotograf de stradă. București, lumină de dimineață.", location: "București" },
  { handle: "mihai_ionescu", displayName: "Mihai Ionescu", bio: "Alerg dimineața, apoi caut cea mai bună cafea.", location: "Cluj-Napoca" },
  { handle: "elena_vasilescu", displayName: "Elena Vasilescu", bio: "Design grafic și ilustrație. Tipografie & afișe.", location: "Iași" },
  { handle: "andrei_stan", displayName: "Andrei Stan", bio: "Chitară, vinil și duminici lente.", location: "Timișoara" },
  { handle: "sorina_marin", displayName: "Sorina Marin", bio: "Film documentar, 16mm, Marea Neagră.", location: "Constanța" },
]);

// ---- deterministic media ------------------------------------------------------
// A gradient PNG is a placeholder, not a photograph: it exists so every post,
// story and avatar has a real content-addressed object the media pipeline accepts
// (magic signature, scan, delivery policy) without a single byte leaving the
// machine. Colours are derived from a per-asset seed, so two runs produce the
// same bytes and the same hashes.
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typed, data])), 0);
  return Buffer.concat([length, typed, data, crc]);
}

export function seedFromString(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function fixturePng({ width, height, seed = 1 }) {
  const w = Math.max(2, Math.floor(width));
  const h = Math.max(2, Math.floor(height));
  let state = seed >>> 0 || 1;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
  const channel = () => [Math.floor(next() * 160) + 48, Math.floor(next() * 160) + 48, Math.floor(next() * 160) + 48];
  const from = channel();
  const to = channel();
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < w; x += 1) {
      const t = (x / (w - 1) + y / (h - 1)) / 2;
      const p = rowStart + 1 + x * 3;
      raw[p] = Math.round(from[0] + (to[0] - from[0]) * t);
      raw[p + 1] = Math.round(from[1] + (to[1] - from[1]) * t);
      raw[p + 2] = Math.round(from[2] + (to[2] - from[2]) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- content plan --------------------------------------------------------------
// Captions are the natural key of a fixture post: the seeder refuses to create a
// second post that already exists with the same author and caption, which is what
// makes a repeated run a no-op without any extra bookkeeping.
export const FIXTURE_POSTS = Object.freeze([
  { peer: "ana_popescu", kind: "image", caption: "Răsărit peste Bucegi, lumina de la 6:10.", region: "RO-B" },
  { peer: "ana_popescu", kind: "text", caption: "Trotuarul de lângă Cișmigiu e o scenă care se montează singură." },
  { peer: "ana_popescu", kind: "video", caption: "Vântul în trestie, Delta Dunării." },
  { peer: "mihai_ionescu", kind: "video", caption: "Alergare de dimineață pe malul Someșului." },
  { peer: "mihai_ionescu", kind: "image", caption: "Cafeaua de după alergare are alt gust." },
  { peer: "mihai_ionescu", kind: "text", caption: "Antrenamentul de la 6 dimineața e cel mai bun lucru din zi." },
  { peer: "elena_vasilescu", kind: "image", caption: "Schiță pentru afișul de teatru de joi." },
  { peer: "elena_vasilescu", kind: "text", caption: "În tipografie doi pixeli contează mai mult decât crezi." },
  { peer: "andrei_stan", kind: "video", caption: "Un riff de duminică, încălzit la volum mic." },
  { peer: "andrei_stan", kind: "text", caption: "Vinilul sună altfel; nu e o metaforă, e fizică." },
  { peer: "sorina_marin", kind: "image", caption: "Dunărea la Galați, spre seară." },
  { peer: "sorina_marin", kind: "text", caption: "Filmul de 16mm și vântul de pe faleză." },
]);

export const FIXTURE_STORIES = Object.freeze([
  { peer: "ana_popescu", caption: "Prima lumină pe acoperișuri." },
  { peer: "mihai_ionescu", caption: "9 km și încă respir." },
  { peer: "elena_vasilescu", caption: "Cerneală nouă, mâini negre." },
  { peer: "andrei_stan", caption: "Coada la magazinul de viniluri." },
  { peer: "sorina_marin", caption: "Apus pe faleză." },
]);

// Mutual follows become "friends" in the product's vocabulary (privacy level
// `friends` is satisfied by a mutual follow, see lib/repo.js evaluatePrivacy).
export const FIXTURE_MUTUAL = Object.freeze([
  ["ana_popescu", "mihai_ionescu"],
  ["elena_vasilescu", "andrei_stan"],
  ["mihai_ionescu", "sorina_marin"],
]);

export const FIXTURE_COMMENTS = Object.freeze([
  { peer: "mihai_ionescu", post: "Răsărit peste Bucegi, lumina de la 6:10.", body: "Lumina asta merită trezirea.", reply: { peer: "ana_popescu", body: "Și cafeaua de după, recunosc." } },
  { peer: "elena_vasilescu", post: "Alergare de dimineață pe malul Someșului.", body: "Cadrul e perfect pentru un poster.", reply: { peer: "mihai_ionescu", body: "Îl vreau pe perete la birou." } },
  { peer: "andrei_stan", post: "Schiță pentru afișul de teatru de joi.", body: "Tipografia caldă se potrivește cu piesa.", reply: { peer: "elena_vasilescu", body: "Exact asta am urmărit." } },
]);

export const FIXTURE_REACTIONS = Object.freeze([
  { peer: "ana_popescu", post: "Cafeaua de după alergare are alt gust.", kind: "LOVE" },
  { peer: "mihai_ionescu", post: "Trotuarul de lângă Cișmigiu e o scenă care se montează singură.", kind: "LIKE" },
  { peer: "elena_vasilescu", post: "Vinilul sună altfel; nu e o metaforă, e fizică.", kind: "WOW" },
  { peer: "andrei_stan", post: "Dunărea la Galați, spre seară.", kind: "LOVE" },
  { peer: "sorina_marin", post: "În tipografie doi pixeli contează mai mult decât crezi.", kind: "LIKE" },
]);

// A conversation is (peer, lines); each line names its side: "owner" speaks with
// the documented test account, "peer" with the fixture account.
export const FIXTURE_CONVERSATIONS = Object.freeze([
  { peer: "ana_popescu", lines: [["peer", "Bună! Ai văzut răsăritul de dimineață?"], ["owner", "Îl văd chiar acum în feed. Superb."], ["peer", "Îți trimit și cadrul pe verticală."]] },
  { peer: "mihai_ionescu", lines: [["owner", "Cafeaua de după alergare — unde?"], ["peer", "La colț, pe Someșului. Te aștept mâine la 6:30."], ["owner", "Vin. Pun alarma."]] },
  { peer: "sorina_marin", lines: [["peer", "Am terminat montajul la documentar."], ["owner", "Când îl vedem?"], ["peer", "Vineri, la cinematecă. Țin loc."]] },
]);

export const FIXTURE_GROUP = Object.freeze({
  title: "Weekend în Delta",
  members: ["ana_popescu", "mihai_ionescu"],
  lines: [["ana_popescu", "Unde dormim, la Crișan sau la Mila 23?"], ["mihai_ionescu", "Mila 23, e mai liniște."], ["owner", "Mila 23. Plecăm vineri după-amiază."]],
});

// Bodies for the owner's notification list. Only `message` matches an emission the
// server performs itself (`New <persona> message from @handle`, lib/api.js); the
// rest are written here directly so the notifications screen has every type to
// render. `repo.notify` still applies the account's preview preference, so these
// bodies are redacted exactly like production ones.
export const FIXTURE_NOTIFICATIONS = Object.freeze([
  { type: "follow", body: "New follower from @ana_popescu" },
  { type: "reaction", body: "LIKE from @mihai_ionescu" },
  { type: "comment", body: "Comment from @elena_vasilescu: Super lumină!" },
  { type: "story", body: "New story from @ana_popescu" },
  { type: "mention", body: "Mention from @andrei_stan" },
  { type: "message", body: "New social message from @sorina_marin" },
]);

// ---- seeder --------------------------------------------------------------------
// Every generated object is admitted through the same two steps the upload route
// uses (content-addressed store, then a media record with an upload grant), and
// its provenance is written where the product already keeps it, so the fixture
// content can be removed later with `content-unseed.mjs`.
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function seedSocialFixtures(repo, db, { password, ownerHandle = "test", clips = [], log = () => {} } = {}) {
  if (typeof password !== "string" || password.length < 8) throw new Error("FIXTURE_PASSWORD_REQUIRED");
  const owner = repo.getUserByHandle(ownerHandle);
  if (!owner) throw new Error(`FIXTURE_OWNER_MISSING: @${ownerHandle} nu există; rulează întâi "npm run dev:test-account".`);
  const summary = { accounts: 0, avatars: 0, media: 0, follows: 0, mutual: 0, posts: 0, stories: 0, comments: 0, reactions: 0, conversations: 0, messages: 0, notifications: 0, reused_clips: 0, skipped: 0 };
  const mediaUrl = (media) => `/media/${media.hash}.${media.ext}`;
  const recordSource = db.prepare(`INSERT INTO content_sources
    (media_id, hash, provider, source_url, author, licence, licence_url, metadata_stripped, ingest_marker)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  const hasSource = db.prepare(`SELECT 1 FROM content_sources WHERE source_url = ? LIMIT 1`);

  const admitObject = (stored, userId, handle, key, purpose) => {
    if (!stored || stored.scanStatus !== "ready_local_validation") return null;
    const media = repo.insertMedia({
      hash: stored.hash, ext: stored.ext, mime: stored.mime, detectedMime: stored.detectedMime,
      kind: stored.kind, size: stored.size, uploadedBy: userId, purpose,
      scanStatus: stored.scanStatus, scanReason: stored.scanReason,
    });
    if (!media) return null;
    // Provenance is written once per object, so a repeated run neither duplicates
    // the row nor inflates the count.
    const sourceUrl = `nexus-fixture://${handle}/${key}`;
    if (!hasSource.get(sourceUrl)) {
      recordSource.run(media.id, media.hash, "fixture", sourceUrl, handle, "CC0", "", FIXTURE_MARKER);
      summary.media += 1;
    }
    return media;
  };

  const admitGenerated = (userId, handle, key, purpose, width, height) =>
    admitObject(storeMedia(fixturePng({ width, height, seed: seedFromString(`${handle}:${key}`) }), "image/png"), userId, handle, key, purpose);

  // A clip cannot be invented, so it is never fabricated: either the caller
  // supplies local files, or the run reuses a clip already validated on this
  // machine. No byte is fetched from the network by this script.
  const clipQueue = [...clips];
  const admitClip = (userId, handle, key, purpose) => {
    const file = clipQueue.shift();
    if (file) {
      const mime = FIXTURE_CLIP_NAMES.find((known) => String(file).toLowerCase().endsWith(known.split("/")[1])) ?? "video/mp4";
      return admitObject(storeMedia(readFileSync(file), mime), userId, handle, key, purpose);
    }
    const row = db.prepare(`SELECT * FROM media WHERE kind = 'video' AND mime = ? AND scan_status = 'ready_local_validation' ORDER BY id LIMIT 1`).get("video/mp4")
      ?? db.prepare(`SELECT * FROM media WHERE kind = 'video' AND scan_status = 'ready_local_validation' ORDER BY id LIMIT 1`).get();
    if (!row) return null;
    const media = repo.insertMedia({
      hash: row.hash, ext: row.ext, mime: row.mime, detectedMime: row.detected_mime, kind: row.kind,
      size: row.size, uploadedBy: userId, purpose, scanStatus: row.scan_status, scanReason: row.scan_reason,
    });
    if (media) summary.reused_clips += 1;
    return media;
  };

  // ---- accounts ----
  // `resetPassword`/`setFixtureEmail` are true for the fixture accounts (so any of
  // them can be used to log in) and false for the viewer: the documented test
  // account keeps the password and the email identity the rest of the product
  // knows it by (`test@nexus.ro`, see lib/api.js).
  const buildAccount = (handle, displayName, bio, location, { resetPassword = true, setFixtureEmail = true } = {}) => {
    let user = repo.getUserByHandle(handle);
    if (!user) {
      user = repo.createUser({ handle, displayName, bio, passwordHash: resetPassword ? hashPassword(password) : null });
      summary.accounts += 1;
    } else if (resetPassword) {
      repo.updatePassword(user.id, hashPassword(password));
    }
    if (setFixtureEmail) {
      repo.linkProvider(user.id, { email: `${handle}@${FIXTURE_EMAIL_DOMAIN}` });
      repo.verifyUserEmail(user.id);
    }
    repo.markOnboarded(user.id);
    repo.ensurePersona(user.id, "social", { name: displayName, bio, visibility: "public" });
    repo.ensurePersona(user.id, "work", { name: displayName, visibility: "public" });
    const avatar = admitGenerated(user.id, handle, "avatar", "profile_avatar", 256, 256);
    const cover = admitGenerated(user.id, handle, "cover", "profile_avatar", 768, 320);
    if (avatar) {
      summary.avatars += 1;
      db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`).run(mediaUrl(avatar), user.id);
    }
    repo.updatePersona(user.id, "social", {
      bio, location, visibility: "public",
      avatar: avatar ? mediaUrl(avatar) : undefined,
      cover: cover ? mediaUrl(cover) : undefined,
    });
    return repo.getUserById(user.id);
  };

  const peers = new Map();
  for (const peer of FIXTURE_PEERS) peers.set(peer.handle, buildAccount(peer.handle, peer.displayName, peer.bio, peer.location));
  buildAccount(ownerHandle, owner.display_name, owner.bio, null, { resetPassword: false, setFixtureEmail: false });
  const ownerProfile = repo.getUserByHandle(ownerHandle);
  log(`conturi: ${peers.size} actualizate + @${ownerHandle}`);

  // ---- graph ----
  // Every peer follows the owner. The owner follows all but the last peer, so a
  // profile with a "Follow" call to action is still reachable without unfollowing
  // anybody. Mutual pairs become the `friends` privacy level.
  const handles = FIXTURE_PEERS.map((peer) => peer.handle);
  for (const handle of handles) {
    repo.setFollow(peers.get(handle).id, ownerProfile.id, "social", true);
    summary.follows += 1;
  }
  for (const handle of handles.slice(0, handles.length - 1)) {
    repo.setFollow(ownerProfile.id, peers.get(handle).id, "social", true);
    summary.follows += 1;
  }
  for (const [a, b] of FIXTURE_MUTUAL) {
    repo.setFollow(peers.get(a).id, peers.get(b).id, "social", true);
    repo.setFollow(peers.get(b).id, peers.get(a).id, "social", true);
    summary.mutual += 1;
  }
  log(`graf: ${summary.follows} urmăriri, ${summary.mutual} cupluri reciproce (prieteni)`);

  // ---- posts ----
  const postByCaption = new Map();
  const findPost = db.prepare(`SELECT id FROM posts WHERE user_id = ? AND caption = ? AND kind = ? LIMIT 1`);
  const publish = (author, handle, entry) => {
    const existing = findPost.get(author.id, entry.caption, entry.kind);
    if (existing) {
      summary.skipped += 1;
      postByCaption.set(entry.caption, repo.getPostById(existing.id));
      return;
    }
    const key = `post:${entry.kind}:${seedFromString(entry.caption).toString(16)}`;
    const media = entry.kind === "image"
      ? admitGenerated(author.id, handle, key, "social_post", 720, 900)
      : entry.kind === "video" ? admitClip(author.id, handle, key, "social_post") : null;
    const post = repo.createPost({
      userId: author.id, persona: "social", kind: entry.kind, caption: entry.caption,
      mediaId: media ? media.id : null, visibility: "public", language: "ro", regionCode: entry.region ?? null,
    });
    postByCaption.set(entry.caption, post);
    summary.posts += 1;
  };

  for (const entry of FIXTURE_POSTS) publish(peers.get(entry.peer), entry.peer, entry);
  // Two posts by the owner, so a profile tab and the composer are never empty.
  publish(ownerProfile, ownerHandle, { kind: "image", caption: "Biroul de dimineață: cafea, caiet, lumină rece." });
  publish(ownerProfile, ownerHandle, { kind: "text", caption: "Testez Nexus pe telefon: feed, gesturi și profil." });
  log(`postări: ${summary.posts} noi, ${summary.skipped} deja existente`);

  // ---- stories ----
  const findStory = db.prepare(`SELECT id FROM stories WHERE user_id = ? AND caption = ? LIMIT 1`);
  const storyExpiry = nowSeconds() + 24 * 3600;
  for (const entry of [...FIXTURE_STORIES, { peer: ownerHandle, caption: "Prima zi cu datele de test." }]) {
    const author = entry.peer === ownerHandle ? ownerProfile : peers.get(entry.peer);
    if (findStory.get(author.id, entry.caption)) { summary.skipped += 1; continue; }
    const media = admitGenerated(author.id, entry.peer, `story:${seedFromString(entry.caption).toString(16)}`, "story", 720, 1280);
    repo.createStory({ userId: author.id, persona: "social", mediaId: media ? media.id : null, caption: entry.caption, visibility: "public", expiresAt: storyExpiry });
    summary.stories += 1;
  }

  // ---- comments ----
  const findComment = db.prepare(`SELECT id FROM comments WHERE post_id = ? AND user_id = ? AND body = ? LIMIT 1`);
  for (const thread of FIXTURE_COMMENTS) {
    const post = postByCaption.get(thread.post);
    if (!post) continue;
    const author = peers.get(thread.peer);
    const found = findComment.get(post.id, author.id, thread.body);
    const parent = found ? repo.getCommentById(found.id) : repo.addSocialComment({ userId: author.id, actorPersona: "social", postId: post.id, body: thread.body });
    if (!found) summary.comments += 1;
    if (thread.reply) {
      const replier = peers.get(thread.reply.peer);
      if (!findComment.get(post.id, replier.id, thread.reply.body)) {
        repo.addSocialComment({ userId: replier.id, actorPersona: "social", postId: post.id, parentId: parent.id, body: thread.reply.body });
        summary.comments += 1;
      }
    }
  }

  // ---- reactions ----
  for (const entry of FIXTURE_REACTIONS) {
    const post = postByCaption.get(entry.post);
    if (!post) continue;
    repo.setPostReaction(peers.get(entry.peer).id, "social", post.id, entry.kind, true);
    summary.reactions += 1;
  }

  // ---- conversations ----
  const send = (conversation, senderId, body, index) => repo.sendConversationMessage({
    conversationId: conversation.id, senderId, senderPersona: "social", body,
    clientNonce: `fixture:${conversation.id}:${index}`,
  });
  for (const plan of FIXTURE_CONVERSATIONS) {
    const peer = peers.get(plan.peer);
    const conversation = repo.createDirectConversation({ creatorId: ownerProfile.id, recipientId: peer.id, contextPersona: "social" });
    if (!conversation) { summary.skipped += 1; continue; }
    summary.conversations += 1;
    plan.lines.forEach(([side, body], index) => {
      if (send(conversation, side === "owner" ? ownerProfile.id : peer.id, body, index)) summary.messages += 1;
    });
  }
  const group = repo.listUnifiedConversations(ownerProfile.id, { persona: "social" }).find((row) => row.kind === "group" && row.title === FIXTURE_GROUP.title)
    ?? repo.createGroupConversation({ creatorId: ownerProfile.id, memberIds: FIXTURE_GROUP.members.map((handle) => peers.get(handle).id), title: FIXTURE_GROUP.title, contextPersona: "social" });
  if (group) {
    summary.conversations += 1;
    for (const handle of FIXTURE_GROUP.members) repo.decideGroupInvitation(group.id, peers.get(handle).id, "accept");
    FIXTURE_GROUP.lines.forEach(([who, body], index) => {
      if (send(group, who === "owner" ? ownerProfile.id : peers.get(who).id, body, index)) summary.messages += 1;
    });
  }

  // ---- notifications ----
  // `repo.notify` redacts a body to the account's preview preference (generic by
  // default), so the existence check uses the same redacted form the list shows.
  const redact = (body) => String(body).replace(/\s+from\s+@?[a-z0-9_.-]+/i, "");
  const hasNote = (body) => repo.listNotifications(ownerProfile.id, { persona: "social", limit: 100 }).some((row) => row.body === redact(body));
  for (const note of FIXTURE_NOTIFICATIONS) {
    if (hasNote(note.body)) { summary.skipped += 1; continue; }
    if (repo.notify(ownerProfile.id, note.type, note.body, { persona: "social" }).delivered) summary.notifications += 1;
  }

  log(`stories: ${summary.stories} | comentarii: ${summary.comments} | reacții: ${summary.reactions} | conversații: ${summary.conversations} (${summary.messages} mesaje) | notificări: ${summary.notifications}`);
  return summary;
}
