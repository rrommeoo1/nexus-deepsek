import fs from "node:fs";

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

const pick = (p) => p && typeof p === "object"
  ? { status: p.status, ok: p.json?.ok, free: p.json?.free, monetized: p.json?.monetized,
      display_currency: p.json?.display_currency, floor_cents: p.json?.floor_cents,
      floor_reason: p.json?.floor_reason, can_edit: p.json?.can_edit,
      creator: p.json?.creator && { handle: p.json.creator.handle, monetized: p.json.creator.monetized },
      actions: p.json?.actions && Object.fromEntries(Object.entries(p.json.actions).map(([k, v]) => [k, { price_cents: v.price_cents, chargeable: v.chargeable }])),
      code: p.json?.code, error: p.json?.error }
  : p;

const report = {};
report.me = (await call("GET", "/api/me", { cookie: owner.cookie })).status;
const before = await call("GET", "/api/creator/pricing", { cookie: owner.cookie });
report.before = pick(before);
let saved = null;
let restored = null;
try {
  saved = await call("PUT", "/api/creator/pricing", {
    cookie: owner.cookie,
    body: { free: false, prices: { appreciation: 105, comment: 0 } },
    key: `probe-per-action-${Date.now()}`,
  });
  report.saved = pick(saved);
  report.reader_after_save = pick(await call("GET", `/api/creator/pricing/${encodeURIComponent(owner.handle)}`, { cookie: reader.cookie }));
} finally {
  restored = await call("PUT", "/api/creator/pricing", {
    cookie: owner.cookie,
    body: { free: true },
    key: `probe-restore-${Date.now()}`,
  });
  report.restored = pick(restored);
  report.reader_after_restore = pick(await call("GET", `/api/creator/pricing/${encodeURIComponent(owner.handle)}`, { cookie: reader.cookie }));
}
fs.writeFileSync(process.env.TEMP + "\\probe-pricing-deploy.json", JSON.stringify(report, null, 2));
console.log("written");
