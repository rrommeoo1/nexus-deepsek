// Local-only seeder for the documented test-data set (docs/TEST-DATA.md).
//
//   $env:NEXUS_TEST_ACCOUNT_PASSWORD='...'; npm run dev:fixtures -- --confirm-local-db
//   node scripts/dev-social-fixtures.mjs --clip C:\clips\clip1.mp4 --confirm-local-db
//
// It writes only to the local database (data/nexus.sqlite) and to the local
// content-addressed media store. No network, no wallet, no secret on disk: the
// account password comes from NEXUS_TEST_ACCOUNT_PASSWORD and is never printed.
// Re-running it is a no-op, so it is safe to run before every device session.
import { DB_PATH, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { TEST_ACCOUNT_PASSWORD_ENV, PREVIEW_TEST_ACCOUNT, previewTestAccountPassword } from "../lib/preview-test-account.js";
import { seedSocialFixtures, FIXTURE_PEERS } from "../lib/social-fixtures.js";


const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const withValue = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withValue) return withValue.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};
const clips = argv.reduce((list, arg, index) => (arg === "--clip" && argv[index + 1] ? [...list, argv[index + 1]] : list), []);
const ownerHandle = flag("--owner", PREVIEW_TEST_ACCOUNT.handle);
const confirmed = argv.includes("--confirm-local-db");

if (process.env.NODE_ENV === "production") {
  console.error("[fixtures] refuzat: rulează doar pe mașina de dezvoltare (NODE_ENV=production).");
  process.exit(2);
}
if (!confirmed) {
  console.error("[fixtures] adaugă --confirm-local-db (scrie conturi și conținut în baza locală).");
  process.exit(2);
}
const password = previewTestAccountPassword(process.env);
if (!password) {
  console.error(`[fixtures] lipsește ${TEST_ACCOUNT_PASSWORD_ENV} (minim 8 caractere), folosită și pentru contul de test.`);
  process.exit(2);
}

const db = openDb();
let failed = false;
try {
  const repo = createRepo(db);
  const summary = seedSocialFixtures(repo, db, { password, ownerHandle, clips, log: (line) => console.log(`[fixtures] ${line}`) });
  console.log(`[fixtures] conturi de test: ${FIXTURE_PEERS.map((peer) => `@${peer.handle}`).join(", ")}`);
  console.log(`[fixtures] contul de autentificare: @${ownerHandle} <${PREVIEW_TEST_ACCOUNT.email}>`);
  // Verification is the end state, not the work done: a second (idempotent) run
  // creates nothing, yet the account it seeds must still be complete.
  const owner = repo.getUserByHandle(ownerHandle);
  const state = {
    feed: repo.listSocialFeed(owner.id, { lens: "for-you", format: "all", limit: 60 }).length,
    feed_with_media: repo.listSocialFeed(owner.id, { lens: "for-you", format: "all", limit: 60 }).filter((post) => post.media).length,
    stories: repo.listActiveStories(owner.id, "social").length,
    conversations: repo.listUnifiedConversations(owner.id, { persona: "social" }).length,
    unread_notifications: repo.unreadNotifications(owner.id, "social"),
    new_this_run: summary,
  };
  console.log(`[fixtures] stare finală: ${JSON.stringify(state)}`);
  console.log(`[fixtures] bază de date: ${DB_PATH}`);
  if (state.feed < 12 || state.stories < 5 || state.conversations < 4 || state.unread_notifications < 5) failed = true;
  if (failed) console.error("[fixtures] starea finală nu conține setul complet; vezi numerele de mai sus.");
} catch (error) {
  console.error(`[fixtures] a eșuat: ${String(error?.message ?? error)}`);
  failed = true;
} finally {
  db.close();
}
process.exitCode = failed ? 1 : 0;
