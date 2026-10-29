/**
 * Email configuration: what a deployment has, what it is missing, and nothing else.
 *
 * The rules this file exists to enforce:
 *
 *   - **A missing provider is never simulated.** In production an unconfigured sender is a *refusal*
 *     (`mode: "unconfigured"` with the exact variable names that are missing), not a quiet drop.
 *   - **Development gets an explicit capture adapter, not a fake send.** With no provider selected and
 *     `NODE_ENV !== "production"`, mail is written to `NEXUS_EMAIL_CAPTURE_DIR` and every answer says
 *     `captured_locally`; nothing in the API ever claims such a message was delivered.
 *   - **No secret is ever read back out.** `api_key_present` is a boolean, `from` is the sender the
 *     owner configured, and no code path here returns a key, a token or a full URL.
 *   - **An unknown provider name is a refusal**, never a silent fallback to the default: a typo in
 *     `NEXUS_EMAIL_PROVIDER` must not quietly disable (or silently switch) a working sender.
 *
 * The evaluation is a pure function of the environment, so the same function answers a request, a
 * test and the operator probe (`GET /api/email/status`).
 */
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** The adapters that really speak to a provider, plus the local capture one. */
export const EMAIL_PROVIDERS = Object.freeze(["resend", "brevo", "capture"]);

/** Every variable this subsystem reads, so a diagnostic can name it without knowing the code. */
export const EMAIL_ENV_NAMES = Object.freeze({
  provider: "NEXUS_EMAIL_PROVIDER",
  apiKey: "NEXUS_EMAIL_API_KEY",
  from: "NEXUS_EMAIL_FROM",
  fromName: "NEXUS_EMAIL_FROM_NAME",
  replyTo: "NEXUS_EMAIL_REPLY_TO",
  support: "NEXUS_EMAIL_SUPPORT_ADDRESS",
  linkOrigin: "NEXUS_EMAIL_LINK_ORIGIN",
  captureDir: "NEXUS_EMAIL_CAPTURE_DIR",
  timeoutMs: "NEXUS_EMAIL_TIMEOUT_MS",
  maxAttempts: "NEXUS_EMAIL_MAX_ATTEMPTS",
  retryBaseMs: "NEXUS_EMAIL_RETRY_BASE_MS",
  floorMs: "NEXUS_EMAIL_RESPONSE_FLOOR_MS",
});

/** The three variables a real provider cannot work without, in the order an operator sets them. */
export const REQUIRED_PROVIDER_VARIABLES = Object.freeze([
  EMAIL_ENV_NAMES.provider, EMAIL_ENV_NAMES.apiKey, EMAIL_ENV_NAMES.from,
]);

const EMAIL_PATTERN = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function trimmed(env, name) {
  return String(env[name] ?? "").trim();
}

function positiveInt(raw, fallback, { min = 1, max = 600_000 } = {}) {
  const value = Number(String(raw ?? "").trim());
  if (!Number.isFinite(value) || value < min) return fallback;
  return Math.min(Math.floor(value), max);
}

function defaultCaptureDir(env) {
  const dataDir = trimmed(env, "NEXUS_DATA_DIR");
  const base = dataDir && isAbsolute(dataDir) ? dataDir : join(HERE, "..", "..", "data");
  return join(base, "mail-capture");
}

/**
 * `Nexus <noreply@domain>` or a bare address. The display name is kept exactly as written (it is the
 * owner's brand), the address is lowercased because no mail provider treats it as case-sensitive.
 */
export function parseSender(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const angled = value.match(/^(.*?)<\s*([^<>\s]+)\s*>$/);
  const name = angled ? angled[1].trim().replace(/^"|"$/g, "").trim() : "";
  const address = (angled ? angled[2] : value).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(address)) return null;
  return { address, name, display: name ? `${name} <${address}>` : address };
}

/** True for an origin a browser treats as the same machine: plain http is only honest there. */
export function isLocalOrigin(origin) {
  try {
    const parsed = new URL(String(origin ?? ""));
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.search || parsed.hash) return false;
    if (parsed.pathname && parsed.pathname !== "/") return false;
    const host = parsed.hostname.toLowerCase();
    if (LOOPBACK.has(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Where the links in an email point.
 *
 * Order: the dedicated variable, then the app's own public origin, then — development only — the
 * origin the request itself arrived on. A production build with none of the first two is a
 * configuration failure, because a link with `localhost` in it is a link that works for nobody.
 */
export function resolveLinkOrigin(env = process.env, requestOrigin = "") {
  const production = env.NODE_ENV === "production";
  const acceptable = (origin, protocol) => (production ? protocol === "https:" : (protocol === "https:" || isLocalOrigin(origin)));
  const candidates = [
    { value: trimmed(env, EMAIL_ENV_NAMES.linkOrigin), source: EMAIL_ENV_NAMES.linkOrigin },
    { value: trimmed(env, "NEXUS_ORIGIN"), source: "NEXUS_ORIGIN" },
  ];
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    let parsed;
    try { parsed = new URL(candidate.value); } catch { return { origin: "", source: candidate.source, code: "LINK_ORIGIN_INVALID" }; }
    const origin = parsed.origin;
    // A production mail never carries a `localhost` link: it works for the machine that sent it and
    // for nobody else, so it is a configuration failure rather than a fallback.
    if (!acceptable(origin, parsed.protocol)) {
      return { origin: "", source: candidate.source, code: "LINK_ORIGIN_INSECURE" };
    }
    if (parsed.search || parsed.hash) return { origin: "", source: candidate.source, code: "LINK_ORIGIN_INVALID" };
    return { origin, source: candidate.source };
  }
  if (!production && requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      const origin = parsed.origin;
      if (acceptable(origin, parsed.protocol)) return { origin, source: "request" };
      return { origin: "", source: "request", code: "LINK_ORIGIN_INSECURE" };
    } catch {
      return { origin: "", source: "request", code: "LINK_ORIGIN_INVALID" };
    }
  }
  return { origin: "", source: "", code: "LINK_ORIGIN_MISSING" };
}

/**
 * The whole email configuration, validated. `problems` is a list of `{ code, variable, message }`
 * entries an operator can act on; `missing` is just the variable names, for a UI.
 */
export function resolveEmailConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const requested = trimmed(env, EMAIL_ENV_NAMES.provider).toLowerCase();
  const problems = [];
  const warnings = [];
  const fail = (code, variable, message) => problems.push({ code, variable, message });

  if (requested && !EMAIL_PROVIDERS.includes(requested)) {
    fail("EMAIL_PROVIDER_UNKNOWN", EMAIL_ENV_NAMES.provider, `provider necunoscut: ${requested} (acceptate: ${EMAIL_PROVIDERS.join(", ")})`);
  }

  // Development without a choice talks to the local capture adapter on purpose: the developer sees the
  // exact message the provider would have received, labelled as captured and not delivered.
  const wantsProvider = requested === "resend" || requested === "brevo";
  const provider = requested && EMAIL_PROVIDERS.includes(requested)
    ? requested
    : (requested ? "" : (production ? "" : "capture"));

  const apiKey = trimmed(env, EMAIL_ENV_NAMES.apiKey);
  const sender = parseSender(trimmed(env, EMAIL_ENV_NAMES.from));
  const replyTo = trimmed(env, EMAIL_ENV_NAMES.replyTo).toLowerCase();
  const support = trimmed(env, EMAIL_ENV_NAMES.support).toLowerCase();
  const fromName = trimmed(env, EMAIL_ENV_NAMES.fromName);

  if (!requested && production) {
    fail("EMAIL_PROVIDER_MISSING", EMAIL_ENV_NAMES.provider, "nu este ales niciun provider de email (resend, brevo sau capture)");
  }
  if (!requested && !production) warnings.push("CAPTURE_FALLBACK");
  if (wantsProvider) {
    if (!apiKey) fail("EMAIL_API_KEY_MISSING", EMAIL_ENV_NAMES.apiKey, "cheia API a providerului lipsește");
    if (!sender) fail("EMAIL_FROM_MISSING", EMAIL_ENV_NAMES.from, "adresa expeditorului lipsește sau nu este o adresă validă");
  }
  if (provider === "capture" && production) {
    fail("EMAIL_CAPTURE_IN_PRODUCTION", EMAIL_ENV_NAMES.provider, "captura locală nu poate ține locul unui provider în producție");
  }
  if (sender && /@(resend\.dev|example\.(com|org|net))$/i.test(sender.address)) warnings.push("SANDBOX_SENDER");
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
    fail("EMAIL_REPLY_TO_INVALID", EMAIL_ENV_NAMES.replyTo, "adresa de răspuns nu este validă");
  }
  if (support && !EMAIL_PATTERN.test(support)) {
    fail("EMAIL_SUPPORT_INVALID", EMAIL_ENV_NAMES.support, "adresa de suport nu este validă");
  }

  // The sender identity is either usable or it is a named problem: `fromName` alone never invents an
  // address, and a bare address without a name keeps the address as the display.
  const fromDisplay = sender && fromName && !sender.name ? `${fromName} <${sender.address}>` : (sender ? sender.display : "");
  const configured = problems.length === 0 && Boolean(provider);
  const mode = !provider ? "unconfigured" : (provider === "capture" ? "capture" : "provider");

  return {
    mode,
    configured,
    production,
    provider,
    provider_requested: requested,
    api_key_present: Boolean(apiKey),
    api_key: apiKey,
    from_address: sender ? sender.address : "",
    from_name: sender ? (sender.name || fromName) : fromName,
    from_display: fromDisplay,
    reply_to: EMAIL_PATTERN.test(replyTo) ? replyTo : "",
    support: EMAIL_PATTERN.test(support) ? support : "",
    capture_dir: provider === "capture" ? (trimmed(env, EMAIL_ENV_NAMES.captureDir) || defaultCaptureDir(env)) : "",
    timeout_ms: positiveInt(trimmed(env, EMAIL_ENV_NAMES.timeoutMs), 8000, { min: 500, max: 60_000 }),
    max_attempts: positiveInt(trimmed(env, EMAIL_ENV_NAMES.maxAttempts), 3, { min: 1, max: 5 }),
    retry_base_ms: positiveInt(trimmed(env, EMAIL_ENV_NAMES.retryBaseMs), 400, { min: 0, max: 10_000 }),
    response_floor_ms: positiveInt(trimmed(env, EMAIL_ENV_NAMES.floorMs), 250, { min: 0, max: 5000 }),
    problems,
    warnings,
    missing: [...new Set(problems.map((problem) => problem.variable).filter(Boolean))],
  };
}
