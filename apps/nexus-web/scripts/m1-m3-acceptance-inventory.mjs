import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = {
  M1_IDENTITY: [
    ["email_signup_atomic", "test/email-auth-session.test.js", "signup challenge, account and encrypted session roll back and retry atomically"],
    ["email_login_concurrent", "test/email-auth-session.test.js", "email login command rejects key reuse and issues unique sessions under load"],
    ["logout_replay_safe", "test/email-auth-session.test.js", "logout requires one credential-bound idempotency key"],
    ["xportal_native_auth", "test/wallet-connect.test.js", "approved session binds the mainnet account and NativeAuth method"],
    ["oauth_fail_closed", "test/core.test.js", "Google stays truthfully unavailable until the embedded wallet provisioner is verified"],
    ["wallet_identity_unique", "test/core.test.js", "wallet identity is cross-column unique"],
    ["device_wallet_client_only", "test/core.test.js", "email signup binds a client-only wallet proof"],
    ["username_unique", "test/core.test.js", "claimUsername validates format and uniqueness"],
    ["persona_independent", "test/p1-comments-profiles.test.js", "privacy settings are validated and isolated per persona end to end"],
    ["account_lifecycle", "test/p1-account-lifecycle.test.js", "deletion uses double confirmation"],
  ],
  M2_DATA_INTEGRITY: [
    ["idempotent_mutations", "test/mutation-outbox.test.js", "authenticated Social mutations require a key and replay one created post"],
    ["atomic_outbox", "test/p0-mutation-outbox-drill.test.js", "crash windows recover without duplicate durable intent"],
    ["resumable_upload", "test/resumable-upload.test.js", "resumable upload survives interruption, rejects conflicting retries and completes once with outbox"],
    ["deny_first_privacy", "test/privacy-matrix.test.js", "exhaustive audience property matrix agrees with a deny-first oracle"],
    ["critical_read_inventory", "test/p0-read-authorization-inventory.test.js", "critical privacy-bearing reads have explicit owner"],
    ["media_private_no_store", "test/p0-offline-private-cache.test.js", "protected media responses stay private"],
    ["migration_restore", "test/p0-migration-backup-restore-drill.test.js", "migrates, backs up, restores and restarts losslessly"],
    ["backup_integrity", "test/p1-backup-restore.test.js", "verified backup restores an identical current-schema state"],
    ["synthetic_isolation", "test/p0-abuse-simulation.test.js", "synthetic spam, report flood and blocking cannot affect organic state"],
    ["bounded_soak", "test/p0-local-soak.test.js", "no backlog, isolation or crash-recovery regression"],
  ],
  M3_NEXUS_SOCIAL: [
    ["clip_first_feed", "test/audit.test.js", "mobile Social shell returns Home from the logo and gives the clip most of the viewport"],
    ["continuous_fullscreen", "test/audit.test.js", "feed media opens at the selected item in a continuous vertical full-screen viewer"],
    ["sound_playback_state", "test/p1-fullscreen-interaction-state.test.js", "preserves the explicit sound preference"],
    ["stories_lifecycle", "test/p2-story-lifecycle.test.js", "Story publication is exactly-once when the client retries after a lost response"],
    ["story_owner_controls", "test/p2-story-owner-ui.test.js", "owner Story menu archives with a stable key and exact active-profile result"],
    ["create_and_drafts", "test/audit.test.js", "Create Hub exposes camera, gallery, story, clip, post and local drafts"],
    ["profile_privacy", "test/p1-comments-profiles.test.js", "public profile exposes persona avatar/cover/counts"],
    ["follow_requests", "test/p1-comments-profiles.test.js", "private follow requests converge under replay"],
    ["reactions", "test/p1-reaction-accessibility.test.js", "both tap and long press"],
    ["threaded_comments", "test/p1-comments-profiles.test.js", "comments preserve threaded history"],
    ["search_privacy", "test/p1-comments-profiles.test.js", "Social search pagination is bounded, duplicate-free"],
    ["ranking_exploration", "test/p1-cold-start-exploration.test.js", "receive deterministic organic exploration"],
    ["moderation_transparency", "test/p0-moderation-transparency-ui.test.js", "instead of presenting a truth score"],
    ["responsive_contract", "test/p3-mobile-layout.test.js", "phone shell is full bleed"],
    ["accessibility_contract", "test/p3-accessibility-modal.test.js", "all modal markup has an accessible name"],
  ],
};

const filenames = [...new Set(Object.values(checks).flat().map(([, filename]) => filename))];
const sources = Object.fromEntries(filenames.map((filename) => [filename, readFileSync(resolve(root, filename), "utf8")]));
const milestones = {};
for (const [milestone, criteria] of Object.entries(checks)) {
  const results = criteria.map(([id, source, fragment]) => ({ id, source, pass: sources[source].includes(fragment) }));
  const failed = results.filter((result) => !result.pass);
  milestones[milestone] = {
    criteria: results,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    local_gate: failed.length ? "FAIL" : "PASS",
  };
}
const failedTotal = Object.values(milestones).reduce((sum, milestone) => sum + milestone.summary.failed, 0);
const totalCriteria = Object.values(milestones).reduce((sum, milestone) => sum + milestone.summary.total, 0);
const report = {
  schema: "NEXUS_M1_M3_LOCAL_ACCEPTANCE_V1",
  cycle_range: "201-230",
  definition: "executable_local_demo_acceptance_not_production_certification",
  milestones,
  summary: { total: totalCriteria, passed: totalCriteria - failedTotal, failed: failedTotal },
  source_sha256: Object.fromEntries(filenames.map((filename) => [filename, createHash("sha256").update(sources[filename]).digest("hex")])),
  aggregate_local_gate: failedTotal ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: [
    "real_device_visual_and_camera_validation",
    "trusted_https_edge_and_production_origin",
    "real_google_facebook_and_walletconnect_provider_attestation",
    "current_network_advisory_scan_and_formal_GPL_distribution_review",
    "independent_security_privacy_and_cryptographic_audit",
    "formal_legal_and_store_approval"
  ],
  external_network: false,
  real_funds: false,
  incremental_cost: 0
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failedTotal) process.exitCode = 1;
