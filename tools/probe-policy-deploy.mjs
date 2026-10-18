import fs from "node:fs";

/**
 * Deploy probe for policy v3 — reads the local test sessions, never prints them.
 *
 * It proves on the deployed server, not on a local fixture:
 *   * the floor is 3 cents (0,03 JUNGLE), recalculated from parameters, and the reason is POLICY_V3;
 *   * a 3-cent price is accepted (the CHECK was rebuilt) and splits 2 creator / 1 infrastructure;
 *   * a 2-cent price is refused by name, not by a database error;
 *   * a reader sees `creator.monetized` and the restore puts the account back to free.
 */
const store = JSON.parse(fs.readFileSync("docs/.test-sessions.local", "utf8"));
const base = store.base;
const owner = store.accounts[0];
const reader = store.accounts[1];

async function call(method, path, { cookie, body, key } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body) { headers["content-type"] = "application/json"; headers.origin = base; }
  if (key) headers["idempotency-key"] = key;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = String(text).slice(0, 300); }
  return { status: res.status, json };
}

const pick = (p) => ({
  status: p.status,
  ok: p.json?.ok,
  free: p.json?.free,
  monetized: p.json?.monetized,
  display_currency: p.json?.display_currency,
  floor_cents: p.json?.floor_cents,
  floor_reason: p.json?.floor_reason,
  policy_version: p.json?.policy_version,
  gas_cents: p.json?.floor_basis?.gas_cents,
  mode: p.json?.floor_basis?.mode,
  batch_size: p.json?.floor_basis?.batch_size,
  egld_eur: p.json?.floor_basis?.egld_eur,
  creator: p.json?.creator && { handle: p.json.creator.handle, monetized: p.json.creator.monetized },
  actions: p.json?.actions && Object.fromEntries(Object.entries(p.json.actions).map(([k, v]) => [k, {
    price_cents: v.price_cents, chargeable: v.chargeable, chargeable_creator: v.creator_cents,
    infra_cents: v.infra_cents, slices: v.slices && { creator: v.slices.creator_cents, network: v.slices.network_fund_cents, founder: v.slices.founder_cents, shareholders: v.slices.shareholders_cents, burn: v.slices.burn_cents, infra: v.slices.infra_cents },
  }])),
  code: p.json?.code,
  error: p.json?.error,
});

const report = {};
const health = await fetch(base + "/health");
report.health = health.status;

report.me = (await call("GET", "/api/me", { cookie: owner.cookie })).status;
report.before = pick(await call("GET", "/api/creator/pricing", { cookie: owner.cookie }));

try {
  report.too_cheap = pick(await call("PUT", "/api/creator/pricing", {
    cookie: owner.cookie,
    body: { free: false, prices: { appreciation: 2, comment: 0 } },
    key: `probe-cheap-${Date.now()}`,
  }));
  report.at_floor = pick(await call("PUT", "/api/creator/pricing", {
    cookie: owner.cookie,
    body: { free: false, prices: { appreciation: 3, comment: 0 } },
    key: `probe-floor-${Date.now()}`,
  }));
  report.reader_after_save = pick(await call("GET", `/api/creator/pricing/${encodeURIComponent(owner.handle)}`, { cookie: reader.cookie }));
} finally {
  report.restored = pick(await call("PUT", "/api/creator/pricing", {
    cookie: owner.cookie,
    body: { free: true },
    key: `probe-restore-${Date.now()}`,
  }));
  report.reader_after_restore = pick(await call("GET", `/api/creator/pricing/${encodeURIComponent(owner.handle)}`, { cookie: reader.cookie }));
}

fs.writeFileSync(process.env.TEMP + "\\probe-policy-deploy.json", JSON.stringify(report, null, 2));
console.log("written");
