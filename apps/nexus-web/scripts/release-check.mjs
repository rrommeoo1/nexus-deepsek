// Nexus local release gate. Deterministic, local-only, zero funds and no
// external providers. It verifies tests, synthetic isolation, migrations and a
// fail-closed production boot using an isolated temporary data directory.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { openDb } from "../lib/db.js";
import { runActors } from "./actors.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = [
  "server.js", ".env.example", "README.md", "public/index.html",
  "lib/db.js", "lib/api.js", "lib/action-ledger.js", "scripts/action-ledger-reconcile.mjs", "scripts/actors.js",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-120_000); });
    child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-120_000); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}\n${output}`)));
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(url, child, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`production smoke exited early with ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(700) });
      if (response.ok) return response.json();
    } catch { /* bounded local retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("production health did not become ready");
}

async function productionSmoke() {
  const tempRoot = mkdtempSync(join(tmpdir(), "nexus-release-"));
  const port = await availablePort();
  const origin = "https://nexus.invalid";
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    NEXUS_DATA_DIR: join(tempRoot, "data"),
    NEXUS_SESSION_SECRET: "release-check-only-".repeat(4),
    NEXUS_ORIGIN: origin,
    NEXUS_ACCEPTED_ORIGINS: origin,
    NEXUS_WC_PROJECT_ID: "a".repeat(32),
    NEXUS_WC_PROJECT_ATTESTED: "true",
    NEXUS_WC_ATTESTED_ORIGINS: origin,
    NEXUS_RATE_LIMIT_MODE: "trusted-edge",
    NEXUS_TRUST_PROXY: "1",
    NEXUS_TLS_PFX_PATH: join(tempRoot, "absent-release-check.pfx"),
  };
  const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-20_000); });
  child.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-20_000); });
  try {
    const health = await waitForHealth(`http://127.0.0.1:${port}/health`, child);
    assert(health.ok === true && health.status === "ready", "production health is not ready");
    assert(!("users" in health) && !("oauth" in health), "production health leaks internal state");
    const insecureApi = await fetch(`http://127.0.0.1:${port}/api/providers`);
    assert(insecureApi.status === 400, `production API accepted insecure transport (${insecureApi.status})`);
    const db = openDb(join(tempRoot, "data", "nexus.sqlite"));
    try {
      assert(db.prepare("PRAGMA integrity_check").get().integrity_check === "ok", "production smoke database integrity failed");
    } finally { db.close(); }
    return { health: "PASS", insecure_api_denied: true, isolated_data: true };
  } catch (error) {
    throw new Error(`${error.message}\n${logs}`);
  } finally {
    if (child.exitCode == null) child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const node = process.versions.node.split(".").map(Number);
  assert(node[0] > 22 || (node[0] === 22 && node[1] >= 13), `Node ${process.versions.node} is below 22.13`);
  const missing = REQUIRED.filter((file) => !existsSync(join(ROOT, file)));
  assert(missing.length === 0, `missing release artifacts: ${missing.join(", ")}`);

  const testFiles = readdirSync(join(ROOT, "test")).filter((name) => name.endsWith(".test.js")).map((name) => join("test", name));
  await run(process.execPath, ["--test", ...testFiles]);

  const actors = runActors({ count: 1_000, seed: 0x4e585553 });
  assert(actors.deployment_gate === "PASS", `synthetic actor gate failed: ${JSON.stringify(actors.issues)}`);
  const production = await productionSmoke();
  const report = {
    gate: "PASS",
    environment: "local_release_check",
    node: process.versions.node,
    test_files: testFiles.length,
    synthetic_actors: actors.count,
    synthetic_issues: actors.issues.length,
    production,
    external_network: false,
    real_funds: false,
    incremental_cost: 0,
    remaining_external_gates: ["trusted HTTPS edge", "real WalletConnect attestation", "independent T0/T1 review", "Live SFU/moderation", "approved news aggregator (NEXUS_NEWS_PROVIDER)"],
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`[release-check] ${String(error?.message ?? error).slice(0, 4000)}`);
  process.exitCode = 1;
});
