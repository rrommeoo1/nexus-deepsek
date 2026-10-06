import { PERSONAS } from "./repo.js";
import { hashPassword } from "./security.js";

export const PREVIEW_TEST_ACCOUNT = Object.freeze({
  email: "test@nexus.ro",
  password: "test1234",
  handle: "test",
  displayName: "Test Nexus",
});

// `force` este folosit exclusiv de seeder-ul local
// (scripts/dev-test-account.mjs): același cont trebuie să existe și pe
// mașina de dezvoltare, unde NODE_ENV nu este "production", deci garda de
// preview de mai jos l-ar sări.
export function ensurePreviewTestAccount(repo, env = process.env, { force = false } = {}) {
  const preview = env.NODE_ENV === "production"
    && String(env.NEXUS_DEPLOYMENT_MODE ?? "").trim().toLowerCase() === "preview";
  if (!preview && !force) return null;

  let user = repo.getUserByEmail(PREVIEW_TEST_ACCOUNT.email);
  if (!user) {
    const handleOwner = repo.getUserByHandle(PREVIEW_TEST_ACCOUNT.handle);
    if (handleOwner) throw new Error("preview test handle is already assigned");
    user = repo.createUser({
      handle: PREVIEW_TEST_ACCOUNT.handle,
      displayName: PREVIEW_TEST_ACCOUNT.displayName,
      bio: "Cont public pentru testarea interfeței Nexus.",
      passwordHash: hashPassword(PREVIEW_TEST_ACCOUNT.password),
    });
    repo.linkProvider(user.id, { email: PREVIEW_TEST_ACCOUNT.email });
  } else {
    repo.updatePassword(user.id, hashPassword(PREVIEW_TEST_ACCOUNT.password));
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
