import nacl from "tweetnacl";
import { scrypt } from "@noble/hashes/scrypt";
import * as bech32 from "bech32";

const encoder = new TextEncoder();
const STORAGE_PREFIX = "nexus.device-wallet.v1.";
const PENDING_PREFIX = "nexus.device-wallet.pending.v1.";
const ACTIVE_KEY = "nexus.device-wallet.active";

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function deriveLocalKey(password, salt) {
  return scrypt(encoder.encode(String(password)), salt, { N: 16384, r: 8, p: 1, dkLen: 32 });
}

function encryptedSecretRecord(address, secretBytes, password) {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = deriveLocalKey(password, salt);
  const ciphertext = nacl.secretbox(secretBytes, nonce, key);
  const record = {
    version: 1,
    address,
    kdf: "scrypt-16384-8-1",
    cipher: "xsalsa20-poly1305",
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString(),
  };
  return record;
}

function validStoredRecord(record, address) {
  return record?.version === 1 && record.address === address && typeof record.ciphertext === "string" && record.ciphertext.length > 0;
}

export function commitDeviceWallet(address) {
  const selected = String(address ?? "");
  if (!/^erd1[0-9a-z]{58}$/.test(selected)) return false;
  try {
    const finalKey = `${STORAGE_PREFIX}${selected}`;
    const existing = JSON.parse(localStorage.getItem(finalKey) || "null");
    if (validStoredRecord(existing, selected)) {
      localStorage.setItem(ACTIVE_KEY, selected);
      return true;
    }
    const pendingKey = `${PENDING_PREFIX}${selected}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || "null");
    if (!validStoredRecord(pending, selected)) return false;
    localStorage.setItem(finalKey, JSON.stringify(pending));
    localStorage.setItem(ACTIVE_KEY, selected);
    localStorage.removeItem(pendingKey);
    return true;
  } catch {
    return false;
  }
}

export async function createDeviceWalletProof({ password, message }) {
  if (String(password ?? "").length < 8) throw new Error("Parola trebuie să aibă minim 8 caractere");
  if (!message) throw new Error("Dovada walletului lipsește");
  const keyPair = nacl.sign.keyPair();
  const address = bech32.encode("erd", bech32.toWords(keyPair.publicKey));
  const signature = nacl.sign.detached(encoder.encode(message), keyPair.secretKey);
  // Stage only the encrypted 32-byte seed. The UI promotes it to the active
  // wallet after the idempotent account command is confirmed. If the response
  // is lost after server commit, authenticated account rendering can safely
  // promote the matching pending address; a different account cannot do so.
  const record = encryptedSecretRecord(address, keyPair.secretKey.slice(0, 32), password);
  localStorage.setItem(`${PENDING_PREFIX}${address}`, JSON.stringify(record));
  return { address, signature: bytesToHex(signature), storage: "encrypted_on_this_device_only" };
}

export function deviceWalletStatus(address) {
  const selected = address || localStorage.getItem(ACTIVE_KEY);
  if (!selected) return { available: false, address: null };
  try {
    let record = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${selected}`) || "null");
    if (!validStoredRecord(record, selected) && address && commitDeviceWallet(selected)) {
      record = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${selected}`) || "null");
    }
    return { available: Boolean(record?.ciphertext), address: selected, storage: "encrypted_on_this_device_only" };
  } catch {
    return { available: false, address: selected };
  }
}

window.NexusDeviceWallet = { createDeviceWalletProof, commitDeviceWallet, deviceWalletStatus };
