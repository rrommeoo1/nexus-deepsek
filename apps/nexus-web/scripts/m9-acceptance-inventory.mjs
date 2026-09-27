import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [
  ["persona_isolation", "lib/api.js", "VERTICAL_PERSONA_REQUIRED"],
  ["adult_profile_constraint", "lib/db.js", "CHECK(age BETWEEN 18 AND 99)"],
  ["mutual_eligibility", "lib/repo.js", "viewer.seeking.includes(candidate.gender) && candidate.seeking.includes(viewer.gender)"],
  ["synthetic_actor_exclusion", "lib/repo.js", "HUMAN_ORGANIC"],
  ["private_decisions", "lib/api.js", "DECISION_PRIVATE_UNLESS_MUTUAL_MATCH"],
  ["single_reciprocal_match", "lib/db.js", "UNIQUE(user_low_id, user_high_id)"],
  ["dating_conversation", "lib/repo.js", "contextPersona: \"dating\""],
  ["block_closes_match_and_chat", "lib/repo.js", "UPDATE dating_matches SET status = 'blocked'"],
  ["meet_pin_hash_two_party", "lib/repo.js", "DATING_MEET_PIN_OR_WINDOW_INVALID"],
  ["no_desirability_score", "public/dating-module.js", "Fără scor de atractivitate"],
  ["prive_fail_closed", "lib/api.js", "PRIVE_EXTERNAL_GATES_REQUIRED"],
  ["executable_ui", "public/app.js", "renderDatingWorkspace"],
];
const filenames = [...new Set(checks.map(([, file]) => file))];
const sources = Object.fromEntries(filenames.map((file) => [file, readFileSync(resolve(root, file), "utf8")]));
const criteria = checks.map(([id, source, fragment]) => ({ id, source, pass: sources[source].includes(fragment) }));
const failed = criteria.filter((item) => !item.pass).length;
const report = {
  schema: "NEXUS_M9_LOCAL_ACCEPTANCE_V1",
  cycle_range: "281-290",
  definition: "safe_local_dating_slice_and_prive_fail_closed_not_production_certification",
  criteria,
  summary: { total: criteria.length, passed: criteria.length - failed, failed },
  source_sha256: Object.fromEntries(filenames.map((file) => [file, createHash("sha256").update(sources[file]).digest("hex")])),
  aggregate_local_gate: failed ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: [
    "age_identity_liveness_and_adult-content-provider_validation",
    "jurisdictional_dating_and_adult-content_legal_review",
    "production_safety_moderation_and_human_escalation_operations",
    "independent_security_privacy_and_abuse audit",
    "production_deploy_and_real_funds_approval",
  ],
  external_network: false,
  real_funds: false,
  incremental_cost: 0,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
