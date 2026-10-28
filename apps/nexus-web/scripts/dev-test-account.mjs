// Local-only seed for the documented test account (test@nexus.ro). The password
// is a secret and is read only from NEXUS_TEST_ACCOUNT_PASSWORD (see
// docs/TEST-DATA.md); nothing here prints or stores it. The preview deployment
// creates that account automatically (NODE_ENV=production + NEXUS_DEPLOYMENT_MODE
// =preview, see lib/preview-test-account.js), but a developer machine runs the
// server without those variables, so the same account has to be created
// explicitly before logging in on the phone.
// Zero network egress and no wallet: this only writes local data/nexus.sqlite.
import { DB_PATH, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { TEST_ACCOUNT_PASSWORD_ENV, PREVIEW_TEST_ACCOUNT, ensurePreviewTestAccount, previewTestAccountPassword } from "../lib/preview-test-account.js";
import { verifyPassword } from "../lib/security.js";

const password = previewTestAccountPassword(process.env);
if (!password) {
  console.error(`[test-account] lipsește ${TEST_ACCOUNT_PASSWORD_ENV} (minim 8 caractere). Setează-l în mediu, nu în fișiere comise.`);
  process.exit(2);
}

// O bază adusă din exportul Railway are `@test` fără email și fără parolă (exportul nu cară
// credențiale). Fără `--adopt-handle` seed-ul refuză, ca să nu se atingă de un cont pe care nu
// l-a creat; cu flagul, leagă emailul de aceeași înregistrare — niciun cont nou, nicio postare
// mutată — și spune în clar ce a făcut.
const adoptHandle = new Set(process.argv.slice(2)).has("--adopt-handle");

const db = openDb();
let failed = false;
try {
  const repo = createRepo(db);
  const existed = Boolean(repo.getUserByEmail(PREVIEW_TEST_ACCOUNT.email));
  const handleOwner = existed ? null : repo.getUserByHandle(PREVIEW_TEST_ACCOUNT.handle);
  const adopted = Boolean(handleOwner) && adoptHandle;
  const user = ensurePreviewTestAccount(repo, process.env, { force: true, adoptHandle });
  if (!user) {
    console.error("[test-account] seed-ul a fost sărit (garda de preview a refuzat)");
    failed = true;
  } else {
    const stored = repo.getUserById(user.id);
    const passwordOk = verifyPassword(password, stored.password_hash);
    if (adopted) {
      console.log(`[test-account] email legat de contul existent @${stored.handle} (id ${stored.id}): același cont, nicio înregistrare nouă`);
    }
    console.log(`[test-account] ${existed ? "actualizat" : adopted ? "adoptat" : "creat"}: @${stored.handle} (id ${stored.id}) <${stored.email}>`);
    console.log(`[test-account] parolă din ${TEST_ACCOUNT_PASSWORD_ENV} validă: ${passwordOk ? "da" : "NU"}`);
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
