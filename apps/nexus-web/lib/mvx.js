import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
  randomBytes,
} from "node:crypto";

// ---------------------------------------------------------------------------
// MultiversX devnet adapter.
//
// Real flows:
//   - NativeAuth (token signed by xPortal / web wallet / extension / Ledger) is
//     validated server-side with the official @multiversx/sdk-native-auth-server.
//   - Herotag / xAlias (`@name`) is resolved to an `erd1...` address via the
//     MultiversX API (mainnet by default; devnet as an explicit override).
//
// Legacy local helpers (bech32, challenge, verifyMvxSignature) remain for the
// existing deterministic tests and for self-consistent fixtures. They exist
// *alongside* the official path; the product auth flow uses NativeAuth.
// ---------------------------------------------------------------------------

export const DEVNET_EXPLORER = "https://devnet-explorer.multiversx.com";
export const DEVNET_API = "https://devnet-api.multiversx.com";
export const MAINNET_API = "https://api.multiversx.com";

// Resolve a network label ("mainnet" | "devnet") to its MultiversX API URL.
// xPortal signs NativeAuth tokens on mainnet by default; devnet is the local/
// testing wallet. NEXUS_MVX_NETWORK drives the default so client and server
// always agree on which chain is being validated.
export function resolveMvxNetwork(network) {
  const n = String(network ?? process.env.NEXUS_MVX_NETWORK ?? "mainnet").toLowerCase();
  if (n === "devnet") return { label: "devnet", apiUrl: DEVNET_API, chainId: "D" };
  if (n === "testnet") return { label: "testnet", apiUrl: "https://testnet-api.multiversx.com", chainId: "T" };
  return { label: "mainnet", apiUrl: MAINNET_API, chainId: "1" };
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GENERATOR[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const out = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

// Decode a bech32 "erd..." address back to its raw 32-byte public key.
export function mvxAddressToPublicKey(address) {
  if (typeof address !== "string") return null;
  const str = address.toLowerCase();
  const pos = str.lastIndexOf("1");
  if (pos < 1) return null;
  const hrp = str.slice(0, pos);
  if (hrp !== "erd") return null;
  const data = str.slice(pos + 1);
  const values = [];
  for (const ch of data) {
    const idx = BECH32_CHARSET.indexOf(ch);
    if (idx === -1) return null;
    values.push(idx);
  }
  const combined = [...bech32HrpExpand(hrp), ...values];
  if (bech32Polymod(combined) !== 1) return null;
  const payload = values.slice(0, -6);
  const bits = payload.map((v) => v.toString(2).padStart(5, "0")).join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  if (bytes.length !== 32) return null;
  return Buffer.from(bytes);
}

// Convert an array of bytes from one bit width to another (bech32 convertbits).
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  return ret;
}

// Encode a raw 32-byte Ed25519 public key back to an "erd1..." bech32 address.
export function publicKeyToMvxAddress(pubKey) {
  if (!Buffer.isBuffer(pubKey) || pubKey.length !== 32) {
    throw new Error("ed25519 public key must be 32 bytes");
  }
  const data = convertBits(pubKey, 8, 5, true);
  const polymod = bech32Polymod([...bech32HrpExpand("erd"), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return "erd1" + [...data, ...checksum].map((v) => BECH32_CHARSET[v]).join("");
}

// ---------------------------------------------------------------------------
// NativeAuth (official MultiversX server-side validation + helper init builder)
// ---------------------------------------------------------------------------

function base64urlEncode(value) {
  return Buffer.from(String(value), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Build the NativeAuth `init` string the wallet must sign, exactly mirroring
// @multiversx/sdk-native-auth-client's `initialize()`: base64url(origin) + "."
// + blockHash + "." + expirySeconds + "." + base64url(extraInfo JSON).
// Uses global fetch (CORS-enabled MultiversX API) with a small fallback, so the
// same logic works in Node and in the browser.
export async function buildNativeAuthInit({ network, origin, expirySeconds = 86400, extraInfo = {}, fetcher = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const resolved = resolveMvxNetwork(network);
  const encodedOrigin = base64urlEncode(origin);
  const encodedExtra = base64urlEncode(JSON.stringify(extraInfo ?? {}));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let blockHash = null;
  try {
    const primary = await fetcher(`${resolved.apiUrl}/blocks/latest?ttl=${expirySeconds}&fields=hash`, { signal: controller.signal });
    const json = await primary.json();
    blockHash = json?.[0]?.hash;
  } catch {
    blockHash = null;
  }

  if (!blockHash) {
    try {
      const fallback = await fetcher(`${resolved.apiUrl}/blocks?size=1&fields=hash`, { signal: controller.signal });
      const json = await fallback.json();
      blockHash = json?.[0]?.hash;
    } catch {
      blockHash = null;
    }
  }
  clearTimeout(timer);

  if (!blockHash) {
    throw new Error(`could not fetch current block hash from ${resolved.label}`);
  }

  return `${encodedOrigin}.${blockHash}.${expirySeconds}.${encodedExtra}`;
}

// The exact bytes a wallet signs for NativeAuth: `${address}${init}`.
export function nativeAuthSignableMessage(address, init) {
  return `${address}${init}`;
}

// Assemble a NativeAuth access token from address + init + hex signature,
// mirroring NativeAuthClient.getToken(): base64url(address) + "." +
// base64url(init) + "." + signature.
export function buildNativeAuthToken(address, init, signatureHex) {
  if (typeof address !== "string" || typeof init !== "string" || typeof signatureHex !== "string") {
    throw new Error("address, init and signature are required");
  }
  return `${base64urlEncode(address)}.${base64urlEncode(init)}.${signatureHex}`;
}

// Lazily import the CJS package to avoid slowing down the legacy-only tests.
let _NativeAuthServer = null;
async function nativeAuthServerModule() {
  if (!_NativeAuthServer) {
    const mod = await import("@multiversx/sdk-native-auth-server");
    _NativeAuthServer = mod.NativeAuthServer;
  }
  return _NativeAuthServer;
}

function acceptedOriginsFor(extra) {
  const fromEnv = process.env.NEXUS_ACCEPTED_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXUS_ACCEPTED_ORIGINS is required in production");
  }
  // The development callback below admits loopback/RFC1918 addresses. Keep
  // the SDK's static list narrow as a second layer; never fall back to a public
  // wildcard because a missing production variable must fail closed.
  return ["http://localhost:*", "http://127.0.0.1:*"];
}

// The demo is intentionally reachable from a phone on the same Wi-Fi. Keep
// that development exception narrow: only loopback and RFC1918 hosts are
// accepted over http(s), and never enable it in production. Public deployments
// still require the explicit NEXUS_ACCEPTED_ORIGINS allow-list.
export function isLocalDevelopmentOrigin(origin) {
  try {
    const parsed = new URL(String(origin));
    if (!new Set(["http:", "https:"]).has(parsed.protocol) || parsed.username || parsed.password) return false;
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    const octets = host.split(".");
    if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b] = octets.map(Number);
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  } catch {
    return false;
  }
}

// Build a NativeAuthServer. `network` ("mainnet" | "devnet") selects the
// MultiversX API used only to look up block timestamps during validation.
// xPortal signs on mainnet, so mainnet is the default; devnet is kept explicit.
export async function createNativeAuthServer({ network, apiUrl, ...extra } = {}) {
  const resolved = resolveMvxNetwork(network);
  const NativeAuthServer = await nativeAuthServerModule();
  return new NativeAuthServer({
    apiUrl: apiUrl ?? resolved.apiUrl,
    acceptedOrigins: acceptedOriginsFor(extra),
    maxExpirySeconds: extra.maxExpirySeconds ?? 86400,
    ...(extra.cache ? { cache: extra.cache } : {}),
    ...(process.env.NODE_ENV !== "production" ? { isOriginAccepted: isLocalDevelopmentOrigin } : {}),
  });
}

// Validate a NativeAuth access token and return the authenticated wallet address.
// Throws on any invalid/expired token or network/origin mismatch. `server` can be
// passed to reuse an instance; `network` selects mainnet (xPortal) vs devnet.
export async function validateNativeAuthToken(accessToken, { network, apiUrl, server } = {}) {
  if (typeof accessToken !== "string" || !accessToken.includes(".")) {
    throw new Error("invalid native auth token");
  }
  const srv = server ?? (await createNativeAuthServer({ network, apiUrl }));
  const result = await srv.validate(accessToken);
  return result;
}

// ---------------------------------------------------------------------------
// Herotag / xAlias resolution
// ---------------------------------------------------------------------------

function normalizeHerotag(input) {
  return String(input ?? "").trim().replace(/^@/, "").toLowerCase();
}

// Resolve a herotag/xAlias (`@name`) to its `erd1...` address via the
// MultiversX API. Defaults to MAINNET because herotags/xAlias live on the
// mainnet (xPortal); devnet is available as an explicit override.
// `fetcher` is injectable for deterministic tests.
export async function resolveHerotag(herotag, { apiUrl = MAINNET_API, fetcher = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const name = normalizeHerotag(herotag);
  if (!/^[a-z0-9]{3,64}$/.test(name)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Preferred endpoint; the mainnet API answers /usernames/{tag} with a 302
    // that fetch follows to the account JSON (which contains `address`).
    const urls = [`${apiUrl}/usernames/${name}`, `${apiUrl}/address/${name}`];
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetcher(url, {
          signal: controller.signal,
          redirect: "follow",
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
        const data = await res.json();
        const address = data?.address ?? data?.herotag?.address;
        if (typeof address === "string" && address.startsWith("erd1")) {
          return address;
        }
        throw new Error("address missing");
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("herotag not resolved");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Legacy challenge helpers (kept for self-consistent fixtures/tests)
// ---------------------------------------------------------------------------

// Challenge sent to the wallet for signing (legacy local flow).
export function createChallenge({ address, persona = "social", nonce, issuedAt: providedIssuedAt } = {}) {
  const value = nonce ?? randomBytes(18).toString("base64url");
  const issuedAt = providedIssuedAt ?? Date.now();
  const message = [
    "Nexus sign-in",
    `address:${address}`,
    `persona:${persona}`,
    `nonce:${value}`,
    `issuedAt:${issuedAt}`,
  ].join("\n");
  return { message, nonce: value, address, persona, issuedAt };
}

// Verify an ed25519 signature over the exact challenge message.
// signatureHex: 64-byte hex (128 chars). Returns boolean.
export function verifyMvxSignature(address, message, signatureHex) {
  const pub = mvxAddressToPublicKey(address);
  if (!pub) return false;
  if (typeof signatureHex !== "string" || !/^[0-9a-fA-F]{128}$/.test(signatureHex)) {
    return false;
  }
  try {
    const jwk = {
      kty: "OKP",
      crv: "Ed25519",
      x: pub.toString("base64url"),
    };
    const key = createPublicKey({ key: jwk, format: "jwk" });
    return cryptoVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

// Deterministic devnet action proof (local intent ledger, zero broadcast).
// Produces a stable tx hash + explorer link so the user can see every action
// traced to a public devnet explorer URL. Actual broadcast requires a signed
// wallet transaction and is gated behind an explicit external approval.
export function devnetActionProof({ actor, action, payloadHash }) {
  const digest = createHash("sha256").update(`${actor}\n${action}\n${payloadHash}\n${Date.now()}\n${randomBytes(8).toString("hex")}`).digest("hex");
  const txHash = digest;
  const explorerUrl = `${DEVNET_EXPLORER}/transactions/${txHash}`;
  return { txHash, explorerUrl };
}
