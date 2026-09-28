import { openDb } from "./db.js";
import { createHash, randomBytes } from "node:crypto";
import { sha256Hex } from "./security.js";
import { inspectStoredMedia, purgeStoredMedia } from "./media.js";
import { assessSocialContent, MODERATION_POLICY_VERSION, publicAssessment, REPORT_CATEGORIES } from "./moderation.js";
import { creatorStudioHash, normalizeCreatorAudio, normalizeCreatorStudio } from "./creator-studio.js";
import { evaluatePrivacy } from "./privacy-matrix.js";

export const PERSONAS = ["social", "work", "dating", "travel", "market"];
export const SOCIAL_REACTIONS = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY", "FAKE_OPINION", "DISLIKE"];
export const NOTIFICATION_TYPES = ["reaction", "comment", "follow", "mention", "story", "message", "call", "live", "moderation", "security", "payment", "system"];
export const E2EE_ORPHAN_RETENTION_SECONDS = 24 * 60 * 60;
export const RECOVERY_DEVICE_PENDING_TTL_SECONDS = 10 * 60;
export const MAX_RECOVERY_DEVICES_PER_USER = 3;
export const MAX_ACTIVE_CHAT_DEVICES_PER_USER = 10;
export const MAX_GROUP_CONVERSATION_MEMBERS = 50;
export const MAX_E2EE_DEVICE_ENVELOPES = MAX_GROUP_CONVERSATION_MEMBERS * MAX_ACTIVE_CHAT_DEVICES_PER_USER;
export const SIGIL_TIERS = Object.freeze([
  { level: 1, threshold: 1_000, name: "Creator" },
  { level: 2, threshold: 10_000, name: "Rising" },
  { level: 3, threshold: 100_000, name: "Pro" },
  { level: 4, threshold: 1_000_000, name: "Icon" },
  { level: 5, threshold: 10_000_000, name: "Global" },
]);
const SOCIAL_REACTION_SET = new Set(SOCIAL_REACTIONS);
const PROFILE_VISIBILITY = new Set(["public", "followers", "friends", "private"]);
// The hero band shows a cover photo or the shelf of saved stories, and nothing else: a value the
// interface could never produce is not written over the one the owner chose.
const PROFILE_COVER_MODES = new Set(["cover", "stories"]);
// The five content tabs of a profile, in the order the product reads them when the owner never arranged
// them. The order is the owner's to change, so it is stored per profile - but the list of tabs is not: an
// id this product never drew is dropped, and a tab that is missing from a stored order is put back, so no
// arrangement can ever hide a surface or invent one.
export const PROFILE_TABS = Object.freeze(["flow", "reels", "shots", "whispers", "moments"]);

// A stored order is a comma-separated list. Reading it is forgiving on purpose: unknown ids are dropped,
// repeats collapse, and everything the list forgot is appended in the product's own order. The result is
// always the whole set, in the owner's order.
export function normaliseTabsOrder(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  const wanted = [];
  for (const entry of list) {
    const id = String(entry ?? "").trim().toLowerCase();
    if (PROFILE_TABS.includes(id) && !wanted.includes(id)) wanted.push(id);
  }
  for (const id of PROFILE_TABS) if (!wanted.includes(id)) wanted.push(id);
  return wanted;
}
// An age that stays true is a date of birth: the owner picks the day once from a calendar and the age is
// derived from it every time the profile is read. Nothing here guesses a day, and nothing stores an age.
const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normaliseBirthDate(value) {
  const match = BIRTH_DATE_PATTERN.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200) return null;
  // A date the calendar does not have (a 31st of a 30-day month, a 29th of February in a common year) is
  // not a day anybody was born on, and is refused rather than rounded into one.
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  return match[0];
}

// The age today: the birthday has to have happened this year for the year to count. It is a whole number
// of years, never an estimate, and a date in the future is not an age.
export function deriveAge(birthDate, now = Date.now()) {
  const normalised = normaliseBirthDate(birthDate);
  if (!normalised) return null;
  const [year, month, day] = normalised.split("-").map(Number);
  const today = new Date(now);
  let age = today.getUTCFullYear() - year;
  const monthDelta = today.getUTCMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}
const MESSAGE_POLICIES = new Set(["everyone", "requests", "followers", "nobody"]);
// How many posts a profile may keep at the top of its own archive. Three is a statement; ten is a feed.
const PINNED_POST_LIMIT = 3;
// SEEDED_CATALOG marks locally ingested catalog accounts: real rows, never organic.
const TRAFFIC_CLASSES = new Set(["HUMAN_ORGANIC", "PAID", "AGENT", "SYSTEM_TEST", "INCENTIVIZED", "SEEDED_CATALOG"]);
const NOTIFICATION_TYPE_SET = new Set(NOTIFICATION_TYPES);
const NOTIFICATION_MANDATORY = new Set(["security", "system"]);
const NOTIFICATION_PREVIEWS = new Set(["generic", "sender", "content"]);

function parseStringArrayJson(raw) {
  try {
    const value = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch { return []; }
}

function hydrateDatingProfile(row) {
  if (!row) return null;
  return { ...row, seeking: parseStringArrayJson(row.seeking_json), interests: parseStringArrayJson(row.interests_json) };
}

function canonicalChatPublicJwk(publicJwk) {
  if (!publicJwk || "d" in publicJwk || publicJwk.kty !== "EC" || publicJwk.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(publicJwk.x)) || !/^[A-Za-z0-9_-]{40,50}$/.test(String(publicJwk.y))) return null;
  return JSON.stringify({ kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y });
}

export function normalizePersona(value) {
  return typeof value === "string" && PERSONAS.includes(value) ? value : "social";
}

function canonicalPostCommitment(row) {
  return sha256Hex(JSON.stringify({
    userId: row.user_id, persona: row.persona, kind: row.kind, caption: row.caption,
    mediaId: row.media_id, visibility: row.visibility, language: row.language,
    regionCode: row.region_code, provenance: row.provenance,
    mediaEditHash: row.media_edit_hash, audioMediaId: row.audio_media_id,
    audioRights: row.audio_rights, audioAttribution: row.audio_attribution || "",
  }));
}

function canonicalCommentCommitment(row) {
  return sha256Hex(JSON.stringify({
    userId: row.user_id, actorPersona: row.actor_persona, postId: row.post_id,
    parentId: row.parent_id, body: row.body,
  }));
}

function redactExpiredChatMessage(message, now = Math.floor(Date.now() / 1000)) {
  if (!message || (message.status !== 'expired' && (message.expires_at == null || message.expires_at > now))) return message;
  return { ...message, status: 'expired', body: '', attachment_url: null, attachment_media_id: null,
    media_hash: null, media_ext: null, media_mime: null, media_kind: null };
}

// Tags are read from the caption once, at write time. Honest rules: a hashtag is #word (letters,
// digits, underscore, 2-50 characters), a cashtag is $ticker (2-10 letters), a post carries at most
// 20 of them, a tag is stored lowercased and the first spelling is kept for display.
export function extractPostTags(caption) {
  const text = String(caption ?? "");
  const found = [];
  const seen = new Set();
  const pattern = /(^|[^\p{L}\p{N}_#$/])([#$])([\p{L}\p{N}_]{2,50})/gu;
  for (const match of text.matchAll(pattern)) {
    const marker = match[2];
    const rawTag = match[3];
    const kind = marker === "#" ? "hashtag" : "cashtag";
    if (kind === "cashtag" && !/^[A-Za-z]{2,10}$/.test(rawTag)) continue;
    const tag = rawTag.toLowerCase();
    const key = kind + ":" + tag;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind, tag, display: rawTag });
    if (found.length >= 20) break;
  }
  return found;
}

// ---- community notes ----
// A note explains a post; it never hides it. The rules are declared once, exported, and tested
// on their own, so nobody has to guess why a note is public.
export const COMMUNITY_NOTE_RULES = Object.freeze({
  minRatings: 3,
  minPerspectives: 2,
  helpfulRatio: 2 / 3,
  hideRatio: 1 / 3,
  dailyNotes: 5,
  dailyRatings: 30,
  maxSources: 3,
});

// Our local stand-in for "different viewpoints": how the rater stands to the post's author.
// It is honest about what it measures and it is the thing that makes bridging possible at all.
export function communityNotePerspective({ isAuthor = false, followsAuthor = false, mutedAuthor = false } = {}) {
  if (isAuthor) return "AUTHOR";
  if (mutedAuthor) return "MUTED_AUTHOR";
  return followsAuthor ? "FOLLOWS_AUTHOR" : "NOT_FOLLOWS_AUTHOR";
}

// The decision rule, pure: enough ratings, from enough perspectives, helpful in every perspective
// that has more than one rating, an overall majority of readers finding it helpful, and at least
// one source. A note that is clearly rejected stops being counted as pending, but it is never
// silently deleted.
export function decideCommunityNoteStatus(ratings = [], { sources = 0 } = {}) {
  const list = (Array.isArray(ratings) ? ratings : []).map((entry) => ({ perspective: String(entry?.perspective || "UNKNOWN"), helpful: entry?.helpful === true }));
  const total = list.length;
  const helpful = list.filter((entry) => entry.helpful).length;
  const byPerspective = new Map();
  for (const entry of list) {
    const bucket = byPerspective.get(entry.perspective) ?? { total: 0, helpful: 0 };
    bucket.total += 1;
    if (entry.helpful) bucket.helpful += 1;
    byPerspective.set(entry.perspective, bucket);
  }
  // Bridging is per perspective, so a single perspective cannot carry a note: where a perspective
  // rated twice, it must agree with itself. The overall ratio is checked as well, because three
  // lonely rejections are still a rejection.
  const bridging = [...byPerspective.values()].every((bucket) => bucket.total < 2 || bucket.helpful / bucket.total >= COMMUNITY_NOTE_RULES.helpfulRatio);
  const majority = total > 0 && helpful / total >= COMMUNITY_NOTE_RULES.helpfulRatio;
  if (total >= COMMUNITY_NOTE_RULES.minRatings && byPerspective.size >= COMMUNITY_NOTE_RULES.minPerspectives && bridging && majority && Number(sources) > 0) return "HELPFUL";
  if (total >= COMMUNITY_NOTE_RULES.minRatings && helpful / total <= COMMUNITY_NOTE_RULES.hideRatio) return "NOT_HELPFUL";
  return "NEEDS_MORE_RATINGS";
}

// ---- identity onboarding ----
// A handle is the one thing another person uses to find you, so it is validated in one place and the
// rule is exported: lowercase letters, digits and underscore, 2 to 30 characters.
export const NEXUS_HANDLE_PATTERN = /^[a-z0-9_]{2,30}$/;

// Wave 6h (P10): the reasons a post is in front of a viewer are machine keys, not prose. The interface
// exists in four languages and the ranking is computed once per request, so a Romanian sentence built
// here would be shown verbatim to an English, Polish or Arabic reader. The client translates; the server
// states.
//
// Negative reasons are part of the vocabulary on purpose: a reader who asks "why am I seeing this" is
// entitled to the sentence that held a post back (already seen, disliked by the community, marked as an
// opinion, you asked for less from this author), not only to the sentence that pushed it up.
export const SOCIAL_RANKING_REASON_KEYS = Object.freeze([
  "exploration_new",
  "following_author",
  "similar_liked",
  "language_preference",
  "region_preference",
  "organic_conversation",
  "seen_before",
  "author_less",
  "community_dislike",
  "marked_opinion",
  "older_post",
  "fresh_eligible",
  "repost_shared",
]);
export const SOCIAL_RANKING_REASON_LIMIT = 4;

// The order is the order of consequence: what put the post here, then what held it back, then the
// baseline everyone shares. A signal that is absent is never mentioned.
export function socialRankingReasonKeys(signals = {}) {
  const keys = [];
  if (signals.exploration) keys.push("exploration_new");
  if (signals.following) keys.push("following_author");
  if (signals.affinity) keys.push("similar_liked");
  if (signals.language) keys.push("language_preference");
  if (signals.region) keys.push("region_preference");
  if (signals.conversation) keys.push("organic_conversation");
  if (signals.seen) keys.push("seen_before");
  if (signals.authorLess) keys.push("author_less");
  if (signals.disliked) keys.push("community_dislike");
  if (signals.opinion) keys.push("marked_opinion");
  if (signals.older) keys.push("older_post");
  if (signals.fresh) keys.push("fresh_eligible");
  if (signals.repost) keys.push("repost_shared");
  return keys.slice(0, SOCIAL_RANKING_REASON_LIMIT);
}

// Sign-up generates a handle when the person gives none (an email prefix plus random hex, or a wallet
// stub). Those are exactly the accounts the first-run flow exists for; a handle somebody chose
// themselves is never treated as provisional.
export function generatedHandle(handle) {
  const value = String(handle ?? "").toLowerCase();
  return /^u[a-z0-9_]{0,20}[0-9a-f]{4}$/.test(value) || /^wallet[0-9a-f]{4,}$/.test(value);
}

// The day a record may hold: a real calendar day that stands for an age between 13 and 120 today. It is the
// same rule the route enforces, so a write that reaches the record without passing the route cannot put a day
// in it that the interface could never have produced - a day that has not happened yet included.
export function writableBirthDate(value, now = Date.now()) {
  const normalised = normaliseBirthDate(value);
  if (!normalised) return null;
  const age = deriveAge(normalised, now);
  return Number.isInteger(age) && age >= 13 && age <= 120 ? normalised : null;
}

export function createRepo(db) {
  db.function('nexus_chat_fold', { deterministic: true }, (value) => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('ro'));
  return {
    db,

    // ---- users ----
    createUser({ handle, displayName, bio = "", passwordHash = null, avatar = null, mvxAddress = null, mvxAlias = null, trafficClass = "HUMAN_ORGANIC" }) {
      if (mvxAddress) {
        const existing = this.resolveUserByWalletAddress(mvxAddress);
        if (existing.conflict || existing.user) {
          const error = new Error("wallet identity already belongs to a Nexus account");
          error.code = "NEXUS_WALLET_IDENTITY_CONFLICT";
          throw error;
        }
      }
      if (!TRAFFIC_CLASSES.has(trafficClass)) throw new Error("USER_TRAFFIC_CLASS_INVALID");
      const info = this.db.prepare(
        `INSERT INTO users (handle, display_name, bio, password_hash, avatar, mvx_address, mvx_alias, traffic_class)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(handle, displayName, bio, passwordHash, avatar, mvxAddress, mvxAlias, trafficClass);
      return this.getUserById(Number(info.lastInsertRowid));
    },
    getUserById(id) {
      return this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) ?? null;
    },
    getUserByHandle(handle) {
      const clean = String(handle).replace(/^@/, "").toLowerCase();
      return this.db.prepare(`SELECT * FROM users WHERE handle = ?`).get(clean) ?? null;
    },
    getUserByMvxAddress(address) {
      return this.db.prepare(`SELECT * FROM users WHERE mvx_address = ?`).get(address) ?? null;
    },
    getUserByLinkedWallet(address) {
      return this.db.prepare(`SELECT * FROM users WHERE linked_wallet = ?`).get(address) ?? null;
    },
    resolveUserByWalletAddress(address) {
      const embedded = this.getUserByMvxAddress(address);
      const linked = this.getUserByLinkedWallet(address);
      if (embedded && linked && embedded.id !== linked.id) {
        return { user: null, conflict: true };
      }
      return { user: linked ?? embedded ?? null, conflict: false };
    },
    getXPortalLoginAddress(userOrId) {
      const userId = typeof userOrId === "object" && userOrId ? userOrId.id : userOrId;
      const user = this.getUserById(userId);
      if (!user) return null;
      if (user.linked_wallet) return user.linked_wallet;
      // A wallet-native account has no password and was created from a valid
      // NativeAuth proof, so its primary address is also its xPortal factor.
      if (!user.password_hash && user.mvx_address) return user.mvx_address;
      return null;
    },
    setLinkedWallet(userId, address) {
      const existing = this.resolveUserByWalletAddress(address);
      if (existing.conflict || (existing.user && existing.user.id !== userId)) {
        return { ok: false, error: "wallet already belongs to another Nexus account", user: null };
      }
      const current = this.getUserById(userId);
      const changedAt = Number(current?.linked_wallet_changed_at ?? 0);
      if (current?.linked_wallet && current.linked_wallet !== address && changedAt && Date.now() - changedAt < 15 * 60 * 1000) {
        return { ok: false, error: "wallet replacement cooldown", user: null };
      }
      this.db.prepare(`UPDATE users SET linked_wallet = ?, linked_wallet_changed_at = ? WHERE id = ?`).run(address, Date.now(), userId);
      return { ok: true, user: this.getUserById(userId) };
    },
    claimUsername(userId, username) {
      const clean = String(username).replace(/^@/, "").toLowerCase();
      if (!/^[a-z0-9_]{2,30}$/.test(clean)) return { ok: false, error: "invalid username" };
      const existing = this.getUserByHandle(clean);
      if (existing && existing.id !== userId) return { ok: false, error: "username deja folosit" };
      this.db.prepare(`UPDATE users SET handle = ? WHERE id = ?`).run(clean, userId);
      return { ok: true, user: this.getUserById(userId) };
    },
    getUserByEmail(email) {
      const clean = String(email).trim().toLowerCase();
      return this.db.prepare(`SELECT * FROM users WHERE email = ?`).get(clean) ?? null;
    },
    getUserByGoogleSub(sub) {
      return this.db.prepare(`SELECT * FROM users WHERE google_sub = ?`).get(sub) ?? null;
    },
    getUserByFacebookSub(sub) {
      return this.db.prepare(`SELECT * FROM users WHERE facebook_sub = ?`).get(sub) ?? null;
    },
    setUserEmailVerification(userId, token, expiresAt) {
      this.db.prepare(`UPDATE users SET email_verification_token = ?, email_verification_expires_at = ? WHERE id = ?`).run(sha256Hex(token), expiresAt, userId);
      return this.getUserById(userId);
    },
    verifyUserEmail(userId) {
      this.db.prepare(`UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = ?`).run(userId);
      return this.getUserById(userId);
    },
    setPasswordReset(userId, token, expiresAt) {
      this.db.prepare(`UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?`).run(sha256Hex(token), expiresAt, userId);
      return this.getUserById(userId);
    },
    updatePassword(userId, passwordHash) {
      this.db.prepare(`UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?`).run(passwordHash, userId);
      return this.getUserById(userId);
    },
    linkProvider(userId, { email, googleSub, facebookSub, mvxAddress, mvxAlias }) {
      const set = [];
      const params = [];
      if (email !== undefined) { set.push(`email = ?`); params.push(email); }
      if (googleSub !== undefined) { set.push(`google_sub = ?`); params.push(googleSub); }
      if (facebookSub !== undefined) { set.push(`facebook_sub = ?`); params.push(facebookSub); }
      if (mvxAddress !== undefined) {
        const existing = this.resolveUserByWalletAddress(mvxAddress);
        if (existing.conflict || (existing.user && existing.user.id !== userId)) {
          const error = new Error("wallet identity already belongs to another Nexus account");
          error.code = "NEXUS_WALLET_IDENTITY_CONFLICT";
          throw error;
        }
        set.push(`mvx_address = ?`); params.push(mvxAddress);
      }
      if (mvxAlias !== undefined) { set.push(`mvx_alias = ?`); params.push(mvxAlias); }
      if (set.length) {
        params.push(userId);
        this.db.prepare(`UPDATE users SET ${set.join(", ")} WHERE id = ?`).run(...params);
      }
      return this.getUserById(userId);
    },

    // ---- wallets (encrypted keystore) ----
    insertWallet({ userId, address, kind = "mnemonic", keystore, addressIndex = 0 }) {
      this.db.prepare(`INSERT INTO wallets (user_id, address, kind, keystore, address_index) VALUES (?, ?, ?, ?, ?)`)
        .run(userId, address, kind, JSON.stringify(keystore ?? {}), addressIndex);
    },
    getWallet(userId, address) {
      const row = this.db.prepare(`SELECT * FROM wallets WHERE user_id = ? AND address = ?`).get(userId, address);
      if (!row) return null;
      return { ...row, keystore: row.keystore ? JSON.parse(row.keystore) : null, address_index: row.address_index };
    },
    listWallets(userId) {
      return this.db.prepare(`SELECT id, address, kind, address_index, created_at FROM wallets WHERE user_id = ? ORDER BY id ASC`).all(userId);
    },
    updateUserProfile(id, { displayName, bio, mvxAddress, mvxAlias }) {
      const existing = this.getUserById(id);
      if (mvxAddress !== undefined && mvxAddress !== existing?.mvx_address) {
        const resolution = this.resolveUserByWalletAddress(mvxAddress);
        if (resolution.conflict || (resolution.user && resolution.user.id !== id)) {
          const error = new Error("wallet identity already belongs to another Nexus account");
          error.code = "NEXUS_WALLET_IDENTITY_CONFLICT";
          throw error;
        }
      }
      this.db.prepare(`UPDATE users SET display_name = ?, bio = ?, mvx_address = ?, mvx_alias = ? WHERE id = ?`)
        .run(displayName ?? existing.display_name, bio ?? existing.bio, mvxAddress ?? existing.mvx_address, mvxAlias ?? existing.mvx_alias, id);
      return this.getUserById(id);
    },

    // ---- personas ----
    ensurePersona(userId, persona, { name, bio = "", avatar = null, cover = null, visibility = "friends" } = {}) {
      persona = normalizePersona(persona);
      const existing = this.db.prepare(`SELECT * FROM personas WHERE user_id = ? AND persona = ?`).get(userId, persona);
      if (existing) return existing;
      const user = this.getUserById(userId);
      const finalName = name ?? `${user.display_name} (${persona})`;
      this.db.prepare(`INSERT INTO personas (user_id, persona, name, bio, avatar, cover, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, persona, finalName, bio, avatar, cover, PROFILE_VISIBILITY.has(visibility) ? visibility : "friends");
      return this.db.prepare(`SELECT * FROM personas WHERE user_id = ? AND persona = ?`).get(userId, persona);
    },
    getPersona(userId, persona) {
      return this.db.prepare(`SELECT * FROM personas WHERE user_id = ? AND persona = ?`).get(userId, normalizePersona(persona)) ?? null;
    },
    updatePersona(userId, persona, { name, bio, location, age, birthDate, avatar, cover, coverFocus, coverMode, tabsOrder, orbitStatus, profileKind, visibility, discoverability, messagePolicy, interfaceLocale, contentLanguages, regionCode, nearEnabled, privateAccess }) {
      persona = normalizePersona(persona);
      const cur = this.getPersona(userId, persona) ?? this.ensurePersona(userId, persona, {});
      const nextVisibility = visibility === undefined ? cur.visibility : (PROFILE_VISIBILITY.has(visibility) ? visibility : cur.visibility);
      // A crop is a whole percentage and nothing else: a value the interface could never produce is not
      // written over the one the owner chose.
      const nextCoverFocus = Number.isInteger(coverFocus) ? Math.min(100, Math.max(0, coverFocus)) : cur.cover_focus;
      // What the hero shows above the identity: the cover photo or the shelf of saved stories. A profile
      // that never chose one keeps the cover, which is what the record already says.
      const nextCoverMode = coverMode === undefined ? cur.cover_mode : (PROFILE_COVER_MODES.has(coverMode) ? coverMode : cur.cover_mode);
      // An age is a number the owner stated about themselves and nothing else: one whole year between 13
      // and 120, absent when the profile does not carry one, and clearing it is a choice like writing it.
      const nextAge = age === undefined ? cur.age : (age === null ? null : (Number.isInteger(age) ? Math.min(120, Math.max(13, age)) : cur.age));
      const nextMessagePolicy = messagePolicy === undefined ? cur.message_policy : (MESSAGE_POLICIES.has(messagePolicy) ? messagePolicy : cur.message_policy);
      // The date of birth, not an age: one calendar day the owner chose, cleared by an empty value, and a
      // value that is not a day somebody could have been born on is not written over the one that is there.
      const nextBirthDate = birthDate === undefined
        ? cur.birth_date
        : (birthDate === null || birthDate === "" ? null : (writableBirthDate(birthDate) ?? cur.birth_date));
      const languages = contentLanguages === undefined
        ? cur.content_languages
        : JSON.stringify([...new Set(contentLanguages)].slice(0, 10));
      // The tab order is one list of five ids, and it is stored the way it will be read back: unknown ids
      // dropped, the ones the list forgot appended. A profile that never arranged its tabs keeps the empty
      // value it has, and the empty value is read as the product's own order.
      const nextTabsOrder = tabsOrder === undefined
        ? cur.tabs_order
        : (Array.isArray(tabsOrder) && tabsOrder.length === 0 ? "" : normaliseTabsOrder(tabsOrder).join(","));
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`
          UPDATE personas SET name = ?, bio = ?, location = ?, age = ?, birth_date = ?, avatar = ?, cover = ?,
            cover_focus = ?, cover_mode = ?, tabs_order = ?,
            orbit_mood = ?, orbit_place = ?, orbit_now = ?, orbit_fandom = ?, orbit_quote = ?, orbit_expires_at = ?, profile_kind = ?, visibility = ?, discoverability = ?,
            message_policy = ?, interface_locale = ?, content_languages = ?, region_code = ?,
            near_enabled = ?, private_access_enabled = ?, private_access_price_cents = ?, private_access_month_price_cents = ?, private_access_forever_price_cents = ?, private_access_currency = ?, private_access_duration_days = ?, updated_at = unixepoch()
          WHERE user_id = ? AND persona = ?
        `).run(
        name ?? cur.name,
        bio ?? cur.bio,
        location ?? cur.location,
        nextAge,
        nextBirthDate,
        avatar ?? cur.avatar,
        cover ?? cur.cover,
        nextCoverFocus,
        nextCoverMode,
        nextTabsOrder,
        orbitStatus === undefined ? cur.orbit_mood : orbitStatus.mood,
        orbitStatus === undefined ? cur.orbit_place : orbitStatus.place,
        orbitStatus === undefined ? cur.orbit_now : orbitStatus.now,
        orbitStatus === undefined ? cur.orbit_fandom : orbitStatus.fandom,
        orbitStatus === undefined ? cur.orbit_quote : orbitStatus.quote,
        orbitStatus === undefined ? cur.orbit_expires_at : orbitStatus.expiresAt,
        profileKind ?? cur.profile_kind,
        nextVisibility,
        discoverability === undefined ? cur.discoverability : (new Set(["public", "hidden"]).has(discoverability) ? discoverability : cur.discoverability),
        nextMessagePolicy,
        interfaceLocale ?? cur.interface_locale,
        languages,
        regionCode === undefined ? cur.region_code : regionCode,
        nearEnabled === undefined ? cur.near_enabled : (nearEnabled ? 1 : 0),
        privateAccess === undefined ? cur.private_access_enabled : (privateAccess.enabled ? 1 : 0),
        privateAccess === undefined ? cur.private_access_price_cents : privateAccess.priceCents,
        privateAccess === undefined ? cur.private_access_month_price_cents : (privateAccess.monthPriceCents ?? Math.min(100000000, privateAccess.priceCents * 30)),
        privateAccess === undefined ? cur.private_access_forever_price_cents : (privateAccess.foreverPriceCents ?? Math.min(1000000000, privateAccess.priceCents * 365)),
        privateAccess === undefined ? cur.private_access_currency : privateAccess.currency,
        privateAccess === undefined ? cur.private_access_duration_days : privateAccess.durationDays,
        userId,
          persona,
        );
        // The Social persona is the account's public identity. Keep the account fallback in sync so a
        // fresh session, an account-only surface or an older post can never resurrect the signup name
        // after the owner has changed it on the profile. Other personas remain intentionally independent.
        if (persona === "social" && name !== undefined) {
          this.db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).run(name, userId);
        }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      return this.getPersona(userId, persona);
    },

    // ---- sessions ----
    insertSession({ tokenHash, userId, persona, expiresAt, deviceId = "unknown", deviceLabel = "Unknown device", deviceFingerprint = null }) {
      this.db.prepare(`INSERT INTO sessions (token_hash, user_id, persona, expires_at, device_id, device_label, device_fingerprint, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`)
        .run(tokenHash, userId, normalizePersona(persona), expiresAt, deviceId, deviceLabel, deviceFingerprint);
    },
    getSession(tokenHash) {
      return this.db.prepare(`SELECT * FROM sessions WHERE token_hash = ?`).get(tokenHash) ?? null;
    },
    updateSessionPersona(tokenHash, persona) {
      const normalized = normalizePersona(persona);
      this.db.prepare(`UPDATE sessions SET persona = ? WHERE token_hash = ?`).run(normalized, tokenHash);
      return normalized;
    },
    bindSessionDevice(tokenHash, { deviceId, deviceLabel, deviceFingerprint }) {
      this.db.prepare(`UPDATE sessions SET device_id = ?, device_label = ?, device_fingerprint = ?, last_seen_at = unixepoch() WHERE token_hash = ?`)
        .run(deviceId, deviceLabel, deviceFingerprint, tokenHash);
      return this.getSession(tokenHash);
    },
    touchSession(tokenHash, at = Math.floor(Date.now() / 1000)) {
      this.db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND last_seen_at < ?`).run(at, tokenHash, at - 300);
    },
    listUserSessions(userId, currentTokenHash = null) {
      const now = Date.now();
      return this.db.prepare(`SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC, created_at DESC`).all(userId, now).map((row) => ({
        id: sha256Hex(`nexus-session-public-v1:${row.token_hash}`).slice(0, 24),
        persona: row.persona,
        device_id: row.device_id,
        device_label: row.device_label,
        current: row.token_hash === currentTokenHash,
        created_at: row.created_at,
        last_seen_at: row.last_seen_at,
        expires_at: row.expires_at,
      }));
    },
    deleteUserSessionByPublicId(userId, publicId, currentTokenHash = null) {
      const sessions = this.db.prepare(`SELECT token_hash FROM sessions WHERE user_id = ?`).all(userId);
      const target = sessions.find((row) => sha256Hex(`nexus-session-public-v1:${row.token_hash}`).slice(0, 24) === publicId);
      if (!target) return { found: false, current: false, deleted: false };
      if (target.token_hash === currentTokenHash) return { found: true, current: true, deleted: false };
      const result = this.db.prepare(`DELETE FROM sessions WHERE token_hash = ? AND user_id = ?`).run(target.token_hash, userId);
      return { found: true, current: false, deleted: Number(result.changes) === 1 };
    },
    deleteSession(tokenHash) {
      this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    },
    deleteSessionsForUser(userId) {
      this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    },
    purgeExpiredSessions() {
      this.db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now());
    },

    // ---- posts ----
    createPost({ userId, persona, kind = "text", caption = "", mediaId = null, visibility = "public", language = null, regionCode = null, provenance = "user", mediaEdit = null, audioMediaId = null, audioRights = null, audioAttribution = "" }) {
      persona = normalizePersona(persona);
      const safeVisibility = PROFILE_VISIBILITY.has(visibility) ? visibility : "public";
      // A media-less video placeholder is valid feed state, but it must not
      // fabricate a Creator Studio manifest. A real edit still requires an
      // owned, validated source upload below.
      const normalizedStudio = mediaEdit == null && !mediaId
        ? null
        : normalizeCreatorStudio(mediaEdit, { mediaKind: kind });
      const normalizedAudio = normalizeCreatorAudio({ audioMediaId, rights: audioRights, attribution: audioAttribution });
      const sourceMedia = mediaId ? this.getMediaById(mediaId) : null;
      if (normalizedStudio && (!sourceMedia || sourceMedia.kind !== kind || !this.hasMediaUploadGrant(mediaId, userId, "social_post", persona))) {
        throw new Error("CREATOR_STUDIO_SOURCE_MEDIA_INVALID");
      }
      if (normalizedAudio.audioMediaId) {
        if (!normalizedStudio || kind === "text") throw new Error("CREATOR_AUDIO_SOURCE_MEDIA_REQUIRED");
        const audio = this.getMediaById(normalizedAudio.audioMediaId);
        if (!audio || audio.kind !== "audio" || audio.scan_status !== "ready_local_validation" || !this.hasMediaUploadGrant(audio.id, userId, "social_audio", persona)) {
          throw new Error("CREATOR_AUDIO_MEDIA_INVALID");
        }
      }
      const mediaEditHash = creatorStudioHash(normalizedStudio);
      const commitment = sha256Hex(JSON.stringify({
        userId, persona, kind, caption, mediaId, visibility: safeVisibility, language, regionCode, provenance,
        mediaEditHash, audioMediaId: normalizedAudio.audioMediaId, audioRights: normalizedAudio.rights,
        audioAttribution: normalizedAudio.attribution,
      }));
      const info = this.db.prepare(
        `INSERT INTO posts (user_id, persona, kind, caption, media_id, visibility, language, region_code, provenance,
                            media_edit_json, media_edit_hash, audio_media_id, audio_rights, audio_attribution, content_commitment, devnet_tx)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, persona, kind, caption, mediaId, safeVisibility, language, regionCode, provenance,
        normalizedStudio ? JSON.stringify(normalizedStudio) : null, mediaEditHash, normalizedAudio.audioMediaId,
        normalizedAudio.rights, normalizedAudio.attribution, commitment, null);
      this.db.prepare(`INSERT INTO post_versions (post_id, version, caption, visibility, status, content_commitment)
        VALUES (?, 1, ?, ?, 'active', ?)`).run(Number(info.lastInsertRowid), caption, safeVisibility, commitment);
      return this.getPostById(Number(info.lastInsertRowid));
    },
    getPostById(id) {
      return this.joinPost(this.db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id));
    },
    joinPost(row) {
      if (!row) return null;
      const author = this.getUserById(row.user_id);
      const authorPersona = this.getPersona(row.user_id, row.persona);
      let studioManifest = null;
      let studioIntegrity = row.media_edit_json == null && row.media_edit_hash == null ? "NOT_APPLICABLE" : "FAILED";
      if (row.media_edit_json && row.media_edit_hash) {
        try {
          const parsed = JSON.parse(row.media_edit_json);
          if (creatorStudioHash(parsed) === row.media_edit_hash) {
            studioManifest = normalizeCreatorStudio(parsed, { mediaKind: row.kind });
            studioIntegrity = "VERIFIED";
          }
        } catch { /* fail closed: ignore a malformed/tampered edit manifest */ }
      }
      return {
        ...row,
        author: author ? {
          id: author.id,
          handle: author.handle,
          display_name: authorPersona?.name ?? author.display_name,
          avatar: authorPersona?.avatar ?? author.avatar,
          orbit_mood: authorPersona?.orbit_mood ?? null,
          orbit_place: authorPersona?.orbit_place ?? null,
          orbit_now: authorPersona?.orbit_now ?? null,
          orbit_fandom: authorPersona?.orbit_fandom ?? null,
          orbit_quote: authorPersona?.orbit_quote ?? null,
          orbit_expires_at: authorPersona?.orbit_expires_at ?? null,
          earned_sigil: this.sigilProgress(author.id, row.persona),
          persona: row.persona,
        } : null,
        media: row.media_id ? this.getMediaById(row.media_id) : null,
        creator_studio: studioManifest ? { manifest: studioManifest, manifest_hash: row.media_edit_hash, integrity: studioIntegrity } : { manifest: null, manifest_hash: null, integrity: studioIntegrity },
        audio: row.audio_media_id && studioIntegrity === "VERIFIED" ? this.getMediaById(row.audio_media_id) : null,
        audio_rights: row.audio_media_id && studioIntegrity === "VERIFIED" ? row.audio_rights : null,
        audio_attribution: row.audio_media_id && studioIntegrity === "VERIFIED" ? row.audio_attribution : "",
      };
    },
    saveContentAssessment(subjectType, subjectId, contentCommitment, assessment) {
      const type = String(subjectType ?? "").toLowerCase();
      if (!new Set(["post", "comment"]).has(type) || !Number.isSafeInteger(Number(subjectId)) || !contentCommitment) {
        throw new Error("CONTENT_ASSESSMENT_SUBJECT_INVALID");
      }
      const authoritative = type === "post"
        ? this.db.prepare(`SELECT * FROM posts WHERE id = ?`).get(Number(subjectId))
        : this.db.prepare(`SELECT * FROM comments WHERE id = ?`).get(Number(subjectId));
      if (!authoritative) throw new Error("CONTENT_ASSESSMENT_SUBJECT_INVALID");
      const authoritativeCommitment = type === "post" ? canonicalPostCommitment(authoritative) : canonicalCommentCommitment(authoritative);
      if (authoritative.content_commitment !== authoritativeCommitment || contentCommitment !== authoritativeCommitment) {
        throw new Error("CONTENT_ASSESSMENT_COMMITMENT_MISMATCH");
      }
      const canonicalAssessment = type === "post"
        ? assessSocialContent({ text: authoritative.caption, provenance: authoritative.provenance, mediaKind: authoritative.kind })
        : assessSocialContent({ text: authoritative.body, provenance: "NOT_DECLARED", mediaKind: "text" });
      if (assessment?.policyVersion !== MODERATION_POLICY_VERSION || assessment?.assessmentHash !== canonicalAssessment.assessmentHash) {
        throw new Error("CONTENT_ASSESSMENT_CANONICAL_MISMATCH");
      }
      const boundAssessmentHash = sha256Hex(JSON.stringify({
        subjectType: type, subjectId: Number(subjectId), contentCommitment,
        policyVersion: canonicalAssessment.policyVersion, assessmentHash: canonicalAssessment.assessmentHash,
      }));
      this.db.prepare(`
        INSERT OR IGNORE INTO content_assessments (
          subject_type, subject_id, content_commitment, policy_version, engine, decision, risk_level,
          labels_json, reasons_json, provenance_json, factual_status, visual_safety, assessment_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        type, Number(subjectId), contentCommitment, canonicalAssessment.policyVersion, canonicalAssessment.engine,
        canonicalAssessment.decision, canonicalAssessment.riskLevel, JSON.stringify(canonicalAssessment.labels),
        JSON.stringify(canonicalAssessment.reasons), JSON.stringify(canonicalAssessment.provenance),
        canonicalAssessment.factualStatus, canonicalAssessment.visualSafety, boundAssessmentHash,
      );
      return this.getContentAssessment(type, Number(subjectId), contentCommitment);
    },
    getContentAssessment(subjectType, subjectId, contentCommitment = null) {
      const row = contentCommitment
        ? this.db.prepare(`SELECT * FROM content_assessments WHERE subject_type = ? AND subject_id = ? AND content_commitment = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(subjectType, subjectId, contentCommitment)
        : this.db.prepare(`SELECT * FROM content_assessments WHERE subject_type = ? AND subject_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(subjectType, subjectId);
      return publicAssessment(row);
    },
    appendModerationEvent({ subjectType, subjectId, actorKind, action, reasonCode, metadata = {}, createdAt = Math.floor(Date.now() / 1000) }) {
      const previous = this.db.prepare(`SELECT event_hash FROM moderation_events ORDER BY id DESC LIMIT 1`).get()?.event_hash ?? "0".repeat(64);
      const canonical = JSON.stringify({
        subjectType, subjectId: Number(subjectId), actorKind, action,
        policyVersion: MODERATION_POLICY_VERSION, reasonCode, metadata, previous, createdAt,
      });
      const eventHash = sha256Hex(canonical);
      this.db.prepare(`
        INSERT INTO moderation_events (
          subject_type, subject_id, actor_kind, action, policy_version, reason_code,
          metadata_json, previous_hash, event_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(subjectType, Number(subjectId), actorKind, action, MODERATION_POLICY_VERSION, reasonCode, JSON.stringify(metadata), previous, eventHash, createdAt);
      return { eventHash, previousHash: previous, createdAt };
    },
    verifyModerationEventChain() {
      const rows = this.db.prepare(`SELECT * FROM moderation_events ORDER BY id ASC`).all();
      let previous = "0".repeat(64);
      for (const row of rows) {
        let metadata;
        try { metadata = JSON.parse(row.metadata_json); } catch { return { internalLinkConsistency: false, completenessAuthenticated: false, count: rows.length, error: "METADATA_INVALID" }; }
        const canonical = JSON.stringify({
          subjectType: row.subject_type, subjectId: Number(row.subject_id), actorKind: row.actor_kind,
          action: row.action, policyVersion: row.policy_version, reasonCode: row.reason_code,
          metadata, previous, createdAt: Number(row.created_at),
        });
        if (row.previous_hash !== previous || row.event_hash !== sha256Hex(canonical)) return { internalLinkConsistency: false, completenessAuthenticated: false, count: rows.length, error: "CHAIN_INVALID" };
        previous = row.event_hash;
      }
      return {
        internalLinkConsistency: true,
        completenessAuthenticated: false,
        count: rows.length,
        head: previous,
        scope: "DETECTS_UNRECOMPUTED_EDIT_OR_REORDER_ONLY",
        limitation: "FULL_DELETION_OR_WHOLESALE_RECOMPUTATION_IS_NOT_DETECTABLE_WITHOUT_A_TRUSTED_EXTERNAL_CHECKPOINT",
      };
    },
    createModerationReport({ reporterId, reporterPersona, subjectType, subjectId, category, details = "" }) {
      const actor = this.getUserById(reporterId);
      const type = String(subjectType ?? "").toLowerCase();
      const id = Number(subjectId);
      const normalizedCategory = String(category ?? "").toUpperCase();
      if (!actor || !new Set(["post", "comment"]).has(type) || !Number.isSafeInteger(id) || id < 1 || !REPORT_CATEGORIES.includes(normalizedCategory)) {
        throw new Error("MODERATION_REPORT_SUBJECT_INVALID");
      }
      const subjectExists = type === "post"
        ? Boolean(this.db.prepare(`SELECT 1 FROM posts WHERE id = ? AND persona = 'social'`).get(id))
        : Boolean(this.db.prepare(`
            SELECT 1 FROM comments c JOIN posts p ON p.id = c.post_id
            WHERE c.id = ? AND p.persona = 'social'
          `).get(id));
      if (!subjectExists) throw new Error("MODERATION_REPORT_SUBJECT_INVALID");
      const organic = actor?.traffic_class === "HUMAN_ORGANIC";
      const status = organic ? "AUTO_REVIEWED" : "RECEIVED_TEST_EXCLUDED";
      const outcome = organic ? "NO_AUTOMATIC_TAKEDOWN" : "EXCLUDED_FROM_ENFORCEMENT";
      const reasonCode = organic ? "REPORT_RECORDED_CONTEXT_ONLY" : "NON_ORGANIC_REPORT_EXCLUDED";
      const inserted = this.db.prepare(`
        INSERT OR IGNORE INTO moderation_reports (
          reporter_id, reporter_persona, subject_type, subject_id, category, details, status, outcome, reason_code, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `).run(reporterId, normalizePersona(reporterPersona), type, id, normalizedCategory, details, status, outcome, reasonCode);
      const report = this.db.prepare(`
        SELECT * FROM moderation_reports WHERE reporter_id = ? AND subject_type = ? AND subject_id = ? AND category = ?
      `).get(reporterId, type, id, normalizedCategory);
      if (report && Number(inserted.changes) === 1) this.appendModerationEvent({
        subjectType: type, subjectId: id, actorKind: organic ? "USER" : "SYSTEM_TEST",
        action: "REPORT_RECORDED", reasonCode,
        metadata: { reportId: report.id, category: normalizedCategory, enforcementChanged: false },
      });
      return report;
    },
    listModerationReportsByReporter(reporterId, subjectType, subjectId) {
      return this.db.prepare(`
        SELECT id, category, status, outcome, reason_code, created_at, resolved_at
        FROM moderation_reports WHERE reporter_id = ? AND subject_type = ? AND subject_id = ? ORDER BY id DESC
      `).all(reporterId, subjectType, subjectId);
    },
    appealContentAssessment({ appellantId, subjectType, subjectId, reason }) {
      const post = subjectType === "post" ? this.getPostById(subjectId) : null;
      if (!post || post.persona !== "social" || post.user_id !== appellantId) return null;
      const assessment = this.getContentAssessment(subjectType, subjectId, post.content_commitment);
      if (!assessment) return null;
      const outcome = assessment.decision === "ALLOW_WITH_CONTEXT" ? "LABEL_DISPUTED_RETAINED_NO_RESTRICTION" : "NO_RESTRICTION_TO_APPEAL";
      const reasonCode = assessment.decision === "ALLOW_WITH_CONTEXT" ? "AUTHOR_DISPUTE_RECORDED" : "CONTENT_ALREADY_UNRESTRICTED";
      const info = this.db.prepare(`
        INSERT OR IGNORE INTO moderation_appeals
          (appellant_id, subject_type, subject_id, content_commitment, reason, status, outcome, reason_code)
        VALUES (?, ?, ?, ?, ?, 'RECORDED_AUTOMATED_ONLY', ?, ?)
      `).run(appellantId, subjectType, subjectId, post.content_commitment, reason, outcome, reasonCode);
      this.db.prepare(`UPDATE content_assessments SET author_disputed = 1 WHERE subject_type = ? AND subject_id = ? AND content_commitment = ?`)
        .run(subjectType, subjectId, post.content_commitment);
      const appeal = this.db.prepare(`
        SELECT * FROM moderation_appeals
        WHERE appellant_id = ? AND subject_type = ? AND subject_id = ? AND content_commitment = ?
      `).get(appellantId, subjectType, subjectId, post.content_commitment);
      if (appeal && Number(info.changes) === 1) this.appendModerationEvent({
        subjectType, subjectId, actorKind: "AUTHOR", action: "ASSESSMENT_APPEALED", reasonCode,
        metadata: { appealId: appeal.id, restrictionChanged: false },
      });
      return appeal;
    },
    recordPrepublicationReconsideration({ userId, contentHash, reason, outcome, assessmentHash }) {
      if (!this.getUserById(userId) || !/^[a-f0-9]{64}$/.test(String(contentHash)) || !/^[a-f0-9]{64}$/.test(String(assessmentHash))) {
        throw new Error("MODERATION_RECONSIDERATION_INVALID");
      }
      this.db.prepare(`
        INSERT OR IGNORE INTO moderation_reconsiderations (
          user_id, content_hash, policy_version, reason, outcome, assessment_hash
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, contentHash, MODERATION_POLICY_VERSION, reason, outcome, assessmentHash);
      return this.db.prepare(`
        SELECT id, policy_version, outcome, assessment_hash, created_at
        FROM moderation_reconsiderations WHERE user_id = ? AND content_hash = ? AND policy_version = ?
      `).get(userId, contentHash, MODERATION_POLICY_VERSION);
    },
    listPosts({ persona = "social", limit = 50, before = null, userId = null } = {}) {
      persona = normalizePersona(persona);
      // Select the author before LIMIT. Filtering a global page afterwards hides
      // an otherwise visible profile once other authors publish 100 newer posts.
      if (userId !== null) {
        if (!Number.isSafeInteger(userId) || userId <= 0) return [];
        const bounded = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
        return this.db.prepare(`SELECT * FROM posts WHERE user_id = ? AND persona = ?
          AND (? IS NULL OR created_at < ?) ORDER BY created_at DESC, id DESC LIMIT ?`)
          .all(userId, persona, before, before, bounded).map((row) => this.joinPost(row));
      }
      const rows = before
        ? this.db.prepare(`SELECT * FROM posts WHERE persona = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`).all(persona, before, limit)
        : this.db.prepare(`SELECT * FROM posts WHERE persona = ? ORDER BY created_at DESC LIMIT ?`).all(persona, limit);
      return rows.map((r) => this.joinPost(r));
    },
    feedForUser(userId, { persona = "social", limit = 50 } = {}) {
      persona = normalizePersona(persona);
      const rows = this.db.prepare(`
        SELECT p.* FROM posts p
        LEFT JOIN follows f ON f.followee_id = p.user_id AND f.persona = ?
        WHERE p.persona = ? AND (p.user_id = ? OR f.follower_id = ?)
        ORDER BY p.created_at DESC LIMIT ?
      `).all(persona, persona, userId, userId, limit);
      return rows.map((r) => this.joinPost(r));
    },
    setPostDevnetTx(id, tx, explorerUrl, userId = null, actor = "nexus:user") {
      this.db.prepare(`UPDATE posts SET devnet_tx = ? WHERE id = ?`).run(tx, id);
      if (explorerUrl) {
        this.recordDevnetAction({ userId, actor, action: "publish", payloadHash: tx, txHash: tx, explorerUrl });
      }
    },
    editPost({ id, userId, actorPersona, caption, visibility }) {
      const post = this.getPostById(id);
      actorPersona = normalizePersona(actorPersona);
      if (!post || post.user_id !== userId || post.persona !== actorPersona || post.status !== "active") return null;
      const cleanCaption = String(caption ?? "").trim().slice(0, 5000);
      const cleanVisibility = PROFILE_VISIBILITY.has(visibility) ? visibility : post.visibility;
      if (!cleanCaption && !post.media_id) return null;
      const version = Number(post.version || 1) + 1;
      const commitment = sha256Hex(JSON.stringify({
        userId: post.user_id, persona: post.persona, kind: post.kind, caption: cleanCaption,
        mediaId: post.media_id, visibility: cleanVisibility, language: post.language, regionCode: post.region_code,
        provenance: post.provenance, mediaEditHash: post.media_edit_hash, audioMediaId: post.audio_media_id,
        audioRights: post.audio_rights, audioAttribution: post.audio_attribution,
      }));
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const changed = this.db.prepare(`UPDATE posts SET caption = ?, visibility = ?, content_commitment = ?, version = ?, edited_at = unixepoch()
          WHERE id = ? AND user_id = ? AND persona = ? AND status = 'active' AND version = ?`)
          .run(cleanCaption, cleanVisibility, commitment, version, id, userId, actorPersona, version - 1);
        if (changed.changes !== 1) throw new Error("POST_EDIT_CONFLICT");
        this.db.prepare(`INSERT INTO post_versions (post_id, version, caption, visibility, status, content_commitment)
          VALUES (?, ?, ?, ?, 'active', ?)` ).run(id, version, cleanCaption, cleanVisibility, commitment);
        this.db.prepare(`INSERT INTO outbox_events
          (aggregate_type, aggregate_id, event_type, payload_json, status, available_at)
          VALUES ('post_version', ?, 'social.post.edited', ?, 'pending', unixepoch())`)
          .run(`${id}:${version}`, JSON.stringify({ postId: id, version, actorId: userId, actorPersona }));
        this.db.exec("COMMIT");
        return this.getPostById(id);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    // A pin puts a post at the top of the owner's own profile, and three at most: a profile that pins
    // everything pins nothing, so the rest of the archive stays chronological. Nothing about the post
    // itself changes - no version, no new commitment - because a pin is a decision about the profile,
    // not an edit of what was published.
    setPostPinned(id, userId, actorPersona, pinned) {
      actorPersona = normalizePersona(actorPersona);
      const post = this.getPostById(id);
      if (!post || post.user_id !== userId || post.persona !== actorPersona || post.status !== "active") return null;
      const alreadyPinned = Number(post.pinned_at || 0) > 0;
      if (pinned && !alreadyPinned) {
        const pinnedCount = Number(this.db.prepare(
          `SELECT COUNT(*) c FROM posts WHERE user_id = ? AND persona = ? AND status = 'active' AND pinned_at IS NOT NULL`,
        ).get(userId, actorPersona).c);
        if (pinnedCount >= PINNED_POST_LIMIT) return { error: "pin_limit" };
      }
      // Pinning the same post twice keeps the moment it was first pinned: the row the owner already
      // arranged does not move because a tap was repeated.
      const at = pinned ? (alreadyPinned ? Number(post.pinned_at) : Math.floor(Date.now() / 1000)) : null;
      this.db.prepare(`UPDATE posts SET pinned_at = ? WHERE id = ?`).run(at, id);
      return { post: this.getPostById(id) };
    },
    archivePost(id, userId, actorPersona) {
      const post = this.getPostById(id);
      actorPersona = normalizePersona(actorPersona);
      if (!post || post.user_id !== userId || post.persona !== actorPersona || post.status === "withdrawn") return null;
      if (post.status === "archived") return post;
      const version = Number(post.version || 1) + 1;
      const commitment = sha256Hex(`archive:${post.content_commitment}:${version}`);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const changed = this.db.prepare(`UPDATE posts SET status = 'archived', archived_at = unixepoch(), content_commitment = ?, version = ? WHERE id = ? AND version = ?`)
          .run(commitment, version, id, version - 1);
        if (changed.changes !== 1) throw new Error("POST_ARCHIVE_CONFLICT");
        this.db.prepare(`INSERT INTO post_versions (post_id, version, caption, visibility, status, content_commitment)
          VALUES (?, ?, ?, ?, 'archived', ?)` ).run(id, version, post.caption, post.visibility, commitment);
        this.db.prepare(`INSERT INTO outbox_events
          (aggregate_type, aggregate_id, event_type, payload_json, status, available_at)
          VALUES ('post_version', ?, 'social.post.archived', ?, 'pending', unixepoch())`)
          .run(`${id}:${version}`, JSON.stringify({ postId: id, version, actorId: userId, actorPersona }));
        this.db.exec("COMMIT");
        return this.getPostById(id);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    postHistory(id, userId, actorPersona) {
      const post = this.getPostById(id);
      if (!post || post.user_id !== userId || post.persona !== normalizePersona(actorPersona)) return null;
      return this.db.prepare(`SELECT version, caption, visibility, status, content_commitment, created_at FROM post_versions WHERE post_id = ? ORDER BY version ASC LIMIT 100`).all(id);
    },
    withdrawPost(id, userId, actorPersona) {
      const post = this.getPostById(id);
      actorPersona = normalizePersona(actorPersona);
      if (!post || post.user_id !== userId || post.persona !== actorPersona) return null;
      if (post.status !== "withdrawn") {
        const version = Number(post.version || 1) + 1;
        const commitment = sha256Hex(`withdraw:${post.content_commitment}:${version}`);
        this.db.exec("BEGIN IMMEDIATE");
        try {
          const changed = this.db.prepare(`UPDATE posts SET caption = '', media_id = NULL, audio_media_id = NULL, media_edit_json = NULL,
            status = 'withdrawn', content_commitment = ?, version = ?, withdrawn_at = unixepoch() WHERE id = ? AND version = ?`)
            .run(commitment, version, id, version - 1);
          if (changed.changes !== 1) throw new Error("POST_WITHDRAW_CONFLICT");
          this.db.prepare(`INSERT INTO post_versions (post_id, version, caption, visibility, status, content_commitment)
            VALUES (?, ?, '', ?, 'withdrawn', ?)` ).run(id, version, post.visibility, commitment);
          this.db.prepare(`INSERT INTO outbox_events
            (aggregate_type, aggregate_id, event_type, payload_json, status, available_at)
            VALUES ('post_version', ?, 'social.post.withdrawn', ?, 'pending', unixepoch())`)
            .run(`${id}:${version}`, JSON.stringify({ postId: id, version, actorId: userId, actorPersona }));
          this.db.exec("COMMIT");
        } catch (error) { this.db.exec("ROLLBACK"); throw error; }
      }
      return this.getPostById(id);
    },
    deletePost(id, userId, actorPersona) {
      return this.withdrawPost(id, userId, actorPersona);
    },

    isBlockedBetween(viewerId, viewerPersona, authorId, authorPersona = "social") {
      return Boolean(this.db.prepare(`
        SELECT 1 FROM profile_blocks
        WHERE (blocker_id = ? AND blocker_persona = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocker_persona = ? AND blocked_id = ?)
        LIMIT 1
      `).get(viewerId, normalizePersona(viewerPersona), authorId, authorId, normalizePersona(authorPersona), viewerId));
    },
    isAccountBlockedBetween(leftId, rightId) {
      return Boolean(this.db.prepare(`
        SELECT 1 FROM profile_blocks
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)
        LIMIT 1
      `).get(leftId, rightId, rightId, leftId));
    },
    setProfileBlock(blockerId, blockerPersona, blockedId, active = true) {
      blockerPersona = normalizePersona(blockerPersona);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        let relationshipChanged = false;
        if (active) {
          relationshipChanged = this.db.prepare(`INSERT OR IGNORE INTO profile_blocks (blocker_id, blocker_persona, blocked_id) VALUES (?, ?, ?)`).run(blockerId, blockerPersona, blockedId).changes === 1;
          this.db.prepare(`DELETE FROM follows WHERE persona = ? AND ((follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?))`)
            .run(blockerPersona, blockerId, blockedId, blockedId, blockerId);
          this.db.prepare(`UPDATE follow_requests SET status = 'cancelled', decided_at = unixepoch(), updated_at = unixepoch()
            WHERE persona = ? AND status IN ('pending','accepted') AND ((requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?))`)
            .run(blockerPersona, blockerId, blockedId, blockedId, blockerId);
          if (blockerPersona === "dating") {
            const low = Math.min(blockerId, blockedId), high = Math.max(blockerId, blockedId);
            const match = this.db.prepare(`SELECT conversation_id FROM dating_matches WHERE user_low_id = ? AND user_high_id = ? AND status = 'active'`).get(low, high);
            this.db.prepare(`UPDATE dating_matches SET status = 'blocked', ended_by = ?, updated_at = unixepoch() WHERE user_low_id = ? AND user_high_id = ? AND status = 'active'`).run(blockerId, low, high);
            if (match?.conversation_id) this.db.prepare(`UPDATE conversations SET status = 'declined', key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`).run(match.conversation_id);
          }
        } else {
          relationshipChanged = this.db.prepare(`DELETE FROM profile_blocks WHERE blocker_id = ? AND blocker_persona = ? AND blocked_id = ?`).run(blockerId, blockerPersona, blockedId).changes === 1;
        }
        if (relationshipChanged) {
          this.db.prepare(`
            UPDATE conversations SET key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch()
            WHERE context_persona = ?
              AND EXISTS (SELECT 1 FROM conversation_participants a WHERE a.conversation_id = conversations.id AND a.user_id = ? AND a.state = 'active' AND a.archived_at IS NULL)
              AND EXISTS (SELECT 1 FROM conversation_participants b WHERE b.conversation_id = conversations.id AND b.user_id = ? AND b.state = 'active' AND b.archived_at IS NULL)
          `).run(blockerPersona, blockerId, blockedId);
        }
        this.db.exec("COMMIT");
        return active;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    canViewPost(viewerId, viewerPersona, post) {
      if (!post) return false;
      viewerPersona = normalizePersona(viewerPersona);
      const ownerPersona = normalizePersona(post.persona);
      const profile = this.getPersona(post.user_id, post.persona);
      if (!profile) return false;
      const follows = this.isFollowing(viewerId, post.user_id, ownerPersona);
      const mutual = follows && this.isFollowing(post.user_id, viewerId, ownerPersona);
      return evaluatePrivacy({
        viewerId,
        viewerPersona,
        ownerId: post.user_id,
        ownerPersona,
        ownerVisibility: profile.visibility,
        resourceVisibility: post.visibility,
        resourceStatus: post.status,
        blocked: this.isBlockedBetween(viewerId, viewerPersona, post.user_id, ownerPersona),
        follows,
        mutual,
        privateEntitlement: this.hasActivePrivateAccess(viewerId, post.user_id, ownerPersona),
      }).allow;
    },
    canViewHighlightedStory(viewerId, viewerPersona, story) {
      if (!story || normalizePersona(story.persona) !== "social") return false;
      const profile = this.getPersona(story.user_id, story.persona);
      if (!profile) return false;
      const ownerPersona = normalizePersona(story.persona);
      const follows = this.isFollowing(viewerId, story.user_id, ownerPersona);
      const mutual = follows && this.isFollowing(story.user_id, viewerId, ownerPersona);
      return evaluatePrivacy({
        viewerId,
        viewerPersona: normalizePersona(viewerPersona),
        ownerId: story.user_id,
        ownerPersona,
        ownerVisibility: profile.visibility,
        resourceVisibility: story.visibility,
        // Highlight membership is the owner's explicit active presentation of
        // an otherwise archived/expired Story. The original status is retained.
        resourceStatus: "active",
        blocked: this.isBlockedBetween(viewerId, viewerPersona, story.user_id, ownerPersona),
        follows,
        mutual,
        privateEntitlement: this.hasActivePrivateAccess(viewerId, story.user_id, ownerPersona),
      }).allow;
    },
    searchSocial(viewerId, { viewerPersona = "social", query, limit = 20, offset = 0 } = {}) {
      const normalized = String(query ?? "").trim().toLocaleLowerCase().replace(/^@/, "").replace(/[%_]/g, "").slice(0, 80);
      if (normalized.length < 2) return { profiles: [], posts: [] };
      const bounded = Math.max(1, Math.min(Number(limit) || 20, 30));
      const boundedOffset = Math.max(0, Math.min(Number(offset) || 0, 200));
      const pattern = `%${normalized}%`;
      const profileRows = this.db.prepare(`
        SELECT u.id, u.handle, p.name, p.bio, p.avatar, p.visibility,
          p.orbit_mood, p.orbit_place, p.orbit_now, p.orbit_fandom, p.orbit_quote, p.orbit_expires_at
        FROM users u JOIN personas p ON p.user_id = u.id AND p.persona = 'social'
        WHERE u.traffic_class = 'HUMAN_ORGANIC' AND p.discoverability = 'public'
          AND (lower(u.handle) LIKE ? OR lower(p.name) LIKE ?)
        ORDER BY CASE WHEN lower(u.handle) = ? THEN 0 ELSE 1 END, u.handle
        LIMIT ?
      `).all(pattern, pattern, normalized, (boundedOffset + bounded + 1) * 2);
      const profiles = profileRows.filter((profile) => this.canViewPost(viewerId, viewerPersona, {
        user_id: profile.id, persona: "social", visibility: "public", status: "active",
      })).filter((profile) => !this.isBlockedBetween(viewerId, viewerPersona, profile.id, "social")).slice(boundedOffset, boundedOffset + bounded + 1).map((profile) => ({
        ...profile,
        followers: this.followCounts(profile.id, "social").followers,
        earned_sigil: this.sigilProgress(profile.id, "social"),
      }));
      const postRows = this.db.prepare(`
        SELECT p.* FROM posts p JOIN users author ON author.id = p.user_id
        LEFT JOIN media m ON m.id = p.media_id
        WHERE p.persona = 'social' AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
          AND lower(p.caption) LIKE ? AND (p.media_id IS NULL OR m.scan_status = 'ready_local_validation')
        ORDER BY p.created_at DESC, p.id DESC LIMIT ?
      `).all(pattern, (boundedOffset + bounded + 1) * 3);
      const posts = postRows.map((row) => this.joinPost(row))
        .filter((post) => this.canViewPost(viewerId, viewerPersona, post))
        .slice(boundedOffset, boundedOffset + bounded + 1);
      return {
        profiles: profiles.slice(0, bounded),
        posts: posts.slice(0, bounded),
        hasMore: profiles.length > bounded || posts.length > bounded,
        offset: boundedOffset,
        limit: bounded,
      };
    },
    prepareSocialLive(hostId, { title, category = "creator", visibility = "private", language = "und", commentsEnabled = true } = {}) {
      const host = this.getUserById(hostId);
      const profile = this.getPersona(hostId, "social");
      const cleanTitle = String(title ?? "").trim().slice(0, 80);
      const cleanCategory = String(category ?? "creator").trim().toLowerCase();
      const cleanVisibility = String(visibility ?? "private").trim().toLowerCase();
      const cleanLanguage = String(language ?? "und").trim().toLowerCase() || "und";
      if (!host || !profile || cleanTitle.length < 3 || !new Set(["creator", "music", "gaming", "talk", "sport", "education"]).has(cleanCategory)
        || !new Set(["public", "followers", "friends", "private"]).has(cleanVisibility)
        || !/^(und|[a-z]{2,3}(?:-[a-z0-9]{2,8})*)$/.test(cleanLanguage)) return null;
      const active = this.db.prepare(`SELECT * FROM social_live_sessions WHERE host_id = ? AND status IN ('scheduled','live') ORDER BY id DESC LIMIT 1`).get(hostId);
      if (active) return null;
      const preview = this.db.prepare(`SELECT * FROM social_live_sessions WHERE host_id = ? AND status = 'preview' ORDER BY id DESC LIMIT 1`).get(hostId);
      if (preview) {
        this.db.prepare(`UPDATE social_live_sessions SET title = ?, category = ?, visibility = ?, language = ?, comments_enabled = ? WHERE id = ?`)
          .run(cleanTitle, cleanCategory, cleanVisibility, cleanLanguage, commentsEnabled === false ? 0 : 1, preview.id);
        return this.db.prepare(`SELECT * FROM social_live_sessions WHERE id = ?`).get(preview.id);
      }
      const info = this.db.prepare(`
        INSERT INTO social_live_sessions (host_id, title, category, status, transport_status, visibility, language, comments_enabled)
        VALUES (?, ?, ?, 'preview', 'GATED_NO_SFU', ?, ?, ?)
      `).run(hostId, cleanTitle, cleanCategory, cleanVisibility, cleanLanguage, commentsEnabled === false ? 0 : 1);
      return this.db.prepare(`SELECT * FROM social_live_sessions WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    createSocialLiveCompetitionDraft({ ownerId, title, format, startsAt }) {
      const cleanTitle = String(title ?? "").trim().slice(0, 80);
      const cleanFormat = String(format ?? "").trim().toLowerCase();
      const start = Number(startsAt);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!this.getUserById(ownerId) || cleanTitle.length < 3 || !new Set(["battle", "championship"]).has(cleanFormat)
        || !Number.isInteger(start) || start < nowSeconds + 300 || start > nowSeconds + 366 * 86400) return null;
      const info = this.db.prepare(`
        INSERT INTO social_live_competitions (owner_id, title, format, status, scoring_policy, prize_policy, starts_at)
        VALUES (?, ?, ?, 'draft', 'ORGANIC_ENGAGEMENT_V1', 'NO_PRIZE_CONFIGURED', ?)
      `).run(ownerId, cleanTitle, cleanFormat, start);
      return this.db.prepare(`SELECT * FROM social_live_competitions WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listSocialLive(viewerId, { limit = 20, atSeconds = Math.floor(Date.now() / 1000) } = {}) {
      const bounded = Math.max(1, Math.min(Number(limit) || 20, 50));
      const liveRows = this.db.prepare(`
        SELECT s.*, u.handle, p.name display_name, p.avatar,
          (SELECT COUNT(*) FROM social_live_attendance a JOIN users viewer ON viewer.id = a.viewer_id
            WHERE a.session_id = s.id AND a.left_at IS NULL AND a.last_heartbeat_at >= ?
              AND viewer.traffic_class = 'HUMAN_ORGANIC') organic_viewers,
          (SELECT COUNT(*) FROM follows f JOIN users follower ON follower.id = f.follower_id
            WHERE f.followee_id = s.host_id AND f.persona = 'social'
              AND follower.traffic_class = 'HUMAN_ORGANIC') qualified_followers
        FROM social_live_sessions s JOIN users u ON u.id = s.host_id
        JOIN personas p ON p.user_id = s.host_id AND p.persona = 'social'
        WHERE s.status = 'live' AND s.transport_status = 'VERIFIED_ACTIVE'
          AND u.traffic_class = 'HUMAN_ORGANIC' AND p.discoverability = 'public'
        ORDER BY organic_viewers DESC, qualified_followers DESC, s.started_at DESC LIMIT ?
      `).all(atSeconds - 45, bounded).filter((session) => this.canViewPost(viewerId, "social", {
        user_id: session.host_id, persona: "social", visibility: session.visibility, status: "active",
      })).map((session) => ({ ...session, is_following: this.isFollowing(viewerId, session.host_id, "social"), earned_sigil: this.sigilProgress(session.host_id, "social") }));
      const creators = this.db.prepare(`
        SELECT u.id user_id, u.handle, p.name display_name, p.avatar, COUNT(f.follower_id) qualified_followers
        FROM users u JOIN personas p ON p.user_id = u.id AND p.persona = 'social'
        LEFT JOIN follows f ON f.followee_id = u.id AND f.persona = 'social'
          AND EXISTS (SELECT 1 FROM users follower WHERE follower.id = f.follower_id AND follower.traffic_class = 'HUMAN_ORGANIC')
        WHERE u.traffic_class = 'HUMAN_ORGANIC' AND p.discoverability = 'public' AND p.visibility = 'public'
        GROUP BY u.id, u.handle, p.name, p.avatar
        HAVING qualified_followers > 0
        ORDER BY qualified_followers DESC, u.handle LIMIT ?
      `).all(bounded).filter((creator) => !this.isBlockedBetween(viewerId, "social", creator.user_id, "social"))
        .map((creator) => ({ ...creator, is_live: false, is_following: this.isFollowing(viewerId, creator.user_id, "social"), earned_sigil: this.sigilProgress(creator.user_id, "social") }));
      const competitions = this.db.prepare(`
        SELECT c.*, u.handle owner_handle, u.display_name owner_name
        FROM social_live_competitions c JOIN users u ON u.id = c.owner_id
        WHERE (c.status IN ('scheduled','live','completed') AND u.traffic_class = 'HUMAN_ORGANIC')
           OR (c.status = 'draft' AND c.owner_id = ?)
        ORDER BY CASE c.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
          c.starts_at ASC, c.id DESC LIMIT ?
      `).all(viewerId, bounded).map((competition) => ({
        ...competition,
        competitors: this.db.prepare(`
          SELECT lc.user_id, u.handle, u.display_name, lc.seed, lc.organic_score, lc.status
          FROM social_live_competitors lc JOIN users u ON u.id = lc.user_id
          WHERE lc.competition_id = ? AND u.traffic_class = 'HUMAN_ORGANIC'
          ORDER BY COALESCE(lc.seed, 2147483647), lc.organic_score DESC, u.handle
        `).all(competition.id),
      }));
      const ownPreview = this.db.prepare(`SELECT * FROM social_live_sessions WHERE host_id = ? AND status = 'preview' ORDER BY id DESC LIMIT 1`).get(viewerId) ?? null;
      return { live: liveRows, creators, competitions, own_preview: ownPreview };
    },
    listSocialFeed(viewerId, { viewerPersona = "social", lens = "for-you", format = "all", limit = 30, regionCode = null, excludePostIds = [] } = {}) {
      if (lens === "breaking") return [];
      const bounded = Math.max(1, Math.min(Number(limit) || 30, 100));
      const excluded = new Set(Array.isArray(excludePostIds)
        ? excludePostIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 300)
        : []);
      const viewerProfile = this.getPersona(viewerId, "social");
      const state = this.db.prepare(`SELECT * FROM recommendation_state WHERE user_id = ? AND persona = 'social'`).get(viewerId)
        ?? { version: 1, reset_at: null };
      const languages = (() => { try { return JSON.parse(viewerProfile?.content_languages ?? "[]"); } catch { return []; } })();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const rows = this.db.prepare(`
        SELECT p.* FROM posts p JOIN users author ON author.id = p.user_id
        LEFT JOIN media m ON m.id = p.media_id
        WHERE p.persona = 'social' AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
          AND (p.media_id IS NULL OR m.scan_status = 'ready_local_validation')
        ORDER BY p.created_at DESC, p.id DESC LIMIT ?
      `).all(Math.min(500, bounded * 12));
      // One filter for both kinds of entry, so a repost obeys exactly the same rules as the
      // post it shares. A muted account stops being a candidate before any score is computed.
      const keeps = (post, repost) => {
        if (excluded.has(post.id)) return false;
        if (!this.canViewPost(viewerId, viewerPersona, post)) return false;
        // Reels is the immersive visual reading: both moving clips and photographs belong here.
        if (format === "clips" && post.kind !== "video" && post.kind !== "image") return false;
        if (format === "posts" && post.kind === "video") return false;
        if (format === "tweets" && (post.kind !== "text" || post.media_id)) return false;
        // In the Following lens an authored post must come from an account the viewer follows,
        // but a repost only needs the reposter to be followed: that is the whole point of it.
        if (format === "following" && !repost && !this.isFollowing(viewerId, post.user_id, "social") && post.user_id !== viewerId) return false;
        if (lens === "near" && !(regionCode && post.region_code && post.region_code === regionCode)) return false;
        if (this.isMuted(viewerId, viewerPersona, post.user_id)) return false;
        if (repost && this.isMuted(viewerId, viewerPersona, repost.reposter.id)) return false;
        if (this.db.prepare(`SELECT 1 FROM social_feedback WHERE viewer_id = ? AND viewer_persona = ? AND post_id = ? AND kind = 'NOT_INTERESTED'`).get(viewerId, viewerPersona, post.id)) return false;
        if (this.db.prepare(`SELECT 1 FROM post_reactions WHERE user_id = ? AND actor_persona = ? AND post_id = ? AND kind = 'DISLIKE'`).get(viewerId, viewerPersona, post.id)) return false;
        return true;
      };
      const authoredCandidates = rows.map((row) => this.joinPost(row)).filter((post) => keeps(post, null));
      const shownAuthoredIds = new Set(authoredCandidates.map((post) => Number(post.id)));
      // A repost lives on the reposter's profile, so it is a feed candidate too. A post is shown
      // once: its own entry wins over a repost of it, and the newest repost wins when several
      // followed accounts shared the same thing.
      const repostedPostIds = new Set();
      const repostEntries = this.listFollowedReposts(viewerId, { viewerPersona, limit: Math.min(200, bounded * 4) })
        .filter((entry) => {
          const id = Number(entry.post.id);
          if (shownAuthoredIds.has(id) || repostedPostIds.has(id)) return false;
          repostedPostIds.add(id);
          return keeps(entry.post, entry);
        });
      const candidates = [...authoredCandidates.map((post) => ({ post, repost: null })), ...repostEntries.map((entry) => ({ post: entry.post, repost: entry }))].map(({ post, repost }) => {
        const reactions = this.db.prepare(`
          SELECT pr.kind, COUNT(DISTINCT pr.user_id) count FROM post_reactions pr
          JOIN users actor ON actor.id = pr.user_id
          WHERE pr.post_id = ? AND pr.user_id <> ? AND actor.traffic_class = 'HUMAN_ORGANIC'
          GROUP BY pr.kind
        `).all(post.id, post.user_id);
        const byKind = Object.fromEntries(reactions.map((row) => [row.kind, Number(row.count)]));
        const comments = Number(this.db.prepare(`
          SELECT COUNT(DISTINCT c.user_id) count FROM comments c JOIN users actor ON actor.id = c.user_id
          WHERE c.post_id = ? AND c.user_id <> ? AND c.status = 'active' AND actor.traffic_class = 'HUMAN_ORGANIC'
        `).get(post.id, post.user_id).count);
        const saves = Number(this.db.prepare(`
          SELECT COUNT(DISTINCT s.user_id) count FROM saved_posts s JOIN users actor ON actor.id = s.user_id
          WHERE s.post_id = ? AND s.user_id <> ? AND actor.traffic_class = 'HUMAN_ORGANIC'
        `).get(post.id, post.user_id).count);
        const shares = Number(this.db.prepare(`
          SELECT COUNT(DISTINCT s.user_id) count FROM post_shares s JOIN users actor ON actor.id = s.user_id
          WHERE s.post_id = ? AND s.user_id <> ? AND actor.traffic_class = 'HUMAN_ORGANIC'
        `).get(post.id, post.user_id).count);
        const impressions = this.db.prepare(`SELECT impression_count, dwell_ms, completed FROM social_impressions WHERE viewer_id = ? AND viewer_persona = ? AND post_id = ?`).get(viewerId, viewerPersona, post.id)
          ?? { impression_count: 0, dwell_ms: 0, completed: 0 };
        const resetAt = Number(state.reset_at ?? 0);
        const affinity = Number(this.db.prepare(`
          SELECT COUNT(*) count FROM post_reactions pr JOIN posts prior ON prior.id = pr.post_id
          WHERE pr.user_id = ? AND pr.actor_persona = ? AND prior.user_id = ?
            AND pr.kind IN ('LIKE','LOVE','HAHA','WOW') AND pr.updated_at > ?
        `).get(viewerId, viewerPersona, post.user_id, resetAt).count);
        const following = this.isFollowing(viewerId, post.user_id, "social");
        // Freshness: a repost resurfaces a post, so the repost time is the clock. The post
        // itself keeps its own timestamp in the interface.
        const ageHours = Math.max(0, (nowSeconds - Number(repost?.reposted_at || post.created_at)) / 3600);
        const recency = Math.max(0, 3200 - Math.floor(ageHours * 32));
        const positive = Math.min(2600,
          (byKind.LIKE ?? 0) * 70 + (byKind.LOVE ?? 0) * 120 + (byKind.HAHA ?? 0) * 90 +
          (byKind.WOW ?? 0) * 80 + (byKind.SAD ?? 0) * 25 + (byKind.ANGRY ?? 0) * 15 +
          comments * 110 + saves * 150 + shares * 180);
        const totalReactions = Object.values(byKind).reduce((sum, value) => sum + value, 0);
        const dislikes = byKind.DISLIKE ?? 0;
        const dislikePenalty = totalReactions >= 5 ? Math.min(900, Math.floor(((dislikes + 1) * 1000) / (totalReactions + 5))) : 0;
        const opinionPenalty = Math.min(150, (byKind.FAKE_OPINION ?? 0) * 12);
        const repeatPenalty = Math.min(1200, Number(impressions.impression_count) * 180);
        // "You asked for less from this author" is a private signal the viewer gave on another post by
        // the same account. It demotes quietly, and it is named in the reasons: the reader is told when
        // their own feedback is the reason a post is lower.
        const authorLess = Number(this.db.prepare(`
          SELECT COUNT(*) count FROM social_feedback f JOIN posts p ON p.id = f.post_id
          WHERE f.viewer_id = ? AND f.viewer_persona = ? AND f.kind = 'NOT_INTERESTED' AND p.user_id = ?
        `).get(viewerId, viewerPersona, post.user_id).count) > 0;
        const authorLessPenalty = authorLess ? 240 : 0;
        let score = recency + positive - dislikePenalty - opinionPenalty - repeatPenalty - authorLessPenalty;
        // A repost is never free: it is demoted against an authored post of the same
        // freshness, so reposting cannot buy reach.
        if (repost) score -= 260;
        if (following) score += 1000;
        if (affinity) score += Math.min(600, affinity * 120);
        if (post.language && languages.includes(post.language)) score += 400;
        if (regionCode && post.region_code === regionCode) score += 350;
        if (Number(impressions.completed)) score += 180;
        const reasons = socialRankingReasonKeys({
          following: following === true,
          affinity: affinity > 0,
          language: Boolean(post.language) && languages.includes(post.language),
          region: Boolean(regionCode) && post.region_code === regionCode,
          conversation: comments + shares >= 2,
          seen: Number(impressions.impression_count) >= 2,
          authorLess,
          disliked: dislikePenalty > 0,
          opinion: opinionPenalty > 0,
          older: ageHours > 72,
          fresh: ageHours <= 6,
          repost: Boolean(repost),
        });
        const explorationEligible = Number(impressions.impression_count) === 0 && ageHours <= 168 && post.user_id !== viewerId;
        const tie = sha256Hex(`${viewerId}:${viewerPersona}:${state.version}:${post.id}:${repost ? "repost" : "post"}`);
        return { post, repost, score, tie, explorationEligible, reasons };
      });

      // One shape for every surface: the post as it is, plus who reposted it when the item
      // came from a repost rather than from its author.
      const withRepost = (item, ranking) => ({
        ...item.post,
        ranking,
        ...(item.repost ? { repost: { id: item.repost.share_id, reposter: item.repost.reposter, reposted_at: item.repost.reposted_at } } : {}),
      });
      const ordered = [...candidates].sort((a, b) => b.score - a.score || a.tie.localeCompare(b.tie));
      if (format === "following") return ordered.slice(0, bounded).map((item) => withRepost(item, { exploration: false, reasons: item.reasons.length ? item.reasons : ["following_author"] }));
      const explorationTarget = Math.min(Math.ceil(bounded / 10), ordered.filter((item) => item.explorationEligible).length);
      const authorCounts = new Map();
      const take = (pool, count, predicate = () => true) => {
        const selected = [];
        for (const item of pool) {
          if (selected.length >= count || !predicate(item) || selected.includes(item)) continue;
          const authorCount = authorCounts.get(item.post.user_id) ?? 0;
          if (authorCount >= 2) continue;
          selected.push(item);
          authorCounts.set(item.post.user_id, authorCount + 1);
        }
        return selected;
      };
      const explorationPool = [...ordered].filter((item) => item.explorationEligible).sort((a, b) => a.tie.localeCompare(b.tie));
      const exploration = take(explorationPool, explorationTarget);
      const explorationSet = new Set(exploration.map((item) => item.post.id));
      const main = take(ordered, bounded - exploration.length, (item) => !explorationSet.has(item.post.id));
      const chosen = new Set([...main, ...exploration].map((item) => item.post.id));
      const fallback = ordered.filter((item) => !chosen.has(item.post.id)).slice(0, bounded - main.length - exploration.length);
      const regular = [...main, ...fallback];
      const result = [];
      let regularIndex = 0;
      let explorationIndex = 0;
      for (let index = 0; result.length < bounded && (regularIndex < regular.length || explorationIndex < exploration.length); index++) {
        const explorationSlot = index % 10 === 4 && explorationIndex < exploration.length;
        const item = explorationSlot ? exploration[explorationIndex++] : (regular[regularIndex++] ?? exploration[explorationIndex++]);
        if (!item) break;
        result.push(withRepost(item, { exploration: explorationSet.has(item.post.id), reasons: explorationSet.has(item.post.id) ? ["exploration_new", ...item.reasons].slice(0, SOCIAL_RANKING_REASON_LIMIT) : (item.reasons.length ? item.reasons : ["fresh_eligible"]) }));
      }
      while (result.length < bounded && explorationIndex < exploration.length) {
        const item = exploration[explorationIndex++];
        result.push(withRepost(item, { exploration: true, reasons: ["exploration_new", ...item.reasons].slice(0, SOCIAL_RANKING_REASON_LIMIT) }));
      }
      return result;
    },
    // The same reasons the feed used, for posts that are not being ranked right now: a profile is read
    // as an archive (newest first), and a reader still deserves to know which of their own signals are
    // behind a post. The order of the profile does not change because of this call - it only explains.
    socialRankingReasons(viewerId, viewerPersona = "social", postIds = [], { atSeconds = Math.floor(Date.now() / 1000) } = {}) {
      const ids = (Array.isArray(postIds) ? postIds : [])
        .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 40);
      const answers = {};
      const profile = this.getPersona(viewerId, "social");
      const languages = (() => { try { return JSON.parse(profile?.content_languages ?? "[]"); } catch { return []; } })();
      const regionCode = profile?.near_enabled ? profile.region_code : null;
      for (const postId of ids) {
        const post = this.getPostById(postId);
        if (!post || !this.canViewPost(viewerId, viewerPersona, post)) { answers[postId] = []; continue; }
        const impressions = this.db.prepare(`SELECT impression_count FROM social_impressions WHERE viewer_id = ? AND viewer_persona = ? AND post_id = ?`).get(viewerId, viewerPersona, postId)
          ?? { impression_count: 0 };
        const byKind = this.db.prepare(`SELECT kind, COUNT(*) count FROM post_reactions WHERE post_id = ? GROUP BY kind`).all(postId)
          .reduce((accumulator, row) => { accumulator[row.kind] = Number(row.count); return accumulator; }, {});
        const comments = Number(this.db.prepare(`SELECT COUNT(*) count FROM comments WHERE post_id = ? AND status = 'active'`).get(postId).count);
        const shares = Number(this.db.prepare(`SELECT COUNT(*) count FROM post_shares WHERE post_id = ?`).get(postId).count);
        const affinity = Number(this.db.prepare(`
          SELECT COUNT(*) count FROM post_reactions pr JOIN posts prior ON prior.id = pr.post_id
          WHERE pr.user_id = ? AND pr.actor_persona = ? AND prior.user_id = ? AND pr.kind IN ('LIKE','LOVE','HAHA','WOW')
        `).get(viewerId, viewerPersona, post.user_id).count);
        const totalReactions = Object.values(byKind).reduce((sum, value) => sum + value, 0);
        const ageHours = Math.max(0, (atSeconds - Number(post.created_at)) / 3600);
        answers[postId] = socialRankingReasonKeys({
          following: this.isFollowing(viewerId, post.user_id, "social") === true,
          affinity: affinity > 0,
          language: Boolean(post.language) && languages.includes(post.language),
          region: Boolean(regionCode) && post.region_code === regionCode,
          conversation: comments + shares >= 2,
          seen: Number(impressions.impression_count) >= 2,
          authorLess: Number(this.db.prepare(`
            SELECT COUNT(*) count FROM social_feedback f JOIN posts p ON p.id = f.post_id
            WHERE f.viewer_id = ? AND f.viewer_persona = ? AND f.kind = 'NOT_INTERESTED' AND p.user_id = ?
          `).get(viewerId, viewerPersona, post.user_id).count) > 0,
          disliked: totalReactions >= 5 && Math.floor((((byKind.DISLIKE ?? 0) + 1) * 1000) / (totalReactions + 5)) > 0,
          opinion: (byKind.FAKE_OPINION ?? 0) > 0,
          older: ageHours > 72,
          fresh: ageHours <= 6,
        });
      }
      return answers;
    },

    recordSocialImpressions(viewerId, viewerPersona, entries, atSeconds = Math.floor(Date.now() / 1000)) {
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 50) return null;
      viewerPersona = normalizePersona(viewerPersona);
      const ids = entries.map((entry) => Number(entry?.post_id));
      if (ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) return null;
      const upsert = this.db.prepare(`
        INSERT INTO social_impressions (viewer_id, viewer_persona, post_id, impression_count, dwell_ms, completed, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(viewer_id, viewer_persona, post_id) DO UPDATE SET
          impression_count = MIN(10000, social_impressions.impression_count + 1),
          dwell_ms = MIN(600000, MAX(social_impressions.dwell_ms, excluded.dwell_ms)),
          completed = MAX(social_impressions.completed, excluded.completed), last_seen_at = excluded.last_seen_at
      `);
      const recordedPostIds = [];
      this.db.exec("BEGIN IMMEDIATE");
      try {
        for (const entry of entries) {
          const post = this.getPostById(Number(entry.post_id));
          if (!this.canViewPost(viewerId, viewerPersona, post)) continue;
          const dwellMs = Math.max(0, Math.min(600000, Math.floor(Number(entry.dwell_ms) || 0)));
          const completed = entry.completed === true ? 1 : 0;
          upsert.run(viewerId, viewerPersona, post.id, dwellMs, completed, atSeconds, atSeconds);
          recordedPostIds.push(post.id);
        }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      return { requested: entries.length, recorded: recordedPostIds.length, recorded_post_ids: recordedPostIds };
    },
    // A public view counter may only describe real human readers. Catalog rows and the
    // repeat impressions of one device are excluded, so the number cannot be inflated by
    // the ingest and it does not grow just because one person refreshed. `impressions`
    // stays owner-facing analytics; `viewers` is the number the interface shows.
    postViewStatsBulk(postIds) {
      const ids = [...new Set((Array.isArray(postIds) ? postIds : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      const stats = new Map(ids.map((id) => [id, { viewers: 0, impressions: 0, completed: 0 }]));
      if (!ids.length) return stats;
      const rows = this.db.prepare(`
        SELECT si.post_id, COUNT(*) viewers, COALESCE(SUM(si.impression_count), 0) impressions,
               COALESCE(SUM(si.completed), 0) completed
        FROM social_impressions si JOIN users viewer ON viewer.id = si.viewer_id
        WHERE si.post_id IN (${ids.map(() => "?").join(",")}) AND viewer.traffic_class = 'HUMAN_ORGANIC'
        GROUP BY si.post_id
      `).all(...ids);
      for (const row of rows) {
        stats.set(Number(row.post_id), {
          viewers: Number(row.viewers), impressions: Number(row.impressions), completed: Number(row.completed),
        });
      }
      return stats;
    },
    postViewStats(postId) {
      return this.postViewStatsBulk([postId]).get(Number(postId)) ?? { viewers: 0, impressions: 0, completed: 0 };
    },
    commentViewStatsBulk(commentIds) {
      const ids = [...new Set((Array.isArray(commentIds) ? commentIds : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      const stats = new Map(ids.map((id) => [id, { viewers: 0, impressions: 0 }]));
      if (!ids.length) return stats;
      const rows = this.db.prepare(`
        SELECT ci.comment_id, COUNT(*) viewers, COALESCE(SUM(ci.impression_count), 0) impressions
        FROM comment_impressions ci JOIN users viewer ON viewer.id = ci.viewer_id
        WHERE ci.comment_id IN (${ids.map(() => "?").join(",")}) AND viewer.traffic_class = 'HUMAN_ORGANIC'
        GROUP BY ci.comment_id
      `).all(...ids);
      for (const row of rows) stats.set(Number(row.comment_id), { viewers: Number(row.viewers), impressions: Number(row.impressions) });
      return stats;
    },
    recordCommentImpressions(viewerId, viewerPersona, entries, atSeconds = Math.floor(Date.now() / 1000)) {
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100) return null;
      viewerPersona = normalizePersona(viewerPersona);
      const ids = entries.map((entry) => Number(entry?.comment_id));
      if (ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) return null;
      const upsert = this.db.prepare(`
        INSERT INTO comment_impressions (comment_id, viewer_id, viewer_persona, impression_count, dwell_ms, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(comment_id, viewer_id, viewer_persona) DO UPDATE SET
          impression_count = MIN(10000, comment_impressions.impression_count + 1),
          dwell_ms = MIN(600000, MAX(comment_impressions.dwell_ms, excluded.dwell_ms)),
          last_seen_at = excluded.last_seen_at
      `);
      const recorded = [];
      this.db.exec("BEGIN IMMEDIATE");
      try {
        for (const entry of entries) {
          const comment = this.getCommentById(Number(entry.comment_id));
          if (!comment || comment.status !== "active") continue;
          if (!this.canViewPost(viewerId, viewerPersona, this.getPostById(comment.post_id))) continue;
          const dwellMs = Math.max(0, Math.min(600000, Math.floor(Number(entry.dwell_ms) || 0)));
          upsert.run(comment.id, viewerId, viewerPersona, dwellMs, atSeconds, atSeconds);
          recorded.push(comment.id);
        }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      return { requested: entries.length, recorded: recorded.length, recorded_comment_ids: recorded };
    },
    setSocialFeedback(viewerId, viewerPersona, postId, kind, active = true) {
      if (kind !== "NOT_INTERESTED") return false;
      const post = this.getPostById(postId);
      if (!this.canViewPost(viewerId, viewerPersona, post)) return false;
      if (active) this.db.prepare(`INSERT OR IGNORE INTO social_feedback (viewer_id, viewer_persona, post_id, kind) VALUES (?, ?, ?, ?)`)
        .run(viewerId, viewerPersona, postId, kind);
      else this.db.prepare(`DELETE FROM social_feedback WHERE viewer_id = ? AND viewer_persona = ? AND post_id = ? AND kind = ?`)
        .run(viewerId, viewerPersona, postId, kind);
      return true;
    },
    // Mute keeps the follow relationship intact; it only removes the account (or, later, a
    // single topic) from this viewer's candidates.
    setProfileMute(ownerId, ownerPersona, mutedId, active = true, { scope = "account", topic = "" } = {}) {
      ownerPersona = normalizePersona(ownerPersona);
      const normalizedScope = scope === "topic" ? "topic" : "account";
      const normalizedTopic = normalizedScope === "topic" ? String(topic ?? "").trim().toLowerCase().slice(0, 40) : "";
      if (normalizedScope === "topic" && !/^[a-z0-9_]{2,40}$/.test(normalizedTopic)) return null;
      if (active) {
        this.db.prepare(`INSERT OR IGNORE INTO profile_mutes (owner_id, owner_persona, muted_id, scope, topic) VALUES (?, ?, ?, ?, ?)`)
          .run(ownerId, ownerPersona, mutedId, normalizedScope, normalizedTopic);
      } else {
        this.db.prepare(`DELETE FROM profile_mutes WHERE owner_id = ? AND owner_persona = ? AND muted_id = ? AND scope = ? AND topic = ?`)
          .run(ownerId, ownerPersona, mutedId, normalizedScope, normalizedTopic);
      }
      return { muted: this.isMuted(ownerId, ownerPersona, mutedId), scope: normalizedScope, topic: normalizedTopic };
    },
    isMuted(ownerId, ownerPersona, mutedId) {
      if (!Number.isSafeInteger(Number(ownerId)) || !Number.isSafeInteger(Number(mutedId)) || Number(ownerId) === Number(mutedId)) return false;
      return Boolean(this.db.prepare(`SELECT 1 FROM profile_mutes WHERE owner_id = ? AND owner_persona = ? AND muted_id = ? AND scope = 'account' LIMIT 1`)
        .get(Number(ownerId), normalizePersona(ownerPersona), Number(mutedId)));
    },
    listMutedIds(ownerId, ownerPersona) {
      return this.db.prepare(`SELECT muted_id FROM profile_mutes WHERE owner_id = ? AND owner_persona = ? ORDER BY created_at DESC`)
        .all(Number(ownerId), normalizePersona(ownerPersona)).map((row) => Number(row.muted_id));
    },
    // A community-note request is a queue entry, never a visibility change: stored once per
    // reader, it publishes nothing and it removes nothing.
    requestCommunityNote({ subjectType = "post", subjectId, requesterId, requesterPersona = "social", reason = "" } = {}) {
      const id = Number(subjectId);
      if (!Number.isSafeInteger(id) || id < 1) return null;
      if (subjectType !== "post" && subjectType !== "comment") return null;
      this.db.prepare(`
        INSERT INTO community_note_requests (subject_type, subject_id, requester_id, requester_persona, reason)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(requester_id, requester_persona, subject_type, subject_id) DO UPDATE SET reason = excluded.reason
      `).run(subjectType, id, requesterId, normalizePersona(requesterPersona), String(reason ?? "").trim().slice(0, 300));
      return this.communityNoteRequestState(subjectType, id, requesterId, requesterPersona);
    },
    communityNoteRequestState(subjectType, subjectId, viewerId = null, viewerPersona = "social") {
      const id = Number(subjectId);
      const row = this.db.prepare(`SELECT COUNT(*) count FROM community_note_requests WHERE subject_type = ? AND subject_id = ?`).get(subjectType, id);
      const mine = viewerId == null ? false : Boolean(this.db.prepare(`
        SELECT 1 FROM community_note_requests WHERE subject_type = ? AND subject_id = ? AND requester_id = ? AND requester_persona = ? LIMIT 1
      `).get(subjectType, id, Number(viewerId), normalizePersona(viewerPersona)));
      return { requests: Number(row?.count || 0), requested_by_me: mine, status: "QUEUED", notes_published: 0 };
    },
    setSavedComment(userId, actorPersona, commentId, active = true) {
      actorPersona = normalizePersona(actorPersona);
      if (active) this.db.prepare(`INSERT OR IGNORE INTO saved_comments (user_id, actor_persona, comment_id) VALUES (?, ?, ?)`).run(userId, actorPersona, commentId);
      else this.db.prepare(`DELETE FROM saved_comments WHERE user_id = ? AND actor_persona = ? AND comment_id = ?`).run(userId, actorPersona, commentId);
      return this.hasSavedComment(userId, actorPersona, commentId);
    },
    hasSavedComment(userId, actorPersona, commentId) {
      return Boolean(this.db.prepare(`SELECT 1 FROM saved_comments WHERE user_id = ? AND actor_persona = ? AND comment_id = ? LIMIT 1`)
        .get(Number(userId), normalizePersona(actorPersona), Number(commentId)));
    },
    resetSocialRecommendations(userId, persona = "social", atSeconds = Math.floor(Date.now() / 1000)) {
      persona = normalizePersona(persona);
      this.db.prepare(`
        INSERT INTO recommendation_state (user_id, persona, version, reset_at) VALUES (?, ?, 2, ?)
        ON CONFLICT(user_id, persona) DO UPDATE SET version = recommendation_state.version + 1, reset_at = excluded.reset_at
      `).run(userId, persona, atSeconds);
      this.db.prepare(`DELETE FROM social_impressions WHERE viewer_id = ? AND viewer_persona = ?`).run(userId, persona);
      this.db.prepare(`DELETE FROM social_feedback WHERE viewer_id = ? AND viewer_persona = ?`).run(userId, persona);
      return this.db.prepare(`SELECT * FROM recommendation_state WHERE user_id = ? AND persona = ?`).get(userId, persona);
    },

    // ---- media ----
    insertMedia({ hash, ext, mime, detectedMime = null, kind, size, uploadedBy, purpose, actorPersona = "social", scanStatus, scanReason }) {
      actorPersona = normalizePersona(actorPersona);
      const existing = this.db.prepare(`SELECT * FROM media WHERE hash = ?`).get(hash);
      let mediaId;
      if (existing) {
        if (existing.ext !== ext || existing.mime !== mime || existing.scan_status !== scanStatus || existing.detected_mime !== detectedMime) return null;
        mediaId = existing.id;
      } else {
        const info = this.db.prepare(`
          INSERT INTO media (hash, ext, mime, detected_mime, kind, size, uploaded_by, purpose, scan_status, scan_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(hash, ext, mime, detectedMime, kind, size, uploadedBy, purpose, scanStatus, scanReason);
        mediaId = Number(info.lastInsertRowid);
      }
      this.db.prepare(`INSERT OR IGNORE INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, ?, ?)`)
        .run(mediaId, uploadedBy, purpose, actorPersona);
      return this.getMediaById(mediaId);
    },
    getMediaById(id) {
      return this.db.prepare(`SELECT * FROM media WHERE id = ?`).get(id) ?? null;
    },
    hasMediaUploadGrant(mediaId, userId, purpose = null, actorPersona = "social") {
      actorPersona = normalizePersona(actorPersona);
      return Boolean(purpose
        ? this.db.prepare(`SELECT 1 FROM media_upload_grants WHERE media_id = ? AND user_id = ? AND purpose = ? AND actor_persona = ?`).get(mediaId, userId, purpose, actorPersona)
        : this.db.prepare(`SELECT 1 FROM media_upload_grants WHERE media_id = ? AND user_id = ? AND actor_persona = ?`).get(mediaId, userId, actorPersona));
    },
    reclassifyLegacyMedia() {
      const legacy = this.db.prepare(`SELECT * FROM media WHERE scan_status = 'quarantined_legacy'`).all();
      const update = this.db.prepare(`UPDATE media SET detected_mime = ?, scan_status = ?, scan_reason = ? WHERE id = ? AND scan_status = 'quarantined_legacy'`);
      for (const media of legacy) {
        const inspection = inspectStoredMedia(media.hash, media.ext, media.mime);
        update.run(inspection.detectedMime, inspection.status, inspection.reason, media.id);
      }
      const grant = this.db.prepare(`INSERT OR IGNORE INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, ?, ?)`);
      for (const row of this.db.prepare(`SELECT media_id, user_id, persona FROM posts WHERE media_id IS NOT NULL`).all()) grant.run(row.media_id, row.user_id, "social_post", row.persona);
      for (const row of this.db.prepare(`SELECT audio_media_id media_id, user_id, persona FROM posts WHERE audio_media_id IS NOT NULL`).all()) grant.run(row.media_id, row.user_id, "social_audio", row.persona);
      for (const row of this.db.prepare(`SELECT media_id, user_id, persona FROM stories WHERE media_id IS NOT NULL`).all()) grant.run(row.media_id, row.user_id, "story", row.persona);
      for (const row of this.db.prepare(`SELECT attachment_media_id media_id, sender_id user_id, sender_persona persona FROM message_items WHERE attachment_media_id IS NOT NULL`).all()) grant.run(row.media_id, row.user_id, "message_attachment", row.persona);
      for (const media of this.db.prepare(`SELECT id, hash, ext FROM media`).all()) {
        const avatar = `/media/${media.hash}.${media.ext}`;
        for (const profile of this.db.prepare(`SELECT user_id, persona FROM personas WHERE avatar = ?`).all(avatar)) grant.run(media.id, profile.user_id, "profile_avatar", profile.persona);
      }
      return {
        inspected: legacy.length,
        ready: this.db.prepare(`SELECT COUNT(*) count FROM media WHERE scan_status = 'ready_local_validation'`).get().count,
        quarantined: this.db.prepare(`SELECT COUNT(*) count FROM media WHERE scan_status <> 'ready_local_validation'`).get().count,
      };
    },
    canReadMedia(mediaId, viewerId, viewerPersona = "social") {
      const media = this.getMediaById(mediaId);
      if (!media || !new Set(["ready_local_validation", "ready_client_encrypted"]).has(media.scan_status)) return false;
      if (this.hasMediaUploadGrant(mediaId, viewerId, null, viewerPersona)) return true;
      const messageConversations = this.db.prepare(`
        SELECT DISTINCT mi.conversation_id FROM message_items mi
        JOIN conversation_participants cp ON cp.conversation_id = mi.conversation_id
        JOIN conversations c ON c.id = mi.conversation_id
        WHERE mi.attachment_media_id = ? AND cp.user_id = ? AND cp.state = 'active'
          AND cp.archived_at IS NULL AND mi.id > cp.history_start_message_id
          AND mi.status <> 'expired' AND c.status = 'active'
      `).all(mediaId, viewerId);
      if (messageConversations.some((row) => !this.conversationBlockState(row.conversation_id).blocked)) return true;
      const posts = this.db.prepare(`SELECT * FROM posts WHERE (media_id = ? OR audio_media_id = ?) AND status = 'active'`).all(mediaId, mediaId);
      if (posts.some((post) => {
        const joined = this.joinPost(post);
        if (post.audio_media_id === mediaId && joined.creator_studio?.integrity !== "VERIFIED") return false;
        return this.canViewPost(viewerId, viewerPersona, joined);
      })) return true;
      const stories = this.db.prepare(`SELECT id FROM stories
        WHERE media_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > unixepoch())`).all(mediaId);
      if (stories.some(({ id }) => {
        const story = this.getStoryById(id);
        return story && this.canViewPost(viewerId, viewerPersona, { ...story, kind: "story" });
      })) return true;
      const highlightedStories = this.db.prepare(`SELECT DISTINCT s.id FROM stories s
        JOIN story_highlight_items shi ON shi.story_id = s.id
        JOIN story_highlights sh ON sh.id = shi.highlight_id AND sh.owner_id = s.user_id AND sh.persona = s.persona
        WHERE s.media_id = ?`).all(mediaId);
      if (highlightedStories.some(({ id }) => {
        const story = this.getStoryById(id);
        return story && this.canViewHighlightedStory(viewerId, viewerPersona, story);
      })) return true;
      const watchVideo = this.db.prepare(`SELECT id FROM watch_videos WHERE media_id = ?`).get(mediaId);
      if (watchVideo && this.getWatchVideo(watchVideo.id, viewerId)) return true;
      const musicTrack = this.db.prepare(`SELECT id FROM music_tracks WHERE media_id = ?`).get(mediaId);
      if (musicTrack && this.getMusicTrack(musicTrack.id, viewerId)) return true;
      const url = `/media/${media.hash}.${media.ext}`;
      const profiles = this.db.prepare(`SELECT user_id, persona, visibility FROM personas WHERE avatar = ? OR cover = ?`).all(url, url);
      return profiles.some((profile) => this.canViewPost(viewerId, viewerPersona, { ...profile, status: "active", visibility: profile.visibility, kind: "avatar" }));
    },

    // A completed encrypted upload is intentionally usable only by its owner
    // until a message atomically claims it. Unclaimed ciphertext is retained
    // for one bounded retry window, then removed by an explicit maintenance
    // run. Dry-run is the default so normal app startup can never delete data.
    purgeOrphanEncryptedAttachments({
      now = Math.floor(Date.now() / 1000),
      retentionSeconds = E2EE_ORPHAN_RETENTION_SECONDS,
      limit = 100,
      dryRun = true,
      mediaPurger = purgeStoredMedia,
    } = {}) {
      now = Number(now);
      retentionSeconds = Number(retentionSeconds);
      limit = Number(limit);
      if (!Number.isSafeInteger(now) || now < 1 || !Number.isSafeInteger(retentionSeconds) || retentionSeconds < 3600 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("encrypted attachment purge policy invalid");
      }
      const cutoff = now - retentionSeconds;
      const candidates = this.db.prepare(`
        SELECT m.id, m.hash, m.ext, m.size, m.created_at
        FROM media m
        WHERE m.scan_status = 'ready_client_encrypted'
          AND m.mime = 'application/vnd.nexus.e2ee'
          AND m.kind = 'encrypted'
          AND m.created_at <= ?
          AND EXISTS (
            SELECT 1 FROM media_upload_grants mug
            WHERE mug.media_id = m.id AND mug.purpose = 'message_e2ee_attachment'
          )
          AND NOT EXISTS (
            SELECT 1 FROM message_items mi WHERE mi.attachment_media_id = m.id
          )
        ORDER BY m.created_at, m.id
        LIMIT ?
      `).all(cutoff, limit);
      if (dryRun) return {
        dry_run: true,
        retention_seconds: retentionSeconds,
        cutoff,
        eligible: candidates.length,
        eligible_bytes: candidates.reduce((sum, row) => sum + Number(row.size), 0),
        purged: 0,
        receipts: [],
      };

      const receipts = [];
      for (const candidate of candidates) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
          const current = this.db.prepare(`
            SELECT m.id, m.hash, m.ext, m.size, m.created_at
            FROM media m
            WHERE m.id = ? AND m.created_at <= ?
              AND m.scan_status = 'ready_client_encrypted'
              AND m.mime = 'application/vnd.nexus.e2ee' AND m.kind = 'encrypted'
              AND EXISTS (
                SELECT 1 FROM media_upload_grants mug
                WHERE mug.media_id = m.id AND mug.purpose = 'message_e2ee_attachment'
              )
              AND NOT EXISTS (
                SELECT 1 FROM message_items mi WHERE mi.attachment_media_id = m.id
              )
          `).get(candidate.id, cutoff);
          if (!current) {
            this.db.exec("COMMIT");
            continue;
          }
          const fileResult = mediaPurger(current.hash, current.ext);
          const receiptHash = sha256Hex(JSON.stringify({
            schema_version: 1,
            media_hash: current.hash,
            media_ext: current.ext,
            media_size: Number(current.size),
            reason: "unclaimed_e2ee_attachment_retention_expired",
            purged_at: now,
          }));
          this.db.prepare(`
            INSERT OR IGNORE INTO media_purge_receipts
              (media_hash, media_ext, media_size, reason, purged_at, receipt_hash)
            VALUES (?, ?, ?, 'unclaimed_e2ee_attachment_retention_expired', ?, ?)
          `).run(current.hash, current.ext, current.size, now, receiptHash);
          const removed = this.db.prepare(`DELETE FROM media WHERE id = ?`).run(current.id);
          if (removed.changes !== 1) throw new Error("encrypted attachment purge lost ownership lock");
          this.db.exec("COMMIT");
          receipts.push({ receipt_hash: receiptHash, bytes: Number(current.size), file_deleted: Number(fileResult?.deleted || 0), already_missing: Boolean(fileResult?.already_missing) });
        } catch (error) {
          this.db.exec("ROLLBACK");
          throw error;
        }
      }
      return {
        dry_run: false,
        retention_seconds: retentionSeconds,
        cutoff,
        eligible: candidates.length,
        eligible_bytes: candidates.reduce((sum, row) => sum + Number(row.size), 0),
        purged: receipts.length,
        receipts,
      };
    },

    // ---- follows ----
    setFollow(followerId, followeeId, persona, active) {
      persona = normalizePersona(persona);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const targetProfile = this.getPersona(followeeId, persona);
        if (!targetProfile || Number(followerId) === Number(followeeId)) throw new Error("SOCIAL_FOLLOW_TARGET_INVALID");
        if (active && this.isBlockedBetween(followerId, persona, followeeId, persona)) throw new Error("SOCIAL_FOLLOW_BLOCKED");
        if (active) {
          this.db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, persona) VALUES (?, ?, ?)`)
            .run(followerId, followeeId, persona);
          this.db.prepare(`UPDATE follow_requests SET status = 'accepted', decided_at = unixepoch(), updated_at = unixepoch()
            WHERE requester_id = ? AND target_id = ? AND persona = ? AND status = 'pending'`)
            .run(followerId, followeeId, persona);
        } else {
          this.db.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ? AND persona = ?`)
            .run(followerId, followeeId, persona);
          this.db.prepare(`UPDATE follow_requests SET status = 'cancelled', decided_at = unixepoch(), updated_at = unixepoch()
            WHERE requester_id = ? AND target_id = ? AND persona = ? AND status IN ('pending','accepted')`)
            .run(followerId, followeeId, persona);
        }
        this.db.exec("COMMIT");
        return active;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    pendingFollowRequest(requesterId, targetId, persona = "social") {
      return this.db.prepare(`SELECT * FROM follow_requests
        WHERE requester_id = ? AND target_id = ? AND persona = ? AND status = 'pending'`)
        .get(requesterId, targetId, normalizePersona(persona)) ?? null;
    },
    requestFollow(requesterId, targetId, persona = "social") {
      persona = normalizePersona(persona);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const targetProfile = this.getPersona(targetId, persona);
        if (!targetProfile || targetProfile.visibility !== "private" || Number(requesterId) === Number(targetId)) throw new Error("SOCIAL_FOLLOW_TARGET_INVALID");
        if (this.isBlockedBetween(requesterId, persona, targetId, persona)) throw new Error("SOCIAL_FOLLOW_BLOCKED");
        if (this.isFollowing(requesterId, targetId, persona)) {
          const accepted = this.db.prepare(`SELECT * FROM follow_requests WHERE requester_id = ? AND target_id = ? AND persona = ?`).get(requesterId, targetId, persona);
          this.db.exec("COMMIT");
          return { ...(accepted || { requester_id: requesterId, target_id: targetId, persona }), status: "accepted", already_following: true };
        }
        this.db.prepare(`INSERT INTO follow_requests (requester_id, target_id, persona, status)
          VALUES (?, ?, ?, 'pending')
          ON CONFLICT(requester_id, target_id, persona) DO UPDATE SET
            status = CASE WHEN follow_requests.status = 'accepted' THEN 'accepted' ELSE 'pending' END,
            decided_at = CASE WHEN follow_requests.status = 'accepted' THEN follow_requests.decided_at ELSE NULL END,
            updated_at = unixepoch()`)
          .run(requesterId, targetId, persona);
        const request = this.db.prepare(`SELECT * FROM follow_requests WHERE requester_id = ? AND target_id = ? AND persona = ?`).get(requesterId, targetId, persona);
        if (request.status === "accepted") {
          this.db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, persona) VALUES (?, ?, ?)`)
            .run(requesterId, targetId, persona);
        }
        this.db.exec("COMMIT");
        return { ...request, already_following: request.status === "accepted" };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    cancelFollowRequest(requesterId, targetId, persona = "social") {
      const result = this.db.prepare(`UPDATE follow_requests
        SET status = 'cancelled', decided_at = unixepoch(), updated_at = unixepoch()
        WHERE requester_id = ? AND target_id = ? AND persona = ? AND status = 'pending'`)
        .run(requesterId, targetId, normalizePersona(persona));
      return result.changes === 1;
    },
    listFollowRequests(userId, { persona = "social", direction = "incoming", limit = 60 } = {}) {
      persona = normalizePersona(persona);
      const bounded = Math.max(1, Math.min(Number(limit) || 60, 100));
      const incoming = direction !== "outgoing";
      const rows = incoming
        ? this.db.prepare(`SELECT fr.*, u.handle, p.name, p.avatar
          FROM follow_requests fr JOIN users u ON u.id = fr.requester_id
          JOIN personas p ON p.user_id = u.id AND p.persona = fr.persona
          WHERE fr.target_id = ? AND fr.persona = ? AND fr.status = 'pending'
          ORDER BY fr.created_at DESC, fr.id DESC LIMIT ?`).all(userId, persona, bounded)
        : this.db.prepare(`SELECT fr.*, u.handle, p.name, p.avatar
          FROM follow_requests fr JOIN users u ON u.id = fr.target_id
          JOIN personas p ON p.user_id = u.id AND p.persona = fr.persona
          WHERE fr.requester_id = ? AND fr.persona = ? AND fr.status = 'pending'
          ORDER BY fr.created_at DESC, fr.id DESC LIMIT ?`).all(userId, persona, bounded);
      return rows.filter((row) => !this.isBlockedBetween(userId, persona, incoming ? row.requester_id : row.target_id, persona));
    },
    decideFollowRequest({ requestId, targetId, persona = "social", decision }) {
      persona = normalizePersona(persona);
      if (!new Set(["accept", "decline"]).has(decision)) throw new Error("SOCIAL_FOLLOW_DECISION_INVALID");
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const request = this.db.prepare(`SELECT * FROM follow_requests WHERE id = ? AND target_id = ? AND persona = ? AND status = 'pending'`)
          .get(requestId, targetId, persona);
        if (!request || this.isBlockedBetween(request.requester_id, persona, targetId, persona)) throw new Error("SOCIAL_FOLLOW_REQUEST_NOT_FOUND");
        const nextStatus = decision === "accept" ? "accepted" : "declined";
        const changed = this.db.prepare(`UPDATE follow_requests SET status = ?, decided_at = unixepoch(), updated_at = unixepoch()
          WHERE id = ? AND target_id = ? AND persona = ? AND status = 'pending'`)
          .run(nextStatus, requestId, targetId, persona).changes;
        if (changed !== 1) throw new Error("SOCIAL_FOLLOW_REQUEST_CONFLICT");
        if (decision === "accept") this.db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, persona) VALUES (?, ?, ?)`)
          .run(request.requester_id, targetId, persona);
        this.db.exec("COMMIT");
        return { ...request, status: nextStatus };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    isFollowing(followerId, followeeId, persona) {
      persona = normalizePersona(persona);
      return Boolean(this.db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ? AND persona = ?`).get(followerId, followeeId, persona));
    },
    followCounts(userId, persona) {
      persona = normalizePersona(persona);
      const following = this.db.prepare(`SELECT COUNT(*) c FROM follows WHERE follower_id = ? AND persona = ?`).get(userId, persona).c;
      const followers = this.db.prepare(`SELECT COUNT(*) c FROM follows WHERE followee_id = ? AND persona = ?`).get(userId, persona).c;
      return { following: Number(following), followers: Number(followers) };
    },
    listSocialRelations(userId, { kind = "followers", persona = "social", limit = 60, offset = 0 } = {}) {
      persona = normalizePersona(persona);
      const bounded = Math.max(1, Math.min(Number(limit) || 60, 100));
      const boundedOffset = Math.max(0, Math.min(Number(offset) || 0, 400));
      const relation = new Set(["followers", "following"]).has(kind) ? kind : "followers";
      const rows = relation === "following"
        ? this.db.prepare(`
          SELECT u.id user_id, u.handle, p.name, p.bio, p.avatar, u.traffic_class
          FROM follows f JOIN users u ON u.id = f.followee_id
          JOIN personas p ON p.user_id = u.id AND p.persona = f.persona
          WHERE f.follower_id = ? AND f.persona = ?
          ORDER BY p.name COLLATE NOCASE, u.handle LIMIT ?
        `).all(userId, persona, boundedOffset + bounded + 1)
        : this.db.prepare(`
          SELECT u.id user_id, u.handle, p.name, p.bio, p.avatar, u.traffic_class
          FROM follows f JOIN users u ON u.id = f.follower_id
          JOIN personas p ON p.user_id = u.id AND p.persona = f.persona
          WHERE f.followee_id = ? AND f.persona = ?
          ORDER BY p.name COLLATE NOCASE, u.handle LIMIT ?
        `).all(userId, persona, boundedOffset + bounded + 1);
      const visible = rows
        .filter((person) => person.user_id !== userId && !this.isBlockedBetween(userId, persona, person.user_id, persona))
        .slice(boundedOffset, boundedOffset + bounded + 1)
        .map((person) => ({
          ...person,
          relation,
          following_me: this.isFollowing(userId, person.user_id, persona),
          counts: this.followCounts(person.user_id, persona),
          earned_sigil: this.sigilProgress(person.user_id, persona),
        }));
      return { people: visible.slice(0, bounded), hasMore: visible.length > bounded, offset: boundedOffset, limit: bounded };
    },
    hasActivePrivateAccess(viewerId, ownerId, persona = "social", atSeconds = Math.floor(Date.now() / 1000)) {
      persona = normalizePersona(persona);
      return Boolean(this.db.prepare(`
        SELECT 1 FROM private_profile_access_receipts
        WHERE viewer_id = ? AND owner_id = ? AND persona = ?
          AND starts_at <= ? AND expires_at > ? AND status = 'settled'
        LIMIT 1
      `).get(viewerId, ownerId, persona, atSeconds, atSeconds));
    },
    privateAccessQuote({ viewerId, ownerId, persona = "social", durationDays = null, term = null, revealVisitor = false }) {
      persona = normalizePersona(persona);
      const owner = this.getUserById(ownerId);
      const profile = owner ? this.getPersona(ownerId, persona) : null;
      if (!owner || !profile || ownerId === viewerId) return null;
      if (!profile.private_access_enabled || profile.visibility !== "private") return null;
      if (this.isBlockedBetween(viewerId, persona, ownerId, persona)) return null;
      const normalizedTerm = term === null ? "custom" : String(term);
      if (!new Set(["custom", "24h", "1month", "forever"]).has(normalizedTerm)) return null;
      const requestedDays = normalizedTerm === "24h" ? 1 : normalizedTerm === "1month" ? 30 : normalizedTerm === "forever" ? 0 : (durationDays === null ? Number(profile.private_access_duration_days || 15) : Number(durationDays));
      if (!Number.isSafeInteger(requestedDays) || requestedDays < 0 || requestedDays > 365 || (normalizedTerm !== "forever" && requestedDays < 1)) return null;
      const days = requestedDays;
      const pricePerDayCents = Math.max(100, Number(profile.private_access_price_cents || 100));
      const multiplier = revealVisitor ? 2 : 1;
      const baseAmountCents = normalizedTerm === "1month" ? Math.max(100, Number(profile.private_access_month_price_cents || pricePerDayCents * 30))
        : normalizedTerm === "forever" ? Math.max(100, Number(profile.private_access_forever_price_cents || pricePerDayCents * 365))
        : pricePerDayCents * days;
      const amountCents = baseAmountCents * multiplier;
      const ownerShareCents = Math.floor(amountCents * 90 / 100);
      const nexusShareCents = amountCents - ownerShareCents;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const active = this.db.prepare(`
        SELECT * FROM private_profile_access_receipts
        WHERE viewer_id = ? AND owner_id = ? AND persona = ?
          AND starts_at <= ? AND expires_at > ? AND status = 'settled'
        ORDER BY expires_at DESC LIMIT 1
      `).get(viewerId, ownerId, persona, nowSeconds, nowSeconds) ?? null;
      return {
        owner_id: ownerId,
        owner_handle: owner.handle,
        persona,
        access_kind: revealVisitor ? "VISITOR_REVEAL_RECIPROCAL" : "PRIVATE_CONTENT_ACCESS",
        price_per_day_cents: pricePerDayCents,
        reveal_multiplier: multiplier,
        amount_cents: amountCents,
        currency: profile.private_access_currency || "USD",
        duration_days: days,
        term: normalizedTerm,
        owner_share_cents: ownerShareCents,
        nexus_share_cents: nexusShareCents,
        privacy_mode: "OWNER_ANONYMOUS",
        reciprocal_access: revealVisitor,
        settlement_status: "REAL_PAYMENT_DISABLED_IN_DEMO",
        active_receipt: active,
      };
    },
    createPrivateAccessDemoReceipt({ viewerId, ownerId, persona = "social", durationDays = null, term = null, revealVisitor = false }) {
      persona = normalizePersona(persona);
      const quote = this.privateAccessQuote({ viewerId, ownerId, persona, durationDays, term, revealVisitor });
      if (!quote) return null;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const existingPreview = this.db.prepare(`
        SELECT * FROM private_profile_access_receipts
        WHERE viewer_id = ? AND owner_id = ? AND persona = ?
          AND amount_cents = ? AND duration_days = ? AND status = 'demo_unpaid'
          AND starts_at <= ? AND expires_at > ?
        ORDER BY id DESC LIMIT 1
      `).get(viewerId, ownerId, persona, quote.amount_cents, quote.duration_days, nowSeconds, nowSeconds);
      if (existingPreview) return { quote, receipt: existingPreview, reused: true };
      const startsAt = Math.floor(Date.now() / 1000);
      const expiresAt = quote.term === "forever" ? 253402300799 : startsAt + quote.duration_days * 24 * 60 * 60;
      const receiptHash = createHash("sha256").update(JSON.stringify({
        viewerId,
        ownerId,
        persona,
        accessKind: quote.access_kind,
        amountCents: quote.amount_cents,
        currency: quote.currency,
        durationDays: quote.duration_days,
        term: quote.term,
        ownerShareCents: quote.owner_share_cents,
        nexusShareCents: quote.nexus_share_cents,
        startsAt,
        expiresAt,
        privacyMode: quote.privacy_mode,
        status: "demo_unpaid",
      })).digest("hex");
      const info = this.db.prepare(`
        INSERT INTO private_profile_access_receipts
          (viewer_id, owner_id, persona, amount_cents, currency, duration_days, owner_share_cents, nexus_share_cents, starts_at, expires_at, status, privacy_mode, receipt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo_unpaid', 'OWNER_ANONYMOUS', ?)
      `).run(
        viewerId,
        ownerId,
        persona,
        quote.amount_cents,
        quote.currency,
        quote.duration_days,
        quote.owner_share_cents,
        quote.nexus_share_cents,
        startsAt,
        expiresAt,
        receiptHash,
      );
      const receipt = this.db.prepare(`SELECT * FROM private_profile_access_receipts WHERE id = ?`).get(Number(info.lastInsertRowid));
      return { quote, receipt, reused: false };
    },
    listPrivateContentForViewer(viewerId, { persona = "social", limit = 30 } = {}) {
      persona = normalizePersona(persona);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const bounded = Math.max(1, Math.min(Number(limit) || 30, 60));
      const receipts = this.db.prepare(`
        SELECT r.*, u.handle, p.name, p.avatar
        FROM private_profile_access_receipts r
        JOIN users u ON u.id = r.owner_id
        JOIN personas p ON p.user_id = r.owner_id AND p.persona = r.persona
        WHERE r.viewer_id = ? AND r.persona = ? AND r.expires_at > ?
        ORDER BY r.expires_at DESC, r.id DESC LIMIT ?
      `).all(viewerId, persona, nowSeconds, bounded)
        .filter((receipt) => !this.isBlockedBetween(viewerId, persona, receipt.owner_id, persona))
        .filter((receipt) => this.hasActivePrivateAccess(viewerId, receipt.owner_id, persona, nowSeconds));
      const posts = [];
      for (const receipt of receipts) {
        const ownerPosts = this.db.prepare(`
          SELECT * FROM posts
          WHERE user_id = ? AND persona = ? AND status = 'active'
          ORDER BY created_at DESC, id DESC LIMIT 6
        `).all(receipt.owner_id, persona).map((row) => this.joinPost(row))
          .filter((post) => this.canViewPost(viewerId, persona, post));
        posts.push(...ownerPosts.map((post) => ({
          ...post,
          private_access: {
            receipt_id: receipt.id,
            expires_at: receipt.expires_at,
            status: receipt.status,
            privacy_mode: receipt.privacy_mode,
          },
        })));
      }
      return { receipts, posts: posts.slice(0, bounded) };
    },
    sigilProgress(userId, persona) {
      persona = normalizePersona(persona);
      const profile = this.getPersona(userId, persona) ?? { profile_kind: "person", business_verification_status: "unverified" };
      const totalFollowers = Number(this.db.prepare(`SELECT COUNT(*) c FROM follows WHERE followee_id = ? AND persona = ?`).get(userId, persona).c);
      const qualifiedFollowers = Number(this.db.prepare(`
        SELECT COUNT(*) c FROM follows f JOIN users follower ON follower.id = f.follower_id
        WHERE f.followee_id = ? AND f.persona = ? AND follower.traffic_class = 'HUMAN_ORGANIC'
      `).get(userId, persona).c);
      const family = profile.profile_kind === "business" ? "business" : "creator";
      const businessVerified = family !== "business" || profile.business_verification_status === "verified";
      const achieved = businessVerified ? SIGIL_TIERS.filter((tier) => qualifiedFollowers >= tier.threshold).at(-1) ?? null : null;
      const next = SIGIL_TIERS.find((tier) => qualifiedFollowers < tier.threshold) ?? null;
      const previousThreshold = achieved?.threshold ?? 0;
      const range = next ? Math.max(1, next.threshold - previousThreshold) : 1;
      const progressBps = next ? Math.max(0, Math.min(10_000, Math.floor((qualifiedFollowers - previousThreshold) * 10_000 / range))) : 10_000;
      return {
        family,
        icon: family === "business" ? "$" : "★",
        level: achieved?.level ?? 0,
        tier_name: achieved?.name ?? "Locked",
        qualified_followers: qualifiedFollowers,
        total_followers: totalFollowers,
        next_threshold: next?.threshold ?? null,
        progress_bps: progressBps,
        earned: Boolean(achieved),
        eligibility: businessVerified ? "ELIGIBLE" : "BUSINESS_VERIFICATION_REQUIRED",
        policy_version: "NEXUS_SIGIL_V1_LOCAL",
        qualification: "UNIQUE_HUMAN_ORGANIC_FOLLOWERS",
        production_fraud_gate: false,
      };
    },

    // ---- likes / comments ----
    setLike(userId, postId, kind = "like", active = true) {
      this.setPostReaction(userId, "social", postId, String(kind).toUpperCase(), active);
      return { likes: this.likeCount(postId) };
    },
    hasLiked(userId, postId) {
      return Boolean(this.db.prepare(`SELECT 1 FROM post_reactions WHERE user_id = ? AND actor_persona = 'social' AND post_id = ? AND kind = 'LIKE'`).get(userId, postId));
    },
    likeCount(postId) {
      return Number(this.db.prepare(`SELECT COUNT(*) c FROM post_reactions pr JOIN users actor ON actor.id = pr.user_id
        WHERE pr.post_id = ? AND pr.actor_persona = 'social' AND pr.kind = 'LIKE' AND actor.traffic_class = 'HUMAN_ORGANIC'`).get(postId).c);
    },
    setPostReaction(userId, actorPersona, postId, kind, active = true) {
      const normalizedKind = String(kind ?? "").toUpperCase();
      if (!SOCIAL_REACTION_SET.has(normalizedKind)) throw new Error("SOCIAL_REACTION_INVALID");
      actorPersona = normalizePersona(actorPersona);
      const post = this.getPostById(postId);
      if (!post || post.persona !== actorPersona || !this.canViewPost(userId, actorPersona, post)) throw new Error("SOCIAL_REACTION_TARGET_INVALID");
      if (active) {
        this.db.prepare(`
          INSERT INTO post_reactions (user_id, actor_persona, post_id, kind)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, actor_persona, post_id)
          DO UPDATE SET kind = excluded.kind, updated_at = unixepoch()
        `).run(userId, actorPersona, postId, normalizedKind);
      } else {
        this.db.prepare(`DELETE FROM post_reactions WHERE user_id = ? AND actor_persona = ? AND post_id = ?`).run(userId, actorPersona, postId);
      }
      return this.postReactionSummary(postId, userId, actorPersona);
    },
    postReactionSummary(postId, viewerId = null, viewerPersona = "social") {
      const normalizedViewerPersona = normalizePersona(viewerPersona);
      const rows = viewerId
        ? this.db.prepare(`SELECT pr.kind, COUNT(*) AS count FROM post_reactions pr
          JOIN posts p ON p.id = pr.post_id JOIN users actor ON actor.id = pr.user_id
          WHERE pr.post_id = ? AND pr.actor_persona = p.persona AND pr.kind <> 'DISLIKE'
            AND actor.traffic_class = 'HUMAN_ORGANIC' AND NOT EXISTS (
            SELECT 1 FROM profile_blocks pb
            WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = pr.user_id)
               OR (pb.blocker_id = pr.user_id AND pb.blocker_persona = pr.actor_persona AND pb.blocked_id = ?)
          ) GROUP BY pr.kind`).all(postId, viewerId, normalizedViewerPersona, viewerId)
        : this.db.prepare(`SELECT pr.kind, COUNT(*) AS count FROM post_reactions pr
          JOIN posts p ON p.id = pr.post_id JOIN users actor ON actor.id = pr.user_id
          WHERE pr.post_id = ? AND pr.actor_persona = p.persona AND pr.kind <> 'DISLIKE'
            AND actor.traffic_class = 'HUMAN_ORGANIC' GROUP BY pr.kind`).all(postId);
      const counts = Object.fromEntries(rows.map((row) => [row.kind, Number(row.count)]));
      const mine = viewerId ? this.db.prepare(`SELECT kind FROM post_reactions WHERE user_id = ? AND actor_persona = ? AND post_id = ?`).get(viewerId, normalizedViewerPersona, postId) : null;
      return { counts, viewer_reaction: mine?.kind ?? null, private_dislike_by_me: mine?.kind === "DISLIKE" };
    },
    privateDislikeCount(postId) {
      return Number(this.db.prepare(`SELECT COUNT(*) AS count FROM post_reactions pr
        JOIN posts p ON p.id = pr.post_id JOIN users actor ON actor.id = pr.user_id
        WHERE pr.post_id = ? AND pr.actor_persona = p.persona AND pr.kind = 'DISLIKE'
          AND actor.traffic_class = 'HUMAN_ORGANIC'`).get(postId).count);
    },
    addComment(userId, postId, body) {
      const commitment = sha256Hex(JSON.stringify({ userId, postId, body }));
      const info = this.db.prepare(`INSERT INTO comments (post_id, user_id, actor_persona, body, content_commitment) VALUES (?, ?, 'social', ?, ?)`).run(postId, userId, body, commitment);
      return this.getCommentById(Number(info.lastInsertRowid));
    },
    addSocialComment({ userId, actorPersona = "social", postId, body, parentId = null }) {
      const parent = parentId ? this.getCommentById(parentId) : null;
      if (parentId && (!parent || parent.post_id !== postId)) throw new Error("SOCIAL_COMMENT_PARENT_INVALID");
      const commitment = sha256Hex(JSON.stringify({ userId, actorPersona, postId, parentId, body }));
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const info = this.db.prepare(`
          INSERT INTO comments (post_id, user_id, actor_persona, parent_id, body, content_commitment, version)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(postId, userId, normalizePersona(actorPersona), parentId, body, commitment);
        const id = Number(info.lastInsertRowid);
        this.db.prepare(`INSERT INTO comment_versions (comment_id, version, body, content_commitment) VALUES (?, 1, ?, ?)`)
          .run(id, body, commitment);
        this.db.exec("COMMIT");
        return this.getCommentById(id);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    getCommentById(id) {
      return this.db.prepare(`SELECT * FROM comments WHERE id = ?`).get(id) ?? null;
    },
    listComments(postId, options = 100) {
      const config = typeof options === "number" ? { limit: options } : (options ?? {});
      const limit = Math.max(1, Math.min(Number(config.limit) || 100, 1000));
      const rows = this.db.prepare(`
        SELECT c.*, u.handle, COALESCE(p.name, u.display_name) AS display_name, p.avatar
        FROM comments c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN personas p ON p.user_id = c.user_id AND p.persona = c.actor_persona
        WHERE c.post_id = ? AND c.status IN ('active','withdrawn')
        ORDER BY c.created_at ASC, c.id ASC LIMIT ?
      `).all(postId, limit);
      const visible = config.viewerId == null ? rows : rows.filter((comment) => comment.status === "withdrawn"
        || (!this.isBlockedBetween(Number(config.viewerId), normalizePersona(config.viewerPersona), comment.user_id, comment.actor_persona)
          && !this.isMuted(Number(config.viewerId), normalizePersona(config.viewerPersona), comment.user_id)));
      const replyCounts = new Map();
      const reactionCounts = new Map();
      for (const row of visible) {
        if (row.parent_id) replyCounts.set(Number(row.parent_id), (replyCounts.get(Number(row.parent_id)) ?? 0) + 1);
        const count = config.viewerId == null
          ? Number(this.db.prepare(`SELECT COUNT(*) count FROM comment_reactions WHERE comment_id = ?`).get(row.id).count)
          : Number(this.db.prepare(`SELECT COUNT(*) count FROM comment_reactions cr
            WHERE cr.comment_id = ? AND NOT EXISTS (
              SELECT 1 FROM profile_blocks pb
              WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = cr.user_id)
                 OR (pb.blocker_id = cr.user_id AND pb.blocker_persona = cr.actor_persona AND pb.blocked_id = ?)
            )`).get(row.id, Number(config.viewerId), normalizePersona(config.viewerPersona), Number(config.viewerId)).count);
        reactionCounts.set(Number(row.id), count);
      }
      const mapped = visible.map((comment) => ({
        ...comment,
        body: comment.status === "withdrawn" ? "" : comment.body,
        reply_count: replyCounts.get(Number(comment.id)) ?? 0,
        reaction_count: reactionCounts.get(Number(comment.id)) ?? 0,
      }));
      const sort = new Set(["relevant", "newest", "oldest"]).has(config.sort) ? config.sort : "relevant";
      if (sort === "newest") return mapped.sort((a, b) => Number(b.created_at) - Number(a.created_at) || Number(b.id) - Number(a.id));
      if (sort === "oldest") return mapped.sort((a, b) => Number(a.created_at) - Number(b.created_at) || Number(a.id) - Number(b.id));
      return mapped.sort((a, b) => Number(b.pinned_at || 0) - Number(a.pinned_at || 0)
        || Number(b.reaction_count) + Number(b.reply_count) * 2 - Number(a.reaction_count) - Number(a.reply_count) * 2
        || Number(b.created_at) - Number(a.created_at));
    },
    listCommentPage(postId, { viewerId, viewerPersona = "social", sort = "relevant", offset = 0, rootLimit = 20 } = {}) {
      const boundedOffset = Math.max(0, Math.min(Number(offset) || 0, 2000));
      const boundedRoots = Math.max(1, Math.min(Number(rootLimit) || 20, 20));
      const visible = this.listComments(postId, { viewerId, viewerPersona, sort, limit: 1000 });
      const visibleById = new Map(visible.map((comment) => [Number(comment.id), comment]));
      const connectedToVisibleRoot = (comment) => {
        let current = comment;
        const seen = new Set([Number(comment.id)]);
        while (Number(current.parent_id || 0)) {
          const parentId = Number(current.parent_id);
          if (seen.has(parentId) || !visibleById.has(parentId)) return false;
          seen.add(parentId);
          current = visibleById.get(parentId);
        }
        return true;
      };
      const all = visible.filter(connectedToVisibleRoot);
      const byId = new Map(all.map((comment) => [Number(comment.id), comment]));
      const rootIdFor = (comment) => {
        let current = comment;
        const seen = new Set([Number(comment.id)]);
        while (Number(current.parent_id || 0) && byId.has(Number(current.parent_id))) {
          const parentId = Number(current.parent_id);
          if (seen.has(parentId)) break;
          seen.add(parentId);
          current = byId.get(parentId);
        }
        return Number(current.id);
      };
      const roots = all.filter((comment) => rootIdFor(comment) === Number(comment.id));
      const selectedRoots = roots.slice(boundedOffset, boundedOffset + boundedRoots);
      const selected = new Set(selectedRoots.map((comment) => Number(comment.id)));
      const comments = all.filter((comment) => selected.has(rootIdFor(comment)));
      return {
        comments,
        offset: boundedOffset,
        rootLimit: boundedRoots,
        rootCount: roots.length,
        hasMore: boundedOffset + selectedRoots.length < roots.length,
      };
    },
    editSocialComment({ commentId, userId, actorPersona, body }) {
      const current = this.getCommentById(commentId);
      if (!current || current.status !== "active" || Number(current.user_id) !== Number(userId) || current.actor_persona !== normalizePersona(actorPersona)) return null;
      const nextVersion = Number(current.version || 1) + 1;
      const commitment = sha256Hex(JSON.stringify({
        userId: current.user_id, actorPersona: current.actor_persona, postId: current.post_id,
        parentId: current.parent_id, body,
      }));
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const changed = this.db.prepare(`UPDATE comments SET body = ?, content_commitment = ?, edited_at = unixepoch(), version = ?
          WHERE id = ? AND user_id = ? AND actor_persona = ? AND status = 'active' AND version = ?`)
          .run(body, commitment, nextVersion, commentId, userId, normalizePersona(actorPersona), Number(current.version || 1)).changes;
        if (changed !== 1) throw new Error("SOCIAL_COMMENT_EDIT_CONFLICT");
        this.db.prepare(`INSERT INTO comment_versions (comment_id, version, body, content_commitment) VALUES (?, ?, ?, ?)`)
          .run(commentId, nextVersion, body, commitment);
        this.db.exec("COMMIT");
        return this.getCommentById(commentId);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    withdrawSocialComment({ commentId, userId, actorPersona }) {
      const current = this.getCommentById(commentId);
      if (!current || Number(current.user_id) !== Number(userId) || current.actor_persona !== normalizePersona(actorPersona)) return null;
      if (current.status === "withdrawn") return current;
      if (current.status !== "active") return null;
      const commitment = sha256Hex(JSON.stringify({
        userId: current.user_id, actorPersona: current.actor_persona, postId: current.post_id,
        parentId: current.parent_id, body: "",
      }));
      this.db.prepare(`UPDATE comments SET body = '', status = 'withdrawn', content_commitment = ?, withdrawn_at = unixepoch()
        WHERE id = ? AND user_id = ? AND actor_persona = ? AND status = 'active'`)
        .run(commitment, commentId, userId, normalizePersona(actorPersona));
      return this.getCommentById(commentId);
    },
    pinSocialComment({ commentId, ownerId, ownerPersona, active = true }) {
      const comment = this.getCommentById(commentId);
      const post = comment ? this.getPostById(comment.post_id) : null;
      ownerPersona = normalizePersona(ownerPersona);
      if (!comment || !post || post.status !== "active" || Number(post.user_id) !== Number(ownerId)
          || post.persona !== ownerPersona || (active && comment.status !== "active")) return null;
      this.db.prepare(`UPDATE comments SET pinned_at = ? WHERE id = ? AND post_id = ?`)
        .run(active ? Math.floor(Date.now() / 1000) : null, commentId, post.id);
      return { comment: this.getCommentById(commentId), post };
    },
    listCommentVersions(commentId, userId) {
      const comment = this.getCommentById(commentId);
      if (!comment || Number(comment.user_id) !== Number(userId)) return [];
      return this.db.prepare(`SELECT version, body, content_commitment, created_at FROM comment_versions WHERE comment_id = ? ORDER BY version ASC`).all(commentId);
    },
    setCommentReaction(userId, actorPersona, commentId, kind, active = true) {
      const normalizedKind = String(kind ?? "").toUpperCase();
      if (!SOCIAL_REACTION_SET.has(normalizedKind) || normalizedKind === "DISLIKE") throw new Error("SOCIAL_COMMENT_REACTION_INVALID");
      actorPersona = normalizePersona(actorPersona);
      if (active) {
        this.db.prepare(`
          INSERT INTO comment_reactions (user_id, actor_persona, comment_id, kind)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, actor_persona, comment_id)
          DO UPDATE SET kind = excluded.kind, updated_at = unixepoch()
        `).run(userId, actorPersona, commentId, normalizedKind);
      } else {
        this.db.prepare(`DELETE FROM comment_reactions WHERE user_id = ? AND actor_persona = ? AND comment_id = ?`).run(userId, actorPersona, commentId);
      }
      return this.commentReactionSummary(commentId, userId, actorPersona);
    },
    commentReactionSummary(commentId, viewerId = null, viewerPersona = "social") {
      const normalizedViewerPersona = normalizePersona(viewerPersona);
      const rows = viewerId
        ? this.db.prepare(`SELECT cr.kind, COUNT(*) AS count FROM comment_reactions cr
          WHERE cr.comment_id = ? AND NOT EXISTS (
            SELECT 1 FROM profile_blocks pb
            WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = cr.user_id)
               OR (pb.blocker_id = cr.user_id AND pb.blocker_persona = cr.actor_persona AND pb.blocked_id = ?)
          ) GROUP BY cr.kind`).all(commentId, viewerId, normalizedViewerPersona, viewerId)
        : this.db.prepare(`SELECT kind, COUNT(*) AS count FROM comment_reactions WHERE comment_id = ? GROUP BY kind`).all(commentId);
      const mine = viewerId ? this.db.prepare(`SELECT kind FROM comment_reactions WHERE user_id = ? AND actor_persona = ? AND comment_id = ?`).get(viewerId, normalizedViewerPersona, commentId) : null;
      return { counts: Object.fromEntries(rows.map((row) => [row.kind, Number(row.count)])), viewer_reaction: mine?.kind ?? null };
    },
    setSavedPost(userId, actorPersona, postId, active = true) {
      actorPersona = normalizePersona(actorPersona);
      if (active) this.db.prepare(`INSERT OR IGNORE INTO saved_posts (user_id, actor_persona, post_id) VALUES (?, ?, ?)`).run(userId, actorPersona, postId);
      else this.db.prepare(`DELETE FROM saved_posts WHERE user_id = ? AND actor_persona = ? AND post_id = ?`).run(userId, actorPersona, postId);
      return active;
    },
    hasSavedPost(userId, actorPersona, postId) {
      return Boolean(this.db.prepare(`SELECT 1 FROM saved_posts WHERE user_id = ? AND actor_persona = ? AND post_id = ?`).get(userId, normalizePersona(actorPersona), postId));
    },
    recordPostShare(userId, actorPersona, postId, channel = "copy_link") {
      const info = this.db.prepare(`INSERT INTO post_shares (user_id, actor_persona, post_id, channel) VALUES (?, ?, ?, ?)`).run(userId, normalizePersona(actorPersona), postId, channel);
      return { id: Number(info.lastInsertRowid), shares: Number(this.db.prepare(`SELECT COUNT(*) AS count FROM post_shares WHERE post_id = ?`).get(postId).count) };
    },
    // A repost is an internal share: it lives on the reposter's profile and keeps the
    // original post, its counters and its identity. Nothing new is published, so nothing new
    // needs moderating and no view is counted twice.
    listUserReposts(userId, actorPersona = "social", { viewerId = null, viewerPersona = "social", limit = 30 } = {}) {
      actorPersona = normalizePersona(actorPersona);
      const bounded = Math.max(1, Math.min(Number(limit) || 30, 100));
      const rows = this.db.prepare(`
        SELECT ps.id AS share_id, ps.created_at AS reposted_at, p.*
        FROM post_shares ps
        JOIN posts p ON p.id = ps.post_id
        JOIN users author ON author.id = p.user_id
        WHERE ps.user_id = ? AND ps.actor_persona = ? AND ps.channel = 'repost'
          AND p.persona = ? AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
        ORDER BY ps.created_at DESC, ps.id DESC LIMIT ?
      `).all(Number(userId), actorPersona, actorPersona, bounded);
      return rows
        .map((row) => ({ share_id: Number(row.share_id), reposted_at: Number(row.reposted_at), post: this.joinPost(row) }))
        .filter((entry) => entry.post && (viewerId == null || this.canViewPost(viewerId, viewerPersona, entry.post)));
    },
    listFollowedReposts(viewerId, { viewerPersona = "social", limit = 40 } = {}) {
      viewerPersona = normalizePersona(viewerPersona);
      const bounded = Math.max(1, Math.min(Number(limit) || 40, 200));
      const rows = this.db.prepare(`
        SELECT ps.id AS share_id, ps.created_at AS reposted_at, ps.user_id AS reposter_id, p.*
        FROM post_shares ps
        JOIN follows f ON f.followee_id = ps.user_id AND f.follower_id = ? AND f.persona = ?
        JOIN posts p ON p.id = ps.post_id
        JOIN users author ON author.id = p.user_id
        JOIN users reposter ON reposter.id = ps.user_id
        WHERE ps.channel = 'repost' AND ps.actor_persona = ? AND ps.user_id <> ?
          AND p.persona = ? AND p.status = 'active'
          AND author.traffic_class = 'HUMAN_ORGANIC' AND reposter.traffic_class = 'HUMAN_ORGANIC'
        ORDER BY ps.created_at DESC, ps.id DESC LIMIT ?
      `).all(Number(viewerId), viewerPersona, viewerPersona, Number(viewerId), viewerPersona, bounded);
      return rows.map((row) => {
        const reposter = this.getUserById(row.reposter_id);
        const reposterProfile = this.getPersona(row.reposter_id, viewerPersona);
        return {
          share_id: Number(row.share_id),
          reposted_at: Number(row.reposted_at),
          reposter: reposter ? {
            id: reposter.id,
            handle: reposter.handle,
            display_name: reposterProfile?.name || reposter.display_name || reposter.handle,
            avatar: reposterProfile?.avatar ?? null,
          } : null,
          post: this.joinPost(row),
        };
      }).filter((entry) => entry.post && entry.reposter && this.canViewPost(viewerId, viewerPersona, entry.post));
    },
    // ---- identity onboarding ----
    handleAvailability(handle, excludeUserId = null) {
      const value = String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
      if (!NEXUS_HANDLE_PATTERN.test(value)) return { handle: value, available: false, reason: "handle_invalid" };
      const existing = this.getUserByHandle(value);
      if (existing && Number(existing.id) !== Number(excludeUserId)) return { handle: value, available: false, reason: "handle_taken" };
      return { handle: value, available: true, reason: null };
    },
    claimHandle(userId, handle) {
      const check = this.handleAvailability(handle, userId);
      if (!check.available) return { error: check.reason, handle: check.handle };
      this.db.prepare(`UPDATE users SET handle = ? WHERE id = ?`).run(check.handle, Number(userId));
      return { user: this.getUserById(Number(userId)), handle: check.handle };
    },
    markOnboarded(userId, atSeconds = Math.floor(Date.now() / 1000)) {
      this.db.prepare(`UPDATE users SET onboarded_at = COALESCE(onboarded_at, ?) WHERE id = ?`).run(Number(atSeconds), Number(userId));
      return this.getUserById(Number(userId));
    },
    // The first-run flow exists for accounts that never chose an identity. Everything the server says
    // here is observable in the record: a generated handle plus no completion stamp.
    onboardingState(user) {
      if (!user) return { required: false, reason: "no_account", handle_source: null };
      const handle = String(user.handle || "");
      const completedAt = Number(user.onboarded_at || 0) || null;
      const generated = generatedHandle(handle);
      return {
        required: !completedAt && generated,
        reason: completedAt ? "completed" : (generated ? "generated_handle" : "handle_chosen"),
        handle_source: generated ? "generated" : "chosen",
        handle,
        completed_at: completedAt,
      };
    },
    completeOnboarding({ userId, handle = null, displayName = null, persona = "social", visibility = "public", bio = null }) {
      const user = this.getUserById(Number(userId));
      if (!user) return { error: "user_not_found" };
      if (handle) {
        const claimed = this.claimHandle(userId, handle);
        if (claimed.error) return { error: claimed.error };
      }
      const name = String(displayName ?? "").trim();
      if (name) this.db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).run(name.slice(0, 50), Number(userId));
      const normalizedPersona = normalizePersona(persona);
      const safeVisibility = PROFILE_VISIBILITY.has(visibility) ? visibility : "public";
      this.ensurePersona(userId, normalizedPersona, { name: name || user.display_name || user.handle, visibility: safeVisibility });
      // ensurePersona only creates a missing profile, so the identity the person just chose is written
      // explicitly: this is the one moment where the name and the visibility are decided on purpose.
      this.updatePersona(userId, normalizedPersona, {
        name: name || user.display_name || user.handle,
        visibility: safeVisibility,
        ...(bio === null || bio === undefined ? {} : { bio: String(bio).slice(0, 300) }),
      });
      this.markOnboarded(userId);
      return { user: this.getUserById(Number(userId)), persona: normalizedPersona, profile: this.getPersona(userId, normalizedPersona) };
    },
    // ---- reply shares ----
    // A shared reply is an internal share, exactly like a repost: it lives on the sharer's profile
    // and keeps the reply, its author and its post. Nothing new is published, so nothing new needs
    // moderating and no view is counted twice.
    setCommentShare(userId, actorPersona, commentId, active = true) {
      const persona = normalizePersona(actorPersona);
      if (active) {
        const exists = this.db.prepare(`SELECT 1 FROM comment_shares WHERE comment_id = ? AND user_id = ? AND actor_persona = ? AND channel = 'repost' LIMIT 1`)
          .get(Number(commentId), Number(userId), persona);
        if (!exists) this.db.prepare(`INSERT INTO comment_shares (comment_id, user_id, actor_persona, channel) VALUES (?, ?, ?, 'repost')`)
          .run(Number(commentId), Number(userId), persona);
      } else {
        this.db.prepare(`DELETE FROM comment_shares WHERE comment_id = ? AND user_id = ? AND actor_persona = ? AND channel = 'repost'`)
          .run(Number(commentId), Number(userId), persona);
      }
      return this.commentShareSummary(commentId, userId, persona);
    },
    // A blocked account never inflates a counter, the same rule the post repost counter follows.
    commentShareCount(commentId, viewerId = null, viewerPersona = "social") {
      if (viewerId == null) {
        return Number(this.db.prepare(`SELECT COUNT(DISTINCT user_id || ':' || actor_persona) AS count FROM comment_shares WHERE comment_id = ? AND channel = 'repost'`).get(Number(commentId)).count);
      }
      return Number(this.db.prepare(`SELECT COUNT(DISTINCT cs.user_id || ':' || cs.actor_persona) AS count FROM comment_shares cs
        WHERE cs.comment_id = ? AND cs.channel = 'repost' AND NOT EXISTS (
          SELECT 1 FROM profile_blocks pb
          WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = cs.user_id)
             OR (pb.blocker_id = cs.user_id AND pb.blocker_persona = cs.actor_persona AND pb.blocked_id = ?)
        )`).get(Number(commentId), Number(viewerId), normalizePersona(viewerPersona), Number(viewerId)).count);
    },
    commentShareSummary(commentId, viewerId = null, viewerPersona = "social") {
      return {
        shares: this.commentShareCount(commentId, viewerId, viewerPersona),
        shared_by_me: viewerId == null ? false : Boolean(this.db.prepare(`SELECT 1 FROM comment_shares WHERE comment_id = ? AND user_id = ? AND actor_persona = ? AND channel = 'repost' LIMIT 1`)
          .get(Number(commentId), Number(viewerId), normalizePersona(viewerPersona))),
      };
    },
    // One query for a whole conversation: a thread page must not ask per reply.
    commentShareSummariesBulk(commentIds, viewerId = null, viewerPersona = "social") {
      const ids = [...new Set((Array.isArray(commentIds) ? commentIds : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      const summaries = new Map();
      if (!ids.length) return summaries;
      const marks = ids.map(() => "?").join(",");
      const rows = viewerId == null
        ? this.db.prepare(`SELECT comment_id, COUNT(DISTINCT user_id || ':' || actor_persona) AS count
            FROM comment_shares WHERE comment_id IN (${marks}) AND channel = 'repost' GROUP BY comment_id`).all(...ids)
        : this.db.prepare(`SELECT cs.comment_id AS comment_id, COUNT(DISTINCT cs.user_id || ':' || cs.actor_persona) AS count
            FROM comment_shares cs
            WHERE cs.comment_id IN (${marks}) AND cs.channel = 'repost' AND NOT EXISTS (
              SELECT 1 FROM profile_blocks pb
              WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = cs.user_id)
                 OR (pb.blocker_id = cs.user_id AND pb.blocker_persona = cs.actor_persona AND pb.blocked_id = ?)
            ) GROUP BY cs.comment_id`).all(...ids, Number(viewerId), normalizePersona(viewerPersona), Number(viewerId));
      for (const row of rows) summaries.set(Number(row.comment_id), Number(row.count));
      const mine = viewerId == null ? [] : this.db.prepare(`SELECT comment_id FROM comment_shares
        WHERE comment_id IN (${marks}) AND user_id = ? AND actor_persona = ? AND channel = 'repost'`)
        .all(...ids, Number(viewerId), normalizePersona(viewerPersona));
      const sharedByMe = new Set(mine.map((row) => Number(row.comment_id)));
      for (const id of ids) summaries.set(id, { shares: summaries.get(id) ?? 0, shared_by_me: sharedByMe.has(id) });
      return summaries;
    },
    // "Replying to @x" has to be true even when the parent is not on the page, so the handle is read
    // for the whole page in one query instead of one query per reply.
    commentParentAuthors(commentIds) {
      const ids = [...new Set((Array.isArray(commentIds) ? commentIds : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      const authors = new Map();
      if (!ids.length) return authors;
      const marks = ids.map(() => "?").join(",");
      const parents = this.db.prepare(`SELECT id, parent_id FROM comments WHERE id IN (${marks})`).all(...ids);
      const parentIds = [...new Set(parents.map((row) => Number(row.parent_id || 0)).filter((id) => id > 0))];
      if (!parentIds.length) return authors;
      const parentMarks = parentIds.map(() => "?").join(",");
      const rows = this.db.prepare(`SELECT c.id, u.handle, COALESCE(p.name, u.display_name) AS display_name, c.status
        FROM comments c JOIN users u ON u.id = c.user_id
        LEFT JOIN personas p ON p.user_id = c.user_id AND p.persona = c.actor_persona
        WHERE c.id IN (${parentMarks})`).all(...parentIds);
      const byId = new Map(rows.map((row) => [Number(row.id), row]));
      for (const row of parents) {
        const parent = byId.get(Number(row.parent_id || 0));
        if (parent) authors.set(Number(row.id), {
          id: Number(parent.id), handle: parent.handle, display_name: parent.display_name, status: parent.status,
        });
      }
      return authors;
    },
    // The profile shows shared replies next to reposts, with the post they came from.
    listUserCommentShares(userId, actorPersona = "social", { viewerId = null, viewerPersona = "social", limit = 30 } = {}) {
      const persona = normalizePersona(actorPersona);
      const bounded = Math.max(1, Math.min(Number(limit) || 30, 100));
      const rows = this.db.prepare(`
        SELECT cs.id AS share_id, cs.created_at AS shared_at, cs.comment_id,
               c.post_id, c.user_id, c.body, c.created_at, c.status,
               u.handle, COALESCE(p.name, u.display_name) AS display_name, p.avatar
        FROM comment_shares cs
        JOIN comments c ON c.id = cs.comment_id
        JOIN users u ON u.id = c.user_id
        LEFT JOIN personas p ON p.user_id = c.user_id AND p.persona = c.actor_persona
        WHERE cs.user_id = ? AND cs.actor_persona = ? AND cs.channel = 'repost' AND c.status = 'active'
        ORDER BY cs.created_at DESC, cs.id DESC LIMIT ?
      `).all(Number(userId), persona, bounded);
      return rows.map((row) => {
        const post = this.getPostById(Number(row.post_id));
        const author = post ? this.getUserById(Number(post.user_id)) : null;
        const authorProfile = author ? this.getPersona(Number(post.user_id), viewerPersona) : null;
        return {
          share_id: Number(row.share_id), shared_at: Number(row.shared_at),
          comment: {
            id: Number(row.comment_id), post_id: Number(row.post_id), user_id: Number(row.user_id),
            body: row.body, created_at: Number(row.created_at), handle: row.handle, display_name: row.display_name, avatar: row.avatar,
          },
          post: post ? { id: Number(post.id), caption: post.caption, user_id: Number(post.user_id), kind: post.kind } : null,
          post_author: author ? {
            id: Number(author.id), handle: author.handle,
            display_name: authorProfile?.name || author.display_name || author.handle,
          } : null,
        };
      }).filter((entry) => entry.post && (viewerId == null || this.canViewPost(viewerId, viewerPersona, this.getPostById(entry.post.id))));
    },
    // ---- community notes ----
    communityNoteById(noteId) {
      return this.db.prepare(`SELECT * FROM community_notes WHERE id = ?`).get(Number(noteId)) ?? null;
    },
    communityNoteRatings(noteId) {
      return this.db.prepare(`SELECT perspective, helpful, rater_id FROM community_note_ratings WHERE note_id = ? ORDER BY created_at ASC`)
        .all(Number(noteId)).map((row) => ({ perspective: row.perspective, helpful: Number(row.helpful) === 1, rater_id: Number(row.rater_id) }));
    },
    // A quota, not a ban: the numbers are returned so the interface can say exactly how much is
    // left today instead of failing mysteriously.
    communityNoteQuota(userId, actorPersona = "social", atSeconds = Math.floor(Date.now() / 1000)) {
      const since = atSeconds - 24 * 3600;
      const notes = Number(this.db.prepare(`SELECT COUNT(*) c FROM community_notes WHERE author_id = ? AND author_persona = ? AND created_at >= ?`).get(Number(userId), normalizePersona(actorPersona), since).c);
      const ratings = Number(this.db.prepare(`SELECT COUNT(*) c FROM community_note_ratings WHERE rater_id = ? AND rater_persona = ? AND created_at >= ?`).get(Number(userId), normalizePersona(actorPersona), since).c);
      return {
        notes_used: notes, notes_left: Math.max(0, COMMUNITY_NOTE_RULES.dailyNotes - notes),
        ratings_used: ratings, ratings_left: Math.max(0, COMMUNITY_NOTE_RULES.dailyRatings - ratings),
        window_hours: 24, rules: { ...COMMUNITY_NOTE_RULES },
      };
    },
    appendCommunityNoteEvent({ noteId, actorKind = "USER", actorId = null, action, reasonCode = null, detail = "" }) {
      this.db.prepare(`INSERT INTO community_note_events (note_id, actor_kind, actor_id, action, reason_code, detail) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(Number(noteId), actorKind, actorId == null ? null : Number(actorId), action, reasonCode, String(detail).slice(0, 200));
    },
    communityNoteView(note, viewerId = null, viewerPersona = "social") {
      if (!note) return null;
      let sources = [];
      try { sources = JSON.parse(note.sources_json || "[]"); } catch { sources = []; }
      const ratings = this.communityNoteRatings(note.id);
      const author = this.getUserById(note.author_id);
      const authorProfile = this.getPersona(note.author_id, note.author_persona);
      const mine = viewerId != null && Number(note.author_id) === Number(viewerId)
        && normalizePersona(note.author_persona) === normalizePersona(viewerPersona);
      const myRating = viewerId == null ? null : ratings.find((entry) => entry.rater_id === Number(viewerId));
      return {
        id: Number(note.id),
        subject_type: note.subject_type,
        subject_id: Number(note.subject_id),
        body: note.body,
        sources: Array.isArray(sources) ? sources.slice(0, COMMUNITY_NOTE_RULES.maxSources) : [],
        status: note.status,
        published_at: note.published_at == null ? null : Number(note.published_at),
        created_at: Number(note.created_at),
        author: author ? { id: author.id, handle: author.handle, display_name: authorProfile?.name || author.display_name || author.handle } : null,
        mine,
        ratings: {
          total: ratings.length,
          helpful: ratings.filter((entry) => entry.helpful).length,
          perspectives: new Set(ratings.map((entry) => entry.perspective)).size,
        },
        my_rating: mine || myRating === undefined ? null : myRating.helpful,
        rule: { ...COMMUNITY_NOTE_RULES, metric: "helpful_from_multiple_perspectives" },
      };
    },
    rateCommunityNote({ noteId, raterId, raterPersona = "social", helpful, perspective = null }) {
      const note = this.communityNoteById(noteId);
      if (!note || note.status === "WITHDRAWN") return { error: "note_not_found" };
      const normalizedPersona = normalizePersona(raterPersona);
      if (Number(note.author_id) === Number(raterId) && normalizePersona(note.author_persona) === normalizedPersona) return { error: "author_cannot_rate_own_note" };
      const subject = note.subject_type === "post" ? this.getPostById(Number(note.subject_id)) : null;
      if (!subject) return { error: "subject_not_found" };
      const resolvedPerspective = perspective || communityNotePerspective({
        isAuthor: Number(subject.user_id) === Number(raterId) && normalizePersona(subject.persona) === normalizedPersona,
        followsAuthor: this.isFollowing(Number(raterId), Number(subject.user_id), "social"),
        mutedAuthor: this.isMuted(Number(raterId), normalizedPersona, Number(subject.user_id)),
      });
      this.db.prepare(`
        INSERT INTO community_note_ratings (note_id, rater_id, rater_persona, perspective, helpful) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(note_id, rater_id, rater_persona) DO UPDATE SET
          helpful = excluded.helpful, perspective = excluded.perspective, created_at = unixepoch()
      `).run(Number(noteId), Number(raterId), normalizedPersona, resolvedPerspective, helpful === true ? 1 : 0);
      let sources = [];
      try { sources = JSON.parse(note.sources_json || "[]"); } catch { sources = []; }
      const ratings = this.communityNoteRatings(noteId);
      const status = decideCommunityNoteStatus(ratings, { sources: sources.length });
      const publishedAt = status === "HELPFUL" ? (note.published_at ?? Math.floor(Date.now() / 1000)) : null;
      this.db.prepare(`UPDATE community_notes SET status = ?, published_at = ?, updated_at = unixepoch() WHERE id = ?`).run(status, publishedAt, Number(noteId));
      if (status !== note.status) {
        this.appendCommunityNoteEvent({ noteId: Number(noteId), actorKind: "RATERS", action: "STATUS_CHANGED", reasonCode: status, detail: ratings.length + " ratings" });
      }
      return {
        note: this.communityNoteView(this.communityNoteById(noteId), raterId, raterPersona),
        status, previous_status: note.status, perspective: resolvedPerspective,
      };
    },
    createCommunityNote({ subjectType = "post", subjectId, authorId, authorPersona = "social", body, sources = [] }) {
      const subject = subjectType === "post" ? this.getPostById(Number(subjectId)) : null;
      if (!subject) return { error: "subject_not_found" };
      if (Number(subject.user_id) === Number(authorId) && normalizePersona(subject.persona) === normalizePersona(authorPersona)) return { error: "author_cannot_note_own_post" };
      const text = String(body ?? "").trim();
      if (text.length < 12 || text.length > 600) return { error: "note_body_invalid" };
      const links = (Array.isArray(sources) ? sources : [])
        .map((url) => String(url ?? "").trim())
        .filter((url) => /^https?:\/\/[^\s]{4,300}$/i.test(url))
        .slice(0, COMMUNITY_NOTE_RULES.maxSources);
      const existing = this.db.prepare(`SELECT * FROM community_notes WHERE author_id = ? AND author_persona = ? AND subject_type = ? AND subject_id = ?`)
        .get(Number(authorId), normalizePersona(authorPersona), subjectType, Number(subjectId));
      if (existing && existing.status !== "WITHDRAWN") return { error: "note_already_exists", noteId: Number(existing.id) };
      let noteId;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        if (existing) {
          // A withdrawn note can be rewritten: the old ratings are dropped, because they belonged
          // to the text that was withdrawn, not to the new one.
          this.db.prepare(`UPDATE community_notes SET body = ?, sources_json = ?, status = 'NEEDS_MORE_RATINGS', updated_at = unixepoch(), published_at = NULL WHERE id = ?`)
            .run(text, JSON.stringify(links), Number(existing.id));
          this.db.prepare(`DELETE FROM community_note_ratings WHERE note_id = ?`).run(Number(existing.id));
          noteId = Number(existing.id);
        } else {
          const info = this.db.prepare(`INSERT INTO community_notes (subject_type, subject_id, author_id, author_persona, body, sources_json) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(subjectType, Number(subjectId), Number(authorId), normalizePersona(authorPersona), text, JSON.stringify(links));
          noteId = Number(info.lastInsertRowid);
        }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      this.appendCommunityNoteEvent({ noteId, actorId: authorId, action: existing ? "RESUBMITTED" : "CREATED", detail: links.length + " sources" });
      return { note: this.communityNoteView(this.communityNoteById(noteId), authorId, authorPersona) };
    },
    withdrawCommunityNote({ noteId, userId, actorPersona = "social" }) {
      const note = this.communityNoteById(noteId);
      if (!note || Number(note.author_id) !== Number(userId) || normalizePersona(note.author_persona) !== normalizePersona(actorPersona)) return { error: "note_not_found" };
      this.db.prepare(`UPDATE community_notes SET status = 'WITHDRAWN', published_at = NULL, updated_at = unixepoch() WHERE id = ?`).run(Number(noteId));
      this.appendCommunityNoteEvent({ noteId: Number(noteId), actorId: userId, action: "WITHDRAWN" });
      return { note: this.communityNoteView(this.communityNoteById(noteId), userId, actorPersona) };
    },
    listCommunityNotes(subjectType, subjectId, viewerId = null, viewerPersona = "social") {
      const rows = this.db.prepare(`SELECT * FROM community_notes WHERE subject_type = ? AND subject_id = ? AND status <> 'WITHDRAWN' ORDER BY (status = 'HELPFUL') DESC, id ASC`)
        .all(subjectType, Number(subjectId));
      const mapped = rows.map((row) => this.communityNoteView(row, viewerId, viewerPersona));
      return {
        notes: mapped.filter((note) => note.mine || note.status === "HELPFUL"),
        mine: mapped.find((note) => note.mine) ?? null,
        counts: {
          published: mapped.filter((note) => note.status === "HELPFUL").length,
          needing_ratings: mapped.filter((note) => note.status === "NEEDS_MORE_RATINGS").length,
          requests: Number(this.db.prepare(`SELECT COUNT(*) c FROM community_note_requests WHERE subject_type = ? AND subject_id = ?`).get(subjectType, Number(subjectId)).c),
        },
      };
    },
    // ---- media lists ----

    // `posts.media_id` stays the cover; this table is the ordered truth a carousel reads.
    setPostMedia(postId, mediaIds = [], { transaction = true } = {}) {
      const ids = (Array.isArray(mediaIds) ? mediaIds : []).map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 10);
      if (transaction) this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`DELETE FROM post_media WHERE post_id = ?`).run(Number(postId));
        const insert = this.db.prepare(`INSERT OR REPLACE INTO post_media (post_id, media_id, position) VALUES (?, ?, ?)`);
        ids.forEach((mediaId, index) => insert.run(Number(postId), mediaId, index));
        this.db.prepare(`UPDATE posts SET media_id = ? WHERE id = ?`).run(ids.length ? ids[0] : null, Number(postId));
        if (transaction) this.db.exec("COMMIT");
      } catch (error) {
        if (transaction) this.db.exec("ROLLBACK");
        throw error;
      }
      return ids;
    },
    listPostMedia(postId) {
      return this.db.prepare(`
        SELECT pm.position, m.* FROM post_media pm JOIN media m ON m.id = pm.media_id
        WHERE pm.post_id = ? ORDER BY pm.position ASC, m.id ASC
      `).all(Number(postId)).map((row) => ({
        id: Number(row.id), hash: row.hash, ext: row.ext, mime: row.mime, kind: row.kind,
        size: Number(row.size || 0), scan_status: row.scan_status, position: Number(row.position),
      }));
    },
    listPostMediaBulk(postIds) {
      const ids = [...new Set((Array.isArray(postIds) ? postIds : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
      const result = new Map(ids.map((id) => [id, []]));
      if (!ids.length) return result;
      const rows = this.db.prepare(`
        SELECT pm.post_id, pm.position, m.* FROM post_media pm JOIN media m ON m.id = pm.media_id
        WHERE pm.post_id IN (${ids.map(() => "?").join(",")}) ORDER BY pm.post_id ASC, pm.position ASC
      `).all(...ids);
      for (const row of rows) {
        const list = result.get(Number(row.post_id));
        if (list) list.push({
          id: Number(row.id), hash: row.hash, ext: row.ext, mime: row.mime, kind: row.kind,
          size: Number(row.size || 0), scan_status: row.scan_status, position: Number(row.position),
        });
      }
      return result;
    },
    // ---- tags ----
    setPostTags(postId, tags = [], { transaction = true } = {}) {
      const list = (Array.isArray(tags) ? tags : [])
        .filter((entry) => entry && (entry.kind === "hashtag" || entry.kind === "cashtag") && typeof entry.tag === "string" && entry.tag)
        .slice(0, 20);
      if (transaction) this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`DELETE FROM post_tags WHERE post_id = ?`).run(Number(postId));
        const insert = this.db.prepare(`INSERT OR REPLACE INTO post_tags (post_id, kind, tag, display, position) VALUES (?, ?, ?, ?, ?)`);
        list.forEach((entry, index) => insert.run(Number(postId), entry.kind, entry.tag, entry.display || entry.tag, index));
        if (transaction) this.db.exec("COMMIT");
      } catch (error) {
        if (transaction) this.db.exec("ROLLBACK");
        throw error;
      }
      return list.length;
    },
    postTags(postId) {
      return this.db.prepare(`SELECT kind, tag, display, position FROM post_tags WHERE post_id = ? ORDER BY position ASC`)
        .all(Number(postId)).map((row) => ({ kind: row.kind, tag: row.tag, display: row.display, position: Number(row.position) }));
    },
    listPostsByTag(viewerId, viewerPersona, { kind = "hashtag", tag, limit = 30, before = null } = {}) {
      const normalizedKind = kind === "cashtag" ? "cashtag" : "hashtag";
      const normalizedTag = String(tag || "").trim().toLowerCase();
      if (!normalizedTag) return [];
      const bounded = Math.max(1, Math.min(Number(limit) || 30, 100));
      const rows = this.db.prepare(`
        SELECT p.* FROM post_tags t
        JOIN posts p ON p.id = t.post_id
        JOIN users author ON author.id = p.user_id
        WHERE t.kind = ? AND t.tag = ? AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
          AND (? IS NULL OR p.created_at < ?)
        ORDER BY p.created_at DESC, p.id DESC LIMIT ?
      `).all(normalizedKind, normalizedTag, before == null ? null : Number(before), before == null ? null : Number(before), bounded);
      return rows.map((row) => this.joinPost(row)).filter((post) => this.canViewPost(viewerId, viewerPersona, post));
    },
    tagStats(kind, tag) {
      const normalizedKind = kind === "cashtag" ? "cashtag" : "hashtag";
      const normalizedTag = String(tag || "").trim().toLowerCase();
      const row = this.db.prepare(`
        SELECT COUNT(*) posts, COUNT(DISTINCT p.user_id) authors
        FROM post_tags t JOIN posts p ON p.id = t.post_id JOIN users author ON author.id = p.user_id
        WHERE t.kind = ? AND t.tag = ? AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
      `).get(normalizedKind, normalizedTag);
      return { kind: normalizedKind, tag: normalizedTag, posts: Number(row?.posts || 0), authors: Number(row?.authors || 0) };
    },
    // Trending counts distinct human accounts, not mentions: one account repeating a tag cannot
    // make it trend, and catalog traffic never appears.
    trendingTags({ kind = "hashtag", sinceSeconds = 3 * 24 * 3600, limit = 10, minAuthors = 2 } = {}) {
      const normalizedKind = kind === "cashtag" ? "cashtag" : "hashtag";
      const bounded = Math.max(1, Math.min(Number(limit) || 10, 30));
      const since = Math.floor(Date.now() / 1000) - Math.max(3600, Math.min(Number(sinceSeconds) || 0, 30 * 24 * 3600));
      const rows = this.db.prepare(`
        SELECT t.tag, t.display, COUNT(DISTINCT p.user_id) authors, COUNT(DISTINCT p.id) posts
        FROM post_tags t JOIN posts p ON p.id = t.post_id JOIN users author ON author.id = p.user_id
        WHERE t.kind = ? AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC' AND p.created_at >= ?
        GROUP BY t.tag HAVING authors >= ?
        ORDER BY authors DESC, posts DESC, t.tag ASC LIMIT ?
      `).all(normalizedKind, since, Math.max(1, Math.min(Number(minAuthors) || 2, 10)), bounded);
      return rows.map((row) => ({
        kind: normalizedKind, tag: row.tag, display: row.display || row.tag,
        authors: Number(row.authors), posts: Number(row.posts),
      }));
    },
    setPostRepost(userId, actorPersona, postId, active = true) {
      actorPersona = normalizePersona(actorPersona);
      if (active) {
        const exists = this.db.prepare(`SELECT 1 FROM post_shares WHERE user_id = ? AND actor_persona = ? AND post_id = ? AND channel = 'repost' LIMIT 1`).get(userId, actorPersona, postId);
        if (!exists) this.db.prepare(`INSERT INTO post_shares (user_id, actor_persona, post_id, channel) VALUES (?, ?, ?, 'repost')`).run(userId, actorPersona, postId);
      } else {
        this.db.prepare(`DELETE FROM post_shares WHERE user_id = ? AND actor_persona = ? AND post_id = ? AND channel = 'repost'`).run(userId, actorPersona, postId);
      }
      return this.postRepostSummary(postId, userId, actorPersona);
    },
    postRepostSummary(postId, viewerId = null, viewerPersona = "social") {
      const normalizedViewerPersona = normalizePersona(viewerPersona);
      const reposts = viewerId
        ? Number(this.db.prepare(`SELECT COUNT(DISTINCT ps.user_id || ':' || ps.actor_persona) AS count FROM post_shares ps
          WHERE ps.post_id = ? AND ps.channel = 'repost' AND NOT EXISTS (
            SELECT 1 FROM profile_blocks pb
            WHERE (pb.blocker_id = ? AND pb.blocker_persona = ? AND pb.blocked_id = ps.user_id)
               OR (pb.blocker_id = ps.user_id AND pb.blocker_persona = ps.actor_persona AND pb.blocked_id = ?)
          )`).get(postId, viewerId, normalizedViewerPersona, viewerId).count)
        : Number(this.db.prepare(`SELECT COUNT(DISTINCT user_id || ':' || actor_persona) AS count FROM post_shares WHERE post_id = ? AND channel = 'repost'`).get(postId).count);
      const reposted = viewerId ? Boolean(this.db.prepare(`SELECT 1 FROM post_shares WHERE user_id = ? AND actor_persona = ? AND post_id = ? AND channel = 'repost' LIMIT 1`).get(viewerId, normalizedViewerPersona, postId)) : false;
      return { reposts, reposted_by_me: reposted };
    },

    // ---- stories ----
    createStory({ userId, persona = "social", mediaId = null, caption = "", visibility = "followers", expiresAt = null }) {
      persona = normalizePersona(persona);
      const safeVisibility = PROFILE_VISIBILITY.has(visibility) ? visibility : "followers";
      const commitment = sha256Hex(JSON.stringify({ userId, persona, mediaId, caption, visibility: safeVisibility, expiresAt }));
      const info = this.db.prepare(`
        INSERT INTO stories (user_id, persona, media_id, caption, visibility, expires_at, content_commitment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, persona, mediaId, caption, safeVisibility, expiresAt, commitment);
      return this.getStoryById(Number(info.lastInsertRowid));
    },
    getStoryById(id) {
      const row = this.db.prepare(`SELECT * FROM stories WHERE id = ?`).get(id);
      if (!row) return null;
      const author = this.getUserById(row.user_id);
      const profile = this.getPersona(row.user_id, row.persona);
      return { ...row, author: author ? { id: author.id, handle: author.handle, display_name: profile?.name ?? author.display_name, avatar: profile?.avatar ?? author.avatar, orbit_mood: profile?.orbit_mood ?? null, orbit_place: profile?.orbit_place ?? null, orbit_now: profile?.orbit_now ?? null, orbit_fandom: profile?.orbit_fandom ?? null, orbit_quote: profile?.orbit_quote ?? null, orbit_expires_at: profile?.orbit_expires_at ?? null, earned_sigil: this.sigilProgress(author.id, row.persona) } : null, media: row.media_id ? this.getMediaById(row.media_id) : null };
    },
    listActiveStories(viewerId, viewerPersona = "social", atSeconds = Math.floor(Date.now() / 1000), limit = 100, state = "all") {
      const rows = this.db.prepare(`SELECT * FROM stories WHERE persona = 'social' AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC, id DESC LIMIT ?`).all(atSeconds, Math.min(Number(limit) || 100, 200));
      const normalizedPersona = normalizePersona(viewerPersona);
      return rows.map((row) => {
        const story = this.getStoryById(row.id);
        const view = this.db.prepare(`SELECT progress, completed, first_seen_at, last_seen_at FROM story_views WHERE story_id = ? AND viewer_id = ? AND viewer_persona = ?`).get(row.id, viewerId, normalizedPersona);
        return story ? { ...story, viewed_by_me: Boolean(view?.completed), view_progress: Number(view?.progress || 0) } : null;
      }).filter((story) => story && this.canViewPost(viewerId, viewerPersona, { ...story, status: "active", kind: "story" }))
        .filter((story) => state === "unseen" ? !story.viewed_by_me : state === "viewed" ? story.viewed_by_me : true)
        .sort((a, b) => Number(a.viewed_by_me) - Number(b.viewed_by_me) || Number(b.created_at) - Number(a.created_at));
    },
    recordStoryView(storyId, viewerId, viewerPersona = "social", progress = 0, completed = false) {
      const story = this.getStoryById(storyId);
      const atSeconds = Math.floor(Date.now() / 1000);
      if (!story || story.status !== "active" || (story.expires_at !== null && Number(story.expires_at) <= atSeconds)
        || !this.canViewPost(viewerId, viewerPersona, { ...story, kind: "story" })) return null;
      const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
      const done = completed === true || safeProgress >= 0.9;
      this.db.prepare(`
        INSERT INTO story_views (story_id, viewer_id, viewer_persona, progress, completed)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(story_id, viewer_id, viewer_persona) DO UPDATE SET
          progress = MAX(story_views.progress, excluded.progress),
          completed = MAX(story_views.completed, excluded.completed),
          last_seen_at = unixepoch()
      `).run(storyId, viewerId, normalizePersona(viewerPersona), safeProgress, done ? 1 : 0);
      return { story_id: storyId, progress: safeProgress, viewed: done };
    },
    archiveStory(id, userId, actorPersona = "social") {
      const story = this.getStoryById(id);
      if (!story || story.user_id !== userId || normalizePersona(story.persona) !== normalizePersona(actorPersona)) return false;
      this.db.prepare(`UPDATE stories SET status = 'archived', archived_at = unixepoch() WHERE id = ?`).run(id);
      return true;
    },
    listArchivedStories(userId, actorPersona = "social", limit = 100) {
      const persona = normalizePersona(actorPersona);
      if (persona !== "social") return [];
      const bounded = Math.max(1, Math.min(Number(limit) || 100, 200));
      return this.db.prepare(`SELECT id FROM stories WHERE user_id = ? AND persona = ? AND status = 'archived'
        ORDER BY archived_at DESC, id DESC LIMIT ?`).all(userId, persona, bounded)
        .map(({ id }) => this.getStoryById(id)).filter(Boolean);
    },
    createStoryHighlight({ ownerId, actorPersona = "social", title }) {
      const persona = normalizePersona(actorPersona);
      if (persona !== "social" || !this.getPersona(ownerId, persona)) return null;
      const existingCount = Number(this.db.prepare(`SELECT COUNT(*) count FROM story_highlights WHERE owner_id = ? AND persona = ?`).get(ownerId, persona).count);
      if (existingCount >= 20) return null;
      const position = Number(this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 position FROM story_highlights WHERE owner_id = ? AND persona = ?`).get(ownerId, persona).position);
      try {
        const info = this.db.prepare(`INSERT INTO story_highlights (owner_id, persona, title, position) VALUES (?, ?, ?, ?)`).run(ownerId, persona, title, position);
        return this.db.prepare(`SELECT * FROM story_highlights WHERE id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (String(error?.message || "").includes("UNIQUE")) return this.db.prepare(`SELECT * FROM story_highlights WHERE owner_id = ? AND persona = ? AND title = ?`).get(ownerId, persona, title) ?? null;
        throw error;
      }
    },
    addStoryToHighlight({ highlightId, storyId, ownerId, actorPersona = "social" }) {
      const persona = normalizePersona(actorPersona);
      const highlight = this.db.prepare(`SELECT * FROM story_highlights WHERE id = ? AND owner_id = ? AND persona = ?`).get(highlightId, ownerId, persona);
      const story = this.getStoryById(storyId);
      if (!highlight || !story || Number(story.user_id) !== Number(ownerId) || story.persona !== persona) return null;
      const count = Number(this.db.prepare(`SELECT COUNT(*) count FROM story_highlight_items WHERE highlight_id = ?`).get(highlightId).count);
      const existing = this.db.prepare(`SELECT * FROM story_highlight_items WHERE highlight_id = ? AND story_id = ?`).get(highlightId, storyId);
      if (!existing && count >= 100) return null;
      const position = Number(this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 position FROM story_highlight_items WHERE highlight_id = ?`).get(highlightId).position);
      this.db.prepare(`INSERT OR IGNORE INTO story_highlight_items (highlight_id, story_id, position) VALUES (?, ?, ?)`).run(highlightId, storyId, position);
      return { highlight, story: this.getStoryById(storyId), added: !existing };
    },
    listStoryHighlights(ownerId, viewerId, viewerPersona = "social") {
      const owner = this.getUserById(ownerId);
      if (!owner || normalizePersona(viewerPersona) !== "social") return [];
      const ownerView = Number(ownerId) === Number(viewerId);
      return this.db.prepare(`SELECT * FROM story_highlights WHERE owner_id = ? AND persona = 'social' ORDER BY position, id LIMIT 20`).all(ownerId)
        .map((highlight) => {
          const stories = this.db.prepare(`SELECT story_id FROM story_highlight_items WHERE highlight_id = ? ORDER BY position, story_id LIMIT 100`).all(highlight.id)
            .map(({ story_id }) => this.getStoryById(story_id))
            .filter((story) => story && (ownerView || this.canViewHighlightedStory(viewerId, viewerPersona, story)));
          return { ...highlight, stories };
        }).filter((highlight) => ownerView || highlight.stories.length > 0);
    },

    // ---- chat device keys (public material only) ----
    registerChatDevice(userId, { deviceId, label, publicJwk }) {
      if (!/^[a-zA-Z0-9:_-]{16,80}$/.test(String(deviceId))) return null;
      const canonicalJwk = canonicalChatPublicJwk(publicJwk);
      if (!canonicalJwk) return null;
      const existing = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ?`).get(deviceId);
      if (existing && existing.user_id !== userId) return null;
      const recoveryId = String(deviceId).startsWith("device:recovery:");
      if (recoveryId) {
        if (!existing || existing.device_kind !== "recovery" || existing.status !== "active" || existing.public_jwk !== canonicalJwk) return null;
        this.db.prepare(`UPDATE chat_devices SET label = ?, last_seen_at = unixepoch() WHERE device_id = ? AND user_id = ? AND status = 'active'`).run(label, deviceId, userId);
        const restored = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ? AND user_id = ?`).get(deviceId, userId);
        return { ...restored, public_jwk: JSON.parse(restored.public_jwk) };
      }
      if (existing?.device_kind === "recovery") return null;
      if (existing) {
        if (existing.device_kind !== "primary" || existing.status === "revoked" || existing.public_jwk !== canonicalJwk) return null;
        this.db.prepare(`UPDATE chat_devices SET label = ?, status = 'active', last_seen_at = unixepoch()
          WHERE device_id = ? AND user_id = ? AND device_kind = 'primary' AND status <> 'revoked' AND public_jwk = ?`)
          .run(label, deviceId, userId, canonicalJwk);
        const row = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ? AND user_id = ?`).get(deviceId, userId);
        return row?.status === "active" ? { ...row, public_jwk: JSON.parse(row.public_jwk) } : null;
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const collision = this.db.prepare(`SELECT 1 FROM chat_devices WHERE device_id = ?`).get(deviceId);
        const activeCount = Number(this.db.prepare(`SELECT COUNT(*) count FROM chat_devices WHERE user_id = ? AND status = 'active'`).get(userId).count);
        if (collision || activeCount >= MAX_ACTIVE_CHAT_DEVICES_PER_USER) {
          this.db.exec("COMMIT");
          return null;
        }
        this.db.prepare(`INSERT INTO chat_devices
          (device_id, user_id, label, public_jwk, device_kind, status, last_seen_at, revoked_at, activated_at)
          VALUES (?, ?, ?, ?, 'primary', 'active', unixepoch(), NULL, unixepoch())`)
          .run(deviceId, userId, label, canonicalJwk);
        this.db.prepare(`UPDATE users SET chat_key_epoch = chat_key_epoch + 1 WHERE id = ?`).run(userId);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      const row = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ? AND user_id = ?`).get(deviceId, userId);
      if (!row || row.public_jwk !== canonicalJwk || row.status !== "active") return null;
      return { ...row, public_jwk: JSON.parse(row.public_jwk) };
    },
    expirePendingRecoveryDevices(userId, atSeconds = Math.floor(Date.now() / 1000)) {
      const result = this.db.prepare(`UPDATE chat_devices
        SET status = 'expired', activation_token_hash = NULL
        WHERE user_id = ? AND device_kind = 'recovery' AND status = 'pending_recovery'
          AND activation_expires_at IS NOT NULL AND activation_expires_at <= ?`).run(userId, atSeconds);
      this.db.prepare(`UPDATE chat_devices SET activation_token_hash = NULL
        WHERE user_id = ? AND device_kind = 'recovery' AND status = 'active'
          AND activation_token_hash IS NOT NULL AND activation_expires_at <= ?`).run(userId, atSeconds);
      return Number(result.changes);
    },
    createPendingRecoveryDevice(userId, { deviceId, label = "Recovery key · pending", publicJwk, activationTokenHash, expiresAt, atSeconds = Math.floor(Date.now() / 1000) }) {
      const canonicalJwk = canonicalChatPublicJwk(publicJwk);
      if (!/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(String(deviceId)) || !canonicalJwk || !/^[a-f0-9]{64}$/.test(String(activationTokenHash))
        || !Number.isSafeInteger(Number(expiresAt)) || Number(expiresAt) <= atSeconds || Number(expiresAt) > atSeconds + RECOVERY_DEVICE_PENDING_TTL_SECONDS) return { ok: false, error: "invalid" };
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`UPDATE chat_devices SET status = 'expired', activation_token_hash = NULL
          WHERE user_id = ? AND device_kind = 'recovery' AND status = 'pending_recovery' AND activation_expires_at <= ?`).run(userId, atSeconds);
        const existing = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ?`).get(deviceId);
        if (existing) {
          const replay = existing.user_id === userId && existing.device_kind === "recovery" && existing.status === "pending_recovery"
            && existing.public_jwk === canonicalJwk && existing.activation_token_hash === activationTokenHash;
          this.db.exec("COMMIT");
          return replay ? { ok: true, replay: true, device: { ...existing, public_jwk: JSON.parse(existing.public_jwk) } } : { ok: false, error: "conflict" };
        }
        const count = Number(this.db.prepare(`SELECT COUNT(*) count FROM chat_devices
          WHERE user_id = ? AND device_kind = 'recovery' AND status IN ('pending_recovery','active')`).get(userId).count);
        if (count >= MAX_RECOVERY_DEVICES_PER_USER) {
          this.db.exec("COMMIT");
          return { ok: false, error: "limit" };
        }
        this.db.prepare(`INSERT INTO chat_devices
          (device_id, user_id, label, public_jwk, device_kind, status, registered_at, last_seen_at, activation_token_hash, activation_expires_at)
          VALUES (?, ?, ?, ?, 'recovery', 'pending_recovery', ?, ?, ?, ?)`)
          .run(deviceId, userId, label, canonicalJwk, atSeconds, atSeconds, activationTokenHash, Number(expiresAt));
        const row = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ?`).get(deviceId);
        this.db.exec("COMMIT");
        return { ok: true, replay: false, device: { ...row, public_jwk: JSON.parse(row.public_jwk) } };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    activateRecoveryDevice(userId, { deviceId, activationTokenHash, atSeconds = Math.floor(Date.now() / 1000) }) {
      if (!/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(String(deviceId)) || !/^[a-f0-9]{64}$/.test(String(activationTokenHash))) return { ok: false, error: "invalid" };
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`UPDATE chat_devices SET status = 'expired', activation_token_hash = NULL
          WHERE user_id = ? AND device_id = ? AND device_kind = 'recovery' AND status = 'pending_recovery' AND activation_expires_at <= ?`).run(userId, deviceId, atSeconds);
        this.db.prepare(`UPDATE chat_devices SET activation_token_hash = NULL
          WHERE user_id = ? AND device_id = ? AND device_kind = 'recovery' AND status = 'active' AND activation_expires_at <= ?`).run(userId, deviceId, atSeconds);
        const row = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ? AND user_id = ? AND device_kind = 'recovery'`).get(deviceId, userId);
        if (!row) { this.db.exec("COMMIT"); return { ok: false, error: "not_found" }; }
        if (row.status === "active") {
          const replay = row.activation_token_hash === activationTokenHash && Number(row.activation_expires_at) > atSeconds;
          this.db.exec("COMMIT");
          return replay ? { ok: true, replay: true, device: { ...row, public_jwk: JSON.parse(row.public_jwk) } } : { ok: false, error: "denied" };
        }
        if (row.status === "expired") { this.db.exec("COMMIT"); return { ok: false, error: "expired" }; }
        if (row.status !== "pending_recovery" || row.activation_token_hash !== activationTokenHash) { this.db.exec("COMMIT"); return { ok: false, error: "denied" }; }
        const activeCount = Number(this.db.prepare(`SELECT COUNT(*) count FROM chat_devices WHERE user_id = ? AND status = 'active'`).get(userId).count);
        if (activeCount >= MAX_ACTIVE_CHAT_DEVICES_PER_USER) { this.db.exec("COMMIT"); return { ok: false, error: "limit" }; }
        this.db.prepare(`UPDATE chat_devices SET status = 'active', activated_at = ?, last_seen_at = ?
          WHERE device_id = ? AND user_id = ? AND status = 'pending_recovery'`).run(atSeconds, atSeconds, deviceId, userId);
        this.db.prepare(`UPDATE users SET chat_key_epoch = chat_key_epoch + 1 WHERE id = ?`).run(userId);
        const active = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ?`).get(deviceId);
        this.db.exec("COMMIT");
        return { ok: true, replay: false, device: { ...active, public_jwk: JSON.parse(active.public_jwk) } };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    listChatDevices(userId, { activeOnly = false } = {}) {
      this.expirePendingRecoveryDevices(userId);
      const rows = activeOnly
        ? this.db.prepare(`SELECT * FROM chat_devices WHERE user_id = ? AND status = 'active' ORDER BY device_id`).all(userId)
        : this.db.prepare(`SELECT * FROM chat_devices WHERE user_id = ? ORDER BY registered_at, device_id`).all(userId);
      return rows.map((row) => ({ ...row, public_jwk: JSON.parse(row.public_jwk) }));
    },
    getChatDevice(deviceId) {
      const row = this.db.prepare(`SELECT * FROM chat_devices WHERE device_id = ?`).get(deviceId);
      return row ? { ...row, public_jwk: JSON.parse(row.public_jwk) } : null;
    },
    revokeChatDevice(userId, deviceId) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const device = this.db.prepare(`SELECT status FROM chat_devices WHERE user_id = ? AND device_id = ?`).get(userId, deviceId);
        const result = this.db.prepare(`
          UPDATE chat_devices SET status = 'revoked', revoked_at = unixepoch(), activation_token_hash = NULL
          WHERE user_id = ? AND device_id = ? AND status IN ('active','pending_recovery')
        `).run(userId, deviceId);
        if (result.changes === 1 && device?.status === "active") {
          this.db.prepare(`UPDATE users SET chat_key_epoch = chat_key_epoch + 1 WHERE id = ?`).run(userId);
        }
        this.db.exec("COMMIT");
        return result.changes === 1;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    conversationDeviceSet(conversationId, viewerId) {
      const conversation = this.getConversation(conversationId);
      const viewer = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, viewerId);
      if (!conversation || conversation.status !== "active" || viewer?.state !== "active") return null;
      const participants = this.db.prepare(`
        SELECT cp.user_id, u.handle, u.chat_key_epoch FROM conversation_participants cp JOIN users u ON u.id = cp.user_id
        WHERE cp.conversation_id = ? AND cp.state = 'active' AND cp.archived_at IS NULL ORDER BY cp.user_id
      `).all(conversationId);
      const materialParticipants = participants.map((participant) => ({
        user_id: Number(participant.user_id),
        handle: participant.handle,
      }));
      if (!Number.isSafeInteger(Number(conversation.key_epoch)) || Number(conversation.key_epoch) < 1
        || participants.some((participant) => !Number.isSafeInteger(Number(participant.chat_key_epoch)) || Number(participant.chat_key_epoch) < 1)) {
        return {
          conversation_id: conversationId, conversation_kind: conversation.kind, commitment: null, key_epoch: null, key_epoch_commitment: null,
          participants: materialParticipants, devices: [], users_without_devices: [], users_exceeding_device_limit: [], blocked_relationship: false,
          epoch_state_invalid: true, ready: false,
        };
      }
      for (let index = 0; index < participants.length; index += 1) {
        for (let other = index + 1; other < participants.length; other += 1) {
          if (this.isBlockedBetween(participants[index].user_id, conversation.context_persona, participants[other].user_id, conversation.context_persona)) {
            return {
              conversation_id: conversationId,
              conversation_kind: conversation.kind,
              commitment: null,
              key_epoch: Number(conversation.key_epoch),
              key_epoch_commitment: null,
              participants: materialParticipants,
              devices: [],
              users_without_devices: [],
              users_exceeding_device_limit: [],
              blocked_relationship: true,
              ready: false,
            };
          }
        }
      }
      const devices = [];
      for (const participant of participants) {
        this.expirePendingRecoveryDevices(participant.user_id);
        const ownedRows = this.db.prepare(`SELECT * FROM chat_devices
          WHERE user_id = ? AND status = 'active'
          ORDER BY device_id LIMIT ?`).all(participant.user_id, MAX_ACTIVE_CHAT_DEVICES_PER_USER + 1);
        if (ownedRows.length > MAX_ACTIVE_CHAT_DEVICES_PER_USER) {
          devices.length = 0;
          return { conversation_id: conversationId, conversation_kind: conversation.kind, commitment: null, key_epoch: Number(conversation.key_epoch), key_epoch_commitment: null, participants: materialParticipants, devices: [], users_without_devices: [], users_exceeding_device_limit: [participant.handle], blocked_relationship: false, ready: false };
        }
        const owned = [];
        try {
          for (const row of ownedRows) {
            const publicJwk = JSON.parse(row.public_jwk);
            if (canonicalChatPublicJwk(publicJwk) !== row.public_jwk) throw new Error("invalid stored chat key");
            owned.push({ ...row, public_jwk: publicJwk });
          }
        } catch {
          return {
            conversation_id: conversationId, conversation_kind: conversation.kind, commitment: null, key_epoch: Number(conversation.key_epoch), key_epoch_commitment: null,
            participants: materialParticipants, devices: [], users_without_devices: [], users_exceeding_device_limit: [], blocked_relationship: false,
            device_set_invalid: true, ready: false,
          };
        }
        for (const device of owned) devices.push({
          device_id: device.device_id,
          user_id: participant.user_id,
          handle: participant.handle,
          key_algorithm: device.key_algorithm,
          public_jwk: device.public_jwk,
        });
      }
      devices.sort((a, b) => a.device_id.localeCompare(b.device_id));
      const commitment = sha256Hex(JSON.stringify(devices.map((device) => ({
        device_id: device.device_id,
        user_id: device.user_id,
        key_algorithm: device.key_algorithm,
        public_jwk: device.public_jwk,
      }))));
      const membershipCommitment = sha256Hex(JSON.stringify(participants.map((participant) => participant.user_id)));
      const accountEpochCommitment = sha256Hex(JSON.stringify(participants.map((participant) => ({
        user_id: participant.user_id,
        chat_key_epoch: Number(participant.chat_key_epoch),
      }))));
      const keyEpochCommitment = sha256Hex(JSON.stringify({
        v: 1,
        conversation_id: conversationId,
        key_epoch: Number(conversation.key_epoch),
        membership_commitment: membershipCommitment,
        account_epoch_commitment: accountEpochCommitment,
      }));
      const usersWithoutDevices = participants.filter((participant) => !devices.some((device) => device.user_id === participant.user_id)).map((participant) => participant.handle);
      return {
        conversation_id: conversationId,
        conversation_kind: conversation.kind,
        commitment,
        key_epoch: Number(conversation.key_epoch),
        key_epoch_commitment: keyEpochCommitment,
        participants: materialParticipants,
        devices,
        users_without_devices: usersWithoutDevices,
        users_exceeding_device_limit: [],
        blocked_relationship: false,
        ready: usersWithoutDevices.length === 0,
      };
    },
    sendEncryptedConversationMessage({ conversationId, senderId, senderPersona, senderDeviceId, clientNonce, deviceSetCommitment, keyEpoch, keyEpochCommitment, envelopes, sharedCiphertext = null, encryptionMode = "e2ee_v1", attachmentMediaId = null, expiresAt = null }) {
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, senderId);
      if (!conversation || conversation.status !== "active" || membership?.state !== "active" || conversation.context_persona !== normalizePersona(senderPersona)) return { ok: false, error: "conversation_not_active" };
      const senderDevice = this.getChatDevice(senderDeviceId);
      if (!senderDevice || senderDevice.user_id !== senderId || senderDevice.status !== "active") return { ok: false, error: "sender_device_invalid" };
      if (this.conversationBlockState(conversationId).blocked) return { ok: false, error: "conversation_blocked" };
      const mode = String(encryptionMode);
      if (!new Set(["e2ee_v1", "e2ee_group_v1"]).has(mode)) return { ok: false, error: "encryption_mode_invalid" };
      if ((conversation.kind === "group") !== (mode === "e2ee_group_v1")) return { ok: false, error: "encryption_mode_downgrade" };
      if (!Number.isSafeInteger(Number(keyEpoch)) || Number(keyEpoch) < 1 || !/^[a-f0-9]{64}$/.test(String(keyEpochCommitment))) return { ok: false, error: "key_epoch_invalid" };
      if (!Array.isArray(envelopes)) return { ok: false, error: "device_coverage_invalid" };
      const expiry = expiresAt == null ? null : Number(expiresAt);
      if (expiry !== null && (!Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000))) return { ok: false, error: "expiry_invalid" };
      const normalizedShared = mode === "e2ee_group_v1" ? {
        iv_b64: String(sharedCiphertext?.iv_b64 ?? ""),
        ciphertext_b64: String(sharedCiphertext?.ciphertext_b64 ?? ""),
        aad_sha256: String(sharedCiphertext?.aad_sha256 ?? ""),
        ciphertext_sha256: String(sharedCiphertext?.ciphertext_sha256 ?? ""),
      } : null;
      const encryptedRequestCommitment = sha256Hex(JSON.stringify({
        v: 2,
        encryption_mode: mode,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_persona: normalizePersona(senderPersona),
        sender_device_id: senderDeviceId,
        client_nonce: clientNonce,
        device_set_commitment: deviceSetCommitment,
        key_epoch: Number(keyEpoch),
        key_epoch_commitment: keyEpochCommitment,
        attachment_media_id: attachmentMediaId == null ? null : Number(attachmentMediaId),
        expires_at: expiry,
        shared_ciphertext: normalizedShared,
        envelopes: envelopes.map((envelope) => ({
          recipient_device_id: String(envelope?.recipient_device_id ?? ""),
          iv_b64: String(envelope?.iv_b64 ?? ""),
          ciphertext_b64: String(envelope?.ciphertext_b64 ?? ""),
          aad_sha256: String(envelope?.aad_sha256 ?? ""),
        })).sort((left, right) => left.recipient_device_id.localeCompare(right.recipient_device_id)),
      }));
      const replay = this.db.prepare(`SELECT id, conversation_id, encrypted_request_commitment FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
      if (replay) {
        if (replay.conversation_id !== conversationId || replay.encrypted_request_commitment !== encryptedRequestCommitment) return { ok: false, error: "nonce_conflict" };
        return { ok: true, replay: true, message: this.getConversationMessage(replay.id) };
      }
      if (attachmentMediaId != null) {
        const media = this.getMediaById(Number(attachmentMediaId));
        if (!media || media.scan_status !== "ready_client_encrypted" || media.mime !== "application/vnd.nexus.e2ee" || media.kind !== "encrypted" || !this.hasMediaUploadGrant(media.id, senderId, "message_e2ee_attachment", senderPersona)) {
          return { ok: false, error: "encrypted_attachment_invalid" };
        }
      }
      const currentSet = this.conversationDeviceSet(conversationId, senderId);
      if (!currentSet?.ready) return { ok: false, error: currentSet?.blocked_relationship ? "conversation_blocked" : "device_set_stale" };
      if (currentSet.key_epoch !== Number(keyEpoch) || currentSet.key_epoch_commitment !== keyEpochCommitment) return { ok: false, error: "key_epoch_stale" };
      if (currentSet.commitment !== deviceSetCommitment) return { ok: false, error: "device_set_stale" };
      const expected = currentSet.devices.map((device) => device.device_id).sort();
      const presented = [...new Set(envelopes.map((envelope) => envelope.recipient_device_id))].sort();
      if (presented.length !== envelopes.length || JSON.stringify(expected) !== JSON.stringify(presented)) return { ok: false, error: "device_coverage_invalid" };
      if (mode === "e2ee_group_v1") {
        const sharedAad = JSON.stringify({
          v: 3,
          conversation_id: conversationId,
          client_nonce: clientNonce,
          sender_device_id: senderDeviceId,
          device_set_commitment: deviceSetCommitment,
          key_epoch: Number(keyEpoch),
          key_epoch_commitment: keyEpochCommitment,
        });
        const sharedCipherBytes = /^[A-Za-z0-9+/]+={0,2}$/.test(normalizedShared.ciphertext_b64)
          ? Buffer.from(normalizedShared.ciphertext_b64, "base64") : null;
        if (!/^[A-Za-z0-9+/]{16}$/.test(normalizedShared.iv_b64)
          || !sharedCipherBytes || sharedCipherBytes.length < 17 || sharedCipherBytes.length > 65_536
          || sharedCipherBytes.toString("base64") !== normalizedShared.ciphertext_b64
          || normalizedShared.aad_sha256 !== sha256Hex(sharedAad)
          || normalizedShared.ciphertext_sha256 !== sha256Hex(sharedCipherBytes)) {
          return { ok: false, error: "shared_ciphertext_invalid" };
        }
      } else if (sharedCiphertext != null) {
        return { ok: false, error: "shared_ciphertext_unexpected" };
      }
      for (const envelope of envelopes) {
        const binding = {
          v: mode === "e2ee_group_v1" ? 3 : 2,
          conversation_id: conversationId,
          client_nonce: clientNonce,
          sender_device_id: senderDeviceId,
          recipient_device_id: envelope.recipient_device_id,
          device_set_commitment: deviceSetCommitment,
          key_epoch: Number(keyEpoch),
          key_epoch_commitment: keyEpochCommitment,
        };
        if (mode === "e2ee_group_v1") {
          binding.purpose = "content_key";
          binding.shared_ciphertext_sha256 = normalizedShared.ciphertext_sha256;
          binding.shared_aad_sha256 = normalizedShared.aad_sha256;
        }
        const expectedAad = sha256Hex(JSON.stringify(binding));
        if (!/^[A-Za-z0-9+/]{16}={0,2}$/.test(String(envelope.iv_b64)) || !/^[A-Za-z0-9+/]+={0,2}$/.test(String(envelope.ciphertext_b64)) || String(envelope.ciphertext_b64).length > 16_384 || envelope.aad_sha256 !== expectedAad) {
          return { ok: false, error: "ciphertext_envelope_invalid" };
        }
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        if (this.conversationBlockState(conversationId).blocked) throw new Error("conversation_blocked");
        const lockedReplay = this.db.prepare(`SELECT id, conversation_id, encrypted_request_commitment FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
        if (lockedReplay) {
          this.db.exec("COMMIT");
          if (lockedReplay.conversation_id !== conversationId || lockedReplay.encrypted_request_commitment !== encryptedRequestCommitment) return { ok: false, error: "nonce_conflict" };
          return { ok: true, replay: true, message: this.getConversationMessage(lockedReplay.id) };
        }
        const recheck = this.conversationDeviceSet(conversationId, senderId);
        if (!recheck?.ready) throw new Error(recheck?.blocked_relationship ? "conversation_blocked" : "device_set_stale");
        if (recheck.key_epoch !== Number(keyEpoch) || recheck.key_epoch_commitment !== keyEpochCommitment) throw new Error("key_epoch_stale");
        if (recheck.commitment !== deviceSetCommitment) throw new Error("device_set_stale");
        const info = this.db.prepare(`
          INSERT INTO message_items
            (conversation_id, sender_id, sender_persona, kind, body, client_nonce, encryption_mode,
             sender_device_id, device_set_commitment, key_epoch, key_epoch_commitment, attachment_media_id, expires_at,
             encrypted_request_commitment)
          VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(conversationId, senderId, normalizePersona(senderPersona), attachmentMediaId == null ? "encrypted" : "encrypted_attachment", clientNonce, mode, senderDeviceId, deviceSetCommitment, Number(keyEpoch), keyEpochCommitment, attachmentMediaId, expiry, encryptedRequestCommitment);
        const messageId = Number(info.lastInsertRowid);
        if (mode === "e2ee_group_v1") {
          this.db.prepare(`INSERT INTO message_shared_ciphertexts
            (message_id, iv_b64, ciphertext_b64, aad_sha256, ciphertext_sha256)
            VALUES (?, ?, ?, ?, ?)`)
            .run(messageId, normalizedShared.iv_b64, normalizedShared.ciphertext_b64, normalizedShared.aad_sha256, normalizedShared.ciphertext_sha256);
        }
        const insertEnvelope = this.db.prepare(`
          INSERT INTO message_ciphertext_envelopes
            (message_id, recipient_device_id, sender_device_id, iv_b64, ciphertext_b64, aad_sha256)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const envelope of envelopes) insertEnvelope.run(messageId, envelope.recipient_device_id, senderDeviceId, envelope.iv_b64, envelope.ciphertext_b64, envelope.aad_sha256);
        const addReceipt = this.db.prepare(`INSERT OR IGNORE INTO message_receipts (message_id, user_id) VALUES (?, ?)`);
        const recipients = this.db.prepare(`
          SELECT user_id FROM conversation_participants
          WHERE conversation_id = ? AND state = 'active' AND archived_at IS NULL AND user_id <> ?
        `).all(conversationId, senderId);
        for (const recipient of recipients) addReceipt.run(messageId, recipient.user_id);
        this.db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ?`).run(conversationId);
        this.db.exec("COMMIT");
        return { ok: true, replay: false, message: this.getConversationMessage(messageId) };
      } catch (error) {
        this.db.exec("ROLLBACK");
        return { ok: false, error: new Set(["device_set_stale", "key_epoch_stale", "conversation_blocked"]).has(error.message) ? error.message : "encrypted_message_rejected" };
      }
    },
    getMessageEnvelope(messageId, userId, deviceId) {
      const device = this.getChatDevice(deviceId);
      if (!device || device.user_id !== userId || device.status !== "active") return null;
      const row = this.db.prepare(`
        SELECT e.*, sender.public_jwk sender_public_jwk, mi.client_nonce, mi.conversation_id,
          mi.device_set_commitment, mi.key_epoch, mi.key_epoch_commitment, mi.encryption_mode,
          shared.iv_b64 shared_iv_b64, shared.ciphertext_b64 shared_ciphertext_b64,
          shared.aad_sha256 shared_aad_sha256, shared.ciphertext_sha256 shared_ciphertext_sha256
        FROM message_ciphertext_envelopes e
        JOIN message_items mi ON mi.id = e.message_id
        JOIN chat_devices sender ON sender.device_id = e.sender_device_id
        LEFT JOIN message_shared_ciphertexts shared ON shared.message_id = mi.id
        WHERE e.message_id = ? AND e.recipient_device_id = ?
      `).get(messageId, deviceId);
      if (!row || this.conversationBlockState(row.conversation_id).blocked) return null;
      const wrappedEncoded = String(row.ciphertext_b64 ?? "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(wrappedEncoded) || wrappedEncoded.length > 16_384
        || !/^[A-Za-z0-9+/]{16}$/.test(String(row.iv_b64)) || !/^[a-f0-9]{64}$/.test(String(row.aad_sha256))) return null;
      const wrappedBytes = Buffer.from(wrappedEncoded, "base64");
      if (wrappedBytes.toString("base64") !== wrappedEncoded) return null;
      if (row.encryption_mode === "e2ee_group_v1") {
        const sharedEncoded = String(row.shared_ciphertext_b64 ?? "");
        if (sharedEncoded.length < 24 || sharedEncoded.length > 87_384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(sharedEncoded)) return null;
        const sharedBytes = Buffer.from(sharedEncoded, "base64");
        const expectedSharedAad = sha256Hex(JSON.stringify({
          v: 3,
          conversation_id: row.conversation_id,
          client_nonce: row.client_nonce,
          sender_device_id: row.sender_device_id,
          device_set_commitment: row.device_set_commitment,
          key_epoch: Number(row.key_epoch),
          key_epoch_commitment: row.key_epoch_commitment,
        }));
        if (!/^[A-Za-z0-9+/]{16}$/.test(String(row.shared_iv_b64))
          || sharedBytes.length < 17 || sharedBytes.length > 65_536
          || sharedBytes.toString("base64") !== sharedEncoded
          || row.shared_aad_sha256 !== expectedSharedAad
          || row.shared_ciphertext_sha256 !== sha256Hex(sharedBytes)) return null;
      }
      try {
        const senderPublicJwk = JSON.parse(row.sender_public_jwk);
        return canonicalChatPublicJwk(senderPublicJwk) === row.sender_public_jwk ? { ...row, sender_public_jwk: senderPublicJwk } : null;
      } catch {
        return null;
      }
    },

    // ---- unified conversations ----
    getConversation(id) {
      return this.db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) ?? null;
    },
    isConversationParticipant(conversationId, userId) {
      return Boolean(this.db.prepare(`
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL
      `).get(conversationId, userId));
    },
    conversationBlockState(conversationId) {
      const conversation = this.getConversation(conversationId);
      if (!conversation) return { blocked: true, reason: "conversation_not_found" };
      const participants = this.db.prepare(`
        SELECT user_id FROM conversation_participants
        WHERE conversation_id = ? AND archived_at IS NULL
          AND (state = 'active' OR (? = 'direct' AND state = 'pending'))
        ORDER BY user_id
      `).all(conversationId, conversation.kind);
      for (let index = 0; index < participants.length; index += 1) {
        for (let other = index + 1; other < participants.length; other += 1) {
          if (this.isBlockedBetween(participants[index].user_id, conversation.context_persona, participants[other].user_id, conversation.context_persona)) {
            return { blocked: true, reason: "active_participant_block" };
          }
        }
      }
      return { blocked: false, reason: null };
    },
    createDirectConversation({ creatorId, recipientId, contextPersona = "social", requestRecipientId = null }) {
      contextPersona = normalizePersona(contextPersona);
      if (!this.getUserById(recipientId) || creatorId === recipientId) return null;
      const low = Math.min(creatorId, recipientId);
      const high = Math.max(creatorId, recipientId);
      const directKey = `${low}:${high}:${contextPersona}`;
      const requested = Number(requestRecipientId) === recipientId;
      this.db.prepare(`
        INSERT OR IGNORE INTO conversations
          (kind, context_persona, direct_key, created_by, status, request_recipient_id)
        VALUES ('direct', ?, ?, ?, ?, ?)
      `).run(contextPersona, directKey, creatorId, requested ? "request" : "active", requested ? recipientId : null);
      const conversation = this.db.prepare(`SELECT * FROM conversations WHERE direct_key = ?`).get(directKey);
      const add = this.db.prepare(`
        INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, role, state)
        VALUES (?, ?, ?, ?)
      `);
      add.run(conversation.id, creatorId, "member", "active");
      add.run(conversation.id, recipientId, "member", requested ? "pending" : "active");
      if (conversation.status === "declined") return null;
      return this.getConversationDetails(conversation.id, creatorId);
    },
    createGroupConversation({ creatorId, memberIds, title, contextPersona = "social" }) {
      contextPersona = normalizePersona(contextPersona);
      const members = [...new Set([creatorId, ...memberIds.map(Number)])]
        .filter((id) => Number.isInteger(id) && this.getUserById(id));
      if (members.length < 3 || members.length > MAX_GROUP_CONVERSATION_MEMBERS) return null;
      const info = this.db.prepare(`
        INSERT INTO conversations (kind, title, context_persona, created_by)
        VALUES ('group', ?, ?, ?)
      `).run(title, contextPersona, creatorId);
      const conversationId = Number(info.lastInsertRowid);
      const add = this.db.prepare(`
        INSERT INTO conversation_participants (conversation_id, user_id, role, state)
        VALUES (?, ?, ?, ?)
      `);
      for (const userId of members) add.run(conversationId, userId, userId === creatorId ? "owner" : "member", userId === creatorId ? "active" : "pending");
      return this.getConversationDetails(conversationId, creatorId);
    },
    getConversationDetails(conversationId, viewerId) {
      const conversation = this.getConversation(conversationId);
      if (!conversation || !this.isConversationParticipant(conversationId, viewerId)) return null;
      const participantRows = this.db.prepare(`
        SELECT u.id, u.handle, COALESCE(pp.name, u.display_name) display_name,
          pp.avatar, pp.orbit_mood, pp.orbit_place,
          pp.orbit_now, pp.orbit_fandom, pp.orbit_quote, pp.orbit_expires_at, cp.role, cp.state, cp.joined_at,
          cp.history_start_message_id, cp.last_read_message_id,
          pr.last_seen_at
        FROM conversation_participants cp JOIN users u ON u.id = cp.user_id
        LEFT JOIN personas pp ON pp.user_id = u.id AND pp.persona = ?
        LEFT JOIN chat_presence pr ON pr.user_id = u.id AND pr.persona = ?
        WHERE cp.conversation_id = ? AND cp.archived_at IS NULL
        ORDER BY CASE cp.role WHEN 'owner' THEN 0 ELSE 1 END, u.handle
      `).all(conversation.context_persona, conversation.context_persona, conversationId);
      const participants = participantRows.map((participant) => ({
        ...participant,
        earned_sigil: this.sigilProgress(participant.id, conversation.context_persona),
      }));
      const membership = participants.find((participant) => participant.id === viewerId);
      const pendingGroup = conversation.kind === "group" && membership?.state === "pending";
      const blocked = this.conversationBlockState(conversationId).blocked;
      const lastMessage = pendingGroup || blocked ? null : (this.db.prepare(`
        SELECT mi.*, u.handle sender_handle
        FROM message_items mi JOIN users u ON u.id = mi.sender_id
        WHERE mi.conversation_id = ? AND mi.id > ? ORDER BY mi.id DESC LIMIT 1
      `).get(conversationId, Number(membership?.history_start_message_id ?? 0)) ?? null);
      const unread = pendingGroup || blocked ? 0 : this.db.prepare(`
        SELECT COUNT(*) count FROM message_items
        WHERE conversation_id = ? AND sender_id <> ? AND id > ? AND id > ?
      `).get(conversationId, viewerId, Number(membership?.last_read_message_id ?? 0), Number(membership?.history_start_message_id ?? 0)).count;
      return {
        ...conversation,
        participants,
        last_message: redactExpiredChatMessage(lastMessage),
        unread,
        blocked,
        typing: pendingGroup || blocked ? [] : this.listTypingIndicators(conversationId, viewerId),
      };
    },
    listUnifiedConversations(userId, { persona = "all", box = "inbox", limit = 100, beforeUpdatedAt = null, beforeId = null, query = '' } = {}) {
      const params = [userId];
      let personaClause = "";
      if (persona !== "all") {
        personaClause = "AND c.context_persona = ?";
        params.push(normalizePersona(persona));
      }
      let boxClause = `AND c.status = 'active' AND NOT EXISTS (
        SELECT 1 FROM conversation_participants pending_self
        WHERE pending_self.conversation_id = c.id AND pending_self.user_id = ?
          AND pending_self.state = 'pending' AND pending_self.archived_at IS NULL
      )`;
      params.push(userId);
      if (box === "requests") boxClause = `AND (
        (c.status = 'request' AND c.request_recipient_id = ?)
        OR EXISTS (
          SELECT 1 FROM conversation_participants pending
          WHERE pending.conversation_id = c.id AND pending.user_id = ? AND pending.state = 'pending' AND pending.archived_at IS NULL
        )
      )`;
      else if (box === "sent") boxClause = "AND c.status = 'request' AND c.created_by = ?";
      if (box === "requests") {
        params.pop();
        params.push(userId, userId);
      } else if (box === "sent") {
        params.pop();
        params.push(userId);
      }
      let cursorClause = "";
      if (Number.isSafeInteger(Number(beforeUpdatedAt)) && Number(beforeUpdatedAt) > 0 && Number.isSafeInteger(Number(beforeId)) && Number(beforeId) > 0) {
        cursorClause = "AND (c.updated_at < ? OR (c.updated_at = ? AND c.id < ?))";
        params.push(Number(beforeUpdatedAt), Number(beforeUpdatedAt), Number(beforeId));
      }
      let searchClause = '';
      if (query) {
        const needle = String(query).replace(/^@/, '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('ro').slice(0, 80);
        searchClause = `AND (instr(nexus_chat_fold(c.title), ?) > 0 OR EXISTS (
          SELECT 1 FROM conversation_participants peer JOIN users u ON u.id = peer.user_id
          LEFT JOIN personas pp ON pp.user_id = u.id AND pp.persona = c.context_persona
          WHERE peer.conversation_id = c.id AND peer.archived_at IS NULL AND peer.user_id <> ?
            AND (instr(nexus_chat_fold(u.handle), ?) > 0 OR instr(nexus_chat_fold(COALESCE(pp.name, u.display_name)), ?) > 0)
        )) AND NOT EXISTS (
          SELECT 1 FROM profile_blocks b
          JOIN conversation_participants blocker ON blocker.user_id = b.blocker_id AND blocker.conversation_id = c.id
          JOIN conversation_participants blocked ON blocked.user_id = b.blocked_id AND blocked.conversation_id = c.id
          WHERE b.blocker_persona = c.context_persona AND blocker.archived_at IS NULL AND blocked.archived_at IS NULL
            AND (blocker.state = 'active' OR c.kind = 'direct') AND (blocked.state = 'active' OR c.kind = 'direct')
        )`;
        params.push(needle, userId, needle, needle);
      }
      params.push(Math.min(Math.max(Number(limit) || 100, 1), 200));
      const rows = this.db.prepare(`
        SELECT c.id FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE cp.user_id = ? AND cp.archived_at IS NULL ${personaClause} ${boxClause} ${cursorClause} ${searchClause}
        ORDER BY c.updated_at DESC, c.id DESC LIMIT ?
      `).all(...params);
      return rows.map((row) => this.getConversationDetails(row.id, userId));
    },
    searchConversationMessages(userId, { persona = "all", query, beforeId = null, limit = 20 } = {}) {
      const normalized = String(query || "").trim().normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('ro').replace(/[%_]/g, "").slice(0, 80);
      if (normalized.length < 2) return [];
      const params = [userId, `%${normalized}%`];
      let personaClause = "";
      if (persona !== "all") { personaClause = "AND c.context_persona = ?"; params.push(normalizePersona(persona)); }
      let cursorClause = "";
      if (Number.isSafeInteger(Number(beforeId)) && Number(beforeId) > 0) { cursorClause = "AND mi.id < ?"; params.push(Number(beforeId)); }
      params.push(Math.min(Math.max(Number(limit) || 20, 1), 50));
      const rows = this.db.prepare(`SELECT mi.id, mi.conversation_id, mi.sender_id, mi.sender_persona, mi.body, mi.created_at, u.handle sender_handle
        FROM message_items mi
        JOIN conversations c ON c.id = mi.conversation_id
        JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ? AND cp.archived_at IS NULL
        JOIN users u ON u.id = mi.sender_id
        WHERE cp.state = 'active' AND c.status = 'active' AND mi.status <> 'expired'
          AND mi.encryption_mode = 'plaintext_local' AND mi.id > cp.history_start_message_id
          AND (mi.expires_at IS NULL OR mi.expires_at > unixepoch())
          AND nexus_chat_fold(mi.body) LIKE ? ${personaClause} ${cursorClause}
          AND NOT EXISTS (
            SELECT 1 FROM profile_blocks b
            JOIN conversation_participants blocker ON blocker.user_id = b.blocker_id AND blocker.conversation_id = c.id
            JOIN conversation_participants blocked ON blocked.user_id = b.blocked_id AND blocked.conversation_id = c.id
            WHERE b.blocker_persona = c.context_persona AND blocker.archived_at IS NULL AND blocked.archived_at IS NULL
              AND (blocker.state = 'active' OR c.kind = 'direct') AND (blocked.state = 'active' OR c.kind = 'direct')
          )
        ORDER BY mi.id DESC LIMIT ?`).all(...params);
      return rows.filter((row) => !this.conversationBlockState(row.conversation_id).blocked)
        .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 50));
    },
    sendConversationMessage({ conversationId, senderId, senderPersona, body = "", kind = "text", attachmentMediaId = null, clientNonce, expiresAt = null }) {
      if (!this.isConversationParticipant(conversationId, senderId)) return null;
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, senderId);
      if (!conversation || conversation.status === "declined" || conversation.context_persona !== normalizePersona(senderPersona)) return null;
      if (membership?.state !== "active") return null;
      if (this.conversationBlockState(conversationId).blocked) return null;
      const replay = this.db.prepare(`SELECT id, conversation_id FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
      if (replay) return replay.conversation_id === conversationId ? this.getConversationMessage(replay.id) : null;
      if (conversation.status === "request") {
        if (conversation.created_by !== senderId) return null;
        const existing = this.db.prepare(`SELECT COUNT(*) count FROM message_items WHERE conversation_id = ?`).get(conversationId).count;
        if (existing >= 1) return null;
      }
      const safeKinds = new Set(["text", "image", "video", "file"]);
      if (!safeKinds.has(kind) || (!body && !attachmentMediaId)) return null;
      if (attachmentMediaId) {
        const media = this.getMediaById(attachmentMediaId);
        if (!media || media.scan_status !== "ready_local_validation" || !this.hasMediaUploadGrant(attachmentMediaId, senderId, "message_attachment", senderPersona)) return null;
      }
      const expiry = expiresAt == null ? null : Number(expiresAt);
      if (expiry !== null && (!Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000))) return null;
      try {
        this.db.exec("BEGIN IMMEDIATE");
        const lockedConversation = this.getConversation(conversationId);
        const lockedMembership = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, senderId);
        if (!lockedConversation || lockedConversation.status === "declined" || lockedConversation.context_persona !== normalizePersona(senderPersona)
          || lockedMembership?.state !== "active" || this.conversationBlockState(conversationId).blocked) {
          this.db.exec("COMMIT");
          return null;
        }
        const lockedReplay = this.db.prepare(`SELECT id, conversation_id FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
        if (lockedReplay) {
          this.db.exec("COMMIT");
          return lockedReplay.conversation_id === conversationId ? this.getConversationMessage(lockedReplay.id) : null;
        }
        if (lockedConversation.status === "request") {
          const existing = this.db.prepare(`SELECT COUNT(*) count FROM message_items WHERE conversation_id = ?`).get(conversationId).count;
          if (lockedConversation.created_by !== senderId || existing >= 1) {
            this.db.exec("COMMIT");
            return null;
          }
        }
        const info = this.db.prepare(`
          INSERT INTO message_items
            (conversation_id, sender_id, sender_persona, kind, body, attachment_media_id, client_nonce, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(conversationId, senderId, normalizePersona(senderPersona), kind, body, attachmentMediaId, clientNonce, expiry);
        const messageId = Number(info.lastInsertRowid);
        const addReceipt = this.db.prepare(`
          INSERT OR IGNORE INTO message_receipts (message_id, user_id) VALUES (?, ?)
        `);
        const recipients = this.db.prepare(`
          SELECT user_id FROM conversation_participants
          WHERE conversation_id = ? AND user_id <> ? AND archived_at IS NULL
        `).all(conversationId, senderId);
        for (const recipient of recipients) addReceipt.run(messageId, recipient.user_id);
        this.db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ?`).run(conversationId);
        this.db.exec("COMMIT");
        return this.getConversationMessage(messageId);
      } catch (error) {
        if (this.db.isTransaction) this.db.exec("ROLLBACK");
        if (String(error.message).includes("UNIQUE")) {
          const existing = this.db.prepare(`SELECT id, conversation_id FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
          return existing?.conversation_id === conversationId ? this.getConversationMessage(existing.id) : null;
        }
        throw error;
      }
    },
    getConversationMessageByNonce(senderId, clientNonce, conversationId) {
      const row = this.db.prepare(`SELECT id, conversation_id FROM message_items WHERE sender_id = ? AND client_nonce = ?`).get(senderId, clientNonce);
      if (!row || Number(row.conversation_id) !== Number(conversationId)) return null;
      return this.getConversationMessage(row.id);
    },
    getConversationMessage(id) {
      const row = this.db.prepare(`
        SELECT mi.*, u.handle sender_handle, u.display_name sender_display_name, m.hash media_hash,
          m.ext media_ext, m.mime media_mime, m.kind media_kind
        FROM message_items mi JOIN users u ON u.id = mi.sender_id
        LEFT JOIN media m ON m.id = mi.attachment_media_id WHERE mi.id = ?
      `).get(id);
      if (!row) return null;
      const receipts = this.db.prepare(`
        SELECT user_id, delivered_at, read_at FROM message_receipts WHERE message_id = ? ORDER BY user_id
      `).all(id);
      return { ...row, attachment_url: row.media_hash ? `/media/${row.media_hash}.${row.media_ext}` : null, receipts };
    },
    listConversationMessages(conversationId, viewerId, limit = 200, aroundMessageId = null) {
      if (!this.isConversationParticipant(conversationId, viewerId)) return null;
      if (this.conversationBlockState(conversationId).blocked) return null;
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state, history_start_message_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, viewerId);
      if (conversation?.kind === "group" && membership?.state === "pending") return [];
      const boundary = Number(membership?.history_start_message_id ?? 0);
      const bounded = Math.min(Math.max(Number(limit) || 200, 1), 500);
      const readMessage = (row) => redactExpiredChatMessage(this.getConversationMessage(row.id));
      if (aroundMessageId !== null) {
        const target = this.db.prepare(`SELECT id FROM message_items WHERE id = ? AND conversation_id = ? AND id > ?
          AND status <> 'expired' AND (expires_at IS NULL OR expires_at > unixepoch())`).get(aroundMessageId, conversationId, boundary);
        if (!target) return null;
        const before = this.db.prepare('SELECT id FROM message_items WHERE conversation_id = ? AND id > ? AND id < ? ORDER BY id DESC LIMIT ?')
          .all(conversationId, boundary, target.id, Math.floor(bounded / 2)).reverse();
        const after = this.db.prepare('SELECT id FROM message_items WHERE conversation_id = ? AND id >= ? ORDER BY id ASC LIMIT ?')
          .all(conversationId, target.id, bounded - before.length);
        return [...before, ...after].map(readMessage);
      }
      const rows = this.db.prepare(`
        SELECT id FROM message_items WHERE conversation_id = ? AND id > ? ORDER BY id DESC LIMIT ?
      `).all(conversationId, boundary, bounded).reverse();
      return rows.map(readMessage);
    },
    markConversationDelivered(conversationId, userId, atSeconds = Math.floor(Date.now() / 1000)) {
      if (!this.isConversationParticipant(conversationId, userId)) return false;
      if (this.conversationBlockState(conversationId).blocked) return false;
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state, history_start_message_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, userId);
      if (conversation?.kind === "group" && membership?.state === "pending") return true;
      this.db.prepare(`
        UPDATE message_receipts SET delivered_at = COALESCE(delivered_at, ?)
        WHERE user_id = ? AND message_id IN (
          SELECT id FROM message_items WHERE conversation_id = ? AND sender_id <> ? AND id > ?
        )
      `).run(atSeconds, userId, conversationId, userId, Number(membership?.history_start_message_id ?? 0));
      return true;
    },
    markConversationRead(conversationId, userId, throughMessageId = null) {
      if (!this.isConversationParticipant(conversationId, userId)) return false;
      if (this.conversationBlockState(conversationId).blocked) return false;
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state, history_start_message_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, userId);
      if (conversation?.kind === "group" && membership?.state === "pending") return throughMessageId == null || Number(throughMessageId) === 0;
      const historyStart = Number(membership?.history_start_message_id ?? 0);
      const head = this.db.prepare(`SELECT MAX(id) id FROM message_items WHERE conversation_id = ? AND id > ?`).get(conversationId, historyStart).id ?? 0;
      const through = throughMessageId == null ? Number(head) : Number(throughMessageId);
      if (!Number.isSafeInteger(through) || through < 0 || through > Number(head)) return false;
      if (through > 0 && !this.db.prepare(`SELECT 1 FROM message_items WHERE conversation_id = ? AND id = ? AND id > ?`).get(conversationId, through, historyStart)) return false;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        if (this.conversationBlockState(conversationId).blocked) {
          this.db.exec("ROLLBACK");
          return false;
        }
        this.db.prepare(`
          UPDATE conversation_participants SET last_read_message_id = MAX(COALESCE(last_read_message_id, 0), ?)
          WHERE conversation_id = ? AND user_id = ?
        `).run(through, conversationId, userId);
        const atSeconds = Math.floor(Date.now() / 1000);
        this.db.prepare(`
          UPDATE message_receipts SET delivered_at = COALESCE(delivered_at, ?), read_at = COALESCE(read_at, ?)
          WHERE user_id = ? AND message_id IN (
            SELECT id FROM message_items WHERE conversation_id = ? AND sender_id <> ? AND id > ? AND id <= ?
          )
        `).run(atSeconds, atSeconds, userId, conversationId, userId, historyStart, through);
        this.db.exec("COMMIT");
        return true;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    purgeExpiredMessages(atSeconds = Math.floor(Date.now() / 1000)) {
      const expired = this.db.prepare(`
        SELECT id FROM message_items WHERE status <> 'expired' AND expires_at IS NOT NULL AND expires_at <= ?
      `).all(atSeconds);
      if (!expired.length) return 0;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const removeEnvelopes = this.db.prepare(`DELETE FROM message_ciphertext_envelopes WHERE message_id = ?`);
        const removeSharedCiphertext = this.db.prepare(`DELETE FROM message_shared_ciphertexts WHERE message_id = ?`);
        const expire = this.db.prepare(`
          UPDATE message_items SET body = '', attachment_media_id = NULL, status = 'expired', expired_at = ? WHERE id = ?
        `);
        for (const row of expired) {
          removeEnvelopes.run(row.id);
          removeSharedCiphertext.run(row.id);
          expire.run(atSeconds, row.id);
        }
        this.db.exec("COMMIT");
        return expired.length;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    decideConversationRequest(conversationId, userId, decision) {
      if (!new Set(["accept", "decline"]).has(decision)) return null;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const conversation = this.getConversation(conversationId);
        if (!conversation || conversation.status !== "request" || conversation.request_recipient_id !== userId) {
          this.db.exec("COMMIT");
          return null;
        }
        if (decision === "accept") {
          if (this.conversationBlockState(conversationId).blocked) {
            this.db.exec("COMMIT");
            return null;
          }
          this.db.prepare(`UPDATE conversations SET status = 'active', request_recipient_id = NULL,
            key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`).run(conversationId);
          this.db.prepare(`UPDATE conversation_participants SET state = 'active' WHERE conversation_id = ? AND user_id = ?`).run(conversationId, userId);
        } else {
          this.db.prepare(`UPDATE conversations SET status = 'declined', updated_at = unixepoch() WHERE id = ?`).run(conversationId);
          this.db.prepare(`UPDATE conversation_participants SET state = 'declined', archived_at = unixepoch() WHERE conversation_id = ? AND user_id = ?`).run(conversationId, userId);
        }
        this.db.exec("COMMIT");
        return this.getConversation(conversationId);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    decideGroupInvitation(conversationId, userId, decision) {
      if (!new Set(["accept", "decline"]).has(decision)) return null;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const conversation = this.getConversation(conversationId);
        const member = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, userId);
        if (!conversation || conversation.kind !== "group" || member?.state !== "pending") {
          this.db.exec("COMMIT");
          return null;
        }
        if (decision === "accept") {
          const activeMembers = this.db.prepare(`SELECT user_id FROM conversation_participants
            WHERE conversation_id = ? AND state = 'active' AND archived_at IS NULL`).all(conversationId);
          if (activeMembers.some((active) => this.isBlockedBetween(userId, conversation.context_persona, active.user_id, conversation.context_persona))) {
            this.db.exec("COMMIT");
            return null;
          }
          const head = this.db.prepare(`SELECT COALESCE(MAX(id), 0) id FROM message_items WHERE conversation_id = ?`).get(conversationId).id;
          this.db.prepare(`UPDATE conversation_participants SET state = 'active', joined_at = unixepoch(), history_start_message_id = ? WHERE conversation_id = ? AND user_id = ?`).run(head, conversationId, userId);
          this.db.prepare(`UPDATE conversations SET key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`).run(conversationId);
        } else {
          this.db.prepare(`UPDATE conversation_participants SET state = 'declined', archived_at = unixepoch() WHERE conversation_id = ? AND user_id = ?`).run(conversationId, userId);
        }
        this.db.exec("COMMIT");
        return this.getConversation(conversationId);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    updateGroupTitle(conversationId, actorId, title, expectedTitle) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const conversation = this.getConversation(conversationId);
        const member = this.db.prepare(`SELECT role, state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, actorId);
        const expected = arguments.length < 4 ? conversation?.title ?? null : expectedTitle ?? null;
        if (!conversation || conversation.kind !== "group" || member?.state !== "active" || !new Set(["owner", "admin"]).has(member?.role)
          || (conversation.title ?? null) !== expected) {
          this.db.exec("COMMIT");
          return null;
        }
        const changed = this.db.prepare(`UPDATE conversations SET title = ?, updated_at = unixepoch()
          WHERE id = ? AND title IS ?`).run(title, conversationId, expected).changes;
        this.db.exec("COMMIT");
        return changed === 1 ? this.getConversationDetails(conversationId, actorId) : null;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    addGroupMember(conversationId, actorId, userId, expectedKeyEpoch) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const conversation = this.getConversation(conversationId);
        const expectedEpoch = arguments.length < 4 ? Number(conversation?.key_epoch) : Number(expectedKeyEpoch);
        const actor = this.db.prepare(`SELECT role, state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, actorId);
        if (!conversation || conversation.kind !== "group" || actor?.state !== "active" || !new Set(["owner", "admin"]).has(actor?.role)
          || !this.getUserById(userId) || Number(conversation.key_epoch) !== expectedEpoch) {
          this.db.exec("COMMIT");
          return null;
        }
        const existing = this.db.prepare(`SELECT state, archived_at FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`).get(conversationId, userId);
        if (new Set(["active", "pending"]).has(existing?.state) && existing.archived_at === null) {
          this.db.exec("COMMIT");
          return this.getConversationDetails(conversationId, actorId);
        }
        const count = this.db.prepare(`SELECT COUNT(*) count FROM conversation_participants WHERE conversation_id = ? AND archived_at IS NULL`).get(conversationId).count;
        if (count >= MAX_GROUP_CONVERSATION_MEMBERS) {
          this.db.exec("COMMIT");
          return null;
        }
        this.db.prepare(`
          INSERT INTO conversation_participants (conversation_id, user_id, role, state, archived_at)
          VALUES (?, ?, 'member', 'pending', NULL)
          ON CONFLICT(conversation_id, user_id) DO UPDATE SET role = 'member', state = 'pending', archived_at = NULL
        `).run(conversationId, userId);
        const touched = this.db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ? AND key_epoch = ?`).run(conversationId, expectedEpoch).changes;
        if (touched !== 1) throw new Error("GROUP_INVITATION_EPOCH_INVARIANT_FAILED");
        this.db.exec("COMMIT");
        return this.getConversationDetails(conversationId, actorId);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    removeGroupMember(conversationId, actorId, userId, expectedKeyEpoch) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const conversation = this.getConversation(conversationId);
        const expectedEpoch = arguments.length < 4 ? Number(conversation?.key_epoch) : Number(expectedKeyEpoch);
        const actor = this.db.prepare(`SELECT role, state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, actorId);
        const target = this.db.prepare(`SELECT role, state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, userId);
        const selfLeave = actorId === userId && actor?.state === "active" && target?.role !== "owner";
        const adminRemove = actor?.state === "active" && target?.state === "active" && new Set(["owner", "admin"]).has(actor?.role) && target?.role !== "owner";
        if (!conversation || conversation.kind !== "group" || Number(conversation.key_epoch) !== expectedEpoch || (!selfLeave && !adminRemove)) {
          this.db.exec("COMMIT");
          return false;
        }
        const removed = this.db.prepare(`UPDATE conversation_participants SET state = 'left', archived_at = unixepoch() WHERE conversation_id = ? AND user_id = ? AND state = 'active'`).run(conversationId, userId).changes;
        const rotated = this.db.prepare(`UPDATE conversations SET key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch()
          WHERE id = ? AND key_epoch = ?`).run(conversationId, expectedEpoch).changes;
        if (removed !== 1 || rotated !== 1) throw new Error("GROUP_MEMBERSHIP_EPOCH_INVARIANT_FAILED");
        this.db.exec("COMMIT");
        return true;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    touchPresence(userId, persona, atSeconds = Math.floor(Date.now() / 1000)) {
      persona = normalizePersona(persona);
      this.db.prepare(`
        INSERT INTO chat_presence (user_id, persona, last_seen_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id, persona) DO UPDATE SET last_seen_at = excluded.last_seen_at
      `).run(userId, persona, atSeconds);
      return atSeconds;
    },
    profilePresenceForViewer({ viewerId, viewerPersona, ownerId, ownerPersona, ownerVisibility, atSeconds = Math.floor(Date.now() / 1000) }) {
      viewerPersona = normalizePersona(viewerPersona);
      ownerPersona = normalizePersona(ownerPersona);
      if (viewerPersona !== ownerPersona || this.isBlockedBetween(viewerId, viewerPersona, ownerId, ownerPersona)) return { visible: false, online: false };
      const follows = this.isFollowing(viewerId, ownerId, ownerPersona);
      const mutual = follows && this.isFollowing(ownerId, viewerId, ownerPersona);
      const visible = viewerId === ownerId || ownerVisibility === "public"
        || (ownerVisibility === "followers" && follows)
        || ((ownerVisibility === "friends" || ownerVisibility === "private") && mutual);
      if (!visible) return { visible: false, online: false };
      const row = this.db.prepare(`SELECT last_seen_at FROM chat_presence WHERE user_id = ? AND persona = ?`).get(ownerId, ownerPersona);
      return { visible: true, online: viewerId === ownerId || Number(row?.last_seen_at || 0) >= atSeconds - 120 };
    },
    setTypingIndicator(conversationId, userId, active, atSeconds = Math.floor(Date.now() / 1000)) {
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, userId);
      if (!conversation || conversation.status !== "active" || membership?.state !== "active" || this.conversationBlockState(conversationId).blocked) return false;
      if (active) {
        this.db.prepare(`
          INSERT INTO typing_indicators (conversation_id, user_id, expires_at) VALUES (?, ?, ?)
          ON CONFLICT(conversation_id, user_id) DO UPDATE SET expires_at = excluded.expires_at
        `).run(conversationId, userId, atSeconds + 8);
      } else {
        this.db.prepare(`DELETE FROM typing_indicators WHERE conversation_id = ? AND user_id = ?`).run(conversationId, userId);
      }
      return true;
    },
    listTypingIndicators(conversationId, viewerId, atSeconds = Math.floor(Date.now() / 1000)) {
      if (this.conversationBlockState(conversationId).blocked) return [];
      this.db.prepare(`DELETE FROM typing_indicators WHERE expires_at <= ?`).run(atSeconds);
      return this.db.prepare(`
        SELECT u.id, u.handle FROM typing_indicators ti JOIN users u ON u.id = ti.user_id
        WHERE ti.conversation_id = ? AND ti.user_id <> ? AND ti.expires_at > ? ORDER BY u.handle
      `).all(conversationId, viewerId, atSeconds);
    },
    scheduleConversationMeeting({ conversationId, creatorId, title, startsAt, durationMinutes = 30 }) {
      const conversation = this.getConversation(conversationId);
      const membership = this.db.prepare(`SELECT state FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL`).get(conversationId, creatorId);
      if (!conversation || conversation.status !== "active" || membership?.state !== "active" || this.conversationBlockState(conversationId).blocked) return null;
      const info = this.db.prepare(`
        INSERT INTO conversation_meetings (conversation_id, created_by, title, starts_at, duration_minutes)
        VALUES (?, ?, ?, ?, ?)
      `).run(conversationId, creatorId, title, startsAt, durationMinutes);
      return this.db.prepare(`SELECT * FROM conversation_meetings WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listConversationMeetings(conversationId, viewerId, limit = 100) {
      if (!this.isConversationParticipant(conversationId, viewerId) || this.conversationBlockState(conversationId).blocked) return null;
      return this.db.prepare(`
        SELECT cm.*, u.handle creator_handle FROM conversation_meetings cm
        JOIN users u ON u.id = cm.created_by WHERE cm.conversation_id = ?
        ORDER BY cm.starts_at ASC, cm.id ASC LIMIT ?
      `).all(conversationId, Math.min(Math.max(Number(limit) || 100, 1), 100));
    },

    // ---- direct WebRTC call coordination; only replay hashes, never SDP/ICE, enter SQLite ----
    expireConversationCalls(atSeconds = Math.floor(Date.now() / 1000)) {
      this.db.prepare(`DELETE FROM call_signal_replay_guard
        WHERE expires_at <= ? AND EXISTS (
          SELECT 1 FROM conversation_calls cc WHERE cc.call_id = call_signal_replay_guard.call_id
            AND cc.status IN ('declined','ended','missed','failed')
        )`).run(atSeconds);
      const missed = this.db.prepare(`
        UPDATE conversation_calls SET status = 'missed', ended_at = ?
        WHERE status = 'ringing' AND expires_at <= ?
      `).run(atSeconds, atSeconds).changes;
      const failed = this.db.prepare(`
        UPDATE conversation_calls SET status = 'failed', ended_at = ?
        WHERE status = 'active' AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          LEFT JOIN call_participant_leases cpl
            ON cpl.call_id = conversation_calls.call_id AND cpl.user_id = cp.user_id
          WHERE cp.conversation_id = conversation_calls.conversation_id
            AND cp.state = 'active' AND cp.archived_at IS NULL
            AND (cpl.user_id IS NULL OR cpl.lease_until <= ?)
        )
      `).run(atSeconds, atSeconds).changes;
      this.db.prepare(`UPDATE call_signal_replay_guard SET expires_at = ?
        WHERE call_id IN (SELECT call_id FROM conversation_calls WHERE status IN ('missed','failed')) AND expires_at > ?`)
        .run(atSeconds + 300, atSeconds + 300);
      return missed + failed;
    },
    failOpenCallsOnStartup(atSeconds = Math.floor(Date.now() / 1000)) {
      const changed = this.db.prepare(`
        UPDATE conversation_calls SET status = 'failed', ended_at = ?
        WHERE status IN ('ringing', 'active')
      `).run(atSeconds).changes;
      this.db.prepare(`UPDATE call_signal_replay_guard SET expires_at = ?
        WHERE call_id IN (SELECT call_id FROM conversation_calls WHERE status = 'failed')`).run(atSeconds + 300);
      return changed;
    },
    getConversationCall(callId, viewerId) {
      this.expireConversationCalls();
      const row = this.db.prepare(`
        SELECT cc.*, u.handle initiator_handle, c.context_persona
        FROM conversation_calls cc JOIN users u ON u.id = cc.initiated_by
        JOIN conversations c ON c.id = cc.conversation_id
        WHERE cc.call_id = ? AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = cc.conversation_id AND cp.user_id = ?
            AND cp.state = 'active' AND cp.archived_at IS NULL
        )
      `).get(callId, viewerId);
      if (!row || this.conversationBlockState(row.conversation_id).blocked) return null;
      const participants = this.db.prepare(`
        SELECT u.id, u.handle, u.display_name FROM conversation_participants cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.conversation_id = ? AND cp.state = 'active' AND cp.archived_at IS NULL
        ORDER BY u.id
      `).all(row.conversation_id);
      return { ...row, context_persona: row.context_persona ?? this.getConversation(row.conversation_id)?.context_persona, participants };
    },
    createConversationCall({ callId, conversationId, initiatorId, mode, expiresAt }) {
      if (!/^call:[A-Za-z0-9_-]{16,64}$/.test(String(callId)) || !new Set(["audio", "video"]).has(mode)) return null;
      this.expireConversationCalls();
      const conversation = this.getConversation(conversationId);
      if (!conversation || conversation.kind !== "direct" || conversation.status !== "active" || this.conversationBlockState(conversationId).blocked) return null;
      const participants = this.db.prepare(`
        SELECT user_id FROM conversation_participants
        WHERE conversation_id = ? AND state = 'active' AND archived_at IS NULL ORDER BY user_id
      `).all(conversationId);
      if (participants.length !== 2 || !participants.some((item) => item.user_id === initiatorId)) return null;
      const busy = this.db.prepare(`
        SELECT 1 FROM conversation_calls cc
        JOIN conversation_participants cp ON cp.conversation_id = cc.conversation_id
        WHERE cc.status IN ('ringing', 'active') AND cp.state = 'active' AND cp.archived_at IS NULL
          AND cp.user_id IN (?, ?)
        LIMIT 1
      `).get(participants[0].user_id, participants[1].user_id);
      if (busy) return null;
      const expiry = Number(expiresAt);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!Number.isInteger(expiry) || expiry <= nowSeconds || expiry > nowSeconds + 120) return null;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`
          INSERT INTO conversation_calls (call_id, conversation_id, initiated_by, mode, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(callId, conversationId, initiatorId, mode, expiry);
        this.db.prepare(`INSERT INTO call_participant_leases (call_id, user_id, lease_until, updated_at)
          VALUES (?, ?, ?, ?)`).run(callId, initiatorId, nowSeconds + 25, nowSeconds);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      return this.getConversationCall(callId, initiatorId);
    },
    decideConversationCall(callId, userId, decision, atSeconds = Math.floor(Date.now() / 1000)) {
      this.expireConversationCalls(atSeconds);
      const call = this.getConversationCall(callId, userId);
      if (!call || call.initiated_by === userId || call.status !== "ringing" || call.expires_at <= atSeconds) return null;
      const accepted = decision === "accept";
      if (!accepted && decision !== "decline") return null;
      const result = accepted
        ? this.db.prepare(`UPDATE conversation_calls SET status = 'active', answered_at = ? WHERE call_id = ? AND status = 'ringing'`).run(atSeconds, callId)
        : this.db.prepare(`UPDATE conversation_calls SET status = 'declined', ended_at = ?, ended_by = ? WHERE call_id = ? AND status = 'ringing'`).run(atSeconds, userId, callId);
      if (result.changes === 1 && accepted) this.db.prepare(`INSERT INTO call_participant_leases (call_id, user_id, lease_until, updated_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(call_id, user_id) DO UPDATE SET lease_until = excluded.lease_until, updated_at = excluded.updated_at`)
        .run(callId, userId, atSeconds + 25, atSeconds);
      if (result.changes === 1 && !accepted) this.db.prepare(`UPDATE call_signal_replay_guard SET expires_at = ? WHERE call_id = ?`).run(atSeconds + 300, callId);
      return result.changes === 1 ? this.getConversationCall(callId, userId) : null;
    },
    touchConversationCallLease({ callId, userId, viewerPersona = "social", atSeconds = Math.floor(Date.now() / 1000) }) {
      this.expireConversationCalls(atSeconds);
      const call = this.getConversationCall(callId, userId);
      if (!call || call.context_persona !== normalizePersona(viewerPersona)
        || !new Set(["ringing", "active"]).has(call.status)
        || (call.status === "ringing" && Number(call.initiated_by) !== Number(userId))) return null;
      const leaseUntil = atSeconds + 25;
      const result = this.db.prepare(`INSERT INTO call_participant_leases (call_id, user_id, lease_until, updated_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(call_id, user_id) DO UPDATE SET lease_until = excluded.lease_until, updated_at = excluded.updated_at`)
        .run(callId, userId, leaseUntil, atSeconds);
      return result.changes === 1 ? { call: this.getConversationCall(callId, userId), lease_until: leaseUntil } : null;
    },
    endConversationCall(callId, userId, atSeconds = Math.floor(Date.now() / 1000)) {
      const call = this.getConversationCall(callId, userId);
      if (!call || !new Set(["ringing", "active"]).has(call.status)) return null;
      const result = this.db.prepare(`
        UPDATE conversation_calls SET status = 'ended', ended_at = ?, ended_by = ?
        WHERE call_id = ? AND status IN ('ringing', 'active')
      `).run(atSeconds, userId, callId);
      if (result.changes === 1) this.db.prepare(`UPDATE call_signal_replay_guard SET expires_at = ? WHERE call_id = ?`).run(atSeconds + 300, callId);
      return result.changes === 1 ? this.getConversationCall(callId, userId) : null;
    },
    listCurrentCalls(userId, viewerPersona = "social") {
      this.expireConversationCalls();
      const rows = this.db.prepare(`
        SELECT cc.call_id FROM conversation_calls cc
        JOIN conversation_participants cp ON cp.conversation_id = cc.conversation_id
        WHERE cp.user_id = ? AND cp.state = 'active' AND cp.archived_at IS NULL
          AND cc.status IN ('ringing', 'active')
          AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = cc.conversation_id AND c.context_persona = ?)
        ORDER BY cc.created_at DESC, cc.call_id DESC LIMIT 10
      `).all(userId, normalizePersona(viewerPersona));
      return rows.map((row) => this.getConversationCall(row.call_id, userId)).filter(Boolean);
    },
    listConversationCalls(conversationId, viewerId, limit = 20) {
      if (!this.getConversationDetails(conversationId, viewerId) || this.conversationBlockState(conversationId).blocked) return null;
      return this.db.prepare(`
        SELECT cc.*, u.handle initiator_handle FROM conversation_calls cc
        JOIN users u ON u.id = cc.initiated_by
        WHERE cc.conversation_id = ? ORDER BY cc.created_at DESC, cc.call_id DESC LIMIT ?
      `).all(conversationId, Math.min(Math.max(Number(limit) || 20, 1), 50));
    },
    authorizeConversationCallSignal({ callId, senderId, senderPersona = "social", type, nonce, payloadHash, atSeconds = Math.floor(Date.now() / 1000) }) {
      if (!new Set(["offer", "answer", "ice"]).has(type) || !/^[A-Za-z0-9:_-]{8,80}$/.test(String(nonce)) || !/^[a-f0-9]{64}$/.test(String(payloadHash))) return null;
      this.expireConversationCalls(atSeconds);
      const call = this.getConversationCall(callId, senderId);
      if (!call || call.status !== "active" || call.context_persona !== normalizePersona(senderPersona)) return null;
      if (type === "offer" && call.initiated_by !== senderId) return null;
      if (type === "answer" && call.initiated_by === senderId) return null;
      const recipient = call.participants.find((participant) => participant.id !== senderId);
      if (!recipient) return null;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(`DELETE FROM call_signal_replay_guard
          WHERE expires_at <= ? AND EXISTS (
            SELECT 1 FROM conversation_calls cc WHERE cc.call_id = call_signal_replay_guard.call_id
              AND cc.status IN ('declined','ended','missed','failed')
          )`).run(atSeconds);
        const previous = this.db.prepare(`SELECT * FROM call_signal_replay_guard WHERE call_id = ? AND sender_id = ? AND signal_nonce = ?`)
          .get(callId, senderId, nonce);
        if (previous) {
          if (previous.payload_sha256 !== payloadHash || previous.signal_type !== type || previous.recipient_id !== recipient.id) {
            this.db.exec("COMMIT");
            return null;
          }
          const shouldDeliver = previous.delivered_at == null && Number(previous.delivery_claim_until || 0) <= atSeconds;
          if (shouldDeliver) {
            this.db.prepare(`UPDATE call_signal_replay_guard SET delivery_claim_until = ? WHERE call_id = ? AND sender_id = ? AND signal_nonce = ? AND delivered_at IS NULL`)
              .run(atSeconds + 5, callId, senderId, nonce);
          }
          this.db.prepare(`UPDATE call_signal_replay_guard SET expires_at = ? WHERE call_id = ? AND sender_id = ? AND signal_nonce = ?`)
            .run(atSeconds + 24 * 60 * 60, callId, senderId, nonce);
          this.db.exec("COMMIT");
          return { call, recipient, replay: true, shouldDeliver, delivered: previous.delivered_at != null };
        }
        this.db.prepare(`INSERT INTO call_signal_replay_guard
          (call_id, sender_id, recipient_id, signal_nonce, signal_type, payload_sha256, delivery_claim_until, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(callId, senderId, recipient.id, nonce, type, payloadHash, atSeconds + 5, atSeconds + 24 * 60 * 60);
        this.db.exec("COMMIT");
        return { call, recipient, replay: false, shouldDeliver: true, delivered: false };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
    markConversationCallSignalDelivered({ callId, senderId, nonce, payloadHash, atSeconds = Math.floor(Date.now() / 1000) }) {
      return this.db.prepare(`UPDATE call_signal_replay_guard
        SET delivered_at = ?, delivery_claim_until = NULL
        WHERE call_id = ? AND sender_id = ? AND signal_nonce = ? AND payload_sha256 = ? AND delivered_at IS NULL`)
        .run(atSeconds, callId, senderId, nonce, payloadHash).changes === 1;
    },

    // ---- legacy message compatibility ----
    sendMessage(fromId, toId, body) {
      const info = this.db.prepare(`INSERT INTO messages (from_id, to_id, body) VALUES (?, ?, ?)`).run(fromId, toId, body);
      return this.db.prepare(`SELECT * FROM messages WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listConversation(a, b, limit = 100) {
      return this.db.prepare(`SELECT * FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY created_at ASC LIMIT ?`)
        .all(a, b, b, a, limit);
    },
    listContacts(userId) {
      return this.db.prepare(`
        SELECT DISTINCT u.id, u.handle, u.display_name, MAX(m.created_at) last_at
        FROM messages m JOIN users u ON u.id = CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END
        WHERE m.from_id = ? OR m.to_id = ?
        GROUP BY u.id ORDER BY last_at DESC
      `).all(userId, userId, userId);
    },

    // ---- listings ----
    createListing({ userId, persona = "market", title, price, category = "other", mediaId = null }) {
      persona = normalizePersona(persona);
      const info = this.db.prepare(`INSERT INTO listings (user_id, persona, title, price, category, media_id) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(userId, persona, title, price, category, mediaId);
      return this.db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listListings({ persona = "market", limit = 50 } = {}) {
      persona = normalizePersona(persona);
      return this.db.prepare(`SELECT l.*, u.handle, u.display_name FROM listings l JOIN users u ON u.id = l.user_id WHERE l.persona = ? ORDER BY l.created_at DESC LIMIT ?`).all(persona, limit);
    },

    // ---- Work, jobs and business appointments (M5 local vertical) ----
    getWorkProfile(userId) {
      const row = this.db.prepare(`SELECT * FROM work_profiles WHERE user_id = ?`).get(userId);
      const persona = this.getPersona(userId, "work");
      return {
        user_id: userId,
        headline: row?.headline ?? "",
        location: row?.location ?? "",
        availability: row?.availability ?? "open",
        skills: JSON.parse(row?.skills_json ?? "[]"),
        experience: JSON.parse(row?.experience_json ?? "[]"),
        updated_at: row?.updated_at ?? persona?.updated_at ?? null,
        persona,
      };
    },
    updateWorkProfile(userId, { headline, location, availability, skills, experience }) {
      this.db.prepare(`
        INSERT INTO work_profiles (user_id, headline, location, availability, skills_json, experience_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(user_id) DO UPDATE SET headline = excluded.headline, location = excluded.location,
          availability = excluded.availability, skills_json = excluded.skills_json,
          experience_json = excluded.experience_json, updated_at = excluded.updated_at
      `).run(userId, headline, location, availability, JSON.stringify(skills), JSON.stringify(experience));
      return this.getWorkProfile(userId);
    },
    createJob({ ownerId, businessPageId = null, title, company, location, workplaceType, employmentType, description }) {
      if (businessPageId) {
        const page = this.db.prepare(`SELECT id FROM business_pages WHERE id = ? AND owner_id = ? AND status = 'active'`).get(businessPageId, ownerId);
        if (!page) { const error = new Error("business page not owned"); error.code = "BUSINESS_PAGE_NOT_OWNED"; throw error; }
      }
      const info = this.db.prepare(`INSERT INTO jobs
        (owner_id, business_page_id, persona, title, company, location, workplace_type, employment_type, description)
        VALUES (?, ?, 'work', ?, ?, ?, ?, ?, ?)`)
        .run(ownerId, businessPageId, title, company, location, workplaceType, employmentType, description);
      return this.getJob(Number(info.lastInsertRowid));
    },
    getJob(jobId) {
      return this.db.prepare(`SELECT j.*, u.handle, u.display_name,
        (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id AND a.status <> 'withdrawn') application_count
        FROM jobs j JOIN users u ON u.id = j.owner_id WHERE j.id = ?`).get(jobId) ?? null;
    },
    listJobs({ viewerId, query = "", limit = 50 } = {}) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      const needle = `%${String(query).toLowerCase()}%`;
      return this.db.prepare(`SELECT j.*, u.handle, u.display_name,
        EXISTS(SELECT 1 FROM job_applications mine WHERE mine.job_id = j.id AND mine.applicant_id = ?) applied_by_me,
        (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id AND a.status <> 'withdrawn') application_count
        FROM jobs j JOIN users u ON u.id = j.owner_id
        WHERE j.status = 'open' AND (? = '%%' OR lower(j.title || ' ' || j.company || ' ' || j.location || ' ' || j.description) LIKE ?)
        ORDER BY j.created_at DESC, j.id DESC LIMIT ?`).all(viewerId, needle, needle, bounded);
    },
    closeJob(ownerId, jobId) {
      const result = this.db.prepare(`UPDATE jobs SET status = 'closed', updated_at = unixepoch() WHERE id = ? AND owner_id = ? AND status = 'open'`).run(jobId, ownerId);
      return { changed: result.changes === 1, job: this.getJob(jobId) };
    },
    applyToJob({ jobId, applicantId, note }) {
      const job = this.getJob(jobId);
      if (!job || job.status !== "open") { const error = new Error("job not available"); error.code = "JOB_NOT_AVAILABLE"; throw error; }
      if (job.owner_id === applicantId) { const error = new Error("owner cannot apply"); error.code = "JOB_SELF_APPLICATION"; throw error; }
      try {
        const info = this.db.prepare(`INSERT INTO job_applications (job_id, applicant_id, applicant_persona, note) VALUES (?, ?, 'work', ?)`)
          .run(jobId, applicantId, note);
        return this.db.prepare(`SELECT a.*, j.title, j.company, u.handle applicant_handle FROM job_applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id WHERE a.id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) { error.code = "JOB_ALREADY_APPLIED"; }
        throw error;
      }
    },
    listJobApplications(userId, scope = "mine") {
      if (scope === "received") return this.db.prepare(`SELECT a.*, j.title, j.company, u.handle applicant_handle, u.display_name applicant_name
        FROM job_applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
        WHERE j.owner_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(userId);
      return this.db.prepare(`SELECT a.*, j.title, j.company, owner.handle owner_handle
        FROM job_applications a JOIN jobs j ON j.id = a.job_id JOIN users owner ON owner.id = j.owner_id
        WHERE a.applicant_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(userId);
    },
    createBusinessPage({ ownerId, name, category, location, description }) {
      const info = this.db.prepare(`INSERT INTO business_pages (owner_id, owner_persona, name, category, location, description) VALUES (?, 'work', ?, ?, ?, ?)`)
        .run(ownerId, name, category, location, description);
      return this.db.prepare(`SELECT * FROM business_pages WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listBusinessPages({ ownerId = null, category = "", limit = 50 } = {}) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      if (ownerId) return this.db.prepare(`SELECT p.*, u.handle owner_handle FROM business_pages p JOIN users u ON u.id = p.owner_id WHERE p.owner_id = ? ORDER BY p.created_at DESC LIMIT ?`).all(ownerId, bounded);
      if (category) return this.db.prepare(`SELECT p.*, u.handle owner_handle FROM business_pages p JOIN users u ON u.id = p.owner_id WHERE p.status = 'active' AND p.category = ? ORDER BY p.created_at DESC LIMIT ?`).all(category, bounded);
      return this.db.prepare(`SELECT p.*, u.handle owner_handle FROM business_pages p JOIN users u ON u.id = p.owner_id WHERE p.status = 'active' ORDER BY p.created_at DESC LIMIT ?`).all(bounded);
    },
    createBusinessService({ ownerId, pageId, title, category, durationMinutes, priceCents, depositCents }) {
      const page = this.db.prepare(`SELECT * FROM business_pages WHERE id = ? AND owner_id = ? AND status = 'active'`).get(pageId, ownerId);
      if (!page) { const error = new Error("business page not owned"); error.code = "BUSINESS_PAGE_NOT_OWNED"; throw error; }
      const info = this.db.prepare(`INSERT INTO business_services (page_id, title, category, duration_minutes, price_cents, deposit_cents, currency) VALUES (?, ?, ?, ?, ?, ?, 'TEST-USDC')`)
        .run(pageId, title, category, durationMinutes, priceCents, depositCents);
      return this.db.prepare(`SELECT * FROM business_services WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    createAppointmentSlot({ ownerId, serviceId, staffName, startsAt }) {
      const service = this.db.prepare(`SELECT s.*, p.owner_id FROM business_services s JOIN business_pages p ON p.id = s.page_id WHERE s.id = ? AND s.status = 'active' AND p.status = 'active'`).get(serviceId);
      if (!service || service.owner_id !== ownerId) { const error = new Error("service not owned"); error.code = "BUSINESS_SERVICE_NOT_OWNED"; throw error; }
      const endsAt = startsAt + Number(service.duration_minutes) * 60;
      try {
        const info = this.db.prepare(`INSERT INTO appointment_slots (service_id, staff_name, starts_at, ends_at) VALUES (?, ?, ?, ?)`)
          .run(serviceId, staffName, startsAt, endsAt);
        return this.db.prepare(`SELECT * FROM appointment_slots WHERE id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) error.code = "SLOT_ALREADY_EXISTS";
        throw error;
      }
    },
    listBusinessCatalog({ category = "", nowSeconds = Math.floor(Date.now() / 1000), limit = 50 } = {}) {
      const pages = this.listBusinessPages({ category, limit });
      const serviceQuery = this.db.prepare(`SELECT * FROM business_services WHERE page_id = ? AND status = 'active' ORDER BY id DESC`);
      const slotQuery = this.db.prepare(`SELECT * FROM appointment_slots WHERE service_id = ? AND status = 'available' AND starts_at > ? ORDER BY starts_at ASC LIMIT 30`);
      return pages.map((page) => ({ ...page, services: serviceQuery.all(page.id).map((service) => ({ ...service, slots: slotQuery.all(service.id, nowSeconds) })) }));
    },
    bookAppointment({ customerId, slotId }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const row = this.db.prepare(`SELECT sl.*, s.page_id, s.deposit_cents, s.currency, s.status service_status, p.owner_id, p.status page_status
          FROM appointment_slots sl JOIN business_services s ON s.id = sl.service_id JOIN business_pages p ON p.id = s.page_id WHERE sl.id = ?`).get(slotId);
        if (!row || row.status !== "available" || row.service_status !== "active" || row.page_status !== "active") throw Object.assign(new Error("slot not available"), { code: "SLOT_NOT_AVAILABLE" });
        if (row.owner_id === customerId) throw Object.assign(new Error("owner cannot book own slot"), { code: "SLOT_SELF_BOOKING" });
        const commitment = sha256Hex(JSON.stringify({ slotId, version: row.version, customerId, serviceId: row.service_id, pageId: row.page_id, depositCents: row.deposit_cents, currency: row.currency }));
        const claimed = this.db.prepare(`UPDATE appointment_slots SET status = 'reserved', version = version + 1 WHERE id = ? AND status = 'available' AND version = ?`).run(slotId, row.version);
        if (claimed.changes !== 1) throw Object.assign(new Error("slot lost race"), { code: "SLOT_NOT_AVAILABLE" });
        const info = this.db.prepare(`INSERT INTO appointments (slot_id, service_id, page_id, customer_id, customer_persona, quoted_deposit_cents, currency, commitment)
          VALUES (?, ?, ?, ?, 'work', ?, ?, ?)`).run(slotId, row.service_id, row.page_id, customerId, row.deposit_cents, row.currency, commitment);
        this.db.exec("COMMIT");
        return this.getAppointment(Number(info.lastInsertRowid));
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    getAppointment(appointmentId) {
      return this.db.prepare(`SELECT a.*, sl.starts_at, sl.ends_at, sl.staff_name, s.title service_title, p.name business_name, p.owner_id
        FROM appointments a JOIN appointment_slots sl ON sl.id = a.slot_id JOIN business_services s ON s.id = a.service_id JOIN business_pages p ON p.id = a.page_id WHERE a.id = ?`).get(appointmentId) ?? null;
    },
    listAppointments(userId) {
      return this.db.prepare(`SELECT a.*, sl.starts_at, sl.ends_at, sl.staff_name, s.title service_title, p.name business_name, p.owner_id,
        CASE WHEN a.customer_id = ? THEN 'customer' ELSE 'owner' END viewer_role
        FROM appointments a JOIN appointment_slots sl ON sl.id = a.slot_id JOIN business_services s ON s.id = a.service_id JOIN business_pages p ON p.id = a.page_id
        WHERE a.customer_id = ? OR p.owner_id = ? ORDER BY sl.starts_at ASC, a.id ASC`).all(userId, userId, userId);
    },
    transitionAppointment({ userId, appointmentId, action }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const appointment = this.getAppointment(appointmentId);
        if (!appointment || (appointment.customer_id !== userId && appointment.owner_id !== userId)) throw Object.assign(new Error("appointment not found"), { code: "APPOINTMENT_NOT_FOUND" });
        if (appointment.status !== "confirmed_local_no_payment") throw Object.assign(new Error("appointment no longer mutable"), { code: "APPOINTMENT_STATE_CONFLICT" });
        if (action === "complete" && appointment.owner_id !== userId) throw Object.assign(new Error("only owner completes"), { code: "APPOINTMENT_OWNER_REQUIRED" });
        const next = action === "complete" ? "completed" : "cancelled";
        this.db.prepare(`UPDATE appointments SET status = ?, updated_at = unixepoch() WHERE id = ? AND status = 'confirmed_local_no_payment'`).run(next, appointmentId);
        this.db.prepare(`UPDATE appointment_slots SET status = ?, version = version + 1 WHERE id = ? AND status = 'reserved'`).run(next === "completed" ? "closed" : "available", appointment.slot_id);
        this.db.exec("COMMIT");
        return this.getAppointment(appointmentId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },

    // ---- M6: fair marketplace (local, no settlement) ----
    createMarketListing({ sellerId, title, description, category, priceCents, saleMode, discoveryScope, publicLocation }) {
      const info = this.db.prepare(`INSERT INTO market_listings
        (seller_id, seller_persona, title, description, category, price_cents, currency, sale_mode, discovery_scope, public_location)
        VALUES (?, 'market', ?, ?, ?, ?, 'TEST-USDC', ?, ?, ?)`)
        .run(sellerId, title, description, category, priceCents, saleMode, discoveryScope, publicLocation);
      return this.getMarketListing(Number(info.lastInsertRowid));
    },
    getMarketListing(listingId) {
      return this.db.prepare(`SELECT l.*, u.handle seller_handle, u.display_name seller_name,
        (SELECT COUNT(*) FROM market_offers o WHERE o.listing_id = l.id AND o.status = 'pending') pending_offer_count
        FROM market_listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?`).get(listingId) ?? null;
    },
    listMarketListings({ viewerId, mine = false, scope = "", category = "", query = "", limit = 50 } = {}) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      const clauses = mine ? ["l.seller_id = ?"] : ["l.status = 'active'"];
      const params = mine ? [viewerId] : [];
      if (scope) { clauses.push("l.discovery_scope = ?"); params.push(scope); }
      if (category) { clauses.push("l.category = ?"); params.push(category); }
      const needle = String(query || "").toLowerCase();
      if (needle) { clauses.push("lower(l.title || ' ' || l.description || ' ' || l.public_location) LIKE ?"); params.push(`%${needle}%`); }
      params.push(bounded);
      return this.db.prepare(`SELECT l.*, u.handle seller_handle, u.display_name seller_name,
        EXISTS(SELECT 1 FROM market_offers mine WHERE mine.listing_id = l.id AND mine.buyer_id = ?) offered_by_me,
        (SELECT COUNT(*) FROM market_offers o WHERE o.listing_id = l.id AND o.status = 'pending') pending_offer_count
        FROM market_listings l JOIN users u ON u.id = l.seller_id
        WHERE ${clauses.join(" AND ")} ORDER BY l.created_at DESC, l.id DESC LIMIT ?`).all(viewerId, ...params);
    },
    createMarketOffer({ listingId, buyerId, amountCents, message }) {
      const listing = this.getMarketListing(listingId);
      if (!listing || listing.status !== "active") throw Object.assign(new Error("listing not available"), { code: "MARKET_LISTING_NOT_AVAILABLE" });
      if (listing.seller_id === buyerId) throw Object.assign(new Error("seller cannot offer"), { code: "MARKET_SELF_OFFER" });
      try {
        const info = this.db.prepare(`INSERT INTO market_offers (listing_id, buyer_id, buyer_persona, amount_cents, message) VALUES (?, ?, 'market', ?, ?)`)
          .run(listingId, buyerId, amountCents, message);
        return this.db.prepare(`SELECT * FROM market_offers WHERE id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) error.code = "MARKET_ALREADY_OFFERED";
        throw error;
      }
    },
    listMarketOffers(userId, scope = "mine") {
      if (scope === "received") return this.db.prepare(`SELECT o.*, l.title, l.seller_id, buyer.handle buyer_handle, buyer.display_name buyer_name
        FROM market_offers o JOIN market_listings l ON l.id = o.listing_id JOIN users buyer ON buyer.id = o.buyer_id
        WHERE l.seller_id = ? ORDER BY o.created_at DESC, o.id DESC`).all(userId);
      return this.db.prepare(`SELECT o.*, l.title, l.seller_id, seller.handle seller_handle
        FROM market_offers o JOIN market_listings l ON l.id = o.listing_id JOIN users seller ON seller.id = l.seller_id
        WHERE o.buyer_id = ? ORDER BY o.created_at DESC, o.id DESC`).all(userId);
    },
    withdrawMarketOffer({ buyerId, offerId }) {
      const result = this.db.prepare(`UPDATE market_offers SET status = 'withdrawn', updated_at = unixepoch() WHERE id = ? AND buyer_id = ? AND status = 'pending'`).run(offerId, buyerId);
      if (result.changes !== 1) throw Object.assign(new Error("offer not mutable"), { code: "MARKET_OFFER_NOT_MUTABLE" });
      return this.db.prepare(`SELECT * FROM market_offers WHERE id = ?`).get(offerId);
    },
    acceptMarketOffer({ sellerId, offerId }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const offer = this.db.prepare(`SELECT o.*, l.seller_id, l.sale_mode, l.version listing_version, l.status listing_status
          FROM market_offers o JOIN market_listings l ON l.id = o.listing_id WHERE o.id = ?`).get(offerId);
        if (!offer || offer.seller_id !== sellerId) throw Object.assign(new Error("offer not found"), { code: "MARKET_OFFER_NOT_FOUND" });
        if (offer.status !== "pending" || offer.listing_status !== "active") throw Object.assign(new Error("offer not mutable"), { code: "MARKET_OFFER_NOT_MUTABLE" });
        const claimed = this.db.prepare(`UPDATE market_listings SET status = 'reserved', version = version + 1, updated_at = unixepoch() WHERE id = ? AND status = 'active' AND version = ?`).run(offer.listing_id, offer.listing_version);
        if (claimed.changes !== 1) throw Object.assign(new Error("listing lost race"), { code: "MARKET_LISTING_NOT_AVAILABLE" });
        this.db.prepare(`UPDATE market_offers SET status = CASE WHEN id = ? THEN 'accepted' ELSE 'rejected' END, updated_at = unixepoch() WHERE listing_id = ? AND status = 'pending'`).run(offerId, offer.listing_id);
        const commitment = sha256Hex(JSON.stringify({ listingId: offer.listing_id, sellerId, buyerId: offer.buyer_id, offerId, amountCents: offer.amount_cents, currency: "TEST-USDC", saleMode: offer.sale_mode }));
        const info = this.db.prepare(`INSERT INTO market_orders (listing_id, seller_id, buyer_id, offer_id, quoted_amount_cents, currency, sale_mode, commitment)
          VALUES (?, ?, ?, ?, ?, 'TEST-USDC', ?, ?)`).run(offer.listing_id, sellerId, offer.buyer_id, offerId, offer.amount_cents, offer.sale_mode, commitment);
        this.db.exec("COMMIT");
        return this.getMarketOrder(Number(info.lastInsertRowid));
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    getMarketOrder(orderId) {
      return this.db.prepare(`SELECT o.*, l.title, seller.handle seller_handle, buyer.handle buyer_handle
        FROM market_orders o JOIN market_listings l ON l.id = o.listing_id JOIN users seller ON seller.id = o.seller_id JOIN users buyer ON buyer.id = o.buyer_id
        WHERE o.id = ?`).get(orderId) ?? null;
    },
    listMarketOrders(userId) {
      return this.db.prepare(`SELECT o.*, l.title, seller.handle seller_handle, buyer.handle buyer_handle,
        CASE WHEN o.seller_id = ? THEN 'seller' ELSE 'buyer' END viewer_role
        FROM market_orders o JOIN market_listings l ON l.id = o.listing_id JOIN users seller ON seller.id = o.seller_id JOIN users buyer ON buyer.id = o.buyer_id
        WHERE o.seller_id = ? OR o.buyer_id = ? ORDER BY o.created_at DESC, o.id DESC`).all(userId, userId, userId);
    },
    transitionMarketOrder({ userId, orderId, action }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const order = this.getMarketOrder(orderId);
        if (!order || (order.seller_id !== userId && order.buyer_id !== userId)) throw Object.assign(new Error("order not found"), { code: "MARKET_ORDER_NOT_FOUND" });
        let next;
        if (action === "fulfill" && order.seller_id === userId && order.status === "local_unfunded") next = "fulfilled";
        else if (action === "complete" && order.buyer_id === userId && order.status === "fulfilled") next = "completed";
        else if (action === "cancel" && order.status === "local_unfunded") next = "cancelled";
        else throw Object.assign(new Error("order transition denied"), { code: "MARKET_ORDER_STATE_CONFLICT" });
        this.db.prepare(`UPDATE market_orders SET status = ?, updated_at = unixepoch() WHERE id = ? AND status = ?`).run(next, orderId, order.status);
        this.db.prepare(`UPDATE market_listings SET status = ?, version = version + 1, updated_at = unixepoch() WHERE id = ?`)
          .run(next === "completed" ? "sold" : next === "cancelled" ? "active" : "reserved", order.listing_id);
        this.db.exec("COMMIT");
        return this.getMarketOrder(orderId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },

    // ---- M7: Stay listings and overlap-safe bookings ----
    createStayListing({ hostId, title, description, publicLocation, privateAddress, nightlyCents, maxGuests, cancellationPolicy }) {
      const info = this.db.prepare(`INSERT INTO stay_listings
        (host_id, host_persona, title, description, public_location, private_address, nightly_cents, currency, max_guests, cancellation_policy)
        VALUES (?, 'travel', ?, ?, ?, ?, ?, 'TEST-USDC', ?, ?)`)
        .run(hostId, title, description, publicLocation, privateAddress, nightlyCents, maxGuests, cancellationPolicy);
      return this.getStayListing(Number(info.lastInsertRowid));
    },
    getStayListing(listingId) {
      return this.db.prepare(`SELECT l.*, u.handle host_handle, u.display_name host_name FROM stay_listings l JOIN users u ON u.id = l.host_id WHERE l.id = ?`).get(listingId) ?? null;
    },
    listStayListings({ viewerId, mine = false, query = "", limit = 50 } = {}) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      const needle = `%${String(query || "").toLowerCase()}%`;
      const rows = mine
        ? this.db.prepare(`SELECT l.*, u.handle host_handle, u.display_name host_name FROM stay_listings l JOIN users u ON u.id = l.host_id WHERE l.host_id = ? ORDER BY l.created_at DESC LIMIT ?`).all(viewerId, bounded)
        : this.db.prepare(`SELECT l.*, u.handle host_handle, u.display_name host_name FROM stay_listings l JOIN users u ON u.id = l.host_id WHERE l.status = 'active' AND (? = '%%' OR lower(l.title || ' ' || l.description || ' ' || l.public_location) LIKE ?) ORDER BY l.created_at DESC LIMIT ?`).all(needle, needle, bounded);
      return rows.map((row) => mine || row.host_id === viewerId ? row : (({ private_address, ...safe }) => safe)(row));
    },
    bookStay({ guestId, listingId, checkIn, checkOut, guestCount }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const listing = this.getStayListing(listingId);
        if (!listing || listing.status !== "active") throw Object.assign(new Error("stay not available"), { code: "STAY_NOT_AVAILABLE" });
        if (listing.host_id === guestId) throw Object.assign(new Error("host cannot book"), { code: "STAY_SELF_BOOKING" });
        if (guestCount > listing.max_guests) throw Object.assign(new Error("guest limit exceeded"), { code: "STAY_GUEST_LIMIT" });
        const overlap = this.db.prepare(`SELECT id FROM stay_bookings WHERE listing_id = ? AND status <> 'cancelled' AND check_in < ? AND check_out > ? LIMIT 1`).get(listingId, checkOut, checkIn);
        if (overlap) throw Object.assign(new Error("dates unavailable"), { code: "STAY_DATES_UNAVAILABLE" });
        const nights = Math.ceil((checkOut - checkIn) / 86400);
        const totalCents = nights * listing.nightly_cents;
        const commitment = sha256Hex(JSON.stringify({ listingId, hostId: listing.host_id, guestId, checkIn, checkOut, guestCount, nights, nightlyCents: listing.nightly_cents, totalCents, currency: listing.currency, cancellationPolicy: listing.cancellation_policy }));
        const info = this.db.prepare(`INSERT INTO stay_bookings
          (listing_id, host_id, guest_id, guest_persona, check_in, check_out, guest_count, nightly_cents, total_cents, currency, cancellation_policy, commitment)
          VALUES (?, ?, ?, 'travel', ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(listingId, listing.host_id, guestId, checkIn, checkOut, guestCount, listing.nightly_cents, totalCents, listing.currency, listing.cancellation_policy, commitment);
        this.db.exec("COMMIT");
        return this.getStayBooking(Number(info.lastInsertRowid));
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    getStayBooking(bookingId) {
      return this.db.prepare(`SELECT b.*, l.title, l.public_location, l.private_address, host.handle host_handle, guest.handle guest_handle
        FROM stay_bookings b JOIN stay_listings l ON l.id = b.listing_id JOIN users host ON host.id = b.host_id JOIN users guest ON guest.id = b.guest_id
        WHERE b.id = ?`).get(bookingId) ?? null;
    },
    listStayBookings(userId) {
      return this.db.prepare(`SELECT b.*, l.title, l.public_location, l.private_address, host.handle host_handle, guest.handle guest_handle,
        CASE WHEN b.host_id = ? THEN 'host' ELSE 'guest' END viewer_role
        FROM stay_bookings b JOIN stay_listings l ON l.id = b.listing_id JOIN users host ON host.id = b.host_id JOIN users guest ON guest.id = b.guest_id
        WHERE b.host_id = ? OR b.guest_id = ? ORDER BY b.check_in ASC, b.id ASC`).all(userId, userId, userId);
    },
    transitionStayBooking({ userId, bookingId, action, atSeconds = Math.floor(Date.now() / 1000) }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const booking = this.getStayBooking(bookingId);
        if (!booking || (booking.host_id !== userId && booking.guest_id !== userId)) throw Object.assign(new Error("booking not found"), { code: "STAY_BOOKING_NOT_FOUND" });
        let next;
        if (action === "cancel" && booking.status === "confirmed_local_no_payment" && atSeconds < booking.check_in) next = "cancelled";
        else if (action === "complete" && booking.host_id === userId && booking.status === "confirmed_local_no_payment" && atSeconds >= booking.check_out) next = "completed";
        else throw Object.assign(new Error("booking transition denied"), { code: "STAY_BOOKING_STATE_CONFLICT" });
        const changed = this.db.prepare(`UPDATE stay_bookings SET status = ?, updated_at = unixepoch() WHERE id = ? AND status = ?`).run(next, bookingId, booking.status);
        if (changed.changes !== 1) throw Object.assign(new Error("booking lost state race"), { code: "STAY_BOOKING_STATE_CONFLICT" });
        this.db.exec("COMMIT");
        return this.getStayBooking(bookingId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },

    // ---- M8: verified synthetic Ride dispatch, zones only ----
    upsertRideDriver({ userId, vehicleLabel, seats, verificationStatus = "unverified" }) {
      const current = this.getRideDriver(userId);
      if (current?.status === "on_trip") throw Object.assign(new Error("driver profile cannot change during a trip"), { code: "RIDE_DRIVER_BUSY" });
      this.db.prepare(`INSERT INTO ride_driver_profiles (user_id, persona, vehicle_label, seats, verification_status, status, updated_at)
        VALUES (?, 'travel', ?, ?, ?, 'offline', unixepoch())
        ON CONFLICT(user_id) DO UPDATE SET vehicle_label = excluded.vehicle_label, seats = excluded.seats,
          verification_status = excluded.verification_status, status = 'offline', updated_at = unixepoch()`)
        .run(userId, vehicleLabel, seats, verificationStatus);
      return this.getRideDriver(userId);
    },
    getRideDriver(userId) {
      return this.db.prepare(`SELECT d.*, u.handle, u.display_name FROM ride_driver_profiles d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?`).get(userId) ?? null;
    },
    setRideDriverAvailability({ userId, available }) {
      const driver = this.getRideDriver(userId);
      if (!driver || driver.verification_status !== "synthetic_demo" || driver.status === "suspended" || driver.status === "on_trip") throw Object.assign(new Error("driver unavailable"), { code: "RIDE_DRIVER_NOT_ELIGIBLE" });
      this.db.prepare(`UPDATE ride_driver_profiles SET status = ?, updated_at = unixepoch() WHERE user_id = ?`).run(available ? "available" : "offline", userId);
      return this.getRideDriver(userId);
    },
    createRideRequest({ riderId, pickupZone, dropoffZone, requestedAt, seats, quotedFareCents, tripPin }) {
      const commitment = sha256Hex(JSON.stringify({ riderId, pickupZone, dropoffZone, requestedAt, seats, quotedFareCents, currency: "TEST-USDC" }));
      const info = this.db.prepare(`INSERT INTO ride_requests
        (rider_id, rider_persona, pickup_zone, dropoff_zone, requested_at, seats, quoted_fare_cents, currency, trip_pin_hash, commitment)
        VALUES (?, 'travel', ?, ?, ?, ?, ?, 'TEST-USDC', ?, ?)`)
        .run(riderId, pickupZone, dropoffZone, requestedAt, seats, quotedFareCents, sha256Hex(String(tripPin)), commitment);
      return this.getRideRequest(Number(info.lastInsertRowid));
    },
    getRideRequest(requestId) {
      return this.db.prepare(`SELECT r.*, rider.handle rider_handle, driver.handle driver_handle
        FROM ride_requests r JOIN users rider ON rider.id = r.rider_id LEFT JOIN users driver ON driver.id = r.driver_id WHERE r.id = ?`).get(requestId) ?? null;
    },
    listOpenRideRequests({ driverId, limit = 50 } = {}) {
      const driver = this.getRideDriver(driverId);
      if (!driver || driver.verification_status !== "synthetic_demo" || driver.status !== "available") return [];
      return this.db.prepare(`SELECT r.id, r.rider_id, r.pickup_zone, r.dropoff_zone, r.requested_at, r.seats, r.quoted_fare_cents, r.currency, r.status, r.created_at, rider.handle rider_handle
        FROM ride_requests r JOIN users rider ON rider.id = r.rider_id
        WHERE r.status = 'open' AND r.rider_id <> ? AND r.seats <= ? ORDER BY r.requested_at ASC, r.id ASC LIMIT ?`)
        .all(driverId, driver.seats, Math.max(1, Math.min(100, Number(limit) || 50)));
    },
    listRideTrips(userId) {
      return this.db.prepare(`SELECT r.id, r.rider_id, r.driver_id, r.pickup_zone, r.dropoff_zone, r.requested_at, r.seats, r.quoted_fare_cents, r.currency, r.status, r.created_at, r.updated_at,
        rider.handle rider_handle, driver.handle driver_handle, CASE WHEN r.rider_id = ? THEN 'rider' ELSE 'driver' END viewer_role
        FROM ride_requests r JOIN users rider ON rider.id = r.rider_id LEFT JOIN users driver ON driver.id = r.driver_id
        WHERE r.rider_id = ? OR r.driver_id = ? ORDER BY r.created_at DESC, r.id DESC`).all(userId, userId, userId);
    },
    acceptRideRequest({ driverId, requestId }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const driver = this.getRideDriver(driverId);
        const ride = this.getRideRequest(requestId);
        if (!driver || driver.verification_status !== "synthetic_demo" || driver.status !== "available" || !ride || ride.status !== "open" || ride.rider_id === driverId || ride.seats > driver.seats) throw Object.assign(new Error("ride unavailable"), { code: "RIDE_NOT_AVAILABLE" });
        const claimed = this.db.prepare(`UPDATE ride_requests SET driver_id = ?, status = 'matched', version = version + 1, updated_at = unixepoch() WHERE id = ? AND status = 'open' AND version = ?`).run(driverId, requestId, ride.version);
        if (claimed.changes !== 1) throw Object.assign(new Error("ride lost race"), { code: "RIDE_NOT_AVAILABLE" });
        this.db.prepare(`UPDATE ride_driver_profiles SET status = 'on_trip', updated_at = unixepoch() WHERE user_id = ? AND status = 'available'`).run(driverId);
        this.db.exec("COMMIT");
        return this.getRideRequest(requestId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    transitionRide({ userId, requestId, action, tripPin = "" }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const ride = this.getRideRequest(requestId);
        if (!ride || (ride.rider_id !== userId && ride.driver_id !== userId)) throw Object.assign(new Error("ride not found"), { code: "RIDE_NOT_FOUND" });
        let next;
        if (action === "start" && ride.driver_id === userId && ride.status === "matched" && sha256Hex(String(tripPin)) === ride.trip_pin_hash) next = "in_trip";
        else if (action === "complete" && ride.driver_id === userId && ride.status === "in_trip") next = "completed";
        else if (action === "cancel" && new Set(["open", "matched"]).has(ride.status)) next = "cancelled";
        else throw Object.assign(new Error("ride transition denied"), { code: action === "start" ? "RIDE_PIN_OR_STATE_INVALID" : "RIDE_STATE_CONFLICT" });
        this.db.prepare(`UPDATE ride_requests SET status = ?, version = version + 1, updated_at = unixepoch() WHERE id = ? AND status = ?`).run(next, requestId, ride.status);
        if (ride.driver_id && new Set(["completed", "cancelled"]).has(next)) this.db.prepare(`UPDATE ride_driver_profiles SET status = 'available', updated_at = unixepoch() WHERE user_id = ? AND status = 'on_trip'`).run(ride.driver_id);
        this.db.exec("COMMIT");
        return this.getRideRequest(requestId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },

    // ---- M9: Dating mutual eligibility, private decisions and verified-meet primitives ----
    upsertDatingProfile({ userId, displayName, age, gender, seeking, intention, interests, bio, cityBucket, visibility }) {
      const seekingJson = JSON.stringify([...new Set(seeking)].sort());
      const interestsJson = JSON.stringify([...new Set(interests)].sort());
      this.db.prepare(`INSERT INTO dating_profiles
        (user_id, persona, display_name, age, gender, seeking_json, intention, interests_json, bio, city_bucket, visibility, adult_claimed, photo_verification, updated_at)
        VALUES (?, 'dating', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'unverified', unixepoch())
        ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, age = excluded.age,
          gender = excluded.gender, seeking_json = excluded.seeking_json, intention = excluded.intention,
          interests_json = excluded.interests_json, bio = excluded.bio, city_bucket = excluded.city_bucket,
          visibility = excluded.visibility, updated_at = unixepoch()`)
        .run(userId, displayName, age, gender, seekingJson, intention, interestsJson, bio, cityBucket, visibility);
      return this.getDatingProfile(userId);
    },
    getDatingProfile(userId) {
      return hydrateDatingProfile(this.db.prepare(`SELECT dp.*, u.handle FROM dating_profiles dp JOIN users u ON u.id = dp.user_id WHERE dp.user_id = ?`).get(userId));
    },
    listDatingCandidates({ viewerId, limit = 30 }) {
      const viewer = this.getDatingProfile(viewerId);
      if (!viewer || viewer.visibility !== "discoverable") return [];
      const bounded = Math.max(1, Math.min(50, Number(limit) || 30));
      const rows = this.db.prepare(`SELECT dp.*, u.handle, u.traffic_class
        FROM dating_profiles dp JOIN users u ON u.id = dp.user_id
        WHERE dp.user_id <> ? AND dp.visibility = 'discoverable' AND u.account_state = 'active'
          AND u.traffic_class = 'HUMAN_ORGANIC'
          AND NOT EXISTS (SELECT 1 FROM dating_decisions dd WHERE dd.actor_id = ? AND dd.target_id = dp.user_id)
        ORDER BY dp.updated_at DESC, dp.user_id ASC LIMIT ?`).all(viewerId, viewerId, bounded * 5);
      return rows.map(hydrateDatingProfile).filter((candidate) => !this.isBlockedBetween(viewerId, "dating", candidate.user_id, "dating")
        && viewer.seeking.includes(candidate.gender) && candidate.seeking.includes(viewer.gender)).slice(0, bounded).map((candidate) => {
          const common = candidate.interests.filter((interest) => viewer.interests.includes(interest)).slice(0, 4);
          const reasons = [...(candidate.intention === viewer.intention ? ["same_intention"] : []), ...(common.length ? ["shared_interests"] : []), ...(candidate.city_bucket && candidate.city_bucket === viewer.city_bucket ? ["same_city_bucket"] : [])].slice(0, 3);
          return {
            user_id: candidate.user_id, handle: candidate.handle, display_name: candidate.display_name,
            age: candidate.age, gender: candidate.gender, intention: candidate.intention,
            interests: candidate.interests, bio: candidate.bio, city_bucket: candidate.city_bucket,
            compatibility_reasons: reasons, trust_passport: {
              adult_claimed: true, photo_verification: candidate.photo_verification,
              identity_assurance: "not_verified", meeting_reliability: "insufficient_evidence",
            },
          };
        });
    },
    makeDatingDecision({ actorId, targetId, action }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const actor = this.getDatingProfile(actorId), target = this.getDatingProfile(targetId);
        if (!actor || !target || actor.visibility !== "discoverable" || target.visibility !== "discoverable" || actorId === targetId
          || this.isBlockedBetween(actorId, "dating", targetId, "dating") || !actor.seeking.includes(target.gender) || !target.seeking.includes(actor.gender)) {
          throw Object.assign(new Error("dating candidate unavailable"), { code: "DATING_CANDIDATE_NOT_AVAILABLE" });
        }
        try { this.db.prepare(`INSERT INTO dating_decisions (actor_id, target_id, actor_persona, action) VALUES (?, ?, 'dating', ?)`).run(actorId, targetId, action); }
        catch (error) { if (String(error.message).includes("UNIQUE")) throw Object.assign(new Error("dating decision already exists"), { code: "DATING_DECISION_EXISTS" }); throw error; }
        let match = null;
        if (action === "like" && this.db.prepare(`SELECT 1 FROM dating_decisions WHERE actor_id = ? AND target_id = ? AND action = 'like'`).get(targetId, actorId)) {
          const low = Math.min(actorId, targetId), high = Math.max(actorId, targetId);
          const existing = this.db.prepare(`SELECT * FROM dating_matches WHERE user_low_id = ? AND user_high_id = ?`).get(low, high);
          if (existing && existing.status !== "active") throw Object.assign(new Error("dating pair was previously closed"), { code: "DATING_PAIR_CLOSED" });
          if (!existing) {
            const inserted = this.db.prepare(`INSERT INTO dating_matches (user_low_id, user_high_id) VALUES (?, ?)`).run(low, high);
            const conversation = this.createDirectConversation({ creatorId: actorId, recipientId: targetId, contextPersona: "dating" });
            this.db.prepare(`UPDATE dating_matches SET conversation_id = ? WHERE id = ?`).run(conversation?.id ?? null, Number(inserted.lastInsertRowid));
          }
          match = this.db.prepare(`SELECT * FROM dating_matches WHERE user_low_id = ? AND user_high_id = ?`).get(low, high);
        }
        const decision = this.db.prepare(`SELECT actor_id, target_id, action, created_at FROM dating_decisions WHERE actor_id = ? AND target_id = ?`).get(actorId, targetId);
        this.db.exec("COMMIT");
        return { decision, match };
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    getDatingMatch(matchId, viewerId) {
      const match = this.db.prepare(`SELECT dm.*, low.handle low_handle, high.handle high_handle
        FROM dating_matches dm JOIN users low ON low.id = dm.user_low_id JOIN users high ON high.id = dm.user_high_id
        WHERE dm.id = ? AND (dm.user_low_id = ? OR dm.user_high_id = ?)`).get(matchId, viewerId, viewerId);
      if (!match || this.isBlockedBetween(match.user_low_id, "dating", match.user_high_id, "dating")) return null;
      return { ...match, other_user_id: match.user_low_id === viewerId ? match.user_high_id : match.user_low_id, other_handle: match.user_low_id === viewerId ? match.high_handle : match.low_handle };
    },
    listDatingMatches(viewerId) {
      return this.db.prepare(`SELECT id FROM dating_matches WHERE status = 'active' AND (user_low_id = ? OR user_high_id = ?) ORDER BY matched_at DESC, id DESC`).all(viewerId, viewerId)
        .map((row) => this.getDatingMatch(row.id, viewerId)).filter(Boolean);
    },
    endDatingMatch({ viewerId, matchId, action }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const match = this.getDatingMatch(matchId, viewerId);
        if (!match) throw Object.assign(new Error("dating match not found"), { code: "DATING_MATCH_NOT_FOUND" });
        if (match.status !== "active") throw Object.assign(new Error("dating match already closed"), { code: "DATING_MATCH_STATE_CONFLICT" });
        const next = action === "block" ? "blocked" : "unmatched";
        const changed = this.db.prepare(`UPDATE dating_matches SET status = ?, ended_by = ?, updated_at = unixepoch() WHERE id = ? AND status = 'active'`).run(next, viewerId, matchId);
        if (changed.changes !== 1) throw Object.assign(new Error("dating match lost race"), { code: "DATING_MATCH_STATE_CONFLICT" });
        if (match.conversation_id) this.db.prepare(`UPDATE conversations SET status = 'declined', key_epoch = key_epoch + 1, key_epoch_changed_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`).run(match.conversation_id);
        if (action === "block") this.db.prepare(`INSERT OR IGNORE INTO profile_blocks (blocker_id, blocker_persona, blocked_id) VALUES (?, 'dating', ?)`).run(viewerId, match.other_user_id);
        this.db.exec("COMMIT");
        return { id: matchId, status: next, other_user_id: match.other_user_id };
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    createDatingMeetPlan({ viewerId, matchId, zoneBucket, scheduledAt, pin }) {
      const match = this.getDatingMatch(matchId, viewerId);
      if (!match || match.status !== "active") throw Object.assign(new Error("active dating match required"), { code: "DATING_MATCH_NOT_FOUND" });
      const info = this.db.prepare(`INSERT INTO dating_meet_plans (match_id, proposer_id, zone_bucket, scheduled_at, pin_hash) VALUES (?, ?, ?, ?, ?)`)
        .run(matchId, viewerId, zoneBucket, scheduledAt, sha256Hex(String(pin)));
      return this.getDatingMeetPlan(Number(info.lastInsertRowid), viewerId);
    },
    getDatingMeetPlan(planId, viewerId) {
      const row = this.db.prepare(`SELECT mp.*, dm.user_low_id, dm.user_high_id, dm.status match_status
        FROM dating_meet_plans mp JOIN dating_matches dm ON dm.id = mp.match_id
        WHERE mp.id = ? AND (dm.user_low_id = ? OR dm.user_high_id = ?)`).get(planId, viewerId, viewerId);
      if (!row || this.isBlockedBetween(row.user_low_id, "dating", row.user_high_id, "dating")) return null;
      const { pin_hash, ...safe } = row;
      return safe;
    },
    listDatingMeetPlans(viewerId) {
      return this.db.prepare(`SELECT mp.id FROM dating_meet_plans mp JOIN dating_matches dm ON dm.id = mp.match_id
        WHERE dm.user_low_id = ? OR dm.user_high_id = ? ORDER BY mp.scheduled_at DESC, mp.id DESC`).all(viewerId, viewerId)
        .map((row) => this.getDatingMeetPlan(row.id, viewerId)).filter(Boolean);
    },
    transitionDatingMeetPlan({ viewerId, planId, action, pin = "", atSeconds = Math.floor(Date.now() / 1000) }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const raw = this.db.prepare(`SELECT mp.*, dm.user_low_id, dm.user_high_id, dm.status match_status FROM dating_meet_plans mp JOIN dating_matches dm ON dm.id = mp.match_id WHERE mp.id = ? AND (dm.user_low_id = ? OR dm.user_high_id = ?)`).get(planId, viewerId, viewerId);
        if (!raw || raw.match_status !== "active" || this.isBlockedBetween(raw.user_low_id, "dating", raw.user_high_id, "dating")) throw Object.assign(new Error("dating meet plan not found"), { code: "DATING_MEET_NOT_FOUND" });
        let next = raw.status, lowConfirmed = Number(raw.low_confirmed), highConfirmed = Number(raw.high_confirmed);
        if (action === "accept" && raw.status === "proposed" && raw.proposer_id !== viewerId) next = "accepted";
        else if (action === "cancel" && new Set(["proposed", "accepted"]).has(raw.status)) next = "cancelled";
        else if (action === "confirm" && raw.status === "accepted" && atSeconds >= raw.scheduled_at - 3600 && atSeconds <= raw.scheduled_at + 86400 && sha256Hex(String(pin)) === raw.pin_hash) {
          if (viewerId === raw.user_low_id) lowConfirmed = 1; else highConfirmed = 1;
          if (lowConfirmed && highConfirmed) next = "completed";
        } else throw Object.assign(new Error("dating meet transition denied"), { code: action === "confirm" ? "DATING_MEET_PIN_OR_WINDOW_INVALID" : "DATING_MEET_STATE_CONFLICT" });
        const changed = this.db.prepare(`UPDATE dating_meet_plans SET status = ?, low_confirmed = ?, high_confirmed = ?, version = version + 1, updated_at = unixepoch() WHERE id = ? AND version = ?`).run(next, lowConfirmed, highConfirmed, planId, raw.version);
        if (changed.changes !== 1) throw Object.assign(new Error("dating meet lost race"), { code: "DATING_MEET_STATE_CONFLICT" });
        this.db.exec("COMMIT");
        return this.getDatingMeetPlan(planId, viewerId);
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },

    // ---- M10 Watch + Family/Kids local boundary ----
    createWatchChannel({ ownerId, handle, title, description = "" }) {
      const info = this.db.prepare(`INSERT INTO watch_channels (owner_id, handle, title, description) VALUES (?, ?, ?, ?)`)
        .run(ownerId, handle, title, description);
      return this.getWatchChannel(Number(info.lastInsertRowid), ownerId);
    },
    getWatchChannel(channelId, viewerId = null) {
      const row = this.db.prepare(`SELECT wc.*, u.handle owner_handle, u.traffic_class,
        (SELECT COUNT(*) FROM watch_subscriptions ws WHERE ws.channel_id = wc.id) subscriber_count,
        EXISTS(SELECT 1 FROM watch_subscriptions ws WHERE ws.channel_id = wc.id AND ws.user_id = ?) subscribed
        FROM watch_channels wc JOIN users u ON u.id = wc.owner_id WHERE wc.id = ?`).get(viewerId ?? -1, channelId);
      if (!row || row.state !== "active" || (viewerId != null && this.isBlockedBetween(viewerId, "social", row.owner_id, "social"))) return null;
      return row;
    },
    listOwnWatchChannels(ownerId) {
      return this.db.prepare(`SELECT id FROM watch_channels WHERE owner_id = ? ORDER BY updated_at DESC, id DESC`).all(ownerId)
        .map((row) => this.getWatchChannel(row.id, ownerId)).filter(Boolean);
    },
    createWatchVideo({ ownerId, channelId, mediaId, title, description, durationSeconds, audience, ageRating, captionsLanguage }) {
      const channel = this.db.prepare(`SELECT * FROM watch_channels WHERE id = ? AND owner_id = ? AND state = 'active'`).get(channelId, ownerId);
      const media = this.getMediaById(mediaId);
      if (!channel) throw Object.assign(new Error("watch channel not owned"), { code: "WATCH_CHANNEL_NOT_OWNED" });
      if (!media || media.kind !== "video" || media.scan_status !== "ready_local_validation" || !this.hasMediaUploadGrant(mediaId, ownerId, "watch_video", "social")) {
        throw Object.assign(new Error("watch media is not eligible"), { code: "WATCH_MEDIA_NOT_ELIGIBLE" });
      }
      const info = this.db.prepare(`INSERT INTO watch_videos
        (channel_id, owner_id, media_id, title, description, duration_seconds, audience, age_rating, captions_language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(channelId, ownerId, mediaId, title, description, durationSeconds, audience, ageRating, captionsLanguage);
      return this.getWatchVideo(Number(info.lastInsertRowid), ownerId);
    },
    getWatchVideo(videoId, viewerId) {
      const row = this.db.prepare(`SELECT wv.*, wc.handle channel_handle, wc.title channel_title, wc.state channel_state,
        u.handle owner_handle, u.traffic_class, m.hash media_hash, m.ext media_ext, m.mime media_mime,
        EXISTS(SELECT 1 FROM watch_subscriptions ws WHERE ws.channel_id = wv.channel_id AND ws.user_id = ?) subscribed,
        (SELECT position_seconds FROM watch_progress wp WHERE wp.viewer_id = ? AND wp.video_id = wv.id) progress_seconds
        FROM watch_videos wv JOIN watch_channels wc ON wc.id = wv.channel_id
        JOIN users u ON u.id = wv.owner_id JOIN media m ON m.id = wv.media_id WHERE wv.id = ?`).get(viewerId, viewerId, videoId);
      if (!row || row.channel_state !== "active" || this.isBlockedBetween(viewerId, "social", row.owner_id, "social")) return null;
      const owner = row.owner_id === viewerId;
      if (!owner && (row.state !== "published" || !new Set(["approved_local_demo", "approved"]).has(row.moderation_state)
        || !new Set(["self_declared", "cleared"]).has(row.rights_state)
        || row.audience === "private" || (row.audience === "subscribers" && !row.subscribed))) return null;
      return { ...row, media_url: `/media/${row.media_hash}.${row.media_ext}`, production_eligible: row.rights_state === "cleared" && row.moderation_state === "approved" };
    },
    listWatchHome(viewerId, { mode = "editorial", limit = 30 } = {}) {
      const bounded = Math.max(1, Math.min(50, Number(limit) || 30));
      const subscriptionClause = mode === "subscriptions" ? `AND EXISTS(SELECT 1 FROM watch_subscriptions ws WHERE ws.user_id = ? AND ws.channel_id = wv.channel_id)` : "";
      const params = mode === "subscriptions" ? [viewerId, bounded * 3] : [bounded * 3];
      const rows = this.db.prepare(`SELECT wv.id FROM watch_videos wv JOIN users u ON u.id = wv.owner_id
        WHERE wv.state = 'published' AND wv.moderation_state IN ('approved_local_demo','approved')
          AND wv.rights_state IN ('self_declared','cleared') AND wv.audience <> 'private'
          AND u.traffic_class = 'HUMAN_ORGANIC' ${subscriptionClause}
        ORDER BY wv.published_at DESC, wv.id DESC LIMIT ?`).all(...params);
      const videos = rows.map((row) => this.getWatchVideo(row.id, viewerId)).filter(Boolean).slice(0, bounded);
      const continueWatching = this.db.prepare(`SELECT video_id FROM watch_progress WHERE viewer_id = ? AND completed = 0 ORDER BY updated_at DESC LIMIT 12`).all(viewerId)
        .map((row) => this.getWatchVideo(row.video_id, viewerId)).filter(Boolean);
      return { mode, videos, continue_watching: continueWatching, ranker: mode === "subscriptions" ? "CHRONOLOGICAL_SUBSCRIPTIONS" : "EDITORIAL_LOCAL_NO_BEHAVIORAL_MODEL" };
    },
    publishWatchVideo({ ownerId, videoId }) {
      const row = this.db.prepare(`SELECT * FROM watch_videos WHERE id = ? AND owner_id = ?`).get(videoId, ownerId);
      if (!row) throw Object.assign(new Error("watch video not owned"), { code: "WATCH_VIDEO_NOT_FOUND" });
      if (row.state === "published") return this.getWatchVideo(videoId, ownerId);
      if (row.state !== "draft" || row.rights_state === "blocked" || !new Set(["approved_local_demo", "approved"]).has(row.moderation_state)) {
        throw Object.assign(new Error("watch video not publishable"), { code: "WATCH_VIDEO_NOT_PUBLISHABLE" });
      }
      const changed = this.db.prepare(`UPDATE watch_videos SET state = 'published', published_at = unixepoch(), updated_at = unixepoch() WHERE id = ? AND owner_id = ? AND state = 'draft'`).run(videoId, ownerId);
      if (changed.changes !== 1) throw Object.assign(new Error("watch publish lost race"), { code: "WATCH_VIDEO_STATE_CONFLICT" });
      return this.getWatchVideo(videoId, ownerId);
    },
    withdrawWatchVideo({ ownerId, videoId }) {
      const changed = this.db.prepare(`UPDATE watch_videos SET state = 'withdrawn', updated_at = unixepoch() WHERE id = ? AND owner_id = ? AND state IN ('draft','published')`).run(videoId, ownerId);
      if (changed.changes !== 1) throw Object.assign(new Error("watch video not mutable"), { code: "WATCH_VIDEO_STATE_CONFLICT" });
      return this.getWatchVideo(videoId, ownerId);
    },
    setWatchSubscription({ userId, channelId, active, notificationMode = "personalized" }) {
      const channel = this.getWatchChannel(channelId, userId);
      if (!channel || channel.owner_id === userId) throw Object.assign(new Error("watch channel unavailable"), { code: "WATCH_CHANNEL_UNAVAILABLE" });
      if (active) this.db.prepare(`INSERT INTO watch_subscriptions (user_id, channel_id, notification_mode) VALUES (?, ?, ?)
        ON CONFLICT(user_id, channel_id) DO UPDATE SET notification_mode = excluded.notification_mode`).run(userId, channelId, notificationMode);
      else this.db.prepare(`DELETE FROM watch_subscriptions WHERE user_id = ? AND channel_id = ?`).run(userId, channelId);
      return { channel_id: channelId, subscribed: Boolean(active), notification_mode: active ? notificationMode : "none" };
    },
    createWatchPlaylist({ ownerId, title, visibility = "private", kind = "standard" }) {
      const info = this.db.prepare(`INSERT INTO watch_playlists (owner_id, title, visibility, kind) VALUES (?, ?, ?, ?)`).run(ownerId, title, visibility, kind);
      return this.getWatchPlaylist(Number(info.lastInsertRowid), ownerId);
    },
    getWatchPlaylist(playlistId, viewerId) {
      const row = this.db.prepare(`SELECT * FROM watch_playlists WHERE id = ? AND (owner_id = ? OR visibility = 'public')`).get(playlistId, viewerId);
      if (!row) return null;
      const items = this.db.prepare(`SELECT video_id, position FROM watch_playlist_items WHERE playlist_id = ? ORDER BY position`).all(playlistId)
        .map((item) => ({ ...item, video: this.getWatchVideo(item.video_id, viewerId) })).filter((item) => item.video);
      return { ...row, items };
    },
    listWatchPlaylists(viewerId) {
      return this.db.prepare(`SELECT id FROM watch_playlists WHERE owner_id = ? ORDER BY updated_at DESC, id DESC`).all(viewerId)
        .map((row) => this.getWatchPlaylist(row.id, viewerId)).filter(Boolean);
    },
    addWatchPlaylistItem({ ownerId, playlistId, videoId }) {
      const playlist = this.db.prepare(`SELECT * FROM watch_playlists WHERE id = ? AND owner_id = ?`).get(playlistId, ownerId);
      if (!playlist || !this.getWatchVideo(videoId, ownerId)) throw Object.assign(new Error("watch playlist target unavailable"), { code: "WATCH_PLAYLIST_UNAVAILABLE" });
      const position = Number(this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 position FROM watch_playlist_items WHERE playlist_id = ?`).get(playlistId).position);
      this.db.prepare(`INSERT OR IGNORE INTO watch_playlist_items (playlist_id, video_id, position) VALUES (?, ?, ?)`).run(playlistId, videoId, position);
      return this.getWatchPlaylist(playlistId, ownerId);
    },
    updateWatchProgress({ viewerId, videoId, positionSeconds }) {
      const video = this.getWatchVideo(videoId, viewerId);
      if (!video) throw Object.assign(new Error("watch video unavailable"), { code: "WATCH_VIDEO_NOT_FOUND" });
      const position = Math.max(0, Math.min(video.duration_seconds, Number(positionSeconds) || 0));
      const completed = position >= Math.max(1, video.duration_seconds - 3) ? 1 : 0;
      this.db.prepare(`INSERT INTO watch_progress (viewer_id, video_id, position_seconds, completed, updated_at) VALUES (?, ?, ?, ?, unixepoch())
        ON CONFLICT(viewer_id, video_id) DO UPDATE SET position_seconds = excluded.position_seconds, completed = excluded.completed, updated_at = unixepoch()`)
        .run(viewerId, videoId, position, completed);
      return { video_id: videoId, position_seconds: position, completed: Boolean(completed), privacy: "VIEWER_ONLY_TELEMETRY_NO_ACTION_LEDGER" };
    },
    transitionSocialLiveLocal({ ownerId, sessionId, action, scheduledAt = null }) {
      const row = this.db.prepare(`SELECT * FROM social_live_sessions WHERE id = ? AND host_id = ?`).get(sessionId, ownerId);
      if (!row) throw Object.assign(new Error("live session not found"), { code: "LIVE_SESSION_NOT_FOUND" });
      if (action === "start") throw Object.assign(new Error("live ingest is not configured"), { code: "LIVE_INGEST_NOT_CONFIGURED" });
      let next;
      if (action === "schedule" && row.status === "preview") next = "scheduled";
      else if (action === "cancel" && new Set(["preview", "scheduled"]).has(row.status)) next = "cancelled";
      else if (action === "terminate" && new Set(["preview", "scheduled", "live"]).has(row.status)) next = "ended";
      else throw Object.assign(new Error("live transition denied"), { code: "LIVE_STATE_CONFLICT" });
      const starts = action === "schedule" ? scheduledAt : row.scheduled_at;
      this.db.prepare(`UPDATE social_live_sessions SET status = ?, scheduled_at = ?, ended_at = CASE WHEN ? = 'ended' THEN unixepoch() ELSE ended_at END WHERE id = ? AND host_id = ?`)
        .run(next, starts, next, sessionId, ownerId);
      return this.db.prepare(`SELECT * FROM social_live_sessions WHERE id = ?`).get(sessionId);
    },
    getOrCreateFamilyGroup(adultAccountId) {
      this.db.prepare(`INSERT OR IGNORE INTO family_groups (adult_account_id) VALUES (?)`).run(adultAccountId);
      return this.db.prepare(`SELECT * FROM family_groups WHERE adult_account_id = ?`).get(adultAccountId);
    },
    listFamily(adultAccountId) {
      const group = this.db.prepare(`SELECT * FROM family_groups WHERE adult_account_id = ?`).get(adultAccountId);
      if (!group) return { group: null, children: [] };
      const children = this.db.prepare(`SELECT kc.*, kpc.daily_minutes, kpc.autoplay, kpc.search_enabled, kpc.live_enabled, kpc.approved_topics_json, kpc.version
        FROM kids_children kc JOIN kids_parent_controls kpc ON kpc.child_id = kc.id WHERE kc.family_group_id = ? AND kc.state <> 'deleted' ORDER BY kc.id`).all(group.id)
        .map((row) => ({ ...row, approved_topics: parseStringArrayJson(row.approved_topics_json) }));
      return { group, children };
    },
    createKidsChild({ adultAccountId, alias, ageBand, locale, avatarCode = "orbit" }) {
      const group = this.getOrCreateFamilyGroup(adultAccountId);
      if (group.state !== "active") throw Object.assign(new Error("family group unavailable"), { code: "FAMILY_GROUP_UNAVAILABLE" });
      const info = this.db.prepare(`INSERT INTO kids_children (family_group_id, alias, age_band, locale, avatar_code) VALUES (?, ?, ?, ?, ?)`)
        .run(group.id, alias, ageBand, locale, avatarCode);
      const childId = Number(info.lastInsertRowid);
      this.db.prepare(`INSERT INTO kids_parent_controls (child_id) VALUES (?)`).run(childId);
      return this.listFamily(adultAccountId).children.find((child) => child.id === childId);
    },
    updateKidsControls({ adultAccountId, childId, dailyMinutes, searchEnabled, liveEnabled, approvedTopics }) {
      const owned = this.db.prepare(`SELECT kc.id FROM kids_children kc JOIN family_groups fg ON fg.id = kc.family_group_id WHERE kc.id = ? AND fg.adult_account_id = ? AND fg.state = 'active' AND kc.state = 'active'`).get(childId, adultAccountId);
      if (!owned) throw Object.assign(new Error("child not found"), { code: "KIDS_CHILD_NOT_FOUND" });
      this.db.prepare(`UPDATE kids_parent_controls SET daily_minutes = ?, autoplay = 0, search_enabled = ?, live_enabled = ?, approved_topics_json = ?, version = version + 1, updated_at = unixepoch() WHERE child_id = ?`)
        .run(dailyMinutes, searchEnabled ? 1 : 0, liveEnabled ? 1 : 0, JSON.stringify(approvedTopics), childId);
      return this.listFamily(adultAccountId).children.find((child) => child.id === childId);
    },
    storeKidsSession({ adultAccountId, childId, tokenHash, expiresAt }) {
      const owned = this.db.prepare(`SELECT kc.id FROM kids_children kc JOIN family_groups fg ON fg.id = kc.family_group_id WHERE kc.id = ? AND fg.adult_account_id = ? AND fg.state = 'active' AND kc.state = 'active'`).get(childId, adultAccountId);
      if (!owned) throw Object.assign(new Error("child not found"), { code: "KIDS_CHILD_NOT_FOUND" });
      this.db.prepare(`DELETE FROM kids_sessions WHERE child_id = ? OR expires_at <= unixepoch()`).run(childId);
      this.db.prepare(`INSERT INTO kids_sessions (token_hash, child_id, expires_at) VALUES (?, ?, ?)`).run(tokenHash, childId, expiresAt);
      return { child_id: childId, expires_at: expiresAt };
    },
    getKidsSession(tokenHash, atSeconds = Math.floor(Date.now() / 1000)) {
      return this.db.prepare(`SELECT ks.*, kc.alias, kc.age_band, kc.locale, kc.avatar_code,
        kpc.daily_minutes, kpc.autoplay, kpc.search_enabled, kpc.live_enabled, kpc.approved_topics_json
        FROM kids_sessions ks JOIN kids_children kc ON kc.id = ks.child_id
        JOIN family_groups fg ON fg.id = kc.family_group_id JOIN kids_parent_controls kpc ON kpc.child_id = kc.id
        WHERE ks.token_hash = ? AND ks.expires_at > ? AND kc.state = 'active' AND fg.state = 'active'`).get(tokenHash, atSeconds) ?? null;
    },
    addKidsCatalogEntry({ adultAccountId, videoId, ageBand, locale, topic }) {
      const video = this.db.prepare(`SELECT * FROM watch_videos WHERE id = ? AND owner_id = ? AND state = 'published' AND age_rating = 'general'
        AND moderation_state IN ('approved_local_demo','approved') AND rights_state IN ('self_declared','cleared')`).get(videoId, adultAccountId);
      if (!video) throw Object.assign(new Error("kids catalog video not eligible"), { code: "KIDS_CATALOG_NOT_ELIGIBLE" });
      this.db.prepare(`INSERT INTO kids_catalog_entries (video_id, age_band, locale, topic) VALUES (?, ?, ?, ?)
        ON CONFLICT(video_id, age_band, locale) DO UPDATE SET topic = excluded.topic, editorial_state = 'approved_local_demo', valid_from = unixepoch(), valid_to = NULL`)
        .run(videoId, ageBand, locale, topic);
      return this.db.prepare(`SELECT * FROM kids_catalog_entries WHERE video_id = ? AND age_band = ? AND locale = ?`).get(videoId, ageBand, locale);
    },
    listKidsHome(childSession, { limit = 30 } = {}) {
      const bounded = Math.max(1, Math.min(50, Number(limit) || 30));
      const topics = parseStringArrayJson(childSession.approved_topics_json);
      return this.db.prepare(`SELECT kce.*, wv.media_id, wv.title, wv.description, wv.duration_seconds, wc.title channel_title,
        m.hash media_hash, m.ext media_ext, m.mime media_mime,
        COALESCE(kh.progress_seconds, 0) progress_seconds
        FROM kids_catalog_entries kce JOIN watch_videos wv ON wv.id = kce.video_id
        JOIN watch_channels wc ON wc.id = wv.channel_id JOIN media m ON m.id = wv.media_id
        LEFT JOIN kids_history kh ON kh.child_id = ? AND kh.video_id = wv.id
        WHERE kce.age_band = ? AND kce.locale IN (?, 'und') AND kce.editorial_state IN ('approved_local_demo','approved')
          AND kce.valid_from <= unixepoch() AND (kce.valid_to IS NULL OR kce.valid_to > unixepoch())
          AND wv.state = 'published' AND wv.age_rating = 'general' AND wv.rights_state IN ('self_declared','cleared')
          AND wv.moderation_state IN ('approved_local_demo','approved')
        ORDER BY kce.valid_from DESC, kce.id DESC LIMIT ?`).all(childSession.child_id, childSession.age_band, childSession.locale, bounded * 3)
        .filter((entry) => !topics.length || topics.includes(entry.topic)).slice(0, bounded)
        .map((entry) => ({ ...entry, media_url: `/media/${entry.media_hash}.${entry.media_ext}`, why: `Parent-approved topic: ${entry.topic}` }));
    },
    applyKidsMutation({ childSession, idempotencyKey, requestHash, execute, atSeconds = Math.floor(Date.now() / 1000) }) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const replay = this.db.prepare(`SELECT * FROM kids_mutation_requests WHERE child_id = ? AND idempotency_key = ? AND expires_at > ?`).get(childSession.child_id, idempotencyKey, atSeconds);
        if (replay) {
          if (replay.request_hash !== requestHash) throw Object.assign(new Error("kids idempotency conflict"), { code: "KIDS_IDEMPOTENCY_CONFLICT" });
          this.db.exec("COMMIT");
          return { replayed: true, statusCode: replay.status_code, body: JSON.parse(replay.response_json) };
        }
        const body = execute();
        this.db.prepare(`INSERT INTO kids_mutation_requests (child_id, idempotency_key, request_hash, status_code, response_json, expires_at) VALUES (?, ?, ?, 200, ?, ?)`)
          .run(childSession.child_id, idempotencyKey, requestHash, JSON.stringify(body), atSeconds + 86400);
        this.db.exec("COMMIT");
        return { replayed: false, statusCode: 200, body };
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    },
    updateKidsProgress({ childSession, videoId, positionSeconds, atSeconds = Math.floor(Date.now() / 1000) }) {
      const video = this.listKidsHome(childSession, { limit: 50 }).find((entry) => entry.video_id === videoId);
      if (!video) throw Object.assign(new Error("kids video unavailable"), { code: "KIDS_VIDEO_NOT_FOUND" });
      const position = Math.max(0, Math.min(video.duration_seconds, Number(positionSeconds) || 0));
      const completed = position >= Math.max(1, video.duration_seconds - 3) ? 1 : 0;
      this.db.prepare(`INSERT INTO kids_history (child_id, video_id, progress_seconds, completed, expires_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(child_id, video_id) DO UPDATE SET progress_seconds = excluded.progress_seconds, completed = excluded.completed, expires_at = excluded.expires_at, updated_at = excluded.updated_at`)
        .run(childSession.child_id, videoId, position, completed, atSeconds + 30 * 86400, atSeconds);
      return { video_id: videoId, position_seconds: position, completed: Boolean(completed), chain_action: false, expires_at: atSeconds + 30 * 86400 };
    },
    setKidsFeedback({ childSession, videoId, kind, atSeconds = Math.floor(Date.now() / 1000) }) {
      if (!this.listKidsHome(childSession, { limit: 50 }).some((entry) => entry.video_id === videoId)) throw Object.assign(new Error("kids video unavailable"), { code: "KIDS_VIDEO_NOT_FOUND" });
      this.db.prepare(`INSERT OR IGNORE INTO kids_feedback (child_id, video_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(childSession.child_id, videoId, kind, atSeconds + 30 * 86400, atSeconds);
      return { video_id: videoId, kind, public_count: false, chain_action: false, expires_at: atSeconds + 30 * 86400 };
    },

    // ---- M11 Music: independent/rightsholder catalog, private history ----
    createMusicArtist({ ownerId, stageName, bio = "" }) {
      const info = this.db.prepare(`INSERT INTO music_artists (owner_id, stage_name, bio) VALUES (?, ?, ?)`)
        .run(ownerId, stageName, bio);
      return this.getMusicArtist(Number(info.lastInsertRowid), ownerId);
    },
    getMusicArtist(artistId, viewerId = null) {
      const row = this.db.prepare(`SELECT ma.*, u.handle owner_handle, u.traffic_class,
        (SELECT COUNT(*) FROM music_tracks mt WHERE mt.artist_id = ma.id AND mt.availability_state IN ('published_local_demo','published')) track_count
        FROM music_artists ma JOIN users u ON u.id = ma.owner_id WHERE ma.id = ?`).get(artistId);
      if (!row || row.state !== "active" || (viewerId != null && this.isAccountBlockedBetween(viewerId, row.owner_id))) return null;
      return row;
    },
    getOwnMusicArtist(ownerId) {
      const row = this.db.prepare(`SELECT id FROM music_artists WHERE owner_id = ?`).get(ownerId);
      return row ? this.getMusicArtist(row.id, ownerId) : null;
    },
    createMusicTrack({ ownerId, artistId, mediaId, title, durationSeconds, rightsBasis, attribution = "", explicit = false, territory = "LOCAL_DEMO" }) {
      const artist = this.db.prepare(`SELECT * FROM music_artists WHERE id = ? AND owner_id = ? AND state = 'active'`).get(artistId, ownerId);
      const media = this.getMediaById(mediaId);
      if (!artist) throw Object.assign(new Error("music artist is not owned"), { code: "MUSIC_ARTIST_NOT_OWNED" });
      if (!media || media.kind !== "audio" || media.scan_status !== "ready_local_validation"
        || !this.hasMediaUploadGrant(mediaId, ownerId, "music_master", "social")) {
        throw Object.assign(new Error("music master is not eligible"), { code: "MUSIC_MEDIA_NOT_ELIGIBLE" });
      }
      const info = this.db.prepare(`INSERT INTO music_tracks
        (artist_id, owner_id, media_id, title, duration_seconds, rights_basis, attribution, explicit, territory)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(artistId, ownerId, mediaId, title, durationSeconds, rightsBasis, attribution, explicit ? 1 : 0, territory);
      return this.getMusicTrack(Number(info.lastInsertRowid), ownerId);
    },
    getMusicTrack(trackId, viewerId) {
      const row = this.db.prepare(`SELECT mt.*, ma.stage_name, ma.state artist_state, ma.rights_verification,
        u.handle owner_handle, u.traffic_class, m.hash media_hash, m.ext media_ext, m.mime media_mime,
        EXISTS(SELECT 1 FROM music_library ml WHERE ml.track_id = mt.id AND ml.user_id = ?) saved,
        (SELECT COUNT(*) FROM music_library ml WHERE ml.track_id = mt.id) save_count
        FROM music_tracks mt JOIN music_artists ma ON ma.id = mt.artist_id
        JOIN users u ON u.id = mt.owner_id JOIN media m ON m.id = mt.media_id
        WHERE mt.id = ?`).get(viewerId ?? -1, trackId);
      if (!row || row.artist_state !== "active" || (viewerId != null && this.isAccountBlockedBetween(viewerId, row.owner_id))) return null;
      const owner = Number(row.owner_id) === Number(viewerId);
      if (!owner && !new Set(["published_local_demo", "published"]).has(row.availability_state)) return null;
      return {
        ...row,
        saved: Boolean(row.saved),
        media_url: `/media/${row.media_hash}.${row.media_ext}`,
        production_eligible: row.availability_state === "published" && row.rights_verification === "verified",
      };
    },
    listMusicHome(viewerId, { query = "", explicitAllowed = false, limit = 30 } = {}) {
      const bounded = Math.max(1, Math.min(50, Number(limit) || 30));
      const clean = String(query || "").trim().toLowerCase();
      const rows = this.db.prepare(`SELECT mt.id FROM music_tracks mt
        JOIN music_artists ma ON ma.id = mt.artist_id JOIN users u ON u.id = mt.owner_id
        WHERE mt.availability_state IN ('published_local_demo','published') AND ma.state = 'active'
          AND u.traffic_class = 'HUMAN_ORGANIC' AND (? = 1 OR mt.explicit = 0)
          AND (? = '' OR lower(mt.title) LIKE '%' || ? || '%' OR lower(ma.stage_name) LIKE '%' || ? || '%')
        ORDER BY mt.published_at DESC, mt.id DESC LIMIT ?`).all(explicitAllowed ? 1 : 0, clean, clean, clean, bounded * 3);
      const tracks = rows.map((row) => this.getMusicTrack(row.id, viewerId)).filter(Boolean).slice(0, bounded);
      const library = this.db.prepare(`SELECT track_id FROM music_library WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).all(viewerId)
        .map((row) => this.getMusicTrack(row.track_id, viewerId)).filter(Boolean);
      return { tracks, library, query: clean, explicit_allowed: Boolean(explicitAllowed), ranker: clean ? "TEXT_MATCH_RIGHTS_GATED" : "CHRONOLOGICAL_RIGHTS_GATED" };
    },
    publishMusicTrack({ ownerId, trackId }) {
      const row = this.db.prepare(`SELECT * FROM music_tracks WHERE id = ? AND owner_id = ?`).get(trackId, ownerId);
      if (!row) throw Object.assign(new Error("music track not found"), { code: "MUSIC_TRACK_NOT_FOUND" });
      if (row.availability_state === "published_local_demo") return this.getMusicTrack(trackId, ownerId);
      if (row.availability_state !== "draft") throw Object.assign(new Error("music track state conflict"), { code: "MUSIC_TRACK_STATE_CONFLICT" });
      const changed = this.db.prepare(`UPDATE music_tracks SET availability_state = 'published_local_demo', published_at = unixepoch()
        WHERE id = ? AND owner_id = ? AND availability_state = 'draft'`).run(trackId, ownerId);
      if (changed.changes !== 1) throw Object.assign(new Error("music publish lost race"), { code: "MUSIC_TRACK_STATE_CONFLICT" });
      return this.getMusicTrack(trackId, ownerId);
    },
    withdrawMusicTrack({ ownerId, trackId }) {
      const changed = this.db.prepare(`UPDATE music_tracks SET availability_state = 'withdrawn'
        WHERE id = ? AND owner_id = ? AND availability_state IN ('draft','published_local_demo')`).run(trackId, ownerId);
      if (changed.changes !== 1) throw Object.assign(new Error("music track state conflict"), { code: "MUSIC_TRACK_STATE_CONFLICT" });
      return this.getMusicTrack(trackId, ownerId);
    },
    setMusicLibrary({ userId, trackId, active }) {
      const track = this.getMusicTrack(trackId, userId);
      if (!track || !new Set(["published_local_demo", "published"]).has(track.availability_state)) throw Object.assign(new Error("music track unavailable"), { code: "MUSIC_TRACK_NOT_FOUND" });
      if (active) this.db.prepare(`INSERT OR IGNORE INTO music_library (user_id, track_id) VALUES (?, ?)`).run(userId, trackId);
      else this.db.prepare(`DELETE FROM music_library WHERE user_id = ? AND track_id = ?`).run(userId, trackId);
      return { track_id: trackId, saved: Boolean(active), private: true };
    },
    recordMusicPlayStart({ userId, trackId }) {
      const track = this.getMusicTrack(trackId, userId);
      if (!track || !new Set(["published_local_demo", "published"]).has(track.availability_state)) throw Object.assign(new Error("music track unavailable"), { code: "MUSIC_TRACK_NOT_FOUND" });
      const info = this.db.prepare(`INSERT INTO music_play_starts (user_id, track_id) VALUES (?, ?)`).run(userId, trackId);
      return { id: Number(info.lastInsertRowid), track_id: trackId, fraud_state: "unqualified", royalty_eligible: false, telemetry_private: true };
    },
    createMusicPlaylist({ ownerId, title, visibility = "private" }) {
      const info = this.db.prepare(`INSERT INTO music_playlists (owner_id, title, visibility) VALUES (?, ?, ?)`).run(ownerId, title, visibility);
      return this.getMusicPlaylist(Number(info.lastInsertRowid), ownerId);
    },
    getMusicPlaylist(playlistId, viewerId) {
      const row = this.db.prepare(`SELECT * FROM music_playlists WHERE id = ? AND (owner_id = ? OR visibility = 'public')`).get(playlistId, viewerId);
      if (!row || this.isAccountBlockedBetween(viewerId, row.owner_id)) return null;
      const items = this.db.prepare(`SELECT track_id, position FROM music_playlist_items WHERE playlist_id = ? ORDER BY position, track_id`).all(playlistId)
        .map((item) => ({ ...item, track: this.getMusicTrack(item.track_id, viewerId) })).filter((item) => item.track);
      return { ...row, items };
    },
    listMusicPlaylists(viewerId) {
      return this.db.prepare(`SELECT id FROM music_playlists WHERE owner_id = ? ORDER BY created_at DESC, id DESC`).all(viewerId)
        .map((row) => this.getMusicPlaylist(row.id, viewerId)).filter(Boolean);
    },
    addMusicPlaylistItem({ ownerId, playlistId, trackId }) {
      const playlist = this.db.prepare(`SELECT * FROM music_playlists WHERE id = ? AND owner_id = ?`).get(playlistId, ownerId);
      const track = this.getMusicTrack(trackId, ownerId);
      if (!playlist || !track || !new Set(["published_local_demo", "published"]).has(track.availability_state)) throw Object.assign(new Error("music playlist target unavailable"), { code: "MUSIC_PLAYLIST_UNAVAILABLE" });
      const position = Number(this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 position FROM music_playlist_items WHERE playlist_id = ?`).get(playlistId).position);
      this.db.prepare(`INSERT OR IGNORE INTO music_playlist_items (playlist_id, track_id, position) VALUES (?, ?, ?)`).run(playlistId, trackId, position);
      return this.getMusicPlaylist(playlistId, ownerId);
    },

    // ---- M11 Grow: W0/W1 only, no health targeting or cross-context reuse ----
    createGrowContent({ ownerId, vertical, format, title, summary, sourceNote, medicalClass }) {
      const info = this.db.prepare(`INSERT INTO grow_content
        (owner_id, vertical, format, title, summary, source_note, medical_class)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(ownerId, vertical, format, title, summary, sourceNote, medicalClass);
      return this.db.prepare(`SELECT gc.*, u.handle owner_handle FROM grow_content gc JOIN users u ON u.id = gc.owner_id WHERE gc.id = ?`).get(Number(info.lastInsertRowid));
    },
    listGrowHome(viewerId, { vertical = "", query = "", limit = 30 } = {}) {
      const bounded = Math.max(1, Math.min(50, Number(limit) || 30));
      const clean = String(query || "").trim().toLowerCase();
      return this.db.prepare(`SELECT gc.*, u.handle owner_handle, u.traffic_class FROM grow_content gc JOIN users u ON u.id = gc.owner_id
        WHERE gc.editorial_state IN ('approved_local_demo','approved') AND gc.medical_class IN ('W0','W1')
          AND u.traffic_class = 'HUMAN_ORGANIC' AND (? = '' OR gc.vertical = ?)
          AND (? = '' OR lower(gc.title) LIKE '%' || ? || '%' OR lower(gc.summary) LIKE '%' || ? || '%')
        ORDER BY gc.reviewed_at DESC, gc.id DESC LIMIT ?`).all(vertical, vertical, clean, clean, clean, bounded * 3)
        .filter((row) => !this.isAccountBlockedBetween(viewerId, row.owner_id)).slice(0, bounded);
    },
    createGrowWorkoutOffer({ ownerId, contentId, title, accessMinutes, priceCents }) {
      const content = this.db.prepare(`SELECT * FROM grow_content WHERE id = ? AND owner_id = ? AND vertical = 'sport'
        AND medical_class IN ('W0','W1') AND editorial_state IN ('approved_local_demo','approved')`).get(contentId, ownerId);
      if (!content) throw Object.assign(new Error("eligible sport content required"), { code: "GROW_CONTENT_NOT_ELIGIBLE" });
      const info = this.db.prepare(`INSERT INTO grow_workout_offers (content_id, owner_id, title, access_minutes, price_cents) VALUES (?, ?, ?, ?, ?)`)
        .run(contentId, ownerId, title, accessMinutes, priceCents);
      return this.db.prepare(`SELECT * FROM grow_workout_offers WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listGrowWorkoutOffers(viewerId) {
      return this.db.prepare(`SELECT gwo.*, u.handle provider_handle FROM grow_workout_offers gwo JOIN users u ON u.id = gwo.owner_id
        WHERE gwo.status = 'active' AND u.traffic_class = 'HUMAN_ORGANIC' ORDER BY gwo.created_at DESC, gwo.id DESC LIMIT 50`).all()
        .filter((row) => !this.isAccountBlockedBetween(viewerId, row.owner_id));
    },
    reserveGrowWorkout({ buyerId, offerId }) {
      const offer = this.db.prepare(`SELECT * FROM grow_workout_offers WHERE id = ? AND status = 'active'`).get(offerId);
      if (!offer) throw Object.assign(new Error("workout offer unavailable"), { code: "GROW_OFFER_NOT_FOUND" });
      if (offer.owner_id === buyerId || this.isAccountBlockedBetween(buyerId, offer.owner_id)) throw Object.assign(new Error("workout reservation denied"), { code: "GROW_RESERVATION_DENIED" });
      const fee = Math.floor(Number(offer.price_cents) * 1000 / 10000);
      try {
        const info = this.db.prepare(`INSERT INTO grow_workout_reservations
          (offer_id, buyer_id, quoted_price_cents, nexus_fee_cents, provider_share_cents)
          VALUES (?, ?, ?, ?, ?)`).run(offerId, buyerId, offer.price_cents, fee, offer.price_cents - fee);
        return this.db.prepare(`SELECT * FROM grow_workout_reservations WHERE id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) error.code = "GROW_RESERVATION_EXISTS";
        throw error;
      }
    },
    createGrowCourse({ ownerId, title, description, priceCents }) {
      const info = this.db.prepare(`INSERT INTO grow_courses (owner_id, title, description, price_cents) VALUES (?, ?, ?, ?)`)
        .run(ownerId, title, description, priceCents);
      return this.db.prepare(`SELECT gc.*, u.handle owner_handle FROM grow_courses gc JOIN users u ON u.id = gc.owner_id WHERE gc.id = ?`).get(Number(info.lastInsertRowid));
    },
    listGrowCourses(viewerId) {
      return this.db.prepare(`SELECT gc.*, u.handle owner_handle, u.traffic_class FROM grow_courses gc JOIN users u ON u.id = gc.owner_id
        WHERE gc.status IN ('published_local_demo','published') AND u.traffic_class = 'HUMAN_ORGANIC'
        ORDER BY gc.created_at DESC, gc.id DESC LIMIT 50`).all().filter((row) => !this.isAccountBlockedBetween(viewerId, row.owner_id));
    },
    enrollGrowCourse({ learnerId, courseId }) {
      const course = this.db.prepare(`SELECT * FROM grow_courses WHERE id = ? AND status IN ('published_local_demo','published')`).get(courseId);
      if (!course) throw Object.assign(new Error("course unavailable"), { code: "GROW_COURSE_NOT_FOUND" });
      if (course.owner_id === learnerId || this.isAccountBlockedBetween(learnerId, course.owner_id)) throw Object.assign(new Error("course enrollment denied"), { code: "GROW_ENROLLMENT_DENIED" });
      const status = Number(course.price_cents) === 0 ? "active" : "local_enrolled_no_payment";
      this.db.prepare(`INSERT INTO grow_enrollments (course_id, learner_id, status) VALUES (?, ?, ?)`)
        .run(courseId, learnerId, status);
      return this.db.prepare(`SELECT * FROM grow_enrollments WHERE course_id = ? AND learner_id = ?`).get(courseId, learnerId);
    },
    listGrowEnrollments(learnerId) {
      return this.db.prepare(`SELECT ge.*, gc.title, gc.description, gc.owner_id, gc.price_cents, gc.currency
        FROM grow_enrollments ge JOIN grow_courses gc ON gc.id = ge.course_id WHERE ge.learner_id = ?
        ORDER BY ge.updated_at DESC, ge.course_id DESC`).all(learnerId);
    },
    updateGrowCourseProgress({ learnerId, courseId, progressPercent }) {
      const changed = this.db.prepare(`UPDATE grow_enrollments SET progress_percent = ?, status = CASE WHEN ? = 100 THEN 'completed' ELSE 'active' END,
        updated_at = unixepoch() WHERE course_id = ? AND learner_id = ? AND status IN ('active','completed')`)
        .run(progressPercent, progressPercent, courseId, learnerId);
      if (changed.changes !== 1) throw Object.assign(new Error("active enrollment required"), { code: "GROW_ENROLLMENT_NOT_ACTIVE" });
      return this.db.prepare(`SELECT * FROM grow_enrollments WHERE course_id = ? AND learner_id = ?`).get(courseId, learnerId);
    },
    createGrowPrivateEntry({ ownerId, vertical, kind, ciphertext, nonce, expiresAt }) {
      const commitment = sha256Hex(JSON.stringify({ ownerId, vertical, kind, ciphertext, nonce }));
      const info = this.db.prepare(`INSERT INTO grow_private_entries (owner_id, vertical, kind, ciphertext, nonce, commitment, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(ownerId, vertical, kind, ciphertext, nonce, commitment, expiresAt);
      return this.db.prepare(`SELECT id, owner_id, vertical, kind, commitment, expires_at, created_at FROM grow_private_entries WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listGrowPrivateEntries(ownerId, { vertical = "" } = {}) {
      return this.db.prepare(`SELECT id, owner_id, vertical, kind, ciphertext, nonce, commitment, expires_at, created_at
        FROM grow_private_entries WHERE owner_id = ? AND expires_at > unixepoch() AND (? = '' OR vertical = ?)
        ORDER BY created_at DESC, id DESC LIMIT 100`).all(ownerId, vertical, vertical);
    },
    deleteGrowPrivateEntry(ownerId, entryId) {
      return this.db.prepare(`DELETE FROM grow_private_entries WHERE id = ? AND owner_id = ?`).run(entryId, ownerId).changes === 1;
    },

    // ---- M12 Nexus Pay: exact local quote -> unsigned intent, never settlement ----
    createPayResolutionReceipt({ senderId, username, network, chainId, tokenId, tokenDecimals, atomicAmount, displayAmount, purposeHash = "", ttlSeconds = 300 }) {
      const sender = this.getUserById(senderId);
      const recipient = this.getUserByHandle(String(username || "").toLowerCase());
      const receiverAddress = recipient?.linked_wallet || recipient?.mvx_address || "";
      if (!sender || !recipient || recipient.id === senderId || !receiverAddress || this.isAccountBlockedBetween(senderId, recipient.id)) {
        throw Object.assign(new Error("pay recipient unavailable"), { code: "PAY_RECIPIENT_UNAVAILABLE" });
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + Math.max(60, Math.min(600, Number(ttlSeconds) || 300));
      const id = randomBytes(12).toString("hex");
      const alias = recipient.handle;
      const aliasVersion = sha256Hex(JSON.stringify({ alias, recipientId: recipient.id, receiverAddress, network, chainId })).slice(0, 32);
      const canonical = { id, senderId, recipientId: recipient.id, alias, aliasVersion, receiverAddress, network, chainId, tokenId, tokenDecimals, atomicAmount, displayAmount, purposeHash, issuedAt, expiresAt };
      const receiptHash = sha256Hex(JSON.stringify(canonical));
      this.db.prepare(`INSERT INTO pay_resolution_receipts
        (id, sender_id, recipient_id, alias, alias_version, receiver_address, network, chain_id, token_id, token_decimals,
         atomic_amount, display_amount, purpose_hash, receipt_hash, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, senderId, recipient.id, alias, aliasVersion, receiverAddress, network, chainId, tokenId, tokenDecimals,
          atomicAmount, displayAmount, purposeHash, receiptHash, issuedAt, expiresAt);
      return this.getPayResolutionReceipt(id, senderId);
    },
    getPayResolutionReceipt(receiptId, senderId) {
      return this.db.prepare(`SELECT id, sender_id, recipient_id, alias, alias_version, receiver_address, network, chain_id,
        token_id, token_decimals, atomic_amount, display_amount, purpose_hash, receipt_hash, integrity_mode, status, issued_at, expires_at
        FROM pay_resolution_receipts WHERE id = ? AND sender_id = ?`).get(receiptId, senderId) ?? null;
    },
    createPayTransferIntent({ senderId, receiptId, expectedReceiptHash, expectedNetwork, expectedChainId }) {
      const intentId = randomBytes(12).toString("hex");
      const nowSeconds = Math.floor(Date.now() / 1000);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const receipt = this.db.prepare(`SELECT * FROM pay_resolution_receipts WHERE id = ? AND sender_id = ?`).get(receiptId, senderId);
        if (!receipt) throw Object.assign(new Error("pay receipt not found"), { code: "PAY_RECEIPT_NOT_FOUND" });
        if (receipt.status !== "preview_active") throw Object.assign(new Error("pay receipt already consumed"), { code: "PAY_RECEIPT_CONFLICT" });
        if (receipt.expires_at <= nowSeconds) {
          this.db.prepare(`UPDATE pay_resolution_receipts SET status = 'expired' WHERE id = ?`).run(receipt.id);
          this.db.exec("COMMIT");
          throw Object.assign(new Error("pay receipt expired"), { code: "PAY_RECEIPT_EXPIRED", alreadyCommitted: true });
        }
        const recipient = this.getUserById(receipt.recipient_id);
        const sender = this.getUserById(senderId);
        const currentReceiver = recipient?.linked_wallet || recipient?.mvx_address || "";
        const senderAddress = sender?.linked_wallet || sender?.mvx_address || "";
        const currentVersion = recipient ? sha256Hex(JSON.stringify({ alias: recipient.handle, recipientId: recipient.id, receiverAddress: currentReceiver, network: receipt.network, chainId: receipt.chain_id })).slice(0, 32) : "";
        const exact = receipt.receipt_hash === expectedReceiptHash && receipt.network === expectedNetwork && receipt.chain_id === expectedChainId
          && recipient?.handle === receipt.alias && currentReceiver === receipt.receiver_address && currentVersion === receipt.alias_version
          && senderAddress && !this.isAccountBlockedBetween(senderId, receipt.recipient_id);
        if (!exact) {
          this.db.prepare(`UPDATE pay_resolution_receipts SET status = 'invalidated' WHERE id = ?`).run(receipt.id);
          this.db.exec("COMMIT");
          throw Object.assign(new Error("pay binding changed"), { code: "PAY_RESOLUTION_STALE", alreadyCommitted: true });
        }
        this.db.prepare(`INSERT INTO pay_transfer_intents
          (id, sender_id, recipient_id, resolution_receipt_id, sender_address, receiver_address, network, chain_id,
           token_id, token_decimals, atomic_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(intentId, senderId, receipt.recipient_id, receipt.id, senderAddress, receipt.receiver_address, receipt.network,
            receipt.chain_id, receipt.token_id, receipt.token_decimals, receipt.atomic_amount);
        const changed = this.db.prepare(`UPDATE pay_resolution_receipts SET status = 'consumed_local_unsigned'
          WHERE id = ? AND status = 'preview_active'`).run(receipt.id);
        if (changed.changes !== 1) throw Object.assign(new Error("pay receipt lost race"), { code: "PAY_RECEIPT_CONFLICT" });
        this.db.exec("COMMIT");
        return this.db.prepare(`SELECT * FROM pay_transfer_intents WHERE id = ?`).get(intentId);
      } catch (error) {
        if (!error?.alreadyCommitted) this.db.exec("ROLLBACK");
        throw error;
      }
    },
    listPayTransfers(userId, limit = 50) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      return this.db.prepare(`SELECT pti.*, sender.handle sender_handle, recipient.handle recipient_handle
        FROM pay_transfer_intents pti JOIN users sender ON sender.id = pti.sender_id JOIN users recipient ON recipient.id = pti.recipient_id
        WHERE pti.sender_id = ? OR pti.recipient_id = ? ORDER BY pti.created_at DESC, pti.id DESC LIMIT ?`)
        .all(userId, userId, bounded).map((row) => ({ ...row, direction: row.sender_id === userId ? "sent" : "received" }));
    },

    // ---- M12 Creator Economy: transparent TEST-USDC intent ledger ----
    createCreatorSupportProduct({ creatorId, kind, title, priceCents, intervalDays = null }) {
      const profile = this.getPersona(creatorId, "social");
      const creator = this.getUserById(creatorId);
      if (!profile || creator?.account_state !== "active") throw Object.assign(new Error("creator profile unavailable"), { code: "CREATOR_PROFILE_UNAVAILABLE" });
      const splitVersion = kind === "tip" ? "CORE_TIP_V1_90_5_3_2" : "CORE_MEMBERSHIP_V1_85_10_3_2";
      const info = this.db.prepare(`INSERT INTO creator_support_products
        (creator_id, kind, title, price_cents, interval_days, split_version) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(creatorId, kind, title, priceCents, kind === "membership" ? intervalDays : null, splitVersion);
      return this.db.prepare(`SELECT * FROM creator_support_products WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listCreatorSupportCatalog(viewerId, creatorHandle) {
      const creator = this.getUserByHandle(String(creatorHandle || "").toLowerCase());
      if (!creator || this.isAccountBlockedBetween(viewerId, creator.id) || (creator.traffic_class !== "HUMAN_ORGANIC" && creator.id !== viewerId)) return null;
      const profile = this.getPersona(creator.id, "social");
      if (!profile || creator.account_state !== "active") return null;
      const products = this.db.prepare(`SELECT * FROM creator_support_products WHERE creator_id = ? AND status = 'active' ORDER BY kind, price_cents, id`).all(creator.id);
      return { creator: { id: creator.id, handle: creator.handle, display_name: profile.name, avatar: profile.avatar }, products };
    },
    createCreatorSupportIntent({ supporterId, productId }) {
      const product = this.db.prepare(`SELECT csp.*, u.traffic_class creator_traffic_class FROM creator_support_products csp
        JOIN users u ON u.id = csp.creator_id WHERE csp.id = ? AND csp.status = 'active'`).get(productId);
      const supporter = this.getUserById(supporterId);
      if (!product || !supporter || product.creator_id === supporterId || this.isAccountBlockedBetween(supporterId, product.creator_id)) {
        throw Object.assign(new Error("creator support unavailable"), { code: "CREATOR_SUPPORT_UNAVAILABLE" });
      }
      const excluded = supporter.traffic_class !== "HUMAN_ORGANIC" || product.creator_traffic_class !== "HUMAN_ORGANIC";
      const quoted = Number(product.price_cents);
      const gross = excluded ? 0 : quoted;
      const creatorBps = product.kind === "tip" ? 9000 : 8500;
      const nexusBps = product.kind === "tip" ? 500 : 1000;
      const creatorShare = Math.floor(gross * creatorBps / 10000);
      const nexusFee = Math.floor(gross * nexusBps / 10000);
      const safetyReserve = Math.floor(gross * 300 / 10000);
      const infra = gross - creatorShare - nexusFee - safetyReserve;
      const id = randomBytes(12).toString("hex");
      const status = excluded ? "excluded_synthetic" : "demo_unpaid";
      const commitment = sha256Hex(JSON.stringify({ id, supporterId, creatorId: product.creator_id, productId, quoted, gross, creatorShare, nexusFee, safetyReserve, infra, currency: product.currency, splitVersion: product.split_version, status }));
      this.db.prepare(`INSERT INTO creator_support_intents
        (id, supporter_id, creator_id, product_id, quoted_cents, gross_cents, creator_share_cents, nexus_fee_cents,
         safety_reserve_cents, infra_cents, currency, status, payout_eligible, split_version, commitment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
        .run(id, supporterId, product.creator_id, productId, quoted, gross, creatorShare, nexusFee, safetyReserve, infra,
          product.currency, status, product.split_version, commitment);
      return this.db.prepare(`SELECT * FROM creator_support_intents WHERE id = ?`).get(id);
    },
    getCreatorDashboard(creatorId) {
      const products = this.db.prepare(`SELECT * FROM creator_support_products WHERE creator_id = ? ORDER BY created_at DESC, id DESC`).all(creatorId);
      const received = this.db.prepare(`SELECT id, product_id, quoted_cents, gross_cents, creator_share_cents, nexus_fee_cents,
        safety_reserve_cents, infra_cents, currency, status, payout_eligible, split_version, commitment, created_at
        FROM creator_support_intents WHERE creator_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(creatorId);
      const sent = this.db.prepare(`SELECT csi.id, csi.product_id, csi.quoted_cents, csi.gross_cents, csi.currency, csi.status,
        csi.commitment, csi.created_at, u.handle creator_handle FROM creator_support_intents csi JOIN users u ON u.id = csi.creator_id
        WHERE csi.supporter_id = ? ORDER BY csi.created_at DESC, csi.id DESC LIMIT 100`).all(creatorId);
      const totals = this.db.prepare(`SELECT COALESCE(SUM(creator_share_cents),0) creator_available_cents,
        COALESCE(SUM(nexus_fee_cents),0) nexus_realized_cents FROM creator_support_intents
        WHERE creator_id = ? AND status = 'settled' AND payout_eligible = 1`).get(creatorId);
      return {
        products, received, sent,
        totals: { ...totals, currency: "TEST-USDC", demo_unpaid_excluded: true },
        creator_fund: { epoch: "LOCAL_ZERO_REVENUE", eligible_net_revenue_cents: 0, pool_cents: 0, reason: "NO_PREFUNDED_OR_REALIZED_ELIGIBLE_REVENUE" },
      };
    },

    // ---- M12 Node Network D0: verifiable local manifests, no false decentralization ----
    registerNexusNodeManifest({ operatorUserId, trustClass, protocolVersion, serviceRoles }) {
      const count = Number(this.db.prepare(`SELECT COUNT(*) count FROM nexus_node_manifests WHERE operator_user_id = ? AND state IN ('candidate','active_local','active_verified')`).get(operatorUserId).count);
      if (count >= 3) throw Object.assign(new Error("local node manifest quota reached"), { code: "NODE_MANIFEST_QUOTA" });
      const nodeId = `node-${randomBytes(12).toString("hex")}`;
      const roles = [...new Set(serviceRoles)].sort();
      const ownerClusterHash = sha256Hex(`NEXUS_NODE_OWNER_V1:${operatorUserId}`);
      const capabilityHash = sha256Hex(JSON.stringify({ nodeId, trustClass, protocolVersion, roles, ownerClusterHash }));
      this.db.prepare(`INSERT INTO nexus_node_manifests
        (node_id, operator_user_id, owner_cluster_hash, trust_class, protocol_version, service_roles_json, capability_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(nodeId, operatorUserId, ownerClusterHash, trustClass, protocolVersion, JSON.stringify(roles), capabilityHash);
      return this.getNexusNodeManifest(nodeId, operatorUserId);
    },
    getNexusNodeManifest(nodeId, viewerId) {
      const row = this.db.prepare(`SELECT * FROM nexus_node_manifests WHERE node_id = ?`).get(nodeId);
      if (!row || (row.operator_user_id !== null && row.operator_user_id !== viewerId && row.state !== "active_verified")) return null;
      return { ...row, service_roles: parseStringArrayJson(row.service_roles_json), service_roles_json: undefined };
    },
    listOwnNexusNodeManifests(operatorUserId) {
      return this.db.prepare(`SELECT node_id FROM nexus_node_manifests WHERE operator_user_id = ? ORDER BY joined_at DESC`).all(operatorUserId)
        .map((row) => this.getNexusNodeManifest(row.node_id, operatorUserId)).filter(Boolean);
    },
    recordNexusNodeCommitment({ operatorUserId, nodeId, eventCount, rangeStart, rangeEnd, payloadHash }) {
      const node = this.db.prepare(`SELECT * FROM nexus_node_manifests WHERE node_id = ? AND operator_user_id = ? AND state = 'candidate'`).get(nodeId, operatorUserId);
      if (!node) throw Object.assign(new Error("local node manifest unavailable"), { code: "NODE_MANIFEST_UNAVAILABLE" });
      const previous = this.db.prepare(`SELECT sequence, root_hash FROM nexus_node_event_commitments WHERE node_id = ? ORDER BY sequence DESC LIMIT 1`).get(nodeId);
      const sequence = Number(previous?.sequence || 0) + 1;
      const previousCommitment = previous?.root_hash || "0".repeat(64);
      const rootHash = sha256Hex(JSON.stringify({ nodeId, sequence, eventCount, rangeStart, rangeEnd, payloadHash, previousCommitment }));
      this.db.prepare(`INSERT INTO nexus_node_event_commitments
        (node_id, sequence, event_count, range_start, range_end, previous_commitment, root_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(nodeId, sequence, eventCount, rangeStart, rangeEnd, previousCommitment, rootHash);
      return this.db.prepare(`SELECT * FROM nexus_node_event_commitments WHERE node_id = ? AND sequence = ?`).get(nodeId, sequence);
    },
    createNexusNodeCheckpoint({ operatorUserId, nodeId, shardKey, eventFrom, eventTo, reducerVersion, stateRoot, backupReceiptHash }) {
      const node = this.db.prepare(`SELECT * FROM nexus_node_manifests WHERE node_id = ? AND operator_user_id = ? AND state = 'candidate'`).get(nodeId, operatorUserId);
      if (!node) throw Object.assign(new Error("local node manifest unavailable"), { code: "NODE_MANIFEST_UNAVAILABLE" });
      const previous = this.db.prepare(`SELECT checkpoint_hash FROM nexus_node_checkpoints WHERE node_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(nodeId);
      const previousCheckpointHash = previous?.checkpoint_hash || "0".repeat(64);
      const id = randomBytes(12).toString("hex");
      const checkpointHash = sha256Hex(JSON.stringify({ id, nodeId, shardKey, eventFrom, eventTo, reducerVersion, stateRoot, previousCheckpointHash, backupReceiptHash }));
      this.db.prepare(`INSERT INTO nexus_node_checkpoints
        (id, node_id, shard_key, event_from, event_to, reducer_version, state_root, previous_checkpoint_hash, backup_receipt_hash, checkpoint_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, nodeId, shardKey, eventFrom, eventTo, reducerVersion, stateRoot, previousCheckpointHash, backupReceiptHash, checkpointHash);
      return this.db.prepare(`SELECT * FROM nexus_node_checkpoints WHERE id = ?`).get(id);
    },
    getNexusNodeNetworkStatus(viewerId) {
      const active = this.db.prepare(`SELECT node_id, owner_cluster_hash, trust_class, protocol_version, state FROM nexus_node_manifests
        WHERE state IN ('active_local','active_verified') ORDER BY joined_at`).all();
      const candidates = Number(this.db.prepare(`SELECT COUNT(*) count FROM nexus_node_manifests WHERE state = 'candidate'`).get().count);
      const verified = active.filter((node) => node.state === "active_verified");
      const ownerClusters = new Set(verified.map((node) => node.owner_cluster_hash)).size;
      const own = this.listOwnNexusNodeManifests(viewerId);
      return {
        mode: active.length <= 1 ? "D0_GENESIS" : "LOCAL_MESH_UNVERIFIED",
        active_nodes: active.length,
        verified_public_nodes: verified.length,
        candidate_manifests: candidates,
        verified_owner_clusters: ownerClusters,
        replication_target: Math.min(Math.max(active.length, 1), 3),
        observed_replication: 1,
        health: "LOCAL_API_RESPONDING",
        decentralization_claim: false,
        claim_reason: "LOCAL_SINGLE_NODE_OR_UNVERIFIED_MANIFESTS",
        genesis: active.find((node) => node.trust_class === "GENESIS") || null,
        own_manifests: own,
      };
    },

    // Reviews are transaction-bound. Market reviews are visible immediately;
    // Stay/Ride remain double-blind until both parties submit or 14 days pass.
    createTransactionReview({ vertical, subjectId, reviewerId, rating, comment, atSeconds = Math.floor(Date.now() / 1000) }) {
      let subject;
      if (vertical === "market") subject = this.getMarketOrder(subjectId);
      else if (vertical === "stay") subject = this.getStayBooking(subjectId);
      else if (vertical === "ride") subject = this.getRideRequest(subjectId);
      const participants = vertical === "market" ? [subject?.seller_id, subject?.buyer_id] : vertical === "stay" ? [subject?.host_id, subject?.guest_id] : [subject?.rider_id, subject?.driver_id];
      if (!subject || subject.status !== "completed" || !participants.includes(reviewerId)) throw Object.assign(new Error("review not eligible"), { code: "REVIEW_NOT_ELIGIBLE" });
      const revieweeId = participants.find((id) => id !== reviewerId);
      try {
        const info = this.db.prepare(`INSERT INTO transaction_reviews (vertical, subject_id, reviewer_id, reviewee_id, rating, comment, visible, reveal_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(vertical, subjectId, reviewerId, revieweeId, rating, comment, vertical === "market" ? 1 : 0, atSeconds + 14 * 86400, atSeconds);
        if (vertical !== "market") {
          const count = Number(this.db.prepare(`SELECT COUNT(*) count FROM transaction_reviews WHERE vertical = ? AND subject_id = ?`).get(vertical, subjectId).count);
          if (count >= 2) this.db.prepare(`UPDATE transaction_reviews SET visible = 1 WHERE vertical = ? AND subject_id = ?`).run(vertical, subjectId);
        }
        return this.db.prepare(`SELECT * FROM transaction_reviews WHERE id = ?`).get(Number(info.lastInsertRowid));
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) error.code = "REVIEW_ALREADY_SUBMITTED";
        throw error;
      }
    },
    listTransactionReviews({ vertical, revieweeId, atSeconds = Math.floor(Date.now() / 1000), limit = 50 }) {
      this.db.prepare(`UPDATE transaction_reviews SET visible = 1 WHERE vertical = ? AND visible = 0 AND reveal_at <= ?`).run(vertical, atSeconds);
      return this.db.prepare(`SELECT r.*, u.handle reviewer_handle, u.display_name reviewer_name FROM transaction_reviews r JOIN users u ON u.id = r.reviewer_id
        WHERE r.vertical = ? AND r.reviewee_id = ? AND r.visible = 1 ORDER BY r.created_at DESC, r.id DESC LIMIT ?`)
        .all(vertical, revieweeId, Math.max(1, Math.min(100, Number(limit) || 50)));
    },

    // ---- devnet actions ----
    recordDevnetAction({ userId = null, actor, action, payloadHash, txHash, explorerUrl, status = "pending" }) {
      const info = this.db.prepare(`INSERT INTO devnet_actions (user_id, actor, action, payload_hash, tx_hash, explorer_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, actor, action, payloadHash, txHash, explorerUrl, status);
      return this.db.prepare(`SELECT * FROM devnet_actions WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    listDevnetActions({ userId, limit = 100 } = {}) {
      if (userId) return this.db.prepare(`SELECT * FROM devnet_actions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(userId, limit);
      return this.db.prepare(`SELECT * FROM devnet_actions ORDER BY created_at DESC LIMIT ?`).all(limit);
    },

    // ---- notifications ----
    notify(userId, type, body, { persona = "social", sensitive = false } = {}) {
      persona = normalizePersona(persona);
      type = NOTIFICATION_TYPE_SET.has(type) ? type : "system";
      const preference = this.db.prepare(`SELECT * FROM notification_preferences WHERE user_id = ? AND persona = ? AND type = ?`).get(userId, persona, type);
      if (!NOTIFICATION_MANDATORY.has(type) && preference && !preference.in_app) return { delivered: false, reason: "disabled_by_preference" };
      const preview = sensitive || persona === "dating" ? "generic" : (preference?.preview || "generic");
      const safeBody = preview === "content" ? String(body) : preview === "sender" ? String(body).split(":")[0] : String(body).replace(/\s+from\s+@?[a-z0-9_.-]+/i, "");
      const nowSeconds = Math.floor(Date.now() / 1000);
      const grouped = this.db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND persona = ? AND type = ? AND body = ? AND read = 0 AND created_at >= ?
        ORDER BY id DESC LIMIT 1
      `).get(userId, persona, type, safeBody, nowSeconds - 300);
      if (grouped) {
        this.db.prepare(`UPDATE notifications SET actor_count = actor_count + 1, created_at = ? WHERE id = ?`).run(nowSeconds, grouped.id);
        return { delivered: true, grouped: true, id: grouped.id };
      }
      const result = this.db.prepare(`INSERT INTO notifications (user_id, persona, type, body, sensitive, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(userId, persona, type, safeBody, sensitive ? 1 : 0, nowSeconds);
      return { delivered: true, grouped: false, id: Number(result.lastInsertRowid) };
    },
    listNotifications(userId, { persona = "all", limit = 50 } = {}) {
      const bounded = Math.max(1, Math.min(100, Number(limit) || 50));
      if (persona === "all") return this.db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`).all(userId, bounded);
      return this.db.prepare(`SELECT * FROM notifications WHERE user_id = ? AND persona = ? ORDER BY created_at DESC, id DESC LIMIT ?`).all(userId, normalizePersona(persona), bounded);
    },
    unreadNotifications(userId, persona = "all") {
      if (persona === "all") return Number(this.db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0`).get(userId).c);
      return Number(this.db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND persona = ? AND read = 0`).get(userId, normalizePersona(persona)).c);
    },
    unreadNonMessageNotifications(userId) {
      return Number(this.db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0 AND type <> 'message'`).get(userId).c);
    },
    markNotificationRead(userId, notificationId) {
      const result = this.db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ? AND read = 0`).run(notificationId, userId);
      return { changed: Number(result.changes) === 1, notification: this.db.prepare(`SELECT * FROM notifications WHERE id = ? AND user_id = ?`).get(notificationId, userId) ?? null };
    },
    markAllNotificationsRead(userId, persona = "all") {
      const result = persona === "all"
        ? this.db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`).run(userId)
        : this.db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND persona = ? AND read = 0`).run(userId, normalizePersona(persona));
      return Number(result.changes);
    },
    notificationPreferences(userId, persona = "social") {
      persona = normalizePersona(persona);
      const stored = new Map(this.db.prepare(`SELECT * FROM notification_preferences WHERE user_id = ? AND persona = ?`).all(userId, persona).map((row) => [row.type, row]));
      return NOTIFICATION_TYPES.map((type) => stored.get(type) ?? {
        user_id: userId, persona, type, in_app: 1, push: 0, email: 0,
        preview: persona === "dating" ? "generic" : "sender", quiet_start: null, quiet_end: null,
      });
    },
    setNotificationPreference(userId, persona, type, input) {
      persona = normalizePersona(persona);
      if (!NOTIFICATION_TYPE_SET.has(type)) throw new Error("NOTIFICATION_TYPE_INVALID");
      const preview = NOTIFICATION_PREVIEWS.has(input.preview) ? input.preview : "generic";
      const safePreview = persona === "dating" ? "generic" : preview;
      const mandatory = NOTIFICATION_MANDATORY.has(type);
      this.db.prepare(`
        INSERT INTO notification_preferences (user_id, persona, type, in_app, push, email, preview, quiet_start, quiet_end, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(user_id, persona, type) DO UPDATE SET
          in_app = excluded.in_app, push = excluded.push, email = excluded.email,
          preview = excluded.preview, quiet_start = excluded.quiet_start,
          quiet_end = excluded.quiet_end, updated_at = excluded.updated_at
      `).run(userId, persona, type, mandatory ? 1 : (input.in_app ? 1 : 0), input.push ? 1 : 0, input.email ? 1 : 0, safePreview, input.quiet_start || null, input.quiet_end || null);
      return this.notificationPreferences(userId, persona).find((row) => row.type === type);
    },

    // ---- stats ----
    stats() {
      const table = (name) => Number(this.db.prepare(`SELECT COUNT(*) c FROM ${name}`).get().c);
      return { users: table("users"), posts: table("posts"), follows: table("follows"), likes: table("likes"), messages: table("messages"), listings: table("listings"), media: table("media"), devnet_actions: table("devnet_actions") };
    },
  };
}

export const payloadHash = sha256Hex;
