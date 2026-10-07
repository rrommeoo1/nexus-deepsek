import { PERSONAS } from "./repo.js";
import { hashPassword } from "./security.js";

// The test account is a preview-only convenience, never an organic account, and
// its password is a secret that never lives in the repository. The operator
// supplies it as NEXUS_TEST_ACCOUNT_PASSWORD (see docs/TEST-DATA.md); when the
// variable is absent the account is simply not provisioned, instead of being
// created with a password the whole repository can read.
export const PREVIEW_TEST_ACCOUNT = Object.freeze({
  email: "test@nexus.ro",
  handle: "test",
  displayName: "Test Nexus",
});

export const TEST_ACCOUNT_PASSWORD_ENV = "NEXUS_TEST_ACCOUNT_PASSWORD";

// A password shorter than 8 characters is not a secret worth storing; treating it
// as "absent" keeps the provisioning path closed rather than weak.
export function previewTestAccountPassword(env = process.env) {
  const value = String(env[TEST_ACCOUNT_PASSWORD_ENV] ?? "");
  return value.length >= 8 ? value : null;
}

// `force` este folosit exclusiv de seeder-ul local
// (scripts/dev-test-account.mjs): același cont trebuie să existe și pe
// mașina de dezvoltare, unde NODE_ENV nu este "production", deci garda de
// preview de mai jos l-ar sări.
export function ensurePreviewTestAccount(repo, env = process.env, { force = false } = {}) {
  const preview = env.NODE_ENV === "production"
    && String(env.NEXUS_DEPLOYMENT_MODE ?? "").trim().toLowerCase() === "preview";
  if (!preview && !force) return null;

  const password = previewTestAccountPassword(env);
  if (!password) {
    console.warn(`[test-account] ${TEST_ACCOUNT_PASSWORD_ENV} nu este setat (minim 8 caractere); contul de test ${PREVIEW_TEST_ACCOUNT.email} nu a fost creat.`);
    return null;
  }

  let user = repo.getUserByEmail(PREVIEW_TEST_ACCOUNT.email);
  if (!user) {
    const handleOwner = repo.getUserByHandle(PREVIEW_TEST_ACCOUNT.handle);
    if (handleOwner) throw new Error("preview test handle is already assigned");
    user = repo.createUser({
      handle: PREVIEW_TEST_ACCOUNT.handle,
      displayName: PREVIEW_TEST_ACCOUNT.displayName,
      bio: "Cont public pentru testarea interfeței Nexus.",
      passwordHash: hashPassword(password),
    });
    repo.linkProvider(user.id, { email: PREVIEW_TEST_ACCOUNT.email });
  } else {
    repo.updatePassword(user.id, hashPassword(password));
  }

  repo.verifyUserEmail(user.id);
  repo.markOnboarded(user.id);
  for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
  repo.db.prepare(
    `UPDATE personas
     SET name = ?, bio = ?, visibility = 'public'
     WHERE user_id = ? AND persona = 'social'`,
  ).run(PREVIEW_TEST_ACCOUNT.displayName, "Cont public pentru testarea interfeței Nexus.", user.id);
  return repo.getUserById(user.id);
}
