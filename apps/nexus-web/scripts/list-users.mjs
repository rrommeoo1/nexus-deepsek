import { openDb } from "../lib/db.js";

const db = openDb();
const rows = db.prepare("SELECT id, handle, email, display_name, mvx_address, password_hash IS NOT NULL AS has_password FROM users ORDER BY id LIMIT 50").all();
console.log("count=" + rows.length);
for (const r of rows) {
  console.log([r.id, r.handle, r.email || "-", r.display_name || "-", r.has_password ? "pw" : "no-pw", (r.mvx_address || "-").slice(0, 14)].join(" | "));
}
db.close();