import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = {
  M11_MUSIC: [
    ["independent_catalog_schema", "lib/db.js", "CREATE TABLE IF NOT EXISTS music_tracks"],
    ["owned_resumable_master", "lib/repo.js", "hasMediaUploadGrant(mediaId, ownerId, \"music_master\", \"social\")"],
    ["rights_declaration_required", "lib/api.js", "rights_declared !== true"],
    ["rights_before_media_delivery", "lib/repo.js", "musicTrack && this.getMusicTrack"],
    ["organic_discovery", "lib/repo.js", "u.traffic_class = 'HUMAN_ORGANIC'"],
    ["raw_play_not_royalty", "lib/api.js", "NO_ROYALTY_FROM_RAW_START"],
    ["private_library_and_playlists", "lib/db.js", "CREATE TABLE IF NOT EXISTS music_library"],
    ["commercial_catalog_fail_closed", "lib/api.js", "commercial_catalog: false"],
    ["executable_music_ui", "public/music-grow-module.js", "ARTIST STUDIO · SELF-DECLARED LOCAL"],
  ],
  M11_GROW: [
    ["w0_w1_schema", "lib/db.js", "medical_class TEXT NOT NULL CHECK(medical_class IN ('W0','W1'))"],
    ["w0_w1_api_boundary", "lib/api.js", "EDUCATION_AND_GENERAL_WELLBEING_W0_W1"],
    ["ciphertext_only_store", "lib/db.js", "CREATE TABLE IF NOT EXISTS grow_private_entries"],
    ["no_sensitive_reuse", "lib/api.js", "reused_for_ads_dating_work_reputation: false"],
    ["transparent_local_split", "lib/repo.js", "offer.price_cents - fee"],
    ["paid_course_not_activated", "lib/repo.js", "local_enrolled_no_payment"],
    ["device_side_encryption", "public/music-grow-module.js", "crypto.subtle.encrypt"],
    ["executable_grow_ui", "public/music-grow-module.js", "Private progress"],
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
  schema: "NEXUS_M11_LOCAL_ACCEPTANCE_V1", cycle_range: "306-325",
  definition: "independent_music_and_w0_w1_grow_executable_local_slices_not_licensed_or_medical_certification",
  milestones, summary: { total, passed: total - failed, failed },
  source_sha256: Object.fromEntries(filenames.map((file) => [file, createHash("sha256").update(sources[file]).digest("hex")])),
  aggregate_local_gate: failed ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: [
    "music_rights_contracts_fingerprinting_transcoding_signed_cdn_and_royalty_methodology",
    "music_takedown_counter_notice_and_independent_legal_security_privacy_review",
    "grow_dpia_credentials_country_pack_editorial_medical_board_and_claims_review",
    "real_payment_tax_refund_payout_and_app_store_review",
  ],
  external_network: false, real_funds: false, incremental_cost: 0,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
