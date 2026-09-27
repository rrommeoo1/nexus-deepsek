// Offline SBOM gate. It verifies the repository's already-installed lock state;
// it deliberately makes no claim about current vulnerability advisories.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const appPackage = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const lockBytes = readFileSync(resolve(repoRoot, "package-lock.json"));
const lock = JSON.parse(lockBytes);
const packages = Object.entries(lock.packages).filter(([name]) => name);
const direct = Object.entries(appPackage.dependencies || {});

const checks = {
  lockfile_v3: lock.lockfileVersion === 3,
  direct_declarations_aligned: direct.every(([name, range]) => rootPackage.dependencies?.[name] === range),
  direct_packages_locked: direct.every(([name]) => Boolean(lock.packages[`node_modules/${name}`]?.version)),
  every_archive_integrity_pinned: packages.every(([, item]) => item.link || typeof item.integrity === "string"),
  registry_sources_https_only: packages.every(([, item]) => !item.resolved || item.resolved.startsWith("https://registry.npmjs.org/")),
  every_package_declares_license: packages.every(([, item]) => item.link || typeof item.license === "string" || Array.isArray(item.license)),
};
const passed = Object.values(checks).filter(Boolean).length;
const licenseCounts = {};
const copyleftPackages = [];
for (const [, item] of packages) {
  const license = Array.isArray(item.license) ? item.license.join(" OR ") : (item.license || "LINK");
  licenseCounts[license] = (licenseCounts[license] || 0) + 1;
}
for (const [path, item] of packages) {
  if (/GPL|AGPL/i.test(String(item.license || ""))) copyleftPackages.push({ path, version: item.version, license: item.license, dev: item.dev === true });
}
const report = {
  schema: "NEXUS_OFFLINE_SBOM_INVENTORY_V1",
  cycle: 171,
  package_count: packages.length,
  direct_dependencies: Object.fromEntries(direct.map(([name]) => [name, lock.packages[`node_modules/${name}`]?.version || null])),
  licenses: licenseCounts,
  copyleft_packages: copyleftPackages,
  checks,
  summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
  lockfile_sha256: createHash("sha256").update(lockBytes).digest("hex"),
  advisory_database_checked: false,
  advisory_nonclaim: "No network advisory database was queried; run an approved current SCA scanner before release.",
  legal_license_gate: copyleftPackages.length ? "FORMAL_REVIEW_REQUIRED_BEFORE_DISTRIBUTION" : "NO_COPYLEFT_DETECTED",
  network_egress: false,
  incremental_cost: 0,
  gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL",
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
