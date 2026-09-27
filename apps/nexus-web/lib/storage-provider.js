import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

const SAFE_OBJECT_KEY = /^[a-z0-9][a-z0-9._-]{1,127}$/;

function exactObjectPath(root, key) {
  const safeKey = String(key ?? "").toLowerCase();
  if (!SAFE_OBJECT_KEY.test(safeKey) || safeKey.includes("..")) throw new Error("invalid storage object key");
  const target = resolve(root, safeKey);
  const boundary = `${resolve(root)}${sep}`;
  if (!target.startsWith(boundary)) throw new Error("storage object escaped provider root");
  return { key: safeKey, target };
}

// Local provider for development and single-node staging. The contract is kept
// deliberately small so an audited S3/IPFS-backed provider can replace it
// without changing media admission, privacy or delivery decisions.
export function createLocalContentAddressedProvider(root) {
  const providerRoot = resolve(String(root));
  return Object.freeze({
    kind: "local-content-addressed",
    root: providerRoot,
    pathFor(key) { return exactObjectPath(providerRoot, key).target; },
    exists(key) { return existsSync(exactObjectPath(providerRoot, key).target); },
    putIfAbsent(key, bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error("storage bytes required");
      const { target } = exactObjectPath(providerRoot, key);
      if (existsSync(target)) return { created: false, path: target };
      mkdirSync(dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, bytes, { flag: "wx" });
        if (existsSync(target)) return { created: false, path: target };
        renameSync(temporary, target);
        return { created: true, path: target };
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
    },
    read(key) {
      const { target } = exactObjectPath(providerRoot, key);
      try { return readFileSync(target); }
      catch { return null; }
    },
    remove(key) {
      const { target } = exactObjectPath(providerRoot, key);
      if (!existsSync(target)) return false;
      unlinkSync(target);
      return true;
    },
  });
}

export function resolveMediaStorageProvider({ mediaRoot, quarantineRoot, env = process.env } = {}) {
  const configured = String(env.NEXUS_MEDIA_STORAGE_PROVIDER || "local-content-addressed").trim();
  if (configured !== "local-content-addressed") {
    throw new Error(`media storage provider not available locally: ${configured}`);
  }
  return Object.freeze({
    kind: configured,
    serving: createLocalContentAddressedProvider(mediaRoot),
    quarantine: createLocalContentAddressedProvider(quarantineRoot),
    distributedReady: false,
    externalProviderGate: "REQUIRES_AUDITED_PROVIDER_AND_EXPLICIT_COST_APPROVAL",
  });
}
