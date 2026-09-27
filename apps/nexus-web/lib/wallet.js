import { randomBytes, createCipheriv, createDecipheriv, createHash, scryptSync } from "node:crypto";
import { Mnemonic, UserSecretKey, Account } from "@multiversx/sdk-core";

// ---------------------------------------------------------------------------
// Legacy local-fixture wallet utility. This module is retained only for
// deterministic migration tests and encrypted legacy-record inspection; the
// Nexus signup/runtime API must never generate, ingest, decrypt or export a
// complete mnemonic on the server.
//
// A wallet is a BIP39 mnemonic (24 words) derived via MultiversX's BIP44 path
// (m/44'/508'/0'/0'/index) to an ed25519 secret key -> `erd1...` address.
//
// Storage rule (per AGENTS.md + docs): the mnemonic is NEVER stored in plain
// text. For local devend we keep an encrypted keystore on disk; the plaintext
// mnemonic is shown to the user exactly once at creation (backup screen), then
// discarded from server memory.
// ---------------------------------------------------------------------------

function walletSecret() {
  const configured = process.env.NEXUS_WALLET_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXUS_WALLET_SECRET is required for legacy wallet migration in production");
  }
  return "nexus-wallet-dev-secret-change-me";
}

function deriveSecretKey(mnemonic, addressIndex = 0) {
  return Mnemonic.fromString(mnemonic).deriveKey(addressIndex);
}

function secretKeyToAddress(secretKey, hrp = "erd") {
  return secretKey.generatePublicKey().toAddress(hrp).toBech32();
}

// Generate a new wallet: returns the secret key, address, and the mnemonic
// (plaintext, for the one-time backup screen).
export function generateWallet({ addressIndex = 0, hrp = "erd" } = {}) {
  const m = Mnemonic.generate();
  const secretKey = m.deriveKey(addressIndex);
  return {
    mnemonic: m.toString(),
    address: secretKeyToAddress(secretKey, hrp),
    addressIndex,
  };
}

// Derive a wallet (address + secret key) from an existing mnemonic/seed phrase.
export function walletFromMnemonic(mnemonic, { addressIndex = 0, hrp = "erd" } = {}) {
  const secretKey = deriveSecretKey(mnemonic.trim(), addressIndex);
  return {
    address: secretKeyToAddress(secretKey, hrp),
    addressIndex,
  };
}

function deriveKeyMaterial(password, salt) {
  // Legacy migration utility only. New records use a random KDF salt and the
  // production protection root has no public fallback.
  return scryptSync(`${walletSecret()}:${password}`, salt, 32);
}

function encryptMnemonic(mnemonic, password) {
  const salt = randomBytes(16);
  const key = deriveKeyMaterial(password, salt);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    kdf: "scrypt",
    salt: salt.toString("base64"),
    cipher: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
    version: 2,
  };
}

function decryptMnemonic(keystore, password) {
  try {
    const key = keystore.salt
      ? deriveKeyMaterial(password, Buffer.from(keystore.salt, "base64"))
      : scryptSync(password, createHash("sha256").update(walletSecret()).digest(), 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(keystore.iv, "base64"));
    decipher.setAuthTag(Buffer.from(keystore.tag, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(keystore.data, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

// Build an encrypted keystore for a mnemonic (returned as a JSON-safe object).
export function encryptWallet(mnemonic, password) {
  return { kind: "mnemonic", ...encryptMnemonic(mnemonic, password) };
}

// Recover the mnemonic from an encrypted keystore. Returns null on bad password.
export function decryptWallet(keystore, password) {
  if (!keystore || keystore.kind !== "mnemonic") return null;
  return decryptMnemonic(keystore, password);
}

// Validate a seed phrase using BIP39 (without exposing it further).
export function isValidMnemonic(mnemonic) {
  try {
    Mnemonic.assertTextIsValid(String(mnemonic ?? "").trim());
    return true;
  } catch {
    return false;
  }
}

export { UserSecretKey, Account };
