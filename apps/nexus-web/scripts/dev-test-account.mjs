// Local-only seed for the documented test account (test@nexus.ro / test1234).
// The preview deployment creates that account automatically (NODE_ENV=production
// + NEXUS_DEPLOYMENT_MODE=preview, see lib/preview-test-account.js), but a
// developer machine runs the server without those variables, so the same
// account has to be created explicitly before logging in on the phone.
// Zero network egress and no wallet: this only writes local data/nexus.sqlite.
import { DB_PATH, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { PREVIEW_TEST_ACCOUNT, ensurePreviewTestAccount } from "../lib/preview-test-account.js";
import { verifyPassword } from "../lib/security.js";

const db = openDb();
let failed = false;
try {
  const repo = createRepo(db);
  const existed = Boolean(repo.getUserByEmail(PREVIEW_TEST_ACCOUNT.email));
  const user = ensurePreviewTestAccount(repo, process.env, { force: true });
  if (!user) {
    console.error("[test-account] seed-ul a fost sărit (garda de preview a refuzat)");
    failed = true;
  } else {
    const stored = repo.getUserById(user.id);
    const passwordOk = verifyPassword(PREVIEW_TEST_ACCOUNT.password, stored.password_hash);
    console.log(`[test-account] ${existed ? "actualizat" : "creat"}: @${stored.handle} (id ${stored.id}) <${stored.email}>`);
    console.log(`[test-account] parolă „${PREVIEW_TEST_ACCOUNT.password}” validă: ${passwordOk ? "da" : "NU"}`);
    console.log(`[test-account] email verificat: ${stored.email_verified ? "da" : "nu"} | onboarded: ${stored.onboarded_at ? "da" : "nu"} | persona social: ${repo.getPersona(stored.id, "social") ? "da" : "nu"}`);
    console.log(`[test-account] bază de date: ${DB_PATH}`);
    if (!passwordOk) failed = true;
  }
} catch (error) {
  console.error(`[test-account] a eșuat: ${String(error?.message ?? error)}`);
  failed = true;
} finally {
  db.close();
}
process.exitCode = failed ? 1 : 0;
