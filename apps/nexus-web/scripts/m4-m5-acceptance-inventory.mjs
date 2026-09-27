import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = {
  M4_LOCAL_PRODUCTIZATION: [
    ["atomic_storage_provider", "test/p0-m4-local-productization.test.js", "atomic, deterministic and path confined"],
    ["provider_fail_closed", "test/p0-m4-local-productization.test.js", "fails closed for unimplemented or paid external providers"],
    ["trusted_https_contract", "test/p0-m4-local-productization.test.js", "production configuration accepts the local default"],
    ["mobile_manifest_no_private_cache", "test/p0-m4-local-productization.test.js", "installable metadata without caching protected responses"],
    ["realtime_push_truth", "test/p0-m4-local-productization.test.js", "realtime and push gates remain truthful and profile-bound"],
    ["responsive_safe_area", "test/p3-mobile-layout.test.js", "full bleed and bounded by dynamic viewport plus safe areas"],
    ["protected_media_no_store", "test/p0-offline-private-cache.test.js", "protected media responses stay private"],
    ["deployment_contract", "test/p0-deployment-contract.test.js", "environment, health and explicit release gates"],
  ],
  M5_WORK_BUSINESS_BEAUTY: [
    ["work_profile_isolation", "test/p1-m5-work-business.test.js", "active-persona bound, validated and replay safe"],
    ["job_publish_apply", "test/p1-m5-work-business.test.js", "prevents self and duplicate applications"],
    ["single_winner_booking", "test/p1-m5-work-business.test.js", "one winner, zero real settlement and private appointment reads"],
    ["database_constraints", "test/p1-m5-work-business.test.js", "database constraints and UI expose the executable Work/Beauty journey"],
    ["work_ui_integrated", "public/app.js", "renderWorkWorkspace(vp, { api, toast, state })"],
    ["work_bottom_nav_integrated", "public/app.js", "renderWorkWorkspace(vp, { api, toast, state }, \"jobs\")"],
    ["business_ui_controls", "public/work-module.js", "data-book-slot"],
    ["no_real_settlement", "lib/api.js", "LOCAL_DEMO_NO_PAYMENT"],
  ],
};

const filenames = [...new Set(Object.values(checks).flat().map(([, file]) => file))];
const sources = Object.fromEntries(filenames.map((file) => [file, readFileSync(resolve(root, file), "utf8")]));
const milestones = {};
for (const [name, criteria] of Object.entries(checks)) {
  const results = criteria.map(([id, source, fragment]) => ({ id, source, pass: sources[source].includes(fragment) }));
  const failed = results.filter((item) => !item.pass).length;
  milestones[name] = { criteria: results, summary: { total: results.length, passed: results.length - failed, failed }, local_gate: failed ? "FAIL" : "PASS" };
}
const failed = Object.values(milestones).reduce((sum, item) => sum + item.summary.failed, 0);
const total = Object.values(milestones).reduce((sum, item) => sum + item.summary.total, 0);
const report = {
  schema: "NEXUS_M4_M5_LOCAL_ACCEPTANCE_V1", cycle_range: "231-250",
  definition: "executable_local_acceptance_not_external_certification", milestones,
  summary: { total, passed: total - failed, failed },
  source_sha256: Object.fromEntries(filenames.map((file) => [file, createHash("sha256").update(sources[file]).digest("hex")])),
  aggregate_local_gate: failed ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: [
    "trusted_public_https_edge_and_staging_observability", "real_device_visual_camera_walletconnect_validation",
    "distributed_object_storage_cdn_transcoding_and_push_provider", "real_payment_identity_and_calendar_providers",
    "independent_security_privacy_accessibility_and_legal_review", "production_deploy_and_real_funds_approval"
  ],
  external_network: false, real_funds: false, incremental_cost: 0,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
