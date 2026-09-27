import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";

const SCRYPT_KEYLEN = 64;
if (process.env.NODE_ENV === "production" && !process.env.NEXUS_SESSION_SECRET) {
  throw new Error("NEXUS_SESSION_SECRET is required in production");
}
const SESSION_SECRET = process.env.NEXUS_SESSION_SECRET ?? "nexus-local-dev-secret-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 256) throw new Error("invalid password length");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > 256) return false;
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function sessionSecret() {
  return SESSION_SECRET;
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueSession(userId, persona = "social") {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS * 1000;
  const token = signToken({ sub: userId, persona, jti: randomBytes(16).toString("base64url"), iat: issuedAt, exp: expiresAt });
  return { token, tokenHash: hashToken(token), expiresAt };
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
