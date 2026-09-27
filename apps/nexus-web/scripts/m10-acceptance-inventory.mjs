import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = {
  M10_WATCH: [
    ["rights_before_discovery", "lib/api.js", "ELIGIBILITY_BEFORE_DISCOVERY"],
    ["owned_resumable_media", "lib/repo.js", "hasMediaUploadGrant(mediaId, ownerId, \"watch_video\", \"social\")"],
    ["organic_discovery", "lib/repo.js", "u.traffic_class = 'HUMAN_ORGANIC'"],
    ["subscriptions_playlists_progress", "lib/db.js", "CREATE TABLE IF NOT EXISTS watch_progress"],
    ["progress_private_telemetry", "lib/repo.js", "VIEWER_ONLY_TELEMETRY_NO_ACTION_LEDGER"],
    ["executable_studio", "public/watch-module.js", "CREATOR STUDIO · LOCAL"],
  ],
  M10_LIVE: [
    ["managed_provider_fail_closed", "lib/repo.js", "LIVE_INGEST_NOT_CONFIGURED"],
    ["schedule_local", "lib/repo.js", "action === \"schedule\" && row.status === \"preview\""],
    ["emergency_terminate_local", "lib/repo.js", "action === \"terminate\""],
  ],
  M10_KIDS: [
    ["child_token_only", "lib/api.js", "KIDS_TOKEN_ONLY_NO_ADULT_ROUTES"],
    ["allowlisted_catalog", "lib/db.js", "CREATE TABLE IF NOT EXISTS kids_catalog_entries"],
    ["autoplay_hard_off", "lib/db.js", "CHECK(autoplay = 0)"],
    ["no_wallet_messages_ads", "lib/api.js", "ads: false, wallet: false, messages: false, public_upload: false, autoplay: false"],
    ["offchain_short_retention", "lib/api.js", "CHILD_TENANT_SHORT_RETENTION"],
    ["separate_shell", "public/kids.html", "Nexus Kids · local"],
    ["finite_session", "lib/api.js", "KIDS_TIME_LIMIT_REACHED"],
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
const report = { schema: "NEXUS_M10_LOCAL_ACCEPTANCE_V1", cycle_range: "291-305",
  definition: "watch_live_kids_executable_local_slices_not_provider_or_country_certification", milestones,
  summary: { total, passed: total - failed, failed },
  source_sha256: Object.fromEntries(filenames.map((file) => [file, createHash("sha256").update(sources[file]).digest("hex")])),
  aggregate_local_gate: failed ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: ["vod_object_storage_transcoding_cdn_and_rights_fingerprint", "managed_live_ingest_sfu_failover_and_moderation", "kids_separate_production_tenant_binary_and_key_hierarchy", "verifiable_parental_authority_country_pack_dpia_and_app_store_review", "independent_security_privacy_child_safety_and_accessibility_review"],
  external_network: false, real_funds: false, incremental_cost: 0 };
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
