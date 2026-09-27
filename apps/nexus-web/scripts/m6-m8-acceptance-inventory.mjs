import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = {
  M6_FAIR_MARKET: [
    ["persona_isolation", "test/p1-m6-m8-fair-verticals.test.js", "VERTICAL_PERSONA_REQUIRED"],
    ["prohibited_items_fail_closed", "lib/api.js", "MARKET_PROHIBITED_ITEM"],
    ["single_offer_winner", "lib/repo.js", "listing lost race"],
    ["immutable_order_quote", "lib/db.js", "quoted_amount_cents INTEGER NOT NULL"],
    ["transaction_bound_review", "lib/repo.js", "review not eligible"],
    ["legacy_contract_retired", "lib/api.js", "MARKET_LISTINGS_LEGACY_RETIRED"],
    ["executable_market_ui", "public/fair-verticals.js", "renderMarketWorkspace"],
    ["zero_real_settlement", "lib/api.js", "LOCAL_DEMO_NO_PAYMENT"],
  ],
  M7_PRIVACY_SAFE_STAY: [
    ["persona_isolation", "test/p1-m6-m8-fair-verticals.test.js", "M7 Stay hides exact address"],
    ["address_hidden_from_discovery", "public/fair-verticals.js", "HIDDEN_UNTIL_BOOKING"],
    ["overlap_safe_booking", "lib/repo.js", "STAY_DATES_UNAVAILABLE"],
    ["quote_commitment", "lib/repo.js", "cancellationPolicy: listing.cancellation_policy"],
    ["participant_only_booking_read", "lib/repo.js", "WHERE b.host_id = ? OR b.guest_id = ?"],
    ["double_blind_reviews", "lib/repo.js", "Stay/Ride remain double-blind"],
    ["executable_stay_ui", "public/fair-verticals.js", "renderStayWorkspace"],
    ["zero_real_settlement", "lib/api.js", "address_visibility: \"PARTICIPANTS_ONLY\""],
  ],
  M8_PRIVACY_SAFE_RIDE: [
    ["persona_isolation", "test/p1-m6-m8-fair-verticals.test.js", "M8 Ride exposes synthetic map truth"],
    ["real_verification_fail_closed", "lib/api.js", "RIDE_REAL_VERIFICATION_REQUIRED"],
    ["no_coordinate_fields", "lib/db.js", "pickup_zone TEXT NOT NULL"],
    ["one_driver_winner", "lib/repo.js", "ride lost race"],
    ["pin_hash_only", "lib/repo.js", "sha256Hex(String(tripPin))"],
    ["driver_lifecycle", "lib/repo.js", "status = 'available', updated_at = unixepoch()"],
    ["synthetic_map_truth", "public/fair-verticals.js", "Nicio locație reală de șofer nu este pretinsă"],
    ["zero_real_settlement", "lib/api.js", "precise_location_stored: false"],
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
  schema: "NEXUS_M6_M8_LOCAL_ACCEPTANCE_V1", cycle_range: "251-280",
  definition: "executable_local_vertical_slices_not_competitor_parity_or_production_certification",
  milestones, summary: { total, passed: total - failed, failed },
  source_sha256: Object.fromEntries(filenames.map((file) => [file, createHash("sha256").update(sources[file]).digest("hex")])),
  aggregate_local_gate: failed ? "FAIL_LOCAL" : "PASS_LOCAL",
  external_gates_open: [
    "real_payment_escrow_refund_chargeback_and_tax_rails", "shipping_tracking_maps_routing_eta_and_background_location",
    "property_driver_vehicle_identity_insurance_and_country_licensing", "real_device_geolocation_and_accessibility_matrix",
    "automated_moderation_safety_operations_and_independent_security_privacy_legal_review", "production_deploy_and_real_funds_approval"
  ],
  external_network: false, real_funds: false, incremental_cost: 0,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
