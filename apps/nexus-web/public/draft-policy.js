export function localDraftId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return "draft-" + Date.now().toString(36) + "-" + [...bytes].map((part) => part.toString(36)).join("");
}

export function planDraftEvictions(records, {
  maxCount,
  maxBytes,
  preserveId,
  sizeOf = (record) => Number(record?.size || 0),
} = {}) {
  if (!Array.isArray(records) || !Number.isSafeInteger(maxCount) || maxCount < 1
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || typeof preserveId !== "string") {
    throw new TypeError("invalid draft quota policy");
  }
  let retainedCount = records.length;
  let retainedBytes = records.reduce((total, record) => total + Math.max(0, Number(sizeOf(record)) || 0), 0);
  const evictIds = [];
  // Input is newest-first. Eviction is deterministic and oldest-first, while
  // the draft being saved is protected from silent loss.
  for (const candidate of [...records].reverse()) {
    if (retainedCount <= maxCount && retainedBytes <= maxBytes) break;
    if (candidate?.id === preserveId) continue;
    evictIds.push(candidate.id);
    retainedCount -= 1;
    retainedBytes -= Math.max(0, Number(sizeOf(candidate)) || 0);
  }
  return {
    evictIds,
    retainedCount,
    retainedBytes,
    overQuota: retainedCount > maxCount || retainedBytes > maxBytes,
  };
}
