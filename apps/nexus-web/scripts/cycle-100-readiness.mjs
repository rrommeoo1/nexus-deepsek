import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(APP_ROOT, "..", "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(relativePath) {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

export function runCycle100Readiness() {
  const specPath = "docs/24-social-production-functional-spec.md";
  const evidencePaths = {
    privacy: "planning/evidence/NX-WEB-SOCIAL-P01-p0-privacy-matrix-v1.json",
    upload: "planning/evidence/NX-WEB-SOCIAL-P01-p0-resumable-upload-v1.json",
    messaging: "planning/evidence/NX-WEB-SOCIAL-P02-messaging-e2ee-local-closure-v1.json",
    social: "planning/evidence/NX-WEB-SOCIAL-P01-social-local-closure-v1.json",
    operations: "planning/evidence/NX-WEB-SOCIAL-cycles-089-098-operations-closure-v1.json",
  };
  const evidence = Object.fromEntries(Object.entries(evidencePaths).map(([key, path]) => [key, readJson(path)]));
  const specLines = readText(specPath).split(/\r?\n/).length - 1;
  assert(specLines === 848, `authoritative Social specification drifted to ${specLines} lines`);
  assert(evidence.operations.cycles?.map((item) => item.cycle).join(",") === "89,90,91,92,93,94,95,96,97,98", "operations evidence is not a complete ordered 089-098 sequence");
  assert(evidence.operations.cycles.every((item) => String(item.gate).startsWith("PASS_LOCAL")), "an operations cycle is not locally closed");
  assert(evidence.operations.aggregate?.full_test_suite === "251/251", "aggregate test result is stale or incomplete");
  assert(evidence.operations.aggregate?.social_inventory === "26/26", "Social inventory is incomplete");
  assert(evidence.operations.aggregate?.e2ee_inventory === "40/40", "E2EE inventory is incomplete");
  assert(evidence.operations.constraints?.external_network === false && evidence.operations.constraints?.real_funds === false
    && evidence.operations.constraints?.incremental_cost === 0 && evidence.operations.constraints?.external_share === "DENIED", "zero-cost or external-share boundary drifted");
  assert(evidence.messaging.inventory?.construction_scoped_invariants === 40
    && evidence.messaging.inventory?.invariants_passed === 40
    && evidence.messaging.inventory?.invariants_failed === 0, "messaging closure no longer proves 40/40 construction controls");
  assert(evidence.social.inventory?.controls === "26/26", "Social closure no longer proves 26/26 controls");
  const publicReleaseClaims = [evidence.messaging.public_release_gate, ...(evidence.operations.explicitly_not_claimed ?? [])].join(" ").toLowerCase();
  assert(publicReleaseClaims.includes("blocked") && publicReleaseClaims.includes("independent"), "external release boundary is missing");
  for (const [relativePath, expected] of Object.entries(evidence.operations.sha256 ?? {})) {
    assert(/^[a-f0-9]{64}$/.test(String(expected)), `historical evidence hash is malformed: ${relativePath}`);
    readFileSync(join(REPO_ROOT, relativePath));
  }
  const apiSource = readText("apps/nexus-web/lib/api.js");
  assert(apiSource.includes('/share$/') && apiSource.includes('feature: "SOCIAL_SHARE", enabled: false'), "external sharing is not fail-closed in the API");
  const releaseSource = readText("apps/nexus-web/scripts/release-check.mjs");
  for (const gate of ["trusted HTTPS edge", "real WalletConnect attestation", "independent T0/T1 review", "Live SFU/moderation"]) {
    assert(releaseSource.includes(gate), `release gate is not declared: ${gate}`);
  }
  return {
    schema: "NEXUS_SOCIAL_CYCLE_100_READINESS_V1",
    gate: "PASS_LOCAL_ENGINEERING_SEQUENCE_100",
    public_release: "BLOCKED_BY_DECLARED_EXTERNAL_GATES",
    authoritative_spec_lines: specLines,
    evidence_packs_validated: Object.keys(evidencePaths).length,
    completed_cycle_range: "077-100",
    evidence_baseline_full_tests: "251/251",
    social_inventory: "26/26",
    e2ee_inventory: "40/40",
    external_network: false,
    real_funds: false,
    incremental_cost: 0,
    external_share: "DENIED",
    explicitly_not_claimed: [
      "production scale or availability",
      "real-device interoperability",
      "independent T0/T1 or cryptographic approval",
      "formal legal approval",
      "external provider readiness"
    ]
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(runCycle100Readiness(), null, 2));
  } catch (error) {
    console.error(`[cycle-100-readiness] ${String(error?.message ?? error).slice(0, 2000)}`);
    process.exitCode = 1;
  }
}
