// StorageProvider abstraction (audit §I). The app must not know where media is
// physically stored. Implementations may be swapped behind the same contract:
//   - LocalStorageProvider (demo / single node)
//   - S3CompatibleProvider (intermediate)
//   - ContentAddressedProvider (hash = key; dedup + integrity)
//   - DistributedNodeStorageProvider (future, user-operated)

import { createHash } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Minimal durable-backed local provider. In the browser this would persist to
// localStorage; in Node it uses an in-memory Map. The contract stays identical,
// so callers are not coupled to the physical store.
export class LocalStorageProvider {
  constructor(initial = {}) {
    this._map = new Map(Object.entries(initial));
  }

  async put(key, value) {
    this._map.set(key, value);
    return key;
  }

  async get(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }

  async delete(key) {
    return this._map.delete(key);
  }

  async exists(key) {
    return this._map.has(key);
  }

  async list() {
    return [...this._map.keys()];
  }
}

// Wraps any StorageProvider so the storage key is the content hash: the same
// bytes always map to the same key (dedup) and reads can verify integrity.
export class ContentAddressedProvider {
  constructor(inner) {
    this.inner = inner;
  }

  async put(value) {
    const key = sha256(value);
    await this.inner.put(key, value);
    return key;
  }

  async get(key) {
    const value = await this.inner.get(key);
    if (value == null) return null;
    if (sha256(value) !== key) return null; // integrity check, fail closed
    return value;
  }

  async delete(key) {
    return this.inner.delete(key);
  }

  async exists(key) {
    return this.inner.exists(key);
  }
}

// S3-compatible placeholder: same contract, stores nothing but validates shape.
// The real implementation would call an S3-compatible endpoint behind an
// approval (cost). Kept here so callers can already code against the interface.
export class S3CompatibleProvider {
  constructor(_config) {}

  async put(_key, _value) {
    throw new Error("S3CompatibleProvider requires an approved external backend");
  }

  async get(_key) {
    throw new Error("S3CompatibleProvider requires an approved external backend");
  }

  async delete(_key) {
    throw new Error("S3CompatibleProvider requires an approved external backend");
  }

  async exists(_key) {
    throw new Error("S3CompatibleProvider requires an approved external backend");
  }
}