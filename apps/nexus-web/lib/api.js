import { URL } from "node:url";
import {
  json, send, redirect, parseCookies, setCookie, clearCookie, readBody, readJson, sanitizeText,
} from "./transport.js";
import {
  hashPassword, verifyPassword, hashToken, verifyToken, issueSession, sessionSecret, sha256Hex,
} from "./security.js";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Address, UserVerifier } from "@multiversx/sdk-core";
import { captionTrackAvailability, mediaDeliveryPolicy, readCaptionTrack, readMedia } from "./media.js";
import {
  devnetActionProof, DEVNET_EXPLORER,
  validateNativeAuthToken, resolveHerotag, resolveMvxNetwork, buildNativeAuthInit,
} from "./mvx.js";
import { MAX_E2EE_DEVICE_ENVELOPES, normalizePersona, NOTIFICATION_TYPES, PERSONAS, PROFILE_TABS, RECOVERY_DEVICE_PENDING_TTL_SECONDS, SOCIAL_REACTIONS, extractPostTags, deriveAge, normaliseBirthDate, normaliseTabsOrder } from "./repo.js";
import { walletConnectAttestation } from "./env.js";
import {
  assessSocialContent, normalizeProvenance, REPORT_CATEGORIES,
} from "./moderation.js";
import { normalizeCreatorAudio, normalizeCreatorStudio } from "./creator-studio.js";
import {
  UploadError, beginResumableUpload, cancelResumableUpload, completeResumableUpload,
  getResumableUpload, putResumablePart,
} from "./resumable-upload.js";
import {
  MUTATION_BODY_LIMIT, MUTATION_METHODS, MutationError, attachMutationRecorder,
  completeMutationRecord, mutationErrorPayload, prepareMutation,
} from "./mutation-idempotency.js";
import {
  NativeAuthSessionError, assertNativeAuthIdempotencyKey, consumeNativeAuthSession,
} from "./native-auth-session.js";
import {
  EmailAuthCommandError, assertEmailAuthIdempotencyKey, consumeEmailAuthCommand,
  consumeAuthLogout, consumeAuthLogoutAll, getEmailSignupChallenge, issueEmailSignupChallenge, replayEmailAuthCommand,
} from "./email-auth-session.js";
import {
  cancelAccountDeletion, createAccountExportRequest,
  getAccountExport, getDeletionStatus, requestAccountDeletion,
} from "./account-lifecycle.js";
import { evaluateOperationalControl, operationalStatus } from "./operational-controls.js";
import { readBreakingNews } from "./news-provider.js";

const OAUTH_STATE = new Map(); // state -> provider + expiry + PKCE verifier
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const AUTH_ATTEMPTS = new Map(); // hashed scope+subject -> timestamps (local adapter)
const AUTH_ATTEMPT_MAX_BUCKETS = 10_000;

const WORK_AVAILABILITY = new Set(["open", "not_looking", "hiring"]);
const WORKPLACE_TYPES = new Set(["onsite", "hybrid", "remote"]);
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "contract", "internship"]);
const BUSINESS_CATEGORIES = new Set(["business", "hair_salon", "beauty"]);
const SERVICE_CATEGORIES = new Set(["haircut", "hair_styling", "beauty", "consultation"]);
const MARKET_CATEGORIES = new Set(["electronics", "home", "fashion", "vehicles", "sports", "collectibles", "services", "other"]);
const MARKET_SALE_MODES = new Set(["free_classified", "protected_checkout"]);
const DISCOVERY_SCOPES = new Set(["local", "global"]);
const STAY_CANCELLATION_POLICIES = new Set(["flexible", "moderate", "strict"]);
const DATING_GENDERS = new Set(["woman", "man", "nonbinary", "self_described", "private"]);
const DATING_INTENTIONS = new Set(["long_term", "partnership", "slow_dating", "casual", "friendship", "non_monogamy", "exploring"]);
const DATING_VISIBILITIES = new Set(["discoverable", "paused", "private"]);
const WATCH_AUDIENCES = new Set(["public", "subscribers", "private"]);
const WATCH_AGE_RATINGS = new Set(["general", "teen", "adult"]);
const WATCH_NOTIFICATION_MODES = new Set(["none", "personalized", "all"]);
const KIDS_AGE_BANDS = new Set(["preschool", "6_8", "9_12", "13_15", "16_17"]);
const KIDS_FEEDBACK = new Set(["LOVE", "HAHA", "WOW", "SHOW_LESS"]);
const MUSIC_RIGHTS_BASES = new Set(["original", "public_domain", "creative_commons", "direct_license"]);
const GROW_VERTICALS = new Set(["nutrition", "sport", "learn"]);
const GROW_FORMATS = new Set(["article", "video", "program", "course_intro"]);
const GROW_MEDICAL_CLASSES = new Set(["W0", "W1"]);
const GROW_PRIVATE_KINDS = new Set(["goal", "journal", "note", "progress"]);
const PAY_ASSETS = Object.freeze({
  EGLD: Object.freeze({ token_id: "EGLD", decimals: 18, network_scope: "MULTIVERSX_DIRECT" }),
  "TEST-USDC": Object.freeze({ token_id: "TEST-USDC", decimals: 6, network_scope: "LOCAL_DEMO_ONLY" }),
});
const CREATOR_PRODUCT_KINDS = new Set(["tip", "membership"]);
const NODE_TRUST_CLASSES = new Set(["T0", "T1"]);
const NODE_SERVICE_ROLES = new Set(["storage", "edge", "index", "relay", "home", "transcode", "live"]);
const PROHIBITED_MARKET_TERMS = /\b(?:weapon|firearm|gun|ammo|drug|narcotic|stolen|counterfeit|explosive|arma|muniție|drog|furat|contrafăcut|exploziv)\b/iu;

function exactObject(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return Object.keys(body).every((key) => allowed.has(key));
}

function parsePayAmount(value, decimals) {
  const raw = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,18})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > decimals) return null;
  const atomic = (BigInt(whole) * (10n ** BigInt(decimals))) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (atomic <= 0n) return null;
  const normalizedFraction = fraction.replace(/0+$/, "");
  return { atomic: atomic.toString(), display: normalizedFraction ? `${whole}.${normalizedFraction}` : whole };
}

function mapM12Error(error) {
  const code = String(error?.code || "");
  if (new Set(["PAY_RECIPIENT_UNAVAILABLE", "PAY_RECEIPT_NOT_FOUND", "CREATOR_PROFILE_UNAVAILABLE", "CREATOR_SUPPORT_UNAVAILABLE", "NODE_MANIFEST_UNAVAILABLE"]).has(code)) return { status: 404, code, error: "resource unavailable" };
  if (new Set(["PAY_RECEIPT_CONFLICT", "PAY_RECEIPT_EXPIRED", "PAY_RESOLUTION_STALE", "NODE_MANIFEST_QUOTA"]).has(code)) return { status: 409, code, error: String(error.message || "state conflict") };
  return null;
}

function mapM5Error(error) {
  const code = String(error?.code || "");
  const conflicts = new Set(["JOB_ALREADY_APPLIED", "JOB_NOT_AVAILABLE", "JOB_SELF_APPLICATION", "SLOT_ALREADY_EXISTS", "SLOT_NOT_AVAILABLE", "SLOT_SELF_BOOKING", "APPOINTMENT_STATE_CONFLICT"]);
  const denied = new Set(["BUSINESS_PAGE_NOT_OWNED", "BUSINESS_SERVICE_NOT_OWNED", "APPOINTMENT_OWNER_REQUIRED"]);
  if (code === "APPOINTMENT_NOT_FOUND") return { status: 404, code, error: "appointment not found" };
  if (conflicts.has(code)) return { status: 409, code, error: String(error.message) };
  if (denied.has(code)) return { status: 403, code, error: "operation denied" };
  return null;
}

function mapFairVerticalError(error) {
  const code = String(error?.code || "");
  const notFound = new Set(["MARKET_OFFER_NOT_FOUND", "MARKET_ORDER_NOT_FOUND", "STAY_BOOKING_NOT_FOUND", "RIDE_NOT_FOUND"]);
  const denied = new Set(["RIDE_DRIVER_NOT_ELIGIBLE"]);
  const conflicts = new Set([
    "MARKET_LISTING_NOT_AVAILABLE", "MARKET_SELF_OFFER", "MARKET_ALREADY_OFFERED", "MARKET_OFFER_NOT_MUTABLE",
    "MARKET_ORDER_STATE_CONFLICT", "STAY_NOT_AVAILABLE", "STAY_SELF_BOOKING", "STAY_GUEST_LIMIT",
    "STAY_DATES_UNAVAILABLE", "STAY_BOOKING_STATE_CONFLICT", "RIDE_NOT_AVAILABLE", "RIDE_PIN_OR_STATE_INVALID",
    "RIDE_STATE_CONFLICT", "RIDE_DRIVER_BUSY", "REVIEW_NOT_ELIGIBLE", "REVIEW_ALREADY_SUBMITTED",
  ]);
  if (notFound.has(code)) return { status: 404, code, error: "resource not found" };
  if (denied.has(code)) return { status: 403, code, error: "operation denied" };
  if (conflicts.has(code)) return { status: 409, code, error: String(error.message || "state conflict") };
  return null;
}

function mapDatingError(error) {
  const code = String(error?.code || "");
  if (new Set(["DATING_MATCH_NOT_FOUND", "DATING_MEET_NOT_FOUND"]).has(code)) return { status: 404, code, error: "resource not found" };
  if (new Set(["DATING_CANDIDATE_NOT_AVAILABLE", "DATING_DECISION_EXISTS", "DATING_PAIR_CLOSED", "DATING_MATCH_STATE_CONFLICT", "DATING_MEET_STATE_CONFLICT", "DATING_MEET_PIN_OR_WINDOW_INVALID"]).has(code)) {
    return { status: 409, code, error: String(error.message || "dating state conflict") };
  }
  return null;
}

function mapM10Error(error) {
  const code = String(error?.code || "");
  if (new Set(["WATCH_VIDEO_NOT_FOUND", "LIVE_SESSION_NOT_FOUND", "KIDS_CHILD_NOT_FOUND", "KIDS_VIDEO_NOT_FOUND"]).has(code)) return { status: 404, code, error: "resource not found" };
  if (new Set(["WATCH_CHANNEL_NOT_OWNED", "WATCH_MEDIA_NOT_ELIGIBLE", "WATCH_VIDEO_NOT_PUBLISHABLE", "WATCH_VIDEO_STATE_CONFLICT", "WATCH_CHANNEL_UNAVAILABLE", "WATCH_PLAYLIST_UNAVAILABLE", "LIVE_STATE_CONFLICT", "FAMILY_GROUP_UNAVAILABLE", "KIDS_CATALOG_NOT_ELIGIBLE", "KIDS_IDEMPOTENCY_CONFLICT"]).has(code)) return { status: 409, code, error: String(error.message || "state conflict") };
  if (code === "LIVE_INGEST_NOT_CONFIGURED") return { status: 503, code, error: "public Live requires an approved ingest/SFU and moderation provider" };
  return null;
}

function mapM11Error(error) {
  const code = String(error?.code || "");
  if (new Set(["MUSIC_TRACK_NOT_FOUND", "GROW_OFFER_NOT_FOUND", "GROW_COURSE_NOT_FOUND"]).has(code)) return { status: 404, code, error: "resource not found" };
  if (new Set(["MUSIC_ARTIST_NOT_OWNED", "MUSIC_MEDIA_NOT_ELIGIBLE", "MUSIC_TRACK_STATE_CONFLICT", "MUSIC_PLAYLIST_UNAVAILABLE",
    "GROW_CONTENT_NOT_ELIGIBLE", "GROW_RESERVATION_DENIED", "GROW_RESERVATION_EXISTS", "GROW_ENROLLMENT_DENIED", "GROW_ENROLLMENT_NOT_ACTIVE"]).has(code)) {
    return { status: 409, code, error: String(error.message || "state conflict") };
  }
  return null;
}

function publicDatingProfile(profile, own = false) {
  if (!profile) return null;
  const { seeking_json, interests_json, ...safe } = profile;
  if (!own) delete safe.seeking;
  return safe;
}

function publicRide(row) {
  if (!row) return null;
  const { trip_pin_hash, ...safe } = row;
  return safe;
}

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

export function issueOAuthState(provider, issuedAt = now(), clientBinding = "") {
  if (!new Set(["google", "facebook"]).has(provider)) throw new Error("unsupported oauth provider");
  for (const [key, value] of OAUTH_STATE) {
    if (value.expiresAt < issuedAt) OAUTH_STATE.delete(key);
  }
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = toBase64Url(createHash("sha256").update(codeVerifier).digest());
  const clientBindingHash = clientBinding ? sha256Hex(clientBinding) : null;
  OAUTH_STATE.set(state, { provider, expiresAt: issuedAt + OAUTH_STATE_TTL_MS, codeVerifier, clientBindingHash });
  return { state, codeChallenge, expiresAt: issuedAt + OAUTH_STATE_TTL_MS };
}

export function consumeOAuthState(provider, state, consumedAt = now(), clientBinding = "") {
  const record = OAUTH_STATE.get(String(state ?? ""));
  OAUTH_STATE.delete(String(state ?? ""));
  const presentedBindingHash = clientBinding ? sha256Hex(clientBinding) : null;
  if (!record || record.provider !== provider || record.expiresAt < consumedAt || record.clientBindingHash !== presentedBindingHash) return null;
  return record;
}

// Reconstruct the externally-visible origin (localhost direct vs tunnel/proxy).
export function externalOrigin(req) {
  const configured = String(process.env.NEXUS_ORIGIN ?? "").trim();
  if (configured) {
    const parsed = new URL(configured);
    if (!new Set(["http:", "https:"]).has(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
      throw new Error("invalid configured origin");
    }
    if (parsed.protocol !== "https:" && !new Set(["localhost", "127.0.0.1", "::1"]).has(parsed.hostname)) {
      throw new Error("non-local OAuth origin must use https");
    }
    return parsed.origin;
  }

  const host = String(req.headers.host ?? "").trim();
  if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(host) || /[\\/@]/.test(host)) throw new Error("invalid request host");
  const proto = requestIsSecure(req) ? "https" : "http";
  const parsed = new URL(`${proto}://${host}`);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || /^10\./.test(parsed.hostname) || /^192\.168\./.test(parsed.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);
  if (!local && parsed.protocol !== "https:") throw new Error("non-local OAuth origin must use https");
  return parsed.origin;
}

function uniqueOAuthHandle(repo, { provider, email, displayName }) {
  const emailBase = String(email ?? "").split("@")[0];
  const nameBase = String(displayName ?? "");
  const base = (emailBase || nameBase || provider || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
  let handle = base;
  let suffix = 1;
  while (repo.getUserByHandle(handle)) handle = `${base.slice(0, 24)}${suffix++}`;
  return handle;
}

function provisionOAuthIdentity({ repo, db, provider, subject, email, displayName }) {
  const getter = provider === "google" ? repo.getUserByGoogleSub.bind(repo) : repo.getUserByFacebookSub.bind(repo);
  const existing = getter(subject);
  if (existing) return existing;
  const cleanEmail = sanitizeText(email, 120).toLowerCase();
  const emailAvailable = cleanEmail && !repo.getUserByEmail(cleanEmail) ? cleanEmail : undefined;
  const handle = uniqueOAuthHandle(repo, { provider, email: emailAvailable, displayName });
  return transact(db, () => {
    const user = repo.createUser({ handle, displayName: sanitizeText(displayName, 50) || handle });
    for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    repo.linkProvider(user.id, {
      email: emailAvailable,
      googleSub: provider === "google" ? subject : undefined,
      facebookSub: provider === "facebook" ? subject : undefined,
    });
    // A social identity never auto-merges by email and does not receive an
    // unrecoverable server-generated key. Secure embedded-wallet setup or an
    // xPortal link is completed in Account after login.
    return repo.getUserById(user.id);
  });
}

function now() {
  return Date.now();
}

export function consumeAuthAttempt(scope, subject, { limit, windowMs, at = now() } = {}) {
  const max = Math.max(1, Number(limit) || 1);
  const window = Math.max(1000, Number(windowMs) || 1000);
  const key = sha256Hex(`${scope}:${subject}`);
  if (!AUTH_ATTEMPTS.has(key) && AUTH_ATTEMPTS.size >= AUTH_ATTEMPT_MAX_BUCKETS) {
    const oldest = AUTH_ATTEMPTS.keys().next().value;
    if (oldest) AUTH_ATTEMPTS.delete(oldest);
  }
  const cutoff = at - window;
  const recent = (AUTH_ATTEMPTS.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (recent.length >= max) {
    AUTH_ATTEMPTS.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + window - at) / 1000)) };
  }
  recent.push(at);
  AUTH_ATTEMPTS.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearAuthAttempts(scope, subject) {
  AUTH_ATTEMPTS.delete(sha256Hex(`${scope}:${subject}`));
}

function requestClientId(req) {
  if (process.env.NEXUS_TRUST_PROXY === "1") {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (/^[a-f0-9:.]{2,64}$/i.test(forwarded)) return forwarded;
  }
  return String(req.socket?.remoteAddress ?? "unknown").slice(0, 64);
}

function enforceAuthRate(req, res, scope, subject, { limit, windowMs }) {
  const bucket = `${requestClientId(req)}:${String(subject ?? "").toLowerCase()}`;
  const outcome = consumeAuthAttempt(scope, bucket, { limit, windowMs });
  if (outcome.allowed) return { allowed: true, bucket };
  res.setHeader("Retry-After", String(outcome.retryAfterSeconds));
  json(res, 429, { ok: false, error: "prea multe încercări; încearcă din nou mai târziu" });
  return { allowed: false, bucket };
}

function readAuthJson(req) {
  return readJson(req, 64 * 1024);
}

function uploadIdempotencyKey(req) {
  return String(req.headers["idempotency-key"] ?? "").trim();
}

function resumableUploadError(res, error) {
  if (error instanceof UploadError) {
    return json(res, error.status, { ok: false, code: error.code, error: error.message, retryable: error.retryable });
  }
  if (error?.message === "body too large") return json(res, 413, { ok: false, code: "UPLOAD_PART_TOO_LARGE", error: "upload part too large", retryable: false });
  throw error;
}

function walletSignupMessage(email, nonce) {
  return `NEXUS_EMAIL_DEVICE_WALLET_V1:${sha256Hex(String(email).trim().toLowerCase())}:${nonce}`;
}

async function verifyWalletSignupProof(email, proof) {
  const nonce = sanitizeText(proof?.nonce, 128);
  const address = sanitizeText(proof?.address, 90);
  const signatureHex = sanitizeText(proof?.signature, 256).toLowerCase();
  if (!Address.isValid(address) || !/^erd1/.test(address) || !/^[a-f0-9]{128}$/.test(signatureHex)) return null;
  try {
    const verifier = UserVerifier.fromAddress(Address.newFromBech32(address));
    const valid = await verifier.verify(Buffer.from(walletSignupMessage(email, nonce), "utf8"), Buffer.from(signatureHex, "hex"));
    return valid ? { address } : null;
  } catch {
    return null;
  }
}

function requestIsSecure(req) {
  if (req.socket?.encrypted) return true;
  if (process.env.NEXUS_TRUST_PROXY !== "1") return false;
  return String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim().toLowerCase() === "https";
}

function deviceLabel(userAgent = "") {
  const ua = String(userAgent);
  const platform = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Macintosh|Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Browser";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Nexus";
  return `${browser} · ${platform}`;
}

function setSessionCookie(req, res, token, repo = null) {
  if (process.env.NODE_ENV === "production" && !requestIsSecure(req)) {
    throw new Error("secure transport is required for production session cookies");
  }
  const cookies = parseCookies(req);
  const existingDeviceId = String(cookies.nexus_device_id || "");
  const deviceId = /^[a-f0-9]{32}$/.test(existingDeviceId) ? existingDeviceId : randomBytes(16).toString("hex");
  const label = deviceLabel(req.headers["user-agent"]);
  if (repo) repo.bindSessionDevice(hashToken(token), {
    deviceId,
    deviceLabel: label,
    deviceFingerprint: sha256Hex(`${deviceId}:${String(req.headers["user-agent"] || "unknown")}`),
  });
  setCookie(res, "nexus_session", token, {
    maxAge: 60 * 60 * 24 * 30,
    secure: requestIsSecure(req),
  });
  setCookie(res, "nexus_device_id", deviceId, {
    maxAge: 60 * 60 * 24 * 365,
    secure: requestIsSecure(req),
  });
}

function transact(db, operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function requireAuth(req, res, repo) {
  const cookies = parseCookies(req);
  const raw = cookies.nexus_session ?? req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || typeof payload.sub !== "number") return null;
  const tokenHash = hashToken(raw);
  const session = repo.getSession(tokenHash);
  if (!session || session.expires_at < now()) return null;
  if (Number(session.user_id) !== Number(payload.sub)) return null;
  const user = repo.getUserById(payload.sub);
  if (!user) return null;
  if (!session.device_id || session.device_id === "unknown") {
    const cookies = parseCookies(req);
    const deviceId = /^[a-f0-9]{32}$/.test(String(cookies.nexus_device_id || ""))
      ? String(cookies.nexus_device_id)
      : sha256Hex(`legacy-session-device-v1:${tokenHash}`).slice(0, 32);
    repo.bindSessionDevice(tokenHash, {
      deviceId,
      deviceLabel: deviceLabel(req.headers["user-agent"]),
      deviceFingerprint: sha256Hex(`${deviceId}:${String(req.headers["user-agent"] || "unknown")}`),
    });
  }
  repo.touchSession(tokenHash);
  return { user, session, payload, token: raw, tokenHash, persona: normalizePersona(session.persona ?? payload.persona) };
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, handle: u.handle, display_name: u.display_name, email: u.email, email_verified: Boolean(u.email_verified), bio: u.bio, avatar: u.avatar, mvx_address: u.mvx_address, mvx_alias: u.mvx_alias, linked_wallet: u.linked_wallet, needs_onboarding: !(u.mvx_address || u.linked_wallet), created_at: u.created_at };
}

function chatMessageMutationView(message, replay) {
  return {
    ok: true,
    replay: Boolean(replay),
    intent: {
      conversation_id: Number(message.conversation_id),
      sender_id: Number(message.sender_id),
      sender_persona: message.sender_persona,
      client_nonce: message.client_nonce,
      encryption_mode: message.encryption_mode,
      attachment_media_id: message.attachment_media_id == null ? null : Number(message.attachment_media_id),
    },
    message,
  };
}

function ownerSafeChatDevice(device) {
  if (!device) return null;
  return {
    device_id: device.device_id,
    label: device.label,
    key_algorithm: device.key_algorithm,
    device_kind: device.device_kind || "primary",
    status: device.status,
    registered_at: device.registered_at,
    last_seen_at: device.last_seen_at,
    revoked_at: device.revoked_at,
    activation_expires_at: device.activation_expires_at,
    activated_at: device.activated_at,
  };
}

function recoveryAccountBinding(user) {
  const address = String(user?.mvx_address || user?.linked_wallet || "").toLowerCase();
  if (!Number.isSafeInteger(Number(user?.id)) || Number(user.id) < 1 || !/^erd1[0-9a-z]{58}$/.test(address)) return null;
  return sha256Hex(`NEXUS_E2EE_ACCOUNT_BINDING_V1:${Number(user.id)}:${address}`);
}

export function recoveryActivationToken(userId, deviceId, idempotencyKey) {
  const id = Number(userId);
  const device = String(deviceId ?? "");
  const key = String(idempotencyKey ?? "");
  if (!Number.isSafeInteger(id) || id < 1 || !/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(device) || key.length < 16 || key.length > 128) throw new Error("recovery activation context is invalid");
  return createHmac("sha256", sessionSecret()).update(`NEXUS_RECOVERY_ACTIVATION_V1\0${id}\0${device}\0${key}`).digest("base64url");
}

function decodeChatDevicePath(value) {
  try {
    const decoded = decodeURIComponent(String(value ?? ""));
    return /^[a-zA-Z0-9:_-]{16,80}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function accountStepUp(user, body) {
  if (user.password_hash && verifyPassword(String(body.current_password || ""), user.password_hash)) return { ok: true, method: "password" };
  const nativeToken = sanitizeText(body.token, 4096);
  if (nativeToken) {
    try {
      const result = await validateNativeAuthToken(nativeToken, { network: resolveMvxNetwork().label });
      const expected = user.linked_wallet || user.mvx_address;
      if (expected && result.address === expected) return { ok: true, method: "xportal" };
    } catch { /* fail closed below */ }
  }
  return { ok: false };
}

function formatRawAmount(raw, decimals = 18) {
  const value = String(raw ?? "0");
  if (!/^\d+$/.test(value)) return "0";
  const scale = Math.max(0, Math.min(30, Number(decimals) || 0));
  const padded = value.padStart(scale + 1, "0");
  const whole = scale ? (padded.slice(0, -scale) || "0") : padded;
  const fraction = scale ? padded.slice(-scale).replace(/0+$/, "").slice(0, 6) : "";
  return fraction ? `${whole}.${fraction}` : whole;
}

async function fetchPortfolio(address, { network, fetcher }) {
  if (!address) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const [accountRes, tokensRes] = await Promise.all([
      fetcher(`${network.apiUrl}/accounts/${address}`, { signal: controller.signal }),
      fetcher(`${network.apiUrl}/accounts/${address}/tokens?size=100`, { signal: controller.signal }),
    ]);
    if (!accountRes.ok || !tokensRes.ok) throw new Error("portfolio provider rejected request");
    const account = await accountRes.json();
    const tokens = await tokensRes.json();
    const assets = [];
    if (/^\d+$/.test(String(account?.balance ?? "")) && BigInt(account.balance) > 0n) {
      assets.push({ identifier: "EGLD", symbol: "EGLD", name: "MultiversX", amount: formatRawAmount(account.balance, 18), kind: "native", verified: true });
    }
    for (const token of Array.isArray(tokens) ? tokens : []) {
      if (!/^\d+$/.test(String(token?.balance ?? "")) || BigInt(token.balance) <= 0n) continue;
      assets.push({
        identifier: sanitizeText(token.identifier, 100),
        symbol: sanitizeText(token.ticker || token.name || token.identifier, 20),
        name: sanitizeText(token.name || token.identifier, 80),
        amount: formatRawAmount(token.balance, token.decimals),
        kind: "ESDT",
        verified: Boolean(token.assets?.website || token.assets?.svgUrl || token.assets?.pngUrl),
      });
    }
    return assets;
  } finally {
    clearTimeout(timer);
  }
}

function issueSessionCookie(res, { user, persona }) {
  const { token, tokenHash, expiresAt } = issueSession(user.id, persona);
  return { token, tokenHash, expiresAt };
}

// Determine which OAuth providers are configured (gates on user-supplied keys).
export function oauthStatus() {
  const env = process.env;
  const facebookGraphVersion = /^v\d+\.\d+$/.test(env.FACEBOOK_GRAPH_VERSION ?? "") ? env.FACEBOOK_GRAPH_VERSION : null;
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const facebookConfigured = Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && facebookGraphVersion);
  return {
    google: false,
    facebook: false,
    googleConfigured,
    facebookConfigured,
    walletProvisionerReady: false,
    facebookGraphVersion,
    mvx: true,
    local: true,
    // Network used for NativeAuth (xPortal signs on mainnet by default).
    mvxNetwork: resolveMvxNetwork().label,
    mvxChainId: resolveMvxNetwork().chainId,
  };
}

function channelForUser(id) {
  return `user:${id}`;
}

function channelForCallPersona(id, persona) {
  return `user:${id}:persona:${normalizePersona(persona)}:calls`;
}

function publishNotificationInvalidation(repo, sse, { userId, persona = "social", type = "system", notificationId = null, action = "created" }) {
  const safePersona = normalizePersona(persona);
  const payload = {
    recipient_id: Number(userId), recipient_persona: safePersona,
    notification_id: notificationId == null ? null : Number(notificationId),
    type: NOTIFICATION_TYPES.includes(type) ? type : "system",
    action,
    change_id: randomBytes(12).toString("base64url"),
    unread: Math.min(9999, repo.unreadNotifications(userId, "all")),
    unread_non_message: Math.min(9999, repo.unreadNonMessageNotifications(userId)),
  };
  sse.publish(channelForUser(userId), "notification-changed", payload);
  return payload;
}

function notifyWithInvalidation(repo, sse, userId, type, body, options = {}) {
  const result = repo.notify(userId, type, body, options);
  if (result.delivered) publishNotificationInvalidation(repo, sse, {
    userId, persona: options.persona || "social", type,
    notificationId: result.id, action: result.grouped ? "grouped" : "created",
  });
  return result;
}

const SOCIAL_LENSES = new Set(["near", "for-you", "global", "breaking"]);
const SOCIAL_FORMATS = new Set(["all", "clips", "posts", "tweets", "following"]);
const SOCIAL_FEED_CURSOR_TTL_SECONDS = 10 * 60;
const CHAT_CURSOR_TTL_SECONDS = 10 * 60;

function encodeSocialFeedCursor(payload) {
  const body = Buffer.from(JSON.stringify({ v: 1, ...payload })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(`NEXUS_SOCIAL_FEED_CURSOR_V1\0${body}`).digest("base64url");
  return `${body}.${signature}`;
}

function decodeSocialFeedCursor(token, expected, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length < 40 || token.length > 4096 || !token.includes(".")) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expectedSignature = createHmac("sha256", sessionSecret()).update(`NEXUS_SOCIAL_FEED_CURSOR_V1\0${body}`).digest("base64url");
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const seen = Array.isArray(value.seen) ? value.seen.map(Number) : [];
    if (value.v !== 1 || Number(value.viewer_id) !== Number(expected.viewer_id) || value.viewer_persona !== expected.viewer_persona
      || value.lens !== expected.lens || value.format !== expected.format || (value.region_code ?? null) !== (expected.region_code ?? null)
      || !Number.isSafeInteger(value.expires_at) || value.expires_at <= nowSeconds
      || seen.length < 1 || seen.length > 300 || new Set(seen).size !== seen.length
      || seen.some((id) => !Number.isSafeInteger(id) || id < 1)) return null;
    return { seen, expires_at: value.expires_at };
  } catch {
    return null;
  }
}

function encodeChatCursor(payload) {
  const body = Buffer.from(JSON.stringify({ v: 1, ...payload })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(`NEXUS_CHAT_CURSOR_V1\0${body}`).digest("base64url");
  return `${body}.${signature}`;
}

function decodeChatCursor(token, expected, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length < 40 || token.length > 2048 || !token.includes(".")) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const calculated = createHmac("sha256", sessionSecret()).update(`NEXUS_CHAT_CURSOR_V1\0${body}`).digest("base64url");
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(calculated);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (value.v !== 1 || value.kind !== expected.kind || Number(value.viewer_id) !== Number(expected.viewer_id)
      || value.persona !== expected.persona || (value.box ?? null) !== (expected.box ?? null)
      || (value.query_hash ?? null) !== (expected.query_hash ?? null)
      || !Number.isSafeInteger(value.last_id) || value.last_id < 1
      || (expected.kind === "inbox" && (!Number.isSafeInteger(value.last_updated_at) || value.last_updated_at < 1))
      || !Number.isSafeInteger(value.expires_at) || value.expires_at <= nowSeconds) return null;
    return value;
  } catch { return null; }
}
const POST_VISIBILITY = new Set(["public", "followers", "friends", "private"]);
// What the profile hero shows above the identity: the cover photo, or the shelf of saved stories.
const PROFILE_COVER_MODES = new Set(["cover", "stories"]);

// One reply view for both the drawer and the post page. A reply is a comment on the
// server, but it is read like a tweet, so it carries the same reading: its own counters,
// its own saved state, its own community-note requests and its own internal shares. The parent
// author travels with it, because "Replying to @x" must be true even when the parent is not on
// the page that was opened.
function commentThreadView(repo, auth, comment, canPin, bulk = null) {
  const stats = repo.commentViewStatsBulk([comment.id]).get(Number(comment.id)) ?? { viewers: 0, impressions: 0 };
  const shares = bulk?.shares?.get(Number(comment.id)) ?? repo.commentShareSummary(comment.id, auth.user.id, auth.persona);
  const parentAuthor = Number(comment.parent_id || 0) ? (bulk?.parents?.get(Number(comment.id)) ?? null) : null;
  return {
    ...comment,
    can_pin: Boolean(canPin) && comment.status === "active",
    pinned_by_owner: Boolean(comment.pinned_at),
    saved_by_me: repo.hasSavedComment(auth.user.id, auth.persona, comment.id),
    views: Number(stats.viewers || 0),
    view_impressions: Number(stats.impressions || 0),
    reactions: repo.commentReactionSummary(comment.id, auth.user.id, auth.persona),
    note_requests: repo.communityNoteRequestState("comment", comment.id, auth.user.id, auth.persona),
    reply_shares: Number(shares.shares || 0),
    shared_by_me: shares.shared_by_me === true,
    parent_author: parentAuthor ? {
      id: Number(parentAuthor.id), handle: parentAuthor.handle,
      display_name: parentAuthor.display_name, withdrawn: parentAuthor.status === "withdrawn",
    } : null,
    internal_share: true,
  };
}

// The demo-receipt route maps posts for display. It used to call an undefined `publicPost`
// and could only ever answer 500, so the mapper is now the same one the timeline uses:
// every surface shows the same, real counters.
function publicPost(repo, post, auth) {
  return socialPostView(repo, auth, post);
}

// A clip can carry a real caption track (a WebVTT sidecar next to the media). The reader is told
// whether one exists; nothing is generated, so "no track" is a fact about the author's upload.
function mediaWithCaptions(media) {
  if (!media || media.kind !== "video" || !media.hash) return media ?? null;
  return { ...media, captions: captionTrackAvailability(media.hash) };
}

function socialPostView(repo, auth, post) {
  let trust = repo.getContentAssessment("post", post.id, post.content_commitment);
  if (!trust) {
    const assessment = assessSocialContent({ text: post.caption, provenance: post.provenance, mediaKind: post.kind });
    trust = repo.saveContentAssessment("post", post.id, post.content_commitment, assessment);
    repo.appendModerationEvent({
      subjectType: "post", subjectId: post.id, actorKind: "AUTOMATION",
      action: "CONTENT_ASSESSED", reasonCode: assessment.decision,
      metadata: { assessmentHash: trust.assessmentHash, enforcementChanged: false },
    });
  }
  return {
    ...post,
    media: mediaWithCaptions(post.media),
    trust: {
      decision: trust.decision,
      riskLevel: trust.riskLevel,
      labels: trust.labels.map((label) => label.code),
      factualStatus: trust.factualStatus,
      provenance: trust.provenance.status,
      visualSafety: trust.visualSafety,
      authorDisputed: trust.authorDisputed,
    },
    reactions: repo.postReactionSummary(post.id, auth.user.id, auth.persona),
    comment_count: repo.listComments(post.id, { viewerId: auth.user.id, viewerPersona: auth.persona, limit: 1000 }).length,
    saved_by_me: repo.hasSavedPost(auth.user.id, auth.persona, post.id),
    // One real reading for every surface: `viewers` counts distinct human readers, while
    // `impressions` (repeat openings) stays available without being advertised.
    view_stats: repo.postViewStats(post.id),
    // The carousel reads the ordered list; a post written before the list existed still answers
    // with its single cover, so nothing ever renders empty.
    media_list: (() => {
      const list = repo.listPostMedia(post.id);
      if (list.length || !post.media) return list.map((item) => mediaWithCaptions(item));
      return [mediaWithCaptions({ ...post.media, position: 0 })];
    })(),
    tags: repo.postTags(post.id),
    // Notes travel with the post: the reader sees the context that was rated helpful, and the
    // author of a pending note sees their own. Nothing here changes the post's visibility.
    community_notes: repo.listCommunityNotes("post", post.id, auth.user.id, auth.persona),
    // The ••• menu has to state what is already true for this viewer, otherwise a reader
    // cannot tell a mute from a follow.
    muted_by_me: repo.isMuted(auth.user.id, auth.persona, post.user_id),
    blocked_by_me: repo.isAccountBlockedBetween(auth.user.id, post.user_id),
    follow_request_pending: Number(post.user_id) !== Number(auth.user.id)
      && Boolean(repo.pendingFollowRequest(auth.user.id, post.user_id, post.persona)),
    ...repo.postRepostSummary(post.id, auth.user.id, auth.persona),
  };
}

function storyApiView(story) {
  return {
    id: story.id,
    user_id: story.user_id,
    persona: story.persona,
    caption: story.caption,
    visibility: story.visibility,
    status: story.status,
    expires_at: story.expires_at,
    content_commitment: story.content_commitment,
    created_at: story.created_at,
    viewed_by_me: Boolean(story.viewed_by_me),
    view_progress: Number(story.view_progress || 0),
    author: story.author,
    media: story.media ? {
      hash: story.media.hash,
      ext: story.media.ext,
      mime: story.media.mime,
      kind: story.media.kind,
      size: story.media.size,
    } : null,
    lifecycle: story.expires_at ? "expires" : "persistent_until_archived",
  };
}

const MEDIA_RANGE_MAX_BYTES = 4 * 1024 * 1024;
function boundedMediaRange(value, size) {
  if (value == null || value === "") return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value));
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size < 1) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return false;
    const length = Math.min(size, suffix, MEDIA_RANGE_MAX_BYTES);
    start = size - length;
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : Math.min(size - 1, start + MEDIA_RANGE_MAX_BYTES - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return false;
    end = Math.min(size - 1, end, start + MEDIA_RANGE_MAX_BYTES - 1);
  }
  return { start, end, length: end - start + 1 };
}

export async function handleRequest(req, res, ctx) {
  const { repo, sse, db } = ctx;
  const fetcher = ctx.fetcher ?? globalThis.fetch;
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  if (process.env.NODE_ENV === "production" && !requestIsSecure(req) && path !== "/health" && (path.startsWith("/auth/") || path.startsWith("/api/") || path.startsWith("/wallets/"))) {
    return json(res, 400, { ok: false, error: "HTTPS este obligatoriu pentru autentificare și date de cont" });
  }
  if (new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method)) {
    const presentedOrigin = String(req.headers.origin ?? "").trim();
    if (presentedOrigin) {
      let expectedOrigin;
      try { expectedOrigin = externalOrigin(req); } catch { return json(res, 403, { ok: false, error: "origin invalid" }); }
      if (presentedOrigin !== expectedOrigin) return json(res, 403, { ok: false, error: "cererea cross-site a fost refuzată" });
    } else if (process.env.NODE_ENV === "production" && req.headers.cookie) {
      return json(res, 403, { ok: false, error: "origin obligatoriu pentru mutații autentificate" });
    }
  }
  const nativeAuthValidationPaths = new Set([
    "/auth/mvx/native",
    "/auth/mvx/herotag-login",
    "/auth/mvx/alias-login",
    "/auth/mvx/recover",
    "/auth/mvx/link",
  ]);
  const emailAuthIdempotencyPaths = new Set([
    "/auth/email/signup-init",
    "/auth/email/signup",
    "/auth/email/verify",
    "/auth/email/login",
  ]);
  if (method === "POST" && emailAuthIdempotencyPaths.has(path)) {
    try { assertEmailAuthIdempotencyKey(req.headers["idempotency-key"]); }
    catch (error) { return json(res, error.status ?? 400, { ok: false, code: error.code, error: error.message }); }
  }
  if (method === "POST" && nativeAuthValidationPaths.has(path)) {
    const rate = enforceAuthRate(req, res, "mvx-token-validation", "", { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    try { assertNativeAuthIdempotencyKey(req.headers["idempotency-key"]); }
    catch (error) { return json(res, error.status ?? 400, { ok: false, code: error.code, error: error.message }); }
  }

  // ---- static/auth-free routes ----
  if (method === "GET" && path === "/health") {
    const degraded = operationalStatus(db).degraded;
    const publicHealth = { ok: true, service: "nexus-web", status: degraded ? "degraded" : "ready", time: new Date().toISOString() };
    if (process.env.NODE_ENV === "production") return json(res, 200, publicHealth);
    return json(res, 200, { ...publicHealth, ...repo.stats(), oauth: oauthStatus(), environment: "local_development" });
  }
  if (method === "GET" && path === "/api/providers") {
    return json(res, 200, { ok: true, providers: oauthStatus() });
  }

  // ---- auth ----
  if (method === "POST" && new Set(["/auth/signup", "/auth/login"]).has(path)) {
    return json(res, 410, { ok: false, error: "flux retras; folosește autentificarea securizată cu email sau xPortal" });
  }

  if (method === "POST" && path === "/auth/logout") {
    const cookies = parseCookies(req);
    const cookieToken = cookies.nexus_session;
    const bearerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    let command;
    try {
      command = consumeAuthLogout({
        db, repo, idempotencyKey: req.headers["idempotency-key"],
        tokens: [cookieToken, bearerToken],
      });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    clearCookie(res, "nexus_session", { secure: requestIsSecure(req) });
    return json(res, 200, { ok: true, replay: command.replay });
  }

  if (method === "POST" && path === "/auth/logout-all") {
    const cookies = parseCookies(req);
    const rawToken = cookies.nexus_session ?? req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const payload = rawToken ? verifyToken(rawToken) : null;
    const user = payload && typeof payload.sub === "number" ? repo.getUserById(payload.sub) : null;
    if (!rawToken || !user) return json(res, 401, { ok: false, error: "not signed in" });
    let key;
    try { key = assertEmailAuthIdempotencyKey(req.headers["idempotency-key"]); }
    catch (error) { return json(res, error.status ?? 400, { ok: false, code: error.code, error: error.message }); }
    const existing = db.prepare(`SELECT 1 FROM auth_logout_commands WHERE idempotency_key = ?`).get(key);
    if (!existing) {
      const active = repo.getSession(hashToken(rawToken));
      if (!active || Number(active.user_id) !== Number(user.id) || Number(active.expires_at) <= now()) {
        return json(res, 401, { ok: false, error: "active session required" });
      }
      const body = await readAuthJson(req);
      const stepUp = await accountStepUp(user, body);
      if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    }
    let command;
    try {
      command = consumeAuthLogoutAll({ db, repo, idempotencyKey: key, token: rawToken, userId: user.id });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    if (!command.replay) notifyWithInvalidation(repo, sse, user.id, "security", "Toate sesiunile Nexus au fost revocate", { persona: "social", sensitive: true });
    clearCookie(res, "nexus_session", { secure: requestIsSecure(req) });
    return json(res, 200, { ok: true, replay: command.replay, revoked_all: true });
  }

  // ---- email + password account (wallet generated and retained by the browser) ----
  if (method === "POST" && path === "/auth/email/signup-init") {
    const body = await readAuthJson(req);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const rate = enforceAuthRate(req, res, "email-signup-init", email, { limit: 8, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { ok: false, error: "invalid email" });
    let challenge;
    try {
      challenge = issueEmailSignupChallenge({ db, idempotencyKey: req.headers["idempotency-key"], email });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    return json(res, 200, {
      ok: true,
      nonce: challenge.nonce,
      message: walletSignupMessage(email, challenge.nonce),
      expires_at: challenge.expiresAt,
      replay: challenge.replay,
      storage_policy: "private key remains encrypted on this device; Nexus receives only address and signature",
    });
  }

  if (method === "POST" && path === "/auth/email/signup") {
    const body = await readAuthJson(req);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const password = String(body.password ?? "");
    const handle = sanitizeText(body.handle, 30).replace(/^@/, "").toLowerCase();
    const rate = enforceAuthRate(req, res, "email-signup", "", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rate.allowed) return;
    const previewEmailSignupEnabled = String(process.env.NEXUS_DEPLOYMENT_MODE ?? "")
      .trim()
      .toLowerCase() === "preview";
    if (process.env.NODE_ENV === "production" && !previewEmailSignupEnabled) {
      return json(res, 503, { ok: false, error: "înregistrarea prin email așteaptă un provider de verificare configurat" });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { ok: false, error: "invalid email" });
    if (password.length < 8 || password.length > 256) return json(res, 400, { ok: false, error: "password length must be 8-256 characters" });
    const requestData = {
      email,
      password,
      handle,
      display_name: sanitizeText(body.display_name, 50),
      wallet_proof: {
        nonce: sanitizeText(body.wallet_proof?.nonce, 128),
        address: sanitizeText(body.wallet_proof?.address, 90),
        signature: sanitizeText(body.wallet_proof?.signature, 256).toLowerCase(),
      },
    };
    let replay;
    try {
      replay = replayEmailAuthCommand({
        db, repo, purpose: "signup", idempotencyKey: req.headers["idempotency-key"],
        requestData, subject: email,
      });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    if (replay) {
      setSessionCookie(req, res, replay.token, repo);
      return json(res, 201, { ...replay.response, replay: true });
    }
    if (repo.getUserByEmail(email)) return json(res, 409, { ok: false, error: "email taken" });

    // Nexus herotag: explicit choice is validated (format + uniqueness local +
    // no clash with an existing MultiversX herotag). If omitted, we generate one.
    let finalHandle;
    if (handle) {
      if (!/^[a-z0-9_]{2,30}$/.test(handle)) return json(res, 400, { ok: false, error: "invalid herotag Nexus" });
      if (repo.getUserByHandle(handle)) return json(res, 409, { ok: false, error: "herotag Nexus deja folosit" });
      const mvxOwner = await resolveHerotag(handle);
      if (mvxOwner) return json(res, 409, { ok: false, error: "herotag există deja pe MultiversX" });
      finalHandle = handle;
    } else {
      finalHandle = `u${email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user"}${randomBytes(2).toString("hex")}`;
      while (repo.getUserByHandle(finalHandle)) finalHandle = `u${email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user"}${randomBytes(2).toString("hex")}`;
    }

    // The browser generates the signing key, keeps it encrypted locally and
    // proves possession over this one-time, email-bound challenge. Nexus never
    // receives a mnemonic, private key or encrypted complete key.
    const walletProof = await verifyWalletSignupProof(email, body.wallet_proof);
    if (!walletProof) return json(res, 400, { ok: false, error: "dovada walletului local este invalidă sau a expirat" });
    if (!getEmailSignupChallenge(db, { nonce: body.wallet_proof?.nonce, email })) {
      return json(res, 400, { ok: false, error: "dovada walletului local este invalidă, consumată sau expirată" });
    }
    const walletResolution = repo.resolveUserByWalletAddress(walletProof.address);
    if (walletResolution.conflict || walletResolution.user) {
      return json(res, 409, { ok: false, error: "walletul aparține deja unui cont Nexus" });
    }
    const displayName = sanitizeText(body.display_name ?? finalHandle, 50) || finalHandle;

    const passwordHash = hashPassword(password);
    const verificationToken = randomBytes(18).toString("base64url");
    let command;
    try {
      command = consumeEmailAuthCommand({
        db, repo, purpose: "signup", idempotencyKey: req.headers["idempotency-key"],
        requestData, subject: email, challengeNonce: body.wallet_proof?.nonce,
        operation: () => {
          if (repo.getUserByEmail(email)) throw new EmailAuthCommandError("EMAIL_TAKEN", 409, "email taken");
          if (repo.getUserByHandle(finalHandle)) throw new EmailAuthCommandError("HANDLE_TAKEN", 409, "herotag Nexus deja folosit");
          const resolution = repo.resolveUserByWalletAddress(walletProof.address);
          if (resolution.conflict || resolution.user) throw new EmailAuthCommandError("WALLET_TAKEN", 409, "walletul aparține deja unui cont Nexus");
          const created = repo.createUser({ handle: finalHandle, displayName, passwordHash, mvxAddress: walletProof.address });
      // A handle chosen at sign-up is an identity decision already made, so the first-run flow is not
      // shown again; an account created without one keeps the stamp empty on purpose.
      if (handle) repo.markOnboarded(created.id);
          for (const p of PERSONAS) repo.ensurePersona(created.id, p, {});
          repo.linkProvider(created.id, { email });
          repo.setUserEmailVerification(created.id, verificationToken, now() + 24 * 60 * 60 * 1000);
          const user = repo.getUserById(created.id);
          return {
            userId: user.id,
            response: {
              ok: true,
              user: publicUser(user),
              wallet: { address: walletProof.address, custody: "encrypted_on_this_device_only" },
              recovery_required: true,
              email_status: "local_demo_unverified",
              session_ready: true,
              note: "Leagă xPortal înainte de a alimenta walletul, pentru recuperare pe alt dispozitiv.",
            },
          };
        },
      });
    } catch (err) {
      if (err instanceof EmailAuthCommandError) return json(res, err.status, { ok: false, code: err.code, error: err.message });
      if (err?.code === "NEXUS_WALLET_IDENTITY_CONFLICT" || /wallet identity conflict/i.test(err?.message || "")) {
        return json(res, 409, { ok: false, error: "walletul aparține deja unui cont Nexus" });
      }
      throw err;
    }

    // There is deliberately no verification/reset token in the LAN response.
    // Until a real mail adapter is configured, local development allows an
    // explicitly-labelled unverified session; production remains fail-closed.
    setSessionCookie(req, res, command.token, repo);
    return json(res, 201, { ...command.response, replay: command.replay });
  }

  if (method === "POST" && path === "/auth/email/verify") {
    const rate = enforceAuthRate(req, res, "email-verify", "", { limit: 12, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 80);
    const requestData = { token };
    let replay;
    try {
      replay = replayEmailAuthCommand({ db, repo, purpose: "verify", idempotencyKey: req.headers["idempotency-key"], requestData, subject: token });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    if (replay) {
      setSessionCookie(req, res, replay.token, repo);
      return json(res, 200, { ...replay.response, replay: true });
    }
    const user = repo.db.prepare(`SELECT * FROM users WHERE email_verification_token = ?`).get(sha256Hex(token));
    if (!user || !user.email_verification_expires_at || user.email_verification_expires_at < now()) {
      return json(res, 400, { ok: false, error: "invalid or expired verification token" });
    }
    let command;
    try {
      command = consumeEmailAuthCommand({
        db, repo, purpose: "verify", idempotencyKey: req.headers["idempotency-key"], requestData, subject: token,
        operation: () => {
          const current = repo.db.prepare(`SELECT * FROM users WHERE email_verification_token = ?`).get(sha256Hex(token));
          if (!current || !current.email_verification_expires_at || current.email_verification_expires_at < now()) {
            throw new EmailAuthCommandError("EMAIL_VERIFY_EXPIRED", 400, "invalid or expired verification token");
          }
          const verified = repo.verifyUserEmail(current.id);
          return { userId: verified.id, response: { ok: true, user: publicUser(verified) } };
        },
      });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, command.token, repo);
    return json(res, 200, { ...command.response, replay: command.replay });
  }

  if (method === "POST" && path === "/auth/email/login") {
    const body = await readAuthJson(req);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const password = String(body.password ?? "");
    const requestData = { email, password };
    const globalRate = enforceAuthRate(req, res, "email-login-ip", "", { limit: 40, windowMs: 15 * 60 * 1000 });
    if (!globalRate.allowed) return;
    const rate = enforceAuthRate(req, res, "email-login", email, { limit: 8, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    let replay;
    try {
      replay = replayEmailAuthCommand({ db, repo, purpose: "login", idempotencyKey: req.headers["idempotency-key"], requestData, subject: email });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    if (replay) {
      setSessionCookie(req, res, replay.token, repo);
      return json(res, 200, { ...replay.response, replay: true });
    }
    const user = repo.getUserByEmail(email);
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return json(res, 401, { ok: false, error: "invalid credentials" });
    }
    if (!user.email_verified && process.env.NODE_ENV === "production") return json(res, 403, { ok: false, error: "verifică adresa de email înainte de autentificare" });
    let command;
    try {
      command = consumeEmailAuthCommand({
        db, repo, purpose: "login", idempotencyKey: req.headers["idempotency-key"], requestData, subject: email,
        operation: () => ({ userId: user.id, response: { ok: true, user: publicUser(user), email_verified: Boolean(user.email_verified) } }),
      });
    } catch (error) {
      if (error instanceof EmailAuthCommandError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, command.token, repo);
    clearAuthAttempts("email-login", rate.bucket);
    return json(res, 200, { ...command.response, replay: command.replay });
  }

  if (method === "POST" && path === "/auth/email/reset-request") {
    const rate = enforceAuthRate(req, res, "email-reset-request-ip", "", { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    return json(res, 503, {
      ok: false,
      error: "resetarea prin email nu este activă în demo; recuperează contul prin xPortal",
      recovery: "xportal",
    });
  }

  if (method === "POST" && path === "/auth/email/reset-confirm") {
    return json(res, 410, { ok: false, error: "flux retras; folosește recuperarea prin xPortal" });
  }

  // Never accept a real seed phrase through the Nexus server. Restore it in
  // xPortal, then prove wallet ownership through the origin-bound NativeAuth
  // flow. This avoids turning a login page into a secret-ingestion surface.
  if (method === "POST" && path === "/wallets/import") {
    return json(res, 410, { ok: false, error: "importul seed phrase în Nexus este dezactivat; restaurează walletul în xPortal și conectează-l prin NativeAuth" });
  }

  // MultiversX NativeAuth: the wallet (xPortal / web wallet / extension /
  // Ledger) signs a standard NativeAuth token. We validate the token
  // server-side on the configured network (mainnet for xPortal, by default)
  // and issue a Nexus session bound to the wallet address.
  if (method === "POST" && path === "/auth/mvx/native") {
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 4096);
    const alias = sanitizeText(body.alias, 40);
    const persona = normalizePersona(body.persona);

    if (!token) return json(res, 400, { ok: false, error: "missing native auth token" });

    const networkLabel = resolveMvxNetwork().label;
    let address;
    try {
      const result = await validateNativeAuthToken(token, { network: networkLabel });
      address = result.address;
    } catch (err) {
      const detail = err?.message || "";
      if (/expired/i.test(detail)) {
        return json(res, 401, { ok: false, error: "tokenul NativeAuth a expirat" });
      }
      if (/origin/i.test(detail)) {
        return json(res, 401, { ok: false, error: "originea aplicației nu este acceptată" });
      }
      if (/block|timestamp|hash/i.test(detail)) {
        return json(res, 401, { ok: false, error: `token semnat pe altă rețea (așteptat: ${networkLabel})` });
      }
      return json(res, 401, { ok: false, error: "token NativeAuth invalid sau expirat" });
    }

    const resolution = repo.resolveUserByWalletAddress(address);
    if (resolution.conflict) return json(res, 409, { ok: false, error: "walletul este legat conflictual; autentificarea a fost oprită" });
    let user = resolution.user;
    if (!user) {
      const cleanAlias = alias.replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 20);
      const handle = cleanAlias ? `x${cleanAlias}` : `wallet${address.slice(-6)}`;
      let unique = handle;
      let i = 1;
      while (repo.getUserByHandle(unique)) unique = `${handle}${i++}`;
      try {
        user = transact(db, () => {
          const created = repo.createUser({ handle: unique, displayName: alias || handle, mvxAddress: address, mvxAlias: alias || null });
          for (const p of PERSONAS) repo.ensurePersona(created.id, p, {});
          return repo.getUserById(created.id);
        });
      } catch (error) {
        const raced = repo.resolveUserByWalletAddress(address);
        if (raced.conflict || !raced.user) throw error;
        user = raced.user;
      }
    }

    let sess;
    try {
      sess = consumeNativeAuthSession({
        db, repo, token, purpose: "native", idempotencyKey: req.headers["idempotency-key"], requestBody: req.nexusCachedBody,
        address, userId: user.id, persona,
      });
    } catch (error) {
      if (error instanceof NativeAuthSessionError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, sess.token, repo);
    return json(res, 200, { ok: true, user: publicUser(user), address, replay: sess.replay });
  }

  // Resolve a Nexus username (`@name`) to the wallet address bound to it so the
  // client can offer passwordless xPortal login. The old nexus-herotag route is
  // retained only as a compatibility alias; a Nexus username is not an xAlias.
  if (method === "GET" && (path === "/auth/mvx/nexus-username" || path === "/auth/mvx/nexus-herotag")) {
    const handle = sanitizeText(url.searchParams.get("handle") ?? url.searchParams.get("name") ?? "", 64).replace(/^@/, "").toLowerCase();
    if (!handle) return json(res, 400, { ok: false, error: "scrie username-ul Nexus" });
    const user = repo.getUserByHandle(handle);
    if (!user) return json(res, 404, { ok: false, error: "username Nexus negăsit" });
    const loginAddress = repo.getXPortalLoginAddress(user);
    if (!loginAddress) return json(res, 409, { ok: false, error: "contul nu are un portofel xPortal legat" });
    return json(res, 200, { ok: true, username: user.handle, handle: user.handle, address: loginAddress, namespace: "nexus" });
  }

  // Log in with a Nexus username: no password. The wallet that signs must match
  // the xPortal wallet linked to that account, proving ownership.
  if (method === "POST" && path === "/auth/mvx/herotag-login") {
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 4096);
    const handle = sanitizeText(body.handle, 64).replace(/^@/, "").toLowerCase();
    if (!token) return json(res, 400, { ok: false, error: "missing native auth token" });
    if (!handle) return json(res, 400, { ok: false, error: "scrie username-ul Nexus" });

    const user = repo.getUserByHandle(handle);
    if (!user) return json(res, 404, { ok: false, error: "username Nexus negăsit" });
    const loginAddress = repo.getXPortalLoginAddress(user);
    if (!loginAddress) return json(res, 409, { ok: false, error: "contul nu are un portofel xPortal legat" });

    const networkLabel = resolveMvxNetwork().label;
    let address;
    try {
      const result = await validateNativeAuthToken(token, { network: networkLabel });
      address = result.address;
    } catch (err) {
      const detail = err?.message || "";
      if (/origin/i.test(detail)) return json(res, 401, { ok: false, error: "originea aplicației nu este acceptată" });
      if (/block|timestamp|hash/i.test(detail)) return json(res, 401, { ok: false, error: `token semnat pe altă rețea (așteptat: ${networkLabel})` });
      return json(res, 401, { ok: false, error: "token NativeAuth invalid sau expirat" });
    }

    if (address !== loginAddress) {
      return json(res, 403, { ok: false, error: "portofelul semnat nu corespunde acestui cont" });
    }

    let sess;
    try {
      sess = consumeNativeAuthSession({
        db, repo, token, purpose: "nexus_username", idempotencyKey: req.headers["idempotency-key"], requestBody: req.nexusCachedBody,
        address, userId: user.id, persona: "social",
      });
    } catch (error) {
      if (error instanceof NativeAuthSessionError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, sess.token, repo);
    return json(res, 200, { ok: true, user: publicUser(user), address, replay: sess.replay });
  }

  // Log in with a MultiversX herotag (xAlias): resolve on-chain to an address,
  // then require the xPortal wallet to sign and match. No password.
  if (method === "POST" && path === "/auth/mvx/alias-login") {
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 4096);
    const alias = sanitizeText(body.alias ?? body.herotag, 64).replace(/^@/, "").toLowerCase();
    if (!token) return json(res, 400, { ok: false, error: "missing native auth token" });
    if (!alias) return json(res, 400, { ok: false, error: "scrie herotag-ul MultiversX" });

    const resolvedAddress = await resolveHerotag(alias);
    if (!resolvedAddress) return json(res, 404, { ok: false, error: "herotag MultiversX negăsit" });

    const networkLabel = resolveMvxNetwork().label;
    let signedAddress;
    try {
      const result = await validateNativeAuthToken(token, { network: networkLabel });
      signedAddress = result.address;
    } catch (err) {
      const detail = err?.message || "";
      if (/origin/i.test(detail)) return json(res, 401, { ok: false, error: "originea aplicației nu este acceptată" });
      if (/block|timestamp|hash/i.test(detail)) return json(res, 401, { ok: false, error: `token semnat pe altă rețea (așteptat: ${networkLabel})` });
      return json(res, 401, { ok: false, error: "token NativeAuth invalid sau expirat" });
    }

    if (signedAddress !== resolvedAddress) {
      return json(res, 403, { ok: false, error: "portofelul semnat nu corespunde herotag-ului MultiversX" });
    }

    const resolution = repo.resolveUserByWalletAddress(signedAddress);
    if (resolution.conflict) return json(res, 409, { ok: false, error: "walletul este legat conflictual; autentificarea a fost oprită" });
    let user = resolution.user;
    if (!user) return json(res, 404, { ok: false, error: "nicio cont Nexus nu este legat de acest portofel" });

    let sess;
    try {
      sess = consumeNativeAuthSession({
        db, repo, token, purpose: "multiversx_alias", idempotencyKey: req.headers["idempotency-key"], requestBody: req.nexusCachedBody,
        address: signedAddress, userId: user.id, persona: "social",
      });
    } catch (error) {
      if (error instanceof NativeAuthSessionError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, sess.token, repo);
    return json(res, 200, { ok: true, user: publicUser(user), address: signedAddress, replay: sess.replay });
  }

  // Recover an account by proving ownership of its wallet via xPortal (NativeAuth).
  // Does NOT auto-create a user: the address must already belong to an account.
  if (method === "POST" && path === "/auth/mvx/recover") {
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 4096);

    if (!token) return json(res, 400, { ok: false, error: "missing native auth token" });

    const networkLabel = resolveMvxNetwork().label;
    let address;
    try {
      const result = await validateNativeAuthToken(token, { network: networkLabel });
      address = result.address;
    } catch (err) {
      const detail = err?.message || "";
      if (/origin/i.test(detail)) return json(res, 401, { ok: false, error: "originea aplicației nu este acceptată" });
      if (/block|timestamp|hash/i.test(detail)) return json(res, 401, { ok: false, error: `token semnat pe altă rețea (așteptat: ${networkLabel})` });
      return json(res, 401, { ok: false, error: "token NativeAuth invalid sau expirat" });
    }

    const resolution = repo.resolveUserByWalletAddress(address);
    if (resolution.conflict) return json(res, 409, { ok: false, error: "walletul este legat conflictual; recuperarea a fost oprită" });
    const user = resolution.user;
    if (!user) return json(res, 404, { ok: false, error: "nicio cont Nexus nu este legat de această adresă" });

    let sess;
    try {
      sess = consumeNativeAuthSession({
        db, repo, token, purpose: "recover", idempotencyKey: req.headers["idempotency-key"], requestBody: req.nexusCachedBody,
        address, userId: user.id, persona: "social",
      });
    } catch (error) {
      if (error instanceof NativeAuthSessionError) return json(res, error.status, { ok: false, code: error.code, error: error.message });
      throw error;
    }
    setSessionCookie(req, res, sess.token, repo);
    return json(res, 200, { ok: true, user: publicUser(user), address, replay: sess.replay });
  }

  // Build a NativeAuth init string for the wallet to sign. The client renders a
  // QR/deep-link to xPortal; xPortal signs `${address}${init}` and returns a
  // token that is then validated by /auth/mvx/native.
  if (method === "GET" && path === "/auth/mvx/init") {
    const rate = enforceAuthRate(req, res, "mvx-init", "", { limit: 30, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    try {
      const origin = externalOrigin(req);
      const wcAttestation = walletConnectAttestation(process.env, origin);
      if (!wcAttestation.ready) {
        return json(res, 503, {
          ok: false,
          error: `xPortal nu este încă activat pentru ${origin}. Este necesar un Project ID emis de WalletConnect Dashboard și această origine în Allowlist.`,
          code: "WALLETCONNECT_PROJECT_NOT_ATTESTED",
        });
      }
      const network = resolveMvxNetwork();
      const init = await buildNativeAuthInit({ network: network.label, origin, expirySeconds: 15 * 60, fetcher });
      return json(res, 200, {
        ok: true,
        network: network.label,
        chainId: network.chainId,
        origin,
        init,
        signable_message: "<address>" + init,
        wcProjectId: process.env.NEXUS_WC_PROJECT_ID || null,
      });
    } catch (err) {
      return json(res, 502, { ok: false, error: err?.message || "nu s-a putut obține block hash" });
    }
  }

  // Resolve a herotag/xAlias (@name) to an erd1... address (real MultiversX API).
  if (method === "GET" && path === "/auth/mvx/herotag") {
    const name = sanitizeText(url.searchParams.get("name") ?? url.searchParams.get("herotag") ?? "", 64);
    if (!name) return json(res, 400, { ok: false, error: "missing herotag" });
    const address = await resolveHerotag(name);
    if (!address) return json(res, 404, { ok: false, error: "herotag not found" });
    return json(res, 200, { ok: true, herotag: name.replace(/^@/, "").toLowerCase(), address });
  }

  // Retire the origin-unbound legacy signature endpoints. NativeAuth is the
  // only supported xPortal login protocol because it binds chain + origin +
  // expiry and is validated by the official MultiversX server SDK.
  if (method === "POST" && new Set(["/auth/mvx/challenge", "/auth/mvx/verify"]).has(path)) {
    return json(res, 410, { ok: false, error: "flux retras; folosește NativeAuth prin xPortal" });
  }

  // ---- Google OAuth 2.0 (Authorization Code + provider-bound state + PKCE) ----
  if (method === "GET" && path === "/auth/google/start") {
    if (!oauthStatus().google) {
      return json(res, 501, { ok: false, error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID/SECRET." });
    }
    const rate = enforceAuthRate(req, res, "oauth-google-start", "", { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    const oauthFlow = randomBytes(24).toString("base64url");
    const { state, codeChallenge } = issueOAuthState("google", now(), oauthFlow);
    setCookie(res, "nexus_oauth_flow", oauthFlow, { maxAge: OAUTH_STATE_TTL_MS / 1000, secure: requestIsSecure(req) });
    let origin;
    try { origin = externalOrigin(req); } catch { return json(res, 400, { ok: false, error: "invalid OAuth origin" }); }
    const redirectUri = `${origin}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  if (method === "GET" && path === "/auth/google/callback") {
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const error = url.searchParams.get("error");
    const oauthFlow = parseCookies(req).nexus_oauth_flow ?? "";
    const stateRecord = consumeOAuthState("google", state, now(), oauthFlow);
    clearCookie(res, "nexus_oauth_flow", { secure: requestIsSecure(req) });
    if (error || !stateRecord) {
      return redirect(res, `/?auth=google&status=denied&reason=${encodeURIComponent(error || "state")}`);
    }
    if (!code) return redirect(res, "/?auth=google&status=denied&reason=no_code");

    let origin;
    try { origin = externalOrigin(req); } catch { return redirect(res, "/?auth=google&status=denied&reason=origin"); }
    const redirectUri = `${origin}/auth/google/callback`;
    const tokenBody = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: stateRecord.codeVerifier,
    });
    let tokenRes;
    let tokenData;
    try {
      tokenRes = await fetcher("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      });
      tokenData = await tokenRes.json();
    } catch {
      return redirect(res, "/?auth=google&status=denied&reason=network");
    }
    const accessToken = tokenData?.access_token;
    if (!accessToken) return redirect(res, "/?auth=google&status=denied&reason=token");

    let profile;
    try {
      const userRes = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      profile = await userRes.json();
    } catch {
      return redirect(res, "/?auth=google&status=denied&reason=userinfo");
    }
    const sub = profile?.sub;
    if (!sub) return redirect(res, "/?auth=google&status=denied&reason=no_sub");

    const user = provisionOAuthIdentity({
      repo,
      db,
      provider: "google",
      subject: String(sub),
      email: profile.email_verified === true ? profile.email : undefined,
      displayName: profile.name ?? "Google user",
    });
    const sess = issueSession(user.id, "social");
    repo.insertSession({ tokenHash: sess.tokenHash, userId: user.id, persona: "social", expiresAt: sess.expiresAt });
    setSessionCookie(req, res, sess.token, repo);
    return redirect(res, "/?auth=google&status=ok");
  }

  // ---- Facebook Login / Graph API (provider-bound state; no token storage) ----
  if (method === "GET" && path === "/auth/facebook/start") {
    if (!oauthStatus().facebook) {
      return json(res, 501, { ok: false, error: "Facebook Login is not configured." });
    }
    const rate = enforceAuthRate(req, res, "oauth-facebook-start", "", { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    const oauthFlow = randomBytes(24).toString("base64url");
    const { state } = issueOAuthState("facebook", now(), oauthFlow);
    setCookie(res, "nexus_oauth_flow", oauthFlow, { maxAge: OAUTH_STATE_TTL_MS / 1000, secure: requestIsSecure(req) });
    let origin;
    try { origin = externalOrigin(req); } catch { return json(res, 400, { ok: false, error: "invalid OAuth origin" }); }
    const redirectUri = `${origin}/auth/facebook/callback`;
    const version = oauthStatus().facebookGraphVersion;
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state,
    });
    return redirect(res, `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`);
  }

  if (method === "GET" && path === "/auth/facebook/callback") {
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const error = url.searchParams.get("error");
    const oauthFlow = parseCookies(req).nexus_oauth_flow ?? "";
    const stateRecord = consumeOAuthState("facebook", state, now(), oauthFlow);
    clearCookie(res, "nexus_oauth_flow", { secure: requestIsSecure(req) });
    if (error || !stateRecord) return redirect(res, `/?auth=facebook&status=denied&reason=${encodeURIComponent(error || "state")}`);
    if (!code) return redirect(res, "/?auth=facebook&status=denied&reason=no_code");

    let origin;
    try { origin = externalOrigin(req); } catch { return redirect(res, "/?auth=facebook&status=denied&reason=origin"); }
    const redirectUri = `${origin}/auth/facebook/callback`;
    const version = oauthStatus().facebookGraphVersion;
    let tokenData;
    let profile;
    try {
      const tokenParams = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      });
      const tokenResponse = await fetcher(`https://graph.facebook.com/${version}/oauth/access_token?${tokenParams.toString()}`);
      tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData?.access_token) throw new Error("facebook token rejected");
      const profileResponse = await fetcher(`https://graph.facebook.com/${version}/me?fields=id,name,email`, {
        headers: { authorization: `Bearer ${tokenData.access_token}` },
      });
      profile = await profileResponse.json();
      if (!profileResponse.ok || !profile?.id) throw new Error("facebook profile rejected");
    } catch {
      return redirect(res, "/?auth=facebook&status=denied&reason=provider");
    }

    const user = provisionOAuthIdentity({
      repo,
      db,
      provider: "facebook",
      subject: String(profile.id),
      email: profile.email,
      displayName: profile.name ?? "Facebook user",
    });
    const sess = issueSession(user.id, "social");
    repo.insertSession({ tokenHash: sess.tokenHash, userId: user.id, persona: "social", expiresAt: sess.expiresAt });
    setSessionCookie(req, res, sess.token, repo);
    return redirect(res, "/?auth=facebook&status=ok&wallet=setup");
  }

  // ---- Nexus Kids local tenant boundary ----
  // A child capability is accepted only by /api/kids/* and is never treated as
  // an adult Nexus session. Kids mutations are short-retention, off-chain and
  // use their own idempotency registry without Action Ledger/outbox emission.
  if (path.startsWith("/api/kids/")) {
    const bearer = String(req.headers.authorization || "").match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1] || "";
    const child = bearer ? repo.getKidsSession(hashToken(bearer)) : null;
    if (!child) return json(res, 401, { ok: false, code: "KIDS_SESSION_REQUIRED", error: "a valid child session is required" });
    const publicChild = { id: child.child_id, alias: child.alias, age_band: child.age_band, locale: child.locale, avatar_code: child.avatar_code };
    const controls = { daily_minutes: child.daily_minutes, autoplay: false, search_enabled: Boolean(child.search_enabled), live_enabled: Boolean(child.live_enabled) };
    const timeRemainingSeconds = Math.max(0, Number(child.daily_minutes) * 60 - (Math.floor(Date.now() / 1000) - Number(child.created_at)));
    if (method === "GET" && path === "/api/kids/me") return json(res, 200, { ok: true, child: publicChild, controls, time_remaining_seconds: timeRemainingSeconds, isolation: "KIDS_TOKEN_ONLY_NO_ADULT_ROUTES" });
    if (timeRemainingSeconds === 0) return json(res, 423, { ok: false, code: "KIDS_TIME_LIMIT_REACHED", error: "the parent-defined session limit has been reached" });
    if (method === "GET" && path === "/api/kids/home") {
      return json(res, 200, { ok: true, child: publicChild, controls, videos: repo.listKidsHome(child, { limit: Number(url.searchParams.get("limit") || 30) }),
        recommender: "PARENT_CURATED_EDITORIAL_NO_BEHAVIORAL_MODEL", ads: false, wallet: false, messages: false, public_upload: false, autoplay: false });
    }
    const kidsMedia = path.match(/^\/api\/kids\/videos\/(\d+)\/media$/);
    if (method === "GET" && kidsMedia) {
      const entry = repo.listKidsHome(child, { limit: 50 }).find((item) => item.video_id === Number(kidsMedia[1]));
      if (!entry) return send(res, 404, "not found");
      const media = repo.getMediaById(entry.media_id);
      const delivery = mediaDeliveryPolicy(media);
      const buf = media ? readMedia(media.hash, media.ext) : null;
      if (!delivery || !buf) return send(res, 410, "media unavailable");
      return send(res, 200, buf, { "content-type": delivery.contentType, "content-disposition": "inline", "content-length": buf.length,
        "cache-control": "private, no-store, max-age=0", pragma: "no-cache", vary: "Authorization", "x-content-type-options": "nosniff" });
    }
    if (method === "POST" && new Set(["/api/kids/progress", "/api/kids/feedback"]).has(path)) {
      const key = String(req.headers["idempotency-key"] || "").trim();
      if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) return json(res, 400, { ok: false, code: "IDEMPOTENCY_KEY_REQUIRED", error: "Idempotency-Key must contain 16-128 safe characters" });
      const body = await readJson(req, 16 * 1024);
      const allowed = path.endsWith("/progress") ? new Set(["video_id", "position_seconds"]) : new Set(["video_id", "kind"]);
      if (!exactObject(body, allowed) || !Number.isSafeInteger(Number(body.video_id)) || Number(body.video_id) < 1) return json(res, 400, { ok: false, error: "kids mutation invalid" });
      if (path.endsWith("/progress") && (!Number.isSafeInteger(Number(body.position_seconds)) || Number(body.position_seconds) < 0)) return json(res, 400, { ok: false, error: "kids progress invalid" });
      if (path.endsWith("/feedback") && !KIDS_FEEDBACK.has(body.kind)) return json(res, 400, { ok: false, error: "kids feedback invalid" });
      const requestHash = sha256Hex(`${method}\n${path}\n${JSON.stringify(body)}`);
      try {
        const result = repo.applyKidsMutation({ childSession: child, idempotencyKey: key, requestHash, execute: () => path.endsWith("/progress")
          ? repo.updateKidsProgress({ childSession: child, videoId: Number(body.video_id), positionSeconds: Number(body.position_seconds) })
          : repo.setKidsFeedback({ childSession: child, videoId: Number(body.video_id), kind: body.kind }) });
        return json(res, result.statusCode, { ok: true, replayed: result.replayed, ...result.body, privacy: "CHILD_TENANT_SHORT_RETENTION", action_ledger: false });
      } catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
    }
    return json(res, 404, { ok: false, code: "KIDS_ROUTE_NOT_AVAILABLE", error: "resource not found" });
  }

  // ---- session / me ----
  const auth = requireAuth(req, res, repo);

  if (method === "GET" && path === "/api/me") {
    if (!auth) return json(res, 401, { ok: false, error: "not signed in" });
    const profiles = PERSONAS.map((p) => repo.getPersona(auth.user.id, p));
    const sigils = Object.fromEntries(PERSONAS.map((persona) => [persona, repo.sigilProgress(auth.user.id, persona)]));
    return json(res, 200, { ok: true, user: publicUser(auth.user), persona: auth.persona, profiles, sigils, devnet: DEVNET_EXPLORER, onboarding: repo.onboardingState(auth.user) });
  }

  if (!auth) {
    // Everything below requires auth.
    return json(res, 401, { ok: false, error: "not signed in" });
  }

  // Every authenticated mutation has one replay boundary. Chunked upload routes
  // keep their stricter session/part-specific idempotency contract instead.
  if (method === "POST" && path === "/api/media") {
    return json(res, 410, { ok: false, code: "MEDIA_UPLOAD_LEGACY_RETIRED", error: "use resumable /api/uploads" });
  }
  if (MUTATION_METHODS.has(method) && !path.startsWith("/api/uploads")) {
    try {
      const rawBody = await readBody(req, MUTATION_BODY_LIMIT);
      const prepared = prepareMutation({
        db,
        userId: auth.user.id,
        actorPersona: auth.persona,
        key: req.headers["idempotency-key"],
        method,
        requestTarget: `${path}${url.search}`,
        body: rawBody,
      });
      if (prepared.action === "replay") return send(res, prepared.status, prepared.body, prepared.headers);
      req.nexusMutationId = prepared.id;
      attachMutationRecorder({ db, res, mutationId: prepared.id });
    } catch (error) {
      if (error?.message === "body too large") return json(res, 413, { ok: false, code: "MUTATION_BODY_TOO_LARGE", error: "mutation body too large" });
      if (error instanceof MutationError) {
        const mapped = mutationErrorPayload(error);
        if (error.retryable) res.setHeader("Retry-After", "1");
        return json(res, mapped.status, mapped.body);
      }
      throw error;
    }
  }

  const operational = evaluateOperationalControl(db, method, path);
  if (!operational.allowed) {
    res.setHeader("Retry-After", "60");
    return json(res, 503, {
      ok: false,
      code: "OPERATIONAL_CONTROL_ACTIVE",
      error: "acțiunea este temporar oprită pentru protecția comunității; citirea și raportarea rămân disponibile",
      controls: operational.controls,
      retryable: true,
    });
  }

  if (method === "POST" && path === "/api/presence") {
    const touchedAt = repo.touchPresence(auth.user.id, auth.persona);
    return json(res, 200, { ok: true, owner_id: auth.user.id, owner_persona: auth.persona, online: true, touched_at: touchedAt });
  }

  // During the 30-day deletion grace period the current session remains usable
  // only for review, export, cancellation and safe logout/session controls.
  // Everything else fails closed so no new social or economic state is created.
  if (auth.user.account_state === "deletion_pending") {
    const lifecycleRead = method === "GET" && (
      path === "/api/account" || path === "/api/account/sessions" ||
      path === "/api/account/deletion" || path === "/api/account/exports" ||
      /^\/api\/account\/exports\/[0-9a-f-]{36}$/.test(path)
    );
    const lifecycleMutation = method === "POST" && (
      path === "/api/account/export" || path === "/api/account/deletion-cancel" ||
      /^\/api\/account\/sessions\/[a-f0-9]{24}\/revoke$/.test(path)
    );
    if (!lifecycleRead && !lifecycleMutation) {
      return json(res, 423, {
        ok: false,
        code: "ACCOUNT_DELETION_PENDING",
        error: "contul este în perioada de grație; poți exporta datele, anula ștergerea sau te poți deconecta",
      });
    }
  }

  // ---- M5: Work, jobs, business pages and Beauty appointments ----
  // Every route is bound to the active Work persona. Business pages are an
  // explicitly public professional surface; personal profile privacy remains
  // isolated in the persona/privacy matrix.
  const isM5Path = path === "/api/work/profile" || path.startsWith("/api/work/jobs") || path.startsWith("/api/work/applications") || path.startsWith("/api/business/");
  if (isM5Path && auth.persona !== "work") {
    return json(res, 404, { ok: false, code: "WORK_PERSONA_REQUIRED", error: "resource not found for active profile" });
  }

  if (method === "GET" && path === "/api/work/profile") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, profile: repo.getWorkProfile(auth.user.id) });
  }
  if (method === "PATCH" && path === "/api/work/profile") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["headline", "location", "availability", "skills", "experience"]))) return json(res, 400, { ok: false, error: "work profile fields invalid" });
    const headline = sanitizeText(body.headline, 100);
    const location = sanitizeText(body.location, 100);
    const availability = String(body.availability || "open");
    if (!WORK_AVAILABILITY.has(availability)) return json(res, 400, { ok: false, error: "availability invalid" });
    if (!Array.isArray(body.skills) || body.skills.length > 20) return json(res, 400, { ok: false, error: "skills invalid" });
    const skills = [...new Set(body.skills.map((value) => sanitizeText(value, 40)).filter(Boolean))];
    if (skills.length !== body.skills.length) return json(res, 400, { ok: false, error: "skills must be unique non-empty text" });
    if (!Array.isArray(body.experience) || body.experience.length > 10) return json(res, 400, { ok: false, error: "experience invalid" });
    const experience = body.experience.map((entry) => ({
      title: sanitizeText(entry?.title, 80), company: sanitizeText(entry?.company, 80), period: sanitizeText(entry?.period, 40),
    }));
    if (experience.some((entry) => !entry.title || !entry.company)) return json(res, 400, { ok: false, error: "experience title and company required" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, profile: repo.updateWorkProfile(auth.user.id, { headline, location, availability, skills, experience }) });
  }

  if (method === "GET" && path === "/api/work/jobs") {
    const query = sanitizeText(url.searchParams.get("q") || "", 80);
    const jobs = repo.listJobs({ viewerId: auth.user.id, query, limit: Number(url.searchParams.get("limit") || 50) });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, jobs });
  }
  if (method === "POST" && path === "/api/work/jobs") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["business_page_id", "title", "company", "location", "workplace_type", "employment_type", "description"]))) return json(res, 400, { ok: false, error: "job fields invalid" });
    const input = {
      ownerId: auth.user.id,
      businessPageId: body.business_page_id == null ? null : Number(body.business_page_id),
      title: sanitizeText(body.title, 100), company: sanitizeText(body.company, 100), location: sanitizeText(body.location, 100),
      workplaceType: String(body.workplace_type || "onsite"), employmentType: String(body.employment_type || "full_time"),
      description: sanitizeText(body.description, 2000),
    };
    if (!input.title || !input.company || !input.description || (input.businessPageId != null && !Number.isSafeInteger(input.businessPageId))) return json(res, 400, { ok: false, error: "job title, company and description required" });
    if (!WORKPLACE_TYPES.has(input.workplaceType) || !EMPLOYMENT_TYPES.has(input.employmentType)) return json(res, 400, { ok: false, error: "job type invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, owner_persona: auth.persona, job: repo.createJob(input) }); }
    catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const jobAction = path.match(/^\/api\/work\/jobs\/(\d+)\/(apply|close)$/);
  if (method === "POST" && jobAction) {
    const jobId = Number(jobAction[1]);
    const action = jobAction[2];
    const body = await readJson(req);
    try {
      if (action === "close") {
        if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "close body must be empty" });
        const result = repo.closeJob(auth.user.id, jobId);
        if (!result.job || (!result.changed && result.job.owner_id !== auth.user.id)) return json(res, 404, { ok: false, error: "job not found" });
        return json(res, 200, { ok: true, owner_id: auth.user.id, job: result.job, changed: result.changed });
      }
      if (!exactObject(body, new Set(["note"]))) return json(res, 400, { ok: false, error: "application fields invalid" });
      const application = repo.applyToJob({ jobId, applicantId: auth.user.id, note: sanitizeText(body.note, 1000) });
      const job = repo.getJob(jobId);
      repo.notify(job.owner_id, "system", "New Work application", { persona: "work" });
      publishNotificationInvalidation(repo, sse, { userId: job.owner_id, persona: "work", type: "system", action: "job_application" });
      return json(res, 201, { ok: true, applicant_id: auth.user.id, applicant_persona: auth.persona, application });
    } catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/work/applications") {
    const scope = url.searchParams.get("scope") === "received" ? "received" : "mine";
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, scope, applications: repo.listJobApplications(auth.user.id, scope) });
  }

  if (method === "GET" && path === "/api/business/pages") {
    const mine = url.searchParams.get("mine") === "1";
    const category = String(url.searchParams.get("category") || "");
    if (category && !BUSINESS_CATEGORIES.has(category)) return json(res, 400, { ok: false, error: "business category invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, pages: repo.listBusinessPages({ ownerId: mine ? auth.user.id : null, category }) });
  }
  if (method === "POST" && path === "/api/business/pages") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["name", "category", "location", "description"]))) return json(res, 400, { ok: false, error: "business page fields invalid" });
    const input = { ownerId: auth.user.id, name: sanitizeText(body.name, 100), category: String(body.category || "business"), location: sanitizeText(body.location, 100), description: sanitizeText(body.description, 1000) };
    if (!input.name || !input.description || !BUSINESS_CATEGORIES.has(input.category)) return json(res, 400, { ok: false, error: "business name, category and description required" });
    return json(res, 201, { ok: true, owner_id: auth.user.id, owner_persona: auth.persona, page: repo.createBusinessPage(input), verification: "UNVERIFIED_LOCAL" });
  }
  if (method === "GET" && path === "/api/business/catalog") {
    const category = String(url.searchParams.get("category") || "");
    if (category && !BUSINESS_CATEGORIES.has(category)) return json(res, 400, { ok: false, error: "business category invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, pages: repo.listBusinessCatalog({ category }), settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  const serviceCreate = path.match(/^\/api\/business\/pages\/(\d+)\/services$/);
  if (method === "POST" && serviceCreate) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["title", "category", "duration_minutes", "price_cents", "deposit_cents"]))) return json(res, 400, { ok: false, error: "service fields invalid" });
    const input = { ownerId: auth.user.id, pageId: Number(serviceCreate[1]), title: sanitizeText(body.title, 100), category: String(body.category || "consultation"), durationMinutes: Number(body.duration_minutes), priceCents: Number(body.price_cents), depositCents: Number(body.deposit_cents || 0) };
    if (!input.title || !SERVICE_CATEGORIES.has(input.category) || !Number.isSafeInteger(input.durationMinutes) || input.durationMinutes < 10 || input.durationMinutes > 480 || !Number.isSafeInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 100000000 || !Number.isSafeInteger(input.depositCents) || input.depositCents < 0 || input.depositCents > input.priceCents) return json(res, 400, { ok: false, error: "service price, deposit or duration invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, service: repo.createBusinessService(input), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const slotCreate = path.match(/^\/api\/business\/services\/(\d+)\/slots$/);
  if (method === "POST" && slotCreate) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["staff_name", "starts_at"]))) return json(res, 400, { ok: false, error: "slot fields invalid" });
    const startsAt = Number(body.starts_at);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(startsAt) || startsAt < nowSeconds + 300 || startsAt > nowSeconds + 366 * 86400) return json(res, 400, { ok: false, error: "slot start invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, slot: repo.createAppointmentSlot({ ownerId: auth.user.id, serviceId: Number(slotCreate[1]), staffName: sanitizeText(body.staff_name, 80), startsAt }) }); }
    catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const slotBook = path.match(/^\/api\/business\/slots\/(\d+)\/book$/);
  if (method === "POST" && slotBook) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "booking body must be empty" });
    try {
      const appointment = repo.bookAppointment({ customerId: auth.user.id, slotId: Number(slotBook[1]) });
      repo.notify(appointment.owner_id, "system", "New Beauty appointment", { persona: "work" });
      publishNotificationInvalidation(repo, sse, { userId: appointment.owner_id, persona: "work", type: "system", action: "appointment_booked" });
      return json(res, 201, { ok: true, customer_id: auth.user.id, customer_persona: auth.persona, appointment, settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 });
    } catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/business/appointments") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, appointments: repo.listAppointments(auth.user.id), settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  const appointmentAction = path.match(/^\/api\/business\/appointments\/(\d+)$/);
  if (method === "PATCH" && appointmentAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["cancel", "complete"]).has(body.action)) return json(res, 400, { ok: false, error: "appointment action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, appointment: repo.transitionAppointment({ userId: auth.user.id, appointmentId: Number(appointmentAction[1]), action: body.action }), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapM5Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  // ---- M6-M8: Market, Stay and Ride local vertical slices ----
  // These surfaces share the authenticated idempotency/outbox boundary above.
  // They expose immutable TEST-USDC quotes but never claim funding or settlement.
  const fairVertical = path.startsWith("/api/market/") ? "market" : path.startsWith("/api/stay/") || path.startsWith("/api/ride/") ? "travel" : null;
  if (fairVertical && auth.persona !== fairVertical) {
    return json(res, 404, { ok: false, code: "VERTICAL_PERSONA_REQUIRED", error: "resource not found for active profile" });
  }
  if (path.startsWith("/api/ride/") && process.env.NODE_ENV === "production") {
    return json(res, 503, { ok: false, code: "RIDE_PROVIDERS_NOT_CONFIGURED", error: "production ride requires approved identity, maps, routing and safety providers" });
  }

  // ---- M9: Dating remains isolated from every other persona. ----
  if (path.startsWith("/api/dating/") && auth.persona !== "dating") {
    return json(res, 404, { ok: false, code: "VERTICAL_PERSONA_REQUIRED", error: "resource not found for active profile" });
  }
  if (method === "GET" && path === "/api/prive/status") {
    return json(res, 423, {
      ok: false, code: "PRIVE_EXTERNAL_GATES_REQUIRED", enabled: false,
      safe_preview_only: true, explicit_media_available: false, real_payments: false,
      required_gates: ["age_assurance", "country_policy", "consent_and_rights", "safety_operations", "independent_legal_review"],
      error: "Privé remains unavailable until all adult-safety and legal gates are independently approved",
    });
  }
  if (method === "GET" && path === "/api/dating/profile") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, profile: publicDatingProfile(repo.getDatingProfile(auth.user.id), true), privacy: "DATING_ONLY" });
  }
  if (method === "PUT" && path === "/api/dating/profile") {
    const body = await readJson(req);
    const allowed = new Set(["display_name", "age", "gender", "seeking", "intention", "interests", "bio", "city_bucket", "visibility", "adult_confirmed"]);
    if (!exactObject(body, allowed) || body.adult_confirmed !== true || !Array.isArray(body.seeking) || !Array.isArray(body.interests)) return json(res, 400, { ok: false, error: "dating profile fields invalid" });
    const displayName = sanitizeText(body.display_name, 60), age = Number(body.age), gender = String(body.gender || ""), intention = String(body.intention || ""), visibility = String(body.visibility || "paused");
    const seeking = [...new Set(body.seeking.map(String))], interests = [...new Set(body.interests.map((item) => sanitizeText(item, 30)).filter(Boolean))];
    const bio = sanitizeText(body.bio, 500), cityBucket = sanitizeText(body.city_bucket, 80);
    if (!displayName || !Number.isSafeInteger(age) || age < 18 || age > 99 || !DATING_GENDERS.has(gender) || !seeking.length || seeking.length > DATING_GENDERS.size || seeking.some((item) => !DATING_GENDERS.has(item)) || !DATING_INTENTIONS.has(intention) || interests.length > 10 || !DATING_VISIBILITIES.has(visibility)) return json(res, 400, { ok: false, error: "dating profile invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, profile: publicDatingProfile(repo.upsertDatingProfile({ userId: auth.user.id, displayName, age, gender, seeking, intention, interests, bio, cityBucket, visibility }), true), privacy: "DATING_ONLY", verification_truth: "SELF_DECLARED_LOCAL" });
  }
  if (method === "GET" && path === "/api/dating/discovery") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, candidates: repo.listDatingCandidates({ viewerId: auth.user.id, limit: Number(url.searchParams.get("limit") || 30) }), policy: "MUTUAL_ELIGIBILITY_NO_DESIRABILITY_SCORE", location_precision: "CITY_BUCKET_ONLY" });
  }
  if (method === "POST" && path === "/api/dating/decisions") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["target_user_id", "action"])) || !Number.isSafeInteger(Number(body.target_user_id)) || !new Set(["pass", "like"]).has(body.action)) return json(res, 400, { ok: false, error: "dating decision invalid" });
    try {
      const result = repo.makeDatingDecision({ actorId: auth.user.id, targetId: Number(body.target_user_id), action: body.action });
      if (result.match) {
        repo.notify(result.decision.target_id, "message", "New Dating match", { persona: "dating", sensitive: true });
        publishNotificationInvalidation(repo, sse, { userId: result.decision.target_id, persona: "dating", type: "message", action: "dating_match" });
      }
      return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, decision: result.decision, match: result.match, privacy: "DECISION_PRIVATE_UNLESS_MUTUAL_MATCH" });
    } catch (error) { const mapped = mapDatingError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/dating/matches") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, matches: repo.listDatingMatches(auth.user.id), privacy: "PARTICIPANTS_ONLY" });
  }
  const datingMatchAction = path.match(/^\/api\/dating\/matches\/(\d+)$/);
  if (method === "PATCH" && datingMatchAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["unmatch", "block"]).has(body.action)) return json(res, 400, { ok: false, error: "dating match action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, match: repo.endDatingMatch({ viewerId: auth.user.id, matchId: Number(datingMatchAction[1]), action: body.action }) }); }
    catch (error) { const mapped = mapDatingError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const datingMeetCreate = path.match(/^\/api\/dating\/matches\/(\d+)\/meet-plans$/);
  if (method === "POST" && datingMeetCreate) {
    const body = await readJson(req);
    const scheduledAt = Number(body.scheduled_at), nowSeconds = Math.floor(Date.now() / 1000), zoneBucket = sanitizeText(body.zone_bucket, 100), pin = String(body.pin || "");
    if (!exactObject(body, new Set(["zone_bucket", "scheduled_at", "pin"])) || !zoneBucket || !Number.isSafeInteger(scheduledAt) || scheduledAt < nowSeconds + 3600 || scheduledAt > nowSeconds + 30 * 86400 || !/^\d{4}$/.test(pin)) return json(res, 400, { ok: false, error: "dating meet plan invalid" });
    try { return json(res, 201, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, meet_plan: repo.createDatingMeetPlan({ viewerId: auth.user.id, matchId: Number(datingMeetCreate[1]), zoneBucket, scheduledAt, pin }), location_precision: "PUBLIC_ZONE_BUCKET_ONLY", pin_storage: "SHA256_ONLY" }); }
    catch (error) { const mapped = mapDatingError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/dating/meet-plans") {
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, meet_plans: repo.listDatingMeetPlans(auth.user.id), privacy: "MATCH_PARTICIPANTS_ONLY", precise_location_stored: false });
  }
  const datingMeetAction = path.match(/^\/api\/dating\/meet-plans\/(\d+)$/);
  if (method === "PATCH" && datingMeetAction) {
    const body = await readJson(req), action = String(body.action || ""), pin = String(body.pin || "");
    if (!exactObject(body, new Set(["action", "pin"])) || !new Set(["accept", "cancel", "confirm"]).has(action) || (action === "confirm" && !/^\d{4}$/.test(pin))) return json(res, 400, { ok: false, error: "dating meet action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, meet_plan: repo.transitionDatingMeetPlan({ viewerId: auth.user.id, planId: Number(datingMeetAction[1]), action, pin }), privacy: "MATCH_PARTICIPANTS_ONLY" }); }
    catch (error) { const mapped = mapDatingError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  // ---- M10: Watch, local Live lifecycle and adult-managed Kids ----
  if (path.startsWith("/api/watch/") && auth.persona !== "social") {
    return json(res, 404, { ok: false, code: "WATCH_SOCIAL_PERSONA_REQUIRED", error: "resource not found for active profile" });
  }
  if (method === "GET" && path === "/api/watch/home") {
    const mode = url.searchParams.get("mode") === "subscriptions" ? "subscriptions" : "editorial";
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, ...repo.listWatchHome(auth.user.id, { mode, limit: Number(url.searchParams.get("limit") || 30) }),
      rights_policy: "ELIGIBILITY_BEFORE_DISCOVERY", production_streaming: false });
  }
  if (method === "GET" && path === "/api/watch/channels/mine") {
    return json(res, 200, { ok: true, owner_id: auth.user.id, channels: repo.listOwnWatchChannels(auth.user.id) });
  }
  if (method === "POST" && path === "/api/watch/channels") {
    const body = await readJson(req);
    const handle = sanitizeText(body.handle, 30).toLowerCase(), title = sanitizeText(body.title, 80), description = sanitizeText(body.description, 600);
    if (!exactObject(body, new Set(["handle", "title", "description"])) || !/^[a-z0-9_]{3,30}$/.test(handle) || !title) return json(res, 400, { ok: false, error: "watch channel fields invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, channel: repo.createWatchChannel({ ownerId: auth.user.id, handle, title, description }) }); }
    catch (error) { if (/UNIQUE/i.test(String(error.message))) return json(res, 409, { ok: false, code: "WATCH_CHANNEL_HANDLE_TAKEN", error: "channel handle unavailable" }); throw error; }
  }
  if (method === "POST" && path === "/api/watch/videos") {
    const body = await readJson(req);
    const input = { ownerId: auth.user.id, channelId: Number(body.channel_id), mediaId: Number(body.media_id), title: sanitizeText(body.title, 120),
      description: sanitizeText(body.description, 3000), durationSeconds: Number(body.duration_seconds), audience: String(body.audience || "public"),
      ageRating: String(body.age_rating || "general"), captionsLanguage: sanitizeText(body.captions_language || "und", 20).toLowerCase() || "und" };
    if (!exactObject(body, new Set(["channel_id", "media_id", "title", "description", "duration_seconds", "audience", "age_rating", "captions_language", "rights_declared"]))
      || body.rights_declared !== true || !Number.isSafeInteger(input.channelId) || !Number.isSafeInteger(input.mediaId) || !input.title
      || !Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > 3600 || !WATCH_AUDIENCES.has(input.audience)
      || !WATCH_AGE_RATINGS.has(input.ageRating) || !/^(und|[a-z]{2,3}(?:-[a-z0-9]{2,8})*)$/.test(input.captionsLanguage)) return json(res, 400, { ok: false, error: "watch video fields or rights declaration invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, video: repo.createWatchVideo(input), safety: "LOCAL_DEMO_APPROVAL_NOT_PRODUCTION", real_rights_clearance: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const watchVideo = path.match(/^\/api\/watch\/videos\/(\d+)$/);
  if (method === "GET" && watchVideo) {
    const video = repo.getWatchVideo(Number(watchVideo[1]), auth.user.id);
    return video ? json(res, 200, { ok: true, viewer_id: auth.user.id, video }) : json(res, 404, { ok: false, error: "video not found" });
  }
  if (method === "PATCH" && watchVideo) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["publish", "withdraw"]).has(body.action)) return json(res, 400, { ok: false, error: "watch video action invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, video: body.action === "publish" ? repo.publishWatchVideo({ ownerId: auth.user.id, videoId: Number(watchVideo[1]) }) : repo.withdrawWatchVideo({ ownerId: auth.user.id, videoId: Number(watchVideo[1]) }), production_eligible: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const watchSubscribe = path.match(/^\/api\/watch\/channels\/(\d+)\/subscription$/);
  if (method === "POST" && watchSubscribe) {
    const body = await readJson(req), notificationMode = String(body.notification_mode || "personalized");
    if (!exactObject(body, new Set(["active", "notification_mode"])) || typeof body.active !== "boolean" || !WATCH_NOTIFICATION_MODES.has(notificationMode)) return json(res, 400, { ok: false, error: "watch subscription invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, subscription: repo.setWatchSubscription({ userId: auth.user.id, channelId: Number(watchSubscribe[1]), active: body.active, notificationMode }) }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/watch/playlists") return json(res, 200, { ok: true, owner_id: auth.user.id, playlists: repo.listWatchPlaylists(auth.user.id) });
  if (method === "POST" && path === "/api/watch/playlists") {
    const body = await readJson(req), title = sanitizeText(body.title, 80), visibility = String(body.visibility || "private"), kind = String(body.kind || "standard");
    if (!exactObject(body, new Set(["title", "visibility", "kind"])) || !title || !new Set(["private", "public"]).has(visibility) || !new Set(["standard", "watch_later"]).has(kind)) return json(res, 400, { ok: false, error: "watch playlist invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, playlist: repo.createWatchPlaylist({ ownerId: auth.user.id, title, visibility, kind }) }); }
    catch (error) { if (/UNIQUE/i.test(String(error.message))) return json(res, 409, { ok: false, code: "WATCH_PLAYLIST_EXISTS", error: "playlist already exists" }); throw error; }
  }
  const watchPlaylistItem = path.match(/^\/api\/watch\/playlists\/(\d+)\/items$/);
  if (method === "POST" && watchPlaylistItem) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["video_id"])) || !Number.isSafeInteger(Number(body.video_id))) return json(res, 400, { ok: false, error: "watch playlist item invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, playlist: repo.addWatchPlaylistItem({ ownerId: auth.user.id, playlistId: Number(watchPlaylistItem[1]), videoId: Number(body.video_id) }) }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const watchProgress = path.match(/^\/api\/watch\/videos\/(\d+)\/progress$/);
  if (method === "POST" && watchProgress) {
    const body = await readJson(req), positionSeconds = Number(body.position_seconds);
    if (!exactObject(body, new Set(["position_seconds"])) || !Number.isSafeInteger(positionSeconds) || positionSeconds < 0) return json(res, 400, { ok: false, error: "watch progress invalid" });
    try { return json(res, 200, { ok: true, viewer_id: auth.user.id, progress: repo.updateWatchProgress({ viewerId: auth.user.id, videoId: Number(watchProgress[1]), positionSeconds }) }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const liveLifecycle = path.match(/^\/api\/social\/live\/(\d+)\/(schedule|start|cancel|terminate)$/);
  if (method === "POST" && liveLifecycle) {
    if (auth.persona !== "social") return json(res, 404, { ok: false, code: "WATCH_SOCIAL_PERSONA_REQUIRED", error: "resource not found for active profile" });
    const action = liveLifecycle[2], body = await readJson(req);
    const scheduledAt = action === "schedule" ? Number(body.scheduled_at) : null, nowSeconds = Math.floor(Date.now() / 1000);
    if (!exactObject(body, action === "schedule" ? new Set(["scheduled_at"]) : new Set()) || (action === "schedule" && (!Number.isSafeInteger(scheduledAt) || scheduledAt < nowSeconds + 300 || scheduledAt > nowSeconds + 366 * 86400))) return json(res, 400, { ok: false, error: "live lifecycle request invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, session: repo.transitionSocialLiveLocal({ ownerId: auth.user.id, sessionId: Number(liveLifecycle[1]), action, scheduledAt }), public_broadcast: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/family") return json(res, 200, { ok: true, owner_id: auth.user.id, ...repo.listFamily(auth.user.id), kids_runtime: "SEPARATE_TOKEN_AND_SHELL_LOCAL" });
  if (method === "POST" && path === "/api/family/children") {
    const body = await readJson(req), alias = sanitizeText(body.alias, 30), ageBand = String(body.age_band || ""), locale = sanitizeText(body.locale || "en", 12).toLowerCase(), avatarCode = sanitizeText(body.avatar_code || "orbit", 24);
    if (!exactObject(body, new Set(["alias", "age_band", "locale", "avatar_code", "parental_authority_confirmed"])) || body.parental_authority_confirmed !== true || !alias || !KIDS_AGE_BANDS.has(ageBand) || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale)) return json(res, 400, { ok: false, error: "child profile or parental declaration invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, child: repo.createKidsChild({ adultAccountId: auth.user.id, alias, ageBand, locale, avatarCode }), authority: "LOCAL_DEMO_UNVERIFIED", production_eligible: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const kidsControls = path.match(/^\/api\/family\/children\/(\d+)\/controls$/);
  if (method === "PUT" && kidsControls) {
    const body = await readJson(req), dailyMinutes = Number(body.daily_minutes);
    const approvedTopics = Array.isArray(body.approved_topics) ? [...new Set(body.approved_topics.map((topic) => sanitizeText(topic, 30)).filter(Boolean))] : [];
    if (!exactObject(body, new Set(["daily_minutes", "search_enabled", "live_enabled", "approved_topics"])) || !Number.isSafeInteger(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 240 || typeof body.search_enabled !== "boolean" || typeof body.live_enabled !== "boolean" || approvedTopics.length > 20) return json(res, 400, { ok: false, error: "parent controls invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, child: repo.updateKidsControls({ adultAccountId: auth.user.id, childId: Number(kidsControls[1]), dailyMinutes, searchEnabled: body.search_enabled, liveEnabled: body.live_enabled, approvedTopics }), autoplay: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const kidsSession = path.match(/^\/api\/family\/children\/(\d+)\/session$/);
  if (method === "POST" && kidsSession) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["parental_gate_confirmed"])) || body.parental_gate_confirmed !== true) return json(res, 400, { ok: false, error: "parental gate confirmation required" });
    const token = randomBytes(32).toString("base64url"), expiresAt = Math.floor(Date.now() / 1000) + 2 * 3600;
    try { repo.storeKidsSession({ adultAccountId: auth.user.id, childId: Number(kidsSession[1]), tokenHash: hashToken(token), expiresAt });
      return json(res, 201, { ok: true, owner_id: auth.user.id, child_id: Number(kidsSession[1]), child_session: token, expires_at: expiresAt, launch_url: `/kids.html#session=${token}`, reusable_as_adult_session: false }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "POST" && path === "/api/family/catalog") {
    const body = await readJson(req), ageBand = String(body.age_band || ""), locale = sanitizeText(body.locale || "en", 12).toLowerCase(), topic = sanitizeText(body.topic, 30);
    if (!exactObject(body, new Set(["video_id", "age_band", "locale", "topic"])) || !Number.isSafeInteger(Number(body.video_id)) || !KIDS_AGE_BANDS.has(ageBand) || !topic || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale)) return json(res, 400, { ok: false, error: "kids catalog entry invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, entry: repo.addKidsCatalogEntry({ adultAccountId: auth.user.id, videoId: Number(body.video_id), ageBand, locale, topic }), editorial_state: "APPROVED_LOCAL_DEMO_NOT_PRODUCTION" }); }
    catch (error) { const mapped = mapM10Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  // ---- M11: Music independent catalog + Grow W0/W1 local boundary ----
  if (method === "GET" && path === "/api/music/home") {
    const query = sanitizeText(url.searchParams.get("q") || "", 80);
    const explicitAllowed = url.searchParams.get("explicit") === "1";
    return json(res, 200, {
      ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona,
      ...repo.listMusicHome(auth.user.id, { query, explicitAllowed, limit: Number(url.searchParams.get("limit") || 30) }),
      catalog_scope: "INDEPENDENT_OR_DIRECT_RIGHTS_LOCAL_DEMO", commercial_catalog: false,
    });
  }
  if (method === "GET" && path === "/api/music/artists/mine") {
    return json(res, 200, { ok: true, owner_id: auth.user.id, artist: repo.getOwnMusicArtist(auth.user.id) });
  }
  if (method === "POST" && path === "/api/music/artists") {
    const body = await readJson(req), stageName = sanitizeText(body.stage_name, 80), bio = sanitizeText(body.bio, 800);
    if (!exactObject(body, new Set(["stage_name", "bio", "rights_declaration_confirmed"])) || !stageName || body.rights_declaration_confirmed !== true) {
      return json(res, 400, { ok: false, error: "artist fields and rights declaration are required" });
    }
    try {
      return json(res, 201, { ok: true, owner_id: auth.user.id, artist: repo.createMusicArtist({ ownerId: auth.user.id, stageName, bio }), verification: "SELF_DECLARED_LOCAL_NOT_PRODUCTION" });
    } catch (error) {
      if (/UNIQUE/i.test(String(error?.message))) return json(res, 409, { ok: false, code: "MUSIC_ARTIST_EXISTS", error: "this Nexus account already owns an artist page" });
      throw error;
    }
  }
  const musicArtist = path.match(/^\/api\/music\/artists\/(\d+)$/);
  if (method === "GET" && musicArtist) {
    const artist = repo.getMusicArtist(Number(musicArtist[1]), auth.user.id);
    return artist ? json(res, 200, { ok: true, viewer_id: auth.user.id, artist }) : json(res, 404, { ok: false, error: "artist not found" });
  }
  if (method === "POST" && path === "/api/music/tracks") {
    const body = await readJson(req);
    const input = {
      ownerId: auth.user.id, artistId: Number(body.artist_id), mediaId: Number(body.media_id),
      title: sanitizeText(body.title, 120), durationSeconds: Number(body.duration_seconds),
      rightsBasis: String(body.rights_basis || ""), attribution: sanitizeText(body.attribution, 500),
      explicit: body.explicit === true, territory: "LOCAL_DEMO",
    };
    const validAttribution = input.rightsBasis === "original" || input.attribution.length >= 3;
    if (!exactObject(body, new Set(["artist_id", "media_id", "title", "duration_seconds", "rights_basis", "attribution", "explicit", "rights_declared"]))
      || body.rights_declared !== true || !Number.isSafeInteger(input.artistId) || !Number.isSafeInteger(input.mediaId)
      || !input.title || !Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > 3600
      || !MUSIC_RIGHTS_BASES.has(input.rightsBasis) || !validAttribution || typeof body.explicit !== "boolean") {
      return json(res, 400, { ok: false, error: "track fields, rights basis or attribution invalid" });
    }
    try {
      return json(res, 201, { ok: true, owner_id: auth.user.id, track: repo.createMusicTrack(input), clearance: "SELF_DECLARED_LOCAL_DEMO", royalty_eligible: false });
    } catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const musicTrack = path.match(/^\/api\/music\/tracks\/(\d+)$/);
  if (method === "GET" && musicTrack) {
    const track = repo.getMusicTrack(Number(musicTrack[1]), auth.user.id);
    return track ? json(res, 200, { ok: true, viewer_id: auth.user.id, track }) : json(res, 404, { ok: false, error: "track not found" });
  }
  if (method === "PATCH" && musicTrack) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["publish", "withdraw"]).has(body.action)) return json(res, 400, { ok: false, error: "music track action invalid" });
    try {
      const track = body.action === "publish" ? repo.publishMusicTrack({ ownerId: auth.user.id, trackId: Number(musicTrack[1]) }) : repo.withdrawMusicTrack({ ownerId: auth.user.id, trackId: Number(musicTrack[1]) });
      return json(res, 200, { ok: true, owner_id: auth.user.id, track, production_eligible: false });
    } catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const musicLibrary = path.match(/^\/api\/music\/library\/(\d+)$/);
  if (method === "PUT" && musicLibrary) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["active"])) || typeof body.active !== "boolean") return json(res, 400, { ok: false, error: "library mutation invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, library: repo.setMusicLibrary({ userId: auth.user.id, trackId: Number(musicLibrary[1]), active: body.active }) }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "POST" && path === "/api/music/playback/start") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["track_id"])) || !Number.isSafeInteger(Number(body.track_id))) return json(res, 400, { ok: false, error: "playback request invalid" });
    try {
      return json(res, 201, { ok: true, viewer_id: auth.user.id, play: repo.recordMusicPlayStart({ userId: auth.user.id, trackId: Number(body.track_id) }), settlement: "NO_ROYALTY_FROM_RAW_START" });
    } catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/music/playlists") return json(res, 200, { ok: true, owner_id: auth.user.id, playlists: repo.listMusicPlaylists(auth.user.id) });
  if (method === "POST" && path === "/api/music/playlists") {
    const body = await readJson(req), title = sanitizeText(body.title, 80), visibility = String(body.visibility || "private");
    if (!exactObject(body, new Set(["title", "visibility"])) || !title || !new Set(["private", "public"]).has(visibility)) return json(res, 400, { ok: false, error: "playlist fields invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, playlist: repo.createMusicPlaylist({ ownerId: auth.user.id, title, visibility }) }); }
    catch (error) { if (/UNIQUE/i.test(String(error?.message))) return json(res, 409, { ok: false, code: "MUSIC_PLAYLIST_EXISTS", error: "playlist title already exists" }); throw error; }
  }
  const musicPlaylistItems = path.match(/^\/api\/music\/playlists\/(\d+)\/items$/);
  if (method === "POST" && musicPlaylistItems) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["track_id"])) || !Number.isSafeInteger(Number(body.track_id))) return json(res, 400, { ok: false, error: "playlist item invalid" });
    try { return json(res, 200, { ok: true, owner_id: auth.user.id, playlist: repo.addMusicPlaylistItem({ ownerId: auth.user.id, playlistId: Number(musicPlaylistItems[1]), trackId: Number(body.track_id) }) }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "GET" && path === "/api/grow/home") {
    const vertical = String(url.searchParams.get("vertical") || ""), query = sanitizeText(url.searchParams.get("q") || "", 80);
    if (vertical && !GROW_VERTICALS.has(vertical)) return json(res, 400, { ok: false, error: "grow vertical invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona,
      content: repo.listGrowHome(auth.user.id, { vertical, query, limit: Number(url.searchParams.get("limit") || 30) }),
      intended_purpose: "EDUCATION_AND_GENERAL_WELLBEING_W0_W1", health_targeting: false });
  }
  if (method === "POST" && path === "/api/grow/content") {
    const body = await readJson(req), input = { ownerId: auth.user.id, vertical: String(body.vertical || ""), format: String(body.format || "article"),
      title: sanitizeText(body.title, 120), summary: sanitizeText(body.summary, 2000), sourceNote: sanitizeText(body.source_note, 1000), medicalClass: String(body.medical_class || "") };
    if (!exactObject(body, new Set(["vertical", "format", "title", "summary", "source_note", "medical_class", "non_medical_confirmed"]))
      || body.non_medical_confirmed !== true || !GROW_VERTICALS.has(input.vertical) || !GROW_FORMATS.has(input.format)
      || !input.title || !input.summary || !input.sourceNote || !GROW_MEDICAL_CLASSES.has(input.medicalClass)) return json(res, 400, { ok: false, error: "Grow content must be sourced W0/W1 educational material" });
    return json(res, 201, { ok: true, owner_id: auth.user.id, content: repo.createGrowContent(input), production_eligible: false, editorial_state: "APPROVED_LOCAL_DEMO_ONLY" });
  }
  if (method === "GET" && path === "/api/grow/workouts/offers") return json(res, 200, { ok: true, viewer_id: auth.user.id, offers: repo.listGrowWorkoutOffers(auth.user.id), settlement: "LOCAL_DEMO_NO_PAYMENT" });
  if (method === "POST" && path === "/api/grow/workouts/offers") {
    const body = await readJson(req), input = { ownerId: auth.user.id, contentId: Number(body.content_id), title: sanitizeText(body.title, 120), accessMinutes: Number(body.access_minutes), priceCents: Number(body.price_cents) };
    if (!exactObject(body, new Set(["content_id", "title", "access_minutes", "price_cents"])) || !Number.isSafeInteger(input.contentId) || !input.title
      || !Number.isSafeInteger(input.accessMinutes) || input.accessMinutes < 15 || input.accessMinutes > 480 || !Number.isSafeInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 100000000) return json(res, 400, { ok: false, error: "workout offer invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, offer: repo.createGrowWorkoutOffer(input), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const growWorkoutReserve = path.match(/^\/api\/grow\/workouts\/offers\/(\d+)\/reserve$/);
  if (method === "POST" && growWorkoutReserve) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "reservation body must be empty" });
    try { return json(res, 201, { ok: true, buyer_id: auth.user.id, reservation: repo.reserveGrowWorkout({ buyerId: auth.user.id, offerId: Number(growWorkoutReserve[1]) }), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/grow/courses") return json(res, 200, { ok: true, viewer_id: auth.user.id, courses: repo.listGrowCourses(auth.user.id), accreditation_default: "NOT_ACCREDITED" });
  if (method === "POST" && path === "/api/grow/courses") {
    const body = await readJson(req), input = { ownerId: auth.user.id, title: sanitizeText(body.title, 120), description: sanitizeText(body.description, 3000), priceCents: Number(body.price_cents) };
    if (!exactObject(body, new Set(["title", "description", "price_cents", "not_accredited_confirmed"])) || body.not_accredited_confirmed !== true || !input.title || !input.description || !Number.isSafeInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 100000000) return json(res, 400, { ok: false, error: "course fields or accreditation statement invalid" });
    return json(res, 201, { ok: true, owner_id: auth.user.id, course: repo.createGrowCourse(input), accreditation: "NOT_ACCREDITED", settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  if (method === "GET" && path === "/api/grow/enrollments") return json(res, 200, { ok: true, owner_id: auth.user.id, enrollments: repo.listGrowEnrollments(auth.user.id), private_progress: true });
  const growCourseEnroll = path.match(/^\/api\/grow\/courses\/(\d+)\/enroll$/);
  if (method === "POST" && growCourseEnroll) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "enrollment body must be empty" });
    try { return json(res, 201, { ok: true, learner_id: auth.user.id, enrollment: repo.enrollGrowCourse({ learnerId: auth.user.id, courseId: Number(growCourseEnroll[1]) }), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const growCourseProgress = path.match(/^\/api\/grow\/courses\/(\d+)\/progress$/);
  if (method === "PUT" && growCourseProgress) {
    const body = await readJson(req), progressPercent = Number(body.progress_percent);
    if (!exactObject(body, new Set(["progress_percent"])) || !Number.isSafeInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) return json(res, 400, { ok: false, error: "course progress invalid" });
    try { return json(res, 200, { ok: true, learner_id: auth.user.id, enrollment: repo.updateGrowCourseProgress({ learnerId: auth.user.id, courseId: Number(growCourseProgress[1]), progressPercent }), private_progress: true }); }
    catch (error) { const mapped = mapM11Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/grow/private") {
    const vertical = String(url.searchParams.get("vertical") || "");
    if (vertical && !GROW_VERTICALS.has(vertical)) return json(res, 400, { ok: false, error: "grow vertical invalid" });
    return json(res, 200, { ok: true, owner_id: auth.user.id, entries: repo.listGrowPrivateEntries(auth.user.id, { vertical }), visibility: "OWNER_ONLY_CIPHERTEXT", reused_for_ads_dating_work_reputation: false });
  }
  if (method === "POST" && path === "/api/grow/private") {
    const body = await readJson(req), nowSeconds = Math.floor(Date.now() / 1000), expiresAt = Number(body.expires_at), vertical = String(body.vertical || ""), kind = String(body.kind || ""), ciphertext = String(body.ciphertext || ""), nonce = String(body.nonce || "");
    if (!exactObject(body, new Set(["vertical", "kind", "ciphertext", "nonce", "expires_at"])) || !GROW_VERTICALS.has(vertical) || !GROW_PRIVATE_KINDS.has(kind)
      || !/^[A-Za-z0-9_-]{24,8192}$/.test(ciphertext) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)
      || !Number.isSafeInteger(expiresAt) || expiresAt < nowSeconds + 3600 || expiresAt > nowSeconds + 366 * 86400) return json(res, 400, { ok: false, error: "encrypted private Grow entry invalid" });
    try { return json(res, 201, { ok: true, owner_id: auth.user.id, entry: repo.createGrowPrivateEntry({ ownerId: auth.user.id, vertical, kind, ciphertext, nonce, expiresAt }), plaintext_received: false, reused_for_ads_dating_work_reputation: false }); }
    catch (error) { if (/UNIQUE/i.test(String(error?.message))) return json(res, 409, { ok: false, code: "GROW_PRIVATE_DUPLICATE", error: "encrypted entry already exists" }); throw error; }
  }
  const growPrivateDelete = path.match(/^\/api\/grow\/private\/(\d+)$/);
  if (method === "DELETE" && growPrivateDelete) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "delete body must be empty" });
    const deleted = repo.deleteGrowPrivateEntry(auth.user.id, Number(growPrivateDelete[1]));
    return deleted ? json(res, 200, { ok: true, owner_id: auth.user.id, deleted: true }) : json(res, 404, { ok: false, error: "private entry not found" });
  }

  if (method === "GET" && path === "/api/market/listings") {
    const mine = url.searchParams.get("mine") === "1";
    const scope = String(url.searchParams.get("scope") || "");
    const category = String(url.searchParams.get("category") || "");
    if (scope && !DISCOVERY_SCOPES.has(scope)) return json(res, 400, { ok: false, error: "discovery scope invalid" });
    if (category && !MARKET_CATEGORIES.has(category)) return json(res, 400, { ok: false, error: "market category invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, listings: repo.listMarketListings({ viewerId: auth.user.id, mine, scope, category, query: sanitizeText(url.searchParams.get("q") || "", 80) }), settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  if (method === "POST" && path === "/api/market/listings") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["title", "description", "category", "price_cents", "sale_mode", "discovery_scope", "public_location"]))) return json(res, 400, { ok: false, error: "market listing fields invalid" });
    const input = { sellerId: auth.user.id, title: sanitizeText(body.title, 120), description: sanitizeText(body.description, 2000), category: String(body.category || "other"), priceCents: Number(body.price_cents), saleMode: String(body.sale_mode || "free_classified"), discoveryScope: String(body.discovery_scope || "local"), publicLocation: sanitizeText(body.public_location, 100) };
    if (!input.title || !input.description || !MARKET_CATEGORIES.has(input.category) || !MARKET_SALE_MODES.has(input.saleMode) || !DISCOVERY_SCOPES.has(input.discoveryScope) || !Number.isSafeInteger(input.priceCents) || input.priceCents < 100 || input.priceCents > 1000000000) return json(res, 400, { ok: false, error: "market listing invalid" });
    if (PROHIBITED_MARKET_TERMS.test(`${input.title} ${input.description}`)) return json(res, 422, { ok: false, code: "MARKET_PROHIBITED_ITEM", error: "listing refused by the local prohibited-items policy" });
    return json(res, 201, { ok: true, seller_id: auth.user.id, seller_persona: auth.persona, listing: repo.createMarketListing(input), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 });
  }
  const marketOfferCreate = path.match(/^\/api\/market\/listings\/(\d+)\/offers$/);
  if (method === "POST" && marketOfferCreate) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["amount_cents", "message"]))) return json(res, 400, { ok: false, error: "offer fields invalid" });
    const amountCents = Number(body.amount_cents);
    if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 1000000000) return json(res, 400, { ok: false, error: "offer amount invalid" });
    try {
      const offer = repo.createMarketOffer({ listingId: Number(marketOfferCreate[1]), buyerId: auth.user.id, amountCents, message: sanitizeText(body.message, 500) });
      const listing = repo.getMarketListing(offer.listing_id);
      repo.notify(listing.seller_id, "system", "New Market offer", { persona: "market" });
      publishNotificationInvalidation(repo, sse, { userId: listing.seller_id, persona: "market", type: "system", action: "market_offer" });
      return json(res, 201, { ok: true, buyer_id: auth.user.id, offer, settlement: "LOCAL_DEMO_NO_PAYMENT" });
    } catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/market/offers") {
    const scope = url.searchParams.get("scope") === "received" ? "received" : "mine";
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, scope, offers: repo.listMarketOffers(auth.user.id, scope) });
  }
  const marketOfferAction = path.match(/^\/api\/market\/offers\/(\d+)\/(accept|withdraw)$/);
  if (method === "POST" && marketOfferAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "offer action body must be empty" });
    try {
      if (marketOfferAction[2] === "withdraw") return json(res, 200, { ok: true, actor_id: auth.user.id, offer: repo.withdrawMarketOffer({ buyerId: auth.user.id, offerId: Number(marketOfferAction[1]) }) });
      const order = repo.acceptMarketOffer({ sellerId: auth.user.id, offerId: Number(marketOfferAction[1]) });
      repo.notify(order.buyer_id, "system", "Market offer accepted", { persona: "market" });
      publishNotificationInvalidation(repo, sse, { userId: order.buyer_id, persona: "market", type: "system", action: "market_offer_accepted" });
      return json(res, 201, { ok: true, seller_id: auth.user.id, order, settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 });
    } catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/market/orders") return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, orders: repo.listMarketOrders(auth.user.id), settlement: "LOCAL_DEMO_NO_PAYMENT" });
  const marketOrderAction = path.match(/^\/api\/market\/orders\/(\d+)$/);
  if (method === "PATCH" && marketOrderAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["fulfill", "complete", "cancel"]).has(body.action)) return json(res, 400, { ok: false, error: "order action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, order: repo.transitionMarketOrder({ userId: auth.user.id, orderId: Number(marketOrderAction[1]), action: body.action }), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 }); }
    catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "GET" && path === "/api/stay/listings") {
    const mine = url.searchParams.get("mine") === "1";
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, listings: repo.listStayListings({ viewerId: auth.user.id, mine, query: sanitizeText(url.searchParams.get("q") || "", 80) }), private_address_policy: mine ? "OWNER_ONLY" : "HIDDEN_UNTIL_BOOKING", settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  if (method === "POST" && path === "/api/stay/listings") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["title", "description", "public_location", "private_address", "nightly_cents", "max_guests", "cancellation_policy"]))) return json(res, 400, { ok: false, error: "stay listing fields invalid" });
    const input = { hostId: auth.user.id, title: sanitizeText(body.title, 120), description: sanitizeText(body.description, 2000), publicLocation: sanitizeText(body.public_location, 100), privateAddress: sanitizeText(body.private_address, 200), nightlyCents: Number(body.nightly_cents), maxGuests: Number(body.max_guests), cancellationPolicy: String(body.cancellation_policy || "moderate") };
    if (!input.title || !input.description || !input.publicLocation || !input.privateAddress || !Number.isSafeInteger(input.nightlyCents) || input.nightlyCents < 100 || input.nightlyCents > 1000000000 || !Number.isSafeInteger(input.maxGuests) || input.maxGuests < 1 || input.maxGuests > 32 || !STAY_CANCELLATION_POLICIES.has(input.cancellationPolicy)) return json(res, 400, { ok: false, error: "stay listing invalid" });
    return json(res, 201, { ok: true, host_id: auth.user.id, host_persona: auth.persona, listing: repo.createStayListing(input), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 });
  }
  const stayBook = path.match(/^\/api\/stay\/listings\/(\d+)\/book$/);
  if (method === "POST" && stayBook) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["check_in", "check_out", "guest_count"]))) return json(res, 400, { ok: false, error: "stay booking fields invalid" });
    const checkIn = Number(body.check_in), checkOut = Number(body.check_out), guestCount = Number(body.guest_count);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (![checkIn, checkOut, guestCount].every(Number.isSafeInteger) || checkIn < nowSeconds + 3600 || checkOut <= checkIn || checkOut - checkIn > 90 * 86400 || guestCount < 1 || guestCount > 32) return json(res, 400, { ok: false, error: "stay dates or guest count invalid" });
    try {
      const booking = repo.bookStay({ guestId: auth.user.id, listingId: Number(stayBook[1]), checkIn, checkOut, guestCount });
      repo.notify(booking.host_id, "system", "New Stay booking", { persona: "travel" });
      publishNotificationInvalidation(repo, sse, { userId: booking.host_id, persona: "travel", type: "system", action: "stay_booking" });
      return json(res, 201, { ok: true, guest_id: auth.user.id, guest_persona: auth.persona, booking, settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0, address_visibility: "PARTICIPANTS_ONLY" });
    } catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/stay/bookings") return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, bookings: repo.listStayBookings(auth.user.id), settlement: "LOCAL_DEMO_NO_PAYMENT", address_visibility: "PARTICIPANTS_ONLY" });
  const stayBookingAction = path.match(/^\/api\/stay\/bookings\/(\d+)$/);
  if (method === "PATCH" && stayBookingAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action"])) || !new Set(["cancel", "complete"]).has(body.action)) return json(res, 400, { ok: false, error: "stay booking action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, booking: repo.transitionStayBooking({ userId: auth.user.id, bookingId: Number(stayBookingAction[1]), action: body.action }), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "GET" && path === "/api/ride/driver") return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, driver: repo.getRideDriver(auth.user.id), verification_truth: "LOCAL_SYNTHETIC_ONLY" });
  if (method === "POST" && path === "/api/ride/driver") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["vehicle_label", "seats", "demo_acknowledged"]))) return json(res, 400, { ok: false, error: "driver fields invalid" });
    if (body.demo_acknowledged !== true || process.env.NODE_ENV === "production") return json(res, 403, { ok: false, code: "RIDE_REAL_VERIFICATION_REQUIRED", error: "driver activation requires an approved real verification provider" });
    const vehicleLabel = sanitizeText(body.vehicle_label, 100), seats = Number(body.seats);
    if (!vehicleLabel || !Number.isSafeInteger(seats) || seats < 1 || seats > 8) return json(res, 400, { ok: false, error: "driver profile invalid" });
    return json(res, 201, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, driver: repo.upsertRideDriver({ userId: auth.user.id, vehicleLabel, seats, verificationStatus: "synthetic_demo" }), verification_truth: "LOCAL_SYNTHETIC_ONLY" });
  }
  if (method === "PATCH" && path === "/api/ride/driver") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["available"])) || typeof body.available !== "boolean") return json(res, 400, { ok: false, error: "driver availability invalid" });
    try { return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, driver: repo.setRideDriverAvailability({ userId: auth.user.id, available: body.available }), verification_truth: "LOCAL_SYNTHETIC_ONLY" }); }
    catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  if (method === "GET" && path === "/api/ride/requests") {
    const scope = url.searchParams.get("scope") === "open" ? "open" : "mine";
    const requests = scope === "open" ? repo.listOpenRideRequests({ driverId: auth.user.id }) : repo.listRideTrips(auth.user.id);
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, scope, requests, precise_location_stored: false, settlement: "LOCAL_DEMO_NO_PAYMENT" });
  }
  if (method === "POST" && path === "/api/ride/requests") {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["pickup_zone", "dropoff_zone", "requested_at", "seats", "quoted_fare_cents", "trip_pin"]))) return json(res, 400, { ok: false, error: "ride request fields invalid" });
    const input = { riderId: auth.user.id, pickupZone: sanitizeText(body.pickup_zone, 100), dropoffZone: sanitizeText(body.dropoff_zone, 100), requestedAt: Number(body.requested_at), seats: Number(body.seats), quotedFareCents: Number(body.quoted_fare_cents), tripPin: String(body.trip_pin || "") };
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!input.pickupZone || !input.dropoffZone || input.pickupZone === input.dropoffZone || !Number.isSafeInteger(input.requestedAt) || input.requestedAt < nowSeconds + 300 || input.requestedAt > nowSeconds + 86400 || !Number.isSafeInteger(input.seats) || input.seats < 1 || input.seats > 8 || !Number.isSafeInteger(input.quotedFareCents) || input.quotedFareCents < 100 || input.quotedFareCents > 100000000 || !/^\d{4}$/.test(input.tripPin)) return json(res, 400, { ok: false, error: "ride request invalid" });
    return json(res, 201, { ok: true, rider_id: auth.user.id, rider_persona: auth.persona, request: publicRide(repo.createRideRequest(input)), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0, precise_location_stored: false });
  }
  const rideAccept = path.match(/^\/api\/ride\/requests\/(\d+)\/accept$/);
  if (method === "POST" && rideAccept) {
    const body = await readJson(req);
    if (!exactObject(body, new Set())) return json(res, 400, { ok: false, error: "ride accept body must be empty" });
    try {
      const ride = repo.acceptRideRequest({ driverId: auth.user.id, requestId: Number(rideAccept[1]) });
      repo.notify(ride.rider_id, "system", "Ride matched", { persona: "travel" });
      publishNotificationInvalidation(repo, sse, { userId: ride.rider_id, persona: "travel", type: "system", action: "ride_matched" });
      return json(res, 200, { ok: true, driver_id: auth.user.id, request: publicRide(ride), settlement: "LOCAL_DEMO_NO_PAYMENT", real_value: 0 });
    } catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const rideAction = path.match(/^\/api\/ride\/requests\/(\d+)$/);
  if (method === "PATCH" && rideAction) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["action", "trip_pin"])) || !new Set(["start", "complete", "cancel"]).has(body.action) || (body.action === "start" && !/^\d{4}$/.test(String(body.trip_pin || "")))) return json(res, 400, { ok: false, error: "ride action invalid" });
    try { return json(res, 200, { ok: true, actor_id: auth.user.id, request: publicRide(repo.transitionRide({ userId: auth.user.id, requestId: Number(rideAction[1]), action: body.action, tripPin: String(body.trip_pin || "") })), settlement: "LOCAL_DEMO_NO_PAYMENT" }); }
    catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  const reviewCreate = path.match(/^\/api\/(market\/orders|stay\/bookings|ride\/requests)\/(\d+)\/reviews$/);
  if (method === "POST" && reviewCreate) {
    const body = await readJson(req);
    if (!exactObject(body, new Set(["rating", "comment"]))) return json(res, 400, { ok: false, error: "review fields invalid" });
    const rating = Number(body.rating), comment = sanitizeText(body.comment, 1000);
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5 || !comment) return json(res, 400, { ok: false, error: "review invalid" });
    const vertical = reviewCreate[1].split("/")[0];
    try { return json(res, 201, { ok: true, reviewer_id: auth.user.id, reviewer_persona: auth.persona, review: repo.createTransactionReview({ vertical, subjectId: Number(reviewCreate[2]), reviewerId: auth.user.id, rating, comment }), eligibility: "COMPLETED_TRANSACTION_ONLY", visibility: vertical === "market" ? "IMMEDIATE" : "DOUBLE_BLIND_OR_14_DAYS" }); }
    catch (error) { const mapped = mapFairVerticalError(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }
  const reviewsList = path.match(/^\/api\/(market|stay|ride)\/reviews$/);
  if (method === "GET" && reviewsList) {
    const revieweeId = Number(url.searchParams.get("user_id"));
    if (!Number.isSafeInteger(revieweeId) || revieweeId < 1) return json(res, 400, { ok: false, error: "review user invalid" });
    return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, vertical: reviewsList[1], reviews: repo.listTransactionReviews({ vertical: reviewsList[1], revieweeId }), eligibility: "COMPLETED_TRANSACTION_ONLY" });
  }

  // Account centre: public wallet metadata only. Balances are loaded from the
  // selected MultiversX network only after an explicit refresh request.
  if (method === "GET" && path === "/api/account") {
    const network = resolveMvxNetwork();
    const wallets = repo.listWallets(auth.user.id);
    const hasLegacyBackendWallet = wallets.length > 0;
    const externalXPortalWallet = Boolean(auth.user.linked_wallet || (!auth.user.password_hash && auth.user.mvx_address));
    const address = auth.user.linked_wallet || auth.user.mvx_address || null;
    let assets = [];
    let portfolioStatus = "not_refreshed";
    if (url.searchParams.get("refresh") === "1" && address) {
      try {
        assets = await fetchPortfolio(address, { network, fetcher });
        portfolioStatus = "verified_live";
      } catch {
        portfolioStatus = "unavailable";
      }
    }
    return json(res, 200, {
      ok: true,
      network: network.label,
      chain_id: network.chainId,
      address,
      wallets,
      custody_status: externalXPortalWallet ? "external_xportal" : (hasLegacyBackendWallet ? "legacy_backend_wallet_quarantined" : "client_device_wallet_demo_only"),
      legacy_backend_wallet_count: wallets.length,
      assets,
      portfolio_status: portfolioStatus,
      gas_asset: "EGLD",
      providers: {
        email: Boolean(auth.user.email),
        email_verified: Boolean(auth.user.email_verified),
        google: Boolean(auth.user.google_sub),
        facebook: Boolean(auth.user.facebook_sub),
        xportal: Boolean(auth.user.linked_wallet),
      },
      funding: {
        crypto_transfer: Boolean(address) && externalXPortalWallet,
        xmoney: Boolean(process.env.XMONEY_PUBLIC_KEY),
        card_or_bank: false,
      },
    });
  }

  if (method === "GET" && path === "/api/account/sessions") {
    return json(res, 200, {
      ok: true,
      sessions: repo.listUserSessions(auth.user.id, auth.tokenHash),
      step_up: auth.user.password_hash ? "password_or_xportal" : "xportal",
      raw_fingerprints_exposed: false,
    });
  }

  if (method === "GET" && path === "/api/account/deletion") {
    return json(res, 200, { ok: true, owner_id: auth.user.id, ...getDeletionStatus(db, auth.user.id) });
  }

  if (method === "POST" && path === "/api/account/export") {
    const body = await readJson(req);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    const created = createAccountExportRequest({ db, user: auth.user });
    return json(res, 201, {
      ok: true,
      owner_id: auth.user.id,
      export: {
        id: created.id,
        expires_at: created.expires_at,
        download_url: `/api/account/exports/${created.id}`,
        format: "application/json",
      },
      secrets_excluded: true,
    });
  }

  if (method === "GET" && path === "/api/account/exports") {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE account_export_requests SET state = 'expired'
      WHERE user_id = ? AND state = 'ready' AND expires_at <= ?`).run(auth.user.id, currentTime);
    const exports = db.prepare(`SELECT id, state, manifest_hash, expires_at, created_at
      FROM account_export_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`).all(auth.user.id)
      .map((item) => ({
        ...item,
        download_url: item.state === "ready" && item.expires_at > currentTime ? `/api/account/exports/${item.id}` : null,
      }));
    return json(res, 200, { ok: true, owner_id: auth.user.id, exports, ttl_seconds: 900 });
  }

  const accountExportMatch = path.match(/^\/api\/account\/exports\/([0-9a-f-]{36})$/);
  if (method === "GET" && accountExportMatch) {
    const result = getAccountExport({ db, userId: auth.user.id, exportId: accountExportMatch[1] });
    if (result.status === "not_found") return json(res, 404, { ok: false, error: "export not found" });
    if (result.status === "expired") return json(res, 410, { ok: false, code: "EXPORT_EXPIRED", error: "exportul a expirat; generează unul nou" });
    if (!result.payload) return json(res, 404, { ok: false, error: "account not found" });
    res.setHeader("Content-Disposition", `attachment; filename=\"nexus-account-${auth.user.handle}.json\"`);
    return json(res, 200, result.payload);
  }

  if (method === "POST" && path === "/api/account/deletion-request") {
    const body = await readJson(req);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    if (String(body.confirmation || "").trim() !== "DELETE NEXUS" || body.acknowledge_onchain !== true) {
      return json(res, 400, {
        ok: false,
        code: "DELETION_DOUBLE_CONFIRMATION_REQUIRED",
        error: "scrie DELETE NEXUS și confirmă că datele deja publicate on-chain nu pot fi șterse",
      });
    }
    const result = requestAccountDeletion({
      db, repo, user: auth.user, currentTokenHash: auth.tokenHash,
      notify: (userId, type, message, options) => notifyWithInvalidation(repo, sse, userId, type, message, options),
    });
    return json(res, result.replay ? 200 : 202, {
      ok: true,
      owner_id: auth.user.id,
      replay: result.replay,
      deletion: {
        id: result.request.id,
        state: result.request.state,
        requested_at: result.request.requested_at,
        execute_after: result.request.execute_after,
        grace_days: 30,
        cancellable: true,
      },
      onchain_data_erasable: false,
    });
  }

  if (method === "POST" && path === "/api/account/deletion-cancel") {
    const body = await readJson(req);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    const result = cancelAccountDeletion({ db, userId: auth.user.id });
    if (!result.cancelled) return json(res, 409, { ok: false, code: "DELETION_NOT_CANCELLABLE", error: "cererea nu mai poate fi anulată" });
    notifyWithInvalidation(repo, sse, auth.user.id, "security", "Ștergerea contului a fost anulată", { persona: "social", sensitive: true });
    return json(res, 200, { ok: true, owner_id: auth.user.id, cancelled: true, request_id: result.request_id });
  }

  const revokeSessionMatch = path.match(/^\/api\/account\/sessions\/([a-f0-9]{24})\/revoke$/);
  if (method === "POST" && revokeSessionMatch) {
    const body = await readJson(req);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    const result = repo.deleteUserSessionByPublicId(auth.user.id, revokeSessionMatch[1], auth.tokenHash);
    if (!result.found) return json(res, 404, { ok: false, error: "session not found" });
    if (result.current) return json(res, 409, { ok: false, code: "CURRENT_SESSION_USE_LOGOUT", error: "folosește Deconectează această sesiune" });
    notifyWithInvalidation(repo, sse, auth.user.id, "security", "O sesiune Nexus a fost revocată", { persona: "social", sensitive: true });
    return json(res, 200, { ok: true, revoked: result.deleted, sessions: repo.listUserSessions(auth.user.id, auth.tokenHash) });
  }

  // Authenticated payee resolution. This binds a Nexus username to an exact
  // MultiversX address and network, but does not create, sign or broadcast a
  // transaction. Identity/liveness verification is deliberately not implied.
  if (method === "GET" && path === "/api/pay/resolve") {
    const rate = enforceAuthRate(req, res, "pay-username-resolve", auth.user.id, { limit: 60, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    const username = sanitizeText(url.searchParams.get("username") ?? url.searchParams.get("handle") ?? "", 30).replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{2,30}$/.test(username)) return json(res, 400, { ok: false, error: "username Nexus invalid" });
    const recipient = repo.getUserByHandle(username);
    if (!recipient) return json(res, 404, { ok: false, error: "username Nexus negăsit" });
    const address = recipient.linked_wallet || recipient.mvx_address || null;
    if (!address || !Address.isValid(address) || !address.startsWith("erd1")) {
      return json(res, 409, { ok: false, error: "destinatarul nu are un wallet MultiversX valid configurat" });
    }
    const network = resolveMvxNetwork();
    return json(res, 200, {
      ok: true,
      namespace: "nexus",
      recipient: {
        username: recipient.handle,
        address,
        address_fingerprint: `${address.slice(0, 10)}…${address.slice(-8)}`,
        wallet_binding: recipient.linked_wallet ? "xportal" : "nexus_device_wallet",
        same_account: recipient.id === auth.user.id,
      },
      network: { label: network.label, chain_id: network.chainId },
      assurance: {
        nexus_username_unique: true,
        wallet_address_bound: true,
        identity_verified: false,
        warning: "Confirmă username-ul și adresa în wallet înainte de semnare.",
      },
      settlement: {
        assets: ["EGLD", "ESDT"],
        prepared: false,
        signed: false,
        broadcast: false,
      },
    });
  }

  if (method === "GET" && path === "/api/pay/assets") {
    const network = resolveMvxNetwork();
    return json(res, 200, {
      ok: true,
      network: { label: network.label, chain_id: network.chainId },
      assets: Object.values(PAY_ASSETS),
      production_allowlist: false,
      xmoney_adapter: "NOT_CONFIGURED_LOCAL",
      real_funds: false,
    });
  }

  if (method === "POST" && path === "/api/pay/quotes") {
    const body = await readAuthJson(req);
    if (!exactObject(body, new Set(["username", "asset", "amount", "purpose"]))) return json(res, 400, { ok: false, error: "pay quote fields invalid" });
    const username = sanitizeText(body.username, 30).replace(/^@/, "").toLowerCase();
    const asset = PAY_ASSETS[String(body.asset || "")];
    const amount = asset ? parsePayAmount(body.amount, asset.decimals) : null;
    const purpose = sanitizeText(body.purpose || "", 140);
    if (!/^[a-z0-9_]{2,30}$/.test(username) || !asset || !amount) return json(res, 400, { ok: false, error: "recipient, asset or amount invalid" });
    const recipient = repo.getUserByHandle(username);
    const receiverAddress = recipient?.linked_wallet || recipient?.mvx_address || "";
    if (!recipient || !Address.isValid(receiverAddress) || !receiverAddress.startsWith("erd1")) return json(res, 404, { ok: false, code: "PAY_RECIPIENT_UNAVAILABLE", error: "recipient unavailable" });
    const network = resolveMvxNetwork();
    try {
      const receipt = repo.createPayResolutionReceipt({
        senderId: auth.user.id,
        username,
        network: network.label,
        chainId: network.chainId,
        tokenId: asset.token_id,
        tokenDecimals: asset.decimals,
        atomicAmount: amount.atomic,
        displayAmount: amount.display,
        purposeHash: sha256Hex(`NEXUS_PAY_PURPOSE_V1:${purpose}`),
      });
      return json(res, 201, {
        ok: true,
        quote: receipt,
        settlement: { signed: false, submitted: false, ordered: false, executed_success: false },
        truth: "LOCAL_COMMITMENT_ONLY_NO_SIGNATURE_NO_FUNDS",
      });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "POST" && path === "/api/pay/intents") {
    const body = await readAuthJson(req);
    if (!exactObject(body, new Set(["receipt_id", "receipt_hash"])) || !/^[a-f0-9]{24}$/.test(String(body.receipt_id || "")) || !/^[a-f0-9]{64}$/.test(String(body.receipt_hash || ""))) {
      return json(res, 400, { ok: false, error: "resolution receipt invalid" });
    }
    const network = resolveMvxNetwork();
    try {
      const intent = repo.createPayTransferIntent({ senderId: auth.user.id, receiptId: body.receipt_id, expectedReceiptHash: body.receipt_hash, expectedNetwork: network.label, expectedChainId: network.chainId });
      return json(res, 201, {
        ok: true,
        intent,
        authorization: { enabled: false, reason: "LOCAL_DEMO_WALLET_SIGNATURE_AND_BROADCAST_DISABLED" },
        real_funds: false,
      });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "GET" && path === "/api/pay/history") {
    return json(res, 200, { ok: true, owner_id: auth.user.id, private: true, transfers: repo.listPayTransfers(auth.user.id), real_settlements: 0 });
  }

  if (method === "GET" && path === "/api/creator/dashboard") {
    return json(res, 200, {
      ok: true,
      owner_id: auth.user.id,
      dashboard: repo.getCreatorDashboard(auth.user.id),
      economics: { likes_paid: false, external_share: false, real_payouts: false, traffic_classes_economically_eligible: ["HUMAN_ORGANIC"] },
    });
  }

  if (method === "GET" && path === "/api/creator/catalog") {
    const username = sanitizeText(url.searchParams.get("username") || auth.user.handle, 30).replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{2,30}$/.test(username)) return json(res, 400, { ok: false, error: "creator username invalid" });
    const catalog = repo.listCreatorSupportCatalog(auth.user.id, username);
    if (!catalog) return json(res, 404, { ok: false, error: "creator catalog unavailable" });
    return json(res, 200, { ok: true, catalog, real_payment: false, currency: "TEST-USDC" });
  }

  if (method === "POST" && path === "/api/creator/products") {
    const body = await readAuthJson(req);
    if (!exactObject(body, new Set(["kind", "title", "price_cents", "interval_days"]))) return json(res, 400, { ok: false, error: "creator product fields invalid" });
    const kind = String(body.kind || "");
    const title = sanitizeText(body.title, 80);
    const priceCents = Number(body.price_cents);
    const intervalDays = body.interval_days == null ? null : Number(body.interval_days);
    const validInterval = kind === "tip" ? intervalDays === null : Number.isSafeInteger(intervalDays) && intervalDays >= 1 && intervalDays <= 366;
    if (!CREATOR_PRODUCT_KINDS.has(kind) || title.length < 3 || !Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 100000000 || !validInterval) {
      return json(res, 400, { ok: false, error: "creator product invalid" });
    }
    try {
      return json(res, 201, { ok: true, owner_id: auth.user.id, product: repo.createCreatorSupportProduct({ creatorId: auth.user.id, kind, title, priceCents, intervalDays }), real_payment: false });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "POST" && path === "/api/creator/support-intents") {
    const body = await readAuthJson(req);
    const productId = Number(body.product_id);
    if (!exactObject(body, new Set(["product_id"])) || !Number.isSafeInteger(productId) || productId < 1) return json(res, 400, { ok: false, error: "support product invalid" });
    try {
      const intent = repo.createCreatorSupportIntent({ supporterId: auth.user.id, productId });
      return json(res, 201, {
        ok: true,
        intent,
        split_visible: true,
        wallet_confirmation: false,
        real_payment: false,
        economic_effect: intent.status === "excluded_synthetic" ? "ZERO_SYSTEM_TEST" : "ZERO_DEMO_UNPAID",
      });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "GET" && path === "/api/node/status") {
    return json(res, 200, { ok: true, network: repo.getNexusNodeNetworkStatus(auth.user.id), rewards: { enabled: false, funded_pool_cents: 0, raw_traffic_paid: false }, real_nodes_contacted: false });
  }

  if (method === "GET" && path === "/api/node/protocol-contract") {
    return json(res, 200, {
      ok: true,
      protocol: "NEXUS_NODE_PROTOCOL_LOCAL_V1",
      supported_versions: ["1.0.0"],
      roles: [...NODE_SERVICE_ROLES],
      transitions: { D0: "1 active Genesis node + mandatory backup/recovery", D1: "2-7 independently verified nodes, R=min(N,3)", D2: "8-31 nodes with placement and anti-entropy" },
      private_domains_public_dht: false,
      unknown_versions: "DENY",
      endpoint_advertisement: "DISABLED_LOCAL",
    });
  }

  if (method === "POST" && path === "/api/node/manifests") {
    const body = await readAuthJson(req);
    const roles = Array.isArray(body.service_roles) ? [...new Set(body.service_roles.map(String))] : [];
    if (!exactObject(body, new Set(["trust_class", "protocol_version", "service_roles"])) || !NODE_TRUST_CLASSES.has(body.trust_class)
      || body.protocol_version !== "1.0.0" || roles.length < 1 || roles.length > 5 || roles.some((role) => !NODE_SERVICE_ROLES.has(role))) {
      return json(res, 400, { ok: false, error: "node manifest invalid" });
    }
    try {
      const manifest = repo.registerNexusNodeManifest({ operatorUserId: auth.user.id, trustClass: body.trust_class, protocolVersion: body.protocol_version, serviceRoles: roles });
      return json(res, 201, { ok: true, manifest, online: false, verified: false, advertised: false, rewards_eligible: false });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "POST" && path === "/api/node/commitments") {
    const body = await readAuthJson(req);
    const eventCount = Number(body.event_count), rangeStart = Number(body.range_start), rangeEnd = Number(body.range_end);
    if (!exactObject(body, new Set(["node_id", "event_count", "range_start", "range_end", "payload_hash"])) || !/^node-[a-f0-9]{24}$/.test(String(body.node_id || ""))
      || !Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > 1000000 || !Number.isSafeInteger(rangeStart) || rangeStart < 0
      || !Number.isSafeInteger(rangeEnd) || rangeEnd < rangeStart || !/^[a-f0-9]{64}$/.test(String(body.payload_hash || ""))) return json(res, 400, { ok: false, error: "node commitment invalid" });
    try {
      return json(res, 201, { ok: true, commitment: repo.recordNexusNodeCommitment({ operatorUserId: auth.user.id, nodeId: body.node_id, eventCount, rangeStart, rangeEnd, payloadHash: body.payload_hash }), quorum_verified: false, on_chain: false });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  if (method === "POST" && path === "/api/node/checkpoints") {
    const body = await readAuthJson(req);
    const eventFrom = Number(body.event_from), eventTo = Number(body.event_to);
    if (!exactObject(body, new Set(["node_id", "shard_key", "event_from", "event_to", "reducer_version", "state_root", "backup_receipt_hash"]))
      || !/^node-[a-f0-9]{24}$/.test(String(body.node_id || "")) || !/^[a-z0-9:_-]{1,80}$/.test(String(body.shard_key || ""))
      || !Number.isSafeInteger(eventFrom) || eventFrom < 0 || !Number.isSafeInteger(eventTo) || eventTo < eventFrom
      || body.reducer_version !== "1.0.0" || !/^[a-f0-9]{64}$/.test(String(body.state_root || "")) || !/^[a-f0-9]{64}$/.test(String(body.backup_receipt_hash || ""))) {
      return json(res, 400, { ok: false, error: "node checkpoint invalid" });
    }
    try {
      return json(res, 201, { ok: true, checkpoint: repo.createNexusNodeCheckpoint({ operatorUserId: auth.user.id, nodeId: body.node_id, shardKey: body.shard_key, eventFrom, eventTo, reducerVersion: body.reducer_version, stateRoot: body.state_root, backupReceiptHash: body.backup_receipt_hash }), replica_verified: false, on_chain: false });
    } catch (error) { const mapped = mapM12Error(error); if (mapped) return json(res, mapped.status, { ok: false, code: mapped.code, error: mapped.error }); throw error; }
  }

  // Availability is a read-only network check. A free result is not a claim:
  // the user still completes the official MultiversX xAlias transaction.
  if (method === "GET" && path === "/api/mvx-herotag-availability") {
    const name = sanitizeText(url.searchParams.get("name"), 32).replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9]{3,32}$/.test(name)) return json(res, 400, { ok: false, error: "herotag invalid (3-32, litere și cifre)" });
    const network = resolveMvxNetwork();
    const address = await resolveHerotag(name, { apiUrl: network.apiUrl, fetcher });
    return json(res, 200, {
      ok: true,
      herotag: name,
      network: network.label,
      available: !address,
      owner_address: address || null,
      checked_at: new Date().toISOString(),
      claim_required: !address,
    });
  }

  // Nexus never stores or exports a complete private key or seed phrase.
  // Device-wallet recovery stays on the originating device; cross-device
  // recovery is performed by proving ownership through xPortal.
  if (method === "POST" && path === "/api/security/recovery-export/authorize") {
    return json(res, 410, { ok: false, error: "Nexus nu păstrează seed phrase; folosește walletul local sau xPortal" });
  }

  if (method === "POST" && path === "/api/security/recovery-export") {
    return json(res, 410, { ok: false, error: "Nexus nu păstrează seed phrase; folosește walletul local sau xPortal" });
  }

  // Claim / change the Nexus username (unique + not clashing on MultiversX).
  if (method === "POST" && path === "/api/claim-username") {
    const body = await readJson(req);
    const username = sanitizeText(body.username, 30).replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{2,30}$/.test(username)) return json(res, 400, { ok: false, error: "username invalid (2-30, litere/cifre/_)" });

    const clash = await resolveHerotag(username);
    if (clash) return json(res, 409, { ok: false, error: "username coincide cu un herotag MultiversX existent" });

    const result = repo.claimUsername(auth.user.id, username);
    if (!result.ok) return json(res, 409, { ok: false, error: result.error });
    return json(res, 200, { ok: true, owner_id: auth.user.id, username, user: publicUser(result.user) });
  }

  // Link the currently-authenticated account to an xPortal wallet signature.
  if (method === "POST" && path === "/auth/mvx/link") {
    const body = await readAuthJson(req);
    const token = sanitizeText(body.token, 4096);
    const address = sanitizeText(body.address, 80);
    if (!token) return json(res, 400, { ok: false, error: "missing native auth token" });

    let signedAddress;
    try {
      const result = await validateNativeAuthToken(token, { network: resolveMvxNetwork().label });
      signedAddress = result.address;
    } catch {
      return json(res, 401, { ok: false, error: "token NativeAuth invalid sau expirat" });
    }

    if (address && address !== signedAddress) {
      return json(res, 403, { ok: false, error: "adresa nu corespunde semnăturii" });
    }

    const sessionAge = now() - Number(auth.payload?.iat ?? 0);
    if (!Number.isFinite(sessionAge) || sessionAge < 0 || sessionAge > 10 * 60 * 1000) {
      return json(res, 401, { ok: false, error: "reautentifică-te înainte de a schimba walletul de recuperare" });
    }
    if (auth.user.password_hash && !verifyPassword(String(body.current_password ?? ""), auth.user.password_hash)) {
      return json(res, 401, { ok: false, error: "confirmă parola curentă înainte de asocierea xPortal" });
    }
    if (!auth.user.password_hash && signedAddress !== auth.user.mvx_address && signedAddress !== auth.user.linked_wallet) {
      return json(res, 409, { ok: false, error: "schimbarea walletului necesită dovada walletului curent sau un passkey verificat" });
    }

    const linked = repo.setLinkedWallet(auth.user.id, signedAddress);
    if (!linked.ok) return json(res, 409, { ok: false, error: linked.error === "wallet replacement cooldown" ? "așteaptă 15 minute înainte de o nouă schimbare" : "walletul este deja legat de alt cont Nexus" });
    notifyWithInvalidation(repo, sse, auth.user.id, "security", `Wallet xPortal asociat: ${signedAddress.slice(0, 10)}…`);
    return json(res, 200, { ok: true, user: publicUser(linked.user), address: signedAddress });
  }

  // ---- public/persona profile ----
  const publicProfileMatch = path.match(/^\/api\/profiles\/(@?[a-z0-9_-]{2,40})$/i);
  if (method === "GET" && publicProfileMatch) {
    const handle = publicProfileMatch[1].replace(/^@/, "").toLowerCase();
    const target = repo.getUserByHandle(handle);
    const requestedPersona = sanitizeText(url.searchParams.get("persona") ?? auth.persona, 20).toLowerCase();
    if (!target || !PERSONAS.includes(requestedPersona)) return json(res, 404, { ok: false, error: "profile not found" });
    const profile = repo.getPersona(target.id, requestedPersona);
    if (!profile) return json(res, 404, { ok: false, error: "profile not found" });
    const blocked = repo.isBlockedBetween(auth.user.id, auth.persona, target.id, requestedPersona);
    const visible = target.id === auth.user.id || repo.canViewPost(auth.user.id, auth.persona, {
      user_id: target.id,
      persona: requestedPersona,
      visibility: "public",
      status: "active",
    });
    if (!visible) {
      // A discoverable restricted Social identity needs a relationship action,
      // not a fake public profile or an unavailable dead end. Never disclose
      // media, bio, presence, counts or content before the privacy gate allows it.
      if (!blocked && requestedPersona === auth.persona && profile.discoverability === "public"
          && ((requestedPersona === "social" && ["private", "followers", "friends"].includes(profile.visibility))
            || (profile.visibility === "private" && profile.private_access_enabled))) {
        return json(res, 200, { ok: true, locked: true, profile: {
          user_id: target.id, handle: target.handle, persona: requestedPersona, name: profile.name,
          visibility: profile.visibility, is_self: false,
          is_following: repo.isFollowing(auth.user.id, target.id, requestedPersona),
          follow_request_pending: Boolean(repo.pendingFollowRequest(auth.user.id, target.id, requestedPersona)),
          private_access: profile.visibility === "private" && profile.private_access_enabled ? { enabled: true, currency: profile.private_access_currency,
            price_24h_cents: profile.private_access_price_cents,
            price_month_cents: profile.private_access_month_price_cents,
            price_forever_cents: profile.private_access_forever_price_cents } : null,
        }, posts: [], stories: [] });
      }
      return json(res, 404, { ok: false, error: "profile not found" });
    }
    const posts = repo.listPosts({ persona: requestedPersona, userId: target.id, limit: 100 })
      .filter((post) => post.user_id === target.id && post.status === "active" && repo.canViewPost(auth.user.id, auth.persona, post))
      .map((post) => socialPostView(repo, auth, post));
    // The archive is read newest first, so its order says nothing about ranking - but the signals behind
    // a post are the viewer's own, and the profile explains them with the same vocabulary the feed uses
    // ("why am I seeing this" on a profile is a question about the post, not about the order).
    if (posts.length) {
      const explanation = repo.socialRankingReasons(auth.user.id, auth.persona, posts.slice(0, 24).map((post) => post.id));
      for (const post of posts) {
        if (!explanation[post.id]) continue;
        post.ranking = { context: "profile", exploration: false, reasons: explanation[post.id] };
      }
    }
    // The rail shows saved-story albums, so the profile payload carries them: a visitor
    // should not need a second request to see what the owner chose to keep.
    const highlights = requestedPersona === "social"
      ? repo.listStoryHighlights(target.id, auth.user.id, auth.persona).map((highlight) => ({
        id: highlight.id,
        title: highlight.title,
        position: highlight.position,
        stories: highlight.stories.map(storyApiView),
      }))
      : [];
    // Reposts are an internal share: they live on this profile and keep the original post,
    // its counters and its identity, so nothing new is published and no view is doubled.
    const reposts = requestedPersona === "social"
      ? repo.listUserReposts(target.id, requestedPersona, { viewerId: auth.user.id, viewerPersona: auth.persona, limit: 30 })
        .map((entry) => ({
          share_id: entry.share_id,
          reposted_at: entry.reposted_at,
          repost: {
            id: entry.share_id,
            reposter: { id: target.id, handle: target.handle, display_name: profile.name || target.handle, avatar: profile.avatar ?? null },
            reposted_at: entry.reposted_at,
            mine: target.id === auth.user.id,
          },
          post: socialPostView(repo, auth, entry.post),
        }))
      : [];
    const counts = repo.followCounts(target.id, requestedPersona);
    // The age a reader sees is derived from the date of birth the owner chose, at the moment the profile is
    // read: a year that passes is a year this payload already says, with nothing for the owner to edit.
    const derivedAge = deriveAge(profile.birth_date);
    // Shared replies are the second kind of internal share, so the profile lists them the same way
    // it lists reposts: who shared what, and which post it came from.
    const sharedReplies = requestedPersona === "social"
      ? repo.listUserCommentShares(target.id, requestedPersona, { viewerId: auth.user.id, viewerPersona: auth.persona, limit: 30 })
        .map((entry) => ({
          share_id: entry.share_id,
          shared_at: entry.shared_at,
          mine: target.id === auth.user.id,
          comment: entry.comment,
          post: entry.post,
          post_author: entry.post_author,
        }))
      : [];
    const stories = requestedPersona === "social"
      ? repo.listActiveStories(auth.user.id, auth.persona).filter((story) => story.user_id === target.id).map(storyApiView)
      : [];
    return json(res, 200, {
      ok: true,
      profile: {
        user_id: target.id,
        handle: target.handle,
        persona: requestedPersona,
        name: profile.name,
        bio: profile.bio,
        location: profile.location ?? "",
        // The age is part of the identity the profile shows, so the band can print it: derived from the date
        // of birth when the owner chose one, or the whole year a record declared, or nothing at all.
        age: Number.isInteger(derivedAge) ? derivedAge : (Number.isInteger(profile.age) ? profile.age : null),
        // The calendar date itself goes to the owner alone: a reader is shown the age, because a date of
        // birth is a stronger fact about a person than a year, and the field that edits it is the owner's.
        birth_date: target.id === auth.user.id ? (normaliseBirthDate(profile.birth_date) ?? null) : null,
        avatar: profile.avatar,
        cover: profile.cover,
        // The crop travels with the photo: a reader is shown the frame the owner chose, not the middle.
        cover_focus: Number.isInteger(profile.cover_focus) ? Math.min(100, Math.max(0, profile.cover_focus)) : 35,
        // The band choice travels too, so a reader is shown the same surface the owner arranged: the
        // cover photo, or the shelf of saved stories. Anything else reads as the default.
        cover_mode: profile.cover_mode === "stories" ? "stories" : "cover",
        // The order the owner put the five content tabs in travels with the profile, because an arrangement
        // only means something if the next reader sees it: the order is the owner's, the tabs are the product's.
        tabs_order: normaliseTabsOrder(profile.tabs_order),
        orbit_mood: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_mood : null,
        orbit_place: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_place : null,
        orbit_now: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_now : null,
        orbit_fandom: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_fandom : null,
        orbit_quote: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_quote : null,
        orbit_expires_at: Number(profile.orbit_expires_at || 0) > Date.now() ? profile.orbit_expires_at : null,
        earned_sigil: repo.sigilProgress(target.id, requestedPersona),
        visibility: profile.visibility,
        discoverability: profile.discoverability,
        is_self: target.id === auth.user.id,
        is_following: repo.isFollowing(auth.user.id, target.id, requestedPersona),
        follow_request_pending: target.id !== auth.user.id && Boolean(repo.pendingFollowRequest(auth.user.id, target.id, requestedPersona)),
        counts: { ...counts, posts: posts.length, stories: stories.length, reposts: reposts.length, shared_replies: sharedReplies.length },
        highlights,
        presence: repo.profilePresenceForViewer({ viewerId: auth.user.id, viewerPersona: auth.persona, ownerId: target.id, ownerPersona: requestedPersona, ownerVisibility: profile.visibility }),
        private_access: profile.visibility === "private" && profile.private_access_enabled ? { enabled: true, currency: profile.private_access_currency, price_24h_cents: profile.private_access_price_cents, price_month_cents: profile.private_access_month_price_cents, price_forever_cents: profile.private_access_forever_price_cents } : null,
      },
      posts,
      reposts,
      shared_replies: sharedReplies,
      stories,
    });
  }

  // ---- profile settings ----
  // ---- identity onboarding ----
  // An account that never chose a handle is asked once, and the flow can only do what the record
  // shows: claim a free handle, name the persona, set its visibility, write a bio.
  if (method === "GET" && path === "/api/onboarding") {
    return json(res, 200, { ok: true, onboarding: repo.onboardingState(auth.user), personas: PERSONAS });
  }

  if (method === "GET" && path === "/api/onboarding/handle") {
    const requested = String(url.searchParams.get("handle") ?? "").toLowerCase();
    const rate = enforceAuthRate(req, res, "handle-check", requested, { limit: 40, windowMs: 15 * 60 * 1000 });
    if (!rate.allowed) return;
    return json(res, 200, { ok: true, ...repo.handleAvailability(requested, auth.user.id) });
  }

  if (method === "POST" && path === "/api/onboarding") {
    const body = await readJson(req, 16 * 1024);
    const handle = body.handle === undefined || body.handle === null ? null : sanitizeText(body.handle, 30);
    const displayName = sanitizeText(body.display_name, 50);
    const persona = normalizePersona(body.persona ?? auth.persona);
    const visibility = sanitizeText(body.visibility ?? "public", 20);
    const bio = body.bio === undefined ? null : sanitizeText(body.bio, 300);
    if (!displayName) return json(res, 400, { ok: false, error: "display name required" });
    // The same automated safety rule everything else follows: a name or bio that trips it never lands.
    const assessment = assessSocialContent({ text: displayName + "\n" + (bio ?? ""), provenance: "NOT_DECLARED", mediaKind: "text" });
    if (assessment.decision === "BLOCK") {
      return json(res, 422, {
        ok: false, error: "Profilul a fost oprit de o regulă automată de siguranță",
        statement_of_reasons: { policy_version: assessment.policyVersion, reason_codes: assessment.labels.map((label) => label.code), automated_only: true },
      });
    }
    const result = repo.completeOnboarding({ userId: auth.user.id, handle, displayName, persona, visibility, bio });
    if (result.error === "handle_taken") return json(res, 409, { ok: false, code: "HANDLE_TAKEN", error: "herotag Nexus deja folosit" });
    if (result.error === "handle_invalid") return json(res, 400, { ok: false, code: "HANDLE_INVALID", error: "invalid herotag Nexus" });
    if (!result.user) return json(res, 400, { ok: false, error: "onboarding could not be completed" });
    sse.broadcast("profile-changed", { user_id: auth.user.id }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, user: publicUser(result.user), persona: result.persona,
      profile: result.profile ?? repo.getPersona(result.user.id, result.persona),
      onboarding: repo.onboardingState(result.user),
      visibility_changed: false,
    });
  }

  if (method === "PATCH" && path === "/api/profile") {
    const body = await readAuthJson(req);
    const user = repo.updateUserProfile(auth.user.id, {
      displayName: body.display_name !== undefined ? sanitizeText(body.display_name, 50) : undefined,
      bio: body.bio !== undefined ? sanitizeText(body.bio, 300) : undefined,
    });
    return json(res, 200, { ok: true, user: publicUser(user) });
  }

  if (method === "PATCH" && path.startsWith("/api/persona/")) {
    const requestedPersona = path.slice("/api/persona/".length);
    if (!PERSONAS.includes(requestedPersona)) return json(res, 400, { ok: false, error: "invalid persona" });
    if (requestedPersona !== auth.persona) {
      return json(res, 409, { ok: false, code: "ACTIVE_PERSONA_REQUIRED", error: "switch to the requested profile before editing it" });
    }
    const persona = requestedPersona;
    const body = await readAuthJson(req);
    if (Object.prototype.hasOwnProperty.call(body, "identity_sigil") || Object.prototype.hasOwnProperty.call(body, "sigil_color")) {
      return json(res, 403, { ok: false, error: "Nexus Sigil se activează automat; nu poate fi ales sau colorat manual" });
    }
    const visibility = body.visibility === undefined ? undefined : sanitizeText(body.visibility, 20).toLowerCase();
    const discoverability = body.discoverability === undefined ? undefined : sanitizeText(body.discoverability, 20).toLowerCase();
    const messagePolicy = body.message_policy === undefined ? undefined : sanitizeText(body.message_policy, 20).toLowerCase();
    const interfaceLocale = body.interface_locale === undefined ? undefined : sanitizeText(body.interface_locale, 20);
    if (body.content_languages !== undefined && (!Array.isArray(body.content_languages) || body.content_languages.length > 10)) {
      return json(res, 400, { ok: false, error: "content languages invalid" });
    }
    const rawContentLanguages = body.content_languages === undefined
      ? undefined
      : body.content_languages.map((value) => sanitizeText(value, 20));
    if (rawContentLanguages?.some((value) => !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value))) {
      return json(res, 400, { ok: false, error: "content languages invalid" });
    }
    const contentLanguages = rawContentLanguages === undefined ? undefined : [...new Set(rawContentLanguages)];
    const regionCode = body.region_code === undefined ? undefined : sanitizeText(body.region_code, 12).toUpperCase();
    // A profile location is a city name the owner chose, never a coordinate and never a device
    // reading: the field stores what was typed, and the picker only suggests known city names.
    const location = body.location === undefined ? undefined : sanitizeText(body.location, 80);
    // An age is one whole year the owner states about themselves - never derived from a date, a photo or
    // a device reading - and an empty value is a choice: it clears the number instead of refusing it.
    let age;
    if (body.age !== undefined) {
      if (body.age === null || body.age === "") age = null;
      else {
        const parsedAge = Number(body.age);
        if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) return json(res, 400, { ok: false, error: "age invalid" });
        age = parsedAge;
      }
    }
    // The date of birth is the fact that keeps an age true: the owner picks one day from a calendar, and the
    // age is derived from it whenever the profile is read. A day that does not exist, a day in the future
    // and a date that would make the person younger than 13 or older than 120 are all refused.
    let birthDate;
    if (body.birth_date !== undefined) {
      if (body.birth_date === null || body.birth_date === "") birthDate = null;
      else {
        const parsedBirthDate = normaliseBirthDate(body.birth_date);
        if (!parsedBirthDate) return json(res, 400, { ok: false, error: "birth date invalid" });
        const derivedAge = deriveAge(parsedBirthDate);
        if (!Number.isInteger(derivedAge) || derivedAge < 13 || derivedAge > 120) {
          return json(res, 400, { ok: false, error: "birth date out of range" });
        }
        birthDate = parsedBirthDate;
      }
    }
    const profileKind = body.profile_kind === undefined ? undefined : sanitizeText(body.profile_kind, 20).toLowerCase();
    // The one band choice the profile carries: a cover photo (the default) or the shelf of saved
    // stories. It is not a photo and not a post, so it travels as its own whole-word setting.
    const coverMode = body.cover_mode === undefined ? undefined : sanitizeText(body.cover_mode, 12).toLowerCase();
    // The order of the five content tabs. It is one list of ids, and it arrives as a list because the
    // interface moves one tab at a time: anything that is not a list of known ids is refused, so an
    // arrangement is either the owner's or nothing - never a half-written list of duplicates.
    let tabsOrder;
    if (body.tabs_order !== undefined) {
      if (!Array.isArray(body.tabs_order) || body.tabs_order.length < 1 || body.tabs_order.length > PROFILE_TABS.length) {
        return json(res, 400, { ok: false, error: "tabs order invalid" });
      }
      const requestedTabs = body.tabs_order.map((value) => sanitizeText(value, 12).toLowerCase());
      if (requestedTabs.some((id) => !PROFILE_TABS.includes(id)) || new Set(requestedTabs).size !== requestedTabs.length) {
        return json(res, 400, { ok: false, error: "tabs order invalid" });
      }
      tabsOrder = requestedTabs;
    }
    let privateAccess;
    if (body.private_access !== undefined) {
      const priceCents = Number(body.private_access?.price_cents ?? 1500);
      const monthPriceCents = Number(body.private_access?.month_price_cents ?? priceCents * 30);
      const foreverPriceCents = Number(body.private_access?.forever_price_cents ?? priceCents * 365);
      const currency = sanitizeText(body.private_access?.currency ?? "USD", 12).toUpperCase();
      const durationDays = Number(body.private_access?.duration_days ?? 30);
      if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 1000000) return json(res, 400, { ok: false, error: "private access price invalid" });
      if (!Number.isInteger(monthPriceCents) || monthPriceCents < 100 || monthPriceCents > 100000000) return json(res, 400, { ok: false, error: "private access month price invalid" });
      if (!Number.isInteger(foreverPriceCents) || foreverPriceCents < 100 || foreverPriceCents > 1000000000) return json(res, 400, { ok: false, error: "private access forever price invalid" });
      if (!new Set(["USD", "EUR", "USDC", "USDT", "EGLD"]).has(currency)) return json(res, 400, { ok: false, error: "private access currency invalid" });
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) return json(res, 400, { ok: false, error: "private access duration invalid" });
      privateAccess = {
        enabled: body.private_access.enabled === true,
        priceCents,
        monthPriceCents,
        foreverPriceCents,
        currency,
        durationDays,
      };
    }
    let orbitStatus;
    if (body.orbit_status !== undefined) {
      if (!body.orbit_status || typeof body.orbit_status !== "object" || Array.isArray(body.orbit_status)) return json(res, 400, { ok: false, error: "orbit status invalid" });
      const mood = sanitizeText(body.orbit_status.mood, 20).toUpperCase() || null;
      const place = sanitizeText(body.orbit_status.place, 40) || null;
      const watching = sanitizeText(body.orbit_status.now, 60) || null;
      const fandom = sanitizeText(body.orbit_status.fandom, 60) || null;
      const quote = sanitizeText(body.orbit_status.quote, 120) || null;
      const expiresHours = Number(body.orbit_status.expires_hours ?? 24);
      if (mood && !new Set(["JOY", "FOCUSED", "CALM", "LOVE", "DREAMING", "ENERGY", "CHILL", "CURIOUS"]).has(mood)) return json(res, 400, { ok: false, error: "orbit mood invalid" });
      if (!Number.isInteger(expiresHours) || expiresHours < 1 || expiresHours > 168) return json(res, 400, { ok: false, error: "orbit expiry invalid" });
      const hasStatus = Boolean(mood || place || watching || fandom || quote);
      orbitStatus = { mood, place, now: watching, fandom, quote, expiresAt: hasStatus ? Date.now() + expiresHours * 60 * 60 * 1000 : null };
    }
    if (visibility !== undefined && !POST_VISIBILITY.has(visibility)) return json(res, 400, { ok: false, error: "visibility invalid" });
    if (coverMode !== undefined && !PROFILE_COVER_MODES.has(coverMode)) return json(res, 400, { ok: false, error: "cover mode invalid" });
    if (discoverability !== undefined && !new Set(["public", "hidden"]).has(discoverability)) return json(res, 400, { ok: false, error: "discoverability invalid" });
    if (messagePolicy !== undefined && !new Set(["everyone", "requests", "followers", "nobody"]).has(messagePolicy)) return json(res, 400, { ok: false, error: "message policy invalid" });
    if (interfaceLocale !== undefined && interfaceLocale !== "auto" && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(interfaceLocale)) return json(res, 400, { ok: false, error: "locale invalid" });
    if (regionCode !== undefined && regionCode !== "" && !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(regionCode)) return json(res, 400, { ok: false, error: "region invalid" });
    if (body.near_enabled !== undefined && typeof body.near_enabled !== "boolean") return json(res, 400, { ok: false, error: "Near consent invalid" });
    const currentPersona = repo.getPersona(auth.user.id, persona);
    const effectiveRegion = regionCode === undefined ? currentPersona?.region_code : regionCode;
    const effectiveNearEnabled = body.near_enabled === undefined ? Boolean(currentPersona?.near_enabled) : body.near_enabled;
    if (effectiveNearEnabled && !effectiveRegion) return json(res, 400, { ok: false, error: "Near requires an explicit region" });
    if (profileKind !== undefined && !new Set(["personal", "creator", "business"]).has(profileKind)) return json(res, 400, { ok: false, error: "profile kind invalid" });
    let avatar = body.avatar === undefined ? undefined : sanitizeText(body.avatar, 300);
    if (avatar) {
      const match = avatar.match(/^\/media\/([a-f0-9]{64})\.([a-z0-9]{2,8})$/);
      const media = match ? repo.db.prepare(`SELECT * FROM media WHERE hash = ? AND ext = ?`).get(match[1], match[2]) : null;
      if (!media || media.scan_status !== "ready_local_validation" || media.kind !== "image"
          || !repo.hasMediaUploadGrant(media.id, auth.user.id, "profile_avatar", auth.persona)) {
        return json(res, 400, { ok: false, error: "avatar must use your verified profile upload" });
      }
    }
    let cover = body.cover === undefined ? undefined : sanitizeText(body.cover, 300);
    if (cover) {
      const match = cover.match(/^\/media\/([a-f0-9]{64})\.([a-z0-9]{2,8})$/);
      const media = match ? repo.db.prepare(`SELECT * FROM media WHERE hash = ? AND ext = ?`).get(match[1], match[2]) : null;
      if (!media || media.scan_status !== "ready_local_validation" || media.kind !== "image"
          || !repo.hasMediaUploadGrant(media.id, auth.user.id, "profile_cover", auth.persona)) {
        return json(res, 400, { ok: false, error: "cover must use your verified profile image upload" });
      }
    }
    // A crop is a whole percentage: the band is short and the photo is wide, so where the frame sits is
    // part of the cover, not a detail the interface may invent.
    const coverFocus = body.cover_focus === undefined ? undefined : Number(body.cover_focus);
    if (coverFocus !== undefined && (!Number.isInteger(coverFocus) || coverFocus < 0 || coverFocus > 100)) {
      return json(res, 400, { ok: false, error: "cover focus invalid" });
    }
    // A name, a bio or a location is profile text like any other: the same automated safety rule
    // that stops a post stops a profile edit, and the refusal says why.
    const profileText = [body.name, body.bio, body.location].filter((value) => typeof value === "string").join("\n").trim();
    if (profileText) {
      const assessment = assessSocialContent({ text: profileText, provenance: "NOT_DECLARED", mediaKind: "text" });
      if (assessment.decision === "BLOCK") {
        return json(res, 422, {
          ok: false, error: "Profilul a fost oprit de o regulă automată de siguranță",
          statement_of_reasons: { policy_version: assessment.policyVersion, reason_codes: assessment.labels.map((label) => label.code), automated_only: true },
        });
      }
    }
    const row = repo.updatePersona(auth.user.id, persona, {
      name: body.name !== undefined ? sanitizeText(body.name, 50) : undefined,
      bio: body.bio !== undefined ? sanitizeText(body.bio, 300) : undefined,
      location,
      avatar,
      cover,
      coverFocus,
      coverMode,
      tabsOrder,
      age,
      birthDate,
      orbitStatus,
      profileKind,
      visibility,
      discoverability,
      messagePolicy,
      interfaceLocale,
      contentLanguages,
      regionCode,
      nearEnabled: body.near_enabled === undefined ? undefined : body.near_enabled === true,
      privateAccess,
    });
    return json(res, 200, { ok: true, owner_id: auth.user.id, requested_persona: requestedPersona, persona: row });
  }

  if (method === "POST" && path === "/api/persona/switch") {
    const body = await readAuthJson(req);
    const persona = normalizePersona(body.persona);
    repo.updateSessionPersona(auth.tokenHash, persona);
    return json(res, 200, { ok: true, persona });
  }

  // ---- feed / posts ----
  if (method === "GET" && path === "/api/social/live") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const result = repo.listSocialLive(auth.user.id, { limit: 20 });
    return json(res, 200, {
      ok: true,
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      privacy_enforced_server_side: true,
      ...result,
      ranking: "ORGANIC_CONCURRENT_VIEWERS_THEN_QUALIFIED_FOLLOWERS",
      viewer_count_policy: "UNIQUE_ACTIVE_HUMAN_ORGANIC_45S",
      synthetic_traffic_eligible: false,
      transport: { status: "GATED_NO_SFU", public_broadcast: false, provider_configured: false },
      competitions_policy: { scoring: "ORGANIC_ENGAGEMENT_V1", paid_votes: false, prize_escrow_configured: false },
    });
  }

  if (method === "POST" && path === "/api/social/live/preview") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const rate = enforceAuthRate(req, res, "social-live-preview", auth.user.id, { limit: 10, windowMs: 60_000 });
    if (!rate.allowed) return;
    const body = await readAuthJson(req);
    const visibility = sanitizeText(body.visibility ?? "private", 20).toLowerCase();
    const language = sanitizeText(body.language ?? "und", 20).toLowerCase() || "und";
    if (!POST_VISIBILITY.has(visibility)) return json(res, 400, { ok: false, error: "live visibility invalid" });
    const preview = repo.prepareSocialLive(auth.user.id, {
      title: sanitizeText(body.title, 80),
      category: sanitizeText(body.category ?? "creator", 20).toLowerCase(),
      visibility,
      language,
      commentsEnabled: body.comments_enabled !== false,
    });
    if (!preview) return json(res, 400, { ok: false, error: "live title or category invalid" });
    return json(res, 201, {
      ok: true,
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      action: "preview_saved",
      preview,
      public_broadcast: false,
      viewer_counted: false,
      reason: "SFU, moderation and production HTTPS are not configured",
    });
  }

  if (method === "POST" && path === "/api/social/live/competitions") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const rate = enforceAuthRate(req, res, "social-live-competition", auth.user.id, { limit: 5, windowMs: 60_000 });
    if (!rate.allowed) return;
    const body = await readAuthJson(req);
    const startsAtMs = Date.parse(String(body.starts_at ?? ""));
    const competition = repo.createSocialLiveCompetitionDraft({
      ownerId: auth.user.id,
      title: sanitizeText(body.title, 80),
      format: sanitizeText(body.format, 20).toLowerCase(),
      startsAt: Number.isFinite(startsAtMs) ? Math.floor(startsAtMs / 1000) : NaN,
    });
    if (!competition) return json(res, 400, { ok: false, error: "competition draft invalid; start at least 5 minutes in the future" });
    return json(res, 201, {
      ok: true,
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      action: "competition_draft_saved",
      competition,
      published: false,
      prize_escrow_configured: false,
      reason: "Add verified participants, moderation rules and an approved prize escrow before publishing",
    });
  }

  if (method === "GET" && path === "/api/social/search") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const query = sanitizeText(url.searchParams.get("q") ?? "", 80).trim();
    const searchableQuery = query.replace(/^@/, "").replace(/[%_]/g, "").trim();
    const unsafeSearchControls = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
    if (query.length < 2 || searchableQuery.length < 2 || unsafeSearchControls.test(query)) {
      return json(res, 400, { ok: false, code: "SOCIAL_SEARCH_QUERY_INVALID", error: "search query is not safe or specific enough" });
    }
    const cursorRaw = String(url.searchParams.get("cursor") ?? "0");
    if (!/^\d{1,3}$/.test(cursorRaw) || Number(cursorRaw) > 200 || Number(cursorRaw) % 20 !== 0) return json(res, 400, { ok: false, error: "search cursor invalid" });
    const cursor = Number(cursorRaw);
    const rate = enforceAuthRate(req, res, "social-search", auth.user.id, { limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return;
    const result = repo.searchSocial(auth.user.id, { viewerPersona: "social", query, limit: 20, offset: cursor });
    const nextCursor = result.hasMore && cursor + result.limit <= 200 ? String(cursor + result.limit) : null;
    return json(res, 200, {
      ok: true,
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      query,
      cursor: cursorRaw,
      next_cursor: nextCursor,
      scope: "SOCIAL_LOCAL_INDEX_V1",
      production_federated_index: false,
      privacy_enforced_server_side: true,
      synthetic_traffic_eligible: false,
      profiles: result.profiles,
      posts: result.posts.map((post) => socialPostView(repo, auth, post)),
    });
  }

  // Trending counts distinct human accounts, never mentions: it cannot be pushed by repeating a
  // tag from one account, and catalog traffic never appears in it.
  if (method === "GET" && path === "/api/social/tags") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const kind = sanitizeText(url.searchParams.get("kind") ?? "hashtag", 12).toLowerCase();
    if (!new Set(["hashtag", "cashtag"]).has(kind)) return json(res, 400, { ok: false, error: "tag kind invalid" });
    const requestedLimit = Number(url.searchParams.get("limit") ?? 10);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 30 ? requestedLimit : 10;
    const windowSeconds = 3 * 24 * 3600;
    const tags = repo.trendingTags({ kind, sinceSeconds: windowSeconds, limit, minAuthors: 2 });
    return json(res, 200, {
      ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, kind, tags,
      window_hours: windowSeconds / 3600, min_unique_authors: 2,
      ranking: { metric: "unique_human_authors", paid_boosts: false, synthetic_traffic_eligible: false },
    });
  }

  const tagPageMatch = path.match(/^\/api\/social\/tags\/(hashtag|cashtag)\/([^/]{2,120})$/);
  if (method === "GET" && tagPageMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const kind = tagPageMatch[1];
    let tag = "";
    try { tag = decodeURIComponent(tagPageMatch[2]); } catch { return json(res, 400, { ok: false, error: "tag invalid" }); }
    tag = sanitizeText(tag, 50).toLowerCase();
    if (!/^[\p{L}\p{N}_]{2,50}$/u.test(tag)) return json(res, 400, { ok: false, error: "tag invalid" });
    const requestedLimit = Number(url.searchParams.get("limit") ?? 30);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 30 ? requestedLimit : 30;
    const before = url.searchParams.get("before");
    const beforeSeconds = before == null ? null : Number(before);
    if (beforeSeconds !== null && (!Number.isSafeInteger(beforeSeconds) || beforeSeconds <= 0)) return json(res, 400, { ok: false, error: "tag cursor invalid" });
    const page = repo.listPostsByTag(auth.user.id, auth.persona, { kind, tag, limit: limit + 1, before: beforeSeconds });
    const hasMore = page.length > limit;
    const selected = page.slice(0, limit);
    return json(res, 200, {
      ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, kind, tag,
      stats: repo.tagStats(kind, tag),
      posts: selected.map((post) => socialPostView(repo, auth, post)),
      next_before: hasMore && selected.length ? Number(selected[selected.length - 1].created_at) : null,
    });
  }

  if (method === "GET" && path === "/api/social/feed") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const lens = sanitizeText(url.searchParams.get("lens") ?? "for-you", 20).toLowerCase();
    const format = sanitizeText(url.searchParams.get("format") ?? "all", 20).toLowerCase();
    const requestedLimit = Number(url.searchParams.get("limit") ?? 30);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 30 ? requestedLimit : 30;
    if (!SOCIAL_LENSES.has(lens) || !SOCIAL_FORMATS.has(format)) return json(res, 400, { ok: false, error: "feed lens or format invalid" });
    const profile = repo.getPersona(auth.user.id, "social");
    if (!profile) return json(res, 409, { ok: false, error: "Social profile is not initialized" });
    const regionCode = profile.near_enabled ? profile.region_code : null;
    const cursorRaw = url.searchParams.get("cursor");
    const cursorExpected = { viewer_id: auth.user.id, viewer_persona: auth.persona, lens, format, region_code: regionCode };
    const cursor = cursorRaw ? decodeSocialFeedCursor(cursorRaw, cursorExpected) : { seen: [], expires_at: Math.floor(Date.now() / 1000) + SOCIAL_FEED_CURSOR_TTL_SECONDS };
    if (!cursor) return json(res, 400, { ok: false, error: "feed cursor invalid or expired" });
    if (lens === "breaking") {
      // Breaking is an allow-listed aggregator (P9): with nothing approved the answer stays the honest
      // "disabled" one instead of inventing headlines, and with one approved the headlines come from
      // that provider only, cached, with the hosts the client may link to travelling with them.
      const news = await readBreakingNews({ env: process.env });
      return json(res, 200, {
        ok: true,
        viewer_id: auth.user.id,
        viewer_persona: auth.persona,
        lens,
        format,
        cursor: cursorRaw ?? null,
        next_cursor: null,
        posts: [],
        news: news.items,
        provider: news.status === "disabled"
          ? { status: "disabled", reason: news.reason, registry: news.registry }
          : news.provider,
      });
    }
    if (lens === "near" && (!profile.near_enabled || !profile.region_code)) {
      return json(res, 200, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, lens, format, cursor: cursorRaw ?? null, next_cursor: null, posts: [], near: { status: "consent_required", uses_ip_as_nationality: false } });
    }
    const page = repo.listSocialFeed(auth.user.id, {
      viewerPersona: "social",
      lens,
      format,
      limit: limit + 1,
      regionCode,
      excludePostIds: cursor.seen,
    });
    const hasMore = page.length > limit && cursor.seen.length + limit < 300;
    const selected = page.slice(0, limit);
    const posts = selected.map((post) => socialPostView(repo, auth, post));
    const seen = [...new Set([...cursor.seen, ...selected.map((post) => post.id)])];
    const nextCursor = hasMore ? encodeSocialFeedCursor({ ...cursorExpected, seen, expires_at: cursor.expires_at }) : null;
    return json(res, 200, {
      ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, lens, format, limit,
      cursor: cursorRaw ?? null, next_cursor: nextCursor, posts,
      ranking: {
        mode: "local_deterministic_v1",
        exploration_floor_bps: 1000,
        paid_boosts: false,
        synthetic_traffic_eligible: false,
        private_dislikes: true,
        public_reasons: true,
      },
    });
  }

  if (method === "POST" && path === "/api/social/impressions") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req, 64 * 1024);
    // A thread page can carry replies only, so an empty post batch is a valid request.
    const requestedPosts = Array.isArray(body.entries) ? body.entries : [];
    const result = requestedPosts.length
      ? repo.recordSocialImpressions(auth.user.id, "social", requestedPosts)
      : { requested: 0, recorded: 0, recorded_post_ids: [] };
    // Reply impressions travel with the same request: a thread that is read is measured
    // the same way a timeline is, without inventing a second endpoint.
    const requestedComments = Array.isArray(body.comment_entries) ? body.comment_entries : [];
    const commentResult = requestedComments.length ? repo.recordCommentImpressions(auth.user.id, "social", requestedComments) : null;
    if (!result || (requestedComments.length && !commentResult)) return json(res, 400, { ok: false, error: "impressions must be a unique bounded list" });
    return json(res, 202, { ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona, ...result, comment_result: commentResult, organic_public_metric: false });
  }

  const socialFeedbackMatch = path.match(/^\/api\/social\/posts\/(\d+)\/feedback$/);
  if (method === "POST" && socialFeedbackMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req, 16 * 1024);
    if (body.kind !== "NOT_INTERESTED" || typeof body.active !== "boolean") return json(res, 400, { ok: false, error: "feedback shape invalid" });
    if (!repo.setSocialFeedback(auth.user.id, "social", Number(socialFeedbackMatch[1]), body.kind, body.active)) return json(res, 404, { ok: false, error: "post not available" });
    return json(res, 200, {
      ok: true, post_id: Number(socialFeedbackMatch[1]), actor_id: auth.user.id,
      actor_persona: auth.persona, private: true, kind: body.kind, active: body.active,
    });
  }

  if (method === "POST" && path === "/api/social/recommendations/reset") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const state = repo.resetSocialRecommendations(auth.user.id, "social");
    return json(res, 200, { ok: true, version: state.version, reset_at: state.reset_at, reactions_deleted: false });
  }

  if (method === "POST" && path === "/api/social/moderation/reconsider") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req, 32 * 1024);
    const caption = sanitizeText(body.caption, 2000);
    const revisedCaption = sanitizeText(body.revised_caption ?? body.caption, 2000);
    const kind = ["text", "image", "video"].includes(body.kind) ? body.kind : null;
    const provenance = normalizeProvenance(body.provenance);
    const reason = sanitizeText(body.reason, 500);
    if (!caption || !revisedCaption || !kind || !provenance || reason.length < 8) return json(res, 400, { ok: false, error: "reconsideration shape invalid" });
    const assessment = assessSocialContent({ text: revisedCaption, provenance, mediaKind: kind });
    const contentHash = sha256Hex(JSON.stringify({ original: sha256Hex(caption), revised: sha256Hex(revisedCaption), kind, provenance }));
    const outcome = assessment.decision === "BLOCK" ? "BLOCK_CONFIRMED_CURRENT_POLICY" : "REVISION_ELIGIBLE_FOR_RESUBMISSION";
    const reconsideration = repo.recordPrepublicationReconsideration({
      userId: auth.user.id, contentHash, reason, outcome, assessmentHash: assessment.assessmentHash,
    });
    return json(res, 200, {
      ok: true, reconsideration, may_publish: assessment.decision !== "BLOCK",
      requires_explicit_resubmission: true,
      statement_of_reasons: {
        policy_version: assessment.policyVersion,
        decision: assessment.decision,
        reason_codes: assessment.labels.map((label) => label.code),
        automated_only: true,
      },
    });
  }

  if (method === "GET" && (path === "/api/feed" || path === "/api/posts")) {
    const persona = normalizePersona(url.searchParams.get("persona") ?? auth.persona);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const posts = persona === "social"
      ? repo.listSocialFeed(auth.user.id, { viewerPersona: auth.persona, lens: "for-you", format: path === "/api/feed" ? "following" : "all", limit })
      : (path === "/api/feed" ? repo.feedForUser(auth.user.id, { persona, limit }) : repo.listPosts({ persona, limit }));
    const enriched = posts.map((post) => persona === "social"
      ? { ...socialPostView(repo, auth, post), liked_by_me: repo.hasLiked(auth.user.id, post.id), like_count: repo.likeCount(post.id) }
      : { ...post, liked_by_me: repo.hasLiked(auth.user.id, post.id), like_count: repo.likeCount(post.id), comment_count: repo.listComments(post.id, { viewerId: auth.user.id, viewerPersona: auth.persona, limit: 1000 }).length });
    return json(res, 200, { ok: true, posts: enriched });
  }

  if (method === "POST" && path === "/api/posts") {
    const body = await readAuthJson(req);
    const requestedPersona = body.persona === undefined ? auth.persona : sanitizeText(body.persona, 20);
    if (requestedPersona !== auth.persona) return json(res, 403, { ok: false, error: "active profile does not match post profile" });
    const persona = auth.persona;
    let kind = ["text", "image", "video"].includes(body.kind) ? body.kind : "text";
    const caption = sanitizeText(body.caption, 2000);
    const visibility = sanitizeText(body.visibility ?? "public", 20).toLowerCase();
    const language = body.language ? sanitizeText(body.language, 20) : null;
    const regionCode = body.region_code ? sanitizeText(body.region_code, 12).toUpperCase() : null;
    const provenance = normalizeProvenance(body.provenance);
    if (!POST_VISIBILITY.has(visibility)) return json(res, 400, { ok: false, error: "visibility invalid" });
    if (language && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) return json(res, 400, { ok: false, error: "language invalid" });
    if (regionCode && !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(regionCode)) return json(res, 400, { ok: false, error: "region invalid" });
    if (!provenance) return json(res, 400, { ok: false, error: "provenance invalid" });

    let mediaId = null;
    if (body.media_hash && body.media_ext) {
      const m = repo.db.prepare("SELECT * FROM media WHERE hash = ?").get(body.media_hash);
      if (m?.scan_status === "ready_local_validation" && m.ext === body.media_ext && repo.hasMediaUploadGrant(m.id, auth.user.id, "social_post", auth.persona)) mediaId = m.id;
    }

    // A post can carry an ordered gallery: up to ten images, or one video on its own. Every item
    // must be a verified upload owned by this account, so a post can never claim media that
    // belongs to someone else.
    const mediaIds = [];
    if (Array.isArray(body.media_items)) {
      const items = body.media_items.slice(0, 10);
      if (!items.length) return json(res, 400, { ok: false, error: "verified media upload required" });
      for (const item of items) {
        const hash = sanitizeText(item?.hash, 64).toLowerCase();
        const ext = sanitizeText(item?.ext, 8).toLowerCase();
        const row = /^[a-f0-9]{64}$/.test(hash) ? repo.db.prepare("SELECT * FROM media WHERE hash = ? AND ext = ?").get(hash, ext) : null;
        if (!row || row.scan_status !== "ready_local_validation" || !repo.hasMediaUploadGrant(row.id, auth.user.id, "social_post", auth.persona)) {
          return json(res, 400, { ok: false, error: "verified media upload required" });
        }
        if (row.kind !== "image" && row.kind !== "video") return json(res, 400, { ok: false, error: "unsupported media kind" });
        mediaIds.push(row.id);
      }
      if (new Set(mediaIds).size !== mediaIds.length) return json(res, 400, { ok: false, error: "duplicate media in post" });
      const kinds = mediaIds.map((id) => repo.db.prepare("SELECT kind FROM media WHERE id = ?").get(id)?.kind);
      if (kinds.filter((entry) => entry === "video").length > 1) return json(res, 400, { ok: false, error: "one video per post" });
      if (kinds.includes("video") && mediaIds.length > 1) return json(res, 400, { ok: false, error: "a video post carries one media" });
      mediaId = mediaIds[0];
      kind = kinds.includes("video") ? "video" : "image";
    }
    if (kind !== "text" && !mediaId) return json(res, 400, { ok: false, error: "uploaded media required" });
    if (kind === "text" && !caption) return json(res, 400, { ok: false, error: "text post cannot be empty" });
    let audioMediaId = null;
    if (body.audio_hash || body.audio_ext) {
      const audioHash = sanitizeText(body.audio_hash, 64).toLowerCase();
      const audioExt = sanitizeText(body.audio_ext, 8).toLowerCase();
      const audio = /^[a-f0-9]{64}$/.test(audioHash)
        ? repo.db.prepare("SELECT * FROM media WHERE hash = ? AND ext = ?").get(audioHash, audioExt)
        : null;
      if (!audio || audio.kind !== "audio" || audio.scan_status !== "ready_local_validation" || !repo.hasMediaUploadGrant(audio.id, auth.user.id, "social_audio", auth.persona)) {
        return json(res, 400, { ok: false, error: "verified creator audio upload required" });
      }
      audioMediaId = audio.id;
    }
    if (audioMediaId && kind === "text") return json(res, 400, { ok: false, error: "creator audio requires image or video" });
    let studioManifest;
    let creatorAudio;
    try {
      studioManifest = normalizeCreatorStudio(body.studio_manifest ?? null, { mediaKind: kind });
      creatorAudio = normalizeCreatorAudio({
        audioMediaId,
        rights: body.audio_rights == null ? null : sanitizeText(body.audio_rights, 40),
        attribution: sanitizeText(body.audio_attribution, 120),
      });
    } catch (err) {
      return json(res, 400, { ok: false, error: err.message });
    }
    const assessment = assessSocialContent({ text: caption, provenance, mediaKind: kind });
    if (assessment.decision === "BLOCK") {
      return json(res, 422, {
        ok: false,
        error: "Publicarea a fost oprită de o regulă automată de siguranță",
        prepublication_reconsideration_available: true,
        reconsideration_endpoint: "/api/social/moderation/reconsider",
        statement_of_reasons: {
          policy_version: assessment.policyVersion,
          reason_codes: assessment.labels.filter((label) => label.basis === "LOCAL_TEXT_RULE").map((label) => label.code),
          automated_only: true,
        },
      });
    }
    let responsePayload;
    db.exec("BEGIN IMMEDIATE");
    try {
      const post = repo.createPost({
        userId: auth.user.id, persona, kind, caption, mediaId, visibility, language, regionCode, provenance,
        mediaEdit: studioManifest, audioMediaId: creatorAudio.audioMediaId,
        audioRights: creatorAudio.rights, audioAttribution: creatorAudio.attribution,
      });
      // The gallery and the tags belong to the same write as the post: a post can never claim
      // a tag or a media item it does not really have.
      if (mediaIds.length) repo.setPostMedia(post.id, mediaIds, { transaction: false });
      repo.setPostTags(post.id, extractPostTags(caption), { transaction: false });
      const storedAssessment = repo.saveContentAssessment("post", post.id, post.content_commitment, assessment);
      repo.appendModerationEvent({
        subjectType: "post", subjectId: post.id, actorKind: "AUTOMATION",
        action: "CONTENT_ASSESSED", reasonCode: assessment.decision,
        metadata: { assessmentHash: storedAssessment.assessmentHash, enforcementChanged: false },
      });
      const proof = devnetActionProof({ actor: auth.user.handle, action: `publish:${persona}`, payloadHash: sha256Hex(`${post.id}:${caption}`) });
      repo.setPostDevnetTx(post.id, proof.txHash, proof.explorerUrl, auth.user.id, auth.user.handle);
      const full = repo.getPostById(post.id);
      responsePayload = {
        ok: true,
        owner_id: auth.user.id,
        owner_persona: auth.persona,
        action: "post_published",
        post: socialPostView(repo, auth, full),
        chain: { status: "not_submitted", value: 0 },
        local_intent_proof: proof,
      };
      const responseBody = Buffer.from(JSON.stringify(responsePayload));
      const responseHeaders = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "content-length": responseBody.length,
      };
      const completed = completeMutationRecord({ db, mutationId: req.nexusMutationId, status: 201, headers: responseHeaders, body: responseBody });
      if (completed.changes !== 1) throw new Error("POST_MUTATION_COMPLETION_INVARIANT_FAILED");
      db.prepare(`INSERT INTO outbox_events
        (aggregate_type, aggregate_id, event_type, payload_json, status, available_at)
        VALUES ('post', ?, 'social.post.published', ?, 'pending', unixepoch())`)
        .run(String(post.id), JSON.stringify({ postId: post.id }));
      if (typeof ctx.beforePostCommit === "function") ctx.beforePostCommit({ postId: post.id });
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      if (new Set(["CREATOR_STUDIO_SOURCE_MEDIA_INVALID", "CREATOR_AUDIO_SOURCE_MEDIA_REQUIRED", "CREATOR_AUDIO_MEDIA_INVALID"]).has(err.message)) {
        return json(res, 400, { ok: false, error: err.message });
      }
      throw err;
    }
    return json(res, 201, responsePayload);
  }

  const postEditMatch = path.match(/^\/api\/posts\/(\d+)$/);
  if (method === "PATCH" && postEditMatch) {
    const id = Number(postEditMatch[1]);
    const current = repo.getPostById(id);
    if (!current || current.user_id !== auth.user.id || current.persona !== auth.persona || current.status !== "active") {
      return json(res, 404, { ok: false, error: "post not found" });
    }
    const body = await readAuthJson(req);
    const hasCaption = Object.prototype.hasOwnProperty.call(body, "caption");
    const hasVisibility = Object.prototype.hasOwnProperty.call(body, "visibility");
    if (!hasCaption && !hasVisibility) return json(res, 400, { ok: false, error: "no editable fields supplied" });
    const caption = hasCaption ? sanitizeText(body.caption, 2000) : current.caption;
    const visibility = hasVisibility ? sanitizeText(body.visibility, 20).toLowerCase() : current.visibility;
    if (!POST_VISIBILITY.has(visibility)) return json(res, 400, { ok: false, error: "visibility invalid" });
    if (!caption && !current.media_id) return json(res, 400, { ok: false, error: "text post cannot be empty" });
    const assessment = assessSocialContent({ text: caption, provenance: current.provenance, mediaKind: current.kind });
    if (assessment.decision === "BLOCK") {
      return json(res, 422, {
        ok: false, error: "Editarea a fost oprită de o regulă automată de siguranță",
        prepublication_reconsideration_available: true,
        reconsideration_endpoint: "/api/social/moderation/reconsider",
        statement_of_reasons: {
          policy_version: assessment.policyVersion,
          reason_codes: assessment.labels.filter((label) => label.basis === "LOCAL_TEXT_RULE").map((label) => label.code),
          automated_only: true,
        },
      });
    }
    let edited;
    try {
      edited = repo.editPost({ id, userId: auth.user.id, actorPersona: auth.persona, caption, visibility });
    } catch (error) {
      if (error.message === "POST_EDIT_CONFLICT") return json(res, 409, { ok: false, error: "post changed; reload and retry" });
      throw error;
    }
    if (!edited) return json(res, 404, { ok: false, error: "post not found" });
    // An edit changes what the post says, so the tags are re-read from the new caption.
    repo.setPostTags(edited.id, extractPostTags(caption));
    const storedAssessment = repo.saveContentAssessment("post", edited.id, edited.content_commitment, assessment);
    repo.appendModerationEvent({
      subjectType: "post", subjectId: edited.id, actorKind: "AUTOMATION",
      action: "CONTENT_ASSESSED_AFTER_EDIT", reasonCode: assessment.decision,
      metadata: { assessmentHash: storedAssessment.assessmentHash, version: edited.version, enforcementChanged: false },
    });
    sse.broadcast("post-edited", { post_id: id, version: edited.version }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, action: "post_edited", owner_id: auth.user.id, owner_persona: auth.persona,
      version: edited.version, history_preserved: true, post: socialPostView(repo, auth, edited),
    });
  }

  // A pin is the owner's own arrangement of their archive: it puts a post at the top of the profile, it
  // changes nothing about the post, and three pins are the whole allowance - a profile that pins
  // everything pins nothing. Only the owner of the post may pin it.
  const postPinMatch = path.match(/^\/api\/posts\/(\d+)\/pin$/);
  if (method === "POST" && postPinMatch) {
    const body = await readAuthJson(req);
    if (typeof body.pinned !== "boolean") return json(res, 400, { ok: false, error: "pinned must be a boolean" });
    const result = repo.setPostPinned(Number(postPinMatch[1]), auth.user.id, auth.persona, body.pinned);
    if (!result) return json(res, 404, { ok: false, error: "post not found" });
    if (result.error === "pin_limit") return json(res, 409, { ok: false, code: "PIN_LIMIT", error: "three pinned posts is the limit" });
    sse.broadcast(body.pinned ? "post-pinned" : "post-unpinned", { post_id: Number(postPinMatch[1]) }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true,
      action: body.pinned ? "post_pinned" : "post_unpinned",
      pinned: body.pinned,
      post: socialPostView(repo, auth, result.post),
    });
  }

  const postArchiveMatch = path.match(/^\/api\/posts\/(\d+)\/archive$/);
  if (method === "POST" && postArchiveMatch) {
    const id = Number(postArchiveMatch[1]);
    let archived;
    try {
      archived = repo.archivePost(id, auth.user.id, auth.persona);
    } catch (error) {
      if (error.message === "POST_ARCHIVE_CONFLICT") return json(res, 409, { ok: false, error: "post changed; reload and retry" });
      throw error;
    }
    if (!archived) return json(res, 404, { ok: false, error: "post not found" });
    sse.broadcast("post-archived", { post_id: id, version: archived.version }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, action: "post_archived", post_id: id, actor_id: auth.user.id,
      actor_persona: auth.persona, status: archived.status, version: archived.version, history_preserved: true,
    });
  }

  const postHistoryMatch = path.match(/^\/api\/posts\/(\d+)\/history$/);
  if (method === "GET" && postHistoryMatch) {
    const id = Number(postHistoryMatch[1]);
    const history = repo.postHistory(id, auth.user.id, auth.persona);
    if (!history) return json(res, 404, { ok: false, error: "post not found" });
    return json(res, 200, {
      ok: true, post_id: id, owner_id: auth.user.id, owner_persona: auth.persona,
      immutable_history: true, versions: history,
    });
  }

  if (method === "DELETE" && postEditMatch) {
    const id = Number(postEditMatch[1]);
    let withdrawn;
    try {
      withdrawn = repo.deletePost(id, auth.user.id, auth.persona);
    } catch (error) {
      if (error.message === "POST_WITHDRAW_CONFLICT") return json(res, 409, { ok: false, error: "post changed; reload and retry" });
      throw error;
    }
    if (!withdrawn) return json(res, 404, { ok: false, error: "post not found" });
    sse.broadcast("post-withdrawn", { post_id: id, version: withdrawn.version }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, action: "post_withdrawn", post_id: id, actor_id: auth.user.id,
      actor_persona: auth.persona, status: "withdrawn", version: withdrawn.version,
      thread_preserved: true, history_preserved: true, public_content_removed: true,
    });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/like$/)) {
    const id = Number(path.split("/")[3]);
    const body = await readJson(req);
    const active = body.active !== false;
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const summary = repo.setPostReaction(auth.user.id, auth.persona, id, "LIKE", active);
    return json(res, 200, {
      ok: true, post_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      reaction: "LIKE", active: summary.viewer_reaction === "LIKE", ...summary,
      liked_by_me: summary.viewer_reaction === "LIKE",
    });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/reaction$/)) {
    const id = Number(path.split("/")[3]);
    const body = await readJson(req);
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const requestedKind = sanitizeText(body.kind, 30).toUpperCase();
    const kind = requestedKind === "FAKE" ? "FAKE_OPINION" : requestedKind;
    if (!SOCIAL_REACTIONS.includes(kind)) return json(res, 400, { ok: false, error: "reaction invalid" });
    const active = body.active === undefined ? true : body.active === true;
    const summary = repo.setPostReaction(auth.user.id, auth.persona, id, kind, active);
    // Reactions are invalidations, not data broadcasts. Broad persona channels
    // would reveal private post existence and blocked-user activity.
    sse.broadcast("post-reaction-changed", { post_id: id }, [...new Set([channelForUser(post.user_id), channelForUser(auth.user.id)])]);
    return json(res, 200, {
      ok: true, post_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      reaction: kind, active: summary.viewer_reaction === kind, ...summary,
      semantics: kind === "FAKE_OPINION" ? "community_opinion_not_fact_check" : "reaction",
    });
  }

  // The post page: what opens when a tweet card is tapped. It returns the post itself plus
  // the reply thread with its own counters, so the reader never leaves the conversation.
  if (method === "GET" && path.match(/^\/api\/posts\/\d+$/)) {
    const id = Number(path.split("/")[3]);
    const post = repo.getPostById(id);
    if (!post || post.persona !== "social" || !repo.canViewPost(auth.user.id, auth.persona, post)) {
      return json(res, 404, { ok: false, error: "post not found" });
    }
    const sort = sanitizeText(url.searchParams.get("sort") ?? "relevant", 20).toLowerCase();
    if (!new Set(["relevant", "newest", "oldest"]).has(sort)) return json(res, 400, { ok: false, error: "reply sort invalid" });
    const cursor = Number(url.searchParams.get("cursor") ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > 2000 || cursor % 20 !== 0) return json(res, 400, { ok: false, error: "reply cursor invalid" });
    const page = repo.listCommentPage(id, { viewerId: auth.user.id, viewerPersona: auth.persona, sort, offset: cursor, rootLimit: 20 });
    const canPin = Number(post.user_id) === Number(auth.user.id) && post.persona === auth.persona;
    const commentIds = page.comments.map((comment) => Number(comment.id));
    const bulk = {
      shares: repo.commentShareSummariesBulk(commentIds, auth.user.id, auth.persona),
      parents: repo.commentParentAuthors(commentIds),
    };
    // The post page answers the same "why am I seeing this" question the card answers, so it carries the
    // same signals: the reasons the reader's own feed would state for this post.
    const explanation = repo.socialRankingReasons(auth.user.id, auth.persona, [id])[id] ?? [];
    const postView = socialPostView(repo, auth, post);
    postView.ranking = { context: "post", exploration: explanation.includes("exploration_new"), reasons: explanation };
    return json(res, 200, {
      ok: true, post_id: id, viewer_id: auth.user.id, viewer_persona: auth.persona,
      post: postView,
      sort, cursor: String(cursor),
      next_cursor: page.hasMore ? String(cursor + 20) : null,
      root_count: page.rootCount,
      comments: page.comments.map((comment) => commentThreadView(repo, auth, comment, canPin, bulk)),
      muted_author: repo.isMuted(auth.user.id, auth.persona, post.user_id),
      note_requests: repo.communityNoteRequestState("post", id, auth.user.id, auth.persona),
      // The writer of a note needs to know how much of today's allowance is left before writing.
      note_quota: repo.communityNoteQuota(auth.user.id, auth.persona),
      relevance: sort === "relevant" ? "pinned, reactions, replies, recency; account size is not a signal" : null,
    });
  }

  if (method === "GET" && path.match(/^\/api\/posts\/\d+\/comments$/)) {
    const id = Number(path.split("/")[3]);
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const sort = sanitizeText(url.searchParams.get("sort") ?? "relevant", 20).toLowerCase();
    if (!new Set(["relevant", "newest", "oldest"]).has(sort)) return json(res, 400, { ok: false, error: "comment sort invalid" });
    const cursor = Number(url.searchParams.get("cursor") ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > 2000 || cursor % 20 !== 0) return json(res, 400, { ok: false, error: "comment cursor invalid" });
    const page = repo.listCommentPage(id, { viewerId: auth.user.id, viewerPersona: auth.persona, sort, offset: cursor, rootLimit: 20 });
    const canPin = Number(post.user_id) === Number(auth.user.id) && post.persona === auth.persona;
    const commentIds = page.comments.map((comment) => Number(comment.id));
    const bulk = {
      shares: repo.commentShareSummariesBulk(commentIds, auth.user.id, auth.persona),
      parents: repo.commentParentAuthors(commentIds),
    };
    const comments = page.comments
      .map((comment) => commentThreadView(repo, auth, comment, canPin, bulk));
    return json(res, 200, {
      ok: true,
      post_id: id,
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      comments,
      sort,
      cursor: String(cursor),
      next_cursor: page.hasMore ? String(cursor + 20) : null,
      root_count: page.rootCount,
      relevance: sort === "relevant" ? "pinned, reactions, replies, recency; account size is not a signal" : null,
    });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/comments$/)) {
    const id = Number(path.split("/")[3]);
    const body = await readJson(req);
    const commentBody = sanitizeText(body.body, 1000);
    if (!commentBody) return json(res, 400, { ok: false, error: "empty comment" });
    const assessment = assessSocialContent({ text: commentBody, provenance: "NOT_DECLARED", mediaKind: "text" });
    if (assessment.decision === "BLOCK") return json(res, 422, {
      ok: false, error: "Comentariul a fost oprit de o regulă automată de siguranță",
      statement_of_reasons: { policy_version: assessment.policyVersion, reason_codes: assessment.labels.map((label) => label.code), automated_only: true },
    });
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const parentId = body.parent_id === undefined || body.parent_id === null ? null : Number(body.parent_id);
    if (parentId !== null && (!Number.isSafeInteger(parentId) || parentId < 1)) return json(res, 400, { ok: false, error: "parent comment invalid" });
    let comment;
    try {
      comment = repo.addSocialComment({ userId: auth.user.id, actorPersona: auth.persona, postId: id, body: commentBody, parentId });
    } catch (error) {
      if (error?.message === "SOCIAL_COMMENT_PARENT_INVALID") return json(res, 400, { ok: false, error: "parent comment invalid" });
      throw error;
    }
    const storedAssessment = repo.saveContentAssessment("comment", comment.id, comment.content_commitment, assessment);
    repo.appendModerationEvent({
      subjectType: "comment", subjectId: comment.id, actorKind: "AUTOMATION",
      action: "CONTENT_ASSESSED", reasonCode: assessment.decision,
      metadata: { assessmentHash: storedAssessment.assessmentHash, enforcementChanged: false },
    });
    const commentView = repo.listComments(id, { viewerId: auth.user.id, viewerPersona: auth.persona, limit: 500 })
      .find((entry) => Number(entry.id) === Number(comment.id)) ?? comment;
    sse.broadcast("comment-changed", { post_id: id }, [...new Set([channelForUser(post.user_id), channelForUser(auth.user.id)])]);
    return json(res, 201, {
      ok: true, post_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      parent_id: parentId, comment: { ...commentView, reactions: { counts: {}, viewer_reaction: null } },
    });
  }

  const commentItemMatch = path.match(/^\/api\/comments\/(\d+)$/);
  if (method === "PATCH" && commentItemMatch) {
    const commentId = Number(commentItemMatch[1]);
    const existing = repo.getCommentById(commentId);
    const post = existing ? repo.getPostById(existing.post_id) : null;
    if (!existing || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment not found" });
    if (Number(existing.user_id) !== Number(auth.user.id) || existing.actor_persona !== auth.persona) return json(res, 403, { ok: false, error: "only the comment author can edit it" });
    const body = await readJson(req);
    const text = sanitizeText(body.body, 1000);
    if (!text) return json(res, 400, { ok: false, error: "empty comment" });
    const assessment = assessSocialContent({ text, provenance: "NOT_DECLARED", mediaKind: "text" });
    if (assessment.decision === "BLOCK") return json(res, 422, {
      ok: false, error: "Comentariul editat a fost oprit de o regulă automată de siguranță",
      statement_of_reasons: { policy_version: assessment.policyVersion, reason_codes: assessment.labels.map((label) => label.code), automated_only: true },
    });
    let edited;
    try { edited = repo.editSocialComment({ commentId, userId: auth.user.id, actorPersona: auth.persona, body: text }); }
    catch (error) {
      if (error?.message === "SOCIAL_COMMENT_EDIT_CONFLICT") return json(res, 409, { ok: false, error: "comment changed; refresh and retry" });
      throw error;
    }
    if (!edited) return json(res, 409, { ok: false, error: "comment is not editable" });
    const storedAssessment = repo.saveContentAssessment("comment", edited.id, edited.content_commitment, assessment);
    repo.appendModerationEvent({
      subjectType: "comment", subjectId: edited.id, actorKind: "AUTHOR", action: "CONTENT_EDITED",
      reasonCode: assessment.decision, metadata: { version: edited.version, assessmentHash: storedAssessment.assessmentHash, enforcementChanged: false },
    });
    sse.broadcast("comment-changed", { post_id: post.id }, [...new Set([channelForUser(post.user_id), channelForUser(auth.user.id)])]);
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: post.id, actor_id: auth.user.id,
      actor_persona: auth.persona, comment: edited, edited: true, history_preserved: true,
    });
  }

  if (method === "DELETE" && commentItemMatch) {
    const commentId = Number(commentItemMatch[1]);
    const existing = repo.getCommentById(commentId);
    const post = existing ? repo.getPostById(existing.post_id) : null;
    if (!existing || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment not found" });
    if (Number(existing.user_id) !== Number(auth.user.id) || existing.actor_persona !== auth.persona) return json(res, 403, { ok: false, error: "only the comment author can withdraw it" });
    const withdrawn = repo.withdrawSocialComment({ commentId, userId: auth.user.id, actorPersona: auth.persona });
    if (!withdrawn) return json(res, 409, { ok: false, error: "comment cannot be withdrawn" });
    repo.appendModerationEvent({
      subjectType: "comment", subjectId: withdrawn.id, actorKind: "AUTHOR", action: "CONTENT_WITHDRAWN",
      reasonCode: "AUTHOR_WITHDRAWAL", metadata: { tombstone: true, historyPreserved: true, enforcementChanged: false },
    });
    sse.broadcast("comment-changed", { post_id: post.id }, [...new Set([channelForUser(post.user_id), channelForUser(auth.user.id)])]);
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: post.id, actor_id: auth.user.id,
      actor_persona: auth.persona, comment: { ...withdrawn, body: "" },
      tombstone: true, history_preserved: true,
    });
  }

  const commentPinMatch = path.match(/^\/api\/comments\/(\d+)\/pin$/);
  if (method === "POST" && commentPinMatch) {
    const commentId = Number(commentPinMatch[1]);
    const body = await readJson(req, 8 * 1024);
    if (typeof body.active !== "boolean") return json(res, 400, { ok: false, error: "pin state invalid" });
    const result = repo.pinSocialComment({ commentId, ownerId: auth.user.id, ownerPersona: auth.persona, active: body.active });
    if (!result) return json(res, 404, { ok: false, error: "comment not found" });
    sse.broadcast("comment-changed", { post_id: result.post.id }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, action: body.active ? "comment_pinned" : "comment_unpinned",
      comment_id: commentId, post_id: result.post.id, actor_id: auth.user.id,
      actor_persona: auth.persona, pinned: Boolean(result.comment.pinned_at),
    });
  }

  const commentVersionsMatch = path.match(/^\/api\/comments\/(\d+)\/versions$/);
  if (method === "GET" && commentVersionsMatch) {
    const commentId = Number(commentVersionsMatch[1]);
    const comment = repo.getCommentById(commentId);
    const post = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || Number(comment.user_id) !== Number(auth.user.id) || comment.actor_persona !== auth.persona
        || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment history not found" });
    return json(res, 200, { ok: true, versions: repo.listCommentVersions(commentId, auth.user.id) });
  }

  const commentReportMatch = path.match(/^\/api\/comments\/(\d+)\/report$/);
  if (method === "POST" && commentReportMatch) {
    const commentId = Number(commentReportMatch[1]);
    const comment = repo.getCommentById(commentId);
    const post = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment not found" });
    const body = await readJson(req, 16 * 1024);
    const category = sanitizeText(body.category, 40).toUpperCase();
    const details = sanitizeText(body.details, 500);
    if (!REPORT_CATEGORIES.includes(category)) return json(res, 400, { ok: false, error: "report category invalid" });
    const report = repo.createModerationReport({
      reporterId: auth.user.id, reporterPersona: auth.persona, subjectType: "comment", subjectId: commentId, category, details,
    });
    return json(res, 201, {
      ok: true, subject_type: "comment", subject_id: commentId,
      reporter_id: auth.user.id, reporter_persona: auth.persona,
      report: { id: report.id, category: report.category, status: report.status, outcome: report.outcome, reason_code: report.reason_code },
      content_removed: false,
    });
  }

  const trustMatch = path.match(/^\/api\/social\/posts\/(\d+)\/trust$/);
  if (method === "GET" && trustMatch) {
    const postId = Number(trustMatch[1]);
    const post = repo.getPostById(postId);
    if (post?.persona !== "social" || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    socialPostView(repo, auth, post);
    const assessment = repo.getContentAssessment("post", post.id, post.content_commitment);
    const reports = repo.listModerationReportsByReporter(auth.user.id, "post", post.id).slice(0, 100).map((report) => ({
      id: report.id, category: report.category, status: report.status, outcome: report.outcome,
      reason_code: report.reason_code, created_at: report.created_at, resolved_at: report.resolved_at,
    }));
    return json(res, 200, {
      ok: true, post_id: postId, viewer_id: auth.user.id, viewer_persona: auth.persona,
      privacy_enforced_server_side: true, assessment, my_reports: reports,
      can_appeal: post.user_id === auth.user.id,
      methodology: {
        no_truth_score: true,
        community_fake_is_opinion: true,
        automated_only: true,
        visual_classifier_configured: false,
        report_alone_removes_content: false,
      },
    });
  }

  const reportMatch = path.match(/^\/api\/social\/posts\/(\d+)\/report$/);
  if (method === "POST" && reportMatch) {
    const post = repo.getPostById(Number(reportMatch[1]));
    if (post?.persona !== "social" || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const body = await readJson(req, 16 * 1024);
    const category = sanitizeText(body.category, 40).toUpperCase();
    const details = sanitizeText(body.details, 500);
    if (!REPORT_CATEGORIES.includes(category)) return json(res, 400, { ok: false, error: "report category invalid" });
    const report = repo.createModerationReport({
      reporterId: auth.user.id, reporterPersona: auth.persona, subjectType: "post", subjectId: post.id, category, details,
    });
    return json(res, 201, {
      ok: true,
      subject_type: "post", subject_id: post.id,
      reporter_id: auth.user.id, reporter_persona: auth.persona,
      report: { id: report.id, category: report.category, status: report.status, outcome: report.outcome, reason_code: report.reason_code },
      enforcement_changed: false,
      statement: "Raportul a fost evaluat automat. Un raport individual nu elimină conținutul.",
    });
  }

  const appealMatch = path.match(/^\/api\/social\/posts\/(\d+)\/appeal$/);
  if (method === "POST" && appealMatch) {
    const postId = Number(appealMatch[1]);
    const post = repo.getPostById(postId);
    if (auth.persona !== "social" || post?.persona !== "social" || Number(post.user_id) !== Number(auth.user.id)
        || !repo.canViewPost(auth.user.id, auth.persona, post)) {
      return json(res, 404, { ok: false, error: "appealable assessment not found" });
    }
    const body = await readJson(req, 16 * 1024);
    const reason = sanitizeText(body.reason, 500);
    if (reason.length < 8) return json(res, 400, { ok: false, error: "appeal reason too short" });
    const currentAssessment = repo.getContentAssessment("post", postId, post.content_commitment);
    if (!currentAssessment) return json(res, 404, { ok: false, error: "appealable assessment not found" });
    const appeal = repo.appealContentAssessment({ appellantId: auth.user.id, subjectType: "post", subjectId: postId, reason });
    if (!appeal) return json(res, 404, { ok: false, error: "appealable assessment not found" });
    return json(res, 201, {
      ok: true,
      subject_type: "post", subject_id: postId,
      appellant_id: auth.user.id, appellant_persona: auth.persona,
      appeal: {
        id: appeal.id, status: appeal.status, outcome: appeal.outcome, reason_code: appeal.reason_code,
        policy_version: currentAssessment.policyVersion, assessment_hash: currentAssessment.assessmentHash,
      },
      restriction_changed: false, author_disputed: true,
      statement_of_reasons: {
        automated_only: true, human_review_performed: false, restriction_changed: false,
        label_status: appeal.outcome, policy_version: currentAssessment.policyVersion,
      },
    });
  }

  if (method === "GET" && path === "/api/social/moderation/integrity") {
    return json(res, 200, {
      ok: true,
      internal_link_consistency: repo.verifyModerationEventChain(),
      storage: "LOCAL_OFF_CHAIN",
      authenticated_completeness: false,
      trusted_external_checkpoint: false,
      on_chain_anchor: false,
    });
  }

  if (method === "POST" && path.match(/^\/api\/comments\/\d+\/reaction$/)) {
    const commentId = Number(path.split("/")[3]);
    const comment = repo.getCommentById(commentId);
    const post = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment not found" });
    const body = await readJson(req);
    const requestedKind = sanitizeText(body.kind, 30).toUpperCase();
    const kind = requestedKind === "FAKE" ? "FAKE_OPINION" : requestedKind;
    if (!SOCIAL_REACTIONS.includes(kind) || kind === "DISLIKE") return json(res, 400, { ok: false, error: "comment reaction invalid" });
    const active = body.active === undefined ? true : body.active === true;
    const summary = repo.setCommentReaction(auth.user.id, auth.persona, commentId, kind, active);
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: comment.post_id,
      actor_id: auth.user.id, actor_persona: auth.persona,
      reaction: kind, active: summary.viewer_reaction === kind, ...summary,
    });
  }

  if (method === "POST" && path.match(/^\/api\/comments\/\d+\/save$/)) {
    const commentId = Number(path.split("/")[3]);
    const comment = repo.getCommentById(commentId);
    const post = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "comment not found" });
    const body = await readJson(req);
    const active = body.active === undefined ? true : body.active === true;
    const saved = repo.setSavedComment(auth.user.id, auth.persona, commentId, active);
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: comment.post_id,
      actor_id: auth.user.id, actor_persona: auth.persona, saved, private: true,
    });
  }

  // Mute sits next to block but is deliberately weaker: nothing is revoked, the account
  // simply stops being a candidate for this viewer.
  if (method === "POST" && path === "/api/profile/mute") {
    const body = await readJson(req);
    const targetId = Number(body.user_id);
    if (!Number.isSafeInteger(targetId) || targetId < 1 || targetId === auth.user.id || !repo.getUserById(targetId)) return json(res, 400, { ok: false, error: "invalid target" });
    const active = body.active === undefined ? true : body.active === true;
    const result = repo.setProfileMute(auth.user.id, auth.persona, targetId, active, { scope: body.scope === "topic" ? "topic" : "account", topic: body.topic });
    if (!result) return json(res, 400, { ok: false, error: "invalid mute scope" });
    sse.broadcast("relationship-changed", { target_id: targetId }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, active,
      muted: result.muted, scope: result.scope, topic: result.topic,
      block_active: repo.isAccountBlockedBetween(auth.user.id, targetId),
    });
  }

  // ---- community notes ----
  const noteCreateMatch = path.match(/^\/api\/social\/posts\/(\d+)\/notes$/);
  if (method === "POST" && noteCreateMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const postId = Number(noteCreateMatch[1]);
    const post = repo.getPostById(postId);
    if (!post || post.persona !== "social" || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const quota = repo.communityNoteQuota(auth.user.id, auth.persona);
    if (quota.notes_left <= 0) return json(res, 429, { ok: false, error: "note quota reached for today", quota });
    const body = await readJson(req, 16 * 1024);
    const noteBody = sanitizeText(body.body, 600);
    const assessment = assessSocialContent({ text: noteBody, provenance: "NOT_DECLARED", mediaKind: "text" });
    if (assessment.decision === "BLOCK") {
      return json(res, 422, {
        ok: false, error: "Nota a fost oprită de o regulă automată de siguranță",
        statement_of_reasons: { policy_version: assessment.policyVersion, reason_codes: assessment.labels.map((label) => label.code), automated_only: true },
      });
    }
    const created = repo.createCommunityNote({
      subjectType: "post", subjectId: postId, authorId: auth.user.id, authorPersona: auth.persona,
      body: noteBody, sources: Array.isArray(body.sources) ? body.sources : [],
    });
    if (created.error === "author_cannot_note_own_post") return json(res, 403, { ok: false, error: "the author of the post cannot add a note to it" });
    if (created.error === "note_body_invalid") return json(res, 400, { ok: false, error: "note body must be 12 to 600 characters" });
    if (created.error === "note_already_exists") return json(res, 409, { ok: false, error: "you already wrote a note on this post", note_id: created.noteId });
    if (!created.note) return json(res, 400, { ok: false, error: "note invalid" });
    return json(res, 201, {
      ok: true, note: created.note, quota: repo.communityNoteQuota(auth.user.id, auth.persona),
      visibility_changed: false, enforced_facts: false,
      statement: "Nota explică postarea. Nu schimbă vizibilitatea ei și nu publică nimic până nu e evaluată ca utilă din perspective diferite.",
    });
  }

  const noteRateMatch = path.match(/^\/api\/social\/notes\/(\d+)\/rate$/);
  if (method === "POST" && noteRateMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const noteId = Number(noteRateMatch[1]);
    const note = repo.communityNoteById(noteId);
    if (!note) return json(res, 404, { ok: false, error: "note not found" });
    const subjectPost = note.subject_type === "post" ? repo.getPostById(Number(note.subject_id)) : null;
    if (!subjectPost || !repo.canViewPost(auth.user.id, auth.persona, subjectPost)) return json(res, 404, { ok: false, error: "note not found" });
    const quota = repo.communityNoteQuota(auth.user.id, auth.persona);
    if (quota.ratings_left <= 0) return json(res, 429, { ok: false, error: "rating quota reached for today", quota });
    const body = await readJson(req, 8 * 1024);
    if (typeof body.helpful !== "boolean") return json(res, 400, { ok: false, error: "rating must be helpful true or false" });
    const rated = repo.rateCommunityNote({ noteId, raterId: auth.user.id, raterPersona: auth.persona, helpful: body.helpful });
    if (rated.error === "author_cannot_rate_own_note") return json(res, 403, { ok: false, error: "you cannot rate your own note" });
    if (rated.error === "note_not_found") return json(res, 404, { ok: false, error: "note not found" });
    if (!rated.note) return json(res, 400, { ok: false, error: "rating rejected" });
    return json(res, 200, {
      ok: true, note: rated.note, status: rated.status, previous_status: rated.previous_status,
      perspective: rated.perspective, quota: repo.communityNoteQuota(auth.user.id, auth.persona),
      visibility_changed: false,
    });
  }

  const noteWithdrawMatch = path.match(/^\/api\/social\/notes\/(\d+)\/withdraw$/);
  if (method === "POST" && noteWithdrawMatch) {
    const withdrawn = repo.withdrawCommunityNote({ noteId: Number(noteWithdrawMatch[1]), userId: auth.user.id, actorPersona: auth.persona });
    if (withdrawn.error) return json(res, 404, { ok: false, error: "note not found" });
    return json(res, 200, { ok: true, note: withdrawn.note, visibility_changed: false });
  }

  // A shared reply is an internal share: the reply keeps its author, its post and its counters, and
  // nothing new is published. The route mirrors the post repost route on purpose, so one reader
  // learns one rule.
  const commentShareMatch = path.match(/^\/api\/comments\/(\d+)\/share$/);
  if (method === "POST" && commentShareMatch) {
    const commentId = Number(commentShareMatch[1]);
    const existing = repo.getCommentById(commentId);
    const post = existing ? repo.getPostById(existing.post_id) : null;
    if (!existing || existing.status !== "active" || !post || !repo.canViewPost(auth.user.id, auth.persona, post)) {
      return json(res, 404, { ok: false, error: "comment not found" });
    }
    const body = await readJson(req, 8 * 1024);
    const active = body.active === undefined ? true : body.active === true;
    const summary = repo.setCommentShare(auth.user.id, auth.persona, commentId, active);
    sse.broadcast("comment-share-changed", { post_id: post.id, comment_id: commentId }, [...new Set([channelForUser(existing.user_id), channelForUser(auth.user.id)])]);
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: post.id, actor_id: auth.user.id, actor_persona: auth.persona,
      active: summary.shared_by_me, shares: summary.shares, shared_by_me: summary.shared_by_me,
      internal_share: true, visibility_changed: false,
    });
  }

  // The deep link: "open this reply" needs the post it belongs to and the chain it answers, and the
  // reader must not be able to open a reply they could not read in the thread.
  const commentContextMatch = path.match(/^\/api\/comments\/(\d+)\/context$/);
  if (method === "GET" && commentContextMatch) {
    const commentId = Number(commentContextMatch[1]);
    const comment = repo.getCommentById(commentId);
    const post = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || comment.status !== "active" || !post || !repo.canViewPost(auth.user.id, auth.persona, post)) {
      return json(res, 404, { ok: false, error: "comment not found" });
    }
    const chain = [];
    let current = comment;
    const seen = new Set([commentId]);
    while (Number(current.parent_id || 0) && chain.length < 5) {
      const parent = repo.getCommentById(Number(current.parent_id));
      if (!parent || seen.has(Number(parent.id))) break;
      seen.add(Number(parent.id));
      const author = repo.getUserById(Number(parent.user_id));
      const profile = author ? repo.getPersona(Number(parent.user_id), parent.actor_persona) : null;
      chain.unshift({
        id: Number(parent.id), handle: author?.handle ?? null,
        display_name: profile?.name || author?.display_name || author?.handle || null,
        withdrawn: parent.status === "withdrawn",
      });
      current = parent;
    }
    return json(res, 200, {
      ok: true, comment_id: commentId, post_id: Number(post.id),
      root_comment_id: chain.length ? Number(chain[0].id) : commentId,
      chain, parent: chain.length ? chain[chain.length - 1] : null,
      replies_path: "/api/posts/" + Number(post.id) + "/comments",
      share: repo.commentShareSummary(commentId, auth.user.id, auth.persona),
    });
  }

  const noteRequestMatch = path.match(/^\/api\/social\/posts\/(\d+)\/note-request$/);
  const commentNoteRequestMatch = path.match(/^\/api\/comments\/(\d+)\/note-request$/);
  if (method === "POST" && commentNoteRequestMatch) {
    const commentId = Number(commentNoteRequestMatch[1]);
    const comment = repo.getCommentById(commentId);
    const commentPost = comment ? repo.getPostById(comment.post_id) : null;
    if (!comment || !commentPost || !repo.canViewPost(auth.user.id, auth.persona, commentPost)) return json(res, 404, { ok: false, error: "comment not found" });
    const body = await readJson(req, 16 * 1024);
    const state = repo.requestCommunityNote({
      subjectType: "comment", subjectId: commentId, requesterId: auth.user.id,
      requesterPersona: auth.persona, reason: sanitizeText(body.reason, 300),
    });
    if (!state) return json(res, 400, { ok: false, error: "note request invalid" });
    return json(res, 201, {
      ok: true, subject_type: "comment", subject_id: commentId, post_id: comment.post_id,
      requester_id: auth.user.id, requester_persona: auth.persona,
      ...state, enforcement_changed: false, note_published: false,
      statement: "Cererea a fost înregistrată pentru contribuitori. Nu schimbă vizibilitatea răspunsului și nu publică nimic automat.",
    });
  }
  if (method === "POST" && noteRequestMatch) {
    const postId = Number(noteRequestMatch[1]);
    const post = repo.getPostById(postId);
    if (!post || post.persona !== "social" || !repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const body = await readJson(req, 16 * 1024);
    const state = repo.requestCommunityNote({
      subjectType: "post", subjectId: postId, requesterId: auth.user.id,
      requesterPersona: auth.persona, reason: sanitizeText(body.reason, 300),
    });
    if (!state) return json(res, 400, { ok: false, error: "note request invalid" });
    return json(res, 201, {
      ok: true, subject_type: "post", subject_id: postId,
      requester_id: auth.user.id, requester_persona: auth.persona,
      ...state, enforcement_changed: false, note_published: false,
      statement: "Cererea a fost înregistrată pentru contribuitori. Nu schimbă vizibilitatea postării și nu publică nimic automat.",
    });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/save$/)) {
    const id = Number(path.split("/")[3]);
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const body = await readJson(req);
    const active = body.active === undefined ? true : body.active === true;
    repo.setSavedPost(auth.user.id, auth.persona, id, active);
    return json(res, 200, {
      ok: true, post_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      saved: repo.hasSavedPost(auth.user.id, auth.persona, id), private: true,
    });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/share$/)) {
    return json(res, 409, { ok: false, error: "sharing is disabled; Nexus interactions stay internal", feature: "SOCIAL_SHARE", enabled: false });
  }

  if (method === "POST" && path.match(/^\/api\/posts\/\d+\/repost$/)) {
    const id = Number(path.split("/")[3]);
    const post = repo.getPostById(id);
    if (!repo.canViewPost(auth.user.id, auth.persona, post)) return json(res, 404, { ok: false, error: "post not found" });
    const body = await readJson(req);
    const active = body.active !== false;
    const summary = repo.setPostRepost(auth.user.id, auth.persona, id, active);
    return json(res, 200, {
      ok: true, post_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      active: summary.reposted_by_me, ...summary,
    });
  }

  // ---- follow ----
  if (method === "GET" && path === "/api/follow/requests") {
    const direction = sanitizeText(url.searchParams.get("direction") ?? "incoming", 12).toLowerCase();
    if (!new Set(["incoming", "outgoing"]).has(direction)) return json(res, 400, { ok: false, error: "follow request direction invalid" });
    return json(res, 200, {
      ok: true,
      viewer_id: auth.user.id,
      direction,
      persona: auth.persona,
      requests: repo.listFollowRequests(auth.user.id, { persona: auth.persona, direction, limit: 80 }),
    });
  }

  const followDecisionMatch = path.match(/^\/api\/follow\/requests\/(\d+)\/decision$/);
  if (method === "POST" && followDecisionMatch) {
    const body = await readJson(req);
    const decision = sanitizeText(body.decision, 12).toLowerCase();
    try {
      const request = repo.decideFollowRequest({ requestId: Number(followDecisionMatch[1]), targetId: auth.user.id, persona: auth.persona, decision });
      sse.broadcast("follow-request-changed", { request_id: request.id }, [channelForUser(request.requester_id), channelForUser(request.target_id)]);
      return json(res, 200, { ok: true, decision, request_id: request.id, actor_id: auth.user.id, actor_persona: auth.persona, requester_id: request.requester_id, target_id: request.target_id, active: decision === "accept" });
    } catch (error) {
      if (error?.message === "SOCIAL_FOLLOW_DECISION_INVALID") return json(res, 400, { ok: false, error: "follow decision invalid" });
      if (new Set(["SOCIAL_FOLLOW_REQUEST_NOT_FOUND", "SOCIAL_FOLLOW_REQUEST_CONFLICT"]).has(error?.message)) return json(res, 404, { ok: false, error: "follow request not found" });
      throw error;
    }
  }

  if (method === "POST" && path === "/api/follow") {
    const body = await readJson(req);
    const targetId = Number(body.user_id);
    const persona = normalizePersona(body.persona ?? auth.persona);
    if (!targetId || targetId === auth.user.id || persona !== auth.persona) return json(res, 400, { ok: false, error: "invalid target or active profile" });
    const target = repo.getUserById(targetId);
    const targetProfile = target ? repo.getPersona(targetId, persona) : null;
    if (!targetProfile || repo.isBlockedBetween(auth.user.id, auth.persona, targetId, persona)) return json(res, 404, { ok: false, error: "profile not found" });
    const active = body.active !== false;
    if (!active) {
      repo.setFollow(auth.user.id, targetId, persona, false);
      const counts = repo.followCounts(targetId, persona);
      sse.broadcast("follow-changed", { target_id: targetId }, [channelForUser(auth.user.id), channelForUser(targetId)]);
      return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, target_persona: persona, active: false, request_pending: false, counts });
    }
    if (targetProfile.visibility === "private") {
      let request;
      try { request = repo.requestFollow(auth.user.id, targetId, persona); }
      catch (error) {
        if (new Set(["SOCIAL_FOLLOW_BLOCKED", "SOCIAL_FOLLOW_TARGET_INVALID"]).has(error?.message)) return json(res, 404, { ok: false, error: "profile not found" });
        throw error;
      }
      if (request.already_following) {
        const counts = repo.followCounts(targetId, persona);
        return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, target_persona: persona, active: true, request_pending: false, counts });
      }
      sse.broadcast("follow-request-changed", { request_id: request.id }, [channelForUser(auth.user.id), channelForUser(targetId)]);
      return json(res, 202, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, target_persona: persona, active: false, request_pending: true, request_id: request.id });
    }
    try { repo.setFollow(auth.user.id, targetId, persona, true); }
    catch (error) {
      if (new Set(["SOCIAL_FOLLOW_BLOCKED", "SOCIAL_FOLLOW_TARGET_INVALID"]).has(error?.message)) return json(res, 404, { ok: false, error: "profile not found" });
      throw error;
    }
    const counts = repo.followCounts(targetId, persona);
    const proof = devnetActionProof({ actor: auth.user.handle, action: "follow", payloadHash: sha256Hex(`${auth.user.id}:${targetId}:${persona}`) });
    repo.recordDevnetAction({ userId: auth.user.id, actor: auth.user.handle, action: "follow", payloadHash: proof.txHash, txHash: proof.txHash, explorerUrl: proof.explorerUrl });
    sse.broadcast("follow-changed", { target_id: targetId }, [channelForUser(auth.user.id), channelForUser(targetId)]);
    return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, target_persona: persona, active: true, request_pending: false, counts, devnet: proof });
  }

  if (method === "GET" && path === "/api/follows") {
    const persona = normalizePersona(url.searchParams.get("persona") ?? auth.persona);
    if (persona !== auth.persona) return json(res, 409, { ok: false, error: "switch to that profile first" });
    const counts = repo.followCounts(auth.user.id, persona);
    return json(res, 200, { ok: true, ...counts });
  }

  if (method === "GET" && path === "/api/social/relations") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const kind = sanitizeText(url.searchParams.get("kind") ?? "followers", 20).toLowerCase();
    if (!new Set(["followers", "following", "favorites"]).has(kind)) return json(res, 400, { ok: false, error: "relation kind invalid" });
    const cursorRaw = String(url.searchParams.get("cursor") ?? "0");
    if (!/^\d{1,3}$/.test(cursorRaw) || Number(cursorRaw) > 400 || Number(cursorRaw) % 40 !== 0) return json(res, 400, { ok: false, error: "relation cursor invalid" });
    const cursor = Number(cursorRaw);
    const sourceKind = kind === "favorites" ? "following" : kind;
    const page = repo.listSocialRelations(auth.user.id, { kind: sourceKind, persona: "social", limit: 40, offset: cursor });
    return json(res, 200, {
      ok: true,
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      kind,
      cursor: cursorRaw,
      next_cursor: page.hasMore && cursor + page.limit <= 400 ? String(cursor + page.limit) : null,
      people: page.people.map((person) => ({ ...person, relation: kind === "favorites" ? "following" : person.relation })),
      favorites_source: "client_local_until_cross_device_graph",
    });
  }

  if (method === "GET" && path === "/api/social/private-access/quote") {
    const ownerId = Number(url.searchParams.get("owner_id"));
    const requestedPersona = url.searchParams.get("persona") ?? "social";
    const durationDays = Number(url.searchParams.get("days") ?? 15);
    const term = sanitizeText(url.searchParams.get("term") ?? "custom", 12);
    const accessKind = url.searchParams.get("kind") ?? "private_content";
    if (!Number.isSafeInteger(ownerId) || ownerId < 1) return json(res, 400, { ok: false, error: "owner invalid" });
    if (!PERSONAS.includes(requestedPersona) || requestedPersona !== auth.persona) return json(res, 409, { ok: false, error: "switch to the target profile first" });
    if (!new Set(["custom", "24h", "1month", "forever"]).has(term) || (term === "custom" && (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 365))) return json(res, 400, { ok: false, error: "duration invalid" });
    if (!new Set(["private_content", "visitor_reveal"]).has(accessKind)) return json(res, 400, { ok: false, error: "access kind invalid" });
    const persona = requestedPersona;
    const revealVisitor = accessKind === "visitor_reveal";
    const quote = repo.privateAccessQuote({ viewerId: auth.user.id, ownerId, persona, durationDays, term, revealVisitor });
    if (!quote) return json(res, 404, { ok: false, error: "private access unavailable" });
    return json(res, 200, {
      ok: true,
      quote,
      policy: {
        owner_visibility: "Owner sees aggregate revenue only, not visitor username",
        visitor_reveal: "Reveal requests cost double and produce reciprocal access only; unilateral stalking is not allowed",
        split: { creator_percent: 90, nexus_percent: 10 },
        real_payment: "disabled_in_demo",
      },
    });
  }

  if (method === "POST" && path === "/api/social/private-access/demo-receipt") {
    const body = await readAuthJson(req);
    const ownerId = Number(body.owner_id);
    const requestedPersona = body.persona ?? "social";
    const durationDays = Number(body.duration_days ?? 15);
    const term = sanitizeText(body.term ?? "custom", 12);
    const accessKind = body.kind ?? "private_content";
    if (!Number.isSafeInteger(ownerId) || ownerId < 1) return json(res, 400, { ok: false, error: "owner invalid" });
    if (!PERSONAS.includes(requestedPersona) || requestedPersona !== auth.persona) return json(res, 409, { ok: false, error: "switch to the target profile first" });
    if (!new Set(["custom", "24h", "1month", "forever"]).has(term) || (term === "custom" && (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 365))) return json(res, 400, { ok: false, error: "duration invalid" });
    if (!new Set(["private_content", "visitor_reveal"]).has(accessKind)) return json(res, 400, { ok: false, error: "access kind invalid" });
    const persona = requestedPersona;
    const revealVisitor = accessKind === "visitor_reveal";
    const result = repo.createPrivateAccessDemoReceipt({ viewerId: auth.user.id, ownerId, persona, durationDays, term, revealVisitor });
    if (!result) return json(res, 404, { ok: false, error: "private access unavailable" });
    return json(res, 201, {
      ok: true,
      ...result,
      settlement_status: "demo_unpaid_no_real_funds",
      access_status: "preview_only_until_real_payment_settlement",
    });
  }

  if (method === "GET" && path === "/api/social/private-content") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const result = repo.listPrivateContentForViewer(auth.user.id, { persona: "social", limit: Number(url.searchParams.get("limit") ?? 30) });
    return json(res, 200, {
      ok: true,
      receipts: result.receipts.map((receipt) => ({
        id: receipt.id,
        owner_id: receipt.owner_id,
        handle: receipt.handle,
        name: receipt.name,
        avatar: receipt.avatar,
        expires_at: receipt.expires_at,
        status: receipt.status,
        privacy_mode: receipt.privacy_mode,
      })),
      posts: result.posts.map((post) => publicPost(repo, post, auth)),
      demo_policy: "demo_unpaid receipts show preview content only until real settlement exists",
    });
  }

  if (method === "POST" && path === "/api/profile/block") {
    const body = await readJson(req);
    const targetId = Number(body.user_id);
    if (!Number.isSafeInteger(targetId) || targetId < 1 || targetId === auth.user.id || !repo.getUserById(targetId)) return json(res, 400, { ok: false, error: "invalid target" });
    const active = body.active === undefined ? true : body.active === true;
    repo.setProfileBlock(auth.user.id, auth.persona, targetId, active);
    sse.broadcast("relationship-changed", { target_id: targetId }, [channelForUser(auth.user.id), channelForUser(targetId)]);
    return json(res, 200, { ok: true, actor_id: auth.user.id, actor_persona: auth.persona, target_id: targetId, active });
  }

  // ---- stories ----
  if (method === "GET" && path === "/api/stories") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const storyState = sanitizeText(url.searchParams.get("state") ?? "all", 12).toLowerCase();
    if (!new Set(["all", "unseen", "viewed"]).has(storyState)) return json(res, 400, { ok: false, error: "story state invalid" });
    const stories = repo.listActiveStories(auth.user.id, auth.persona, Math.floor(Date.now() / 1000), 100, storyState).map(storyApiView);
    return json(res, 200, {
      ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona,
      state: storyState, stories,
    });
  }

  if (method === "POST" && path.match(/^\/api\/stories\/\d+\/view$/)) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const id = Number(path.split("/")[3]);
    const body = await readJson(req);
    const progress = Number(body.progress ?? 0);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) return json(res, 400, { ok: false, error: "story progress invalid" });
    const view = repo.recordStoryView(id, auth.user.id, auth.persona, progress, body.completed === true);
    if (!view) return json(res, 404, { ok: false, error: "story not found" });
    return json(res, 200, {
      ok: true, actor_id: auth.user.id, actor_persona: auth.persona,
      requested_progress: progress, requested_completed: body.completed === true, ...view,
    });
  }

  if (method === "POST" && path === "/api/stories") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req);
    const caption = sanitizeText(body.caption, 500);
    const visibility = sanitizeText(body.visibility ?? "followers", 20).toLowerCase();
    if (!POST_VISIBILITY.has(visibility)) return json(res, 400, { ok: false, error: "visibility invalid" });
    let mediaId = null;
    if (body.media_hash) {
      const media = repo.db.prepare(`SELECT * FROM media WHERE hash = ?`).get(sanitizeText(body.media_hash, 64));
      if (media?.scan_status === "ready_local_validation" && repo.hasMediaUploadGrant(media.id, auth.user.id, "story", auth.persona)) mediaId = media.id;
    }
    if (!mediaId && !caption) return json(res, 400, { ok: false, error: "story requires media or text" });
    const persistent = body.persistent === true;
    const durationHours = persistent ? null : Number(body.duration_hours ?? 24);
    if (!persistent && (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24 * 365)) return json(res, 400, { ok: false, error: "story duration must be 1 hour to 365 days or persistent" });
    const expiresAt = persistent ? null : Math.floor(Date.now() / 1000) + Math.floor(durationHours * 3600);
    const story = repo.createStory({ userId: auth.user.id, persona: "social", mediaId, caption, visibility, expiresAt });
    // A Story can be followers/friends/private. Publish only an owner-scoped
    // invalidation; other viewers refresh through the Privacy Matrix.
    sse.broadcast("story-changed", { story_id: story.id }, [channelForUser(auth.user.id)]);
    return json(res, 201, {
      ok: true,
      action: "story_published",
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      story: storyApiView(story),
      lifecycle: persistent ? "persistent_until_archived" : "expires",
    });
  }

  if (method === "POST" && path.match(/^\/api\/stories\/\d+\/archive$/)) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const id = Number(path.split("/")[3]);
    if (!repo.archiveStory(id, auth.user.id, auth.persona)) return json(res, 404, { ok: false, error: "story not found" });
    sse.broadcast("story-changed", { story_id: id }, [channelForUser(auth.user.id)]);
    return json(res, 200, {
      ok: true, story_id: id, actor_id: auth.user.id, actor_persona: auth.persona,
      status: "archived",
    });
  }

  if (method === "GET" && path === "/api/stories/archive") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    return json(res, 200, {
      ok: true,
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      stories: repo.listArchivedStories(auth.user.id, auth.persona, 200).map(storyApiView),
    });
  }

  if (method === "POST" && path === "/api/story-highlights") {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req);
    const title = sanitizeText(body.title, 40);
    if (!title) return json(res, 400, { ok: false, error: "highlight title required" });
    const highlight = repo.createStoryHighlight({ ownerId: auth.user.id, actorPersona: auth.persona, title });
    if (!highlight) return json(res, 409, { ok: false, error: "highlight limit reached" });
    return json(res, 201, {
      ok: true,
      action: "story_highlight_created",
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      highlight: { id: highlight.id, title: highlight.title, position: highlight.position, stories: [] },
    });
  }

  const highlightItemMatch = path.match(/^\/api\/story-highlights\/(\d+)\/items$/);
  if (method === "POST" && highlightItemMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const body = await readJson(req);
    const storyId = Number(body.story_id);
    if (!Number.isSafeInteger(storyId) || storyId < 1) return json(res, 400, { ok: false, error: "story id invalid" });
    const result = repo.addStoryToHighlight({ highlightId: Number(highlightItemMatch[1]), storyId, ownerId: auth.user.id, actorPersona: auth.persona });
    if (!result) return json(res, 404, { ok: false, error: "highlight or owned story not found" });
    return json(res, result.added ? 201 : 200, {
      ok: true,
      action: "story_highlight_item_added",
      owner_id: auth.user.id,
      owner_persona: auth.persona,
      highlight_id: result.highlight.id,
      story: storyApiView(result.story),
      added: result.added,
    });
  }

  const publicHighlightsMatch = path.match(/^\/api\/profiles\/([a-z0-9_]{2,30})\/highlights$/);
  if (method === "GET" && publicHighlightsMatch) {
    if (auth.persona !== "social") return json(res, 409, { ok: false, error: "switch to Social profile first" });
    const owner = repo.getUserByHandle(publicHighlightsMatch[1]);
    if (!owner) return json(res, 404, { ok: false, error: "profile not found" });
    const highlights = repo.listStoryHighlights(owner.id, auth.user.id, auth.persona).map((highlight) => ({
      id: highlight.id,
      title: highlight.title,
      position: highlight.position,
      stories: highlight.stories.map(storyApiView),
    }));
    return json(res, 200, {
      ok: true,
      owner_id: owner.id,
      owner_handle: owner.handle,
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      privacy_enforced_server_side: true,
      highlights,
    });
  }

  // ---- media upload ----
  if (method === "POST" && path === "/api/uploads") {
    const rate = enforceAuthRate(req, res, "upload-create", auth.user.id, { limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return;
    try {
      const body = await readAuthJson(req);
      const upload = beginResumableUpload({
        db, userId: auth.user.id, actorPersona: auth.persona,
        purpose: body.purpose, mime: body.mime, totalBytes: body.total_bytes,
        expectedSha256: body.expected_sha256, idempotencyKey: uploadIdempotencyKey(req),
      });
      return json(res, upload.replayed ? 200 : 201, { ok: true, upload, adapter: "LOCAL_RESUMABLE_V1", production_object_storage: false });
    } catch (error) { return resumableUploadError(res, error); }
  }

  const uploadPartMatch = path.match(/^\/api\/uploads\/([a-f0-9]{32})\/parts\/(\d+)$/);
  if (method === "PUT" && uploadPartMatch) {
    const rate = enforceAuthRate(req, res, "upload-part", auth.user.id, { limit: 240, windowMs: 60_000 });
    if (!rate.allowed) return;
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/octet-stream")) {
      return json(res, 415, { ok: false, code: "UPLOAD_PART_CONTENT_TYPE", error: "upload parts require application/octet-stream", retryable: false });
    }
    try {
      const upload = getResumableUpload({ db, userId: auth.user.id, uploadId: uploadPartMatch[1] });
      const bytes = await readBody(req, upload.chunk_size + 1);
      const result = putResumablePart({
        db, userId: auth.user.id, uploadId: uploadPartMatch[1], partNumber: Number(uploadPartMatch[2]),
        bytes, idempotencyKey: uploadIdempotencyKey(req),
      });
      return json(res, result.replayed ? 200 : 201, { ok: true, ...result });
    } catch (error) { return resumableUploadError(res, error); }
  }

  const uploadCompleteMatch = path.match(/^\/api\/uploads\/([a-f0-9]{32})\/complete$/);
  if (method === "POST" && uploadCompleteMatch) {
    try {
      const result = completeResumableUpload({ db, repo, userId: auth.user.id, uploadId: uploadCompleteMatch[1], idempotencyKey: uploadIdempotencyKey(req) });
      return json(res, result.replayed ? 200 : 201, {
        ok: true, upload: result.upload, replayed: result.replayed,
        media: { id: result.media.id, hash: result.media.hash, ext: result.media.ext, mime: result.media.mime, kind: result.media.kind, size: result.media.size, status: result.media.scan_status, available: new Set(["ready_local_validation", "ready_client_encrypted"]).has(result.media.scan_status), client_encrypted: result.media.scan_status === "ready_client_encrypted", malware_scanned: false, url: new Set(["ready_local_validation", "ready_client_encrypted"]).has(result.media.scan_status) ? `/media/${result.media.hash}.${result.media.ext}` : null },
        outbox: "media.upload.completed",
      });
    } catch (error) { return resumableUploadError(res, error); }
  }

  const uploadCancelMatch = path.match(/^\/api\/uploads\/([a-f0-9]{32})\/cancel$/);
  if (method === "POST" && uploadCancelMatch) {
    try {
      const upload = cancelResumableUpload({ db, userId: auth.user.id, uploadId: uploadCancelMatch[1], idempotencyKey: uploadIdempotencyKey(req) });
      return json(res, 200, { ok: true, upload });
    } catch (error) { return resumableUploadError(res, error); }
  }

  const uploadStatusMatch = path.match(/^\/api\/uploads\/([a-f0-9]{32})$/);
  if (method === "GET" && uploadStatusMatch) {
    try {
      const upload = getResumableUpload({ db, userId: auth.user.id, uploadId: uploadStatusMatch[1] });
      return json(res, 200, { ok: true, upload });
    } catch (error) { return resumableUploadError(res, error); }
  }

  // A caption track is a sidecar of the media it belongs to, so it is authorized by that media
  // record and never served on its own authority: no media row, no track.
  if (method === "GET" && path.startsWith("/media/") && path.endsWith(".vtt")) {
    const hash = path.slice("/media/".length, -".vtt".length);
    if (!/^[a-f0-9]{64}$/.test(hash)) return send(res, 404, "not found");
    const track = repo.db.prepare("SELECT * FROM media WHERE hash = ?").get(hash);
    if (!track || !mediaDeliveryPolicy(track) || !repo.canReadMedia(track.id, auth.user.id, auth.persona)) return send(res, 404, "not found");
    const text = readCaptionTrack(hash);
    if (!text) return send(res, 404, "no caption track");
    return send(res, 200, text, {
      "content-type": "text/vtt; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "vary": "Cookie",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
      "content-length": Buffer.byteLength(text),
    });
  }

  if (method === "GET" && path.startsWith("/media/")) {
    const file = path.slice("/media/".length);
    const dot = file.lastIndexOf(".");
    if (dot === -1) return send(res, 404, "not found");
    const hash = file.slice(0, dot);
    const ext = file.slice(dot + 1);
    if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-z0-9]{2,8}$/.test(ext)) return send(res, 404, "not found");
    const m = repo.db.prepare("SELECT * FROM media WHERE hash = ?").get(hash);
    if (!m || m.ext !== ext) return send(res, 404, "not found");
    const delivery = mediaDeliveryPolicy(m);
    if (!delivery) return send(res, 423, "media quarantined");
    if (!repo.canReadMedia(m.id, auth.user.id, auth.persona)) return send(res, 404, "not found");
    const buf = readMedia(hash, ext);
    if (!buf) return send(res, 410, "media missing");
    const baseHeaders = {
      "content-type": delivery.contentType,
      "content-disposition": delivery.disposition,
      "cache-control": "private, no-store, max-age=0",
      "pragma": "no-cache",
      "vary": "Cookie",
      "accept-ranges": "bytes",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    };
    const range = boundedMediaRange(req.headers.range, buf.length);
    if (range === false) return send(res, 416, "range not satisfiable", {
      ...baseHeaders, "content-range": `bytes */${buf.length}`, "content-length": 0,
    });
    if (range) return send(res, 206, buf.subarray(range.start, range.end + 1), {
      ...baseHeaders,
      "content-range": `bytes ${range.start}-${range.end}/${buf.length}`,
      "content-length": range.length,
    });
    return send(res, 200, buf, { ...baseHeaders, "content-length": buf.length });
  }

  // ---- unified messaging ----
  if (method === "GET" && path === "/api/chat/devices") {
    return json(res, 200, {
      ok: true,
      query: { owner_id: auth.user.id },
      devices: repo.listChatDevices(auth.user.id).map(ownerSafeChatDevice),
      step_up: auth.user.password_hash ? "password_or_xportal" : "xportal",
      public_keys_exposed_in_account_inventory: false,
      private_keys_on_server: false,
    });
  }

  if (method === "POST" && path === "/api/chat/recovery-devices") {
    const body = await readJson(req, 32 * 1024);
    const accountBinding = recoveryAccountBinding(auth.user);
    if (!accountBinding || body.account_binding !== accountBinding) return json(res, 409, { ok: false, code: "RECOVERY_ACCOUNT_BINDING_MISMATCH", error: "recovery package account binding is invalid" });
    const deviceId = sanitizeText(body.device_id, 80);
    const publicJwk = body.public_jwk;
    if (!publicJwk || typeof publicJwk !== "object" || Array.isArray(publicJwk) || "d" in publicJwk) return json(res, 400, { ok: false, error: "public ECDH key required; private material is forbidden" });
    const allowed = new Set(["kty", "crv", "x", "y", "ext", "key_ops"]);
    if (Object.keys(publicJwk).some((key) => !allowed.has(key))) return json(res, 400, { ok: false, error: "public key shape invalid" });
    let activationToken;
    try { activationToken = recoveryActivationToken(auth.user.id, deviceId, req.headers["idempotency-key"]); }
    catch { return json(res, 400, { ok: false, code: "RECOVERY_ACTIVATION_CONTEXT_INVALID", error: "recovery activation context is invalid" }); }
    const atSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = atSeconds + RECOVERY_DEVICE_PENDING_TTL_SECONDS;
    const pending = repo.createPendingRecoveryDevice(auth.user.id, {
      deviceId, label: "Recovery key · pending confirmation", publicJwk,
      activationTokenHash: sha256Hex(activationToken), expiresAt, atSeconds,
    });
    if (!pending.ok) {
      if (pending.error === "limit") return json(res, 409, { ok: false, code: "RECOVERY_DEVICE_LIMIT", error: "revoke an existing recovery device before creating another" });
      return json(res, pending.error === "invalid" ? 400 : 409, { ok: false, code: "RECOVERY_DEVICE_PENDING_REJECTED", error: "recovery device is invalid or conflicts with existing state" });
    }
    res.setHeader("Cache-Control", "no-store");
    return json(res, 201, {
      ok: true,
      intent: { owner_id: auth.user.id, device_id: deviceId, action: "provision_recovery" },
      device: ownerSafeChatDevice(pending.device), pending: true,
      activation_token: activationToken, activation_expires_at: Number(pending.device.activation_expires_at),
      private_key_received: false, account_binding_verified: true,
    });
  }

  const recoveryActivationMatch = path.match(/^\/api\/chat\/recovery-devices\/([^/]+)\/activate$/);
  const recoveryActivationDeviceId = decodeChatDevicePath(recoveryActivationMatch?.[1]);
  if (method === "POST" && recoveryActivationDeviceId) {
    const body = await readJson(req, 8 * 1024);
    const activationToken = sanitizeText(body.activation_token, 128);
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(activationToken)) return json(res, 400, { ok: false, code: "RECOVERY_ACTIVATION_TOKEN_INVALID", error: "activation token is invalid" });
    const activated = repo.activateRecoveryDevice(auth.user.id, {
      deviceId: recoveryActivationDeviceId,
      activationTokenHash: sha256Hex(activationToken),
      atSeconds: Math.floor(Date.now() / 1000),
    });
    if (!activated.ok) {
      if (activated.error === "expired") return json(res, 410, { ok: false, code: "RECOVERY_ACTIVATION_EXPIRED", error: "pending recovery device expired; create a new package" });
      if (activated.error === "limit") return json(res, 409, { ok: false, code: "RECOVERY_DEVICE_LIMIT", error: "revoke an active encryption device before activating this recovery package" });
      return json(res, activated.error === "not_found" ? 404 : 403, { ok: false, code: "RECOVERY_ACTIVATION_DENIED", error: "recovery activation was denied" });
    }
    if (!activated.replay) notifyWithInvalidation(repo, sse, auth.user.id, "security", "Cheia E2EE de recuperare a fost activată", { persona: "social", sensitive: true });
    return json(res, 200, {
      ok: true,
      intent: { owner_id: auth.user.id, device_id: recoveryActivationDeviceId, action: "activate_recovery" },
      device: ownerSafeChatDevice(activated.device),
      active: true,
      replay: activated.replay,
      private_key_received: false,
    });
  }

  if (method === "POST" && path === "/api/chat/devices") {
    const body = await readJson(req, 32 * 1024);
    const deviceId = sanitizeText(body.device_id, 80);
    const label = sanitizeText(body.label, 60) || "Nexus device";
    const publicJwk = body.public_jwk;
    if (!publicJwk || typeof publicJwk !== "object" || Array.isArray(publicJwk) || "d" in publicJwk) return json(res, 400, { ok: false, error: "public ECDH key required; private material is forbidden" });
    const allowed = new Set(["kty", "crv", "x", "y", "ext", "key_ops"]);
    if (Object.keys(publicJwk).some((key) => !allowed.has(key))) return json(res, 400, { ok: false, error: "public key shape invalid" });
    const previousDevice = repo.getChatDevice(deviceId);
    const device = repo.registerChatDevice(auth.user.id, { deviceId, label, publicJwk });
    if (!device) return json(res, 409, {
      ok: false,
      code: previousDevice ? "CHAT_DEVICE_ID_UNAVAILABLE" : "CHAT_DEVICE_REGISTRATION_REJECTED",
      error: "device registration is unavailable",
    });
    return json(res, 201, {
      ok: true,
      intent: { owner_id: auth.user.id, device_id: deviceId, action: "register" },
      device: ownerSafeChatDevice(device),
      private_key_received: false,
    });
  }

  const chatDeviceMatch = path.match(/^\/api\/chat\/devices\/([^/]+)$/);
  const chatDeviceId = decodeChatDevicePath(chatDeviceMatch?.[1]);
  if (method === "DELETE" && chatDeviceId) {
    const body = await readJson(req, 32 * 1024);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    if (!repo.revokeChatDevice(auth.user.id, chatDeviceId)) return json(res, 404, { ok: false, error: "active device not found" });
    notifyWithInvalidation(repo, sse, auth.user.id, "security", "Un dispozitiv de criptare a mesajelor a fost revocat", { persona: "social", sensitive: true });
    return json(res, 200, {
      ok: true,
      intent: { owner_id: auth.user.id, device_id: chatDeviceId, action: "revoke" },
      device: ownerSafeChatDevice(repo.getChatDevice(chatDeviceId)),
      status: "revoked", reversible: false, historical_access_transferred: false,
    });
  }

  const revokeChatDeviceMatch = path.match(/^\/api\/chat\/devices\/([^/]+)\/revoke$/);
  const revokeChatDeviceId = decodeChatDevicePath(revokeChatDeviceMatch?.[1]);
  if (method === "POST" && revokeChatDeviceId) {
    const body = await readJson(req, 32 * 1024);
    const stepUp = await accountStepUp(auth.user, body);
    if (!stepUp.ok) return json(res, 401, { ok: false, code: "STEP_UP_REQUIRED", error: "confirmă parola sau walletul xPortal" });
    if (!repo.revokeChatDevice(auth.user.id, revokeChatDeviceId)) return json(res, 404, { ok: false, error: "active device not found" });
    notifyWithInvalidation(repo, sse, auth.user.id, "security", "Un dispozitiv de criptare a mesajelor a fost revocat", { persona: "social", sensitive: true });
    return json(res, 200, {
      ok: true,
      intent: { owner_id: auth.user.id, device_id: revokeChatDeviceId, action: "revoke" },
      device: ownerSafeChatDevice(repo.getChatDevice(revokeChatDeviceId)),
      status: "revoked", reversible: false, historical_access_transferred: false,
    });
  }

  const chatKeyMaterialMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/key-material$/);
  if (method === "GET" && chatKeyMaterialMatch) {
    const conversationId = Number(chatKeyMaterialMatch[1]);
    const conversation = repo.getConversation(conversationId);
    if (!conversation || conversation.context_persona !== auth.persona) return json(res, 404, { ok: false, error: "active conversation not found" });
    const material = repo.conversationDeviceSet(conversationId, auth.user.id);
    if (!material) return json(res, 404, { ok: false, error: "active conversation not found" });
    return json(res, 200, {
      ok: true,
      query: { conversation_id: conversationId, viewer_id: auth.user.id, viewer_persona: auth.persona },
      privacy_enforced_server_side: true,
      ...material,
      conversation_persona: conversation.context_persona,
      protocol: material.conversation_kind === "group" ? "NEXUS_GROUP_ENVELOPE_V1_SINGLE_PAYLOAD_CONTENT_KEY_FANOUT" : "NEXUS_E2EE_V2_EPOCH_BOUND_ECDH_P256_HKDF_SHA256_AES_256_GCM",
      server_has_private_keys: false,
      ratcheting_sender_key_audit_complete: false,
    });
  }

  if (method === "GET" && path === "/api/chat/conversations") {
    const requested = sanitizeText(url.searchParams.get("persona") ?? "all", 20).toLowerCase();
    const box = sanitizeText(url.searchParams.get("box") ?? "inbox", 20).toLowerCase();
    if (requested !== "all" && !PERSONAS.includes(requested)) return json(res, 400, { ok: false, error: "invalid inbox profile filter" });
    if (!new Set(["inbox", "requests", "sent"]).has(box)) return json(res, 400, { ok: false, error: "invalid inbox box" });
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 30), 50));
    const cursorToken = url.searchParams.get("cursor");
    const cursorExpected = { kind: "inbox", viewer_id: auth.user.id, persona: requested, box };
    const query = sanitizeText(url.searchParams.get('q') ?? '', 80).trim();
    if (query && query.replace(/^@/, '').length < 2) return json(res, 400, { ok: false, error: 'conversation search requires at least 2 characters' });
    if (query) cursorExpected.query_hash = sha256Hex(query);
    const cursor = cursorToken ? decodeChatCursor(cursorToken, cursorExpected) : null;
    if (cursorToken && !cursor) return json(res, 400, { ok: false, code: "CHAT_CURSOR_INVALID", error: "inbox cursor invalid or expired" });
    const page = repo.listUnifiedConversations(auth.user.id, {
      persona: requested, box, limit: limit + 1, query,
      beforeUpdatedAt: cursor?.last_updated_at ?? null,
      beforeId: cursor?.last_id ?? null,
    });
    const conversations = page.slice(0, limit);
    const last = conversations.at(-1);
    const nextCursor = page.length > limit && last ? encodeChatCursor({
      ...cursorExpected,
      last_updated_at: Number(last.updated_at),
      last_id: Number(last.id),
      expires_at: cursor?.expires_at ?? Math.floor(Date.now() / 1000) + CHAT_CURSOR_TTL_SECONDS,
    }) : null;
    return json(res, 200, {
      ok: true,
      query: { persona: requested, box, limit, cursor: cursorToken || null, ...(query ? { text: query } : {}) },
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      privacy_enforced_server_side: true,
      conversations,
      next_cursor: nextCursor,
      transport: { mode: "per_message", e2ee_v1_available: true, e2ee_group_v1_available: true, epoch_bound: true, plaintext_available: true, label: "Nexus E2EE is opt-in per message; groups encrypt one payload and wrap its key for the exact current device set" },
    });
  }

  if (method === "GET" && path === "/api/chat/search") {
    const requested = sanitizeText(url.searchParams.get("persona") ?? "all", 20).toLowerCase();
    if (requested !== "all" && !PERSONAS.includes(requested)) return json(res, 400, { ok: false, error: "invalid message search profile" });
    const query = sanitizeText(url.searchParams.get("q"), 80);
    if (query.length < 2) return json(res, 400, { ok: false, error: "message search requires at least 2 characters" });
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 20), 50));
    const queryHash = sha256Hex(query.toLocaleLowerCase());
    const cursorToken = url.searchParams.get("cursor");
    const cursorExpected = { kind: "search", viewer_id: auth.user.id, persona: requested, query_hash: queryHash };
    const cursor = cursorToken ? decodeChatCursor(cursorToken, cursorExpected) : null;
    if (cursorToken && !cursor) return json(res, 400, { ok: false, code: "CHAT_CURSOR_INVALID", error: "message search cursor invalid or expired" });
    const page = repo.searchConversationMessages(auth.user.id, { persona: requested, query, beforeId: cursor?.last_id ?? null, limit: limit + 1 });
    const messages = page.slice(0, limit);
    const last = messages.at(-1);
    const nextCursor = page.length > limit && last ? encodeChatCursor({ ...cursorExpected, last_id: Number(last.id), expires_at: cursor?.expires_at ?? Math.floor(Date.now() / 1000) + CHAT_CURSOR_TTL_SECONDS }) : null;
    return json(res, 200, {
      ok: true,
      query: { text: query, persona: requested, limit, cursor: cursorToken || null },
      viewer_id: auth.user.id,
      viewer_persona: auth.persona,
      privacy_enforced_server_side: true,
      encrypted_content_searchable_server_side: false,
      messages,
      next_cursor: nextCursor,
    });
  }

  if (method === "POST" && path === "/api/chat/conversations") {
    const body = await readJson(req);
    const kind = sanitizeText(body.kind, 20).toLowerCase() || "direct";
    if (!new Set(["direct", "group"]).has(kind)) return json(res, 400, { ok: false, error: "invalid conversation kind" });
    const contextPersona = auth.persona;
    const usernames = [...new Set((Array.isArray(body.usernames) ? body.usernames : [body.username])
      .map((value) => sanitizeText(value, 32).replace(/^@/, "").toLowerCase()).filter(Boolean))];
    if (usernames.length > 49) return json(res, 400, { ok: false, error: "a group supports at most 49 recipients" });
    const recipients = usernames.map((handle) => repo.getUserByHandle(handle));
    if (!usernames.length || recipients.some((user) => !user || user.id === auth.user.id)) {
      return json(res, 404, { ok: false, error: "one or more Nexus usernames were not found" });
    }
    let directRequiresRequest = false;
    for (const recipient of recipients) {
      if (repo.isBlockedBetween(auth.user.id, contextPersona, recipient.id, contextPersona)) {
        return json(res, 403, { ok: false, error: "conversation is not permitted by profile privacy" });
      }
      const profile = repo.getPersona(recipient.id, contextPersona);
      if (!profile) return json(res, 404, { ok: false, error: "recipient profile is not available in this context" });
      if (profile.message_policy === "nobody") return json(res, 403, { ok: false, error: `@${recipient.handle} does not accept messages in ${contextPersona}` });
      if (profile.message_policy === "requests") directRequiresRequest = true;
      if (profile.message_policy === "followers" && !repo.isFollowing(auth.user.id, recipient.id, contextPersona)) {
        return json(res, 403, { ok: false, error: `@${recipient.handle} accepts messages only from followers in ${contextPersona}` });
      }
    }
    let conversation;
    let normalizedTitle = null;
    if (kind === "direct" && recipients.length === 1) {
      conversation = repo.createDirectConversation({
        creatorId: auth.user.id,
        recipientId: recipients[0].id,
        contextPersona,
        requestRecipientId: directRequiresRequest ? recipients[0].id : null,
      });
    } else if (kind === "group" && recipients.length >= 2) {
      normalizedTitle = sanitizeText(body.title, 80).trim();
      if (!normalizedTitle) return json(res, 400, { ok: false, error: "group title required" });
      conversation = repo.createGroupConversation({ creatorId: auth.user.id, memberIds: recipients.map((user) => user.id), title: normalizedTitle, contextPersona });
    } else {
      return json(res, 400, { ok: false, error: "direct requires one username; group requires at least two" });
    }
    if (!conversation) return json(res, 400, { ok: false, error: "conversation could not be created" });
    if (conversation.status === "request" && conversation.request_recipient_id === auth.user.id) {
      return json(res, 409, { ok: false, error: "an incoming request already exists; accept or decline it from Requests" });
    }
    return json(res, 201, { ok: true, intent: { kind, context_persona: contextPersona, recipient_handles: usernames, title: normalizedTitle }, conversation });
  }

  const chatMessagesMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/messages$/);
  if (method === "GET" && chatMessagesMatch) {
    const conversationId = Number(chatMessagesMatch[1]);
    if (!repo.isConversationParticipant(conversationId, auth.user.id)) return json(res, 404, { ok: false, error: "conversation not found" });
    if (repo.conversationBlockState(conversationId).blocked) return json(res, 403, { ok: false, error: "conversation is blocked by profile privacy" });
    const deviceId = sanitizeText(url.searchParams.get("device_id") ?? "", 80);
    if (deviceId) {
      const device = repo.getChatDevice(deviceId);
      if (!device || device.user_id !== auth.user.id || device.status !== "active") return json(res, 403, { ok: false, error: "active chat device does not belong to this account" });
    }
    const aroundMessageId = url.searchParams.has('around_message_id') ? Number(url.searchParams.get('around_message_id')) : null;
    if (aroundMessageId !== null && (!Number.isSafeInteger(aroundMessageId) || aroundMessageId < 1)) return json(res, 400, { ok: false, error: 'invalid target message' });
    const windowMessages = repo.listConversationMessages(conversationId, auth.user.id, aroundMessageId ? 60 : 200, aroundMessageId);
    if (!windowMessages || (aroundMessageId && !windowMessages.some((message) => message.id === aroundMessageId))) return json(res, 404, { ok: false, error: 'message unavailable' });
    const messages = windowMessages.map((message) => ({
      ...message,
      envelope: message.status !== 'expired' && message.encryption_mode.startsWith("e2ee_") && deviceId ? repo.getMessageEnvelope(message.id, auth.user.id, deviceId) : null,
    }));
    return json(res, 200, {
      ok: true,
      query: { conversation_id: conversationId, device_id: deviceId || null, viewer_persona: auth.persona, ...(aroundMessageId ? { around_message_id: aroundMessageId } : {}) },
      privacy_enforced_server_side: true,
      conversation: repo.getConversationDetails(conversationId, auth.user.id),
      messages,
      meetings: repo.listConversationMeetings(conversationId, auth.user.id),
      calls: repo.listConversationCalls(conversationId, auth.user.id),
      transport: { mode: "per_message", e2ee_default: false, e2ee_v1_available: true, e2ee_group_v1_available: true, epoch_bound: true, plaintext_available: true, label: "E2EE is available when every active participant has a registered secure-context device; group payloads use content-key fanout" },
    });
  }

  if (method === "POST" && chatMessagesMatch) {
    const conversationId = Number(chatMessagesMatch[1]);
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation) return json(res, 404, { ok: false, error: "conversation not found" });
    if (conversation.blocked || repo.conversationBlockState(conversationId).blocked) return json(res, 403, { ok: false, error: "conversation is blocked by profile privacy" });
    if (conversation.context_persona !== auth.persona) {
      return json(res, 409, { ok: false, error: `switch to ${conversation.context_persona} profile to reply with the correct identity` });
    }
    const body = await readJson(req, 2 * 1024 * 1024);
    const clientNonce = sanitizeText(body.client_nonce, 80) || randomBytes(16).toString("hex");
    if (!/^[a-zA-Z0-9:_-]{8,80}$/.test(clientNonce)) return json(res, 400, { ok: false, error: "invalid message nonce" });
    const expiresIn = body.expires_in_seconds == null ? null : Number(body.expires_in_seconds);
    if (expiresIn !== null && !new Set([60, 3600, 86400, 604800]).has(expiresIn)) return json(res, 400, { ok: false, error: "unsupported disappearing-message duration" });
    const expiresAt = expiresIn === null ? null : Math.floor(Date.now() / 1000) + expiresIn;
    if (new Set(["e2ee_v1", "e2ee_group_v1"]).has(body.encryption_mode)) {
      if (body.body) return json(res, 400, { ok: false, error: "plaintext body is forbidden on the E2EE endpoint" });
      const attachmentMediaId = body.attachment_media_id == null ? null : Number(body.attachment_media_id);
      if (attachmentMediaId !== null && (!Number.isSafeInteger(attachmentMediaId) || attachmentMediaId < 1)) return json(res, 400, { ok: false, error: "encrypted attachment reference invalid" });
      const senderDeviceId = sanitizeText(body.sender_device_id, 80);
      const deviceSetCommitment = sanitizeText(body.device_set_commitment, 64).toLowerCase();
      const keyEpoch = Number(body.key_epoch);
      const keyEpochCommitment = sanitizeText(body.key_epoch_commitment, 64).toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(deviceSetCommitment) || !Number.isSafeInteger(keyEpoch) || keyEpoch < 1
        || !/^[a-f0-9]{64}$/.test(keyEpochCommitment) || !Array.isArray(body.envelopes) || body.envelopes.length < 1 || body.envelopes.length > MAX_E2EE_DEVICE_ENVELOPES) {
        return json(res, 400, { ok: false, error: "encrypted device coverage invalid" });
      }
      const envelopes = body.envelopes.map((envelope) => ({
        recipient_device_id: sanitizeText(envelope?.recipient_device_id, 80),
        iv_b64: sanitizeText(envelope?.iv_b64, 64),
        ciphertext_b64: sanitizeText(envelope?.ciphertext_b64, 16_384),
        aad_sha256: sanitizeText(envelope?.aad_sha256, 64).toLowerCase(),
      }));
      const sharedCiphertext = body.encryption_mode === "e2ee_group_v1" ? {
        iv_b64: sanitizeText(body.shared_ciphertext?.iv_b64, 64),
        ciphertext_b64: sanitizeText(body.shared_ciphertext?.ciphertext_b64, 100_000),
        aad_sha256: sanitizeText(body.shared_ciphertext?.aad_sha256, 64).toLowerCase(),
        ciphertext_sha256: sanitizeText(body.shared_ciphertext?.ciphertext_sha256, 64).toLowerCase(),
      } : null;
      const encrypted = repo.sendEncryptedConversationMessage({
        conversationId,
        senderId: auth.user.id,
        senderPersona: auth.persona,
        senderDeviceId,
        clientNonce,
        deviceSetCommitment,
        keyEpoch,
        keyEpochCommitment,
        envelopes,
        sharedCiphertext,
        encryptionMode: body.encryption_mode,
        attachmentMediaId,
        expiresAt,
      });
      if (!encrypted.ok) return json(res, new Set(["device_set_stale", "key_epoch_stale", "conversation_blocked"]).has(encrypted.error) ? 409 : 400, { ok: false, error: encrypted.error });
      if (!encrypted.replay) {
        for (const participant of conversation.participants.filter((item) => item.id !== auth.user.id && item.state === "active")) {
          notifyWithInvalidation(repo, sse, participant.id, "message", `New encrypted ${conversation.context_persona} message from @${auth.user.handle}`, {
            persona: conversation.context_persona,
            sensitive: conversation.context_persona === "dating",
          });
          sse.publish(channelForUser(participant.id), "message", {
            recipient_id: participant.id,
            recipient_persona: conversation.context_persona,
            conversation_id: conversationId,
            message_id: encrypted.message.id,
            encryption_mode: body.encryption_mode,
          });
        }
      }
      return json(res, encrypted.replay ? 200 : 201, {
        ...chatMessageMutationView(encrypted.message, encrypted.replay),
        transport: { e2ee: true, attachment_e2ee: attachmentMediaId !== null, server_received_plaintext: false, server_can_malware_scan_attachment: attachmentMediaId === null ? null : false },
      });
    }
    const text = sanitizeText(body.body, 4000);
    const attachmentMediaId = body.attachment_media_id == null ? null : Number(body.attachment_media_id);
    const media = attachmentMediaId ? repo.getMediaById(attachmentMediaId) : null;
    if (attachmentMediaId && !media) return json(res, 400, { ok: false, error: "attachment not found" });
    if (media && (media.scan_status !== "ready_local_validation" || !repo.hasMediaUploadGrant(media.id, auth.user.id, "message_attachment", auth.persona))) {
      return json(res, 423, { ok: false, error: "attachment is not available from this verified upload boundary" });
    }
    const requestedKind = sanitizeText(body.kind, 20).toLowerCase();
    const kind = media ? (media.kind === "image" || media.kind === "video" ? media.kind : "file") : (requestedKind || "text");
    const existingMessage = repo.getConversationMessageByNonce(auth.user.id, clientNonce, conversationId);
    if (existingMessage) return json(res, 200, chatMessageMutationView(existingMessage, true));
    const message = repo.sendConversationMessage({ conversationId, senderId: auth.user.id, senderPersona: auth.persona, body: text, kind, attachmentMediaId, clientNonce, expiresAt });
    if (!message) {
      if (repo.conversationBlockState(conversationId).blocked) return json(res, 403, { ok: false, error: "conversation is blocked by profile privacy" });
      return json(res, 400, { ok: false, error: "message requires text or attachment" });
    }
    for (const participant of conversation.participants.filter((item) => item.id !== auth.user.id)) {
      notifyWithInvalidation(repo, sse, participant.id, "message", `New ${conversation.context_persona} message from @${auth.user.handle}`, {
        persona: conversation.context_persona,
        sensitive: conversation.context_persona === "dating",
      });
      sse.publish(channelForUser(participant.id), "message", {
        recipient_id: participant.id,
        recipient_persona: conversation.context_persona,
        conversation_id: conversationId,
        message_id: message.id,
        encryption_mode: "plaintext_local",
      });
    }
    return json(res, 201, chatMessageMutationView(message, false));
  }

  const chatReadMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/read$/);
  if (method === "POST" && chatReadMatch) {
    const conversationId = Number(chatReadMatch[1]);
    const body = await readJson(req);
    const throughMessageId = Number(body.through_message_id);
    if (!Number.isSafeInteger(throughMessageId) || throughMessageId < 0) return json(res, 400, { ok: false, error: "valid through_message_id is required" });
    if (!repo.markConversationRead(conversationId, auth.user.id, throughMessageId)) return json(res, 404, { ok: false, error: "conversation or message boundary not found" });
    return json(res, 200, { ok: true, conversation_id: conversationId, viewer_id: auth.user.id, viewer_persona: auth.persona, through_message_id: throughMessageId });
  }

  const chatDecisionMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/decision$/);
  if (method === "POST" && chatDecisionMatch) {
    const conversationId = Number(chatDecisionMatch[1]);
    const body = await readJson(req);
    const decision = sanitizeText(body.decision, 20).toLowerCase();
    if (!new Set(["accept", "decline"]).has(decision)) return json(res, 400, { ok: false, error: "invalid decision" });
    const conversation = repo.getConversation(conversationId);
    if (!conversation || conversation.context_persona !== auth.persona) return json(res, 409, { ok: false, error: "switch to the matching profile before deciding" });
    const result = conversation?.kind === "group"
      ? repo.decideGroupInvitation(conversationId, auth.user.id, decision)
      : repo.decideConversationRequest(conversationId, auth.user.id, decision);
    if (!result) return json(res, 409, { ok: false, error: "request is no longer actionable" });
    return json(res, 200, {
      ok: true,
      conversation_id: conversationId,
      actor_id: auth.user.id,
      actor_persona: auth.persona,
      decision,
      membership_state: decision === "accept" ? "active" : "declined",
      conversation_status: result.status,
    });
  }

  const chatTypingMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/typing$/);
  if (method === "POST" && chatTypingMatch) {
    const body = await readJson(req);
    const conversationId = Number(chatTypingMatch[1]);
    const active = body.active === true;
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation || conversation.context_persona !== auth.persona || !repo.setTypingIndicator(conversationId, auth.user.id, active)) {
      return json(res, 404, { ok: false, error: "conversation not found for active profile" });
    }
    for (const participant of conversation.participants.filter((item) => item.id !== auth.user.id && item.state === "active")) {
      sse.publish(channelForUser(participant.id), "typing", {
        recipient_id: participant.id,
        recipient_persona: conversation.context_persona,
        conversation_id: conversationId,
        user_id: auth.user.id,
        actor_persona: auth.persona,
        active,
      });
    }
    return json(res, 200, {
      ok: true,
      intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, active },
      expires_in_seconds: active ? 8 : 0,
    });
  }

  const chatGroupMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/group$/);
  if (method === "PATCH" && chatGroupMatch) {
    const conversationId = Number(chatGroupMatch[1]);
    const body = await readJson(req);
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation || conversation.kind !== "group" || conversation.context_persona !== auth.persona) {
      return json(res, 404, { ok: false, error: "group not found for active profile" });
    }
    if (body.title !== undefined) {
      const title = sanitizeText(body.title, 80);
      const expectedTitle = body.expected_title == null ? null : sanitizeText(body.expected_title, 80);
      if (!title || !Object.hasOwn(body, "expected_title")) return json(res, 400, { ok: false, error: "group title and expected_title required" });
      const updated = repo.updateGroupTitle(conversationId, auth.user.id, title, expectedTitle);
      if (!updated) return json(res, 409, { ok: false, error: "group changed or admin permission is no longer valid" });
      return json(res, 200, {
        ok: true,
        intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, action: "rename", title, expected_title: expectedTitle },
        conversation: updated,
      });
    }
    const expectedKeyEpoch = Number(body.expected_key_epoch);
    if (!Number.isSafeInteger(expectedKeyEpoch) || expectedKeyEpoch < 1) return json(res, 400, { ok: false, error: "expected_key_epoch is required" });
    const username = sanitizeText(body.username, 32).replace(/^@/, "").toLowerCase();
    const target = repo.getUserByHandle(username);
    if (!target) return json(res, 404, { ok: false, error: "Nexus username not found" });
    if (repo.isBlockedBetween(auth.user.id, conversation.context_persona, target.id, conversation.context_persona)) {
      return json(res, 403, { ok: false, error: "group invitation is not permitted by profile privacy" });
    }
    const targetProfile = repo.getPersona(target.id, conversation.context_persona) ?? repo.ensurePersona(target.id, conversation.context_persona, {});
    if (targetProfile.message_policy === "nobody") return json(res, 403, { ok: false, error: `@${target.handle} does not accept invitations in ${conversation.context_persona}` });
    const updated = repo.addGroupMember(conversationId, auth.user.id, target.id, expectedKeyEpoch);
    if (!updated) return json(res, 409, { ok: false, error: "group changed, permission expired or group is full" });
    return json(res, 200, {
      ok: true,
      intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, action: "add", target_id: target.id, target_handle: target.handle, expected_key_epoch: expectedKeyEpoch },
      conversation: updated,
      invitation: "pending",
    });
  }

  const chatGroupMemberMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/group\/members\/(\d+)$/);
  if (method === "DELETE" && chatGroupMemberMatch) {
    const conversationId = Number(chatGroupMemberMatch[1]);
    const targetId = Number(chatGroupMemberMatch[2]);
    const body = await readJson(req, 8 * 1024);
    const expectedKeyEpoch = Number(body.expected_key_epoch);
    if (!Number.isSafeInteger(expectedKeyEpoch) || expectedKeyEpoch < 1) return json(res, 400, { ok: false, error: "expected_key_epoch is required" });
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation || conversation.kind !== "group" || conversation.context_persona !== auth.persona) {
      return json(res, 404, { ok: false, error: "group not found for active profile" });
    }
    if (!repo.removeGroupMember(conversationId, auth.user.id, targetId, expectedKeyEpoch)) {
      return json(res, 409, { ok: false, error: "member cannot be removed or group membership changed" });
    }
    const updated = repo.getConversationDetails(conversationId, auth.user.id);
    return json(res, 200, {
      ok: true,
      intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, action: "remove", target_id: targetId, expected_key_epoch: expectedKeyEpoch },
      key_epoch: updated?.key_epoch,
    });
  }

  const chatMeetingMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/meetings$/);
  if (method === "POST" && chatMeetingMatch) {
    const conversationId = Number(chatMeetingMatch[1]);
    const body = await readJson(req);
    const title = sanitizeText(body.title, 100);
    const startsAt = Number(body.starts_at);
    const durationMinutes = Math.min(Math.max(Number(body.duration_minutes) || 30, 15), 480);
    if (!title || !Number.isInteger(startsAt) || startsAt <= Math.floor(Date.now() / 1000)) {
      return json(res, 400, { ok: false, error: "meeting title and a future start time are required" });
    }
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation || conversation.context_persona !== auth.persona || conversation.status !== "active") {
      return json(res, 404, { ok: false, error: "active conversation not found for active profile" });
    }
    const meeting = repo.scheduleConversationMeeting({ conversationId, creatorId: auth.user.id, title, startsAt, durationMinutes });
    if (!meeting) return json(res, 404, { ok: false, error: "conversation not found" });
    return json(res, 201, {
      ok: true,
      intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, title, starts_at: startsAt, duration_minutes: durationMinutes },
      meeting,
      call_transport: "local_webrtc_p2p_available_in_secure_context",
    });
  }

  const chatCallStartMatch = path.match(/^\/api\/chat\/conversations\/(\d+)\/calls$/);
  if (method === "POST" && chatCallStartMatch) {
    const conversationId = Number(chatCallStartMatch[1]);
    const conversation = repo.getConversationDetails(conversationId, auth.user.id);
    if (!conversation || conversation.context_persona !== auth.persona) return json(res, 404, { ok: false, error: "active direct conversation not found for this profile" });
    const body = await readJson(req, 8 * 1024);
    const mode = sanitizeText(body.mode, 10).toLowerCase();
    if (!new Set(["audio", "video"]).has(mode)) return json(res, 400, { ok: false, error: "call mode must be audio or video" });
    const callId = `call:${randomBytes(18).toString("base64url")}`;
    const call = repo.createConversationCall({
      callId,
      conversationId,
      initiatorId: auth.user.id,
      mode,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    if (!call) return json(res, 409, { ok: false, error: "a direct call cannot start or this conversation is busy" });
    const recipient = call.participants.find((participant) => participant.id !== auth.user.id);
    sse.publish(channelForCallPersona(recipient.id, conversation.context_persona), "call-invite", {
      recipient_id: recipient.id,
      recipient_persona: conversation.context_persona,
      call,
      transport: "local_webrtc_p2p",
      secure_context_required: true,
    });
    return json(res, 201, {
      ok: true,
      intent: { conversation_id: conversationId, actor_id: auth.user.id, actor_persona: auth.persona, mode },
      call,
      transport: { media: "webrtc_dtls_srtp", relay: "none", topology: "local_p2p", secure_context_required: true },
    });
  }

  if (method === "GET" && path === "/api/chat/calls/current") {
    return json(res, 200, {
      ok: true,
      query: { viewer_id: auth.user.id, viewer_persona: auth.persona },
      calls: repo.listCurrentCalls(auth.user.id, auth.persona),
      transport: "local_webrtc_p2p",
    });
  }

  const chatCallGetMatch = path.match(/^\/api\/chat\/calls\/(call:[A-Za-z0-9_-]{16,64})$/);
  if (method === "GET" && chatCallGetMatch) {
    const call = repo.getConversationCall(chatCallGetMatch[1], auth.user.id);
    if (!call || call.context_persona !== auth.persona) return json(res, 404, { ok: false, error: "call not found" });
    return json(res, 200, {
      ok: true,
      query: { call_id: call.call_id, viewer_id: auth.user.id, viewer_persona: auth.persona },
      call,
      transport: "local_webrtc_p2p",
    });
  }

  const chatCallHeartbeatMatch = path.match(/^\/api\/chat\/calls\/(call:[A-Za-z0-9_-]{16,64})\/heartbeat$/);
  if (method === "POST" && chatCallHeartbeatMatch) {
    const body = await readJson(req, 8 * 1024);
    const leaseNonce = sanitizeText(body.lease_nonce, 80);
    if (!/^[A-Za-z0-9:_-]{8,80}$/.test(leaseNonce)) return json(res, 400, { ok: false, error: "call lease nonce invalid" });
    const renewed = repo.touchConversationCallLease({
      callId: chatCallHeartbeatMatch[1], userId: auth.user.id, viewerPersona: auth.persona,
    });
    if (!renewed?.call) return json(res, 409, { ok: false, error: "call lease is no longer renewable" });
    return json(res, 200, {
      ok: true,
      intent: {
        call_id: renewed.call.call_id, conversation_id: renewed.call.conversation_id,
        actor_id: auth.user.id, actor_persona: auth.persona, lease_nonce: leaseNonce,
      },
      call: renewed.call,
      lease_until: renewed.lease_until,
      lease_seconds: 25,
    });
  }

  const chatCallDecisionMatch = path.match(/^\/api\/chat\/calls\/(call:[A-Za-z0-9_-]{16,64})\/decision$/);
  if (method === "POST" && chatCallDecisionMatch) {
    const body = await readJson(req, 8 * 1024);
    const decision = sanitizeText(body.decision, 10).toLowerCase();
    const visibleCall = repo.getConversationCall(chatCallDecisionMatch[1], auth.user.id);
    if (!visibleCall || visibleCall.context_persona !== auth.persona) return json(res, 404, { ok: false, error: "call not found" });
    const call = repo.decideConversationCall(chatCallDecisionMatch[1], auth.user.id, decision);
    if (!call) return json(res, 409, { ok: false, error: "call invitation is no longer actionable" });
    for (const participant of call.participants) sse.publish(channelForCallPersona(participant.id, call.context_persona), "call-state", {
      recipient_id: participant.id,
      recipient_persona: call.context_persona,
      call,
    });
    return json(res, 200, {
      ok: true,
      intent: { call_id: visibleCall.call_id, conversation_id: visibleCall.conversation_id, actor_id: auth.user.id, actor_persona: auth.persona, decision },
      call,
    });
  }

  const chatCallSignalMatch = path.match(/^\/api\/chat\/calls\/(call:[A-Za-z0-9_-]{16,64})\/signal$/);
  if (method === "POST" && chatCallSignalMatch) {
    const body = await readJson(req, 96 * 1024);
    const type = sanitizeText(body.type, 10).toLowerCase();
    const nonce = sanitizeText(body.signal_nonce, 80);
    let payload;
    if (type === "offer" || type === "answer") {
      if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload) || Object.keys(body.payload).some((key) => !new Set(["type", "sdp"]).has(key))) {
        return json(res, 400, { ok: false, error: "session description shape invalid" });
      }
      const sdp = sanitizeText(body.payload.sdp, 64 * 1024);
      if (body.payload.type !== type || !sdp.startsWith("v=0")) return json(res, 400, { ok: false, error: "session description invalid" });
      payload = { type, sdp };
    } else if (type === "ice") {
      if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload) || Object.keys(body.payload).some((key) => !new Set(["candidate", "sdpMid", "sdpMLineIndex", "usernameFragment"]).has(key))) {
        return json(res, 400, { ok: false, error: "ICE candidate shape invalid" });
      }
      const candidate = sanitizeText(body.payload.candidate, 2048);
      const sdpMid = body.payload.sdpMid == null ? null : sanitizeText(body.payload.sdpMid, 64);
      const sdpMLineIndex = Number(body.payload.sdpMLineIndex);
      const usernameFragment = body.payload.usernameFragment == null ? null : sanitizeText(body.payload.usernameFragment, 256);
      if (!candidate || !Number.isInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 64) return json(res, 400, { ok: false, error: "ICE candidate invalid" });
      payload = { candidate, sdpMid, sdpMLineIndex, usernameFragment };
    } else return json(res, 400, { ok: false, error: "call signal type invalid" });
    const payloadHash = sha256Hex(JSON.stringify({ type, payload }));
    const authorized = repo.authorizeConversationCallSignal({ callId: chatCallSignalMatch[1], senderId: auth.user.id, senderPersona: auth.persona, type, nonce, payloadHash });
    if (!authorized) return json(res, 403, { ok: false, error: "call signal is not authorized or nonce conflicts" });
    let delivered = authorized.delivered === true;
    if (authorized.shouldDeliver) {
      const delivery = sse.publish(channelForCallPersona(authorized.recipient.id, authorized.call.context_persona), "call-signal", {
        recipient_id: authorized.recipient.id,
        recipient_persona: authorized.call.context_persona,
        call_id: authorized.call.call_id,
        conversation_id: authorized.call.conversation_id,
        from_user_id: auth.user.id,
        signal_nonce: nonce,
        type,
        payload,
      });
      if (Number(delivery?.written || 0) > 0 && !repo.markConversationCallSignalDelivered({ callId: authorized.call.call_id, senderId: auth.user.id, nonce, payloadHash })) {
        throw new Error("CALL_SIGNAL_DELIVERY_MARK_INVARIANT_FAILED");
      }
      delivered = Number(delivery?.written || 0) > 0;
    }
    return json(res, authorized.replay ? 200 : 201, {
      ok: true,
      intent: { call_id: authorized.call.call_id, conversation_id: authorized.call.conversation_id, actor_id: auth.user.id, actor_persona: auth.persona, signal_nonce: nonce, type },
      replay: authorized.replay,
      delivered,
      payload_persisted: false,
      replay_guard: "durable_hash_only",
    });
  }

  const chatCallEndMatch = path.match(/^\/api\/chat\/calls\/(call:[A-Za-z0-9_-]{16,64})\/end$/);
  if (method === "POST" && chatCallEndMatch) {
    const visibleCall = repo.getConversationCall(chatCallEndMatch[1], auth.user.id);
    if (!visibleCall || visibleCall.context_persona !== auth.persona) return json(res, 404, { ok: false, error: "call not found" });
    const call = repo.endConversationCall(chatCallEndMatch[1], auth.user.id);
    if (!call) return json(res, 409, { ok: false, error: "call is already terminal or unavailable" });
    for (const participant of call.participants) sse.publish(channelForCallPersona(participant.id, call.context_persona), "call-state", {
      recipient_id: participant.id,
      recipient_persona: call.context_persona,
      call,
    });
    return json(res, 200, {
      ok: true,
      intent: { call_id: visibleCall.call_id, conversation_id: visibleCall.conversation_id, actor_id: auth.user.id, actor_persona: auth.persona, action: "end" },
      call,
    });
  }

  // ---- legacy messaging endpoints ----
  if (path === "/api/messages" || path.match(/^\/api\/messages\/\d+$/)) {
    return json(res, 410, { ok: false, error: "legacy numeric-recipient messaging retired; use Nexus username conversations" });
  }

  // ---- listings (market) ----
  if (path === "/api/listings") return json(res, 410, { ok: false, code: "MARKET_LISTINGS_LEGACY_RETIRED", error: "use the persona-bound /api/market/listings contract" });

  // Generic intent action: every module can record a real, persistent devnet
  // proof (explorer link) without pretending to be on-chain media/economics.
  if (method === "POST" && path === "/api/actions") {
    const body = await readJson(req);
    const action = sanitizeText(body.action, 60) || "action";
    const label = sanitizeText(body.label, 120);
    const proof = devnetActionProof({ actor: auth.user.handle, action, payloadHash: sha256Hex(`${auth.user.handle}:${action}:${label}:${Date.now()}`) });
    repo.recordDevnetAction({ userId: auth.user.id, actor: auth.user.handle, action, payloadHash: proof.txHash, txHash: proof.txHash, explorerUrl: proof.explorerUrl });
    return json(res, 201, { ok: true, devnet: proof });
  }

  // ---- devnet actions ----
  if (method === "GET" && path === "/api/devnet") {
    const list = repo.listDevnetActions({ userId: auth.user.id });
    return json(res, 200, { ok: true, actions: list, explorer: DEVNET_EXPLORER });
  }

  // ---- notifications ----
  if (method === "GET" && path === "/api/notifications") {
    const persona = url.searchParams.get("persona") === "all" ? "all" : normalizePersona(url.searchParams.get("persona") || auth.persona);
    return json(res, 200, {
      ok: true,
      owner_id: auth.user.id,
      persona,
      query: { viewer_id: auth.user.id, persona },
      notifications: repo.listNotifications(auth.user.id, { persona }),
      unread: Math.min(9999, repo.unreadNotifications(auth.user.id, persona)),
      unread_non_message: Math.min(9999, repo.unreadNonMessageNotifications(auth.user.id)),
      privacy_enforced_server_side: true,
    });
  }

  if (method === "PATCH" && path === "/api/notifications") {
    const body = await readJson(req);
    if (body.read_all !== true) return json(res, 400, { ok: false, error: "read_all must be true" });
    const persona = body.persona === "all" ? "all" : normalizePersona(body.persona || auth.persona);
    const changed = repo.markAllNotificationsRead(auth.user.id, persona);
    const invalidation = changed > 0 ? publishNotificationInvalidation(repo, sse, {
      userId: auth.user.id, persona: persona === "all" ? auth.persona : persona,
      type: "system", action: "read_all",
    }) : null;
    return json(res, 200, {
      ok: true, owner_id: auth.user.id, persona, changed,
      unread: repo.unreadNotifications(auth.user.id, persona),
      change_id: invalidation?.change_id ?? null,
    });
  }

  const notificationReadMatch = path.match(/^\/api\/notifications\/(\d+)$/);
  if (method === "PATCH" && notificationReadMatch) {
    const body = await readJson(req);
    if (body.read !== true) return json(res, 400, { ok: false, error: "read must be true" });
    const result = repo.markNotificationRead(auth.user.id, Number(notificationReadMatch[1]));
    if (!result.notification) return json(res, 404, { ok: false, error: "notification not found" });
    const invalidation = result.changed ? publishNotificationInvalidation(repo, sse, {
      userId: auth.user.id, persona: result.notification.persona, type: result.notification.type,
      notificationId: Number(notificationReadMatch[1]), action: "read",
    }) : null;
    return json(res, 200, {
      ok: true, notification_id: Number(notificationReadMatch[1]), owner_id: auth.user.id,
      persona: result.notification.persona, changed: result.changed, read: true,
      unread: repo.unreadNotifications(auth.user.id),
      change_id: invalidation?.change_id ?? null,
    });
  }

  if (method === "GET" && path === "/api/notification-preferences") {
    const persona = normalizePersona(url.searchParams.get("persona") || auth.persona);
    return json(res, 200, {
      ok: true,
      persona,
      preferences: repo.notificationPreferences(auth.user.id, persona),
      channel_gates: { in_app: "available", push: "provider_and_consent_required", email: "provider_and_consent_required" },
    });
  }

  if (method === "PATCH" && path === "/api/notification-preferences") {
    const body = await readJson(req);
    const persona = normalizePersona(body.persona || auth.persona);
    const type = sanitizeText(body.type, 30).toLowerCase();
    if (!NOTIFICATION_TYPES.includes(type)) return json(res, 400, { ok: false, error: "notification type invalid" });
    if (body.push === true || body.email === true) return json(res, 409, { ok: false, code: "CHANNEL_GATED", error: "push/email remain disabled until provider and explicit consent are configured" });
    const preview = sanitizeText(body.preview || "generic", 20).toLowerCase();
    if (!new Set(["generic", "sender", "content"]).has(preview)) return json(res, 400, { ok: false, error: "preview invalid" });
    const time = (value) => value == null || value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
    if (!time(body.quiet_start) || !time(body.quiet_end) || Boolean(body.quiet_start) !== Boolean(body.quiet_end)) {
      return json(res, 400, { ok: false, error: "quiet hours require both HH:MM values or neither" });
    }
    const preference = repo.setNotificationPreference(auth.user.id, persona, type, {
      in_app: body.in_app !== false,
      push: false,
      email: false,
      preview,
      quiet_start: body.quiet_start || null,
      quiet_end: body.quiet_end || null,
    });
    return json(res, 200, {
      ok: true, owner_id: auth.user.id, persona, type,
      preference: {
        type: preference.type, persona: preference.persona, in_app: preference.in_app,
        push: preference.push, email: preference.email, preview: preference.preview,
        quiet_start: preference.quiet_start, quiet_end: preference.quiet_end,
      },
    });
  }

  // ---- real-time stream (SSE) ----
  if (method === "GET" && path === "/api/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, viewer_id: auth.user.id, viewer_persona: auth.persona })}\n\n`);
    const channels = [channelForUser(auth.user.id), channelForCallPersona(auth.user.id, auth.persona)];
    const unsubscribe = channels.map((c) => sse.subscribe(c, res));
    const ping = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch { clearInterval(ping); }
    }, 15000);
    req.on("close", () => { clearInterval(ping); unsubscribe.forEach((fn) => fn()); });
    return;
  }

  return json(res, 404, { ok: false, error: "not found" });
}
