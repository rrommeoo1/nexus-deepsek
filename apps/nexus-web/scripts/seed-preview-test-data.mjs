#!/usr/bin/env node
/*
 * seed-preview-test-data.mjs — guarded seeding of a PREVIEW deployment through the PUBLIC API.
 *
 * What it does (public API only: no database access, no server or config changes):
 *   1. creates exactly 5 test accounts through /auth/email/signup (one-time wallet-proof challenge),
 *   2. keeps their session cookies, passwords and wallet secret keys in a GITIGNORED local file
 *      (docs/.test-sessions.local) — never in git, never in the readable report,
 *   3. publishes a small, licence-clean set of content with those sessions: photos, clips and
 *      text posts, one story each, comments, follows and one plaintext message.
 *
 * It is deliberately fail-fast and never retries: the public sign-up endpoint allows 5 attempts
 * per hour per client IP, so the whole run *is* that budget. The first unexpected answer stops
 * the run, keeps whatever was already written and reports it.
 *
 * Usage:
 *   node scripts/seed-preview-test-data.mjs --self-test                          # offline primitive checks
 *   node scripts/seed-preview-test-data.mjs --preflight --target=<host>          # check the target, creates nothing
 *   node scripts/seed-preview-test-data.mjs --target=<host> --confirm            # the real one-shot seed
 *   node scripts/seed-preview-test-data.mjs --target=<host> --confirm --resume   # continue with the saved sessions
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { Address, UserSecretKey, UserSigner, UserVerifier } from "@multiversx/sdk-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const SECRETS_FILE = join(REPO_ROOT, "docs", ".test-sessions.local");
const TMP = process.env.TEMP || process.env.TMP || REPO_ROOT;
const PUBLIC_REPORT = join(TMP, "nexus-preview-seed-report.md");
const MEDIA_DIR = join(TMP, "nexus-preview-seed-media");

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const preflight = args.includes("--preflight");
const target = args.find((a) => a.startsWith("--target="))?.slice("--target=".length);
const confirmed = args.includes("--confirm");
if (!selfTest && !target) {
  console.error("refusing to run: pass --target=<railway-host> (--preflight to check it, --confirm to seed)");
  process.exit(2);
}
if (!selfTest && !preflight && !confirmed) {
  console.error("refusing to run: seeding creates real accounts, so it needs --confirm");
  process.exit(2);
}
const BASE = target ? `https://${target}` : "https://self-test.invalid";

const ACCOUNTS = [
  { email: "railway-test-01@nexus.test", display: "Nexus Test 01", plan: ["photo", "tweet"] },
  { email: "railway-test-02@nexus.test", display: "Nexus Test 02", plan: ["clip", "tweet"] },
  { email: "railway-test-03@nexus.test", display: "Nexus Test 03", plan: ["photo", "tweet"] },
  { email: "railway-test-04@nexus.test", display: "Nexus Test 04", plan: ["clip", "tweet"] },
  { email: "railway-test-05@nexus.test", display: "Nexus Test 05", plan: ["photo", "tweet"] },
];
const BIO = "[test] Cont de test Nexus (Railway preview). Fără valoare.";
const TEST_HANDLE = "test";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idem = () => randomBytes(16).toString("hex");
// Every mutation carries an Idempotency-Key, and the server remembers each key's response. Deriving
// the key from a fixed run seed instead of randomness turns re-runs into replays: a post, story,
// comment or message that already exists comes back as the same record instead of a duplicate.
const RUN_SEED = "nexus-preview-seed-v1";
const opKey = (op) => createHash("sha256").update(`${RUN_SEED}:${op}`).digest("hex");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

class Stop extends Error {}
function expect(res, name, okStatuses) {
  if (okStatuses.includes(res.status)) return res.data;
  const err = new Stop(`${name}: HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  err.status = res.status;
  throw err;
}

let calls = 0;
async function api(method, path, { json, cookie, body, contentType, op } = {}) {
  const headers = { origin: BASE, accept: "application/json" };
  if (cookie) headers.cookie = cookie;
  let payload = body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(json);
  }
  if (contentType) headers["content-type"] = contentType;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers["idempotency-key"] = op ? opKey(op) : idem();
  calls += 1;
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return { status: res.status, data, setCookies };
}

function sessionCookieFrom(setCookies) {
  for (const line of setCookies) {
    const match = /(?:^|,\s*)nexus_session=([^;]+)/.exec(line);
    if (match) return `nexus_session=${match[1]}`;
  }
  return null;
}
// ---- wallet proof (the browser's job in the real client): the deployment only ever sees the
// address and the signature over this one-time, email-bound message. ------------------------
function signupMessage(email, nonce) {
  const digest = createHash("sha256").update(String(email).trim().toLowerCase(), "utf8").digest("hex");
  return `NEXUS_EMAIL_DEVICE_WALLET_V1:${digest}:${nonce}`;
}

async function makeWalletProof(email, nonce) {
  const secretKey = UserSecretKey.generate();
  const signer = new UserSigner(secretKey);
  const address = signer.getAddress().toBech32();
  const message = signupMessage(email, nonce);
  const signature = Buffer.from(await signer.sign(new TextEncoder().encode(message))).toString("hex");
  const verifier = UserVerifier.fromAddress(Address.newFromBech32(address));
  const valid = await verifier.verify(Buffer.from(message, "utf8"), Buffer.from(signature, "hex"));
  if (!valid) throw new Stop("local self-check failed: wallet proof does not verify (nothing was sent)");
  return { nonce, address, signature, secretKeyHex: secretKey.hex() };
}

// ---- synthetic photo, generated locally (no third-party content) --------------------------
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const tag = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([length, tag, data, crc]);
}
function makePhotoPng(size, base) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 3;
      raw[offset] = (base[0] + ((x * 7) % 48)) & 0xff;
      raw[offset + 1] = (base[1] + Math.round(200 * (1 - y / size))) & 0xff;
      raw[offset + 2] = (base[2] + ((x + y) % 32)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // truecolour
  return Buffer.concat([
    PNG_SIG, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 6 })), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- licence-clean clip: Wikimedia Commons is the host the product's own clip ingest uses.
// Only small, freely licensed files are picked, and the licence + author travel in the caption.
async function commonsCandidates() {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", "filetype:video timelapse");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "40");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime|extmetadata");
  const res = await fetch(url, { headers: { "user-agent": "nexus-preview-seed/1.0 (local test data)" } });
  if (!res.ok) throw new Stop(`commons search: HTTP ${res.status}`);
  const data = await res.json();
  const rows = [];
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info || info.mime !== "video/webm") continue;
    rows.push({
      title: page.title,
      mb: info.size / 1048576,
      url: info.url,
      licence: info.extmetadata?.LicenseShortName?.value ?? "unknown",
      author: String(info.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 60),
    });
  }
  return rows.sort((a, b) => a.mb - b.mb);
}

const usedClips = new Set();
async function downloadCommonsClip(maxMb = 6) {
  const candidates = await commonsCandidates();
  const pick = candidates.find((row) => row.mb <= maxMb && !usedClips.has(row.title));
  if (!pick) throw new Stop("no small Wikimedia clip found under the size limit");
  usedClips.add(pick.title);
  const res = await fetch(pick.url, { headers: { "user-agent": "nexus-preview-seed/1.0 (local test data)" } });
  if (!res.ok) throw new Stop(`commons download: HTTP ${res.status} for ${pick.title}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  mkdirSync(MEDIA_DIR, { recursive: true });
  writeFileSync(join(MEDIA_DIR, pick.title.replace(/^File:/, "").replace(/[^\w.-]/g, "_")), bytes);
  return { bytes, ...pick };
}
// ---- the product's own upload contract: begin → parts → complete (1 MiB chunks). The part
// numbers are 0-indexed and the final part carries the remainder — that is exactly the shape
// putResumablePart validates (partNumber >= 0 && partNumber < total_parts).
function partRequests(bytes, chunkSize) {
  const parts = [];
  for (let index = 0; index * chunkSize < bytes.length; index += 1) {
    parts.push({ number: index, bytes: bytes.subarray(index * chunkSize, (index + 1) * chunkSize) });
  }
  return parts;
}

// `label` is part of the idempotency key, so each distinct upload (photo, clip, story) gets its own
// replay slot: re-running finds the same upload session and the same media instead of a second copy.
async function uploadMedia(cookie, purpose, mime, bytes, label) {
  const begin = expect(await api("POST", "/api/uploads", {
    cookie,
    op: `upload-${label}`,
    json: { purpose, mime, total_bytes: bytes.length, expected_sha256: sha256(bytes) },
  }), `upload begin (${purpose}/${mime})`, [200, 201]);
  const uploadId = begin.upload.id;
  // A re-run finds the same upload session (same key, same bytes). If an earlier pass already
  // finished it, the file sits in the media store and the upload is closed: parts are refused, but
  // completion replays and returns the very same media record, so nothing is uploaded twice.
  if (begin.upload.status !== "initiated" && begin.upload.status !== "uploading") {
    if (begin.upload.status !== "completed") {
      throw new Stop(`upload ${label} is ${begin.upload.status} (${begin.upload.error_code ?? "no code"}) — use a new label to start over`);
    }
    const replayed = expect(await api("POST", `/api/uploads/${uploadId}/complete`, { cookie, op: `upload-complete-${label}` }),
      "upload complete (replay)", [200, 201]);
    return replayed.media;
  }
  const plan = partRequests(bytes, begin.upload.chunk_size);
  if (plan.length !== begin.upload.total_parts) {
    throw new Stop(`part plan mismatch: client ${plan.length} vs server ${begin.upload.total_parts}`);
  }
  for (const part of plan) {
    expect(await api("PUT", `/api/uploads/${uploadId}/parts/${part.number}`, {
      cookie, op: `upload-part-${label}-${part.number}`,
      body: part.bytes, contentType: "application/octet-stream",
    }), `upload part ${part.number + 1}/${plan.length}`, [200, 201]);
    await sleep(200);
  }
  const done = expect(await api("POST", `/api/uploads/${uploadId}/complete`, { cookie, op: `upload-complete-${label}` }),
    "upload complete", [200, 201]);
  return done.media;
}

async function createPost(cookie, payload, op) {
  const body = expect(await api("POST", "/api/posts", { cookie, json: payload, op }), "post publish", [201]);
  return body.post;
}

async function createStory(cookie, payload, op) {
  const body = expect(await api("POST", "/api/stories", { cookie, json: payload, op }), "story publish", [201]);
  return body.story;
}

// ---- report: the readable file has no secrets; cookies/passwords live only in the
// gitignored .local file -------------------------------------------------------------------
const report = { base: BASE, started_at: new Date().toISOString(), calls: 0, accounts: [], steps: [] };
function note(step, detail) {
  report.steps.push({ step, detail, at: new Date().toISOString() });
  console.log(`  · ${step}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

function writeOutputs(sessions, status) {
  report.calls = calls;
  report.finished_at = new Date().toISOString();
  report.status = status;
  mkdirSync(dirname(SECRETS_FILE), { recursive: true });
  writeFileSync(SECRETS_FILE, `${JSON.stringify({
    note: "Local-only. Session cookies, test passwords and wallet secret keys for the Railway preview test accounts. Never commit, never paste into docs or reports.",
    base: BASE,
    written_at: new Date().toISOString(),
    accounts: sessions,
  }, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(PUBLIC_REPORT, [
    `# Railway preview seed — ${status}`,
    "",
    `Target: \`${BASE}\``,
    `Finished: ${report.finished_at} · API calls: ${report.calls}`,
    "",
    "## Accounts",
    "",
    "| handle | user_id | email | display name | bio |",
    "|---|---|---|---|---|",
    ...report.accounts.map((a) => `| \`${a.handle}\` | ${a.userId} | \`${a.email}\` | ${a.display} | ${BIO} |`),
    "",
    "## Steps",
    "",
    ...report.steps.map((s) => `- **${s.step}** — ${typeof s.detail === "string" ? s.detail : JSON.stringify(s.detail)}`),
    "",
    "Secrets (cookies, passwords, wallet keys) are in `docs/.test-sessions.local`, which is gitignored.",
    "",
  ].join("\n"));
  console.log(`secrets  -> ${SECRETS_FILE} (gitignored)`);
  console.log(`report   -> ${PUBLIC_REPORT}`);
}

// ---- main ---------------------------------------------------------------------------------
const sessions = [];
async function main({ resume = false } = {}) {
  note("health", "GET /health");
  const health = expect(await api("GET", "/health"), "health", [200]);
  note("health", `status=${health.status} ok=${health.ok}`);

  // The 5 sign-ups per hour are a hard budget, so a resumed run refuses to create anything: it
  // reuses the sessions already written to docs/.test-sessions.local and proves each one still
  // works with GET /api/me before spending any content call on it.
  if (resume) {
    const saved = JSON.parse(readFileSync(SECRETS_FILE, "utf8"));
    if (saved.base !== BASE) throw new Stop(`saved sessions belong to ${saved.base}, not ${BASE}`);
    if (!Array.isArray(saved.accounts) || !saved.accounts.length) throw new Stop("no saved accounts to resume from");
    for (const account of saved.accounts) {
      if (!account.cookie) throw new Stop(`saved session for ${account.email} has no cookie`);
      sessions.push({ ...account });
      report.accounts.push({ handle: account.handle, userId: account.userId, email: account.email, display: account.display });
    }
    for (const session of sessions) {
      expect(await api("GET", "/api/me", { cookie: session.cookie }), `session @${session.handle}`, [200]);
      await sleep(250);
    }
    note("resume", `reused ${sessions.length} saved sessions and verified them with GET /api/me`);
  }

  for (let i = 0; i < ACCOUNTS.length; i += 1) {
    if (sessions.some((session) => session.email === ACCOUNTS[i].email)) continue; // already exists on resume
    const account = ACCOUNTS[i];
    const password = `${randomBytes(9).toString("base64url")}9a`;
    console.log(`\n[${i + 1}/5] signup ${account.email}`);
    const init = expect(await api("POST", "/auth/email/signup-init", { json: { email: account.email } }),
      "signup-init", [200]);
    const proof = await makeWalletProof(account.email, init.nonce);
    const created = await api("POST", "/auth/email/signup", {
      json: {
        email: account.email, password, display_name: account.display, handle: "",
        wallet_proof: { nonce: proof.nonce, address: proof.address, signature: proof.signature },
      },
    });
    if (created.status === 503) {
      throw new Stop(`signup refused with 503 — this deployment is NOT in preview mode (${JSON.stringify(created.data)})`);
    }
    expect(created, "signup", [201]);
    const cookie = sessionCookieFrom(created.setCookies);
    if (!cookie) throw new Stop("signup returned no nexus_session cookie");
    const session = {
      index: i + 1, email: account.email, password, display: account.display,
      handle: created.data.user.handle, userId: created.data.user.id,
      walletAddress: proof.address, walletSecretKeyHex: proof.secretKeyHex, cookie,
      plan: account.plan,
    };
    sessions.push(session);
    report.accounts.push({ handle: session.handle, userId: session.userId, email: account.email, display: account.display });
    note(`signup ${account.email}`, `handle=@${session.handle} user_id=${session.userId} email_status=${created.data.email_status}`);
    await sleep(3500); // keep the 5-per-hour sign-up budget honest and unhurried
  }
  // 2. the [test] marker on every profile, plus a public profile. A fresh persona defaults to
  // visibility 'friends', which means "mutual followers only" — and since @test follows nobody, that
  // default would hide every seeded post from the account the whole exercise is for. The posts
  // themselves are already created with visibility public.
  //
  // The bio exists twice, on two records written by two routes: `/api/profile` stores the account's
  // (what the "me" payload carries) and `/api/persona/<persona>` stores the profile's (what a visitor
  // reads on the profile page). Writing only the first leaves the profile page silent, which is how
  // an earlier pass of this script ended up with an empty bio on all five profiles. Both labels are
  // fresh: an idempotency key is unique per (user, persona, key) — not per route — so the older
  // `bio-<handle>` slot cannot be reused for a different body, and one key must never name two routes.
  for (const session of sessions) {
    expect(await api("PATCH", "/api/profile", { cookie: session.cookie, json: { bio: BIO }, op: `account-bio-${session.handle}` }),
      `account bio ${session.handle}`, [200]);
    expect(await api("PATCH", "/api/persona/social", {
      cookie: session.cookie, json: { bio: BIO, visibility: "public" }, op: `profile-bio-${session.handle}`,
    }), `profile bio + visibility ${session.handle}`, [200]);
    await sleep(350);
  }
  note("bio + visibility", `"${BIO}" (account and profile) and visibility=public written to the 5 profiles`);

  const targetRes = await api("GET", `/api/profiles/${TEST_HANDLE}`, { cookie: sessions[0].cookie });
  if (targetRes.status === 404) {
    throw new Stop(`@${TEST_HANDLE} does not exist on this deployment — the on-device check would fail`);
  }
  const targetBody = expect(targetRes, `profile @${TEST_HANDLE}`, [200]);
  const target = targetBody.profile;
  if (!Number.isSafeInteger(target.user_id)) throw new Stop("target profile has no user_id");
  // The profile's posts and stories are siblings of the profile object in this payload, not fields of
  // it — reading them off `profile` silently yields an empty list.
  const targetPosts = Array.isArray(targetBody.posts) ? targetBody.posts : [];
  note("target", `@${TEST_HANDLE} user_id=${target.user_id} visibility=${target.visibility} public_posts=${targetPosts.length} newest=${targetPosts[0]?.id ?? "none"}`);

  // 3. content: one photo or clip plus one text post per account, then a story
  const PALETTE = [[176, 92, 44], [46, 122, 180], [126, 176, 66], [198, 64, 118], [92, 96, 198]];
  const PILL = "Cont de test Nexus (Railway preview). Fără valoare.";
  for (const session of sessions) {
    const palette = PALETTE[(session.index - 1) % PALETTE.length];
    console.log(`\n[${session.index}/5] content for @${session.handle}`);
    let mediaItem = null;
    if (session.plan.includes("photo")) {
      const media = await uploadMedia(session.cookie, "social_post", "image/png", makePhotoPng(720, palette), `photo-${session.handle}`);
      const post = await createPost(session.cookie, {
        kind: "image", caption: `[test] Fotografie de verificare. ${PILL}`, visibility: "public",
        provenance: "NOT_DECLARED", language: "ro", media_items: [{ hash: media.hash, ext: media.ext }],
      }, `post-photo-${session.handle}`);
      mediaItem = { type: "photo", post_id: post.id, media_hash: media.hash, media_ext: media.ext };
      note(`post @${session.handle} photo`, `post_id=${post.id}`);
    } else {
      const clip = await downloadCommonsClip(6);
      const media = await uploadMedia(session.cookie, "social_post", "video/webm", clip.bytes, `clip-${session.handle}`);
      const post = await createPost(session.cookie, {
        kind: "video",
        caption: `[test] Clip de verificare. Sursă: Wikimedia Commons — ${clip.title.replace(/^File:/, "")} · autor ${clip.author || "necunoscut"} · licență ${clip.licence}. ${PILL}`,
        visibility: "public", provenance: "NOT_DECLARED", language: "ro",
        media_items: [{ hash: media.hash, ext: media.ext }],
      }, `post-clip-${session.handle}`);
      mediaItem = {
        type: "clip", post_id: post.id, media_hash: media.hash, media_ext: media.ext,
        source: { title: clip.title, url: clip.url, licence: clip.licence, author: clip.author, mb: Number(clip.mb.toFixed(2)) },
      };
      note(`post @${session.handle} clip`, `post_id=${post.id} bytes=${clip.bytes.length} licence=${clip.licence}`);
    }
    await sleep(400);
    const tweet = await createPost(session.cookie, {
      kind: "text", caption: `[test] Tweetul de verificare al contului @${session.handle}. ${PILL}`,
      visibility: "public", provenance: "NOT_DECLARED", language: "ro",
    }, `post-tweet-${session.handle}`);
    note(`post @${session.handle} tweet`, `post_id=${tweet.id}`);
    await sleep(400);

    const storyMedia = await uploadMedia(session.cookie, "story", "image/png", makePhotoPng(640, palette), `story-${session.handle}`);
    const story = await createStory(session.cookie, {
      caption: `[test] Story de verificare (@${session.handle}). ${PILL}`,
      visibility: "public", duration_hours: 168, media_hash: storyMedia.hash,
    }, `story-${session.handle}`);
    note(`story @${session.handle}`, `story_id=${story.id} media_hash=${storyMedia.hash}`);
    session.mediaItem = mediaItem;
    await sleep(400);
  }
  // 4. follows: every account follows @test (its follower notifications land on @test) and the ring
  for (const session of sessions) {
    expect(await api("POST", "/api/follow", { cookie: session.cookie, json: { user_id: target.user_id }, op: `follow-target-${session.handle}` }),
      `follow @${TEST_HANDLE} as @${session.handle}`, [200, 201]);
    note(`follow @${session.handle} -> @${TEST_HANDLE}`, `target user_id=${target.user_id}`);
    await sleep(500);
  }
  for (let i = 0; i < sessions.length; i += 1) {
    const from = sessions[i];
    const to = sessions[(i + 1) % sessions.length];
    expect(await api("POST", "/api/follow", { cookie: from.cookie, json: { user_id: to.userId }, op: `follow-ring-${from.handle}-${to.handle}` }),
      `follow ring @${from.handle} -> @${to.handle}`, [200, 201]);
    note(`follow ring @${from.handle} -> @${to.handle}`, `target user_id=${to.userId}`);
    await sleep(500);
  }

  // 5. comments: two on @test's newest post when it has one, plus one per account on a peer post
  const commentPlan = [];
  if (targetPosts.length) {
    commentPlan.push({ author: sessions[0], postId: targetPosts[0].id, on: `@${TEST_HANDLE} post ${targetPosts[0].id}` });
    commentPlan.push({ author: sessions[2], postId: targetPosts[0].id, on: `@${TEST_HANDLE} post ${targetPosts[0].id}` });
  } else {
    note("comments", `@${TEST_HANDLE} has no public post to comment on — those two were skipped`);
  }
  for (let i = 0; i < sessions.length; i += 1) {
    const peer = sessions[(i + 1) % sessions.length];
    if (peer.mediaItem?.post_id) {
      commentPlan.push({ author: sessions[i], postId: peer.mediaItem.post_id, on: `@${peer.handle} post ${peer.mediaItem.post_id}` });
    }
  }
  const comments = [];
  for (const entry of commentPlan) {
    // The key is deliberately versioned: an earlier attempt failed with 404 (profile visibility was
    // 'friends', so the post was invisible to a non-mutual follower) and the server stores the
    // response of every mutation, failures included. A fresh key is what lets this step run at all.
    const created = expect(await api("POST", `/api/posts/${entry.postId}/comments`, {
      cookie: entry.author.cookie,
      op: `comment-v2-${entry.author.handle}-${entry.postId}`,
      json: { body: `[test] Comentariu de verificare de la @${entry.author.handle}. ${PILL}` },
    }), `comment by @${entry.author.handle} on ${entry.on}`, [201]);
    comments.push({ by: entry.author.handle, on: entry.on, comment_id: created.comment?.id ?? null });
    note(`comment @${entry.author.handle}`, `comment_id=${created.comment?.id} on ${entry.on}`);
    await sleep(500);
  }

  // 6. one plaintext message to @test (the sender follows it, so the thread is allowed)
  const conversation = expect(await api("POST", "/api/chat/conversations", {
    cookie: sessions[0].cookie, json: { username: TEST_HANDLE },
    op: `conversation-${sessions[0].handle}-${TEST_HANDLE}`,
  }), "open conversation with @test", [200, 201]);
  const conversationId = conversation.conversation?.id;
  if (!conversationId) throw new Stop("conversation create returned no conversation id");
  note("conversation", `conversation_id=${conversationId}`);
  const message = expect(await api("POST", `/api/chat/conversations/${conversationId}/messages`, {
    cookie: sessions[0].cookie,
    op: "message-01",
    json: {
      body: `[test] Mesaj simplu de verificare de la @${sessions[0].handle} către @${TEST_HANDLE}. ${PILL}`,
      client_nonce: "nexus-seed-message-01",
    },
  }), "send message to @test", [200, 201]);
  note("message", `conversation_id=${conversationId} message_id=${message.message?.id}`);

  report.summary = {
    target_user_id: target.user_id,
    accounts: sessions.map((s) => ({ handle: s.handle, user_id: s.userId, email: s.email })),
    media_posts: sessions.map((s) => ({ handle: s.handle, media: s.mediaItem?.type ?? null, post_id: s.mediaItem?.post_id ?? null })),
    comments,
    conversation_id: conversationId,
  };
}

// Offline checks of every locally-fabricated primitive, so the one-shot run against a real
// deployment cannot fail on a bug in our own code. No network calls happen here.
async function selfTestRun() {
  const checks = [];
  const ok = (name) => { checks.push(`ok   ${name}`); };

  const proof = await makeWalletProof("selftest@nexus.test", "self0test0nonce");
  if (!/^erd1[a-z0-9]{58}$/.test(proof.address)) throw new Error(`wallet address is not bech32 erd1: ${proof.address}`);
  if (!/^[a-f0-9]{128}$/.test(proof.signature)) throw new Error("signature is not 64-byte hex");
  ok(`wallet proof verifies with the server's own verifier (${proof.address.slice(0, 12)}…)`);

  const expectedMessage = `NEXUS_EMAIL_DEVICE_WALLET_V1:${createHash("sha256").update("selftest@nexus.test").digest("hex")}:self0test0nonce`;
  if (signupMessage("  SelfTest@Nexus.Test  ", "self0test0nonce") !== expectedMessage) {
    throw new Error("signup challenge string does not match the server formula");
  }
  ok("signup challenge string matches the server formula (trimmed, lower-cased email)");

  const png = makePhotoPng(720, [10, 20, 30]);
  if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error("png signature missing");
  if (png.readUInt32BE(16) !== 720 || png.readUInt32BE(20) !== 720) throw new Error("png IHDR dimensions wrong");
  const findChunk = (buffer, type) => {
    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const name = buffer.toString("ascii", offset + 4, offset + 8);
      if (name === type) return buffer.subarray(offset + 8, offset + 8 + length);
      offset += 12 + length;
    }
    throw new Error(`png chunk ${type} not found`);
  };
  const raster = inflateSync(findChunk(png, "IDAT"));
  if (raster.length !== (720 * 3 + 1) * 720) throw new Error(`png raster size wrong: ${raster.length}`);
  ok(`photo decodes: 720x720 IHDR, ${raster.length} raster bytes, ${png.length} bytes on the wire`);

  if (sessionCookieFrom(["nexus_session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax"]) !== "nexus_session=abc123") {
    throw new Error("single Set-Cookie parsing failed");
  }
  if (sessionCookieFrom(["theme=dark; Path=/", "nexus_session=def456; Path=/; HttpOnly"]) !== "nexus_session=def456") {
    throw new Error("multi Set-Cookie parsing failed");
  }
  ok("session cookie extraction (single and multiple Set-Cookie headers)");

  const plannedParts = partRequests(Buffer.alloc(5, 7), 2);
  if (plannedParts.map((p) => p.number).join(",") !== "0,1,2") {
    throw new Error(`upload part numbers are not 0-indexed: ${plannedParts.map((p) => p.number).join(",")}`);
  }
  if (plannedParts[2].bytes.length !== 1) throw new Error("the final part must carry the remainder");
  if (Buffer.concat(plannedParts.map((p) => p.bytes)).length !== 5) throw new Error("the part plan loses bytes");
  ok("upload chunk plan is 0-indexed with a short final part (the shape putResumablePart requires)");

  console.log(checks.join("\n"));
  console.log(`\nself-test passed (${checks.length} checks) — no network calls were made.`);
}

// Cheap, read-mostly preflight: proves HTTPS/trusted-proxy handling, that our Origin is the one
// the server expects, and that this deployment really runs preview sign-up — before a single one
// of the five allowed sign-ups per hour is spent. The probe email is only challenged, never created.
async function preflightRun() {
  console.log(`preflight against ${BASE}`);
  const health = await api("GET", "/health");
  console.log(`  health:      HTTP ${health.status} ${JSON.stringify(health.data)}`);
  if (health.status !== 200) throw new Stop(`health returned HTTP ${health.status}`);
  const probeEmail = `preflight-${randomBytes(3).toString("hex")}@nexus.test`;
  const init = await api("POST", "/auth/email/signup-init", { json: { email: probeEmail } });
  console.log(`  signup-init: HTTP ${init.status} ${JSON.stringify(init.data).slice(0, 220)}`);
  if (init.status === 403) {
    throw new Stop(`the deployment refused Origin ${BASE} — that is not its configured origin`);
  }
  if (init.status === 503) {
    throw new Stop("email sign-up is disabled here (503): the deployment is not in preview mode; nothing was created");
  }
  expect(init, "signup-init", [200]);
  console.log(`  ok: preview sign-up reachable and Origin accepted. No account created (${probeEmail} was only challenged).`);
}

if (selfTest) {
  await selfTestRun();
} else if (preflight) {
  try {
    await preflightRun();
  } catch (error) {
    console.error(`\nPREFLIGHT FAILED — ${error.message}`);
    process.exitCode = 1;
  }
} else {
  try {
    await main({ resume: args.includes("--resume") });
    writeOutputs(sessions, "success");
    console.log(`\nDONE — 5 accounts seeded on ${BASE}`);
  } catch (error) {
    const reason = error instanceof Stop ? `stopped: ${error.message}` : `unexpected: ${error?.message ?? error}`;
    writeOutputs(sessions, reason);
    if (error instanceof Stop) {
      console.error(`\nSTOPPED — ${error.message}`);
      console.error("Nothing else was attempted (no retries). Previously created data is left untouched.");
    } else {
      console.error("\nUNEXPECTED ERROR");
      console.error(error);
    }
    process.exitCode = 1;
  }
}



