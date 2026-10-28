/**
 * Local-development accounts: creating one and recovering one's password without any mail provider.
 *
 * Why this file exists (HANDOFF §0.36): `/auth/email/signup` binds a browser-generated MultiversX
 * wallet to the account, so a phone that does not generate and keep such a wallet cannot finish it, and
 * `/auth/email/reset-request` answers 503 on purpose because no mail adapter is configured. Both are
 * correct for production and useless for "let me create an account on my own PC today". This module is
 * the smallest safe addition: a **local-only** registration and password-recovery contract, with the
 * gate in one function so it can be read and tested in one place.
 *
 * The gate is deliberately narrow:
 *   - `NODE_ENV` must not be `production`;
 *   - `NEXUS_DEPLOYMENT_MODE` must say `local` **explicitly** (an unset mode is not enough);
 *   - the request must arrive from loopback or a private (RFC1918 / link-local) address, so a router
 *     forwarding port 5000 from the internet cannot reach it;
 *   - `NEXUS_LOCAL_ACCOUNTS=0` turns it off for anyone who wants the strict path back.
 *
 * Nothing here touches production: with `NODE_ENV=production` every helper returns "disabled" and the
 * routes do not exist.
 */

export const LOCAL_ACCOUNT_FLOW = "local-development";

/** `true` for the addresses a home network and the phone's own loopback produce. */
export function isPrivatePeer(address) {
  const value = String(address ?? "").trim().toLowerCase();
  if (!value) return false;
  // Node reports IPv4 through a dual-stack socket as `::ffff:192.168.1.20`.
  const ipv4 = value.startsWith("::ffff:") ? value.slice(7) : value;
  if (ipv4 === "::1" || ipv4 === "localhost") return true;
  const octets = ipv4.split(".");
  if (octets.length !== 4) return false;
  if (octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = octets.map(Number);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * The one gate. Every local-account route asks this first and answers 404 when it says no, so an
 * unconfigured or public deployment does not even reveal that the routes exist.
 */
export function localAccountGate(env = process.env, peerAddress = "") {
  if (env.NODE_ENV === "production") return { enabled: false, reason: "production" };
  if (String(env.NEXUS_LOCAL_ACCOUNTS ?? "").trim() === "0") return { enabled: false, reason: "switched_off" };
  const mode = String(env.NEXUS_DEPLOYMENT_MODE ?? "").trim().toLowerCase();
  if (mode !== "local") return { enabled: false, reason: "not_a_local_deployment" };
  if (!isPrivatePeer(peerAddress)) return { enabled: false, reason: "remote_peer" };
  return { enabled: true, reason: "local_development" };
}

/** `@Ana_Maria` → `ana_maria`; invalid handles come back as `""` so the caller answers one error. */
export function normalizeLocalHandle(value) {
  const clean = String(value ?? "").trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{2,30}$/.test(clean) ? clean : "";
}

export const LOCAL_PASSWORD_MIN = 8;
export const LOCAL_PASSWORD_MAX = 256;

/**
 * Passwords are never trimmed or folded: the characters the owner typed are the characters that get
 * hashed (`scrypt`, see `security.js`), spaces and punctuation included. Only the length and a
 * whitespace-only refusal are checked, because an empty-looking password cannot be retyped reliably.
 */
export function validateLocalPassword(password) {
  if (typeof password !== "string") return { ok: false, error: "parola este obligatorie" };
  if (password.length < LOCAL_PASSWORD_MIN || password.length > LOCAL_PASSWORD_MAX) {
    return { ok: false, error: `parola trebuie să aibă între ${LOCAL_PASSWORD_MIN} și ${LOCAL_PASSWORD_MAX} caractere` };
  }
  if (!/\S/.test(password)) return { ok: false, error: "parola nu poate fi doar spații" };
  return { ok: true, error: "" };
}

/**
 * One field, two identifiers: an email when it looks like one, a Nexus handle otherwise. The mobile
 * form says "email sau @handle", so the server has to accept exactly the same thing.
 */
export function readLocalIdentifier(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.includes("@") && !raw.startsWith("@")) {
    const email = raw.toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { kind: "email", value: email } : null;
  }
  const handle = normalizeLocalHandle(raw);
  return handle ? { kind: "handle", value: handle } : null;
}

export function isValidLocalEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? "").trim().toLowerCase());
}
