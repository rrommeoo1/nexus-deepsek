/**
 * The provider port: one `send()` per adapter, one retry policy, one sanitized log line.
 *
 * Why a hand-written HTTP adapter instead of an SDK: the backend has **zero runtime dependencies**
 * (`apps/nexus-web/package.json`) and both providers this product targets speak plain JSON over
 * HTTPS. An SDK would add a supply-chain surface and a version to chase for ten lines of `fetch`.
 *
 * What every adapter must honour, and what the caller may therefore rely on:
 *   - `send()` resolves `{ id, provider, captured }` only when the provider accepted the message.
 *   - a refusal throws `EmailDeliveryError` with `retryable` set correctly: 4xx (except 429) is a
 *     configuration/recipient problem and retrying it would only multiply the refusal, while 429 and
 *     5xx are transient.
 *   - nothing is logged but the provider, the event, the recipient's **domain** and the provider's
 *     message id. Never a token, never a link, never the API key, never the full address.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class EmailDeliveryError extends Error {
  constructor(code, message, { retryable = false, status = 0, provider = "", retryAfterSeconds = 0 } = {}) {
    super(message);
    this.name = "EmailDeliveryError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.provider = provider;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** `noreply@example.com` → `example.com`: enough to debug routing, useless as a contact list. */
export function recipientDomain(address) {
  const at = String(address ?? "").lastIndexOf("@");
  return at > 0 ? String(address).slice(at + 1).toLowerCase().replace(/[^a-z0-9.-]/g, "") : "";
}

/**
 * One line per send attempt. `console` on purpose: the supervisor already captures stdout into the
 * service log, and a log that leaves the process is one more copy of a token waiting to happen.
 */
export function logEmail(level, event, fields = {}) {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value).replace(/[^A-Za-z0-9_.:@-]/g, "_").slice(0, 120)}`);
  const line = `[email] ${event}${parts.length ? " " + parts.join(" ") : ""}`;
  if (level === "warn") console.warn(line);
  else if (level === "error") console.error(line);
  else console.log(line);
}

function backoffMs(attempt, base, retryAfterSeconds) {
  if (retryAfterSeconds > 0) return Math.min(retryAfterSeconds * 1000, 5000);
  return Math.min(base * 3 ** (attempt - 1), 5000);
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function requestJson(url, { method = "POST", headers, body, timeoutMs, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, Number(timeoutMs) || 8000));
  timer.unref?.();
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => "");
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    return { status: response.status, ok: response.ok, headers: response.headers, body: parsed, raw: raw.slice(0, 400) };
  } finally {
    clearTimeout(timer);
  }
}

function retryAfterFrom(headers) {
  const value = Number(headers?.get?.("retry-after") ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 60) : 0;
}

function providerFailure(provider, outcome) {
  const status = Number(outcome.status) || 0;
  const detail = outcome.body && typeof outcome.body === "object"
    ? String(outcome.body.message ?? outcome.body.error ?? outcome.body.name ?? "")
    : String(outcome.raw ?? "");
  const safe = detail.replace(/[^A-Za-z0-9 .,:_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return new EmailDeliveryError("EMAIL_PROVIDER_REFUSED", `${provider} a refuzat mesajul (${status || "fără status"}): ${safe || "fără detaliu"}`, {
    retryable: RETRYABLE_STATUS.has(status),
    status,
    provider,
    retryAfterSeconds: retryAfterFrom(outcome.headers),
  });
}

/** `resend` — `POST /emails`, bearer key, `Idempotency-Key` so a retry cannot deliver twice. */
function resendAdapter(config, deps) {
  return {
    id: "resend",
    async send({ to, subject, html, text, idempotencyKey }) {
      const outcome = await requestJson("https://api.resend.com/emails", {
        headers: { authorization: `Bearer ${config.api_key}`, ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
        body: {
          from: config.from_display,
          to: [to],
          subject,
          html,
          text,
          ...(config.reply_to ? { reply_to: config.reply_to } : {}),
        },
        timeoutMs: config.timeout_ms,
        fetchImpl: deps.fetchImpl,
      });
      if (!outcome.ok) throw providerFailure("resend", outcome);
      return { id: String(outcome.body?.id ?? ""), provider: "resend", captured: false };
    },
  };
}

/**
 * `brevo` — `POST /v3/smtp/email`, `api-key` header. No idempotency header exists, so the token the
 * caller generated is reused across retries and two deliveries carry the same working link.
 */
function brevoAdapter(config, deps) {
  return {
    id: "brevo",
    async send({ to, subject, html, text }) {
      const outcome = await requestJson("https://api.brevo.com/v3/smtp/email", {
        headers: { "api-key": config.api_key },
        body: {
          sender: { email: config.from_address, ...(config.from_name ? { name: config.from_name } : {}) },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
          ...(config.reply_to ? { replyTo: { email: config.reply_to } } : {}),
        },
        timeoutMs: config.timeout_ms,
        fetchImpl: deps.fetchImpl,
      });
      if (!outcome.ok) throw providerFailure("brevo", outcome);
      return { id: String(outcome.body?.messageId ?? ""), provider: "brevo", captured: false };
    },
  };
}

/**
 * `capture` — the local mail-capture tool: the message is written to a directory and **never leaves
 * the machine**. Every answer that passes through here is labelled `captured_locally`, so neither a
 * test nor a line of documentation can call it a delivery.
 */
function captureAdapter(config, deps) {
  const dir = config.capture_dir;
  return {
    id: "capture",
    captured: true,
    dir,
    async send({ to, subject, html, text }) {
      const createdAt = new Date(deps.now ? deps.now() : Date.now()).toISOString();
      const id = `${createdAt.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
      const record = {
        id,
        provider: "capture",
        delivered: false,
        note: "capturat local, netrimis: niciun provider de email nu a fost contactat",
        from: config.from_display || "Jungle Book <capture@localhost>",
        to,
        subject,
        created_at: createdAt,
        recipient_sha256: createHash("sha256").update(String(to).toLowerCase()).digest("hex").slice(0, 16),
        html,
        text,
      };
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${id}.json`), JSON.stringify(record, null, 2), "utf8");
      return { id, provider: "capture", captured: true };
    },
  };
}

const ADAPTERS = { resend: resendAdapter, brevo: brevoAdapter, capture: captureAdapter };

/**
 * The provider for this configuration, plus the retry policy that wraps it. `deps.fetchImpl`,
 * `deps.now` and `deps.sleep` exist so a test can drive the whole path — including a 429, a timeout
 * and a dead provider — with no network and no clock.
 */
export function createEmailProvider(config, deps = {}) {
  const factory = ADAPTERS[config.provider];
  if (!config.configured || !factory) {
    return {
      id: config.provider || "",
      ready: false,
      captured: false,
      dir: "",
      async send() {
        throw new EmailDeliveryError("EMAIL_NOT_CONFIGURED", "providerul de email nu este configurat", { provider: config.provider });
      },
    };
  }
  const adapter = factory(config, { fetchImpl: deps.fetchImpl ?? globalThis.fetch, now: deps.now });
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => { const timer = setTimeout(resolve, ms); timer.unref?.(); }));

  return {
    id: adapter.id,
    ready: true,
    captured: Boolean(adapter.captured),
    dir: adapter.dir ?? "",
    async send(message) {
      const attempts = config.provider === "capture" ? 1 : Math.max(1, config.max_attempts);
      let last = null;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const result = await adapter.send(message);
          logEmail("info", "sent", {
            provider: adapter.id, event: message.kind, to: recipientDomain(message.to),
            attempt, message_id: result.id ? result.id.slice(0, 40) : "", captured: result.captured ? "1" : "",
          });
          return { ...result, attempts: attempt };
        } catch (error) {
          last = error instanceof EmailDeliveryError
            ? error
            : new EmailDeliveryError(
              "EMAIL_PROVIDER_UNREACHABLE",
              `providerul nu poate fi contactat: ${String(error?.message ?? error).slice(0, 120)}`,
              { retryable: true, provider: adapter.id },
            );
          const wait = backoffMs(attempt, config.retry_base_ms, last.retryAfterSeconds);
          const willRetry = last.retryable && attempt < attempts;
          logEmail("warn", "attempt_failed", {
            provider: adapter.id, event: message.kind, to: recipientDomain(message.to), attempt,
            code: last.code, status: last.status, retryable: last.retryable ? "1" : "0",
            retry_in_ms: willRetry ? wait : "",
          });
          if (!willRetry) break;
          await sleep(wait);
        }
      }
      throw last ?? new EmailDeliveryError("EMAIL_PROVIDER_REFUSED", "trimiterea a eșuat", { provider: adapter.id });
    },
  };
}

/** The newest captured messages, for the local-only inbox. Never used by the capture-less providers. */
export function readCapturedMail(dir, { limit = 20 } = {}) {
  if (!dir || !existsSync(dir)) return [];
  const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort().reverse().slice(0, Math.max(1, limit));
  const out = [];
  for (const name of files) {
    try {
      const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
      out.push({
        id: String(record.id ?? name.replace(/\.json$/, "")),
        to: String(record.to ?? ""),
        subject: String(record.subject ?? ""),
        created_at: String(record.created_at ?? ""),
        delivered: false,
        link: String(record.text ?? "").split("\n").find((line) => /^https?:\/\//.test(line.trim()))?.trim() ?? "",
        text: String(record.text ?? ""),
      });
    } catch { /* a half-written capture is skipped, not fatal */ }
  }
  return out;
}
