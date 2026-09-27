import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const audits = [
  ["social", "social-integrity-inventory.mjs", "local_gate"],
  ["e2ee", "e2ee-audit-inventory.mjs", "local_gate"],
  ["reads", "read-authorization-inventory.mjs", "gate"],
  ["supply_chain", "supply-chain-inventory.mjs", "gate"],
  ["deployment", "deployment-contract-inventory.mjs", "gate"],
  ["data", "data-index-inventory.mjs", "gate"],
  ["m1_m3", "m1-m3-acceptance-inventory.mjs", "aggregate_local_gate"],
  ["m4_m5", "m4-m5-acceptance-inventory.mjs", "aggregate_local_gate"],
  ["m6_m8", "m6-m8-acceptance-inventory.mjs", "aggregate_local_gate"],
];
const results = {};
for (const [id, script, gateField] of audits) {
  const run = spawnSync(process.execPath, [resolve(import.meta.dirname, script)], { encoding: "utf8" });
  if (run.status !== 0) results[id] = { gate: "FAIL_EXECUTION", detail: (run.stderr || run.stdout).slice(0, 500) };
  else {
    const parsed = JSON.parse(run.stdout);
    results[id] = { gate: parsed[gateField], failed: parsed.summary?.failed ?? parsed.invariant_summary?.failed ?? null,
      production_gate: parsed.production_gate || parsed.legal_license_gate || null };
  }
}
const evidenceNames = [
  "planning/evidence/NX-WEB-SOCIAL-cycles-141-150-integrity-v1.json",
  "planning/evidence/NX-WEB-SOCIAL-cycles-151-160-integrity-v1.json",
  "planning/evidence/NX-M1-M3-cycles-201-230-local-closure-v1.json",
  "planning/evidence/NX-M4-M5-cycles-231-250-local-closure-v1.json",
  "planning/evidence/NX-M6-M8-cycles-251-280-local-closure-v1.json",
];
const evidenceSha256 = Object.fromEntries(evidenceNames.map((name) => {
  const bytes = readFileSync(resolve(repoRoot, name));
  return [name, createHash("sha256").update(bytes).digest("hex")];
}));
const localPass = Object.values(results).every((item) => !String(item.gate).startsWith("FAIL") && item.failed !== null && item.failed === 0);
const report = {
  schema: "NEXUS_RELEASE_EVIDENCE_INVENTORY_V1", cycle: 280, audits: results,
  evidence_sha256: evidenceSha256,
  external_gates: {
    formal_security_audit: "PENDING", formal_crypto_audit: "PENDING",
    formal_license_review: "PENDING", formal_legal_approval: "PENDING",
    real_device_provider_validation: "PENDING", production_live_capacity: "PENDING",
  },
  external_network: false, real_funds: false, incremental_cost: 0,
  gate: localPass ? "PASS_LOCAL" : "FAIL_LOCAL",
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (!localPass) process.exitCode = 1;
