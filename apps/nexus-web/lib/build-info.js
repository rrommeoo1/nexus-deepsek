/**
 * Which build is answering, and what it knows how to do.
 *
 * A phone cannot see a git history. On 26 October 2026 the installed app published an authored page to
 * Railway, the deployment stored the caption and the photographs, dropped `text_style`, and answered
 * `ok: true` (`JUNGLE_BOOK_PROGRESS.md` §15.3): the editor had no way to ask "is the server in front of
 * me new enough for what I am about to send?". This module is that answer, and nothing else.
 *
 * Two identities are reported, because they answer different questions:
 *
 * - `commit` is *which source* the deployment claims to be. It is taken from an explicit build
 *   identity first (`NEXUS_BUILD_COMMIT`, the Docker build arg), then from the variables Railway and
 *   most CI providers export, and only as a last resort from a local `.git` (which a container image
 *   does not have). A value that does not look like a hash is refused rather than echoed;
 * - `source_fingerprint` is *what code* is actually running: a SHA-256 over the sorted contents of
 *   `server.js` and every `lib/*.js`. It survives a squashed commit, a rebuilt image and an absent
 *   git directory, so "same tree" and "same deployment" are checkable without trusting a label.
 *
 * `capabilities` is the additive half of the contract: a name with a version, never a date and never a
 * promise. A route that is not deployed simply is not listed, so a client decides by looking rather
 * than by trying and hoping (`apps/nexus-mobile/src/lib/backendVersion.ts`). Publishing the map on an
 * unauthenticated route is deliberate — it is the information a signed-out app needs before it can
 * even sign in — and it contains no account data, no secret and no upstream URL.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The version of the whole surface, bumped only when the meaning of an existing answer changes.
 *
 * `1` is the first published contract: it names the version route, the editorial document and the post
 * gallery. Adding a capability does not bump it; changing one does.
 */
export const API_CONTRACT = 1;

/**
 * What this deployment can do, by name.
 *
 * A capability is claimed here only when the route or the field behind it exists in this tree, so the
 * list can be trusted by a client that would otherwise be guessing:
 *
 * - `post_read` — `GET /api/posts/:id` answers one post (`lib/api.js`);
 * - `post_gallery` — `POST /api/posts` accepts an ordered `media_items` gallery;
 * - `text_style` — an authored look is stored and returned (`lib/post-text-style.js`);
 * - `editorial_document` — a page's blocks (`text_style.document`) are validated, stored and returned
 *   (`lib/post-editorial-document.js`), which is what the TEXT composer needs;
 * - `post_tags` — hashtags travel as `tags`, extracted from the words of the post;
 * - `impressions` — `POST /api/social/impressions` records a reading;
 * - `profile_view_stats` — every post view carries `view_stats` (distinct human readers);
 * - `profile_order` — `POST /api/posts/order` stores the owner's order of their own grid, and every
 *   post view carries the `grid_position` that order is written in (`lib/repo.js`);
 * - `profile_order_reposts` — that same order also accepts a repost tile (`{ share_id }`), written to
 *   `post_shares.grid_position`, so originals and reposts interleave in one arrangement without ever
 *   touching the original author's post. A client that does not see this name keeps arranging posts
 *   only, which is exactly what the older server accepts.
 */
export const BACKEND_CAPABILITIES = Object.freeze({
  post_read: 1,
  post_gallery: 1,
  text_style: 1,
  editorial_document: 1,
  post_tags: 1,
  impressions: 1,
  profile_view_stats: 1,
  profile_order: 1,
  profile_order_reposts: 1,
});

/** `apps/nexus-web` — `lib/build-info.js` sits one level below the server it describes. */
const WEB_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The files whose contents *are* the build. `server.js` boots, `lib/` is the whole server. */
const FINGERPRINT_FILES = ["server.js"];
const FINGERPRINT_DIRECTORIES = ["lib"];

/** A commit is a hash and nothing else; anything else an environment may hold is not an identity. */
const COMMIT = /^[0-9a-f]{7,64}$/i;

/**
 * The variables an operator, Railway or a CI runner may set, in the order that says what the build
 * *is* before what the platform guesses. An explicit value always wins over a derived one.
 */
const IDENTITY_VARIABLES = Object.freeze([
  "NEXUS_BUILD_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "GIT_COMMIT",
  "COMMIT_SHA",
  "SOURCE_VERSION",
]);

function cleanCommit(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return COMMIT.test(text) ? text.toLowerCase() : "";
}

function cleanTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const moment = new Date(text);
  return Number.isNaN(moment.getTime()) ? null : moment.toISOString();
}

/**
 * The git directory of a checkout, or `null` when there is none (a container image, a tarball, a
 * `git worktree` whose `.git` is a file pointing elsewhere).
 */
function gitDirectory(rootDir) {
  const path = join(rootDir, ".git");
  try {
    const marker = readFileSync(path, "utf8");
    const match = marker.match(/^gitdir:\s*(.+)$/m);
    return match ? resolve(rootDir, match[1].trim()) : null;
  } catch {
    return existsSync(join(path, "HEAD")) ? path : null;
  }
}

/**
 * The git directory that contains `rootDir`, or `null` when the tree is not inside a checkout.
 *
 * The walk goes up a few parents because this is a monorepo: `.git` sits at the repository root, three
 * levels above `lib/`, and `apps/nexus-web/.git` does not exist. A container image has neither, which is
 * exactly why the fingerprint below exists.
 */
const GIT_ANCESTORS = 3;

function ancestorGitDirectory(rootDir) {
  let directory = resolve(rootDir);
  for (let depth = 0; depth <= GIT_ANCESTORS; depth += 1) {
    const found = gitDirectory(directory);
    if (found) return found;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
  return null;
}

/** The commit a local checkout is on, read without a git binary and without running anything. */
function gitHeadCommit(rootDir) {
  const directory = ancestorGitDirectory(rootDir);
  if (!directory) return "";
  try {
    const head = readFileSync(join(directory, "HEAD"), "utf8").trim();
    if (COMMIT.test(head)) return head.toLowerCase();
    const reference = head.match(/^ref:\s*(\S+)$/)?.[1];
    if (!reference) return "";
    const loose = join(directory, ...reference.split("/"));
    if (existsSync(loose)) return cleanCommit(readFileSync(loose, "utf8"));
    // A fresh clone keeps its branches packed; the ref is still an answer.
    const packed = readFileSync(join(directory, "packed-refs"), "utf8");
    const line = packed.split("\n").find((entry) => entry.trim().endsWith(` ${reference}`));
    return line ? cleanCommit(line.trim().split(/\s+/)[0]) : "";
  } catch {
    return "";
  }
}

/**
 * The build identity of this tree. Every field may be `null`: a deployment that does not know its own
 * commit is a deployment, not an error, and the fingerprint still identifies it.
 */
export function readBuildIdentity({ env = process.env, rootDir = WEB_ROOT } = {}) {
  const declared = IDENTITY_VARIABLES
    .map((name) => ({ name, commit: cleanCommit(env[name]) }))
    .find((entry) => entry.commit);
  const local = declared ?? (() => {
    const commit = gitHeadCommit(rootDir);
    return commit ? { name: "git-head", commit } : null;
  })();
  return {
    commit: local?.commit ?? null,
    commit_short: local ? local.commit.slice(0, 7) : null,
    commit_source: local?.name ?? "unavailable",
    built_at: cleanTime(env.NEXUS_BUILD_TIME) ?? cleanTime(env.RAILWAY_DEPLOYMENT_CREATED_AT),
  };
}

/**
 * A digest of the server source, so a deployment can be compared to a tree byte for byte even when no
 * commit is known. `rootDir` is a parameter because a test writes its own two files and expects the
 * digest to follow them; the running server always uses its own directory.
 */
export function sourceFingerprint({ rootDir = WEB_ROOT } = {}) {
  const names = [...FINGERPRINT_FILES];
  for (const directory of FINGERPRINT_DIRECTORIES) {
    let entries = [];
    try {
      entries = readdirSync(join(rootDir, directory), { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".js")) names.push(`${directory}/${entry.name}`);
    }
  }
  names.sort();
  const digest = createHash("sha256");
  for (const name of names) {
    digest.update(`${name}\n`);
    try {
      digest.update(readFileSync(join(rootDir, name)));
    } catch {
      digest.update("\u0000missing");
    }
  }
  return digest.digest("hex");
}

let cachedFingerprint = "";

/** The fingerprint of this deployment, computed once: those files cannot change under a live process. */
export function deploymentFingerprint() {
  if (!cachedFingerprint) cachedFingerprint = sourceFingerprint();
  return cachedFingerprint;
}

/**
 * What `GET /api/version` answers. Public by design: it names the build, never an account. It is also
 * deliberately free of any database read, so an app can ask which server it is talking to even while
 * the volume is being restored.
 */
export function versionView(env = process.env) {
  return {
    ok: true,
    service: "nexus-web",
    api_contract: API_CONTRACT,
    ...readBuildIdentity({ env }),
    source_fingerprint: deploymentFingerprint(),
    capabilities: { ...BACKEND_CAPABILITIES },
    runtime: `node ${process.version}`,
  };
}
