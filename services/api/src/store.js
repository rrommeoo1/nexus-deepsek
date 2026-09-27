// Durable JSON-backed store (Phase I.1, NX-CORE-API).
//
// The demo used the browser's localStorage as the source of truth. For the
// product this file replaces that with a real, durable on-disk store behind the
// same minimal API used elsewhere. It keeps every write atomic (write to a
// temporary file, then rename) so a crash never leaves a half-written JSON.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const EMPTY = { users: {}, profiles: {} };

export function seedData() {
  return {
    users: {
      u1: { id: "u1", handle: "@alice" },
      u2: { id: "u2", handle: "@bob" },
    },
    profiles: {
      "u1:social": { persona: "social", name: "Alice (social)", bio: "hello" },
      "u1:work": { persona: "work", name: "Alice (work)", bio: "cv" },
      "u2:social": { persona: "social", name: "Bob (social)", bio: "hi" },
    },
  };
}

export class JsonStore {
  constructor(filePath, { seed = true } = {}) {
    this.filePath = filePath;
    if (seed) {
      this._ensureFile();
    }
  }

  _ensureFile() {
    let data = EMPTY;
    try {
      data = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      data = seedData();
      this._write(data);
    }
    return data;
  }

  _write(data) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  read() {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      const data = seedData();
      this._write(data);
      return data;
    }
  }

  write(data) {
    this._write(data);
    return data;
  }

  // Remove any state file so the next construction reseeds a clean local store.
  reset() {
    try {
      renameSync(this.filePath, `${this.filePath}.bak`);
    } catch {
      // Nothing to reset.
    }
    return this._ensureFile();
  }
}

// Convenience view used by the HTTP server: mutable Maps reconstructed from the
// JSON file. Callers mutate these Maps and then persist() when done.
export function loadMaps(store) {
  const data = store.read();
  return {
    users: new Map(Object.entries(data.users)),
    profiles: new Map(Object.entries(data.profiles)),
  };
}

export function persistMaps(store, { users, profiles }) {
  return store.write({
    users: Object.fromEntries(users),
    profiles: Object.fromEntries(profiles),
  });
}