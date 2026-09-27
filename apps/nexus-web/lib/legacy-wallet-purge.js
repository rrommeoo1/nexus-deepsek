function countWalletRows(db) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM wallets").get();
  return Number(row?.count ?? 0);
}

export function inspectLegacyWalletRows(db) {
  return { count: countWalletRows(db) };
}

// The one-time six-row deletion was completed and independently counted on
// 2026-08-23. Keeping a reusable execution API would allow its approval ID to
// authorize a different future row set, so mutation is permanently retired.
export function purgeLegacyWalletRows(db, { execute = false } = {}) {
  if (execute) throw new Error("LEGACY_WALLET_PURGE_RETIRED");
  return { executed: false, before: countWalletRows(db), deleted: 0 };
}
