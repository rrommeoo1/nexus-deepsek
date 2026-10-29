/**
 * The email flows themselves: register, confirm, recover, and the two notices.
 *
 * Everything here is a plain function of `{ db, repo, env, now, fetchImpl, sleep, requestOrigin }`, so
 * the router stays a router and a test can drive a complete flow with no network, no clock and no
 * server. The three promises this file keeps:
 *
 *   1. **An unconfigured sender is a refusal.** In production nothing is created that could never be
 *      confirmed, and nothing is answered as if a message left the building.
 *   2. **An account is never created twice.** Registering an address that already exists, unverified,
 *      resends the confirmation; registering one that exists and is verified ends in `EMAIL_TAKEN`.
 *   3. **A caller cannot tell existence from silence.** The two request endpoints answer the same body
 *      in the same time for a known and an unknown address (`response_floor_ms`), and never return a
 *      token — the token exists only inside the message that was sent.
 */
import { createHash } from "node:crypto";
import { hashPassword } from "../security.js";
import { PERSONAS } from "../repo.js";
import { normalizeLocalHandle, validateLocalPassword } from "../local-account.js";
import { resolveEmailConfig, resolveLinkOrigin } from "./config.js";
import { createEmailProvider, EmailDeliveryError, logEmail, recipientDomain } from "./providers.js";
import { renderEmail } from "./templates.js";
import {
  EMAIL_RESEND_COOLDOWN_SECONDS, EMAIL_TOKEN_PURPOSES, consumeEmailToken, emailTokenTtlMinutes,
  forgetEmailToken, issueEmailToken, lastEmailTokenAt, revokeEmailTokens,
} from "./tokens.js";

export class EmailFlowError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = "EmailFlowError";
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmailAddress(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(clean) && clean.length <= 120 ? clean : "";
}

function hashIp(ip) {
  return ip ? createHash("sha256").update(`nexus-email-ip:${String(ip).slice(0, 64)}`).digest("hex").slice(0, 32) : "";
}

function sleepTimer(timer) {
  return new Promise((resolve) => { const handle = setTimeout(resolve, timer); handle.unref?.(); });
}

/** The resolved email runtime for one request: configuration, link origin, provider, diagnostics. */
export function emailRuntime(ctx = {}) {
  const env = ctx.env ?? process.env;
  const config = resolveEmailConfig(env);
  const linkOrigin = resolveLinkOrigin(env, ctx.requestOrigin ?? "");
  const provider = createEmailProvider(config, { fetchImpl: ctx.fetchImpl, now: ctx.now, sleep: ctx.sleep });
  const ready = config.configured && Boolean(linkOrigin.origin);
  return { env, config, linkOrigin, provider, ready, db: ctx.db ?? null };
}

/** Honest answer for `/api/auth-capabilities` and `/api/email/status`: no secret, no message body. */
export function emailCapabilities(runtime) {
  const { config, linkOrigin, provider } = runtime;
  const delivery = config.mode === "provider" ? "provider" : (config.mode === "capture" ? "captured_locally" : "unconfigured");
  return {
    configured: runtime.ready,
    provider: config.provider || "",
    delivery,
    sender: config.from_display || "",
    support: config.support || "",
    link_origin: linkOrigin.origin || "",
    link_origin_source: linkOrigin.source || "",
    verification: runtime.ready,
    recovery: runtime.ready,
    problems: config.problems.map((problem) => ({ code: problem.code, variable: problem.variable, message: problem.message })),
    warnings: [...config.warnings],
    missing: [...config.missing, ...(linkOrigin.code ? ["NEXUS_EMAIL_LINK_ORIGIN"] : [])].filter(Boolean),
    capture: provider.captured ? { directory: provider.dir } : null,
  };
}

function requireReady(runtime) {
  if (!runtime.config.configured) {
    throw new EmailFlowError("EMAIL_NOT_CONFIGURED", 503, "trimiterea de email nu este configurată pe acest server", {
      missing: runtime.config.missing,
      problems: runtime.config.problems.map((problem) => ({ code: problem.code, message: problem.message })),
    });
  }
  if (!runtime.linkOrigin.origin) {
    throw new EmailFlowError("EMAIL_LINK_ORIGIN_MISSING", 503, "adresa publică pentru linkurile din email nu este configurată", {
      missing: ["NEXUS_EMAIL_LINK_ORIGIN"],
    });
  }
}

/**
 * One send, with the local capture path separated from a real delivery in the *answer*. A provider
 * failure is returned, not thrown: the account already exists, so the caller must be able to say
 * "the account is there, the mail did not leave" and offer the retry.
 */
async function deliver(runtime, { kind, to, handle, token, minutes, idempotencyKey }) {
  const message = renderEmail(kind, {
    origin: runtime.linkOrigin.origin,
    token,
    handle,
    minutes,
    support: runtime.config.support,
  });
  try {
    const result = await runtime.provider.send({
      idempotencyKey, kind, to, subject: message.subject, html: message.html, text: message.text,
    });
    return {
      sent: true,
      delivered: !result.captured,
      delivery: result.captured ? "captured_locally" : "provider",
      provider: result.provider,
      message_id: result.id || "",
      link: message.link,
      attempts: result.attempts ?? 1,
    };
  } catch (error) {
    const failure = error instanceof EmailDeliveryError ? error : null;
    logEmail("error", "delivery_failed", {
      provider: runtime.config.provider, event: kind, to: recipientDomain(to),
      code: failure?.code ?? "EMAIL_SEND_FAILED", status: failure?.status ?? "",
    });
    return {
      sent: false,
      delivered: false,
      delivery: "failed",
      provider: runtime.config.provider,
      message_id: "",
      link: "",
      code: failure?.code ?? "EMAIL_SEND_FAILED",
      retryable: Boolean(failure?.retryable),
      note: "mesajul nu a plecat; contul există și linkul poate fi cerut din nou",
    };
  }
}

/** A safe, unique handle for an account created from an address (`ana@x.ro` → `ana`, `ana2`, …). */
function uniqueHandleFor(repo, email) {
  const base = String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
  let handle = base.length >= 2 ? base : `${base}user`;
  let suffix = 1;
  while (repo.getUserByHandle(handle)) {
    suffix += 1;
    handle = `${base.slice(0, 24)}${suffix}`;
    if (suffix > 50) { handle = `user${Date.now().toString(36).slice(-5)}`; break; }
  }
  return handle;
}

function publicAccount(user) {
  return {
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    email: user.email,
    email_verified: Boolean(user.email_verified),
  };
}

/** What the answer says about a verification message, so a client never has to guess. */
function verificationView(result, expiresAt) {
  return {
    sent: result.sent,
    delivered: result.delivered,
    delivery: result.delivery,
    provider: result.provider,
    expires_at: expiresAt || null,
    expires_in_minutes: expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 60_000)) : 0,
    attempts: Number(result.attempts ?? 0),
    ...(result.sent ? {} : { code: result.code, retryable: result.retryable, note: result.note }),
  };
}

/** Mints a verification token and sends the message. `userId` must already exist. */
export async function sendVerificationEmail(runtime, { repo, user, now = Date.now(), ip = "" }) {
  requireReady(runtime);
  if (!runtime.db) throw new EmailFlowError("EMAIL_STORAGE_UNAVAILABLE", 500, "baza de date nu este disponibilă pentru tokenuri de email");
  const issued = issueEmailToken(runtime.db, {
    userId: user.id,
    purpose: EMAIL_TOKEN_PURPOSES.verify,
    email: user.email,
    now,
    requestedIpHash: hashIp(ip),
  });
  const result = await deliver(runtime, {
    kind: "verify_email",
    to: user.email,
    handle: user.handle,
    token: issued.token,
    minutes: issued.minutes,
    idempotencyKey: `verify-${user.id}-${createHash("sha256").update(issued.token).digest("hex").slice(0, 24)}`,
  });
  // A message nobody received must not hold the retry back: the row goes away, so the next attempt is
  // immediate and the cooldown only ever counts links that really left.
  if (!result.sent) forgetEmailToken(runtime.db, { token: issued.token });
  logEmail("info", "verification_issued", {
    provider: runtime.config.provider, to: recipientDomain(user.email), user: user.id, delivery: result.delivery,
  });
  return verificationView(result, issued.expiresAt);
}

/**
 * Registration with an address. The account is created in one transaction and the mail is attempted
 * afterwards, so a dead provider can never leave a half-written account behind; the answer says which
 * of the two happened.
 */
export async function registerEmailAccount(runtime, { db, repo, email, password, handle = "", displayName = "", now = Date.now(), ip = "" }) {
  requireReady(runtime);
  const cleanEmail = normalizeEmailAddress(email);
  if (!cleanEmail) throw new EmailFlowError("EMAIL_INVALID", 400, "adresa de email nu este validă");
  const verdict = validateLocalPassword(password);
  if (!verdict.ok) throw new EmailFlowError("PASSWORD_INVALID", 400, verdict.error);
  const requestedHandle = String(handle ?? "").trim() ? normalizeLocalHandle(handle) : "";
  if (String(handle ?? "").trim() && !requestedHandle) {
    throw new EmailFlowError("HANDLE_INVALID", 400, "handle invalid: 2-30 caractere, litere mici, cifre sau _");
  }

  const existing = repo.getUserByEmail(cleanEmail);
  if (existing && existing.email_verified) {
    throw new EmailFlowError("EMAIL_TAKEN", 409, "există deja un cont confirmat cu această adresă; intră în cont sau resetează parola");
  }
  if (existing && !existing.email_verified) {
    // The register-retry path: no second row, no second password, just a fresh link if the cooldown
    // allows it. The caller learns nothing about the account beyond "confirm your address".
    const cooldown = resendCooldownRemainingSeconds(runtime, { userId: existing.id, purpose: EMAIL_TOKEN_PURPOSES.verify, now });
    let verification = null;
    if (cooldown === 0) verification = await sendVerificationEmail(runtime, { repo, user: existing, now, ip });
    return {
      created: false,
      existing: true,
      account: publicAccount(existing),
      verification,
      cooldown_seconds: cooldown,
      note: "contul există deja, dar adresa nu era confirmată; parola nu a fost schimbată",
    };
  }

  const finalHandle = requestedHandle || uniqueHandleFor(repo, cleanEmail);
  const taken = repo.getUserByHandle(finalHandle);
  if (taken) throw new EmailFlowError("HANDLE_TAKEN", 409, "handle-ul este deja folosit; alege altul");
  const initials = (displayName || finalHandle).trim();

  let created;
  db.exec("BEGIN IMMEDIATE");
  try {
    if (repo.getUserByEmail(cleanEmail)) throw new EmailFlowError("EMAIL_TAKEN", 409, "adresa a fost folosită între timp");
    created = repo.createUser({ handle: finalHandle, displayName: initials.slice(0, 50) || finalHandle, passwordHash: hashPassword(password) });
    for (const persona of PERSONAS) repo.ensurePersona(created.id, persona, {});
    repo.linkProvider(created.id, { email: cleanEmail });
    if (requestedHandle) repo.markOnboarded(created.id);
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* the conflict path may have closed the transaction */ }
    if (error instanceof EmailFlowError) throw error;
    if (/UNIQUE constraint failed: users\.(handle|email)/i.test(String(error?.message ?? ""))) {
      throw new EmailFlowError("IDENTITY_TAKEN", 409, "handle sau email deja folosit");
    }
    throw error;
  }

  const verification = await sendVerificationEmail(runtime, { repo, user: repo.getUserById(created.id), now, ip });
  return {
    created: true,
    existing: false,
    account: publicAccount(repo.getUserById(created.id)),
    verification,
    cooldown_seconds: 0,
    note: verification.sent
      ? "Cont creat. Confirmă adresa din mesaj, apoi intră în cont."
      : "Cont creat, dar mesajul de confirmare nu a plecat; cere-l din nou.",
  };
}

/** Seconds left before this account may receive another link of the same purpose. */
function resendCooldownRemainingSeconds(runtime, { userId, purpose, now }) {
  if (!runtime.db) return 0;
  const last = lastEmailTokenAt(runtime.db, { userId, purpose });
  if (!last) return 0;
  const elapsed = Math.floor((now - last) / 1000);
  return elapsed >= EMAIL_RESEND_COOLDOWN_SECONDS ? 0 : EMAIL_RESEND_COOLDOWN_SECONDS - elapsed;
}

/**
 * Resend, answered the same way whether the address exists or not. A cooldown that is still running
 * is not an error: the owner already has one live link in the mailbox, and saying "wait 42 seconds"
 * to an unknown address as well keeps the two indistinguishable.
 */
export async function requestVerificationEmail(runtime, { repo, email, now = Date.now(), ip = "" }) {
  requireReady(runtime);
  const startedAt = Date.now();
  const cleanEmail = normalizeEmailAddress(email);
  if (!cleanEmail) throw new EmailFlowError("EMAIL_INVALID", 400, "adresa de email nu este validă");
  const user = repo.getUserByEmail(cleanEmail);
  let verification = null;
  let cooldown = 0;
  if (user && !user.email_verified) {
    cooldown = resendCooldownRemainingSeconds(runtime, { userId: user.id, purpose: EMAIL_TOKEN_PURPOSES.verify, now });
    if (cooldown === 0) verification = await sendVerificationEmail(runtime, { repo, user, now, ip });
  }
  await responseFloor(runtime, startedAt);
  return {
    requested: true,
    cooldown_seconds: cooldown,
    // Only the account owner can read the mailbox the message went to; the caller is told nothing
    // about whether an account exists. The field is present only when a message was really produced.
    ...(verification ? { verification } : {}),
  };
}

/** The privacy floor: the answer leaves no sooner than the configured minimum, both branches alike. */
async function responseFloor(runtime, startedAt) {
  const floor = Number(runtime.config.response_floor_ms ?? 0);
  if (!Number.isFinite(floor) || floor <= 0) return;
  const elapsed = Date.now() - startedAt;
  if (elapsed < floor) await sleepTimer(floor - elapsed);
}

/**
 * Confirmation. Consumes the token in the same statement that checks it, so two clicks of the same
 * link produce one verified account and one refusal. The answer carries the handle, never a session:
 * connecting is a separate, deliberate step (`/auth/email/login`).
 */
export function confirmEmailVerification(runtime, { repo, token, now = Date.now() }) {
  const consumed = consumeEmailToken(runtime.db, { purpose: EMAIL_TOKEN_PURPOSES.verify, token, now });
  if (!consumed) throw new EmailFlowError("EMAIL_TOKEN_INVALID", 400, "linkul este invalid, expirat sau a fost deja folosit");
  const user = repo.getUserById(consumed.user_id);
  if (!user) throw new EmailFlowError("EMAIL_TOKEN_INVALID", 400, "linkul este invalid, expirat sau a fost deja folosit");
  // The token was minted for one address. If the account's address changed since, the link must not
  // confirm the new one: it would verify an address nobody proved they own.
  if (String(user.email ?? "").toLowerCase() !== String(consumed.email ?? "").toLowerCase()) {
    throw new EmailFlowError("EMAIL_TOKEN_STALE", 409, "adresa contului s-a schimbat; cere un link nou");
  }
  const verified = user.email_verified ? user : repo.verifyUserEmail(user.id);
  logEmail("info", "email_verified", { user: user.id, to: recipientDomain(user.email) });
  return { user: verified, already_verified: Boolean(user.email_verified) };
}

/**
 * Forgotten password, step one. The body is identical for a known and an unknown address, and the
 * work a known address does is paid for by the response floor, so the two cannot be told apart by a
 * stopwatch either.
 */
export async function requestPasswordReset(runtime, { repo, email, now = Date.now(), ip = "" }) {
  requireReady(runtime);
  const startedAt = Date.now();
  const cleanEmail = normalizeEmailAddress(email);
  if (!cleanEmail) throw new EmailFlowError("EMAIL_INVALID", 400, "adresa de email nu este validă");
  const user = repo.getUserByEmail(cleanEmail);
  // An account without a password (a migrated social identity or a wallet-native account) can only be
  // recovered through xPortal, so no reset link is minted for it and no answer says so.
  if (user && user.password_hash) {
    const issued = issueEmailToken(runtime.db, {
      userId: user.id,
      purpose: EMAIL_TOKEN_PURPOSES.reset,
      email: user.email,
      now,
      requestedIpHash: hashIp(ip),
    });
    const result = await deliver(runtime, {
      kind: "reset_password",
      to: user.email,
      handle: user.handle,
      token: issued.token,
      minutes: issued.minutes,
      idempotencyKey: `reset-${user.id}-${createHash("sha256").update(issued.token).digest("hex").slice(0, 24)}`,
    });
    logEmail("info", "reset_issued", {
      provider: runtime.config.provider, to: recipientDomain(user.email), user: user.id, delivery: result.delivery,
    });
    if (!result.sent) forgetEmailToken(runtime.db, { token: issued.token });
  } else {
    logEmail("info", "reset_skipped", { to: recipientDomain(cleanEmail), reason: user ? "no_password" : "no_account" });
  }
  await responseFloor(runtime, startedAt);
  return { requested: true };
}

/**
 * Forgotten password, step two. The new hash is written in the same transaction that revokes every
 * session and every other live link, so a stolen session dies with the old password.
 */
export function confirmPasswordReset(runtime, { db, repo, token, password, now = Date.now() }) {
  requireReady(runtime);
  const verdict = validateLocalPassword(password);
  if (!verdict.ok) throw new EmailFlowError("PASSWORD_INVALID", 400, verdict.error);
  const consumed = consumeEmailToken(db, { purpose: EMAIL_TOKEN_PURPOSES.reset, token, now });
  if (!consumed) throw new EmailFlowError("EMAIL_TOKEN_INVALID", 400, "linkul este invalid, expirat sau a fost deja folosit");
  const user = repo.getUserById(consumed.user_id);
  if (!user) throw new EmailFlowError("EMAIL_TOKEN_INVALID", 400, "linkul este invalid, expirat sau a fost deja folosit");
  if (String(user.email ?? "").toLowerCase() !== String(consumed.email ?? "").toLowerCase()) {
    throw new EmailFlowError("EMAIL_TOKEN_STALE", 409, "adresa contului s-a schimbat; cere un link nou");
  }
  const updated = (() => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const next = repo.updatePassword(user.id, hashPassword(password));
      repo.deleteSessionsForUser(user.id);
      revokeEmailTokens(db, { userId: user.id, now });
      db.exec("COMMIT");
      return next;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* nothing to roll back */ }
      throw error;
    }
  })();
  logEmail("info", "password_reset", { user: user.id, sessions: "revoked" });
  return { user: updated, sessions_revoked: true };
}

/** The "your password changed" notice. Best effort on purpose: it must never fail the reset itself. */
export async function sendPasswordChangedNotice(runtime, { user, now = Date.now() }) {
  if (!runtime.ready || !user?.email) return { sent: false, delivery: "skipped" };
  const result = await deliver(runtime, {
    kind: "password_changed",
    to: user.email,
    handle: user.handle,
    token: "",
    minutes: 0,
    idempotencyKey: `changed-${user.id}-${Math.floor(now / 60_000)}`,
  });
  return { sent: result.sent, delivered: result.delivered, delivery: result.delivery };
}
